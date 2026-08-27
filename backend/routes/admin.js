const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const pool = require('../db/pool');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// ============================================================
// TÜM ADMIN API'LERİ requireAuth + requireAdmin ile korunuyor
// ============================================================

// ============================================================
// 1. USER MANAGEMENT
// ============================================================

// GET /api/admin/users - Tüm kullanıcıları listele
router.get('/users', requireAuth, requireAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                u.id,
                u.username,
                u.role,
                u.status,
                u.created_at,
                u.last_login,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'company_id', c.id,
                            'company_name', c.name,
                            'company_code', c.code
                        )
                    ) FILTER (WHERE c.id IS NOT NULL),
                    '[]'
                ) as companies
            FROM users u
            LEFT JOIN user_companies uc ON u.id = uc.user_id
            LEFT JOIN companies c ON uc.company_id = c.id
            GROUP BY u.id
            ORDER BY u.created_at DESC
        `);
        
        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Admin get users error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// POST /api/admin/users - Yeni kullanıcı oluştur
router.post('/users', requireAuth, requireAdmin, async (req, res) => {
    const { username, password, role, status, company_ids } = req.body;
    
    // Validasyon
    if (!username || !password) {
        return res.status(400).json({ 
            success: false, 
            error: 'Username and password are required' 
        });
    }
    
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Username kontrolü
        const existingUser = await client.query(
            'SELECT id FROM users WHERE username = $1',
            [username]
        );
        
        if (existingUser.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ 
                success: false, 
                error: 'Username already exists' 
            });
        }
        
        // Password hash
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(password, 12);
        
        // Kullanıcı oluştur
        const insertResult = await client.query(
            `INSERT INTO users (username, password_hash, role, status)
             VALUES ($1, $2, $3, $4)
             RETURNING id, username, role, status, created_at`,
            [username, hashedPassword, role || 'VIEWER', status || 'ACTIVE']
        );
        
        const newUser = insertResult.rows[0];
        
        // Company atamaları
        if (company_ids && Array.isArray(company_ids) && company_ids.length > 0) {
            for (const companyId of company_ids) {
                await client.query(
                    `INSERT INTO user_companies (user_id, company_id)
                     VALUES ($1, $2)
                     ON CONFLICT (user_id, company_id) DO NOTHING`,
                    [newUser.id, companyId]
                );
            }
        }
        
        // Audit log
        await client.query(
            `INSERT INTO audit_events (
                action, entity_type, entity_id, user_id, old_value, new_value
            ) VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                'CREATE_USER',
                'user',
                newUser.id,
                req.user.id,
                null,
                JSON.stringify({ username, role: role || 'VIEWER', status: status || 'ACTIVE' })
            ]
        );
        
        await client.query('COMMIT');
        
        res.status(201).json({
            success: true,
            data: newUser
        });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Admin create user error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    } finally {
        client.release();
    }
});

// PATCH /api/admin/users/:id - Kullanıcı güncelle
router.patch('/users/:id', requireAuth, requireAdmin, async (req, res) => {
    const userId = req.params.id;
    const { role, status, company_ids } = req.body;
    
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Kullanıcıyı bul
        const userCheck = await client.query(
            'SELECT id, username FROM users WHERE id = $1',
            [userId]
        );
        
        if (userCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ 
                success: false, 
                error: 'User not found' 
            });
        }
        
        const oldUser = userCheck.rows[0];
        
        // Güncelleme
        let updateFields = [];
        let values = [];
        let paramCount = 1;
        
        if (role !== undefined) {
            updateFields.push(`role = $${paramCount++}`);
            values.push(role);
        }
        
        if (status !== undefined) {
            updateFields.push(`status = $${paramCount++}`);
            values.push(status);
        }
        
        if (updateFields.length > 0) {
            values.push(userId);
            await client.query(
                `UPDATE users SET ${updateFields.join(', ')} WHERE id = $${paramCount}`,
                values
            );
        }
        
        // Company atamalarını güncelle
        if (company_ids && Array.isArray(company_ids)) {
            // Mevcut atamaları sil
            await client.query(
                'DELETE FROM user_companies WHERE user_id = $1',
                [userId]
            );
            
            // Yeni atamaları ekle
            for (const companyId of company_ids) {
                await client.query(
                    `INSERT INTO user_companies (user_id, company_id)
                     VALUES ($1, $2)
                     ON CONFLICT (user_id, company_id) DO NOTHING`,
                    [userId, companyId]
                );
            }
        }
        
        // Audit log
        await client.query(
            `INSERT INTO audit_events (
                action, entity_type, entity_id, user_id, old_value, new_value
            ) VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                'UPDATE_USER',
                'user',
                userId,
                req.user.id,
                JSON.stringify(oldUser),
                JSON.stringify({ role, status, company_ids })
            ]
        );
        
        await client.query('COMMIT');
        
        res.json({
            success: true,
            message: 'User updated successfully'
        });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Admin update user error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    } finally {
        client.release();
    }
});

// ============================================================
// 2. COMPANY MANAGEMENT
// ============================================================

// GET /api/admin/companies - Tüm şirketleri listele
router.get('/companies', requireAuth, requireAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                c.id,
                c.name,
                c.code,
                c.created_at,
                c.tax_number,
                c.address,
                c.phone,
                c.email,
                COUNT(DISTINCT uc.user_id) as user_count,
                (
                    SELECT json_build_object(
                        'id', cl.id,
                        'plan_id', cl.plan_id,
                        'plan_name', p.name,
                        'status', cl.status,
                        'starts_at', cl.starts_at,
                        'expires_at', cl.expires_at,
                        'max_users', p.max_users
                    )
                    FROM company_licenses cl
                    JOIN plans p ON cl.plan_id = p.id
                    WHERE cl.company_id = c.id
                    AND cl.status = 'ACTIVE'
                    ORDER BY cl.created_at DESC
                    LIMIT 1
                ) as active_license
            FROM companies c
            LEFT JOIN user_companies uc ON c.id = uc.company_id
            LEFT JOIN users u ON uc.user_id = u.id
            GROUP BY c.id
            ORDER BY c.created_at DESC
        `);
        
        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Admin get companies error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// POST /api/admin/companies - Yeni şirket oluştur
