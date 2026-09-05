/**
 * @jest-environment node
 *
 * P3 DÜZELTMESİ (test altyapısı — üretim kodu DEĞİL): jest.config.js
 * GLOBAL olarak testEnvironment: "jsdom" kullanıyor (js/tfrs16.js gibi
 * DOM'a ihtiyaç duyan frontend testleri için gerekli). Ancak bu dosya
 * supertest ile gerçek bir Express app'e (backend/app.js) istek atıyor
 * ve backend/routes/admin.js (app.js üzerinden transitively yükleniyor)
 * modül yüklenirken middleware/rate-limit.js'teki
 * setInterval(...).unref() çağrısını tetikliyor. jsdom'un sahte timer
 * nesneleri .unref() metodunu SAĞLAMIYOR — bu da bu dosyanın (ve app.js
 * yükleyen diğer tüm backend test dosyalarının) require aşamasında
 * tamamen çökmesine yol açıyordu (P0-P2'den beri var olan, bu P3
 * çalışmasından ÖNCE de mevcut bir altyapı kusuru — bkz. P3 Kod Raporu
 * madde 6). Bu docblock yalnızca BU DOSYANIN ortamını "node"ya
 * çeviriyor (dosya başına override, jest.config.js'teki global ayar
 * DEĞİŞMİYOR) — DOM'a ihtiyaç duyan diğer test dosyaları etkilenmez.
 * ============================================================
 * LICENSE / TENANT ISOLATION SECURITY TESTS
 * ============================================================
 *
 * Bu dosya backend/db/pool.js ve backend/services/license-service.js
 * mock'lanarak, gerçek bir PostgreSQL bağlantısı OLMADAN, route ve
 * middleware katmanındaki yetkilendirme mantığını doğrular.
 *
 * Kapsam:
 *  - Authentication (token yok / geçersiz token -> 401)
 *  - Plan hierarchy (starter/professional/enterprise)
 *  - Company (tenant) isolation — başka şirketin contract/audit
 *    kaydına erişim
 *  - Lisans durumu (no license / expired / cancelled -> 403)
 *
 * Not: Bu dosya gerçek DB bağlantısı gerektirmez; supertest ile
 * app.js'e (Express instance) doğrudan istek atar.
 */

process.env.JWT_SECRET =
  process.env.JWT_SECRET || "test-only-secret-do-not-use-in-prod";

const request = require("supertest");

const { signUserToken } = require("../backend/utils/jwt");

function authHeader(payload) {
  const token = signUserToken(payload);
  return { Authorization: `Bearer ${token}` };
}

/**
 * ------------------------------------------------------------
 * SABİT TEST VERİSİ
 * ------------------------------------------------------------
 */

const COMPANY_A = "COMPANY-A";
const COMPANY_B = "COMPANY-B";

const USER_A = { id: "USER-A", username: "userA", role: "VIEWER", companyIds: [COMPANY_A] };
const USER_B = { id: "USER-B", username: "userB", role: "VIEWER", companyIds: [COMPANY_B] };

// P3 DÜZELTMESİ (test regresyonu — kod DEĞİL): PUT/DELETE
// "başka şirketin kontratı" testleri IDOR/company-scope davranışını
// (404, var/yok bilgisi sızdırılmaz) doğrulamak istiyor. Ama VIEWER
// zaten requireContractWriteRole tarafından HER durumda (kendi
// şirketi olsa bile) 403 ile reddedilir — yani USER_B (VIEWER) ile
// bu test aslında IDOR/scope kontrolünü hiç EGZERSİZ ETMİYORDU,
// yalnızca write-role gate'ini tetikliyordu (403, ama "404
// bekleniyordu" yanlış varsayımıyla yazılmıştı — jsdom çökmesi
// yüzünden bu hiç fark edilmemişti). Gerçek IDOR senaryosunu test
// etmek için yazma yetkisi OLAN ama COMPANY_B'ye atanmış bir
// kullanıcı gerekiyor.
const USER_B_WRITER = { id: "USER-B2", username: "userB2", role: "ACCOUNTANT", companyIds: [COMPANY_B] };

