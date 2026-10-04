'use strict';
// Needs evidence from a disposable local integration run; skipped otherwise.
if(!require('node:fs').existsSync(process.env.REPORTING_AUTHORITY_PROOF||'/tmp/report-auth-r1-numeric.json')){require('node:test').test('integration evidence report-auth-r1-numeric.json not present',{skip:'integration evidence report-auth-r1-numeric.json not present'},()=>{});return;}
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {webcrypto,createHash}=require('node:crypto'),{JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');
const proofs=JSON.parse(fs.readFileSync(process.env.REPORTING_AUTHORITY_PROOF||'/tmp/report-auth-r1-numeric.json','utf8')).evidence;
assert.equal(proofs.length,5,'Fresh authenticated real backend evidence required');
const plain=v=>JSON.parse(JSON.stringify(v));
const stable=v=>Array.isArray(v)?'['+v.map(stable).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}':JSON.stringify(v);
const rehash=p=>{delete p.contentHash;p.contentHash=createHash('sha256').update(stable(p)).digest('hex');return p;};
class FixedDate extends Date{constructor(...a){super(...(a.length?a:['2026-02-17T10:00:00Z']));}static now(){return new Date('2026-02-17T10:00:00Z').getTime();}}
function runtime(markup='<main id="mainContent"></main>'){
 const dom=new JSDOM(markup,{url:'https://example.test/tfrs16.html'}),window=dom.window;
 Object.defineProperty(window,'crypto',{value:webcrypto});
 const context=vm.createContext({window,document:window.document,TextEncoder,Uint8Array,Intl,Blob,URLSearchParams,AbortController,Promise,Date:FixedDate,Number,String,Set,Map,WeakSet,Object,JSON,console,setTimeout,clearTimeout});
 const load=file=>vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});load('js/tfrs16-report-authority-ui.js');
 return {window,context,load,ui:window.LeaseQantReportingAuthorityUi,dom};
}
function adapter(window,rows=proofs){window.LeaseQantPrivateCalculation={getReportingCompanies:async()=>({companies:rows.map(r=>({id:r.body.companyId,name:r.package.identity.companyName}))}),getReportingAuthorityPackage:async intent=>{const p=rows.find(r=>r.body.companyId===intent.companyId);assert.deepEqual(plain(intent),p.body);return plain(p.package);}};}
function csvRows(data,sep){return data.split('\r\n').map(line=>line.split(sep).map(v=>v.slice(1,-1).replace(/""/g,'"')));}
const tick=()=>new Promise(resolve=>setTimeout(resolve,15));
test('real accounting source → API → UI → XLSX/CSV/TXT/HTML/PDF has exact raw parity',async()=>{
 const {ui,window}=runtime();let sheet,printed='';window.XLSX={utils:{book_new:()=>({}),json_to_sheet:rows=>{sheet=rows;return rows;},book_append_sheet:()=>{}},writeFile:()=>{}};
 window.open=()=>({opener:window,document:{write:s=>printed=s,close:()=>{}},print:()=>{}});
 const result=[];
 for(const proof of proofs){const p=await ui.acceptPackage(proof.package,proof.body),raw=ui.rawRows(p);ui.exportPackage(p,'xlsx');
  const csv=csvRows(ui.serialize(p,'csv'),';'),txt=csvRows(ui.serialize(p,'txt'),'\t'),header=csv.shift();txt.shift();
  ui.exportPackage(p,'pdf');const doc=new JSDOM(printed).window.document,rows=Array.from(doc.querySelectorAll('tbody tr')),
   metricsVisible=p.population.count>0;
  if(metricsVisible)assert.equal(rows.length,raw.length);else{assert.equal(rows.length,0);assert.match(doc.body.textContent,/finansal tutar gösterilmiyor/);}
  raw.forEach((r,i)=>{const value=proof.package.totals[r.metric].value;assert.equal(r.value,value);assert.equal(sheet[i].value,value);
   assert.equal(csv[i][header.indexOf('value')],value===null?'':String(value));assert.equal(txt[i][header.indexOf('value')],value===null?'':String(value));
   const printRaw=metricsVisible?rows[i].cells[header.indexOf('value')].textContent:null;
   if(metricsVisible)assert.equal(printRaw,value===null?'—':String(value));
   const source=proof.source?proof.source.reduce((s,c)=>s+c.values[r.metric],0):value;
   assert.equal(source,value);
   result.push({fixture:proof.fixture,metric:r.metric,currency:r.currency,backendSourceValue:source,apiValue:value,frontendRaw:r.value,xlsxRaw:sheet[i].value,csvRaw:csv[i][header.indexOf('value')],txtRaw:txt[i][header.indexOf('value')],printRaw,delta:value===null?null:0,status:r.status,coverage:r.coverage});
  });
  for(const contract of p.contracts.filter(c=>c.status==='SUPPORTED')){
   const contractRows=ui.rawRows(p,'metrics',contract.contractId);ui.exportPackage(p,'xlsx','metrics',contract.contractId);
   contractRows.forEach((r,i)=>{assert.equal(r.value,contract.metrics[r.metric].value);assert.equal(r.coverage,contract.metrics[r.metric].coverage);assert.equal(r.populationCoverage,p.population.coverage);assert.equal(sheet[i].value,r.value);
    result.push({fixture:proof.fixture,contractId:contract.contractId,metric:r.metric,currency:r.currency,sourceCalculationId:contract.calculationId,apiValue:contract.metrics[r.metric].value,frontendRaw:r.value,xlsxRaw:sheet[i].value,delta:0,status:r.status,coverage:'SUPPORTED_CONTRACT'});
   });
  }
  assert.equal(Object.isFrozen(p.contracts),true);assert.equal(Object.isFrozen(p.totals.leaseLiability),true);
 }
 fs.writeFileSync('/tmp/report-auth-r1-frontend-numeric.json',JSON.stringify(result,null,2));
});
test('schedule and raw stored audit numbers export unchanged; controls use server results',async()=>{
 const {ui,window}=runtime(),proof=proofs.find(p=>p.fixture==='single'),p=await ui.acceptPackage(proof.package,proof.body);let captured;
 window.XLSX={utils:{book_new:()=>({}),json_to_sheet:r=>{captured=r;return r;},book_append_sheet:()=>{}},writeFile:()=>{}};
 for(const section of ['schedule','controls','audit']){ui.exportPackage(p,'xlsx',section);const rows=ui.rawRows(p,section);assert.deepEqual(plain(captured),plain(rows));assert.ok(ui.serialize(p,'csv',section));assert.ok(ui.serialize(p,'txt',section));assert.ok(ui.html(p,section));}
 const audit=ui.rawRows(p,'audit')[0];assert.deepEqual(plain(audit.old_value),{amount:135.719,discountRate:6.3719,count:2});assert.equal(audit.metadata.amount,91.371);
 assert.equal(audit.evidenceType,'SERVER_STORED_EVENT_PAYLOAD_NOT_CERTIFIED_ACCOUNTING_FACTS');
 const schedule=ui.rawRows(p,'schedule');p.contracts[0].scheduleRows.forEach((r,i)=>assert.deepEqual(plain(schedule[i]),{...plain(r),companyId:p.identity.companyId,populationId:p.identity.populationId,periodStart:p.period.periodStart,periodEnd:p.period.periodEnd,coverage:'COMPLETE_POPULATION'}));
 const mixed=await ui.acceptPackage(proofs.find(p=>p.fixture==='mixed').package,proofs.find(p=>p.fixture==='mixed').body);assert.equal(ui.rawRows(mixed,'schedule')[0].coverage,'SUPPORTED_SUBSET');
});
test('empty closing and unsupported controls stay readable while raw diagnostics remain in closed details',async()=>{
 const {ui}=runtime();const proof=proofs.find(p=>p.fixture==='zero');const p=await ui.acceptPackage(proof.package,proof.body);
 const doc=new JSDOM(ui.html(p,'controls')).window.document;
 assert.match(doc.body.textContent,/aktif sözleşme yok/);
 assert.equal(doc.querySelector('table'),null);
 const details=doc.querySelector('details');assert.ok(details);assert.equal(details.open,false);
 assert.match(details.textContent,/controlId/);
 const single=proofs.find(p=>p.fixture==='single');const q=await ui.acceptPackage(single.package,single.body);
 const controls=new JSDOM(ui.html(q,'controls')).window.document;
 assert.ok(controls.querySelector('table'));
 assert.ok(!controls.querySelector('table').textContent.includes('CLOSE-CONTRACT-COMPLETENESS'));
 assert.match(controls.querySelector('table').textContent,/Geçti/);
});
test('empty reporting population does not present unavailable metrics as a financial error',async()=>{
 const {ui}=runtime(),proof=proofs.find(p=>p.fixture==='zero'),p=await ui.acceptPackage(proof.package,proof.body);
 const doc=new JSDOM(ui.html(p,'metrics')).window.document;
 assert.match(doc.querySelector('[role="status"]').textContent,/aktif sözleşme yok/);
 assert.match(doc.querySelector('.lq-authority-empty').textContent,/finansal tutar gösterilmiyor/);
 assert.equal(doc.querySelector('table'),null);
 assert.equal(doc.querySelectorAll('[role="alert"]').length,0);
});
test('mutations cannot be repaired; structural source/route/coverage rules survive recomputed checksums',async()=>{
 const {ui}=runtime(),proof=proofs.find(p=>p.fixture==='single');
 const attacks={missing:p=>delete p.totals.leaseLiability,amount:p=>p.totals.leaseLiability.value++,currency:p=>p.totals.leaseLiability.currency='USD',period:p=>p.period.reportingDate='2026-01-30',population:p=>p.population.contractIds.push('FOREIGN'),coverage:p=>p.population.coverage='SUPPORTED_SUBSET',source:p=>p.contracts[0].sourceResultHash='FORGED',route:p=>p.contracts[0].route='P8',profile:p=>p.identity.currencyEvidenceId=null};
 for(const mutate of Object.values(attacks)){const p=plain(proof.package);mutate(p);await assert.rejects(ui.acceptPackage(p,proof.body),/REPORTING_RESPONSE/);}
 for(const key of ['source','route','profile','population','coverage','missing']){const p=plain(proof.package);attacks[key](p);await assert.rejects(ui.acceptPackage(rehash(p),proof.body),/REPORTING_RESPONSE/);}
 const mixed=plain(proofs.find(p=>p.fixture==='mixed').package);mixed.population.coverage='COMPLETE_POPULATION';await assert.rejects(ui.acceptPackage(rehash(mixed),mixed.period),/REPORTING_RESPONSE/);
 const p=await ui.acceptPackage(proof.package,proof.body);assert.throws(()=>ui.rawRows(plain(p)),/NOT_VERIFIED/);assert.throws(()=>ui.exportPackage(p.contracts[0].scheduleRows,'csv'),/NOT_VERIFIED/);
 // A checksum is not a cryptographic origin signature; transport/backend authority is mandatory.
});
test('authenticated adapter sends only intent and company request, with no calculation payload',async()=>{
 const {window,load,ui}=runtime(),proof=proofs[0],calls=[];window.tfrs16GetToken=()=> 'SYNTHETIC-TOKEN-ONLY';window.setTimeout=setTimeout;window.clearTimeout=clearTimeout;
 window.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,status:200,json:async()=>({success:true,data:url.includes('/companies')?{companies:[{id:proof.body.companyId,name:'Synthetic'}]}:proof.package})};};load('js/private-calculation-api.js');
 await ui.companies();const p=await ui.load(proof.body);assert.deepEqual(plain(p),proof.package);
 assert.match(calls[0].url,/\/api\/reports\/authority\/companies$/);assert.equal(calls[0].options.method,'GET');
 assert.match(calls[1].url,/\/api\/reports\/authority$/);assert.equal(calls[1].options.headers.Authorization,'Bearer SYNTHETIC-TOKEN-ONLY');assert.equal(calls[1].options.credentials,'include');assert.deepEqual(JSON.parse(calls[1].options.body),proof.body);
});
test('default reporting period is the last fully elapsed calendar month',()=>{
 const {ui}=runtime();
 assert.deepEqual(plain(ui.defaultPeriod()),{periodStart:'2026-01-01',periodEnd:'2026-01-31',reportingDate:'2026-01-31'});
 assert.equal(ui.validPeriodRange('2026-08-01','2026-08-31'),true);
 assert.equal(ui.validPeriodRange('2026-09-01','2026-06-30'),false);
 assert.equal(ui.validPeriodRange('2026-02-30','2026-03-01'),false);
});
test('report page blocks reversed date ranges before calling the authenticated report source',async()=>{
 const {ui,window}=runtime(),source=plain(proofs.find(p=>p.fixture==='single').package),intent={companyId:source.identity.companyId,...ui.defaultPeriod()};source.period=intent;rehash(source);
 const target=window.document.getElementById('mainContent'),calls=[];
 window.LeaseQantPrivateCalculation={getReportingCompanies:async()=>({companies:[{id:intent.companyId,name:'Synthetic'}]}),
  getReportingAuthorityPackage:async requested=>{calls.push(plain(requested));return plain(source);}};
 await ui.page(target,'Test raporu');assert.equal(calls.length,1);
 const start=target.querySelector('[data-report-start]'),end=target.querySelector('[data-report-end]'),button=target.querySelector('[data-report-load]');
 start.value='2026-09-01';start.dispatchEvent(new window.Event('input',{bubbles:true}));
 end.value='2026-06-30';end.dispatchEvent(new window.Event('input',{bubbles:true}));
 assert.equal(button.disabled,true);assert.equal(target.querySelector('[data-report-period-error]').hidden,false);
 assert.match(target.querySelector('[data-report-period-error]').textContent,/başlangıcı, dönem sonundan sonra olamaz/);
 button.click();await tick();assert.equal(calls.length,1);assert.throws(()=>ui.read(),/NOT_VERIFIED/);
 end.value='2026-09-30';end.dispatchEvent(new window.Event('input',{bubbles:true}));
 assert.equal(button.disabled,false);assert.equal(target.querySelector('[data-report-period-error]').hidden,true);
});
test('v2 close and controls tabs use verified server rows and keep period lock neutral',async()=>{
 const proof=proofs.find(p=>p.fixture==='single');
 const markup=`<!doctype html><html data-lq-ui="2"><body><select id="v26ActiveCompanySelect"><option value="${proof.body.companyId}" selected>Synthetic Company</option></select><main id="mainContent"></main></body></html>`;
 const {ui,window}=runtime(markup),target=window.document.getElementById('mainContent');adapter(window,[proof]);
 window.GK_TFRS16={getCurrentUserRoles:()=>['ADMIN']};
 await ui.page(target,'Ay Sonu — Backend Hesaplama Kontrolleri','controls');
 assert.ok(target.classList.contains('lq-v2-report'));
 assert.equal(target.querySelector('#lqRcCloseTab').getAttribute('aria-selected'),'true');
 assert.match(target.querySelector('[data-report-output]').textContent,/Kapanış durumu/);
 assert.equal(target.querySelector('#lqRcCloseTab').tabIndex,0);
 assert.equal(target.querySelector('#lqRcControlsTab').tabIndex,-1);
 assert.match(target.querySelector('.lq-rc-role-note').textContent,/ADMIN yetkisindedir/);
 assert.match(target.querySelector('.lq-rc-role-note').textContent,/sunucu tarafından doğrulanmış rol/);
 assert.doesNotMatch(target.querySelector('.lq-rc-role-note').textContent,/ADMIN rolü doğrulandı/);
 assert.equal(target.querySelectorAll('[data-close-action]').length,0);
 assert.ok(target.querySelector('.lq-rc-facts').textContent.includes(proof.package.identity.companyName));
 assert.match(target.querySelector('.lq-rc-facts').textContent,/Hesaplama kontrolleri/);
 target.querySelector('#lqRcControlsTab').click();
 assert.equal(target.querySelector('#lqRcControlsTab').getAttribute('aria-selected'),'true');
 assert.equal(target.querySelector('#lqRcControlsTab').tabIndex,0);
 assert.equal(target.querySelectorAll('[data-check-row]').length,proof.package.controls.checks.length);
 assert.equal(target.querySelectorAll('[data-report-export]').length,5);
 const serverDescriptions=proof.package.controls.checks.map(row=>row.description).filter(Boolean);
 serverDescriptions.forEach(description=>assert.ok(target.querySelector('[data-report-output]').textContent.includes(description)));
 assert.doesNotMatch(target.querySelector('[data-report-output]').textContent,/Kira yükümlülüğü\s+\d/);
 target.querySelector('#lqRcControlsTab').dispatchEvent(new window.KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));
 assert.equal(target.querySelector('#lqRcCloseTab').getAttribute('aria-selected'),'true');
 assert.equal(window.document.activeElement.id,'lqRcCloseTab');
 target.querySelector('[data-rc-go-controls]').click();
 assert.equal(target.querySelector('#lqRcControlsTab').getAttribute('aria-selected'),'true');
 window.close();
});
test('v2 controls route opens on the server control table; legacy route does not receive v2 shell',async()=>{
 const proof=proofs.find(p=>p.fixture==='single');
 const markup=`<!doctype html><html data-lq-ui="2"><body><main id="mainContent"></main></body></html>`;
 const {ui,window}=runtime(markup),target=window.document.getElementById('mainContent');adapter(window,[proof]);
 window.GK_TFRS16={getCurrentUserRoles:()=>['ADMIN']};
 await ui.page(target,'Backend Hesaplama Kontrolleri','controls');
 assert.equal(target.querySelector('#lqRcControlsTab').getAttribute('aria-selected'),'true');
 assert.match(target.querySelector('.lq-rc-role-note').textContent,/yetki doğrulanmış gösterilmez/);
 assert.match(target.querySelector('.lq-rc-disclaimer').textContent,/dönem kapatma veya yevmiye kaydı değildir/);
 window.close();

 const legacy=runtime(),legacyTarget=legacy.window.document.getElementById('mainContent');adapter(legacy.window,[proof]);
 await legacy.ui.page(legacyTarget,'Backend Hesaplama Kontrolleri','controls');
 assert.equal(legacyTarget.classList.contains('lq-v2-report'),false);
 assert.equal(legacyTarget.querySelector('.lq-rc-page'),null);
 legacy.window.close();
});
test('report transport authenticates storage-only sessions without changing closed journal/disclosure intent',async()=>{
 const {window,load,ui}=runtime(),proof=proofs[0],calls=[];window.localStorage.setItem('access_token','STORAGE-TEST-ONLY');window.setTimeout=setTimeout;window.clearTimeout=clearTimeout;
 window.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,status:200,json:async()=>({success:true,data:proof.package})};};load('js/private-calculation-api.js');await ui.load(proof.body);
 assert.equal(calls[0].options.headers.Authorization,'Bearer STORAGE-TEST-ONLY');assert.deepEqual(JSON.parse(calls[0].options.body),proof.body);
});
test('CFO/report page filters, sorts and exports server data; source failure clears stale data',async()=>{
 const {ui,window}=runtime();adapter(window,[proofs[0]]);const target=window.document.getElementById('mainContent');await ui.page(target,'CFO');
 assert.deepEqual(plain(ui.read()),proofs[0].package);const initial=ui.serialize(ui.read(),'csv');
 const filter=target.querySelector('[data-report-filter]');filter.value='leaseLiability';filter.oninput();assert.ok(target.querySelector('tbody tr[hidden]'));
 target.querySelector('[data-report-sort]').onchange();assert.equal(ui.serialize(ui.read(),'csv'),initial);assert.equal(target.querySelectorAll('[data-report-export]').length,5);
 window.LeaseQantPrivateCalculation.getReportingAuthorityPackage=async()=>{throw Object.assign(Error('Unavailable'),{code:'SOURCE_NOT_READY'});};await target.querySelector('[data-report-load]').onclick();
 assert.match(target.textContent,/SOURCE_NOT_READY/);assert.equal(target.querySelectorAll('[data-report-export]').length,0);assert.throws(()=>ui.read(),/NOT_VERIFIED/);
});
test('report page follows the active authorized company and safely falls back for tenant-wide selection',async()=>{
 const active=proofs.find(p=>p.fixture==='multiple'),other=proofs.find(p=>p.fixture==='single'),allowed=[other,active];
 const markup=`<select id="v26ActiveCompanySelect"><option value="ALL">Tüm Şirketler</option><option value="${active.body.companyId}" selected>${active.package.identity.companyName}</option></select><main id="mainContent"></main>`;
 const {ui,window}=runtime(markup),target=window.document.getElementById('mainContent');adapter(window,allowed);
 const requested=[],getPackage=window.LeaseQantPrivateCalculation.getReportingAuthorityPackage;
 window.LeaseQantPrivateCalculation.getReportingAuthorityPackage=async intent=>{requested.push(plain(intent));return getPackage(intent);};
 await ui.page(target,'Finansal Rapor');
 const localCompany=target.querySelector('[data-report-company]'),headerCompany=window.document.getElementById('v26ActiveCompanySelect');
 assert.equal(localCompany.value,active.body.companyId);assert.equal(requested[0].companyId,active.body.companyId);
 headerCompany.value='ALL';localCompany.value=other.body.companyId;localCompany.dispatchEvent(new window.Event('change',{bubbles:true}));await tick();
 assert.equal(requested.at(-1).companyId,other.body.companyId);assert.equal(headerCompany.value,'ALL');

 const fallbackRuntime=runtime('<select id="v26ActiveCompanySelect"><option value="ALL" selected>Tüm Şirketler</option></select><main id="mainContent"></main>');
 adapter(fallbackRuntime.window,allowed);const fallbackTarget=fallbackRuntime.window.document.getElementById('mainContent');
 await fallbackRuntime.ui.page(fallbackTarget,'Finansal Rapor');
 assert.equal(fallbackTarget.querySelector('[data-report-company]').value,other.body.companyId);
 assert.equal(fallbackRuntime.ui.read().identity.companyId,other.body.companyId);
});
test('company dashboard and old shell ID aliases show per-company authority; mixed/zero are explicit',async()=>{
 const ids=['leaseLiability','rouAssets','currentLiability','next12Months','monthlyInterest','monthlyDepreciation','contractCount','renewals90Days','modifications','kpiDataAsOf','kpiLiability','kpiRou','kpiCurrent','kpiContractCount'];
 const selected=proofs.filter(p=>['single','multiple','mixed','zero'].includes(p.fixture));
 const selector=`<select id="v26ActiveCompanySelect"><option value="ALL">Tüm Şirketler</option>${selected.map(p=>`<option value="${p.body.companyId}">${p.package.identity.companyName}</option>`).join('')}</select>`;
 const {ui,window}=runtime(selector+ids.map(id=>`<span id="${id}"></span>`).join(''));adapter(window,selected);
 let legacy=0;window.GK_TFRS16={getTotalLeaseLiability:()=>{legacy++;throw Error('fallback');}};
 await ui.dashboard();assert.equal(legacy,0);const packages=window.__GK_TFRS16_DASHBOARD_METRICS__.packages;
 assert.equal(packages.length,4);window.__GK_TFRS16_DASHBOARD_METRICS__.groups.forEach((g,i)=>assert.equal(g.liability,packages[i].totals.leaseLiability.value));
 assert.equal(window.document.getElementById('leaseLiability').textContent,'Şirket seçin');
 assert.match(window.document.getElementById('kpiDataAsOf').textContent,/Finansal tutar için şirket seçin/);
 assert.equal(window.document.getElementById('renewals90Days').textContent,'Kaynak verisi gerekli');
 assert.equal(window.document.getElementById('kpiLiability').textContent,window.document.getElementById('leaseLiability').textContent);
 const company=window.document.getElementById('v26ActiveCompanySelect');
 company.value=proofs.find(p=>p.fixture==='single').body.companyId;ui.refreshDashboardPresentation();
 assert.equal(window.document.getElementById('leaseLiability').textContent,new Intl.NumberFormat('tr-TR',{maximumFractionDigits:2}).format(proofs.find(p=>p.fixture==='single').package.totals.leaseLiability.value)+' TRY');
 company.value=proofs.find(p=>p.fixture==='zero').body.companyId;ui.refreshDashboardPresentation();
 assert.equal(window.document.getElementById('leaseLiability').textContent,'0 TRY');
 assert.match(window.document.getElementById('kpiDataAsOf').textContent,/aktif sözleşme yok/);
 assert.equal(window.document.getElementById('contractCount').textContent,'0');
 company.value=proofs.find(p=>p.fixture==='mixed').body.companyId;ui.refreshDashboardPresentation();
 assert.equal(window.document.getElementById('leaseLiability').textContent,'Bu sözleşme türü için rapor rotası desteklenmiyor');
 window.LeaseQantPrivateCalculation.getReportingCompanies=async()=>{throw Error('failure');};await ui.dashboard();assert.equal(window.__GK_TFRS16_DASHBOARD_METRICS__,null);assert.equal(window.document.getElementById('contractCount').textContent,'Veri alınamadı');
});
test('contract summary, payment plan and audit use persisted source, never client financial values',async()=>{
 const {ui,window}=runtime('<div id="detail"><div data-authoritative-report-summary></div><div data-authoritative-report-schedule></div><div data-authoritative-report-audit></div></div>');adapter(window,[proofs[0]]);const p=proofs[0].package,target=window.document.getElementById('detail');
 await ui.renderContractDetails(target,{id:p.contracts[0].contractId,companyId:p.identity.companyId,monthlyPayment:99999999,schedule:[{interest:88888888}]});assert.match(target.textContent,new RegExp(p.contracts[0].calculationId));assert.ok(!target.textContent.includes('99999999'));
 const accepted=await ui.acceptPackage(p,p.period),rows=ui.rawRows(accepted,'metrics',p.contracts[0].contractId);rows.forEach(r=>assert.equal(r.value,p.contracts[0].metrics[r.metric].value));
 assert.throws(()=>ui.rawRows(accepted,'metrics','FOREIGN'),/NOT_READY/);
 await ui.renderContractDetails(target,{id:'FOREIGN',companyId:p.identity.companyId});assert.match(target.textContent,/SOURCE_NOT_READY/);assert.equal(target.querySelectorAll('table').length,0);
});

