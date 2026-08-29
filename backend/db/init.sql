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

-- DÜZELTME: Kullanıcılar için status=INACTIVE (pasifleştirme) yolu vardı
-- ama şirketler için hiçbir deaktivasyon mekanizması yoktu — bir müşteri
-- churn olduğunda ya da ödeme sorunu yaşandığında admin'in elinde şirketi
-- (ve dolayısıyla tüm kullanıcılarının erişimini) durdurabileceği bir yol
-- bulunmuyordu. IF NOT EXISTS kullanılıyor çünkü bu script, tablo zaten
-- var olan deploy edilmiş ortamlara karşı da (idempotent şekilde)
-- çalıştırılabilir olmalı.
ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_companies_status'
    ) THEN
        ALTER TABLE companies
            ADD CONSTRAINT chk_companies_status
                CHECK (status IN ('ACTIVE', 'INACTIVE'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_companies_status
    ON companies(status);

-- P0 — HOLDİNG HİYERARŞİSİ: companies.parent_company_id
--
-- Amaç: bir ACCOUNTANT_MANAGER'ın kendi ağacında (holding + alt
-- şirketler) alt şirket oluşturabilmesi ve lisansın ana şirkete
-- bağlanıp alt şirketlere miras kalması (bkz. company_licenses,
-- aşağıda). parent_company_id NULL ise şirket bir ANA şirkettir
-- (holding kökü veya tek başına düz müşteri — hiyerarşi zorunlu
-- değildir, mevcut tüm şirketler bu değişiklikten sonra da NULL
-- parent ile aynı şekilde çalışmaya devam eder).
--
-- ON DELETE RESTRICT: bir alt şirketi olan ana şirket, önce alt
-- şirketler taşınmadan/silinmeden silinemez (companies tablosunda
-- zaten gerçek bir DELETE yolu yok, sadece status=INACTIVE — bu
-- kısıt yine de ileride eklenebilecek bir DELETE yoluna karşı
-- güvenlik payı bırakır).
ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS parent_company_id VARCHAR(50)
        REFERENCES companies(id) ON DELETE RESTRICT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_companies_not_self_parent'
    ) THEN
        ALTER TABLE companies
            ADD CONSTRAINT chk_companies_not_self_parent
                CHECK (parent_company_id IS DISTINCT FROM id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_companies_parent_company_id
    ON companies(parent_company_id);


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

-- P2 — ZENGİN SÖZLEŞME VERİSİ (modifications/reassessments/SLB/
-- sublease/TMS29 enflasyon düzeltmesi/TMS21 fonksiyonel para birimi/
-- erken ödemeler).
--
-- SORUN: js/tfrs16.js hesap motoru bu alanları contract objesinin
-- üzerinde tutuyor (contract.modifications, contract.reassessments,
-- contract.saleAndLeaseback, contract.sublease,
-- contract.inflationAdjustments, contract.functionalCurrency,
-- contract.earlyPayments vb.) ama persistContractToApi() bunları
-- hiç backend'e göndermiyordu — yalnızca 9 temel alan (company,
-- supplier, monthlyPayment, ... vb.) senkronize oluyordu. Bu yüzden
-- bu zengin veri yalnızca localStorage'da yaşıyordu ve
-- hydrateContractsFromApi()'nin mapDbContractToUi() ile her sayfa
-- açılışında modifications/reassessments'i sıfıra hardcode etmesi
-- (bu ALTER'dan önceki davranış) sessiz veri kaybına yol açıyordu.
--
-- ÇÖZÜM: tek bir JSONB kolon. Motorun kendi alan adlarını/şeklini
-- şemaya taşımıyoruz (motora dokunulmuyor) — motorun ürettiği
-- objeyi olduğu gibi bu kolona serileştirip saklıyoruz. Yeni bir
-- alan grubu eklendiğinde (örn. motor yeni bir analiz türü
-- kazandığında) burada migration gerekmez.
ALTER TABLE contracts
    ADD COLUMN IF NOT EXISTS details JSONB NOT NULL DEFAULT '{}'::jsonb;


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

-- P0 — HOLDİNG/KULLANICI YÖNETİMİ PLANI: email, ad/soyad, ilk şifre
-- zorunluluğu.
--
-- ÖNEMLİ: email burada henüz login kimliği DEĞİL. username kolonu
-- ve auth.js/login akışı bu P0'da DEĞİŞTİRİLMİYOR (bkz. onaylanan
-- plan madde 6: "Login kimliği: EMAIL" geçişi, mevcut auth akışını
-- etkileyeceği için P1'e (JWT/erişim ağacı) bırakıldı — PROJECT_
-- CONTEXT.md'deki "minimal değişiklik / önce release" ilkesi
-- gereği bu fazda sadece şema hazırlanıyor, davranış değişmiyor).
--
-- email NULLABLE bırakıldı: mevcut kullanıcı satırlarının email'i
-- yok, geriye dönük dolduruncaya kadar NOT NULL yapılamaz. UNIQUE
-- kısıt kısmi index ile sadece dolu olan email'lerde uygulanıyor
-- (Postgres'te normal UNIQUE zaten birden fazla NULL'a izin verir,
-- ama niyet açık olsun diye WHERE email IS NOT NULL ile yazıldı).
--
-- must_change_password DEFAULT FALSE: mevcut kullanıcıları
-- zorla şifre değiştirmeye yönlendirmemek için. Yeni kullanıcı
-- oluşturma akışı (P1/P3, /api/org/users ve admin.js POST /users)
-- bu alanı INSERT sırasında açıkça TRUE geçecek.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS email VARCHAR(150),
    ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS last_name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_users_email_format'
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT chk_users_email_format
                CHECK (email IS NULL OR email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$');
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique
    ON users(LOWER(email))
    WHERE email IS NOT NULL;


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

-- DÜZELTME: Planlar için kullanıcı sayısı sınırı vardı (max_users)
-- ama sözleşme (kontrat) sayısı için hiçbir sınır yoktu — Starter
-- planındaki bir şirket de Enterprise ile aynı sayıda sözleşme
-- girebiliyordu. max_users ile birebir aynı NULL=sınırsız
-- kuralıyla max_contracts eklendi (bkz. services/license-service.js:
-- canAddContractToCompany, routes/contracts.js POST /).
-- IF NOT EXISTS/DO $$ kullanılıyor çünkü bu script zaten deploy
-- edilmiş ortamlara karşı da (idempotent şekilde) çalıştırılabilir
-- olmalı.
ALTER TABLE plans
    ADD COLUMN IF NOT EXISTS max_contracts INTEGER;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_plans_max_contracts'
    ) THEN
        ALTER TABLE plans
            ADD CONSTRAINT chk_plans_max_contracts
                CHECK (max_contracts IS NULL OR max_contracts > 0);
    END IF;
