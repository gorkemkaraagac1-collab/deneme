'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');
const periodSrc=fs.readFileSync(path.join(root,'js/lq-reporting-period.js'),'utf8');
const authoritySrc=fs.readFileSync(path.join(root,'js/tfrs16-report-authority-ui.js'),'utf8');
const pad=n=>String(n).padStart(2,'0');
function previousMonthKey(){const now=new Date(),d=new Date(now.getFullYear(),now.getMonth()-1,1);return `${d.getFullYear()}-${pad(d.getMonth()+1)}`;}
function monthsAgo(n){const now=new Date(),d=new Date(now.getFullYear(),now.getMonth()-n,1);return `${d.getFullYear()}-${pad(d.getMonth()+1)}`;}
function load(withPeriod=true){
 const dom=new JSDOM('<main></main>',{url:'https://example.test/tfrs16.html',runScripts:'outside-only'}),w=dom.window;
 if(withPeriod)w.eval(periodSrc);
 w.eval(authoritySrc);
 return {dom,w};
}
test('default reporting period is the previous month end, unchanged without a selection',()=>{
 const {dom,w}=load(false),p=w.LeaseQantReportingAuthorityUi.defaultPeriod();
 const key=previousMonthKey();assert.equal(p.periodStart,`${key}-01`);assert.equal(p.reportingDate,p.periodEnd);
 const shared=load(true),q=shared.w.LeaseQantReportingAuthorityUi.defaultPeriod();
 assert.deepEqual({...q},{...p});dom.window.close();shared.dom.window.close();
});
test('a selected month drives the authority default period and notifies subscribers',()=>{
 const {dom,w}=load(true),api=w.LeaseQantReportingPeriod,key=monthsAgo(3);let seen=null;
 api.subscribe(v=>{seen=v.key;});
 assert.equal(api.set(key),true);assert.equal(seen,key);
 const [y,m]=key.split('-').map(Number),last=new Date(y,m,0).getDate();
 const p=w.LeaseQantReportingAuthorityUi.defaultPeriod();
 assert.equal(p.periodStart,`${key}-01`);assert.equal(p.periodEnd,`${key}-${pad(last)}`);assert.equal(p.reportingDate,p.periodEnd);
 assert.equal(w.sessionStorage.getItem('lq-reporting-period'),key);dom.window.close();
});
test('current or future months and malformed keys are rejected',()=>{
 const {dom,w}=load(true),api=w.LeaseQantReportingPeriod,now=new Date();
 assert.equal(api.set(`${now.getFullYear()}-${pad(now.getMonth()+1)}`),false);
 assert.equal(api.set('2026-13'),false);assert.equal(api.set('abc'),false);assert.equal(api.set(monthsAgo(30)),false);
 assert.equal(api.get().key,previousMonthKey());assert.equal(api.months(12).length,12);
 assert.equal(api.months(12).at(-1),previousMonthKey());dom.window.close();
});
