# UI v2 — Faz 3: GG.AA.YYYY tarih alanları

## Ne bulundu?
- `tfrs16.html` ve motorun çizdiği sayfalar yerel `<input type="date">` kullanıyor. Bu kutu tarayıcı/işletim sistemi diline göre biçimlenir; İngilizce sistemde `mm/dd/yyyy` görünüyor (ekran görüntüsüyle doğrulandı). Türk kullanıcı için 03/04 ayrımı hata riski taşıyor.

## Ne değişti?
- `js/lq-date-fields.js` (yeni): her tarih kutusunun yanına GG.AA.YYYY metin kutusu ve takvim düğmesi ekler; sonradan çizilen sayfalardaki kutuları da yakalar.
  - Yazarken noktalar otomatik eklenir (`01012027` → `01.01.2027`); `3.1.2026`, `31/12/2026`, `2026-12-31` yapıştırması kabul edilir; 29.02.2026 gibi olmayan tarihler reddedilir.
  - Takvim düğmesi tarayıcının kendi seçicisini açar (`showPicker`).
  - Geçersiz tarih özgün kutuya yazılmaz; alanın altında "Tarihi GG.AA.YYYY biçiminde girin" mesajı çıkar; `min`/`max` sınırları Türkçe mesajla uygulanır.
- `css/lq-date-fields.css` (yeni) ve `css/lq-v2.css`: genel input kurallarından metin kutusu hariç tutuldu.
- `tfrs16.html`: stil ve script bağlantısı (head, `defer`).
- `test/date-fields.test.js` (yeni): 4 test.

## Motor sözleşmesi (değişmeyenler)
- Özgün `<input type="date">` aynı `id`/`name` ile DOM'da kalır; `.value` her zaman ISO `YYYY-MM-DD` döner.
- Kullanıcı geçerli tarih girince özgün kutuda `input` ve `change` olayları tetiklenir; motor bunları dinlemeye devam eder.
- Kod özgün kutuya `.value` / `.valueAsDate` yazarsa (ör. sözleşme düzenleme) metin kutusu güncellenir; form `reset` de yansır.
- `required`: gizli özgün kutu zorunluysa tarayıcı gönderimi "odaklanamayan alan" hatasıyla sessizce durdururdu. Zorunluluk metin kutusuna taşınır; `input.required` motor için yine `true` okunur.
- `?ui=legacy` görünümünde modül çalışmaz.

## Test sonucu
- `node --check`, boundary ve cutover kapıları: geçti.
- `node --test test/*.test.js`: 29 geçti / 5 başarısız (5'i önceki fazlarla aynı: yerel backend DB ve `/tmp` fikstürü).
- Tarayıcı (en-US dil ayarıyla): yeni sözleşme formunda 5 tarih alanı dönüştü; `01012027` yazımı `startDate.value = 2027-01-01` verdi; `31.02.2031` reddedildi ve mesaj göründü; boş form gönderiminde tarayıcı doğrulaması metin kutusunda çalıştı; Dipnotlar tarihleri 01.08.2026 / 31.08.2026 göründü.

## Riskler
- Takvim düğmesi `showPicker` desteklemeyen eski tarayıcılarda yalnızca odağı taşır; elle giriş her yerde çalışır.
- Admin paneli (`frontend/admin`) bu PR'ın kapsamında değil.
