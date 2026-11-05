/** Pure P5 meter-reading anomaly classifier (advisory, no billing write).
 * The daily usage threshold must come from reviewed property policy.
 * Meter replacement and backwards readings require human review.
 */
export type MeterAnomalyInput={
 previousMilli:number;
 currentMilli:number;
 days:number;
 maxDailyMilli:number;
 physicalMeterChanged:boolean;
};
export type MeterAnomalyAssessment={
 kind:"NORMAL"|"DUPLICATE_PERIOD"|"POSSIBLE_RESET"|"METER_CHANGE_REVIEW"|"USAGE_SPIKE";
 usageMilli:number|null;
 requiresOwnerReview:boolean;
};
const validReading=(n:number)=>Number.isSafeInteger(n)&&n>=0&&n<=99999999999999;
export function assessMeterReadingAnomaly(input:MeterAnomalyInput):MeterAnomalyAssessment{
 if(!validReading(input.previousMilli)||!validReading(input.currentMilli)||
   !Number.isSafeInteger(input.days)||input.days<0||input.days>3650||
   !validReading(input.maxDailyMilli)||input.maxDailyMilli===0 ||
   typeof input.physicalMeterChanged!=="boolean" ||
   !Number.isSafeInteger(input.days*input.maxDailyMilli))
  throw Error("INVALID_METER_INPUT");
 if(input.physicalMeterChanged)
  return {kind:"METER_CHANGE_REVIEW",usageMilli:null,requiresOwnerReview:true};
 if(input.days===0)
  return {kind:"DUPLICATE_PERIOD",usageMilli:null,requiresOwnerReview:true};
 if(input.currentMilli<input.previousMilli)
  return {kind:"POSSIBLE_RESET",usageMilli:null,requiresOwnerReview:true};
 const usageMilli=input.currentMilli-input.previousMilli;
 if(usageMilli>input.days*input.maxDailyMilli)
  return {kind:"USAGE_SPIKE",usageMilli,requiresOwnerReview:true};
 return {kind:"NORMAL",usageMilli,requiresOwnerReview:false};
}
