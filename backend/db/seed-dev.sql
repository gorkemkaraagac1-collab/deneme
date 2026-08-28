-- ============================================================
-- DEV / TEST SEED DATA — SADECE LOCAL GELİŞTİRME İÇİN
-- ============================================================
--
-- !!! BU DOSYAYI PRODUCTION DEPLOY PIPELINE'INA DAHİL ETMEYİN !!!
--
-- Bu dosya, backend/db/init.sql içinden BİLİNÇLİ OLARAK ayrılmıştır
-- çünkü aşağıda bilinen (herkese açık, bu dosyada yazılı) bir
-- parolaya sahip bir ADMIN kullanıcısı oluşturulmaktadır. init.sql
-- her ortamda (yanlışlıkla production dahil) çalıştırılabilecek
-- şema dosyasıdır; bu seed verisi ise yalnızca:
--
--   - local geliştirme,
--   - CI / otomatik test (gerçek DB'ye karşı çalışan entegrasyon
--     testleri kullanılıyorsa)
--
-- ortamlarında, açıkça çağrılarak uygulanmalıdır, ör.:
--
--   psql "$DATABASE_URL" -f backend/db/init.sql
--   psql "$DATABASE_URL" -f backend/db/seed-dev.sql   # yalnızca dev/test
--
-- Kullanıcı:
--   admin
--
-- Şifre (yalnızca dev/test — production'da ASLA kullanılmamalı,
-- kullanıldıysa derhal döndürülmeli/silinmelidir):
--   Gk.135790
--
-- bcrypt hash (yukarıdaki parolaya ait):
--   $2b$10$edNdBIc0KpIrXXEumxx8sO..Q/l6HFwcCSdotM4aezzGRd0TBt9t6
--
-- NOT (DÜZELTME): Bu dosyada daha önce burada duran hash 29
-- karakterdi; geçerli bir bcrypt hash'i tam 60 karakter olmalıdır
-- ($2b$10$ + 22 karakter salt + 31 karakter hash). Eksik/bozuk hash
-- yüzünden bcrypt.compare() login sırasında exception fırlatıyor ve
-- bu da auth.js'teki catch bloğunu tetikleyerek kullanıcıya
-- "Giriş işlemi sırasında beklenmeyen bir hata oluştu" 500 hatası
-- olarak dönüyordu. Aşağıdaki hash tam ve doğrulanmış 60 karakterlik
-- bir bcrypt hash'idir.

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
    '$2b$10$edNdBIc0KpIrXXEumxx8sO..Q/l6HFwcCSdotM4aezzGRd0TBt9t6',
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
