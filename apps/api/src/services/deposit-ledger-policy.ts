/** Manual deposit records are not bank verification or instructions to transfer funds. */
export type DepositEntry={kind:"RECEIVED"|"DEDUCTION";amountSatang:number};
export type DepositReview={kind:"DEDUCTION"|"REFUND_REVIEW"|"DISPUTE_REVIEW";status:"PENDING"|"APPROVED"|"REJECTED";amountSatang:number};
const maximum=2147483647;
function amount(n:number){if(!Number.isSafeInteger(n)||n<=0||n>maximum)throw Error("DEPOSIT_INVALID_AMOUNT");}
export function depositPosition(entries:DepositEntry[],reviews:DepositReview[]){
 let receivedSatang=0,deductedSatang=0,reservedSatang=0;
 for(const e of entries){amount(e.amountSatang);if(e.kind==="RECEIVED")receivedSatang+=e.amountSatang;else deductedSatang+=e.amountSatang;}
 for(const r of reviews){
  amount(r.amountSatang);
  if(r.status==="PENDING"||(r.status==="APPROVED"&&r.kind!=="DEDUCTION"))reservedSatang+=r.amountSatang;
 }
 const balanceSatang=receivedSatang-deductedSatang;
 if(receivedSatang>maximum||deductedSatang>receivedSatang||reservedSatang>balanceSatang)
  throw Error("DEPOSIT_LEDGER_INCONSISTENT");
 return {receivedSatang,deductedSatang,balanceSatang,reservedSatang,availableSatang:balanceSatang-reservedSatang,bankVerified:false as const,payoutEnabled:false as const};
}
export function validateDepositReceipt(value:number,position:{receivedSatang:number}){
 amount(value);if(position.receivedSatang+value>maximum)throw Error("DEPOSIT_TOTAL_OVERFLOW");
}
export function validateDepositProposal(value:number,position:{availableSatang:number}){
 amount(value);if(value>position.availableSatang)throw Error("DEPOSIT_EXCEEDS_AVAILABLE");
}
export function validateDepositReviewer(requester:string,reviewer:string){
 if(requester===reviewer)throw Error("SECOND_OWNER_APPROVAL_REQUIRED");
}
