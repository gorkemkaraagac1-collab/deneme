/* Journal preview: validate authenticated DTO integrity, render and serialize.
   No account selection, debit/credit construction, totals, FX or schedule math. */
(function(global) {
  "use strict";
  const accepted = new WeakSet();
  let bulkPackages = [];
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
  function clearBulk() { bulkPackages=[]; }
  async function loadBulk(contracts,period) {
    clearBulk();
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
      bulkPackages=results;
      return results;
    } catch(error) { clearBulk();throw error; }
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
  function renderInto(container,packages) {
    if (!container) return;
    packages.forEach(requireAccepted);
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
  global.LeaseQantTfrs16JournalUi={acceptPackage,loadSingle,loadBulk,clearBulk,
    rowsForPackage,renderPackage,renderInto,errorHtml,serialize,exportPackages,bulkRows,databasePreview,
    exportBulk:format=>exportPackages(bulkPackages,format),renderBulk:container=>renderInto(container,bulkPackages)};
})(window);
