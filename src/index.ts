import { Hono } from "hono";
import type { Env } from "./types";
import {
  clearPeopleOrganization,
  createOrganization,
  getCity,
  getEvent,
  getNews,
  getOrganization,
  getPerson,
  getPeopleByIds,
  getOrganizationsByIds,
  getWorld,
  insertPriceIndex,
  insertStockPrice,
  latestEconomicDataByOrg,
  latestPriceIndex,
  listCities,
  listNews,
  listNewsByCategory,
  listNewsForPerson,
  listOrganizations,
  listPeople,
  listPeopleByKana,
  listRecentSimulationRuns,
  listRelationshipsForPerson,
  listTimeline,
  parseIdArray,
  searchPeopleAdmin,
  updateNews,
  updateOrganizationAdmin,
  updatePerson,
  updateWorldAutoPublishTimes,
} from "./db/queries";
import { html } from "./utils/html";
import { NEWS_CATEGORIES, ORG_KINDS, ORG_STATUSES, PERSON_STATUSES } from "./constants";
import { page } from "./views/layout";
import { newsListSection, categoryTabs } from "./views/newsList";
import { newsDetailView } from "./views/newsDetail";
import { worldView } from "./views/world";
import { peopleListView } from "./views/people";
import { personDetailView } from "./views/personDetail";
import { timelineView } from "./views/timeline";
import { economyView } from "./views/economy";
import { notFoundView } from "./views/notFound";
import { adminDashboardPage } from "./views/admin";
import { mapView } from "./views/map";
import {
  assignNewOrgPosition,
  assignPersonZones,
  buildAllEdges,
  buildAllZones,
  orgZoneId,
} from "./views/mapZones";
import { runDailySimulation } from "./simulation/runDailySimulation";
import { findDueSlot, nextSlotUtcMillis, parseAutoPublishTimes } from "./simulation/schedule";
import type { EconomicDataRow, OrganizationRow, PersonRow, RelationshipRow } from "./types";

const app = new Hono<{ Bindings: Env }>();

app.get("/", async (c) => {
  const world = await getWorld(c.env);
  if (!world) return c.text("world データが未投入です。seed.sql を実行してください。", 500);
  const news = await listNews(c.env, 10);

  return c.html(
    page({
      title: "トップ",
      activePath: "/",
      worldDate: world.current_date,
      body: newsListSection("最新ニュース", news.results ?? []),
    }).value
  );
});

app.get("/news", async (c) => {
  const world = await getWorld(c.env);
  const categoryParam = c.req.query("category");
  const category = categoryParam && (NEWS_CATEGORIES as readonly string[]).includes(categoryParam) ? categoryParam : null;

  const news = category ? await listNewsByCategory(c.env, category, 50) : await listNews(c.env, 50);

  return c.html(
    page({
      title: category ? `ニュース - ${category}` : "ニュース一覧",
      activePath: "/news",
      worldDate: world?.current_date,
      body: html`${categoryTabs(category)}${newsListSection(category ?? "すべてのニュース", news.results ?? [])}`,
    }).value
  );
});

app.get("/news/event/:eventId", async (c) => {
  const eventId = Number(c.req.param("eventId"));
  if (!Number.isInteger(eventId)) return c.notFound();
  const event = await getEvent(c.env, eventId);
  if (!event || !event.news_id) return c.notFound();
  return c.redirect(`/news/${event.news_id}`, 302);
});

app.get("/news/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.notFound();
  const news = await getNews(c.env, id);
  if (!news) {
    return c.html(page({ title: "見つかりません", activePath: "/news", body: notFoundView() }).value, 404);
  }

  const world = await getWorld(c.env);
  const city = news.related_city_id ? await getCity(c.env, news.related_city_id) : null;
  const relatedPeople = await getPeopleByIds(c.env, parseIdArray(news.related_people));
  const relatedOrgs = await getOrganizationsByIds(c.env, parseIdArray(news.related_organizations));

  return c.html(
    page({
      title: news.title,
      activePath: "/news",
      worldDate: world?.current_date,
      body: newsDetailView(news, city?.name ?? null, relatedPeople, relatedOrgs),
    }).value
  );
});

app.get("/world", async (c) => {
  const world = await getWorld(c.env);
  if (!world) return c.text("world データが未投入です。seed.sql を実行してください。", 500);
  const cities = await listCities(c.env);

  return c.html(
    page({
      title: "世界について",
      activePath: "/world",
      worldDate: world.current_date,
      body: worldView(world, cities.results ?? []),
    }).value
  );
});

