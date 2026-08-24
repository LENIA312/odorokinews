import type { Env } from "../types";
import {
  getCity,
  getWorld,
  listOrganizations,
  listPeople,
  listTimeline,
  previousEconomicValue,
} from "../db/queries";
import { nextWorldDate } from "../utils/date";
import { callAiForJson } from "./ai";
import { buildEventPrompt, buildNewsPrompt } from "./prompts";
import { validateEventDraft, validateNewsDraft, type ValidatedEventDraft, type ValidatedNewsDraft } from "./validate";
import { generateFallbackEventAndNews } from "./fallback";

export interface SimulationResult {
  skipped: boolean;
  reason?: string;
  worldDate?: string;
  eventId?: number;
  newsId?: number;
  aiCallsUsed?: number;
  source?: "ai" | "fallback_template";
}

const now = () => new Date().toISOString();

/**
 * 1日1回の世界進行を実行する（docs.md 14章のフロー）。
 * Cronからも管理用エンドポイントからも呼び出せる。
 */
export async function runDailySimulation(env: Env): Promise<SimulationResult> {
  const world = await getWorld(env);
  if (!world) {
    throw new Error("world レコードが存在しない。seed.sql の投入を確認してください。");
  }

  const targetDate = nextWorldDate(world.current_date);

  const existingRun = await env.DB.prepare("SELECT * FROM simulation_runs WHERE world_date = ?")
    .bind(targetDate)
    .first<{ id: number; status: string }>();

  if (existingRun?.status === "success") {
    return { skipped: true, reason: "already_processed", worldDate: targetDate };
  }
  if (existingRun) {
    // 前回失敗 or 異常終了した実行。再試行のため古い記録を削除する。
    await env.DB.prepare("DELETE FROM simulation_runs WHERE id = ?").bind(existingRun.id).run();
  }

  const startedAt = now();
  await env.DB.prepare(
    "INSERT INTO simulation_runs (world_date, started_at, status, ai_calls_used) VALUES (?, ?, 'running', 0)"
  )
    .bind(targetDate, startedAt)
    .run();

  let aiCallsUsed = 0;

  try {
    const [city, orgsResult, peopleResult, timelineResult] = await Promise.all([
      getCity(env, 1),
      listOrganizations(env),
      listPeople(env, 40),
      listTimeline(env, 5),
    ]);
    if (!city) {
      throw new Error("cities レコードが存在しない。seed.sql の投入を確認してください。");
    }
    const organizations = orgsResult.results ?? [];
    const people = peopleResult.results ?? [];
    const recentTimeline = timelineResult.results ?? [];

    const cityId = city.id;
    const cityName = city.name;
    const cityDescription = city.description ?? "";
    const population = city.population;

    const allowedPersonIds = new Set(people.map((p) => p.id));
    const allowedOrgIds = new Set(organizations.map((o) => o.id));

    let eventDraft: ValidatedEventDraft;
    let newsDraft: ValidatedNewsDraft | null = null;
    let source: "ai" | "fallback_template" = "fallback_template";

    const maxCalls = Number(env.AI_MAX_CALLS_PER_RUN) || 4;

    // フォールバックは一度だけ生成し、必要になったら使い回す
    // （複数箇所で呼ぶと毎回別のランダムな出来事になってしまうため）。
    let fallback: ReturnType<typeof generateFallbackEventAndNews> | null = null;
    const getFallback = () => {
      if (!fallback) fallback = generateFallbackEventAndNews(cityName, organizations, people);
      return fallback;
    };

    if (env.AI && maxCalls > 0) {
      const { system, user } = buildEventPrompt({
        worldName: world.name,
        cityName,
        cityDescription,
        population,
        targetDate,
        organizations,
        people,
        recentTimeline,
      });
      const aiResult = await callAiForJson(env, env.AI_EVENT_MODEL, system, user);
      aiCallsUsed++;
      const validated = aiResult.ok ? validateEventDraft(aiResult.json, allowedPersonIds, allowedOrgIds) : null;
      if (validated) {
        eventDraft = validated;
        source = "ai";
      } else {
        eventDraft = getFallback().event;
      }
    } else {
      eventDraft = getFallback().event;
    }

    // フォールバック経路では news もこの時点で確定させておく。
    if (source === "fallback_template") {
      newsDraft = getFallback().news;
    }

    // AIが提案した新規人物をDBへ作成する。
    const createdPeopleIds: number[] = [];
    const createdPeopleNames: string[] = [];
    for (const np of eventDraft.new_people) {
      const insertResult = await env.DB.prepare(
        `INSERT INTO people (name, name_kana, age, gender, city_id, occupation, organization_id, money, status, origin, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'alive', 'news_generated', ?, ?)`
      )
        .bind(np.name, np.name_kana, np.age, np.gender, cityId, np.occupation, np.organization_id, now(), now())
        .run();
      const newId = insertResult.meta.last_row_id as number;
      createdPeopleIds.push(newId);
      createdPeopleNames.push(np.name);
    }

    const relatedPeopleIds = [...eventDraft.related_person_ids, ...createdPeopleIds];
    const relatedPeopleNames = [
      ...people.filter((p) => eventDraft.related_person_ids.includes(p.id)).map((p) => p.name),
      ...createdPeopleNames,
    ];
    const relatedOrgNames = organizations
      .filter((o) => eventDraft.related_organization_ids.includes(o.id))
      .map((o) => o.name);

    // 世界状態への影響を適用する。
    const appliedImpact: Record<string, unknown>[] = [];
    for (const change of eventDraft.state_changes) {
      if (change.type === "person_status") {
        if (relatedPeopleIds.includes(change.target_id)) {
          await env.DB.prepare("UPDATE people SET status = ?, updated_at = ? WHERE id = ?")
            .bind(change.value, now(), change.target_id)
            .run();
          appliedImpact.push(change);
        }
      } else if (change.type === "organization_status") {
        await env.DB.prepare("UPDATE organizations SET status = ?, updated_at = ? WHERE id = ?")
          .bind(change.value, now(), change.target_id)
          .run();
        appliedImpact.push(change);
      } else if (change.type === "economic_stock_price") {
        const prev = await previousEconomicValue(env, change.target_id, "stock_price", targetDate);
        let value = change.value;
        if (prev) {
          const min = prev.value * 0.5;
          const max = prev.value * 2;
          value = Math.min(Math.max(value, min), max);
        } else {
          value = Math.min(value, 1_000_000);
        }
        await env.DB.prepare(
          "INSERT INTO economic_data (world_date, organization_id, metric, value, created_at) VALUES (?, ?, 'stock_price', ?, ?)"
        )
          .bind(targetDate, change.target_id, value, now())
          .run();
        appliedImpact.push({ ...change, applied_value: value });
      }
    }

    // AIが株価変動を提案しなかった場合でも、記事に登場した上場企業には
    // 小さな自動変動を与え、「ニュースがあったのに経済がまったく動かない」
    // というズレが起きないようにする。
    const coveredOrgIds = new Set(
      eventDraft.state_changes.filter((c) => c.type === "economic_stock_price").map((c) => c.target_id)
    );
    for (const orgId of eventDraft.related_organization_ids) {
      if (coveredOrgIds.has(orgId)) continue;
      const org = organizations.find((o) => o.id === orgId);
      if (!org || org.kind !== "company") continue;
      const prev = await previousEconomicValue(env, orgId, "stock_price", targetDate);
      if (!prev) continue; // 未上場（株価データがまだない）企業は対象外
      const delta = 1 + (Math.random() * 0.1 - 0.05); // -5%〜+5%の範囲で小さく変動
      const value = Math.round(prev.value * delta * 100) / 100;
      await env.DB.prepare(
        "INSERT INTO economic_data (world_date, organization_id, metric, value, created_at) VALUES (?, ?, 'stock_price', ?, ?)"
      )
        .bind(targetDate, orgId, value, now())
        .run();
      appliedImpact.push({ type: "economic_stock_price", target_id: orgId, value, source: "auto" });
    }

    const eventInsert = await env.DB.prepare(
      `INSERT INTO events
        (world_date, event_type, location_city_id, summary, detail, related_people, related_organizations, world_state_impact, is_newsworthy, source, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
    )
      .bind(
        targetDate,
        eventDraft.event_type,
        cityId,
        eventDraft.summary,
        eventDraft.detail,
        JSON.stringify(relatedPeopleIds),
        JSON.stringify(eventDraft.related_organization_ids),
        JSON.stringify(appliedImpact),
        source,
        now()
      )
      .run();
    const eventId = eventInsert.meta.last_row_id as number;

    if (source === "ai" && aiCallsUsed < maxCalls) {
      const { system, user } = buildNewsPrompt(
        { cityName, targetDate },
        {
          event_type: eventDraft.event_type,
          summary: eventDraft.summary,
          detail: eventDraft.detail,
          involves_magic: eventDraft.involves_magic,
          relatedPeopleNames,
          relatedOrgNames,
        }
      );
      const newsAiResult = await callAiForJson(env, env.AI_NEWS_MODEL, system, user);
      aiCallsUsed++;
      if (newsAiResult.ok) {
        newsDraft = validateNewsDraft(newsAiResult.json);
      }
    }

    if (!newsDraft) {
      // 記者AIが失敗した場合も、確定済みイベントの事実だけから記事を組み立てる。
      newsDraft = {
        title: eventDraft.summary,
        body: `${eventDraft.detail}\n\n関係者への取材によると、詳細は今後明らかになる見込み。`,
        category: "社会",
      };
    }

    const newsInsert = await env.DB.prepare(
      `INSERT INTO news
        (title, body, published_at, occurred_at, category, related_people, related_organizations, related_city_id, event_id, generated_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        newsDraft.title,
        newsDraft.body,
        now(),
        targetDate,
        newsDraft.category,
        JSON.stringify(relatedPeopleIds),
        JSON.stringify(eventDraft.related_organization_ids),
        cityId,
        eventId,
        source === "ai" ? env.AI_NEWS_MODEL : "fallback_template",
        now()
      )
      .run();
    const newsId = newsInsert.meta.last_row_id as number;

    await env.DB.prepare("UPDATE events SET news_id = ? WHERE id = ?").bind(newsId, eventId).run();
    await env.DB.prepare(
      "INSERT INTO timeline (world_date, event_id, headline, created_at) VALUES (?, ?, ?, ?)"
    )
      .bind(targetDate, eventId, newsDraft.title, now())
      .run();

    await env.DB.prepare("UPDATE world SET current_date = ?, updated_at = ? WHERE id = 1")
      .bind(targetDate, now())
      .run();

    await env.DB.prepare(
      `UPDATE simulation_runs
       SET status = 'success', finished_at = ?, ai_calls_used = ?, event_id = ?, news_id = ?
       WHERE world_date = ?`
    )
      .bind(now(), aiCallsUsed, eventId, newsId, targetDate)
      .run();

    return { skipped: false, worldDate: targetDate, eventId, newsId, aiCallsUsed, source };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await env.DB.prepare(
      "UPDATE simulation_runs SET status = 'failed', finished_at = ?, ai_calls_used = ?, error = ? WHERE world_date = ?"
    )
      .bind(now(), aiCallsUsed, message, targetDate)
      .run();
    throw err;
  }
}
