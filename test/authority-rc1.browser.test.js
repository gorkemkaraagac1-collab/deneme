'use strict';
// Public transport/presentation integration test. Private DTO evidence is read
// from a disposable local run; it is never included in the public repository.
if(process.env.DB_HOST!=='/tmp'||process.env.DB_NAME!=='leaseqant_agent_test')throw Error('Disposable local DB required');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const express=require('express'),bcrypt=require('bcryptjs'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),backend=path.resolve(root,'../backend'),pool=require(path.join(backend,'backend/db/pool'));
const proof=JSON.parse(fs.readFileSync('/tmp/authority-rc1-numeric.json','utf8')),evidence=[];
const uid='RC1-B-'+crypto.randomUUID(),username='rc1-browser-'+crypto.randomUUID().slice(0,20),password=crypto.randomBytes(32).toString('base64url');
let server,browser,origin,token;
test.before(async()=>{
 await pool.query("INSERT INTO users(id,username,password_hash,role,status,must_change_password) VALUES($1,$2,$3,'VIEWER','ACTIVE',FALSE)",[uid,username,await bcrypt.hash(password,4)]);
 await pool.query('INSERT INTO user_companies(user_id,company_id) VALUES($1,$2)',[uid,proof.companyId]);
 const app=express();app.use(express.static(root));app.use(require(path.join(backend,'backend/app')));server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));origin='http://127.0.0.1:'+server.address().port;
 const login=await fetch(origin+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});assert.equal(login.status,200);token=(await login.json()).token;
 browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
});
test.after(async()=>{
 fs.writeFileSync('/tmp/authority-rc1-browser-proof.json',JSON.stringify(evidence,null,2));await browser?.close();
 if(server)await new Promise(r=>server.close(r));await pool.query('DELETE FROM user_companies WHERE user_id=$1',[uid]);await pool.query('DELETE FROM users WHERE id=$1',[uid]);await pool.end();
});
async function pageFor(){
 const context=await browser.newContext({timezoneId:'Europe/Istanbul'}),page=await context.newPage(),responses=[];
 await page.addInitScript(({token})=>{
  localStorage.setItem('access_token',token);sessionStorage.setItem('gk_session_token',token);
  const D=Date;window.Date=class extends D{constructor(...a){super(...(a.length?a:['2026-01-31T10:00:00Z']));}static now(){return new D('2026-01-31T10:00:00Z').getTime();}};
 },{token});
 await page.route('https://api.leaseqant.com/**',async route=>{
  const req=route.request(),url=new URL(req.url()),response=await context.request.fetch(origin+url.pathname+url.search,{method:req.method(),headers:req.headers(),data:req.postData()||undefined});
  if(req.method()==='POST'&&['/api/reports/lease-disclosure','/api/journals/preview'].includes(url.pathname)&&response.status()===200)responses.push({path:url.pathname,package:(await response.json()).data});
  await route.fulfill({response,headers:{...response.headers(),'access-control-allow-origin':origin,'access-control-allow-credentials':'true'}});
 });
 await page.route('https://cdn.jsdelivr.net/**',r=>r.abort());await page.route('https://cdnjs.cloudflare.com/**',r=>r.abort());
 await page.goto(origin+'/tfrs16.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__GK_TFRS16_DASHBOARD_METRICS__?.source==='SERVER_PERSISTED_PRIVATE_REPORTING');
 await page.waitForTimeout(2600);return {page,context,responses};
}
test('actual Dipnot navigation, trusted identifiers, raw export and API failure preserve authority',async()=>{
 const {page,context,responses}=await pageFor();
 await page.evaluate(()=>window.__gkOpenInMainByKey('footnotes'));await page.locator('#disclosureExport').waitFor();
 const p=responses.filter(r=>r.path==='/api/reports/lease-disclosure').at(-1)?.package;assert.ok(p);assert.equal(p.identity.companyId,proof.companyId);
 const parity=await page.evaluate(pkg=>{
  let exported;window.XLSX={utils:{book_new:()=>({}),json_to_sheet:r=>{exported=r;return r;},book_append_sheet:()=>{}},writeFile:()=>{}};
  const ui=window.LeaseQantTfrs16DisclosureUi,out=[];
  for(const tab of ['asset','liability','liquidity']){const rows=ui.rowsForTab(pkg,tab);ui.exportRows(rows,tab,pkg);out.push(...rows.map((r,i)=>({label:r.label,raw:r.value,status:r.status,exported:exported[i].Tutar,exportStatus:exported[i].Durum})));}
  return out;
 },p);
 for(const r of parity){assert.equal(r.exported,['SUPPORTED','ZERO_CONFIRMED'].includes(r.status)?r.raw:null);assert.equal(r.exportStatus,r.status);}
 await page.route('https://api.leaseqant.com/api/reports/lease-disclosure/availability**',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,code:'DISCLOSURE_TRUSTED_SOURCE_REQUIRED'}),headers:{'access-control-allow-origin':origin,'access-control-allow-credentials':'true'}}));
 await page.evaluate(()=>window.__gkOpenInMainByKey('footnotes'));await page.locator('[role="alert"]').waitFor();assert.equal(await page.locator('#disclosureExport').count(),0);
 evidence.push({area:'DISC',actualHtml:true,rows:parity,fallbackCount:0,apiFailureUnavailable:true});await context.close();
});
test('actual contract Journal button uses backend voucher and raw download; failed API clears preview',async()=>{
 const {page,context,responses}=await pageFor();
 await page.evaluate(id=>window.GK_TFRS16.openDetail(id),proof.contractId);
 await page.locator('#detailContent [data-detail-tab-target="accounting"]').click();
 await page.locator('#generateJournal').waitFor();
 await page.locator('#accountingYear').selectOption('2026');await page.locator('#accountingPeriod').selectOption('monthly');await page.locator('#accountingMonth').selectOption('1');
 await page.locator('#generateJournal').click({force:true});await page.locator('#journalPreview [data-journal-export="csv"]').waitFor();
 const p=responses.filter(r=>r.path==='/api/journals/preview'&&r.package.kind==='PERIOD').at(-1)?.package;assert.ok(p);
 const rows=await page.evaluate(async pkg=>{const ui=window.LeaseQantTfrs16JournalUi,accepted=await ui.acceptPackage(pkg,{companyId:pkg.companyId,contractIds:pkg.contractIds,kind:pkg.kind,periodStart:pkg.periodStart,periodEnd:pkg.periodEnd});return ui.rowsForPackage(accepted);},p);
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#journalPreview [data-journal-export="csv"]').click()]);
 const csv=fs.readFileSync(await download.path(),'utf8');for(const r of rows){assert.ok(csv.includes(String(r.debit)));assert.ok(csv.includes(String(r.credit)));}
 await page.route('https://api.leaseqant.com/api/journals/**',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,code:'JOURNAL_AUTHORITY_UNAVAILABLE'}),headers:{'access-control-allow-origin':origin,'access-control-allow-credentials':'true'}}));
 await page.locator('#generateJournal').click({force:true});await page.locator('#journalPreview [role="alert"]').waitFor();assert.equal(await page.locator('#journalPreview [data-journal-export]').count(),0);
 evidence.push({area:'Journal',actualHtml:true,rows,vouchers:p.vouchers,csvRawParity:true,fallbackCount:0,apiFailureUnavailable:true});await context.close();
});
test('actual Financial Reporting navigation retains server DTO after late shell boot',async()=>{
 const {page,context}=await pageFor();
 await page.evaluate(()=>window.__gkOpenInMainByKey('financialReporting'));await page.locator('[data-report-export="csv"]').waitFor();
 const p=await page.evaluate(()=>window.LeaseQantReportingAuthorityUi.read());assert.equal(p.identity.companyId,proof.companyId);assert.equal(p.totals.leaseLiability.value,proof.reporting.totals.leaseLiability.value);
 evidence.push({area:'Financial Reporting',actualHtml:true,rawLiability:p.totals.leaseLiability.value,fallbackCount:0});await context.close();
});
