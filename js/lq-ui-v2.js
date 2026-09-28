/* LeaseQant UI v2 — Faz 1 sunum yardımcısı.
   - Hesaplama, API çağrısı veya kalıcı veri yazımı yapmaz.
   - Mevcut DOM kimliklerini taşımaz/yeniden adlandırmaz; yalnızca
     şirket seçicisini (aynı öğe, aynı dinleyiciler) bağlam çubuğuna taşır.
   - html[data-lq-ui="2"] değilse hiçbir şey yapmaz (?ui=legacy). */
(() => {
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
  const NEUTRAL_WORDS = /şirket seçin|sözleşme yok|aktif sözleşme yok/i;

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

  /* ---------- Bağlam çubuğu ---------- */
  // Raporlar bugün tfrs16-report-authority-ui.js içindeki defaultPeriod() ile
  // "önceki ayın son günü" tarihine göre üretiliyor. Burada aynı kural yalnızca
  // GÖSTERİLİR; tarih seçimi Faz 2'de ortak dönem durumuna bağlanacak.
  function reportingDateLabel() {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    const dd = String(end.getDate()).padStart(2, "0");
    const mm = String(end.getMonth() + 1).padStart(2, "0");
    return `${dd}.${mm}.${end.getFullYear()}`;
  }

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

    const period = document.createElement("div");
    period.className = "lq-ctx-period";
    const small = document.createElement("small");
    small.textContent = "RAPORLAMA TARİHİ";
    const b = document.createElement("b");
    b.textContent = reportingDateLabel();
    b.title = "Raporlar önceki ayın son günü itibarıyla üretilir.";
    period.append(small, b);

    bar.append(title, period);
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
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
