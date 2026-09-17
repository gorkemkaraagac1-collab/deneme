/* LeaseQant TFRS16 — reporting/risk page UI shells. */
(function (global) {
  "use strict";

  function bridge() { return global.GK_TFRS16 || {}; }
  function esc(value) {
    const fn = bridge().escapeHtml;
    return typeof fn === "function" ? fn(value) : String(value ?? "");
  }
  function styles() {
    const fn = bridge().injectV26Styles;
    if (typeof fn === "function") fn();
  }
  function bindRefresh(render) {
    const fn = bridge().setActiveScreenRefreshCallback;
    if (typeof fn === "function") fn(render);
  }

  // Contract-detail TMS 29 table rows are presentation only.  Keep the
  // private-result and period-lock decisions in the engine, while this module
  // owns the DOM markup for saved adjustments and the preview row.
  function renderInflationAdjustmentRows(adjustments, options = {}) {
    const escape = typeof options.escapeHtml === "function" ? options.escapeHtml : esc;
    const money = typeof options.formatCurrency === "function"
      ? options.formatCurrency
      : value => String(value ?? "—");
    const lockFor = typeof options.assertPeriodWritable === "function"
      ? options.assertPeriodWritable
      : () => ({ locked: false });
    return (Array.isArray(adjustments) ? adjustments : []).map(adjustment => {
      const gl = adjustment?.restatedFigures?.liabilityMonetaryGainLoss;
      const glCell = Number.isFinite(gl)
        ? money(-gl)
        : `<span style="color:#94a3b8;">—</span>`;
      const lockCheck = lockFor(adjustment?.period || options.defaultPeriod || new Date());
      const disabled = lockCheck?.locked
        ? `disabled title="${escape(lockCheck.message)}"`
        : "";
      return `
      <tr>
        <td style="padding:8px;border-top:1px solid #edf0f4;font-size:12px;">${escape(adjustment?.period)}</td>
        <td style="padding:8px;border-top:1px solid #edf0f4;font-size:12px;">${escape(adjustment?.status)}</td>
        <td style="padding:8px;border-top:1px solid #edf0f4;text-align:right;font-size:12px;">${money(adjustment?.restatedFigures?.netAdjustment || 0)}</td>
        <td style="padding:8px;border-top:1px solid #edf0f4;text-align:right;font-size:12px;">${glCell}</td>
        <td style="padding:8px;border-top:1px solid #edf0f4;font-size:12px;">
          ${adjustment?.status === "DRAFT" ? `
            <button type="button" class="infl-apply-btn" data-id="${escape(adjustment?.id)}" style="font-size:11px;padding:3px 8px;" ${disabled}>Uygula</button>
            <button type="button" class="infl-cancel-btn" data-id="${escape(adjustment?.id)}" style="font-size:11px;padding:3px 8px;" ${disabled}>İptal</button>
          ` : ""}
        </td>
      </tr>`;
    }).join("");
  }

  function renderInflationPreviewRow(result, options = {}) {
    const escape = typeof options.escapeHtml === "function" ? options.escapeHtml : esc;
    const money = typeof options.formatCurrency === "function"
      ? options.formatCurrency
      : value => String(value ?? "—");
    const totals = result?.totals || {};
    const gainLoss = Number.isFinite(totals.liabilityMonetaryGainLoss)
      ? money(-totals.liabilityMonetaryGainLoss)
      : `<span style="color:#94a3b8;">—</span>`;
    return `
          <tr>
            <td style="padding:8px;border-top:1px solid #edf0f4;font-size:12px;">${escape(result?.reportingPeriod || options.period || "")}</td>
            <td style="padding:8px;border-top:1px solid #edf0f4;font-size:12px;">ÖNİZLEME</td>
            <td style="padding:8px;border-top:1px solid #edf0f4;text-align:right;font-size:12px;">${money(totals.netAdjustment || 0)}</td>
            <td style="padding:8px;border-top:1px solid #edf0f4;text-align:right;font-size:12px;">${gainLoss}</td>
            <td style="padding:8px;border-top:1px solid #edf0f4;font-size:12px;color:#64748b;">Taslak oluşturulmadı</td>
          </tr>`;
  }

  function renderInflationAdjustmentShell(rowsHtml = "") {
    const body = rowsHtml || `<tr><td colspan="5" style="padding:10px;color:#94a3b8;font-size:12px;">Henüz TMS 29 hesaplanmadı. Raporlama dönemini seçip Önizle'ye basın.</td></tr>`;
    return `
      <div style="margin-top:20px;border-top:1px solid #e5e7eb;padding-top:18px;">
        <div style="font-size:10px;color:#64748b;font-weight:800;letter-spacing:1px;">TMS 29 — ENFLASYON DÜZELTMESİ</div>
        <p style="margin:6px 0 0;color:#94a3b8;font-size:10px;">
          SINIR: Bu panel, kiralama portföyü (ROU + kiralama yükümlülüğü) için TAM KAPSAMLI bir
          TMS 29 düzeltmesi uygular: ROU (gayri moneter, edinim ayından raporlama dönemine
          endekslenir) ve — "Dönem Başlangıcı" girilirse — kiralama yükümlülüğü hareket tablosu
          üzerinden hesaplanan "Parasal Kazanç/(Kayıp), net" (TMS 29.28, moneter kalemin taşıdığı
          net parasal pozisyon etkisi). Kapsam dışı kalan tek şey: işletmenin kiralama dışı diğer
          moneter/gayri moneter kalemlerinin (nakit, ticari alacak/borç, stoklar vb.) düzeltilmesi —
          bunlar için ayrı bir tam finansal tablo TMS 29 çalışması gerekir.
        </p>
        <div style="display:flex;gap:8px;align-items:end;margin-top:10px;flex-wrap:wrap;">
          <div class="form-group" style="margin:0;">
            <label for="inflReportingPeriod" style="font-size:11px;">Raporlama Dönemi</label>
            <input id="inflReportingPeriod" type="month" style="padding:6px;">
          </div>
          <div class="form-group" style="margin:0;">
            <label for="inflPeriodStart" style="font-size:11px;">Dönem Başlangıcı (opsiyonel — Parasal K/Z için)</label>
            <input id="inflPeriodStart" type="month" style="padding:6px;">
          </div>
          <button type="button" id="inflPreviewBtn" style="font-size:12px;padding:6px 12px;">Önizle</button>
          <button type="button" id="inflCreateBtn" style="font-size:12px;padding:6px 12px;">Taslak Oluştur</button>
        </div>
        <p style="margin:4px 0 0;color:#94a3b8;font-size:10px;">
          Dönem Başlangıcı boş bırakılırsa yalnızca ROU düzeltmesi (kapanış bazlı) hesaplanır;
          kiralama yükümlülüğü Parasal Kazanç/(Kayıp) satırı boş kalır (V18 Parça 2 geriye dönük
          uyumluluğu — mevcut taslaklar etkilenmez).
        </p>
        <div id="inflPreviewResult" style="margin-top:10px;font-size:12px;"></div>
        <div style="overflow:auto;margin-top:14px;border:1px solid #e5e7eb;border-radius:10px;">
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:#f8fafc;">
                <th style="padding:9px;text-align:left;font-size:11px;">Dönem</th>
                <th style="padding:9px;text-align:left;font-size:11px;">Durum</th>
                <th style="padding:9px;text-align:right;font-size:11px;">ROU Net Düzeltme</th>
                <th style="padding:9px;text-align:right;font-size:11px;">Parasal K/Z (Yükümlülük)</th>
                <th style="padding:9px;text-align:left;font-size:11px;">İşlem</th>
              </tr>
            </thead>
            <tbody>${body}</tbody>
          </table>
        </div>
      </div>`;
  }

  function renderInflationPreviewMessage(message, options = {}) {
    const escape = typeof options.escapeHtml === "function" ? options.escapeHtml : esc;
    const tone = options.tone === "info" ? "#475569" : "#991b1b";
    return `<div role="status" style="color:${tone};">${escape(message || "")}</div>`;
  }

  function renderInflationPreviewError(error, options = {}) {
    const detail = error?.message || String(error || "Bilinmeyen hata");
    const prefix = options.prefix || "Private TMS 29 sonucu alınamadı; yerel hesaplama kapalı.";
    return renderInflationPreviewMessage(`${prefix} ${detail}`, options);
  }

  // TMS 29 taslak/uygula/iptal akışlarında kullanıcıya gösterilen uyarılar
  // da reporting UI katmanından geçer. Mesajın içeriğini private akış
  // belirler; modal/uyarı sunumunu engine'e geri taşımayız.
  function showInflationActionAlert(message) {
    const fn = bridge().showAlert;
    if (typeof fn === "function") {
      fn(message);
      return true;
    }
    return false;
  }

  function renderFinancialReporting(container) {
    if (!container) return;
    styles();
    const api = bridge();
    let loading = false;
    let error = null;
    let bodyHtml = "";
    let loadedPeriodKey = null;
    const periodKey = () => typeof api.getFinancialReportingPeriodKey === "function"
      ? api.getFinancialReportingPeriodKey()
      : "default";
    const load = () => {
      const key = periodKey();
      if (loading || loadedPeriodKey === key) return;
      loading = true;
      error = null;
      bodyHtml = "";
      if (typeof api.renderFinancialReportingBody !== "function") {
        loading = false;
        error = new Error("Private finansal raporlama köprüsü hazır değil");
        paint();
        return;
      }
      Promise.resolve(api.renderFinancialReportingBody(new Date()))
        .then(html => {
          bodyHtml = html || "";
          loadedPeriodKey = key;
          loading = false;
          paint();
        })
        .catch(reason => {
          error = reason;
          loadedPeriodKey = key;
          loading = false;
          paint();
        });
    };
    const paint = () => {
      bindRefresh(render);
      const body = loading
        ? `<div class="empty-state">Private TMS 29 portföy sonuçları yükleniyor...</div>`
        : error
          ? `<div style="color:#991b1b;padding:12px 0;">Finansal Raporlama yüklenemedi: ${esc(error?.message || String(error))}</div>`
          : bodyHtml;
      container.innerHTML = `
        <div class="gk-v26-page">
          <div style="margin-bottom:16px;">
            <h2 style="margin:0;font-size:20px;color:#0f172a;">Finansal Raporlama</h2>
            <p style="margin:4px 0 0;font-size:13px;color:#64748b;">Portföy genelinde bilanço/gelir tablosu KPI'ları ve dipnot hareket tabloları.</p>
          </div>
          <div class="gk-v26-card">${body}</div>
        </div>`;
      load();
    };
    const render = () => {
      if (!loading && loadedPeriodKey !== periodKey()) {
        bodyHtml = "";
        error = null;
      }
      paint();
    };
    paint();
  }

  function renderRiskControls(container) {
    if (!container) return;
    styles();
    const api = bridge();
    const render = () => {
      bindRefresh(render);
      let body = "";
      try {
        body = typeof api.renderRiskControlsBody === "function"
          ? api.renderRiskControlsBody(new Date())
          : `<div class="empty-state">Private risk köprüsü hazır değil.</div>`;
      } catch (reason) {
        body = `<div style="color:#991b1b;padding:12px 0;">Risk &amp; Kontroller yüklenemedi: ${esc(reason?.message || String(reason))}</div>`;
      }
      container.innerHTML = `
        <div class="gk-v26-page">
          <div style="margin-bottom:16px;">
            <h2 style="margin:0;font-size:20px;color:#0f172a;">Risk &amp; Kontroller</h2>
            <p style="margin:4px 0 0;font-size:13px;color:#64748b;">Portföy genelinde çalışan sözleşme kontrolleri ve açık istisnalar.</p>
          </div>
          <div class="gk-v26-card">${body}</div>
        </div>`;
    };
    render();
  }

  function renderConsolidation(container, options = {}) {
    if (!container) return;
    styles();
    const api = bridge();
    if (typeof api.renderConsolidationBody === "function") {
      return api.renderConsolidationBody(container, options);
    }
    container.innerHTML = `<div class="gk-v26-card" style="color:#991b1b;">Konsolidasyon sonuç köprüsü hazır değil.</div>`;
  }

  function renderAuditTrail(container) {
    if (!container) return;
    styles();
    const api = bridge();
    if (typeof api.renderAuditTrailBody === "function") {
      return api.renderAuditTrailBody(container);
    }
    container.innerHTML = `<div class="gk-v26-card" style="color:#991b1b;">Denetim izi veri köprüsü hazır değil.</div>`;
  }

  function renderContractAuditTab(contract, events) {
    const api = bridge();
    const safeContract = contract || {};
    const auditEvents = Array.isArray(events) ? events : [];
    const currency = String(safeContract.currency || "TRY").toUpperCase();
    const currencyOptions = typeof api.buildAuditPresentationCurrencyOptions === "function"
      ? api.buildAuditPresentationCurrencyOptions(currency)
      : `<option value="${esc(currency)}" selected>${esc(currency)}</option>`;
    const rows = auditEvents.length
      ? auditEvents.map(event => `<tr><td style="padding:7px;border-bottom:1px solid #eef2f7;">${esc(typeof api.formatDate === "function" ? api.formatDate(event.timestamp) : event.timestamp)}</td><td style="padding:7px;border-bottom:1px solid #eef2f7;">${esc(event.actor || "system")}</td><td style="padding:7px;border-bottom:1px solid #eef2f7;font-weight:700;">${esc(event.action || "UNKNOWN")}</td><td style="padding:7px;border-bottom:1px solid #eef2f7;">${esc(event.reason || "")}</td></tr>`).join("")
      : `<tr><td colspan="4" style="padding:10px;color:#64748b;">Bu sözleşme için audit kaydı bulunmuyor.</td></tr>`;
    return `<div style="margin-top:8px;"><div style="font-size:10px;color:#64748b;font-weight:800;letter-spacing:1px;">DENETİM İZİ</div><h3 style="margin:5px 0 0;font-size:18px;">Denetim İzi (Audit Trail)</h3><p style="margin:5px 0 0;color:#64748b;font-size:11px;">Bu sözleşmeye ait tüm oluşturma, güncelleme, modification, reassessment ve yevmiye kayıtlarını Excel/CSV olarak dışa aktarın.</p><div style="display:flex;gap:8px;align-items:end;flex-wrap:wrap;margin-top:12px;"><label style="font-size:11px;color:#64748b;font-weight:600;">Sunum Para Birimi<select id="auditPresentationCurrency" style="display:block;margin-top:4px;padding:7px;border:1px solid #d1d5db;border-radius:7px;">${currencyOptions}</select></label><button type="button" id="exportContractAuditTrailButton" class="secondary-button">↓ Denetim İzini Dışa Aktar</button></div><div style="margin-top:14px;overflow:auto;"><table class="gk-audit-table" style="width:100%;border-collapse:collapse;font-size:11px;"><thead><tr><th style="text-align:left;padding:7px;border-bottom:1px solid #dbe3ef;">Tarih</th><th style="text-align:left;padding:7px;border-bottom:1px solid #dbe3ef;">Kullanıcı</th><th style="text-align:left;padding:7px;border-bottom:1px solid #dbe3ef;">İşlem</th><th style="text-align:left;padding:7px;border-bottom:1px solid #dbe3ef;">Neden</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
  }

  function renderContractSummaryTab(contract, metrics = {}, options = {}) {
    const api = bridge();
    const safeContract = contract || {};
    const calculationError = options.calculationError === true;
    const currency = String(safeContract.currency || "TRY").toUpperCase();
    const money = value => typeof api.formatPresentationCurrency === "function"
      ? api.formatPresentationCurrency(value, currency)
      : String(value ?? "—");
    const metric = value => calculationError ? "—" : money(value);
    const frequencyLabel = typeof api.resolvePaymentFrequencyLabel === "function"
      ? api.resolvePaymentFrequencyLabel(safeContract.paymentFrequency)
      : "Aylık";
    const item = (label, value) => `<div class="detail-item"><span>${esc(label)}</span><strong>${value}</strong></div>`;
    return `<div class="detail-grid">${item("Şirket", esc(safeContract.company || ""))}${item("Tedarikçi", esc(safeContract.supplier || ""))}${item(`${esc(frequencyLabel)} Kira`, `${money(safeContract.monthlyPayment)} <span style="font-size:11px;color:#64748b;margin-left:4px;">${esc(currency)}</span>`)}${item("ROU Varlığı", `${metric(metrics.rouAssets)} <span style="font-size:11px;color:#64748b;margin-left:4px;">${esc(currency)}</span>`)}${item("İlk Kira Yükümlülüğü", `${metric(metrics.liability)} <span style="font-size:11px;color:#64748b;margin-left:4px;">${esc(currency)}</span>`)}${item("Aylık Amortisman", `${metric(metrics.depreciation)} <span style="font-size:11px;color:#64748b;margin-left:4px;">${esc(currency)}</span>`)}</div>`;
  }

  /**
   * Render the read-only status banners shown above the contract detail tabs.
   * Calculation and authorization decisions stay in the engine; this module
   * owns the presentation of those decisions.
   */
  function renderContractDetailStatus({ lockMessage = "", calculationSource = "", calculationError = false, isAdmin = false } = {}) {
    const lockHtml = lockMessage
      ? `<div style="margin-bottom:12px;padding:10px 14px;border-radius:8px;background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;font-size:13px;font-weight:700;">🔒 ${esc(lockMessage)}</div>`
      : "";
    let sourceHtml = "";
    if (isAdmin) {
      if (calculationSource === "private-api") {
        sourceHtml = `<div style="margin-bottom:12px;padding:9px 13px;border-radius:8px;background:#ecfdf5;border:1px solid #a7f3d0;color:#047857;font-size:12px;font-weight:700;">🔒 Hesaplama kaynağı: Private API</div>`;
      } else if (calculationSource === "private-error") {
        sourceHtml = `<div style="margin-bottom:12px;padding:9px 13px;border-radius:8px;background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;font-size:12px;font-weight:700;">⚠️ Private API sonucu alınamadı; hesaplama kapatıldı.</div>`;
      } else if (calculationSource === "local-warming") {
        sourceHtml = `<div style="margin-bottom:12px;padding:9px 13px;border-radius:8px;background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8;font-size:12px;font-weight:700;">⏳ Private API sonucu hazırlanıyor; hesaplama bekletiliyor.</div>`;
      }
    }
    const errorHtml = calculationError
      ? `<div role="status" style="margin-bottom:12px;padding:11px 14px;border-radius:8px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;font-size:12px;font-weight:600;">⏳ Bu sözleşmenin private hesaplama sonucu henüz hazır değil. Kurlar doğrulandıktan sonra tekrar açın; ödeme planı ve muhasebe fişi sonuç hazır olduğunda gösterilecektir.</div>`
      : "";
    return `${lockHtml}${sourceHtml}${errorHtml}`;
  }

  function renderContractDetailTabs() {
    return `<div class="gk-detail-tabs" role="tablist"><button type="button" class="gk-detail-tab-btn active" data-detail-tab-target="summary" role="tab">Özet</button><button type="button" class="gk-detail-tab-btn" data-detail-tab-target="schedule" role="tab">Ödeme Planı</button><button type="button" class="gk-detail-tab-btn" data-detail-tab-target="modification" role="tab">Modifikasyon &amp; Reassessment</button><button type="button" class="gk-detail-tab-btn" data-detail-tab-target="slb" role="tab">Satış ve Geri Kiralama</button><button type="button" class="gk-detail-tab-btn" data-detail-tab-target="sublease" role="tab">Alt Kiralama</button><button type="button" class="gk-detail-tab-btn" data-detail-tab-target="accounting" role="tab">Fişler</button><button type="button" class="gk-detail-tab-btn" data-detail-tab-target="audit" role="tab">Denetim İzi</button></div>`;
  }

  /** Compose detail tab panels around HTML supplied by engine bridges. */
  function renderContractDetailPanels({
    summaryHtml = "",
    scheduleHtml = "",
    modificationHtml = "",
    slbHtml = "",
    subleaseHtml = "",
    accountingHtml = "",
    auditHtml = ""
  } = {}) {
    return `
        <div class="gk-detail-tab gk-detail-tab-active" data-detail-tab="summary">
          ${summaryHtml}
        </div><!-- /gk-detail-tab[summary] -->

        <div class="gk-detail-tab" data-detail-tab="schedule">
          ${scheduleHtml}
        </div>

        <div class="gk-detail-tab" data-detail-tab="modification">
          ${modificationHtml}
        </div>

        <div class="gk-detail-tab" data-detail-tab="slb">
          <div id="slbSectionContainer">${slbHtml}</div>
        </div>

        <div class="gk-detail-tab" data-detail-tab="sublease">
          <div id="subleaseSectionContainer">${subleaseHtml}</div>
        </div>

        <div class="gk-detail-tab" data-detail-tab="accounting">
          ${accountingHtml}
        </div>

        <div class="gk-detail-tab" data-detail-tab="audit">
          ${auditHtml}
        </div>
      `;
  }

  function renderInflationPreviewSummary(result, options = {}) {
    const money = typeof options.formatCurrency === "function"
      ? options.formatCurrency
      : value => String(value ?? "—");
    const totals = result?.totals || {};
    const hasMonetary = Number.isFinite(totals.liabilityMonetaryGainLoss);
    return `
        <span style="color:#64748b;font-size:11px;">Hesaplama kaynağı: Private API</span><br>
        Nominal ROU: ${money(totals.nominalROUClosing)} → Düzeltilmiş: ${money(totals.restatedROUClosing)} ·
        Yükümlülük (moneter, kapanış bakiyesi değişmez): ${money(totals.nominalLiabilityClosing)} ·
        ROU Net Düzeltme: <strong>${money(totals.netAdjustment)}</strong>
        ${hasMonetary
          ? ` · Parasal Kazanç/(Kayıp), net: <strong>${money(totals.liabilityMonetaryGainLoss)}</strong>`
          : ` · <span style="color:#94a3b8;">Parasal K/Z: Dönem Başlangıcı girilmedi, hesaplanmadı.</span>`}
      `;
  }

  /**
   * Apply the active detail tab and bind its navigation. The engine keeps the
   * selected tab value across modal refreshes; this module owns the DOM-only
   * class and ARIA updates.
   */
  function applyContractDetailTab(activeTab = "summary") {
    const root = document.getElementById("detailContent");
    if (!root) return "summary";
    const panels = root.querySelectorAll(".gk-detail-tab");
    let selected = String(activeTab || "summary");
    if (!Array.from(panels).some(panel => panel.dataset.detailTab === selected)) selected = "summary";
    panels.forEach(panel => panel.classList.toggle("gk-detail-tab-active", panel.dataset.detailTab === selected));
    root.querySelectorAll(".gk-detail-tab-btn").forEach(button => {
      const active = button.dataset.detailTabTarget === selected;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
    return selected;
  }

  function bindContractDetailTabs({ getActiveTab, setActiveTab } = {}) {
    const root = document.getElementById("detailContent");
    if (!root) return false;
    const apply = () => setActiveTab?.(applyContractDetailTab(getActiveTab?.() || "summary"));
    root.querySelectorAll(".gk-detail-tab-btn").forEach(button => {
      button.addEventListener("click", () => {
        setActiveTab?.(button.dataset.detailTabTarget || "summary");
        apply();
      });
    });
    apply();
    return true;
  }

  function bindContractAuditTab(contract) {
    const button = document.getElementById("exportContractAuditTrailButton");
    if (!button) return;
    const api = bridge();
    button.addEventListener("click", () => {
      const presentationCurrency = document.getElementById("auditPresentationCurrency")?.value || contract?.currency;
      Promise.resolve(typeof api.exportContractAuditTrail === "function"
        ? api.exportContractAuditTrail(contract?.id, presentationCurrency)
        : false)
        .then(ok => {
          if (!ok) {
            if (typeof api.showAlert === "function") api.showAlert("Bu sözleşme için dışa aktarılacak denetim izi kaydı bulunamadı.");
            else if (typeof global.alert === "function") global.alert("Bu sözleşme için dışa aktarılacak denetim izi kaydı bulunamadı.");
          }
        })
        .catch(error => {
          const message = `Denetim izi dışa aktarılamadı: ${error?.message || error}`;
          if (typeof api.showAlert === "function") api.showAlert(message);
          else if (typeof global.alert === "function") global.alert(message);
        });
    });
  }

  /**
   * bindInflationAdjustmentEvents — TMS29 enflasyon düzeltmesi panelindeki
   * TÜM buton/olay bağlamalarını (Önizle, Taslak Oluştur, dönem-kilit UI'ı,
   * her taslağın Uygula/İptal butonları) tek yerde toplar. Asıl iş mantığı
   * (private API çağrısı, kayıt, hata durumunda rollback) engine.js'te
   * kalır, buraya isimlendirilmiş fonksiyon referansları olarak geçirilir
   * — bindPaymentScheduleEvents/bindSlbEvents ile BİREBİR aynı desen
   * (2026-09-16, UI orchestration ayrıştırması).
   */
  function bindInflationAdjustmentEvents(contract, container, handlers = {}) {
    const {
      runPreview,
      createDraft,
      applyAdjustment,
      cancelAdjustment,
      updateCreateBtnLockState,
      savedReportingDate
    } = handlers;
    if (!container) return;

    document.getElementById("inflPreviewBtn")?.addEventListener("click", () => { runPreview?.(); });

    // TMS 29 paneli açıldığında sözleşmenin kayıtlı raporlama tarihi varsa
    // tarihleri otomatik doldur ve önizlemeyi çalıştır.
    const reportingInput = document.getElementById("inflReportingPeriod");
    const startInput = document.getElementById("inflPeriodStart");
    if (savedReportingDate && reportingInput && !reportingInput.value) {
      const reportMonth = `${savedReportingDate.getFullYear()}-${String(savedReportingDate.getMonth() + 1).padStart(2, "0")}`;
      reportingInput.value = reportMonth;
      if (startInput && !startInput.value) {
        startInput.value = `${savedReportingDate.getFullYear()}-01`;
      }
      runPreview?.();
    }

    // V19 Kısa Vade Madde 1 (UI cilası): raporlama dönemi seçildiğinde
    // o dönem kilitliyse "Taslak Oluştur" butonu proaktif disable edilir.
    document.getElementById("inflReportingPeriod")?.addEventListener("change", (e) => {
      updateCreateBtnLockState?.(e.target.value || "");
    });

    document.getElementById("inflCreateBtn")?.addEventListener("click", () => { createDraft?.(); });

    container.querySelectorAll(".infl-apply-btn").forEach(btn => {
      btn.addEventListener("click", () => applyAdjustment?.(btn.dataset.id, btn));
    });

    container.querySelectorAll(".infl-cancel-btn").forEach(btn => {
      btn.addEventListener("click", () => cancelAdjustment?.(btn.dataset.id, btn));
    });
  }

  function renderFootnotes(container) {
    if (!container) return;
    styles();
    const api = bridge();
    let privateHydrationStarted = false;
    let privateHydrationCompleted = false;
    let privateTms29HydrationStarted = false;
    let privateTms29HydrationCompleted = false;
    let privateTms29Result = null;
    let privateTms29Error = null;
    let privateTms29PeriodKey = null;
    let activeTab = "asset";
    let periodEndOverride = null;
    const render = () => {
      bindRefresh(render);
      const periodEnd = periodEndOverride ? api.parseDate(periodEndOverride) : new Date();
      const periodStart = new Date(periodEnd.getFullYear(), 0, 1);
      const reportingPeriod = `${periodEnd.getFullYear()}-${String(periodEnd.getMonth() + 1).padStart(2, "0")}`;
      const periodStartKey = `${periodStart.getFullYear()}-${String(periodStart.getMonth() + 1).padStart(2, "0")}`;
      const periodKey = `${periodStartKey}|${reportingPeriod}`;
      if (privateTms29PeriodKey !== periodKey) {
        privateTms29PeriodKey = periodKey;
        privateTms29HydrationStarted = false;
        privateTms29HydrationCompleted = false;
        privateTms29Result = null;
        privateTms29Error = null;
      }
      let tabContentHtml = "";
      const contracts = typeof api.getContractsSnapshot === "function" ? api.getContractsSnapshot() : [];
      const cacheNeedsHydration = api.isPrivateCalculationApiReady?.() && Array.isArray(contracts) && contracts.length > 0 &&
        contracts.some(contract => !api.privateCalculationCacheHas?.(contract));
      if (cacheNeedsHydration && !privateHydrationCompleted) {
        if (!privateHydrationStarted) {
          privateHydrationStarted = true;
          Promise.resolve(api.ensurePrivateCalculationCache?.(contracts)).then(() => {
            privateHydrationCompleted = true;
            render();
          }).catch(() => {
            privateHydrationCompleted = true;
            render();
          });
        }
        tabContentHtml = `<div style="color:#475569;padding:12px 0;">Private hesaplama sonuçları yükleniyor...</div>`;
      } else if (api.isPrivateCalculationApiReady?.() && !privateTms29HydrationCompleted) {
        if (!privateTms29HydrationStarted) {
          privateTms29HydrationStarted = true;
          const eligibleContracts = contracts.filter(contract => {
            if (contract?.shortTermLease === true || contract?.lowValueAsset === true) return false;
            const start = api.parseDate?.(contract?.startDate);
            if (!start) return true;
            const acquisitionMonth = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
            return acquisitionMonth <= reportingPeriod;
          });
          const load = typeof api.loadTms29Many === "function"
            ? api.loadTms29Many(eligibleContracts, reportingPeriod, periodStartKey)
            : Promise.reject(new Error("TMS29 private batch calculation facade is unavailable"));
          load.then(results => {
            privateTms29Result = api.computePrivatePortfolioTms29(eligibleContracts, results, periodStartKey, reportingPeriod);
            privateTms29HydrationCompleted = true;
            render();
          }).catch(error => {
            privateTms29Error = error;
            privateTms29HydrationCompleted = true;
            render();
          });
        }
        tabContentHtml = `<div style="color:#475569;padding:12px 0;">Private TMS29 portföy sonuçları yükleniyor...</div>`;
      } else {
        try {
          if (privateTms29Error) throw privateTms29Error;
          const prepared = api.prepareFinancialReportingData(periodStart, periodEnd, { tms29: privateTms29Result });
          if (activeTab === "asset") tabContentHtml = api.renderAssetNoteHtml({ ...prepared, tms29: prepared.tms29 });
          else if (activeTab === "liability") tabContentHtml = api.renderLiabilityNoteHtml({ ...prepared, tms29: prepared.tms29 });
          else tabContentHtml = api.renderLiquidityNoteHtml({ liquidityRows: prepared.liquidityRows, liquidityDisclosure: prepared.liquidityDisclosure, effectivePeriodEnd: periodEnd });
        } catch (error) {
          tabContentHtml = `<div style="color:#991b1b;padding:12px 0;">Dipnot hesaplanamadı: ${esc(error?.message || String(error))}</div>`;
        }
      }
      const tabBtn = (key, label) => `<button type="button" data-footnote-tab="${key}" class="gk-v26-btn ${activeTab === key ? "" : "gk-v26-btn-secondary"}" style="margin-right:8px;">${esc(label)}</button>`;
      const periodInputValue = typeof api.dateInputValue === "function"
        ? api.dateInputValue(periodEnd)
        : `${periodEnd.getFullYear()}-${String(periodEnd.getMonth() + 1).padStart(2, "0")}-${String(periodEnd.getDate()).padStart(2, "0")}`;
      container.innerHTML = `<div class="gk-v26-page"><div style="margin-bottom:16px;"><h2 style="margin:0;font-size:20px;color:#0f172a;">Dipnotlar</h2><p style="margin:4px 0 0;font-size:13px;color:#64748b;">TFRS 16 finansal raporlama dipnotları — varlık, yükümlülük ve likidite riski. Tüm portföy için, dönem sonuna göre hesaplanır.</p></div><div class="gk-v26-card"><label style="font-size:11px;font-weight:700;color:#64748b;display:block;margin-bottom:6px;">Dönem Sonu (Raporlama Tarihi)</label><input type="date" id="v26FootnotesPeriodEndInput" value="${periodInputValue}" style="padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;"><button type="button" id="v26FootnotesApplyPeriod" class="gk-v26-btn" style="margin-left:8px;">Uygula</button><span style="margin-left:8px;font-size:11px;color:#94a3b8;">Dönem başı: ${periodStart.toLocaleDateString("tr-TR")}</span><div style="margin-top:16px;padding-top:16px;border-top:1px solid #e2e8f0;">${tabBtn("asset", "Varlık")}${tabBtn("liability", "Yükümlülük")}${tabBtn("liquidity", "Likidite")}</div>${tabContentHtml}</div></div>`;
      container.querySelectorAll("[data-footnote-tab]").forEach(btn => btn.addEventListener("click", () => { activeTab = btn.dataset.footnoteTab; render(); }));
      container.querySelector("#v26FootnotesApplyPeriod")?.addEventListener("click", () => { const value = container.querySelector("#v26FootnotesPeriodEndInput")?.value; if (value) periodEndOverride = value; render(); });
    };
    render();
  }

  function renderAuditTrailBody(container) {
    if (!container) return;
    styles();
    const api = bridge();
    const pageSize = 25;
    let page = 1;
    const contractLabel = id => {
      if (!id) return "—";
      const contract = (api.getContractsSnapshot?.() || []).find(item => item.id === id);
      return contract ? `${esc(contract.supplier || contract.name || id)} (${esc(id)})` : esc(id);
    };
    const render = () => {
      const filters = {
        action: container.querySelector("#v26AuditActionFilter")?.value || "",
        entityType: container.querySelector("#v26AuditEntityFilter")?.value || "",
        dateFrom: container.querySelector("#v26AuditDateFrom")?.value || "",
        dateTo: container.querySelector("#v26AuditDateTo")?.value || ""
      };
      const search = (container.querySelector("#v26AuditSearch")?.value || "").trim().toLowerCase();
      let events = (api.getAuditEvents?.(filters) || []).slice();
      if (search) events = events.filter(event => [event.actor, event.reason, event.contractId, event.entityId].some(value => String(value || "").toLowerCase().includes(search)));
      events.sort((a, b) => String(b.timestamp || "").localeCompare(String(a.timestamp || "")));
      const allEvents = api.getAuditEvents?.({}) || [];
      const actionOptions = Array.from(new Set(allEvents.map(event => event.action).filter(Boolean))).sort();
      const entityOptions = Array.from(new Set(allEvents.map(event => event.entityType).filter(Boolean))).sort();
      const totalPages = Math.max(1, Math.ceil(events.length / pageSize));
      page = Math.min(Math.max(1, page), totalPages);
      const pageRows = events.slice((page - 1) * pageSize, page * pageSize);
      container.innerHTML = `<div class="gk-v26-page"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:16px;"><div><h2 style="margin:0;font-size:20px;color:#0f172a;">Denetim İzi</h2><p style="margin:4px 0 0;font-size:13px;color:#64748b;">Tüm sözleşme, hesaplama ve kapanış olaylarının kronolojik kaydı · ${esc(events.length)} kayıt</p></div><button type="button" class="gk-v26-btn gk-v26-btn-secondary" id="v26AuditExportBtn">↓ CSV Aktar</button></div><div class="gk-v26-card"><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;"><label style="font-size:12px;color:#64748b;">Ara<br><input id="v26AuditSearch" type="text" placeholder="Kullanıcı, sebep, sözleşme…" value="${esc(container.querySelector("#v26AuditSearch")?.value || "")}" style="padding:7px 8px;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;"></label><label style="font-size:12px;color:#64748b;">İşlem<br><select id="v26AuditActionFilter" style="padding:7px 8px;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;"><option value="">Tümü</option>${actionOptions.map(value => `<option value="${esc(value)}" ${filters.action === value ? "selected" : ""}>${esc(value)}</option>`).join("")}</select></label><label style="font-size:12px;color:#64748b;">Varlık Türü<br><select id="v26AuditEntityFilter" style="padding:7px 8px;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;"><option value="">Tümü</option>${entityOptions.map(value => `<option value="${esc(value)}" ${filters.entityType === value ? "selected" : ""}>${esc(value)}</option>`).join("")}</select></label><label style="font-size:12px;color:#64748b;">Başlangıç<br><input id="v26AuditDateFrom" type="date" value="${esc(filters.dateFrom)}" style="padding:7px 8px;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;"></label><label style="font-size:12px;color:#64748b;">Bitiş<br><input id="v26AuditDateTo" type="date" value="${esc(filters.dateTo)}" style="padding:7px 8px;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;"></label><button type="button" class="gk-v26-btn gk-v26-btn-secondary" id="v26AuditClearFilters">Temizle</button></div></div><div class="gk-v26-card gk-v26-table-wrap" style="overflow-x:auto;"><table class="gk-v26-table"><thead><tr><th>Zaman</th><th>Kullanıcı</th><th>İşlem</th><th>Varlık</th><th>Sözleşme</th><th>Sebep</th></tr></thead><tbody>${pageRows.length ? pageRows.map(event => `<tr><td>${esc(event.timestamp ? new Date(event.timestamp).toLocaleString("tr-TR") : "—")}</td><td>${esc(event.actor || "system")}</td><td><span class="badge-tfrs16" style="font-family:var(--mono,monospace);font-size:10px;padding:2px 6px;border-radius:5px;">${esc(event.action || "—")}</span></td><td>${esc(event.entityType || "—")}${event.entityId ? ` · ${esc(event.entityId)}` : ""}</td><td>${contractLabel(event.contractId)}</td><td>${esc(event.reason || "—")}</td></tr>`).join("") : `<tr><td colspan="6" style="text-align:center;padding:34px 20px;color:#94a3b8;">Kayıt bulunamadı.</td></tr>`}</tbody></table></div>${totalPages > 1 ? `<div style="display:flex;gap:10px;align-items:center;justify-content:center;padding:14px;"><button type="button" class="gk-v26-btn gk-v26-btn-secondary" id="v26AuditPrev" ${page <= 1 ? "disabled" : ""}>← Önceki</button><span style="font-size:12px;color:#64748b;">${page} / ${totalPages} (${events.length} kayıt)</span><button type="button" class="gk-v26-btn gk-v26-btn-secondary" id="v26AuditNext" ${page >= totalPages ? "disabled" : ""}>Sonraki →</button></div>` : ""}</div>`;
      ["#v26AuditSearch", "#v26AuditActionFilter", "#v26AuditEntityFilter", "#v26AuditDateFrom", "#v26AuditDateTo"].forEach(selector => container.querySelector(selector)?.addEventListener(selector === "#v26AuditSearch" ? "input" : "change", () => { page = 1; render(); }));
      container.querySelector("#v26AuditClearFilters")?.addEventListener("click", () => { ["#v26AuditSearch", "#v26AuditActionFilter", "#v26AuditEntityFilter", "#v26AuditDateFrom", "#v26AuditDateTo"].forEach(selector => { const element = container.querySelector(selector); if (element) element.value = ""; }); page = 1; render(); });
      container.querySelector("#v26AuditPrev")?.addEventListener("click", () => { page -= 1; render(); });
      container.querySelector("#v26AuditNext")?.addEventListener("click", () => { page += 1; render(); });
      container.querySelector("#v26AuditExportBtn")?.addEventListener("click", () => { if (!events.length) return; const headers = ["timestamp", "actor", "action", "entityType", "entityId", "contractId", "reason"]; const csv = [headers.join(";"), ...events.map(event => headers.map(key => String(event[key] ?? "").replace(/;/g, ",")).join(";"))].join("\n"); const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }); const url = URL.createObjectURL(blob), link = document.createElement("a"); link.href = url; link.download = `GK_Denetim_Izi_${Date.now()}.csv`; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url); });
    };
    render();
  }

  global.LeaseQantTfrs16ReportingUi = {
    renderFinancialReporting,
    renderRiskControls,
    renderConsolidation,
    renderAuditTrail,
    renderAuditTrailBody,
    renderContractAuditTab,
    renderContractSummaryTab,
    renderContractDetailStatus,
    renderContractDetailTabs,
    renderContractDetailPanels,
    applyContractDetailTab,
    bindContractDetailTabs,
    bindContractAuditTab,
    bindInflationAdjustmentEvents,
    renderFootnotes,
    renderInflationAdjustmentRows,
    renderInflationPreviewRow,
    renderInflationPreviewSummary,
    renderInflationAdjustmentShell,
    renderInflationPreviewMessage,
    renderInflationPreviewError,
    showInflationActionAlert
  };
})(window);
