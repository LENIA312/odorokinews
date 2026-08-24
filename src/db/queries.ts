import type {
  CityRow,
  EconomicDataRow,
  Env,
  EventRow,
  NewsRow,
  OrganizationRow,
  PersonRow,
  RelationshipRow,
  SimulationRunRow,
  TimelineRow,
  WorldRow,
} from "../types";

export function getWorld(env: Env): Promise<WorldRow | null> {
  return env.DB.prepare("SELECT * FROM world WHERE id = 1").first<WorldRow>();
}

export function getCity(env: Env, id: number): Promise<CityRow | null> {
  return env.DB.prepare("SELECT * FROM cities WHERE id = ?").bind(id).first<CityRow>();
}

export function listCities(env: Env): Promise<D1Result<CityRow>> {
  return env.DB.prepare("SELECT * FROM cities ORDER BY population DESC").all<CityRow>();
}

export function getOrganization(env: Env, id: number): Promise<OrganizationRow | null> {
  return env.DB.prepare("SELECT * FROM organizations WHERE id = ?").bind(id).first<OrganizationRow>();
}

export function listOrganizations(env: Env): Promise<D1Result<OrganizationRow>> {
  return env.DB.prepare("SELECT * FROM organizations ORDER BY id ASC").all<OrganizationRow>();
}

export function listPeople(env: Env, limit = 60): Promise<D1Result<PersonRow>> {
  return env.DB.prepare("SELECT * FROM people ORDER BY updated_at DESC, id ASC LIMIT ?")
    .bind(limit)
    .all<PersonRow>();
}

export function getPerson(env: Env, id: number): Promise<PersonRow | null> {
  return env.DB.prepare("SELECT * FROM people WHERE id = ?").bind(id).first<PersonRow>();
}

export function listRelationshipsForPerson(env: Env, personId: number): Promise<D1Result<RelationshipRow>> {
  return env.DB.prepare("SELECT * FROM relationships WHERE person_id = ?").bind(personId).all<RelationshipRow>();
}

// related_people はJSON配列で保存されているため、SQLのLIKEでは安全に
// 部分一致できない（"1" が "12" にもマッチしてしまう等）。
// ニュース件数は1日1件程度で少量である前提のもと、直近分を取得して
// アプリケーション側でJSONとして正しく判定する。
export async function listNewsForPerson(env: Env, personId: number, limit = 20): Promise<NewsRow[]> {
  const recent = await env.DB.prepare(
    "SELECT * FROM news ORDER BY published_at DESC, id DESC LIMIT 500"
  ).all<NewsRow>();
  const matches = (recent.results ?? []).filter((n) => parseIdArray(n.related_people).includes(personId));
  return matches.slice(0, limit);
}

export function listNews(env: Env, limit = 20, offset = 0): Promise<D1Result<NewsRow>> {
  return env.DB.prepare("SELECT * FROM news ORDER BY published_at DESC, id DESC LIMIT ? OFFSET ?")
    .bind(limit, offset)
    .all<NewsRow>();
}

export function getNews(env: Env, id: number): Promise<NewsRow | null> {
  return env.DB.prepare("SELECT * FROM news WHERE id = ?").bind(id).first<NewsRow>();
}

export function getEvent(env: Env, id: number): Promise<EventRow | null> {
  return env.DB.prepare("SELECT * FROM events WHERE id = ?").bind(id).first<EventRow>();
}

export function listTimeline(env: Env, limit = 100): Promise<D1Result<TimelineRow>> {
  return env.DB.prepare("SELECT * FROM timeline ORDER BY world_date DESC, id DESC LIMIT ?")
    .bind(limit)
    .all<TimelineRow>();
}

export function listRecentSimulationRuns(env: Env, limit = 14): Promise<D1Result<SimulationRunRow>> {
  return env.DB.prepare("SELECT * FROM simulation_runs ORDER BY id DESC LIMIT ?")
    .bind(limit)
    .all<SimulationRunRow>();
}

export function latestEconomicDataByOrg(env: Env): Promise<D1Result<EconomicDataRow>> {
  return env.DB.prepare(
    `SELECT ed.*
     FROM economic_data ed
     INNER JOIN (
       SELECT organization_id, metric, MAX(world_date) AS max_date
       FROM economic_data
       WHERE organization_id IS NOT NULL
       GROUP BY organization_id, metric
     ) latest
       ON ed.organization_id = latest.organization_id
      AND ed.metric = latest.metric
      AND ed.world_date = latest.max_date
     ORDER BY ed.organization_id ASC`
  ).all<EconomicDataRow>();
}

export function latestPriceIndex(env: Env): Promise<EconomicDataRow | null> {
  return env.DB.prepare(
    `SELECT * FROM economic_data
     WHERE organization_id IS NULL AND metric = 'price_index'
     ORDER BY world_date DESC LIMIT 1`
  ).first<EconomicDataRow>();
}

export function previousEconomicValue(
  env: Env,
  organizationId: number,
  metric: string,
  beforeDate: string
): Promise<EconomicDataRow | null> {
  return env.DB.prepare(
    `SELECT * FROM economic_data
     WHERE organization_id = ? AND metric = ? AND world_date < ?
     ORDER BY world_date DESC LIMIT 1`
  )
    .bind(organizationId, metric, beforeDate)
    .first<EconomicDataRow>();
}

export function parseIdArray(json: string | null): number[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v) => Number.isInteger(v));
  } catch {
    return [];
  }
}

export async function getPeopleByIds(env: Env, ids: number[]): Promise<PersonRow[]> {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(",");
  const result = await env.DB.prepare(`SELECT * FROM people WHERE id IN (${placeholders})`)
    .bind(...ids)
    .all<PersonRow>();
  return result.results ?? [];
}

export async function getOrganizationsByIds(env: Env, ids: number[]): Promise<OrganizationRow[]> {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(",");
  const result = await env.DB.prepare(`SELECT * FROM organizations WHERE id IN (${placeholders})`)
    .bind(...ids)
    .all<OrganizationRow>();
  return result.results ?? [];
}
