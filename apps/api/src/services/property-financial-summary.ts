import {computeFinancialPosition,type AdjustmentKind} from "./financial-rules.js";

type InvoiceInput={id:string;periodStart:string;amountSatang:number};
type PaymentInput={invoiceId:string;amountSatang:number};
type AdjustmentInput={invoiceId:string;kind:AdjustmentKind;amountSatang:number};
type MonthlyTotals={
 invoiceCount:number;totalBilledSatang:number;grossManualApprovedSatang:number;
 reversedManualSatang:number;netManualApprovedSatang:number;
 internalCreditSatang:number;outstandingSatang:number;
};
const zero=():MonthlyTotals=>({invoiceCount:0,totalBilledSatang:0,
 grossManualApprovedSatang:0,reversedManualSatang:0,
 netManualApprovedSatang:0,internalCreditSatang:0,outstandingSatang:0});
function add(target:MonthlyTotals,position:MonthlyTotals){
 for(const key of Object.keys(target) as Array<keyof MonthlyTotals>){
  const next=target[key]+position[key];
  if(!Number.isSafeInteger(next))throw new Error("FINANCIAL_REPORT_OVERFLOW");
  target[key]=next;
 }
}
export function summarizePropertyFinancials(
 invoices:readonly InvoiceInput[],payments:readonly PaymentInput[],
 adjustments:readonly AdjustmentInput[],
){
 const paid=new Map<string,number>();
 for(const row of payments)paid.set(row.invoiceId,(paid.get(row.invoiceId)??0)+row.amountSatang);
 const reversed=new Map<string,number>(),credits=new Map<string,number>();
 for(const row of adjustments){
  if(row.kind==="REVERSE_MANUAL_PAYMENT")reversed.set(row.invoiceId,(reversed.get(row.invoiceId)??0)+row.amountSatang);
  if(row.kind==="INTERNAL_CREDIT")credits.set(row.invoiceId,(credits.get(row.invoiceId)??0)+row.amountSatang);
 }
 const totals=zero(),byMonth=new Map<string,MonthlyTotals>();
 for(const invoice of invoices){
  const p=computeFinancialPosition(invoice.amountSatang,paid.get(invoice.id)??0,
   reversed.get(invoice.id)??0,credits.get(invoice.id)??0);
  const month=invoice.periodStart.slice(0,7);
  const monthTotals=byMonth.get(month)??zero();
  const item:MonthlyTotals={invoiceCount:1,totalBilledSatang:invoice.amountSatang,
   grossManualApprovedSatang:p.grossManualApprovedSatang,
   reversedManualSatang:p.reversedManualSatang,
   netManualApprovedSatang:p.netManualApprovedSatang,
   internalCreditSatang:p.internalCreditSatang,
   outstandingSatang:p.outstandingSatang};
  add(totals,item);add(monthTotals,item);byMonth.set(month,monthTotals);
 }
 return {totals,months:[...byMonth].sort(([a],[b])=>a.localeCompare(b))
  .map(([month,values])=>({month,...values}))};
}
