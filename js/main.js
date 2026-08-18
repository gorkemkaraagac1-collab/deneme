/**
 * GK Financial Intelligence Platform - UI, Chart & Sensitivity Engine Integrator
 */

let dcfChartInstance = null;
let wcChartInstance = null;
let cockpitChartInstance = null;
let tfrs16ChartInstance = null;
let tms29ChartInstance = null;
let eclChartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
  renderCockpitKPIs();
  renderWorkingCapitalKPIs();
  renderValuationUI();
  renderTMS29UI();
  renderTFRS16UI();
  renderECLUI();
  bindValuationInputEvents();
  bindTFRS16InputEvents();
  bindTMS29InputEvents();
  bindECLInputEvents();
});

// Render Executive Cockpit KPIs & Trend Chart
function renderCockpitKPIs() {
  if (typeof FinancialEngine === 'undefined') return;

  const pnl = FinancialEngine.calculatePnl();
  const wc = FinancialEngine.calculateWorkingCapital();
  const val = FinancialEngine.getState().valuation;
  const fmt = FinancialEngine.formatters;

  const revEl = document.querySelector('[data-kpi="revenue"]');
  if (revEl) revEl.textContent = fmt.currency(FinancialEngine.getState().pnl.revenue);

  const ebitdaMarginEl = document.querySelector('[data-kpi="ebitda-margin"]');
  if (ebitdaMarginEl) ebitdaMarginEl.textContent = fmt.percent(pnl.ebitdaMargin);

  const cccEl = document.querySelector('[data-kpi="ccc"]');
  if (cccEl) cccEl.textContent = fmt.days(wc.ccc);

  const cockpitNetDebtEl = document.querySelector('[data-kpi="cockpit-net-debt"]');
  if (cockpitNetDebtEl) cockpitNetDebtEl.textContent = fmt.currency(val.netDebt);

  renderCockpitTrendChart();
}

function renderCockpitTrendChart() {
  const ctx = document.getElementById('cockpitTrendChart');
  if (!ctx || typeof Chart === 'undefined') return;

  const state = FinancialEngine.getState().pnl;
  const totalRev = state.revenue / 1e6;
  const ebitdaMargin = state.ebitdaMargin;

  const labels = ['Q1 2026', 'Q2 2026', 'Q3 2026 (Tahmin)', 'Q4 2026 (Tahmin)'];
  const quarterlyRev = [
    (totalRev * 0.22).toFixed(2),
    (totalRev * 0.24).toFixed(2),
    (totalRev * 0.26).toFixed(2),
    (totalRev * 0.28).toFixed(2)
  ];
  const quarterlyEbitda = quarterlyRev.map(rev => (rev * ebitdaMargin).toFixed(2));

  if (cockpitChartInstance) {
    cockpitChartInstance.data.datasets[0].data = quarterlyRev;
    cockpitChartInstance.data.datasets[1].data = quarterlyEbitda;
    cockpitChartInstance.update();
  } else {
    cockpitChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          { label: 'Satış Geliri (€M)', data: quarterlyRev, backgroundColor: 'rgba(59, 130, 246, 0.6)', borderColor: '#3b82f6', borderWidth: 1, borderRadius: 4 },
          { label: 'EBITDA (€M)', data: quarterlyEbitda, backgroundColor: 'rgba(16, 185, 129, 0.7)', borderColor: '#10b981', borderWidth: 1, borderRadius: 4 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#94a3b8' } } },
        scales: {
          x: { ticks: { color: '#94a3b8', font: { size: 12 } }, grid: { color: 'rgba(255, 255, 255, 0.05)' } },
          y: { beginAtZero: true, ticks: { color: '#94a3b8', font: { size: 12 } }, grid: { color: 'rgba(255, 255, 255, 0.05)' } }
        }
      }
    });
  }
}

