// AI出力を世界ルールに照らして検証・サニタイズする。
// 「存在しない人物/企業の参照」「固定設定の変更」などを検出し、
// 不正な部分だけを取り除いて安全な構造化データにする（docs.md 21章）。

import { FACILITY_KINDS, NEWS_CATEGORIES, ORG_KINDS, ORG_STATUSES, PERSON_STATUSES, WEATHER_CONDITIONS } from "../constants";

export interface NewPersonDraft {
  name: string;
  name_kana: string | null;
  age: number | null;
  gender: string | null;
  occupation: string | null;
  organization_id: number | null;
  job_title: string | null;
  annual_income: number | null;
}

export interface NewOrganizationDraft {
  name: string;
  kind: string;
  industry: string | null;
  city_id: number;
}

export interface NewFacilityDraft {
  name: string;
  kind: string;
  city_id: number;
}

export interface NewCityDraft {
  name: string;
  population: number | null;
  description: string;
  industries: string[];
}

// ひらがな（＋長音記号・中黒・空白）のみで構成されているかを緩く判定する。
const HIRAGANA_ONLY = /^[ぁ-ゖゝ-ゟー・\s]+$/;

export type StateChange =
  | { type: "person_status"; target_id: number; value: string }
  | { type: "organization_status"; target_id: number; value: string }
  | { type: "economic_stock_price"; target_id: number; value: number };

export interface ValidatedEventDraft {
  event_type: string;
  summary: string;
  detail: string;
  involves_magic: boolean;
  related_person_ids: number[];
  new_people: NewPersonDraft[];
  related_organization_ids: number[];
  new_organizations: NewOrganizationDraft[];
  new_facilities: NewFacilityDraft[];
  new_city: NewCityDraft | null;
  weather: string | null;
  state_changes: StateChange[];
}

const MAX_TEXT = 600;
const MAX_SUMMARY = 200;
const MAX_TITLE = 120;
const MAX_BODY = 5000;
const MAX_RELATED_PEOPLE = 6;
const MAX_RELATED_ORGS = 4;
const MAX_STATE_CHANGES = 6;
const MAX_NEW_ORGS = 2;
const MAX_NEW_FACILITIES = 2;
const MAX_ANNUAL_INCOME = 30_000_000;
const MAX_CITY_NAME = 40;
const MAX_CITY_DESCRIPTION = 400;
const MIN_CITY_DESCRIPTION = 60; // 「できるだけ細かく都市の設定を書き上げる」を機械的に強制する下限
const MAX_CITY_INDUSTRIES = 6;
const ALLOWED_STATUS = new Set<string>(PERSON_STATUSES);
const ALLOWED_ORG_STATUS = new Set<string>(ORG_STATUSES);
const ALLOWED_ORG_KINDS = new Set<string>(ORG_KINDS);
const ALLOWED_FACILITY_KINDS = new Set<string>(FACILITY_KINDS);
const ALLOWED_WEATHER = new Set<string>(WEATHER_CONDITIONS);

