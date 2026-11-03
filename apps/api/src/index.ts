import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import {and,eq,desc,gt,isNull,lte,inArray,lt} from "drizzle-orm";
import {z,ZodError} from "zod";
import {config} from "./config.js";
import {db,sqlClient} from "./db/client.js";
import {users,sessions,organizations,memberships,properties,rooms,leases,meterReadings,invoices,invoiceLines,auditLogs,paymentLedger,financeAdjustmentEntries,propertyStaffGrants} from "./db/schema.js";
import {AppError,newSessionToken,tokenHash,requireActor,requireOrg,requireProperty,requireAdmin} from "./security.js";
import {prepareInvoice} from "./services/billing.js";
import {registerTenantRoutes} from "./routes/tenant.js";
import {registerPaymentRoutes} from "./routes/payments.js";
import {registerEvidenceUploadRoutes} from "./routes/evidence-uploads.js";
import {registerBillingDocumentRoutes} from "./routes/billing-documents.js";
import {registerPromptPayRoutes} from "./routes/promptpay.js";
import {registerFinancialAdjustmentRoutes} from "./routes/financial-adjustments.js";
import {registerLineOaRoutes} from "./routes/line-oa.js";
import {registerLineConsentRoutes} from "./routes/line-consent.js";
import {registerLineOperationsRoutes} from "./routes/line-operations.js";
import {registerLeaseLifecycleRoutes} from "./routes/lease-lifecycle.js";
import {registerPropertyRateRoutes} from "./routes/property-rates.js";
import {registerRoomRateRoutes} from "./routes/room-rates.js";
import {registerMeterReplacementRoutes} from "./routes/meter-replacement.js";
import {registerStaffRoutes} from "./routes/staff.js";
import {readingSegmentIndex} from "./services/meter-replacement.js";
import {meterReplacements} from "./db/schema.js";
import {bangkokToday} from "./services/property-rates.js";
import {propertyRateVersions,roomRateVersions} from "./db/schema.js";
import {queueInvoiceIssuedTx} from "./services/line-notifications.js";
import {readingToMilli,parseDay} from "@apartment/domain";

