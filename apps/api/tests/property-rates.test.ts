import {describe,it,expect} from "vitest";
import {isRateBoundary,selectRateForPeriod} from "../src/services/property-rates.js";

describe("P1-02 append-only property master rates",()=>{
 it("accepts only complete calendar rate period boundaries",()=>{
  expect(isRateBoundary({cadence:"MONTHLY",rollingAnchor:null},"2026-12-01")).toBe(true);
  expect(isRateBoundary({cadence:"MONTHLY",rollingAnchor:null},"2026-12-16")).toBe(false);
  expect(isRateBoundary({cadence:"SEMI_MONTHLY",rollingAnchor:null},"2026-12-16")).toBe(true);
  expect(isRateBoundary({cadence:"SEMI_MONTHLY",rollingAnchor:null},"2026-12-15")).toBe(false);
  expect(isRateBoundary({cadence:"EVERY_15_DAYS",rollingAnchor:"2026-11-01"},"2026-12-01")).toBe(true);
  expect(isRateBoundary({cadence:"EVERY_15_DAYS",rollingAnchor:"2026-11-01"},"2026-11-16")).toBe(true);
  expect(isRateBoundary({cadence:"EVERY_15_DAYS",rollingAnchor:"2026-11-01"},"2026-11-15")).toBe(false);
  expect(isRateBoundary({cadence:"MONTHLY",rollingAnchor:null},"2026-02-30")).toBe(false);
 });
 it("chooses the last immutable rate version and denies crossing a rate boundary",()=>{
  const rates=[
   {id:"base",effectiveFrom:"1900-01-01",rentSatang:200000},
   {id:"next",effectiveFrom:"2026-12-01",rentSatang:250000}
  ];
  expect(selectRateForPeriod(rates,"2026-11-01","2026-12-01").id).toBe("base");
  expect(selectRateForPeriod(rates,"2026-12-01","2027-01-01").id).toBe("next");
  expect(()=>selectRateForPeriod(rates,"2026-11-15","2026-12-15")).toThrow("RATE_CHANGE_WITHIN_BILLING_PERIOD");
 });
});