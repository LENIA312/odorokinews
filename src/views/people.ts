import { html, raw, RawHtml } from "../utils/html";
import type { OrganizationRow, PersonRow } from "../types";

const STATUS_LABEL: Record<string, string> = {
  alive: "",
  injured: "負傷",
  hospitalized: "入院中",
  deceased: "故人",
  celebrating: "話題の人物",
  under_investigation: "調査中",
};

export function peopleListView(people: PersonRow[], orgById: Map<number, OrganizationRow>): RawHtml {
  if (people.length === 0) {
    return html`<h2 class="section-title">人物</h2>
      <div class="empty">まだ人物データがありません。</div>`;
  }

  const cards = people
    .map((p) => {
      const org = p.organization_id ? orgById.get(p.organization_id) : undefined;
      const statusLabel = STATUS_LABEL[p.status] ?? p.status;
      return html`<a class="person-card" href="/people/${p.id}" style="display:block;color:inherit">
        <div class="name">${p.name}${p.origin === "news_generated" ? html` <small>(NEW)</small>` : raw("")}</div>
        <div class="occ">${p.occupation ?? "不明"}${org ? `・${org.name}` : ""}</div>
        ${statusLabel ? html`<div class="occ" style="color:var(--accent)">${statusLabel}</div>` : raw("")}
      </a>`.value;
    })
    .join("");

  return html`<h2 class="section-title">人物データベース</h2>
    <div class="card-grid">${raw(cards)}</div>`;
}
