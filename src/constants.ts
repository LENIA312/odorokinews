// サイト全体で共有する定数。カテゴリの追加・変更はここだけで管理する。
export const NEWS_CATEGORIES = ["社会", "経済", "政治", "事故", "文化", "科学", "魔法", "スポーツ"] as const;
export type NewsCategory = (typeof NEWS_CATEGORIES)[number];
