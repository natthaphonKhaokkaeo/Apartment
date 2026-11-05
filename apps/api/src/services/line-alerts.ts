import {and,desc,eq,isNull,sql} from "drizzle-orm";
import {db} from "../db/client.js";
import {auditLogs,lineOpsAlerts,lineOutbox} from "../db/schema.js";
import {AppError} from "../security.js";
import {alertKinds,assessLineOpsAlerts,type LineOpsAlertKind} from "./line-fairness.js";
import {outboxOrgOverview} from "./line-operations.js";

export async function listLineOpsAlerts(organizationId:string,limit=40){
 const rows=await db.select({
  id:lineOpsAlerts.id,kind:lineOpsAlerts.kind,openedAt:lineOpsAlerts.openedAt,
  lastSeenAt:lineOpsAlerts.lastSeenAt,resolvedAt:lineOpsAlerts.resolvedAt,
  acknowledgedAt:lineOpsAlerts.acknowledgedAt
 }).from(lineOpsAlerts).where(eq(lineOpsAlerts.organizationId,organizationId))
  .orderBy(desc(lineOpsAlerts.openedAt)).limit(Math.min(50,Math.max(1,limit)));
 return rows;
}
/** Acknowledge never restarts a job or sends an external alert. */
export async function acknowledgeLineOpsAlert(input:{
 organizationId:string;alertId:string;actorId:string
}){
 return db.transaction(async tx=>{
  const [alert]=await tx.select({
   id:lineOpsAlerts.id,acknowledgedAt:lineOpsAlerts.acknowledgedAt,
   resolvedAt:lineOpsAlerts.resolvedAt
  }).from(lineOpsAlerts).where(and(eq(lineOpsAlerts.id,input.alertId),
   eq(lineOpsAlerts.organizationId,input.organizationId))).for("update").limit(1);
  if(!alert)throw new AppError(404,"LINE_ALERT_NOT_FOUND");
  if(alert.acknowledgedAt)throw new AppError(409,"LINE_ALERT_ALREADY_ACKNOWLEDGED");
  if(alert.resolvedAt)throw new AppError(409,"LINE_ALERT_ALREADY_RESOLVED");
  const [updated]=await tx.update(lineOpsAlerts).set({
   acknowledgedAt:new Date(),acknowledgedBy:input.actorId
  }).where(eq(lineOpsAlerts.id,alert.id)).returning({id:lineOpsAlerts.id});
  await tx.insert(auditLogs).values({actorId:input.actorId,organizationId:input.organizationId,
   action:"LINE_OPS_ALERT_ACKNOWLEDGED",targetId:alert.id,
   metadata:{externalNotificationSent:false}});
  return {alertId:updated.id,acknowledged:true,externalNotificationSent:false};
 });
}
/** Observe-only reconciler. Unique partial index + PG transaction-level advisory
 * lock makes incident opening idempotent across observer replicas.
 * Bounded to 150 organizations per tick. No external network requests.
 */
export async function reconcileLineOpsAlerts(now=new Date()){
 const orgs=await db.select({organizationId:lineOutbox.organizationId})
  .from(lineOutbox).groupBy(lineOutbox.organizationId).limit(150);
 const activeOrgs=await db.select({organizationId:lineOpsAlerts.organizationId})
  .from(lineOpsAlerts).where(isNull(lineOpsAlerts.resolvedAt))
  .groupBy(lineOpsAlerts.organizationId).limit(150);
 const organizationIds=[...new Set([...orgs,...activeOrgs].map(x=>x.organizationId))];
 const result={checked:0,opened:0,resolved:0,active:0};
 for(const organizationId of organizationIds.slice(0,150)){
  const state=await outboxOrgOverview(organizationId,now);
  const desired=new Set<LineOpsAlertKind>(assessLineOpsAlerts(state));
  await db.transaction(async tx=>{
   await tx.execute(sql.raw("SELECT pg_advisory_xact_lock(72853019948)"));
   const existing=await tx.select().from(lineOpsAlerts)
    .where(and(eq(lineOpsAlerts.organizationId,organizationId),
     isNull(lineOpsAlerts.resolvedAt))).for("update");
   for(const alert of existing){
    if(desired.has(alert.kind as LineOpsAlertKind)){
     await tx.update(lineOpsAlerts).set({lastSeenAt:now}).where(eq(lineOpsAlerts.id,alert.id));
     result.active++;
     desired.delete(alert.kind as LineOpsAlertKind);
    }else{
     await tx.update(lineOpsAlerts).set({resolvedAt:now}).where(eq(lineOpsAlerts.id,alert.id));
     result.resolved++;
    }
   }
   for(const kind of alertKinds){
    if(!desired.has(kind))continue;
    await tx.insert(lineOpsAlerts).values({
     organizationId,kind,openedAt:now,lastSeenAt:now
    });
    result.opened++;result.active++;
   }
  });
  result.checked++;
 }
 return result;
}