test('contract terms through the recorded 2030 expiry remain visible when trusted reporting is unavailable',async()=>{
 const {ui,window,load}=runtime('<div id="detail"></div>');
 window.GK_TFRS16={
  escapeHtml:value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
  formatDate:value=>String(value).split('-').reverse().join('.'),
  formatPresentationCurrency:value=>`₺${Number(value).toLocaleString('tr-TR')}`,
  resolvePaymentFrequencyLabel:()=> 'Aylık'
 };
 load('js/tfrs16-reporting-ui.js');
 const contract={id:'111',company:'Financial Intelligence Platform',supplier:'<img src=x onerror=alert(1)>',startDate:'2025-02-28',endDate:'2030-02-28',monthlyPayment:10000,currency:'TRY',paymentFrequency:'MONTHLY'};
 const presentation=window.LeaseQantTfrs16ReportingUi;
 const target=window.document.getElementById('detail');
 target.innerHTML=presentation.renderContractSummaryTab(contract)+presentation.renderContractPaymentTerms(contract)
  +'<div data-authoritative-report-schedule>Güvenilir raporlama kaynağı yükleniyor...</div><div data-authoritative-report-audit></div>';
 window.LeaseQantPrivateCalculation={getReportingAuthorityPackage:async()=>{const error=new Error('Approved currency profile required');error.code='REPORTING_CURRENCY_PROFILE_REQUIRED';throw error;}};
 await ui.renderContractDetails(target,contract);
 assert.match(target.querySelector('[data-contract-source-facts]').textContent,/28\.02\.2030/);
 assert.match(target.querySelector('[data-contract-source-facts]').textContent,/28\.02\.2025/);
 assert.match(target.querySelector('[data-contract-source-facts]').textContent,/10\.000/);
 assert.match(target.querySelector('[data-contract-source-terms]').textContent,/28\.02\.2030/);
 assert.match(target.querySelector('[data-authoritative-report-summary]').textContent,/Onaylı para birimi profili gerekli/);
 assert.match(target.querySelector('[data-authoritative-report-schedule]').textContent,/REPORTING_CURRENCY_PROFILE_REQUIRED/);
 assert.equal(target.querySelector('[data-contract-source-facts] img'),null);
 assert.match(target.querySelector('[data-contract-source-facts]').textContent,/<img src=x onerror=alert\(1\)>/);
});

