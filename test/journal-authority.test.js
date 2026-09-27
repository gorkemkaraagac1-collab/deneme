'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');
const proofs=JSON.parse(fs.readFileSync(process.env.JOURNAL_AUTHORITY_PROOF || '/tmp/journal-auth-r1-numeric.json','utf8')).evidence;
assert.equal(proofs.length,19,'Fresh real API fixture evidence is required; no mocked accounting fixture fallback');
const plain=value=>JSON.parse(JSON.stringify(value));
function runtime(dom) {
  const window=dom?.window || {crypto:webcrypto};
  if(dom) Object.defineProperty(window,'crypto',{value:webcrypto});
  const context=vm.createContext({window,TextEncoder,Uint8Array,Intl,Blob,URLSearchParams,AbortController,
    Promise,Date,Number,String,Set,Map,WeakSet,Object,JSON,console,setTimeout,clearTimeout});
  const load=file=>vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
  load('js/tfrs16-journal-ui.js');
  return {window,context,load,ui:window.LeaseQantTfrs16JournalUi};
}
test('real backend → frontend → XLSX / CSV / TXT / ERP preserve all raw lines and source totals',async()=>{
  const {ui,window}=runtime();
  let xlsxRows;
  window.XLSX={utils:{book_new:()=>({}),json_to_sheet:rows=>{xlsxRows=rows;return rows;},book_append_sheet:()=>{}},writeFile:()=>{}};
  const numeric=[];
  for(const proof of proofs) {
    const pkg=await ui.acceptPackage(proof.package,proof.body);
    const rows=ui.rowsForPackage(pkg);
    ui.exportPackages([pkg],'xlsx');
    const lines=proof.package.vouchers.flatMap(v=>v.lines);
    assert.equal(rows.length,lines.length);
    lines.forEach((line,index)=>{
      assert.equal(rows[index].debit,line.debit);assert.equal(rows[index].credit,line.credit);
      assert.equal(rows[index].accountCode,line.accountCode);assert.equal(rows[index].currency,line.currency);
      assert.equal(xlsxRows[index].debit,line.debit);assert.equal(xlsxRows[index].credit,line.credit);
    });
    for(const format of ['csv','txt','logo','mikro']) {
      const serialized=ui.serialize([pkg],format);
      const sep=format==='txt'?'\t':';';
      const data=serialized.split('\r\n').map(row=>row.split(sep).map(cell=>cell.slice(1,-1).replace(/""/g,'"')));
      const headers=data.shift();
      data.forEach((row,index)=>{
        assert.equal(Number(row[headers.indexOf('debit')]),lines[index].debit);
        assert.equal(Number(row[headers.indexOf('credit')]),lines[index].credit);
      });
    }
    for(const voucher of pkg.vouchers) {
      // Test-only validation; runtime displays the server totals unchanged.
      assert.equal(voucher.lines.reduce((sum,line)=>sum+line.debit,0),voucher.totalDebit);
      assert.equal(voucher.lines.reduce((sum,line)=>sum+line.credit,0),voucher.totalCredit);
      assert.ok(Math.abs(voucher.difference)<0.01);
      numeric.push({fixture:proof.fixture,event:voucher.eventType,currency:voucher.currency,
        journalId:voucher.journalId,backendDebit:voucher.totalDebit,backendCredit:voucher.totalCredit,
        difference:voucher.difference,frontendDebitDelta:0,frontendCreditDelta:0,exportDebitDelta:0,exportCreditDelta:0});
    }
  }
  fs.writeFileSync('/tmp/journal-auth-r1-frontend-numeric.json',JSON.stringify(numeric,null,2));
});

test('missing lines, changed sides, mapping, currency, source, balance and totals are rejected without repair',async()=>{
  const {ui}=runtime();
  const proof=proofs.find(p=>p.fixture==='monthly' && p.body.kind==='PERIOD');
  const attacks={missing:p=>p.vouchers[0].lines.pop(),debit:p=>p.vouchers[0].lines[0].debit+=1,
    credit:p=>p.vouchers[0].lines[0].credit+=1,account:p=>p.vouchers[0].lines[0].accountCode='FORGED',
    currency:p=>p.vouchers[0].lines[0].currency='USD',source:p=>p.vouchers[0].sourceResultHash='FORGED',
    balance:p=>p.vouchers[0].balanced=false,total:p=>p.vouchers[0].totalDebit='malformed',
    route:p=>p.vouchers[0].route='P8_FORGED'};
  for(const mutate of Object.values(attacks)) {
    const tampered=structuredClone(proof.package);mutate(tampered);
    await assert.rejects(ui.acceptPackage(tampered,proof.body),/JOURNAL_RESPONSE/);
  }
  const accepted=await ui.acceptPackage(proof.package,proof.body);
  assert.equal(Object.isFrozen(accepted.vouchers[0].lines[0]),true);
  assert.throws(()=>ui.rowsForPackage(plain(accepted)),/NOT_VERIFIED/);
  assert.throws(()=>ui.exportPackages([accepted.vouchers[0].lines],'csv'),/NOT_VERIFIED/);
  await assert.rejects(ui.acceptPackage(proof.package,{...proof.body,companyId:'FOREIGN'}),/INVALID/);
});

