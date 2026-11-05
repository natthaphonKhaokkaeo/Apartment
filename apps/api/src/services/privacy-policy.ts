/** Eligibility only: policy periods must be supplied by an approved operator, never inferred as law. */
export type PrivacyEligibility={policyApproved:boolean;protectedAccount:boolean;activeOwnerCount:number;activeLeaseCount:number;pendingPaymentCount:number;retentionElapsed:boolean};
export function assertProfileAnonymizationAllowed(input:PrivacyEligibility){
 if(![input.activeOwnerCount,input.activeLeaseCount,input.pendingPaymentCount].every(n=>Number.isSafeInteger(n)&&n>=0))throw Error("PRIVACY_CONTEXT_INVALID");
 if(!input.policyApproved)throw Error("PRIVACY_POLICY_NOT_APPROVED");
 if(input.protectedAccount)throw Error("PRIVACY_PROTECTED_ACCOUNT");
 if(input.activeOwnerCount)throw Error("PRIVACY_OWNER_HANDOFF_REQUIRED");
 if(input.activeLeaseCount)throw Error("PRIVACY_ACTIVE_LEASE");
 if(input.pendingPaymentCount)throw Error("PRIVACY_PAYMENT_REVIEW_PENDING");
 if(!input.retentionElapsed)throw Error("PRIVACY_RETENTION_NOT_ELAPSED");
}
export function retentionElapsed(lastDay:string,today:string,days:number){
 if(!Number.isSafeInteger(days)||days<1||days>36500)throw Error("PRIVACY_POLICY_INVALID");
 const parse=(s:string)=>{
  const n=Date.parse(s);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(n)||new Date(n).toISOString().slice(0,10)!==s)throw Error("PRIVACY_DATE_INVALID");
  return n;
 };
 return parse(today)-parse(lastDay)>=days*86400000;
}
