/* LeaseQant TFRS16 — contract detail composition UI. */
(function (global) {
  "use strict";

  /**
   * Render the read-only shell of a contract detail modal.
   *
   * Calculation, persistence and event wiring remain in the private-gated
   * runtime. This module receives presentation callbacks from that runtime so
   * the large compatibility file no longer owns the modal's HTML composition.
   */
  function render(options = {}) {
    const contract = options.contract || {};
    const engine = options.engine || {};
    const calculationError = Boolean(options.calculationError);
    const calculationSource = options.calculationSource;
    const lockBannerCheck = options.lockBannerCheck || { locked: false };
    const initialJournalEntries = options.initialJournalEntries || [];
    const initialJournalCurrency = options.initialJournalCurrency || "TRY";
    const contractAuditEvents = options.contractAuditEvents || [];
    const call = (name, ...args) => typeof options[name] === "function"
      ? options[name](...args)
      : "";

    const v26StdHtml = typeof options.renderContractStandardsPanel === "function"
      ? options.renderContractStandardsPanel(contract)
      : (typeof options.v26StandardsBadgeHtml === "function"
        ? `<div style="margin-bottom:12px;">${options.v26StandardsBadgeHtml(contract)}</div>`
        : "");

    const reporting = global.LeaseQantTfrs16ReportingUi || {};
    const detailStatusHtml = reporting.renderContractDetailStatus?.({
      lockMessage: lockBannerCheck.locked ? lockBannerCheck.message : "",
      calculationSource,
      calculationError,
      isAdmin: Boolean(options.isAdmin)
    }) || "";

    const scheduleHtml = `${call("renderPaymentScheduleSection", contract)}${calculationError ? `
            <div style="margin-top:22px;border:1px solid #fed7aa;background:#fff7ed;border-radius:12px;padding:14px 16px;color:#9a3412;font-size:12px;">
              Ödeme planı ve ilk muhasebeleştirme fişi private hesaplama sonucu hazır olduğunda görüntülenecek.
            </div>
          ` : engine.exempt ? `
            <div style="margin-top:22px;border:1px solid #fde68a;background:#fffbeb;border-radius:12px;padding:14px;">
              <strong style="color:#92400e;">TFRS 16.5-8 Muafiyeti Uygulanıyor</strong>
              <p style="margin:6px 0 0;color:#78350f;font-size:12px;line-height:1.5;">
                Bu sözleşme kısa vadeli ve/veya düşük değerli varlık istisnası kapsamında işaretlenmiştir.
                Kullanım hakkı varlığı ve kiralama yükümlülüğü tanınmaz; ödemeler kira süresi boyunca
                genellikle doğrusal (straight-line) esasa göre gider olarak muhasebeleştirilir. Bu nedenle
                bir "ilk muhasebeleştirme fişi" üretilmez.
              </p>
            </div>
          ` : call("renderJournalEntry",
            "İlk Muhasebeleştirme Fişi",
            initialJournalEntries,
            initialJournalCurrency
          )}`;

    const detailPanelsHtml = reporting.renderContractDetailPanels?.({
      summaryHtml: reporting.renderContractSummaryTab?.(contract, engine, { calculationError }) || "",
      scheduleHtml,
      modificationHtml: `${call("renderModificationManagementSection", contract)}${call("renderReassessmentManagementSection", contract)}`,
      slbHtml: "",
      subleaseHtml: "",
      accountingHtml: call("renderAccountingCenter", contract),
      auditHtml: call("renderContractAuditTab", contract, contractAuditEvents)
    }) || "";

    return `
        ${v26StdHtml}
        ${detailStatusHtml}

        ${reporting.renderContractDetailTabs?.() || ""}
        ${detailPanelsHtml}
      `;
  }

  global.LeaseQantTfrs16DetailUi = { render };
})(window);
