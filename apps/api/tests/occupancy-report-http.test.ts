import Fastify from "fastify";
import {beforeEach,describe,expect,it,vi} from "vitest";
const state=vi.hoisted(()=>({
 authorized:true,
 roomRows:[{id:"r1",status:"OCCUPIED"},{id:"r2",status:"AVAILABLE"}],
 leaseRows:[{roomId:"r1"}],
 isolation:"",
}));
const propertyId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
vi.mock("../src/security.js",async(importOriginal)=>{
 const real=await importOriginal<typeof import("../src/security.js")>();
 return {...real,requireActor:async()=>({id:"actor"}),
  requireProperty:async()=>{
   if(!state.authorized)throw new real.AppError(403,"PROPERTY_ACCESS_DENIED");
   return {id:propertyId,organizationId:"org-a"};
  }};
});
vi.mock("../src/db/client.js",()=>({
 db:{transaction:async(fn:(tx:unknown)=>Promise<unknown>,config:{isolationLevel:string})=>{
  state.isolation=config.isolationLevel;
  let call=0;
  return fn({select:()=>{
   const idx=++call;
   return {from(){return this;},where(){return this;},
    limit:async()=>idx===1?state.roomRows:state.leaseRows};
  }});
 }},
}));
vi.mock("../src/services/property-administrator.js",()=>({
 requirePropertyAdministrator:async()=>{
  if(!state.authorized)throw Object.assign(new Error("PROPERTY_ACCESS_DENIED"),{statusCode:403,code:"PROPERTY_ACCESS_DENIED"});
  return {id:propertyId,organizationId:"org-a"};
 },
}));
import {registerOccupancyReportRoutes} from "../src/routes/occupancy-report.js";
async function request(){
 const app=Fastify({logger:false});
 await registerOccupancyReportRoutes(app);
 const res=await app.inject({method:"GET",url:`/v1/properties/${propertyId}/occupancy-report`});
 await app.close();
 return res;
}
beforeEach(()=>{
 state.authorized=true;state.isolation="";
 state.roomRows=[{id:"r1",status:"OCCUPIED"},{id:"r2",status:"AVAILABLE"}];
 state.leaseRows=[{roomId:"r1"}];
});
describe("P5 property occupancy report HTTP access and snapshot",()=>{
 it("returns scoped room statistics with repeatable-read snapshot",async()=>{
  const res=await request();
  expect(res.statusCode).toBe(200);
  expect(res.headers["cache-control"]).toBe("no-store");
  expect(state.isolation).toBe("repeatable read");
  expect(res.json()).toMatchObject({propertyId,previewOnly:true,
   totalRooms:2,occupiedRooms:1,availableRooms:1,occupancyPercent:50});
 });
 it("denies unrelated tenant or staff property scope",async()=>{
  state.authorized=false;
  expect((await request()).statusCode).toBe(403);
 });
 it("reports data consistency anomalies rather than hiding them",async()=>{
  state.leaseRows=[{roomId:"r2"}];
  expect((await request()).json()).toMatchObject({
   occupiedWithoutActiveLease:1,activeLeaseInNonOccupiedRoom:1});
 });
 it("fails closed if leases reference out-of-scope room",async()=>{
  state.leaseRows=[{roomId:"unknown"}];
  expect((await request()).statusCode).toBe(409);
 });
 it("refuses silent truncation when report exceeds bounded limit",async()=>{
  state.roomRows=Array.from({length:5001},(_,i)=>({id:"r"+i,status:"AVAILABLE"}));
  expect((await request()).statusCode).toBe(409);
 });
});
