import {createHash} from "node:crypto";
import {and,eq} from "drizzle-orm";
import {z} from "zod";
import {db} from "../db/client.js";
import {auditLogs,maintenanceTicketAttachments,maintenanceTickets} from "../db/schema.js";
import {AppError} from "../security.js";
import {sanitizeEvidence} from "./evidence.js";

const MAX_BYTES=2*1024*1024;
const MAX_ATTACHMENTS=5;
const uploadBody=z.object({
 contentType:z.enum(["image/jpeg","image/png","image/webp"]),
 dataBase64:z.string().min(4).max(2_796_204)
}).strict();
const safeMetadata={id:maintenanceTicketAttachments.id,contentType:maintenanceTicketAttachments.contentType,contentLength:maintenanceTicketAttachments.contentLength,sha256:maintenanceTicketAttachments.sha256,createdAt:maintenanceTicketAttachments.createdAt};

type Scope={ticketId:string;propertyId:string;organizationId:string;actorId:string};

export async function addMaintenanceTicketAttachment(scope:Scope,rawBody:unknown){
 const body=uploadBody.parse(rawBody);
 const bytes=Buffer.from(body.dataBase64,"base64");
 if(bytes.length===0||bytes.length>MAX_BYTES||bytes.toString("base64")!==body.dataBase64) throw new AppError(413,"MAINTENANCE_ATTACHMENT_INVALID_SIZE");
 const safe=await sanitizeEvidence(bytes,body.contentType);
 const sha256=createHash("sha256").update(safe).digest("hex");
 return db.transaction(async tx=>{
  const [ticket]=await tx.select({id:maintenanceTickets.id}).from(maintenanceTickets)
   .where(and(eq(maintenanceTickets.id,scope.ticketId),eq(maintenanceTickets.propertyId,scope.propertyId),eq(maintenanceTickets.organizationId,scope.organizationId))).for("update");
  if(!ticket) throw new AppError(404,"MAINTENANCE_TICKET_NOT_FOUND");
  const [existing]=await tx.select(safeMetadata).from(maintenanceTicketAttachments)
   .where(and(eq(maintenanceTicketAttachments.ticketId,scope.ticketId),eq(maintenanceTicketAttachments.sha256,sha256))).limit(1);
  if(existing) return existing;
  const current=await tx.select({id:maintenanceTicketAttachments.id}).from(maintenanceTicketAttachments).where(eq(maintenanceTicketAttachments.ticketId,scope.ticketId)).limit(MAX_ATTACHMENTS);
  if(current.length>=MAX_ATTACHMENTS) throw new AppError(409,"MAINTENANCE_ATTACHMENT_LIMIT_REACHED");
  const [attachment]=await tx.insert(maintenanceTicketAttachments).values({
   ticketId:scope.ticketId,propertyId:scope.propertyId,organizationId:scope.organizationId,
   uploadedBy:scope.actorId,contentType:"image/webp",contentLength:safe.length,sha256,content:safe
  }).returning(safeMetadata);
  await tx.insert(auditLogs).values({actorId:scope.actorId,organizationId:scope.organizationId,action:"MAINTENANCE_ATTACHMENT_ADDED",targetId:scope.ticketId,metadata:{attachmentId:attachment.id,sha256,contentLength:safe.length}});
  return attachment;
 });
}

export async function listMaintenanceTicketAttachments(scope:Pick<Scope,"ticketId"|"propertyId"|"organizationId">){
 return db.select(safeMetadata).from(maintenanceTicketAttachments).where(and(
  eq(maintenanceTicketAttachments.ticketId,scope.ticketId),eq(maintenanceTicketAttachments.propertyId,scope.propertyId),eq(maintenanceTicketAttachments.organizationId,scope.organizationId)
 )).orderBy(maintenanceTicketAttachments.createdAt);
}

export async function readMaintenanceTicketAttachment(scope:Pick<Scope,"ticketId"|"propertyId"|"organizationId">,attachmentId:string){
 const [attachment]=await db.select({content:maintenanceTicketAttachments.content,contentType:maintenanceTicketAttachments.contentType,contentLength:maintenanceTicketAttachments.contentLength})
  .from(maintenanceTicketAttachments).where(and(eq(maintenanceTicketAttachments.id,attachmentId),eq(maintenanceTicketAttachments.ticketId,scope.ticketId),eq(maintenanceTicketAttachments.propertyId,scope.propertyId),eq(maintenanceTicketAttachments.organizationId,scope.organizationId))).limit(1);
 if(!attachment) throw new AppError(404,"MAINTENANCE_ATTACHMENT_NOT_FOUND");
 return attachment;
}

export const maintenanceAttachmentLimits={maxBytes:MAX_BYTES,maxPerTicket:MAX_ATTACHMENTS};
