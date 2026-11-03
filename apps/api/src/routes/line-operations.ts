import type {FastifyInstance} from "fastify";
import {z} from "zod";
import {db} from "../db/client.js";
import {organizations} from "../db/schema.js";
import {eq} from "drizzle-orm";
import {AppError,requireActor,requireAdmin} from "../security.js";
import {acknowledgeLineOpsAlert,listLineOpsAlerts} from "../services/line-alerts.js";
import {
 acknowledgeOutboxDeadLetter,outboxDeadLetters,outboxOrgOverview
} from "../services/line-operations.js";

const orgQuery=z.object({organizationId:z.uuid()});
const deadQuery=orgQuery.extend({limit:z.coerce.number().int().min(1).max(50).default(40)});
const reviewParams=z.object({outboxId:z.uuid()});
const reviewBody=z.object({organizationId:z.uuid(),
 reviewReason:z.string().trim().min(15).max(500)});
async function requireOrgExists(organizationId:string){
 const [org]=await db.select({id:organizations.id}).from(organizations)
  .where(eq(organizations.id,organizationId)).limit(1);
 if(!org)throw new AppError(404,"ORGANIZATION_NOT_FOUND");
}
export async function registerLineOperationsRoutes(app:FastifyInstance){
 app.get("/v1/admin/line-operations/overview",{
  config:{rateLimit:{max:30,timeWindow:"1 minute"}}
 },async(req,reply)=>{
  const actor=await requireActor(req);requireAdmin(actor);
  const {organizationId}=orgQuery.parse(req.query);
  await requireOrgExists(organizationId);
  reply.header("cache-control","no-store");
  return outboxOrgOverview(organizationId);
 });
 app.get("/v1/admin/line-operations/dead-letters",{
  config:{rateLimit:{max:30,timeWindow:"1 minute"}}
 },async(req,reply)=>{
  const actor=await requireActor(req);requireAdmin(actor);
  const {organizationId,limit}=deadQuery.parse(req.query);
  await requireOrgExists(organizationId);
  reply.header("cache-control","no-store");
  return outboxDeadLetters(organizationId,limit);
 });
 app.post("/v1/admin/line-operations/dead-letters/:outboxId/acknowledge",{
  config:{rateLimit:{max:10,timeWindow:"1 minute"}}
 },async(req,reply)=>{
  const actor=await requireActor(req);requireAdmin(actor);
  const {outboxId}=reviewParams.parse(req.params);
  const {organizationId,reviewReason}=reviewBody.parse(req.body);
  await requireOrgExists(organizationId);
  const result=await acknowledgeOutboxDeadLetter({
   organizationId,outboxId,actorId:actor.id,reason:reviewReason
  });
  reply.header("cache-control","no-store");
  return result;
 });
 app.get("/v1/admin/line-operations/alerts",{
  config:{rateLimit:{max:30,timeWindow:"1 minute"}}
 },async(req,reply)=>{
  const actor=await requireActor(req);requireAdmin(actor);
  const {organizationId,limit}=deadQuery.parse(req.query);
  await requireOrgExists(organizationId);
  reply.header("cache-control","no-store");
  return listLineOpsAlerts(organizationId,limit);
 });
 app.post("/v1/admin/line-operations/alerts/:alertId/acknowledge",{
  config:{rateLimit:{max:10,timeWindow:"1 minute"}}
 },async(req,reply)=>{
  const actor=await requireActor(req);requireAdmin(actor);
  const {alertId}=z.object({alertId:z.uuid()}).parse(req.params);
  const {organizationId}=orgQuery.parse(req.body);
  await requireOrgExists(organizationId);
  const result=await acknowledgeLineOpsAlert({
   organizationId,alertId,actorId:actor.id
  });
  reply.header("cache-control","no-store");
  return result;
 });
}
