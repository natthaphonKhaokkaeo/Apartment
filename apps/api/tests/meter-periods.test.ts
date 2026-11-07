import {describe,expect,it} from "vitest";
import {meterPeriodsStartingInMonth} from "@apartment/domain";
describe("meter month and subperiod selection",()=>{
 it("monthly uses exactly one month-close record",()=>{
  expect(meterPeriodsStartingInMonth(2026,11,"MONTHLY")).toEqual([{start:"2026-11-01",endExclusive:"2026-12-01"}]);
 });
 it("semi monthly exposes a month plus first/second cycle, not a day input",()=>{
  expect(meterPeriodsStartingInMonth(2026,11,"SEMI_MONTHLY")).toEqual([
   {start:"2026-11-01",endExclusive:"2026-11-16"},
   {start:"2026-11-16",endExclusive:"2026-12-01"}
  ]);
 });
 it("rolling 15-day options follow the configured anchor and may cross months",()=>{
  expect(meterPeriodsStartingInMonth(2026,11,"EVERY_15_DAYS","2026-10-17")).toEqual([
   {start:"2026-11-01",endExclusive:"2026-11-16"},
   {start:"2026-11-16",endExclusive:"2026-12-01"}
  ]);
  expect(meterPeriodsStartingInMonth(2026,11,"EVERY_15_DAYS","2026-11-28")).toEqual([
   {start:"2026-11-28",endExclusive:"2026-12-13"}
  ]);
 });
 it("does not allow cycles before the rolling anchor",()=>{
  expect(meterPeriodsStartingInMonth(2026,10,"EVERY_15_DAYS","2026-11-05")).toEqual([]);
 });
});
