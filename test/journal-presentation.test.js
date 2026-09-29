'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {webcrypto,createHash}=require('node:crypto');
const {JSDOM}=require('jsdom');
const src=fs.readFileSync(path.join(__dirname,'../js/tfrs16-journal-ui.js'),'utf8');
const stable=v=>Array.isArray(v)?'['+v.map(stable).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}':JSON.stringify(v);
function fixture(intent){
 const voucher={companyId:intent.companyId,contractId:intent.contractIds[0],periodStart:intent.periodStart,periodEnd:intent.periodEnd,eventType:intent.kind,supportStatus:'SUPPORTED',sourceStatus:'SERVER_PERSISTED_PRIVATE_JOURNAL',livePostingStatus:'NOT_READY_FOR_LIVE_POSTING',balanced:true,currency:'TRY',calculationId:'calc',sourceInputHash:'input',sourceResultHash:'result',accountMappingId:'mapping-1',accountMappingVersion:'APPROVED-3',accountMappingHash:'a'.repeat(64),journalId:'journal-1',totalDebit:1,totalCredit:1,difference:0,lines:[{lineId:'line-1',accountPurpose:'interestExpense',accountCode:'TEST-INTEREST',accountName:'Faiz',currency:'TRY',contractId:intent.contractIds[0],eventId:'event-1',debit:1,credit:0,sourceIds:['calc','result']}]};
 const pkg={schemaVersion:'JOURNAL_AUTHORITY_DTO_V1',...intent,supportStatus:'SUPPORTED',livePostingStatus:'NOT_READY_FOR_LIVE_POSTING',vouchers:[voucher],voucherCount:1,summaryByCurrency:[]};
 pkg.contentHash=createHash('sha256').update(stable(pkg)).digest('hex');return pkg;
}
function page(ui='2',html=''){
 const dom=new JSDOM(`<html data-lq-ui="${ui}"><body>${html}</body></html>`,{url:'https://example.test',runScripts:'outside-only'}),w=dom.window;
 Object.defineProperty(w,'crypto',{value:webcrypto});w.TextEncoder=TextEncoder;
 w.LeaseQantReportingPeriod={get:()=>({periodStart:'2026-08-01',periodEnd:'2026-08-31'})};
 w.eval(src);return {dom,w,ui:w.LeaseQantTfrs16JournalUi};
}
const form=prefix=>`<div id="form"><select id="${prefix}Year"><option value="2025">2025</option></select><select id="${prefix}Month">${[1,7,8].map(n=>`<option value="${n}">${n}</option>`).join('')}</select><select id="${prefix}Period"><option value="monthly">monthly</option><option value="custom">custom</option></select><input id="${prefix}${prefix==='bulkAccounting'?'StartDate':'CustomStart'}"><input id="${prefix}${prefix==='bulkAccounting'?'EndDate':'CustomEnd'}"><div id="${prefix==='bulkAccounting'?'bulkJournalPreview':'journalPreview'}">old</div><button id="exportBulkJournals"></button><div id="bulkJournalSummary">old</div></div>`;
test('single and bulk initialize from common period, retain explicit choices after rerender and clear stale preview',()=>{
 for(const prefix of ['accounting','bulkAccounting']){
  const {dom,w,ui}=page('2',form(prefix)),d=w.document;
  ui.bindPeriodControls(d.getElementById('form'),prefix,'scope');
  assert.equal(d.getElementById(prefix+'Year').value,'2026');assert.equal(d.getElementById(prefix+'Month').value,'8');
  d.getElementById(prefix+'Month').value='7';d.getElementById(prefix+'Month').dispatchEvent(new w.Event('change'));
  assert.match(d.getElementById(prefix==='bulkAccounting'?'bulkJournalPreview':'journalPreview').textContent,/yeniden/);
  d.body.innerHTML=form(prefix);ui.bindPeriodControls(d.getElementById('form'),prefix,'scope');
  assert.equal(d.getElementById(prefix+'Month').value,'7');
  ui.bindPeriodControls(d.getElementById('form'),prefix,'other-contract');assert.equal(d.getElementById(prefix+'Month').value,'8');
  dom.window.close();
 }
});
test('legacy period controls are untouched and missing common source is not replaced by invented period',()=>{
 const {dom,w,ui}=page('legacy',form('accounting'));ui.bindPeriodControls(w.document.getElementById('form'),'accounting','x');assert.equal(w.document.getElementById('accountingMonth').value,'1');
 w.document.documentElement.dataset.lqUi='2';delete w.LeaseQantReportingPeriod;ui.bindPeriodControls(w.document.getElementById('form'),'accounting','x');assert.equal(w.document.getElementById('accountingYear').value,'2025');dom.window.close();
});
test('mapping requires an accepted package and renders only server accounts and evidence',async()=>{
 const {dom,ui}=page();const intent={companyId:'c1',contractIds:['k1'],kind:'PERIOD',periodStart:'2026-08-01',periodEnd:'2026-08-31'},raw=fixture(intent);
 assert.throws(()=>ui.mappingHtml(raw),/JOURNAL_PACKAGE_NOT_VERIFIED/);
 const pkg=await ui.acceptPackage(raw,intent),html=ui.mappingHtml(pkg);
 assert.match(html,/TEST-INTEREST/);assert.match(html,/APPROVED-3/);assert.match(html,/mapping-1/);assert.doesNotMatch(html,/input|amSaveBtn|260\.01/);dom.window.close();
});
test('mapping page filters company and period, refuses cross-company response and clears previous codes',async()=>{
 const {dom,w,ui}=page('2','<div id="host"></div>'),host=w.document.getElementById('host');const calls=[];
 w.LeaseQantPrivateTfrs16Facade={loadJournalAuthorityPackage:async intent=>{calls.push(intent);return fixture({...intent,companyId:'c1'});}};
 ui.renderAccountMapping(host,{companies:[{id:'c1',name:'One'},{id:'c2',name:'Two'}],companyId:'c1',contracts:[{id:'k1',companyId:'c1',status:'active'},{id:'k2',companyId:'c2',status:'active'}]});
 await new Promise(r=>setTimeout(r,35));assert.match(host.textContent,/TEST-INTEREST/);assert.equal(calls[0].periodStart,'2026-08-01');assert.equal(calls[0].contractIds.join(','),'k1');
 host.querySelector('select').value='c2';host.querySelector('select').dispatchEvent(new w.Event('change'));
 await new Promise(r=>setTimeout(r,35));assert.doesNotMatch(host.textContent,/TEST-INTEREST/);assert.match(host.textContent,/alınamadı/);assert.equal(calls[1].contractIds.join(','),'k2');assert.equal(host.querySelector('input'),null);dom.window.close();
});

