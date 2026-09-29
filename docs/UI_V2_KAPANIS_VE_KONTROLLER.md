# UI v2: Kapanış ve Kontroller

## Ne bulundu

Kapanış ve Kontroller ekranları aynı doğrulanmış backend rapor paketini kullanıyordu. Paket; şirket/dönem kapsamını ve hesaplama kontrollerini içeriyor, fakat dönem kilidini açıp kapatan doğrulanmış bir sunucu işlemi veya kapanış makbuzu sağlamıyor.

## Ne değişti

Yalnızca `html[data-lq-ui="2"]` altında dönem kapanışı özeti ve hesaplama kontrol tablosu için sekmeli, açık tema yerleşimi eklendi. Şirket ve dönem filtreleri, sunucu satırları, arama, sıralama ve dışa aktarma aynı doğrulanmış rapor paketini kullanır. Kapanış özeti yalnızca kaynakta görülen kapsam ve kontrol durumlarını gösterir. Dönem kilidi “Kaynak gerekli” kalır; yalnızca ADMIN yetkisi not edilir ve sunucu karşılığı olmayan kapatma/açma düğmesi gösterilmez. Legacy rapor görünümü korunur.

## Test sonucu

- `test/reporting-authority.test.js`: v2 kapanış/kontrol sekmeleri, sunucu satırları, ADMIN notu, legacy görünüm ve nötr kilit durumu kapsama alındı.
- Hesaplama tutarı, kapanış onayı veya canlı yevmiye tarayıcıda üretilmez.

## Riskler

Bu değişiklik dönem kilidi oluşturmaz veya değiştirmez. Kapanış onayı ve kilit durumu için doğrulanmış sunucu kaynağı/işlemi sağlanana kadar bu adımlar kaynak gerekli olarak kalır.
