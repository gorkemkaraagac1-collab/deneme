const pool = require("../db/pool");

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
 */

/**
 * Aktif ve tarih açısından geçerli şirket lisansını getirir.
 *
 * @param {string} companyId
 * @param {object} db - pool veya transaction client
 * @returns {Promise<object|null>}
 */
async function getActiveCompanyLicense(companyId, db = pool) {
  const result = await db.query(
    `
      SELECT
        cl.id,
        cl.company_id,
        cl.plan_id,
        p.name AS plan_name,
        p.max_users,
        p.max_contracts,
        p.description,
        cl.starts_at,
        cl.expires_at,
        cl.status,
        cl.created_at
      FROM company_licenses cl
      INNER JOIN plans p
        ON p.id = cl.plan_id
      -- DÜZELTME: şirket admin panelinden INACTIVE yapıldığında bu
      -- gerçekten erişimi kesmeliydi, sadece bir bayrak olarak kalmamalıydı.
      -- companies.status = 'ACTIVE' şartı olmadan, pasifleştirilmiş bir
      -- şirketin kullanıcıları company_licenses satırı hâlâ 'active' ve
      -- süresi dolmamış olduğu için sisteme erişmeye devam ederdi.
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
    [companyId]
  );

  return result.rows[0] || null;
}


/**
 * Şirketin mevcut kullanıcı sayısını döndürür.
 *
 * user_companies tablosu ilişki tablosu olduğu için
 * COUNT(*) üzerinden hesaplanır.
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
 * Şirket yeni kullanıcı kabul edebilir mi?
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

  if (!license) {
    return {
      allowed: false,
      reason: "NO_ACTIVE_LICENSE",
      message: "Şirketin geçerli bir lisansı bulunmamaktadır.",
      license: null,
      currentUsers: await getCompanyUserCount(companyId, db)
    };
  }

  const currentUsers = await getCompanyUserCount(companyId, db);

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
 * Şirketin mevcut sözleşme (kontrat) sayısını döndürür.
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
 * Şirket yeni bir sözleşme (kontrat) ekleyebilir mi?
 *
 * canAddUserToCompany ile birebir aynı mantık, kullanıcı yerine
 * kontrat sayısı üzerinden çalışır:
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

  if (!license) {
    return {
      allowed: false,
      reason: "NO_ACTIVE_LICENSE",
      message: "Şirketin geçerli bir lisansı bulunmamaktadır.",
      license: null,
      currentContracts: await getCompanyContractCount(companyId, db)
    };
  }

  const currentContracts = await getCompanyContractCount(companyId, db);

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
        p.max_users,
        p.max_contracts,
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


module.exports = {
  getActiveCompanyLicense,
  getCompanyUserCount,
  canAddUserToCompany,
  getCompanyContractCount,
  canAddContractToCompany,
  getUserLicenses,
  getUserLicensedCompanies,
  hasActiveCompanyLicense,
  hasPlanAccess,
  getUserHighestPlan
};
