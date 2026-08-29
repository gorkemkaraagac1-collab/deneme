/**
 * ============================================================
 * P1 — ACCESS CONTROL / ROLE MATRIX / MUST-CHANGE-PASSWORD TESTS
 * ============================================================
 *
 * test/license-security*.test.js ile AYNI desen kullanılır:
 * backend/db/pool.js mock'lanır, gerçek bir PostgreSQL bağlantısı
 * OLMADAN hem services/organization-service.js'in saf ağaç/rol
 * mantığı, hem de bu mantığı kullanan route/middleware katmanının
 * yetkilendirme davranışı doğrulanır.
 *
 * NOT: Bu dosya CI'da (node_modules + jest kurulu bir ortamda)
 * çalıştırılmak üzere yazılmıştır. Bu oturumda ağ erişimi kapalı
 * olduğu ve node_modules bulunmadığı için (npm install
 * yapılamadı — bkz. P1 kod raporu "Test / Doğrulama" bölümü)
 * BURADA ÇALIŞTIRILAMADI; yalnızca `node -c` ile sözdizimi
 * doğrulandı.
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
 * SABİT TEST VERİSİ — 3 seviyeli bir holding ağacı:
 *
 *   HOLDING (root, parent=null)
 *     ├── SUB_A (parent=HOLDING)
 *     │     └── SUB_A_CHILD (parent=SUB_A)
 *     └── SUB_B (parent=HOLDING)
 *
 *   OTHER_HOLDING (ayrı, ilgisiz bir ağaç — root, parent=null)
 * ------------------------------------------------------------
 */

const HOLDING = "COMPANY-HOLDING";
const SUB_A = "COMPANY-SUB-A";
const SUB_A_CHILD = "COMPANY-SUB-A-CHILD";
const SUB_B = "COMPANY-SUB-B";
const OTHER_HOLDING = "COMPANY-OTHER-HOLDING";

function companyRow(id, parentId, status = "ACTIVE") {
  return { id, parent_company_id: parentId, status };
}

const COMPANIES_BY_ID = {
  [HOLDING]: companyRow(HOLDING, null),
  [SUB_A]: companyRow(SUB_A, HOLDING),
  [SUB_A_CHILD]: companyRow(SUB_A_CHILD, SUB_A),
  [SUB_B]: companyRow(SUB_B, HOLDING),
  [OTHER_HOLDING]: companyRow(OTHER_HOLDING, null)
};

const CHILDREN_BY_PARENT = {
  [HOLDING]: [SUB_A, SUB_B],
  [SUB_A]: [SUB_A_CHILD],
  [SUB_A_CHILD]: [],
  [SUB_B]: [],
  [OTHER_HOLDING]: []
};

/**
 * organization-service.js'in ANCESTRY (yukarı) ve TREE (aşağı)
 * recursive CTE'lerini, gerçek bir SQL motoru olmadan JS
 * tarafında simüle eden yardımcılar. Testler
 * db.query'nin SQL metnine bakarak hangi CTE'nin çalıştığını
 * ayırt eder (WITH RECURSIVE ancestry / WITH RECURSIVE tree).
 */
function simulateAncestryChain(companyId) {
  const chain = [];
  let current = COMPANIES_BY_ID[companyId];
  let depth = 0;

  while (current) {
    chain.push({ ...current, depth });
    if (!current.parent_company_id) break;
    current = COMPANIES_BY_ID[current.parent_company_id];
    depth += 1;
  }

  return chain;
}

function simulateDescendantTree(companyId) {
  const result = [];
  const stack = [companyId];

  while (stack.length > 0) {
    const id = stack.pop();
    if (!COMPANIES_BY_ID[id]) continue;
    result.push(id);
    stack.push(...(CHILDREN_BY_PARENT[id] || []));
  }

  return result;
}

function makeOrgAwarePoolMock(extraHandlers = []) {
  return {
    query: jest.fn(async (sql, params) => {
      const text = String(sql);

      if (text.includes("WITH RECURSIVE ancestry")) {
        const companyId = params[0];
        return { rows: simulateAncestryChain(companyId) };
      }

      if (text.includes("WITH RECURSIVE tree")) {
        const companyId = params[0];
        return { rows: simulateDescendantTree(companyId).map(id => ({ id })) };
      }

      for (const handler of extraHandlers) {
        const result = handler(text, params);
        if (result !== undefined) return result;
      }

      throw new Error(`Beklenmeyen SQL sorgusu (mock'lanmadı): ${text}`);
    }),
    connect: jest.fn()
  };
}