// Render Working Capital Engine Page & Chart
function renderWorkingCapitalKPIs() {
  if (typeof FinancialEngine === 'undefined') return;

  const wc = FinancialEngine.calculateWorkingCapital();
  const fmt = FinancialEngine.formatters;

  const dsoEl = document.querySelector('[data-kpi="dso"]');
  if (dsoEl) dsoEl.textContent = fmt.days(wc.dso);

  const dioEl = document.querySelector('[data-kpi="dio"]');
  if (dioEl) dioEl.textContent = fmt.days(wc.dio);

  const dpoEl = document.querySelector('[data-kpi="dpo"]');
  if (dpoEl) dpoEl.textContent = fmt.days(wc.dpo);

  const cccEl = document.querySelector('[data-kpi="wc-ccc"]');
  if (cccEl) cccEl.textContent = fmt.days(wc.ccc);

  renderWorkingCapitalChart(wc);
}

function renderWorkingCapitalChart(wc) {
  const ctx = document.getElementById('wcChart');
  if (!ctx || typeof Chart === 'undefined') return;

  const labels = ['DSO (Alacak)', 'DIO (Stok)', 'DPO (Borç)', 'CCC (Nakit Döngüsü)'];
  const dataValues = [Math.round(wc.dso), Math.round(wc.dio), Math.round(wc.dpo), Math.round(wc.ccc)];
  const backgroundColors = ['rgba(59, 130, 246, 0.7)', 'rgba(245, 158, 11, 0.7)', 'rgba(16, 185, 129, 0.7)', 'rgba(239, 68, 68, 0.8)'];

  if (wcChartInstance) {
    wcChartInstance.data.datasets[0].data = dataValues;
    wcChartInstance.update();
  } else {
    wcChartInstance = new Chart(ctx, {
      type: 'bar',
      data: { labels: labels, datasets: [{ label: 'Süre (Gün)', data: dataValues, backgroundColor: backgroundColors, borderWidth: 1, borderRadius: 4 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } },
          y: { beginAtZero: true, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } }
        }
      }
    });
  }
}

// Render DCF Engine Page Outputs, Chart & Sensitivity Matrix
function renderValuationUI() {
  if (typeof FinancialEngine === 'undefined') return;

  const dcf = FinancialEngine.calculateValuation();
  const fmt = FinancialEngine.formatters;

  const evEl = document.querySelector('[data-val="ev"]');
  if (evEl) evEl.textContent = fmt.currency(dcf.enterpriseValue);

  const eqEl = document.querySelector('[data-val="equity"]');
  if (eqEl) eqEl.textContent = fmt.currency(dcf.equityValue);

  const netDebtEl = document.querySelector('[data-val="net-debt"]');
  if (netDebtEl) netDebtEl.textContent = fmt.currency(dcf.netDebt);

  renderDCFChart(dcf.projections);
  renderSensitivityMatrix();
}

function renderDCFChart(projections) {
  const ctx = document.getElementById('dcfChart');
  if (!ctx || typeof Chart === 'undefined') return;

  const labels = projections.map(p => `Yıl ${p.year}`);
  const rawFcfData = projections.map(p => (p.fcf / 1e6).toFixed(2));
  const pvFcfData = projections.map(p => (p.pvFcf / 1e6).toFixed(2));

  if (dcfChartInstance) {
    dcfChartInstance.data.labels = labels;
    dcfChartInstance.data.datasets[0].data = rawFcfData;
    dcfChartInstance.data.datasets[1].data = pvFcfData;
    dcfChartInstance.update();
  } else {
    dcfChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          { label: 'Nominal FCF (€M)', data: rawFcfData, backgroundColor: 'rgba(59, 130, 246, 0.5)', borderColor: '#3b82f6', borderWidth: 1 },
          { label: 'İndirgenmiş PV FCF (€M)', data: pvFcfData, backgroundColor: 'rgba(16, 185, 129, 0.7)', borderColor: '#10b981', borderWidth: 1 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#94a3b8' } } },
        scales: {
          x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } },
          y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } }
        }
      }
    });
  }
}

