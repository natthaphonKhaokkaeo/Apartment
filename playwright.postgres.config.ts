import {defineConfig,devices} from "@playwright/test";
export default defineConfig({
 testDir:"./tests/e2e-postgres",timeout:40_000,workers:1,
 forbidOnly:!!process.env.CI,retries:0,
 use:{baseURL:"http://127.0.0.1:4174",trace:"retain-on-failure",screenshot:"only-on-failure"},
 projects:[
  {name:"postgres-desktop",use:{...devices["Desktop Chrome"]}},
  {name:"postgres-mobile-390",use:{...devices["Pixel 7"],viewport:{width:390,height:844}}},
  {name:"postgres-mobile-320",use:{...devices["Pixel 7"],viewport:{width:320,height:640}}},
 ],
 webServer:[
  {command:"corepack pnpm --filter @apartment/api start",url:"http://127.0.0.1:8088/readyz",reuseExistingServer:false,timeout:30_000},
  {command:"corepack pnpm --filter @apartment/web exec vite --host 127.0.0.1 --port 4174 --strictPort",url:"http://127.0.0.1:4174",reuseExistingServer:false,timeout:30_000},
 ],
});
