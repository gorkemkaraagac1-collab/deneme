/**
 * ============================================================
 * INFLATION MANUAL ENTRY WORKFLOW TESTS
 * ============================================================
 *
 * backend/services/tuik-index-service.js'e eklenen manuel giriş
 * ailesini kapsar: createManualIndexEntry, createBulkManualIndexEntries,
 * verifyIndexRecord, rejectIndexRecord, listIndexRecords.
 *
 * test/tuik-index-service.test.js'teki "overrideIndexValue" describe
 * bloğuyla AYNI mock deseni kullanılır (backend/db/pool GERÇEK bir
 * PostgreSQL bağlantısı açmaz) — buraya genişletilerek: FOR UPDATE ile
 * id bazlı SELECT ve status güncelleyen UPDATE'ler de mock'lanır.
 */

function buildMockDb() {
  const table = {};
  let nextId = 1;

  const mockClient = {
    query: jest.fn(async (sql, params = []) => {
      const s = sql.trim();
      if (s === "BEGIN" || s === "COMMIT" || s === "ROLLBACK") return { rows: [] };

      // upsertIndexRecord — aktif kaydı kilitleyerek getir (index_type + month)
      if (s.startsWith("SELECT * FROM inflation_indices") && s.includes("index_type = $1 AND index_month = $2")) {
        const [indexType, month] = params;
        const row = Object.values(table).find(
          r => r.index_type === indexType && r.index_month === month && r.superseded_by === null
        );
        return { rows: row ? [row] : [] };
      }

      // verifyIndexRecord/rejectIndexRecord — id bazlı SELECT ... FOR UPDATE
      if (s.startsWith("SELECT * FROM inflation_indices WHERE id = $1")) {
        const [id] = params;
        const row = table[id];
        return { rows: row ? [row] : [] };
      }

      if (s.startsWith("INSERT INTO inflation_indices")) {
        const [indexType, month, value, source, sourceUrl, retrievedBy, verificationStatus] = params;
        const row = {
          id: nextId++, index_type: indexType, index_month: month, index_value: value,
          source, source_url: sourceUrl, retrieved_by: retrievedBy,
          verification_status: verificationStatus, superseded_by: null,
          verified_at: null, verified_by: null, created_at: new Date().toISOString()
        };
        table[row.id] = row;
        return { rows: [row] };
      }

      if (s.startsWith("UPDATE inflation_indices SET superseded_by")) {
        const [supersededById, id] = params;
        table[id].superseded_by = supersededById;
        return { rows: [] };
      }

      if (s.startsWith("UPDATE inflation_indices\n       SET verification_status = 'VERIFIED'")
        || s.startsWith("UPDATE inflation_indices SET verification_status = 'VERIFIED'")) {
        const [actor, id] = params;
        table[id].verification_status = "VERIFIED";
        table[id].verified_by = actor;
        table[id].verified_at = new Date().toISOString();
        return { rows: [table[id]] };
      }

      if (s.startsWith("UPDATE inflation_indices\n       SET verification_status = 'REJECTED'")
        || s.startsWith("UPDATE inflation_indices SET verification_status = 'REJECTED'")) {
        const [actor, id] = params;
        table[id].verification_status = "REJECTED";
        table[id].verified_by = actor;
        table[id].verified_at = new Date().toISOString();
        return { rows: [table[id]] };
      }

      if (s.startsWith("INSERT INTO audit_events")) {
        if (String(params[0]).length > 50) {
          throw new Error("value too long for type character varying(50)");
        }
        return { rows: [] };
      }

      throw new Error(`Mock client beklenmeyen SQL gördü: ${s}`);
    }),
    release: jest.fn()
  };

  const mockPool = {
    query: jest.fn(async (sql, params = []) => {
      // listIndexRecords — pool.query üzerinden dinamik WHERE'li SELECT
      if (sql.trim().startsWith("SELECT * FROM inflation_indices")) {
        let rows = Object.values(table);
        // filtreler test bazında basitçe elenir; gerçek SQL semantiği
        // burada tam olarak simüle edilmiyor, sadece davranış test edilir.
        return { rows };
      }
      throw new Error(`Mock pool beklenmeyen SQL gördü: ${sql}`);
    }),
    connect: jest.fn().mockResolvedValue(mockClient)
  };

  return { table, mockPool, mockClient, getNextId: () => nextId };
}

