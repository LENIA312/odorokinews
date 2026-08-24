import { html, raw, RawHtml } from "../utils/html";
import { formatWorldDateJa } from "../utils/date";
import type { CityRow, WorldRow } from "../types";

export function worldView(world: WorldRow, cities: CityRow[]): RawHtml {
  const cityCards = cities
    .map((c) => {
      const industries: string[] = c.industries ? JSON.parse(c.industries) : [];
      return html`<div class="news-card">
        <h3>${c.name}${c.is_major ? "（最大都市）" : ""}</h3>
        <p class="lead">人口: ${c.population?.toLocaleString("ja-JP") ?? "不明"}人</p>
        <p>${c.description ?? ""}</p>
        <div class="chip-row">${industries.map((i) => html`<span class="chip">${i}</span>`)}</div>
      </div>`.value;
    })
    .join("");

  return html`<h2 class="section-title">世界について</h2>
    <div class="news-card">
      <h3>${world.name}${world.name_en ? html` <small>(${world.name_en})</small>` : raw("")}</h3>
      <p>${world.origin_story}</p>
      <p class="lead">現在の世界暦: ${formatWorldDateJa(world.current_date)}</p>
    </div>

    <h2 class="section-title" style="margin-top:1.6rem">主要都市</h2>
    ${raw(cityCards)}`;
}
