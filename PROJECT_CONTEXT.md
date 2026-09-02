# PROJECT CONTEXT — FINANCIAL INTELLIGENCE PLATFORM

## 1. PROJECT PURPOSE

Bu repository bir Financial Intelligence Platform / Financial SaaS projesidir.

Ana ticari amaç:

> TFRS 16 modülünü production-ready hale getirmek, release etmek, ilk müşterilere satmak ve gelir üretmeye başlamak.

Stratejik sıra:

TFRS16
→ Production
→ Release
→ İlk Satış
→ Gelir
→ Sonraki Modüller

Bu nedenle TFRS16 release edilmeden unrelated modüllere veya gereksiz teknik geliştirmelere scope genişletilmemelidir.

---

# 2. CURRENT PRIMARY PRODUCT

## TFRS 16

İlk release edilecek ve satılacak ürün TFRS 16'dır.

TFRS16'nın mevcut product license / entitlement sistemi zaten bulunmaktadır.

Yeni bir TFRS16 lisans sistemi oluşturulmayacaktır.

Mevcut:

Authentication
→ Authorization
→ Company/Tenant Access
→ Product Entitlement
→ Operation

zinciri korunacaktır.

---

# 3. CRITICAL TÜİK SCOPE DECISION

TÜİK endeks entegrasyonu standalone TMS 29 ürünü değildir.

TÜİK entegrasyonunun tek amacı:

> TFRS16 içerisindeki mevcut TMS29 restatement hesaplama motoruna güvenilir endeks verisi sağlamaktır.

Mimari:

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
TFRS16 Cache
↓
loadInflationIndexTable()
↓
getInflationIndex()
↓
getInflationRatio()
↓
applyTMS29Restatement()

TÜİK entegrasyonu TFRS16'nın bir alt veri kaynağı / destek fonksiyonudur.

Standalone TMS29 ürünü değildir.

---

# 4. STRICTLY OUT OF SCOPE

TFRS16 production release edilmeden aşağıdakiler yapılmayacaktır:

- /api/tms29 oluşturmak
- standalone TMS29 API geliştirmek
- standalone TMS29 dashboard geliştirmek
- TMS29 için yeni license / entitlement oluşturmak
- mevcut TMS29 ürününü yeniden tasarlamak
- TMS19 production geliştirmek
- DCF production geliştirmek
- Hedge Accounting production geliştirmek
- unrelated dashboard geliştirmek
- gereksiz refactor yapmak
- mevcut çalışan finansal motorları yeniden yazmak

Özellikle:

TÜİK index functionality ≠ TMS29 standalone product.

TÜİK index functionality TFRS16'nın TMS29 restatement veri kaynağıdır.

---

# 5. TFRS16 CALCULATION ENGINE — DO NOT CHANGE

Aşağıdaki fonksiyonların iş mantığı değiştirilmemelidir:

- getInflationIndex()
- getInflationRatio()
- applyTMS29Restatement()
- validateInflationAdjustment()
- createInflationAdjustment()
- applyInflationAdjustment()
- cancelInflationAdjustment()
- generateInflationAdjustmentJournal()
- getReassessmentBaseSchedule()

Bu fonksiyonlar:

- synchronous kalmalıdır
- async yapılmamalıdır
- Promise döndürmemelidir
- DB/network/persistence logic içermemelidir
- mevcut hesaplama davranışı korunmalıdır

TFRS16 motoruna veri sağlama entegrasyon noktası:

loadInflationIndexTable()

Bu fonksiyon backend cache entegrasyonu için kullanılabilir.

Ancak hesaplama motorunun synchronous contract'ı değiştirilmemelidir.

---

# 6. FINANCIAL DATA PRINCIPLE

Finansal veri akışı:

DATA SOURCE
→ VALIDATION
→ CALCULATION
→ CONTROL
→ AUDIT

Aşağıdakiler kesinlikle yasaktır:

- fake financial data
- mock data in production
- silent fallback
- interpolation
- estimation
- unknown index
- default index value
- missing value ile hesaplama

Eksik veya güvenilir olmayan endeks varsa sistem açık ve anlamlı hata üretmelidir.

---

# 7. TÜİK INDEX DATA MODEL

PostgreSQL tablosu:

inflation_indices

Endeks ulusal/genel referans veri olduğu için:

company_id YOKTUR.

Finansal referans veriler immutable/supersede mantığıyla tutulur.

Aynı ayın değeri değişirse:

Original Record
↓
Superseded
↓
New Record

Eski kayıt overwrite edilmez.

Yeni kayıt oluşturulur.

superseded_by ile ilişki kurulmalıdır.

TFRS16 API yalnızca:

verification_status = VERIFIED
AND
superseded_by IS NULL

kayıtlarını servis etmelidir.

PENDING ve REJECTED kayıtlar hiçbir şekilde TFRS16 hesaplamasına girmemelidir.

---

# 8. TÜİK DATA GOVERNANCE

TÜİK kaynaklı kayıtlar:

PENDING

olarak başlamalıdır.

Yetkili kullanıcı/admin tarafından doğrulanmadan:

VERIFIED

olamaz.

Beklenen akış:

TÜİK Sync
↓
PENDING
↓
Validation
↓
Admin / Authorized Review
↓
VERIFIED
↓
TFRS16 API
↓
TFRS16 Calculation

PENDING → VERIFIED workflow production release için tamamlanmalıdır.

---

# 9. TÜİK SOURCE

Gerçek TÜİK endpoint'i production/network erişimi olan ortamda doğrulanmalıdır.

Response shape tahmin edilmemelidir.

Varsayılan veya sahte response kullanılmamalıdır.

TUIK_INDEX_SOURCE_URL production configuration üzerinden sağlanmalıdır.

Gerçek endpoint doğrulanmadan TÜİK entegrasyonu production-ready kabul edilmemelidir.

---

# 10. CURRENT TÜİK FILES

Mevcut TÜİK entegrasyon dosyaları:

- backend/utils/index-validation.js
- backend/services/tuik-index-service.js
- backend/routes/inflation-indices.js
- backend/db/init.sql
- js/tfrs16.js

TFRS16 tarafında yalnızca:

loadInflationIndexTable()

backend cache entegrasyon noktasıdır.

---

# 11. BACKEND ARCHITECTURE

Tercih edilen yapı:

app.js
→ Express application

server.js
→ production startup / listen()

Backend architecture:

Internet
↓
HTTPS :443
↓
Nginx / Reverse Proxy
↓
Node.js Backend
↓
PostgreSQL

Node.js backend doğrudan public internet'e açılmamalıdır.

app.js listen() çağırmamalıdır.

server.js production startup için kullanılmalıdır.

---

# 12. GOOGLE CLOUD STATUS

Google Cloud altyapısı daha önce kurulmuştur.

Cloud altyapısı sıfırdan kurulmayacaktır.

Sonraki cloud çalışmaları mevcut altyapının doğrulanması ve production hardening çalışmalarıdır.

Kontrol edilecekler:

- mevcut GCP project
- Compute / VPS instance
- Static IP
- Firewall
- SSH hardening
- Node.js
- Docker / Docker Compose veya mevcut deployment modeli
- PostgreSQL
- Nginx
- HTTPS
- Secrets
- Monitoring
- Backup
- Restore
- Deployment

"Google Cloud kurulmalı" şeklinde yeni altyapı kurulum scope'u açılmamalıdır.

Ama mevcut GCP altyapısının gerçekten production-ready olduğu doğrulanmalıdır.

---

# 13. AUTHENTICATION

Backend gerçek JWT authentication kullanmaktadır.

Frontend'deki mevcut auth.js / GKAuth mekanizması client-side prototype niteliğindedir.

Production release için:

Frontend
→ Backend /api/auth
→ gerçek JWT
→ Bearer Token
→ protected backend API

bağlantısı tamamlanmalıdır.

Frontend TFRS16 backend çağrılarında gerçek Bearer token kullanmalıdır.

Client-side demo authentication production authentication olarak kabul edilmemelidir.

---

# 14. AUTHORIZATION / ENTITLEMENT

Security model:

Authentication
↓
Authorization
↓
Company/Tenant Access
↓
Product Entitlement
↓
Operation

Mevcut middleware'ler mümkün olduğunca yeniden kullanılmalıdır.

Yeni middleware ancak gerçekten gerekli olduğu repository incelemesiyle kanıtlanırsa oluşturulabilir.

TFRS16 mevcut entitlement kullanılacaktır.

TÜİK index functionality için yeni TMS29 entitlement oluşturulmayacaktır.

Admin-only operations mevcut admin authorization ile korunmalıdır.

Fail-closed yaklaşımı kullanılmalıdır.

---

# 15. SECURITY PRINCIPLES

Backend security model:

FAIL CLOSED

Kurallar:

- Authentication bypass yok
- Authorization bypass yok
- License bypass yok
- Tenant/company isolation korunacak
- SQL yalnızca parameterized query
- Secret source code'da olmayacak
- .env commit edilmeyecek
- JWT algorithm allowlist kullanılacak
- CORS allowlist kullanılacak
- Production HTTPS kullanılacak
- Production DB SSL kullanılacak
- Rate limiting uygulanacak
- Security headers uygulanacak
- Production error response'larında stack trace gösterilmeyecek
- Internal SQL/error detayları client'a dönülmeyecek

---

# 16. DATABASE

PostgreSQL kullanılmaktadır.

Database kuralları:

- parameterized SQL
- minimum privilege
- referential integrity
- CHECK constraints
- UNIQUE constraints
- immutable financial/reference records
- transaction integrity
- auditability
- backup
- restore testing

Production database doğrudan public internet'e açılmamalıdır.

Production DB credentials source code'a yazılmamalıdır.

---

# 17. SECRETS

Production secrets repository'de bulunmayacaktır.

Özellikle:

- JWT_SECRET
- DB_PASSWORD
- DATABASE_URL
- API credentials
- TÜİK credentials/configuration

güvenli environment/configuration üzerinden yönetilecektir.

GCP Secret Manager tercih edilir.

.env.example yalnızca placeholder içermelidir.

Daha önce gerçek secret commit edilmişse yalnızca dosyayı silmek yeterli değildir.

Secret rotation/revocation değerlendirilmelidir.

---

# 18. AUDIT

Kritik işlemler audit edilebilir olmalıdır.

Audit modeli:

WHO
→ WHAT
→ WHEN
→ SOURCE
→ RESULT

Özellikle:

- TÜİK synchronization
- index verification
- manual override
- license changes
- company access
- critical financial operations

izlenebilir olmalıdır.

Mevcut audit mekanizması varsa yeni bir audit sistemi oluşturulmayacaktır.

---

# 19. TESTING

Production release öncesinde gerçek ortamda:

npm test

çalıştırılmalıdır.

Test kapsamı:

- unit
- integration
- API
- authentication
- authorization
- license
- rate limiting
- validation
- TÜİK service
- missing index
- invalid index
- TFRS16 regression
- production-like environment
- backup/restore

Security negative tests:

No JWT → 401

Invalid JWT → 401

Expired JWT → 401

Valid JWT + insufficient permission → 403

Wrong company → 403

Missing TFRS16 entitlement → 403

Valid authorized request → success

Rate limit exceeded → 429

---

# 20. GIT DEVELOPMENT DISCIPLINE

Her kod değişikliğinden önce:

1. Repository yapısını oku.
2. İlgili dosyaları oku.
3. git status
4. git diff
5. Bağımlılıkları belirle.
6. Security impact değerlendir.
7. Database impact değerlendir.
8. Backward compatibility değerlendir.
9. Minimal değişiklik yap.
10. Test et.
11. git diff tekrar kontrol et.
12. Riskleri raporla.

Mevcut uncommitted değişiklikler korunmalıdır.

Kullanıcı onayı olmadan:

git reset --hard

git clean -fd

ve benzeri destructive komutlar çalıştırılmayacaktır.

---

# 21. CHANGE MANAGEMENT

Her implementation sonrasında rapor:

## Ne bulundu?

Mevcut repository durumu.

## Ne değişti?

Dosya bazında değişiklik.

## Neden değişti?

Security / functionality / release gerekçesi.

## Test sonucu

Gerçek çalıştırılan testler.

Çalıştırılamayan testler açıkça belirtilmelidir.

"Test geçti" denmemelidir eğer gerçekten çalıştırılmadıysa.

## Riskler

Açık blocker ve residual riskler belirtilmelidir.

---

# 22. PRODUCTION RELEASE CHECKLIST

TFRS16 production-ready kabul edilmeden aşağıdakiler tamamlanmalıdır:

### Cloud

- mevcut Google Cloud altyapısı doğrulandı
- production server hazır
- static IP
- firewall
- SSH hardening

### Backend

- production Node.js
- app.js / server.js ayrımı
- process restart
- production configuration

### Network

- domain
- DNS
- Nginx
- HTTPS
- HTTP → HTTPS redirect
- TLS

### Database

- production PostgreSQL
- minimum privilege
- SSL/TLS
- schema
- inflation_indices
- backup
- gerçek restore testi

### Secrets

- JWT_SECRET
- DB credentials
- API configuration
- secure secret management

### Security

- authentication
- authorization
- TFRS16 entitlement
- CORS
- rate limiting
- security headers
- parameterized SQL
- input validation

### TÜİK

- gerçek endpoint doğrulandı
- response shape doğrulandı
- validation tamamlandı
- PENDING → VERIFIED workflow tamamlandı
- yalnızca VERIFIED + active records servis ediliyor
- audit trail çalışıyor

### Frontend

- gerçek backend JWT
- Bearer token
- TFRS16 backend integration
- client-side demo auth production'dan çıkarılmış

### Testing

- npm test
- API
- auth
- authorization
- license
- TÜİK
- TFRS16 regression
- negative tests
- production-like tests

### Operations

- monitoring
- logging
- health check
- backup
- restore
- restart/crash recovery

### UAT

TFRS16:

Login
→ Company Access
→ TFRS16 Entitlement
→ Contract Creation
→ Initial Recognition
→ Schedule
→ Modification
→ Reassessment
→ TMS29 Restatement
→ TÜİK Index Retrieval
→ Inflation Adjustment
→ Journal
→ Audit

tamamlanmalıdır.

---

# 23. CURRENT RELEASE BLOCKERS

Repository incelemesi sonucunda blocker listesi güncellenmelidir.

Şu konular özellikle doğrulanmalıdır:

1. Frontend gerçek JWT entegrasyonu
2. Gerçek TÜİK endpoint doğrulaması
3. PENDING → VERIFIED workflow
4. Mevcut Google Cloud production deployment
5. Production PostgreSQL
6. HTTPS / Nginx / firewall
7. Secrets
8. npm test
9. CI
10. Backup + gerçek restore
11. Monitoring
12. TFRS16 UAT
13. UX Konsolidasyonu — tek shell, sözleşme detayı tab'ları, breadcrumb, bilgi mimarisi, progressive disclosure (bkz. bölüm 32 — AĞUSTOS 2026'da release kriterine eklendi, backend-only değil, frontend-only bir blocker)
14. **[DÜZELTİLDİ — AĞUSTOS 2026]** ~~Kira Modifikasyonu ve Reassessment işlemleri backend'e (PostgreSQL) HİÇ YAZMIYOR~~ — düzeltildi. `createModification`/`applyModification`/`updateModification`/`cancelModification`/`createReassessment`/`applyReassessment`/`updateReassessment`/`cancelReassessment` artık **async**'e çevrildi ve her biri `saveContracts()` (localStorage) sonrası `persistContractToApi(contract, true)` (backend PUT /api/contracts/:id, `details` JSONB) çağırıyor. **Backend-first + rollback stratejisi:** backend yazma başarısız olursa (network hatası, 401, 500 vb.) yerel değişiklik (contract alanları VE modification/reassessment objesinin kendisi — status, journal, appliedFromTerms/ToTerms dahil) TAM olarak geri alınır ve `valid:false, errors:["Backend'e kaydedilemedi: ..."]` döner — "yerelde var, backend'de yok" sessiz tutarsızlığı artık oluşamaz.
    - **Zincirleme etki:** bu fonksiyonları çağıran her yer güncellendi: `initModificationEvents`/`initReassessmentEvents` (UI event handler'ları, artık async, buton "Kaydediliyor..." durumu gösteriyor), `checkIndexReassessment`/`checkAllIndexReassessments`/`syncIndexCurrentRateFromCpiTable` (otomatik endeks-bazlı reassessment kontrolü), self-test paketleri (`runSelfTestsV19FullTms29`, `runSelfTestsV18Part1`, `runSelfTestsV19AccountMapping` — hepsi async).
    - **Bilinçli istisna:** `refresh()` içine monkey-patch edilmiş `checkAllIndexReassessments()` çağrısı **fire-and-forget** bırakıldı (`.catch()` ile) — `refresh()` çok yaygın ve senkron çağrılan bir fonksiyon olduğu için tamamını async yapmak (yüzlerce çağrı yerini etkiler) bu düzeltmenin kapsamı dışında tutuldu. Otomatik/periyodik endeks kontrolü artık backend'e yazmayı DENİYOR (önceden hiç denemiyordu) ama sonucunu beklemiyor; hata olursa konsola loglanıyor. Kullanıcının doğrudan tıkladığı formlarda (yukarıdaki UI event handler'ları) tam bekleme+rollback+hata gösterimi var.
    - Kanıt: `test/modification-management.test.js` ve `test/reassessment-management.test.js` — "mutlu yol + backend kaydı" (fetch'in doğru URL/method/body ile çağrıldığını doğrular) ve "backend hatası → ROLLBACK" (rollback'in TAM çalıştığını doğrular) test grupları.
15. **[DÜZELTİLDİ, AĞUSTOS 2026]** `js/tfrs16.js` içinde İKİ AYRI `window.__TFRS16_TEST__` ataması vardı, ikincisi birincisini sessizce eziyordu — `createModification`/`applyModification`/`createReassessment`/`applyReassessment` gibi fonksiyonlar test-erişilebilir DEĞİLDİ. İkinci (kazanan) shim'e eksik exportlar eklendi.

Bu maddeler repository/cloud üzerinden doğrulanmadan "production-ready" iddiasında bulunulmaz.

---

# 24. DEVELOPMENT DECISION RULE

Her yeni iş için önce şu soru sorulmalıdır:

