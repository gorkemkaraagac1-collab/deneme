# UI v2 — Faz 5: tam sayfa sözleşme detayı

## Ne bulundu?
- Sözleşme detayı (`#detailModal`) 1100 px'lik bir açılır pencereydi; yedi sekmeli içerik (özet, ödeme planı, modifikasyon, satış ve geri kiralama, alt kiralama, fişler, denetim izi) bu pencereye sıkışıyordu.
- Detayın kendi adresi yoktu: bağlantı paylaşılamıyor, tarayıcının "geri" tuşu detayı kapatmak yerine siteden çıkıyordu.
- Detayı motor (`openDetail`) çiziyor ve tüm olayları bağlıyor; bu akışa dokunmak riskli.

## Ne değişti?
- `js/lq-contract-page.js` (yeni, yalnızca v2): aynı `#detailModal` öğesini tam sayfa görünüme alır.
  - Detay, sol menünün yanındaki içerik alanını kaplar; menü görünür kalır. Menüden başka ekrana geçilince detay kapanır.
  - Başlıkta "← Sözleşmeler" dönüş düğmesi; sekme başlığı "Şirket › Sözleşme · LeaseQant" olur.
  - Adres: `tfrs16.html#sozlesme/<id>`. Tarayıcı "geri" tuşu detayı kapatır; bağlantı açılınca sözleşmeler yüklendikten sonra aynı detay açılır (20 sn içinde bulunamazsa uyarı verilir).
  - Kapatınca odak detayı açan öğeye döner.
- `css/lq-v2.css`: tam sayfa düzeni, yapışkan sekmeler, mobilde üst çubuğun altında açılma, yazdırma kuralları. Diğer modallar (sözleşme düzenleme, onay pencereleri) bu sayfanın üstünde açılmaya devam eder.
- `tfrs16.html`: yeni script etiketi, CSS sürüm numarası.
- Değişmeyenler: motorun detay çizimi, sekmeler, olay bağları, `#detailModal`/`#detailContent` kimlikleri, sil/kapat düğmeleri, `?ui=legacy` görünümü.

## Test sonucu
- `test/contract-page.test.js` (5 test): adres ↔ kimlik dönüşümü, açınca adres ve başlık, dönüş düğmesi, tarayıcı geri, menüden çıkış, bağlantıyla açma, legacy modda dokunulmaması.
- `node --test test/*.test.js`: 42 geçti, 5 başarısız (öncekiyle aynı 5 test; yerel backend veritabanı gerektiriyor).
- `check-authority-public-boundary.js`, `check-tfrs16-cutover.js`: geçti.
- Sahte API ile 1440 px ve 390 px: listeden açma, geri tuşu, dönüş düğmesi, doğrudan bağlantı.

## Riskler
- Gerçek sözleşme verisiyle (hesaplama sonucu gelen, modifikasyonlu) denenmedi; sekme içerikleri motorun çizimi olduğundan geniş ekranda bazı eski satır içi stiller dar kalabilir.
- Detay içinde modifikasyon kaydedilince motor detayı yeniden çizer; adres aynı kalır.
- Detay açıkken bağlam çubuğu (dönem şeridi, şirket seçici) görünmez; bunlar detayı etkilemez.
