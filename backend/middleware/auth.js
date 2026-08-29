// backend/routes/auth.js
// Login, me, change-password endpoint'leri
// P1: must_change_password akışı eklendi

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../db');
const { generateToken, authenticateToken } = require('../middleware/auth');

/**
 * POST /api/auth/login
 * Login endpoint'i - must_change_password kontrolü ile
 * INACTIVE kullanıcı login olamaz
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    
    // Kullanıcıyı username veya email ile bul
    const userRes = await db.query(
      `SELECT u.id, u.username, u.email, u.first_name, u.last_name, 
              u.password_hash, u.role, u.is_active, u.must_change_password,
              uc.company_id as primary_company_id
       FROM users u
       LEFT JOIN user_companies uc ON u.id = uc.user_id AND uc.is_primary = true
       WHERE u.username = $1 OR (u.email IS NOT NULL AND LOWER(u.email) = LOWER($2))`,
      [username, username]
    );
    
    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = userRes.rows[0];
    
    // INACTIVE kullanıcı login olamaz
    if (!user.is_active) {
      return res.status(403).json({ 
        error: 'Account is inactive. Please contact your administrator.',
        code: 'ACCOUNT_INACTIVE'
      });
    }
    
    // Şifre doğrulama
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Token oluştur
    const token = generateToken({
      id: user.id,
      role: user.role,
      primaryCompanyId: user.primary_company_id
    });
    
    // Response - P0 formatına uygun
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        mustChangePassword: user.must_change_password,
        primaryCompanyId: user.primary_company_id
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * GET /api/auth/me
 * Mevcut kullanıcı bilgisi
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const userRes = await db.query(
      `SELECT u.id, u.username, u.email, u.first_name, u.last_name, 
              u.role, u.is_active, u.must_change_password,
              uc.company_id as primary_company_id
       FROM users u
       LEFT JOIN user_companies uc ON u.id = uc.user_id AND uc.is_primary = true
       WHERE u.id = $1`,
      [req.user.userId]
    );
    
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userRes.rows[0];
    
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      mustChangePassword: user.must_change_password,
      primaryCompanyId: user.primary_company_id
    });
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

/**
 * POST /api/auth/change-password
 * Şifre değiştirme endpoint'i
 * must_change_password=true olan kullanıcılar buraya yönlendirilir
 * Başarılı değişiklik sonrası must_change_password=false yapılır
 */
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.userId;
    
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: 'Old and new password required' });
    }
    
    // Yeni şifre minimum uzunluk kontrolü
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }
    
    // Mevcut şifreyi doğrula
    const userRes = await db.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );
    
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const validPassword = await bcrypt.compare(oldPassword, userRes.rows[0].password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid old password' });
    }
    
    // Yeni şifreyi hash'le ve kaydet
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    await db.query(
      `UPDATE users 
       SET password_hash = $1, must_change_password = false, updated_at = NOW()
       WHERE id = $2`,
      [hashedPassword, userId]
    );
    
    res.json({ 
      success: true, 
      message: 'Password changed successfully',
      mustChangePassword: false
    });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Password change failed' });
  }
});

/**
 * POST /api/auth/logout
 * Logout endpoint'i (opsiyonel - client-side token silme de kullanılabilir)
 */
router.post('/logout', authenticateToken, (req, res) => {
  // JWT stateless olduğu için server-side bir şey yapmaya gerek yok
  // Client token'ı silmeli
  res.json({ success: true, message: 'Logged out successfully' });
});

module.exports = router;
