'use strict';
if(process.env.DB_HOST!=='/tmp'||process.env.DB_NAME!=='leaseqant_agent_test')throw Error('Disposable local DB required; never Production');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const express=require('express'),bcrypt=require('bcryptjs'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),backend=path.resolve(root,'../backend'),pool=require(path.join(backend,'backend/db/pool'));
const proofs=JSON.parse(fs.readFileSync('/tmp/report-auth-r1-numeric.json','utf8')).evidence;
const evidence=[],uid='RAR1-BROWSER-'+crypto.randomUUID();let server,browser,origin,token;
const username='report-browser-'+crypto.randomUUID().slice(0,24),password=crypto.randomBytes(32).toString('base64url');
test.before(async()=>{
 assert.equal((await pool.query('SELECT current_database() AS n')).rows[0].n,'leaseqant_agent_test');
 await pool.query("INSERT INTO users(id,username,password_hash,role,status,must_change_password) VALUES($1,$2,$3,'VIEWER','ACTIVE',FALSE)",[uid,username,await bcrypt.hash(password,4)]);
 for(const proof of proofs.filter(p=>['single','mixed','zero'].includes(p.fixture)))await pool.query('INSERT INTO user_companies(user_id,company_id) VALUES($1,$2)',[uid,proof.body.companyId]);
 const app=express();app.use(express.static(root));app.use(require(path.join(backend,'backend/app')));server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));origin='http://127.0.0.1:'+server.address().port;
 const login=await fetch(origin+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});assert.equal(login.status,200);token=(await login.json()).token;
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
});
test.after(async()=>{fs.writeFileSync('/tmp/report-auth-r1-browser-proof.json',JSON.stringify(evidence,null,2));await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await pool.query('DELETE FROM user_companies WHERE user_id=$1',[uid]);await pool.query('DELETE FROM users WHERE id=$1',[uid]);await pool.end();});
async function pageFor(name,{beforeNavigate}={}){const context=await browser.newContext({timezoneId:'Europe/Istanbul'}),page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,300));});page.on('requestfailed',r=>errors.push(new URL(r.url()).pathname+':'+r.failure()?.errorText));page.diagnosticErrors=errors;
 await page.addInitScript(({token,origin})=>{
  localStorage.setItem('access_token',token);sessionStorage.setItem('gk_session_token',token);window.LEASEQANT_API_BASE=origin;
  const NativeDate=Date;window.Date=class extends NativeDate{constructor(...a){super(...(a.length?a:['2026-01-17T10:00:00Z']));}static now(){return new NativeDate('2026-01-17T10:00:00Z').getTime();}};
 },{token,origin});
 // Legacy private hydration uses an absolute URL: proxy it exclusively to the disposable local app.
 await page.route('https://api.leaseqant.com/**',async route=>{
  const req=route.request(),url=new URL(req.url());const response=await context.request.fetch(origin+url.pathname+url.search,{method:req.method(),headers:req.headers(),data:req.postData()||undefined});const headers={...response.headers(),'access-control-allow-origin':origin,'access-control-allow-credentials':'true'};await route.fulfill({response,headers});
 });
 await page.route('https://cdn.jsdelivr.net/**',route=>route.abort());await page.route('https://cdnjs.cloudflare.com/**',route=>route.abort());
 if(beforeNavigate)await beforeNavigate({page,context,origin,token});
 await page.goto(origin+'/'+name,{waitUntil:'domcontentloaded'});return {page,context};
}
test('API contract list renders while private calculations are still pending',async()=>{
 let releasePrivate;const privateGate=new Promise(resolve=>{releasePrivate=resolve;});
 let contractsResponse,calculationRequest;
 const {page,context}=await pageFor('tfrs16.html',{beforeNavigate:async({page})=>{
  contractsResponse=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/contracts'&&response.ok());
  calculationRequest=page.waitForRequest(request=>new URL(request.url()).pathname.startsWith('/api/calculations/'),{timeout:10000});
  await page.route('**/api/calculations/**',async route=>{await privateGate;await route.continue();});
 }});
 try{
  await Promise.all([contractsResponse,calculationRequest]);
  await page.locator('#sidebarNav [data-view="contracts"]').click();
  await page.locator('#contractsTableBody tr').first().waitFor({state:'visible',timeout:5000});
  assert.ok((await page.locator('#contractsTableBody tr').count())>0,'Authenticated API contract list should render before private balances finish');
 }finally{releasePrivate();await context.close();}
});
for(const name of ['dashboard.html','financial-decision-cockpit.html'])test('real browser '+name+' renders fresh authenticated local backend DTO and blocks mixed totals',async()=>{
 const {page,context}=await pageFor(name);await page.locator('[data-report-export="csv"]').waitFor();
 const single=proofs.find(p=>p.fixture==='single'),mixed=proofs.find(p=>p.fixture==='mixed');await page.locator('[data-report-company]').selectOption(single.body.companyId);
 await page.waitForFunction(id=>{try{return window.LeaseQantReportingAuthorityUi.read().identity.companyId===id;}catch{return false;}},single.body.companyId);
 const p=await page.evaluate(()=>window.LeaseQantReportingAuthorityUi.read());const res=await context.request.post(origin+'/api/reports/authority',{headers:{Authorization:'Bearer '+token},data:single.body});assert.equal(res.status(),200);const direct=(await res.json()).data;assert.deepEqual(p,direct);
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('[data-report-export="csv"]').click()]);const content=fs.readFileSync(await download.path(),'utf8');assert.ok(content.includes(String(direct.totals.leaseLiability.value)));
 await page.locator('[data-report-company]').selectOption(mixed.body.companyId);await page.waitForFunction(id=>{try{return window.LeaseQantReportingAuthorityUi.read().identity.companyId===id;}catch{return false;}},mixed.body.companyId);
 assert.equal((await page.evaluate(()=>window.LeaseQantReportingAuthorityUi.read())).totals.leaseLiability.value,null);assert.match(await page.locator('[data-report-output]').innerText(),/Kapsam hazır değil/);
 const screenshot='/tmp/report-auth-r1-'+name+'.png';await page.screenshot({path:screenshot,fullPage:true});evidence.push({page:name,actualAuthenticatedLocalApi:true,currency:'TRY',singleLiability:direct.totals.leaseLiability.value,frontendLiability:p.totals.leaseLiability.value,rawDelta:0,mixedCoverage:'UNAVAILABLE',csvRawParity:true,screenshot});await context.close();
});
test('whole TFRS16 boot, shell CFO navigation and failed-source branch use backend authority',async()=>{
 const {page,context}=await pageFor('tfrs16.html');try{await page.waitForFunction(()=>window.__GK_TFRS16_DASHBOARD_METRICS__?.source==='SERVER_PERSISTED_PRIVATE_REPORTING',{},{timeout:10000});}catch(e){fs.writeFileSync('/tmp/report-auth-r1-browser-diagnostics.json',JSON.stringify({errors:page.diagnosticErrors,state:await page.evaluate(()=>({boot:typeof window.__GK_TFRS16_UI_BOOT__,ran:window.__GK_TFRS16_UI_COORDINATOR_RAN__,hasApi:!!window.GK_TFRS16,hasAdapter:!!window.LeaseQantPrivateCalculation,hasReport:!!window.LeaseQantReportingAuthorityUi,kpi:document.getElementById('leaseLiability')?.textContent,asOf:document.getElementById('kpiDataAsOf')?.textContent}))},null,2));throw e;}
 await page.locator('#lqDashboard').waitFor({state:'visible'});
 const visual=await page.evaluate(()=>({liability:document.getElementById('lqTotalLiability').textContent,current:document.getElementById('lqCurrentLegend').textContent,noncurrent:document.getElementById('lqNonCurrentLegend').textContent,readiness:document.getElementById('lqReadinessScore').textContent,ratio:document.getElementById('lqCurrentPct').textContent}));
 assert.equal(visual.liability,'Şirket seçin');assert.equal(visual.readiness,'Veri hazır değil');assert.equal(visual.ratio,'Veri hazır değil');assert.ok(!visual.noncurrent.includes('NaN'));
 await page.screenshot({path:'/tmp/report-auth-r1-tfrs16-dashboard.png',fullPage:true});
 // Wait for the real shell rewiring before exercising its public navigation hook.
 await page.waitForTimeout(2700);await page.evaluate(()=>window.GK_TFRS16.v191OpenCfoDashboard());await page.locator('[data-report-export="csv"]').waitFor();
 assert.equal(await page.locator('[data-report-company]').isVisible(),true);assert.equal(await page.locator('#lqDashboard').isVisible(),false);
 const p=await page.evaluate(()=>window.LeaseQantReportingAuthorityUi.read());assert.equal(p.sourceStatus,'SERVER_PERSISTED_PRIVATE_REPORTING');
 const stored=await context.request.post(origin+'/api/reports/authority',{headers:{Authorization:'Bearer '+token},data:p.period});assert.equal(stored.status(),200);assert.deepEqual(p,(await stored.json()).data);
 const screenshot='/tmp/report-auth-r1-tfrs16-cfo.png';await page.screenshot({path:screenshot,fullPage:true});
 await page.route(origin+'/api/reports/authority',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({success:false,code:'SOURCE_NOT_READY'})}));await page.locator('[data-report-load]').click();await page.getByRole('alert').filter({hasText:'Rapor şu anda gösterilemiyor'}).waitFor();assert.equal(await page.locator('[data-report-export]').count(),0);
 const unsafe=await page.evaluate(()=>{try{window.GK_TFRS16.getTotalLeaseLiability();return true;}catch{return false;}});assert.equal(unsafe,false);
 evidence.push({page:'tfrs16.html',actualAuthenticatedLocalApi:true,wholePageBoot:true,shellCfoNavigation:true,rawPackageParity:true,failedSource:'SOURCE_NOT_READY',staleExportsRemoved:true,legacyFinancialGetterBlocked:true,visualDashboard:visual,visibleCfoPage:true,screenshot});await context.close();
});
test('real authenticated navigation opens modification and each responsive KPI stays in its card',async()=>{
 const {page,context}=await pageFor('tfrs16.html');
 await page.waitForFunction(()=>window.__GK_TFRS16_DASHBOARD_METRICS__?.source==='SERVER_PERSISTED_PRIVATE_REPORTING');
 await page.locator('#v26ActiveCompanySelect option').nth(1).waitFor({state:'attached'});
 const options=await page.locator('#v26ActiveCompanySelect option').evaluateAll(rows=>rows.map(row=>row.value));
 assert.ok(options.includes(proofs.find(p=>p.fixture==='single').body.companyId));
 for(const width of [1440,1280,1024,800,390]){
  await page.setViewportSize({width,height:900});
  await page.locator('#lqDashboard').waitFor({state:'visible'});
  const cards=await page.locator('#lqDashboard .lq-metric').evaluateAll(rows=>rows.map(row=>({width:row.clientWidth,scroll:row.scrollWidth,value:row.querySelector('.lq-metric-value')?.textContent,
   children:[...row.children].map(child=>({className:child.className,width:child.clientWidth,scroll:child.scrollWidth,text:child.textContent}))})));
  assert.ok(cards.every(card=>card.children.every(child=>child.scroll<=child.width+2)),`Dashboard card content overflow at ${width}: ${JSON.stringify(cards)}`);
  assert.ok(cards.every(card=>!card.value.includes('NOT_READY')&&!card.value.includes(':')),`Raw or concatenated KPI at ${width}`);
 }
 await page.setViewportSize({width:1280,height:900});
 const single=proofs.find(p=>p.fixture==='single'),zero=proofs.find(p=>p.fixture==='zero');
 await page.locator('#v26ActiveCompanySelect').selectOption(single.body.companyId);
 const expected=new Intl.NumberFormat('tr-TR',{maximumFractionDigits:2}).format(single.package.totals.leaseLiability.value)+' TRY';
 await page.waitForFunction(text=>document.getElementById('lqTotalLiability')?.textContent===text,expected);
 await page.locator('#sidebarNav [data-view="contracts"]').click();
 assert.equal(await page.locator('#kpiLiability').innerText(),expected);
 assert.ok((await page.locator('#contractsTableBody tr').count())>0,'Supported company contract should appear in the Contracts table');
 await page.locator('#v26ActiveCompanySelect').selectOption(zero.body.companyId);
 await page.waitForFunction(()=>document.getElementById('kpiLiability')?.textContent==='0 TRY');
 assert.equal(await page.locator('#kpiContractCount').innerText(),'0');
 await page.locator('#v26ActiveCompanySelect').selectOption('ALL');
 await page.waitForFunction(()=>document.getElementById('kpiLiability')?.textContent==='Şirket seçin');
 await page.locator('[data-lq-dashboard]').click();
 await page.locator('.lq-nav-dropdown:has([data-open="modification"]) .lq-nav-trigger').click();
 await page.locator('#sidebarNav [data-open="modification"]').click();
 await page.getByRole('heading',{name:'Modifikasyon & Reassessment'}).waitFor();
 assert.ok(!(await page.locator('#v26PageHost').innerText()).includes('REPORTING_AUTHORITY_UNAVAILABLE'));
 await page.locator('.lq-nav-dropdown:has([data-open="eliminations"]) .lq-nav-trigger').click();
 await page.locator('#sidebarNav [data-open="eliminations"]').click();
 await page.getByRole('heading',{name:'Eliminasyon Yönetimi'}).waitFor();
 const elimination=await page.locator('#v26PageHost').innerText();
 assert.match(elimination,/doğrulanmış sunucu kaynağı henüz hazır değil/);
 assert.ok(!elimination.includes('Kayıt bulunamadı'));
 await context.close();
});
