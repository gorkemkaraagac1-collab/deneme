/**
 * ============================================================
 * P3 — ORGANIZATION API TESTS (routes/org.js)
 * ============================================================
 *
 * NEDEN app.js DEĞİL, KENDİ MİNİMAL EXPRESS UYGULAMASI?
 * Bu repodaki routes/admin.js ve routes/admin-licenses.js, modül
 * yüklenirken (module load time) middleware/rate-limit.js'teki
 * createRateLimiter()'ı çağırıyor; bu da setInterval(...).unref()
 * kullanıyor. jest.config.js'teki GLOBAL `testEnvironment: "jsdom"`
 * altında jsdom'un sahte timer'ları .unref() sağlamıyor ve bu,
 * admin.js'i (dolayısıyla app.js'i) require eden HER TEST
 * DOSYASINI (P3'ten ÖNCE de var olan, P0-P2'den beri mevcut bir
 * altyapı sorunu) require aşamasında çökertiyor — bkz. P3 Kod
 * Raporu madde 6. routes/org.js bu zincire hiç girmiyor (admin.js'i
 * import etmiyor), bu yüzden onu kendi başına, minimal bir Express
 * app'e monte ederek test ediyoruz — supertest + gerçek middleware/
 * auth.js + middleware/admin.js kullanılıyor, yalnızca
 * organization-service.js / license-service.js / db/pool.js mock'lanıyor
 * (mevcut license-security.test.js'teki mock deseniyle aynı yaklaşım).
 */

process.env.JWT_SECRET =
  process.env.JWT_SECRET || "test-only-secret-do-not-use-in-prod";

const express = require("express");
const request = require("supertest");

const { signUserToken } = require("../backend/utils/jwt");

function authHeader(payload) {
  const token = signUserToken(payload);
  return { Authorization: `Bearer ${token}` };
}

const ADMIN = { id: "U-ADMIN", username: "admin", role: "ADMIN", companyIds: [] };
const MANAGER_A = {
  id: "U-MGR-A",
  username: "mgrA",
  role: "ACCOUNTANT_MANAGER",
  companyIds: ["ROOT-A"]
};
const VIEWER_A = {
  id: "U-VIEW-A",
  username: "viewerA",
  role: "VIEWER",
  companyIds: ["CHILD-A1"]
};

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/org", require("../backend/routes/org.js"));
  return app;
}

/**
 * ------------------------------------------------------------
 * GET /api/org/limits
 * ------------------------------------------------------------
 */
describe("P3 — GET /api/org/limits", () => {
  let resolveAccessScopeMock;
  let isCompanyInScopeMock;
  let getRootCompanyIdMock;
  let canAddUserToCompanyMock;
  let canAddContractToCompanyMock;
  let canAddCompanyToTreeMock;
  let app;

  beforeEach(() => {
    jest.resetModules();

    resolveAccessScopeMock = jest.fn();
    isCompanyInScopeMock = jest.fn();
    getRootCompanyIdMock = jest.fn();
    canAddUserToCompanyMock = jest.fn();
    canAddContractToCompanyMock = jest.fn();
    canAddCompanyToTreeMock = jest.fn();

    jest.doMock("../backend/db/pool", () => ({ query: jest.fn(), connect: jest.fn() }));
    jest.doMock("../backend/services/organization-service", () => ({
      resolveAccessScope: resolveAccessScopeMock,
      isCompanyInScope: isCompanyInScopeMock,
      getRootCompanyId: getRootCompanyIdMock,
      getDescendantCompanyIds: jest.fn()
    }));
    jest.doMock("../backend/services/license-service", () => ({
      canAddUserToCompany: canAddUserToCompanyMock,
      canAddContractToCompany: canAddContractToCompanyMock,
      canAddCompanyToTree: canAddCompanyToTreeMock
    }));

    app = buildApp();
  });

  afterEach(() => {
    jest.resetModules();
  });

  test("ADMIN companyId vermeden çağırırsa -> 400 COMPANY_ID_REQUIRED", async () => {
    resolveAccessScopeMock.mockResolvedValue({ isGlobalAdmin: true, allowedCompanyIds: null });

    const res = await request(app).get("/api/org/limits").set(authHeader(ADMIN));

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("COMPANY_ID_REQUIRED");
  });

  test("ACCOUNTANT_MANAGER kendi ağacı için efektif limitleri (override dahil) görür", async () => {
    resolveAccessScopeMock.mockResolvedValue({
      isGlobalAdmin: false,
      allowedCompanyIds: ["ROOT-A", "CHILD-A1"]
    });
    isCompanyInScopeMock.mockReturnValue(true);
    getRootCompanyIdMock.mockResolvedValue("ROOT-A");
    canAddUserToCompanyMock.mockResolvedValue({
      allowed: true,
      license: { plan_id: "custom" },
      currentUsers: 3,
      maxUsers: 10,
      remainingUsers: 7
    });
    canAddContractToCompanyMock.mockResolvedValue({
      allowed: true,
      currentContracts: 2,
      maxContracts: 50,
      remainingContracts: 48
    });
    canAddCompanyToTreeMock.mockResolvedValue({
      allowed: true,
      currentCompanies: 2,
      maxCompanies: 5,
      remainingCompanies: 3
    });

    const res = await request(app).get("/api/org/limits").set(authHeader(MANAGER_A));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      rootCompanyId: "ROOT-A",
      planId: "custom",
      max_users: 10,
      active_users: 3,
      remaining_users: 7,
      max_contracts: 50,
      used_contracts: 2,
      remaining_contracts: 48,
      max_companies: 5,
      used_companies: 2,
      remaining_companies: 3
    });
  });

  test("IDOR: Manager A, kendi kapsamı dışındaki bir companyId sorgularsa -> 404 (var/yok bilgisi sızdırılmaz)", async () => {
    resolveAccessScopeMock.mockResolvedValue({
      isGlobalAdmin: false,
      allowedCompanyIds: ["ROOT-A", "CHILD-A1"]
    });
    isCompanyInScopeMock.mockReturnValue(false);

    const res = await request(app)
      .get("/api/org/limits?companyId=ROOT-B")
      .set(authHeader(MANAGER_A));

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("COMPANY_NOT_FOUND");
    expect(getRootCompanyIdMock).not.toHaveBeenCalled();
  });
});

