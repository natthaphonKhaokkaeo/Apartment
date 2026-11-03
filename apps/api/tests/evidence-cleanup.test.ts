import {describe,it,expect} from "vitest";
import {cleanupEligible,cleanupCutoffs} from "../src/services/evidence-cleanup.js";
const now=new Date("2026-11-03T06:00:00Z");
const base={id:"x",status:"INITIATED" as const,expiresAt:new Date("2026-11-02T06:00:00Z"),
 processedAt:null,cleanedAt:null,legalHold:false,evidenceKey:null};
describe("orphan evidence cleanup policy",()=>{
 it("expires old unclaimed initiated, failed or stalled processing tickets only after grace",()=>{
  const cut=cleanupCutoffs(now);
  expect(cleanupEligible(base,cut)).toBe(true);
  expect(cleanupEligible({...base,status:"FAILED"},cut)).toBe(true);
  expect(cleanupEligible({...base,status:"PROCESSING"},cut)).toBe(true);
  expect(cleanupEligible({...base,expiresAt:new Date("2026-11-03T05:30:00Z")},cut)).toBe(false);
 });
 it("retains READY evidence for full claim window plus safety grace",()=>{
  const cut=cleanupCutoffs(now);
  expect(cleanupEligible({...base,status:"READY",processedAt:new Date("2026-11-02T00:00:00Z"),evidenceKey:"v"},cut)).toBe(true);
  expect(cleanupEligible({...base,status:"READY",processedAt:new Date("2026-11-02T09:00:00Z"),evidenceKey:"v"},cut)).toBe(false);
 });
 it("never deletes CLAIMED, held, or already cleaned evidence",()=>{
  const cut=cleanupCutoffs(now);
  expect(cleanupEligible({...base,status:"CLAIMED"},cut)).toBe(false);
  expect(cleanupEligible({...base,status:"READY",processedAt:new Date("2026-11-01T00:00:00Z"),legalHold:true},cut)).toBe(false);
  expect(cleanupEligible({...base,cleanedAt:now},cut)).toBe(false);
  expect(cleanupEligible({...base,status:"EXPIRED"},cut)).toBe(true);
 });
});
