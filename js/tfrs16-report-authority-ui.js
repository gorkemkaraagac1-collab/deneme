/* Authenticated server-owned reporting. UI math is limited to date intent,
   sorting/filtering/visual coordinates; no financial totals or FX conversion. */
(function(global){
 'use strict';
 const accepted=new WeakSet(),pending=new Map();let current=null,dashboardEpoch=0;
 const metrics=['rouCarryingAmount','leaseLiability','currentLiability','nonCurrentLiability','periodInterest','periodDepreciation',
  'contractualPayments','next12MonthPayments','next12MonthPrincipal','next12MonthInterest','openingROU','openingLiability'];
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fail=(code='REPORTING_AUTHORITY_UNAVAILABLE')=>{const e=new Error(code);e.code=code;throw e;};
 const stable=v=>Array.isArray(v)?'['+v.map(stable).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}':JSON.stringify(v);
 const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
 function requirePackage(p){if(!accepted.has(p))fail('REPORTING_PACKAGE_NOT_VERIFIED');}
 async function acceptPackage(p,intent){
  if(!p||p.schemaVersion!=='REPORTING_AUTHORITY_DTO_V1'||p.identity?.companyId!==intent.companyId
   ||stable(p.period)!==stable(intent)||p.sourceStatus!=='SERVER_PERSISTED_PRIVATE_REPORTING'
   ||p.livePostingStatus!=='NOT_READY_FOR_LIVE_POSTING'||!p.identity.populationId||!Array.isArray(p.contracts)
   ||!Array.isArray(p.population?.contractIds)||p.population.count!==p.contracts.length
   ||p.population.count!==p.population.contractIds.length||!['COMPLETE_POPULATION','UNAVAILABLE'].includes(p.population.coverage)
   ||!Array.isArray(p.population.exclusions)||!p.controls||!Array.isArray(p.audit?.rows)
   ||!p.unsupported||!p.totals||!global.crypto?.subtle)fail('REPORTING_RESPONSE_INVALID');
  const {contentHash,...body}=p;
  const digest=await global.crypto.subtle.digest('SHA-256',new TextEncoder().encode(stable(body)));
  if(Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('')!==contentHash)fail('REPORTING_RESPONSE_INTEGRITY_INVALID');
  const checkMetric=(m)=>{if(!m||!Array.isArray(m.sourceIds)||!['SUPPORTED','ZERO_CONFIRMED','NOT_READY'].includes(m.status)
   ||(m.status==='NOT_READY'?m.value!==null:!Number.isFinite(m.value))||(m.value!==null&&m.currency!==p.identity.presentationCurrency))fail('REPORTING_RESPONSE_INVALID');};
  metrics.forEach(k=>checkMetric(p.totals[k]));
  const ids=new Set();
  p.contracts.forEach(r=>{
   if(r.companyId!==intent.companyId||ids.has(r.contractId)||!p.population.contractIds.includes(r.contractId))fail('REPORTING_RESPONSE_INVALID');ids.add(r.contractId);
   if(r.status==='SUPPORTED'){
    if(r.route!=='P1_PLAIN_MONTHLY_ARREARS'||!p.identity.currencyEvidenceId||p.identity.functionalCurrency!=='TRY'||p.identity.presentationCurrency!=='TRY'||r.currency!=='TRY'||r.currencyEvidenceId!==p.identity.currencyEvidenceId||!r.calculationId||!r.sourceInputHash||!r.sourceResultHash||!r.economicSignature||!Array.isArray(r.scheduleRows))fail('REPORTING_RESPONSE_INVALID');
    metrics.forEach(k=>{checkMetric(r.metrics?.[k]);if(r.metrics[k].status==='NOT_READY'||stable(r.metrics[k].sourceIds)!==stable([r.calculationId,r.sourceInputHash,r.sourceResultHash]))fail('REPORTING_RESPONSE_INVALID');});
   }else if(r.status!=='NOT_READY'||!r.reason||r.metrics!==null)fail('REPORTING_RESPONSE_INVALID');
  });
  // Structural coverage validation, not accounting aggregation.
  if(p.population.includedCount+p.population.excludedCount!==p.population.count
    ||p.population.excludedCount!==p.population.exclusions.length
    ||(p.population.excludedCount>0&&p.population.coverage!=='UNAVAILABLE'))fail('REPORTING_RESPONSE_INVALID');
  if(p.population.includedCount!==p.contracts.filter(r=>r.status==='SUPPORTED').length||p.population.excludedCount!==p.contracts.filter(r=>r.status==='NOT_READY').length
    ||p.population.exclusions.some(e=>!p.contracts.some(r=>r.contractId===e.contractId&&r.status==='NOT_READY'&&r.reason===e.reason))
    ||(p.population.coverage==='UNAVAILABLE'&&metrics.some(k=>p.totals[k].value!==null))
    ||(!p.identity.currencyEvidenceId&&metrics.some(k=>p.totals[k].value!==null)))fail('REPORTING_RESPONSE_INVALID');
  const snapshot=freeze(JSON.parse(JSON.stringify(p)));accepted.add(snapshot);return snapshot;
 }
 async function companies(){
  const f=global.LeaseQantPrivateCalculation?.getReportingCompanies;if(typeof f!=='function')fail();
  const response=await f();if(!Array.isArray(response?.companies))fail('REPORTING_RESPONSE_INVALID');return response.companies;
 }
 async function load(intent){
  const f=global.LeaseQantPrivateCalculation?.getReportingAuthorityPackage;if(typeof f!=='function')fail();
  const key=stable(intent);
  if(!pending.has(key))pending.set(key,Promise.resolve(f(intent)).then(p=>acceptPackage(p,intent)).finally(()=>pending.delete(key)));
  return pending.get(key);
 }
 function isoDate(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const date=new Date(`${value}T00:00:00Z`);return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value;}
 function validPeriodRange(periodStart,periodEnd){return isoDate(periodStart)&&isoDate(periodEnd)&&periodStart<=periodEnd;}
 function defaultPeriod(){const shared=global.LeaseQantReportingPeriod?.get?.();
  if(shared&&validPeriodRange(shared.periodStart,shared.periodEnd))return {periodStart:shared.periodStart,periodEnd:shared.periodEnd,reportingDate:shared.periodEnd};
  const now=new Date(),end=new Date(now.getFullYear(),now.getMonth(),0),start=new Date(end.getFullYear(),end.getMonth(),1);
  const dateOnly=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const periodStart=dateOnly(start),periodEnd=dateOnly(end);return {periodStart,periodEnd,reportingDate:periodEnd};}
 const trDate=value=>{const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value||''));return match?`${match[3]}.${match[2]}.${match[1]}`:'—';};
 const trMonth=value=>{if(!isoDate(value))return 'DÖNEM';return new Intl.DateTimeFormat('tr-TR',{month:'long',timeZone:'UTC'}).format(new Date(`${value}T00:00:00Z`));};
 function read(reportingDate){requirePackage(current);if(reportingDate){const d=reportingDate instanceof Date?reportingDate:new Date(reportingDate);
   const key=typeof reportingDate==='string'?reportingDate:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
   if(current.period.reportingDate!==key)fail('REPORTING_PERIOD_SOURCE_REQUIRED');}return current;}
 function rawRows(p,section='metrics',contractId){requirePackage(p);
  const provenance={companyId:p.identity.companyId,populationId:p.identity.populationId,periodStart:p.period.periodStart,periodEnd:p.period.periodEnd,coverage:p.population.coverage};
  if(section==='audit')return p.audit.rows.filter(r=>!contractId||r.contract_id===contractId).map(r=>({...r,...provenance,evidenceType:p.audit.evidenceType,timeBasis:p.audit.timeBasis,auditCoverage:p.audit.status}));
  if(section==='controls')return (p.controls.checks||[]).map(r=>({...r,...provenance,controlSourceHash:p.controls.sourceResultHash,controlScope:p.controls.status}));
  if(section==='schedule')return p.contracts.filter(r=>r.status==='SUPPORTED'&&(!contractId||r.contractId===contractId)).flatMap(r=>r.scheduleRows.map(row=>({...row,...provenance,coverage:p.population.excludedCount?'SUPPORTED_SUBSET':'COMPLETE_POPULATION'})));
  if(section==='contracts')return p.contracts.map(r=>({contractId:r.contractId,companyId:r.companyId,status:r.status,reason:r.reason||null,currency:r.currency||null,...provenance}));
  const contract=contractId?p.contracts.find(r=>r.contractId===contractId):null;if(contractId&&contract?.status!=='SUPPORTED')fail('REPORTING_SOURCE_NOT_READY');
  return metrics.map(metric=>({metric,...(contract?contract.metrics:p.totals)[metric],...provenance,...(contract?{contractId,coverage:contract.metrics[metric].coverage,populationCoverage:p.population.coverage}: {})}));
 }
 function serialize(p,format='csv',section='metrics',contractId){const rows=rawRows(p,section,contractId),keys=Object.keys(rows[0]||{status:null});
  const cell=v=>'"'+String(v&&typeof v==='object'?JSON.stringify(v):v??'').replace(/"/g,'""')+'"';
  const sep=format==='txt'?'\t':';';return [keys.map(cell).join(sep),...rows.map(row=>keys.map(k=>cell(row[k])).join(sep))].join('\r\n');}
 const metricLabels={rouCarryingAmount:'Kullanım hakkı varlığı',leaseLiability:'Kira yükümlülüğü',currentLiability:'Kısa vadeli yükümlülük',
  nonCurrentLiability:'Uzun vadeli yükümlülük',periodInterest:'Dönem faizi',periodDepreciation:'Dönem amortismanı',
  contractualPayments:'Sözleşmesel ödemeler',next12MonthPayments:'Gelecek 12 ay ödemeleri',next12MonthPrincipal:'Gelecek 12 ay anapara',
  next12MonthInterest:'Gelecek 12 ay faizi',openingROU:'Açılış kullanım hakkı varlığı',openingLiability:'Açılış kira yükümlülüğü'};
 function statusLabel(status){return ({SUPPORTED:'Hazır',ZERO_CONFIRMED:'Doğrulanmış sıfır',NOT_READY:'Veri henüz hazır değil',
  PASS:'Geçti',FAIL:'Kontrol başarısız',WARNING:'İnceleme gerekli',
  NOT_SUPPORTED:'Bu kapsam henüz desteklenmiyor',NOT_APPLICABLE:'Uygulanmıyor',REQUIRES_LEDGER_DATA:'Defter verisi gerekli',
  REQUIRES_CONFIGURATION:'Yapılandırma gerekli',REQUIRES_ENTITY_INPUT:'Şirket verisi gerekli',
  COMPLETE_POPULATION:'Tam kapsam',UNAVAILABLE:'Kapsam hazır değil',SUPPORTED_CALCULATION_DIAGNOSTICS:'Hesaplama kontrolleri mevcut'}[status]
  ||'Kaynak doğrulaması gerekli');}
 function reasonLabel(reason){if(reason==='REPORTING_CURRENCY_PROFILE_REQUIRED'||reason==='DISCLOSURE_ENTITY_PROFILE_REQUIRED')return 'Onaylı para birimi profili gerekli';
  if(reason==='REPORTING_INTENT_INVALID'||reason==='REPORTING_PERIOD_NOT_SUPPORTED')return 'Dönem tarihlerini kontrol edin';
  if(reason==='REPORTING_ROUTE_NOT_SUPPORTED')return 'Bu sözleşme türü için rapor rotası desteklenmiyor';
  if(reason==='ACTUAL_LEDGER_CASH_REQUIRED'||String(reason).includes('LEDGER'))return 'Doğrulanmış defter verisi gerekli';
  if(String(reason).includes('MATURITY'))return 'Onaylı vade kaynağı gerekli';
  if(String(reason).includes('WEIGHTING'))return 'Onaylı ağırlıklandırma kaynağı gerekli';
  if(String(reason).includes('SOURCE')||String(reason).includes('EVIDENCE'))return 'Doğrulanmış kaynak verisi gerekli';
  return 'Bu alan için ek kaynak veya yapılandırma gerekli';}
 function display(m,empty=false){if(m.value===null)return empty?'Sözleşme yok':'Veri henüz hazır değil';
  return new Intl.NumberFormat('tr-TR',{maximumFractionDigits:2}).format(m.value)+(m.currency?' '+m.currency:'');}
 function shownCell(value,key){if(key==='metric')return metricLabels[value]||'Rapor kalemi';
  if(key==='status'||key==='coverage'||key==='controlScope'||key==='auditCoverage')return statusLabel(value);
  if(key==='reason')return reasonLabel(value);
  if(key==='currency'||key.endsWith('Id'))return value??'—';
  if(value&&typeof value==='object')return 'Teknik ayrıntıda';
  if(typeof value==='string'&&/^[A-Z][A-Z0-9_]+$/.test(value))return statusLabel(value);
  return value??'—';}
 function html(p,section='metrics',contractId) {requirePackage(p);const rows=rawRows(p,section,contractId),emptyMetricPopulation=section==='metrics'&&p.population.count===0,
  visibleRows=(section==='controls'&&p.population.count===0)||emptyMetricPopulation?[]:rows;
  const keys=section==='metrics'?['metric','value','currency','status','coverage']:section==='controls'?['description','status']:Object.keys(visibleRows[0]||{});
  const labels={metric:'Gösterge',value:'Ham tutar',currency:'Para birimi',status:'Durum',coverage:'Kapsam',description:'Kontrol'};
  return `<h3>${esc(p.identity.companyName)} · ${esc(p.period.periodStart)} – ${esc(p.period.periodEnd)}</h3>
   <p role="status">${p.population.count===0?'Bu dönemde bu şirket için aktif sözleşme yok.':
    `${esc(statusLabel(p.population.coverage))} · ${p.population.count} sözleşme, ${p.population.includedCount} dahil, ${p.population.excludedCount} için kaynak hazır değil.`}</p>
   ${p.population.exclusions.map(r=>`<p>${esc(r.contractId)}: ${esc(reasonLabel(r.reason))}</p>`).join('')}
   ${emptyMetricPopulation?'<p class="lq-authority-empty">Bu dönemde aktif sözleşme yok; finansal tutar gösterilmiyor.</p>':visibleRows.length?`<div class="lq-authority-table"><table><thead><tr>${keys.map(k=>`<th>${esc(labels[k]||k)}</th>`).join('')}</tr></thead><tbody>${visibleRows.map(r=>`<tr>${keys.map(k=>`<td>${esc(shownCell(r[k],k))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:
    '<p class="lq-authority-empty">Bu dönem için gösterilecek satır bulunmuyor.</p>'}
   ${p.population.count>0?`<p>Hesaplama kontrolleri: ${esc(statusLabel(p.controls.status))}. Kapanış veya canlı kayıt onayı değildir.</p>`:''}
   <details><summary>Teknik kaynak ayrıntıları</summary><pre>${esc(JSON.stringify({rows,unsupported:p.unsupported,controls:p.controls},null,2))}</pre></details>`;}
 function styles(container) {
  container.classList?.add('lq-report-authority');if(global.document.getElementById('lq-report-authority-style'))return;
  const style=global.document.createElement('style');style.id='lq-report-authority-style';style.textContent=`
   .lq-report-authority {color:#172033;background:#fff;border:1px solid #dbe3ee;border-radius:12px;padding:22px;line-height:1.5;max-width:100%;box-sizing:border-box;}
   .lq-report-authority h2,.lq-report-authority h3 {color:#172033!important;}.lq-report-authority label{display:inline-block;margin:6px 12px 8px 0;color:#334155;}
   .lq-report-authority input,.lq-report-authority select{padding:7px;border:1px solid #cbd5e1;border-radius:6px;max-width:100%;background:#fff;color:#172033;}
   .lq-report-authority button{padding:7px 12px;margin:4px;border:1px solid #cbd5e1;border-radius:6px;background:#f1f5f9;color:#172033;cursor:pointer;}
   .lq-report-authority .lq-authority-table{max-width:100%;overflow:auto;}.lq-report-authority table{border-collapse:collapse;width:100%;}
   .lq-report-authority td,.lq-report-authority th{padding:9px;border-bottom:1px solid #e2e8f0;text-align:left;white-space:nowrap;}
   .lq-report-authority details{margin-top:12px;}.lq-report-authority details pre{white-space:pre-wrap;overflow-wrap:anywhere;max-width:100%;}
   .lq-report-authority [role=alert]{color:#9f1239;}.lq-report-authority .lq-authority-empty{padding:18px;border-radius:10px;background:#f1f5f9;}
  `;global.document.head.appendChild(style);
 }

 function exportPackage(p,format='xlsx',section='metrics',contractId){requirePackage(p);const rows=rawRows(p,section,contractId);
  if(format==='xlsx'||format==='excel'){if(!global.XLSX)fail('REPORTING_EXPORT_UNAVAILABLE');const book=global.XLSX.utils.book_new();
   global.XLSX.utils.book_append_sheet(book,global.XLSX.utils.json_to_sheet(rows),'Rapor');global.XLSX.writeFile(book,'TFRS16_Backend_Rapor.xlsx');
  }else if(format==='pdf'||format==='print'){const page=global.open('','_blank');if(!page)fail('REPORTING_EXPORT_UNAVAILABLE');page.opener=null;
   page.document.write('<!doctype html><meta charset="utf-8"><title>TFRS16 Rapor</title>'+html(p,section,contractId));page.document.close();page.print();
  }else{const content=format==='html'?html(p,section,contractId):serialize(p,format,section,contractId);
   const url=global.URL.createObjectURL(new Blob([content],{type:format==='html'?'text/html;charset=utf-8':'text/plain;charset=utf-8'}));
   const link=global.document.createElement('a');link.href=url;link.download='TFRS16_Backend_Rapor.'+(format==='txt'?'txt':format==='html'?'html':'csv');link.click();global.URL.revokeObjectURL(url);}
  return true;
 }
 function errorHtml(e){return `<p role="alert">Rapor şu anda gösterilemiyor. ${esc(reasonLabel(e?.code))}</p><details><summary>Teknik ayrıntı</summary><code>${esc(e?.code||'REPORTING_AUTHORITY_UNAVAILABLE')}</code></details>`;}
 function isUiV2(){return global.document?.documentElement?.getAttribute('data-lq-ui')==='2';}
 function lockPeriodKey(period){
  if(!validPeriodRange(period.periodStart,period.periodEnd)||period.periodStart.slice(8)!=='01'
   ||period.periodStart.slice(0,7)!==period.periodEnd.slice(0,7))return null;
  const last=new Date(`${period.periodEnd}T00:00:00Z`);last.setUTCDate(last.getUTCDate()+1);
  return last.getUTCDate()===1?period.periodStart.slice(0,7):null;
 }
 async function loadPeriodLock(intent){
  const periodKey=lockPeriodKey(intent);if(!periodKey)return {state:'UNSUPPORTED_RANGE'};
  const f=global.LeaseQantPrivateCalculation?.getPeriodLockStatus;
  if(typeof f!=='function')return {state:'UNAVAILABLE',code:'PERIOD_STATUS_SOURCE_REQUIRED'};
  try{
   const data=await f({companyId:intent.companyId,periodKey});
   if(!data||data.companyId!==intent.companyId||data.periodKey!==periodKey||!['OPEN','LOCKED'].includes(data.status)
    ||(data.status==='OPEN'?data.lockedAt!==null:typeof data.lockedAt!=='string'||!Number.isFinite(Date.parse(data.lockedAt))))fail('PERIOD_STATUS_RESPONSE_INVALID');
   return {state:data.status,companyId:data.companyId,periodKey,lockedAt:data.lockedAt};
  }catch(error){return {state:'UNAVAILABLE',code:error?.code||'PERIOD_STATUS_UNAVAILABLE'};}
 }
 function lockLabel(lock){return ({OPEN:'Açık',LOCKED:'Kilitli',LOADING:'Sunucu durumu yükleniyor…',UNSUPPORTED_RANGE:'Tam aylık dönem seçin',UNAVAILABLE:'Sunucu durumu alınamadı'}[lock?.state]||'Sunucu durumu gerekli');}
 function periodAuthorityNote(lock){
  const known=lock?.state==='OPEN'||lock?.state==='LOCKED';
  const evidence=known?`<p>Şirket: ${esc(lock.companyId)} · Dönem: ${esc(lock.periodKey)} · Salt okunur sunucu yanıtı${lock.lockedAt?` · Kilit tarihi: ${esc(trDate(lock.lockedAt.slice(0,10)))}`:''}</p>`:
   lock?.state==='UNSUPPORTED_RANGE'?'<p>Kilit kaynağı yalnızca tek bir tam ayı destekler; seçili tarih aralığının kilit durumu varsayılmaz.</p>':
   lock?.state==='UNAVAILABLE'?`<p>Eksik veya başarısız yanıt açık dönem olarak kabul edilmez.</p><details><summary>Teknik ayrıntı</summary><code>${esc(lock.code)}</code></details>`:'';
  return `<aside class="lq-pg-note lq-rc-role-note" role="note" data-period-lock-state="${esc(lock?.state||'UNKNOWN')}"><div><strong>Dönem kilidi · ${esc(lockLabel(lock))}</strong>${evidence}<p>Dönem kapatma/açma yalnızca ADMIN yetkisindedir. Kilit durumu kullanıcı rolünü veya işlem yetkisini doğrulamaz. Bu ekran salt okunurdur; kapatma/açma işlemi sunulmaz.</p></div></aside>`;
 }
 function closeSummaryHtml(p,lock){
  const checks=Array.isArray(p.controls?.checks)?p.controls.checks:[];
  const coverageOk=p.population.coverage==='COMPLETE_POPULATION'&&p.population.excludedCount===0;
  const controlsReady=p.controls.status==='SUPPORTED_CALCULATION_DIAGNOSTICS';
  const attention=checks.filter(row=>row.status&&row.status!=='PASS');
  const steps=[
   ['Sözleşme kapsamı',coverageOk?'done':'warn',coverageOk?'Tam kapsam doğrulandı':statusLabel(p.population.coverage)],
   ['Hesaplama kontrolleri',!controlsReady?'unknown':attention.length?'warn':'done',!controlsReady?statusLabel(p.controls.status):attention.length?`${attention.length} kontrol inceleme istiyor`:`${checks.length} kontrol geçti`],
   ['Dönem kilidi',lock?.state==='LOCKED'?'done':lock?.state==='OPEN'?'warn':'unknown',lockLabel(lock)]
  ];
  const verified=steps.filter(row=>row[1]==='done').length;
  const stepHtml=steps.map(([label,state,note],i)=>`${i?'<i class="lq-pg-rail is-todo"></i>':''}<span class="lq-pg-step is-${state}"><b aria-hidden="true">${state==='done'?'✓':state==='warn'?'!':''}</b><span>${esc(label)}<small>${esc(note)}</small></span></span>`).join('');
  const coverage=p.population.coverage==='COMPLETE_POPULATION'&&p.population.excludedCount===0?'Tam kapsam':`${statusLabel(p.population.coverage)} · ${p.population.excludedCount} sözleşme için kaynak gerekli`;
  const actionHtml=attention.length?attention.map(row=>`<div class="lq-rc-action"><i class="is-warn" aria-hidden="true"></i><span>${esc(row.description||'Hesaplama kontrolü')}</span><b>${esc(statusLabel(row.status))}</b></div>`).join(''):
   controlsReady?`<p class="lq-pg-empty is-ok">Sunucu hesaplama kontrollerinde inceleme gerektiren sonuç yok.</p>`:`<p class="lq-pg-empty">Hesaplama kontrol sonucu için kaynak gerekli.</p>`;
  return `<section class="lq-rc-summary" aria-labelledby="lqRcSummaryTitle">
   <div class="lq-pg-card lq-pg-runway" aria-label="Kapanış durumu"><div class="lq-pg-runway-t"><span class="lq-pg-kick">${esc(trMonth(p.period.reportingDate).toLocaleUpperCase('tr-TR'))} KAPANIŞI</span><strong>${verified} / ${steps.length} kaynaklı adım</strong></div><div class="lq-pg-steps">${stepHtml}</div></div>
   <section class="lq-pg-card lq-pg-pad lq-rc-data-card"><div class="lq-pg-cardhead"><div><span class="lq-pg-kick">SUNUCU RAPORU</span><h2 id="lqRcSummaryTitle">Kapanış durumu</h2></div><span class="lq-pg-pill ${coverageOk?'is-ok':'is-warn'}">${esc(statusLabel(p.population.coverage))}</span></div>
    <div class="lq-rc-facts"><div><span>Şirket</span><strong>${esc(p.identity.companyName)}</strong></div><div><span>Dönem</span><strong>${esc(trDate(p.period.periodStart))} – ${esc(trDate(p.period.periodEnd))}</strong></div><div><span>Sözleşme</span><strong>${new Intl.NumberFormat('tr-TR').format(p.population.count)}</strong></div><div><span>Hesaplama kontrolleri</span><strong>${esc(statusLabel(p.controls.status))}</strong></div><div><span>Dahil</span><strong>${new Intl.NumberFormat('tr-TR').format(p.population.includedCount)}</strong></div><div><span>Kaynak bekleyen</span><strong>${new Intl.NumberFormat('tr-TR').format(p.population.excludedCount)}</strong></div></div>
   </section>
   <section class="lq-pg-card lq-pg-pad lq-rc-actions"><div class="lq-pg-cardhead"><div><span class="lq-pg-kick">AKSİYON MERKEZİ</span><h2>İnceleme gerekenler</h2></div><button type="button" class="lq-pg-btn is-link" data-rc-go-controls>Kontrollere git →</button></div><div class="lq-rc-action-list">${actionHtml}</div></section>
   ${periodAuthorityNote(lock)}<p class="lq-rc-disclaimer" role="status">Bu paket doğrulanmış hesaplama kontrolü sağlar; dönem kapatma, yevmiye kaydı veya canlı kayıt onayı değildir.</p>
  </section>`;
 }
 function controlsTableHtml(p,filter='',sort='',lock){
  let rows=rawRows(p,'controls').slice();
  const term=String(filter||'').trim().toLocaleLowerCase('tr-TR');
  if(term)rows=rows.filter(row=>`${row.description||''} ${row.status||''}`.toLocaleLowerCase('tr-TR').includes(term));
  if(sort)rows.sort((a,b)=>String(a[sort]||'').localeCompare(String(b[sort]||''),'tr-TR'));
  if(!rows.length)return `<section class="lq-pg-card lq-pg-pad"><span class="lq-pg-kick">SUNUCU KONTROL PAKETİ</span><p class="lq-pg-empty" role="status">${p.population.count===0?'Bu dönemde aktif sözleşme yok; kontrol satırı bulunmuyor.':'Bu dönem için gösterilecek kontrol satırı bulunmuyor.'}</p><p class="lq-rc-disclaimer">Boş liste, dönemin kapatıldığı veya bütün işlemlerin tamamlandığı anlamına gelmez.</p>${periodAuthorityNote(lock)}</section>`;
  return `<section class="lq-pg-card lq-pg-pad lq-rc-data-card"><div class="lq-pg-cardhead"><div><span class="lq-pg-kick">SUNUCU KONTROL PAKETİ</span><h2>Hesaplama kontrolleri</h2></div><span class="lq-pg-muted lq-pg-small">${rows.length} satır</span></div>
   <div class="lq-pg-filters"><label class="lq-pg-search"><span aria-hidden="true">⌕</span><input data-report-filter type="search" aria-label="Kontrollerde ara" placeholder="Kontrollerde ara" value="${esc(filter)}"></label><label class="lq-pg-select"><span class="lq-sr-only">Kontrol sıralaması</span><select data-report-sort aria-label="Kontrol sıralaması"><option value="">Sunucu sırası</option><option value="description"${sort==='description'?' selected':''}>Kontrol adı</option><option value="status"${sort==='status'?' selected':''}>Durum</option></select></label>${['xlsx','csv','txt','html','pdf'].map(f=>`<button class="lq-pg-btn lq-rc-export" data-report-export="${f}" type="button">${f.toUpperCase()}</button>`).join('')}</div>
   <div class="lq-pg-table lq-rc-table"><table><thead><tr><th scope="col">Kontrol</th><th scope="col">Durum</th></tr></thead><tbody>${rows.map(row=>`<tr data-check-row><td>${esc(row.description||'Kontrol adı kaynakta yok')}</td><td><span class="lq-pg-pill ${row.status==='PASS'?'is-ok':row.status==='FAIL'||row.status==='WARNING'?'is-warn':'is-muted'}">${esc(statusLabel(row.status))}</span></td></tr>`).join('')}</tbody></table></div>
   <p class="lq-rc-disclaimer">Sonuçlar seçili şirket ve dönem için sunucu paketinden gelir. Hesaplama kontrolü, dönem kapatma veya yevmiye kaydı değildir.</p>${periodAuthorityNote(lock)}</section>`;
 }
 async function pageV2Controls(container,title){
  const isClose=/ay sonu|kapanış/i.test(String(title||'')),firstTab=isClose?'close':'controls';
  let activeTab=firstTab,filter='',sort='',epoch=0,periodLock=null;
  const heading=isClose?'Dönem Kapanışı':'Kontroller';
  container.innerHTML=`<div class="lq-pg lq-rc-page"><header class="lq-pg-head"><div><span class="lq-pg-kick">TFRS 16 · DÖNEM SONU</span><h1 class="lq-pg-h1">${esc(heading)}</h1><div class="lq-pg-sub" data-rc-period>Rapor dönemi yükleniyor…</div></div></header>
   <section class="lq-pg-card lq-pg-pad lq-rc-filter-card"><div class="lq-rc-period-fields"><label>Şirket<select data-report-company aria-label="Şirket"></select></label><label>Başlangıç<input type="date" data-report-start aria-label="Dönem başlangıcı"></label><label>Bitiş<input type="date" data-report-end aria-label="Dönem sonu"></label><button class="lq-pg-btn is-primary" data-report-load type="button">Raporu getir</button></div><p data-report-period-error role="alert" hidden></p></section>
   <div class="lq-pg-tabs" role="tablist" aria-label="Kapanış ve kontrol görünümleri"><button id="lqRcCloseTab" type="button" role="tab" aria-controls="lqRcOutput" aria-selected="${firstTab==='close'}" data-rc-tab="close">Kapanış durumu</button><button id="lqRcControlsTab" type="button" role="tab" aria-controls="lqRcOutput" aria-selected="${firstTab==='controls'}" data-rc-tab="controls">Hesaplama kontrolleri</button></div>
   <div id="lqRcOutput" data-report-output class="lq-rc-output" role="tabpanel" aria-labelledby="${firstTab==='close'?'lqRcCloseTab':'lqRcControlsTab'}"><p class="lq-pg-empty" role="status">Güvenilir rapor yükleniyor…</p></div></div>`;
  const output=container.querySelector('[data-report-output]'),startField=container.querySelector('[data-report-start]'),endField=container.querySelector('[data-report-end]'),loadButton=container.querySelector('[data-report-load]'),periodError=container.querySelector('[data-report-period-error]'),companyField=container.querySelector('[data-report-company]');
  let scope=[];
  const syncPeriod=()=>{const valid=validPeriodRange(startField.value,endField.value);endField.min=startField.value||'';startField.max=endField.value||'';startField.setAttribute('aria-invalid',String(!valid));endField.setAttribute('aria-invalid',String(!valid));loadButton.disabled=!valid;periodError.hidden=valid;periodError.textContent=valid?'':'Dönem başlangıcı, dönem sonundan sonra olamaz. İki tarihi kontrol edin.';current=null;periodLock=null;++epoch;output.replaceChildren();return valid;};
  const refreshHeading=()=>{const company=scope.find(row=>String(row.id)===String(companyField.value));const periodStart=startField.value,periodEnd=endField.value;const el=container.querySelector('[data-rc-period]');if(el)el.textContent=`${company?.name||'Şirket kaynağı gerekli'} · ${trDate(periodStart)} – ${trDate(periodEnd)}`;};
  const draw=(p)=>{
   container.querySelectorAll('[data-rc-tab]').forEach(tab=>{const selected=tab.dataset.rcTab===activeTab;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;});
   output.setAttribute('aria-labelledby',activeTab==='close'?'lqRcCloseTab':'lqRcControlsTab');
   output.innerHTML=activeTab==='close'?closeSummaryHtml(p,periodLock):controlsTableHtml(p,filter,sort,periodLock);
   output.querySelector('[data-report-filter]')?.addEventListener('input',event=>{filter=event.currentTarget.value;draw(p);const input=output.querySelector('[data-report-filter]');if(input){input.focus();input.setSelectionRange(filter.length,filter.length);}});
   output.querySelector('[data-report-sort]')?.addEventListener('change',event=>{sort=event.currentTarget.value;draw(p);});
   output.querySelectorAll('[data-report-export]').forEach(button=>button.addEventListener('click',()=>exportPackage(p,button.dataset.reportExport,'controls')));
   output.querySelector('[data-rc-go-controls]')?.addEventListener('click',()=>{activeTab='controls';draw(p);container.querySelector('#lqRcControlsTab')?.focus();});
  };
  const run=async()=>{
   if(!syncPeriod())return;
   const revision=++epoch;current=null;output.innerHTML='<p class="lq-pg-empty" role="status">Güvenilir rapor yükleniyor…</p>';
   try{const companyId=companyField.value,periodStart=startField.value,periodEnd=endField.value;if(!companyId)fail('REPORTING_COMPANY_SOURCE_REQUIRED');
    const intent={companyId,periodStart,periodEnd,reportingDate:periodEnd};
    const p=await load(intent);if(revision!==epoch||!output.isConnected)return;current=p;periodLock={state:'LOADING'};draw(p);
    const lock=await loadPeriodLock(intent);if(revision!==epoch||!output.isConnected)return;periodLock=lock;draw(p);
   }catch(e){if(revision===epoch){current=null;output.innerHTML=`<section class="lq-pg-card lq-pg-pad lq-rc-error">${errorHtml(e)}</section>`;}}
  };
  try{
   scope=await companies();const period=defaultPeriod(),activeCompanyId=global.document.getElementById('v26ActiveCompanySelect')?.value;
   companyField.innerHTML=scope.map(c=>`<option value="${esc(c.id)}"${activeCompanyId&&activeCompanyId!=='ALL'&&String(c.id)===String(activeCompanyId)?' selected':''}>${esc(c.name)}</option>`).join('');
   if(!companyField.value&&scope.length)companyField.value=String(scope[0].id);
   startField.value=period.periodStart;endField.value=period.periodEnd;
   if(!scope.length){output.innerHTML='<p class="lq-pg-empty" role="status">Erişilebilir şirket kaynağı bulunamadı; rapor yüklenmedi.</p>';loadButton.disabled=true;return;}
   startField.addEventListener('input',syncPeriod);startField.addEventListener('change',syncPeriod);endField.addEventListener('input',syncPeriod);endField.addEventListener('change',syncPeriod);
   companyField.addEventListener('change',()=>{refreshHeading();void run();});
   container.querySelectorAll('[data-rc-tab]').forEach(tab=>{
    tab.addEventListener('click',()=>{activeTab=tab.dataset.rcTab;if(current)draw(current);else container.querySelector('[data-report-load]')?.click();});
    tab.addEventListener('keydown',event=>{const tabs=Array.from(container.querySelectorAll('[data-rc-tab]'));const index=tabs.indexOf(tab);let next=-1;
     if(event.key==='ArrowRight')next=(index+1)%tabs.length;else if(event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=tabs.length-1;
     if(next>=0){event.preventDefault();const target=tabs[next];activeTab=target.dataset.rcTab;if(current)draw(current);else container.querySelector('[data-report-load]')?.click();target.focus();}
    });
   });
   loadButton.addEventListener('click',run);syncPeriod();refreshHeading();await run();
  }catch(e){current=null;output.innerHTML=`<section class="lq-pg-card lq-pg-pad lq-rc-error">${errorHtml(e)}</section>`;}
 }
 async function page(container,title='Finansal Rapor',section='metrics'){
  if(!container)return;styles(container);
  if(isUiV2()&&section==='controls'){container.classList.add('lq-v2-report');return pageV2Controls(container,title);}
  container.classList.remove('lq-v2-report');current=null;container.innerHTML='<p>Güvenilir rapor yükleniyor...</p>';
  try{const scope=await companies(),period=defaultPeriod();
   const activeCompanyId=global.document.getElementById('v26ActiveCompanySelect')?.value;
   container.innerHTML=`<h2>${esc(title)}</h2><label>Şirket <select data-report-company>${scope.map(c=>`<option value="${esc(c.id)}"${activeCompanyId&&activeCompanyId!=='ALL'&&String(c.id)===String(activeCompanyId)?' selected':''}>${esc(c.name)}</option>`).join('')}</select></label>
    <label>Başlangıç <input type="date" data-report-start value="${period.periodStart}" aria-describedby="report-period-error"></label><label>Bitiş <input type="date" data-report-end value="${period.periodEnd}" aria-describedby="report-period-error"></label>
    <p id="report-period-error" data-report-period-error role="alert" hidden></p><button data-report-load>Raporu getir</button><div data-report-output></div>`;
   const output=container.querySelector('[data-report-output]'),startField=container.querySelector('[data-report-start]'),endField=container.querySelector('[data-report-end]'),loadButton=container.querySelector('[data-report-load]'),periodError=container.querySelector('[data-report-period-error]');let epoch=0;
   const syncPeriod=()=>{const valid=validPeriodRange(startField.value,endField.value);endField.min=startField.value||'';startField.max=endField.value||'';
    startField.setAttribute('aria-invalid',String(!valid));endField.setAttribute('aria-invalid',String(!valid));loadButton.disabled=!valid;
    periodError.hidden=valid;periodError.textContent=valid?'':'Dönem başlangıcı, dönem sonundan sonra olamaz. İki tarihi kontrol edin.';
    current=null;++epoch;output.replaceChildren();return valid;};
   const run=async()=>{if(!syncPeriod()){++epoch;current=null;output.replaceChildren();return;}
    const revision=++epoch;current=null;output.innerHTML='<p>Güvenilir rapor yükleniyor...</p>';
    try{const companyId=container.querySelector('[data-report-company]').value,periodStart=container.querySelector('[data-report-start]').value,periodEnd=container.querySelector('[data-report-end]').value;
     const p=await load({companyId,periodStart,periodEnd,reportingDate:periodEnd});if(revision!==epoch||!output.isConnected)return;current=p;
     output.innerHTML=`<label>Satırlarda ara <input data-report-filter></label><label>Sırala <select data-report-sort><option value="">Backend sırası</option><option value="0">İlk sütun</option></select></label>
      ${['xlsx','csv','txt','html','pdf'].map(f=>`<button data-report-export="${f}">${f.toUpperCase()}</button>`).join(' ')}<div data-report-body>${html(p,section)}</div>`;
     output.querySelectorAll('[data-report-export]').forEach(button=>button.onclick=()=>exportPackage(p,button.dataset.reportExport,section));
     const filter=()=>{const text=output.querySelector('[data-report-filter]').value.toLowerCase();output.querySelectorAll('tbody tr').forEach(row=>row.hidden=!row.textContent.toLowerCase().includes(text));};
     output.querySelector('[data-report-filter]').oninput=filter;
     output.querySelector('[data-report-sort]').onchange=()=>{const tbody=output.querySelector('tbody');if(tbody)Array.from(tbody.rows).sort((a,b)=>a.cells[0].textContent.localeCompare(b.cells[0].textContent)).forEach(row=>tbody.appendChild(row));};
    }catch(e){if(revision===epoch){current=null;output.innerHTML=errorHtml(e);}}
   };
   startField.addEventListener('input',syncPeriod);startField.addEventListener('change',syncPeriod);
   endField.addEventListener('input',syncPeriod);endField.addEventListener('change',syncPeriod);
   loadButton.onclick=run;container.querySelector('[data-report-company]').onchange=run;syncPeriod();await run();
  }catch(e){current=null;container.innerHTML=errorHtml(e);}
 }
 async function dashboard(){const revision=++dashboardEpoch,ids={leaseLiability:'leaseLiability',rouAssets:'rouCarryingAmount',currentLiability:'currentLiability',next12Months:'next12MonthPayments',monthlyInterest:'periodInterest',monthlyDepreciation:'periodDepreciation'};
  const aliases={leaseLiability:'kpiLiability',rouAssets:'kpiRou',currentLiability:'kpiCurrent',contractCount:'kpiContractCount'};
  const set=(id,value)=>{[id,aliases[id]].filter(Boolean).forEach(key=>{const el=global.document.getElementById(key);if(el)el.textContent=value;});};
  Object.keys(ids).forEach(id=>set(id,'Yükleniyor…'));set('contractCount','Yükleniyor…');['renewals90Days','modifications'].forEach(id=>set(id,'Kaynak verisi gerekli'));set('kpiDataAsOf','Yükleniyor…');global.__GK_TFRS16_DASHBOARD_METRICS__=null;refreshDashboardPresentation('Yükleniyor…');
  try{const scope=await companies(),period=defaultPeriod();const packages=[];
   for(const c of scope)packages.push(await load({companyId:c.id,...period}));if(revision!==dashboardEpoch)return;
   global.__GK_TFRS16_REPORTING_COMPANIES__=scope.map(c=>({id:String(c.id),name:String(c.name||c.id)}));
   if(typeof global.Event==='function')global.dispatchEvent?.(new global.Event('gk-reporting-companies-ready'));
   global.__GK_TFRS16_DASHBOARD_METRICS__={reportingDate:period.reportingDate,source:'SERVER_PERSISTED_PRIVATE_REPORTING',packages,
    groups:packages.map(p=>({companyId:p.identity.companyId,currency:p.identity.presentationCurrency,coverage:p.population.coverage,
     liability:p.totals.leaseLiability.value,rou:p.totals.rouCarryingAmount.value,current:p.totals.currentLiability.value,nonCurrent:p.totals.nonCurrentLiability.value,
     next12Payments:p.totals.next12MonthPayments.value,monthlyInterest:p.totals.periodInterest.value,monthlyDepreciation:p.totals.periodDepreciation.value})),closeScore:null};refreshDashboardPresentation();
  }catch(e){if(revision!==dashboardEpoch)return;global.__GK_TFRS16_DASHBOARD_METRICS__=null;refreshDashboardPresentation('Veri alınamadı');}
 }
 function refreshDashboardPresentation(state='Veri alınamadı') {
  const snapshot=global.__GK_TFRS16_DASHBOARD_METRICS__,packages=snapshot?.packages;
  const set=(ids,value)=>{for(const id of ids){const el=global.document.getElementById(id);if(el){if(el.textContent!==value)el.textContent=value;el.style.overflowWrap='anywhere';}}};
  const mapping={leaseLiability:['leaseLiability','kpiLiability','lqTotalLiability'],rouCarryingAmount:['rouAssets','kpiRou','lqTotalRou'],
   currentLiability:['currentLiability','kpiCurrent','lqCurrentLiability','lqCurrentLegend'],
   nonCurrentLiability:['lqNonCurrentLegend'],next12MonthPayments:['next12Months','lqNext12Payments'],
   periodInterest:['monthlyInterest','lqMonthlyInterest'],periodDepreciation:['monthlyDepreciation','lqMonthlyDep']};
  const countIds=['contractCount','kpiContractCount','lqActiveContracts'];
  if(!Array.isArray(packages)){
   Object.values(mapping).forEach(ids=>set(ids,state));set(countIds,state);set(['kpiDataAsOf','lqDashboardSubtitle'],state);
  }else{
   packages.forEach(requirePackage);
   const company=global.document.getElementById('v26ActiveCompanySelect')?.value||'ALL';
   const selected=company==='ALL'?packages:packages.filter(p=>p.identity.companyId===company);
   const single=selected.length===1?selected[0]:null;
   if(single){
    for(const [key,ids] of Object.entries(mapping)){
     const unavailableReasons=[...new Set(single.population.exclusions.map(row=>row.reason))];
     const value=single.totals[key].value===null&&unavailableReasons.length===1
      ?reasonLabel(unavailableReasons[0]):display(single.totals[key],single.population.count===0);
     set(ids,value);
    }
    set(countIds,String(single.population.count));
    const scopeText=single.population.count===0?'Bu dönemde aktif sözleşme yok':statusLabel(single.population.coverage);
    set(['kpiDataAsOf','lqDashboardSubtitle'],`${single.identity.companyName} · ${single.period.reportingDate} · ${scopeText}`);
   }else{
    const unavailable=selected.filter(p=>p.population.coverage!=='COMPLETE_POPULATION').length;
    const message=selected.length?`${selected.length} şirket · ${unavailable?`${unavailable} şirketin kaynağı hazır değil · `:''}Finansal tutar için şirket seçin`:'Raporlanabilir şirket yok';
    Object.values(mapping).forEach(ids=>set(ids,'Şirket seçin'));set(countIds,selected.length?'Şirket seçin':'Sözleşme yok');
    set(['kpiDataAsOf','lqDashboardSubtitle'],message);
   }
   set(['lqCompanyScope'],single?single.identity.companyName:'Tüm Şirketler');
  }
  // These charts/readiness conclusions have no approved source in this reporting DTO.
  ['lqCurrentPct','lqReadinessScore','lqRenewalCount','lqModificationCount'].forEach(id=>set([id],'Veri hazır değil'));
  set(['lqAssetLegend'],'Varlık sınıfı için doğrulanmış şirket verisi gerekli');
  set(['lqLiabilityBars'],'Vade görünümü için onaylı kaynak gerekli');
  global.document.querySelector('.lq-axis')?.replaceChildren();
  ['.lq-split-ring','.lq-asset-ring'].forEach(selector=>{const el=global.document.querySelector(selector);if(el){el.style.background='#e2e8f0';el.style.setProperty('--current-pct','0%');}});
  const progress=global.document.getElementById('lqPaymentProgress');if(progress)progress.style.width='0%';
  ['lqReadyContracts','lqReadyCompany','lqReadyPeriod'].forEach(id=>{const el=global.document.getElementById(id);if(el)el.className='pending';});
 }
 async function renderContractDetails(container,contract){
  const targets=['summary','schedule','audit'].map(kind=>({kind,target:container?.querySelector('[data-authoritative-report-'+kind+']')}));
  const notify=detail=>{try{global.dispatchEvent(new CustomEvent('lq:contract-report',{detail:{contractId:contract.id,...detail}}));}catch(_){}};
  let pkg=null,found=null;
  try{const p=await load({companyId:contract.companyId,...defaultPeriod()}),row=p.contracts.find(r=>r.contractId===contract.id);pkg=p;found=row||null;
   if(!row||row.status!=='SUPPORTED')fail(row?.reason||'REPORTING_SOURCE_NOT_READY');
   targets.forEach(({kind,target})=>{if(!target?.isConnected)return;
    if(kind==='summary')target.innerHTML=`<p>${esc(p.period.reportingDate)} · ${esc(row.currency)} · ${esc(row.calculationId)}</p>`+
      metrics.map(k=>`<p>${esc(metricLabels[k])}: ${display(row.metrics[k])}</p>`).join('');
    else{const rows=rawRows(p,kind==='schedule'?'schedule':'audit',contract.id),keys=Object.keys(rows[0]||{});
     target.innerHTML=`<p>${kind==='audit'?esc(p.audit.evidenceType):'Backend sözleşmesel plan; gerçek ödeme kanıtı değildir.'}</p><table><thead><tr>${keys.map(k=>`<th>${esc(k)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${keys.map(k=>`<td>${esc(r[k]&&typeof r[k]==='object'?JSON.stringify(r[k]):r[k]??'—')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;}
   });
   notify({package:p,row});
  }catch(e){targets.forEach(({target})=>{if(target?.isConnected)target.innerHTML=errorHtml(e);});
   notify(pkg&&found?{package:pkg,row:found}:{error:{code:e?.code||'REPORTING_AUTHORITY_UNAVAILABLE'},period:defaultPeriod()});}
 }
 global.LeaseQantReportingAuthorityUi={acceptPackage,companies,load,read,rawRows,serialize,html,exportPackage,page,dashboard,errorHtml,defaultPeriod,validPeriodRange,renderContractDetails,refreshDashboardPresentation};
})(window);
