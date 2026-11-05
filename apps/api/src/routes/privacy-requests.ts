import type {FastifyInstance,FastifyRequest} from "fastify";
import {z} from "zod";
import {AppError,requireActor} from "../security.js";
import {listMyPrivacyRequests,submitPrivacyRequest,cancelPrivacyRequest,listAdminPrivacyRequests,previewPrivacyRequest,decidePrivacyRequest,executePrivacyRequest} from "../services/privacy-requests.js";
const idParams=z.object({requestId:z.uuid()});
function key(req:FastifyRequest){const key=req.headers["idempotency-key"];if(typeof key!=="string"||!/^[A-Za-z0-9_-]{8,128}$/.test(key))throw new AppError(400,"IDEMPOTENCY_KEY_REQUIRED");return key;}
export async function registerPrivacyRequestRoutes(app:FastifyInstance){
 app.get("/v1/tenant/privacy/requests",async(req,reply)=>{reply.header("cache-control","no-store");return listMyPrivacyRequests(await requireActor(req));});
 app.post("/v1/tenant/privacy/requests",{config:{rateLimit:{max:5,timeWindow:"1 minute"}}},async(req,reply)=>{
  const actor=await requireActor(req),input=z.object({reason:z.string().trim().min(15).max(500),acknowledgedProfileOnly:z.literal(true)}).strict().parse(req.body);
  const result=await submitPrivacyRequest(actor,input.reason,key(req));return reply.header("cache-control","no-store").code(result.replayed?200:201).send(result);
 });
 app.post("/v1/tenant/privacy/requests/:requestId/cancel",async(req,reply)=>{reply.header("cache-control","no-store");return cancelPrivacyRequest(await requireActor(req),idParams.parse(req.params).requestId);});
 app.get("/v1/admin/privacy/requests",async(req,reply)=>{reply.header("cache-control","no-store");return listAdminPrivacyRequests(await requireActor(req));});
 app.get("/v1/admin/privacy/requests/:requestId/preview",async(req,reply)=>{reply.header("cache-control","no-store");return previewPrivacyRequest(await requireActor(req),idParams.parse(req.params).requestId);});
 app.post("/v1/admin/privacy/requests/:requestId/decision",async(req,reply)=>{
  const actor=await requireActor(req),{requestId}=idParams.parse(req.params),input=z.object({action:z.enum(["APPROVE","REJECT"]),reason:z.string().trim().min(15).max(500)}).strict().parse(req.body);
  reply.header("cache-control","no-store");return decidePrivacyRequest(actor,requestId,input);
 });
 app.post("/v1/admin/privacy/requests/:requestId/execute",{config:{rateLimit:{max:5,timeWindow:"1 minute"}}},async(req,reply)=>{
  const actor=await requireActor(req),{requestId}=idParams.parse(req.params);z.object({confirmedProfileOnly:z.literal(true)}).strict().parse(req.body);
  reply.header("cache-control","no-store");return executePrivacyRequest(actor,requestId);
 });
}
