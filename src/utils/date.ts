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

export function formatDateTimeJa(isoStr: string): string {
  const dt = new Date(isoStr);
  if (Number.isNaN(dt.getTime())) return isoStr;
  return `${dt.getUTCFullYear()}年${dt.getUTCMonth() + 1}月${dt.getUTCDate()}日 ${String(
    dt.getUTCHours()
  ).padStart(2, "0")}:${String(dt.getUTCMinutes()).padStart(2, "0")}`;
}
