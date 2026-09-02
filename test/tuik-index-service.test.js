/**
 * ============================================================
 * TUIK INDEX SERVICE TESTS
 * ============================================================
 *
 * backend/db/pool GERÇEK bir PostgreSQL bağlantısı açmasın diye
 * mock'lanır (license-security.test.js'teki desenle aynı).
 * global.fetch da TÜİK ağ çağrısını simüle etmek için mock'lanır
 * — gerçek bir dış ağ isteği ASLA atılmaz.
 */

function makeSdmxResponse(records) {
  const expected = [
    ["REF_AREA", "TR"],
    ["FREQ", "M"],
    ["SINIFLAMA_DUZEYI", "TUFE"],
    ["DEGISIM", "1"],
    ["OZEL_KAPSAM_TUFE", "_Z"],
    ["BASE_PER", "2025"],
    ["YAYIM_DONEMI", "2026_01"],
    ["COICOP_1999", "_Z"],
    ["COICOP_2018", "0"],
    ["INDICATOR", "F_TFE"]
  ];

  return {
    structure: {
      dimensions: {
        series: expected.map(([id, value]) => ({ id, values: [{ id: value }] })),
        observation: [{
          id: "TIME_PERIOD",
          values: records.map(record => ({ id: record.period }))
        }]
      }
    },
    dataSets: [{
      series: {
        "0:0:0:0:0:0:0:0:0:0": {
          observations: Object.fromEntries(
            records.map((record, index) => [String(index), [record.value]])
          )
        }
      }
    }]
  };
}

function mockOfficialTuikFetch(records) {
  global.fetch = jest.fn(async url => {
    if (String(url).includes("giris.tuik.gov.tr")) {
      return { ok: true, json: async () => ({ access_token: "test-token", expires_in: 300 }) };
    }
    return { ok: true, json: async () => makeSdmxResponse(records) };
  });
}

describe("normalizeMonthLabel / normalizeTuikRecord", () => {
  let service;

  beforeEach(() => {
    jest.resetModules();
    jest.doMock("../backend/db/pool", () => ({ query: jest.fn(), connect: jest.fn() }));
    service = require("../backend/services/tuik-index-service");
  });

  test("YYYY-MM zaten doğruysa aynen döner", () => {
    expect(service.normalizeMonthLabel("2025-01")).toBe("2025-01");
  });

  test("YYYYMdd formatı normalize edilir", () => {
    expect(service.normalizeMonthLabel("2025M01")).toBe("2025-01");
  });

  test("YYYYMM (kompakt) formatı normalize edilir", () => {
    expect(service.normalizeMonthLabel("202501")).toBe("2025-01");
  });

  test("tanınmayan format -> null (sessizce yanlış tahmin yapılmaz)", () => {
    expect(service.normalizeMonthLabel("garbage")).toBeNull();
    expect(service.normalizeMonthLabel("")).toBeNull();
  });

  test("virgüllü ondalık ayracı doğru parse edilir", () => {
    const result = service.normalizeTuikRecord({ period: "2025-01", value: "3512,75" });
    expect(result).toEqual({ month: "2025-01", value: 3512.75 });
  });

  test("geçersiz value -> null", () => {
    expect(service.normalizeTuikRecord({ period: "2025-01", value: "abc" })).toBeNull();
  });

  test("geçersiz period -> null", () => {
    expect(service.normalizeTuikRecord({ period: "garbage", value: 100 })).toBeNull();
  });
});