const CONTRACT_A = { id: "CONTRACT-A1", company_id: COMPANY_A };

function makeLicenseRow(companyId, planId, status = "active") {
  return {
    id: `LIC-${companyId}`,
    company_id: companyId,
    plan_id: planId,
    plan_name: planId,
    max_users: planId === "enterprise" ? null : 5,
    description: null,
    starts_at: new Date(Date.now() - 1000 * 60 * 60 * 24),
    expires_at: null,
    status
  };
}

/**
 * ------------------------------------------------------------
 * SUITE 1 — AUTHENTICATION
 * ------------------------------------------------------------
 */
describe("Authentication", () => {
  let app;

  beforeEach(() => {
    jest.resetModules();
    // pool hiç kullanılmayacak ama require zinciri (db/pool.js) gerçek
    // pg.Pool açmasın diye mock'luyoruz.
    jest.doMock("../backend/db/pool", () => ({
      query: jest.fn(),
      connect: jest.fn()
    }));
    app = require("../backend/app");
  });

  afterEach(() => {
    jest.resetModules();
  });

  test("token yok -> 401", async () => {
    const res = await request(app).get("/api/contracts");
    expect(res.status).toBe(401);
  });

  test("geçersiz/sahte token -> 401", async () => {
    const res = await request(app)
      .get("/api/contracts")
      .set("Authorization", "Bearer not-a-real-jwt");
    expect(res.status).toBe(401);
  });

  test("health endpoint auth gerektirmez -> 200", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});

/**
 * ------------------------------------------------------------
 * SUITE 2 — PLAN HIERARCHY (/api/license-test/*)
 * ------------------------------------------------------------
 */
describe("Plan hierarchy", () => {
  let app;
  let getUserLicensesMock;

  function mockLicensesFor(companyId, planId, status = "active") {
    getUserLicensesMock.mockResolvedValue([
      {
        companyId,
        companyName: companyId,
        hasActiveLicense: status === "active",
        license: {
          id: `LIC-${companyId}`,
          planId,
          planName: planId,
          maxUsers: planId === "enterprise" ? null : 5,
          description: null,
          startsAt: new Date(),
          expiresAt: null,
          status
        },
        currentUsers: 1,
        remainingUsers: planId === "enterprise" ? null : 4
      }
    ]);
  }

  beforeEach(() => {
    jest.resetModules();
    getUserLicensesMock = jest.fn();

    jest.doMock("../backend/db/pool", () => ({ query: jest.fn(), connect: jest.fn() }));
    jest.doMock("../backend/services/license-service", () => ({
      getUserLicenses: getUserLicensesMock,
      getActiveCompanyLicense: jest.fn(),
      getCompanyUserCount: jest.fn(),
      canAddUserToCompany: jest.fn(),
      getUserLicensedCompanies: jest.fn(),
      hasActiveCompanyLicense: jest.fn(),
      hasPlanAccess: jest.fn(),
      getUserHighestPlan: jest.fn()
    }));

    app = require("../backend/app");
  });

  afterEach(() => {
    jest.resetModules();
  });

  test("starter kullanıcı: starter endpoint -> 200", async () => {
    mockLicensesFor(COMPANY_A, "starter");
    const res = await request(app)
      .get("/api/license-test/active")
      .set(authHeader(USER_A));
    expect(res.status).toBe(200);
  });

  test("starter kullanıcı: professional endpoint -> 403 PLAN_REQUIRED", async () => {
    mockLicensesFor(COMPANY_A, "starter");
    const res = await request(app)
      .get("/api/license-test/professional")
      .set(authHeader(USER_A));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("PLAN_REQUIRED");
  });

  test("starter kullanıcı: enterprise endpoint -> 403", async () => {
    mockLicensesFor(COMPANY_A, "starter");
    const res = await request(app)
      .get("/api/license-test/enterprise")
      .set(authHeader(USER_A));
    expect(res.status).toBe(403);
  });

  test("professional kullanıcı: starter -> 200, professional -> 200, enterprise -> 403", async () => {
    mockLicensesFor(COMPANY_A, "professional");

    const starter = await request(app).get("/api/license-test/active").set(authHeader(USER_A));
    expect(starter.status).toBe(200);

    const professional = await request(app).get("/api/license-test/professional").set(authHeader(USER_A));
    expect(professional.status).toBe(200);

    const enterprise = await request(app).get("/api/license-test/enterprise").set(authHeader(USER_A));
    expect(enterprise.status).toBe(403);
  });

  test("enterprise kullanıcı: starter -> 200, professional -> 200, enterprise -> 200", async () => {
    mockLicensesFor(COMPANY_A, "enterprise");

    const starter = await request(app).get("/api/license-test/active").set(authHeader(USER_A));
    expect(starter.status).toBe(200);

    const professional = await request(app).get("/api/license-test/professional").set(authHeader(USER_A));
    expect(professional.status).toBe(200);

    const enterprise = await request(app).get("/api/license-test/enterprise").set(authHeader(USER_A));
    expect(enterprise.status).toBe(200);
  });

  test("aktif lisansı olmayan kullanıcı -> 403 NO_ACTIVE_LICENSE", async () => {
    getUserLicensesMock.mockResolvedValue([]);
    const res = await request(app)
      .get("/api/license-test/active")
      .set(authHeader(USER_A));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("NO_ACTIVE_LICENSE");
  });

  test("expired/cancelled lisans hasActiveLicense=false döner -> 403", async () => {
    mockLicensesFor(COMPANY_A, "professional", "expired");
    const res = await request(app)
      .get("/api/license-test/active")
      .set(authHeader(USER_A));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("NO_ACTIVE_LICENSE");
  });
});

/**
 * ------------------------------------------------------------
 * SUITE 3 — COMPANY (TENANT) ISOLATION — /api/contracts
 * ------------------------------------------------------------
 */
describe("Contract company isolation", () => {
  let app;
  let poolQueryMock;

  beforeEach(() => {
    jest.resetModules();
    poolQueryMock = jest.fn();

    jest.doMock("../backend/db/pool", () => ({
      query: poolQueryMock,
      connect: jest.fn(async () => ({ query: poolQueryMock, release: jest.fn() }))
    }));

    app = require("../backend/app");
  });

  afterEach(() => {
    jest.resetModules();
  });

  test("GET /api/contracts/:id — başka şirketin kontratı -> 404", async () => {
    // Route, company_id = ANY($2) filtresiyle sorguluyor; User A'nın
    // companyIds listesinde COMPANY_B yok, dolayısıyla DB'ye giden
    // sorgu zaten 0 satır dönecek şekilde WHERE'e sahip. Burada,
    // gerçek bir Postgres'in bu filtreyle 0 satır döneceğini simüle
    // ediyoruz.
    poolQueryMock.mockImplementation((sql, params) => {
      const companyIds = params[1];
      if (!companyIds.includes(CONTRACT_A.company_id)) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [CONTRACT_A] });
    });

    const res = await request(app)
      .get(`/api/contracts/${CONTRACT_A.id}`)
      .set(authHeader(USER_B)); // USER_B sadece COMPANY_B'ye bağlı

    expect(res.status).toBe(404);
  });

  test("GET /api/contracts/:id — kendi şirketinin kontratı -> 200", async () => {
    poolQueryMock.mockImplementation((sql, params) => {
      const companyIds = params[1];
      if (companyIds.includes(CONTRACT_A.company_id)) {
        return Promise.resolve({ rows: [CONTRACT_A] });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .get(`/api/contracts/${CONTRACT_A.id}`)
      .set(authHeader(USER_A));

    expect(res.status).toBe(200);
  });

  test("PUT /api/contracts/:id — başka şirketin kontratı -> 404", async () => {
    poolQueryMock.mockImplementation((sql) => {
      // İlk sorgu: kontratın sahibini company_id = ANY($2) ile arar.
      if (sql.includes("SELECT") && sql.includes("company_id") && sql.includes("FROM contracts")) {
        return Promise.resolve({ rows: [] }); // USER_B_WRITER'ın erişemediği kontrat
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .put(`/api/contracts/${CONTRACT_A.id}`)
      .set(authHeader(USER_B_WRITER))
      .send({ monthlyPayment: 2000 });

    expect(res.status).toBe(404);
  });

  test("DELETE /api/contracts/:id — başka şirketin kontratı -> 404", async () => {
    poolQueryMock.mockImplementation((sql) => {
      if (sql.includes("SELECT") && sql.includes("FROM contracts")) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .delete(`/api/contracts/${CONTRACT_A.id}`)
      .set(authHeader(USER_B_WRITER));

    expect(res.status).toBe(404);
  });

  test("GET /api/contracts — şirketi olmayan kullanıcı -> 403 NO_COMPANY_ACCESS", async () => {
    const userWithNoCompany = { id: "USER-C", username: "userC", role: "VIEWER", companyIds: [] };

    const res = await request(app)
      .get("/api/contracts")
      .set(authHeader(userWithNoCompany));

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("NO_COMPANY_ACCESS");
  });
});

/**
 * ------------------------------------------------------------
 * SUITE 4 — AUDIT COMPANY ISOLATION — /api/audit
 * ------------------------------------------------------------
 */
describe("Audit company isolation", () => {
  let app;
  let poolQueryMock;

  beforeEach(() => {
    jest.resetModules();
    poolQueryMock = jest.fn();

    jest.doMock("../backend/db/pool", () => ({
      query: poolQueryMock,
      connect: jest.fn(async () => ({ query: poolQueryMock, release: jest.fn() }))
    }));

    app = require("../backend/app");
  });

  afterEach(() => {
    jest.resetModules();
  });

  test("POST /api/audit — başka şirketin kontratına audit kaydı -> 403", async () => {
    // P3 DÜZELTMESİ (test regresyonu — kod DEĞİL): audit.js artık
    // sahiplik kontrolünü accessScope üzerinden yapıyor (ADMIN/
    // ACCOUNTANT_MANAGER için doğru davranması amacıyla) — bunun
    // için önce kontratın company_id'sini ÇEKİYOR ("SELECT
    // company_id FROM contracts WHERE id = $1"), eskisi gibi
    // doğrudan bir "AND company_id = ANY($2)" ile filtrelemiyor.
    // USER_B için bu satır zaten mevcut olmadığından (boş rows)
    // sonuç aynı: 403.
    poolQueryMock.mockImplementation((sql) => {
      if (sql.includes("SELECT company_id FROM contracts")) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .post("/api/audit")
      .set(authHeader(USER_B))
      .send({
        id: "AUDIT-1",
        action: "UPDATE",
        entityType: "contract",
        contractId: CONTRACT_A.id
      });

    expect(res.status).toBe(403);
  });

  test("POST /api/audit — kendi şirketinin kontratına audit kaydı -> 201", async () => {
    poolQueryMock.mockImplementation((sql) => {
      if (sql.includes("SELECT company_id FROM contracts")) {
        return Promise.resolve({ rows: [{ company_id: COMPANY_A }] });
      }
      if (sql.includes("INSERT INTO audit_events")) {
        return Promise.resolve({
          rows: [{ id: "AUDIT-1", action: "UPDATE", entity_type: "contract", contract_id: CONTRACT_A.id }]
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .post("/api/audit")
      .set(authHeader(USER_A))
      .send({
        id: "AUDIT-1",
        action: "UPDATE",
        entityType: "contract",
        contractId: CONTRACT_A.id
      });

    expect(res.status).toBe(201);
  });

  test("GET /api/audit — sorgu her zaman company_id = ANY(req.user.companyIds) ile filtrelenir", async () => {
    poolQueryMock.mockImplementation((sql, params) => {
      expect(sql).toContain("c.company_id = ANY($1)");
      expect(params[0]).toEqual(USER_A.companyIds);
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .get("/api/audit")
      .set(authHeader(USER_A));

    expect(res.status).toBe(200);
    expect(poolQueryMock).toHaveBeenCalled();
  });
});
