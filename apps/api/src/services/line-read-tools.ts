import {and,count,eq} from "drizzle-orm";
import {db} from "../db/client.js";
import {invoices,leases,maintenanceTickets,memberships,organizations,properties,rooms,users,lineOutbox,paymentClaims} from "../db/schema.js";
import type {HelpRole} from "./line-help-rag.js";
import {answerTenantDatabaseQuestion,tenantQuestionKind} from "./line-tenant-answers.js";

/** Fixed, parameter-free read tools. An LLM can select one; it cannot choose SQL, IDs or columns. */
export const LINE_READ_TOOLS=[
 "PROPERTY_COUNT","ROOM_STATUS","ROOM_LOOKUP","LEASE_STATUS","INVOICE_STATUS","MAINTENANCE_STATUS","LINE_DELIVERY_STATUS","PAYMENT_CLAIM_STATUS","MY_INVOICE","MY_REPAIR"
] as const;
export type LineReadTool=(typeof LINE_READ_TOOLS)[number];
export type LineReadContext={tool:LineReadTool;role:HelpRole;accountId?:string;organizationId:string;lineUserId:string;question?:string};
export function isLineReadTool(value:unknown):value is LineReadTool{
 return typeof value==="string"&&(LINE_READ_TOOLS as readonly string[]).includes(value);
}
/** The selector is read from the original message, never from a model-generated ID. */
export function extractRoomNumber(question:string):string|null{
 const match=question.match(/(?:ห้อง(?:พัก)?\s*(?:หมายเลข|เลขที่|เบอร์)?\s*)(?=[ก-๙A-Za-z0-9\-_/]*[0-9])([ก-๙A-Za-z0-9][ก-๙A-Za-z0-9\-_/]{0,15})(?![ก-๙A-Za-z0-9\-_/])/i);
 return match?.[1]??null;
}
export function permittedLineReadTool(role:HelpRole,tool:LineReadTool):boolean{
 if(tool==="MY_INVOICE"||tool==="MY_REPAIR")return role==="TENANT";
 if(tool==="PAYMENT_CLAIM_STATUS")return role==="OWNER";
 return role==="OWNER"||role==="MANAGER"||role==="SUPER_ADMIN";
}
/** Conservative offline fallback; the model can select any allowlisted topic from natural language. */
export function resolveLineReadTool(question:string,selected?:unknown,role?:HelpRole):LineReadTool|null{
 if(/(?:ขอ|แสดง|ดึง|เปิดเผย|บอก|ดูค่า).{0,45}(?:api.?key|secret|token|password|คีย์ลับ|รหัสผ่าน)/i.test(question))return null;
 if(role==="TENANT"){
  if(tenantQuestionKind(question)==="invoice")return "MY_INVOICE";
  if(tenantQuestionKind(question)==="maintenance")return "MY_REPAIR";
 }
 if(isLineReadTool(selected))return selected;
 if(extractRoomNumber(question)&&/(?:ว่าง|สถานะ|occupied|มีคน|ยังมี|มีผู้เช่า|ยังเช่า)/i.test(question))return "ROOM_LOOKUP";
 if((role==="OWNER"||role==="MANAGER"||role==="SUPER_ADMIN")&&!/(?:ของฉัน|ของผม|ของเรา)/.test(question)){
  if(tenantQuestionKind(question)==="invoice")return "INVOICE_STATUS";
  if(tenantQuestionKind(question)==="maintenance")return "MAINTENANCE_STATUS";
 }
 if(!/(?:กี่|จำนวน|รวม|ทั้งหมด|ภาพรวม|overview|count|total)/i.test(question)){
  if(tenantQuestionKind(question)==="invoice")return "MY_INVOICE";
  if(tenantQuestionKind(question)==="maintenance")return "MY_REPAIR";
 }
 if(/(?:วิธี|ยังไง|อย่างไร|ขั้นตอน|ตั้งค่า|สอน|คู่มือ|how\s+to)/i.test(question))return null;
 if(!/(?:กี่|จำนวน|สรุป|ทั้งหมด|ตอนนี้|เหลือ|สถานะ|ภาพรวม|overview|count|total|available)/i.test(question))return null;
 if(/(?:line|ไลน์|แจ้งเตือน|delivery|ส่งข้อความ|ส่งสำเร็จ)/i.test(question)&&/(?:ส่ง|แจ้ง|message|delivery)/i.test(question))return "LINE_DELIVERY_STATUS";
 if(/(?:สลิป|หลักฐานโอน|payment.?claim|เคลม|รายการชำระ|คำขอชำระ)/i.test(question))return "PAYMENT_CLAIM_STATUS";
 if(/(?:งานซ่อม|แจ้งซ่อม|ซ่อม|repair|maintenance)/i.test(question))return "MAINTENANCE_STATUS";
 if(/(?:ใบแจ้งหนี้|ออกบิล|บิล|invoice|billing)/i.test(question))return "INVOICE_STATUS";
 if(/(?:สัญญา|lease)/i.test(question))return "LEASE_STATUS";
 if(/(?:ห้อง|room|ว่าง|occupied)/i.test(question))return "ROOM_STATUS";
 if(/(?:อาคาร|หอพัก|property|building)/i.test(question))return "PROPERTY_COUNT";
 return null;
}

