// 毎朝8:00(JST)に、前日(JST calendar day)に公開されたニュースをAIでざっくり要約し、
// ニュース一覧ページへのリンクを添えてXへ投稿する機能。
// Cronのタイミングはindex.tsのscheduled()、投稿の実処理はここに集約する。

import type { Env, NewsRow } from "../types";
import { listNewsByPublishedRange } from "../db/queries";
import { callAiForText } from "../simulation/ai";
import { postTweet } from "./xClient";
import { SITE_URL } from "../constants";

// Xは「等幅でない言語(日本語含む)」の文字を2文字分としてカウントし、URLは実際の長さに関わらず
// 常にt.co短縮後の23文字として数える。この近似ルールで安全側(厳しめ)に文字数を見積もる。
const TWEET_WEIGHT_LIMIT = 280;
const URL_WEIGHT = 23;

function isWideChar(codePoint: number): boolean {
  return (
    (codePoint >= 0x3000 && codePoint <= 0x30ff) || // 全角記号・ひらがな・カタカナ
    (codePoint >= 0x3400 && codePoint <= 0x4dbf) || // CJK拡張A
    (codePoint >= 0x4e00 && codePoint <= 0x9fff) || // CJK統合漢字
    (codePoint >= 0xf900 && codePoint <= 0xfaff) || // CJK互換漢字
    (codePoint >= 0xff00 && codePoint <= 0xffef) // 全角英数・記号
  );
}

function weightedLength(text: string): number {
  let total = 0;
  for (const ch of text) total += isWideChar(ch.codePointAt(0) ?? 0) ? 2 : 1;
  return total;
}

function truncateToWeight(text: string, maxWeight: number): string {
  const reserve = 2; // 省略記号「…」の分の余白
  let total = 0;
  let result = "";
  let truncated = false;
  for (const ch of text) {
    const w = isWideChar(ch.codePointAt(0) ?? 0) ? 2 : 1;
    if (total + w > maxWeight - reserve) {
      truncated = true;
      break;
    }
    total += w;
    result += ch;
  }
  return truncated ? result + "…" : result;
}

function sanitizeSummary(text: string): string {
  return text
    .replace(/\s*\n\s*/g, " ")
    .replace(/#\S+/g, "")
    .replace(/^[「『"']+|[」』"']+$/g, "")
    .trim();
}

function buildFallbackSummary(newsList: NewsRow[]): string {
  const titles = newsList.slice(0, 3).map((n) => n.title).join("、");
  return newsList.length > 3 ? `${titles}など、${newsList.length}件のニュースがありました。` : `${titles}。`;
}

/**
 * 「昨日」をJSTの暦日として計算し、対応するUTC範囲(published_at比較用)を返す。
 * Workersのnew Date()は常にUTCなので、9時間を足し引きしてJSTの日付境界を求める
 * （formatDateTimeJaと同じ「UTCゲッターでJST時刻を読む」トリック）。
 */
export function computeYesterdayJstRangeUtc(now: Date = new Date()): {
  startIso: string;
  endIso: string;
  dateLabel: string;
} {
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = jstNow.getUTCFullYear();
  const m = jstNow.getUTCMonth();
  const d = jstNow.getUTCDate();
  const todayJstMidnightUtcMs = Date.UTC(y, m, d, 0, 0, 0) - 9 * 60 * 60 * 1000;
  const startMs = todayJstMidnightUtcMs - 24 * 60 * 60 * 1000;
  const endMs = todayJstMidnightUtcMs;
  const yesterdayJst = new Date(startMs + 9 * 60 * 60 * 1000);
  const dateLabel = `${yesterdayJst.getUTCMonth() + 1}月${yesterdayJst.getUTCDate()}日`;
  return { startIso: new Date(startMs).toISOString(), endIso: new Date(endMs).toISOString(), dateLabel };
}

export interface DailyDigestResult {
  posted: boolean;
  reason?: string;
  tweetText?: string;
  newsCount?: number;
}

export async function postDailyNewsDigest(env: Env, now: Date = new Date()): Promise<DailyDigestResult> {
  const { startIso, endIso, dateLabel } = computeYesterdayJstRangeUtc(now);
  const newsResult = await listNewsByPublishedRange(env, startIso, endIso);
  const newsList = newsResult.results ?? [];
  if (newsList.length === 0) {
    return { posted: false, reason: "対象期間の記事が0件だったため投稿をスキップしました" };
  }

  const titleLines = newsList
    .slice(0, 20)
    .map((n, i) => `${i + 1}. [${n.category}] ${n.title}`)
    .join("\n");

  const systemPrompt =
    "あなたはニュースサイト「モーゼン・クロニクル」のSNS担当です。渡された前日の記事タイトル一覧から、" +
    "読者が「昨日はどんな一日だったか」をざっくり掴める1〜2文の日本語の紹介文を書いてください。" +
    "見出しの単純な列挙ではなく、自然な文章にすること。誇張しすぎず、興味を引く程度の軽いトーンで。" +
    "ハッシュタグ・絵文字・鉤括弧での引用は使わず、本文だけを出力してください。";
  const userPrompt = `【${dateLabel}の記事一覧】\n${titleLines}`;

  const ai = await callAiForText(env, env.AI_NEWS_MODEL, systemPrompt, userPrompt, 200);
  const summary = ai.ok && ai.raw ? sanitizeSummary(ai.raw) : buildFallbackSummary(newsList);

  const prefix = `【モーゼン・クロニクル】${dateLabel}のニュースまとめ\n`;
  const separator = "\n\n";
  const url = `${SITE_URL}/news`;
  const budget = TWEET_WEIGHT_LIMIT - weightedLength(prefix) - weightedLength(separator) - URL_WEIGHT - 5;
  const trimmedSummary = truncateToWeight(summary, Math.max(budget, 20));
  const tweetText = `${prefix}${trimmedSummary}${separator}${url}`;

  const result = await postTweet(env, tweetText);
  if (!result.ok) {
    console.error("X daily digest post failed", result.error);
    return { posted: false, reason: result.error, tweetText, newsCount: newsList.length };
  }
  return { posted: true, tweetText, newsCount: newsList.length };
}