test('custom period dates survive reopen without inheriting another contract choice',()=>{
 for(const prefix of ['accounting','bulkAccounting']){
  const {dom,w,ui}=page('2',form(prefix)),d=w.document;
  const start=prefix+(prefix==='accounting'?'CustomStart':'StartDate'),end=prefix+(prefix==='accounting'?'CustomEnd':'EndDate');
  ui.bindPeriodControls(d.getElementById('form'),prefix,'custom');
  d.getElementById(prefix+'Period').value='custom';d.getElementById(start).value='2026-06-01';d.getElementById(end).value='2026-06-30';d.getElementById(end).dispatchEvent(new w.Event('change'));
  d.body.innerHTML=form(prefix);ui.bindPeriodControls(d.getElementById('form'),prefix,'custom');
  assert.equal(d.getElementById(prefix+'Period').value,'custom');assert.equal(d.getElementById(start).value,'2026-06-01');assert.equal(d.getElementById(end).value,'2026-06-30');dom.window.close();
 }
});
test('period change invalidates in-flight bulk package before it can be exported',async()=>{
 const {dom,w,ui}=page();let resolve;
 w.LeaseQantPrivateTfrs16Facade={loadJournalAuthorityPackage:intent=>new Promise(r=>{resolve=()=>r(fixture(intent));})};
 const pending=ui.loadBulk([{id:'k1',companyId:'c1'}],{kind:'PERIOD',periodStart:'2026-08-01',periodEnd:'2026-08-31'});
 ui.clearBulk();resolve();await assert.rejects(pending,/JOURNAL_REQUEST_SUPERSEDED/);assert.throws(()=>ui.bulkRows(),/JOURNAL_AUTHORITY_UNAVAILABLE/);dom.window.close();
});
test('mapping refresh ignores a late response from the previous selected company',async()=>{
 const {dom,w,ui}=page('2','<div id="host"></div>'),host=w.document.getElementById('host');let resolveFirst;
 w.LeaseQantPrivateTfrs16Facade={loadJournalAuthorityPackage:intent=>intent.companyId==='c1'?new Promise(r=>{resolveFirst=()=>r(fixture(intent));}):Promise.resolve(fixture(intent))};
 ui.renderAccountMapping(host,{companies:[{id:'c1',name:'One'},{id:'c2',name:'Two'}],companyId:'c1',contracts:[{id:'k1',companyId:'c1',status:'active'},{id:'k2',companyId:'c2',status:'active'}]});
 host.querySelector('select').value='c2';host.querySelector('select').dispatchEvent(new w.Event('change'));await new Promise(r=>setTimeout(r,25));
 resolveFirst();await new Promise(r=>setTimeout(r,25));assert.match(host.textContent,/k2/);assert.doesNotMatch(host.textContent,/k1/);dom.window.close();
});
