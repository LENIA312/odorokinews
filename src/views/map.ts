import { html, raw, RawHtml } from "../utils/html";
import { ZONES, type Zone } from "./mapZones";

const ZONE_COLOR: Record<Zone["kind"], string> = {
  org: "#5b8cff",
  residential: "#3ecf8e",
  other: "#ffb84d",
};

function zoneMarkers(): string {
  return ZONES.map((z) => {
    const color = ZONE_COLOR[z.kind];
    return (
      '<g transform="translate(' + z.x + "," + z.y + ')">' +
      '<rect x="-6" y="-6" width="12" height="12" rx="3" fill="' + color + '" opacity="0.9"></rect>' +
      '<text x="0" y="-12" text-anchor="middle" font-size="11" fill="#3a3a3a">' + escapeXml(z.label) + "</text>" +
      "</g>"
    );
  }).join("");
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const STYLE_EXTRA = [
  "#cityMap { width:100%; height:auto; border:1px solid var(--line); border-radius:6px; background:#f2f1ea; }",
  "#clock { font-family:'Hiragino Sans','Noto Sans JP',sans-serif; font-size:0.85rem; color:var(--ink-soft); margin:0.4rem 0 0.8rem; }",
  ".legend { display:flex; gap:1rem; flex-wrap:wrap; font-family:'Hiragino Sans','Noto Sans JP',sans-serif; font-size:0.78rem; color:var(--ink-soft); margin-top:0.6rem; }",
  ".legend .dot { display:inline-block; width:9px; height:9px; border-radius:50%; margin-right:0.3rem; vertical-align:middle; }",
  "#personTip { font-family:'Hiragino Sans','Noto Sans JP',sans-serif; font-size:0.82rem; color:var(--ink-soft); min-height:1.4em; margin-top:0.5rem; }",
].join("\n");

export function mapView(): RawHtml {
  // <script>タグ内に埋め込むため、</script> 等でタグが閉じられないように</の出現を無害化する。
  const zonesJson = JSON.stringify(ZONES).replace(/</g, "\\u003c");

  return html`<h2 class="section-title">街の様子</h2>
    <div class="empty" style="text-align:left;padding:0 0 1rem">
      職業・勤務先から自動的に「自宅」と「主な行き先」を割り当て、時間帯に応じて移動する様子を
      模式的に表示しています。実際の行動記録ではなく、演出用のイメージです。
    </div>
    <style>${raw(STYLE_EXTRA)}</style>
    <div id="clock">読み込み中...</div>
    <svg id="cityMap" viewBox="0 0 800 480" xmlns="http://www.w3.org/2000/svg">
      ${raw(zoneMarkers())}
    </svg>
    <div class="legend">
      <span><span class="dot" style="background:${ZONE_COLOR.org}"></span>職場・施設</span>
      <span><span class="dot" style="background:${ZONE_COLOR.residential}"></span>住宅街</span>
      <span><span class="dot" style="background:${ZONE_COLOR.other}"></span>その他（大学・公園など）</span>
      <span><span class="dot" style="background:#9c2b2b"></span>人物</span>
    </div>
    <div id="personTip">人物の点をクリックすると名前が表示されます。</div>
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
  "  var svg = document.getElementById('cityMap');",
  "  var SVG_NS = 'http://www.w3.org/2000/svg';",
  "  var people = [];",
  "  var dotEls = {};",
  "",
  "  function lerp(a, b, t) { return a + (b - a) * t; }",
  "",
  "  // 0-24のシミュレーション上の時刻から、人物ごとの現在位置を計算する。",
  "  function computePosition(person, hour) {",
  "    var home = zoneById[person.homeZone];",
  "    var work = zoneById[person.workZone];",
  "    if (!home || !work) return { x: 400, y: 240 };",
  "    if (home.id === work.id) return { x: home.x, y: home.y };",
  "",
  "    var jitter = (person.id * 37) % 60 / 60; // 0-1の個人差",
  "    var toWorkStart = 7 + jitter, toWorkEnd = 9 + jitter;",
  "    var toHomeStart = 18 + jitter, toHomeEnd = 20 + jitter;",
  "",
  "    if (hour < toWorkStart || hour >= toHomeEnd) {",
  "      return { x: home.x, y: home.y };",
  "    }",
  "    if (hour >= toWorkEnd && hour < toHomeStart) {",
  "      return { x: work.x, y: work.y };",
  "    }",
  "    if (hour >= toWorkStart && hour < toWorkEnd) {",
  "      var t1 = (hour - toWorkStart) / (toWorkEnd - toWorkStart);",
  "      return { x: lerp(home.x, work.x, t1), y: lerp(home.y, work.y, t1) };",
  "    }",
  "    var t2 = (hour - toHomeStart) / (toHomeEnd - toHomeStart);",
  "    return { x: lerp(work.x, home.x, t2), y: lerp(work.y, home.y, t2) };",
  "  }",
  "",
  "  function ensureDot(person) {",
  "    if (dotEls[person.id]) return dotEls[person.id];",
  "    var c = document.createElementNS(SVG_NS, 'circle');",
  "    c.setAttribute('r', '3.4');",
  "    c.setAttribute('fill', '#9c2b2b');",
  "    c.setAttribute('opacity', '0.85');",
  "    c.style.cursor = 'pointer';",
  "    c.addEventListener('click', function () {",
  "      var tip = document.getElementById('personTip');",
  "      tip.innerHTML = '<a href=\"/people/' + person.id + '\" target=\"_blank\">' +",
  "        escapeHtml(person.name) + '</a>（' + escapeHtml(person.occupation || '不明') + '）';",
  "    });",
  "    svg.appendChild(c);",
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
  "  var DAY_SECONDS = 90; // 現実90秒でシミュレーション上の24時間が経過する",
  "",
  "  function pad(n) { return (n < 10 ? '0' : '') + n; }",
  "",
  "  function tick() {",
  "    var hour = (Date.now() / 1000 % DAY_SECONDS) / DAY_SECONDS * 24;",
  "    var h = Math.floor(hour);",
  "    var m = Math.floor((hour - h) * 60);",
  "    document.getElementById('clock').textContent =",
  "      'シミュレーション時刻: ' + pad(h) + ':' + pad(m) + '（現実の' + DAY_SECONDS + '秒で1日が経過する早回し表示）';",
  "",
  "    for (var i = 0; i < people.length; i++) {",
  "      var p = people[i];",
  "      var pos = computePosition(p, hour);",
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
