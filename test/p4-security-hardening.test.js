/**
 * @jest-environment node
 *
 * ============================================================
 * P4 — SECURITY HARDENING TESTS
 * ============================================================
 *
 * bkz. test/license-security.test.js başındaki jsdom notu — bu
 * dosya da app.js (admin.js) yüklediği için @jest-environment node
 * gerekiyor.
 *
 * Kapsam (P4 talimatı madde 16 test gruplarından, gerçekten
 * çalıştırılabilir olanlar):
 *  A — Company tree integrity (self-parent savunması, cycle'ın
 *      yapısal olarak imkansız olduğunu kanıtlayan test)
 *  B — Authorization (parent/ancestor scope bypass)
 *  C — Limits (INACTIVE→ACTIVE boundary — P3'ün test edilmemiş
 *      bıraktığı asıl gap)
 *  D — License (max_contracts / max_companies boundary: limit-1,
 *      limit, limit+1)
 *  E — IDOR (customer.js — P3 madde 4'te istenen senaryolar)
 *  F — Password (mustChangePassword uçtan uca akış)
 *  + Audit cross-holding scope (P4 madde 15)
 */

process.env.JWT_SECRET =
  process.env.JWT_SECRET || "test-only-secret-do-not-use-in-prod";

const request = require("supertest");
const { signUserToken } = require("../backend/utils/jwt");

function authHeader(payload) {
  const token = signUserToken(payload);
  return { Authorization: `Bearer ${token}` };
}

const COMPANY_ROOT = "ROOT-A";
const COMPANY_CHILD = "CHILD-A1";
const COMPANY_SIBLING_TREE = "ROOT-B";

const ADMIN_USER = { id: "USER-ADMIN", username: "admin", role: "ADMIN", companyIds: [] };
const MANAGER_CHILD = {
  id: "MGR-CHILD",
  username: "mgrChild",
  role: "ACCOUNTANT_MANAGER",
  companyIds: [COMPANY_CHILD]
};

/**
 * ============================================================
 * A — COMPANY TREE INTEGRITY
 * ============================================================
 */
