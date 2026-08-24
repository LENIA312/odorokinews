// 「街の様子」ページ用の、ダイナン市の簡易ゾーン配置。
// 実在の地理データではなく、docs.mdの世界設定に基づく抽象的な模式図として扱う。
// 座標はSVG viewBox "0 0 1400 900" 上の位置。
//
// 格子状の道路ではなく、施設同士を直接結ぶ道のネットワーク（グラフ）として
// 表現する。人物はこのグラフ上を最短経路で移動する。

import type { PersonRow } from "../types";

export interface Zone {
  id: string;
  label: string;
  x: number;
  y: number;
  kind: "org" | "residential" | "other";
}

export const ZONES: Zone[] = [
  { id: "university", label: "ダイナン工科大学", x: 280, y: 220, kind: "other" },
  { id: "residential_n", label: "住宅街・北", x: 380, y: 480, kind: "residential" },
  { id: "city_hall", label: "ダイナン市役所", x: 650, y: 430, kind: "org" },
  { id: "hospital", label: "ダイナン中央病院", x: 560, y: 260, kind: "org" },
  { id: "fairy_center", label: "妖精人材センター", x: 700, y: 260, kind: "org" },
  { id: "shopping_street", label: "商店街", x: 820, y: 470, kind: "other" },
  { id: "park", label: "中央公園", x: 980, y: 240, kind: "other" },
  { id: "soukai_hq", label: "蒼海重工本社", x: 1180, y: 400, kind: "org" },
  { id: "dragon_terminal", label: "翼竜急便ターミナル", x: 1230, y: 610, kind: "org" },
  { id: "residential_e", label: "住宅街・東", x: 960, y: 610, kind: "residential" },
  { id: "moonlight_plant", label: "ムーンライト魔法発電", x: 1060, y: 760, kind: "org" },
  { id: "residential_s", label: "住宅街・南", x: 630, y: 760, kind: "residential" },
];

// 道路網（グラフの辺）。格子ではなく施設同士を直接結ぶ。
// [ゾーンA, ゾーンB, 川を橋で渡るか]
export const ROAD_EDGES: [string, string, boolean?][] = [
  ["university", "residential_n"],
  ["residential_n", "city_hall"],
  ["city_hall", "hospital"],
  ["city_hall", "fairy_center"],
  ["city_hall", "shopping_street"],
  ["hospital", "park"],
  ["fairy_center", "park"],
  ["shopping_street", "residential_e"],
  ["shopping_street", "soukai_hq", true],
  ["residential_e", "moonlight_plant"],
  ["residential_e", "dragon_terminal", true],
  ["soukai_hq", "dragon_terminal"],
  ["residential_s", "city_hall"],
  ["residential_s", "moonlight_plant"],
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