const app=Fastify({logger:{redact:["req.headers.cookie","req.headers.authorization","res.headers.set-cookie"]},bodyLimit:1048576});
await app.register(cookie);
await app.register(cors,{origin:config.WEB_ORIGIN,credentials:true});
await app.register(helmet);
await app.register(rateLimit,{max:90,timeWindow:"1 minute"});
type Actor=Awaited<ReturnType<typeof requireActor>>;
const uuid=z.uuid(),satang=z.number().int().min(0).max(2147483647),day=z.iso.date();
const take=<T extends z.ZodTypeAny>(s:T,v:unknown):z.infer<T>=>s.parse(v);
const params=(v:unknown)=>take(z.object({propertyId:uuid}),v).propertyId;
const audit=(a:Actor,org:string,action:string,target:string)=>db.insert(auditLogs).values({actorId:a.id,organizationId:org,action,targetId:target,metadata:{}});
const due=(v:string,n:number)=>{const d=parseDay(v);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
async function getRoom(p:typeof properties.$inferSelect,id:string){
 const [r]=await db.select().from(rooms).where(and(eq(rooms.id,id),eq(rooms.propertyId,p.id),eq(rooms.organizationId,p.organizationId)));
 if(!r) throw new AppError(404,"ROOM_NOT_FOUND");return r;
}
app.setErrorHandler((e,req,res)=>{
 if(e instanceof ZodError)return res.code(400).send({error:"VALIDATION_ERROR",issues:e.issues.map(x=>({path:x.path,message:x.message}))});
 if(e instanceof AppError)return res.code(e.statusCode).send({error:e.code});
 if(e instanceof Error && "code" in e && e.code==="FST_REQ_FILE_TOO_LARGE")return res.code(413).send({error:"EVIDENCE_FILE_TOO_LARGE"});
 if(e instanceof Error && "code" in e && e.code==="FST_INVALID_MULTIPART_CONTENT_TYPE")return res.code(415).send({error:"MULTIPART_REQUIRED"});
 if(e instanceof Error && "code" in e && e.code==="23505")return res.code(409).send({error:"DUPLICATE_RESOURCE"});
 if(e instanceof Error && "statusCode" in e && typeof e.statusCode==="number" && e.statusCode>=400 && e.statusCode<500)
  return res.code(e.statusCode).send({error:e.statusCode===429?"RATE_LIMITED":"REQUEST_REJECTED"});
 req.log.error(e);return res.code(500).send({error:"INTERNAL_ERROR"});
});
app.addHook("onRequest",async req=>{
 if(["POST","PATCH","PUT","DELETE"].includes(req.method)){
  const origin=req.headers.origin;
  if(origin&&origin!==config.WEB_ORIGIN)throw new AppError(403,"UNTRUSTED_ORIGIN");
 }
});
app.get("/healthz",async()=>({ok:true}));
app.get("/readyz",async()=>{await sqlClient.unsafe("select 1");return {ok:true};});
app.post("/v1/auth/line/exchange",async(req,reply)=>{
 const b=take(z.object({idToken:z.string().min(100).max(8192)}),req.body);
 const r=await fetch("https://api.line.me/oauth2/v2.1/verify",{
  method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},
  body:new URLSearchParams({id_token:b.idToken,client_id:config.LINE_CHANNEL_ID}),signal:AbortSignal.timeout(8000)
 });
 if(!r.ok)throw new AppError(401,"INVALID_LINE_TOKEN");
 const data=await r.json() as {sub?:string;name?:string;aud?:string;iss?:string;exp?:number};
 if(!data.sub||data.aud!==config.LINE_CHANNEL_ID||data.iss!=="https://access.line.me"||!data.exp||data.exp*1000<Date.now())throw new AppError(401,"INVALID_LINE_CLAIMS");
 const root=!!config.SUPER_ADMIN_LINE_USER_ID&&data.sub===config.SUPER_ADMIN_LINE_USER_ID;
 const [u]=await db.insert(users).values({lineSubject:data.sub,displayName:data.name||"LINE User",platformRole:root?"SUPER_ADMIN":"USER"})
  .onConflictDoUpdate({target:users.lineSubject,set:{displayName:data.name||"LINE User"}}).returning();
 if(u.status!=="ACTIVE")throw new AppError(403,"ACCOUNT_DISABLED");
 const token=newSessionToken();
 await db.insert(sessions).values({userId:u.id,tokenHash:tokenHash(token),expiresAt:new Date(Date.now()+604800000)});
 reply.setCookie("apartment_session",token,{httpOnly:true,secure:config.COOKIE_SECURE==="true",sameSite:"lax",path:"/",maxAge:604800});
 return {user:{id:u.id,name:u.displayName,platformRole:u.platformRole}};
});
app.post("/v1/auth/logout",async(req,reply)=>{
 const token=req.cookies.apartment_session;
 if(token)await db.update(sessions).set({revokedAt:new Date()}).where(eq(sessions.tokenHash,tokenHash(token)));
 reply.clearCookie("apartment_session",{path:"/"});return {ok:true};
});
app.get("/v1/me",async req=>{
 const a=await requireActor(req);
 const m=await db.select({organizationId:memberships.organizationId,role:memberships.role}).from(memberships).where(and(eq(memberships.userId,a.id),eq(memberships.status,"ACTIVE")));
 const grants=await db.select({propertyId:propertyStaffGrants.propertyId,
  level:propertyStaffGrants.level}).from(propertyStaffGrants)
  .innerJoin(memberships,and(eq(propertyStaffGrants.organizationId,memberships.organizationId),
   eq(propertyStaffGrants.userId,memberships.userId))).where(and(
  eq(propertyStaffGrants.userId,a.id),eq(propertyStaffGrants.status,"ACTIVE"),
  eq(memberships.role,"STAFF"),eq(memberships.status,"ACTIVE")));
 return {...a,memberships:m,propertyGrants:grants};
});
app.get("/v1/organizations",async req=>{
 const a=await requireActor(req);
 if(a.role==="SUPER_ADMIN")return db.select().from(organizations).orderBy(organizations.name);
 return db.select({id:organizations.id,name:organizations.name,status:organizations.status}).from(organizations)
  .innerJoin(memberships,eq(memberships.organizationId,organizations.id))
  .where(and(eq(memberships.userId,a.id),eq(memberships.status,"ACTIVE"),eq(organizations.status,"ACTIVE")));
});
app.post("/v1/organizations",async(req,reply)=>{
 const a=await requireActor(req),b=take(z.object({name:z.string().trim().min(2).max(120)}),req.body);
 const created=await db.transaction(async tx=>{
  const [o]=await tx.insert(organizations).values(b).returning();
  await tx.insert(memberships).values({organizationId:o.id,userId:a.id,role:"OWNER"});
  await tx.insert(auditLogs).values({actorId:a.id,organizationId:o.id,action:"ORG_CREATED",targetId:o.id,metadata:{}});
  return o;
 });
 return reply.code(201).send(created);
});
app.get("/v1/organizations/:orgId/properties",async req=>{
 const {orgId}=take(z.object({orgId:uuid}),req.params),a=await requireActor(req);
 // STAFF sees only assigned properties, never the organization-wide directory.
 let scopedIds:string[]|null=null;
 if(a.role!=="SUPER_ADMIN"){
  const [org]=await db.select({id:organizations.id}).from(organizations)
   .where(and(eq(organizations.id,orgId),eq(organizations.status,"ACTIVE"))).limit(1);
  if(!org)throw new AppError(404,"ORGANIZATION_NOT_FOUND");
  const [member]=await db.select().from(memberships).where(and(
   eq(memberships.organizationId,orgId),eq(memberships.userId,a.id),eq(memberships.status,"ACTIVE")
  )).limit(1);
  if(!member)throw new AppError(403,"ORG_ACCESS_DENIED");
  if(member.role==="STAFF"){
   const grants=await db.select({propertyId:propertyStaffGrants.propertyId}).from(propertyStaffGrants)
    .where(and(eq(propertyStaffGrants.organizationId,orgId),
     eq(propertyStaffGrants.userId,a.id),eq(propertyStaffGrants.status,"ACTIVE")));
   scopedIds=grants.map(g=>g.propertyId);
  }else await requireOrg(a,orgId);
 }
 const all=scopedIds!==null?(scopedIds.length===0?[]:await db.select().from(properties).where(and(
  eq(properties.organizationId,orgId),inArray(properties.id,scopedIds))).orderBy(properties.name)):
  await db.select().from(properties).where(eq(properties.organizationId,orgId)).orderBy(properties.name);
 if(scopedIds!==null)return all.map(p=>({id:p.id,organizationId:p.organizationId,
  name:p.name,address:p.address,cadence:p.cadence,createdAt:p.createdAt}));
 if(!all.length)return all;
 const rateRows=await db.select().from(propertyRateVersions).where(and(
  eq(propertyRateVersions.organizationId,orgId),
  inArray(propertyRateVersions.propertyId,all.map(p=>p.id)),
  lte(propertyRateVersions.effectiveFrom,bangkokToday())
 )).orderBy(desc(propertyRateVersions.effectiveFrom));
 // Master columns in properties retain legacy baseline. Project the active
 // version onto the public read model without mutating historical records.
 return all.map(p=>{
  const active=rateRows.find(r=>r.propertyId===p.id);
  return active?{...p,rentSatang:active.rentSatang,
   waterSatangPerUnit:active.waterSatangPerUnit,
   electricSatangPerUnit:active.electricSatangPerUnit}:p;
 });
});
app.post("/v1/organizations/:orgId/properties",async(req,reply)=>{
 const {orgId}=take(z.object({orgId:uuid}),req.params),a=await requireActor(req);await requireOrg(a,orgId,true);
 const b=take(z.object({name:z.string().trim().min(2).max(120),address:z.string().max(500).default(""),
  rentSatang:satang,waterSatangPerUnit:satang,electricSatangPerUnit:satang,
  cadence:z.enum(["MONTHLY","SEMI_MONTHLY","EVERY_15_DAYS"]).default("MONTHLY"),
  rollingAnchor:day.nullable().optional(),dueDays:z.number().int().min(0).max(60).default(7)
 }).refine(v=>v.cadence!=="EVERY_15_DAYS"||!!v.rollingAnchor,{message:"rollingAnchor required"}),req.body);
 const [p]=await db.insert(properties).values({...b,organizationId:orgId}).returning();
 await audit(a,orgId,"PROPERTY_CREATED",p.id);return reply.code(201).send(p);
});
app.get("/v1/properties/:propertyId/overview",async req=>{
 const a=await requireActor(req),p=await requireProperty(a,params(req.params));
 const [r,i,ledger,financeEntries]=await Promise.all([
  db.select().from(rooms).where(and(eq(rooms.propertyId,p.id),eq(rooms.organizationId,p.organizationId))),
  db.select().from(invoices).where(and(eq(invoices.propertyId,p.id),eq(invoices.organizationId,p.organizationId),eq(invoices.status,"ISSUED"))),
  db.select({invoiceId:paymentLedger.invoiceId,amountSatang:paymentLedger.amountSatang}).from(paymentLedger)
   .where(and(eq(paymentLedger.propertyId,p.id),eq(paymentLedger.organizationId,p.organizationId))),
  db.select({invoiceId:financeAdjustmentEntries.invoiceId,kind:financeAdjustmentEntries.kind,
   amountSatang:financeAdjustmentEntries.amountSatang}).from(financeAdjustmentEntries)
   .where(and(eq(financeAdjustmentEntries.propertyId,p.id),eq(financeAdjustmentEntries.organizationId,p.organizationId)))
 ]);
 const netManualByInvoice=new Map<string,number>();
 const creditsByInvoice=new Map<string,number>();
 for(const item of ledger)netManualByInvoice.set(item.invoiceId,(netManualByInvoice.get(item.invoiceId)??0)+item.amountSatang);
 for(const e of financeEntries){
  if(e.kind==="INTERNAL_CREDIT")creditsByInvoice.set(e.invoiceId,(creditsByInvoice.get(e.invoiceId)??0)+e.amountSatang);
  else netManualByInvoice.set(e.invoiceId,(netManualByInvoice.get(e.invoiceId)??0)-e.amountSatang);
 }
 const totals=new Map<string,number>();
 for(const invoice of i)totals.set(invoice.id,(netManualByInvoice.get(invoice.id)??0)+(creditsByInvoice.get(invoice.id)??0));
 const today=new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
 const due=i.map(bill=>({...bill,remaining:Math.max(0,bill.amountSatang-(totals.get(bill.id)??0))}));
 const sum=(values:number[])=>values.reduce((n,v)=>n+v,0);
 const totalBilledSatang=sum(i.map(x=>x.amountSatang)),
  manuallyApprovedSatang=sum(i.map(x=>netManualByInvoice.get(x.id)??0)),
  internalCreditSatang=sum(i.map(x=>creditsByInvoice.get(x.id)??0)),
  outstandingSatang=sum(due.map(x=>x.remaining)),
  overdueSatang=sum(due.filter(x=>x.dueDate<today).map(x=>x.remaining));
 if([totalBilledSatang,manuallyApprovedSatang,outstandingSatang,overdueSatang].some(x=>!Number.isSafeInteger(x)))
  throw new AppError(500,"DASHBOARD_AMOUNT_OVERFLOW");
 return {property:{id:p.id,name:p.name,cadence:p.cadence},rooms:r.length,occupied:r.filter(x=>x.status==="OCCUPIED").length,
  available:r.filter(x=>x.status==="AVAILABLE").length,totalBilledSatang,
  manuallyApprovedSatang,internalCreditSatang,outstandingSatang,overdueSatang,
  overdueInvoiceCount:due.filter(x=>x.remaining>0&&x.dueDate<today).length,
  issuedInvoices:i.length,paymentTracking:"MANUAL_OWNER_APPROVAL_NO_BANK_VERIFICATION"};
});
app.get("/v1/properties/:propertyId/rooms",async req=>{
 const a=await requireActor(req),p=await requireProperty(a,params(req.params),"STAFF_READ");
 const all=await db.select().from(rooms).where(and(
  eq(rooms.propertyId,p.id),eq(rooms.organizationId,p.organizationId)
 )).orderBy(rooms.number);
 const [member]=await db.select({role:memberships.role}).from(memberships).where(and(
  eq(memberships.organizationId,p.organizationId),eq(memberships.userId,a.id),
  eq(memberships.status,"ACTIVE"))).limit(1);
 if(member?.role==="STAFF")return all.map(r=>({id:r.id,organizationId:r.organizationId,
  propertyId:r.propertyId,number:r.number,floor:r.floor,status:r.status,createdAt:r.createdAt}));
 if(!all.length)return all;
 const dated=await db.select().from(roomRateVersions).where(and(
  eq(roomRateVersions.propertyId,p.id),
  eq(roomRateVersions.organizationId,p.organizationId),
  inArray(roomRateVersions.roomId,all.map(r=>r.id)),
  lte(roomRateVersions.effectiveFrom,bangkokToday())
 )).orderBy(desc(roomRateVersions.effectiveFrom));
 return all.map(room=>{
  const version=dated.find(v=>v.roomId===room.id);
  return version?{...room,
   rentOverrideSatang:version.rentOverrideSatang,
   waterOverrideSatang:version.waterOverrideSatang,
   electricOverrideSatang:version.electricOverrideSatang}:room;
 });
});
const override=z.object({rentOverrideSatang:satang.nullable().optional(),waterOverrideSatang:satang.nullable().optional(),electricOverrideSatang:satang.nullable().optional()});
app.post("/v1/properties/:propertyId/rooms",async(req,reply)=>{
 const a=await requireActor(req),p=await requireProperty(a,params(req.params),true);
 const b=take(override.extend({number:z.string().trim().min(1).max(50),floor:z.number().int().min(0).max(300).default(1)}),req.body);
 const [r]=await db.insert(rooms).values({...b,organizationId:p.organizationId,propertyId:p.id}).returning();
 await audit(a,p.organizationId,"ROOM_CREATED",r.id);return reply.code(201).send(r);
});
app.patch("/v1/properties/:propertyId/rooms/:roomId",async req=>{
 const a=await requireActor(req),p=await requireProperty(a,params(req.params),true);
 const {roomId}=take(z.object({roomId:uuid}),req.params);await getRoom(p,roomId);
 const b=take(override.extend({number:z.string().trim().min(1).max(50).optional()}).refine(v=>Object.keys(v).length>0),req.body);
 if(["rentOverrideSatang","waterOverrideSatang","electricOverrideSatang"]
  .some(k=>Object.prototype.hasOwnProperty.call(b,k)))
  throw new AppError(409,"ROOM_OVERRIDE_REQUIRES_EFFECTIVE_DATE");
 const [r]=await db.update(rooms).set({number:b.number})
  .where(and(eq(rooms.id,roomId),eq(rooms.propertyId,p.id))).returning();
 await audit(a,p.organizationId,"ROOM_UPDATED",r.id);return r;
});
app.get("/v1/properties/:propertyId/leases",async req=>{
 const a=await requireActor(req),p=await requireProperty(a,params(req.params));
 return db.select().from(leases).where(and(eq(leases.propertyId,p.id),eq(leases.organizationId,p.organizationId)));
});
app.post("/v1/properties/:propertyId/leases",async(req,reply)=>{
 const a=await requireActor(req),p=await requireProperty(a,params(req.params),true);
 const b=take(z.object({roomId:uuid,tenantName:z.string().trim().min(2).max(140),startDate:day}),req.body);
 const lease=await db.transaction(async tx=>{
  const [r]=await tx.update(rooms).set({status:"OCCUPIED"}).where(and(eq(rooms.id,b.roomId),eq(rooms.propertyId,p.id),eq(rooms.status,"AVAILABLE"))).returning();
  if(!r)throw new AppError(409,"ROOM_NOT_AVAILABLE");
  const [l]=await tx.insert(leases).values({...b,organizationId:p.organizationId,propertyId:p.id}).returning();
  await tx.insert(auditLogs).values({actorId:a.id,organizationId:p.organizationId,action:"LEASE_CREATED",targetId:l.id,metadata:{}});
  return l;
 });
 return reply.code(201).send(lease);
});
app.get("/v1/properties/:propertyId/readings",async req=>{
 const a=await requireActor(req),p=await requireProperty(a,params(req.params),"STAFF_READ");
 return db.select().from(meterReadings).where(eq(meterReadings.propertyId,p.id)).orderBy(desc(meterReadings.readAt));
});
app.post("/v1/properties/:propertyId/readings",async(req,reply)=>{
 const a=await requireActor(req),p=await requireProperty(a,params(req.params),"METER_READING");
 const b=take(z.object({roomId:uuid,kind:z.enum(["WATER","ELECTRIC"]),readAt:day,
   value:z.string().regex(/^\d{1,11}(\.\d{1,3})?$/)}),req.body);
 const created=await db.transaction(async tx=>{
  // Serialize revocations with an org lock and re-check active grant inside the write transaction.
  if(a.role!=="SUPER_ADMIN"){
   const [activeOrg]=await tx.select({id:organizations.id}).from(organizations).where(and(
    eq(organizations.id,p.organizationId),eq(organizations.status,"ACTIVE"))).for("share");
   if(!activeOrg)throw new AppError(403,"ORG_ACCESS_DENIED");
   const [activeMember]=await tx.select({role:memberships.role}).from(memberships).where(and(
    eq(memberships.organizationId,p.organizationId),eq(memberships.userId,a.id),
    eq(memberships.status,"ACTIVE"))).for("share");
   if(!activeMember)throw new AppError(403,"ORG_ACCESS_DENIED");
   if(activeMember.role==="STAFF"){
    const [grant]=await tx.select({level:propertyStaffGrants.level}).from(propertyStaffGrants).where(and(
     eq(propertyStaffGrants.organizationId,p.organizationId),eq(propertyStaffGrants.propertyId,p.id),
     eq(propertyStaffGrants.userId,a.id),eq(propertyStaffGrants.status,"ACTIVE"))).for("share");
    if(grant?.level!=="METER_READER")throw new AppError(403,"PROPERTY_ACCESS_DENIED");
   }
  }
  // Lock the room to serialize simultaneous inserts with different reading dates.
  const [locked]=await tx.select().from(rooms).where(and(eq(rooms.id,b.roomId),eq(rooms.propertyId,p.id),eq(rooms.organizationId,p.organizationId))).for("update");
  if(!locked)throw new AppError(404,"ROOM_NOT_FOUND");
  const milli=readingToMilli(b.value);
  const past=await tx.select().from(meterReadings).where(and(
   eq(meterReadings.roomId,b.roomId),eq(meterReadings.kind,b.kind)));
  const swaps=await tx.select().from(meterReplacements).where(and(
   eq(meterReplacements.roomId,b.roomId),eq(meterReplacements.kind,b.kind)
  )).orderBy(meterReplacements.replacedAt);
  const segment=readingSegmentIndex(b.readAt,swaps);
  const previousSwap=swaps[segment-1],followingSwap=swaps[segment];
  if(previousSwap&&milli<readingToMilli(previousSwap.newOpeningValue))
   throw new AppError(422,"NON_MONOTONIC_READING");
  if(followingSwap&&milli>readingToMilli(followingSwap.oldClosingValue))
   throw new AppError(422,"NON_MONOTONIC_READING");
  for(const r of past){
   if(r.readAt===b.readAt)throw new AppError(409,"DUPLICATE_READING");
   if(readingSegmentIndex(r.readAt,swaps)!==segment)continue;
   const old=readingToMilli(r.value);
   if((r.readAt<b.readAt&&old>milli)||(r.readAt>b.readAt&&old<milli))
    throw new AppError(422,"NON_MONOTONIC_READING");
  }
  const [r]=await tx.insert(meterReadings).values({...b,organizationId:p.organizationId,propertyId:p.id,createdBy:a.id}).returning();
  await tx.insert(auditLogs).values({actorId:a.id,organizationId:p.organizationId,action:"READING_CREATED",targetId:r.id,metadata:{kind:b.kind,readAt:b.readAt}});
  return r;
 });
 return reply.code(201).send(created);
});
const billing=z.object({roomId:uuid,start:day,endExclusive:day,
 partialMode:z.enum(["MOVE_IN","MOVE_OUT"]).optional()});
