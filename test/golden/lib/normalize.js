/**
 * ============================================================
 * FAZ 0.2 — GOLDEN-OUTPUT NORMALİZASYONU
 * ============================================================
 *
 * Golden-output karşılaştırması ancak çıktı DETERMİNİSTİK ise
 * anlamlıdır. Motorda üç non-determinizm kaynağı tespit edildi:
 *
 *   1) Üretilen kimlikler — runContractControls() → `controlRunId`,
 *      createModification() → modification.id, reassessment.id.
 *      Bunlar her koşumda farklı; ama İLİŞKİLERİ (hangi fiş hangi
 *      modification'a ait) anlamlı. Bu yüzden SİLİNMEZ, KANONİKLEŞTİRİLİR:
 *      ilk görülen ham kimlik → "#ID1", ikincisi → "#ID2" ...
 *      Böylece "id değişti" gürültüsü yok olurken "ilişki koptu"
 *      regresyonu hâlâ yakalanır.
 *
 *   2) Zaman damgaları — `testedAt`, `createdAt`, `appliedAt`,
 *      `updatedAt`, `cancelledAt`, `timestamp`. Bunlar sabit bir
 *      yer tutucuya çevrilir. (Harness ayrıca sistem saatini
 *      dondurur; bu, kuşak/kemer yaklaşımının ikinci katmanıdır.)
 *
 *   3) Float gürültüsü — 4.49e-10 gibi kalıntılar. Bunlar YUVARLANMAZ;
 *      golden karşılaştırma varsayılan olarak TAM eşitlik arar, çünkü
 *      saf kod taşıma (extract-and-delegate) aritmetiği değiştirmez.
 *      Yuvarlamak, gerçek bir sapmayı gizleyebilirdi.
 *
 * NOT: `-0` ve `NaN`/`Infinity` JSON'da kaybolur; bunlar açık
 * yer tutucu string'lere çevrilir ki sessizce `null` olmasınlar.
 */

"use strict";

/** Sabit bir yer tutucuya çevrilecek zaman damgası alan adları. */
const TIMESTAMP_KEYS = new Set([
  "testedAt",
  "createdAt",
  "updatedAt",
  "appliedAt",
  "cancelledAt",
  "modifiedAt",
  "generatedAt",
  "timestamp",
  "runAt",
  "exportedAt"
]);

/** Kanonikleştirilecek (üretilen) kimlik alan adları. */
const GENERATED_ID_KEYS = new Set([
  "controlRunId",
  "modificationId",
  "reassessmentId",
  "adjustmentId",
  "journalId",
  "entryId",
  "auditId",
  "eventId",
  "batchId"
]);

const TIMESTAMP_PLACEHOLDER = "<TIMESTAMP>";

/**
 * ISO-8601 zaman damgası biçimini yakalar. Bazı alanlar (ör.
 * modification.id) `MOD-1735689600000-x9k2` gibi zaman damgası
 * GÖMÜLÜ kimlikler olabilir — bunlar GENERATED_ID_KEYS ya da
 * `id` üzerinden kanonikleştirilerek ele alınır.
 */
const ISO_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * Üretilmiş görünen kimlikleri tanır: içinde 10+ haneli bir
 * epoch damgası veya rastgele base36 kuyruğu barındıranlar.
 * Fixture kimlikleri (GC-01, SLB-01) bu kalıba UYMAZ, bu yüzden
 * onlar olduğu gibi korunur — kasıtlı.
 */
function looksGenerated(value) {
  if (typeof value !== "string") return false;
  if (/\d{13}/.test(value)) return true;              // epoch ms
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(value)) return true; // uuid
  if (/-[a-z0-9]{6,}$/i.test(value) && /\d/.test(value)) return true;
  return false;
}

/**
 * Normalizasyon bağlamı: bir golden kaydı boyunca kimlik eşlemesi
 * paylaşılır ki aynı ham kimlik her yerde aynı takma ada dönüşsün.
 */
function createContext() {
  return { idMap: new Map(), nextId: 1 };
}

function canonicalId(ctx, raw) {
  if (!ctx.idMap.has(raw)) {
    ctx.idMap.set(raw, `#ID${ctx.nextId++}`);
  }
  return ctx.idMap.get(raw);
}

function normalizeValue(value, key, ctx) {
  if (value === null || value === undefined) return null;

  if (typeof value === "number") {
    if (Number.isNaN(value)) return "<NaN>";
    if (!Number.isFinite(value)) return value > 0 ? "<Infinity>" : "<-Infinity>";
    if (Object.is(value, -0)) return "<-0>";
    return value;
  }

  if (typeof value === "boolean") return value;

  if (typeof value === "string") {
    if (TIMESTAMP_KEYS.has(key)) return TIMESTAMP_PLACEHOLDER;
    if (ISO_TIMESTAMP_RE.test(value)) {
      // Kontrat tarihleri (2026-01-01T00:00:00.000Z) da bu kalıba uyar
      // ve ONLAR ANLAMLIDIR — bu yüzden yalnızca gece yarısı OLMAYAN
      // damgalar (yani gerçek "şu an" damgaları) yer tutucuya çevrilir.
      return value.endsWith("T00:00:00.000Z") ? value : TIMESTAMP_PLACEHOLDER;
    }
    if (GENERATED_ID_KEYS.has(key) || (key === "id" && looksGenerated(value))) {
      return canonicalId(ctx, value);
    }
    if (looksGenerated(value) && /Id$/.test(key)) {
      return canonicalId(ctx, value);
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(item => normalizeValue(item, key, ctx));
  }

  if (typeof value === "object") {
    // Date nesneleri JSON'da ISO string'e döner; aynı kuralı uygula.
    if (value instanceof Date) {
      const iso = Number.isNaN(value.getTime()) ? "<InvalidDate>" : value.toISOString();
      return normalizeValue(iso, key, ctx);
    }
    const out = {};
    // Anahtar sırasını sabitle — obje literal sırası refaktörde
    // değişebilir ve bu ANLAMLI BİR DAVRANIŞ DEĞİŞİKLİĞİ DEĞİLDİR.
    Object.keys(value).sort().forEach(k => {
      out[k] = normalizeValue(value[k], k, ctx);
    });
    return out;
  }

  if (typeof value === "function") return "<Function>";

  return String(value);
}

/**
 * Bir golden kaydını normalize eder.
 * @param {*} record - Ham çıktı
 * @returns {*} deterministik, sıralı-anahtarlı kopya
 */
function normalize(record) {
  return normalizeValue(record, "__root__", createContext());
}

/** Deterministik JSON serileştirme (anahtarlar zaten sıralı). */
function stableStringify(record) {
  return JSON.stringify(normalize(record), null, 2);
}

module.exports = {
  normalize,
  stableStringify,
  TIMESTAMP_KEYS,
  GENERATED_ID_KEYS,
  TIMESTAMP_PLACEHOLDER
};