function cleanText(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * state_changes配列を検証・サニタイズする。管理画面からのAI補助作成・
 * 完全手動作成でも、通常のイベントAI出力と同じルールで使い回す。
 * extraAllowedPersonIds は「AIが今回新たに作成した人物」など、
 * allowedPersonIds（既存人物）には含まれないが対象にしてよいIDを渡す。
 */
export function validateStateChanges(
  raw: unknown,
  allowedPersonIds: Set<number>,
  allowedOrgIds: Set<number>,
  extraAllowedPersonIds: Set<number> = new Set()
): StateChange[] {
  const stateChanges: StateChange[] = [];
  if (!Array.isArray(raw)) return stateChanges;
  for (const rawChange of raw.slice(0, MAX_STATE_CHANGES)) {
    if (typeof rawChange !== "object" || rawChange === null) continue;
    const c = rawChange as Record<string, unknown>;
    if (!isFiniteNumber(c.target_id)) continue;

    if (c.type === "person_status") {
      const value = cleanText(c.value, 30);
      if (ALLOWED_STATUS.has(value) && (allowedPersonIds.has(c.target_id) || extraAllowedPersonIds.has(c.target_id))) {
        stateChanges.push({ type: "person_status", target_id: c.target_id, value });
      }
    } else if (c.type === "organization_status") {
      const value = cleanText(c.value, 30);
      if (ALLOWED_ORG_STATUS.has(value) && allowedOrgIds.has(c.target_id)) {
        stateChanges.push({ type: "organization_status", target_id: c.target_id, value });
      }
    } else if (c.type === "economic_stock_price") {
      if (isFiniteNumber(c.value) && c.value > 0 && allowedOrgIds.has(c.target_id)) {
        stateChanges.push({ type: "economic_stock_price", target_id: c.target_id, value: c.value });
      }
    }
  }
  return stateChanges;
}

export function validateEventDraft(
  raw: unknown,
  allowedPersonIds: Set<number>,
  allowedOrgIds: Set<number>,
  cityId: number,
  canCreateCity = false
): ValidatedEventDraft | null {
  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Record<string, unknown>;

  const summary = cleanText(obj.summary, MAX_SUMMARY);
  const detail = cleanText(obj.detail, MAX_TEXT);
  const eventType = cleanText(obj.event_type, 60) || "general";
  if (!summary) return null;

  const relatedPersonIds: number[] = [];
  const newPeople: NewPersonDraft[] = [];
  if (Array.isArray(obj.related_people)) {
    for (const entry of obj.related_people.slice(0, MAX_RELATED_PEOPLE)) {
      if (typeof entry !== "object" || entry === null) continue;
      const e = entry as Record<string, unknown>;
      if (isFiniteNumber(e.id) && allowedPersonIds.has(e.id)) {
        relatedPersonIds.push(e.id);
        continue;
      }
      if (typeof e.new === "object" && e.new !== null) {
        const n = e.new as Record<string, unknown>;
        const name = cleanText(n.name, 40);
        if (!name) continue;
        const nameKanaRaw = cleanText(n.name_kana, 60);
        const nameKana = nameKanaRaw && HIRAGANA_ONLY.test(nameKanaRaw) ? nameKanaRaw : null;
        const age = isFiniteNumber(n.age) && n.age >= 0 && n.age <= 300 ? Math.round(n.age) : null;
        const orgId = isFiniteNumber(n.organization_id) && allowedOrgIds.has(n.organization_id) ? n.organization_id : null;
        const annualIncome =
          isFiniteNumber(n.annual_income) && n.annual_income >= 0 && n.annual_income <= MAX_ANNUAL_INCOME
            ? Math.round(n.annual_income)
            : null;
        newPeople.push({
          name,
          name_kana: nameKana,
          age,
          gender: cleanText(n.gender, 20) || null,
          occupation: cleanText(n.occupation, 40) || null,
          organization_id: orgId,
          job_title: cleanText(n.job_title, 40) || null,
          annual_income: annualIncome,
        });
      }
    }
  }

  const relatedOrgIds: number[] = [];
  if (Array.isArray(obj.related_organizations)) {
    for (const id of obj.related_organizations.slice(0, MAX_RELATED_ORGS)) {
      if (isFiniteNumber(id) && allowedOrgIds.has(id) && !relatedOrgIds.includes(id)) {
        relatedOrgIds.push(id);
      }
    }
  }

  // 新しい組織・施設は、このイベントの舞台となっている都市(cityId)にのみ作成を許可する
  // （AIが無関係な都市に企業を作ってしまうことを防ぐ機械的な安全策）。
  const newOrganizations: NewOrganizationDraft[] = [];
  if (Array.isArray(obj.new_organizations)) {
    for (const entry of obj.new_organizations.slice(0, MAX_NEW_ORGS)) {
      if (typeof entry !== "object" || entry === null) continue;
      const o = entry as Record<string, unknown>;
      const name = cleanText(o.name, 40);
      if (!name) continue;
      if (!isFiniteNumber(o.city_id) || o.city_id !== cityId) continue;
      const kindRaw = cleanText(o.kind, 20);
      const kind = ALLOWED_ORG_KINDS.has(kindRaw) ? kindRaw : "company";
      newOrganizations.push({ name, kind, industry: cleanText(o.industry, 30) || null, city_id: cityId });
    }
  }

  const newFacilities: NewFacilityDraft[] = [];
  if (Array.isArray(obj.new_facilities)) {
    for (const entry of obj.new_facilities.slice(0, MAX_NEW_FACILITIES)) {
      if (typeof entry !== "object" || entry === null) continue;
      const f = entry as Record<string, unknown>;
      const name = cleanText(f.name, 40);
      if (!name) continue;
      if (!isFiniteNumber(f.city_id) || f.city_id !== cityId) continue;
      const kindRaw = cleanText(f.kind, 20);
      const kind = ALLOWED_FACILITY_KINDS.has(kindRaw) ? kindRaw : "other";
      newFacilities.push({ name, kind, city_id: cityId });
    }
  }

  // 新しい都市の誕生は世界にとって非常に大きな出来事のため、乱発を防ぐ二重の制約を課す:
  // (1) 呼び出し側が「現在の都市数がまだ上限未満」と判断した場合のみ(canCreateCity)提案を受理し、
  // (2) 詳細な説明文(MIN_CITY_DESCRIPTION文字以上)が無い雑な提案は却下する
  //     （「できるだけ細かく都市の設定を書き上げる」という条件を機械的に強制する）。
  let newCity: NewCityDraft | null = null;
  if (canCreateCity && typeof obj.new_city === "object" && obj.new_city !== null) {
    const nc = obj.new_city as Record<string, unknown>;
    const name = cleanText(nc.name, MAX_CITY_NAME);
    const description = cleanText(nc.description, MAX_CITY_DESCRIPTION);
    const population =
      isFiniteNumber(nc.population) && nc.population >= 0 ? Math.round(nc.population) : null;
    const industries = Array.isArray(nc.industries)
      ? nc.industries.filter((s): s is string => typeof s === "string" && s.trim().length > 0).slice(0, MAX_CITY_INDUSTRIES)
      : [];
    if (name && description.length >= MIN_CITY_DESCRIPTION) {
      newCity = { name, population, description, industries };
    }
  }

  const stateChanges = validateStateChanges(
    obj.state_changes,
    allowedPersonIds,
    allowedOrgIds,
    new Set(relatedPersonIds)
  );

  const weatherRaw = cleanText(obj.weather, 20);
  const weather = ALLOWED_WEATHER.has(weatherRaw) ? weatherRaw : null;

  return {
    event_type: eventType,
    summary,
    detail: detail || summary,
    involves_magic: obj.involves_magic === true,
    related_person_ids: relatedPersonIds,
    new_people: newPeople,
    related_organization_ids: relatedOrgIds,
    new_organizations: newOrganizations,
    new_facilities: newFacilities,
    new_city: newCity,
    weather,
    state_changes: stateChanges,
  };
}

/** AI履歴タブ表示用に、検証済みイベント案から「何が変わるか」を人間が読める形にまとめる。 */
export function summarizeEventDraftForLog(draft: ValidatedEventDraft): Record<string, unknown> {
  return {
    eventType: draft.event_type,
    summary: draft.summary,
    involvesMagic: draft.involves_magic,
    relatedPersonCount: draft.related_person_ids.length,
    newPeople: draft.new_people.map((p) => p.name),
    relatedOrganizationCount: draft.related_organization_ids.length,
    newOrganizations: draft.new_organizations.map((o) => o.name),
    newFacilities: draft.new_facilities.map((f) => f.name),
    newCity: draft.new_city ? draft.new_city.name : null,
    weather: draft.weather,
    stateChanges: draft.state_changes,
  };
}

export interface ValidatedNewsDraft {
  title: string;
  body: string;
  category: string;
}

const ALLOWED_CATEGORIES = new Set<string>(NEWS_CATEGORIES);

export function validateNewsDraft(raw: unknown): ValidatedNewsDraft | null {
  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  const title = cleanText(obj.title, MAX_TITLE);
  const body = cleanText(obj.body, MAX_BODY);
  if (!title || !body) return null;
  const categoryRaw = cleanText(obj.category, 10);
  const category = ALLOWED_CATEGORIES.has(categoryRaw) ? categoryRaw : "社会";
  return { title, body, category };
}