END $$;

-- P0 — HOLDİNG HİYERARŞİSİ: max_companies (ağaçtaki TOPLAM şirket,
-- ana dahil). max_users/max_contracts ile birebir aynı NULL=sınırsız
-- deseni izler; enforcement (P1/P3'te ağaç büyüklüğü sayımı) service
-- katmanında yapılacak, burada sadece limit değeri saklanıyor.
ALTER TABLE plans
    ADD COLUMN IF NOT EXISTS max_companies INTEGER;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_plans_max_companies'
    ) THEN
        ALTER TABLE plans
            ADD CONSTRAINT chk_plans_max_companies
                CHECK (max_companies IS NULL OR max_companies > 0);
    END IF;
END $$;


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

-- P0 — CUSTOM PLAN: per-lisans limit override.
--
-- plans tablosu paylaşımlı/sabit master veridir (Starter/Professional/
-- Enterprise satırları hâlâ tüm şirketler arasında ortak). Custom
-- planında ise her holding/anlaşma farklı limitlere sahip olabilir
-- ("Admin elle girer: max_companies, max_users, max_contracts" —
-- onaylanan plan madde 2). Bu yüzden limitler plans satırına değil,
-- BU lisans satırına (company_licenses) yazılır.
--
-- NULL = "plans tablosundaki değeri kullan" (mevcut Starter/
-- Professional/Enterprise lisansları için hiçbir davranış değişmez).
-- Dolu değer = bu lisansa özel override (Custom lisanslar için).
-- COALESCE(override, plan.değer) uygulaması license-service.js'te
-- P1'de yapılacak — bu fazda yalnızca şema hazırlanıyor.
ALTER TABLE company_licenses
    ADD COLUMN IF NOT EXISTS max_users_override INTEGER,
    ADD COLUMN IF NOT EXISTS max_contracts_override INTEGER,
    ADD COLUMN IF NOT EXISTS max_companies_override INTEGER;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_company_licenses_overrides_positive'
    ) THEN
        ALTER TABLE company_licenses
            ADD CONSTRAINT chk_company_licenses_overrides_positive
                CHECK (
                    (max_users_override IS NULL OR max_users_override > 0)
                    AND (max_contracts_override IS NULL OR max_contracts_override > 0)
                    AND (max_companies_override IS NULL OR max_companies_override > 0)
                );
    END IF;
