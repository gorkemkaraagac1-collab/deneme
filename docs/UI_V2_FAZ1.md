# UI v2 — Faz 1: açık tema ve lacivert navigasyon rayı

## Ne bulundu?
- Logo dosyalarındaki beyaz "Lease" yazısı beyaz üst barda görünmüyordu.
- `leaseqant-dark.css` karanlık tema + `!important` açık katmanı; form bölümleri, araç çubuğu ve bazı kartlar karanlık kalıyordu.
- Modal başlığı üst barın altında kalıyordu (üst bar z-index 1200 > modal 1100).
- "Veri alınamadı" gibi durum metinleri 26 px tutar tipografisiyle basılıyordu.
- Dashboard HTML'inde gerçek veri gelene kadar görünen sabit yükseklikli 12 çubuk vardı.

## Ne değişti?
- `css/lq-v2.css` (yeni): token'lar, IBM Plex Sans/Mono, sol lacivert ray, bağlam çubuğu, açık tema kartlar/tablolar/formlar/modallar, durum metni stili, mobil üst şerit.
- `js/lq-ui-v2.js` (yeni, yalnızca sunum): bağlam çubuğunu ekler (başlık, raporlama tarihi, şirket seçici), tutar alanlarını `data-lq-state="value|status|empty"` ile işaretler.
- `tfrs16.html`: v2 bayrağı (head), font ve stil bağlantıları, yeni script (en sonda); sahte grafik çubukları kaldırıldı; etiketler Türkçeleştirildi (Genel Bakış, Yevmiye, Dipnotlar, Kapanış hazırlığı, Kira yükümlülüğü).
- Değişmeyenler: `index.html`, logo dosyaları, tüm DOM kimlikleri, `data-view`/`data-open` anahtarları, script sırası, `window.GK_TFRS16` yüzeyi, hesaplama ve API kodu.

## Geri dönüş
- `tfrs16.html?ui=legacy` eski görünümü açar ve tercihi o tarayıcıda saklar; `?ui=2` yeni görünüme döner.
- Tam geri alma: bu PR'ı revert etmek yeterli (yeni dosyalar + `tfrs16.html` farkı).

## Test sonucu
- `node --check` (js, frontend): geçti.
- `scripts/check-authority-public-boundary.js`, `scripts/check-tfrs16-cutover.js`: geçti.
- `node --test test/*.test.js`: 22 geçti, 5 başarısız. Başarısız 5 test değişiklik öncesinde de aynı nedenle başarısız: yerel backend veritabanı ve `/tmp/*-numeric.json` fikstürleri gerektiriyorlar.
- Sahte API ile 1440 px ve 390 px ekran görüntüsü kontrolü: Genel Bakış, Sözleşmeler, Yeni sözleşme modalı, Dipnotlar, mobil menü; `?ui=legacy` ile eski görünüm değişmeden açılıyor.

## Riskler / Faz 2'ye kalanlar
- Motorun çizdiği sayfalar (`#v26PageHost`) yalnızca genel kurallarla açık temaya alındı; ekran ekran gözden geçirilmeli.
- Tarih alanları tarayıcı diline bağlı (`mm/dd/yyyy` görünebilir); GG.AA.YYYY maskeli alan Faz 2.
- Raporlama tarihi yalnızca gösteriliyor (önceki ayın son günü, `defaultPeriod()` ile aynı kural); seçilebilir dönem şeridi ve sunucu dönem kilidi Faz 2.
- `:has()` seçicisi kullanılıyor (Chrome/Edge 105+, Safari 15.4+, Firefox 121+); eski tarayıcılarda yalnızca boş durum mesajları görünmez.
- `leaseqant-dark.css` henüz kaldırılmadı; v2 kuralları onu ezmek için `!important` kullanıyor.