/**
 * ------------------------------------------------------------
 * GET /api/org/companies
 * ------------------------------------------------------------
 * Bilerek organization-service MOCK'LANMIYOR — gerçek
 * resolveAccessScope() kullanılıyor (VIEWER/ADMIN için DB
 * çağrısı yapmadığından test edilebilir) — böylece asıl "scope
 * filtresi gerçekten SQL'e yansıyor mu" sorusu test edilmiş olur.
 * ------------------------------------------------------------
 */
describe("P3 — GET /api/org/companies", () => {
  let poolQueryMock;
  let app;

  beforeEach(() => {
    jest.resetModules();
    poolQueryMock = jest.fn();
    jest.doMock("../backend/db/pool", () => ({ query: poolQueryMock, connect: jest.fn() }));
    // ÖNEMLİ: jest.doMock() bir önceki describe bloğundan (GET /limits)
    // kalıcı olarak organization-service'i mock'lamış durumda —
    // jest.resetModules() modül REGISTRY'sini temizler ama aktif
    // mock factory'sini SIFIRLAMAZ. Bu blokta GERÇEK
    // resolveAccessScope() davranışını test etmek istediğimiz için
    // (asıl amaç: scope filtresinin gerçekten SQL'e yansıması)
    // mock'u açıkça gerçek modüle geri döndürüyoruz.
    jest.doMock("../backend/services/organization-service", () =>
      jest.requireActual("../backend/services/organization-service")
    );
    app = buildApp();
  });

  afterEach(() => {
    jest.resetModules();
  });

  test("VIEWER: sorgu yalnızca kendi company_id'siyle filtreleniyor", async () => {
    poolQueryMock.mockResolvedValue({
      rows: [
        {
          id: "CHILD-A1",
          name: "A1",
          code: "A1",
          status: "ACTIVE",
          parent_company_id: "ROOT-A",
          created_at: new Date()
        }
      ]
    });

    const res = await request(app).get("/api/org/companies").set(authHeader(VIEWER_A));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].isRoot).toBe(false);

    const [sql, params] = poolQueryMock.mock.calls[0];
    expect(sql).toMatch(/c\.id = ANY/);
    expect(params[0]).toEqual(["CHILD-A1"]);
  });

  test("ADMIN: filtre olmadan (global) sorgular", async () => {
    poolQueryMock.mockResolvedValue({ rows: [] });

    const res = await request(app).get("/api/org/companies").set(authHeader(ADMIN));

    expect(res.status).toBe(200);
    const [sql] = poolQueryMock.mock.calls[0];
    expect(sql).not.toMatch(/WHERE/);
  });
});

