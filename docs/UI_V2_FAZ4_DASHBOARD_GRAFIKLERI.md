# UI v2 — Faz 4: Genel Bakış grafikleri

## Ne bulundu?
- Genel Bakış'taki "Sözleşme vade yoğunluğu", "Vade yapısı" ve "Varlık sınıfı dağılımı" kartları hiçbir onaylı kaynağa bağlı değildi; raporlama katmanı bu alanlara yalnızca durum metni yazıyordu.
- Onaylı tutarların tek kaynağı dipnot paketi (`LeaseQantPrivateTfrs16Facade.loadLeaseDisclosureAvailability` + `loadLeaseDisclosure`). Paket şirket bazında; "Tüm Şirketler" için konsolide paket yok.
- Pakette kira yükümlülüğü için TMS 21 kur hareketi alanı var, TMS 29 parasal kazanç/kayıp alanı yok.

## Ne değişti?
- `js/lq-dashboard-charts.js` (yeni, yalnızca v2): tek şirket seçiliyken ortak raporlama dönemi için dipnot paketini alır, dipnot ekranıyla aynı kapsam denetimini yapar (şirket, dönem, popülasyon, sözleşme/hesaplama kimlikleri, para birimi kanıtı, doğrulama durumu), üç grafik çizer:
  1. **Kira yükümlülüğü köprüsü:** açılış → ilk muhasebeleştirme → faiz → ödemeler → modifikasyon → yeniden ölçüm → TMS 21 kur farkı → kapanış. Gerçekleşen ödeme kaynağı yoksa planlanan ödeme "planlanan" etiketiyle gösterilir. Hareketlerin toplamı kapanışı vermiyorsa fark ayrı, taralı bir **mutabakat farkı** satırı olarak gösterilir (TMS 29 parasal kazanç/kayıp ve kaynağı gelmeyen kalemler). Kaynağı olmayan kalem sıfır sayılmaz, "Kaynak gerekli" rozetiyle gösterilir. Hareketler bakiyeye göre küçükse eksen sıfırdan başlamaz; bu durum grafiğin altında yazılır ve açılış/kapanış çubukları kesik çizilir.
  2. **Vade analizi (TFRS 16.58):** iskonto edilmemiş dilimler + "iskonto edilmemiş toplam − gelecek finansman gideri = defter değeri" mutabakatı. Dilim toplamı toplamla uyuşmazsa uyarı çıkar.
  3. **Varlık sınıfı dağılımı:** kullanım hakkı varlığı kapanışı, sınıf bazında, pay yüzdesiyle.
- Durumlar: "Tüm Şirketler" → şirket seçin mesajı; yükleniyor iskeleti; kapsam uyuşmazlığı ve yetki hataları; onaylı kaynak yoksa Dipnotlar ekranına geçiş bağlantısı.
- Yanıtlar 2 dakika önbellekte tutulur (şirket + dönem anahtarı).
- `css/lq-v2.css`: grafik stilleri; grafikler açıkken eski yer tutucu kartlar gizlenir, kapanış kontrolü kartı tam genişlik olur.
- `tfrs16.html`: yeni script etiketi (lq-ui-v2.js'ten sonra) ve CSS sürüm numarası.
- Değişmeyenler: hesaplama/API kodu, özel hesaplama sınırı, DOM kimlikleri, eski kartların HTML'i (yalnızca CSS ile gizleniyor; `?ui=legacy` aynen çalışır).

## Test sonucu
- `test/dashboard-charts.test.js` (7 test): köprü sırası ve işaretleri, mutabakat farkı, eksik alanın sıfır sayılmaması, planlanan ödeme etiketi, vade mutabakatı, "Tüm Şirketler" durumu, kapsam uyuşmazlığının reddi, kaynak yok bağlantısı, legacy modda hiçbir şey eklenmemesi.
- `node --test test/*.test.js`: 36 geçti, 5 başarısız (değişiklik öncesiyle aynı 5 test; yerel backend veritabanı ve `/tmp` fikstürleri gerektiriyor).
- `check-authority-public-boundary.js`, `check-tfrs16-cutover.js`: geçti.
- Sahte paketle 1440 px ve 390 px ekran görüntüsü kontrolü.

## Riskler
- **Gerçek veriyle doğrulanmadı.** İşaret kuralı varsayımı: ödeme alanı pozitif gelse de azalış sayılır; faiz, ilaveler, modifikasyon, yeniden ölçüm ve TMS 21 paketteki işaretiyle alınır. Sunucu farklı işaret kullanıyorsa fark mutabakat satırında görünür, gizlenmez.
- Mutabakat farkı satırı TMS 29 tutarını **ölçmez**; yalnızca açıklanamayan farkı gösterir. TMS 29 parasal kazanç/kayıp için pakette ayrı alan açılması backend işi.
- "Gelecek dönem finansman gideri" sunucudan gelmiyor; toplam ile defter değerinin farkı olarak gösteriliyor ve "(fark)" diye etiketli.
- Konsolide (tüm şirketler) grafik yok.
- Genel Bakış açıldığında dipnot paketi için ek sunucu çağrısı yapılır (önbellek 2 dk).
- Bu fazın kapsamı dışında görülen: Aksiyon merkezi kartlarında metin çok dar sütuna sıkışıyor (Faz 1'den kalan düzen sorunu).
