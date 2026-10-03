/* LeaseQant UI v2 — yeni sözleşme sihirbazı (tasarım: Sihirbaz).
   Motorun #contractModal / #contractForm formunu adım adım gösterir:
   1 Temel bilgiler · 2 Süre ve opsiyonlar · 3 Ödemeler · 4 Başlangıç ölçümü ·
   5 Muafiyet ve gözden geçir.
   - Alanlar aynı öğelerdir (id, name, olay dinleyicileri korunur); yalnızca
     formun içinde adım panellerine taşınırlar. Kaydetme motorun submit
     akışıyla yapılır; bu modül hesaplama veya API çağrısı yapmaz.
   - Kaydetmeden önce tüm adımlar doğrulanır; geçersiz alan varsa o adıma
     gidilir ve tarayıcının doğrulama mesajı gösterilir.
   - html[data-lq-ui="2"] değilse hiçbir şey yapmaz. */
((global) => {
  "use strict";
  const doc = global.document;
  const root = doc.documentElement;

  const STEPS = [
    { id: "basics", title: "Temel bilgiler", hint: "Sözleşme, şirket, kiraya veren ve para birimi." },
    { id: "term", title: "Süre ve opsiyonlar", hint: "Kira süresi ile yenileme, fesih ve satın alma opsiyonları. Makul ölçüde kesin opsiyonlar süreye dahil edilir (TFRS 16.18–21)." },
    { id: "payments", title: "Ödemeler", hint: "Kira yükümlülüğüne girecek ödemeler. Değişken ödemeler yalnızca bir endeks veya orana bağlıysa dahil edilir (TFRS 16.27)." },
    { id: "measure", title: "Başlangıç ölçümü", hint: "İskonto oranı ve kullanım hakkı varlığına eklenen / düşülen kalemler (TFRS 16.24, 26)." },
    { id: "review", title: "Muafiyet ve gözden geçir", hint: "Kısa vadeli ve düşük değerli varlık muafiyetleri, ardından kontrol ve kayıt." }
  ];
  const FIELD_STEP = {
    contractId: "basics", company: "basics", supplier: "basics", currency: "basics", functionalCurrency: "basics", reportingCurrency: "basics", assetClass: "basics", assetClassCustom: "basics",
    startDate: "term", endDate: "term", usefulLifeMonths: "term", renewalOption: "term", renewalDate: "term", renewalOptionExpectedToExercise: "term", renewalEndDate: "term",
    terminationOption: "term", terminationDate: "term", terminationPenalty: "term", purchaseOption: "term", purchaseOptionPrice: "term",
    residualValueGuarantee: "term", expectedResidualValueGuaranteePayment: "term", ownershipTransfer: "term",
    monthlyPayment: "payments", paymentFrequency: "payments", paymentTiming: "payments", leaseIncreaseType: "payments", leaseIncreaseRate: "payments",
    indexBaseRate: "payments", indexCurrentRate: "payments", indexReviewMonth: "payments", indexReviewDay: "payments",
    variablePayment: "payments", variablePaymentType: "payments", inSubstanceFixedPayment: "payments", explicitPaymentSchedule: "payments", rentFreePeriods: "payments",
    discountRate: "measure", initialDirectCosts: "measure", leaseIncentives: "measure", leaseIncentiveReceivables: "measure", prepayments: "measure", restorationObligation: "measure",
    shortTermLease: "review", lowValueAsset: "review", lowValueWhenNewConfirmed: "review", lowValueStandaloneUseConfirmed: "review",
    lowValueNotHighlyDependentConfirmed: "review", lowValueNoSubleaseConfirmed: "review"
  };
  const SECTION_STEP = [[/temel/i, "basics"], [/ödeme|opsiyon/i, "payments"], [/muafiyet|bayrak/i, "review"]];

  function stepForField(field) {
    const control = field.querySelector("input[id], select[id], textarea[id]") || (field.id ? field : null);
    const id = control ? control.id : "";
    if (FIELD_STEP[id]) return FIELD_STEP[id];
    if (field.id && FIELD_STEP[field.id]) return FIELD_STEP[field.id];
    const title = field.closest(".form-section")?.querySelector(".form-section-title")?.textContent || "";
    const hit = SECTION_STEP.find(([re]) => re.test(title));
    return hit ? hit[1] : "review";
  }

  /* Adımdaki ilk geçersiz alan (tarih alanlarında görünen metin kutusu). */
  function firstInvalid(panel) {
    const controls = Array.from(panel.querySelectorAll("input, select, textarea")).filter(c => !c.disabled && c.type !== "hidden" && !c.classList.contains("lq-date-native"));
    return controls.find(c => typeof c.checkValidity === "function" && !c.checkValidity()) || null;
  }

  const helpers = Object.freeze({ STEPS, stepForField, firstInvalid });
  if (root.getAttribute("data-lq-ui") !== "2") { global.LeaseQantContractWizard = helpers; return; }

  const $ = id => doc.getElementById(id);
  const state = { step: 0, built: false };
  let modal, form, card, panels = {}, list, aside, footerBack, footerNext, saveBtn;

  const val = id => { const el = $(id); if (!el) return ""; if (el.type === "checkbox") return el.checked; return (el.value || "").trim(); };
  const optText = id => { const el = $(id); return el && el.tagName === "SELECT" ? (el.selectedOptions[0]?.textContent || "").trim() : val(id); };
  const trDate = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || "")); return m ? `${m[3]}.${m[2]}.${m[1]}` : ""; };
  const esc = v => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function months(a, b) {
    const x = /^(\d{4})-(\d{2})-(\d{2})/.exec(a || ""), y = /^(\d{4})-(\d{2})-(\d{2})/.exec(b || "");
    if (!x || !y) return null;
    let n = (+y[1] - +x[1]) * 12 + (+y[2] - +x[2]);
    if (+y[3] >= +x[3] - 1) n += 1;
    return n > 0 ? n : null;
  }

  function summaries() {
    const m = months(val("startDate"), val("endDate"));
    const opts = ["renewalOption", "terminationOption", "purchaseOption"].filter(val).length;
    const pay = val("monthlyPayment");
    return {
      basics: val("supplier") || val("contractId") || "",
      term: m ? `${m} ay · ${opts ? `${opts} opsiyon` : "opsiyon yok"}` : "",
      payments: val("paymentFrequency") === "irregular" ? `Takvim · ${String(val("explicitPaymentSchedule") || "").split(/\n/).filter(l => l.trim()).length} ödeme`
        : pay ? `${pay} ${val("currency") || ""} · ${optText("paymentFrequency") || ""}` : "",
      measure: val("discountRate") ? `İO %${val("discountRate")}` : "",
      review: val("shortTermLease") || val("lowValueAsset") ? "Muafiyet seçili" : ""
    };
  }

  /* Rapor rotası tahmini: sunucunun sertifikalı rotası aylık + dönem sonu + onaylı profil.
     Bu yalnızca bilgilendirmedir; kesin karar kayıttan sonra sunucudadır. */
  function scopeHtml() {
    const freq = String(val("paymentFrequency") || "monthly").toLowerCase();
    const timing = String(val("paymentTiming") || "arrears").toLowerCase();
    const exempt = val("shortTermLease") || val("lowValueAsset");
    if (exempt) return `<div class="lq-wz-scope is-na"><i></i>Muafiyet: kullanım hakkı varlığı ve yükümlülük tanınmaz (TFRS 16.5–8)</div>`;
    if (freq === "irregular") return `<div class="lq-wz-scope is-ok"><i></i>Düzensiz · tarihli ödemeler: rapor rotası (ENGINE_DATED_GRID_V1)</div><p>Tutarlar ödeme takviminden hesaplanır; aylık kira alanı kullanılmaz. Modifikasyon ve yeniden değerlendirme bu sözleşmelerde henüz raporlanmaz.</p>`;
    const ok = ["monthly", "quarterly", "semiannual", "annual"].includes(freq) && ["arrears", "advance"].includes(timing);
    return ok
      ? `<div class="lq-wz-scope is-ok"><i></i>${esc(optText("paymentFrequency") || freq)} · ${esc(optText("paymentTiming") || timing)}: rapor rotası</div><p>Şirketin onaylı para birimi profili varsa tutarlar raporlarda ve sözleşme sayfasında görünür.</p>`
      : `<div class="lq-wz-scope is-warn"><i></i>${esc(optText("paymentFrequency") || freq)} · ${esc(optText("paymentTiming") || timing)}: sertifikalı rapor rotası dışında</div><p>Sözleşme kaydedilir ve motor hesaplar; ancak raporlama paketi bu sözleşme için tutar göstermez ("kapsam dışı").</p>`;
  }

  function renderSide() {
    const s = summaries();
    list.innerHTML = STEPS.map((st, i) => {
      const cur = i === state.step;
      const visited = i < state.step || (state.step === STEPS.length - 1 && !cur);
      const bad = visited && !!firstInvalid(panels[st.id]);
      const done = visited && !bad;
      return `<li${cur ? ' aria-current="step"' : ""}><button type="button" data-wz-go="${i}" class="lq-wz-step${cur ? " is-current" : done ? " is-done" : bad ? " is-bad" : ""}"${bad ? ' aria-label="' + esc(st.title) + ' — eksik alan var"' : ""}>
        <b aria-hidden="true">${done ? "✓" : bad ? "!" : i + 1}</b><span><strong>${esc(st.title)}</strong><small>${cur ? "Şu an buradasınız" : esc(s[st.id] || "")}</small></span></button></li>`;
    }).join("");
    const m = months(val("startDate"), val("endDate"));
    aside.innerHTML = `<section class="lq-wz-dark"><div class="lq-wz-dhead"><span>BAŞLANGIÇ ÖLÇÜMÜ</span><em>Kayıttan sonra</em></div>
      <p>Kira yükümlülüğü ve kullanım hakkı varlığı kaydettiğinizde sunucudaki hesaplama motoru tarafından hesaplanır; tarayıcıda tahmin yapılmaz.</p>
      <div class="lq-wz-kv"><span>Süre</span><b>${m ? `${m} ay` : "—"}</b><span>Dönemsel ödeme</span><b>${esc(val("monthlyPayment") || "—")} ${esc(val("currency") || "")}</b><span>İskonto oranı</span><b>${val("discountRate") ? `%${esc(val("discountRate"))}` : "—"}</b></div></section>
      <section class="lq-wz-card"><span class="lq-wz-kick">MOTOR KAPSAMI</span>${scopeHtml()}</section>`;
  }

  function renderReview() {
    const box = panels.review?.querySelector(".lq-wz-summary");
    if (!box) return;
    const rows = [
      ["Sözleşme", val("contractId")], ["Şirket", optText("company")], ["Kiraya veren", val("supplier")], ["Varlık sınıfı", optText("assetClass")],
      ["Süre", `${trDate(val("startDate"))} – ${trDate(val("endDate"))}`], ["Dönemsel ödeme", `${val("monthlyPayment")} ${val("currency")}`],
      ["Sıklık / zaman", `${optText("paymentFrequency")} · ${optText("paymentTiming")}`], ["Artış", optText("leaseIncreaseType")],
      ["İskonto oranı", val("discountRate") ? `%${val("discountRate")}` : ""]
    ];
    const invalid = STEPS.map((st, i) => [i, firstInvalid(panels[st.id])]).filter(([, c]) => c);
    box.innerHTML = `<h3>Gözden geçir</h3><div class="lq-wz-review">${rows.map(([k, v]) => `<span>${esc(k)}</span><b>${esc(v && String(v).trim() ? v : "—")}</b>`).join("")}</div>
      ${invalid.length ? `<p class="lq-wz-warn">${invalid.map(([i]) => `<button type="button" data-wz-go="${i}">${esc(STEPS[i].title)}</button>`).join(" · ")} adımında eksik veya hatalı alan var.</p>` : '<p class="lq-wz-ok">✓ Zorunlu alanlar tamam. Kaydedince sunucu hesaplar.</p>'}`;
  }

  function show(i, focus) {
    state.step = Math.max(0, Math.min(STEPS.length - 1, i));
    STEPS.forEach((st, k) => { panels[st.id].hidden = k !== state.step; });
    const last = state.step === STEPS.length - 1;
    footerBack.hidden = state.step === 0;
    footerNext.hidden = last;
    footerNext.textContent = last ? "" : `İleri: ${STEPS[state.step + 1].title}`;
    saveBtn.hidden = !last;
    if (last) renderReview();
    renderSide();
    const body = form.querySelector(".modal-body");
    if (body) body.scrollTop = 0;
    if (focus) panels[STEPS[state.step].id].querySelector("h3")?.focus();
  }

  function validateStep(i) {
    // Forms opened for editing set the frequency without a change event.
    const dated = val("paymentFrequency") === "irregular";
    if ($("monthlyPayment")) $("monthlyPayment").required = !dated;
    if ($("explicitPaymentSchedule")) $("explicitPaymentSchedule").required = dated;
    const bad = firstInvalid(panels[STEPS[i].id]);
    if (!bad) return true;
    bad.reportValidity?.();
    bad.focus?.();
    return false;
  }

  function assignFields() {
    Array.from(form.querySelectorAll(".form-field")).forEach(field => {
      if (field.closest(".lq-wz-panel")) return;
      const step = stepForField(field);
      panels[step].querySelector(".lq-wz-grid").append(field);
    });
    form.querySelectorAll(".form-section").forEach(sec => { if (!sec.querySelector(".form-field")) sec.classList.add("lq-wz-empty"); });
  }

  function build() {
    modal = $("contractModal"); form = $("contractForm");
    if (!modal || !form || state.built) return;
    card = modal.querySelector(".modal-card");
    const body = form.querySelector(".modal-body");
    if (!card || !body) return;
    state.built = true;
    modal.classList.add("lq-wiz");
    const layout = doc.createElement("div");
    layout.className = "lq-wz-layout";
    list = doc.createElement("ol");
    list.className = "lq-wz-steps";
    list.setAttribute("aria-label", "Adımlar");
    aside = doc.createElement("aside");
    aside.className = "lq-wz-aside";
    STEPS.forEach(st => {
      const p = doc.createElement("section");
      p.className = "lq-wz-panel";
      p.dataset.step = st.id;
      p.innerHTML = `<div class="lq-wz-head"><h3 tabindex="-1">${esc(st.title)}</h3><p>${esc(st.hint)}</p></div>${st.id === "review" ? '<div class="lq-wz-summary"></div>' : ""}<div class="lq-wz-grid"></div>`;
      panels[st.id] = p;
      body.append(p);
    });
    // Form gövdesi ortada; adım listesi solda, özet sağda
    card.insertBefore(layout, form);
    layout.append(list, form, aside);
    assignFields();
    // Sonradan eklenen alanlar (para birimi alanları vb.) da adımlara dağıtılır
    new MutationObserver(() => assignFields()).observe(form, { childList: true, subtree: true });

    const footer = form.querySelector(".modal-footer");
    saveBtn = $("saveContractButton");
    footerBack = doc.createElement("button");
    footerBack.type = "button"; footerBack.className = "btn btn-secondary lq-wz-back"; footerBack.textContent = "Geri";
    footerNext = doc.createElement("button");
    footerNext.type = "button"; footerNext.className = "btn btn-primary lq-wz-next";
    footer.insertBefore(footerBack, footer.firstChild);
    footer.append(footerNext);
    footerBack.addEventListener("click", () => show(state.step - 1, true));
    footerNext.addEventListener("click", () => { if (validateStep(state.step)) show(state.step + 1, true); });
    list.addEventListener("click", e => { const b = e.target.closest("[data-wz-go]"); if (b) show(Number(b.dataset.wzGo), true); });
    panels.review.addEventListener("click", e => { const b = e.target.closest("[data-wz-go]"); if (b) { const i = Number(b.dataset.wzGo); show(i, false); validateStep(i); } });
    form.addEventListener("input", () => { renderSide(); if (state.step === STEPS.length - 1) renderReview(); });
    // A dated schedule carries the amounts: the periodic payment is not
    // required, the schedule is.
    const syncDated = () => {
      const dated = val("paymentFrequency") === "irregular";
      const pay = $("monthlyPayment"), schedule = $("explicitPaymentSchedule");
      if (pay) { pay.required = !dated; if (dated) pay.value = "0"; }
      if (schedule) schedule.required = dated;
    };
    syncDated();
    form.addEventListener("change", () => { syncDated(); renderSide(); if (state.step === STEPS.length - 1) renderReview(); });
    // Kaydet: önce tüm adımlar doğrulanır; gizli adımdaki alan tarayıcıyı sessizce durdurmasın
    saveBtn.addEventListener("click", e => {
      for (let i = 0; i < STEPS.length; i++) {
        if (firstInvalid(panels[STEPS[i].id])) { e.preventDefault(); e.stopImmediatePropagation(); show(i, false); validateStep(i); return; }
      }
    }, true);
    form.addEventListener("keydown", e => {
      if (e.key === "Enter" && e.target.tagName === "INPUT" && state.step < STEPS.length - 1) { e.preventDefault(); footerNext.click(); }
    });
  }

  function onOpen() {
    build();
    if (!state.built) return;
    assignFields();
    const editing = /düzenle/i.test($("contractModalTitle")?.textContent || "");
    modal.classList.toggle("is-edit", editing);
    show(0, false);
    global.setTimeout(() => panels.basics.querySelector("input:not([type=hidden]):not(.lq-date-native), select")?.focus(), 30);
  }

  function init() {
    const m = $("contractModal");
    if (!m) return;
    let wasOpen = !m.classList.contains("hidden");
    new MutationObserver(() => {
      const open = !m.classList.contains("hidden");
      if (open && !wasOpen) onOpen();
      wasOpen = open;
    }).observe(m, { attributes: true, attributeFilter: ["class"] });
    if (wasOpen) onOpen();
  }

  global.LeaseQantContractWizard = Object.freeze({ ...helpers, show: i => show(i, true) });
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})(window);
