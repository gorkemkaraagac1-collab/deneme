# TFRS 16 Faz 9 — Regression ve güvenlik kapısı

Faz 9, public Pages bundle ile private calculation API arasındaki son sınırı
release kapısı olarak sabitler. `tfrs16-engine.js` public repoya geri eklenmez;
browser yalnızca private result envelope'ını okur.

## Public kontroller

```text
node scripts/check-tfrs16-cutover.js
node --check js/tfrs16-ui.js
node --check js/shell.js
git diff --check
```

Cutover script'i şu koşulları doğrular: private adapter/facade yükleme sırası,
API-primary ve fail-closed davranış, tüm TFRS 16 endpoint'leri, public bundle'da
ham engine/test handle bulunmaması, Authorization + cookie gönderimi ve
TMS19 bağımlılığının olmaması.

## Private kontroller

```text
npm test -- --runInBand
npm run test:golden -- --runInBand
npm run smoke:release
```

Backend suite auth, tenant isolation, validation, CORS/security headers ve
hesaplama endpoint'lerini kapsar. Golden suite canonical lease, advance/arrears,
FX/TMS 21, TMS 29, modification/reassessment, journals ve raporlama parity
anchor'larını korur. Calculation response'ları `source` gibi UI için gerekli
alanları korurken debug/cache/raw engine metadata'sını dışarı vermez.

Playwright release smoke, browser executable'ı bulunan CI ortamında çalıştırılır;
yerel ortamda browser yoksa static cutover gate ve backend contract suite release
ön koşuludur.

## Bilinen legacy suite ayrımı

`test:engine-unit`, migration öncesi browser engine'inin doğrudan erişilebilir
olduğunu varsayan eski testleri içerir. Bu testleri geçirmek için public
calculation fallback'i geri açmak yasaktır. Faz 9 release kanıtı backend
contract/golden suite'leri ve public static boundary gate'idir.
