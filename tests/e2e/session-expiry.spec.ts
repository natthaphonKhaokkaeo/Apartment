import {expect, test} from "@playwright/test";

test("expired server session clears owner navigation after reload", async ({page}) => {
 let authorized = true;
 let organizationReads = 0;
 await page.route("**/v1/**", async route => {
  const {pathname} = new URL(route.request().url());
  const reply = (status:number, body:unknown) => route.fulfill({
   status, contentType:"application/json", body:JSON.stringify(body)
  });
  if(pathname === "/v1/me"){
   return authorized
    ? reply(200,{id:"owner-e2e",name:"เจ้าของทดสอบ",role:"USER",
      memberships:[{organizationId:"org-e2e",role:"OWNER"}]})
    : reply(401,{error:"UNAUTHENTICATED"});
  }
  if(pathname === "/v1/organizations"){
   organizationReads++;
   return reply(200,[{id:"org-e2e",name:"องค์กรทดสอบ"}]);
  }
  if(pathname === "/v1/organizations/org-e2e/properties") return reply(200,[]);
  return reply(403,{error:"FORBIDDEN"});
 });
 await page.goto("/");
 await expect(page.getByRole("navigation",{name:"เมนูหลัก"})).toBeVisible();
 expect(organizationReads).toBe(1);

 authorized = false;
 await page.reload();
 await expect(page.getByRole("button",{name:"เข้าสู่ระบบด้วย LINE"})).toBeVisible();
 await expect(page.getByRole("navigation",{name:"เมนูหลัก"})).toHaveCount(0);
 expect(organizationReads).toBe(1);
});
