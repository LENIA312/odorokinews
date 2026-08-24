import { Hono } from "hono";
import type { Env } from "./types";
import {
  clearPeopleOrganization,
  createCity,
  createFacility,
  createOccupationType,
  createOrganization,
  createPerson,
  createRelationshipPair,
  countCityContents,
  deleteCity,
  deleteFacility,
  deleteNewsCascade,
  deleteOccupationType,
  deleteRelationshipPair,
  getCity,
  getEvent,
  getFacility,
  getNews,
  getOrganization,
  getPerson,
  getPeopleByIds,
  getOrganizationsByIds,
  getRandomReporterId,
  getWorld,
  insertPriceIndex,
  insertStockPrice,
  latestEconomicDataByOrg,
  latestPriceIndex,
  listCities,
  listFacilities,
  listFacilitiesByCity,
  listNews,
  listNewsByCategory,
  listNewsForPerson,
  listOccupationTypes,
  listOrganizations,
  listOrganizationsByCity,
  listPeople,
  listPeopleAdmin,
  listPeopleByCity,
  listPeopleByKana,
  listRecentEvents,
  listRecentSimulationRuns,
  listAiCallLogs,
  getAiCallLog,
  logAiCall,
  listRelationshipsForPerson,
  listTimeline,
  parseIdArray,
  updateCityAdmin,
  updateFacility,
  updateNews,
  updateOccupationType,
  updateOrganizationAdmin,
  updatePerson,
  updateWorldAutoPublishTimes,
  updateWorldWeather,
} from "./db/queries";
import { html } from "./utils/html";
import { computeBirthDateFromAge } from "./utils/date";
import {
  CITY_STATUSES,
  FACILITY_KINDS,
  NEWS_CATEGORIES,
  ORG_KINDS,
  ORG_STATUSES,
  PERSON_STATUSES,
  RELATION_TYPE_REVERSE,
  RELATION_TYPES,
  WEATHER_CONDITIONS,
} from "./constants";
import { page } from "./views/layout";
import { leadFromBody } from "./views/components";
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
  assignNewCityPosition,
  assignZonePositionForCity,
  assignPersonZones,
  buildAllEdges,
  buildAllZones,
  orgZoneId,
} from "./views/mapZones";
import { runDailySimulation } from "./simulation/runDailySimulation";
import { postDailyNewsDigest } from "./social/dailyDigest";
import { findDueSlot, parseAutoPublishTimes } from "./simulation/schedule";
import { callAiForJson } from "./simulation/ai";
import { buildEventPrompt, buildNewsPrompt } from "./simulation/prompts";
import { summarizeEventDraftForLog, validateEventDraft, validateNewsDraft, validateStateChanges } from "./simulation/validate";
import { applyStateChanges } from "./simulation/stateChanges";
import { padShortArticleBody } from "./simulation/fallback";
import { tickWorldDate } from "./simulation/worldClock";
import { seedStarterFacilities } from "./simulation/citySeed";
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
  const reporter = news.reporter_person_id ? await getPerson(c.env, news.reporter_person_id) : null;

  return c.html(
    page({
      title: news.title,
      activePath: "/news",
      path: `/news/${id}`,
      description: leadFromBody(news.body),
      worldDate: world?.current_date,
      body: newsDetailView(news, city?.name ?? null, relatedPeople, relatedOrgs, reporter),
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
  const [organization, city, relRows, relatedNews] = await Promise.all([
    person.organization_id ? getOrganization(c.env, person.organization_id) : Promise.resolve(null),
    person.city_id ? getCity(c.env, person.city_id) : Promise.resolve(null),
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
      path: `/people/${id}`,
      description: person.bio ? leadFromBody(person.bio) : `${person.occupation ?? "モーゼン・アングラの住民"}・${person.name}のプロフィール`,
      worldDate: world?.current_date,
      body: personDetailView(person, organization, city, relationships, relatedNews),
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
  const [world, orgs, facilities, cities] = await Promise.all([
    getWorld(c.env),
    listOrganizations(c.env),
    listFacilities(c.env),
    listCities(c.env),
  ]);
  const draftCityIds = new Set((cities.results ?? []).filter((ci) => ci.status !== "active").map((ci) => ci.id));
  const zones = buildAllZones(orgs.results ?? [], facilities.results ?? [], draftCityIds);
  const edges = buildAllEdges(zones);
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
  const [people, orgs, facilities, cities, latestNews] = await Promise.all([
    listPeople(c.env, 300),
    listOrganizations(c.env),
    listFacilities(c.env),
    listCities(c.env),
    listNews(c.env, 1),
  ]);
  const cityList = cities.results ?? [];
  const draftCityIds = new Set(cityList.filter((ci) => ci.status !== "active").map((ci) => ci.id));
  // draft状態の都市は地図に一切表示しない。組織・施設だけでなく、そこに住む人物も
  // マップ上には出さない（都市自体が地図に無い以上、その住民だけ中心付近に浮くのは不自然なため）。
  const orgList = (orgs.results ?? []).filter((o) => o.city_id == null || !draftCityIds.has(o.city_id));
  const facilityList = (facilities.results ?? []).filter((f) => !draftCityIds.has(f.city_id));
  const peopleList = (people.results ?? []).filter((p) => p.city_id == null || !draftCityIds.has(p.city_id));

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
    people: assignPersonZones(peopleList, facilityList),
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
// ヘッダーの時計用。日付・天候はここから取得し、時刻(時:分:秒)は
// クライアント側でDate.now()を1時間=世界の1日のレートに変換して独立に刻む
// （地図の人物アニメーションと同じレート、layout.tsのCLOCK_SCRIPT/map.tsのDAY_SECONDS参照）。
app.get("/api/clock", async (c) => {
  const world = await getWorld(c.env);
  if (!world) return c.json({ error: "world not found" }, 500);
  return c.json({ worldDate: world.current_date, weather: world.weather });
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

// X(旧Twitter)への日次まとめ投稿を、Cronを待たずに手動で試すためのボタン用。
app.post("/api/admin/social/tweet-digest", async (c) => {
  const authError = checkAdminAuth(c);
  if (authError) return authError;
  try {
    const result = await postDailyNewsDigest(c.env);
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

// ---- 管理画面: AI履歴 ----

app.get("/api/admin/ai-logs", async (c) => {
  const authError = checkAdminAuth(c);
  if (authError) return authError;
  const logs = await listAiCallLogs(c.env, 100);
  return c.json({
    logs: (logs.results ?? []).map((l) => ({
      id: l.id,
      createdAt: l.created_at,
      callType: l.call_type,
      model: l.model,
      success: !!l.success,
    })),
  });
});

app.get("/api/admin/ai-logs/:id", async (c) => {
  const authError = checkAdminAuth(c);
  if (authError) return authError;
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "invalid id" }, 400);
  const log = await getAiCallLog(c.env, id);
  if (!log) return c.json({ error: "not found" }, 404);
  return c.json({
    id: log.id,
    createdAt: log.created_at,
    callType: log.call_type,
    model: log.model,
    systemPrompt: log.system_prompt,
    userPrompt: log.user_prompt,
    rawResponse: log.raw_response,
    success: !!log.success,
    error: log.error,
    changesSummary: log.changes_summary ? JSON.parse(log.changes_summary) : null,
  });
});

// ---- 管理画面: 自動配信時刻の設定 ----

app.get("/api/admin/settings", async (c) => {
  const authError = checkAdminAuth(c);
  if (authError) return authError;
  const world = await getWorld(c.env);
  if (!world) return c.json({ error: "world not found" }, 500);
  return c.json({ autoPublishTimes: parseAutoPublishTimes(world.auto_publish_times), weather: world.weather });
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

// ---- 管理画面: 天気・気候 ----

app.put("/api/admin/weather", async (c) => {
  const authError = checkAdminAuth(c);
  if (authError) return authError;
  const body = await c.req.json().catch(() => null);
  const weather =
    typeof body?.weather === "string" && (WEATHER_CONDITIONS as readonly string[]).includes(body.weather)
      ? body.weather
      : null;
  if (!weather) return c.json({ error: "invalid weather" }, 400);
  await updateWorldWeather(c.env, weather);
  return c.json({ ok: true, weather });
});

// ---- 管理画面: 都市管理 ----

app.get("/api/admin/cities", async (c) => {
  const authError = checkAdminAuth(c);
  if (authError) return authError;
  const cities = await listCities(c.env);
  return c.json({
    cities: (cities.results ?? []).map((ci) => ({
      id: ci.id,
      name: ci.name,
      status: ci.status,
      population: ci.population,
      description: ci.description,
      industries: ci.industries ? JSON.parse(ci.industries) : [],
    })),
  });
});

app.post("/api/admin/cities", async (c) => {
  const authError = checkAdminAuth(c);
  if (authError) return authError;
  const body = await c.req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 40) : "";
  if (!name) return c.json({ error: "name is required" }, 400);
  const population =
    typeof body?.population === "number" && Number.isFinite(body.population) && body.population >= 0
      ? Math.round(body.population)
      : null;
  const description =
    typeof body?.description === "string" && body.description.trim() ? body.description.trim().slice(0, 300) : null;
  const industries = Array.isArray(body?.industries)
    ? JSON.stringify(body.industries.filter((s: unknown) => typeof s === "string").slice(0, 10))
    : null;
  const status =
    typeof body?.status === "string" && (CITY_STATUSES as readonly string[]).includes(body.status)
      ? body.status
      : "draft";

  const [orgs, existingFacilities] = await Promise.all([listOrganizations(c.env), listFacilities(c.env)]);
  const existingZones = buildAllZones(orgs.results ?? [], existingFacilities.results ?? []);
  const pos = assignNewCityPosition(existingZones.map((z) => ({ x: z.x, y: z.y })));

  const id = await createCity(c.env, {
    name,
    population,
    description,
    industries,
    status,
    map_x: pos.x,
    map_y: pos.y,
  });

  // 新しい都市は単一のランドマークで終わらせず、最初から住宅街・商店街の施設を
  // 用意しておく（「新都市の各施設単位で表示されるべき」という方針のため）。
  await seedStarterFacilities(c.env, id, name, pos);

  return c.json({ ok: true, id, position: pos });
});

app.put("/api/admin/cities/:id", async (c) => {
  const authError = checkAdminAuth(c);
  if (authError) return authError;
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "invalid id" }, 400);
  const existing = await getCity(c.env, id);
  if (!existing) return c.json({ error: "not found" }, 404);

  const body = await c.req.json().catch(() => null);
  const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim().slice(0, 40) : existing.name;
  const population =
    typeof body?.population === "number" && Number.isFinite(body.population) && body.population >= 0
      ? Math.round(body.population)
      : existing.population;
  const description =
    typeof body?.description === "string" && body.description.trim()
      ? body.description.trim().slice(0, 300)
      : existing.description;
  const industries = Array.isArray(body?.industries)
    ? JSON.stringify(body.industries.filter((s: unknown) => typeof s === "string").slice(0, 10))
    : existing.industries;
  const status =
    typeof body?.status === "string" && (CITY_STATUSES as readonly string[]).includes(body.status)
      ? body.status
      : existing.status;

  if (id === 1 && status !== "active") {
    return c.json({ error: "首都(ダイナン市)は常にActiveである必要があります" }, 400);
  }

  await updateCityAdmin(c.env, id, { name, population, description, industries, status });
  return c.json({ ok: true });
});

app.delete("/api/admin/cities/:id", async (c) => {
  const authError = checkAdminAuth(c);
  if (authError) return authError;
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "invalid id" }, 400);
  if (id === 1) return c.json({ error: "首都(ダイナン市)は削除できません" }, 400);
  const existing = await getCity(c.env, id);
  if (!existing) return c.json({ error: "not found" }, 404);

  // 組織・施設・人物のcity_idはこの都市を参照しているだけ(FKのON DELETE CASCADEは無い)ため、
  // 1件でも紐づいていると削除により参照切れが起きる。安全のため空の都市のみ削除を許可する。
  const contents = await countCityContents(c.env, id);
  if (contents.organizations > 0 || contents.facilities > 0 || contents.people > 0) {
    return c.json(
      {
        error: `この都市には組織${contents.organizations}件・施設${contents.facilities}件・人物${contents.people}件が存在するため削除できません。先にそれらを削除/移動してください。`,
      },
      400
    );
  }

  await deleteCity(c.env, id);
  return c.json({ ok: true });
});

// ---- 管理画面: 施設管理 ----

app.get("/api/admin/facilities", async (c) => {
  const authError = checkAdminAuth(c);
  if (authError) return authError;
  const cityIdParam = c.req.query("cityId");
  const cityId = cityIdParam ? Number(cityIdParam) : null;
  const facilities =
    cityId && Number.isInteger(cityId) ? await listFacilitiesByCity(c.env, cityId) : await listFacilities(c.env);
  return c.json({
    facilities: (facilities.results ?? []).map((f) => ({
      id: f.id,
      name: f.name,
      kind: f.kind,
      city_id: f.city_id,
      description: f.description,
    })),
  });
});

app.post("/api/admin/facilities", async (c) => {
  const authError = checkAdminAuth(c);
  if (authError) return authError;
  const body = await c.req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 40) : "";
  if (!name) return c.json({ error: "name is required" }, 400);
  const kind =
    typeof body?.kind === "string" && (FACILITY_KINDS as readonly string[]).includes(body.kind) ? body.kind : "other";
  const description =
    typeof body?.description === "string" && body.description.trim() ? body.description.trim().slice(0, 200) : null;
  const cityIdRaw = typeof body?.city_id === "number" && Number.isInteger(body.city_id) ? body.city_id : 1;
  const city = await getCity(c.env, cityIdRaw);
  if (!city) return c.json({ error: "invalid city_id" }, 400);

  const [orgs, facilities] = await Promise.all([listOrganizations(c.env), listFacilities(c.env)]);
  const orgList = orgs.results ?? [];
  const facilityList = facilities.results ?? [];
  const sameCityZonePoints = [
    ...orgList.filter((o) => o.city_id === city.id && o.map_x != null && o.map_y != null)
      .map((o) => ({ x: o.map_x as number, y: o.map_y as number })),
    ...facilityList.filter((f) => f.city_id === city.id).map((f) => ({ x: f.map_x, y: f.map_y })),
  ];
  const pos = assignZonePositionForCity(city, sameCityZonePoints);

  const id = await createFacility(c.env, {
    name,
    kind,
    city_id: city.id,
    description,
    map_x: pos.x,
    map_y: pos.y,
  });

  return c.json({ ok: true, id, position: pos });
});

app.put("/api/admin/facilities/:id", async (c) => {
  const authError = checkAdminAuth(c);
  if (authError) return authError;
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "invalid id" }, 400);
  const existing = await getFacility(c.env, id);
  if (!existing) return c.json({ error: "not found" }, 404);

  const body = await c.req.json().catch(() => null);
  const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim().slice(0, 40) : existing.name;
  const kind =
    typeof body?.kind === "string" && (FACILITY_KINDS as readonly string[]).includes(body.kind)
      ? body.kind
      : existing.kind;
  const description =
    typeof body?.description === "string" && body.description.trim()
      ? body.description.trim().slice(0, 200)
      : existing.description;

  const requestedCityId =
    typeof body?.city_id === "number" && Number.isInteger(body.city_id) ? body.city_id : existing.city_id;
  const city = await getCity(c.env, requestedCityId);
  if (!city) return c.json({ error: "invalid city_id" }, 400);

  let mapX = existing.map_x;
  let mapY = existing.map_y;
  if (city.id !== existing.city_id) {
    // 所在都市を変更した場合、その都市のクラスタ付近へ座標を再割り当てする（7.2節のロジック）。
    const [orgs, facilities] = await Promise.all([listOrganizations(c.env), listFacilities(c.env)]);
    const orgList = orgs.results ?? [];
    const facilityList = (facilities.results ?? []).filter((f) => f.id !== id);
    const sameCityZonePoints = [
      ...orgList.filter((o) => o.city_id === city.id && o.map_x != null && o.map_y != null)
        .map((o) => ({ x: o.map_x as number, y: o.map_y as number })),
      ...facilityList.filter((f) => f.city_id === city.id).map((f) => ({ x: f.map_x, y: f.map_y })),
    ];
    const pos = assignZonePositionForCity(city, sameCityZonePoints);
    mapX = pos.x;
    mapY = pos.y;
  }

  await updateFacility(c.env, id, { name, kind, description, city_id: city.id, map_x: mapX, map_y: mapY });
  return c.json({ ok: true });
});

app.delete("/api/admin/facilities/:id", async (c) => {
  const authError = checkAdminAuth(c);
  if (authError) return authError;
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "invalid id" }, 400);
  const existing = await getFacility(c.env, id);
  if (!existing) return c.json({ error: "not found" }, 404);
  await deleteFacility(c.env, id);
  return c.json({ ok: true });
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
  const reporter = news.reporter_person_id ? await getPerson(c.env, news.reporter_person_id) : null;
  return c.json({
    id: news.id,
    title: news.title,
    body: news.body,
    category: news.category,
    reporter_person_id: news.reporter_person_id,
    reporter_name: reporter?.name ?? null,
  });
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
  const reporterId =
    typeof body?.reporterId === "number" && Number.isInteger(body.reporterId) ? body.reporterId : null;
  if (reporterId !== null) {
    const reporter = await getPerson(c.env, reporterId);
    if (!reporter) return c.json({ error: "reporter not found" }, 400);
  }
  await updateNews(c.env, id, { title, body: text, category, reporter_person_id: reporterId });
  return c.json({ ok: true });
});

