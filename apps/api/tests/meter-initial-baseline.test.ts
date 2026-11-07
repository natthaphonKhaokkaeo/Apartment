import {describe,expect,it} from "vitest";
import {resolveMeterStartBoundary,checkMeterReadingProgression} from "../src/services/meter-initial-baseline.js";
const sample=(readAt:string,value:string,id="reading")=>({readAt,value,id});
describe("meter first-period baseline",()=>{
 it("uses explicitly recorded initial value when present",()=>{
  expect(resolveMeterStartBoundary("2026-11-01",[sample("2026-11-01","123.000")],[])).toMatchObject({value:"123.000",assumedZero:false});
 });
 it("assumes 0 only when there is no earlier reading or replacement",()=>{
  expect(resolveMeterStartBoundary("2026-11-01",[sample("2026-12-01","25.000")],[])).toMatchObject({value:"0",id:null,assumedZero:true});
  expect(resolveMeterStartBoundary("2026-11-01",[],[]).value).toBe("0");
 });
 it("uses latest dated reading within the previous month as opening, never resets to zero",()=>{
  expect(resolveMeterStartBoundary("2026-12-01",[sample("2026-11-01","30.000"),sample("2026-11-25","45.000")],[])).toMatchObject({value:"45.000",readAt:"2026-11-25",assumedZero:false});
  expect(()=>resolveMeterStartBoundary("2026-12-01",[sample("2026-10-20","30.000")],[])).toThrow("METER_BOUNDARY_READING_REQUIRED");
  expect(()=>resolveMeterStartBoundary("2026-12-01",[],[{replacedAt:"2026-11-01"}])).toThrow("METER_BOUNDARY_READING_REQUIRED");
 });
 it("does not invent baseline 0 when a replacement precedes the first bill",()=>{
  expect(()=>resolveMeterStartBoundary("2026-12-01",[],[{replacedAt:"2026-12-01"}])).toThrow("METER_BOUNDARY_READING_REQUIRED");
 });
 it("rejects actual decreasing readings but accepts 0 as first historical reading",()=>{
  expect(checkMeterReadingProgression("2026-11-01","0",[sample("2026-12-01","80.000")],[])).toBeNull();
  expect(checkMeterReadingProgression("2026-12-01","0",[sample("2026-11-01","80.000")],[])).toBe("NON_MONOTONIC_READING");
 });
});
