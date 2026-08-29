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
      // P4 KRİTİK DÜZELTME: bu alan önceden burada HİÇ
      // yazılmıyordu — routes/auth.js (login ve change-password)
      // signUserToken()'ı her zaman { ..., mustChangePassword }
      // ile çağırıyordu ve bunun token'a gireceğini varsayıyordu
      // (bkz. o dosyadaki P1-D yorumu), ama bu fonksiyon yalnızca
      // sub/username/role/companyIds'i payload'a koyuyordu — değer
      // SESSİZCE DÜŞÜYORDU. Sonuç: middleware/auth.js'teki
      // requireAuth, jwt.verify()'dan dönen payload.mustChangePassword'ü
      // her zaman undefined (Boolean(undefined)=false) olarak
      // okuyordu — yani must_change_password=TRUE ile oluşturulan
      // HİÇBİR kullanıcı gerçekte parola değiştirmeye ASLA
      // zorlanamıyordu; P1-D'den beri (P1/P2/P3 boyunca) bu güvenlik
      // kapısı FİİLEN ÇALIŞMIYORDU. Bu, P4'te npm test çalıştırılıp
      // gerçek bir uçtan-uca mustChangePassword testi yazılırken
      // ortaya çıktı (bkz. P4 Kod Raporu madde 8 — CRITICAL).
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