function renderSensitivityMatrix() {
  const container = document.getElementById('sensitivity-matrix-container');
  if (!container || typeof FinancialEngine === 'undefined') return;

  const state = FinancialEngine.getState().valuation;
  const pnlState = FinancialEngine.getState().pnl;
  const baseWacc = state.wacc;
  const baseGrowth = state.terminalGrowth;
  const netDebt = state.netDebt;
  const revGrowth = state.revenueGrowth;

  const waccSteps = [-0.01, -0.005, 0, 0.005, 0.01];
  const growthSteps = [-0.01, -0.005, 0, 0.005, 0.01];

  let html = `<table class="sensitivity-table"><thead><tr><th style="text-align: left;">WACC \\ Terminal g</th>`;
  growthSteps.forEach(gStep => { html += `<th>${((baseGrowth + gStep) * 100).toFixed(1)}%</th>`; });
  html += `</tr></thead><tbody>`;

  waccSteps.forEach(wStep => {
    const wVal = baseWacc + wStep;
    html += `<tr><th>WACC: ${(wVal * 100).toFixed(1)}%</th>`;
    growthSteps.forEach(gStep => {
      const gVal = baseGrowth + gStep;
      const eqVal = calculateMatrixEquityValue(wVal, gVal, revGrowth, pnlState, netDebt);
      const isBaseCase = (wStep === 0 && gStep === 0);
      html += `<td ${isBaseCase ? 'class="base-case"' : ''}>€${(eqVal / 1e6).toFixed(1)}M</td>`;
    });
    html += `</tr>`;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;
}

function calculateMatrixEquityValue(wacc, terminalGrowth, revGrowth, pnlState, netDebt) {
  let currentRev = pnlState.revenue;
  let pvSum = 0;
  for (let i = 1; i <= 5; i++) {
    currentRev *= (1 + revGrowth);
    pvSum += (currentRev * pnlState.ebitdaMargin * 0.70) / Math.pow(1 + wacc, i);
  }
  const lastFcf = (currentRev * pnlState.ebitdaMargin * 0.70);
  const terminalValue = (lastFcf * (1 + terminalGrowth)) / (wacc - terminalGrowth);
  return (pvSum + (terminalValue / Math.pow(1 + wacc, 5))) - netDebt;
}

// Render TMS 29 Engine UI & Chart
function renderTMS29UI() {
  const endIndexInput = document.getElementById('tms29-end-index');
  const baseIndexInput = document.getElementById('tms29-base-index');
  const assetInput = document.getElementById('tms29-nonmonetary-asset');
  const netMonetaryInput = document.getElementById('tms29-net-monetary');

  if (!endIndexInput || !baseIndexInput || !assetInput || !netMonetaryInput) return;

  const endIndex = parseFloat(endIndexInput.value) || 1;
  const baseIndex = parseFloat(baseIndexInput.value) || 1;
  const rawAsset = parseFloat(assetInput.value) || 0;
  const netMonetary = parseFloat(netMonetaryInput.value) || 0;

  const adjFactor = endIndex / baseIndex;
  const adjustedAsset = rawAsset * adjFactor;
  const nonMonetaryGain = adjustedAsset - rawAsset;
  const monetaryLossOrGain = -1 * netMonetary * (adjFactor - 1);

  const fmt = (typeof FinancialEngine !== 'undefined') 
    ? FinancialEngine.formatters 
    : { currency: (v, s = '₺') => `${s}${Math.round(v).toLocaleString()}` };

  const factorEl = document.querySelector('[data-tms29="adj-factor"]');
  if (factorEl) factorEl.textContent = adjFactor.toFixed(4);

  const adjAssetEl = document.querySelector('[data-tms29="adj-asset"]');
  if (adjAssetEl) adjAssetEl.textContent = fmt.currency(adjustedAsset, '₺');

  const gainEl = document.querySelector('[data-tms29="non-monetary-gain"]');
  if (gainEl) gainEl.textContent = fmt.currency(nonMonetaryGain, '₺');

  const lossEl = document.querySelector('[data-tms29="monetary-loss"]');
  if (lossEl) lossEl.textContent = fmt.currency(monetaryLossOrGain, '₺');

  renderTMS29Chart(rawAsset, adjustedAsset);
}

function renderTMS29Chart(rawAsset, adjustedAsset) {
  const ctx = document.getElementById('tms29Chart');
  if (!ctx || typeof Chart === 'undefined') return;

  const dataValues = [(rawAsset / 1e6).toFixed(2), (adjustedAsset / 1e6).toFixed(2)];

  if (tms29ChartInstance) {
    tms29ChartInstance.data.datasets[0].data = dataValues;
    tms29ChartInstance.update();
  } else {
    tms29ChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Tarihsel Maliyet', 'TMS 29 Düzeltilmiş Tutar'],
        datasets: [{
          label: 'Parasal Olmayan Varlık Değeri (₺M)',
          data: dataValues,
          backgroundColor: ['rgba(59, 130, 246, 0.6)', 'rgba(16, 185, 129, 0.7)'],
          borderColor: ['#3b82f6', '#10b981'],
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } },
          y: { beginAtZero: true, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } }
        }
      }
    });
  }
}