router.post('/companies', requireAuth, requireAdmin, async (req, res) => {
    const { name, code, tax_number, address, phone, email } = req.body;
    
    if (!name || !code) {
        return res.status(400).json({ 
            success: false, 
            error: 'Name and code are required' 
        });
    }
    
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Code kontrolü
        const existingCompany = await client.query(
            'SELECT id FROM companies WHERE code = $1',
            [code]
        );
        
        if (existingCompany.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ 
                success: false, 
                error: 'Company code already exists' 
            });
        }
        
        // Şirket oluştur
        const result = await client.query(
            `INSERT INTO companies (name, code, tax_number, address, phone, email)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, name, code, tax_number, address, phone, email, created_at`,
            [name, code, tax_number || null, address || null, phone || null, email || null]
        );
        
        const newCompany = result.rows[0];
        
        // Audit log
        await client.query(
            `INSERT INTO audit_events (
                action, entity_type, entity_id, user_id, old_value, new_value
            ) VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                'CREATE_COMPANY',
                'company',
                newCompany.id,
                req.user.id,
                null,
                JSON.stringify(newCompany)
            ]
        );
        
        await client.query('COMMIT');
        
        res.status(201).json({
            success: true,
            data: newCompany
        });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Admin create company error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    } finally {
        client.release();
    }
});

// GET /api/admin/companies/:id - Şirket detayı
router.get('/companies/:id', requireAuth, requireAdmin, async (req, res) => {
    const companyId = req.params.id;
    
    try {
        // Şirket bilgisi
        const companyResult = await pool.query(
            `SELECT * FROM companies WHERE id = $1`,
            [companyId]
        );
        
        if (companyResult.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Company not found' 
            });
        }
        
        const company = companyResult.rows[0];
        
        // Kullanıcılar
        const usersResult = await pool.query(`
            SELECT u.id, u.username, u.role, u.status
            FROM users u
            JOIN user_companies uc ON u.id = uc.user_id
            WHERE uc.company_id = $1
        `, [companyId]);
        
        // Lisanslar
        const licensesResult = await pool.query(`
            SELECT 
                cl.id,
                cl.plan_id,
                p.name as plan_name,
                cl.status,
                cl.starts_at,
                cl.expires_at,
                p.max_users
            FROM company_licenses cl
            JOIN plans p ON cl.plan_id = p.id
            WHERE cl.company_id = $1
            ORDER BY cl.created_at DESC
        `, [companyId]);
        
        res.json({
            success: true,
            data: {
                ...company,
                users: usersResult.rows,
                licenses: licensesResult.rows
            }
        });
        
    } catch (error) {
        console.error('Admin get company detail error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// ============================================================
// 3. LICENSE MANAGEMENT (Mevcut admin-licenses.js kullanılıyor)
// Burada sadece tüm lisansları listeleme endpoint'i ekleniyor
// ============================================================

// GET /api/admin/licenses - Tüm lisansları listele
router.get('/licenses', requireAuth, requireAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                cl.id,
                cl.company_id,
                c.name as company_name,
                c.code as company_code,
                cl.plan_id,
                p.name as plan_name,
                p.max_users,
                cl.status,
                cl.starts_at,
                cl.expires_at,
                cl.created_at,
                COUNT(DISTINCT uc.user_id) as current_users
            FROM company_licenses cl
            JOIN companies c ON cl.company_id = c.id
            JOIN plans p ON cl.plan_id = p.id
            LEFT JOIN user_companies uc ON c.id = uc.company_id
            GROUP BY cl.id, c.id, p.id
            ORDER BY cl.created_at DESC
        `);
        
        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Admin get licenses error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// ============================================================
