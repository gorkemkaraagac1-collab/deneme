-- Period close kontrolü için şirket + dönem kilidi.
-- Dönem YYYY-MM formatında tutulur; silme/açma işlemleri ayrıca audit edilmelidir.
CREATE TABLE IF NOT EXISTS closed_periods (
    id VARCHAR(50) PRIMARY KEY,
    company_id VARCHAR(50) NOT NULL,
    period_key CHAR(7) NOT NULL,
    closed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    closed_by VARCHAR(100) NOT NULL,
    reopened_at TIMESTAMP,
    reopened_by VARCHAR(100),
    CONSTRAINT uq_closed_period_company_period UNIQUE (company_id, period_key),
    CONSTRAINT chk_closed_period_key CHECK (period_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);
CREATE INDEX IF NOT EXISTS idx_closed_periods_company_period
    ON closed_periods(company_id, period_key);
