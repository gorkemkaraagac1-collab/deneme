const pool = require("../db/pool");
const crypto = require("crypto");
const { validateInflationIndexEntry, parseBulkIndexInput } = require("../utils/index-validation");

/**
 * ============================================================
 * TÜİK INDEX SERVICE
 * ============================================================
 *
 * KAPSAM: Bu servis BAĞIMSIZ bir "TMS 29 ürünü" değildir. Tek
 * sorumluluğu, js/tfrs16.js'teki mevcut TMS 29 restatement
 * motorunun (getInflationIndex/getInflationRatio/
 * applyTMS29Restatement) ihtiyaç duyduğu aylık endeks
 * değerlerini resmî TÜİK kaynağından güvenilir, doğrulanmış ve
 * audit edilebilir şekilde sağlamaktır. O hesaplama motoruna bu
 * dosyadan HİÇBİR ŞEKİLDE erişilmez/dokunulmaz.
 *
 * Şu an tek desteklenen endeks tipi: 'TUFE_GENEL'.
 *
 * ------------------------------------------------------------
 * ÖNEMLİ — TÜİK KAYNAK DURUMU (AÇIKÇA RAPORLANIYOR)
 * ------------------------------------------------------------
 * TÜİK'in TÜFE serisi için resmî, dokümante edilmiş, stabil bir
 * REST/JSON API'si YOKTUR:
 *
 *   - Eski SDMX servisi (nsiws.tuik.gov.tr) 2026-08 itibarıyla
 *     erişilemez durumdadır.
 *   - Yeni veri portalı (databrowser2.tuik.gov.tr) bir
 *     JSON-stat 2.0 API sunuyor, ANCAK bu API TÜİK tarafından
 *     resmî olarak dokümante edilmemiştir; üçüncü taraf
 *     araçlar (ör. topluluk tarafından geliştirilen R/Python
 *     paketleri) bu endpoint'leri tarayıcı davranışını
 *     gözlemleyerek (reverse-engineering) keşfetmiştir.
 *   - Bu sandbox ortamının dış ağ erişimi KAPALIDIR — bu
 *     endpoint'lerin gerçek şekli, kimlik doğrulama gereksinimi
 *     (varsa) veya yanıt formatı bu oturumda DOĞRULANAMADI.
 *
 * Bu nedenle bu dosya, TÜİK'e giden HTTP çağrısını sahte/mock bir
 * "başarılı" yanıtla DOLDURMAZ. Bunun yerine:
 *
 *   1. Gerçek kaynak URL'i bir ortam değişkeninden
 *      (TUIK_INDEX_SOURCE_URL) okunur — koda hard-code edilmiş,
 *      doğrulanmamış bir TÜİK URL'i YOKTUR.
 *   2. TUIK_INDEX_SOURCE_URL tanımlı değilse, fetchFromTuik()
 *      AÇIK ve ANLAMLI bir hata fırlatır (bkz. TuikSourceNotConfiguredError).
 *      Sessizce boş/varsayılan veri dönmez.
 *   3. Yanıt geldiğinde, beklenen şekle (aşağıdaki
 *      RAW_RESPONSE_SHAPE) uymuyorsa yine açık bir hata fırlatır
 *      — "büyük ihtimalle doğru" bir alanı tahmin ederek
 *      normalize ETMEZ.
 *
 * PRODUCTION ÖNCESİ YAPILMASI GEREKEN: Gerçek TÜİK
 * databrowser2 JSON-stat 2.0 endpoint'i (veya TÜİK ile
 * kurulacak resmî bir veri erişim anlaşması/API anahtarı) ağ
 * erişimi olan bir ortamda doğrulanmalı, RAW_RESPONSE_SHAPE ve
 * normalizeTuikRecord() buna göre kesinleştirilmelidir. Bu,
 * CHANGES.md'de "kalan risk" olarak ayrıca raporlanıyor.
 */

const INDEX_TYPE_TUFE_GENEL = "TUFE_GENEL";

class TuikSourceNotConfiguredError extends Error {
  constructor() {
    super(
      "TUIK_INDEX_SOURCE_URL ortam değişkeni tanımlı değil. " +
      "TÜİK kaynağı doğrulanmadan sahte/varsayılan veri üretilmez " +
      "(bkz. backend/services/tuik-index-service.js dosya başı notu)."
    );
    this.name = "TuikSourceNotConfiguredError";
    this.code = "TUIK_SOURCE_NOT_CONFIGURED";
  }
}

