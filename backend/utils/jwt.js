const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET;
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";

if (!SECRET) {
  // Sunucu, gizli anahtar olmadan ASLA ayağa kalkmamalı — yoksa
  // token'lar tahmin edilebilir/sahte üretilebilir hale gelir.
  throw new Error(
    "JWT_SECRET tanımlı değil. backend/.env dosyasına güçlü, rastgele " +
    "bir JWT_SECRET ekleyin (örn: `openssl rand -hex 32` ile üretin)."
  );
}

/**
 * Bir kullanıcı için imzalı JWT üretir. Token'a yalnızca yetkilendirme
 * için gereken minimum bilgi konur — parola hash'i asla token'a
 * girmez.
 * @param {{id:string, username:string, role:string, companyIds:string[]}} user
 * @returns {string}
 */
function signUserToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      role: user.role,
      companyIds: user.companyIds || []
    },
    SECRET,
    { expiresIn: EXPIRES_IN }
  );
}

/**
 * Token'ı doğrular ve payload'ı döndürür. Geçersiz/süresi dolmuş
 * token için hata fırlatır.
 * @param {string} token
 */
function verifyUserToken(token) {
  return jwt.verify(token, SECRET);
}

module.exports = { signUserToken, verifyUserToken };
