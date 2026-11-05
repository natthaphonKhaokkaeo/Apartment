import {describe,expect,it} from "vitest";
import {previewDepositSettlement,DepositSettlementError} from "../src/services/deposit-settlement.js";

const base={
 depositReceivedSatang:100000,
 refundedSatang:10000,
 approvedDeductionsSatang:20000,
 proposedDeductionsSatang:5000,
 unresolvedDisputeSatang:0,
 outstandingInvoiceSatang:0,
};
describe("P1/P5 deposit settlement accounting — preview only",()=>{
 it("computes non-negative refundable and review amount without executing payouts",()=>{
  expect(previewDepositSettlement(base)).toEqual({
   depositBalanceSatang:70000,
   refundablePreviewSatang:65000,
   proposedDeductionsSatang:5000,
   unresolvedDisputeSatang:0,
   releaseAllowed:false,
   requiredAction:"OWNER_REVIEW",
  });
 });
 it("blocks refund preview when unresolved dispute exists",()=>{
  expect(previewDepositSettlement({...base,unresolvedDisputeSatang:20000})).toMatchObject({
   refundablePreviewSatang:45000,releaseAllowed:false,requiredAction:"DISPUTE_REVIEW",
  });
 });
 it("never automatically offsets a tenant's outstanding rent against deposits",()=>{
  expect(previewDepositSettlement({...base,outstandingInvoiceSatang:1000})).toMatchObject({
   refundablePreviewSatang:65000,releaseAllowed:false,requiredAction:"INVOICE_SETTLEMENT_REQUIRED",
  });
 });
 it("rejects deductions or reserved disputes exceeding the refundable balance",()=>{
  expect(()=>previewDepositSettlement({...base,proposedDeductionsSatang:70001}))
   .toThrowError(DepositSettlementError);
  expect(()=>previewDepositSettlement({...base,unresolvedDisputeSatang:70001}))
   .toThrow("DEPOSIT_RESERVATION_EXCEEDS_BALANCE");
 });
 it("rejects refund or approved deductions exceeding the original deposit",()=>{
  expect(()=>previewDepositSettlement({...base,refundedSatang:90000})).toThrow("DEPOSIT_LEDGER_INCONSISTENT");
  expect(()=>previewDepositSettlement({...base,approvedDeductionsSatang:100001})).toThrow("DEPOSIT_LEDGER_INCONSISTENT");
 });
 it("rejects fractional, negative, unsafe, NaN and excessive satang values",()=>{
  for(const amount of [-1,0.5,Number.NaN,Number.POSITIVE_INFINITY,Number.MAX_SAFE_INTEGER]){
   expect(()=>previewDepositSettlement({...base,depositReceivedSatang:amount})).toThrow("DEPOSIT_INVALID_AMOUNT");
  }
 });
 it("returns a zero refund for a fully accounted deposit",()=>{
  expect(previewDepositSettlement({
   ...base,depositReceivedSatang:50000,refundedSatang:20000,
   approvedDeductionsSatang:30000,proposedDeductionsSatang:0,
  })).toMatchObject({depositBalanceSatang:0,refundablePreviewSatang:0,releaseAllowed:false});
 });
});
