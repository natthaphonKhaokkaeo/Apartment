import {describe,expect,it} from "vitest";
import {serializeReceivablesCsv} from "../src/services/receivables-csv.js";

const row={
 invoiceId:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
 periodStart:"2026-10-01",
 periodEnd:"2026-10-31",
 dueDate:"2026-11-05",
 totalBilledSatang:100000,
 netManualApprovedSatang:40000,
 internalCreditSatang:10000,
 outstandingSatang:50000,
};
describe("P3 receivables CSV financial export",()=>{
 it("serializes integer satang with fixed safe columns and no personal data",()=>{
  const csv=serializeReceivablesCsv([row]);
  expect(csv).toContain("invoice_id,period_start,period_end,due_date,total_billed_satang");
  expect(csv).toContain(row.invoiceId);
  expect(csv).toContain(",100000,40000,10000,50000");
  expect(csv).not.toContain("tenant");
 });
 it("allows empty exports with fixed header",()=>{
  expect(serializeReceivablesCsv([]).trim().split("\n")).toHaveLength(1);
 });
 it("refuses inconsistent finance totals instead of quietly exporting wrong balances",()=>{
  expect(()=>serializeReceivablesCsv([{...row,outstandingSatang:99999}]))
   .toThrow("RECEIVABLE_TOTAL_MISMATCH");
 });
 it("refuses negative/fractional/unsafe amounts",()=>{
  for(const amount of [-1,0.2,Number.NaN,Number.POSITIVE_INFINITY,Number.MAX_SAFE_INTEGER]){
   expect(()=>serializeReceivablesCsv([{...row,totalBilledSatang:amount}]))
    .toThrow("RECEIVABLE_INVALID_AMOUNT");
  }
 });
 it("denies malformed IDs and dates that could inject spreadsheet formulas",()=>{
  expect(()=>serializeReceivablesCsv([{...row,invoiceId:'=HYPERLINK("http://evil")'}]))
   .toThrow("RECEIVABLE_INVALID_ID");
  expect(()=>serializeReceivablesCsv([{...row,dueDate:"=1+1"}]))
   .toThrow("RECEIVABLE_INVALID_DATE");
  expect(()=>serializeReceivablesCsv([{...row,periodEnd:"2026-02-30"}]))
   .toThrow("RECEIVABLE_INVALID_DATE");
 });
});