app.delete("/api/admin/news/:id", async (c) => {
  const authError = checkAdminAuth(c);
  if (authError) return authError;
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "invalid id" }, 400);
  const news = await getNews(c.env, id);
  if (!news) return c.json({ error: "not found" }, 404);
  await deleteNewsCascade(c.env, news.id, news.event_id);
  return c.json({ ok: true });
});

function parseIdList(v: unknown, max: number): number[] {
  if (!Array.isArray(v)) return [];
  const out: number[] = [];
  for (const x of v) {
    if (typeof x === "number" && Number.isInteger(x) && !out.includes(x)) out.push(x);
    if (out.length >= max) break;
  }
  return out;
}

function mergeById<T extends { id: number }>(base: T[], extra: T[]): T[] {
  const map = new Map(base.map((x) => [x.id, x]));
  for (const e of extra) map.set(e.id, e);
  return Array.from(map.values());
}

// AI補助でニュースを作成する。関連人物・組織・ジャンル・キーワードは
// すべて任意（空でも通常のシミュレーションと同じくAIが自律的に決める）。
// 世界暦は進めず、現在の世界日付の出来事として追加する。
app.post("/api/admin/news/generate", async (c) => {
  const authError = checkAdminAuth(c);
  if (authError) return authError;
  if (!c.env.AI) {
    return c.json({ error: "Workers AIが利用できません。手動作成をご利用ください。" }, 503);
  }

  const body = await c.req.json().catch(() => null);
  const hintPersonIds = parseIdList(body?.relatedPersonIds, 6);
  const hintOrgIds = parseIdList(body?.relatedOrgIds, 4);
  const genre =
    typeof body?.genre === "string" && (NEWS_CATEGORIES as readonly string[]).includes(body.genre)
      ? body.genre
      : null;
  const keywords =
    typeof body?.keywords === "string" && body.keywords.trim() ? body.keywords.trim().slice(0, 200) : null;
  const reporterIdRaw =
    typeof body?.reporterId === "number" && Number.isInteger(body.reporterId) ? body.reporterId : null;

  const world = await getWorld(c.env);
  if (!world) return c.json({ error: "world not found" }, 500);

  const hintOrgs = await getOrganizationsByIds(c.env, hintOrgIds);
  const hintPeople = await getPeopleByIds(c.env, hintPersonIds);
  const inferredCityId = hintOrgs[0]?.city_id ?? hintPeople[0]?.city_id ?? 1;
  const city = await getCity(c.env, inferredCityId ?? 1);
  if (!city) return c.json({ error: "city not found" }, 500);

  let reporterId: number | null = reporterIdRaw;
  if (reporterId !== null) {
    const reporter = await getPerson(c.env, reporterId);
    if (!reporter) return c.json({ error: "reporter not found" }, 400);
  } else {
    reporterId = await getRandomReporterId(c.env, city.id);
  }

  const [orgsResult, facilitiesResult, peopleResult, recentEventsResult] = await Promise.all([
    listOrganizationsByCity(c.env, city.id),
    listFacilitiesByCity(c.env, city.id),
    listPeopleByCity(c.env, city.id, 40),
    listRecentEvents(c.env, 5),
  ]);
  // 指定された人物・組織がその都市の通常一覧に含まれない場合(別都市所属など)も
  // 確実にAIへ渡し、参照・選択を許可する。
  const organizations = mergeById(orgsResult.results ?? [], hintOrgs);
  const facilities = facilitiesResult.results ?? [];
  const people = mergeById(peopleResult.results ?? [], hintPeople);
  const recentEvents = recentEventsResult.results ?? [];

  const allowedPersonIds = new Set(people.map((p) => p.id));
  const allowedOrgIds = new Set(organizations.map((o) => o.id));

  const { system, user } = buildEventPrompt({
    worldName: world.name,
    cityId: city.id,
    cityName: city.name,
    cityDescription: city.description ?? "",
    population: city.population,
    targetDate: world.current_date,
    weather: world.weather,
    organizations,
    people,
    recentEvents,
    hints: { mustIncludePersonIds: hintPersonIds, mustIncludeOrgIds: hintOrgIds, genre, keywords },
  });

  const aiResult = await callAiForJson(c.env, c.env.AI_EVENT_MODEL, system, user);
  const validated = aiResult.ok ? validateEventDraft(aiResult.json, allowedPersonIds, allowedOrgIds, city.id) : null;
  await logAiCall(c.env, {
    callType: "admin_event",
    model: c.env.AI_EVENT_MODEL,
    systemPrompt: system,
    userPrompt: user,
    rawResponse: aiResult.raw ?? null,
    success: validated != null,
    error: !aiResult.ok ? aiResult.error ?? "AI呼び出し失敗" : !validated ? "バリデーション失敗" : null,
    changesSummary: validated ? summarizeEventDraftForLog(validated) : null,
  });
  if (!aiResult.ok) return c.json({ error: "イベントAIの呼び出しに失敗しました: " + aiResult.error }, 502);
  if (!validated) return c.json({ error: "イベントAIの出力を検証できませんでした" }, 502);

  const nowIso = () => new Date().toISOString();

  // AIが提案した新規人物をDBへ作成する。生年月日・生まれはAIには書かせず、
  // 年齢・所在都市から機械的に算出する（キャラクター作成の全項目を必ず埋める）。
  const createdPeopleIds: number[] = [];
  const createdPeopleNames: string[] = [];
  for (const np of validated.new_people) {
    const newId = await createPerson(c.env, {
      name: np.name,
      name_kana: np.name_kana,
      age: np.age,
      gender: np.gender,
      city_id: city.id,
      occupation: np.occupation,
      organization_id: np.organization_id,
      money: 0,
      status: "alive",
      bio: null,
      annual_income: np.annual_income,
      job_title: np.job_title,
      birth_date: computeBirthDateFromAge(world.current_date, np.age),
      birthplace: city.name,
    });
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
  for (const no of validated.new_organizations) {
    const pos = assignZonePositionForCity(city, zonePoints);
    const newOrgId = await createOrganization(c.env, {
      name: no.name,
      kind: no.kind,
      city_id: city.id,
      description: null,
      industry: no.industry,
      employee_count: null, // 次回の経済成長処理(economicGrowth.ts)が新設企業として初期値を与える
      annual_revenue: null,
      founded_year: null,
      map_x: pos.x,
      map_y: pos.y,
    });
    zonePoints.push(pos);
    createdOrgIds.push(newOrgId);
    createdOrgNames.push(no.name);
  }
  for (const nf of validated.new_facilities) {
    const pos = assignZonePositionForCity(city, zonePoints);
    await createFacility(c.env, {
      name: nf.name,
      kind: nf.kind,
      city_id: city.id,
      description: null,
      map_x: pos.x,
      map_y: pos.y,
    });
    zonePoints.push(pos);
  }

  // 管理者が明示的に選んだ人物・組織は、AIが出力に含めていなくても機械的に補完する。
  const relatedPeopleIds = Array.from(
    new Set([...validated.related_person_ids, ...createdPeopleIds, ...hintPersonIds.filter((id) => allowedPersonIds.has(id))])
  );
  const relatedOrgIds = Array.from(
    new Set([...validated.related_organization_ids, ...createdOrgIds, ...hintOrgIds.filter((id) => allowedOrgIds.has(id))])
  );
  const relatedPeopleNames = [
    ...people.filter((p) => relatedPeopleIds.includes(p.id)).map((p) => p.name),
    ...createdPeopleNames,
  ];
  const relatedOrgNames = [
    ...organizations.filter((o) => relatedOrgIds.includes(o.id)).map((o) => o.name),
    ...createdOrgNames,
  ];

  const { system: newsSystem, user: newsUser } = buildNewsPrompt(
    { cityName: city.name, targetDate: world.current_date },
    {
      event_type: validated.event_type,
      summary: validated.summary,
      detail: validated.detail,
      involves_magic: validated.involves_magic,
      relatedPeopleNames,
      relatedOrgNames,
    }
  );
  const newsAiResult = await callAiForJson(c.env, c.env.AI_NEWS_MODEL, newsSystem, newsUser, 1600);
  let newsDraft = newsAiResult.ok ? validateNewsDraft(newsAiResult.json) : null;
  await logAiCall(c.env, {
    callType: "admin_news",
    model: c.env.AI_NEWS_MODEL,
    systemPrompt: newsSystem,
    userPrompt: newsUser,
    rawResponse: newsAiResult.raw ?? null,
    success: newsDraft != null,
    error: !newsAiResult.ok ? newsAiResult.error ?? "AI呼び出し失敗" : !newsDraft ? "バリデーション失敗" : null,
    changesSummary: newsDraft ? { title: newsDraft.title, category: newsDraft.category, bodyLength: newsDraft.body.length } : null,
  });
  if (!newsDraft) {
    newsDraft = {
      title: validated.summary,
      body: `${validated.detail}\n\n関係者への取材によると、詳細は今後明らかになる見込み。`,
      category: genre ?? "社会",
    };
  } else if (genre) {
    newsDraft = { ...newsDraft, category: genre };
  }
  newsDraft = { ...newsDraft, body: padShortArticleBody(newsDraft.body, newsDraft.category) };

  const appliedImpact = await applyStateChanges(c.env, validated.state_changes, world.current_date, relatedPeopleIds);

  const eventInsert = await c.env.DB.prepare(
    `INSERT INTO events
       (world_date, event_type, location_city_id, summary, detail, related_people, related_organizations, world_state_impact, is_newsworthy, source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
  )
    .bind(
      world.current_date,
      validated.event_type,
      city.id,
      validated.summary,
      validated.detail,
      JSON.stringify(relatedPeopleIds),
      JSON.stringify(relatedOrgIds),
      JSON.stringify(appliedImpact),
      "admin_ai_assisted",
      nowIso()
    )
    .run();
  const eventId = eventInsert.meta.last_row_id as number;

  const newsInsert = await c.env.DB.prepare(
    `INSERT INTO news
       (title, body, published_at, occurred_at, category, related_people, related_organizations, related_city_id, event_id, reporter_person_id, generated_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      newsDraft.title,
      newsDraft.body,
      nowIso(),
      world.current_date,
      newsDraft.category,
      JSON.stringify(relatedPeopleIds),
      JSON.stringify(relatedOrgIds),
      city.id,
      eventId,
      reporterId,
      "admin_ai_assisted",
      nowIso()
    )
    .run();
  const newsId = newsInsert.meta.last_row_id as number;

  await c.env.DB.prepare("UPDATE events SET news_id = ? WHERE id = ?").bind(newsId, eventId).run();
  await c.env.DB.prepare("INSERT INTO timeline (world_date, event_id, headline, created_at) VALUES (?, ?, ?, ?)")
    .bind(world.current_date, eventId, newsDraft.title, nowIso())
    .run();

  return c.json({ ok: true, eventId, newsId });
});

// 完全手動でのニュース作成。タイトル・本文・関連人物/組織・状態変化まですべて
// 管理者が直接指定する（AIは使わない）。
app.post("/api/admin/news/manual", async (c) => {
  const authError = checkAdminAuth(c);
  if (authError) return authError;
  const body = await c.req.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 120) : "";
  const text = typeof body?.body === "string" ? body.body.trim().slice(0, 6000) : "";
  const category = typeof body?.category === "string" ? body.category : "";
  if (!title || !text) return c.json({ error: "title and body are required" }, 400);
  if (!(NEWS_CATEGORIES as readonly string[]).includes(category)) {
    return c.json({ error: "invalid category" }, 400);
  }

  const relatedPersonIdsRaw = parseIdList(body?.relatedPersonIds, 10);
  const relatedOrgIdsRaw = parseIdList(body?.relatedOrgIds, 6);
  const [relatedPeople, relatedOrgs] = await Promise.all([
    getPeopleByIds(c.env, relatedPersonIdsRaw),
    getOrganizationsByIds(c.env, relatedOrgIdsRaw),
  ]);
  const relatedPeopleIds = relatedPeople.map((p) => p.id);
  const relatedOrgIds = relatedOrgs.map((o) => o.id);

  const world = await getWorld(c.env);
  if (!world) return c.json({ error: "world not found" }, 500);
  const cityId = relatedOrgs[0]?.city_id ?? relatedPeople[0]?.city_id ?? 1;

  const reporterIdRaw =
    typeof body?.reporterId === "number" && Number.isInteger(body.reporterId) ? body.reporterId : null;
  let reporterId: number | null = reporterIdRaw;
  if (reporterId !== null) {
    const reporter = await getPerson(c.env, reporterId);
    if (!reporter) return c.json({ error: "reporter not found" }, 400);
  } else {
    reporterId = await getRandomReporterId(c.env, cityId);
  }

  const stateChanges = validateStateChanges(body?.stateChanges, new Set(relatedPeopleIds), new Set(relatedOrgIds));
  const appliedImpact = await applyStateChanges(c.env, stateChanges, world.current_date, relatedPeopleIds);

  const nowIso = () => new Date().toISOString();
  const eventInsert = await c.env.DB.prepare(
    `INSERT INTO events
       (world_date, event_type, location_city_id, summary, detail, related_people, related_organizations, world_state_impact, is_newsworthy, source, created_at)
     VALUES (?, 'manual', ?, ?, ?, ?, ?, ?, 1, 'admin_manual', ?)`
  )
    .bind(
      world.current_date,
      cityId,
      title,
      text.slice(0, 600),
      JSON.stringify(relatedPeopleIds),
      JSON.stringify(relatedOrgIds),
      JSON.stringify(appliedImpact),
      nowIso()
    )
    .run();
  const eventId = eventInsert.meta.last_row_id as number;

  const newsInsert = await c.env.DB.prepare(
    `INSERT INTO news
       (title, body, published_at, occurred_at, category, related_people, related_organizations, related_city_id, event_id, reporter_person_id, generated_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'admin_manual', ?)`
  )
    .bind(
      title,
      text,
      nowIso(),
      world.current_date,
      category,
      JSON.stringify(relatedPeopleIds),
      JSON.stringify(relatedOrgIds),
      cityId,
      eventId,
      reporterId,
      nowIso()
    )
    .run();
  const newsId = newsInsert.meta.last_row_id as number;

  await c.env.DB.prepare("UPDATE events SET news_id = ? WHERE id = ?").bind(newsId, eventId).run();
  await c.env.DB.prepare("INSERT INTO timeline (world_date, event_id, headline, created_at) VALUES (?, ?, ?, ?)")
    .bind(world.current_date, eventId, title, nowIso())
    .run();

  return c.json({ ok: true, eventId, newsId });
});

// ---- 管理画面: 人物編集 ----

app.get("/api/admin/people-list", async (c) => {
  const authError = checkAdminAuth(c);
  if (authError) return authError;
  const q = c.req.query("q") ?? "";
  const occupation = c.req.query("occupation") ?? "";
  const status = c.req.query("status") ?? "";
  const people = await listPeopleAdmin(c.env, { q, occupation, status });
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

const WORLD_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parsePersonLifeDetails(body: Record<string, unknown>) {
  const annualIncome =
    typeof body.annual_income === "number" && Number.isFinite(body.annual_income) && body.annual_income >= 0
      ? Math.round(body.annual_income)
      : null;
  const jobTitle =
    typeof body.job_title === "string" && body.job_title.trim() ? body.job_title.trim().slice(0, 40) : null;
  const birthDate =
    typeof body.birth_date === "string" && WORLD_DATE_RE.test(body.birth_date.trim()) ? body.birth_date.trim() : null;
  const birthplace =
    typeof body.birthplace === "string" && body.birthplace.trim() ? body.birthplace.trim().slice(0, 40) : null;
  return { annual_income: annualIncome, job_title: jobTitle, birth_date: birthDate, birthplace };
}

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
    ...parsePersonLifeDetails(body),
  });
  return c.json({ ok: true });
});

