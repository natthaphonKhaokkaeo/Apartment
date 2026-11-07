import {describe,expect,it} from "vitest";
import {reportInvoiceFinancials,safeRoomInvoiceReportRange} from "../src/services/invoice-room-report.js";

describe("owner invoice room report financial invariants",()=>{
 it("excludes cancelled invoices from outstanding balances but keeps their history",()=>{
  expect(reportInvoiceFinancials("VOID",50000,0,0,0)).toEqual({paidSatang:0,creditSatang:0,outstandingSatang:0});
 });
 it("computes issued invoice debt from ledger and adjustments",()=>{
  expect(reportInvoiceFinancials("ISSUED",50000,20000,5000,3000)).toEqual({paidSatang:15000,creditSatang:3000,outstandingSatang:32000});
 });
 it("rejects inconsistent financial entries",()=>{
  expect(()=>reportInvoiceFinancials("ISSUED",1000,2000,0,0)).toThrow();
  expect(()=>reportInvoiceFinancials("ISSUED",1000,0,0,-1)).toThrow();
 });
 it("validates optional report dates and their order",()=>{
  expect(safeRoomInvoiceReportRange("2026-11-01","2026-11-30")).toBe(true);
  expect(safeRoomInvoiceReportRange("2026-12-01","2026-11-01")).toBe(false);
  expect(safeRoomInvoiceReportRange("2026-02-30","2026-03-10")).toBe(false);
  expect(safeRoomInvoiceReportRange(undefined,undefined)).toBe(true);
 });
});
