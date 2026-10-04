'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom');
const adminJs=fs.readFileSync(path.join(__dirname,'../frontend/js/admin.js'),'utf8');
function page(file){const d=new JSDOM('<!doctype html><body><nav class="sidebar" id="sidebar"><a href="x">eski</a></nav></body>',{url:'https://leaseqant.com/frontend/admin/'+file,runScripts:'outside-only',virtualConsole:new VirtualConsole()});
 d.window.fetch=()=>Promise.resolve({ok:true,json:()=>Promise.resolve({})});d.window.eval(adminJs);d.window.buildAdminRail();return d.window;}
test('ray kanonik menüyü kurar ve etkin sayfayı işaretler',()=>{
 const w=page('plans.html');const links=[...w.document.querySelectorAll('#sidebar .sidebar-nav a')];
 assert.deepEqual(links.map(a=>a.getAttribute('href')).join(','),'index.html,companies.html,users.html,licenses.html,periods.html,opening-balances.html,fx-rates.html,ledger.html,journal-mappings.html,inflation-indices.html,audit.html,faq.html');
 assert.equal(w.document.querySelector('#sidebar a.active').getAttribute('href'),'licenses.html');
 assert.ok(!w.document.body.innerHTML.includes('eski'));
});
test('yalnızca Şirketler ve Kullanıcılar yönetici dışı rollere açık',()=>{
 const w=page('companies.html');
 const open=[...w.document.querySelectorAll('#sidebar .sidebar-nav a:not([data-admin-only])')].map(a=>a.getAttribute('href'));
 assert.equal(open.join(','),'companies.html,users.html');
});
test('rozet sıfırsa gizli, sayı varsa görünür',()=>{
 const w=page('index.html');w.setRailBadge('fx',14);w.setRailBadge('cpi',0);
 const fx=w.document.querySelector('[data-rail-badge="fx"]');assert.equal(fx.hidden,false);assert.equal(fx.textContent,'14');
 assert.equal(w.document.querySelector('[data-rail-badge="cpi"]').hidden,true);
});
