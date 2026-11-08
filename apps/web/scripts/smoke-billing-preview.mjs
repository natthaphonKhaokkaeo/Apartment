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
 let previews=0,issues=0,batchPreviews=0,meterUpdates=0,savedMeter=null;
 await page.route('**/v1/**',async route=>{
  const url=new URL(route.request().url()),path=url.pathname;
  if(path==='/v1/me')return json(route,{id:'user',name:'Admin Test',role:'SUPER_ADMIN',memberships:[]});
  if(path==='/v1/organizations')return json(route,[{id:org,name:'หอพักทดสอบ'}]);
  if(path===`/v1/organizations/${org}/properties`)return json(route,[{id,name:'หอพักทดสอบ',cadence:'MONTHLY',dueDays:7}]);
  if(path===`/v1/properties/${id}/rooms`)return json(route,rows);
  if(path.includes('/meter-records'))return json(route,{readings:[]});
  if(path===`/v1/properties/${id}/readings`&&route.request().method()==="GET")return json(route,savedMeter?[savedMeter]:[]);
  if(path===`/v1/properties/${id}/readings`&&route.request().method()==="POST"){
   const body=route.request().postDataJSON();
   if(body.month!=="2026-10"||body.readAt!==undefined||!["85.000","83.000"].includes(body.value))
    throw new Error("INVALID_MONTH_METER_PAYLOAD "+JSON.stringify(body));
   meterUpdates++;
   savedMeter={id:"meter-demo",roomId:room,kind:body.kind,readAt:"2026-11-01",value:body.value,createdAt:new Date().toISOString()};
   return json(route,savedMeter,meterUpdates===1?201:200);
  }
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
 // Editing a prior month's meter directly from Billing invalidates the active batch preview.
 const editor=page.getByRole('region',{name:'แก้ไขเลขมิเตอร์รายเดือนก่อนออกบิล'});
 await editor.getByLabel('รอบเดือน',{exact:true}).fill('2026-10');
 await editor.getByLabel('เลขสะสมปิดรอบเดือน').fill('85.000');
 await editor.getByRole('button',{name:'บันทึก / แก้ไขเลขมิเตอร์เดือนนี้'}).click();
 await expect(editor.getByText(/บันทึกเลขน้ำรอบ 2026-10 เรียบร้อย/)).toBeVisible();
 await expect(bulk.getByRole('button',{name:'อนุมัติและออกทั้งชุด'})).toHaveCount(0);
 await expect(single.getByRole('button',{name:'ยืนยันออกบิล'})).toBeDisabled();
 await expect(editor.getByLabel('เลขสะสมปิดรอบเดือน')).toHaveValue('85.000');
 await editor.getByLabel('เลขสะสมปิดรอบเดือน').fill('83.000');
 await editor.getByRole('button',{name:'บันทึก / แก้ไขเลขมิเตอร์เดือนนี้'}).click();
 await expect(editor.getByLabel('เลขสะสมปิดรอบเดือน')).toHaveValue('83.000');
 if(previews!==2||issues!==1||batchPreviews!==1||meterUpdates!==2)
  throw new Error(`BAD_API_COUNTS ${previews}/${issues}/${batchPreviews}/${meterUpdates}`);
 // Semi-monthly: select month + cycle (no manually-entered date) and send the correct boundary.
 await page.route(`**/v1/organizations/${org}/properties`,route=>{return json(route,[{
  id,name:'หอพักทดสอบงวดละ 15 วัน',cadence:'SEMI_MONTHLY',rollingAnchor:null,dueDays:7
 }]);});
 let semiSubmitted=false;
 await page.route(`**/v1/properties/${id}/readings`,route=>{
  if(route.request().method()==='GET')return json(route,[]);
  const b=route.request().postDataJSON();
  if(b.month!=='2026-11'||b.periodEndExclusive!=='2026-11-16'||b.value!=='42.000')
   throw new Error('INVALID_HALF_MONTH_PAYLOAD '+JSON.stringify(b));
  semiSubmitted=true;
  return json(route,{id:'semi',roomId:room,kind:'WATER',value:'42.000',readAt:'2026-11-16'},201);
 });
 await page.goto(base+'/?section=meter');
 const meterPage=page.getByRole('region',{name:'แก้ไขเลขมิเตอร์รายเดือนก่อนออกบิล'});
 await meterPage.getByLabel('รอบเดือน',{exact:true}).fill('2026-11');
 await expect(meterPage.locator('label.field').filter({hasText:'งวดบิลภายในเดือน'}).locator('select')).toHaveCount(1);


 await meterPage.getByLabel('เลขสะสมปิดรอบเดือน').fill('42.000');
 await meterPage.getByRole('button',{name:'บันทึก / แก้ไขเลขมิเตอร์เดือนนี้'}).click();
 await expect(meterPage.getByText(/บันทึกเลขน้ำรอบ 2026-11 เรียบร้อย/)).toBeVisible();
 if(!semiSubmitted)throw new Error('HALF_MONTH_METER_NOT_SUBMITTED');
 // A vacant room with NO contract can preview and issue its room-scoped bill.
 await page.route(`**/v1/organizations/${org}/properties`,route=>json(route,[{
  id,name:'หอพักไม่มีสัญญา',cadence:'MONTHLY',dueDays:7
 }]));
 await page.route(`**/v1/properties/${id}/rooms`,route=>json(route,[{...rows[0],status:'AVAILABLE'}]));
 await page.route(`**/v1/properties/${id}/bills/preview`,route=>json(route,{...quote,lease:null}));
 await page.goto(base+'/?section=billing');
 const noLease=page.getByRole('region',{name:'ออกใบแจ้งหนี้รายห้อง'});
 await expect(noLease.getByRole('option',{name:'A101'})).toHaveCount(1);
 await noLease.getByRole('button',{name:'คำนวณยอดก่อนออกบิล'}).click();
 await expect(noLease.getByRole('article',{name:'ตัวอย่างรายการบิลรายห้อง'})).toContainText('ไม่ระบุผู้เช่า');
 await expect(noLease.getByRole('button',{name:'ยืนยันออกบิล'})).toBeEnabled();
 await noLease.getByRole('button',{name:'ยืนยันออกบิล'}).click();
 await expect(noLease.getByText(/ออกใบแจ้งหนี้สำเร็จ/)).toBeVisible();
 console.log('BILLING_BROWSER_SMOKE_PASS single/bulk, past-month/half-month meter, no-lease vacant-room billing; mocked API');
}finally{await browser?.close();server.kill('SIGTERM');}
