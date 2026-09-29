# UI v2: Mobilde sözleşme ve hesaplama kartları

## Ne bulundu?

900px ve daha dar ekranlarda sözleşme listesi ile Hesaplama Sonuçları sekmelerinin satırları geniş masaüstü ızgarası olarak kalıyordu; kullanıcı alanları yatay kaydırarak okumak zorundaydı.

## Ne değişti?

- Sözleşme listesindeki her alan görünür alan etiketi taşıyor ve dar ekranda iki sütunlu, klavyeyle açılabilir kart olarak gösteriliyor.
- Finansal raporlama tablolarında satır hücreleri kendi sütun başlığını kart etiketi olarak gösteriyor. Olay günlüğü de aynı mobil düzeni kullanıyor.
- Yalnızca sunucudan gelen metrikler gösteriliyor; kart düzeni tutar, oran veya bakiye hesaplamıyor. Masaüstü tablo düzeni ve `?ui=legacy` görünümü korunuyor.

## Test sonucu

`test/ui-v2-mobile-cards.test.js` mobil etiketleri, sunucu değerlerinin korunmasını, klavye satır davranışını, beş hesaplama sekmesindeki başlık eşleşmesini, olay günlüğünü ve legacy ayrımını kapsar. İlgili JSDOM paketi **14/14** geçti. Yetki sınırı, TFRS 16 cutover, JavaScript sözdizimi ve diff kontrolleri geçti. Tam test keşfinde **88 test geçti**; iki tarayıcı test dosyası bu checkout'ta ayrılmış `DB_HOST=/tmp`, `DB_NAME=leaseqant_agent_test` veritabanı olmadığı için başlangıç korumasında durdu. Production veritabanı kullanılmadı.

## Riskler

Kartlar `html[data-lq-ui="2"]` altında ve yalnızca 900px veya daha dar görünümde etkinleşir. Geniş finansal tablolardaki mevcut masaüstü sütun sırası mobil etiketleri besler; bu sırayı değiştiren yeni bir tablo, mobil etiket testini de güncellemelidir.
