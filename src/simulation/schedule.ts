// 管理画面から変更できる「自動配信時刻(JST)」の判定ロジック。
// wrangler.jsonc のCronは短い間隔(10分おき)でこのモジュールを呼び出すだけにし、
// 実際にシミュレーションを走らせるかどうかはDBに保存された時刻設定で決める。
// こうすることで、Cronの再デプロイなしに配信時刻を変更できる。

function toJstParts(utcDate: Date): { dateStr: string; timeStr: string } {
  const shifted = new Date(utcDate.getTime() + 9 * 60 * 60 * 1000);
  const iso = shifted.toISOString();
  return { dateStr: iso.slice(0, 10), timeStr: iso.slice(11, 16) };
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function parseAutoPublishTimes(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((t): t is string => typeof t === "string" && TIME_RE.test(t));
  } catch {
    return [];
  }
}

/**
 * 現在時刻(UTC)時点で「もう発火すべきなのにまだ発火していない」最新の枠を返す。
 * 該当がなければ null。
 */
export function findDueSlot(nowUtc: Date, autoPublishTimesJson: string, lastSlot: string | null): string | null {
  const times = parseAutoPublishTimes(autoPublishTimesJson);
  if (times.length === 0) return null;

  const { dateStr, timeStr } = toJstParts(nowUtc);
  const nowSlot = `${dateStr} ${timeStr}`;

  const due = times
    .map((t) => `${dateStr} ${t}`)
    .filter((slot) => slot <= nowSlot)
    .filter((slot) => !lastSlot || slot > lastSlot)
    .sort();

  return due.length ? due[due.length - 1] : null;
}
