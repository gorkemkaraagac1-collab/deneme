# UI v2: Modifikasyon ve yeniden değerlendirme akışı

## Ne bulundu

İşlemler v2 ekranı sözleşme seçimini ve etki panelini sunuyordu; modifikasyon ile yeniden değerlendirme alanları ise her biri uzun, tek parça bir form olarak çiziliyordu. Taslak alanlardan hareketle tarayıcıda hesaplama yapmak uygun değil ve doğrulanmış sunucu sonucu olmadığında etki paneli kaynak gereksinimini göstermelidir.

## Ne değişti

Yalnızca `html[data-lq-ui="2"]` altında iki form, “Değişikliği tanımla” ve “Yeni şartları gir” aşamalarında gruplanıp üç basamaklı akış göstergesiyle sunulur. Üçüncü basamak etkiyi gözden geçirme alanıdır. Alanlar, sözleşme seçimi, form kimlikleri, durum/aksiyon düğmeleri ve motorun mevcut oluşturma, düzenleme, uygulama ve iptal callback'leri korunur. Tarayıcıda yeni tutar, oran veya bakiye hesaplanmaz. Modifikasyon/yeniden değerlendirme ekranında doğrulanmış özel sunucu önizlemesi bu PR kapsamında bağlanmadığından etki paneli “Kaynak gerekli” gösterir. Legacy görünüm bu geliştirmeyi kullanmaz.

## Test sonucu

- `test/operations-navigation.test.js`: yeniden değerlendirme/modifikasyon grupları, form kimlikleri, etki paneli kaynak durumu, callback düğmeleri ve legacy ayrımı doğrulandı.
- Tam yerel test keşfi: **84 testten 82'si geçti**. İki DB-korumalı tarayıcı test dosyası, bu ortamda ayrılmış `/tmp` test veritabanı yapılandırılmadığı için başlangıç korumasında durdu; Production veritabanına yönlendirilmedi.
- `node --check js/tfrs16-operations-ui.js` ve `git diff --check`: geçti.
- `scripts/check-authority-public-boundary.js`: geçti.
- `scripts/check-tfrs16-cutover.js`: geçti.

## Riskler

Modifikasyon/yeniden değerlendirme için sayısal sunucu önizleme bağlantısı bu PR'ın kapsamında değildir; bu ekrandaki etki kartı “Kaynak gerekli” kalır. Güvenilir sunucu paketi ayrı bir çalışma ile bağlanmadan finansal tutar gösterilmez. Finansal uygulama semantiği değişmez.
