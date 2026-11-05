import type {FastifyInstance,FastifyRequest} from "fastify";
import {z} from "zod";
import {AppError,requireActor} from "../security.js";
import {getDepositContext,recordDepositReceipt,proposeDepositReview,decideDepositReview} from "../services/deposit-ledger.js";
const scope=z.object({propertyId:z.uuid(),leaseId:z.uuid()});
const reason=z.string().trim().min(15).max(500);
const amountSatang=z.number().int().positive().max(2147483647);
function idempotency(req:FastifyRequest){
 const key=req.headers["idempotency-key"];
 if(typeof key!=="string"||!/^[A-Za-z0-9_-]{8,128}$/.test(key))throw new AppError(400,"IDEMPOTENCY_KEY_REQUIRED");
 return key;
}
export async function registerDepositRoutes(app:FastifyInstance){
 const base="/v1/properties/:propertyId/leases/:leaseId/deposits";
 app.get(base,async(req,reply)=>{
  reply.header("cache-control","no-store");
  return getDepositContext(await requireActor(req),scope.parse(req.params));
 });
 app.post(base+"/receipts",{config:{rateLimit:{max:15,timeWindow:"1 minute"}}},async(req,reply)=>{
  const actor=await requireActor(req),params=scope.parse(req.params);
  const input=z.object({amountSatang,reference:z.string().trim().min(8).max(128).regex(/^[A-Za-z0-9_-]+$/),reason}).strict().parse(req.body);
  const result=await recordDepositReceipt(actor,params,input,idempotency(req));
  return reply.code(result.replayed?200:201).send(result);
 });
 app.post(base+"/reviews",{config:{rateLimit:{max:15,timeWindow:"1 minute"}}},async(req,reply)=>{
  const actor=await requireActor(req),params=scope.parse(req.params);
  const input=z.object({amountSatang,kind:z.enum(["DEDUCTION","REFUND_REVIEW","DISPUTE_REVIEW"]),reason}).strict().parse(req.body);
  const result=await proposeDepositReview(actor,params,input,idempotency(req));
  return reply.code(result.replayed?200:201).send(result);
 });
 app.post(base+"/reviews/:reviewId/decision",{config:{rateLimit:{max:15,timeWindow:"1 minute"}}},async req=>{
  const actor=await requireActor(req);
  const params=scope.extend({reviewId:z.uuid()}).parse(req.params);
  return decideDepositReview(actor,params,params.reviewId,z.object({action:z.enum(["APPROVE","REJECT"]),reason}).strict().parse(req.body));
 });
}
