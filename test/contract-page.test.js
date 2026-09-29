'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const src=fs.readFileSync(path.join(__dirname,'../js/lq-contract-page.js'),'utf8');
const html=`<nav id="sidebarNav"><button class="nav-item" data-view="contracts">Sözleşmeler</button><button class="nav-item" id="navDash" data-view="dashboard">GB</button></nav>
<div class="modal-overlay hidden" id="detailModal" role="dialog" aria-modal="true"><div class="modal-card"><div class="modal-header"><div><h2 id="detailTitle">Sözleşme detayı</h2></div><button id="closeDetailModal">×</button></div><div id="detailContent"></div></div></div>`;
async function page(ui='2',hash=''){
 const dom=new JSDOM(`<!doctype html><html data-lq-ui="${ui}"><head><title>LQ</title></head><body>${html}</body></html>`,{url:'https://leaseqant.com/tfrs16.html'+hash,runScripts:'outside-only'});
 const w=dom.window,d=w.document;let selected=null;
 const modal=d.getElementById('detailModal');
 w.GK_TFRS16={getSelectedContractId:()=>selected,openDetail:id=>{if(id!=='K/1'&&id!=='K2')return;selected=id;d.getElementById('detailTitle').textContent='A › '+id;modal.classList.remove('hidden');},showAlert:()=>{}};
 d.getElementById('closeDetailModal').addEventListener('click',()=>{modal.classList.add('hidden');selected=null;});
 w.eval(src);if(d.readyState==='loading')await new Promise(r=>d.addEventListener('DOMContentLoaded',r,{once:true}));
 return {dom,w,d,modal};
}
const tick=(ms=10)=>new Promise(r=>setTimeout(r,ms));
test('hash helpers round-trip ids with special characters',async()=>{
 const {dom,w}=await page('legacy');const {idFromHash,hashFor}=w.LeaseQantContractPage;
 assert.equal(idFromHash(hashFor('K/1 ş')),'K/1 ş');assert.equal(idFromHash('#other'),null);assert.equal(idFromHash('#sozlesme/%E0'),null);dom.window.close();
});
test('opening the detail becomes a page with its own address; back button closes it',async()=>{
 const {dom,w,d,modal}=await page();
 assert.ok(modal.classList.contains('lq-detail-page'));assert.equal(modal.getAttribute('aria-modal'),'false');
 assert.ok(d.querySelector('.lq-cp-back'));
 w.GK_TFRS16.openDetail('K/1');await tick();
 assert.equal(w.location.hash,'#sozlesme/K%2F1');assert.match(d.title,/A › K\/1/);
 assert.equal(d.documentElement.getAttribute('data-lq-detail-page'),'open');
 d.querySelector('.lq-cp-back').click();await tick(50);
 assert.ok(modal.classList.contains('hidden'));assert.equal(d.title,'LQ');
 assert.equal(d.documentElement.hasAttribute('data-lq-detail-page'),false);
 dom.window.close();
});
test('browser back (hash removed) closes; navigating the rail closes',async()=>{
 const {dom,w,d,modal}=await page();
 w.GK_TFRS16.openDetail('K2');await tick();
 w.history.replaceState(null,'',w.location.pathname);w.dispatchEvent(new w.HashChangeEvent('hashchange'));await tick();
 assert.ok(modal.classList.contains('hidden'));
 w.GK_TFRS16.openDetail('K2');await tick();
 d.getElementById('navDash').click();await tick();assert.ok(modal.classList.contains('hidden'));
 dom.window.close();
});
test('deep link opens the contract once it is available',async()=>{
 const {dom,modal}=await page('2','#sozlesme/K2');await tick(30);
 assert.equal(modal.classList.contains('hidden'),false);dom.window.close();
});
test('legacy UI keeps the modal untouched',async()=>{
 const {dom,modal}=await page('legacy');assert.equal(modal.classList.contains('lq-detail-page'),false);dom.window.close();
});
