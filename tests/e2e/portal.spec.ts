import {expect,test,type Page} from "@playwright/test";

/**
 * Browser contract checks with explicit in-browser API mocks.
 * The test browser never uses real LINE tokens, bank details or a production DB.
 * API scope is fully intercepted: unknown endpoints fail closed with 403.
 */
type Json=Record<string,unknown>|Record<string,unknown>[];
const ownerId="owner-e2e";
const organizationId="org-e2e";
const propertyId="property-e2e";
const roomId="room-e2e";
const property={id:propertyId,organizationId,name:"หอพักทดสอบ",address:"Test Street",
 rentSatang:400000,waterSatangPerUnit:1800,electricSatangPerUnit:800,
 cadence:"MONTHLY",rollingAnchor:null,complianceReviewedAt:null};
const owner={id:ownerId,name:"เจ้าของทดสอบ",role:"USER",
 memberships:[{organizationId,role:"OWNER"}]};
const staff={id:"staff-e2e",name:"พนักงานทดสอบ",role:"USER",
 memberships:[{organizationId,role:"STAFF"}],
 propertyGrants:[{propertyId,level:"METER_READER"}]};

function json(body:Json,status=200){
 return {status,contentType:"application/json; charset=utf-8",body:JSON.stringify(body)};
}
type Actor={id:string;name:string;role:string;memberships?:{organizationId:string;role:"OWNER"|"MANAGER"|"STAFF"}[];propertyGrants?:{propertyId:string;level:"VIEWER"|"METER_READER"}[]};
async function intercept(page:Page,actor:Actor|null){
 const requests:string[]=[];
 let managedRole="USER";
 await page.route("**/v1/**",async route=>{
  const {pathname}=new URL(route.request().url());
  const method=route.request().method();
  requests.push(`${method} ${pathname}`);
  const tables:Record<string,Json>={
   "/v1/me":actor??{error:"UNAUTHENTICATED"},
   "/v1/admin/overview":{organizationCount:1,propertyCount:1,roomCount:1,invoiceCount:0},
   "/v1/admin/platform-users":[{id:"account-e2e",displayName:"บัญชีทดสอบ",platformRole:managedRole,status:"ACTIVE",createdAt:"2026-11-01T00:00:00Z"}],
   "/v1/organizations":[{id:organizationId,name:"องค์กรทดสอบ"}],
   [`/v1/organizations/${organizationId}/properties`]:[property],
   [`/v1/properties/${propertyId}/rooms`]:
    [{id:roomId,number:"101",floor:1,status:"AVAILABLE",
      rentOverrideSatang:null,waterOverrideSatang:null,electricOverrideSatang:null}],
   [`/v1/properties/${propertyId}/invoices`]:[],
   [`/v1/properties/${propertyId}/leases`]:[],
   [`/v1/properties/${propertyId}/overview`]:
    {rooms:1,occupied:0,available:1,totalBilledSatang:0,issuedInvoices:0,
     manuallyApprovedSatang:0,outstandingSatang:0,overdueSatang:0,
     overdueInvoiceCount:0},
   [`/v1/properties/${propertyId}/occupancy-report`]:
    {propertyId,totalRooms:1,occupiedRooms:0,availableRooms:1,maintenanceRooms:0,
     occupancyPercent:0,activeLeaseCount:0,occupiedWithoutActiveLease:0,
     activeLeaseInNonOccupiedRoom:0,roomsWithMultipleActiveLeases:0},
   [`/v1/properties/${propertyId}/financial-report`]:
    {propertyId,from:"2026-11-01",to:"2026-11-05",currency:"THB",unit:"SATANG",
     bankVerified:false,totals:{invoiceCount:2,totalBilledSatang:150000,
      grossManualApprovedSatang:60000,netManualApprovedSatang:60000,
      internalCreditSatang:5000,outstandingSatang:95000},months:[]},
   "/v1/tenant/leases":[],
   "/v1/tenant/invoices":[],
   "/v1/tenant/invitations":[],
   "/v1/tenant/history/invoices":[],
   "/v1/notifications":{items:[{id:"notification-e2e",organizationId,eventKey:"ROOM_CREATED:room-e2e",
    kind:"ROOM_CREATED",title:"เพิ่มห้องพักใหม่",body:"เพิ่มห้อง A101 ในที่พักแล้ว",readAt:null,
    createdAt:"2026-11-05T09:00:00.000Z"}]},
  };
  if(method==="GET"&&pathname==="/v1/me"&&!actor){
   await route.fulfill(json({error:"UNAUTHENTICATED"},401));return;
  }
  if(method==="GET"&&pathname in tables){
   await route.fulfill(json(tables[pathname]));return;
  }
  if(method==="PATCH"&&pathname==="/v1/admin/platform-users/account-e2e/role"){
   managedRole=(route.request().postDataJSON() as {role:string}).role;
   await route.fulfill(json({id:"account-e2e",displayName:"บัญชีทดสอบ",platformRole:managedRole,changed:true}));return;
  }
  if(method==="POST"&&pathname==="/v1/notifications/notification-e2e/read"){
   await route.fulfill(json({id:"notification-e2e",readAt:"2026-11-05T10:00:00.000Z"}));return;
  }
  if(method==="POST"&&pathname==="/v1/auth/logout"){
   await route.fulfill(json({}));return;
  }
  await route.fulfill(json({error:"FORBIDDEN"},403));
 });
 return requests;
}
test("guest sees LINE entry point without tenant or owner data",async({page})=>{
 const requests=await intercept(page,null);
 await page.goto("/");
 await expect(page.getByRole("heading",{name:"หอพักของคุณ จัดการง่ายในที่เดียว"})).toBeVisible();
 await expect(page.getByRole("button",{name:"เข้าสู่ระบบด้วย LINE"})).toBeVisible();
 await expect(page.getByRole("navigation",{name:"เมนูหลัก"})).toHaveCount(0);
 const layout=await page.evaluate(()=>({width:innerWidth,contentWidth:document.documentElement.scrollWidth}));
 expect(layout.contentWidth).toBeLessThanOrEqual(layout.width+1);
 expect(requests).not.toContain("GET /v1/organizations");
});

