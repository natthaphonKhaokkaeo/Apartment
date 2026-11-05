import {describe,it,expect} from "vitest";
import {depositPosition,validateDepositReceipt,validateDepositProposal,validateDepositReviewer} from "../src/services/deposit-ledger-policy.js";
describe("persisted deposit policy",()=>{
 it("keeps recorded money distinct from bank verification",()=>{
  expect(depositPosition([{kind:"RECEIVED",amountSatang:10000}],[])).toEqual({receivedSatang:10000,deductedSatang:0,balanceSatang:10000,reservedSatang:0,availableSatang:10000,bankVerified:false,payoutEnabled:false});
 });
 it("reserves pending deductions and approved review-only refunds without double deduction",()=>{
  const p=depositPosition([{kind:"RECEIVED",amountSatang:10000},{kind:"DEDUCTION",amountSatang:1000}],[{kind:"DEDUCTION",status:"APPROVED",amountSatang:1000},{kind:"DEDUCTION",status:"PENDING",amountSatang:2000},{kind:"REFUND_REVIEW",status:"APPROVED",amountSatang:3000},{kind:"DISPUTE_REVIEW",status:"REJECTED",amountSatang:1000}]);
  expect(p).toMatchObject({balanceSatang:9000,reservedSatang:5000,availableSatang:4000,payoutEnabled:false});
 });
 it.each([-1,0,0.1,2147483648,NaN,Infinity])("rejects invalid ledger amount %s",amount=>expect(()=>depositPosition([{kind:"RECEIVED",amountSatang:amount}],[])).toThrow());
 it("rejects aggregate overflow",()=>expect(()=>depositPosition([{kind:"RECEIVED",amountSatang:2147483647},{kind:"RECEIVED",amountSatang:1}],[])).toThrow());
 it("rejects debit without receipts",()=>expect(()=>depositPosition([{kind:"DEDUCTION",amountSatang:1}],[])).toThrow());
 it("rejects over-reservation",()=>expect(()=>depositPosition([{kind:"RECEIVED",amountSatang:10}],[{kind:"REFUND_REVIEW",status:"PENDING",amountSatang:11}])).toThrow());
 it("limits new receipts by aggregate integer range",()=>expect(()=>validateDepositReceipt(1,{receivedSatang:2147483647})).toThrow());
 it("limits proposals to unreserved money",()=>{expect(()=>validateDepositProposal(101,{availableSatang:100})).toThrow();expect(()=>validateDepositProposal(100,{availableSatang:100})).not.toThrow();});
 it("requires a different owner for review",()=>{expect(()=>validateDepositReviewer("a","a")).toThrow();expect(()=>validateDepositReviewer("a","b")).not.toThrow();});
});
