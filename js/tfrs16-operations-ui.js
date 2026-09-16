/* LeaseQant TFRS16 — private-result operation page UI. */
(function (global) {
  "use strict";

  let selectedSlbContractId = null;
  let selectedSubleaseContractId = null;
  let selectedAccountingContractId = null;

  function bridge() { return global.GK_TFRS16 || {}; }
  function contracts() {
    const list = bridge().getOperationContracts;
    return typeof list === "function" ? list() : [];
  }
  function escapeHtml(value) {
    const fn = bridge().escapeHtml;
    return typeof fn === "function" ? fn(value) : String(value ?? "");
  }
  function selectedBanner(contract) {
    const fn = bridge().v26SelectedContractBanner;
    return typeof fn === "function" ? fn(contract) : "";
  }
  function prepare(container) {
    if (!container) return false;
    bridge().injectV26Styles?.();
    return true;
  }
  function sortedContracts() {
    return contracts().slice().sort((a, b) => String(a.id).localeCompare(String(b.id)));
  }
  function options(list, selectedId) {
    return list.map(contract => {
      const label = [contract.id, contract.company, contract.supplier].filter(Boolean).join(" — ");
      return `<option value="${escapeHtml(contract.id)}" ${contract.id === selectedId ? "selected" : ""}>${escapeHtml(label)}</option>`;
    }).join("");
  }

  function renderSaleAndLeaseback(container) {
    if (!prepare(container)) return;
    const render = () => {
      const list = sortedContracts();
      if (!selectedSlbContractId && list.length) selectedSlbContractId = list[0].id;
      const selected = list.find(contract => contract.id === selectedSlbContractId) || null;
      container.innerHTML = `
        <div class="gk-v26-page">
          <div style="margin-bottom:16px;"><h2 style="margin:0;font-size:20px;color:#0f172a;">Satış ve Geri Kiralama (SLB)</h2><p style="margin:4px 0 0;font-size:13px;color:#64748b;">TFRS 16.98-103 kapsamındaki satış-ve-geri-kiralama işlemleri sözleşme bazında yönetiliyor.</p></div>
          <div class="gk-v26-card" style="margin-bottom:0;"><label style="font-size:11px;font-weight:700;color:#64748b;display:block;margin-bottom:6px;">Sözleşme</label>
            <select id="v26SlbContractSelect" style="width:100%;max-width:480px;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;">${list.length ? options(list, selectedSlbContractId) : '<option value="">Sözleşme bulunamadı</option>'}</select>
            ${selectedBanner(selected)}
          </div><div id="slbSectionContainer"></div>
        </div>`;
      container.querySelector("#v26SlbContractSelect")?.addEventListener("change", event => { selectedSlbContractId = event.target.value; render(); });
      if (selected) bridge().renderSlbSection?.(selected);
    };
    render();
  }

  function renderSublease(container) {
    if (!prepare(container)) return;
    const render = () => {
      const list = sortedContracts();
      if (!selectedSubleaseContractId && list.length) selectedSubleaseContractId = list[0].id;
      const selected = list.find(contract => contract.id === selectedSubleaseContractId) || null;
      container.innerHTML = `
        <div class="gk-v26-page">
          <div style="margin-bottom:16px;"><h2 style="margin:0;font-size:20px;color:#0f172a;">Alt Kiralama (Sublease)</h2><p style="margin:4px 0 0;font-size:13px;color:#64748b;">TFRS 16.B58 kapsamındaki alt kiralama işlemleri sözleşme bazında yönetiliyor.</p></div>
          <div class="gk-v26-card" style="margin-bottom:0;"><label style="font-size:11px;font-weight:700;color:#64748b;display:block;margin-bottom:6px;">Sözleşme (Ana Kira)</label>
            <select id="v26SubleaseContractSelect" style="width:100%;max-width:480px;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;">${list.length ? options(list, selectedSubleaseContractId) : '<option value="">Sözleşme bulunamadı</option>'}</select>
            ${selectedBanner(selected)}
          </div><div id="subleaseSectionContainer"></div>
        </div>`;
      container.querySelector("#v26SubleaseContractSelect")?.addEventListener("change", event => { selectedSubleaseContractId = event.target.value; render(); });
      if (selected) bridge().renderSubleaseSection?.(selected);
    };
    render();
  }

  function renderAccountingCenter(container) {
    if (!prepare(container)) return;
    const render = () => {
      const list = sortedContracts();
      if (!selectedAccountingContractId && list.length) selectedAccountingContractId = list[0].id;
      const selected = list.find(contract => contract.id === selectedAccountingContractId) || null;
      const body = !list.length ? `<div style="padding:24px 0;text-align:center;color:#94a3b8;font-size:13px;">Henüz sözleşme bulunmuyor. Önce Sözleşmeler ekranından bir sözleşme oluşturun.</div>` : !selected ? `<div style="padding:24px 0;text-align:center;color:#94a3b8;font-size:13px;">Yukarıdan bir sözleşme seçin.</div>` : (bridge().renderAccountingCenter?.(selected) || "");
      container.innerHTML = `
        <div class="gk-v26-page"><div style="margin-bottom:16px;"><h2 style="margin:0;font-size:20px;color:#0f172a;">Toplu Fiş Merkezi</h2><p style="margin:4px 0 0;font-size:13px;color:#64748b;">Tek sözleşme veya portföydeki tüm aktif sözleşmeler için muhasebe fişi üretimi burada yönetiliyor.</p></div>
          <div class="gk-v26-card"><label style="font-size:11px;font-weight:700;color:#64748b;display:block;margin-bottom:6px;">Sözleşme (tekil fiş için)</label>
            <select id="v26AccountingContractSelect" style="width:100%;max-width:480px;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;">${list.length ? options(list, selectedAccountingContractId) : '<option value="">Sözleşme bulunamadı</option>'}</select>
            ${selectedBanner(selected)}${body}
          </div></div>`;
      container.querySelector("#v26AccountingContractSelect")?.addEventListener("change", event => { selectedAccountingContractId = event.target.value; render(); });
      if (selected) {
        container.querySelector("#generateJournal")?.addEventListener("click", () => bridge().generateSelectedJournal?.(selected));
        container.querySelector("#openBulkJournalButton")?.addEventListener("click", () => bridge().openBulkJournalModal?.());
      }
    };
    render();
  }

  function renderModificationReassessment(container) {
    if (!container) return;
    const renderer = bridge().renderModificationReassessmentBody;
    if (typeof renderer === "function") return renderer(container);
    container.innerHTML = `<div class="gk-v26-card" style="color:#991b1b;">Modifikasyon ve reassessment işlem köprüsü hazır değil.</div>`;
  }

  global.LeaseQantTfrs16OperationsUi = { renderModificationReassessment, renderSaleAndLeaseback, renderSublease, renderAccountingCenter };
})(window);
