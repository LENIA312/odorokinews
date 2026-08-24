// 「街の様子」ページ用の、ダイナン市の簡易ゾーン配置。
// 実在の地理データではなく、docs.mdの世界設定に基づく抽象的な模式図として扱う。
// 座標はSVG viewBox "0 0 800 480" 上の位置。
//
// 道路は5列×3行の格子（グリッド）として敷き、各施設はその交差点上に置く。
// 移動はハブに集約せず、出発地の行→目的地の列（Lの字）で格子上を移動する。

import type { PersonRow } from "../types";

export interface Zone {
  id: string;
  label: string;
  x: number;
  y: number;
  kind: "org" | "residential" | "other";
}

export const GRID_COLS = [100, 260, 420, 580, 720];
export const GRID_ROWS = [70, 190, 310];

export const ZONES: Zone[] = [
  { id: "residential_n", label: "住宅街・北", x: GRID_COLS[1], y: GRID_ROWS[0], kind: "residential" },
  { id: "park", label: "中央公園", x: GRID_COLS[2], y: GRID_ROWS[0], kind: "other" },
  { id: "hospital", label: "ダイナン中央病院", x: GRID_COLS[3], y: GRID_ROWS[0], kind: "org" },
  { id: "soukai_hq", label: "蒼海重工本社", x: GRID_COLS[4], y: GRID_ROWS[0], kind: "org" },

  { id: "university", label: "ダイナン工科大学", x: GRID_COLS[0], y: GRID_ROWS[1], kind: "other" },
  { id: "city_hall", label: "ダイナン市役所", x: GRID_COLS[2], y: GRID_ROWS[1], kind: "org" },
  { id: "shopping_street", label: "商店街", x: GRID_COLS[3], y: GRID_ROWS[1], kind: "other" },
  { id: "dragon_terminal", label: "翼竜急便ターミナル", x: GRID_COLS[4], y: GRID_ROWS[1], kind: "org" },

  { id: "fairy_center", label: "妖精人材センター", x: GRID_COLS[0], y: GRID_ROWS[2], kind: "org" },
  { id: "residential_s", label: "住宅街・南", x: GRID_COLS[2], y: GRID_ROWS[2], kind: "residential" },
  { id: "moonlight_plant", label: "ムーンライト魔法発電", x: GRID_COLS[3], y: GRID_ROWS[2], kind: "org" },
  { id: "residential_e", label: "住宅街・東", x: GRID_COLS[4], y: GRID_ROWS[2], kind: "residential" },
];

// 現状のseed.sqlで作成される組織ID(1〜6)に対応するゾーン。
// 組織の並びが変わった場合はここも合わせて更新する。
export const ORG_ZONE_BY_ID: Record<number, string> = {
  1: "city_hall",
  2: "soukai_hq",
  3: "moonlight_plant",
  4: "hospital",
  5: "dragon_terminal",
  6: "fairy_center",
};

const RESIDENTIAL_ZONES = ["residential_n", "residential_s", "residential_e"];

function hashToIndex(id: number, mod: number): number {
  // idをそのまま使うと隣接IDが同じゾーンに固まりやすいので、簡単に散らす。
  return (id * 2654435761) % mod;
}

export interface PersonZoneAssignment {
  id: number;
  name: string;
  occupation: string | null;
  status: string;
  homeZone: string;
  workZone: string;
}

export function assignPersonZones(people: PersonRow[]): PersonZoneAssignment[] {
  return people.map((p) => {
    const homeIndex = Math.abs(hashToIndex(p.id, RESIDENTIAL_ZONES.length));
    const homeZone = RESIDENTIAL_ZONES[homeIndex];

    let workZone: string;
    if (p.organization_id && ORG_ZONE_BY_ID[p.organization_id]) {
      workZone = ORG_ZONE_BY_ID[p.organization_id];
    } else {
      const occ = p.occupation ?? "";
      if (occ.includes("学生")) {
        workZone = "university";
      } else if (occ.includes("主婦") || occ.includes("主夫") || occ === "無職") {
        workZone = homeZone;
      } else {
        workZone = "shopping_street";
      }
    }

    return {
      id: p.id,
      name: p.name,
      occupation: p.occupation,
      status: p.status,
      homeZone,
      workZone,
    };
  });
}
