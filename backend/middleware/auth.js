const { verifyUserToken } = require("../utils/jwt");

/**
 * Authorization: Bearer <token> başlığını doğrular ve req.user'a
 * { id, username, role, companyIds } koyar.
 *
 * ÖNEMLİ (KVKK): companyIds token içinden gelir — client'ın body/query
 * içinde gönderdiği hiçbir company_id/companyIds değerine GÜVENİLMEZ.
 * Route'lar, hangi şirketlere erişileceğine karar verirken daima
 * req.user.companyIds'i kullanmalıdır.
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
      companyIds: Array.isArray(payload.companyIds) ? payload.companyIds.map(String) : []
    };
    if (req.user.companyIds.length === 0) {
      // Hiçbir şirkete atanmamış kullanıcı — hiçbir kontrata erişemez.
      // Sessizce boş sonuç dönmek yerine burada engellemiyoruz;
      // route'lardaki company_id = ANY([]) filtresi zaten hiçbir satır
      // döndürmeyecektir. İstenirse burada 403 da verilebilir.
    }
    return next();
  } catch (error) {
    return res.status(401).json({ error: "Geçersiz veya süresi dolmuş token" });
  }
}

module.exports = { requireAuth };
