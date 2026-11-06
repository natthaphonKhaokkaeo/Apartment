import {AppError} from "../security.js";

/** Fail closed: reissue is only available when no financial/payment workflow has touched the bill. */
export function assertReissueAllowed(input:{status:"ISSUED"|"VOID";claimCount:number;ledgerCount:number;adjustmentCount:number;evidenceCount:number;sendingCount:number}){
 if(input.status!=="ISSUED")throw new AppError(409,"INVOICE_NOT_REISSUABLE");
 if(input.claimCount||input.ledgerCount||input.adjustmentCount||input.evidenceCount)
  throw new AppError(409,"INVOICE_HAS_PAYMENT_ACTIVITY");
 if(input.sendingCount)throw new AppError(409,"LINE_NOTIFICATION_IN_FLIGHT");
}
export function correctedInvoiceTotal(base:number,adjustment:number){
 if(!Number.isSafeInteger(base)||!Number.isSafeInteger(adjustment)||
    base+adjustment<=0||base+adjustment>2147483647)throw new AppError(422,"INVALID_CORRECTED_INVOICE_AMOUNT");
 return base+adjustment;
}
