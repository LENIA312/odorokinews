import { html, raw, RawHtml } from "../utils/html";
import type { Zone } from "./mapZones";

const ZONE_COLOR: Record<Zone["kind"], string> = {
  org: "#5b7fd9",
  residential: "#c98a5c",
  other: "#5fa876",
  city: "#9b5fb0",
};

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ゾーン種別ごとに、簡易的な建物・街並みのアイコンをSVGとして描く。
function zoneIcon(z: Zone): string {
  const color = z.status === "bankrupt" ? "#8a8a8a" : ZONE_COLOR[z.kind];

  if (z.kind === "org") {
    const closed =
      z.status === "bankrupt"
        ? '<line x1="-14" y1="-4" x2="14" y2="14" stroke="#c0392b" stroke-width="2.5"></line>' +
          '<line x1="14" y1="-4" x2="-14" y2="14" stroke="#c0392b" stroke-width="2.5"></line>'
        : "";
    return (
      '<polygon points="-15,-4 0,-17 15,-4" fill="#7a6a52"></polygon>' +
      '<rect x="-14" y="-4" width="28" height="19" rx="1.5" fill="' + color + '"></rect>' +
      '<rect x="-3.5" y="6" width="7" height="9" fill="#3a3630"></rect>' +
      '<rect x="-10" y="-1" width="5" height="5" fill="#eef2fb" opacity="0.85"></rect>' +
      '<rect x="5" y="-1" width="5" height="5" fill="#eef2fb" opacity="0.85"></rect>' +
      closed
    );
  }

  if (z.kind === "city") {
    const draft = z.status === "draft";
    const op = draft ? "0.5" : "0.92";
    return (
      '<ellipse cx="0" cy="14" rx="42" ry="12" fill="' + color + '" opacity="0.16"></ellipse>' +
      '<polygon points="-20,-2 -10,-17 0,-2" fill="' + color + '" opacity="' + op + '"></polygon>' +
      '<polygon points="0,-2 10,-21 20,-2" fill="' + color + '" opacity="' + op + '"></polygon>' +
      '<polygon points="18,-2 27,-13 36,-2" fill="' + color + '" opacity="' + op + '"></polygon>' +
      '<rect x="-24" y="-2" width="60" height="17" rx="1.5" fill="' + color + '" opacity="' + op + '"></rect>' +
      '<rect x="-18" y="4" width="6" height="6" fill="#eef2fb" opacity="0.85"></rect>' +
      '<rect x="-4" y="4" width="6" height="6" fill="#eef2fb" opacity="0.85"></rect>' +
      '<rect x="10" y="4" width="6" height="6" fill="#eef2fb" opacity="0.85"></rect>' +
      '<rect x="24" y="4" width="6" height="6" fill="#eef2fb" opacity="0.85"></rect>' +
      (draft
        ? '<text x="6" y="-26" text-anchor="middle" font-size="9" fill="#8a7f5f">準備中（未使用）</text>'
        : "")
    );
  }

  if (z.kind === "residential") {
    var house = function (dx: number, dy: number, scale: number, c: string) {
      return (
        '<g transform="translate(' + dx + "," + dy + ") scale(" + scale + ')">' +
        '<polygon points="-9,-2 0,-11 9,-2" fill="#8a6b4f"></polygon>' +
        '<rect x="-8" y="-2" width="16" height="12" rx="1" fill="' + c + '"></rect>' +
        '<rect x="-2" y="3" width="4" height="7" fill="#4a3a2c"></rect>' +
        "</g>"
      );
    };
    return (
      '<ellipse cx="0" cy="10" rx="34" ry="10" fill="#5fa876" opacity="0.18"></ellipse>' +
      house(-14, 4, 1, color) +
      house(10, -2, 0.85, "#d59f76") +
      house(2, 10, 0.7, "#b97c50")
    );
  }

  if (z.id === "university") {
    return (
      '<rect x="-16" y="-6" width="32" height="21" fill="#8a8770"></rect>' +
      '<polygon points="-19,-6 0,-18 19,-6" fill="#6f6c58"></polygon>' +
      '<rect x="-2.4" y="-16" width="1.6" height="10" fill="#6f6c58"></rect>' +
      '<polygon points="-0.8,-16 7,-13.5 -0.8,-11" fill="' + color + '"></polygon>' +
      '<rect x="-11" y="0" width="5" height="6" fill="#eef2fb" opacity="0.8"></rect>' +
      '<rect x="-2.5" y="0" width="5" height="6" fill="#eef2fb" opacity="0.8"></rect>' +
      '<rect x="6" y="0" width="5" height="6" fill="#eef2fb" opacity="0.8"></rect>'
    );
  }

  if (z.id === "park") {
    var tree = function (dx: number, dy: number, r: number) {
      return (
        '<g transform="translate(' + dx + "," + dy + ')">' +
        '<rect x="-1.4" y="' + (r - 1) + '" width="2.8" height="9" fill="#6b4a30"></rect>' +
        '<circle cx="0" cy="0" r="' + r + '" fill="' + color + '"></circle>' +
        "</g>"
      );
    };
    return (
      '<ellipse cx="0" cy="6" rx="38" ry="14" fill="' + color + '" opacity="0.2"></ellipse>' +
      tree(-16, -4, 9) +
      tree(2, -10, 11) +
      tree(17, -2, 8)
    );
  }

  // shopping_street およびその他の固定ゾーン
  var stall = function (dx: number, stripe: string) {
    return (
      '<g transform="translate(' + dx + ',0)">' +
      '<rect x="-8" y="0" width="16" height="12" fill="#efe6d6"></rect>' +
      '<polygon points="-9,0 9,0 9,-6 -9,-6" fill="' + stripe + '"></polygon>' +
      '<rect x="-2.5" y="4" width="5" height="8" fill="#7a6a52"></rect>' +
      "</g>"
    );
  };
  return stall(-16, "#d9855f") + stall(0, color) + stall(16, "#d9855f");
}

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// 装飾（川・海岸線など）を配置している「旧市街」の範囲。
// ゾーンがこの範囲より外に広がった場合のみ、表示範囲を拡張する。
const NATURAL_BOUNDS: Bounds = { minX: 0, minY: 0, maxX: 1400, maxY: 900 };