END $$;


-- ============================================================
-- DEFAULT PLANS
-- ============================================================

INSERT INTO plans (
    id,
    name,
    max_users,
    max_contracts,
    description
)
VALUES
(
    'starter',
    'Starter',
    3,
    25,
    'Temel kullanım paketi'
),
(
    'professional',
    'Professional',
    10,
    150,
    'Profesyonel kullanım paketi'
),
(
    'enterprise',
    'Enterprise',
    NULL, -- sınırsız kullanıcı (bkz. license-service.js: NULL = unlimited)
    NULL, -- sınırsız sözleşme (bkz. license-service.js: NULL = unlimited)
    'Kurumsal kullanım paketi (sınırsız kullanıcı, sınırsız sözleşme)'
)
ON CONFLICT (id) DO NOTHING;

-- P0 — CUSTOM PLAN (holding / özel anlaşma)
--
-- Bu satırın kendi max_users/max_contracts/max_companies alanları
-- kasıtlı olarak NULL bırakılıyor (kolon default'u zaten NULL):
-- gerçek limitler plana değil, her holding için ayrı ayrı
-- company_licenses.*_override kolonlarına yazılır (yukarıya bkz.).
-- Bu INSERT script'te max_companies kolonunun eklendiği ALTER
-- TABLE'dan SONRA çalışır, dolayısıyla kolon her zaman mevcuttur.
INSERT INTO plans (
    id,
    name,
    max_users,
    max_contracts,
    description
)
VALUES
(
    'custom',
    'Custom',
    NULL,
    NULL,
    'Holding / özel anlaşma — limitler lisans bazında (company_licenses.*_override) tanımlanır'
)
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- INFLATION INDICES (TÜİK / TMS 29 — TFRS 16'nın enflasyon
-- düzeltmesi bileşeni için endeks veri altyapısı)
-- ============================================================
--
-- ÖNEMLİ — KAPSAM: Bu tablo BAĞIMSIZ bir "TMS 29 ürünü" DEĞİLDİR.
-- Yalnızca js/tfrs16.js içindeki mevcut TMS 29 restatement
-- motorunun (getInflationIndex/getInflationRatio/
-- applyTMS29Restatement — bu tablodan HABERSİZ, davranışı
-- değişmeyen fonksiyonlar) ihtiyaç duyduğu aylık endeks
-- değerlerini, önceden manuel girilen localStorage verisi yerine,
-- doğrulanabilir/audit edilebilir bir kaynaktan sağlamak için
-- vardır. company_id İÇERMEZ (bilinçli): endeks verisi şirkete
-- özel değil, ulusal/genel bir referans veridir; erişim TFRS 16
-- lisans entitlement'ı seviyesinde kontrol edilir (bkz.
-- routes/inflation-indices.js), tenant izolasyonu bu tabloda
-- anlamsızdır.
--
-- IMMUTABLE TASARIM: Bir ay için endeks değeri sonradan
-- değişirse (TÜİK revize eder veya manuel override yapılırsa),
-- mevcut satır ASLA UPDATE edilmez. Yerine yeni bir satır
-- eklenir ve eski satırın superseded_by alanı yeni satırın id'sine
-- bağlanır. Böylece geçmişte hangi değerin ne zaman "aktif" kabul
-- edildiği tam olarak izlenebilir kalır (audit trail).
--
-- "Aktif" (geçerli) kayıt her zaman superseded_by IS NULL olandır.
-- Hesaplamada kullanılabilmesi için AYRICA
-- verification_status = 'VERIFIED' olması şarttır — PENDING/REJECTED
-- kayıtlar hesaplamaya asla girmez (bkz. routes/inflation-indices.js
-- GET handler'ındaki WHERE koşulu).

CREATE TABLE IF NOT EXISTS inflation_indices (
    id BIGSERIAL PRIMARY KEY,

    -- Şu an tek bir seri (TÜFE genel) kullanılıyor, ancak ileride
    -- farklı endeks serileri (ör. Yİ-ÜFE) ayrışabilsin diye alan
    -- şimdiden ayrılıyor. Sabit bir değerle başlatılabilir
    -- (ör. 'TUFE_GENEL') — gereksiz bir "index_series" master
    -- tablosu bu aşamada eklenmedi (fazla soyutlama).
    index_type VARCHAR(30) NOT NULL,

    -- getInflationIndex()/getInflationRatio() ile birebir uyumlu
    -- format: 'YYYY-MM'. DB seviyesinde de zorunlu kılınır —
    -- frontend/backend validasyonu atlanırsa dahi bozuk formatta
    -- satır oluşamaz.
    index_month VARCHAR(7) NOT NULL,

    CONSTRAINT chk_inflation_index_month_format
        CHECK (index_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),

    index_value DECIMAL(15,4) NOT NULL,

    CONSTRAINT chk_inflation_index_value_positive
        CHECK (index_value > 0),

    -- 'TUIK_AUTO': otomatik TÜİK senkronizasyonundan gelen kayıt.
    -- 'MANUAL_OVERRIDE': bir admin tarafından elle girilmiş kayıt.
    source VARCHAR(20) NOT NULL,

    CONSTRAINT chk_inflation_index_source
        CHECK (source IN ('TUIK_AUTO', 'MANUAL_OVERRIDE')),

    source_url TEXT,

    retrieved_at TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Otomatik senkronizasyonda NULL kalır (sistem tarafından
    -- çekilmiştir); manuel override'da işlemi yapan kullanıcının
    -- id'sini taşır.
    retrieved_by VARCHAR(50),

    verified_at TIMESTAMP,
    verified_by VARCHAR(50),

    verification_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',

    CONSTRAINT chk_inflation_index_verification_status
        CHECK (verification_status IN ('PENDING', 'VERIFIED', 'REJECTED')),

    -- Bu satırın yerini alan (superseding) yeni satırın id'si.
    -- NULL => bu satır hâlâ "aktif" kayıttır. Kendi tablosuna
    -- referans verdiği için tablo oluşturulduktan SONRA
    -- eklenmesi gerekir (aşağıdaki ALTER TABLE).
    superseded_by BIGINT,

    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- superseded_by, aynı tabloya (kendine) referans verdiği için
-- CREATE TABLE içinde REFERENCES ile tanımlanmadı — Postgres
-- bunu destekler ama okunabilirlik açısından ayrı bir ALTER TABLE
-- ile eklemek, "bu FK kendine referans veriyor" niyetini daha
-- açık kılıyor.
ALTER TABLE inflation_indices
    ADD CONSTRAINT fk_inflation_indices_superseded_by
        FOREIGN KEY (superseded_by)
        REFERENCES inflation_indices(id);

-- KRİTİK CONSTRAINT: aynı index_type + index_month için yalnızca
-- TEK bir "aktif" (superseded_by IS NULL) kayıt bulunabilir.
-- Bu, normal bir UNIQUE constraint DEĞİL, PARTIAL UNIQUE INDEX'tir
-- (WHERE superseded_by IS NULL) — çünkü aynı ay için birden fazla
-- superseded (eski/audit) kayıt bilerek tutulur; yasaklanan yalnızca
-- aynı anda birden fazla "aktif" kayıt olmasıdır.
CREATE UNIQUE INDEX IF NOT EXISTS idx_inflation_indices_active_unique
    ON inflation_indices(index_type, index_month)
    WHERE superseded_by IS NULL;

CREATE INDEX IF NOT EXISTS idx_inflation_indices_month
    ON inflation_indices(index_month);

CREATE INDEX IF NOT EXISTS idx_inflation_indices_verification_status
    ON inflation_indices(verification_status);


-- ============================================================
-- GÜVENLİK NOTU — TEST/DEMO VERİSİ BU DOSYADAN KALDIRILDI
-- ============================================================
--
-- Önceden burada, bilinen bir parolaya ("Admin123!") sahip bir
-- test ADMIN kullanıcısı (username: admin) KOŞULSUZ olarak her
-- init.sql çalıştırmasında (dolayısıyla yanlışlıkla production
-- veritabanına karşı da) oluşturuluyordu. Bilinen/varsayılan
-- kimlik bilgileriyle bir ADMIN hesabının otomatik olarak
-- oluşturulması, production ortamında ciddi bir yetkisiz erişim
-- riskidir (OWASP A07 — Kimlik Doğrulama Hataları / varsayılan
-- kimlik bilgileri).
--
-- Bu veri artık ayrı bir dosyada tutuluyor:
--
--   backend/db/seed-dev.sql
--
-- init.sql YALNIZCA şemayı ve gerçek iş verisi olan planları
-- (plans) içerir. seed-dev.sql ise BİLİNÇLİ OLARAK ayrı çalıştırılır
-- ve yalnızca local geliştirme / otomatik test ortamlarında
-- uygulanmalıdır — production deploy pipeline'ına dahil
-- edilmemelidir.
