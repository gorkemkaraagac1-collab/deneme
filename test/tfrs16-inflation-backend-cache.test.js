/**
 * ============================================================
 * TMS 29 ENGINE REGRESSION + loadInflationIndexTable FALLBACK
 * ============================================================
 *
 * AMAÇ: getInflationIndex()/getInflationRatio()/
 * applyTMS29Restatement() zincirinin davranışının, backend/TÜİK
 * entegrasyonu eklendikten SONRA da (bu değişiklikten ÖNCEKİYLE
 * BİREBİR AYNI) çalıştığını doğrulamak — bu, brief'in "en kritik
 * nokta" olarak belirttiği regresyon kontrolüdür.
 *
 * Bu test dosyası her zaman jsdom + jest ortamında, backend'e
 * gerçek bir fetch YAPMADAN çalışır (aşağıdaki testlerde
 * global.fetch kasıtlı olarak tanımsız/mock'suz bırakılıyor —
 * bu da tam olarak "backend henüz sorulmadı" senaryosunu temsil
 * ediyor ve loadInflationIndexTable()'ın localStorage'a geri
 * düşme davranışını sınıyor).
 */

const { loadTfrs16 } = require("./helpers/loadTfrs16");

describe("loadInflationIndexTable — backend cache boşken BOŞ döner (fail-closed, localStorage'a DÜŞMEZ)", () => {
  let tfrs16;

  beforeEach(() => {
    localStorage.clear();
    tfrs16 = loadTfrs16();
  });

  test("backend hiç sorulmadıysa (varsayılan durum) boş dizi döner — localStorage'daki manuel tablo ARTIK KULLANILMAZ", () => {
    // Bu tablo artık admin kontrolü olmayan bir formdan yazılamıyor
    // (renderInflationIndexManagementPage kapatıldı), ama eski/kalıntı
    // bir localStorage verisi olsa bile hesaplamaya asla karışmamalı —
    // bu testin asıl amacı budur.
    localStorage.setItem("gk_tfrs16_inflation_index_v1", JSON.stringify([
      { month: "2025-01", index: 9999 }
    ]));

    const table = tfrs16.loadInflationIndexTable();
    expect(table).toEqual([]);
  });

  test("getInflationIndex hâlâ eksik ay için Error fırlatır (sessiz varsayılan YOK)", () => {
    expect(() => tfrs16.getInflationIndex("2099-01")).toThrow();
  });
});

describe("refreshInflationIndexCacheFromBackend — auth token yoksa güvenle geri düşer", () => {
  let tfrs16;

  beforeEach(() => {
    localStorage.clear();
    tfrs16 = loadTfrs16();
  });

  test("ne access_token ne gk_backend_jwt varsa fetch hiç denenmez, false döner, cache boş kalır (localStorage'a DÜŞMEZ)", async () => {
    const fetchSpy = jest.spyOn(global, "fetch").mockImplementation(() => {
      throw new Error("fetch çağrılmamalıydı");
    });

    const result = await tfrs16.refreshInflationIndexCacheFromBackend(["2025-01"]);

    expect(result).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();

    // Cache dolmadığı için loadInflationIndexTable artık BOŞ döner —
    // eski davranışta olduğu gibi localStorage'a düşmez (fail-closed).
    localStorage.setItem("gk_tfrs16_inflation_index_v1", JSON.stringify([
      { month: "2025-01", index: 3500 }
    ]));
    const table = tfrs16.loadInflationIndexTable();
    expect(table).toEqual([]);

    fetchSpy.mockRestore();
  });

  test("access_token doluysa (gerçek login akışı) token bulunur ve fetch DENENIR", async () => {
    localStorage.setItem("access_token", "real-session-token");
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ indices: [] })
    });

    const result = await tfrs16.refreshInflationIndexCacheFromBackend(["2025-01"]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result).toBe(true);
    fetchSpy.mockRestore();
  });

  test("backend 401 dönerse (token geçersiz) sessizce 'başarılı' görünmez, false döner", async () => {
    localStorage.setItem("gk_backend_jwt", "fake-token-for-test");
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({ ok: false, status: 401 });

    const result = await tfrs16.refreshInflationIndexCacheFromBackend(["2025-01"]);

    expect(result).toBe(false);
    fetchSpy.mockRestore();
  });

  test("backend başarılı yanıt verirse cache dolar ve loadInflationIndexTable ARTIK localStorage'ı DEĞİL cache'i döner", async () => {
    localStorage.setItem("gk_backend_jwt", "fake-token-for-test");
    // localStorage'da FARKLI bir değer var — cache doluysa bu görmezden gelinmeli
    // (ve zaten artık hiç okunmuyor).
    localStorage.setItem("gk_tfrs16_inflation_index_v1", JSON.stringify([
      { month: "2025-01", index: 1111 }
    ]));

    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        indices: [{ month: "2025-01", index: 3500, source: "TUIK_AUTO", sourceUrl: null, retrievedAt: "2025-02-01", verificationStatus: "VERIFIED" }]
      })
    });

    const result = await tfrs16.refreshInflationIndexCacheFromBackend(["2025-01"]);
    expect(result).toBe(true);

    const table = tfrs16.loadInflationIndexTable();
    expect(table).toEqual([{ month: "2025-01", index: 3500 }]);

    // getInflationIndex de artık backend'den gelen değeri kullanır.
    expect(tfrs16.getInflationIndex("2025-01")).toBe(3500);

    fetchSpy.mockRestore();
  });

  test("fetch mutlak backend URL'ine (TFRS16_API_BASE) gider, relative path'e DEĞİL", async () => {
    localStorage.setItem("access_token", "real-session-token");
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ indices: [] })
    });

    await tfrs16.refreshInflationIndexCacheFromBackend(["2025-01"]);

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringMatching(/^https:\/\/.*\/api\/inflation-indices/),
      expect.any(Object)
    );
    fetchSpy.mockRestore();
  });
});

