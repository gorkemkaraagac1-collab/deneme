-- backend/db/init.sql
-- TFRS 16 backend şeması (boilerplate). Frontend'deki V21 kullanıcı/
-- şirket modeliyle (getV21User, getCurrentUserCompanies, vb.) alan
-- adları hizalı tutulmuştur; gerçek geçişte bire bir eşlenebilir.

CREATE TABLE IF NOT EXISTS companies (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contracts (
    id VARCHAR(50) PRIMARY KEY,
    -- NOT NULL: veri izolasyonu company_id filtresine dayanıyor —
    -- şirketsiz bir kontrat hiçbir kullanıcıya görünmez (kimseye
    -- gösterilemeyen "yetim" kayıt olurdu), bu yüzden zorunlu.
    company_id VARCHAR(50) NOT NULL REFERENCES companies(id),
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

CREATE INDEX IF NOT EXISTS idx_contracts_company ON contracts(company_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_end_date ON contracts(end_date);

CREATE TABLE IF NOT EXISTS audit_events (
    id VARCHAR(50) PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT NOW(),
    actor VARCHAR(100) DEFAULT 'system',
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(50),
    contract_id VARCHAR(50) REFERENCES contracts(id) ON DELETE SET NULL,
    old_value JSONB,
    new_value JSONB,
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_audit_contract ON audit_events(contract_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_events(timestamp);

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'VIEWER',
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Bir kullanıcının hangi şirket(ler)e erişebildiğinin TEK doğruluk
-- kaynağı burasıdır (V21 companyIds dizisiyle uyumlu çoktan-çoğa
-- ilişki). auth.js/login bu tablodan okur, JWT'ye bu listeyi gömer;
-- tüm route'lardaki company_id = ANY(...) filtreleri buradan gelir.
-- ADMIN rolü dahil hiçbir kullanıcı için otomatik "tüm şirketleri gör"
-- istisnası YOKTUR — admin'e erişim vermek isteniyorsa, admin'in id'si
-- bu tabloya istenen her company_id için ayrı ayrı eklenmelidir.
CREATE TABLE IF NOT EXISTS user_companies (
    user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
    company_id VARCHAR(50) REFERENCES companies(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, company_id)
);
CREATE INDEX IF NOT EXISTS idx_user_companies_user ON user_companies(user_id);

-- ==========================================================
-- TMS 29 — ENFLASYON ENDEKS TABLOSU
-- ==========================================================

CREATE TABLE IF NOT EXISTS tms29_indices (
    id VARCHAR(50) PRIMARY KEY,
    index_type VARCHAR(30) NOT NULL DEFAULT 'CPI',
    index_month VARCHAR(7) NOT NULL,
    index_value DECIMAL(18,6) NOT NULL,
    source VARCHAR(100) NOT NULL DEFAULT 'TÜİK',
    source_url TEXT,
    retrieved_at TIMESTAMP,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_by VARCHAR(50),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_tms29_index_value
        CHECK (index_value > 0),

    CONSTRAINT chk_tms29_index_month
        CHECK (index_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);

CREATE UNIQUE INDEX IF NOT EXISTS
    idx_tms29_indices_type_month
ON tms29_indices(index_type, index_month);

CREATE INDEX IF NOT EXISTS
    idx_tms29_indices_month
ON tms29_indices(index_month);

CREATE INDEX IF NOT EXISTS
    idx_tms29_indices_verified
ON tms29_indices(is_verified);

