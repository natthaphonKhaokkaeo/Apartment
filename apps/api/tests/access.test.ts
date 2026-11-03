import {describe,it,expect} from "vitest";
import {requireAdmin,AppError} from "../src/security.js";
import {validBillingPeriod} from "../src/services/billing.js";
import type {properties} from "../src/db/schema.js";
type Property=typeof properties.$inferSelect;
function prop(cadence:Property["cadence"],anchor:string|null=null):Property{
 return {cadence,rollingAnchor:anchor} as Property;
}
describe("access policy",()=>{
 it("owner cannot invoke platform admin actions",()=>expect(()=>requireAdmin({id:"owner",name:"A",role:"USER"})).toThrow(AppError));
 it("platform super admin is explicit",()=>expect(()=>requireAdmin({id:"root",name:"A",role:"SUPER_ADMIN"})).not.toThrow());
});
describe("billing period policy",()=>{
 it("accepts month boundary",()=>expect(validBillingPeriod(prop("MONTHLY"),"2026-11-01","2026-12-01")).toBe(true));
 it("rejects arbitrary month interval",()=>expect(validBillingPeriod(prop("MONTHLY"),"2026-11-03","2026-12-03")).toBe(false));
 it("accepts first semi-month",()=>expect(validBillingPeriod(prop("SEMI_MONTHLY"),"2026-11-01","2026-11-16")).toBe(true));
 it("accepts second semi-month",()=>expect(validBillingPeriod(prop("SEMI_MONTHLY"),"2026-11-16","2026-12-01")).toBe(true));
 it("rejects rolling period not on anchor",()=>expect(validBillingPeriod(prop("EVERY_15_DAYS","2026-11-03"),"2026-11-04","2026-11-19")).toBe(false));
 it("accepts rolling interval",()=>expect(validBillingPeriod(prop("EVERY_15_DAYS","2026-11-03"),"2026-11-18","2026-12-03")).toBe(true));
});
