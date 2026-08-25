const express = require("express");

const { requireAuth } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/admin");
const { requireActiveLicense } = require("../middleware/license");
const { createRateLimiter } = require("../middleware/rate-limit");

const pool = require("../db/pool");
const {
  INDEX_TYPE_TUFE_GENEL,
  syncFromTuik,
  TuikSourceNotConfiguredError,
  TuikSourceUnreachableError,
  TuikResponseShapeError
} = require("../services/tuik-index-service");

const router = express.Router();

/**
 * ============================================================
 * INFLATION INDICES API
 * ============================================================
 *
 * KAPSAM — ÖNEMLİ: Bu, bağımsız bir "/api/tms29" ürünü DEĞİLDİR.
 * Bu router, yalnızca TFRS 16 modülünün js/tfrs16.js içindeki
 * mevcut TMS 29 restatement motoruna (getInflationIndex vb. —
 * bu router'dan tamamen habersiz, davranışı değişmeyen
 * fonksiyonlar) veri sağlayan bir yardımcı veri kaynağıdır.
 *
 * ENTITLEMENT: Aşağıda YENİ bir "tms29" lisans/entitlement türü
 * TANIMLANMADI. GET endpoint'i, mevcut requireActiveLicense
 * middleware'i ile korunur — kullanıcının bağlı olduğu
 * şirketlerden en az birinin aktif (herhangi bir plan) lisansı
 * olması yeterlidir; bu, license-test.js'teki
 * GET /api/license-test/active ile birebir aynı kontrol.
 */

router.use(requireAuth);

/**
 * ------------------------------------------------------------
 * RATE LIMITING
 * ------------------------------------------------------------
 *
 * GET endpoint'i normal kullanım seviyesinde bir limitle korunur
 * (contract/panel açılışında tetiklenecek, sık ama makul bir
 * çağrı). POST /sync ise admin-only ve çok daha sıkı bir limitle
 * korunur — TÜİK'e karşı istenmeyen bir istek fırtınasını (ve
 * DB'de gereksiz supersede zincirlerini) önlemek için.
 */
const readRateLimiter = createRateLimiter({
  windowMs: Number(process.env.INFLATION_INDEX_READ_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.INFLATION_INDEX_READ_RATE_LIMIT_MAX) || 300,
  keyGenerator: req => `inflation-index-read:${req.ip}`,
  message: "Endeks verisi için çok fazla istek gönderildi. Lütfen daha sonra tekrar deneyin."
});

const syncRateLimiter = createRateLimiter({
  windowMs: Number(process.env.INFLATION_INDEX_SYNC_RATE_LIMIT_WINDOW_MS) || 60 * 60 * 1000,
  max: Number(process.env.INFLATION_INDEX_SYNC_RATE_LIMIT_MAX) || 5,
  keyGenerator: req => `inflation-index-sync:${req.ip}`,
  message: "TÜİK senkronizasyonu için çok fazla istek gönderildi. Lütfen daha sonra tekrar deneyin."
});

const MONTH_FORMAT = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * 'months' query param'ını ('2025-01,2025-02' gibi) doğrular ve
 * diziye çevirir. Geçersiz bir ay formatı varsa null döner —
 * çağıran taraf bunu 400 olarak ele alır (sessizce filtrelemez).
 *
 * @param {string} raw
 * @returns {string[]|null}
 */
function parseMonthsParam(raw) {
  const parts = String(raw || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return null;
  }

  if (parts.some(p => !MONTH_FORMAT.test(p))) {
    return null;
  }

  return parts;
}

/**
 * months verilmediğinde kullanılan makul varsayılan aralık:
 * içinde bulunulan aydan geriye 36 ay. TFRS 16 kontratlarının
 * çoğu bu aralıkta bir restatement ihtiyacı doğurur; daha uzun
 * bir varsayılan, gereksiz yere büyük bir sonuç kümesi döner.
 *
 * @returns {string[]}
 */