function computeBounds(zones: Zone[]): Bounds {
  const pad = 200;
  const xs = zones.map((z) => z.x);
  const ys = zones.map((z) => z.y);
  return {
    minX: Math.min(NATURAL_BOUNDS.minX, ...xs.map((x) => x - pad)),
    minY: Math.min(NATURAL_BOUNDS.minY, ...ys.map((y) => y - pad)),
    maxX: Math.max(NATURAL_BOUNDS.maxX, ...xs.map((x) => x + pad)),
    maxY: Math.max(NATURAL_BOUNDS.maxY, ...ys.map((y) => y + pad)),
  };
}

// 地形の装飾（川・橋・丘・森・湿地・海岸線・方位記号・縮尺・外枠）。
// 川や丘などは「旧市街」の固定位置に描き、方位記号・縮尺・外枠だけは
// 実際の表示範囲(bounds)に合わせて動かす。
function terrain(bounds: Bounds): string {
  const river =
    '<path d="M 1040,-20 C 990,140 1090,260 1010,420 C 940,560 1070,640 1000,780 C 960,860 1010,900 1010,900" ' +
    'fill="none" stroke="#a9cdd8" stroke-width="34" stroke-linecap="round"></path>' +
    '<path d="M 1040,-20 C 990,140 1090,260 1010,420 C 940,560 1070,640 1000,780 C 960,860 1010,900 1010,900" ' +
    'fill="none" stroke="#8fb9c7" stroke-width="34" stroke-linecap="round" opacity="0.35" ' +
    'stroke-dasharray="1 26"></path>';

  const bridge = (x: number, y: number, angle: number) =>
    '<g transform="translate(' + x + "," + y + ") rotate(" + angle + ')">' +
    '<rect x="-26" y="-6" width="52" height="12" rx="2" fill="#cbb994" stroke="#a3906c" stroke-width="1.5"></rect>' +
    "</g>";
  const bridges = bridge(1005, 430, 18) + bridge(998, 610, -12);

  const hills =
    '<g opacity="0.5">' +
    '<ellipse cx="230" cy="150" rx="150" ry="90" fill="#cbbf9a"></ellipse>' +
    '<ellipse cx="150" cy="120" rx="110" ry="70" fill="#d6cba9"></ellipse>' +
    '<path d="M 90,170 Q 200,110 320,175" fill="none" stroke="#b6a97e" stroke-width="2" opacity="0.6"></path>' +
    '<path d="M 70,200 Q 210,145 350,205" fill="none" stroke="#b6a97e" stroke-width="2" opacity="0.5"></path>' +
    "</g>";

  const forestTree = (dx: number, dy: number, r: number) =>
    '<circle cx="' + dx + '" cy="' + dy + '" r="' + r + '" fill="#4f8f63" opacity="0.55"></circle>';
  const forest =
    "<g>" +
    forestTree(1080, 150, 22) + forestTree(1130, 190, 18) + forestTree(1060, 210, 16) +
    forestTree(880, 190, 14) + forestTree(920, 160, 18) +
    "</g>";

  const marsh =
    '<g opacity="0.45">' +
    '<ellipse cx="1180" cy="820" rx="140" ry="60" fill="#8fae87"></ellipse>' +
    '<ellipse cx="1000" cy="850" rx="110" ry="45" fill="#9cb98f"></ellipse>' +
    "</g>";

  const coastline =
    '<path d="M0,860 C160,830 260,880 420,850 C 620,815 760,870 940,845 C 1080,825 1200,860 1400,835 L1400,900 L0,900 Z" ' +
    'fill="#bcd8e0" opacity="0.55"></path>' +
    '<path d="M0,860 C160,830 260,880 420,850 C 620,815 760,870 940,845 C 1080,825 1200,860 1400,835" ' +
    'fill="none" stroke="#9cc0cb" stroke-width="2"></path>';

  const compass =
    '<g transform="translate(' + (bounds.maxX - 70) + "," + (bounds.minY + 60) + ')">' +
    '<circle r="30" fill="#faf7ee" stroke="#c9bd9c" stroke-width="1.5"></circle>' +
    '<polygon points="0,-20 6,4 0,-5 -6,4" fill="#9c2b2b"></polygon>' +
    '<text x="0" y="-25" text-anchor="middle" font-size="11" fill="#4a473c" font-family="Georgia, serif">N</text>' +
    "</g>";

  const scaleBar =
    '<g transform="translate(' + (bounds.minX + 50) + "," + (bounds.maxY - 50) + ')">' +
    '<line x1="0" y1="0" x2="100" y2="0" stroke="#6b6650" stroke-width="2"></line>' +
    '<line x1="0" y1="-5" x2="0" y2="5" stroke="#6b6650" stroke-width="2"></line>' +
    '<line x1="100" y1="-5" x2="100" y2="5" stroke="#6b6650" stroke-width="2"></line>' +
    '<text x="50" y="-9" text-anchor="middle" font-size="10" fill="#6b6650" font-family="Georgia, serif">およそ1km</text>' +
    "</g>";

  const frame =
    '<rect x="' + (bounds.minX + 6) + '" y="' + (bounds.minY + 6) + '" width="' + (bounds.maxX - bounds.minX - 12) +
    '" height="' + (bounds.maxY - bounds.minY - 12) + '" fill="none" stroke="#c9bd9c" stroke-width="2"></rect>';

  return hills + forest + marsh + coastline + river + bridges + compass + scaleBar + frame;
}

