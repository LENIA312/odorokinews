// 世界暦(world.current_date)を、ニュース配信とは完全に独立して「現実1時間ごとに1日」進める
// ティッカー。マップの人物アニメーション(map.tsのDAY_SECONDS=3600)・ヘッダーの時計と
// 同じ「現実1時間=世界の1日」というレートに合わせてある。
// 以前は日付がニュース配信のたびに+1されていたため、配信間隔がそのまま世界の1日の長さになって
// しまい、「投稿しないと日付が変わらない」という不自然な挙動になっていた。

import type { Env } from "../types";
import { getWorld } from "../db/queries";
import { nextWorldDate } from "../utils/date";

const HOUR_MS = 60 * 60 * 1000;

export interface WorldClockTickResult {
  advanced: boolean;
  daysAdvanced: number;
  newDate: string;
}

/**
 * 前回のtickからHOUR_MS以上経過していれば世界暦を進める。複数時間分たまっていた場合は
 * まとめて進め、基準時刻(last_date_tick_at)も経過した時間分だけ進めることでズレを
 * 蓄積させない（次回呼び出し時に端数が正しく引き継がれる）。
 */
export async function tickWorldDate(env: Env): Promise<WorldClockTickResult> {
  const world = await getWorld(env);
  if (!world) return { advanced: false, daysAdvanced: 0, newDate: "" };

  const lastTickAt = world.last_date_tick_at
    ? new Date(world.last_date_tick_at).getTime()
    : new Date(world.updated_at).getTime();
  const elapsed = Date.now() - lastTickAt;
  const daysAdvanced = Math.floor(elapsed / HOUR_MS);
  if (daysAdvanced <= 0) {
    return { advanced: false, daysAdvanced: 0, newDate: world.current_date };
  }

  let newDate = world.current_date;
  for (let i = 0; i < daysAdvanced; i++) newDate = nextWorldDate(newDate);
  const newTickAt = new Date(lastTickAt + daysAdvanced * HOUR_MS).toISOString();

  await env.DB.prepare("UPDATE world SET current_date = ?, last_date_tick_at = ?, updated_at = ? WHERE id = 1")
    .bind(newDate, newTickAt, new Date().toISOString())
    .run();

  return { advanced: true, daysAdvanced, newDate };
}