/**
 * ------------------------------------------------------------
 * POST /api/org/companies
 * ------------------------------------------------------------
 */
describe("P3 — POST /api/org/companies", () => {
  let resolveAccessScopeMock;
  let isCompanyInScopeMock;
  let canAddCompanyToTreeMock;
  let clientQueryMock;
  let poolConnectMock;
  let app;

  beforeEach(() => {
    jest.resetModules();

    clientQueryMock = jest.fn();
    poolConnectMock = jest.fn().mockResolvedValue({
      query: clientQueryMock,
      release: jest.fn()
    });

    jest.doMock("../backend/db/pool", () => ({
      query: jest.fn(),
      connect: poolConnectMock
    }));

    resolveAccessScopeMock = jest.fn();
    isCompanyInScopeMock = jest.fn();
    jest.doMock("../backend/services/organization-service", () => ({
      resolveAccessScope: resolveAccessScopeMock,
      isCompanyInScope: isCompanyInScopeMock,
      getRootCompanyId: jest.fn()
    }));

    canAddCompanyToTreeMock = jest.fn();
    jest.doMock("../backend/services/license-service", () => ({
      canAddUserToCompany: jest.fn(),
      canAddContractToCompany: jest.fn(),
      canAddCompanyToTree: canAddCompanyToTreeMock
    }));

    app = buildApp();
  });

  afterEach(() => {
    jest.resetModules();
  });

  test("ACCOUNTANT_MANAGER parent_company_id vermeden POST -> 403 PARENT_COMPANY_REQUIRED", async () => {
    resolveAccessScopeMock.mockResolvedValue({ isGlobalAdmin: false, allowedCompanyIds: ["ROOT-A"] });

    const res = await request(app)
      .post("/api/org/companies")
      .set(authHeader(MANAGER_A))
      .send({ name: "Yeni Şirket", code: "NEW1" });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("PARENT_COMPANY_REQUIRED");
  });

  test("IDOR: Manager A, kapsamı dışındaki bir şirketi parent gösterirse -> 403 COMPANY_ACCESS_DENIED", async () => {
    resolveAccessScopeMock.mockResolvedValue({ isGlobalAdmin: false, allowedCompanyIds: ["ROOT-A"] });
    isCompanyInScopeMock.mockReturnValue(false);

    const res = await request(app)
      .post("/api/org/companies")
      .set(authHeader(MANAGER_A))
      .send({ name: "X", code: "X1", parent_company_id: "ROOT-B" });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("COMPANY_ACCESS_DENIED");
  });

  test("Manager A kendi ağacına başarıyla child company ekler -> 201", async () => {
    resolveAccessScopeMock.mockResolvedValue({ isGlobalAdmin: false, allowedCompanyIds: ["ROOT-A"] });
    isCompanyInScopeMock.mockReturnValue(true);
    canAddCompanyToTreeMock.mockResolvedValue({ allowed: true, currentCompanies: 2, maxCompanies: 5 });

    clientQueryMock
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // code uniqueness check
      .mockResolvedValueOnce({ rows: [{ id: "ROOT-A" }] }) // parent FOR UPDATE
      .mockResolvedValueOnce({
        rows: [
          {
            id: "COMP-NEW",
            name: "X",
            code: "X1",
            status: "ACTIVE",
            parent_company_id: "ROOT-A",
            created_at: new Date()
          }
        ]
      }) // INSERT
      .mockResolvedValueOnce({}) // audit insert
      .mockResolvedValueOnce({}); // COMMIT

    const res = await request(app)
      .post("/api/org/companies")
      .set(authHeader(MANAGER_A))
      .send({ name: "X", code: "X1", parent_company_id: "ROOT-A" });

    expect(res.status).toBe(201);
    expect(res.body.data.parentCompanyId).toBe("ROOT-A");
    expect(res.body.data.isRoot).toBe(false);
  });

  test("max_companies dolu -> 409 LIMIT_REACHED, ROLLBACK çağrılır", async () => {
    resolveAccessScopeMock.mockResolvedValue({ isGlobalAdmin: true, allowedCompanyIds: null });
    canAddCompanyToTreeMock.mockResolvedValue({
      allowed: false,
      reason: "LIMIT_REACHED",
      message: "Holding ağacı şirket limitine ulaşmıştır.",
      currentCompanies: 5,
      maxCompanies: 5
    });

    clientQueryMock
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // code uniqueness check
      .mockResolvedValueOnce({ rows: [{ id: "ROOT-A" }] }) // parent FOR UPDATE
      .mockResolvedValueOnce({}); // ROLLBACK

    const res = await request(app)
      .post("/api/org/companies")
      .set(authHeader(ADMIN))
      .send({ name: "X", code: "X2", parent_company_id: "ROOT-A" });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("LIMIT_REACHED");
    expect(clientQueryMock).toHaveBeenLastCalledWith("ROLLBACK");
  });

  test("CONTROLLER (write yetkisi olmayan bir rol) POST atarsa -> 403 (requireStaffAccess)", async () => {
    const CONTROLLER = { id: "U-CTRL", username: "ctrl", role: "CONTROLLER", companyIds: ["ROOT-A"] };

    const res = await request(app)
      .post("/api/org/companies")
      .set(authHeader(CONTROLLER))
      .send({ name: "X", code: "X3", parent_company_id: "ROOT-A" });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("STAFF_ACCESS_REQUIRED");
  });
});

