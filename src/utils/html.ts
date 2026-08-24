// 最小限のHTMLエスケープ + テンプレートリテラルヘルパー。
// DB/AI由来の文字列をそのままHTMLへ埋め込むとXSSにつながるため、
// html`...${value}...` は値を常にエスケープする。安全なHTML片を
// 埋め込みたい場合のみ raw() でマークする。

export class RawHtml {
  constructor(public value: string) {}
}

export function raw(value: string): RawHtml {
  return new RawHtml(value);
}

export function escapeHtml(input: unknown): string {
  const s = String(input ?? "");
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function html(strings: TemplateStringsArray, ...values: unknown[]): RawHtml {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (Array.isArray(v)) {
      out += v.map((item) => (item instanceof RawHtml ? item.value : escapeHtml(item))).join("");
    } else if (v instanceof RawHtml) {
      out += v.value;
    } else {
      out += escapeHtml(v);
    }
    out += strings[i + 1];
  }
  return new RawHtml(out);
}
