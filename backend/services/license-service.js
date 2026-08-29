const pool = require("../db/pool");

const {
  getCompanyAncestryChain,
  getRootCompanyId,
  getDescendantCompanyIds
} = require("./organization-service");

/**
 * ============================================================
 * LICENSE SERVICE
 * ============================================================
 *
 * Şirket bazlı lisans ve kullanıcı limiti işlemlerinin
 * merkezi servis katmanıdır.
 *
 * ÖNEMLİ:
 * - Lisans şirkete aittir.
 * - Kullanıcıya doğrudan lisans atanmaz.
 * - Enterprise planında max_users = NULL => sınırsız kullanıcı.
 * - Lisans geçerliliği status + tarih birlikte kontrol edilerek
 *   belirlenir.
 *
 * P1 — HOLDİNG AĞACI LİSANS MİRASI:
 * Lisans her zaman ağacın KÖKÜNE (root — parent_company_id IS NULL
 * olan en üst ata) bağlıdır ve tüm alt şirketlere miras kalır
 * (bkz. db/init.sql P0 yorumu). getActiveCompanyLicense(companyId)
 * artık, companyId hangi düzeyde olursa olsun, önce ağacın kökünü
 * bulur ve lisansı kökün company_licenses satırından okur.
 *
 * GERİYE DÖNÜK UYUMLULUK: parent_company_id NULL olan (P0 öncesi
 * dahil tüm mevcut) düz şirketler için root === companyId'nin
 * kendisi olduğundan, bu fonksiyonun sonucu ESKİ davranışla BİREBİR
 * AYNIDIR — hiçbir mevcut müşteri için sonuç değişmez (P1 kabul
 * kriteri #13).
 *
 * companyId'nin KENDİ status'ü de ayrıca kontrol edilir: bir alt
 * şirket, kökün lisansı aktif olsa bile kendisi INACTIVE
 * yapılmışsa erişemez (bkz. admin.js PATCH /companies/:id/status —
 * bu davranış P0'daki tekil-şirket INACTIVE kuralının holding
 * ağacına genişletilmiş halidir).
 *
 * @param {string} companyId
 * @param {object} db - pool veya transaction client
 * @returns {Promise<object|null>}
 */
async function getActiveCompanyLicense(companyId, db = pool) {
  const chain = await getCompanyAncestryChain(companyId, db);

  if (chain.length === 0) {
    // Şirket hiç yok.
    return null;
  }

  const requestedCompany = chain[0];

  if (requestedCompany.status !== "ACTIVE") {
    // İstenen şirketin kendisi pasifleştirilmiş — kökün lisansı
    // aktif olsa bile bu şirket erişemez.
    return null;
  }

  const rootCompanyId = chain[chain.length - 1].id;

  const result = await db.query(
    `
      SELECT
        cl.id,
        cl.company_id,
        cl.plan_id,
        p.name AS plan_name,
        -- P0: Custom plan override — company_licenses.*_override doluysa
        -- (Custom lisanslarda admin elle girer) o değer, boşsa (NULL)
        -- plans tablosundaki paylaşımlı değer kullanılır. Starter/
        -- Professional/Enterprise lisanslarında override her zaman NULL
        -- olduğu için bu satır o planlar için ESKİ davranışla (p.max_users)
        -- birebir aynı sonucu üretir — mevcut enforcement mantığı
        -- (canAddUserToCompany/canAddContractToCompany) hiçbir kod
        -- değişikliği olmadan Custom override'ı da otomatik uygular.
        COALESCE(cl.max_users_override, p.max_users) AS max_users,
        COALESCE(cl.max_contracts_override, p.max_contracts) AS max_contracts,
        COALESCE(cl.max_companies_override, p.max_companies) AS max_companies,
        p.description,
        cl.starts_at,
        cl.expires_at,
        cl.status,
        cl.created_at
      FROM company_licenses cl
      INNER JOIN plans p
        ON p.id = cl.plan_id
      -- DÜZELTME (P0): şirket admin panelinden INACTIVE yapıldığında bu
      -- gerçekten erişimi kesmeliydi, sadece bir bayrak olarak kalmamalıydı.
      -- (P1: artık kökün — lisansın gerçek sahibinin — status'ü kontrol
      -- ediliyor; istenen alt şirketin kendi status'ü yukarıda ayrıca
      -- kontrol edildi.)
      INNER JOIN companies c
        ON c.id = cl.company_id
       AND c.status = 'ACTIVE'
      WHERE cl.company_id = $1
        AND cl.status = 'active'
        AND cl.starts_at <= NOW()
        AND (
          cl.expires_at IS NULL
          OR cl.expires_at > NOW()
        )
      ORDER BY cl.starts_at DESC, cl.id DESC
      LIMIT 1
    `,
    [rootCompanyId]
  );

  return result.rows[0] || null;
}


