/** @jest-environment node */

const express = require("express");
const request = require("supertest");

function modification(id, overrides = {}) {
  return {
    id,
    status: "APPLIED",
    modificationType: "PAYMENT_INCREASE",
    effectiveDate: "2026-06-01",
    newTerms: { payment: 12000, discountRate: 18, leaseEndDate: "2028-12-31" },
    ...overrides
  };
}

function createPool(initialDetails = {}) {
  let details = JSON.parse(JSON.stringify(initialDetails));
  let lock = Promise.resolve();

  const connect = jest.fn(async () => {
    let unlock;
    let ownsLock = false;
    return {
      query: jest.fn(async (sql, params = []) => {
        const normalized = String(sql).replace(/\s+/g, " ").trim();
        if (normalized === "BEGIN") return { rows: [] };
        if (normalized.includes("FROM contracts") && normalized.includes("FOR UPDATE")) {
          const previous = lock;
          lock = new Promise(resolve => { unlock = resolve; });
          await previous;
          ownsLock = true;
          return { rows: [{ company_id: "C-1", details: JSON.parse(JSON.stringify(details)) }] };
        }
        if (normalized.includes("FROM company_licenses")) return { rows: [{ ok: 1 }] };
        if (normalized.startsWith("UPDATE contracts")) {
          details = params[8] === null ? details : JSON.parse(params[8]);
          return { rows: [{ id: "LEASE-1", company_id: "C-1", details }] };
        }
        if (normalized === "COMMIT" || normalized === "ROLLBACK") {
          if (ownsLock) { ownsLock = false; unlock(); }
          return { rows: [] };
        }
        throw new Error(`Unexpected SQL: ${normalized}`);
      }),
      release: jest.fn()
    };
  });

  return { connect, query: jest.fn(), readDetails: () => details };
}

function createApp(pool) {
  jest.resetModules();
  jest.doMock("../backend/db/pool", () => pool);
  jest.doMock("../backend/middleware/auth", () => ({
    requireAuth: (req, res, next) => { req.user = { role: "ADMIN" }; next(); }
  }));
  jest.doMock("../backend/services/organization-service", () => ({
    resolveAccessScope: jest.fn(async () => ({ isGlobalAdmin: true, allowedCompanyIds: [] })),
    isCompanyInScope: jest.fn(() => true),
    isContractWriteRole: jest.fn(() => true)
  }));
  jest.doMock("../backend/middleware/license", () => ({ requireCompanyLicense: (req, res, next) => next() }));
  jest.doMock("../backend/services/license-service", () => ({
    canAddContractToCompany: jest.fn(),
    lockRootCompanyForLimit: jest.fn()
  }));

  const app = express();
  app.use(express.json());
  app.use("/api/contracts", require("../backend/routes/contracts"));
  return app;
}

describe("PUT /api/contracts/:id atomic modification persistence", () => {
  afterEach(() => jest.resetModules());

  test("concurrent identical PUT: exactly one 200 and one 409", async () => {
    const pool = createPool({ modifications: [] });
    const app = createApp(pool);
    const [first, second] = await Promise.all([
      request(app).put("/api/contracts/LEASE-1").send({ details: { modifications: [modification("MOD-A")] } }),
      request(app).put("/api/contracts/LEASE-1").send({ details: { modifications: [modification("MOD-B")] } })
    ]);
    expect([first.status, second.status].sort()).toEqual([200, 409]);
    expect([first.body.code, second.body.code]).toContain("DUPLICATE_MODIFICATION");
    expect(pool.readDetails().modifications).toHaveLength(1);
  });

  test("single payload duplicate returns 409 with canonical newTerms ordering", async () => {
    const pool = createPool({ modifications: [] });
    const app = createApp(pool);
    const first = modification("MOD-A");
    const second = modification("MOD-B", {
      newTerms: { leaseEndDate: "2028-12-31", discountRate: 18, payment: 12000 }
    });
    const response = await request(app).put("/api/contracts/LEASE-1")
      .send({ details: { modifications: [first, second] } });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe("DUPLICATE_MODIFICATION");
  });

  test("same-id edit is allowed", async () => {
    const existing = modification("MOD-A");
    const pool = createPool({ modifications: [existing] });
    const app = createApp(pool);
    const response = await request(app).put("/api/contracts/LEASE-1")
      .send({ details: { modifications: [{ ...existing, reason: "edited" }] } });
    expect(response.status).toBe(200);
    expect(pool.readDetails().modifications[0].reason).toBe("edited");
  });

  test("CANCELLED economic key does not block a new modification", async () => {
    const cancelled = modification("MOD-OLD", { status: "CANCELLED" });
    const pool = createPool({ modifications: [cancelled] });
    const app = createApp(pool);
    const response = await request(app).put("/api/contracts/LEASE-1")
      .send({ details: { modifications: [cancelled, modification("MOD-NEW")] } });
    expect(response.status).toBe(200);
  });

  test("failed UPDATE rolls back and leaves stored details unchanged", async () => {
    const original = { modifications: [] };
    const pool = createPool(original);
    const baseConnect = pool.connect;
    pool.connect = jest.fn(async () => {
      const client = await baseConnect();
      const baseQuery = client.query;
      client.query = jest.fn(async (sql, params) => {
        if (String(sql).replace(/\s+/g, " ").trim().startsWith("UPDATE contracts")) {
          throw new Error("forced update failure");
        }
        return baseQuery(sql, params);
      });
      return client;
    });
    const app = createApp(pool);
    const response = await request(app).put("/api/contracts/LEASE-1")
      .send({ details: { modifications: [modification("MOD-A")] } });
    expect(response.status).toBe(500);
    expect(pool.readDetails()).toEqual(original);
  });
});
