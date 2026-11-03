import {createHash,randomBytes} from "node:crypto";
import {and, eq, gt, isNull} from "drizzle-orm";
import type {FastifyRequest} from "fastify";
import {db} from "./db/client.js";
import {memberships,organizations,properties,sessions,users} from "./db/schema.js";

export class AppError extends Error {
  constructor(public statusCode: number, public code: string, message = code) {super(message);}
}
export type Actor = {id:string; role:string; name:string};
const hash = (secret:string) => createHash("sha256").update(secret).digest("hex");
export function newSessionToken() {return randomBytes(32).toString("base64url");}
export function tokenHash(raw:string) {return hash(raw);}
export async function requireActor(req:FastifyRequest):Promise<Actor> {
  const raw = req.cookies?.apartment_session;
  if(!raw) throw new AppError(401,"UNAUTHENTICATED");
  const result = await db.select({id:users.id,role:users.platformRole,name:users.displayName}).from(sessions)
    .innerJoin(users,eq(sessions.userId,users.id))
    .where(and(eq(sessions.tokenHash,hash(raw)),gt(sessions.expiresAt,new Date()),isNull(sessions.revokedAt),eq(users.status,"ACTIVE"))).limit(1);
  if(!result[0]) throw new AppError(401,"UNAUTHENTICATED");
  return result[0];
}
export async function requireOrg(actor:Actor, orgId:string, write=false) {
  const [org] = await db.select().from(organizations).where(and(eq(organizations.id,orgId),eq(organizations.status,"ACTIVE"))).limit(1);
  if(!org) throw new AppError(404,"ORGANIZATION_NOT_FOUND");
  if(actor.role === "SUPER_ADMIN") return org;
  const [member] = await db.select().from(memberships).where(and(eq(memberships.organizationId,org.id),eq(memberships.userId,actor.id),eq(memberships.status,"ACTIVE"))).limit(1);
  if(!member || (write && !["OWNER","MANAGER"].includes(member.role))) throw new AppError(403,"ORG_ACCESS_DENIED");
  return org;
}
export async function requireProperty(actor:Actor,propertyId:string,write=false){
  const [property] = await db.select().from(properties).where(eq(properties.id,propertyId)).limit(1);
  if(!property) throw new AppError(404,"PROPERTY_NOT_FOUND");
  await requireOrg(actor,property.organizationId,write);
  return property;
}
export function requireAdmin(actor:Actor) {
 if(actor.role!=="SUPER_ADMIN") throw new AppError(403,"SUPER_ADMIN_REQUIRED");
}
