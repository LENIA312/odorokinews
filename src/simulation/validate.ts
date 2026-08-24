// AI出力を世界ルールに照らして検証・サニタイズする。
// 「存在しない人物/企業の参照」「固定設定の変更」などを検出し、
// 不正な部分だけを取り除いて安全な構造化データにする（docs.md 21章）。

import { NEWS_CATEGORIES } from "../constants";

export interface NewPersonDraft {
  name: string;
  name_kana: string | null;
  age: number | null;
  gender: string | null;
  occupation: string | null;
  organization_id: number | null;
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
  state_changes: StateChange[];
}

const MAX_TEXT = 600;
const MAX_SUMMARY = 200;
const MAX_TITLE = 120;
const MAX_BODY = 4000;
const MAX_RELATED_PEOPLE = 6;
const MAX_RELATED_ORGS = 4;
const MAX_STATE_CHANGES = 6;
const ALLOWED_STATUS = new Set(["alive", "injured", "hospitalized", "deceased", "celebrating", "under_investigation"]);
const ALLOWED_ORG_STATUS = new Set(["active", "expanding", "under_investigation", "recovering", "celebrating"]);

function cleanText(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export function validateEventDraft(
  raw: unknown,
  allowedPersonIds: Set<number>,
  allowedOrgIds: Set<number>
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
        newPeople.push({
          name,
          name_kana: nameKana,
          age,
          gender: cleanText(n.gender, 20) || null,
          occupation: cleanText(n.occupation, 40) || null,
          organization_id: orgId,
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

  const stateChanges: StateChange[] = [];
  if (Array.isArray(obj.state_changes)) {
    for (const rawChange of obj.state_changes.slice(0, MAX_STATE_CHANGES)) {
      if (typeof rawChange !== "object" || rawChange === null) continue;
      const c = rawChange as Record<string, unknown>;
      if (!isFiniteNumber(c.target_id)) continue;

      if (c.type === "person_status") {
        const value = cleanText(c.value, 30);
        if (ALLOWED_STATUS.has(value) && (allowedPersonIds.has(c.target_id) || relatedPersonIds.includes(c.target_id))) {
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
  }

  return {
    event_type: eventType,
    summary,
    detail: detail || summary,
    involves_magic: obj.involves_magic === true,
    related_person_ids: relatedPersonIds,
    new_people: newPeople,
    related_organization_ids: relatedOrgIds,
    state_changes: stateChanges,
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
