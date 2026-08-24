/**
 * ============================================================
 * RATE LIMITING / ABUSE PROTECTION
 * ============================================================
 *
 * Basit, bellek içi (in-memory), sabit pencereli (fixed-window)
 * bir rate limiter. Harici bir paket gerektirmez.
 *
 * SINIRLAMA (bilerek belgeleniyor):
 * Bu limiter tek bir Node.js process'inin belleğinde tutulur.
 * Uygulama birden fazla instance ile (örn. birden fazla
 * container/pod) yatay olarak ölçeklenirse, her instance kendi
 * sayaçlarını tutar ve limit instance başına uygulanır (toplamda
 * daha gevşek bir sınır anlamına gelir). Çoklu instance
 * dağıtımında paylaşımlı bir store (örn. Redis) kullanılması
 * önerilir. Tek instance / düşük-orta trafik için bu yaklaşım
 * yeterli bir ilk savunma hattıdır.
 *
 * Test ortamında (NODE_ENV=test) devre dışı bırakılır; aksi
 * halde aynı test dosyası içinde art arda atılan istekler
 * (örn. kullanıcı limiti testleri) rate limit'e takılıp yanlışlıkla
 * başarısız olabilir. Bu, üretim güvenliğini etkilemez — test ve
 * production birbirinden ayrı ortamlardır.
 */

function createRateLimiter({
  windowMs,
  max,
  keyGenerator,
  message
} = {}) {

  const resolvedWindowMs = windowMs || 15 * 60 * 1000;
  const resolvedMax = max || 100;

  // key -> { count, resetAt }
  const hits = new Map();

  // Bellek büyümesini sınırlamak için süresi dolmuş kayıtları
  // periyodik olarak temizle. Test ortamında zamanlayıcı process'i
  // canlı tutmasın diye unref() çağrılır.
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits.entries()) {
      if (entry.resetAt <= now) {
        hits.delete(key);
      }
    }
  }, resolvedWindowMs).unref();

  return function rateLimitMiddleware(req, res, next) {

    if (process.env.NODE_ENV === "test") {
      return next();
    }

    const key =
      (keyGenerator ? keyGenerator(req) : req.ip) || "unknown";

    const now = Date.now();

    let entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      entry = {
        count: 0,
        resetAt: now + resolvedWindowMs
      };
      hits.set(key, entry);
    }

    entry.count += 1;

    if (entry.count > resolvedMax) {

      const retryAfterSeconds =
        Math.ceil((entry.resetAt - now) / 1000);

      res.setHeader("Retry-After", String(retryAfterSeconds));

      return res.status(429).json({
        error:
          message ||
          "Çok fazla istek gönderildi. Lütfen daha sonra tekrar deneyin.",
        code: "RATE_LIMIT_EXCEEDED"
      });
    }

    return next();
  };
}

module.exports = { createRateLimiter };
