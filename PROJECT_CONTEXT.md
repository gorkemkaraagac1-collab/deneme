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

**Faz 2:**
- İki menünün (dashboard.html + tfrs16.html) tam envanteri çıkarılır, tekrarlar (Close Dashboard, Hesap Planı Eşleme, Denetim İzi, Konsolidasyon) birleştirilir
- Role göre (muhasebeci/CFO/admin) tek, tutarlı bilgi mimarisi

**Faz 3 (revize — yalnızca kullanıcıya görünen UX maddeleri):**
- Progressive disclosure: az kullanılan formlar (SLB, Alt Kiralama) varsayılan kapalı/accordion
- Tutarlı boş/yükleniyor/hata durumları
- (Opsiyonel) yeni sözleşme için adım-adım sihirbaz

## AYRILAN — RELEASE SONRASINA BIRAKILDI

`js/tfrs16.js`'in iç modülerleştirilmesi (bölüm 26'daki `tfrs16-core.js`/`tfrs16-calculation.js`/... yapısı) **release sonrasında** kalır. Bu saf teknik borçtur — kullanıcıya görünmez, "kullanılabilirlik" hedefine hizmet etmez, 30.000+ satırlık dosyayı bölerken regresyon riski taşır. Faz 0-3 ile KARIŞTIRILMAMALIDIR; bölüm 26'daki "release öncesi kapsamlı refactor yapılmayacak" kuralı bu madde için AYNEN GEÇERLİ kalmaya devam eder.


