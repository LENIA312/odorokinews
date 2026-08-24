// サイト全体で共有する定数。追加・変更はここだけで管理する。
export const NEWS_CATEGORIES = ["社会", "経済", "政治", "事故", "文化", "科学", "魔法", "スポーツ"] as const;
export type NewsCategory = (typeof NEWS_CATEGORIES)[number];

export const PERSON_STATUSES = [
  "alive",
  "injured",
  "hospitalized",
  "deceased",
  "celebrating",
  "under_investigation",
] as const;
export type PersonStatus = (typeof PERSON_STATUSES)[number];

export const ORG_STATUSES = ["active", "expanding", "under_investigation", "recovering", "celebrating"] as const;
export type OrgStatus = (typeof ORG_STATUSES)[number];
