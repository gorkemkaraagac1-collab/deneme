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
  function formatCurrency(value) {
    const fn = bridge().formatCurrency;
    return typeof fn === "function" ? fn(value) : String(value ?? "");
  }

  // Payment schedule presentation shells live here so the public engine
  // remains a calculation/bridge layer. These functions are intentionally
  // read-only markup helpers; data and actions stay behind bridge methods.
  function renderPaymentScheduleHeader() {
    return `        <div>

          <div
            style="
              font-size:10px;
              color:#64748b;
              font-weight:800;
              letter-spacing:1px;
            "
          >
            ÖDEME PLANI
          </div>

          <h3
            style="
              margin:5px 0 0;
              font-size:18px;
            "
          >
            Kira Ödeme Planı
          </h3>

          <p
            style="
              margin:5px 0 0;
              color:#64748b;
              font-size:11px;
            "
          >
            Her dönem için açılış/kapanış yükümlülüğü, faiz, anapara, amortisman ve ROU net defter değeri.
          </p>

        </div>
`;
  }

  /**
   * renderPaymentScheduleFilters — ödeme planı filtre kontrolleri.
   * Yalnızca HTML kabuğunu üretir; seçeneklerin sözleşme tarihleri ve para
   * birimleri engine köprüsünden okunur, hesaplama verisi burada tutulmaz.
   */
  function renderPaymentScheduleFilters(contract) {
    const yearOptions = bridge().buildPaymentScheduleYearOptions;
    const monthOptions = bridge().buildPaymentScheduleMonthOptions;
    const currencyOptions = bridge().buildPaymentScheduleCurrencyOptions;
    const reportingDate = bridge().getScheduleReportingDate;
    const selectedCurrency = String(contract?.currency || "TRY").toUpperCase();
    const today = new Date();
    const fallbackDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    return `        <div
          style="
            display:grid;
            grid-template-columns:
              repeat(auto-fit,minmax(150px,1fr));
            gap:12px;
            margin-top:16px;
          "
        >

          <div
            style="
              background:#f8fafc;
              border:1px solid #e5e7eb;
              border-radius:10px;
              padding:12px;
            "
          >
            <label
              style="
                display:block;
                font-size:10px;
                color:#64748b;
                margin-bottom:6px;
              "
            >
              Periyot
            </label>

            <select
              id="schedulePeriodType"
              style="
                width:100%;
                padding:8px;
                border:1px solid #d1d5db;
                border-radius:7px;
              "
            >
              <option value="all">Tümü</option>
              <option value="monthly">Aylık</option>
              <option value="quarterly">Çeyreklik</option>
              <option value="annual">Yıllık</option>
            </select>
          </div>

          <div
            style="
              background:#f8fafc;
              border:1px solid #e5e7eb;
              border-radius:10px;
              padding:12px;
            "
          >
            <label
              style="
                display:block;
                font-size:10px;
                color:#64748b;
                margin-bottom:6px;
              "
            >
              Yıl
            </label>

            <select
              id="scheduleYear"
              style="
                width:100%;
                padding:8px;
                border:1px solid #d1d5db;
                border-radius:7px;
              "
            >
              ${typeof yearOptions === "function" ? yearOptions(contract) : ""}
            </select>
          </div>

          <div
            style="
              background:#f8fafc;
              border:1px solid #e5e7eb;
              border-radius:10px;
              padding:12px;
            "
          >
            <label
              style="
                display:block;
                font-size:10px;
                color:#64748b;
                margin-bottom:6px;
              "
            >
              Ay / Çeyrek
            </label>

            <select
              id="scheduleSubPeriod"
              disabled
              style="
                width:100%;
                padding:8px;
                border:1px solid #d1d5db;
                border-radius:7px;
                opacity:.5;
              "
            >
              ${typeof monthOptions === "function" ? monthOptions() : ""}
            </select>
          </div>

          <div style="display:flex;align-items:end;">
            <label style="width:100%;font-size:11px;color:#64748b;font-weight:600;">
              Raporlama Tarihi
              <input id="scheduleReportingDate" type="date" value="${typeof reportingDate === "function" ? reportingDate() : fallbackDate}" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:7px;">
            </label>
          </div>
          <div style="display:flex;align-items:end;">
            <label style="width:100%;font-size:11px;color:#64748b;font-weight:600;">
              Sunum Para Birimi
              <select id="schedulePresentationCurrency" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:7px;">
                ${typeof currencyOptions === "function" ? currencyOptions(selectedCurrency) : ""}
              </select>
            </label>
          </div>
          <div
            style="display:flex;align-items:end;"
          >
            <button
              id="exportScheduleButton"
              type="button"
              class="primary-button"
              style="
                width:100%;
                min-height:38px;
              "
            >
              Excel'e Aktar
            </button>
          </div>

        </div>
`;
  }

  function renderPaymentScheduleTableShell() {
    return `        <div
          style="
            overflow:auto;
            margin-top:16px;
            border:1px solid #e5e7eb;
            border-radius:10px;
          "
        >
          <table
            style="
              width:100%;
              border-collapse:collapse;
              min-width:820px;
            "
          >
            <thead>
              <tr style="background:#f8fafc;">
                <th style="padding:9px;text-align:left;font-size:11px;">Dönem</th>
                <th style="padding:9px;text-align:left;font-size:11px;">Tarih</th>
                <th style="padding:9px;text-align:right;font-size:11px;">Açılış Yükümlülüğü</th>
                <th style="padding:9px;text-align:right;font-size:11px;">Ödeme</th>
                <th style="padding:9px;text-align:right;font-size:11px;">Faiz</th>
                <th style="padding:9px;text-align:right;font-size:11px;">Anapara</th>
                <th style="padding:9px;text-align:right;font-size:11px;">Kapanış Yükümlülüğü</th>
                <th style="padding:9px;text-align:right;font-size:11px;">Amortisman</th>
                <th style="padding:9px;text-align:right;font-size:11px;">ROU Net Defter Değeri</th>
              </tr>
            </thead>
            <tbody id="scheduleTableBody"></tbody>
          </table>
        </div>
`;
  }

  function renderPaymentScheduleFooterContainers() {
    return `        <div
          id="scheduleEmptyState"
          style="
            display:none;
            padding:14px;
            text-align:center;
            color:#64748b;
            font-size:12px;
          "
        >
          Seçilen dönem için ödeme planı kaydı bulunmuyor.
        </div>

        <div id="fxTranslationContainer"></div>

        <div id="inflationAdjustmentContainer"></div>

        <!-- SLB & Sublease BURADAN KALDIRILDI (onaylı plan, Modifikasyon
             & Reassessment ile aynı desen): artık ayrı "Satış ve Geri
             Kiralama" ve "Alt Kiralama" sayfalarında, sözleşme seçici
             ile yönetiliyor. Bkz. renderSlbManagementPage /
             renderSubleaseManagementPage ve dashboard.html'deki linkler. -->
`;
  }

  /**
   * renderPaymentScheduleRows — ödeme planı satırlarının salt sunum HTML'i.
   * Satırlar private sonuç zarfından gelir; biçimlendiriciler açık engine
   * köprüsü üzerinden çağrılır, burada hesaplama yapılmaz.
   */
  function renderPaymentScheduleRows(rows, presentationCurrency, basePayment = 0) {
    const formatMoney = bridge().formatScheduleMoney;
    const monthName = bridge().getMonthName;
    if (typeof formatMoney !== "function" || typeof monthName !== "function") return "";
    return (Array.isArray(rows) ? rows : []).map((item, i) => {
      const prevPayment = i > 0 ? rows[i - 1].payment : basePayment;
      const escalationBadge =
        basePayment > 0 && Math.abs(item.payment - prevPayment) > 0.01
          ? ` <span title="Endeksli/artışlı ödeme" style="color:#d97706;">🔺</span>`
          : "";
      return `
        <tr>
          <td style="padding:8px;border-top:1px solid #edf0f4;font-size:12px;">${item.period}</td>
          <td style="padding:8px;border-top:1px solid #edf0f4;font-size:12px;">${monthName(item.month)} ${item.year}</td>
          <td style="padding:8px;border-top:1px solid #edf0f4;text-align:right;font-size:12px;">${formatMoney(item, "openingLiability", presentationCurrency)}</td>
          <td style="padding:8px;border-top:1px solid #edf0f4;text-align:right;font-size:12px;">${formatMoney(item, "payment", presentationCurrency)}${escalationBadge}</td>
          <td style="padding:8px;border-top:1px solid #edf0f4;text-align:right;font-size:12px;">${formatMoney(item, "interest", presentationCurrency)}</td>
          <td style="padding:8px;border-top:1px solid #edf0f4;text-align:right;font-size:12px;">${formatMoney(item, "principal", presentationCurrency)}</td>
          <td style="padding:8px;border-top:1px solid #edf0f4;text-align:right;font-size:12px;">${formatMoney(item, "closingLiability", presentationCurrency)}</td>
          <td style="padding:8px;border-top:1px solid #edf0f4;text-align:right;font-size:12px;">${formatMoney(item, "depreciation", presentationCurrency)}</td>
          <td style="padding:8px;border-top:1px solid #edf0f4;text-align:right;font-size:12px;">${formatMoney(item, "rouClosing", presentationCurrency)}</td>
        </tr>
      `;
    }).join("");
  }

  /**
   * Bind payment-plan controls without moving calculation or private-result
   * logic into the public UI module. The engine supplies the callbacks that
   * perform those operations; this module owns only DOM wiring and the
   * initial render sequence.
   */
  function bindPaymentScheduleEvents(contract, handlers = {}) {
    const {
      updateSubPeriod,
      renderTable,
      renderFxTranslation,
      renderInflation,
      exportSchedule
    } = handlers;

    updateSubPeriod?.();
    renderTable?.(contract);
    renderFxTranslation?.(contract);
    renderInflation?.(contract);

    document.getElementById("schedulePeriodType")?.addEventListener("change", () => {
      updateSubPeriod?.();
      renderTable?.(contract);
    });
    document.getElementById("scheduleYear")?.addEventListener("change", () => {
      renderTable?.(contract);
    });
    document.getElementById("scheduleSubPeriod")?.addEventListener("change", () => {
      renderTable?.(contract);
    });
    document.getElementById("scheduleReportingDate")?.addEventListener("change", () => {
      renderTable?.(contract);
      renderFxTranslation?.(contract);
    });
    document.getElementById("schedulePresentationCurrency")?.addEventListener("change", () => {
      renderTable?.(contract);
    });
    document.getElementById("exportScheduleButton")?.addEventListener("click", () => {
      exportSchedule?.(contract);
    });
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

  function renderSlbJournalHtml(entries) {
    const rows = entries.map(e => `
      <tr>
        <td style="padding:6px;border-top:1px solid #edf0f4;font-size:11px;">${escapeHtml(e.account)}</td>
        <td style="padding:6px;border-top:1px solid #edf0f4;text-align:right;font-size:11px;">${e.debit ? formatCurrency(e.debit) : ""}</td>
        <td style="padding:6px;border-top:1px solid #edf0f4;text-align:right;font-size:11px;">${e.credit ? formatCurrency(e.credit) : ""}</td>
      </tr>
    `).join("");
    return `
      <div style="margin-top:12px;">
        <div style="font-size:10px;color:#64748b;font-weight:700;">BAŞLANGIÇ FİŞİ</div>
        <table style="width:100%;border-collapse:collapse;margin-top:6px;">
          <thead><tr style="background:#f1f5f9;"><th style="padding:6px;text-align:left;font-size:10px;">Hesap</th><th style="padding:6px;text-align:right;font-size:10px;">Borç</th><th style="padding:6px;text-align:right;font-size:10px;">Alacak</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  function renderSlbResultHtml(result) {
    if (!result.qualifiesAsSale) {
      const rows = result.schedule.map(row => `
        <tr>
          <td style="padding:6px;border-top:1px solid #edf0f4;font-size:11px;">${row.period}</td>
          <td style="padding:6px;border-top:1px solid #edf0f4;font-size:11px;">${row.date}</td>
          <td style="padding:6px;border-top:1px solid #edf0f4;text-align:right;font-size:11px;">${formatCurrency(row.openingBalance)}</td>
          <td style="padding:6px;border-top:1px solid #edf0f4;text-align:right;font-size:11px;">${formatCurrency(row.interest)}</td>
          <td style="padding:6px;border-top:1px solid #edf0f4;text-align:right;font-size:11px;">${formatCurrency(row.payment)}</td>
          <td style="padding:6px;border-top:1px solid #edf0f4;text-align:right;font-size:11px;">${formatCurrency(row.closingBalance)}</td>
        </tr>
      `).join("");
      return `
        <div style="padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
          <strong style="font-size:12px;">TFRS 16.103 — Finansman Düzenlemesi</strong>
          <p style="margin:6px 0;color:#64748b;font-size:11px;">${result.note}</p>
          ${result.residualBalanceWarning ? `<div style="margin:8px 0;padding:8px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;color:#92400e;font-size:11px;">${escapeHtml(result.residualBalanceWarning)}</div>` : ""}
          <div style="margin-top:10px;overflow:auto;">
            <table style="width:100%;border-collapse:collapse;min-width:560px;">
              <thead><tr style="background:#f1f5f9;">
                <th style="padding:6px;text-align:left;font-size:10px;">Dönem</th><th style="padding:6px;text-align:left;font-size:10px;">Tarih</th>
                <th style="padding:6px;text-align:right;font-size:10px;">Açılış</th><th style="padding:6px;text-align:right;font-size:10px;">Faiz</th>
                <th style="padding:6px;text-align:right;font-size:10px;">Ödeme</th><th style="padding:6px;text-align:right;font-size:10px;">Kapanış</th>
              </tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
          ${renderSlbJournalHtml(result.inceptionJournal)}
        </div>
      `;
    }

    return `
      <div style="padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
        <strong style="font-size:12px;">TFRS 16.100-102 — Satış ve Geri Kiralama</strong>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:10px;font-size:11px;">
          <div>Toplam Kâr/Zarar<br><strong>${formatCurrency(result.totalGainLoss)}</strong></div>
          <div>Tanınan Kâr/Zarar<br><strong style="color:${result.gainLossRecognized < 0 ? '#dc2626' : '#16a34a'};">${formatCurrency(result.gainLossRecognized)}</strong></div>
          <div>ROU'ya Gömülü (Tanınmayan)<br><strong>${formatCurrency(result.gainLossOnRightsRetained)}</strong></div>
          <div>Düzeltilmiş Kira Yükümlülüğü<br><strong>${formatCurrency(result.adjustedLeaseLiability)}</strong></div>
          <div>Elde Tutulan ROU<br><strong>${formatCurrency(result.rouRetained)}</strong></div>
          <div>${result.excessFinancing > 0 ? "İlave Finansman" : result.prepayment > 0 ? "Peşin Ödeme" : "Off-market Fark"}<br><strong>${formatCurrency(result.excessFinancing || result.prepayment || 0)}</strong></div>
        </div>
        ${renderSlbJournalHtml(result.inceptionJournal)}
      </div>
    `;
  }

  function renderSubleaseResultHtml(result) {
    if (result.classification === "OPERATING") {
      const rows = result.schedule.slice(0, 12).map(row => `
        <tr>
          <td style="padding:6px;border-top:1px solid #edf0f4;font-size:11px;">${row.period}</td>
          <td style="padding:6px;border-top:1px solid #edf0f4;text-align:right;font-size:11px;">${formatCurrency(row.cashReceived)}</td>
          <td style="padding:6px;border-top:1px solid #edf0f4;text-align:right;font-size:11px;">${formatCurrency(row.incomeRecognized)}</td>
          <td style="padding:6px;border-top:1px solid #edf0f4;text-align:right;font-size:11px;">${formatCurrency(row.deferredIncomeBalance)}</td>
        </tr>
      `).join("");
      return `
        <div style="padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
          <strong style="font-size:12px;">TFRS 16.B58 — Operating Alt Kiralama</strong>
          <p style="margin:6px 0;color:#64748b;font-size:11px;">${result.note}</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;font-size:11px;">
            <div>Toplam Sözleşme Geliri<br><strong>${formatCurrency(result.totalContractualIncome)}</strong></div>
            <div>Doğrusal Aylık Gelir<br><strong>${formatCurrency(result.straightLineMonthlyIncome)}</strong></div>
          </div>
          <div style="margin-top:10px;overflow:auto;">
            <table style="width:100%;border-collapse:collapse;min-width:420px;">
              <thead><tr style="background:#f1f5f9;">
                <th style="padding:6px;text-align:left;font-size:10px;">Dönem</th><th style="padding:6px;text-align:right;font-size:10px;">Tahsilat</th>
                <th style="padding:6px;text-align:right;font-size:10px;">Tanınan Gelir</th><th style="padding:6px;text-align:right;font-size:10px;">Ertelenmiş Gelir Bakiyesi</th>
              </tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
          <p style="margin-top:8px;color:#94a3b8;font-size:10px;">${result.periodicJournalNote}</p>
        </div>
      `;
    }

    return `
      <div style="padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
        <strong style="font-size:12px;">TFRS 16.B58 — Finance Alt Kiralama</strong>
        <p style="margin:6px 0;color:#64748b;font-size:11px;">${result.note}</p>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:8px;font-size:11px;">
          <div>Ana Kira ROU (Tahsis Öncesi)<br><strong>${formatCurrency(result.headLeaseRouCarryingAmount)}</strong></div>
          <div>Devredilen ROU (Tahsis: %${(result.rouAllocationRatio*100).toFixed(0)})<br><strong>${formatCurrency(result.allocatedRouCarryingAmount)}</strong></div>
          <div>Net Yatırım (Alt Kiralama PV)<br><strong>${formatCurrency(result.netInvestment)}</strong></div>
          <div>Satış Kâr/Zararı<br><strong style="color:${result.sellingProfitLoss < 0 ? '#dc2626' : '#16a34a'};">${formatCurrency(result.sellingProfitLoss)}</strong></div>
        </div>
        ${renderSlbJournalHtml(result.inceptionJournal)}
      </div>
    `;
  }

  global.LeaseQantTfrs16OperationsUi = { renderModificationReassessment, renderSaleAndLeaseback, renderSublease, renderAccountingCenter, renderSlbResultHtml, renderSlbJournalHtml, renderSubleaseResultHtml, renderPaymentScheduleHeader, renderPaymentScheduleFilters, renderPaymentScheduleTableShell, renderPaymentScheduleFooterContainers, renderPaymentScheduleRows, bindPaymentScheduleEvents };
})(window);
