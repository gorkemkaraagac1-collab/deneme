'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const src=fs.readFileSync(path.join(__dirname,'../js/lq-contract-view.js'),'utf8');
const engineHtml=`<div class="gk-v26-auto-detect">STD</div><div class="banner">uyarı</div><div class="gk-detail-tabs">${['summary','schedule','modification','slb','sublease','accounting','audit'].map(t=>`<button class="gk-detail-tab-btn" data-detail-tab-target="${t}">${t}</button>`).join('')}</div>${['summary','schedule','modification','slb','sublease','accounting','audit'].map(t=>`<div class="gk-detail-tab" data-detail-tab="${t}">${t==='audit'?'<div data-authoritative-report-audit></div>':t}</div>`).join('')}`;
async function page(ui='2'){
 const dom=new JSDOM(`<!doctype html><html data-lq-ui="${ui}"><body><div id="detailModal" class="modal-overlay"><div id="detailContent"></div></div><button id="deleteContract"></button></body></html>`,{url:'https://leaseqant.com/tfrs16.html',runScripts:'outside-only'});
 const w=dom.window,d=w.document;const clicked=[];
 w.GK_TFRS16={getSelectedContractId:()=>'K1',getPortfolioContracts:()=>[{id:'K1',company:'Örnek',supplier:'Kiraya A.Ş.',startDate:'2024-01-01',endDate:'2030-12-31',discountRate:18.5,monthlyPayment:125000,currency:'TRY',status:'active',paymentFrequency:'monthly',paymentTiming:'arrears'}]};
 w.LeaseQantReportingAuthorityUi={defaultPeriod:()=>({periodStart:'2026-08-01',periodEnd:'2026-08-31',reportingDate:'2026-08-31'}),rawRows:()=>[{timestamp:'2026-08-02T10:00:00',action:'CONTRACT_UPDATED',actor:'admin'}],serialize:()=>'a;b'};
 w.eval(src);if(d.readyState==='loading')await new Promise(r=>d.addEventListener('DOMContentLoaded',r,{once:true}));
 d.getElementById('detailContent').addEventListener('click',e=>{const b=e.target.closest('.gk-detail-tab-btn');if(b)clicked.push(b.dataset.detailTabTarget);});
 return {dom,w,d,clicked};
}
const tick=(ms=5)=>new Promise(r=>setTimeout(r,ms));
test('schedule model groups by year, tags current/projected rows and counts remaining without totals',async()=>{
 const {dom,w}=await page('legacy');const {scheduleModel,monthsBetween}=w.LeaseQantContractView;
 const rows=['2025-12-31','2026-07-31','2026-08-31','2026-09-30','2027-01-31'].map((date,i)=>({date,openingLiability:100-i,closingLiability:99-i,interest:1,payment:2,principal:1,depreciation:1}));
 const m=scheduleModel(rows,{periodStart:'2026-08-01',periodEnd:'2026-08-31'});
 assert.equal(m.groups.map(g=>g.year).join(','),'2025,2026,2027');
 assert.equal(m.groups[1].open,true);assert.equal(m.groups[1].items.map(i=>i.tag).join(','),'past,cur,proj');
 assert.equal(m.groups[2].projected,true);assert.equal(m.remaining,2);assert.equal(m.total,5);assert.equal(m.initialLiability,100);
 assert.equal(m.groups[1].opening,99);assert.equal(m.groups[1].closing,96);
 assert.equal(monthsBetween('2024-01-01','2030-12-31'),84);assert.equal(monthsBetween('2025-02-28','2030-02-28'),61);
 dom.window.close();
});
test('engine detail is wrapped in the designed page; engine tabs are driven, not replaced',async()=>{
 const {dom,w,d,clicked}=await page();
 const content=d.getElementById('detailContent');content.innerHTML=engineHtml;await tick();
 const shell=content.querySelector(':scope > .lq-cv-shell');assert.ok(shell);
 assert.equal(shell.getAttribute('data-tab'),'calc');
 assert.ok(shell.querySelector('.lq-cv-slot-std .gk-v26-auto-detect'),'standards panel moved to side column');
 assert.ok(shell.querySelector('.lq-cv-notices .banner'),'engine notices kept');
 assert.equal(shell.querySelectorAll('.lq-cv-engine .gk-detail-tab').length,7);
 assert.match(shell.querySelector('.lq-cv-h1').textContent,/Kiraya A\.Ş\./);
 shell.querySelector('[data-lq-cv-tab="events"]').click();assert.equal(clicked.pop(),'modification');
 shell.querySelector('[data-lq-cv-sub="slb"]').click();assert.equal(clicked.pop(),'slb');
 shell.querySelector('[data-lq-cv-tab="accounting"]').click();assert.equal(clicked.pop(),'accounting');
 dom.window.close();
});
test('server report fills KPIs and calculation rows; unsupported route explains itself',async()=>{
 const {dom,w,d}=await page();
 const content=d.getElementById('detailContent');content.innerHTML=engineHtml;await tick();
 const m=v=>({value:v,status:'SUPPORTED',currency:'TRY'});
 const rows=['2026-07-31','2026-08-31','2026-09-30'].map((date,i)=>({date,openingLiability:1000-i*10,closingLiability:990-i*10,interest:5,payment:15,principal:10,depreciation:7}));
 w.dispatchEvent(new w.CustomEvent('lq:contract-report',{detail:{contractId:'K1',package:{period:{periodStart:'2026-08-01',periodEnd:'2026-08-31',reportingDate:'2026-08-31'}},row:{status:'SUPPORTED',currency:'TRY',sourceResultHash:'abcdef123456',metrics:{leaseLiability:m(980),currentLiability:m(100),nonCurrentLiability:m(880),rouCarryingAmount:m(900),periodDepreciation:m(7),periodInterest:m(5),contractualPayments:m(15)},scheduleRows:rows}}}));
 const shell=content.querySelector('.lq-cv-shell');
 assert.match(shell.querySelector('.lq-cv-kpis').textContent,/980,00/);
 assert.match(shell.querySelector('.lq-cv-kpis').textContent,/1 \/ 3/);
 assert.equal(shell.querySelectorAll('.lq-cv-trow.is-cur').length,1);
 assert.match(shell.querySelector('.lq-cv-trow.is-cur').textContent,/\(15,00\)/);
 assert.match(content.querySelector('[data-authoritative-report-audit]').textContent,/CONTRACT_UPDATED/);
 w.dispatchEvent(new w.CustomEvent('lq:contract-report',{detail:{contractId:'K1',package:{period:{periodStart:'2026-08-01',periodEnd:'2026-08-31',reportingDate:'2026-08-31'}},row:{status:'NOT_READY',reason:'REPORTING_ROUTE_NOT_SUPPORTED',metrics:null,scheduleRows:[]}}}));
 assert.match(shell.querySelector('.lq-cv-calc').textContent,/sertifikalı rotada değil/);
 assert.match(shell.querySelector('.lq-cv-head').textContent,/Kapsam dışı/);
 dom.window.close();
});
test('legacy UI: engine detail untouched',async()=>{
 const {dom,d}=await page('legacy');const content=d.getElementById('detailContent');content.innerHTML=engineHtml;await tick();
 assert.equal(content.querySelector('.lq-cv-shell'),null);dom.window.close();
});
