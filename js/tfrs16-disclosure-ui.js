/* TFRS16 Dipnotlar: source-bound disclosure values, presentation only. */
(function (global) {
  "use strict";

  const VALUE_STATUSES = new Set(["SUPPORTED", "ZERO_CONFIRMED"]);
  const STATUS_LABELS = Object.freeze({
    SUPPORTED: "Veri mevcut", ZERO_CONFIRMED: "Doğrulanmış sıfır",
    REQUIRES_LEDGER_DATA: "Defter verisi gerekli",
    REQUIRES_ENTITY_INPUT: "Şirket girdisi gerekli",
    NOT_SUPPORTED: "Desteklenmiyor",
    NOT_YET_SUPPORTED: "Henüz desteklenmiyor", OUT_OF_SCOPE: "Açıklama kapsamı dışında",
    NOT_DISCLOSURE_READY: "Dipnot için güvenilir kaynak hazır değil",
    NOT_APPLICABLE: "Uygulanmıyor",
    NOT_PROVIDED: "Kaynak veri gerekli",
    NOT_CALCULABLE: "Güvenilir hesaplama kaynağı gerekli",
    BACKEND_FIELD_MISSING: "Arka uç rapor alanı henüz yok"
  });
  const MISSING = Object.freeze({ status: "BACKEND_FIELD_MISSING", value: null });

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function isoDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }

  function validPeriodRange(start, end) {
    return isoDate(start) && isoDate(end) && start <= end;
  }

  function fieldRow(label, field, note) {
    const source = field && typeof field === "object" ? field : MISSING;
    return {
      label, value: source.value ?? null, status: source.status || "BACKEND_FIELD_MISSING",
      currency: source.currency || "", fieldId: source.fieldId || "",
      note: note || source.note || "", sourceIds: source.sourceIds || [], evidenceIds: source.evidenceIds || []
    };
  }

  function classRows(label, field) {
    if (!field || !VALUE_STATUSES.has(field.status) || !Array.isArray(field.value)) {
      return [fieldRow(label, field)];
    }
    if (!field.value.length) return [fieldRow(label, field)];
    return field.value.map(item => fieldRow(`${label} — ${item.assetClass || "?"}`, {
      value: item.value, status: field.status, currency: item.currency || field.currency,
      fieldId: field.fieldId, sourceIds: item.sourceIds || field.sourceIds,
      evidenceIds: item.evidenceIds || field.evidenceIds
    }));
  }

  function rowsForTab(pkg, tab) {
    const q = pkg?.quantitative || {};
    const maturity = pkg?.maturityAnalysis || {};
    const movement = pkg?.periodMovement || {};
    const rou = movement.rou || {};
    const liability = movement.liability || {};
    if (tab === "asset") return [
      fieldRow("Kullanım hakkı varlığı — açılış", rou.opening),
      fieldRow("İlk muhasebeleştirme ilaveleri", rou.initialRecognitionAdditions || q.initialRecognitionRouAdditions),
      fieldRow("Sonraki dönem ilaveleri", rou.subsequentAdditions),
      fieldRow("Dönem amortismanı", rou.depreciation || q.rouDepreciationTotal),
      fieldRow("Modifikasyon hareketi", rou.modifications),
      fieldRow("Yeniden değerlendirme / ölçüm hareketi", rou.remeasurements),
      fieldRow("TMS 29 kullanım hakkı hareketi", rou.tms29Movement),
      fieldRow("Kullanım hakkı varlığı — kapanış", rou.closing || q.rouCarryingAmount),
      ...classRows("Varlık sınıfına göre amortisman", q.rouDepreciationByAssetClass),
      ...classRows("Varlık sınıfına göre kapanış", q.rouCarryingAmountByAssetClass)
    ];
    if (tab === "liability") return [
      fieldRow("Kira yükümlülüğü — açılış", liability.opening),
      fieldRow("İlk muhasebeleştirme girişleri", liability.initialRecognitionAdditions),
      fieldRow("Dönem faiz gideri", liability.interest || q.interestExpense),
      fieldRow("Planlanan sözleşme ödemeleri", liability.scheduledContractualCash || q.scheduledContractualCash,
        "Gerçekleşmiş ödeme değildir."),
      fieldRow("Gerçekleşmiş toplam kira nakit çıkışı", liability.actualCashOutflow || q.totalCashOutflowForLeases),
      fieldRow("Modifikasyon hareketi", liability.modifications),
      fieldRow("Yeniden değerlendirme / ölçüm hareketi", liability.remeasurements),
      fieldRow("TMS 21 kur hareketi", liability.tms21Movement),
      fieldRow("Kira yükümlülüğü — kapanış", liability.closing || maturity.discountedLeaseLiabilityCarryingAmount)
    ];
    const rows = [fieldRow("İskontolu kira yükümlülüğü defter değeri",
      maturity.discountedLeaseLiabilityCarryingAmount)];
    if (maturity.status === "SUPPORTED" && Array.isArray(maturity.bands)) {
      maturity.bands.forEach(band => rows.push(fieldRow(band.label || band.bandId, {
        value: band.undiscountedCashFlow, status: band.status || "SUPPORTED",
        currency: band.currency || maturity.currency, fieldId: band.bandId,
        sourceIds: maturity.sourceIds, evidenceIds: maturity.evidenceIds
      })));
      rows.push(fieldRow("İskonto edilmemiş toplam nakit çıkışı", {
        value: maturity.undiscountedTotal,
        status: maturity.undiscountedTotalStatus || maturity.status,
        currency: maturity.currency, fieldId: "IFRS16_58_IFRS7_MATURITY",
        sourceIds: maturity.sourceIds, evidenceIds: maturity.evidenceIds
      }));
    } else {
      rows.push(fieldRow("Vade dilimleri ve iskonto edilmemiş toplam", {
        value: null, status: maturity.status || "BACKEND_FIELD_MISSING",
        currency: maturity.currency, fieldId: "IFRS16_58_IFRS7_MATURITY",
        note: maturity.limitation || ""
      }));
    }
    return rows;
  }

  function formatValue(row) {
    if (!VALUE_STATUSES.has(row.status) || typeof row.value !== "number" || !Number.isFinite(row.value)) return "—";
    return new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(row.value)
      + (row.currency ? ` ${escapeHtml(row.currency)}` : "");
  }

  function renderRows(rows) {
    return `<div style="overflow-x:auto"><table class="gk-v26-table" style="width:100%"><thead><tr>`
      + `<th>Kalem</th><th style="text-align:right">Tutar</th><th>Durum</th></tr></thead><tbody>`
      + rows.map(row => `<tr><td>${escapeHtml(row.label)}${row.note ? `<small style="display:block;color:#64748b">${escapeHtml(row.note)}</small>` : ""}</td>`
        + `<td style="text-align:right">${formatValue(row)}</td><td>${escapeHtml(STATUS_LABELS[row.status] || "Kaynak doğrulaması gerekli")}</td></tr>`).join("")
      + `</tbody></table></div>`;
  }

  function exportRows(rows, tab, pkg) {
    const data = rows.map(row => ({
      Kalem: row.label, Tutar: VALUE_STATUSES.has(row.status) ? row.value : null,
      ParaBirimi: row.currency || pkg?.period?.presentationCurrency || "",
      Durum: row.status, Aciklama: row.note, AlanId: row.fieldId,
      KaynakHesaplamalar: row.sourceIds.join(","), Kanitlar: row.evidenceIds.join(",")
    }));
    const fileBase = `TFRS16_Dipnot_${tab}_${pkg?.period?.reportingDate || "donem"}`;
    if (global.XLSX?.utils?.json_to_sheet && typeof global.XLSX.writeFile === "function") {
      const workbook = global.XLSX.utils.book_new();
      global.XLSX.utils.book_append_sheet(workbook, global.XLSX.utils.json_to_sheet(data), "Dipnot");
      global.XLSX.writeFile(workbook, `${fileBase}.xlsx`);
      return data;
    }
    const headers = Object.keys(data[0] || {});
    const quote = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = [headers.map(quote).join(";"), ...data.map(row => headers.map(key => quote(row[key])).join(";"))].join("\r\n");
    const url = global.URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const link = global.document.createElement("a");
    link.href = url; link.download = `${fileBase}.csv`; link.click();
    global.URL.revokeObjectURL(url);
    return data;
  }

  function errorLabel(error) {
    if (error?.status === 401) return "Oturum açmanız gerekiyor.";
    if (error?.status === 403) return "Bu şirketin dipnotlarına erişim yetkiniz yok.";
    if (error?.code === "DISCLOSURE_TRUSTED_SOURCE_REQUIRED") return "Seçilen dönem için doğrulanmış dipnot hesaplama kaydı bulunamadı. Dipnotlar yalnızca onaylı, kaynak bağlı hesaplama kaydı bulunduğunda gösterilir.";
    if (error?.code === "DISCLOSURE_PERIOD_INVALID") return "Dönem başlangıcı, dönem sonundan sonra olamaz. İki tarihi kontrol edin.";
    if (error?.code === "DISCLOSURE_CALCULATION_SOURCE_MISMATCH") return "Dipnot kaynağı ile doğrulanmış hesaplama kaydı uyuşmuyor.";
    if (error?.code === "DISCLOSURE_SOURCE_HASH_INVALID") return "Dipnot kaynağının bütünlüğü doğrulanamadı.";
    if (error?.code === "DISCLOSURE_ENTITY_PROFILE_REQUIRED") return "Onaylı şirket para birimi profili gerekli.";
    if (error?.code === "DISCLOSURE_POPULATION_UNAVAILABLE" || error?.code === "DISCLOSURE_POPULATION_INVALID") {
      return "Bu dönem için uygun sözleşme kapsamı bulunamadı.";
    }
    if (error?.status === 409) return "Bu dönem için doğrulanmış dipnot kaynağı bulunamadı.";
    if (error?.status === 422) return "Dipnot kaynağı doğrulanamadı.";
    if (error?.status >= 500) return "Dipnot servisi şu anda kullanılamıyor.";
    return "Dipnot paketi alınamadı. Lütfen daha sonra yeniden deneyin.";
  }

  /* UI v2 (tasarım: Dipnotlar editörü). Tablolar rowsForTab satırlarıdır;
     tutar üretilmez. Mutabakat kontrolleri sunucunun reconciliation alanından. */
  const SECTION = { asset: ["14.3", "Kullanım hakkı varlıkları"], liability: ["14.4", "Kira yükümlülükleri"], liquidity: ["14.5", "Vade analizi (iskonto edilmemiş)"] };
  const trDateD = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || "")); return m ? `${m[3]}.${m[2]}.${m[1]}` : "—"; };
  // Which inputs came from system defaults or the contractual schedule.
  function systemDefaultsHtml(d) {
    if (!d) return "";
    const parts = [];
    if (d.maturityPolicy) parts.push("vade dilimleri (TFRS 7.B11 örnek dilimleri)");
    if (d.assetClassContracts?.length) parts.push(`varlık sınıfı (${d.assetClassContracts.length} sözleşme, sözleşmedeki sınıftan)`);
    if (d.entityInputFields?.length) parts.push(`şirket beyanları (${d.entityInputFields.length} alan, sözleşme kayıtlarından)`);
    if (d.cashFromContractualSchedule?.length) parts.push("gerçekleşen kira nakdi (defter verisi yok, ödeme planından)");
    const outage = d.unavailableProviders?.length ? " Bazı girdi kaynaklarına ulaşılamadı; ilgili alanlar eksik gösteriliyor." : "";
    if (!parts.length && !outage) return "";
    return `<div class="lq-dn-muted" data-system-defaults role="note" style="margin:8px 0;padding:10px 12px;border:1px solid #F2D7A6;background:#FFF8EC;border-radius:8px">`
      + `<strong>Sistem varsayılanı kullanılan girdiler:</strong> ${escapeHtml(parts.join("; ") || "—")}.${escapeHtml(outage)}`
      + ` Defter verisi Yönetim → Defter verileri sayfasından yüklenebilir.</div>`;
  }

  // Contracts whose liability roll-forward does not foot (server check).
  function movementExceptionsHtml(rec) {
    const list = Array.isArray(rec?.periodMovementExceptions) ? rec.periodMovementExceptions : [];
    if (!list.length) return "";
    const nf = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `<div class="lq-dn-muted" data-movement-exceptions><strong>Hareketi tutmayan sözleşmeler (${list.length})</strong><ul>${list.map(x =>
      `<li>${escapeHtml(x.contractId)} · fark ${escapeHtml(nf.format(Number(x.difference) || 0))} ${escapeHtml(x.currency || "")}</li>`).join("")}</ul></div>`;
  }

  // Trusted source rejections the user can act on (sunucu ret gerekçeleri).
  const SOURCE_REASON_LABELS = Object.freeze({
    LEASE_TERM_EVIDENCE_REQUIRED: "Kira süresi değerlendirme referansı eksik",
    RENEWAL_OPTION_JUDGEMENT_REQUIRED: "Yenileme opsiyonu kararı eksik",
    TERMINATION_OPTION_JUDGEMENT_REQUIRED: "Fesih opsiyonu kararı eksik",
    PURCHASE_OPTION_JUDGEMENT_REQUIRED: "Satın alma opsiyonu kararı eksik",
    RENEWAL_END_DATE_REQUIRED: "Yenileme sonrası bitiş tarihi eksik",
    TERMINATION_DATE_REQUIRED: "Fesih tarihi eksik veya süre dışında",
    TERMINATION_PENALTY_MEASUREMENT_UNSUPPORTED: "Kesin fesihte ceza ölçümü desteklenmiyor",
    PURCHASE_OPTION_PRICE_MEASUREMENT_UNSUPPORTED: "Kesin satın almada bedel ölçümü desteklenmiyor",
    SHORT_TERM_EXEMPTION_INELIGIBLE: "Kısa vadeli istisna için süre 12 ayı aşıyor",
    REPORTING_FX_RATE_REQUIRED: "Doğrulanmış TCMB kuru eksik (Yönetim → Döviz kurları)",
    TRUSTED_ROUTE_UNSUPPORTED: "Desteklenmeyen sözleşme yapısı (ör. uygulanmış modifikasyon)",
    DISCLOSURE_ENTITY_PROFILE_REQUIRED: "Şirketin onaylı para birimi profili yok",
    CALCULATION_CONTRACT_INACTIVE: "Sözleşme aktif değil"
  });
  const GAP_LABELS = Object.freeze({
    rouDepreciationByAssetClass: "Varlık sınıfına göre amortisman", rouCarryingAmountByAssetClass: "Varlık sınıfına göre kapanış",
    totalCashOutflowForLeases: "Gerçekleşen toplam kira nakdi", actualPrincipalCashOutflow: "Gerçekleşen anapara nakdi",
    actualInterestCashOutflow: "Gerçekleşen faiz nakdi", actualOtherLeaseCashOutflow: "Diğer gerçekleşen kira nakdi",
    variableLeasePaymentExpense: "Değişken kira gideri", IFRS16_58_IFRS7_MATURITY: "Onaylı vade politikası ve iskonto edilmemiş plan",
    leasingActivity: "Kiralama faaliyetinin niteliği", unrecognizedVariableExposure: "Tanımlanmamış değişken ödeme riski",
    extensionTerminationExposure: "Uzatma ve fesih seçenekleri", residualValueGuaranteeExposure: "Kalıntı değer garantileri",
    notYetCommencedCommitments: "Henüz başlamamış kiralama taahhütleri", leaseRestrictionsOrCovenants: "Kiralama kısıtları ve taahhütleri",
    saleAndLeasebackInformation: "Satış ve geri kiralama açıklaması", shortTermElection: "Kısa vadeli kiralama tercihi",
    lowValueElection: "Düşük değerli varlık tercihi", rentConcessionExpedient: "Kira imtiyazı kolaylaştırıcı uygulaması",
    IFRS16_53C_SHORT_TERM_LEASE_EXPENSE: "Kısa vadeli kiralama gideri", IFRS16_53D_LOW_VALUE_LEASE_EXPENSE: "Düşük değerli kiralama gideri",
    IFRS16_53F_SUBLEASE_INCOME: "Alt kiralama geliri", IFRS16_53I_SALE_LEASEBACK_GAIN_LOSS: "Satış ve geri kiralama kazanç/kaybı",
    IFRS16_55_SHORT_TERM_COMMITMENTS: "Kısa vadeli kiralama taahhütleri", IFRS16_56_INVESTMENT_PROPERTY_ROU: "Yatırım amaçlı gayrimenkul kullanım hakkı",
    IFRS16_57_REVALUED_ROU: "Yeniden değerlenmiş kullanım hakkı", IFRS16_61_97_LESSOR_DISCLOSURE_BOUNDARY: "Kiraya veren açıklama kapsamı"
  });
  const VALIDATION_LABELS = Object.freeze({
    COMPLETE_FOR_SUPPORTED_SCOPE: "Desteklenen açıklama kapsamı tamam", INCOMPLETE_INPUT_REQUIRED: "Onaylı girdiler eksik",
    UNSUPPORTED_REQUIREMENT_PRESENT: "Desteklenmeyen açıklama gerekliliği var", FAILED_VALIDATION: "Sunucu doğrulaması başarısız"
  });
  const SUPPORTED_REQUIREMENTS = new Set(["SUPPORTED", "SUPPORTED_AUTOMATIC", "SUPPORTED_WITH_ENTITY_INPUT", "SUPPORTED_WITH_LEDGER_INPUT", "SUPPORTED_WITH_DISCLOSURE_INPUT", "NOT_APPLICABLE"]);
  function sourceGaps(pkg) {
    const gaps = [], seen = new Set();
    const add = (id, status) => {
      if (!id || seen.has(id) || VALUE_STATUSES.has(status) || status === "NOT_APPLICABLE") return;
      seen.add(id);gaps.push({id, label:GAP_LABELS[id] || "Açıklama gerekliliği", status:status || "BACKEND_FIELD_MISSING"});
    };
    (Array.isArray(pkg?.missingInputs) ? pkg.missingInputs : []).forEach(x => add(x.fieldId, x.status));
    (Array.isArray(pkg?.supportStatus) ? pkg.supportStatus : []).forEach(x => {
      // Capability support does not establish that entity/ledger inputs exist.
      // Missing input evidence comes from missingInputs and qualitative fields.
      if (!SUPPORTED_REQUIREMENTS.has(x.supportedStatus)) add(x.requirementId, x.supportedStatus);
    });
    Object.entries(pkg?.qualitative || {}).forEach(([id, field]) => add(id,field?.status));
    return gaps;
  }
  function designHtml({ state, companies, tabs, body, pkg, escapeHtml: e }) {
    const ready = state.status === "ready" && pkg;
    const rowsBy = ready ? Object.fromEntries(tabs.map(([k]) => [k, rowsForTab(pkg, k)])) : {};
    const missing = ready ? Object.values(rowsBy).flat().filter(r => !VALUE_STATUSES.has(r.status) && r.status !== "NOT_APPLICABLE").length : 0;
    const gaps = ready ? sourceGaps(pkg) : [];
    const complete = ready && pkg.validation?.status === "COMPLETE_FOR_SUPPORTED_SCOPE" && !missing && !gaps.length;
    const validationLabel = VALIDATION_LABELS[pkg?.validation?.status] || "Tamlık doğrulanmadı";
    const docAmount = row => {
      if (!VALUE_STATUSES.has(row.status) || typeof row.value !== "number" || !Number.isFinite(row.value)) {
        return `<span class="lq-dn-need${row.status === "NOT_APPLICABLE" ? " is-na" : ""}">${e(STATUS_LABELS[row.status] || "Kaynak gerekli")}</span>`;
      }
      const v = row.value, f = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(Math.abs(v));
      return v < 0 ? `(${f})` : f;
    };
    const isTotal = label => /kapanış|toplam|defter değeri/i.test(label);
    const sectionHtml = key => {
      const [no, title] = SECTION[key];
      const rows = rowsBy[key] || [];
      return `<section class="lq-dn-sec${state.tab === key ? " is-active" : ""}" id="lqNote-${key}" data-disclosure-section="${key}">
        ${state.tab === key ? '<span class="lq-dn-flag">Sunucu kaynak tablosu · salt okunur</span>' : ""}
        <h3>${no} ${e(title)}</h3><div class="lq-dn-cap">(${e(trDateD(state.reportingDate))} itibarıyla · ${e(pkg?.period?.presentationCurrency || "")})</div>
        <div class="lq-dn-grid"><span></span><span class="is-h">${e(trDateD(state.reportingDate))}</span>
        ${rows.map(r => `<span class="${isTotal(r.label) ? "is-total" : ""}">${e(r.label)}${r.note ? `<small>${e(r.note)}</small>` : ""}</span><span class="is-n${isTotal(r.label) ? " is-total" : ""}">${docAmount(r)}</span>`).join("")}</div></section>`;
    };
    const rec = pkg?.reconciliation || {};
    const checks = [["populationMatches", "Kaynak sayısı = sözleşme kapsamı"], ["rouCarryingByClassMatchesTotal", "Sınıf kırılımı = KHV defter değeri"],
      ["rouDepreciationByClassMatchesTotal", "Sınıf amortismanı = toplam amortisman"], ["maturityBucketsMatchUndiscountedTotal", "Vade dilimleri = iskonto edilmemiş toplam"],
      ["periodMovementReconciled", "Dönem hareketi = kapanış"], ["actualCashComponentsMatchTotal", "Nakit çıkışı bileşenleri = toplam"]];
    const checkHtml = ready ? checks.map(([k, label]) => {
      const v = rec[k];
      return `<div class="lq-dn-check ${v === true ? "is-ok" : v === false ? "is-bad" : "is-na"}"><b aria-hidden="true">${v === true ? "✓" : v === false ? "✗" : "–"}</b><span>${e(label)}${v === null || v === undefined ? "<small>Kaynak verisi yok</small>" : ""}</span></div>`;
    }).join("") + movementExceptionsHtml(rec) : '<p class="lq-dn-muted">Paket yüklenince gösterilir.</p>';
    const outline = tabs.map(([k]) => {
      const [no, title] = SECTION[k];
      const n = ready ? (rowsBy[k] || []).filter(r => !VALUE_STATUSES.has(r.status) && r.status !== "NOT_APPLICABLE").length : null;
      const tone = !ready ? "na" : n ? "warn" : "ok";
      return `<button type="button" data-disclosure-tab="${k}" class="lq-dn-out${state.tab === k ? " is-active" : ""}" aria-current="${state.tab === k}"><i class="is-${tone}" aria-hidden="true">${tone === "ok" ? "✓" : tone === "warn" ? "!" : "–"}</i><span><b>${no} ${e(title)}</b><small>${!ready ? "Kaynak bekleniyor" : n ? `${n} kalem kaynak gerekli` : "Görünen satırlar kaynaklı"}</small></span></button>`;
    }).join("");
    const companyName = (companies.find(c => c.id === state.companyId) || {}).name || state.companyId;
    return `<div class="lq-dn">
      <div class="lq-dn-top"><div class="lq-dn-title"><strong>14. Kiralama İşlemleri</strong><span>${e(companyName)} · ${e(trDateD(state.periodStart))} – ${e(trDateD(state.reportingDate))} · Şablon: TFRS 16 Kiracı</span></div>
        ${ready ? `<span class="lq-dn-chip">${e(validationLabel)}</span>` : ""}
        ${ready ? `<span class="lq-dn-chip ${complete ? "is-ok" : "is-warn"}">${complete ? "Desteklenen kapsam tamam" : `${missing} sayısal satır · ${gaps.length} kaynak / destek gerekliliği`}</span>` : ""}
        <button type="button" class="lq-dn-btn" id="disclosureInputs" ${state.companyId && validPeriodRange(state.periodStart, state.reportingDate) ? "" : "disabled"}>Varsayımları düzenle</button>
        <button type="button" class="lq-dn-btn" id="disclosureExport" ${ready ? "" : "disabled"}>Seçili bölümü dışa aktar</button></div>
      <div class="lq-dn-ctx"><label>Şirket <select id="disclosureCompany" ${state.producing ? "disabled" : ""}>${companies.map(item => `<option value="${e(item.id)}" ${item.id === state.companyId ? "selected" : ""}>${e(item.name || item.id)}</option>`).join("")}</select></label>
        <label>Dönem başlangıcı <input id="disclosureStart" type="date" value="${e(state.periodStart)}" max="${e(state.reportingDate)}" aria-describedby="disclosure-period-error" ${state.producing ? "disabled" : ""}></label>
        <label>Dönem sonu <input id="disclosureDate" type="date" value="${e(state.reportingDate)}" min="${e(state.periodStart)}" aria-describedby="disclosure-period-error" ${state.producing ? "disabled" : ""}></label>
        ${state.error?.code === "DISCLOSURE_PERIOD_INVALID" ? `<p id="disclosure-period-error" role="alert" class="lq-dn-err">${e(errorLabel(state.error))}</p>` : `<span id="disclosure-period-error" class="sr-only"></span>`}</div>
      ${ready ? systemDefaultsHtml(pkg?.provenance?.systemDefaults) : ""}
      <div class="lq-dn-body">
        <nav class="lq-dn-outline" aria-label="Dipnot anahattı"><span class="lq-dn-kick">ANAHAT</span>${outline}
          <p class="lq-dn-muted">Anlatı bölümleri (14.1, 14.2, 14.6–14.11) bu sürümde metin editörü olarak yok; sayısal tablolar sunucu kaynaklıdır. Eksik şirket beyanları kaynak gereklilikleri bölümünde listelenir.</p></nav>
        <div class="lq-dn-paper"><article class="lq-dn-doc">
          <div class="lq-dn-dochead">${e(String(companyName).toLocaleUpperCase("tr-TR"))}<br>${e(trDateD(state.reportingDate))} Tarihinde Sona Eren Döneme Ait Finansal Tablolara İlişkin Dipnotlar</div>
          <h2>14. KİRALAMA İŞLEMLERİ</h2><div class="lq-dn-cap">(Tutarlar aksi belirtilmedikçe ${e(pkg?.period?.presentationCurrency || "sunum para birimi")} olarak ifade edilmiştir.)</div>
          ${ready ? tabs.map(([k]) => sectionHtml(k)).join("") : `<div class="lq-dn-state">${body}</div>`}
        </article></div>
        <aside class="lq-dn-aside">
          <section><span class="lq-dn-kick">SEÇİLİ BLOK · ${e(SECTION[state.tab][0])}</span>
            <div class="lq-dn-kv"><span>Kaynak</span><span>${ready ? "Sunucu paketi yüklendi" : "Paket bekleniyor"}</span></div>
            <div class="lq-dn-kv"><span>Kaynak hesaplama</span><span>${e(ready ? String(pkg.population?.includedCount ?? "—") : "—")}</span></div>
            <div class="lq-dn-kv"><span>Doğrulama</span><span>${e(ready ? validationLabel : "—")}</span></div>
            <div class="lq-dn-kv"><span>Dipnot kimliği</span><span class="lq-dn-mono">${e(ready ? String(pkg.identity?.disclosureId || "—").slice(0, 14) : "—")}</span></div>
            <div class="lq-dn-kv"><span>Manuel düzeltme</span><span>Yok</span></div></section>
          <section data-disclosure-source-gaps><span class="lq-dn-kick">KAYNAK VE DESTEK GEREKLİLİKLERİ</span>
            ${ready ? `<p>${complete ? "Desteklenen kapsamda eksik gereklilik bildirilmedi." : "Paket yüklenmesi açıklama tamlığını kanıtlamaz."}</p>
              <p>Varlık sınıfları ve şirket beyanları onaylı şirket girdisi; vade analizi onaylı politika ve sunucu planı; gerçekleşen nakit defter kanıtı gerektirir. Planlanan ödeme defter nakdinin yerine geçmez.</p>
              <ul>${gaps.map(g => `<li><strong>${e(g.label)}</strong><br>${e(STATUS_LABELS[g.status] || "Kaynak doğrulaması gerekli")}<details><summary>Kaynak kimliği</summary><code>${e(g.id)}</code> · ${e(g.status)}</details></li>`).join("")}</ul>
              <details><summary>Doğrulama ve destek sınırı</summary><p>${e(pkg.validation?.status)} · ${e(pkg.certification?.status || "Sertifikasyon kanıtı verilmedi")}</p><p>Bu görünüm eksik veriyi kaydetmez veya tamamlamaz. Şirket girdisi ve politika onayı bu arayüzde sunulmuyor; desteklenmeyen kapsam için yeni hesaplama yapılmaz.</p></details>` : '<p>Paket yüklenince gereklilikler gösterilir.</p>'}
          </section>
          <section><span class="lq-dn-kick">MUTABAKAT KONTROLLERİ</span>${checkHtml}</section>
        </aside></div></div>`;
  }

  function renderFootnotes(container) {
    if (!container) return;
    const bridge = global.GK_TFRS16 || {};
    bridge.injectV26Styles?.();
    const facade = global.LeaseQantPrivateTfrs16Facade;
    const companies = (bridge.getUnifiedCompanyOptions?.() || [])
      .filter(item => item && typeof item.id === "string" && item.id && item.id !== "ALL");
    const activeCompany = bridge.getActiveCompanyId?.();
    const now = new Date(), periodEndDate = new Date(now.getFullYear(), now.getMonth(), 0);
    const periodStartDate = new Date(periodEndDate.getFullYear(), periodEndDate.getMonth(), 1);
    const dateOnly = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const sharedPeriod = global.LeaseQantReportingPeriod?.get?.();
    const defaultStart = sharedPeriod?.periodStart || dateOnly(periodStartDate);
    const defaultEnd = sharedPeriod?.periodEnd || dateOnly(periodEndDate);
    const state = {
      companyId: companies.some(item => item.id === activeCompany) ? activeCompany : (companies[0]?.id || ""),
      periodStart: defaultStart, reportingDate: defaultEnd,
      tab: "asset", key: null, status: "idle", pkg: null, availability: null, error: null,
      sequence: 0, producing: false, productionSummary: null
    };
    const period = () => ({ companyId: state.companyId,
      reportingPeriodStart: state.periodStart,
      reportingPeriodEnd: state.reportingDate, reportingDate: state.reportingDate });
    const contractsForPeriod = () => {
      const source = bridge.getPortfolioContracts?.();
      if (!Array.isArray(source)) return [];
      const ids = new Set();
      return source.filter(contract => {
        const id = String(contract?.id ?? "").trim();
        const companyId = String(contract?.companyId ?? contract?.company_id ?? "");
        const start = contract?.startDate ?? contract?.start_date;
        const end = contract?.endDate ?? contract?.end_date;
        if (!id || companyId !== state.companyId || !isoDate(start) || !isoDate(end)
          || end < state.periodStart || start > state.reportingDate || ids.has(id)) return false;
        ids.add(id);
        return true;
      }).map(contract => String(contract.id));
    };
    const createTrustedSources = async () => {
      if (state.producing || state.status !== "error"
        || state.error?.code !== "DISCLOSURE_TRUSTED_SOURCE_REQUIRED") return;
      const contractIds = contractsForPeriod();
      if (!contractIds.length) {
        state.productionSummary = "Seçilen şirket ve dönemle örtüşen sözleşme bulunamadı; kaynak üretilmedi.";
        draw();
        return;
      }
      if (typeof facade?.createTrustedDisclosureSnapshots !== "function") {
        state.productionSummary = "Güvenilir kaynak üretme işlemi bu sürümde kullanılamıyor.";
        draw();
        return;
      }
      state.producing = true;
      state.productionSummary = null;
      const requestKey = `${state.companyId}|${state.periodStart}|${state.reportingDate}`;
      draw();
      try {
        const results = await facade.createTrustedDisclosureSnapshots(contractIds, period());
        if (requestKey !== `${state.companyId}|${state.periodStart}|${state.reportingDate}`) return;
        const succeeded = results.filter(result => result?.success === true);
        const failed = results.filter(result => result?.success !== true);
        if (failed.length) {
          // Group by reason so the user sees which contracts need what.
          const byCode = new Map();
          failed.forEach(result => {
            const code = result?.code || "TRUSTED_DISCLOSURE_SOURCE_FAILED";
            if (!byCode.has(code)) byCode.set(code, []);
            byCode.get(code).push(String(result?.contractId || "?"));
          });
          const reasons = [...byCode].map(([code, ids]) => `${SOURCE_REASON_LABELS[code] ? `${SOURCE_REASON_LABELS[code]} [${code}]` : code} (${ids.join(", ")})`);
          state.productionSummary = `${succeeded.length}/${contractIds.length} sözleşme için kaynak oluşturuldu. Kalan sözleşmeler: ${reasons.join("; ")}.`;
          state.producing = false;
          draw();
          return;
        }
        state.productionSummary = `${succeeded.length} sözleşme için güvenilir hesaplama ve kaynak snapshot'ı oluşturuldu; dipnotlar yenileniyor.`;
        state.producing = false;
        state.key = null;
        state.status = "idle";
        draw();
      } catch (error) {
        if (requestKey !== `${state.companyId}|${state.periodStart}|${state.reportingDate}`) return;
        state.producing = false;
        state.productionSummary = `Kaynak oluşturulamadı: ${error?.code || "TRUSTED_DISCLOSURE_SOURCE_FAILED"}.`;
        draw();
      }
    };
    const load = () => {
      const key = `${state.companyId}|${state.periodStart}|${state.reportingDate}`;
      if (state.key === key) return;
      state.key = key;
      state.pkg = null;
      state.availability = null;
      state.error = null;
      if (!state.companyId) { state.status = "empty"; return; }
      if (!validPeriodRange(state.periodStart, state.reportingDate)) {
        state.status = "invalid-period";
        state.error = Object.assign(new Error("Invalid disclosure period"), { code: "DISCLOSURE_PERIOD_INVALID" });
        return;
      }
      if (!facade?.loadLeaseDisclosureAvailability
        || !facade?.loadLeaseDisclosure) {
        state.status = "error";
        state.error = new Error("Disclosure adapter or period unavailable");
        return;
      }
      state.status = "loading";
      const sequence = ++state.sequence;
      Promise.resolve().then(() => facade.loadLeaseDisclosureAvailability(period()))
        .then(availability => {
          if (sequence !== state.sequence) return null;
          state.availability = availability;
          return facade.loadLeaseDisclosure(availability);
        })
        .then(pkg => {
          if (sequence !== state.sequence || !pkg) return;
          if (pkg.identity?.companyId !== state.companyId
            || pkg.period?.reportingPeriodStart !== state.periodStart
            || pkg.period?.reportingDate !== state.reportingDate
            || pkg.population?.populationId !== state.availability?.populationId
            || JSON.stringify([...(pkg.population?.includedContractIds || [])].sort())
              !== JSON.stringify([...state.availability.contractIds].sort())
            || JSON.stringify([...(pkg.population?.includedCalculationIds || [])].sort())
              !== JSON.stringify([...state.availability.calculationIds].sort())
            || pkg.period?.presentationCurrency !== state.availability?.currencyProfile?.presentationCurrency
            || pkg.identity?.currencyEvidenceId !== state.availability?.currencyProfile?.evidenceId
            || pkg.validation?.status === "FAILED_VALIDATION") {
            throw new Error("Disclosure response scope or validation mismatch");
          }
          state.pkg = pkg;
          state.status = "ready";
          draw();
        })
        .catch(error => {
          if (sequence !== state.sequence) return;
          state.error = error;
          state.status = "error";
          draw();
        });
    };
    const draw = () => {
      load();
      const tabs = [["asset", "Varlık"], ["liability", "Yükümlülük"], ["liquidity", "Likidite"]];
      const rows = state.status === "ready" ? rowsForTab(state.pkg, state.tab) : [];
      const sourceRequired = state.status === "error" && state.error?.code === "DISCLOSURE_TRUSTED_SOURCE_REQUIRED";
      const sourceContractIds = sourceRequired ? contractsForPeriod() : [];
      const body = state.producing ? "<p role=\"status\">Sunucu kayıtlı sözleşme şartlarını doğrulayıp güvenilir kaynak oluşturuyor…</p>"
        : state.status === "loading" ? "<p>Güvenilir dipnot paketi yükleniyor…</p>"
        : state.status === "empty" ? "<p>Yetkili şirket bulunamadı.</p>"
        : state.status === "invalid-period" ? ""
        : state.status === "error" ? `<p role="${sourceRequired ? "status" : "alert"}" style="color:${sourceRequired ? "#334155" : "#991b1b"}">${escapeHtml(errorLabel(state.error))}</p>`
          + (sourceRequired ? `<p>${sourceContractIds.length ? `${sourceContractIds.length} kapsam sözleşmesi` : "Bu dönem için sözleşme kapsamı yok"}. Açıkça başlatıldığında sunucu kayıtlı sözleşme şartları ve desteklediği muhasebe yolu üzerinden hesaplama/snapshot üretir; yevmiye veya defter kaydı oluşturmaz.</p>`
            + `<button type="button" class="gk-v26-btn gk-v26-btn-secondary" id="disclosureCreateTrustedSource" ${!sourceContractIds.length ? "disabled" : ""}>Güvenilir kaynağı oluştur</button>` : "")
          + (state.productionSummary ? `<p role="status">${escapeHtml(state.productionSummary)}</p>` : "")
          + `<details><summary>Teknik ayrıntı</summary><code>${escapeHtml(state.error?.code || "DISCLOSURE_SOURCE_UNAVAILABLE")}</code></details>`
        : `${renderRows(rows)}<button type="button" class="gk-v26-btn gk-v26-btn-secondary" id="disclosureExport">↓ Dipnotu Dışa Aktar</button>`;
      const pkg = state.pkg;
      const source = pkg ? `<details style="margin-top:16px"><summary>Kaynak ve doğrulama bilgisi</summary>`
        + `<p>Şirket: ${escapeHtml(pkg.identity?.companyId)} · Dönem: ${escapeHtml(pkg.period?.reportingPeriodStart)} – ${escapeHtml(pkg.period?.reportingPeriodEnd)}`
        + ` · Para birimi: ${escapeHtml(pkg.period?.presentationCurrency)}</p>`
        + `<p>Kapsam: ${escapeHtml(pkg.population?.populationId)} · Kaynak sayısı: ${escapeHtml(pkg.population?.includedCount)}`
        + ` · Kaynak durumu: ${escapeHtml(state.availability?.sourceTrustStatus)}`
        + ` · Doğrulama: ${escapeHtml(pkg.validation?.status)}`
        + ` · Eksik girdi: ${escapeHtml(pkg.missingInputs?.length ?? 0)}`
        + ` · Paket sertifikasyon etiketi: ${escapeHtml(pkg.certification?.status)}</p>`
        + `<p>Para birimi kanıtı: ${escapeHtml(pkg.identity?.currencyEvidenceId)}`
        + ` · Vade politikası: ${escapeHtml(pkg.maturityAnalysis?.timeBandPolicyId || "Gerekli")}`
        + ` · Açıklama kimliği: ${escapeHtml(pkg.identity?.disclosureId)}</p>`
        + `<p>Dönem hareketi kapsamı: ${escapeHtml(pkg.periodMovement?.sourceRouteStatus || "Kaynak gerekli")}`
        + ` · Güvenilir snapshot: ${escapeHtml((pkg.periodMovement?.sourceSnapshotIds || []).join(", ") || "Yok")}</p></details>` : "";
      if (global.document?.documentElement?.getAttribute("data-lq-ui") === "2") {
        container.innerHTML = designHtml({ state, companies, tabs, body, pkg, escapeHtml, errorLabel });
      } else container.innerHTML = `<div class="gk-v26-page"><h2>Dipnotlar</h2><p>Güvenilir arka uç açıklama paketi</p>`
        + `<div class="gk-v26-card"><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:end">`
        + `<label>Şirket<br><select id="disclosureCompany" ${state.producing ? "disabled" : ""}>${companies.map(item => `<option value="${escapeHtml(item.id)}" ${item.id === state.companyId ? "selected" : ""}>${escapeHtml(item.name || item.id)}</option>`).join("")}</select></label>`
        + `<label>Dönem başlangıcı<br><input id="disclosureStart" type="date" value="${escapeHtml(state.periodStart)}" max="${escapeHtml(state.reportingDate)}" aria-describedby="disclosure-period-error" ${state.producing ? "disabled" : ""}></label>`
        + `<label>Dönem sonu<br><input id="disclosureDate" type="date" value="${escapeHtml(state.reportingDate)}" min="${escapeHtml(state.periodStart)}" aria-describedby="disclosure-period-error" ${state.producing ? "disabled" : ""}></label>`
        + (state.error?.code === "DISCLOSURE_PERIOD_INVALID" ? `<p id="disclosure-period-error" role="alert" style="color:#991b1b">${escapeHtml(errorLabel(state.error))}</p>` : `<span id="disclosure-period-error" class="sr-only"></span>`)
        + `</div><div style="margin:15px 0">${tabs.map(([key, title]) => `<button type="button" data-disclosure-tab="${key}" class="gk-v26-btn ${key === state.tab ? "" : "gk-v26-btn-secondary"}">${title}</button>`).join(" ")}</div>`
        + body + source + `</div></div>`;
      container.querySelector("#disclosureCompany")?.addEventListener("change", event => {
        state.companyId = event.target.value; state.productionSummary = null; state.sequence++; draw();
      });
      container.querySelector("#disclosureStart")?.addEventListener("change", event => {
        state.periodStart = event.target.value; state.productionSummary = null; state.sequence++; draw();
      });
      container.querySelector("#disclosureDate")?.addEventListener("change", event => {
        state.reportingDate = event.target.value; state.productionSummary = null; state.sequence++; draw();
      });
      container.querySelectorAll("[data-disclosure-tab]").forEach(button => button.addEventListener("click", () => {
        state.tab = button.dataset.disclosureTab; draw();
        container.querySelector(`#lqNote-${state.tab}`)?.scrollIntoView?.({ block: "start", behavior: "smooth" });
      }));
      container.querySelector("#disclosureExport")?.addEventListener("click", () => {
        if (state.status === "ready") exportRows(rowsForTab(state.pkg, state.tab), state.tab, state.pkg);
      });
      container.querySelector("#disclosureCreateTrustedSource")?.addEventListener("click", createTrustedSources);
      container.querySelector("#disclosureInputs")?.addEventListener("click", () => {
        global.LeaseQantDisclosureInputsUi?.open({ companyId: state.companyId,
          companyName: (companies.find(item => item.id === state.companyId) || {}).name, period: period(),
          // Saved inputs change the package; reload it.
          onSaved: () => { state.key = null; state.sequence++; draw(); } });
      });
    };
    bridge.setActiveScreenRefreshCallback?.(() => { state.key = null; state.sequence++; draw(); });
    draw();
  }

  global.LeaseQantTfrs16DisclosureUi = Object.freeze({ renderFootnotes, rowsForTab, exportRows, errorLabel, validPeriodRange, sourceGaps });
})(window);