> "Bu değişiklik TFRS16'nın production release'ine ve ilk satışına doğrudan katkı sağlıyor mu?"

Eğer cevap hayır ise:

- implementation başlatma
- scope'u sorgula
- sonraki faza bırak

Özellikle yeni modül veya yeni lisans geliştirmelerinde bu kontrol zorunludur.

---

---

# 26. TFRS16.JS REFACTOR STRATEGY

Mevcut `js/tfrs16.js` dosyası yaklaşık 1.2 MB büyüklüğündedir.

Bu büyüklük teknik borç / maintainability konusu olarak kabul edilmektedir.

Ancak:

> TFRS16 production release öncesinde sırf dosya büyük olduğu için kapsamlı refactor yapılmayacaktır.

## RELEASE ÖNCESİ KURAL

TFRS16 release tamamlanana kadar:

- mevcut çalışan TFRS16 hesaplama motoru korunacaktır
- gereksiz dosya bölme yapılmayacaktır
- büyük çaplı architecture refactor yapılmayacaktır
- function signature değiştirilmeyecektir
- calculation flow yeniden tasarlanmayacaktır
- synchronous calculation engine async yapılmayacaktır
- çalışan finansal algoritmalar yeniden yazılmayacaktır

Yalnızca production release için zorunlu olan değişiklikler yapılabilir.

Örneğin:

- security blocker
- authentication
- authorization
- license enforcement
- TÜİK backend integration
- API integration
- critical bug
- release blocker
- test failure
- production compatibility problemi

doğrudan düzeltilir.

## RELEASE SONRASI REFACTOR

TFRS16 production'a alındıktan ve ilk müşteri / ilk gelir aşamasına geçildikten sonra `tfrs16.js` kontrollü şekilde modüler hale getirilecektir.

Muhtemel hedef yapı:

js/
├── tfrs16-core.js
├── tfrs16-calculation.js
├── tfrs16-schedule.js
├── tfrs16-modification.js
├── tfrs16-reassessment.js
├── tfrs16-tms29.js
├── tfrs16-inflation.js
├── tfrs16-api.js
├── tfrs16-ui.js
└── tfrs16.js

Ancak bu yapı kesin architecture olarak kabul edilmez.

Refactor sırasında önce mevcut dependency/function ilişkileri çıkarılacak, sonra modüller kontrollü şekilde ayrılacaktır.

## REFACTOR PRINCIPLE

Refactor:

BEHAVIOR PRESERVATION

prensibiyle yapılacaktır.

Örneğin:

getInflationIndex()
→ getInflationRatio()
→ applyTMS29Restatement()

hesaplama zincirinin finansal davranışı değiştirilmeyecektir.

Aşağıdaki fonksiyonların public/internal contract'ları korunacaktır:

- getInflationIndex()
- getInflationRatio()
- applyTMS29Restatement()
- validateInflationAdjustment()
- createInflationAdjustment()
- applyInflationAdjustment()
- cancelInflationAdjustment()
- generateInflationAdjustmentJournal()
- getReassessmentBaseSchedule()

Refactor sonrası aynı input için aynı finansal output alınması regression testleriyle doğrulanacaktır.

## REFACTOR SAFETY

Refactor başlamadan önce:

1. mevcut test suite tamamen çalıştırılır
2. TFRS16 regression baseline oluşturulur
3. function dependency map çıkarılır
4. public API / global dependency'ler belirlenir
5. frontend dependency'leri belirlenir
6. backend integration noktaları belirlenir
7. financial calculation outputs baseline olarak kaydedilir

Refactor:

- küçük parçalar halinde
- test ederek
- diff kontrol ederek
- backward compatibility korunarak

yapılacaktır.

Bir refactor adımı finansal hesaplama sonucunu değiştirirse ilgili değişiklik durdurulacak ve neden analiz edilmeden devam edilmeyecektir.

## STRATEGIC PRINCIPLE

Technical cleanliness, production release'ın önüne geçirilmeyecektir.

Öncelik:

TFRS16 Stability
→ Production
→ Release
→ First Customer
→ Revenue
→ Refactor
→ Scale

---

# 27. CURRENT TECHNICAL STATE — AUGUST 2026

Repository statik incelemelerine göre mevcut durumda:

## Büyük ölçüde mevcut

- TFRS16 calculation engine
- TFRS16 entitlement enforcement
- JWT backend authentication
- authorization middleware
- company/tenant isolation
- JWT HS256 algorithm allowlist
- CORS allowlist
- rate limiting
- security headers
- parameterized SQL
- TÜİK validation layer
- inflation_indices PostgreSQL model
- immutable/supersede index model
- VERIFIED-only API filtering
- audit infrastructure
- Dockerfile
- app.js / server.js separation
- TFRS16 inflation cache integration point

## Release öncesi doğrulanması / tamamlanması gerekenler

- frontend → backend gerçek JWT integration
- gerçek TÜİK endpoint / response shape verification
- PENDING → VERIFIED API workflow
- production GCP configuration verification
- production PostgreSQL
- Nginx
- HTTPS
- DNS
- firewall
- production secrets
- secret rotation where required
- CI pipeline
- real npm test execution
- monitoring
- backup
- real restore test
- TFRS16 UAT

## ÖNEMLİ

Repository statik olarak incelenmiş olması, production-ready olduğu anlamına gelmez.

Kod seviyesinde:

"implemented"

ile

"production verified"

ayrımı korunacaktır.

Bir özellik ancak gerçek ortamda çalıştırılıp doğrulandığında production-ready kabul edilir.

---

# 28. DEPENDENCY / BUILD REPRODUCIBILITY

Repository'de gerçek Node.js package yapısı root seviyesindedir.

Backend bağımsız bir npm package değildir.

Production dependency management root `package.json` üzerinden yürütülmektedir.

Gerçek production/release ortamında:

- root `package-lock.json` oluşturulmalı
- dependency versions lock edilmelidir
- CI mümkün olduğunda `npm ci` kullanmalıdır
- Docker build aynı lockfile üzerinden reproducible dependency installation yapmalıdır

`backend/package-lock.json` mevcutsa bunun gerçek lockfile olup olmadığı kontrol edilmelidir.

Eski / orphan / geçersiz lockfile production dependency management için kullanılmamalıdır.

Fake veya elle oluşturulmuş lockfile oluşturulmayacaktır.

---

# 29. TEST RESULT INTEGRITY

Test sonucu raporlanırken aşağıdaki ayrım zorunludur:

PASS
→ Test gerçekten çalıştırıldı ve geçti.

FAIL
→ Test gerçekten çalıştırıldı ve başarısız oldu.

NOT RUN
→ Test ortam nedeniyle çalıştırılamadı.

NOT VERIFIED
→ Kod mevcut olsa bile gerçek production-like ortamda doğrulanmadı.

Syntax OK
→ Sadece JavaScript syntax kontrol edildi; functional test anlamına gelmez.

Özellikle:

`node --check`

sonucu:

TEST PASS

olarak raporlanmayacaktır.

Aynı şekilde test çalıştırılmadan:

"production-ready"

sonucu çıkarılmayacaktır.

---

# 30. RELEASE VS TECHNICAL DEBT

Release öncesi karar mekanizması:

CRITICAL SECURITY / FINANCIAL CORRECTNESS / RELEASE BLOCKER
→ NOW

MAINTAINABILITY / CODE CLEANLINESS
→ AFTER RELEASE

PERFORMANCE OPTIMIZATION
→ AFTER BASELINE

ARCHITECTURAL REFACTOR
→ AFTER FIRST STABLE RELEASE

NEW PRODUCT / NEW MODULE
→ AFTER FIRST REVENUE

Bu karar mekanizması TFRS16 release süresince korunacaktır.

---

# 31. FINAL PRODUCT STRATEGY

İlk hedef büyük bir platformu aynı anda tamamlamak değildir.

İlk hedef:

> Satılabilir, güvenli, denetlenebilir ve finansal olarak güvenilir bir TFRS16 ürünü çıkarmaktır.

Başarı sırası:

TFRS16
→ Production
→ UAT
→ UX Konsolidasyonu (bkz. bölüm 32 — Faz 0-2 ve revize Faz 3, frontend-only, backend'e dokunmadan)
→ Release
→ First Customer
→ First Revenue
→ Customer Feedback
→ Stabilization
→ TFRS16.js İç Modülerleştirme / Scale (bölüm 26 — teknik borç, release sonrası)
→ Next Module

Sonraki modüller ancak TFRS16'nın production ve ticari başarısından sonra önceliklendirilecektir.

# 25. GOLDEN RULE

# ÖNCE TFRS16'YI RELEASE ET.
# SONRA SAT.
# SONRA GELİR ÜRET.
# SONRA DİĞER MODÜLLERE GEÇ.

TFRS16 release edilmeden TMS19, standalone TMS29, DCF, Hedge Accounting vb. modüllere gereksiz production scope'u açılmayacaktır.

TÜİK entegrasyonu yalnızca TFRS16'nın mevcut TMS29 restatement motorunu besleyen veri altyapısıdır.

Mevcut TFRS16 hesaplama motoru korunacaktır.

---

## GÜNCELLEME — AĞUSTOS 2026: RELEASE KRİTERİNE UX KONSOLİDASYONU EKLENDİ

Önceki karar, "release önce, cilalama sonra" idi. Bu KASITLI OLARAK DEĞİŞTİRİLDİ:

> Release, yalnızca hesaplama doğruluğu ve güvenlik açısından değil, **kullanılabilirlik açısından da** hazır olduğunda yapılacaktır.

Sebep: mevcut üründe iki ayrı, örtüşen navigasyon kabuğu (dashboard.html ve tfrs16.html'in kendi gömülü sidebar'ı) ve sözleşme detayında 7'den fazla farklı işlevin (modifikasyon, reassessment, ödeme planı, enflasyon düzeltmesi, SLB, alt kiralama, muhasebe fiş merkezi) tek bir kesintisiz kaydırmalı sayfada birleştirilmesi, ürünü "kopuk" ve satışa hazır olmayan bir izlenim veriyor. Bkz. bölüm 32.

Bu, TFRS16 dışına scope genişletmek DEĞİLDİR — aynı TFRS16 modülünün DAHA KULLANILABİLİR bir sunumudur. Golden Rule'un "önce TFRS16, sonra sat" ilkesi bozulmuyor; sadece "TFRS16 release-ready" tanımına UX konsolidasyonu da dahil edildi.

Amaç:

FINANCIAL-GRADE
+
AUDITABLE
+
SECURE
+
MAINTAINABLE
+
**KULLANILABİLİR / TUTARLI (yeni)**
+
PRODUCTION-READY
+
SELLABLE

bir TFRS16 ürünü ortaya çıkarmaktır.

---

# 32. PRE-RELEASE UX CONSOLIDATION (RELEASE BLOCKER — YENİ KARAR)

## KAPSAM

Bu iş **VARSAYILAN OLARAK FRONTEND-ONLY**'dir. Aşağıdakilere GEREKSİZ YERE dokunulmayacaktır:

- `backend/` klasöründeki dosyalar
- API sözleşmesi/endpoint (request/response şekli, status code'lar, route path'leri)
- DB şeması, migration, query
- `js/tfrs16.js` içindeki DOKUNULMAZ 9 hesaplama fonksiyonu (bkz. bölüm 5) ve genel hesaplama mantığı
- Authentication/authorization/license enforcement zinciri

**İSTİSNA — "asla" değil, "gerekmedikçe değil":** Eğer Faz 0-3'ün gerçekten UX konsolidasyonu için (ör. tek shell'e geçiş sırasında bir endpoint'in response şeklinin frontend'in yeni yapısına uymaması, ya da breadcrumb/tab yapısının ihtiyaç duyduğu bir veri backend'de hiç yoksa) backend'de bir değişiklik gerektirdiği ortaya çıkarsa, bu YAPILABİLİR. Şart: (1) değişiklik gerekçesi açıkça belgelenir — "neden sadece frontend'le çözülemedi", (2) mevcut API sözleşmelerini kıran (breaking) değil, katkı sağlayan (additive) bir değişiklik tercih edilir, (3) DOKUNULMAZ 9 hesaplama fonksiyonuna ve mevcut auth/license zincirine yine kesinlikle dokunulmaz, (4) değişiklik sonrası tam test suite'i (`npx jest --runInBand`) çalıştırılıp mevcut testlerin PASS durumu korunduğu doğrulanır.

Varsayılan yaklaşım hâlâ: MEVCUT ekranların (dashboard.html, tfrs16.html) dış kabuğunu (shell/navigasyon/sayfa düzeni) DOM/CSS/UI-render katmanında yeniden organize etmek, backend'e hiç dokunmadan. Backend değişikliği yalnızca gerçekten kaçınılmazsa, yukarıdaki şartlarla yapılır.

Her değişiklikten sonra: `npx jest --runInBand` ile backend/servis test suite'i (bu konuşmada zaten kapsanan `inflation-manual-entry`, `inflation-indices-admin-authorization`, `index-validation`, `tuik-index-service`, `tfrs16-inflation-backend-cache` dahil) PASS durumunu KORUMALI — bu, backend'in bozulmadığının kanıtı olarak her adımda çalıştırılacaktır.

## FAZ SIRASI (release öncesi, sırayla)

**Faz 0 — Shell kararı:** `dashboard.html` tek kabuk olur. `tfrs16.html` kendi sidebar/topbar'ını render etmeyi bırakır, yalnızca içerik üretir.

**Faz 1:**
- Tek kabuk + tutarlı navigasyon
- Sözleşme detayı tab'lara bölünür: Özet | Ödeme Planı | Modifikasyon & Reassessment | Enflasyon | SLB/Alt Kiralama | Muhasebe Fişleri (CSS ile bölüm gizleme/gösterme — DOM yapısı ve hesaplama mantığı değişmez)
- Breadcrumb: Şirket > Sözleşme > Tab
- **[TAMAMLANDI]** Yeni Sözleşme formu (`contractModal`) 4 tab'a bölündü: (1) Sözleşme — temel alanlar + Varlık Sınıfı, (2) İleri TFRS 16 Parametreleri (opsiyonel), (3) Opsiyonlar & İstisnalar, (4) Para Birimi & Standartlar (V26). Aynı `[data-tab]` + CSS gösterme/gizleme deseni kullanıldı — form submit/FormData davranışı değişmedi. "Ödeme Frekansı" etiketi "Ödeme Sıklığı" olarak düzeltildi (yalnızca metin, `id`/`name="paymentFrequency"` aynı kaldı).
- **[TAMAMLANDI]** Kira Modifikasyonu + Reassessment Yönetimi sözleşme detay ekranından (openDetail) çıkarıldı; artık ayrı bir "Modifikasyon & Reassessment" sayfasında (`renderModificationReassessmentPage`), native `<select>` ile sözleşme seçilip tek ekranda yönetiliyor. Dashboard'daki "Hesaplama & Yeniden Ölçüm" linki bu sayfaya (`tfrs16.html?open=modification`) bağlandı; tfrs16.html'in kendi iç menüsüne de aynı sayfaya giden bir buton eklendi. Render/iş mantığı fonksiyonlarının (`renderModificationManagementSection`, `createModification`, `applyModification`, `createReassessment`, `applyReassessment` vb.) kendisine dokunulmadı — yalnızca NEREDE render edildikleri ve işlem sonrası hangi ekranın yenilendiği (`onChanged` callback, geriye dönük uyumlu) değişti.
- **[TAMAMLANDI]** Satış ve Geri Kiralama (SLB) + Alt Kiralama (Sublease) AYNI desenle sözleşme detay ekranından (`initPaymentScheduleEvents` içinden) çıkarıldı; artık iki AYRI sayfada (`renderSlbManagementPage`, `renderSubleaseManagementPage`), her biri kendi sözleşme seçicisiyle. Dashboard'a "Modifikasyon & Reassessment"in altına iki yeni link eklendi (`tfrs16.html?open=slb`, `?open=sublease`). `renderSlbSection`/`renderSubleaseSection`'ın KENDİSİNE dokunulmadı — hâlâ aynı `document.getElementById("slbSectionContainer"/"subleaseSectionContainer")` mantığıyla çalışıyorlar, yeni sayfalar sadece bu container'ları kendi içlerinde oluşturuyor. **Aynı zamanda backend-persist + rollback düzeltmesi uygulandı** (madde 14 ile aynı desen, aynı kök nedenden muzdaripti): `runAndRenderSlb`/`runAndRenderSublease` önceden sadece `saveContracts()` (localStorage) çağırıyordu, backend'e hiç yazmıyordu — artık async, `persistContractToApi(contract, true)` çağırıyor, başarısız olursa `contract.saleAndLeaseback`/`contract.sublease` ÖNCEKİ haline (kayıt öncesi) tam olarak geri dönüyor, kullanıcıya "Backend'e kaydedilemedi: ..." mesajı gösteriliyor. Kanıt: `test/slb-management.test.js`, `test/sublease-management.test.js` — "mutlu yol + backend kaydı" ve "backend hatası → ROLLBACK" test grupları (14 test, hepsi PASS).
- **[TAMAMLANDI] Faz 0 — dashboard.html tek kabuk, tfrs16.html bypass edildi (kısmi):** `frontend/dashboard.html` artık `js/tfrs16.js`'i doğrudan yüklüyor (`<script src="../js/tfrs16.js">`, dashboard'un kendi inline script'inden ÖNCE — script sırası kritik). Sidebar'daki "Modifikasyon & Reassessment", "SLB", "Sublease", "Enflasyon Düzeltmesi", "Close Dashboard", "Hesap Planı Eşleme", "Denetim İzi", "Konsolidasyon", "Kur Yönetimi" linkleri artık `href="../tfrs16.html?open=X"` (tam sayfa navigasyonu, tfrs16.html'in KENDİ shell'i açılıyordu) DEĞİL — `data-v26-open="X"` + JS click handler ile `js/tfrs16.js`'in kendi `openInMain` mekanizmasını (`window.__gkOpenInMainByKey(key)`) kullanıp içeriği doğrudan dashboard.html'in `<main class="content">` alanına render ediyorlar. Tam sayfa yenilenmesi yok, tfrs16.html hiç yüklenmiyor.
    - **Duplicate-nav guard:** `injectV26Navigation()` normalde çalıştığı sayfanın sidebar'ına KENDİ ekstra buton setini ekliyordu (tfrs16.html'de bu gerekli). dashboard.html'de bu artık ATLANIYOR — `window.__GK_DASHBOARD_SHELL__ = true` flag'i (js/tfrs16.js'den ÖNCE tanımlanıyor) kontrol ediliyor; flag varsa nav-block eklenmiyor, sadece `openInMain`/`deepLinkMap`/`window.__gkOpenInMainByKey` kuruluyor. Aksi halde dashboard'un native linkleri ile injectV26Navigation'ın eklediği linkler İKİ KEZ görünürdü.
    - **Bilinçli olarak dışarıda bırakıldı:** "Sözleşmeler" linki hâlâ `../tfrs16.html`'e (query param'sız) gidiyor — ana sözleşme portföyü/detay modülü (contract listesi, "Yeni Sözleşme" formu, contract detail modal) bu kapsamın DIŞINDA; bu, Faz 0'ın TAMAMLANMAMIŞ, çok daha büyük bir parçası (kendi Sözleşme listesi UI'ının dashboard.html'e taşınması gerekir).
    - **[DOĞRULANAMADI — gerçek tarayıcıda test edilmeli]** Bu değişiklik sandbox'ta yalnızca `node --check` (syntax) ve HTML etiket dengesi ile doğrulandı; gerçek tarayıcı DOM timing'i (script yükleme sırası, DOMContentLoaded event sırası, injectV26Navigation'ın init akışlarıyla — hydrateContractsFromApi, refreshInflationIndexCacheFromBackend, checkAllIndexReassessments — dashboard'un KENDİ `loadDashboard()` akışıyla paralel/çakışmalı çalışması) sandbox'ta test edilemedi. Deploy sonrası gerçek tarayıcıda manuel doğrulama gerekiyor.