function defaultMonthsRange() {
  const months = [];
  const now = new Date();
  for (let i = 0; i < 36; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

/**
 * ============================================================
 * GET /api/inflation-indices
 * ============================================================
 *
 * ?months=2025-01,2025-02,2025-03  (opsiyonel)
 *
 * Yalnızca VERIFIED ve aktif (superseded_by IS NULL) kayıtları
 * döner — PENDING/REJECTED kayıtlar hiçbir koşulda bu endpoint'ten
 * dönmez (TFRS 16 hesaplamasına yalnızca doğrulanmış veri
 * girmelidir, bkz. tuik-index-service.js).
 *
 * Yanıt şekli, frontend'in mevcut { month, index } sözleşmesine
 * doğrudan map edilebilecek şekilde tasarlandı.
 */
router.get(
  "/",
  readRateLimiter,
  requireActiveLicense,
  async (req, res) => {
    try {
      const months = req.query.months
        ? parseMonthsParam(req.query.months)
        : defaultMonthsRange();

      if (months === null) {
        return res.status(400).json({
          error: "Geçersiz months parametresi (YYYY-MM, virgülle ayrılmış liste bekleniyor).",
          code: "INVALID_MONTHS_PARAM"
        });
      }

      const result = await pool.query(
        `SELECT index_month, index_value, source, source_url, retrieved_at, verification_status
         FROM inflation_indices
         WHERE index_type = $1
           AND superseded_by IS NULL
           AND verification_status = 'VERIFIED'
           AND index_month = ANY($2)
         ORDER BY index_month ASC`,
        [INDEX_TYPE_TUFE_GENEL, months]
      );

      const indices = result.rows.map(row => ({
        month: row.index_month,
        index: Number(row.index_value),
        source: row.source,
        sourceUrl: row.source_url,
        retrievedAt: row.retrieved_at,
        verificationStatus: row.verification_status
      }));

      return res.json({ indices });
    } catch (error) {
      console.error("GET /api/inflation-indices hatası:", error);
      return res.status(500).json({
        error: "Endeks verisi alınırken beklenmeyen bir hata oluştu."
      });
    }
  }
);

/**
 * ============================================================
 * POST /api/inflation-indices/sync
 * ============================================================
 *
 * ADMIN-ONLY. Public değildir, kullanıcı arayüzünden
 * tetiklenmez — TÜİK'ten belirtilen ayları senkronize eder.
 *
 * Body: { months: ["2025-01", "2025-02"] }
 *
 * TÜİK kaynağı yapılandırılmamışsa veya erişilemezse, bu
 * endpoint AÇIK bir hata döner — sessizce "başarılı" görünüp
 * hiçbir şey yazmaz (bkz. tuik-index-service.js dosya başı notu).
 */
router.post(
  "/sync",
  syncRateLimiter,
  requireAdmin,
  async (req, res) => {
    try {
      const months = Array.isArray(req.body?.months)
        ? req.body.months.map(String)
        : null;

      if (!months || months.length === 0) {
        return res.status(400).json({
          error: "months (dizi) zorunludur.",
          code: "MONTHS_REQUIRED"
        });
      }

      if (months.some(m => !MONTH_FORMAT.test(m))) {
        return res.status(400).json({
          error: "Geçersiz ay formatı (YYYY-MM bekleniyor).",
          code: "INVALID_MONTHS_PARAM"
        });
      }

      const actor = req.user.username || req.user.id || "system";
      const result = await syncFromTuik(months, actor);

      return res.json({
        message: "TÜİK senkronizasyonu tamamlandı.",
        ...result
      });
    } catch (error) {
      if (error instanceof TuikSourceNotConfiguredError) {
        return res.status(503).json({
          error: error.message,
          code: error.code
        });
      }
      if (error instanceof TuikSourceUnreachableError) {
        return res.status(502).json({
          error: error.message,
          code: error.code
        });
      }
      if (error instanceof TuikResponseShapeError) {
        return res.status(502).json({
          error: error.message,
          code: error.code
        });
      }

      console.error("POST /api/inflation-indices/sync hatası:", error);
      return res.status(500).json({
        error: "TÜİK senkronizasyonu sırasında beklenmeyen bir hata oluştu."
      });
    }
  }
);

module.exports = router;
