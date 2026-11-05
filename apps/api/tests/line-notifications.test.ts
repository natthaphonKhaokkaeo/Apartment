import {describe,it,expect} from "vitest";
import {notificationText,notificationEventKey,isActiveTenantConsent,notificationPurposeAllowed} from "../src/services/line-notifications.js";
import {bangkokDate} from "../src/services/line-due-reminders.js";

describe("LINE tenant notification policy P4-04",()=>{
 it("uses stable event keys and generic Thai bill text without tenant name or amount",()=>{
  const invoiceId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  expect(notificationEventKey("BILL_ISSUED",invoiceId)).toBe("BILL_ISSUED:"+invoiceId);
  expect(notificationEventKey("PAYMENT_DUE",invoiceId)).toBe("PAYMENT_DUE:"+invoiceId);
  const text=notificationText("BILL_ISSUED");
  expect(text).toContain("ใบแจ้งหนี้");
  expect(text).not.toContain("฿");
  expect(text.length).toBeLessThan(5000);
 });
 it("uses Bangkok local date rather than UTC for due reminders",()=>{
  expect(bangkokDate(new Date("2026-11-02T19:00:00Z"))).toBe("2026-11-03");
  expect(bangkokDate(new Date("2026-11-03T16:59:59Z"))).toBe("2026-11-03");
  expect(bangkokDate(new Date("2026-11-03T17:00:00Z"))).toBe("2026-11-04");
 });
 it("allows only an explicit current consent matching exact active tenant/lease/OA scope",()=>{
  const expected={bindingId:"oa",leaseId:"lease",organizationId:"org",recipientLineUserId:"U123"};
  const consent={...expected,revokedAt:null};
  expect(isActiveTenantConsent(consent,expected)).toBe(true);
  expect(isActiveTenantConsent({...consent,revokedAt:new Date()},expected)).toBe(false);
  expect(isActiveTenantConsent(consent,{...expected,recipientLineUserId:"U456"})).toBe(false);
  expect(isActiveTenantConsent(undefined,expected)).toBe(false);
 });
});

describe("consent-bound operations notification templates",()=>{
 it("uses a generic maintenance template without ticket details",()=>{
  expect(notificationText("MAINTENANCE_UPDATED")).toContain("แจ้งซ่อม");
  expect(notificationText("MAINTENANCE_UPDATED")).not.toMatch(/https?:|฿/);
 });
 it("uses a generic tenant approval template without invitation secrets",()=>{
  expect(notificationText("TENANT_LINK_APPROVED")).toContain("อนุมัติ");
  expect(notificationText("TENANT_LINK_APPROVED")).not.toMatch(/https?:|token|฿/i);
  expect(notificationPurposeAllowed("TENANT_LINK_APPROVED")).toBe(false);
  expect(notificationPurposeAllowed("MAINTENANCE_UPDATED")).toBe(true);
 });
});