describe("createManualIndexEntry", () => {
  let service, table, mockPool, mockClient;

  beforeEach(() => {
    jest.resetModules();
    const mocks = buildMockDb();
    table = mocks.table;
    mockPool = mocks.mockPool;
    mockClient = mocks.mockClient;
    jest.doMock("../backend/db/pool", () => mockPool);
    service = require("../backend/services/tuik-index-service");
  });

  test("manuel giriş her zaman PENDING olarak oluşturulur (VERIFIED DEĞİL)", async () => {
    const result = await service.createManualIndexEntry({ month: "2026-07", value: 3500.25, actor: "admin-1" });
    expect(result.action).toBe("inserted");
    expect(result.record.verification_status).toBe("PENDING");
    expect(result.record.source).toBe("MANUAL_OVERRIDE");
  });

  test("audit id VARCHAR(50) sınırını aşmaz", async () => {
    await service.createManualIndexEntry({ month: "2026-07", value: 3500.25, actor: "admin-1" });

    const auditCall = mockClient.query.mock.calls.find(([sql]) =>
      sql.trim().startsWith("INSERT INTO audit_events")
    );
    expect(auditCall).toBeDefined();
    expect(auditCall[1][0]).toMatch(/^INFL-\d{13}-[0-9a-f]{16}$/);
    expect(auditCall[1][0].length).toBeLessThanOrEqual(50);
  });

  test("geçersiz ay formatı reddedilir, DB'ye hiçbir şey yazılmaz", async () => {
    await expect(
      service.createManualIndexEntry({ month: "2026-13", value: 100, actor: "admin-1" })
    ).rejects.toThrow();
    expect(Object.keys(table).length).toBe(0);
  });

  test("geçersiz (negatif/NaN) endeks değeri reddedilir", async () => {
    await expect(
      service.createManualIndexEntry({ month: "2026-07", value: -1, actor: "admin-1" })
    ).rejects.toThrow();
    await expect(
      service.createManualIndexEntry({ month: "2026-07", value: "abc", actor: "admin-1" })
    ).rejects.toThrow();
    expect(Object.keys(table).length).toBe(0);
  });

  test("aynı ay için ikinci bir manuel giriş -> eski kayıt supersede edilir, üzerine yazılmaz (duplicate period)", async () => {
    await service.createManualIndexEntry({ month: "2026-07", value: 3500.25, actor: "admin-1" });
    const firstId = Object.values(table).find(r => r.superseded_by === null).id;

    await service.createManualIndexEntry({ month: "2026-07", value: 3510.0, actor: "admin-2" });

    expect(Object.keys(table).length).toBe(2);
    expect(table[firstId].superseded_by).not.toBeNull();
    expect(table[firstId].index_value).toBe(3500.25); // eski değer UPDATE edilmedi

    const active = Object.values(table).find(r => r.superseded_by === null);
    expect(active.index_value).toBe(3510.0);
    expect(active.verification_status).toBe("PENDING"); // yeni kayıt da PENDING başlar
  });
});