app.post("/v1/properties/:propertyId/bills/preview",async req=>{
 const a=await requireActor(req),p=await requireProperty(a,params(req.params));
 return prepareInvoice(take(billing,req.body),p);
});
app.post("/v1/properties/:propertyId/bills/issue",async(req,reply)=>{
 const a=await requireActor(req),p=await requireProperty(a,params(req.params),true);
 const b=take(billing,req.body),key=req.headers["idempotency-key"];
 if(typeof key!=="string"||key.length<8||key.length>128)throw new AppError(400,"IDEMPOTENCY_KEY_REQUIRED");
 const result=await db.transaction(async tx=>{
  const [locked]=await tx.select().from(properties).where(eq(properties.id,p.id)).for("update");
  if(!locked)throw new AppError(404,"PROPERTY_NOT_FOUND");
  const [replay]=await tx.select().from(invoices).where(and(eq(invoices.propertyId,p.id),eq(invoices.idempotencyKey,key)));
  if(replay){
   if(replay.roomId!==b.roomId||replay.periodStart!==b.start||replay.periodEnd!==b.endExclusive)throw new AppError(409,"IDEMPOTENCY_KEY_REUSED");
   return {invoice:replay,replayed:true};
  }
  const preview=await prepareInvoice(b,locked,tx);
  const [duplicate]=await tx.select().from(invoices).where(and(eq(invoices.leaseId,preview.lease.id),
    eq(invoices.periodStart,b.start),eq(invoices.periodEnd,b.endExclusive)));
  if(duplicate)throw new AppError(409,"PERIOD_ALREADY_BILLED");
  // A different invoice interval may still overlap this period. Serialize
  // through the property lock above to avoid double charging on concurrent requests.
  const [overlap]=await tx.select({id:invoices.id}).from(invoices)
   .where(and(eq(invoices.leaseId,preview.lease.id),
    eq(invoices.organizationId,p.organizationId),
    eq(invoices.status,"ISSUED"),
    lt(invoices.periodStart,b.endExclusive),
    gt(invoices.periodEnd,b.start))).limit(1);
  if(overlap)throw new AppError(409,"PERIOD_OVERLAP_ALREADY_BILLED");
  const [org]=await tx.select({name:organizations.name,status:organizations.status})
    .from(organizations).where(eq(organizations.id,locked.organizationId)).limit(1);
  if(!org||org.status!=="ACTIVE")throw new AppError(409,"ORGANIZATION_NOT_ACTIVE");
  const [i]=await tx.insert(invoices).values({organizationId:p.organizationId,propertyId:p.id,
    roomId:preview.room.id,leaseId:preview.lease.id,periodStart:b.start,periodEnd:b.endExclusive,
    dueDate:due(b.endExclusive,locked.dueDays),amountSatang:preview.totalSatang,idempotencyKey:key,issuedBy:a.id,
    documentSnapshot:{schemaVersion:1,issuerName:org.name,propertyName:locked.name,
      propertyAddress:locked.address,roomNumber:preview.room.number,tenantName:preview.lease.tenantName}
  }).returning();
  await tx.insert(invoiceLines).values(preview.lines.map((l,ordinal)=>({invoiceId:i.id,ordinal,...l})));
  await tx.insert(auditLogs).values({actorId:a.id,organizationId:p.organizationId,action:"INVOICE_ISSUED",targetId:i.id,metadata:{amountSatang:i.amountSatang}});
  // Enqueue only with verified active LINE tenant and explicit opt-in. Atomic with
  // the invoice: a rollback removes both the invoice and its pending notification.
  const notificationStatus=await queueInvoiceIssuedTx(tx,i);
  return {invoice:i,replayed:false,notificationStatus};
 });
 return reply.code(result.replayed?200:201).send(result);
});
app.get("/v1/properties/:propertyId/invoices",async req=>{
 const a=await requireActor(req),p=await requireProperty(a,params(req.params));
 return db.select().from(invoices).where(eq(invoices.propertyId,p.id)).orderBy(desc(invoices.createdAt));
});
app.get("/v1/properties/:propertyId/invoices/:invoiceId",async req=>{
 const a=await requireActor(req),p=await requireProperty(a,params(req.params));
 const {invoiceId}=take(z.object({invoiceId:uuid}),req.params);
 const [i]=await db.select().from(invoices).where(and(eq(invoices.id,invoiceId),eq(invoices.propertyId,p.id),eq(invoices.organizationId,p.organizationId)));
 if(!i)throw new AppError(404,"INVOICE_NOT_FOUND");
 return {...i,lines:await db.select().from(invoiceLines).where(eq(invoiceLines.invoiceId,i.id))};
});
app.post("/v1/admin/properties/:propertyId/compliance",async req=>{
 const a=await requireActor(req);requireAdmin(a);
 const p=await requireProperty(a,params(req.params));
 const b=take(z.object({evidenceRef:z.string().trim().min(8).max(500),waterAllowedMax:satang,electricAllowedMax:satang}),req.body);
 const [r]=await db.update(properties).set({complianceReviewedAt:new Date(),
  complianceEvidenceRef:b.evidenceRef,waterAllowedMax:b.waterAllowedMax,electricAllowedMax:b.electricAllowedMax}).where(eq(properties.id,p.id)).returning();
 await audit(a,p.organizationId,"TARIFF_REVIEWED",p.id);return {id:r.id,reviewedAt:r.complianceReviewedAt};
});
app.get("/v1/admin/overview",async req=>{
 const a=await requireActor(req);requireAdmin(a);
 const [o,p,r,i]=await Promise.all([db.select().from(organizations),db.select().from(properties),db.select().from(rooms),db.select().from(invoices)]);
 return {organizationCount:o.length,propertyCount:p.length,roomCount:r.length,invoiceCount:i.length};
});
await registerTenantRoutes(app);
await registerPaymentRoutes(app);
await registerEvidenceUploadRoutes(app);
await registerBillingDocumentRoutes(app);
await registerPromptPayRoutes(app);
await registerFinancialAdjustmentRoutes(app);
await registerLineOaRoutes(app);
await registerLineConsentRoutes(app);
await registerLineOperationsRoutes(app);
await registerLeaseLifecycleRoutes(app);
await registerPropertyRateRoutes(app);
await registerRoomRateRoutes(app);
await registerMeterReplacementRoutes(app);
await registerStaffRoutes(app);
await app.listen({host:config.HOST,port:config.PORT});
