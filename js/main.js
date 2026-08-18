/**
 * GK Financial Intelligence Platform - UI & Chart Engine Integrator
 */

let dcfChartInstance = null;

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

// Render Working Capital Engine Page
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
}

// Render DCF Engine Page Outputs & Chart
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

  // Render or Update Dynamic Chart
  renderDCFChart(dcf.projections);
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
