/**
 * ============================================================
 * FAZ 0.1 — SLB (Sale & Leaseback) ve SUBLEASE FIXTURE'LARI
 * ============================================================
 *
 * Refaktör planı Faz 0.1 matrisi "SLB: en az 1 kontrat" ve
 * "Sublease: en az 1 kontrat" gerektiriyor.
 *
 * ÖNEMLİ TESPİT: SLB ve sublease bu kod tabanında kontrat üzerinde
 * BİR BAYRAK DEĞİL — calculateSaleAndLeaseback(input) ve
 * calculateSublease(input) fonksiyonlarına verilen AYRI girdi
 * objeleridir. Bu yüzden kontrat matrisine bir "SLB kontratı"
 * eklemek yanıltıcı olurdu; bu iki senaryo golden-output'ta kendi
 * bölümlerinde dondurulur.
 *
 * Salt veri — hiçbir yan etkisi yoktur.
 */

"use strict";

const SLB_CASES = [
  {
    id: "SLB-01",
    label: "Devir SATIŞ SAYILIYOR — satış bedeli = gerçeğe uygun değer",
    input: {
      qualifiesAsSale: true,
      previousCarryingAmount: 4000000,
      fairValueOfAsset: 6000000,
      saleProceeds: 6000000,
      leasebackContract: {
        id: "SLB-01-LB",
        company: "Golden Test A.Ş.",
        companyId: "GC-COMPANY-1",
        supplier: "SLB Karşı Taraf",
        monthlyPayment: 90000,
        discountRate: 20,
        startDate: "2026-01-01",
        endDate: "2030-12-31",
        currency: "TRY",
        paymentFrequency: "monthly",
        paymentTiming: "arrears",
        status: "active"
      }
    }
  },
  {
    id: "SLB-02",
    label: "Devir SATIŞ SAYILMIYOR (TFRS 16.103) — finansal borç olarak izlenir",
    input: {
      qualifiesAsSale: false,
      previousCarryingAmount: 3000000,
      fairValueOfAsset: 3500000,
      saleProceeds: 3200000,
      leasebackContract: {
        id: "SLB-02-LB",
        company: "Golden Test A.Ş.",
        companyId: "GC-COMPANY-1",
        supplier: "SLB Karşı Taraf",
        monthlyPayment: 70000,
        discountRate: 24,
        startDate: "2026-01-01",
        endDate: "2029-12-31",
        currency: "TRY",
        paymentFrequency: "monthly",
        paymentTiming: "arrears",
        status: "active"
      }
    }
  },
  {
    id: "SLB-03",
    label: "Satış bedeli GUD'un ALTINDA — ek finansman/ön ödeme ayrımı",
    input: {
      qualifiesAsSale: true,
      previousCarryingAmount: 2500000,
      fairValueOfAsset: 5000000,
      saleProceeds: 4200000,
      leasebackContract: {
        id: "SLB-03-LB",
        company: "Golden Test A.Ş.",
        companyId: "GC-COMPANY-1",
        supplier: "SLB Karşı Taraf",
        monthlyPayment: 65000,
        discountRate: 18,
        startDate: "2026-01-01",
        endDate: "2031-12-31",
        currency: "TRY",
        paymentFrequency: "monthly",
        paymentTiming: "arrears",
        status: "active"
      }
    }
  }
];

const HEAD_LEASE = {
  id: "SUB-HEAD",
  company: "Golden Test A.Ş.",
  companyId: "GC-COMPANY-1",
  supplier: "Ana Kiraya Veren",
  monthlyPayment: 150000,
  discountRate: 20,
  startDate: "2026-01-01",
  endDate: "2031-12-31",
  currency: "TRY",
  paymentFrequency: "monthly",
  paymentTiming: "arrears",
  status: "active"
};

const SUBLEASE_CASES = [
  {
    id: "SUB-01",
    label: "OPERATING alt kiralama (TFRS 16.B58) — doğrusal gelir",
    input: {
      classification: "OPERATING",
      rouAllocationRatio: 1,
      headLeaseContract: HEAD_LEASE,
      subleaseContract: {
        id: "SUB-01-SUB",
        company: "Golden Test A.Ş.",
        companyId: "GC-COMPANY-1",
        supplier: "Alt Kiracı",
        monthlyPayment: 190000,
        discountRate: 20,
        startDate: "2027-01-01",
        endDate: "2030-12-31",
        currency: "TRY",
        paymentFrequency: "monthly",
        paymentTiming: "arrears",
        status: "active"
      }
    }
  },
  {
    id: "SUB-02",
    label: "FINANCE alt kiralama — ROU türetilmesi + kısmi tahsis (%60)",
    input: {
      classification: "FINANCE",
      rouAllocationRatio: 0.6,
      headLeaseContract: HEAD_LEASE,
      subleaseContract: {
        id: "SUB-02-SUB",
        company: "Golden Test A.Ş.",
        companyId: "GC-COMPANY-1",
        supplier: "Alt Kiracı",
        monthlyPayment: 120000,
        discountRate: 22,
        startDate: "2027-01-01",
        endDate: "2031-12-31",
        currency: "TRY",
        paymentFrequency: "monthly",
        paymentTiming: "arrears",
        status: "active"
      }
    }
  }
];

module.exports = { SLB_CASES, SUBLEASE_CASES, HEAD_LEASE };
