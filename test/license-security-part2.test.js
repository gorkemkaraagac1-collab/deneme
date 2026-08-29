/**
 * ============================================================
 * LICENSE / TENANT ISOLATION — EK GÜVENLİK TESTLERİ (PART 2)
 * ============================================================
 *
 * test/license-security.test.js dosyasını tamamlar. Bu dosya
 * özellikle şunlara odaklanır:
 *
 *  1. Enterprise = gerçek sınırsız kullanıcı (max_users NULL)
 *     mantığının license-service.js İÇİNDEKİ GERÇEK KODLA
 *     (mock'lanmadan) doğrulanması.
 *  2. /api/contracts üzerinde TAM CRUD tenant isolation:
 *     POST (company_id spoof) / GET / PUT / DELETE.
 *  3. routes/admin-licenses.js altındaki tüm önemli
 *     endpoint'ler için authentication / authorization /
 *     business-logic testleri.
 *  4. Starter/Professional/Enterprise kullanıcı limiti eşik
 *     testleri (hem servis seviyesinde hem de HTTP seviyesinde,
 *     register endpoint'i üzerinden).
 *
 * Not: license-service.js BU DOSYADA MOCK'LANMAZ — gerçek
 * modül require edilir ve yalnızca DB katmanı (pool / pg client)
 * sahte (fake) bir query fonksiyonu ile beslenir. Böylece asıl
 * iş mantığı (canAddUserToCompany, requireCompanyLicense, SQL
 * WHERE company_id filtreleri, admin authorization vb.) gerçekten
 * çalıştırılmış olur.
 */

process.env.JWT_SECRET =
  process.env.JWT_SECRET || "test-only-secret-do-not-use-in-prod";

const request = require("supertest");

const { signUserToken } = require("../backend/utils/jwt");

function authHeader(payload) {
  const token = signUserToken(payload);
  return { Authorization: `Bearer ${token}` };
}

const COMPANY_A = "COMPANY-A";
const COMPANY_B = "COMPANY-B";

const USER_A = { id: "USER-A", username: "userA", role: "VIEWER", companyIds: [COMPANY_A] };
const USER_B = { id: "USER-B", username: "userB", role: "VIEWER", companyIds: [COMPANY_B] };
const ADMIN_USER = { id: "USER-ADMIN", username: "admin", role: "ADMIN", companyIds: [] };

// P1: routes/contracts.js artık PUT/DELETE (ve POST) için bir
// yazma-yetkisi kapısı (CONTRACT_WRITE_ACCESS_DENIED) içeriyor ve
// VIEWER bu kapıdan hiçbir zaman geçemiyor (P1-B). Aşağıdaki
// testlerden bazıları VIEWER ile YAZMA endpoint'lerine istek atıp
// ya "kendi kontratı" başarı senaryosunu ya da "başka şirket"
// izolasyon senaryosunu doğruluyordu — ikisi de artık VIEWER'ın
// KENDİSİ için anlamsız (VIEWER zaten hiçbir zaman yazamaz). Bu
// testlerin ASIL amacını (tenant isolation / başarılı CRUD) VIEWER
// kısıtlamasından ayırmak için, yalnızca PUT/DELETE senaryolarında
// kullanılan yazma yetkili kullanıcı eşdeğerleri:
const USER_A_ACCOUNTANT = { id: "USER-A2", username: "userA2", role: "ACCOUNTANT", companyIds: [COMPANY_A] };
const USER_B_ACCOUNTANT = { id: "USER-B2", username: "userB2", role: "ACCOUNTANT", companyIds: [COMPANY_B] };

const CONTRACT_A = { id: "CONTRACT-A1", company_id: COMPANY_A };

/**
 * ------------------------------------------------------------
 * SUITE 1 — ENTERPRISE UNLIMITED USER MODEL (license-service.js)
 * ------------------------------------------------------------
 *
 * license-service.js GERÇEK modülü kullanılır. Sadece db.query
 * fake'lenir; canAddUserToCompany gerçek kodla çalışır.
 */