describe("organization-service — company tree resolution", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test("getRootCompanyId: parent_company_id NULL olan bir şirket için kendi id'sini döner (P1 kabul kriteri #13 — geriye dönük uyumluluk)", async () => {
    const pool = makeOrgAwarePoolMock();
    jest.doMock("../backend/db/pool", () => pool);

    const { getRootCompanyId } = require("../backend/services/organization-service");

    await expect(getRootCompanyId(HOLDING, pool)).resolves.toBe(HOLDING);
  });

  test("getRootCompanyId: derin bir alt şirket için ağacın kökünü bulur", async () => {
    const pool = makeOrgAwarePoolMock();

    const { getRootCompanyId } = require("../backend/services/organization-service");

    await expect(getRootCompanyId(SUB_A_CHILD, pool)).resolves.toBe(HOLDING);
  });

  test("getDescendantCompanyIds: bir ara düğümden başlayınca yalnızca KENDİ alt ağacını döner, yukarı (holding/kardeş) çıkmaz", async () => {
    const pool = makeOrgAwarePoolMock();

    const { getDescendantCompanyIds } = require("../backend/services/organization-service");

    const tree = await getDescendantCompanyIds(SUB_A, pool);

    expect(new Set(tree)).toEqual(new Set([SUB_A, SUB_A_CHILD]));
    expect(tree).not.toContain(HOLDING);
    expect(tree).not.toContain(SUB_B);
  });

  test("getDescendantCompanyIds: holding kökünden başlayınca TÜM ağacı döner", async () => {
    const pool = makeOrgAwarePoolMock();

    const { getDescendantCompanyIds } = require("../backend/services/organization-service");

    const tree = await getDescendantCompanyIds(HOLDING, pool);

    expect(new Set(tree)).toEqual(new Set([HOLDING, SUB_A, SUB_A_CHILD, SUB_B]));
  });
});


describe("organization-service — resolveAccessScope", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test("ADMIN → global erişim (allowedCompanyIds=null)", async () => {
    const pool = makeOrgAwarePoolMock();
    const { resolveAccessScope } = require("../backend/services/organization-service");

    const scope = await resolveAccessScope(
      { role: "ADMIN", companyIds: [] },
      pool
    );

    expect(scope.isGlobalAdmin).toBe(true);
    expect(scope.allowedCompanyIds).toBeNull();
  });

  test("ACCOUNTANT_MANAGER holding KÖKÜNE atanmışsa tüm ağacı görür (kabul kriteri #1)", async () => {
    const pool = makeOrgAwarePoolMock();
    const { resolveAccessScope } = require("../backend/services/organization-service");

    const scope = await resolveAccessScope(
      { role: "ACCOUNTANT_MANAGER", companyIds: [HOLDING] },
      pool
    );

    expect(scope.isGlobalAdmin).toBe(false);
    expect(new Set(scope.allowedCompanyIds)).toEqual(
      new Set([HOLDING, SUB_A, SUB_A_CHILD, SUB_B])
    );
  });

  test("ACCOUNTANT_MANAGER bir ALT şirkete atanmışsa holdingi/kardeşini GÖREMEZ (kabul kriteri #2)", async () => {
    const pool = makeOrgAwarePoolMock();
    const { resolveAccessScope } = require("../backend/services/organization-service");

    const scope = await resolveAccessScope(
      { role: "ACCOUNTANT_MANAGER", companyIds: [SUB_A] },
      pool
    );

    expect(new Set(scope.allowedCompanyIds)).toEqual(
      new Set([SUB_A, SUB_A_CHILD])
    );
    expect(scope.allowedCompanyIds).not.toContain(HOLDING);
    expect(scope.allowedCompanyIds).not.toContain(SUB_B);
  });

  test("ACCOUNTANT_MANAGER başka bir holdingi hiçbir şekilde göremez", async () => {
    const pool = makeOrgAwarePoolMock();
    const { resolveAccessScope, isCompanyInScope } = require("../backend/services/organization-service");

    const scope = await resolveAccessScope(
      { role: "ACCOUNTANT_MANAGER", companyIds: [HOLDING] },
      pool
    );

    expect(isCompanyInScope(OTHER_HOLDING, scope)).toBe(false);
  });

  test("ACCOUNTANT/CONTROLLER/VIEWER → eski davranışla birebir aynı (yalnızca kendi companyIds'i, ağaç genişletmesi yok)", async () => {
    const pool = makeOrgAwarePoolMock();
    const { resolveAccessScope } = require("../backend/services/organization-service");

    for (const role of ["ACCOUNTANT", "CONTROLLER", "VIEWER"]) {
      const scope = await resolveAccessScope(
        { role, companyIds: [SUB_A] },
        pool
      );

      expect(scope.allowedCompanyIds).toEqual([SUB_A]);
    }
  });

  test("hiçbir şirkete atanmamış ACCOUNTANT_MANAGER hiçbir şeye erişemez (sessizce global'e düşmez)", async () => {
    const pool = makeOrgAwarePoolMock();
    const { resolveAccessScope } = require("../backend/services/organization-service");

    const scope = await resolveAccessScope(
      { role: "ACCOUNTANT_MANAGER", companyIds: [] },
      pool
    );

    expect(scope.isGlobalAdmin).toBe(false);
    expect(scope.allowedCompanyIds).toEqual([]);
  });
});


