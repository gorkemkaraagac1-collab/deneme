/**
 * @jest-environment node
 *
 * bkz. test/license-security.test.js başındaki aynı not — bu dosya
 * da app.js (dolayısıyla admin.js) yüklüyor, jsdom'un
 * setInterval(...).unref() eksikliğiyle çöküyordu. Test-only
 * override, üretim kodu etkilenmiyor.
 * ============================================================
 * SECURITY HARDENING TESTS
 * ============================================================
 *
 * Bu dosya, backend security/infrastructure hardening çalışması
 * kapsamında eklenen kontrolleri doğrular:
 *
 *  1. Audit trail — "actor" alanı client body'sinden spoof
 *     edilemez, her zaman doğrulanmış JWT kimliğinden gelir.
 *  2. Security headers — OWASP header'ları gerçekten dönüyor.
 *  3. Rate limiting — login (brute-force), register (abuse) ve
 *     admin endpoint'leri IP başına sınırlanıyor.
 *  4. JWT — yalnızca HS256 kabul ediliyor; "none" veya farklı bir
 *     algoritma ile üretilmiş token'lar reddediliyor.
 *
 * Bu dosya, license-security*.test.js dosyalarıyla AYNI mock
 * mimarisini kullanır: gerçek bir PostgreSQL bağlantısı OLMADAN,
 * backend/db/pool.js sahte (fake) bir query fonksiyonuyla
 * mock'lanır ve supertest ile app.js'e (Express instance) doğrudan
 * istek atılır.
 *
 * NOT — RATE LIMIT TESTLERİ VE NODE_ENV:
 * backend/middleware/rate-limit.js, test flakiness'i önlemek için
 * NODE_ENV=test iken devre dışı kalacak şekilde tasarlanmıştır
 * (bkz. o dosyadaki yorum). Rate limiting'in gerçekten çalıştığını
 * doğrulayabilmek için bu test dosyasındaki ilgili describe
 * bloklarında process.env.NODE_ENV GEÇİCİ olarak "test" dışında bir
 * değere ayarlanır ve her testten sonra "test"e geri döndürülür —
 * böylece bu değişiklik diğer test dosyalarını etkilemez (jest
 * --runInBand ile tüm dosyalar aynı process'i paylaştığından bu
 * temizlik önemlidir).
 */

process.env.JWT_SECRET =
  process.env.JWT_SECRET || "test-only-secret-do-not-use-in-prod";

const request = require("supertest");
const jwt = require("jsonwebtoken");

const { signUserToken, verifyUserToken } = require("../backend/utils/jwt");

function authHeader(payload) {
  const token = signUserToken(payload);
  return { Authorization: `Bearer ${token}` };
}

const COMPANY_A = "COMPANY-A";
const USER_A = { id: "USER-A", username: "userA", role: "VIEWER", companyIds: [COMPANY_A] };
const CONTRACT_A = { id: "CONTRACT-A1", company_id: COMPANY_A };


/**
 * ------------------------------------------------------------
 * 1. AUDIT ACTOR SPOOFING
 * ------------------------------------------------------------
 */
