'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom');
const adminJs=fs.readFileSync(path.join(__dirname,'../frontend/js/admin.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../frontend/admin/fx-rates.html'),'utf8');
const pageJs=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
test('toplu doğrulama senkronizasyon tarihlerinden bağımsız, bekleyen kurların aralığını gönderir',async()=>{
 const d=new JSDOM(html.replace(/<script[\s\S]*?<\/script>/g,''),{url:'https://leaseqant.com/frontend/admin/fx-rates.html',runScripts:'outside-only',virtualConsole:new VirtualConsole()});
 const w=d.window,calls=[];
 w.fetch=(url,init={})=>{calls.push({url:String(url),init});return Promise.resolve({ok:true,status:200,json:()=>Promise.resolve(String(url).includes('bulk-verify')?{verified:7}:{rates:[]}),text:()=>Promise.resolve('{}')});};
 w.confirm=()=>true;
 w.eval(adminJs+'\n'+pageJs+'\nwindow.__setPending=v=>{pendingRatesCache=v;};');
 w.document.getElementById('fromDate').value='2026-10-01';w.document.getElementById('toDate').value='2026-10-02';
 w.__setPending([{rateDate:'2026-09-28T00:00:00.000Z'},{rateDate:'2026-09-23'},{rateDate:'2026-09-25'}]);
 await w.bulkVerifyRates();
 const call=calls.find(c=>c.url.endsWith('/api/fx-rates/bulk-verify'));
 assert.ok(call);assert.deepEqual(JSON.parse(call.init.body),{from:'2026-09-22',to:'2026-09-29'});
});
