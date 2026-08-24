import { html, raw, RawHtml } from "../utils/html";
import type { EconomicDataRow, OrganizationRow } from "../types";

const ORG_STATUS_LABEL: Record<string, string> = {
  active: "通常",
  expanding: "拡大中",
  under_investigation: "調査中",
  recovering: "回復中",
  celebrating: "好調",
};

export function economyView(
  organizations: OrganizationRow[],
  latestByOrg: Map<number, EconomicDataRow>,
  priceIndex: EconomicDataRow | null
): RawHtml {
  const companies = organizations.filter((o) => o.kind === "company");

  const rows = companies
    .map((o) => {
      const data = latestByOrg.get(o.id);
      const priceText = data ? `${data.value.toLocaleString("ja-JP")} 円` : "未上場";
      return html`<tr>
        <td>${o.name}</td>
        <td>${ORG_STATUS_LABEL[o.status] ?? o.status}</td>
        <td>${priceText}</td>
      </tr>`.value;
    })
    .join("");

  return html`<h2 class="section-title">経済</h2>
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
