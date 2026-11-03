import {describe,it,expect} from "vitest";
import {sumReplacedMeterUsage,readingSegmentIndex} from "../src/services/meter-replacement.js";

describe("P1-03c meter-replacement continuity",()=>{
 const switches=[
  {replacedAt:"2026-11-10",oldClosingMilli:120000,newOpeningMilli:5000},
  {replacedAt:"2026-11-20",oldClosingMilli:19000,newOpeningMilli:0}
 ];
 it("sums 3 different physical meters without false negative reset",()=>{
  expect(sumReplacedMeterUsage(100000,7000,switches )).toBe(41000);
 });
 it("rejects backwards, duplicate, boundary and invalid meter segments",()=>{
  expect(()=>sumReplacedMeterUsage(130000,7000,switches)).toThrow();
  expect(()=>sumReplacedMeterUsage(100000,7000,[switches[0],switches[0]])).toThrow();
  expect(()=>sumReplacedMeterUsage(100000,7000,[{...switches[0],newOpeningMilli:-1}])).toThrow();
 });
 it("calculates reading monotonicity only within a physical meter segment",()=>{
  expect(readingSegmentIndex("2026-11-09",switches)).toBe(0);
  expect(readingSegmentIndex("2026-11-10",switches)).toBe(1);
  expect(readingSegmentIndex("2026-11-20",switches)).toBe(2);
 });
});
