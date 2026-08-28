const express = require('express');
const router = express.Router();
const crypto = require('crypto');

const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');
const { createRateLimiter } = require('../middleware/rate-limit');
const { canAddUserToCompany } = require('../services/license-service');

// ============================================================
// ADMIN ROUTES
// ============================================================
// Tüm admin API'leri:
// Authentication -> Authorization -> ADMIN role (platform-level)
// ============================================================

// Mutation rate limiter — reuse existing architecture (no new library)
const adminMutationRateLimiter = createRateLimiter({
    windowMs: Number(process.env.ADMIN_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: Number(process.env.ADMIN_RATE_LIMIT_MAX) || 60,
    keyGenerator: req => `admin-mutation:${req.ip}:${(req.user && req.user.id) || 'anon'}`,
    message: 'Çok fazla admin işlem isteği. Lütfen daha sonra tekrar deneyin.'
});

/**
 * Generate a unique string ID compatible with VARCHAR(50) schema.
 * Used because users/companies tables require an explicit id (no DEFAULT/SERIAL).
 */
function generateEntityId(prefix) {
    const suffix = crypto.randomBytes(8).toString('hex');
    return `${prefix}-${Date.now()}-${suffix}`.slice(0, 50);
}

/**
 * Reject unknown body keys for mass-assignment protection.
 * Returns null if OK, or error message string if unknown keys present.
 */
function rejectUnknownFields(body, allowedKeys) {
    if (!body || typeof body !== 'object') return null;
    const unknown = Object.keys(body).filter(k => !allowedKeys.includes(k));
    if (unknown.length > 0) {
        return `Unknown field(s): ${unknown.join(', ')}`;
    }
    return null;
}


// ============================================================
// 1. USER MANAGEMENT
// ============================================================

// GET /api/admin/users
// DÜZELTME: arama ve sayfalama yoktu — müşteri/kullanıcı sayısı arttıkça
// bu sayfa tek, sonsuz uzayan bir tabloya dönüşüyordu. ?search= (username
// üzerinde, case-insensitive, kısmi eşleşme) ve ?limit=/?offset= eklendi.
// Geriye dönük uyumluluk için parametreler opsiyoneldir; hiçbiri
// verilmezse önceki davranışla aynı şekilde (limit=50) tüm liste döner.
router.get('/users', requireAuth, requireAdmin, async (req, res) => {
    const { search, limit = 50, offset = 0 } = req.query;

    const parsedLimit = Number.parseInt(limit, 10);
    const parsedOffset = Number.parseInt(offset, 10);

    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 500) {
        return res.status(400).json({
            success: false,
            error: 'Invalid pagination parameters. limit must be between 1 and 500.'
        });
    }

    if (!Number.isInteger(parsedOffset) || parsedOffset < 0) {
        return res.status(400).json({
            success: false,
            error: 'Invalid pagination parameters. offset must be 0 or greater.'
        });
    }

    const searchTerm = typeof search === 'string' ? search.trim() : '';

    try {
        const whereClause = searchTerm
            ? `WHERE u.username ILIKE $3`
            : '';

        const params = searchTerm
            ? [parsedLimit, parsedOffset, `%${searchTerm}%`]
            : [parsedLimit, parsedOffset];

        const result = await pool.query(`
            SELECT
                u.id,
                u.username,
                u.role,
                u.status,
                u.created_at,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'company_id', c.id,
                            'company_name', c.name,
                            'company_code', c.code
                        )
                    ) FILTER (WHERE c.id IS NOT NULL),
                    '[]'::json
                ) AS companies
            FROM users u
            LEFT JOIN user_companies uc
                ON u.id = uc.user_id
            LEFT JOIN companies c
                ON uc.company_id = c.id
            ${whereClause}
            GROUP BY u.id
            ORDER BY u.created_at DESC
            LIMIT $1 OFFSET $2
        `, params);

        const countResult = await pool.query(
            searchTerm
                ? `SELECT COUNT(*) AS count FROM users u WHERE u.username ILIKE $1`
                : `SELECT COUNT(*) AS count FROM users u`,
            searchTerm ? [`%${searchTerm}%`] : []
        );

        return res.json({
            success: true,
            data: result.rows,
            pagination: {
                total: Number.parseInt(countResult.rows[0].count, 10),
                limit: parsedLimit,
                offset: parsedOffset
            }
        });

    } catch (error) {
        console.error('Admin get users error:', error);

        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});


// ============================================================
// POST /api/admin/users
// ============================================================

router.post('/users', requireAuth, requireAdmin, adminMutationRateLimiter, async (req, res) => {
    const unknownErr = rejectUnknownFields(req.body, [
        'username', 'password', 'role', 'status', 'company_ids'
    ]);
    if (unknownErr) {
        return res.status(400).json({
            success: false,
            error: unknownErr
        });
    }

    const {
        username: rawUsername,
        password,
        role,
        status,
        company_ids
    } = req.body;

    const username = typeof rawUsername === 'string' ? rawUsername.trim() : '';

    if (!username || username.length < 3 || username.length > 50) {
        return res.status(400).json({
            success: false,
            error: 'Username is required and must be 3-50 characters'
        });
    }

    if (!password || typeof password !== 'string') {
        return res.status(400).json({
            success: false,
            error: 'Password is required'
        });
    }

    // Reject whitespace-only passwords (e.g. "          ") without
    // trimming the actual password value used below for hashing.
    if (password.trim().length === 0) {
        return res.status(400).json({
            success: false,
            error: 'Password cannot be empty or whitespace only'
        });
    }

    // Align with /api/auth/register password policy
    if (password.length < 10) {
        return res.status(400).json({
            success: false,
            error: 'Password must be at least 10 characters'
        });
    }

    if (password.length > 128) {
        return res.status(400).json({
            success: false,
            error: 'Password is too long'
        });
    }

    if (role !== undefined && !['ADMIN', 'VIEWER'].includes(role)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid role'
        });
    }

    if (status !== undefined && !['ACTIVE', 'INACTIVE'].includes(status)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid status'
        });
    }

    if (company_ids !== undefined && !Array.isArray(company_ids)) {
        return res.status(400).json({
            success: false,
            error: 'company_ids must be an array'
        });
    }

    const bcrypt = require('bcryptjs');
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const existingUser = await client.query(
            `SELECT id
             FROM users
             WHERE username = $1`,
            [username]
        );

        if (existingUser.rows.length > 0) {
            await client.query('ROLLBACK');

            return res.status(409).json({
                success: false,
                error: 'Username already exists'
            });
        }

        const uniqueCompanyIds = company_ids
            ? [...new Set(company_ids.map(String))]
            : [];

        // Validate company IDs before creating user.
        if (uniqueCompanyIds.length > 0) {
            const placeholders = uniqueCompanyIds
                .map((_, index) => `$${index + 1}`)
                .join(',');

            const companyCheck = await client.query(
                `SELECT id
                 FROM companies
                 WHERE id IN (${placeholders})`,
                uniqueCompanyIds
            );

            const validIds = new Set(
                companyCheck.rows.map(row => String(row.id))
            );

            const invalidIds = uniqueCompanyIds.filter(
                id => !validIds.has(String(id))
            );

            if (invalidIds.length > 0) {
                await client.query('ROLLBACK');

                return res.status(400).json({
                    success: false,
                    error: 'One or more company IDs are invalid'
                });
            }

            // --------------------------------------------------
            // DÜZELTME: Plan max_users limiti daha önce burada HİÇ
            // kontrol edilmiyordu — bu endpoint'ten bir şirkete
            // lisans planının izin verdiğinden fazla kullanıcı
            // eklenebiliyordu (bu kontrol yalnızca auth.js'deki
            // self-service /register akışında vardı). Aynı kontrolü
            // (canAddUserToCompany) burada da uyguluyoruz.
            // --------------------------------------------------
            for (const companyId of uniqueCompanyIds) {
                const capacity = await canAddUserToCompany(companyId, client);

                if (!capacity.allowed) {
                    await client.query('ROLLBACK');

                    return res.status(403).json({
                        success: false,
                        error: capacity.message,
                        code: capacity.reason,
                        companyId
                    });
                }
            }
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const userRole = role || 'VIEWER';
        const userStatus = status || 'ACTIVE';
        const newUserId = generateEntityId('USER');

        const insertResult = await client.query(
            `INSERT INTO users (
                id,
                username,
                password_hash,
                role,
                status
            )
            VALUES ($1, $2, $3, $4, $5)
            RETURNING
                id,
                username,
                role,
                status,
                created_at`,
            [
                newUserId,
                username,
                hashedPassword,
                userRole,
                userStatus
            ]
        );

        const newUser = insertResult.rows[0];

        for (const companyId of uniqueCompanyIds) {
            await client.query(
                `INSERT INTO user_companies (
                    user_id,
                    company_id
                )
                VALUES ($1, $2)
                ON CONFLICT (user_id, company_id)
                DO NOTHING`,
                [
                    newUser.id,
                    companyId
                ]
            );
        }

        await client.query(
            `INSERT INTO audit_events (
                id,
                actor,
                action,
                entity_type,
                entity_id,
                old_value,
                new_value
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                generateEntityId('AUD'),
                String(req.user.id),
                'CREATE_USER',
                'user',
                newUser.id,
                null,
                JSON.stringify({
                    username,
                    role: userRole,
                    status: userStatus,
                    company_ids: uniqueCompanyIds
                })
            ]
        );

        await client.query('COMMIT');

        return res.status(201).json({
            success: true,
            data: newUser
        });

    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch (rollbackError) {
            console.error(
                'Admin create user rollback error:',
                rollbackError
            );
        }

        // Unique constraint race (username) — prefer 409 over 500
        if (error && error.code === '23505') {
            return res.status(409).json({
                success: false,
                error: 'Username already exists'
            });
        }

        console.error(
            'Admin create user error:',
            error
        );

        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });

    } finally {
        client.release();
    }
});


// ============================================================
// PATCH /api/admin/users/:id
// ============================================================

router.patch('/users/:id', requireAuth, requireAdmin, adminMutationRateLimiter, async (req, res) => {
    const userId = String(req.params.id || '').trim();
    const requestingUserId = String(req.user.id);

    if (!userId || userId.length > 50) {
        return res.status(400).json({
            success: false,
            error: 'Invalid user ID'
        });
    }

    const unknownErr = rejectUnknownFields(req.body, [
        'role', 'status', 'company_ids'
    ]);
    if (unknownErr) {
        return res.status(400).json({
            success: false,
            error: unknownErr
        });
    }

    const {
        role,
        status,
        company_ids
    } = req.body;

    // --------------------------------------------------------
    // Validation
    // --------------------------------------------------------

    if (
        role !== undefined &&
        !['ADMIN', 'VIEWER'].includes(role)
    ) {
        return res.status(400).json({
            success: false,
            error: 'Invalid role'
        });
    }

    if (
        status !== undefined &&
        !['ACTIVE', 'INACTIVE'].includes(status)
    ) {
        return res.status(400).json({
            success: false,
            error: 'Invalid status'
        });
    }

    if (
        company_ids !== undefined &&
        !Array.isArray(company_ids)
    ) {
        return res.status(400).json({
            success: false,
            error: 'company_ids must be an array'
        });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // ----------------------------------------------------
        // Get current user
        // ----------------------------------------------------

        const userResult = await client.query(
            `SELECT
                id,
                username,
                role,
                status
             FROM users
             WHERE id = $1
             FOR UPDATE`,
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

        // ----------------------------------------------------
        // Current companies
        // ----------------------------------------------------

        const currentCompaniesResult = await client.query(
            `SELECT company_id
             FROM user_companies
             WHERE user_id = $1`,
            [userId]
        );

        const currentCompanyIds =
            currentCompaniesResult.rows.map(
                row => String(row.company_id)
            );

        // ----------------------------------------------------
        // Normalize requested companies
        // ----------------------------------------------------

        let uniqueCompanyIds = [];

        if (company_ids !== undefined) {
            uniqueCompanyIds = [
                ...new Set(
                    company_ids.map(String)
                )
            ];

            if (uniqueCompanyIds.length > 0) {
                const placeholders = uniqueCompanyIds
                    .map((_, index) => `$${index + 1}`)
                    .join(',');

                const companyCheckResult =
                    await client.query(
                        `SELECT id
                         FROM companies
                         WHERE id IN (${placeholders})`,
                        uniqueCompanyIds
                    );

                const validIds = new Set(
                    companyCheckResult.rows.map(
                        row => String(row.id)
                    )
                );

                const invalidIds =
                    uniqueCompanyIds.filter(
                        id => !validIds.has(String(id))
                    );

                if (invalidIds.length > 0) {
                    await client.query('ROLLBACK');

                    return res.status(400).json({
                        success: false,
                        error: 'One or more company IDs are invalid'
                    });
                }
            }

            // ------------------------------------------------
            // DÜZELTME: Kullanıcıyı YENİ bir şirkete eklerken de
            // plan max_users limiti kontrol edilmeliydi. Zaten
            // bağlı olduğu şirketler için tekrar kontrol
            // gerekmiyor (o kullanıcı zaten sayılıyor) — yalnızca
            // company_ids içinde YENİ eklenen id'ler kontrol edilir.
            // ------------------------------------------------
            const newlyAddedCompanyIds = uniqueCompanyIds.filter(
                id => !currentCompanyIds.includes(id)
            );

            for (const companyId of newlyAddedCompanyIds) {
                const capacity = await canAddUserToCompany(companyId, client);

                if (!capacity.allowed) {
                    await client.query('ROLLBACK');

                    return res.status(403).json({
                        success: false,
                        error: capacity.message,
                        code: capacity.reason,
                        companyId
                    });
                }
            }
        }

        // ----------------------------------------------------
        // Prevent admin self-lockout
        // ----------------------------------------------------

        if (userId === requestingUserId) {

            if (status === 'INACTIVE') {
                await client.query('ROLLBACK');

                return res.status(403).json({
                    success: false,
                    error:
                        'You cannot deactivate your own administrator account.'
                });
            }

            if (role === 'VIEWER') {
                await client.query('ROLLBACK');

                return res.status(403).json({
                    success: false,
                    error:
                        'You cannot demote your own administrator account.'
                });
            }
        }

        // ----------------------------------------------------
        // Prevent removal of last active ADMIN
        // ----------------------------------------------------

        const adminWillLoseAdminRights =
            currentUser.role === 'ADMIN' &&
            (
                role === 'VIEWER' ||
                status === 'INACTIVE'
            );

        if (adminWillLoseAdminRights) {

            const activeAdminResult =
                await client.query(
                    `SELECT COUNT(*) AS count
                     FROM users
                     WHERE role = 'ADMIN'
                       AND status = 'ACTIVE'
                       AND id != $1`,
                    [userId]
                );

            const otherActiveAdmins =
                parseInt(
                    activeAdminResult.rows[0].count,
                    10
                );

            if (otherActiveAdmins === 0) {
                await client.query('ROLLBACK');

                return res.status(403).json({
                    success: false,
                    error:
                        'Cannot perform this operation. At least one active ADMIN user must remain.'
                });
            }
        }

        // ----------------------------------------------------
        // Update user
        // ----------------------------------------------------

        const updateFields = [];
        const updateParams = [];
        let paramIndex = 1;

        if (role !== undefined) {
            updateFields.push(
                `role = $${paramIndex++}`
            );

            updateParams.push(role);
        }

        if (status !== undefined) {
            updateFields.push(
                `status = $${paramIndex++}`
            );

            updateParams.push(status);
        }

        if (updateFields.length > 0) {
            updateParams.push(userId);

            await client.query(
                `UPDATE users
                 SET ${updateFields.join(', ')}
                 WHERE id = $${paramIndex}`,
                updateParams
            );
        }

        // ----------------------------------------------------
        // Update company assignments
        // ----------------------------------------------------

        if (company_ids !== undefined) {

            await client.query(
                `DELETE FROM user_companies
                 WHERE user_id = $1`,
                [userId]
            );

            for (const companyId of uniqueCompanyIds) {
                await client.query(
                    `INSERT INTO user_companies (
                        user_id,
                        company_id
                    )
                    VALUES ($1, $2)
                    ON CONFLICT (user_id, company_id)
                    DO NOTHING`,
                    [
                        userId,
                        companyId
                    ]
                );
            }
        }

        // ----------------------------------------------------
        // Audit
        // ----------------------------------------------------

        const oldValue = {
            id: currentUser.id,
            username: currentUser.username,
            role: currentUser.role,
            status: currentUser.status,
            company_ids: currentCompanyIds
        };

        const newValue = {
            role:
                role !== undefined
                    ? role
                    : currentUser.role,

            status:
                status !== undefined
                    ? status
                    : currentUser.status,

            company_ids:
                company_ids !== undefined
                    ? uniqueCompanyIds
                    : currentCompanyIds
        };

        await client.query(
            `INSERT INTO audit_events (
                id,
                actor,
                action,
                entity_type,
                entity_id,
                old_value,
                new_value
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                generateEntityId('AUD'),
                String(req.user.id),
                'UPDATE_USER',
                'user',
                userId,
                JSON.stringify(oldValue),
                JSON.stringify(newValue)
            ]
        );

        await client.query('COMMIT');

        return res.json({
            success: true,
            message: 'User updated successfully'
        });

    } catch (error) {

        try {
            await client.query('ROLLBACK');
        } catch (rollbackError) {
            console.error(
                'Admin update user rollback error:',
                rollbackError
            );
        }

        console.error(
            'Admin update user error:',
            error
        );

        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });

    } finally {
        client.release();
    }
});


