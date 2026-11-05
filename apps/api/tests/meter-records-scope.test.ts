import {beforeEach,describe,it,expect,vi} from "vitest";
import {getTableName} from "drizzle-orm";
const state=vi.hoisted(()=>({rows:{} as Record<string,unknown[]>}));
vi.mock("../src/db/client.js",()=>({
 db:{
  transaction:async(fn:(tx:unknown)=>Promise<unknown>)=>{
   const tx={select:()=>{
    let name="";
    const chain={
     from(table:unknown){name=getTableName(table as Parameters<typeof getTableName>[0]);return this;},
     where(){return this;},for(){return this;},orderBy(){return this;},limit(){return this;},
     then(resolve:(rows:unknown[])=>unknown,reject:(error:unknown)=>unknown){return Promise.resolve(state.rows[name]||[]).then(resolve,reject);}
    };return chain;
   }};return fn(tx);
  }
 }
}));
vi.mock("../src/security.js",async()=>{
 const actual=await vi.importActual<typeof import("../src/security.js")>("../src/security.js");
 return {...actual,requireProperty:vi.fn(async()=>({id:"p",organizationId:"o"}))};
});
import {db} from "../src/db/client.js";
import {withMeterScope,scopedMeterReading,assessStoredMeterReading} from "../src/services/meter-records.js";
const actor={id:"u",name:"Reader",role:"USER"},scope={propertyId:"p",roomId:"r"};
beforeEach(()=>{
 state.rows={organizations:[{id:"o",status:"ACTIVE"}],users:[{id:"u",platformRole:"USER"}],memberships:[{role:"STAFF"}],property_staff_grants:[{level:"METER_READER"}],properties:[{id:"p"}],rooms:[{id:"r"}],meter_readings:[],meter_replacements:[]};
});
const read=(mode:"read"|"write"|"owner")=>withMeterScope(actor,scope,mode,async()=>({authorized:true}));
describe("meter evidence transactional capability boundaries",()=>{
 it("rejects an organization disabled after the route preflight",async()=>{state.rows.organizations=[];await expect(read("read")).rejects.toMatchObject({statusCode:403});});
 it("rejects an account disabled after route authentication",async()=>{state.rows.users=[];await expect(read("write")).rejects.toMatchObject({statusCode:403});});
 it("does not let a meter-reader perform owner anomaly review",async()=>{await expect(read("owner")).rejects.toMatchObject({code:"METER_REVIEW_OWNER_REQUIRED"});});
 it("lets a viewer read without silently granting upload",async()=>{state.rows.property_staff_grants=[{level:"VIEWER"}];await expect(read("read")).resolves.toEqual({authorized:true});await expect(read("write")).rejects.toMatchObject({statusCode:403});});
 it("denies a missing or revoked property grant",async()=>{state.rows.property_staff_grants=[];await expect(read("write")).rejects.toMatchObject({statusCode:403});});
 it("does not infer property access from missing membership",async()=>{state.rows.memberships=[];await expect(read("read")).rejects.toMatchObject({statusCode:403});});
 it("denies an absent scoped room",async()=>{state.rows.rooms=[];await expect(read("read")).rejects.toMatchObject({statusCode:404});});
 it("accepts an active OWNER review",async()=>{state.rows.memberships=[{role:"OWNER"}];await expect(read("owner")).resolves.toEqual({authorized:true});});
 it("does not turn platform administration into owner review",async()=>{state.rows.users=[{id:"u",platformRole:"SUPER_ADMIN"}];state.rows.memberships=[];await expect(read("read")).resolves.toEqual({authorized:true});await expect(read("owner")).rejects.toMatchObject({statusCode:403});});
 it("requires the exact meter record to exist",async()=>{await expect(db.transaction(tx=>scopedMeterReading(tx,scope,"reading","o"))).rejects.toMatchObject({statusCode:404});});
});
describe("stored reading assessment",()=>{
 const current={id:"new",organizationId:"o",propertyId:"p",roomId:"r",kind:"WATER" as const,value:"100.000",readAt:"2026-11-02",createdBy:"u",createdAt:new Date()};
 const assess=(maxDailyMilli=1000)=>db.transaction(tx=>assessStoredMeterReading(tx,scope,current,maxDailyMilli));
 it("requires a previous physical reading for comparison",async()=>{expect(await assess()).toMatchObject({kind:"INSUFFICIENT_READINGS",requiresOwnerReview:true});});
 it("snapshots an actual usage spike",async()=>{state.rows.meter_readings=[{id:"old",value:"0.000",readAt:"2026-11-01"}];expect(await assess()).toMatchObject({kind:"USAGE_SPIKE",usageMilli:100000,previousReadingId:"old",maxDailyMilli:1000});});
 it("requires review after a physical meter replacement",async()=>{state.rows.meter_readings=[{id:"old",value:"0.000",readAt:"2026-11-01"}];state.rows.meter_replacements=[{id:"swap"}];expect(await assess()).toMatchObject({kind:"METER_CHANGE_REVIEW",replacementId:"swap"});});
 it("fails closed for an invalid daily threshold",async()=>{state.rows.meter_readings=[{id:"old",value:"0.000",readAt:"2026-11-01"}];await expect(assess(0)).rejects.toMatchObject({statusCode:422});});
});