app.get("/people", async (c) => {
  const world = await getWorld(c.env);
  const [people, orgs] = await Promise.all([listPeopleByKana(c.env), listOrganizations(c.env)]);
  const orgById = new Map<number, OrganizationRow>((orgs.results ?? []).map((o) => [o.id, o]));

  return c.html(
    page({
      title: "人物",
      activePath: "/people",
      worldDate: world?.current_date,
      body: peopleListView(people.results ?? [], orgById),
    }).value
  );
});

app.get("/people/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.notFound();
  const person = await getPerson(c.env, id);
  if (!person) {
    return c.html(page({ title: "見つかりません", activePath: "/people", body: notFoundView() }).value, 404);
  }

  const world = await getWorld(c.env);
  const [organization, relRows, relatedNews] = await Promise.all([
    person.organization_id ? getOrganization(c.env, person.organization_id) : Promise.resolve(null),
    listRelationshipsForPerson(c.env, id),
    listNewsForPerson(c.env, id),
  ]);

  const otherIds = (relRows.results ?? []).map((r) => r.related_person_id);
  const others = await getPeopleByIds(c.env, otherIds);
  const othersById = new Map<number, PersonRow>(others.map((p) => [p.id, p]));
  const relationships = (relRows.results ?? [])
    .map((row) => ({ row, other: othersById.get(row.related_person_id) }))
    .filter((r): r is { row: RelationshipRow; other: PersonRow } => Boolean(r.other));

  return c.html(
    page({
      title: person.name,
      activePath: "/people",
      worldDate: world?.current_date,
      body: personDetailView(person, organization, relationships, relatedNews),
    }).value
  );
});

app.get("/timeline", async (c) => {
  const world = await getWorld(c.env);
  const items = await listTimeline(c.env, 150);
  return c.html(
    page({
      title: "年表",
      activePath: "/timeline",
      worldDate: world?.current_date,
      body: timelineView(items.results ?? []),
    }).value
  );
});

app.get("/economy", async (c) => {
  const world = await getWorld(c.env);
  const [orgs, latest, priceIndex] = await Promise.all([
    listOrganizations(c.env),
    latestEconomicDataByOrg(c.env),
    latestPriceIndex(c.env),
  ]);
  const latestByOrg = new Map<number, EconomicDataRow>();
  for (const row of latest.results ?? []) {
    if (row.metric === "stock_price" && row.organization_id) {
      latestByOrg.set(row.organization_id, row);
    }
  }

  return c.html(
    page({
      title: "経済",
      activePath: "/economy",
      worldDate: world?.current_date,
      body: economyView(orgs.results ?? [], latestByOrg, priceIndex),
    }).value
  );
});

app.get("/map", async (c) => {
  const [world, orgs] = await Promise.all([getWorld(c.env), listOrganizations(c.env)]);
  const zones = buildAllZones(orgs.results ?? []);
  const edges = buildAllEdges(zones, orgs.results ?? []);
  return c.html(
    page({
      title: "街の様子",
      activePath: "/map",
      worldDate: world?.current_date,
      body: mapView(zones, edges),
    }).value
  );
});

app.get("/api/map/people", async (c) => {
  const [people, orgs, latestNews] = await Promise.all([
    listPeople(c.env, 300),
    listOrganizations(c.env),
    listNews(c.env, 1),
  ]);
  const orgList = orgs.results ?? [];

  const zoneStatus: Record<string, string> = {};
  for (const org of orgList) {
    if (org.status !== "active") {
      zoneStatus[orgZoneId(org.id)] = org.status;
    }
  }

  const latest = (latestNews.results ?? [])[0] ?? null;
  const spotlight = latest
    ? {
        newsId: latest.id,
        headline: latest.title,
        zoneIds: parseIdArray(latest.related_organizations).map((id) => orgZoneId(id)),
      }
    : null;

  return c.json({
    people: assignPersonZones(people.results ?? []),
    zoneStatus,
    spotlight,
  });
});

app.get("/api/health", async (c) => {
  const world = await getWorld(c.env);
  return c.json({ status: "ok", worldDate: world?.current_date ?? null });
});

// ヘッダーの「モーゼンの時計」が秒単位で刻む時計を描画するための情報。
// 直近の配信時刻から次の配信予定時刻までの進み具合を元に、
// 世界の1日(24時間)の中の「今」を割り出す。
app.get("/api/clock", async (c) => {
  const world = await getWorld(c.env);
  if (!world) return c.json({ error: "world not found" }, 500);
  const nextMs = nextSlotUtcMillis(new Date(), world.auto_publish_times);
  return c.json({
    worldDate: world.current_date,
    lastPublishedAt: world.last_published_at,
    nextPublishAt: nextMs ? new Date(nextMs).toISOString() : null,
  });
});