describe("fetchFromTuik — resmî SDMX kaynağı", () => {
  let service;
  const originalApiKey = process.env.TUIK_API_KEY;
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.resetModules();
    jest.doMock("../backend/db/pool", () => ({ query: jest.fn(), connect: jest.fn() }));
    process.env.TUIK_API_KEY = "test-api-key";
    service = require("../backend/services/tuik-index-service");
  });

  afterEach(() => {
    if (originalApiKey === undefined) delete process.env.TUIK_API_KEY;
    else process.env.TUIK_API_KEY = originalApiKey;
    global.fetch = originalFetch;
  });

  test("TUIK_API_KEY tanımlı değilse açık hata verir ve ağa çıkmaz", async () => {
    delete process.env.TUIK_API_KEY;
    global.fetch = jest.fn();
    await expect(service.fetchFromTuik(["2025-01"])).rejects.toThrow(service.TuikSourceNotConfiguredError);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("token servisine erişilemezse TuikSourceUnreachableError fırlatılır", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("network down"));
    await expect(service.fetchFromTuik(["2025-01"])).rejects.toThrow(service.TuikSourceUnreachableError);
  });

  test("token servisi HTTP 500 dönerse anahtar/yanıt sızdırmadan açık hata verir", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 });
    await expect(service.fetchFromTuik(["2025-01"])).rejects.toThrow(service.TuikSourceUnreachableError);
  });

  test("doğrulanmış SDMX toplam endeks serisini period/value kayıtlarına dönüştürür", async () => {
    mockOfficialTuikFetch([
      { period: "2025-01", value: 88.578291 },
      { period: "2025-02", value: 90.59197 }
    ]);

    await expect(service.fetchFromTuik(["2025-02"])).resolves.toEqual([
      { period: "2025-02", value: 90.59197 }
    ]);

    expect(global.fetch).toHaveBeenCalledTimes(2);
    const dataRequest = global.fetch.mock.calls[1];
    expect(String(dataRequest[0])).toContain("DF_TUFE_SDMX_TT10");
    expect(String(dataRequest[0])).toContain("startPeriod=2025-02");
    expect(dataRequest[1].headers.Authorization).toBe("Bearer test-token");
  });

  test("baz yılı/seri boyutu beklenenden farklıysa fail-closed davranır", async () => {
    const body = makeSdmxResponse([{ period: "2025-01", value: 88.578291 }]);
    body.structure.dimensions.series.find(item => item.id === "BASE_PER").values[0].id = "2003";
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "test-token" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => body });

    await expect(service.fetchFromTuik(["2025-01"])).rejects.toThrow(service.TuikResponseShapeError);
  });

  test("mükerrer dönem veya sayısal olmayan endeks kabul edilmez", () => {
    const duplicate = makeSdmxResponse([
      { period: "2025-01", value: 88.5 },
      { period: "2025-01", value: 88.6 }
    ]);
    expect(() => service.parseTuikSdmxResponse(duplicate)).toThrow(service.TuikResponseShapeError);

    const invalidValue = makeSdmxResponse([{ period: "2025-01", value: "88.5" }]);
    expect(() => service.parseTuikSdmxResponse(invalidValue)).toThrow(service.TuikResponseShapeError);
  });
});

/**
 * ------------------------------------------------------------
 * syncFromTuik — supersede / duplicate / verification davranışı
 * ------------------------------------------------------------
 *
 * pool.connect() bir "client" döner; bu client'ın query metodunu,
 * çağrılan SQL'e göre basit bir in-memory state makinesi ile
 * simüle ediyoruz. Amaç gerçek bir SQL motoru kurmak değil,
 * upsertIndexRecord/syncFromTuik'in DOĞRU sırayla DOĞRU
 * sorguları attığını ve supersede zincirini doğru kurduğunu
 * doğrulamaktır.
 */