class TuikSourceUnreachableError extends Error {
  constructor(cause) {
    super(`TÜİK kaynağına erişilemedi: ${cause?.message || cause}`);
    this.name = "TuikSourceUnreachableError";
    this.code = "TUIK_SOURCE_UNREACHABLE";
    this.cause = cause;
  }
}

class TuikResponseShapeError extends Error {
  constructor(detail) {
    super(`TÜİK yanıtı beklenen formatta değil: ${detail}`);
    this.name = "TuikResponseShapeError";
    this.code = "TUIK_RESPONSE_SHAPE_ERROR";
  }
}

/**
 * TÜİK kaynağından ham veriyi çeker.
 *
 * Beklenen ham yanıt şekli (RAW_RESPONSE_SHAPE) — bu, gerçek
 * TÜİK endpoint'i ağ erişimiyle doğrulanana kadar bir
 * VARSAYIMDIR ve normalizeTuikRecord() ile birlikte gözden
 * geçirilmelidir:
 *
 *   [{ period: "2025-01" | "2025M01" | ..., value: number|string }, ...]
 *
 * @param {string[]} months - 'YYYY-MM' formatında istenen aylar.
 * @returns {Promise<Array<{ period: string, value: number|string }>>}
 */
async function fetchFromTuik(months) {
  const sourceUrl = process.env.TUIK_INDEX_SOURCE_URL;

  if (!sourceUrl) {
    throw new TuikSourceNotConfiguredError();
  }

  let response;
  try {
    response = await fetch(sourceUrl, {
      method: "GET",
      headers: { Accept: "application/json" }
    });
  } catch (error) {
    throw new TuikSourceUnreachableError(error);
  }

  if (!response.ok) {
    throw new TuikSourceUnreachableError(
      new Error(`HTTP ${response.status} ${response.statusText}`)
    );
  }

  let body;
  try {
    body = await response.json();
  } catch (error) {
    throw new TuikResponseShapeError("Yanıt geçerli JSON değil.");
  }

  if (!Array.isArray(body)) {
    throw new TuikResponseShapeError(
      "Kök seviyede bir dizi bekleniyordu (bkz. RAW_RESPONSE_SHAPE)."
    );
  }

  // İstenen aylarla sınırla — kaynağın gereğinden fazla veri
  // döndürmesi durumunda gereksiz satır işlemeyi önler.
  const monthSet = new Set(months);
  return body.filter(row => monthSet.has(normalizeMonthLabel(row?.period)));
}

/**
 * TÜİK'in dönebileceği çeşitli ay etiketi biçimlerini
 * ('2025-01', '2025M01', '202501' gibi) 'YYYY-MM'e normalize
 * eder. Tanınmayan bir biçim gelirse null döner (çağıran taraf
 * bunu bir validasyon hatası olarak ele alır — sessizce atlanmaz).
 *
 * @param {string} rawPeriod
 * @returns {string|null}
 */
function normalizeMonthLabel(rawPeriod) {
  const s = String(rawPeriod || "").trim();

  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(s)) {
    return s;
  }

  const mMatch = s.match(/^(\d{4})M(\d{2})$/);
  if (mMatch) {
    return `${mMatch[1]}-${mMatch[2]}`;
  }

  const compact = s.match(/^(\d{4})(\d{2})$/);
  if (compact) {
    return `${compact[1]}-${compact[2]}`;
  }

  return null;
}

/**
 * Ham bir TÜİK kaydını { month, value } şekline normalize eder.
 * Normalize edilemeyen bir kayıt için null döner — çağıran taraf
 * (syncFromTuik) bunu "skipped" olarak raporlar, sessizce yutmaz.
 *
 * @param {{ period: string, value: number|string }} raw
 * @returns {{ month: string, value: number }|null}
 */
function normalizeTuikRecord(raw) {
  const month = normalizeMonthLabel(raw?.period);
  if (!month) {
    return null;
  }

  // TÜİK bazı yayınlarda ondalık ayracı olarak virgül kullanabilir
  // ("3512,75") — bu normalize edilmezse Number() NaN döner ve
  // validateInflationIndexEntry zaten reddeder, ama burada açıkça
  // ele alınması "sessizce yanlış veri" riskini azaltır.
  const rawValue = typeof raw?.value === "string"
    ? raw.value.replace(",", ".")
    : raw?.value;

  const value = Number(rawValue);
  if (!Number.isFinite(value)) {
    return null;
  }

  return { month, value };
}

