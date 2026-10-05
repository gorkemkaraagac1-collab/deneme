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

  const CLASS_LABELS = Object.freeze({ PROPERTY: "Gayrimenkul", VEHICLES: "Taşıtlar", PLANT_EQUIPMENT: "Makine ve ekipman",
    IT_EQUIPMENT: "Bilgi teknolojileri ekipmanı", OTHER: "Diğer" });

  function classRows(label, field) {
    if (!field || !VALUE_STATUSES.has(field.status) || !Array.isArray(field.value)) {
      return [fieldRow(label, field)];
    }
    if (!field.value.length) return [fieldRow(label, field)];
    return field.value.map(item => fieldRow(`${label} — ${CLASS_LABELS[item.assetClass] || item.assetClass || "?"}`, {
      value: item.value, status: field.status, currency: item.currency || field.currency,
      fieldId: field.fieldId, sourceIds: item.sourceIds || field.sourceIds,
      evidenceIds: item.evidenceIds || field.evidenceIds
    }));
  }

  // Exemption lines only when the server package carries them.
  function exemptionRows(q) {
    return [["Kısa vadeli kiralama gideri (TFRS 16.53(c))", q.shortTermLeaseExpense],
        ["Düşük değerli varlık kiralama gideri (TFRS 16.53(d))", q.lowValueLeaseExpense],
        ["Kısa vadeli kiralama taahhütleri (TFRS 16.55)", q.shortTermLeaseCommitments],
        ["Alt kiralama geliri (TFRS 16.53(f))", q.subleaseIncome && q.subleaseIncome.status !== "NOT_SUPPORTED" ? q.subleaseIncome : null],
        ["Satış ve geri kiralama kazancı/kaybı (TFRS 16.53(i))", q.saleAndLeasebackGainLoss && q.saleAndLeasebackGainLoss.status !== "NOT_SUPPORTED" ? q.saleAndLeasebackGainLoss : null],
        ["Satış sayılmayan devirlerden finansal borç (TFRS 16.103, TFRS 9)", q.failedSaleFinancingLiability && q.failedSaleFinancingLiability.status === "SUPPORTED" ? q.failedSaleFinancingLiability : null]]
        .filter(([, field]) => field).map(([label, field]) => fieldRow(label, field));
  }

  function rowsForTab(pkg, tab) {
    const q = pkg?.quantitative || {};
    const maturity = pkg?.maturityAnalysis || {};
    const movement = pkg?.periodMovement || {};
    const rou = movement.rou || {};
    const liability = movement.liability || {};
    // IAS 29 with an unverified CPI month: name the month instead of a
    // generic "source required" on every ROU line.
    const missingCpi = Array.isArray(pkg?.tms29?.missingMonths) ? pkg.tms29.missingMonths : [];
    const cpiNote = missingCpi.length
      ? `TMS 29: ${missingCpi.join(", ")} için doğrulanmış TÜFE yok. Endeks doğrulanınca hesaplanır (Yönetim → Enflasyon Endeksleri).`
      : "";
    const rouRow = (label, field) => fieldRow(label, field, cpiNote && field?.status === "NOT_CALCULABLE" ? cpiNote : undefined);
    // IAS 29 (TMS 29.8, .34): lines in the reporting-date unit. ROU opening
    // carries its restatement (no separate inflation line); the liability
    // movement is restated and closes with the net monetary position.
    const rouRestated = rou.openingRestated && VALUE_STATUSES.has(rou.openingRestated.status);
    const lt = liability.tms29?.status === "SUPPORTED" ? liability.tms29.totals : null;
    const tmsField = (value, extra = {}) => ({ value, status: Math.abs(value) < 0.005 ? "ZERO_CONFIRMED" : "SUPPORTED",
      currency: liability.closing?.currency || pkg?.period?.presentationCurrency || "", fieldId: "LEASE_LIABILITY_TMS29",
      sourceIds: liability.closing?.sourceIds || [], evidenceIds: liability.tms29?.evidenceIds || [], ...extra });
    const roll = q.rouRollForwardByAssetClass;
    const rollField = key => roll && VALUE_STATUSES.has(roll.status) && Array.isArray(roll.value)
      ? { ...roll, value: roll.value.map(row => ({ assetClass: row.assetClass, value: row[key], currency: row.currency })) } : roll;
    if (tab === "asset") return [
      rouRestated ? rouRow("Kullanım hakkı varlığı — açılış (dönem sonu alım gücüyle)", { ...rou.openingRestated,
        note: "TMS 29: açılış dönem başı alım gücünden dönem sonuna getirildi; ilaveler, modifikasyon ve amortisman kendi edinim aylarından endekslidir." })
        : rouRow("Kullanım hakkı varlığı — açılış", rou.opening),
      rouRow("İlk muhasebeleştirme ilaveleri", rou.initialRecognitionAdditions || q.initialRecognitionRouAdditions),
      rouRow("Sonraki dönem ilaveleri", rou.subsequentAdditions),
      rouRow("Dönem amortismanı", rou.depreciation || q.rouDepreciationTotal),
      rouRow("Modifikasyon hareketi", rou.modifications),
      rouRow("Yeniden değerlendirme / ölçüm hareketi", rou.remeasurements),
      ...(rou.subleaseDerecognition && rou.subleaseDerecognition.status !== "NOT_SUPPORTED"
        ? [rouRow("Finansal alt kiralamaya devredilen kullanım hakkı (TFRS 16.B58)", rou.subleaseDerecognition)] : []),
      // The derecognition gain/loss belongs next to the ROU it arises from.
      ...(q.subleaseDerecognitionGainLoss && q.subleaseDerecognitionGainLoss.status !== "NOT_SUPPORTED" && q.subleaseDerecognitionGainLoss.value
        ? [fieldRow("Finansal alt kiralama devir kazancı/kaybı (TFRS 16.B58)", q.subleaseDerecognitionGainLoss)] : []),
      ...(rouRestated ? [] : [rouRow("TMS 29 kullanım hakkı hareketi", rou.tms29Movement)]),
      rouRow("Kullanım hakkı varlığı — kapanış", rou.closing || q.rouCarryingAmount),
      ...(roll && roll.status === "SUPPORTED" ? classRows("Varlık sınıfına göre açılış", rollField("opening")) : []),
      ...(roll && roll.status === "SUPPORTED" ? classRows("Varlık sınıfına göre ilaveler", rollField("initialRecognitionAdditions")) : []),
      ...classRows("Varlık sınıfına göre amortisman", q.rouDepreciationByAssetClass),
      ...classRows("Varlık sınıfına göre kapanış", q.rouCarryingAmountByAssetClass)
    ];
    if (tab === "liability" && lt) return [
      fieldRow("Kira yükümlülüğü — açılış (dönem sonu alım gücüyle)", tmsField(lt.opening,
        { note: "TMS 29: açılış ve dönem hareketleri gerçekleştikleri aydan dönem sonu alım gücüne getirildi; kapanış parasal kalem olduğundan düzeltilmez (TMS 29.12)." })),
      fieldRow("İlk muhasebeleştirme girişleri", tmsField(lt.initialRecognitionAdditions)),
      fieldRow("Dönem faiz gideri", tmsField(lt.interest)),
      fieldRow("Planlanan sözleşme ödemeleri", tmsField(lt.scheduledContractualCash - lt.commencementAdvance), "Gerçekleşmiş ödeme değildir; başlangıç tarihindeki peşin ödeme hariç."),
      fieldRow("Modifikasyon hareketi", tmsField(lt.modifications)),
      fieldRow("Yeniden değerlendirme / ölçüm hareketi", tmsField(lt.remeasurements)),
      fieldRow("TMS 21 kur hareketi", tmsField(lt.tms21Movement)),
      fieldRow("TMS 29 net parasal pozisyon kazancı (−) / kaybı (+)", tmsField(lt.monetaryGainLoss), "Kâr veya zarara yansır (TMS 29.27–28)."),
      ...(movement.modificationGainLoss ? [fieldRow("Kısmi fesih kazancı (+) / kaybı (−) (TFRS 16.46(a))", movement.modificationGainLoss)] : []),
      fieldRow("Kira yükümlülüğü — kapanış", liability.closing || maturity.discountedLeaseLiabilityCarryingAmount),
      fieldRow("Gerçekleşmiş toplam kira nakit çıkışı (nominal)", liability.actualCashOutflow || q.totalCashOutflowForLeases),
      ...exemptionRows(q)
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
      ...(movement.modificationGainLoss ? [fieldRow("Kısmi fesih kazancı (+) / kaybı (−) (TFRS 16.46(a))", movement.modificationGainLoss)] : []),
      fieldRow("Kira yükümlülüğü — kapanış", liability.closing || maturity.discountedLeaseLiabilityCarryingAmount),
      ...exemptionRows(q)
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
    // The server says why a session ended (logout elsewhere, password change,
    // deactivated account).
    if (error?.status === 401 && error?.code === "SESSION_REVOKED") return "Oturumunuz sonlandırıldı (çıkış yapıldı veya parola değişti). Yeniden giriş yapın.";
    if (error?.status === 401 && error?.code === "ACCOUNT_INACTIVE") return "Hesabınız etkin değil. Yöneticinize başvurun.";
    if (error?.status === 401) return "Oturum açmanız gerekiyor.";
    if (error?.status === 403) return "Bu şirketin dipnotlarına erişim yetkiniz yok.";
    if (error?.code === "DISCLOSURE_TRUSTED_SOURCE_REQUIRED" && Array.isArray(error.details?.staleContractIds) && error.details.staleContractIds.length) {
      return `${error.details.staleContractIds.length} sözleşme son dipnot kaynağından sonra değişti (${error.details.staleContractIds.slice(0, 5).join(", ")}${error.details.staleContractIds.length > 5 ? "…" : ""}). Güncel dipnot için kaynağı yeniden oluşturun.`;
    }
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
    if (d.tms29) parts.push("TMS 29 uygulama kararı (TRY ve 31.12.2023 sonrası için uygulanır)");
    const outage = (d.unavailableProviders || []).includes("tms29IndexProvider")
      ? " TÜFE endekslerine ulaşılamadı; kullanım hakkı tutarları hesaplanamıyor."
      : d.unavailableProviders?.length ? " Bazı girdi kaynaklarına ulaşılamadı; ilgili alanlar eksik gösteriliyor." : "";
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
    investmentPropertyRou: "Yatırım amaçlı gayrimenkul kullanım hakkı", revaluedRou: "Yeniden değerlenmiş kullanım hakkı",
    shortTermLeaseCommitments: "Kısa vadeli kiralama taahhütleri",
    IFRS16_53C_SHORT_TERM_LEASE_EXPENSE: "Kısa vadeli kiralama gideri", IFRS16_53D_LOW_VALUE_LEASE_EXPENSE: "Düşük değerli kiralama gideri",
    IFRS16_53F_SUBLEASE_INCOME: "Alt kiralama geliri", IFRS16_53I_SALE_LEASEBACK_GAIN_LOSS: "Satış ve geri kiralama kazanç/kaybı",
    IFRS16_55_SHORT_TERM_COMMITMENTS: "Kısa vadeli kiralama taahhütleri", IFRS16_56_INVESTMENT_PROPERTY_ROU: "Yatırım amaçlı gayrimenkul kullanım hakkı",
    IFRS16_57_REVALUED_ROU: "Yeniden değerlenmiş kullanım hakkı", IFRS16_61_97_LESSOR_DISCLOSURE_BOUNDARY: "Kiraya veren açıklama kapsamı"
  });
  const VALIDATION_LABELS = Object.freeze({
    COMPLETE_FOR_SUPPORTED_SCOPE: "Desteklenen açıklama kapsamı tamam", INCOMPLETE_INPUT_REQUIRED: "Onaylı girdiler eksik",
    UNSUPPORTED_REQUIREMENT_PRESENT: "Desteklenmeyen açıklama gerekliliği var", FAILED_VALIDATION: "Sunucu doğrulaması başarısız"
  });
  const CERTIFICATION_LABELS = Object.freeze({
    DISCLOSURE_BACKEND_IMPLEMENTED_NOT_CERTIFIED: "Dipnot altyapısı hazır; bağımsız doğrulama henüz tamamlanmadı."
  });
  const certificationLabel = status => CERTIFICATION_LABELS[status] || "Bağımsız doğrulama bilgisi sunulmadı.";
  const SUPPORTED_REQUIREMENTS = new Set(["SUPPORTED", "SUPPORTED_AUTOMATIC", "SUPPORTED_WITH_ENTITY_INPUT", "SUPPORTED_WITH_LEDGER_INPUT", "SUPPORTED_WITH_DISCLOSURE_INPUT", "NOT_APPLICABLE"]);
  function sourceGaps(pkg) {
    const gaps = [], seen = new Set();
    const add = (id, status) => {
      // Scope boundaries are not missing inputs for the lessee's note.
      if (!id || seen.has(id) || VALUE_STATUSES.has(status) || status === "NOT_APPLICABLE" || status === "OUT_OF_SCOPE") return;
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
            ${ready ? `<p>${complete ? "Desteklenen kiracı dipnotları kapsamında eksik veri bildirilmedi." : "Dipnotu tamamlamak için gerekli veri ve destek durumu aşağıda gösterilir."}</p>
              ${gaps.length ? `<p>Şirket bilgilerini ve vade politikasını “Varsayımları düzenle” bölümünden tamamlayabilirsiniz. Gerçekleşen nakit çıkışları için doğrulanmış ödeme veya defter kayıtları gerekir.</p>` : ""}
              <ul>${gaps.map(g => `<li><strong>${e(g.label)}</strong><br>${e(STATUS_LABELS[g.status] || "Kaynak doğrulaması gerekli")}</li>`).join("")}</ul>
              <details><summary>Doğrulama bilgisi</summary><p>${e(validationLabel)}</p><p>${e(certificationLabel(pkg.certification?.status))}</p><p>Bu görünüm mevcut kaynaklardan hazırlanır. Eksik bilgiler otomatik olarak tamamlanmaz.</p></details>` : '<p>Paket yüklenince gereklilikler gösterilir.</p>'}
          </section>
          <section><span class="lq-dn-kick">MUTABAKAT KONTROLLERİ</span>${checkHtml}</section>
        </aside></div></div>`;
  }

  // ---------- TFRS 16 period journal (shared by Dipnotlar and Yevmiye) ----------
  const JOURNAL_ERRORS = { JOURNAL_REQUIRES_CONFIGURATION: "Bu dönem için onaylı hesap eşlemesi yok. Yönetim → Hesap eşlemesi ekranından onaylayın.",
    JOURNAL_TMS29_INDEX_REQUIRED: "TMS 29 için doğrulanmış TÜFE eksik", JOURNAL_CURRENCY_PROFILE_REQUIRED: "Şirketin onaylı para birimi profili gerekli." };
  const JOURNAL_MOVEMENTS = { INITIAL_RECOGNITION: "İlk muhasebeleştirme", INTEREST: "Faiz", CONTRACTUAL_PAYMENT: "Sözleşmesel ödeme",
    DEPRECIATION: "Amortisman", MODIFICATION_REMEASUREMENT: "Modifikasyon / yeniden ölçüm", FX_DIFFERENCE: "Kur farkı (TMS 21)",
    TMS29_RESTATEMENT: "Enflasyon düzeltmesi (TMS 29)", SUBLEASE_DERECOGNITION: "Alt kiralama devri", SUBLEASE_INCOME: "Alt kiralama geliri",
    EXEMPT_LEASE_EXPENSE: "İstisna kira gideri", SALE_AND_LEASEBACK: "Satış ve geri kiralama (TFRS 16.100)", SUBLEASE_RECEIPT: "Alt kiralama tahsilatı" };
  const money2 = v => Number(v || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function journalErrorText(error) {
    const code = error?.code || error?.details?.code;
    const [base, detail, field] = String(code || "").split(":");
    const prefixed = { JOURNAL_ACCOUNT_MAPPING_MISSING: `Hesap eşlemesinde "${detail}" amacı tanımlı değil. Yönetim → Hesap eşlemesi ekranında eşlemeyi yeniden onaylayın (yeni amaçlar eklenmiş olabilir).`,
      JOURNAL_SLB_SOURCE_REFRESH_REQUIRED: `${detail} için satış ve geri kiralama kaynağı eski. Bu dönem için "Güvenilir kaynağı oluştur" ile kaynağı yenileyin.`,
      JOURNAL_SOURCE_NOT_CALCULABLE: `${detail} sözleşmesinde "${field}" tutarı hesaplanamadı (dipnotta "Kaynak gerekli").`,
      JOURNAL_SOURCE_UNBALANCED: `${detail} sözleşmesinin fişi dengelenemedi.` }[base];
    if (prefixed) return prefixed;
    const months = error?.details?.missingMonths;
    return (JOURNAL_ERRORS[code] || `Yevmiye üretilemedi (${code || "bilinmeyen hata"})`) + (months?.length ? `: ${months.join(", ")}` : "");
  }
  const JOURNAL_TABLE_STYLE = `<style>
    :is(#v26PageHost,body) .lq-dn-yevmiye table.lq-jr-table{width:100%;border-collapse:collapse;font-size:13px;margin-top:6px;border:1px solid #dbe3ee;border-radius:8px;overflow:hidden}
    :is(#v26PageHost,body) .lq-dn-yevmiye table.lq-jr-table th{background:#0f1b33!important;color:#ffffff!important;font-size:11px;letter-spacing:.06em;text-transform:uppercase;padding:10px 12px;text-align:left;font-weight:600}
    :is(#v26PageHost,body) .lq-dn-yevmiye table.lq-jr-table td{color:#0f172a!important;padding:9px 12px;border-top:1px solid #e2e8f0;opacity:1!important}
    :is(#v26PageHost,body) .lq-dn-yevmiye table.lq-jr-table tbody tr:nth-child(even) td{background:#f5f8fc}
    :is(#v26PageHost,body) .lq-dn-yevmiye table.lq-jr-table tbody tr:hover td{background:#e8f0fe}
    :is(#v26PageHost,body) .lq-dn-yevmiye table.lq-jr-table .lq-jr-num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
    :is(#v26PageHost,body) .lq-dn-yevmiye table.lq-jr-table td.is-zero{color:#a0aec0!important}
    :is(#v26PageHost,body) .lq-dn-yevmiye table.lq-jr-table .lq-jr-code{color:#1d4ed8!important;font-weight:700}
    :is(#v26PageHost,body) .lq-dn-yevmiye table.lq-jr-table tr.lq-jr-total td{background:#eef2f7!important;font-weight:700;border-top:2px solid #0f1b33}
    :is(#v26PageHost,body) .lq-dn-yevmiye table.lq-jr-table.is-voucher{font-size:12.5px;margin:8px 0 12px}
    :is(#v26PageHost,body) .lq-dn-yevmiye table.lq-jr-table.is-voucher th{background:#334155!important}
    :is(#v26PageHost,body) .lq-dn-yevmiye details summary{color:#0f172a;cursor:pointer;padding:6px 0}
  </style>`;

  function journalSectionHtml({ ready, status, error, journal: j, tms29, title = "Dönem yevmiyesi (TFRS 16)" }) {
    const head = `<section class="gk-v26-card lq-dn-yevmiye" style="margin-top:16px"><h3 style="margin:0 0 6px">${escapeHtml(title)}</h3>`
      + `<p style="margin:0 0 10px;color:#64748b;font-size:12px">Fiş satırları dipnotun güvenilir kaynaklarından üretilir (sunum para birimi${tms29 ? ", TMS 29 düzeltilmiş" : ""}). Ödemeler sözleşmesel plandır; deftere gönderilmez.</p>`
      + `<button type="button" class="gk-v26-btn" id="disclosureJournal" ${ready && status !== "loading" ? "" : "disabled"}>${status === "loading" ? "Yevmiye hazırlanıyor…" : "Dönem yevmiyesini oluştur"}</button>`;
    if (status === "error") return head + `<p role="alert" style="color:#991b1b">${escapeHtml(journalErrorText(error))}</p></section>`;
    if (!j) return head + `</section>`;
    // Readable journal tables: dark text, zebra rows, account code
    // emphasised, zero amounts muted, totals row (overrides pale page styles).
    const amount = v => Number(v) ? `<td class="lq-jr-num">${money2(v)}</td>` : `<td class="lq-jr-num is-zero">${money2(0)}</td>`;
    const rows = j.summary.map(r => `<tr><td class="lq-jr-code">${escapeHtml(r.accountCode)}</td><td>${escapeHtml(r.accountName)}</td>${amount(r.debit)}${amount(r.credit)}</tr>`).join("")
      + `<tr class="lq-jr-total"><td></td><td>Toplam</td><td class="lq-jr-num">${money2(j.totalDebit)}</td><td class="lq-jr-num">${money2(j.totalCredit)}</td></tr>`;
    const vouchers = j.vouchers.map(v => `<details><summary>${escapeHtml(v.contractId)} · borç ${money2(v.totalDebit)} · ${v.reconciled ? "dipnotla mutabık ✓" : "mutabakat farkı"}</summary>`
      + `<table class="lq-jr-table is-voucher"><thead><tr><th>Hareket</th><th>Hesap</th><th class="lq-jr-num">Borç</th><th class="lq-jr-num">Alacak</th></tr></thead><tbody>${v.lines.map(l => `<tr><td>${escapeHtml(JOURNAL_MOVEMENTS[l.movement] || l.movement)}</td><td><span class="lq-jr-code">${escapeHtml(l.accountCode)}</span> ${escapeHtml(l.accountName)}</td><td class="lq-jr-num">${l.debit ? money2(l.debit) : ""}</td><td class="lq-jr-num">${l.credit ? money2(l.credit) : ""}</td></tr>`).join("")}</tbody></table></details>`).join("");
    return head + `<p role="status" style="margin:10px 0">${escapeHtml(j.voucherCount)} fiş · borç ${money2(j.totalDebit)} = alacak ${money2(j.totalCredit)} ${escapeHtml(j.currency)} · ${j.reconciled ? "tüm fişler dipnot hareketiyle mutabık" : "mutabakat farkı olan fiş var"}</p>`
      + JOURNAL_TABLE_STYLE
      + `<table class="lq-jr-table"><thead><tr><th>Hesap</th><th>Hesap adı</th><th class="lq-jr-num">Borç</th><th class="lq-jr-num">Alacak</th></tr></thead><tbody>${rows}</tbody></table>`
      + `<button type="button" class="gk-v26-btn gk-v26-btn-secondary" id="disclosureJournalCsv" style="margin-top:10px">↓ Yevmiyeyi CSV olarak indir</button>`
      + `<div style="margin-top:10px">${vouchers}</div></section>`;
  }
  function downloadJournalCsv(j, companyId, date) {
    const cell = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [["Sözleşme", "Fiş tarihi", "Hareket", "Hesap kodu", "Hesap adı", "Borç", "Alacak", "Para birimi"].map(cell).join(";")]
      .concat(j.vouchers.flatMap(v => v.lines.map(l => [v.contractId, v.postingDate, JOURNAL_MOVEMENTS[l.movement] || l.movement, l.accountCode, l.accountName,
        String(l.debit).replace(".", ","), String(l.credit).replace(".", ","), v.currency].map(cell).join(";"))));
    const blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const link = global.document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `tfrs16-yevmiye-${companyId}-${date}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  // Each render owns the container only until the next render: a request
  // started for the previous period must not draw over the new one.
  let footnotesRender = 0;
  function renderFootnotes(container) {
    if (!container) return;
    const renderToken = ++footnotesRender;
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
        if (requestKey !== `${state.companyId}|${state.periodStart}|${state.reportingDate}`) { state.producing = false; return; }
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
      state.journal = null; state.journalStatus = null; state.journalError = null;
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
      if (renderToken !== footnotesRender || !container.isConnected) return;
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
          + `<details><summary>Teknik ayrıntı</summary><code>${escapeHtml(state.error?.code || "DISCLOSURE_SOURCE_UNAVAILABLE")}</code>${state.error?.details?.cause ? `<pre style="white-space:pre-wrap;font-size:11px;color:#64748b">${escapeHtml(state.error.details.cause)}</pre>` : ""}</details>`
        : `${renderRows(rows)}<button type="button" class="gk-v26-btn gk-v26-btn-secondary" id="disclosureExport">↓ Dipnotu Dışa Aktar</button>`;
      const pkg = state.pkg;
      const source = pkg ? `<details style="margin-top:16px"><summary>Kaynak ve doğrulama bilgisi</summary>`
        + `<p>Şirket: ${escapeHtml(pkg.identity?.companyId)} · Dönem: ${escapeHtml(pkg.period?.reportingPeriodStart)} – ${escapeHtml(pkg.period?.reportingPeriodEnd)}`
        + ` · Para birimi: ${escapeHtml(pkg.period?.presentationCurrency)}</p>`
        + `<p>Kapsam: ${escapeHtml(pkg.population?.populationId)} · Kaynak sayısı: ${escapeHtml(pkg.population?.includedCount)}`
        + ` · Kaynak durumu: ${escapeHtml(state.availability?.sourceTrustStatus === "TRUSTED_SOURCE_IDENTIFIERS_VERIFIED" ? "Kaynak kayıtları doğrulandı" : "Kaynak doğrulaması gerekli")}`
        + ` · Doğrulama: ${escapeHtml(VALIDATION_LABELS[pkg.validation?.status] || "Tamlık doğrulanmadı")}`
        + ` · Eksik girdi: ${escapeHtml(pkg.missingInputs?.length ?? 0)}`
        + ` · Bağımsız doğrulama: ${escapeHtml(certificationLabel(pkg.certification?.status))}</p>`
        + `<p>Para birimi kanıtı: ${escapeHtml(pkg.identity?.currencyEvidenceId)}`
        + ` · Vade politikası: ${escapeHtml(pkg.maturityAnalysis?.timeBandPolicyId || "Gerekli")}`
        + ` · Açıklama kimliği: ${escapeHtml(pkg.identity?.disclosureId)}</p>`
        + `<p>Dönem hareketi kapsamı: ${escapeHtml(pkg.periodMovement?.sourceRouteStatus === "P1_TRUSTED_SNAPSHOT_ONLY" ? "Doğrulanmış dönem kayıtları" : "Kaynak doğrulaması gerekli")}`
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
      container.insertAdjacentHTML("beforeend", journalHtml());
      container.querySelector("#disclosureJournal")?.addEventListener("click", loadJournal);
      container.querySelector("#disclosureJournalCsv")?.addEventListener("click", exportJournal);
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
    function journalHtml() {
      const ready = state.status === "ready" && state.availability;
      return journalSectionHtml({ ready, status: state.journalStatus, error: state.journalError, journal: state.journal,
        tms29: state.pkg?.tms29?.applied === true });
    }
    async function loadJournal() {
      if (state.status !== "ready" || !state.availability || typeof facade?.loadPeriodJournal !== "function") return;
      const key = state.key;
      state.journalStatus = "loading"; state.journalError = null; draw();
      try {
        const journal = await facade.loadPeriodJournal(state.availability);
        if (key !== state.key) return;
        state.journal = journal; state.journalStatus = "ready";
      } catch (error) {
        if (key !== state.key) return;
        state.journalError = error; state.journalStatus = "error";
      }
      draw();
    }
    function exportJournal() { if (state.journal) downloadJournalCsv(state.journal, state.companyId, state.reportingDate); }
    bridge.setActiveScreenRefreshCallback?.(() => { state.key = null; state.sequence++; draw(); });
    draw();
  }

  // Yevmiye page: the TFRS 16 period journal for a company and the shared
  // reporting period, from the same trusted sources as the lease note.
  let journalPageRender = 0;
  function renderPeriodJournalPage(container) {
    if (!container) return;
    const token = ++journalPageRender;
    const bridge = global.GK_TFRS16 || {};
    bridge.injectV26Styles?.();
    const facade = global.LeaseQantPrivateTfrs16Facade;
    const companies = (bridge.getUnifiedCompanyOptions?.() || []).filter(item => item && typeof item.id === "string" && item.id && item.id !== "ALL");
    const active = bridge.getActiveCompanyId?.();
    const shared = () => global.LeaseQantReportingPeriod?.get?.() || global.LeaseQantReportingAuthorityUi?.defaultPeriod?.() || {};
    const state = { companyId: companies.some(c => c.id === active) ? active : (companies[0]?.id || ""), availability: null,
      sourceStatus: "idle", sourceError: null, producing: false, summary: null, journal: null, journalStatus: null, journalError: null, seq: 0 };
    const period = () => { const p = shared(); return { companyId: state.companyId, reportingPeriodStart: p.periodStart, reportingPeriodEnd: p.periodEnd, reportingDate: p.periodEnd }; };
    const contractIds = () => {
      const p = shared(), ids = new Set();
      return (bridge.getPortfolioContracts?.() || []).filter(c => {
        const id = String(c?.id ?? "").trim(), start = c?.startDate ?? c?.start_date, end = c?.endDate ?? c?.end_date;
        if (!id || String(c?.companyId ?? c?.company_id ?? "") !== state.companyId || !isoDate(start) || !isoDate(end)
          || end < p.periodStart || start > p.periodEnd || ids.has(id)) return false;
        ids.add(id); return true;
      }).map(c => String(c.id));
    };
    async function loadSources() {
      const seq = ++state.seq;
      state.availability = null; state.journal = null; state.journalStatus = null; state.journalError = null;
      if (!state.companyId) { state.sourceStatus = "empty"; return draw(); }
      state.sourceStatus = "loading"; draw();
      try {
        const availability = await facade.loadLeaseDisclosureAvailability(period());
        if (seq !== state.seq) return;
        state.availability = availability; state.sourceStatus = "ready";
      } catch (error) {
        if (seq !== state.seq) return;
        state.sourceError = error; state.sourceStatus = "error";
      }
      draw();
    }
    async function produce() {
      const ids = contractIds();
      if (!ids.length || typeof facade?.createTrustedDisclosureSnapshots !== "function") return;
      state.producing = true; draw();
      try {
        const results = await facade.createTrustedDisclosureSnapshots(ids, period());
        const failed = results.filter(r => r?.success !== true);
        state.summary = failed.length ? `${results.length - failed.length}/${ids.length} sözleşme için kaynak oluşturuldu. Kalanlar: ${failed.map(r => `${r.contractId} [${r.code || "HATA"}]`).join(", ")}` : null;
      } catch (error) { state.summary = `Kaynak oluşturulamadı: ${error?.code || "HATA"}`; }
      state.producing = false;
      loadSources();
    }
    async function loadJournal() {
      if (!state.availability) return;
      const seq = state.seq;
      state.journalStatus = "loading"; draw();
      try {
        const journal = await facade.loadPeriodJournal(state.availability);
        if (seq !== state.seq) return;
        state.journal = journal; state.journalStatus = "ready";
      } catch (error) {
        if (seq !== state.seq) return;
        state.journalError = error; state.journalStatus = "error";
      }
      draw();
    }
    function draw() {
      if (token !== journalPageRender || !container.isConnected) return;
      const p = shared();
      const sourceRequired = state.sourceStatus === "error" && state.sourceError?.code === "DISCLOSURE_TRUSTED_SOURCE_REQUIRED";
      const sourceHtml = state.producing ? `<p role="status">Sunucu sözleşmeleri doğrulayıp güvenilir kaynak oluşturuyor…</p>`
        : state.sourceStatus === "loading" ? `<p role="status">Güvenilir kaynaklar kontrol ediliyor…</p>`
        : state.sourceStatus === "empty" ? `<p>Yetkili şirket bulunamadı.</p>`
        : sourceRequired ? `<p role="status">${Array.isArray(state.sourceError?.details?.staleContractIds) && state.sourceError.details.staleContractIds.length
            ? escapeHtml(errorLabel(state.sourceError))
            : `Bu dönem için güvenilir kaynak eksik (${contractIds().length} sözleşme).`}</p><button type="button" class="gk-v26-btn gk-v26-btn-secondary" id="journalPageProduce">Güvenilir kaynağı oluştur</button>`
        : state.sourceStatus === "error" ? `<p role="alert" style="color:#991b1b">${escapeHtml(errorLabel(state.sourceError))}</p>`
        : state.availability ? `<p role="status">${escapeHtml(state.availability.contractIds.length)} sözleşmenin güvenilir kaynağı hazır.</p>` : "";
      container.innerHTML = `<div class="gk-v26-page"><h2>Yevmiye</h2><p style="color:#64748b">TFRS 16 dönem yevmiyesi: ilk muhasebeleştirme, faiz, ödeme, amortisman, modifikasyon, kur farkı (TMS 21), enflasyon düzeltmesi (TMS 29), alt kiralama ve satış ve geri kiralama kayıtları. Dönem üst çubuktaki raporlama döneminden alınır.</p>`
        + `<div class="gk-v26-card"><div style="display:flex;gap:12px;flex-wrap:wrap;align-items:end"><label>Şirket<br><select id="journalPageCompany" ${state.producing ? "disabled" : ""}>${companies.map(c => `<option value="${escapeHtml(c.id)}" ${c.id === state.companyId ? "selected" : ""}>${escapeHtml(c.name || c.id)}</option>`).join("")}</select></label>`
        + `<div><small style="color:#64748b">Dönem</small><br><strong>${escapeHtml(p.periodStart || "—")} – ${escapeHtml(p.periodEnd || "—")}</strong></div></div>`
        + `<div style="margin-top:12px">${sourceHtml}${state.summary ? `<p role="status">${escapeHtml(state.summary)}</p>` : ""}</div></div>`
        + journalSectionHtml({ ready: state.sourceStatus === "ready", status: state.journalStatus, error: state.journalError, journal: state.journal, tms29: false })
        + `</div>`;
      container.querySelector("#journalPageCompany")?.addEventListener("change", e => { state.companyId = e.target.value; state.summary = null; loadSources(); });
      container.querySelector("#journalPageProduce")?.addEventListener("click", produce);
      container.querySelector("#disclosureJournal")?.addEventListener("click", loadJournal);
      container.querySelector("#disclosureJournalCsv")?.addEventListener("click", () => { if (state.journal) downloadJournalCsv(state.journal, state.companyId, p.periodEnd); });
    }
    const unsubscribe = global.LeaseQantReportingPeriod?.subscribe?.(() => { if (token !== journalPageRender || !container.isConnected) { unsubscribe?.(); return; } state.summary = null; loadSources(); });
    loadSources();
  }

  global.LeaseQantTfrs16DisclosureUi = Object.freeze({ renderFootnotes, renderPeriodJournalPage, rowsForTab, exportRows, errorLabel, validPeriodRange, sourceGaps });
})(window);
