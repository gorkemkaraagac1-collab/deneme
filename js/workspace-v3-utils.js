(function exposeWorkspaceUtils(root) {
  'use strict';

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
  }

  function isIsoDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }

  function isCalendarMonth(start, end) {
    if (!isIsoDate(start) || !isIsoDate(end) || start > end) return false;
    const startParts = start.split('-').map(Number);
    const endParts = end.split('-').map(Number);
    const lastDay = new Date(Date.UTC(startParts[0], startParts[1], 0)).getUTCDate();
    return start === `${startParts[0]}-${String(startParts[1]).padStart(2, '0')}-01`
      && startParts[0] === endParts[0] && startParts[1] === endParts[1]
      && endParts[2] === lastDay;
  }

  function formatMoney(value, currency, options = {}) {
    if (value == null || !Number.isFinite(Number(value))) return '—';
    const amount = Number(value);
    const formatted = new Intl.NumberFormat('tr-TR', {
      minimumFractionDigits: options.minimumFractionDigits ?? 2,
      maximumFractionDigits: options.maximumFractionDigits ?? 2,
      useGrouping: true
    }).format(Math.abs(amount));
    const shown = amount < 0 ? `(${formatted})` : formatted;
    return currency ? `${shown} ${currency}` : shown;
  }

  function formatDate(value) {
    if (!isIsoDate(String(value || '').slice(0, 10))) return '—';
    const [year, month, day] = String(value).slice(0, 10).split('-');
    return `${day}.${month}.${year}`;
  }

  function status(statusCode, value) {
    const definitions = {
      SUPPORTED: { label: 'Doğrulanmış', className: 'status-success', symbol: '✓' },
      COMPLETE_POPULATION: { label: 'Tam kapsam', className: 'status-success', symbol: '✓' },
      ZERO_CONFIRMED: { label: 'Doğrulanmış sıfır', className: 'status-success', symbol: '✓' },
      OPEN: { label: 'Dönem açık', className: 'status-success', symbol: '✓' },
      LOCKED: { label: 'Dönem kilitli', className: 'status-warning', symbol: '▣' },
      DRAFT: { label: 'Taslak', className: 'status-info', symbol: '•' },
      NOT_CREATED: { label: 'Taslak yok', className: 'status-neutral', symbol: '·' },
      NOT_READY: { label: 'Kaynak gerekli', className: 'status-warning', symbol: '!' },
      NOT_PROVIDED: { label: 'Kaynak gerekli', className: 'status-warning', symbol: '!' },
      REQUIRES_LEDGER_DATA: { label: 'Defter verisi gerekli', className: 'status-warning', symbol: '!' },
      REQUIRES_CONFIGURATION: { label: 'Yapılandırma gerekli', className: 'status-warning', symbol: '!' },
      REQUIRES_ENTITY_INPUT: { label: 'Şirket girdisi gerekli', className: 'status-warning', symbol: '!' },
      NOT_SUPPORTED: { label: 'Desteklenmiyor', className: 'status-neutral', symbol: '–' },
      NOT_APPLICABLE: { label: 'Uygulanmıyor', className: 'status-neutral', symbol: '·' },
      UNAVAILABLE: { label: 'Hazır değil', className: 'status-neutral', symbol: '·' },
      FAILED_VALIDATION: { label: 'Kontrol başarısız', className: 'status-danger', symbol: '×' },
      INCOMPLETE_INPUT_REQUIRED: { label: 'Eksik kaynak', className: 'status-warning', symbol: '!' },
      UNSUPPORTED_REQUIREMENT_PRESENT: { label: 'Kısmi kapsam', className: 'status-warning', symbol: '!' }
    };
    const item = definitions[statusCode] || { label: value || 'Durum doğrulanamadı', className: 'status-neutral', symbol: '·' };
    return `<span class="status-badge ${item.className}"><span class="status-symbol" aria-hidden="true">${item.symbol}</span>${escapeHtml(item.label)}</span>`;
  }

  function previousCalendarMonth(now = new Date()) {
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const last = new Date(now.getFullYear(), now.getMonth(), 0);
    const iso = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return { periodStart: iso(first), periodEnd: iso(last) };
  }

  const api = Object.freeze({ escapeHtml, isIsoDate, isCalendarMonth, formatMoney, formatDate, status, previousCalendarMonth });
  root.LQWorkspaceUtils = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
