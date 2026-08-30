/**
 * tfrs16.js içine eklenecek TÜFE endeks okuma yardımcıları.
 * Bu dosya, fetch-tuik-tufe.js tarafından üretilen ./data/tufe-endeks.json
 * dosyasını okur. Statik (GitHub Pages) ortamda çalışacağı için tarayıcıdan
 * fetch ile aynı repo içindeki JSON'u çeker — API key'e ihtiyaç duymaz.
 */

let _tufeCache = null;

/**
 * data/tufe-endeks.json dosyasını yükler (bir kez, sonra cache'ler).
 * @param {string} jsonPath - JSON dosyasının uygulamaya göreli yolu
 * @returns {Promise<Record<string, number>>} { "YYYY-MM": deger } şeklinde endeks tablosu
 */
async function loadTufeIndex(jsonPath = "./data/tufe-endeks.json") {
  if (_tufeCache) return _tufeCache;
  const res = await fetch(jsonPath);
  if (!res.ok) {
    throw new Error(`TÜFE endeks dosyası okunamadı: ${jsonPath} (${res.status})`);
  }
  const data = await res.json();
  _tufeCache = data.endeks;
  return _tufeCache;
}

/**
 * Belirli bir dönem (YYYY-MM) için endeks değerini döndürür.
 * Tam eşleşme yoksa en yakın önceki dönemi kullanır (ay sonu/gün detayı
 * olmayan sözleşme tarihleri için pratik bir yaklaşım — gerekirse
 * tfrs16.js'teki mevcut enterpolasyon mantığınıza göre değiştirin).
 */
function getTufeIndex(index, period /* "YYYY-MM" */) {
  if (index[period] !== undefined) return index[period];

  const periods = Object.keys(index).sort();
  let closest = null;
  for (const p of periods) {
    if (p <= period) closest = p;
    else break;
  }
  if (closest === null) {
    throw new Error(`${period} dönemi için TÜFE endeksi bulunamadı (veri aralığı: ${periods[0]}–${periods.at(-1)})`);
  }
  return index[closest];
}

/**
 * TMS 29 kapsamında iki dönem arasındaki enflasyon düzeltme katsayısını hesaplar.
 * factor = endeks(hedefDonem) / endeks(kaynakDonem)
 */
function getInflationFactor(index, sourcePeriod, targetPeriod) {
  const sourceVal = getTufeIndex(index, sourcePeriod);
  const targetVal = getTufeIndex(index, targetPeriod);
  return targetVal / sourceVal;
}

export { loadTufeIndex, getTufeIndex, getInflationFactor };
