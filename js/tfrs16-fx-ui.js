/*
 * TFRS16 UI slice: TMS 21 functional-currency translation reader.
 *
 * Calculation and FX-rate lookup remain private-backed engine operations.
 * This file owns only the read-only presentation markup and error state for
 * the detail modal's TMS 21 section.
 */
(() => {
  const escapeHtml = value => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  const formatMoney = (api, value) => {
    if (typeof api.formatCurrency === "function") return api.formatCurrency(value);
    return `₺${Number(value || 0).toLocaleString("tr-TR", { maximumFractionDigits: 2 })}`;
  };

  const formatDate = (api, value) => {
    if (typeof api.formatDate === "function") return api.formatDate(value);
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("tr-TR");
  };

  const reportingDate = () => {
    const selected = document.getElementById("scheduleReportingDate")?.value;
    if (selected) return selected;
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  };

  async function render(container, contract) {
    if (!container) return;
    const api = window.GK_TFRS16 || {};
    if (typeof api.contractNeedsFxTranslation !== "function" || typeof api.getContractFxTranslatedSchedule !== "function") {
      container.innerHTML = `<div role="status" style="margin-top:20px;padding:12px;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;color:#9a3412;font-size:12px;">TMS 21 arayüzü hazır değil. Sayfayı yenileyin.</div>`;
      return;
    }
    if (!api.contractNeedsFxTranslation(contract)) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML = `
      <div style="margin-top:20px;border-top:1px solid #e5e7eb;padding-top:18px;">
        <div style="font-size:10px;color:#64748b;font-weight:800;letter-spacing:1px;">TMS 21 — FONKSİYONEL PARA BİRİMİ ÇEVRİMİ</div>
        <p style="margin:6px 0 0;color:#64748b;font-size:11px;">Kur bilgisi alınıyor...</p>
      </div>`;

    try {
      const result = await api.getContractFxTranslatedSchedule(contract, {
        reportingDate: reportingDate()
      });
      const fx = result?.fx;
      if (!fx?.applicable) {
        container.innerHTML = "";
        return;
      }

      const rowsHtml = (fx.schedule || []).map(row => `
        <tr>
          <td style="padding:8px;border-top:1px solid #edf0f4;font-size:12px;">${escapeHtml(row.period)}</td>
          <td style="padding:8px;border-top:1px solid #edf0f4;font-size:12px;">${formatDate(api, row.date)}</td>
          <td style="padding:8px;border-top:1px solid #edf0f4;text-align:right;font-size:12px;">${Number(row.closingRate).toFixed(4)}</td>
          <td style="padding:8px;border-top:1px solid #edf0f4;text-align:right;font-size:12px;">${formatMoney(api, row.openingLiabilityFx)}</td>
          <td style="padding:8px;border-top:1px solid #edf0f4;text-align:right;font-size:12px;">${formatMoney(api, row.interestFx)}</td>
          <td style="padding:8px;border-top:1px solid #edf0f4;text-align:right;font-size:12px;">${formatMoney(api, row.paymentFx)}</td>
          <td style="padding:8px;border-top:1px solid #edf0f4;text-align:right;font-size:12px;">${formatMoney(api, row.closingLiabilityFx)}</td>
          <td style="padding:8px;border-top:1px solid #edf0f4;text-align:right;font-size:12px;color:${row.fxGainLoss > 0 ? '#dc2626' : '#16a34a'};">${formatMoney(api, row.fxGainLoss)}</td>
          <td style="padding:8px;border-top:1px solid #edf0f4;text-align:right;font-size:12px;">${formatMoney(api, row.rouClosingFx)}</td>
        </tr>`).join("");

      container.innerHTML = `
        <div style="margin-top:20px;border-top:1px solid #e5e7eb;padding-top:18px;">
          <div style="font-size:10px;color:#64748b;font-weight:800;letter-spacing:1px;">TMS 21 — FONKSİYONEL PARA BİRİMİ ÇEVRİMİ</div>
          <h3 style="margin:5px 0 0;font-size:16px;">${escapeHtml(fx.transactionCurrency)} → ${escapeHtml(fx.functionalCurrency)}</h3>
          <p style="margin:5px 0 0;color:#64748b;font-size:11px;">
            İşlem (kira) para birimi: <strong>${escapeHtml(fx.transactionCurrency)}</strong> · Fonksiyonel para birimi: <strong>${escapeHtml(fx.functionalCurrency)}</strong> ·
            Başlangıç kuru: <strong>${Number(fx.commencementRate).toFixed(4)}</strong> (${escapeHtml(fx.commencementRateDate)}) ·
            Kümülatif kur farkı: <strong style="color:${fx.totals.cumulativeFxGainLoss > 0 ? '#dc2626' : '#16a34a'};">${formatMoney(api, fx.totals.cumulativeFxGainLoss)} ${escapeHtml(fx.functionalCurrency)}</strong>
          </p>
          <p style="margin:6px 0 0;color:#94a3b8;font-size:10px;">
            Kira yükümlülüğü (parasal kalem) her dönem kapanış kuruyla yeniden çevrilir, fark K/Z'ye yazılır. ROU varlığı (parasal olmayan) sadece başlangıç kuruyla çevrilir, yeniden değerlenmez.
          </p>
          <div style="overflow:auto;margin-top:12px;border:1px solid #e5e7eb;border-radius:10px;">
            <table style="width:100%;border-collapse:collapse;min-width:900px;">
              <thead>
                <tr style="background:#f8fafc;">
                  <th style="padding:9px;text-align:left;font-size:11px;">Dönem</th>
                  <th style="padding:9px;text-align:left;font-size:11px;">Tarih</th>
                  <th style="padding:9px;text-align:right;font-size:11px;">Kur</th>
                  <th style="padding:9px;text-align:right;font-size:11px;">Açılış Yük. (${escapeHtml(fx.functionalCurrency)})</th>
                  <th style="padding:9px;text-align:right;font-size:11px;">Faiz (${escapeHtml(fx.functionalCurrency)})</th>
                  <th style="padding:9px;text-align:right;font-size:11px;">Ödeme (${escapeHtml(fx.functionalCurrency)})</th>
                  <th style="padding:9px;text-align:right;font-size:11px;">Kapanış Yük. (${escapeHtml(fx.functionalCurrency)})</th>
                  <th style="padding:9px;text-align:right;font-size:11px;">Kur Farkı</th>
                  <th style="padding:9px;text-align:right;font-size:11px;">ROU (${escapeHtml(fx.functionalCurrency)})</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </div>
        </div>`;
    } catch (error) {
      container.innerHTML = `
        <div style="margin-top:20px;border-top:1px solid #e5e7eb;padding-top:18px;">
          <div style="font-size:10px;color:#64748b;font-weight:800;letter-spacing:1px;">TMS 21 — FONKSİYONEL PARA BİRİMİ ÇEVRİMİ</div>
          <div role="alert" style="margin-top:8px;padding:12px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;color:#991b1b;font-size:12px;">
            Kur farkı hesaplanamadı: ${escapeHtml(error?.message || String(error))}
          </div>
        </div>`;
    }
  }

  // Public engine bridge: the FX module owns both rendering and its loading fallback.
  function mount(container, contract) {
    return render(container, contract);
  }

  window.LeaseQantTfrs16FxUi = { render, mount };
})();
