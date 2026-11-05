import {describe,it,expect} from "vitest";
import {assertProfileAnonymizationAllowed,retentionElapsed} from "../src/services/privacy-policy.js";
const allowed={policyApproved:true,protectedAccount:false,activeOwnerCount:0,activeLeaseCount:0,pendingPaymentCount:0,retentionElapsed:true};
describe("operator-approved profile anonymization boundary",()=>{
 it("allows only an eligible policy-reviewed profile",()=>expect(()=>assertProfileAnonymizationAllowed(allowed)).not.toThrow());
 it.each([
  [{policyApproved:false},"PRIVACY_POLICY_NOT_APPROVED"],
  [{protectedAccount:true},"PRIVACY_PROTECTED_ACCOUNT"],
  [{activeOwnerCount:1},"PRIVACY_OWNER_HANDOFF_REQUIRED"],
  [{activeLeaseCount:1},"PRIVACY_ACTIVE_LEASE"],
  [{pendingPaymentCount:1},"PRIVACY_PAYMENT_REVIEW_PENDING"],
  [{retentionElapsed:false},"PRIVACY_RETENTION_NOT_ELAPSED"],
 ])("rejects a concrete unresolved blocker %j",(patch,code)=>expect(()=>assertProfileAnonymizationAllowed({...allowed,...patch})).toThrow(String(code)));
 it.each([-1,0.5,NaN])("rejects invalid eligibility counts %s",n=>expect(()=>assertProfileAnonymizationAllowed({...allowed,activeLeaseCount:n})).toThrow("PRIVACY_CONTEXT_INVALID"));
 it("uses explicit policy days and date-only boundaries",()=>{expect(retentionElapsed("2026-10-01","2026-10-30",30)).toBe(false);expect(retentionElapsed("2026-10-01","2026-10-31",30)).toBe(true);});
 it("rejects invalid dates and retention policies",()=>{expect(()=>retentionElapsed("2026-02-30","2026-11-05",30)).toThrow();expect(()=>retentionElapsed("2026-10-01","2026-11-05",0)).toThrow();});
});
