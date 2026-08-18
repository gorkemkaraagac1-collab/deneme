/**
 * GK Financial Intelligence Platform - UI, Chart & Sensitivity Engine Integrator
 */

let dcfChartInstance = null;
let wcChartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
  renderCockpitKPIs();
  renderWorkingCapitalKPIs();
  renderValuationUI();
  renderTMS29KPIs();
  bindValuationInputEvents();
});

// Render Executive Cockpit KPIs
function renderCockpitKPIs() {
  if (typeof FinancialEngine === 'undefined') return;

  const pnl = FinancialEngine.calculatePnl();
  const wc = FinancialEngine.calculateWorkingCapital();
  const fmt = FinancialEngine.formatters;

  const revEl = document.querySelector('[data-kpi="revenue"]');
  if (revEl) revEl.textContent = fmt.currency(FinancialEngine.getState().pnl.revenue);

  const ebitdaMarginEl = document.querySelector('[data-kpi="ebitda-margin"]');
  if (ebitdaMarginEl) ebitdaMarginEl.textContent = fmt.percent(pnl.ebitdaMargin);

  const cccEl = document.querySelector('[data-kpi="ccc"]');
  if (cccEl) cccEl.textContent = fmt.days(wc.ccc);
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

  // Render Working Capital Chart
  renderWorkingCapitalChart(wc);
}

// Render / Update Chart.js Working Capital Chart
function renderWorkingCapitalChart(wc) {
  const ctx = document.getElementById('wcChart');
  if (!ctx || typeof Chart === 'undefined') return;

  const labels = ['DSO (Alacak)', 'DIO (Stok)', 'DPO (Borç)', 'CCC (Nakit Döngüsü)'];
  const dataValues = [
    Math.round(wc.dso),
    Math.round(wc.dio),
    Math.round(wc.dpo),
    Math.round(wc.ccc)
  ];

  const backgroundColors = [
    'rgba(59, 130, 246, 0.7)',  // DSO - Mavi
    'rgba(245, 158, 11, 0.7)',  // DIO - Turuncu
    'rgba(16, 185, 129, 0.7)',  // DPO - Yeşil
    'rgba(239, 68, 68, 0.8)'    // CCC - Kırmızı / Vurgu
  ];

  const borderColors = [
    '#3b82f6',
    '#f59e0b',
    '#10b981',
    '#ef4444'
  ];

  if (wcChartInstance) {
    wcChartInstance.data.datasets[0].data = dataValues;
    wcChartInstance.update();
  } else {
    wcChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Süre (Gün)',
          data: dataValues,
          backgroundColor: backgroundColors,
          borderColor: borderColors,
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return `${context.label}: ${context.raw} Gün`;
              }
            }
          }
        },
        scales: {
          x: {
            ticks: { color: '#94a3b8', font: { size: 12 } },
            grid: { color: 'rgba(255, 255, 255, 0.05)' }
          },
          y: {
            beginAtZero: true,
            ticks: { color: '#94a3b8', font: { size: 12 } },
            grid: { color: 'rgba(255, 255, 255, 0.05)' }
          }
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

  // Render Chart & Matrix
  renderDCFChart(dcf.projections);
  renderSensitivityMatrix();
}

// Render / Update Chart.js DCF Chart
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
          {
            label: 'Nominal FCF (€M)',
            data: rawFcfData,
            backgroundColor: 'rgba(59, 130, 246, 0.5)',
            borderColor: '#3b82f6',
            borderWidth: 1
          },
          {
            label: 'İndirgenmiş PV FCF (€M)',
            data: pvFcfData,
            backgroundColor: 'rgba(16, 185, 129, 0.7)',
            borderColor: '#10b981',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#94a3b8' }
          }
        },
        scales: {
          x: {
            ticks: { color: '#94a3b8' },
            grid: { color: 'rgba(255, 255, 255, 0.05)' }
          },
          y: {
            ticks: { color: '#94a3b8' },
            grid: { color: 'rgba(255, 255, 255, 0.05)' }
          }
        }
      }
    });
  }
}

// Interaktif 5x5 Valuation Sensitivity Matrix Generator
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

  let html = `<table class="sensitivity-table">
    <thead>
      <tr>
        <th style="text-align: left;">WACC \\ Terminal g</th>`;

  growthSteps.forEach(gStep => {
    const gVal = baseGrowth + gStep;
    html += `<th>${(gVal * 100).toFixed(1)}%</th>`;
  });
  html += `</tr></thead><tbody>`;

  waccSteps.forEach(wStep => {
    const wVal = baseWacc + wStep;
    html += `<tr><th>WACC: ${(wVal * 100).toFixed(1)}%</th>`;

    growthSteps.forEach(gStep => {
      const gVal = baseGrowth + gStep;
      
      const eqVal = calculateMatrixEquityValue(wVal, gVal, revGrowth, pnlState, netDebt);
      const isBaseCase = (wStep === 0 && gStep === 0);
      const cellClass = isBaseCase ? 'class="base-case"' : '';

      html += `<td ${cellClass}>€${(eqVal / 1e6).toFixed(1)}M</td>`;
    });

    html += `</tr>`;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;
}

// Sensitivity Matris Elemanları İçin Hızlı DCF Modeli
function calculateMatrixEquityValue(wacc, terminalGrowth, revGrowth, pnlState, netDebt) {
  let currentRev = pnlState.revenue;
  let pvSum = 0;

  for (let i = 1; i <= 5; i++) {
    currentRev *= (1 + revGrowth);
    const ebitda = currentRev * pnlState.ebitdaMargin;
    const fcf = ebitda * 0.70;
    pvSum += fcf / Math.pow(1 + wacc, i);
  }

  const lastFcf = (currentRev * pnlState.ebitdaMargin * 0.70);
  const terminalValue = (lastFcf * (1 + terminalGrowth)) / (wacc - terminalGrowth);
  const pvTerminalValue = terminalValue / Math.pow(1 + wacc, 5);

  const enterpriseValue = pvSum + pvTerminalValue;
  return enterpriseValue - netDebt;
}

// Render TMS 29 Inflation Engine Page
function renderTMS29KPIs() {
  if (typeof FinancialEngine === 'undefined') return;

  const tms29 = FinancialEngine.calculateTMS29();
  const fmt = FinancialEngine.formatters;

  const gainEl = document.querySelector('[data-tms29="non-monetary-gain"]');
  if (gainEl) gainEl.textContent = fmt.currency(tms29.inflationGainOnAssets, '₺');

  const lossEl = document.querySelector('[data-tms29="monetary-loss"]');
  if (lossEl) lossEl.textContent = fmt.currency(tms29.monetaryLoss, '₺');
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
          const transformedValue = binding.transform(rawValue);
          FinancialEngine.updateState(binding.category, binding.key, transformedValue);
          renderValuationUI();
        }
      });
    }
  });
}