app.post("/api/admin/people", async (c) => {
  const authError = checkAdminAuth(c);
  if (authError) return authError;
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
  const cityIdRaw = typeof body.city_id === "number" && Number.isInteger(body.city_id) ? body.city_id : 1;

  if (organizationId !== null) {
    const org = await getOrganization(c.env, organizationId);
    if (!org) return c.json({ error: "organization_id does not exist" }, 400);
  }
  const city = await getCity(c.env, cityIdRaw);
  if (!city) return c.json({ error: "invalid city_id" }, 400);

  const id = await createPerson(c.env, {
    name,
    name_kana: nameKana,
    age,
    gender,
    city_id: city.id,
    occupation,
    organization_id: organizationId,
    money,
    status,
    bio,
    ...parsePersonLifeDetails(body),
  });
  return c.json({ ok: true, id });
});

// ---- 管理画面: 職業タイプ管理 ----

app.get("/api/admin/occupation-types", async (c) => {
  const authError = checkAdminAuth(c);
  if (authError) return authError;
  const types = await listOccupationTypes(c.env);
  return c.json({ occupationTypes: types.results ?? [] });
});

app.post("/api/admin/occupation-types", async (c) => {
  const authError = checkAdminAuth(c);
  if (authError) return authError;
  const body = await c.req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 40) : "";
  if (!name) return c.json({ error: "name is required" }, 400);
  try {
    const id = await createOccupationType(c.env, name);
    return c.json({ ok: true, id });
  } catch (err) {
    return c.json({ error: "この職業名はすでに登録されています" }, 400);
  }
});

