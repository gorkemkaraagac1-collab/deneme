const {
  TextEncoder,
  TextDecoder
} = require("util");

if (!global.TextEncoder) {
  global.TextEncoder = TextEncoder;
}

if (!global.TextDecoder) {
  global.TextDecoder = TextDecoder;
}

/**
 * jest-environment-jsdom, Node'un yerleşik global fetch()'ini
 * jsdom sandbox'ına otomatik olarak taşımaz. js/tfrs16.js'teki
 * refreshInflationIndexCacheFromBackend() (TÜİK/backend endeks
 * entegrasyonu, additive) fetch() kullandığı için testlerin
 * jest.spyOn(global, "fetch") ile bunu mock'layabilmesi adına
 * burada zararsız bir stub bırakılıyor — testler her zaman bunu
 * kendi mock'larıyla override eder; bu stub'ın kendisi hiçbir
 * gerçek ağ isteği ATMAZ. Zaten tanımlıysa (ör. Node'un kendi
 * fetch'i jsdom'a sızmışsa) dokunulmaz.
 */
if (typeof global.fetch !== "function") {
  global.fetch = () => Promise.reject(new Error("fetch mock'lanmadan çağrıldı (test setup.js stub)."));
}
