/* LeaseQant UI v2 — tasarımdaki sayfalar: Genel Bakış, Sözleşmeler, Finansal
   Raporlama (Hesaplama sonuçları).

   Kurallar:
   - Tutarlar yalnızca sunucunun doğrulanmış paketlerinden gelir:
     raporlama paketi (LeaseQantReportingAuthorityUi.load) ve dipnot paketi
     (LeaseQantPrivateTfrs16Facade.loadLeaseDisclosure*). Bu modül toplam, oran
     veya bakiye hesaplamaz; yalnızca sayar, sıralar, filtreler ve çizer.
     Tek istisna köprü grafiğindeki "mutabakat farkı"dır (kapanış − hareketler);
     ekranda "fark" diye etiketlidir (LeaseQantDashboardCharts.bridgeModel).
   - Eski ekranlar DOM'da kalır (gizlenir); düğmeler eski öğeleri tıklar
     (#newContractButton, #bulkImportButton, menü öğeleri), kayıt akışları değişmez.
   - html[data-lq-ui="2"] değilse hiçbir şey yapmaz. */
((global) => {
  "use strict";
  const doc = global.document;
  const root = doc.documentElement;

  /* ---------- Biçim ---------- */
  const esc = v => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const isNum = v => typeof v === "number" && Number.isFinite(v);
  const nf0 = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
  const nf2 = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const acc0 = v => isNum(v) ? (v < 0 ? `(${nf0.format(-v)})` : nf0.format(v)) : "—";
  const acc2 = v => isNum(v) ? (v < 0 ? `(${nf2.format(-v)})` : nf2.format(v)) : "—";
  const trDate = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || "")); return m ? `${m[3]}.${m[2]}.${m[1]}` : "—"; };
  const MONTHS_LONG = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  const monthName = iso => { const m = /^(\d{4})-(\d{2})/.exec(String(iso || "")); return m ? `${MONTHS_LONG[+m[2] - 1]} ${m[1]}` : ""; };
  const OK = new Set(["SUPPORTED", "ZERO_CONFIRMED"]);
  const mv = m => (m && OK.has(m.status) && isNum(m.value)) ? m.value : null;
  const fv = f => (f && typeof f === "object" && OK.has(f.status) && isNum(f.value)) ? f.value : null;
  const FIELD_STATUS = {
    REQUIRES_LEDGER_DATA: "Defter verisi gerekli", REQUIRES_ENTITY_INPUT: "Girdi gerekli", NOT_SUPPORTED: "Desteklenmiyor",
    NOT_APPLICABLE: "Uygulanmıyor", NOT_PROVIDED: "Kaynak gerekli", NOT_CALCULABLE: "Kaynak gerekli", BACKEND_FIELD_MISSING: "Alan yok"
  };
  const fieldCell = f => {
    const v = fv(f);
    if (v !== null) return `<span>${acc0(v)}</span>`;
    const s = f && f.status;
    return `<span class="lq-pg-need${s === "NOT_APPLICABLE" ? " is-na" : ""}">${esc(FIELD_STATUS[s] || "Kaynak gerekli")}</span>`;
  };
  const REASONS = {
    REPORTING_CURRENCY_PROFILE_REQUIRED: "Şirketin onaylı para birimi profili yok",
    REPORTING_ROUTE_NOT_SUPPORTED: "Desteklenmeyen ödeme sıklığı/zamanı",
    REPORTING_SOURCE_FACTS_NOT_READY: "Sözleşme verisi eksik",
    REPORTING_SOURCE_NOT_READY: "Doğrulanmış kaynak yok",
    LEASE_TERM_EVIDENCE_REQUIRED: "Kira süresi değerlendirme referansı eksik",
    RENEWAL_OPTION_JUDGEMENT_REQUIRED: "Yenileme opsiyonu kararı eksik",
    TERMINATION_OPTION_JUDGEMENT_REQUIRED: "Fesih opsiyonu kararı eksik",
    PURCHASE_OPTION_JUDGEMENT_REQUIRED: "Satın alma opsiyonu kararı eksik",
    RENEWAL_END_DATE_REQUIRED: "Yenileme sonrası bitiş tarihi eksik",
    TERMINATION_DATE_REQUIRED: "Fesih tarihi eksik veya süre dışında",
    LEASE_TERM_OPTIONS_CONFLICT: "Yenileme ve fesih birlikte kesin olamaz",
    TERMINATION_PENALTY_MEASUREMENT_UNSUPPORTED: "Kesin fesihte ceza ölçümü desteklenmiyor",
    PURCHASE_OPTION_PRICE_MEASUREMENT_UNSUPPORTED: "Kesin satın almada bedel ölçümü desteklenmiyor",
    SHORT_TERM_EXEMPTION_INELIGIBLE: "Kısa vadeli istisna için süre 12 ayı aşıyor",
    REPORTING_FX_RATE_REQUIRED: "Doğrulanmış TCMB kuru eksik",
    REPORTING_LIFECYCLE_EVENTS_NOT_SUPPORTED: "Endeks/enflasyon düzeltmesi, erken ödeme vb. olaylar raporda henüz yok",
    REPORTING_LIFECYCLE_FREQUENCY_NOT_SUPPORTED: "Düzensiz ödeme planında modifikasyon henüz raporlanmıyor",
    REPORTING_LIFECYCLE_EVENT_NOT_APPLIED: "Olayın durumu veya yürürlük tarihi eksik",
        REPORTING_SALE_LEASEBACK_NOT_SUPPORTED: "Satış ve geri kiralama raporda henüz yok",
        REPORTING_FINANCE_SUBLEASE_NOT_SUPPORTED: "Finansal alt kiralama raporda henüz yok",
        REPORTING_SUBLEASE_CURRENCY_NOT_SUPPORTED: "Alt kiralama para birimi ana kiralamadan farklı",
        REPORTING_SUBLEASE_INVALID: "Alt kiralama şartları eksik veya geçersiz",
        REPORTING_LIFECYCLE_EXEMPTION_NOT_SUPPORTED: "İstisna kapsamındaki sözleşmede modifikasyon desteklenmiyor",
    REPORTING_FEATURE_NOT_SUPPORTED: "Desteklenmeyen sözleşme özelliği",
    PAYMENT_STUB_UNSUPPORTED: "Kira süresi ödeme dönemlerine tam bölünmüyor",
    ESCALATION_POLICY_UNSUPPORTED: "Özel artış dönemi desteklenmiyor"
  };
  const reason = code => REASONS[code] || "Kaynak hazır değil";
  const ICON_CHECK = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"></path></svg>';

  /* ---------- Saf yardımcılar (testte çağrılır) ---------- */
  function daysBetween(fromIso, toIso) {
    const a = Date.parse(`${String(fromIso).slice(0, 10)}T00:00:00Z`), b = Date.parse(`${String(toIso).slice(0, 10)}T00:00:00Z`);
    return isNum(a) && isNum(b) ? Math.round((b - a) / 86400000) : null;
  }
  function monthsLeft(reportingDate, endDate) {
    const a = /^(\d{4})-(\d{2})/.exec(String(reportingDate || "")), b = /^(\d{4})-(\d{2})/.exec(String(endDate || ""));
    if (!a || !b) return null;
    return Math.max(0, (+b[1] - +a[1]) * 12 + (+b[2] - +a[2]));
  }
  /* Sözleşme listesi: görünüm, filtre, sıralama. Tutar üretmez. */
  function contractRows(contracts, reports, opts) {
    const o = opts || {};
    const term = String(o.search || "").trim().toLocaleLowerCase("tr-TR");
    const rd = o.reportingDate;
    const rows = (contracts || []).map(c => {
      const rep = reports && reports.get(String(c.companyId));
      const row = rep && rep.pkg && Array.isArray(rep.pkg.contracts) ? rep.pkg.contracts.find(r => String(r.contractId) === String(c.id)) || null : null;
      let scope = "unknown";
      if (rep && rep.error) scope = "error";
      else if (rep && rep.pkg) scope = row ? (row.status === "SUPPORTED" ? "ok" : "out") : (String(c.status).toLowerCase() === "active" ? "missing" : "inactive");
      else if (rep) scope = "loading";
      const days = rd ? daysBetween(rd, c.endDate) : null;
      return {
        c, row, scope, reason: row && row.status !== "SUPPORTED" ? row.reason : null,
        liability: row && row.status === "SUPPORTED" ? mv(row.metrics.leaseLiability) : null,
        rou: row && row.status === "SUPPORTED" ? mv(row.metrics.rouCarryingAmount) : null,
        left: rd ? monthsLeft(rd, c.endDate) : null,
        ending: days !== null && days >= 0 && days <= 90,
        active: String(c.status || "").toLowerCase() === "active"
      };
    });
    const views = {
      all: rows,
      active: rows.filter(r => r.active),
      inactive: rows.filter(r => !r.active),
      ending: rows.filter(r => r.active && r.ending),
      out: rows.filter(r => r.scope === "out")
    };
    let list = views[o.view] || rows;
    if (o.company && o.company !== "all") list = list.filter(r => String(r.c.companyId) === String(o.company));
    if (o.assetClass && o.assetClass !== "all") list = list.filter(r => String(r.c.assetClass || "") === o.assetClass);
    if (o.currency && o.currency !== "all") list = list.filter(r => String(r.c.currency || "").toUpperCase() === o.currency);
    if (term) list = list.filter(r => `${r.c.id} ${r.c.supplier || ""} ${r.c.company || ""}`.toLocaleLowerCase("tr-TR").includes(term));
    const key = o.sort || "id", dir = o.dir === "desc" ? -1 : 1;
    const val = r => key === "supplier" ? String(r.c.supplier || "") : key === "end" ? String(r.c.endDate || "")
      : key === "payment" ? Number(r.c.monthlyPayment) || 0 : key === "liability" ? (r.liability ?? -Infinity)
      : key === "company" ? String(r.c.company || "") : String(r.c.id || "");
    list = list.slice().sort((a, b) => {
      const x = val(a), y = val(b);
      return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "tr")) * dir;
    });
    return { list, counts: Object.fromEntries(Object.entries(views).map(([k, v]) => [k, v.length])) };
  }

  function disclosureState(pkg) {
    const missing = Array.isArray(pkg?.missingInputs) ? pkg.missingInputs : [];
    const supported = new Set(["SUPPORTED", "SUPPORTED_AUTOMATIC", "SUPPORTED_WITH_ENTITY_INPUT", "SUPPORTED_WITH_LEDGER_INPUT", "SUPPORTED_WITH_DISCLOSURE_INPUT", "NOT_APPLICABLE"]);
    const unsupported = (Array.isArray(pkg?.supportStatus) ? pkg.supportStatus : []).filter(x => !supported.has(x.supportedStatus));
    const issues = [...new Set([...missing.map(x => x.fieldId || x.requirementId || "Eksik kaynak"), ...unsupported.map(x => x.requirementId || "Desteklenmeyen gereklilik")])];
    const status = pkg?.validation?.status;
    const complete = status === "COMPLETE_FOR_SUPPORTED_SCOPE" && issues.length === 0;
    return { complete, issues, status, label: complete ? "Desteklenen kapsam tamam" : issues.length ? `${issues.length} eksik / desteklenmeyen kalem` : "Tamlık doğrulanmadı" };
  }
  const helpers = Object.freeze({ contractRows, monthsLeft, daysBetween, disclosureState });
  if (root.getAttribute("data-lq-ui") !== "2") { global.LeaseQantPages = helpers; return; }

  /* ---------- Veri ---------- */
  const $ = id => doc.getElementById(id);
  const AUI = () => global.LeaseQantReportingAuthorityUi;
  const TTL = 90000;
  const reportCache = new Map(), disclosureCache = new Map();
  let companiesPromise = null, companiesAt = 0;

  const period = () => { try { return AUI()?.defaultPeriod?.() || null; } catch (_) { return null; } };
  const activeCompany = () => $("v26ActiveCompanySelect")?.value || "ALL";
  const engineContracts = () => { try { return global.GK_TFRS16?.getPortfolioContracts?.() || []; } catch (_) { return []; } };
  const openDetail = id => { try { global.GK_TFRS16?.openDetail?.(String(id)); } catch (_) {} };
  const openNav = key => doc.querySelector(`#sidebarNav .nav-item[data-open="${key}"], .nav-item[data-open="${key}"]`)?.click();
  const openView = key => doc.querySelector(`.nav-item[data-view="${key}"]`)?.click();

  function companies() {
    if (companiesPromise && Date.now() - companiesAt < TTL) return companiesPromise;
    companiesAt = Date.now();
    companiesPromise = Promise.resolve().then(() => AUI().companies()).catch(e => { companiesPromise = null; throw e; });
    return companiesPromise;
  }
  function report(companyId) {
    const p = period();
    const key = `${companyId}|${p.periodStart}|${p.periodEnd}`;
    const hit = reportCache.get(key);
    if (hit && Date.now() - hit.at < TTL) return hit.promise;
    const promise = Promise.resolve().then(() => AUI().load({ companyId: String(companyId), ...p }));
    reportCache.set(key, { at: Date.now(), promise });
    promise.catch(() => reportCache.delete(key));
    return promise;
  }
  function disclosure(companyId) {
    const p = period();
    const req = { companyId: String(companyId), reportingPeriodStart: p.periodStart, reportingPeriodEnd: p.periodEnd, reportingDate: p.reportingDate };
    const key = `${req.companyId}|${req.reportingPeriodStart}|${req.reportingDate}`;
    const hit = disclosureCache.get(key);
    if (hit && Date.now() - hit.at < TTL) return hit.promise;
    const facade = global.LeaseQantPrivateTfrs16Facade;
    const promise = (async () => {
      if (!facade?.loadLeaseDisclosureAvailability || !facade?.loadLeaseDisclosure) throw Object.assign(new Error("x"), { code: "ADAPTER_UNAVAILABLE" });
      const av = await facade.loadLeaseDisclosureAvailability(req);
      const pkg = await facade.loadLeaseDisclosure(av);
      if (!global.LeaseQantDashboardCharts?.scopeOk?.(pkg, req, av)) throw Object.assign(new Error("scope"), { code: "SCOPE_MISMATCH" });
      return pkg;
    })();
    disclosureCache.set(key, { at: Date.now(), promise });
    promise.catch(() => disclosureCache.delete(key));
    return promise;
  }
  const settle = pr => pr.then(v => ({ ok: true, v }), e => ({ ok: false, e }));
  const charts = () => global.LeaseQantDashboardCharts || {};

  /* ---------- Ortak parçalar ---------- */
  const head = (title, sub, actions = "") => `<div class="lq-pg-head"><div><h1 class="lq-pg-h1">${esc(title)}</h1><div class="lq-pg-sub">${sub}</div></div><div class="lq-pg-actions">${actions}</div></div>`;
  const btn = (label, attrs = "", tone = "") => `<button type="button" class="lq-pg-btn${tone ? ` is-${tone}` : ""}" ${attrs}>${label}</button>`;
  const skel = n => `<div class="lq-pg-skel" aria-hidden="true">${"<i></i>".repeat(n || 3)}</div><span class="lq-sr">Yükleniyor</span>`;
  const notice = (html, tone = "info") => `<div class="lq-pg-note is-${tone}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5"></path><path d="M12 8v.5"></path></svg><span>${html}</span></div>`;
  function errText(e) {
    const code = e?.code;
    if (e?.status === 401) return "Oturum açmanız gerekiyor.";
    if (e?.status === 403 || /ACCESS_DENIED/.test(code || "")) return "Bu şirket için erişim yetkiniz yok.";
    if (code === "DISCLOSURE_TRUSTED_SOURCE_REQUIRED") return "Seçilen dönem için onaylı dipnot hesaplama kaydı yok.";
    if (code === "SCOPE_MISMATCH") return "Sunucu yanıtı seçilen şirket/dönemle uyuşmadı.";
    return "Veri alınamadı. Lütfen daha sonra tekrar deneyin.";
  }
  function downloadCsv(rows, name) {
    if (!rows.length) return;
    const keys = Object.keys(rows[0]);
    const cell = v => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
    const text = [keys.map(cell).join(";"), ...rows.map(r => keys.map(k => cell(r[k])).join(";"))].join("\r\n");
    const url = global.URL.createObjectURL(new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" }));
    // Safari only starts a download from an anchor that is in the document.
    const a = doc.createElement("a"); a.href = url; a.download = name; a.hidden = true;
    doc.body.appendChild(a); a.click(); a.remove();
    global.setTimeout(() => global.URL.revokeObjectURL(url), 1000);
  }

  /* =========================================================
     GENEL BAKIŞ
     ========================================================= */
  const ov = { seq: 0 };
  function overviewHost() {
    const dash = $("lqDashboard");
    if (!dash) return null;
    let host = $("lqOverview");
    if (!host) {
      host = doc.createElement("div");
      host.id = "lqOverview";
      host.className = "lq-pg";
      host.addEventListener("click", onOverviewClick);
      dash.prepend(host);
      root.setAttribute("data-lq-overview", "on");
    }
    return host;
  }

  function onOverviewClick(e) {
    const t = e.target.closest("[data-pg]");
    if (!t) return;
    const a = t.getAttribute("data-pg");
    if (a === "company") { const s = $("v26ActiveCompanySelect"); if (s) { s.value = t.getAttribute("data-id"); s.dispatchEvent(new Event("change", { bubbles: true })); } }
    else if (a === "contracts") { contractsState.view = t.getAttribute("data-view") || "all"; openView("contracts"); }
    else if (a === "nav") openNav(t.getAttribute("data-key"));
    else if (a === "export") { const p = ov.pkg; if (p) { try { AUI().exportPackage(p, "xlsx"); } catch (_) { try { AUI().exportPackage(p, "csv"); } catch (_) {} } } }
  }

  async function renderOverview() {
    const dash = $("lqDashboard");
    if (!dash || dash.hidden) return;
    const host = overviewHost();
    if (!host) return;
    const seq = ++ov.seq;
    const p = period();
    const company = activeCompany();
    const all = engineContracts();
    if (company === "ALL") {
      host.innerHTML = head("Genel Bakış", `${esc(trDate(p.reportingDate))} itibarıyla · ${all.length} sözleşme kaydı · Şirket seçin`)
        + `<div class="lq-pg-grid-3" id="lqOvCompanies">${skel(3)}</div>`
        + notice("Finansal tutarlar şirket bazında doğrulanır; farklı şirketlerin ve para birimlerinin bakiyeleri toplanmaz.");
      let scope = [];
      try { scope = await companies(); } catch (_) {}
      if (seq !== ov.seq) return;
      const box = $("lqOvCompanies");
      if (!box) return;
      if (!scope.length) { box.innerHTML = `<div class="lq-pg-card lq-pg-pad">Erişebildiğiniz şirket yok.</div>`; return; }
      box.innerHTML = scope.map(c => `<article class="lq-pg-card lq-pg-pad lq-pg-company"><span class="lq-pg-kick">ŞİRKET</span><strong>${esc(c.name || c.id)}</strong>
        <span class="lq-pg-muted">${all.filter(x => String(x.companyId) === String(c.id)).length} sözleşme</span>
        <span class="lq-pg-num" data-ov-liab="${esc(c.id)}">…</span>${btn("Aç", `data-pg="company" data-id="${esc(c.id)}"`)}</article>`).join("");
      scope.forEach(async c => {
        const r = await settle(report(c.id));
        if (seq !== ov.seq) return;
        const el = Array.from(host.querySelectorAll("[data-ov-liab]")).find(x => x.getAttribute("data-ov-liab") === String(c.id));
        if (!el) return;
        const v = r.ok ? mv(r.v.totals.leaseLiability) : null;
        el.innerHTML = v !== null ? `<small>Kira yükümlülüğü</small>${acc0(v)} ${esc(r.v.identity.presentationCurrency || "")}` : `<small>Kira yükümlülüğü</small><span class="lq-pg-muted lq-pg-small">${r.ok ? `Tam kapsam yok · ${r.v.population.excludedCount} sözleşme kapsam dışı` : "Alınamadı"}</span>`;
      });
      return;
    }

    host.innerHTML = head("Genel Bakış", `${esc(trDate(p.reportingDate))} itibarıyla · yükleniyor…`,
      btn("Rapor paketi indir", 'data-pg="export" disabled') + btn("Kapanışa devam et", 'data-pg="nav" data-key="close"', "primary"))
      + `<div id="lqOvRunway">${skel(2)}</div><div class="lq-pg-grid-4" id="lqOvKpis">${skel(4)}</div>
      <div class="lq-pg-row"><section class="lq-pg-card lq-pg-pad lq-pg-grow7" id="lqOvBridge">${skel(4)}</section><section class="lq-pg-card lq-pg-pad lq-pg-grow5" id="lqOvMaturity">${skel(4)}</section></div>
      <div class="lq-pg-grid-3"><section class="lq-pg-card lq-pg-pad" id="lqOvActions">${skel(3)}</section><section class="lq-pg-card lq-pg-pad" id="lqOvClasses">${skel(3)}</section><section class="lq-pg-card lq-pg-pad" id="lqOvScope">${skel(3)}</section></div>`;
    const [r, d] = await Promise.all([settle(report(company)), settle(disclosure(company))]);
    if (seq !== ov.seq || !host.isConnected) return;
    const pkg = r.ok ? r.v : null;
    ov.pkg = pkg;
    const cur = pkg?.identity?.presentationCurrency || "";
    const compContracts = all.filter(c => String(c.companyId) === String(company));
    const activeCount = pkg ? pkg.population.count : compContracts.filter(c => String(c.status).toLowerCase() === "active").length;
    const sub = host.querySelector(".lq-pg-sub");
    if (sub) sub.innerHTML = `${esc(trDate(p.reportingDate))} itibarıyla · ${esc(pkg?.identity?.companyName || "")} · ${activeCount} aktif sözleşme${cur ? ` · Tutarlar ${esc(cur)}` : ""}`;
    const exp = host.querySelector('[data-pg="export"]');
    if (exp) exp.disabled = !pkg;

    // Kapanış pisti — yalnızca doğrulanabilen adımlar işaretlenir
    const checks = pkg?.controls?.checks || [];
    const failing = checks.filter(c => c.status && c.status !== "PASS").length;
    const ds = disclosureState(d.ok ? d.v : null);
    const steps = [
      ["Sözleşme kapsamı", !pkg ? "unknown" : pkg.population.excludedCount ? "warn" : "done", pkg ? (pkg.population.excludedCount ? `${pkg.population.excludedCount} kapsam dışı` : "Tam kapsam") : "Alınamadı"],
      ["Hesaplama kontrolleri", !pkg || pkg.controls.status === "NOT_READY" ? "unknown" : failing ? "warn" : "done", !pkg ? "—" : pkg.controls.status === "NOT_READY" ? "Hazır değil" : failing ? `${failing} kontrol uyarı` : `${checks.length} kontrol geçti`],
      ["Dipnot tamlığı", d.ok && ds.complete ? "done" : "warn", d.ok ? ds.label : (d.e?.code === "DISCLOSURE_TRUSTED_SOURCE_REQUIRED" ? "Kaynak üretilmeli" : "Alınamadı")],
      ["Yevmiye", "unknown", "Önizlemede kontrol edin"],
      ["Dönem kilidi", "unknown", "Kapanış panelinde"]
    ];
    const done = steps.filter(s => s[1] === "done").length;
    const stepHtml = steps.map(([label, st, note], i) => `${i ? `<i class="lq-pg-rail is-${steps[i - 1][1] === "done" ? "done" : "todo"}"></i>` : ""}<span class="lq-pg-step is-${st}" title="${esc(note)}"><b aria-hidden="true">${st === "done" ? ICON_CHECK : st === "warn" ? "!" : ""}</b><span>${esc(label)}<small>${esc(note)}</small></span></span>`).join("");
    $("lqOvRunway").innerHTML = `<section class="lq-pg-card lq-pg-runway" aria-label="Kapanış durumu"><div class="lq-pg-runway-t"><span class="lq-pg-kick">${esc(monthName(p.reportingDate).toLocaleUpperCase("tr-TR"))} KAPANIŞI</span><strong>${done} / ${steps.length} doğrulandı</strong></div><div class="lq-pg-steps">${stepHtml}</div></section>`;

    // Göstergeler
    const t = pkg?.totals || {};
    const srcLine = pkg ? `<div class="lq-pg-src is-ok">${ICON_CHECK}Sunucu raporu · ${esc(trDate(pkg.period.reportingDate))}</div>` : `<div class="lq-pg-src is-warn">Rapor alınamadı</div>`;
    const reasonAll = pkg && pkg.population.excludedCount ? [...new Set(pkg.population.exclusions.map(x => x.reason))] : [];
    const valueOr = m => { const v = mv(m); return v !== null ? acc0(v) : "—"; };
    const gapNote = pkg && pkg.population.excludedCount
      ? `<div class="lq-pg-small is-warn">${pkg.population.excludedCount} sözleşme kapsam dışı (${esc(reason(reasonAll[0]))}); eksik toplam gösterilmez.</div>` : "";
    const gapShort = gapNote ? '<div class="lq-pg-small is-warn">Eksik kapsam · toplam yok</div>' : "";
    const liab = mv(t.leaseLiability), curL = mv(t.currentLiability), ncL = mv(t.nonCurrentLiability);
    const shortPct = liab && curL !== null ? Math.max(0, Math.min(100, Math.round((curL / liab) * 100))) : null;
    const assetM = d.ok ? charts().assetModel?.(d.v) : null;
    $("lqOvKpis").innerHTML = `
      <article class="lq-pg-card lq-pg-kpi"><span class="lq-pg-kick">KİRA YÜKÜMLÜLÜĞÜ</span><span class="lq-pg-big">${valueOr(t.leaseLiability)}</span>
        ${shortPct !== null ? `<div class="lq-pg-split" role="img" aria-label="Kısa vade %${shortPct}"><i style="width:${shortPct}%"></i><i style="width:${100 - shortPct}%"></i></div>` : ""}
        <div class="lq-pg-kv2"><span>Kısa ${acc0(curL)}</span><span>Uzun ${acc0(ncL)}</span></div>${gapNote}${srcLine}</article>
      <article class="lq-pg-card lq-pg-kpi"><span class="lq-pg-kick">KULLANIM HAKKI VARLIĞI (NDD)</span><span class="lq-pg-big">${valueOr(t.rouCarryingAmount)}</span>
        ${assetM?.supported && assetM.items.length && assetM.total ? `<div class="lq-pg-split is-classes">${assetM.items.slice(0, 5).map((it, i) => `<i class="c${i}" style="width:${Math.max(2, Math.round((it.value / assetM.total) * 100))}%" title="${esc(it.label)}"></i>`).join("")}</div><div class="lq-pg-small lq-pg-muted">${esc(assetM.items.slice(0, 3).map(i => i.label).join(" · "))}</div>` : `<div class="lq-pg-small lq-pg-muted">Tarihi esas</div>`}${gapShort}${srcLine}</article>
      <article class="lq-pg-card lq-pg-kpi"><span class="lq-pg-kick">DÖNEM GİDERİ · ${esc(monthName(p.reportingDate).toLocaleUpperCase("tr-TR"))}</span>
        <div class="lq-pg-kv2 is-big"><span><small>Faiz</small>${valueOr(t.periodInterest)}</span><span><small>Amortisman</small>${valueOr(t.periodDepreciation)}</span></div>${mv(t.exemptLeaseExpense) ? `<div class="lq-pg-small lq-pg-muted">İstisna kira gideri (TFRS 16.6) ${acc0(mv(t.exemptLeaseExpense))}</div>` : ""}${gapShort}${srcLine}</article>
      <article class="lq-pg-card lq-pg-kpi"><span class="lq-pg-kick">AKTİF SÖZLEŞME</span><span class="lq-pg-big">${activeCount}</span>
        <div class="lq-pg-chips">${pkg ? `<span class="lq-pg-chipx">${pkg.population.includedCount} sertifikalı</span>${pkg.population.excludedCount ? `<span class="lq-pg-chipx is-warn">${pkg.population.excludedCount} kapsam dışı</span>` : ""}` : ""}</div>
        ${btn("Portföyü aç", 'data-pg="contracts" data-view="all"', "link")}</article>`;

    // Köprü
    const bridgeBox = $("lqOvBridge");
    if (d.ok) {
      const bm = charts().bridgeModel(d.v);
      bridgeBox.innerHTML = `<div class="lq-pg-cardhead"><div><span class="lq-pg-kick">YÜKÜMLÜLÜK KÖPRÜSÜ · ${esc(trDate(p.periodStart))}–${esc(trDate(p.periodEnd))}</span><h3>Açılıştan kapanışa ne değişti</h3></div><span class="lq-pg-muted lq-pg-small">${esc(bm.currency)}</span></div>${columnBridge(bm)}`;
    } else bridgeBox.innerHTML = `<div class="lq-pg-cardhead"><div><span class="lq-pg-kick">YÜKÜMLÜLÜK KÖPRÜSÜ</span><h3>Açılıştan kapanışa ne değişti</h3></div></div><p class="lq-pg-empty">${esc(errText(d.e))}</p>${d.e?.code === "DISCLOSURE_TRUSTED_SOURCE_REQUIRED" ? btn("Dipnotlarda kaynak oluştur", 'data-pg="nav" data-key="footnotes"', "link") : ""}`;
    // Vade analizi
    const matBox = $("lqOvMaturity");
    if (d.ok) {
      const mm = charts().maturityModel(d.v);
      matBox.innerHTML = `<div class="lq-pg-cardhead"><div><span class="lq-pg-kick">VADE ANALİZİ · İSKONTO EDİLMEMİŞ</span><h3>Nakit çıkışları</h3></div></div>${maturityColumns(mm)}`;
    } else matBox.innerHTML = `<div class="lq-pg-cardhead"><div><span class="lq-pg-kick">VADE ANALİZİ</span><h3>Nakit çıkışları</h3></div></div><p class="lq-pg-empty">${esc(errText(d.e))}</p>`;

    // Aksiyon merkezi
    const ending = compContracts.filter(c => { const n = daysBetween(p.reportingDate, c.endDate); return String(c.status).toLowerCase() === "active" && n !== null && n >= 0 && n <= 90; }).length;
    const acts = [];
    if (pkg?.population.excludedCount) acts.push(["warn", `${pkg.population.excludedCount} sözleşme hesaplanamadı`, "Listele", 'data-pg="contracts" data-view="out"']);
    if (failing) acts.push(["danger", `${failing} hesaplama kontrolü uyarı veriyor`, "İncele", 'data-pg="nav" data-key="riskControls"']);
    if (!pkg || pkg.controls.status === "NOT_READY") acts.push(["warn", "Rapor veya kontrol kaynağı doğrulanamadı", "İncele", 'data-pg="nav" data-key="riskControls"']);
    if (!d.ok) acts.push(["warn", "Dipnot paketi alınamadı: " + errText(d.e), "İncele", 'data-pg="nav" data-key="footnotes"']);
    else if (!ds.complete) {
      acts.push(["warn", "Dipnot: " + ds.label, "İncele", 'data-pg="nav" data-key="footnotes"']);
      ds.issues.forEach(id => acts.push(["warn", "Dipnot kaynağı / destek: " + id, "İncele", 'data-pg="nav" data-key="footnotes"']));
    }
    if (ending) acts.push(["warn", `${ending} sözleşme 90 gün içinde bitiyor`, "Listele", 'data-pg="contracts" data-view="ending"']);
    $("lqOvActions").innerHTML = `<span class="lq-pg-kick">AKSİYON MERKEZİ</span>${acts.length ? acts.map(([tone, text, label, attrs]) => `<button type="button" class="lq-pg-action" ${attrs}><i class="is-${tone}"></i><span>${esc(text)}</span><b>${label}</b></button>`).join("") : `<p class="lq-pg-empty is-ok">${ICON_CHECK} Bekleyen işlem yok.</p>`}`;
    // Varlık sınıfı
    const cls = $("lqOvClasses");
    if (assetM?.supported && assetM.items.length) {
      cls.innerHTML = `<span class="lq-pg-kick">VARLIK SINIFI · KHV NDD</span><div class="lq-pg-bars">${assetM.items.slice(0, 6).map(it => `<span>${esc(it.label)}</span><span class="lq-pg-bar"><i style="width:${Math.max(2, Math.round((it.value / (assetM.max || 1)) * 100))}%"></i></span><span class="lq-pg-num">${acc0(it.value)}</span>`).join("")}</div>`;
    } else cls.innerHTML = `<span class="lq-pg-kick">VARLIK SINIFI · KHV NDD</span><p class="lq-pg-empty">${esc(assetM ? assetM.status : errText(d.e))}</p>`;
    // Motor kapsamı
    const sc = $("lqOvScope");
    if (pkg && pkg.population.count) {
      const inc = pkg.population.includedCount, exc = pkg.population.excludedCount, tot = pkg.population.count;
      const byReason = {};
      pkg.population.exclusions.forEach(x => { byReason[x.reason] = (byReason[x.reason] || 0) + 1; });
      sc.innerHTML = `<span class="lq-pg-kick">MOTOR KAPSAMI</span><div class="lq-pg-split is-scope"><i style="width:${Math.round((inc / tot) * 100)}%"></i><i style="width:${Math.round((exc / tot) * 100)}%"></i></div>
        <div class="lq-pg-legend"><span><i class="is-ok"></i>Hesaplanan</span><b>${inc}</b>${Object.entries(byReason).map(([k, n]) => `<span><i class="is-warn"></i>${esc(reason(k))}</span><b>${n}</b>`).join("")}</div>`;
    } else sc.innerHTML = `<span class="lq-pg-kick">MOTOR KAPSAMI</span><p class="lq-pg-empty">${pkg ? "Bu dönemde aktif sözleşme yok." : esc(errText(r.e))}</p>`;
  }

  /* Dikey köprü (tasarımdaki gibi). Ölçek görseldir; tutarlar paketten gelir. */
  function columnBridge(bm) {
    const rows = bm.rows;
    const vals = [0];
    rows.forEach(r => { if (r.kind === "total") vals.push(r.value); else if (isNum(r.from)) vals.push(r.from, r.to); });
    let lo = Math.min(...vals), hi = Math.max(...vals);
    const H = 190;
    let base = 0;
    if (lo > 0) { const cut = lo - Math.max((hi - lo) * 0.6, hi * 0.03); if (cut > hi * 0.3) base = cut; lo = base; }
    const span = (hi - lo) || 1;
    const y = v => ((v - lo) / span) * H;
    const mn = Math.max(Math.abs(hi), Math.abs(lo)) >= 1e6;
    const fmt = v => mn ? (v < 0 ? `(${(Math.abs(v) / 1e6).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})` : (v / 1e6).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })) : acc0(v);
    const cols = rows.map(r => {
      let bar = "", label = "";
      if (r.kind === "total") { bar = `<i class="is-total" style="bottom:0;height:${Math.max(2, y(r.value)).toFixed(1)}px"></i>`; label = fmt(r.value); }
      else if (r.kind === "missing" || r.kind === "na") { bar = `<em class="lq-pg-need${r.kind === "na" ? " is-na" : ""}">${esc(r.kind === "na" ? "Uyg." : "Kaynak")}</em>`; label = "—"; }
      else { const b = Math.min(y(r.from), y(r.to)), h = Math.abs(y(r.to) - y(r.from)); bar = `<i class="is-${r.kind}" style="bottom:${b.toFixed(1)}px;height:${Math.max(2, h).toFixed(1)}px"></i>`; label = r.value > 0 ? `+${fmt(r.value)}` : fmt(r.value); }
      const short = { opening: "Açılış", additions: "Yeni", interest: "Faiz", payments: "Ödemeler", modifications: "Modifikasyon", remeasurements: "Yen. ölçüm", tms21: "Kur farkı TMS 21", residual: "Mutabakat farkı", closing: "Kapanış" }[r.id] || r.label;
      return `<div class="lq-pg-col is-${r.kind}" title="${esc(r.label)}${r.note ? " — " + esc(r.note) : ""}"><span class="lq-pg-colv">${label}</span><div class="lq-pg-colbar" style="height:${H}px">${bar}</div><span class="lq-pg-coll">${esc(short)}</span></div>`;
    }).join("");
    const foot = bm.residual !== null
      ? `<p class="lq-pg-small is-warn">Mutabakat farkı ${acc0(bm.residual)}: pakette ayrı satırı olmayan hareketler (TMS 29 parasal kazanç/kayıp vb.).</p>`
      : (bm.complete ? `<p class="lq-pg-small is-ok">${ICON_CHECK} Hareketler kapanışla mutabık.</p>` : `<p class="lq-pg-small is-warn">${bm.missing} kalem için kaynak yok; sıfır sayılmadı.</p>`);
    return `${mn ? '<p class="lq-pg-small lq-pg-muted lq-pg-unit">milyon</p>' : ""}<div class="lq-pg-cols" role="img" aria-label="Kira yükümlülüğü köprüsü">${cols}</div>${base ? `<p class="lq-pg-small lq-pg-muted">Eksen ${nf0.format(base)} değerinden başlar.</p>` : ""}${foot}`;
  }
  function maturityColumns(mm) {
    if (!mm.supported) return `<p class="lq-pg-empty">${esc(mm.status)}${mm.limitation ? ` — ${esc(mm.limitation)}` : ""}</p>`;
    const max = mm.max || 1;
    const cols = mm.bands.map((b, i) => `<div class="lq-pg-mcol"><span class="lq-pg-colv">${b.value === null ? "—" : acc0(b.value)}</span><div class="lq-pg-mbar"><i class="${i ? "is-soft" : ""}" style="height:${b.value === null ? 0 : Math.max(2, Math.round((b.value / max) * 100))}%"></i></div><span class="lq-pg-coll">${esc(b.label)}</span></div>`).join("");
    const rec = mm.total !== null && mm.carrying !== null
      ? `<div class="lq-pg-recon"><span>${acc0(mm.total)} − ${acc0(mm.finance)} finansman gideri = ${acc0(mm.carrying)}</span>${mm.bandsMatchTotal === false ? '<b class="is-warn">Dilim toplamı uyuşmuyor</b>' : `<b class="is-ok">${ICON_CHECK}Defter değeri</b>`}</div>` : "";
    return `<div class="lq-pg-mcols">${cols}</div>${rec}`;
  }

  /* =========================================================
     SÖZLEŞMELER
     ========================================================= */
  const contractsState = { view: "all", search: "", company: "all", assetClass: "all", currency: "all", sort: "id", dir: "asc", page: 1, size: 25, reports: new Map(), seq: 0 };
  const VIEWS = [["all", "Tümü"], ["active", "Aktif"], ["inactive", "Pasif / taslak"], ["ending", "90 günde bitiyor"], ["out", "Kapsam dışı"]];

  function contractsHost() {
    const view = $("contractsView");
    if (!view) return null;
    let host = $("lqContracts");
    if (!host) {
      host = doc.createElement("div");
      host.id = "lqContracts";
      host.className = "lq-pg";
      host.addEventListener("click", onContractsClick);
      host.addEventListener("input", onContractsInput);
      host.addEventListener("change", onContractsInput);
      host.addEventListener("keydown", e => {
        const row = e.target.closest?.("[data-open-contract]");
        if (row && (e.key === "Enter" || e.key === " ") && e.target === row) { e.preventDefault(); openDetail(row.getAttribute("data-open-contract")); }
      });
      view.prepend(host);
      root.setAttribute("data-lq-contracts", "on");
    }
    return host;
  }

  function loadContractReports(list) {
    const ids = [...new Set(list.filter(c => String(c.status).toLowerCase() === "active").map(c => String(c.companyId)).filter(Boolean))].slice(0, 12);
    const p = period();
    const seq = ++contractsState.seq;
    ids.forEach(id => {
      const key = `${id}|${p.periodEnd}`;
      const existing = contractsState.reports.get(id);
      if (existing && existing.key === key && (existing.pkg || existing.loading)) return;
      contractsState.reports.set(id, { key, loading: true });
      report(id).then(pkg => { contractsState.reports.set(id, { key, pkg }); if (seq === contractsState.seq) renderContracts(true); },
        e => { contractsState.reports.set(id, { key, error: e }); if (seq === contractsState.seq) renderContracts(true); });
    });
  }

  function renderContracts(fromReport) {
    const view = $("contractsView");
    if (!view || view.style.display === "none") return;
    const host = contractsHost();
    if (!host) return;
    const s = contractsState;
    const helper = global.GK_TFRS16 || {};
    const base = engineContracts().filter(c => typeof helper.v26ContractMatchesActiveCompany !== "function" || helper.v26ContractMatchesActiveCompany(c));
    if (!fromReport) loadContractReports(base);
    const p = period();
    const { list, counts } = contractRows(base, s.reports, { ...s, reportingDate: p.reportingDate });
    const pages = Math.max(1, Math.ceil(list.length / s.size));
    s.page = Math.min(Math.max(1, s.page), pages);
    const rows = list.slice((s.page - 1) * s.size, s.page * s.size);
    const companiesOpts = [...new Map(base.map(c => [String(c.companyId), c.company || c.companyId])).entries()];
    const classes = [...new Set(base.map(c => String(c.assetClass || "")).filter(Boolean))].sort();
    const currencies = [...new Set(base.map(c => String(c.currency || "").toUpperCase()).filter(Boolean))].sort();
    const sel = (id, label, cur, opts) => `<label class="lq-pg-select"><span class="lq-sr">${label}</span><select data-cf="${id}" aria-label="${label}"><option value="all">${label}: Tümü</option>${opts.map(([v, t]) => `<option value="${esc(v)}"${String(cur) === String(v) ? " selected" : ""}>${label}: ${esc(t)}</option>`).join("")}</select></label>`;
    const sortBtn = (key, label, cls = "") => `<button type="button" class="lq-pg-th ${cls}" data-sort="${key}" aria-sort="${s.sort === key ? (s.dir === "asc" ? "ascending" : "descending") : "none"}">${label}${s.sort === key ? (s.dir === "asc" ? " ↑" : " ↓") : ""}</button>`;
    const scopeChip = r => {
      if (r.scope === "ok") return '<span class="lq-pg-pill is-ok">Kapsamda</span>';
      if (r.scope === "out") return `<span class="lq-pg-pill is-warn" title="${esc(reason(r.reason))}">Kapsam dışı</span>`;
      if (r.scope === "loading") return '<span class="lq-pg-pill is-muted">…</span>';
      if (r.scope === "error") return '<span class="lq-pg-pill is-muted" title="Rapor alınamadı">Alınamadı</span>';
      return '<span class="lq-pg-pill is-muted">—</span>';
    };
    const freq = f => ({ quarterly: "/çey", semiannual: "/6 ay", annual: "/yıl", yearly: "/yıl" }[String(f || "").toLowerCase()] || "/ay");
    const statusChip = c => { const a = String(c.status || "").toLowerCase() === "active"; return `<span class="lq-pg-tag ${a ? "is-ok" : "is-muted"}">${a ? "Aktif" : esc(c.status === "draft" ? "Taslak" : "Pasif")}</span>`; };
    const focusSearch = doc.activeElement && doc.activeElement.getAttribute("data-cf") === "search";
    const caret = focusSearch ? doc.activeElement.selectionStart : null;
    host.innerHTML = head("Sözleşmeler", `<span class="lq-pg-num">${base.length}</span> kayıt · ${esc(trDate(p.reportingDate))} tutarları`,
      btn("Dışa aktar", 'data-cact="export"') + btn("Excel'den içe aktar", 'data-cact="import"') + btn("+ Yeni sözleşme", 'data-cact="new"', "primary"))
      + `<div class="lq-pg-tabs" role="tablist" aria-label="Sözleşme görünümleri">${VIEWS.map(([k, l]) => `<button type="button" role="tab" id="lqContractsTab-${k}" aria-controls="lqContractsViewPanel" tabindex="${s.view === k ? 0 : -1}" data-cview="${k}" aria-selected="${s.view === k}">${l} <span class="lq-pg-num${k === "out" && counts.out ? " is-warn" : ""}">${counts[k]}</span></button>`).join("")}</div>
      <div class="lq-pg-filters"><label class="lq-pg-search"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="M20 20l-3.5-3.5"></path></svg><input data-cf="search" aria-label="Sözleşme ara" placeholder="Sözleşme no, kiraya veren…" value="${esc(s.search)}"></label>
        ${companiesOpts.length > 1 ? sel("company", "Şirket", s.company, companiesOpts) : ""}${classes.length ? sel("assetClass", "Sınıf", s.assetClass, classes.map(c => [c, c])) : ""}${currencies.length > 1 ? sel("currency", "Para birimi", s.currency, currencies.map(c => [c, c])) : ""}</div>
      <section class="lq-pg-card lq-pg-table" id="lqContractsViewPanel" role="tabpanel" tabindex="0" aria-labelledby="lqContractsTab-${s.view}" aria-label="Sözleşme listesi">
        <div class="lq-pg-tr is-head">${sortBtn("id", "SÖZLEŞME")}${sortBtn("supplier", "KİRAYA VEREN")}${sortBtn("company", "ŞİRKET")}<span>SINIF</span>${sortBtn("end", "BİTİŞ", "is-r")}<span class="is-r">KALAN</span>${sortBtn("payment", "DÖNEMSEL ÖDEME", "is-r")}${sortBtn("liability", "KİRA YÜK.", "is-r")}<span class="is-r">KHV</span><span>KAPSAM</span><span>DURUM</span></div>
        ${rows.length ? rows.map(r => `<div class="lq-pg-tr" role="button" tabindex="0" data-open-contract="${esc(r.c.id)}" aria-label="${esc(r.c.id)} sözleşmesini aç">
          <span data-label="Sözleşme" class="lq-pg-mono lq-pg-link">${esc(r.c.id)}</span><span data-label="Kiraya veren" class="lq-pg-ell">${esc(r.c.supplier || "—")}</span><span data-label="Şirket" class="lq-pg-ell lq-pg-muted">${esc(r.c.company || "—")}</span><span data-label="Sınıf" class="lq-pg-muted lq-pg-ell">${esc(r.c.assetClass || "—")}</span>
          <span data-label="Bitiş" class="lq-pg-mono is-r">${esc(trDate(r.c.endDate))}</span><span data-label="Kalan süre" class="lq-pg-mono is-r${r.left !== null && r.left <= 3 && r.active ? " is-warn" : ""}">${r.left === null ? "—" : `${r.left} ay`}</span>
          <span data-label="Dönemsel ödeme" class="lq-pg-mono is-r">${acc2(Number(r.c.monthlyPayment))}<small> ${esc(String(r.c.currency || "").toUpperCase())}${freq(r.c.paymentFrequency)}</small></span>
          <span data-label="Kira yükümlülüğü" class="lq-pg-mono is-r">${acc0(r.liability)}</span><span data-label="Kullanım hakkı varlığı" class="lq-pg-mono is-r">${acc0(r.rou)}</span><span data-label="Kapsam">${scopeChip(r)}</span><span data-label="Durum">${statusChip(r.c)}</span></div>`).join("")
          : `<div class="lq-pg-emptyrow"><strong>${base.length ? "Bu görünümde sözleşme yok" : "Henüz sözleşme yok"}</strong><span>${base.length ? "Filtreleri veya görünümü değiştirin." : "Yeni sözleşme ekleyin veya Excel'den içe aktarın."}</span></div>`}
        <div class="lq-pg-tr is-foot"><span>${list.length} sözleşme gösteriliyor</span><span class="lq-pg-muted">Tutarlar ${esc(trDate(p.reportingDate))} sunucu raporundan; kapsam dışı sözleşmede boş.</span></div>
      </section>
      <div class="lq-pg-pager"><span>${list.length ? `${(s.page - 1) * s.size + 1}–${Math.min(s.page * s.size, list.length)} / ${list.length}` : "0 kayıt"}</span>
        <label>Sayfa başına <select data-cf="size">${[25, 50, 100].map(n => `<option${n === s.size ? " selected" : ""}>${n}</option>`).join("")}</select></label>
        <span class="lq-pg-pagebtns">${btn("‹", `data-cpage="${s.page - 1}" aria-label="Önceki sayfa" ${s.page <= 1 ? "disabled" : ""}`)}<b aria-current="page">${s.page} / ${pages}</b>${btn("›", `data-cpage="${s.page + 1}" aria-label="Sonraki sayfa" ${s.page >= pages ? "disabled" : ""}`)}</span></div>`;
    if (focusSearch) { const i = host.querySelector('[data-cf="search"]'); i?.focus(); if (caret !== null) i?.setSelectionRange(caret, caret); }
  }

  function onContractsInput(e) {
    const f = e.target.getAttribute?.("data-cf");
    if (!f) return;
    const s = contractsState;
    if (f === "search") { if (e.type !== "input") return; s.search = e.target.value; }
    else if (f === "size") s.size = Number(e.target.value) || 25;
    else s[f] = e.target.value;
    s.page = 1;
    renderContracts(true);
  }
  function onContractsClick(e) {
    const s = contractsState;
    const t = e.target;
    const v = t.closest("[data-cview]");
    if (v) { s.view = v.getAttribute("data-cview"); s.page = 1; renderContracts(true); return; }
    const so = t.closest("[data-sort]");
    if (so) { const k = so.getAttribute("data-sort"); s.dir = s.sort === k && s.dir === "asc" ? "desc" : "asc"; s.sort = k; renderContracts(true); return; }
    const pg = t.closest("[data-cpage]");
    if (pg) { s.page = Number(pg.getAttribute("data-cpage")) || 1; renderContracts(true); return; }
    const act = t.closest("[data-cact]");
    if (act) {
      const a = act.getAttribute("data-cact");
      if (a === "new") $("newContractButton")?.click();
      else if (a === "import") $("bulkImportButton")?.click();
      else if (a === "export") {
        const helper = global.GK_TFRS16 || {};
        const base = engineContracts().filter(c => typeof helper.v26ContractMatchesActiveCompany !== "function" || helper.v26ContractMatchesActiveCompany(c));
        const { list } = contractRows(base, s.reports, { ...s, reportingDate: period().reportingDate });
        downloadCsv(list.map(r => ({ Sozlesme: r.c.id, KirayaVeren: r.c.supplier, Sirket: r.c.company, Sinif: r.c.assetClass || "", Baslangic: r.c.startDate, Bitis: r.c.endDate,
          DonemselOdeme: r.c.monthlyPayment, ParaBirimi: r.c.currency, KiraYukumlulugu: r.liability ?? "", KHV: r.rou ?? "", Kapsam: r.scope, Neden: r.reason || "", Durum: r.c.status })), `LeaseQant_Sozlesmeler_${period().reportingDate}.csv`);
      }
      return;
    }
    const row = t.closest("[data-open-contract]");
    if (row) openDetail(row.getAttribute("data-open-contract"));
  }

  /* =========================================================
     FİNANSAL RAPORLAMA — Hesaplama sonuçları
     ========================================================= */
  const fr = { tab: "liability", seq: 0, data: null };
  const FR_TABS = [["liability", "Kira yükümlülüğü hareketi"], ["rou", "KHV hareketi"], ["expense", "Dönem giderleri"], ["split", "Kısa / uzun vade"], ["maturity", "Vade analizi"], ["events", "Olay günlüğü"]];

  function activeOpenKey() { return doc.querySelector("#sidebarNav .nav-item.active[data-open]")?.getAttribute("data-open") || null; }

  async function renderFinancial() {
    const hostPage = $("v26PageHost");
    if (!hostPage || hostPage.style.display === "none" || activeOpenKey() !== "financialReporting") return;
    if (hostPage.querySelector(":scope > #lqFinancial")) return;
    const legacy = Array.from(hostPage.children);
    const box = doc.createElement("div");
    box.id = "lqFinancial";
    box.className = "lq-pg";
    box.addEventListener("click", onFinancialClick);
    const det = doc.createElement("details");
    det.className = "lq-pg-legacy";
    det.innerHTML = "<summary>Rapor paketi — ayrıntı, filtre ve dışa aktarma (xlsx, csv, pdf)</summary>";
    hostPage.prepend(box);
    box.after(det);
    legacy.forEach(n => det.append(n));
    await drawFinancial();
  }

  async function drawFinancial() {
    const box = $("lqFinancial");
    if (!box) return;
    const seq = ++fr.seq;
    const p = period();
    const company = activeCompany();
    box.innerHTML = head("Hesaplama sonuçları", `${esc(trDate(p.periodStart))} – ${esc(trDate(p.periodEnd))} · yükleniyor…`, btn("Excel (CSV)", 'data-fr="csv"'))
      + `<div class="lq-pg-tabs" role="tablist" aria-label="Finansal raporlama görünümleri">${FR_TABS.map(([k, l]) => `<button type="button" role="tab" id="lqFinancialTab-${k}" aria-controls="lqFrBody" tabindex="${fr.tab === k ? 0 : -1}" data-frtab="${k}" aria-selected="${fr.tab === k}">${l}</button>`).join("")}</div><div id="lqFrBody" role="tabpanel" tabindex="0" aria-labelledby="lqFinancialTab-${fr.tab}">${skel(5)}</div>`;
    let scope = [];
    try { scope = await companies(); } catch (e) { if (seq === fr.seq) $("lqFrBody").innerHTML = `<p class="lq-pg-empty">${esc(errText(e))}</p>`; return; }
    if (company !== "ALL") scope = scope.filter(c => String(c.id) === String(company));
    scope = scope.slice(0, 12);
    const rows = await Promise.all(scope.map(async c => ({ c, r: await settle(report(c.id)), d: await settle(disclosure(c.id)) })));
    if (seq !== fr.seq || !box.isConnected) return;
    fr.data = rows;
    const sub = box.querySelector(".lq-pg-sub");
    if (sub) sub.innerHTML = `${esc(trDate(p.periodStart))} – ${esc(trDate(p.periodEnd))} · ${rows.length} şirket · tarihi esas${rows.length > 1 ? " · şirketler ayrı kaynak, toplam alınmaz" : ""}`;
    drawFinancialTab();
  }

  function labelFinancialRow(line, cols) {
    const template = doc.createElement("template");
    template.innerHTML = line;
    const row = template.content.querySelector(".lq-pg-ftr:not(.is-head)");
    if (!row) return line;
    Array.from(row.children).forEach((cell, index) => {
      const label = cell.classList.contains("lq-pg-rowerr") ? "Kaynak durumu" : cols[index]?.label;
      if (!label) return;
      const plain = doc.createElement("span");
      plain.innerHTML = label;
      const text = plain.textContent.trim();
      if (text) cell.setAttribute("data-label", text);
    });
    return template.innerHTML;
  }

  function frTable(cols, lines, cls = "") {
    const tpl = `minmax(150px,1.3fr) repeat(${cols.length - 1}, minmax(80px,1fr))`;
    return `<section class="lq-pg-card lq-pg-ftable ${cls}"><div class="lq-pg-fscroll"><div class="lq-pg-fgrid" style="--cols:${tpl}">
      <div class="lq-pg-ftr is-head">${cols.map((c, i) => `<span class="${i ? "is-r" : ""}${c.warn ? " is-warn" : ""}">${c.label}</span>`).join("")}</div>
      ${lines.map(line => labelFinancialRow(line, cols)).join("")}</div></div></section>`;
  }

  function drawFinancialTab() {
    const body = $("lqFrBody");
    if (!body || !fr.data) return;
    $("lqFinancial").querySelectorAll("[data-frtab]").forEach(b => {
      const selected = b.getAttribute("data-frtab") === fr.tab;
      b.setAttribute("aria-selected", String(selected));
      b.tabIndex = selected ? 0 : -1;
    });
    body.setAttribute("aria-labelledby", `lqFinancialTab-${fr.tab}`);
    const data = fr.data;
    const p = period();
    const name = c => `<span class="is-name">${esc(c.name || c.id)}</span>`;
    const errRow = (c, e, n) => `<div class="lq-pg-ftr">${name(c)}<span class="lq-pg-rowerr" style="grid-column: span ${n}">${esc(errText(e))}</span></div>`;
    let html = "";
    if (fr.tab === "liability" || fr.tab === "rou") {
      const liab = fr.tab === "liability";
      const cols = liab
        ? [{ label: "ŞİRKET" }, { label: "AÇILIŞ" }, { label: "YENİ SÖZLEŞMELER" }, { label: "FAİZ" }, { label: "KİRA ÖDEMELERİ (SÖZLEŞMESEL)" }, { label: "MODİFİKASYON" }, { label: "YENİDEN ÖLÇÜM" }, { label: "KUR FARKI TMS 21" }, { label: "FARK · TMS 29 / DİĞER", warn: true }, { label: `KAPANIŞ ${trDate(p.periodEnd)}` }, { label: "MUTABAKAT" }]
        : [{ label: "ŞİRKET" }, { label: "AÇILIŞ NDD" }, { label: "İLK MUHASEBELEŞTİRME" }, { label: "SONRAKİ İLAVELER" }, { label: "AMORTİSMAN" }, { label: "MODİFİKASYON" }, { label: "YENİDEN ÖLÇÜM" }, { label: "TMS 29 DÜZELTMESİ", warn: true }, { label: `KAPANIŞ NDD ${trDate(p.periodEnd)}` }];
      const lines = data.map(({ c, d }) => {
        if (!d.ok) return errRow(c, d.e, cols.length - 1);
        const m = d.v.periodMovement || {};
        if (liab) {
          const l = m.liability || {};
          const bm = charts().bridgeModel(d.v);
          const pay = bm.rows.find(r => r.id === "payments");
          const recon = bm.residual === null ? (bm.complete ? `<span class="is-ok lq-pg-c">${ICON_CHECK}</span>` : `<span class="lq-pg-need">Eksik</span>`) : `<span class="lq-pg-need">Fark</span>`;
          return `<div class="lq-pg-ftr">${name(c)}${fieldCell(l.opening)}${fieldCell(l.initialRecognitionAdditions)}${fieldCell(l.interest)}${pay && isNum(pay.value) ? `<span>${acc0(pay.value)}${""}</span>` : fieldCell(l.actualCashOutflow)}${fieldCell(l.modifications)}${fieldCell(l.remeasurements)}${fieldCell(l.tms21Movement)}<span class="is-warn">${bm.residual === null ? "—" : acc0(bm.residual)}</span><span class="is-strong">${acc0(fv(l.closing))}</span>${recon}</div>`;
        }
        const r = m.rou || {};
        const dep = fv(r.depreciation);
        return `<div class="lq-pg-ftr">${name(c)}${fieldCell(r.opening)}${fieldCell(r.initialRecognitionAdditions)}${fieldCell(r.subsequentAdditions)}${dep !== null ? `<span>${acc0(-Math.abs(dep))}</span>` : fieldCell(r.depreciation)}${fieldCell(r.modifications)}${fieldCell(r.remeasurements)}${fieldCell(r.tms29Movement)}<span class="is-strong">${acc0(fv(r.closing))}</span></div>`;
      });
      html = frTable(cols, lines) + notice(liab
        ? "<strong>Fark sütunu</strong> kapanış ile paketteki hareketlerin toplamı arasındaki farktır; pakette TMS 29 parasal kazanç/kayıp için ayrı alan olmadığından bu sütunda görünür. Kira yükümlülüğü parasal kalemdir; kur farkı TMS 21 uyarınca kâr veya zarardadır."
        : "Kullanım hakkı varlığı parasal olmayan kalemdir; kur farkı oluşmaz. TMS 29 uygulanıyorsa düzeltme ayrı sütundadır.");
    } else if (fr.tab === "expense" || fr.tab === "split") {
      const exp = fr.tab === "expense";
      const cols = exp ? [{ label: "ŞİRKET" }, { label: "DÖNEM FAİZİ" }, { label: "DÖNEM AMORTİSMANI" }, { label: "SÖZLEŞMESEL ÖDEME" }, { label: "GELECEK 12 AY FAİZ" }, { label: "KAPSAM" }]
        : [{ label: "ŞİRKET" }, { label: "KISA VADELİ" }, { label: "UZUN VADELİ" }, { label: "KİRA YÜKÜMLÜLÜĞÜ" }, { label: "GELECEK 12 AY ANAPARA" }, { label: "KAPSAM" }];
      const lines = data.map(({ c, r }) => {
        if (!r.ok) return errRow(c, r.e, cols.length - 1);
        const t = r.v.totals;
        const cov = r.v.population.excludedCount ? `<span class="lq-pg-need">${r.v.population.excludedCount} kapsam dışı</span>` : `<span class="is-ok lq-pg-c">${ICON_CHECK}</span>`;
        const cell = m => `<span>${mv(m) === null ? '<span class="lq-pg-need">Kaynak yok</span>' : acc0(mv(m))}</span>`;
        return exp ? `<div class="lq-pg-ftr">${name(c)}${cell(t.periodInterest)}${cell(t.periodDepreciation)}${cell(t.contractualPayments)}${cell(t.next12MonthInterest)}${cov}</div>`
          : `<div class="lq-pg-ftr">${name(c)}${cell(t.currentLiability)}${cell(t.nonCurrentLiability)}<span class="is-strong">${mv(t.leaseLiability) === null ? "—" : acc0(mv(t.leaseLiability))}</span>${cell(t.next12MonthPrincipal)}${cov}</div>`;
      });
      html = frTable(cols, lines);
    } else if (fr.tab === "maturity") {
      const first = data.find(x => x.d.ok);
      const bands = first ? (charts().maturityModel(first.d.v).bands || []) : [];
      const cols = [{ label: "ŞİRKET" }, ...bands.map(b => ({ label: esc(b.label).toLocaleUpperCase("tr-TR") })), { label: "İSKONTO EDİLMEMİŞ" }, { label: "DEFTER DEĞERİ" }];
      const lines = data.map(({ c, d }) => {
        if (!d.ok) return errRow(c, d.e, cols.length - 1);
        const mm = charts().maturityModel(d.v);
        if (!mm.supported) return `<div class="lq-pg-ftr">${name(c)}<span class="lq-pg-rowerr" style="grid-column: span ${cols.length - 1}">${esc(mm.status)}</span></div>`;
        return `<div class="lq-pg-ftr">${name(c)}${bands.map(b => { const x = mm.bands.find(y => y.id === b.id); return `<span>${x && x.value !== null ? acc0(x.value) : "—"}</span>`; }).join("")}<span>${acc0(mm.total)}</span><span class="is-strong">${acc0(mm.carrying)}</span></div>`;
      });
      html = bands.length ? frTable(cols, lines) : `<p class="lq-pg-empty">Vade analizi için doğrulanmış dipnot kaynağı yok.</p>`;
    } else {
      const ev = [];
      data.forEach(({ c, r }) => { if (r.ok) { try { AUI().rawRows(r.v, "audit").forEach(a => ev.push({ ...a, company: c.name || c.id })); } catch (_) {} } });
      ev.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
      html = `<section class="lq-pg-card lq-pg-pad"><span class="lq-pg-kick">DÖNEM OLAYLARI · ${esc(trDate(p.periodStart))} – ${esc(trDate(p.periodEnd))}</span>${ev.length
        ? `<div class="lq-pg-events">${ev.slice(0, 200).map(a => `<div class="lq-pg-event"><span data-label="Zaman" class="lq-pg-mono">${esc(String(a.timestamp || "").replace("T", " ").slice(0, 16))}</span><button type="button" data-label="Sözleşme" class="lq-pg-mono lq-pg-link" data-fr="open" data-id="${esc(a.contract_id)}">${esc(a.contract_id || "—")}</button><span data-label="Olay">${esc(a.action || "Olay")}</span><span data-label="Şirket ve kullanıcı" class="lq-pg-muted">${esc(a.company)} · ${esc(a.actor || "")}</span></div>`).join("")}</div>`
        : '<p class="lq-pg-empty">Bu dönemde sunucuya kayıtlı olay yok.</p>'}</section>`;
    }
    body.innerHTML = html;
  }

  function onFinancialClick(e) {
    const tab = e.target.closest("[data-frtab]");
    if (tab) { fr.tab = tab.getAttribute("data-frtab"); drawFinancialTab(); return; }
    const a = e.target.closest("[data-fr]");
    if (!a) return;
    if (a.getAttribute("data-fr") === "open") { openView("contracts"); global.setTimeout(() => openDetail(a.getAttribute("data-id")), 50); return; }
    if (a.getAttribute("data-fr") === "csv") {
      const grid = $("lqFinancial").querySelector(".lq-pg-fgrid");
      if (!grid) return;
      const rows = Array.from(grid.querySelectorAll(".lq-pg-ftr")).map(r => Array.from(r.children).map(x => x.textContent.trim()));
      if (rows.length < 2) return;
      const [h, ...rest] = rows;
      downloadCsv(rest.map(r => Object.fromEntries(h.map((k, i) => [k || `S${i}`, r[i] ?? ""]))), `LeaseQant_${fr.tab}_${period().reportingDate}.csv`);
    }
  }

  /* ---------- Tetikleyiciler ---------- */
  let timer = 0;
  function refreshAll() {
    global.clearTimeout(timer);
    timer = global.setTimeout(() => {
      renderOverview();
      renderContracts(false);
      if (activeOpenKey() === "financialReporting") { if ($("lqFinancial")) drawFinancial(); else renderFinancial(); }
    }, 60);
  }

  function init() {
    const dash = $("lqDashboard");
    if (dash) new MutationObserver(() => { if (!dash.hidden) renderOverview(); }).observe(dash, { attributes: true, attributeFilter: ["hidden"] });
    const cv = $("contractsView");
    if (cv) new MutationObserver(() => renderContracts(false)).observe(cv, { attributes: true, attributeFilter: ["style"] });
    const host = $("v26PageHost");
    if (host) new MutationObserver(() => { if (activeOpenKey() === "financialReporting" && !host.querySelector(":scope > #lqFinancial")) renderFinancial(); }).observe(host, { childList: true });
    // Motor listeyi yenilediğinde (kayıt, silme, içe aktarma) liste yeniden çizilir
    const portfolio = global.LeaseQantTfrs16PortfolioUi;
    if (portfolio && typeof portfolio.renderTable === "function" && !portfolio.__lqWrapped) {
      const original = portfolio.renderTable;
      portfolio.renderTable = function (...args) { const out = original.apply(this, args); renderContracts(false); return out; };
      portfolio.__lqWrapped = true;
    }
    $("v26ActiveCompanySelect")?.addEventListener("change", () => { contractsState.company = "all"; refreshAll(); });
    global.LeaseQantReportingPeriod?.subscribe?.(() => { reportCache.clear(); disclosureCache.clear(); contractsState.reports.clear(); refreshAll(); });
    global.addEventListener("gk-reporting-companies-ready", () => renderOverview());
    refreshAll();
  }

  global.LeaseQantPages = Object.freeze({ ...helpers, refresh: refreshAll });
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})(window);
