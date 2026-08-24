// 「街の様子」ページ用の、ダイナン市のゾーン配置。
// 実在の地理データではなく、docs.mdの世界設定に基づく抽象的な模式図として扱う。
//
// 住宅街・大学・公園・商店街は固定ゾーンとしてここにハードコードする。
// 企業・行政などの組織ゾーンは organizations テーブル(map_x/map_y)を基に
// 動的に構築し、新しい企業が追加されるたびに地図が自動的に広がっていく。

import type { CityRow, OrganizationRow, PersonRow } from "../types";

export interface Zone {
  id: string;
  label: string;
  x: number;
  y: number;
  kind: "org" | "residential" | "other" | "city";
  status?: string; // org/cityゾーンのみ。'active'以外なら地図上にリングを表示する。
}

export const FIXED_ZONES: Zone[] = [
  { id: "university", label: "ダイナン工科大学", x: 280, y: 220, kind: "other" },
  { id: "residential_n", label: "住宅街・北", x: 380, y: 480, kind: "residential" },
  { id: "shopping_street", label: "商店街", x: 820, y: 470, kind: "other" },
  { id: "park", label: "中央公園", x: 980, y: 240, kind: "other" },
  { id: "residential_e", label: "住宅街・東", x: 960, y: 610, kind: "residential" },
  { id: "residential_s", label: "住宅街・南", x: 630, y: 760, kind: "residential" },
];

// 固定ゾーン同士、および創業当初からの6組織を結ぶ道路網。
// 創業6組織は org-<id> ではなく歴史的な固定IDのまま扱う
// （すでにmigrationで座標をorganizationsテーブル側にも複製済み）。
export const FIXED_EDGES: [string, string][] = [
  ["university", "residential_n"],
  ["residential_n", "org-1"],
  ["org-1", "org-4"],
  ["org-1", "org-6"],
  ["org-1", "shopping_street"],
  ["org-4", "park"],
  ["org-6", "park"],
  ["shopping_street", "residential_e"],
  ["shopping_street", "org-2"],
  ["residential_e", "org-3"],
  ["residential_e", "org-5"],
  ["org-2", "org-5"],
  ["residential_s", "org-1"],
  ["residential_s", "org-3"],
];

export function orgZoneId(orgId: number): string {
  return `org-${orgId}`;
}

