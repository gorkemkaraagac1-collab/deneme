'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom');
const adminJs=fs.readFileSync(path.join(__dirname,'../frontend/js/admin.js'),'utf8');
function win(){const d=new JSDOM('<!doctype html><body><div id="modalOverlay" class="modal-overlay"><h3 id="modalTitle"></h3><div id="modalBody"></div></div></body>',{url:'https://leaseqant.com/frontend/admin/users.html',runScripts:'outside-only',virtualConsole:new VirtualConsole()});d.window.fetch=()=>Promise.resolve({ok:true,json:()=>Promise.resolve({})});d.window.eval(adminJs);return d.window;}
test('sağ panel açılır, başlık düz metin, Esc ve kapat düğmesi kapatır',()=>{
 const w=win();w.showDrawer({title:'<b>A & B</b>',body:'<p id="x">içerik</p>',footer:'<button>ok</button>'});
 const root=w.document.getElementById('lqDrawer');assert.equal(root.hidden,false);
 assert.equal(w.document.getElementById('lqDrawerTitle').textContent,'<b>A & B</b>');
 assert.ok(w.document.getElementById('x'));
 w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape'}));assert.equal(root.hidden,true);
 w.showDrawer({title:'t'});root.querySelector('.lq-drawer-x').click();assert.equal(root.hidden,true);
});
test('modal başlığı kaçış karakterleriyle değil düz metinle görünür',()=>{
 const w=win();w.showModal('Şirket: A &amp; B &lt;x&gt;','');
 assert.equal(w.document.getElementById('modalTitle').textContent,'Şirket: A & B <x>');
 assert.equal(w.document.getElementById('modalTitle').children.length,0);
});
test('şirket formu gönderilmeyen e-posta alanını istemiyor; detay sahte alan göstermiyor',()=>{
 const s=fs.readFileSync(path.join(__dirname,'../frontend/admin/companies.html'),'utf8');
 assert.doesNotMatch(s,/name="email"/);
 assert.doesNotMatch(s,/Vergi Numarası|company\.tax_number|company\.phone|company\.address/);
 assert.match(s,/showDrawer\(/);
});
test('kullanıcı düzenleme panelde; şirket erişimi onay kutularıyla gönderilir',()=>{
 const s=fs.readFileSync(path.join(__dirname,'../frontend/admin/users.html'),'utf8');
 assert.match(s,/input\[name="company_ids"\]:checked/);
 assert.doesNotMatch(s,/company_ids\s*\.selectedOptions/);
 assert.match(s,/resetUserPassword\(userId, pw\)/);
});
test('lisans sayfası: gerçek durum seçenekleri, sekmeler, doğru satır işlemleri',()=>{
 const s=fs.readFileSync(path.join(__dirname,'../frontend/admin/licenses.html'),'utf8');
 assert.doesNotMatch(s,/<option value="INACTIVE">/);
 assert.match(s,/class="lq-tabs"/);
 assert.match(s,/license\.status === "ACTIVE"\s*\n?\s*\?/);
 assert.match(s,/Yeni lisans/);
 assert.match(fs.readFileSync(path.join(__dirname,'../frontend/admin/plans.html'),'utf8'),/class="lq-tabs"/);
});
test('dönem sayfası: takvim, isim çözümleme, yan panel mevcut changePeriod akışını kullanır',()=>{
 const s=fs.readFileSync(path.join(__dirname,'../frontend/admin/periods.html'),'utf8');
 assert.match(s,/id="calGrid"/);
 assert.match(s,/userName\(period\.closed_by\)/);
 assert.match(s,/await changePeriod\(action\)/);
 assert.match(s,/modeless: true/);
 assert.match(s,/grid-template-columns: minmax\(0, 1fr\)/);
});
test('modeless panel arka sayfayı kilitlemez',()=>{
 const {JSDOM,VirtualConsole}=require('jsdom');
 const d=new JSDOM('<!doctype html><body></body>',{url:'https://leaseqant.com/frontend/admin/periods.html',runScripts:'outside-only',virtualConsole:new VirtualConsole()});
 d.window.fetch=()=>Promise.resolve({ok:true,json:()=>Promise.resolve({})});d.window.eval(fs.readFileSync(path.join(__dirname,'../frontend/js/admin.js'),'utf8'));
 d.window.showDrawer({title:'x',modeless:true});
 assert.ok(d.window.document.getElementById('lqDrawer').classList.contains('modeless'));
 assert.ok(d.window.document.documentElement.classList.contains('lq-drawer-side'));
 d.window.closeDrawer();assert.ok(!d.window.document.documentElement.classList.contains('lq-drawer-side'));
});
test('açılış bakiyeleri: tırnaklı ve noktalı virgüllü CSV doğru okunur, yalnızca 5 kolon zorunlu',()=>{
 const {JSDOM,VirtualConsole}=require('jsdom');
 const html=fs.readFileSync(path.join(__dirname,'../frontend/admin/opening-balances.html'),'utf8');
 const script=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].pop()[1];
 const fn=script.slice(script.indexOf('const REQUIRED_HEADERS'),script.indexOf('let validRows'))+script.slice(script.indexOf('function splitCsvLine'),script.indexOf('function parseCsv'))+script.slice(script.indexOf('function parseCsv'),script.indexOf('/* ====',script.indexOf('function parseCsv')));
 const d=new JSDOM('<textarea id="csv"></textarea>',{runScripts:'outside-only',virtualConsole:new VirtualConsole()});
 d.window.eval(fn+';window.parseCsv=parseCsv;');
 d.window.document.getElementById('csv').value='﻿company_id;contract_id;opening_date;opening_rou_asset;opening_lease_liability;source_reference;extra\nC1;K1;2025-01-01;100;90;"Kira, ""Gebze""";zzz\n';
 const rows=d.window.parseCsv();
 assert.equal(rows.length,1);assert.equal(rows[0].source_reference,'Kira, "Gebze"');assert.equal(rows[0].contract_id,'K1');
 assert.equal(rows[0].extra,undefined);assert.equal(rows[0].discount_rate,undefined);
 d.window.document.getElementById('csv').value='company_id,contract_id\nC1,K1';
 assert.throws(()=>d.window.parseCsv(),/opening_date/);
 assert.match(html,/opening-balances\/approve/);
});
test('kur ve endeks: senkron mesajı inserted okur, değişim sütunları ve isimler',()=>{
 const fx=fs.readFileSync(path.join(__dirname,'../frontend/admin/fx-rates.html'),'utf8');
 assert.match(fx,/Array\.isArray\(result\.inserted\)/);
 assert.match(fx,/<th>Günlük değişim<\/th>/);
 assert.doesNotMatch(fx,/colspan="5"/);
 const cpi=fs.readFileSync(path.join(__dirname,'../frontend/admin/inflation-indices.html'),'utf8');
 assert.match(cpi,/<th>Aylık değişim<\/th>/);
 assert.match(cpi,/personName\(record\.retrievedBy\)/);
 assert.doesNotMatch(cpi,/colspan="8"/);
});
test('denetim izi: güncel işlem filtreleri ve değişiklik paneli; SSS sıralaması eşit değerlerde de çalışır',()=>{
 const a=fs.readFileSync(path.join(__dirname,'../frontend/admin/audit.html'),'utf8');
 assert.doesNotMatch(a,/<option value="LOGIN">/);
 assert.match(a,/PERIOD_CLOSED/);assert.match(a,/function auditDiffRows/);
 const f=fs.readFileSync(path.join(__dirname,'../frontend/admin/faq.html'),'utf8');
 assert.match(f,/\(i \+ 1\) \* 10/);assert.match(f,/function sanitizeFaqPreview/);
 const {JSDOM,VirtualConsole}=require('jsdom');
 const d=new JSDOM('<!doctype html><body></body>',{runScripts:'outside-only',virtualConsole:new VirtualConsole()});
 d.window.fetch=()=>Promise.resolve({ok:true,json:()=>Promise.resolve({})});
 d.window.eval(fs.readFileSync(path.join(__dirname,'../frontend/js/admin.js'),'utf8'));
 assert.equal(d.window.auditActionLabel('EXTEND_LICENSE'),'Lisans süresi uzatıldı');
 assert.equal(d.window.auditActionLabel('YENI_KOD'),'YENI_KOD');
});