// 4. AUDIT LOG
// ============================================================

// GET /api/admin/audit - Audit log listele
router.get('/audit', requireAuth, requireAdmin, async (req, res) => {
    const { limit = 100, offset = 0, action, entity_type, user_id } = req.query;
    
    try {
        let query = `
            SELECT 
                ae.id,
                ae.timestamp,
                ae.action,
                ae.entity_type,
                ae.entity_id,
                ae.user_id,
                u.username as user_username,
                ae.old_value,
                ae.new_value,
                ae.success
            FROM audit_events ae
            LEFT JOIN users u ON ae.user_id = u.id
            WHERE 1=1
        `;
        
        const params = [];
        let paramCount = 1;
        
        if (action) {
            query += ` AND ae.action = $${paramCount++}`;
            params.push(action);
        }
        
        if (entity_type) {
            query += ` AND ae.entity_type = $${paramCount++}`;
            params.push(entity_type);
        }
        
        if (user_id) {
            query += ` AND ae.user_id = $${paramCount++}`;
            params.push(user_id);
        }
        
        query += ` ORDER BY ae.timestamp DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
        params.push(parseInt(limit), parseInt(offset));
        
        const result = await pool.query(query, params);
        
        // Toplam sayı
        let countQuery = `SELECT COUNT(*) FROM audit_events ae WHERE 1=1`;
        const countParams = [];
        let countParamCount = 1;
        
        if (action) {
            countQuery += ` AND ae.action = $${countParamCount++}`;
            countParams.push(action);
        }
        if (entity_type) {
            countQuery += ` AND ae.entity_type = $${countParamCount++}`;
            countParams.push(entity_type);
        }
        if (user_id) {
            countQuery += ` AND ae.user_id = $${countParamCount++}`;
            countParams.push(user_id);
        }
        
        const countResult = await pool.query(countQuery, countParams);
        
        res.json({
            success: true,
            data: result.rows,
            pagination: {
                total: parseInt(countResult.rows[0].count),
                limit: parseInt(limit),
                offset: parseInt(offset)
            }
        });
        
    } catch (error) {
        console.error('Admin get audit error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// ============================================================
// 5. DASHBOARD METRICS
// ============================================================

// GET /api/admin/dashboard - Dashboard metrikleri
router.get('/dashboard', requireAuth, requireAdmin, async (req, res) => {
    try {
        // Toplam şirket
        const companiesResult = await pool.query(
            'SELECT COUNT(*) as total FROM companies'
        );
        
        // Aktif lisans
        const licensesResult = await pool.query(
            `SELECT COUNT(*) as total FROM company_licenses 
             WHERE status = 'ACTIVE' AND expires_at > NOW()`
        );
        
        // Toplam kullanıcı
        const usersResult = await pool.query(
            'SELECT COUNT(*) as total FROM users WHERE status = \'ACTIVE\''
        );
        
        // TFRS16 kullanan şirketler
        const tfrs16Result = await pool.query(`
            SELECT COUNT(DISTINCT company_id) as total 
            FROM contracts 
            WHERE status = 'ACTIVE'
        `);
        
        // Son aktiviteler
        const recentActivity = await pool.query(`
            SELECT 
                ae.timestamp,
                ae.action,
                ae.entity_type,
                u.username as user_username,
                c.name as company_name,
                ae.success
            FROM audit_events ae
            LEFT JOIN users u ON ae.user_id = u.id
            LEFT JOIN companies c ON ae.entity_id = c.id AND ae.entity_type = 'company'
            ORDER BY ae.timestamp DESC
            LIMIT 10
        `);
        
        res.json({
            success: true,
            data: {
                companies: parseInt(companiesResult.rows[0].total),
                active_licenses: parseInt(licensesResult.rows[0].total),
                users: parseInt(usersResult.rows[0].total),
                tfrs16_customers: parseInt(tfrs16Result.rows[0].total),
                recent_activity: recentActivity.rows
            }
        });
        
    } catch (error) {
        console.error('Admin dashboard error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

module.exports = router;
