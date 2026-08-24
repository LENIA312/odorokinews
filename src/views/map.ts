import { html, raw, RawHtml } from "../utils/html";
import { HUB, ZONES, type Zone } from "./mapZones";

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

function zoneMarkers(): string {
  var roads = ZONES.map(function (z) {
    return (
      '<line x1="' + z.x + '" y1="' + z.y + '" x2="' + HUB.x + '" y2="' + HUB.y +
      '" stroke="#d8cfb8" stroke-width="7" stroke-linecap="round"></line>' +
      '<line x1="' + z.x + '" y1="' + z.y + '" x2="' + HUB.x + '" y2="' + HUB.y +
      '" stroke="#efe9d8" stroke-width="1.6" stroke-dasharray="6 7" stroke-linecap="round"></line>'
    );
  }).join("");

  var hubMarker =
    '<circle cx="' + HUB.x + '" cy="' + HUB.y + '" r="16" fill="#e7e0cc"></circle>' +
    '<circle cx="' + HUB.x + '" cy="' + HUB.y + '" r="16" fill="none" stroke="#c9bd9c" stroke-width="1.5"></circle>';

  var zones = ZONES.map(function (z) {
    return (
      '<g transform="translate(' + z.x + "," + z.y + ')">' +
      zoneIcon(z) +
      '<text x="0" y="30" text-anchor="middle" font-size="10.5" fill="#4a473c" font-family="Hiragino Sans, Noto Sans JP, sans-serif">' +
      escapeXml(z.label) +
      "</text></g>"
    );
  }).join("");

  return '<g id="roadsLayer">' + roads + hubMarker + "</g>" + '<g id="zonesLayer">' + zones + "</g>";
}

const STYLE_EXTRA = [
  "#cityMap { width:100%; height:auto; border:1px solid var(--line); border-radius:8px; }",
  "#mapBg { fill: #f4efe2; }",
  "#clock { font-family:'Hiragino Sans','Noto Sans JP',sans-serif; font-size:0.85rem; color:var(--ink-soft); margin:0.4rem 0 0.8rem; }",
  ".legend { display:flex; gap:1rem; flex-wrap:wrap; font-family:'Hiragino Sans','Noto Sans JP',sans-serif; font-size:0.78rem; color:var(--ink-soft); margin-top:0.6rem; }",
  ".legend .dot { display:inline-block; width:9px; height:9px; border-radius:50%; margin-right:0.3rem; vertical-align:middle; }",
  "#personTip { font-family:'Hiragino Sans','Noto Sans JP',sans-serif; font-size:0.82rem; color:var(--ink-soft); min-height:1.4em; margin-top:0.5rem; }",
  ".person-dot { transition: r 0.15s; }",
  ".person-dot:hover { r: 5.5; }",
].join("\n");

export function mapView(): RawHtml {
  // <script>タグ内に埋め込むため、</script> 等でタグが閉じられないように</の出現を無害化する。
  const zonesJson = JSON.stringify(ZONES).replace(/</g, "\\u003c");
  const hubJson = JSON.stringify(HUB).replace(/</g, "\\u003c");

  return html`<h2 class="section-title">街の様子</h2>
    <div class="empty" style="text-align:left;padding:0 0 1rem">
      職業・勤務先から自動的に「自宅」と「主な行き先」を割り当て、時間帯に応じて移動する様子を
      模式的に表示しています。実際の行動記録ではなく、演出用のイメージです。
    </div>
    <style>${raw(STYLE_EXTRA)}</style>
    <div id="clock">読み込み中...</div>
    <svg id="cityMap" viewBox="0 0 800 480" xmlns="http://www.w3.org/2000/svg">
      <rect id="mapBg" x="0" y="0" width="800" height="480"></rect>
      ${raw(zoneMarkers())}
      <g id="peopleLayer"></g>
    </svg>
    <div class="legend">
      <span><span class="dot" style="background:${ZONE_COLOR.org}"></span>職場・施設</span>
      <span><span class="dot" style="background:${ZONE_COLOR.residential}"></span>住宅街</span>
      <span><span class="dot" style="background:${ZONE_COLOR.other}"></span>その他（大学・公園・商店街）</span>
      <span><span class="dot" style="background:#9c2b2b"></span>人物</span>
    </div>
    <div id="personTip">人物の点をクリックすると名前が表示されます。</div>
    <script>
      window.__ZONES__ = ${raw(zonesJson)};
      window.__HUB__ = ${raw(hubJson)};
    </script>
    <script>${raw(CLIENT_SCRIPT)}</script>`;
}

// テンプレートリテラルの混乱を避けるため文字列結合で記述する。
const CLIENT_SCRIPT = [
  "(function () {",
  "  var ZONES = window.__ZONES__ || [];",
  "  var HUB = window.__HUB__ || { x: 400, y: 240 };",
  "  var zoneById = {};",
  "  ZONES.forEach(function (z) { zoneById[z.id] = z; });",
  "",
  "  var peopleLayer = document.getElementById('peopleLayer');",
  "  var SVG_NS = 'http://www.w3.org/2000/svg';",
  "  var people = [];",
  "  var dotEls = {};",
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
  "  // 家↔勤務先は必ず町の中心(HUB)を経由する2区間の経路として移動する。",
  "  function pathPosition(fromX, fromY, toX, toY, t) {",
  "    var e = easeInOut(t);",
  "    if (e < 0.5) {",
  "      var t1 = e * 2;",
  "      return { x: lerp(fromX, HUB.x, t1), y: lerp(fromY, HUB.y, t1) };",
  "    }",
  "    var t2 = (e - 0.5) * 2;",
  "    return { x: lerp(HUB.x, toX, t2), y: lerp(HUB.y, toY, t2) };",
  "  }",
  "",
  "  // 0-24のシミュレーション上の時刻から、人物ごとの現在位置を計算する。",
  "  function computePosition(person, hour, realSeconds) {",
  "    var home = zoneById[person.homeZone];",
  "    var work = zoneById[person.workZone];",
  "    if (!home || !work) return { x: 400, y: 240 };",
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
  "    c.setAttribute('r', '3.6');",
  "    c.setAttribute('fill', '#9c2b2b');",
  "    c.setAttribute('stroke', '#fff3e6');",
  "    c.setAttribute('stroke-width', '0.8');",
  "    c.setAttribute('opacity', '0.9');",
  "    c.style.cursor = 'pointer';",
  "    c.addEventListener('click', function () {",
  "      var tip = document.getElementById('personTip');",
  "      tip.innerHTML = '<a href=\"/people/' + person.id + '\" target=\"_blank\">' +",
  "        escapeHtml(person.name) + '</a>（' + escapeHtml(person.occupation || '不明') + '）';",
  "    });",
  "    peopleLayer.appendChild(c);",
  "    dotEls[person.id] = c;",
  "    return c;",
  "  }",
  "",
  "  function escapeHtml(s) {",
  "    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');",
  "  }",
  "",
  "  function loadPeople() {",
  "    return fetch('/api/map/people').then(function (res) { return res.json(); }).then(function (data) {",
  "      people = data.people || [];",
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
  "    }",
  "    requestAnimationFrame(tick);",
  "  }",
  "",
  "  loadPeople().then(function () {",
  "    requestAnimationFrame(tick);",
  "  });",
  "  setInterval(loadPeople, 60000); // 新しく生まれた人物なども反映",
  "})();",
].join("\n");
