const LAGOS_OFFSET_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function lagosDayRange(now = new Date()) {
  const lagos = new Date(now.getTime() + LAGOS_OFFSET_MS);
  const start = new Date(Date.UTC(lagos.getUTCFullYear(), lagos.getUTCMonth(), lagos.getUTCDate()) - LAGOS_OFFSET_MS);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

export function lagosDayRangeFromDate(dateString) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString || "");
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utcDay = new Date(Date.UTC(year, month - 1, day));
  if (
    utcDay.getUTCFullYear() !== year ||
    utcDay.getUTCMonth() !== month - 1 ||
    utcDay.getUTCDate() !== day
  ) {
    return null;
  }

  const start = new Date(utcDay.getTime() - LAGOS_OFFSET_MS);

  return { start, end: new Date(start.getTime() + DAY_MS) };
}
