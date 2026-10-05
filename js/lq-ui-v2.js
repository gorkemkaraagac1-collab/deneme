/* LeaseQant UI v2 — sunum yardımcısı (Faz 1 + Faz 2 dönem şeridi).
   - Hesaplama, API çağrısı veya kalıcı veri yazımı yapmaz.
   - Mevcut DOM kimliklerini taşımaz/yeniden adlandırmaz; yalnızca
     şirket seçicisini (aynı öğe, aynı dinleyiciler) bağlam çubuğuna taşır.
   - Dönem seçimi js/lq-reporting-period.js içindeki ortak durumdadır.
   - html[data-lq-ui="2"] (tfrs16.html her zaman ayarlar) değilse hiçbir şey yapmaz. */
((global) => {
  "use strict";
  const root = document.documentElement;
  if (root.getAttribute("data-lq-ui") !== "2") return;

  const $ = id => document.getElementById(id);

  /* ---------- Klavye ve adlandırma ---------- */
  function syncNavigationAccessibility(nav) {
    if (!nav) return;
    nav.querySelectorAll(".nav-item").forEach(item => {
      if (item.classList.contains("active")) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });
    nav.querySelectorAll(".lq-nav-dropdown").forEach(drop => {
      const trigger = drop.querySelector(":scope > .lq-nav-trigger");
      if (trigger) trigger.setAttribute("aria-expanded", String(drop.classList.contains("open")));
    });
  }

  function initNavigationAccessibility() {
    const nav = $("sidebarNav");
    const toggle = $("menuToggle");
    if (toggle && nav) {
      toggle.setAttribute("aria-controls", nav.id);
      const syncToggle = () => toggle.setAttribute("aria-label",
        toggle.getAttribute("aria-expanded") === "true" ? "Ana menüyü kapat" : "Ana menüyü aç");
      syncToggle();
      new MutationObserver(syncToggle).observe(toggle, { attributes: true, attributeFilter: ["aria-expanded"] });
    }
    if (!nav) return;
    syncNavigationAccessibility(nav);
    new MutationObserver(() => syncNavigationAccessibility(nav)).observe(nav, {
      attributes: true, subtree: true, attributeFilter: ["class"]
    });
    nav.addEventListener("keydown", event => {
      if (event.key !== "Escape") return;
      const open = nav.querySelector(".lq-nav-dropdown.open");
      if (open) {
        open.classList.remove("open");
        const trigger = open.querySelector(":scope > .lq-nav-trigger");
        trigger?.setAttribute("aria-expanded", "false");
        trigger?.focus();
      } else if (nav.classList.contains("mobile-open")) {
        nav.classList.remove("mobile-open");
        toggle?.setAttribute("aria-expanded", "false");
        toggle?.focus();
      } else return;
      event.preventDefault();
      event.stopPropagation();
    });
  }

  function initTabKeyboard() {
    document.addEventListener("keydown", event => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const tab = event.target.closest?.('.lq-pg-tabs [role="tab"]');
      if (!tab) return;
      const list = tab.closest('[role="tablist"]');
      const tabs = Array.from(list?.querySelectorAll('[role="tab"]') || []).filter(item => !item.disabled);
      const index = tabs.indexOf(tab);
      if (index < 0 || !tabs.length) return;
      let nextIndex = -1;
      if (event.key === "Home") nextIndex = 0;
      else if (event.key === "End") nextIndex = tabs.length - 1;
      else if (list.getAttribute("aria-orientation") === "vertical") {
        if (event.key === "ArrowDown") nextIndex = (index + 1) % tabs.length;
        else if (event.key === "ArrowUp") nextIndex = (index + tabs.length - 1) % tabs.length;
      } else {
        if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
        else if (event.key === "ArrowLeft") nextIndex = (index + tabs.length - 1) % tabs.length;
      }
      if (nextIndex < 0) return;
      event.preventDefault();
      const next = tabs[nextIndex];
      const dataKey = Array.from(next.attributes).find(attribute => attribute.name.startsWith("data-"));
      const keyName = dataKey?.name;
      const keyValue = dataKey?.value;
      const scope = tab.closest("#lqContracts, #lqFinancial") || document;
      next.click();
      const currentList = scope.querySelector?.('.lq-pg-tabs[role="tablist"]');
      const replacement = currentList && keyName
        ? Array.from(currentList.querySelectorAll('[role="tab"]')).find(item => item.getAttribute(keyName) === keyValue)
        : null;
      (replacement || (next.isConnected ? next : null))?.focus();
    });
  }

  function labelExistingDialogs() {
    const doc = global.document;
    const labelDialog = dialog => {
      if (dialog.hasAttribute("aria-labelledby") || dialog.hasAttribute("aria-label")) return;
      const heading = dialog.querySelector("h1, h2, h3");
      const label = heading?.textContent?.replace(/\s+/g, " ").trim();
      if (label) dialog.setAttribute("aria-label", label);
    };
    const detail = $("detailModal");
    if (detail && !detail.hasAttribute("aria-labelledby") && $("detailTitle")) detail.setAttribute("aria-labelledby", "detailTitle");
    doc.querySelectorAll('[role="dialog"], [role="alertdialog"]').forEach(labelDialog);
    if (doc.body) new MutationObserver(() => {
      doc.querySelectorAll('[role="dialog"], [role="alertdialog"]').forEach(labelDialog);
    }).observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["role"] });
  }
  const STATE_CLASSES = [
    ".lq-pg-empty", ".lq-pg-emptyrow", ".lq-cv-empty", ".lq-cv-kpi-note",
    ".lq-cv-kpis.is-loading", ".lq-op-empty", ".lq-op-source-state",
    ".lq-authority-empty", ".lq-dn-err", ".empty-state", ".lq-pg-skel"
  ].join(",");
  const STATE_SELECTOR = ["[role='alert']", "[role='status']", "[aria-busy='true']", STATE_CLASSES].join(",");
  const STATUS_PARAGRAPHS = "#mainContent p, #v26PageHost p, #detailContent p, #lqDashboard p, #contractsView p";
  const UNAUTHORIZED_WORDS = /\b(?:401|403)\b|oturum açmanız|oturum süresi doldu|erişim yetkiniz yok|yetkiniz yok|yetkisiz|unauthorized|forbidden|access denied/i;
  const LOADING_WORDS = /yükleniyor|loading|paket yüklenince gösterilir/i;
  const ERROR_WORDS = /alınamadı|gösterilemiyor|bir hata oluştu|hata oluştu|başarısız|ulaşılamadı|erişilemiyor|kullanılamıyor|failed|\berror\b|timeout/i;
  const BLOCKED_WORDS = /kaynak gerekli|kaynak hazır değil|kaynak bekleniyor|kaynak yok|kaynağı yok|kaynak bulunamadı|kapsam dışı|desteklenmiyor|politika kararı gerekli|girdi gerekli|hesaplanamaz|sertifikalı.*(?:değil|yok)|erişilebilir şirket kaynağı bulunamadı/i;
  const EMPTY_WORDS = /henüz .*?(?:yok|bulunmuyor)|(?:bu dönem|bu görünüm|bu şirket|bu sözleşme).*?(?:yok|bulunmuyor|bulunamadı)|(?:aramayla|arama ile|filtreyle|filtre ile) eşleşen.*?yok|fiş hareketi olmadığını doğruladı|sözleşme seçildiğinde|şirket seçin|^—$/i;
  const originalStateAttrs = new WeakMap();

  function inferredState(el) {
    if (!el || el.nodeType !== 1) return null;
    const saved = originalStateAttrs.get(el);
    const originalBusy = !saved || saved["aria-busy"] === "true";
    if (el.matches(".lq-pg-skel, .lq-cv-kpis.is-loading") || (originalBusy && el.getAttribute("aria-busy") === "true")) return "loading";
    const text = (el.textContent || "").replace(/\s+/g, " ").trim();
    const originalAlert = (!saved || saved.role === "alert") && el.getAttribute("role") === "alert";
    if (UNAUTHORIZED_WORDS.test(text)) return "unauthorized";
    if (originalAlert || el.matches(".lq-dn-err")) return "error";
    if (LOADING_WORDS.test(text)) return "loading";
    if (el.matches(".lq-op-source-state")) return "blocked";
    if (BLOCKED_WORDS.test(text)) return "blocked";
    if (!text || EMPTY_WORDS.test(text) || el.matches(".lq-pg-emptyrow, .lq-cv-empty, .lq-op-empty, .lq-authority-empty, .empty-state")) return "empty";
    if (ERROR_WORDS.test(text)) return "error";
    return null;
  }

  function restoreState(el) {
    if (!el?.hasAttribute("data-lq-ui-state")) return;
    const saved = originalStateAttrs.get(el);
    el.classList.remove("lq-v2-state", "lq-v2-metric-state");
    el.removeAttribute("data-lq-ui-state");
    if (saved) {
      for (const [name, value] of Object.entries(saved)) {
        if (value === null) el.removeAttribute(name);
        else el.setAttribute(name, value);
      }
      originalStateAttrs.delete(el);
    }
  }

  function decorateState(el, state, metric = false) {
    if (!el || !state) { restoreState(el); return; }
    if (!originalStateAttrs.has(el)) {
      originalStateAttrs.set(el, Object.fromEntries(["role", "aria-live", "aria-atomic", "aria-busy"].map(name => [name, el.getAttribute(name)])));
    }
    el.dataset.lqUiState = state;
    el.classList.add(metric ? "lq-v2-metric-state" : "lq-v2-state");
    if (el.matches(".lq-pg-skel")) return; // skeleton visuals stay aria-hidden; their existing screen-reader label remains.
    const announceAsAlert = state === "error" || state === "unauthorized";
    const setIfChanged = (name, value) => { if (el.getAttribute(name) !== value) el.setAttribute(name, value); };
    setIfChanged("role", announceAsAlert ? "alert" : "status");
    setIfChanged("aria-live", announceAsAlert ? "assertive" : "polite");
    setIfChanged("aria-atomic", "true");
    if (state === "loading") setIfChanged("aria-busy", "true");
    else if (el.hasAttribute("aria-busy")) el.removeAttribute("aria-busy");
  }

  function stateElements(scope = document) {
    const found = new Set();
    const addMatches = selector => {
      if (scope.nodeType === 1 && scope.matches?.(selector)) found.add(scope);
      scope.querySelectorAll?.(selector).forEach(el => found.add(el));
    };
    addMatches(STATE_SELECTOR);
    addMatches(STATUS_PARAGRAPHS);
    return new Set(Array.from(found).filter(el => {
      // Controls keep their own role: a busy Save button is not a status box
      // (it used to stay role=status / aria-busy after the save finished).
      if (el.matches("button, input, select, textarea, a, [role='button']")) { restoreState(el); return false; }
      if (el.hasAttribute("data-lq-ui-state")) return true;
      const explicit = el.matches(STATE_SELECTOR);
      if (explicit) return true;
      const parent = el.parentElement?.closest(`${STATE_CLASSES}, [role='alert'], [role='status'], [aria-busy='true']`);
      if (parent) return false;
      return Boolean(inferredState(el));
    }));
  }

  function scanPageStates(scope = document) {
    let count = 0;
    stateElements(scope).forEach(el => {
      const state = inferredState(el);
      const metric = VALUE_IDS.includes(el.id);
      if (state) { decorateState(el, state, metric); count++; }
      else restoreState(el);
    });
    return count;
  }

  const sharedStateApi = Object.freeze({ classify: inferredState, decorate: decorateState, scan: scanPageStates });
  global.LeaseQantUiV2States = sharedStateApi;

  function watchPageStates() {
    const target = document.body || root;
    if (!target || typeof global.MutationObserver !== "function") return;
    scanPageStates(target);
    new global.MutationObserver(records => {
      records.forEach(record => {
        if (record.type === "characterData") {
          const parent = record.target.parentElement?.closest(`${STATE_SELECTOR}, ${STATUS_PARAGRAPHS}`);
          if (parent) scanPageStates(parent);
        }
        if (record.type === "childList" && record.target.nodeType === 1) {
          const parent = record.target.closest(`${STATE_SELECTOR}, ${STATUS_PARAGRAPHS}`);
          if (parent) scanPageStates(parent);
        }
        record.addedNodes?.forEach(node => { if (node.nodeType === 1) scanPageStates(node); });
      });
    }).observe(target, { childList: true, subtree: true, characterData: true });
  }

  /* ---------- Tutar mı, durum metni mi? ---------- */
  const VALUE_IDS = [
    "lqTotalLiability", "lqTotalRou", "lqActiveContracts", "lqCurrentLiability",
    "lqNext12Payments", "lqMonthlyInterest", "lqMonthlyDep", "lqCurrentLegend",
    "lqNonCurrentLegend", "lqReadinessScore", "lqCurrentPct", "lqRenewalCount",
    "lqModificationCount", "kpiLiability", "kpiRou", "kpiCurrent", "kpiContractCount",
    "lqLiabilityBars", "lqAssetLegend"
  ];
  const NUMERIC = /^[(\-−]?\s*(?:[₺$€£]\s?)?\d[\d.\s]*(?:,\d+)?\s*%?\)?(?:\s?(?:TRY|USD|EUR|GBP|TL|₺))?$/;
  const METRIC_ERROR_WORDS = /alınamadı|hata|başarısız|kullanılamıyor/i;
  function classify(el) {
    if (!el) return;
    if (el.children.length) {
      el.removeAttribute("data-lq-state");
      el.removeAttribute("data-lq-tone");
      restoreState(el);
      return;
    }
    const text = (el.textContent || "").trim();
    let state = "value";
    if (!text || text === "—") state = "empty";
    else if (!NUMERIC.test(text)) state = "status";
    const metricState = state === "value" ? null : inferredState(el) || (state === "empty" ? "empty" : (METRIC_ERROR_WORDS.test(text) ? "error" : "blocked"));
    if (metricState) decorateState(el, metricState, true);
    else restoreState(el);
    if (el.getAttribute("data-lq-state") !== state) el.setAttribute("data-lq-state", state);
    if (state === "status") {
      const tone = metricState === "error" || metricState === "unauthorized" ? "error" : (metricState === "empty" || metricState === "loading" ? "neutral" : "warn");
      if (el.getAttribute("data-lq-tone") !== tone) el.setAttribute("data-lq-tone", tone);
    } else {
      el.removeAttribute("data-lq-tone");
    }
  }

  function watchValues() {
    VALUE_IDS.forEach(id => {
      const el = $(id);
      if (!el) return;
      classify(el);
      new MutationObserver(() => classify(el)).observe(el, { childList: true, subtree: true, characterData: true });
    });
  }

  /* ---------- Dönem şeridi ---------- */
  // Rapor modülleri (Genel Bakış, Finansal Raporlama, Dipnotlar) dönem
  // tarihini LeaseQantReportingPeriod'dan okur. Şerit dönem kilidi
  // göstermez: kilit durumu sunucuda yalnızca yönetici API'sinde tutuluyor
  // ve buradan doğrulanamıyor.
  const MONTHS_TR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  const MONTHS_LONG = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

  function monthLabel(key) {
    const [y, m] = key.split("-").map(Number);
    return { short: MONTHS_TR[m - 1], year: String(y).slice(2), long: `${MONTHS_LONG[m - 1]} ${y}` };
  }

  function formatDate(iso) {
    const [y, m, d] = iso.split("-");
    return `${d}.${m}.${y}`;
  }

  function refreshReports() {
    try { global.LeaseQantReportingAuthorityUi?.dashboard?.(); } catch (_) {}
    const active = document.querySelector("#sidebarNav .nav-item.active[data-open]");
    const host = $("v26PageHost");
    if (active && host && host.style.display !== "none" && host.childElementCount) active.click();
  }

  function buildRibbon(onChange) {
    const api = global.LeaseQantReportingPeriod;
    if (!api) return null;

    const wrap = document.createElement("div");
    wrap.className = "lq-ribbon";
    const group = document.createElement("div");
    group.className = "lq-ribbon-months";
    group.setAttribute("role", "radiogroup");
    group.setAttribute("aria-label", "Raporlama dönemi");

    const meta = document.createElement("div");
    meta.className = "lq-ribbon-meta";
    const small = document.createElement("small");
    small.textContent = "RAPORLAMA TARİHİ";
    const date = document.createElement("b");
    meta.append(small, date);

    // Period scope: the reporting month is the period end; the period
    // starts 1, 3 or 6 months earlier, at the fiscal-year start or at a
    // chosen month.
    const scopeBox = document.createElement("div");
    scopeBox.className = "lq-ribbon-scope";
    scopeBox.style.cssText = "display:flex;gap:6px;align-items:center;flex-wrap:wrap";
    const selectStyle = "padding:4px 6px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#172033;font-size:12px";
    const scopeSelect = document.createElement("select");
    scopeSelect.setAttribute("aria-label", "Dönem kapsamı");
    scopeSelect.style.cssText = selectStyle;
    [["MONTH", "Tek ay"], ["QUARTER", "Son 3 ay"], ["HALF", "Son 6 ay"], ["YTD", "Hesap dönemi başından"], ["CUSTOM", "Özel başlangıç"]]
      .forEach(([value, label]) => { const o = document.createElement("option"); o.value = value; o.textContent = label; scopeSelect.append(o); });
    const fiscalSelect = document.createElement("select");
    fiscalSelect.setAttribute("aria-label", "Hesap dönemi başlangıç ayı");
    fiscalSelect.style.cssText = selectStyle;
    MONTHS_LONG.forEach((label, i) => { const o = document.createElement("option"); o.value = String(i + 1); o.textContent = `${label} başı`; fiscalSelect.append(o); });
    const customSelect = document.createElement("select");
    customSelect.setAttribute("aria-label", "Dönem başlangıç ayı");
    customSelect.style.cssText = selectStyle;
    api.months(24).forEach(key => { const o = document.createElement("option"); o.value = key; o.textContent = `${monthLabel(key).long} başı`; customSelect.append(o); });
    scopeBox.append(scopeSelect, fiscalSelect, customSelect);
    const applyScope = () => {
      const before = api.get();
      api.setScope({ scope: scopeSelect.value, fiscalStart: Number(fiscalSelect.value), customStart: customSelect.value });
      render();
      const after = api.get();
      if (after.periodStart !== before.periodStart || after.periodEnd !== before.periodEnd) onChange();
    };
    [scopeSelect, fiscalSelect, customSelect].forEach(el => el.addEventListener("change", applyScope));

    const buttons = [];
    const render = () => {
      const r = api.get();
      buttons.forEach(btn => {
        const on = btn.dataset.key === r.key;
        btn.setAttribute("aria-checked", String(on));
        btn.tabIndex = on ? 0 : -1;
      });
      const sc = api.getScope ? api.getScope() : { scope: "MONTH", fiscalStart: 1, customStart: null };
      scopeSelect.value = sc.scope;
      fiscalSelect.value = String(sc.fiscalStart || 1);
      if (sc.customStart) customSelect.value = sc.customStart;
      else customSelect.value = r.startKey || r.key;
      fiscalSelect.hidden = sc.scope !== "YTD";
      customSelect.hidden = sc.scope !== "CUSTOM";
      const multi = r.months > 1;
      small.textContent = multi ? `RAPORLAMA DÖNEMİ · ${r.months} AY` : "RAPORLAMA TARİHİ";
      date.textContent = multi ? `${formatDate(r.periodStart)} – ${formatDate(r.reportingDate)}` : formatDate(r.reportingDate);
      date.title = `${monthLabel(r.key).long} · ${formatDate(r.periodStart)} – ${formatDate(r.periodEnd)}`;
    };

    api.months(12).forEach(key => {
      const l = monthLabel(key);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "lq-ribbon-month";
      btn.dataset.key = key;
      btn.setAttribute("role", "radio");
      btn.setAttribute("aria-label", l.long);
      const s1 = document.createElement("span");
      s1.textContent = l.short;
      const s2 = document.createElement("small");
      s2.textContent = l.year;
      btn.append(s1, s2);
      btn.addEventListener("click", () => {
        const changed = api.get().key !== key;
        if (api.set(key)) {
          render();
          if (changed) onChange();
        }
      });
      btn.addEventListener("keydown", e => {
        const i = buttons.indexOf(btn);
        let next = null;
        if (e.key === "ArrowLeft") next = buttons[i - 1];
        if (e.key === "ArrowRight") next = buttons[i + 1];
        if (e.key === "Home") next = buttons[0];
        if (e.key === "End") next = buttons[buttons.length - 1];
        if (next) { e.preventDefault(); next.focus(); next.click(); }
      });
      buttons.push(btn);
      group.append(btn);
    });

    meta.append(scopeBox);
    wrap.append(group, meta);
    render();
    global.requestAnimationFrame?.(() => {
      const sel = group.querySelector('[aria-checked="true"]');
      if (sel) group.scrollLeft = Math.max(0, sel.offsetLeft - group.clientWidth + sel.offsetWidth + 4);
    });
    return wrap;
  }

  /* Yevmiye (toplu fiş) bölümü kendi yıl/ay seçicisini çizer; her çizimde bir
     kez ortak döneme ayarlanır. Kullanıcı sonra serbestçe değiştirebilir. */
  function syncJournalSelectors() {
    const api = global.LeaseQantReportingPeriod;
    const year = $("bulkAccountingYear"), month = $("bulkAccountingMonth"), period = $("bulkAccountingPeriod");
    if (!api || !year || !month || year.dataset.lqPeriodSynced === "1") return;
    if (period && period.value !== "monthly") return;
    const [y, m] = api.get().key.split("-").map(Number);
    const hasYear = Array.from(year.options).some(o => o.value === String(y));
    const hasMonth = Array.from(month.options).some(o => o.value === String(m));
    if (!hasYear || !hasMonth) return;
    year.dataset.lqPeriodSynced = "1";
    year.value = String(y);
    month.value = String(m);
    year.dispatchEvent(new Event("change", { bubbles: true }));
    month.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function watchJournalPage() {
    const host = $("v26PageHost");
    if (!host) return;
    new MutationObserver(syncJournalSelectors).observe(host, { childList: true, subtree: true });
  }

  /* ---------- Bağlam çubuğu ---------- */
  function activeTitle() {
    const active = document.querySelector("#sidebarNav .nav-item.active");
    const txt = active ? (active.textContent || "").replace(/\s+/g, " ").trim() : "";
    if (!txt) return "Genel Bakış";
    return txt === "Dashboard" ? "Genel Bakış" : txt;
  }

  function buildContextBar() {
    const main = $("mainContent");
    if (!main || $("lqContextBar")) return;
    const bar = document.createElement("div");
    bar.id = "lqContextBar";
    bar.className = "lq-ctx";
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", "Çalışma bağlamı");

    const title = document.createElement("div");
    title.className = "lq-ctx-title";
    const strong = document.createElement("strong");
    const sub = document.createElement("span");
    title.append(strong, sub);
    bar.append(title);

    const ribbon = buildRibbon(refreshReports);
    if (ribbon) bar.append(ribbon);

    const select = $("v26ActiveCompanySelect");
    if (select) {
      select.setAttribute("aria-label", "Aktif şirket");
      bar.append(select); // aynı öğe: id ve olay dinleyicileri korunur
    }
    main.prepend(bar);

    const syncTitle = () => {
      strong.textContent = activeTitle();
      const asOf = ($("kpiDataAsOf")?.textContent || "").trim();
      const s = asOf || "TFRS 16 kiralama portföyü";
      if (sub.textContent !== s) sub.textContent = s;
    };
    syncTitle();
    const nav = $("sidebarNav");
    if (nav) new MutationObserver(syncTitle).observe(nav, { attributes: true, subtree: true, attributeFilter: ["class"] });
    const asOf = $("kpiDataAsOf");
    if (asOf) new MutationObserver(syncTitle).observe(asOf, { childList: true, subtree: true, characterData: true });
  }

  function init() {
    initNavigationAccessibility();
    initTabKeyboard();
    labelExistingDialogs();
    buildContextBar();
    watchValues();
    watchJournalPage();
    watchPageStates();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})(window);
