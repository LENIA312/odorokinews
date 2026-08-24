import { html, RawHtml } from "../utils/html";

export function notFoundView(): RawHtml {
  return html`<div class="empty">
    <h2 class="section-title" style="border:none">ページが見つかりません</h2>
    <p>お探しのページは存在しないか、移動した可能性があります。</p>
    <p><a href="/">トップページへ戻る</a></p>
  </div>`;
}
