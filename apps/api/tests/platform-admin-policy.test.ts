import {describe,expect,it} from "vitest";
import {assertPlatformAdminChangeAllowed} from "../src/services/platform-admin-policy.js";

const base={
 actorId:"admin-a",actorRole:"SUPER_ADMIN",targetId:"user-b",
 targetRole:"USER",nextRole:"SUPER_ADMIN",targetStatus:"ACTIVE",
 targetLineSubject:"verified-line-subject",bootstrapLineSubject:"root-line-subject",
 activeSuperAdminCount:2,
} as const;

describe("platform administrator role changes",()=>{
 it("allows a super admin to grant verified active users platform admin",()=>{
  expect(()=>assertPlatformAdminChangeAllowed(base)).not.toThrow();
 });
 it("denies callers without current super admin authority",()=>{
  expect(()=>assertPlatformAdminChangeAllowed({...base,actorRole:"USER"})).toThrow("SUPER_ADMIN_REQUIRED");
 });
 it("requires an active LINE-verified target account",()=>{
  expect(()=>assertPlatformAdminChangeAllowed({...base,targetStatus:"DISABLED"})).toThrow("PLATFORM_ACCOUNT_NOT_ACTIVE");
  expect(()=>assertPlatformAdminChangeAllowed({...base,targetLineSubject:null})).toThrow("PLATFORM_ACCOUNT_NOT_LINE_VERIFIED");
 });
 it("protects bootstrap and prevents self demotion",()=>{
  expect(()=>assertPlatformAdminChangeAllowed({...base,targetLineSubject:"root-line-subject",targetRole:"SUPER_ADMIN",nextRole:"USER"})).toThrow("BOOTSTRAP_ADMIN_PROTECTED");
  expect(()=>assertPlatformAdminChangeAllowed({...base,actorId:"user-b",targetRole:"SUPER_ADMIN",nextRole:"USER"})).toThrow("SELF_DEMOTION_FORBIDDEN");
 });
 it("does not allow removal of the last active super admin",()=>{
  expect(()=>assertPlatformAdminChangeAllowed({...base,targetRole:"SUPER_ADMIN",nextRole:"USER",activeSuperAdminCount:1})).toThrow("LAST_SUPER_ADMIN_REQUIRED");
 });
 it("allows removing an additional super admin",()=>{
  expect(()=>assertPlatformAdminChangeAllowed({...base,targetRole:"SUPER_ADMIN",nextRole:"USER"})).not.toThrow();
 });
});
