// backend/middleware/auth.js
// JWT doğrulama + organization context + must_change_password kontrolü

const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

/**
 * JWT doğrulama middleware'i
 * Kullanıcı bilgisini req.user'a ekler
 * must_change_password=true ise sadece change-password endpoint'ine izin verir
 */
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Authentication token required' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Kullanıcının güncel durumunu DB'den kontrol et
    const userRes = await db.query(
      `SELECT u.id, u.username, u.email, u.first_name, u.last_name,
              u.role, u.is_active, u.must_change_password,
              uc.company_id as primary_company_id
       FROM users u
       LEFT JOIN user_companies uc ON u.id = uc.user_id AND uc.is_primary = true
       WHERE u.id = $1`,
      [decoded.userId]
    );
    
    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    const user = userRes.rows[0];
    
    // INACTIVE kullanıcı login olamaz / erişim yapamaz
    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is inactive' });
    }
    
    // req.user'a kullanıcı bilgisini ekle
    req.user = {
      userId: user.id,
      username: user.username,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      isActive: user.is_active,
      mustChangePassword: user.must_change_password,
      primaryCompanyId: user.primary_company_id
    };
    
    // must_change_password kontrolü
    // Sadece change-password, me ve logout endpoint'lerine izin ver
    if (user.must_change_password) {
      const allowedPaths = [
        '/api/auth/change-password',
        '/api/auth/me',
        '/api/auth/logout'
      ];
      
      const currentPath = req.path;
      const isAllowed = allowedPaths.some(path => currentPath.startsWith(path));
      
      if (!isAllowed) {
        return res.status(403).json({ 
          error: 'Password change required',
          mustChangePassword: true,
          code: 'PASSWORD_CHANGE_REQUIRED'
        });
      }
    }
    
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    console.error('Auth error:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

/**
 * JWT token oluşturma
 * Gereksiz veri eklemeden minimum bilgi tutar
 * Sadece userId, role ve primaryCompanyId
 */
function generateToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      role: user.role,
      // Organization context - sadece primary company
      primaryCompanyId: user.primaryCompanyId || null
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

module.exports = {
  authenticateToken,
  generateToken,
  JWT_SECRET
};
