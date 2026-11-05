import {beforeEach,describe,expect,it,vi} from "vitest";
const state=vi.hoisted(()=>({propertyAllowed:true,membershipActive:true}));
const propertyId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
vi.mock("../src/security.js",async(importOriginal)=>{
 const actual=await importOriginal<typeof import("../src/security.js")>();
 return {...actual,requireProperty:async()=>{
  if(!state.propertyAllowed)throw new actual.AppError(403,"PROPERTY_ACCESS_DENIED");
  return {id:propertyId,organizationId:"org-a"};
 }};
});
vi.mock("../src/db/client.js",()=>({
 db:{select:()=>({
  from(){return this;},where(){return this;},
  limit:async()=>state.membershipActive?[{id:"verified-membership"}]:[],
 })},
}));
import {requirePropertyAdministrator} from "../src/services/property-administrator.js";
const actor=(role:string)=>({id:"actor-a",role,name:"Test"});
beforeEach(()=>{state.propertyAllowed=true;state.membershipActive=true;});
describe("P1/P5 property administrator report access",()=>{
 it("allows verified active property OWNER/MANAGER membership",async()=>{
  expect(await requirePropertyAdministrator(actor("USER"),propertyId))
   .toMatchObject({id:propertyId});
 });
 it("denies staff/property reader without an active OWNER/MANAGER membership",async()=>{
  state.membershipActive=false;
  await expect(requirePropertyAdministrator(actor("USER"),propertyId))
   .rejects.toMatchObject({statusCode:403,code:"PROPERTY_ADMINISTRATOR_REQUIRED"});
 });
 it("does not bypass underlying property authorization",async()=>{
  state.propertyAllowed=false;
  await expect(requirePropertyAdministrator(actor("SUPER_ADMIN"),propertyId))
   .rejects.toMatchObject({statusCode:403,code:"PROPERTY_ACCESS_DENIED"});
 });
 it("allows verified SUPER_ADMIN after property security check",async()=>{
  state.membershipActive=false;
  expect(await requirePropertyAdministrator(actor("SUPER_ADMIN"),propertyId))
   .toMatchObject({id:propertyId});
 });
});