/**
 * Tek bir şirketin (ağaç dikkate alınmadan) mevcut kullanıcı
 * sayısını döndürür. Admin panelindeki şirket detayı gibi salt
 * GÖRÜNTÜLEME amaçlı yerlerde hâlâ kullanılabilir.
 *
 * ENFORCEMENT için değil — enforcement artık ağaç-bazlı ve
 * yalnızca ACTIVE kullanıcıları sayan getTreeActiveUserCount()
 * kullanır (bkz. aşağı).
 *
 * @param {string} companyId
 * @param {object} db
 * @returns {Promise<number>}
 */
async function getCompanyUserCount(companyId, db = pool) {
  const result = await db.query(
    `
      SELECT COUNT(*)::INTEGER AS user_count
      FROM user_companies
      WHERE company_id = $1
    `,
    [companyId]
  );

  return result.rows[0]?.user_count || 0;
}


/**
 * Bir holding AĞACININ (rootCompanyId + tüm alt şirketleri)
 * toplam ACTIVE kullanıcı sayısını döndürür.
 *
 * DÜZELTME (P1): P0'daki getCompanyUserCount status'e bakmadan
 * user_companies satırlarını sayıyordu — INACTIVE kullanıcılar da
 * limite dahil oluyordu. P1 kabul kriteri #6 gereği yalnızca
 * ACTIVE kullanıcılar sayılır; bir kullanıcı INACTIVE yapılırsa
 * kapasite gerçekten açılır.
 *
 * DISTINCT: aynı kullanıcı ağaçtaki birden fazla şirkete atanmış
 * olsa bile yalnızca BİR kez sayılır (bir kişi iki alt şirkete
 * bağlıysa iki koltuk harcamaz).
 *
 * @param {string} rootCompanyId
 * @param {object} db
 * @returns {Promise<number>}
 */
async function getTreeActiveUserCount(rootCompanyId, db = pool) {
  const treeIds = await getDescendantCompanyIds(rootCompanyId, db);

  if (treeIds.length === 0) {
    return 0;
  }

  const result = await db.query(
    `
      SELECT COUNT(DISTINCT uc.user_id)::INTEGER AS user_count
      FROM user_companies uc
      INNER JOIN users u
        ON u.id = uc.user_id
      WHERE uc.company_id = ANY($1)
        AND u.status = 'ACTIVE'
    `,
    [treeIds]
  );

  return result.rows[0]?.user_count || 0;
}


/**
 * Şirket (ağacı) yeni kullanıcı kabul edebilir mi?
 *
 * P1: companyId'nin ait olduğu AĞACIN KÖKÜNE bağlı lisans ve o
 * ağaçtaki TOPLAM ACTIVE kullanıcı sayısı üzerinden karar verir
 * (bkz. dosya başı — lisans mirası). parent_company_id NULL olan
 * (tek başına) şirketler için ağaç = [companyId] olduğundan
 * davranış P0 ile birebir aynıdır.
 *
 * Enterprise:
 * max_users = NULL => sınırsız
 *
 * Diğer planlar:
 * current_users < max_users
 *
 * @param {string} companyId
 * @param {object} db
 * @returns {Promise<object>}
 */