describe("applyTMS29Restatement — motor davranışı DEĞİŞMEDİ (regresyon)", () => {
  let tfrs16;

  beforeEach(() => {
    localStorage.clear();
    tfrs16 = loadTfrs16();
  });

  test("sabit endeksle restatement çağrısı hâlâ senkron çalışır ve net düzeltme sıfır çıkar", async () => {
    // Mevcut runSelfTestsV19FullTms29 (Vaka 1) ile AYNI desen:
    // applyTMS29Restatement bir kontrat objesi üzerinde doğrudan
    // çağrılır, contract.schedule dışarıdan set edilmez — motor
    // kendi içinde getReassessmentBaseSchedule() ile hesaplar.
    const baseContract = {
      monthlyPayment: 100000,
      discountRate: 18,
      startDate: "2026-01-01",
      endDate: "2027-12-01",
      paymentFrequency: "monthly",
      paymentTiming: "arrears"
    };

    const months = [];
    for (let y = 2026; y <= 2027; y++) {
      for (let m = 1; m <= 12; m++) months.push(`${y}-${String(m).padStart(2, "0")}`);
    }

    // DÜZELTME: önceden burada addOrUpdateInflationIndexEntry() ile
    // localStorage'a yazılıyordu. loadInflationIndexTable() artık
    // FAIL-CLOSED (yalnızca backend'den VERIFIED gelen cache'i okuyor,
    // localStorage'a HİÇ düşmüyor) olduğu için o test verisi motora
    // ULAŞMIYORDU ve test "endeks yok" hatasıyla düşüyordu.
    // ÜRETİM DAVRANIŞI DOĞRU — bozuk olan testin veri hazırlama
    // yöntemiydi. Artık endeksler GERÇEK üretim yolundan (mock'lanmış
    // backend yanıtı → refreshInflationIndexCacheFromBackend) besleniyor.
    localStorage.setItem("access_token", "fake-token-for-test");
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        indices: months.map(mo => ({
          month: mo, index: 1000, source: "MANUAL_OVERRIDE",
          sourceUrl: null, retrievedAt: "2026-01-01", verificationStatus: "VERIFIED"
        }))
      })
    });
    await tfrs16.refreshInflationIndexCacheFromBackend(months);
    fetchSpy.mockRestore();

    const contract = { ...baseContract, id: "TEST-REGRESSION-INFL-001" };

    const restatement = tfrs16.applyTMS29Restatement(contract, "2027-06", "2027-01");

    // Motor hâlâ senkron çalışıyor — Promise dönmüyor.
    expect(restatement).not.toBeInstanceOf(Promise);
    expect(restatement.totals).toBeTruthy();

    // Enflasyon tamamen sabitken (1000 -> 1000) net düzeltme ve
    // parasal kazanç/kayıp sıfıra yakın olmalı — bu, motorun
    // hesaplama mantığının değişmediğinin doğrudan bir kanıtıdır.
    expect(Math.abs(restatement.totals.netAdjustment)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(restatement.totals.liabilityMonetaryGainLoss)).toBeLessThanOrEqual(0.01);
  });

  test("runSelfTestsV19FullTms29 (mevcut TMS 29 self-test paketi) hâlâ TAMAMEN geçiyor", async () => {
    // Bu fonksiyon artık async (createModification/createReassessment
    // backend'e yazmayı beklediği için) — bkz. PROJECT_CONTEXT.md
    // bölüm 23 madde 14/15.
    //
    // ÖNCEDEN burada "Vaka 5 hariç" istisnası vardı. Vaka 5 ÇÖZÜLDÜ:
    // sorun motorda değil, self-test'in kendi karşılaştırmasındaydı —
    // generateInflationAdjustmentJournal() sonda applyAccountMappingToJournal()
    // çağırıp `account` alanını tam etiketten ("580 Geçmiş Yıllar
    // Zararları") hesap koduna ("580") çeviriyor (hesap planı eşleme
    // özelliği, DOĞRU davranış), ama test dönüşüm sonrası çıktıyı
    // dönüşüm öncesi TFRS29_ACCOUNTS sabitleriyle karşılaştırıyordu.
    // Karşılaştırma accountKey üzerinden yapılacak şekilde düzeltildi.
    // Artık istisna YOK — paketin TAMAMI geçmeli.
    const results = await tfrs16.runSelfTestsV19FullTms29();
    const failed = results.filter(r => !r.pass);
    expect(failed).toEqual([]);
  });
});
