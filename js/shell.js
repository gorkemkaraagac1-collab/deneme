/**
 * GK Finance — TFRS 16 SaaS shell
 * Lightweight UI bridge: navigation, toasts, mobile menu, KPI helpers.
 * Does not replace the calculation engine; only frames it.
 */
(function () {
  "use strict";

  const isProtectedEnginePage = /\/tfrs16\.html$/i.test(window.location.pathname);

  // Engine pages must never render their local cache without a valid backend
  // session. The redirect runs before the engine script is loaded.
  if (isProtectedEnginePage && !localStorage.getItem("access_token") && !localStorage.getItem("gk_backend_jwt")) {
    document.documentElement.style.visibility = "hidden";
    window.location.replace("login.html");
    return;
  }

  window.logout = function logout() {
    [
      "access_token",
      "gk_backend_jwt",
      "current_user",
      "gk_tfrs16_v21_session_v1",
      "gk_tfrs16_contracts_v7",
      "gk_tfrs16_active_company_v1"
    ].forEach(key => localStorage.removeItem(key));
    window.location.replace("login.html");
  };

  const VIEW_TITLES = {
    contracts: { title: "Sözleşmeler", subtitle: "Kiralama portföyü" },
    close: { title: "Kapanış Paneli", subtitle: "Ay sonu kapanış kontrolü" },
    accountingCenter: { title: "Toplu Fiş Merkezi", subtitle: "Muhasebe fişleri" },
    financialReporting: { title: "Finansal Raporlama", subtitle: "Bilanço & dipnot KPI" },
    footnotes: { title: "Dipnotlar", subtitle: "Varlık · Yükümlülük · Likidite" },
    modification: { title: "Modifikasyon & Reassessment", subtitle: "Sözleşme değişiklikleri" },
    slb: { title: "Satış ve Geri Kiralama", subtitle: "TFRS 16.98–103" },
    sublease: { title: "Alt Kiralama", subtitle: "TFRS 16.B58" },
    riskControls: { title: "Risk & Kontroller", subtitle: "Portföy kontrolleri" },
    accountMapping: { title: "Hesap Planı", subtitle: "Şirket bazlı hesap kodları" },
    fxRates: { title: "Döviz Kurları", subtitle: "TMS 21 kur yönetimi" },
    inflation: { title: "Enflasyon Endeksleri", subtitle: "TMS 29 — salt okunur" },
    companies: { title: "Şirket Yönetimi", subtitle: "Holding yapısı" },
    groups: { title: "Gruplar", subtitle: "Konsolidasyon grupları" },
    eliminations: { title: "Eliminasyonlar", subtitle: "Grup içi eliminasyon" },
    consolidation: { title: "Konsolidasyon", subtitle: "Grup raporlama" },
    audit: { title: "Denetim İzi", subtitle: "Olay kaydı" }
  };

  /* ---------- Toasts / alerts (engine may call showToast / showAlert) ---------- */
  function ensureToastHost() {
    return document.getElementById("toastHost");
  }

  window.showToast = function (message, type, _duration) {
    const host = ensureToastHost();
    if (!host) {
      window.alert(String(message || ""));
      return;
    }
    const el = document.createElement("div");
    el.className = "toast " + (type === "error" ? "error" : type === "warning" ? "warning" : "success");
    el.textContent = String(message || "");
    host.appendChild(el);
    const ms = typeof _duration === "number" ? _duration : 3200;
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transition = "opacity 0.25s";
      setTimeout(() => el.remove(), 260);
    }, ms);
  };

  window.showAlert = function (message) {
    window.showToast(message, "warning", 4500);
  };

  window.showConfirm = function (message, opts) {
    return Promise.resolve(window.confirm(String(message || "Emin misiniz?")));
  };

  /* ---------- Mobile sidebar ---------- */
  function initMobileMenu() {
    const toggle = document.getElementById("menuToggle");
    const sidebar = document.getElementById("sidebar");
    if (!toggle || !sidebar) return;
    toggle.addEventListener("click", () => sidebar.classList.toggle("open"));
    document.addEventListener("click", (e) => {
      if (window.innerWidth > 900) return;
      if (!sidebar.classList.contains("open")) return;
      if (sidebar.contains(e.target) || toggle.contains(e.target)) return;
      sidebar.classList.remove("open");
    });
  }

  /* ---------- Navigation ---------- */
  function setActiveNav(key) {
    document.querySelectorAll(".nav-item").forEach((btn) => {
      const open = btn.getAttribute("data-open") || "";
      const view = btn.getAttribute("data-view");
      const isActive =
        (view === "contracts" && key === "contracts") ||
        (view === "page" && open === key);
      btn.classList.toggle("active", isActive);
    });
  }

  function setTitle(key) {
    const meta = VIEW_TITLES[key] || VIEW_TITLES.contracts;
    const t = document.getElementById("pageTitle");
    const s = document.getElementById("pageSubtitle");
    if (t) t.textContent = meta.title;
    if (s) s.textContent = meta.subtitle;
  }

  function closeLegacyV191Modal() {
    try {
      const m = document.getElementById("v191FunctionalModal");
      if (m) m.classList.add("hidden");
    } catch (_) {}
  }

  function showContractsView() {
    closeLegacyV191Modal();
    const contracts = document.getElementById("contractsView");
    const host = document.getElementById("v26PageHost");
    if (contracts) contracts.style.display = "";
    if (host) {
      host.style.display = "none";
      host.innerHTML = "";
    }
    setActiveNav("contracts");
    setTitle("contracts");
    if (typeof window.refresh === "function") {
      try { window.refresh(); } catch (_) {}
    }
  }

  function openEnginePage(key) {
    closeLegacyV191Modal();
    const contracts = document.getElementById("contractsView");
    if (contracts) contracts.style.display = "none";

    setActiveNav(key);
    setTitle(key);

    // Prefer engine deep-link API (injected by tfrs16-engine)
    if (typeof window.__gkOpenInMainByKey === "function") {
      window.__gkOpenInMainByKey(key);
      const host = document.getElementById("v26PageHost");
      if (host) host.style.display = "block";
      // Period-picker etc. may reopen the old V19.1 popup — close it.
      setTimeout(closeLegacyV191Modal, 0);
      setTimeout(closeLegacyV191Modal, 250);
      return;
    }

    // Fallback: wait briefly for engine init
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (typeof window.__gkOpenInMainByKey === "function") {
        clearInterval(timer);
        window.__gkOpenInMainByKey(key);
        const host = document.getElementById("v26PageHost");
        if (host) host.style.display = "block";
        closeLegacyV191Modal();
      } else if (tries > 20) {
        clearInterval(timer);
        window.showToast("Modül henüz yüklenmedi. Sayfayı yenileyin.", "error");
        showContractsView();
      }
    }, 150);
  }

  function initNav() {
    document.querySelectorAll(".nav-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        const view = btn.getAttribute("data-view");
        const open = btn.getAttribute("data-open") || "";
        document.getElementById("sidebar")?.classList.remove("open");
        if (view === "contracts") showContractsView();
        else if (view === "page" && open) openEnginePage(open);
      });
    });
  }

  /* ---------- Detail modal close helpers ---------- */
  function initDetailClose() {
    const close = () => {
      document.getElementById("detailModal")?.classList.add("hidden");
    };
    document.getElementById("closeDetailModal")?.addEventListener("click", close);
    document.getElementById("closeDetailModalFooter")?.addEventListener("click", close);
  }

  /* ---------- KPI bridge: engine's updateKPIs may write to different IDs;
     we expose a simple formatter and try to sync after refresh ---------- */
  function formatTry(n) {
    if (n == null || !Number.isFinite(Number(n))) return "—";
    try {
      return new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency: "TRY",
        maximumFractionDigits: 0
      }).format(Number(n));
    } catch (_) {
      return String(Math.round(Number(n)));
    }
  }

  window.__shellUpdateKpis = function (metrics) {
    if (!metrics) return;
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    if (metrics.count != null) set("kpiContractCount", String(metrics.count));
    if (metrics.liability != null) set("kpiLiability", formatTry(metrics.liability));
    if (metrics.rou != null) set("kpiRou", formatTry(metrics.rou));
    if (metrics.current != null) set("kpiCurrent", formatTry(metrics.current));
  };

  /* ---------- Session display (token / role if present) ---------- */
  function refreshUserChip() {
    try {
      const token =
        localStorage.getItem("access_token") ||
        localStorage.getItem("gk_backend_jwt");
      const nameEl = document.getElementById("userName");
      const roleEl = document.getElementById("userRole");
      const av = document.getElementById("userAvatar");
      if (!token) {
        if (nameEl) nameEl.textContent = "Misafir";
        if (roleEl) roleEl.textContent = "Giriş yapılmadı";
        if (av) av.textContent = "?";
        return;
      }
      let user = null;
      try {
        user = JSON.parse(localStorage.getItem("current_user") || "null");
      } catch (_) {}
      const displayName = String(
        user?.displayName || user?.name || user?.username || "Oturum açık"
      ).trim();
      const role = String(user?.role || user?.roleName || "JWT aktif").trim();
      if (nameEl) nameEl.textContent = displayName || "Oturum açık";
      if (roleEl) roleEl.textContent = role || "JWT aktif";
      if (av) av.textContent = (displayName || "U").slice(0, 1).toUpperCase();
    } catch (_) {}
  }

  /* ---------- Active company bridge ----------
     The engine owns the company context. The shell only mirrors it into the
     topbar selector and the legacy contract filter, so existing calculations
     and API paths remain untouched. */
  function syncCompanySelector() {
    const select = document.getElementById("v26ActiveCompanySelect");
    if (!select) return;
    const api = window.GK_TFRS16 || window.__TFRS16_TEST__;
    const options = api && typeof api.getUnifiedCompanyOptions === "function"
      ? api.getUnifiedCompanyOptions()
      : [];
    const active = api && typeof api.getActiveCompanyId === "function"
      ? api.getActiveCompanyId()
      : "ALL";
    const signature = [active].concat(options.map(c => `${c.id}:${c.name}`)).join("|");
    if (select.dataset.signature !== signature) {
      select.innerHTML = `<option value="ALL">Tüm Şirketler</option>`;
      options.forEach(company => {
        const option = document.createElement("option");
        option.value = String(company.id);
        option.textContent = String(company.name || company.id);
        select.appendChild(option);
      });
      select.dataset.signature = signature;
    }
    select.value = Array.from(select.options).some(option => option.value === active) ? active : "ALL";
  }

  function initCompanySelector() {
    const select = document.getElementById("v26ActiveCompanySelect");
    if (!select || select.dataset.bound === "true") return;
    select.dataset.bound = "true";
    select.addEventListener("change", () => {
      const api = window.GK_TFRS16 || window.__TFRS16_TEST__;
      if (api && typeof api.setActiveCompanyId === "function") {
        api.setActiveCompanyId(select.value);
      }
      const legacyFilter = document.getElementById("companyFilter");
      if (legacyFilter) {
        const selected = select.options[select.selectedIndex];
        legacyFilter.value = selected?.value === "ALL" ? "all" : (selected?.textContent || "all");
        legacyFilter.dispatchEvent(new Event("change", { bubbles: true }));
      } else if (typeof window.refresh === "function") {
        try { window.refresh(); } catch (_) {}
      }
    });
    syncCompanySelector();
  }

  /**
   * Engine still has V19.1 floating modals (v191Show). In SaaS shell we prefer
   * in-page views via __gkOpenInMainByKey. Redirect known openers so period
   * pickers / legacy links do not stack a second broken popup.
   */
  function rewireLegacyOpeners() {
    const map = {
      v191OpenFinancialReporting: "financialReporting",
      v191OpenRiskControls: "riskControls",
      v191OpenMonthEndClose: "close",
      v191OpenCfoDashboard: "close"
    };
    Object.keys(map).forEach((fnName) => {
      const key = map[fnName];
      const wrap = () => {
        closeLegacyV191Modal();
        openEnginePage(key);
      };
      try {
        if (typeof window[fnName] === "function") window[fnName] = wrap;
        if (window.GK_TFRS16 && typeof window.GK_TFRS16[fnName] === "function") {
          window.GK_TFRS16[fnName] = wrap;
        }
        if (window.__TFRS16_TEST__ && typeof window.__TFRS16_TEST__[fnName] === "function") {
          window.__TFRS16_TEST__[fnName] = wrap;
        }
      } catch (_) {}
    });
    // Observe late-created V19 modal and keep it closed when page host is active
    try {
      const obs = new MutationObserver(() => {
        const host = document.getElementById("v26PageHost");
        const modal = document.getElementById("v191FunctionalModal");
        if (!modal || modal.classList.contains("hidden")) return;
        if (host && host.style.display !== "none" && host.innerHTML.trim()) {
          modal.classList.add("hidden");
        }
      });
      obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    } catch (_) {}
  }

  /* ---------- Boot ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    initMobileMenu();
    initNav();
    initDetailClose();
    refreshUserChip();
    initCompanySelector();

    // Soft-hook: after engine hydrates, try to fill KPIs from global GK_TFRS16
    setTimeout(() => {
      try {
        rewireLegacyOpeners();
        const api = window.GK_TFRS16 || window.__TFRS16_TEST__;
        if (!api) return;
        // TFRS16 engine owns the KPI cards and applies the correct reporting
        // currency/available FX date. The legacy bridge exposes raw functional
        // currency amounts and would overwrite them with a forced TRY symbol.
        // Leave the engine-owned cards untouched.
        if (document.getElementById("kpiDataAsOf")) return;
        syncCompanySelector();
        // Best-effort: some engines expose aggregate helpers
        if (typeof api.getTotalLeaseLiability === "function") {
          const liability = api.getTotalLeaseLiability();
          const rou = typeof api.getTotalRuoAssets === "function" ? api.getTotalRuoAssets() : null;
          const current = typeof api.getCurrentLeaseLiability === "function" ? api.getCurrentLeaseLiability() : null;
          const list = typeof api.contracts !== "undefined" ? api.contracts : null;
          window.__shellUpdateKpis({
            count: Array.isArray(list) ? list.length : null,
            liability,
            rou,
            current
          });
        }
      } catch (_) {}
    }, 2500);
  });

  // Expose for engine / debugging
  window.__GK_SHELL__ = {
    showContractsView,
    openEnginePage,
    setTitle
  };
})();