app.put("/api/admin/occupation-types/:id", async (c) => {
  const authError = checkAdminAuth(c);
  if (authError) return authError;
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "invalid id" }, 400);
  const body = await c.req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 40) : "";
  if (!name) return c.json({ error: "name is required" }, 400);
  try {
    await updateOccupationType(c.env, id, name);
    return c.json({ ok: true });
  } catch (err) {
    return c.json({ error: "この職業名はすでに登録されています" }, 400);
  }
});

app.delete("/api/admin/occupation-types/:id", async (c) => {
  const authError = checkAdminAuth(c);
  if (authError) return authError;
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "invalid id" }, 400);
  await deleteOccupationType(c.env, id);
  return c.json({ ok: true });
});

// ---- 管理画面: 人間関係・家系図 ----

app.get("/api/admin/people/:id/relationships", async (c) => {
  const authError = checkAdminAuth(c);
  if (authError) return authError;
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "invalid id" }, 400);
  const rows = await listRelationshipsForPerson(c.env, id);
  const relRows = rows.results ?? [];
  const others = await getPeopleByIds(c.env, relRows.map((r) => r.related_person_id));
  const othersById = new Map(others.map((p) => [p.id, p]));
  const relationships = relRows
    .map((r) => {
      const other = othersById.get(r.related_person_id);
      if (!other) return null;
      return { relatedPersonId: other.id, relatedPersonName: other.name, relationType: r.relation_type };
    })
    .filter((r): r is { relatedPersonId: number; relatedPersonName: string; relationType: string } => r !== null);
  return c.json({ relationships });
});

