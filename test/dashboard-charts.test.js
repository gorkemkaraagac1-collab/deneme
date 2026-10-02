'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const src=fs.readFileSync(path.join(__dirname,'../js/lq-dashboard-charts.js'),'utf8');
const S=v=>({status:'SUPPORTED',value:v,currency:'TRY'});
function pkgFor(over={}){
 return {
  identity:{companyId:'c1',currencyEvidenceId:'ev1'},
  period:{reportingPeriodStart:'2026-08-01',reportingDate:'2026-08-31',presentationCurrency:'TRY'},
  population:{populationId:'p1',includedContractIds:['a','b'],includedCalculationIds:['k1','k2']},
  validation:{status:'PASSED'},
  periodMovement:{liability:{opening:S(1000),initialRecognitionAdditions:S(200),interest:S(30),
   actualCashOutflow:S(150),scheduledContractualCash:S(150),modifications:{status:'ZERO_CONFIRMED',value:0},
   remeasurements:{status:'ZERO_CONFIRMED',value:0},tms21Movement:S(40),closing:S(1120)},rou:{}},
  quantitative:{rouCarryingAmountByAssetClass:{status:'SUPPORTED',value:[{assetClass:'Araç',value:300},{assetClass:'Bina',value:700}]}},
  maturityAnalysis:{status:'SUPPORTED',currency:'TRY',bands:[{bandId:'b1',label:'1 yıla kadar',undiscountedCashFlow:600},{bandId:'b2',label:'1–5 yıl',undiscountedCashFlow:700}],
   undiscountedTotal:1300,undiscountedTotalStatus:'SUPPORTED',discountedLeaseLiabilityCarryingAmount:S(1120)},
  ...over};
}
async function page(ui='2',facade){
 const html=`<!doctype html><html data-lq-ui="${ui}"><body><select id="v26ActiveCompanySelect"><option value="ALL">Tüm</option><option value="c1">A</option></select>
 <section id="lqDashboard"><div class="lq-dashboard-grid"><article class="lq-dash-card lq-chart-card"></article><article class="lq-dash-card lq-control-card"></article></div></section></body></html>`;
 const dom=new JSDOM(html,{url:'https://example.test/tfrs16.html',runScripts:'outside-only'});
 const w=dom.window;
 w.LeaseQantReportingPeriod={get:()=>({key:'2026-08',periodStart:'2026-08-01',periodEnd:'2026-08-31',reportingDate:'2026-08-31'}),subscribe:()=>()=>{}};
 if(facade)w.LeaseQantPrivateTfrs16Facade=facade;
 w.eval(src);
 if(w.document.readyState==='loading')await new Promise(r=>w.document.addEventListener('DOMContentLoaded',r,{once:true}));
 return {dom,w,d:w.document};
}
const wait=ms=>new Promise(r=>setTimeout(r,ms));

