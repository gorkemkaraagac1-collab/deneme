'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const src=fs.readFileSync(path.join(__dirname,'../js/lq-pages.js'),'utf8');
function load(ui='legacy'){const dom=new JSDOM(`<!doctype html><html data-lq-ui="${ui}"><body></body></html>`,{url:'https://leaseqant.com/tfrs16.html',runScripts:'outside-only'});dom.window.eval(src);return dom;}
const C=[
 {id:'A1',companyId:'c1',company:'Holding',supplier:'Levent',status:'active',endDate:'2026-10-31',monthlyPayment:100,currency:'TRY',assetClass:'Bina'},
 {id:'A2',companyId:'c1',company:'Holding',supplier:'Ataşehir',status:'active',endDate:'2030-12-31',monthlyPayment:300,currency:'TRY',assetClass:'Bina'},
 {id:'B1',companyId:'c2',company:'Lojistik',supplier:'Ege Filo',status:'active',endDate:'2027-12-31',monthlyPayment:200,currency:'USD',assetClass:'Taşıt'},
 {id:'B2',companyId:'c2',company:'Lojistik',supplier:'Kule',status:'draft',endDate:'2028-12-31',monthlyPayment:50,currency:'TRY'}
];
const m=v=>({value:v,status:'SUPPORTED'});
const reports=new Map([['c1',{pkg:{contracts:[{contractId:'A1',status:'SUPPORTED',metrics:{leaseLiability:m(10),rouCarryingAmount:m(9)}},{contractId:'A2',status:'SUPPORTED',metrics:{leaseLiability:m(30),rouCarryingAmount:m(20)}}]}}],['c2',{pkg:{contracts:[{contractId:'B1',status:'NOT_READY',reason:'REPORTING_ROUTE_NOT_SUPPORTED',metrics:null}]}}]]);
test('contract views count, filter and take amounts only from the server report',()=>{
 const dom=load();const {contractRows}=dom.window.LeaseQantPages;
 const r=contractRows(C,reports,{view:'all',reportingDate:'2026-08-31'});
 assert.equal(JSON.stringify(r.counts),JSON.stringify({all:4,active:3,inactive:1,ending:1,out:1}));
 const a1=r.list.find(x=>x.c.id==='A1');assert.equal(a1.liability,10);assert.equal(a1.scope,'ok');assert.equal(a1.left,2);assert.equal(a1.ending,true);
 const b1=r.list.find(x=>x.c.id==='B1');assert.equal(b1.scope,'out');assert.equal(b1.liability,null);assert.equal(b1.reason,'REPORTING_ROUTE_NOT_SUPPORTED');
 assert.equal(r.list.find(x=>x.c.id==='B2').scope,'inactive');
 assert.equal(contractRows(C,reports,{view:'out'}).list.map(x=>x.c.id).join(),'B1');
 assert.equal(contractRows(C,reports,{search:'ataş'}).list.map(x=>x.c.id).join(),'A2');
 assert.equal(contractRows(C,reports,{currency:'USD'}).list.map(x=>x.c.id).join(),'B1');
 assert.equal(contractRows(C,reports,{sort:'liability',dir:'desc'}).list[0].c.id,'A2');
 assert.equal(contractRows(C,new Map([['c1',{loading:true}]]),{}).list.find(x=>x.c.id==='A1').scope,'loading');
 dom.window.close();
});
test('month and day helpers',()=>{
 const dom=load();const {monthsLeft,daysBetween}=dom.window.LeaseQantPages;
 assert.equal(monthsLeft('2026-08-31','2030-12-31'),52);assert.equal(monthsLeft('2026-08-31','2026-01-31'),0);
 assert.equal(daysBetween('2026-08-31','2026-10-31'),61);dom.window.close();
});
test('v2 page hosts are inserted into the existing views without removing them',async()=>{
 const dom=new JSDOM(`<!doctype html><html data-lq-ui="2"><body><select id="v26ActiveCompanySelect"><option value="ALL">Tümü</option></select><section id="lqDashboard"><div class="old">eski</div></section><div id="contractsView" style="display:none"><div id="kpiGrid"></div></div></body></html>`,{url:'https://leaseqant.com/tfrs16.html',runScripts:'outside-only'});
 const w=dom.window;
 w.LeaseQantReportingAuthorityUi={defaultPeriod:()=>({periodStart:'2026-08-01',periodEnd:'2026-08-31',reportingDate:'2026-08-31'}),companies:async()=>[{id:'c1',name:'Holding'}],load:async()=>({contracts:[],totals:{leaseLiability:m(40)},identity:{presentationCurrency:'TRY'},population:{excludedCount:0}})};
 w.GK_TFRS16={getPortfolioContracts:()=>C};
 w.eval(src);await new Promise(r=>setTimeout(r,150));
 const d=w.document;
 assert.ok(d.getElementById('lqOverview'));assert.ok(d.querySelector('#lqDashboard .old'),'old markup kept');
 assert.match(d.getElementById('lqOverview').textContent,/Holding/);
 d.getElementById('contractsView').style.display='';await new Promise(r=>setTimeout(r,50));
 assert.ok(d.getElementById('lqContracts'));assert.ok(d.getElementById('kpiGrid'));
 assert.equal(d.querySelectorAll('#lqContracts [data-open-contract]').length,4);
 dom.window.close();
});

 test('disclosure loading is separate from completeness, missing and unsupported issues are actions',()=>{
 const dom=new JSDOM('<html data-lq-ui="legacy"><body></body></html>',{runScripts:'outside-only'});
 dom.window.eval(src);
 const state=dom.window.LeaseQantPages.disclosureState;
 const incomplete=state({validation:{status:'UNSUPPORTED_REQUIREMENT_PRESENT'},missingInputs:[{fieldId:'cash'},{fieldId:'cash'}],supportStatus:[{requirementId:'fx',supportedStatus:'NOT_SUPPORTED'}]});
 assert.equal(incomplete.complete,false);assert.equal(incomplete.issues.join(','),'cash,fx');
 assert.equal(state({validation:{status:'COMPLETE_FOR_SUPPORTED_SCOPE'},missingInputs:[{fieldId:'cash'}]}).complete,false);
 assert.equal(state({validation:{status:'COMPLETE_FOR_SUPPORTED_SCOPE'},missingInputs:[],supportStatus:[]}).complete,true);
 assert.equal(state(null).complete,false);
 assert.equal(state({validation:{status:'PASSED'}}).complete,false);
 dom.window.close();
 });

