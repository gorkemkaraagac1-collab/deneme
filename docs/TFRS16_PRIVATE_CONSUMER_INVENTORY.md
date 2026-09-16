# TFRS16 private consumer inventory

> **Aktif karar (2026-09-15):** Bu envanter public motoru koruma gerekçesi
> olarak değil, public UI ayrıştırma kontrol listesi olarak kullanılacaktır.
> Hedef tamamlandığında public `js/tfrs16-engine.js` dosyası ve üretim script
> bağımlılığı bulunmayacaktır. TMS29 taslak/uygulama kayıtları da private
> backend'e kalıcı yazılmadan bu kapı kapanmış sayılmayacaktır.

Bu envanter, public motorun hâlâ aynı dosyada bulunan üretim UI tüketicilerini
izler. Aşağıdaki her çağrı private sonuç önbelleği sınırından geçer; API-primary
modunda sonuç yoksa yerel hesaplamaya dönmez ve açık bir bekleme/hata durumu
gösterir. Bu liste, UI-only ayrıştırma sırasında ekran ekran kapatılacaktır.

**Private sınırından geçen üretim çağrısı: 24 · Son tarama: 2026-09-16**

| Satır | Tüketici | Private okuma |
|---:|---|---|
| 3073 | `buildScheduleFromChangeChain` | `getPrivateCalculationForConsumer(baseContract)` |
| 4123 | `resolveAppliedChangeMeasurement` | `getPrivateCalculationForConsumer(baseContract)` |
| 5274 | `calculateLease` | `getPrivateCalculationForConsumer(contract)` |
| 5564 | `getEscalatedPayments` | `getPrivateCalculationForConsumer(contract)` |
| 5964 | `resolveLeaseAccrualContext` | `getPrivateCalculationForConsumer(contract)` |
| 6230 | `resolveContractScheduleSource` | `getPrivateCalculationForConsumer(contract)` |
| 6266 | `getScheduleAsOfReportingDate` | `getPrivateCalculationForConsumer(contract)` |
| 6412 | `calculateLiabilitySplitAsOf` | `getPrivateCalculationForConsumer(contract)` |
| 6428 | `calculateLiabilitySplitAsOf` | `getPrivateCalculationForConsumer(contract).liability` |
| 9664 | `auditCalculationRun` | `getPrivateCalculationForConsumer(contract)` |
| 10384 | `renderPaymentScheduleTable` | `getPrivateCalculationForConsumer(contract)` |
| 11010 | `exportPaymentSchedule` | `getPrivateCalculationForConsumer(contract)` |
| 14584 | `controlCalculation` | `getPrivateCalculationForConsumer(contract)` |
| 14601 | `controlROU` | `getPrivateCalculationForConsumer(contract)` |
| 15921 | `rptBuildSchedule` | `getPrivateCalculationForConsumer(contract)` |
| 20131 | `getErpReadyPaymentData` | `getPrivateCalculationForConsumer(contract)` |
| 20701 | `v191BuildFxRouRollForward` | `getPrivateCalculationForConsumer(contract).rouAssets` |
| 21772 | `v191RenderContractTools` | `getPrivateCalculationForConsumer(contract).schedule` |
| 22501 | `v20GetDatabaseModel` | `getPrivateCalculationForConsumer(contract)` |
| 24582 | `v22ContractMetrics` | `getPrivateCalculationForConsumer(contract)` |
| 27636 | `getEffectiveSchedule` | `getPrivateCalculationForConsumer(contract)` |
| 27646 | `getEffectiveSchedule` | `getPrivateCalculationForConsumer(contract).schedule` |
| 27847 | `exportReport` | `getPrivateCalculationForConsumer(contract)` |

`getPrivateCalculationForConsumer` fonksiyon tanımı (1531) tabloya dahil
değildir. Eski TMS29 restatement/portfolio/write gövdeleri public bundle'dan
çıkarılmıştır; bu taramada kalan satırlar UI ve raporlama tüketicileridir.

## Ayrıştırma sırası

1. Salt-okuma sonuç okuyucuları: özet, ödeme planı, raporlama tarihi ve KPI.
2. Muhasebe fişleri, dışa aktarma ve denetim izi.
3. Modifikasyon, reassessment ve erken ödeme ekranları.
4. TMS29, SLB ve sublease özel akışları.
5. Her ekran için temiz-cache canlı smoke ve geri dönüş artefaktı.
6. Son, ayrı ve geri alınabilir PR'da `js/tfrs16-engine.js` script etiketi ile
   dosyasını kaldırma.

Public engine bu liste sıfırlanmadan kaldırılmayacaktır.
