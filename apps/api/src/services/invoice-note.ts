import {z} from "zod";

/** Optional plain-text note. Saved as a zero-charge immutable invoice line. */
export const optionalInvoiceNote=z.string().trim().max(300)
 .refine(text=>!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text),"INVOICE_NOTE_CONTROL_CHARACTERS")
 .optional();

export function invoiceNoteLine(raw:string|undefined){
 const description=optionalInvoiceNote.parse(raw);
 if(!description)return null;
 return {type:"NOTE",description,unitsMilli:null,tariffSatang:null,amountSatang:0,
  snapshot:{note:description}};
}
