-- ============================================================
-- TFRS 16 BACKEND DATABASE SCHEMA
-- ============================================================

-- ============================================================
-- COMPANIES
-- ============================================================

CREATE TABLE IF NOT EXISTS companies (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);


-- ============================================================
-- CONTRACTS
-- ============================================================

CREATE TABLE IF NOT EXISTS contracts (
    id VARCHAR(50) PRIMARY KEY,

    company_id VARCHAR(50)
        NOT NULL
        REFERENCES companies(id),

    company VARCHAR(100) NOT NULL,
    supplier VARCHAR(100) NOT NULL,

    monthly_payment DECIMAL(15,2) NOT NULL,

    start_date DATE NOT NULL,
    end_date DATE NOT NULL,

    discount_rate DECIMAL(5,2) DEFAULT 0,

    currency VARCHAR(3) DEFAULT 'TRY',

    status VARCHAR(20) DEFAULT 'active',

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contracts_company
    ON contracts(company_id);

CREATE INDEX IF NOT EXISTS idx_contracts_status
    ON contracts(status);

CREATE INDEX IF NOT EXISTS idx_contracts_end_date
    ON contracts(end_date);


-- ============================================================
-- AUDIT EVENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_events (
    id VARCHAR(50) PRIMARY KEY,

    timestamp TIMESTAMP DEFAULT NOW(),

    actor VARCHAR(100) DEFAULT 'system',

    action VARCHAR(50) NOT NULL,

    entity_type VARCHAR(50) NOT NULL,

    entity_id VARCHAR(50),

    contract_id VARCHAR(50)
        REFERENCES contracts(id)
        ON DELETE SET NULL,

    old_value JSONB,

    new_value JSONB,

    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_audit_contract
    ON audit_events(contract_id);

CREATE INDEX IF NOT EXISTS idx_audit_timestamp
    ON audit_events(timestamp);


-- ============================================================
-- USERS
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,

    username VARCHAR(50)
        UNIQUE
        NOT NULL,

    password_hash VARCHAR(255)
        NOT NULL,

    role VARCHAR(20)
        DEFAULT 'VIEWER',

    status VARCHAR(20)
        DEFAULT 'ACTIVE',

    created_at TIMESTAMP DEFAULT NOW()
);


-- ============================================================
-- USER ↔ COMPANY
-- ============================================================

CREATE TABLE IF NOT EXISTS user_companies (
    user_id VARCHAR(50)
        REFERENCES users(id)
        ON DELETE CASCADE,

    company_id VARCHAR(50)
        REFERENCES companies(id)
        ON DELETE CASCADE,

    PRIMARY KEY (user_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_user_companies_user
    ON user_companies(user_id);


-- ============================================================
-- PLANS
-- ============================================================

CREATE TABLE IF NOT EXISTS plans (
    id VARCHAR(50) PRIMARY KEY,

    name VARCHAR(100)
        NOT NULL
        UNIQUE,

    -- max_users = NULL => sınırsız kullanıcı (Enterprise planı).
    -- Bu yüzden NOT NULL constraint'i KALDIRILDI: Enterprise
    -- gerçek anlamda sınırsız kullanıcı kabul edilir ve bu satırda
    -- bir sayı yerine NULL saklanır. Diğer tüm planlar (Starter,
    -- Professional, vb.) pozitif bir tam sayı taşımaya devam eder.
    max_users INTEGER,

    description TEXT,

    created_at TIMESTAMP DEFAULT NOW(),

    -- NULL => sınırsız (izinli). NULL olmayan değerler için > 0
    -- zorunlu kılınır. NOT: SQL'de "max_users > 0" ifadesi
    -- max_users NULL olduğunda NULL'a değerlenir ve CHECK
    -- constraint'leri NULL sonucunu otomatik olarak "geçti" sayar;
    -- yine de niyeti kod okuyan için açık bırakmak adına NULL
    -- durumu burada ayrıca belirtiliyor.
    CONSTRAINT chk_plans_max_users
        CHECK (max_users IS NULL OR max_users > 0)
);


-- ============================================================
-- COMPANY LICENSES
-- ============================================================

CREATE TABLE IF NOT EXISTS company_licenses (
    id VARCHAR(50) PRIMARY KEY,

    company_id VARCHAR(50)
        NOT NULL
        REFERENCES companies(id)
        ON DELETE CASCADE,

    plan_id VARCHAR(50)
        NOT NULL
        REFERENCES plans(id),

    starts_at TIMESTAMP
        NOT NULL,

    expires_at TIMESTAMP
        NULL,

    status VARCHAR(20)
        NOT NULL
        DEFAULT 'active',

    created_at TIMESTAMP
        DEFAULT NOW(),

    CONSTRAINT chk_company_license_status
        CHECK (
            status IN (
                'active',
                'expired',
                'cancelled'
            )
        )
);

CREATE INDEX IF NOT EXISTS idx_company_licenses_company
    ON company_licenses(company_id);

CREATE INDEX IF NOT EXISTS idx_company_licenses_status
    ON company_licenses(status);

CREATE INDEX IF NOT EXISTS idx_company_licenses_expires
    ON company_licenses(expires_at);

-- Aynı şirket için aynı anda birden fazla 'active' lisans satırı
-- oluşmasını DATABASE seviyesinde engeller. admin-licenses.js zaten
-- yeni lisans eklerken eskisini 'cancelled' yapıyor (application-level),
-- ancak bu index olmadan bu kural yalnızca o tek code path'e bağımlı
-- kalır (ör. ileride eklenecek başka bir insert yolu, manuel bir SQL
-- veya bir race condition bu korumayı atlayabilir). Partial index
-- olduğu için expired/cancelled geçmiş kayıtları etkilemez, sadece
-- status = 'active' olan satırlar için company_id tekilliğini zorunlu
-- kılar.
CREATE UNIQUE INDEX IF NOT EXISTS idx_company_licenses_one_active_per_company
    ON company_licenses(company_id)
    WHERE status = 'active';


-- ============================================================
-- DEFAULT PLANS
-- ============================================================

INSERT INTO plans (
    id,
    name,
    max_users,
    description
)
VALUES
(
    'starter',
    'Starter',
    3,
    'Temel kullanım paketi'
),
(
    'professional',
    'Professional',
    10,
    'Profesyonel kullanım paketi'
),
(
    'enterprise',
    'Enterprise',
    NULL, -- sınırsız kullanıcı (bkz. license-service.js: NULL = unlimited)
    'Kurumsal kullanım paketi (sınırsız kullanıcı)'
)
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- TEST COMPANY
-- ============================================================

INSERT INTO companies (
    id,
    name,
    code
)
VALUES (
    'TEST-COMPANY-001',
    'Test Şirketi',
    'TEST001'
)
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- TEST ADMIN USER
-- ============================================================
--
-- Kullanıcı:
-- admin
--
-- Şifre:
-- Admin123!
--
-- bcrypt hash:
-- $2b$10$7EqJtq98hPqEX7fNZaFWoO
--
-- NOT:
-- Bu hash sadece geliştirme/test amacıyla kullanılmalıdır.
--

INSERT INTO users (
    id,
    username,
    password_hash,
    role,
    status
)
VALUES (
    'TEST-ADMIN-001',
    'admin',
    '$2b$10$7EqJtq98hPqEX7fNZaFWoO',
    'ADMIN',
    'ACTIVE'
)
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- TEST USER ↔ TEST COMPANY
-- ============================================================

INSERT INTO user_companies (
    user_id,
    company_id
)
VALUES (
    'TEST-ADMIN-001',
    'TEST-COMPANY-001'
)
ON CONFLICT (user_id, company_id) DO NOTHING;


-- ============================================================
-- TEST COMPANY LICENSE
-- ============================================================

INSERT INTO company_licenses (
    id,
    company_id,
    plan_id,
    starts_at,
    expires_at,
    status
)
VALUES (
    'TEST-LICENSE-001',
    'TEST-COMPANY-001',
    'professional',
    NOW(),
    NOW() + INTERVAL '1 year',
    'active'
)
ON CONFLICT (id) DO NOTHING;
