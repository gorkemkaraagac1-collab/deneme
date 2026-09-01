/**
 * ============================================================
 * FAZ 0.1 — REGRESYON MATRİSİ (KONTRAT SEÇİMİ)
 * ============================================================
 *
 * Refaktör planı Faz 0.1: 25–30 kontratlık, risk bazlı kombinasyon
 * matrisi. Kartezyen çarpım (yüzlerce kombinasyon) hedeflenmiyor;
 * hedef, HER BOYUTUN en az bir kez ve YÜKSEK RİSKLİ KESİŞİMLERİN
 * (ör. FX + modification + endeksli eskalasyon aynı kontratta)
 * temsil edilmesi.
 *
 * Bu dosya SALT VERİ'dir — hiçbir production fonksiyonu import
 * etmez, hiçbir yan etkisi yoktur. Faz 0 kuralı gereği hiçbir
 * production logic'e dokunulmamıştır.
 *
 * --- KAPSANAN BOYUTLAR ---
 *  paymentFrequency ....... monthly | quarterly | annual
 *  paymentTiming .......... arrears | advance
 *  escalation ............. none | fixedRate | fixedAmount | index
 *  escalationBase ......... compound | initial
 *  modification ........... none | tek | zincirli (2+)
 *  reassessment ........... none | INDEX_RATE_CHANGE | LEASE_TERM_CHANGE
 *  currency ............... TRY | yabancı (EUR/USD) + presentation çevrimi
 *  exemption .............. shortTermLease | lowValueAsset
 *  ROU bileşenleri ........ initialDirectCosts / leaseIncentives /
 *                           prepayments / restorationObligation
 *  değişken ödeme ......... variablePayment
 *  amortisman ömrü ........ ownershipTransfer/purchaseOption + usefulLifeMonths
 *  edge case .............. ay ortası başlangıç, reporting-date sınırı,
 *                           future-dated, terminated/expired, çok kısa süre
 *
 * `reportingDates` alanı, o kontrat için golden-output alınacak
 * raporlama tarihlerini belirtir (current/non-current ayrımı ve
 * sınır davranışı bu tarihlere duyarlıdır).
 */

"use strict";

/** Tüm fixture'lar için ortak taban. */
function base(overrides) {
  return Object.assign(
    {
      company: "Golden Test A.Ş.",
      companyId: "GC-COMPANY-1",
      supplier: "Golden Tedarikçi Ltd.",
      currency: "TRY",
      functionalCurrency: "TRY",
      reportingCurrency: "TRY",
      paymentFrequency: "monthly",
      paymentTiming: "arrears",
      leaseIncreaseType: "none",
      status: "active"
    },
    overrides
  );
}

/**
 * Her fixture:
 *   contract        — motora verilecek kontrat objesi
 *   dimensions      — bu kontratın kapsadığı matris boyutları (kapsama testi bunu okur)
 *   reportingDates  — golden-output alınacak raporlama tarihleri
 *   modificationInputs / reassessmentInputs — harness bunları GERÇEK
 *     createModification/applyModification akışından geçirir; elle
 *     uydurulmuş modification objesi KULLANILMAZ (uydurma obje,
 *     motorun gerçekte ürettiğinden sapabilir ve baseline'ı yalancı yapar).
 */
