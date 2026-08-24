// 世界日付は "YYYY-MM-DD" の文字列として一貫して扱う。

export function nextWorldDate(current: string): string {
  const [y, m, d] = current.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
}

export function formatWorldDateJa(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${y}年${m}月${d}日`;
}

const WEEKDAY_JA = ["日", "月", "火", "水", "木", "金", "土"];

export function formatWorldDateWithWeekdayJa(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const weekday = WEEKDAY_JA[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${y}年${m}月${d}日（${weekday}）`;
}

/**
 * 生年月日を機械的に算出する: 基準となる世界暦日付から年齢分をさかのぼり、
 * さらに0〜299日のランダムなずれを与える（全員が同じ月日にならないように）。
 * AIが新規作成する人物の生年月日は、この関数で算出しAIには書かせない
 * （scripts/backfill_life_details.sql の既存人物向けロジックと同じ考え方）。
 */
export function computeBirthDateFromAge(referenceDate: string, age: number | null): string | null {
  if (age == null) return null;
  const [y, m, d] = referenceDate.split("-").map(Number);
  const base = new Date(Date.UTC(y - age, m - 1, d));
  base.setUTCDate(base.getUTCDate() - Math.floor(Math.random() * 300));
  return base.toISOString().slice(0, 10);
}

// published_atはUTCのISO文字列で保存されている（Workersのnew Date()は常にUTC）。
// サイトの読者は日本時間を前提にしているため、表示直前にJST(UTC+9)へ変換する
// （以前はUTCのままgetUTCHours等で表示しており、実際の掲載時刻より9時間早い時刻が
// 表示されるバグがあった）。
export function formatDateTimeJa(isoStr: string): string {
  const dt = new Date(isoStr);
  if (Number.isNaN(dt.getTime())) return isoStr;
  const jst = new Date(dt.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}年${jst.getUTCMonth() + 1}月${jst.getUTCDate()}日 ${String(
    jst.getUTCHours()
  ).padStart(2, "0")}:${String(jst.getUTCMinutes()).padStart(2, "0")}`;
}
