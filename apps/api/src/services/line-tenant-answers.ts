import {and,desc,eq,inArray} from "drizzle-orm";
import {db} from "../db/client.js";
import {invoices,leases,maintenanceTickets} from "../db/schema.js";
import {getFinancialPosition} from "./financial-position.js";

/** Account data never enters an LLM prompt. Only a verified LINE identity can access it. */
export function tenantQuestionKind(question:string):"invoice"|"maintenance"|null{
 if(/(?:ยอด(?:ค้าง|ชำระ|บิล)|ค้าง(?:ชำระ|ค่าเช่า)|บิล(?:ของฉัน|ล่าสุด|เดือนนี้)|ใบแจ้งหนี้(?:ของฉัน|ล่าสุด)|outstanding|my invoice)/i.test(question))return "invoice";
 if(/(?:แจ้งซ่อม(?:ของฉัน|ล่าสุด)|สถานะ(?:งาน)?ซ่อม|ซ่อม(?:ถึงไหน|เสร็จหรือยัง)|my maintenance)/i.test(question))return "maintenance";
 return null;
}
export async function answerTenantDatabaseQuestion(input:{question:string;role:string;lineUserId:string;organizationId:string}):Promise<string|null>{
 const kind=tenantQuestionKind(input.question);
 if(!kind)return null;
 if(input.role!=="TENANT")return "ข้อมูลส่วนบุคคลนี้เปิดให้เฉพาะผู้เช่าที่ผูกบัญชี LINE กับสัญญาเช่าที่ใช้งานอยู่ กรุณาเข้าสู่ระบบผู้เช่า";
 const active=await db.select({id:leases.id}).from(leases).where(and(
  eq(leases.organizationId,input.organizationId),eq(leases.tenantLineSubject,input.lineUserId),eq(leases.status,"ACTIVE")
 )).limit(30);
 if(!active.length)return "ไม่พบสัญญาเช่าที่ใช้งานอยู่สำหรับบัญชี LINE นี้";
 const leaseIds=active.map(x=>x.id);
 if(kind==="maintenance"){
  const rows=await db.select({title:maintenanceTickets.title,status:maintenanceTickets.status,updatedAt:maintenanceTickets.updatedAt})
   .from(maintenanceTickets).where(and(eq(maintenanceTickets.organizationId,input.organizationId),inArray(maintenanceTickets.leaseId,leaseIds)))
   .orderBy(desc(maintenanceTickets.updatedAt)).limit(3);
  return rows.length?"สถานะงานแจ้งซ่อมล่าสุดของคุณ:\n"+rows.map(x=>`${x.title.slice(0,80)}: ${x.status}`).join("\n"):"ยังไม่พบรายการแจ้งซ่อมของคุณ";
 }
 const rows=await db.select({id:invoices.id,dueDate:invoices.dueDate,status:invoices.status})
  .from(invoices).where(and(eq(invoices.organizationId,input.organizationId),inArray(invoices.leaseId,leaseIds),eq(invoices.status,"ISSUED")))
  .orderBy(desc(invoices.createdAt)).limit(3);
 if(!rows.length)return "ยังไม่พบใบแจ้งหนี้สำหรับสัญญาเช่าของคุณ";
 const results=await Promise.all(rows.map(async x=>({dueDate:x.dueDate,status:x.status,position:await getFinancialPosition(x.id)})));
 return "ใบแจ้งหนี้ล่าสุดของคุณ:\n"+results.map(x=>`ครบกำหนด ${x.dueDate} | สถานะ ${x.status} | คงเหลือ ${(x.position.outstandingSatang/100).toFixed(2)} บาท`).join("\n")+"\nตรวจสอบรายละเอียดและสถานะชำระล่าสุดในระบบผู้เช่า";
}