function bindTMS29InputEvents() {
  const inputs = ['#tms29-end-index', '#tms29-base-index', '#tms29-nonmonetary-asset', '#tms29-net-monetary'];
  inputs.forEach(id => {
    const el = document.querySelector(id);
    if (el) el.addEventListener('input', () => renderTMS29UI());
  });
}

// Render TFRS 16 Lease Engine Page
function renderTFRS16UI() {
  const paymentInput = document.getElementById('tfrs16-payment-input');
  const termInput = document.getElementById('tfrs16-term-input');
  const rateInput = document.getElementById('tfrs16-rate-input');

  if (!paymentInput || !termInput || !rateInput) return;

  const p = parseFloat(paymentInput.value) || 0;
  const n = parseInt(termInput.value) || 1;
  const r = (parseFloat(rateInput.value) || 0) / 100;

  let pvLiability = 0;
  for (let t = 1; t <= n; t++) {
    pvLiability += p / Math.pow(1 + r, t);
  }

  let remainingBalance = pvLiability;
  const annualDepreciation = pvLiability / n;
  const firstYearInterest = pvLiability * r;

  const labels = [];
  const liabilityBalances = [];

  for (let t = 1; t <= n; t++) {
    labels.push(`Yıl ${t}`);
    const interest = remainingBalance * r;
    const principalPaid = p - interest;
    remainingBalance -= principalPaid;
    liabilityBalances.push(Math.max(0, Math.round(remainingBalance)));
  }

  const fmt = (typeof FinancialEngine !== 'undefined') ? FinancialEngine.formatters : { currency: v => `€${Math.round(v).toLocaleString()}` };

  const rouEl = document.querySelector('[data-tfrs16="rou-asset"]');
  if (rouEl) rouEl.textContent = fmt.currency(pvLiability);

  const liabEl = document.querySelector('[data-tfrs16="lease-liability"]');
  if (liabEl) liabEl.textContent = fmt.currency(pvLiability);

  const deprEl = document.querySelector('[data-tfrs16="annual-depr"]');
  if (deprEl) deprEl.textContent = fmt.currency(annualDepreciation);

  const intEl = document.querySelector('[data-tfrs16="interest-exp"]');
  if (intEl) intEl.textContent = fmt.currency(firstYearInterest);

  renderTFRS16Chart(labels, liabilityBalances);
}

