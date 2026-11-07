import {readingToMilli} from "@apartment/domain";
import {readingSegmentIndex} from "./meter-replacement.js";

type Reading={readAt:string;value:string;id:string};
type Replacement={replacedAt:string};
export function resolveMeterStartBoundary(start:string,readings:readonly Reading[],replacements:readonly Replacement[]){
 const recorded=readings.find(row=>row.readAt===start);
 if(recorded)return {...recorded,assumedZero:false};
 // Zero is only the FIRST historical baseline; never silently reset a running meter.
 if(readings.some(row=>row.readAt<start)||replacements.some(row=>row.replacedAt<=start))
  throw new Error("METER_BOUNDARY_READING_REQUIRED");
 return {id:null,readAt:start,value:"0",assumedZero:true} as const;
}
export function checkMeterReadingProgression(date:string,value:string,readings:readonly Reading[],replacements:readonly Replacement[]){
 const current=readingToMilli(value),segment=readingSegmentIndex(date,replacements);
 for(const row of readings){
  if(readingSegmentIndex(row.readAt,replacements)!==segment)continue;
  const other=readingToMilli(row.value);
  if((row.readAt<date&&other>current)||(row.readAt>date&&other<current))return "NON_MONOTONIC_READING" as const;
 }
 return null;
}
