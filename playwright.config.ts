import {defineConfig,devices} from "@playwright/test";

const port=4173;
const baseURL=`http://127.0.0.1:${port}`;

export default defineConfig({
 testDir:"./tests/e2e",
 timeout:20_000,
 expect:{timeout:5_000},
 fullyParallel:true,
 forbidOnly:!!process.env.CI,
 retries:process.env.CI?1:0,
 reporter:process.env.CI?"github":"list",
 use:{baseURL,trace:"retain-on-failure",screenshot:"only-on-failure"},
 projects:[
  {name:"chromium-desktop",use:{...devices["Desktop Chrome"]}},
  {name:"chromium-mobile-390",use:{...devices["Pixel 7"],viewport:{width:390,height:844}}},
  {name:"chromium-mobile-320",use:{...devices["Pixel 7"],viewport:{width:320,height:640}}},
 ],
 webServer:{
  command:`corepack pnpm --filter @apartment/web exec vite preview --host 127.0.0.1 --port ${port} --strictPort`,
  url:baseURL,
  timeout:30_000,
  reuseExistingServer:!process.env.CI,
 },
});
