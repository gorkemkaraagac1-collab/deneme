const { requireAuth } = require("./auth");

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

module.exports = {
  requireAdmin
};
