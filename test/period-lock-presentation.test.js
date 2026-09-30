'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {webcrypto,createHash}=require('node:crypto'),{JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..'), source=fs.readFileSync(path.join(root,'js/tfrs16-report-authority-ui.js'),'utf8');
const adapterSource=fs.readFileSync(path.join(root,'js/private-calculation-api.js'),'utf8');
const stable=v=>Array.isArray(v)?'['+v.map(stable).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}':JSON.stringify(v);
const tick=()=>new Promise(resolve=>setTimeout(resolve,25));
function packageFor(intent){
 const metrics=['rouCarryingAmount','leaseLiability','currentLiability','nonCurrentLiability','periodInterest','periodDepreciation','contractualPayments','next12MonthPayments','next12MonthPrincipal','next12MonthInterest','openingROU','openingLiability'];
 const p={schemaVersion:'REPORTING_AUTHORITY_DTO_V1',identity:{companyId:intent.companyId,companyName:'Synthetic Co',populationId:'TEST-POP'},period:intent,sourceStatus:'SERVER_PERSISTED_PRIVATE_REPORTING',livePostingStatus:'NOT_READY_FOR_LIVE_POSTING',contracts:[],population:{contractIds:[],count:0,includedCount:0,excludedCount:0,exclusions:[],coverage:'COMPLETE_POPULATION'},controls:{status:'SUPPORTED_CALCULATION_DIAGNOSTICS',checks:[]},audit:{rows:[]},unsupported:{},totals:Object.fromEntries(metrics.map(k=>[k,{status:'NOT_READY',value:null,sourceIds:[]}]))};
 p.contentHash=createHash('sha256').update(stable(p)).digest('hex');return p;
}
function setup(lock,uiVersion='2'){
 const dom=new JSDOM(`<html data-lq-ui="${uiVersion}"><select id="v26ActiveCompanySelect"><option value="C1">C1</option></select><main id="host"></main></html>`,{url:'https://example.test',runScripts:'outside-only'}),w=dom.window;
 Object.defineProperty(w,'crypto',{value:webcrypto});w.TextEncoder=TextEncoder;
 w.LeaseQantReportingPeriod={get:()=>({periodStart:'2026-08-01',periodEnd:'2026-08-31'})};
 const calls=[];
 w.LeaseQantPrivateCalculation={getReportingCompanies:async()=>({companies:[{id:'C1',name:'Co 1'},{id:'C2',name:'Co 2'}]}),getReportingAuthorityPackage:async intent=>packageFor(intent),getPeriodLockStatus:async intent=>{calls.push(JSON.parse(JSON.stringify(intent)));return lock(intent);}};
 w.eval(source);return {dom,w,host:w.document.getElementById('host'),ui:w.LeaseQantReportingAuthorityUi,calls};
}
test('v2 close renders OPEN and LOCKED only from the matching server identity, with no mutation control',async()=>{
 for(const status of ['OPEN','LOCKED']){
  const s=setup(intent=>({...intent,status,lockedAt:status==='LOCKED'?'2026-09-01T09:00:00.000Z':null}));
  await s.ui.page(s.host,'Ay Sonu Kapanış','controls');
  assert.deepEqual(s.calls,[{companyId:'C1',periodKey:'2026-08'}]);
  assert.equal(s.host.querySelector('[data-period-lock-state]').dataset.periodLockState,status);
  assert.match(s.host.textContent,status==='OPEN'?/Dönem kilidi · Açık/:/Dönem kilidi · Kilitli/);
  assert.equal([...s.host.querySelectorAll('button')].some(b=>/kapat|kilitle|yeniden aç/i.test(b.textContent)),false);
  s.dom.window.close();
 }
});
test('wrong company, wrong month, invalid status and failed source never imply OPEN',async()=>{
 for(const response of [i=>({...i,companyId:'OTHER',status:'OPEN',lockedAt:null}),i=>({...i,periodKey:'2026-07',status:'OPEN',lockedAt:null}),i=>({...i,status:'UNKNOWN',lockedAt:null}),()=>{throw Object.assign(Error('denied'),{code:'PERIOD_STATUS_COMPANY_ACCESS_DENIED'});}]){
  const s=setup(response);await s.ui.page(s.host,'Kapanış','controls');
  assert.equal(s.host.querySelector('[data-period-lock-state]').dataset.periodLockState,'UNAVAILABLE');
  assert.match(s.host.textContent,/Sunucu durumu alınamadı/);s.dom.window.close();
 }
});
test('company and date changes discard a pending old lock response; custom ranges do not query a monthly lock',async()=>{
 let resolve;const s=setup(i=>i.companyId==='C1'?new Promise(r=>{resolve=r;}):({...i,status:'OPEN',lockedAt:null}));
 const initial=s.ui.page(s.host,'Kapanış','controls');
 while(!resolve)await tick();
 const company=s.host.querySelector('[data-report-company]');company.value='C2';company.dispatchEvent(new s.w.Event('change'));await tick();
 resolve({companyId:'C1',periodKey:'2026-08',status:'LOCKED',lockedAt:'2026-09-01T00:00:00Z'});await initial;await tick();
 assert.equal(s.host.querySelector('[data-period-lock-state]').dataset.periodLockState,'OPEN');
 assert.match(s.host.querySelector('[data-period-lock-state]').textContent,/C2/);
 const start=s.host.querySelector('[data-report-start]');start.value='2026-08-02';start.dispatchEvent(new s.w.Event('input'));
 assert.equal(s.host.querySelector('[data-period-lock-state]'),null);
 const before=s.calls.length;s.host.querySelector('[data-report-load]').click();await tick();
 assert.equal(s.calls.length,before);assert.equal(s.host.querySelector('[data-period-lock-state]').dataset.periodLockState,'UNSUPPORTED_RANGE');
 s.dom.window.close();
});
test('legacy controls do not introduce the new lock endpoint or presentation',async()=>{
 const s=setup(()=>{throw Error('should not query');},'legacy');await s.ui.page(s.host,'Kapanış','controls');
 assert.match(s.host.textContent,/Synthetic Co/);assert.doesNotMatch(s.host.textContent,/Rapor şu anda gösterilemiyor/);assert.equal(s.calls.length,0);assert.equal(s.host.querySelector('[data-period-lock-state]'),null);s.dom.window.close();
});
test('adapter uses authenticated GET with exact intent, validates response and never sends a mutation',async()=>{
 const dom=new JSDOM('',{url:'https://example.test',runScripts:'outside-only'}),w=dom.window;w.URLSearchParams=URLSearchParams;
 w.tfrs16GetToken=()=> 'synthetic-test-token';const calls=[];let response={companyId:'C1',periodKey:'2026-08',status:'OPEN',lockedAt:null};
 w.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,status:200,json:async()=>({success:true,data:response})};};
 w.eval(adapterSource);const api=w.LeaseQantPrivateCalculation,intent={companyId:'C1',periodKey:'2026-08'};
 await api.getPeriodLockStatus(intent);
 assert.equal(calls[0].url,'https://api.leaseqant.com/api/periods/lock-status?companyId=C1&periodKey=2026-08');
 assert.equal(calls[0].options.method,'GET');assert.equal(calls[0].options.body,undefined);assert.equal(calls[0].options.headers.Authorization,'Bearer synthetic-test-token');
 response={...response,companyId:'C2'};await assert.rejects(api.getPeriodLockStatus(intent),e=>e.code==='PERIOD_STATUS_RESPONSE_INVALID');
 const count=calls.length;await assert.rejects(api.getPeriodLockStatus({...intent,periodKey:'2026-13'}));assert.equal(calls.length,count);dom.window.close();
});