export function cityZoneId(cityId: number): string {
  return `city-${cityId}`;
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * 既存ゾーン群の外側に、新しい組織ゾーンの座標を自動的に割り当てる。
 * 「マップのエリア拡大も積極的に行う」ため、既存の範囲の外へ広げていく。
 */
export function assignNewOrgPosition(existingZones: { x: number; y: number }[]): { x: number; y: number } {
  if (existingZones.length === 0) return { x: 650, y: 430 };

  const xs = existingZones.map((z) => z.x);
  const ys = existingZones.map((z) => z.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const baseRadius = Math.max(maxX - minX, maxY - minY) / 2 + 220;

  for (let attempt = 0; attempt < 32; attempt++) {
    const angle = ((attempt * 53) % 360) * (Math.PI / 180);
    const radius = baseRadius + Math.floor(attempt / 8) * 200;
    const x = Math.round(cx + Math.cos(angle) * radius);
    const y = Math.round(cy + Math.sin(angle) * radius * 0.6);
    const tooClose = existingZones.some((z) => distance(z, { x, y }) < 170);
    if (!tooClose) return { x, y };
  }
  return { x: Math.round(cx + baseRadius), y: Math.round(cy) };
}

/**
 * 既存ゾーン群の外側に、新しい都市の座標を自動的に割り当てる。
 * 都市は組織1件よりずっと大きな区画なので、間隔を広めに取って
 * 既存の街並みと視覚的にはっきり分かれる位置に配置する。
 */
export function assignNewCityPosition(existingPoints: { x: number; y: number }[]): { x: number; y: number } {
  if (existingPoints.length === 0) return { x: 650, y: 430 };

  const xs = existingPoints.map((z) => z.x);
  const ys = existingPoints.map((z) => z.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const baseRadius = Math.max(maxX - minX, maxY - minY) / 2 + 500;

  for (let attempt = 0; attempt < 32; attempt++) {
    const angle = ((attempt * 71) % 360) * (Math.PI / 180);
    const radius = baseRadius + Math.floor(attempt / 8) * 400;
    const x = Math.round(cx + Math.cos(angle) * radius);
    const y = Math.round(cy + Math.sin(angle) * radius * 0.6);
    const tooClose = existingPoints.some((z) => distance(z, { x, y }) < 400);
    if (!tooClose) return { x, y };
  }
  return { x: Math.round(cx + baseRadius), y: Math.round(cy) };
}

/** 新しいゾーンを、最も近い既存ゾーンへの1本の道でつなぐ。 */
export function nearestZoneId(point: { x: number; y: number }, zones: Zone[]): string | null {
  let best: Zone | null = null;
  let bestDist = Infinity;
  for (const z of zones) {
    const d = distance(point, z);
    if (d < bestDist) {
      bestDist = d;
      best = z;
    }
  }
  return best ? best.id : null;
}

/** organizations テーブルの内容から、組織ゾーンの一覧を構築する。 */
export function buildOrgZones(organizations: OrganizationRow[]): Zone[] {
  return organizations
    .filter((o) => o.map_x != null && o.map_y != null)
    .map((o) => ({
      id: orgZoneId(o.id),
      label: o.name,
      x: o.map_x as number,
      y: o.map_y as number,
      kind: "org" as const,
      status: o.status,
    }));
}

/**
 * cities テーブルの内容から、都市ゾーンの一覧を構築する。
 * 首都ダイナン市(id=1)は既存の街並み全体がその表現なので対象外とし、
 * それ以外の都市だけを地図上のランドマークとして表示する。
 */
export function buildCityZones(cities: CityRow[]): Zone[] {
  return cities
    .filter((c) => c.id !== 1 && c.map_x != null && c.map_y != null)
    .map((c) => ({
      id: cityZoneId(c.id),
      label: c.name,
      x: c.map_x as number,
      y: c.map_y as number,
      kind: "city" as const,
      status: c.status,
    }));
}

/** 固定ゾーン+組織ゾーン+都市ゾーンを合わせた全ゾーン一覧を返す。 */
export function buildAllZones(organizations: OrganizationRow[], cities: CityRow[] = []): Zone[] {
  return [...FIXED_ZONES, ...buildOrgZones(organizations), ...buildCityZones(cities)];
}

/**
 * FIXED_EDGESに加え、創業6組織以外の組織ゾーン・追加された都市ゾーンについては
 * 最寄りのゾーンへ自動的に道をつなぐ。
 */
export function buildAllEdges(
  zones: Zone[],
  organizations: OrganizationRow[],
  cities: CityRow[] = []
): [string, string][] {
  const fixedOrgIds = new Set(FIXED_EDGES.flatMap((e) => e));
  const edges: [string, string][] = [...FIXED_EDGES];
  const placed: Zone[] = [...FIXED_ZONES];

  // FIXED_EDGESに登場する創業組織ゾーンを先に「配置済み」として扱う。
  for (const org of organizations) {
    const zid = orgZoneId(org.id);
    if (fixedOrgIds.has(zid)) {
      const z = zones.find((zz) => zz.id === zid);
      if (z) placed.push(z);
    }
  }

  for (const org of organizations) {
    const zid = orgZoneId(org.id);
    if (fixedOrgIds.has(zid)) continue; // 創業組織はFIXED_EDGESで接続済み
    const zone = zones.find((z) => z.id === zid);
    if (!zone) continue;
    const nearest = nearestZoneId(zone, placed);
    if (nearest) edges.push([zid, nearest]);
    placed.push(zone);
  }

  for (const city of cities) {
    if (city.id === 1) continue;
    const zid = cityZoneId(city.id);
    const zone = zones.find((z) => z.id === zid);
    if (!zone) continue;
    const nearest = nearestZoneId(zone, placed);
    if (nearest) edges.push([zid, nearest]);
    placed.push(zone);
  }

  return edges;
}

const RESIDENTIAL_ZONES = ["residential_n", "residential_s", "residential_e"];

function hashToIndex(id: number, mod: number): number {
  // idをそのまま使うと隣接IDが同じゾーンに固まりやすいので、簡単に散らす。
  return (id * 2654435761) % mod;
}

export interface PersonZoneAssignment {
  id: number;
  name: string;
  name_kana: string | null;
  occupation: string | null;
  status: string;
  homeZone: string;
  workZone: string;
}

export function assignPersonZones(people: PersonRow[]): PersonZoneAssignment[] {
  return people.map((p) => {
    // ダイナン市(id=1)以外の都市の住民は、まだ専用の住宅街ゾーンを
    // 持たないため、所属先がなければその都市のランドマークを拠点として扱う。
    const inMainCity = !p.city_id || p.city_id === 1;
    const homeIndex = Math.abs(hashToIndex(p.id, RESIDENTIAL_ZONES.length));
    const homeZone = inMainCity ? RESIDENTIAL_ZONES[homeIndex] : cityZoneId(p.city_id as number);

    let workZone: string;
    if (p.organization_id) {
      workZone = orgZoneId(p.organization_id);
    } else if (!inMainCity) {
      workZone = homeZone;
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
      name_kana: p.name_kana,
      occupation: p.occupation,
      status: p.status,
      homeZone,
      workZone,
    };
  });
}