describe("license-service.canAddUserToCompany — gerçek plan limitleri", () => {
  let licenseService;

  beforeEach(() => {
    jest.resetModules();
    licenseService = require("../backend/services/license-service");
  });

  afterEach(() => {
    jest.resetModules();
  });

  function fakeDb({ license, userCount, companyStatus = "ACTIVE" }) {
    return {
      query: jest.fn((sql) => {
        // P1: getActiveCompanyLicense/canAddUserToCompany artık önce
        // ağacın kökünü (getCompanyAncestryChain) ve ağacın tamamını
        // (getDescendantCompanyIds) sorguluyor (bkz.
        // services/organization-service.js). Bu testler tek başına
        // (parent_company_id NULL) bir şirketi simüle ediyor, bu
        // yüzden hem ancestry hem tree sorgusu için "ağaç = [COMPANY_A]"
        // dönülüyor — P1'in garanti ettiği geriye dönük uyumluluk
        // (root === companyId) burada da geçerli.
        if (sql.includes("WITH RECURSIVE ancestry")) {
          return Promise.resolve({
            rows: [{ id: COMPANY_A, parent_company_id: null, status: companyStatus, depth: 0 }]
          });
        }
        if (sql.includes("WITH RECURSIVE tree")) {
          return Promise.resolve({ rows: [{ id: COMPANY_A }] });
        }
        if (sql.includes("FROM company_licenses cl") && sql.includes("INNER JOIN plans p")) {
          return Promise.resolve({ rows: license ? [license] : [] });
        }
        // P1: getTreeActiveUserCount — ACTIVE kullanıcıları
        // user_companies + users JOIN ile sayan yeni tree-wide sorgu
        // (eski COUNT(*) sorgusunun yerini aldı — bkz.
        // services/license-service.js).
        if (sql.includes("FROM user_companies uc") && sql.includes("u.status = 'ACTIVE'")) {
          return Promise.resolve({ rows: [{ user_count: userCount }] });
        }
        if (sql.includes("FROM user_companies") && sql.includes("COUNT(*)")) {
          return Promise.resolve({ rows: [{ user_count: userCount }] });
        }
        return Promise.resolve({ rows: [] });
      })
    };
  }

  function makeLicense(planId, maxUsers) {
    return {
      id: `LIC-${planId}`,
      company_id: COMPANY_A,
      plan_id: planId,
      plan_name: planId,
      max_users: maxUsers,
      description: null,
      starts_at: new Date(Date.now() - 1000 * 60 * 60),
      expires_at: null,
      status: "active"
    };
  }

  test("Starter (max_users=3): limit altında -> allowed=true", async () => {
    const db = fakeDb({ license: makeLicense("starter", 3), userCount: 2 });
    const result = await licenseService.canAddUserToCompany(COMPANY_A, db);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe("AVAILABLE");
    expect(result.remainingUsers).toBe(1);
  });

  test("Starter (max_users=3): limite ulaşıldı -> allowed=false LIMIT_REACHED", async () => {
    const db = fakeDb({ license: makeLicense("starter", 3), userCount: 3 });
    const result = await licenseService.canAddUserToCompany(COMPANY_A, db);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("LIMIT_REACHED");
    expect(result.remainingUsers).toBe(0);
  });

  test("Professional (max_users=10): limit altında -> allowed=true", async () => {
    const db = fakeDb({ license: makeLicense("professional", 10), userCount: 9 });
    const result = await licenseService.canAddUserToCompany(COMPANY_A, db);
    expect(result.allowed).toBe(true);
    expect(result.remainingUsers).toBe(1);
  });

  test("Professional (max_users=10): limite ulaşıldı -> allowed=false", async () => {
    const db = fakeDb({ license: makeLicense("professional", 10), userCount: 10 });
    const result = await licenseService.canAddUserToCompany(COMPANY_A, db);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("LIMIT_REACHED");
  });

  test("Enterprise (max_users=NULL): çok yüksek kullanıcı sayısında dahi -> allowed=true UNLIMITED", async () => {
    const db = fakeDb({ license: makeLicense("enterprise", null), userCount: 999999 });
    const result = await licenseService.canAddUserToCompany(COMPANY_A, db);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe("UNLIMITED");
    expect(result.maxUsers).toBeNull();
    expect(result.remainingUsers).toBeNull();
  });

  test("Aktif lisans yok -> allowed=false NO_ACTIVE_LICENSE", async () => {
    const db = fakeDb({ license: null, userCount: 0 });
    const result = await licenseService.canAddUserToCompany(COMPANY_A, db);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("NO_ACTIVE_LICENSE");
  });
});

