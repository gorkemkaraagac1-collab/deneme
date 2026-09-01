# Faz 2 — "Asla Adı Değişmeyecek" İsim Listesi

Bu liste, refaktör planının Faz 2 maddesi gereği çıkarıldı:
> "`grep -rn "window\.|onclick=|addEventListener"` ile hangi fonksiyon
> adlarının HTML'den/global scope'tan çağrıldığı çıkarılacak → bu liste
> 'asla adı değişmeyecek' fonksiyonların kesin listesi olacak."

## 1. `window.GK_TFRS16` — dış API yüzeyi (552 isim)

`js/tfrs16.js` içinde **7 ayrı** `Object.assign(window.GK_TFRS16, {...})`
bloğu var (satır ~20858, 25557, 27016, 27480, 27833, 30109, 30252).
Bunların TOPLAMI 552 benzersiz isim (fonksiyon + sabit/config objesi)
üretiyor — dosyanın **tüm** dış-erişilebilir yüzeyi bu.

Tam liste `gk_tfrs16_api_surface.txt` dosyasında (bu zip'in yanında).
İlk 30 örnek:

```
CFO_ALERT_SEVERITY, CFO_ALERT_TYPES, CFO_COCKPIT_CONFIG, ...
(tam liste ayrı dosyada — 552 satır)
```

**Sonuç:** Bu 552 isimden HİÇBİRİ yeniden adlandırılamaz (sabit
isimler dahil — `window.GK_TFRS16.CFO_ALERT_SEVERITY` gibi bir
referans dışarıdan/konsoldan/başka scriptten erişiyor olabilir).
Bu, planın "global rename yüksek risk taşır" uyarısını sayısal
olarak doğruluyor.

## 2. HTML `onclick="..."` referansları

`tfrs16.html`, `frontend/dashboard.html`, `frontend/admin/*.html`
dosyalarında bulunan 21 `onclick=` referansı TARANDI. **Hiçbiri
`js/tfrs16.js` içinde tanımlı değil** — hepsi admin panel
sayfalarına ait (`cancelLicense`, `editUser`, `extendLicense`,
`resetUserPassword`, `showCreateUserModal` vb.), farklı bir JS
dosyasında tanımlanıyor olmalı. **Bu refaktörün kapsamı
(`js/tfrs16.js`) açısından onclick= kaynaklı bir kısıt YOK.**

## 3. HTML'den doğrudan `GK_TFRS16.X()` çağrıları

Yalnızca **3 isim** HTML dosyalarından doğrudan `GK_TFRS16.` üzerinden
çağrılıyor:

- `applyEarlyPayment`
- `exportReport`
- `getSelectedContractId`

Bunlar, yukarıdaki 552'lik listenin İÇİNDE zaten var (alt küme), ama
özellikle **HTML'den doğrudan referans alındıkları** için en kritik
3 isim — bunlarda bir imza/davranış değişikliği HTML'i anında kırar.

## Faz 3 (SRP bölme) için pratik sonuç

Faz 3'te büyük bir fonksiyon (ör. `calculateLeaseEngineImpl`,
`generateModificationJournal`) küçük parçalara bölünürken:
- Ana fonksiyonun **adı ve imzası** yukarıdaki 552 isimden biriyse
  (çoğu ana motor fonksiyonu muhtemelen öyle) KESİNLİKLE değişmez.
- Extract edilen YENİ iç yardımcı fonksiyonlar (ör.
  `calculateAmortizationTable`, `mjBuildLiabilityLines`) bu listede
  YOK — bunlar serbestçe temiz isimlendirme kuralına göre adlandırılır.
