import {expect, test} from "@playwright/test";

test("owner creates property, room, lease and meter reading with safe payloads", async ({page}) => {
 const propertyId = "property-created-e2e";
 let propertyCreated = false;
 let roomCreated = false;
 let propertyPayload: Record<string,unknown>|undefined;
 let roomPayload: Record<string,unknown>|undefined;
 let leasePayload: Record<string,unknown>|undefined;
 let readingPayload: Record<string,unknown>|undefined;
 const reply = (route: Parameters<Parameters<typeof page.route>[1]>[0],
  status:number, body:unknown) => route.fulfill({
  status,contentType:"application/json",body:JSON.stringify(body)
 });
 await page.route("**/v1/**", async route => {
  const {pathname} = new URL(route.request().url());
  const method = route.request().method();
  if(method === "GET" && pathname === "/v1/me") return reply(route,200,{
   id:"owner-e2e",name:"เจ้าของทดสอบ",role:"USER",
   memberships:[{organizationId:"org-e2e",role:"OWNER"}]
  });
  if(method === "GET" && pathname === "/v1/organizations")
   return reply(route,200,[{id:"org-e2e",name:"องค์กรทดสอบ"}]);
  if(pathname === "/v1/organizations/org-e2e/properties"){
   if(method === "POST"){
    propertyPayload = route.request().postDataJSON() as Record<string,unknown>;
    propertyCreated = true;
    return reply(route,201,{id:propertyId});
   }
   return reply(route,200,propertyCreated ? [{
    id:propertyId,organizationId:"org-e2e",name:"บ้านทดสอบ",address:"Test Street",
    rentSatang:400025,waterSatangPerUnit:1800,electricSatangPerUnit:400,
    cadence:"MONTHLY",rollingAnchor:null,complianceReviewedAt:null
   }] : []);
  }
  if(pathname === `/v1/properties/${propertyId}/rooms`){
   if(method === "POST"){
    roomPayload = route.request().postDataJSON() as Record<string,unknown>;
    roomCreated = true;
    return reply(route,201,{id:"room-created-e2e"});
   }
   return reply(route,200,roomCreated ? [{
    id:"room-created-e2e",number:"A101",floor:2,status:"AVAILABLE",
    rentOverrideSatang:null,waterOverrideSatang:null,electricOverrideSatang:null
   }] : []);
  }
  if(pathname === `/v1/properties/${propertyId}/leases`){
   if(method === "POST"){
    leasePayload = route.request().postDataJSON() as Record<string,unknown>;
    return reply(route,201,{id:"lease-created-e2e"});
   }
   return reply(route,200,[]);
  }
  if(method === "POST" && pathname === `/v1/properties/${propertyId}/readings`){
   readingPayload = route.request().postDataJSON() as Record<string,unknown>;
   return reply(route,201,{id:"reading-created-e2e"});
  }
  if(method === "GET" && pathname === `/v1/properties/${propertyId}/overview`)
   return reply(route,200,{rooms:Number(roomCreated),occupied:0,available:Number(roomCreated),
    totalBilledSatang:0,issuedInvoices:0,manuallyApprovedSatang:0,
    outstandingSatang:0,overdueSatang:0,overdueInvoiceCount:0});
  if(method === "GET" && [`/v1/properties/${propertyId}/invoices`,
   `/v1/properties/${propertyId}/leases`].includes(pathname))
   return reply(route,200,[]);
  return reply(route,403,{error:"FORBIDDEN"});
 });
 await page.goto("/");
 await expect(page.getByRole("heading",{name:"เพิ่มหอพักแห่งแรก"})).toBeVisible();
 await page.locator('input[name="name"]').fill("บ้านทดสอบ");
 await page.locator('input[name="rent"]').fill("4000.25");
 await page.getByRole("button",{name:"บันทึกข้อมูล"}).click();
 await expect(page.getByRole("combobox",{name:"หอพัก"})).toHaveValue(propertyId);
 expect(propertyPayload).toMatchObject({
  name:"บ้านทดสอบ",rentSatang:400025,
  waterSatangPerUnit:1800,electricSatangPerUnit:400
 });

 const menu = page.getByRole("button",{name:"เมนู"});
 if(await menu.isVisible()) await menu.click();
 await page.getByRole("navigation",{name:"เมนูหลัก"})
  .getByRole("button",{name:"ห้องพัก"}).click();
 await expect(page.getByRole("heading",{name:"เพิ่มห้องพักใหม่"})).toBeVisible();
 await page.locator('input[name="number"]').fill("A101");
 await page.locator('input[name="floor"]').fill("2");
 await expect(page.locator('input[name="rentDefault"]')).toBeChecked();
 await expect(page.locator('input[name="waterDefault"]')).toBeChecked();
 await expect(page.locator('input[name="electricDefault"]')).toBeChecked();
 await expect(page.locator('input[name="rent"]')).toBeDisabled();
 await expect(page.locator('input[name="water"]')).toBeDisabled();
 await expect(page.locator('input[name="electric"]')).toBeDisabled();
 await page.locator('input[name="rentDefault"]').uncheck();
 await page.locator('input[name="rent"]').fill("4500");
 await page.locator('input[name="electricDefault"]').uncheck();
 await page.locator('input[name="electric"]').fill("5.25");
 await expect(page.locator('input[name="rent"]')).toBeEnabled();
 await page.locator('form:has(input[name="number"]) button[type="submit"]').click();
 await expect(page.getByText("เพิ่มห้องพักแล้ว")).toBeVisible();
 expect(roomPayload).toEqual({number:"A101",floor:2,rentOverrideSatang:450000,waterOverrideSatang:null,electricOverrideSatang:525});
 await page.locator('form:has(input[name="start"]) input[name="name"]').fill("ผู้เช่าทดสอบ");
 await page.locator('form:has(input[name="start"]) button[type="submit"]').click();
 await expect(page.getByText("บันทึกสัญญาเช่าแล้ว")).toBeVisible();
 expect(leasePayload).toMatchObject({roomId:"room-created-e2e",tenantName:"ผู้เช่าทดสอบ"});

 if(await menu.isVisible()) await menu.click();
 await page.getByRole("navigation",{name:"เมนูหลัก"})
  .getByRole("button",{name:"จดมิเตอร์"}).click();
 await page.locator('form:has(input[name="value"]) input[name="value"]').fill("1234.000");
 await page.locator('form:has(input[name="value"]) button[type="submit"]').click();
 await expect(page.getByText("บันทึกเลขมิเตอร์เรียบร้อย")).toBeVisible();
 expect(readingPayload).toMatchObject({
  roomId:"room-created-e2e",kind:"WATER",value:"1234.000"
 });
});
