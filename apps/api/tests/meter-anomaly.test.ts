import {describe,expect,it} from "vitest";
import {assessMeterReadingAnomaly} from "../src/services/meter-anomaly.js";

const base={previousMilli:100000,currentMilli:110000,days:5,maxDailyMilli:5000,
 physicalMeterChanged:false};
describe("P5 meter anomaly manual-review policy",()=>{
 it("accepts normal usage without a mandatory review",()=>{
  expect(assessMeterReadingAnomaly(base)).toEqual({
   kind:"NORMAL",usageMilli:10000,requiresOwnerReview:false,
  });
 });
 it("flags possible physical meter reset instead of billing negative usage",()=>{
  expect(assessMeterReadingAnomaly({...base,currentMilli:1})).toEqual({
   kind:"POSSIBLE_RESET",usageMilli:null,requiresOwnerReview:true,
  });
 });
 it("requires review of replacement without silently mixing old and new meter",()=>{
  expect(assessMeterReadingAnomaly({...base,physicalMeterChanged:true})).toEqual({
   kind:"METER_CHANGE_REVIEW",usageMilli:null,requiresOwnerReview:true,
  });
 });
 it("flags excessive usage relative to configured period-specific limit",()=>{
  expect(assessMeterReadingAnomaly({...base,currentMilli:130000})).toEqual({
   kind:"USAGE_SPIKE",usageMilli:30000,requiresOwnerReview:true,
  });
 });
 it("requires review of same-day meter submissions",()=>{
  expect(assessMeterReadingAnomaly({...base,days:0})).toEqual({
   kind:"DUPLICATE_PERIOD",usageMilli:null,requiresOwnerReview:true,
  });
 });
 it("rejects invalid, fractional, unsafe and overflowing readings",()=>{
  for(const n of [-1,0.5,Number.NaN,Number.MAX_SAFE_INTEGER]){
   expect(()=>assessMeterReadingAnomaly({...base,currentMilli:n})).toThrow("INVALID_METER_INPUT");
  }
  expect(()=>assessMeterReadingAnomaly({...base,maxDailyMilli:0})).toThrow("INVALID_METER_INPUT");
  expect(()=>assessMeterReadingAnomaly({...base,days:1.5})).toThrow("INVALID_METER_INPUT");
 });
});
