import {randomUUID} from "node:crypto";
import {eq} from "drizzle-orm";
import {db,sqlClient} from "../src/db/client.js";
import {users,organizations,memberships,properties,rooms,leases,meterReadings} from "../src/db/schema.js";
import {prepareInvoice} from "../src/services/billing.js";
import {requireProperty,AppError} from "../src/security.js";
import {strict as assert} from "node:assert";

const tag=randomUUID().slice(0,8),cleanup:{u:string[];org:string[];property:string[];rooms:string[];leases:string[];readings:string[]}={u:[],org:[],property:[],rooms:[],leases:[],readings:[]};
async function run(){
 const [alice,bob]=await db.insert(users).values([{lineSubject:"smoke-alice-"+tag,displayName:"Alice"},
 {lineSubject:"smoke-bob-"+tag,displayName:"Bob"}]).returning();
 cleanup.u.push(alice.id,bob.id);
 const [orgA,orgB]=await db.insert(organizations).values([{name:"Smoke A "+tag},{name:"Smoke B "+tag}]).returning();
 cleanup.org.push(orgA.id,orgB.id);
 await db.insert(memberships).values([{userId:alice.id,organizationId:orgA.id,role:"OWNER"},{userId:bob.id,organizationId:orgB.id,role:"OWNER"}]);
 const pData={rentSatang:400000,waterSatangPerUnit:1800,electricSatangPerUnit:400,
  complianceReviewedAt:new Date(),complianceEvidenceRef:"TEST_ONLY_NO_LEGAL_STATUS",waterAllowedMax:2000,electricAllowedMax:500};
 const [pA,pB]=await db.insert(properties).values([{...pData,organizationId:orgA.id,name:"A"},{...pData,organizationId:orgB.id,name:"B"}]).returning();
 cleanup.property.push(pA.id,pB.id);
 const actor={id:alice.id,name:"Alice",role:"USER"};
 const allowed=await requireProperty(actor,pA.id,true);assert.equal(allowed.organizationId,orgA.id);
 let denied=false;
 try{await requireProperty(actor,pB.id,true);}catch(e){denied=e instanceof AppError && e.statusCode===403;}
 assert.ok(denied,"cross-organization access must be denied");
 const [room]=await db.insert(rooms).values({number:"A101",organizationId:orgA.id,propertyId:pA.id,status:"OCCUPIED"}).returning();
 cleanup.rooms.push(room.id);
 const [lease]=await db.insert(leases).values({organizationId:orgA.id,propertyId:pA.id,roomId:room.id,tenantName:"Test Tenant",startDate:"2026-10-01"}).returning();
 cleanup.leases.push(lease.id);
 const meterRows=[];
 for(const kind of ["WATER","ELECTRIC"] as const){
  for(const [readAt,value] of [["2026-11-01",kind==="WATER"?"100.000":"200.000"],["2026-12-01",kind==="WATER"?"105.000":"210.000"]] as const){
   meterRows.push({organizationId:orgA.id,propertyId:pA.id,roomId:room.id,kind,readAt,value,createdBy:alice.id});
  }
 }
 const readings=await db.insert(meterReadings).values(meterRows).returning();cleanup.readings.push(...readings.map(r=>r.id));
 const preview=await prepareInvoice({roomId:room.id,start:"2026-11-01",endExclusive:"2026-12-01"},pA);
 assert.equal(preview.totalSatang,413000);
 assert.deepEqual(preview.lines.map(x=>x.amountSatang),[400000,9000,4000]);
 const invalid={...pA,complianceReviewedAt:null};
 let blocked=false;
 try{await prepareInvoice({roomId:room.id,start:"2026-11-01",endExclusive:"2026-12-01"},invalid);}catch(e){blocked=e instanceof AppError&&e.code==="COMPLIANCE_REVIEW_REQUIRED";}
 assert.ok(blocked,"unreviewed tariffs must block invoice generation");
 console.log("PASS: isolated organizations, unauthorized cross-org blocked, real DB meter/rent preview, missing compliance blocked");
}
try{await run();}finally{
 for(const id of cleanup.readings)await db.delete(meterReadings).where(eq(meterReadings.id,id));
 for(const id of cleanup.leases)await db.delete(leases).where(eq(leases.id,id));
 for(const id of cleanup.rooms)await db.delete(rooms).where(eq(rooms.id,id));
 for(const id of cleanup.property)await db.delete(properties).where(eq(properties.id,id));
 for(const id of cleanup.org)await db.delete(memberships).where(eq(memberships.organizationId,id));
 for(const id of cleanup.org)await db.delete(organizations).where(eq(organizations.id,id));
 for(const id of cleanup.u)await db.delete(users).where(eq(users.id,id));
 await sqlClient.end();
}