test("owner can read and mark an organization notification",async({page})=>{
 const requests=await intercept(page,owner);
 await page.goto("/");
 const menu=page.getByRole("button",{name:"เมนู"});
 if(await menu.isVisible())await menu.click();
 await page.getByRole("navigation",{name:"เมนูหลัก"}).getByRole("button",{name:"แจ้งเตือน"}).click();
 await expect(page.getByRole("heading",{name:"การแจ้งเตือน"})).toBeVisible();
 await expect(page.getByText("เพิ่มห้อง A101 ในที่พักแล้ว")).toBeVisible();
 await page.getByRole("button",{name:"อ่านแล้ว"}).click();
 await expect(page.getByRole("button",{name:"อ่านแล้ว"})).toHaveCount(0);
 expect(requests).toContain("GET /v1/notifications");
 expect(requests).toContain("POST /v1/notifications/notification-e2e/read");
});

test("authenticated owner loads scoped overview and logs out",async({page})=>{
 const requests=await intercept(page,owner);
 await page.goto("/");
 await expect(page.getByRole("navigation",{name:"เมนูหลัก"})).toBeVisible();
 await expect(page.getByRole("combobox",{name:"หอพัก"})).toHaveValue(propertyId);
 await expect(page.getByRole("button",{name:"รับชำระเงิน"})).toBeVisible();
 expect(requests).toContain(`GET /v1/properties/${propertyId}/overview`);
 expect(requests).toContain(`GET /v1/properties/${propertyId}/financial-report`);
 await expect(page.getByText(/ยอดออกบิล 2 ใบ/)).toBeVisible();
 await expect(page.getByText(/ยอดนี้ยังไม่ใช่การยืนยันจากธนาคาร/)).toBeVisible();
 const menu=page.getByRole("button",{name:"เมนู"});
 if(await menu.isVisible())await menu.click();
 await page.getByRole("navigation",{name:"เมนูหลัก"})
  .getByRole("button",{name:"โปรไฟล์"}).click();
 await expect(page.getByRole("heading",{name:"โปรไฟล์ของฉัน"})).toBeVisible();
 await expect(page.getByText("เจ้าของหอพัก",{exact:true})).toBeVisible();
 if(await menu.isVisible())await menu.click();
 await page.locator(".aside-bottom").getByRole("button",{name:"ออกจากระบบ"}).click();
 await expect(page.getByRole("button",{name:"เข้าสู่ระบบด้วย LINE"})).toBeVisible();
 await expect(page.getByRole("navigation",{name:"เมนูหลัก"})).toHaveCount(0);
 expect(requests).toContain("POST /v1/auth/logout");
});

