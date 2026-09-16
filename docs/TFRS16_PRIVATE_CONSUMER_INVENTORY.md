# TFRS16 private consumer inventory

> **Aktif karar (2026-09-15):** Bu envanter public motoru koruma gerekçesi
> olarak değil, public UI ayrıştırma kontrol listesi olarak kullanılacaktır.
> Hedef tamamlandığında public `js/tfrs16-ui.js` dosyası ve üretim script
> bağımlılığı bulunmayacaktır. TMS29 taslak/uygulama kayıtları da private
> backend'e kalıcı yazılmadan bu kapı kapanmış sayılmayacaktır.

Bu envanter, public motorun hâlâ aynı dosyada bulunan üretim UI tüketicilerini
izler. Aşağıdaki her çağrı private sonuç önbelleği sınırından geçer; API-primary
modunda sonuç yoksa yerel hesaplamaya dönmez ve açık bir bekleme/hata durumu
gösterir. Bu liste, UI-only ayrıştırma sırasında ekran ekran kapatılacaktır.

**Private sınırından geçen üretim çağrısı: 20 · Son tarama: 2026-09-16**

| Satır | Tüketici | Private okuma |
|---:|---|---|
| 4677 | `calculateLease` | `getPrivateCalculationForConsumer(contract)` |
| 4967 | `getEscalatedPayments` | `getPrivateCalculationForConsumer(contract)` |
| 5367 | `resolveLeaseAccrualContext` | `getPrivateCalculationForConsumer(contract)` |
| 5633 | `resolveContractScheduleSource` | `getPrivateCalculationForConsumer(contract)` |
| 5669 | `getScheduleAsOfReportingDate` | `getPrivateCalculationForConsumer(contract)` |
| 5815 | `calculateLiabilitySplitAsOf` | `getPrivateCalculationForConsumer(contract)` |
| 5831 | `calculateLiabilitySplitAsOf` | `getPrivateCalculationForConsumer(contract).liability` |
| 9067 | `auditCalculationRun` | `getPrivateCalculationForConsumer(contract)` |
| 9787 | `renderPaymentScheduleTable` | `getPrivateCalculationForConsumer(contract)` |
| 10413 | `exportPaymentSchedule` | `getPrivateCalculationForConsumer(contract)` |
| 13987 | `controlCalculation` | `getPrivateCalculationForConsumer(contract)` |
| 14004 | `controlROU` | `getPrivateCalculationForConsumer(contract)` |
| 15324 | `rptBuildSchedule` | `getPrivateCalculationForConsumer(contract)` |
| 20104 | `getErpReadyPaymentData` | `getPrivateCalculationForConsumer(contract)` |
| 21175 | `v191BuildFxRouRollForward` | `getPrivateCalculationForConsumer(contract).rouAssets` |
| 21904 | `v191RenderContractTools` | `getPrivateCalculationForConsumer(contract).schedule` |
| 23985 | `v20GetDatabaseModel` | `getPrivateCalculationForConsumer(contract)` |
| 27039 | `v22ContractMetrics` | `getPrivateCalculationForConsumer(contract)` |
| 27049 | `getEffectiveSchedule` | `getPrivateCalculationForConsumer(contract).schedule` |
| 27250 | `exportReport` | `getPrivateCalculationForConsumer(contract)` |

`getPrivateCalculationForConsumer` fonksiyon tanımı (1531) tabloya dahil
değildir. Eski TMS29 restatement/portfolio/write gövdeleri public bundle'dan
çıkarılmıştır; uygulanan değişikliklerin ölçüm zinciri de private event
zarfına taşınmıştır. Bu taramada kalan satırlar yalnızca UI ve raporlama
tüketicileridir.

## Ayrıştırma sırası

1. Salt-okuma sonuç okuyucuları: özet, ödeme planı, raporlama tarihi ve KPI.
2. Muhasebe fişleri, dışa aktarma ve denetim izi.
3. Modifikasyon, reassessment ve erken ödeme ekranları.
4. TMS29, SLB ve sublease özel akışları.
5. Her ekran için temiz-cache canlı smoke ve geri dönüş artefaktı.
6. Son, ayrı ve geri alınabilir PR'da `js/tfrs16-ui.js` script etiketi ile
   dosyasını kaldırma.

Public engine bu liste sıfırlanmadan kaldırılmayacaktır.
