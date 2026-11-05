import type {FastifyInstance} from "fastify";
import {z} from "zod";
import {requireActor} from "../security.js";
import {changePlatformRole,listPlatformAccounts} from "../services/platform-admins.js";

const querySchema=z.object({search:z.string().trim().min(1).max(80).optional()}).strict();
const accountParams=z.object({userId:z.uuid()}).strict();
const roleBody=z.object({role:z.enum(["USER","SUPER_ADMIN"])}).strict();
export async function registerPlatformAdminRoutes(app:FastifyInstance){
 app.get("/v1/admin/platform-users",async(req,reply)=>{
  const query=querySchema.parse(req.query);
  reply.header("cache-control","no-store");
  return listPlatformAccounts(await requireActor(req),query.search);
 });
 app.patch("/v1/admin/platform-users/:userId/role",async(req,reply)=>{
  const {userId}=accountParams.parse(req.params),{role}=roleBody.parse(req.body);
  reply.header("cache-control","no-store");
  return changePlatformRole(await requireActor(req),userId,role);
 });
}
