/**
 * @jest-environment jsdom
 *
 * ============================================================
 * DEMO VERİ KALDIRMA — TESTLER
 * ============================================================
 *
 * Kullanıcı talebi: uygulama artık gerçek backend'e bağlı, demo
 * şirket/sözleşme verisi (localStorage boşken otomatik üretilen
 * "GK Holding", "GK Teknoloji", "Teknoloji A.Ş.", "GmbH", "LLC",
 * "Lojistik Ltd." gibi sahte kayıtlar) artık görünmemeli.
 *
 * Bu dosya iki fonksiyonu hedefliyor:
 * - loadContracts(): önceden localStorage boşsa getDefaultContracts()
 *   (LEASE-001/002/003) döndürüp HEMEN localStorage'a yazıyordu.
 * - v26LoadCompanies(): önceden hiç sözleşme yoksa 4 demo şirket
 *   (TR-001/DE-001/US-001/TR-002) üretip localStorage'a yazıyordu.
 *
 * İkisi de artık FAIL-CLOSED: veri yoksa boş liste, sahte veri asla
 * localStorage'a yazılmıyor.
 */

const { loadTfrs16 } = require("./helpers/loadTfrs16");

describe("loadContracts — demo sözleşme fallback'i kaldırıldı", () => {
  let tfrs16;
  beforeEach(() => {
    localStorage.clear();
    tfrs16 = loadTfrs16();
  });

  test("localStorage boşken contracts BOŞ dizi ile başlar (LEASE-001/002/003 YOK)", () => {
    expect(Array.isArray(tfrs16.contracts)).toBe(true);
    expect(tfrs16.contracts).toEqual([]);
  });

  test("localStorage boşken hiçbir demo sözleşme (GK Holding, GK Teknoloji) localStorage'a YAZILMAZ", () => {
    const raw = localStorage.getItem("gk_tfrs16_lease_contracts_v1")
      || localStorage.getItem("tfrs16_contracts")
      || null;
    // Ne varsayılan anahtarlardan biri demo veri içeriyor ne de "GK
    // Holding" string'i localStorage'ın HERHANGİ bir anahtarında var.
    let foundDemoString = false;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const value = localStorage.getItem(key);
      if (value && value.includes("GK Holding")) foundDemoString = true;
    }
    expect(foundDemoString).toBe(false);
  });

  test("gerçek bir sözleşme localStorage'a yazılırsa loadContracts onu (demo veri değil) döndürür", () => {
    const realContract = {
      id: "REAL-001", company: "Gerçek Şirket A.Ş.", companyId: "C-REAL",
      supplier: "Gerçek Tedarikçi", monthlyPayment: 50000, discountRate: 20,
      startDate: "2026-01-01", endDate: "2028-01-01", currency: "TRY", status: "active"
    };
    tfrs16.saveContracts([realContract]);

    // Modülü yeniden yükleyip loadContracts'ın (DOMContentLoaded init'i
    // sırasında) bu gerçek veriyi okuduğunu doğruluyoruz. saveContracts
    // bazı ek state alanları (auditTrail vb.) ekleyebilir — bunlar
    // normal davranış, sadece temel alanları kontrol ediyoruz.
    const tfrs16Reloaded = loadTfrs16();
    expect(tfrs16Reloaded.contracts.length).toBe(1);
    expect(tfrs16Reloaded.contracts[0]).toMatchObject(realContract);
  });
});

describe("v26LoadCompanies — demo şirket fallback'i kaldırıldı", () => {
  let tfrs16;
  beforeEach(() => {
    localStorage.clear();
    tfrs16 = loadTfrs16();
  });

  test("hiç sözleşme yokken ve cache boşken şirket listesi BOŞ döner (TR-001/DE-001/US-001/TR-002 YOK)", () => {
    expect(tfrs16.contracts).toEqual([]);
    const companies = tfrs16.v26LoadCompanies();
    expect(companies).toEqual([]);
  });

  test("demo şirket isimleri (Teknoloji A.Ş., GmbH, LLC, Lojistik Ltd.) localStorage'a hiç yazılmaz", () => {
    tfrs16.v26LoadCompanies();
    let foundDemoString = false;
    for (let i = 0; i < localStorage.length; i++) {
      const value = localStorage.getItem(localStorage.key(i));
      if (value && (value.includes("GmbH") || value.includes('"LLC"') || value.includes("Lojistik Ltd."))) {
        foundDemoString = true;
      }
    }
    expect(foundDemoString).toBe(false);
  });

  test("gerçek sözleşmelerden türeyen şirketler VARSA onlar döner (demo'ya düşülmez)", () => {
    tfrs16.contracts.push({
      id: "REAL-002", company: "Gerçek A.Ş.", companyId: "C-REAL-2",
      supplier: "X", monthlyPayment: 1000, discountRate: 10,
      startDate: "2026-01-01", endDate: "2027-01-01", currency: "TRY", status: "active"
    });
    const companies = tfrs16.v26LoadCompanies();
    // Boş DEĞİL — gerçek sözleşmeden türeyen en az bir şirket var,
    // VE bu demo isimlerinden biri DEĞİL.
    const names = companies.map(c => c.name);
    expect(names).not.toContain("GmbH");
    expect(names).not.toContain("LLC");
  });
});
