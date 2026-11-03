/** BOT Thai QR Code Payment Standard: merchant-presented PromptPay credit transfer.
 *  Tag 29 / AID A000000677010111, TLV, THB currency 764, CRC16/CCITT-FALSE.
 *  This only encodes a display-only payment instruction; it never verifies an account or a transfer.
 */
const MOBILE=/^0[689]\d{8}$/;
const TAX_ID=/^\d{13}$/;
export function isValidPromptPayId(id:string):boolean{
 return MOBILE.test(id)||TAX_ID.test(id);
}
export function maskPromptPayId(id:string):string{
 if(!isValidPromptPayId(id))throw new Error("INVALID_PROMPTPAY_ID");
 return "*".repeat(id.length-4)+id.slice(-4);
}
function field(tag:string,value:string):string{
 if(value.length>99)throw new Error("INVALID_QR_FIELD_LENGTH");
 return tag+value.length.toString().padStart(2,"0")+value;
}
function crc16CcittFalse(text:string):string{
 let crc=0xffff;
 for(const c of text){
  crc^=c.charCodeAt(0)<<8;
  for(let n=0;n<8;n++)crc=(crc&0x8000)?((crc<<1)^0x1021)&0xffff:(crc<<1)&0xffff;
 }
 return crc.toString(16).toUpperCase().padStart(4,"0");
}
export function buildPromptPayPayload(recipientId:string,amountSatang:number):string{
 if(!isValidPromptPayId(recipientId))throw new Error("INVALID_PROMPTPAY_ID");
 if(!Number.isSafeInteger(amountSatang)||amountSatang<=0||amountSatang>2147483647)
  throw new Error("INVALID_PROMPTPAY_AMOUNT");
 const tag=MOBILE.test(recipientId)?"01":"02";
 const normalized=tag==="01"?"0066"+recipientId.slice(1):recipientId;
 const amount=Math.floor(amountSatang/100)+"."+(amountSatang%100).toString().padStart(2,"0");
 // The relative order below matches Thai PromptPay merchant-presented interoperable examples.
 const beforeCrc=field("00","01")+field("01","12")+
  field("29",field("00","A000000677010111")+field(tag,normalized))+
  field("58","TH")+field("53","764")+field("54",amount)+"6304";
 return beforeCrc+crc16CcittFalse(beforeCrc);
}
