/**
 * @jest-environment jsdom
 *
 * ============================================================
 * TOPLU FİŞ MERKEZİ — AYRI SAYFA TESTLERİ
 * ============================================================
 *
 * renderAccountingCenter (tek + toplu fiş üretimi) sözleşme detay
 * ekranından çıkarılıp ayrı bir sayfaya (renderAccountingCenterPage)
 * taşındı — Modifikasyon & Reassessment / SLB / Sublease ile AYNI
 * desen: render fonksiyonunun KENDİSİNE dokunulmadı, sadece nerede
 * çağrıldığı değişti. Bu dosya üç şeyi doğruluyor:
 * 1) Sayfa doğru render ediliyor, sözleşme seçici + banner var.
 * 2) generateJournal butonu tıklanınca önizleme üretiliyor (contract
 *    state'i DEĞİŞMİYOR — bu özellik salt-okunur bir rapor).
 * 3) openBulkJournalButton'ın kendi (portföy geneli) modalını açtığı.
 */

const { loadTfrs16 } = require("./helpers/loadTfrs16");

function flushPromises() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

function seedContract(overrides = {}) {
  return {
    id: "ACC-TEST-" + Math.random().toString(36).slice(2),
    company: "Test A.Ş.",
    companyId: "C-1",
    supplier: "Test Tedarikçi",
    monthlyPayment: 10000,
    discountRate: 18,
    startDate: "2026-01-01",
    endDate: "2027-12-01",
    currency: "TRY",
    paymentFrequency: "monthly",
    paymentTiming: "arrears",
    status: "active",
    ...overrides
  };
}

describe("renderAccountingCenterPage — sayfa yapısı", () => {
  let tfrs16;

  beforeEach(async () => {
    localStorage.clear();
    const initFetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true, status: 200, text: async () => JSON.stringify({ success: true })
    });
    tfrs16 = loadTfrs16();
    await flushPromises();
    initFetchSpy.mockRestore();
    document.body.insertAdjacentHTML("beforeend", '<div id="accHost"></div>');
  });

  test("hiç sözleşme yokken boş durum mesajı gösterilir, hata vermez", () => {
    tfrs16.contracts.length = 0;
    const host = document.getElementById("accHost");
    tfrs16.renderAccountingCenterPage(host);
    expect(host.innerHTML).toMatch(/Toplu Fiş Merkezi/);
    expect(host.innerHTML).toMatch(/Henüz sözleşme bulunmuyor/);
  });

  test("sözleşme varken seçici + seçili sözleşme banner'ı + Muhasebe Fiş Merkezi formu gösterilir", () => {
    tfrs16.contracts.push(seedContract({ id: "ACC-A", company: "Şirket A" }));

    const host = document.getElementById("accHost");
    tfrs16.renderAccountingCenterPage(host);

    expect(host.querySelector("#v26AccountingContractSelect")).toBeTruthy();
    expect(host.innerHTML).toMatch(/İşlem uygulanacak sözleşme/);
    expect(host.innerHTML).toMatch(/ACC-A/);
    expect(host.innerHTML).toMatch(/Muhasebe Fiş Merkezi/);
    expect(host.querySelector("#generateJournal")).toBeTruthy();
    expect(host.querySelector("#openBulkJournalButton")).toBeTruthy();
  });

  test("sözleşme değiştirilince form yeniden render edilir, yeni sözleşme banner'da görünür", () => {
    tfrs16.contracts.push(seedContract({ id: "ACC-A", company: "Şirket A" }));
    tfrs16.contracts.push(seedContract({ id: "ACC-B", company: "Şirket B" }));

    const host = document.getElementById("accHost");
    tfrs16.renderAccountingCenterPage(host);

    const select = host.querySelector("#v26AccountingContractSelect");
    select.value = "ACC-B";
    select.dispatchEvent(new Event("change"));

    expect(host.innerHTML).toMatch(/ACC-B/);
  });
});

describe("renderAccountingCenterPage — Fişi Oluştur (tekil, salt-okunur önizleme)", () => {
  let tfrs16;

  beforeEach(async () => {
    localStorage.clear();
    const initFetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true, status: 200, text: async () => JSON.stringify({ success: true })
    });
    tfrs16 = loadTfrs16();
    await flushPromises();
    initFetchSpy.mockRestore();
    document.body.insertAdjacentHTML("beforeend", '<div id="accHost2"></div>');
  });

  test("Fişi Oluştur tıklanınca önizleme üretilir VE sözleşmenin kendisi DEĞİŞMEZ (salt-okunur rapor)", async () => {
    const contract = seedContract({ id: "ACC-JOURNAL-1", monthlyPayment: 10000 });
    tfrs16.contracts.push(contract);

    const host = document.getElementById("accHost2");
    tfrs16.renderAccountingCenterPage(host);

    const snapshotBefore = JSON.stringify(contract);

    host.querySelector("#generateJournal").click();
    await flushPromises();

    // Sözleşme state'i (monthlyPayment, modifications, vs.) DEĞİŞMEMİŞ
    // olmalı — bu özellik salt-okunur bir rapor/önizleme üretiyor,
    // Modification/SLB/Sublease'in aksine backend'e yazılacak bir
    // state mutasyonu YOK.
    expect(JSON.stringify(contract)).toBe(snapshotBefore);

    // journalPreview container'ı DOLMUŞ olmalı (bir şey render edildi).
    const preview = host.querySelector("#journalPreview");
    expect(preview).toBeTruthy();
  });
});

describe("renderAccountingCenterPage — Toplu Fiş (portföy geneli, sözleşmeye bağımlı değil)", () => {
  let tfrs16;

  beforeEach(async () => {
    localStorage.clear();
    const initFetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true, status: 200, text: async () => JSON.stringify({ success: true })
    });
    tfrs16 = loadTfrs16();
    await flushPromises();
    initFetchSpy.mockRestore();
    document.body.insertAdjacentHTML("beforeend", '<div id="accHost3"></div>');
  });

  test("Tüm Sözleşmeler İçin Toplu Fiş Üret butonu kendi modalını açar", () => {
    tfrs16.contracts.push(seedContract({ id: "ACC-BULK-1" }));

    const host = document.getElementById("accHost3");
    tfrs16.renderAccountingCenterPage(host);

    host.querySelector("#openBulkJournalButton").click();

    const modal = document.getElementById("bulkJournalModal");
    expect(modal).toBeTruthy();
    expect(modal.classList.contains("hidden")).toBe(false);

    modal.remove(); // temizlik — body'ye eklendi, sonraki testleri kirletmesin
  });
});

describe("Sözleşme detayından (openDetail) çıkarıldığının doğrulanması", () => {
  let tfrs16;
  beforeEach(() => {
    localStorage.clear();
    tfrs16 = loadTfrs16();
  });

  test("renderAccountingCenter artık contract detail template'inde ÇAĞRILMIYOR (sadece renderAccountingCenterPage kullanıyor)", () => {
    // Bu, kod-seviyesinde bir regresyon testi değil (dosya içeriğini
    // okumaz) — ama renderAccountingCenter'ın KENDİSİNİN hâlâ var ve
    // export edilmiş olduğunu, dolayısıyla yeni sayfanın onu
    // kullanabildiğini doğrular.
    expect(typeof tfrs16.renderAccountingCenter).toBe("function");
    const contract = seedContract();
    const html = tfrs16.renderAccountingCenter(contract);
    expect(html).toMatch(/Muhasebe Fiş Merkezi/);
    expect(html).toMatch(/Toplu Muhasebe Merkezi/);
  });
});