// 施設同士を結ぶ道路網（格子ではなく、辺のリストとしてのグラフ）。
// 直線ではなくわずかに湾曲させ、手描きの街路っぽさを出す。
function roadNetwork(zoneById: Record<string, Zone>, edges: [string, string][]): string {
  return edges
    .map(function (edge, i) {
      const a = zoneById[edge[0]];
      const b = zoneById[edge[1]];
      if (!a || !b) return "";
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const bow = (i % 2 === 0 ? 1 : -1) * Math.min(28, len * 0.12);
      const offX = (-dy / len) * bow;
      const offY = (dx / len) * bow;
      const cx = mx + offX;
      const cy = my + offY;
      const path = "M " + a.x + "," + a.y + " Q " + cx + "," + cy + " " + b.x + "," + b.y;
      return (
        '<path d="' + path + '" fill="none" stroke="#d8cfb8" stroke-width="9" stroke-linecap="round"></path>' +
        '<path d="' + path + '" fill="none" stroke="#efe9d8" stroke-width="1.8" stroke-dasharray="7 8" stroke-linecap="round"></path>'
      );
    })
    .join("");
}

function zoneMarkers(zones: Zone[]): string {
  var markers = zones
    .map(function (z) {
      var isCity = z.kind === "city";
      var scale = isCity ? 1.7 : 1.25;
      var ringR = isCity ? 34 : 22;
      var spotR = isCity ? 40 : 27;
      return (
        '<g id="zone-' + z.id + '" transform="translate(' + z.x + "," + z.y + ") scale(" + scale + ')">' +
        '<circle class="status-ring" r="' + ringR + '" fill="none" stroke-width="2.6" opacity="0"></circle>' +
        '<circle class="spotlight-ring" r="' + spotR + '" fill="none" stroke-width="2.2" opacity="0"></circle>' +
        zoneIcon(z) +
        '<text x="6" y="' + (isCity ? 34 : 28) + '" text-anchor="middle" font-size="' + (isCity ? 12 : 10) + '" font-weight="' + (isCity ? 700 : 400) + '" fill="#4a473c" font-family="Hiragino Sans, Noto Sans JP, sans-serif">' +
        escapeXml(z.label) +
        "</text></g>"
      );
    })
    .join("");
  return markers;
}

const STYLE_EXTRA = [
  "#cityMap {",
  "  width:100%; height:auto; border:1px solid var(--line); border-radius:8px;",
  "  touch-action: none;",
  "  -webkit-user-select: none; -moz-user-select: none; user-select: none;",
  "  -webkit-touch-callout: none;",
  "}",
  "#cityMap text { -webkit-user-select: none; user-select: none; }",
  "#mapBg { fill: #f4efe2; }",
  "#clock { font-family:'Hiragino Sans','Noto Sans JP',sans-serif; font-size:0.85rem; color:var(--ink-soft); margin:0.4rem 0 0.4rem; }",
  "#spotlight { font-family:'Hiragino Sans','Noto Sans JP',sans-serif; font-size:0.85rem; background:var(--paper); border:1px solid var(--line); border-radius:6px; padding:0.5rem 0.8rem; margin-bottom:0.8rem; display:none; }",
  "#spotlight a { font-weight:600; }",
  ".legend { display:flex; gap:1rem; flex-wrap:wrap; font-family:'Hiragino Sans','Noto Sans JP',sans-serif; font-size:0.78rem; color:var(--ink-soft); margin-top:0.6rem; }",
  ".legend .dot { display:inline-block; width:9px; height:9px; border-radius:50%; margin-right:0.3rem; vertical-align:middle; }",
  "#personTip { font-family:'Hiragino Sans','Noto Sans JP',sans-serif; font-size:0.82rem; color:var(--ink-soft); min-height:1.4em; margin-top:0.5rem; }",
  ".person-dot { transition: r 0.15s; }",
  ".person-dot:hover { r: 5.5; }",
  "@keyframes spotlightPulse { 0% { r: 22; opacity: 0.55; } 100% { r: 38; opacity: 0; } }",
  ".spotlight-ring.active { animation: spotlightPulse 1.6s ease-out infinite; stroke: #9c2b2b; }",
  ".status-ring.active { opacity: 0.9; }",
  "#personSearchWrap { position:relative; margin-bottom:0.6rem; }",
  "#personSearchInput {",
  "  width:100%; box-sizing:border-box; font-family:'Hiragino Sans','Noto Sans JP',sans-serif; font-size:0.9rem;",
  "  padding:0.5rem 0.8rem; border:1px solid var(--line); border-radius:6px;",
  "}",
  "#personSearchResults {",
  "  position:absolute; left:0; right:0; top:100%; z-index:5; background:var(--paper); border:1px solid var(--line);",
  "  border-top:none; border-radius:0 0 6px 6px; max-height:14rem; overflow-y:auto; display:none;",
  "}",
  "#personSearchResults.open { display:block; }",
  "#personSearchResults div {",
  "  padding:0.45rem 0.8rem; font-family:'Hiragino Sans','Noto Sans JP',sans-serif; font-size:0.85rem; cursor:pointer;",
  "}",
  "#personSearchResults div:hover, #personSearchResults div.active { background:var(--bg); }",
  ".focus-ring { animation: spotlightPulse 1s ease-out 3; stroke: #5b8cff; }",
].join("\n");

