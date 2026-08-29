// backend/services/company-tree.js
// Şirket hiyerarşisi erişim kontrolü için servis

const db = require('../db'); // veya mevcut db bağlantısı

/**
 * Bir şirketin tüm alt şirket ID'lerini recursive olarak getirir
 * @param {number} companyId - Başlangıç şirket ID
 * @returns {Promise<number[]>} - Şirket ID'leri dizisi (kendisi dahil)
 */
async function getCompanyTreeIds(companyId) {
  const result = [];
  const toVisit = [companyId];
  
  while (toVisit.length > 0) {
    const current = toVisit.pop();
    result.push(current);
    
    const children = await db.query(
      'SELECT id FROM companies WHERE parent_company_id = $1',
      [current]
    );
    
    for (const child of children.rows) {
      toVisit.push(child.id);
    }
  }
  
  return result;
}

/**
 * Bir şirketin üst şirketlerini getirir (yukarı doğru)
 * @param {number} companyId - Başlangıç şirket ID
 * @returns {Promise<number[]>} - Üst şirket ID'leri dizisi
 */
async function getParentCompanyIds(companyId) {
  const result = [];
  let current = companyId;
  
  while (current) {
    const res = await db.query(
      'SELECT parent_company_id FROM companies WHERE id = $1',
      [current]
    );
    
    if (res.rows.length === 0 || !res.rows[0].parent_company_id) {
      break;
    }
    
    current = res.rows[0].parent_company_id;
    result.push(current);
  }
  
  return result;
}

/**
 * Kullanıcının erişebileceği şirket ID'lerini getirir
 * @param {number} userId - Kullanıcı ID
 * @param {string} role - Kullanıcı rolü
 * @param {number|null} primaryCompanyId - Kullanıcının bağlı olduğu şirket
 * @returns {Promise<number[]>} - Erişilebilir şirket ID'leri
 */
async function getAccessibleCompanyIds(userId, role, primaryCompanyId) {
  if (role === 'ADMIN') {
    // Admin tüm şirketlere erişebilir
    const res = await db.query('SELECT id FROM companies');
    return res.rows.map(r => r.id);
  }
  
  if (role === 'ACCOUNTANT_MANAGER') {
    // Kendi şirketi ve alt şirketleri
    if (primaryCompanyId) {
      return getCompanyTreeIds(primaryCompanyId);
    }
    // Eğer primary company yoksa kullanıcının bağlı olduğu şirketleri bul
    const res = await db.query(
      'SELECT company_id FROM user_companies WHERE user_id = $1',
      [userId]
    );
    const companyIds = res.rows.map(r => r.company_id);
    const allIds = new Set();
    for (const cid of companyIds) {
      const treeIds = await getCompanyTreeIds(cid);
      treeIds.forEach(id => allIds.add(id));
    }
    return [...allIds];
  }
  
  // ACCOUNTANT, CONTROLLER, VIEWER - sadece atandıkları şirketler
  const res = await db.query(
    'SELECT company_id FROM user_companies WHERE user_id = $1',
    [userId]
  );
  return res.rows.map(r => r.company_id);
}

/**
 * Kullanıcının belirli bir şirkete erişimi var mı kontrol eder
 */
async function canAccessCompany(userId, role, targetCompanyId) {
  const accessibleIds = await getAccessibleCompanyIds(userId, role, null);
  return accessibleIds.includes(Number(targetCompanyId));
}

/**
 * Bir şirketin alt şirket sayısını getirir (ana şirket dahil)
 */
async function getTotalCompanyCount(parentCompanyId) {
  const treeIds = await getCompanyTreeIds(parentCompanyId);
  return treeIds.length;
}

module.exports = {
  getCompanyTreeIds,
  getParentCompanyIds,
  getAccessibleCompanyIds,
  canAccessCompany,
  getTotalCompanyCount
};