test('authenticated journal adapter sends intent only and preserves the raw complete response',async()=>{
  const {window,load,ui}=runtime();
  const proof=proofs[0],calls=[];
  window.tfrs16GetToken=()=> 'TEST-TOKEN-ONLY';window.setTimeout=setTimeout;window.clearTimeout=clearTimeout;
  window.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,status:200,json:async()=>({success:true,data:proof.package})};};
  load('js/private-calculation-api.js');load('js/private-tfrs16-facade.js');
  const pkg=await ui.loadSingle({id:proof.body.contractIds[0],companyId:proof.body.companyId},{kind:proof.body.kind,periodStart:proof.body.periodStart,periodEnd:proof.body.periodEnd});
  assert.match(calls[0].url,/\/api\/journals\/preview$/);
  assert.equal(calls[0].options.headers.Authorization,'Bearer TEST-TOKEN-ONLY');
  assert.deepEqual(JSON.parse(calls[0].options.body),proof.body);
  assert.deepEqual(plain(pkg),proof.package);
});

test('API/adapter failure cannot trigger a schedule, FX, principal or account-mapping fallback',async()=>{
  const {ui,window}=runtime();
  const proof=proofs[0],contract={id:proof.body.contractIds[0],companyId:proof.body.companyId};
  let legacyCalls=0;
  for(const name of ['calculateLease','applyAccountMappingToJournal','buildFunctionalCurrencyJournalEntries','getJournalForPeriod']) {
    window[name]=()=>{legacyCalls++;throw Error('legacy accounting called');};
  }
  await assert.rejects(ui.loadSingle(contract,proof.body),/UNAVAILABLE/);
  window.LeaseQantPrivateTfrs16Facade={loadJournalAuthorityPackage:async()=>{throw Object.assign(Error('offline'),{code:'JOURNAL_AUTHORITY_UNAVAILABLE'});}};
  await assert.rejects(ui.loadBulk([contract],proof.body),/offline/);
  assert.throws(()=>ui.exportBulk('csv'),/POPULATION_EMPTY/);
  window.LeaseQantPrivateTfrs16Facade.loadJournalAuthorityPackage=async()=>({journal:[]});
  await assert.rejects(ui.loadSingle(contract,proof.body),/INVALID/);
  assert.equal(legacyCalls,0);
});

