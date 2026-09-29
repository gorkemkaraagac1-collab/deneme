/* LeaseQant UI v2 — sözleşme detay sayfası (tasarım: SozlesmeDetay).
   Motorun çizdiği #detailContent'in üstüne tasarımdaki sayfa iskeletini kurar:
   konum satırı, başlık ve durum etiketleri, 5'li gösterge şeridi, sekmeler,
   "Hesaplama" tablosu (yıl gruplu) ve sağ bilgi sütunu.

   Kaynaklar:
   - Tutarlar: sunucunun doğrulanmış raporlama paketi
     (LeaseQantReportingAuthorityUi.renderContractDetails -> "lq:contract-report").
     Bu modül toplam/oran hesaplamaz; yalnızca satırları tarihe göre gruplar ve sayar.
   - Sözleşme bilgileri: motorun sözleşme kaydı (GK_TFRS16.getPortfolioContracts).
   - Özet, Ödeme planı, Olaylar, Yevmiye, Denetim izi: motorun kendi panelleri
     aynen kullanılır (olay bağları ve kayıt akışları değişmez).
   html[data-lq-ui="2"] değilse hiçbir şey yapmaz. */
((global) => {
  "use strict";
  const doc = global.document;
  const root = doc.documentElement;

  /* ---------- Saf yardımcılar ---------- */
  const esc = v => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const isNum = v => typeof v === "number" && Number.isFinite(v);
  const nf2 = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const nf0 = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
  const money = v => isNum(v) ? (v < 0 ? `(${nf2.format(-v)})` : nf2.format(v)) : "—";
  const money0 = v => isNum(v) ? nf0.format(v) : "—";
  const trDate = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || "")); return m ? `${m[3]}.${m[2]}.${m[1]}` : "—"; };
  const MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

  function monthsBetween(start, end) {
    const a = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(start || "")), b = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(end || ""));
    if (!a || !b) return null;
    let n = (+b[1] - +a[1]) * 12 + (+b[2] - +a[2]);
    if (+b[3] >= +a[3] - 1) n += 1; // 01.01 – 31.12 = 12 ay
    return n > 0 ? n : null;
  }

  const METRIC_OK = new Set(["SUPPORTED", "ZERO_CONFIRMED"]);
  const metricValue = m => (m && METRIC_OK.has(m.status) && isNum(m.value)) ? m.value : null;

  const REASONS = {
    REPORTING_CURRENCY_PROFILE_REQUIRED: "Şirketin onaylı para birimi profili yok.",
    REPORTING_ROUTE_NOT_SUPPORTED: "Ödeme sıklığı veya zamanlaması sertifikalı rotada değil (yalnızca aylık, dönem sonu).",
    REPORTING_SOURCE_FACTS_NOT_READY: "Sözleşme verisi sertifikalı rota için eksik.",
    REPORTING_SOURCE_NOT_READY: "Bu dönem için doğrulanmış hesaplama kaynağı yok.",
    REPORTING_COMPANY_ACCESS_DENIED: "Bu şirketin raporlarına erişim yetkiniz yok.",
    REPORTING_POPULATION_LIMIT: "Şirketin aktif sözleşme sayısı rapor sınırını aşıyor."
  };
  const reasonText = code => REASONS[code] || "Doğrulanmış rapor kaynağı alınamadı.";

  /* Satırları yıla göre gruplar, dönem etiketini belirler. Tutar üretmez. */
  function scheduleModel(rows, period) {
    const list = (Array.isArray(rows) ? rows : []).filter(r => r && typeof r.date === "string")
      .slice().sort((a, b) => a.date.localeCompare(b.date));
    const years = new Map();
    list.forEach(r => {
      const y = r.date.slice(0, 4);
      const tag = period && r.date >= period.periodStart && r.date <= period.periodEnd ? "cur"
        : (period && r.date > period.periodEnd ? "proj" : "past");
      if (!years.has(y)) years.set(y, []);
      years.get(y).push({ ...r, tag, month: MONTHS[+r.date.slice(5, 7) - 1] || "" });
    });
    const curYear = period ? period.periodEnd.slice(0, 4) : null;
    const groups = Array.from(years, ([year, items]) => ({
      year, items, count: items.length,
      opening: items[0].openingLiability, closing: items[items.length - 1].closingLiability,
      hasCurrent: items.some(i => i.tag === "cur"), projected: items.every(i => i.tag === "proj"),
      open: year === curYear
    }));
    if (!groups.some(g => g.open) && groups.length) groups[0].open = true;
    const remaining = period ? list.filter(r => r.date > period.periodEnd).length : null;
    return { groups, total: list.length, remaining, initialLiability: list.length ? list[0].openingLiability : null };
  }

  const helpers = Object.freeze({ scheduleModel, monthsBetween, reasonText });
  if (root.getAttribute("data-lq-ui") !== "2") { global.LeaseQantContractView = helpers; return; }

  /* ---------- Sayfa ---------- */
  const $ = id => doc.getElementById(id);
  const state = { contractId: null, tab: "calc", sub: "modification", report: null, error: null, openYears: new Map() };
  const TABS = [
    ["summary", "Özet"], ["schedule", "Ödeme planı"], ["calc", "Hesaplama"],
    ["events", "Olaylar"], ["accounting", "Yevmiye"], ["audit", "Denetim izi"]
  ];
  const SUBS = [["modification", "Modifikasyon ve yeniden değerlendirme"], ["slb", "Satış ve geri kiralama"], ["sublease", "Alt kiralama"]];

  const selectedId = () => { try { return global.GK_TFRS16?.getSelectedContractId?.() || null; } catch (_) { return null; } };
  const contractOf = id => {
    try { return (global.GK_TFRS16?.getPortfolioContracts?.() || []).find(c => String(c.id) === String(id)) || null; } catch (_) { return null; }
  };
  const period = () => {
    try { return global.LeaseQantReportingAuthorityUi?.defaultPeriod?.() || null; } catch (_) { return null; }
  };
  const frequencyText = f => ({ monthly: "Aylık", quarterly: "Çeyreklik", annual: "Yıllık", yearly: "Yıllık" }[String(f || "").toLowerCase()] || "Aylık");
  const timingText = t => String(t || "").toLowerCase() === "advance" ? "dönem başı" : "dönem sonu";
  const statusChip = s => {
    const v = String(s || "active").toLowerCase();
    const map = { active: ["Aktif", "ok"], draft: ["Taslak", "muted"], terminated: ["Sona erdi", "muted"], expired: ["Sona erdi", "muted"], pending: ["Onay bekliyor", "warn"] };
    const [label, tone] = map[v] || [s, "muted"];
    return `<span class="lq-cv-chip is-${tone}">${esc(label)}</span>`;
  };

  function closeDetail() { ($("closeDetailModal") || $("closeDetailModalFooter"))?.click(); }

  function headHtml(c, p) {
    const months = monthsBetween(c.startDate, c.endDate);
    const title = c.description || c.assetName || c.supplier || c.id;
    const scope = state.report?.row
      ? (state.report.row.status === "SUPPORTED" ? '<span class="lq-cv-chip is-ok-outline">Sertifikalı kapsam</span>' : '<span class="lq-cv-chip is-warn-outline">Kapsam dışı</span>')
      : "";
    const meta = [
      `<span class="lq-cv-mono lq-cv-strong">${esc(c.id)}</span>`,
      c.supplier ? esc(c.supplier) : "", c.assetClass ? esc(c.assetClass) : "",
      `${trDate(c.startDate)} – ${trDate(c.endDate)}${months ? ` (${months} ay)` : ""}`,
      `${frequencyText(c.paymentFrequency)}, ${timingText(c.paymentTiming)}`, esc(c.currency || "")
    ].filter(Boolean).join(" · ");
    return `<nav class="lq-cv-crumb" aria-label="Konum"><button type="button" data-lq-cv="back">Sözleşmeler</button><span aria-hidden="true">/</span><span>${esc(c.company || "—")}</span><span aria-hidden="true">/</span><span class="lq-cv-here">${esc(c.id)}</span></nav>
      <div class="lq-cv-titlebar"><div class="lq-cv-titles"><div class="lq-cv-h1row"><h1 class="lq-cv-h1">${esc(title)}</h1>${statusChip(c.status)}${scope}</div>
      <div class="lq-cv-meta">${meta}</div></div>
      <div class="lq-cv-actions">
        <div class="lq-cv-menu"><button type="button" class="lq-cv-btn is-dark" data-lq-cv="menu" aria-haspopup="true" aria-expanded="false">İşlemler <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 9l6 6 6-6"></path></svg></button>
          <div class="lq-cv-pop" role="menu" hidden>
            <button type="button" role="menuitem" data-lq-cv-go="events:modification">Modifikasyon / yeniden değerlendirme</button>
            <button type="button" role="menuitem" data-lq-cv-go="events:slb">Satış ve geri kiralama</button>
            <button type="button" role="menuitem" data-lq-cv-go="events:sublease">Alt kiralama</button>
            <button type="button" role="menuitem" data-lq-cv-go="accounting">Yevmiye fişi</button>
          </div></div>
        <div class="lq-cv-menu"><button type="button" class="lq-cv-btn is-icon" data-lq-cv="more" aria-label="Diğer işlemler" aria-haspopup="true" aria-expanded="false">⋯</button>
          <div class="lq-cv-pop is-right" role="menu" hidden>
            <button type="button" role="menuitem" data-lq-cv-act="pdf">Rapor (PDF)</button>
            <button type="button" role="menuitem" data-lq-cv-act="html">Rapor (HTML)</button>
            <button type="button" role="menuitem" data-lq-cv-act="csv" ${state.report?.row?.status === "SUPPORTED" ? "" : "disabled"}>Hesaplama tablosu (CSV)</button>
            <button type="button" role="menuitem" class="is-danger" data-lq-cv-act="delete">Sözleşmeyi sil</button>
          </div></div>
      </div></div>`;
  }

  function kpiHtml(c, p) {
    const r = state.report;
    const cell = (kick, value, sub, extra = "") => `<div class="lq-cv-kpi"><span class="lq-cv-kick">${kick}</span><span class="lq-cv-kpi-v">${value}</span><span class="lq-cv-kpi-s">${sub}</span>${extra}</div>`;
    if (!r) return `<div class="lq-cv-kpis is-loading" aria-busy="true">${[1, 2, 3, 4, 5].map(() => '<div class="lq-cv-kpi"><i class="lq-cv-sk"></i><i class="lq-cv-sk is-lg"></i><i class="lq-cv-sk"></i></div>').join("")}</div>`;
    if (r.error || r.row?.status !== "SUPPORTED") {
      const code = r.error?.code || r.row?.reason;
      return `<div class="lq-cv-kpis is-empty"><div class="lq-cv-kpi-note"><strong>Doğrulanmış tutar yok.</strong> ${esc(reasonText(code))} <span class="lq-cv-mono">${esc(code || "")}</span><button type="button" class="lq-cv-link" data-lq-cv-go="schedule">Motorun ödeme planını aç →</button></div></div>`;
    }
    const m = r.row.metrics || {};
    const sch = scheduleModel(r.row.scheduleRows, r.period);
    const done = sch.total && sch.remaining != null ? sch.total - sch.remaining : null;
    const pct = sch.total && done != null ? Math.round((done / sch.total) * 100) : 0;
    const rd = trDate(r.period.reportingDate);
    return `<div class="lq-cv-kpis">
      ${cell("BAŞLANGIÇ YÜKÜMLÜLÜĞÜ", money(sch.initialLiability), `${trDate(c.startDate)} · İO %${esc(nf2.format(Number(c.discountRate) || 0))}`)}
      ${cell(`KİRA YÜK. · ${rd}`, money(metricValue(m.leaseLiability)), `Kısa ${money0(metricValue(m.currentLiability))} · Uzun ${money0(metricValue(m.nonCurrentLiability))}`)}
      ${cell(`KHV NDD · ${rd}`, money(metricValue(m.rouCarryingAmount)), `Dönem amortismanı ${money0(metricValue(m.periodDepreciation))}`)}
      ${cell("DÖNEM FAİZİ", money(metricValue(m.periodInterest)), `Sözleşmesel ödeme ${money0(metricValue(m.contractualPayments))}`)}
      ${cell("KALAN ÖDEME", sch.remaining != null ? `${sch.remaining} / ${sch.total}` : "—", "", `<div class="lq-cv-bar" role="img" aria-label="Ödemelerin %${pct}'i geçti"><i style="width:${pct}%"></i></div>`)}
    </div>`;
  }

  function tabsHtml() {
    return `<div class="lq-cv-tabs" role="tablist" aria-label="Sözleşme sekmeleri">${TABS.map(([id, label]) =>
      `<button type="button" role="tab" data-lq-cv-tab="${id}" aria-selected="${state.tab === id}" tabindex="${state.tab === id ? 0 : -1}">${label}</button>`).join("")}</div>
      <div class="lq-cv-subs" role="group" aria-label="Olay türü" ${state.tab === "events" ? "" : "hidden"}>${SUBS.map(([id, label]) =>
      `<button type="button" data-lq-cv-sub="${id}" aria-pressed="${state.sub === id}">${label}</button>`).join("")}</div>`;
  }

  function calcHtml() {
    const r = state.report;
    if (!r) return `<div class="lq-cv-card lq-cv-pad"><div class="lq-cv-sk is-lg"></div><div class="lq-cv-sk"></div><div class="lq-cv-sk"></div></div>`;
    if (r.error || r.row?.status !== "SUPPORTED") {
      const code = r.error?.code || r.row?.reason;
      return `<div class="lq-cv-card lq-cv-pad lq-cv-empty"><h3>Bu sözleşme için doğrulanmış hesaplama tablosu yok</h3><p>${esc(reasonText(code))}</p>
        <p class="lq-cv-muted">Motorun hesapladığı ödeme planı ve fişler "Ödeme planı" sekmesinde görünür; bunlar sertifikalı rapor rotasından geçmediği için bu tabloya alınmaz.</p>
        <button type="button" class="lq-cv-btn" data-lq-cv-go="schedule">Ödeme planını aç</button></div>`;
    }
    const sch = scheduleModel(r.row.scheduleRows, r.period);
    const cur = r.row.currency || "";
    const head = `<div class="lq-cv-trow is-head"><span>DÖNEM</span><span>TARİH</span><span>AÇILIŞ YÜK.</span><span>FAİZ</span><span>ÖDEME</span><span>ANAPARA</span><span>KAPANIŞ YÜK.</span><span>AMORTİSMAN</span></div>`;
    const body = sch.groups.map(g => {
      const open = state.openYears.has(g.year) ? state.openYears.get(g.year) : g.open;
      const label = g.projected ? "Projeksiyon" : `${g.count} ay`;
      const header = `<button type="button" class="lq-cv-trow is-year" data-lq-cv-year="${esc(g.year)}" aria-expanded="${open}">
        <span>${open ? "▾" : "▸"} ${esc(g.year)}</span><span>${label}</span><span>${money(g.opening)}</span><span></span><span></span><span></span><span>${money(g.closing)}</span><span></span></button>`;
      if (!open) return header;
      return header + g.items.map(i => `<div class="lq-cv-trow is-${i.tag}"><span>${esc(i.month)}${i.tag === "cur" ? '<em class="lq-cv-tag is-cur">CARİ</em>' : (i.tag === "proj" ? '<em class="lq-cv-tag">PRJ</em>' : "")}</span><span>${trDate(i.date)}</span><span>${money(i.openingLiability)}</span><span>${money(i.interest)}</span><span>${isNum(i.payment) ? money(-Math.abs(i.payment)) : "—"}</span><span>${money(i.principal)}</span><span class="lq-cv-strong">${money(i.closingLiability)}</span><span>${isNum(i.depreciation) ? money(-Math.abs(i.depreciation)) : "—"}</span></div>`).join("");
    }).join("");
    const hash = String(r.row.sourceResultHash || "");
    return `<section class="lq-cv-card lq-cv-table" aria-label="Hesaplama tablosu">
      <div class="lq-cv-tbar"><span class="lq-cv-src"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6z"></path><path d="M9 12l2 2 4-4"></path></svg>Sunucu raporu · ${esc(trDate(r.period.reportingDate))} · kaynak <span class="lq-cv-mono" title="${esc(hash)}">${esc(hash.slice(0, 4))}…${esc(hash.slice(-4))}</span> · ${esc(cur)}</span>
      <span class="lq-cv-tools"><button type="button" class="lq-cv-btn is-sm" data-lq-cv="to-current">Döneme git</button><button type="button" class="lq-cv-btn is-sm" data-lq-cv-act="csv">CSV</button></span></div>
      <div class="lq-cv-tscroll"><div class="lq-cv-tgrid" role="table">${head}${body}</div></div>
      <p class="lq-cv-foot">Ödeme ve amortisman parantez içinde (azalış). Satırlar sözleşmesel plandır; gerçekleşen ödeme kanıtı değildir.</p></section>`;
  }

  function asideHtml(c) {
    const r = state.report;
    const row = (k, v, cls = "") => `<div class="lq-cv-kv"><span>${k}</span><span class="${cls}">${v}</span></div>`;
    let scope;
    if (!r) scope = '<p class="lq-cv-muted">Kaynak doğrulanıyor…</p>';
    else if (r.row?.status === "SUPPORTED") scope = `<div class="lq-cv-scope is-ok"><span class="lq-cv-dot" aria-hidden="true">✓</span><div><strong>Sertifikalı rota</strong><span>Aylık ödeme · dönem sonu · ${esc(r.row.currency || "")}</span></div></div><p class="lq-cv-muted">Tutarlar sunucudaki doğrulanmış hesaplamadan gelir. Endeks, kur veya modifikasyon eklenirse kapsam yeniden değerlendirilir.</p>`;
    else scope = `<div class="lq-cv-scope is-warn"><span class="lq-cv-dot" aria-hidden="true">!</span><div><strong>Kapsam dışı</strong><span>${esc(reasonText(r.error?.code || r.row?.reason))}</span></div></div>`;
    const inc = c.leaseIncreaseType && c.leaseIncreaseType !== "none"
      ? `${esc(c.leaseIncreaseType)}${c.leaseIncreaseRate ? ` · %${esc(nf2.format(c.leaseIncreaseRate))}` : ""}` : "Yok";
    return `<aside class="lq-cv-aside">
      <section class="lq-cv-card lq-cv-pad"><span class="lq-cv-kick">MOTOR KAPSAMI</span>${scope}</section>
      <section class="lq-cv-card lq-cv-pad"><span class="lq-cv-kick">SÖZLEŞME BİLGİLERİ</span>
        ${row("Dönemsel ödeme", `${money(Number(c.monthlyPayment))} ${esc(c.currency || "")}`, "lq-cv-mono")}
        ${row("İskonto oranı", `%${esc(nf2.format(Number(c.discountRate) || 0))}`, "lq-cv-mono")}
        ${row("Artış", inc)}
        ${row("İlk doğrudan maliyet", money(Number(c.initialDirectCosts) || 0), "lq-cv-mono")}
        ${row("Faydalı ömür", c.usefulLifeMonths ? `${esc(c.usefulLifeMonths)} ay` : "Sözleşme süresi")}
      </section>
      <section class="lq-cv-card lq-cv-pad"><span class="lq-cv-kick">OPSİYONLAR VE TARİHLER</span>
        ${row("Yenileme", c.renewalOption ? "Var" : "Yok")}
        ${row("Yenileme tarihi", c.renewalDate ? trDate(c.renewalDate) : "—", c.renewalDate ? "lq-cv-mono is-warn" : "")}
        ${row("Bitiş", trDate(c.endDate), "lq-cv-mono")}
      </section>
      <div class="lq-cv-slot-std"></div>
    </aside>`;
  }

  /* ---------- Kurulum ---------- */
  function build() {
    const content = $("detailContent");
    if (!content || content.querySelector(":scope > .lq-cv-shell")) return;
    const engineTabs = content.querySelector(":scope > .gk-detail-tabs");
    if (!engineTabs) return; // hata ekranı vb.: motorun çıktısı olduğu gibi kalır
    const id = selectedId();
    const c = contractOf(id) || { id };
    if (state.contractId !== id) {
      state.contractId = id; state.tab = "calc"; state.sub = "modification"; state.openYears = new Map();
      state.report = null;
    }
    const shell = doc.createElement("div");
    shell.className = "lq-cv-shell";
    shell.innerHTML = `<header class="lq-cv-head"></header><div class="lq-cv-kpiwrap"></div><div class="lq-cv-notices"></div><div class="lq-cv-tabwrap"></div>
      <div class="lq-cv-body"><div class="lq-cv-main"><div class="lq-cv-calc"></div><div class="lq-cv-engine"></div></div><div class="lq-cv-side"></div></div>`;
    // Motorun öğeleri: standart paneli yan sütuna, uyarılar üstte, paneller ana alana taşınır.
    const std = content.querySelector(":scope > .gk-v26-auto-detect");
    const notices = [];
    Array.from(content.children).forEach(ch => {
      if (ch === engineTabs || ch.classList.contains("gk-detail-tab") || ch === std) return;
      notices.push(ch);
    });
    const panels = Array.from(content.querySelectorAll(":scope > .gk-detail-tab"));
    content.prepend(shell);
    shell.querySelector(".lq-cv-notices").append(...notices);
    engineTabs.hidden = true;
    engineTabs.classList.add("lq-cv-engine-tabs");
    shell.querySelector(".lq-cv-engine").append(engineTabs, ...panels);
    content.classList.add("lq-cv");
    render(c);
    if (std) shell.querySelector(".lq-cv-slot-std")?.append(std);
    applyTab(false);
  }

  function render(c) {
    const shell = $("detailContent")?.querySelector(":scope > .lq-cv-shell");
    if (!shell) return;
    c = c || contractOf(state.contractId) || { id: state.contractId };
    const std = shell.querySelector(".lq-cv-slot-std > *");
    shell.querySelector(".lq-cv-head").innerHTML = headHtml(c);
    shell.querySelector(".lq-cv-kpiwrap").innerHTML = kpiHtml(c);
    shell.querySelector(".lq-cv-tabwrap").innerHTML = tabsHtml();
    shell.querySelector(".lq-cv-calc").innerHTML = calcHtml();
    shell.querySelector(".lq-cv-side").innerHTML = asideHtml(c);
    if (std) shell.querySelector(".lq-cv-slot-std")?.append(std);
    renderAudit(shell);
    shell.setAttribute("data-tab", state.tab);
  }

  function renderAudit(shell) {
    const target = shell.querySelector("[data-authoritative-report-audit]");
    const r = state.report;
    if (!target || !r || r.error || !r.package) return;
    let rows = [];
    try { rows = global.LeaseQantReportingAuthorityUi.rawRows(r.package, "audit", state.contractId); } catch (_) { return; }
    target.innerHTML = rows.length
      ? `<ol class="lq-cv-audit">${rows.map(a => `<li><span class="lq-cv-mono">${esc(String(a.timestamp || "").replace("T", " ").slice(0, 16))}</span><strong>${esc(a.action || "Olay")}</strong><span>${esc(a.actor || "")}</span></li>`).join("")}</ol><p class="lq-cv-foot">Seçili raporlama dönemindeki sunucu olayları (${esc(trDate(r.period.periodStart))} – ${esc(trDate(r.period.periodEnd))}).</p>`
      : `<div class="lq-cv-empty"><h3>Bu dönemde olay yok</h3><p>Seçili raporlama döneminde bu sözleşme için sunucuya kayıtlı olay bulunmuyor.</p></div>`;
  }

  function engineTab(target) {
    const btn = $("detailContent")?.querySelector(`.lq-cv-engine-tabs [data-detail-tab-target="${target}"]`);
    btn?.click();
  }

  function applyTab(focus) {
    const shell = $("detailContent")?.querySelector(":scope > .lq-cv-shell");
    if (!shell) return;
    shell.setAttribute("data-tab", state.tab);
    shell.querySelectorAll("[data-lq-cv-tab]").forEach(b => {
      const on = b.getAttribute("data-lq-cv-tab") === state.tab;
      b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1;
      if (on && focus) b.focus();
    });
    const subs = shell.querySelector(".lq-cv-subs");
    if (subs) {
      subs.hidden = state.tab !== "events";
      subs.querySelectorAll("[data-lq-cv-sub]").forEach(b => b.setAttribute("aria-pressed", String(b.getAttribute("data-lq-cv-sub") === state.sub)));
    }
    if (state.tab === "calc") return;
    engineTab(state.tab === "events" ? state.sub : state.tab);
  }

  function go(spec) {
    const [tab, sub] = String(spec).split(":");
    state.tab = tab;
    if (sub) state.sub = sub;
    applyTab(false);
    $("detailModal")?.querySelector(".modal-body")?.scrollTo?.({ top: 0 });
  }

  function closeMenus(except) {
    $("detailContent")?.querySelectorAll(".lq-cv-pop").forEach(p => {
      if (p === except) return;
      p.hidden = true;
      p.previousElementSibling?.setAttribute("aria-expanded", "false");
    });
  }

  function downloadCsv() {
    const r = state.report;
    if (!r?.package || r.row?.status !== "SUPPORTED") return;
    const ui = global.LeaseQantReportingAuthorityUi;
    const text = ui.serialize(r.package, "csv", "schedule", state.contractId);
    const url = global.URL.createObjectURL(new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" }));
    const a = doc.createElement("a");
    a.href = url; a.download = `LeaseQant_${state.contractId}_${r.period.reportingDate}.csv`; a.click();
    global.setTimeout(() => global.URL.revokeObjectURL(url), 1000);
  }

  function onClick(e) {
    const shell = e.target.closest?.(".lq-cv-shell");
    if (!shell) { closeMenus(); return; }
    const t = e.target;
    const tab = t.closest("[data-lq-cv-tab]");
    if (tab) { state.tab = tab.getAttribute("data-lq-cv-tab"); applyTab(false); return; }
    const sub = t.closest("[data-lq-cv-sub]");
    if (sub) { state.sub = sub.getAttribute("data-lq-cv-sub"); applyTab(false); return; }
    const goBtn = t.closest("[data-lq-cv-go]");
    if (goBtn) { closeMenus(); go(goBtn.getAttribute("data-lq-cv-go")); return; }
    const year = t.closest("[data-lq-cv-year]");
    if (year) {
      const y = year.getAttribute("data-lq-cv-year");
      state.openYears.set(y, year.getAttribute("aria-expanded") !== "true");
      shell.querySelector(".lq-cv-calc").innerHTML = calcHtml();
      shell.querySelector(`[data-lq-cv-year="${y}"]`)?.focus();
      return;
    }
    const act = t.closest("[data-lq-cv-act]");
    if (act) {
      closeMenus();
      const a = act.getAttribute("data-lq-cv-act");
      if (a === "csv") downloadCsv();
      else if (a === "delete") $("deleteContract")?.click();
      else if (a === "pdf" || a === "html") global.GK_TFRS16?.exportReport?.(state.contractId, a);
      return;
    }
    const ctl = t.closest("[data-lq-cv]");
    if (!ctl) { closeMenus(); return; }
    const kind = ctl.getAttribute("data-lq-cv");
    if (kind === "back") closeDetail();
    else if (kind === "menu" || kind === "more") {
      const pop = ctl.nextElementSibling;
      const open = pop.hidden;
      closeMenus(pop);
      pop.hidden = !open;
      ctl.setAttribute("aria-expanded", String(open));
      if (open) pop.querySelector("button:not([disabled])")?.focus();
    } else if (kind === "to-current") {
      const r = state.report;
      const y = r?.period?.periodEnd?.slice(0, 4);
      if (y) { state.openYears.set(y, true); shell.querySelector(".lq-cv-calc").innerHTML = calcHtml(); }
      shell.querySelector(".lq-cv-trow.is-cur")?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }

  function onKey(e) {
    const tab = e.target.closest?.("[data-lq-cv-tab]");
    if (tab && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
      const list = Array.from(tab.parentElement.querySelectorAll("[data-lq-cv-tab]"));
      const i = list.indexOf(tab) + (e.key === "ArrowRight" ? 1 : -1);
      const next = list[(i + list.length) % list.length];
      state.tab = next.getAttribute("data-lq-cv-tab"); applyTab(true); e.preventDefault();
    }
    if (e.key === "Escape" && e.target.closest?.(".lq-cv-menu")) { closeMenus(); e.stopPropagation(); }
  }

  function onReport(e) {
    const d = e.detail || {};
    if (String(d.contractId) !== String(state.contractId)) return;
    state.report = d.error
      ? { error: d.error, period: d.period || period() }
      : { package: d.package, row: d.row, period: d.package?.period };
    render();
    applyTab(false);
  }

  function refreshReport() {
    const content = $("detailContent");
    const id = state.contractId;
    const c = contractOf(id);
    if (!content || !c || $("detailModal")?.classList.contains("hidden")) return;
    state.report = null;
    render(c);
    applyTab(false);
    global.LeaseQantReportingAuthorityUi?.renderContractDetails?.(content, c);
  }

  function init() {
    const content = $("detailContent");
    if (!content) return;
    new MutationObserver(() => build()).observe(content, { childList: true });
    content.addEventListener("click", onClick);
    content.addEventListener("keydown", onKey);
    doc.addEventListener("click", e => { if (!e.target.closest?.(".lq-cv-menu")) closeMenus(); });
    global.addEventListener("lq:contract-report", onReport);
    global.LeaseQantReportingPeriod?.subscribe?.(() => global.setTimeout(refreshReport, 0));
    $("v26ActiveCompanySelect")?.addEventListener("change", () => {
      if (!$("detailModal")?.classList.contains("hidden")) closeDetail();
    });
    build();
  }

  global.LeaseQantContractView = Object.freeze({ ...helpers, refresh: refreshReport });
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})(window);
