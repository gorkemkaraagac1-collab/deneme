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

    max_users INTEGER
        NOT NULL,

    description TEXT,

    created_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT chk_plans_max_users
        CHECK (max_users > 0)
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
    100,
    'Kurumsal kullanım paketi'
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
