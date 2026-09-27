'use strict';
// Runs the active HTML startup callbacks, shell navigation and runtime route
// bindings with a DOM and virtual clock. No private accounting fixture ships.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'tfrs16.html'),'utf8');
const source=fs.readFileSync(path.join(root,'js/tfrs16-ui.js'),'utf8');
const navSource=source.slice(source.indexOf('  function injectV26Navigation()'),source.indexOf('\n  try {\n    injectV26Styles();',source.indexOf('  function injectV26Navigation()')));
const wireSource=source.slice(source.indexOf('  function v191WireNavigation()'),source.indexOf('  function v191RefreshOpenView()'));
assert.ok(navSource.startsWith('  function injectV26Navigation()'));
function setup(query='',width=1280){
 const dom=new JSDOM(html,{url:'https://example.test/tfrs16.html'+query,runScripts:'outside-only'}),w=dom.window;
 w.innerWidth=width;w.matchMedia=()=>({matches:w.innerWidth<=900});
 const observers=[],NativeObserver=w.MutationObserver;
 w.MutationObserver=class extends NativeObserver{constructor(fn){super(fn);observers.push(this);}};
 const close=w.close.bind(w);w.close=()=>{observers.forEach(o=>o.disconnect());close();};
 let now=0;const jobs=new Map();let seq=0;
 w.setTimeout=(fn,ms=0)=>{const id=++seq;jobs.set(id,{fn,at:now+ms});return id;};w.clearTimeout=id=>jobs.delete(id);
 w.setInterval=(fn,ms)=>{const id=++seq;jobs.set(id,{fn,at:now+ms,interval:ms});return id;};w.clearInterval=id=>jobs.delete(id);
 w.Element.prototype.scrollIntoView=()=>{};w.fetch=async()=>({ok:true,json:async()=>({data:[],companies:[]})});
 w.Headers=Headers;w.Request=Request;w.localStorage.setItem('access_token','SYNTHETIC-SESSION-ONLY');
 w.__GK_DASHBOARD_SHELL__=true;w.v191ActiveScreenRefreshCallback=null;
 // The accepted renderer is invoked by its real route key. Accounting is
 // tested separately through the unchanged authority adapters, never here.
 for(const key of ['CloseDashboard','AccountMapping','CompanyManagement','GroupManagement','EliminationManagement','FxRateManagement','AuditTrail','InflationIndexManagement','ModificationReassessment','SlbManagement','SubleaseManagement','AccountingCenter','Footnotes','RiskControls','ConsolidationReport','FinancialReporting']){
  w['render'+key+'Page']=target=>{target.innerHTML='<h2>'+key+'</h2>';};
 }
 w.v191OpenFinancialReporting=()=>{throw Error('Duplicate legacy Reporting navigation');};
 w.v191OpenMonthEndClose=()=>{};w.v191OpenRiskControls=()=>{};
 w.eval(wireSource+'\nv191WireNavigation();');
 w.LeaseQantReportingAuthorityUi={refreshDashboardPresentation:()=>{}};
 for(const script of Array.from(w.document.scripts)){
  if(script.getAttribute('src')?.startsWith('js/shell.js'))w.eval(fs.readFileSync(path.join(root,'js/shell.js'),'utf8'));
  else if(script.getAttribute('src')?.startsWith('js/tfrs16-ui.js'))w.eval(navSource+'\ninjectV26Navigation();');
  else if(!script.src && /Main content view ownership|CFO strip: read-only mirrors|REPORT-AUTH-R1 dashboard navigation|V10 FINAL Top Navigation/.test(script.textContent))w.eval(script.textContent);
 }
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));w.dispatchEvent(new w.Event('load'));
 async function advance(to){
  for(let i=0;i<150;i++){
   const next=[...jobs].filter(([,j])=>j.at<=to).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;
   const [id,j]=next;now=j.at;jobs.delete(id);j.fn();if(j.interval&& !jobs.has(id))jobs.set(id,{...j,at:now+j.interval});await Promise.resolve();
  }
  now=to;await Promise.resolve();
 }
 function visible(){const d=w.document.getElementById('lqDashboard'),c=w.document.getElementById('contractsView'),h=w.document.getElementById('v26PageHost');return {dashboard:!d.hidden&&d.style.display!=='none',contracts:c.style.display!=='none',page:h.style.display!=='none'&&h.innerHTML.trim()!==''};}
 function click(selector){const el=w.document.querySelector(selector);assert.ok(el,'Active navigation binding required: '+selector);el.click();}
 return {w,dom,advance,visible,click};
}
test('active financialReporting deep link survives both delayed Dashboard startup callbacks and shell rewiring',async()=>{
 const s=setup('?open=financialReporting');await s.advance(0);assert.equal(s.visible().page,true);
 for(const ms of [500,800,2000,2500,4000]){await s.advance(ms);assert.deepEqual(s.visible(),{dashboard:false,contracts:false,page:true});assert.match(s.w.document.getElementById('v26PageHost').textContent,/FinancialReporting/);}
 s.dom.window.close();
});
test('default and invalid route keep Dashboard after all existing startup delays',async()=>{
 for(const query of ['', '?open=UNKNOWN']){const s=setup(query);await s.advance(4000);assert.deepEqual(s.visible(),{dashboard:true,contracts:false,page:false});s.dom.window.close();}
});
test('visible native Reporting navigation converges on the accepted runtime route and returns to Dashboard',async()=>{
 const s=setup();await s.advance(4000);s.click('#menuToggle');
 const nav=s.w.document.querySelector('#sidebarNav [data-open="financialReporting"]');assert.ok(nav);assert.match(nav.textContent,/Finansal Raporlama/);
 s.click('#sidebarNav [data-open="financialReporting"]');assert.deepEqual(s.visible(),{dashboard:false,contracts:false,page:true});assert.match(s.w.document.getElementById('v26PageHost').textContent,/FinancialReporting/);assert.equal(nav.classList.contains('active'),true);
 s.click('[data-lq-dashboard]');assert.deepEqual(s.visible(),{dashboard:true,contracts:false,page:false});s.dom.window.close();
});
test('early explicit navigation is not stolen by default startup; latest Dashboard choice still wins',async()=>{
 const s=setup();await s.advance(0);s.click('#sidebarNav [data-open="financialReporting"]');await s.advance(4000);assert.deepEqual(s.visible(),{dashboard:false,contracts:false,page:true});
 s.click('[data-lq-dashboard]');assert.deepEqual(s.visible(),{dashboard:true,contracts:false,page:false});s.dom.window.close();
 const d=setup('?open=financialReporting');await d.advance(0);d.click('[data-lq-dashboard]');await d.advance(4000);assert.deepEqual(d.visible(),{dashboard:true,contracts:false,page:false});d.dom.window.close();
});
test('Reporting → Contracts → Reporting and other major authority surfaces keep one visible owner',async()=>{
 const s=setup('?open=financialReporting');await s.advance(4000);
 s.click('[data-view="contracts"]');assert.deepEqual(s.visible(),{dashboard:false,contracts:true,page:false});
 for(const key of ['financialReporting','footnotes','accountingCenter','financialReporting']){s.click('#sidebarNav [data-open="'+key+'"]');await s.advance(4500);assert.deepEqual(s.visible(),{dashboard:false,contracts:false,page:true});}
 s.dom.window.close();
});
test('refresh of the explicit Reporting deep link retains its route; all source timings remain unchanged',async()=>{
 for(let run=0;run<2;run++){const s=setup('?open=financialReporting');await s.advance(4000);assert.deepEqual(s.visible(),{dashboard:false,contracts:false,page:true});s.dom.window.close();}
 assert.equal((html.match(/},500\)/g)||[]).length>=2,true);
});

