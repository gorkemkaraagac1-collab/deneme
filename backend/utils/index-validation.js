/**
 * ============================================================
 * INFLATION INDEX VALIDATION
 * ============================================================
 *
 * TÜİK'ten alınan (veya manuel override edilen) endeks
 * kayıtlarının backend/db'ye yazılmadan önce geçmesi gereken
 * doğrulama kurallarını içerir.
 *
 * KAPSAM: Bu dosya SAF fonksiyonlardan oluşur — DB/network
 * bağımlılığı yoktur, tek başına test edilebilir. Karar
 * mantığını (ör. "beklenen sayısal aralık nedir") burada tek bir
 * yerde toplamak, hem tuik-index-service.js'i hem de ileride
 * eklenebilecek başka bir çağıran kodu (ör. manuel override
 * formu) aynı kurallara tabi tutar.
 *
 * ÖNEMLİ — SESSİZ VARSAYILAN YOK: js/tfrs16.js'teki
 * getInflationIndex() ilkesiyle tutarlı olarak, bu dosyadaki
 * hiçbir fonksiyon geçersiz/eksik veri için "makul bir tahmin"
 * üretmez — ya geçerlidir ya da { valid: false, errors: [...] }
 * döner.
 */

const MONTH_FORMAT = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * 'YYYY-MM' formatını doğrular. getInflationIndex()'teki
 * regex (/^\d{4}-\d{2}$/) ile kasıtlı olarak DAHA SIKI: burada
 * ay kısmının 01-12 aralığında olması da kontrol edilir (DB'ye
 * yazılacak veri için ek bir güvenlik katmanı — frontend'deki
 * mevcut regex'e dokunulmuyor, o hâlâ kendi kuralını uyguluyor).
 *
 * @param {string} month
 * @returns {boolean}
 */
function isValidMonthFormat(month) {
  return typeof month === "string" && MONTH_FORMAT.test(month.trim());
}

/**
 * Endeks değerinin sayısal ve pozitif olduğunu doğrular.
 * DB'deki chk_inflation_index_value_positive CHECK constraint'i
 * ile aynı kuralın application-level karşılığıdır — DB kısıtı
 * son savunma hattıdır, burada erken ve anlamlı bir hata mesajı
 * üretmek amaçlanır.
 *
 * @param {number|string} value
 * @returns {boolean}
 */
function isValidIndexValue(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}

/**
 * TÜİK'ten (veya override girdisinden) gelen bir ay/endeks
 * kaydını, önceki (bilinen en son aktif) değerle karşılaştırarak
 * "beklenen sayısal aralık" kontrolü yapar.
 *
 * Kasıtlı olarak KATI bir aralık kontrolü DEĞİL, bir ANOMALİ
 * uyarısıdır: enflasyon endeksleri ardışık aylar arasında
 * genellikle küçük/orta büyüklükte değişir; bir ayda endeksin
 * yarıya inmesi veya iki katına çıkması gibi bir sıçrama,
 * muhtemelen bir veri/parse hatasıdır (yanlış ondalık ayracı,
 * yanlış sütun, vb.) ve reddedilmelidir.
 *
 * previousValue verilmezse (ilk kayıt, karşılaştıracak önceki
 * ay yoksa) bu kontrol atlanır — false negatif üretmemek için.
 *
 * @param {number} newValue
 * @param {number|null} previousValue
 * @returns {{ valid: boolean, warning?: string }}
 */
function isWithinExpectedRange(newValue, previousValue) {
  if (previousValue == null || !Number.isFinite(Number(previousValue))) {
    return { valid: true };
  }

  const prev = Number(previousValue);
  if (prev <= 0) {
    return { valid: true };
  }

  const ratio = Number(newValue) / prev;

  // Bir ay içinde endeksin %50'den fazla düşmesi veya iki katından
  // fazla artması, gerçekçi bir enflasyon hareketi değil, veri
  // hatası ihtimalidir. Bu eşikler bilinçli olarak GENİŞ tutuldu
  // (yüksek enflasyon dönemlerinde aylık %50'ye yaklaşan artışlar
  // teorik olarak mümkün olabilir) — amaç, gerçek veriyi
  // reddetmemek, sadece bariz hataları yakalamaktır.
  if (ratio < 0.5 || ratio > 2) {
    return {
      valid: false,
      warning: `Yeni endeks değeri (${newValue}), önceki aktif değere (${prev}) göre beklenmeyen bir sıçrama gösteriyor (oran: ${ratio.toFixed(4)}). Manuel doğrulama gerektirir.`
    };
  }

  return { valid: true };
}

/**
 * TÜİK'ten gelen ham bir kaydı (henüz normalize edilmemiş) DB'ye
 * yazılabilir hale getirmeden önce uçtan uca doğrular.
 *
 * @param {{ month: string, value: number|string }} input
 * @param {number|null} previousActiveValue - aynı ay için değil,
 *   karşılaştırma amaçlı en yakın önceki aktif kayıt.
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateInflationIndexEntry(input, previousActiveValue = null) {
  const errors = [];

  const month = String(input?.month || "").trim();
  if (!isValidMonthFormat(month)) {
    errors.push(`Geçersiz ay formatı: "${input?.month}" (YYYY-MM, 01-12 arası ay bekleniyor).`);
  }

  if (!isValidIndexValue(input?.value)) {
    errors.push(`Endeks değeri pozitif ve sayısal olmalı: "${input?.value}".`);
  }

  // Format/değer zaten geçersizse aralık kontrolünü anlamsız
  // kılar — erken çık.
  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const rangeCheck = isWithinExpectedRange(Number(input.value), previousActiveValue);
  if (!rangeCheck.valid) {
    errors.push(rangeCheck.warning);
  }

  return { valid: errors.length === 0, errors };
}

module.exports = {
  isValidMonthFormat,
  isValidIndexValue,
  isWithinExpectedRange,
  validateInflationIndexEntry
};
