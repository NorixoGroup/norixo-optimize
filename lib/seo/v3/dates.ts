/**
 * SEO generator V3 — strict date parsing (pure, no clock access).
 *
 * The S1 types only describe the SHAPE of a date. These functions check that the date exists on the
 * calendar ("2026-02-30" is refused) and that a date-time carries an explicit time zone (a naive
 * "2026-09-01T10:00:00" is refused: its meaning would depend on the machine).
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

const MIN_YEAR = 1990;
const MAX_YEAR = 2100;

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/;

function calendarDateToUtc(year: number, month: number, day: number): number | null {
  if (year < MIN_YEAR || year > MAX_YEAR) return null;
  const ms = Date.UTC(year, month - 1, day);
  const check = new Date(ms);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return ms;
}

/** Epoch milliseconds at 00:00 UTC of a real calendar date, or null. */
export function parseIsoDate(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = DATE_PATTERN.exec(value);
  if (match === null) return null;
  return calendarDateToUtc(Number(match[1]), Number(match[2]), Number(match[3]));
}

/** Epoch milliseconds of a real date-time with an explicit offset, or null. */
export function parseIsoDateTime(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = DATE_TIME_PATTERN.exec(value);
  if (match === null) return null;

  const dayMs = calendarDateToUtc(Number(match[1]), Number(match[2]), Number(match[3]));
  if (dayMs === null) return null;

  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  if (hour > 23 || minute > 59 || second > 59) return null;

  const millis = match[7] === undefined ? 0 : Number(match[7].padEnd(3, "0"));
  let offsetMinutes = 0;
  const zone = match[8]!;
  if (zone !== "Z") {
    const offsetHour = Number(zone.slice(1, 3));
    const offsetMinute = Number(zone.slice(4, 6));
    if (offsetHour > 23 || offsetMinute > 59) return null;
    offsetMinutes = (zone.startsWith("-") ? -1 : 1) * (offsetHour * 60 + offsetMinute);
  }

  return dayMs + ((hour * 60 + minute) * 60 + second) * 1000 + millis - offsetMinutes * 60 * 1000;
}

// ---------------------------------------------------------------------------------------------
// Civil days in an IANA time zone (built-in Intl only; no dependency, no clock access)
// ---------------------------------------------------------------------------------------------

/**
 * True for an IANA zone name this runtime knows, written with its conventional capitalisation
 * ("Europe/Paris", "Asia/Kolkata", "UTC"). Aliases are accepted; "europe/paris" is not.
 */
export function isValidIanaTimeZone(zone: unknown): zone is string {
  if (typeof zone !== "string" || zone.length === 0 || zone.length > 64) return false;
  if (zone !== "UTC" && !/^[A-Z][A-Za-z0-9_+-]*(?:\/[A-Z][A-Za-z0-9_+-]*)+$/.test(zone) && !/^[A-Z][A-Za-z]+$/.test(zone)) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false; // RangeError: unknown time zone
  }
}

/**
 * Epoch milliseconds of the first instant of the civil day `date` (YYYY-MM-DD) in `zone`
 * (00:00 local, or the first existing instant of the day when a clock change skips midnight).
 * Returns null for an unreadable date, an unknown zone, or if the zone cannot be resolved.
 */
export function civilDayStartUtcMs(date: string, zone: string): number | null {
  const day = parseIsoDate(date);
  if (day === null || !isValidIanaTimeZone(zone)) return null;
  const target = civilKey(new Date(day).getUTCFullYear(), new Date(day).getUTCMonth() + 1, new Date(day).getUTCDate());
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" });
  const localKey = (minute: number): number => {
    let year = 0;
    let month = 0;
    let dayOfMonth = 0;
    for (const part of formatter.formatToParts(new Date(minute * 60_000))) {
      if (part.type === "year") year = Number(part.value);
      if (part.type === "month") month = Number(part.value);
      if (part.type === "day") dayOfMonth = Number(part.value);
    }
    return civilKey(year, month, dayOfMonth);
  };
  // Offsets range from UTC-12 to UTC+14, so these bounds bracket the start of the local day.
  let low = (day - 15 * 3_600_000) / 60_000;
  let high = (day + 14 * 3_600_000) / 60_000;
  if (!(localKey(low) < target) || !(localKey(high) >= target)) return null;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (localKey(middle) >= target) high = middle;
    else low = middle;
  }
  return high * 60_000;
}

/** First instant AFTER the civil day `date` in `zone` (the exclusive end of that day). */
export function civilDayEndExclusiveUtcMs(date: string, zone: string): number | null {
  const day = parseIsoDate(date);
  if (day === null) return null;
  const next = new Date(day + DAY_MS);
  const nextDate = `${String(next.getUTCFullYear()).padStart(4, "0")}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
  return civilDayStartUtcMs(nextDate, zone);
}

function civilKey(year: number, month: number, day: number): number {
  return year * 10_000 + month * 100 + day;
}
