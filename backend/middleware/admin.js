const { requireAuth } = require("./auth");
const { resolveAccessScope } = require("../services/organization-service");

/**
 * ============================================================
 * ADMIN AUTHORIZATION MIDDLEWARE
 * ============================================================
 *
 * Kullanıcının authentication işlemi requireAuth tarafından
 * yapılır.
 *
 * Bu middleware ise kullanıcının ADMIN rolüne sahip olup
 * olmadığını kontrol eder.
 *
 * ------------------------------------------------------------
 * TASARIM KARARI — ADMIN ROLÜNÜN KAPSAMI (PLATFORM-LEVEL)
 * ------------------------------------------------------------
 *
 * Bu projede ADMIN rolü, bilinçli bir tasarım kararı olarak
 * PLATFORM seviyesinde (global) bir yönetici olarak kabul
 * edilir — belirli bir şirkete bağlı bir "company admin" DEĞİLDİR.
 *
 * Bunun somut anlamı:
 *
 *   - requireAdmin ile korunan tüm endpoint'ler (bkz.
 *     routes/admin-licenses.js) ADMIN rolüne sahip herhangi bir
 *     kullanıcının SİSTEMDEKİ TÜM ŞİRKETLERİ görebilmesine,
 *     tüm şirketler için lisans oluşturabilmesine, mevcut
 *     lisansları uzatabilmesine (extend) ve iptal edebilmesine
 *     (cancel) izin verir.
 *   - Bu endpoint'lerde req.user.companyIds (JWT'den gelen,
 *     kullanıcının bağlı olduğu şirket listesi) İLE HERHANGİ BİR
 *     KARŞILAŞTIRMA YAPILMAZ; ADMIN kontrolü sadece req.user.role
 *     === "ADMIN" olup olmadığına bakar.
 *
 * Bu, örneğin routes/auth.js içindeki POST /register endpoint'inin
 * davranışından FARKLIDIR: orada ADMIN, sadece kendi
 * req.user.companyIds listesindeki şirketlere kullanıcı
 * ekleyebilir (şirket bazlı bir kısıtlama vardır). Bu fark
 * kasıtlıdır ve iki farklı endpoint ailesinin farklı tehdit
 * modellerine hizmet ettiğini yansıtır: kullanıcı oluşturma
 * (register) günlük operasyonel bir işlemdir ve şirket bazlı
 * sınırlandırılmıştır; lisans yönetimi (admin-licenses.js) ise
 * platformu işleten (Anthropic/şirket içi) operasyon ekibinin
 * kullanacağı, tüm kiracıları (tenant) kapsayan bir yönetim
 * arayüzüdür.
 *
 * Şirket bazlı ("company admin" — yalnızca kendi şirketinin
 * lisansını görebilen/yönetebilen) ayrı bir rol bu aşamada
 * KASITLI OLARAK oluşturulmamıştır. İleride böyle bir rol
 * eklenmek istenirse:
 *
 *   1. Yeni bir rol (ör. "COMPANY_ADMIN") ve/veya requireAdmin'e
 *      ek bir "scope" parametresi tanımlanmalı,
 *   2. routes/admin-licenses.js içindeki tüm sorgular
 *      companyId bazlı bir yetki kontrolünden geçirilmeli
 *      (auth.js/register'daki adminCompanyIds mantığına benzer
 *      şekilde),
 *   3. Bu dosyadaki doc-comment güncellenmeli.
 *
 * Bu değişiklik yapılana kadar ADMIN = platform-level admin
 * varsayımı geçerlidir ve testler (bkz. test/) bu varsayıma göre
 * yazılmıştır.
 */

function requireAdmin(req, res, next) {
  /**
   * Önce JWT authentication.
   */
  requireAuth(req, res, () => {

    /**
     * Role kontrolü.
     */
    if (!req.user || req.user.role !== "ADMIN") {
      return res.status(403).json({
        error:
          "Bu işlem için ADMIN yetkisi gereklidir",
        code:
          "ADMIN_REQUIRED"
      });
    }

    next();
  });
}

/**
 * ============================================================
 * STAFF ACCESS MIDDLEWARE (P1)
 * ============================================================
 *
 * requireAdmin'in aksine, bu middleware ADMIN'in yanı sıra
 * ACCOUNTANT_MANAGER rolüne de izin verir — P1-B kapsamında
 * ACCOUNTANT_MANAGER artık kendi holding ağacında kullanıcı/şirket
 * yönetebilmelidir (bkz. db/init.sql P0 yorumu: "bir
 * ACCOUNTANT_MANAGER'ın kendi ağacında alt şirket oluşturabilmesi").
 *
 * requireAdmin'den farklı olarak req.accessScope'u da hesaplayıp
 * request'e ekler — route'lar bunu kullanarak sonuçları/işlemleri
 * kendi ağaçlarıyla sınırlar (services/organization-service.js:
 * resolveAccessScope/isCompanyInScope).
 *
 * ADMIN için req.accessScope.isGlobalAdmin=true olur (kısıtlama
 * yok) — requireAdmin ile korunan platform-level endpoint'lerin
 * (licenses, audit, dashboard, vb.) davranışı bu middleware'den
 * ETKİLENMEZ, onlar hâlâ requireAdmin kullanır.
 */

function requireStaffAccess(req, res, next) {
  requireAuth(req, res, async () => {

    if (
      !req.user ||
      !["ADMIN", "ACCOUNTANT_MANAGER"].includes(req.user.role)
    ) {
      return res.status(403).json({
        error:
          "Bu işlem için ADMIN veya ACCOUNTANT_MANAGER yetkisi gereklidir",
        code:
          "STAFF_ACCESS_REQUIRED"
      });
    }

    try {

      req.accessScope = await resolveAccessScope(req.user);

      return next();

    } catch (error) {

      console.error(
        "requireStaffAccess erişim kapsamı hesaplama hatası:",
        error
      );

      return res.status(500).json({
        error:
          "Yetki kapsamı hesaplanırken beklenmeyen bir hata oluştu"
      });

    }

  });
}

module.exports = {
  requireAdmin,
  requireStaffAccess
};
