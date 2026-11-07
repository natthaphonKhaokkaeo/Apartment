import {describe,expect,it} from "vitest";
import {monthCloseBoundary,monthFromBoundary,latestBoundaryReading} from "../src/services/meter-monthly.js";
const r=(readAt:string,value:string,id=readAt)=>({readAt,value,id});
describe("monthly meter close cycle",()=>{
 it("maps chosen month to exclusive first day of next month, including year turnover",()=>{
  expect(monthCloseBoundary("2026-11")).toBe("2026-12-01");
  expect(monthCloseBoundary("2026-12")).toBe("2027-01-01");
  expect(monthFromBoundary("2027-01-01")).toBe("2026-12");
  expect(()=>monthCloseBoundary("2026-13")).toThrow();
  expect(()=>monthCloseBoundary("2026-1")).toThrow();
  expect(()=>monthCloseBoundary("1900-01")).toThrow();
  expect(()=>monthCloseBoundary("9999-12")).toThrow();
 });
 it("picks the chronologically latest reading for that billing month, not another month",()=>{
  const rows=[r("2026-11-05","10"),r("2026-11-28","80"),r("2026-10-31","2")];
  expect(latestBoundaryReading("2026-12-01",rows)?.value).toBe("80");
  expect(latestBoundaryReading("2026-11-01",rows)?.value).toBe("2");
 });
 it("prefers explicit canonical month close when it exists",()=>{
  const rows=[r("2026-11-27","99"),r("2026-12-01","105")];
  expect(latestBoundaryReading("2026-12-01",rows)?.value).toBe("105");
 });
 it("never substitutes a previous month for missing close month",()=>{
  expect(latestBoundaryReading("2026-12-01",[r("2026-10-31","50")])).toBeUndefined();
 });
 it("midmonth boundary still requires a real reading on that date",()=>{
  expect(latestBoundaryReading("2026-11-16",[r("2026-11-10","20")])).toBeUndefined();
  expect(latestBoundaryReading("2026-11-16",[r("2026-11-16","30")])?.value).toBe("30");
 });
});
