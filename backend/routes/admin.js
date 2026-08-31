const express = require('express');
const router = express.Router();
const crypto = require('crypto');

const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { requireAdmin, requireStaffAccess } = require('../middleware/admin');
const { createRateLimiter } = require('../middleware/rate-limit');
const { canAddUserToCompany, canAddCompanyToTree, lockRootCompanyForLimit } = require('../services/license-service');

const {
    isCompanyInScope,
    canAssignRole,
    ALL_ROLES
} = require('../services/organization-service');

// P1: admin panelinden atanabilir roller. ADMIN/ACCOUNTANT_MANAGER
// dışındakiler (ACCOUNTANT, CONTROLLER) P0'da yalnızca DB/servis
// katmanında hazırlanmıştı; P1 ile birlikte admin panelinden de
// atanabilir hale geliyorlar. Kimin HANGİ rolü atayabileceği ayrıca
// canAssignRole() ile kontrol edilir (P1 madde 4 — rol yaratma
// matrisi).
const ASSIGNABLE_ROLES = ALL_ROLES; // ['ADMIN','ACCOUNTANT_MANAGER','ACCOUNTANT','CONTROLLER','VIEWER']

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

// GÜVENLİK DÜZELTMESİ: yukarıdaki adminMutationRateLimiter YALNIZCA
// tek tek yazma (POST/PATCH/DELETE) endpoint'lerine bağlıydı — GET
// dahil TÜM admin yüzeyini IP bazında koruyan bir limiter YOKTU.
// Yani kimliği doğrulanmamış bir saldırgan /api/admin/* üzerinde
// sınırsız istek atabiliyordu (her biri 401 dönse de, brute-force /
// kaynak tüketimi açısından korumasız). Bu limiter router'ın EN
// BAŞINA (requireAuth/requireAdmin'den ÖNCE) bağlanır ki 401 dönen
// istekler de sayılsın. test/security-hardening.test.js bunu zaten
// test ediyordu ve bu yüzden fail veriyordu.
const adminGlobalRateLimiter = createRateLimiter({
    windowMs: Number(process.env.ADMIN_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    // Aynı ADMIN_RATE_LIMIT_MAX değişkenine bağlı (ayrı bir env
    // değişkeni eklemek yerine) — admin yüzeyinin limiti tek yerden
    // yönetilsin. Varsayılan mutation limitinden daha yüksek tutulur
    // çünkü bu limiter GET dahil tüm istekleri sayar.
    max: Number(process.env.ADMIN_RATE_LIMIT_MAX) || 300,
    keyGenerator: req => `admin-global:${req.ip}`,
    message: 'Çok fazla admin isteği. Lütfen daha sonra tekrar deneyin.'
});

router.use(adminGlobalRateLimiter);

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
router.get('/users', requireStaffAccess, async (req, res) => {
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

    // P1: ACCOUNTANT_MANAGER yalnızca kendi holding ağacındaki
    // şirketlere bağlı kullanıcıları görebilir (requireStaffAccess
    // req.accessScope'u zaten hesapladı). ADMIN için isGlobalAdmin=true
    // olduğundan bu filtre uygulanmaz — mevcut (kısıtlamasız) davranış
    // korunur.
    const scope = req.accessScope;

    try {
        const conditions = [];
        const params = [];

        if (searchTerm) {
            params.push(`%${searchTerm}%`);
            conditions.push(`u.username ILIKE $${params.length}`);
        }

        if (!scope.isGlobalAdmin) {
            params.push(scope.allowedCompanyIds);
            conditions.push(
                `EXISTS (
                    SELECT 1 FROM user_companies uc_scope
                    WHERE uc_scope.user_id = u.id
                      AND uc_scope.company_id = ANY($${params.length})
                )`
            );
        }

        const whereClause = conditions.length > 0
            ? `WHERE ${conditions.join(' AND ')}`
            : '';

        const listParams = [...params, parsedLimit, parsedOffset];
        const limitPlaceholder = `$${listParams.length - 1}`;
        const offsetPlaceholder = `$${listParams.length}`;

        const result = await pool.query(`
            SELECT
                u.id,
                u.username,
                u.role,
                u.status,
                u.email,
                u.first_name,
                u.last_name,
                u.must_change_password,
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
            LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}
        `, listParams);

        const countResult = await pool.query(
            `SELECT COUNT(*) AS count FROM users u ${whereClause}`,
            params
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

router.post('/users', requireStaffAccess, adminMutationRateLimiter, async (req, res) => {
    const unknownErr = rejectUnknownFields(req.body, [
        'username', 'password', 'role', 'status', 'company_ids',
        'email', 'first_name', 'last_name'
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
        company_ids,
        email: rawEmail,
        first_name: rawFirstName,
        last_name: rawLastName
    } = req.body;

    // --------------------------------------------------------
    // P0 — HOLDİNG/KULLANICI YÖNETİMİ: email, first_name, last_name.
    //
    // "Email = login kimliği" hedefine, mevcut auth.js /login akışını
    // (username ile sorgular) DEĞİŞTİRMEDEN ulaşmak için: username
    // verilmezse ama email verilmişse, username = email olarak
    // otomatik doldurulur (bkz. onaylı plan madde 3: "username
    // alanı kullanılacaksa değeri = email"). Kullanıcı hem username
    // hem email verirse ikisi de ayrı ayrı saklanır (geriye dönük
    // uyumluluk — mevcut admin panelinden username ile kullanıcı
    // oluşturma akışı kırılmaz).
    // --------------------------------------------------------

    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
    const firstName = typeof rawFirstName === 'string' ? rawFirstName.trim() : '';
    const lastName = typeof rawLastName === 'string' ? rawLastName.trim() : '';

    if (email) {
        if (email.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid email format'
            });
        }
    }

    if (rawFirstName !== undefined && (typeof rawFirstName !== 'string' || firstName.length > 100)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid first_name'
        });
    }

    if (rawLastName !== undefined && (typeof rawLastName !== 'string' || lastName.length > 100)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid last_name'
        });
    }

    const usernameProvided = typeof rawUsername === 'string' ? rawUsername.trim() : '';
    const username = usernameProvided || email;

    if (!username || username.length < 3 || username.length > 50) {
        return res.status(400).json({
            success: false,
            error: usernameProvided
                ? 'Username is required and must be 3-50 characters'
                : 'username veya email zorunludur (3-50 karakter; email verilirse username olarak kullanılır)'
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

    // P1: ACCOUNTANT_MANAGER eklendi ve gerçek yetki kapsamı artık
    // uygulanıyor — bkz. aşağıdaki canAssignRole() kontrolü (P1
    // madde 4: ACCOUNTANT_MANAGER yalnızca ACCOUNTANT/CONTROLLER/
    // VIEWER oluşturabilir; ADMIN veya ACCOUNTANT_MANAGER OLUŞTURAMAZ).
    if (role !== undefined && !ASSIGNABLE_ROLES.includes(role)) {
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

    // --------------------------------------------------------
    // P1 — ROL YARATMA MATRİSİ (madde 4)
    // --------------------------------------------------------
    // Bu kontrol SERVER-SIDE zorunludur — yalnızca UI'da gizlemek
    // yeterli değildir (onaylı plan madde 4). ADMIN her rolü
    // oluşturabilir; ACCOUNTANT_MANAGER yalnızca ACCOUNTANT/
    // CONTROLLER/VIEWER oluşturabilir.
    const requestedRole = role || 'VIEWER';

    if (!canAssignRole(req.user.role, requestedRole)) {
        return res.status(403).json({
            success: false,
            error: `${req.user.role} rolündeki bir kullanıcı ${requestedRole} rolünde kullanıcı oluşturamaz`,
            code: 'ROLE_ASSIGNMENT_FORBIDDEN'
        });
    }

    // --------------------------------------------------------
    // P1 — HOLDİNG AĞACI SCOPE KONTROLÜ (madde 5 — IDOR/BOLA)
    // --------------------------------------------------------
    // ACCOUNTANT_MANAGER yalnızca KENDİ erişim kapsamındaki (kendi
    // holding alt ağacındaki) şirketlere kullanıcı ekleyebilir.
    // ADMIN için req.accessScope.isGlobalAdmin=true olduğundan bu
    // kontrol atlanır (mevcut davranış korunur).
    if (!req.accessScope.isGlobalAdmin && Array.isArray(company_ids)) {
        const outOfScopeIds = company_ids
            .map(String)
            .filter(id => !isCompanyInScope(id, req.accessScope));

        if (outOfScopeIds.length > 0) {
            return res.status(403).json({
                success: false,
                error: 'Bu şirketlerden birine kullanıcı ekleme yetkiniz bulunmamaktadır.',
                code: 'COMPANY_ACCESS_DENIED',
                companyIds: outOfScopeIds
            });
        }
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

        // P0: email de username gibi login kimliği adayı olduğu için
        // ayrıca ve AYRI bir 409 mesajıyla kontrol ediliyor (DB'deki
        // idx_users_email_unique kısmi index'i zaten bunu garanti
        // eder, ama burada erken ve anlaşılır bir hata döndürmek
        // için uygulama katmanında da kontrol ediyoruz).
        if (email) {
            const existingEmail = await client.query(
                `SELECT id
                 FROM users
                 WHERE LOWER(email) = $1`,
                [email]
            );

            if (existingEmail.rows.length > 0) {
                await client.query('ROLLBACK');

                return res.status(409).json({
                    success: false,
                    error: 'Email already exists'
                });
            }
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
            //
            // P5-A: Race condition (TOCTOU) önlemi — limit kontrolü
            // öncesi ağacın kök şirket satırını FOR UPDATE ile
            // kilitliyoruz. Aynı holding'de eşzamanlı iki create
            // isteği sıraya girer; ikisi de "9 < 10" görüp geçemez.
            // --------------------------------------------------
            const lockedRoots = new Set();
            for (const companyId of uniqueCompanyIds) {
                const rootId = await lockRootCompanyForLimit(companyId, client);
                if (rootId) lockedRoots.add(rootId);
            }

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

        const userRole = requestedRole;
        const userStatus = status || 'ACTIVE';
        const newUserId = generateEntityId('USER');

        const insertResult = await client.query(
            `INSERT INTO users (
                id,
                username,
                password_hash,
                role,
                status,
                email,
                first_name,
                last_name,
                must_change_password
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
            RETURNING
                id,
                username,
                role,
                status,
                email,
                first_name,
                last_name,
                must_change_password,
                created_at`,
            [
                newUserId,
                username,
                hashedPassword,
                userRole,
                userStatus,
                email || null,
                firstName || null,
                lastName || null
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
                    email: email || null,
                    first_name: firstName || null,
                    last_name: lastName || null,
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

        // Unique constraint race (username veya email) — 500 yerine 409.
        // constraint adına göre username/email ayrımı yapılıyor;
        // eşleşmezse (beklenmedik bir unique kısıt) genel mesaj kullanılır.
        if (error && error.code === '23505') {
            if (error.constraint === 'idx_users_email_unique') {
                return res.status(409).json({
                    success: false,
                    error: 'Email already exists'
                });
            }

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

router.patch('/users/:id', requireStaffAccess, adminMutationRateLimiter, async (req, res) => {
    const userId = String(req.params.id || '').trim();
    const requestingUserId = String(req.user.id);

    if (!userId || userId.length > 50) {
        return res.status(400).json({
            success: false,
            error: 'Invalid user ID'
        });
    }

    const unknownErr = rejectUnknownFields(req.body, [
        'role', 'status', 'company_ids', 'email', 'first_name', 'last_name'
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
        company_ids,
        email: rawEmail,
        first_name: rawFirstName,
        last_name: rawLastName
    } = req.body;

    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : rawEmail;
    const firstName = typeof rawFirstName === 'string' ? rawFirstName.trim() : rawFirstName;
    const lastName = typeof rawLastName === 'string' ? rawLastName.trim() : rawLastName;

    // --------------------------------------------------------
    // Validation
    // --------------------------------------------------------

    if (
        email !== undefined &&
        email !== null &&
        (typeof email !== 'string' || email.length > 150 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    ) {
        return res.status(400).json({
            success: false,
            error: 'Invalid email format'
        });
    }

    if (
        firstName !== undefined &&
        firstName !== null &&
        (typeof firstName !== 'string' || firstName.length > 100)
    ) {
        return res.status(400).json({
            success: false,
            error: 'Invalid first_name'
        });
    }

    if (
        lastName !== undefined &&
        lastName !== null &&
        (typeof lastName !== 'string' || lastName.length > 100)
    ) {
        return res.status(400).json({
            success: false,
            error: 'Invalid last_name'
        });
    }

    // P1: ACCOUNTANT_MANAGER eklendi ve gerçek yetki kapsamı artık
    // uygulanıyor (bkz. POST /users'taki aynı not — canAssignRole()
    // kontrolü aşağıda, mevcut kullanıcının bulunmasından SONRA
    // yapılır çünkü hem hedef kullanıcının MEVCUT rolü hem de
    // atanacak YENİ rol matrise tabidir).
    if (
        role !== undefined &&
        !ASSIGNABLE_ROLES.includes(role)
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
                status,
                email,
                first_name,
                last_name
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
        // P0: email uniqueness (kendi mevcut email'i hariç)
        // ----------------------------------------------------

        if (email) {
            const existingEmail = await client.query(
                `SELECT id
                 FROM users
                 WHERE LOWER(email) = $1
                   AND id != $2`,
                [email, userId]
            );

            if (existingEmail.rows.length > 0) {
                await client.query('ROLLBACK');

                return res.status(409).json({
                    success: false,
                    error: 'Email already exists'
                });
            }
        }

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
        // P1 — HOLDİNG AĞACI SCOPE + ROL MATRİSİ KONTROLÜ
        // ----------------------------------------------------
        // ADMIN için req.accessScope.isGlobalAdmin=true olduğundan
        // bu blok tamamen atlanır (mevcut davranış korunur).
        if (!req.accessScope.isGlobalAdmin) {

            // (a) Hedef kullanıcının MEVCUT rolü, aktörün
            // yönetebileceği roller arasında değilse (ör. hedef
            // zaten ADMIN veya başka bir ACCOUNTANT_MANAGER ise)
            // ACCOUNTANT_MANAGER bu kullanıcıya HİÇBİR alanda
            // dokunamaz — lateral privilege / tamper koruması
            // (madde 5).
            if (!canAssignRole(req.user.role, currentUser.role)) {
                await client.query('ROLLBACK');

                return res.status(403).json({
                    success: false,
                    error: 'Bu kullanıcıyı düzenleme yetkiniz bulunmamaktadır.',
                    code: 'ROLE_ASSIGNMENT_FORBIDDEN'
                });
            }

            // (b) Hedef kullanıcının MEVCUT şirketlerinden hiçbiri
            // aktörün erişim kapsamında değilse (başka bir holding/
            // ağaçtaki bir kullanıcı) — kullanıcı bulunamadı gibi
            // davranılır (404), var olduğu bile sızdırılmaz.
            const targetInScope =
                currentCompanyIds.length === 0 ||
                currentCompanyIds.some(id => isCompanyInScope(id, req.accessScope));

            if (!targetInScope) {
                await client.query('ROLLBACK');

                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }

            // (c) Yeni bir rol atanmak isteniyorsa, o rol de matrise
            // uygun olmalı.
            if (role !== undefined && !canAssignRole(req.user.role, role)) {
                await client.query('ROLLBACK');

                return res.status(403).json({
                    success: false,
                    error: `${req.user.role} rolündeki bir kullanıcı ${role} rolünü atayamaz`,
                    code: 'ROLE_ASSIGNMENT_FORBIDDEN'
                });
            }

            // (d) company_ids güncelleniyorsa, YENİ listedeki tüm
            // şirketler de aktörün erişim kapsamında olmalı — başka
            // bir holdinge kullanıcı "taşınamaz".
            if (company_ids !== undefined) {
                const requestedIds = company_ids.map(String);
                const outOfScopeIds = requestedIds.filter(
                    id => !isCompanyInScope(id, req.accessScope)
                );

                if (outOfScopeIds.length > 0) {
                    await client.query('ROLLBACK');

                    return res.status(403).json({
                        success: false,
                        error: 'Bu şirketlerden birine kullanıcı ekleme yetkiniz bulunmamaktadır.',
                        code: 'COMPANY_ACCESS_DENIED',
                        companyIds: outOfScopeIds
                    });
                }
            }
        }

        // ----------------------------------------------------
        // Normalize requested companies
        // ----------------------------------------------------

        let uniqueCompanyIds = [];
        let newlyAddedCompanyIds = [];

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
            //
            // P5-A: Root lock (TOCTOU).
            // ------------------------------------------------
            newlyAddedCompanyIds = uniqueCompanyIds.filter(
                id => !currentCompanyIds.includes(id)
            );

            for (const companyId of newlyAddedCompanyIds) {
                await lockRootCompanyForLimit(companyId, client);
            }

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
        // DÜZELTME (P3 — kabul kriteri: "INACTIVE → ACTIVE
        // dönüşünde max_users kontrol edilir"):
        //
        // Yukarıdaki kapasite kontrolü SADECE company_ids'e YENİ
        // eklenen şirketler için çalışıyordu. Bir kullanıcı zaten
        // bağlı olduğu şirket(ler)de INACTIVE'ken (bu yüzden
        // getTreeActiveUserCount'a hiç dahil değilken) status=ACTIVE
        // ile PATCH edilirse hiçbir kapasite kontrolünden
        // geçmiyordu — yani plan max_users=10 olan ve zaten 10
        // ACTIVE kullanıcısı olan bir şirkette, 11. (INACTIVE)
        // kullanıcıyı PATCH /users/:id { status: "ACTIVE" } ile
        // tekrar aktive etmek limiti sessizce aşabiliyordu.
        //
        // Bu kontrol henüz UPDATE çalışmadığı için (currentUser.status
        // DB'de hâlâ eski değeriyle), canAddUserToCompany'nin saydığı
        // "mevcut ACTIVE kullanıcı sayısı" bu kullanıcıyı henüz
        // İÇERMİYOR — yani "currentUsers < maxUsers" testi doğru
        // şekilde "bu kullanıcı eklenirse sığar mı" sorusuna cevap
        // veriyor.
        //
        // P5-A: Root lock eklendi.
        // ----------------------------------------------------

        const isReactivating =
            status === 'ACTIVE' &&
            currentUser.status !== 'ACTIVE';

        if (isReactivating) {
            const finalCompanyIds =
                company_ids !== undefined
                    ? uniqueCompanyIds
                    : currentCompanyIds;

            const alreadyCheckedCompanyIds =
                new Set(newlyAddedCompanyIds);

            for (const companyId of finalCompanyIds) {
                if (alreadyCheckedCompanyIds.has(companyId)) {
                    continue;
                }
                await lockRootCompanyForLimit(companyId, client);
            }

            for (const companyId of finalCompanyIds) {
                if (alreadyCheckedCompanyIds.has(companyId)) {
                    // Bu şirket için kapasite zaten yukarıda
                    // kontrol edildi (yeni eklenen şirket) —
                    // tekrar sorgulamaya gerek yok.
                    continue;
                }

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

        if (email !== undefined) {
            updateFields.push(
                `email = $${paramIndex++}`
            );

            updateParams.push(email);
        }

        if (firstName !== undefined) {
            updateFields.push(
                `first_name = $${paramIndex++}`
            );

            updateParams.push(firstName);
        }

        if (lastName !== undefined) {
            updateFields.push(
                `last_name = $${paramIndex++}`
            );

            updateParams.push(lastName);
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

            email:
                email !== undefined
                    ? email
                    : currentUser.email,

            first_name:
                firstName !== undefined
                    ? firstName
                    : currentUser.first_name,

            last_name:
                lastName !== undefined
                    ? lastName
                    : currentUser.last_name,

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

        // P0: email unique kısıt çakışması (race condition) — 500
        // yerine 409 döndür.
        if (error && error.code === '23505' &&
            error.constraint === 'idx_users_email_unique') {
            return res.status(409).json({
                success: false,
                error: 'Email already exists'
            });
        }

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
router.get('/companies', requireStaffAccess, async (req, res) => {
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
    const scope = req.accessScope;

    try {

        const conditions = [];
        const params = [];

        if (searchTerm) {
            params.push(`%${searchTerm}%`);
            conditions.push(`(c.name ILIKE $${params.length} OR c.code ILIKE $${params.length})`);
        }

        // P1: ACCOUNTANT_MANAGER yalnızca kendi holding alt ağacındaki
        // şirketleri görebilir (madde 1/2). ADMIN için isGlobalAdmin=true
        // olduğundan bu filtre uygulanmaz.
        if (!scope.isGlobalAdmin) {
            params.push(scope.allowedCompanyIds);
            conditions.push(`c.id = ANY($${params.length})`);
        }

        const whereClause = conditions.length > 0
            ? `WHERE ${conditions.join(' AND ')}`
            : '';

        const listParams = [...params, parsedLimit, parsedOffset];
        const limitPlaceholder = `$${listParams.length - 1}`;
        const offsetPlaceholder = `$${listParams.length}`;

        const result = await pool.query(`
            SELECT
                c.id,
                c.name,
                c.code,
                c.status,
                c.parent_company_id,
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
            LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}
        `, listParams);

        const countResult = await pool.query(
            `SELECT COUNT(*) AS count FROM companies c ${whereClause}`,
            params
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

router.post('/companies', requireStaffAccess, adminMutationRateLimiter, async (req, res) => {

    const unknownErr = rejectUnknownFields(req.body, [
        'name', 'code', 'parent_company_id'
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
        parent_company_id: rawParentCompanyId
    } = req.body;

    const name = typeof rawName === 'string' ? rawName.trim() : '';
    const code = typeof rawCode === 'string' ? rawCode.trim() : '';

    // P0/P1 — HOLDİNG HİYERARŞİSİ: parent_company_id opsiyonel.
    // Belirtilmezse/null ise şirket bir ANA şirkettir (mevcut düz
    // şirket davranışı — plan madde 4, Senaryo A: "Hiyerarşi zorunlu
    // değildir. parent yoksa sistem tek şirket gibi çalışır").
    // Ağaç büyüklüğü/limit (max_companies) enforcement'ı P1 ile
    // birlikte aşağıda (transaction içinde, parent satırı kilitlenerek)
    // uygulanıyor — bkz. canAddCompanyToTree çağrısı.
    const parentCompanyId =
        rawParentCompanyId === undefined || rawParentCompanyId === null || rawParentCompanyId === ''
            ? null
            : String(rawParentCompanyId).trim();

    if (parentCompanyId !== null && (parentCompanyId.length === 0 || parentCompanyId.length > 50)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid parent_company_id'
        });
    }

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

    // P1 — HOLDİNG AĞACI SCOPE KONTROLÜ (madde 5 — IDOR/BOLA):
    // "ACCOUNTANT_MANAGER: POST /companies ile başka bir holdingin
    // şirketini parent gösterememeli." ADMIN için isGlobalAdmin=true
    // olduğundan bu blok atlanır (mevcut davranış korunur — ADMIN
    // istediği parent'ı (veya hiç parent'sız yeni bir ana şirket)
    // gösterebilir).
    //
    // TASARIM KARARI: ACCOUNTANT_MANAGER için parent_company_id
    // ZORUNLUDUR ve kendi erişim kapsamı (kendi holding alt ağacı)
    // içinde olmalıdır. Yeni, BAĞIMSIZ bir ana şirket (parent=null,
    // yani yeni bir tenant/holding yaratmak) platform seviyesinde bir
    // işlemdir ve yalnızca ADMIN yapabilir — bir ACCOUNTANT_MANAGER'ın
    // işi kendi ağacına alt şirket eklemektir, yeni bir holding
    // kurmak değildir.
    if (!req.accessScope.isGlobalAdmin) {

        if (parentCompanyId === null) {
            return res.status(403).json({
                success: false,
                error: 'ACCOUNTANT_MANAGER yalnızca kendi holding ağacına alt şirket ekleyebilir; parent_company_id zorunludur.',
                code: 'PARENT_COMPANY_REQUIRED'
            });
        }

        if (!isCompanyInScope(parentCompanyId, req.accessScope)) {
            return res.status(403).json({
                success: false,
                error: 'Bu şirketi üst şirket (parent) olarak gösterme yetkiniz bulunmamaktadır.',
                code: 'COMPANY_ACCESS_DENIED'
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

        // P0: parent_company_id belirtilmişse gerçekten var olan bir
        // şirketi göstermeli.
        //
        // P1: artık ayrıca — FOR UPDATE ile kilitlenir (aşağıdaki
        // max_companies sayımı ile aynı transaction içinde race
        // condition'ı önlemek için — bkz. license-service.js
        // canAddCompanyToTree dosya başı notu) ve ağacın KÖKÜNE göre
        // max_companies limiti kontrol edilir.
        //
        // P5-C: Root kilidi eklendi (tree-level TOCTOU).
        if (parentCompanyId !== null) {
            const parentCheck = await client.query(
                `SELECT id
                 FROM companies
                 WHERE id = $1`,
                [parentCompanyId]
            );

            if (parentCheck.rows.length === 0) {
                await client.query('ROLLBACK');

                return res.status(400).json({
                    success: false,
                    error: 'parent_company_id references a company that does not exist'
                });
            }

            await lockRootCompanyForLimit(parentCompanyId, client);

            // P1-C — max_companies enforcement (ana şirket dahil
            // toplam şirket sayısı ağacın kökündeki lisansa göre
            // kontrol edilir).
            const capacity = await canAddCompanyToTree(parentCompanyId, client);


            if (!capacity.allowed) {
                await client.query('ROLLBACK');

                return res.status(capacity.reason === 'NO_ACTIVE_LICENSE' ? 403 : 409).json({
                    success: false,
                    error: capacity.message,
                    code: capacity.reason,
                    currentCompanies: capacity.currentCompanies,
                    maxCompanies: capacity.maxCompanies
                });
            }
        }

        const newCompanyId = generateEntityId('COMP');

        // init.sql companies columns: id, name, code, parent_company_id,
        // created_at (+ status). tax_number/address/phone/email
        // hâlâ persist edilmiyor (bkz. yukarıdaki mevcut not — bu P0
        // kapsamının dışında, önceden de böyleydi).
        const result = await client.query(
            `INSERT INTO companies (
                id,
                name,
                code,
                parent_company_id
            )
            VALUES ($1, $2, $3, $4)
            RETURNING
                id,
                name,
                code,
                parent_company_id,
                created_at`,
            [
                newCompanyId,
                name,
                code,
                parentCompanyId
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

        // P4 SERTLEŞTİRME (savunma amaçlı — normal akışta yeni şirket
        // id'si sunucu tarafında rastgele üretildiği ve hiçbir route
        // parent_company_id'yi SONRADAN değiştirmediği için pratikte
        // ulaşılamaz): DB'deki chk_companies_not_self_parent CHECK
        // constraint'i (23514) yakalanmadan önce bu satıra düşerse
        // kullanıcıya çıplak bir 500 yerine anlaşılır bir 400 dönülür.
        if (error && error.code === '23514') {
            return res.status(400).json({
                success: false,
                error: 'Bir şirket kendi üst şirketi (parent) olamaz'
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

router.get('/companies/:id', requireStaffAccess, async (req, res) => {

    const companyId = String(req.params.id || '').trim();

    if (!companyId || companyId.length > 50) {
        return res.status(400).json({
            success: false,
            error: 'Invalid company ID'
        });
    }

    // P1: ACCOUNTANT_MANAGER yalnızca kendi holding alt ağacındaki
    // bir şirketin detayını görebilir. Kapsam dışı bir id için "var
    // olduğu" bile sızdırılmaz — 404 döner (madde 5 — IDOR/BOLA).
    if (!isCompanyInScope(companyId, req.accessScope)) {
        return res.status(404).json({
            success: false,
            error: 'Company not found'
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
                    parent_company_id,
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

        /**
         * DÜZELTME (P2 — kabul kriteri #12: "Lisans detayında efektif
         * limitler gösteriliyor"): Bu sorgu önceden yalnızca p.max_users
         * (planın HAM değeri) dönüyordu — cl.max_users_override /
         * max_contracts_override / max_companies_override hiç
         * seçilmiyordu. Sonuç: Custom bir lisansa override ile özel bir
         * limit atansa bile (örn. max_users_override=10), bu endpoint
         * hâlâ planın kendi (genelde NULL/sınırsız) değerini
         * döndürüyordu — frontend'in efektif limiti doğru göstermesi
         * MÜMKÜN DEĞİLDİ (kaynak veri eksikti). Artık hem plan
         * değerleri hem override'lar hem de COALESCE(override, plan)
         * ile hesaplanmış efektif değerler dönüyor; hangisinin
         * kullanılacağına frontend karar verir.
         */
        const result = await pool.query(`
            SELECT
                cl.id,
                cl.company_id,
                c.name AS company_name,
                c.code AS company_code,
                cl.plan_id,
                p.name AS plan_name,
                p.max_users,
                p.max_contracts,
                p.max_companies,
                cl.max_users_override,
                cl.max_contracts_override,
                cl.max_companies_override,
                COALESCE(cl.max_users_override, p.max_users) AS effective_max_users,
                COALESCE(cl.max_contracts_override, p.max_contracts) AS effective_max_contracts,
                COALESCE(cl.max_companies_override, p.max_companies) AS effective_max_companies,
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
                cl.max_users_override,
                COALESCE(cl.max_users_override, p.max_users) AS effective_max_users,
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
// 6. INFLATION INDICES (MANUAL ENTRY) — TFRS16 / TMS29 destek verisi
// ============================================================
//
// KAPSAM: Bu bölüm bağımsız bir "/api/tms29" ürünü DEĞİLDİR. TÜİK
// otomatik entegrasyonu bu release kapsamından çıkarıldığı için
// (bkz. PROJECT_CONTEXT.md), admin TÜİK'ten aldığı aylık TÜFE
// endekslerini burada elle girer. Yazılan veri, mevcut
// backend/services/tuik-index-service.js üzerinden AYNI
// inflation_indices tablosuna, aynı immutable/supersede modeliyle
// yazılır — TFRS16 hesaplama motoru (js/tfrs16.js) bu dosyadan
// tamamen habersizdir ve GET /api/inflation-indices (VERIFIED+aktif
// filtresiyle) üzerinden veri okumaya devam eder.
//
// Tüm endpoint'ler platform-level ADMIN gerektirir (requireAdmin) —
// normal kullanıcı manuel kayıt giremez/doğrulayamaz.

const {
    createManualIndexEntry,
    createBulkManualIndexEntries,
    verifyIndexRecord,
    rejectIndexRecord,
    listIndexRecords,
    BulkInputParseError
} = require('../services/tuik-index-service');

// GET /api/admin/inflation-indices?status=PENDING&months=2025-01,2025-02
router.get('/inflation-indices', requireAuth, requireAdmin, async (req, res) => {
    try {
        const status = req.query.status ? String(req.query.status).toUpperCase() : undefined;
        if (status && !['PENDING', 'VERIFIED', 'REJECTED'].includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Geçersiz status parametresi (PENDING, VERIFIED veya REJECTED bekleniyor).'
            });
        }

        const months = req.query.months
            ? String(req.query.months).split(',').map(s => s.trim()).filter(Boolean)
            : undefined;

        const records = await listIndexRecords({ status, months });

        return res.json({
            success: true,
            data: records.map(r => ({
                id: r.id,
                month: r.index_month,
                value: Number(r.index_value),
                source: r.source,
                verificationStatus: r.verification_status,
                retrievedBy: r.retrieved_by,
                verifiedBy: r.verified_by,
                verifiedAt: r.verified_at,
                createdAt: r.created_at
            }))
        });
    } catch (error) {
        console.error('Admin get inflation indices error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// POST /api/admin/inflation-indices  { month: "2026-07", value: 3500.25 }
// Tek kayıt oluşturur — her zaman PENDING olarak başlar.
router.post('/inflation-indices', requireAuth, requireAdmin, adminMutationRateLimiter, async (req, res) => {
    try {
        const fieldError = rejectUnknownFields(req.body, ['month', 'value']);
        if (fieldError) {
            return res.status(400).json({ success: false, error: fieldError });
        }

        const { month, value } = req.body || {};
        const actor = req.user.username || req.user.id;

        const result = await createManualIndexEntry({ month, value, actor });

        return res.status(201).json({
            success: true,
            data: {
                id: result.record.id,
                month: result.record.index_month,
                value: Number(result.record.index_value),
                verificationStatus: result.record.verification_status,
                action: result.action
            }
        });
    } catch (error) {
        if (error.code === 'INVALID_INFLATION_INDEX_INPUT') {
            return res.status(400).json({ success: false, error: error.message });
        }
        console.error('Admin create manual inflation index error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// POST /api/admin/inflation-indices/bulk  { text: "2025-01\t2648.12\n2025-02\t2701.34" }
// Toplu yapıştırma girişi — her satır "YYYY-MM <boşluk/tab> değer".
// TÜM satırlar geçerli değilse (format/duplicate) HİÇBİR şey yazılmaz;
// hatalı satırlar 400 ile birlikte tek tek raporlanır (sessizce
// atlanmaz, kullanıcı düzeltip tekrar dener).
router.post('/inflation-indices/bulk', requireAuth, requireAdmin, adminMutationRateLimiter, async (req, res) => {
    try {
        const fieldError = rejectUnknownFields(req.body, ['text']);
        if (fieldError) {
            return res.status(400).json({ success: false, error: fieldError });
        }

        const text = req.body && typeof req.body.text === 'string' ? req.body.text : '';
        if (!text.trim()) {
            return res.status(400).json({ success: false, error: 'text alanı zorunludur ve boş olamaz.' });
        }

        const actor = req.user.username || req.user.id;
        const result = await createBulkManualIndexEntries(text, actor);

        return res.status(201).json({ success: true, data: result });
    } catch (error) {
        if (error instanceof BulkInputParseError) {
            return res.status(400).json({
                success: false,
                error: error.message,
                invalid: error.invalid,
                duplicateMonthsInInput: error.duplicateMonthsInInput
            });
        }
        console.error('Admin bulk create manual inflation indices error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// PATCH /api/admin/inflation-indices/:id/verify
router.patch('/inflation-indices/:id/verify', requireAuth, requireAdmin, adminMutationRateLimiter, async (req, res) => {
    try {
        const actor = req.user.username || req.user.id;
        const record = await verifyIndexRecord({ id: req.params.id, actor });

        return res.json({
            success: true,
            data: {
                id: record.id,
                month: record.index_month,
                value: Number(record.index_value),
                verificationStatus: record.verification_status,
                verifiedBy: record.verified_by,
                verifiedAt: record.verified_at
            }
        });
    } catch (error) {
        if (error.code === 'INFLATION_INDEX_NOT_FOUND') {
            return res.status(404).json({ success: false, error: error.message });
        }
        if (error.code === 'INFLATION_INDEX_NOT_ACTIVE' || error.code === 'INFLATION_INDEX_NOT_PENDING') {
            return res.status(409).json({ success: false, error: error.message });
        }
        console.error('Admin verify inflation index error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// PATCH /api/admin/inflation-indices/:id/reject  { reason?: string }
router.patch('/inflation-indices/:id/reject', requireAuth, requireAdmin, adminMutationRateLimiter, async (req, res) => {
    try {
        const fieldError = rejectUnknownFields(req.body, ['reason']);
        if (fieldError) {
            return res.status(400).json({ success: false, error: fieldError });
        }

        const actor = req.user.username || req.user.id;
        const reason = req.body && typeof req.body.reason === 'string' ? req.body.reason : null;

        const record = await rejectIndexRecord({ id: req.params.id, actor, reason });

        return res.json({
            success: true,
            data: {
                id: record.id,
                month: record.index_month,
                value: Number(record.index_value),
                verificationStatus: record.verification_status,
                verifiedBy: record.verified_by,
                verifiedAt: record.verified_at
            }
        });
    } catch (error) {
        if (error.code === 'INFLATION_INDEX_NOT_FOUND') {
            return res.status(404).json({ success: false, error: error.message });
        }
        if (error.code === 'INFLATION_INDEX_NOT_ACTIVE' || error.code === 'INFLATION_INDEX_NOT_PENDING') {
            return res.status(409).json({ success: false, error: error.message });
        }
        console.error('Admin reject inflation index error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
});


// ============================================================
// EXPORT
// ============================================================

module.exports = router;
