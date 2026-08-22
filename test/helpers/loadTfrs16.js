/**
 * tfrs16.js, bütün fonksiyonlarını tek bir
 *   document.addEventListener("DOMContentLoaded", () => { ... })
 * closure'ı içinde tanımlıyor. Bu yüzden iki şey gerekiyor:
 *
 * 1) jsdom test ortamında `require()` çağrıldığı anda document
 *    zaten "complete" durumdadır, dolayısıyla DOMContentLoaded
 *    olayı KENDİLİĞİNDEN bir daha ateşlenmez. Bu yüzden olayı
 *    testlerden biz elle dispatch ediyoruz.
 * 2) Closure'daki fonksiyonlar dışarıdan erişilemez olduğu için,
 *    tfrs16.js'in sonuna eklenmiş olan (additive) test-export
 *    shim'i çalıştığında bunları window.__TFRS16_TEST__ üzerine
 *    koyuyor. Biz de olay ateşlendikten sonra oradan okuyoruz.
 *
 * Not: tfrs16.js her require edildiğinde kendi init akışını
 * (v191InitUiWiring, refresh, vb.) da çalıştırır. Bu fonksiyonlar
 * dosyanın kendi içinde try/catch ile korunuyor, o yüzden burada
 * DOM'da bulunmayan elementler hata fırlatmaz; sadece console.error
 * ile loglanır (testte görebilirsin, zararsızdır).
 */
function loadTfrs16() {
  jest.resetModules();

  // Her testte temiz bir global durum için window.__TFRS16_TEST__'i sıfırla.
  delete window.__TFRS16_TEST__;

  require("../../tfrs16.js");

  document.dispatchEvent(
    new window.Event("DOMContentLoaded", { bubbles: true, cancelable: true })
  );

  if (!window.__TFRS16_TEST__) {
    throw new Error(
      "window.__TFRS16_TEST__ boş — tfrs16.js sonundaki test export shim'i " +
      "eklenmemiş veya DOMContentLoaded dispatch edilirken bir hata oluşmuş olabilir."
    );
  }

  return window.__TFRS16_TEST__;
}

module.exports = { loadTfrs16 };
