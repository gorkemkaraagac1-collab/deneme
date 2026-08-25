# FINANCIAL INTELLIGENCE PLATFORM
# PROJECT CONTEXT — MASTER

> Bu dosya projenin teknik ve ticari hafızasıdır.
> Geliştirme öncesinde okunmalıdır.
> Bu dosyadaki mimari kararlar kullanıcı tarafından bilinçli olarak alınmıştır.
> Kullanıcı açıkça değiştirmedikçe bu kararlar korunmalıdır.

---

# 1. ANA TİCARİ HEDEF

Bu projenin ilk ve en önemli hedefi:

**TFRS 16 modülünü production-ready hale getirmek, RELEASE etmek, müşterilere satmak ve gelir üretmeye başlamaktır.**

Öncelik sırası:

**TFRS 16 → Production → Release → Satış → Gelir → Sonra diğer modüller**

TFRS 16 release edilmeden:

- TMS 19
- standalone TMS 29
- DCF
- Hedge Accounting
- diğer yeni finansal modüller

gereksiz şekilde geliştirilmeyecektir.

Amaç aynı anda bütün platformu tamamlamak değil, önce **satılabilir ilk finansal ürünü** piyasaya çıkarmaktır.

---

# 2. TFRS 16 ANA ÜRÜNDÜR

TFRS 16 mevcut çalışan ana finansal hesaplama motorudur.

TFRS 16'nın lisans/entitlement yapısı **zaten oluşturulmuştur**.

Yeni bir TFRS 16 lisansı veya gereksiz yeni entitlement modeli oluşturulmayacaktır.

Mevcut lisans sistemi korunacak ve production'da gerçekten enforce edildiği doğrulanacaktır.

---

# 3. TÜİK ENDEKS ENTEGRASYONUNUN KAPSAMI

ÇOK ÖNEMLİ:

TÜİK endeks entegrasyonu **standalone TMS 29 ürünü değildir.**

Tek amacı:

**TFRS 16 içindeki mevcut TMS 29 restatement motorunu resmi TÜİK endeks verisiyle beslemektir.**

Bu nedenle:

- yeni TMS 29 ürünü oluşturulmaz
- yeni TMS 29 lisansı oluşturulmaz
- `/api/tms29` oluşturulmaz
- TMS 29 dashboard oluşturulmaz
- standalone TMS 29 raporu oluşturulmaz
- `tms29.html` bu çalışmaya dahil edilmez
- mevcut standalone TMS 29 modülü refactor edilmez

TÜİK altyapısı yalnızca TFRS 16'nın veri kaynağıdır.

---

# 4. TÜİK → TFRS 16 VERİ AKIŞI

Kabul edilen mimari:

TÜİK
↓
Backend Service
↓
Validation
↓
PostgreSQL
↓
API
↓
TFRS 16 Cache
↓
getInflationIndex()
↓
getInflationRatio()
↓
applyTMS29Restatement()

Bu mimari korunacaktır.

---

# 5. DEĞİŞTİRİLMEYECEK TFRS 16 FONKSİYONLARI

Aşağıdaki fonksiyonlar mevcut finansal hesaplama motorunun parçasıdır:

- `getInflationIndex()`
- `getInflationRatio()`
- `applyTMS29Restatement()`
- `validateInflationAdjustment()`
- `createInflationAdjustment()`
- `applyInflationAdjustment()`
- `cancelInflationAdjustment()`
- `generateInflationAdjustmentJournal()`
- `getReassessmentBaseSchedule()`

Bu fonksiyonlar:

- değiştirilmeyecek
- async yapılmayacak
- Promise döndürmeyecek
- hesaplama mantığı değiştirilmeyecek
- database logic içine alınmayacak
- authentication logic içine alınmayacak
- network request yapmayacak

TFRS 16 hesaplama motoru korunacaktır.

Backend ile frontend arasındaki adapter noktası:

`loadInflationIndexTable()`

olacaktır.

---

# 6. TÜİK BACKEND DOSYALARI

Mevcut TÜİK altyapısında:

```text
backend/
├── utils/
│   └── index-validation.js
│
├── services/
│   └── tuik-index-service.js
│
└── routes/
    └── inflation-indices.js
