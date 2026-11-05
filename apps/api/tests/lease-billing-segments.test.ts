import {describe,expect,it} from "vitest";
import {planLeaseBillingSegments} from "../src/services/lease-billing-segments.js";
describe("P1 canonical mid-cycle lease transition plan",()=>{
 it("clips the monthly first and last billing cycles exactly",()=>{
  expect(planLeaseBillingSegments({
   cadence:"MONTHLY",rollingAnchor:null,
   leaseStart:"2026-10-11",endExclusive:"2026-12-05",
  })).toEqual([
   {start:"2026-10-11",endExclusive:"2026-11-01",partial:true},
   {start:"2026-11-01",endExclusive:"2026-12-01",partial:false},
   {start:"2026-12-01",endExclusive:"2026-12-05",partial:true},
  ]);
 });
 it("respects half-month 1st/16th boundaries",()=>{
  expect(planLeaseBillingSegments({
   cadence:"SEMI_MONTHLY",rollingAnchor:null,
   leaseStart:"2026-02-13",endExclusive:"2026-03-03",
  })).toEqual([
   {start:"2026-02-13",endExclusive:"2026-02-16",partial:true},
   {start:"2026-02-16",endExclusive:"2026-03-01",partial:false},
   {start:"2026-03-01",endExclusive:"2026-03-03",partial:true},
  ]);
 });
 it("honors anchored rolling 15-day periods over month boundaries",()=>{
  expect(planLeaseBillingSegments({
   cadence:"EVERY_15_DAYS",rollingAnchor:"2026-10-01",
   leaseStart:"2026-10-10",endExclusive:"2026-11-04",
  })).toEqual([
   {start:"2026-10-10",endExclusive:"2026-10-16",partial:true},
   {start:"2026-10-16",endExclusive:"2026-10-31",partial:false},
   {start:"2026-10-31",endExclusive:"2026-11-04",partial:true},
  ]);
 });
 it("does not produce empty or overlapping cycles on exact boundaries",()=>{
  expect(planLeaseBillingSegments({
   cadence:"MONTHLY",rollingAnchor:null,
   leaseStart:"2026-10-01",endExclusive:"2026-11-01",
  })).toEqual([{start:"2026-10-01",endExclusive:"2026-11-01",partial:false}]);
 });
 it("fails closed on invalid contract dates, missing anchor and excessive duration",()=>{
  const basic={cadence:"MONTHLY" as const,rollingAnchor:null,leaseStart:"2026-10-01"};
  for(const endExclusive of ["2026-10-01","2026-02-30","2028-01-01"]){
   expect(()=>planLeaseBillingSegments({...basic,endExclusive})).toThrow();
  }
  expect(()=>planLeaseBillingSegments({
   cadence:"EVERY_15_DAYS",rollingAnchor:null,
   leaseStart:"2026-10-10",endExclusive:"2026-10-20",
  })).toThrow();
  expect(()=>planLeaseBillingSegments({
   cadence:"EVERY_15_DAYS",rollingAnchor:"2026-10-11",
   leaseStart:"2026-10-10",endExclusive:"2026-10-20",
  })).toThrow();
 });
});