test('single and bulk active application entry functions render accepted DTOs under legacy feature mode',async()=>{
  const dom=new JSDOM('<div id="journalPreview"></div><div id="bulkJournalPreview"></div><div id="bulkJournalSummary"></div><button id="exportBulkJournals"></button><input id="accountingYear" value="2026"><input id="accountingPeriod" value="monthly"><input id="accountingMonth" value="1"><input id="bulkAccountingYear" value="2026"><input id="bulkAccountingPeriod" value="monthly"><input id="bulkAccountingMonth" value="1">');
  const {window,context,ui}=runtime(dom);
  const proof=proofs.find(p=>p.fixture==='monthly' && p.body.kind==='PERIOD');
  const contract={id:proof.body.contractIds[0],companyId:proof.body.companyId,status:'active'};
  let calls=0;
  window.LEASEQANT_CALCULATION_API_PRIMARY=false;
  window.LeaseQantPrivateTfrs16Facade={loadJournalAuthorityPackage:async()=>{calls++;return proof.package;}};
  Object.assign(context,{document:dom.window.document,contracts:[contract],bulkJournalData:[],hideLoading:()=>{},
    escapeHtml:String,parseDate:x=>new Date(x+'T00:00:00'),v23DateKey:d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,
    getBulkJournalPeriodDates:()=>({periodStart:new Date(2026,0,1),periodEnd:new Date(2026,0,31)})});
  const source=fs.readFileSync(path.join(root,'js/tfrs16-ui.js'),'utf8');
  const active=source.slice(source.indexOf('  function journalAuthorityUnavailable() {'),source.indexOf('  async function legacyGenerateSelectedJournal('));
  for(const forbidden of ['calculateLease(','buildAccrualJournalSummary(','applyAccountMappingToJournal(','appendFx','principalFn','reduce(','generateInitialEntry(']) assert.equal(active.includes(forbidden),false,forbidden);
  vm.runInContext(active,context);
  await vm.runInContext('generateSelectedJournal(contracts[0])',context);
  assert.match(dom.window.document.getElementById('journalPreview').innerHTML,/SYN-/);
  await vm.runInContext('generateBulkJournals()',context);
  assert.match(dom.window.document.getElementById('bulkJournalPreview').innerHTML,/SYN-/);
  assert.equal(calls,2);
  assert.equal(dom.window.document.getElementById('exportBulkJournals').disabled,false);
  const database = ui.databasePreview();
  assert.equal(database.status,'SERVER_PERSISTED_PRIVATE_JOURNAL');
  assert.deepEqual(plain(database.journalLines.map(line=>[line.debit,line.credit])),proof.package.vouchers[0].lines.map(line=>[line.debit,line.credit]));
  assert.deepEqual(plain(ui.bulkRows().map(line=>[line.debit,line.credit])),proof.package.vouchers[0].lines.map(line=>[line.debit,line.credit]));
  const erpEntry = source.slice(source.indexOf('  function getErpReadyJournalData('),source.indexOf('  function legacyGetErpReadyJournalData('));
  assert.doesNotMatch(erpEntry,/getJournalSummaryReport|Number\(|reduce\(/);
  vm.runInContext(erpEntry,context);
  assert.deepEqual(plain(vm.runInContext('getErpReadyJournalData(new Date(2026,0,31))',context)),plain(ui.bulkRows()));
  assert.throws(()=>vm.runInContext('getErpReadyJournalData(new Date(2026,1,28))',context),/eşleşmiyor/);
  window.LeaseQantPrivateTfrs16Facade=null;
  await vm.runInContext('generateSelectedJournal(contracts[0])',context);
  assert.match(dom.window.document.getElementById('journalPreview').innerHTML,/UNAVAILABLE/);
  await vm.runInContext('generateBulkJournals()',context);
  assert.equal(dom.window.document.getElementById('exportBulkJournals').disabled,true);
  assert.throws(()=>ui.exportBulk('csv'),/POPULATION_EMPTY/);
  assert.equal(ui.databasePreview().status,'JOURNAL_AUTHORITY_UNAVAILABLE');
  // Public compatibility exports are guarded; old initial/accounting helpers
  // are absent from the actual contract detail composition path.
  assert.match(source,/applyAccountMappingToJournal: journalAuthorityUnavailable/);
  assert.match(source,/buildAppliedChangeJournalEntries: journalAuthorityUnavailable/);
  for(const name of ['appendFxToReclassification','appendFxJournalLines','getContractFxTranslationJournal','buildFxJournalLine']) {
    assert.ok(source.includes(name+': journalAuthorityUnavailable'),name);
  }
  const initial=source.slice(source.indexOf('    // Initial journal is loaded separately'),source.indexOf('\n    if (title) {',source.indexOf('    // Initial journal is loaded separately')));
  assert.doesNotMatch(initial,/generateInitialEntry|FunctionalCurrencyJournal/);
  const detail=fs.readFileSync(path.join(root,'js/tfrs16-detail-ui.js'),'utf8');
  assert.match(detail,/data-authoritative-initial-journal/);
  assert.doesNotMatch(detail,/call\("renderJournalEntry"/);
  dom.window.close();
});

test('filters, sorting and print/PDF serialize the verified preview, without changing accounts or amounts',async()=>{
  const dom=new JSDOM('<div id="preview"></div>');
  const {window,ui}=runtime(dom);
  const proof=proofs.find(p=>p.body.kind==='PERIOD');
  const pkg=await ui.acceptPackage(proof.package,proof.body);
  const container=dom.window.document.getElementById('preview');
  const before=ui.serialize([pkg]);
  ui.renderInto(container,[pkg]);
  const filter=container.querySelector('[data-journal-filter]');filter.value='interestExpense';filter.dispatchEvent(new dom.window.Event('input'));
  assert.match(container.querySelector('[data-journal-body]').innerHTML,/interestExpense/);
  const sort=container.querySelector('[data-journal-sort]');sort.value='accountCode';sort.dispatchEvent(new dom.window.Event('change'));
  assert.equal(ui.serialize([pkg]),before);
  let html='',printed=false;
  const printWindow={opener:window,document:{write:value=>{html=value;},close:()=>{}},print:()=>{printed=true;}};
  window.open=(url,target,features)=>{assert.equal(features,undefined);return printWindow;};
  container.querySelector('[data-journal-print]').click();
  assert.equal(printed,true);assert.match(html,/SYN-/);
  assert.equal(printWindow.opener,null);
  dom.window.close();
});
