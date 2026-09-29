# UI v2: Erişilebilirlik

## Ne bulundu

Sözleşme ve finansal raporlama sekmelerinde tek odak durağı, ok tuşlarıyla gezinme ve sekme-paneli ilişkileri eksikti. Sözleşme işlem menülerinde yön tuşları ve Escape ile odağı tetikleyiciye geri verme yoktu. Tarih alanlarının odak halkası yetersizdi; bazı devre dışı metinler ve tarih yer tutucusu 4,5:1 kontrastın altında kalıyordu. İçe aktarma penceresinin erişilebilir adı da yoktu.

## Ne değişti

Sekmeler ok/Home/End ile etkinleşir, seçili sekme tek Tab durağı olur ve içerik paneli seçili sekmeye bağlanır. Navigasyon menüsü ve mobil menü Escape ile kapanır, odak uygun düğmeye döner. Sözleşme işlem menüleri yön tuşlarıyla gezinir ve erişilebilir ad taşır. Açık pencereler adlandırılır; aktif navigasyon `aria-current` ile bildirilir. Form, arama ve tarih alanlarında görünür odak halkası; devre dışı kontrollerde ve tarih ipucunda AA kontrastı sağlanır. Bütün değişiklikler yalnızca UI v2 kapsamında çalışır.

## Test sonucu

Yeni erişilebilirlik testleri 5/5; bu testleri de içeren ilgili v2, sözleşme, tarih, raporlama ve sihirbaz regresyonları 50/50 geçti. Tam paket 99/101 geçti; iki browser testi disposable `leaseqant_agent_test` yerel veritabanı koruması nedeniyle başarısız oldu. Yetki sınırı ve cutover kontrolleri geçti. Odak, klavye etkinleştirme, sekme-paneli bağlantısı, menü kapatma/odak dönüşü, dialog adları, legacy yalıtımı ve temsilî WCAG AA kontrast çiftleri test edildi.

## Riskler

Değişiklikler sunum ve erişilebilirlik katmanındadır; hesaplama, API ve muhasebe davranışı değişmez. `?ui=legacy` görünümü yeni erişilebilirlik geliştirmelerinden etkilenmez.