/**
 * ------------------------------------------------------------
 * SUITE 2 — POST /api/contracts — companyId SPOOF (tenant isolation)
 * ------------------------------------------------------------
 */
describe("POST /api/contracts — cross-tenant company_id spoof", () => {
  let app;
  let poolQueryMock;

  beforeEach(() => {
    jest.resetModules();
    poolQueryMock = jest.fn();

    jest.doMock("../backend/db/pool", () => ({
      query: poolQueryMock,
      connect: jest.fn()
    }));

    app = require("../backend/app");
  });

  afterEach(() => {
    jest.resetModules();
  });

  test("Company A kullanıcısı, body.companyId=Company B ile POST atarsa -> 403 ve hiçbir INSERT çalışmaz", async () => {
    const res = await request(app)
      .post("/api/contracts")
      .set(authHeader(USER_A))
      .send({
        id: "CONTRACT-SPOOF-1",
        companyId: COMPANY_B,
        company: "Sahte Şirket",
        supplier: "Tedarikçi",
        startDate: "2026-01-01",
        endDate: "2027-01-01"
      });

    expect(res.status).toBe(403);

    // requireCompanyLicense, kullanıcının companyIds listesinde
    // COMPANY_B olmadığını gördüğü an DB'ye hiç gitmeden reddeder.
    // Bu nedenle INSERT INTO contracts sorgusu hiçbir zaman
    // çalıştırılmamalıdır.
    const insertCalls = poolQueryMock.mock.calls.filter(
      ([sql]) => typeof sql === "string" && sql.includes("INSERT INTO contracts")
    );
    expect(insertCalls.length).toBe(0);
  });
});

/**
 * ------------------------------------------------------------
 * SUITE 3 — /api/contracts TAM CRUD TENANT ISOLATION
 * ------------------------------------------------------------
 */
