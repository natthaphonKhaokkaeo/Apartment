/** Private owner-only financial export rows; never include tenant PII. */
export type ReceivableCsvRow={
 invoiceId:string;
 periodStart:string;
 periodEnd:string;
 dueDate:string;
 totalBilledSatang:number;
 netManualApprovedSatang:number;
 internalCreditSatang:number;
 outstandingSatang:number;
};
const columns=[
 "invoice_id","period_start","period_end","due_date","total_billed_satang",
 "net_manual_approved_satang","internal_credit_satang","outstanding_satang",
] as const;
const validMoney=(n:number)=>Number.isSafeInteger(n)&&n>=0&&n<=2147483647;
const validDate=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&
 Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
const validUuid=(id:string)=>/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id);
/** Uses only UUID, ISO calendar dates and integer satang; no untrusted text
 * cells can be interpreted as CSV/spreadsheet formulas.
 */
export function serializeReceivablesCsv(rows:ReceivableCsvRow[]):string{
 const result=[columns.join(",")];
 for(const row of rows){
  if(!validUuid(row.invoiceId))throw Error("RECEIVABLE_INVALID_ID");
  if(![row.periodStart,row.periodEnd,row.dueDate].every(validDate)||
    row.periodEnd<row.periodStart)throw Error("RECEIVABLE_INVALID_DATE");
  const monetary=[
   row.totalBilledSatang,row.netManualApprovedSatang,
   row.internalCreditSatang,row.outstandingSatang,
  ];
  if(!monetary.every(validMoney))throw Error("RECEIVABLE_INVALID_AMOUNT");
  if(row.netManualApprovedSatang+row.internalCreditSatang+row.outstandingSatang!==
    row.totalBilledSatang)throw Error("RECEIVABLE_TOTAL_MISMATCH");
  result.push([row.invoiceId,row.periodStart,row.periodEnd,row.dueDate,...monetary].join(","));
 }
 return result.join("\n")+"\n";
}
