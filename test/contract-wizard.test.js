'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const src=fs.readFileSync(path.join(__dirname,'../js/lq-contract-wizard.js'),'utf8');
const html=`<div class="modal-overlay hidden" id="contractModal"><div class="modal-card"><div class="modal-header"><h2 id="contractModalTitle">Yeni sözleşme</h2></div>
<form id="contractForm"><div class="modal-body">
<div class="form-section"><div class="form-section-title">Temel bilgiler</div><div class="form-grid">
<div class="form-field"><label for="contractId">ID</label><input id="contractId" required></div>
<div class="form-field"><label for="supplier">Tedarikçi</label><input id="supplier" required></div>
<div class="form-field"><label for="startDate">Başlangıç</label><input id="startDate" required></div>
<div class="form-field"><label for="monthlyPayment">Ödeme</label><input id="monthlyPayment" required></div>
<div class="form-field"><label for="discountRate">İO</label><input id="discountRate" value="18"></div></div></div>
<div class="form-section"><div class="form-section-title">Muafiyet &amp; bayraklar</div><div class="form-grid"><div class="form-field"><input type="checkbox" id="shortTermLease"><label>Kısa</label></div><div class="form-field"><input id="yeniAlan"></div></div></div>
</div><div class="modal-footer"><button type="button" id="cancelModal">İptal</button><button type="submit" id="saveContractButton">Kaydet</button></div></form></div></div>`;
async function page(ui='2'){const dom=new JSDOM(`<!doctype html><html data-lq-ui="${ui}"><body>${html}</body></html>`,{url:'https://leaseqant.com/tfrs16.html',runScripts:'outside-only'});
 const w=dom.window;w.eval(src);if(w.document.readyState==='loading')await new Promise(r=>w.document.addEventListener('DOMContentLoaded',r,{once:true}));return {dom,w,d:w.document};}
const tick=(ms=40)=>new Promise(r=>setTimeout(r,ms));
test('fields are grouped into steps without leaving the form',async()=>{
 const {dom,w,d}=await page();let submitted=0;d.getElementById('contractForm').addEventListener('submit',e=>{e.preventDefault();submitted++;});
 d.getElementById('contractModal').classList.remove('hidden');await tick();
 const step=id=>d.getElementById(id).closest('.lq-wz-panel').dataset.step;
 assert.equal(step('contractId'),'basics');assert.equal(step('startDate'),'term');assert.equal(step('monthlyPayment'),'payments');
 assert.equal(step('discountRate'),'measure');assert.equal(step('shortTermLease'),'review');assert.equal(step('yeniAlan'),'review');
 assert.ok(d.getElementById('contractId').closest('#contractForm'),'still inside the form');
 const visible=()=>[...d.querySelectorAll('.lq-wz-panel')].findIndex(p=>!p.hidden);
 assert.equal(visible(),0);
 d.querySelector('.lq-wz-next').click();assert.equal(visible(),0,'invalid step blocks next');
 d.getElementById('contractId').value='K1';d.getElementById('supplier').value='A';d.querySelector('.lq-wz-next').click();assert.equal(visible(),1);
 w.LeaseQantContractWizard.show(4);d.getElementById('saveContractButton').click();
 assert.equal(submitted,0,'save blocked');assert.equal(visible(),1,'jumps to first invalid step');
 d.getElementById('startDate').value='2026-01-01';d.getElementById('monthlyPayment').value='100';
 w.LeaseQantContractWizard.show(4);d.getElementById('saveContractButton').click();assert.equal(submitted,1,'engine submit runs when valid');
 dom.window.close();
});
test('legacy UI leaves the form untouched',async()=>{
 const {dom,d}=await page('legacy');d.getElementById('contractModal').classList.remove('hidden');await tick();
 assert.equal(d.querySelector('.lq-wz-panel'),null);dom.window.close();
});