// ============================================================
// PATCH /api/admin/users/:id/password
// ============================================================
// DÜZELTME: Ne admin panelinde ne de müşteri tarafında şifre
// sıfırlama imkanı yoktu — bir kullanıcı şifresini unuttuğunda tek
// yol o kullanıcıyı silip (silme de zaten yok) yeniden oluşturmaktı.
// Platform-level ADMIN'in herhangi bir kullanıcının şifresini
// doğrudan sıfırlayabilmesi için eklendi. Şifre hash'i audit_events'e
// asla yazılmaz — yalnızca işlemin kendisi ve hedef kullanıcı adı
// loglanır.
router.patch('/users/:id/password', requireAuth, requireAdmin, adminMutationRateLimiter, async (req, res) => {
    const bcrypt = require('bcryptjs');
    const userId = String(req.params.id || '').trim();

    if (!userId || userId.length > 50) {
        return res.status(400).json({
            success: false,
            error: 'Invalid user ID'
        });
    }

    const unknownErr = rejectUnknownFields(req.body, ['new_password']);
    if (unknownErr) {
        return res.status(400).json({
            success: false,
            error: unknownErr
        });
    }

    const { new_password: newPassword } = req.body;

    if (!newPassword || typeof newPassword !== 'string') {
        return res.status(400).json({
            success: false,
            error: 'new_password is required'
        });
    }

    if (newPassword.trim().length === 0) {
        return res.status(400).json({
            success: false,
            error: 'Password cannot be empty or whitespace only'
        });
    }

    // POST /users ile aynı politika (auth.js /register ile de hizalı)
    if (newPassword.length < 10) {
        return res.status(400).json({
            success: false,
            error: 'Password must be at least 10 characters'
        });
    }

    if (newPassword.length > 128) {
        return res.status(400).json({
            success: false,
            error: 'Password is too long'
        });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const userResult = await client.query(
            `SELECT id, username FROM users WHERE id = $1 FOR UPDATE`,
            [userId]
        );

        if (userResult.rows.length === 0) {
            await client.query('ROLLBACK');

            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        const targetUser = userResult.rows[0];
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        await client.query(
            `UPDATE users
             SET password_hash = $1
             WHERE id = $2`,
            [hashedPassword, userId]
        );

        await client.query(
            `INSERT INTO audit_events (
                id,
                actor,
                action,
                entity_type,
                entity_id,
                old_value,
                new_value
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                generateEntityId('AUD'),
                String(req.user.id),
                'RESET_PASSWORD',
                'user',
                userId,
                null,
                JSON.stringify({ username: targetUser.username })
            ]
        );

        await client.query('COMMIT');

        return res.json({
            success: true,
            message: 'Password reset successfully'
        });

    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch (rollbackError) {
            console.error(
                'Admin reset password rollback error:',
                rollbackError
            );
        }

        console.error(
            'Admin reset password error:',
            error
        );

        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });

    } finally {
        client.release();
    }
});


// ============================================================
// 2. COMPANY MANAGEMENT
// ============================================================

// GET /api/admin/companies
// DÜZELTME: arama ve sayfalama yoktu (bkz. GET /users için aynı not).
// ?search= şirket adı VEYA kodu üzerinde eşleşir. Ayrıca dashboard'daki
// "TFRS16 Customers" kutusunun drill-down eksikliğini gidermek için her
// satıra aktif TFRS16 kontrat sayısı eklendi (tam detay için bkz.
// GET /companies/:id ve GET /tfrs16/customers).
router.get('/companies', requireAuth, requireAdmin, async (req, res) => {
    const { search, limit = 50, offset = 0 } = req.query;

    const parsedLimit = Number.parseInt(limit, 10);
    const parsedOffset = Number.parseInt(offset, 10);

    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 500) {
        return res.status(400).json({
            success: false,
            error: 'Invalid pagination parameters. limit must be between 1 and 500.'
        });
    }

    if (!Number.isInteger(parsedOffset) || parsedOffset < 0) {
        return res.status(400).json({
            success: false,
            error: 'Invalid pagination parameters. offset must be 0 or greater.'
        });
    }

    const searchTerm = typeof search === 'string' ? search.trim() : '';

    try {

        const whereClause = searchTerm
            ? `WHERE c.name ILIKE $3 OR c.code ILIKE $3`
            : '';

        const params = searchTerm
            ? [parsedLimit, parsedOffset, `%${searchTerm}%`]
            : [parsedLimit, parsedOffset];

        const result = await pool.query(`
            SELECT
                c.id,
                c.name,
                c.code,
                c.status,
                c.created_at,

                COUNT(DISTINCT uc.user_id) AS user_count,

                (
                    SELECT COUNT(*)
                    FROM contracts ct
                    WHERE ct.company_id = c.id
                      AND ct.status = 'active'
                ) AS tfrs16_active_contracts,

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
                    JOIN plans p
                        ON cl.plan_id = p.id
                    WHERE cl.company_id = c.id
                      AND cl.status = 'active'
                    ORDER BY cl.created_at DESC
                    LIMIT 1
                ) AS active_license

            FROM companies c

            LEFT JOIN user_companies uc
                ON c.id = uc.company_id

            ${whereClause}

            GROUP BY c.id

            ORDER BY c.created_at DESC
            LIMIT $1 OFFSET $2
        `, params);

        const countResult = await pool.query(
            searchTerm
                ? `SELECT COUNT(*) AS count FROM companies c WHERE c.name ILIKE $1 OR c.code ILIKE $1`
                : `SELECT COUNT(*) AS count FROM companies c`,
            searchTerm ? [`%${searchTerm}%`] : []
        );

        return res.json({
            success: true,
            data: result.rows,
            pagination: {
                total: Number.parseInt(countResult.rows[0].count, 10),
                limit: parsedLimit,
                offset: parsedOffset
            }
        });

    } catch (error) {

        console.error(
            'Admin get companies error:',
            error
        );

        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});


// ============================================================
// POST /api/admin/companies
// ============================================================

router.post('/companies', requireAuth, requireAdmin, adminMutationRateLimiter, async (req, res) => {

    const unknownErr = rejectUnknownFields(req.body, [
        'name', 'code', 'tax_number', 'address', 'phone', 'email'
    ]);
    if (unknownErr) {
        return res.status(400).json({
            success: false,
            error: unknownErr
        });
    }

    const {
        name: rawName,
        code: rawCode,
        tax_number,
        address,
        phone,
        email
    } = req.body;

    const name = typeof rawName === 'string' ? rawName.trim() : '';
    const code = typeof rawCode === 'string' ? rawCode.trim() : '';

    if (!name || name.length < 1 || name.length > 150) {
        return res.status(400).json({
            success: false,
            error: 'Name is required and must be 1-150 characters'
        });
    }

    if (!code || code.length < 1 || code.length > 50) {
        return res.status(400).json({
            success: false,
            error: 'Code is required and must be 1-50 characters'
        });
    }

    // Optional field length / basic format guards
    if (tax_number !== undefined && tax_number !== null) {
        if (typeof tax_number !== 'string' || tax_number.length > 50) {
            return res.status(400).json({
                success: false,
                error: 'Invalid tax_number'
            });
        }
    }
    if (email !== undefined && email !== null && email !== '') {
        if (typeof email !== 'string' || email.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid email format'
            });
        }
    }
    if (phone !== undefined && phone !== null) {
        if (typeof phone !== 'string' || phone.length > 50) {
            return res.status(400).json({
                success: false,
                error: 'Invalid phone'
            });
        }
    }
    if (address !== undefined && address !== null) {
        if (typeof address !== 'string' || address.length > 500) {
            return res.status(400).json({
                success: false,
                error: 'Invalid address'
            });
        }
    }

    const client = await pool.connect();

    try {

        await client.query('BEGIN');

        const existingCompany =
            await client.query(
                `SELECT id
                 FROM companies
                 WHERE code = $1`,
                [code]
            );

        if (existingCompany.rows.length > 0) {

            await client.query('ROLLBACK');

            return res.status(409).json({
                success: false,
                error: 'Company code already exists'
            });
        }

        const newCompanyId = generateEntityId('COMP');

        // init.sql companies columns: id, name, code, created_at only.
        // Extended body fields validated above for API forward-compat;
        // not persisted until schema migration exists.
        const result = await client.query(
            `INSERT INTO companies (
                id,
                name,
                code
            )
            VALUES ($1, $2, $3)
            RETURNING
                id,
                name,
                code,
                created_at`,
            [
                newCompanyId,
                name,
                code
            ]
        );

        const newCompany = result.rows[0];

        await client.query(
            `INSERT INTO audit_events (
                id,
                actor,
                action,
                entity_type,
                entity_id,
                old_value,
                new_value
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                generateEntityId('AUD'),
                String(req.user.id),
                'CREATE_COMPANY',
                'company',
                newCompany.id,
                null,
                JSON.stringify(newCompany)
            ]
        );

        await client.query('COMMIT');

        return res.status(201).json({
            success: true,
            data: newCompany
        });

    } catch (error) {

        try {
            await client.query('ROLLBACK');
        } catch (rollbackError) {
            console.error(
                'Admin create company rollback error:',
                rollbackError
            );
        }

        // Unique constraint race on code (if DB has UNIQUE) or other
        if (error && error.code === '23505') {
            return res.status(409).json({
                success: false,
                error: 'Company code already exists'
            });
        }

        console.error(
            'Admin create company error:',
            error
        );

        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });

    } finally {
        client.release();
    }
});


