import {spawn} from "node:child_process";
import {randomUUID} from "node:crypto";
import {strict as assert} from "node:assert";
import {eq} from "drizzle-orm";
import {db,sqlClient} from "../src/db/client.js";
import {users,sessions,organizations,memberships,properties,rooms,leases,leaseInvitations} from "../src/db/schema.js";
import {newSessionToken,tokenHash} from "../src/security.js";
if(!process.env.APARTMENT_COVERAGE_ROOT||!process.env.DATABASE_URL?.includes("isolated_coverage_only@127.0.0.1:"))throw Error("DISPOSABLE_DATABASE_REQUIRED");
const child=spawn("node",["--import","tsx","src/index.ts"],{cwd:process.cwd(),env:process.env,stdio:"ignore"});
try{
 let ready=false;for(let i=0;i<80;i++){try{if((await fetch("http://127.0.0.1:8088/readyz")).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready);
 const [owner,tenant]=await db.insert(users).values([{lineSubject:"race-owner-"+randomUUID(),displayName:"Race owner"},{lineSubject:"race-tenant-"+randomUUID(),displayName:"Race tenant"}]).returning();
 const token=newSessionToken();await db.insert(sessions).values({userId:owner.id,tokenHash:tokenHash(token),expiresAt:new Date(Date.now()+300000)});
 const [org]=await db.insert(organizations).values({name:"Privacy link race "+randomUUID()}).returning();await db.insert(memberships).values({organizationId:org.id,userId:owner.id,role:"OWNER"});
 const [p]=await db.insert(properties).values({organizationId:org.id,name:"Race",rentSatang:100,waterSatangPerUnit:100,electricSatangPerUnit:100}).returning();
 const [room]=await db.insert(rooms).values({organizationId:org.id,propertyId:p.id,number:"Race"}).returning();
 const [lease]=await db.insert(leases).values({organizationId:org.id,propertyId:p.id,roomId:room.id,tenantName:"Synthetic",startDate:"2026-01-01"}).returning();
 const [invite]=await db.insert(leaseInvitations).values({organizationId:org.id,propertyId:p.id,leaseId:lease.id,tokenHash:tokenHash(randomUUID()),expiresAt:new Date(Date.now()+300000),claimedAt:new Date(),claimedBy:tenant.id,createdBy:owner.id}).returning();
 const [manager]=await db.insert(users).values({lineSubject:"race-manager-"+randomUUID(),displayName:"Race manager"}).returning();
 const managerToken=newSessionToken();await db.insert(sessions).values({userId:manager.id,tokenHash:tokenHash(managerToken),expiresAt:new Date(Date.now()+300000)});await db.insert(memberships).values({organizationId:org.id,userId:manager.id,role:"MANAGER"});
 const managerResponse=await fetch("http://127.0.0.1:8088/v1/properties/"+p.id+"/leases/"+lease.id+"/invitations/"+invite.id+"/approve",{method:"POST",headers:{cookie:"apartment_session="+managerToken,"content-type":"application/json"},body:"{}"});
 assert.equal(managerResponse.status,403,"manager cannot approve tenant identity binding");
 let locked!:()=>void,release!:()=>void;const lockedPromise=new Promise<void>(r=>locked=r),releasePromise=new Promise<void>(r=>release=r);
 const blocker=db.transaction(async tx=>{await tx.select().from(users).where(eq(users.id,tenant.id)).for("update");locked();await releasePromise;await tx.update(users).set({status:"DISABLED",lineSubject:"erased:"+randomUUID()}).where(eq(users.id,tenant.id));});
 await lockedPromise;let settled=false;const approval=fetch("http://127.0.0.1:8088/v1/properties/"+p.id+"/leases/"+lease.id+"/invitations/"+invite.id+"/approve",{method:"POST",headers:{cookie:"apartment_session="+token,"content-type":"application/json"},body:"{}"}).then(r=>{settled=true;return r;});
 let early:boolean;try{await new Promise(r=>setTimeout(r,500));early=settled;}finally{release();await blocker;}
 const response=await approval;assert.equal(early,false,"approval must wait for locked target profile instead of linking stale identity");assert.equal(response.status,409);assert.equal((await response.json() as {error:string}).error,"TENANT_ACCOUNT_DISABLED");
 assert.equal((await db.select().from(leases).where(eq(leases.id,lease.id)))[0].tenantLineSubject,null);
 assert.equal((await db.select().from(leaseInvitations).where(eq(leaseInvitations.id,invite.id)))[0].approvedAt,null);
 console.log("PASS privacy/link race: approval serializes against profile disable, rejects stale identity, leaves lease and invitation unlinked");
}finally{if(child.exitCode===null){const done=new Promise(r=>child.once("exit",r));child.kill("SIGTERM");await done;}await sqlClient.end();}
