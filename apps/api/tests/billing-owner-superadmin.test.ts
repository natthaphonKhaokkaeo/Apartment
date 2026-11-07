import {describe,expect,it} from "vitest";
import {mayPerformOwnerBillingAction} from "../src/services/billing-authorization.js";

describe("billing authorization",()=>{
 it("allows verified active super admin with an active organization",()=>{
  expect(mayPerformOwnerBillingAction("SUPER_ADMIN",undefined)).toBe(true);
  expect(mayPerformOwnerBillingAction("USER","OWNER")).toBe(true);
 });
 it("blocks staff, manager, tenant and unverified user",()=>{
  for(const role of [undefined,"STAFF","MANAGER"])expect(mayPerformOwnerBillingAction("USER",role)).toBe(false);
  expect(mayPerformOwnerBillingAction("SUSPENDED","OWNER")).toBe(false);
 });
});
