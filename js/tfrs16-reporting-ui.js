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
      container.innerHTML = `<div class="gk-v26-page"><div style="margin-bottom:16px;"><h2 style="margin:0;font-size:20px;color:#0f172a;">Dipnotlar</h2><p style="margin:4px 0 0;font-size:13px;color:#64748b;">TFRS 16 finansal raporlama dipnotları — varlık, yükümlülük ve likidite riski. Tüm portföy için, dönem sonuna göre hesaplanır.</p></div><div class="gk-v26-card"><label style="font-size:11px;font-weight:700;color:#64748b;display:block;margin-bottom:6px;">Dönem Sonu (Raporlama Tarihi)</label><input type="date" id="v26FootnotesPeriodEndInput" value="${api.dateInputValue(periodEnd)}" style="padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;"><button type="button" id="v26FootnotesApplyPeriod" class="gk-v26-btn" style="margin-left:8px;">Uygula</button><span style="margin-left:8px;font-size:11px;color:#94a3b8;">Dönem başı: ${periodStart.toLocaleDateString("tr-TR")}</span><div style="margin-top:16px;padding-top:16px;border-top:1px solid #e2e8f0;">${tabBtn("asset", "Varlık")}${tabBtn("liability", "Yükümlülük")}${tabBtn("liquidity", "Likidite")}</div>${tabContentHtml}</div></div>`;
      container.querySelectorAll("[data-footnote-tab]").forEach(btn => btn.addEventListener("click", () => { activeTab = btn.dataset.footnoteTab; render(); }));
      container.querySelector("#v26FootnotesApplyPeriod")?.addEventListener("click", () => { const value = container.querySelector("#v26FootnotesPeriodEndInput")?.value; if (value) periodEndOverride = value; render(); });
    };
    render();
  }

  global.LeaseQantTfrs16ReportingUi = {
    renderFinancialReporting,
    renderRiskControls,
    renderConsolidation,
    renderAuditTrail,
    renderFootnotes
  };
})(window);
