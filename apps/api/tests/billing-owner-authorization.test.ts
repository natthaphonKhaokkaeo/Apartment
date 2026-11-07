import {describe,it,expect} from "vitest";
import {assertOwner} from "../src/routes/billing-batches.js";
import {users,organizations,memberships} from "../src/db/schema.js";

type Property=Parameters<typeof assertOwner>[1];
type Reader=Parameters<typeof assertOwner>[2];
function mockReader(user:{id:string;platformRole:string}|null,organization:{id:string;status:string}|null,member?:{role:string;status:string}){
 return {select:()=>({from:(table:unknown)=>({where:()=>({for:async()=>{
  if(table===users)return user?[user]:[];
  if(table===organizations)return organization?[organization]:[];
  if(table===memberships)return member?[member]:[];
  throw new Error("UNEXPECTED_TABLE");
 }})})})} as unknown as Reader;
}
const property={organizationId:"org",id:"prop"} as Property;
describe("owner-or-superadmin billing transaction guard",()=>{
 it("allows verified active SUPER_ADMIN without owner membership",async()=>{
  await expect(assertOwner("admin",property,mockReader({id:"admin",platformRole:"SUPER_ADMIN"},{id:"org",status:"ACTIVE"}))).resolves.toBeUndefined();
 });
 it("allows ACTIVE OWNER and blocks manager with no privilege escalation",async()=>{
  const user={id:"owner",platformRole:"USER"},org={id:"org",status:"ACTIVE"};
  await expect(assertOwner("owner",property,mockReader(user,org,{role:"OWNER",status:"ACTIVE"}))).resolves.toBeUndefined();
  await expect(assertOwner("owner",property,mockReader(user,org,{role:"MANAGER",status:"ACTIVE"}))).rejects.toMatchObject({statusCode:403,code:"OWNER_REQUIRED"});
 });
 it("denies inactive identity, inactive org and inactive membership including Super Admin",async()=>{
  await expect(assertOwner("admin",property,mockReader(null,{id:"org",status:"ACTIVE"}))).rejects.toMatchObject({statusCode:403});
  await expect(assertOwner("admin",property,mockReader({id:"admin",platformRole:"SUPER_ADMIN"},{id:"org",status:"SUSPENDED"}))).rejects.toMatchObject({statusCode:403,code:"ORG_ACCESS_DENIED"});
  await expect(assertOwner("owner",property,mockReader({id:"owner",platformRole:"USER"},{id:"org",status:"ACTIVE"},{role:"OWNER",status:"INACTIVE"}))).rejects.toMatchObject({statusCode:403,code:"OWNER_REQUIRED"});
 });
});
