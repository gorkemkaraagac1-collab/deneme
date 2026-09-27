'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const source=fs.readFileSync(path.join(__dirname,'../js/tfrs16-operations-ui.js'),'utf8');
test('modification page opens when the separate pending-approvals report is unavailable',()=>{
 const dom=new JSDOM('<main id="host"></main>',{url:'https://example.test/tfrs16.html',runScripts:'outside-only'}),w=dom.window;
 w.GK_TFRS16={getOperationContracts:()=>[],getModificationReport:()=>{throw Error('REPORTING_AUTHORITY_UNAVAILABLE');},
  getReassessmentReport:()=>{throw Error('REPORTING_AUTHORITY_UNAVAILABLE');}};
 w.eval(source);w.LeaseQantTfrs16OperationsUi.renderModificationReassessment(w.document.getElementById('host'));
 const text=w.document.getElementById('host').textContent;
 assert.match(text,/Modifikasyon & Reassessment/);assert.match(text,/rapor kaynağı henüz hazır değil/);
 assert.ok(!text.includes('REPORTING_AUTHORITY_UNAVAILABLE'));
 dom.window.close();
});
