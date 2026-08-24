import { Hono } from "hono";
import type { Env } from "./types";
import {
  getCity,
  getEvent,
  getNews,
  getOrganization,
  getPerson,
  getPeopleByIds,
  getOrganizationsByIds,
  getWorld,
  latestEconomicDataByOrg,
  latestPriceIndex,
  listCities,
  listNews,
  listNewsForPerson,
  listOrganizations,
  listPeople,
  listRelationshipsForPerson,
  listTimeline,
  parseIdArray,
} from "./db/queries";
import { page } from "./views/layout";
import { worldbar } from "./views/components";
import { newsListSection } from "./views/newsList";
import { newsDetailView } from "./views/newsDetail";
import { worldView } from "./views/world";
import { peopleListView } from "./views/people";
import { personDetailView } from "./views/personDetail";
import { timelineView } from "./views/timeline";
import { economyView } from "./views/economy";
import { notFoundView } from "./views/notFound";
import { runDailySimulation } from "./simulation/runDailySimulation";
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
      worldbar: worldbar(world),
      body: newsListSection("最新ニュース", news.results ?? []),
    }).value
  );
});

app.get("/news", async (c) => {
  const world = await getWorld(c.env);
  const news = await listNews(c.env, 50);
  return c.html(
    page({
      title: "ニュース一覧",
      activePath: "/",
      worldbar: world ? worldbar(world) : undefined,
      body: newsListSection("ニュース一覧", news.results ?? []),
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
    return c.html(page({ title: "見つかりません", activePath: "/", body: notFoundView() }).value, 404);
  }

  const world = await getWorld(c.env);
  const city = news.related_city_id ? await getCity(c.env, news.related_city_id) : null;
  const relatedPeople = await getPeopleByIds(c.env, parseIdArray(news.related_people));
  const relatedOrgs = await getOrganizationsByIds(c.env, parseIdArray(news.related_organizations));

  return c.html(
    page({
      title: news.title,
      activePath: "/",
      worldbar: world ? worldbar(world) : undefined,
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
      worldbar: worldbar(world),
      body: worldView(world, cities.results ?? []),
    }).value
  );
});

app.get("/people", async (c) => {
  const world = await getWorld(c.env);
  const [people, orgs] = await Promise.all([listPeople(c.env, 60), listOrganizations(c.env)]);
  const orgById = new Map<number, OrganizationRow>((orgs.results ?? []).map((o) => [o.id, o]));

  return c.html(
    page({
      title: "人物",
      activePath: "/people",
      worldbar: world ? worldbar(world) : undefined,
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
      worldbar: world ? worldbar(world) : undefined,
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
      worldbar: world ? worldbar(world) : undefined,
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
      worldbar: world ? worldbar(world) : undefined,
      body: economyView(orgs.results ?? [], latestByOrg, priceIndex),
    }).value
  );
});

app.get("/api/health", async (c) => {
  const world = await getWorld(c.env);
  return c.json({ status: "ok", worldDate: world?.current_date ?? null });
});

// 手動でのシミュレーション実行（デプロイ後の動作確認用）。
// ADMIN_TOKEN が設定されている場合のみ有効。
app.post("/api/admin/simulate", async (c) => {
  if (!c.env.ADMIN_TOKEN) {
    return c.json({ error: "ADMIN_TOKEN is not configured" }, 404);
  }
  const provided = c.req.header("x-admin-token");
  if (provided !== c.env.ADMIN_TOKEN) {
    return c.json({ error: "unauthorized" }, 401);
  }
  try {
    const result = await runDailySimulation(c.env);
    return c.json(result);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

app.notFound((c) => c.html(page({ title: "見つかりません", activePath: "/", body: notFoundView() }).value, 404));

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      runDailySimulation(env).catch((err) => {
        console.error("daily simulation failed", err);
      })
    );
  },
};
