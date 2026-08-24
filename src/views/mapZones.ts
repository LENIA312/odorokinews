// 「街の様子」ページ用の、ダイナン市の簡易ゾーン配置。
// 実在の地理データではなく、docs.mdの世界設定に基づく抽象的な模式図として扱う。
// 座標はSVG viewBox "0 0 800 480" 上の位置。

import type { PersonRow } from "../types";

export interface Zone {
  id: string;
  label: string;
  x: number;
  y: number;
  kind: "org" | "residential" | "other";
}

// 全ての移動はここを経由する「町の中心交差点」。道が集まる基点として使う。
export const HUB = { x: 440, y: 250 };

export const ZONES: Zone[] = [
  { id: "city_hall", label: "ダイナン市役所", x: 400, y: 220, kind: "org" },
  { id: "soukai_hq", label: "蒼海重工本社", x: 560, y: 150, kind: "org" },
  { id: "moonlight_plant", label: "ムーンライト魔法発電", x: 620, y: 320, kind: "org" },
  { id: "hospital", label: "ダイナン中央病院", x: 300, y: 130, kind: "org" },
  { id: "dragon_terminal", label: "翼竜急便ターミナル", x: 660, y: 90, kind: "org" },
  { id: "fairy_center", label: "妖精人材センター", x: 250, y: 320, kind: "org" },
  { id: "residential_n", label: "住宅街・北", x: 200, y: 60, kind: "residential" },
  { id: "residential_s", label: "住宅街・南", x: 420, y: 420, kind: "residential" },
  { id: "residential_e", label: "住宅街・東", x: 700, y: 400, kind: "residential" },
  { id: "shopping_street", label: "商店街", x: 470, y: 300, kind: "other" },
  { id: "university", label: "ダイナン工科大学", x: 130, y: 200, kind: "other" },
  { id: "park", label: "中央公園", x: 350, y: 330, kind: "other" },
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
