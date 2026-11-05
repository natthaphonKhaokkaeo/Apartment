import Fastify from "fastify";
import {afterEach,describe,expect,it,vi} from "vitest";

const state=vi.hoisted(()=>({actor:{id:"admin-a",role:"SUPER_ADMIN",name:"Root"},list:vi.fn(),change:vi.fn()}));
vi.mock("../src/security.js",()=>({requireActor:async()=>state.actor}));
vi.mock("../src/services/platform-admins.js",()=>({
 listPlatformAccounts:state.list,changePlatformRole:state.change,
}));
import {registerPlatformAdminRoutes} from "../src/routes/platform-admins.js";

afterEach(()=>vi.clearAllMocks());
describe("platform administrator routes",()=>{
 it("serves a private no-store list with an optional search string",async()=>{
  state.list.mockResolvedValue([{id:"user-b",displayName:"New Admin",platformRole:"USER",status:"ACTIVE",createdAt:"2026-01-01T00:00:00Z"}]);
  const app=Fastify({logger:false});await registerPlatformAdminRoutes(app);
  const response=await app.inject({method:"GET",url:"/v1/admin/platform-users?search=New"});
  expect(response.statusCode).toBe(200);
  expect(response.headers["cache-control"]).toBe("no-store");
  expect(state.list).toHaveBeenCalledWith(state.actor,"New");
  await app.close();
 });
 it("accepts only explicit USER or SUPER_ADMIN role changes",async()=>{
  state.change.mockResolvedValue({id:"user-b",displayName:"New Admin",platformRole:"SUPER_ADMIN",changed:true});
  const app=Fastify({logger:false});
  app.setErrorHandler((error:unknown,_req,reply)=>{const name=error instanceof Error?error.name:"Unknown";return reply.code(name==="ZodError"?400:500).send({error:name});});
  await registerPlatformAdminRoutes(app);
  const response=await app.inject({method:"PATCH",url:"/v1/admin/platform-users/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/role",payload:{role:"SUPER_ADMIN"}});
  expect(response.statusCode).toBe(200);
  expect(state.change).toHaveBeenCalledWith(state.actor,"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","SUPER_ADMIN");
  const invalid=await app.inject({method:"PATCH",url:"/v1/admin/platform-users/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/role",payload:{role:"OWNER"}});
  expect(invalid.statusCode).toBe(400);
  await app.close();
 });
});