async function overview(disclosureError=false){
 const dom=new JSDOM('<html data-lq-ui="2"><body><select id="v26ActiveCompanySelect"><option value="c1">Holding</option></select><section id="lqDashboard"></section></body></html>',{url:'https://leaseqant.com/tfrs16.html',runScripts:'outside-only'});
 const w=dom.window;
 const period={periodStart:'2026-08-01',periodEnd:'2026-08-31',reportingDate:'2026-08-31'};
 w.LeaseQantReportingAuthorityUi={defaultPeriod:()=>period,companies:async()=>[],load:async()=>({identity:{presentationCurrency:'TRY',companyName:'Holding'},period,totals:{leaseLiability:m(100),currentLiability:m(20),nonCurrentLiability:m(80)},population:{count:1,includedCount:1,excludedCount:0,exclusions:[]},controls:{status:'PASS',checks:[{status:'PASS'}]}})};
 w.GK_TFRS16={getPortfolioContracts:()=>[C[1]]};
 w.LeaseQantDashboardCharts={scopeOk:()=>true,assetModel:()=>({supported:false,status:'Girdi gerekli'}),bridgeModel:()=>({currency:'TRY'}),renderBridge:()=>'<p>Sunucu mutabakat kaynağı gerekli</p>',maturityModel:()=>({supported:false}),renderMaturity:()=>'<p>Kaynak gerekli</p>'};
 w.LeaseQantPrivateTfrs16Facade={loadLeaseDisclosureAvailability:async()=>({}),loadLeaseDisclosure:async()=>{if(disclosureError)throw Error('offline');return {validation:{status:'UNSUPPORTED_REQUIREMENT_PRESENT'},missingInputs:[{fieldId:'cashLedger'}],supportStatus:[{requirementId:'fx',supportedStatus:'NOT_SUPPORTED'}]};}};
 w.eval(src);await new Promise(r=>setTimeout(r,160));return dom;
}
test('real overview warns on loaded but incomplete disclosure and lists source actions',async()=>{
 const dom=await overview(),d=dom.window.document;
 assert.match(d.getElementById('lqOvRunway').textContent,/2 eksik/);
 assert.match(d.getElementById('lqOvActions').textContent,/cashLedger/);
 assert.match(d.getElementById('lqOvActions').textContent,/fx/);
 assert.doesNotMatch(d.getElementById('lqOvActions').textContent,/Bekleyen işlem yok/);
 assert.equal(d.querySelector('#lqOvKpis .lq-pg-split'),null);
 assert.match(d.getElementById('lqOvKpis').textContent,/oranı için sunucu kaynağı gerekli/);
 dom.window.close();
});
test('real overview never declares no pending action after disclosure load failure',async()=>{
 const dom=await overview(true),d=dom.window.document;
 assert.match(d.getElementById('lqOvActions').textContent,/Dipnot paketi alınamadı/);
 assert.doesNotMatch(d.getElementById('lqOvActions').textContent,/Bekleyen işlem yok/);
 dom.window.close();
});