describe("organization-service — rol yaratma matrisi (P1 madde 4)", () => {
  const { canAssignRole } = require("../backend/services/organization-service");

  test("ADMIN her rolü atayabilir", () => {
    for (const role of ["ADMIN", "ACCOUNTANT_MANAGER", "ACCOUNTANT", "CONTROLLER", "VIEWER"]) {
      expect(canAssignRole("ADMIN", role)).toBe(true);
    }
  });

  test("ACCOUNTANT_MANAGER yalnızca ACCOUNTANT/CONTROLLER/VIEWER atayabilir", () => {
    expect(canAssignRole("ACCOUNTANT_MANAGER", "ACCOUNTANT")).toBe(true);
    expect(canAssignRole("ACCOUNTANT_MANAGER", "CONTROLLER")).toBe(true);
    expect(canAssignRole("ACCOUNTANT_MANAGER", "VIEWER")).toBe(true);
  });

  test("ACCOUNTANT_MANAGER; ADMIN veya ACCOUNTANT_MANAGER OLUŞTURAMAZ (kabul kriteri #3)", () => {
    expect(canAssignRole("ACCOUNTANT_MANAGER", "ADMIN")).toBe(false);
    expect(canAssignRole("ACCOUNTANT_MANAGER", "ACCOUNTANT_MANAGER")).toBe(false);
  });

  test("ACCOUNTANT/CONTROLLER/VIEWER hiçbir rol atayamaz", () => {
    for (const actor of ["ACCOUNTANT", "CONTROLLER", "VIEWER"]) {
      for (const target of ["ADMIN", "ACCOUNTANT_MANAGER", "ACCOUNTANT", "CONTROLLER", "VIEWER"]) {
        expect(canAssignRole(actor, target)).toBe(false);
      }
    }
  });
});


describe("organization-service — isContractWriteRole (P1-B — CONTROLLER/VIEWER salt okunur)", () => {
  const { isContractWriteRole } = require("../backend/services/organization-service");

  test("ADMIN/ACCOUNTANT_MANAGER/ACCOUNTANT yazabilir", () => {
    expect(isContractWriteRole("ADMIN")).toBe(true);
    expect(isContractWriteRole("ACCOUNTANT_MANAGER")).toBe(true);
    expect(isContractWriteRole("ACCOUNTANT")).toBe(true);
  });

  test("CONTROLLER ve VIEWER yazamaz (salt okunur / izleme)", () => {
    expect(isContractWriteRole("CONTROLLER")).toBe(false);
    expect(isContractWriteRole("VIEWER")).toBe(false);
  });
});


describe("routes/contracts.js — P1-B yazma yetkisi (route seviyesi)", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    jest.resetModules();
  });

  test("CONTROLLER rolü POST /api/contracts ile 403 alır (CONTRACT_WRITE_ACCESS_DENIED)", async () => {
    const pool = makeOrgAwarePoolMock();
    jest.doMock("../backend/db/pool", () => pool);

    const app = require("../backend/app");

    const headers = authHeader({
      id: "USER-CONTROLLER",
      username: "controller1",
      role: "CONTROLLER",
      companyIds: [SUB_A]
    });

    const res = await request(app)
      .post("/api/contracts")
      .set(headers)
      .send({
        id: "CONTRACT-X",
        companyId: SUB_A,
        company: "Test A.Ş.",
        supplier: "Tedarikçi",
        startDate: "2026-01-01",
        endDate: "2027-01-01"
      });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("CONTRACT_WRITE_ACCESS_DENIED");
  });

  test("VIEWER rolü DELETE /api/contracts/:id ile 403 alır", async () => {
    const pool = makeOrgAwarePoolMock();
    jest.doMock("../backend/db/pool", () => pool);

    const app = require("../backend/app");

    const headers = authHeader({
      id: "USER-VIEWER",
      username: "viewer1",
      role: "VIEWER",
      companyIds: [SUB_A]
    });

    const res = await request(app)
      .delete("/api/contracts/CONTRACT-X")
      .set(headers);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("CONTRACT_WRITE_ACCESS_DENIED");
  });
});