const CONTRACT_MATRIX = [
  /* ---------- 1) TEMEL / KONTROL GRUBU ---------- */
  {
    id: "GC-01",
    label: "Aylık / arrears / eskalasyonsuz / TRY — kontrol grubu",
    dimensions: ["freq:monthly", "timing:arrears", "escalation:none", "currency:TRY"],
    reportingDates: ["2026-12-31", "2027-12-31"],
    contract: base({
      id: "GC-01",
      monthlyPayment: 100000,
      discountRate: 18,
      startDate: "2026-01-01",
      endDate: "2028-12-31"
    })
  },
  {
    id: "GC-02",
    label: "Aylık / advance (peşin) ödeme",
    dimensions: ["freq:monthly", "timing:advance", "escalation:none"],
    reportingDates: ["2026-12-31"],
    contract: base({
      id: "GC-02",
      monthlyPayment: 100000,
      discountRate: 18,
      startDate: "2026-01-01",
      endDate: "2028-12-31",
      paymentTiming: "advance"
    })
  },

  /* ---------- 2) ÖDEME SIKLIĞI ---------- */
  {
    id: "GC-03",
    label: "Üç aylık (quarterly) ödeme / arrears",
    dimensions: ["freq:quarterly", "timing:arrears"],
    reportingDates: ["2026-12-31", "2027-06-30"],
    contract: base({
      id: "GC-03",
      monthlyPayment: 300000,
      discountRate: 22,
      startDate: "2026-01-01",
      endDate: "2028-12-31",
      paymentFrequency: "quarterly"
    })
  },
  {
    id: "GC-04",
    label: "Yıllık (annual) ödeme / advance",
    dimensions: ["freq:annual", "timing:advance"],
    reportingDates: ["2026-12-31", "2028-06-30"],
    contract: base({
      id: "GC-04",
      monthlyPayment: 1200000,
      discountRate: 25,
      startDate: "2026-01-01",
      endDate: "2029-12-31",
      paymentFrequency: "annual",
      paymentTiming: "advance"
    })
  },

  /* ---------- 3) ESKALASYON ---------- */
  {
    id: "GC-05",
    label: "Sabit oranlı eskalasyon (fixedRate) / compound / yıllık periyot",
    dimensions: ["escalation:fixedRate", "escalationBase:compound"],
    reportingDates: ["2026-12-31", "2027-12-31"],
    contract: base({
      id: "GC-05",
      monthlyPayment: 100000,
      discountRate: 20,
      startDate: "2026-01-01",
      endDate: "2029-12-31",
      leaseIncreaseType: "fixedRate",
      leaseIncreaseRate: 25,
      escalationFrequencyMonths: 12,
      escalationBase: "compound"
    })
  },
  {
    id: "GC-06",
    label: "Sabit oranlı eskalasyon / initial bazlı / 6 aylık periyot",
    dimensions: ["escalation:fixedRate", "escalationBase:initial", "escalationFrequency:6"],
    reportingDates: ["2027-06-30"],
    contract: base({
      id: "GC-06",
      monthlyPayment: 80000,
      discountRate: 20,
      startDate: "2026-01-01",
      endDate: "2028-12-31",
      leaseIncreaseType: "fixedRate",
      leaseIncreaseRate: 10,
      escalationFrequencyMonths: 6,
      escalationBase: "initial"
    })
  },
  {
    id: "GC-07",
    label: "Sabit tutarlı eskalasyon (fixedAmount) + özel ilk artış tarihi",
    dimensions: ["escalation:fixedAmount", "escalationFirstDate"],
    reportingDates: ["2027-03-31"],
    contract: base({
      id: "GC-07",
      monthlyPayment: 50000,
      discountRate: 15,
      startDate: "2026-01-01",
      endDate: "2028-12-31",
      leaseIncreaseType: "fixedAmount",
      fixedIncrease: 7500,
      escalationFrequencyMonths: 12,
      escalationFirstDate: "2026-07-01"
    })
  },
  {
    id: "GC-08",
    label: "Endeks bazlı eskalasyon (index / TÜFE)",
    dimensions: ["escalation:index"],
    reportingDates: ["2026-12-31", "2027-12-31"],
    contract: base({
      id: "GC-08",
      monthlyPayment: 120000,
      discountRate: 24,
      startDate: "2026-01-01",
      endDate: "2029-12-31",
      leaseIncreaseType: "index",
      leaseIncreaseRate: 35,
      escalationFrequencyMonths: 12,
      escalationBase: "compound"
    })
  },

  /* ---------- 4) MODIFICATION ---------- */
  {
    id: "GC-09",
    label: "Tek modification — ödeme artışı (PAYMENT_INCREASE)",
    dimensions: ["modification:single", "modificationType:PAYMENT_INCREASE"],
    reportingDates: ["2026-12-31", "2027-12-31"],
    contract: base({
      id: "GC-09",
      monthlyPayment: 100000,
      discountRate: 18,
      startDate: "2026-01-01",
      endDate: "2028-12-31"
    }),
    modificationInputs: [
      {
        modificationDate: "2026-06-01",
        effectiveDate: "2026-07-01",
        modificationType: "PAYMENT_INCREASE",
        newPayment: 130000,
        reason: "Golden matrix — tek modification"
      }
    ]
  },
  {
    id: "GC-10",
    label: "Zincirli modification — kapsam artışı + süre uzatımı (2 adet)",
    dimensions: ["modification:chained", "modificationType:SCOPE_INCREASE", "modificationType:LEASE_TERM_EXTENSION"],
    reportingDates: ["2027-06-30", "2028-12-31"],
    contract: base({
      id: "GC-10",
      monthlyPayment: 90000,
      discountRate: 21,
      startDate: "2026-01-01",
      endDate: "2028-12-31"
    }),
    modificationInputs: [
      {
        modificationDate: "2026-05-01",
        effectiveDate: "2026-06-01",
        modificationType: "SCOPE_INCREASE",
        // validateModification: SCOPE_INCREASE için yüzde VEYA tutar
        // ZORUNLU (satır ~3684). Bu alan olmadan modification hiç
        // oluşmuyordu ve "zincirli modification" boyutu aslında
        // KAPSANMIYORDU — ilk baseline koşumunda yakalandı.
        scopeIncreasePercent: 25,
        newPayment: 115000,
        newLeaseEndDate: "2029-06-30",
        reason: "Golden matrix — zincir 1/2"
      },
      {
        modificationDate: "2027-01-15",
        effectiveDate: "2027-02-01",
        modificationType: "LEASE_TERM_EXTENSION",
        newLeaseEndDate: "2030-12-31",
        reason: "Golden matrix — zincir 2/2"
      }
    ]
  },
  {
    id: "GC-11",
    label: "Modification — kapsam azalışı (SCOPE_DECREASE, kazanç/kayıp üretir)",
    dimensions: ["modification:single", "modificationType:SCOPE_DECREASE", "journal:gainLoss"],
    reportingDates: ["2027-06-30"],
    contract: base({
      id: "GC-11",
      monthlyPayment: 200000,
      discountRate: 19,
      startDate: "2026-01-01",
      endDate: "2029-12-31"
    }),
    modificationInputs: [
      {
        modificationDate: "2026-11-01",
        effectiveDate: "2026-12-01",
        modificationType: "SCOPE_DECREASE",
        // validateModification: SCOPE_DECREASE için scopeReductionPercent
        // 0–100 aralığında ZORUNLU (satır ~3677).
        scopeReductionPercent: 40,
        newPayment: 120000,
        reason: "Golden matrix — scope decrease"
      }
    ]
  },

  /* ---------- 5) REASSESSMENT ---------- */
  {
    id: "GC-12",
    label: "Reassessment — endeks/oran değişimi (INDEX_RATE_CHANGE)",
    dimensions: ["reassessment:index", "reassessmentType:INDEX_RATE_CHANGE"],
    reportingDates: ["2027-06-30"],
    contract: base({
      id: "GC-12",
      monthlyPayment: 100000,
      discountRate: 20,
      startDate: "2026-01-01",
      endDate: "2029-12-31",
      leaseIncreaseType: "index",
      leaseIncreaseRate: 30,
      escalationFrequencyMonths: 12
    }),
    reassessmentInputs: [
      {
        reassessmentDate: "2027-01-01",
        effectiveDate: "2027-01-01",
        type: "INDEX_RATE_CHANGE",
        newPayment: 145000,
        reason: "Golden matrix — endeks reassessment"
      }
    ]
  },
  {
    id: "GC-13",
    label: "Reassessment — kira süresi değişimi (LEASE_TERM_CHANGE)",
    dimensions: ["reassessment:term", "reassessmentType:LEASE_TERM_CHANGE"],
    reportingDates: ["2027-12-31"],
    contract: base({
      id: "GC-13",
      monthlyPayment: 75000,
      discountRate: 17,
      startDate: "2026-01-01",
      endDate: "2028-12-31",
      renewalOption: true
    }),
    reassessmentInputs: [
      {
        reassessmentDate: "2027-03-01",
        effectiveDate: "2027-04-01",
        type: "LEASE_TERM_CHANGE",
        newLeaseEndDate: "2031-12-31",
        reason: "Golden matrix — süre reassessment"
      }
    ]
  },
  {
    id: "GC-14",
    label: "Reassessment — iskonto oranı da değişen birleşik (COMBINED_REASSESSMENT)",
    dimensions: ["reassessment:combined", "reassessmentType:COMBINED_REASSESSMENT", "discountRateChange"],
    reportingDates: ["2028-06-30"],
    contract: base({
      id: "GC-14",
      monthlyPayment: 160000,
      discountRate: 23,
      startDate: "2026-01-01",
      endDate: "2029-12-31"
    }),
    reassessmentInputs: [
      {
        reassessmentDate: "2027-06-01",
        effectiveDate: "2027-07-01",
        type: "COMBINED_REASSESSMENT",
        newPayment: 195000,
        newLeaseEndDate: "2031-06-30",
        newDiscountRate: 29,
        reason: "Golden matrix — birleşik reassessment"
      }
    ]
  },

  /* ---------- 6) PARA BİRİMİ / FX ---------- */
  {
    id: "GC-15",
    label: "Yabancı para (EUR) kontrat — presentation TRY",
    dimensions: ["currency:foreign", "currency:EUR", "presentationConversion"],
    reportingDates: ["2026-12-31", "2027-12-31"],
    contract: base({
      id: "GC-15",
      monthlyPayment: 5000,
      discountRate: 6,
      startDate: "2026-01-01",
      endDate: "2029-12-31",
      currency: "EUR",
      functionalCurrency: "EUR",
      reportingCurrency: "TRY",
      presentationCurrency: "TRY"
    })
  },
  {
    id: "GC-16",
    label: "Yabancı para (USD) + eskalasyon — orta risk kesişimi",
    dimensions: ["currency:foreign", "currency:USD", "escalation:fixedRate"],
    reportingDates: ["2027-12-31"],
    contract: base({
      id: "GC-16",
      monthlyPayment: 8000,
      discountRate: 7,
      startDate: "2026-01-01",
      endDate: "2029-12-31",
      currency: "USD",
      functionalCurrency: "USD",
      reportingCurrency: "TRY",
      presentationCurrency: "TRY",
      leaseIncreaseType: "fixedRate",
      leaseIncreaseRate: 3,
      escalationFrequencyMonths: 12,
      escalationBase: "compound"
    })
  },

  /* ---------- 7) YÜKSEK RİSKLİ KESİŞİMLER ---------- */
  {
    id: "GC-17",
    label: "YÜKSEK RİSK: FX + endeksli eskalasyon + modification (aynı kontrat)",
    dimensions: [
      "currency:foreign",
      "escalation:index",
      "modification:single",
      "intersection:fx+index+modification"
    ],
    reportingDates: ["2027-06-30", "2028-12-31"],
    contract: base({
      id: "GC-17",
      monthlyPayment: 12000,
      discountRate: 8,
      startDate: "2026-01-01",
      endDate: "2030-12-31",
      currency: "EUR",
      functionalCurrency: "EUR",
      reportingCurrency: "TRY",
      presentationCurrency: "TRY",
      leaseIncreaseType: "index",
      leaseIncreaseRate: 4,
      escalationFrequencyMonths: 12,
      escalationBase: "compound"
    }),
    modificationInputs: [
      {
        modificationDate: "2027-02-01",
        effectiveDate: "2027-03-01",
        modificationType: "PAYMENT_INCREASE",
        newPayment: 15500,
        reason: "Golden matrix — FX+index+mod kesişimi"
      }
    ]
  },
  {
    id: "GC-18",
    label: "YÜKSEK RİSK: quarterly + eskalasyon + modification + reassessment",
    dimensions: [
      "freq:quarterly",
      "escalation:fixedRate",
      "modification:single",
      "reassessment:index",
      "intersection:quarterly+escalation+mod+reassessment"
    ],
    reportingDates: ["2027-12-31"],
    contract: base({
      id: "GC-18",
      monthlyPayment: 450000,
      discountRate: 26,
      startDate: "2026-01-01",
      endDate: "2030-12-31",
      paymentFrequency: "quarterly",
      leaseIncreaseType: "fixedRate",
      leaseIncreaseRate: 20,
      escalationFrequencyMonths: 12,
      escalationBase: "compound"
    }),
    modificationInputs: [
      {
        modificationDate: "2026-09-01",
        effectiveDate: "2026-10-01",
        modificationType: "PAYMENT_INCREASE",
        newPayment: 520000,
        reason: "Golden matrix — quarterly kesişim mod"
      }
    ],
    reassessmentInputs: [
      {
        reassessmentDate: "2028-01-01",
        effectiveDate: "2028-01-01",
        type: "INDEX_RATE_CHANGE",
        newPayment: 610000,
        reason: "Golden matrix — quarterly kesişim reassessment"
      }
    ]
  },
  {
    id: "GC-19",
    label: "YÜKSEK RİSK: advance + annual + fixedAmount eskalasyon + IDC/incentive",
    dimensions: [
      "freq:annual",
      "timing:advance",
      "escalation:fixedAmount",
      "rouComponents:initialDirectCosts",
      "rouComponents:leaseIncentives",
      "intersection:annual+advance+escalation"
    ],
    reportingDates: ["2027-12-31"],
    contract: base({
      id: "GC-19",
      monthlyPayment: 2400000,
      discountRate: 28,
      startDate: "2026-01-01",
      endDate: "2030-12-31",
      paymentFrequency: "annual",
      paymentTiming: "advance",
      leaseIncreaseType: "fixedAmount",
      fixedIncrease: 300000,
      escalationFrequencyMonths: 12,
      initialDirectCosts: 150000,
      leaseIncentives: 90000
    })
  },

  /* ---------- 8) ROU BİLEŞENLERİ / DEĞİŞKEN ÖDEME ---------- */
  {
    id: "GC-20",
    label: "Tüm ROU bileşenleri: IDC + incentive + prepayment + restorasyon",
    dimensions: [
      "rouComponents:initialDirectCosts",
      "rouComponents:leaseIncentives",
      "rouComponents:prepayments",
      "rouComponents:restorationObligation"
    ],
    reportingDates: ["2027-06-30"],
    contract: base({
      id: "GC-20",
      monthlyPayment: 110000,
      discountRate: 19,
      startDate: "2026-01-01",
      endDate: "2029-12-31",
      initialDirectCosts: 200000,
      leaseIncentives: 120000,
      prepayments: 80000,
      restorationObligation: 250000
    })
  },
  {
    id: "GC-21",
    label: "Değişken kira ödemesi (TFRS 16.53(e)) — gider olarak izlenir",
    dimensions: ["variablePayment"],
    reportingDates: ["2027-06-30"],
    contract: base({
      id: "GC-21",
      monthlyPayment: 70000,
      variablePayment: 15000,
      discountRate: 18,
      startDate: "2026-01-01",
      endDate: "2028-12-31"
    })
  },
  {
    id: "GC-22",
    label: "Mülkiyet devri + faydalı ömür üzerinden amortisman (TFRS 16.32)",
    dimensions: ["ownershipTransfer", "usefulLifeMonths"],
    reportingDates: ["2027-12-31"],
    contract: base({
      id: "GC-22",
      monthlyPayment: 95000,
      discountRate: 20,
      startDate: "2026-01-01",
      endDate: "2029-12-31",
      ownershipTransfer: true,
      usefulLifeMonths: 96
    })
  },
  {
    id: "GC-23",
    label: "Satın alma opsiyonu + faydalı ömür + termination/renewal opsiyonları",
    dimensions: ["purchaseOption", "usefulLifeMonths", "renewalOption", "terminationOption"],
    reportingDates: ["2028-06-30"],
    contract: base({
      id: "GC-23",
      monthlyPayment: 130000,
      discountRate: 22,
      startDate: "2026-01-01",
      endDate: "2030-12-31",
      purchaseOption: true,
      usefulLifeMonths: 120,
      renewalOption: true,
      terminationOption: true
    })
  },

  /* ---------- 9) İSTİSNALAR ---------- */
  {
    id: "GC-24",
    label: "İstisna: kısa vadeli kira (TFRS 16.5-8)",
    dimensions: ["exemption:shortTerm", "edge:veryShortTerm"],
    reportingDates: ["2026-06-30"],
    contract: base({
      id: "GC-24",
      monthlyPayment: 40000,
      discountRate: 18,
      startDate: "2026-01-01",
      endDate: "2026-08-31",
      shortTermLease: true
    })
  },
  {
    id: "GC-25",
    label: "İstisna: düşük değerli varlık",
    dimensions: ["exemption:lowValue"],
    reportingDates: ["2026-12-31"],
    contract: base({
      id: "GC-25",
      monthlyPayment: 3500,
      discountRate: 18,
      startDate: "2026-01-01",
      endDate: "2028-12-31",
      lowValueAsset: true
    })
  },

  /* ---------- 10) EDGE CASE'LER ---------- */
  {
    id: "GC-26",
    label: "EDGE: ay ortasında başlayan kontrat (15'i) + kısa süre (5 ay)",
    dimensions: ["edge:midMonthStart", "edge:veryShortTerm"],
    reportingDates: ["2026-04-30", "2026-06-15"],
    contract: base({
      id: "GC-26",
      monthlyPayment: 60000,
      discountRate: 20,
      startDate: "2026-02-15",
      endDate: "2026-07-14"
    })
  },
  {
    id: "GC-27",
    label: "EDGE: reporting date TAM current/non-current geçiş sınırında",
    dimensions: ["edge:reportingBoundary"],
    // Bitişe tam 12 ay kalan tarih + 1 gün önce/sonra: current/non-current
    // ayrımının sınır davranışı bu üç tarihte dondurulur.
    reportingDates: ["2027-12-30", "2027-12-31", "2028-01-01"],
    contract: base({
      id: "GC-27",
      monthlyPayment: 85000,
      discountRate: 18,
      startDate: "2026-01-01",
      endDate: "2028-12-31"
    })
  },
  {
    id: "GC-28",
    label: "EDGE: ileri tarihli (future-dated) kontrat — henüz başlamamış",
    dimensions: ["edge:futureDated"],
    reportingDates: ["2026-12-31", "2029-06-30"],
    contract: base({
      id: "GC-28",
      monthlyPayment: 145000,
      discountRate: 21,
      startDate: "2029-01-01",
      endDate: "2032-12-31"
    })
  },
  {
    id: "GC-29",
    label: "EDGE: sona ermiş (expired) kontrat — raporlama tarihi bitişten sonra",
    dimensions: ["edge:expired", "status:expired"],
    reportingDates: ["2027-06-30"],
    contract: base({
      id: "GC-29",
      monthlyPayment: 55000,
      discountRate: 16,
      startDate: "2024-01-01",
      endDate: "2025-12-31",
      status: "expired"
    })
  },
  {
    id: "GC-30",
    label: "EDGE: feshedilmiş (terminated) kontrat",
    dimensions: ["edge:terminated", "status:terminated"],
    reportingDates: ["2027-06-30"],
    contract: base({
      id: "GC-30",
      monthlyPayment: 190000,
      discountRate: 24,
      startDate: "2026-01-01",
      endDate: "2029-12-31",
      status: "terminated",
      terminationDate: "2027-03-31"
    })
  }
];

/** Matrisin kapsaması ZORUNLU boyutlar (matrix-coverage.test.js bunu denetler). */
const REQUIRED_DIMENSIONS = [
  "freq:monthly",
  "freq:quarterly",
  "freq:annual",
  "timing:arrears",
  "timing:advance",
  "escalation:none",
  "escalation:fixedRate",
  "escalation:fixedAmount",
  "escalation:index",
  "escalationBase:compound",
  "escalationBase:initial",
  "modification:single",
  "modification:chained",
  "reassessment:index",
  "reassessment:term",
  "currency:TRY",
  "currency:foreign",
  "presentationConversion",
  "exemption:shortTerm",
  "exemption:lowValue",
  "variablePayment",
  "usefulLifeMonths",
  "edge:midMonthStart",
  "edge:reportingBoundary",
  "edge:futureDated",
  "edge:expired",
  "edge:terminated",
  "edge:veryShortTerm"
];

module.exports = { CONTRACT_MATRIX, REQUIRED_DIMENSIONS };
