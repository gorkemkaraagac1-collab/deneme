'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom');
const src=fs.readFileSync(path.join(__dirname,'../js/shell.js'),'utf8');
test('logout clears tab session token and asks the server to clear the session cookie',async()=>{
 const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://leaseqant.com/index.html',runScripts:'outside-only',virtualConsole:new VirtualConsole()});
 const w=dom.window;const calls=[];
 w.fetch=(url,init)=>{calls.push({url:String(url),init});return Promise.resolve({ok:true,status:204});};
 w.sessionStorage.setItem('gk_session_token','tok');w.localStorage.setItem('access_token','old');
 w.eval(src);w.logout();
 assert.equal(w.sessionStorage.getItem('gk_session_token'),null);
 assert.equal(w.localStorage.getItem('access_token'),null);
 const call=calls.find(c=>c.url.endsWith('/api/auth/logout'));
 assert.ok(call,'server logout called');assert.equal(call.init.method,'POST');assert.equal(call.init.credentials,'include');
 assert.equal(call.init.headers.Authorization,'Bearer tok');
 await new Promise(r=>setTimeout(r,20));dom.window.close();
});
