import { html, raw, RawHtml } from "../utils/html";
import { GRID_COLS, GRID_ROWS, ZONES, type Zone } from "./mapZones";

const ZONE_COLOR: Record<Zone["kind"], string> = {
  org: "#5b7fd9",
  residential: "#c98a5c",
  other: "#5fa876",
};

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ゾーン種別ごとに、簡易的な建物・街並みのアイコンをSVGとして描く。
function zoneIcon(z: Zone): string {
  const color = ZONE_COLOR[z.kind];

  if (z.kind === "org") {
    return (
      '<polygon points="-15,-4 0,-17 15,-4" fill="#7a6a52"></polygon>' +
      '<rect x="-14" y="-4" width="28" height="19" rx="1.5" fill="' + color + '"></rect>' +
      '<rect x="-3.5" y="6" width="7" height="9" fill="#3a3630"></rect>' +
      '<rect x="-10" y="-1" width="5" height="5" fill="#eef2fb" opacity="0.85"></rect>' +
      '<rect x="5" y="-1" width="5" height="5" fill="#eef2fb" opacity="0.85"></rect>'
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

  // shopping_street
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

const MAP_LEFT = GRID_COLS[0];
const MAP_RIGHT = GRID_COLS[GRID_COLS.length - 1];
const MAP_TOP = GRID_ROWS[0];
const MAP_BOTTOM = GRID_ROWS[GRID_ROWS.length - 1];

// 街並みっぽさを底上げする装飾（下町の色分け・海岸線・方位記号・縮尺表記・外枠）。
function decorations(): string {
  const downtown =
    '<rect x="' + (MAP_LEFT - 55) + '" y="' + (MAP_TOP - 45) + '" width="' + (MAP_RIGHT - MAP_LEFT + 110) +
    '" height="' + (MAP_BOTTOM - MAP_TOP + 90) + '" rx="18" fill="#ece3cd" opacity="0.6"></rect>';

  const coastline =
    '<path d="M0,430 C120,410 200,455 340,435 C480,415 560,450 680,430 C760,418 800,428 800,428 L800,480 L0,480 Z" ' +
    'fill="#bcd8e0" opacity="0.55"></path>' +
    '<path d="M0,430 C120,410 200,455 340,435 C480,415 560,450 680,430 C760,418 800,428 800,428" ' +
    'fill="none" stroke="#9cc0cb" stroke-width="2"></path>';

  const compass =
    '<g transform="translate(755,55)">' +
    '<circle r="26" fill="#faf7ee" stroke="#c9bd9c" stroke-width="1.5"></circle>' +
    '<polygon points="0,-18 5,3 0,-4 -5,3" fill="#9c2b2b"></polygon>' +
    '<text x="0" y="-22" text-anchor="middle" font-size="10" fill="#4a473c" font-family="Georgia, serif">N</text>' +
    "</g>";

  const scaleBar =
    '<g transform="translate(45,455)">' +
    '<line x1="0" y1="0" x2="80" y2="0" stroke="#6b6650" stroke-width="2"></line>' +
    '<line x1="0" y1="-4" x2="0" y2="4" stroke="#6b6650" stroke-width="2"></line>' +
    '<line x1="80" y1="-4" x2="80" y2="4" stroke="#6b6650" stroke-width="2"></line>' +
    '<text x="40" y="-8" text-anchor="middle" font-size="9" fill="#6b6650" font-family="Georgia, serif">およそ500m</text>' +
    "</g>";

  const frame =
    '<rect x="6" y="6" width="788" height="468" fill="none" stroke="#c9bd9c" stroke-width="2"></rect>' +
    '<rect x="10" y="10" width="780" height="460" fill="none" stroke="#c9bd9c" stroke-width="1"></rect>';

  return downtown + coastline + compass + scaleBar + frame;
}

// 縦横5×3の格子として道路網を描く（1点に集約するハブ方式ではなく、実際の街路っぽい網目にする）。
function roadGrid(): string {
  const hRoads = GRID_ROWS.map(
    (y) =>
      '<line x1="' + MAP_LEFT + '" y1="' + y + '" x2="' + MAP_RIGHT + '" y2="' + y +
      '" stroke="#d8cfb8" stroke-width="8" stroke-linecap="round"></line>' +
      '<line x1="' + MAP_LEFT + '" y1="' + y + '" x2="' + MAP_RIGHT + '" y2="' + y +
      '" stroke="#efe9d8" stroke-width="1.6" stroke-dasharray="6 7" stroke-linecap="round"></line>'
  ).join("");

  const vRoads = GRID_COLS.map(
    (x) =>
      '<line x1="' + x + '" y1="' + MAP_TOP + '" x2="' + x + '" y2="' + MAP_BOTTOM +
      '" stroke="#d8cfb8" stroke-width="8" stroke-linecap="round"></line>' +
      '<line x1="' + x + '" y1="' + MAP_TOP + '" x2="' + x + '" y2="' + MAP_BOTTOM +
      '" stroke="#efe9d8" stroke-width="1.6" stroke-dasharray="6 7" stroke-linecap="round"></line>'
  ).join("");

  const intersections = GRID_ROWS.flatMap((y) =>
    GRID_COLS.map((x) => '<circle cx="' + x + '" cy="' + y + '" r="3" fill="#c9bd9c"></circle>')
  ).join("");

  return hRoads + vRoads + intersections;
}

function zoneMarkers(): string {
  var zones = ZONES.map(function (z) {
    return (
      '<g id="zone-' + z.id + '" transform="translate(' + z.x + "," + z.y + ')">' +
      '<circle class="status-ring" r="24" fill="none" stroke-width="3" opacity="0"></circle>' +
      '<circle class="spotlight-ring" r="30" fill="none" stroke-width="2.5" opacity="0"></circle>' +
      zoneIcon(z) +
      '<text x="0" y="30" text-anchor="middle" font-size="10.5" fill="#4a473c" font-family="Hiragino Sans, Noto Sans JP, sans-serif">' +
      escapeXml(z.label) +
      "</text></g>"
    );
  }).join("");

  return (
    '<g id="decorationsLayer">' + decorations() + "</g>" +
    '<g id="roadsLayer">' + roadGrid() + "</g>" +
    '<g id="zonesLayer">' + zones + "</g>"
  );
}

const STYLE_EXTRA = [
  "#cityMap { width:100%; height:auto; border:1px solid var(--line); border-radius:8px; }",
  "#mapBg { fill: #f4efe2; }",
  "#clock { font-family:'Hiragino Sans','Noto Sans JP',sans-serif; font-size:0.85rem; color:var(--ink-soft); margin:0.4rem 0 0.4rem; }",
  "#spotlight { font-family:'Hiragino Sans','Noto Sans JP',sans-serif; font-size:0.85rem; background:var(--paper); border:1px solid var(--line); border-radius:6px; padding:0.5rem 0.8rem; margin-bottom:0.8rem; display:none; }",
  "#spotlight a { font-weight:600; }",
  ".legend { display:flex; gap:1rem; flex-wrap:wrap; font-family:'Hiragino Sans','Noto Sans JP',sans-serif; font-size:0.78rem; color:var(--ink-soft); margin-top:0.6rem; }",
  ".legend .dot { display:inline-block; width:9px; height:9px; border-radius:50%; margin-right:0.3rem; vertical-align:middle; }",
  "#personTip { font-family:'Hiragino Sans','Noto Sans JP',sans-serif; font-size:0.82rem; color:var(--ink-soft); min-height:1.4em; margin-top:0.5rem; }",
  ".person-dot { transition: r 0.15s; }",
  ".person-dot:hover { r: 5.5; }",
  "@keyframes spotlightPulse { 0% { r: 24; opacity: 0.55; } 100% { r: 40; opacity: 0; } }",
  ".spotlight-ring.active { animation: spotlightPulse 1.6s ease-out infinite; stroke: #9c2b2b; }",
  ".status-ring.active { opacity: 0.9; }",
].join("\n");

export function mapView(): RawHtml {
  // <script>タグ内に埋め込むため、</script> 等でタグが閉じられないように</の出現を無害化する。
  const zonesJson = JSON.stringify(ZONES).replace(/</g, "\\u003c");

  return html`<h2 class="section-title">街の様子</h2>
    <div class="empty" style="text-align:left;padding:0 0 1rem">
      職業・勤務先から自動的に「自宅」と「主な行き先」を割り当て、時間帯に応じて道路網に沿って
      移動する様子を模式的に表示しています。実際の行動記録ではなく、演出用のイメージです。
    </div>
    <style>${raw(STYLE_EXTRA)}</style>
    <div id="clock">読み込み中...</div>
    <div id="spotlight"></div>
    <svg id="cityMap" viewBox="0 0 800 480" xmlns="http://www.w3.org/2000/svg">
      <rect id="mapBg" x="0" y="0" width="800" height="480"></rect>
      ${raw(zoneMarkers())}
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
    <div id="personTip">人物の点をクリックすると名前が表示されます。施設が赤い枠で囲まれている場合は調査中、金色は好調・拡大中を表します。</div>
    <script>
      window.__ZONES__ = ${raw(zonesJson)};
    </script>
    <script>${raw(CLIENT_SCRIPT)}</script>`;
}

// テンプレートリテラルの混乱を避けるため文字列結合で記述する。
const CLIENT_SCRIPT = [
  "(function () {",
  "  var ZONES = window.__ZONES__ || [];",
  "  var zoneById = {};",
  "  ZONES.forEach(function (z) { zoneById[z.id] = z; });",
  "",
  "  var peopleLayer = document.getElementById('peopleLayer');",
  "  var SVG_NS = 'http://www.w3.org/2000/svg';",
  "  var people = [];",
  "  var zoneStatus = {};",
  "  var spotlight = null;",
  "  var dotEls = {};",
  "",
  "  var PERSON_STATUS_COLOR = {",
  "    injured: '#e07b39',",
  "    hospitalized: '#a34bb0',",
  "    deceased: '#8a8a8a',",
  "    celebrating: '#d4a017',",
  "    under_investigation: '#5b7fd9',",
  "  };",
  "  var ORG_STATUS_RING_COLOR = {",
  "    under_investigation: '#c0392b',",
  "    expanding: '#d4a017',",
  "    celebrating: '#d4a017',",
  "    recovering: '#5b7fd9',",
  "  };",
  "",
  "  function lerp(a, b, t) { return a + (b - a) * t; }",
  "  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }",
  "",
  "  // 停留中(自宅/勤務先にいる間)、その場でゆらゆら動く演出。",
  "  function wander(baseX, baseY, seedId, realSeconds) {",
  "    var phase = seedId * 0.61;",
  "    return {",
  "      x: baseX + Math.sin(realSeconds * 0.18 + phase) * 6,",
  "      y: baseY + Math.cos(realSeconds * 0.14 + phase * 1.3) * 6,",
  "    };",
  "  }",
  "",
  "  // 道路網に沿ったLの字経路（出発地の行を進んでから目的地の列を進む）で移動する。",
  "  // 家と勤務先が同じ行/列なら自然に直線移動になる。",
  "  function pathPosition(fromX, fromY, toX, toY, t) {",
  "    var e = easeInOut(t);",
  "    var cornerX = toX, cornerY = fromY;",
  "    var legDist1 = Math.abs(cornerX - fromX);",
  "    var legDist2 = Math.abs(toY - cornerY);",
  "    var total = legDist1 + legDist2;",
  "    if (total === 0) return { x: toX, y: toY };",
  "    var split = legDist1 / total;",
  "    if (e < split) {",
  "      var t1 = split === 0 ? 1 : e / split;",
  "      return { x: lerp(fromX, cornerX, t1), y: fromY };",
  "    }",
  "    var t2 = split === 1 ? 1 : (e - split) / (1 - split);",
  "    return { x: cornerX, y: lerp(cornerY, toY, t2) };",
  "  }",
  "",
  "  // 0-24のシミュレーション上の時刻から、人物ごとの現在位置を計算する。",
  "  // 入院中/故人はニュースの状態を優先し、通常の通勤ロジックより先に位置を固定する。",
  "  function computePosition(person, hour, realSeconds) {",
  "    if (person.status === 'hospitalized') {",
  "      var hospital = zoneById.hospital;",
  "      if (hospital) return wander(hospital.x, hospital.y, person.id, realSeconds);",
  "    }",
  "    if (person.status === 'deceased') {",
  "      var restingZone = zoneById[person.homeZone];",
  "      if (restingZone) return { x: restingZone.x, y: restingZone.y };",
  "    }",
  "",
  "    var home = zoneById[person.homeZone];",
  "    var work = zoneById[person.workZone];",
  "    if (!home || !work) return { x: 400, y: 190 };",
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
  "    if (hour >= toWorkStart && hour < toWorkEnd) {",
  "      var t1 = (hour - toWorkStart) / (toWorkEnd - toWorkStart);",
  "      return pathPosition(home.x, home.y, work.x, work.y, t1);",
  "    }",
  "    var t2 = (hour - toHomeStart) / (toHomeEnd - toHomeStart);",
  "    return pathPosition(work.x, work.y, home.x, home.y, t2);",
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
  "        (person.status && person.status !== 'alive' ? ' / ' + escapeHtml(person.status) : '') + '）';",
  "    });",
  "    peopleLayer.appendChild(c);",
  "    dotEls[person.id] = c;",
  "    return c;",
  "  }",
  "",
  "  function styleDot(dot, person) {",
  "    var isResting = person.status === 'deceased';",
  "    dot.setAttribute('r', isResting ? '2.6' : '3.6');",
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
  "  var DAY_SECONDS = 3600; // 現実1時間でシミュレーション上の24時間が経過する",
  "",
  "  function pad(n) { return (n < 10 ? '0' : '') + n; }",
  "",
  "  function tick() {",
  "    var nowSec = Date.now() / 1000;",
  "    var hour = (nowSec % DAY_SECONDS) / DAY_SECONDS * 24;",
  "    var h = Math.floor(hour);",
  "    var m = Math.floor((hour - h) * 60);",
  "    document.getElementById('clock').textContent =",
  "      'シミュレーション時刻: ' + pad(h) + ':' + pad(m) + '（現実の1時間で1日が経過する早回し表示）';",
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
  "  loadMapData().then(function () {",
  "    requestAnimationFrame(tick);",
  "  });",
  "  setInterval(loadMapData, 60000); // 新しい人物・状態変化・注目ニュースを反映",
  "})();",
].join("\n");
