import {and,asc,eq,inArray,isNull,lt,or} from "drizzle-orm";
import {db} from "../db/client.js";
import {evidenceUploads,paymentClaims} from "../db/schema.js";
import {config} from "../config.js";
import {deletePrivateEvidence} from "./evidence.js";
import {deleteQuarantineObject} from "./evidence-s3.js";

type Status="INITIATED"|"PROCESSING"|"READY"|"CLAIMED"|"FAILED"|"EXPIRED";
type TicketState={
 status:Status;expiresAt:Date;processedAt:Date|null;cleanedAt:Date|null;
 legalHold:boolean;evidenceKey:string|null
};
export function cleanupCutoffs(now:Date){
 // Give 1 hour beyond short-lived upload URLs and beyond the 24-hour claim window.
 return {expireBefore:new Date(now.getTime()-60*60*1000),
  readyBefore:new Date(now.getTime()-25*60*60*1000)};
}
export function cleanupEligible(row:TicketState,cut:ReturnType<typeof cleanupCutoffs>):boolean{
 if(row.legalHold||row.cleanedAt||row.status==="CLAIMED")return false;
 if(row.status==="EXPIRED")return true;
 if(row.expiresAt>=cut.expireBefore)return false;
 if(row.status==="READY")return !!row.processedAt&&row.processedAt<cut.readyBefore;
 return ["INITIATED","FAILED","PROCESSING"].includes(row.status);
}
export type CleanupStorage={
 deleteQuarantine:(organizationId:string,uploadId:string)=>Promise<void>;
 deleteEvidence:(evidenceKey:string)=>Promise<void>;
};
const realStorage:CleanupStorage={
 deleteQuarantine:async(org,id)=>{if(config.EVIDENCE_STORAGE_DRIVER==="s3")await deleteQuarantineObject(org,id);},
 deleteEvidence:deletePrivateEvidence
};
export type CleanupResult={
 mode:"DRY_RUN"|"APPLY";examined:number;eligible:number;cleaned:number;protected:number;failed:number;
};
/** Manual bounded sweep. Never removes evidence referenced by payment_claims.
 * To prevent claim races, mark READY -> EXPIRED under a row lock before external deletion.
 * External failures leave EXPIRED + cleanedAt NULL so subsequent runs can retry.
 */
export async function sweepOrphanEvidence(options:{
 now?:Date;apply?:boolean;limit?:number;organizationId?:string;storage?:CleanupStorage
}={}):Promise<CleanupResult>{
 const now=options.now??new Date(),cut=cleanupCutoffs(now);
 const limit=Math.min(100,Math.max(1,options.limit??50));
 const storage=options.storage??realStorage;
 const where=and(
  ...(options.organizationId?[eq(evidenceUploads.organizationId,options.organizationId)]:[]),
  isNull(evidenceUploads.cleanedAt),eq(evidenceUploads.legalHold,false),
  or(eq(evidenceUploads.status,"EXPIRED"),
   and(inArray(evidenceUploads.status,["INITIATED","PROCESSING","FAILED"]),
    lt(evidenceUploads.expiresAt,cut.expireBefore)),
   and(eq(evidenceUploads.status,"READY"),lt(evidenceUploads.expiresAt,cut.expireBefore),
    lt(evidenceUploads.processedAt,cut.readyBefore))));
 const rows=await db.select().from(evidenceUploads).where(where)
  .orderBy(asc(evidenceUploads.expiresAt)).limit(limit);
 const result:CleanupResult={
  mode:options.apply?"APPLY":"DRY_RUN",examined:rows.length,
  eligible:0,cleaned:0,protected:0,failed:0
 };
 for(const row of rows){
  if(!cleanupEligible(row,cut))continue;
  if(row.evidenceKey){
   const [linked]=await db.select({id:paymentClaims.id}).from(paymentClaims)
    .where(eq(paymentClaims.evidenceKey,row.evidenceKey)).limit(1);
   if(linked){result.protected++;continue;}
  }
  result.eligible++;
  if(!options.apply)continue;
  const reserved=await db.transaction(async tx=>{
   const [current]=await tx.select().from(evidenceUploads)
    .where(eq(evidenceUploads.id,row.id)).for("update");
   if(!current||!cleanupEligible(current,cut))return null;
   if(current.evidenceKey){
    const [linked]=await tx.select({id:paymentClaims.id}).from(paymentClaims)
     .where(eq(paymentClaims.evidenceKey,current.evidenceKey)).limit(1);
    if(linked)return null;
   }
   if(current.status!=="EXPIRED"){
    const [locked]=await tx.update(evidenceUploads).set({status:"EXPIRED",expiredAt:now})
     .where(and(eq(evidenceUploads.id,current.id),eq(evidenceUploads.status,current.status),
      eq(evidenceUploads.legalHold,false),isNull(evidenceUploads.cleanedAt))).returning();
    return locked??null;
   }
   return current;
  });
  if(!reserved){result.protected++;continue;}
  try{
   // Hold a row lock while deleting external bytes: a concurrent legal hold update
   // must serialize before or after the deletion, not pass between check and delete.
   // All external deletes are idempotent. A failed delete leaves EXPIRED retryable.
   const completed=await db.transaction(async tx=>{
    const [current]=await tx.select().from(evidenceUploads)
     .where(eq(evidenceUploads.id,reserved.id)).for("update");
    if(!current||current.status!=="EXPIRED"||current.legalHold||current.cleanedAt)return false;
    if(current.evidenceKey){
     const [referenced]=await tx.select({id:paymentClaims.id}).from(paymentClaims)
      .where(eq(paymentClaims.evidenceKey,current.evidenceKey)).limit(1);
     if(referenced)return false;
    }
    await storage.deleteQuarantine(current.organizationId,current.id);
    if(current.evidenceKey)await storage.deleteEvidence(current.evidenceKey);
    await tx.update(evidenceUploads).set({cleanedAt:new Date()}).where(and(
     eq(evidenceUploads.id,current.id),eq(evidenceUploads.status,"EXPIRED"),
     eq(evidenceUploads.legalHold,false),isNull(evidenceUploads.cleanedAt)));
    return true;
   });
   if(completed)result.cleaned++;else result.protected++;
  }catch{
   // Never record file names, S3 credentials, image data or scanner details in logs.
   result.failed++;
  }
 }
 return result;
}
