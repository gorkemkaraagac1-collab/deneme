# UI v2: Ortak boş, yükleniyor ve hata durumları

## Ne bulundu

V2 ekranlarında boş liste, yükleme, hata ve kapsam/yetki açıklamaları farklı görsel ve erişilebilirlik davranışlarıyla sunuluyordu. Tutar alanlarının durum metinleri de normal finansal değerlerden ayrı biçimde ele alınmalı.

## Ne değişti

`html[data-lq-ui="2"]` altında çalışan ortak durum tanıma ve sunum katmanı eklendi. Mevcut durum metinlerini ve düğmeleri korur; boş ve bekleme durumlarını nazikçe, hata ve yetkisiz durumlarını belirgin biçimde duyurur. Kaynak veya destek kapsamı eksikse yalnızca durum gösterilir; tarayıcı tutar üretmez ya da sıfır varsaymaz. Yükleme iskeletlerinin mevcut görseli korunur. Eski DOM kimlikleri ve `window.GK_TFRS16` API'si değişmez.

## Test sonucu

`test/ui-v2-states.test.js` ortak durum sınıflandırmasını, ARIA duyurularını, durum geçişinde niteliklerin geri alınmasını, tutar metninin aynen kalmasını ve legacy görünümün etkilenmemesini sınar. Proje testleri ve koruma kontrollerinin sonuçları PR açıklamasında listelenir.

## Riskler

Durum türü yalnızca mevcut erişilebilirlik nitelikleri, bilinen durum sınıfları ve açık durum metinlerinden tanınır. Belirsiz mesajlar normal içerik olarak kalır. Muhasebe hesabı, API, sunucu paketi veya kayıt davranışı değiştirilmedi.
