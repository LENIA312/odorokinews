export interface Env {
  DB: D1Database;
  AI: Ai;

  ENVIRONMENT: string;
  AI_EVENT_MODEL: string;
  AI_NEWS_MODEL: string;
  AI_MAX_CALLS_PER_RUN: string;

  // wrangler secret put ADMIN_TOKEN で設定する任意のシークレット。
  // 未設定の場合、手動シミュレーション実行エンドポイントは無効化される。
  ADMIN_TOKEN?: string;
}

export interface WorldRow {
  id: number;
  name: string;
  name_en: string | null;
  origin_story: string;
  current_date: string;
  auto_publish_times: string;
  last_auto_publish_slot: string | null;
  last_published_at: string | null;
  weather: string;
  created_at: string;
  updated_at: string;
}

export interface CityRow {
  id: number;
  name: string;
  is_major: number;
  population: number | null;
  description: string | null;
  industries: string | null;
  status: string;
  map_x: number | null;
  map_y: number | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationRow {
  id: number;
  name: string;
  kind: string;
  city_id: number | null;
  description: string | null;
  status: string;
  industry: string | null;
  employee_scale: string | null;
  founded_year: number | null;
  map_x: number | null;
  map_y: number | null;
  created_at: string;
  updated_at: string;
}

export interface PersonRow {
  id: number;
  name: string;
  name_kana: string | null;
  age: number | null;
  gender: string | null;
  city_id: number | null;
  occupation: string | null;
  organization_id: number | null;
  money: number;
  status: string;
  origin: string;
  bio: string | null;
  annual_income: number | null;
  job_title: string | null;
  birth_date: string | null;
  birthplace: string | null;
  created_at: string;
  updated_at: string;
}

export interface RelationshipRow {
  id: number;
  person_id: number;
  related_person_id: number;
  relation_type: string;
  created_at: string;
}

export interface EventRow {
  id: number;
  world_date: string;
  event_type: string;
  location_city_id: number | null;
  summary: string;
  detail: string | null;
  related_people: string | null;
  related_organizations: string | null;
  world_state_impact: string | null;
  is_newsworthy: number;
  news_id: number | null;
  source: string;
  created_at: string;
}

export interface NewsRow {
  id: number;
  title: string;
  body: string;
  published_at: string;
  occurred_at: string;
  category: string;
  related_people: string | null;
  related_organizations: string | null;
  related_city_id: number | null;
  event_id: number;
  reporter_person_id: number | null;
  generated_by: string;
  created_at: string;
}

export interface TimelineRow {
  id: number;
  world_date: string;
  event_id: number;
  headline: string;
  created_at: string;
}

export interface EconomicDataRow {
  id: number;
  world_date: string;
  organization_id: number | null;
  metric: string;
  value: number;
  created_at: string;
}

export interface SimulationRunRow {
  id: number;
  world_date: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  ai_calls_used: number;
  event_id: number | null;
  news_id: number | null;
  error: string | null;
}

export interface OccupationTypeRow {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}