app.post("/api/admin/relationships", async (c) => {
  const authError = checkAdminAuth(c);
  if (authError) return authError;
  const body = await c.req.json().catch(() => null);
  const personId = typeof body?.personId === "number" && Number.isInteger(body.personId) ? body.personId : null;
  const relatedPersonId =
    typeof body?.relatedPersonId === "number" && Number.isInteger(body.relatedPersonId) ? body.relatedPersonId : null;
  const relationType =
    typeof body?.relationType === "string" && (RELATION_TYPES as readonly string[]).includes(body.relationType)
      ? body.relationType
      : null;
  if (!personId || !relatedPersonId || !relationType) {
    return c.json({ error: "personId, relatedPersonId, relationType are required" }, 400);
  }
  if (personId === relatedPersonId) return c.json({ error: "cannot relate a person to themselves" }, 400);
  const [a, b] = await Promise.all([getPerson(c.env, personId), getPerson(c.env, relatedPersonId)]);
  if (!a || !b) return c.json({ error: "person not found" }, 404);

  const reverseType = RELATION_TYPE_REVERSE[relationType] ?? relationType;
  await createRelationshipPair(c.env, personId, relatedPersonId, relationType, reverseType);
  return c.json({ ok: true });
});

app.delete("/api/admin/relationships", async (c) => {
  const authError = checkAdminAuth(c);
  if (authError) return authError;
  const body = await c.req.json().catch(() => null);
  const personId = typeof body?.personId === "number" && Number.isInteger(body.personId) ? body.personId : null;
  const relatedPersonId =
    typeof body?.relatedPersonId === "number" && Number.isInteger(body.relatedPersonId) ? body.relatedPersonId : null;
  const relationType =
    typeof body?.relationType === "string" && (RELATION_TYPES as readonly string[]).includes(body.relationType)
      ? body.relationType
      : null;
  if (!personId || !relatedPersonId || !relationType) {
    return c.json({ error: "personId, relatedPersonId, relationType are required" }, 400);
  }
  const reverseType = RELATION_TYPE_REVERSE[relationType] ?? relationType;
  await deleteRelationshipPair(c.env, personId, relatedPersonId, relationType, reverseType);
  return c.json({ ok: true });
});

