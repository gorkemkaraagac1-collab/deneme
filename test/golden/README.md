# Golden-Output Güvenlik Ağı (Faz 0)

`js/tfrs16.js` refaktörünün "davranış SIFIR değişiklik" iddiasını kanıtlayan
test altyapısı. Detaylı gerekçe: `PROJECT_CONTEXT.md` bölüm 33.

## Günlük kullanım

```bash
npm run test:golden      # golden + invariants + determinizm + kapsama
npm test                 # tüm Jest paketi (golden dahil)
```

## Refaktör sırasında bir fonksiyon geçişi

```bash
node --check js/tfrs16.js     # 1
npx jest --runInBand          # 2
npm run test:golden           # 3 + 4
npm run test:e2e              # 5 (yalnızca DOM'a dokunan fonksiyonlarda)
git diff js/tfrs16.js         # 6
```

Bir adım geçmeden sıradakine geçilmez.

## Baseline nasıl okunur

- Aktif referans: `test/golden/baseline/LATEST` içindeki versiyon adı.
- Belirli bir versiyona karşı koşmak: `GOLDEN_BASELINE=<versiyon> npm run test:golden`
- Sayısal sapmaların büyüklüğünü görmek (SADECE teşhis, CI'da kullanma):
  `GOLDEN_TOLERANCE=0.01 npm run test:golden`

## Yeni baseline ne zaman yazılır

**Sadece kasıtlı bir davranış değişikliğinden sonra.** Golden testi kırmızıysa
varsayılan tepki baseline'ı yenilemek DEĞİL, sapmanın nedenini bulmaktır.

```bash
npm run golden:baseline
```

Bu komut YENİ bir timestamp'li versiyon yazar; eskisini silmez ve üzerine
yazmaz (`baseline-store.js` bunu zorlar, dosyalar `chmod 444`). Yeni baseline
yazıldığında gerekçesi `PROJECT_CONTEXT.md` bölüm 33'e işlenmelidir.

## Matris genişletildiğinde

`fixtures/contract-matrix.js`'e yeni kontrat eklerseniz:
1. `dimensions` alanını doldurun (kapsama testi bunu okur).
2. Yeni bir baseline versiyonu yazın — golden testi "baseline'da olmayan
   fixture" uyarısı verecektir.

## Bilinen miras ihlalleri

`invariants.test.js`, baseline'da ZATEN başarısız olan invariant'ları
"bilinen miras" olarak ayırır ve testi kırmaz, ama `console.warn` ile
raporlar. Yalnızca YENİ bozulan bir invariant testi kırar. Mevcut 5 miras
ihlali `PROJECT_CONTEXT.md` bölüm 33'te listelenmiştir.
