import type {FastifyInstance} from "fastify";
import {and,desc,eq,exists,isNull} from "drizzle-orm";
import {z} from "zod";
import {db} from "../db/client.js";
import {memberships,orgNotifications} from "../db/schema.js";
import {AppError,requireActor} from "../security.js";

export async function registerNotificationRoutes(app:FastifyInstance){
 app.get("/v1/notifications",async req=>{
  const actor=await requireActor(req);
  const query=z.object({unreadOnly:z.coerce.boolean().default(false),limit:z.coerce.number().int().min(1).max(100).default(30)}).parse(req.query);
  const filters=[eq(orgNotifications.recipientUserId,actor.id)];
  if(query.unreadOnly)filters.push(isNull(orgNotifications.readAt));
  const items=await db.select({id:orgNotifications.id,organizationId:orgNotifications.organizationId,
   eventKey:orgNotifications.eventKey,kind:orgNotifications.kind,title:orgNotifications.title,
   body:orgNotifications.body,readAt:orgNotifications.readAt,createdAt:orgNotifications.createdAt
  }).from(orgNotifications).innerJoin(memberships,and(
   eq(memberships.userId,orgNotifications.recipientUserId),
   eq(memberships.organizationId,orgNotifications.organizationId),eq(memberships.status,"ACTIVE")
  )).where(and(...filters)).orderBy(desc(orgNotifications.createdAt)).limit(query.limit);
  return {items};
 });
 app.post("/v1/notifications/:notificationId/read",async req=>{
  const actor=await requireActor(req);
  const {notificationId}=z.object({notificationId:z.uuid()}).parse(req.params);
  const [item]=await db.update(orgNotifications).set({readAt:new Date()}).where(and(
   eq(orgNotifications.id,notificationId),eq(orgNotifications.recipientUserId,actor.id),
   exists(db.select({id:memberships.id}).from(memberships).where(and(
    eq(memberships.userId,actor.id),eq(memberships.organizationId,orgNotifications.organizationId),
    eq(memberships.status,"ACTIVE")
   )))
  )).returning({id:orgNotifications.id,readAt:orgNotifications.readAt});
  if(!item)throw new AppError(404,"NOTIFICATION_NOT_FOUND");
  return item;
 });
}
