import {describe,it,expect} from "vitest";
import {validMoveInPartialPeriod} from "../src/services/billing.js";
describe("P1-03b partial move-in invoice boundaries",()=>{
 const monthly={cadence:"MONTHLY" as const,rollingAnchor:null};
 it("handles semi-month and rolling 15-day lease start",()=>{
  expect(validMoveInPartialPeriod({
   cadence:"SEMI_MONTHLY",rollingAnchor:null
  },"2026-11-20","2026-11-20","2026-12-01")).toBe(true);
  expect(validMoveInPartialPeriod({
   cadence:"EVERY_15_DAYS",rollingAnchor:"2026-11-01"
  },"2026-11-07","2026-11-07","2026-11-16")).toBe(true);
  expect(validMoveInPartialPeriod({
   cadence:"EVERY_15_DAYS",rollingAnchor:"2026-11-01"
  },"2026-11-07","2026-11-07","2026-12-01")).toBe(false);
 });
 it("accepts only exact active lease start through period end",()=>{
  expect(validMoveInPartialPeriod(monthly,"2026-11-10","2026-11-10","2026-12-01")).toBe(true);
  expect(validMoveInPartialPeriod(monthly,"2026-11-10","2026-11-01","2026-12-01")).toBe(false);
  expect(validMoveInPartialPeriod(monthly,"2026-11-10","2026-11-10","2026-11-25")).toBe(false);
 });
});

import {validMoveOutPartialPeriod} from "../src/services/billing.js";
describe("P1-03c guarded partial move-out",()=>{
 const monthly={cadence:"MONTHLY" as const,rollingAnchor:null};
 const semi={cadence:"SEMI_MONTHLY" as const,rollingAnchor:null};
 const now=new Date("2026-11-03T09:00:00Z");
 it("allows final actual occupancy up to observed handover day",()=>{
  expect(validMoveOutPartialPeriod(monthly,"2026-10-01","2026-11-01","2026-11-03",now)).toBe(true);
  expect(validMoveOutPartialPeriod(monthly,"2026-11-01","2026-11-01","2026-11-03",now)).toBe(true);
  expect(validMoveOutPartialPeriod(semi,"2026-11-01","2026-11-01","2026-11-03",now)).toBe(true);
 });
 it("never allows imaginary, duplicate or future final billing intervals",()=>{
  expect(validMoveOutPartialPeriod(monthly,"2026-11-01","2026-11-02","2026-11-03",now)).toBe(false);
  expect(validMoveOutPartialPeriod(monthly,"2026-11-01","2026-11-01","2026-12-01",now)).toBe(false);
  expect(validMoveOutPartialPeriod(monthly,"2026-11-01","2026-11-01","2026-11-05",now)).toBe(false);
 });
});