// 管理画面（/admin）。トークン入力・表示自体は誰でも開けるが、
// 中のデータ取得・操作はすべて下記のADMIN_TOKEN認証を通る。
app.get("/admin", (c) => c.html(adminDashboardPage()));

function checkAdminAuth(c: { env: Env; req: { header: (name: string) => string | undefined } }): Response | null {
  if (!c.env.ADMIN_TOKEN) {
    return Response.json({ error: "ADMIN_TOKEN is not configured" }, { status: 404 });
  }
  if (c.req.header("x-admin-token") !== c.env.ADMIN_TOKEN) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}

// 手動でのシミュレーション実行（強制的なニュース発行）。
// ADMIN_TOKEN が設定されている場合のみ有効。
app.post("/api/admin/simulate", async (c) => {
  const authError = checkAdminAuth(c);
  if (authError) return authError;
  try {
    const result = await runDailySimulation(c.env);
    return c.json(result);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

// 管理画面が定期ポーリングする状態確認API。
app.get("/api/admin/status", async (c) => {
  const authError = checkAdminAuth(c);
  if (authError) return authError;

  const [world, runs, news] = await Promise.all([
    getWorld(c.env),
    listRecentSimulationRuns(c.env, 14),
    listNews(c.env, 5),
  ]);

  return c.json({
    world: world ? { name: world.name, current_date: world.current_date, updated_at: world.updated_at } : null,
    recentRuns: runs.results ?? [],
    recentNews: news.results ?? [],
    schedule: world ? parseAutoPublishTimes(world.auto_publish_times).map((t) => `${t} JST`) : [],
  });
});

// ---- 管理画面: 自動配信時刻の設定 ----

app.get("/api/admin/settings", async (c) => {
  const authError = checkAdminAuth(c);
  if (authError) return authError;
  const world = await getWorld(c.env);
  if (!world) return c.json({ error: "world not found" }, 500);
  return c.json({ autoPublishTimes: parseAutoPublishTimes(world.auto_publish_times) });
});

app.put("/api/admin/settings", async (c) => {
  const authError = checkAdminAuth(c);
  if (authError) return authError;
  const body = await c.req.json().catch(() => null);
  const times = body && Array.isArray(body.autoPublishTimes) ? body.autoPublishTimes : null;
  if (!times || times.length === 0 || times.length > 24) {
    return c.json({ error: "autoPublishTimes must be an array of 1-24 HH:MM strings" }, 400);
  }
  const timeRe = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (!times.every((t: unknown) => typeof t === "string" && timeRe.test(t))) {
    return c.json({ error: "each time must match HH:MM (24h)" }, 400);
  }
  await updateWorldAutoPublishTimes(c.env, JSON.stringify(times));
  return c.json({ ok: true, autoPublishTimes: times });
});

// ---- 管理画面: ニュース編集 ----

app.get("/api/admin/news-list", async (c) => {
  const authError = checkAdminAuth(c);
  if (authError) return authError;
  const news = await listNews(c.env, 100);
  return c.json({ news: (news.results ?? []).map((n) => ({ id: n.id, title: n.title, category: n.category, published_at: n.published_at })) });
});

app.get("/api/admin/news/:id", async (c) => {
  const authError = checkAdminAuth(c);
  if (authError) return authError;
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "invalid id" }, 400);
  const news = await getNews(c.env, id);
  if (!news) return c.json({ error: "not found" }, 404);
  return c.json({ id: news.id, title: news.title, body: news.body, category: news.category });
});

app.put("/api/admin/news/:id", async (c) => {
  const authError = checkAdminAuth(c);
  if (authError) return authError;
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "invalid id" }, 400);
  const body = await c.req.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 120) : "";
  const text = typeof body?.body === "string" ? body.body.trim().slice(0, 6000) : "";
  const category = typeof body?.category === "string" ? body.category : "";
  if (!title || !text) return c.json({ error: "title and body are required" }, 400);
  if (!(NEWS_CATEGORIES as readonly string[]).includes(category)) {
    return c.json({ error: "invalid category" }, 400);
  }
  await updateNews(c.env, id, { title, body: text, category });
  return c.json({ ok: true });
});

// ---- 管理画面: 人物編集 ----

app.get("/api/admin/people-list", async (c) => {
  const authError = checkAdminAuth(c);
  if (authError) return authError;
  const q = c.req.query("q") ?? "";
  const people = q ? await searchPeopleAdmin(c.env, q, 50) : await listPeopleByKana(c.env, 50);
  return c.json({
    people: (people.results ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      name_kana: p.name_kana,
      occupation: p.occupation,
      status: p.status,
    })),
  });
});