function renderTFRS16Chart(labels, data) {
  const ctx = document.getElementById('tfrs16Chart');
  if (!ctx || typeof Chart === 'undefined') return;

  if (tfrs16ChartInstance) {
    tfrs16ChartInstance.data.labels = labels;
    tfrs16ChartInstance.data.datasets[0].data = data;
    tfrs16ChartInstance.update();
  } else {
    tfrs16ChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Kalan Yükümlülük Bakiyesi (€)',
          data: data,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.3,
          borderWidth: 2,
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#94a3b8' } } },
        scales: {
          x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } },
          y: { beginAtZero: true, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } }
        }
      }
    });
  }
}

function bindTFRS16InputEvents() {
  const inputs = ['#tfrs16-payment-input', '#tfrs16-term-input', '#tfrs16-rate-input'];
  inputs.forEach(id => {
    const el = document.querySelector(id);
    if (el) el.addEventListener('input', () => renderTFRS16UI());
  });
}

// Render IFRS 9 ECL Engine Page
function renderECLUI() {
  const totalEadInput = document.getElementById('ecl-total-ead');
  const lgdInput = document.getElementById('ecl-lgd-rate');
  const s1ShareInput = document.getElementById('ecl-s1-share');
  const s1PdInput = document.getElementById('ecl-s1-pd');
  const s2ShareInput = document.getElementById('ecl-s2-share');
  const s2PdInput = document.getElementById('ecl-s2-pd');
  const s3ShareInput = document.getElementById('ecl-s3-share');

  if (!totalEadInput || !lgdInput || !s1ShareInput || !s2ShareInput || !s3ShareInput) return;

  const totalEad = parseFloat(totalEadInput.value) || 0;
  const lgd = (parseFloat(lgdInput.value) || 0) / 100;

  const s1Share = (parseFloat(s1ShareInput.value) || 0) / 100;
  const s1Pd = (parseFloat(s1PdInput.value) || 0) / 100;

  const s2Share = (parseFloat(s2ShareInput.value) || 0) / 100;
  const s2Pd = (parseFloat(s2PdInput.value) || 0) / 100;

  const s3Share = (parseFloat(s3ShareInput.value) || 0) / 100;
  const s3Pd = 1.0; // Stage 3 Default PD %100

  // EAD Dağılımları
  const s1Ead = totalEad * s1Share;
  const s2Ead = totalEad * s2Share;
  const s3Ead = totalEad * s3Share;

  // ECL Formülü: EAD x PD x LGD
  const s1Ecl = s1Ead * s1Pd * lgd;
  const s2Ecl = s2Ead * s2Pd * lgd;
  const s3Ecl = s3Ead * s3Pd * lgd;

  const totalEcl = s1Ecl + s2Ecl + s3Ecl;
  const coverageRatio = totalEad > 0 ? (totalEcl / totalEad) * 100 : 0;

  const fmt = (typeof FinancialEngine !== 'undefined') 
    ? FinancialEngine.formatters 
    : { currency: (v, s = '₺') => `${s}${Math.round(v).toLocaleString()}` };

  // DOM Güncellemeleri - Tablo & KPI'lar
  const totalProvEl = document.querySelector('[data-ecl="total-provision"]');
  if (totalProvEl) totalProvEl.textContent = fmt.currency(totalEcl, '₺');

  const coverageEl = document.querySelector('[data-ecl="coverage-ratio"]');
  if (coverageEl) coverageEl.textContent = `%${coverageRatio.toFixed(2)}`;

  const perfProvEl = document.querySelector('[data-ecl="performing-provision"]');
  if (perfProvEl) perfProvEl.textContent = fmt.currency(s1Ecl + s2Ecl, '₺');

  const s3ProvEl = document.querySelector('[data-ecl="stage3-provision"]');
  if (s3ProvEl) s3ProvEl.textContent = fmt.currency(s3Ecl, '₺');

  // Tablo Satır Güncellemeleri
  const updateElText = (selector, val) => {
    const el = document.querySelector(selector);
    if (el) el.textContent = val;
  };

  updateElText('[data-ecl="s1-ead"]', fmt.currency(s1Ead, '₺'));
  updateElText('[data-ecl="s2-ead"]', fmt.currency(s2Ead, '₺'));
  updateElText('[data-ecl="s3-ead"]', fmt.currency(s3Ead, '₺'));

  updateElText('[data-ecl="s1-pd-val"]', `%${(s1Pd * 100).toFixed(2)}`);
  updateElText('[data-ecl="s2-pd-val"]', `%${(s2Pd * 100).toFixed(2)}`);

  updateElText('[data-ecl="lgd-val1"]', `%${(lgd * 100).toFixed(0)}`);
  updateElText('[data-ecl="lgd-val2"]', `%${(lgd * 100).toFixed(0)}`);
  updateElText('[data-ecl="lgd-val3"]', `%${(lgd * 100).toFixed(0)}`);

  updateElText('[data-ecl="s1-ecl"]', fmt.currency(s1Ecl, '₺'));
  updateElText('[data-ecl="s2-ecl"]', fmt.currency(s2Ecl, '₺'));
  updateElText('[data-ecl="s3-ecl"]', fmt.currency(s3Ecl, '₺'));

  renderECLChart([s1Ead, s2Ead, s3Ead], [s1Ecl, s2Ecl, s3Ecl]);
}

