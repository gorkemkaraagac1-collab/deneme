# Canlı production bundle audit'i

Tekrarlanabilir kontrol:

```text
node scripts/check-production-bundle.js
```

19 Eylül 2026 kontrolünde `https://leaseqant.com/tfrs16.html` içindeki 18
same-origin JavaScript dosyası indirildi ve tarandı. `leaseqant.com` ile
GitHub Pages deploy'u aynı script içeriklerini verdi. Eski engine marker'ları,
test handle'ları, source-map referansları ve raw TFRS 16 implementation izleri
bulunmadı.

Eski `js/tfrs16-engine.js`, source-map ve backup/artifact yolları 404 dönüyor.
HTML ve ana bundle'lar production checkout ile aynı hash/byte içeriğine sahip.
HTML ve JavaScript için CDN cache başlıkları `max-age=600`; deploy sonrası
stale cache riski bu nedenle sınırlı ve versioned asset query string'leriyle
izlenebilir.
