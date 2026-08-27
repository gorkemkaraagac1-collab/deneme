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

// ============================================================
// PATCH /api/admin/users/:id - Kullanıcı güncelle (GÜVENLİK SERTLEŞTİRİLMİŞ)
// ============================================================
router.patch('/users/:id', requireAuth, requireAdmin, async (req, res) => {
    const userId = req.params.id;
    const { role, status, company_ids } = req.body;
    const requestingUserId = req.user.id;

    // --- 1. TEMEL VALİDASYONLAR ---
    // Eğer role gönderilmişse, geçerli bir değer mi?
    if (role !== undefined && !['ADMIN', 'VIEWER'].includes(role)) {
        return res.status(400).json({ success: false, error: 'Invalid role' });
    }
    // Eğer status gönderilmişse, geçerli bir değer mi?
    if (status !== undefined && !['ACTIVE', 'INACTIVE'].includes(status)) {
        return res.status(400).json({ success: false, error: 'Invalid status' });
    }
    // company_ids gönderilmişse, tipi array mi?
    if (company_ids !== undefined && !Array.isArray(company_ids)) {
        return res.status(400).json({ success: false, error: 'company_ids must be an array' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // --- 2. KULLANICI VARLIĞI KONTROLÜ ---
        // Eski bilgileri audit log için al
        const userResult = await client.query(
            `SELECT id, username, role, status FROM users WHERE id = $1`,
            [userId]
        );
        if (userResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ 
                success: false, 
                error: 'User not found' 
            });
        }
        const currentUser = userResult.rows[0];

        // --- 3. COMPANY_IDS VALİDASYONU ---
        // Eğer company_ids gönderildiyse, tüm ID'ler geçerli mi?
        if (company_ids !== undefined && company_ids.length > 0) {
            // Benzersiz ID'leri al (SQL injection önlemek için parametreli sorgu)
            const placeholders = company_ids.map((_, i) => `$${i + 2}`).join(',');
            const companyCheckQuery = `
                SELECT COUNT(*) as count FROM companies WHERE id IN (${placeholders})
            `;
            const companyCheckResult = await client.query(companyCheckQuery, [userId, ...company_ids]);
            
            // Eğer bulunan company sayısı, gönderilen ID sayısından azsa geçersiz ID var demektir.
            if (parseInt(companyCheckResult.rows[0].count) !== company_ids.length) {
                await client.query('ROLLBACK');
                return res.status(400).json({ success: false, error: 'One or more company IDs are invalid' });
            }
        }

        // --- 4. ADMIN KENDİNİ KORUMA KURALLARI ---
        // Eğer kullanıcı kendi hesabını güncelliyorsa...
        if (userId === requestingUserId) {
            // ... kendini INACTIVE yapmaya çalışıyorsa engelle.
            if (status === 'INACTIVE') {
                await client.query('ROLLBACK');
                return res.status(403).json({ 
                    success: false, 
                    error: 'You cannot deactivate your own administrator account.' 
                });
            }
            // ... kendini VIEWER yapmaya çalışıyorsa engelle.
            if (role === 'VIEWER') {
                await client.query('ROLLBACK');
                return res.status(403).json({ 
                    success: false, 
                    error: 'You cannot demote your own administrator account.' 
                });
            }
        }

        // --- 5. SON AKTİF ADMIN KORUMASI ---
        // Eğer hedef kullanıcı bir ADMIN ise ve yapılan değişiklik onu ADMIN olmaktan çıkarıyorsa...
        if (currentUser.role === 'ADMIN' && (role === 'VIEWER' || status === 'INACTIVE')) {
            // Mevcut aktif admin sayısını kontrol et (hedef kullanıcı hariç)
            const activeAdminQuery = `
                SELECT COUNT(*) as count FROM users 
                WHERE role = 'ADMIN' AND status = 'ACTIVE' AND id != $1
            `;
            const activeAdminResult = await client.query(activeAdminQuery, [userId]);
            const otherActiveAdmins = parseInt(activeAdminResult.rows[0].count);

            // Eğer bu işlem sonucunda sistemde başka aktif admin kalmayacaksa...
            if (otherActiveAdmins === 0) {
                await client.query('ROLLBACK');
                return res.status(403).json({ 
                    success: false, 
                    error: 'Cannot perform this operation. At least one active ADMIN user must remain.' 
                });
            }
        }

        // --- 6. VERİTABANI GÜNCELLEMELERİ ---
        // Users tablosunu güncelle
        let updateUserQuery = 'UPDATE users SET ';
        const updateFields = [];
        const queryParams = [];
        let paramCount = 1;

        if (role !== undefined) {
            updateFields.push(`role = $${paramCount++}`);
            queryParams.push(role);
        }
        if (status !== undefined) {
            updateFields.push(`status = $${paramCount++}`);
            queryParams.push(status);
        }

        // Eğer güncellenecek alan varsa...
        if (updateFields.length > 0) {
            updateUserQuery += updateFields.join(', ') + ` WHERE id = $${paramCount}`;
            queryParams.push(userId);
            await client.query(updateUserQuery, queryParams);
        }

        // company_ids güncellemesi (eğer gönderildiyse)
        if (company_ids !== undefined) {
            // Mevcut atamaları sil
            await client.query(
                'DELETE FROM user_companies WHERE user_id = $1',
                [userId]
            );
            // Yeni atamaları ekle (eğer boş değilse)
            for (const companyId of company_ids) {
                await client.query(
                    `INSERT INTO user_companies (user_id, company_id) VALUES ($1, $2)`,
                    [userId, companyId]
                );
            }
        }

        // --- 7. AUDIT LOG OLUŞTUR ---
        await client.query(
            `INSERT INTO audit_events (
                action, entity_type, entity_id, user_id, old_value, new_value
            ) VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                'UPDATE_USER',
                'user',
                userId,
                req.user.id,
                // Eski değerleri detaylandır
                JSON.stringify({ 
                    id: currentUser.id, 
                    username: currentUser.username, 
                    role: currentUser.role, 
                    status: currentUser.status 
                }),
                // Yeni değerleri detaylandır
                JSON.stringify({ 
                    role: role !== undefined ? role : currentUser.role, 
                    status: status !== undefined ? status : currentUser.status,
                    company_ids: company_ids !== undefined ? company_ids : 'unchanged'
                })
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
        // Hassas bilgileri dışa vurma, genel hata mesajı gönder
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
// 4. AUDIT LOG (CONTEXT-BASED COMPANY ÇÖZÜMÜ İLE GÜNCELLENDİ)
// ============================================================

// GET /api/admin/audit - Audit log listele (Context-Based Company)
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
                -- Context-based company resolution
                -- entity_type = 'company' ise doğrudan company
                -- entity_type = 'license' ise license üzerinden company
                -- Diğer durumlarda NULL (frontend'de N/A gösterilecek)
                CASE 
                    WHEN ae.entity_type = 'company' THEN c_entity.name
                    WHEN ae.entity_type = 'license' THEN c_license.name
                    ELSE NULL
                END AS company_name,
                CASE 
                    WHEN ae.entity_type = 'company' THEN c_entity.code
                    WHEN ae.entity_type = 'license' THEN c_license.code
                    ELSE NULL
                END AS company_code,
                ae.old_value,
                ae.new_value,
                ae.success
            FROM audit_events ae
            LEFT JOIN users u ON ae.user_id = u.id
            -- Entity_type = 'company' ise doğrudan company'ye JOIN
            LEFT JOIN companies c_entity ON ae.entity_id = c_entity.id AND ae.entity_type = 'company'
            -- Entity_type = 'license' ise license üzerinden company'ye JOIN
            LEFT JOIN company_licenses cl ON ae.entity_id = cl.id AND ae.entity_type = 'license'
            LEFT JOIN companies c_license ON cl.company_id = c_license.id
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
        
        // GROUP BY yok - her event tek bir satırda gelir
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
