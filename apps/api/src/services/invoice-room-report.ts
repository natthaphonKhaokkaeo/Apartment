import {computeFinancialPosition} from "./financial-rules.js";

/** A voided invoice remains visible for audit but is never counted as payable. */
export function reportInvoiceFinancials(
 status:"ISSUED"|"VOID",amountSatang:number,grossApprovedSatang:number,
 reversedSatang:number,creditSatang:number
){
 const position=computeFinancialPosition(amountSatang,grossApprovedSatang,reversedSatang,creditSatang);
 return {paidSatang:position.netManualApprovedSatang,
  creditSatang:position.internalCreditSatang,outstandingSatang:status==="ISSUED"?position.outstandingSatang:0};
}

function validDay(value:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const date=new Date(value+"T00:00:00Z");
 return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value;
}
export function safeRoomInvoiceReportRange(from?:string,to?:string){
 return (!from||validDay(from))&&(!to||validDay(to))&&(!from||!to||from<=to);
}
