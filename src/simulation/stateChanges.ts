// イベント/ニュースに伴う「世界状態への影響」を実際にDBへ適用する共通処理。
// 通常の日次シミュレーション(runDailySimulation)だけでなく、管理画面からの
// AI補助作成・完全手動作成でも同じ適用ルールを使う。

import type { Env } from "../types";
import { previousEconomicValue } from "../db/queries";
import type { StateChange } from "./validate";

const now = () => new Date().toISOString();

/**
 * state_changesを実際に適用する。
 * person_status は relatedPeopleIds に含まれる人物のみ対象（無関係な人物への
 * 波及を防ぐ安全策）。organization_status が bankrupt になった場合は、
 * そこに勤めていた人物を無所属に戻す。economic_stock_price は直近値の
 * 0.5〜2倍の範囲にクランプする。
 */
export async function applyStateChanges(
  env: Env,
  changes: StateChange[],
  targetDate: string,
  relatedPeopleIds: number[]
): Promise<Record<string, unknown>[]> {
  const appliedImpact: Record<string, unknown>[] = [];

  for (const change of changes) {
    if (change.type === "person_status") {
      if (relatedPeopleIds.includes(change.target_id)) {
        await env.DB.prepare("UPDATE people SET status = ?, updated_at = ? WHERE id = ?")
          .bind(change.value, now(), change.target_id)
          .run();
        appliedImpact.push(change);
      }
    } else if (change.type === "organization_status") {
      await env.DB.prepare("UPDATE organizations SET status = ?, updated_at = ? WHERE id = ?")
        .bind(change.value, now(), change.target_id)
        .run();
      if (change.value === "bankrupt") {
        await env.DB.prepare("UPDATE people SET organization_id = NULL, updated_at = ? WHERE organization_id = ?")
          .bind(now(), change.target_id)
          .run();
      }
      appliedImpact.push(change);
    } else if (change.type === "economic_stock_price") {
      const prev = await previousEconomicValue(env, change.target_id, "stock_price", targetDate);
      let value = change.value;
      if (prev) {
        const min = prev.value * 0.5;
        const max = prev.value * 2;
        value = Math.min(Math.max(value, min), max);
      } else {
        value = Math.min(value, 1_000_000);
      }
      await env.DB.prepare(
        "INSERT INTO economic_data (world_date, organization_id, metric, value, created_at) VALUES (?, ?, 'stock_price', ?, ?)"
      )
        .bind(targetDate, change.target_id, value, now())
        .run();
      appliedImpact.push({ ...change, applied_value: value });
    }
  }

  return appliedImpact;
}
