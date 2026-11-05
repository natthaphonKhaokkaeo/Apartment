import {test,expect,type Page,type BrowserContext} from "@playwright/test";
import {randomUUID} from "node:crypto";
import {db,sqlClient} from "../../apps/api/src/db/client.js";
import {users,sessions,organizations,memberships,properties,propertyStaffGrants} from "../../apps/api/src/db/schema.js";
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
