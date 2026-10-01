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
 assert.match(shell.querySelector('.lq-cv-slot-std').textContent,/onaylı dönem kanıtı gerekli/);
 assert.equal(content.querySelector('.gk-v26-auto-detect'),null,'currency-inferred engine badge removed in v2');
 assert.match(shell.querySelector('.lq-cv-head').textContent,/\(84 ay\)/);
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
 assert.match(shell.querySelector('.lq-cv-calc').textContent,/Ödeme sıklığı veya zamanlaması desteklenmiyor/);
 assert.match(shell.querySelector('.lq-cv-head').textContent,/Kapsam dışı/);
 dom.window.close();
});
test('legacy UI: engine detail untouched',async()=>{
 const {dom,d}=await page('legacy');const content=d.getElementById('detailContent');content.innerHTML=engineHtml;await tick();
 assert.equal(content.querySelector('.lq-cv-shell'),null);dom.window.close();
});

test('real detail schedule tab uses server rows, preserves dates and separates initial journal',async()=>{
 const {dom,w,d,clicked}=await page();
 const content=d.getElementById('detailContent');
 content.innerHTML=engineHtml.replace('>schedule</div>', '><div data-authoritative-report-schedule></div><div data-authoritative-initial-journal>initial journal evidence</div></div>');
 await tick();
 content.querySelector('[data-lq-cv-tab="schedule"]').click();
 assert.equal(clicked.pop(),'schedule');
 const period={periodStart:'2026-08-01',periodEnd:'2026-08-31',reportingDate:'2026-08-31'};
 const notify=row=>w.dispatchEvent(new w.CustomEvent('lq:contract-report',{detail:{contractId:'K1',package:{period},row}}));
 const rows=[{date:'2026-08-27',openingLiability:999.11,interest:12.34,payment:100,principal:87.66,closingLiability:911.45,depreciation:null}];
 notify({status:'SUPPORTED',route:'P1_PLAIN_MONTHLY_ARREARS',currency:'TRY',metrics:{},scheduleRows:rows});
 const table=content.querySelector('table[aria-label="Doğrulanmış ödeme planı"]');
 assert.ok(table);assert.equal(table.querySelectorAll('tbody tr').length,1);
 assert.match(table.textContent,/27\.08\.2026/);assert.doesNotMatch(table.textContent,/28\.08\.2026/);
 assert.match(table.textContent,/999,11/);assert.match(table.textContent,/12,34/);
 assert.match(table.textContent,/Kaynak gerekli/);
 assert.match(content.querySelector('.lq-cv-slot-std').textContent,/P1_PLAIN_MONTHLY_ARREARS/);
 assert.equal(content.querySelector('[data-authoritative-initial-journal]').textContent,'initial journal evidence');
 assert.equal(content.querySelectorAll('[data-lq-initial-journal-heading]').length,1);
 notify({status:'NOT_READY',reason:'REPORTING_ROUTE_NOT_SUPPORTED',metrics:null,scheduleRows:[]});
 assert.equal(content.querySelector('table[aria-label="Doğrulanmış ödeme planı"]'),null);
 assert.match(content.querySelector('[data-authoritative-report-schedule]').textContent,/kaynak gerekli/);
 assert.doesNotMatch(content.querySelector('.lq-cv-slot-std').textContent,/P1_PLAIN_MONTHLY_ARREARS/);
 notify({status:'SUPPORTED',currency:'TRY',metrics:{},scheduleRows:[]});
 assert.match(content.querySelector('[data-authoritative-report-schedule]').textContent,/satırları için kaynak gerekli/);
 dom.window.close();
});

test('UI v2 active payment-table entry delegates before retired converter/private schedule access',async()=>{
 const vm=require('node:vm');
 const runtime=fs.readFileSync(path.join(__dirname,'../js/tfrs16-ui.js'),'utf8');
 const fn=runtime.slice(runtime.indexOf('  async function renderPaymentScheduleTable(contract)'),runtime.indexOf('  function renderFxTranslationSection(contract)'));
 const content={},contract={id:'K1'};let observed;
 const context={document:{documentElement:{getAttribute:()=> '2'},getElementById:()=>content},window:{LeaseQantReportingAuthorityUi:{renderContractDetails:async(c,k)=>{observed=[c,k];return 'verified';}}}};
 vm.createContext(context);vm.runInContext(fn,context);
 assert.equal(await context.renderPaymentScheduleTable(contract),'verified');
 assert.deepEqual(observed,[content,contract]);
});

test('late legacy standards observer cannot reinsert currency-derived badge in v2; legacy keeps its hook',async()=>{
 const runtime=fs.readFileSync(path.join(__dirname,'../js/tfrs16-ui.js'),'utf8');
 const start=runtime.indexOf('  function v26HookContractDetail()');
 const hook=runtime.slice(start,runtime.indexOf('\n  try {',start));
 for(const ui of ['2','legacy']){
  const {dom,w,d}=await page(ui);
  w.eval(`let selectedContractId='K1'; let contracts=[{id:'K1'}]; function renderContractStandardsPanel(){return '<div class="gk-v26-auto-detect">currency-inferred badge</div>';}`+hook+';v26HookContractDetail();');
  d.getElementById('detailContent').innerHTML=engineHtml;
  await tick();
  if(ui==='2'){
   assert.equal(d.querySelector('.gk-v26-auto-detect'),null);
   assert.equal(w.__GK_TFRS16_V26_DETAIL_HOOK__,undefined);
   // Subsequent unrelated UI changes must not recreate the obsolete panel.
   d.body.append(d.createElement('div'));await tick();
   assert.equal(d.querySelector('.gk-v26-auto-detect'),null);
  }else{
   assert.equal(w.__GK_TFRS16_V26_DETAIL_HOOK__,true);
   d.querySelector('.gk-v26-auto-detect').remove();await tick();
   assert.match(d.querySelector('.gk-v26-auto-detect').textContent,/currency-inferred badge/);
  }
  dom.window.close();
 }
});
