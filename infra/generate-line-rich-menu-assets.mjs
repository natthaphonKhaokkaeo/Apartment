import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';

/** LINE artwork and clickable areas share a 2500x1686 six-tile 3x2 grid. */
const WIDTH=2500,HEIGHT=1686;
const fonts={
 normal:(await readFile(new URL('./line-rich-menu-fonts/NotoSansThai-Regular.ttf',import.meta.url))).toString('base64'),
 semibold:(await readFile(new URL('./line-rich-menu-fonts/NotoSansThai-SemiBold.ttf',import.meta.url))).toString('base64'),
 bold:(await readFile(new URL('./line-rich-menu-fonts/NotoSansThai-Bold.ttf',import.meta.url))).toString('base64')
};
// One restrained pastel accent per role; dark readable typography, no gradients or neon.
const roles={
 public:{title:'ยินดีต้อนรับสู่ ApartMe',tag:'เริ่มต้นใช้งาน',desc:'เรื่องหอพัก จัดการได้ง่ายในที่เดียว',accent:'#D9E6EE',tint:'#F2F6F8',items:[
  ['เริ่มใช้งาน','เข้าสู่ระบบ','login'],['รู้จัก ApartMe','จัดการหอพักง่าย ๆ','home'],['โปรไฟล์','ข้อมูลของคุณ','profile'],
  ['ดูระบบหอพัก','สำหรับเจ้าของ','building'],['สำหรับผู้เช่า','ดูข้อมูลการเข้าพัก','door'],['ติดต่อเรา','ช่องทางช่วยเหลือ','chat']]},
 owner:{title:'จัดการหอพักของคุณ',tag:'เจ้าของหอพัก',desc:'ห้องพัก • ออกบิล • รายรับ ครบในที่เดียว',accent:'#D6E8E3',tint:'#F1F8F6',items:[
  ['ภาพรวม','ดูสถานะหอพัก','dashboard'],['ห้องพัก','จัดการห้อง','door'],['ออกบิล','เรียกเก็บรายเดือน','receipt'],
  ['รายงานบิล','ดูข้อมูลรายห้อง','history'],['รับชำระ','ตรวจสอบยอดเงิน','wallet'],['โปรไฟล์','บัญชีของฉัน','profile']]},
 tenant:{title:'สวัสดีผู้พักอาศัย',tag:'ผู้เช่า',desc:'ตรวจบิล ชำระเงิน แจ้งซ่อม ได้ง่าย',accent:'#DBE5F1',tint:'#F2F6FA',items:[
  ['หน้าหลัก','ข้อมูลการเข้าพัก','home'],['ใบแจ้งหนี้','ดูบิลของฉัน','receipt'],['การชำระเงิน','ตรวจยอดและแจ้งชำระ','wallet'],
  ['แจ้งซ่อม','แจ้งปัญหาห้องพัก','wrench'],['ประวัติบิล','บิลย้อนหลัง','history'],['โปรไฟล์','ข้อมูลของฉัน','profile']]},
 account:{title:'บัญชี ApartMe ของคุณ',tag:'บัญชีผู้ใช้',desc:'เริ่มต้นจัดการข้อมูลของคุณ',accent:'#EEE2D9',tint:'#FAF6F2',items:[
  ['หน้าหลัก','เข้าสู่ระบบ ApartMe','home'],['โปรไฟล์','ข้อมูลส่วนตัว','profile'],['เชิญเข้าพัก','เชื่อมบัญชีผู้เช่า','invite'],
  ['รายการบิล','ดูบิลเมื่อเชื่อมสิทธิ์','receipt'],['แจ้งซ่อม','ใช้งานเมื่อมีสิทธิ์','wrench'],['ติดต่อเรา','ข้อมูลช่วยเหลือ','chat']]},
 staff:{title:'งานดูแลหอพัก',tag:'ทีมงานหอพัก',desc:'จัดการห้องและมิเตอร์ ตามสิทธิ์ที่ได้รับ',accent:'#E7E1EE',tint:'#F7F4FA',items:[
  ['ห้องพัก','ตรวจสถานะห้อง','door'],['จดมิเตอร์','น้ำและไฟ','gauge'],['หลักฐานมิเตอร์','รูปถ่ายประกอบ','image'],
  ['งานของฉัน','รายการห้องที่ดูแล','dashboard'],['คู่มือห้องพัก','ดูรายการและข้อมูล','book'],['โปรไฟล์','บัญชีของฉัน','profile']]},
 superadmin:{title:'ศูนย์จัดการ ApartMe',tag:'ผู้ดูแลระบบ',desc:'ดูแลแพลตฟอร์มและสิทธิ์ผู้ใช้งาน',accent:'#E8DFEB',tint:'#F7F3F8',items:[
  ['จัดการระบบ','บัญชีและสิทธิ์','settings'],['ภาพรวม','ข้อมูลแพลตฟอร์ม','dashboard'],['หอพัก','ตรวจสอบข้อมูล','building'],
  ['แจ้งเตือน','เหตุการณ์ในระบบ','bell'],['งานซ่อม','ติดตามการดำเนินงาน','wrench'],['โปรไฟล์','บัญชีแอดมิน','profile']]}
};
const iconPaths={
 login:'M4 13h12M11 8l5 5-5 5M19 5v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-3',
 home:'M3 11 12 4l9 7M5 10v10h14V10M9 20v-6h6v6',
 book:'M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2zM5 4v14a2 2 0 0 0 2 2M9 9h6M9 13h6',
 building:'M4 21V5l8-2v18M12 9h8v12M7 8h2M7 12h2M7 16h2M15 13h2M15 17h2M2 21h20',
 chat:'M4 5h16v12H9l-5 4zM8 9h8M8 13h5',
 dashboard:'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
 door:'M6 21V4l12-2v19M3 21h18M14 12h.01',
 receipt:'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3',
 wrench:'M14 7a5 5 0 0 0-6.8 6.8L3 19l2 2 5.2-4.2A5 5 0 0 0 17 10l-3 3-3-3z',
 profile:'M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10',
 wallet:'M4 6h16v14H4zM4 6l2-3h12M15 13h5M16 13h.01',
 history:'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l4 2',
 invite:'M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M19 8v6M16 11h6',
 gauge:'M4 16a9 9 0 1 1 16 0M12 16l4-5M9 20h6',
 image:'M4 4h16v16H4zM7 15l4-4 3 3 3-4 3 4M9 9h.01',
 settings:'M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
 bell:'M18 8a6 6 0 0 0-12 0c0 7-3 8-3 9h18c0-1-3-2-3-9M10 21h4'
};
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const ICON='#41566A', TEXT='#253B4A', SUB='#637585';
function tile(item,i,role){
 const [label,subtitle,icon]=item,x=64+(i%3)*812,y=354+Math.floor(i/3)*650,w=748,h=596;
 return `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="40" fill="#FFFFFF" stroke="#DDE6E7" stroke-width="3"/>
 <rect x="${x+40}" y="${y+42}" width="174" height="174" rx="43" fill="${role.accent}"/>
 <path d="${iconPaths[icon]}" transform="translate(${x+79} ${y+79}) scale(4)" fill="none" stroke="${ICON}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
 <text x="${x+53}" y="${y+332}" fill="${TEXT}" font-size="60" font-weight="700">${escape(label)}</text>
 <text x="${x+53}" y="${y+398}" fill="${SUB}" font-size="31" font-weight="400">${escape(subtitle)}</text>
 <path d="M${x+52} ${y+495}h${w-104}" stroke="#E5EAEC" stroke-width="2"/>
 <text x="${x+57}" y="${y+549}" fill="#82939B" font-size="24" font-weight="600">APARTME</text>
 <path d="M${x+w-103} ${y+h-64}h27m-11-12 12 12-12 12" fill="none" stroke="#7B8A96" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></g>`;
}
function render(kind,role){
 const cards=role.items.map((item,i)=>tile(item,i,role)).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
 <defs><style>
 @font-face{font-family:NotoThai;src:url(data:font/ttf;base64,${fonts.normal})}
 @font-face{font-family:NotoThai;src:url(data:font/ttf;base64,${fonts.semibold});font-weight:600}
 @font-face{font-family:NotoThai;src:url(data:font/ttf;base64,${fonts.bold});font-weight:700}
 text{font-family:NotoThai,sans-serif}
 </style></defs>
 <rect width="2500" height="1686" fill="#F7F9F8"/>
 <rect x="64" y="48" width="2372" height="262" rx="42" fill="${role.tint}" stroke="#DEE7E7" stroke-width="3"/>
 <rect x="111" y="87" width="17" height="34" rx="7" fill="${ICON}"/>
 <text x="154" y="122" font-size="42" font-weight="700" fill="${TEXT}">ApartMe</text>
 <text x="355" y="118" font-size="25" fill="${SUB}">ระบบจัดการหอพัก</text>
 <text x="115" y="217" font-size="70" font-weight="700" fill="${TEXT}">${escape(role.title)}</text>
 <text x="121" y="270" font-size="30" fill="${SUB}">${escape(role.desc)}</text>
 <rect x="2044" y="99" width="318" height="112" rx="38" fill="${role.accent}"/>
 <text x="2203" y="165" text-anchor="middle" font-size="39" font-weight="700" fill="${TEXT}">${escape(role.tag)}</text>
 ${cards}</svg>`;
}
const out=new URL('../apps/api/assets/line-rich-menus/',import.meta.url);
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:WIDTH,height:HEIGHT},deviceScaleFactor:1});
 for(const [kind,role] of Object.entries(roles)){
  const svg=render(kind,role);
  await page.setContent(`<html><body style="margin:0;width:${WIDTH}px;height:${HEIGHT}px">${svg}</body></html>`,{waitUntil:'load'});
  await page.evaluate(()=>document.fonts.ready);
  await page.locator('svg').screenshot({path:new URL(`${kind}.png`,out).pathname});
  await writeFile(new URL(`${kind}.svg`,out),svg);
  console.log(`APARTME_PASTEL_RICH_MENU ${kind}: ${role.items.length} tiles`);
 }
}finally{await browser.close();}
