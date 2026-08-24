import { html, raw, RawHtml } from "../utils/html";
import { formatWorldDateJa } from "../utils/date";
import type { TimelineRow } from "../types";

export function timelineView(items: TimelineRow[]): RawHtml {
  if (items.length === 0) {
    return html`<h2 class="section-title">年表</h2>
      <div class="empty">まだ記録された出来事がありません。</div>`;
  }

  const rows = items
    .map(
      (t) => html`<div class="timeline-item">
        <div class="date">${formatWorldDateJa(t.world_date)}</div>
        <div><a href="/news/event/${t.event_id}">${t.headline}</a></div>
      </div>`.value
    )
    .join("");

  return html`<h2 class="section-title">年表</h2>
    ${raw(rows)}`;
}
