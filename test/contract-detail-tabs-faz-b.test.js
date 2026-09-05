/**
 * @jest-environment jsdom
 *
 * ============================================================
 * FAZ B — SÖZLEŞME DETAYI TAB KONSOLİDASYONU
 * ============================================================
 *
 * ÇÖZÜLEN ASIL SORUN: Modifikasyon & Reassessment / SLB / Alt
 * Kiralama / Toplu Fiş, önceki fazlarda sidebar'a AYRI SAYFALAR
 * olarak taşınmıştı ve her birinin KENDİ, senkronize olmayan
 * sözleşme seçici state'i vardı (v26SelectedModReassContractId,
 * v26SelectedSlbContractId, v26SelectedSubleaseContractId,
 * v26SelectedAccountingContractId). Kullanıcı Modifikasyon'da bir
 * sözleşme seçip SLB'ye geçince seçim KAYBOLUYORDU.
 *
 * Faz B: bu bölümler sözleşme detay ekranına TAB olarak geri
 * getirildi. Artık TEK sözleşme seçimi (openDetail'in id'si) tüm
 * tab'lar için geçerli. Render/iş mantığı fonksiyonlarının
 * KENDİSİNE dokunulmadı — yalnızca nerede render edildikleri ve
 * event wiring değişti.
 */

const { loadTfrs16 } = require("./helpers/loadTfrs16");

function flushPromises() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

function detailModalHtml() {
  return `
    <div id="detailModal" class="modal hidden">
      <div class="modal-content detail-modal">
        <div class="modal-header">
          <h2 id="detailTitle">-</h2>
          <button id="closeDetailModal" class="close-button" type="button">×</button>
        </div>
        <div id="detailContent" class="detail-content"></div>
        <div id="scheduleTableContainer" class="table-wrapper"></div>
        <div class="detail-actions">
          <button id="deleteContract" class="danger-button" type="button">Sözleşmeyi Sil</button>
          <button id="detailCloseButton" class="secondary-button" type="button">Kapat</button>
        </div>
      </div>
    </div>
  `;
}