describe("Audit trail — actor spoofing engellenir", () => {
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

  test("POST /api/audit — body.actor gönderilse bile INSERT'e her zaman JWT'deki kullanıcı adı yazılır", async () => {
    poolQueryMock.mockImplementation((sql, params) => {
      // P3 DÜZELTMESİ (test regresyonu — kod DEĞİL): audit.js artık
      // sahiplik kontrolünü accessScope üzerinden yapmak için
      // kontratın company_id'sini ÇEKİYOR ("SELECT company_id FROM
      // contracts WHERE id = $1"), eskisi gibi "SELECT 1 ... AND
      // company_id = ANY($2)" ile boolean dönmüyor — bkz.
      // license-security.test.js'teki aynı düzeltme notu.
      if (sql.includes("SELECT company_id FROM contracts")) {
        return Promise.resolve({ rows: [{ company_id: CONTRACT_A.company_id }] });
      }
      if (sql.includes("INSERT INTO audit_events")) {
        // actor, INSERT parametre listesinde 2. sırada
        // (id, actor, action, ...).
        expect(params[1]).toBe(USER_A.username);
        expect(params[1]).not.toBe("someone-else-spoofed");

        return Promise.resolve({
          rows: [{ id: "AUDIT-1", actor: params[1], action: "UPDATE" }]
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .post("/api/audit")
      .set(authHeader(USER_A))
      .send({
        id: "AUDIT-1",
        actor: "someone-else-spoofed",
        action: "UPDATE",
        entityType: "contract",
        contractId: CONTRACT_A.id
      });

    expect(res.status).toBe(201);
    expect(res.body.actor).toBe(USER_A.username);
  });
});


/**
 * ------------------------------------------------------------
 * 2. SECURITY HEADERS
 * ------------------------------------------------------------
 */
describe("Security headers", () => {
  let app;

  beforeEach(() => {
    jest.resetModules();

    jest.doMock("../backend/db/pool", () => ({
      query: jest.fn(),
      connect: jest.fn()
    }));

    app = require("../backend/app");
  });

  afterEach(() => {
    jest.resetModules();
  });

  test("her response'ta temel OWASP güvenlik header'ları bulunur", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["referrer-policy"]).toBe("no-referrer");
    expect(res.headers["content-security-policy"]).toContain("default-src 'none'");
    expect(res.headers["permissions-policy"]).toBeDefined();
  });

  test("düz HTTP (non-HTTPS) isteklerde Strict-Transport-Security dönmez", async () => {
    const res = await request(app).get("/health");

    expect(res.headers["strict-transport-security"]).toBeUndefined();
  });
});


/**
 * ------------------------------------------------------------
 * 3. RATE LIMITING
 * ------------------------------------------------------------
 */
describe("Rate limiting / abuse protection", () => {
  const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
  const ORIGINAL_LOGIN_MAX = process.env.LOGIN_RATE_LIMIT_MAX;
  const ORIGINAL_REGISTER_MAX = process.env.REGISTER_RATE_LIMIT_MAX;
  const ORIGINAL_ADMIN_MAX = process.env.ADMIN_RATE_LIMIT_MAX;

  let app;
  let poolQueryMock;

  beforeEach(() => {
    jest.resetModules();

    // Rate limiter, NODE_ENV=test iken devre dışıdır (bkz. dosya
    // başındaki not). Gerçek davranışı test edebilmek için
    // geçici olarak "test" dışında bir değere ayarlanır.
    process.env.NODE_ENV = "staging";

    // Testleri hızlı ve deterministik tutmak için düşük eşikler
    // kullanılır (production varsayılanları çok daha yüksektir,
    // bkz. backend/.env.example).
    process.env.LOGIN_RATE_LIMIT_MAX = "3";
    process.env.REGISTER_RATE_LIMIT_MAX = "3";
    process.env.ADMIN_RATE_LIMIT_MAX = "3";

    poolQueryMock = jest.fn().mockResolvedValue({ rows: [] });

    jest.doMock("../backend/db/pool", () => ({
      query: poolQueryMock,
      connect: jest.fn()
    }));

    app = require("../backend/app");
  });

  afterEach(() => {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;

    if (ORIGINAL_LOGIN_MAX === undefined) {
      delete process.env.LOGIN_RATE_LIMIT_MAX;
    } else {
      process.env.LOGIN_RATE_LIMIT_MAX = ORIGINAL_LOGIN_MAX;
    }

    if (ORIGINAL_REGISTER_MAX === undefined) {
      delete process.env.REGISTER_RATE_LIMIT_MAX;
    } else {
      process.env.REGISTER_RATE_LIMIT_MAX = ORIGINAL_REGISTER_MAX;
    }

    if (ORIGINAL_ADMIN_MAX === undefined) {
      delete process.env.ADMIN_RATE_LIMIT_MAX;
    } else {
      process.env.ADMIN_RATE_LIMIT_MAX = ORIGINAL_ADMIN_MAX;
    }

    jest.resetModules();
  });

  test("login brute-force — aynı IP+username limit (3) aşılınca 429 döner", async () => {
    // users tablosunda kullanıcı bulunamayacak şekilde mock'lanır
    // (asıl amaç auth mantığı değil, rate limiter eşiği).
    poolQueryMock.mockResolvedValue({ rows: [] });

    const credentials = { username: "brute-force-target", password: "wrong-password" };

    for (let i = 0; i < 3; i++) {
      const res = await request(app).post("/api/auth/login").send(credentials);
      // Kullanıcı bulunamadığı için 401 bekleniyor — limit dahilinde.
      expect(res.status).toBe(401);
    }

    const blockedRes = await request(app).post("/api/auth/login").send(credentials);

    expect(blockedRes.status).toBe(429);
    expect(blockedRes.body.code).toBe("RATE_LIMIT_EXCEEDED");
  });

  test("login rate limit anahtarı IP+username bazlıdır — farklı username aynı pencerede engellenmez", async () => {
    poolQueryMock.mockResolvedValue({ rows: [] });

    for (let i = 0; i < 3; i++) {
      await request(app)
        .post("/api/auth/login")
        .send({ username: "user-one", password: "x" });
    }

    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "user-two", password: "x" });

    // user-one limite takılmış olsa da user-two için ayrı bir
    // sayaç kullanılır.
    expect(res.status).toBe(401);
  });

  test("register abuse — aynı IP'den limit (3) aşılınca 429 döner (auth'tan önce)", async () => {
    // Authorization header GÖNDERİLMEDEN istek atılır. Rate
    // limiter, requireAuth'tan ÖNCE çalıştığı için (bkz.
    // routes/auth.js), limit dahilindeki istekler 401 ile
    // reddedilir; limit aşılınca 429 döner.
    for (let i = 0; i < 3; i++) {
      const res = await request(app).post("/api/auth/register").send({});
      expect(res.status).toBe(401);
    }

    const blockedRes = await request(app).post("/api/auth/register").send({});

    expect(blockedRes.status).toBe(429);
    expect(blockedRes.body.code).toBe("RATE_LIMIT_EXCEEDED");
  });

  test("admin endpoint abuse — aynı IP'den limit (3) aşılınca 429 döner", async () => {
    // Authorization header gönderilmez; adminRateLimiter,
    // requireAdmin'den ÖNCE (app.js'te router mount seviyesinde)
    // çalışır.
    for (let i = 0; i < 3; i++) {
      const res = await request(app).get("/api/admin/plans");
      expect(res.status).toBe(401);
    }

    const blockedRes = await request(app).get("/api/admin/plans");

    expect(blockedRes.status).toBe(429);
    expect(blockedRes.body.code).toBe("RATE_LIMIT_EXCEEDED");
  });
});


/**
 * ------------------------------------------------------------
 * 4. JWT — YALNIZCA HS256
 * ------------------------------------------------------------
 */
describe("JWT algorithm allowlist", () => {

  test("HS256 ile imzalanmış geçerli token doğrulanabilir", () => {
    const token = signUserToken(USER_A);
    const payload = verifyUserToken(token);

    expect(payload.username).toBe(USER_A.username);
  });

  test("alg='none' ile üretilmiş imzasız token reddedilir", () => {
    // jsonwebtoken, "none" algoritmasıyla secret olmadan token
    // üretebilir (bu, imzasız bir token anlamına gelir). Sunucu
    // taraflı doğrulamanın bunu KESİNLİKLE kabul etmemesi gerekir.
    const noneAlgToken = jwt.sign(
      { sub: USER_A.id, username: USER_A.username, role: USER_A.role, companyIds: USER_A.companyIds },
      null,
      { algorithm: "none" }
    );

    expect(() => verifyUserToken(noneAlgToken)).toThrow();
  });

  test("farklı bir algoritma (HS512) ile aynı secret kullanılarak üretilmiş token reddedilir", () => {
    const differentAlgToken = jwt.sign(
      { sub: USER_A.id, username: USER_A.username, role: USER_A.role, companyIds: USER_A.companyIds },
      process.env.JWT_SECRET,
      { algorithm: "HS512", expiresIn: "8h" }
    );

    expect(() => verifyUserToken(differentAlgToken)).toThrow();
  });
});
