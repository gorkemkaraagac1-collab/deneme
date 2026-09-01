/**
 * @jest-environment node
 *
 * ============================================================
 * ADMIN INFLATION INDICES ROUTES — AUTHORIZATION TESTS
 * ============================================================
 *
 * backend/routes/admin.js'e eklenen 5 yeni endpoint'in gerçekten
 * Authentication -> Authorization (ADMIN) zincirinden geçtiğini
 * doğrular:
 *
 *   GET    /api/admin/inflation-indices
 *   POST   /api/admin/inflation-indices
 *   POST   /api/admin/inflation-indices/bulk
 *   PATCH  /api/admin/inflation-indices/:id/verify
 *   PATCH  /api/admin/inflation-indices/:id/reject
 *
 * DESEN: test/p1-access-control.test.js ile aynı yaklaşım
 * (supertest + gerçek middleware zinciri), ancak backend/db/pool
 * ve backend/services/tuik-index-service GERÇEK bir PostgreSQL
 * bağlantısı açmasın diye mock'lanır — amaç DB davranışını değil,
 * middleware/yetkilendirme davranışını doğrulamaktır (DB
 * davranışı zaten test/inflation-manual-entry.test.js'te ayrıca
 * kapsanıyor).
 */

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-only-secret-do-not-use-in-prod";
process.env.NODE_ENV = "test";

const request = require("supertest");
const express = require("express");

function buildApp() {
  jest.resetModules();

  // admin.js, üst seviyede license-service/organization-service'i de
  // require ediyor; onlar da backend/db/pool'a bağımlı olduğu için
  // pool'u tüm modül grafiği için tek noktadan mock'luyoruz.
  jest.doMock("../backend/db/pool", () => ({
    query: jest.fn().mockResolvedValue({ rows: [] }),
    connect: jest.fn().mockResolvedValue({
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn()
    })
  }));

  // Route katmanının middleware zincirini test ediyoruz — servis
  // katmanının gerçek DB mantığı test/inflation-manual-entry.test.js'te
  // zaten kapsanıyor, burada admin route'un servisi doğru çağırıp
  // çağırmadığı önemli değil, middleware'in isteği DOĞRU noktada
  // durdurup durdurmadığı önemli.
  jest.doMock("../backend/services/tuik-index-service", () => ({
    createManualIndexEntry: jest.fn().mockResolvedValue({
      action: "inserted",
      record: { id: 1, index_month: "2026-07", index_value: 3500.25, verification_status: "PENDING" }
    }),
    createBulkManualIndexEntries: jest.fn().mockResolvedValue({ created: [], skipped: [] }),
    verifyIndexRecord: jest.fn().mockResolvedValue({
      id: 1, index_month: "2026-07", index_value: 3500.25,
      verification_status: "VERIFIED", verified_by: "x", verified_at: new Date().toISOString()
    }),
    rejectIndexRecord: jest.fn().mockResolvedValue({
      id: 1, index_month: "2026-07", index_value: 3500.25,
      verification_status: "REJECTED", verified_by: "x", verified_at: new Date().toISOString()
    }),
    listIndexRecords: jest.fn().mockResolvedValue([]),
    BulkInputParseError: class BulkInputParseError extends Error {}
  }));

  const adminRouter = require("../backend/routes/admin");
  const inflationService = require("../backend/services/tuik-index-service");
  const { signUserToken } = require("../backend/utils/jwt");

  const app = express();
  app.use(express.json());
  app.use("/api/admin", adminRouter);

  return { app, signUserToken, inflationService };
}

function authHeader(signUserToken, payload) {
  const token = signUserToken(payload);
  return { Authorization: `Bearer ${token}` };
}

const ADMIN_USER = { id: "u-admin", username: "admin-1", role: "ADMIN", companyIds: [] };
const LONG_USERNAME_ADMIN = {
  id: "u-stable-id",
  username: "admin-with-a-username-that-is-deliberately-longer-than-fifty-characters@example.com",
  role: "ADMIN",
  companyIds: []
};
const NORMAL_USER = { id: "u-normal", username: "normal-1", role: "ACCOUNTANT", companyIds: ["C-1"] };

