// backend/services/license-service.js
// Lisans limitleri enforcement
// P1: Gerçek enforcement'a bağlandı

const db = require('../db');
const companyTree = require('./company-tree');

/**
 * Etkin lisans limitlerini getirir
 * COALESCE(override, plan_değeri) mantığı
 * Sadece aktif ve süresi dolmamış lisansları döndürür
 */
async function getEffectiveLimits(companyId) {
  const res = await db.query(
    `SELECT 
       COALESCE(cl.max_users_override, p.max_users) as max_users,
       COALESCE(cl.max_contracts_override, p.max_contracts) as max_contracts,
       COALESCE(cl.max_companies_override, p.max_companies) as max_companies,
       cl.status as license_status,
       cl.expires_at,
       cl.plan_id
     FROM company_licenses cl
     JOIN plans p ON cl.plan_id = p.id
     WHERE cl.company_id = $1
       AND cl.status = 'active'
       AND (cl.expires_at IS NULL OR cl.expires_at > NOW())
     ORDER BY cl.created_at DESC
     LIMIT 1`,
    [companyId]
  );
  
  if (res.rows.length === 0) {
    // Aktif lisans bulunamadı
    return {
      max_users: 0,
      max_contracts: 0,
      max_companies: 1,
      license_status: 'none',
      expires_at: null,
      plan_id: null
    };
  }
  
  return res.rows[0];
}

/**
 * max_companies enforcement kontrolü
 * Toplam şirket sayısı ana şirket dahil
 * max_companies = 5 → ana + 4 alt şirket
 */
async function canCreateCompany(parentCompanyId) {
  // Parent yoksa ana şirket oluşturma - lisans kontrolü
  if (!parentCompanyId) {
    // Yeni bir holding oluşturma - lisans gerektirir
    // Bu durumda şirket başına lisans atanmalı
    return { allowed: true, reason: null };
  }
  
  const limits = await getEffectiveLimits(parentCompanyId);
  
  if (limits.license_status === 'none') {
    return { allowed: false, reason: 'No active license for this organization' };
  }
  
  const totalCompanies = await companyTree.getTotalCompanyCount(parentCompanyId);
  
  if (totalCompanies >= Number(limits.max_companies)) {
    return { 
      allowed: false, 
      reason: `Company limit reached (${limits.max_companies} companies allowed)`,
      currentCount: totalCompanies,
      maxAllowed: Number(limits.max_companies)
    };
  }
  
  return { allowed: true, limits, currentCount: totalCompanies };
}

/**
 * max_users enforcement kontrolü
 * Sadece ACTIVE kullanıcılar sayılır
 * INACTIVE kullanıcılar sayıma dahil DEĞİLDİR
 */
async function canCreateUser(companyId) {
  const limits = await getEffectiveLimits(companyId);
  
  if (limits.license_status === 'none') {
    return { allowed: false, reason: 'No active license for this organization' };
  }
  
  // Ağaçtaki tüm şirketlerin ID'lerini getir
  const treeIds = await companyTree.getCompanyTreeIds(companyId);
  
  // ACTIVE kullanıcı sayısını say
  const activeUsersRes = await db.query(
    `SELECT COUNT(DISTINCT u.id) as count
     FROM users u
     JOIN user_companies uc ON u.id = uc.user_id
     WHERE uc.company_id = ANY($1)
       AND u.is_active = true`,
    [treeIds]
  );
  
  const activeUsers = Number(activeUsersRes.rows[0].count);
  const maxUsers = Number(limits.max_users);
  
  if (activeUsers >= maxUsers) {
    return { 
      allowed: false, 
      reason: `Active user limit reached (${maxUsers} users allowed)`,
      currentCount: activeUsers,
      maxAllowed: maxUsers
    };
  }
  
  return { allowed: true, limits, currentCount: activeUsers };
}

/**
 * max_contracts enforcement kontrolü
 * İlgili lisansın kapsamındaki ağaçta toplam sözleşme sayısı
 */
