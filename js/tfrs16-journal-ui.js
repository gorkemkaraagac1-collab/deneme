/* Journal preview: validate authenticated DTO integrity, render and serialize.
   No account selection, debit/credit construction, totals, FX or schedule math. */
(function(global) {
  "use strict";
  const accepted = new WeakSet();
  let bulkPackages = [];
  let bulkSequence = 0;
  const escape = value => String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const amount = value => new Intl.NumberFormat("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2}).format(value);
  function fail(code="JOURNAL_AUTHORITY_UNAVAILABLE") { const error=new Error(code);error.code=code;throw error; }
  function stable(value) {
    if (Array.isArray(value)) return "["+value.map(stable).join(",")+"]";
    if (value && typeof value === "object") return "{"+Object.keys(value).sort().map(k=>JSON.stringify(k)+":"+stable(value[k])).join(",")+"}";
    return JSON.stringify(value);
  }
  function freeze(value) {
    if (value && typeof value === "object") { Object.values(value).forEach(freeze);Object.freeze(value); }
    return value;
  }
  async function acceptPackage(data,intent) {
    if (!data || data.schemaVersion !== "JOURNAL_AUTHORITY_DTO_V1"
      || data.companyId !== intent.companyId || data.periodStart !== intent.periodStart
      || data.periodEnd !== intent.periodEnd || data.kind !== intent.kind
      || stable(data.contractIds) !== stable([...intent.contractIds].sort())
      || data.supportStatus !== "SUPPORTED" || data.livePostingStatus !== "NOT_READY_FOR_LIVE_POSTING"
      || !Array.isArray(data.vouchers) || data.voucherCount !== data.vouchers.length
      || data.vouchers.length !== intent.contractIds.length
      || !Array.isArray(data.summaryByCurrency) || !/^[a-f0-9]{64}$/.test(data.contentHash || "")) fail("JOURNAL_RESPONSE_INVALID");
    const {contentHash,...body}=data;
    if (!global.crypto?.subtle || typeof TextEncoder !== "function") fail();
    const bytes=await global.crypto.subtle.digest("SHA-256",new TextEncoder().encode(stable(body)));
    const actual=Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,"0")).join("");
    if (actual !== contentHash) fail("JOURNAL_RESPONSE_INTEGRITY_INVALID");
    const seen=new Set();
    for (const voucher of data.vouchers) {
      if (!intent.contractIds.includes(voucher.contractId) || seen.has(voucher.contractId)
        || voucher.companyId !== intent.companyId || voucher.periodStart !== intent.periodStart
        || voucher.periodEnd !== intent.periodEnd || voucher.eventType !== intent.kind
        || voucher.supportStatus !== "SUPPORTED" || voucher.sourceStatus !== "SERVER_PERSISTED_PRIVATE_JOURNAL"
        || voucher.livePostingStatus !== "NOT_READY_FOR_LIVE_POSTING" || voucher.balanced !== true
        || !/^[A-Z]{3}$/.test(voucher.currency || "") || !voucher.calculationId || !voucher.sourceInputHash
        || !voucher.sourceResultHash || !voucher.accountMappingVersion || !voucher.journalId
        || !Number.isFinite(voucher.totalDebit) || !Number.isFinite(voucher.totalCredit)
        || !Number.isFinite(voucher.difference) || !Array.isArray(voucher.lines)) fail("JOURNAL_RESPONSE_INVALID");
      seen.add(voucher.contractId);
      for (const line of voucher.lines) {
        if (!line.lineId || !line.accountCode || !line.accountName || line.currency !== voucher.currency
          || line.contractId !== voucher.contractId || !line.eventId
          || !Number.isFinite(line.debit) || !Number.isFinite(line.credit)
          || line.debit < 0 || line.credit < 0 || !Array.isArray(line.sourceIds)
          || !line.sourceIds.includes(voucher.calculationId) || !line.sourceIds.includes(voucher.sourceResultHash)) fail("JOURNAL_RESPONSE_INVALID");
      }
    }
    const snapshot=freeze(JSON.parse(JSON.stringify(data)));
    accepted.add(snapshot);
    return snapshot;
  }
  function requireAccepted(pkg) { if (!accepted.has(pkg)) fail("JOURNAL_PACKAGE_NOT_VERIFIED"); }
  async function load(intent,bulk) {
    const facade=global.LeaseQantPrivateTfrs16Facade;
    if (typeof facade?.loadJournalAuthorityPackage !== "function") fail();
    return acceptPackage(await facade.loadJournalAuthorityPackage(intent,bulk),intent);
  }
  function loadSingle(contract,period) {
    return load({companyId:contract.companyId,contractIds:[contract.id],...period},false);
  }
  function clearBulk() { bulkPackages=[];++bulkSequence; }
  async function loadBulk(contracts,period) {
    clearBulk();
    const sequence = bulkSequence;
    try {
      const groups=new Map();
      contracts.forEach(contract=>{
        if (!contract.companyId || !contract.id) fail("JOURNAL_SCOPE_REQUIRED");
        if (!groups.has(contract.companyId)) groups.set(contract.companyId,[]);
        groups.get(contract.companyId).push(contract.id);
      });
      if (!groups.size) fail("JOURNAL_POPULATION_EMPTY");
      const results=[];
      for (const [companyId,contractIds] of groups) results.push(await load({companyId,contractIds,...period},true));
      if (sequence !== bulkSequence) fail("JOURNAL_REQUEST_SUPERSEDED");
      bulkPackages=results;
      return results;
    } catch(error) { if (sequence === bulkSequence) clearBulk();throw error; }
  }
  function rowsForPackage(pkg) {
    requireAccepted(pkg);
    return pkg.vouchers.flatMap(voucher=>voucher.lines.map(line=>({
      journalId:voucher.journalId,lineId:line.lineId,voucherNo:voucher.voucherNo,
      displayReference:voucher.displayReference,
      voucherDate:voucher.postingDate,contractId:voucher.contractId,companyId:voucher.companyId,
      company:voucher.company,supplier:voucher.supplier,description:line.description,
      accountCode:line.accountCode,accountName:line.accountName,
      debit:line.debit,credit:line.credit,currency:line.currency,
      functionalDebit:line.functionalDebit,functionalCredit:line.functionalCredit,
      presentationDebit:line.presentationDebit,presentationCredit:line.presentationCredit,
      eventId:line.eventId,sourceResultHash:voucher.sourceResultHash,
      status:voucher.settlementStatus,livePostingStatus:voucher.livePostingStatus
    })));
  }
  function renderPackage(pkg,filter="",sort="") {
    requireAccepted(pkg);
    return pkg.vouchers.map(voucher=>{
      let rows=rowsForPackage(pkg).filter(row=>row.journalId===voucher.journalId);
      if (filter) rows=rows.filter(row=>(row.accountCode+" "+row.accountName+" "+row.contractId).toLowerCase().includes(filter.toLowerCase()));
      if (sort) rows=[...rows].sort((a,b)=>String(a[sort]??"").localeCompare(String(b[sort]??"")));
      return `<section style="margin:12px 0;padding:12px;border:1px solid #dbe3ef;border-radius:8px;"><strong>${escape(voucher.contractId)} — ${escape(voucher.eventType)}</strong>
        <p>${escape(voucher.periodStart)} – ${escape(voucher.periodEnd)} · ${escape(voucher.currency)} · ${escape(voucher.voucherNo)}</p>
        ${voucher.displayReference?`<p>Önizleme referansı: ${escape(voucher.displayReference)}</p>`:""}
        <p>Hesaplanan sözleşmesel önizleme. Gerçek ödeme ve defter kaydı kanıtı değildir.</p>
        <table style="width:100%"><thead><tr><th>Hesap</th><th>Hesap adı</th><th>Borç</th><th>Alacak</th></tr></thead><tbody>
        ${rows.map(row=>`<tr><td>${escape(row.accountCode)}</td><td>${escape(row.accountName)}</td><td>${amount(row.debit)}</td><td>${amount(row.credit)}</td></tr>`).join("")}
        </tbody></table>${!voucher.lines.length?"<p>Backend bu dönem için fiş hareketi bulunmadığını doğruladı.</p>":""}
        <p>Toplam borç: ${amount(voucher.totalDebit)} · Toplam alacak: ${amount(voucher.totalCredit)} · Fark: ${amount(voucher.difference)} · Dengeli</p>
        <small>Geçici önizleme numarası · Canlı muhasebe aktarımı kapalı</small></section>`;
    }).join("");
  }
  function errorHtml(error) {
    const code=error?.code || "JOURNAL_AUTHORITY_UNAVAILABLE";
    const messages={JOURNAL_REQUIRES_CONFIGURATION:"Onaylı şirket hesap eşlemesi gerekiyor.",
      JOURNAL_CURRENCY_PROFILE_REQUIRED:"Onaylı şirket para birimi profili gerekiyor.",
      JOURNAL_CURRENCY_SOURCE_EVIDENCE_NOT_READY:"Bu para birimi rotası için kaynak kanıtı hazır değil.",
      JOURNAL_ROUTE_SOURCE_EVIDENCE_NOT_READY:"Bu fiş rotası için kaynak kanıtı hazır değil.",
      JOURNAL_ROUTE_NOT_SUPPORTED:"Bu fiş rotası desteklenmiyor."};
    return `<p role="alert">${escape(messages[code] || "Güvenilir yevmiye sonucu alınamadı.")}</p><details><summary>Teknik ayrıntı</summary><code>${escape(code)}</code></details>`;
  }
  function serializedRows(packages) { return packages.flatMap(rowsForPackage); }
  function bulkRows() {
    if (!bulkPackages.length) fail("JOURNAL_AUTHORITY_UNAVAILABLE");
    return serializedRows(bulkPackages);
  }
  function databasePreview() {
    if (!bulkPackages.length) return {status:"JOURNAL_AUTHORITY_UNAVAILABLE",journals:[],journalLines:[]};
    bulkPackages.forEach(requireAccepted);
    return {status:"SERVER_PERSISTED_PRIVATE_JOURNAL",
      journals:bulkPackages.flatMap(pkg=>pkg.vouchers.map(voucher=>{
        const {lines,...header}=voucher;
        return {...header,id:voucher.journalId};
      })),journalLines:bulkPackages.flatMap(pkg=>pkg.vouchers.flatMap(voucher=>voucher.lines.map(line=>({
        ...line,id:line.lineId,journalId:voucher.journalId,account:line.accountCode
      }))))};
  }
  function serialize(packages,format="csv") {
    const rows=serializedRows(packages);
    const keys=format==="logo"?['voucherNo','voucherDate','accountCode','debit','credit','description','contractId']
      :format==="mikro"?['voucherNo','voucherDate','accountCode','accountName','debit','credit','description','contractId']
      :format==="txt"?['voucherNo','voucherDate','accountCode','debit','credit','description']
      :Object.keys(rows[0] || {journalId:null});
    const sep=format==="txt"?"\t":";";
    const cell=value=>'"'+String(value ?? "").replace(/"/g,'""')+'"';
    return [keys.map(cell).join(sep),...rows.map(row=>keys.map(key=>cell(row[key])).join(sep))].join("\r\n");
  }
  function exportPackages(packages,format="xlsx") {
    if (!packages.length) fail("JOURNAL_POPULATION_EMPTY");
    const rows=serializedRows(packages);
    if (format==="xlsx" || format==="excel") {
      if (!global.XLSX) fail("JOURNAL_EXPORT_UNAVAILABLE");
      const book=global.XLSX.utils.book_new();
      global.XLSX.utils.book_append_sheet(book,global.XLSX.utils.json_to_sheet(rows),"Yevmiye");
      global.XLSX.writeFile(book,"TFRS16_Yevmiye_Onizleme.xlsx");
    } else {
      const link=global.document.createElement("a");
      const url=global.URL.createObjectURL(new Blob([serialize(packages,format)],{type:"text/plain;charset=utf-8"}));
      link.href=url;link.download="TFRS16_Yevmiye_Onizleme."+(format==="txt"?"txt":"csv");link.click();global.URL.revokeObjectURL(url);
    }
    return true;
  }
  /* UI v2 (tasarım: Yevmiye kayıtları). Tutarlar ve toplamlar sunucudan gelir;
     burada toplam alınmaz, yalnızca filtrelenir ve çizilir. */
  const KIND_LABELS={PERIOD:"Dönem hareketi",INITIAL:"İlk muhasebeleştirme",RECLASSIFICATION:"Kısa / uzun vade sınıflaması"};
  const trDate=iso=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso||""));return m?`${m[3]}.${m[2]}.${m[1]}`:"—";};
  function voucherCard(voucher,filter) {
    const term=String(filter||"").toLowerCase();
    const lines=voucher.lines.filter(line=>!term||(line.accountCode+" "+line.accountName+" "+voucher.contractId).toLowerCase().includes(term));
    if (term && !lines.length) return "";
    return `<article class="lq-jr-card"><header><span class="lq-jr-mono lq-jr-muted">${escape(voucher.voucherNo)}</span><span class="lq-jr-mono">${escape(trDate(voucher.postingDate))}</span>
      <strong>${escape(KIND_LABELS[voucher.eventType]||voucher.eventType)}</strong><span class="lq-jr-mono lq-jr-link">${escape(voucher.contractId)}</span>
      <span class="lq-jr-ok">✓ Dengede</span></header>
      <div class="lq-jr-line is-head"><span>HESAP</span><span>HESAP ADI</span><span>AÇIKLAMA</span><span class="is-r">BORÇ</span><span class="is-r">ALACAK</span></div>
      ${lines.map(line=>`<div class="lq-jr-line"><span class="lq-jr-mono">${escape(line.accountCode)}</span><span class="${line.credit>0&&!line.debit?"is-credit":""}">${escape(line.accountName)}</span><span class="lq-jr-muted">${escape(line.description||"")}</span><span class="lq-jr-mono is-r">${line.debit?amount(line.debit):""}</span><span class="lq-jr-mono is-r">${line.credit?amount(line.credit):""}</span></div>`).join("")}
      ${!voucher.lines.length?'<p class="lq-jr-muted lq-jr-pad">Sunucu bu dönem için fiş hareketi olmadığını doğruladı.</p>':""}
      <footer><span class="lq-jr-muted">${escape(voucher.supplier||"")} · ${escape(voucher.currency)}</span><span class="lq-jr-mono">Borç ${amount(voucher.totalDebit)} · Alacak ${amount(voucher.totalCredit)}</span></footer></article>`;
  }
  function renderIntoV2(container,packages) {
    const vouchers=packages.flatMap(pkg=>pkg.vouchers);
    const summaries=packages.flatMap(pkg=>pkg.summaryByCurrency||[]);
    const count=packages.reduce((n,pkg)=>n+pkg.voucherCount,0);
    const kinds=[...new Set(vouchers.map(v=>v.eventType))];
    const kpi=summaries.length===1
      ? `<div><span class="lq-jr-kick">FİŞ</span><b class="lq-jr-mono">${count}</b></div><div><span class="lq-jr-kick">TOPLAM BORÇ · ${escape(summaries[0].currency)}</span><b class="lq-jr-mono">${amount(summaries[0].totalDebit)}</b></div><div><span class="lq-jr-kick">TOPLAM ALACAK · ${escape(summaries[0].currency)}</span><b class="lq-jr-mono">${amount(summaries[0].totalCredit)}</b></div><div><span class="lq-jr-kick">DENGE</span><b class="lq-jr-ok">✓ Tüm fişler dengede</b></div>`
      : `<div><span class="lq-jr-kick">FİŞ</span><b class="lq-jr-mono">${count}</b></div>${summaries.map(x=>`<div><span class="lq-jr-kick">${escape(x.currency)} BORÇ / ALACAK</span><b class="lq-jr-mono">${amount(x.totalDebit)} / ${amount(x.totalCredit)}</b></div>`).join("")}<div><span class="lq-jr-kick">DENGE</span><b class="lq-jr-ok">✓ Dengede</b></div>`;
    container.innerHTML=`<div class="lq-jr">
      <div class="lq-jr-note"><strong>Önizleme.</strong> Bu fişler muhasebe sisteminize aktarılmadı; fiş numaraları geçicidir. Dışa aktarılan dosya ERP'nize sizin tarafınızdan yüklenir.</div>
      <div class="lq-jr-kpis">${kpi}</div>
      <div class="lq-jr-bar"><div class="lq-jr-seg" role="group" aria-label="Görünüm"><button type="button" data-jr-view="voucher" aria-pressed="true">Fiş bazlı</button><button type="button" data-jr-view="line" aria-pressed="false">Satır bazlı</button></div>
        <label class="lq-jr-search"><span class="lq-sr">Fiş satırlarında ara</span><input data-journal-filter placeholder="Hesap, hesap adı veya sözleşme ara"></label>
        <label class="lq-sr">Sırala <select data-journal-sort><option value="">Sunucu sırası</option><option value="accountCode">Hesap kodu</option><option value="accountName">Hesap adı</option></select></label>
        <span class="lq-jr-grow"></span>
        <details class="lq-jr-export"><summary>Dışa aktar ▾</summary><div>${['xlsx','csv','txt','logo','mikro'].map(format=>`<button type="button" data-journal-export="${format}">${{xlsx:"Excel (xlsx)",csv:"CSV",txt:"Metin (txt)",logo:"Logo biçimi",mikro:"Mikro biçimi"}[format]}</button>`).join("")}<button type="button" data-journal-print>Yazdır / PDF</button></div></details></div>
      <div class="lq-jr-body"><div data-journal-body></div>
        <aside class="lq-jr-aside"><span class="lq-jr-kick">ÖZET</span>
          <div class="lq-jr-kv"><span>Fiş türü</span><span>${escape(kinds.map(k=>KIND_LABELS[k]||k).join(", ")||"—")}</span></div>
          <div class="lq-jr-kv"><span>Dönem</span><span class="lq-jr-mono">${escape(trDate(packages[0]?.periodStart))} – ${escape(trDate(packages[0]?.periodEnd))}</span></div>
          <div class="lq-jr-kv"><span>Hesap eşlemesi</span><span class="lq-jr-mono">${escape([...new Set(vouchers.map(v=>v.accountMappingVersion))].join(", ")||"—")}</span></div>
          <div class="lq-jr-kv"><span>Canlı kayıt</span><span>Kapalı</span></div>
          <p class="lq-jr-muted">Tutarlar sunucudaki doğrulanmış hesaplamadan gelir; sözleşmesel fiştir, gerçekleşen ödeme veya defter kaydı değildir.</p></aside></div></div>`;
    const target=container.querySelector('[data-journal-body]');
    let view="voucher";
    const redraw=()=>{
      const filter=container.querySelector('[data-journal-filter]').value;
      if (view==="voucher") target.innerHTML=vouchers.map(v=>voucherCard(v,filter)).join("")||'<p class="lq-jr-muted lq-jr-pad">Aramayla eşleşen fiş satırı yok.</p>';
      else {
        const sort=container.querySelector('[data-journal-sort]').value;
        let rows=packages.flatMap(rowsForPackage);
        if (filter) rows=rows.filter(row=>(row.accountCode+" "+row.accountName+" "+row.contractId).toLowerCase().includes(filter.toLowerCase()));
        if (sort) rows=[...rows].sort((a,b)=>String(a[sort]??"").localeCompare(String(b[sort]??"")));
        target.innerHTML=`<div class="lq-jr-card"><div class="lq-jr-line is-head is-wide"><span>FİŞ</span><span>SÖZLEŞME</span><span>HESAP</span><span>HESAP ADI</span><span class="is-r">BORÇ</span><span class="is-r">ALACAK</span></div>${rows.map(row=>`<div class="lq-jr-line is-wide"><span class="lq-jr-mono lq-jr-muted">${escape(row.voucherNo)}</span><span class="lq-jr-mono">${escape(row.contractId)}</span><span class="lq-jr-mono">${escape(row.accountCode)}</span><span>${escape(row.accountName)}</span><span class="lq-jr-mono is-r">${row.debit?amount(row.debit):""}</span><span class="lq-jr-mono is-r">${row.credit?amount(row.credit):""}</span></div>`).join("")}</div>`;
      }
    };
    redraw();
    container.querySelector('[data-journal-filter]').addEventListener('input',redraw);
    container.querySelector('[data-journal-sort]').addEventListener('change',redraw);
    container.querySelectorAll('[data-jr-view]').forEach(button=>button.addEventListener('click',()=>{
      view=button.dataset.jrView;container.querySelectorAll('[data-jr-view]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));redraw();}));
    container.querySelectorAll('[data-journal-export]').forEach(button=>button.addEventListener('click',()=>exportPackages(packages,button.dataset.journalExport)));
    container.querySelector('[data-journal-print]').addEventListener('click',()=>{
      const page=global.open("","_blank");
      if (!page) fail("JOURNAL_EXPORT_UNAVAILABLE");
      page.opener=null;
      page.document.write('<!doctype html><meta charset="utf-8"><title>Yevmiye önizleme</title>'+packages.map(pkg=>renderPackage(pkg)).join(""));
      page.document.close();page.print();
    });
  }
  function renderInto(container,packages) {
    if (!container) return;
    packages.forEach(requireAccepted);
    if (global.document?.documentElement?.getAttribute("data-lq-ui")==="2") return renderIntoV2(container,packages);
    container.innerHTML=`<label>Fiş satırlarında ara <input data-journal-filter></label>
      <label>Sırala <select data-journal-sort><option value="">Backend sırası</option><option value="accountCode">Hesap kodu</option><option value="accountName">Hesap adı</option></select></label>
      <div>${['xlsx','csv','txt','logo','mikro'].map(format=>`<button type="button" data-journal-export="${format}">${format.toUpperCase()}</button>`).join(" ")} <button type="button" data-journal-print>Yazdır / PDF</button></div><div data-journal-body></div>`;
    const target=container.querySelector('[data-journal-body]');
    const redraw=()=>{target.innerHTML=packages.map(pkg=>renderPackage(pkg,container.querySelector('[data-journal-filter]').value,container.querySelector('[data-journal-sort]').value)).join("");};
    redraw();
    container.querySelector('[data-journal-filter]').addEventListener('input',redraw);
    container.querySelector('[data-journal-sort]').addEventListener('change',redraw);
    container.querySelectorAll('[data-journal-export]').forEach(button=>button.addEventListener('click',()=>exportPackages(packages,button.dataset.journalExport)));
    container.querySelector('[data-journal-print]').addEventListener('click',()=>{
      // A noopener window.open can return null even when the tab opens.
      // Detach the opener before writing the already accepted preview.
      const page=global.open("","_blank");
      if (!page) fail("JOURNAL_EXPORT_UNAVAILABLE");
      page.opener=null;
      page.document.write('<!doctype html><meta charset="utf-8"><title>Yevmiye önizleme</title>'+packages.map(pkg=>renderPackage(pkg)).join(""));
      page.document.close();page.print();
    });
  }
  const periodChoices = new Map();
  const boundPeriodControls = new WeakSet();
  function bindPeriodControls(container, prefix, scope) {
    if (global.document?.documentElement.getAttribute("data-lq-ui") !== "2" || !container) return;
    const ids = ["Year", "Month", "Period", ...(prefix === "bulkAccounting" ? ["StartDate", "EndDate"] : ["CustomStart", "CustomEnd"])];
    const controls = ids.map(id => container.querySelector("#" + prefix + id));
    if (!controls[0] || !controls[1]) return;
    const common = global.LeaseQantReportingPeriod?.get?.() || global.LeaseQantReportingAuthorityUi?.defaultPeriod?.();
    const date = /^(\d{4})-(\d{2})-/.exec(common?.periodStart || "");
    const saved = periodChoices.get(scope);
    if (!saved && !date) return; // Missing common period is never replaced by January.
    const values = saved || [date[1], String(Number(date[2])), "monthly", common.periodStart, common.periodEnd];
    controls.forEach((control, i) => {
      if (!control) return;
      if (control.tagName === "SELECT" && !Array.from(control.options).some(o => o.value === values[i])) {
        const option = global.document.createElement("option");option.value = values[i];option.textContent = values[i];control.append(option);
      }
      control.value = values[i];
    });
    if (!boundPeriodControls.has(controls[0])) {
      boundPeriodControls.add(controls[0]);
      controls.forEach(control => control?.addEventListener("change", () => {
        periodChoices.set(scope, controls.map(c => c?.value || ""));
        const preview = container.querySelector(prefix === "bulkAccounting" ? "#bulkJournalPreview" : "#journalPreview");
        if (preview) preview.innerHTML = '<p>Seçilen dönem için önizlemeyi yeniden alın.</p>';
        if (prefix === "bulkAccounting") {
          clearBulk();
          const summary = container.querySelector("#bulkJournalSummary");if (summary) summary.innerHTML = "";
          const exp = container.querySelector("#exportBulkJournals");if (exp) exp.disabled = true;
        }
      }));
    }
  }

  function mappingHtml(pkg) {
    requireAccepted(pkg);
    if (pkg.vouchers.some(v => !v.accountMappingId || !/^[a-f0-9]{64}$/.test(v.accountMappingHash || ""))) fail("JOURNAL_MAPPING_EVIDENCE_INVALID");
    return pkg.vouchers.map(voucher => `<section class="gk-v26-card"><h3>${escape(voucher.contractId)} · dönem fişinde kullanılan hesaplar</h3>
      <p>Sunucuda onaylı eşleme · sürüm ${escape(voucher.accountMappingVersion)} · kimlik ${escape(voucher.accountMappingId)}<br>Kaynak hash: <code>${escape(voucher.accountMappingHash)}</code><br>Yevmiye kaynağı: ${escape(voucher.journalId)} · ${escape(trDate(voucher.periodStart))}–${escape(trDate(voucher.periodEnd))}</p>
      <table class="gk-v26-table"><thead><tr><th>Muhasebe amacı</th><th>Hesap kodu</th><th>Hesap adı</th></tr></thead><tbody>${voucher.lines.map(line => `<tr><td>${escape(line.accountPurpose)}</td><td>${escape(line.accountCode)}</td><td>${escape(line.accountName)}</td></tr>`).join("")}</tbody></table></section>`).join("");
  }

  function renderAccountMapping(container, options) {
    let sequence = 0;
    const companies = options.companies || [];
    container.innerHTML = `<div class="gk-v26-page"><h2>Onaylı hesap eşleme kaynağı</h2><p>Fişlerde sunucunun onayladığı şirket eşlemesi kullanılır. Aşağıda dönem fişlerinde kullanılan hesaplar gösterilir; eşlemenin tüm kapsamı değildir. Değişiklikler yetkili sunucu onay sürecinde yapılmalıdır. Yerel varsayılanlar fiş kaynağı değildir.</p><label>Şirket <select id="amCompanySelect">${companies.map(c => `<option value="${escape(c.id)}">${escape(c.name)}</option>`).join("")}</select></label><div id="amStatus" role="status" aria-live="polite"></div><div data-approved-mapping></div></div>`;
    const select = container.querySelector("#amCompanySelect"), target = container.querySelector("[data-approved-mapping]"), status = container.querySelector("#amStatus");
    if (companies.some(c => String(c.id) === String(options.companyId))) select.value = String(options.companyId);
    async function refresh() {
      const seq = ++sequence, companyId = select.value;
      container.dataset.companyId = companyId;
      target.innerHTML = "";status.textContent = "Onaylı fiş eşleme kaynağı yükleniyor…";
      try {
        const period = global.LeaseQantReportingPeriod?.get?.() || global.LeaseQantReportingAuthorityUi?.defaultPeriod?.();
        if (!period?.periodStart || !period?.periodEnd) fail("JOURNAL_SCOPE_REQUIRED");
        const contracts = (options.contracts || []).filter(c => String(c.companyId) === companyId && c.status === "active");
        if (!contracts.length) fail("JOURNAL_POPULATION_EMPTY");
        const pkg = await load({companyId, contractIds:contracts.map(c => c.id), kind:"PERIOD", periodStart:period.periodStart,periodEnd:period.periodEnd},true);
        if (seq !== sequence || !target.isConnected || select.value !== companyId) return;
        target.innerHTML = mappingHtml(pkg);
        status.textContent = "Doğrulanmış sunucu fişi · salt okunur. Tam eşleme yönetim kaynağı bu arayüzde bulunmuyor.";
      } catch(error) {
        if (seq !== sequence || !target.isConnected) return;
        status.textContent = "Onaylı eşleme kaynağı alınamadı; yerel varsayılan gösterilmez.";
        target.innerHTML = errorHtml(error);
      }
    }
    select.addEventListener("change",refresh);
    const unsubscribe = global.LeaseQantReportingPeriod?.subscribe?.(() => {
      if (!target.isConnected) { unsubscribe?.();return; }
      refresh();
    });
    refresh();
  }
  global.LeaseQantTfrs16JournalUi={acceptPackage,loadSingle,loadBulk,clearBulk,bindPeriodControls,mappingHtml,renderAccountMapping,
    rowsForPackage,renderPackage,renderInto,errorHtml,serialize,exportPackages,bulkRows,databasePreview,
    exportBulk:format=>exportPackages(bulkPackages,format),renderBulk:container=>renderInto(container,bulkPackages)};
})(window);
