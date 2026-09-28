/* TFRS16 Dipnotlar: source-bound disclosure values, presentation only. */
(function (global) {
  "use strict";

  const VALUE_STATUSES = new Set(["SUPPORTED", "ZERO_CONFIRMED"]);
  const STATUS_LABELS = Object.freeze({
    SUPPORTED: "Veri mevcut", ZERO_CONFIRMED: "Doğrulanmış sıfır",
    REQUIRES_LEDGER_DATA: "Defter verisi gerekli",
    REQUIRES_ENTITY_INPUT: "Şirket girdisi gerekli",
    NOT_SUPPORTED: "Desteklenmiyor",
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
    const defaultStart = dateOnly(periodStartDate), defaultEnd = dateOnly(periodEndDate);
    const state = {
      companyId: companies.some(item => item.id === activeCompany) ? activeCompany : (companies[0]?.id || ""),
      periodStart: defaultStart, reportingDate: defaultEnd,
      tab: "asset", key: null, status: "idle", pkg: null, availability: null, error: null, sequence: 0
    };
    const period = () => ({ companyId: state.companyId,
      reportingPeriodStart: state.periodStart,
      reportingPeriodEnd: state.reportingDate, reportingDate: state.reportingDate });
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
      const body = state.status === "loading" ? "<p>Güvenilir dipnot paketi yükleniyor…</p>"
        : state.status === "empty" ? "<p>Yetkili şirket bulunamadı.</p>"
        : state.status === "invalid-period" ? ""
        : state.status === "error" ? `<p role="${state.error?.code === "DISCLOSURE_TRUSTED_SOURCE_REQUIRED" ? "status" : "alert"}" style="color:${state.error?.code === "DISCLOSURE_TRUSTED_SOURCE_REQUIRED" ? "#334155" : "#991b1b"}">${escapeHtml(errorLabel(state.error))}</p><details><summary>Teknik ayrıntı</summary><code>${escapeHtml(state.error?.code || "DISCLOSURE_SOURCE_UNAVAILABLE")}</code></details>`
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
      container.innerHTML = `<div class="gk-v26-page"><h2>Dipnotlar</h2><p>Güvenilir arka uç açıklama paketi</p>`
        + `<div class="gk-v26-card"><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:end">`
        + `<label>Şirket<br><select id="disclosureCompany">${companies.map(item => `<option value="${escapeHtml(item.id)}" ${item.id === state.companyId ? "selected" : ""}>${escapeHtml(item.name || item.id)}</option>`).join("")}</select></label>`
        + `<label>Dönem başlangıcı<br><input id="disclosureStart" type="date" value="${escapeHtml(state.periodStart)}" max="${escapeHtml(state.reportingDate)}" aria-describedby="disclosure-period-error"></label>`
        + `<label>Dönem sonu<br><input id="disclosureDate" type="date" value="${escapeHtml(state.reportingDate)}" min="${escapeHtml(state.periodStart)}" aria-describedby="disclosure-period-error"></label>`
        + (state.error?.code === "DISCLOSURE_PERIOD_INVALID" ? `<p id="disclosure-period-error" role="alert" style="color:#991b1b">${escapeHtml(errorLabel(state.error))}</p>` : `<span id="disclosure-period-error" class="sr-only"></span>`)
        + `</div><div style="margin:15px 0">${tabs.map(([key, title]) => `<button type="button" data-disclosure-tab="${key}" class="gk-v26-btn ${key === state.tab ? "" : "gk-v26-btn-secondary"}">${title}</button>`).join(" ")}</div>`
        + body + source + `</div></div>`;
      container.querySelector("#disclosureCompany")?.addEventListener("change", event => {
        state.companyId = event.target.value; state.sequence++; draw();
      });
      container.querySelector("#disclosureStart")?.addEventListener("change", event => {
        state.periodStart = event.target.value; state.sequence++; draw();
      });
      container.querySelector("#disclosureDate")?.addEventListener("change", event => {
        state.reportingDate = event.target.value; state.sequence++; draw();
      });
      container.querySelectorAll("[data-disclosure-tab]").forEach(button => button.addEventListener("click", () => {
        state.tab = button.dataset.disclosureTab; draw();
      }));
      container.querySelector("#disclosureExport")?.addEventListener("click", () => {
        if (state.status === "ready") exportRows(rowsForTab(state.pkg, state.tab), state.tab, state.pkg);
      });
    };
    bridge.setActiveScreenRefreshCallback?.(() => { state.key = null; state.sequence++; draw(); });
    draw();
  }

  global.LeaseQantTfrs16DisclosureUi = Object.freeze({ renderFootnotes, rowsForTab, exportRows, errorLabel, validPeriodRange });
})(window);