// 出産の記録: 母親(必須)・父親(任意)から新しい人物を作成し、親子関係
// (+ 既存の子がいれば兄弟姉妹関係も)を自動的に結ぶ。
app.post("/api/admin/people/childbirth", async (c) => {
  const authError = checkAdminAuth(c);
  if (authError) return authError;
  const body = await c.req.json().catch(() => null);
  const motherId = typeof body?.motherId === "number" && Number.isInteger(body.motherId) ? body.motherId : null;
  if (!motherId) return c.json({ error: "motherId is required" }, 400);
  const fatherId = typeof body?.fatherId === "number" && Number.isInteger(body.fatherId) ? body.fatherId : null;
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 40) : "";
  if (!name) return c.json({ error: "name is required" }, 400);
  const nameKanaRaw = typeof body?.name_kana === "string" ? body.name_kana.trim().slice(0, 60) : "";
  const nameKana = nameKanaRaw && /^[ぁ-ゖゝ-ゟー・\s]+$/.test(nameKanaRaw) ? nameKanaRaw : null;
  const gender = typeof body?.gender === "string" && body.gender.trim() ? body.gender.trim().slice(0, 20) : null;

  const mother = await getPerson(c.env, motherId);
  if (!mother) return c.json({ error: "mother not found" }, 404);
  const father = fatherId ? await getPerson(c.env, fatherId) : null;
  if (fatherId && !father) return c.json({ error: "father not found" }, 404);

  const world = await getWorld(c.env);
  if (!world) return c.json({ error: "world not found" }, 500);
  const motherCity = mother.city_id ? await getCity(c.env, mother.city_id) : null;

  const babyId = await createPerson(c.env, {
    name,
    name_kana: nameKana,
    age: 0,
    gender,
    city_id: mother.city_id ?? 1,
    occupation: null,
    organization_id: null,
    money: 0,
    status: "alive",
    bio: null,
    annual_income: null,
    job_title: null,
    birth_date: world.current_date,
    birthplace: motherCity?.name ?? null,
  });

  await createRelationshipPair(c.env, mother.id, babyId, "family_child", "family_parent");
  if (father) {
    await createRelationshipPair(c.env, father.id, babyId, "family_child", "family_parent");
  }

  // 母親の既存の子（今回生まれた子以外）とは兄弟姉妹として結ぶ。
  const motherRelResult = await listRelationshipsForPerson(c.env, mother.id);
  const existingChildIds = (motherRelResult.results ?? [])
    .filter((r) => r.relation_type === "family_child" && r.related_person_id !== babyId)
    .map((r) => r.related_person_id);
  for (const siblingId of existingChildIds) {
    await createRelationshipPair(c.env, babyId, siblingId, "family_sibling", "family_sibling");
  }

  return c.json({ ok: true, id: babyId });
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
      city_id: o.city_id,
      description: o.description,
      industry: o.industry,
      employeeCount: o.employee_count,
      annualRevenue: o.annual_revenue,
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
  const employeeCount =
    typeof body?.employeeCount === "number" && Number.isFinite(body.employeeCount) && body.employeeCount >= 0
      ? Math.round(body.employeeCount)
      : null;
  const annualRevenue =
    typeof body?.annualRevenue === "number" && Number.isFinite(body.annualRevenue) && body.annualRevenue >= 0
      ? Math.round(body.annualRevenue)
      : null;
  const foundedYear =
    typeof body?.foundedYear === "number" && Number.isInteger(body.foundedYear) ? body.foundedYear : null;
  const cityIdRaw =
    typeof body?.city_id === "number" && Number.isInteger(body.city_id) ? body.city_id : 1;
  const city = await getCity(c.env, cityIdRaw);
  if (!city) return c.json({ error: "invalid city_id" }, 400);

  const world = await getWorld(c.env);
  // 創業年が世界暦より未来にならないようにクランプする（かつて種データの創業年が現実世界の
  // 年表記のまま投入され、世界暦リセット後の現在(1900年前後)から見ると軒並み未来の創業に
  // なってしまっていた不具合の再発防止、scripts/fix_future_founded_years.sql参照）。
  const worldYear = world ? Number(world.current_date.slice(0, 4)) : null;
  const clampedFoundedYear =
    foundedYear != null && worldYear != null && foundedYear > worldYear ? worldYear : foundedYear;
  const [orgs, facilities] = await Promise.all([listOrganizations(c.env), listFacilities(c.env)]);
  const orgList = orgs.results ?? [];
  const facilityList = facilities.results ?? [];

  // 企業は所在都市の拠点付近（同じ都市の既存の企業・施設からも間隔を取って）配置する。
  const sameCityZonePoints = [
    ...orgList.filter((o) => o.city_id === city.id && o.map_x != null && o.map_y != null)
      .map((o) => ({ x: o.map_x as number, y: o.map_y as number })),
    ...facilityList.filter((f) => f.city_id === city.id).map((f) => ({ x: f.map_x, y: f.map_y })),
  ];
  const pos = assignZonePositionForCity(city, sameCityZonePoints);

  const id = await createOrganization(c.env, {
    name,
    kind,
    city_id: city.id,
    description,
    industry,
    employee_count: employeeCount,
    annual_revenue: annualRevenue,
    founded_year: clampedFoundedYear,
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
  const employeeCount =
    typeof body?.employeeCount === "number" && Number.isFinite(body.employeeCount) && body.employeeCount >= 0
      ? Math.round(body.employeeCount)
      : existing.employee_count;
  const annualRevenue =
    typeof body?.annualRevenue === "number" && Number.isFinite(body.annualRevenue) && body.annualRevenue >= 0
      ? Math.round(body.annualRevenue)
      : existing.annual_revenue;
  const foundedYearRaw =
    typeof body?.foundedYear === "number" && Number.isInteger(body.foundedYear)
      ? body.foundedYear
      : existing.founded_year;

  const requestedCityId =
    typeof body?.city_id === "number" && Number.isInteger(body.city_id) ? body.city_id : existing.city_id ?? 1;
  const city = await getCity(c.env, requestedCityId);
  if (!city) return c.json({ error: "invalid city_id" }, 400);

  // 創業年が世界暦より未来にならないようにクランプする（POSTルートと同じ理由）。
  const worldForFoundedYear = await getWorld(c.env);
  const worldYearForFoundedYear = worldForFoundedYear ? Number(worldForFoundedYear.current_date.slice(0, 4)) : null;
  const foundedYear =
    foundedYearRaw != null && worldYearForFoundedYear != null && foundedYearRaw > worldYearForFoundedYear
      ? worldYearForFoundedYear
      : foundedYearRaw;

  let mapX = existing.map_x;
  let mapY = existing.map_y;
  if (city.id !== existing.city_id) {
    // 所在都市を変更した場合、その都市のクラスタ付近へ座標を再割り当てする（7.2節のロジック）。
    const [orgs, facilities] = await Promise.all([listOrganizations(c.env), listFacilities(c.env)]);
    const orgList = (orgs.results ?? []).filter((o) => o.id !== id);
    const facilityList = facilities.results ?? [];
    const sameCityZonePoints = [
      ...orgList.filter((o) => o.city_id === city.id && o.map_x != null && o.map_y != null)
        .map((o) => ({ x: o.map_x as number, y: o.map_y as number })),
      ...facilityList.filter((f) => f.city_id === city.id).map((f) => ({ x: f.map_x, y: f.map_y })),
    ];
    const pos = assignZonePositionForCity(city, sameCityZonePoints);
    mapX = pos.x;
    mapY = pos.y;
  }

  // 倒産(bankrupt)になった場合は従業員数・売上を0にする（従業員の所属解除と合わせて、
  // 「倒産した企業がなぜか従業員数だけ残り続ける」という食い違いを防ぐ）。
  const becameBankrupt = status === "bankrupt" && existing.status !== "bankrupt";

  await updateOrganizationAdmin(c.env, id, {
    name,
    kind,
    status,
    description,
    industry,
    employee_count: becameBankrupt ? 0 : employeeCount,
    annual_revenue: becameBankrupt ? null : annualRevenue,
    founded_year: foundedYear,
    city_id: city.id,
    map_x: mapX,
    map_y: mapY,
  });

  // 倒産(bankrupt)になった場合、そこに勤めていた人物を無所属に戻す。
  let clearedEmployees = 0;
  if (becameBankrupt) {
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
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    if (event.cron === "0 23 * * *") {
      ctx.waitUntil(
        postDailyNewsDigest(env).catch((err) => {
          console.error("daily news digest tweet failed", err);
        })
      );
      return;
    }
    ctx.waitUntil(
      (async () => {
        try {
          await tickWorldDate(env);
        } catch (err) {
          console.error("world date tick failed", err);
        }
      })()
    );
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
