import {and,eq,isNull} from "drizzle-orm";
import {db} from "../db/client.js";
import {invoices,leases,lineOaBindings,lineNotificationConsents,lineOutbox} from "../db/schema.js";

type Scope={bindingId:string;organizationId:string;leaseId:string;recipientLineUserId:string};
type Consent=Scope&{revokedAt:Date|null};
export function isActiveTenantConsent(consent:Consent|undefined,scope:Scope):boolean{
 return !!consent&&consent.revokedAt===null&&
  consent.bindingId===scope.bindingId&&consent.organizationId===scope.organizationId&&
  consent.leaseId===scope.leaseId&&consent.recipientLineUserId===scope.recipientLineUserId;
}
export type NotificationKind="BILL_ISSUED"|"PAYMENT_DUE"|"MAINTENANCE_UPDATED"|"TENANT_LINK_APPROVED";
export function notificationEventKey(kind:NotificationKind,invoiceId:string):string{
 return kind+":"+invoiceId;
}
export function notificationText(kind:NotificationKind):string{
 const text:Record<NotificationKind,string>={
  BILL_ISSUED:"คุณมีใบแจ้งหนี้ใหม่จากหอพัก กรุณาเข้าสู่ระบบผู้เช่าเพื่อดูรายละเอียดและตรวจสอบยอดชำระ",
  PAYMENT_DUE:"ใบแจ้งหนี้ของคุณใกล้ครบกำหนดชำระ กรุณาตรวจสอบยอดคงเหลือและข้อมูลการชำระในระบบผู้เช่า",
  MAINTENANCE_UPDATED:"สถานะคำขอแจ้งซ่อมของคุณมีการอัปเดต กรุณาเข้าสู่ระบบผู้เช่าเพื่อตรวจสอบรายละเอียด",
  TENANT_LINK_APPROVED:"คำขอผูกสัญญาเช่าของคุณได้รับการอนุมัติ กรุณาเข้าสู่ระบบผู้เช่าเพื่อตรวจสอบรายละเอียด"
 };
 return text[kind];
}
/** v1 explicit consent covers bills, due dates and repairs, NOT account invitations. */
export function notificationPurposeAllowed(kind:NotificationKind){return kind!=="TENANT_LINK_APPROVED";}
/** Called *inside* the invoice issuance DB transaction. Sending is never done here.
 * Skip when no enabled channel and explicit unrevoked consent for this exact lease/recipient.
 * Under a replayed invoice do not enqueue a second event.
 */
export async function queueLeaseNotificationTx(tx:Pick<typeof db,"select"|"insert">,
 invoice:Pick<typeof invoices.$inferSelect,"id"|"leaseId"|"organizationId"|"propertyId">,
 kind:NotificationKind):
 Promise<"QUEUED"|"INELIGIBLE"|"ALREADY_QUEUED">{
 if(!notificationPurposeAllowed(kind))return "INELIGIBLE";
 const [[lease],[binding]]=await Promise.all([
  tx.select({id:leases.id,organizationId:leases.organizationId,
   tenantLineSubject:leases.tenantLineSubject}).from(leases).where(and(
    eq(leases.id,invoice.leaseId),eq(leases.organizationId,invoice.organizationId),
    eq(leases.propertyId,invoice.propertyId),eq(leases.status,"ACTIVE")
   )).limit(1),
  tx.select().from(lineOaBindings).where(and(eq(lineOaBindings.organizationId,invoice.organizationId),
   eq(lineOaBindings.enabled,true))).limit(1)
 ]);
 if(!lease?.tenantLineSubject||!binding)return "INELIGIBLE";
 const scope={bindingId:binding.id,organizationId:invoice.organizationId,
  leaseId:lease.id,recipientLineUserId:lease.tenantLineSubject};
 const [consent]=await tx.select().from(lineNotificationConsents).where(and(
  eq(lineNotificationConsents.bindingId,scope.bindingId),
  eq(lineNotificationConsents.organizationId,scope.organizationId),
  eq(lineNotificationConsents.leaseId,scope.leaseId),
  eq(lineNotificationConsents.recipientLineUserId,scope.recipientLineUserId),
  isNull(lineNotificationConsents.revokedAt)
 )).limit(1);
 if(!isActiveTenantConsent(consent,scope))return "INELIGIBLE";
 const [created]=await tx.insert(lineOutbox).values({
  bindingId:scope.bindingId,organizationId:scope.organizationId,
  consentId:consent.id,leaseId:scope.leaseId,
  recipientLineUserId:scope.recipientLineUserId,
  eventKey:notificationEventKey(kind,invoice.id),
  templateKey:kind,messageText:notificationText(kind)
 }).onConflictDoNothing().returning({id:lineOutbox.id});
 return created?"QUEUED":"ALREADY_QUEUED";
}

export const queueInvoiceNotificationTx=queueLeaseNotificationTx;

export async function queueInvoiceIssuedTx(tx:Pick<typeof db,"select"|"insert">,
 invoice:Pick<typeof invoices.$inferSelect,"id"|"leaseId"|"organizationId"|"propertyId">){
 return queueInvoiceNotificationTx(tx,invoice,"BILL_ISSUED");
}