// ============================================================
// GET /api/admin/companies/:id
// ============================================================

router.get('/companies/:id', requireAuth, requireAdmin, async (req, res) => {

    const companyId = String(req.params.id || '').trim();

    if (!companyId || companyId.length > 50) {
        return res.status(400).json({
            success: false,
            error: 'Invalid company ID'
        });
    }

    try {

        const companyResult =
            await pool.query(
                `SELECT
                    id,
                    name,
                    code,
                    status,
                    created_at
                 FROM companies
                 WHERE id = $1`,
                [companyId]
            );

        if (companyResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Company not found'
            });
        }

        const company = companyResult.rows[0];

        const usersResult =
            await pool.query(
                `SELECT
                    u.id,
                    u.username,
                    u.role,
                    u.status
                 FROM users u
                 JOIN user_companies uc
                    ON u.id = uc.user_id
                 WHERE uc.company_id = $1`,
                [companyId]
            );

        const licensesResult =
            await pool.query(
                `SELECT
                    cl.id,
                    cl.plan_id,
                    p.name AS plan_name,
                    cl.status,
                    cl.starts_at,
                    cl.expires_at,
                    p.max_users
                 FROM company_licenses cl
                 JOIN plans p
                    ON cl.plan_id = p.id
                 WHERE cl.company_id = $1
                 ORDER BY cl.created_at DESC`,
                [companyId]
            );

        // ------------------------------------------------------------
        // DÜZELTME: Admin panelinden bir müşterinin TFRS16 kontrat verisi
        // hiç görünmüyordu (kaç kontratı var, hangi tedarikçilerle, ne
        // büyüklükte). Dashboard'daki "TFRS16 Customers" sayısı sadece
        // aktif kontratı olan farklı şirket sayısıydı — tıklanabilir
        // değildi, drill-down yoktu. Şirket detayına kontrat listesi +
        // özet eklendi.
        // ------------------------------------------------------------
        const contractsResult =
            await pool.query(
                `SELECT
                    id,
                    supplier,
                    monthly_payment,
                    currency,
                    start_date,
                    end_date,
                    status
                 FROM contracts
                 WHERE company_id = $1
                 ORDER BY status ASC, end_date ASC`,
                [companyId]
            );

        const contracts = contractsResult.rows;
        const activeContracts = contracts.filter(c => c.status === 'active');

        const supplierSet = new Set(activeContracts.map(c => c.supplier));

        const totalsByCurrency = {};
        for (const contract of activeContracts) {
            const currency = contract.currency || 'TRY';
            const amount = Number(contract.monthly_payment) || 0;
            totalsByCurrency[currency] = (totalsByCurrency[currency] || 0) + amount;
        }

        const contractsSummary = {
            active_count: activeContracts.length,
            total_count: contracts.length,
            suppliers: Array.from(supplierSet),
            total_monthly_payment_by_currency: Object.entries(totalsByCurrency)
                .map(([currency, total]) => ({ currency, total }))
        };

        return res.json({
            success: true,
            data: {
                ...company,
                users: usersResult.rows,
                licenses: licensesResult.rows,
                contracts,
                contracts_summary: contractsSummary
            }
        });

    } catch (error) {

        console.error(
            'Admin get company detail error:',
            error
        );

        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});


