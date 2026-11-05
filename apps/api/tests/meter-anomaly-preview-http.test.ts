import Fastify from "fastify";
import {getTableName} from "drizzle-orm";
import {beforeEach,describe,expect,it,vi} from "vitest";

const state=vi.hoisted(()=>({
 propertyAllowed:true,roomFound:true,replacement:false,
 readings:[
  {readAt:"2026-11-04",value:"115.000"},
  {readAt:"2026-11-01",value:"100.000"},
 ] as Array<{readAt:string;value:string}>,
}));
const property="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const room="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
vi.mock("../src/db/client.js",()=>({
 db:{select:()=>{
  let table="";
  return {
   from(t:unknown){table=getTableName(t as Parameters<typeof getTableName>[0]);return this;},
   where(){return this;},orderBy(){return this;},
   limit:async()=>table==="rooms"?(state.roomFound?[{id:room}]:[]):
    table==="meter_readings"?state.readings:
    table==="meter_replacements"?(state.replacement?[{id:"switch"}]:[]):[],
  };
 }},
}));
vi.mock("../src/security.js",async(importOriginal)=>{
 const actual=await importOriginal<typeof import("../src/security.js")>();
 return {...actual,
  requireActor:async()=>({id:"actor"}),
  requireProperty:async()=>{
   if(!state.propertyAllowed)throw new actual.AppError(403,"PROPERTY_ACCESS_DENIED");
   return {id:property,organizationId:"org-a"};
  },
 };
});
import {registerMeterAnomalyPreviewRoutes} from "../src/routes/meter-anomaly-preview.js";
async function preview(threshold="6000"){
 const app=Fastify({logger:false});
 await registerMeterAnomalyPreviewRoutes(app);
 const res=await app.inject({method:"GET",
  url:`/v1/properties/${property}/rooms/${room}/meter-anomalies/WATER?maxDailyMilli=${threshold}`,
 });
 await app.close();
 return res;
}
beforeEach(()=>{
 state.propertyAllowed=true;state.roomFound=true;state.replacement=false;
 state.readings=[{readAt:"2026-11-04",value:"115.000"},{readAt:"2026-11-01",value:"100.000"}];
});
describe("P5 meter anomaly scoped preview HTTP",()=>{
 it("returns normal usage and does not perform financial writes",async()=>{
  const res=await preview();
  expect(res.statusCode).toBe(200);
  expect(res.headers["cache-control"]).toBe("no-store");
  expect(res.json()).toMatchObject({kind:"NORMAL",usageMilli:15000,
   requiresOwnerReview:false,readingsCount:2});
 });
 it("flags unusual usage rather than auto-billing it",async()=>{
  expect((await preview("3000")).json()).toMatchObject({
   kind:"USAGE_SPIKE",requiresOwnerReview:true,usageMilli:15000,
  });
 });
 it("requires review of physical meter replacement",async()=>{
  state.replacement=true;
  expect((await preview()).json()).toMatchObject({
   kind:"METER_CHANGE_REVIEW",requiresOwnerReview:true,
  });
 });
 it("reports insufficient readings without exposing another room",async()=>{
  state.readings=[];
  expect((await preview()).json()).toMatchObject({
   kind:"INSUFFICIENT_READINGS",readingsCount:0,requiresOwnerReview:true,
  });
  state.roomFound=false;
  expect((await preview()).statusCode).toBe(404);
 });
 it("denies unauthorized properties before accessing meter data",async()=>{
  state.propertyAllowed=false;
  expect((await preview()).statusCode).toBe(403);
 });
 it("rejects attacker supplied invalid thresholds",async()=>{
  const res=await preview("-1");
  expect(res.statusCode).toBeGreaterThanOrEqual(400);
 });
});
