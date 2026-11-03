import {describe,it,expect} from "vitest";
import {generateLeaseInvite, hashLeaseInvite, inviteExpiry} from "../src/services/invitations.js";

describe("lease invite security", () => {
 it("generates 256-bit URL-safe unpredictable tokens",()=>{
  const a=generateLeaseInvite(),b=generateLeaseInvite();
  expect(a.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(a.token).not.toBe(b.token);
  expect(a.hash).toMatch(/^[a-f0-9]{64}$/);
  expect(a.hash).not.toBe(a.token);
  expect(a.hash).toBe(hashLeaseInvite(a.token));
  expect(a.hash).not.toBe(hashLeaseInvite(b.token));
 });
 it("expires after one day, never in past",()=>{
  const now=new Date("2026-11-03T09:00:00.000Z");
  expect(inviteExpiry(now).toISOString()).toBe("2026-11-04T09:00:00.000Z");
 });
 it("refuses unreasonably long or malformed tokens",()=>{
  expect(()=>hashLeaseInvite("a")).toThrow();
  expect(()=>hashLeaseInvite("x".repeat(5000))).toThrow();
 });
});