test('bridge: payments reduce, balanced package has no residual',async()=>{
 const {dom,w}=await page('legacy');const {bridgeModel}=w.LeaseQantDashboardCharts;
 const m=bridgeModel(pkgFor());
 assert.equal(m.residual,null);assert.equal(m.complete,true);
 assert.equal(m.rows.find(r=>r.id==='payments').value,-150);
 assert.equal(m.rows.find(r=>r.id==='tms21').value,40);
 assert.equal(m.rows.map(r=>r.id).join(','),['opening','additions','interest','payments','modifications','remeasurements','tms21','closing'].join(','));
 dom.window.close();
});
test('bridge: unexplained difference is shown as reconciliation row, missing field is not zero',async()=>{
 const {dom,w}=await page('legacy');const {bridgeModel}=w.LeaseQantDashboardCharts;
 const p=pkgFor();p.periodMovement.liability.closing=S(1100);p.periodMovement.liability.tms21Movement={status:'REQUIRES_ENTITY_INPUT',value:null};
 const m=bridgeModel(p);
 assert.equal(m.rows.find(r=>r.id==='tms21').kind,'missing');
 assert.equal(m.residual,20);assert.equal(m.complete,false);
 assert.match(m.rows.find(r=>r.id==='residual').note,/TMS 29/);
 dom.window.close();
});
test('bridge: the liability is settled by contractual payments, not total cash outflow',async()=>{
 const {dom,w}=await page('legacy');const {bridgeModel}=w.LeaseQantDashboardCharts;
 const p=pkgFor();p.periodMovement.liability.actualCashOutflow={status:'REQUIRES_LEDGER_DATA',value:null};
 const m=bridgeModel(p);assert.equal(m.paymentPlanned,true);assert.match(m.rows.find(r=>r.id==='payments').label,/sözleşmesel/);
 // Total cash incl. exempt lease payments does not replace the contractual line.
 const withCash=pkgFor();const sched=withCash.periodMovement.liability.scheduledContractualCash;
 if(sched){withCash.periodMovement.liability.actualCashOutflow={status:'SUPPORTED',value:sched.value+3000};
  assert.equal(bridgeModel(withCash).rows.find(r=>r.id==='payments').value,-Math.abs(sched.value));}
 dom.window.close();
});
test('maturity reconciles undiscounted total to carrying amount; asset classes sorted',async()=>{
 const {dom,w}=await page('legacy');const {maturityModel,assetModel}=w.LeaseQantDashboardCharts;
 const m=maturityModel(pkgFor());assert.equal(m.finance,180);assert.equal(m.bandsMatchTotal,true);
 const a=assetModel(pkgFor());assert.equal(a.items.map(i=>i.label).join(','),'Bina,Araç');assert.equal(a.total,1000);
 const n=maturityModel(pkgFor({maturityAnalysis:{status:'NOT_CALCULABLE',limitation:'x'}}));assert.equal(n.supported,false);
 dom.window.close();
});
test('dashboard: asks for a company under ALL, loads and validates scope for one company',async()=>{
 const av={populationId:'p1',contractIds:['b','a'],calculationIds:['k1','k2'],currencyProfile:{presentationCurrency:'TRY',evidenceId:'ev1'}};
 const calls=[];
 const facade={loadLeaseDisclosureAvailability:async r=>{calls.push(r);return av;},loadLeaseDisclosure:async()=>pkgFor()};
 const {dom,w,d}=await page('2',facade);
 await wait(120);
 assert.equal(d.documentElement.getAttribute('data-lq-charts'),'on');
 assert.match(d.getElementById('lqChartsState').textContent,/şirket seçin/);
 assert.equal(calls.length,0);
 const sel=d.getElementById('v26ActiveCompanySelect');sel.value='c1';sel.dispatchEvent(new w.Event('change'));
 await wait(150);
 assert.equal(calls.length,1);assert.equal(calls[0].companyId,'c1');assert.equal(calls[0].reportingDate,'2026-08-31');
 assert.equal(d.querySelectorAll('#lqChartBridge .lq-wf-row').length,8);
 assert.match(d.getElementById('lqChartMaturity').textContent,/defter değeri/);
 assert.match(d.querySelector('[data-lq-chart-chip]').textContent,/31\.08\.2026 · TRY/);
 dom.window.close();
});
test('dashboard: scope mismatch is refused, trusted-source error offers footnotes',async()=>{
 const av={populationId:'p1',contractIds:['a','b'],calculationIds:['k1','k2'],currencyProfile:{presentationCurrency:'TRY',evidenceId:'ev1'}};
 let mode='mismatch';
 const facade={loadLeaseDisclosureAvailability:async()=>{if(mode==='source')throw Object.assign(new Error('x'),{code:'DISCLOSURE_TRUSTED_SOURCE_REQUIRED'});return av;},
  loadLeaseDisclosure:async()=>pkgFor({identity:{companyId:'OTHER',currencyEvidenceId:'ev1'}})};
 const {dom,w,d}=await page('2',facade);
 const sel=d.getElementById('v26ActiveCompanySelect');sel.value='c1';sel.dispatchEvent(new w.Event('change'));
 await wait(150);
 assert.match(d.getElementById('lqChartsState').textContent,/uyuşmadı/);
 assert.equal(d.querySelectorAll('#lqChartBridge .lq-wf-row').length,0);
 mode='source';w.LeaseQantDashboardCharts.refresh();await wait(50);
 assert.ok(d.querySelector('[data-lq-open="footnotes"]'));
 dom.window.close();
});
test('legacy UI: no section inserted',async()=>{
 const {dom,d}=await page('legacy',{loadLeaseDisclosureAvailability:async()=>{throw new Error('should not run');},loadLeaseDisclosure:async()=>null});
 await wait(100);assert.equal(d.getElementById('lqCharts'),null);dom.window.close();
});