test("SUPER_ADMIN can grant and remove platform administrator access from verified accounts",async({page})=>{
 const requests=await intercept(page,{id:"root-e2e",name:"ผู้ดูแลระบบ",role:"SUPER_ADMIN",memberships:[]});
 await page.goto("/?section=admin");
 await expect(page.getByRole("heading",{name:"จัดการ Super Admin"})).toBeVisible();
 await expect(page.getByText("บัญชีทดสอบ")).toBeVisible();
 page.once("dialog",dialog=>dialog.accept());
 await page.getByRole("button",{name:"เพิ่ม Super Admin"}).click();
 await expect(page.getByRole("button",{name:"ถอดสิทธิ"})).toBeVisible();
 expect(requests).toContain("PATCH /v1/admin/platform-users/account-e2e/role");
});

test("STAFF navigation cannot access billing, payments, settings or admin",async({page})=>{
 const requests=await intercept(page,staff);
 await page.goto("/");
 await expect(page.getByRole("navigation",{name:"เมนูหลัก"})).toBeVisible();
 await expect(page.getByRole("button",{name:"ห้องพัก"})).toBeVisible();
 await expect(page.getByRole("button",{name:"จดมิเตอร์"})).toBeVisible();
 await expect(page.getByRole("button",{name:"ออกบิล"})).toHaveCount(0);
 await expect(page.getByRole("button",{name:"รับชำระเงิน"})).toHaveCount(0);
 await expect(page.getByRole("button",{name:"ตั้งค่า"})).toHaveCount(0);
 await expect(page.getByRole("button",{name:"Super Admin"})).toHaveCount(0);
 expect(requests).not.toContain(`GET /v1/properties/${propertyId}/invoices`);
 expect(requests).not.toContain(`GET /v1/properties/${propertyId}/overview`);
});

test("tenant without organization opens tenant-only self-service and no owner financial screens",async({page})=>{
 const requests=await intercept(page,{id:"tenant-e2e",name:"ผู้เช่าทดสอบ",role:"USER",memberships:[]});
 await page.route("**/v1/organizations",async route=>
  route.fulfill(json([])));
 await page.goto("/?section=tenant");
 await expect(page.getByRole("heading",{name:"สวัสดี ผู้พักอาศัย"})).toBeVisible();
 await expect(page.getByRole("heading",{name:"ผูกบัญชี LINE กับห้องพัก"})).toBeVisible();
 await expect(page.getByText("ยังไม่มีคำขอผูกบัญชี")).toBeVisible();
 const layout=await page.evaluate(()=>({width:innerWidth,contentWidth:document.documentElement.scrollWidth}));
 expect(layout.contentWidth).toBeLessThanOrEqual(layout.width+1);
 expect(requests).not.toContain(`GET /v1/properties/${propertyId}/invoices`);
});