function renderECLChart(eadList, eclList) {
  const ctx = document.getElementById('eclChart');
  if (!ctx || typeof Chart === 'undefined') return;

  const eadM = eadList.map(v => (v / 1e6).toFixed(2));
  const eclM = eclList.map(v => (v / 1e6).toFixed(2));

  if (eclChartInstance) {
    eclChartInstance.data.datasets[0].data = eadM;
    eclChartInstance.data.datasets[1].data = eclM;
    eclChartInstance.update();
  } else {
    eclChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Stage 1 (12-Ay ECL)', 'Stage 2 (Lifetime ECL)', 'Stage 3 (Impaired)'],
        datasets: [
          { label: 'Risk Tutarı (EAD - ₺M)', data: eadM, backgroundColor: 'rgba(59, 130, 246, 0.6)', borderColor: '#3b82f6', borderWidth: 1, borderRadius: 4 },
          { label: 'Ayrılan ECL Karşılığı (₺M)', data: eclM, backgroundColor: 'rgba(239, 68, 68, 0.8)', borderColor: '#ef4444', borderWidth: 1, borderRadius: 4 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#94a3b8' } } },
        scales: {
          x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } },
          y: { beginAtZero: true, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } }
        }
      }
    });
  }
}

function bindECLInputEvents() {
  const inputs = [
    '#ecl-total-ead', '#ecl-lgd-rate', 
    '#ecl-s1-share', '#ecl-s1-pd', 
    '#ecl-s2-share', '#ecl-s2-pd', 
    '#ecl-s3-share'
  ];
  inputs.forEach(id => {
    const el = document.querySelector(id);
    if (el) el.addEventListener('input', () => renderECLUI());
  });
}

// Bind Dynamic Inputs on DCF Page
function bindValuationInputEvents() {
  if (typeof FinancialEngine === 'undefined') return;

  const bindings = [
    { id: '#wacc-input', category: 'valuation', key: 'wacc', transform: v => v / 100 },
    { id: '#terminal-growth-input', category: 'valuation', key: 'terminalGrowth', transform: v => v / 100 },
    { id: '#revenue-growth-input', category: 'valuation', key: 'revenueGrowth', transform: v => v / 100 },
    { id: '#net-debt-input', category: 'valuation', key: 'netDebt', transform: v => v }
  ];

  bindings.forEach(binding => {
    const inputEl = document.querySelector(binding.id);
    if (inputEl) {
      inputEl.addEventListener('input', (e) => {
        const rawValue = parseFloat(e.target.value);
        if (!isNaN(rawValue)) {
          FinancialEngine.updateState(binding.category, binding.key, binding.transform(rawValue));
          renderValuationUI();
          renderCockpitKPIs();
        }
      });
    }
  });
}
