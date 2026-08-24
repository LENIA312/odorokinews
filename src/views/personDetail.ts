import { html, raw, RawHtml } from "../utils/html";
import { formatWorldDateJa } from "../utils/date";
import { PERSON_STATUS_LABEL, RELATION_TYPE_LABEL } from "../constants";
import type { CityRow, NewsRow, OrganizationRow, PersonRow, RelationshipRow } from "../types";

function formatIncome(value: number | null): string {
  if (value == null) return "不明";
  return `${value.toLocaleString("ja-JP")}円`;
}

interface FamilyTree {
  parents: PersonRow[];
  spouses: PersonRow[];
  siblings: PersonRow[];
  children: PersonRow[];
}

function buildFamilyTree(relationships: Array<{ row: RelationshipRow; other: PersonRow }>): FamilyTree {
  const parents: PersonRow[] = [];
  const spouses: PersonRow[] = [];
  const siblings: PersonRow[] = [];
  const children: PersonRow[] = [];
  for (const r of relationships) {
    if (r.row.relation_type === "family_parent") parents.push(r.other);
    else if (r.row.relation_type === "spouse") spouses.push(r.other);
    else if (r.row.relation_type === "family_sibling") siblings.push(r.other);
    else if (r.row.relation_type === "family_child") children.push(r.other);
  }
  return { parents, spouses, siblings, children };
}

function familyTreeView(person: PersonRow, tree: FamilyTree): RawHtml {
  const hasAnyFamily = tree.parents.length || tree.spouses.length || tree.siblings.length || tree.children.length;
  if (!hasAnyFamily) {
    return html`<div class="empty">家系図に登録されている家族はまだいません。</div>`;
  }

  const personChip = (p: PersonRow) => html`<a class="chip" href="/people/${p.id}">${p.name}</a>`;

  const row = (label: string, people: PersonRow[]) =>
    people.length
      ? html`<div class="family-tree-row">
          <span class="row-label">${label}</span>
          ${people.map(personChip)}
        </div>`
      : raw("");

  const selfRow = html`<div class="family-tree-row">
    <span class="row-label">本人</span>
    <span class="chip self">${person.name}</span>
    ${tree.spouses.map(personChip)}
  </div>`;

  return html`<div class="family-tree">
    ${row("親", tree.parents)} ${selfRow} ${row("兄弟姉妹", tree.siblings)} ${row("子", tree.children)}
  </div>`;
}

export function personDetailView(
  person: PersonRow,
  organization: OrganizationRow | null,
  city: CityRow | null,
  relationships: Array<{ row: RelationshipRow; other: PersonRow }>,
  relatedNews: NewsRow[]
): RawHtml {
  const tree = buildFamilyTree(relationships);

  const relChips = relationships.length
    ? html`<div class="chip-row">
        ${relationships.map(
          (r) =>
            html`<a class="chip" href="/people/${r.other.id}"
              >${r.other.name}（${RELATION_TYPE_LABEL[r.row.relation_type] ?? r.row.relation_type}）</a
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

  const statusLabel = PERSON_STATUS_LABEL[person.status] ?? person.status;

  return html`<div class="news-card">
      <h2 style="margin:0 0 0.4rem">${person.name}</h2>
      <p class="lead">
        ${person.job_title ? `${person.job_title} / ` : ""}${person.occupation ?? "不明"}${organization
          ? html` ・ ${organization.name}`
          : raw("")}
      </p>
      <table class="plain" style="margin-top:0.8rem">
        <tr><th>年齢</th><td>${person.age ?? "不明"}</td></tr>
        <tr><th>性別</th><td>${person.gender ?? "不明"}</td></tr>
        <tr><th>生年月日</th><td>${person.birth_date ? formatWorldDateJa(person.birth_date) : "不明"}</td></tr>
        <tr><th>生まれ</th><td>${person.birthplace ?? "不明"}</td></tr>
        <tr><th>居住地</th><td>${city?.name ?? "不明"}</td></tr>
        <tr><th>就職先</th><td>${organization?.name ?? "無所属"}</td></tr>
        <tr><th>役職</th><td>${person.job_title ?? "不明"}</td></tr>
        <tr><th>年収</th><td>${formatIncome(person.annual_income)}</td></tr>
        <tr><th>現在の状態</th><td>${statusLabel}</td></tr>
        ${person.bio ? html`<tr><th>プロフィール</th><td>${person.bio}</td></tr>` : raw("")}
      </table>
    </div>

    <div class="related-box">
      <h4>家系図</h4>
      ${familyTreeView(person, tree)}
    </div>

    <div class="related-box">
      <h4>人間関係</h4>
      ${relChips}
    </div>

    <h2 class="section-title" style="margin-top:1.6rem">関連ニュース</h2>
    ${newsItems}`;
}