test("tenant can open only a server-authorized invoice with immutable line details",async({page})=>{
 const invoice={id:"invoice-approved",leaseId:"lease-1",propertyName:"หอพักทดสอบ",
  periodStart:"2026-10-01",periodEnd:"2026-11-01",dueDate:"2026-11-07",
  amountSatang:400000,status:"ISSUED"};
 await intercept(page,{id:"tenant-e2e",name:"ผู้เช่าทดสอบ",role:"USER",memberships:[]});
 await page.route("**/v1/organizations",route=>route.fulfill(json([])));
 await page.route("**/v1/tenant/invoices",route=>route.fulfill(json([invoice])));
 await page.route("**/v1/tenant/invoices/invoice-approved",route=>route.fulfill(json({
  ...invoice,lines:[{type:"RENT",description:"ค่าเช่าเดือนตุลาคม",unitsMilli:null,
   tariffSatang:null,amountSatang:400000}],
 })));
 await page.goto("/?section=tenant");
 await expect(page.locator(".tenant-bill")).toHaveCount(1);
 await page.locator(".tenant-bill").click();
 await expect(page.getByRole("heading",{name:"รายละเอียดใบแจ้งหนี้"})).toBeVisible();
 await expect(page.getByText("ค่าเช่าเดือนตุลาคม")).toBeVisible();
 await page.getByRole("button",{name:"ปิด",exact:true}).click();
 await expect(page.getByRole("heading",{name:"รายละเอียดใบแจ้งหนี้"})).toHaveCount(0);
});

test("tenant UI does not disclose invoice details after server IDOR denial",async({page})=>{
 const invoice={id:"foreign-invoice",leaseId:"lease-foreign",propertyName:"หอพักอื่น",
  periodStart:"2026-10-01",periodEnd:"2026-11-01",dueDate:"2026-11-07",
  amountSatang:500000,status:"ISSUED"};
 await intercept(page,{id:"tenant-e2e",name:"ผู้เช่าทดสอบ",role:"USER",memberships:[]});
 await page.route("**/v1/organizations",route=>route.fulfill(json([])));
 await page.route("**/v1/tenant/invoices",route=>route.fulfill(json([invoice])));
 await page.route("**/v1/tenant/invoices/foreign-invoice",route=>
  route.fulfill(json({error:"TENANT_INVOICE_NOT_FOUND"},404)));
 await page.goto("/?section=tenant");
 await page.locator(".tenant-bill").click();
 await expect(page.getByRole("alert").filter({hasText:"TENANT_INVOICE_NOT_FOUND"})).toBeVisible();
 await expect(page.getByRole("heading",{name:"รายละเอียดใบแจ้งหนี้"})).toHaveCount(0);
});

test("owner invitation requires confirmation and exposes new code only after explicit creation",async({page})=>{
 const leaseId="lease-e2e";
 const code="x".repeat(43);
 let created=0;
 await intercept(page,owner);
 await page.route(`**/v1/properties/${propertyId}/leases`,route=>route.fulfill(json([{
  id:leaseId,roomId,tenantName:"ผู้เช่าทดสอบ",tenantLineSubject:null,
  startDate:"2026-10-01",endDate:null,status:"ACTIVE",
 }])));
 await page.route(`**/v1/properties/${propertyId}/leases/${leaseId}/invitations`,route=>{
  if(route.request().method()==="POST"){
   created++;
   return route.fulfill(json({id:"invite-e2e",token:code,expiresAt:"2026-11-07T12:00:00Z"},201));
  }
  return route.fulfill(json([]));
 });
 await page.goto("/");
 await expect(page.getByRole("navigation",{name:"เมนูหลัก"})).toBeVisible();
 const menu=page.getByRole("button",{name:"เมนู"});
 if(await menu.isVisible())await menu.click();
 await page.getByRole("navigation",{name:"เมนูหลัก"})
  .getByRole("button",{name:"เชิญผู้เช่า"}).click();
 await expect(page.getByRole("heading",{name:"เชิญผู้เช่าเข้าใช้งาน LINE"})).toBeVisible();
 await expect(page.locator(".invite-code")).toHaveCount(0);
 page.once("dialog",dialog=>dialog.accept());
 await page.getByRole("button",{name:"สร้าง Invite Code ใหม่"}).click();
 await expect(page.locator(".invite-code code")).toHaveText(code);
 expect(created).toBe(1);
 expect(page.url()).not.toContain(code);
});

