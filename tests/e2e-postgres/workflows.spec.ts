import {test,expect,type Page,type BrowserContext} from "@playwright/test";
import {randomUUID} from "node:crypto";
import {db,sqlClient} from "../../apps/api/src/db/client.js";
import {users,sessions,organizations,memberships,properties,propertyStaffGrants,rooms as roomRows,leases as leaseRows,invoices as invoiceRows,paymentInstructions,leaseInvitations} from "../../apps/api/src/db/schema.js";
import {newSessionToken,tokenHash} from "../../apps/api/src/security.js";

// Only the disposable runner supplies this environment. No API interception.
test.beforeAll(()=>{
 if(!process.env.APARTMENT_COVERAGE_ROOT||!process.env.DATABASE_URL?.includes("isolated_coverage_only@127.0.0.1:"))
  throw new Error("Disposable PostgreSQL runner required");
});
test.afterAll(async()=>{await sqlClient.end();});
async function session(context:BrowserContext,expired=false){
 const [user]=await db.insert(users).values({lineSubject:"browser-fixture-"+randomUUID(),displayName:"เจ้าของทดสอบจริง"}).returning();
 const token=newSessionToken();
 await db.insert(sessions).values({userId:user.id,tokenHash:tokenHash(token),expiresAt:new Date(Date.now()+(expired?-60_000:3_600_000))});
 await context.addCookies([{name:"apartment_session",value:token,url:"http://127.0.0.1:4174",httpOnly:true,sameSite:"Lax"}]);
 return user;
}
async function menu(page:Page,name:string){
 const toggle=page.getByRole("button",{name:"เมนู",exact:true});
 if(await toggle.isVisible())await toggle.click();
 await page.getByRole("navigation",{name:"เมนูหลัก"}).getByRole("button",{name,exact:true}).click();
}
test("real owner creates organization, property, room and lease through browser",async({page,context})=>{
 await session(context);
 await page.goto("/");
 await expect(page.getByRole("navigation",{name:"เมนูหลัก"})).toBeAttached();
 await menu(page,"ภาพรวม");
 await page.getByLabel("ชื่อบัญชีเจ้าของ",{exact:true}).fill("องค์กร Browser "+randomUUID().slice(0,6));
 await page.locator("form").filter({has:page.getByLabel("ชื่อบัญชีเจ้าของ",{exact:true})}).getByRole("button",{name:"บันทึกข้อมูล"}).click();
 await page.getByLabel("ชื่อหอพัก",{exact:true}).fill("หอพัก Browser จริง");
 await expect(page.locator(".aside-bottom small")).toHaveText("เจ้าของ");
 await page.getByLabel("ที่อยู่",{exact:true}).fill("Isolated browser test");
 await page.locator("form").filter({has:page.getByLabel("ชื่อหอพัก",{exact:true})}).getByRole("button",{name:"บันทึกข้อมูล"}).click();
 await expect(page.getByRole("combobox",{name:"หอพัก",exact:true})).not.toHaveValue("");
 await menu(page,"ห้องพัก");
 await page.getByLabel("หมายเลขห้อง",{exact:true}).fill("B101");
 await page.locator("form").filter({has:page.getByLabel("หมายเลขห้อง",{exact:true})}).getByRole("button",{name:"บันทึกข้อมูล"}).click();
 await expect(page.getByRole("combobox",{name:"ห้องว่าง",exact:true}).locator("option")).toHaveText("B101");
 await page.getByLabel("ชื่อผู้เช่า",{exact:true}).fill("ผู้เช่า Browser");
 await page.getByLabel("วันเริ่มสัญญา",{exact:true}).fill("2026-11-01");
 await page.locator("form").filter({has:page.getByLabel("ชื่อผู้เช่า",{exact:true})}).getByRole("button",{name:"บันทึกข้อมูล"}).click();
 await expect(page.getByRole("status")).toContainText("บันทึกสัญญาเช่าแล้ว");
 const propertyId=await page.getByRole("combobox",{name:"หอพัก",exact:true}).inputValue();
 const response=await context.request.get("/v1/properties/"+propertyId+"/leases");
 expect(response.status()).toBe(200);
 expect((await response.json()).some((x:{tenantName:string})=>x.tenantName==="ผู้เช่า Browser")).toBe(true);
 await menu(page,"รับชำระเงิน");
 const deposits=page.getByRole("region",{name:"เงินประกัน",exact:true});
 await deposits.getByLabel("เงินประกันรับเข้า (บาท)",{exact:true}).fill("100.00");
 await deposits.getByLabel("รหัสอ้างอิงเงินประกันภายใน",{exact:true}).fill("browser-deposit-"+randomUUID());
 await deposits.getByLabel("เหตุผลรับเงินประกัน",{exact:true}).fill("ทดสอบบันทึกเงินประกันด้วยมือในฐานข้อมูลชั่วคราว");
 const saved=page.waitForResponse(r=>r.url().endsWith("/deposits/receipts")&&r.request().method()==="POST");
 await deposits.getByRole("button",{name:"บันทึกรับเงินประกันด้วยมือ",exact:true}).click();
 expect((await saved).status()).toBe(201);
 await expect(deposits.getByRole("status")).toContainText("บันทึกเงินประกันด้วยมือแล้ว");
 await deposits.getByLabel("ยอดขอตรวจสอบ (บาท)",{exact:true}).fill("20.00");
 await deposits.getByLabel("เหตุผลคำขอเงินประกัน",{exact:true}).fill("ขอตรวจสอบค่าซ่อมในสภาพแวดล้อมทดสอบเท่านั้น");
 const proposed=page.waitForResponse(r=>r.url().endsWith("/deposits/reviews")&&r.request().method()==="POST");
 await deposits.getByRole("button",{name:"ส่งคำขอเงินประกัน",exact:true}).click();
 expect((await proposed).status()).toBe(201);
 await expect(deposits.getByText("ต้องให้เจ้าของอีกบัญชีตรวจสอบ",{exact:true})).toBeVisible();
 const leaseId=await deposits.getByRole("combobox",{name:"สัญญาเงินประกัน",exact:true}).inputValue();
 const depositState=await context.request.get("/v1/properties/"+propertyId+"/leases/"+leaseId+"/deposits");
 expect(depositState.status()).toBe(200);
 expect((await depositState.json()).position).toMatchObject({receivedSatang:10000,reservedSatang:2000,availableSatang:8000,bankVerified:false,payoutEnabled:false});
 await menu(page,"จดมิเตอร์");
 const meterForm=page.locator("form").filter({has:page.getByLabel("เลขมิเตอร์",{exact:true})});
 for(const [day,value] of [["2026-11-01","10.000"],["2026-11-02","100.000"]]){
  await page.getByLabel("วันที่อ่าน",{exact:true}).fill(day);
  await page.getByLabel("เลขมิเตอร์",{exact:true}).fill(value);
  const written=page.waitForResponse(r=>r.url().endsWith("/readings")&&r.request().method()==="POST");
  await meterForm.getByRole("button",{name:"บันทึกข้อมูล",exact:true}).click();
  expect((await written).status()).toBe(201);
 }
 const evidence=page.getByRole("region",{name:"หลักฐานมิเตอร์",exact:true});
 await evidence.getByRole("button",{name:"โหลดเลขมิเตอร์และหลักฐานใหม่",exact:true}).click();
 await expect(evidence.getByRole("combobox",{name:"เลขมิเตอร์ที่แนบหลักฐาน",exact:true}).locator("option")).toHaveCount(2);
 const png=await page.evaluate(()=>{const c=document.createElement("canvas");c.width=16;c.height=16;const x=c.getContext("2d")!;x.fillStyle="#ff8800";x.fillRect(0,0,16,16);return c.toDataURL("image/png").split(",")[1];});
 await evidence.getByLabel("รูปหลักฐานมิเตอร์",{exact:true}).setInputFiles({name:"synthetic-meter.png",mimeType:"image/png",buffer:Buffer.from(png,"base64")});
 const photo=page.waitForResponse(r=>r.url().endsWith("/photos")&&r.request().method()==="POST");
 await evidence.getByRole("button",{name:"บันทึกรูปมิเตอร์",exact:true}).click();
 expect((await photo).status()).toBe(201);
 await expect(evidence.getByText("ยังไม่ได้ตรวจมัลแวร์ (DEV)",{exact:true})).toBeVisible();
 await evidence.getByRole("button",{name:"เปิด/ปิดรูปหลักฐาน",exact:true}).click();
 const image=evidence.getByRole("img",{name:"รูปหลักฐานเลขมิเตอร์ที่เลือก"});
 await expect(image).toBeVisible();await expect.poll(()=>image.evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBeGreaterThan(0);
 await evidence.getByLabel("เกณฑ์การใช้สูงสุดต่อวัน (หน่วย)",{exact:true}).fill("1.000");
 await evidence.getByLabel("เหตุผลตรวจมิเตอร์",{exact:true}).fill("ตรวจสอบเลขมิเตอร์ผิดปกติในระบบทดสอบโดยเจ้าของ");
 const reviewed=page.waitForResponse(r=>r.url().endsWith("/reviews")&&r.request().method()==="POST");
 await evidence.getByRole("button",{name:"บันทึกผลตรวจมิเตอร์",exact:true}).click();
 expect((await reviewed).status()).toBe(201);
 await expect(evidence.getByText("REQUIRES_CORRECTION — USAGE_SPIKE",{exact:true})).toBeVisible();
 const widths=await page.evaluate(()=>({page:document.documentElement.scrollWidth,viewport:innerWidth}));
 expect(widths.page).toBeLessThanOrEqual(widths.viewport+1);
});
test("expired real database session cannot load owner data",async({page,context})=>{
 await session(context,true);
 await page.goto("/");
 await expect(page.getByRole("button",{name:"เข้าสู่ระบบด้วย LINE"})).toBeVisible();
 expect((await context.request.get("/v1/organizations")).status()).toBe(401);
 await expect(page.getByRole("navigation",{name:"เมนูหลัก"})).toHaveCount(0);
});
test("logout revokes real session and subsequent API access",async({page,context})=>{
 await session(context);
 await page.goto("/");
 await expect(page.getByRole("navigation",{name:"เมนูหลัก"})).toBeAttached();
 const toggle=page.getByRole("button",{name:"เมนู",exact:true});
 if(await toggle.isVisible())await toggle.click();
 await page.getByRole("button",{name:/ออกจากระบบ/}).click();
 await expect(page.getByRole("button",{name:"เข้าสู่ระบบด้วย LINE"})).toBeVisible();
 expect((await context.request.get("/v1/organizations")).status()).toBe(401);
});

test("STAFF browser hides financial actions and backend rejects direct invoice access",async({page,context})=>{
 const user=await session(context);
 const [org]=await db.insert(organizations).values({name:"Browser STAFF "+randomUUID()}).returning();
 await db.insert(memberships).values({organizationId:org.id,userId:user.id,role:"STAFF"});
 const [property]=await db.insert(properties).values({organizationId:org.id,name:"Staff scoped property",rentSatang:10000,waterSatangPerUnit:100,electricSatangPerUnit:100}).returning();
 await db.insert(propertyStaffGrants).values({organizationId:org.id,propertyId:property.id,userId:user.id,level:"VIEWER",updatedBy:user.id});
 await page.goto("/");
 await expect(page.getByRole("combobox",{name:"หอพัก",exact:true})).toHaveValue(property.id);
 await expect(page.getByRole("button",{name:"ออกบิล",exact:true})).toHaveCount(0);
 await expect(page.getByRole("button",{name:"รับชำระเงิน",exact:true})).toHaveCount(0);
 expect((await context.request.get("/v1/properties/"+property.id+"/invoices")).status()).toBe(403);
 expect((await context.request.get("/v1/properties/"+property.id+"/rooms")).status()).toBe(200);
});

test("profile request submits and cancels through real tenant browser without erasing account",async({page,context})=>{
 await session(context);await page.goto("/");
 await expect(page.getByRole("navigation",{name:"เมนูหลัก"})).toBeAttached();
 await menu(page,"สำหรับผู้เช่า");
 const privacy=page.getByRole("region",{name:"คำขอข้อมูลส่วนบุคคล",exact:true});
 await expect(privacy.getByText("ยังไม่เปิดการล้างโปรไฟล์จริง สามารถยื่นและตรวจสอบคำขอได้",{exact:true})).toBeVisible();
 await privacy.getByLabel("เหตุผลคำขอจัดการโปรไฟล์",{exact:true}).fill("ทดสอบคำขอจัดการโปรไฟล์ผ่านเบราว์เซอร์ในฐานข้อมูลชั่วคราว");
 await privacy.getByRole("checkbox").check();
 const submitted=page.waitForResponse(r=>r.url().endsWith("/tenant/privacy/requests")&&r.request().method()==="POST");
 await privacy.getByRole("button",{name:"ยื่นคำขอจัดการโปรไฟล์",exact:true}).click();
 expect((await submitted).status()).toBe(201);
 await expect(privacy.getByText("REQUESTED",{exact:true})).toBeVisible();
 await privacy.getByRole("button",{name:"ยกเลิกคำขอโปรไฟล์",exact:true}).click();
 await expect(privacy.getByText("CANCELLED",{exact:true})).toBeVisible();
 expect((await context.request.get("/v1/organizations")).status()).toBe(200);
 expect((await context.request.get("/v1/admin/privacy/requests")).status()).toBe(403);
 const widths=await page.evaluate(()=>({page:document.documentElement.scrollWidth,viewport:innerWidth}));expect(widths.page).toBeLessThanOrEqual(widths.viewport+1);
});

async function linkedFixtures(ownerContext:BrowserContext,tenantContext:BrowserContext){
 const owner=await session(ownerContext),tenant=await session(tenantContext);
 const [org]=await db.insert(organizations).values({name:"Browser linked "+randomUUID()}).returning();await db.insert(memberships).values({organizationId:org.id,userId:owner.id,role:"OWNER"});
 const [property]=await db.insert(properties).values({organizationId:org.id,name:"Browser linked property",rentSatang:10000,waterSatangPerUnit:100,electricSatangPerUnit:100}).returning();
 const [room]=await db.insert(roomRows).values({organizationId:org.id,propertyId:property.id,number:"T101",status:"OCCUPIED"}).returning();
 const [lease]=await db.insert(leaseRows).values({organizationId:org.id,propertyId:property.id,roomId:room.id,tenantName:"Synthetic tenant",tenantLineSubject:tenant.lineSubject,startDate:"2026-01-01"}).returning();return {owner,tenant,org,property,room,lease};
}
test("real tenant maintenance request progresses through owner review and closure",async({page,context,browser})=>{
 const tenantContext=await browser.newContext({viewport:page.viewportSize()!});
 try{
 const f=await linkedFixtures(context,tenantContext),tenantPage=await tenantContext.newPage();
 await tenantPage.goto("/");await expect(tenantPage.getByRole("navigation",{name:"เมนูหลัก"})).toBeAttached();await menu(tenantPage,"สำหรับผู้เช่า");
 const tenantPanel=tenantPage.locator("section.panel").filter({has:tenantPage.getByRole("heading",{name:"แจ้งซ่อมบำรุง",exact:true})});
 await tenantPanel.getByLabel("หัวข้อ",{exact:true}).fill("Browser plumbing repair");await tenantPanel.getByLabel("รายละเอียดอาการ",{exact:true}).fill("Synthetic isolated repair request");
 await tenantPanel.getByRole("button",{name:"ส่งคำขอ",exact:true}).click();await expect(tenantPanel.getByRole("status")).toContainText("ส่งคำขอซ่อมบำรุงให้เจ้าของแล้ว");
 const tenantTicket=tenantPanel.locator("article.claim-item").filter({hasText:"Browser plumbing repair"});
 await tenantTicket.getByLabel(/เพิ่มรูป/).setInputFiles({name:"repair.png",mimeType:"image/png",buffer:Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAE0lEQVQImWP4z8DwnwGM/zMwAAAf7gP9qS/A4gAAAABJRU5ErkJggg==","base64")});
 const attachmentLink=tenantTicket.getByRole("link",{name:/ดาวน์โหลดรูป/});await expect(attachmentLink).toBeVisible();
 const [attachmentDownload]=await Promise.all([tenantPage.waitForEvent("download"),attachmentLink.click()]);
 expect(attachmentDownload.suggestedFilename()).toBe("maintenance-image.webp");
 await page.goto("/");await expect(page.getByRole("combobox",{name:"หอพัก",exact:true})).toHaveValue(f.property.id);await menu(page,"ซ่อมบำรุง");
 const ticket=page.locator("article.claim-item").filter({hasText:"Browser plumbing repair"});
 for(const label of ["รับเรื่องแล้ว","กำลังดำเนินการ","แก้ไขแล้ว","ปิดงาน"]){await ticket.getByRole("button",{name:label,exact:true}).click();await expect(ticket.locator(".claim-heading > .pill")).toHaveText(label);}
 await tenantPage.reload();await expect(tenantPanel.locator("article.claim-item").filter({hasText:"Browser plumbing repair"})).toContainText("ปิดงานแล้ว");
 expect((await tenantContext.request.get("/v1/properties/"+f.property.id+"/maintenance-tickets")).status()).toBe(403);
 }finally{await tenantContext.close();}
});
test("real tenant payment evidence stays pending until manual owner ledger approval",async({page,context,browser})=>{
 const tenantContext=await browser.newContext({viewport:page.viewportSize()!});
 try{
 const f=await linkedFixtures(context,tenantContext),tenantPage=await tenantContext.newPage();
 const [invoice]=await db.insert(invoiceRows).values({organizationId:f.org.id,propertyId:f.property.id,roomId:f.room.id,leaseId:f.lease.id,periodStart:"2026-10-01",periodEnd:"2026-11-01",dueDate:"2026-11-05",amountSatang:10000,idempotencyKey:randomUUID(),issuedBy:f.owner.id}).returning();
 await db.insert(paymentInstructions).values({organizationId:f.org.id,propertyId:f.property.id,bankName:"Synthetic test bank",accountName:"Synthetic recipient",accountNumber:"0000000000",updatedBy:f.owner.id});
 await tenantPage.goto("/");await expect(tenantPage.getByRole("navigation",{name:"เมนูหลัก"})).toBeAttached();await menu(tenantPage,"สำหรับผู้เช่า");await tenantPage.locator("button.tenant-bill").first().click();
 await tenantPage.getByLabel("ยอดโอน (บาท)",{exact:true}).fill("100.00");await tenantPage.getByLabel("วันและเวลาโอน",{exact:true}).fill("2026-11-04T12:00");
 const png=await tenantPage.evaluate(()=>{const c=document.createElement("canvas");c.width=16;c.height=16;return c.toDataURL("image/png").split(",")[1];});
 await tenantPage.getByLabel("ภาพสลิปหรือหลักฐาน (JPEG/PNG/WebP สูงสุด 4 MB)",{exact:true}).setInputFiles({name:"synthetic-payment.png",mimeType:"image/png",buffer:Buffer.from(png,"base64")});
 const uploaded=tenantPage.waitForResponse(r=>r.url().endsWith("/payment-claims")&&r.request().method()==="POST");await tenantPage.getByRole("button",{name:"ส่งแจ้งชำระให้เจ้าของตรวจสอบ",exact:true}).click();expect((await uploaded).status()).toBe(201);
 const summaryPath="/v1/tenant/invoices/"+invoice.id+"/payment-summary";const pending=await tenantContext.request.get(summaryPath);expect(pending.status()).toBe(200);expect(await pending.json()).toMatchObject({outstandingSatang:10000});
 await page.goto("/");await expect(page.getByRole("combobox",{name:"หอพัก",exact:true})).toHaveValue(f.property.id);await menu(page,"รับชำระเงิน");
 const claim=page.locator(".claim-item").filter({has:page.getByRole("button",{name:"ตรวจแล้ว อนุมัติยอด",exact:true})});
 const evidence=await context.request.get(await claim.getByRole("link",{name:"เปิดหลักฐาน (ส่วนตัว)",exact:true}).getAttribute("href") as string);expect(evidence.status()).toBe(200);expect(evidence.headers()["content-type"]).toContain("image/webp");
 page.once("dialog",dialog=>void dialog.accept());await claim.getByRole("button",{name:"ตรวจแล้ว อนุมัติยอด",exact:true}).click();await expect(page.getByRole("status")).toContainText("บันทึกการอนุมัติด้วยมือและยอดใน Ledger แล้ว");
 const paid=await tenantContext.request.get(summaryPath);expect(paid.status()).toBe(200);expect(await paid.json()).toMatchObject({outstandingSatang:0});
 }finally{await tenantContext.close();}
});

test("MANAGER cannot see or call tenant identity approval action",async({page,context,browser})=>{
 const tenantContext=await browser.newContext({viewport:page.viewportSize()!});
 try{
 const f=await linkedFixtures(context,tenantContext);
 await sqlClient`UPDATE leases SET tenant_line_subject = NULL WHERE id = ${f.lease.id}`;
 await sqlClient`UPDATE memberships SET role = 'MANAGER' WHERE user_id = ${f.owner.id}`;
 const [invite]=await db.insert(leaseInvitations).values({organizationId:f.org.id,propertyId:f.property.id,leaseId:f.lease.id,tokenHash:tokenHash(randomUUID()),expiresAt:new Date(Date.now()+300000),claimedAt:new Date(),claimedBy:f.tenant.id,createdBy:f.owner.id}).returning();
 await page.goto("/");await expect(page.getByRole("combobox",{name:"หอพัก",exact:true})).toHaveValue(f.property.id);await menu(page,"เชิญผู้เช่า");
 await expect(page.getByText("รอเจ้าของยืนยันบัญชี",{exact:true})).toBeVisible();await expect(page.getByRole("button",{name:"อนุมัติ",exact:true})).toHaveCount(0);
 expect((await context.request.post("/v1/properties/"+f.property.id+"/leases/"+f.lease.id+"/invitations/"+invite.id+"/approve",{data:{}})).status()).toBe(403);
 await menu(page,"รับชำระเงิน");
 await expect(page.getByRole("heading",{name:"การเงินสำหรับเจ้าของหอพัก",exact:true})).toBeVisible();
 await expect(page.getByRole("button",{name:"ตรวจแล้ว อนุมัติยอด",exact:true})).toHaveCount(0);
 await menu(page,"ซ่อมบำรุง");
 await menu(page,"จดมิเตอร์");
 await expect(page.getByRole("heading",{name:"เปลี่ยนมิเตอร์น้ำ/ไฟ (Owner)",exact:true})).toHaveCount(0);
 await menu(page,"ตั้งค่า");
 await expect(page.getByRole("heading",{name:"อัตรา Master ตามวันที่มีผล",exact:true})).toHaveCount(0);
 await menu(page,"ห้องพัก");
 await expect(page.getByRole("heading",{name:"สิ้นสุดสัญญาและย้ายออก (Owner)",exact:true})).toHaveCount(0);
 await expect(page.getByLabel("เหตุผลปรับราคา")).toHaveCount(0);
 await menu(page,"ออกบิล");
 await expect(page.getByRole("region",{name:"ออกบิลหลายห้อง",exact:true})).toHaveCount(0);
 }finally{await tenantContext.close();}
});