const denied="ไม่มีสิทธิ์ดูข้อมูลนี้จาก LINE Chatbot กรุณาใช้บัญชีที่ได้รับอนุญาตและตรวจสอบสิทธิ์ในระบบ";
const counts=(rows:readonly {status:string;total:number}[])=>rows.length?
 rows.map(x=>`${x.status}: ${x.total} รายการ`).join("; "):"ไม่มีข้อมูล";

/** Re-check authorization against current DB state, not the role inferred in webhook or proposed by AI. */
async function verifyAdminAccess(input:LineReadContext){
 if(!input.accountId)return false;
 const [[user],[org]]=await Promise.all([
  db.select({platformRole:users.platformRole}).from(users).where(and(eq(users.id,input.accountId),eq(users.status,"ACTIVE"))).limit(1),
  db.select({id:organizations.id}).from(organizations).where(and(eq(organizations.id,input.organizationId),eq(organizations.status,"ACTIVE"))).limit(1)
 ]);
 if(!user||!org)return false;
 if(input.role==="SUPER_ADMIN")return user.platformRole==="SUPER_ADMIN";
 if(input.role!=="OWNER"&&input.role!=="MANAGER")return false;
 const [membership]=await db.select({id:memberships.id}).from(memberships).where(and(
  eq(memberships.userId,input.accountId),eq(memberships.organizationId,input.organizationId),
  eq(memberships.role,input.role),eq(memberships.status,"ACTIVE"))).limit(1);
 return !!membership;
}
/** Only minimum scoped aggregates (no names, personal records, phone, IDs or amounts). */
async function executeVerifiedLineReadTool(input:LineReadContext):Promise<string>{
 if(input.tool==="MY_INVOICE"||input.tool==="MY_REPAIR"){
  const question=input.tool==="MY_INVOICE"?"ยอดค้างชำระ":"สถานะงานซ่อม";
  return await answerTenantDatabaseQuestion({question,role:input.role,lineUserId:input.lineUserId,organizationId:input.organizationId})
   ??"ไม่พบข้อมูลที่ตรวจสอบสิทธิ์ได้สำหรับบัญชี LINE นี้";
 }
 if(!await verifyAdminAccess(input))return denied;
 const scope=input.organizationId;
 switch(input.tool){
  case "PROPERTY_COUNT":{
   const [row]=await db.select({total:count()}).from(properties).where(eq(properties.organizationId,scope));
   return `หอพักในองค์กรที่ตรวจสอบสิทธิ์แล้ว: ${row?.total??0} แห่ง`;
  }
  case "ROOM_LOOKUP":{
   const roomNumber=extractRoomNumber(input.question??"");
   if(!roomNumber)return "โปรดระบุหมายเลขห้องในคำถาม เช่น ห้อง A-101 ยังว่างอยู่ไหม";
   const rows=await db.select({number:rooms.number,status:rooms.status,propertyName:properties.name})
    .from(rooms).innerJoin(properties,eq(rooms.propertyId,properties.id))
    .where(and(eq(rooms.organizationId,scope),eq(properties.organizationId,scope),eq(rooms.number,roomNumber))).limit(5);
   return rows.length?"สถานะห้องที่ตรวจสอบสิทธิ์แล้ว: "+rows.map(x=>`หอ ${x.propertyName} ห้อง ${x.number}: ${x.status}`).join("; "):
    `ไม่พบห้องหมายเลข ${roomNumber} ในองค์กรที่ตรวจสอบสิทธิ์แล้ว`;
  }
  case "ROOM_STATUS":{
   const rows=await db.select({status:rooms.status,total:count()}).from(rooms)
    .where(eq(rooms.organizationId,scope)).groupBy(rooms.status);
   return `สถานะห้องพักปัจจุบันขององค์กร: ${counts(rows)}`;
  }
  case "LEASE_STATUS":{
   const rows=await db.select({status:leases.status,total:count()}).from(leases)
    .where(eq(leases.organizationId,scope)).groupBy(leases.status);
   return `สถานะสัญญาเช่าขององค์กร: ${counts(rows)}`;
  }
  case "INVOICE_STATUS":{
   const rows=await db.select({status:invoices.status,total:count()}).from(invoices)
    .where(eq(invoices.organizationId,scope)).groupBy(invoices.status);
   return `จำนวนใบแจ้งหนี้ขององค์กรตามสถานะ: ${counts(rows)} (เป็นจำนวนเอกสาร ไม่ใช่ยอดค้างชำระ)`;
  }
  case "MAINTENANCE_STATUS":{
   const rows=await db.select({status:maintenanceTickets.status,total:count()}).from(maintenanceTickets)
    .where(eq(maintenanceTickets.organizationId,scope)).groupBy(maintenanceTickets.status);
   return `สถานะงานแจ้งซ่อมขององค์กร: ${counts(rows)}`;
  }
  case "LINE_DELIVERY_STATUS":{
   const rows=await db.select({status:lineOutbox.status,total:count()}).from(lineOutbox)
    .where(eq(lineOutbox.organizationId,scope)).groupBy(lineOutbox.status);
   return `สถานะคิวแจ้งเตือน LINE ขององค์กร (จำนวนข้อความ ไม่แสดงผู้รับหรือเนื้อหา): ${counts(rows)}`;
  }
  case "PAYMENT_CLAIM_STATUS":{
   const rows=await db.select({status:paymentClaims.status,total:count()}).from(paymentClaims)
    .where(eq(paymentClaims.organizationId,scope)).groupBy(paymentClaims.status);
   return `จำนวนคำขอตรวจสอบหลักฐานชำระตามสถานะ (เฉพาะ OWNER): ${counts(rows)}`;
  }
 }
}

/** Deny before DB access; injected executor is exclusively for isolated tests. */
export async function dispatchLineReadTool(input:LineReadContext,execute:typeof executeVerifiedLineReadTool=executeVerifiedLineReadTool){
 if(!permittedLineReadTool(input.role,input.tool))return {answer:denied,sourceIds:[] as string[]};
 if(!input.organizationId||!input.lineUserId||(input.tool!=="MY_INVOICE"&&input.tool!=="MY_REPAIR"&&!input.accountId))
  return {answer:denied,sourceIds:[] as string[]};
 const answer=await execute(input);
 return {answer,sourceIds:[`verified-read:${input.tool}`]};
}