test("tenant invitation claim is submitted explicitly and remains pending owner approval",async({page})=>{
 const code="y".repeat(43);
 let claimPayload:Record<string,unknown>|null=null;
 let pending=false;
 await intercept(page,{id:"tenant-e2e",name:"ผู้เช่าทดสอบ",role:"USER",memberships:[]});
 await page.route("**/v1/organizations",route=>route.fulfill(json([])));
 await page.route("**/v1/tenant/invitations",route=>route.fulfill(json(pending?[{
  id:"invite-e2e",claimedAt:"2026-11-05T00:00:00Z",approvedAt:null,
  revokedAt:null,expiresAt:"2026-11-07T00:00:00Z",
 }]:[])));
 await page.route("**/v1/tenant/invitations/claim",route=>{
  claimPayload=route.request().postDataJSON() as Record<string,unknown>;
  pending=true;
  return route.fulfill(json({status:"PENDING"},200));
 });
 await page.goto("/?section=tenant");
 await page.getByRole("textbox",{name:"Invite Code จากเจ้าของหอพัก"}).fill(code);
 await page.getByRole("button",{name:"ส่งคำขอผูกบัญชี"}).click();
 await expect(page.getByText("รอเจ้าของอนุมัติ",{exact:true})).toBeVisible();
 expect(claimPayload).toEqual({token:code});
 expect(page.url()).not.toContain(code);
 await expect(page.getByText("ยังไม่มีใบแจ้งหนี้ที่เปิดให้ดู")).toBeVisible();
});

test("owner approval of claimed LINE invite requires explicit confirmation",async({page})=>{
 const leaseId="lease-e2e";
 let approved=false,approveCalls=0;
 await intercept(page,owner);
 await page.route(`**/v1/properties/${propertyId}/leases`,route=>route.fulfill(json([{
  id:leaseId,roomId,tenantName:"ผู้เช่าทดสอบ",tenantLineSubject:approved?"U"+"a".repeat(32):null,
  startDate:"2026-10-01",endDate:null,status:"ACTIVE",
 }])));
 await page.route(`**/v1/properties/${propertyId}/leases/${leaseId}/invitations/invite-e2e/approve`,route=>{
  approveCalls++;approved=true;return route.fulfill(json({status:"APPROVED"},200));
 });
 await page.route(`**/v1/properties/${propertyId}/leases/${leaseId}/invitations`,route=>route.fulfill(json([{
  id:"invite-e2e",expiresAt:"2026-11-07T00:00:00Z",
  claimedAt:"2026-11-05T00:00:00Z",approvedAt:approved?"2026-11-05T00:01:00Z":null,
  revokedAt:null,claimantName:"ผู้เช่าทดสอบ",createdAt:"2026-11-04T00:00:00Z",
 }])));
 await page.goto("/");
 await expect(page.getByRole("navigation",{name:"เมนูหลัก"})).toBeVisible();
 const menu=page.getByRole("button",{name:"เมนู"});
 if(await menu.isVisible())await menu.click();
 await page.getByRole("navigation",{name:"เมนูหลัก"})
  .getByRole("button",{name:"เชิญผู้เช่า"}).click();
 await expect(page.getByRole("button",{name:"อนุมัติ",exact:true})).toBeVisible();
 expect(approveCalls).toBe(0);
 page.once("dialog",dialog=>dialog.accept());
 await page.getByRole("button",{name:"อนุมัติ",exact:true}).click();
 await expect(page.getByText("อนุมัติและผูก LINE แล้ว")).toBeVisible();
 expect(approveCalls).toBe(1);
});
