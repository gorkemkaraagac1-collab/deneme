const { verifyUserToken } = require("../utils/jwt");

/**
 * P1-D — MUST CHANGE PASSWORD
 *
 * mustChangePassword=true olan bir kullanıcı, normal uygulama
 * erişimi elde ETMEDEN önce parolasını değiştirmek zorundadır.
 * Bu, requireAuth'un KENDİSİNE gömülüdür (her router'a ayrı ayrı
 * eklenecek bir middleware yerine) — böylece admin.js/contracts.js/
 * audit.js/reports.js/... gibi requireAuth kullanan HİÇBİR mevcut
 * route dosyası değiştirilmeden, tüm korumalı endpoint'ler otomatik
 * olarak kapsanır (madde 6: "mevcut çalışan sistemi koru").
 *
 * Yalnızca aşağıdaki iki endpoint istisnadır (yalnızca parola
 * değiştirme akışını tamamlamak için gereken minimum authenticated
 * context — bkz. onaylı plan P1-D madde 6):
 *   - POST /api/auth/change-password  (parolayı değiştirir)
 *   - GET  /api/auth/me                (frontend'in mustChangePassword
 *                                        durumunu görüp kullanıcıyı
 *                                        doğru ekrana yönlendirmesi için)
 *
 * req.originalUrl kullanılır çünkü bu kontrol router mount noktasından
 * (app.js: app.use('/api/auth', ...)) BAĞIMSIZ, middleware seviyesinde
 * çalışır; router içi req.path burada güvenilir olmayabilir.
 */
const MUST_CHANGE_PASSWORD_EXEMPT_ROUTES = [
  { method: "POST", path: "/api/auth/change-password" },
  { method: "GET", path: "/api/auth/me" }
];

function isMustChangePasswordExempt(req) {
  const path = String(req.originalUrl || req.url || "").split("?")[0];

  return MUST_CHANGE_PASSWORD_EXEMPT_ROUTES.some(
    route => route.method === req.method && route.path === path
  );
}

/**
 * Authorization: Bearer <token> başlığını doğrular ve req.user'a
 * { id, username, role, companyIds, mustChangePassword } koyar.
 *
 * ÖNEMLİ (KVKK): companyIds token içinden gelir — client'ın body/query
 * içinde gönderdiği hiçbir company_id/companyIds değerine GÜVENİLMEZ.
 * Route'lar, hangi şirketlere erişileceğine karar verirken daima
 * req.user.companyIds'i (veya P1'den itibaren, ACCOUNTANT_MANAGER/ADMIN
 * için services/organization-service.js'in hesapladığı erişim
 * kapsamını) kullanmalıdır.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Authorization header eksik veya hatalı (Bearer <token> bekleniyor)" });
  }

  try {
    const payload = verifyUserToken(token);
    req.user = {
      id: payload.sub,
      username: payload.username,
      role: payload.role,
      companyIds: Array.isArray(payload.companyIds) ? payload.companyIds.map(String) : [],
      mustChangePassword: Boolean(payload.mustChangePassword)
    };
    if (req.user.companyIds.length === 0) {
      // Hiçbir şirkete atanmamış kullanıcı — hiçbir kontrata erişemez.
      // Sessizce boş sonuç dönmek yerine burada engellemiyoruz;
      // route'lardaki company_id = ANY([]) filtresi zaten hiçbir satır
      // döndürmeyecektir. İstenirse burada 403 da verilebilir.
    }

    if (req.user.mustChangePassword && !isMustChangePasswordExempt(req)) {
      return res.status(403).json({
        error: "Parolanızı değiştirmeden uygulamayı kullanamazsınız",
        code: "MUST_CHANGE_PASSWORD"
      });
    }

    return next();
  } catch (error) {
    return res.status(401).json({ error: "Geçersiz veya süresi dolmuş token" });
  }
}

module.exports = { requireAuth, isMustChangePasswordExempt };
