'use strict';
// Needs evidence from a disposable local integration run; skipped otherwise.
if(!require('node:fs').existsSync('/tmp/authority-rc1-numeric.json')){require('node:test').test('integration evidence /tmp/authority-rc1-numeric.json not present',{skip:'integration evidence /tmp/authority-rc1-numeric.json not present'},()=>{});return;}
// Numeric assertions on external disposable API evidence; no private payload
// or accounting implementation is shipped in this public test source.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
const root=path.resolve(__dirname,'..'),proof=JSON.parse(fs.readFileSync('/tmp/authority-rc1-numeric.json','utf8')),result={syntheticOnly:true,numeric:[],journals:[]};
function runtime(){let sheet;const window={crypto:webcrypto,XLSX:{utils:{book_new:()=>({}),json_to_sheet:r=>{sheet=r;return r;},book_append_sheet:()=>{}},writeFile:()=>{}}};const context=vm.createContext({window,TextEncoder,Uint8Array,Intl,Blob,Number,String,Set,Map,WeakSet,Object,JSON,Date,console});for(const name of ['disclosure','journal','report-authority'])vm.runInContext(fs.readFileSync(path.join(root,'js/tfrs16-'+name+'-ui.js'),'utf8'),context);return {window,sheet:()=>sheet};}
const plain=x=>JSON.parse(JSON.stringify(x));
test('same persisted source preserves DISC/Reporting frontend and XLSX raw comparable fields',async()=>{
 const {window,sheet}=runtime(),reportUi=window.LeaseQantReportingAuthorityUi,discUi=window.LeaseQantTfrs16DisclosureUi;
 const pkg=await reportUi.acceptPackage(plain(proof.reporting),proof.reportIntent),rows=reportUi.rawRows(pkg);
 reportUi.exportPackage(pkg,'xlsx');const exported=plain(sheet());
 const fields={rouCarryingAmount:proof.disc.periodMovement.rou.closing,leaseLiability:proof.disc.periodMovement.liability.closing,openingROU:proof.disc.periodMovement.rou.opening,openingLiability:proof.disc.periodMovement.liability.opening,periodInterest:proof.disc.periodMovement.liability.interest,periodDepreciation:proof.disc.periodMovement.rou.depreciation,contractualPayments:proof.disc.periodMovement.liability.scheduledContractualCash};
 let discRows=[];for(const tab of ['asset','liability','liquidity']){const rs=discUi.rowsForTab(proof.disc,tab);discUi.exportRows(rs,tab,proof.disc);rs.forEach((r,i)=>{assert.equal(sheet()[i].Tutar,['SUPPORTED','ZERO_CONFIRMED'].includes(r.status)?r.value:null);discRows.push(r);});}
 for(const c of proof.comparisons){const row=rows.find(r=>r.metric===c.metric),ex=exported.find(r=>r.metric===c.metric),d=discRows.find(r=>r.fieldId===fields[c.metric].fieldId);assert.ok(d);assert.equal(row.value,c.direct);assert.equal(ex.value,c.direct);assert.equal(d.value,c.direct);result.numeric.push({...c,frontendRaw:row.value,discFrontendRaw:d.value,exportRaw:ex.value,discExportRaw:d.value,delta:0});}
});
test('Journal backend totals, frontend rows and XLSX lines reconcile without reconstruction',async()=>{
 const {window,sheet}=runtime(),ui=window.LeaseQantTfrs16JournalUi;
 for(const j of proof.journals){const pkg=await ui.acceptPackage(plain(j.package),j.intent),rows=plain(ui.rowsForPackage(pkg));ui.exportPackages([pkg],'xlsx');assert.deepEqual(plain(sheet()),rows);
  for(const v of pkg.vouchers){const r=rows.filter(l=>l.journalId===v.journalId),x=plain(sheet()).filter(l=>l.journalId===v.journalId);const debit=r.reduce((n,l)=>n+l.debit,0),credit=r.reduce((n,l)=>n+l.credit,0),exportDebit=x.reduce((n,l)=>n+l.debit,0),exportCredit=x.reduce((n,l)=>n+l.credit,0);
   assert.equal(debit,v.totalDebit);assert.equal(credit,v.totalCredit);assert.equal(exportDebit,v.totalDebit);assert.equal(exportCredit,v.totalCredit);assert.ok(Math.abs(v.difference)<0.01);
   result.journals.push({voucher:v.voucherNo,kind:pkg.kind,period:[pkg.periodStart,pkg.periodEnd],backendDebit:v.totalDebit,backendCredit:v.totalCredit,frontendDebit:debit,frontendCredit:credit,exportDebit,exportCredit,difference:v.difference,rawDelta:0});
  }
 }
});
test.after(()=>fs.writeFileSync('/tmp/authority-rc1-export-proof.json',JSON.stringify(result,null,2)));
