import { html, raw, RawHtml } from "../utils/html";
import { KANA_ROWS, kanaRowOf } from "../utils/kana";
import type { OrganizationRow, PersonRow } from "../types";

const STATUS_LABEL: Record<string, string> = {
  alive: "",
  injured: "負傷",
  hospitalized: "入院中",
  deceased: "故人",
  celebrating: "話題の人物",
  under_investigation: "調査中",
};

const STYLE_EXTRA = [
  ".kana-index { display:flex; flex-wrap:wrap; gap:0.35rem; margin-bottom:0.8rem; }",
  ".kana-index button {",
  "  font-family:'Hiragino Sans','Noto Sans JP',sans-serif; font-size:0.82rem;",
  "  border:1px solid var(--line); background:var(--paper); color:var(--ink-soft);",
  "  border-radius:999px; padding:0.25rem 0.75rem; cursor:pointer;",
  "}",
  ".kana-index button.active { background:var(--accent); border-color:var(--accent); color:var(--accent-ink); font-weight:700; }",
  "#peopleSearch {",
  "  width:100%; box-sizing:border-box; font-family:'Hiragino Sans','Noto Sans JP',sans-serif; font-size:0.9rem;",
  "  padding:0.5rem 0.8rem; border:1px solid var(--line); border-radius:6px; margin-bottom:1rem;",
  "}",
  "#peopleCount { font-family:'Hiragino Sans','Noto Sans JP',sans-serif; font-size:0.78rem; color:var(--ink-soft); margin-bottom:0.6rem; }",
  ".person-card.hidden-by-filter { display:none; }",
].join("\n");

export function peopleListView(people: PersonRow[], orgById: Map<number, OrganizationRow>): RawHtml {
  if (people.length === 0) {
    return html`<h2 class="section-title">人物</h2>
      <div class="empty">まだ人物データがありません。</div>`;
  }

  const cards = people
    .map((p) => {
      const org = p.organization_id ? orgById.get(p.organization_id) : undefined;
      const statusLabel = STATUS_LABEL[p.status] ?? p.status;
      const row = kanaRowOf(p.name_kana);
      const searchKey = `${p.name}${p.name_kana ?? ""}`.toLowerCase();
      return html`<a
        class="person-card"
        href="/people/${p.id}"
        style="display:block;color:inherit"
        data-kana-row="${row}"
        data-search="${searchKey}"
      >
        <div class="name">${p.name}${p.origin === "news_generated" ? html` <small>(NEW)</small>` : raw("")}</div>
        <div class="occ">${p.occupation ?? "不明"}${org ? `・${org.name}` : ""}</div>
        ${statusLabel ? html`<div class="occ" style="color:var(--accent)">${statusLabel}</div>` : raw("")}
      </a>`.value;
    })
    .join("");

  const indexButtons = ["すべて", ...KANA_ROWS, "他"]
    .map((row, i) => html`<button type="button" class="kana-row-btn ${i === 0 ? "active" : ""}" data-row="${row}">${row}</button>`.value)
    .join("");

  return html`<h2 class="section-title">人物データベース</h2>
    <style>${raw(STYLE_EXTRA)}</style>
    <input id="peopleSearch" type="text" placeholder="名前で検索（漢字・ひらがな）" autocomplete="off" />
    <div class="kana-index">${raw(indexButtons)}</div>
    <div id="peopleCount"></div>
    <div class="card-grid" id="peopleGrid">${raw(cards)}</div>
    <div class="empty" id="peopleEmptyState" style="display:none">条件に一致する人物がいません。</div>
    <script>${raw(CLIENT_SCRIPT)}</script>`;
}

// テンプレートリテラルの混乱を避けるため文字列結合で記述する。
const CLIENT_SCRIPT = [
  "(function () {",
  "  var grid = document.getElementById('peopleGrid');",
  "  var cards = Array.prototype.slice.call(grid.querySelectorAll('.person-card'));",
  "  var buttons = Array.prototype.slice.call(document.querySelectorAll('.kana-row-btn'));",
  "  var searchInput = document.getElementById('peopleSearch');",
  "  var countEl = document.getElementById('peopleCount');",
  "  var emptyEl = document.getElementById('peopleEmptyState');",
  "  var activeRow = 'すべて';",
  "",
  "  function applyFilter() {",
  "    var q = searchInput.value.trim().toLowerCase();",
  "    var visible = 0;",
  "    cards.forEach(function (card) {",
  "      var rowOk = activeRow === 'すべて' || card.getAttribute('data-kana-row') === activeRow;",
  "      var searchOk = !q || (card.getAttribute('data-search') || '').indexOf(q) !== -1;",
  "      var show = rowOk && searchOk;",
  "      card.classList.toggle('hidden-by-filter', !show);",
  "      if (show) visible++;",
  "    });",
  "    countEl.textContent = visible + ' 人 / 全 ' + cards.length + ' 人';",
  "    emptyEl.style.display = visible === 0 ? 'block' : 'none';",
  "    grid.style.display = visible === 0 ? 'none' : '';",
  "  }",
  "",
  "  buttons.forEach(function (btn) {",
  "    btn.addEventListener('click', function () {",
  "      buttons.forEach(function (b) { b.classList.remove('active'); });",
  "      btn.classList.add('active');",
  "      activeRow = btn.getAttribute('data-row');",
  "      applyFilter();",
  "    });",
  "  });",
  "  searchInput.addEventListener('input', applyFilter);",
  "",
  "  applyFilter();",
  "})();",
].join("\n");
