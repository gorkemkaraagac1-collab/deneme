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

**Private sınırından geçen üretim çağrısı: 25 · Son tarama: 2026-09-15**

| Satır | Tüketici | Private okuma |
|---:|---|---|
| 3063 | `buildScheduleFromChangeChain` | `getPrivateCalculationForConsumer(baseContract)` |
| 4103 | `resolveAppliedChangeMeasurement` | `getPrivateCalculationForConsumer(baseContract)` |
| 4182 | `buildScheduleFromModificationChain` | `getPrivateCalculationForConsumer(baseContract)` |
| 4337 | `buildModifiedSchedule` | `getPrivateCalculationForConsumer(contract).schedule` |
| 5509 | `calculateLease` | `getPrivateCalculationForConsumer(contract)` |
| 5799 | `getEscalatedPayments` | `getPrivateCalculationForConsumer(contract)` |
| 7190 | `resolveContractScheduleSource` | `getPrivateCalculationForConsumer(contract)` |
| 7218 | `getScheduleAsOfReportingDate` | `getPrivateCalculationForConsumer(contract)` |
| 7364 | `calculateLiabilitySplitAsOf` | `getPrivateCalculationForConsumer(contract)` |
| 7380 | `calculateLiabilitySplitAsOf` | `getPrivateCalculationForConsumer(contract).liability` |
| 10885 | `auditCalculationRun` | `getPrivateCalculationForConsumer(contract)` |
| 11821 | `renderPaymentScheduleTable` | `getPrivateCalculationForConsumer(contract)` |
| 12833 | `exportPaymentSchedule` | `getPrivateCalculationForConsumer(contract)` |
| 16635 | `controlSchedule` | `getPrivateCalculationForConsumer(contract)` |
| 16727 | `controlCalculation` | `getPrivateCalculationForConsumer(contract)` |
| 16744 | `controlROU` | `getPrivateCalculationForConsumer(contract)` |
| 18056 | `rptBuildSchedule` | `getPrivateCalculationForConsumer(contract)` |
| 22266 | `getErpReadyPaymentData` | `getPrivateCalculationForConsumer(contract)` |
| 22836 | `v191BuildFxRouRollForward` | `getPrivateCalculationForConsumer(contract).rouAssets` |
| 23907 | `v191RenderContractTools` | `getPrivateCalculationForConsumer(contract).schedule` |
| 24636 | `v20GetDatabaseModel` | `getPrivateCalculationForConsumer(contract)` |
| 26717 | `v22ContractMetrics` | `getPrivateCalculationForConsumer(contract)` |
| 29764 | `getEffectiveSchedule` | `getPrivateCalculationForConsumer(contract)` |
| 29774 | `getEffectiveSchedule` | `getPrivateCalculationForConsumer(contract).schedule` |
| 29975 | `exportReport` | `getPrivateCalculationForConsumer(contract)` |

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
