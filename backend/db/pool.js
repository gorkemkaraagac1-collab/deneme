const { Pool } = require("pg");

/**
 * ============================================================
 * DATABASE CONNECTION SECURITY
 * ============================================================
 *
 * GÜVENLİK: Önceden DB_PASSWORD tanımlı değilse sessizce
 * "password" gibi zayıf/tahmin edilebilir bir varsayılana
 * düşülüyordu. Bu, .env yanlışlıkla eksik bırakılırsa
 * production'ın zayıf/varsayılan bir kimlik bilgisiyle DB'ye
 * bağlanmasına izin verirdi. JWT_SECRET'te olduğu gibi (bkz.
 * utils/jwt.js), eksik kritik kimlik bilgisi durumunda sunucu
 * sessizce zayıf bir varsayılanla değil, açık bir hatayla
 * başlamayı reddeder.
 */
const requiredEnv = ["DB_USER", "DB_PASSWORD", "DB_NAME"];
const missingEnv = requiredEnv.filter(key => !process.env[key]);

if (missingEnv.length > 0) {
  throw new Error(
    `Eksik veritabanı ortam değişken(ler)i: ${missingEnv.join(", ")}. ` +
    "backend/.env dosyasını .env.example'a göre doldurun."
  );
}

/**
 * SSL: Varsayılan olarak KAPALIDIR. Cloud Run üzerinde Cloud SQL'e
 * Unix soketi (/cloudsql/INSTANCE_CONNECTION_NAME) veya Cloud SQL
 * Auth Proxy/Connector üzerinden bağlanılıyorsa, şifreleme zaten
 * proxy <-> Cloud SQL bacağında (mTLS ile) sağlanır; uygulama ile
 * yerel soket arasındaki bağlantı düz metindir ve SSL negotiation
 * KABUL ETMEZ. Bu yüzden NODE_ENV=production kontrolüyle SSL'i
 * otomatik zorlamak yanlıştır ve "The server does not support SSL
 * connections" hatasına yol açar.
 *
 * SSL yalnızca DB_SSL=true açıkça verildiğinde etkinleştirilir
 * (ör. Cloud SQL'e public IP üzerinden doğrudan TCP ile ve SSL
 * zorunluyken bağlanılan senaryolar için). DB_SSL_REJECT_UNAUTHORIZED
 * varsayılan olarak "true"dur; self-signed sertifika kullanan
 * ortamlarda bilinçli olarak "false" yapılabilir.
 */
function resolveSslOption() {
  if (process.env.DB_SSL === "true") {
    return {
      rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false"
    };
  }

  return false;
}

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT) || 5432,

  ssl: resolveSslOption(),

  // Sınırsız bağlantı büyümesini (ve buna bağlı DB kaynak
  // tükenmesini) önlemek için havuz boyutu sınırlanır.
  max: Number(process.env.DB_POOL_MAX) || 20,

  // Boşta kalan bağlantılar belirli bir süre sonra kapatılır.
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS) || 30000,

  // Yeni bir bağlantı kurmak bu süreden uzun sürerse hata verilir
  // (DB erişilemez durumdayken isteklerin sonsuza kadar
  // asılı kalmasını önler).
  connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS) || 5000
});

pool.on("error", err => {
  console.error("Beklenmeyen PostgreSQL pool hatası:", err);
});

module.exports = pool;