describe("P4 — A: Company tree integrity", () => {
  let poolQueryMock;
  let poolConnectMock;
  let clientQueryMock;
  let app;

  beforeEach(() => {
    jest.resetModules();

    poolQueryMock = jest.fn();
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

  test("Cycle YAPISAL OLARAK İMKANSIZ: parent_company_id yalnızca var olan bir şirkete referans verebilir ve hiçbir route bunu SONRADAN değiştirmiyor — bu yüzden var olmayan bir şirketi parent göstermek 400 ile reddedilir", async () => {
    // Bir A→B→C→A döngüsü kurabilmek için C'nin B'yi, B'nin A'yı
    // parent göstermesi gerekir — ama her ikisi de INSERT anında
    // parent'ın GERÇEKTEN var olmasını zorunlu kılıyor (aşağıda
    // doğrulanıyor) ve hiçbir PATCH/PUT route parent_company_id'yi
    // sonradan değiştirmiyor (bkz. grep: routes/*.js içinde
    // "parent_company_id" geçen tek UPDATE yolu YOK). Yani bir
    // döngü tamamlanamadan önce zincirin en az bir halkası "henüz
    // var olmayan bir şirketi parent gösterme" hatasına çarpar.
    clientQueryMock.mockImplementation((sql) => {
      if (sql.includes("BEGIN") || sql.includes("ROLLBACK") || sql.includes("COMMIT")) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes("SELECT id") && sql.includes("FROM companies") && sql.includes("WHERE code")) {
        return Promise.resolve({ rows: [] }); // code unique
      }
      if (sql.includes("FOR UPDATE")) {
        return Promise.resolve({ rows: [] }); // parent bulunamadı
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .post("/api/org/companies")
      .set(authHeader(ADMIN_USER))
      .send({ name: "Ghost Parent Şirketi", code: "GHOST1", parent_company_id: "DOES-NOT-EXIST" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/does not exist/);
  });

  test("Self-parent CHECK constraint (23514) çıplak 500 yerine 400 döner (savunma amaçlı, admin.js POST /companies)", async () => {
    clientQueryMock.mockImplementation((sql) => {
      if (sql.includes("BEGIN") || sql.includes("ROLLBACK") || sql.includes("COMMIT")) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes("SELECT id") && sql.includes("FROM companies") && sql.includes("code = $1")) {
        return Promise.resolve({ rows: [] });
      }
      // DÜZELTME: admin.js POST /companies, parent_company_id verilmişse
      // önce `SELECT id FROM companies WHERE id = $1` ile parent'ın VAR
      // OLDUĞUNU doğruluyor. Bu mock o deseni tanımıyordu (yalnızca
      // `code = $1` ve `FOR UPDATE` desenlerini biliyordu), boş rows
      // dönüyor ve route INSERT'e HİÇ ULAŞMADAN "parent does not exist"
      // (400) ile çıkıyordu — bu yüzden testin asıl doğrulamak istediği
      // 23514 (self-parent CHECK) → 400 dönüşümü hiç test edilemiyordu.
      // Üretim kodu DOĞRU; eksik olan mock'tu.
      // NOT: desen DAR tutulur (FOR UPDATE / code = $1 / WITH RECURSIVE
      // içermemeli) ki license-service'in kendi sorgularını yanlışlıkla
      // yakalamasın. Özellikle getCompanyAncestryChain'in SQL'i de
      // "WHERE id = $1" içeriyor ama "WITH RECURSIVE ancestry" ile
      // başlıyor — o kural bu mock'tan ÖNCE eşleşmeli, aksi halde
      // canAddCompanyToTree kökü bulamayıp NO_ACTIVE_LICENSE (403)
      // dönüyordu.
      if (
        sql.includes("SELECT id") &&
        sql.includes("FROM companies") &&
        sql.includes("WHERE id = $1") &&
        !sql.includes("FOR UPDATE") &&
        !sql.includes("code = $1") &&
        !sql.includes("WITH RECURSIVE")
      ) {
        return Promise.resolve({ rows: [{ id: COMPANY_ROOT }] });
      }
      if (sql.includes("FOR UPDATE")) {
        return Promise.resolve({ rows: [{ id: COMPANY_ROOT }] });
      }
      if (sql.includes("WITH RECURSIVE ancestry")) {
        return Promise.resolve({
          rows: [{ id: COMPANY_ROOT, parent_company_id: null, status: "ACTIVE", depth: 0 }]
        });
      }
      if (sql.includes("FROM company_licenses cl") && sql.includes("INNER JOIN plans p")) {
        return Promise.resolve({
          rows: [
            {
              id: "LIC-1", company_id: COMPANY_ROOT, plan_id: "enterprise", plan_name: "Enterprise",
              max_companies: null, description: null, starts_at: new Date(), expires_at: null, status: "active"
            }
          ]
        });
      }
      if (sql.includes("WITH RECURSIVE tree")) {
        return Promise.resolve({ rows: [{ id: COMPANY_ROOT }] });
      }
      if (sql.includes("INSERT INTO companies")) {
        const err = new Error(
          'new row for relation "companies" violates check constraint "chk_companies_not_self_parent"'
        );
        err.code = "23514";
        return Promise.reject(err);
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .post("/api/admin/companies")
      .set(authHeader(ADMIN_USER))
      .send({ name: "X", code: "SELFP1", parent_company_id: COMPANY_ROOT });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/kendi üst şirketi/);
  });
});

/**
 * ============================================================
 * B — AUTHORIZATION: ANCESTOR / PARENT SCOPE BYPASS
 * ============================================================
 * Gerçek organization-service.js kullanılır (mock'lanmaz) —
 * resolveAccessScope'un GERÇEK recursive CTE davranışını (yalnızca
 * aşağı, asla yukarı) doğrulamak asıl amaç.
 * ============================================================
 */
describe("P4 — B: Manager kendi ağacının ÜSTÜNÜ (ancestor/parent) parent gösteremez", () => {
  let poolQueryMock;
  let app;

  beforeEach(() => {
    jest.resetModules();
    poolQueryMock = jest.fn();
    jest.doMock("../backend/db/pool", () => ({ query: poolQueryMock, connect: jest.fn() }));
    app = require("../backend/app");
  });

  afterEach(() => {
    jest.resetModules();
  });

  test("MANAGER_CHILD (COMPANY_CHILD'a atanmış), kendi ATASI olan COMPANY_ROOT'u yeni bir kardeş şirketin parent'ı gösterirse -> 403 COMPANY_ACCESS_DENIED", async () => {
    // resolveAccessScope(MANAGER_CHILD) -> getDescendantCompanyIdsForMany([COMPANY_CHILD])
    // -> yalnızca COMPANY_CHILD'ın kendi alt ağacı (kendisi, çocuğu yoksa
    // sadece kendisi) döner — COMPANY_ROOT (üstü) KESİNLİKLE dahil DEĞİL.
    poolQueryMock.mockImplementation((sql) => {
      if (sql.includes("WITH RECURSIVE tree")) {
        return Promise.resolve({ rows: [{ id: COMPANY_CHILD }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .post("/api/org/companies")
      .set(authHeader(MANAGER_CHILD))
      .send({ name: "Yeni Kardeş Şirket", code: "SIB1", parent_company_id: COMPANY_ROOT });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("COMPANY_ACCESS_DENIED");
  });

  test("MANAGER_CHILD, tamamen başka bir holding'in (COMPANY_SIBLING_TREE) altına şirket eklemeye çalışırsa -> 403", async () => {
    poolQueryMock.mockImplementation((sql) => {
      if (sql.includes("WITH RECURSIVE tree")) {
        return Promise.resolve({ rows: [{ id: COMPANY_CHILD }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .post("/api/org/companies")
      .set(authHeader(MANAGER_CHILD))
      .send({ name: "X", code: "OTH1", parent_company_id: COMPANY_SIBLING_TREE });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("COMPANY_ACCESS_DENIED");
  });
});

/**
 * ============================================================
 * C — LIMITS: INACTIVE → ACTIVE BOUNDARY (P3'ün test edilmemiş
 * bıraktığı, P4 madde 3.1'in özellikle istediği asıl gap)
 * ============================================================
 */
describe("P4 — C: PATCH /api/admin/users/:id — INACTIVE→ACTIVE max_users kontrolü", () => {
  let clientQueryMock;
  let poolQueryMock;
  let app;

  const TARGET_USER_ID = "USER-TARGET";

  function mockPatchFlow({ currentStatus, maxUsers, activeUserCount }) {
    clientQueryMock.mockImplementation((sql, params) => {
      if (sql.includes("BEGIN") || sql.includes("ROLLBACK") || sql.includes("COMMIT")) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes("FROM users") && sql.includes("FOR UPDATE")) {
        return Promise.resolve({
          rows: [
            {
              id: TARGET_USER_ID,
              username: "target",
              role: "VIEWER",
              status: currentStatus,
              email: null,
              first_name: null,
              last_name: null
            }
          ]
        });
      }
      if (sql.includes("FROM user_companies") && sql.includes("WHERE user_id")) {
        return Promise.resolve({ rows: [{ company_id: COMPANY_ROOT }] });
      }
      if (sql.includes("WITH RECURSIVE ancestry")) {
        return Promise.resolve({
          rows: [{ id: COMPANY_ROOT, parent_company_id: null, status: "ACTIVE", depth: 0 }]
        });
      }
      if (sql.includes("FROM company_licenses cl") && sql.includes("INNER JOIN plans p")) {
        return Promise.resolve({
          rows: [
            {
              id: "LIC-1", company_id: COMPANY_ROOT, plan_id: "starter", plan_name: "Starter",
              max_users: maxUsers, description: null, starts_at: new Date(), expires_at: null, status: "active"
            }
          ]
        });
      }
      if (sql.includes("WITH RECURSIVE tree")) {
        return Promise.resolve({ rows: [{ id: COMPANY_ROOT }] });
      }
      if (sql.includes("FROM user_companies") && sql.includes("uc.user_id")) {
        return Promise.resolve({ rows: [{ user_count: activeUserCount }] });
      }
      if (sql.includes("UPDATE users")) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });
  }

  beforeEach(() => {
    jest.resetModules();
    poolQueryMock = jest.fn();
    clientQueryMock = jest.fn();
    jest.doMock("../backend/db/pool", () => ({
      query: poolQueryMock,
      connect: jest.fn().mockResolvedValue({ query: clientQueryMock, release: jest.fn() })
    }));
    app = require("../backend/app");
  });

  afterEach(() => {
    jest.resetModules();
  });

  test("Limit dolu (3/3 ACTIVE) iken INACTIVE kullanıcıyı ACTIVE yapmak -> 403 LIMIT_REACHED, UPDATE hiç çalışmaz", async () => {
    mockPatchFlow({ currentStatus: "INACTIVE", maxUsers: 3, activeUserCount: 3 });

    const res = await request(app)
      .patch(`/api/admin/users/${TARGET_USER_ID}`)
      .set(authHeader(ADMIN_USER))
      .send({ status: "ACTIVE" });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("LIMIT_REACHED");

    const updateCalls = clientQueryMock.mock.calls.filter(
      ([sql]) => typeof sql === "string" && sql.includes("UPDATE users")
    );
    expect(updateCalls.length).toBe(0);
  });

  test("Limit altında (2/3 ACTIVE) iken INACTIVE kullanıcıyı ACTIVE yapmak -> başarılı (200)", async () => {
    mockPatchFlow({ currentStatus: "INACTIVE", maxUsers: 3, activeUserCount: 2 });

    const res = await request(app)
      .patch(`/api/admin/users/${TARGET_USER_ID}`)
      .set(authHeader(ADMIN_USER))
      .send({ status: "ACTIVE" });

    expect(res.status).toBe(200);

    const updateCalls = clientQueryMock.mock.calls.filter(
      ([sql]) => typeof sql === "string" && sql.includes("UPDATE users")
    );
    expect(updateCalls.length).toBe(1);
  });

  test("Zaten ACTIVE olan bir kullanıcıyı tekrar ACTIVE yapmak (durum değişmiyor) limit kontrolünü TETİKLEMEZ", async () => {
    // isReactivating = status==='ACTIVE' && currentUser.status !== 'ACTIVE'
    // — mevcut durum zaten ACTIVE ise bu bir "reaktivasyon" değildir,
    // gereksiz bir kapasite kontrolü YAPILMAMALI (limit tam dolu olsa
    // bile zaten sayılmış bir kullanıcının durumu değişmediği için
    // hiçbir yeni koltuk harcanmıyor).
    mockPatchFlow({ currentStatus: "ACTIVE", maxUsers: 1, activeUserCount: 1 });

    const res = await request(app)
      .patch(`/api/admin/users/${TARGET_USER_ID}`)
      .set(authHeader(ADMIN_USER))
      .send({ status: "ACTIVE" });

    expect(res.status).toBe(200);
  });

  test("Limit tam sınırda (limit-1 dolu, 1 boşluk var) iken reaktivasyon başarılı", async () => {
    mockPatchFlow({ currentStatus: "INACTIVE", maxUsers: 3, activeUserCount: 2 });

    const res = await request(app)
      .patch(`/api/admin/users/${TARGET_USER_ID}`)
      .set(authHeader(ADMIN_USER))
      .send({ status: "ACTIVE" });

    expect(res.status).toBe(200);
  });
});

/**
 * ============================================================
 * D — LICENSE: max_contracts / max_companies BOUNDARY
 * (limit-1 / limit / limit+1) — license-service.js GERÇEK modülü
 * ============================================================
 */
describe("P4 — D: license-service boundary — max_contracts / max_companies", () => {
  let licenseService;

  beforeEach(() => {
    jest.resetModules();
    licenseService = require("../backend/services/license-service");
  });

  afterEach(() => {
    jest.resetModules();
  });

  function fakeDb({ license, contractCount, companyCount }) {
    return {
      query: jest.fn((sql) => {
        if (sql.includes("WITH RECURSIVE ancestry")) {
          return Promise.resolve({
            rows: [{ id: COMPANY_ROOT, parent_company_id: null, status: "ACTIVE", depth: 0 }]
          });
        }
        if (sql.includes("WITH RECURSIVE tree")) {
          // getDescendantCompanyIds: companyCount kadar sahte id üret
          return Promise.resolve({
            rows: Array.from({ length: companyCount || 1 }, (_, i) => ({ id: `C-${i}` }))
          });
        }
        if (sql.includes("FROM company_licenses cl") && sql.includes("INNER JOIN plans p")) {
          return Promise.resolve({ rows: license ? [license] : [] });
        }
        if (sql.includes("FROM contracts") && sql.includes("COUNT(*)")) {
          return Promise.resolve({ rows: [{ contract_count: contractCount }] });
        }
        return Promise.resolve({ rows: [] });
      })
    };
  }

  function makeLicense(maxContracts, maxCompanies) {
    return {
      id: "LIC-1", company_id: COMPANY_ROOT, plan_id: "professional", plan_name: "Professional",
      max_contracts: maxContracts, max_companies: maxCompanies, description: null,
      starts_at: new Date(Date.now() - 1000), expires_at: null, status: "active"
    };
  }

  test("max_contracts=10: 9 mevcut (limit-1) -> allowed=true", async () => {
    const db = fakeDb({ license: makeLicense(10, null), contractCount: 9 });
    const result = await licenseService.canAddContractToCompany(COMPANY_ROOT, db);
    expect(result.allowed).toBe(true);
    expect(result.remainingContracts).toBe(1);
  });

  test("max_contracts=10: 10 mevcut (limit) -> allowed=false LIMIT_REACHED", async () => {
    const db = fakeDb({ license: makeLicense(10, null), contractCount: 10 });
    const result = await licenseService.canAddContractToCompany(COMPANY_ROOT, db);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("LIMIT_REACHED");
  });

  test("max_contracts=10: 11 mevcut (limit+1, tutarsız veri) -> allowed=false, remainingContracts negatif değil (0'a clamp)", async () => {
    const db = fakeDb({ license: makeLicense(10, null), contractCount: 11 });
    const result = await licenseService.canAddContractToCompany(COMPANY_ROOT, db);
    expect(result.allowed).toBe(false);
    expect(result.remainingContracts).toBe(0);
  });

  test("max_companies=5: ağaçta 4 şirket (limit-1) -> allowed=true", async () => {
    const db = fakeDb({ license: makeLicense(null, 5), companyCount: 4 });
    const result = await licenseService.canAddCompanyToTree(COMPANY_ROOT, db);
    expect(result.allowed).toBe(true);
    expect(result.remainingCompanies).toBe(1);
  });

  test("max_companies=5: ağaçta 5 şirket (limit) -> allowed=false LIMIT_REACHED", async () => {
    const db = fakeDb({ license: makeLicense(null, 5), companyCount: 5 });
    const result = await licenseService.canAddCompanyToTree(COMPANY_ROOT, db);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("LIMIT_REACHED");
  });
});

/**
 * ============================================================
 * E — IDOR: customer.js (P4 madde 4 — senaryolar A-F)
 * ============================================================
 */
describe("P4 — E: GET /api/customer/license scope güvenliği", () => {
  let poolQueryMock;
  let app;

  const CUSTOMER_USER = { id: "CUST-1", username: "cust1", role: "VIEWER", companyIds: [COMPANY_CHILD] };
  const NO_COMPANY_USER = { id: "CUST-2", username: "cust2", role: "VIEWER", companyIds: [] };

  beforeEach(() => {
    jest.resetModules();
    poolQueryMock = jest.fn();
    jest.doMock("../backend/db/pool", () => ({ query: poolQueryMock, connect: jest.fn() }));
    app = require("../backend/app");
  });

  afterEach(() => {
    jest.resetModules();
  });

  test("Senaryo E — Child company kullanıcısı, ROOT'a bağlı lisansı miras yoluyla görür", async () => {
    poolQueryMock.mockImplementation((sql) => {
      if (sql.includes("WITH RECURSIVE ancestry")) {
        // CHILD -> ROOT zinciri: lisans ROOT'ta.
        return Promise.resolve({
          rows: [
            { id: COMPANY_CHILD, parent_company_id: COMPANY_ROOT, status: "ACTIVE", depth: 0 },
            { id: COMPANY_ROOT, parent_company_id: null, status: "ACTIVE", depth: 1 }
          ]
        });
      }
      if (sql.includes("FROM company_licenses cl") && sql.includes("INNER JOIN plans p")) {
        return Promise.resolve({
          rows: [
            {
              id: "LIC-1", company_id: COMPANY_ROOT, plan_id: "professional", plan_name: "Professional",
              max_users: 10, description: null, starts_at: new Date(), expires_at: null, status: "active"
            }
          ]
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app).get("/api/customer/license").set(authHeader(CUSTOMER_USER));

    expect(res.status).toBe(200);
    expect(res.body.data.plan_name).toBe("Professional");
    expect(res.body.data.max_users).toBe(10);
  });

  test("Senaryo F — Custom override, child company için de efektif değeri yansıtır", async () => {
    poolQueryMock.mockImplementation((sql) => {
      if (sql.includes("WITH RECURSIVE ancestry")) {
        return Promise.resolve({
          rows: [
            { id: COMPANY_CHILD, parent_company_id: COMPANY_ROOT, status: "ACTIVE", depth: 0 },
            { id: COMPANY_ROOT, parent_company_id: null, status: "ACTIVE", depth: 1 }
          ]
        });
      }
      if (sql.includes("FROM company_licenses cl") && sql.includes("INNER JOIN plans p")) {
        // COALESCE(override, plan) SQL'in İÇİNDE hesaplanıyor —
        // burada mock, sorgunun zaten döndüreceği EFEKTİF max_users'ı
        // simüle ediyor (override=15, plan max_users=NULL varsayımıyla).
        return Promise.resolve({
          rows: [
            {
              id: "LIC-1", company_id: COMPANY_ROOT, plan_id: "custom", plan_name: "Custom",
              max_users: 15, description: null, starts_at: new Date(), expires_at: null, status: "active"
            }
          ]
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app).get("/api/customer/license").set(authHeader(CUSTOMER_USER));

    expect(res.status).toBe(200);
    expect(res.body.data.max_users).toBe(15);
  });

  test("Hiçbir şirkete atanmamış kullanıcı -> 404 (IDOR: başka birinin lisansını asla görmez)", async () => {
    const res = await request(app).get("/api/customer/license").set(authHeader(NO_COMPANY_USER));
    expect(res.status).toBe(404);
  });

  test("Aktif lisans yoksa (root INACTIVE ya da lisans yok) -> 404, dahili hata sızdırılmaz", async () => {
    poolQueryMock.mockImplementation((sql) => {
      if (sql.includes("WITH RECURSIVE ancestry")) {
        return Promise.resolve({
          rows: [{ id: COMPANY_CHILD, parent_company_id: null, status: "ACTIVE", depth: 0 }]
        });
      }
      return Promise.resolve({ rows: [] }); // lisans yok
    });

    const res = await request(app).get("/api/customer/license").set(authHeader(CUSTOMER_USER));
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

/**
 * ============================================================
 * F — MUST CHANGE PASSWORD — UÇTAN UCA AKIŞ
 * ============================================================
 */
describe("P4 — F: mustChangePassword uçtan uca akış", () => {
  let poolQueryMock;
  let app;

  const NEW_USER = { id: "NEW-1", username: "newstaff", role: "VIEWER", companyIds: [COMPANY_ROOT] };

  beforeEach(() => {
    jest.resetModules();
    poolQueryMock = jest.fn();
    jest.doMock("../backend/db/pool", () => ({ query: poolQueryMock, connect: jest.fn() }));
    app = require("../backend/app");
  });

  afterEach(() => {
    jest.resetModules();
  });

  test("mustChangePassword=true iken normal bir endpoint çağrısı -> 403 MUST_CHANGE_PASSWORD", async () => {
    const token = signUserToken({ ...NEW_USER, mustChangePassword: true });

    const res = await request(app)
      .get("/api/org/companies")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("MUST_CHANGE_PASSWORD");
  });

  test("mustChangePassword=true iken GET /api/auth/me çalışır (istisna)", async () => {
    const token = signUserToken({ ...NEW_USER, mustChangePassword: true });

    poolQueryMock.mockImplementation((sql) => {
      if (sql.includes("SELECT") && sql.includes("email") && sql.includes("must_change_password")) {
        return Promise.resolve({
          rows: [{ email: null, first_name: null, last_name: null, must_change_password: true }]
        });
      }
      if (sql.includes("FROM user_companies") || sql.includes("company_licenses")) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.mustChangePassword).toBe(true);
  });

  test("mustChangePassword=false ile normal endpoint erişimi engellenmez (403 tetiklenmez)", async () => {
    const token = signUserToken({ ...NEW_USER, mustChangePassword: false });

    poolQueryMock.mockImplementation(() => Promise.resolve({ rows: [] }));

    const res = await request(app)
      .get("/api/org/companies")
      .set("Authorization", `Bearer ${token}`);

    // 403 MUST_CHANGE_PASSWORD OLMAMALI — normal scope filtrelemesiyle 200 döner.
    expect(res.status).toBe(200);
  });
});

/**
 * ============================================================
 * AUDIT — CROSS-HOLDING SCOPE (P4 madde 15)
 * ============================================================
 */
describe("P4 — Audit: ACCOUNTANT_MANAGER başka holding'in kaydını göremez", () => {
  let poolQueryMock;
  let app;

  beforeEach(() => {
    jest.resetModules();
    poolQueryMock = jest.fn();
    jest.doMock("../backend/db/pool", () => ({ query: poolQueryMock, connect: jest.fn() }));
    app = require("../backend/app");
  });

  afterEach(() => {
    jest.resetModules();
  });

  test("GET /api/audit — MANAGER_CHILD sorgusu yalnızca KENDİ alt ağacıyla (ROOT değil) filtrelenir", async () => {
    poolQueryMock.mockImplementation((sql, params) => {
      if (sql.includes("WITH RECURSIVE tree")) {
        return Promise.resolve({ rows: [{ id: COMPANY_CHILD }] });
      }
      if (sql.includes("SELECT a.* FROM audit_events")) {
        // company_id = ANY($1) parametresi MANAGER_CHILD'ın ağacıyla
        // (yalnızca COMPANY_CHILD) sınırlı olmalı — COMPANY_ROOT veya
        // COMPANY_SIBLING_TREE HİÇBİR ZAMAN bu listede olmamalı.
        expect(params[0]).toEqual([COMPANY_CHILD]);
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app).get("/api/audit").set(authHeader(MANAGER_CHILD));

    expect(res.status).toBe(200);
  });

  test("GET /api/audit — ADMIN için scope filtresi UYGULANMAZ (global)", async () => {
    poolQueryMock.mockImplementation((sql) => {
      if (sql.includes("SELECT a.* FROM audit_events")) {
        expect(sql).not.toMatch(/c\.company_id = ANY/);
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app).get("/api/audit").set(authHeader(ADMIN_USER));

    expect(res.status).toBe(200);
  });
});