async function canAddUserToCompany(companyId, db = pool) {
  const license = await getActiveCompanyLicense(companyId, db);

  const rootCompanyId =
    (license && license.company_id) ||
    (await getRootCompanyId(companyId, db)) ||
    companyId;

  const currentUsers = await getTreeActiveUserCount(rootCompanyId, db);

  if (!license) {
    return {
      allowed: false,
      reason: "NO_ACTIVE_LICENSE",
      message: "Şirketin geçerli bir lisansı bulunmamaktadır.",
      license: null,
      currentUsers
    };
  }

  // Enterprise / sınırsız
  if (license.max_users === null) {
    return {
      allowed: true,
      reason: "UNLIMITED",
      message: "Sınırsız kullanıcı lisansı.",
      license,
      currentUsers,
      maxUsers: null,
      remainingUsers: null
    };
  }

  const allowed = currentUsers < license.max_users;

  return {
    allowed,
    reason: allowed ? "AVAILABLE" : "LIMIT_REACHED",
    message: allowed
      ? "Yeni kullanıcı eklenebilir."
      : "Şirket kullanıcı limitine ulaşmıştır.",
    license,
    currentUsers,
    maxUsers: license.max_users,
    remainingUsers: Math.max(
      license.max_users - currentUsers,
      0
    )
  };
}


/**
 * Tek bir şirketin (ağaç dikkate alınmadan) mevcut sözleşme
 * sayısını döndürür. Enforcement dışı, görüntüleme amaçlı.
 *
 * @param {string} companyId
 * @param {object} db
 * @returns {Promise<number>}
 */
async function getCompanyContractCount(companyId, db = pool) {
  const result = await db.query(
    `
      SELECT COUNT(*)::INTEGER AS contract_count
      FROM contracts
      WHERE company_id = $1
    `,
    [companyId]
  );

  return result.rows[0]?.contract_count || 0;
}


/**
 * Bir holding AĞACININ toplam sözleşme (kontrat) sayısını
 * döndürür (P1 kabul kriteri: "ilgili lisansın kapsamındaki
 * ağaçta toplam sözleşme limiti uygulanır").
 *
 * @param {string} rootCompanyId
 * @param {object} db
 * @returns {Promise<number>}
 */
async function getTreeContractCount(rootCompanyId, db = pool) {
  const treeIds = await getDescendantCompanyIds(rootCompanyId, db);

  if (treeIds.length === 0) {
    return 0;
  }

  const result = await db.query(
    `
      SELECT COUNT(*)::INTEGER AS contract_count
      FROM contracts
      WHERE company_id = ANY($1)
    `,
    [treeIds]
  );

  return result.rows[0]?.contract_count || 0;
}


/**
 * Şirket (ağacı) yeni bir sözleşme (kontrat) ekleyebilir mi?
 *
 * canAddUserToCompany ile birebir aynı mantık, ağaç-bazlı kontrat
 * sayısı üzerinden çalışır:
 *
 * Enterprise:
 * max_contracts = NULL => sınırsız
 *
 * Diğer planlar:
 * currentContracts < max_contracts
 *
 * @param {string} companyId
 * @param {object} db
 * @returns {Promise<object>}
 */
async function canAddContractToCompany(companyId, db = pool) {
  const license = await getActiveCompanyLicense(companyId, db);

  const rootCompanyId =
    (license && license.company_id) ||
    (await getRootCompanyId(companyId, db)) ||
    companyId;

  const currentContracts = await getTreeContractCount(rootCompanyId, db);

  if (!license) {
    return {
      allowed: false,
      reason: "NO_ACTIVE_LICENSE",
      message: "Şirketin geçerli bir lisansı bulunmamaktadır.",
      license: null,
      currentContracts
    };
  }

  // Enterprise / sınırsız
  if (license.max_contracts === null) {
    return {
      allowed: true,
      reason: "UNLIMITED",
      message: "Sınırsız sözleşme lisansı.",
      license,
      currentContracts,
      maxContracts: null,
      remainingContracts: null
    };
  }

  const allowed = currentContracts < license.max_contracts;

  return {
    allowed,
    reason: allowed ? "AVAILABLE" : "LIMIT_REACHED",
    message: allowed
      ? "Yeni sözleşme eklenebilir."
      : "Şirket sözleşme limitine ulaşmıştır.",
    license,
    currentContracts,
    maxContracts: license.max_contracts,
    remainingContracts: Math.max(
      license.max_contracts - currentContracts,
      0
    )
  };
}


