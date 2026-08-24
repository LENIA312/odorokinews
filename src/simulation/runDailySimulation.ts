import type { Env } from "../types";
import {
  createFacility,
  createOrganization,
  getCity,
  getRandomReporterId,
  getWorld,
  listActiveCities,
  listFacilitiesByCity,
  listOrganizationsByCity,
  listPeopleByCity,
  listRecentEvents,
  previousEconomicValue,
  parseIdArray,
} from "../db/queries";
import { computeBirthDateFromAge, nextWorldDate } from "../utils/date";
import { assignZonePositionForCity } from "../views/mapZones";
import { callAiForJson } from "./ai";
import { buildEventPrompt, buildNewsPrompt } from "./prompts";
import { validateEventDraft, validateNewsDraft, type ValidatedEventDraft, type ValidatedNewsDraft } from "./validate";
import { generateFallbackEventAndNews, padShortArticleBody } from "./fallback";
import { applyStateChanges } from "./stateChanges";

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
    // Active(利用可能)な都市の中からランダムに1件選び、その都市を舞台に生成する。
    // 都市管理でActiveに変更されていれば、首都ダイナン市以外も対象になりうる。
    const activeCitiesResult = await listActiveCities(env);
    const activeCities = activeCitiesResult.results ?? [];
    const city = activeCities.length
      ? activeCities[Math.floor(Math.random() * activeCities.length)]
      : await getCity(env, 1);
    if (!city) {
      throw new Error("cities レコードが存在しない。seed.sql の投入を確認してください。");
    }

    const [orgsResult, facilitiesResult, peopleResult, recentEventsResult] = await Promise.all([
      listOrganizationsByCity(env, city.id),
      listFacilitiesByCity(env, city.id),
      listPeopleByCity(env, city.id, 40),
      listRecentEvents(env, 5),
    ]);
    const organizations = orgsResult.results ?? [];
    const facilities = facilitiesResult.results ?? [];
    const people = peopleResult.results ?? [];
    const recentEvents = recentEventsResult.results ?? [];

    const cityId = city.id;
    const cityName = city.name;
    const cityDescription = city.description ?? "";
    const population = city.population;

    const allowedPersonIds = new Set(people.map((p) => p.id));
    const allowedOrgIds = new Set(organizations.map((o) => o.id));

    // 直前のイベントと同じ組織が「今回も主役」になるのを防ぐ
    // （小型モデルはプロンプトの「重複を避けよ」を守りきれないことがあるため、
    // 仕組み側でも直近1件との重複を機械的に弾く）。
    const lastEventOrgIds = new Set(
      recentEvents.length > 0 ? parseIdArray(recentEvents[0].related_organizations) : []
    );

    let eventDraft: ValidatedEventDraft;
    let newsDraft: ValidatedNewsDraft | null = null;
    let source: "ai" | "fallback_template" = "fallback_template";

    const maxCalls = Number(env.AI_MAX_CALLS_PER_RUN) || 4;

    // フォールバックは一度だけ生成し、必要になったら使い回す
    // （複数箇所で呼ぶと毎回別のランダムな出来事になってしまうため）。
    // 直前のイベントと同じ組織が選ばれないよう、候補から除外しておく。
    const fallbackOrgs = organizations.filter((o) => !lastEventOrgIds.has(o.id));
    let fallback: ReturnType<typeof generateFallbackEventAndNews> | null = null;
    const getFallback = () => {
      if (!fallback) {
        fallback = generateFallbackEventAndNews(cityName, fallbackOrgs.length ? fallbackOrgs : organizations, people);
      }
      return fallback;
    };

    if (env.AI && maxCalls > 0) {
      const { system, user } = buildEventPrompt({
        worldName: world.name,
        cityId,
        cityName,
        cityDescription,
        population,
        targetDate,
        weather: world.weather,
        organizations,
        people,
        recentEvents,
      });
      const aiResult = await callAiForJson(env, env.AI_EVENT_MODEL, system, user);
      aiCallsUsed++;
      const validated = aiResult.ok ? validateEventDraft(aiResult.json, allowedPersonIds, allowedOrgIds, cityId) : null;
      const repeatsLastEvent =
        validated != null && validated.related_organization_ids.some((id) => lastEventOrgIds.has(id));
      if (validated && !repeatsLastEvent) {
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

    // AIが提案した新規人物をDBへ作成する。生年月日・生まれはAIには書かせず、
    // 年齢・所在都市から機械的に算出する（キャラクター作成の全項目を必ず埋める）。
    const createdPeopleIds: number[] = [];
    const createdPeopleNames: string[] = [];
    for (const np of eventDraft.new_people) {
      const insertResult = await env.DB.prepare(
        `INSERT INTO people
           (name, name_kana, age, gender, city_id, occupation, organization_id, money, status, origin,
            job_title, annual_income, birth_date, birthplace, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'alive', 'news_generated', ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          np.name,
          np.name_kana,
          np.age,
          np.gender,
          cityId,
          np.occupation,
          np.organization_id,
          np.job_title,
          np.annual_income,
          computeBirthDateFromAge(targetDate, np.age),
          cityName,
          now(),
          now()
        )
        .run();
      const newId = insertResult.meta.last_row_id as number;
      createdPeopleIds.push(newId);
      createdPeopleNames.push(np.name);
    }

    // AIが提案した新規組織・施設をDBへ作成する（同一都市のみ、validateEventDraftで検証済み）。
    const createdOrgIds: number[] = [];
    const createdOrgNames: string[] = [];
    const zonePoints = [
      ...organizations.filter((o) => o.map_x != null && o.map_y != null).map((o) => ({ x: o.map_x as number, y: o.map_y as number })),
      ...facilities.map((f) => ({ x: f.map_x, y: f.map_y })),
    ];
    for (const no of eventDraft.new_organizations) {
      const pos = assignZonePositionForCity(city, zonePoints);
      const newOrgId = await createOrganization(env, {
        name: no.name,
        kind: no.kind,
        city_id: cityId,
        description: null,
        industry: no.industry,
        employee_scale: null,
        founded_year: null,
        map_x: pos.x,
        map_y: pos.y,
      });
      zonePoints.push(pos);
      createdOrgIds.push(newOrgId);
      createdOrgNames.push(no.name);
    }
    for (const nf of eventDraft.new_facilities) {
      const pos = assignZonePositionForCity(city, zonePoints);
      await createFacility(env, {
        name: nf.name,
        kind: nf.kind,
        city_id: cityId,
        description: null,
        map_x: pos.x,
        map_y: pos.y,
      });
      zonePoints.push(pos);
    }

    const relatedPeopleIds = [...eventDraft.related_person_ids, ...createdPeopleIds];
    const relatedPeopleNames = [
      ...people.filter((p) => eventDraft.related_person_ids.includes(p.id)).map((p) => p.name),
      ...createdPeopleNames,
    ];
    const relatedOrgIds = [...eventDraft.related_organization_ids, ...createdOrgIds];
    const relatedOrgNames = [
      ...organizations.filter((o) => eventDraft.related_organization_ids.includes(o.id)).map((o) => o.name),
      ...createdOrgNames,
    ];

    // 世界状態への影響を適用する。
    const appliedImpact = await applyStateChanges(env, eventDraft.state_changes, targetDate, relatedPeopleIds);

    // AIが株価変動を提案しなかった場合でも、記事に登場した上場企業には
    // 小さな自動変動を与え、「ニュースがあったのに経済がまったく動かない」
    // というズレが起きないようにする。
    const coveredOrgIds = new Set(
      eventDraft.state_changes.filter((c) => c.type === "economic_stock_price").map((c) => c.target_id)
    );
    const bankruptedOrgIds = new Set(
      eventDraft.state_changes
        .filter((c) => c.type === "organization_status" && c.value === "bankrupt")
        .map((c) => c.target_id)
    );
    for (const orgId of relatedOrgIds) {
      if (coveredOrgIds.has(orgId) || bankruptedOrgIds.has(orgId)) continue;
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
        JSON.stringify(relatedOrgIds),
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
      const newsAiResult = await callAiForJson(env, env.AI_NEWS_MODEL, system, user, 1600);
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

    // AI・フォールバックどちらの経路でも、本文が最低文字数に満たない場合は機械的に底上げする
    // （プロンプトで指示していても、小型モデルが短い記事を書いてしまうことがあるため）。
    newsDraft = { ...newsDraft, body: padShortArticleBody(newsDraft.body, newsDraft.category) };

    // 記事末尾の「記者: (名前)」表記用に、その都市の記者(occupation='記者')からランダムに1人選ぶ。
    // 該当者がいない場合はnullのまま(表記なしで問題ない)。
    const reporterId = await getRandomReporterId(env, cityId);

    const newsInsert = await env.DB.prepare(
      `INSERT INTO news
        (title, body, published_at, occurred_at, category, related_people, related_organizations, related_city_id, event_id, reporter_person_id, generated_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        newsDraft.title,
        newsDraft.body,
        now(),
        targetDate,
        newsDraft.category,
        JSON.stringify(relatedPeopleIds),
        JSON.stringify(relatedOrgIds),
        cityId,
        eventId,
        reporterId,
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

    // 天候もイベントAI(またはフォールバック時は現状維持)に管理を任せる。晴れ→曇り→雨のような
    // 段階を踏んだ推移をプロンプト側で指示しているため、ここでは提案された値をそのまま反映する。
    const nextWeather = eventDraft.weather ?? world.weather;
    await env.DB.prepare(
      "UPDATE world SET current_date = ?, last_published_at = ?, weather = ?, updated_at = ? WHERE id = 1"
    )
      .bind(targetDate, now(), nextWeather, now())
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