/**
 * Belirli bir index_type + index_month için "aktif" (superseded_by
 * IS NULL) kaydı getirir. Yoksa null.
 *
 * @param {string} indexType
 * @param {string} month
 * @param {object} db - pool veya transaction client
 * @returns {Promise<object|null>}
 */
async function getActiveIndexRecord(indexType, month, db = pool) {
  const result = await db.query(
    `SELECT * FROM inflation_indices
     WHERE index_type = $1 AND index_month = $2 AND superseded_by IS NULL`,
    [indexType, month]
  );
  return result.rows[0] || null;
}

/**
 * Belirli bir aydan KRONOLOJİK OLARAK ÖNCEKİ en yakın "aktif" kaydı
 * getirir (index_month < month, superseded_by IS NULL, azalan
 * sırada ilk satır). Bu, syncFromTuik'teki anomali/aralık
 * kontrolünün (isWithinExpectedRange) karşılaştırma referansıdır —
 * DİKKAT: getActiveIndexRecord(indexType, month) ile KARIŞTIRILMAMALI;
 * o AYNI ayın aktif kaydını (supersede kararı için) getirirken, bu
 * fonksiyon bir ÖNCEKİ ayın değerini (trend/anomali kontrolü için)
 * getirir. YYYY-MM string'leri sözlüksel sıralamada kronolojik
 * sırayla eşleştiği için basit bir string karşılaştırması yeterlidir.
 *
 * @param {string} indexType
 * @param {string} month
 * @param {object} db
 * @returns {Promise<object|null>}
 */
async function getNearestPriorActiveRecord(indexType, month, db = pool) {
  const result = await db.query(
    `SELECT * FROM inflation_indices
     WHERE index_type = $1 AND index_month < $2 AND superseded_by IS NULL
     ORDER BY index_month DESC
     LIMIT 1`,
    [indexType, month]
  );
  return result.rows[0] || null;
}

/**
 * Bir ay için yeni bir endeks kaydı ekler. Aynı ay için zaten
 * aktif bir kayıt varsa VE değer FARKLIYSA, eskiyi UPDATE ETMEZ
 * — yeni bir satır ekler ve eskisinin superseded_by alanını yeni
 * satırın id'sine bağlar (immutable/audit edilebilir tasarım,
 * bkz. init.sql). Değer AYNIYSA (TÜİK aynı veriyi tekrar
 * gönderdiyse) hiçbir şey yapmaz — gereksiz superseding zinciri
 * oluşturmaz.
 *
 * Transaction, çağıran taraf (syncFromTuik) tarafından yönetilir;
 * bu fonksiyon kendi başına BEGIN/COMMIT açmaz — böylece birden
 * fazla ay tek bir transaction içinde işlenebilir.
 *
 * @param {object} client - transaction client (pool.connect() ile alınmış)
 * @param {{ indexType: string, month: string, value: number, source: 'TUIK_AUTO'|'MANUAL_OVERRIDE', sourceUrl: string|null, retrievedBy: string|null, verificationStatus: string }} input
 * @returns {Promise<{ action: 'inserted'|'superseded'|'unchanged', record: object|null, previous: object|null }>}
 */
async function upsertIndexRecord(client, input) {
  const {
    indexType,
    month,
    value,
    source,
    sourceUrl,
    retrievedBy,
    verificationStatus
  } = input;

  // Aynı satırı iki kez okuyup güncellememek için satırı kilitle
  // (aynı anda iki senkronizasyon çağrısı çakışırsa race condition
  // önlenir — admin-licenses.js'teki "FOR UPDATE" deseniyle aynı
  // yaklaşım).
  const activeResult = await client.query(
    `SELECT * FROM inflation_indices
     WHERE index_type = $1 AND index_month = $2 AND superseded_by IS NULL
     FOR UPDATE`,
    [indexType, month]
  );
  const active = activeResult.rows[0] || null;

  if (active && Number(active.index_value) === Number(value)) {
    return { action: "unchanged", record: active, previous: null };
  }

  const insertResult = await client.query(
    `INSERT INTO inflation_indices
       (index_type, index_month, index_value, source, source_url,
        retrieved_at, retrieved_by, verification_status)
     VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7)
     RETURNING *`,
    [indexType, month, value, source, sourceUrl || null, retrievedBy || null, verificationStatus]
  );
  const inserted = insertResult.rows[0];

  if (active) {
    await client.query(
      `UPDATE inflation_indices SET superseded_by = $1 WHERE id = $2`,
      [inserted.id, active.id]
    );
    return { action: "superseded", record: inserted, previous: active };
  }

  return { action: "inserted", record: inserted, previous: null };
}

