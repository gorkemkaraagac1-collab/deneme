/* LeaseQant TFRS16 — private-result operation page UI. */
(function (global) {
  "use strict";

  let selectedSlbContractId = null;
  let selectedSubleaseContractId = null;
  let selectedAccountingContractId = null;
  let selectedModReassContractId = null;

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
    if (!prepare(container)) return;

    const buildPendingApprovals = () => {
      const now = new Date();
      const modRows = bridge().getModificationReport?.(now)?.rows || [];
      const reassRows = bridge().getReassessmentReport?.(now)?.rows || [];
      const pendingMods = modRows.filter(row => row.status !== "APPLIED" && row.status !== "CANCELLED")
        .map(row => ({ kind: "MOD", contractId: row.contractId, company: row.company, id: row.modificationId, date: row.effectiveDate || row.modificationDate, reason: row.reason, oldPayment: row.oldPayment, newPayment: row.newPayment }));
      const pendingReass = reassRows.filter(row => row.status !== "APPLIED" && row.status !== "CANCELLED")
        .map(row => ({ kind: "REASS", contractId: row.contractId, company: row.company, id: row.reassessmentId, date: row.effectiveDate || row.reassessmentDate, reason: row.reason, oldPayment: row.oldPayment, newPayment: row.newPayment }));
      return [...pendingMods, ...pendingReass].sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
    };

    const pendingHtml = pending => {
      if (!pending.length) return "";
      const value = bridge().formatOperationValue || (v => String(v ?? ""));
      return `<div class="gk-v26-card" style="background:#fffbeb;border-color:#fde68a;margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px;"><h3 style="margin:0;font-size:15px;color:#92400e;">⏳ Onay Bekleyenler <span style="font-weight:400;color:#b45309;">(${pending.length} kayıt, tüm portföy)</span></h3><button type="button" class="secondary-button" id="v26PendingApprovalsApplyAll">Tümünü Uygula</button></div>
        <div style="overflow:auto;"><table class="gk-v26-table"><thead><tr><th>Tür</th><th>Sözleşme</th><th>Şirket</th><th>Tarih</th><th>Sebep</th><th>Ödeme (eski→yeni)</th><th></th></tr></thead><tbody>${pending.map(item => `<tr><td>${escapeHtml(item.kind === "MOD" ? "Modifikasyon" : "Reassessment")}</td><td><strong>${escapeHtml(item.contractId)}</strong></td><td>${escapeHtml(item.company || "")}</td><td>${escapeHtml(item.date || "")}</td><td style="max-width:280px;font-size:12px;color:#475569;">${escapeHtml(item.reason || "")}</td><td>${value(item.oldPayment)} → ${value(item.newPayment)}</td><td><button type="button" class="secondary-button" data-pending-approve data-pending-kind="${escapeHtml(item.kind)}" data-pending-contract="${escapeHtml(item.contractId)}" data-pending-id="${escapeHtml(item.id)}">Uygula</button></td></tr>`).join("")}</tbody></table></div>
      </div>`;
    };

    const applyPending = async (kind, contractId, id) => {
      const fn = kind === "MOD" ? bridge().applyModificationById : bridge().applyReassessmentById;
      if (typeof fn !== "function") return { valid: false, errors: ["Private işlem köprüsü hazır değil."] };
      return fn(contractId, id);
    };

    const render = () => {
      const list = sortedContracts();
      if (!selectedModReassContractId && list.length) selectedModReassContractId = list[0].id;
      const selected = list.find(contract => contract.id === selectedModReassContractId) || null;
      const optionsHtml = list.length ? options(list, selectedModReassContractId) : '<option value="">Sözleşme bulunamadı</option>';
      let body = "";
      if (!list.length) body = `<div class="gk-v26-card"><div style="padding:24px 0;text-align:center;color:#94a3b8;font-size:13px;">Henüz sözleşme bulunmuyor. Önce Sözleşmeler ekranından bir sözleşme oluşturun.</div></div>`;
      else if (!selected) body = `<div class="gk-v26-card"><div style="padding:24px 0;text-align:center;color:#94a3b8;font-size:13px;">Yukarıdan bir sözleşme seçin.</div></div>`;
      else {
        const renderMod = bridge().renderModificationManagementSection;
        const renderReass = bridge().renderReassessmentManagementSection;
        body = `${typeof renderMod === "function" ? renderMod(selected) : ""}${typeof renderReass === "function" ? renderReass(selected) : ""}`;
      }
      const pending = buildPendingApprovals();
      container.innerHTML = `<div class="gk-v26-page"><div style="margin-bottom:16px;"><h2 style="margin:0;font-size:20px;color:#0f172a;">Modifikasyon &amp; Reassessment</h2><p style="margin:4px 0 0;font-size:13px;color:#64748b;">Kira modifikasyonu ve reassessment işlemleri artık tek bir ekranda, sözleşme bazında yönetiliyor.</p></div>${pendingHtml(pending)}<div class="gk-v26-card" style="margin-bottom:0;"><label style="font-size:11px;font-weight:700;color:#64748b;display:block;margin-bottom:6px;">Sözleşme</label><select id="v26ModReassContractSelect" style="width:100%;max-width:480px;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;">${optionsHtml}</select>${selectedBanner(selected)}</div>${body}</div>`;

      container.querySelector("#v26ModReassContractSelect")?.addEventListener("change", event => { selectedModReassContractId = event.target.value; render(); });
      container.querySelectorAll("[data-pending-approve]").forEach(button => button.addEventListener("click", async () => {
        button.disabled = true;
        try {
          const result = await applyPending(button.dataset.pendingKind, button.dataset.pendingContract, button.dataset.pendingId);
          if (!result?.valid) { bridge().showAlert?.(`${button.dataset.pendingContract}: ${(result?.errors || ["İşlem başarısız."]).join(", ")}`, "error"); button.disabled = false; return; }
          bridge().refresh?.(); render();
        } catch (error) { bridge().showAlert?.(error?.message || String(error), "error"); button.disabled = false; }
      }));
      container.querySelector("#v26PendingApprovalsApplyAll")?.addEventListener("click", async () => {
        const button = container.querySelector("#v26PendingApprovalsApplyAll"); if (button) { button.disabled = true; button.textContent = "Uygulanıyor…"; }
        let success = 0; const failed = [];
        for (const item of buildPendingApprovals()) {
          try { const result = await applyPending(item.kind, item.contractId, item.id); if (result?.valid) success++; else failed.push(`${item.contractId}: ${(result?.errors || ["İşlem başarısız."]).join(", ")}`); }
          catch (error) { failed.push(`${item.contractId}: ${error?.message || String(error)}`); }
        }
        bridge().refresh?.(); bridge().showAlert?.(`${success} kayıt uygulandı${failed.length ? `, ${failed.length} kayıt başarısız: ${failed.slice(0, 3).join(" · ")}` : "."}`, failed.length ? "warning" : "success"); render();
      });
      if (selected) {
        bridge().initModificationEventsById?.(selected.id, render);
        bridge().initReassessmentEventsById?.(selected.id, render);
      }
    };
    render();
  }

  global.LeaseQantTfrs16OperationsUi = { renderModificationReassessment, renderSaleAndLeaseback, renderSublease, renderAccountingCenter };
})(window);
