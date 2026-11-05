/** P1/P5 deposit settlement *preview* only; never initiates a payout.
 * Monetary inputs are integer satang and must come from verified, scoped
 * deposit-ledger and finance-review records before an API is implemented.
 * Explicit deductions/disputes are reserved, never silently netted from rent.
 */
export class DepositSettlementError extends Error {
 constructor(public readonly code:string){super(code);this.name="DepositSettlementError";}
}
const valid=(value:number)=>Number.isSafeInteger(value)&&value>=0&&value<=2147483647;
export type DepositSettlementInput={
 depositReceivedSatang:number;
 refundedSatang:number;
 approvedDeductionsSatang:number;
 proposedDeductionsSatang:number;
 unresolvedDisputeSatang:number;
 outstandingInvoiceSatang:number;
};
export type DepositSettlementPreview={
 depositBalanceSatang:number;
 refundablePreviewSatang:number;
 proposedDeductionsSatang:number;
 unresolvedDisputeSatang:number;
 releaseAllowed:false;
 requiredAction:"DISPUTE_REVIEW"|"INVOICE_SETTLEMENT_REQUIRED"|"OWNER_REVIEW";
};
export function previewDepositSettlement(input:DepositSettlementInput):DepositSettlementPreview{
 const amounts=Object.values(input);
 if(!amounts.every(valid))throw new DepositSettlementError("DEPOSIT_INVALID_AMOUNT");
 const consumed=input.refundedSatang+input.approvedDeductionsSatang;
 if(!Number.isSafeInteger(consumed)||consumed>input.depositReceivedSatang)
  throw new DepositSettlementError("DEPOSIT_LEDGER_INCONSISTENT");
 const depositBalanceSatang=input.depositReceivedSatang-consumed;
 const reserved=input.proposedDeductionsSatang+input.unresolvedDisputeSatang;
 if(!Number.isSafeInteger(reserved)||reserved>depositBalanceSatang)
  throw new DepositSettlementError("DEPOSIT_RESERVATION_EXCEEDS_BALANCE");
 return {
  depositBalanceSatang,
  refundablePreviewSatang:depositBalanceSatang-reserved,
  proposedDeductionsSatang:input.proposedDeductionsSatang,
  unresolvedDisputeSatang:input.unresolvedDisputeSatang,
  releaseAllowed:false,
  requiredAction:input.unresolvedDisputeSatang>0?"DISPUTE_REVIEW":
   input.outstandingInvoiceSatang>0?"INVOICE_SETTLEMENT_REQUIRED":"OWNER_REVIEW",
 };
}
