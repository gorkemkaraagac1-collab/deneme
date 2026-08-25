/**
 * ============================================================
 * INFLATION INDICES ROUTE TESTS
 * ============================================================
 *
 * license-security.test.js ile aynı mock deseni: backend/db/pool
 * ve backend/services/license-service mock'lanır, gerçek DB/ağ
 * bağlantısı açılmaz. tuik-index-service de mock'lanır — bu dosya
 * route/middleware katmanını (auth/entitlement/admin/rate-limit/
 * input validation) test eder, servis mantığı zaten
 * tuik-index-service.test.js'te ayrıca test edilmiştir.
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
const USER_VIEWER = { id: "USER-A", username: "userA", role: "VIEWER", companyIds: [COMPANY_A] };
const USER_ADMIN = { id: "USER-ADMIN", username: "adminUser", role: "ADMIN", companyIds: [COMPANY_A] };

function mockActiveLicense(getUserLicensesMock) {
  getUserLicensesMock.mockResolvedValue([
    {
      companyId: COMPANY_A,
      companyName: COMPANY_A,
      hasActiveLicense: true,
      license: { id: "LIC-A", planId: "starter", planName: "starter", status: "active" },
      currentUsers: 1,
      remainingUsers: 4
    }
  ]);
}

describe("GET /api/inflation-indices", () => {
  let app;
  let poolQueryMock;
  let getUserLicensesMock;

  beforeEach(() => {
    jest.resetModules();
    poolQueryMock = jest.fn();
    getUserLicensesMock = jest.fn();

    jest.doMock("../backend/db/pool", () => ({ query: poolQueryMock, connect: jest.fn() }));
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

  test("token yok -> 401", async () => {
    const res = await request(app).get("/api/inflation-indices");
    expect(res.status).toBe(401);
  });

  test("token var ama aktif lisans yok -> 403 NO_ACTIVE_LICENSE (yeni bir tms29 entitlement DEĞİL, mevcut mekanizma)", async () => {
    getUserLicensesMock.mockResolvedValue([]);
    const res = await request(app).get("/api/inflation-indices").set(authHeader(USER_VIEWER));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("NO_ACTIVE_LICENSE");
  });

  test("aktif lisans varsa -> 200, yalnızca VERIFIED+aktif kayıtlar istenir (SQL'e yansır)", async () => {
    mockActiveLicense(getUserLicensesMock);
    poolQueryMock.mockResolvedValue({
      rows: [
        {
          index_month: "2025-01",
          index_value: "3500.0000",
          source: "TUIK_AUTO",
          source_url: "https://example.invalid",
          retrieved_at: new Date("2025-02-01"),
          verification_status: "VERIFIED"
        }
      ]
    });

    const res = await request(app)
      .get("/api/inflation-indices?months=2025-01")
      .set(authHeader(USER_VIEWER));

    expect(res.status).toBe(200);
    expect(res.body.indices).toEqual([
      {
        month: "2025-01",
        index: 3500,
        source: "TUIK_AUTO",
        sourceUrl: "https://example.invalid",
        retrievedAt: "2025-02-01T00:00:00.000Z",
        verificationStatus: "VERIFIED"
      }
    ]);

    // SQL'in VERIFIED + superseded_by IS NULL filtresini içerdiğini
    // ve parametrized (ham string concatenation değil) olduğunu
    // doğrula — SQL injection koruması bu deseni kullanmaya bağlıdır.
    const [sql, params] = poolQueryMock.mock.calls[0];
    expect(sql).toMatch(/verification_status\s*=\s*'VERIFIED'/);
    expect(sql).toMatch(/superseded_by IS NULL/);
    expect(params).toEqual(["TUFE_GENEL", ["2025-01"]]);
  });

  test("geçersiz months formatı -> 400, DB'ye hiç sorgu atılmaz", async () => {
    mockActiveLicense(getUserLicensesMock);
    const res = await request(app)
      .get("/api/inflation-indices?months=2025-13,invalid")
      .set(authHeader(USER_VIEWER));

    expect(res.status).toBe(400);
    expect(poolQueryMock).not.toHaveBeenCalled();
  });

  test("months verilmezse varsayılan aralıkla sorgulanır (400 vermez)", async () => {
    mockActiveLicense(getUserLicensesMock);
    poolQueryMock.mockResolvedValue({ rows: [] });

    const res = await request(app).get("/api/inflation-indices").set(authHeader(USER_VIEWER));
    expect(res.status).toBe(200);
    expect(res.body.indices).toEqual([]);
  });
});

describe("POST /api/inflation-indices/sync", () => {
  let app;
  let getUserLicensesMock;
  let syncFromTuikMock;

  beforeEach(() => {
    jest.resetModules();
    getUserLicensesMock = jest.fn();
    syncFromTuikMock = jest.fn();

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
    jest.doMock("../backend/services/tuik-index-service", () => {
      const actual = jest.requireActual("../backend/services/tuik-index-service");
      return {
        ...actual,
        syncFromTuik: syncFromTuikMock
      };
    });

    app = require("../backend/app");
  });

  afterEach(() => {
    jest.resetModules();
  });

  test("token yok -> 401", async () => {
    const res = await request(app).post("/api/inflation-indices/sync").send({ months: ["2025-01"] });
    expect(res.status).toBe(401);
  });

  test("ADMIN olmayan kullanıcı -> 403 (yeni bir tms29 admin rolü DEĞİL, mevcut requireAdmin)", async () => {
    const res = await request(app)
      .post("/api/inflation-indices/sync")
      .set(authHeader(USER_VIEWER))
      .send({ months: ["2025-01"] });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("ADMIN_REQUIRED");
  });

  test("ADMIN + months eksik -> 400, syncFromTuik hiç çağrılmaz", async () => {
    const res = await request(app)
      .post("/api/inflation-indices/sync")
      .set(authHeader(USER_ADMIN))
      .send({});
    expect(res.status).toBe(400);
    expect(syncFromTuikMock).not.toHaveBeenCalled();
  });

  test("ADMIN + geçersiz ay formatı -> 400", async () => {
    const res = await request(app)
      .post("/api/inflation-indices/sync")
      .set(authHeader(USER_ADMIN))
      .send({ months: ["2025-13"] });
    expect(res.status).toBe(400);
    expect(syncFromTuikMock).not.toHaveBeenCalled();
  });

  test("ADMIN + geçerli istek + TÜİK kaynağı yapılandırılmamış -> 503, sahte veri dönmez", async () => {
    const { TuikSourceNotConfiguredError } = jest.requireActual("../backend/services/tuik-index-service");
    syncFromTuikMock.mockRejectedValue(new TuikSourceNotConfiguredError());

    const res = await request(app)
      .post("/api/inflation-indices/sync")
      .set(authHeader(USER_ADMIN))
      .send({ months: ["2025-01"] });

    expect(res.status).toBe(503);
    expect(res.body.code).toBe("TUIK_SOURCE_NOT_CONFIGURED");
  });

  test("ADMIN + geçerli istek + başarılı senkronizasyon -> 200", async () => {
    syncFromTuikMock.mockResolvedValue({ synced: ["2025-01"], unchanged: [], skipped: [] });

    const res = await request(app)
      .post("/api/inflation-indices/sync")
      .set(authHeader(USER_ADMIN))
      .send({ months: ["2025-01"] });

    expect(res.status).toBe(200);
    expect(res.body.synced).toEqual(["2025-01"]);
    expect(syncFromTuikMock).toHaveBeenCalledWith(["2025-01"], "adminUser");
  });
});
