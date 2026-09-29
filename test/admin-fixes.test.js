'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom');
const root=path.join(__dirname,'..');
const adminJs=fs.readFileSync(path.join(root,'frontend/js/admin.js'),'utf8');
function win(){const d=new JSDOM('<!doctype html><body></body>',{url:'https://leaseqant.com/frontend/admin/index.html',runScripts:'outside-only',virtualConsole:new VirtualConsole()});d.window.fetch=()=>Promise.resolve({ok:true,status:204,json:()=>Promise.resolve({})});d.window.eval(adminJs);return d.window;}
test('lisans durumu büyük harfe normalize edilir (active → ACTIVE)',()=>{
 const w=win();
 assert.equal(w.normalizeLicense({status:'active',id:1}).status,'ACTIVE');
 assert.equal(w.normalizeLicense({status:'cancelled'}).status,'CANCELLED');
 assert.equal(w.normalizeLicense(null),null);
 assert.match(w.getStatusBadge('CANCELLED'),/badge-expired/);
});
test('çıkış sekmedeki oturum anahtarını da siler',async()=>{
 const w=win();w.sessionStorage.setItem('gk_session_token','t');w.localStorage.setItem('access_token','a');
 await w.logout().catch(()=>{});
 assert.equal(w.sessionStorage.getItem('gk_session_token'),null);
 assert.equal(w.localStorage.getItem('access_token'),null);
});
test('lisans ve şirket sayfaları yüklenen lisansları normalize eder',()=>{
 assert.match(fs.readFileSync(path.join(root,'frontend/admin/licenses.html'),'utf8'),/\.map\(normalizeLicense\)/);
 const c=fs.readFileSync(path.join(root,'frontend/admin/companies.html'),'utf8');
 assert.ok((c.match(/normalizeLicense/g)||[]).length>=2);
});
test('şifre değiştirme sayfası sessionStorage anahtarını okur ve yeni anahtarı saklar',()=>{
 const s=fs.readFileSync(path.join(root,'frontend/admin/change-password.html'),'utf8');
 assert.equal((s.match(/sessionStorage\.getItem\("gk_session_token"\)/g)||[]).length,2);
 assert.match(s,/sessionStorage\.setItem\("gk_session_token", result\.token\)/);
});
test('plans.html tek sayfa: tek </html>, tek admin.js, tek modal',()=>{
 const s=fs.readFileSync(path.join(root,'frontend/admin/plans.html'),'utf8');
 assert.equal((s.match(/<\/html>/g)||[]).length,1);
 assert.equal((s.match(/admin\.js/g)||[]).length,1);
 assert.equal((s.match(/id="modalOverlay"/g)||[]).length,1);
});
