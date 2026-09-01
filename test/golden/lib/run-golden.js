/**
 * ============================================================
 * FAZ 0.2 — GOLDEN KOŞUCU (ortak giriş noktası)
 * ============================================================
 *
 * Hem baseline yazıcısı hem de regresyon testi AYNI koşucuyu
 * kullanır. Bu kasıtlıdır: baseline'ı üreten kod ile onu doğrulayan
 * kod ayrışırsa, karşılaştırma kendi kendini kandırır.
 *
 * Sistem saati dondurulur; böylece `new Date()` kaynaklı her şey
 * (runContractControls().testedAt, cfoResolveReportingDate fallback'i,
 * v23Now() vb.) koşumdan koşuma sabit kalır.
 */

"use strict";

const { loadTfrs16 } = require("../../helpers/loadTfrs16");
const { CONTRACT_MATRIX } = require("../fixtures/contract-matrix");
const { SLB_CASES, SUBLEASE_CASES } = require("../fixtures/slb-sublease");
const {
  FROZEN_NOW,
  prepareEnvironment,
  okResponse,
  buildContractRecord,
  buildSlbRecord,
  buildSubleaseRecord
} = require("./harness");

/**
 * Tüm matrisi koşup golden kayıt setini üretir.
 *
 * ÖNEMLİ: Bu fonksiyon jsdom test ortamında (jest) çağrılmalıdır —
 * localStorage, document ve fake timer'lara ihtiyaç duyar.
 *
 * @returns {Promise<{meta:Object, contracts:Array, slb:Array, sublease:Array}>}
 */
async function runGolden() {
  jest.useFakeTimers({ doNotFake: ["nextTick", "queueMicrotask"] });
  jest.setSystemTime(new Date(FROZEN_NOW));

  const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(okResponse());

  try {
    prepareEnvironment();
    const tfrs16 = loadTfrs16();

    const contracts = [];
    for (const fixture of CONTRACT_MATRIX) {
      // Her fixture kendi temiz durumundan başlar: bir fixture'ın
      // localStorage'a yazdığı audit/kilit kayıtları bir sonrakini
      // etkilerse baseline yalancı olur.
      prepareEnvironment();
      contracts.push(await buildContractRecord(tfrs16, fixture));
    }

    prepareEnvironment();
    const slb = SLB_CASES.map(testCase => buildSlbRecord(tfrs16, testCase));

    prepareEnvironment();
    const sublease = SUBLEASE_CASES.map(testCase => buildSubleaseRecord(tfrs16, testCase));

    const meta = {
      frozenNow: FROZEN_NOW,
      contractCount: contracts.length,
      slbCount: slb.length,
      subleaseCount: sublease.length,
      targetFunctions: [
        "calculateLeaseEngineImpl",
        "calculateLiabilitySplitAsOf",
        "generateModificationJournal",
        "generateReassessmentJournal",
        "getCfoContractMetrics",
        "runContractControls"
      ],
      schemaVersion: 1
    };

    return { meta, contracts, slb, sublease };
  } finally {
    fetchSpy.mockRestore();
    jest.useRealTimers();
  }
}

module.exports = { runGolden };
