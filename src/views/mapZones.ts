// 「街の様子」ページ用の、都市ごとのゾーン配置。
// 実在の地理データではなく、docs.mdの世界設定に基づく抽象的な模式図として扱う。
//
// 地図上のゾーンは2種類のDBテーブルから動的に構築する:
// - facilities: 住宅街・大学・公園・商店街など、雇用主ではない公共・生活系のゾーン
// - organizations: 企業・行政・学校など、雇用主として人物が勤務するゾーン
// どちらも city_id を持ち、新しい都市が追加・Active化されるたびに、その都市専用の
// ゾーン群として地図が自動的に広がっていく（単一のランドマークでは表現しない）。
// draft状態の都市に属するゾーンは、buildOrgZones/buildFacilityZonesの時点で一切マップに
// 含めない（Activeに戻すまで地図上には存在しない扱い）。

import type { FacilityRow, OrganizationRow, PersonRow } from "../types";

export interface Zone {
  id: string;
  label: string;
  x: number;
  y: number;
  kind: "org" | "residential" | "university" | "park" | "shopping_street" | "other";
  status?: string; // 組織自体の状態(倒産・調査中等)のみ。DB由来。
}

export function orgZoneId(orgId: number): string {
  return `org-${orgId}`;
}

export function facilityZoneId(facilityId: number): string {
  return `facility-${facilityId}`;
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * 既存ゾーン群の外側に、新しいゾーン(組織・施設)の座標を自動的に割り当てる。
 * 「マップのエリア拡大も積極的に行う」ため、既存の範囲の外へ広げていく。
 * 探索の開始角度を毎回ランダムにする（固定で0度＝真右から探索すると、baseRadius分
 * 離れた最初の候補がほぼ毎回そのまま採用されてしまい、「常に右方向にしか伸びない」
 * 単調な配置になっていた実際の不具合があったため）。
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
  const startAngle = Math.random() * 360;

  for (let attempt = 0; attempt < 32; attempt++) {
    const angle = ((startAngle + attempt * 53) % 360) * (Math.PI / 180);
    const radius = baseRadius + Math.floor(attempt / 8) * 200;
    const x = Math.round(cx + Math.cos(angle) * radius);
    const y = Math.round(cy + Math.sin(angle) * radius * 0.6);
    const tooClose = existingZones.some((z) => distance(z, { x, y }) < 170);
    if (!tooClose) return { x, y };
  }
  return { x: Math.round(cx + baseRadius), y: Math.round(cy) };
}

/**
 * 既存ゾーン群の外側に、新しい都市の最初のゾーンを置くための「拠点座標」を割り当てる。
 * 都市は組織1件よりずっと大きな区画になりうるので、間隔を広めに取って
 * 既存の街並みと視覚的にはっきり分かれる位置を返す。cities.map_x/map_y として保存され、
 * その都市に属する組織・施設を新規作成する際の基準点として使われる
 * （この座標自体は地図上に何かを描画するためのものではない）。
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
  const startAngle = Math.random() * 360;

  for (let attempt = 0; attempt < 32; attempt++) {
    const angle = ((startAngle + attempt * 71) % 360) * (Math.PI / 180);
    const radius = baseRadius + Math.floor(attempt / 8) * 400;
    const x = Math.round(cx + Math.cos(angle) * radius);
    const y = Math.round(cy + Math.sin(angle) * radius * 0.6);
    const tooClose = existingPoints.some((z) => distance(z, { x, y }) < 400);
    if (!tooClose) return { x, y };
  }
  return { x: Math.round(cx + baseRadius), y: Math.round(cy) };
}

/**
 * 組織・施設を新規作成する際の配置座標を決める共通ロジック。
 * すべての都市（ダイナン市id=1も含む）で同じルールを使う: その都市の拠点座標
 * (cities.map_x/map_y)+同都市の既存ゾーンだけを基準に配置する。
 * 以前はダイナン市だけ「全都市を横断した全ゾーン」を基準にしていたため、他の都市が
 * 遠くに追加されるたびにダイナン市側のバウンディングボックスまで無関係に広がってしまう
 * 不具合があった（都市ごとにまとまった配置にならず、地図全体が単調に伸びる原因の一つ）。
 */
