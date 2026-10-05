/* LeaseQant UI v2 — Faz 4: Genel Bakış grafikleri.
   - Kaynak: özel hesaplama sınırındaki dipnot paketi
     (LeaseQantPrivateTfrs16Facade.loadLeaseDisclosureAvailability + loadLeaseDisclosure).
     Bu modül hesaplama yapmaz; paketteki tutarları çizer. Tek türetilen değerler
     görsel mutabakat farklarıdır ve ekranda "fark" olarak etiketlenir.
   - Yalnızca tek şirket seçiliyken ve ortak raporlama döneminde çalışır.
   - Paket kapsamı (şirket, dönem, popülasyon, para birimi, doğrulama) dipnot
     ekranıyla aynı kurallarla denetlenir; uyuşmazsa grafik çizilmez.
   - Kaynağı olmayan kalem sıfır sayılmaz: "Kaynak gerekli" olarak gösterilir.
   - html[data-lq-ui="2"] değilse hiçbir şey yapmaz. */
((global) => {
  "use strict";
  const doc = global.document;
  const root = doc.documentElement;

  const VALUE_STATUSES = new Set(["SUPPORTED", "ZERO_CONFIRMED"]);
  const STATUS_LABELS = Object.freeze({
    REQUIRES_LEDGER_DATA: "Defter verisi gerekli",
    REQUIRES_ENTITY_INPUT: "Şirket girdisi gerekli",
    NOT_SUPPORTED: "Desteklenmiyor",
    NOT_DISCLOSURE_READY: "Güvenilir kaynak hazır değil",
    NOT_APPLICABLE: "Uygulanmıyor",
    NOT_PROVIDED: "Kaynak veri gerekli",
    NOT_CALCULABLE: "Hesaplama kaynağı gerekli",
    BACKEND_FIELD_MISSING: "Sunucu alanı henüz yok"
  });
  const TOLERANCE = 0.5;

  /* ---------- Saf yardımcılar (testte doğrudan çağrılır) ---------- */
  const isNum = v => typeof v === "number" && Number.isFinite(v);
  const hasValue = f => !!f && typeof f === "object" && VALUE_STATUSES.has(f.status) && isNum(f.value);
  const statusText = f => STATUS_LABELS[f && f.status] || STATUS_LABELS.BACKEND_FIELD_MISSING;

  /* Kira yükümlülüğü köprüsü.
     Açılış + ilk muhasebeleştirme + faiz − ödemeler ± modifikasyon ± yeniden ölçüm
     ± TMS 21 kur farkı (+ mutabakat farkı) = kapanış.
     Ödemeler gerçekleşen nakit çıkışından alınır; yoksa planlanan ödeme kullanılır
     ve satır "planlanan" olarak işaretlenir. Mutabakat farkı paketin açıkça
     vermediği hareketleri (ör. TMS 29 parasal kazanç/kayıp) gizlemeden gösterir. */
  const ASSET_CLASS_LABELS = { PROPERTY: "Gayrimenkul", VEHICLES: "Taşıtlar", PLANT_EQUIPMENT: "Makine ve ekipman",
    IT_EQUIPMENT: "Bilgi teknolojileri ekipmanı", OTHER: "Diğer" };

  function bridgeModel(pkg) {
    const q = (pkg && pkg.quantitative) || {};
    const l = (pkg && pkg.periodMovement && pkg.periodMovement.liability) || {};
    const maturity = (pkg && pkg.maturityAnalysis) || {};
    const opening = l.opening;
    const closing = l.closing || maturity.discountedLeaseLiabilityCarryingAmount;

    // The liability is settled by its contractual lease payments. Total cash
    // outflow (16.53(g)) also carries short-term/low-value and variable
    // payments that never touched the liability, so it is not the bridge line.
    const actual = l.actualCashOutflow || q.totalCashOutflowForLeases;
    const scheduled = l.scheduledContractualCash || q.scheduledContractualCash;
    const paymentPlanned = hasValue(scheduled);
    // An advance paid on the commencement date is part of the ROU cost,
    // not a settlement of the recognised liability (IFRS 16.24(b)).
    const advance = l.commencementAdvance;
    const advanceValue = hasValue(advance) ? advance.value : 0;
    const payment = paymentPlanned
      ? (advanceValue ? { ...scheduled, value: scheduled.value - advanceValue } : scheduled)
      : actual;

    // IAS 29: the liability movement in the reporting-date unit, closing
    // with the gain/loss on the net monetary position (TMS 29.27).
    const t29 = l.tms29 && l.tms29.status === "SUPPORTED" ? l.tms29.totals : null;
    if (t29) {
      const f = value => ({ value, status: Math.abs(value) < 0.005 ? "ZERO_CONFIRMED" : "SUPPORTED", currency: closing && closing.currency });
      const tSteps = [
        { id: "additions", label: "İlk muhasebeleştirme girişleri", field: f(t29.initialRecognitionAdditions) },
        { id: "interest", label: "Faiz gideri (etkin faiz)", field: f(t29.interest) },
        { id: "payments", label: "Kira ödemeleri (sözleşmesel)", field: f(t29.scheduledContractualCash - t29.commencementAdvance), negate: true,
          note: "Yükümlülüğü azaltan sözleşmesel ödemeler; istisna kira ödemeleri ve başlangıçtaki peşin ödeme hariç." },
        { id: "modifications", label: "Modifikasyonlar", field: f(t29.modifications) },
        { id: "remeasurements", label: "Yeniden ölçüm", field: f(t29.remeasurements) },
        { id: "tms21", label: "TMS 21 kur farkı", field: f(t29.tms21Movement) },
        { id: "tms29", label: "TMS 29 parasal kazanç/kayıp", field: f(t29.monetaryGainLoss),
          note: "Parasal yükümlülüğün enflasyon karşısındaki kazancı (−) / kaybı (+); kâr veya zarara yansır (TMS 29.27)." }
      ];
      return finishBridge(f(t29.opening), closing, tSteps, true, pkg);
    }
    const steps = [
      { id: "additions", label: "İlk muhasebeleştirme girişleri", field: l.initialRecognitionAdditions },
      { id: "interest", label: "Faiz gideri (etkin faiz)", field: l.interest || q.interestExpense },
      { id: "payments", label: paymentPlanned ? "Kira ödemeleri (sözleşmesel)" : "Kira ödemeleri", field: payment,
        note: paymentPlanned ? `Yükümlülüğü azaltan sözleşmesel ödemeler; istisna kira ödemeleri${advanceValue ? " ve başlangıçtaki peşin ödeme (NDD maliyeti)" : ""} hariç.` : "", negate: true },
      { id: "modifications", label: "Modifikasyonlar", field: l.modifications },
      { id: "remeasurements", label: "Yeniden ölçüm", field: l.remeasurements },
      { id: "tms21", label: "TMS 21 kur farkı", field: l.tms21Movement }
    ];
    return finishBridge(opening, closing, steps, paymentPlanned, pkg);
  }

  function finishBridge(opening, closing, rawSteps, paymentPlanned, pkg) {
    const steps = rawSteps.map(s => {
      if (s.field && s.field.status === "NOT_APPLICABLE") return { ...s, kind: "na", status: statusText(s.field) };
      if (!hasValue(s.field)) return { ...s, kind: "missing", status: statusText(s.field) };
      let v = s.field.value;
      if (s.negate) v = -Math.abs(v);
      return { ...s, kind: v >= 0 ? "up" : "down", value: v };
    });

    const rows = [];
    const openingOk = hasValue(opening), closingOk = hasValue(closing);
    rows.push(openingOk ? { id: "opening", label: "Açılış", kind: "total", value: opening.value }
      : { id: "opening", label: "Açılış", kind: "missing", status: statusText(opening) });

    let running = openingOk ? opening.value : 0;
    const extents = openingOk ? [running] : [0];
    steps.forEach(s => {
      if (s.kind === "missing" || s.kind === "na") { rows.push(s); return; }
      const from = running;
      running += s.value;
      rows.push({ ...s, from, to: running });
      extents.push(from, running);
    });

    let residual = null;
    if (openingOk && closingOk) {
      const diff = closing.value - running;
      if (Math.abs(diff) > TOLERANCE) {
        residual = diff;
        const from = running;
        running += diff;
        rows.push({ id: "residual", kind: "residual", value: diff, from, to: running,
          label: "Mutabakat farkı",
          note: "Pakette ayrı satırı olmayan hareketler: TMS 29 parasal kazanç/kayıp, kaynağı gelmeyen kalemler"
            + (paymentPlanned ? ", planlanan ile gerçekleşen ödeme farkı." : ".") });
        extents.push(from, running);
      }
    }
    rows.push(closingOk ? { id: "closing", label: "Kapanış", kind: "total", value: closing.value }
      : { id: "closing", label: "Kapanış", kind: "missing", status: statusText(closing) });
    if (closingOk) extents.push(closing.value);

    const missing = rows.filter(r => r.kind === "missing").length;
    /* Eksen: hareketler bakiyeye göre küçük kaldığında okunabilsin diye eksen
       sıfırdan değil, en düşük ara bakiyenin biraz altından başlar; bu durumda
       açılış/kapanış çubukları "kesik eksen" işaretiyle çizilir. */
    const lo = Math.min(...extents), hi = Math.max(...extents);
    let min = Math.min(0, lo), max = Math.max(0, hi);
    if (lo > 0) {
      const cut = lo - Math.max((hi - lo) * 0.35, hi * 0.02);
      if (cut > 0 && cut > hi * 0.25) min = cut;
    }
    return {
      rows, residual, paymentPlanned, missing, min, max, axisCut: min > 0,
      currency: (closing && closing.currency) || (opening && opening.currency) || (pkg && pkg.period && pkg.period.presentationCurrency) || "",
      complete: openingOk && closingOk && missing === 0
    };
  }

  /* Vade analizi: iskonto edilmemiş dilimler ve defter değerine mutabakat. */
  function maturityModel(pkg) {
    const m = (pkg && pkg.maturityAnalysis) || {};
    const carrying = m.discountedLeaseLiabilityCarryingAmount;
    const currency = m.currency || (pkg && pkg.period && pkg.period.presentationCurrency) || "";
    if (m.status !== "SUPPORTED" || !Array.isArray(m.bands)) {
      return { supported: false, status: statusText(m), limitation: m.limitation || "", currency };
    }
    const bands = m.bands.map(b => {
      const field = { status: b.status || "SUPPORTED", value: b.undiscountedCashFlow };
      return hasValue(field)
        ? { id: b.bandId, label: b.label || b.bandId, value: field.value }
        : { id: b.bandId, label: b.label || b.bandId, value: null, status: statusText(field) };
    });
    const totalField = { status: m.undiscountedTotalStatus || m.status, value: m.undiscountedTotal };
    const total = hasValue(totalField) ? totalField.value : null;
    const carryingValue = hasValue(carrying) ? carrying.value : null;
    const finance = total !== null && carryingValue !== null ? total - carryingValue : null;
    const bandSum = bands.every(b => b.value !== null) ? bands.reduce((a, b) => a + b.value, 0) : null;
    return {
      supported: true, currency, bands, total, carrying: carryingValue, finance,
      bandsMatchTotal: bandSum !== null && total !== null ? Math.abs(bandSum - total) <= TOLERANCE : null,
      max: Math.max(0, ...bands.map(b => b.value || 0))
    };
  }

  /* Kullanım hakkı varlığı — varlık sınıfına göre kapanış. */
  function assetModel(pkg) {
    const q = (pkg && pkg.quantitative) || {};
    const f = q.rouCarryingAmountByAssetClass;
    const currency = (f && f.currency) || (pkg && pkg.period && pkg.period.presentationCurrency) || "";
    if (!f || !VALUE_STATUSES.has(f.status) || !Array.isArray(f.value)) {
      return { supported: false, status: statusText(f), currency };
    }
    const items = f.value.filter(i => i && isNum(i.value))
      .map(i => ({ label: ASSET_CLASS_LABELS[i.assetClass] || i.assetClass || "Sınıflandırılmamış", value: i.value, currency: i.currency || currency }))
      .sort((a, b) => b.value - a.value);
    const total = items.reduce((a, b) => a + b.value, 0);
    return { supported: true, currency, items, total,
      max: Math.max(0, ...items.map(i => i.value)) };
  }

  function errorMessage(error) {
    if (!error) return "Grafik verisi alınamadı.";
    if (error.status === 401) return "Oturum açmanız gerekiyor.";
    if (error.status === 403) return "Bu şirketin raporlarına erişim yetkiniz yok.";
    if (error.code === "DISCLOSURE_TRUSTED_SOURCE_REQUIRED")
      return "Seçilen dönem için onaylı hesaplama kaydı yok. Grafikler yalnızca kaynağa bağlı hesaplama kaydından çizilir.";
    if (error.code === "SCOPE_MISMATCH") return "Sunucu yanıtı seçilen şirket/dönemle uyuşmadı; grafik gösterilmiyor.";
    if (error.code === "ADAPTER_UNAVAILABLE") return "Raporlama servisi bu sürümde hazır değil.";
    return "Grafik verisi alınamadı. Lütfen sonra tekrar deneyin.";
  }

  /* Paket kapsamı dipnot ekranıyla aynı kurallarla denetlenir. */
  function scopeOk(pkg, req, availability) {
    const sorted = a => JSON.stringify([...(a || [])].map(String).sort());
    return !!pkg && !!availability
      && pkg.identity && String(pkg.identity.companyId) === String(req.companyId)
      && pkg.period && pkg.period.reportingPeriodStart === req.reportingPeriodStart
      && pkg.period.reportingDate === req.reportingDate
      && pkg.population && pkg.population.populationId === availability.populationId
      && sorted(pkg.population.includedContractIds) === sorted(availability.contractIds)
      && sorted(pkg.population.includedCalculationIds) === sorted(availability.calculationIds)
      && pkg.period.presentationCurrency === (availability.currencyProfile && availability.currencyProfile.presentationCurrency)
      && pkg.identity.currencyEvidenceId === (availability.currencyProfile && availability.currencyProfile.evidenceId)
      && !(pkg.validation && pkg.validation.status === "FAILED_VALIDATION");
  }

  /* ---------- Biçimlendirme ---------- */
  const nf0 = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
  const nf2 = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const signed = v => (v > 0 ? "+" : v < 0 ? "−" : "") + nf0.format(Math.abs(v));
  const esc = v => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pct = (v, min, span) => ((v - min) / span) * 100;

  function renderBridge(model) {
    const span = (model.max - model.min) || 1;
    const zero = pct(0, model.min, span);
    const rows = model.rows.map(r => {
      if (r.kind === "missing" || r.kind === "na") {
        return `<div class="lq-wf-row is-${r.kind}" role="row"><span class="lq-wf-label" role="rowheader">${esc(r.label)}</span>`
          + `<span class="lq-wf-track" role="cell"><span class="lq-wf-need">${esc(r.status)}</span></span>`
          + `<span class="lq-wf-val" role="cell">—</span></div>`;
      }
      let left, width, val;
      if (r.kind === "total") {
        const base = model.axisCut ? model.min : 0;
        const a = pct(Math.min(base, r.value), model.min, span), b = pct(Math.max(base, r.value), model.min, span);
        left = a; width = b - a; val = nf0.format(r.value);
      } else {
        const a = pct(Math.min(r.from, r.to), model.min, span), b = pct(Math.max(r.from, r.to), model.min, span);
        left = a; width = b - a; val = signed(r.value);
      }
      const title = `${r.label}: ${nf2.format(r.value)} ${model.currency}`.trim();
      return `<div class="lq-wf-row is-${r.kind}" role="row" title="${esc(title)}">`
        + `<span class="lq-wf-label" role="rowheader">${esc(r.label)}${r.note ? `<small>${esc(r.note)}</small>` : ""}</span>`
        + `<span class="lq-wf-track" role="cell">${model.axisCut ? "" : `<i class="lq-wf-zero" style="left:${zero.toFixed(3)}%"></i>`}`
        + `<b class="lq-wf-bar${model.axisCut && r.kind === "total" ? " is-cut" : ""}" style="left:${left.toFixed(3)}%;width:${Math.max(width, 0.4).toFixed(3)}%"></b></span>`
        + `<span class="lq-wf-val" role="cell">${esc(val)}</span></div>`;
    }).join("");
    const foot = model.complete
      ? (model.residual === null ? `<p class="lq-chart-note is-ok">Açılış ve hareketler kapanışla mutabık.</p>` : "")
      : `<p class="lq-chart-note">${model.missing} kalem için kaynak yok; köprü eksik kalemler sıfır sayılmadan çizildi.</p>`;
    const axis = model.axisCut ? `<p class="lq-chart-axis">Eksen ${nf0.format(model.min)} ${esc(model.currency)} değerinden başlar; açılış ve kapanış çubukları kesiktir.</p>` : "";
    return `<div class="lq-wf" role="table" aria-label="Kira yükümlülüğü köprüsü">${rows}</div>${foot}${axis}`;
  }

  function renderMaturity(model) {
    if (!model.supported) {
      return `<p class="lq-chart-empty">${esc(model.status)}${model.limitation ? `<small>${esc(model.limitation)}</small>` : ""}</p>`;
    }
    const max = model.max || 1;
    const bars = model.bands.map(b => b.value === null
      ? `<div class="lq-mat-col is-missing"><span class="lq-mat-bar-wrap"><span class="lq-wf-need">${esc(b.status)}</span></span><span class="lq-mat-label">${esc(b.label)}</span></div>`
      : `<div class="lq-mat-col" title="${esc(`${b.label}: ${nf2.format(b.value)} ${model.currency}`)}"><span class="lq-mat-val">${nf0.format(b.value)}</span>`
        + `<span class="lq-mat-bar-wrap"><b class="lq-mat-bar" style="height:${Math.max((b.value / max) * 100, 1).toFixed(2)}%"></b></span>`
        + `<span class="lq-mat-label">${esc(b.label)}</span></div>`).join("");
    const line = (label, v, cls) => `<div class="lq-rec-row ${cls || ""}"><span>${esc(label)}</span><b>${v === null ? "—" : (cls === "is-sub" ? `(${nf0.format(v)})` : nf0.format(v))}</b></div>`;
    const rec = line("İskonto edilmemiş toplam", model.total)
      + line("− Gelecek dönem finansman gideri (fark)", model.finance, "is-sub")
      + line("= Kira yükümlülüğü defter değeri", model.carrying, "is-total");
    const warn = model.bandsMatchTotal === false ? `<p class="lq-chart-note">Dilim toplamı iskonto edilmemiş toplamla uyuşmuyor.</p>` : "";
    return `<div class="lq-mat" role="img" aria-label="İskonto edilmemiş vade dilimleri">${bars}</div><div class="lq-rec">${rec}</div>${warn}`;
  }

  function renderAssets(model) {
    if (!model.supported) return `<p class="lq-chart-empty">${esc(model.status)}</p>`;
    if (!model.items.length) return `<p class="lq-chart-empty">Varlık sınıfı kırılımı boş.</p>`;
    const max = model.max || 1;
    const rows = model.items.map((i, n) => {
      const share = model.total ? (i.value / model.total) * 100 : 0;
      return `<div class="lq-cls-row" title="${esc(`${i.label}: ${nf2.format(i.value)} ${i.currency}`)}">`
        + `<span class="lq-cls-label"><i class="lq-cls-dot c${n % 6}"></i>${esc(i.label)}</span>`
        + `<span class="lq-cls-track"><b class="c${n % 6}" style="width:${Math.max((i.value / max) * 100, 0.5).toFixed(2)}%"></b></span>`
        + `<span class="lq-cls-val">${nf0.format(i.value)}<small>%${nf0.format(share)}</small></span></div>`;
    }).join("");
    return `<div class="lq-cls">${rows}</div><div class="lq-rec"><div class="lq-rec-row is-total"><span>Kullanım hakkı varlığı — kapanış</span><b>${nf0.format(model.total)}</b></div></div>`;
  }

  const helpers = Object.freeze({ bridgeModel, maturityModel, assetModel, scopeOk, errorMessage, renderBridge, renderMaturity, renderAssets });

  if (root.getAttribute("data-lq-ui") !== "2") { global.LeaseQantDashboardCharts = helpers; return; }

  /* ---------- Sayfaya bağlama ---------- */
  const $ = id => doc.getElementById(id);
  const cache = new Map();
  const CACHE_MS = 120000; // yeni hesaplama kaydı birkaç dakika içinde görünür
  let sequence = 0;
  let section = null;

  function card(kicker, title, chip, bodyId, extraClass) {
    return `<article class="lq-dash-card lq-chart2 ${extraClass || ""}"><div class="lq-card-head"><div><span class="lq-card-kicker">${kicker}</span><h3>${title}</h3></div>`
      + `${chip ? `<span class="lq-chip" data-lq-chart-chip>${chip}</span>` : ""}</div><div class="lq-chart-body" id="${bodyId}"></div></article>`;
  }

  function ensureSection() {
    if (section) return section;
    const dash = $("lqDashboard");
    const grid = dash && dash.querySelector(".lq-dashboard-grid");
    if (!grid) return null;
    section = doc.createElement("section");
    section.id = "lqCharts";
    section.className = "lq-charts";
    section.setAttribute("aria-label", "TFRS 16 grafikleri");
    section.setAttribute("aria-live", "polite");
    section.innerHTML = `<div class="lq-charts-state" id="lqChartsState" hidden></div>`
      + `<div class="lq-charts-grid" id="lqChartsGrid">`
      + card("KİRA YÜKÜMLÜLÜĞÜ", "Dönem hareketi (açılıştan kapanışa)", "", "lqChartBridge", "lq-chart2-wide")
      + card("LİKİDİTE · TFRS 16.58", "Vade analizi (iskonto edilmemiş)", "", "lqChartMaturity")
      + card("KULLANIM HAKKI VARLIĞI", "Varlık sınıfı dağılımı", "", "lqChartAssets")
      + `</div>`;
    grid.parentNode.insertBefore(section, grid);
    root.setAttribute("data-lq-charts", "on");
    section.addEventListener("click", e => {
      const btn = e.target.closest("[data-lq-open]");
      if (btn) doc.querySelector(`.nav-item[data-open="${btn.getAttribute("data-lq-open")}"]`)?.click();
    });
    return section;
  }

  function showState(kind, html) {
    const state = $("lqChartsState"), grid = $("lqChartsGrid");
    if (!state || !grid) return;
    section.setAttribute("data-state", kind);
    if (kind === "ready") { state.hidden = true; state.innerHTML = ""; grid.hidden = false; return; }
    if (kind === "loading") {
      state.hidden = true; grid.hidden = false;
      ["lqChartBridge", "lqChartMaturity", "lqChartAssets"].forEach(id => {
        const el = $(id); if (el) el.innerHTML = `<div class="lq-skel" aria-hidden="true"><i></i><i></i><i></i><i></i></div><span class="lq-sr">Yükleniyor</span>`;
      });
      return;
    }
    grid.hidden = true; state.hidden = false; state.innerHTML = html;
  }

  function currentRequest() {
    const select = $("v26ActiveCompanySelect");
    const companyId = select ? select.value : "";
    const p = global.LeaseQantReportingPeriod && global.LeaseQantReportingPeriod.get();
    if (!p) return null;
    return { companyId, reportingPeriodStart: p.periodStart, reportingPeriodEnd: p.periodEnd, reportingDate: p.reportingDate };
  }

  function draw(pkg, req) {
    const currency = (pkg.period && pkg.period.presentationCurrency) || "";
    const b = $("lqChartBridge"), m = $("lqChartMaturity"), a = $("lqChartAssets");
    const bm = bridgeModel(pkg);
    if (b) b.innerHTML = renderBridge(bm);
    if (m) m.innerHTML = renderMaturity(maturityModel(pkg));
    if (a) a.innerHTML = renderAssets(assetModel(pkg));
    const [y, mo, d] = req.reportingDate.split("-");
    section.querySelectorAll(".lq-chart2 .lq-card-head").forEach(head => {
      let chip = head.querySelector("[data-lq-chart-chip]");
      if (!chip) { chip = doc.createElement("span"); chip.className = "lq-chip"; chip.setAttribute("data-lq-chart-chip", ""); head.append(chip); }
      chip.textContent = `${d}.${mo}.${y}${currency ? ` · ${currency}` : ""}`;
    });
    showState("ready");
  }

  function refresh() {
    const dash = $("lqDashboard");
    if (!dash || dash.hidden || !ensureSection()) return;
    const req = currentRequest();
    if (!req) return;
    if (!req.companyId || req.companyId === "ALL") {
      sequence++;
      showState("empty", `<div class="lq-charts-msg"><strong>Grafikler şirket bazında gösterilir.</strong><span>Üst çubuktaki şirket seçiciden bir şirket seçin. Konsolide görünüm bu sürümde yok.</span></div>`);
      return;
    }
    const key = `${req.companyId}|${req.reportingPeriodStart}|${req.reportingDate}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_MS) { draw(hit.pkg, req); return; }
    const facade = global.LeaseQantPrivateTfrs16Facade;
    const seq = ++sequence;
    if (!facade || typeof facade.loadLeaseDisclosureAvailability !== "function" || typeof facade.loadLeaseDisclosure !== "function") {
      showState("error", `<div class="lq-charts-msg is-error"><strong>${esc(errorMessage({ code: "ADAPTER_UNAVAILABLE" }))}</strong></div>`);
      return;
    }
    showState("loading");
    let availability = null;
    Promise.resolve()
      .then(() => facade.loadLeaseDisclosureAvailability(req))
      .then(av => { if (seq !== sequence) return null; availability = av; return facade.loadLeaseDisclosure(av); })
      .then(pkg => {
        if (seq !== sequence || !pkg) return;
        if (!scopeOk(pkg, req, availability)) throw Object.assign(new Error("scope"), { code: "SCOPE_MISMATCH" });
        cache.set(key, { pkg, at: Date.now() });
        draw(pkg, req);
      })
      .catch(error => {
        if (seq !== sequence) return;
        const source = error && error.code === "DISCLOSURE_TRUSTED_SOURCE_REQUIRED";
        showState("error", `<div class="lq-charts-msg ${source ? "" : "is-error"}"><strong>${esc(errorMessage(error))}</strong>`
          + (source ? `<button type="button" class="lq-inline-action" data-lq-open="footnotes">Dipnotlar ekranında kaynak oluştur →</button>` : "")
          + `</div>`);
      });
  }

  let pending = 0;
  const schedule = () => { global.clearTimeout(pending); pending = global.setTimeout(refresh, 60); };

  function init() {
    const dash = $("lqDashboard");
    if (!dash) return;
    new MutationObserver(schedule).observe(dash, { attributes: true, attributeFilter: ["hidden", "style"] });
    $("v26ActiveCompanySelect")?.addEventListener("change", schedule);
    global.LeaseQantReportingPeriod?.subscribe?.(schedule);
    schedule();
  }

  global.LeaseQantDashboardCharts = Object.freeze({ ...helpers, refresh, clearCache: () => cache.clear() });
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})(window);
