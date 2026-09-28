'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const src=fs.readFileSync(path.join(__dirname,'../js/lq-date-fields.js'),'utf8');
async function page(html,ui='2'){
 const dom=new JSDOM(`<!doctype html><html data-lq-ui="${ui}"><body>${html}</body></html>`,{url:'https://example.test/tfrs16.html',runScripts:'outside-only'});
 const w=dom.window;w.eval(src);if(w.document.readyState==='loading')await new Promise(r=>w.document.addEventListener('DOMContentLoaded',r,{once:true}));return {dom,w,d:w.document};
}
test('parses Turkish and ISO date text, rejects impossible dates',async()=>{
 const {dom,w}=await page('');const {parseTr,isoToTr}=w.LeaseQantDateFields;
 assert.equal(parseTr('31.12.2026'),'2026-12-31');assert.equal(parseTr('3.1.2026'),'2026-01-03');
 assert.equal(parseTr('31/12/2026'),'2026-12-31');assert.equal(parseTr('2026-02-28'),'2026-02-28');
 assert.equal(parseTr('31122026'),'2026-12-31');assert.equal(parseTr(''),'');
 assert.equal(parseTr('29.02.2026'),null);assert.equal(parseTr('31.04.2026'),null);assert.equal(parseTr('12/31/2026'),null);
 assert.equal(isoToTr('2026-09-30'),'30.09.2026');dom.window.close();
});
test('native input keeps ISO value and id; proxy shows GG.AA.YYYY both ways',async()=>{
 const {dom,w,d}=await page('<form id="f"><label for="startDate">Başlangıç</label><input type="date" id="startDate" name="startDate" required></form>');
 const native=d.getElementById('startDate'),proxy=d.querySelector('[data-lq-date-proxy="startDate"]');
 assert.ok(proxy);assert.equal(proxy.getAttribute('aria-label'),'Başlangıç');
 native.value='2027-03-15';assert.equal(proxy.value,'15.03.2027');
 let changes=0;native.addEventListener('change',()=>changes++);
 proxy.value='01.04.2027';proxy.dispatchEvent(new w.Event('input'));
 assert.equal(native.value,'2027-04-01');assert.equal(changes,1);
 assert.equal(native.required,true,'engine still sees the field as required');
 assert.equal(native.hasAttribute('required'),false,'hidden native field cannot block submit');
 assert.equal(proxy.required,true);
 native.required=false;assert.equal(proxy.required,false);assert.equal(native.required,false);
 dom.window.close();
});
test('invalid text does not change the stored value and is flagged on blur',async()=>{
 const {dom,w,d}=await page('<input type="date" id="endDate" value="2030-12-31" min="2026-01-01">');
 const native=d.getElementById('endDate'),proxy=d.querySelector('.lq-date-text');
 assert.equal(proxy.value,'31.12.2030');
 proxy.value='31.02.2030';proxy.dispatchEvent(new w.Event('input'));proxy.dispatchEvent(new w.Event('blur'));
 assert.equal(native.value,'2030-12-31');assert.equal(proxy.getAttribute('aria-invalid'),'true');
 proxy.value='01.01.2020';proxy.dispatchEvent(new w.Event('input'));
 assert.match(proxy.validationMessage,/01\.01\.2026 veya sonrası/);
 dom.window.close();
});
test('legacy UI leaves date inputs untouched',async()=>{
 const {dom,d}=await page('<input type="date" id="x">','1');
 assert.equal(d.querySelector('.lq-date-text'),null);dom.window.close();
});
