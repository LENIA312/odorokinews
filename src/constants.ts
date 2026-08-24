// サイト全体で共有する定数。追加・変更はここだけで管理する。
export const NEWS_CATEGORIES = ["社会", "経済", "政治", "事故", "文化", "科学", "魔法", "スポーツ"] as const;
export type NewsCategory = (typeof NEWS_CATEGORIES)[number];

export const PERSON_STATUSES = [
  "alive",
  "sick",
  "injured",
  "hospitalized",
  "deceased",
  "celebrating",
  "under_investigation",
] as const;
export type PersonStatus = (typeof PERSON_STATUSES)[number];

export const PERSON_STATUS_LABEL: Record<string, string> = {
  alive: "健康",
  sick: "療養中",
  injured: "負傷",
  hospitalized: "入院中",
  deceased: "故人",
  celebrating: "話題の人物",
  under_investigation: "調査中",
};

// 家系図・人間関係で使う関係性の種類。person_id視点での表現で、
// 1つの関係を作るときは必ず両方向の行(例: family_parent⇔family_child)を挿入する。
export const RELATION_TYPES = [
  "family_parent",
  "family_child",
  "family_sibling",
  "spouse",
  "colleague",
  "friend",
] as const;
export type RelationType = (typeof RELATION_TYPES)[number];

// 逆方向の関係。関係を1件削除する際、対になっているもう片方の行を特定するために使う。
export const RELATION_TYPE_REVERSE: Record<string, string> = {
  family_parent: "family_child",
  family_child: "family_parent",
  family_sibling: "family_sibling",
  spouse: "spouse",
  colleague: "colleague",
  friend: "friend",
};

export const RELATION_TYPE_LABEL: Record<string, string> = {
  family_parent: "親",
  family_child: "子",
  family_sibling: "兄弟姉妹",
  spouse: "配偶者",
  colleague: "同僚",
  friend: "友人",
};

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

// 施設(雇用主ではない公共・生活系のゾーン)の種別。住宅街・大学・公園・商店街は
// 従来mapZones.tsにハードコードしていたダイナン市の固定ゾーンをこのkindへ移行したもの。
export const FACILITY_KINDS = ["residential", "university", "park", "shopping_street", "other"] as const;
export type FacilityKind = (typeof FACILITY_KINDS)[number];

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
