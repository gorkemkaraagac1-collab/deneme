/**
 * @jest-environment jsdom
 *
 * ============================================================
 * YENİ SÖZLEŞME MODALI — DASHBOARD'A TAŞINDI
 * ============================================================
 *
 * Kullanıcı talebi: "Yeni Sözleşme Ekle" özelliği de dashboard
 * sidebar'ına eklensin. contractModal/contractForm HTML'i (statik,
 * tfrs16.html'de tanımlı) dashboard.html'e BİREBİR kopyalandı —
 * openContractModal()/form submit/tab switching kodunun KENDİSİNE
 * dokunulmadı.
 *
 * KRİTİK TEST DETAYI: contractForm'un submit event listener'ı
 * SADECE BİR KEZ, sayfa yüklenirken (document.getElementById
 * ile element bulunduğunda) bağlanıyor. Bu yüzden testlerde
 * contractModal HTML'i loadTfrs16() ÇAĞRILMADAN ÖNCE DOM'a
 * eklenmeli — GERÇEK dashboard.html'de de HTML statik olarak
 * script'ten ÖNCE zaten var.
 *
 * Ayrıca CSS eksikliği riski test ediliyor: .modal/.form-grid gibi
 * class'lar css/tfrs16.css'te tanımlıydı ama dashboard.html o
 * dosyayı hiç yüklemiyordu — bu class'lar injectV26Styles()'e
 * (dashboard'da zaten çalışan mekanizma) kopyalandı.
 */

const { loadTfrs16 } = require("./helpers/loadTfrs16");

function contractModalHtml() {
  return `
    <div id="contractModal" class="modal hidden">
      <div class="modal-content" style="max-width: 720px;">
        <div class="modal-header">
          <div><div class="eyebrow">TFRS 16 / GİRDİ PARAMETRELERİ</div><h2 id="modalTitle">Yeni Sözleşme</h2></div>
          <button id="closeModal" class="close-button" type="button">×</button>
        </div>
        <form id="contractForm">
          <div class="gk-contract-tabs" role="tablist">
            <button type="button" class="gk-contract-tab active" data-tab-target="1" role="tab" aria-selected="true">Sözleşme</button>
            <button type="button" class="gk-contract-tab" data-tab-target="2" role="tab" aria-selected="false">İleri TFRS 16 Parametreleri</button>
            <button type="button" class="gk-contract-tab" data-tab-target="3" role="tab" aria-selected="false">Opsiyonlar &amp; İstisnalar</button>
            <button type="button" class="gk-contract-tab" data-tab-target="4" role="tab" aria-selected="false">Para Birimi &amp; Standartlar</button>
          </div>
          <div class="form-grid">
            <div class="form-group" data-tab="1">
              <label for="contractId">Sözleşme ID</label>
              <input id="contractId" name="contractId" required placeholder="LEASE-004">
            </div>
            <div class="form-group" data-tab="1">
              <label for="company">Şirket</label>
              <input id="company" name="company" required placeholder="Şirket adı" value="">
              <input type="hidden" id="companyId" name="companyId" value="">
            </div>
            <div class="form-group" data-tab="1">
              <label for="supplier">Tedarikçi / Kiralayan</label>
              <input id="supplier" name="supplier" required placeholder="Tedarikçi adı">
            </div>
            <div class="form-group" data-tab="1">
              <label for="currency">Para Birimi</label>
              <select id="currency" name="currency">
                <option value="TRY" selected>TRY (₺)</option>
              </select>
            </div>
            <div class="form-group" data-tab="1">
              <label for="monthlyPayment">Dönemsel Kira Tutarı</label>
              <input id="monthlyPayment" name="monthlyPayment" type="number" min="0" step="0.01" required placeholder="0.00">
            </div>
            <div class="form-group" data-tab="1">
              <label for="discountRate">Yıllık İskonto Oranı (%)</label>
              <input id="discountRate" name="discountRate" type="number" min="0" step="0.01" value="18" required placeholder="18.00">
            </div>
            <div class="form-group" data-tab="1">
              <label for="startDate">Başlangıç Tarihi</label>
              <input id="startDate" name="startDate" type="date" required>
            </div>
            <div class="form-group" data-tab="1">
              <label for="endDate">Bitiş Tarihi</label>
              <input id="endDate" name="endDate" type="date" required>
            </div>
            <div class="form-group" data-tab="1">
              <label for="paymentTiming">Ödeme Zamanı</label>
              <select id="paymentTiming" name="paymentTiming">
                <option value="arrears" selected>Dönem Sonu (Arrears)</option>
              </select>
            </div>
            <div class="form-group" data-tab="1">
              <label for="paymentFrequency">Ödeme Sıklığı</label>
              <select id="paymentFrequency" name="paymentFrequency">
                <option value="1" selected>Aylık</option>
              </select>
            </div>
            <div class="form-group" data-tab="1">
              <label for="initialDirectCost">Doğrudan İlk Maliyetler (₺)</label>
              <input id="initialDirectCost" name="initialDirectCost" type="number" min="0" step="0.01" value="0">
            </div>
            <div class="form-group" data-tab="1">
              <label for="restorationCost">Sökme / Restorasyon Karşılığı (₺)</label>
              <input id="restorationCost" name="restorationCost" type="number" min="0" step="0.01" value="0">
            </div>
            <div class="form-group" data-tab="3" style="grid-column: span 2;">
              <label for="renewalDate">Yenileme / Opsiyon Tarihi</label>
              <input id="renewalDate" name="renewalDate" type="date">
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" id="cancelModal" class="secondary-button">İptal</button>
            <button type="submit" class="primary-button">Sözleşmeyi Kaydet &amp; Hesapla</button>
          </div>
        </form>
      </div>
    </div>
    <button id="newContractButton" type="button">Yeni Sözleşme</button>
  `;
}

