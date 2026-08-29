const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET;
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";

// Yalnızca simetrik HS256 imzalarına izin verilir. jwt.verify()'a
// algorithms listesi verilmezse, kütüphane token header'ındaki
// "alg" alanına güvenerek doğrulama yapabilir; bu da algorithm
// confusion saldırılarına (ör. "none" veya beklenmeyen bir
// algoritmayla üretilmiş sahte token) karşı gereksiz bir yüzey
// açar. Açık bir allowlist bu riski tamamen ortadan kaldırır.
const ALLOWED_ALGORITHMS = ["HS256"];

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
 *
 * P1-A: JWT'ye organizasyon/holding ağacının TAMAMI gömülmez (bkz.
 * services/organization-service.js — ağaç erişimi ihtiyaç anında
 * DB'den hesaplanır). Token'da yalnızca minimum gerekli context
 * tutulur: userId, role, companyIds (kullanıcının DOĞRUDAN bağlı
 * olduğu şirket(ler) — ACCOUNTANT_MANAGER için "primary company
 * context", ağaç bu id(ler)den yukarı ÇIKILMADAN aşağı doğru
 * hesaplanır) ve mustChangePassword (P1-D — normal uygulama
 * erişimini DB'ye her istekte gitmeden engelleyebilmek için token'a
 * konan tek ek, küçük bir bayrak).
 *
 * STALE TOKEN NOTU: mustChangePassword token'a login/parola
 * değişikliği ANINDA yazılan bir STOKTUR — sonradan (ör. admin bir
 * kullanıcının parolasını sıfırlayıp must_change_password'ü tekrar
 * TRUE yaparsa) DB'deki değer değişse bile, o kullanıcının o anda
 * elindeki ESKİ token süresi dolana kadar (JWT_EXPIRES_IN, varsayılan
 * 8s) eski (stale) bayrağı taşımaya devam eder. Bu, kısa token
 * ömrüyle sınırlı, bilinçli bir tasarım tercihidir (token
 * iptali/blacklist altyapısı bu projede yok); admin tarafından
 * parola sıfırlanan bir kullanıcı için ekstra güvence isteniyorsa
 * (ör. oturumu anında sonlandırma) bu P1 kapsamının dışındadır.
 * @param {{id:string, username:string, role:string, companyIds:string[], mustChangePassword?:boolean}} user
 * @returns {string}
 */
function signUserToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      role: user.role,
      companyIds: user.companyIds || [],
      mustChangePassword: Boolean(user.mustChangePassword)
    },
    SECRET,
    { expiresIn: EXPIRES_IN, algorithm: ALLOWED_ALGORITHMS[0] }
  );
}

/**
 * Token'ı doğrular ve payload'ı döndürür. Geçersiz/süresi dolmuş
 * token için hata fırlatır.
 * @param {string} token
 */
function verifyUserToken(token) {
  return jwt.verify(token, SECRET, { algorithms: ALLOWED_ALGORITHMS });
}

module.exports = { signUserToken, verifyUserToken };
