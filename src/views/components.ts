import { html, RawHtml } from "../utils/html";
import { formatWorldDateJa } from "../utils/date";
import type { WorldRow } from "../types";

export function worldbar(world: WorldRow): RawHtml {
  return html`<div class="worldbar">
    <span>${world.name}（${world.name_en ?? ""}） — 世界暦: ${formatWorldDateJa(world.current_date)}</span>
    <span><a href="/world">世界について →</a></span>
  </div>`;
}

export function leadFromBody(body: string, maxLen = 90): string {
  const firstLine = body.split("\n").find((l) => l.trim().length > 0) ?? "";
  return firstLine.length > maxLen ? `${firstLine.slice(0, maxLen)}…` : firstLine;
}