describe("Contract full CRUD tenant isolation", () => {
  let app;
  let poolQueryMock;

  beforeEach(() => {
    jest.resetModules();
    poolQueryMock = jest.fn();

    jest.doMock("../backend/db/pool", () => ({
      query: poolQueryMock,
      connect: jest.fn()
    }));

    app = require("../backend/app");
  });

  afterEach(() => {
    jest.resetModules();
  });

  test("PUT /api/contracts/:id — başka şirketin kontratı -> 404 ve UPDATE çalışmaz", async () => {
    poolQueryMock.mockImplementation((sql) => {
      // Sahiplik sorgusu: company_id = ANY(USER_B.companyIds) ile
      // COMPANY_A'nın kontratı bulunamaz -> boş sonuç.
      if (sql.includes("SELECT") && sql.includes("company_id") && sql.includes("FROM contracts")) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .put(`/api/contracts/${CONTRACT_A.id}`)
      .set(authHeader(USER_B_ACCOUNTANT))
      .send({ monthlyPayment: 5000 });

    expect(res.status).toBe(404);

    const updateCalls = poolQueryMock.mock.calls.filter(
      ([sql]) => typeof sql === "string" && sql.includes("UPDATE contracts")
    );
    expect(updateCalls.length).toBe(0);
  });

  test("DELETE /api/contracts/:id — başka şirketin kontratı -> 404 ve DELETE çalışmaz", async () => {
    poolQueryMock.mockImplementation((sql) => {
      if (sql.includes("SELECT") && sql.includes("FROM contracts")) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .delete(`/api/contracts/${CONTRACT_A.id}`)
      .set(authHeader(USER_B_ACCOUNTANT));

    expect(res.status).toBe(404);

    const deleteCalls = poolQueryMock.mock.calls.filter(
      ([sql]) => typeof sql === "string" && sql.includes("DELETE FROM contracts")
    );
    expect(deleteCalls.length).toBe(0);
  });

  test("Company A kullanıcısı kendi kontratına: GET 200, PUT başarılı, DELETE başarılı", async () => {
    // --- GET ---
    poolQueryMock.mockImplementation((sql, params) => {
      if (sql.includes("FROM contracts c") && sql.includes("c.id = $1")) {
        const companyIds = params[1];
        if (companyIds.includes(CONTRACT_A.company_id)) {
          return Promise.resolve({ rows: [CONTRACT_A] });
        }
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    const getRes = await request(app)
      .get(`/api/contracts/${CONTRACT_A.id}`)
      .set(authHeader(USER_A));

    expect(getRes.status).toBe(200);

    // --- PUT ---
    poolQueryMock.mockReset();
    poolQueryMock.mockImplementation((sql) => {
      if (sql.includes("SELECT") && sql.includes("company_id") && sql.includes("FROM contracts") && !sql.includes("UPDATE")) {
        return Promise.resolve({ rows: [{ company_id: COMPANY_A }] });
      }
      if (sql.includes("FROM company_licenses") && sql.includes("SELECT 1")) {
        return Promise.resolve({ rows: [{ "?column?": 1 }] });
      }
      if (sql.includes("UPDATE contracts")) {
        return Promise.resolve({
          rows: [{ ...CONTRACT_A, monthly_payment: 5000 }]
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const putRes = await request(app)
      .put(`/api/contracts/${CONTRACT_A.id}`)
      .set(authHeader(USER_A_ACCOUNTANT))
      .send({ monthlyPayment: 5000 });

    expect(putRes.status).toBe(200);
    const updateCalls = poolQueryMock.mock.calls.filter(
      ([sql]) => typeof sql === "string" && sql.includes("UPDATE contracts")
    );
    expect(updateCalls.length).toBe(1);

    // --- DELETE ---
    poolQueryMock.mockReset();
    poolQueryMock.mockImplementation((sql) => {
      if (sql.includes("SELECT") && sql.includes("company_id") && sql.includes("FROM contracts")) {
        return Promise.resolve({ rows: [{ company_id: COMPANY_A }] });
      }
      if (sql.includes("FROM company_licenses") && sql.includes("SELECT 1")) {
        return Promise.resolve({ rows: [{ "?column?": 1 }] });
      }
      if (sql.includes("DELETE FROM contracts")) {
        return Promise.resolve({ rows: [{ id: CONTRACT_A.id }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const deleteRes = await request(app)
      .delete(`/api/contracts/${CONTRACT_A.id}`)
      .set(authHeader(USER_A_ACCOUNTANT));

    expect(deleteRes.status).toBe(204);
    const deleteCalls = poolQueryMock.mock.calls.filter(
      ([sql]) => typeof sql === "string" && sql.includes("DELETE FROM contracts")
    );
    expect(deleteCalls.length).toBe(1);
  });
});

/**
 * ------------------------------------------------------------
 * SUITE 4 — ADMIN LICENSE SECURITY (routes/admin-licenses.js)
 * ------------------------------------------------------------
 */
describe("Admin license endpoints — auth & business logic", () => {
  let app;
  let poolQueryMock;
  let clientQueryMock;
  let poolConnectMock;

  beforeEach(() => {
    jest.resetModules();
    poolQueryMock = jest.fn();
    clientQueryMock = jest.fn().mockResolvedValue({ rows: [] });
    poolConnectMock = jest.fn().mockResolvedValue({
      query: clientQueryMock,
      release: jest.fn()
    });

    jest.doMock("../backend/db/pool", () => ({
      query: poolQueryMock,
      connect: poolConnectMock
    }));

    app = require("../backend/app");
  });

  afterEach(() => {
    jest.resetModules();
  });

  test("unauthenticated request -> 401", async () => {
    const res = await request(app).get("/api/admin/plans");
    expect(res.status).toBe(401);
  });

  test("non-admin authenticated user -> 403", async () => {
    const res = await request(app)
      .get("/api/admin/plans")
      .set(authHeader(USER_A));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("ADMIN_REQUIRED");
  });

  test("ADMIN -> GET /api/admin/plans başarılı (200)", async () => {
    poolQueryMock.mockResolvedValue({
      rows: [
        { id: "starter", name: "Starter", max_users: 3, description: null },
        { id: "professional", name: "Professional", max_users: 10, description: null },
        { id: "enterprise", name: "Enterprise", max_users: null, description: null }
      ]
    });

    const res = await request(app)
      .get("/api/admin/plans")
      .set(authHeader(ADMIN_USER));

    expect(res.status).toBe(200);
    expect(res.body.plans).toHaveLength(3);
    expect(res.body.plans.find(p => p.id === "enterprise").max_users).toBeNull();
  });

  test("geçersiz companyId -> GET license 404", async () => {
    poolQueryMock.mockResolvedValue({ rows: [] });

    const res = await request(app)
      .get("/api/admin/companies/NOPE/license")
      .set(authHeader(ADMIN_USER));

    expect(res.status).toBe(404);
  });

  test("ADMIN -> aktif lisans oluşturma (POST) başarılı (201)", async () => {
    clientQueryMock.mockImplementation((sql) => {
      if (sql.includes("BEGIN") || sql.includes("COMMIT") || sql.includes("ROLLBACK")) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes("FROM companies") && sql.includes("FOR UPDATE")) {
        return Promise.resolve({ rows: [{ id: COMPANY_A, name: "Company A" }] });
      }
      if (sql.includes("FROM plans")) {
        return Promise.resolve({
          rows: [{ id: "professional", name: "Professional", max_users: 10, description: "desc" }]
        });
      }
      if (sql.includes("UPDATE company_licenses") && sql.includes("cancelled")) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes("INSERT INTO company_licenses")) {
        return Promise.resolve({
          rows: [{
            id: "LIC-NEW",
            company_id: COMPANY_A,
            plan_id: "professional",
            starts_at: new Date(),
            expires_at: null,
            status: "active",
            created_at: new Date()
          }]
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .post(`/api/admin/companies/${COMPANY_A}/license`)
      .set(authHeader(ADMIN_USER))
      .send({ planId: "professional" });

    expect(res.status).toBe(201);
    expect(res.body.license.status).toBe("active");
  });

  test("aynı company için ikinci lisans oluşturma: önce eski aktif lisans cancel edilir (application-level tekillik)", async () => {
    const calledSqls = [];

    clientQueryMock.mockImplementation((sql) => {
      calledSqls.push(sql);
      if (sql.includes("BEGIN") || sql.includes("COMMIT") || sql.includes("ROLLBACK")) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes("FROM companies") && sql.includes("FOR UPDATE")) {
        return Promise.resolve({ rows: [{ id: COMPANY_A, name: "Company A" }] });
      }
      if (sql.includes("FROM plans")) {
        return Promise.resolve({
          rows: [{ id: "enterprise", name: "Enterprise", max_users: null, description: null }]
        });
      }
      if (sql.includes("UPDATE company_licenses") && sql.includes("cancelled")) {
        return Promise.resolve({ rows: [{ id: "LIC-OLD" }] });
      }
      if (sql.includes("INSERT INTO company_licenses")) {
        return Promise.resolve({
          rows: [{
            id: "LIC-NEW-2",
            company_id: COMPANY_A,
            plan_id: "enterprise",
            starts_at: new Date(),
            expires_at: null,
            status: "active",
            created_at: new Date()
          }]
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .post(`/api/admin/companies/${COMPANY_A}/license`)
      .set(authHeader(ADMIN_USER))
      .send({ planId: "enterprise" });

    expect(res.status).toBe(201);

    const cancelIndex = calledSqls.findIndex(sql => sql.includes("UPDATE company_licenses") && sql.includes("cancelled"));
    const insertIndex = calledSqls.findIndex(sql => sql.includes("INSERT INTO company_licenses"));

    expect(cancelIndex).toBeGreaterThan(-1);
    expect(insertIndex).toBeGreaterThan(-1);
    // Eski aktif lisans, yenisi eklenmeden ÖNCE cancel edilir —
    // bu sayede uygulama seviyesinde her zaman tek aktif lisans
    // garantisi sağlanır (DB'deki partial unique index bu kuralın
    // ikinci, alt seviye güvencesidir).
    expect(cancelIndex).toBeLessThan(insertIndex);
  });

  test("DB unique constraint (23505) INSERT sırasında tetiklenirse -> 500 ve ROLLBACK (DB seviyesi backstop)", async () => {
    clientQueryMock.mockImplementation((sql) => {
      if (sql.includes("BEGIN") || sql.includes("COMMIT") || sql.includes("ROLLBACK")) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes("FROM companies") && sql.includes("FOR UPDATE")) {
        return Promise.resolve({ rows: [{ id: COMPANY_A, name: "Company A" }] });
      }
      if (sql.includes("FROM plans")) {
        return Promise.resolve({
          rows: [{ id: "starter", name: "Starter", max_users: 3, description: null }]
        });
      }
      if (sql.includes("UPDATE company_licenses") && sql.includes("cancelled")) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes("INSERT INTO company_licenses")) {
        const err = new Error("duplicate key value violates unique constraint");
        err.code = "23505";
        return Promise.reject(err);
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .post(`/api/admin/companies/${COMPANY_A}/license`)
      .set(authHeader(ADMIN_USER))
      .send({ planId: "starter" });

    expect(res.status).toBe(500);

    const rollbackCalls = clientQueryMock.mock.calls.filter(
      ([sql]) => typeof sql === "string" && sql.includes("ROLLBACK")
    );
    expect(rollbackCalls.length).toBeGreaterThan(0);
  });

  test("ADMIN -> lisans süresi uzatma (PATCH extend) başarılı", async () => {
    clientQueryMock.mockImplementation((sql) => {
      if (sql.includes("BEGIN") || sql.includes("COMMIT") || sql.includes("ROLLBACK")) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes("FROM company_licenses") && sql.includes("FOR UPDATE")) {
        return Promise.resolve({
          rows: [{
            id: "LIC-1",
            company_id: COMPANY_A,
            starts_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
            expires_at: null,
            status: "active"
          }]
        });
      }
      if (sql.includes("UPDATE company_licenses") && sql.includes("expires_at")) {
        return Promise.resolve({
          rows: [{
            id: "LIC-1",
            company_id: COMPANY_A,
            plan_id: "professional",
            starts_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
            expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
            status: "active",
            created_at: new Date()
          }]
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .patch("/api/admin/licenses/LIC-1/extend")
      .set(authHeader(ADMIN_USER))
      .send({ additionalMonths: 12 });

    expect(res.status).toBe(200);
    expect(res.body.license.status).toBe("active");
  });

  test("ADMIN -> lisans iptali (cancel) başarılı", async () => {
    poolQueryMock.mockResolvedValue({
      rows: [{
        id: "LIC-1",
        company_id: COMPANY_A,
        plan_id: "professional",
        starts_at: new Date(),
        expires_at: null,
        status: "cancelled",
        created_at: new Date()
      }]
    });

    const res = await request(app)
      .post("/api/admin/licenses/LIC-1/cancel")
      .set(authHeader(ADMIN_USER));

    expect(res.status).toBe(200);
    expect(res.body.license.status).toBe("cancelled");
  });

  test("ADMIN -> zaten iptal edilmiş / var olmayan lisansı cancel etmeye çalışırsa -> 404", async () => {
    poolQueryMock.mockResolvedValue({ rows: [] });

    const res = await request(app)
      .post("/api/admin/licenses/LIC-DOESNOTEXIST/cancel")
      .set(authHeader(ADMIN_USER));

    expect(res.status).toBe(404);
  });
});

/**
 * ------------------------------------------------------------
 * SUITE 5 — POST /api/auth/register — KULLANICI LİMİTİ (HTTP)
 * ------------------------------------------------------------
 *
 * license-service.js gerçek modülü kullanılır (mock'lanmaz);
 * sadece pool.connect() ile dönen client.query fake'lenir.
 */
describe("POST /api/auth/register — kullanıcı limiti (uçtan uca)", () => {
  let app;
  let poolQueryMock;
  let clientQueryMock;
  let poolConnectMock;

  const ADMIN_OF_A = { id: "ADMIN-A", username: "adminA", role: "ADMIN", companyIds: [COMPANY_A] };

  beforeEach(() => {
    jest.resetModules();
    // register handler, transaction commit sonrasında getUserLicenses(id)'i
    // client (transaction) ÜZERİNDEN DEĞİL, düz `pool` üzerinden çağırır
    // (db/pool.js'teki modül seviyesi pool). Bu yüzden poolQueryMock'a
    // sağlıklı bir varsayılan {rows: []} veriyoruz; aksi halde
    // `result.rows` undefined üzerinde patlar ve response 500 döner.
    poolQueryMock = jest.fn().mockResolvedValue({ rows: [] });
    clientQueryMock = jest.fn();
    poolConnectMock = jest.fn().mockResolvedValue({
      query: clientQueryMock,
      release: jest.fn()
    });

    jest.doMock("../backend/db/pool", () => ({
      query: poolQueryMock,
      connect: poolConnectMock
    }));

    app = require("../backend/app");
  });

  afterEach(() => {
    jest.resetModules();
  });

  function mockRegisterFlow({ license, currentUserCount }) {
    clientQueryMock.mockImplementation((sql) => {
      if (sql.includes("BEGIN") || sql.includes("COMMIT") || sql.includes("ROLLBACK")) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes("FROM companies") && sql.includes("FOR UPDATE")) {
        return Promise.resolve({ rows: [{ id: COMPANY_A }] });
      }
      // P1: getActiveCompanyLicense/canAddUserToCompany artık önce
      // ağacın kökünü (ancestry) ve tamamını (tree) sorguluyor —
      // bkz. fakeDb() içindeki aynı not (Suite 1). COMPANY_A burada
      // da tek başına (parent=NULL) bir şirket olarak simüle ediliyor.
      if (sql.includes("WITH RECURSIVE ancestry")) {
        return Promise.resolve({
          rows: [{ id: COMPANY_A, parent_company_id: null, status: "ACTIVE", depth: 0 }]
        });
      }
      if (sql.includes("WITH RECURSIVE tree")) {
        return Promise.resolve({ rows: [{ id: COMPANY_A }] });
      }
      if (sql.includes("FROM company_licenses cl") && sql.includes("INNER JOIN plans p")) {
        return Promise.resolve({ rows: license ? [license] : [] });
      }
      // P1: getTreeActiveUserCount — bkz. fakeDb() içindeki aynı not.
      if (sql.includes("FROM user_companies uc") && sql.includes("u.status = 'ACTIVE'")) {
        return Promise.resolve({ rows: [{ user_count: currentUserCount }] });
      }
      if (sql.includes("FROM user_companies") && sql.includes("COUNT(*)")) {
        return Promise.resolve({ rows: [{ user_count: currentUserCount }] });
      }
      if (sql.includes("INSERT INTO users")) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes("INSERT INTO user_companies")) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });
  }

  test("Starter plan limitine ulaşılmışsa yeni kullanıcı -> 403 USER_LIMIT_REACHED", async () => {
    mockRegisterFlow({
      license: {
        id: "LIC-A", company_id: COMPANY_A, plan_id: "starter", plan_name: "Starter",
        max_users: 3, description: null, starts_at: new Date(), expires_at: null, status: "active"
      },
      currentUserCount: 3
    });

    const res = await request(app)
      .post("/api/auth/register")
      .set(authHeader(ADMIN_OF_A))
      .send({
        id: "NEW-USER-1",
        username: "newuser1",
        password: "password1234",
        companyIds: [COMPANY_A]
      });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("USER_LIMIT_REACHED");

    const userInsertCalls = clientQueryMock.mock.calls.filter(
      ([sql]) => typeof sql === "string" && sql.includes("INSERT INTO users")
    );
    expect(userInsertCalls.length).toBe(0);
  });

  test("Enterprise plan (max_users=NULL): çok sayıda mevcut kullanıcıya rağmen yeni kullanıcı reddedilmez", async () => {
    mockRegisterFlow({
      license: {
        id: "LIC-A", company_id: COMPANY_A, plan_id: "enterprise", plan_name: "Enterprise",
        max_users: null, description: null, starts_at: new Date(), expires_at: null, status: "active"
      },
      currentUserCount: 5000
    });

    const res = await request(app)
      .post("/api/auth/register")
      .set(authHeader(ADMIN_OF_A))
      .send({
        id: "NEW-USER-2",
        username: "newuser2",
        password: "password1234",
        companyIds: [COMPANY_A]
      });

    expect(res.status).toBe(201);

    const userInsertCalls = clientQueryMock.mock.calls.filter(
      ([sql]) => typeof sql === "string" && sql.includes("INSERT INTO users")
    );
    expect(userInsertCalls.length).toBe(1);
  });

  test("Starter plan limit altındaysa yeni kullanıcı ekleme başarılı (201)", async () => {
    mockRegisterFlow({
      license: {
        id: "LIC-A", company_id: COMPANY_A, plan_id: "starter", plan_name: "Starter",
        max_users: 3, description: null, starts_at: new Date(), expires_at: null, status: "active"
      },
      currentUserCount: 1
    });

    const res = await request(app)
      .post("/api/auth/register")
      .set(authHeader(ADMIN_OF_A))
      .send({
        id: "NEW-USER-3",
        username: "newuser3",
        password: "password1234",
        companyIds: [COMPANY_A]
      });

    expect(res.status).toBe(201);
  });
});
