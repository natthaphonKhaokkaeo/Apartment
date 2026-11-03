import {describe,it,expect} from "vitest";
import {remainingSatang,assertApprovalAllowed,maskBankAccount,normalizePaymentReference} from "../src/services/payment-rules.js";
describe("P3 money & payment invariants",()=>{
 it("integer-satang accounting",()=>{
  expect(remainingSatang(413000,[120000,130000])).toBe(163000);
  expect(remainingSatang(413000,[413000])).toBe(0);
 });
 it("allows exact remaining and partial, rejects overpayment",()=>{
  expect(()=>assertApprovalAllowed(413000,250000,163000)).not.toThrow();
  expect(()=>assertApprovalAllowed(413000,250000,163001)).toThrow("OVERPAYMENT_NOT_ALLOWED");
  expect(()=>assertApprovalAllowed(413000,0,0)).toThrow();
  expect(()=>assertApprovalAllowed(413000,413001,1)).toThrow();
 });
 it("rejects negative, unsafe, overflow or inconsistent ledger values",()=>{
  expect(()=>remainingSatang(500,[501])).toThrow();
  expect(()=>remainingSatang(100,[-1])).toThrow();
  expect(()=>remainingSatang(100,[1.5])).toThrow();
  expect(()=>assertApprovalAllowed(100,99,Number.MAX_SAFE_INTEGER+1)).toThrow();
 });
 it("does not expose full bank number in owner summary",()=>{
  expect(maskBankAccount("1234567890")).toBe("••••••7890");
 });
 it("normalizes transfer reference to catch duplicates",()=>{
  expect(normalizePaymentReference("  abc-123xyz ")).toBe("ABC-123XYZ");
  expect(()=>normalizePaymentReference("")).toThrow();
  expect(()=>normalizePaymentReference("a b")).toThrow();
 });
});
