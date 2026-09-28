/* LeaseQant UI v2 — sunum yardımcısı (Faz 1 + Faz 2 dönem şeridi).
   - Hesaplama, API çağrısı veya kalıcı veri yazımı yapmaz.
   - Mevcut DOM kimliklerini taşımaz/yeniden adlandırmaz; yalnızca
     şirket seçicisini (aynı öğe, aynı dinleyiciler) bağlam çubuğuna taşır.
   - Dönem seçimi js/lq-reporting-period.js içindeki ortak durumdadır.
   - html[data-lq-ui="2"] değilse hiçbir şey yapmaz (?ui=legacy). */
((global) => {
  "use strict";
  const root = document.documentElement;
  if (root.getAttribute("data-lq-ui") !== "2") return;

  const $ = id => document.getElementById(id);

  /* ---------- Tutar mı, durum metni mi? ---------- */
  const VALUE_IDS = [
    "lqTotalLiability", "lqTotalRou", "lqActiveContracts", "lqCurrentLiability",
    "lqNext12Payments", "lqMonthlyInterest", "lqMonthlyDep", "lqCurrentLegend",
    "lqNonCurrentLegend", "lqReadinessScore", "lqCurrentPct", "lqRenewalCount",
    "lqModificationCount", "kpiLiability", "kpiRou", "kpiCurrent", "kpiContractCount",
    "lqLiabilityBars", "lqAssetLegend"
  ];
  const NUMERIC = /^[(\-−]?\s*(?:[₺$€£]\s?)?\d[\d.\s]*(?:,\d+)?\s*%?\)?(?:\s?(?:TRY|USD|EUR|GBP|TL|₺))?$/;
  const ERROR_WORDS = /alınamadı|hata|başarısız|kullanılamıyor/i;
  const NEUTRAL_WORDS = /şirket seçin|sözleşme yok|aktif sözleşme yok|yükleniyor/i;

  function classify(el) {
    if (!el) return;
    if (el.children.length) {
      el.removeAttribute("data-lq-state");
      el.removeAttribute("data-lq-tone");
      return;
    }
    const text = (el.textContent || "").trim();
    let state = "value";
    if (!text || text === "—") state = "empty";
    else if (!NUMERIC.test(text)) state = "status";
    if (el.getAttribute("data-lq-state") !== state) el.setAttribute("data-lq-state", state);
    if (state === "status") {
      const tone = ERROR_WORDS.test(text) ? "error" : (NEUTRAL_WORDS.test(text) ? "neutral" : "warn");
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

    const buttons = [];
    const render = () => {
      const r = api.get();
      buttons.forEach(btn => {
        const on = btn.dataset.key === r.key;
        btn.setAttribute("aria-checked", String(on));
        btn.tabIndex = on ? 0 : -1;
      });
      date.textContent = formatDate(r.reportingDate);
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
    buildContextBar();
    watchValues();
    watchJournalPage();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})(window);
