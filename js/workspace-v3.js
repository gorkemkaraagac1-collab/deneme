(function bootLeaseQantWorkspace(root) {
  'use strict';

  const U = root.LQWorkspaceUtils;
  const NAV = Object.freeze({
    overview: ['Genel Bakış', 'Kiralama portföyünüzün doğrulanmış dönem görünümü.'],
    contracts: ['Sözleşmeler', 'Sözleşme kayıtlarını bulun, inceleyin ve yeni kayıt oluşturun.'],
    calculations: ['Hesaplamalar', 'Seçilen şirket ve dönem için sunucu kaynaklı rapor.'],
    journals: ['Yevmiye', 'Defter kaydı olmayan, kaynağa bağlı fiş önizlemesi.'],
    disclosures: ['Dipnotlar', 'Doğrulanmış sayısal kaynaklar ve sürümlü anlatı taslağı.'],
    close: ['Kapanış', 'Kapanış kontrolleri; bu ekran dönem kapatmaz veya fiş aktarmaz.']
  });
  const SECTION_TITLES = {
    '14.1': 'Faaliyetin niteliği', '14.2': 'Muhasebe politikası', '14.3': 'Kullanım hakkı varlıkları',
    '14.4': 'Kira yükümlülükleri', '14.5': 'Vade analizi', '14.6': 'Diğer açıklamalar',
    '14.7': 'Toplam kira nakit çıkışı', '14.8': 'Kısa vadeli ve düşük değerli kiralamalar',
    '14.9': 'Satış ve geri kiralama', '14.10': 'Alt kiralama'
  };
  const API_BASE = () => String(root.LEASEQANT_API_BASE || root.LeaseQantPrivateCalculation?.apiBase?.() || 'https://api.leaseqant.com').replace(/\/$/, '');
  const state = {
    user: null, companies: [], contracts: [], companyId: '', period: U.previousCalendarMonth(), periodStatus: null,
    view: 'overview', detailId: null, detailTab: 'summary', filter: '', contractStatus: 'ALL', page: 1,
    pageSize: 25, report: null, journal: null, disclosure: null, drafts: null, draftSections: {},
    expectedDraftVersion: 0, savingDraft: false, busy: false, detailCalculation: null, renderEpoch: 0
  };
  const el = id => root.document.getElementById(id);

  function token() {
    return root.sessionStorage?.getItem('gk_session_token')
      || root.localStorage?.getItem('access_token')
      || root.localStorage?.getItem('gk_backend_jwt')
      || root.localStorage?.getItem('gk_tfrs16_v21_session_v1') || '';
  }

  root.tfrs16GetToken = root.tfrs16GetToken || token;

  function errorMessage(error) {
    const map = {
      PERIOD_STATUS_COMPANY_ACCESS_DENIED: 'Bu şirket için erişim yetkiniz bulunmuyor.',
      PERIOD_STATUS_UNAVAILABLE: 'Dönem kilit durumu sunucudan alınamadı.',
      REPORTING_PERIOD_NOT_SUPPORTED: 'Bu rapor rotası yalnızca tam takvim ayını destekliyor.',
      REPORTING_CURRENCY_PROFILE_REQUIRED: 'Bu şirket ve dönem için onaylı para birimi profili gerekli.',
      REPORTING_ROUTE_NOT_SUPPORTED: 'Bu sözleşme birleşimi rapor rotasında desteklenmiyor.',
      REPORTING_SOURCE_NOT_READY: 'Doğrulanmış hesaplama kaynağı henüz hazır değil.',
      REPORTING_SOURCE_REQUIRED: 'Bu rapor için doğrulanmış kaynak gerekli.',
      JOURNAL_REQUIRES_CONFIGURATION: 'Şirket için onaylı hesap eşlemesi gerekli.',
      JOURNAL_CURRENCY_PROFILE_REQUIRED: 'Şirket için onaylı para birimi profili gerekli.',
      JOURNAL_ROUTE_NOT_SUPPORTED: 'Bu sözleşme yevmiye önizleme kapsamına alınmamış.',
      JOURNAL_ROUTE_SOURCE_EVIDENCE_NOT_READY: 'Bu işlem için doğrulanmış olay veya sözleşme kaynağı gerekli.',
      JOURNAL_COMPANY_ACCESS_DENIED: 'Bu şirket için yevmiye erişiminiz bulunmuyor.',
      DISCLOSURE_TRUSTED_SOURCE_REQUIRED: 'Bu dönem için doğrulanmış dipnot hesaplama kaydı bulunamadı.',
      DISCLOSURE_ENTITY_PROFILE_REQUIRED: 'Onaylı şirket para birimi profili gerekli.',
      DISCLOSURE_CALCULATION_SOURCE_REQUIRED: 'Dipnot hesaplama kaynağı şu anda hazır değil.',
      DISCLOSURE_DRAFT_PERIOD_LOCKED: 'Seçilen dönem kilitli. Taslak kaydedilemedi.',
      DISCLOSURE_DRAFT_VERSION_CONFLICT: 'Taslak başka bir oturumda değişmiş. Son sürümü yükleyip tekrar deneyin.',
      DISCLOSURE_DRAFT_WRITE_FORBIDDEN: 'Bu kullanıcı rolü dipnot taslağı kaydedemez.',
      CONTRACT_WRITE_ACCESS_DENIED: 'Bu kullanıcı rolü sözleşme yazma yetkisine sahip değil.',
      PERIOD_CLOSED: 'Bu tarihin raporlama dönemi kilitli.',
      COMPANY_ACCESS_DENIED: 'Seçilen şirket için erişim yetkiniz yok.',
      NO_COMPANY_ACCESS: 'Kullanıcının erişebildiği şirket bulunmuyor.',
      MUST_CHANGE_PASSWORD: 'Devam etmeden önce parolanızı değiştirmeniz gerekiyor.'
    };
    return map[error?.code] || error?.message || 'İstek tamamlanamadı. Teknik ayrıntıyı açıp destek ekibine iletin.';
  }

  async function api(path, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set('Accept', 'application/json');
    if (options.body != null && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    if (token() && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token()}`);
    const controller = new AbortController();
    const timer = root.setTimeout(() => controller.abort(), options.timeout || 25000);
    try {
      const response = await root.fetch(`${API_BASE()}${path}`, {
        method: options.method || 'GET', credentials: 'include', headers,
        ...(options.body != null ? { body: JSON.stringify(options.body) } : {}), signal: controller.signal
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || body?.success === false) {
        const error = new Error(body?.error || body?.message || `Sunucu isteği tamamlanamadı (${response.status})`);
        error.status = response.status;
        error.code = body?.code || (response.status === 401 ? 'SESSION_EXPIRED' : 'API_REQUEST_FAILED');
        error.details = body?.details || null;
        throw error;
      }
      return body;
    } catch (error) {
      if (error?.name === 'AbortError') {
        const timeout = new Error('Sunucu isteği zaman aşımına uğradı. Tekrar deneyin.');
        timeout.code = 'REQUEST_TIMEOUT';
        throw timeout;
      }
      throw error;
    } finally { root.clearTimeout(timer); }
  }

  function toast(message, type = 'success') {
    const host = el('toastHost');
    if (!host) return;
    const node = root.document.createElement('div');
    node.className = `toast${type === 'error' ? ' error' : type === 'warning' ? ' warning' : ''}`;
    node.setAttribute('role', type === 'error' ? 'alert' : 'status');
    node.textContent = String(message);
    host.appendChild(node);
    root.setTimeout(() => node.remove(), 4200);
  }

  function showPageError(error, retryAction = 'refresh') {
    const msg = errorMessage(error);
    return `<div class="error-state" role="alert"><h2>Veri yüklenemedi</h2><p>${U.escapeHtml(msg)}</p><button class="button button-primary button-small" data-action="${U.escapeHtml(retryAction)}">Tekrar dene</button><details class="technical-details"><summary>Teknik ayrıntı</summary><code>${U.escapeHtml(error?.code || 'UNKNOWN_ERROR')}</code></details></div>`;
  }

  function escape(value) { return U.escapeHtml(value); }
  function companyName(id) { return state.companies.find(company => String(company.id) === String(id))?.name || String(id || '—'); }
  function normalizeContract(row) {
    let details = row?.details;
    if (typeof details === 'string') { try { details = JSON.parse(details); } catch (_) { details = {}; } }
    if (!details || typeof details !== 'object' || Array.isArray(details)) details = {};
    return {
      ...details, ...row,
      id: String(row?.id ?? ''), companyId: String(row?.companyId ?? row?.company_id ?? ''),
      company: String(row?.company || companyName(row?.companyId ?? row?.company_id)),
      supplier: String(row?.supplier || ''),
      monthlyPayment: Number(row?.monthlyPayment ?? row?.monthly_payment ?? 0),
      startDate: String(row?.startDate ?? row?.start_date ?? '').slice(0, 10),
      endDate: String(row?.endDate ?? row?.end_date ?? '').slice(0, 10),
      discountRate: Number(row?.discountRate ?? row?.discount_rate ?? 0),
      currency: String(row?.currency || 'TRY'), status: String(row?.status || 'active').toLowerCase(),
      paymentFrequency: String(details.paymentFrequency || row?.paymentFrequency || 'monthly'),
      paymentTiming: String(details.paymentTiming || row?.paymentTiming || 'arrears')
    };
  }

  function readableStatus(raw) {
    const map = { active: 'Aktif', draft: 'Taslak', pending: 'Beklemede', terminated: 'Sona erdi', expired: 'Sona erdi', cancelled: 'İptal' };
    return map[String(raw || '').toLowerCase()] || raw || 'Durum bilinmiyor';
  }

  function selectedContracts() {
    return state.contracts.filter(contract => !state.companyId || state.companyId === 'ALL' || contract.companyId === state.companyId);
  }

  function activeContracts() { return selectedContracts().filter(contract => contract.status === 'active'); }
  function periodIntent(companyId = state.companyId) {
    return { companyId, periodStart: state.period.periodStart, periodEnd: state.period.periodEnd, reportingDate: state.period.periodEnd };
  }

  function validatePeriod() {
    const start = el('periodStart')?.value || state.period.periodStart;
    const end = el('periodEnd')?.value || state.period.periodEnd;
    return U.isCalendarMonth(start, end);
  }

  async function loadReporting(companyId = state.companyId) {
    if (!companyId || companyId === 'ALL') throw Object.assign(new Error('Finansal tutarlar için bir şirket seçin.'), { code: 'COMPANY_SELECTION_REQUIRED' });
    if (!validatePeriod()) throw Object.assign(new Error('Rapor rotası tam takvim ayı ister. Başlangıç ve bitiş tarihlerini kontrol edin.'), { code: 'REPORTING_PERIOD_NOT_SUPPORTED' });
    const ui = root.LeaseQantReportingAuthorityUi;
    if (!ui?.load) throw Object.assign(new Error('Güvenilir rapor bağlantısı yüklenemedi.'), { code: 'REPORTING_AUTHORITY_UNAVAILABLE' });
    return ui.load(periodIntent(companyId));
  }

  function metricValue(metric) {
    if (!metric || metric.value == null) return '—';
    return U.formatMoney(metric.value, metric.currency || state.report?.identity?.presentationCurrency || '');
  }

  function metricStatusText(metric) {
    if (!metric) return 'Kaynak gerekli';
    return U.status(metric.status, metric.coverage);
  }

  function header(title, subtitle, actions = '') {
    const current = NAV[state.view] || NAV.overview;
    return `<div class="page-heading"><div><div class="eyebrow">TFRS 16 · Çalışma Alanı</div><h1>${escape(title || current[0])}</h1><p class="page-subtitle">${escape(subtitle || current[1])}</p></div><div class="heading-actions">${actions}</div></div>`;
  }

  function setNav(view, label) {
    const selectedView = view === 'contract' ? 'contracts' : view;
    root.document.querySelectorAll('[data-nav]').forEach(button => {
      const isActive = button.dataset.nav === selectedView;
      if (isActive) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
    });
    el('contextViewLabel').textContent = label || NAV[view]?.[0] || 'Sözleşme';
  }

  function setView(view, { contractId = null, tab = 'summary', push = true } = {}) {
    if (contractId) {
      state.view = 'contract'; state.detailId = String(contractId); state.detailTab = tab;
    } else {
      state.view = NAV[view] ? view : 'overview'; state.detailId = null;
    }
    const url = new URL(root.location.href);
    url.searchParams.delete('contract'); url.searchParams.delete('tab');
    url.searchParams.set('view', state.view === 'contract' ? 'contracts' : state.view);
    if (contractId) { url.searchParams.set('contract', String(contractId)); url.searchParams.set('tab', tab); }
    if (push) root.history.pushState({}, '', url);
    setNav(state.view, contractId ? `Sözleşme · ${contractId}` : undefined);
    void renderCurrent();
  }

  function modal(title, body, onSubmit, submitLabel = 'Kaydet') {
    const host = el('modalHost');
    host.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle"><div class="modal-header"><h2 id="modalTitle">${escape(title)}</h2><button type="button" class="button button-quiet button-small" data-action="close-modal" aria-label="Kapat">Kapat</button></div><div class="modal-body">${body}</div><div class="modal-footer"><button type="button" class="button" data-action="close-modal">İptal</button><button type="button" class="button button-primary" data-action="modal-submit">${escape(submitLabel)}</button></div></div>`;
    host.hidden = false;
    host.querySelector('[data-action="close-modal"]').focus();
    state.modalSubmit = onSubmit;
  }

  function closeModal() { el('modalHost').hidden = true; el('modalHost').replaceChildren(); state.modalSubmit = null; }

  function newContractModal() {
    if (!canWriteContracts()) { toast('Sözleşme yazma yetkisi hesabınızda bulunmuyor.', 'warning'); return; }
    const companies = state.companies.filter(item => item.status !== 'INACTIVE');
    const defaultCompany = state.companyId !== 'ALL' ? state.companyId : String(companies[0]?.id || '');
    const options = companies.map(item => `<option value="${escape(item.id)}"${String(item.id) === defaultCompany ? ' selected' : ''}>${escape(item.name)}</option>`).join('');
    const id = `LQ-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,8).toUpperCase()}`;
    modal('Yeni sözleşme', `<p class="info-alert">Bu form temel sözleşme kaydını oluşturur. Desteklenmeyen ödeme sıklığı, olay veya muhasebe varsayımı eklenmez; kayıt sonrasında sunucu hesaplaması ayrıca çalıştırılır.</p><form id="newContractForm" class="form-grid" novalidate>
      <label class="field"><span>Sözleşme numarası</span><input name="id" value="${escape(id)}" required maxlength="50"></label>
      <label class="field"><span>Şirket</span><select name="companyId" required>${options}</select></label>
      <label class="field"><span>Kiraya veren</span><input name="supplier" required maxlength="150" autocomplete="organization"></label>
      <label class="field"><span>Varlık / kullanım açıklaması</span><input name="description" maxlength="500"></label>
      <label class="field"><span>Ödeme tutarı</span><input name="monthlyPayment" required type="number" inputmode="decimal" min="0.01" step="0.01"></label>
      <label class="field"><span>Para birimi</span><select name="currency"><option>TRY</option><option>USD</option><option>EUR</option><option>GBP</option></select></label>
      <label class="field"><span>Başlangıç tarihi</span><input name="startDate" type="date" required></label>
      <label class="field"><span>Bitiş tarihi</span><input name="endDate" type="date" required></label>
      <label class="field span-2"><span>Yıllık iskonto oranı (%)</span><input name="discountRate" type="number" inputmode="decimal" min="0" max="100" step="0.0001" value="0" required><small>Oranı yüzde olarak girin; ör. 18,5.</small></label>
    </form>`, async () => {
      const form = el('newContractForm');
      if (!form.reportValidity()) return;
      const values = Object.fromEntries(new FormData(form));
      if (!U.isIsoDate(values.startDate) || !U.isIsoDate(values.endDate) || values.startDate > values.endDate) {
        toast('Sözleşme başlangıç ve bitiş tarihlerini kontrol edin.', 'error'); return;
      }
      const company = state.companies.find(item => String(item.id) === values.companyId);
      if (!company) { toast('Şirket seçimi geçersiz.', 'error'); return; }
      const payload = {
        id: String(values.id).trim(), companyId: String(values.companyId), company: company.name,
        supplier: String(values.supplier).trim(), monthlyPayment: Number(values.monthlyPayment),
        startDate: values.startDate, endDate: values.endDate, discountRate: Number(values.discountRate),
        currency: values.currency, details: { description: String(values.description || '').trim(), paymentFrequency: 'monthly', paymentTiming: 'arrears' }
      };
      await api('/api/contracts', { method: 'POST', body: payload });
      closeModal(); await loadContracts();
      toast('Sözleşme sunucuya kaydedildi. Hesaplama için sözleşme ayrıntısını açın.');
      setView('contracts', { contractId: payload.id, tab: 'summary', push: true });
    });
  }

  function canWriteContracts() { return ['ADMIN', 'ACCOUNTANT_MANAGER', 'ACCOUNTANT'].includes(String(state.user?.role || '').toUpperCase()); }

  async function loadContracts() {
    const body = await api('/api/contracts');
    const rows = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : null;
    if (!rows) throw Object.assign(new Error('Sözleşme servisi beklenen listeyi döndürmedi.'), { code: 'CONTRACT_LIST_RESPONSE_INVALID' });
    state.contracts = rows.map(normalizeContract);
    return state.contracts;
  }

  function renderMetricCard(label, metric, note) {
    const text = metricValue(metric);
    const statusHtml = metricStatusText(metric);
    return `<article class="metric-card"><span class="metric-label">${escape(label)}</span><strong class="metric-value" title="${escape(text)}">${escape(text)}</strong><div class="metric-foot">${statusHtml}<span>${escape(note)}</span></div></article>`;
  }

  async function renderOverview(epoch) {
    const host = el('pageHost');
    const contracts = selectedContracts();
    if (state.companyId === 'ALL') {
      host.innerHTML = `${header('Genel Bakış', 'Şirket seçimi olmadan farklı para birimi ve şirket bakiyeleri toplanmaz.', `<button class="button button-primary" data-nav="contracts">Sözleşmelere git</button>`)}
        <div class="kpi-grid">${renderMetricCard('Erişilen şirket', { value: state.companies.length, currency: '', status: 'SUPPORTED' }, 'Yetkili kapsam')}${renderMetricCard('Sözleşme kaydı', { value: contracts.length, currency: '', status: contracts.length ? 'SUPPORTED' : 'ZERO_CONFIRMED' }, 'Erişilen şirketlerde')}${renderMetricCard('Kira yükümlülüğü', null, 'Bir şirket seçin')}${renderMetricCard('Kullanım hakkı varlığı', null, 'Bir şirket seçin')}</div>
        <div class="content-grid"><section class="card"><div class="card-header"><div><h2>Şirket kapsamı</h2><p>Finansal toplamlar her şirket için ayrı kaynak doğrulaması gerektirir.</p></div></div>${state.companies.length ? `<div class="table-scroll"><table class="data-table"><thead><tr><th>Şirket</th><th>Portföy</th><th>Eylem</th></tr></thead><tbody>${state.companies.map(company => {const count=state.contracts.filter(c=>c.companyId===String(company.id)).length;return `<tr><td>${escape(company.name)}</td><td>${count} sözleşme</td><td><button class="button button-small" data-action="select-company" data-company="${escape(company.id)}">Aç</button></td></tr>`;}).join('')}</tbody></table></div>` : `<div class="empty-state"><h3>Erişilebilir şirket yok</h3><p>Şirket erişimini yöneticinizden isteyin.</p></div>`}</section><section class="card"><div class="card-header"><div><h2>Kaynak durumu</h2><p>Desteklenmeyen bakiyeler boş bırakılır.</p></div></div><div class="source-state"><strong>Şirket ve dönem bağlamını seçin</strong><p>Karşılaştırılabilir para birimi ve eksiksiz kapsam kanıtı olmadan konsolide finansal değer gösterilmez.</p></div></section></div>`;
      return;
    }
    host.innerHTML = `${header('Genel Bakış', `${companyName(state.companyId)} · ${U.formatDate(state.period.periodStart)} – ${U.formatDate(state.period.periodEnd)}`, `<button class="button" data-action="export-report" ${state.report ? '' : 'disabled'}>Raporu indir</button><button class="button button-primary" data-nav="contracts">Sözleşmelere git</button>`)}<div id="overviewBody" class="stack"><div class="page-loading"><span class="spinner" aria-hidden="true"></span><span>Doğrulanmış dönem verisi yükleniyor…</span></div></div>`;
    try {
      state.report = await loadReporting();
      if (epoch !== state.renderEpoch) return;
      const p = state.report;
      if (p.identity.companyId !== state.companyId || p.period.reportingDate !== state.period.periodEnd) throw Object.assign(new Error('Rapor şirketi veya dönemi seçilen bağlamla eşleşmiyor.'), { code: 'REPORTING_SOURCE_IDENTITY_INVALID' });
      const totals = p.totals;
      const currency = p.identity.presentationCurrency || '';
      const metrics = ['leaseLiability','rouCarryingAmount','periodInterest','periodDepreciation'];
      const labels = { leaseLiability: 'Kira yükümlülüğü', rouCarryingAmount: 'Kullanım hakkı varlığı', periodInterest: 'Dönem faizi', periodDepreciation: 'Dönem amortismanı' };
      const eligibleRows = p.contracts.filter(row => row.status === 'SUPPORTED');
      const schedule = eligibleRows.flatMap(row => row.scheduleRows || []).filter(row => row.date >= state.period.periodStart && row.date <= state.period.periodEnd);
      const tbody = schedule.slice().sort((a,b)=>String(a.date).localeCompare(String(b.date))).map(row => `<tr><td>${escape(row.contractId)}</td><td>${escape(U.formatDate(String(row.date).slice(0,10)))}</td><td class="numeric-cell">${escape(U.formatMoney(row.payment,row.currency))}</td><td class="numeric-cell">${escape(U.formatMoney(row.interest,row.currency))}</td><td class="numeric-cell">${escape(U.formatMoney(row.closingLiability,row.currency))}</td></tr>`).join('');
      const exclusions = p.population.exclusions?.length ? `<div class="warning-alert">${p.population.exclusions.length} sözleşme kaynağı bu dönemin desteklenen rapor kapsamına girmedi. Toplamlar tamamlanmış kapsam değil.</div>` : '';
      const unsupported = Object.entries(p.unsupported || {}).filter(([,item]) => item.value == null && item.status !== 'NOT_SUPPORTED').slice(0,3);
      el('overviewBody').innerHTML = `<div class="kpi-grid">${metrics.map(key => renderMetricCard(labels[key], totals[key], currency || 'Dönem sunucu raporu')).join('')}
        <article class="metric-card"><span class="metric-label">Aktif sözleşme</span><strong class="metric-value">${p.population.count}</strong><div class="metric-foot">${U.status(p.population.coverage)}<span>${p.population.includedCount} dahil · ${p.population.excludedCount} kaynak bekliyor</span></div></article></div>
        ${exclusions}<div class="content-grid"><section class="card"><div class="card-header"><div><h2>Dönem hareketlerinden doğrulanmış satırlar</h2><p>Gerçek banka ödemesi veya ERP defteri anlamına gelmez.</p></div><span class="status-badge status-info">Sunucu raporu</span></div>${schedule.length ? `<div class="table-scroll"><table class="data-table"><thead><tr><th>Sözleşme</th><th>Tarih</th><th class="numeric-cell">Sözleşme ödemesi</th><th class="numeric-cell">Faiz</th><th class="numeric-cell">Kapanış yükümlülüğü</th></tr></thead><tbody>${tbody}</tbody></table></div>` : `<div class="empty-state"><h3>Bu dönemde doğrulanmış hareket yok</h3><p>Boş liste sıfır bakiyeyi kanıtlamaz. Kaynak durumu: ${escape(p.population.coverage)}.</p></div>`}<p class="source-line">Kaynak: ${escape(p.sourceStatus)} · Kimlik özeti: ${escape(p.contentHash || 'mevcut değil')}</p></section>
          <section class="card"><div class="card-header"><div><h2>Kapanış kontrolleri</h2><p>Kontroller kapanış veya canlı kayıt yetkisi vermez.</p></div></div>${renderControls(p.controls)}<button class="button button-small" data-nav="close">Kontrolleri aç</button><details class="technical-details"><summary>Kaynak gerektiren alanlar</summary><div>${unsupported.length ? unsupported.map(([key,item])=>`<p>${escape(key)} · ${escape(item.status)} · ${escape(item.reason)}</p>`).join('') : '<p>Bu pakette ek kaynak eksiği dönmedi.</p>'}</div></details></section></div>`;
    } catch (error) { if (epoch !== state.renderEpoch) return; state.report = null; el('overviewBody').innerHTML = showPageError(error); }
  }

  function renderControls(controls) {
    if (!controls || !Array.isArray(controls.checks) || !controls.checks.length) {
      return `<div class="source-state"><strong>Kontrol sonucu hazır değil</strong><p>Kontrol listesi için rapor rotasının desteklenen, eksiksiz kapsamda olması gerekir.</p>${U.status(controls?.status || 'NOT_READY')}</div>`;
    }
    return `<div class="close-list">${controls.checks.map(check => `<div class="close-check"><span class="close-check-mark" aria-hidden="true">${check.status === 'PASS' ? '✓' : '!'}</span><p><strong>${escape(check.name || check.code || 'Kontrol')}</strong><br><span class="muted">${escape(check.message || check.status || 'Durum belirtilmedi')}</span></p>${U.status(check.status)}</div>`).join('')}</div><p class="source-line">${escape(controls.status)} · Kapanış yetkisi: hayır</p>`;
  }

  function renderContracts() {
    const writeButton = canWriteContracts() ? '<button class="button button-primary" data-action="new-contract">Yeni sözleşme</button>' : '<button class="button button-primary" disabled title="Sözleşme yazma yetkisi gerekli">Yeni sözleşme</button>';
    const rows = filteredContracts();
    const pageCount = Math.max(1, Math.ceil(rows.length / state.pageSize));
    state.page = Math.min(state.page, pageCount);
    const pageRows = rows.slice((state.page - 1) * state.pageSize, state.page * state.pageSize);
    const tbody = pageRows.map(c => `<tr class="is-clickable" tabindex="0" data-action="open-contract" data-contract="${escape(c.id)}" aria-label="${escape(c.id)} sözleşme ayrıntısını aç"><td><a class="contract-link" href="workspace.html?view=contracts&amp;contract=${encodeURIComponent(c.id)}">${escape(c.id)}</a></td><td>${escape(c.supplier || '—')}</td><td>${escape(companyName(c.companyId))}</td><td>${escape(c.assetClass || c.details?.assetClass || '—')}</td><td>${escape(U.formatDate(c.endDate))}</td><td class="numeric-cell">${escape(U.formatMoney(c.monthlyPayment,c.currency))}</td><td>${U.status(c.status === 'active' ? 'SUPPORTED' : 'NOT_READY', readableStatus(c.status))}</td><td><button class="button button-small" data-action="contract-menu" data-contract="${escape(c.id)}">Aç</button></td></tr>`).join('');
    el('pageHost').innerHTML = `${header('Sözleşmeler', `${rows.length} kayıt · ${companyName(state.companyId === 'ALL' ? '' : state.companyId)}`, `${writeButton}<button class="button" data-action="export-contracts">Dışa aktar</button>`)}
      <section class="card"><div class="toolbar"><label class="search-field"><span class="sr-only">Sözleşme ara</span><input id="contractSearch" type="search" value="${escape(state.filter)}" placeholder="Sözleşme no, kiraya veren veya açıklama ara" autocomplete="off"></label><select id="contractStatus" aria-label="Sözleşme durumu"><option value="ALL">Tüm durumlar</option><option value="active">Aktif</option><option value="draft">Taslak</option><option value="expired">Sona erdi</option></select><button class="button button-small" data-action="clear-contract-filters">Filtreleri temizle</button></div>
      ${rows.length ? `<div class="table-scroll"><table class="data-table"><thead><tr><th>Sözleşme no</th><th>Kiraya veren</th><th>Şirket</th><th>Varlık</th><th>Bitiş</th><th class="numeric-cell">Sözleşme ödemesi</th><th>Durum</th><th>Eylem</th></tr></thead><tbody>${tbody}</tbody></table></div><div class="pagination"><span>${rows.length} sonuç · sayfa ${state.page} / ${pageCount}</span><div class="pagination-controls"><button class="button button-small" data-action="page-prev" ${state.page <= 1 ? 'disabled' : ''}>Önceki</button><button class="button button-small" data-action="page-next" ${state.page >= pageCount ? 'disabled' : ''}>Sonraki</button><label>Satır <select id="pageSize"><option${state.pageSize===25?' selected':''}>25</option><option${state.pageSize===50?' selected':''}>50</option><option${state.pageSize===100?' selected':''}>100</option></select></label></div></div>` : `<div class="empty-state"><h3>${state.filter ? 'Aramayla eşleşen sözleşme yok' : 'Henüz sözleşme yok'}</h3><p>${state.filter ? 'Arama veya filtreleri temizleyip tekrar deneyin.' : 'Erişim yetkiniz olan şirkette bir sözleşme kaydı oluşturun.'}</p>${writeButton}</div>`}</section>`;
    el('contractStatus').value = state.contractStatus;
  }

  function filteredContracts() {
    const term = state.filter.trim().toLocaleLowerCase('tr-TR');
    return selectedContracts().filter(c => (state.contractStatus === 'ALL' || c.status === state.contractStatus)
      && (!term || [c.id,c.supplier,c.company,c.details?.description,c.assetClass].some(value => String(value || '').toLocaleLowerCase('tr-TR').includes(term))))
      .sort((a,b)=>String(a.id).localeCompare(String(b.id),'tr'));
  }

  async function renderCalculations(epoch) {
    el('pageHost').innerHTML = `${header('Hesaplamalar', 'Dönem raporu yalnızca backend’in desteklediği ve kaynakları doğrulanmış kapsamı gösterir.', '<button class="button" data-action="export-report" disabled>Raporu indir</button><button class="button button-primary" data-action="refresh">Raporu yenile</button>')}<div id="calculationBody" class="stack"><div class="page-loading"><span class="spinner" aria-hidden="true"></span><span>Rapor kaynağı doğrulanıyor…</span></div></div>`;
    try {
      const p = await loadReporting(); if (epoch !== state.renderEpoch) return; state.report = p;
      const metricRows = Object.entries(p.totals).map(([key,item]) => `<tr><td>${escape(labelMetric(key))}</td><td class="numeric-cell">${escape(metricValue(item))}</td><td>${U.status(item.status,item.coverage)}</td><td>${escape((item.sourceIds || []).length ? `${item.sourceIds.length} kaynak` : 'Kaynak yok')}</td></tr>`).join('');
      const contractRows = p.contracts.map(row => `<tr><td>${escape(row.contractId)}</td><td>${escape(row.supplier || '—')}</td><td>${U.status(row.status,row.reason)}</td><td>${escape(row.status === 'SUPPORTED' ? row.route : errorMessage({code:row.reason}))}</td><td class="numeric-cell">${escape(row.metrics?.leaseLiability ? U.formatMoney(row.metrics.leaseLiability.value,row.metrics.leaseLiability.currency) : '—')}</td><td><button class="button button-small" data-action="open-contract" data-contract="${escape(row.contractId)}">Sözleşmeyi aç</button></td></tr>`).join('');
      el('calculationBody').innerHTML = `<div class="info-alert">Kaynak rotası: ${escape(p.policyIdentity)} · Kapsam: ${escape(p.population.coverage)} · Rapor tarihi: ${escape(U.formatDate(p.period.reportingDate))}</div><div class="grid kpi-grid">${['leaseLiability','rouCarryingAmount','currentLiability','periodInterest'].map(key=>renderMetricCard(labelMetric(key),p.totals[key],p.identity.presentationCurrency||'')).join('')}</div><div class="content-grid"><section class="card"><div class="card-header"><div><h2>Rapor kalemleri</h2><p>Sunucu kaynak kimlikleri korunmuştur.</p></div></div><div class="table-scroll"><table class="metric-table"><thead><tr><th>Kalem</th><th class="numeric-cell">Tutar</th><th>Durum</th><th>Kaynak</th></tr></thead><tbody>${metricRows}</tbody></table></div></section><section class="card"><div class="card-header"><div><h2>Kontroller</h2><p>Tanılama sonucu; kayıt yetkisi vermez.</p></div></div>${renderControls(p.controls)}<details class="technical-details"><summary>Rapor kanıtı</summary><pre>${escape(JSON.stringify({identity:p.identity,period:p.period,population:p.population,contentHash:p.contentHash},null,2))}</pre></details></section></div><section class="card"><div class="card-header"><div><h2>Sözleşme kapsamı</h2><p>${p.population.includedCount} desteklenen · ${p.population.excludedCount} kaynak bekleyen</p></div></div>${p.contracts.length ? `<div class="table-scroll"><table class="data-table"><thead><tr><th>Sözleşme</th><th>Kiraya veren</th><th>Kaynak</th><th>Rota / neden</th><th class="numeric-cell">Yükümlülük</th><th></th></tr></thead><tbody>${contractRows}</tbody></table></div>` : `<div class="empty-state"><h3>Bu şirkette etkin sözleşme yok</h3><p>Bu kapsamda hesaplama verisi gösterilmedi.</p></div>`}</section>`;
    } catch (error) { if (epoch !== state.renderEpoch) return; state.report = null; el('calculationBody').innerHTML = showPageError(error); }
  }

  function labelMetric(key) {
    const map = { rouCarryingAmount:'Kullanım hakkı varlığı', leaseLiability:'Kira yükümlülüğü', currentLiability:'Kısa vadeli kira yükümlülüğü', nonCurrentLiability:'Uzun vadeli kira yükümlülüğü', periodInterest:'Dönem faizi', periodDepreciation:'Dönem amortismanı', contractualPayments:'Sözleşmesel ödemeler', next12MonthPayments:'Gelecek 12 aylık ödemeler', next12MonthPrincipal:'Gelecek 12 aylık anapara', next12MonthInterest:'Gelecek 12 aylık faiz', openingROU:'Dönem başı kullanım hakkı varlığı', openingLiability:'Dönem başı kira yükümlülüğü' };
    return map[key] || key;
  }

  function renderJournalForm() {
    const contracts = activeContracts();
    const options = contracts.map(c=>`<option value="${escape(c.id)}">${escape(c.id)} · ${escape(c.supplier)}</option>`).join('');
    el('pageHost').innerHTML = `${header('Yevmiye önizlemesi', 'Sunucu kaynağı, onaylı hesap eşlemesi ve şirket profili doğrulanır. Önizleme canlı deftere yazmaz.')}
      <section class="card"><div class="toolbar"><label class="field"><span>Şirket sözleşmesi</span><select id="journalContract" ${contracts.length ? '' : 'disabled'}>${options || '<option>Aktif sözleşme yok</option>'}</select></label><label class="field"><span>Fiş türü</span><select id="journalKind"><option value="PERIOD">Dönem hareketi</option><option value="INITIAL">İlk kayıt</option><option value="RECLASSIFICATION">Kısa / uzun vade sınıflaması</option></select></label><button class="button button-primary" data-action="journal-preview" ${contracts.length ? '' : 'disabled'}>Önizleme oluştur</button></div><p class="warning-alert">Bu ekranda ERP aktarımı veya canlı yevmiye kaydı yoktur. Desteklenmeyen rota, eksik hesap eşlemesi veya kanıt gelirse önizleme oluşturulmaz.</p><div id="journalOutput"><div class="empty-state"><h3>Önizleme bekleniyor</h3><p>Sözleşme ve fiş türünü seçip sunucu önizlemesini başlatın.</p></div></div></section>`;
  }

  async function createJournalPreview() {
    const contractId = el('journalContract')?.value;
    const contract = state.contracts.find(item => item.id === contractId);
    if (!contract) throw Object.assign(new Error('Sözleşme seçimi geçersiz.'), { code: 'JOURNAL_CONTRACT_NOT_READY' });
    if (!state.companyId || state.companyId === 'ALL' || contract.companyId !== state.companyId) throw Object.assign(new Error('Yevmiye için aynı şirket bağlamında tek sözleşme seçin.'), { code: 'JOURNAL_COMPANY_ACCESS_DENIED' });
    const kind = el('journalKind').value;
    const intent = { companyId: state.companyId, contractIds:[contract.id], kind,
      periodStart:state.period.periodStart, periodEnd:state.period.periodEnd };
    const out = el('journalOutput'); out.innerHTML = '<div class="page-loading"><span class="spinner" aria-hidden="true"></span><span>Onaylı yevmiye kaynağı doğrulanıyor…</span></div>';
    try {
      const data = await root.LeaseQantPrivateCalculation.getJournalAuthorityPackage(intent, false);
      if (data.companyId !== intent.companyId || data.kind !== intent.kind || data.periodStart !== intent.periodStart || data.periodEnd !== intent.periodEnd || data.contractIds?.length !== 1 || String(data.contractIds[0]) !== contract.id) throw Object.assign(new Error('Yevmiye yanıtı seçilen şirket, sözleşme veya dönemle eşleşmiyor.'), { code: 'JOURNAL_RESPONSE_IDENTITY_INVALID' });
      state.journal = data;
      const voucher = data.vouchers?.[0];
      if (!voucher || voucher.balanced !== true || Math.abs(Number(voucher.difference)) >= 0.01) throw Object.assign(new Error('Sunucu fiş toplamlarını dengeleyemedi; önizleme kapatıldı.'), { code: 'JOURNAL_SOURCE_UNBALANCED' });
      const lines = voucher.lines.map(line=>`<tr><td>${escape(line.accountCode)}</td><td>${escape(line.accountName)}</td><td>${escape(line.accountPurpose)}</td><td>${escape(U.formatDate(line.postingDate))}</td><td class="numeric-cell">${escape(U.formatMoney(line.debit,voucher.currency))}</td><td class="numeric-cell">${escape(U.formatMoney(line.credit,voucher.currency))}</td></tr>`).join('');
      out.innerHTML = `<div class="grid kpi-grid"><article class="metric-card"><span class="metric-label">Fiş</span><strong class="metric-value" style="font-size:18px">${escape(voucher.voucherNo)}</strong><div class="metric-foot">Geçici önizleme numarası</div></article><article class="metric-card"><span class="metric-label">Toplam borç</span><strong class="metric-value">${escape(U.formatMoney(voucher.totalDebit,voucher.currency))}</strong><div class="metric-foot">Sunucu hesaplaması</div></article><article class="metric-card"><span class="metric-label">Toplam alacak</span><strong class="metric-value">${escape(U.formatMoney(voucher.totalCredit,voucher.currency))}</strong><div class="metric-foot">Sunucu hesaplaması</div></article><article class="metric-card"><span class="metric-label">Denge</span><strong class="metric-value">${escape(U.formatMoney(voucher.difference,voucher.currency))}</strong><div class="metric-foot">${U.status(voucher.balanced ? 'SUPPORTED' : 'FAILED_VALIDATION')}</div></article></div><div class="warning-alert">${escape(voucher.livePostingStatus || data.livePostingStatus || 'NOT_READY_FOR_LIVE_POSTING')} · Canlı muhasebe aktarımı kapalı.</div><div class="table-scroll"><table class="data-table"><thead><tr><th>Hesap</th><th>Hesap adı</th><th>Amaç</th><th>Tarih</th><th class="numeric-cell">Borç (${escape(voucher.currency)})</th><th class="numeric-cell">Alacak (${escape(voucher.currency)})</th></tr></thead><tbody>${lines}</tbody></table></div><p class="source-line">Kaynak özeti: ${escape(voucher.sourceResultHash)} · Eşleme: ${escape(voucher.accountMappingVersion)} · ${escape(voucher.supportStatus)}</p><div class="heading-actions"><button class="button button-small" data-action="journal-csv">Önizlemeyi CSV indir</button><details class="technical-details"><summary>Teknik kaynak ayrıntısı</summary><pre>${escape(JSON.stringify({calculationId:voucher.calculationId,sourceInputHash:voucher.sourceInputHash,accountingSourceHash:voucher.accountingSourceHash,numberingStatus:voucher.numberingStatus},null,2))}</pre></details></div>`;
    } catch (error) { state.journal = null; out.innerHTML = showPageError(error); }
  }

  function downloadCsv(rows, filename) {
    if (!Array.isArray(rows) || !rows.length) { toast('İndirilecek doğrulanmış satır bulunmuyor.', 'warning'); return; }
    const keys = Object.keys(rows[0]);
    const cell = value => `"${String(value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : value).replace(/"/g,'""')}"`;
    const text = [keys.map(cell).join(';'), ...rows.map(row=>keys.map(key=>cell(row[key])).join(';'))].join('\r\n');
    const blob = new Blob(['\ufeff',text],{type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob); const link = root.document.createElement('a');
    link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
  }

  async function renderDisclosures(epoch) {
    const companyId = state.companyId;
    const periodStart = state.period.periodStart;
    const periodEnd = state.period.periodEnd;
    const isCurrent = () => epoch === state.renderEpoch && companyId === state.companyId
      && periodStart === state.period.periodStart && periodEnd === state.period.periodEnd;
    state.drafts = null;
    state.expectedDraftVersion = 0;
    state.draftSections = {};
    el('pageHost').innerHTML = `${header('Dipnotlar', 'Sayılar doğrulanmış dipnot paketinden, anlatı metni ise kullanıcının sürümlü taslağından gelir.', '<button class="button" data-action="print-disclosure">Önizle / Yazdır</button><button class="button button-primary" data-action="save-draft" disabled title="Taslak ve dönem durumu doğrulanıyor">Taslağı kaydet</button>')}<div id="disclosureBody" class="stack"><div class="page-loading"><span class="spinner" aria-hidden="true"></span><span>Dipnot kaynakları doğrulanıyor…</span></div></div>`;
    const body = el('disclosureBody');
    try {
      const intent = periodIntent();
      if (!state.companyId || state.companyId === 'ALL') throw Object.assign(new Error('Dipnotlar için tek şirket seçin.'), { code: 'COMPANY_SELECTION_REQUIRED' });
      const disclosureIntent = { companyId, reportingPeriodStart: periodStart, reportingPeriodEnd: periodEnd, reportingDate: periodEnd };
      const availability = await root.LeaseQantPrivateCalculation.getLeaseDisclosureAvailability(disclosureIntent);
      if (!isCurrent()) return;
      let draftLoadError = null;
      try {
        const drafts = await api('/api/reports/lease-disclosure/drafts?' + new URLSearchParams({ companyId:intent.companyId, periodStart:intent.periodStart, periodEnd:intent.periodEnd }));
        state.drafts = drafts.data;
      } catch (error) { draftLoadError = error; state.drafts = null; }
      if (!isCurrent()) return;
      state.expectedDraftVersion = Number(state.drafts?.currentVersion || 0);
      const currentDraft = state.drafts?.versions?.[0];
      state.draftSections = currentDraft?.sections || {};
      let pkg = null; let packageError = null;
      try { pkg = await root.LeaseQantPrivateCalculation.getLeaseDisclosure(availability); }
      catch (error) { packageError = error; }
      if (!isCurrent()) return;
      state.disclosure = pkg;
      const packageStatus = pkg?.validation?.status;
      const tableRows = pkg?.tabularDisclosure?.rows || [];
      const tbody = tableRows.map(row=>`<tr><td>${escape(row.lineItem || row.fieldId)}</td><td class="numeric-cell">${escape(row.amount == null ? '—' : U.formatMoney(row.amount,row.currency))}</td><td>${U.status(row.status)}</td></tr>`).join('');
      const versionButtons = (state.drafts?.versions || []).map((item,index)=>`<button type="button" class="version-item" data-action="load-draft-version" data-version-index="${index}" aria-current="${index===0?'true':'false'}">v${item.version} · ${escape(U.formatDate(String(item.createdAt).slice(0,10)))}</button>`).join('');
      const writeable = canWriteContracts() && state.periodStatus?.status === 'OPEN' && Boolean(state.drafts) && !state.savingDraft;
      const editor = Object.entries(SECTION_TITLES).map(([id,title])=>`<section class="narrative-section" id="note-${escape(id)}"><label class="field"><span><strong>${escape(id)} · ${escape(title)}</strong></span><textarea data-narrative="${escape(id)}" maxlength="5000" ${writeable?'':'disabled'} placeholder="Bu bölüm için şirket tarafından onaylanmış anlatıyı yazın.">${escape(state.draftSections[id] || '')}</textarea><small>Kullanıcı metni · onaylanmış muhasebe tutarı değildir</small></label></section>`).join('');
      body.innerHTML = `<div class="info-alert">Şirket: ${escape(companyName(state.companyId))} · ${escape(U.formatDate(intent.periodStart))} – ${escape(U.formatDate(intent.periodEnd))} · Para birimi: ${escape(pkg?.period?.presentationCurrency || availability.currencyProfile?.presentationCurrency || 'kaynak gerekli')}</div>${state.periodStatus?.status==='LOCKED'?'<div class="warning-alert">Bu dönem kilitli. Anlatı taslağı salt okunur.</div>':state.periodStatus?.status!=='OPEN'?'<div class="warning-alert">Dönem kilit durumu doğrulanamadı; taslak düzenleme kapalı.</div>':''}${draftLoadError?`<div class="warning-alert">Anlatı taslağı servisi hazır değil. Sayısal dipnot görüntülenebilir, ancak metin kaydedilemez. ${escape(errorMessage(draftLoadError))}</div>`:''}
        <div class="drawer-layout"><aside class="card"><div class="card-header"><div><h2>Belge anahattı</h2><p>TFRS 16 — Kiralama İşlemleri</p></div></div><nav class="audit-list" aria-label="Dipnot bölümleri">${Object.entries(SECTION_TITLES).map(([id,title])=>`<a href="#note-${id}" class="contract-link">${escape(id)} ${escape(title)}</a>`).join('')}</nav><div class="source-line">Durum: ${U.status(state.drafts?.status || 'UNAVAILABLE')} · Sürüm ${state.drafts?.currentVersion || 0}</div><div class="version-list">${versionButtons}</div></aside>
        <div class="stack"><section class="card"><div class="card-header"><div><h2>Doğrulanmış sayısal kaynak</h2><p>Kaynak paketinin tutarları bu ekrandan değiştirilemez.</p></div>${U.status(packageStatus || (packageError?.code === 'DISCLOSURE_TRUSTED_SOURCE_REQUIRED' ? 'NOT_READY' : 'UNAVAILABLE'))}</div>${pkg ? `<div class="table-scroll"><table class="data-table"><thead><tr><th>Dipnot kalemi</th><th class="numeric-cell">Tutar</th><th>Kaynak durumu</th></tr></thead><tbody>${tbody}</tbody></table></div><p class="source-line">Paket: ${escape(pkg.identity.disclosureId)} · Paket özeti: ${escape(pkg.provenance?.sourceCalculations?.map(x=>x.sourceResultHash).join(', ') || 'kaynak özeti yok')}</p><details class="technical-details"><summary>Kaynak ve mutabakat</summary><pre>${escape(JSON.stringify({validation:pkg.validation,reconciliation:pkg.reconciliation,missingInputs:pkg.missingInputs,provenance:pkg.provenance},null,2))}</pre></details>` : `<div class="source-state"><strong>${escape(errorMessage(packageError))}</strong><p>Doğrulanmış kaynak olmadan sayısal dipnot gösterilmez. Sözleşme kaydı tek başına dipnot kanıtı değildir.</p>${availability.sourceTrustStatus==='TRUSTED_SOURCE_IDENTIFIERS_VERIFIED' ? '<button class="button button-small" data-action="refresh-disclosure">Kaynağı yeniden getir</button>' : '<button class="button button-small" data-action="create-trusted-sources">Desteklenen sözleşmeler için kaynak oluştur</button>'}</div>`}</section>
          <section class="card" id="disclosureNarrative"><div class="card-header"><div><h2>Anlatı taslağı</h2><p>Bu metin sürümlenir; sayısal paket, kaynak imzası veya onay durumu değiştirilmez.</p></div><span class="status-badge status-info">Taslak v${state.drafts?.currentVersion || 0}</span></div><div class="version-list">${versionButtons || '<span class="muted">Henüz kayıtlı sürüm yok</span>'}</div>${editor}<p class="source-line">${writeable?'Değişiklikleri kaydetmek yeni ve değiştirilemez bir taslak sürümü oluşturur.':state.periodStatus?.status==='OPEN'?'Düzenleme için yazma rolü ve taslak servisi gerekir.':'Düzenleme için doğrulanmış açık dönem gerekir.'} Taslak onaylanmış finansal tablo veya yayımlanmış dipnot değildir.</p></section></div></div>`;
      const saveButton = root.document.querySelector('[data-action="save-draft"]');
      if (saveButton) saveButton.disabled = !writeable;
    } catch (error) { if (!isCurrent()) return; state.disclosure = null; body.innerHTML = showPageError(error); }
  }

  async function saveDisclosureDraft() {
    if (!canWriteContracts() || state.periodStatus?.status !== 'OPEN') throw Object.assign(new Error('Bu kullanıcı veya dönem için taslak kaydedilemez.'), { code: state.periodStatus?.status === 'LOCKED' ? 'DISCLOSURE_DRAFT_PERIOD_LOCKED' : 'DISCLOSURE_DRAFT_WRITE_FORBIDDEN' });
    const companyId = state.companyId;
    const periodStart = state.period.periodStart;
    const periodEnd = state.period.periodEnd;
    const sections = {};
    root.document.querySelectorAll('[data-narrative]').forEach(field => { sections[field.dataset.narrative] = field.value; });
    state.savingDraft = true;
    const button = root.document.querySelector('[data-action="save-draft"]'); if (button) { button.disabled=true; button.textContent='Kaydediliyor…'; }
    try {
      const result = await api('/api/reports/lease-disclosure/drafts', { method:'POST', body:{ companyId,
        periodStart, periodEnd, expectedVersion:state.expectedDraftVersion, sections } });
      if (companyId === state.companyId && periodStart === state.period.periodStart && periodEnd === state.period.periodEnd) {
        state.expectedDraftVersion = result.data.version;
      }
      toast(`Dipnot taslağı v${result.data.version} olarak kaydedildi.`);
    } catch (error) { toast(errorMessage(error), 'error'); }
    finally { state.savingDraft = false; }
    await renderCurrent();
  }

  async function createTrustedSources() {
    if (!root.LeaseQantPrivateTfrs16Facade?.createTrustedDisclosureSnapshots) throw Object.assign(new Error('Güvenilir hesaplama kaynağı servisi hazır değil.'), { code: 'DISCLOSURE_CALCULATION_SOURCE_REQUIRED' });
    const contracts = activeContracts().filter(c => c.startDate <= state.period.periodEnd && c.endDate >= state.period.periodStart);
    if (!contracts.length) throw Object.assign(new Error('Bu dönemde doğrulanmış hesaplama kaynağı üretilebilecek aktif sözleşme yok.'), { code: 'DISCLOSURE_POPULATION_UNAVAILABLE' });
    const accepted = root.confirm(`${contracts.length} sözleşme için sunucuda güvenilir hesaplama çalıştırması ve dipnot kaynak kaydı oluşturulacak. Bu işlem deftere kayıt yapmaz. Devam edilsin mi?`);
    if (!accepted) return;
    const result = await root.LeaseQantPrivateTfrs16Facade.createTrustedDisclosureSnapshots(contracts.map(c=>c.id), {
      reportingPeriodStart: state.period.periodStart, reportingPeriodEnd: state.period.periodEnd,
      reportingDate: state.period.periodEnd
    });
    const succeeded = result.filter(item=>item.success).length;
    toast(`${succeeded}/${result.length} güvenilir kaynak üretildi. Başarısız satırlar yeniden incelenmeli.`, succeeded===result.length?'success':'warning');
    await renderCurrent();
  }

  async function renderClose(epoch) {
    el('pageHost').innerHTML = `${header('Kapanış', 'Kaynak kontrolleri ve dönem kilidi görünümü. Bu ekran dönem kapatmaz, yevmiye kaydetmez.', '<button class="button button-primary" data-action="refresh">Kontrolleri yenile</button>')}<div id="closeBody" class="stack"><div class="page-loading"><span class="spinner" aria-hidden="true"></span><span>Kapanış kontrolleri yükleniyor…</span></div></div>`;
    try {
      const p = await loadReporting(); if (epoch !== state.renderEpoch) return; state.report = p;
      const keys = Object.entries(p.unsupported || {}).map(([key,value])=>({key,...value}));
      el('closeBody').innerHTML = `<div class="info-alert">Dönem durumu ${U.status(state.periodStatus?.status || 'UNAVAILABLE')} · ${escape(state.periodStatus?.periodKey || state.period.periodEnd.slice(0,7))}</div><div class="grid content-grid"><section class="card"><div class="card-header"><div><h2>Hesaplama kontrolleri</h2><p>Bu kontroller finansal kayıt onayı değildir.</p></div>${U.status(p.controls?.status)}</div>${renderControls(p.controls)}<p class="source-line">Kaynak: ${escape(p.sourceStatus)} · Kapanış yetkisi: ${p.controls?.closeApprovalAuthorized ? 'sunucu tarafından verilmedi' : 'hayır'}</p></section><section class="card"><div class="card-header"><div><h2>Kaynak gerektiren kapsam</h2><p>Görünür uyarı; sayı veya sıfır varsayımı yapılmaz.</p></div></div><div class="close-list">${keys.map(item=>`<div class="close-check"><span class="close-check-mark">!</span><p><strong>${escape(labelMetric(item.key))}</strong><br><span class="muted">${escape(item.reason)}</span></p>${U.status(item.status)}</div>`).join('')}</div></section></div><section class="card"><div class="card-header"><div><h2>Dönem kapsamı</h2><p>${escape(p.population.count)} etkin sözleşme · ${escape(p.population.includedCount)} dahil · ${escape(p.population.excludedCount)} kaynak bekliyor</p></div></div><div class="warning-alert">Kapanış işlemi için ayrıca yetkili kullanıcı akışı gerekir. Bu arayüzden dönem kapatma veya yeniden açma çağrısı yapılmaz.</div></section>`;
    } catch (error) { if (epoch !== state.renderEpoch) return; state.report = null; el('closeBody').innerHTML = showPageError(error); }
  }

  async function renderContractDetail(epoch) {
    const host = el('pageHost');
    host.innerHTML = `${header('Sözleşme', 'Güvenli sözleşme kaydı yükleniyor…', '<button class="button" data-nav="contracts">Sözleşme listesine dön</button>')}<div class="page-loading"><span class="spinner" aria-hidden="true"></span><span>Sunucu kaydı alınıyor…</span></div>`;
    try {
      const raw = await api(`/api/contracts/${encodeURIComponent(state.detailId)}`);
      if (epoch !== state.renderEpoch) return;
      const contract = normalizeContract(raw?.data || raw);
      if (!contract.id || contract.id !== state.detailId) throw Object.assign(new Error('Sunucu sözleşme yanıtı kimlikle eşleşmiyor.'), { code: 'CONTRACT_RESPONSE_IDENTITY_INVALID' });
      state.detailContract = contract;
      const tabs = [['summary','Özet'],['schedule','Ödeme planı'],['calculation','Hesaplama'],['journal','Yevmiye önizleme'],['audit','Denetim izi']];
      host.innerHTML = `${header(contract.id, `${contract.supplier || 'Kiraya veren'} · ${companyName(contract.companyId)}`, `<button class="button" data-action="calculate-contract">Sunucuda hesapla</button>`)}<section class="card"><div class="tabs" role="tablist" aria-label="Sözleşme ayrıntıları">${tabs.map(([id,label])=>`<button type="button" class="tab-button" role="tab" aria-selected="${state.detailTab===id}" data-action="detail-tab" data-tab="${id}">${label}</button>`).join('')}</div><div id="detailContent">${renderDetailTab(contract)}</div></section>`;
      if (state.detailTab === 'schedule' || state.detailTab === 'calculation') await loadContractCalculation(contract);
      else if (state.detailTab === 'audit') await loadContractAudit(contract);
      else if (state.detailTab === 'journal') renderDetailJournal(contract);
    } catch (error) { if (epoch !== state.renderEpoch) return; host.innerHTML = `${header('Sözleşme', 'Sözleşme kaydı güvenli biçimde alınamadı.')} ${showPageError(error)}`; }
  }

  function renderDetailTab(contract) {
    if (state.detailTab === 'summary') return `<div class="detail-grid"><div class="detail-facts">${[
      ['Şirket',companyName(contract.companyId)],['Kiraya veren',contract.supplier],['Sözleşme durumu',readableStatus(contract.status)],['Para birimi',contract.currency],['Başlangıç',U.formatDate(contract.startDate)],['Bitiş',U.formatDate(contract.endDate)],['Sözleşme ödemesi',U.formatMoney(contract.monthlyPayment,contract.currency)],['İskonto oranı',`${U.formatMoney(contract.discountRate,'%',{minimumFractionDigits:2,maximumFractionDigits:4})}`],['Ödeme sıklığı',contract.paymentFrequency],['Ödeme zamanı',contract.paymentTiming]
      ].map(([label,value])=>`<dl class="fact"><dt>${escape(label)}</dt><dd>${escape(value || '—')}</dd></dl>`).join('')}</div><aside class="card"><div class="card-header"><div><h2>Kaynak notu</h2><p>Veri doğrudan saklanan sözleşmeden.</p></div></div><p class="muted">İlk kayıt ve dönem bakiyeleri hesaplama çağrısı yapılana kadar gösterilmez. Sözleşme ödeme tutarı, gerçekleşen ödeme kanıtı değildir.</p><button class="button button-primary" data-action="calculate-contract">Hesaplamayı sunucuda çalıştır</button></aside></div>`;
    if (state.detailTab === 'schedule' || state.detailTab === 'calculation') return `<div id="detailCalculationOutput" class="page-loading"><span class="spinner" aria-hidden="true"></span><span>Hesaplama sunucudan bekleniyor…</span></div>`;
    if (state.detailTab === 'journal') return `<div id="detailJournalOutput"><div class="empty-state"><h3>Fiş önizlemesi oluşturun</h3><p>Yevmiye önizlemesi onaylı hesap eşlemesi ve şirket profili gerektirir; deftere kayıt yapmaz.</p><button class="button button-primary" data-action="detail-journal-preview">Önizleme oluştur</button></div></div>`;
    return `<div id="detailAuditOutput" class="page-loading"><span class="spinner" aria-hidden="true"></span><span>Denetim kayıtları yükleniyor…</span></div>`;
  }

  function displaySchedule(data) {
    if (!Array.isArray(data?.schedule) || !data.schedule.length) return `<div class="empty-state"><h3>Hesaplama planı bulunamadı</h3><p>Sunucu bir plan üretmediyse tarayıcıda hesap yapılmaz.</p></div>`;
    const rows = data.schedule.map(row=>`<tr><td>${escape(U.formatDate(String(row.date || row.paymentDate || '').slice(0,10)))}</td><td class="numeric-cell">${escape(U.formatMoney(row.payment,data.currency || state.detailContract.currency))}</td><td class="numeric-cell">${escape(U.formatMoney(row.interest,data.currency || state.detailContract.currency))}</td><td class="numeric-cell">${escape(U.formatMoney(row.principal,data.currency || state.detailContract.currency))}</td><td class="numeric-cell">${escape(U.formatMoney(row.closingLiability,data.currency || state.detailContract.currency))}</td><td class="numeric-cell">${escape(U.formatMoney(row.depreciation,data.currency || state.detailContract.currency))}</td></tr>`).join('');
    return `<div class="info-alert">Kaynak: sunucu hesaplama servisi · Önizleme, kaydedilmiş veya deftere aktarılmış kayıt değildir.</div><div class="grid kpi-grid">${[['Başlangıç yükümlülüğü',data.liability],['Kullanım hakkı varlığı',data.rouAssets],['Aylık faiz',data.monthlyInterest],['Aylık amortisman',data.depreciation]].map(([label,value])=>`<article class="metric-card"><span class="metric-label">${escape(label)}</span><strong class="metric-value">${escape(U.formatMoney(value,data.currency || state.detailContract.currency))}</strong><div class="metric-foot">Sunucu yanıtı</div></article>`).join('')}</div><div class="table-scroll"><table class="data-table"><thead><tr><th>Ödeme tarihi</th><th class="numeric-cell">Ödeme</th><th class="numeric-cell">Faiz</th><th class="numeric-cell">Anapara</th><th class="numeric-cell">Kapanış yükümlülüğü</th><th class="numeric-cell">Amortisman</th></tr></thead><tbody>${rows}</tbody></table></div><details class="technical-details"><summary>Kaynak ve varsayımlar</summary><pre>${escape(JSON.stringify({assumptions:data.assumptions,route:data.route,source:data.source,periodEffects:data.periodEffectsVersion},null,2))}</pre></details>`;
  }

  async function loadContractCalculation(contract = state.detailContract) {
    const target = el('detailCalculationOutput');
    if (!target || !contract) return;
    try {
      const data = await root.LeaseQantPrivateCalculation.calculate(contract);
      if (String(state.detailId) !== String(contract.id) || !target.isConnected) return;
      state.detailCalculation = data; target.innerHTML = displaySchedule(data);
    } catch (error) { if (target.isConnected) target.innerHTML = showPageError(error, 'calculate-contract'); }
  }

  async function calculateDetailNow() {
    const contract = state.detailContract;
    if (!contract) return;
    state.detailTab = 'calculation';
    const url = new URL(root.location.href); url.searchParams.set('tab','calculation'); root.history.replaceState({},'',url);
    const detail = el('detailContent'); detail.innerHTML = renderDetailTab(contract);
    await loadContractCalculation(contract);
    toast('Hesaplama yanıtı sunucudan alındı.');
  }

  async function loadContractAudit(contract) {
    const target = el('detailAuditOutput');
    try {
      const body = await api(`/api/audit?contractId=${encodeURIComponent(contract.id)}&limit=200`);
      const rows = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : body?.events;
      if (!Array.isArray(rows)) throw Object.assign(new Error('Denetim servisi beklenen olay listesini döndürmedi.'), { code: 'AUDIT_RESPONSE_INVALID' });
      target.innerHTML = rows.length ? `<div class="audit-list">${rows.map(row=>`<div class="audit-row"><strong>${escape(row.action || row.event || 'Denetim olayı')}</strong><small>${escape(row.actor || 'Kullanıcı')} · ${escape(String(row.timestamp || row.createdAt || '').replace('T',' ').slice(0,19))}</small><details class="technical-details"><summary>Olay ayrıntısı</summary><pre>${escape(JSON.stringify({entityType:row.entity_type || row.entityType,entityId:row.entity_id || row.entityId,metadata:row.metadata,oldValue:row.old_value,newValue:row.new_value},null,2))}</pre></details></div>`).join('')}</div>` : `<div class="empty-state"><h3>Bu sözleşme için olay bulunamadı</h3><p>Boş denetim listesi hesaplama veya defter kaydı anlamına gelmez.</p></div>`;
    } catch (error) { target.innerHTML = showPageError(error); }
  }

  function renderDetailJournal(contract) {
    const output = el('detailJournalOutput');
    if (!output) return;
    output.innerHTML = `<div class="toolbar"><label class="field"><span>Fiş türü</span><select id="detailJournalKind"><option value="PERIOD">Dönem hareketi</option><option value="INITIAL">İlk kayıt</option><option value="RECLASSIFICATION">Kısa / uzun vade sınıflaması</option></select></label><button class="button button-primary" data-action="detail-journal-preview">Önizleme oluştur</button></div><div class="warning-alert">Sadece kaynak doğrulanmış önizleme; deftere veya ERP’ye kayıt yapılmaz.</div><div class="empty-state"><h3>Önizleme bekleniyor</h3><p>Sunucu şirket profili, hesap eşlemesi ve desteklenen işlem rotasını doğrular.</p></div>`;
  }

  async function detailJournalPreview() {
    const contract = state.detailContract;
    if (!contract) return;
    const intent = { companyId:contract.companyId, contractIds:[contract.id], kind:el('detailJournalKind')?.value || 'PERIOD', periodStart:state.period.periodStart, periodEnd:state.period.periodEnd };
    const target = el('detailJournalOutput'); target.innerHTML = '<div class="page-loading"><span class="spinner"></span><span>Fiş kaynağı doğrulanıyor…</span></div>';
    try {
      const data = await root.LeaseQantPrivateCalculation.getJournalAuthorityPackage(intent,false);
      state.journal = data;
      const voucher = data.vouchers?.[0];
      if (!voucher || voucher.balanced !== true || Math.abs(voucher.difference) >= .01) throw Object.assign(new Error('Dengesiz yevmiye önizlemesi gösterilmedi.'),{code:'JOURNAL_SOURCE_UNBALANCED'});
      const lines = voucher.lines.map(line=>`<tr><td>${escape(line.accountCode)}</td><td>${escape(line.accountName)}</td><td class="numeric-cell">${escape(U.formatMoney(line.debit,voucher.currency))}</td><td class="numeric-cell">${escape(U.formatMoney(line.credit,voucher.currency))}</td></tr>`).join('');
      target.innerHTML = `<div class="warning-alert">${escape(voucher.livePostingStatus)} · Canlı kayıt kapalı.</div><div class="table-scroll"><table class="data-table"><thead><tr><th>Hesap</th><th>Hesap adı</th><th class="numeric-cell">Borç</th><th class="numeric-cell">Alacak</th></tr></thead><tbody>${lines}</tbody></table></div><p class="source-line">${escape(voucher.voucherNo)} · ${escape(voucher.sourceResultHash)}</p><button class="button button-small" data-action="journal-csv">CSV indir</button>`;
    } catch (error) { state.journal = null; target.innerHTML = showPageError(error); }
  }

  async function loadPeriodStatus() {
    if (!state.companyId || state.companyId === 'ALL') {
      state.periodStatus = null; paintPeriodStatus(); return;
    }
    if (!U.isIsoDate(state.period.periodEnd)) { state.periodStatus = null; paintPeriodStatus(); return; }
    try {
      const result = await api(`/api/periods/lock-status?${new URLSearchParams({ companyId:state.companyId,periodKey:state.period.periodEnd.slice(0,7) })}`);
      state.periodStatus = result.data;
    } catch (error) { state.periodStatus = { status:'UNAVAILABLE', error }; }
    paintPeriodStatus();
  }

  function paintPeriodStatus() {
    const badge = el('periodLockBadge');
    if (!badge) return;
    const status = state.periodStatus?.status || 'UNAVAILABLE';
    badge.className = `lock-badge ${status === 'OPEN' ? 'status-success' : status === 'LOCKED' ? 'status-warning' : 'status-neutral'}`;
    badge.innerHTML = `<span class="status-symbol" aria-hidden="true">${status==='OPEN'?'✓':status==='LOCKED'?'▣':'·'}</span><span>${status==='OPEN'?'Dönem açık':status==='LOCKED'?'Dönem kilitli':'Kilit durumu bilinmiyor'}</span>`;
  }

  async function renderCurrent() {
    if (!el('pageHost') || !state.user) return;
    const epoch = ++state.renderEpoch;
    if (state.detailId) return renderContractDetail(epoch);
    if (state.view === 'contracts') { renderContracts(); return; }
    if (state.view === 'journals') { renderJournalForm(); return; }
    if (state.view === 'disclosures') return renderDisclosures(epoch);
    if (state.view === 'close') return renderClose(epoch);
    if (state.view === 'calculations') return renderCalculations(epoch);
    return renderOverview(epoch);
  }

  async function refreshAll() {
    if (state.busy) return;
    state.busy = true;
    const status = el('appStatus');
    if (status) { status.hidden = false; status.innerHTML='<span class="spinner" aria-hidden="true"></span><span>Yetki kapsamı ve sunucu verileri yenileniyor…</span>'; }
    try {
      await loadContracts();
      await loadPeriodStatus();
      await renderCurrent();
      if (status) status.hidden = true;
    } catch (error) {
      if (status) { status.hidden = false; status.innerHTML=`<div class="error-state" role="alert"><h2>Çalışma alanı açılamadı</h2><p>${escape(errorMessage(error))}</p><button class="button button-primary" data-action="refresh">Tekrar dene</button><details class="technical-details"><summary>Teknik ayrıntı</summary><code>${escape(error.code || 'WORKSPACE_LOAD_FAILED')}</code></details></div>`; }
    } finally { state.busy = false; }
  }

  async function bootstrap() {
    try {
      const meBody = await api('/api/auth/me');
      state.user = meBody?.data || meBody?.user || null;
      if (!state.user || state.user.mustChangePassword) {
        toast(state.user?.mustChangePassword ? 'Parola değişikliği gerekli.' : 'Oturum süresi doldu. Giriş yapın.', 'warning');
        root.location.replace('login.html'); return;
      }
      el('userChip').textContent = state.user.firstName || state.user.username || 'Kullanıcı';
      const companyBody = await api('/api/org/companies');
      state.companies = Array.isArray(companyBody?.data) ? companyBody.data.map(item=>({ ...item,id:String(item.id),name:String(item.name || item.id) })) : [];
      const contracts = await api('/api/contracts');
      const rows = Array.isArray(contracts) ? contracts : Array.isArray(contracts?.data) ? contracts.data : null;
      if (!rows) throw Object.assign(new Error('Sözleşme kapsamı listesi geçersiz.'), { code:'CONTRACT_LIST_RESPONSE_INVALID' });
      state.contracts = rows.map(normalizeContract);
      const storedCompany = root.localStorage.getItem('lq-workspace-company-v3');
      const accessible = state.companies.map(c=>String(c.id));
      state.companyId = accessible.includes(storedCompany) ? storedCompany : state.companies.length === 1 ? String(state.companies[0].id) : 'ALL';
      const fallback = U.previousCalendarMonth();
      try {
        const saved = JSON.parse(root.localStorage.getItem('lq-workspace-period-v3') || 'null');
        state.period = saved && U.isCalendarMonth(saved.periodStart,saved.periodEnd) ? saved : fallback;
      } catch (_) { state.period=fallback; }
      el('companySelect').innerHTML = `<option value="ALL">Tüm şirketler</option>${state.companies.map(c=>`<option value="${escape(c.id)}">${escape(c.name)}</option>`).join('')}`;
      el('companySelect').value = state.companyId;
      el('periodStart').value = state.period.periodStart; el('periodEnd').value = state.period.periodEnd;
      const params = new URLSearchParams(root.location.search);
      const contractId = params.get('contract');
      const view = params.get('view') || 'overview';
      if (contractId) { state.view='contract'; state.detailId=contractId; state.detailTab=params.get('tab') || 'summary'; }
      else state.view = NAV[view] ? view : 'overview';
      setNav(state.view, contractId ? `Sözleşme · ${contractId}` : undefined);
      el('appStatus').hidden = true; el('pageHost').hidden = false;
      bindEvents(); await loadPeriodStatus(); await renderCurrent();
    } catch (error) {
      if (error.status === 401 || error.code === 'SESSION_EXPIRED') { root.location.replace('login.html'); return; }
      if (error.code === 'MUST_CHANGE_PASSWORD') { root.location.replace('login.html?reason=change-password'); return; }
      el('appStatus').hidden=false;
      el('appStatus').innerHTML=`<div class="error-state" role="alert"><h2>Giriş doğrulanamadı</h2><p>${escape(errorMessage(error))}</p><a class="button button-primary" href="login.html">Giriş sayfasına dön</a><details class="technical-details"><summary>Teknik ayrıntı</summary><code>${escape(error.code || 'AUTHENTICATION_FAILED')}</code></details></div>`;
    }
  }

  function bindEvents() {
    root.document.addEventListener('click', onClick);
    root.document.addEventListener('keydown', onKeydown);
    el('companySelect').addEventListener('change', async event=>{
      state.companyId=event.target.value; root.localStorage.setItem('lq-workspace-company-v3',state.companyId); state.report=null; state.journal=null; state.disclosure=null;
      await loadContracts(); await loadPeriodStatus(); await renderCurrent();
    });
    const syncPeriod=async()=>{
      const periodStart=el('periodStart').value, periodEnd=el('periodEnd').value;
      if (!U.isCalendarMonth(periodStart,periodEnd)) { el('periodStart').setAttribute('aria-invalid','true'); el('periodEnd').setAttribute('aria-invalid','true'); toast('Bu rapor rotası tam takvim ayı ister.', 'warning'); return; }
      el('periodStart').removeAttribute('aria-invalid'); el('periodEnd').removeAttribute('aria-invalid');
      state.period={periodStart,periodEnd}; root.localStorage.setItem('lq-workspace-period-v3',JSON.stringify(state.period));
      state.report=null; state.disclosure=null; await loadPeriodStatus(); await renderCurrent();
    };
    el('periodStart').addEventListener('change',syncPeriod); el('periodEnd').addEventListener('change',syncPeriod);
    root.addEventListener('popstate',()=>{
      const params=new URLSearchParams(root.location.search),contract=params.get('contract');
      state.detailId=contract; state.view=contract?'contract':NAV[params.get('view')]?params.get('view'):'overview'; state.detailTab=params.get('tab')||'summary'; setNav(state.view,contract?`Sözleşme · ${contract}`:undefined); void renderCurrent();
    });
  }

  async function onClick(event) {
    const nav = event.target.closest('[data-nav]');
    if (nav) { setView(nav.dataset.nav); return; }
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    try {
      if (action === 'refresh') { state.report=null; await refreshAll(); }
      else if (action === 'logout') { root.logout ? root.logout() : (root.sessionStorage.clear(),root.localStorage.removeItem('access_token'),root.location.replace('login.html')); }
      else if (action === 'new-contract') newContractModal();
      else if (action === 'close-modal') closeModal();
      else if (action === 'modal-submit') { button.disabled=true; try { await state.modalSubmit?.(); } finally { button.disabled=false; } }
      else if (action === 'open-contract' || action === 'contract-menu') { if (button.dataset.contract) { if (!el('modalHost').hidden) closeModal(); setView('contracts',{contractId:button.dataset.contract,tab:'summary'}); } }
      else if (action === 'page-prev') { state.page=Math.max(1,state.page-1); renderContracts(); }
      else if (action === 'page-next') { state.page+=1; renderContracts(); }
      else if (action === 'clear-contract-filters') { state.filter='';state.contractStatus='ALL';state.page=1;renderContracts(); }
      else if (action === 'select-company') { el('companySelect').value=button.dataset.company;el('companySelect').dispatchEvent(new Event('change',{bubbles:true})); }
      else if (action === 'journal-preview') await createJournalPreview();
      else if (action === 'journal-csv') {
        const rows=state.journal?.vouchers?.flatMap(v=>v.lines.map(line=>({voucher:v.voucherNo,company:v.company,contractId:v.contractId,postingDate:line.postingDate,currency:v.currency,accountCode:line.accountCode,accountName:line.accountName,purpose:line.accountPurpose,debit:line.debit,credit:line.credit,status:v.livePostingStatus,sourceHash:v.sourceResultHash})))||[];
        downloadCsv(rows,'leaseqant-yevmiye-onizlemesi.csv');
      }
      else if (action === 'export-report') {
        if (!state.report) return;
        const rows=root.LeaseQantReportingAuthorityUi.rawRows(state.report,'metrics'); downloadCsv(rows,'leaseqant-donem-raporu.csv');
      }
      else if (action === 'export-contracts') downloadCsv(selectedContracts().map(c=>({contractId:c.id,company:c.company,supplier:c.supplier,startDate:c.startDate,endDate:c.endDate,contractualPayment:c.monthlyPayment,currency:c.currency,status:c.status})), 'leaseqant-sozlesmeler.csv');
      else if (action === 'detail-tab') { state.detailTab=button.dataset.tab; const url=new URL(root.location.href);url.searchParams.set('tab',state.detailTab);root.history.pushState({},'',url);await renderCurrent(); }
      else if (action === 'calculate-contract') await calculateDetailNow();
      else if (action === 'detail-journal-preview') await detailJournalPreview();
      else if (action === 'create-trusted-sources') await createTrustedSources();
      else if (action === 'refresh-disclosure') await renderCurrent();
      else if (action === 'save-draft') await saveDisclosureDraft();
      else if (action === 'print-disclosure') root.print();
      else if (action === 'load-draft-version') loadDraftVersion(Number(button.dataset.versionIndex));
      else if (action === 'global-search') openSearch();
    } catch (error) { toast(errorMessage(error), 'error'); }
  }

  function loadDraftVersion(index) {
    const version = state.drafts?.versions?.[index];
    if (!version) { toast('Taslak sürümü bulunamadı.', 'error'); return; }
    state.draftSections = version.sections || {};
    root.document.querySelectorAll('[data-narrative]').forEach(field=>{field.value=state.draftSections[field.dataset.narrative]||'';});
    root.document.querySelectorAll('.version-item').forEach(item=>item.setAttribute('aria-current',String(Number(item.dataset.versionIndex)===index)));
    toast(`v${version.version} taslağı düzenleyiciye yüklendi. Kaydetmek yeni sürüm oluşturur.`, 'warning');
  }

  function openSearch() {
    const html = `<label class="search-field"><span>Sözleşme ara</span><input id="globalSearchInput" type="search" placeholder="Sözleşme numarası veya kiraya veren"></label><div id="globalSearchResults" class="stack" style="margin-top:14px"></div>`;
    modal('Sözleşme ara',html,async()=>{},'Kapat');
    const input=el('globalSearchInput'),results=el('globalSearchResults');
    input?.addEventListener('input',()=>{
      const term=input.value.trim().toLocaleLowerCase('tr-TR');
      const matches=selectedContracts().filter(c=>!term||`${c.id} ${c.supplier} ${c.company}`.toLocaleLowerCase('tr-TR').includes(term)).slice(0,10);
      results.innerHTML=matches.map(c=>`<button class="button" data-action="open-contract" data-contract="${escape(c.id)}">${escape(c.id)} · ${escape(c.supplier)}</button>`).join('')||'<p class="muted">Eşleşme yok.</p>';
    }); input?.focus();
    el('modalHost').querySelector('[data-action="modal-submit"]').textContent='Kapat';
    state.modalSubmit=async()=>closeModal();
  }

  function onKeydown(event) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase()==='k') { event.preventDefault(); openSearch(); return; }
    if (event.key === 'Escape' && !el('modalHost').hidden) closeModal();
    if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('tr[data-action="open-contract"]')) {
      event.preventDefault(); setView('contracts',{contractId:event.target.dataset.contract,tab:'summary'});
    }
  }

  root.document.addEventListener('input', event=>{
    if (event.target.id==='contractSearch') { state.filter=event.target.value;state.page=1;const pos=event.target.selectionStart;renderContracts();const replacement=el('contractSearch');replacement?.focus();replacement?.setSelectionRange(pos,pos); }
  });
  root.document.addEventListener('change', event=>{
    if (event.target.id==='contractStatus') { state.contractStatus=event.target.value;state.page=1;renderContracts(); }
    if (event.target.id==='pageSize') { state.pageSize=Number(event.target.value)||25;state.page=1;renderContracts(); }
  });

  root.LeaseQantWorkspaceV3 = Object.freeze({ api, renderCurrent, refreshAll,
    getState:()=>({ view:state.view,companyId:state.companyId,period:{...state.period},contractCount:state.contracts.length }) });
  if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded',bootstrap,{once:true});
  else void bootstrap();
})(window);
