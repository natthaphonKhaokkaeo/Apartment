import Fastify from "fastify";
import {getTableName} from "drizzle-orm";
import {beforeEach,describe,expect,it,vi} from "vitest";

const state=vi.hoisted(()=>({
 hasCandidate:true,hasLease:true,hasInvite:true,hasOrg:true,hasProperty:true,
 userActive:true,leaseStatus:"ACTIVE",tenantAlreadyLinked:false,
 revoked:false,claimed:false,approved:false,expired:false,raceLost:false,
 updates:0,inserts:0,
}));
const id={
 invite:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
 lease:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
 org:"cccccccc-cccc-4ccc-8ccc-cccccccccccc",
 property:"dddddddd-dddd-4ddd-8ddd-dddddddddddd",
};
vi.mock("../src/db/client.js",()=>({
 db:{
  select:(shape?:Record<string,unknown>)=>query(shape),
  transaction:async(fn:(tx:unknown)=>Promise<unknown>)=>{
   const tx={
    select:(shape?:Record<string,unknown>)=>query(shape),
    update:()=>{
     state.updates++;
     return {set(){return this;},where(){return this;},returning:async()=>
      state.raceLost?[]:[{id:"updated"}]};
    },
    insert:()=>{
     state.inserts++;
     return {values:async()=>({})};
    },
   };
   return fn(tx);
  },
 },
}));
function query(_shape?:Record<string,unknown>){
 let table="";
 function values(){
  if(table==="users")return state.userActive?[{id:"actor-claimant",lineSubject:"U:claimed"}]:[];
  if(table==="lease_invitations"){
   return (state.hasCandidate&&state.hasInvite)?[{
    id:id.invite,leaseId:id.lease,organizationId:id.org,propertyId:id.property,
    revokedAt:state.revoked?new Date():null,
    claimedAt:state.claimed?new Date():null,
    claimedBy:state.claimed?"actor-claimant":null,
    approvedAt:state.approved?new Date():null,
    expiresAt:state.expired?new Date("2020-01-01"):new Date("2035-01-01"),
   }]:[];
  }
  if(table==="leases")return state.hasLease?[{
   id:id.lease,organizationId:id.org,propertyId:id.property,
   status:state.leaseStatus,tenantLineSubject:state.tenantAlreadyLinked?"U:existing":null,
  }]:[];
  if(table==="organizations")return state.hasOrg?[{id:id.org,status:"ACTIVE"}]:[];
  if(table==="properties")return state.hasProperty?[{id:id.property,organizationId:id.org}]:[];
  return [];
 }
 return {
  from(t:unknown){table=getTableName(t as Parameters<typeof getTableName>[0]);return this;},
  where(){return this;},innerJoin(){return this;},orderBy(){return this;},
  limit:async()=>values(),for:async()=>values(),
  then(resolve:(v:unknown)=>unknown,reject:(e:unknown)=>unknown){
   return Promise.resolve(values()).then(resolve,reject);
  },
 };
}
vi.mock("../src/security.js",async(importOriginal)=>{
 const real=await importOriginal<typeof import("../src/security.js")>();
 return {...real,requireActor:async()=>({id:"actor-a"}),
  requireProperty:async()=>({id:id.property,organizationId:id.org})};
});
import {registerTenantRoutes} from "../src/routes/tenant.js";
async function claim(){
 const app=Fastify({logger:false});
 await registerTenantRoutes(app);
 const res=await app.inject({
  method:"POST",url:"/v1/tenant/invitations/claim",
  payload:{token:"A".repeat(43)},
 });
 await app.close();
 return res;
}
async function approve(){
 const app=Fastify({logger:false});
 await registerTenantRoutes(app);
 const res=await app.inject({method:"POST",
  url:`/v1/properties/${id.property}/leases/${id.lease}/invitations/${id.invite}/approve`,
 });
 await app.close();
 return res;
}
beforeEach(()=>Object.assign(state,{
 hasCandidate:true,hasLease:true,hasInvite:true,hasOrg:true,hasProperty:true,
 userActive:true,leaseStatus:"ACTIVE",tenantAlreadyLinked:false,
 revoked:false,claimed:false,approved:false,expired:false,raceLost:false,
 updates:0,inserts:0,
}));
describe("P2 invite claim HTTP security without LINE credentials",()=>{
 it("accepts only a pending claim, not direct tenant access",async()=>{
  const res=await claim();
  expect(res.statusCode).toBe(202);
  expect(res.headers["cache-control"]).toBe("no-store");
  expect(res.json()).toMatchObject({status:"PENDING_OWNER_APPROVAL",invitationId:id.invite});
  expect(state.updates).toBe(1);
 });
 it("rejects invalid, revoked or expired invitation before writes",async()=>{
  for(const mutation of ["hasCandidate","revoked","expired"] as const){
   Object.assign(state,{hasCandidate:true,revoked:false,expired:false,updates:0,inserts:0});
   if(mutation==="hasCandidate")state.hasCandidate=false;
   else state[mutation]=true;
   const res=await claim();
   expect(res.statusCode).toBe(404);
   expect(state.updates).toBe(0);
  }
 });
 it("rejects claimed or approved replay",async()=>{
  for(const type of ["claimed","approved"] as const){
   state[type]=true;
   const res=await claim();
   expect(res.statusCode).toBe(404);
   expect(state.updates).toBe(0);
   state[type]=false;
  }
 });
 it("rejects ended leases or already bound LINE accounts",async()=>{
  state.leaseStatus="ENDED";
  expect((await claim()).statusCode).toBe(404);
  state.leaseStatus="ACTIVE";
  state.tenantAlreadyLinked=true;
  expect((await claim()).statusCode).toBe(404);
  expect(state.updates).toBe(0);
 });
 it("rejects inactive/missing organization or property scope",async()=>{
  state.hasOrg=false;
  expect((await claim()).statusCode).toBe(404);
  state.hasOrg=true;state.hasProperty=false;
  expect((await claim()).statusCode).toBe(404);
  expect(state.updates).toBe(0);
 });
 it("fails closed if simultaneous claimant won the update race",async()=>{
  state.raceLost=true;
  expect((await claim()).statusCode).toBe(404);
 });
 it("owner approval links a claimed tenant only after explicit review",async()=>{
  state.claimed=true;
  const res=await approve();
  expect(res.statusCode).toBe(200);
  expect(res.json()).toMatchObject({linked:true,leaseId:id.lease});
  expect(state.updates).toBeGreaterThan(0);
 });
 it("owner approval rejects unclaimed, revoked, disabled and already linked cases",async()=>{
  for(const mutation of ["unclaimed","revoked","disabled","linked"] as const){
   Object.assign(state,{claimed:true,revoked:false,userActive:true,tenantAlreadyLinked:false,updates:0});
   if(mutation==="unclaimed")state.claimed=false;
   if(mutation==="revoked")state.revoked=true;
   if(mutation==="disabled")state.userActive=false;
   if(mutation==="linked")state.tenantAlreadyLinked=true;
   const res=await approve();
   expect(res.statusCode).toBe(409);
   expect(state.updates).toBe(0);
  }
 });
});
