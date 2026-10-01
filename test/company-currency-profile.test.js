'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom');
const adminJs=fs.readFileSync(path.join(__dirname,'../frontend/js/admin.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../frontend/admin/companies.html'),'utf8');
const pageJs=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
function win(responses){
 const d=new JSDOM('<!doctype html><body><div id="host"></div></body>',{url:'https://leaseqant.com/frontend/admin/companies.html',runScripts:'outside-only',virtualConsole:new VirtualConsole()});
 const calls=[];d.window.fetch=(url,init={})=>{calls.push({url:String(url),init});const r=responses.shift()||{};return Promise.resolve({ok:true,json:()=>Promise.resolve(r)});};
 d.window.eval(adminJs+'\n'+pageJs);return {w:d.window,calls};
}
function mount(w,id){w.document.getElementById('host').innerHTML=`<div id="companyCurrencyProfile" data-company-id="${id}"></div>`;}
test('profil yoksa açıkça "Profil yok" der ve yöneticiye kayıt formu sunar',async()=>{
 const {w,calls}=win([{success:true,data:[]}]);mount(w,'C1');
 await w.loadCompanyCurrencyProfile('C1',true);
 assert.match(calls[0].url,/\/api\/admin\/company-profiles\?companyId=C1$/);
 const host=w.document.getElementById('companyCurrencyProfile');
 assert.match(host.textContent,/Profil yok/);assert.ok(w.document.getElementById('currencyProfileForm'));
});
test('yönetici olmayan form görmez; onaylı güncel profil listelenir, devredilmiş olan listelenmez',async()=>{
 const {w}=win([{success:true,data:[
  {id:'P2',functionalCurrency:'TRY',presentationCurrency:'TRY',effectiveFrom:'2026-01-01',effectiveThrough:null,approvalStatus:'APPROVED',version:'V2',superseded:false},
  {id:'P1',functionalCurrency:'TRY',presentationCurrency:'USD',effectiveFrom:'2025-01-01',effectiveThrough:null,approvalStatus:'APPROVED',version:'V1',superseded:true}]}]);
 mount(w,'C1');await w.loadCompanyCurrencyProfile('C1',false);
 const t=w.document.getElementById('companyCurrencyProfile').textContent;
 assert.match(t,/TRY → TRY/);assert.match(t,/Onaylı · V2/);assert.doesNotMatch(t,/USD/);
 assert.equal(w.document.getElementById('currencyProfileForm'),null);
});
test('form, sunucunun kabul ettiği alanlarla POST eder ve hata kodunu Türkçe gösterir',async()=>{
 const {w,calls}=win([{success:true,data:[]},{success:false,code:'DISCLOSURE_PROFILE_PERIOD_OVERLAP'}]);
 mount(w,'C1');await w.loadCompanyCurrencyProfile('C1',true);
 const f=w.document.getElementById('currencyProfileForm');
 f.elements.functionalCurrency.value='try';f.elements.effectiveFrom.value='2026-01-01';
 f.elements.evidenceId.value='EV-1';f.elements.sourceReference.value='REF-1';f.elements.reason.value='ilk kayıt';
 await w.submitCompanyCurrencyProfile({preventDefault(){},target:f},'C1');
 assert.equal(calls[1].init.method,'POST');
 assert.deepEqual(JSON.parse(calls[1].init.body),{companyId:'C1',functionalCurrency:'TRY',presentationCurrency:'TRY',effectiveFrom:'2026-01-01',evidenceId:'EV-1',sourceReference:'REF-1',reason:'ilk kayıt'});
 assert.match(w.document.getElementById('cpStatus').textContent,/çakışan onaylı bir profil/);
});
