import {and,asc,eq} from "drizzle-orm";
import {z} from "zod";
import {db} from "../db/client.js";
import {invoices,paymentClaims} from "../db/schema.js";
import {AppError} from "../security.js";
import {getFinancialPosition} from "./financial-position.js";
import {queueInvoiceNotificationTx} from "./line-notifications.js";

export function bangkokDate(date:Date):string{
 const pieces=new Intl.DateTimeFormat("en-GB",{
  timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit",day:"2-digit"
 }).formatToParts(date);
 const part=(name:string)=>pieces.find(p=>p.type===name)?.value??"";
 return part("year")+"-"+part("month")+"-"+part("day");
}
/** Manual once-per-day reminder preparation, no external calls.
 * No payment gateway, automatic scheduler or LINE sender. Requires an
 * explicit organisation and today's Bangkok date when APPLY is requested.
 */
export async function prepareDueReminders(options:{
 date:string;organizationId:string;apply?:boolean;limit?:number;now?:Date
}){
 const date=z.iso.date().parse(options.date);
 const organizationId=z.uuid().parse(options.organizationId);
 const limit=Math.max(1,Math.min(100,options.limit??50));
 if(options.apply&&date!==bangkokDate(options.now??new Date()))
  throw new AppError(409,"DUE_REMINDER_MUST_RUN_ON_LOCAL_DUE_DATE");
 const candidates=await db.select().from(invoices).where(and(
  eq(invoices.organizationId,organizationId),
  eq(invoices.status,"ISSUED"),eq(invoices.dueDate,date)
 )).orderBy(asc(invoices.createdAt)).limit(limit);
 const result={
  mode:options.apply?"APPLY" as const:"DRY_RUN" as const,
  candidates:candidates.length,skipped:0,
  eligible:0,queued:0,alreadyQueued:0
 };
 for(const bill of candidates){
  if(!options.apply){
   // Dry-run leaves consent and finance state untouched. "eligible" is a
   // potential candidate count, not permission to send or deliver.
   result.eligible++;
   continue;
  }
  const outcome=await db.transaction(async tx=>{
   // Same invoice lock as payment approvals and financial corrections.
   const [locked]=await tx.select().from(invoices).where(and(
    eq(invoices.id,bill.id),eq(invoices.organizationId,organizationId),
    eq(invoices.status,"ISSUED"))).for("update");
   if(!locked)return "INELIGIBLE" as const;
   const position=await getFinancialPosition(locked.id,tx);
   if(position.outstandingSatang<=0)return "INELIGIBLE" as const;
   const [pending]=await tx.select({id:paymentClaims.id}).from(paymentClaims)
    .where(and(eq(paymentClaims.invoiceId,locked.id),
     eq(paymentClaims.organizationId,organizationId),
     eq(paymentClaims.status,"PENDING"))).limit(1);
   if(pending)return "INELIGIBLE" as const;
   return queueInvoiceNotificationTx(tx,locked,"PAYMENT_DUE");
  });
  if(outcome==="QUEUED"){result.eligible++;result.queued++;}
  else if(outcome==="ALREADY_QUEUED"){result.eligible++;result.alreadyQueued++;}
  else result.skipped++;
 }
 return result;
}