/**
 * ------------------------------------------------------------
 * DELETE /api/org/companies/:id
 * ------------------------------------------------------------
 */
describe("P3 — DELETE /api/org/companies/:id", () => {
  let poolQueryMock;
  let app;

  beforeEach(() => {
    jest.resetModules();
    poolQueryMock = jest.fn();
    jest.doMock("../backend/db/pool", () => ({ query: poolQueryMock, connect: jest.fn() }));
    // bkz. GET /api/org/companies bloğundaki aynı not — kalıcı
    // mock'u gerçek modüle geri döndürüyoruz.
    jest.doMock("../backend/services/organization-service", () =>
      jest.requireActual("../backend/services/organization-service")
    );
    jest.doMock("../backend/services/license-service", () =>
      jest.requireActual("../backend/services/license-service")
    );
    app = buildApp();
  });

  afterEach(() => {
    jest.resetModules();
  });

  test("ACCOUNTANT_MANAGER silme deneyince -> 403 (yalnızca ADMIN silebilir)", async () => {
    const res = await request(app)
      .delete("/api/org/companies/COMP-1")
      .set(authHeader(MANAGER_A));

    expect(res.status).toBe(403);
    expect(poolQueryMock).not.toHaveBeenCalled();
  });

  test("Sözleşmesi olan şirket silinemez -> 409 COMPANY_HAS_CONTRACTS", async () => {
    poolQueryMock
      .mockResolvedValueOnce({ rows: [{ id: "COMP-1" }] }) // company exists
      .mockResolvedValueOnce({ rows: [{ count: 3 }] }); // contract count

    const res = await request(app)
      .delete("/api/org/companies/COMP-1")
      .set(authHeader(ADMIN));

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("COMPANY_HAS_CONTRACTS");
  });

  test("Alt şirketi olan şirket silinemez -> 409 COMPANY_HAS_CHILDREN", async () => {
    poolQueryMock
      .mockResolvedValueOnce({ rows: [{ id: "COMP-1" }] }) // company exists
      .mockResolvedValueOnce({ rows: [{ count: 0 }] }) // no contracts
      .mockResolvedValueOnce({ rows: [{ count: 2 }] }); // has children

    const res = await request(app)
      .delete("/api/org/companies/COMP-1")
      .set(authHeader(ADMIN));

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("COMPANY_HAS_CHILDREN");
  });

  test("Bağımlılığı olmayan şirket başarıyla silinir -> 204", async () => {
    poolQueryMock
      .mockResolvedValueOnce({ rows: [{ id: "COMP-1" }] }) // company exists
      .mockResolvedValueOnce({ rows: [{ count: 0 }] }) // no contracts
      .mockResolvedValueOnce({ rows: [{ count: 0 }] }) // no children
      .mockResolvedValueOnce({ rows: [{ id: "COMP-1", name: "X", code: "X" }] }) // DELETE ... RETURNING
      .mockResolvedValueOnce({ rows: [] }); // audit insert

    const res = await request(app)
      .delete("/api/org/companies/COMP-1")
      .set(authHeader(ADMIN));

    expect(res.status).toBe(204);
  });

  test("Var olmayan şirket -> 404", async () => {
    poolQueryMock.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .delete("/api/org/companies/NOPE")
      .set(authHeader(ADMIN));

    expect(res.status).toBe(404);
  });
});