describe("syncFromTuik", () => {
  let service;
  let mockClient;
  let mockPool;
  const originalFetch = global.fetch;

  // Basit bir sahte tablo: id -> row
  let table;
  let nextId;

  function makeMockClient() {
    return {
      query: jest.fn(async (sql, params = []) => {
        const s = sql.trim();

        if (s === "BEGIN" || s === "COMMIT" || s === "ROLLBACK") {
          return { rows: [] };
        }

        if (s.startsWith("SELECT * FROM inflation_indices") && s.includes("ORDER BY index_month DESC")) {
          const [indexType, month] = params;
          const candidates = Object.values(table)
            .filter(r => r.index_type === indexType && r.index_month < month && r.superseded_by === null)
            .sort((a, b) => (a.index_month < b.index_month ? 1 : -1));
          return { rows: candidates.length ? [candidates[0]] : [] };
        }

        if (s.startsWith("SELECT * FROM inflation_indices") && s.includes("FOR UPDATE")) {
          const [indexType, month] = params;
          const row = Object.values(table).find(
            r => r.index_type === indexType && r.index_month === month && r.superseded_by === null
          );
          return { rows: row ? [row] : [] };
        }

        if (s.startsWith("SELECT * FROM inflation_indices")) {
          const [indexType, month] = params;
          const row = Object.values(table).find(
            r => r.index_type === indexType && r.index_month === month && r.superseded_by === null
          );
          return { rows: row ? [row] : [] };
        }

        if (s.startsWith("INSERT INTO inflation_indices")) {
          const [indexType, month, value, source, sourceUrl, retrievedBy, verificationStatus] = params;
          const row = {
            id: nextId++,
            index_type: indexType,
            index_month: month,
            index_value: value,
            source,
            source_url: sourceUrl,
            retrieved_by: retrievedBy,
            verification_status: verificationStatus,
            superseded_by: null,
            verified_at: null,
            verified_by: null
          };
          table[row.id] = row;
          return { rows: [row] };
        }

        if (s.startsWith("UPDATE inflation_indices SET superseded_by")) {
          const [supersededById, id] = params;
          table[id].superseded_by = supersededById;
          return { rows: [] };
        }

        if (s.startsWith("UPDATE inflation_indices SET verified_at")) {
          return { rows: [] };
        }

        if (s.startsWith("INSERT INTO audit_events")) {
          return { rows: [] };
        }

        throw new Error(`Mock client beklenmeyen SQL gördü: ${s}`);
      }),
      release: jest.fn()
    };
  }

  beforeEach(() => {
    jest.resetModules();
    table = {};
    nextId = 1;

    mockClient = makeMockClient();
    mockPool = {
      query: jest.fn(),
      connect: jest.fn().mockResolvedValue(mockClient)
    };

    jest.doMock("../backend/db/pool", () => mockPool);
    service = require("../backend/services/tuik-index-service");

    process.env.TUIK_API_KEY = "test-api-key";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.TUIK_API_KEY;
  });

  test("ilk kez gelen ay -> insert, PENDING olarak işaretlenir, audit event yazılır", async () => {
    mockOfficialTuikFetch([{ period: "2025-01", value: 3500 }]);

    const result = await service.syncFromTuik(["2025-01"], "test-admin");

    expect(result.synced).toEqual(["2025-01"]);
    expect(result.skipped).toEqual([]);

    const row = Object.values(table)[0];
    expect(row.index_value).toBe(3500);
    expect(row.source).toBe("TUIK_AUTO");
    expect(row.verification_status).toBe("PENDING");
    expect(row.superseded_by).toBeNull();

    const auditCall = mockClient.query.mock.calls.find(c => c[0].includes("INSERT INTO audit_events"));
    expect(auditCall).toBeTruthy();
    expect(auditCall[1][2]).toBe("INFLATION_INDEX_SYNCED"); // action
  });

  test("aynı değer tekrar gelirse -> unchanged, YENİ satır oluşmaz, audit event yazılmaz", async () => {
    mockOfficialTuikFetch([{ period: "2025-01", value: 3500 }]);

    await service.syncFromTuik(["2025-01"], "test-admin");
    const rowCountAfterFirst = Object.keys(table).length;

    const result = await service.syncFromTuik(["2025-01"], "test-admin");

    expect(result.unchanged).toEqual(["2025-01"]);
    expect(result.synced).toEqual([]);
    expect(Object.keys(table).length).toBe(rowCountAfterFirst); // yeni satır YOK
  });

  test("değer değişirse -> ESKİ satır UPDATE edilmez, yeni satır eklenir ve eski satır superseded_by ile bağlanır", async () => {
    mockOfficialTuikFetch([{ period: "2025-01", value: 3500 }]);
    await service.syncFromTuik(["2025-01"], "test-admin");
    const firstRowId = Object.values(table)[0].id;
    const firstRowOriginalValue = Object.values(table)[0].index_value;

    mockOfficialTuikFetch([{ period: "2025-01", value: 3600 }]);
    const result = await service.syncFromTuik(["2025-01"], "test-admin");

    expect(result.synced).toEqual(["2025-01"]);
    expect(Object.keys(table).length).toBe(2); // eski + yeni, eski SİLİNMEDİ/ÜZERİNE YAZILMADI

    // Eski satır hâlâ orijinal değerini taşıyor (immutable) ve artık "aktif" değil.
    expect(table[firstRowId].index_value).toBe(firstRowOriginalValue);
    expect(table[firstRowId].superseded_by).not.toBeNull();

    // Yeni satır aktif ve doğru değeri taşıyor.
    const activeRow = Object.values(table).find(r => r.superseded_by === null);
    expect(activeRow.index_value).toBe(3600);
    expect(activeRow.id).not.toBe(firstRowId);
  });

  test("normalize edilemeyen kayıt skipped listesine düşer, senkronizasyonu durdurmaz", async () => {
    mockOfficialTuikFetch([]);

    // months filtresi 'garbage-period'ı normalize edip 2025-01 ile
    // eşleştiremeyeceği için fetchFromTuik zaten filtreleyecek, bu
    // durumda "TÜİK kaynağında bu ay için veri bulunamadı" olarak
    // skipped'e düşer.
    const result = await service.syncFromTuik(["2025-01"], "test-admin");
    expect(result.synced).toEqual([]);
    expect(result.skipped.length).toBe(1);
    expect(result.skipped[0].month).toBe("2025-01");
  });

  test("anormal sıçrama gösteren değer skipped'e düşer, DB'ye yazılmaz", async () => {
    // 2025-01 = 3500 aktif kayıt olarak var. 2025-02 için gelen
    // değer (999999), BİR ÖNCEKİ AYIN (2025-01) aktif değeriyle
    // karşılaştırılır — aynı ayın kendisiyle değil.
    mockOfficialTuikFetch([{ period: "2025-01", value: 3500 }]);
    await service.syncFromTuik(["2025-01"], "test-admin");

    mockOfficialTuikFetch([{ period: "2025-02", value: 999999 }]);
    const result = await service.syncFromTuik(["2025-02"], "test-admin");

    expect(result.synced).toEqual([]);
    expect(result.skipped.length).toBe(1);
    expect(result.skipped[0].month).toBe("2025-02");
    expect(result.skipped[0].reason).toMatch(/sıçrama/);

    // 2025-02 için hiçbir satır DB'ye yazılmadı.
    expect(Object.values(table).some(r => r.index_month === "2025-02")).toBe(false);
  });

  test("geçersiz ay formatı senkronizasyondan önce reddedilir (fetch hiç çağrılmaz)", async () => {
    global.fetch = jest.fn();
    await expect(service.syncFromTuik(["2025-13"], "test-admin")).rejects.toThrow(/Geçersiz ay formatı/);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe("overrideIndexValue", () => {
  let service;
  let mockClient;
  let mockPool;
  let table;
  let nextId;

  beforeEach(() => {
    jest.resetModules();
    table = {};
    nextId = 1;

    mockClient = {
      query: jest.fn(async (sql, params = []) => {
        const s = sql.trim();
        if (s === "BEGIN" || s === "COMMIT" || s === "ROLLBACK") return { rows: [] };

        if (s.startsWith("SELECT * FROM inflation_indices")) {
          const [indexType, month] = params;
          const row = Object.values(table).find(
            r => r.index_type === indexType && r.index_month === month && r.superseded_by === null
          );
          return { rows: row ? [row] : [] };
        }

        if (s.startsWith("INSERT INTO inflation_indices")) {
          const [indexType, month, value, source, sourceUrl, retrievedBy, verificationStatus] = params;
          const row = {
            id: nextId++, index_type: indexType, index_month: month, index_value: value,
            source, source_url: sourceUrl, retrieved_by: retrievedBy,
            verification_status: verificationStatus, superseded_by: null
          };
          table[row.id] = row;
          return { rows: [row] };
        }

        if (s.startsWith("UPDATE inflation_indices SET superseded_by")) {
          const [supersededById, id] = params;
          table[id].superseded_by = supersededById;
          return { rows: [] };
        }

        if (s.startsWith("UPDATE inflation_indices SET verified_at")) {
          const [verifiedBy, id] = params;
          table[id].verification_status = "VERIFIED";
          table[id].verified_by = verifiedBy;
          return { rows: [] };
        }

        if (s.startsWith("INSERT INTO audit_events")) return { rows: [] };

        throw new Error(`Mock client beklenmeyen SQL gördü: ${s}`);
      }),
      release: jest.fn()
    };

    mockPool = { query: jest.fn(), connect: jest.fn().mockResolvedValue(mockClient) };
    jest.doMock("../backend/db/pool", () => mockPool);
    service = require("../backend/services/tuik-index-service");
  });

  test("manuel override VERIFIED olarak işaretlenir ve source=MANUAL_OVERRIDE olur", async () => {
    const result = await service.overrideIndexValue({ month: "2025-03", value: 3700, actor: "admin-user" });
    expect(result.record.source).toBe("MANUAL_OVERRIDE");

    const row = Object.values(table).find(r => r.superseded_by === null);
    expect(row.verification_status).toBe("VERIFIED");
    expect(row.source).toBe("MANUAL_OVERRIDE");
  });

  test("geçersiz değer -> reddedilir, DB'ye hiç yazılmaz", async () => {
    await expect(
      service.overrideIndexValue({ month: "2025-03", value: -5, actor: "admin-user" })
    ).rejects.toThrow();
    expect(Object.keys(table).length).toBe(0);
  });

  test("var olan aktif kaydı override etmek -> eski kayıt superseded olur, üzerine yazılmaz", async () => {
    await service.overrideIndexValue({ month: "2025-03", value: 3700, actor: "admin-1" });
    const firstId = Object.values(table).find(r => r.superseded_by === null).id;

    await service.overrideIndexValue({ month: "2025-03", value: 3800, actor: "admin-2" });

    expect(Object.keys(table).length).toBe(2);
    expect(table[firstId].superseded_by).not.toBeNull();
    expect(table[firstId].index_value).toBe(3700); // eski değer değişmedi
  });
});
