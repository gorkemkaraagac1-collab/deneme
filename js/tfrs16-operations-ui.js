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

  // Special-flow dates can arrive as date-only strings or plain calendar
  // objects after the private API serializes them. Normalize both forms so
  // the table never exposes a raw "[object Object]" value to users.
  function formatOperationDate(value) {
    const formatter = bridge().formatDate;
    const format = candidate => typeof formatter === "function"
      ? formatter(candidate)
      : String(candidate ?? "-");
    if (value instanceof Date || typeof value === "string" || typeof value === "number") {
      return format(value);
    }
    if (value && typeof value === "object") {
      const nested = value.$date || value.iso || value.value
        || (typeof value.date === "string" ? value.date : null);
      if (nested && nested !== value) return formatOperationDate(nested);
      const year = Number(value.year ?? value.fullYear);
      const monthIndex = Number(value.monthIndex);
      const month = Number(value.month);
      const day = Number(value.day ?? value.date);
      if (Number.isInteger(year) && Number.isInteger(day)
        && (Number.isInteger(monthIndex) || Number.isInteger(month))) {
        const calendarMonth = Number.isInteger(monthIndex) ? monthIndex : month - 1;
        return format(new Date(year, calendarMonth, day));
      }
    }
    return format(value);
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
   * renderPaymentScheduleSection — ödeme planı bölümünün salt sunum
   * kompozisyonu. Hesaplama, filtreleme ve veri yükleme motor köprüsünde
   * kalır; bu modül yalnızca bölümün HTML kabuğunu bir araya getirir.
   */
  function renderPaymentScheduleSection(contract) {
    const header = renderPaymentScheduleHeader();
    const filters = renderPaymentScheduleFilters(contract);
    const table = renderPaymentScheduleTableShell();
    const footer = renderPaymentScheduleFooterContainers();
    return `

      <div
        style="
          margin-top:28px;
          border-top:1px solid #e5e7eb;
          padding-top:24px;
        "
      >

${header}

${filters}

<p id="scheduleFxStatus" role="status" style="color:#64748b;font-size:12px;"></p>
${table}
${footer}
      </div>

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
   * Render the payment-plan body and its status containers.  The engine
   * supplies already-rendered row HTML and status text; this module owns the
   * remaining DOM writes for the table's empty/private/FX states.
   */
  function renderPaymentScheduleState({ rowsHtml = "", fxMessage = "", hasRows = false, emptyMessage = null } = {}) {
    const tbody = document.getElementById("scheduleTableBody");
    if (!tbody) return false;
    tbody.innerHTML = rowsHtml;

    const empty = document.getElementById("scheduleEmptyState");
    if (empty) {
      if (emptyMessage) {
        empty.textContent = emptyMessage;
        empty.style.display = "block";
      } else {
        empty.style.display = hasRows ? "none" : "block";
      }
    }

    const fxStatus = document.getElementById("scheduleFxStatus");
    if (fxStatus) fxStatus.textContent = fxMessage || "";
    return true;
  }

  /**
   * Export the already-prepared payment-plan rows. Calculation, FX conversion
   * and audit recording stay in the engine bridge; this module owns only the
   * workbook/CSV presentation and browser download.
   */
  function exportPaymentScheduleFile({ contractId, presentationCurrency, assumptionRows = [], scheduleRows = [], fxRows = [] } = {}) {
    if (!Array.isArray(scheduleRows) || !scheduleRows.length) return false;
    const safeId = String(contractId || "CONTRACT");
    const currency = String(presentationCurrency || "TRY").toUpperCase();

    if (typeof XLSX !== "undefined") {
      try {
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(assumptionRows), "Varsayimlar");
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(scheduleRows), "Odeme Plani");
        if (Array.isArray(fxRows) && fxRows.length) {
          XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(fxRows), "Kur_Cevrimi_TMS21");
        }
        XLSX.writeFile(workbook, `${safeId}_Odeme_Plani_${currency}.xlsx`);
        return true;
      } catch (error) {
        console.error("Payment schedule export error:", error);
      }
    }

    const headers = Object.keys(scheduleRows[0]);
    const csv = [headers.join(";"), ...scheduleRows.map(row => headers.map(header => row[header]).join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeId}_Odeme_Plani_${currency}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return true;
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
      // exportSchedule (exportPaymentSchedule) async'tir ve private sonuç
      // hazır değilse reject eder; burada yakalanmazsa unhandled promise
      // rejection olur (gerçek tarayıcıda sessizce yutulur — kullanıcı
      // hiçbir şey görmez). DÜZELTME (2026-09-16, ikinci kez — bu satır
      // PR #357'de dosya yeniden üretilirken bir önceki düzeltmemle
      // birlikte kaybolmuş): try/catch/.catch() ile geri eklendi.
      Promise.resolve(exportSchedule?.(contract)).catch((error) => {
        const alertFn = bridge().showAlert;
        const message = "Ödeme planı dışa aktarılamadı: " + (error?.message || String(error));
        if (typeof alertFn === "function") alertFn(message);
        else window.alert?.(message);
      });
    });
  }

  /**
   * bindSlbEvents / bindSubleaseEvents — "Hesapla ve Kaydet" butonuna
   * tıklama olayını bağlar ve daha önce kaydedilmiş bir sonuç varsa
   * sayfa açılışında otomatik yeniden hesaplar. Asıl hesapla/kaydet/
   * geri-al mantığı (`calculateAndRender` — private API çağrısı,
   * backend'e yazma, hata durumunda rollback) hâlâ engine.js'te yaşıyor
   * ve buraya bir callback olarak geçiriliyor — bindPaymentScheduleEvents
   * ile BİREBİR aynı desen (2026-09-16, UI orchestration ayrıştırması).
   */
  function bindSlbEvents(contract, handlers = {}) {
    const { calculateAndRender, autoRun } = handlers;
    document.getElementById("slbCalculateButton")?.addEventListener("click", () => {
      calculateAndRender?.(true);
    });
    if (autoRun) calculateAndRender?.(false);
  }

  function bindSlbPreviewFlow(handlers, prefix = "slb") {
    const form = document.querySelector(`[data-lq-operation-form="${prefix === "slb" ? "sale-and-leaseback" : "sublease"}"]`);
    const calculate = document.getElementById(prefix + "CalculateButton");
    const save = document.getElementById(prefix + "SaveButton");
    const resultBox = document.getElementById(prefix + "ResultContainer");
    if (!form || !calculate || !save || !resultBox) return;
    let sequence = 0, accepted = null, saving = false;
    const fingerprint = input => JSON.stringify(input);
    const connected = () => form.isConnected && resultBox.isConnected;
    function showFailure(error, action) {
      const messages = {
        OPERATION_SALE_ASSESSMENT_REQUIRED: "Sözleşmede onaylı TFRS 15 satış değerlendirmesi bulunmuyor.",
        OPERATION_SALE_ASSESSMENT_REFERENCE_REQUIRED: "TFRS 15 satış değerlendirmesi referansını girin.",
        OPERATION_LEASEBACK_PV_EVIDENCE_REQUIRED: "Satış sayılıyorsa geri kiralama bugünkü değerini ve kanıt referansını girin.",
        OPERATION_SALE_ASSESSMENT_CONFLICT: "Satış seçimi sözleşmedeki onaylı değerlendirmeyle eşleşmiyor.",
        IDENTIFICATION_MODE_REQUIRED: "Sözleşmenin kiralama değerlendirme yöntemi ve onaylı kaynağı gerekli.",
        EVIDENCE_REQUIRED: "Bu işlem için onaylı değerlendirme kaynağı gerekli.",
        LEASEBACK_PV_REQUIRED: "Satış işlemi için onaylı geri kiralama bugünkü değer kaynağı gerekli.",
        OPERATION_PREVIEW_STALE: "Sözleşme değişti. Sunucu önizlemesini yeniden alın.",
        OPERATION_PREVIEW_EXPIRED_OR_INVALID: "Önizlemenin süresi doldu veya doğrulanamadı. Yeniden önizleme alın.",
        OPERATION_SOURCE_UNAVAILABLE: "Sunucu kaynağı yüklenemedi. Tekrar deneyin.",
        PERIOD_CLOSED: "Bu dönem kapalı. Form kaydedilemez.",
        OPERATION_WRITE_ROLE_DENIED: "Bu işlem için kayıt yetkiniz bulunmuyor."
      };
      resultBox.replaceChildren();
      const message = document.createElement("p");
      message.textContent = messages[error?.code] || `${action} tamamlanamadı. Yeniden önizleme alın.`;
      const details = document.createElement("details"), summary = document.createElement("summary"), code = document.createElement("code");
      summary.textContent = "Teknik ayrıntı"; code.textContent = error?.code || "OPERATION_REQUEST_FAILED";
      details.append(summary, code); resultBox.append(message, details);
    }
    function invalidate() {
      sequence += 1;
      accepted = null;
      save.disabled = true;
      calculate.disabled = false;
      resultBox.textContent = "Girdiler değişti. Sunucu önizlemesini yeniden alın.";
    }
    form.addEventListener("input", invalidate);
    form.addEventListener("change", invalidate);
    const unsubscribe = window.LeaseQantReportingPeriod?.subscribe?.(() => { if (connected()) invalidate(); else unsubscribe?.(); });
    calculate.addEventListener("click", async () => {
      if (saving) return;
      const request = ++sequence;
      accepted = null;
      save.disabled = true;
      calculate.disabled = true;
      resultBox.textContent = "Sunucu önizlemesi yükleniyor…";
      try {
        const input = JSON.parse(fingerprint(handlers.readInput()));
        const key = fingerprint(input);
        const result = await handlers.preview(input);
        if (!connected() || request !== sequence) return;
        if (key !== fingerprint(handlers.readInput())) { invalidate(); return; }
        if (!result) throw new Error("Sunucu önizlemesi alınamadı.");
        resultBox.innerHTML = handlers.render(result);
        const canSave = handlers.canSave ? handlers.canSave(result) : true;
        accepted = canSave ? { input, key, result } : null;
        save.disabled = !canSave;
      } catch (error) {
        if (connected() && request === sequence) showFailure(error, "Önizleme");
      } finally {
        if (connected() && request === sequence) calculate.disabled = false;
      }
    });
    save.addEventListener("click", async () => {
      if (saving || !accepted || !connected()) return;
      if (accepted.key !== fingerprint(handlers.readInput())) { invalidate(); return; }
      const { input, result } = accepted;
      saving = true;
      accepted = null;
      const controls = Array.from(form.querySelectorAll("input, select, textarea, button"));
      const states = controls.map(control => control.disabled);
      controls.forEach(control => { control.disabled = true; });
      try {
        await handlers.save(input, result);
        if (connected()) resultBox.textContent = "Form kaydedildi. Bu işlem muhasebe olayı uygulama veya defter kaydı onayı değildir.";
      } catch (error) {
        if (connected()) showFailure(error, "Kayıt");
      } finally {
        saving = false;
        controls.forEach((control, index) => { control.disabled = states[index]; });
        save.disabled = true;
        calculate.disabled = false;
      }
    });
    // The caller releases the subscription when a form is replaced. Local
    // input identity still rejects silent scope/period changes before save.
    return () => { sequence += 1; accepted = null; unsubscribe?.(); };
  }

  function bindSubleaseEvents(contract, handlers = {}) {
    const { calculateAndRender, autoRun } = handlers;
    document.getElementById("subleaseCalculateButton")?.addEventListener("click", () => {
      calculateAndRender?.(true);
    });
    if (autoRun) calculateAndRender?.(false);
  }

  /**
   * bindModificationEvents / bindReassessmentEvents — "Oluştur/Güncelle"
   * form gönderimini ve satır bazlı [data-mod-action]/[data-reass-action]
   * (edit/apply/cancel) butonlarını bağlar. Asıl form-gönder/apply/cancel
   * mantığı (private API çağrısı, kayıt) engine.js'de kalır — aynı
   * bindSlbEvents deseni (2026-09-16).
   */
  function bindModificationEvents(contract, handlers = {}) {
    const { submitForm, handleAction } = handlers;
    document.getElementById("createModificationButton")?.addEventListener("click", () => { submitForm?.(); });
    document.querySelectorAll("[data-mod-action]").forEach(button => {
      button.addEventListener("click", () => handleAction?.(button.dataset.modAction, button.dataset.modId, button));
    });
  }

  function bindReassessmentEvents(contract, handlers = {}) {
    const { submitForm, handleAction } = handlers;
    document.getElementById("createReassessmentButton")?.addEventListener("click", () => { submitForm?.(); });
    document.querySelectorAll("[data-reass-action]").forEach(button => {
      button.addEventListener("click", () => handleAction?.(button.dataset.reassAction, button.dataset.reassId, button));
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
  function isUiV2() {
    return document.documentElement?.getAttribute("data-lq-ui") === "2";
  }
  function operationPageHeader(title, subtitle) {
    return `<header class="lq-pg-head"><div><h1 class="lq-pg-h1">${escapeHtml(title)}</h1><div class="lq-pg-sub">${escapeHtml(subtitle)}</div></div></header>`;
  }
  function operationContractSummary(contract) {
    if (!contract) return `<p class="lq-op-empty">Sözleşme seçildiğinde özet burada gösterilir.</p>`;
    const facts = [
      ["Sözleşme", contract.id], ["Şirket", contract.company], ["Kiraya veren", contract.supplier],
      ["Dönem", contract.startDate || contract.endDate ? `${formatOperationDate(contract.startDate)} – ${formatOperationDate(contract.endDate)}` : null]
    ].filter(([, value]) => value != null && String(value).trim() !== "");
    return `<dl class="lq-op-summary-list">${facts.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("") || `<div><dt>Sözleşme</dt><dd>Özet kaynağı gerekli</dd></div>`}</dl>`;
  }
  function operationSourceState(message = "Kaynak gerekli") {
    return `<div class="lq-op-source-state" role="status"><span class="lq-pg-need">${escapeHtml(message)}</span><p>Ölçüm ve finansal etki yalnızca doğrulanmış sunucu paketi geldiğinde gösterilir.</p></div>`;
  }
  function operationImpactPanel(contract, title, description, resultMountId = "", contentHtml = "") {
    const content = contentHtml || operationSourceState();
    return `<aside class="lq-op-side"><section class="lq-pg-card lq-op-side-card"><span class="lq-pg-kick">SÖZLEŞME ÖZETİ</span><h2 class="lq-op-side-title">${escapeHtml(title)}</h2>${operationContractSummary(contract)}</section><section class="lq-pg-card lq-op-side-card"><span class="lq-pg-kick">ETKİ ÖNİZLEMESİ</span><h2 class="lq-op-side-title">İşlem etkisi</h2><p class="lq-op-side-copy">${escapeHtml(description)}</p>${resultMountId ? `<div id="${escapeHtml(resultMountId)}">${content}</div>` : content}</section></aside>`;
  }
  // The latest draft change carries the server's measurement (the preview
  // runs on the private engine when the draft is created or updated).
  function changeImpactHtml(contract) {
    const drafts = [
      ...(contract?.modifications || []).map(e => ({ e, label: "Modifikasyon" })),
      ...(contract?.reassessments || []).map(e => ({ e, label: "Yeniden değerlendirme" }))
    ].filter(({ e }) => String(e?.status || "").toUpperCase() === "DRAFT")
      .sort((a, b) => String(b.e.updatedAt || b.e.createdAt || "").localeCompare(String(a.e.updatedAt || a.e.createdAt || "")));
    const latest = drafts[0];
    if (!latest) return operationSourceState("Taslak oluşturulunca gösterilir");
    const e = latest.e, ccy = escapeHtml(contract.currency || "");
    const fmt = v => Number.isFinite(Number(v)) ? Number(v).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";
    const rows = [["Eski yükümlülük", e.oldLeaseLiability], ["Yeni yükümlülük", e.revisedLeaseLiability],
      ["Yükümlülük düzeltmesi", e.liabilityAdjustment], ["KHV düzeltmesi", e.rouAdjustment],
      ...(Number(e.gainLoss) ? [["Kazanç / kayıp", e.gainLoss]] : [])];
    return `<p class="lq-op-side-copy"><strong>${escapeHtml(latest.label)} taslağı</strong> · yürürlük ${escapeHtml(formatOperationDate(e.effectiveDate))}</p><dl class="lq-op-summary-list">${rows.map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${fmt(v)} ${ccy}</dd></div>`).join("")}</dl>`;
  }
  function enhanceChangeFlow(container) {
    if (!isUiV2()) return;
    const flows = [
      {
        key: "modification",
        formId: "modificationDate",
        submitId: "createModificationButton",
        titleId: "lqModificationFlowTitle",
        labels: [
          { title: "Değişikliği tanımla", ids: ["modificationDate", "modificationEffectiveDate", "modificationType", "modificationReason"] },
          { title: "Yeni şartları gir", ids: ["modificationNewPayment", "modificationNewEndDate", "modificationNewDiscountRate", "modificationScopeReduction", "modificationScopeIncrease"] }
        ]
      },
      {
        key: "reassessment",
        formId: "reassessmentDate",
        submitId: "createReassessmentButton",
        titleId: "lqReassessmentFlowTitle",
        labels: [
          { title: "Değişikliği tanımla", ids: ["reassessmentDate", "reassessmentEffectiveDate", "reassessmentType", "reassessmentReason"] },
          { title: "Yeni şartları gir", ids: ["reassessmentNewPayment", "reassessmentNewEndDate", "reassessmentNewDiscountRate", "reassessmentRenewalOption", "reassessmentTerminationOption", "reassessmentPurchaseOption"] }
        ]
      }
    ];

    for (const flow of flows) {
      const form = container.querySelector(`#${flow.formId}`);
      const submit = container.querySelector(`#${flow.submitId}`);
      const formCard = submit?.closest('div[style*="padding:14px"]');
      const fieldGrid = formCard?.querySelector('div[style*="display:grid"]');
      const eventSection = formCard?.parentElement;
      if (!form || !submit || !formCard || !fieldGrid || !eventSection) continue;

      eventSection.classList.add("lq-op-event-block", `is-${flow.key}`);
      const sectionHeading = eventSection.querySelector("h3");
      if (sectionHeading) {
        sectionHeading.id = flow.titleId;
        eventSection.setAttribute("aria-labelledby", flow.titleId);
      }
      formCard.classList.add("lq-op-change-form");

      const stepper = document.createElement("ol");
      stepper.className = "lq-op-stepper";
      stepper.setAttribute("aria-label", flow.key === "reassessment" ? "Yeniden değerlendirme akışı" : "Modifikasyon akışı");
      stepper.innerHTML = '<li><span aria-hidden="true">1</span><span>Olay ve tarih</span></li><li><span aria-hidden="true">2</span><span>Yeni şartlar</span></li><li><span aria-hidden="true">3</span><span>Etkiyi gözden geçir</span></li>';
      eventSection.insertBefore(stepper, formCard);

      const stageList = document.createElement("div");
      stageList.className = "lq-op-stage-list";
      for (const [index, stageConfig] of flow.labels.entries()) {
        const stage = document.createElement("section");
        const headingId = `${flow.key}FlowStage${index + 1}`;
        stage.className = "lq-op-stage";
        stage.setAttribute("aria-labelledby", headingId);
        const heading = document.createElement("h4");
        heading.className = "lq-op-stage-title";
        heading.id = headingId;
        heading.textContent = `${String(index + 1).padStart(2, "0")} · ${stageConfig.title}`;
        const fields = document.createElement("div");
        fields.className = "lq-op-stage-fields";
        stage.append(heading, fields);
        for (const id of stageConfig.ids) {
          const input = formCard.querySelector(`#${id}`);
          const label = input?.closest("label");
          if (label) fields.appendChild(label);
        }
        stageList.appendChild(stage);
      }
      fieldGrid.replaceWith(stageList);

      const actionRow = document.createElement("div");
      actionRow.className = "lq-op-form-actions";
      actionRow.appendChild(submit);
      formCard.appendChild(actionRow);
    }
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
      if (isUiV2()) {
        container.innerHTML = `<div class="gk-v26-page lq-pg lq-op-page">${operationPageHeader("Satış ve geri kiralama", "TFRS 16.98–103 · Sözleşmeye bağlı işlem bilgisi ve sunucu doğrulamalı etki")}<div class="lq-op-layout"><section class="lq-pg-card lq-op-main"><div class="lq-op-contract-picker"><label for="v26SlbContractSelect">Sözleşme</label><select id="v26SlbContractSelect">${list.length ? options(list, selectedSlbContractId) : '<option value="">Sözleşme bulunamadı</option>'}</select>${selectedBanner(selected)}</div><div id="slbSectionContainer"></div></section>${operationImpactPanel(selected, "Satış ve geri kiralama", "Taslak alanları tarayıcıda ölçüm üretmez. Sonuç, özel sunucu paketinden alınır.", "lqOpImpactResult")}</div></div>`;
      } else {
        container.innerHTML = `
          <div class="gk-v26-page">
            <div style="margin-bottom:16px;"><h2 style="margin:0;font-size:20px;color:#0f172a;">Satış ve Geri Kiralama (SLB)</h2><p style="margin:4px 0 0;font-size:13px;color:#64748b;">TFRS 16.98-103 kapsamındaki satış-ve-geri-kiralama işlemleri sözleşme bazında yönetiliyor.</p></div>
            <div class="gk-v26-card" style="margin-bottom:0;"><label style="font-size:11px;font-weight:700;color:#64748b;display:block;margin-bottom:6px;">Sözleşme</label>
              <select id="v26SlbContractSelect" style="width:100%;max-width:480px;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;">${list.length ? options(list, selectedSlbContractId) : '<option value="">Sözleşme bulunamadı</option>'}</select>
              ${selectedBanner(selected)}
            </div><div id="slbSectionContainer"></div>
          </div>`;
      }
      container.querySelector("#v26SlbContractSelect")?.addEventListener("change", event => { selectedSlbContractId = event.target.value; render(); });
      if (selected) {
        bridge().renderSlbSection?.(selected);
        const resultBox = isUiV2() ? container.querySelector("#slbResultContainer") : null;
        const resultMount = container.querySelector("#lqOpImpactResult");
        if (resultBox && resultMount) resultMount.replaceChildren(resultBox);
      }
    };
    render();
  }

  function renderSublease(container) {
    if (!prepare(container)) return;
    const render = () => {
      const list = sortedContracts();
      if (!selectedSubleaseContractId && list.length) selectedSubleaseContractId = list[0].id;
      const selected = list.find(contract => contract.id === selectedSubleaseContractId) || null;
      if (isUiV2()) {
        container.innerHTML = `<div class="gk-v26-page lq-pg lq-op-page">${operationPageHeader("Alt kiralama", "TFRS 16.B58 · Ana kiradan doğan kullanım hakkına göre sınıflandırma")}<div class="lq-op-layout"><section class="lq-pg-card lq-op-main"><div class="lq-op-contract-picker"><label for="v26SubleaseContractSelect">Sözleşme (ana kira)</label><select id="v26SubleaseContractSelect">${list.length ? options(list, selectedSubleaseContractId) : '<option value="">Sözleşme bulunamadı</option>'}</select>${selectedBanner(selected)}</div><div id="subleaseSectionContainer"></div></section>${operationImpactPanel(selected, "Alt kiralama", "Ana kira ve alt kiralama ayrı akışlardır. Finansal etki yalnızca doğrulanmış sunucu sonucundan gösterilir.", "lqOpImpactResult")}</div></div>`;
      } else {
        container.innerHTML = `
          <div class="gk-v26-page">
            <div style="margin-bottom:16px;"><h2 style="margin:0;font-size:20px;color:#0f172a;">Alt Kiralama (Sublease)</h2><p style="margin:4px 0 0;font-size:13px;color:#64748b;">TFRS 16.B58 kapsamındaki alt kiralama işlemleri sözleşme bazında yönetiliyor.</p></div>
            <div class="gk-v26-card" style="margin-bottom:0;"><label style="font-size:11px;font-weight:700;color:#64748b;display:block;margin-bottom:6px;">Sözleşme (Ana Kira)</label>
              <select id="v26SubleaseContractSelect" style="width:100%;max-width:480px;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;">${list.length ? options(list, selectedSubleaseContractId) : '<option value="">Sözleşme bulunamadı</option>'}</select>
              ${selectedBanner(selected)}
            </div><div id="subleaseSectionContainer"></div>
          </div>`;
      }
      container.querySelector("#v26SubleaseContractSelect")?.addEventListener("change", event => { selectedSubleaseContractId = event.target.value; render(); });
      if (selected) {
        bridge().renderSubleaseSection?.(selected);
        const resultBox = isUiV2() ? container.querySelector("#subleaseResultContainer") : null;
        const resultMount = container.querySelector("#lqOpImpactResult");
        if (resultBox && resultMount) resultMount.replaceChildren(resultBox);
      }
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
        global.LeaseQantTfrs16JournalUi?.bindPeriodControls(container,"accounting",`single:${selected.companyId}:${selected.id}`);
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
      let modRows, reassRows;
      try {
        modRows = bridge().getModificationReport?.(now)?.rows || [];
        reassRows = bridge().getReassessmentReport?.(now)?.rows || [];
      } catch (_) {
        return null;
      }
      const pendingMods = modRows.filter(row => row.status !== "APPLIED" && row.status !== "CANCELLED")
        .map(row => ({ kind: "MOD", contractId: row.contractId, company: row.company, id: row.modificationId, date: row.effectiveDate || row.modificationDate, reason: row.reason, oldPayment: row.oldPayment, newPayment: row.newPayment }));
      const pendingReass = reassRows.filter(row => row.status !== "APPLIED" && row.status !== "CANCELLED")
        .map(row => ({ kind: "REASS", contractId: row.contractId, company: row.company, id: row.reassessmentId, date: row.effectiveDate || row.reassessmentDate, reason: row.reason, oldPayment: row.oldPayment, newPayment: row.newPayment }));
      return [...pendingMods, ...pendingReass].sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
    };

    const pendingHtml = pending => {
      if (pending === null) return '<p role="status" class="gk-v26-card">Onay bekleyen işlemlerin rapor kaynağı henüz hazır değil. Sözleşme bazındaki işlemleri aşağıdan inceleyebilirsiniz.</p>';
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
      if (isUiV2()) {
        container.innerHTML = `<div class="gk-v26-page lq-pg lq-op-page">${operationPageHeader("İşlemler", "Modifikasyon ve yeniden değerlendirme · sözleşme bazında yönetim")}${pendingHtml(pending)}<div class="lq-op-layout"><section class="lq-pg-card lq-op-main"><div class="lq-op-contract-picker"><label for="v26ModReassContractSelect">Sözleşme</label><select id="v26ModReassContractSelect">${optionsHtml}</select>${selectedBanner(selected)}</div><div class="lq-op-events">${body}</div></section>${operationImpactPanel(selected, "Modifikasyon ve yeniden değerlendirme", "Tutarlar taslak oluşturulurken sunucudaki motor tarafından hesaplanır; tarayıcı hesaplama yapmaz.", "", changeImpactHtml(selected))}</div></div>`;
        enhanceChangeFlow(container);
      } else {
        container.innerHTML = `<div class="gk-v26-page"><div style="margin-bottom:16px;"><h2 style="margin:0;font-size:20px;color:#0f172a;">Modifikasyon &amp; Reassessment</h2><p style="margin:4px 0 0;font-size:13px;color:#64748b;">Kira modifikasyonu ve reassessment işlemleri artık tek bir ekranda, sözleşme bazında yönetiliyor.</p></div>${pendingHtml(pending)}<div class="gk-v26-card" style="margin-bottom:0;"><label style="font-size:11px;font-weight:700;color:#64748b;display:block;margin-bottom:6px;">Sözleşme</label><select id="v26ModReassContractSelect" style="width:100%;max-width:480px;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;">${optionsHtml}</select>${selectedBanner(selected)}</div>${body}</div>`;
      }

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
          <td style="padding:6px;border-top:1px solid #edf0f4;font-size:11px;">${escapeHtml(formatOperationDate(row.date))}</td>
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
          <div>Devredilen ROU (Tahsis: ${new Intl.NumberFormat("tr-TR", { style: "percent", maximumFractionDigits: 0 }).format(result.rouAllocationRatio)})<br><strong>${formatCurrency(result.allocatedRouCarryingAmount)}</strong></div>
          <div>Net Yatırım (Alt Kiralama PV)<br><strong>${formatCurrency(result.netInvestment)}</strong></div>
          <div>Satış Kâr/Zararı<br><strong style="color:${result.sellingProfitLoss < 0 ? '#dc2626' : '#16a34a'};">${formatCurrency(result.sellingProfitLoss)}</strong></div>
        </div>
        ${renderSlbJournalHtml(result.inceptionJournal)}
      </div>
    `;
  }

  // The SLB detail form is presentation-only. Keep its fields and labels in
  // the operations UI module while the engine retains validation, private
  // calculation and persistence orchestration.
  function renderSlbForm(contract) {
    const saved = contract?.saleAndLeaseback || null;
    if (isUiV2()) return `
      <div class="lq-op-flow-form" data-lq-operation-form="sale-and-leaseback">
        <header class="lq-op-form-head"><span class="lq-pg-kick">TFRS 16.98–103</span><h2>Satış ve geri kiralama</h2><p>Satış koşulları ve geri kiralama bilgilerini girin. Hesaplama mevcut sunucu akışında yapılır.</p></header>
        <div class="lq-op-field-grid">
          <label>Önceki net defter değeri<input id="slbCarryingAmount" type="number" step="0.01" value="${escapeHtml(saved?.previousCarryingAmount ?? "")}" /></label>
          <label>Gerçeğe uygun değer<input id="slbFairValue" type="number" step="0.01" value="${escapeHtml(saved?.fairValueOfAsset ?? "")}" /></label>
          <label>Satış bedeli (tahsil edilen)<input id="slbSaleProceeds" type="number" step="0.01" value="${escapeHtml(saved?.saleProceeds ?? "")}" /></label>
          <label class="lq-op-check"><input id="slbQualifiesAsSale" type="checkbox" ${saved?.qualifiesAsSale ? "checked" : ""} />Devir TFRS 15 anlamında satış sayılıyor</label>
          <label>TFRS 15 satış değerlendirmesi referansı<input id="slbSaleAssessmentRef" type="text" maxlength="200" placeholder="Belge / rapor / karar no" value="${escapeHtml(saved?.saleAssessment?.reference ?? "")}" /></label>
          <label>Geri kiralama bugünkü değeri<input id="slbLeasebackPV" type="number" step="0.01" placeholder="Satış sayılıyorsa zorunlu" value="${escapeHtml(saved?.leasebackPV ?? "")}" /></label>
          <label>Bugünkü değer kanıt referansı<input id="slbLeasebackPVRef" type="text" maxlength="200" placeholder="Değerleme raporu / hesap no" value="${escapeHtml(saved?.leasebackPVEvidence?.reference ?? "")}" /></label>
        </div>
        <p class="lq-op-hint">Kaydettiğinizde değerlendirme ve bugünkü değer kanıtı sizin adınıza ve kayıt zamanıyla onaylı olarak saklanır (TFRS 16.99–100). Satış sayılmıyorsa bugünkü değer alanlarını boş bırakın.</p>
        <label class="lq-op-note-field">Mesleki muhakeme notu (gerekçe)<textarea id="slbNote" rows="3">${escapeHtml(saved?.professionalJudgmentNote || "")}</textarea></label>
        <button id="slbCalculateButton" type="button" class="primary-button lq-op-primary-button">Sunucu önizlemesini al</button>
        <button id="slbSaveButton" type="button" class="primary-button lq-op-primary-button" disabled>Önizlenen formu kaydet</button>
        <p>Önizleme kayıtlı sözleşmenin güncel sürümünü kullanır ve kayıt oluşturmaz. Form kaydı muhasebe olayı veya defter kaydı onayı değildir.</p>
        <div id="slbResultContainer" class="lq-op-result-slot">${operationSourceState()}</div>
      </div>
    `;
    return `
      <div style="margin-top:20px;border-top:1px solid #e5e7eb;padding-top:18px;">
        <div style="font-size:10px;color:#64748b;font-weight:800;letter-spacing:1px;">TFRS 16.98-103 — SATIŞ VE GERİ KİRALAMA (SLB)</div>
        <p style="margin:6px 0 10px;color:#64748b;font-size:11px;">
          Bu kontrat bir satış-ve-geri-kiralama işleminin geri kiralama bacağıysa, aşağıdaki bilgileri girin.
          Kontratın kendi ödeme/iskonto oranı bilgileri (aylık kira, süre, iskonto oranı) geri kiralamanın şartları olarak kullanılır.
        </p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;max-width:520px;">
          <label style="font-size:11px;color:#475569;">
            Önceki Net Defter Değeri
            <input id="slbCarryingAmount" type="number" step="0.01" value="${saved?.previousCarryingAmount ?? ""}" style="width:100%;padding:6px;border:1px solid #e2e8f0;border-radius:6px;margin-top:3px;" />
          </label>
          <label style="font-size:11px;color:#475569;">
            Gerçeğe Uygun Değer
            <input id="slbFairValue" type="number" step="0.01" value="${saved?.fairValueOfAsset ?? ""}" style="width:100%;padding:6px;border:1px solid #e2e8f0;border-radius:6px;margin-top:3px;" />
          </label>
          <label style="font-size:11px;color:#475569;">
            Satış Bedeli (Tahsil Edilen)
            <input id="slbSaleProceeds" type="number" step="0.01" value="${saved?.saleProceeds ?? ""}" style="width:100%;padding:6px;border:1px solid #e2e8f0;border-radius:6px;margin-top:3px;" />
          </label>
          <label style="font-size:11px;color:#475569;display:flex;align-items:center;gap:6px;margin-top:16px;">
            <input id="slbQualifiesAsSale" type="checkbox" ${saved?.qualifiesAsSale ? "checked" : ""} />
            Devir TFRS 15 anlamında bir satış sayılıyor
          </label>
        </div>
        <label style="font-size:11px;color:#475569;display:block;margin-top:10px;max-width:520px;">
          Mesleki Muhakeme Notu (gerekçe)
          <textarea id="slbNote" rows="2" style="width:100%;padding:6px;border:1px solid #e2e8f0;border-radius:6px;margin-top:3px;">${escapeHtml(saved?.professionalJudgmentNote || "")}</textarea>
        </label>
        <button id="slbCalculateButton" style="margin-top:10px;padding:8px 16px;background:#0f172a;color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer;">
          Hesapla ve Kaydet
        </button>
        <div id="slbResultContainer" style="margin-top:16px;"></div>
      </div>
    `;
  }

  // The sublease detail form is presentation-only. Keep its fields and
  // labels in the operations UI module while the engine retains validation,
  // private calculation and persistence orchestration.
  function renderSubleaseForm(contract) {
    const saved = contract?.sublease || null;
    if (isUiV2()) return `
      <div class="lq-op-flow-form" data-lq-operation-form="sublease">
        <header class="lq-op-form-head"><span class="lq-pg-kick">TFRS 16.B58</span><h2>Alt kiralama</h2><p>Sınıflandırma ana kiradan doğan kullanım hakkına göre yapılır; ana kira ve alt kiralama ayrı akışlardır.</p></header>
        <div class="lq-op-field-grid">
          <label>Alt kiralama aylık bedeli<input id="subleaseMonthlyPayment" type="number" step="0.01" value="${escapeHtml(saved?.monthlyPayment ?? "")}" /></label>
          <label>İskonto oranı (yıllık %)<input id="subleaseDiscountRate" type="number" step="0.01" value="${escapeHtml(saved?.discountRate ?? "")}" /></label>
          <label>Başlangıç tarihi<input id="subleaseStartDate" type="date" value="${escapeHtml(saved?.startDate ? String(saved.startDate).slice(0,10) : "")}" /></label>
          <label>Bitiş tarihi<input id="subleaseEndDate" type="date" value="${escapeHtml(saved?.endDate ? String(saved.endDate).slice(0,10) : "")}" /></label>
          <label>ROU tahsis oranı<input id="subleaseRouRatio" type="number" step="0.01" min="0.01" max="1" value="${escapeHtml(saved?.rouAllocationRatio ?? 1)}" /></label>
          <label>Sınıflandırma<select id="subleaseClassification"><option value="OPERATING" ${saved?.classification !== "FINANCE" ? "selected" : ""}>Operating</option><option value="FINANCE" ${saved?.classification === "FINANCE" ? "selected" : ""}>Finance</option></select></label>
        </div>
        <label class="lq-op-note-field">Mesleki muhakeme notu (sınıflandırma gerekçesi)<textarea id="subleaseNote" rows="3">${escapeHtml(saved?.professionalJudgmentNote || "")}</textarea></label>
        <div class="lq-op-form-actions"><button id="subleaseCalculateButton" type="button" class="primary-button lq-op-primary-button">Sunucu önizlemesini al</button>
        <button id="subleaseSaveButton" type="button" class="secondary-button" disabled>Önizlenen formu kaydet</button></div>
        <p>Önizleme kayıt oluşturmaz. Form kaydı muhasebe olayı veya defter kaydı onayı değildir.</p>
        <div id="subleaseResultContainer" class="lq-op-result-slot">${operationSourceState()}</div>
      </div>
    `;
    return `
      <div style="margin-top:20px;border-top:1px solid #e5e7eb;padding-top:18px;">
        <div style="font-size:10px;color:#64748b;font-weight:800;letter-spacing:1px;">TFRS 16.B58 — ALT KİRALAMA (SUBLEASE)</div>
        <p style="margin:6px 0 10px;color:#64748b;font-size:11px;">
          Bu kontratı (ana kira) kısmen veya tamamen üçüncü bir tarafa devrediyorsanız, alt kiralamanın kendi şartlarını girin.
          Sınıflandırma (finance/operating) ana kiradan doğan ROU'ya göre yapılır — altta yatan varlığa göre değil.
        </p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;max-width:560px;">
          <label style="font-size:11px;color:#475569;">
            Alt Kiralama Aylık Bedeli
            <input id="subleaseMonthlyPayment" type="number" step="0.01" value="${saved?.monthlyPayment ?? ""}" style="width:100%;padding:6px;border:1px solid #e2e8f0;border-radius:6px;margin-top:3px;" />
          </label>
          <label style="font-size:11px;color:#475569;">
            İskonto Oranı (Yıllık %)
            <input id="subleaseDiscountRate" type="number" step="0.01" value="${saved?.discountRate ?? ""}" style="width:100%;padding:6px;border:1px solid #e2e8f0;border-radius:6px;margin-top:3px;" />
          </label>
          <label style="font-size:11px;color:#475569;">
            Başlangıç Tarihi
            <input id="subleaseStartDate" type="date" value="${saved?.startDate ? String(saved.startDate).slice(0,10) : ""}" style="width:100%;padding:6px;border:1px solid #e2e8f0;border-radius:6px;margin-top:3px;" />
          </label>
          <label style="font-size:11px;color:#475569;">
            Bitiş Tarihi
            <input id="subleaseEndDate" type="date" value="${saved?.endDate ? String(saved.endDate).slice(0,10) : ""}" style="width:100%;padding:6px;border:1px solid #e2e8f0;border-radius:6px;margin-top:3px;" />
          </label>
          <label style="font-size:11px;color:#475569;">
            ROU Tahsis Oranı (0-1, örn. yarısı = 0.5)
            <input id="subleaseRouRatio" type="number" step="0.01" min="0.01" max="1" value="${saved?.rouAllocationRatio ?? 1}" style="width:100%;padding:6px;border:1px solid #e2e8f0;border-radius:6px;margin-top:3px;" />
          </label>
          <label style="font-size:11px;color:#475569;">
            Sınıflandırma
            <select id="subleaseClassification" style="width:100%;padding:6px;border:1px solid #e2e8f0;border-radius:6px;margin-top:3px;">
              <option value="OPERATING" ${saved?.classification !== "FINANCE" ? "selected" : ""}>Operating</option>
              <option value="FINANCE" ${saved?.classification === "FINANCE" ? "selected" : ""}>Finance</option>
            </select>
          </label>
        </div>
        <label style="font-size:11px;color:#475569;display:block;margin-top:10px;max-width:560px;">
          Mesleki Muhakeme Notu (sınıflandırma gerekçesi)
          <textarea id="subleaseNote" rows="2" style="width:100%;padding:6px;border:1px solid #e2e8f0;border-radius:6px;margin-top:3px;">${escapeHtml(saved?.professionalJudgmentNote || "")}</textarea>
        </label>
        <button id="subleaseCalculateButton" style="margin-top:10px;padding:8px 16px;background:#0f172a;color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer;">
          Hesapla ve Kaydet
        </button>
        <div id="subleaseResultContainer" style="margin-top:16px;"></div>
      </div>
    `;
  }

  global.LeaseQantTfrs16OperationsUi = { renderModificationReassessment, renderSaleAndLeaseback, renderSublease, renderAccountingCenter, renderSlbForm, renderSubleaseForm, renderSlbResultHtml, renderSlbJournalHtml, renderSubleaseResultHtml, renderPaymentScheduleHeader, renderPaymentScheduleFilters, renderPaymentScheduleSection, renderPaymentScheduleTableShell, renderPaymentScheduleFooterContainers, renderPaymentScheduleRows, renderPaymentScheduleState, exportPaymentScheduleFile, bindPaymentScheduleEvents, bindSlbPreviewFlow, bindSlbEvents, bindSubleaseEvents, bindModificationEvents, bindReassessmentEvents };
})(window);
