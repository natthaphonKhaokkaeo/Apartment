/** Decimal user input becomes integer satang without floating currency math. */
export function parseSatang(input:string):number{
 const match=/^(\d+)(?:\.(\d{1,2}))?$/.exec(input.trim());
 if(!match)throw new Error("จำนวนเงินต้องเป็นเลขไม่ติดลบและมีทศนิยมไม่เกิน 2 ตำแหน่ง");
 const amount=BigInt(match[1])*100n+BigInt((match[2]??"").padEnd(2,"0"));
 if(amount>2147483647n)throw new Error("จำนวนเงินเกินขอบเขตที่รองรับ");
 return Number(amount);
}