app.get("/api/admin/people/:id", async (c) => {
  const authError = checkAdminAuth(c);
  if (authError) return authError;
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "invalid id" }, 400);
  const person = await getPerson(c.env, id);
  if (!person) return c.json({ error: "not found" }, 404);
  return c.json(person);
});

app.put("/api/admin/people/:id", async (c) => {
  const authError = checkAdminAuth(c);
  if (authError) return authError;
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "invalid id" }, 400);
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: "invalid body" }, 400);

  const name = typeof body.name === "string" ? body.name.trim().slice(0, 40) : "";
  if (!name) return c.json({ error: "name is required" }, 400);
  const nameKanaRaw = typeof body.name_kana === "string" ? body.name_kana.trim().slice(0, 60) : "";
  const nameKana = nameKanaRaw && /^[ぁ-ゖゝ-ゟー・\s]+$/.test(nameKanaRaw) ? nameKanaRaw : null;
  const age =
    typeof body.age === "number" && Number.isFinite(body.age) && body.age >= 0 && body.age <= 300
      ? Math.round(body.age)
      : null;
  const gender = typeof body.gender === "string" && body.gender.trim() ? body.gender.trim().slice(0, 20) : null;
  const occupation =
    typeof body.occupation === "string" && body.occupation.trim() ? body.occupation.trim().slice(0, 40) : null;
  const organizationId =
    typeof body.organization_id === "number" && Number.isInteger(body.organization_id) ? body.organization_id : null;
  const money = typeof body.money === "number" && Number.isFinite(body.money) ? Math.max(0, Math.round(body.money)) : 0;
  const status = typeof body.status === "string" && (PERSON_STATUSES as readonly string[]).includes(body.status)
    ? body.status
    : "alive";
  const bio = typeof body.bio === "string" && body.bio.trim() ? body.bio.trim().slice(0, 400) : null;

  if (organizationId !== null) {
    const org = await getOrganization(c.env, organizationId);
    if (!org) return c.json({ error: "organization_id does not exist" }, 400);
  }

  await updatePerson(c.env, id, {
    name,
    name_kana: nameKana,
    age,
    gender,
    occupation,
    organization_id: organizationId,
    money,
    status,
    bio,
  });
  return c.json({ ok: true });
});

// ---- 管理画面: 経済コントロール ----

app.get("/api/admin/economy-list", async (c) => {
  const authError = checkAdminAuth(c);
  if (authError) return authError;
  const [orgs, latest, priceIndex] = await Promise.all([
    listOrganizations(c.env),
    latestEconomicDataByOrg(c.env),
    latestPriceIndex(c.env),
  ]);
  const latestByOrg = new Map<number, number>();
  for (const row of latest.results ?? []) {
    if (row.metric === "stock_price" && row.organization_id) latestByOrg.set(row.organization_id, row.value);
  }
  return c.json({
    organizations: (orgs.results ?? []).map((o) => ({
      id: o.id,
      name: o.name,
      kind: o.kind,
      status: o.status,
      description: o.description,
      industry: o.industry,
      employeeScale: o.employee_scale,
      foundedYear: o.founded_year,
      stockPrice: latestByOrg.get(o.id) ?? null,
    })),
    priceIndex: priceIndex?.value ?? null,
  });
});

app.post("/api/admin/organizations", async (c) => {
  const authError = checkAdminAuth(c);
  if (authError) return authError;
  const body = await c.req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 40) : "";
  if (!name) return c.json({ error: "name is required" }, 400);
  const kind = typeof body?.kind === "string" && (ORG_KINDS as readonly string[]).includes(body.kind)
    ? body.kind
    : "company";
  const description =
    typeof body?.description === "string" && body.description.trim() ? body.description.trim().slice(0, 200) : null;
  const industry = typeof body?.industry === "string" && body.industry.trim() ? body.industry.trim().slice(0, 30) : null;
  const employeeScale =
    typeof body?.employeeScale === "string" && body.employeeScale.trim() ? body.employeeScale.trim().slice(0, 20) : null;
  const foundedYear =
    typeof body?.foundedYear === "number" && Number.isInteger(body.foundedYear) ? body.foundedYear : null;

  const world = await getWorld(c.env);
  const orgs = await listOrganizations(c.env);
  const orgList = orgs.results ?? [];
  const zones = buildAllZones(orgList);
  const pos = assignNewOrgPosition(zones.map((z) => ({ x: z.x, y: z.y })));

  const id = await createOrganization(c.env, {
    name,
    kind,
    city_id: 1,
    description,
    industry,
    employee_scale: employeeScale,
    founded_year: foundedYear,
    map_x: pos.x,
    map_y: pos.y,
  });

  return c.json({ ok: true, id, worldDate: world?.current_date ?? null, position: pos });
});