describe("middleware/auth.js — P1-D must_change_password gate", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    jest.resetModules();
  });

  test("mustChangePassword=true olan bir kullanıcı normal bir endpoint'e (ör. GET /api/contracts) 403 MUST_CHANGE_PASSWORD alır", async () => {
    const pool = makeOrgAwarePoolMock();
    jest.doMock("../backend/db/pool", () => pool);

    const app = require("../backend/app");

    const headers = authHeader({
      id: "USER-MCP",
      username: "mustchange1",
      role: "VIEWER",
      companyIds: [SUB_A],
      mustChangePassword: true
    });

    const res = await request(app)
      .get("/api/contracts")
      .set(headers);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("MUST_CHANGE_PASSWORD");
  });

  test("mustChangePassword=true olan bir kullanıcı GET /api/auth/me'ye erişebilir (istisna)", async () => {
    // Bu route (routes/auth.js GET /me) profil + companyIds + license
    // bilgisini ayrıca DB'den okur (getUserCompanyIds, getUserLicenses).
    // Burada asıl doğrulanmak istenen tek şey requireAuth'un bu path'i
    // must-change-password kapısından İSTİSNA tutması olduğundan,
    // mock'lanmamış herhangi bir SELECT için boş sonuç dönen bir
    // catch-all kullanılıyor (böylece test, /me'nin kendi iç sorgu
    // zincirinin tam simülasyonuna bağımlı olmuyor).
    const pool = makeOrgAwarePoolMock([
      (text) => {
        if (text.includes("FROM users") && text.includes("WHERE id = $1")) {
          return {
            rows: [{
              email: null,
              first_name: null,
              last_name: null,
              must_change_password: true
            }]
          };
        }
        // Tanınmayan tüm SELECT'ler için boş sonuç (catch-all) —
        // getUserCompanyIds/getUserLicenses gibi bu testin odağı
        // olmayan yardımcı sorguları kırmadan geçmesini sağlar.
        return { rows: [] };
      }
    ]);
    jest.doMock("../backend/db/pool", () => pool);

    const app = require("../backend/app");

    const headers = authHeader({
      id: "USER-MCP",
      username: "mustchange1",
      role: "VIEWER",
      companyIds: [SUB_A],
      mustChangePassword: true
    });

    const res = await request(app)
      .get("/api/auth/me")
      .set(headers);

    // Asıl kontrol edilen: middleware/auth.js'in MUST_CHANGE_PASSWORD
    // koduyla 403 DÖNMEMESİ (route'un kendi iç mantığından kaynaklı
    // farklı bir hata — ör. 500 — bu testin kapsamı dışındadır).
    expect(res.body && res.body.code).not.toBe("MUST_CHANGE_PASSWORD");
  });
});


describe("routes/admin.js — P1 rol yaratma matrisi (route seviyesi)", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    jest.resetModules();
  });

  test("ACCOUNTANT_MANAGER, POST /api/admin/users ile ADMIN rolü oluşturamaz (403 ROLE_ASSIGNMENT_FORBIDDEN)", async () => {
    const pool = makeOrgAwarePoolMock();
    jest.doMock("../backend/db/pool", () => pool);

    const app = require("../backend/app");

    const headers = authHeader({
      id: "USER-MANAGER",
      username: "manager1",
      role: "ACCOUNTANT_MANAGER",
      companyIds: [HOLDING]
    });

    const res = await request(app)
      .post("/api/admin/users")
      .set(headers)
      .send({
        username: "yeni_admin",
        password: "GucluBirParola123!",
        role: "ADMIN",
        company_ids: [SUB_A]
      });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("ROLE_ASSIGNMENT_FORBIDDEN");
  });

  test("ACCOUNTANT_MANAGER, kendi ağacı DIŞINDAKİ bir şirkete kullanıcı ekleyemez (403 COMPANY_ACCESS_DENIED)", async () => {
    const pool = makeOrgAwarePoolMock();
    jest.doMock("../backend/db/pool", () => pool);

    const app = require("../backend/app");

    const headers = authHeader({
      id: "USER-MANAGER",
      username: "manager1",
      role: "ACCOUNTANT_MANAGER",
      companyIds: [SUB_A]
    });

    const res = await request(app)
      .post("/api/admin/users")
      .set(headers)
      .send({
        username: "yeni_kullanici",
        password: "GucluBirParola123!",
        role: "ACCOUNTANT",
        company_ids: [OTHER_HOLDING]
      });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("COMPANY_ACCESS_DENIED");
  });

  test("VIEWER veya ACCOUNTANT rolündeki bir kullanıcı /api/admin/users'a hiç erişemez (403 STAFF_ACCESS_REQUIRED)", async () => {
    const pool = makeOrgAwarePoolMock();
    jest.doMock("../backend/db/pool", () => pool);

    const app = require("../backend/app");

    for (const role of ["VIEWER", "ACCOUNTANT", "CONTROLLER"]) {
      const headers = authHeader({
        id: `USER-${role}`,
        username: `user_${role.toLowerCase()}`,
        role,
        companyIds: [SUB_A]
      });

      const res = await request(app)
        .get("/api/admin/users")
        .set(headers);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("STAFF_ACCESS_REQUIRED");
    }
  });
});
