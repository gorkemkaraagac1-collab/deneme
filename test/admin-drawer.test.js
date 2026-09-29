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
