import {describe,it,expect} from "vitest";
import {computeFinancialPosition,validateAdjustmentDecision} from "../src/services/financial-rules.js";
describe("financial correction invariants",()=>{
 it("never mutates original approvals; calculates net applied including credits and reversals",()=>{
  expect(computeFinancialPosition(500000,300000,100000,50000)).toEqual({
   grossManualApprovedSatang:300000, reversedManualSatang:100000,
   netManualApprovedSatang:200000,internalCreditSatang:50000,
   totalAppliedSatang:250000,outstandingSatang:250000
  });
 });
 it("rejects negative, overapplied and unsafe numbers",()=>{
  expect(()=>computeFinancialPosition(10000,20000,0,0)).toThrow("FINANCIAL_TOTAL_EXCEEDS_INVOICE");
  expect(()=>computeFinancialPosition(10000,1000,2000,0)).toThrow("REVERSE_EXCEEDS_APPROVAL");
  expect(()=>computeFinancialPosition(10000,0,-1,0)).toThrow("INVALID_MONEY");
 });
 it("requires another owner for all financial decisions",()=>{
  expect(()=>validateAdjustmentDecision("same","same","INTERNAL_CREDIT",50000,50000,0)).toThrow("SECOND_OWNER_APPROVAL_REQUIRED");
  expect(()=>validateAdjustmentDecision("first","second","INTERNAL_CREDIT",50001,50000,0)).toThrow("ADJUSTMENT_EXCEEDS_OUTSTANDING");
  expect(()=>validateAdjustmentDecision("first","second","REVERSE_MANUAL_PAYMENT",9900,10000,10000)).toThrow("REVERSAL_MUST_MATCH_LEDGER_ENTRY");
  expect(()=>validateAdjustmentDecision("first","second","INTERNAL_CREDIT",50000,50000,0)).not.toThrow();
 });
});