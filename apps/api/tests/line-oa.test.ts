import {describe,it,expect} from "vitest";
import {} from "node:crypto";
import {
 verifyLineSignature,parseLineWebhook,deliveryPlan,classifyLinePushStatus,sendLinePushMessage
} from "../src/services/line-oa.js";
describe("LINE Messaging OA inbound and outbound policy",()=>{
 it("validates LINE's official raw-body signature golden vector",()=>{
  const secret="8c570fa6dd201bb328f1c1eac23a96d8";
  const raw=Buffer.from('{"destination":"U8e742f61d673b39c7fff3cecb7536ef0","events":[]}');
  expect(verifyLineSignature(raw,"GhRKmvmHys4Pi8DxkF4+EayaH0OqtJtaZxgTD9fMDLs=",secret)).toBe(true);
  expect(verifyLineSignature(Buffer.from(raw.toString()+" "), "GhRKmvmHys4Pi8DxkF4+EayaH0OqtJtaZxgTD9fMDLs=",secret)).toBe(false);
  expect(verifyLineSignature(raw,"nonsense",secret)).toBe(false);
  expect(verifyLineSignature(raw,"",secret)).toBe(false);
 });
 it("rejects malformed webhook and extracts only minimally required data",()=>{
  const dest="U8e742f61d673b39c7fff3cecb7536ef0";
  const eventId="01HRADQW2DAA9RBV3RGGT2SMRM";
  expect(parseLineWebhook(Buffer.from(JSON.stringify({destination:dest,events:[]})))).toEqual({destination:dest,events:[]});
  const body=Buffer.from(JSON.stringify({destination:dest,events:[{
   webhookEventId:eventId,type:"message",source:{type:"user",userId:"U"+ "a".repeat(32)},
   message:{text:"Private message do not persist"},deliveryContext:{isRedelivery:true}
  }]}));
  const parsed=parseLineWebhook(body);
  expect(parsed.events[0]).toMatchObject({webhookEventId:eventId,eventType:"message",redelivery:true});
  expect(JSON.stringify(parsed)).not.toContain("Private message");
  for(const invalid of [{events:[]},{destination:dest,events:[{}]}, {destination:dest,events:Array(101).fill({webhookEventId:eventId,type:"message"})}]){
   expect(()=>parseLineWebhook(Buffer.from(JSON.stringify(invalid)))).toThrow();
  }
 });
 it("sends LINE push with the stable retry key, and counts 409 as accepted only with accepted-request-id",async()=>{
  const retryKey="123e4567-e89b-12d3-a456-426614174000";
  const to="U"+"b".repeat(32);
  const createdAt=new Date("2026-11-03T06:00:00Z");
  let calls=0;
  const fetchImpl=async(input:RequestInfo|URL,init?:RequestInit)=>{
   calls++;
   expect(input).toBe("https://api.line.me/v2/bot/message/push");
   expect((init?.headers as Record<string,string>)["x-line-retry-key"]).toBe(retryKey);
   const body=JSON.parse(init!.body as string);
   expect(body).toEqual({to,messages:[{type:"text",text:"Invoice due"}]});
   return new Response("{}",{status:409,headers:{"x-line-accepted-request-id":"accepted-first"}});
  };
  const result=await sendLinePushMessage({token:"mock-token",to,text:"Invoice due",
   retryKey,createdAt,now:new Date("2026-11-03T06:02:00Z"),fetchImpl:fetchImpl as typeof fetch});
  expect(result.status).toBe("ACCEPTED");
  expect(calls).toBe(1);
  const expired=await sendLinePushMessage({token:"mock-token",to,text:"Invoice due",
   retryKey,createdAt,now:new Date("2026-11-04T06:02:00Z"),fetchImpl:fetchImpl as typeof fetch});
  expect(expired.status).toBe("DEAD");
  expect(calls).toBe(1);
 });
 it("supports retry with a stable retry key and terminal failure handling",()=>{
  expect(deliveryPlan(1,Date.UTC(2026,10,3))).toBeGreaterThan(Date.UTC(2026,10,3));
  expect(deliveryPlan(2,Date.UTC(2026,10,3))).toBeGreaterThan(deliveryPlan(1,Date.UTC(2026,10,3)));
  expect(classifyLinePushStatus(200)).toBe("ACCEPTED");
  expect(classifyLinePushStatus(409,"already-accepted")).toBe("ACCEPTED");
  expect(classifyLinePushStatus(409)).toBe("DEAD");
  expect(classifyLinePushStatus(429)).toBe("RETRY");
  expect(classifyLinePushStatus(502)).toBe("RETRY");
  expect(classifyLinePushStatus(400)).toBe("DEAD");
  expect(classifyLinePushStatus(401)).toBe("DEAD");
 });
});
