import {describe,expect,it} from "vitest";
import {summarizePropertyFinancials} from "../src/services/property-financial-summary.js";

describe("summarizePropertyFinancials",()=>{
 it("aggregates integer-satang invoices and only posted adjustments by billing month",()=>{
  const report=summarizePropertyFinancials(
   [{id:"a",periodStart:"2026-10-01",amountSatang:100_000},
    {id:"b",periodStart:"2026-10-15",amountSatang:50_000}],
   [{invoiceId:"a",amountSatang:60_000},{invoiceId:"b",amountSatang:20_000}],
   [{invoiceId:"a",kind:"REVERSE_MANUAL_PAYMENT",amountSatang:10_000},
    {invoiceId:"a",kind:"INTERNAL_CREDIT",amountSatang:5_000},
    {invoiceId:"b",kind:"REFUND_REVIEW",amountSatang:8_000}],
  );
  expect(report.totals).toEqual({
   invoiceCount:2,totalBilledSatang:150_000,grossManualApprovedSatang:80_000,
   reversedManualSatang:10_000,netManualApprovedSatang:70_000,
   internalCreditSatang:5_000,outstandingSatang:75_000,
  });
  expect(report.months).toHaveLength(1);
  expect(report.months[0]?.month).toBe("2026-10");
 });
 it("returns zero-valued totals for an empty period",()=>{
  expect(summarizePropertyFinancials([],[],[]).totals).toEqual({
   invoiceCount:0,totalBilledSatang:0,grossManualApprovedSatang:0,
   reversedManualSatang:0,netManualApprovedSatang:0,internalCreditSatang:0,
   outstandingSatang:0,
  });
 });
 it("rejects inconsistent per-invoice ledger totals",()=>{
  expect(()=>summarizePropertyFinancials(
   [{id:"a",periodStart:"2026-10-01",amountSatang:10}],
   [{invoiceId:"a",amountSatang:1}],
   [{invoiceId:"a",kind:"REVERSE_MANUAL_PAYMENT",amountSatang:2}],
  )).toThrow("REVERSE_EXCEEDS_APPROVAL");
 });
});