export function mapView(zones: Zone[], edges: [string, string][]): RawHtml {
  const zoneById: Record<string, Zone> = {};
  zones.forEach((z) => (zoneById[z.id] = z));
  const bounds = computeBounds(zones);
  const viewBox =
    Math.round(bounds.minX) + " " + Math.round(bounds.minY) + " " +
    Math.round(bounds.maxX - bounds.minX) + " " + Math.round(bounds.maxY - bounds.minY);

  const svgBody =
    '<g id="terrainLayer">' + terrain(bounds) + "</g>" +
    '<g id="roadsLayer">' + roadNetwork(zoneById, edges) + "</g>" +
    '<g id="zonesLayer">' + zoneMarkers(zones) + "</g>";

  // <script>タグ内に埋め込むため、</script> 等でタグが閉じられないように</の出現を無害化する。
  const zonesJson = JSON.stringify(zones).replace(/</g, "\\u003c");
  const edgesJson = JSON.stringify(edges).replace(/</g, "\\u003c");
  const boundsJson = JSON.stringify(bounds).replace(/</g, "\\u003c");

  return html`<h2 class="section-title">街の様子</h2>
    <style>${raw(STYLE_EXTRA)}</style>
    <div id="clock">読み込み中...</div>
    <div id="spotlight"></div>
    <div id="personSearchWrap">
      <input type="text" id="personSearchInput" placeholder="人物名で検索して地図上の位置を表示" autocomplete="off" />
      <div id="personSearchResults"></div>
    </div>
    <svg id="cityMap" viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">
      <rect id="mapBg" x="${Math.round(bounds.minX)}" y="${Math.round(bounds.minY)}" width="${Math.round(bounds.maxX - bounds.minX)}" height="${Math.round(bounds.maxY - bounds.minY)}"></rect>
      ${raw(svgBody)}
      <g id="peopleLayer"></g>
    </svg>
    <div class="legend">
      <span><span class="dot" style="background:${ZONE_COLOR.org}"></span>職場・施設</span>
      <span><span class="dot" style="background:${ZONE_COLOR.residential}"></span>住宅街</span>
      <span><span class="dot" style="background:${ZONE_COLOR.other}"></span>その他（大学・公園・商店街）</span>
      <span><span class="dot" style="background:#9c2b2b"></span>通常</span>
      <span><span class="dot" style="background:#e07b39"></span>負傷</span>
      <span><span class="dot" style="background:#a34bb0"></span>入院中</span>
      <span><span class="dot" style="background:#8a8a8a"></span>故人</span>
    </div>
    <div id="personTip">人物の点をクリックすると名前が表示されます。施設が赤い枠で囲まれている場合は調査中、金色は好調・拡大中、グレーに×は倒産を表します。</div>
    <script>
      window.__ZONES__ = ${raw(zonesJson)};
      window.__EDGES__ = ${raw(edgesJson)};
      window.__BOUNDS__ = ${raw(boundsJson)};
    </script>
    <script>${raw(CLIENT_SCRIPT)}</script>`;
}