export function assignZonePositionForCity(
  city: { id: number; map_x: number | null; map_y: number | null },
  sameCityZonePoints: { x: number; y: number }[]
): { x: number; y: number } {
  const cityAnchor = { x: city.map_x ?? 650, y: city.map_y ?? 430 };
  return assignNewOrgPosition([cityAnchor, ...sameCityZonePoints]);
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

/**
 * organizations テーブルの内容から、組織ゾーンの一覧を構築する。
 * draft状態の都市に属する組織はマップに一切表示しない（都市をActiveへ戻すまで地図上に
 * 存在しない扱いにする。「準備中の都市」というラベル付きで表示していた従来方式は廃止）。
 */
export function buildOrgZones(organizations: OrganizationRow[], draftCityIds: Set<number> = new Set()): Zone[] {
  return organizations
    .filter((o) => o.map_x != null && o.map_y != null && (o.city_id == null || !draftCityIds.has(o.city_id)))
    .map((o) => ({
      id: orgZoneId(o.id),
      label: o.name,
      x: o.map_x as number,
      y: o.map_y as number,
      kind: "org" as const,
      status: o.status !== "active" ? o.status : undefined,
    }));
}

const KNOWN_FACILITY_KINDS = new Set(["residential", "university", "park", "shopping_street"]);

/** facilities テーブルの内容から、施設ゾーンの一覧を構築する。draft都市に属する施設は除外する。 */
export function buildFacilityZones(facilities: FacilityRow[], draftCityIds: Set<number> = new Set()): Zone[] {
  return facilities
    .filter((f) => !draftCityIds.has(f.city_id))
    .map((f) => ({
      id: facilityZoneId(f.id),
      label: f.name,
      x: f.map_x,
      y: f.map_y,
      kind: (KNOWN_FACILITY_KINDS.has(f.kind) ? f.kind : "other") as Zone["kind"],
    }));
}

/** 施設ゾーン+組織ゾーンを合わせた全ゾーン一覧を返す（施設を先に並べ、道路接続の起点にする）。 */
export function buildAllZones(
  organizations: OrganizationRow[],
  facilities: FacilityRow[] = [],
  draftCityIds: Set<number> = new Set()
): Zone[] {
  return [...buildFacilityZones(facilities, draftCityIds), ...buildOrgZones(organizations, draftCityIds)];
}

/**
 * すべてのゾーンを、渡された順に「それまでに配置済みのゾーン群のうち最も近い1つ」へ
 * 自動的に接続していく。都市ごとの塊は座標的に離れているため、この単純な最近傍接続だけで
 * 都市内は密に、都市間は1本の長い道でつながる自然なネットワークになる。
 */
export function buildAllEdges(zones: Zone[]): [string, string][] {
  const edges: [string, string][] = [];
  const placed: Zone[] = [];
  for (const zone of zones) {
    if (placed.length > 0) {
      const nearest = nearestZoneId(zone, placed);
      if (nearest) edges.push([zone.id, nearest]);
    }
    placed.push(zone);
  }
  return edges;
}

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

/** その人物が所属する都市の施設一覧から、指定した種別の施設をハッシュベースで1つ選ぶ。 */
function pickFacilityByKind(
  facilitiesByCity: Map<number, FacilityRow[]>,
  cityId: number,
  kind: string,
  seed: number
): FacilityRow | null {
  const list = (facilitiesByCity.get(cityId) ?? []).filter((f) => f.kind === kind);
  if (list.length === 0) return null;
  return list[Math.abs(hashToIndex(seed, list.length))];
}

function pickAnyFacility(facilitiesByCity: Map<number, FacilityRow[]>, cityId: number, seed: number): FacilityRow | null {
  const list = facilitiesByCity.get(cityId) ?? [];
  if (list.length === 0) return null;
  return list[Math.abs(hashToIndex(seed + 7, list.length))];
}

export function assignPersonZones(people: PersonRow[], facilities: FacilityRow[]): PersonZoneAssignment[] {
  const facilitiesByCity = new Map<number, FacilityRow[]>();
  for (const f of facilities) {
    const list = facilitiesByCity.get(f.city_id);
    if (list) list.push(f);
    else facilitiesByCity.set(f.city_id, [f]);
  }

  return people.map((p) => {
    const cityId = p.city_id ?? 1;
    const residential = pickFacilityByKind(facilitiesByCity, cityId, "residential", p.id) ??
      pickAnyFacility(facilitiesByCity, cityId, p.id);
    // その都市にまだ施設が1つも無い場合(通常は到達しない)は、存在しないIDのままにして
    // クライアント側のcomputePosition()の「ゾーンが見つからない」フォールバックに委ねる。
    const homeZone = residential ? facilityZoneId(residential.id) : "none";

    let workZone: string;
    if (p.organization_id) {
      workZone = orgZoneId(p.organization_id);
    } else {
      const occ = p.occupation ?? "";
      let target: FacilityRow | null = null;
      if (occ.includes("学生")) {
        target = pickFacilityByKind(facilitiesByCity, cityId, "university", p.id);
      } else if (occ.includes("主婦") || occ.includes("主夫") || occ === "無職") {
        target = null; // 自宅にいる扱い
      } else {
        target = pickFacilityByKind(facilitiesByCity, cityId, "shopping_street", p.id);
      }
      workZone = target ? facilityZoneId(target.id) : homeZone;
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
