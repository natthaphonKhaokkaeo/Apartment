import {beforeEach,describe,expect,it,vi} from "vitest";
import {getTableName} from "drizzle-orm";
const id=vi.hoisted(()=>({
 property:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
 org:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
 actor:"cccccccc-cccc-4ccc-8ccc-cccccccccccc",
 lease:"dddddddd-dddd-4ddd-8ddd-dddddddddddd",
 room:"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
}));
const state=vi.hoisted(()=>({
 propertyFound:true,
 ownerFound:true,
 leaseFound:true,
 leaseStatus:"ACTIVE",
 roomStatus:"OCCUPIED",
 finalWater:true,
 finalElectric:true,
 finalInvoicePresent:true,
 futureInvoice:false,
 pendingPayment:false,
 pendingFinance:false,
 outstandingSatang:0,
 updates:0,
 inserts:0,
}));
vi.mock("../src/db/client.js",()=>({
 db:{
  transaction:async (fn:(tx:unknown)=>Promise<unknown>)=>{
   const tx={
    select:()=>{
     let table="";
     const chain={
      from(t:unknown){table=getTableName(t as Parameters<typeof getTableName>[0]);return this;},
      where(){return this;},
      for(){return this;},
      async limit(){
       if(table==="properties")return state.propertyFound?[{id:id.property,organizationId:id.org}]:[];
       if(table==="memberships")return state.ownerFound?[{id:"owner"}]:[];
       if(table==="leases")return state.leaseFound?[{
        id:id.lease,roomId:id.room,organizationId:id.org,propertyId:id.property,
        status:state.leaseStatus,startDate:"2026-10-01",
       }]:[];
       if(table==="rooms")return [{id:id.room,status:state.roomStatus}];
       if(table==="payment_claims")return state.pendingPayment?[{id:"pending-payment"}]:[];
       if(table==="finance_adjustment_requests")return state.pendingFinance?[{id:"pending-finance"}]:[];
       return [];
      },
      then(resolve:(v:unknown)=>unknown,reject:(e:unknown)=>unknown){
       const rows=table==="meter_readings"?[
        ...(state.finalWater?[{kind:"WATER"}]:[]),
        ...(state.finalElectric?[{kind:"ELECTRIC"}]:[]),
       ]:table==="invoices"?[
        ...(state.finalInvoicePresent?[{id:"final-invoice",periodEnd:"2026-10-31"}]:[]),
        ...(state.futureInvoice?[{id:"future-invoice",periodEnd:"2026-11-15"}]:[]),
       ]:[];
       return Promise.resolve(rows).then(resolve,reject);
      },
     };
     return chain;
    },
    update(){state.updates++;throw Error("UNEXPECTED_WRITE");},
    insert(){state.inserts++;throw Error("UNEXPECTED_WRITE");},
   };
   return fn(tx);
  },
 },
}));
vi.mock("../src/services/financial-position.js",()=>({
 getFinancialPosition:async()=>({outstandingSatang:state.outstandingSatang}),
}));
import {moveOutLease} from "../src/services/lease-lifecycle.js";
const actor={id:id.actor} as Parameters<typeof moveOutLease>[0];
const params={propertyId:id.property,leaseId:id.lease};
const body={endExclusive:"2026-10-31",roomDisposition:"AVAILABLE",confirmedHandover:true};
async function denied(code:string,statusCode:number){
 await expect(moveOutLease(actor,params,body)).rejects.toMatchObject({code,statusCode});
 expect(state.updates).toBe(0);
 expect(state.inserts).toBe(0);
}
beforeEach(()=>{
 Object.assign(state,{propertyFound:true,ownerFound:true,leaseFound:true,
  leaseStatus:"ACTIVE",roomStatus:"OCCUPIED",finalWater:true,finalElectric:true,
  finalInvoicePresent:true,futureInvoice:false,pendingPayment:false,pendingFinance:false,
  outstandingSatang:0,updates:0,inserts:0});
});
describe("P1 move-out must fail closed before DB writes",()=>{
 it("hides a nonexistent or inaccessible property",async()=>{
  state.propertyFound=false;
  await denied("PROPERTY_NOT_FOUND",404);
 });
 it("requires active owner membership",async()=>{
  state.ownerFound=false;
  await denied("LEASE_MOVE_OUT_OWNER_REQUIRED",403);
 });
 it("does not expose an unknown lease",async()=>{
  state.leaseFound=false;
  await denied("LEASE_NOT_FOUND",404);
 });
 it("rejects already-ended leases",async()=>{
  state.leaseStatus="ENDED";
  await denied("LEASE_ALREADY_ENDED",409);
 });
 it("refuses to release a room that is not occupied",async()=>{
  state.roomStatus="AVAILABLE";
  await denied("ROOM_NOT_OCCUPIED",409);
 });
 it("requires the water boundary meter reading",async()=>{
  state.finalWater=false;
  await denied("MOVE_OUT_FINAL_METERS_REQUIRED",409);
 });
 it("requires the electricity boundary meter reading",async()=>{
  state.finalElectric=false;
  await denied("MOVE_OUT_FINAL_METERS_REQUIRED",409);
 });
 it("requires a final invoice covering the exact move-out boundary",async()=>{
  state.finalInvoicePresent=false;
  await denied("MOVE_OUT_FINAL_INVOICE_REQUIRED",409);
 });
 it("blocks move-out when a later invoice already exists",async()=>{
  state.futureInvoice=true;
  await denied("MOVE_OUT_FUTURE_INVOICE_EXISTS",409);
 });
 it("blocks move-out while payment proof is pending review",async()=>{
  state.pendingPayment=true;
  await denied("MOVE_OUT_PENDING_PAYMENT",409);
 });
 it("blocks move-out while financial adjustment is pending",async()=>{
  state.pendingFinance=true;
  await denied("MOVE_OUT_PENDING_FINANCE",409);
 });
 it("does not release a room with an unsettled invoice balance",async()=>{
  state.outstandingSatang=100;
  await denied("MOVE_OUT_UNSETTLED_INVOICES",409);
 });
});