test('Contracts row action opens the selected contract from a pointer click',()=>{
 const {window,load}=runtime('<table><tbody id="contractsTableBody"></tbody></table><div id="emptyState"></div><span id="resultCount"></span><input id="searchInput">');
 const opened=[];
 window.GK_TFRS16={getPortfolioContracts:()=>[{id:'111',company:'Financial Intelligence Platform',supplier:'abc',startDate:'2025-02-28',endDate:'2030-02-28',monthlyPayment:10000,currency:'TRY',status:'active'}],
  escapeHtml:value=>String(value??''),formatDate:value=>String(value??''),formatPortfolioAmount:value=>String(value??''),
  isRenewalWithin90Days:()=>false,v26StandardsBadgeHtml:()=>'',v26ContractMatchesActiveCompany:()=>true,
  openDetail:id=>opened.push(String(id))};
 load('js/tfrs16-portfolio-ui.js');
 window.document.querySelector('.row-action').click();
 assert.deepEqual(opened,['111']);
});
test('actual active main reporting entrypoints/gates and database view never call retained accounting',async()=>{
 const {ui,window,context}=runtime();adapter(window,[proofs[0]]);const source=fs.readFileSync(path.join(root,'js/tfrs16-ui.js'),'utf8');
 const start=source.indexOf('  // REPORT-AUTH-R1 active boundaries.'),end=source.indexOf('  function journalAuthorityUnavailable()',start);assert.ok(end>start);
 context.contracts=[{id:proofs[0].package.contracts[0].contractId,companyId:proofs[0].body.companyId}];context.setText=(id,v)=>{const e=window.document.getElementById(id);if(e)e.textContent=v;};window.LeaseQantTfrs16JournalUi={databasePreview:()=>({status:'JOURNAL_AUTHORITY_UNAVAILABLE',journals:[],journalLines:[]})};
 vm.runInContext(source.slice(start,end),context);
 await vm.runInContext('v191OpenCfoDashboard()',context);assert.deepEqual(plain(vm.runInContext('getCfoDashboardData()',context)),proofs[0].package);
 for(const name of ['getTotalLeaseLiability','getTotalRuoAssets','getCurrentLeaseLiability','cfoAggregateRows','getLeaseLiabilityMovementNote','getForecastBalanceSheet','getFxTranslationReport','v26ConvertScheduleToPresentation','v26ConvertJsonMoneyToPresentation','convertAmountToReportingCurrency']){
  if(vm.runInContext(`typeof ${name}`,context)==='function')assert.throws(()=>vm.runInContext(`${name}()`,context),/REPORTING_AUTHORITY_UNAVAILABLE/);
 }
 const model=plain(vm.runInContext('v20GetDatabaseModel()',context));assert.deepEqual(model.reportingMetrics,plain(ui.rawRows(ui.read())));assert.deepEqual(model.schedules,plain(ui.rawRows(ui.read(),'schedule')));assert.equal(model.journalAuthorityStatus,'JOURNAL_AUTHORITY_UNAVAILABLE');
 assert.equal(vm.runInContext('getWeightedAverageDiscountRate().value',context),null);assert.equal(vm.runInContext('getFutureLeasesKPI().value',context),null);
 assert.equal(vm.runInContext('formatPortfolioAmount(1234.56789,"TRY","USD")',context),'Onaylı döviz kuru kaynağı gerekli');
 const shell=fs.readFileSync(path.join(root,'js/shell.js'),'utf8');const active=shell.slice(shell.indexOf('window.__shellUpdateKpis = function'),shell.indexOf('/* ---------- Session display'));
 let calls=0;window.LeaseQantReportingAuthorityUi={dashboard:()=>{calls++;return Promise.resolve();}};vm.runInContext(active,context);await window.__shellUpdateKpis({liability:99999999});assert.equal(calls,1);
 const boot=shell.slice(shell.indexOf('/* ---------- Boot'));assert.ok(!boot.includes('getTotalLeaseLiability'));assert.ok(!boot.includes('legacyShellUpdateKpis'));
});
test('standalone portal/CFO retired demo is inert; current pages load real reporting authority',()=>{
 for(const name of ['dashboard.html','financial-decision-cockpit.html']){const doc=new JSDOM(fs.readFileSync(path.join(root,name),'utf8')).window.document;
  assert.ok(doc.getElementById('backendReportingPage'));assert.ok(doc.querySelector('template[data-report-auth-retired]'));assert.ok(doc.querySelector('script[type="text/plain"][data-report-auth-retired]'));
  assert.ok(doc.querySelector('script[src^="js/tfrs16-report-authority-ui.js"]'));assert.ok(!doc.getElementById('printBtn'));assert.ok(!doc.getElementById('contractTableBody'));
  const active=Array.from(doc.querySelectorAll('script:not([type="text/plain"])')).map(s=>s.textContent).join('\n');assert.ok(!active.includes('const CONTRACTS='));assert.match(active,/LeaseQantReportingAuthorityUi.page/);
 }
 const html=fs.readFileSync(path.join(root,'tfrs16.html'),'utf8');assert.ok(html.indexOf('js/tfrs16-report-authority-ui.js')<html.indexOf('js/tfrs16-ui.js'));
});
