// サイト全体で共有する定数。追加・変更はここだけで管理する。

// X(旧Twitter)への日次まとめ投稿など、外部に絶対URLを提示する必要がある箇所で使う。
// カスタムドメインを変更した場合はここだけ書き換えればよい。
export const SITE_URL = "https://mosen-chronicle.pisorium.com";

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

export const ORG_STATUS_LABEL: Record<string, string> = {
  active: "通常",
  expanding: "拡大中",
  under_investigation: "調査中",
  recovering: "回復中",
  celebrating: "好調",
  bankrupt: "倒産",
};

export const ORG_KINDS = ["company", "government", "school", "other"] as const;
export type OrgKind = (typeof ORG_KINDS)[number];

export const ORG_KIND_LABEL: Record<string, string> = {
  company: "企業",
  government: "行政",
  school: "学校",
  other: "その他",
};

// 施設(雇用主ではない公共・生活系のゾーン)の種別。住宅街・大学・公園・商店街は
// 従来mapZones.tsにハードコードしていたダイナン市の固定ゾーンをこのkindへ移行したもの。
export const FACILITY_KINDS = ["residential", "university", "park", "shopping_street", "other"] as const;
export type FacilityKind = (typeof FACILITY_KINDS)[number];

export const FACILITY_KIND_LABEL: Record<string, string> = {
  residential: "住宅街",
  university: "大学",
  park: "公園",
  shopping_street: "商店街",
  other: "その他",
};

// draft: 管理画面で作成済みだが、まだ生成対象に含めない都市。
// active: 今後のシミュレーション生成で使用される都市。
export const CITY_STATUSES = ["active", "draft"] as const;
export type CityStatus = (typeof CITY_STATUSES)[number];

export const CITY_STATUS_LABEL: Record<string, string> = {
  active: "稼働中",
  draft: "準備中",
};

// 性別はAIが自由記述で生成する項目のため、DB上は英語の代表値(male/female/other)に
// 揃わない自由文字列が入る可能性がある。GENDER_OPTIONSは管理画面のプルダウンで
// 使う既知の選択肢、GENDER_LABELは表示用の変換（未知の値は元の文字列をそのまま出す）。
export const GENDER_OPTIONS = ["male", "female", "other"] as const;
export type Gender = (typeof GENDER_OPTIONS)[number];

export const GENDER_LABEL: Record<string, string> = {
  male: "男性",
  female: "女性",
  other: "その他",
};

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
