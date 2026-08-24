import { html, raw, RawHtml } from "../utils/html";
import { formatDateTimeJa, formatWorldDateJa } from "../utils/date";
import type { NewsRow, OrganizationRow, PersonRow } from "../types";

// AIは段落の区切りに\n\n(空行)ではなく単なる\n(改行1つ)を使うことも多く、
// \n{2,}だけで分割すると複数の文がひとつの<p>に押し込まれて読みにくくなっていた
// （管理画面の完全手動作成でも同様、改行を1つ入れただけでは反映されない不具合があった）。
// 改行の数に関わらず、1行=1段落として扱う。
function bodyParagraphs(body: string): RawHtml {
  const paragraphs = body
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const list = (paragraphs.length ? paragraphs : [body]).map((p) => html`<p>${p}</p>`.value).join("");
  return raw(list);
}

export function newsDetailView(
  news: NewsRow,
  cityName: string | null,
  relatedPeople: PersonRow[],
  relatedOrgs: OrganizationRow[],
  reporter: PersonRow | null
): RawHtml {
  const peopleChips = relatedPeople.length
    ? html`<div class="chip-row">
        ${relatedPeople.map((p) => html`<a class="chip" href="/people/${p.id}">${p.name}</a>`)}
      </div>`
    : html`<div class="chip-row"><span class="chip">なし</span></div>`;

  const orgChips = relatedOrgs.length
    ? html`<div class="chip-row">${relatedOrgs.map((o) => html`<span class="chip">${o.name}</span>`)}</div>`
    : html`<div class="chip-row"><span class="chip">なし</span></div>`;

  return html`<article class="news-detail">
    <div class="meta">
      <span class="category">${news.category}</span>
      ・${cityName ?? ""} ・ ${formatWorldDateJa(news.occurred_at)}発生 ・ ${formatDateTimeJa(news.published_at)}掲載
    </div>
    <h2>${news.title}</h2>
    <div class="body">${bodyParagraphs(news.body)}</div>
    ${reporter
      ? html`<p class="byline">記者: <a href="/people/${reporter.id}">${reporter.name}</a></p>`
      : raw("")}

    <div class="related-box">
      <h4>関係人物</h4>
      ${peopleChips}
    </div>
    <div class="related-box">
      <h4>関係組織</h4>
      ${orgChips}
    </div>
    <div class="related-box">
      <h4>この記事について</h4>
      <div>元となった世界イベント: <a href="/timeline">年表で確認する →</a></div>
    </div>
  </article>`;
}
