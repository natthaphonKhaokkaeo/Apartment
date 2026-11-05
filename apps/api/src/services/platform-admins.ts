import {and,asc,eq,ilike,isNull,sql} from "drizzle-orm";
import {config} from "../config.js";
import {db} from "../db/client.js";
import {auditLogs,sessions,users} from "../db/schema.js";
import {AppError,type Actor,requireAdmin} from "../security.js";
import {assertPlatformAdminChangeAllowed,type PlatformRole} from "./platform-admin-policy.js";

export type PlatformAccount={id:string;displayName:string;platformRole:string;status:string;createdAt:Date};

export async function listPlatformAccounts(actor:Actor,search?:string):Promise<PlatformAccount[]>{
 requireAdmin(actor);
 const query=db.select({id:users.id,displayName:users.displayName,platformRole:users.platformRole,
  status:users.status,createdAt:users.createdAt}).from(users);
 const rows=search?await query.where(ilike(users.displayName,`%${search}%`)).orderBy(asc(users.displayName)).limit(50):
  await query.orderBy(asc(users.displayName)).limit(50);
 return rows;
}

export async function changePlatformRole(actor:Actor,targetId:string,nextRole:PlatformRole){
 requireAdmin(actor);
 return db.transaction(async tx=>{
  // Serialize grants/revocations so concurrent requests cannot remove the last admin.
  await tx.execute(sql.raw("SELECT pg_advisory_xact_lock(72853019950)"));
  const [target]=await tx.select({id:users.id,displayName:users.displayName,platformRole:users.platformRole,
   status:users.status,lineSubject:users.lineSubject}).from(users).where(eq(users.id,targetId)).for("update");
  if(!target)throw new AppError(404,"PLATFORM_ACCOUNT_NOT_FOUND");
  const admins=target.platformRole==="SUPER_ADMIN"&&nextRole==="USER"?
   await tx.select({id:users.id}).from(users).where(and(eq(users.platformRole,"SUPER_ADMIN"),eq(users.status,"ACTIVE"))).for("update"):[];
  assertPlatformAdminChangeAllowed({actorId:actor.id,actorRole:actor.role,targetId:target.id,
   targetRole:target.platformRole,nextRole,targetStatus:target.status,targetLineSubject:target.lineSubject,
   bootstrapLineSubject:config.SUPER_ADMIN_LINE_USER_ID,activeSuperAdminCount:admins.length});
  if(target.platformRole===nextRole)return {id:target.id,displayName:target.displayName,platformRole:target.platformRole,changed:false};
  await tx.update(users).set({platformRole:nextRole}).where(eq(users.id,target.id));
  // Force a fresh verified LIFF login so effective role and Rich Menu are reloaded together.
  await tx.update(sessions).set({revokedAt:new Date()}).where(and(eq(sessions.userId,target.id),isNull(sessions.revokedAt)));
  await tx.insert(auditLogs).values({actorId:actor.id,organizationId:null,targetId:target.id,
   action:nextRole==="SUPER_ADMIN"?"PLATFORM_ADMIN_GRANTED":"PLATFORM_ADMIN_REVOKED",
   metadata:{fromRole:target.platformRole,toRole:nextRole}});
  return {id:target.id,displayName:target.displayName,platformRole:nextRole,changed:true};
 });
}
