import { html, raw, RawHtml } from "../utils/html";

const NAV_ITEMS = [
  { href: "/", label: "ニュース" },
  { href: "/world", label: "世界" },
  { href: "/people", label: "人物" },
  { href: "/timeline", label: "年表" },
  { href: "/economy", label: "経済" },
  { href: "/map", label: "街の様子" },
];

const STYLE = `
  :root {
    color-scheme: light;
    --bg: #f6f5f1;
    --paper: #ffffff;
    --ink: #1b1b1b;
    --ink-soft: #55524a;
    --line: #ddd8cc;
    --accent: #9c2b2b;
    --accent-ink: #ffffff;
    font-size: 16px;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    background: var(--bg);
    color: var(--ink);
    font-family: "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif;
    line-height: 1.8;
  }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }

  header.site {
    background: var(--paper);
    border-bottom: 3px solid var(--ink);
  }
  .masthead {
    max-width: 880px;
    margin: 0 auto;
    padding: 1.4rem 1.2rem 0.6rem;
    text-align: center;
  }
  .masthead .kicker {
    letter-spacing: 0.3em;
    font-size: 0.7rem;
    color: var(--ink-soft);
  }
  .masthead h1 {
    margin: 0.2rem 0 0.1rem;
    font-size: 2.2rem;
    letter-spacing: 0.08em;
  }
  .masthead .sub {
    font-size: 0.8rem;
    color: var(--ink-soft);
  }
  nav.site {
    border-top: 1px solid var(--line);
    max-width: 880px;
    margin: 0.6rem auto 0;
    display: flex;
    justify-content: center;
    gap: 1.6rem;
    padding: 0.5rem 1.2rem;
    font-family: "Hiragino Sans", "Noto Sans JP", sans-serif;
    font-size: 0.9rem;
  }
  nav.site a { color: var(--ink); }
  nav.site a.active { color: var(--accent); font-weight: 700; }

  main {
    max-width: 880px;
    margin: 0 auto;
    padding: 1.6rem 1.2rem 4rem;
  }

  .worldbar {
    font-family: "Hiragino Sans", "Noto Sans JP", sans-serif;
    font-size: 0.78rem;
    color: var(--ink-soft);
    background: var(--paper);
    border: 1px solid var(--line);
    border-radius: 4px;
    padding: 0.5rem 0.8rem;
    margin-bottom: 1.4rem;
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  h2.section-title {
    font-size: 1.1rem;
    border-bottom: 2px solid var(--ink);
    padding-bottom: 0.3rem;
    margin: 0 0 1rem;
  }

  .category-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-bottom: 1.2rem;
    font-family: "Hiragino Sans", "Noto Sans JP", sans-serif;
    font-size: 0.82rem;
  }
  .category-tab {
    display: inline-block;
    padding: 0.3rem 0.8rem;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: var(--paper);
    color: var(--ink-soft);
  }
  .category-tab:hover { text-decoration: none; border-color: var(--accent); }
  .category-tab.active {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-ink);
    font-weight: 700;
  }

  .news-card {
    background: var(--paper);
    border: 1px solid var(--line);
    border-radius: 4px;
    padding: 1rem 1.1rem;
    margin-bottom: 1rem;
  }
  .news-card .meta {
    font-family: "Hiragino Sans", "Noto Sans JP", sans-serif;
    font-size: 0.72rem;
    color: var(--ink-soft);
    display: flex;
    gap: 0.6rem;
    margin-bottom: 0.35rem;
  }
  .news-card .category {
    background: var(--accent);
    color: var(--accent-ink);
    padding: 0.05rem 0.5rem;
    border-radius: 2px;
  }
  .news-card h3 {
    margin: 0 0 0.4rem;
    font-size: 1.2rem;
    line-height: 1.5;
  }
  .news-card p.lead {
    margin: 0;
    color: var(--ink-soft);
  }

  article.news-detail h2 {
    font-size: 1.6rem;
    line-height: 1.6;
    margin: 0 0 0.5rem;
  }
  article.news-detail .meta {
    font-family: "Hiragino Sans", "Noto Sans JP", sans-serif;
    font-size: 0.78rem;
    color: var(--ink-soft);
    margin-bottom: 1.2rem;
  }
  article.news-detail .body p {
    margin: 0 0 1rem;
  }

  .related-box {
    background: var(--paper);
    border: 1px solid var(--line);
    border-radius: 4px;
    padding: 0.9rem 1rem;
    margin-top: 1.6rem;
    font-family: "Hiragino Sans", "Noto Sans JP", sans-serif;
    font-size: 0.85rem;
  }
  .related-box h4 {
    margin: 0 0 0.5rem;
    font-size: 0.8rem;
    color: var(--ink-soft);
    letter-spacing: 0.05em;
  }
  .chip-row { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .chip {
    display: inline-block;
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 0.2rem 0.7rem;
    background: var(--bg);
  }

  table.plain {
    width: 100%;
    border-collapse: collapse;
    font-family: "Hiragino Sans", "Noto Sans JP", sans-serif;
    font-size: 0.88rem;
  }
  table.plain th, table.plain td {
    border-bottom: 1px solid var(--line);
    text-align: left;
    padding: 0.5rem 0.4rem;
  }
  table.plain th { color: var(--ink-soft); font-weight: 600; }

  .timeline-item {
    display: flex;
    gap: 1rem;
    padding: 0.6rem 0;
    border-bottom: 1px dashed var(--line);
  }
  .timeline-item .date {
    flex: 0 0 8.5rem;
    font-family: "Hiragino Sans", "Noto Sans JP", sans-serif;
    font-size: 0.8rem;
    color: var(--ink-soft);
  }

  .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 0.9rem;
  }
  .person-card {
    display: block;
    color: inherit;
    background: var(--paper);
    border: 1px solid var(--line);
    border-radius: 4px;
    padding: 0.9rem;
  }
  .person-card .name { font-size: 1.05rem; font-weight: 700; }
  .person-card .occ {
    font-family: "Hiragino Sans", "Noto Sans JP", sans-serif;
    font-size: 0.78rem;
    color: var(--ink-soft);
  }

  .empty {
    color: var(--ink-soft);
    font-family: "Hiragino Sans", "Noto Sans JP", sans-serif;
    font-size: 0.9rem;
    padding: 2rem 0;
    text-align: center;
  }

  footer.site {
    max-width: 880px;
    margin: 0 auto;
    padding: 2rem 1.2rem 3rem;
    font-family: "Hiragino Sans", "Noto Sans JP", sans-serif;
    font-size: 0.72rem;
    color: var(--ink-soft);
    border-top: 1px solid var(--line);
  }
`;