// テンプレートリテラルの混乱を避けるため文字列結合で記述する。
const CLIENT_SCRIPT = [
  "(function () {",
  "  var ZONES = window.__ZONES__ || [];",
  "  var EDGES = window.__EDGES__ || [];",
  "  var BOUNDS = window.__BOUNDS__ || { minX: 0, minY: 0, maxX: 1400, maxY: 900 };",
  "  var zoneById = {};",
  "  ZONES.forEach(function (z) { zoneById[z.id] = z; });",
  "  var hospitalZone = ZONES.filter(function (z) { return z.kind === 'org' && z.label.indexOf('病院') !== -1; })[0] || null;",
  "  var adjacency = {};",
  "  ZONES.forEach(function (z) { adjacency[z.id] = []; });",
  "  EDGES.forEach(function (e) {",
  "    if (adjacency[e[0]]) adjacency[e[0]].push(e[1]);",
  "    if (adjacency[e[1]]) adjacency[e[1]].push(e[0]);",
  "  });",
  "",
  "  // 数十ノード程度の小さいグラフなのでBFSで十分。",
  "  function shortestPath(fromId, toId) {",
  "    if (fromId === toId) return [fromId];",
  "    var visited = {};",
  "    visited[fromId] = null;",
  "    var queue = [fromId];",
  "    while (queue.length) {",
  "      var current = queue.shift();",
  "      if (current === toId) break;",
  "      var neighbors = adjacency[current] || [];",
  "      for (var i = 0; i < neighbors.length; i++) {",
  "        var n = neighbors[i];",
  "        if (!(n in visited)) {",
  "          visited[n] = current;",
  "          queue.push(n);",
  "        }",
  "      }",
  "    }",
  "    if (!(toId in visited)) return [fromId, toId]; // 未接続時のフォールバック(直線)",
  "    var path = [];",
  "    var node = toId;",
  "    while (node !== null && node !== undefined) {",
  "      path.unshift(node);",
  "      node = visited[node];",
  "    }",
  "    return path;",
  "  }",
  "",
  "  var peopleLayer = document.getElementById('peopleLayer');",
  "  var SVG_NS = 'http://www.w3.org/2000/svg';",
  "  var people = [];",
  "  var zoneStatus = {};",
  "  var spotlight = null;",
  "  var dotEls = {};",
  "  var pathCache = {};",
  "",
  "  var PERSON_STATUS_COLOR = {",
  "    sick: '#c9a227',",
  "    injured: '#e07b39',",
  "    hospitalized: '#a34bb0',",
  "    deceased: '#8a8a8a',",
  "    celebrating: '#d4a017',",
  "    under_investigation: '#5b7fd9',",
  "  };",
  "  var PERSON_STATUS_LABEL = {",
  "    sick: '療養中',",
  "    injured: '負傷',",
  "    hospitalized: '入院中',",
  "    deceased: '故人',",
  "    celebrating: '話題の人物',",
  "    under_investigation: '調査中',",
  "  };",
  "  var ORG_STATUS_RING_COLOR = {",
  "    under_investigation: '#c0392b',",
  "    expanding: '#d4a017',",
  "    celebrating: '#d4a017',",
  "    recovering: '#5b7fd9',",
  "    bankrupt: '#6b6650',",
  "    draft: '#9b8f6b',",
  "  };",
  "",
  "  function lerp(a, b, t) { return a + (b - a) * t; }",
  "  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }",
  "",
  "  // 停留中(自宅/勤務先にいる間)、その場でゆらゆら動く演出。密集しすぎないよう半径は広め。",
  "  function wander(baseX, baseY, seedId, realSeconds) {",
  "    var phase = seedId * 0.61;",
  "    return {",
  "      x: baseX + Math.sin(realSeconds * 0.15 + phase) * 34,",
  "      y: baseY + Math.cos(realSeconds * 0.12 + phase * 1.3) * 34,",
  "    };",
  "  }",
  "",
  "  function getPath(homeId, workId) {",
  "    var key = homeId + '>' + workId;",
  "    if (!pathCache[key]) {",
  "      pathCache[key] = shortestPath(homeId, workId).map(function (id) { return zoneById[id]; }).filter(Boolean);",
  "    }",
  "    return pathCache[key];",
  "  }",
  "",
  "  // 複数区間からなる経路上を、区間の距離に応じた時間配分でイージング移動する。",
  "  function polylinePosition(points, t) {",
  "    if (points.length < 2) return points[0] || { x: (BOUNDS.minX + BOUNDS.maxX) / 2, y: (BOUNDS.minY + BOUNDS.maxY) / 2 };",
  "    var legLens = [];",
  "    var total = 0;",
  "    for (var i = 0; i < points.length - 1; i++) {",
  "      var d = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);",
  "      legLens.push(d);",
  "      total += d;",
  "    }",
  "    if (total === 0) return points[points.length - 1];",
  "    var e = easeInOut(t) * total;",
  "    var acc = 0;",
  "    for (var j = 0; j < legLens.length; j++) {",
  "      if (e <= acc + legLens[j] || j === legLens.length - 1) {",
  "        var segT = legLens[j] === 0 ? 1 : (e - acc) / legLens[j];",
  "        segT = Math.max(0, Math.min(1, segT));",
  "        return { x: lerp(points[j].x, points[j + 1].x, segT), y: lerp(points[j].y, points[j + 1].y, segT) };",
  "      }",
  "      acc += legLens[j];",
  "    }",
  "    return points[points.length - 1];",
  "  }",
  "",
  "  // 0-24の時刻から、人物ごとの現在位置を計算する。",
  "  // 入院中/故人/療養中はニュースの状態を優先し、通常の通勤ロジックより先に位置を固定する。",
  "  function computePosition(person, hour, realSeconds) {",
  "    if (person.status === 'hospitalized' && hospitalZone) {",
  "      return wander(hospitalZone.x, hospitalZone.y, person.id, realSeconds);",
  "    }",
  "    if (person.status === 'deceased') {",
  "      var restingZone = zoneById[person.homeZone];",
  "      if (restingZone) return { x: restingZone.x, y: restingZone.y };",
  "    }",
  "    if (person.status === 'sick') {",
  "      var restHome = zoneById[person.homeZone];",
  "      if (restHome) return wander(restHome.x, restHome.y, person.id, realSeconds);",
  "    }",
  "",
  "    var home = zoneById[person.homeZone];",
  "    var work = zoneById[person.workZone];",
  "    if (!home || !work) return { x: (BOUNDS.minX + BOUNDS.maxX) / 2, y: (BOUNDS.minY + BOUNDS.maxY) / 2 };",
  "    if (home.id === work.id) return wander(home.x, home.y, person.id, realSeconds);",
  "",
  "    var jitter = (person.id * 37) % 60 / 60; // 0-1の個人差",
  "    var toWorkStart = 7 + jitter, toWorkEnd = 9 + jitter;",
  "    var toHomeStart = 18 + jitter, toHomeEnd = 20 + jitter;",
  "",
  "    if (hour < toWorkStart || hour >= toHomeEnd) {",
  "      return wander(home.x, home.y, person.id, realSeconds);",
  "    }",
  "    if (hour >= toWorkEnd && hour < toHomeStart) {",
  "      return wander(work.x, work.y, person.id, realSeconds);",
  "    }",
  "    var path = getPath(home.id, work.id);",
  "    if (hour >= toWorkStart && hour < toWorkEnd) {",
  "      var t1 = (hour - toWorkStart) / (toWorkEnd - toWorkStart);",
  "      return polylinePosition(path, t1);",
  "    }",
  "    var t2 = (hour - toHomeStart) / (toHomeEnd - toHomeStart);",
  "    var reversed = path.slice().reverse();",
  "    return polylinePosition(reversed, t2);",
  "  }",
  "",
  "  function ensureDot(person) {",
  "    if (dotEls[person.id]) return dotEls[person.id];",
  "    var c = document.createElementNS(SVG_NS, 'circle');",
  "    c.setAttribute('class', 'person-dot');",
  "    c.setAttribute('stroke', '#fff3e6');",
  "    c.setAttribute('stroke-width', '0.8');",
  "    c.style.cursor = 'pointer';",
  "    c.addEventListener('click', function () {",
  "      var tip = document.getElementById('personTip');",
  "      tip.innerHTML = '<a href=\"/people/' + person.id + '\" target=\"_blank\">' +",
  "        escapeHtml(person.name) + '</a>（' + escapeHtml(person.occupation || '不明') +",
  "        (person.status && person.status !== 'alive' ? ' / ' + escapeHtml(PERSON_STATUS_LABEL[person.status] || person.status) : '') + '）';",
  "    });",
  "    peopleLayer.appendChild(c);",
  "    dotEls[person.id] = c;",
  "    return c;",
  "  }",
  "",
  "  function styleDot(dot, person) {",
  "    var isResting = person.status === 'deceased';",
  "    dot.setAttribute('r', isResting ? '2.6' : '3.4');",
  "    dot.setAttribute('fill', PERSON_STATUS_COLOR[person.status] || '#9c2b2b');",
  "    dot.setAttribute('opacity', isResting ? '0.55' : '0.9');",
  "  }",
  "",
  "  function escapeHtml(s) {",
  "    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');",
  "  }",
  "",
  "  function updateZoneOverlays() {",
  "    ZONES.forEach(function (z) {",
  "      var g = document.getElementById('zone-' + z.id);",
  "      if (!g) return;",
  "      var statusRing = g.querySelector('.status-ring');",
  "      var spotRing = g.querySelector('.spotlight-ring');",
  "      var status = zoneStatus[z.id];",
  "      if (status && statusRing) {",
  "        statusRing.setAttribute('stroke', ORG_STATUS_RING_COLOR[status] || '#5b7fd9');",
  "        statusRing.classList.add('active');",
  "      } else if (statusRing) {",
  "        statusRing.classList.remove('active');",
  "      }",
  "      var isSpotlighted = !!spotlight && spotlight.zoneIds.indexOf(z.id) !== -1;",
  "      if (spotRing) {",
  "        if (isSpotlighted) spotRing.classList.add('active');",
  "        else spotRing.classList.remove('active');",
  "      }",
  "    });",
  "",
  "    var banner = document.getElementById('spotlight');",
  "    if (spotlight && spotlight.headline) {",
  "      banner.style.display = 'block';",
  "      banner.innerHTML = '本日の注目: <a href=\"/news/' + spotlight.newsId + '\" target=\"_blank\">' +",
  "        escapeHtml(spotlight.headline) + '</a>';",
  "    } else {",
  "      banner.style.display = 'none';",
  "    }",
  "  }",
  "",
  "  function loadMapData() {",
  "    return fetch('/api/map/people').then(function (res) { return res.json(); }).then(function (data) {",
  "      people = data.people || [];",
  "      zoneStatus = data.zoneStatus || {};",
  "      spotlight = data.spotlight || null;",
  "      updateZoneOverlays();",
  "    });",
  "  }",
  "",
  "  var DAY_SECONDS = 3600; // 現実1時間で1日ぶんの体感時間が経過する",
  "",
  "  function pad(n) { return (n < 10 ? '0' : '') + n; }",
  "",
  "  function tick() {",
  "    var nowSec = Date.now() / 1000;",
  "    var hour = (nowSec % DAY_SECONDS) / DAY_SECONDS * 24;",
  "    var h = Math.floor(hour);",
  "    var m = Math.floor((hour - h) * 60);",
  "    document.getElementById('clock').textContent = '現在時刻: ' + pad(h) + ':' + pad(m);",
  "",
  "    for (var i = 0; i < people.length; i++) {",
  "      var p = people[i];",
  "      var pos = computePosition(p, hour, nowSec);",
  "      var dot = ensureDot(p);",
  "      dot.setAttribute('cx', pos.x);",
  "      dot.setAttribute('cy', pos.y);",
  "      styleDot(dot, p);",
  "    }",
  "    requestAnimationFrame(tick);",
  "  }",
  "",
  "  // ホイール／ピンチでの拡大縮小とドラッグ／スワイプでの移動（viewBoxを直接操作する）。",
  "  // マップ内のイベントだけを扱うため、ページ全体のスクロール・拡大には影響しない。",
  "  var panZoom = (function enablePanZoom() {",
  "    var svg = document.getElementById('cityMap');",
  "    var FULL = { x: BOUNDS.minX, y: BOUNDS.minY, w: BOUNDS.maxX - BOUNDS.minX, h: BOUNDS.maxY - BOUNDS.minY };",
  "    var view = { x: FULL.x, y: FULL.y, w: FULL.w, h: FULL.h };",
  "    function applyView() {",
  "      svg.setAttribute('viewBox', view.x + ' ' + view.y + ' ' + view.w + ' ' + view.h);",
  "    }",
  "    function clamp() {",
  "      view.w = Math.max(150, Math.min(FULL.w, view.w));",
  "      view.h = view.w * (FULL.h / FULL.w);",
  "      view.x = Math.max(FULL.x, Math.min(FULL.x + FULL.w - view.w, view.x));",
  "      view.y = Math.max(FULL.y, Math.min(FULL.y + FULL.h - view.h, view.y));",
  "    }",
  "    svg.addEventListener('wheel', function (ev) {",
  "      ev.preventDefault();",
  "      var scale = ev.deltaY > 0 ? 1.15 : 0.87;",
  "      var rect = svg.getBoundingClientRect();",
  "      var px = view.x + ((ev.clientX - rect.left) / rect.width) * view.w;",
  "      var py = view.y + ((ev.clientY - rect.top) / rect.height) * view.h;",
  "      view.w *= scale;",
  "      view.h *= scale;",
  "      view.x = px - ((ev.clientX - rect.left) / rect.width) * view.w;",
  "      view.y = py - ((ev.clientY - rect.top) / rect.height) * view.h;",
  "      clamp();",
  "      applyView();",
  "    }, { passive: false });",
  "",
  "    // 人物の点(.person-dot)の上での操作は、そのままクリック判定に渡す",
  "    // （setPointerCaptureしてしまうと、その点自身のclickイベントが発火しなくなるため）。",
  "    function isPersonDot(ev) {",
  "      return !!(ev.target && ev.target.classList && ev.target.classList.contains('person-dot'));",
  "    }",
  "",
  "    var pointers = {};",
  "    var dragging = false, lastX = 0, lastY = 0;",
  "    var pinchStartDist = null, pinchStartMid = null, pinchStartView = null;",
  "",
  "    function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }",
  "    function mid(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }",
  "    function pointerList() {",
  "      return Object.keys(pointers).map(function (id) { return pointers[id]; });",
  "    }",
  "",
  "    svg.addEventListener('pointerdown', function (ev) {",
  "      if (isPersonDot(ev)) return;",
  "      pointers[ev.pointerId] = { x: ev.clientX, y: ev.clientY };",
  "      svg.setPointerCapture(ev.pointerId);",
  "      var ids = Object.keys(pointers);",
  "      if (ids.length === 1) {",
  "        dragging = true; lastX = ev.clientX; lastY = ev.clientY;",
  "        svg.style.cursor = 'grabbing';",
  "      } else if (ids.length === 2) {",
  "        dragging = false;",
  "        var pts = pointerList();",
  "        pinchStartDist = dist(pts[0], pts[1]);",
  "        pinchStartMid = mid(pts[0], pts[1]);",
  "        pinchStartView = { x: view.x, y: view.y, w: view.w, h: view.h };",
  "      }",
  "    });",
  "    svg.addEventListener('pointermove', function (ev) {",
  "      if (!pointers[ev.pointerId] && !dragging) return;",
  "      if (pointers[ev.pointerId]) pointers[ev.pointerId] = { x: ev.clientX, y: ev.clientY };",
  "      var ids = Object.keys(pointers);",
  "      var rect = svg.getBoundingClientRect();",
  "      if (ids.length >= 2 && pinchStartDist) {",
  "        var pts = pointerList();",
  "        var newDist = dist(pts[0], pts[1]);",
  "        var scale = pinchStartDist / Math.max(1, newDist);",
  "        view.w = pinchStartView.w * scale;",
  "        view.h = pinchStartView.h * scale;",
  "        var newMid = mid(pts[0], pts[1]);",
  "        var px = pinchStartView.x + ((pinchStartMid.x - rect.left) / rect.width) * pinchStartView.w;",
  "        var py = pinchStartView.y + ((pinchStartMid.y - rect.top) / rect.height) * pinchStartView.h;",
  "        view.x = px - ((newMid.x - rect.left) / rect.width) * view.w;",
  "        view.y = py - ((newMid.y - rect.top) / rect.height) * view.h;",
  "        clamp();",
  "        applyView();",
  "        return;",
  "      }",
  "      if (!dragging) return;",
  "      view.x -= (ev.clientX - lastX) * (view.w / rect.width);",
  "      view.y -= (ev.clientY - lastY) * (view.h / rect.height);",
  "      lastX = ev.clientX; lastY = ev.clientY;",
  "      clamp();",
  "      applyView();",
  "    });",
  "    function releasePointer(ev) {",
  "      delete pointers[ev.pointerId];",
  "      var ids = Object.keys(pointers);",
  "      pinchStartDist = null;",
  "      if (ids.length === 0) {",
  "        dragging = false;",
  "        svg.style.cursor = 'grab';",
  "      } else if (ids.length === 1) {",
  "        dragging = true;",
  "        lastX = pointers[ids[0]].x;",
  "        lastY = pointers[ids[0]].y;",
  "      }",
  "    }",
  "    svg.addEventListener('pointerup', releasePointer);",
  "    svg.addEventListener('pointercancel', releasePointer);",
  "    svg.addEventListener('pointerleave', function (ev) {",
  "      if (Object.prototype.hasOwnProperty.call(pointers, ev.pointerId)) releasePointer(ev);",
  "    });",
  "    svg.style.cursor = 'grab';",
  "    svg.style.touchAction = 'none';",
  "",
  "    function focusOn(x, y, targetW) {",
  "      var w = Math.min(FULL.w, targetW || 420);",
  "      view.w = w;",
  "      view.h = w * (FULL.h / FULL.w);",
  "      view.x = x - view.w / 2;",
  "      view.y = y - view.h / 2;",
  "      clamp();",
  "      applyView();",
  "    }",
  "",
  "    return { focusOn: focusOn };",
  "  })();",
  "",
  "  function currentPersonPosition(person) {",
  "    var dot = dotEls[person.id];",
  "    if (dot) return { x: parseFloat(dot.getAttribute('cx')), y: parseFloat(dot.getAttribute('cy')) };",
  "    var nowSec = Date.now() / 1000;",
  "    var hour = (nowSec % DAY_SECONDS) / DAY_SECONDS * 24;",
  "    return computePosition(person, hour, nowSec);",
  "  }",
  "",
  "  function showFocusRing(x, y) {",
  "    var ring = document.createElementNS(SVG_NS, 'circle');",
  "    ring.setAttribute('cx', x);",
  "    ring.setAttribute('cy', y);",
  "    ring.setAttribute('r', 14);",
  "    ring.setAttribute('fill', 'none');",
  "    ring.setAttribute('stroke-width', '2.5');",
  "    ring.setAttribute('class', 'focus-ring');",
  "    peopleLayer.appendChild(ring);",
  "    setTimeout(function () { ring.remove(); }, 3000);",
  "  }",
  "",
  "  function focusOnPerson(person) {",
  "    var pos = currentPersonPosition(person);",
  "    panZoom.focusOn(pos.x, pos.y, 420);",
  "    showFocusRing(pos.x, pos.y);",
  "    var tip = document.getElementById('personTip');",
  "    tip.innerHTML = '<a href=\"/people/' + person.id + '\" target=\"_blank\">' +",
  "      escapeHtml(person.name) + '</a>（' + escapeHtml(person.occupation || '不明') +",
  "      (person.status && person.status !== 'alive' ? ' / ' + escapeHtml(PERSON_STATUS_LABEL[person.status] || person.status) : '') + '）';",
  "  }",
  "",
  "  (function enablePersonSearch() {",
  "    var input = document.getElementById('personSearchInput');",
  "    var resultsBox = document.getElementById('personSearchResults');",
  "    if (!input || !resultsBox) return;",
  "    function render(matches) {",
  "      resultsBox.innerHTML = '';",
  "      matches.slice(0, 8).forEach(function (p) {",
  "        var row = document.createElement('div');",
  "        row.textContent = p.name + (p.occupation ? '（' + p.occupation + '）' : '');",
  "        row.addEventListener('pointerdown', function (ev) {",
  "          ev.preventDefault();",
  "          focusOnPerson(p);",
  "          input.value = p.name;",
  "          resultsBox.classList.remove('open');",
  "        });",
  "        resultsBox.appendChild(row);",
  "      });",
  "      resultsBox.classList.toggle('open', matches.length > 0);",
  "    }",
  "    input.addEventListener('input', function () {",
  "      var q = input.value.trim();",
  "      if (!q) { resultsBox.classList.remove('open'); resultsBox.innerHTML = ''; return; }",
  "      var matches = people.filter(function (p) {",
  "        return (p.name && p.name.indexOf(q) !== -1) || (p.name_kana && p.name_kana.indexOf(q) !== -1);",
  "      });",
  "      render(matches);",
  "    });",
  "    input.addEventListener('focus', function () {",
  "      if (input.value.trim()) input.dispatchEvent(new Event('input'));",
  "    });",
  "    input.addEventListener('blur', function () {",
  "      setTimeout(function () { resultsBox.classList.remove('open'); }, 150);",
  "    });",
  "  })();",
  "",
  "  loadMapData().then(function () {",
  "    requestAnimationFrame(tick);",
  "  });",
  "  setInterval(loadMapData, 60000); // 新しい人物・状態変化・注目ニュース・新しい施設を反映",
  "})();",
].join("\n");