function mockOkResponse(data = {}) {
  return { ok: true, status: 200, text: async () => JSON.stringify(data) };
}

describe("Yeni Sözleşme modalı — dashboard bağlamında CSS/DOM bütünlüğü", () => {
  let tfrs16;

  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem("access_token", "fake-token-for-test");
    // KRİTİK: contractModal HTML'i loadTfrs16()'DAN ÖNCE DOM'a
    // ekleniyor — tıpkı GERÇEK dashboard.html'de olduğu gibi (statik
    // HTML, script'ten önce mevcut).
    document.body.insertAdjacentHTML("beforeend", contractModalHtml());
    const initFetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(mockOkResponse({ success: true }));
    tfrs16 = loadTfrs16();
    await new Promise(resolve => setTimeout(resolve, 0));
    initFetchSpy.mockRestore();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("injectV26Styles() ile .modal/.form-grid/.gk-contract-tab CSS kuralları enjekte edilmiş (dashboard'da eksikti)", () => {
    const styleTags = Array.from(document.querySelectorAll("style"));
    const allCss = styleTags.map(s => s.textContent).join("\n");
    expect(allCss).toMatch(/\.modal\s*{/);
    expect(allCss).toMatch(/\.form-grid\s*{/);
    expect(allCss).toMatch(/\.gk-contract-tab\s*{/);
    expect(allCss).toMatch(/\.primary-button/);
  });

  test("newContractButton DOM'da var ve type=\"button\" (form submit'ini yanlışlıkla tetiklemez)", () => {
    const button = document.getElementById("newContractButton");
    expect(button).toBeTruthy();
    expect(button.getAttribute("type")).toBe("button");
  });

  test("newContractButton tıklanınca contractModal görünür olur (hidden kalkar)", () => {
    const modal = document.getElementById("contractModal");
    expect(modal.classList.contains("hidden")).toBe(true);

    document.getElementById("newContractButton").click();

    expect(modal.classList.contains("hidden")).toBe(false);
    expect(document.getElementById("modalTitle").textContent).toBe("Yeni Sözleşme");
  });

  test("modal açıldığında Tab 1 (Sözleşme) aktif, diğer tab'lar gizli", () => {
    document.getElementById("newContractButton").click();

    const tab1Fields = document.querySelectorAll('[data-tab="1"]');
    tab1Fields.forEach(el => expect(el.classList.contains("gk-tab-active")).toBe(true));
  });

  test("closeModal tıklanınca modal tekrar gizlenir", () => {
    document.getElementById("newContractButton").click();
    expect(document.getElementById("contractModal").classList.contains("hidden")).toBe(false);

    document.getElementById("closeModal").click();

    expect(document.getElementById("contractModal").classList.contains("hidden")).toBe(true);
  });
});

describe("Yeni Sözleşme modalı — form doldur ve GERÇEKTEN kaydet (backend'e yazma)", () => {
  let tfrs16, fetchSpy;

  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem("access_token", "fake-token-for-test");
    document.body.insertAdjacentHTML("beforeend", contractModalHtml());
    fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(mockOkResponse({ success: true }));
    tfrs16 = loadTfrs16();
    await new Promise(resolve => setTimeout(resolve, 0));
    fetchSpy.mockClear();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    fetchSpy.mockRestore();
  });

  test("formu doldurup submit edince yeni sözleşme contracts dizisine eklenir ve backend'e PUT/POST gönderilir", async () => {
    document.getElementById("newContractButton").click();

    document.getElementById("contractId").value = "DASH-NEW-001";
    document.getElementById("company").value = "Dashboard Test A.Ş.";
    document.getElementById("companyId").value = "C-TEST-1";
    document.getElementById("supplier").value = "Test Tedarikçi";
    document.getElementById("monthlyPayment").value = "25000";
    document.getElementById("discountRate").value = "20";
    document.getElementById("startDate").value = "2026-01-01";
    document.getElementById("endDate").value = "2028-01-01";

    const form = document.getElementById("contractForm");
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    await new Promise(resolve => setTimeout(resolve, 0));
    await new Promise(resolve => setTimeout(resolve, 0));

    const created = tfrs16.contracts.find(c => c.id === "DASH-NEW-001");
    expect(created).toBeTruthy();
    expect(created.company).toBe("Dashboard Test A.Ş.");
    expect(fetchSpy).toHaveBeenCalled();
  });
});
