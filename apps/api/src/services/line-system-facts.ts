import {and,count,eq} from "drizzle-orm";
import {db} from "../db/client.js";
import {invoices,maintenanceTickets,memberships,properties,rooms,users} from "../db/schema.js";
import type {HelpRole} from "./line-help-rag.js";

/** Minimal aggregate context only. Never send personal records, IDs, payment credentials or secrets to an LLM. */
export async function roleSystemFacts(input:{role:HelpRole;accountId:string|undefined;organizationId:string}):Promise<string>{
 if(!input.accountId||!["OWNER","MANAGER","SUPER_ADMIN"].includes(input.role))return "";
 if(input.role==="SUPER_ADMIN"){
  const [user]=await db.select({id:users.id}).from(users).where(and(eq(users.id,input.accountId),
   eq(users.platformRole,"SUPER_ADMIN"),eq(users.status,"ACTIVE"))).limit(1);
  if(!user)return "";
 }else{
  const [member]=await db.select({id:memberships.id}).from(memberships).where(and(
   eq(memberships.userId,input.accountId),eq(memberships.organizationId,input.organizationId),
   eq(memberships.role,input.role as "OWNER"|"MANAGER"),eq(memberships.status,"ACTIVE"))).limit(1);
  if(!member)return "";
 }
 const [sites,roomStates,invoiceStates,tickets]=await Promise.all([
  db.select({total:count()}).from(properties).where(eq(properties.organizationId,input.organizationId)),
  db.select({status:rooms.status,total:count()}).from(rooms).where(eq(rooms.organizationId,input.organizationId)).groupBy(rooms.status),
  db.select({status:invoices.status,total:count()}).from(invoices).where(eq(invoices.organizationId,input.organizationId)).groupBy(invoices.status),
  db.select({status:maintenanceTickets.status,total:count()}).from(maintenanceTickets)
   .where(eq(maintenanceTickets.organizationId,input.organizationId)).groupBy(maintenanceTickets.status)
 ]);
 return `ข้อมูลรวมล่าสุดขององค์กรที่ตรวจสิทธิ์แล้ว (ไม่รวมข้อมูลผู้เช่ารายบุคคล): หอพัก ${sites[0]?.total??0} แห่ง; ห้อง ${roomStates.map(x=>`${x.status}:${x.total}`).join(", ")||"ไม่มีข้อมูล"}; ใบแจ้งหนี้ ${invoiceStates.map(x=>`${x.status}:${x.total}`).join(", ")||"ไม่มีข้อมูล"}; งานซ่อม ${tickets.map(x=>`${x.status}:${x.total}`).join(", ")||"ไม่มีข้อมูล"}. ตัวเลขนี้เป็นจำนวนรายการ ไม่ใช่ยอดเงินคงเหลือ`; 
}