function seedContract(overrides = {}) {
  return {
    id: "FAZB-" + Math.random().toString(36).slice(2),
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

async function setup() {
  localStorage.clear();
  localStorage.setItem("access_token", "fake-token-for-test");
  document.body.insertAdjacentHTML("beforeend", detailModalHtml());
  const spy = jest.spyOn(global, "fetch").mockResolvedValue({
    ok: true, status: 200, text: async () => JSON.stringify({ success: true })
  });
  const tfrs16 = loadTfrs16();
  await flushPromises();
  spy.mockRestore();
  return tfrs16;
}

describe("openDetail — tab yapısı", () => {
  let tfrs16, contract;

  beforeEach(async () => {
    tfrs16 = await setup();
    contract = seedContract();
    tfrs16.contracts.push(contract);
  });

  afterEach(() => { document.body.innerHTML = ""; });

  test("yedi tab butonu da render edilir", async () => {
    tfrs16.openDetail(contract.id);
    await flushPromises();

    const btns = document.querySelectorAll("#detailContent .gk-detail-tab-btn");
    const targets = Array.from(btns).map(b => b.dataset.detailTabTarget);
    expect(targets).toEqual([
      "summary", "schedule", "modification", "slb", "sublease", "accounting", "audit"
    ]);
  });

  test("varsayılan olarak 'Özet' tab'ı aktif, diğerleri gizli", async () => {
    tfrs16.openDetail(contract.id);
    await flushPromises();

    const active = document.querySelectorAll("#detailContent .gk-detail-tab.gk-detail-tab-active");
    expect(active.length).toBe(1);
    expect(active[0].dataset.detailTab).toBe("summary");
  });

  test("Modifikasyon tab'ına tıklanınca o panel aktif olur, Özet gizlenir", async () => {
    tfrs16.openDetail(contract.id);
    await flushPromises();

    document.querySelector('[data-detail-tab-target="modification"]').click();

    const active = document.querySelectorAll("#detailContent .gk-detail-tab.gk-detail-tab-active");
    expect(active.length).toBe(1);
    expect(active[0].dataset.detailTab).toBe("modification");
  });

  test("her tab için karşılık gelen panel DOM'da mevcut", async () => {
    tfrs16.openDetail(contract.id);
    await flushPromises();

    const panels = document.querySelectorAll("#detailContent .gk-detail-tab");
    const keys = Array.from(panels).map(p => p.dataset.detailTab);
    expect(keys).toEqual([
      "summary", "schedule", "modification", "slb", "sublease", "accounting", "audit"
    ]);
  });
});

describe("FAZ B ASIL AMACI — tek sözleşme seçimi, tüm tab'lar için geçerli", () => {
  let tfrs16, contract;

  beforeEach(async () => {
    tfrs16 = await setup();
    contract = seedContract({ id: "FAZB-SINGLE-1", company: "Tek Şirket A.Ş." });
    tfrs16.contracts.push(contract);
  });

  afterEach(() => { document.body.innerHTML = ""; });

  test("SLB ve Sublease bölümleri, AYRI bir sözleşme seçici OLMADAN, openDetail'in sözleşmesiyle render edilir", async () => {
    tfrs16.openDetail(contract.id);
    await flushPromises();

    // Bu container'lar detay modalının İÇİNDE (tab panellerinde).
    const slbPanel = document.querySelector('[data-detail-tab="slb"]');
    const subleasePanel = document.querySelector('[data-detail-tab="sublease"]');
    expect(slbPanel.querySelector("#slbSectionContainer")).toBeTruthy();
    expect(subleasePanel.querySelector("#subleaseSectionContainer")).toBeTruthy();

    // İçerikleri gerçekten dolmuş (renderSlbSection/renderSubleaseSection
    // çalışmış) olmalı.
    expect(slbPanel.innerHTML).toMatch(/SATIŞ VE GERİ KİRALAMA|Gerçeğe Uygun Değer/);
    expect(subleasePanel.innerHTML).toMatch(/ALT KİRALAMA|Alt Kiralama/);
  });

  test("detay modalının İÇİNDE hiçbir ek sözleşme seçici (<select>) YOK — tek seçim openDetail'den geliyor", async () => {
    tfrs16.openDetail(contract.id);
    await flushPromises();

    // Faz öncesi ayrı sayfalarda bulunan seçicilerin ID'leri burada
    // OLMAMALI (her biri kendi sözleşmesini seçtiriyordu).
    expect(document.getElementById("v26ModReassContractSelect")).toBeNull();
    expect(document.getElementById("v26SlbContractSelect")).toBeNull();
    expect(document.getElementById("v26SubleaseContractSelect")).toBeNull();
    expect(document.getElementById("v26AccountingContractSelect")).toBeNull();
  });

  test("Fişler tab'ı, aynı sözleşme için Muhasebe Fiş Merkezi'ni içeriyor", async () => {
    tfrs16.openDetail(contract.id);
    await flushPromises();

    const panel = document.querySelector('[data-detail-tab="accounting"]');
    expect(panel.innerHTML).toMatch(/Muhasebe Fiş Merkezi/);
    expect(panel.querySelector("#generateJournal")).toBeTruthy();
  });

  test("Modifikasyon tab'ı, aynı sözleşme için hem Modifikasyon hem Reassessment bölümlerini içeriyor", async () => {
    tfrs16.openDetail(contract.id);
    await flushPromises();

    const panel = document.querySelector('[data-detail-tab="modification"]');
    expect(panel.querySelector("#createModificationButton")).toBeTruthy();
    expect(panel.querySelector("#createReassessmentButton")).toBeTruthy();
  });
});

describe("Tab state korunması — kayıt sonrası aynı tab'da kalınır", () => {
  let tfrs16, contract;

  beforeEach(async () => {
    tfrs16 = await setup();
    contract = seedContract();
    tfrs16.contracts.push(contract);
  });

  afterEach(() => { document.body.innerHTML = ""; });

  test("bir tab seçiliyken openDetail tekrar çağrılırsa (kayıt sonrası) O TAB aktif kalır, Özet'e fırlamaz", async () => {
    tfrs16.openDetail(contract.id);
    await flushPromises();

    document.querySelector('[data-detail-tab-target="slb"]').click();
    expect(document.querySelector(".gk-detail-tab-active").dataset.detailTab).toBe("slb");

    // Kayıt sonrası yeniden render (onChanged callback'i bunu yapıyor).
    tfrs16.openDetail(contract.id);
    await flushPromises();

    expect(document.querySelector(".gk-detail-tab-active").dataset.detailTab).toBe("slb");
  });
});

describe("Contract Financial Tools — Audit Trail rapor uyumluluğu", () => {
  let tfrs16, contract;

  beforeEach(async () => {
    tfrs16 = await setup();
    contract = seedContract({ id: "FAZB-AUDIT-1" });
    tfrs16.contracts.push(contract);
  });

  afterEach(() => { document.body.innerHTML = ""; });

  test("getAuditTrailReport nesne döndürdüğünde rows dizisini kullanır ve audit.slice hatası vermez", async () => {
    tfrs16.openDetail(contract.id);
    await flushPromises();

    expect(() => tfrs16.v191RenderContractTools()).not.toThrow();
    expect(tfrs16.v191RenderContractTools()).toMatch(/Audit Trail/);
  });
});

describe("dashboard.html — üç sayfa sidebar'dan kaldırıldı", () => {
  test("modification/slb/sublease linkleri sidebar'da YOK (artık sözleşme detayında)", () => {
    const fs = require("fs");
    const path = require("path");
    const html = fs.readFileSync(path.join(__dirname, "../frontend/dashboard.html"), "utf-8");
    const nav = html.match(/<nav class="side-nav">[\s\S]*?<\/nav>/)[0];

    expect(nav).not.toMatch(/data-v26-open="modification"/);
    expect(nav).not.toMatch(/data-v26-open="slb"/);
    expect(nav).not.toMatch(/data-v26-open="sublease"/);
  });

  test("portföy geneli olan Toplu Fiş Merkezi sidebar'da KALDI (tek sözleşmeye bağlı değil)", () => {
    const fs = require("fs");
    const path = require("path");
    const html = fs.readFileSync(path.join(__dirname, "../frontend/dashboard.html"), "utf-8");
    const nav = html.match(/<nav class="side-nav">[\s\S]*?<\/nav>/)[0];
    expect(nav).toMatch(/data-v26-open="accountingCenter"/);
  });

  test("deep-link fonksiyonları SİLİNMEDİ (eski ?open=modification linkleri kırılmasın)", async () => {
    const tfrs16 = await setup();
    expect(typeof tfrs16.renderModificationReassessmentPage).toBe("function");
    expect(typeof tfrs16.renderSlbManagementPage).toBe("function");
    expect(typeof tfrs16.renderSubleaseManagementPage).toBe("function");
    document.body.innerHTML = "";
  });
});
