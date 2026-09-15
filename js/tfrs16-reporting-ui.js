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

  global.LeaseQantTfrs16ReportingUi = { renderFinancialReporting, renderRiskControls };
})(window);
