// 新しい都市を作成した直後に、住宅街+商店街の施設を自動生成する共通処理。
// 管理画面からの手動作成(index.ts)・イベントAIによる自動作成(runDailySimulation.ts)の
// どちらからも同じロジックを使う（「新都市の各施設単位で表示されるべき」という方針、7章参照）。

import type { Env } from "../types";
import { createFacility } from "../db/queries";
import { assignZonePositionForCity } from "../views/mapZones";

export async function seedStarterFacilities(
  env: Env,
  cityId: number,
  cityName: string,
  anchor: { x: number; y: number }
): Promise<void> {
  const cityRef = { id: cityId, map_x: anchor.x, map_y: anchor.y };
  const seededPoints: { x: number; y: number }[] = [];
  const starters = [
    { name: `${cityName}住宅街`, kind: "residential" },
    { name: `${cityName}商店街`, kind: "shopping_street" },
  ];
  for (const starter of starters) {
    const pos = assignZonePositionForCity(cityRef, seededPoints);
    await createFacility(env, {
      name: starter.name,
      kind: starter.kind,
      city_id: cityId,
      description: null,
      map_x: pos.x,
      map_y: pos.y,
    });
    seededPoints.push(pos);
  }
}
