# UI v2 — Genel Bakış, Sözleşmeler, Hesaplama sonuçları, Yevmiye, Dipnotlar (tasarıma göre)

## Ne bulundu?
- Faz 1–4 bu sayfalarda yalnızca renk/yazı tipi değiştirmişti; düzen motorun eski düzeniydi, tasarımdaki sayfalara benzemiyordu.
- Tutar kaynakları: sunucunun raporlama paketi (şirket bazında toplamlar, sözleşme satırları, kontroller, olaylar), dipnot paketi (dönem hareketi, vade analizi, varlık sınıfı, sunucu mutabakat kontrolleri), yevmiye paketi (fişler, para birimine göre toplamlar).

## Ne değişti?
- `js/lq-pages.js` (yeni, yalnızca v2):
  - **Genel Bakış:** "Tüm şirketler"de şirket kartları; tek şirkette kapanış durumu şeridi (yalnızca doğrulanabilen adımlar işaretlenir), 4 gösterge kartı, dikey yükümlülük köprüsü (TMS 21 satırı + mutabakat farkı), vade analizi ve defter değeri mutabakatı, aksiyon merkezi, varlık sınıfı, motor kapsamı.
  - **Sözleşmeler:** görünüm sekmeleri (Tümü, Aktif, Pasif/taslak, 90 günde bitiyor, Kapsam dışı), arama, şirket/sınıf/para birimi filtresi, sütun sıralama, sayfalama; satırda rapor tarihindeki kira yükümlülüğü, KHV ve kapsam etiketi; satıra tıklayınca sözleşme sayfası. Yeni sözleşme / içe aktarma mevcut düğmeleri kullanır.
  - **Finansal Raporlama → Hesaplama sonuçları:** sekmeler (Kira yükümlülüğü hareketi, KHV hareketi, Dönem giderleri, Kısa/uzun vade, Vade analizi, Olay günlüğü), şirket başına satır, mutabakat sütunu. Eski rapor paketi (filtre, xlsx/csv/pdf) altta açılır bölümde aynen duruyor.
- `js/tfrs16-journal-ui.js`: v2'de fiş önizlemesi tasarımdaki gibi (önizleme uyarısı, fiş sayısı ve sunucu toplamları, fiş kartları / satır görünümü, arama, dışa aktar menüsü, özet sütunu). Legacy çizim değişmedi.
- `js/tfrs16-disclosure-ui.js`: v2'de dipnot editör düzeni (anahat, belge görünümünde 14.3/14.4/14.5 tabloları, seçili blok bilgisi, sunucunun mutabakat kontrolleri). Tüm alan kimlikleri ve olaylar aynı.
- `css/lq-v2.css`, `tfrs16.html` (script, sürüm, Source Serif 4 yazı tipi).

## Tasarımdan bilinçli sapmalar
- Şirketler arası "Toplam" satırı ve portföy toplamları yok: tutarlar şirket bazında doğrulanıyor; tarayıcıda toplama yapılmıyor.
- Kapsamı eksik şirkette (örn. bir sözleşme çeyreklik) toplam gösterilmez; neden yazılır.
- Kapanış şeridinde kur/endeks adımları yok (sunucuda durum kaynağı yok); yevmiye ve dönem kilidi "kontrol edin" olarak nötr.
- "Hesap özeti" (hesap bazında toplam) ve dipnot anlatı editörü yok: ilki tarayıcıda toplama gerektirir, ikincisinin sunucu tablosu (migration 010) canlıda uygulanmamış.
- TMS 29 parasal kazanç için pakette ayrı alan yok; "Fark" sütununda görünür.

## Test sonucu
- `test/pages.test.js` (3 test): görünüm sayıları, filtre/sıralama, tutarların yalnızca rapordan alınması, sayfaların eski DOM'u silmeden eklenmesi.
- `node --test test/*.test.js`: 49 geçti, 5 başarısız (öncekiyle aynı 5 test; yerel veritabanı ve /tmp fikstürleri).
- Kontrol betikleri geçti. Sahte API ile ekran görüntüleri: Genel Bakış (tüm şirketler, tam kapsam, eksik kapsam), Sözleşmeler, Hesaplama sonuçları, Yevmiye, Dipnotlar, mobil sözleşme listesi.

## Riskler
- Gerçek veriyle denenmedi.
- Sözleşme listesi ve "Tüm şirketler" görünümü her şirket için rapor paketi ister (en çok 12 şirket, 90 sn önbellek); şirket sayısı çoksa ilk açılış yavaşlayabilir.
- Mobilde tablolar yatay kaydırılıyor; tasarımdaki mobil kart düzeni bu PR'da yok.
