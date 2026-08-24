import { html, raw, RawHtml } from "../utils/html";
import { formatDateTimeJa, formatWorldDateJa } from "../utils/date";
import { leadFromBody } from "./components";
import type { NewsRow } from "../types";

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