describe("createBulkManualIndexEntries", () => {
  let service, table, mockPool;

  beforeEach(() => {
    jest.resetModules();
    const mocks = buildMockDb();
    table = mocks.table;
    mockPool = mocks.mockPool;
    jest.doMock("../backend/db/pool", () => mockPool);
    service = require("../backend/services/tuik-index-service");
  });

  test("geçerli toplu metin -> tüm satırlar PENDING olarak oluşturulur", async () => {
    const text = "2025-01\t2648.12\n2025-02\t2701.34\n2025-03\t2756.81";
    const result = await service.createBulkManualIndexEntries(text, "admin-1");

    expect(result.created.length).toBe(3);
    expect(result.skipped).toEqual([]);
    expect(Object.values(table).every(r => r.verification_status === "PENDING")).toBe(true);
  });

  test("19 aylık bulk giriş PENDING oluşur ve retrieved_by stabil user id taşır", async () => {
    const actorId = "u-stable-id";
    const text = [
      "2025-01 88.58", "2025-02 90.59", "2025-03 92.82", "2025-04 95.60",
      "2025-05 97.06", "2025-06 98.40", "2025-07 100.42", "2025-08 102.47",
      "2025-09 105.78", "2025-10 108.48", "2025-11 109.42", "2025-12 110.39",
      "2026-01 115.73", "2026-02 119.16", "2026-03 121.47", "2026-04 126.55",
      "2026-05 128.72", "2026-06 129.99", "2026-07 132.31"
    ].join("\n");

    const result = await service.createBulkManualIndexEntries(text, actorId);
    const records = Object.values(table);

    expect(result.created).toHaveLength(19);
    expect(result.skipped).toEqual([]);
    expect(records).toHaveLength(19);
    expect(records.every(r => r.verification_status === "PENDING")).toBe(true);
    expect(records.every(r => r.retrieved_by === actorId)).toBe(true);
  });

  test("içinde geçersiz satır varsa (parse aşamasında) HİÇBİR şey DB'ye yazılmaz", async () => {
    const text = "2025-01\t2648.12\n2025-13\tabc";
    await expect(service.createBulkManualIndexEntries(text, "admin-1")).rejects.toThrow(service.BulkInputParseError);
    expect(Object.keys(table).length).toBe(0);
  });

  test("aynı ay metin içinde tekrar ediyorsa (duplicate) parse aşamasında reddedilir, hiç yazılmaz", async () => {
    const text = "2025-01\t2648.12\n2025-01\t2650.00";
    await expect(service.createBulkManualIndexEntries(text, "admin-1")).rejects.toThrow(service.BulkInputParseError);
    expect(Object.keys(table).length).toBe(0);
  });
});

describe("verifyIndexRecord / rejectIndexRecord — fail-closed davranış", () => {
  let service, table, mockPool;

  beforeEach(() => {
    jest.resetModules();
    const mocks = buildMockDb();
    table = mocks.table;
    mockPool = mocks.mockPool;
    jest.doMock("../backend/db/pool", () => mockPool);
    service = require("../backend/services/tuik-index-service");
  });

  test("PENDING bir kayıt VERIFIED yapılabilir", async () => {
    const created = await service.createManualIndexEntry({ month: "2026-07", value: 3500.25, actor: "admin-1" });
    const verified = await service.verifyIndexRecord({ id: created.record.id, actor: "admin-2" });

    expect(verified.verification_status).toBe("VERIFIED");
    expect(verified.verified_by).toBe("admin-2");
  });

  test("PENDING bir kayıt REJECTED yapılabilir", async () => {
    const created = await service.createManualIndexEntry({ month: "2026-07", value: 3500.25, actor: "admin-1" });
    const rejected = await service.rejectIndexRecord({ id: created.record.id, actor: "admin-2", reason: "Yanlış girildi" });

    expect(rejected.verification_status).toBe("REJECTED");
  });

  test("zaten VERIFIED olan bir kayıt tekrar verify edilemez (fail-closed)", async () => {
    const created = await service.createManualIndexEntry({ month: "2026-07", value: 3500.25, actor: "admin-1" });
    await service.verifyIndexRecord({ id: created.record.id, actor: "admin-2" });

    await expect(
      service.verifyIndexRecord({ id: created.record.id, actor: "admin-3" })
    ).rejects.toThrow(/PENDING/);
  });

  test("REJECTED bir kayıt sonradan verify edilemez", async () => {
    const created = await service.createManualIndexEntry({ month: "2026-07", value: 3500.25, actor: "admin-1" });
    await service.rejectIndexRecord({ id: created.record.id, actor: "admin-2" });

    await expect(
      service.verifyIndexRecord({ id: created.record.id, actor: "admin-3" })
    ).rejects.toThrow(/PENDING/);
  });

  test("var olmayan bir id için açık hata döner (sessizce no-op yapmaz)", async () => {
    await expect(
      service.verifyIndexRecord({ id: 9999, actor: "admin-1" })
    ).rejects.toThrow(/bulunamadı/);
  });

  test("supersede edilmiş (artık aktif olmayan) bir kayıt verify/reject edilemez", async () => {
    const first = await service.createManualIndexEntry({ month: "2026-07", value: 3500.25, actor: "admin-1" });
    // aynı ayı tekrar girmek ilk kaydı supersede eder
    await service.createManualIndexEntry({ month: "2026-07", value: 3600.0, actor: "admin-1" });

    await expect(
      service.verifyIndexRecord({ id: first.record.id, actor: "admin-2" })
    ).rejects.toThrow(/aktif değil/);
  });
});
