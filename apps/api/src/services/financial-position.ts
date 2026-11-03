import {eq} from "drizzle-orm";
import {db} from "../db/client.js";
import {invoices,paymentLedger,financeAdjustmentEntries} from "../db/schema.js";
import {AppError} from "../security.js";
import {computeFinancialPosition} from "./financial-rules.js";
export async function getFinancialPosition(invoiceId:string,tx:Pick<typeof db,"select">=db){
 const [[bill],payments,adjustments]=await Promise.all([
  tx.select({amountSatang:invoices.amountSatang}).from(invoices).where(eq(invoices.id,invoiceId)).limit(1),
  tx.select({amount:paymentLedger.amountSatang}).from(paymentLedger).where(eq(paymentLedger.invoiceId,invoiceId)),
  tx.select({kind:financeAdjustmentEntries.kind,amount:financeAdjustmentEntries.amountSatang})
   .from(financeAdjustmentEntries).where(eq(financeAdjustmentEntries.invoiceId,invoiceId))
 ]);
 if(!bill)throw new AppError(404,"INVOICE_NOT_FOUND");
 const sum=(items:number[])=>items.reduce((a,b)=>a+b,0);
 try{
  return computeFinancialPosition(bill.amountSatang,sum(payments.map(p=>p.amount)),
   sum(adjustments.filter(a=>a.kind==="REVERSE_MANUAL_PAYMENT").map(a=>a.amount)),
   sum(adjustments.filter(a=>a.kind==="INTERNAL_CREDIT").map(a=>a.amount)));
 }catch{
  throw new AppError(409,"FINANCIAL_LEDGER_INCONSISTENT");
 }
}
