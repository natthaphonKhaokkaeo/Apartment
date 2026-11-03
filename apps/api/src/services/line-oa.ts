import {createHmac,timingSafeEqual} from "node:crypto";
import {z} from "zod";
const BOT_USER=/^U[0-9a-f]{32}$/i;
const lineEvent=z.object({
 webhookEventId:z.string().min(8).max(128),
 type:z.string().min(1).max(64),
 source:z.object({type:z.string(),userId:z.string().optional()}).optional(),
 deliveryContext:z.object({isRedelivery:z.boolean().optional()}).optional()
}).passthrough();
const webhook=z.object({
 destination:z.string().regex(BOT_USER),
 events:z.array(lineEvent).max(100)
});
export type MinimalLineEvent={
 webhookEventId:string;eventType:string;redelivery:boolean;
 sourceLineUserId:string|null
};
export function verifyLineSignature(raw:Buffer,signature:string|undefined,secret:string):boolean{
 if(!secret||!signature||!/^[a-zA-Z0-9+/]{43}=$/.test(signature))return false;
 const expected=createHmac("sha256",secret).update(raw).digest();
 const provided=Buffer.from(signature,"base64");
 return provided.length===expected.length&&timingSafeEqual(provided,expected);
}
export function parseLineWebhook(raw:Buffer):{destination:string;events:MinimalLineEvent[]}{
 if(!raw.length||raw.length>262144)throw new Error("LINE_WEBHOOK_BODY_INVALID");
 let decoded:unknown;
 try{decoded=JSON.parse(raw.toString("utf8"));}
 catch{throw new Error("LINE_WEBHOOK_BODY_INVALID");}
 const envelope=webhook.parse(decoded);
 return {destination:envelope.destination,events:envelope.events.map(e=>({
  webhookEventId:e.webhookEventId,eventType:e.type,
  redelivery:e.deliveryContext?.isRedelivery===true,
  sourceLineUserId:e.source?.type==="user"&&e.source.userId?.match(BOT_USER)?e.source.userId:null
 }))};
}
export type SendStatus="ACCEPTED"|"RETRY"|"DEAD";
export function classifyLinePushStatus(status:number,acceptedRequestId?:string):SendStatus{
 if(status>=200&&status<300)return "ACCEPTED";
 if(status===409)return acceptedRequestId?"ACCEPTED":"DEAD";
 if(status===429||status>=500||status===0)return "RETRY";
 return "DEAD";
}
export function deliveryPlan(attempt:number,fromMs:number):number{
 if(!Number.isInteger(attempt)||attempt<1)throw new Error("INVALID_DELIVERY_ATTEMPT");
 return fromMs+Math.min(30*60_000,5_000*2**Math.min(attempt-1,9));
}
/** The caller persists retryKey (UUID) and reuses it unchanged for every attempt.
 * LINE retry keys expire after 24 hours; a stale uncertain delivery must go to manual review.
 */
export async function sendLinePushMessage(input:{
 token:string;to:string;text:string;retryKey:string;
 fetchImpl?:typeof fetch;now?:Date;createdAt:Date
}):Promise<{status:SendStatus;httpStatus:number;requestId:string|null}>{
 if(!input.token||!/^U[0-9a-f]{32}$/i.test(input.to)||!input.text||input.text.length>5000||
  !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.retryKey))
  throw new Error("LINE_OUTBOUND_INVALID");
 if((input.now??new Date()).getTime()-input.createdAt.getTime()>23*60*60_000)
  return {status:"DEAD",httpStatus:0,requestId:null};
 const f=input.fetchImpl??fetch;
 try{
  const r=await f("https://api.line.me/v2/bot/message/push",{
   method:"POST",
   headers:{
    "content-type":"application/json",
    authorization:"Bearer "+input.token,
    "x-line-retry-key":input.retryKey
   },
   body:JSON.stringify({to:input.to,messages:[{type:"text",text:input.text}]}),
   signal:AbortSignal.timeout(7000)
  });
  return {status:classifyLinePushStatus(r.status,r.headers.get("x-line-accepted-request-id")??undefined),
   httpStatus:r.status,requestId:r.headers.get("x-line-request-id")};
 }catch{
  return {status:"RETRY",httpStatus:0,requestId:null};
 }
}
