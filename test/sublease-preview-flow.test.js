'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const ui=fs.readFileSync('js/tfrs16-operations-ui.js','utf8'),runtime=fs.readFileSync('js/tfrs16-ui.js','utf8');
const helper=runtime.slice(runtime.indexOf('  function bindPersistedOperationForm('),runtime.indexOf('  function renderSlbSection('));
const section=runtime.slice(runtime.indexOf('  function renderSubleaseSection('),runtime.indexOf('  function updateScheduleSubPeriodUI('));
const tick=()=>new Promise(r=>setTimeout(r,0));
function setup(preview){
 const dom=new JSDOM('<html data-lq-ui="2"><div id="subleaseSectionContainer"></div></html>',{runScripts:'outside-only'}),w=dom.window,calls=[];
 const contract={id:'C1',companyId:'CO1',currency:'TRY'},period={reportingDate:'2026-08-31'};
 w.contracts=[contract];w.saveContracts=()=>calls.push('local-save');w.LeaseQantReportingPeriod={get:()=>({...period})};
 w.eval(ui);w.LeaseQantTfrs16OperationsUi.renderSubleaseResultHtml=()=>'<p>Sunucu sonucu</p>';
 w.LeaseQantPrivateTfrs16Facade={
  previewPersistedOperation:async(id,intent)=>{calls.push(['preview',JSON.parse(JSON.stringify(intent))]);return preview?preview(intent):{result:{},receipt:'opaque-fixture',saveAuthority:'FORM_ONLY'};},
  saveOperationForm:async(id,intent,receipt)=>{calls.push(['save',JSON.parse(JSON.stringify(intent)),receipt]);}
 };
 w.eval(helper+section+'\nwindow.mount = renderSubleaseSection;');w.mount(contract);
 const get=id=>w.document.getElementById(id);
 get('subleaseMonthlyPayment').value='30';get('subleaseDiscountRate').value='5';get('subleaseStartDate').value='2026-08-01';get('subleaseEndDate').value='2027-08-01';
 return {dom,w,get,calls,contract,period};
}
test('sublease preview makes no persistence call; save carries exact server receipt and inputs',async()=>{
 const s=setup();s.get('subleaseCalculateButton').click();await tick();
 assert.equal(s.calls.length,1);assert.equal(s.contract.sublease,undefined);assert.equal(s.get('subleaseSaveButton').disabled,false);
 s.get('subleaseSaveButton').click();s.get('subleaseSaveButton').click();await tick();
 assert.equal(s.calls.filter(c=>c[0]==='save').length,1);assert.deepEqual(s.calls[1][1],s.calls[0][1]);assert.equal(s.calls[1][2],'opaque-fixture');
 assert.equal(s.contract.sublease.monthlyPayment,30);assert.equal(s.get('subleaseSaveButton').disabled,true);s.dom.window.close();
});
test('failed or malformed-authority preview cannot save a sublease',async()=>{
 for(const preview of [()=>{throw Error('source unavailable');},()=>({result:{},saveAuthority:'NONE'})]){
  const s=setup(preview);s.get('subleaseCalculateButton').click();await tick();assert.equal(s.get('subleaseSaveButton').disabled,true);
  s.get('subleaseSaveButton').click();await tick();assert.equal(s.calls.length,1);assert.equal(s.contract.sublease,undefined);s.dom.window.close();
 }
});
test('changed classification, period and detached form invalidate sublease preview',async()=>{
 for(const edit of [s=>{s.get('subleaseClassification').value='FINANCE';},s=>{s.period.reportingDate='2026-07-31';},s=>{s.w.mount({id:'C2',companyId:'CO1'});}]){
  const s=setup();s.get('subleaseCalculateButton').click();await tick();edit(s);s.get('subleaseSaveButton').click();await tick();
  assert.equal(s.calls.length,1);assert.equal(s.get('subleaseSaveButton').disabled,true);s.dom.window.close();
 }
});
