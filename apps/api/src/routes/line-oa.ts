import {createHash} from "node:crypto";
import type {FastifyInstance} from "fastify";
import {and,eq} from "drizzle-orm";
import {z} from "zod";
import {config} from "../config.js";
import {db} from "../db/client.js";
import {lineOaBindings,lineWebhookEvents,organizations,users,memberships,leases} from "../db/schema.js";
import {AppError,requireActor,requireAdmin} from "../security.js";
import {parseLineWebhook,verifyLineSignature} from "../services/line-oa.js";
import {answerRoleHelp,type HelpRole} from "../services/line-help-rag.js";

const bindingInput=z.object({
 organizationId:z.uuid(),
 botUserId:z.string().regex(/^U[0-9a-f]{32}$/i),
 enabled:z.boolean().default(false)
});
export async function registerLineOaRoutes(app:FastifyInstance){
 app.get("/v1/admin/line-oa/bindings",async req=>{
  const actor=await requireActor(req);requireAdmin(actor);
  return db.select({id:lineOaBindings.id,organizationId:lineOaBindings.organizationId,
   botUserId:lineOaBindings.botUserId,enabled:lineOaBindings.enabled})
   .from(lineOaBindings);
 });
 app.put("/v1/admin/line-oa/bindings",async req=>{
  const actor=await requireActor(req);requireAdmin(actor);
  const input=bindingInput.parse(req.body);
  if(input.botUserId!==config.LINE_OA_BOT_USER_ID)
   throw new AppError(422,"LINE_OA_DESTINATION_NOT_CONFIGURED");
  if(input.enabled&&!config.LINE_MESSAGING_CHANNEL_SECRET)
   throw new AppError(409,"LINE_WEBHOOK_SECRET_REQUIRED");
  const [org]=await db.select({id:organizations.id}).from(organizations)
   .where(and(eq(organizations.id,input.organizationId),eq(organizations.status,"ACTIVE"))).limit(1);
  if(!org)throw new AppError(404,"ORGANIZATION_NOT_FOUND");
  const [row]=await db.insert(lineOaBindings).values(input)
   .onConflictDoUpdate({target:lineOaBindings.organizationId,
    set:{botUserId:input.botUserId,enabled:input.enabled}}).returning({
    id:lineOaBindings.id,organizationId:lineOaBindings.organizationId,
    botUserId:lineOaBindings.botUserId,enabled:lineOaBindings.enabled
   });
  return row;
 });

 // Scoped JSON content parser deliberately produces raw bytes. Never deserialize
 // or change encoding before computing X-Line-Signature.
 await app.register(async scope=>{
  scope.addContentTypeParser("application/json",{parseAs:"buffer",bodyLimit:262144},
   (_req,body,done)=>done(null,body));
  scope.post("/v1/line/oa/webhook",{
   bodyLimit:262144,
   config:{rateLimit:{max:60,timeWindow:"1 minute"}}
  },async(req,reply)=>{
   const secret=config.LINE_MESSAGING_CHANNEL_SECRET;
   if(!secret||!config.LINE_OA_BOT_USER_ID)
    throw new AppError(503,"LINE_WEBHOOK_NOT_CONFIGURED");
   const raw=req.body;
   if(!Buffer.isBuffer(raw))throw new AppError(415,"LINE_RAW_BODY_REQUIRED");
   const sig=req.headers["x-line-signature"];
   if(typeof sig!=="string"||!verifyLineSignature(raw,sig,secret))
    throw new AppError(401,"INVALID_LINE_WEBHOOK_SIGNATURE");
   let body:ReturnType<typeof parseLineWebhook>;
   try{body=parseLineWebhook(raw);}
   catch{throw new AppError(400,"INVALID_LINE_WEBHOOK_BODY");}
   if(body.destination!==config.LINE_OA_BOT_USER_ID)
    throw new AppError(404,"LINE_OA_DESTINATION_NOT_FOUND");
   const [binding]=await db.select().from(lineOaBindings).where(and(
    eq(lineOaBindings.botUserId,body.destination),eq(lineOaBindings.enabled,true))).limit(1);
   if(!binding)throw new AppError(404,"LINE_OA_BINDING_NOT_ENABLED");
   const [org]=await db.select({id:organizations.id}).from(organizations).where(and(
    eq(organizations.id,binding.organizationId),eq(organizations.status,"ACTIVE"))).limit(1);
   if(!org)throw new AppError(409,"LINE_ORGANIZATION_NOT_ACTIVE");
   const newlyAccepted:ReturnType<typeof parseLineWebhook>["events"]=[];
   const result=await db.transaction(async tx=>{
    let inserted=0,duplicates=0;
    for(const event of body.events){
     const sourceHash=event.sourceLineUserId
      ?createHash("sha256").update(event.sourceLineUserId).digest("hex"):null;
     const rows=await tx.insert(lineWebhookEvents).values({
      bindingId:binding.id,organizationId:binding.organizationId,
      webhookEventId:event.webhookEventId,eventType:event.eventType,
      redelivery:event.redelivery,sourceUserHash:sourceHash
     }).onConflictDoNothing().returning({id:lineWebhookEvents.id});
     if(rows.length){inserted++;newlyAccepted.push(event);}else duplicates++;
    }
    return {inserted,duplicates};
   });
   let botReplies=0,botProcessed=0;
   if(config.LINE_CHATBOT_MODE!=="disabled"){
    for(const event of newlyAccepted){
     if(event.eventType!=="message"||!event.messageText||!event.replyToken||!event.sourceLineUserId)continue;
     const [account]=await db.select({id:users.id,platformRole:users.platformRole}).from(users).where(and(eq(users.lineSubject,event.sourceLineUserId),eq(users.status,"ACTIVE"))).limit(1);
     let role:HelpRole="PUBLIC";
     if(account?.platformRole==="SUPER_ADMIN")role="SUPER_ADMIN";
     else if(account){
      const [membership]=await db.select({role:memberships.role}).from(memberships).where(and(eq(memberships.userId,account.id),eq(memberships.organizationId,binding.organizationId),eq(memberships.status,"ACTIVE"))).limit(1);
      if(membership?.role==="OWNER"||membership?.role==="MANAGER"||membership?.role==="STAFF")role=membership.role;
      else {const [lease]=await db.select({id:leases.id}).from(leases).where(and(eq(leases.tenantLineSubject,event.sourceLineUserId),eq(leases.organizationId,binding.organizationId),eq(leases.status,"ACTIVE"))).limit(1);if(lease)role="TENANT";else role="USER";}
     }
     const answer=await answerRoleHelp({question:event.messageText,role,apiKey:config.LINE_HELP_AI_API_KEY,provider:config.LINE_HELP_AI_PROVIDER,model:config.LINE_HELP_AI_MODEL});
     botProcessed++;
     if(config.LINE_CHATBOT_MODE==="simulate")continue;
     if(config.LINE_CHATBOT_MODE!=="live"||!config.LINE_CHATBOT_LIVE_APPROVED||!config.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN)continue;
     try{
      const sent=await fetch("https://api.line.me/v2/bot/message/reply",{method:"POST",headers:{Authorization:`Bearer ${config.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN}`,"content-type":"application/json"},body:JSON.stringify({replyToken:event.replyToken,messages:[{type:"text",text:answer.answer.slice(0,5000)}]}),signal:AbortSignal.timeout(8000)});
      if(sent.ok)botReplies++;else req.log.warn({providerStatus:sent.status},"LINE help reply failed");
     }catch{req.log.warn("LINE help reply provider unavailable");}
    }
   }
   reply.header("cache-control","no-store");
   const note=config.LINE_CHATBOT_MODE==="disabled"?"Events persisted; chatbot disabled":
    config.LINE_CHATBOT_MODE==="simulate"?"Support answer simulated; no LINE reply sent":
    !config.LINE_CHATBOT_LIVE_APPROVED?"Live reply approval missing; no LINE reply sent":
    !config.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN?"Messaging API token missing; no LINE reply sent":
    "Role-filtered live reply attempted";
   return {ok:true,accepted:result.inserted,duplicates:result.duplicates,botProcessed,botReplies,note};
  });
 });
}
