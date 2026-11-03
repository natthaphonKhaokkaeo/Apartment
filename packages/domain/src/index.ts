export type Cadence = "MONTHLY" | "SEMI_MONTHLY" | "EVERY_15_DAYS";
export type Period = { start: string; endExclusive: string };
const DAY = 86400000;

export function parseDay(day: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("INVALID_DATE");
  const parsed = new Date(day + "T00:00:00.000Z");
  if (!Number.isFinite(+parsed) || parsed.toISOString().slice(0, 10) !== day) throw new Error("INVALID_DATE");
  return parsed;
}
function iso(d: Date): string { return d.toISOString().slice(0, 10); }
function addDays(day: string, count: number): string { return iso(new Date(+parseDay(day) + count * DAY)); }
function firstOfNextMonth(y: number, m: number): string { return iso(new Date(Date.UTC(y, m, 1))); }
export function periodsForMonth(year: number, month: number, cadence: Exclude<Cadence, "EVERY_15_DAYS">): Period[] {
  if (!Number.isInteger(year) || year < 1970 || !Number.isInteger(month) || month < 1 || month > 12) throw new Error("INVALID_MONTH");
  const first = iso(new Date(Date.UTC(year, month - 1, 1)));
  const next = firstOfNextMonth(year, month);
  return cadence === "MONTHLY" ? [{start: first, endExclusive: next}] :
    [{start: first, endExclusive: iso(new Date(Date.UTC(year, month - 1, 16)))},
     {start: iso(new Date(Date.UTC(year, month - 1, 16))), endExclusive: next}];
}
export function rollingPeriods(anchor: string, count: number): Period[] {
  parseDay(anchor);
  if (!Number.isInteger(count) || count < 1 || count > 50) throw new Error("INVALID_COUNT");
  return Array.from({length: count}, (_, i) => ({start: addDays(anchor, i * 15), endExclusive: addDays(anchor, (i + 1) * 15)}));
}
function halfUp(numerator: bigint, denominator: bigint): bigint {
  if (numerator < 0n || denominator <= 0n) throw new Error("INVALID_AMOUNT");
  return (numerator * 2n + denominator) / (denominator * 2n);
}
export function safeMoney(v: bigint): number {
  if (v > BigInt(Number.MAX_SAFE_INTEGER) || v < 0n) throw new Error("MONEY_OVERFLOW");
  return Number(v);
}
export function rentForPeriod(monthlyRentSatang: number, start: string, endExclusive: string): number {
  if (!Number.isSafeInteger(monthlyRentSatang) || monthlyRentSatang < 0) throw new Error("INVALID_RENT");
  const from = parseDay(start), to = parseDay(endExclusive);
  if (from >= to || (+to - +from) / DAY > 366) throw new Error("INVALID_PERIOD");
  let cents = 0n;
  let cursor = new Date(from);
  while (cursor < to) {
    const y = cursor.getUTCFullYear(), m = cursor.getUTCMonth();
    const monthEnd = new Date(Date.UTC(y, m + 1, 1));
    const clipEnd = monthEnd < to ? monthEnd : to;
    const duration = BigInt((+clipEnd - +cursor) / DAY);
    const days = BigInt((+monthEnd - +new Date(Date.UTC(y, m, 1))) / DAY);
    const full = BigInt(monthlyRentSatang);
    // Last semi-month portion carries residual so full occupancy sums exactly.
    const isSecondHalf = cursor.getUTCDate() === 16 && +clipEnd === +monthEnd;
    const firstDays = 15n;
    const part = isSecondHalf ? full - halfUp(full * firstDays, days) : halfUp(full * duration, days);
    cents += part;
    cursor = clipEnd;
  }
  return safeMoney(cents);
}
/** Meter input is decimal thousands (e.g. 1.234 -> 1234), tariff is satang/unit. */
export function utilitySatang(previousMilli: number, currentMilli: number, tariffSatang: number): number {
  if (![previousMilli, currentMilli, tariffSatang].every(Number.isSafeInteger) ||
      previousMilli < 0 || currentMilli < previousMilli || tariffSatang < 0) throw new Error("INVALID_METER");
  return safeMoney(halfUp(BigInt(currentMilli - previousMilli) * BigInt(tariffSatang), 1000n));
}
export function readingToMilli(raw: string): number {
  if (!/^\d{1,11}(\.\d{1,3})?$/.test(raw)) throw new Error("INVALID_READING");
  const [whole, frac = ""] = raw.split(".");
  const total = BigInt(whole) * 1000n + BigInt(frac.padEnd(3, "0"));
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("INVALID_READING");
  return Number(total);
}
export function effectiveRate(defaultSatang: number, roomOverride: number | null): number {
  const v = roomOverride ?? defaultSatang;
  if (!Number.isSafeInteger(v) || v < 0) throw new Error("INVALID_RATE");
  return v;
}
