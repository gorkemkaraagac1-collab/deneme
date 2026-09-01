const request = require("supertest");
const crypto = require("crypto");

process.env.JWT_SECRET = "license-security-test-secret";

const app = require("../backend/app");
const pool = require("../backend/db/pool");
const { signUserToken } = require("../backend/utils/jwt");

const fixtureIds = {
  userId: `lic-test-u-${crypto.randomUUID().slice(0, 12)}`,
  companyId: `lic-test-c-${crypto.randomUUID().slice(0, 12)}`,
  licenseId: `lic-test-l-${crypto.randomUUID().slice(0, 12)}`,
  username: `lic-test-${crypto.randomUUID().slice(0, 12)}@test.invalid`
};

beforeAll(async () => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const planResult = await client.query(
      "SELECT id FROM plans WHERE lower(name) = 'professional' LIMIT 1"
    );

    if (planResult.rows.length === 0) {
      throw new Error("Professional planı test DB'sinde bulunamadı");
    }

    await client.query(
      `
        INSERT INTO users (id, username, password_hash, role, status)
        VALUES ($1, $2, $3, 'USER', 'ACTIVE')
      `,
      [
        fixtureIds.userId,
        fixtureIds.username,
        "test-fixture-password-hash"
      ]
    );

    await client.query(
      `
        INSERT INTO companies (id, name, code)
        VALUES ($1, 'License Security Test Company', $2)
      `,
      [fixtureIds.companyId, fixtureIds.companyId]
    );

    await client.query(
      `
        INSERT INTO user_companies (user_id, company_id)
        VALUES ($1, $2)
      `,
      [fixtureIds.userId, fixtureIds.companyId]
    );

    await client.query(
      `
        INSERT INTO company_licenses (
          id,
          company_id,
          plan_id,
          starts_at,
          expires_at,
          status
        )
        VALUES ($1, $2, $3, NOW(), NULL, 'active')
      `,
      [fixtureIds.licenseId, fixtureIds.companyId, planResult.rows[0].id]
    );

    await client.query("COMMIT");

    process.env.TEST_AUTH_TOKEN = signUserToken({
      id: fixtureIds.userId,
      username: fixtureIds.username,
      role: "USER",
      companyIds: [fixtureIds.companyId]
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

afterAll(async () => {
  await pool.query(
    "DELETE FROM company_licenses WHERE id = $1",
    [fixtureIds.licenseId]
  );
  await pool.query(
    "DELETE FROM user_companies WHERE user_id = $1",
    [fixtureIds.userId]
  );
  await pool.query(
    "DELETE FROM companies WHERE id = $1",
    [fixtureIds.companyId]
  );
  await pool.query(
    "DELETE FROM users WHERE id = $1",
    [fixtureIds.userId]
  );
  delete process.env.TEST_AUTH_TOKEN;
  await pool.end();
});

describe("License Security", () => {

  test("Token olmadan /active 401 dönmeli", async () => {
    const response = await request(app)
      .get("/api/license-test/active");

    expect(response.status).toBe(401);
  });


  test("Sahte token ile /active 401 dönmeli", async () => {
    const response = await request(app)
      .get("/api/license-test/active")
      .set("Authorization", "Bearer SAHTE-TOKEN");

    expect(response.status).toBe(401);
  });


  test("Professional kullanıcı Professional endpointine erişebilmeli", async () => {
    const token = process.env.TEST_AUTH_TOKEN;

    if (!token) {
      throw new Error(
        "TEST_AUTH_TOKEN environment variable bulunamadı"
      );
    }

    const app = require("../backend/app");
    const response = await request(app)
      .get("/api/license-test/professional")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
  });


  test("Professional kullanıcı Enterprise endpointine erişememeli", async () => {
    const token = process.env.TEST_AUTH_TOKEN;

    if (!token) {
      throw new Error(
        "TEST_AUTH_TOKEN environment variable bulunamadı"
      );
    }

    const app = require("../backend/app");
    const response = await request(app)
      .get("/api/license-test/enterprise")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("PLAN_REQUIRED");
  });

});
