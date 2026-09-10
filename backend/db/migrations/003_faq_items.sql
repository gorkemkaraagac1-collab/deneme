-- FAQ (Sık Sorulanlar) yönetimi için tablo + başlangıç verisi.
-- index.html'deki statik SSS bölümünü admin panelden (frontend/admin/faq.html)
-- yönetilebilir hale getirir. Idempotent: init.sql ile birebir aynı DDL/seed,
-- var olan kayıtların üzerine yazmaz (ON CONFLICT DO NOTHING).


-- ============================================================
-- FAQ ITEMS (Marketing sitesi — index.html "Sık sorulanlar")
-- ============================================================
-- Admin panelinden (frontend/admin/faq.html) yönetilir: ekleme,
-- düzenleme, silme ve sıralama. is_published=false olan kayıtlar
-- admin panelde görünür ama public /api/faq listesine dahil edilmez
-- (taslak/yayından kaldırma amaçlı).
CREATE TABLE IF NOT EXISTS faq_items (
    id VARCHAR(50) PRIMARY KEY,

    question TEXT NOT NULL,
    answer TEXT NOT NULL,

    -- Küçük sayı = üstte gösterilir. Admin panelden yukarı/aşağı
    -- taşıma bu alanı günceller.
    sort_order INTEGER NOT NULL DEFAULT 0,

    is_published BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_faq_sort_order CHECK (sort_order >= 0)
);

CREATE INDEX IF NOT EXISTS idx_faq_items_published_sort
    ON faq_items(is_published, sort_order);

-- Başlangıç verisi: index.html'de daha önce gömülü olan 4 soru +
-- IFRS 16/lease accounting yazınından modüle uyarlanan 6 yeni soru.
-- ON CONFLICT DO NOTHING => bu script daha önce çalıştırılmış bir
-- ortamda tekrar çalıştırıldığında admin panelden yapılan
-- düzenlemelerin/silmelerin üzerine YAZMAZ.
INSERT INTO faq_items (id, question, answer, sort_order, is_published)
VALUES
(
    'faq-login',
    'Dashboard’a nasıl girerim?',
    'Sağ üstten veya “Dashboard''a Gir” ile <strong>login.html</strong> açılır. Başarılı girişten sonra uygulama (<code>tfrs16.html</code>) yüklenir.',
    10,
    TRUE
),
(
    'faq-standards',
    'Hangi standartlar kapsanıyor?',
    'TFRS 16, TMS 29 ve TMS 21 — aynı sözleşme üzerinde birlikte çalışacak şekilde tasarlandı.',
    20,
    TRUE
),
(
    'faq-lease-classification',
    'TFRS 16''da faaliyet kiralaması / finansal kiralama ayrımı var mı?',
    'Hayır. TFRS 16 ile kiracı tarafında bu ayrım kaldırıldı; kiracının tüm kiralamaları tek bir modelle, bilançoda kullanım hakkı (ROU) varlığı ve kira yükümlülüğü olarak muhasebeleştirilir. Sistem sözleşmeleri bu tek model üzerinden hesaplar.',
    30,
    TRUE
),
(
    'faq-rou-calculation',
    'ROU (kullanım hakkı) varlığı ve kira yükümlülüğü nasıl hesaplanıyor?',
    'Kira yükümlülüğü, kalan kira ödemelerinin bugünkü değeri olarak hesaplanır ve etkin faiz yöntemiyle itfa edilir. ROU varlığı ise başlangıçtaki yükümlülük tutarına gerekli düzeltmeler (peşin ödemeler, doğrudan maliyetler, teşvikler vb.) eklenip çıkarılarak bulunur ve kira süresi ile varlığın faydalı ömründen kısa olanı üzerinden doğrusal olarak amortismana tabi tutulur.',
    40,
    TRUE
),
(
    'faq-multi-company',
    'Çoklu şirket destekleniyor mu?',
    'Evet. Oturum şirketleri, holding ağacı ve aktif şirket filtresi ürün içinde yer alır.',
    50,
    TRUE
),
(
    'faq-short-term-low-value',
    'Kısa vadeli veya düşük değerli kiralamalar sisteme nasıl işleniyor?',
    'TFRS 16.5-6 kapsamındaki muafiyetler desteklenir: bir sözleşme kısa vadeli ve/veya düşük değerli varlık olarak işaretlendiğinde, ROU varlığı/kira yükümlülüğü tanınmaz; sistem bu sözleşmeleri otomatik olarak istisna kapsamında (doğrusal gider) işler.',
    60,
    TRUE
),
(
    'faq-disclosures',
    'Sistem hangi dipnot (disclosure) bilgilerini üretiyor?',
    'ROU varlığının defter değeri, dönem amortisman gideri, kira yükümlülüğüne ilişkin faiz gideri ve yükümlülüklerin vade analizi gibi TFRS 16 kapsamındaki temel niceliksel dipnot kalemleri raporlanır.',
    70,
    TRUE
),
(
    'faq-locked-period',
    'Kilitli dönemde ne olur?',
    'Yeni sözleşme, silme, modifikasyon, reassessment ve toplu yevmiye gibi yazma işlemleri engellenir.',
    80,
    TRUE
),
(
    'faq-contract-limits',
    'Kaç sözleşmeye kadar kullanabilirim?',
    'Paket bazlıdır: Starter 25 sözleşmeye, Professional 250 sözleşmeye kadar destekler; Enterprise''da sözleşme sayısı sınırsızdır. Güncel paket detayları fiyatlandırma sayfasında yer alır.',
    90,
    TRUE
),
(
    'faq-erp-export',
    'Excel ve ERP sistemine veri aktarımı mümkün mü?',
    'Evet. Sözleşmeler Excel''den toplu yüklenebilir; hesaplama sonuçları ve yevmiye kayıtları CSV/Excel olarak dışa aktarılıp mevcut ERP veya muhasebe sisteminize aktarılabilir.',
    100,
    TRUE
)
ON CONFLICT (id) DO NOTHING;
