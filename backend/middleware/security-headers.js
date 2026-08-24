/**
 * ============================================================
 * SECURITY HEADERS MIDDLEWARE
 * ============================================================
 *
 * Bu backend yalnızca JSON döndüren bir API'dir (HTML render
 * etmez). Bu yüzden CSP kasıtlı olarak sıkı tutulmuştur:
 * `default-src 'none'` — hiçbir kaynağın yüklenmesine gerek
 * yoktur.
 *
 * Harici bir paket (örn. helmet) eklemeden, minimum ve
 * denetlenebilir bir header seti burada elle uygulanır.
 *
 * NOT: Strict-Transport-Security yalnızca HTTPS üzerinden
 * gelen (veya production'da terminasyonu yapan proxy'nin
 * X-Forwarded-Proto: https ile işaretlediği) isteklerde
 * eklenir; aksi halde düz HTTP üzerinden yayınlanan bir HSTS
 * header'ı anlamsızdır.
 */

function securityHeaders(req, res, next) {

  // MIME sniffing engellenir.
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Bu API'nin herhangi bir iframe içine gömülmesi engellenir
  // (clickjacking koruması).
  res.setHeader("X-Frame-Options", "DENY");

  // Referrer bilgisi cross-origin isteklerde sızdırılmaz.
  res.setHeader("Referrer-Policy", "no-referrer");

  // API bir JSON servisidir; herhangi bir aktif içerik
  // yüklenmesine gerek yoktur.
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'none'; frame-ancestors 'none'"
  );

  // Tarayıcı özelliklerine (kamera, konum, mikrofon vb.)
  // erişim kapatılır.
  res.setHeader(
    "Permissions-Policy",
    "geolocation=(), camera=(), microphone=()"
  );

  // Eski IE XSS filtresi devre dışı bırakılır (modern
  // tarayıcılarda gereksiz ve bazı senaryolarda zararlı
  // olabiliyor; CSP zaten asıl korumayı sağlıyor).
  res.setHeader("X-XSS-Protection", "0");

  const isHttps =
    req.secure ||
    req.headers["x-forwarded-proto"] === "https";

  if (process.env.NODE_ENV === "production" && isHttps) {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload"
    );
  }

  next();
}

module.exports = { securityHeaders };
