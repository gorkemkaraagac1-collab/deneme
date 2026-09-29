'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const source=fs.readFileSync(path.join(__dirname,'../js/tfrs16-operations-ui.js'),'utf8');
function changeSection(kind) {
 const mod=kind==='modification';
 const submit=mod?'createModificationButton':'createReassessmentButton';
 const title=mod?'Kira Modifikasyonu':'Kira Reassessment İşlemi';
 const first=mod?['modificationDate','modificationEffectiveDate','modificationType','modificationReason']:['reassessmentDate','reassessmentEffectiveDate','reassessmentType','reassessmentReason'];
 const second=mod?['modificationNewPayment','modificationNewEndDate','modificationNewDiscountRate','modificationScopeReduction','modificationScopeIncrease']:['reassessmentNewPayment','reassessmentNewEndDate','reassessmentNewDiscountRate','reassessmentRenewalOption','reassessmentTerminationOption','reassessmentPurchaseOption'];
 const fields=ids=>ids.map(id=>`<label>${id}<input id="${id}" /></label>`).join('');
 return `<div style="margin-top:28px"><div><h3>${title}</h3></div><div style="padding:14px"><div style="display:grid">${fields([...first,...second])}</div><button id="${submit}" type="button">Oluştur</button></div><div><button type="button" data-${mod?'mod':'reass'}-action="apply" data-${mod?'mod':'reass'}-id="EV-1">Uygula</button></div></div>`;
}
test('modification page opens when the separate pending-approvals report is unavailable',()=>{
 const dom=new JSDOM('<main id="host"></main>',{url:'https://example.test/tfrs16.html',runScripts:'outside-only'}),w=dom.window;
 w.GK_TFRS16={getOperationContracts:()=>[],getModificationReport:()=>{throw Error('REPORTING_AUTHORITY_UNAVAILABLE');},
  getReassessmentReport:()=>{throw Error('REPORTING_AUTHORITY_UNAVAILABLE');}};
 w.eval(source);w.LeaseQantTfrs16OperationsUi.renderModificationReassessment(w.document.getElementById('host'));
 const text=w.document.getElementById('host').textContent;
 assert.match(text,/Modifikasyon & Reassessment/);assert.match(text,/rapor kaynağı henüz hazır değil/);
 assert.ok(!text.includes('REPORTING_AUTHORITY_UNAVAILABLE'));
 dom.window.close();
});

function operationDom(uiVersion='2') {
 const dom=new JSDOM('<main id="host"></main>',{url:'https://example.test/tfrs16.html',runScripts:'outside-only'}),w=dom.window;
 if(uiVersion)w.document.documentElement.setAttribute('data-lq-ui',uiVersion);
 w.GK_TFRS16={
  getOperationContracts:()=>[{id:'LEASE-TEST-01',company:'Synthetic Test',supplier:'Lessor A',startDate:'2025-02-28',endDate:'2030-12-31'}],
  formatDate:value=>{const s=String(value||'');return /^\d{4}-\d{2}-\d{2}$/.test(s)?`${s.slice(8,10)}.${s.slice(5,7)}.${s.slice(0,4)}`:s;},
  v26SelectedContractBanner:()=>'',
  getModificationReport:()=>({rows:[]}),getReassessmentReport:()=>({rows:[]}),
  renderModificationManagementSection:()=>changeSection('modification'),
  renderReassessmentManagementSection:()=>changeSection('reassessment'),
  initModificationEventsById:()=>{},initReassessmentEventsById:()=>{},
  renderSlbSection:contract=>{w.document.getElementById('slbSectionContainer').innerHTML=w.LeaseQantTfrs16OperationsUi.renderSlbForm(contract);},
  renderSubleaseSection:contract=>{w.document.getElementById('subleaseSectionContainer').innerHTML=w.LeaseQantTfrs16OperationsUi.renderSubleaseForm(contract);}
 };
 w.eval(source);
 return {dom,w,ui:w.LeaseQantTfrs16OperationsUi,host:w.document.getElementById('host')};
}

