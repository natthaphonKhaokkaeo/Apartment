import {describe,expect,it} from "vitest";
import {
  PaymentInvariantError,
  assertApprovalAllowed,
  remainingSatang,
  maskBankAccount,
  normalizePaymentReference,
} from "../src/services/payment-rules.js";

describe("P3/P7 financial input security — edge and precision gates", () => {
  it("accepts the exact Postgres int4 satang ceiling and rejects overflow", () => {
    const max = 2_147_483_647;
    expect(remainingSatang(max, [max-1,1])).toBe(0);
    expect(() => assertApprovalAllowed(max, max-1, 1)).not.toThrow();
    for (const value of [max+1, -1, 0.1, Number.NaN, Infinity, -Infinity]) {
      expect(() => remainingSatang(value, [])).toThrow(PaymentInvariantError);
      expect(() => assertApprovalAllowed(max, 0, value)).toThrow(PaymentInvariantError);
    }
  });

  it("rejects over-approval from existing ledger, empty payment and fractional satang", () => {
    expect(() => remainingSatang(10, [6,5])).toThrow("INVALID_LEDGER_BALANCE");
    expect(() => assertApprovalAllowed(10,11,1)).toThrow("INVALID_PAYMENT_AMOUNT");
    expect(() => assertApprovalAllowed(10,10,1)).toThrow("OVERPAYMENT_NOT_ALLOWED");
    expect(() => assertApprovalAllowed(10,0,0)).toThrow("INVALID_PAYMENT_AMOUNT");
    expect(() => assertApprovalAllowed(10,0,1.5)).toThrow("INVALID_PAYMENT_AMOUNT");
  });

  it("keeps only the final 4 digits of valid bank numbers and never accepts junk", () => {
    expect(maskBankAccount("  1234 5678 90  ")).toBe("••••••7890");
    for (const value of ["1234567","123456789012345678901","1234-567890","abcdefghij","12٣4567890"]) {
      expect(() => maskBankAccount(value)).toThrow("INVALID_BANK_ACCOUNT");
    }
  });

  it("normalizes valid transfer references and rejects whitespace, control chars and unicode", () => {
    expect(normalizePaymentReference(" ab1234 ")).toBe("AB1234");
    expect(normalizePaymentReference("a-1234")).toBe("A-1234");
    for (const value of ["a1234", "a 1234", "a\n12345", "ก123456", "A_12345", "-12345", "A".repeat(81)]) {
      expect(() => normalizePaymentReference(value)).toThrow("INVALID_TRANSFER_REFERENCE");
    }
  });
});
