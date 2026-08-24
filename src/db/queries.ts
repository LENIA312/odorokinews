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

// 人物一覧ページ用。50音順（name_kanaが無い場合は末尾に回す）で全件取得する。
export function listPeopleByKana(env: Env, limit = 1000): Promise<D1Result<PersonRow>> {
  return env.DB.prepare(
    `SELECT * FROM people
     ORDER BY (name_kana IS NULL) ASC, name_kana ASC, name ASC
     LIMIT ?`
  )
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

export function listNewsByCategory(env: Env, category: string, limit = 50): Promise<D1Result<NewsRow>> {
  return env.DB.prepare("SELECT * FROM news WHERE category = ? ORDER BY published_at DESC, id DESC LIMIT ?")
    .bind(category, limit)
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

// economic_dataは追記のみ(更新・削除なし)のため、idの大小がそのまま
// 挿入順=新しさを表す。同一world_dateに複数回の更新があっても
// MAX(id)なら常に最後に挿入された値を正しく拾える。
export function latestEconomicDataByOrg(env: Env): Promise<D1Result<EconomicDataRow>> {
  return env.DB.prepare(
    `SELECT ed.*
     FROM economic_data ed
     INNER JOIN (
       SELECT organization_id, metric, MAX(id) AS max_id
       FROM economic_data
       WHERE organization_id IS NOT NULL
       GROUP BY organization_id, metric
     ) latest ON ed.id = latest.max_id
     ORDER BY ed.organization_id ASC`
  ).all<EconomicDataRow>();
}

export function latestPriceIndex(env: Env): Promise<EconomicDataRow | null> {
  return env.DB.prepare(
    `SELECT * FROM economic_data
     WHERE organization_id IS NULL AND metric = 'price_index'
     ORDER BY id DESC LIMIT 1`
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
     ORDER BY world_date DESC, id DESC LIMIT 1`
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

// ---- 管理画面用の更新系クエリ ----

export function updateWorldAutoPublishTimes(env: Env, timesJson: string): Promise<D1Result> {
  return env.DB.prepare("UPDATE world SET auto_publish_times = ?, updated_at = ? WHERE id = 1")
    .bind(timesJson, new Date().toISOString())
    .run();
}

export interface NewsUpdateFields {
  title: string;
  body: string;
  category: string;
}

export function updateNews(env: Env, id: number, fields: NewsUpdateFields): Promise<D1Result> {
  return env.DB.prepare("UPDATE news SET title = ?, body = ?, category = ? WHERE id = ?")
    .bind(fields.title, fields.body, fields.category, id)
    .run();
}

export interface PersonUpdateFields {
  name: string;
  name_kana: string | null;
  age: number | null;
  gender: string | null;
  occupation: string | null;
  organization_id: number | null;
  money: number;
  status: string;
  bio: string | null;
}

export function updatePerson(env: Env, id: number, fields: PersonUpdateFields): Promise<D1Result> {
  return env.DB.prepare(
    `UPDATE people
     SET name = ?, name_kana = ?, age = ?, gender = ?, occupation = ?,
         organization_id = ?, money = ?, status = ?, bio = ?, updated_at = ?
     WHERE id = ?`
  )
    .bind(
      fields.name,
      fields.name_kana,
      fields.age,
      fields.gender,
      fields.occupation,
      fields.organization_id,
      fields.money,
      fields.status,
      fields.bio,
      new Date().toISOString(),
      id
    )
    .run();
}

export interface OrganizationUpdateFields {
  name: string;
  kind: string;
  status: string;
  description: string | null;
  industry: string | null;
  employee_scale: string | null;
  founded_year: number | null;
}

export function updateOrganizationAdmin(env: Env, id: number, fields: OrganizationUpdateFields): Promise<D1Result> {
  return env.DB.prepare(
    `UPDATE organizations
     SET name = ?, kind = ?, status = ?, description = ?, industry = ?, employee_scale = ?, founded_year = ?, updated_at = ?
     WHERE id = ?`
  )
    .bind(
      fields.name,
      fields.kind,
      fields.status,
      fields.description,
      fields.industry,
      fields.employee_scale,
      fields.founded_year,
      new Date().toISOString(),
      id
    )
    .run();
}

export interface OrganizationCreateFields {
  name: string;
  kind: string;
  city_id: number;
  description: string | null;
  industry: string | null;
  employee_scale: string | null;
  founded_year: number | null;
  map_x: number;
  map_y: number;
}

export async function createOrganization(env: Env, fields: OrganizationCreateFields): Promise<number> {
  const now = new Date().toISOString();
  const result = await env.DB.prepare(
    `INSERT INTO organizations
       (name, kind, city_id, description, status, industry, employee_scale, founded_year, map_x, map_y, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      fields.name,
      fields.kind,
      fields.city_id,
      fields.description,
      fields.industry,
      fields.employee_scale,
      fields.founded_year,
      fields.map_x,
      fields.map_y,
      now,
      now
    )
    .run();
  return result.meta.last_row_id as number;
}

// 企業が倒産した際、そこに勤めていた人物を無所属に戻す。
export function clearPeopleOrganization(env: Env, organizationId: number): Promise<D1Result> {
  return env.DB.prepare("UPDATE people SET organization_id = NULL, updated_at = ? WHERE organization_id = ?")
    .bind(new Date().toISOString(), organizationId)
    .run();
}

export function insertStockPrice(
  env: Env,
  organizationId: number,
  worldDate: string,
  value: number
): Promise<D1Result> {
  return env.DB.prepare(
    "INSERT INTO economic_data (world_date, organization_id, metric, value, created_at) VALUES (?, ?, 'stock_price', ?, ?)"
  )
    .bind(worldDate, organizationId, value, new Date().toISOString())
    .run();
}

export function insertPriceIndex(env: Env, worldDate: string, value: number): Promise<D1Result> {
  return env.DB.prepare(
    "INSERT INTO economic_data (world_date, organization_id, metric, value, created_at) VALUES (?, NULL, 'price_index', ?, ?)"
  )
    .bind(worldDate, value, new Date().toISOString())
    .run();
}

export function searchPeopleAdmin(env: Env, query: string, limit = 50): Promise<D1Result<PersonRow>> {
  const like = `%${query}%`;
  return env.DB.prepare(
    `SELECT * FROM people WHERE name LIKE ? OR name_kana LIKE ? ORDER BY (name_kana IS NULL) ASC, name_kana ASC LIMIT ?`
  )
    .bind(like, like, limit)
    .all<PersonRow>();
}
