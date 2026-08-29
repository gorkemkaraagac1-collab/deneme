const pool = require("../db/pool");

/**
 * ============================================================
 * ORGANIZATION / ACCESS CONTROL SERVICE (P1)
 * ============================================================
 *
 * P0'da eklenen companies.parent_company_id alanı üzerinden
 * holding ağacını (kim kimin altında) çözümleyen ve kullanıcının
 * ROLE'üne göre hangi şirketlere erişebileceğini (access scope)
 * hesaplayan merkezi servis katmanı.
 *
 * TASARIM KARARLARI (P1 kabul kriterleri ile birebir eşleşir):
 *
 * 1) ACCOUNTANT_MANAGER'ın erişim kapsamı = kendi
 *    user_companies satırlarındaki şirket(ler) + o şirket(ler)in
 *    ALT AĞACI (aşağı doğru, descendants). YUKARI doğru (ana
 *    şirkete / kardeş şirketlere) ASLA çıkılmaz. Böylece bir alt
 *    şirkete atanmış ACCOUNTANT_MANAGER holdingi veya kardeş
 *    şirketleri otomatik olarak GÖRMEZ (P1 kabul kriteri #2),
 *    ama holding kökünde atanmış bir ACCOUNTANT_MANAGER kendi
 *    tüm alt ağacını görür (kabul kriteri #1).
 *
 * 2) Lisans MİRAS KURALI (P0 db/init.sql yorumu: "lisansın ana
 *    şirkete bağlanıp alt şirketlere miras kalması") ile (1)
 *    KARIŞTIRILMAMALI: lisans her zaman ağacın KÖKÜNE (root)
 *    bağlıdır ve enforcement kökün lisansına göre yapılır — bu
 *    yüzden ayrıca getRootCompanyId (yukarı doğru) sağlanır.
 *    getRootCompanyId, kullanıcı erişim kapsamı için DEĞİL,
 *    yalnızca license-service.js'in lisans/limit çözümlemesi için
 *    kullanılır.
 *
 * 3) ADMIN rolü platform seviyesinde global'dir (bkz.
 *    middleware/admin.js'teki mevcut tasarım notu) — bu servis
 *    o kararı DEĞİŞTİRMEZ, sadece ACCOUNTANT_MANAGER için yeni bir
 *    ağaç-bazlı kapsam ekler.
 *
 * 4) Şirketler arasında DÖNGÜ (cycle) oluşamaz: companies tablosunda
 *    parent_company_id yalnızca INSERT sırasında (POST /companies)
 *    ve zaten var olan bir şirkete referans olarak set edilebilir;
 *    var olan bir şirketin parent_company_id'sini SONRADAN
 *    değiştiren hiçbir route yok. Bu yüzden bir alt şirket, kendi
 *    atalarından birinin parent'ı olamaz — recursive CTE'ler ek bir
 *    "ziyaret edilen düğüm" korumasına gerek duymadan güvenle
 *    kullanılabilir. (chk_companies_not_self_parent constraint'i de
 *    en azından tek adımlı döngüyü DB seviyesinde zaten engelliyor.)
 */

/**
 * Bir şirketten başlayıp (dahil) köke kadar olan atalar zincirini
 * TEK SORGUDA getirir. chain[0] = companyId'nin kendisi (depth 0),
 * chain[chain.length - 1] = ağacın kökü (parent_company_id IS NULL).
 *
 * companyId hiç yoksa boş dizi döner.
 *
 * @param {string} companyId
 * @param {object} db
 * @returns {Promise<Array<{id:string, parent_company_id:string|null, status:string, depth:number}>>}
 */
async function getCompanyAncestryChain(companyId, db = pool) {
  const result = await db.query(
    `
      WITH RECURSIVE ancestry AS (
        SELECT id, parent_company_id, status, 0 AS depth
        FROM companies
        WHERE id = $1

        UNION ALL

        SELECT c.id, c.parent_company_id, c.status, a.depth + 1
        FROM companies c
        INNER JOIN ancestry a
          ON c.id = a.parent_company_id
      )
      SELECT id, parent_company_id, status, depth
      FROM ancestry
      ORDER BY depth ASC
    `,
    [companyId]
  );

  return result.rows.map(row => ({
    id: String(row.id),
    parent_company_id: row.parent_company_id ? String(row.parent_company_id) : null,
    status: row.status,
    depth: row.depth
  }));
}

