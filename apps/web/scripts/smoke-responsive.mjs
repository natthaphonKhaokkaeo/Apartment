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
 const mockApi=async route=>{
  const url=new URL(route.request().url()),path=url.pathname;
  if(path==='/v1/me')return json(route,{id:'user',name:'Admin Test',role:'SUPER_ADMIN',memberships:[]});
  if(path==='/v1/organizations')return json(route,[{id:org,name:'หอพักทดสอบ'}]);
  if(path===`/v1/organizations/${org}/properties`)return json(route,[{id,name:'หอพักทดสอบ',cadence:'MONTHLY',dueDays:7,rentSatang:400000,waterSatangPerUnit:1000,electricSatangPerUnit:500,complianceReviewedAt:new Date().toISOString()}]);
  if(path===`/v1/properties/${id}/rooms`)return json(route,rows);
  if(path===`/v1/properties/${id}/overview`)return json(route,{rooms:1,occupied:1,available:0,totalBilledSatang:0,issuedInvoices:0,manuallyApprovedSatang:0,outstandingSatang:0,overdueSatang:0,overdueInvoiceCount:0});
  if(path===`/v1/properties/${id}/bills/preview`){previews++;return json(route,quote);}
  if(path===`/v1/properties/${id}/bills/issue`){issues++;return json(route,{invoice:{id:'fake-bill',roomId:room,amountSatang:410000}});}
  if(path===`/v1/properties/${id}/billing-batch-runs/preview`){batchPreviews++;return json(route,{id:'run-1',previewHash:'hash',status:'PREVIEWED',periodStart:'2026-11-01',periodEnd:'2026-12-01',issuedCount:0,createdAt:new Date().toISOString(),completedAt:null,previewSnapshot:{start:'2026-11-01',endExclusive:'2026-12-01',rooms:[{roomId:room,roomNumber:'A101',leaseId:'lease',status:'READY',amountSatang:410000,lines:quote.lines.map(({type,description,amountSatang})=>({type,description,amountSatang})),reason:null}]}});}
  if(path.endsWith('/occupancy-report'))return json(route,{propertyId:id,totalRooms:1,occupiedRooms:1,availableRooms:0,maintenanceRooms:0,occupancyPercent:100,activeLeaseCount:1,occupiedWithoutActiveLease:0,activeLeaseInNonOccupiedRoom:0,roomsWithMultipleActiveLeases:0});
  if(path.endsWith('/financial-report'))return json(route,{totals:{invoiceCount:1,totalBilledSatang:410000,grossManualApprovedSatang:0,netManualApprovedSatang:0,internalCreditSatang:0,outstandingSatang:410000}});
  if(path.endsWith('/admin/line-operations/overview'))return json(route,{counts:{QUEUED:0,SENDING:0,RETRY:0,ACCEPTED:1,SIMULATED:0,DEAD:0},quotaWindowUsed:0,quotaPerMinute:100,unreviewedDeadCount:0,expiredSendingLeaseCount:0,oldestActiveAgeSeconds:null,oldestUnreviewedDeadAgeSeconds:null,checkedAt:new Date().toISOString(),notice:'ทดสอบหน้าจอ'});
  if(path.endsWith('/meter-records'))return json(route,{readings:[]});
  if(path.includes('/invoice-room-report'))return json(route,{items:[{id:'invoice-demo',roomId:room,roomNumber:'A101',tenantName:'ผู้เช่าตัวอย่างชื่อยาวเพื่อทดสอบข้อความและการแสดงบนมือถือ',periodStart:'2026-11-01',periodEnd:'2026-12-01',dueDate:'2026-12-07',amountSatang:410000,paidSatang:0,creditSatang:0,outstandingSatang:410000,status:'ISSUED',voidReason:null,replacesInvoiceId:null,createdAt:new Date().toISOString()}],limited:false,summary:{invoiceCount:1,billedSatang:410000,paidSatang:0,outstandingSatang:410000}});
  if(path==='/v1/notifications')return json(route,{items:[{id:'notice-a',kind:'INVOICE_ISSUED',title:'แจ้งเตือนออกใบแจ้งหนี้และข้อความที่ยาวสำหรับหอพักทดสอบการแสดงผลทุกขนาดหน้าจอ',body:'รายการแจ้งเตือนตัวอย่างสำหรับทดสอบ Responsive Layout บนจอมือถือและแท็บเล็ตที่แคบมาก โปรดตรวจสอบรายละเอียดก่อนดำเนินการ',readAt:null,createdAt:new Date().toISOString()}]});
  if(path.includes('/privacy/requests'))return json(route,{requests:[],executionEnabled:false});
  if(path==='/v1/admin/platform-users')return json(route,[{id:'user-example',displayName:'ทดสอบบัญชีผู้ดูแลระบบชื่อยาวเพื่อทดสอบการแสดงผลแนวนอนบนมือถือ',platformRole:'SUPER_ADMIN',status:'ACTIVE',createdAt:new Date().toISOString()}]);
  if(path===`/v1/properties/${id}/billing-batch-runs/run-1/approve`)return json(route,{run:{id:'run-1',previewHash:'hash',status:'COMPLETED',periodStart:'2026-11-01',periodEnd:'2026-12-01',issuedCount:1,createdAt:new Date().toISOString(),completedAt:new Date().toISOString(),previewSnapshot:{start:'2026-11-01',endExclusive:'2026-12-01',rooms:[{roomId:room,roomNumber:'A101',leaseId:'lease',status:'READY',amountSatang:410000,lines:quote.lines.map(({type,description,amountSatang})=>({type,description,amountSatang})),reason:null}]}},replayed:false});
  if(path==='/v1/tenant/leases')return json(route,[{leaseId:'lease-demo',tenantName:'ผู้เช่าทดสอบ',roomNumber:'A101',propertyName:'หอพักตัวอย่าง',propertyAddress:'ที่อยู่ทดสอบ',startDate:'2026-11-01',endDate:null}]);
  return json(route,[]);
 };
 await page.route('**/v1/**',mockApi);
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
 // Regression: approving a prepared batch must be reachable in narrow viewports.
 const viewports=[320,360,375,390,430,600,768,820,1024,1440];
 for(const width of viewports){
  await page.setViewportSize({width,height:900});
  const action=bulk.getByRole('button',{name:'อนุมัติและออกทั้งชุด'});
  await expect(action).toBeVisible();
  const box=await action.boundingBox();
  if(!box||box.x<0||box.x+box.width>width+1)throw new Error(`BULK_APPROVAL_OFF_SCREEN width=${width} rect=${JSON.stringify(box)}`);
  const documentWidth=await page.evaluate(()=>document.documentElement.scrollWidth);
  if(documentWidth>width+1)throw new Error(`BULK_DOCUMENT_OVERFLOW width=${width} document=${documentWidth}`);
  if(width<=430){
   const table=await bulk.locator('.table-scroll').evaluate(el=>({container:el.clientWidth,content:el.scrollWidth,overflow:getComputedStyle(el).overflowX}));
   if(table.container>=table.content||table.overflow!=='auto')throw new Error(`BULK_TABLE_SHOULD_SCROLL_LOCALLY ${width} ${JSON.stringify(table)}`);
  }
 }
 // Approval is mocked; never creates a real invoice.
 await page.setViewportSize({width:320,height:900});
 await bulk.getByRole('button',{name:'อนุมัติและออกทั้งชุด'}).click();
 await expect(bulk.getByText('ออกใบแจ้งหนี้ครบชุดแล้ว')).toBeVisible();

 // Cover every main navigation view with long fixture text and representative records.
 const sections=['overview','rooms','meter','billing','reports','payments','maintenance',
  'invites','staff','settings','notifications','profile','tenant','admin'];
 const pageErrors=[];
 let currentSection='billing';
 page.on('pageerror',err=>pageErrors.push(`${currentSection}: ${err.message}`));
 for(const section of sections){
  currentSection=section;
  await page.goto(`${base}/?section=${section}`);
  const titles={overview:'ภาพรวม',rooms:'ห้องพัก',meter:'จดมิเตอร์',billing:'ออกบิล',
   reports:'รายงานบิลรายห้อง',payments:'รับชำระเงิน',maintenance:'ซ่อมบำรุง',invites:'เชิญผู้เช่า',
   staff:'จัดการพนักงาน',settings:'ตั้งค่า',notifications:'แจ้งเตือน',profile:'โปรไฟล์',
   tenant:'สำหรับผู้เช่า',admin:'Super Admin'};
  await expect(page.locator('.topbar h1')).toHaveText(titles[section]);
  await page.waitForTimeout(180);
  for(const width of viewports){
   await page.setViewportSize({width,height:900});
   const status=await page.evaluate(()=>{
    const overflow=[...document.querySelectorAll('main *')].filter(el=>{
     const r=el.getBoundingClientRect(),style=getComputedStyle(el);
     if(r.width<=0||r.height<=0||style.visibility==='hidden'||style.display==='none'||r.right<=innerWidth+1)return false;
     let ancestor=el.parentElement;
     while(ancestor){if(/auto|scroll|clip|hidden/.test(getComputedStyle(ancestor).overflowX))return false;ancestor=ancestor.parentElement;}
     return true;
    }).slice(0,5).map(el=>`${el.tagName}.${String(el.className).slice(0,45)}`);
    return {root:document.documentElement.scrollWidth,viewport:innerWidth,overflow};
   });
   if(status.root>width+1||status.overflow.length)throw new Error(`RESPONSIVE_OVERFLOW section=${section} width=${width} ${JSON.stringify(status)}`);
  }
 }
 if(pageErrors.length)throw new Error(`RESPONSIVE_RENDER_ERRORS ${pageErrors.join(' | ')}`);
 // Check the overlay menu remains within the mobile screen and can be closed.
 await page.setViewportSize({width:320,height:900});
 await page.goto(`${base}/?section=billing`);
 const menu=page.getByRole('button',{name:'เมนู',exact:true});
 await menu.click();
 const sidebar=page.locator('.sidebar.expanded');
 await expect(sidebar).toBeVisible();
 await expect.poll(async()=>{
  const b=await sidebar.boundingBox();
  return b?b.x:undefined;
 }).toBe(0);
 const sidebarBox=await sidebar.boundingBox();
 if(!sidebarBox||sidebarBox.x+sidebarBox.width>321)throw new Error('MOBILE_SIDEBAR_OFF_SCREEN');
 await sidebar.getByRole('button',{name:'ปิดเมนู'}).click();
 await expect(page.locator('.sidebar.expanded')).toHaveCount(0);
 await menu.click();
 await expect(page.locator('.sidebar.expanded')).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.locator('.sidebar.expanded')).toHaveCount(0);
 // Mobile-device emulation (touch + device viewport), not just desktop resizing.
 const mobileContext=await browser.newContext({viewport:{width:375,height:812},isMobile:true,hasTouch:true,deviceScaleFactor:2});
 try{
  const mobile=await mobileContext.newPage();
  await mobile.route('**/v1/**',mockApi);
  mobile.on('dialog',dialog=>void dialog.accept());
  await mobile.goto(`${base}/?section=billing`);
  await expect(mobile.getByRole('region',{name:'ออกบิลหลายห้อง'})).toBeVisible();
  await mobile.getByRole('region',{name:'ออกบิลหลายห้อง'}).getByRole('button',{name:/คำนวณตัวอย่างทุกห้อง/}).tap();
  const mobileApprove=mobile.getByRole('button',{name:'อนุมัติและออกทั้งชุด'});
  await expect(mobileApprove).toBeVisible();
  const mobileBounds=await mobileApprove.boundingBox();
  if(!mobileBounds||mobileBounds.x<0||mobileBounds.x+mobileBounds.width>375)throw new Error('TOUCH_MOBILE_APPROVE_OFFSCREEN');
  const mobileRoot=await mobile.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
  if(mobileRoot.width!==375||mobileRoot.scrollWidth>375)throw new Error('TOUCH_MOBILE_DOCUMENT_OVERFLOW '+JSON.stringify(mobileRoot));
  await mobileApprove.tap();
  await expect(mobile.getByText('ออกใบแจ้งหนี้ครบชุดแล้ว')).toBeVisible();
 }finally{await mobileContext.close();}
 console.log(`RESPONSIVE_BROWSER_SMOKE_PASS ${viewports.length} viewports × ${sections.length} sections; touch-mobile batch approve, local tables, sidebar close/Escape; mocked APIs only`);
}finally{await browser?.close();server.kill('SIGTERM');}
