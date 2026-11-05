import {parseDay,periodsForMonth,type Cadence} from "@apartment/domain";

type Input={
 cadence:Cadence;
 rollingAnchor:string|null;
 leaseStart:string;
 endExclusive:string;
};
export type LeaseBillingSegment={start:string;endExclusive:string;partial:boolean};
const DAY_MS=86_400_000;
const iso=(timestamp:number)=>new Date(timestamp).toISOString().slice(0,10);

/** Previews canonical billing windows intersected with the signed lease.
 * No tenant edits, invoice writes or automatic financial adjustments.
 */
export function planLeaseBillingSegments(input:Input):LeaseBillingSegment[]{
 const startMs=+parseDay(input.leaseStart);
 const endMs=+parseDay(input.endExclusive);
 const duration=(endMs-startMs)/DAY_MS;
 if(startMs>=endMs||duration>366)throw Error("INVALID_LEASE_TRANSITION");
 let anchorMs=0;
 if(input.cadence==="EVERY_15_DAYS"){
  if(!input.rollingAnchor)throw Error("LEASE_ROLLING_ANCHOR_REQUIRED");
  anchorMs=+parseDay(input.rollingAnchor);
  if(startMs<anchorMs)throw Error("LEASE_BEFORE_ROLLING_ANCHOR");
 }
 const segments:LeaseBillingSegment[]=[];
 let cursor=startMs;
 while(cursor<endMs){
  const day=new Date(cursor);
  let cycleStart:number,cycleEnd:number;
  if(input.cadence==="EVERY_15_DAYS"){
   const index=Math.floor((cursor-anchorMs)/(15*DAY_MS));
   cycleStart=anchorMs+index*15*DAY_MS;
   cycleEnd=cycleStart+15*DAY_MS;
  }else{
   const y=day.getUTCFullYear(),m=day.getUTCMonth()+1;
   const boundaries=periodsForMonth(y,m,input.cadence);
   const current=boundaries.find(period=>
    +parseDay(period.start)<=cursor&&cursor<+parseDay(period.endExclusive));
   if(!current)throw Error("LEASE_CYCLE_NOT_FOUND");
   cycleStart=+parseDay(current.start);
   cycleEnd=+parseDay(current.endExclusive);
  }
  const clippedEnd=Math.min(endMs,cycleEnd);
  if(clippedEnd<=cursor)throw Error("LEASE_CYCLE_INVALID");
  segments.push({start:iso(cursor),endExclusive:iso(clippedEnd),
   partial:cursor!==cycleStart||clippedEnd!==cycleEnd});
  cursor=clippedEnd;
 }
 return segments;
}
