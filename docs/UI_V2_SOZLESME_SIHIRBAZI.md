# UI v2 — Yeni sözleşme sihirbazı (tasarım: Sihirbaz)

## Ne bulundu?
- Yeni sözleşme formu (#contractModal) tek pencerede 3 bölüm ve ~50 alandı; tasarımda 5 adımlı, tam sayfa sihirbaz var.
- Kayıt akışı motorun form submit işleyicisinde; alan kimlikleri ve olayları değişmemeli.

## Ne değişti?
- `js/lq-contract-wizard.js` (yeni, yalnızca v2): aynı form, 5 adım: Temel bilgiler · Süre ve opsiyonlar · Ödemeler · Başlangıç ölçümü · Muafiyet ve gözden geçir.
  - Alanlar aynı öğeler; formun içinde adım panellerine taşınır (id, name, dinleyiciler korunur). Sonradan eklenen alanlar (para birimi alanları vb.) da adımlara dağıtılır; tanınmayan alan son adıma düşer.
  - "İleri" o adımın zorunlu alanlarını doğrular. "Kaydet" önce bütün adımları doğrular; eksik varsa o adıma gider ve tarayıcı mesajını gösterir (gizli adımdaki alan kaydı sessizce durdurmaz).
  - Sol adım listesi: tamamlanan ✓, eksik alanlı adım !, özet satırı. Son adımda gözden geçirme tablosu.
  - Sağ sütun: girilen süre / ödeme / iskonto oranı ve rapor rotası tahmini (aylık + dönem sonu → sertifikalı; diğerleri kapsam dışı; muafiyet seçiliyse tanıma yok).
- `css/lq-v2.css`: tam sayfa sihirbaz düzeni, mobil.

## Tasarımdan bilinçli sapmalar
- Başlangıç ölçümü önizlemesi (yükümlülük / KHV tutarı) yok: kaydedilmemiş sözleşme için sunucuda önizleme uç noktası yok; tarayıcıda hesap yapılmıyor. Tutar kayıttan sonra sözleşme sayfasında görünür.
- "Taslak olarak kapat" ve otomatik taslak kaydı yok (sunucuda taslak sözleşme desteği yok).
- Kira ücretsiz dönemler ve düzensiz ödeme takvimi motorun mevcut metin alanlarıyla giriliyor (tablo düzenleyici yok).

## Test sonucu
- `test/contract-wizard.test.js` (2 test): alanların adımlara dağılması ve formda kalması, adım doğrulaması, kaydetmede ilk eksik adıma gitme, geçerli formda motor submit'inin çalışması, legacy modda dokunulmaması.
- Tarayıcıda uçtan uca: sihirbazla doldurulan sözleşme `POST /api/contracts` ile kaydedildi, motorun "Sözleşme oluşturuldu" bildirimi geldi.
- `node --test test/*.test.js`: öncekiyle aynı 5 test dışında hepsi geçti.

## Riskler
- Gerçek veriyle denenmedi. Sözleşme düzenleme de aynı formu kullanıyorsa sihirbaz orada da açılır.