/**
 * Bir holding ağacı, YENİ bir alt şirket daha kabul edebilir mi?
 *
 * parentCompanyId, oluşturulacak yeni şirketin parent_company_id'si
 * olarak verilecek şirkettir. Ağacın kökü bu parent'tan yukarı
 * doğru bulunur ve kökün lisansındaki max_companies (ana şirket
 * DAHİL toplam şirket sayısı) ile ağacın MEVCUT büyüklüğü
 * karşılaştırılır — yeni şirket henüz eklenmeden yapılan bu
 * kontrol sayesinde "max_companies=5 → ana+4 alt=OK, 5. alt=RED"
 * kuralı doğru uygulanır (mevcut boyut zaten 5'e ulaşmışsa yeni
 * ekleme reddedilir).
 *
 * parentCompanyId verilmemişse (yeni, bağımsız bir ANA şirket
 * oluşturuluyorsa) bu fonksiyon her zaman allowed=true döner —
 * yeni bağımsız bir ağacın henüz hiçbir lisansı yoktur, dolayısıyla
 * ağaç büyüklüğü limiti bu aşamada anlamsızdır. (Kimin yeni bağımsız
 * ana şirket oluşturabileceği — ör. yalnızca ADMIN — bu fonksiyonun
 * değil, route/authorization katmanının sorumluluğundadır.)
 *
 * ÖNEMLİ — RACE CONDITION: çağıran taraf (routes/admin.js), bu
 * fonksiyonu çağırmadan ÖNCE kök şirket satırını aynı transaction
 * içinde `FOR UPDATE` ile kilitlemelidir (auth.js/register'daki
 * lockCompaniesForUserCreation deseniyle aynı) — aksi halde eşzamanlı
 * iki istek limiti aynı anda "geçti" görüp limiti aşabilir.
 *
 * @param {string|null} parentCompanyId
 * @param {object} db
 * @returns {Promise<object>}
 */
async function canAddCompanyToTree(parentCompanyId, db = pool) {
  if (!parentCompanyId) {
    return {
      allowed: true,
      reason: "NEW_ROOT",
      message:
        "Yeni bağımsız ana şirket oluşturuluyor; ağaç büyüklüğü limiti bu aşamada uygulanmaz."
    };
  }

  const rootCompanyId = await getRootCompanyId(parentCompanyId, db);

  if (!rootCompanyId) {
    return {
      allowed: false,
      reason: "PARENT_NOT_FOUND",
      message: "Üst şirket (parent_company_id) bulunamadı."
    };
  }

  const license = await getActiveCompanyLicense(rootCompanyId, db);

  const treeIds = await getDescendantCompanyIds(rootCompanyId, db);
  const currentCompanies = treeIds.length;

  if (!license) {
    return {
      allowed: false,
      reason: "NO_ACTIVE_LICENSE",
      message: "Şirket ağacının geçerli bir lisansı bulunmamaktadır.",
      license: null,
      currentCompanies
    };
  }

  // Enterprise / sınırsız
  if (license.max_companies === null) {
    return {
      allowed: true,
      reason: "UNLIMITED",
      message: "Sınırsız şirket sayısına izin veren lisans.",
      license,
      currentCompanies,
      maxCompanies: null,
      remainingCompanies: null
    };
  }

  const allowed = currentCompanies < license.max_companies;

  return {
    allowed,
    reason: allowed ? "AVAILABLE" : "LIMIT_REACHED",
    message: allowed
      ? "Yeni şirket eklenebilir."
      : "Holding ağacı şirket limitine ulaşmıştır.",
    license,
    currentCompanies,
    maxCompanies: license.max_companies,
    remainingCompanies: Math.max(
      license.max_companies - currentCompanies,
      0
    )
  };
}


