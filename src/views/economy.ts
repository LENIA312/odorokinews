import { html, raw, RawHtml } from "../utils/html";
import { ORG_STATUS_LABEL } from "../constants";
import type { EconomicDataRow, OrganizationRow } from "../types";

export function economyView(
  organizations: OrganizationRow[],
  latestByOrg: Map<number, EconomicDataRow>,
  priceIndex: EconomicDataRow | null
): RawHtml {
  const companies = organizations.filter((o) => o.kind === "company");

  const rows = companies
    .map((o) => {
      const data = latestByOrg.get(o.id);
      const priceText = o.status === "bankrupt" ? "−" : data ? `${data.value.toLocaleString("ja-JP")} 円` : "未上場";
      const statusLabel = ORG_STATUS_LABEL[o.status] ?? o.status;
      const detail = [o.industry, o.founded_year ? `${o.founded_year}年創業` : null, o.employee_scale]
        .filter(Boolean)
        .join(" / ");
      return html`<tr class="${o.status === "bankrupt" ? "org-bankrupt" : ""}">
        <td>
          ${o.name}
          ${detail ? html`<div class="org-detail">${detail}</div>` : raw("")}
        </td>
        <td>${statusLabel}</td>
        <td>${priceText}</td>
      </tr>`.value;
    })
    .join("");

  return html`<h2 class="section-title">経済</h2>
    <style>
      .org-detail { font-family:'Hiragino Sans','Noto Sans JP',sans-serif; font-size:0.72rem; color:var(--ink-soft); margin-top:0.15rem; }
      tr.org-bankrupt td { color: var(--ink-soft); text-decoration: line-through; text-decoration-color: var(--line); }
      tr.org-bankrupt .org-detail { text-decoration: none; }
    </style>
    <div class="news-card">
      <p class="lead">
        物価指数: ${priceIndex ? priceIndex.value.toLocaleString("ja-JP") : "データなし"}
        （基準値100、${priceIndex ? priceIndex.world_date : "-"}時点）
      </p>
    </div>
    <table class="plain" style="margin-top:1rem">
      <thead>
        <tr><th>企業</th><th>状況</th><th>株価</th></tr>
      </thead>
      <tbody>${raw(rows)}</tbody>
    </table>`;
}
