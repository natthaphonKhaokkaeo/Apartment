import {createHash} from "node:crypto";
import type {FastifyInstance,FastifyRequest} from "fastify";
import {and,eq,desc,inArray} from "drizzle-orm";
import {z} from "zod";
import {meterReadings,meterReadingEvidence,meterAnomalyReviews,auditLogs} from "../db/schema.js";
import {config} from "../config.js";
import {AppError,requireActor} from "../security.js";
import {withMeterScope,scopedMeterReading,assessStoredMeterReading} from "../services/meter-records.js";
import {savePrivateEvidence,loadPrivateEvidence,deletePrivateEvidence} from "../services/evidence.js";
import {MAX_EVIDENCE_BYTES} from "../services/evidence-s3.js";
const scope=z.object({propertyId:z.uuid(),roomId:z.uuid()});
const readingScope=scope.extend({readingId:z.uuid()});
const photoScope=readingScope.extend({photoId:z.uuid()});
const photoFields={id:meterReadingEvidence.id,readingId:meterReadingEvidence.readingId,sha256:meterReadingEvidence.sha256,sizeBytes:meterReadingEvidence.sizeBytes,scanVerdict:meterReadingEvidence.scanVerdict,createdAt:meterReadingEvidence.createdAt};
function key(req:FastifyRequest){
 const value=req.headers["idempotency-key"];
 if(typeof value!=="string"||!/^[A-Za-z0-9_-]{8,128}$/.test(value))throw new AppError(400,"IDEMPOTENCY_KEY_REQUIRED");
 return value;
}
export async function registerMeterRecordRoutes(app:FastifyInstance){
 const base="/v1/properties/:propertyId/rooms/:roomId/meter-records";
 app.get(base,async(req,reply)=>{
  const actor=await requireActor(req),params=scope.parse(req.params),{kind}=z.object({kind:z.enum(["WATER","ELECTRIC"])}).parse(req.query);
  reply.header("cache-control","no-store");
  return withMeterScope(actor,params,"read",async(tx,organizationId)=>{
   const readings=await tx.select({id:meterReadings.id,kind:meterReadings.kind,readAt:meterReadings.readAt,value:meterReadings.value}).from(meterReadings).where(and(eq(meterReadings.organizationId,organizationId),eq(meterReadings.propertyId,params.propertyId),eq(meterReadings.roomId,params.roomId),eq(meterReadings.kind,kind))).orderBy(desc(meterReadings.readAt)).limit(50);
   if(!readings.length)return {readings:[],limit:50};
   const ids=readings.map(r=>r.id);
   const photos=await tx.select(photoFields).from(meterReadingEvidence).where(and(eq(meterReadingEvidence.organizationId,organizationId),eq(meterReadingEvidence.propertyId,params.propertyId),eq(meterReadingEvidence.roomId,params.roomId),inArray(meterReadingEvidence.readingId,ids)));
   const reviews=await tx.select({id:meterAnomalyReviews.id,readingId:meterAnomalyReviews.readingId,action:meterAnomalyReviews.action,reason:meterAnomalyReviews.reason,assessment:meterAnomalyReviews.assessment,createdAt:meterAnomalyReviews.createdAt}).from(meterAnomalyReviews).where(and(eq(meterAnomalyReviews.organizationId,organizationId),eq(meterAnomalyReviews.propertyId,params.propertyId),eq(meterAnomalyReviews.roomId,params.roomId),inArray(meterAnomalyReviews.readingId,ids))).orderBy(desc(meterAnomalyReviews.createdAt)).limit(500);
   return {readings:readings.map(r=>({...r,photos:photos.filter(p=>p.readingId===r.id),reviews:reviews.filter(v=>v.readingId===r.id)})),limit:50,reviewHistoryLimit:500};
  });
 });
 app.post(base+"/:readingId/photos",{config:{rateLimit:{max:15,timeWindow:"1 minute"}}},async(req,reply)=>{
  const actor=await requireActor(req),params=readingScope.parse(req.params),idempotencyKey=key(req);
  await withMeterScope(actor,params,"write",(tx,org)=>scopedMeterReading(tx,params,params.readingId,org));
  let bytes:Buffer|undefined,mime="";
  for await(const part of req.parts({limits:{fileSize:MAX_EVIDENCE_BYTES,files:1,fields:0,parts:1}})){
   if(part.type!=="file"||part.fieldname!=="photo")throw new AppError(400,"METER_PHOTO_REQUIRED");
   bytes=await part.toBuffer();mime=part.mimetype;
  }
  if(!bytes)throw new AppError(400,"METER_PHOTO_REQUIRED");
  const saved=await savePrivateEvidence(bytes,mime);
  let keep=false;
  try{
   const result=await withMeterScope(actor,params,"write",async(tx,organizationId)=>{
    await scopedMeterReading(tx,params,params.readingId,organizationId);
    const [prior]=await tx.select(photoFields).from(meterReadingEvidence).where(and(eq(meterReadingEvidence.readingId,params.readingId),eq(meterReadingEvidence.idempotencyKey,idempotencyKey)));
    if(prior){if(prior.sha256!==saved.sha256)throw new AppError(409,"IDEMPOTENCY_KEY_REUSED");return {photo:prior,replayed:true};}
    const [photo]=await tx.insert(meterReadingEvidence).values({organizationId,propertyId:params.propertyId,roomId:params.roomId,readingId:params.readingId,evidenceKey:saved.key,sha256:saved.sha256,sizeBytes:saved.size,scanVerdict:config.EVIDENCE_MALWARE_SCANNER==="clamav"?"CLEAN":"NOT_SCANNED_DEV",idempotencyKey,createdBy:actor.id}).returning(photoFields);
    await tx.insert(auditLogs).values({organizationId,actorId:actor.id,action:"METER_EVIDENCE_RECORDED",targetId:photo.id,metadata:{readingId:params.readingId,scanVerdict:photo.scanVerdict}});
    return {photo,replayed:false};
   });
   keep=!result.replayed;reply.header("cache-control","no-store");
   return reply.code(result.replayed?200:201).send(result);
  }finally{if(!keep)await deletePrivateEvidence(saved.key).catch(()=>app.log.error({event:"METER_EVIDENCE_ORPHAN_CLEANUP_FAILED"}));}
 });
 app.get(base+"/:readingId/photos/:photoId/content",async(req,reply)=>{
  const actor=await requireActor(req),params=photoScope.parse(req.params);
  const content=await withMeterScope(actor,params,"read",async(tx,organizationId)=>{
   await scopedMeterReading(tx,params,params.readingId,organizationId);
   const [photo]=await tx.select().from(meterReadingEvidence).where(and(eq(meterReadingEvidence.id,params.photoId),eq(meterReadingEvidence.readingId,params.readingId),eq(meterReadingEvidence.roomId,params.roomId),eq(meterReadingEvidence.propertyId,params.propertyId),eq(meterReadingEvidence.organizationId,organizationId)));
   if(!photo)throw new AppError(404,"METER_PHOTO_NOT_FOUND");
   return loadPrivateEvidence(photo.evidenceKey);
  });
  return reply.header("cache-control","no-store").header("content-type","image/webp").header("content-disposition",'inline; filename="meter-evidence.webp"').send(content);
 });
 app.post(base+"/:readingId/reviews",{config:{rateLimit:{max:15,timeWindow:"1 minute"}}},async(req,reply)=>{
  const actor=await requireActor(req),params=readingScope.parse(req.params),idempotencyKey=key(req);
  const input=z.object({action:z.enum(["ACKNOWLEDGED","REQUIRES_CORRECTION"]),reason:z.string().trim().min(15).max(500),maxDailyMilli:z.number().int().min(1).max(99999999999999)}).strict().parse(req.body);
  const requestHash=createHash("sha256").update(JSON.stringify(input)).digest("hex");
  const result=await withMeterScope(actor,params,"owner",async(tx,organizationId)=>{
   const reading=await scopedMeterReading(tx,params,params.readingId,organizationId);
   const [prior]=await tx.select().from(meterAnomalyReviews).where(and(eq(meterAnomalyReviews.readingId,params.readingId),eq(meterAnomalyReviews.idempotencyKey,idempotencyKey)));
   if(prior){if(prior.requestHash!==requestHash)throw new AppError(409,"IDEMPOTENCY_KEY_REUSED");return {review:prior,replayed:true};}
   const assessment=await assessStoredMeterReading(tx,params,reading,input.maxDailyMilli);
   const [review]=await tx.insert(meterAnomalyReviews).values({organizationId,propertyId:params.propertyId,roomId:params.roomId,readingId:params.readingId,...input,maxDailyMilli:String(input.maxDailyMilli),assessment,idempotencyKey,requestHash,createdBy:actor.id}).returning();
   await tx.insert(auditLogs).values({organizationId,actorId:actor.id,action:"METER_ANOMALY_REVIEW_RECORDED",targetId:review.id,metadata:{readingId:params.readingId,action:input.action}});
   return {review,replayed:false};
  });
  return reply.header("cache-control","no-store").code(result.replayed?200:201).send({...result,billingChanged:false,readingChanged:false});
 });
}
