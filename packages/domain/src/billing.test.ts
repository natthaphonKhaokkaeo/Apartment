import {describe, expect, it} from "vitest";
import {periodsForMonth, rollingPeriods, rentForPeriod, utilitySatang, readingToMilli, effectiveRate} from "./index.js";
describe("billing invariants", () => {
  it("monthly 2026 November", () => expect(periodsForMonth(2026,11,"MONTHLY")).toEqual([{start:"2026-11-01",endExclusive:"2026-12-01"}]));
  it("semi monthly is calendar half, not rolling fifteen", () => expect(periodsForMonth(2026,11,"SEMI_MONTHLY")[1]).toEqual({start:"2026-11-16",endExclusive:"2026-12-01"}));
  it("rolling 15 crosses month", () => expect(rollingPeriods("2026-11-03",2)[1]).toEqual({start:"2026-11-18",endExclusive:"2026-12-03"}));
  it("31-day halves reconcile exactly", () => expect(rentForPeriod(400001,"2026-01-01","2026-01-16") + rentForPeriod(400001,"2026-01-16","2026-02-01")).toBe(400001));
  it("leap day full February", () => expect(rentForPeriod(300099,"2028-02-01","2028-03-01")).toBe(300099));
  it("cross-month rolling prorates per calendar month", () => expect(rentForPeriod(310000,"2026-01-25","2026-02-09")).toBe(70000 + 88571));
  it("meter uses three decimals without float math", () => expect(utilitySatang(readingToMilli("12.250"),readingToMilli("14.375"),400)).toBe(850));
  it("rejects decreasing readings", () => expect(() => utilitySatang(1100,1000,500)).toThrow());
  it("override zero is explicit", () => expect(effectiveRate(400000,0)).toBe(0));
  it("inherit null", () => expect(effectiveRate(400000,null)).toBe(400000));
  it("rejects malformed date", () => expect(() => rollingPeriods("2026-02-30",1)).toThrow());
});
