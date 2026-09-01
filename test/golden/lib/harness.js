/**
 * ============================================================
 * FAZ 0.2 — GOLDEN-OUTPUT HARNESS
 * ============================================================
 *
 * Regresyon matrisindeki her kontrat için, refaktör planında
 * listelenen 6 hedef fonksiyonun çıktısını üretir:
 *
 *   calculateLeaseEngineImpl      (cache BYPASS — ham, deterministik)
 *   calculateLiabilitySplitAsOf   (her raporlama tarihi için)
 *   generateModificationJournal   (her APPLIED modification için)
 *   generateReassessmentJournal   (her APPLIED reassessment için)
 *   getCfoContractMetrics         (her raporlama tarihi için)
 *   runContractControls
 *
 * Ek olarak SLB / Sublease senaryoları ve Faz 0.3 invariant'ları.
 *
 * --- DETERMİNİZM STRATEJİSİ (üç katman) ---
 *  1) Sistem saati dondurulur (jest fake timers) → `new Date()`
 *     kaynaklı tüm sapmalar sabitlenir.
 *  2) localStorage her fixture öncesi temizlenip bilinen bir
 *     duruma (FX kurları, token) tohumlanır.
 *  3) Kalan üretilmiş kimlikler normalize.js ile kanonikleştirilir.
 *
 * --- NEDEN calculateLeaseEngineImpl, calculateLeaseEngine DEĞİL ---
 * calculateLeaseEngine cache'e bakar ve cache HIT'te AYNI OBJE
 * REFERANSINI döndürür. Dahası, cache anahtarı imzası paymentTiming /
 * variablePayment / usefulLifeMonths gibi alanları İÇERMİYOR
 * (bkz. getCalculationCacheKey, satır ~980) — yani aynı id ile farklı
 * bu alanlara sahip iki kontrat çakışabilir. Baseline'ın cache
 * davranışından etkilenmemesi için doğrudan Impl çağrılır.
 */

"use strict";

const { normalize } = require("./normalize");
const { runInvariants } = require("./invariants");

/** Baseline için dondurulan sistem saati. Değiştirilirse baseline geçersizleşir. */
const FROZEN_NOW = "2026-06-30T09:00:00.000Z";

const FX_STORAGE_KEY = "gk_tfrs16_v23_fx_rates_v1";

/**
 * Deterministik FX kur tablosu. Gerçek TCMB kurları DEĞİL — kasıtlı
 * olarak yuvarlak ve sabit; amaç çevrim yolunun tutarlılığını
 * dondurmak, piyasa verisini yansıtmak değil.
 */
function fxRateSeed() {
  const rows = [];
  const pairs = [
    ["EUR", "TRY", 38.5],
    ["USD", "TRY", 35.25],
    ["GBP", "TRY", 44.8]
  ];
  const dates = [
    "2026-01-01", "2026-06-30", "2026-12-31",
    "2027-06-30", "2027-12-31", "2028-06-30",
    "2028-12-31", "2029-06-30", "2029-12-31",
    "2030-12-31", "2031-12-31"
  ];
  // rateType: convertAmountToReportingCurrency → convertCurrencyOnDate,
  // FX_CONFIG.defaultRateType (= SPOT) ile çağırır. İlk baseline
  // koşumunda YALNIZCA CLOSING tohumlanmıştı ve tüm FX çevrimleri
  // sessizce FX_RATE_NOT_FOUND döndü — yani "presentationConversion"
  // boyutu aslında hiç sınanmıyordu. Her iki tip de tohumlanır.
  const rateTypes = ["SPOT", "CLOSING"];
  pairs.forEach(([from, to, rate]) => {
    dates.forEach(rateDate => {
      rateTypes.forEach(rateType => {
      rows.push({
        id: `FXR-${from}-${to}-${rateDate}-${rateType}`,
        fromCurrency: from,
        toCurrency: to,
        rate,
        rateDate,
        rateType,
        source: "SYSTEM",
        status: "APPROVED",
        reason: null,
        createdBy: "golden-harness",
        createdAt: FROZEN_NOW,
        updatedAt: FROZEN_NOW,
        schemaVersion: 1
      });
      });
    });
  });
  return rows;
}

/** tfrs16ApiFetch res.text() okur — mock bunu yansıtmalı. */
function okResponse(data = { success: true }) {
  return { ok: true, status: 200, text: async () => JSON.stringify(data) };
}

/**
 * Test ortamını fixture koşumu için sıfırlar.
 * loadTfrs16() ÇAĞRILMADAN ÖNCE çalışmalıdır.
 */
function prepareEnvironment() {
  localStorage.clear();
  localStorage.setItem("access_token", "golden-harness-token");
  localStorage.setItem(FX_STORAGE_KEY, JSON.stringify(fxRateSeed()));
}

/** Derin kopya — fixture'ın koşumlar arası kirlenmesini önler. */
function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * Bir fixture kontratına, tanımlıysa, GERÇEK modification ve
 * reassessment akışını uygular (elle uydurulmuş obje kullanılmaz).
 *
 * @returns {{applied:{modifications:number, reassessments:number}, errors:string[]}}
 */