/**
 * Bir supersede/insert olayı için audit_events tablosuna kayıt
 * düşer. Mevcut backend/routes/audit.js'teki INSERT deseniyle
 * birebir aynı sütunları kullanır.
 *
 * NOT: contract_id kasıtlı olarak NULL bırakılır — bu olaylar
 * belirli bir kontrata değil, genel endeks tablosuna aittir.
 * Bunun bir sonucu olarak (audit.js'teki JOIN nedeniyle) bu
 * kayıtlar GET /api/audit üzerinden HİÇBİR kullanıcıya
 * görünmeyecektir; bu bilinen bir sınırlamadır ve CHANGES.md'de
 * ayrıca raporlanmıştır.
 *
 * @param {object} client
 * @param {{ action: string, entityId: string, actor: string, oldValue: object|null, newValue: object, metadata: object }} event
 */
async function recordAuditEvent(client, event) {
  // audit_events.id VARCHAR(50): action adını ID'ye eklemek manuel/bulk
  // girişlerde 50 karakteri aşıyor ve tüm transaction'ı rollback ediyordu.
  // Action zaten ayrı kolonda tutulur; ID yalnızca kısa ve benzersiz olmalıdır.
  const id = `INFL-${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;

  await client.query(
    `INSERT INTO audit_events
       (id, actor, action, entity_type, entity_id, contract_id, old_value, new_value, metadata)
     VALUES ($1, $2, $3, 'INFLATION_INDEX', $4, NULL, $5, $6, $7)`,
    [
      id,
      event.actor,
      event.action,
      event.entityId,
      event.oldValue ? JSON.stringify(event.oldValue) : null,
      JSON.stringify(event.newValue),
      event.metadata ? JSON.stringify(event.metadata) : null
    ]
  );
}

/**
 * TÜİK'ten belirtilen ayları senkronize eder: çeker, normalize
 * eder, doğrular, DB'ye immutable şekilde yazar, audit event
 * üretir. Tek bir transaction içinde çalışır — kısmi bir
 * senkronizasyonun bazı ayları yazıp bazılarını yazmadan
 * yarıda kalması engellenir.
 *
 * @param {string[]} months - 'YYYY-MM' formatında istenen aylar.
 * @param {string} actor - işlemi tetikleyen kullanıcı (audit için).
 * @returns {Promise<{ synced: string[], unchanged: string[], skipped: Array<{month: string, reason: string}> }>}
 */
async function syncFromTuik(months, actor) {
  if (!Array.isArray(months) || months.length === 0) {
    throw new Error("months boş olamaz.");
  }

  const invalidMonths = months.filter(m => !/^\d{4}-(0[1-9]|1[0-2])$/.test(String(m)));
  if (invalidMonths.length > 0) {
    throw new Error(`Geçersiz ay formatı: ${invalidMonths.join(", ")} (YYYY-MM bekleniyor).`);
  }

  // fetchFromTuik ağ çağrısı içeriyor — transaction/DB bağlantısı
  // AÇILMADAN önce çağrılır ki, TÜİK'e erişilemezse bir DB
  // bağlantısı gereksiz yere açık/kilitli kalmasın.
  const rawRecords = await fetchFromTuik(months);

  const synced = [];
  const unchanged = [];
  const skipped = [];

  const requestedSet = new Set(months);
  const seenMonths = new Set();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const raw of rawRecords) {
      const normalized = normalizeTuikRecord(raw);
      if (!normalized) {
        skipped.push({ month: String(raw?.period), reason: "Normalize edilemedi (tanınmayan ay/değer formatı)." });
        continue;
      }

      if (!requestedSet.has(normalized.month)) {
        // fetchFromTuik zaten filtreliyor ama savunma amaçlı ikinci kontrol.
        continue;
      }

      seenMonths.add(normalized.month);

      const previousActive = await getActiveIndexRecord(INDEX_TYPE_TUFE_GENEL, normalized.month, client);
      const priorMonthActive = await getNearestPriorActiveRecord(INDEX_TYPE_TUFE_GENEL, normalized.month, client);

      const validation = validateInflationIndexEntry(
        { month: normalized.month, value: normalized.value },
        // Anomali/aralık kontrolü, AYNI ayın önceki versiyonuyla değil,
        // BİR ÖNCEKİ AYIN aktif değeriyle karşılaştırılmalı — amaç
        // "bu ay endeks gerçekçi bir sıçrama mı yaptı" sorusuna cevap
        // vermektir. Aynı ayın önceki versiyonuyla karşılaştırmak
        // (örn. TÜİK küçük bir revizyon yaptığında) yanlış pozitif
        // üretebilir/üretmeyebilir ama asıl amaçlanan anomaliyi
        // (yeni bir ayın trendden kopması) YAKALAMAZ.
        priorMonthActive ? Number(priorMonthActive.index_value) : null
      );

      if (!validation.valid) {
        skipped.push({ month: normalized.month, reason: validation.errors.join(" ") });
        continue;
      }

      const result = await upsertIndexRecord(client, {
        indexType: INDEX_TYPE_TUFE_GENEL,
        month: normalized.month,
        value: normalized.value,
        source: "TUIK_AUTO",
        sourceUrl: process.env.TUIK_INDEX_SOURCE_URL,
        retrievedBy: null,
        // TÜİK'ten otomatik gelen veri PENDING başlar — hesaplamaya
        // girebilmesi için ayrı bir doğrulama adımından (verified_at/
        // verified_by set edilmesinden) geçmesi gerekir. Bu, "TÜİK'ten
        // otomatik gelen her şey kör güvenle hesaplamaya girer" riskini
        // önler (Big4 perspektifi: kaynak otomatik olsa da doğrulama
        // adımı insan onayına bağlı kalır).
        verificationStatus: "PENDING"
      });

      if (result.action === "unchanged") {
        unchanged.push(normalized.month);
        continue;
      }

      await recordAuditEvent(client, {
        action: "INFLATION_INDEX_SYNCED",
        entityId: normalized.month,
        actor,
        oldValue: result.previous ? { month: normalized.month, index: Number(result.previous.index_value) } : null,
        newValue: { month: normalized.month, index: normalized.value, source: "TUIK_AUTO" },
        metadata: { indexType: INDEX_TYPE_TUFE_GENEL, action: result.action }
      });

      synced.push(normalized.month);
    }

    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {}
    throw error;
  } finally {
    client.release();
  }

  for (const month of months) {
    if (!seenMonths.has(month) && !skipped.some(s => s.month === month)) {
      skipped.push({ month, reason: "TÜİK kaynağında bu ay için veri bulunamadı." });
    }
  }

  return { synced, unchanged, skipped };
}

/**
 * Manuel override kaydı ekler (bkz. init.sql — source =
 * 'MANUAL_OVERRIDE'). syncFromTuik ile aynı immutable/supersede
 * mantığını, ayrı bir endpoint/route OLUŞTURMADAN, aynı tablo
 * üzerinden uygular. Tek bir kayıt için çalışır (bulk değil —
 * manuel override'ın dikkatli, tek tek yapılması beklenir).
 *
 * Override kaydı VERIFIED olarak işaretlenir: bir insan bilinçli
 * olarak bu değeri girdiği için ayrıca bir "doğrulama" adımına
 * gerek yoktur (TÜİK'ten otomatik gelen PENDING veriden farkı budur).
 *
 * TASARIM KARARI — ANOMALİ KONTROLÜ BURADA UYGULANMAZ: format/
 * pozitiflik kontrolü (validateInflationIndexEntry) zorunludur,
 * ancak "önceki aya göre beklenmeyen sıçrama" kontrolü (bkz.
 * syncFromTuik) burada BİLİNÇLİ OLARAK atlanır — override'ı yapan
 * zaten bir insan, gerçek bir endeks rebazlaması/düzeltmesi gibi
 * meşru ama büyük bir sıçramayı burada engellemek istenmiyor.
 * Otomatik TÜİK senkronizasyonunda ise aynı kontrol veri/parse
 * hatalarını yakalamak için ZORUNLUDUR (syncFromTuik'e bakınız).
 *
 * @param {{ month: string, value: number, actor: string }} input
 * @returns {Promise<{ action: string, record: object }>}
 */
async function overrideIndexValue({ month, value, actor }) {
  const validation = validateInflationIndexEntry({ month, value });
  if (!validation.valid) {
    const error = new Error(validation.errors.join(" "));
    error.code = "INVALID_INFLATION_INDEX_INPUT";
    throw error;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const previousActive = await getActiveIndexRecord(INDEX_TYPE_TUFE_GENEL, month, client);

    const result = await upsertIndexRecord(client, {
      indexType: INDEX_TYPE_TUFE_GENEL,
      month,
      value: Number(value),
      source: "MANUAL_OVERRIDE",
      sourceUrl: null,
      retrievedBy: actor,
      verificationStatus: "VERIFIED"
    });

    if (result.action !== "unchanged") {
      await client.query(
        `UPDATE inflation_indices SET verified_at = NOW(), verified_by = $1 WHERE id = $2`,
        [actor, result.record.id]
      );

      await recordAuditEvent(client, {
        action: "INFLATION_INDEX_OVERRIDDEN",
        entityId: month,
        actor,
        oldValue: result.previous ? { month, index: Number(result.previous.index_value) } : null,
        newValue: { month, index: Number(value), source: "MANUAL_OVERRIDE" },
        metadata: { indexType: INDEX_TYPE_TUFE_GENEL, action: result.action }
      });
    }

    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {}
    throw error;
  } finally {
    client.release();
  }
}

/**
 * ============================================================
 * ADMIN PANEL — MANUEL ENDEKS GİRİŞİ (PENDING → VERIFIED/REJECTED)
 * ============================================================
 *
 * TÜİK otomatik entegrasyonu bu release kapsamından çıkarıldığı için
 * (bkz. PROJECT_CONTEXT.md — TÜİK API artık release blocker değil),
 * admin, TÜİK'ten aldığı endeksleri Admin Panel üzerinden elle girer.
 *
 * TASARIM KARARI — overrideIndexValue()'DAN FARKI: yukarıdaki
 * overrideIndexValue() kasıtlı olarak manuel girişi doğrudan VERIFIED
 * yapıyordu ("bir insan zaten elle girdi, ek doğrulama gereksiz").
 * Bu fonksiyon AİLESİ (createManualIndexEntry / verifyIndexRecord /
 * rejectIndexRecord) ise BİLİNÇLİ OLARAK farklı bir akış izler: her
 * manuel giriş PENDING başlar ve yalnızca ayrı, yetkili bir
 * admin verify işleminden sonra VERIFIED olur — TÜİK'ten otomatik
 * gelen veriyle AYNI governance modeli. Bu, admin panelinden
 * beklenen açık talebe dayanır (bkz. PROJECT_CONTEXT.md — VERIFICATION
 * bölümü: "Yeni manuel kayıtlar otomatik olarak PENDING olmalı").
 * overrideIndexValue() hâlâ mevcut/test edilmiş durumda ama hiçbir
 * route tarafından çağrılmıyor; bu yeni akış onun yerine kullanılır.
 */

/**
 * Admin panelinden TEK bir manuel endeks kaydı oluşturur.
 * Her zaman PENDING olarak başlar — TFRS16 hesaplamasına girmesi için
 * ayrıca verifyIndexRecord() ile onaylanması gerekir.
 *
 * Anomali/aralık kontrolü BİLİNÇLİ OLARAK BURADA DA UYGULANMAZ (bkz.
 * overrideIndexValue üstündeki not) — ama PENDING başladığı için asıl
 * güvenlik ağı burada "insan zaten kontrol etti" değil, "ikinci bir
 * insan (verifier) VERIFIED yapmadan hesaplamaya giremez" prensibidir.
 *
 * @param {{ month: string, value: number, actor: string }} input
 * @returns {Promise<{ action: string, record: object, previous: object|null }>}
 */
async function createManualIndexEntry({ month, value, actor }) {
  const validation = validateInflationIndexEntry({ month, value });
  if (!validation.valid) {
    const error = new Error(validation.errors.join(" "));
    error.code = "INVALID_INFLATION_INDEX_INPUT";
    throw error;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const result = await upsertIndexRecord(client, {
      indexType: INDEX_TYPE_TUFE_GENEL,
      month,
      value: Number(value),
      source: "MANUAL_OVERRIDE",
      sourceUrl: null,
      retrievedBy: actor,
      verificationStatus: "PENDING"
    });

    if (result.action !== "unchanged") {
      await recordAuditEvent(client, {
        action: "INFLATION_INDEX_MANUAL_ENTRY_CREATED",
        entityId: month,
        actor,
        oldValue: result.previous ? { month, index: Number(result.previous.index_value) } : null,
        newValue: { month, index: Number(value), source: "MANUAL_OVERRIDE" },
        metadata: { indexType: INDEX_TYPE_TUFE_GENEL, action: result.action, verificationStatus: "PENDING" }
      });
    }

    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {}
    throw error;
  } finally {
    client.release();
  }
}

class BulkInputParseError extends Error {
  constructor(invalid, duplicateMonthsInInput) {
    super("Toplu girişte geçersiz satır(lar) ve/veya tekrar eden ay(lar) var.");
    this.name = "BulkInputParseError";
    this.code = "BULK_INPUT_PARSE_ERROR";
    this.invalid = invalid;
    this.duplicateMonthsInInput = duplicateMonthsInInput;
  }
}

/**
 * Admin panelindeki "toplu endeks girişi" textarea'sından gelen ham
 * metni ayrıştırır ve HER SATIRI kendi transaction'ı içinde
 * createManualIndexEntry ile aynı PENDING akışına yazar.
 *
 * TASARIM KARARI — TEK BİR BÜYÜK TRANSACTION DEĞİL, SATIR BAŞINA
 * TRANSACTION: syncFromTuik()'in aksine (orada kısmi bir
 * senkronizasyonun yarıda kalması istenmiyordu, çünkü TÜİK'ten gelen
 * veri tek bir tutarlı "anlık görüntü" olarak düşünülüyor), burada
 * kullanıcı onlarca satır yapıştırabilir ve bir satırdaki (ör. tek bir
 * yazım hatası) sorunun DİĞER GEÇERLİ SATIRLARIN hepsini iptal etmesi
 * kullanıcı deneyimi açısından kötü olur. Bunun yerine: format/değer
 * olarak geçersiz satırlar hiç DB'ye yazılmadan (parseBulkIndexInput
 * aşamasında) elenir; aynı ay birden fazla kez geçiyorsa bu da baştan
 * reddedilir (hangi satırın "doğru" olduğu belirsiz olduğu için) —
 * yalnızca temiz, tekil kalan satırlar tek tek yazılır.
 *
 * @param {string} rawText
 * @param {string} actor
 * @returns {Promise<{ created: Array<{month:string, action:string}>, skipped: Array<{line:number, month?:string, reason:string}> }>}
 */
async function createBulkManualIndexEntries(rawText, actor) {
  const parsed = parseBulkIndexInput(rawText);

  if (parsed.invalid.length > 0 || parsed.duplicateMonthsInInput.length > 0) {
    throw new BulkInputParseError(parsed.invalid, parsed.duplicateMonthsInInput);
  }

  const created = [];
  const skipped = [];

  for (const entry of parsed.valid) {
    try {
      const result = await createManualIndexEntry({ month: entry.month, value: entry.value, actor });
      if (result.action === "unchanged") {
        skipped.push({ line: entry.line, month: entry.month, reason: "Mevcut aktif kayıtla aynı değer — değişiklik yapılmadı." });
      } else {
        created.push({ month: entry.month, action: result.action });
      }
    } catch (error) {
      skipped.push({ line: entry.line, month: entry.month, reason: error.message });
    }
  }

  return { created, skipped };
}

/**
 * PENDING durumundaki bir kaydı VERIFIED yapar. Yalnızca hâlâ AKTİF
 * (superseded_by IS NULL) ve PENDING durumundaki bir kayıt
 * doğrulanabilir — zaten VERIFIED/REJECTED olan veya supersede
 * edilmiş (artık aktif olmayan) bir kayıt için açık bir hata döner
 * (sessizce no-op yapmaz).
 *
 * @param {{ id: number|string, actor: string }} input
 * @returns {Promise<object>} güncellenmiş kayıt
 */
async function verifyIndexRecord({ id, actor }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const current = await client.query(
      `SELECT * FROM inflation_indices WHERE id = $1 FOR UPDATE`,
      [id]
    );
    const record = current.rows[0];

    if (!record) {
      const error = new Error(`Endeks kaydı bulunamadı: ${id}`);
      error.code = "INFLATION_INDEX_NOT_FOUND";
      throw error;
    }
    if (record.superseded_by !== null) {
      const error = new Error("Bu kayıt artık aktif değil (supersede edilmiş), doğrulanamaz.");
      error.code = "INFLATION_INDEX_NOT_ACTIVE";
      throw error;
    }
    if (record.verification_status !== "PENDING") {
      const error = new Error(`Yalnızca PENDING kayıtlar doğrulanabilir (mevcut durum: ${record.verification_status}).`);
      error.code = "INFLATION_INDEX_NOT_PENDING";
      throw error;
    }

    const updated = await client.query(
      `UPDATE inflation_indices
       SET verification_status = 'VERIFIED', verified_at = NOW(), verified_by = $1
       WHERE id = $2
       RETURNING *`,
      [actor, id]
    );

    await recordAuditEvent(client, {
      action: "INFLATION_INDEX_VERIFIED",
      entityId: record.index_month,
      actor,
      oldValue: { month: record.index_month, verificationStatus: "PENDING" },
      newValue: { month: record.index_month, verificationStatus: "VERIFIED", index: Number(record.index_value) },
      metadata: { indexType: record.index_type, recordId: String(id) }
    });

    await client.query("COMMIT");
    return updated.rows[0];
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {}
    throw error;
  } finally {
    client.release();
  }
}

/**
 * PENDING durumundaki bir kaydı REJECTED yapar. verifyIndexRecord ile
 * aynı ön koşulları uygular (yalnızca aktif + PENDING kayıt).
 * REJECTED bir kayıt superseded_by IS NULL kalmaya devam eder (yani
 * "aktif" sayılır) ama TFRS16 API'si zaten yalnızca VERIFIED filtresi
 * uyguladığı için hesaplamaya giremez (bkz. GET /api/inflation-indices).
 *
 * @param {{ id: number|string, actor: string, reason: string }} input
 * @returns {Promise<object>} güncellenmiş kayıt
 */
async function rejectIndexRecord({ id, actor, reason }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const current = await client.query(
      `SELECT * FROM inflation_indices WHERE id = $1 FOR UPDATE`,
      [id]
    );
    const record = current.rows[0];

    if (!record) {
      const error = new Error(`Endeks kaydı bulunamadı: ${id}`);
      error.code = "INFLATION_INDEX_NOT_FOUND";
      throw error;
    }
    if (record.superseded_by !== null) {
      const error = new Error("Bu kayıt artık aktif değil (supersede edilmiş), reddedilemez.");
      error.code = "INFLATION_INDEX_NOT_ACTIVE";
      throw error;
    }
    if (record.verification_status !== "PENDING") {
      const error = new Error(`Yalnızca PENDING kayıtlar reddedilebilir (mevcut durum: ${record.verification_status}).`);
      error.code = "INFLATION_INDEX_NOT_PENDING";
      throw error;
    }

    const updated = await client.query(
      `UPDATE inflation_indices
       SET verification_status = 'REJECTED', verified_at = NOW(), verified_by = $1
       WHERE id = $2
       RETURNING *`,
      [actor, id]
    );

    await recordAuditEvent(client, {
      action: "INFLATION_INDEX_REJECTED",
      entityId: record.index_month,
      actor,
      oldValue: { month: record.index_month, verificationStatus: "PENDING" },
      newValue: { month: record.index_month, verificationStatus: "REJECTED", index: Number(record.index_value) },
      metadata: { indexType: record.index_type, recordId: String(id), reason: reason || null }
    });

    await client.query("COMMIT");
    return updated.rows[0];
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {}
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Admin panelindeki liste ekranı için endeks kayıtlarını getirir.
 * GET /api/inflation-indices'in aksine (TFRS16 tüketimi için sadece
 * VERIFIED+aktif), bu fonksiyon admin görünürlüğü için TÜM statüleri
 * ve (varsayılan olarak) supersede edilmiş geçmiş kayıtları da
 * döndürebilir — audit/izlenebilirlik amacıyla.
 *
 * @param {{ status?: string, months?: string[], includeSuperseded?: boolean, limit?: number }} filters
 * @returns {Promise<object[]>}
 */
async function listIndexRecords(filters = {}) {
  const { status, months, includeSuperseded = false, limit = 200 } = filters;

  const conditions = ["index_type = $1"];
  const params = [INDEX_TYPE_TUFE_GENEL];

  if (!includeSuperseded) {
    conditions.push("superseded_by IS NULL");
  }
  if (status) {
    params.push(status);
    conditions.push(`verification_status = $${params.length}`);
  }
  if (Array.isArray(months) && months.length > 0) {
    params.push(months);
    conditions.push(`index_month = ANY($${params.length})`);
  }

  params.push(Math.min(Number(limit) || 200, 1000));

  const result = await pool.query(
    `SELECT * FROM inflation_indices
     WHERE ${conditions.join(" AND ")}
     ORDER BY index_month DESC, created_at DESC
     LIMIT $${params.length}`,
    params
  );

  return result.rows;
}

module.exports = {
  INDEX_TYPE_TUFE_GENEL,
  TuikSourceNotConfiguredError,
  TuikSourceUnreachableError,
  TuikResponseShapeError,
  BulkInputParseError,
  normalizeMonthLabel,
  normalizeTuikRecord,
  fetchFromTuik,
  getActiveIndexRecord,
  getNearestPriorActiveRecord,
  upsertIndexRecord,
  syncFromTuik,
  overrideIndexValue,
  createManualIndexEntry,
  createBulkManualIndexEntries,
  verifyIndexRecord,
  rejectIndexRecord,
  listIndexRecords
};