test('tablet and mobile use the actual menu binding and close it after Reporting selection',async()=>{
 for(const width of [800,390]){const s=setup('',width);await s.advance(4000);s.click('#menuToggle');assert.equal(s.w.document.getElementById('sidebarNav').classList.contains('mobile-open'),true);
 s.click('#sidebarNav [data-open="financialReporting"]');assert.equal(s.w.document.getElementById('sidebarNav').classList.contains('mobile-open'),false);assert.deepEqual(s.visible(),{dashboard:false,contracts:false,page:true});s.dom.window.close();}
});
test('topbar company selector receives authenticated reporting scope and remains the only active selector ID',async()=>{
 const s=setup();await s.advance(4000);const w=s.w;
 assert.equal(w.document.querySelectorAll('#v26ActiveCompanySelect').length,1);
 w.__GK_TFRS16_REPORTING_COMPANIES__=[{id:'COMP-A',name:'Şirket A'},{id:'COMP-B',name:'Şirket B'}];
 w.dispatchEvent(new w.Event('gk-reporting-companies-ready'));
 const select=w.document.getElementById('v26ActiveCompanySelect');
 assert.deepEqual(Array.from(select.options,o=>o.value),['ALL','COMP-A','COMP-B']);
 assert.equal(select.options[2].textContent,'Şirket B');s.dom.window.close();
});