async function applyLifecycleEvents(tfrs16, contract, fixture) {
  const errors = [];
  let modsApplied = 0;
  let reassessApplied = 0;

  for (const input of fixture.modificationInputs || []) {
    const created = await tfrs16.createModification(contract, input);
    if (!created || created.valid !== true) {
      errors.push(`createModification başarısız: ${(created?.errors || ["bilinmeyen"]).join(" | ")}`);
      continue;
    }
    const modId = created.modification?.id;
    const applied = await tfrs16.applyModification(contract, modId);
    if (!applied || applied.valid !== true) {
      errors.push(`applyModification başarısız: ${(applied?.errors || ["bilinmeyen"]).join(" | ")}`);
      continue;
    }
    modsApplied += 1;
  }

  for (const input of fixture.reassessmentInputs || []) {
    const created = await tfrs16.createReassessment(contract, input);
    if (!created || created.valid !== true) {
      errors.push(`createReassessment başarısız: ${(created?.errors || ["bilinmeyen"]).join(" | ")}`);
      continue;
    }
    const raId = created.reassessment?.id;
    const applied = await tfrs16.applyReassessment(contract, raId);
    if (!applied || applied.valid !== true) {
      errors.push(`applyReassessment başarısız: ${(applied?.errors || ["bilinmeyen"]).join(" | ")}`);
      continue;
    }
    reassessApplied += 1;
  }

  return { applied: { modifications: modsApplied, reassessments: reassessApplied }, errors };
}

/**
 * FX kanıtı toplar: motorun ana tutarlarını kontratın para biriminden
 * presentation para birimine çevirir. INV-12 bu kalemlerin AYNI kurla
 * çevrildiğini denetler.
 */
function collectFxEvidence(tfrs16, contract, engine, reportingDate) {
  const from = String(contract.currency || "TRY").toUpperCase();
  const to = String(contract.presentationCurrency || contract.reportingCurrency || "TRY").toUpperCase();
  if (!from || from === to) {
    return { applied: false, from, to, rate: null, pairs: [] };
  }
  const items = [
    ["liability", engine.liability],
    ["rouAssets", engine.rouAssets],
    ["depreciation", engine.depreciation],
    ["monthlyInterest", engine.monthlyInterest]
  ];
  const pairs = [];
  let rate = null;
  let applied = false;
  let error = null;
  items.forEach(([label, amount]) => {
    const converted = tfrs16.convertAmountToReportingCurrency(amount, from, reportingDate, to);
    if (converted.applied) {
      applied = true;
      rate = converted.rate;
    } else if (!error) {
      error = converted.error || "çevrim uygulanmadı";
    }
    pairs.push({ label, source: Number(amount) || 0, target: Number(converted.value) || 0 });
  });
  return { applied, from, to, rate, error, pairs };
}

/**
 * Tek bir fixture için golden kaydı üretir.
 */
async function buildContractRecord(tfrs16, fixture) {
  const contract = deepClone(fixture.contract);
  tfrs16.__seedContractsForTest([contract]);

  const lifecycle = await applyLifecycleEvents(tfrs16, contract, fixture);
  // Yaşam döngüsü olayları kontratı MUTASYONA UĞRATTI; motor sonrası
  // durumdan hesaplanmalı. Seed'i tazele ki CFO katmanı da güncel
  // kontratı görsün.
  tfrs16.__seedContractsForTest([contract]);

  const engine = tfrs16.calculateLeaseEngineImpl(contract);

  const splits = (fixture.reportingDates || []).map(reportingDate => ({
    reportingDate,
    split: tfrs16.calculateLiabilitySplitAsOf(contract, reportingDate),
    metrics: tfrs16.getCfoContractMetrics(contract.id, reportingDate)
  }));

  const modificationJournals = (contract.modifications || [])
    .filter(m => m.status === "APPLIED")
    .map((m, index) => ({
      label: `modification[${index}]`,
      modificationType: m.modificationType || m.type || null,
      effectiveDate: m.effectiveDate || null,
      entries: tfrs16.generateModificationJournal(contract, m)
    }));

  const reassessmentJournals = (contract.reassessments || [])
    .filter(r => r.status === "APPLIED")
    .map((r, index) => ({
      label: `reassessment[${index}]`,
      reassessmentType: r.type || null,
      effectiveDate: r.effectiveDate || null,
      entries: tfrs16.generateReassessmentJournal(contract, r)
    }));

  const controls = tfrs16.runContractControls(contract);

  const primaryReportingDate = (fixture.reportingDates || [])[0] || FROZEN_NOW.slice(0, 10);
  const fx = collectFxEvidence(tfrs16, contract, engine, primaryReportingDate);

  const invariantChecks = runInvariants({
    contract,
    engine,
    splits,
    journals: [...modificationJournals, ...reassessmentJournals],
    fx
  });

  return normalize({
    fixtureId: fixture.id,
    label: fixture.label,
    dimensions: fixture.dimensions,
    lifecycle,
    contractAfterLifecycle: contract,
    engine,
    splits,
    modificationJournals,
    reassessmentJournals,
    controls,
    fx,
    invariantChecks
  });
}

/** SLB senaryosu için golden kaydı. */
function buildSlbRecord(tfrs16, testCase) {
  let output = null;
  let error = null;
  try {
    output = tfrs16.calculateSaleAndLeaseback(deepClone(testCase.input));
  } catch (e) {
    error = { code: e?.code || null, message: e?.message || String(e) };
  }
  return normalize({ fixtureId: testCase.id, label: testCase.label, output, error });
}

/** Sublease senaryosu için golden kaydı. */
function buildSubleaseRecord(tfrs16, testCase) {
  let output = null;
  let error = null;
  try {
    output = tfrs16.calculateSublease(deepClone(testCase.input));
  } catch (e) {
    error = { code: e?.code || null, message: e?.message || String(e) };
  }
  return normalize({ fixtureId: testCase.id, label: testCase.label, output, error });
}

module.exports = {
  FROZEN_NOW,
  FX_STORAGE_KEY,
  prepareEnvironment,
  okResponse,
  fxRateSeed,
  buildContractRecord,
  buildSlbRecord,
  buildSubleaseRecord,
  deepClone
};
