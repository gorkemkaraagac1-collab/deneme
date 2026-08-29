// backend/middleware/access-control.js
// Şirket ağacı erişim kontrolü ve rol bazlı yetkilendirme

const companyTree = require('../services/company-tree');

/**
 * Kullanıcının belirli bir şirkete erişimi olup olmadığını kontrol eder
 * Request'te companyId veya body'de companyId arar
 */
async function requireCompanyAccess(req, res, next) {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Admin her yere erişebilir
    if (user.role === 'ADMIN') {
      return next();
    }
    
    // Erişim kontrolü yapılacak companyId'yi bul
    const targetCompanyId = 
      req.params.companyId || 
      req.body.companyId || 
      req.query.companyId ||
      req.params.id;
    
    if (!targetCompanyId) {
      return res.status(400).json({ error: 'Company ID required' });
    }
    
    const hasAccess = await companyTree.canAccessCompany(
      user.userId,
      user.role,
      Number(targetCompanyId)
    );
    
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this company' });
    }
    
    next();
  } catch (err) {
    console.error('Access control error:', err);
    res.status(500).json({ error: 'Access control failed' });
  }
}

/**
 * ACCOUNTANT_MANAGER sadece ACCOUNTANT, CONTROLLER, VIEWER oluşturabilir
 */
function requireRoleCreationPermission(req, res, next) {
  const user = req.user;
  const targetRole = req.body.role;
  
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // Admin her şeyi yapabilir
  if (user.role === 'ADMIN') {
    return next();
  }
  
  // ACCOUNTANT_MANAGER sadece belirli rolleri oluşturabilir
  if (user.role === 'ACCOUNTANT_MANAGER') {
    const allowedRoles = ['ACCOUNTANT', 'CONTROLLER', 'VIEWER'];
    if (targetRole && !allowedRoles.includes(targetRole)) {
      return res.status(403).json({ 
        error: 'ACCOUNTANT_MANAGER can only create ACCOUNTANT, CONTROLLER, or VIEWER roles' 
      });
    }
    return next();
  }
  
  // Diğer roller kullanıcı oluşturamaz
  return res.status(403).json({ error: 'Insufficient permissions to create users' });
}

/**
 * Yazma yetkisi kontrolü
 * CONTROLLER ve VIEWER yazma işlemi yapamaz
 */
function requireWritePermission(req, res, next) {
  const user = req.user;
  
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const writeRoles = ['ADMIN', 'ACCOUNTANT_MANAGER', 'ACCOUNTANT'];
  if (!writeRoles.includes(user.role)) {
    return res.status(403).json({ error: 'Read-only role cannot perform write operations' });
  }
  
  next();
}

/**
 * Parent company erişim kontrolü
 * ACCOUNTANT_MANAGER başka holdingin şirketini parent gösteremez
 */
async function requireParentCompanyAccess(req, res, next) {
  try {
    const user = req.user;
    const parentCompanyId = req.body.parent_company_id;
    
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Admin her şeyi yapabilir
    if (user.role === 'ADMIN') {
      return next();
    }
    
    // Parent company belirtilmemişse sorun yok (NULL = ana şirket)
    if (!parentCompanyId) {
      return next();
    }
    
    // ACCOUNTANT_MANAGER kendi ağacındaki şirketleri parent gösterebilir
    const hasAccess = await companyTree.canAccessCompany(
      user.userId,
      user.role,
      Number(parentCompanyId)
    );
    
    if (!hasAccess) {
      return res.status(403).json({ 
        error: 'Cannot set parent company outside your organization tree' 
      });
    }
    
    next();
  } catch (err) {
    console.error('Parent company access error:', err);
    res.status(500).json({ error: 'Access control failed' });
  }
}

module.exports = {
  requireCompanyAccess,
  requireRoleCreationPermission,
  requireWritePermission,
  requireParentCompanyAccess
};
