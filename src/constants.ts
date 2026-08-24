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

export const ORG_STATUSES = [
  "active",
  "expanding",
  "under_investigation",
  "recovering",
  "celebrating",
  "bankrupt",
] as const;
export type OrgStatus = (typeof ORG_STATUSES)[number];

export const ORG_KINDS = ["company", "government", "school", "other"] as const;
export type OrgKind = (typeof ORG_KINDS)[number];

// draft: 管理画面で作成済みだが、まだ生成対象に含めない都市。
// active: 今後のシミュレーション生成で使用される都市。
export const CITY_STATUSES = ["active", "draft"] as const;
export type CityStatus = (typeof CITY_STATUSES)[number];

export const WEATHER_CONDITIONS = [
  "晴れ",
  "曇り",
  "雨",
  "雷雨",
  "霧",
  "雪",
  "強風",
  "魔力嵐",
] as const;
export type WeatherCondition = (typeof WEATHER_CONDITIONS)[number];
