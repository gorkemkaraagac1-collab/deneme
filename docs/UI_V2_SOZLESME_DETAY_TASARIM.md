# UI v2 — Sözleşme detay sayfası (tasarımdaki SozlesmeDetay)

## Ne bulundu?
- Faz 5 yalnızca eski detay penceresini tam sayfaya genişletmişti; içerik motorun eski çizimiydi (düz metin rapor listesi, eski sekmeler). Tasarımdaki sayfayla ilgisi yoktu.
- Tasarımın tutarları için doğru kaynak sunucunun doğrulanmış raporlama paketi: sözleşme bazında `metrics` (kira yükümlülüğü, kısa/uzun, KHV, dönem faizi/amortismanı) ve tam `scheduleRows` (açılış, faiz, ödeme, anapara, kapanış, amortisman).
- Paket yalnızca sertifikalı rota (aylık, dönem sonu, TRY, onaylı para birimi profili) için tutar verir; diğer sözleşmeler `NOT_READY` + neden kodu ile gelir.

## Ne değişti?
- `js/lq-contract-view.js` (yeni, yalnızca v2): motorun detay çıktısını tasarımdaki sayfaya yerleştirir.
  - Konum satırı (Sözleşmeler / şirket / no), başlık, durum ve kapsam etiketleri, künye satırı.
  - "İşlemler" menüsü (modifikasyon, satış ve geri kiralama, alt kiralama, yevmiye) ve "⋯" menüsü (PDF/HTML rapor, CSV, sözleşmeyi sil — mevcut motor düğmeleri çağrılır).
  - 5'li gösterge şeridi: başlangıç yükümlülüğü, rapor tarihindeki kira yükümlülüğü (kısa/uzun), KHV, dönem faizi, kalan ödeme.
  - Sekmeler: Özet, Ödeme planı, Hesaplama, Olaylar, Yevmiye, Denetim izi. "Hesaplama" yeni tablo; diğerleri motorun kendi panelleri (formlar ve kayıt akışları değişmedi), motorun sekme düğmeleri arka planda tıklanır.
  - Hesaplama tablosu: yıllara göre gruplu, cari dönem satırı vurgulu (CARİ), gelecek satırlar projeksiyon (PRJ), "Döneme git", CSV.
  - Sağ sütun: motor kapsamı (sertifikalı / kapsam dışı + neden), sözleşme bilgileri, opsiyonlar, standart tespiti.
  - Kapsam dışı sözleşmede sayı uydurulmaz: neden yazılır, motorun ödeme planına yönlendirilir.
  - Dönem şeridi değişince tutarlar yeni döneme göre yeniden alınır; şirket değişince detay kapanır.
- `js/tfrs16-report-authority-ui.js`: `renderContractDetails` bitince `lq:contract-report` olayı yayınlar (paket + sözleşme satırı veya hata). Hesaplama yok.
- `js/lq-contract-page.js`: sayfa bağlam çubuğunun altında açılır (dönem şeridi ve şirket görünür kalır).
- `css/lq-v2.css`: sayfa stilleri; motor panellerindeki form alanları v2 stiline alındı.

## Tasarımdan bilinçli sapmalar
- "KHV NDD" sütunu tabloda yok: sunucu satır bazında KHV bakiyesi vermiyor; tarayıcıda hesaplamamak için alınmadı. KHV yalnızca rapor tarihinde (göstergede) var.
- Kapalı yılların satırında faiz/ödeme toplamı yok (tarayıcıda toplam alınmıyor); açılış ve kapanış bakiyesi gösteriliyor.
- "Tarihi esas / TMS 29 düzeltilmiş" düğmesi ve "Düzenle" yok: sunucuda karşılığı yok. Değişiklik "İşlemler → Modifikasyon" ile yapılıyor.
- Başlık: sözleşmede varlık adı alanı olmadığı için kiraya veren adı kullanılıyor.

## Test sonucu
- `test/contract-view.test.js` (4 test): yıl gruplama ve etiketler, sayfa iskeletine yerleştirme, motor sekmelerinin tetiklenmesi, gösterge ve tablo, kapsam dışı açıklaması, legacy modda dokunulmaması.
- `node --test test/*.test.js`: 46 geçti, 5 başarısız (öncekiyle aynı 5 test; yerel veritabanı ve /tmp fikstürleri).
- Kontrol betikleri geçti. Sahte paketle 1440 px ve 390 px ekran görüntüsü.

## Riskler
- Gerçek veriyle denenmedi. Özellikle ödeme ve amortismanın işareti: tabloda her zaman azalış (parantez) gösteriliyor.
- Motor panellerinin iç tasarımı (modifikasyon formu vb.) hâlâ motorun düzeni; yalnızca form alanları stillendi.
