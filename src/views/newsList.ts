import { html, raw, RawHtml } from "../utils/html";
import { formatDateTimeJa, formatWorldDateJa } from "../utils/date";
import { leadFromBody } from "./components";
import { NEWS_CATEGORIES } from "../constants";
import type { NewsRow } from "../types";

export function categoryTabs(active: string | null): RawHtml {
  const tabs = [{ label: "すべて", href: "/news" }, ...NEWS_CATEGORIES.map((c) => ({ label: c, href: `/news?category=${encodeURIComponent(c)}` }))];

  const items = tabs
    .map((t) => {
      const isActive = (active === null && t.label === "すべて") || active === t.label;
      return html`<a href="${t.href}" class="category-tab ${isActive ? "active" : ""}">${t.label}</a>`.value;
    })
    .join("");

  return html`<div class="category-tabs">${raw(items)}</div>`;
}

export function newsListSection(title: string, items: NewsRow[]): RawHtml {
  if (items.length === 0) {
    return html`<h2 class="section-title">${title}</h2>
      <div class="empty">まだニュースがありません。世界の進行を待っています。</div>`;
  }

  const cards = items
    .map(
      (n) => html`<div class="news-card">
        <div class="meta">
          <span class="category">${n.category}</span>
          <span>${formatWorldDateJa(n.occurred_at)} 発生 / ${formatDateTimeJa(n.published_at)} 掲載</span>
        </div>
        <h3><a href="/news/${n.id}">${n.title}</a></h3>
        <p class="lead">${leadFromBody(n.body)}</p>
      </div>`.value
    )
    .join("");

  return html`<h2 class="section-title">${title}</h2>
    ${raw(cards)}`;
}
