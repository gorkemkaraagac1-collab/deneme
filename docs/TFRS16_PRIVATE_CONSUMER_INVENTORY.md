# TFRS16 private consumer inventory

> **Aktif karar (2026-09-15):** Bu envanter, public motoru koruma gerekçesi
> olarak değil, public UI ayrıştırma kontrol listesi olarak kullanılacaktır.
> Hedef tamamlandığında public `js/tfrs16-engine.js` dosyası ve üretim script
> bağımlılığı bulunmayacaktır. TMS29 taslak/uygulama kayıtları da private
> backend'e kalıcı yazılmadan bu kapı kapanmış sayılmayacaktır.

Bu envanter public motorun üretim UI tüketicilerini izler. Her satır `getPrivateCalculationForConsumer` sınırından geçer; API-primary modunda yalnızca private sonuç önbelleği okunur. URL ile yerel hesaplamayı açan bir rollback yolu yoktur.

**Üretim tüketicisi: 36 · Son tarama: 2026-09-14**

| Satır | Tüketici | Okuma |
|---:|---|---|
| 2733 | `function applyTMS29Restatement(contract, reportingPeriod, periodStart)` | `const engineForSchedule = getPrivateCalculationForConsumer(contract);` |
| 2800 | `function applyTMS29Restatement(contract, reportingPeriod, periodStart)` | `: (getPrivateCalculationForConsumer(contract).rouAssets \|\| 0);` |
| 2834 | `function applyTMS29Restatement(contract, reportingPeriod, periodStart)` | `lastRow ? lastRow.closingLiability : (getPrivateCalculationForConsumer(contract).liability \|\| 0);` |
| 2868 | `function applyTMS29Restatement(contract, reportingPeriod, periodStart)` | `: (fullSchedule.length ? fullSchedule[0].openingLiability : (getPrivateCalculationForConsumer(contract).liability \|\| 0));` |
| 2929 | `function applyTMS29Restatement(contract, reportingPeriod, periodStart)` | `const accrualSchedule = getPrivateCalculationForConsumer(contract).schedule;` |
| 3741 | `function calculateReassessment(contract, input)` | `getPrivateCalculationForConsumer(contract).liability` |
| 3748 | `function calculateReassessment(contract, input)` | `getPrivateCalculationForConsumer(contract).rouAssets` |
| 3872 | `function buildScheduleFromChangeChain(contract, excludeId)` | `const baseEngine = getPrivateCalculationForConsumer(baseContract);` |
| 5007 | `function resolveAppliedChangeMeasurement(contract, change, kind)` | `const baseEngine = getPrivateCalculationForConsumer(baseContract);` |
| 5086 | `function buildScheduleFromModificationChain(` | `getPrivateCalculationForConsumer(baseContract);` |
| 5328 | `function calculateModification(` | `getPrivateCalculationForConsumer(getModificationBaseContract(contract));` |
| 5447 | `function buildModifiedSchedule(` | `return getPrivateCalculationForConsumer(contract).schedule \|\| [];` |
| 6754 | `function calculateLease(contract)` | `return getPrivateCalculationForConsumer(contract);` |
| 7062 | `function getEscalatedPayments(contract)` | `const engine = getPrivateCalculationForConsumer(contract);` |
| 8490 | `function resolveContractScheduleSource(contract)` | `const engine = typeof calculateLeaseEngine === "function" ? getPrivateCalculationForConsumer(contract) : null;` |
| 8518 | `function getScheduleAsOfReportingDate(` | `getPrivateCalculationForConsumer(contract);` |
| 8665 | `function calculateLiabilitySplitAsOf(` | `engine: getPrivateCalculationForConsumer(contract),` |
| 8681 | `function calculateLiabilitySplitAsOf(` | `: Math.max(0, Number(getPrivateCalculationForConsumer(contract).liability) \|\| 0);` |
| 12171 | `function auditCalculationRun(contract, calculationType = "TFRS16")` | `const engine = getPrivateCalculationForConsumer(contract);` |
| 13091 | `async function renderPaymentScheduleTable(contract)` | `: getPrivateCalculationForConsumer(contract);` |
| 13943 | `async function exportPaymentSchedule(contract, presentationCurrency)` | `getPrivateCalculationForConsumer(` |
| 17850 | `function controlSchedule(contract)` | `const engine = typeof calculateLeaseEngine === "function" ? getPrivateCalculationForConsumer(contract) : null;` |
| 17942 | `function controlCalculation(contract, config)` | `const engine = getPrivateCalculationForConsumer(contract);` |
| 17959 | `function controlROU(contract, config)` | `const engine = getPrivateCalculationForConsumer(contract);` |
| 19272 | `function rptBuildSchedule(contract)` | `const engine = typeof calculateLeaseEngine === "function" ? getPrivateCalculationForConsumer(contract) : null;` |
| 23445 | `function getErpReadyPaymentData(reportingDate, options =` | `const built = typeof cfoBuildSchedule === "function" ? cfoBuildSchedule(contract) : (typeof calculateLeaseEngine === "function" ? getPrivateCalculationForConsumer(contract) : null);` |
| 24010 | `function v191BuildFxRouRollForward(contract, rawRow, periodStartMonth, rpMonth, presentationCurrency)` | `const initialTx = rptNumber(first.rouOpening \|\| getPrivateCalculationForConsumer(contract).rouAssets \|\| 0);` |
| 25157 | `function v191RenderContractTools()` | `: (typeof calculateLeaseEngine === "function" ? (getPrivateCalculationForConsumer(contract)?.schedule \|\| []) : []);` |
| 25878 | `function v20GetDatabaseModel()` | `const result = getPrivateCalculationForConsumer(contract);` |
| 27962 | `function v22ContractMetrics(contract, reportingDate)` | `: (typeof calculateLeaseEngine === "function" ? getPrivateCalculationForConsumer(contract) : {});` |
| 29456 | `function calculateSaleAndLeaseback(input =` | `const leasebackEngine = getPrivateCalculationForConsumer(leasebackContract);` |
| 29678 | `function calculateSublease(input =` | `const subEngine = getPrivateCalculationForConsumer(subleaseContract);` |
| 29707 | `function calculateSublease(input =` | `const subEngine = getPrivateCalculationForConsumer(subleaseContract);` |
| 31219 | `function getEffectiveSchedule(contract)` | `const engine = getPrivateCalculationForConsumer(contract);` |
| 31229 | `function getEffectiveSchedule(contract)` | `return getPrivateCalculationForConsumer(contract).schedule;` |
| 31432 | `async function exportReport(contractId, format, options =` | `const engine = getPrivateCalculationForConsumer(contract);` |

Kalan `calculateLeaseEngine(` referansları yalnızca yorumlar, self-testler ve fonksiyon tanımıdır; CI kapısı doğrudan üretim çağrısı eklenmesini reddeder.

## Yapısal temizleme dilimi (2026-09-15)

Public bundle'dan artık kullanılmayan yerel TMS 29 restatement, portföy
hesaplayıcı ve taslak/uygulama yazma gövdeleri çıkarıldı. TMS 29 sonuçları,
journal ve kalıcı yazma akışları private API zarfından geliyor; public dosyada
yalnızca private sonucu ekrana taşıyan UI ve admin endeks yönetimi kaldı.

Bu dilim, `tfrs16-engine.js` dosyasının tamamen kaldırılması değildir. Ödeme
planı, detay ve diğer UI işlevlerinin ayrı UI-only dosyaya taşınması ve canlı
smoke tekrarının ardından dosya kaldırma PR'ı açılacaktır.