export function page(opts: { title: string; activePath: string; worldbar?: RawHtml; body: RawHtml }): RawHtml {
  const nav = NAV_ITEMS.map(
    (item) =>
      html`<a href="${item.href}" class="${item.href === opts.activePath ? "active" : ""}">${item.label}</a>`.value
  ).join("");

  return html`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${opts.title} | モーゼン・クロニクル</title>
  <meta name="description" content="架空世界モーゼン・アングラの出来事を報じるニュースサイト モーゼン・クロニクル" />
  <style>${raw(STYLE)}</style>
</head>
<body>
  <header class="site">
    <div class="masthead">
      <div class="kicker">MOSE'N UNGRA CHRONICLE</div>
      <h1><a href="/" style="color:inherit">モーゼン・クロニクル</a></h1>
      <div class="sub">架空世界「モーゼン・アングラ」で実際に起きた出来事を報じる</div>
    </div>
    <nav class="site">${raw(nav)}</nav>
  </header>
  <main>
    ${opts.worldbar ?? raw("")}
    ${opts.body}
  </main>
  <footer class="site">
    モーゼン・クロニクルは架空世界シミュレーションシステムです。登場する人物・企業・出来事はすべて架空であり、実在するものとは関係ありません。
  </footer>
</body>
</html>`;
}
