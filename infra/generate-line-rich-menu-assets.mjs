import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';

const WIDTH=2500, HEIGHT=1686;
const fontRegular=(await readFile(new URL('./line-rich-menu-fonts/NotoSansThai-Regular.ttf',import.meta.url))).toString('base64');
const fontSemibold=(await readFile(new URL('./line-rich-menu-fonts/NotoSansThai-SemiBold.ttf',import.meta.url))).toString('base64');
const fontBold=(await readFile(new URL('./line-rich-menu-fonts/NotoSansThai-Bold.ttf',import.meta.url))).toString('base64');
const templates={
 public:{title:'ยินดีต้อนรับ',subtitle:'เริ่มต้นใช้งาน Apartment ได้ง่าย ๆ',accent:'#91a8c4',items:[
  ['เข้าสู่ระบบ','SIGN IN','login'],['บริการของเรา','OUR SERVICES','home'],['คู่มือการใช้งาน','HOW IT WORKS','book'],['จัดการหอพัก','PROPERTY CARE','building'],['แจ้งปัญหา','CONTACT SUPPORT','chat'],['เกี่ยวกับเรา','ABOUT APARTMENT','info']]},
 owner:{title:'จัดการหอพักของคุณ',subtitle:'OWNER WORKSPACE · ควบคุมทุกงานในที่เดียว',accent:'#c5b994',items:[
  ['ภาพรวม','DASHBOARD','dashboard'],['ห้องพัก','ROOMS','door'],['ออกบิล','BILLING','receipt'],['ผู้เช่า','TENANTS','people'],['งานซ่อมบำรุง','MAINTENANCE','wrench'],['โปรไฟล์','MY PROFILE','profile']]},
 tenant:{title:'พื้นที่ของผู้เช่า',subtitle:'TENANT PORTAL · ข้อมูลสัญญาและค่าใช้จ่าย',accent:'#91b4aa',items:[
  ['หน้าหลัก','MY HOME','home'],['ใบแจ้งหนี้','MY INVOICES','receipt'],['การชำระเงิน','PAYMENTS','wallet'],['แจ้งซ่อม','MAINTENANCE','wrench'],['ประวัติบิล','BILL HISTORY','history'],['โปรไฟล์','MY PROFILE','profile']]},
 account:{title:'บัญชีของคุณ',subtitle:'จัดการข้อมูลและเริ่มใช้งาน Apartment',accent:'#aaa9bd',items:[
  ['โปรไฟล์','MY PROFILE','profile'],['หน้าหลัก','HOME','home'],['เชิญเข้าพัก','TENANT INVITE','invite'],['แจ้งซ่อม','MAINTENANCE','wrench'],['คู่มือ','HELP CENTER','book'],['ติดต่อเรา','CONTACT','chat']]},
 superadmin:{title:'ผู้ดูแลระบบสูงสุด',subtitle:'SUPER ADMIN · จัดการแพลตฟอร์มและสิทธิ์ผู้ดูแล',accent:'#c29298',items:[
  ['จัดการแอดมิน','ADMIN ACCESS','people'],['ภาพรวม','DASHBOARD','dashboard'],['หอพัก','PROPERTIES','building'],['ออกบิล','BILLING','receipt'],['งานซ่อม','OPERATIONS','wrench'],['โปรไฟล์','MY PROFILE','profile']]}
};
const iconPaths={
 login:'M4 13h12M11 8l5 5-5 5M19 5v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-3',
 home:'M3 11 12 4l9 7M5 10v10h14V10M9 20v-6h6v6',
 book:'M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2zM5 4v14a2 2 0 0 0 2 2M9 9h6M9 13h6',
 building:'M4 21V5l8-2v18M12 9h8v12M7 8h2M7 12h2M7 16h2M15 13h2M15 17h2M2 21h20',
 chat:'M4 5h16v12H9l-5 4zM8 9h8M8 13h5',
 info:'M12 16v-4M12 8h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
 dashboard:'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
 door:'M6 21V4l12-2v19M3 21h18M14 12h.01',
 receipt:'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3',
 people:'M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M20 8v6M23 11h-6',
 wrench:'M14 7a5 5 0 0 0-6.8 6.8L3 19l2 2 5.2-4.2A5 5 0 0 0 17 10l-3 3-3-3z',
 profile:'M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10',
 wallet:'M4 6h16v14H4zM4 6l2-3h12M15 13h5M16 13h.01',
 history:'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l4 2',
 invite:'M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M19 8v6M16 11h6'
};
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function render(kind,t){
 const colors=['#91a8c4','#a09db4','#8eaaa9','#93aa9a','#b0a48d','#ab9199'];
 const tiles=t.items.map(([label,caption,icon],i)=>{
  const col=i%3,row=Math.floor(i/3),x=64+col*812,y=354+row*650,w=748,h=596;
  const c=colors[i];
  return `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="38" fill="#121d35" stroke="#273957" stroke-width="3"/><rect x="${x}" y="${y}" width="12" height="${h}" rx="6" fill="${c}"/><circle cx="${x+90}" cy="${y+95}" r="54" fill="${c}" fill-opacity=".15"/><path d="${iconPaths[icon]}" transform="translate(${x+67} ${y+70}) scale(1.9)" fill="none" stroke="${c}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/><text x="${x+70}" y="${y+330}" fill="#f6f8ff" font-size="62" font-weight="700">${esc(label)}</text><text x="${x+72}" y="${y+395}" fill="#a8b7d1" font-size="31" font-weight="600" letter-spacing="2">${esc(caption)}</text><path d="M${x+72} ${y+470}h140" stroke="${c}" stroke-width="7" stroke-linecap="round" opacity=".8"/><path d="M${x+w-100} ${y+h-70}h30m-12-12 12 12-12 12" fill="none" stroke="#8191aa" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></g>`;
 }).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#0b1221"/><stop offset="1" stop-color="#101d34"/></linearGradient><linearGradient id="hero" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#172645"/><stop offset="1" stop-color="#111c31"/></linearGradient><radialGradient id="glow"><stop stop-color="${t.accent}" stop-opacity=".26"/><stop offset="1" stop-color="${t.accent}" stop-opacity="0"/></radialGradient><style>@font-face{font-family:NotoThai;src:url(data:font/ttf;base64,${fontRegular})} @font-face{font-family:NotoThai;src:url(data:font/ttf;base64,${fontSemibold});font-weight:600} @font-face{font-family:NotoThai;src:url(data:font/ttf;base64,${fontBold});font-weight:700}</style></defs><rect width="2500" height="1686" fill="url(#bg)"/><circle cx="2240" cy="-20" r="570" fill="url(#glow)"/><rect x="64" y="48" width="2372" height="262" rx="42" fill="url(#hero)" stroke="#273957" stroke-width="3"/><rect x="64" y="48" width="12" height="262" rx="6" fill="${t.accent}"/><text x="120" y="123" fill="${t.accent}" font-family="NotoThai, sans-serif" font-size="30" font-weight="700" letter-spacing="5">APARTMENT · LINE HOME</text><text x="120" y="212" fill="#f6f8ff" font-family="NotoThai, sans-serif" font-size="66" font-weight="700">${esc(t.title)}</text><text x="120" y="270" fill="#a8b7d1" font-family="NotoThai, sans-serif" font-size="30" font-weight="600" letter-spacing="1">${esc(t.subtitle)}</text><circle cx="2284" cy="178" r="74" fill="${t.accent}" fill-opacity=".13"/><path d="M2242 178h84M2284 136v84" stroke="${t.accent}" stroke-width="9" stroke-linecap="round"/>${tiles}</svg>`;
}
const out=new URL('../apps/api/assets/line-rich-menus/',import.meta.url);
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:WIDTH,height:HEIGHT},deviceScaleFactor:1});
 for(const [kind,t] of Object.entries(templates)){
  const svg=render(kind,t);
  await page.setContent(`<html><body style="margin:0;width:${WIDTH}px;height:${HEIGHT}px">${svg}</body></html>`,{waitUntil:'load'});
  await page.locator('svg').screenshot({path:new URL(`${kind}.png`,out).pathname});
  await writeFile(new URL(`${kind}.svg`,out),svg);
 }
}finally{await browser.close();}