/**
 * Kullanıcının bağlı olduğu şirketlerin lisanslarını getirir.
 *
 * Bir kullanıcı birden fazla şirkete bağlı olabilir.
 *
 * @param {string} userId
 * @param {object} db
 * @returns {Promise<Array>}
 */
async function getUserLicenses(userId, db = pool) {
  const result = await db.query(
    `
      SELECT
        c.id AS company_id,
        c.name AS company_name,

        cl.id AS license_id,
        cl.plan_id,
        p.name AS plan_name,
        -- P0: getActiveCompanyLicense ile aynı override mantığı (yukarıya
        -- bkz.) — burada da cl.* zaten LATERAL alt sorgudan geldiği için
        -- max_users_override/max_contracts_override/max_companies_override
        -- kolonları mevcuttur.
        COALESCE(cl.max_users_override, p.max_users) AS max_users,
        COALESCE(cl.max_contracts_override, p.max_contracts) AS max_contracts,
        COALESCE(cl.max_companies_override, p.max_companies) AS max_companies,
        p.description,

        cl.starts_at,
        cl.expires_at,
        cl.status,

        (
          SELECT COUNT(*)::INTEGER
          FROM user_companies uc2
          WHERE uc2.company_id = c.id
        ) AS current_users,

        (
          SELECT COUNT(*)::INTEGER
          FROM contracts ct
          WHERE ct.company_id = c.id
        ) AS current_contracts

      FROM user_companies uc

      INNER JOIN companies c
        ON c.id = uc.company_id

      LEFT JOIN LATERAL (
        SELECT cl.*
        FROM company_licenses cl
        WHERE cl.company_id = c.id
          -- getActiveCompanyLicense ile aynı kural: şirket admin
          -- panelinden pasifleştirilmişse (status != 'ACTIVE') hiçbir
          -- lisans "aktif" sayılmaz.
          AND c.status = 'ACTIVE'
          AND cl.status = 'active'
          AND cl.starts_at <= NOW()
          AND (
            cl.expires_at IS NULL
            OR cl.expires_at > NOW()
          )
        ORDER BY cl.starts_at DESC, cl.id DESC
        LIMIT 1
      ) cl
        ON TRUE

      LEFT JOIN plans p
        ON p.id = cl.plan_id

      WHERE uc.user_id = $1

      ORDER BY c.name ASC
    `,
    [userId]
  );

  return result.rows.map(row => ({
    companyId: row.company_id,
    companyName: row.company_name,

    hasActiveLicense: Boolean(row.license_id),

    license: row.license_id
      ? {
          id: row.license_id,
          planId: row.plan_id,
          planName: row.plan_name,
          maxUsers: row.max_users,
          maxContracts: row.max_contracts,
          maxCompanies: row.max_companies,
          description: row.description,
          startsAt: row.starts_at,
          expiresAt: row.expires_at,
          status: row.status
        }
      : null,

    currentUsers: Number(row.current_users || 0),

    remainingUsers:
      row.max_users === null || row.max_users === undefined
        ? null
        : Math.max(
            Number(row.max_users) - Number(row.current_users || 0),
            0
          ),

    currentContracts: Number(row.current_contracts || 0),

    remainingContracts:
      row.max_contracts === null || row.max_contracts === undefined
        ? null
        : Math.max(
            Number(row.max_contracts) - Number(row.current_contracts || 0),
            0
          )
  }));
}


/**
 * Kullanıcının aktif lisanslı şirketlerini getirir.
 *
 * En az bir geçerli lisans varsa kullanıcı sistemde
 * lisans açısından erişilebilir kabul edilir.
 *
 * @param {string} userId
 * @param {object} db
 * @returns {Promise<Array>}
 */