async function canCreateContract(companyId) {
  const limits = await getEffectiveLimits(companyId);
  
  if (limits.license_status === 'none') {
    return { allowed: false, reason: 'No active license for this organization' };
  }
  
  // Ağaçtaki tüm şirketlerin ID'lerini getir
  const treeIds = await companyTree.getCompanyTreeIds(companyId);
  
  // Toplam sözleşme sayısını say
  const contractsRes = await db.query(
    `SELECT COUNT(*) as count
     FROM contracts c
     WHERE c.company_id = ANY($1)
       AND c.status != 'cancelled'`,
    [treeIds]
  );
  
  const totalContracts = Number(contractsRes.rows[0].count);
  const maxContracts = Number(limits.max_contracts);
  
  if (totalContracts >= maxContracts) {
    return { 
      allowed: false, 
      reason: `Contract limit reached (${maxContracts} contracts allowed)`,
      currentCount: totalContracts,
      maxAllowed: maxContracts
    };
  }
  
  return { allowed: true, limits, currentCount: totalContracts };
}

/**
 * Lisans durumunu getirir
 * expired/cancelled durumlarını kontrol eder
 * Read her zaman OK, Write sadece aktif ve süresi dolmamış lisanslarda
 */
async function getLicenseStatus(companyId) {
  const res = await db.query(
    `SELECT cl.status, cl.expires_at, cl.plan_id,
            p.name as plan_name
     FROM company_licenses cl
     JOIN plans p ON cl.plan_id = p.id
     WHERE cl.company_id = $1
     ORDER BY cl.created_at DESC
     LIMIT 1`,
    [companyId]
  );
  
  if (res.rows.length === 0) {
    return { 
      status: 'none', 
      expires_at: null, 
      plan_id: null,
      plan_name: null,
      canRead: true, 
      canWrite: false 
    };
  }
  
  const license = res.rows[0];
  const now = new Date();
  const isExpired = license.expires_at && new Date(license.expires_at) < now;
  const isCancelled = license.status === 'cancelled';
  const isActive = license.status === 'active' && !isExpired;
  
  return {
    status: license.status,
    expires_at: license.expires_at,
    plan_id: license.plan_id,
    plan_name: license.plan_name,
    isExpired,
    isCancelled,
    canRead: true, // Read her zaman OK
    canWrite: isActive // Write sadece aktif ve süresi dolmamış lisanslarda
  };
}

/**
 * Bir şirketin lisansını getirir (custom override'lar dahil)
 */
async function getLicense(companyId) {
  const res = await db.query(
    `SELECT cl.*, p.name as plan_name, p.max_users as plan_max_users,
            p.max_contracts as plan_max_contracts, p.max_companies as plan_max_companies
     FROM company_licenses cl
     JOIN plans p ON cl.plan_id = p.id
     WHERE cl.company_id = $1
     ORDER BY cl.created_at DESC
     LIMIT 1`,
    [companyId]
  );
  
  if (res.rows.length === 0) {
    return null;
  }
  
  const license = res.rows[0];
  
  // Effective limits - COALESCE(override, plan)
  license.effective_max_users = license.max_users_override !== null 
    ? license.max_users_override 
    : license.plan_max_users;
    
  license.effective_max_contracts = license.max_contracts_override !== null 
    ? license.max_contracts_override 
    : license.plan_max_contracts;
    
  license.effective_max_companies = license.max_companies_override !== null 
    ? license.max_companies_override 
    : license.plan_max_companies;
  
  return license;
}

/**
 * Kullanıcı deaktive edildiğinde kapasite kontrolü
 * INACTIVE kullanıcı sayıma dahil edilmez
 */
async function getActiveUserCount(companyId) {
  const treeIds = await companyTree.getCompanyTreeIds(companyId);
  
  const res = await db.query(
    `SELECT COUNT(DISTINCT u.id) as count
     FROM users u
     JOIN user_companies uc ON u.id = uc.user_id
     WHERE uc.company_id = ANY($1)
       AND u.is_active = true`,
    [treeIds]
  );
  
  return Number(res.rows[0].count);
}

module.exports = {
  getEffectiveLimits,
  canCreateCompany,
  canCreateUser,
  canCreateContract,
  getLicenseStatus,
  getLicense,
  getActiveUserCount
};