/**
 * Bir şirketin ağacının KÖKÜNÜ (parent_company_id IS NULL olan en
 * üst ata) döndürür. parent_company_id NULL olan (mevcut / P0
 * öncesi tüm düz şirketler dahil) şirketler için kendi id'sini
 * döndürür — bu, "Parent NULL olan mevcut şirketler eskisi gibi
 * çalışır" (P1 kabul kriteri #13) davranışını GARANTİ eder: tek
 * başına bir şirket için root === companyId, yani lisans/limit
 * hesaplaması P0 öncesiyle birebir aynı sonucu üretir.
 *
 * Şirket bulunamazsa null döner.
 *
 * @param {string} companyId
 * @param {object} db
 * @returns {Promise<string|null>}
 */
async function getRootCompanyId(companyId, db = pool) {
  const chain = await getCompanyAncestryChain(companyId, db);

  if (chain.length === 0) {
    return null;
  }

  return chain[chain.length - 1].id;
}

/**
 * Bir şirketten başlayıp (dahil) altındaki TÜM alt ağacı (aşağı
 * doğru, tüm nesiller) getirir. Sonuç her zaman en az companyId'nin
 * kendisini içerir (şirket gerçekten varsa).
 *
 * @param {string} companyId
 * @param {object} db
 * @returns {Promise<string[]>}
 */
async function getDescendantCompanyIds(companyId, db = pool) {
  const result = await db.query(
    `
      WITH RECURSIVE tree AS (
        SELECT id
        FROM companies
        WHERE id = $1

        UNION ALL

        SELECT c.id
        FROM companies c
        INNER JOIN tree t
          ON c.parent_company_id = t.id
      )
      SELECT id
      FROM tree
    `,
    [companyId]
  );

  return result.rows.map(row => String(row.id));
}

/**
 * Birden fazla şirketten başlayan alt ağaçların BİRLEŞİMİNİ
 * (union) getirir — tekrarlar elenir. Bir ACCOUNTANT_MANAGER'ın
 * birden fazla şirkete atanmış olabileceği (user_companies'te
 * birden fazla satır) durumunu güvenli şekilde kapsar.
 *
 * @param {string[]} companyIds
 * @param {object} db
 * @returns {Promise<string[]>}
 */
async function getDescendantCompanyIdsForMany(companyIds, db = pool) {
  const unique = [...new Set((companyIds || []).map(String))];

  if (unique.length === 0) {
    return [];
  }

  const trees = await Promise.all(
    unique.map(id => getDescendantCompanyIds(id, db))
  );

  return [...new Set(trees.flat())];
}

/**
 * ============================================================
 * ACCESS SCOPE
 * ============================================================
 *
 * Bir kullanıcının (req.user) hangi şirketlere erişebileceğini
 * ROLE'e göre hesaplar.
 *
 * Dönüş:
 *   { isGlobalAdmin: boolean, allowedCompanyIds: string[] | null }
 *
 *   - isGlobalAdmin=true  → allowedCompanyIds=null (kısıtlama yok,
 *     tüm şirketlere/kayıtlara erişim — yalnızca ADMIN).
 *   - isGlobalAdmin=false → allowedCompanyIds her zaman bir dizi
 *     (boş olabilir — hiçbir şirkete erişim yok demektir).
 *
 * ROLE'e göre davranış:
 *
 *   ADMIN               → global (P1-B kuralı: "tüm şirketleri
 *                          görebilir / global erişim")
 *   ACCOUNTANT_MANAGER  → kendi user_companies şirketlerinin ALT
 *                          AĞACI (yukarı çıkılmaz — bkz. dosya başı
 *                          notu)
 *   ACCOUNTANT/
 *   CONTROLLER/VIEWER   → DEĞİŞMEDİ: doğrudan req.user.companyIds
 *                          (JWT'den — P0/öncesi davranışla birebir
 *                          aynı, "atandığı şirket(ler) kapsamında
 *                          çalışır")
 *
 * @param {{role:string, companyIds:string[]}} user
 * @param {object} db
 * @returns {Promise<{isGlobalAdmin:boolean, allowedCompanyIds:string[]|null}>}
 */
