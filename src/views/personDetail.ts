import { html, raw, RawHtml } from "../utils/html";
import { formatWorldDateJa } from "../utils/date";
import type { NewsRow, OrganizationRow, PersonRow, RelationshipRow } from "../types";

const RELATION_LABEL: Record<string, string> = {
  family_parent: "親",
  family_child: "子",
  spouse: "配偶者",
  colleague: "同僚",
  friend: "友人",
};

export function personDetailView(
  person: PersonRow,
  organization: OrganizationRow | null,
  relationships: Array<{ row: RelationshipRow; other: PersonRow }>,
  relatedNews: NewsRow[]
): RawHtml {
  const relChips = relationships.length
    ? html`<div class="chip-row">
        ${relationships.map(
          (r) =>
            html`<a class="chip" href="/people/${r.other.id}"
              >${r.other.name}（${RELATION_LABEL[r.row.relation_type] ?? r.row.relation_type}）</a
            >`
        )}
      </div>`
    : html`<div class="chip-row"><span class="chip">なし</span></div>`;

  const newsItems = relatedNews.length
    ? html`<div class="chip-row" style="flex-direction:column;align-items:flex-start">
        ${relatedNews.map(
          (n) =>
            html`<a class="chip" href="/news/${n.id}"
              >${formatWorldDateJa(n.occurred_at)}: ${n.title}</a
            >`
        )}
      </div>`
    : html`<div class="empty">関連ニュースはまだありません。</div>`;

  return html`<div class="news-card">
      <h2 style="margin:0 0 0.4rem">${person.name}</h2>
      <p class="lead">
        ${person.occupation ?? "不明"}${organization ? html` ・ ${organization.name}` : raw("")}
      </p>
      <table class="plain" style="margin-top:0.8rem">
        <tr><th>年齢</th><td>${person.age ?? "不明"}</td></tr>
        <tr><th>性別</th><td>${person.gender ?? "不明"}</td></tr>
        <tr><th>居住地</th><td>ダイナン</td></tr>
        <tr><th>現在の状態</th><td>${person.status}</td></tr>
        ${person.bio ? html`<tr><th>プロフィール</th><td>${person.bio}</td></tr>` : raw("")}
      </table>
    </div>

    <div class="related-box">
      <h4>人間関係</h4>
      ${relChips}
    </div>

    <h2 class="section-title" style="margin-top:1.6rem">関連ニュース</h2>
    ${newsItems}`;
}
