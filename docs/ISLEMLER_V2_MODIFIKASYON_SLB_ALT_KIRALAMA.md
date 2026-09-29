# İşlemler v2: modifikasyon, satış ve alt kiralama

## Ne bulundu

Modifikasyon/yeniden değerlendirme, satış ve geri kiralama ile alt kiralama sayfaları eski form ve işlem akışlarını koruyordu; ancak ayrı bir açık tema yerleşimleri yoktu. Modifikasyon ve yeniden değerlendirme için güvenilir sunucu ölçüm önizlemesi bulunmadığında tarayıcıda yeni bir tutar üretmek doğru olmaz.

## Ne değişti

Yalnızca `html[data-lq-ui="2"]` altında üç İşlemler ekranına ortak başlık, sözleşme özeti ve sol form/sağ etki paneli eklendi. Mevcut form alanı kimlikleri, navigasyon anahtarları, düğmeler ve callback akışları korundu. Satış ve geri kiralama ile alt kiralama sonuç alanları mevcut özel sunucu sonucunu sağdaki panele taşır; ölçüm yoksa “Kaynak gerekli” gösterir. Eski arayüzün çizimi değiştirilmedi.

## Test sonucu

- `test/operations-navigation.test.js`: **5/5 geçti**; v2 yerleşimi, eski form kimlikleri, sağ panelde sunucu sonucu ve eski düğme callback'leri doğrulandı.
- `node --check` ve `git diff --check`: geçti.
- `scripts/check-authority-public-boundary.js`: geçti; gizli motor sızıntısı yok.
- `scripts/check-tfrs16-cutover.js`: geçti.
- `node --test test/*.test.js`: **80 geçti, 2 test dosyası yerel veritabanı korumasında durdu**. Bu dosyalar `DB_HOST=/tmp` ve `DB_NAME=leaseqant_agent_test` bekliyor; bu çalışma kopyasında disposable DB yapılandırılmadı. Diğer testlerde yeni açıklanamayan hata görülmedi.
- `tfrs16.html`, `index.html` ve logo dosyalarında değişiklik yok.

## Riskler

Bu PR finansal hesap veya sunucu API'si eklemez. Modifikasyon/yeniden değerlendirme formu taslak oluşturma ve mevcut Uygula akışını kullanır; ayrı, doğrulanmış bir ölçüm önizlemesi sunulmadığından panel kaynak durumunu açıkça belirtir. Tarayıcıda canlı Production/test hesabıyla uçtan uca smoke bu UI-only PR kapsamında çalıştırılmadı.
