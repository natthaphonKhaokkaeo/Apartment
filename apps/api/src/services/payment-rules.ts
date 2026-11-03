export class PaymentInvariantError extends Error {
 constructor(public code:string){super(code);}
}
const integer=(n:number)=>Number.isSafeInteger(n)&&n>=0&&n<=2147483647;
export function remainingSatang(total:number,approved:number[]):number {
 if(!integer(total) || approved.some(n=>!integer(n))) throw new PaymentInvariantError("INVALID_MONEY");
 const sum=approved.reduce((acc,n)=>acc+n,0);
 if(!Number.isSafeInteger(sum)||sum>total)throw new PaymentInvariantError("INVALID_LEDGER_BALANCE");
 return total-sum;
}
export function assertApprovalAllowed(total:number,alreadyApproved:number,proposed:number):void {
 if(!integer(total)||!integer(alreadyApproved)||!integer(proposed)||proposed===0||alreadyApproved>total)
  throw new PaymentInvariantError("INVALID_PAYMENT_AMOUNT");
 if(proposed>total-alreadyApproved)throw new PaymentInvariantError("OVERPAYMENT_NOT_ALLOWED");
}
export function maskBankAccount(value:string):string {
 const clean=value.replace(/\s/g,"");
 if(!/^\d{8,20}$/.test(clean))throw new PaymentInvariantError("INVALID_BANK_ACCOUNT");
 return "•".repeat(clean.length-4)+clean.slice(-4);
}
export function normalizePaymentReference(value:string):string {
 const s=value.trim().toUpperCase();
 if(!/^[A-Z0-9][A-Z0-9-]{5,79}$/.test(s))throw new PaymentInvariantError("INVALID_TRANSFER_REFERENCE");
 return s;
}
