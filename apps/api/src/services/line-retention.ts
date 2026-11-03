import {z} from "zod";
import {and,asc,count,eq,inArray,lt} from "drizzle-orm";
import {db} from "../db/client.js";
import {lineDispatchReservations} from "../db/schema.js";

export const reservationRetentionDays=z.number().int().min(30).max(365);
export function lineReservationCutoff(now:Date,retentionDays:number):Date{
 const days=reservationRetentionDays.parse(retentionDays);
 if(Number.isNaN(now.getTime()))throw Error("INVALID_NOW");
 return new Date(now.getTime()-days*86400_000);
}
/** DRY_RUN unless explicitly applied. Never deletes outbox, consent, alert or audit.
 * Bounded at 250 rows per invocation, retaining at least 30 days.
 */
export async function cleanupLineReservations(input:{
 organizationId:string;apply?:boolean;now?:Date;retentionDays?:number;limit?:number
}){
 const organizationId=z.uuid().parse(input.organizationId);
 const now=input.now??new Date();
 const retentionDays=input.retentionDays??30;
 const cutoff=lineReservationCutoff(now,retentionDays);
 const limit=z.number().int().min(1).max(250).parse(input.limit??100);
 const [countRow]=await db.select({total:count()}).from(lineDispatchReservations)
  .where(and(eq(lineDispatchReservations.organizationId,organizationId),
   lt(lineDispatchReservations.reservedAt,cutoff)));
 if(!input.apply){
  return {mode:"DRY_RUN" as const,retentionDays,eligible:countRow?.total??0,
   deleted:0,limit};
 }
 const old=await db.select({id:lineDispatchReservations.id})
  .from(lineDispatchReservations).where(and(eq(lineDispatchReservations.organizationId,organizationId),
   lt(lineDispatchReservations.reservedAt,cutoff)))
  .orderBy(asc(lineDispatchReservations.reservedAt)).limit(limit);
 if(old.length===0)return {mode:"APPLY" as const,retentionDays,eligible:0,deleted:0,limit};
 const deleted=await db.delete(lineDispatchReservations).where(and(
  inArray(lineDispatchReservations.id,old.map(row=>row.id)),
  lt(lineDispatchReservations.reservedAt,cutoff),
  eq(lineDispatchReservations.organizationId,organizationId)
 )).returning({id:lineDispatchReservations.id});
 return {mode:"APPLY" as const,retentionDays,eligible:countRow?.total??0,
  deleted:deleted.length,limit};
}