async function resolveAccessScope(user, db = pool) {
  if (!user) {
    return { isGlobalAdmin: false, allowedCompanyIds: [] };
  }

  if (user.role === "ADMIN") {
    return { isGlobalAdmin: true, allowedCompanyIds: null };
  }

  if (user.role === "ACCOUNTANT_MANAGER") {
    const ownCompanyIds = Array.isArray(user.companyIds)
      ? user.companyIds.map(String)
      : [];

    if (ownCompanyIds.length === 0) {
      // Hiçbir şirkete atanmamış bir ACCOUNTANT_MANAGER hiçbir
      // şeye erişemez — sessizce "her şeyi gör" moduna düşmez.
      return { isGlobalAdmin: false, allowedCompanyIds: [] };
    }

    const tree = await getDescendantCompanyIdsForMany(ownCompanyIds, db);

    return { isGlobalAdmin: false, allowedCompanyIds: tree };
  }

  // ACCOUNTANT / CONTROLLER / VIEWER — mevcut davranış korunuyor.
  return {
    isGlobalAdmin: false,
    allowedCompanyIds: Array.isArray(user.companyIds)
      ? user.companyIds.map(String)
      : []
  };
}

/**
 * Bir şirketin, verilen erişim kapsamı içinde olup olmadığını
 * kontrol eder.
 *
 * @param {string} companyId
 * @param {{isGlobalAdmin:boolean, allowedCompanyIds:string[]|null}} scope
 * @returns {boolean}
 */
function isCompanyInScope(companyId, scope) {
  if (!scope) {
    return false;
  }

  if (scope.isGlobalAdmin) {
    return true;
  }

  if (!Array.isArray(scope.allowedCompanyIds)) {
    return false;
  }

  return scope.allowedCompanyIds
    .map(String)
    .includes(String(companyId));
}

/**
 * ============================================================
 * ROL YARATMA / DEĞİŞTİRME MATRİSİ (P1 madde 4)
 * ============================================================
 *
 * ADMIN:               herhangi bir rolü oluşturabilir/atayabilir.
 * ACCOUNTANT_MANAGER:   yalnızca ACCOUNTANT, CONTROLLER, VIEWER
 *                       oluşturabilir/atayabilir. ADMIN veya
 *                       ACCOUNTANT_MANAGER OLUŞTURAMAZ/ATAYAMAZ —
 *                       SERVER-SIDE zorunlu (bkz. onaylı plan
 *                       madde 4).
 * Diğer roller:         kullanıcı yönetemez (bu fonksiyona hiç
 *                       ulaşmamalı — route seviyesinde
 *                       requireStaffAccess zaten ADMIN/
 *                       ACCOUNTANT_MANAGER dışını reddediyor).
 */

const ALL_ROLES = [
  "ADMIN",
  "ACCOUNTANT_MANAGER",
  "ACCOUNTANT",
  "CONTROLLER",
  "VIEWER"
];

const MANAGER_ASSIGNABLE_ROLES = [
  "ACCOUNTANT",
  "CONTROLLER",
  "VIEWER"
];

// Kontrat (sözleşme) yazma yetkisi olan roller. CONTROLLER
// (izleme/raporlama, yazma yetkisi yok) ve VIEWER (salt okunur)
// bu listede DEĞİLDİR (P1-B).
const CONTRACT_WRITE_ROLES = [
  "ADMIN",
  "ACCOUNTANT_MANAGER",
  "ACCOUNTANT"
];

/**
 * actorRole'ün hangi rolleri oluşturabileceğini/atayabileceğini
 * döndürür.
 *
 * @param {string} actorRole
 * @returns {string[]}
 */
function rolesAssignableBy(actorRole) {
  if (actorRole === "ADMIN") {
    return ALL_ROLES;
  }

  if (actorRole === "ACCOUNTANT_MANAGER") {
    return MANAGER_ASSIGNABLE_ROLES;
  }

  return [];
}

/**
 * actorRole, targetRole'ü oluşturabilir/atayabilir mi?
 *
 * @param {string} actorRole
 * @param {string} targetRole
 * @returns {boolean}
 */
function canAssignRole(actorRole, targetRole) {
  return rolesAssignableBy(actorRole).includes(targetRole);
}

/**
 * Verilen rolün sözleşme (contract) CRUD yazma yetkisi var mı?
 * (CONTROLLER/VIEWER salt okunur.)
 *
 * @param {string} role
 * @returns {boolean}
 */
function isContractWriteRole(role) {
  return CONTRACT_WRITE_ROLES.includes(role);
}

module.exports = {
  getCompanyAncestryChain,
  getRootCompanyId,
  getDescendantCompanyIds,
  getDescendantCompanyIdsForMany,
  resolveAccessScope,
  isCompanyInScope,
  canAssignRole,
  rolesAssignableBy,
  isContractWriteRole,
  ALL_ROLES,
  MANAGER_ASSIGNABLE_ROLES,
  CONTRACT_WRITE_ROLES
};