- **[TAMAMLANDI]** "Dipnotlar" sayfası eklendi (`renderFootnotesPage`, `tfrs16.html?open=footnotes`, dashboard'a "Alt Kiralama (Sublease)"nin altına link eklendi). 3 tab (Varlık/Yükümlülük/Likidite) arasında JS ile (native `<select>` değil, buton tab'ları) geçiş yapılıyor. Sözleşme seçici YOK — bu dipnotlar (`getRuoAssetRollForwardReport`/`getLeaseLiabilityRollForwardReport`/`getLeaseLiquidityRiskDisclosure`) tüm portföyü tarıyor, tek sözleşmeye özgü değil; sadece dönem sonu (raporlama tarihi) seçilebiliyor.
    - **Kaynak:** Finansal Raporlama ekranında (`v191RenderFinancialReporting`) zaten VAR olan 3 dipnot bloğu — extract edildi, TAŞINMADI/KOPYALANMADI: `v191PrepareFinancialReportingData` (veri hazırlama) ve `v191RenderAssetNoteHtml`/`v191RenderLiabilityNoteHtml`/`v191RenderLiquidityNoteHtml` (HTML üretimi) adında paylaşılan fonksiyonlara çıkarıldı. `v191RenderFinancialReporting` artık bu fonksiyonları ÇAĞIRIYOR — davranışı (aynı input → aynı output) DEĞİŞMEDİ, bu **testle doğrulandı** (`test/footnotes-page.test.js`, "extraction sonrası regresyon yok" bloğu). Finansal Raporlama ekranı hâlâ bu 3 dipnotu + KPI/snapshot'ı TEK SAYFADA gösteriyor; "Dipnotlar" sayfası bunun AYRI, sadeleştirilmiş (KPI'sız, tab'lı) bir sunumu.
    - Kanıt: `test/footnotes-page.test.js` — 12 test, hepsi PASS (extraction regresyonu, veri hazırlama, 3 fonksiyonun bağımsız çağrılabilirliği, 3 tab arası geçiş, sözleşme seçici olmadığının doğrulanması, dönem değiştirme).