test('v2 modification and reassessment arrange existing controls into source-honest flow stages',()=>{
 const {dom,w,ui,host}=operationDom();
 ui.renderModificationReassessment(host);
 assert.ok(host.querySelector('.lq-op-layout'));
 assert.ok(host.querySelector('.lq-op-main #v26ModReassContractSelect'));
 assert.ok(host.querySelector('#createModificationButton'));
 assert.ok(host.querySelector('#createReassessmentButton'));
 assert.equal(host.querySelectorAll('.lq-op-event-block').length,2);
 assert.equal(host.querySelectorAll('.lq-op-stepper').length,2);
 assert.ok(host.querySelector('.lq-op-stepper[aria-label="Yeniden değerlendirme akışı"]'));
 assert.equal(host.querySelector('#modificationDate').closest('.lq-op-stage').querySelector('.lq-op-stage-title').textContent,'01 · Değişikliği tanımla');
 assert.equal(host.querySelector('#modificationNewPayment').closest('.lq-op-stage').querySelector('.lq-op-stage-title').textContent,'02 · Yeni şartları gir');
 assert.equal(host.querySelector('#reassessmentReason').closest('.lq-op-stage').querySelector('.lq-op-stage-title').textContent,'01 · Değişikliği tanımla');
 assert.equal(host.querySelector('#reassessmentPurchaseOption').closest('.lq-op-stage').querySelector('.lq-op-stage-title').textContent,'02 · Yeni şartları gir');
 assert.equal(host.querySelector('#createModificationButton').closest('.lq-op-form-actions')?.className,'lq-op-form-actions');
 assert.match(host.querySelector('.lq-op-side').textContent,/Kaynak gerekli/);
 assert.match(host.querySelector('.lq-op-summary-list').textContent,/28\.02\.2025/);
 assert.doesNotMatch(host.textContent,/0,00|0\.00/);
 const calls=[];
 ui.bindModificationEvents({}, {submitForm:()=>calls.push('mod-create'),handleAction:(action,id)=>calls.push(`mod-${action}-${id}`)});
 ui.bindReassessmentEvents({}, {submitForm:()=>calls.push('reass-create'),handleAction:(action,id)=>calls.push(`reass-${action}-${id}`)});
 host.querySelector('#createModificationButton').click();
 host.querySelector('[data-mod-action="apply"]').click();
 host.querySelector('#createReassessmentButton').click();
 host.querySelector('[data-reass-action="apply"]').click();
 assert.deepEqual(calls,['mod-create','mod-apply-EV-1','reass-create','reass-apply-EV-1']);
 dom.window.close();
});

test('v2 sale-and-leaseback and sublease keep legacy form ids and move only server-result slots to the impact panel',()=>{
 const {dom,ui,host}=operationDom();
 ui.renderSaleAndLeaseback(host);
 assert.ok(host.querySelector('#v26SlbContractSelect'));
 assert.ok(host.querySelector('#slbCarryingAmount'));
 assert.ok(host.querySelector('#slbCalculateButton'));
 assert.equal(host.querySelector('#lqOpImpactResult #slbResultContainer')?.parentElement.id,'lqOpImpactResult');
 assert.match(host.querySelector('#lqOpImpactResult').textContent,/Kaynak gerekli/);
 ui.renderSublease(host);
 assert.ok(host.querySelector('#v26SubleaseContractSelect'));
 assert.ok(host.querySelector('#subleaseMonthlyPayment'));
 assert.ok(host.querySelector('#subleaseClassification'));
 assert.ok(host.querySelector('#subleaseCalculateButton'));
 assert.equal(host.querySelector('#lqOpImpactResult #subleaseResultContainer')?.parentElement.id,'lqOpImpactResult');
 assert.match(host.querySelector('#lqOpImpactResult').textContent,/Kaynak gerekli/);
 dom.window.close();
});

test('existing operation buttons still dispatch their original callbacks under v2',()=>{
 const {dom,w,ui,host}=operationDom();
 host.innerHTML='<button id="slbCalculateButton"></button><button id="subleaseCalculateButton"></button><button id="createModificationButton"></button><button id="createReassessmentButton"></button><button data-mod-action="apply" data-mod-id="M-1"></button><button data-reass-action="apply" data-reass-id="R-1"></button>';
 const calls=[];
 ui.bindSlbEvents({}, {calculateAndRender:persist=>calls.push(['slb',persist])});
 ui.bindSubleaseEvents({}, {calculateAndRender:persist=>calls.push(['sublease',persist])});
 ui.bindModificationEvents({}, {submitForm:()=>calls.push(['mod-create']),handleAction:(action,id)=>calls.push(['mod',action,id])});
 ui.bindReassessmentEvents({}, {submitForm:()=>calls.push(['reass-create']),handleAction:(action,id)=>calls.push(['reass',action,id])});
 for(const id of ['slbCalculateButton','subleaseCalculateButton','createModificationButton','createReassessmentButton'])w.document.getElementById(id).click();
 host.querySelector('[data-mod-action]').click();host.querySelector('[data-reass-action]').click();
 assert.deepEqual(calls,[['slb',true],['sublease',true],['mod-create'],['reass-create'],['mod','apply','M-1'],['reass','apply','R-1']]);
 dom.window.close();
});

test('legacy operations markup remains outside the v2 layer',()=>{
 const {dom,ui,host}=operationDom(null);
 ui.renderSaleAndLeaseback(host);
 assert.ok(host.querySelector('.gk-v26-page'));
 assert.equal(host.querySelector('.lq-op-page'),null);
 assert.equal(host.querySelector('.lq-op-layout'),null);
 assert.ok(host.querySelector('#slbCalculateButton'));
 ui.renderSublease(host);
 assert.equal(host.querySelector('.lq-op-page'),null);
 assert.ok(host.querySelector('#subleaseCalculateButton'));
 ui.renderModificationReassessment(host);
 assert.equal(host.querySelector('.lq-op-page'),null);
 assert.ok(host.querySelector('#createModificationButton'));
 assert.ok(host.querySelector('#createReassessmentButton'));
 assert.equal(host.querySelectorAll('.lq-op-stepper').length,0);
 assert.equal(host.querySelectorAll('.lq-op-stage').length,0);
 dom.window.close();
});