async function getUserLicensedCompanies(userId, db = pool) {
  const licenses = await getUserLicenses(userId, db);

  return licenses.filter(company => company.hasActiveLicense);
}


/**
 * Şirketin geçerli lisansı var mı?
 *
 * @param {string} companyId
 * @param {object} db
 * @returns {Promise<boolean>}
 */
async function hasActiveCompanyLicense(companyId, db = pool) {
  const license = await getActiveCompanyLicense(companyId, db);

  return Boolean(license);
}


/**
 * Şirketin belirli bir plana (veya daha üstüne) erişimi var mı?
 *
 * Örnek:
 *
 * hasPlanAccess(companyId, "professional")
 *
 * Plan hiyerarşisi middleware/license.js ile birebir aynıdır:
 *
 * starter = 1, professional = 2, enterprise = 3
 *
 * Enterprise lisansı olan bir şirket professional/starter
 * kontrolünden de geçer (üst plan alt plan özelliklerini kullanabilir).
 *
 * @param {string} companyId
 * @param {string} planName
 * @param {object} db
 * @returns {Promise<boolean>}
 */
const PLAN_LEVELS = {
  starter: 1,
  professional: 2,
  enterprise: 3
};

async function hasPlanAccess(companyId, planName, db = pool) {
  const license = await getActiveCompanyLicense(companyId, db);

  if (!license) {
    return false;
  }

  const currentLevel = PLAN_LEVELS[license.plan_id] || 0;
  const requiredLevel = PLAN_LEVELS[planName] || 0;

  return currentLevel >= requiredLevel;
}


/**
 * Kullanıcının en yüksek aktif planını belirler.
 *
 * Bu fonksiyon özellikle bir kullanıcı birden fazla şirkete
 * bağlı olduğunda frontend'in genel lisans durumunu göstermek
 * için kullanılabilir.
 *
 * Plan sırası:
 *
 * starter       = 1
 * professional  = 2
 * enterprise    = 3
 */
async function getUserHighestPlan(userId, db = pool) {
  const licenses = await getUserLicensedCompanies(userId, db);

  const planRank = {
    starter: 1,
    professional: 2,
    enterprise: 3
  };

  if (licenses.length === 0) {
    return null;
  }

  return licenses
    .map(company => company.license)
    .sort(
      (a, b) =>
        (planRank[b.planId] || 0) -
        (planRank[a.planId] || 0)
    )[0];
}


/**
 * ============================================================
 * P5-A — USER / CONTRACT LIMIT CONCURRENCY HELPER
 * ============================================================
 *
 * Tree-level limit kontrollerinden ÖNCE çağrılmalıdır.
 * Verilen companyId'nin kök şirket satırını FOR UPDATE ile
 * kilitler. Böylece aynı holding ağacında eşzamanlı
 * user/contract create istekleri sıraya girer ve
 * canAddUserToCompany / canAddContractToCompany
 * aynı snapshot'ı görür (TOCTOU race kapanır).
 *
 * companyId yoksa / kök bulunamazsa null döner.
 * Çağıran taraf transaction içinde olmalıdır.
 *
 * @param {string} companyId
 * @param {object} db - transaction client
 * @returns {Promise<string|null>} rootCompanyId
 */
async function lockRootCompanyForLimit(companyId, db) {
  if (!companyId) {
    return null;
  }

  const rootCompanyId = await getRootCompanyId(companyId, db);

  if (!rootCompanyId) {
    return null;
  }

  await db.query(
    `SELECT id FROM companies WHERE id = $1 FOR UPDATE`,
    [rootCompanyId]
  );

  return rootCompanyId;
}

module.exports = {
  getActiveCompanyLicense,
  getCompanyUserCount,
  getTreeActiveUserCount,
  canAddUserToCompany,
  getCompanyContractCount,
  getTreeContractCount,
  canAddContractToCompany,
  canAddCompanyToTree,
  getUserLicenses,
  getUserLicensedCompanies,
  hasActiveCompanyLicense,
  hasPlanAccess,
  getUserHighestPlan,
  lockRootCompanyForLimit
};