describe("GET /api/admin/inflation-indices", () => {
  test("token yoksa 401 döner", async () => {
    const { app } = buildApp();
    const res = await request(app).get("/api/admin/inflation-indices");
    expect(res.status).toBe(401);
  });

  test("ADMIN olmayan geçerli bir kullanıcı 403 alır", async () => {
    const { app, signUserToken } = buildApp();
    const res = await request(app)
      .get("/api/admin/inflation-indices")
      .set(authHeader(signUserToken, NORMAL_USER));
    expect(res.status).toBe(403);
  });

  test("ADMIN kullanıcı erişebilir (200)", async () => {
    const { app, signUserToken } = buildApp();
    const res = await request(app)
      .get("/api/admin/inflation-indices")
      .set(authHeader(signUserToken, ADMIN_USER));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test("geçersiz status filtresi 400 döner", async () => {
    const { app, signUserToken } = buildApp();
    const res = await request(app)
      .get("/api/admin/inflation-indices?status=NOT_A_STATUS")
      .set(authHeader(signUserToken, ADMIN_USER));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/admin/inflation-indices", () => {
  test("token yoksa 401 döner", async () => {
    const { app } = buildApp();
    const res = await request(app).post("/api/admin/inflation-indices").send({ month: "2026-07", value: 3500.25 });
    expect(res.status).toBe(401);
  });

  test("ADMIN olmayan kullanıcı 403 alır", async () => {
    const { app, signUserToken } = buildApp();
    const res = await request(app)
      .post("/api/admin/inflation-indices")
      .set(authHeader(signUserToken, NORMAL_USER))
      .send({ month: "2026-07", value: 3500.25 });
    expect(res.status).toBe(403);
  });

  test("ADMIN kullanıcı manuel kayıt oluşturabilir (201, PENDING)", async () => {
    const { app, signUserToken } = buildApp();
    const res = await request(app)
      .post("/api/admin/inflation-indices")
      .set(authHeader(signUserToken, ADMIN_USER))
      .send({ month: "2026-07", value: 3500.25 });
    expect(res.status).toBe(201);
    expect(res.body.data.verificationStatus).toBe("PENDING");
  });

  test("uzun username ile manuel kayıtta stabil user id actor olarak kullanılır", async () => {
    const { app, signUserToken, inflationService } = buildApp();
    const res = await request(app)
      .post("/api/admin/inflation-indices")
      .set(authHeader(signUserToken, LONG_USERNAME_ADMIN))
      .send({ month: "2026-07", value: 132.31 });

    expect(res.status).toBe(201);
    expect(inflationService.createManualIndexEntry).toHaveBeenCalledWith({
      month: "2026-07",
      value: 132.31,
      actor: LONG_USERNAME_ADMIN.id
    });
  });

  test("bilinmeyen alan içeren body 400 ile reddedilir (mass-assignment koruması)", async () => {
    const { app, signUserToken } = buildApp();
    const res = await request(app)
      .post("/api/admin/inflation-indices")
      .set(authHeader(signUserToken, ADMIN_USER))
      .send({ month: "2026-07", value: 3500.25, verification_status: "VERIFIED" });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/admin/inflation-indices/bulk", () => {
  test("ADMIN olmayan kullanıcı 403 alır", async () => {
    const { app, signUserToken } = buildApp();
    const res = await request(app)
      .post("/api/admin/inflation-indices/bulk")
      .set(authHeader(signUserToken, NORMAL_USER))
      .send({ text: "2025-01\t2648.12" });
    expect(res.status).toBe(403);
  });

  test("boş text 400 döner", async () => {
    const { app, signUserToken } = buildApp();
    const res = await request(app)
      .post("/api/admin/inflation-indices/bulk")
      .set(authHeader(signUserToken, ADMIN_USER))
      .send({ text: "   " });
    expect(res.status).toBe(400);
  });

  test("ADMIN kullanıcı toplu giriş yapabilir (201)", async () => {
    const { app, signUserToken } = buildApp();
    const res = await request(app)
      .post("/api/admin/inflation-indices/bulk")
      .set(authHeader(signUserToken, ADMIN_USER))
      .send({ text: "2025-01\t2648.12" });
    expect(res.status).toBe(201);
  });

  test("uzun username ile 19 satır bulk giriş user id ile servise iletilir", async () => {
    const { app, signUserToken, inflationService } = buildApp();
    const text = [
      "2025-01 88.58", "2025-02 90.59", "2025-03 92.82", "2025-04 95.60",
      "2025-05 97.06", "2025-06 98.40", "2025-07 100.42", "2025-08 102.47",
      "2025-09 105.78", "2025-10 108.48", "2025-11 109.42", "2025-12 110.39",
      "2026-01 115.73", "2026-02 119.16", "2026-03 121.47", "2026-04 126.55",
      "2026-05 128.72", "2026-06 129.99", "2026-07 132.31"
    ].join("\n");

    const res = await request(app)
      .post("/api/admin/inflation-indices/bulk")
      .set(authHeader(signUserToken, LONG_USERNAME_ADMIN))
      .send({ text });

    expect(res.status).toBe(201);
    expect(inflationService.createBulkManualIndexEntries).toHaveBeenCalledWith(
      text,
      LONG_USERNAME_ADMIN.id
    );
  });
});

describe("PATCH /api/admin/inflation-indices/:id/verify ve /reject", () => {
  test("ADMIN olmayan kullanıcı verify için 403 alır", async () => {
    const { app, signUserToken } = buildApp();
    const res = await request(app)
      .patch("/api/admin/inflation-indices/1/verify")
      .set(authHeader(signUserToken, NORMAL_USER));
    expect(res.status).toBe(403);
  });

  test("ADMIN olmayan kullanıcı reject için 403 alır", async () => {
    const { app, signUserToken } = buildApp();
    const res = await request(app)
      .patch("/api/admin/inflation-indices/1/reject")
      .set(authHeader(signUserToken, NORMAL_USER));
    expect(res.status).toBe(403);
  });

  test("ADMIN kullanıcı verify edebilir (200, VERIFIED)", async () => {
    const { app, signUserToken } = buildApp();
    const res = await request(app)
      .patch("/api/admin/inflation-indices/1/verify")
      .set(authHeader(signUserToken, ADMIN_USER));
    expect(res.status).toBe(200);
    expect(res.body.data.verificationStatus).toBe("VERIFIED");
  });

  test("ADMIN kullanıcı reject edebilir (200, REJECTED)", async () => {
    const { app, signUserToken } = buildApp();
    const res = await request(app)
      .patch("/api/admin/inflation-indices/1/reject")
      .set(authHeader(signUserToken, ADMIN_USER))
      .send({ reason: "Yanlış girildi" });
    expect(res.status).toBe(200);
    expect(res.body.data.verificationStatus).toBe("REJECTED");
  });

  test("verify ve reject işlemleri uzun username yerine user id kullanır", async () => {
    const { app, signUserToken, inflationService } = buildApp();
    const headers = authHeader(signUserToken, LONG_USERNAME_ADMIN);

    const verifyRes = await request(app)
      .patch("/api/admin/inflation-indices/1/verify")
      .set(headers);
    const rejectRes = await request(app)
      .patch("/api/admin/inflation-indices/2/reject")
      .set(headers)
      .send({ reason: "Yanlış girildi" });

    expect(verifyRes.status).toBe(200);
    expect(rejectRes.status).toBe(200);
    expect(inflationService.verifyIndexRecord).toHaveBeenCalledWith({
      id: "1",
      actor: LONG_USERNAME_ADMIN.id
    });
    expect(inflationService.rejectIndexRecord).toHaveBeenCalledWith({
      id: "2",
      actor: LONG_USERNAME_ADMIN.id,
      reason: "Yanlış girildi"
    });
  });
});
