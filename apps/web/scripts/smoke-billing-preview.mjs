/** Isolated browser UI test: ALL API calls are mocked. Never modifies live tenant invoices. */
import {spawn} from 'node:child_process';
import {chromium,expect} from '@playwright/test';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const project=resolve(fileURLToPath(new URL('../../../',import.meta.url)));
const server=spawn('corepack',['pnpm','--filter','@apartment/web','exec','vite','preview','--host','127.0.0.1','--port','4183','--strictPort'],{cwd:project,stdio:'ignore'});
const base='http://127.0.0.1:4183',id='00000000-0000-4000-8000-000000000001';
const room='00000000-0000-4000-8000-000000000002',org='00000000-0000-4000-8000-000000000003';
let browser;
const json=(route,payload,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(payload)});
const rows=[{id:room,number:'A101',floor:1,status:'OCCUPIED',rentOverrideSatang:null,waterOverrideSatang:null,electricOverrideSatang:null}];
const quote={room:{id:room,number:'A101'},lease:{tenantName:'ผู้เช่าทดสอบ'},periodStart:'2026-11-01',periodEnd:'2026-12-01',totalSatang:410000,lines:[
 {type:'RENT',description:'ค่าเช่าห้อง',amountSatang:400000,unitsMilli:null,tariffSatang:null},
 {type:'WATER',description:'ค่าน้ำ',amountSatang:5000,unitsMilli:5000,tariffSatang:1000,snapshot:{startAssumedZero:true}},
 {type:'ELECTRIC',description:'ค่าไฟ',amountSatang:5000,unitsMilli:10000,tariffSatang:500}]};
async function waitForServer(){for(let i=0;i<60;i++){try{if((await fetch(base)).ok)return;}catch{}await new Promise(r=>setTimeout(r,200));}throw new Error('PREVIEW_SERVER_NOT_READY');}
try{
 await waitForServer();browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1300,height:900}});
 let previews=0,issues=0,batchPreviews=0;
 await page.route('**/v1/**',async route=>{
  const url=new URL(route.request().url()),path=url.pathname;
  if(path==='/v1/me')return json(route,{id:'user',name:'Admin Test',role:'SUPER_ADMIN',memberships:[]});
  if(path==='/v1/organizations')return json(route,[{id:org,name:'หอพักทดสอบ'}]);
  if(path===`/v1/organizations/${org}/properties`)return json(route,[{id,name:'หอพักทดสอบ',cadence:'MONTHLY',dueDays:7}]);
  if(path===`/v1/properties/${id}/rooms`)return json(route,rows);
  if(path===`/v1/properties/${id}/overview`)return json(route,{rooms:1,occupied:1,available:0,totalBilledSatang:0,issuedInvoices:0,manuallyApprovedSatang:0,outstandingSatang:0,overdueSatang:0,overdueInvoiceCount:0});
  if(path===`/v1/properties/${id}/bills/preview`){previews++;return json(route,quote);}
  if(path===`/v1/properties/${id}/bills/issue`){issues++;return json(route,{invoice:{id:'fake-bill',roomId:room,amountSatang:410000}});}
  if(path===`/v1/properties/${id}/billing-batch-runs/preview`){batchPreviews++;return json(route,{id:'run-1',previewHash:'hash',status:'PREVIEWED',periodStart:'2026-11-01',periodEnd:'2026-12-01',issuedCount:0,createdAt:new Date().toISOString(),completedAt:null,previewSnapshot:{start:'2026-11-01',endExclusive:'2026-12-01',rooms:[{roomId:room,roomNumber:'A101',leaseId:'lease',status:'READY',amountSatang:410000,lines:quote.lines.map(({type,description,amountSatang})=>({type,description,amountSatang})),reason:null}]}});}
  if(path==='/v1/tenant/leases')return json(route,[]);
  return json(route,[]);
 });
 page.on('dialog',dialog=>void dialog.accept());
 await page.goto(base+'/?section=billing');
 const single=page.getByRole('region',{name:'ออกใบแจ้งหนี้รายห้อง'});
 await expect(single.getByRole('button',{name:'คำนวณยอดก่อนออกบิล'})).toBeVisible();
 await expect(single.getByRole('button',{name:'ยืนยันออกบิล'})).toBeDisabled();
 await single.getByRole('button',{name:'คำนวณยอดก่อนออกบิล'}).click();
 await expect(single.getByRole('article',{name:'ตัวอย่างรายการบิลรายห้อง'})).toContainText('ค่าเช่าห้อง');
 await expect(single.getByRole('article',{name:'ตัวอย่างรายการบิลรายห้อง'})).toContainText('ค่าน้ำ');
 await expect(single.getByRole('button',{name:'ยืนยันออกบิล'})).toBeEnabled();
 await single.getByRole('textbox',{name:/หมายเหตุบนบิล/}).fill('แจ้งเตือนทดสอบ');
 await expect(single.getByRole('button',{name:'ยืนยันออกบิล'})).toBeDisabled();
 await single.getByRole('button',{name:'คำนวณยอดก่อนออกบิล'}).click();
 await single.getByRole('button',{name:'ยืนยันออกบิล'}).click();
 await expect(single.getByText(/ออกใบแจ้งหนี้สำเร็จ/)).toBeVisible();
 const bulk=page.getByRole('region',{name:'ออกบิลหลายห้อง'});
 await bulk.getByRole('button',{name:/คำนวณตัวอย่างทุกห้อง/}).click();
 await expect(bulk.getByRole('table')).toContainText('A101');
 await expect(bulk.getByRole('table')).toContainText('ค่าเช่าห้อง');
 if(previews!==2||issues!==1||batchPreviews!==1)throw new Error(`BAD_API_COUNTS ${previews}/${issues}/${batchPreviews}`);
 console.log('BILLING_BROWSER_SMOKE_PASS superadmin, single preview/confirm, stale edits, bulk preview, no real API mutations');
}finally{await browser?.close();server.kill('SIGTERM');}
