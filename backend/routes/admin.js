const express = require('express');
const router = express.Router();
const crypto = require('crypto');

const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');
const { createRateLimiter } = require('../middleware/rate-limit');

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
                    '[]'::json
                ) AS companies
            FROM users u
            LEFT JOIN user_companies uc
                ON u.id = uc.user_id
            LEFT JOIN companies c
                ON uc.company_id = c.id
            GROUP BY u.id
            ORDER BY u.created_at DESC
        `);

        return res.json({
            success: true,
            data: result.rows
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
                action,
                entity_type,
                entity_id,
                user_id,
                old_value,
                new_value
            )
            VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                'CREATE_USER',
                'user',
                newUser.id,
                req.user.id,
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
                action,
                entity_type,
                entity_id,
                user_id,
                old_value,
                new_value
            )
            VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                'UPDATE_USER',
                'user',
                userId,
                req.user.id,
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
// 2. COMPANY MANAGEMENT
// ============================================================

// GET /api/admin/companies
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

                COUNT(DISTINCT uc.user_id) AS user_count,

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

            GROUP BY c.id

            ORDER BY c.created_at DESC
        `);

        return res.json({
            success: true,
            data: result.rows
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

        const result = await client.query(
            `INSERT INTO companies (
                id,
                name,
                code,
                tax_number,
                address,
                phone,
                email
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING
                id,
                name,
                code,
                tax_number,
                address,
                phone,
                email,
                created_at`,
            [
                newCompanyId,
                name,
                code,
                tax_number || null,
                address || null,
                phone || null,
                email || null
            ]
        );

        const newCompany = result.rows[0];

        await client.query(
            `INSERT INTO audit_events (
                action,
                entity_type,
                entity_id,
                user_id,
                old_value,
                new_value
            )
            VALUES ($1, $2, $3, $4, $5, $6)`,
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
                    tax_number,
                    address,
                    phone,
                    email,
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

        return res.json({
            success: true,
            data: {
                ...company,
                users: usersResult.rows,
                licenses: licensesResult.rows
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
                ae.user_id,
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
                ae.new_value,
                ae.success

            FROM audit_events ae

            LEFT JOIN users u
                ON ae.user_id = u.id

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
            query += ` AND ae.user_id = $${paramIndex++}`;
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
                ` AND ae.user_id = $${countIndex++}`;

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
                    END AS company_name,

                    ae.success

                FROM audit_events ae

                LEFT JOIN users u
                    ON ae.user_id = u.id

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
