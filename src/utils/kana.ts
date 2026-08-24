// 人物一覧の「カラオケの選曲」的な50音インデックス用ヘルパー。

export const KANA_ROWS = ["あ", "か", "さ", "た", "な", "は", "ま", "や", "ら", "わ"] as const;
export type KanaRow = (typeof KANA_ROWS)[number] | "他";

const ROW_CHARS: Record<(typeof KANA_ROWS)[number], string> = {
  あ: "あいうえおぁぃぅぇぉ",
  か: "かきくけこがぎぐげご",
  さ: "さしすせそざじずぜぞ",
  た: "たちつてとだぢづでどっ",
  な: "なにぬねの",
  は: "はひふへほばびぶべぼぱぴぷぺぽ",
  ま: "まみむめも",
  や: "やゆよゃゅょ",
  ら: "らりるれろ",
  わ: "わゐゑをん",
};

/** name_kana の先頭文字から、50音インデックスの行を判定する。判定できなければ "他"。 */
export function kanaRowOf(nameKana: string | null): KanaRow {
  if (!nameKana) return "他";
  const first = nameKana.trim().charAt(0);
  if (!first) return "他";
  for (const row of KANA_ROWS) {
    if (ROW_CHARS[row].includes(first)) return row;
  }
  return "他";
}