app.put("/api/admin/organizations/:id", async (c) => {
  const authError = checkAdminAuth(c);
  if (authError) return authError;
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "invalid id" }, 400);
  const existing = await getOrganization(c.env, id);
  if (!existing) return c.json({ error: "not found" }, 404);

  const body = await c.req.json().catch(() => null);
  const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim().slice(0, 40) : existing.name;
  const kind = typeof body?.kind === "string" && (ORG_KINDS as readonly string[]).includes(body.kind)
    ? body.kind
    : existing.kind;
  const status = typeof body?.status === "string" && (ORG_STATUSES as readonly string[]).includes(body.status)
    ? body.status
    : null;
  if (!status) return c.json({ error: "invalid status" }, 400);
  const description =
    typeof body?.description === "string" && body.description.trim() ? body.description.trim().slice(0, 200) : null;
  const industry = typeof body?.industry === "string" && body.industry.trim() ? body.industry.trim().slice(0, 30) : null;
  const employeeScale =
    typeof body?.employeeScale === "string" && body.employeeScale.trim() ? body.employeeScale.trim().slice(0, 20) : null;
  const foundedYear =
    typeof body?.foundedYear === "number" && Number.isInteger(body.foundedYear) ? body.foundedYear : null;

  await updateOrganizationAdmin(c.env, id, {
    name,
    kind,
    status,
    description,
    industry,
    employee_scale: employeeScale,
    founded_year: foundedYear,
  });

  // 倒産(bankrupt)になった場合、そこに勤めていた人物を無所属に戻す。
  let clearedEmployees = 0;
  if (status === "bankrupt" && existing.status !== "bankrupt") {
    const result = await clearPeopleOrganization(c.env, id);
    clearedEmployees = result.meta.changes ?? 0;
  }

  return c.json({ ok: true, clearedEmployees });
});

app.post("/api/admin/economy/stock", async (c) => {
  const authError = checkAdminAuth(c);
  if (authError) return authError;
  const body = await c.req.json().catch(() => null);
  const organizationId = typeof body?.organization_id === "number" ? body.organization_id : null;
  const value = typeof body?.value === "number" && Number.isFinite(body.value) ? body.value : null;
  if (!organizationId || value === null || value <= 0 || value > 10_000_000) {
    return c.json({ error: "organization_id and a positive value (<=10,000,000) are required" }, 400);
  }
  const org = await getOrganization(c.env, organizationId);
  if (!org || org.kind !== "company") return c.json({ error: "organization must be an existing company" }, 400);
  const world = await getWorld(c.env);
  if (!world) return c.json({ error: "world not found" }, 500);
  await insertStockPrice(c.env, organizationId, world.current_date, value);
  return c.json({ ok: true });
});

app.put("/api/admin/economy/price-index", async (c) => {
  const authError = checkAdminAuth(c);
  if (authError) return authError;
  const body = await c.req.json().catch(() => null);
  const value = typeof body?.value === "number" && Number.isFinite(body.value) ? body.value : null;
  if (value === null || value <= 0 || value > 100_000) {
    return c.json({ error: "a positive value (<=100,000) is required" }, 400);
  }
  const world = await getWorld(c.env);
  if (!world) return c.json({ error: "world not found" }, 500);
  await insertPriceIndex(c.env, world.current_date, value);
  return c.json({ ok: true });
});

app.notFound((c) => c.html(page({ title: "見つかりません", activePath: "/", body: notFoundView() }).value, 404));

export default {
  fetch: app.fetch,
  // 10分おきに呼ばれる。world.auto_publish_times(JST)で設定された時刻を
  // まだ過ぎていなければ何もしない。管理画面から設定を変更すれば、
  // 再デプロイなしに配信時刻を変えられる。
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      (async () => {
        const world = await getWorld(env);
        if (!world) return;
        const slot = findDueSlot(new Date(), world.auto_publish_times, world.last_auto_publish_slot);
        if (!slot) return;
        try {
          await runDailySimulation(env);
          await env.DB.prepare("UPDATE world SET last_auto_publish_slot = ? WHERE id = 1").bind(slot).run();
        } catch (err) {
          console.error("daily simulation failed", err);
        }
      })()
    );
  },
};