// ============================================================
// PATCH /api/admin/companies/:id/status
// ============================================================
// DÜZELTME: Kullanıcı için status=INACTIVE (pasifleştirme) yapılabiliyordu
// ama şirket için hiçbir deaktivasyon/silme yolu yoktu. Gerçek bir DELETE
// hâlâ desteklenmiyor (kontratlar/lisanslar/audit geçmişi referans
// verdiğinden veri kaybı riski taşır) — kullanıcılardakiyle aynı
// pasifleştirme deseni uygulanıyor. INACTIVE yapıldığında
// license-service.js artık bu şirket için aktif lisansı reddeder, yani
// bu sadece kozmetik bir bayrak değil, gerçek bir erişim kesme işlemidir.
router.patch('/companies/:id/status', requireAuth, requireAdmin, adminMutationRateLimiter, async (req, res) => {
    const companyId = String(req.params.id || '').trim();

    if (!companyId || companyId.length > 50) {
        return res.status(400).json({
            success: false,
            error: 'Invalid company ID'
        });
    }

    const unknownErr = rejectUnknownFields(req.body, ['status']);
    if (unknownErr) {
        return res.status(400).json({
            success: false,
            error: unknownErr
        });
    }

    const { status } = req.body;

    if (!status || !['ACTIVE', 'INACTIVE'].includes(status)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid status. Must be ACTIVE or INACTIVE'
        });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const companyResult = await client.query(
            `SELECT id, name, status
             FROM companies
             WHERE id = $1
             FOR UPDATE`,
            [companyId]
        );

        if (companyResult.rows.length === 0) {
            await client.query('ROLLBACK');

            return res.status(404).json({
                success: false,
                error: 'Company not found'
            });
        }

        const currentCompany = companyResult.rows[0];

        await client.query(
            `UPDATE companies
             SET status = $1
             WHERE id = $2`,
            [status, companyId]
        );

        await client.query(
            `INSERT INTO audit_events (
                id,
                actor,
                action,
                entity_type,
                entity_id,
                old_value,
                new_value
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                generateEntityId('AUD'),
                String(req.user.id),
                'UPDATE_COMPANY_STATUS',
                'company',
                companyId,
                JSON.stringify({ status: currentCompany.status }),
                JSON.stringify({ status })
            ]
        );

        await client.query('COMMIT');

        return res.json({
            success: true,
            message: `Company ${status === 'INACTIVE' ? 'deactivated' : 'activated'} successfully`
        });

    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch (rollbackError) {
            console.error(
                'Admin update company status rollback error:',
                rollbackError
            );
        }

        console.error(
            'Admin update company status error:',
            error
        );

        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });

    } finally {
        client.release();
    }
});


// ============================================================
// 3. LICENSE MANAGEMENT
// ============================================================

// GET /api/admin/licenses
router.get('/licenses', requireAuth, requireAdmin, async (req, res) => {

    try {

        const result = await pool.query(`
            SELECT
                cl.id,
                cl.company_id,
                c.name AS company_name,
                c.code AS company_code,
                cl.plan_id,
                p.name AS plan_name,
                p.max_users,
                cl.status,
                cl.starts_at,
                cl.expires_at,
                cl.created_at,
                COUNT(DISTINCT uc.user_id) AS current_users

            FROM company_licenses cl

            JOIN companies c
                ON cl.company_id = c.id

            JOIN plans p
                ON cl.plan_id = p.id

            LEFT JOIN user_companies uc
                ON c.id = uc.company_id

            GROUP BY
                cl.id,
                c.id,
                p.id

            ORDER BY cl.created_at DESC
        `);

        return res.json({
            success: true,
            data: result.rows
        });

    } catch (error) {

        console.error(
            'Admin get licenses error:',
            error
        );

        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});


// ============================================================
// GET /api/admin/licenses/expiring
// ============================================================
// DÜZELTME: reports.js içindeki /api/reports/expiring endpoint'i sadece
// isteği yapan kullanıcının KENDİ şirketi için çalışıyordu — platform
// genelinde "önümüzdeki N gün içinde bitecek lisanslar" görünümü admin
// panelinde yoktu, yenileme takibi elle (Licenses tablosundaki "Expires"
// sütununa bakarak) yapılıyordu. Bu, customer-facing /expiring ile aynı
// days-parametresi deseni kullanır ama tüm şirketleri kapsar.
router.get('/licenses/expiring', requireAuth, requireAdmin, async (req, res) => {

    const rawDays = Number(req.query.days);
    const days = Number.isFinite(rawDays)
        ? Math.min(Math.max(Math.trunc(rawDays), 1), 3650)
        : 30;

    try {

        const result = await pool.query(`
            SELECT
                cl.id,
                cl.company_id,
                c.name AS company_name,
                c.code AS company_code,
                c.status AS company_status,
                cl.plan_id,
                p.name AS plan_name,
                p.max_users,
                cl.status,
                cl.starts_at,
                cl.expires_at,
                COUNT(DISTINCT uc.user_id) AS current_users,
                (cl.expires_at::date - NOW()::date) AS days_remaining

            FROM company_licenses cl

            JOIN companies c
                ON cl.company_id = c.id

            JOIN plans p
                ON cl.plan_id = p.id

            LEFT JOIN user_companies uc
                ON c.id = uc.company_id

            WHERE cl.status = 'active'
              AND cl.expires_at IS NOT NULL
              AND cl.expires_at BETWEEN NOW() AND NOW() + ($1 || ' days')::interval

            GROUP BY cl.id, c.id, p.id

            ORDER BY cl.expires_at ASC
        `, [days]);

        return res.json({
            success: true,
            data: result.rows,
            days
        });

    } catch (error) {

        console.error(
            'Admin get expiring licenses error:',
            error
        );

        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});


// ============================================================
// 4. AUDIT LOG
// ============================================================

// GET /api/admin/audit
router.get('/audit', requireAuth, requireAdmin, async (req, res) => {

    const {
        limit = 100,
        offset = 0,
        action,
        entity_type,
        user_id
    } = req.query;

    const parsedLimit = Number.parseInt(limit, 10);
    const parsedOffset = Number.parseInt(offset, 10);

    if (
        !Number.isInteger(parsedLimit) ||
        parsedLimit < 1 ||
        parsedLimit > 500
    ) {
        return res.status(400).json({
            success: false,
            error:
                'Invalid pagination parameters. limit must be between 1 and 500.'
        });
    }

    if (
        !Number.isInteger(parsedOffset) ||
        parsedOffset < 0
    ) {
        return res.status(400).json({
            success: false,
            error:
                'Invalid pagination parameters. offset must be 0 or greater.'
        });
    }

    try {

        let query = `
            SELECT
                ae.id,
                ae.timestamp,
                ae.action,
                ae.entity_type,
                ae.entity_id,
                ae.actor,
                u.username AS user_username,

                CASE
                    WHEN ae.entity_type = 'company'
                        THEN c_entity.name
                    WHEN ae.entity_type = 'license'
                        THEN c_license.name
                    ELSE NULL
                END AS company_name,

                CASE
                    WHEN ae.entity_type = 'company'
                        THEN c_entity.code
                    WHEN ae.entity_type = 'license'
                        THEN c_license.code
                    ELSE NULL
                END AS company_code,

                ae.old_value,
                ae.new_value

            FROM audit_events ae

            LEFT JOIN users u
                ON ae.actor = u.id

            LEFT JOIN companies c_entity
                ON ae.entity_id = c_entity.id
               AND ae.entity_type = 'company'

            LEFT JOIN company_licenses cl
                ON ae.entity_id = cl.id
               AND ae.entity_type = 'license'

            LEFT JOIN companies c_license
                ON cl.company_id = c_license.id

            WHERE 1 = 1
        `;

        const params = [];
        let paramIndex = 1;

        if (action) {
            query += ` AND ae.action = $${paramIndex++}`;
            params.push(action);
        }

        if (entity_type) {
            query += ` AND ae.entity_type = $${paramIndex++}`;
            params.push(entity_type);
        }

        if (user_id) {
            query += ` AND ae.actor = $${paramIndex++}`;
            params.push(user_id);
        }

        query += `
            ORDER BY ae.timestamp DESC
            LIMIT $${paramIndex++}
            OFFSET $${paramIndex++}
        `;

        params.push(
            parsedLimit,
            parsedOffset
        );

        const result =
            await pool.query(query, params);

        // ----------------------------------------------------
        // Count
        // ----------------------------------------------------

        let countQuery = `
            SELECT COUNT(*) AS count
            FROM audit_events ae
            WHERE 1 = 1
        `;

        const countParams = [];
        let countIndex = 1;

        if (action) {
            countQuery +=
                ` AND ae.action = $${countIndex++}`;

            countParams.push(action);
        }

        if (entity_type) {
            countQuery +=
                ` AND ae.entity_type = $${countIndex++}`;

            countParams.push(entity_type);
        }

        if (user_id) {
            countQuery +=
                ` AND ae.actor = $${countIndex++}`;

            countParams.push(user_id);
        }

        const countResult =
            await pool.query(
                countQuery,
                countParams
            );

        return res.json({
            success: true,
            data: result.rows,
            pagination: {
                total: Number.parseInt(
                    countResult.rows[0].count,
                    10
                ),
                limit: parsedLimit,
                offset: parsedOffset
            }
        });

    } catch (error) {

        console.error(
            'Admin get audit error:',
            error
        );

        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});


// ============================================================
// GET /api/admin/tfrs16/customers
// ============================================================
// DÜZELTME: Admin, TFRS16 verisinin kendisini hiç göremiyordu.
// Dashboard'daki "TFRS16 Customers" kutusu sadece contracts tablosunda
// aktif kontratı olan farklı şirket sayısıydı — tıklanabilir değildi,
// drill-down yoktu. Bu endpoint platform genelinde her müşterinin kaç
// kontratı olduğunu, hangi tedarikçilerle çalıştığını ve toplam
// büyüklüğünü (para birimine göre aylık ödeme toplamı) döner. Tek bir
// müşterinin tam kontrat listesi için GET /companies/:id kullanılır
// (contracts + contracts_summary alanları, aşağıdaki liste ile aynı
// hesaplama mantığını kullanır).
router.get('/tfrs16/customers', requireAuth, requireAdmin, async (req, res) => {

    try {

        const result = await pool.query(`
            SELECT
                c.id,
                c.name,
                c.code,
                c.status,

                COUNT(*) FILTER (WHERE ct.status = 'active') AS active_contract_count,
                COUNT(*) AS total_contract_count,

                COALESCE(
                    ARRAY_AGG(DISTINCT ct.supplier) FILTER (WHERE ct.status = 'active'),
                    ARRAY[]::text[]
                ) AS suppliers,

                COALESCE(
                    (
                        SELECT json_agg(
                            json_build_object(
                                'currency', currency_totals.currency,
                                'total', currency_totals.total
                            )
                        )
                        FROM (
                            SELECT
                                ct2.currency,
                                SUM(ct2.monthly_payment) AS total
                            FROM contracts ct2
                            WHERE ct2.company_id = c.id
                              AND ct2.status = 'active'
                            GROUP BY ct2.currency
                        ) currency_totals
                    ),
                    '[]'::json
                ) AS total_monthly_payment_by_currency

            FROM companies c

            INNER JOIN contracts ct
                ON ct.company_id = c.id

            GROUP BY c.id

            ORDER BY active_contract_count DESC, c.name ASC
        `);

        return res.json({
            success: true,
            data: result.rows
        });

    } catch (error) {

        console.error(
            'Admin get tfrs16 customers error:',
            error
        );

        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});


// ============================================================
// 5. ADMIN DASHBOARD
// ============================================================

// GET /api/admin/dashboard
router.get('/dashboard', requireAuth, requireAdmin, async (req, res) => {

    try {

        const companiesResult =
            await pool.query(
                `SELECT COUNT(*) AS total
                 FROM companies`
            );

        const licensesResult =
            await pool.query(
                `SELECT COUNT(*) AS total
                 FROM company_licenses
                 WHERE status = 'active'
                   AND (expires_at IS NULL OR expires_at > NOW())`
            );

        const usersResult =
            await pool.query(
                `SELECT COUNT(*) AS total
                 FROM users
                 WHERE status = 'ACTIVE'`
            );

        const tfrs16Result =
            await pool.query(
                `SELECT COUNT(DISTINCT company_id) AS total
                 FROM contracts
                 WHERE status = 'active'`
            );

        // DÜZELTME: dashboard'da süresi yaklaşan lisanslar için hiçbir
        // proaktif gösterge yoktu. Sabit 30 günlük pencere burada sadece
        // özet sayı için kullanılır; tam liste ve ayarlanabilir gün
        // aralığı için bkz. GET /api/admin/licenses/expiring.
        const expiringLicensesResult =
            await pool.query(
                `SELECT COUNT(*) AS total
                 FROM company_licenses
                 WHERE status = 'active'
                   AND expires_at IS NOT NULL
                   AND expires_at BETWEEN NOW() AND NOW() + INTERVAL '30 days'`
            );

        const recentActivity =
            await pool.query(`
                SELECT
                    ae.timestamp,
                    ae.action,
                    ae.entity_type,
                    u.username AS user_username,

                    CASE
                        WHEN ae.entity_type = 'company'
                            THEN c_entity.name
                        WHEN ae.entity_type = 'license'
                            THEN c_license.name
                        ELSE NULL
                    END AS company_name

                FROM audit_events ae

                LEFT JOIN users u
                    ON ae.actor = u.id

                LEFT JOIN companies c_entity
                    ON ae.entity_id = c_entity.id
                   AND ae.entity_type = 'company'

                LEFT JOIN company_licenses cl
                    ON ae.entity_id = cl.id
                   AND ae.entity_type = 'license'

                LEFT JOIN companies c_license
                    ON cl.company_id = c_license.id

                ORDER BY ae.timestamp DESC

                LIMIT 10
            `);

        return res.json({
            success: true,
            data: {
                companies:
                    Number.parseInt(
                        companiesResult.rows[0].total,
                        10
                    ),

                active_licenses:
                    Number.parseInt(
                        licensesResult.rows[0].total,
                        10
                    ),

                users:
                    Number.parseInt(
                        usersResult.rows[0].total,
                        10
                    ),

                tfrs16_customers:
                    Number.parseInt(
                        tfrs16Result.rows[0].total,
                        10
                    ),

                expiring_licenses_30d:
                    Number.parseInt(
                        expiringLicensesResult.rows[0].total,
                        10
                    ),

                recent_activity:
                    recentActivity.rows
            }
        });

    } catch (error) {

        console.error(
            'Admin dashboard error:',
            error
        );

        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});


// ============================================================
// EXPORT
// ============================================================

module.exports = router;