- **[DÜZELTİLDİ — kullanıcı geri bildirimi, ekran görüntüsüyle]** Dipnotlar sayfasında dört sorun bulundu ve düzeltildi:
    1. **Mobilde ekrana sığmama:** `v191Table()` fonksiyonunun ürettiği `<div class="table-wrapper">` sarmalayıcısı için HİÇBİR CSS tanımlı DEĞİLDİ (`.gk-v26-table-wrap`/`.gk-v26-table` class'ları farklı isimdeydi, hiç eşleşmiyordu). `v191Table()`'ın kendisine dokunulmadan, eksik `.table-wrapper` CSS'i (`overflow-x:auto` dahil) `injectV26Styles()`'e eklendi — bu hem Dipnotlar sayfasını hem Finansal Raporlama ekranını (aynı fonksiyonu paylaşıyorlar) düzeltti.
    2. **Arka plan tutarsızlığı:** Dipnotlar sayfasının tab butonları hiçbir kartın içinde değildi, dashboard'un krem rengi (`--paper-2`) arka planı araya sızıyordu. Artık period picker + tab butonları + dipnot içeriğinin TAMAMI tek bir `.gk-v26-card` (beyaz) içinde.
    3. **"Bir satıra tıklayarak detaya inebilirsiniz" çalışmıyordu:** `v191FilterDetail`/`v191ToggleRouDetail`/`v191ToggleLiabDetail`/`v191ClearRouFilter`/`v191ClearLiabFilter` fonksiyonları her zaman `v191OpenFinancialReporting()`'i çağırıyordu (Finansal Raporlama ekranını açmaya çalışıyordu) — dashboard/Dipnotlar bağlamında bu ekran/modal yok, sessizce hiçbir şey olmuyordu. Çözüm: `v191ActiveScreenRefreshCallback` — hangi ekranın aktif olduğunu bilen bir callback. `renderFootnotesPage` kendi `render()`'ını buna kaydediyor, `openInMain` (başka bir sayfaya geçildiğinde) temizliyor. Boşsa (Finansal Raporlama ekranındaysak) eski davranış AYNEN korunuyor — Finansal Raporlama ekranına sıfır etki.
    4. **"Financial Reporting Snapshot" kaldırıldı:** İncelemede bu tablonun `data.byCurrency` diye VAR OLMAYAN bir alana eriştiği bulundu (`getTfrs16FinancialReportingSnapshot`'ın döndürdüğü objede böyle bir alan hiç yok) — yani bu tablo YAYINLANDIĞINDAN BERİ hiçbir zaman veri göstermemiş, her zaman "Veri bulunamadı" göstermiş. Kullanıcı talebiyle `v191RenderFinancialReporting`'den kaldırıldı (KPI kartları etkilenmedi).
    - Kanıt: `test/footnotes-page.test.js` 12 teste çıkarıldı — yeni testler: tek-kart görsel tutarlılığı, drill-down'ın Dipnotlar sayfasını (Finansal Raporlama'yı değil) yenilediği, Snapshot bölümünün kaldırıldığının doğrulanması.
- **[DÜZELTİLDİ — kullanıcı geri bildirimi]** Modifikasyon & Reassessment / SLB / Sublease sayfalarında, sözleşme seçildikten sonra HANGİ sözleşmeye işlem yapıldığına dair hiçbir gösterge yoktu — form/dipnot içeriği (`renderModificationManagementSection`, `renderReassessmentManagementSection`, `renderSlbSection`, `renderSubleaseSection` — hiçbirine dokunulmadı) hiçbir yerde sözleşme kimliği göstermiyordu. Çözüm: `v26SelectedContractBanner(contract)` — sözleşme ID/şirket/tedarikçi bilgisini içeren belirgin bir banner, üç sayfada da `<select>`'in hemen altına eklendi. Sözleşme değiştiğinde banner da güncelleniyor.
    - Kanıt: `test/selected-contract-banner.test.js` — 7 test, hepsi PASS (banner içeriği, sayfa açılışında ilk sözleşmenin göründüğü, sözleşme değişince güncellendiği, boş durumda gösterilmediği — 3 sayfa için).
- **[DÜZELTİLDİ — kullanıcı geri bildirimi, güvenlik/veri temizliği]** Uygulama iki AYRI yerde demo/sahte veri üretip localStorage'a kalıcı olarak yazıyordu — kullanıcı artık gerçek backend'e bağlı olduğu için bunlar TAMAMEN KALDIRILDI (fail-closed: veri yoksa boş liste, sahte veri asla yazılmaz):
    1. `loadContracts()` — localStorage boşken `getDefaultContracts()` (LEASE-001/002/003, "GK Holding"/"GK Teknoloji") döndürüp HEMEN localStorage'a yazıyordu. Artık boş dizi döner. `getDefaultContracts()` fonksiyonunun tanımı SİLİNMEDİ (minimal risk) ama artık hiçbir yerden çağrılmıyor.
    2. `v26LoadCompanies()` (Şirket Yönetimi/Konsolidasyon ekranlarının kaynağı) — hiç sözleşme yokken 4 demo şirket (TR-001 "Teknoloji A.Ş.", DE-001 "GmbH", US-001 "LLC", TR-002 "Lojistik Ltd.") üretip localStorage'a yazıyordu. Artık boş dizi döner.
    - **Risk (önceden):** Backend'e geçici erişilemezlik (network hatası, token süresi dolması) durumunda kullanıcı bu sahte verileri GERÇEK sanıp üzerinde işlem yapabilirdi (modification/SLB/sublease oluşturup backend'e yazmaya çalışabilirdi — LEASE-001 gibi backend'de var olmayan bir ID ile).
    - Kanıt: `test/demo-data-removal.test.js` — 6 test, hepsi PASS (boş başlangıç durumu, localStorage'a hiçbir demo string yazılmadığının doğrulanması, gerçek veri varken doğru okunduğu, gerçek sözleşmeden türeyen şirketlerin demo'ya düşülmeden döndüğü).
- **[TAMAMLANDI]** "Toplu Fiş Merkezi" eklendi (`renderAccountingCenterPage`, `tfrs16.html?open=accountingCenter`) — dashboard'da Alt Kiralama (Sublease)'in altına, Dipnotlar'ın üstüne yerleştirildi. `renderAccountingCenter` (tek + toplu fiş üretimi, `Muhasebe Fiş Merkezi` + `Toplu Muhasebe Merkezi`) sözleşme detay ekranından (`openDetail`) çıkarıldı — render fonksiyonunun KENDİSİNE dokunulmadı, sadece nerede çağrıldığı ve event-wiring'i değişti. Sözleşme seçici + `v26SelectedContractBanner` var (tekil fiş için); "Tüm Sözleşmeler İçin Toplu Fiş Üret" butonu zaten sözleşmeye bağımlı değil (kendi bağımsız modalını açıyor), değişmedi.
    - **Backend-persist riski YOK:** `generateSelectedJournal` sözleşmenin kendisini DEĞİŞTİRMİYOR — salt-okunur bir önizleme/rapor üretiyor (modification/SLB/sublease'teki "backend'e hiç yazmıyordu" sorunu burada geçerli değil, çünkü zaten yazılacak bir state mutasyonu yok). Bu testle doğrulandı.
    - Kanıt: `test/accounting-center-page.test.js` — 6 test, hepsi PASS (sayfa yapısı, sözleşme değişince güncellenme, tekil fiş önizlemesinin sözleşme state'ini değiştirmediği, toplu fiş modalının açıldığı, `renderAccountingCenter`'ın hâlâ kullanılabilir olduğu).
- **[DÜZELTİLDİ — kullanıcı geri bildirimi]** Dipnotlar sayfasının Yükümlülük tab'ında "Kullanım Hakkı Varlığı (ROU) — Varlık Sınıfına Göre, Restated" tablosu yanlışlıkla görünüyordu — `v191Tms29SummaryHtml` TEK bir fonksiyonda hem ROU hem Kira Yükümlülüğü restated tablolarını üretip Yükümlülük dipnotunun sonuna ekliyordu. İkiye ayrıldı: `v191Tms29RouSummaryHtml` (artık Varlık dipnotunun sonunda) ve `v191Tms29LiabilitySummaryHtml` (Yükümlülük dipnotunda, eski konumunda kaldı). Eski `v191Tms29SummaryHtml` silinmedi (artık hiçbir yerden çağrılmıyor, minimal risk). Finansal Raporlama ekranı (`v191RenderFinancialReporting`, tek sayfa, tab yok) hâlâ her iki tabloyu da doğru dipnotların içinde gösteriyor.
    - Kanıt: `test/tms29-tab-placement.test.js` — 7 test, hepsi PASS (Varlık tab'ında ROU restated var/Liability restated yok, Yükümlülük tab'ında tam tersi, Likidite tab'ında ikisi de yok, iki fonksiyonun bağımsız çağrılabilirliği, Finansal Raporlama ekranında sıralamanın doğru olduğu).
- **[TAMAMLANDI]** "Yeni Sözleşme" (contractModal/contractForm, önceki turda 4 tab'a bölünen form) dashboard sidebar'ına eklendi — "Sözleşmeler" linkinin hemen altına, `id="newContractButton"` bir `<button>` olarak (emergency bridge'in `closest("button")` ile yakalayabilmesi için — sidebar'ın diğer linkleri `<a>`, bu bilinçli olarak `<button>`). `openContractModal()`/form submit/tab switching kodunun KENDİSİNE dokunulmadı — statik HTML (tfrs16.html'deki `#contractModal` ile birebir aynı) dashboard.html'e kopyalandı, js/tfrs16.js zaten yüklü olduğu için (Faz 0) tüm mekanizma otomatik çalıştı.
    - **Bulunan ve düzeltilen CSS eksikliği:** `.modal`, `.modal-content`, `.form-grid`, `.form-group`, `.close-button`, `.primary-button`, `.secondary-button`, `.gk-contract-tabs`/`.gk-contract-tab` class'ları `css/tfrs16.css`'te (ve tfrs16.html'in kendi `<style>` bloğunda) tanımlıydı — dashboard.html bu dosyayı hiç yüklemiyordu. Tüm `css/tfrs16.css`'i yüklemek yerine (dashboard'un kendi tasarımıyla çakışma riski taşırdı), sadece gerekli class'lar `injectV26Styles()`'e (dashboard'da zaten çalışan izole mekanizma) CSS değişkenleri (`var(--muted)` vb.) sabit renk değerleriyle değiştirilerek kopyalandı. `css/tfrs16.css`'in kendisine dokunulmadı, tfrs16.html etkilenmedi.
    - Kanıt: `test/dashboard-new-contract.test.js` — 6 test, hepsi PASS (CSS enjeksiyonunun gerçekten olduğu, butonun doğru tipte olduğu, modal açma/kapama, tab 1'in varsayılan aktif olduğu, VE en kritik olarak — formu doldurup submit edince gerçekten bir sözleşmenin oluşturulup backend'e yazıldığı).
- **[TAMAMLANDI] tfrs16.html'de çalışan ama dashboard'a taşınmamış modüllerin envanteri çıkarıldı** — bulunanlar: Şirket Yönetimi/Gruplar/Eliminasyonlar (`deepLinkMap`'te tanımlıydı ama dashboard linki eksikti — taşıma sürecinde atlanmış), Risk & Kontroller (`v191RenderRiskControls`), Finansal Raporlama (`v191RenderFinancialReporting` — tam ekranı, Dipnotlar'a extract edilenden ayrı), ve ayrıca "V19.1 modal sistemi" (Ay Sonu Kapanış/CFO Dashboard/Integration/Reconciliation/Contract Financial Tools — `v191Show`/`v191EnsureModal` üzerinden, `openInMain`'den tamamen bağımsız).
    - **[TAMAMLANDI] Şirket Yönetimi, Gruplar, Eliminasyonlar, Risk & Kontroller taşındı.** `renderRiskControlsPage` yeni eklendi (`v191RenderRiskControls`'ün kendisine dokunulmadı, sadece eski `v191Show` modal sisteminden çıkarılıp `openInMain` akışına uyarlandı). Diğer üçü zaten `deepLinkMap`'te tanımlıydı, sadece dashboard.html'e link eklendi.
    - **[TAMAMLANDI] Finansal Raporlama taşındı** (`renderFinancialReportingPage`, `tfrs16.html?open=financialReporting`). `v191RenderFinancialReporting`'in kendisine dokunulmadı. **Bulunan ve düzeltilen ikinci bir "yanlış ekranı açma" sorunu** (Dipnotlar'daki `v191FilterDetail` sorunuyla aynı kök neden): içindeki period picker'ın "Uygula"/"Reset" butonları (`v191ApplyPeriod`/`v191ResetPeriod`) her zaman eski `v191OpenFinancialReporting()` modalını açmaya çalışıyordu — `v191TriggerActiveScreenRefresh` callback mekanizması (zaten kurulu) buraya da uygulandı.
    - **[KARAR — kullanıcı onaylı, SaaS değerlendirmesiyle] Aşağıdakiler TAŞINMIYOR:**
      - **Ay Sonu Kapanış** (`v191RenderClose`) — zaten taşınmış "Close Dashboard" ile AYNI veri kaynağını (`getMonthEndCloseDashboardData`, `getCloseReadiness`) kullanıyor, çok daha zayıf bir sunumla. Gereksiz tekrar.
      - **Integration / Reconciliation** — incelemede `liveErpConnected: false`, `live: false` SABİT (hiçbir zaman true olmuyor) bulundu — gerçek bir ERP bağlantısı yok, sadece Excel/CSV import geçmişi kaydı. "Integration" ismiyle sunmak yanıltıcı olurdu.
      - **Contract Financial Tools** (`v191OpenContractTools`) — `selectedContractId` state'i SADECE `openDetail()` (sözleşme detay modalı, henüz dashboard'a taşınmamış) çağrıldığında doluyor; dashboard bağlamında hep boş kalır, hem de contract detail'in zaten gösterdiği bilgilerin (Payment Schedule/Journal/Audit) gereksiz bir tekrarı.
      - **CFO Dashboard** (`v191RenderCfo`, `v191OpenCfoDashboard`) — "CFO Cockpit" projesi ileri bir tarihe ertelendi. Not: zengin bir backend'i var (`getCfoDashboardData` — executiveSummary/financialPosition/cashFlow/maturity/companyExposure/dataQuality) ama mevcut ön yüzü bunun küçük bir kesitini gösteriyor; ileride ele alınırsa "geliştir + taşı" olarak değerlendirilmeli.
    - **[DÜZELTİLDİ] Root'taki terk edilmiş `dashboard.html` linki.** tfrs16.html'de İKİ AYRI yerde (`.navigation` sidebar'ı ve topbar'daki "← CFO Cockpit" butonu) `href="dashboard.html"` (göreli, root'taki eski/terk edilmiş "Genel Bakış — TFRS16 Motoru" sayfasına giden, `js/tfrs16.js`'i hiç yüklemeyen, bizim çalıştığımız `frontend/dashboard.html`'den TAMAMEN AYRI bir dosya) vardı. İkisi de `frontend/dashboard.html`'e yönlendirildi; "CFO Cockpit" ismi de (proje ertelendiği için kafa karışıklığını önlemek amacıyla) nötr "Dashboard" ismiyle değiştirildi. Root'taki eski `dashboard.html` dosyasının kendisi SİLİNMEDİ (sadece ona giden linkler düzeltildi) — silinip silinmeyeceği ayrı bir karar.
    - Kanıt: `test/four-modules-migration.test.js` (7 test) + `test/financial-reporting-migration.test.js` (9 test), hepsi PASS.
- **[TAMAMLANDI] FAZ A — Sidebar bilgi mimarisi yeniden yapılandırıldı** (kullanıcı geri bildirimi: "dashboard olayı hiç güzel olmadı, çok karıştı ortalık"). **Kök neden dürüstçe:** dashboard 10+ tur boyunca parça parça, her turda "bir link daha ekle" şeklinde büyüdü — bir bilgi mimarisi planı hiç yapılmadı, sonuç bir tasarım değil bir BİRİKİMDİ. Ölçülen somut sorunlar: 16 linklik düz liste, "Genel" grubu TEK BAŞINA 8 link taşıyor, 6 farklı link AYNI `⌁` ikonunu kullanıyor (ikon hiçbir ayırt edici bilgi taşımıyor), aktif sayfa vurgusu hiç çalışmıyor (`.active` class'ı "Genel Bakış"ta STATİK duruyordu — kullanıcı nerede olduğunu göremiyordu), "Genel Bakış" linki `href="#"` ile hiçbir şey yapmıyordu.
    - **Yapılanlar:** (1) 5 mantıksal grup — Genel / Sözleşme İşlemleri / Raporlama / Kapanış & Kontrol / Tanımlar; "Genel" 8 linkten 2'ye indi. (2) "Yeni Sözleşme" ayrı sidebar linki olmaktan çıkıp Sözleşmeler satırının İÇİNDE bir `+` aksiyon butonu oldu (SaaS standart deseni: liste + o listeye ekleme aynı satırda). (3) İkonlar ayrıştırıldı, `⌁` tekrarı tamamen kaldırıldı. (4) Aktif sayfa vurgusu çalışır hale getirildi (`gkSetActiveNav`, `data-nav-key`). (5) "Genel Bakış" linki işlevsel oldu (v26PageHost'u gizleyip dashboard'un kendi içeriğini geri getiriyor). (6) Mobilde sayfa açılınca sidebar otomatik kapanıyor. (7) İsimlendirme Türkçeleştirildi: "Close Dashboard"→"Ay Sonu Kapanış", "Kur Yönetimi"→"Döviz Kurları", "Enflasyon Düzeltmesi"→"Enflasyon Endeksleri" (sayfa gerçekte endeks yönetimi).
    - **Yol boyunca yakalanan bir hata:** `+` butonuna `stopPropagation` ekleyen bir handler yazmıştım — bu, js/tfrs16.js'in emergency bridge'inin (document seviyesinde, bubble fazında dinliyor) butonu HİÇ görememesine ve modalın açılmamasına yol açardı. Fark edilip kaldırıldı; regresyon testi olarak `test/dashboard-sidebar-faz-a.test.js` içine "bu handler tekrar eklenmesin" testi yazıldı.
    - **Kapsam dışı (Faz B, ONAYLANMADI):** Modifikasyon & Reassessment / SLB / Sublease şu an sidebar'da kendi "Sözleşme İşlemleri" grubunda duruyor. **Çözülmemiş asıl mimari sorun:** bu üç sayfa + Toplu Fiş Merkezi'nin HER BİRİNİN AYRI, senkronize olmayan sözleşme seçici state'i var (`v26SelectedModReassContractId`, `v26SelectedSlbContractId`, `v26SelectedSubleaseContractId`, `v26SelectedAccountingContractId`) — kullanıcı Modifikasyon'da bir sözleşme seçip SLB'ye geçince seçim kayboluyor, tekrar seçmesi gerekiyor. Faz B planı: bu üçünü sidebar'dan çıkarıp sözleşme detay ekranına TAB olarak geri taşımak (tfrs16.html'in orijinal "her şey bir arada" avantajını, bu sefer düzenli biçimde geri kazanmak). Sayfa render fonksiyonları ve backend-persist düzeltmeleri korunur, değişen sadece NEREDE gösterildikleri.
    - Kanıt: `test/dashboard-sidebar-faz-a.test.js` — 16 test, hepsi PASS.
- **[TAMAMLANDI — KRİTİK] "Baseline 13 fail" tamamen çözüldü: test suite artık 355/355 YEŞİL.** Bu 13 fail 20+ tur boyunca "önceden beri var, benim değişikliğimle ilgisiz" diye raporlanıyordu ama hiç incelenmemişti. İncelendiğinde **ikisi gerçek güvenlik açığı** çıktı:
    1. **[GÜVENLİK AÇIĞI — DÜZELTİLDİ] OWASP güvenlik header'ları hiçbir response'ta gönderilmiyordu.** `backend/middleware/security-headers.js` (X-Content-Type-Options: nosniff, X-Frame-Options: DENY, Referrer-Policy, CSP `default-src 'none'`, Permissions-Policy) YAZILMIŞTI ama `backend/app.js`'e **hiç `app.use()` ile bağlanmamıştı**. PROJECT_CONTEXT kayıtlarında "Security headers middleware activated globally" yazıyordu — kayıt YANLIŞTI, middleware inert'ti. Artık app.js'in EN BAŞINA (tüm route'lardan ve static'ten önce) bağlandı.
    2. **[GÜVENLİK AÇIĞI — DÜZELTİLDİ] Admin API yüzeyi rate-limit korumasızdı.** Yalnızca tek tek yazma (POST/PATCH/DELETE) endpoint'lerine `adminMutationRateLimiter` bağlıydı; `GET /api/admin/*` dahil okuma istekleri HİÇ sayılmıyordu — kimliği doğrulanmamış bir saldırgan sınırsız istek atabiliyordu (her biri 401 dönse de brute-force/kaynak tüketimi açısından korumasız). `adminGlobalRateLimiter` eklendi, router'ın EN BAŞINA (requireAuth/requireAdmin'den ÖNCE) bağlandı ki 401 dönen istekler de sayılsın. Mevcut `ADMIN_RATE_LIMIT_MAX` env değişkenine bağlı (yeni değişken eklenmedi).
    - **Kalan 11 fail'in tamamı TEST TARAFI sorunuydu, üretim kodu doğruydu:** (a) `p3-organization` (2) — mock'ta `lockRootCompanyForLimit` tanımlı değildi (fonksiyon `license-service.js`'te gerçekten var ve export ediliyor). (b) `p1-access-control` (7) + `license-security-part2` — dosya seviyesindeki `require` zinciri, `describe` içindeki `jest.doMock`'lardan ÖNCE çalışıp gerçek `db/pool.js`'i tetikliyor ve "Eksik veritabanı ortam değişkenleri" ile TÜM suite'i düşürüyordu; hoisted `jest.mock` + `@jest-environment node` eklendi. (c) `p4-security-hardening` (1) — mock, `admin.js`'in parent-varlık kontrolü (`SELECT id FROM companies WHERE id = $1`) desenini tanımıyordu; eklenirken `getCompanyAncestryChain`'in `WITH RECURSIVE ancestry ... WHERE id = $1` sorgusuyla çakışmaması için desen dikkatle daraltıldı. (d) `tfrs16-inflation-backend-cache` (2) — bu oturumdaki fail-closed düzeltmemin yan etkisi: test `addOrUpdateInflationIndexEntry()` ile localStorage'a yazıp hesaplama bekliyordu, ama `loadInflationIndexTable()` artık localStorage'ı HİÇ okumuyor (üretim davranışı DOĞRU). Test artık endeksleri GERÇEK üretim yolundan (mock'lanmış backend yanıtı → `refreshInflationIndexCacheFromBackend`) besliyor.
    - **[ÇÖZÜLDÜ] "Vaka 5" — kök neden MOTOR DEĞİL, TESTİN KENDİSİYDİ.** `runSelfTestsV19FullTms29` içindeki "Vaka 5 — açılış/dönem içi ayrıştırması" uzun süredir başarısızdı. Sistematik ölçümle (alt kontroller tek tek loglanarak) görüldü ki matematik zaten DOĞRUYDU: "açılış + dönem içi = toplam Parasal K/Z" kimliği ve "jurnal borç = alacak" dengesi HEP PASS veriyordu; yalnızca İKİ hesap-eşleşme kontrolü fail ediyordu. Sebep: `generateInflationAdjustmentJournal()` en sonda `applyAccountMappingToJournal()` çağırıyor ve bu, `accountKey` üzerinden `account` alanını TAM ETİKETTEN ("580 Geçmiş Yıllar Zararları") HESAP KODUNA ("580") dönüştürüyor — bu, V19 hesap planı eşleme özelliğinin ta kendisi ve DOĞRU davranış (kullanıcı kendi hesap kodunu tanımlayabilsin diye). Test ise dönüşüm SONRASI çıktıyı, dönüşüm ÖNCESİ `TFRS29_ACCOUNTS.*` sabitleriyle karşılaştırıyordu — bu karşılaştırma hiçbir koşulda eşleşemezdi. **Düzeltme:** karşılaştırma `accountKey` üzerinden yapılacak şekilde değiştirildi; böylece hesap KODU kullanıcı tarafından değiştirilse bile (mapping özelliği) semantik anlam (hangi hesaba gittiği) doğrulanmaya devam eder. Motor koduna DOKUNULMADI. `test/tfrs16-inflation-backend-cache.test.js` içindeki geçici "Vaka 5 hariç" istisnası da kaldırıldı — paketin TAMAMI (0 hata) geçiyor. **Tam suite: 376/376 PASS.**
- **[TAMAMLANDI] FAZ B — Sözleşme detayı tab konsolidasyonu (asıl mimari sorunun çözümü).** Önceki fazlarda Modifikasyon & Reassessment / SLB / Alt Kiralama / Toplu Fiş, sözleşme detay ekranından çıkarılıp sidebar'a AYRI SAYFALAR olarak taşınmıştı. Bu, her sayfanın KENDİ, birbirinden bağımsız sözleşme seçici state'ine sahip olmasına yol açtı (`v26SelectedModReassContractId`, `v26SelectedSlbContractId`, `v26SelectedSubleaseContractId`, `v26SelectedAccountingContractId`) — kullanıcı Modifikasyon'da bir sözleşme seçip SLB'ye geçince seçim KAYBOLUYOR, tekrar seçmesi gerekiyordu. Kullanıcının "tfrs16.html karışıktı ama daha sağlam/kullanışlıydı" geri bildiriminin teknik karşılığı tam olarak buydu.
    - **Çözüm:** `openDetail()` içeriği 7 tab'a bölündü — **Özet | Ödeme Planı | Modifikasyon & Reassessment | Satış ve Geri Kiralama | Alt Kiralama | Fişler | Denetim İzi**. Artık TEK sözleşme seçimi (`openDetail`'in id'si) tüm tab'lar için geçerli; detay modalının içinde HİÇBİR ek sözleşme seçici yok. Render/iş mantığı fonksiyonlarının (`renderModificationManagementSection`, `renderSlbSection`, `renderSubleaseSection`, `renderAccountingCenter`, `createModification`, `applyReassessment` vb.) KENDİSİNE dokunulmadı — yalnızca nerede render edildikleri ve event wiring değişti.
    - **Tab state korunuyor:** `gkDetailActiveTab` modül seviyesinde tutulur; bir modification/reassessment/SLB kaydedildikten sonra `openDetail` yeniden çağrıldığında kullanıcı AYNI tab'da kalır (aksi halde her kayıtta "Özet"e fırlardı).
    - **Sidebar'dan kaldırılanlar:** modification/slb/sublease linkleri (artık sözleşme detayında). **Toplu Fiş Merkezi sidebar'da KALDI** — portföy geneli "Tüm Sözleşmeler İçin Toplu Fiş Üret" işlevi tek bir sözleşmeye bağlı değil, dolayısıyla hem sidebar'da (portföy geneli) hem sözleşme detayında (tekil fiş) anlamlı.
    - **Deep-link fonksiyonları SİLİNMEDİ:** `renderModificationReassessmentPage` / `renderSlbManagementPage` / `renderSubleaseManagementPage` hâlâ `deepLinkMap`'te — eski `?open=modification` gibi linkler kırılmasın diye. Yalnızca sidebar'dan kaldırıldılar.
    - Kanıt: `test/contract-detail-tabs-faz-b.test.js` — 12 test, hepsi PASS (7 tab'ın varlığı, varsayılan Özet, tab geçişi, HER TAB'ın kendi panelinin DOM'da olması, SLB/Sublease'in ayrı seçici OLMADAN render edilmesi, detay içinde hiçbir `v26*ContractSelect` bulunmaması, kayıt sonrası tab state korunması, sidebar'dan kaldırılma, Toplu Fiş'in kalması, deep-link fonksiyonlarının silinmemesi). Ayrıca `test/dashboard-sidebar-faz-a.test.js` bu değişikliğe göre güncellendi (5 grup → 4 grup, 16 link → 13 link).
- **[TAMAMLANDI] FAZ C — Cila + Faz B'nin dashboard'da GERÇEKTEN çalışması.** Faz C kapsamında **iki gerçek hata** bulundu:
    1. **[KRİTİK] Faz B dashboard'da fiilen ÇALIŞMIYORDU.** Sözleşme detayı 7 tab'a bölünmüştü ama `#detailModal` **SADECE tfrs16.html'de vardı, frontend/dashboard.html'de YOKTU** — dashboard'dan bir sözleşmeye tıklandığında `openDetail()` modalı bulamayıp erken return ediyor, hiçbir şey açılmıyordu. Modal (ve `#detailContent`, `#detailTitle`, `#scheduleTableContainer`, aksiyon butonları) dashboard'a eklendi; `css/tfrs16.css`'te tanımlı olup dashboard'ın yüklemediği class'lar (`.detail-modal`, `.detail-grid`, `.detail-item`, `.detail-actions`, `.danger-button`, `.empty-state`) `injectV26Styles()`'e kopyalandı (css/tfrs16.css'e DOKUNULMADI).
    2. **[ÖNCEDEN BERİ VAR OLAN HATA] Detay modalındaki üç buton HER ZAMAN patlıyordu.** "Erken Ödeme Uygula" / "Raporu PDF İndir" / "Raporu HTML Aç" butonlarının inline `onclick`'leri `selectedContractId` değişkenini ÇIPLAK bir global gibi kullanıyordu — ama o değişken `js/tfrs16.js`'in IIFE closure'ının İÇİNDE, `window`'a hiç açılmamıştı. Yani bu üç buton **tfrs16.html'de de** her tıklamada `ReferenceError` ile sessizce başarısız oluyordu. `GK_TFRS16.getSelectedContractId()` eklendi, her iki HTML'deki onclick'ler düzeltildi.
    - **Breadcrumb:** detay başlığı artık "Şirket › Sözleşme ID" biçiminde (önceden yalnızca ID vardı, kullanıcı hangi şirketin sözleşmesine baktığını göremiyordu); `title` attribute'unda tedarikçi dahil tam bağlam (hover tooltip).
    - Kanıt: `test/dashboard-faz-c.test.js` — 9 test, hepsi PASS (modalın dashboard'da varlığı, aksiyon butonları, `getSelectedContractId`'nin openDetail öncesi null / sonrası doğru id dönmesi, her iki HTML'de onclick'lerin çıplak global KULLANMADIĞI, breadcrumb metni ve tooltip, detay + tab CSS'inin enjekte edildiği).
    - **Tam test suite: 376/376 PASS.**

**Faz 2:**
- İki menünün (dashboard.html + tfrs16.html) tam envanteri çıkarılır, tekrarlar (Close Dashboard, Hesap Planı Eşleme, Denetim İzi, Konsolidasyon) birleştirilir
- Role göre (muhasebeci/CFO/admin) tek, tutarlı bilgi mimarisi

**Faz 3 (revize — yalnızca kullanıcıya görünen UX maddeleri):**
- Progressive disclosure: az kullanılan formlar (SLB, Alt Kiralama) varsayılan kapalı/accordion
- Tutarlı boş/yükleniyor/hata durumları
- (Opsiyonel) yeni sözleşme için adım-adım sihirbaz

## AYRILAN — RELEASE SONRASINA BIRAKILDI

`js/tfrs16.js`'in iç modülerleştirilmesi (bölüm 26'daki `tfrs16-core.js`/`tfrs16-calculation.js`/... yapısı) **release sonrasında** kalır. Bu saf teknik borçtur — kullanıcıya görünmez, "kullanılabilirlik" hedefine hizmet etmez, 30.000+ satırlık dosyayı bölerken regresyon riski taşır. Faz 0-3 ile KARIŞTIRILMAMALIDIR; bölüm 26'daki "release öncesi kapsamlı refactor yapılmayacak" kuralı bu madde için AYNEN GEÇERLİ kalmaya devam eder.


---

# 33. tfrs16.js REFAKTÖRÜ — FAZ 0: GÜVENLİK AĞI (TAMAMLANDI)

## KARAR DEĞİŞİKLİĞİ

Bölüm 32'nin sonundaki "AYRILAN — RELEASE SONRASINA BIRAKILDI" maddesi
**Görkem tarafından geri alındı** (Eylül 2026): release tarihi ertelendi ve
`js/tfrs16.js` refaktörü release ÖNCESİNE alındı. Bölüm 26 ve 32'deki
"release öncesi kapsamlı refactor yapılmayacak" kuralı bu madde için ARTIK
GEÇERLİ DEĞİLDİR. Diğer maddeler için aynen durur.

## METODOLOJİ — "PUBLIC API DEĞİŞMEZ"

Additive-only kuralı harfiyen değil ruhuna sadık uygulanır:

> Public API (fonksiyon adı + imzası + dönüş değeri) hiçbir çağıran için
> değişmeyecek. Fonksiyonun İÇİ ayrılabilir/yeniden adlandırılabilir —
> dışarıdan görünmez olduğu sürece.

Bu, Strangler Fig / Extract-and-Delegate desenidir. Hiçbir `onclick=`,
`window.X` referansı veya test kırılmaz.

**Her fonksiyon geçişinde zorunlu 6 adımlı doğrulama (sıralı, atlanamaz):**
1. `node --check js/tfrs16.js`
2. `npx jest --runInBand` (mevcut birim testleri)
3. `npm run test:golden` (Faz 0.2 baseline karşılaştırması)
4. Accounting invariants (Faz 0.3 — golden paketine dahil)
5. `npm run test:e2e` (YALNIZCA DOM'a dokunan fonksiyonlar için)
6. `git diff` gözden geçirme (fonksiyon dışı hiçbir satır değişmemeli)

## FAZ 0 TESLİMİ

```
test/golden/
  fixtures/contract-matrix.js     30 kontratlık risk bazlı regresyon matrisi
  fixtures/slb-sublease.js        3 SLB + 2 sublease senaryosu
  lib/normalize.js                non-determinizm temizleme + ID kanonikleştirme
  lib/invariants.js               12 muhasebe invariant'ı
  lib/harness.js                  6 hedef fonksiyonu koşan motor
  lib/baseline-store.js           IMMUTABLE write-once baseline deposu
  lib/compare.js                  yol bazlı derin diff
  lib/run-golden.js               ortak koşucu (yazıcı ve test aynı kodu kullanır)
  baseline/<timestamp>/           salt-okunur (chmod 444) baseline versiyonları
  baseline/LATEST                 aktif karşılaştırma referansı
  matrix-coverage.test.js         Faz 0.1 kapsama denetimi
  determinism.test.js             harness'ın deterministik olduğunun kanıtı
  golden-output.test.js           Faz 0.2 regresyon testi
  invariants.test.js              Faz 0.3 — miras/yeni ihlal ayrımı
  baseline-writer.test.js         GOLDEN_WRITE=1 olmadan ATLANIR
e2e/
  fixtures/api-stub.js            backend stub (gerçek Cloud Run'a BAĞLANMAZ)
  fixtures/test-base.js           kimlik + stub fixture'ları
  smoke.spec.js                   Faz 0.4 minimum akış
playwright.config.js
```

**js/tfrs16.js'te yapılan TEK değişiklik:** ikinci test export shim'ine
(satır ~30295) 11 fonksiyon adı + bir `__seedContractsForTest` yardımcısı
eklendi. Hiçbir fonksiyon gövdesine dokunulmadı. Plandaki 6 hedef
fonksiyonun HİÇBİRİ önceden export edilmiyordu.

## IMMUTABILITY KURALI

Baseline'lar `chmod 444` ile salt-okunur yazılır. `writeBaseline()` var olan
bir versiyon klasörüne yazmayı REDDEDER. Her ölçüm yeni bir timestamp'li
versiyon açar; `LATEST` işaretçisi hangisinin referans olduğunu tutar.
Eski versiyonlar SİLİNMEZ. Kasıtlı bir davranış değişikliği yapıldığında
yeni baseline yazılır ve gerekçesi BU BÖLÜME işlenir.

## FAZ 0'IN ORTAYA ÇIKARDIĞI DAVRANIŞLAR — DURUM

Faz 0 kuralı gereği başlangıçta hiçbir production logic değiştirilmedi.
Aşağıdakiler refaktörün yarattığı sorunlar DEĞİLDİ, eski kodda hâlihazırda
var olan ve golden baseline ile görünür hale gelen davranışlardı. (1) ve
(2) o zamandan beri DÜZELTİLDİ (aşağıdaki "ADVANCE ÖDEME TIMING'İ" maddesi);
(3) kasıtlı olarak Faz 4'e ertelendi; (4) hâlâ açık bir gözlem.

**(1) ✅ DÜZELTİLDİ — Advance (peşin) ödemeli kontratlarda amortisman
tablosu kapanmıyordu.** `INV-03` ihlali — GC-02, GC-04, GC-19. Ayrıntılı
kök neden ve düzeltme için bkz. aşağıdaki "ADVANCE (PEŞİN) ÖDEME TIMING'İ"
maddesi.

**(2) ✅ DÜZELTİLDİ — GC-19: yıllık + advance kontratta dönem 1
roll-forward kimliği bozuktu.** (1) ile aynı kök nedendi; aynı düzeltmeyle
kapandı.

**(3) Modification VE reassessment birlikte uygulanan kontratta iki kod yolu
farklı yükümlülük veriyor** — `INV-11` ihlali, GC-18: 7.130.698 vs 8.364.857
(%17 fark). Mekanizma [Kesin]: `cfoBuildSchedule()` (satır 15369) öncelik
sırası REASSESSED_SCHEDULE > MODIFIED_SCHEDULE > LEASE_SCHEDULE kullanırken,
`calculateLiabilitySplitAsOf()` → `getScheduleAsOfReportingDate()` yolu
`calculateLeaseEngine()` üzerinden gider. Yalnızca modification VEYA yalnızca
reassessment olan 7 kontratta iki yol BİREBİR aynı sonucu veriyor; sapma
SADECE ikisi birlikte olduğunda çıkıyor. Hipotez [Muhtemel]:
`buildReassessedSchedule()` önceki uygulanmış modification'ı yok sayıp
orijinal kontrat şartlarından yeniden kuruyor. **KASITLI OLARAK AÇIK
BIRAKILDI — Faz 4.1'de düzeltilecek.**

**KARAR (Görkem, Eylül 2026) — DOĞRU OLAN YOL:** `cfoBuildSchedule` /
`buildReassessedSchedule`.

Gerekçe (TFRS 16 / IFRS 16):
- Modification (16.44–46) ve reassessment (16.39–43) SONRAKİ ÖLÇÜM
  olaylarıdır; yükümlülük, olay tarihindeki taşıma tutarı üzerinden,
  kalan ödemelerin PV'si ile revize edilir.
- Geçmiş dönemler yeniden yazılmaz; sanki yeni ödeme/vade/oran baştan beri
  varmış gibi tüm schedule'ı inception'dan yeniden kurmak (mevcut
  `calculateLiabilitySplitAsOf` → `calculateLeaseEngine` yolunun yaptığı)
  standarda aykırıdır — hata düzeltmesi/retrospektif restatement durumu
  DEĞİLDİR.

**ZAMANLAMA KARARI — FAZ 4.1'DE KALIYOR.** Gerekçe: (a) davranış
değişikliği saf mekanik fazlarla (1-3) karıştırılmamalı; (b) Faz 3'ün 10
hedef fonksiyonundan hiçbiri `cfoBuildSchedule`/`calculateLiabilitySplitAsOf`'a
dokunmuyor — erteleme hiçbir fazı bloklamıyor; (c) Faz 4.1 zaten aynı
bölgeyi (`cfoGetContractMetricsInternal` → `cfoBuildSchedule`) yeniden
yazacak, tek atomik değişiklikte hem doğru yolu seçip hem konsolide etmek
daha az riskli; (d) golden baseline GC-18'in YANLIŞ davranışını
dondurduğu için Faz 1-3 sırasında kazara bir değişiklik olursa golden
testi zaten kırmızı olur.

**Faz 4.1 kapsamına eklenen iş:** `calculateLiabilitySplitAsOf` /
`getScheduleAsOfReportingDate`'in, `cfoBuildSchedule` ile AYNI önceliği
(REASSESSED_SCHEDULE > MODIFIED_SCHEDULE > LEASE_SCHEDULE) kullanacak
şekilde düzeltilmesi. Düzeltme sonrası: (1) GC-18 için yeni baseline
kaydı — bu maddenin referansıyla; (2) `INV-11` invariant'ının GC-18'de
artık GEÇMESİ beklenir; miras listesinden çıkarılacak. **Kalan tek
miras ihlali budur** (bkz. aşağıdaki "FAZ 0'IN ORTAYA ÇIKARDIĞI"
bölümünün güncellenmiş durumu).

---

## ADVANCE (PEŞİN) ÖDEME TIMING'İ — DÜZELTİLDİ (Eylül 2026)

**Bu madde (1) ve (2) numaralı bulguların GC-18'den FARKLI muamele
görme gerekçesidir** — GC-18 Faz 4'e ertelenirken bu düzeltme **Faz 1
başlamadan, Faz 0 kapanışında** yapıldı.

**Neden farklı zamanlama:** GC-18'in bulunduğu kod Faz 1-3'ün hiçbir
hedef fonksiyonunda değildi (erteleme bedelsizdi). Bu bug ise
`calculateLeaseEngineImpl`'in TAM İÇİNDE — Faz 3'ün planlanan İLK ve EN
DÜŞÜK RİSKLİ hedefi ("1. Saf hesaplama fonksiyonları önce"), ayrıca
planın önerdiği bölünme şeklinde tam olarak `calculateAmortizationTable`
adını alacak parçanın içinde. Faz 4'e ertelenseydi: Faz 3'te bu hatalı
döngü extract-and-delegate ile aynen yeni bir fonksiyona taşınacak,
sonra Faz 4'te YENİDEN bulunup düzeltilecekti — aynı satırı iki kez açma
riski. Ayrıca kapsam GC-18'den çok daha geniş: GC-18 iki özelliğin nadir
kesişimiyken, bu bug HER advance-timing kontratını (Türkiye'de sık
kullanılan bir konvansiyon) etkiliyordu.

**Kök neden [Kesin, doğrulandı]:** `calculateLeaseEngineImpl` schedule
döngüsü (o zamanki satır ~6318), advance/arrears ayrımını YALNIZCA PV
hesabında (`exponent` seçiminde) yapıyordu; amortisman döngüsünde
(`interest = openingLiability * periodRate`) advance/arrears farkı
YOKTU. Advance'de PV ilk ödemeyi t=0'da iskontosuz saymışken, döngü 1.
dönemde de bu ödeme öncesi bir dönem faiz işletiyordu — zaman değerini
çift sayıyordu. Yıllık advance'te (`periodRate` = 12 aylık bileşik oran)
bu, 1. satırda büyük bir faiz tutarının bakiyeye hiç yansımadan
(`principal` 0'a clamp'lenerek) kaybolmasına, dolayısıyla tüm zincirin
şişmesine yol açıyordu (GC-19: son bakiye ~7,02 M TL, kapanmıyordu).

**Düzeltme (annuity-due konvansiyonu):** Yalnızca `advance && i===0`
durumunda: `interest=0`, `principal=min(payment, opening)`. 2. ödemeden
itibaren MEVCUT arrears formülü değiştirilmeden kullanılıyor — çünkü
annuity-due PV'den ilk (iskontosuz) ödeme çıkarıldığında kalan bakiye,
matematiksel olarak kalan (n-1) ödemelik SIRADAN bir anüitenin PV'sine
eşittir (kimlik doğrulandı). Bu yüzden **"son satırı zorla sıfırla"
band-aid'i gerekmedi** — GC-02 son bakiye 6,46e-9 TL'ye (float
toleransı, GC-01 arrears'la aynı mertebe), GC-19 son bakiye tam 0'a
kendiliğinden yakınsadı. Arrears yolu (`advance===false`) bu dala hiç
girmiyor — davranışı BİREBİR korundu (27/30 fixture golden'da hiç
değişmedi).

**Doğrulama:** Baseline invariant ihlalleri 5 → 1'e düştü (GC-02
`INV-03`, GC-04 `INV-03`, GC-19 `INV-01`+`INV-03`, hepsi kapandı; yalnızca
yukarıdaki GC-18 kaldı, o da kasıtlı erteleme). Tam Jest suite 396/396
yeşil. Yeni baseline versiyonu yazıldı, gerekçesi burada.

**KARAR (Görkem, Eylül 2026) — DOĞRU OLAN YOL:** `cfoBuildSchedule` /
`buildReassessedSchedule`.

Gerekçe (TFRS 16 / IFRS 16):
- Modification (16.44–46) ve reassessment (16.39–43) SONRAKİ ÖLÇÜM
  olaylarıdır; yükümlülük, olay tarihindeki taşıma tutarı üzerinden,
  kalan ödemelerin PV'si ile revize edilir.
- Geçmiş dönemler yeniden yazılmaz; sanki yeni ödeme/vade/oran baştan beri
  varmış gibi tüm schedule'ı inception'dan yeniden kurmak (mevcut
  `calculateLiabilitySplitAsOf` → `calculateLeaseEngine` yolunun yaptığı)
  standarda aykırıdır — hata düzeltmesi/retrospektif restatement durumu
  DEĞİLDİR.

**ZAMANLAMA KARARI (Claude önerisi, Görkem'e bırakıldı → Faz 4 seçildi):**
Düzeltme Faz 0/1/2/3 sırasında DEĞİL, **Faz 4.1'de**
(`getCfoAggregateMetrics` konsolidasyonuyla birlikte, tek atomik değişiklik
olarak) yapılacak. Gerekçe: (a) bu davranış değişikliği planın "davranış
sıfır değişiklik" ilkesini ihlal eder, saf mekanik fazlarla (1-3)
karıştırılmamalı; (b) Faz 3'ün 10 hedef fonksiyonundan hiçbiri
`cfoBuildSchedule`/`calculateLiabilitySplitAsOf`'a dokunmuyor — erteleme
hiçbir fazı bloklamıyor; (c) Faz 4.1 zaten aynı bölgeyi
(`cfoGetContractMetricsInternal` → `cfoBuildSchedule`) yeniden yazacak,
bölgeyi iki kez açmak yerine tek seferde hem doğru yolu seçip hem
konsolide etmek daha az riskli; (d) mevcut golden baseline GC-18'in YANLIŞ
davranışını donduruyor — Faz 1-3 sırasında biri bunu kazara değiştirirse
golden testi kırmızı olur, yani erteleme sırasında da bir güvenlik açığı
yok.

**Faz 4.1 kapsamına eklenen iş:** `calculateLiabilitySplitAsOf` /
`getScheduleAsOfReportingDate`'in, `cfoBuildSchedule` ile AYNI önceliği
(REASSESSED_SCHEDULE > MODIFIED_SCHEDULE > LEASE_SCHEDULE) kullanacak
şekilde düzeltilmesi. Düzeltme sonrası: (1) GC-18 için yeni baseline
kaydı — bu maddenin referansıyla; (2) `INV-11` invariant'ının GC-18'de
artık GEÇMESİ beklenir; miras listesinden çıkarılacak.

**(4) Calculation cache imzası eksik alanlar içeriyor**
`getCalculationCacheKey()` (satır ~980) imzasında `paymentTiming`,
`variablePayment`, `usefulLifeMonths`, `ownershipTransfer`, `purchaseOption`,
`shortTermLease`, `lowValueAsset`, `currency` YOK. Aynı `id` ile bu alanları
farklı iki kontrat cache'te çakışabilir [Muhtemel — pratikte tetiklenmesi
için aynı id'nin yeniden kullanılması gerekir]. Faz 4 adayı. Golden harness
bu riski `calculateLeaseEngineImpl`'i doğrudan çağırarak baypas eder.

## FAZ 0 KAPANIŞ DURUMU

| Alt faz | Durum | Kanıt |
|---|---|---|
| 0.1 regresyon matrisi | ✅ | `matrix-coverage.test.js` 8/8 |
| 0.2 golden-output baseline | ✅ | `golden-output.test.js` 5/5, baseline yazıldı |
| 0.3 accounting invariants | ✅ | 379 kontrolden **378 geçer, 1 miras ihlali** (GC-18, kasıtlı Faz 4 ertelemesi) |
| 0.4 Playwright smoke | ✅ | `npm run test:e2e` 5/5, 3 ardışık koşumda kararlı (flaky değil) |

Advance ödeme timing düzeltmesiyle birlikte tam Jest suite **396/396**
yeşil (golden dahil). Playwright smoke suite 5/5 yeşil.

**FAZ 0 TAMAMLANDI.** Faz 1'e (DRY — `core*` yardımcı birleştirmesi)
geçilebilir.

---

# 34. tfrs16.js REFAKTÖRÜ — FAZ 1: DRY KONSOLİDASYONU (TAMAMLANDI)

## ÖZET

Plan Faz 1'in "risk sıfıra yakın: mantık aynı" iddiası **kısmen
yanlış çıktı**. İnceleme, aynı isim kalıbını (`cfo*`/`rpt*`/`v18-24*`)
taşıyan fonksiyonların bazı durumlarda **farklı davrandığını** ortaya
çıkardı. Her fonksiyon çifti tek tek karşılaştırıldı; yalnızca
**gerçekten birebir aynı** olanlar birleştirildi, davranışça farklı
olanlar kasıtlı olarak dışarıda bırakılıp gövdelerinde nedeni
yorumlandı. Bu ayrım yapılmasaydı "davranış sıfır değişiklik" ilkesi
sessizce ihlal edilirdi.

## BULUNAN DAVRANIŞ FARKLARI (konsolide EDİLMEYENLER)

| Fonksiyon(lar) | Fark |
|---|---|
| `v20Clone`, `cloneModificationValue` | Hata durumunda **orijinal değeri** döner, diğer 10 clone fonksiyonu `null` döner |
| `cfoAddMonths` vs `rptAddMonths`/`v18AddMonths` | `months` parametresi cfo'da coerce edilmiyor (undefined→NaN), rpt/v18'de `Number(months\|\|0)` ile 0'a düşüyor |
| `cfoDate` vs `rptDate`/`v18Date` | cfoDate try/catch içermiyor, rpt/v18 içeriyor |
| `v23Round` vs `cfoRound`/`rptRound`/`v18Round` | v23 negatif `decimalPlaces`'i `Math.max(0,...)` ile kelepçeliyor, diğerleri kelepçelemiyor |
| `v19IsoDate`, `v23Date`/`v23DateKey`, `v24Date`/`v24DateKey` | **`parseDate()` KULLANMIYORLAR** — native `new Date(value)`; Türkçe `DD.MM.YYYY`/`DD/MM/YYYY` formatını desteklemiyorlar; ISO tarih-only string'leri UTC/yerel farkıyla farklı yorumlanabilir; `v24Date` ayrıca falsy girdide **şimdiki zamana** düşüyor (null'a değil) |
| `controlMonthsBetween` (→ global `monthsBetween()`) | `rptMonthsBetween`'den FARKLI semantik: "elapsed months" değil "inclusive ay sayısı" (+1 offset, min 1 clamp, gün bileşeni yok sayılıyor) |
| `integrationNumber` | Basit `Number()` değil, önce Türkçe biçimli sayı string'lerini (binlik ayraç/ondalık virgül) normalize ediyor |

Bunların HİÇBİRİNE dokunulmadı — kod tabanında oldukları gibi
kaldılar, yalnızca `js/tfrs16.js` içinde neden konsolide
edilmediklerini açıklayan yorumlar eklendi.

## KONSOLİDE EDİLENLER

Yeni kanonik blok (`js/tfrs16.js`, `cfoNumber` tanımından hemen önce,
~satır 15310): `coreNumber`, `coreRound`, `coreClone`,
`coreCloneOrOriginal` (hata durumunda orijinal değeri döndüren ayrı
varyant), `coreDate`, `coreIsoDate`, `coreNormalizeDate`,
`coreAddDays`, `coreAddMonths`, `coreDaysBetween`, `coreMonthsBetween`.

İnce sarmalayıcıya çevrilen **29 fonksiyon** (davranışları test
edilip doğrulanarak, orijinal imzaları BİREBİR korunarak):

`safeNumber`, `cfoNumber/Round/Clone/Date/IsoDate/AddMonths/DaysBetween`
(7), `rptNumber/Round/Date/IsoDate/AddDays/AddMonths/MonthsBetween/Clone`
(8), `v18Number/Round/Clone/Date/IsoDate/AddDays/AddMonths/DaysBetween`
(8), `v20Clone/NormalizeDate/Amount` (3), `v21Clone` (1),
`v22Clone/NormalizeDate/Amount` (3), `v23Clone/Num/Round` (3),
`v24Number/Clone` (2), `cloneAuditValue`, `cloneModificationValue`,
`controlJson`, `integrationClone`, `controlDate`, `controlDaysBetween`,
`closeIsoDate`.

Plandaki örnekte olmayıp inceleme sırasında bulunan ek tekrarlar da
dahil edildi: `safeNumber` (zaten 25 yerde kullanılan, isimsiz "core"
rolü oynayan bir fonksiyondu), `v20Amount`/`v22Amount`,
`cloneAuditValue`/`cloneModificationValue`/`controlJson`/
`integrationClone` (4 tekil clone fonksiyonu), `controlDate`/
`controlDaysBetween`, `closeIsoDate`.

## buildJournalLine — ORTAK FİŞ SATIRI ÜRETİCİSİ

`generateModificationJournal` (satır ~4432) ve
`generateReassessmentJournal` (satır ~3141)'daki tekrarlanan
`{accountKey, account, debit, credit, source, controlStatus}` push
kalıbı `buildJournalLine()` helper'ına çekildi — **12 çağrı
sitesinden 11'i** dönüştürüldü.

**1 istisna, kasıtlı olarak dokunulmadı:** `generateModificationJournal`
içindeki SCOPE_DECREASE dalının kazanç/kayıp satırı `accountKey`
alanını HİÇ içermiyordu (diğer tüm satırlardan farklı olarak).
`buildJournalLine(undefined, ...)` çağırmak `accountKey: undefined`
anahtarını EKLERDİ — bu, anahtarın TAMAMEN YOK olmasından farklıdır
(`'accountKey' in entry` gibi bir kontrol varsa sessiz bir davranış
farkı yaratırdı). Bu satır orijinal inline haliyle bırakıldı.

## mapImportedContract / mapDbContractToUi — İNCELENDİ, KONSOLİDE EDİLMEDİ

Plan bunları "muhtemelen tekrarlı, incelenecek" olarak işaretlemişti.
İnceleme sonucu: **DRY ihlali değiller.** `mapImportedContract`,
Excel/CSV toplu içe aktarımdan bulanık Türkçe/İngilizce kolon adı
eşleştirmesiyle (`findImportValue`) ve Türkçe biçimli sayı
ayrıştırmasıyla (`"1.234,56"` → `.replace(/\./g,"").replace(",",".")`)
çalışıyor; `mapDbContractToUi` ise backend DB satırından
(camelCase/snake_case varyantları) çok daha zengin bir alan kümesi
(modificationJournals, saleAndLeaseback, sublease, earlyPayments,
auditTrail...) dolduruyor. Girdi formatları, alan kapsamları ve
doğrulama mantıkları temelden farklı — paylaşılan kod yok, yalnızca
isim benzerliği var. Dokunulmadı.

## getTotalLeaseLiability ailesi — Faz 4'e ertelendi (plan gereği)

`getTotalLeaseLiability`/`getCurrentLeaseLiability`/
`getNonCurrentLeaseLiability`/`getTotalRuoAssets` planın kendisinde
"Faz 4'te tek geçişe indirilecek" olarak işaretli — Faz 1
kapsamına alınmadı, dokunulmadı.

## DOĞRULAMA

- Her fonksiyon grubu (7 grup: cfo/rpt/v18 → v20/21/22 → v23/24 →
  dağınık tekiller → controlDate ailesi → buildJournalLine ×2)
  dönüştürüldükten hemen sonra `node --check` + tam Jest suite (golden
  + invariants dahil) koşuldu, hepsi yeşil.
- Final `git diff` gözden geçirmesi: değişen HER hunk tek tek
  incelendi, hiçbir dönüşümün amaçlanan fonksiyon gövdesi dışına
  taştığı görülmedi.
- Tam suite: **396/396 yeşil** (golden dahil — 30 kontratın hiçbiri
  sapma göstermedi, `buildJournalLine`'ın modification/reassessment
  fişlerini birebir aynı ürettiğinin kanıtı).
- Dosya satır sayısı: 31.726 → 31.806 (+80 net — büyük ölçüde
  yorum/dokümantasyon; ~20 fonksiyon gövdesi 1-3 satıra indi ama
  core blok + kapsamlı "neden dokunulmadı" yorumları bunu dengeledi).

## FAZ 1 KAPANIŞ DURUMU

✅ TAMAMLANDI. Faz 2'ye (İsimlendirme) geçilebilir.

---

# 35. tfrs16.js REFAKTÖRÜ — FAZ 2: İSİMLENDİRME (TAMAMLANDI)

## Kapsam kararı

Plan iki ayrı iş istiyordu: (1) dış API yüzeyinin ("asla adı
değişmeyecek" liste) çıkarılması, (2) versiyon önekli fonksiyonlara
isim DEĞİŞTİRMEDEN JSDoc eklenmesi.

**Ölçek gerçeği:** Dosyada toplam **329 versiyon önekli fonksiyon**
var (`cfo/rpt/v18-24/control/close/integration` önekleri). Bunların
TAMAMINA JSDoc eklemek "orta efor" değil, büyük bir iş olurdu ve
planın kendisi bu adımın "düşük katma değer" taşıdığını belirtiyor.
Bu yüzden kapsam **Faz 1'de gerçekten dokunulan 43 sarmalayıcı
fonksiyonla** sınırlı tutuldu — geri kalan ~286 versiyon önekli
fonksiyon (henüz `core*`'a delege etmeyen, kendi bağımsız mantığını
koruyan fonksiyonlar) bu turda ellenmedi.

## 1. Dış API yüzeyi çıkarıldı — `FAZ2_API_SURFACE.md` + `gk_tfrs16_api_surface.txt`

`window.GK_TFRS16` üzerinden **7 ayrı** `Object.assign` bloğuyla
(satır ~20858/25557/27016/27480/27833/30109/30252) **552 benzersiz
isim** (fonksiyon + sabit) dışarı açılıyor — dosyanın TAMAMI bu.

HTML `onclick=` taraması: 21 referans bulundu, **hiçbiri
`js/tfrs16.js`'de tanımlı değil** (hepsi admin panel sayfalarına ait,
başka bir JS dosyasında) — bu refaktörün kapsamı açısından onclick=
kaynaklı bir kısıt yok.

HTML'den doğrudan `GK_TFRS16.X()` çağrısı yapılan 3 kritik isim:
`applyEarlyPayment`, `exportReport`, `getSelectedContractId` — bunlarda
imza değişikliği HTML'i anında kırar.

**Faz 3 için pratik sonuç:** SRP bölme sırasında ana fonksiyon adı
552'lik listedeyse (çoğu ana motor fonksiyonu muhtemelen öyle)
KESİNLİKLE değişmez; extract edilen YENİ iç yardımcılar bu listede
olmadığı için serbestçe temiz isimlendirilebilir.

## 2. JSDoc eklendi — 43 sarmalayıcı fonksiyon

Faz 1'de `core*`'a delege eden TÜM fonksiyonlara (`safeNumber`,
`cfoNumber/Round/Clone/Date/IsoDate/AddMonths/DaysBetween`, `rpt*` (8),
`v18*` (8), `v20*` (3), `v21Clone`, `v22*` (3), `v23*` (3), `v24*` (2),
4 tekil clone, `controlDate/DaysBetween`, `closeIsoDate`) planın
önerdiği kalıpta JSDoc eklendi:

```js
/** @deprecated-name Kalıcı: v18Number — dış çağrılarla (window.GK_TFRS16,
    olası eski referanslar) uyumluluk için korunuyor. Bkz. coreNumber. */
function v18Number(value, fallback = 0) { return coreNumber(value, fallback); }
```

Davranış farkı taşıyan fonksiyonlarda (`v20Clone`,
`cloneModificationValue`, `cfoAddMonths`, `rptAddMonths`/`v18AddMonths`,
`v23Round`, `rptDate`/`v18Date`) JSDoc'a bu farkı özetleyen tek
cümlelik not eklendi (tam gerekçe Faz 1 bölümünde).

**Saf ekleme:** Bu adım hiçbir satırı silmedi/değiştirmedi — yalnızca
43 yorum satırı eklendi. `git diff` ile doğrulandı (43 `+@deprecated-name`
satırı, 0 yeni silme).

## Dokunulmayanlar

- `core*` fonksiyonlarının kendisi — zaten anlamlı isimlerle doğdu,
  JSDoc'a ihtiyaçları yok (plan maddesi).
- Kalan ~286 versiyon önekli fonksiyon — henüz `core*`'a delege
  etmiyorlar, bu turun kapsamı dışında bırakıldı.
- Faz 3'te SRP ile ortaya çıkacak yeni iç yardımcılar için
  isimlendirme kuralı (fiil+nesne) — henüz uygulanacak bir şey yok,
  Faz 3 başladığında devreye girecek.

## DOĞRULAMA

`node --check` + tam Jest suite (golden + invariants dahil):
**396/396 yeşil.** `git diff` gözden geçirmesi: yalnızca JSDoc
satırları eklendi, fonksiyon gövdelerinde hiçbir değişiklik yok.

## FAZ 2 KAPANIŞ DURUMU

✅ TAMAMLANDI. Faz 3'e (SRP — büyük fonksiyonları böl) geçilebilir.
Faz 3, planın kendi risk sıralamasına göre şu 10 fonksiyonu hedefliyor
(düşük riskliden yükseğe): `calculateLeaseEngineImpl`,
`generateModificationJournal`, `generateReassessmentJournal`,
`validateContract`, `downloadTemplate`,
`renderPaymentScheduleSection`/`openContractModal`,
`createBulkJournalModal`, `renderBulkJournalResults`,
`renderCloseDashboardPage`, `renderAccountingCenter`.

---

# 36. tfrs16.js REFAKTÖRÜ — FAZ 3: SRP BÖLME (DEVAM EDİYOR)

## Sıra kararı

Görkem'e Faz 3 başlamadan önce `calculateLeaseEngineImpl`'in özel bir
risk taşıdığı bildirildi (bkz. aşağıdaki risk notu) ve iki seçenek
sunuldu: bu fonksiyonu izole ele almak, ya da planın kendi sırasına
sadık kalmak. **Karar: plana sadık kalındı** — `calculateLeaseEngineImpl`
Faz 3'ün ilk hedefi olarak, normal 6 adımlı doğrulama zinciriyle
işlendi.

## FAZ 3 SRP RİSKİ — calculateLeaseEngineImpl (bölme ÖNCESİ tespit edildi)

`calculateLeaseEngineImpl` içinde üç kod bölgesi **aynı 0-tabanlı
index'i** paylaşıyordu: eskalasyon (`paymentDates.map`), PV hesabı
(`paymentDates.forEach`, advance için `exponent = index*stepMonths`)
ve amortisman döngüsü (`paymentAmounts[i]`, `isFirstAdvancePayment =
advance && i===0` — Faz 0'ın advance-timing düzeltmesi). Bu üçünün
"index 0" tanımı aralarında hiçbir yeniden sıralama/filtreleme
olmadığı için tutarlıydı. SRP bölmesinin bunu bozma riski: bölünmüş
parçalardan biri diziyi yeniden dilimler/kaydırırsa, `i===0` kontrolü
artık gerçek ilk ödemeyi işaret etmez ve Faz 0'da kapatılan bug SESSİCE
geri açılır.

**Önlem (uygulandı):** `paymentAmounts`/`paymentDates`/`advance`/
`periodRate` bölünmüş fonksiyonlara (`applyLeaseEscalation` →
`calculateAmortizationTable`) DOĞRUDAN parametre olarak, hiçbir ara
dönüşüm olmadan geçirildi. `calculateAmortizationTable` bu diziyi
KENDİSİ yeniden üretmiyor/dilimlemiyor — `applyLeaseEscalation`'ın
ürettiği haliyle alıyor.

## Bölme

**Önce (tek fonksiyon, 537 satır, ~5851-6387):** `calculateLeaseEngineImpl`.

**Sonra (7 fonksiyon, extract-and-delegate):**

| Yeni fonksiyon | Sorumluluk |
|---|---|
| `buildLeaseEngineAssumptions(contract)` | Kontrat alanlarını normalize edilmiş `assumptions` objesine çevirir |
| `buildExemptLeaseResult(contract, assumptions)` | TFRS 16.5-8 istisnası (kısa vadeli/düşük değerli) — uygulanamazsa `null` |
| `resolveLeaseEngineCore(contract, assumptions)` | payment/rate/months/stepMonths/advance/periodRate + ödeme tarihleri; geçersiz girdide `{earlyReturn: ...}` |
| `applyLeaseEscalation(contract, assumptions, core)` | `paymentAmounts` dizisini üretir (eskalasyon uygulanmış) |
| `calculateInitialLeaseMeasurement(assumptions, core, esc)` | PV (initialLiability), initialROU, depreciation parametreleri |
| `calculateAmortizationTable(assumptions, core, esc, measurement)` | Dönem dönem roll-forward tablosu — **advance-fix burada, satır satır aynı** |
| `assembleLeaseEngineResult(assumptions, core, measurement, schedule)` | Nihai dönüş objesini paketler |

`calculateLeaseEngineImpl` artık 7 fonksiyonu sırayla çağıran 12
satırlık ince bir orkestratör. **Public API imzası
(`calculateLeaseEngineImpl(contract)` → aynı dönüş şekli) değişmedi**
— `window.GK_TFRS16` export'u ve test shim'i aynı isme işaret etmeye
devam ediyor.

## Uygulama yöntemi — satır-bazlı doğrulanmış değiştirme

Bu ölçekteki bir değişiklik için `str_replace`'in metin eşleştirmesi
yerine daha güvenli bir yöntem kullanıldı: orijinal 537 satır önce
ayrı bir dosyaya alındı, dosyanın o an gerçekten o satırlarda o metni
İÇERDİĞİ (Python ile satır satır) DOĞRULANDI, ancak o zaman yeni içerik
yazıldı. Bu, "yanlış yeri değiştirme" riskini sıfırladı.

## DOĞRULAMA

- `node --check`: OK
- Tam Jest suite (golden + invariants dahil): **396/396 yeşil** —
  GC-02/GC-04/GC-19 (advance-timing) ve GC-18 dahil **hiçbir fixture
  sapmadı**. Bu, yukarıdaki risk notunun endişe ettiği index kayması
  senaryosunun GERÇEKLEŞMEDİĞİNİN doğrudan kanıtı.
- `git diff` gözden geçirmesi: değişiklik yalnızca fonksiyon
  sınırları içinde; dosyanın geri kalanı (14526'dan sonrası)
  önceki fazlardan değişmeden duruyor.
- Playwright: bu fonksiyon DOM'a dokunmuyor (saf hesaplama), Faz 0.4
  kapsam kuralı gereği gerekmiyor.

**Kalan Faz 3 hedefleri:** `generateModificationJournal`,
`generateReassessmentJournal`, `validateContract`, `downloadTemplate`,
`renderPaymentScheduleSection`/`openContractModal`,
`createBulkJournalModal`, `renderBulkJournalResults`,
`renderCloseDashboardPage`, `renderAccountingCenter`.

## KRİTİK ÖLÇÜM DÜZELTMESİ — planın satır sayıları kısmen yanlış

Kalan hedeflere geçmeden önce her birini **isimle** yeniden ölçtüm
(planın verdiği satır numaralarına güvenmedim, çünkü
`calculateLeaseEngineImpl` bittikten sonra dosya satırları kaymıştı).
Sonuç, planın orijinal ölçümünün BİLE bazı fonksiyonlar için yanlış
olduğunu gösterdi — bu benim Faz 1/2/3 değişikliklerimden değil,
planın kendi ölçüm aracının hatasından kaynaklanıyor (muhtemelen
template literal içindeki `{}` karakterlerine takılan naif bir
brace-sayma yöntemi — aynı hatayı ben de ilk denememde yaptım).

| Fonksiyon | Plan iddiası | Gerçek ölçüm |
|---|---|---|
| `renderAccountingCenter` | 618 | **264** |
| `validateContract` | 599 | **111** |
| `createBulkJournalModal` | 463 | **461** ✓ |
| `renderBulkJournalResults` | 462 | **460** ✓ |
| `renderCloseDashboardPage` | 402 | **400** ✓ |
| `downloadTemplate` | 394 | **192** (bölme öncesi) |
| `renderPaymentScheduleSection` | 249 | **247** ✓ |
| `openContractModal` | 249 | **247** ✓ |

`generateModificationJournal` (504→95) ve `generateReassessmentJournal`
(348→41) içinse gerçek küçülme SEBEBİ biliniyor: Faz 1'in
`buildJournalLine` konsolidasyonu bunları organik olarak küçülttü.

**Sonuç — üç fonksiyon SRP bölmesi olmadan Faz 3 kapsamından çıkarıldı:**
`validateContract` (111 satır, zaten 9 basit alan kontrolü — bölmek
gereksiz dolaylama eklerdi), `generateModificationJournal` (95 satır),
`generateReassessmentJournal` (41 satır) — üçü de zaten tek
sorumluluğa sahip, okunabilir, makul boyutta.

## downloadTemplate — TAMAMLANDI

Plan önerisiyle birebir örtüştü: ~100 satırlık statik örnek satır
verisi fonksiyondan çıkarılıp `LEASE_IMPORT_TEMPLATE_ROWS` sabitine
taşındı; `downloadTemplate()` artık yalnızca XLSX/CSV yazma işini
yapan ~65 satırlık bir fonksiyon.

**Doğrulama:** `node --check` + tam Jest suite (golden dahil):
396/396 yeşil. Ayrıca Playwright smoke testi (`şablon indirme çalışır`)
gerçek tarayıcıda özel olarak koşuldu — indirme akışı bozulmadı.

## FAZ 3 — KATEGORİ 1 (saf hesaplama) KAPANDI

✅ `calculateLeaseEngineImpl` — 7 fonksiyona bölündü
✅ `downloadTemplate` — veri/yazma ayrıldı
⏭️ `validateContract`, `generateModificationJournal`,
`generateReassessmentJournal` — zaten küçük, bölme gerekmedi

**Sırada Kategori 2 (render fonksiyonları — DOM yan etkisi var,
Playwright doğrulaması ŞART):** `renderPaymentScheduleSection` (247),
`renderAccountingCenter` (264), `renderBulkJournalResults` (460),
`renderCloseDashboardPage` (400).

**En son Kategori 3 (modal/event wiring — en yüksek risk):**
`openContractModal` (247), `createBulkJournalModal` (461).

---

## ⚠️ OTURUM İÇİ OLAY — `git checkout` neredeyse tüm işi sildi

`renderPaymentScheduleSection` bölünmesi sırasında bir whitespace
uyuşmazlığını "geri almak" için `git checkout -- js/tfrs16.js`
çalıştırıldı. **Bu komut dosyayı orijinal commit'e (`d8ef6d2`)
döndürdü — sadece o turun değil, Faz 0'dan itibaren TÜM oturumun
değişikliklerini sildi** (advance-timing düzeltmesi, tüm Faz 1 DRY
konsolidasyonu, Faz 2 JSDoc'ları, Faz 3'ün calculateLeaseEngineImpl
ve downloadTemplate bölmeleri). Hiçbir şey commit edilmemişti, bu
yüzden `git checkout` geri getirilemez bir silme işlemi oldu.

**Kurtarma:** En son teslim edilen zip'ten (`tfrs16-faz3-kategori1-
tamamlandi.zip`, bir önceki turun sonunda üretilmişti) `js/tfrs16.js`
geri yüklendi. İçerik `grep`/`node --check`/tam Jest suite ile
doğrulandı (396/396), kayıp yoktu — kurtarma tam başarılı oldu.

**KURAL (bundan sonra geçerli): Bu oturumda hiçbir şey commit
edilmediği için `git checkout`/`git reset --hard` gibi komutlar
KULLANILMAYACAK.** Bir değişikliği geri almak gerekirse: (a) en son
teslim edilen zip'ten ilgili dosya geri yüklenir, veya (b) `str_replace`
ile nokta atışı düzeltme yapılır. Zip'ler artık yalnızca teslimat
değil, aynı zamanda kurtarma noktası.

**İkinci kök neden (whitespace hatasının kendisi):** İlk bölme
denemesinde sınırları `grep -n "."` ile bulmuştum — bu komut BOŞ
SATIRLARI ATLAR, bu yüzden gösterdiği satır numaraları dosyanın gerçek
satır numaralarıyla ÖRTÜŞMÜYORDU (boş satırlar sayılmadığı için
kayıyordu). Düzeltme: `cat -n` (tüm satırları numaralandırır) ile
sınırlar yeniden bulundu, sonra Python'da ham metin parçaları
CÜMLE/SATIR EKLEMEDEN yeniden birleştirilip **orijinalle byte-bazlı
eşleştiği doğrulandıktan SONRA** dosyaya yazıldı.

---

## renderPaymentScheduleSection — TAMAMLANDI (Kategori 2'nin ilki)

Saf template-string üreten bir fonksiyon olduğu tespit edildi (içinde
`document.`/`addEventListener`/`querySelector` YOK) — DOM yan etkisi
yok, risk profili aslında Kategori 1'e (saf hesaplama) daha yakın.
Yine de plan sınıflandırmasına sadık kalınıp Playwright ile ayrıca
doğrulandı.

**Bölme:** 247 satırlık tek fonksiyon → 4 alt fonksiyon
(`renderPaymentScheduleHeader`, `renderPaymentScheduleFilters`,
`renderPaymentScheduleTableShell`, `renderPaymentScheduleFooterContainers`)
+ bunları `${}` interpolasyonuyla birleştiren ince ana fonksiyon.

**Doğrulama yöntemi — bu bölme için özellikle güçlendirildi:**
Satır-bazlı doğrulanmış değiştirmeye ek olarak, fonksiyonun ÇIKTISI
(çağrılmış hali) bölünme öncesi ve sonrası ayrı ayrı yakalanıp
**MD5 karşılaştırıldı: `183d7ca5eccb8e6b67b4ff0759e9e086` — birebir
aynı, 7910 byte, sıfır fark.** Bu, template-literal bölmelerinde
whitespace/satır sonu tutarlılığını kanıtlamanın en güvenilir yolu —
elle akıl yürütmekten (yukarıdaki olayın gösterdiği gibi) çok daha
sağlam.

**Diğer doğrulama:** `node --check` OK, tam Jest suite (golden
dahil) 396/396, Playwright smoke suite 5/5 (özellikle "kontrat
oluştur → detay aç → ödeme planı gör" testi 36 satırlık tabloyu
gerçek tarayıcıda doğruladı).

## FAZ 3 — KATEGORİ 2 DURUMU

✅ `renderPaymentScheduleSection`
✅ `renderAccountingCenter`
✅ `renderBulkJournalResults`
⏭️ `renderCloseDashboardPage` — KASITLI OLARAK BÖLÜNMEDİ (aşağıya bakınız)

---

## ⚠️ İKİNCİ WHITESPACE HATASI VE DERSİ — renderBulkJournalResults

`renderBulkJournalResults` bölmesi ilk denemede yine byte-bazlı fark
verdi (10 byte). Bu kez neden farklıydı ve iki AYRI kök neden çıktı:

**Kök neden 1:** Önceki iki bölmede (`renderPaymentScheduleSection`,
`renderAccountingCenter`) orijinal `return \`...\`` yapısını KORUYUP
içine `${helper()}` ile satır-içi substitution yapmıştım — bu güvenliydi
çünkü dış template'in kendi satır sonları hiç değişmiyordu. Bu
fonksiyonda ise `summary.innerHTML = \`...\`` atamasını TAMAMEN bir
fonksiyon ÇAĞRISIYLA (`summary.innerHTML = renderBulkJournalSummaryCards(...)`)
değiştirdim — bu durumda helper'ın DÖNÜŞ DEĞERİ, orijinal backtik'ler
arasındaki İÇERİĞİN TAMAMINI kendi başına, eksiksiz üretmek zorunda.
İlk denemede `summary.innerHTML = \`` satırının backtik'ten hemen
sonraki kendi satır sonu karakterinin de string'in bir parçası
olduğunu unutmuştum (extraction satır 96'dan başlıyordu, ama satır
95'in kendi \n'i de içeri dahil edilmeliydi).

**Kök neden 2 (daha incelikli):** Kapanış backtik satırı ("    \`;")
üzerinde backtik'ten ÖNCE gelen girinti (4 boşluk) de string'in SON
karakterleriymiş — bunu da atlamıştım. JS template literal'de kapanış
backtik'i bir SINIRLAYICI; ondan hemen önceki, AYNI SATIRDAKİ her
karakter (whitespace dahil) string'in parçasıdır.

**Doğrulama yöntemi bu kez daha da güçlendirildi:** Önceki ikisinde
saf string dönen fonksiyonların ÇIKTISINI doğrudan karşılaştırmıştım.
Bu fonksiyon gerçek `innerHTML` ataması + global `bulkJournalData`
state'i kullandığı için, `__seedBulkJournalDataForTest()` adında (Faz
0'ın `__seedContractsForTest`'iyle AYNI desende) yeni bir test-shim
yardımcısı eklendi, gerçek DOM elemanları oluşturulup fonksiyon
çağrıldı, `summary.innerHTML`/`preview.innerHTML`/export butonunun
durumu **MD5 ile** karşılaştırıldı: `d93b248e2c9b4637512d41d93ded4c0f`
— birebir aynı.

**Ayrıca bu turda bir kurtarma daha gerekti:** Önceki turun sonunda
teslim edilen zip (`tfrs16-faz3-payment-schedule-split.zip`)
`renderAccountingCenter` bölmesinden ÖNCE alınmış olduğu ortaya çıktı
— geri yüklemede o bölme kayboldu, fark edilip yeniden uygulandı (aynı
önceden doğrulanmış MD5 ile teyit edildi). **Ders: zip'leri HER
fonksiyon bölmesi sonrası almak, sadece "kontrol noktası" hissedilen
yerlerde değil.**

## FAZ 3 — KATEGORİ 3 (modal/event wiring — en yüksek risk) DURUMU

`openContractModal` incelendi: plan bu kategoriyi "event listener
sırası/timing hassas" diye en riskli işaretlese de, bu fonksiyonun
KENDİSİ **hiçbir `addEventListener` çağrısı içermiyor** (doğrulandı) —
sadece form alanlarını `contract` nesnesinden dolduruyor (`setInput`/
`setCheckbox` × 30+ çağrı) ve modalı gösteriyor. Gerçek risk profili
`renderCloseDashboardPage`'den çok daha düşük.

✅ `openContractModal` — form doldurma bloğu (187 satır, `setInput`/
`setCheckbox`/`injectAssetClassField`/`injectV26CurrencyFields`)
`populateContractFormFields(contract)`'a extract edildi. try/catch
sınırı AYNI YERDE (`openContractModal` içinde) bırakıldı — extract
edilen fonksiyon hata fırlatırsa hâlâ aynı catch tarafından
yakalanıyor, mevcut hata-kurtarma davranışı (modal her durumda açılır)
korunuyor.

**Doğrulama:** Ham yeniden birleştirme byte-bazlı doğrulandı (kod
VERBATIM taşındı, hiçbir koşul ifadesi değişmedi — `contract?.field`
gibi ifadelerin mantığı aynı). Tam Jest suite 396/396, Playwright
smoke suite 5/5 (yeni sözleşme yolu — `contract=null` — gerçek
tarayıcıda doğrulandı). Düzenleme yolu (`contract≠null`) için ayrı bir
e2e testi YAZILMADI çünkü extraction hiçbir koşullu ifadeyi
değiştirmedi — `contract?.field` ifadelerinin `contract=null` dalı
zaten test ediliyor, `contract≠null` dalı AYNI ifadenin diğer tarafı,
farklı bir kod yolu değil.

⏳ Kalan: `createBulkJournalModal` (461 satır)

## `createBulkJournalModal` — TAMAMLANDI (en yüksek riskli hedef)

461 satır, **6 gerçek `addEventListener`** — planın "en riskli"
dediği kategorinin tam örneği. İnceleme sonucu: 6 listener'ın HEPSİ
İSİMLİ, top-level fonksiyonlara işaret ediyor
(`closeBulkJournalModal`, `exportBulkJournals`,
`updateBulkVoucherDefaults`, `generateBulkJournals`) —
`createBulkJournalModal`'ın KENDİ closure'ından yakalanan mutable
state YOK (`renderCloseDashboardPage`'in aksine). Bu, gerçek riski
plan kategorisinin ima ettiğinden düşük kılıyor.

**Bölme:** 3 fonksiyon — `buildBulkJournalModalHtml()` (saf HTML
üretimi), `wireBulkJournalModalEvents()` (6 listener bağlama),
`createBulkJournalModal()` (idempotent kontrol + eleman oluşturma +
body'ye ekleme + yukarıdaki ikisini çağıran ince orkestratör).

**Doğrulama yöntemi:** Bir önceki `renderBulkJournalResults`
hatasından çıkarılan İKİ dersin (backtik-sonrası satır sonu +
backtik-öncesi girinti) İLK denemede doğru uygulanmasıyla,
`outerHTML` MD5'i **ilk seferde** birebir eşleşti: `a54731e9...`.
Doğrulama akışı: bölünmüş hali geçici olarak orijinaline döndür →
"before" yakala → bölünmüş hale geri dön → "after" yakala → MD5
karşılaştır.

**Event-wiring'in FİİLEN çalıştığını kanıtlayan yeni Playwright
testi eklendi** ("toplu fiş modalı açılır ve kapanır"): kontrat
oluştur → "Fişler" tab'ına geç → "Toplu Fiş Üret" butonuna tıkla →
modalın açıldığını doğrula → **`#closeBulkJournalModal`'a tıkla**
(gerçek DOM'da gerçek bir click event'i, `wireBulkJournalModalEvents`
tarafından bağlanan listener'ı tetikliyor) → modalın kapandığını
doğrula. Bu, sadece DOM yapısını değil, event wiring'in gerçekten
işlevsel olduğunu kanıtlıyor — bu fonksiyonun asıl risk kategorisiydi.

**Sonuç:** Tam Jest suite 396/396, Playwright smoke suite **6/6**
(yeni test dahil), 3 ardışık koşumda kararlı (18/18).

## FAZ 3 — TÜM KATEGORİLER TAMAMLANDI

| Kategori | Fonksiyon | Durum |
|---|---|---|
| 1 — saf hesaplama | `calculateLeaseEngineImpl` | ✅ 7 fonksiyona bölündü |
| 1 — saf hesaplama | `downloadTemplate` | ✅ veri/yazma ayrıldı |
| 1 — saf hesaplama | `validateContract` | ⏭️ zaten küçük (111 satır), atlandı |
| 1 — saf hesaplama | `generateModificationJournal` | ⏭️ Faz 1'de zaten küçüldü (95 satır) |
| 1 — saf hesaplama | `generateReassessmentJournal` | ⏭️ Faz 1'de zaten küçüldü (41 satır) |
| 2 — render | `renderPaymentScheduleSection` | ✅ 4 fonksiyona bölündü |
| 2 — render | `renderAccountingCenter` | ✅ 4 fonksiyona bölündü |
| 2 — render | `renderBulkJournalResults` | ✅ 3 fonksiyona bölündü |
| 2 — render | `renderCloseDashboardPage` | ⏭️ KASITLI bölünmedi (closure/re-render riski) |
| 3 — modal/event | `openContractModal` | ✅ form doldurma extract edildi |
| 3 — modal/event | `createBulkJournalModal` | ✅ 3 fonksiyona bölündü |

**Faz 3 kapandı.** Sırada Faz 4 (Performans — `getTotalLeaseLiability`
ailesinin konsolidasyonu + GC-18'in kasıtlı ertelenmiş düzeltmesi, bkz.
bölüm 33) var.

---

# 37. tfrs16.js REFAKTÖRÜ — FAZ 4: PERFORMANS (TAMAMLANDI)

## 4.1a — GC-18 DÜZELTMESİ (bölüm 33'ten devralınan karar, şimdi uygulandı)

**Kök neden [Kesin, kod okunarak doğrulandı]:** `calculateLiabilitySplitAsOf`
iki FARKLI şekilde çağrılıyordu:
- **3 argümanlı** (`scheduleOverride` ile) — yalnızca `cfoGetLiabilitySplit`
  (CFO Dashboard katmanı) tarafından, `cfoBuildSchedule`'ın seçtiği
  DOĞRU (REASSESSED>MODIFIED>LEASE önceliğine sahip) schedule ile.
- **2 argümanlı** (override'sız) — `getScheduleAsOfReportingDate`
  üzerinden, bu da doğrudan `calculateLeaseEngine(contract)` çağırıyordu
  — **modification/reassessment'ı TAMAMEN YOK SAYARAK.**

**Etki alanı beklenenden GENİŞ çıktı** — yalnızca golden testindeki
GC-18 değil, 2 argümanlı forma bağımlı ÜRETİM kod yolları da etkileniyordu:
`calculateCurrentLiabilityAsOf`, `calculateNonCurrentLiabilityAsOf`,
`calculateNext12Months`, **V23/TMS21 kapanış fişi üretimi (satır ~8712
— gerçek muhasebe fişi kaydı!)**, `controlClassification` (bir doğrulama/
kontrol fonksiyonu — ironik biçimde YANLIŞ değeri "doğru" kabul ediyordu).

**Düzeltme öncesi doğrulama:** `buildReassessedSchedule` →
`buildReassessmentHistorySchedule`'ın kodu okunarak, reassessment
schedule'ının kendi İÇİNDE, reassessment'ın effectiveDate'inden ÖNCEKİ
dönemler için modification'ı da (varsa) tarihsel taban olarak
kapsadığı doğrulandı (`historical.concat(future)`, tüm sözleşme
ömrünü kapsıyor) — yani "REASSESSED_SCHEDULE'ı seç" kararı, reassessment
henüz yürürlüğe girmemiş raporlama tarihleri için de GÜVENLİ (o
dönemler için otomatik olarak modification-düzeltilmiş rakamları
veriyor, reassessment'ı YOK SAYMIYOR ama henüz UYGULAMIYOR da).

**Düzeltme:** `resolveContractScheduleSource(contract)` adında YENİ bir
CORE-katmanı fonksiyonu eklendi (`cfoBuildSchedule`'ın eski mantığının
BİREBİR taşınmış hali). `cfoBuildSchedule` artık buna delege eden ince
bir sarmalayıcı. `getScheduleAsOfReportingDate` artık
`calculateLeaseEngine(contract)` yerine `resolveContractScheduleSource(contract)`
kullanıyor — **TEK kaynak, iki farklı schedule-seçim mantığı kalmadı.**

**Doğrulama:** Yeni golden baseline yazıldı (davranış KASITLI
değişti — GC-18'in `split` değeri 8.364.857'den 7.130.697'ye düştü,
`cfo` değeriyle ARTIK EŞLEŞİYOR). **Invariant sonucu: 379/379 — Faz
0'dan beri açık kalan TEK miras ihlali (INV-11, GC-18) kapandı.** Tam
Jest suite 396/396, Playwright 6/6.

## 4.1b — `getCfoAggregateMetrics` konsolidasyonu (planın performans önerisi)

`getTotalLeaseLiability`/`getCurrentLeaseLiability`/
`getNonCurrentLeaseLiability`/`getTotalRuoAssets` her biri AYNI
`cfoGetContracts().filter(...).map(cfoGetContractMetricsInternal)`
zincirini bağımsız çalıştırıyordu. Bir CFO Dashboard bu 4 fonksiyonu
art arda çağırırsa (tipik kullanım), reassessment/modification'lı
kontratlarda pahalı olan bu zincir (control sonuçları, next-12-ay
filtreleme, `buildReassessedSchedule` dahil) **4 kez** tekrarlanıyordu.

**Bulgu:** `calculateLeaseEngine`'in KENDİ önbelleği
(`CALCULATION_CACHE`, satır ~813) zaten var ve kullanılıyor — ama
YALNIZCA `cfoBuildSchedule`'ın `LEASE_SCHEDULE` (ham motor) dalı için.
`REASSESSED_SCHEDULE`/`MODIFIED_SCHEDULE` dalları
(`buildReassessedSchedule`/`buildModifiedSchedule`) HİÇ önbelleğe
alınmıyor — her çağrıda sıfırdan hesaplanıyor.

**Çözüm:** `getCfoAggregateMetrics(reportingDate)` eklendi —
`reportingDate` bazında `CFO_AGGREGATE_CACHE` (yeni `Map`) ile
önbelleğe alınan, TEK GEÇİŞTE tüm 4 toplamı (`leaseLiability`,
`currentLiability`, `nonCurrentLiability`, `rouAsset`) hesaplayan
fonksiyon. Eski 4 fonksiyon buna delege eden ince sarmalayıcılara
çevrildi (**public API değişmedi**, plan önerisiyle birebir).

**Önbellek geçersiz kılma (kritik güvenlik kontrolü):**
`CFO_AGGREGATE_CACHE`, `CALCULATION_CACHE` ile AYNI TDZ nedeniyle AYNI
yerde tanımlandı; `clearCalculationCache()` artık İKİSİNİ birden
temizliyor — tek bakım noktası. `saveContracts()`'ın (kontrat
kalıcılaştırmanın TEK merkezi noktası) **koşulsuz** her çağrıda
`clearCalculationCache()` çağırdığı doğrulandı (satır ~1184) — yani
yeni cache, mevcut (zaten güvenilir) cache ile AYNI geçersiz kılma
garantisini miras alıyor.

**Doğrulama:** Özel bir test yazıldı — aynı `reportingDate` için art
arda çağrılan 4 fonksiyonun tutarlı olduğu (`current+nonCurrent≈total`),
CACHE'İN çalıştığı (2. çağrı aynı değeri döndürüyor) VE yeni bir
kontrat eklendiğinde (`clearCalculationCache` tetiklenince) cache'in
doğru şekilde BAYATLADIĞI (yeni toplamın arttığı) doğrulandı. Tam
suite: 396/396.

## 4.2 — Cache kapsamı incelendi, ek değişiklik gerekmedi

`calculateLeaseEngine`'in `CALCULATION_CACHE`'i kullandığı doğrulandı
(satır ~5801). `cfo*`/`rpt*` katmanlarının bunu KULLANDIĞI (dolaylı
olarak, `calculateLeaseEngine` üzerinden) ama `buildReassessedSchedule`/
`buildModifiedSchedule`'ın kendi önbelleği OLMADIĞI doğrulandı — 4.1b'nin
`getCfoAggregateMetrics` önbelleği bunun EN ETKİLİ örneğini (CFO
Dashboard'un 4 fonksiyonu art arda çağırması) zaten çözüyor.
`buildReassessedSchedule`/`buildModifiedSchedule`'a AYRI bir önbellek
katmanı eklemek daha invaziv bir değişiklik olurdu (modification/
reassessment durumuna bağlı cache-key tasarımı gerektirir) — plan
metninin kendisi de bu maddeyi "incelenecek" (yatırım kararı değil)
diye çerçeveliyor. Ek değişiklik yapılmadı.

## 4.3 — Gereksiz clone taraması yapıldı, hot-loop bulgusu YOK

Kontrat listesi üzerinde döngü yapan TÜM yerler (`contracts.forEach`,
`cfoGetContracts().map/forEach` — CFO Dashboard aggregation ailesi
dahil, satır ~15970-16124) tarandı: **hiçbiri clone fonksiyonu
çağırmıyor.** En yüksek hacimli clone çağrıları (`v22Clone` ×32,
`cloneModificationValue` ×18) incelendi — hepsi tekil kayıt (group,
record, scope, modification) CRUD işlemleri, "yüzlerce kontratta
pahalı" senaryosunun endişe ettiği hot-loop deseni YOK. Ek değişiklik
yapılmadı.

## 4.4 — Virtual scroll tutarlılığı incelendi, BULGU: kullanılmıyor (kod var, bağlı değil)

`renderVirtualTable(container, data, options)` fonksiyonu (V25.1,
satır ~27950) **hiçbir yerde çağrılmıyor** — tamamen ölü/kullanılmayan
kod. Ne `renderBulkJournalResults` ne `renderCloseDashboardPage` ne de
ana kontrat tablosu (`renderTable`, sayfalama ile çalışıyor) bunu
kullanıyor.

**Bilerek uygulanmadı:** Bunu şimdi bağlamak (`renderBulkJournalResults`/
`renderCloseDashboardPage`'in DOM yapısını virtualize etmek) GERÇEK
bir davranış/özellik değişikliği olurdu — Faz 3'te byte-bazlı MD5 ile
koruduğum çıktı yapısını temelden değiştirir (spacer div, mutlak
konumlandırılmış satırlar, scroll-tetiklemeli yeniden render). Bu,
"tutarsızlığı gider" kapsamının ötesinde, ayrı bir özellik kararı —
**Görkem'in onayı olmadan uygulanmadı.** İsteğe bağlı gelecek işi
olarak not düşüldü.

## FAZ 4 KAPANIŞ DURUMU

✅ TAMAMLANDI — 4.1 (GC-18 düzeltmesi + aggregate konsolidasyon), 4.2
(incelendi), 4.3 (incelendi, değişiklik gerekmedi), 4.4 (incelendi,
bulgu kaydedildi, uygulama Görkem onayına bırakıldı).

**REFAKTÖR PLANININ TÜM FAZLARI (0-4) TAMAMLANDI.**

---

# 38. FAZ 4.4 — VIRTUAL SCROLL BAĞLAMASI (Görkem onayıyla, sonradan uygulandı)

## Kapsam kararı

`renderCloseDashboardPage` incelendi: `.map()` çağrıları yalnızca
`companyOptions` (dropdown), `reportingCurrencyList` (dropdown),
`blockers`/`warnings`/`controls` (sınırlı sayıda kapanış-hazırlık
kontrol sonucu) üzerinde — **virtualize edilecek büyük bir SATIR
listesi YOK.** Bu fonksiyonun karmaşıklığı state/event-wiring'den
geliyordu (bkz. bölüm 36), listeden değil — virtual scroll burada
mimari olarak uygulanamaz. **Yalnızca `renderBulkJournalResults`**
hedef alındı.

## Uygulama

**Eşik-bazlı aktivasyon:** `BULK_JOURNAL_VIRTUAL_SCROLL_THRESHOLD = 50`.
Bu satırın ALTINDA mevcut (Faz 3'te byte-bazlı MD5 ile doğrulanmış)
tam `<table>` render'ı **DEĞİŞMEDEN** kullanılmaya devam ediyor —
küçük listelerde virtual scroll ek karmaşıklık getirir ama gözle
görülür kazanç sağlamaz. ÜSTÜNDE, `renderVirtualTable`'a bağlanıyor.

**Teknik engel ve çözümü:** `renderVirtualTable` her satırı
`display:flex` bir `<div>` olarak sarmalıyor (kodu SABİT, `<tr>`
kullanmıyor) — bu yüzden gerçek `<table>`/`<tr>`/`<td>` yapısıyla
DOĞRUDAN uyumsuz. Çözüm: `renderBulkJournalRowContent(item)` her
"hücreyi" eşit genişlikli (`flex:1 1 0`) bir `<div>` olarak üretiyor,
`buildBulkJournalVirtualShell()` ise AYNI flex oranlarını kullanan
sabit (kaydırılmayan) bir başlık satırı + `renderVirtualTable`'ın
devralacağı boş bir konteyner (`#bulkJournalVirtualRows`) üretiyor.
Kolon sırası/hizalama/biçimlendirme (para birimi, tarih, "✓ Dengeli"/
"✕ Hatalı" renk kodu) mevcut `<td>` yapısıyla BİREBİR aynı tutuldu.

## Doğrulama

- **jsdom testi:** >50 satırda kabuk (`#bulkJournalVirtualRows`, `<table>`
  YOK) devreye giriyor; ≤50 satırda mevcut `<table>` yapısı DEĞİŞMEDEN
  kalıyor (2 ayrı test, ikisi de yeşil).
- **Gerçek tarayıcı (Playwright, kalıcı test):** 120 satırlık veri
  seti ile: başlangıçta 15/120 satır DOM'da (tam liste değil), ilk
  görünen satır `FIS-001`. `scrollTop=2000` sonrası 20/120 satır,
  ilk görünen satır `FIS-041`'e kaymış — **gerçek scroll davranışının
  çalıştığının kanıtı**, sadece DOM yapısının doğru olduğunun değil.
  3 ardışık koşumda kararlı.
- Tam Jest suite: 396/396 (küçük veri seti yolu hiç etkilenmedi).
  Tam Playwright suite: **21/21** (3×7).

## Not: bir jsdom test-ortamı artefaktı gözlemlendi (üretim hatası DEĞİL)

jsdom testinde, virtual scroll'un tetiklediği DOM mutasyonları
mevcut (bu değişiklikle ilgisiz) bir `MutationObserver`'ı
(`v26HookContractDetail`, satır ~30648) tetikliyor; testler arası
`jest.resetModules()` zamanlamasıyla çakışıp bir kez
`console.error` ile "Cannot read properties of undefined" logluyor.
**Test'i BAŞARISIZ yapmıyor** (asenkron, testin senkron assertion
akışının dışında) — gerçek tarayıcıda `document` her zaman tanımlı
olduğu için bu hata hiç oluşmaz (Playwright testinde de oluşmadı,
3/3 koşumda temiz). Bilgi amaçlı kaydedildi, düzeltme gerekmedi.

## `renderCloseDashboardPage` — KASITLI OLARAK BÖLÜNMEDİ

İncelendi (400 satır). Diğer üç render fonksiyonundan TEMELDEN farklı
bir yapıya sahip: kapanış closure'ı içinde mutable state (`period`,
`companyId`, `reportingCurrency`) tutuyor, bir `render()` iç
fonksiyonu tanımlıyor ve bu fonksiyon HEM veri hesaplıyor HEM
`container.innerHTML` atıyor HEM DE kendi ürettiği DOM elemanlarına
**event listener'lar bağlıyor** (`closePeriodInput`/`closeCompanyInput`/
`closeReportingCurrencyInput`'un `change` olayı `period`/`companyId`/
`reportingCurrency`'yi MUTATE EDİP `render()`'ı YENİDEN çağırıyor —
kendi kendini yeniden render eden bir closure deseni).

Bu, planın "modal/event wiring — en yüksek risk, event listener
sırası/timing hassas" diye Kategori 3 için ayırdığı TAM O risk
profili — sadece Kategori 2 (render) olarak etiketlenmiş. Veriyi
hesaplamayı HTML üretmekten ayırmak, ya (a) 10+ closure değişkenini
(blockers, warnings, controls, data, statusBadge, fmt, scopedCompanyMeta,
companyOptions, reportingCurrency, fxNote, score, status, certified,
locked...) parametre olarak taşımayı, ya da (b) `period`/`companyId`/
`reportingCurrency` mutasyonunun event handler'lardan `render()`'ın
BİR SONRAKİ çağrısına doğru yansıması için closure yapısını mutable
bir referans objesine çevirmeyi gerektirir — ikisi de gerçek davranış
değişikliği riski taşır.

**Karar:** Bölünmedi. Bu, "satır sayısı büyük = SRP ihlali" varsayımının
her zaman doğru olmadığının bir örneği — bu fonksiyonun karmaşıklığı
KASITLI mimari bir desenden (kendi kendini yeniden render eden
closure) geliyor, kazara dağınıklıktan değil. Zorla bölmek, planın
kendi risk hiyerarşisini ihlal ederdi.

### 0.4 tarayıcı notu

Bu ortamda `cdn.playwright.dev` ağ allowlist dışında olduğu için
`playwright install` başarısız oluyor. `playwright.config.js`, sistemde
hazır bulunan uyumlu bir Chromium ikilisini (`/opt/pw-browsers/chromium-1194`,
Chromium 141.0.7390.37) `executablePath` ile kullanacak şekilde
yapılandırıldı — `PLAYWRIGHT_CHROMIUM_PATH` env değişkeniyle geçersiz
kılınabilir. Farklı bir makinede (`playwright install` çalışan) bu ayar
gerekmez; `resolveLocalChromium()` hiçbir aday bulamazsa `undefined`
döner ve Playwright kendi indirdiği tarayıcıyı kullanır.

### 0.4'te düzeltilen selector/varsayım hataları (üretim kodu DEĞİL, yalnızca test)

Gerçek tarayıcıda koşum, spec yazılırken yapılan birkaç yanlış varsayımı
ortaya çıkardı — hepsi test tarafında düzeltildi:

1. **`#company` bazen `<select>`** — `applySessionCompanyToForm()`
   kullanıcının atanmış şirketleri varsa alanı select'e çeviriyor
   (gerçek davranış, bkz. aşağıdaki "ÇOKLU ŞİRKET SEÇİCİSİ" maddesi).
2. **`#contractId` ("Sözleşme ID") zorunlu bir alanmış**, ilk spec'te hiç
   doldurulmuyordu — form `checkValidity()` sessizce false dönüyor,
   submit hiçbir şey yapmıyordu.
3. **Kayıt sonrası detay modalı OTOMATİK açılıyor** — spec'in "satıra
   tıkla" adımı gereksizdi (ve `#detailModal` zaten açıkken satırı
   engelliyordu).
4. **`#detailTitle` görünür metni yalnızca "Şirket › SözleşmeID"** —
   tedarikçi adı `title=""` HTML attribute'unda.
5. **`#scheduleTableContainer` orfan/ölü bir statik div** — Faz B tab
   konsolidasyonundan kalma, hiçbir kod onu hedeflemiyor (grep ile
   doğrulandı). Gerçek ödeme planı `renderPaymentScheduleSection()`
   tarafından `#scheduleTableBody` (tbody, "Ödeme Planı" tab paneli
   içinde) içine render ediliyor — modal açılışında zaten DOM'da,
   yalnızca CSS ile gizli.
6. **`#exportReportHtmlButton` dosya İNDİRMİYOR** — `window.open()` ile
   yeni sekme açıp HTML'i `document.write()` ile yazıyor (satır
   ~26874). "download" event'i değil, "popup" event'i doğru beklenti.
7. **`#downloadTemplateButton`, `#bulkImportModal` içinde** — önce
   `#bulkImportButton` ile açılmalı.

### ÇOKLU ŞİRKET SEÇİCİSİ — değerlendirme (Görkem sorusu, Eylül 2026)

Soru: `#company`'nin bazen serbest metin input'u olması güvenlik açığı
mı (kullanıcı atanmadığı bir şirket için veri girebilir mi)?

**Değerlendirme [Kesin, `backend/routes/contracts.js` okunarak
doğrulandı]: HAYIR, güvenlik açığı değil.** POST `/api/contracts`,
body'deki `companyId`'yi `requireCompanyLicense` middleware'inin
JWT'den türettiği `req.companyId` ile birebir karşılaştırıyor;
uyuşmazsa `403 COMPANY_ACCESS_DENIED`. Frontend'de ne yapılırsa
yapılsın, backend kullanıcının atanmadığı bir şirket için kayda izin
vermiyor.

Free-text input yalnızca `sessionCompanies.length === 0` durumunda
(kullanıcıya hiç şirket atanmamış veya `/api/auth/me` başarısız olmuş)
devreye giriyor. Bu durumda form dolduruluyormuş gibi görünüyor ama
submit her zaman `companyId zorunludur` (400) ile reddediliyor —
**veri sızıntısı değil, kötü UX**: kullanıcı formu eksiksiz
doldurduğunu düşünüp anlamsız bir hatayla karşılaşıyor. Doğrusu, bu
durumda formu hiç açmayıp "Hesabınıza atanmış şirket yok,
yöneticinizle görüşün" mesajı göstermek. **Düzeltilmedi — düşük öncelik,
Faz 2/UX iyileştirmesi adayı.**

**Yan bulgu (bu soruyu araştırırken ortaya çıktı) — `id="companyId"`
DOM'da İKİ KEZ var:** `applySessionCompanyToForm()`'un gizli input'u
(satır ~584-589) ile V26 "Şirket (V26)" panelinin select'i
(`injectV26CurrencyFields`, satır ~7798) aynı id'yi taşıyor. Gerçek
tarayıcıda test edildi: gizli input doğru değeri tutuyor
("E2E-CO-1"), V26 select'i hiç senkronize olmuyor, boş kalıyor.
Etkisi kayıt yoluna DEĞİL (kaydetme doğru elemanı okuyor,
`document.getElementById` DOM sırasına göre gizli input'u buluyor) —
yalnızca V26 TMS21/TMS29 "otomatik tespit" önizleme paneli, muhtemelen
sessizce yanlış (boş) companyId okuyor. **Düzeltilmedi — düşük önem
(görüntüleme paneli, hesaplama/kayıt etkilenmiyor), Faz 2 (isimlendirme/
duplicate-id temizliği) adayı.**
