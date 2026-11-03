export type FinancialPosition={
 grossManualApprovedSatang:number;reversedManualSatang:number;
 netManualApprovedSatang:number;internalCreditSatang:number;
 totalAppliedSatang:number;outstandingSatang:number
};
const money=(n:number)=>Number.isSafeInteger(n)&&n>=0&&n<=2147483647;
export function computeFinancialPosition(invoiceSatang:number,gross:number,reversed:number,credit:number):FinancialPosition{
 if(![invoiceSatang,gross,reversed,credit].every(money))throw new Error("INVALID_MONEY");
 if(reversed>gross)throw new Error("REVERSE_EXCEEDS_APPROVAL");
 const net=gross-reversed,applied=net+credit;
 if(!Number.isSafeInteger(applied)||applied>invoiceSatang)throw new Error("FINANCIAL_TOTAL_EXCEEDS_INVOICE");
 return {grossManualApprovedSatang:gross,reversedManualSatang:reversed,
  netManualApprovedSatang:net,internalCreditSatang:credit,totalAppliedSatang:applied,
  outstandingSatang:invoiceSatang-applied};
}
export type AdjustmentKind="INTERNAL_CREDIT"|"REVERSE_MANUAL_PAYMENT"|"REFUND_REVIEW"|"DISPUTE_REVIEW";
export function validateAdjustmentDecision(requester:string,reviewer:string,kind:AdjustmentKind,amount:number,
 outstanding:number,originalLedgerAmount:number):void{
 if(requester===reviewer)throw new Error("SECOND_OWNER_APPROVAL_REQUIRED");
 if(!money(amount)||amount===0||!money(outstanding)||!money(originalLedgerAmount))
  throw new Error("INVALID_MONEY");
 if(kind==="INTERNAL_CREDIT"&&amount>outstanding)throw new Error("ADJUSTMENT_EXCEEDS_OUTSTANDING");
 if(kind==="REVERSE_MANUAL_PAYMENT"&&amount!==originalLedgerAmount)throw new Error("REVERSAL_MUST_MATCH_LEDGER_ENTRY");
}
