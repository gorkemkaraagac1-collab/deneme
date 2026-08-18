/* ==========================================================================
   GK ADVISORY - CONSOLIDATED FINANCIAL DATA MODEL ENGINE
   ========================================================================== */

const GKFinancialEngine = {
  // Varsayılan konsolide finansal durum
  state: {
    revenue: 0,
    ebitda: 0,
    ebitdaMargin: 0,
    ccc: 0, // Cash Conversion Cycle (Days)
    netDebt: 0,
    leverageRatio: 0,
    tms29GainLoss: 0,
    tfrs16Liabilities: 0,
    tms19Provision: 0,
    eclProvision: 0
  },

  // Verileri yükle veya ilklendir
  init() {
    const savedState = localStorage.getItem('gk_financial_state');
    if (savedState) {
      this.state = JSON.parse(savedState);
    } else {
      this.save();
    }
    this.updateUI();
  },

  // Veriyi kaydet
  save() {
    localStorage.setItem('gk_financial_state', JSON.stringify(this.state));
    this.updateUI();
  },

  // Modüllerden gelen verileri konsolide et
  updateModuleData(moduleName, data) {
    if (this.state[moduleName] !== undefined) {
      this.state[moduleName] = data;
      this.recalculateConsolidated();
    }
  },

  // Konsolide rasyoları ve KPI'ları yeniden hesapla
  recalculateConsolidated() {
    // EBITDA Marjı Hesabı
    if (this.state.revenue > 0) {
      this.state.ebitdaMargin = ((this.state.ebitda / this.state.revenue) * 100).toFixed(1);
    }

    // Kaldıraç Oranı (Net Borç / EBITDA)
    if (this.state.ebitda > 0) {
      this.state.leverageRatio = (this.state.netDebt / this.state.ebitda).toFixed(1);
    }

    this.save();
  },

  // Cockpit ve Modül Arayüzlerini Güncelle
  updateUI() {
    // Toplam Satış
    const revEl = document.querySelector('[data-kpi="revenue"]');
    if (revEl) revEl.innerText = this.formatCurrency(this.state.revenue);

    // EBITDA Marjı
    const marginEl = document.querySelector('[data-kpi="ebitda-margin"]');
    if (marginEl) marginEl.innerText = `${this.state.ebitdaMargin}%`;

    // Nakit Dönüşüm Süresi
    const cccEl = document.querySelector('[data-kpi="ccc"]');
    if (cccEl) cccEl.innerText = `${this.state.ccc} Gün`;

    // Net Borç / EBITDA
    const levEl = document.querySelector('[data-kpi="leverage"]');
    if (levEl) levEl.innerText = `${this.state.leverageRatio}x`;
  },

  // Finansal Para Birimi Biçimlendirici (EUR / TRY / USD)
  formatCurrency(val, currency = '€') {
    return `${currency}${Number(val).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`;
  }
};

// Sayfa yüklendiğinde motoru çalıştır
document.addEventListener('DOMContentLoaded', () => {
  GKFinancialEngine.init();
});
