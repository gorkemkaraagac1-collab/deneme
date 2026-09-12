const express = require("express");
const pool = require("../db/pool");

const { requireAuth } = require("../middleware/auth");

const {
  requireCompanyLicense
} = require("../middleware/license");

const {
  canAddContractToCompany,
  lockRootCompanyForLimit
} = require("../services/license-service");


const {
  resolveAccessScope,
  isCompanyInScope,
  isContractWriteRole
} = require("../services/organization-service");
const { assertPeriodOpen } = require("../services/period-lock-service");

const router = express.Router();

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.keys(value).sort().map(key =>
    `${JSON.stringify(key)}:${stableStringify(value[key])}`
  ).join(",")}}`;
}

function reassessmentEconomicKey(item) {
  return [
    item?.type || "",
    item?.effectiveDate || item?.reassessmentDate || "",
    stableStringify(item?.newTerms || {})
  ].join("|");
}

function modificationEconomicKey(item) {
  return [
    item?.modificationType || item?.type || "",
    item?.effectiveDate || item?.modificationDate || "",
    stableStringify(item?.newTerms || {}),
    Number(item?.scopeReductionPercent) || 0,
    Number(item?.scopeIncreasePercent) || 0,
    Number(item?.scopeIncreaseAmount) || 0
  ].join("|");
}

function findEconomicDuplicate(existingItems, incomingItems, economicKey) {
  const existing = Array.isArray(existingItems) ? existingItems : [];
  const incoming = Array.isArray(incomingItems) ? incomingItems : [];
  const existingIds = new Set(existing.map(item => item?.id));
  const existingKeys = new Set(existing
    .filter(item => item?.status !== "CANCELLED")
    .map(economicKey));
  const payloadKeys = new Set();

  for (const item of incoming) {
    if (item?.status === "CANCELLED") continue;
    const key = economicKey(item);
    if (payloadKeys.has(key)) return item;
    payloadKeys.add(key);
    if (!existingIds.has(item?.id) && existingKeys.has(key)) return item;
  }
  return null;
}

/**
 * Merge event collections when a client sends a stale contract snapshot.
 *
 * Modification and reassessment records are append-only business history:
 * omitting an older record from a later PUT must never erase it.  A record
 * with the same id is an edit of that record and therefore replaces the
 * stored version; new ids are appended in payload order.
 */
function mergeEventCollection(existingItems, incomingItems) {
  if (!Array.isArray(incomingItems)) return existingItems;
  const existing = Array.isArray(existingItems) ? existingItems : [];
  const merged = existing.map(item => item);
  const indexById = new Map(
    merged
      .filter(item => item && item.id !== undefined && item.id !== null)
      .map((item, index) => [String(item.id), index])
  );

  incomingItems.forEach(item => {
    if (!item || typeof item !== "object") return;
    const id = item.id === undefined || item.id === null ? null : String(item.id);
    if (id !== null && indexById.has(id)) {
      merged[indexById.get(id)] = item;
      return;
    }
    if (id !== null) indexById.set(id, merged.length);
    merged.push(item);
  });
  return merged;
}

function mergePersistedDetails(existingDetails, incomingDetails) {
  const existing = existingDetails && typeof existingDetails === "object" ? existingDetails : {};
  const incoming = incomingDetails && typeof incomingDetails === "object" ? incomingDetails : {};
  const merged = { ...existing, ...incoming };
  ["modifications", "reassessments"].forEach(field => {
    if (Object.prototype.hasOwnProperty.call(incoming, field)) {
      merged[field] = mergeEventCollection(existing[field], incoming[field]);
    }
  });
  return merged;
}


/**
 * ============================================================
 * AUTHENTICATION + ACCESS SCOPE
 * ============================================================
 *
 * Bu router'daki bütün endpoint'ler JWT authentication
 * gerektirir.
 *
 * P1: erişim artık yalnızca JWT'deki ham companyIds ile değil,
 * role'e göre hesaplanan ERİŞİM KAPSAMI (access scope) ile
 * belirlenir:
 *   - ADMIN               → global (tüm şirketlerin kontratları)
 *   - ACCOUNTANT_MANAGER  → kendi holding alt ağacı
 *   - ACCOUNTANT/CONTROLLER/VIEWER
 *                         → ESKİ davranışla birebir aynı
 *                           (req.user.companyIds)
 *
 * req.accessScope her istekte burada hesaplanıp sonraki tüm route
 * handler'larına aktarılır (bkz. services/organization-service.js).
 */
router.use(requireAuth);

router.use(async (req, res, next) => {
  try {
    req.accessScope = await resolveAccessScope(req.user);
    return next();
  } catch (error) {
    console.error(
      "contracts.js erişim kapsamı hesaplama hatası:",
      error
    );
    return res.status(500).json({
      error: "Yetki kapsamı hesaplanırken beklenmeyen bir hata oluştu"
    });
  }
});


/**
 * P1-B: CONTROLLER (izleme/raporlama, yazma yetkisi yok) ve VIEWER
 * (salt okunur) sözleşme oluşturamaz/güncelleyemez/silemez. Bu
 * middleware yalnızca POST/PUT/DELETE route'larına eklenir — GET
 * route'ları tüm rollere (okuma yetkisi olan herkese) açıktır.
 */
function requireContractWriteRole(req, res, next) {
  if (!isContractWriteRole(req.user.role)) {
    return res.status(403).json({
      error: "Bu işlem için yazma yetkiniz bulunmamaktadır",
      code: "CONTRACT_WRITE_ACCESS_DENIED"
    });
  }
  return next();
}


/**
 * ============================================================
 * GET /api/contracts
 * ============================================================
 *
 * Kullanıcının erişim kapsamındaki (bkz. yukarı — accessScope)
 * şirketlerin kontratlarını getirir.
 *
 * ÖNEMLİ:
 * - companyIds/erişim kapsamı JWT + role'den hesaplanır.
 * - Client tarafından gönderilen hiçbir company_id/companyIds
 *   değerine güvenilmez (bu endpoint zaten query/body'den company
 *   id almıyor).
 *
 * P1 — "License expired: read = OK, write = 403": bu endpoint bir
 * OKUMA (read) endpoint'idir, bu yüzden BURADA lisans durumuna
 * BAKILMAZ — süresi dolmuş/pasif lisanslı bir şirketin kontratları
 * da listelenir (yazma endpoint'lerinde — POST/PUT/DELETE — lisans
 * hâlâ zorunludur). Önceki sürümde burada bir aktif-lisans EXISTS
 * kontrolü vardı; bu, süresi dolan bir şirketin kontratlarının
 * OKUNMASINI da tamamen engelliyordu — kabul kriterine aykırıydı,
 * kaldırıldı.
 */
router.get("/", async (req, res) => {

  try {

    const scope = req.accessScope;

    if (!scope.isGlobalAdmin && (!Array.isArray(scope.allowedCompanyIds) || scope.allowedCompanyIds.length === 0)) {

      return res.status(403).json({
        error: "Kullanıcının erişebildiği şirket bulunmamaktadır",
        code: "NO_COMPANY_ACCESS"
      });

    }


    const result = scope.isGlobalAdmin
      ? await pool.query(
          `
            SELECT
              c.*,
              (
                SELECT json_build_object(
                  'id', ob.id,
                  'opening_date', ob.opening_date,
                  'opening_rou_asset', ob.opening_rou_asset,
                  'opening_lease_liability', ob.opening_lease_liability,
                  'opening_accumulated_depreciation', ob.opening_accumulated_depreciation,
                  'opening_accumulated_interest', ob.opening_accumulated_interest,
                  'opening_retained_earnings_adjustment', ob.opening_retained_earnings_adjustment,
                  'discount_rate', ob.discount_rate,
                  'currency', ob.currency,
                  'next_payment_date', ob.next_payment_date,
                  'source_reference', ob.source_reference,
                  'status', ob.status
                )
                FROM contract_opening_balances ob
                WHERE ob.contract_id = c.id AND ob.status = 'APPROVED'
                ORDER BY ob.opening_date DESC
                LIMIT 1
              ) AS opening_balance
            FROM contracts c
            ORDER BY c.created_at DESC
          `
        )
      : await pool.query(
          `
            SELECT
              c.*,
              (
                SELECT json_build_object(
                  'id', ob.id,
                  'opening_date', ob.opening_date,
                  'opening_rou_asset', ob.opening_rou_asset,
                  'opening_lease_liability', ob.opening_lease_liability,
                  'opening_accumulated_depreciation', ob.opening_accumulated_depreciation,
                  'opening_accumulated_interest', ob.opening_accumulated_interest,
                  'opening_retained_earnings_adjustment', ob.opening_retained_earnings_adjustment,
                  'discount_rate', ob.discount_rate,
                  'currency', ob.currency,
                  'next_payment_date', ob.next_payment_date,
                  'source_reference', ob.source_reference,
                  'status', ob.status
                )
                FROM contract_opening_balances ob
                WHERE ob.contract_id = c.id AND ob.status = 'APPROVED'
                ORDER BY ob.opening_date DESC
                LIMIT 1
              ) AS opening_balance
            FROM contracts c
            WHERE c.company_id = ANY($1)
            ORDER BY c.created_at DESC
          `,
          [scope.allowedCompanyIds]
        );


    return res.json(result.rows);

  } catch (error) {

    console.error(
      "GET /api/contracts hatası:",
      error
    );

    return res.status(500).json({
      error: "Kontratlar alınırken beklenmeyen bir hata oluştu"
    });

  }

});


/**
 * ============================================================
 * GET /api/contracts/:id
 * ============================================================
 *
 * Tek kontrat getirir.
 *
 * Güvenlik:
 * - Kullanıcının erişim kapsamında olmalı (ADMIN: global,
 *   ACCOUNTANT_MANAGER: kendi holding alt ağacı, diğerleri: kendi
 *   şirketleri).
 * - Başka şirketin kontratı 404 döner.
 *
 * P1: bu da bir OKUMA endpoint'i olduğundan aktif lisans şartı
 * ARANMAZ (bkz. GET / üzerindeki not — "License expired: read=OK").
 */
router.get("/:id", async (req, res) => {

  try {

    const scope = req.accessScope;

    const result = scope.isGlobalAdmin
      ? await pool.query(
          `
            SELECT
              c.*,
              (SELECT json_build_object(
                'id', ob.id, 'opening_date', ob.opening_date,
                'opening_rou_asset', ob.opening_rou_asset,
                'opening_lease_liability', ob.opening_lease_liability,
                'opening_accumulated_depreciation', ob.opening_accumulated_depreciation,
                'opening_accumulated_interest', ob.opening_accumulated_interest,
                'opening_retained_earnings_adjustment', ob.opening_retained_earnings_adjustment,
                'discount_rate', ob.discount_rate, 'currency', ob.currency,
                'next_payment_date', ob.next_payment_date,
                'source_reference', ob.source_reference, 'status', ob.status
              ) FROM contract_opening_balances ob
               WHERE ob.contract_id = c.id AND ob.status = 'APPROVED'
               ORDER BY ob.opening_date DESC LIMIT 1) AS opening_balance
            FROM contracts c
            WHERE c.id = $1
            LIMIT 1
          `,
          [req.params.id]
        )
      : await pool.query(
          `
            SELECT
              c.*,
              (SELECT json_build_object(
                'id', ob.id, 'opening_date', ob.opening_date,
                'opening_rou_asset', ob.opening_rou_asset,
                'opening_lease_liability', ob.opening_lease_liability,
                'opening_accumulated_depreciation', ob.opening_accumulated_depreciation,
                'opening_accumulated_interest', ob.opening_accumulated_interest,
                'opening_retained_earnings_adjustment', ob.opening_retained_earnings_adjustment,
                'discount_rate', ob.discount_rate, 'currency', ob.currency,
                'next_payment_date', ob.next_payment_date,
                'source_reference', ob.source_reference, 'status', ob.status
              ) FROM contract_opening_balances ob
               WHERE ob.contract_id = c.id AND ob.status = 'APPROVED'
               ORDER BY ob.opening_date DESC LIMIT 1) AS opening_balance
            FROM contracts c
            WHERE c.id = $1
              AND c.company_id = ANY($2)
            LIMIT 1
          `,
          [
            req.params.id,
            scope.allowedCompanyIds
          ]
        );


    if (result.rows.length === 0) {

      return res.status(404).json({
        error: "Contract not found"
      });

    }


    return res.json(result.rows[0]);

  } catch (error) {

    console.error(
      "GET /api/contracts/:id hatası:",
      error
    );

    return res.status(500).json({
      error: "Kontrat alınırken beklenmeyen bir hata oluştu"
    });

  }

});


/**
 * ============================================================
 * POST /api/contracts
 * ============================================================
 *
 * Yeni kontrat oluşturur.
 *
 * companyId:
 * - body'den alınabilir
 * - fakat JWT companyIds ile mutlaka doğrulanır
 * - ardından aktif şirket lisansı kontrol edilir
 */
router.post(
  "/",
  requireContractWriteRole,
  requireCompanyLicense,
  async (req, res) => {

    try {

      const {
        id,
        companyId,
        company,
        supplier,
        monthlyPayment,
        startDate,
        endDate,
        discountRate,
        currency,
        details
      } = req.body;


      /**
       * requireCompanyLicense tarafından doğrulanmış
       * companyId kullanılır.
       */
      const authorizedCompanyId =
        req.companyId;

      await assertPeriodOpen(pool, authorizedCompanyId, String(startDate).slice(0, 7));


      if (
        !id ||
        !companyId ||
        !company ||
        !supplier ||
        !startDate ||
        !endDate
      ) {

        return res.status(400).json({
          error:
            "id, companyId, company, supplier, startDate, endDate zorunludur"
        });

      }


      /**
       * Client'ın body içindeki companyId'si ile
       * middleware'in doğruladığı companyId aynı olmalı.
       */
      if (
        String(companyId) !==
        String(authorizedCompanyId)
      ) {

        return res.status(403).json({
          error:
            "Geçersiz şirket erişimi",
          code:
            "COMPANY_ACCESS_DENIED"
        });

      }


      /**
       * DÜZELTME: Planların max_users ile aynı şekilde bir
       * max_contracts (sözleşme) limiti var artık, ama daha önce
       * hiçbir yerde kontrol edilmiyordu — Starter planındaki bir
       * şirket de Enterprise ile aynı sayıda sözleşme
       * girebiliyordu. requireCompanyLicense zaten aktif lisansı
       * doğruladı; burada ayrıca o lisansın sözleşme limitine
       * ulaşılıp ulaşılmadığına bakılıyor.
       *
       * P5-B: Transaction + root FOR UPDATE ile TOCTOU kapatıldı.
       */
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        await lockRootCompanyForLimit(authorizedCompanyId, client);

        const contractLimitCheck =
          await canAddContractToCompany(
            authorizedCompanyId,
            client
          );

        if (!contractLimitCheck.allowed) {
          await client.query("ROLLBACK");

          return res.status(403).json({
            error:
              contractLimitCheck.message ||
              "Şirket sözleşme limitine ulaşmıştır.",
            code:
              contractLimitCheck.reason,
            currentContracts:
              contractLimitCheck.currentContracts,
            maxContracts:
              contractLimitCheck.maxContracts
          });
        }

        const result = await client.query(
          `
            INSERT INTO contracts (
              id,
              company_id,
              company,
              supplier,
              monthly_payment,
              start_date,
              end_date,
              discount_rate,
              currency,
              details
            )
            VALUES (
              $1,
              $2,
              $3,
              $4,
              $5,
              $6,
              $7,
              $8,
              $9,
              $10
            )
            RETURNING *
          `,
          [
            id,
            authorizedCompanyId,
            company,
            supplier,
            monthlyPayment,
            startDate,
            endDate,
            discountRate || 0,
            currency || "TRY",
            JSON.stringify(details && typeof details === "object" ? details : {})
          ]
        );

        await client.query("COMMIT");

        return res.status(201).json(
          result.rows[0]
        );
      } catch (txError) {
        try { await client.query("ROLLBACK"); } catch (_) { /* ignore */ }
        throw txError;
      } finally {
        client.release();
      }


    } catch (error) {

      console.error(
        "POST /api/contracts hatası:",
        error
      );


      if (error.code === "23505") {

        return res.status(409).json({
          error:
            `Contract already exists: ${req.body.id}`
        });

      }


      /**
       * DÜZELTME (kullanıcı talebi — best practice): önceden burada
       * SADECE jenerik "beklenmeyen bir hata oluştu" dönüyordu; gerçek
       * sebep (Postgres SQLSTATE kodu + mesajı: NOT NULL ihlali, FK
       * ihlali, tip/uzunluk hatası vb.) sadece server log'unda kalıyordu
       * ve client tarafı (bulk import ekranı dahil) hiçbir zaman teşhis
       * edemiyordu. Bu erken/pre-production aşamada (tek operatör, gerçek
       * müşteri verisi yok) DB hata kodunu ve mesajını response'a da
       * ekliyoruz — teşhisi client tarafında (Bulk Import "Backend hatası
       * detayı" alert'i dahil) mümkün kılmak için. Gerçek müşteri
       * trafiğine açılmadan önce bu ayrıntı (en azından `detail`) DEBUG_
       * ERRORS=false ile kapatılmalı; SQLSTATE `code` (23502, 23503 vb.)
       * standart ve genel olarak zararsızdır, üretimde de kalabilir.
       */
      return res.status(500).json({
        error:
          "Kontrat oluşturulurken beklenmeyen bir hata oluştu",
        code: error.code || null,
        detail: process.env.DEBUG_ERRORS === "true" ? (error.message || String(error)) : undefined
      });

    }

  }
);


/**
 * ============================================================
 * PUT /api/contracts/:id
 * ============================================================
 *
 * Güncelleme yalnızca:
 *
 * JWT companyIds
 * +
 * aktif lisans
 *
 * kapsamında yapılabilir.
 */
router.put(
  "/:id",
  requireContractWriteRole,
  async (req, res) => {

    let client;

    try {

      client = await pool.connect();
      await client.query("BEGIN");

      const {
        company,
        supplier,
        monthlyPayment,
        startDate,
        endDate,
        discountRate,
        currency,
        status,
        companyId,
        details
      } = req.body;


      const scope = req.accessScope;

      if (startDate) {
        await assertPeriodOpen(client, companyId || req.companyId, String(startDate).slice(0, 7));
      }

      /**
       * Önce kontratın sahibini buluyoruz — erişim kapsamı
       * dışındaki bir kontrat için "var olduğu" bile sızdırılmaz
       * (404).
       */
      const contractResult = scope.isGlobalAdmin
        ? await client.query(
            `
              SELECT
                company_id,
                details
              FROM contracts
              WHERE id = $1
              LIMIT 1
              FOR UPDATE
            `,
            [req.params.id]
          )
        : await client.query(
            `
              SELECT
                company_id,
                details
              FROM contracts
              WHERE id = $1
                AND company_id = ANY($2)
              LIMIT 1
              FOR UPDATE
            `,
            [
              req.params.id,
              scope.allowedCompanyIds
            ]
          );


      if (
        contractResult.rows.length === 0
      ) {

        await client.query("ROLLBACK");

        return res.status(404).json({
          error: "Contract not found"
        });

      }


      const contractCompanyId =
        String(
          contractResult.rows[0].company_id
        );


      /**
       * P1: erişim kontrolü artık accessScope üzerinden yapılır
       * (ADMIN: global, ACCOUNTANT_MANAGER: kendi holding alt
       * ağacı, diğerleri: req.user.companyIds ile birebir aynı).
       * SELECT sorgusu zaten scope'a göre filtrelendiği için bu
       * ikinci kontrol normalde hep true döner — savunma amaçlı
       * (defense in depth) korunuyor.
       */
      if (!isCompanyInScope(contractCompanyId, scope)) {

        await client.query("ROLLBACK");

        return res.status(403).json({
          error:
            "Bu şirkete erişim yetkiniz bulunmamaktadır",
          code:
            "COMPANY_ACCESS_DENIED"
        });

      }


      /**
       * Aktif lisans kontrolü — bu bir YAZMA (write) işlemi
       * olduğundan lisans şartı burada AYNEN KORUNUR ("License
       * expired: write = 403" — yalnızca GET'lerden kaldırıldı).
       */
      const licenseResult =
        await client.query(
          `
            SELECT 1
            FROM company_licenses
            WHERE company_id = $1
              AND status = 'active'
              AND starts_at <= NOW()
              AND (
                expires_at IS NULL
                OR expires_at > NOW()
              )
            LIMIT 1
          `,
          [contractCompanyId]
        );


      if (
        licenseResult.rows.length === 0
      ) {

        await client.query("ROLLBACK");

        return res.status(403).json({
          error:
            "Şirketin aktif lisansı bulunmamaktadır",
          code:
            "COMPANY_LICENSE_INACTIVE"
        });

      }


      /**
       * companyId client tarafından değiştirilmek
       * istenirse kontratın şirketi değiştirilemez.
       */
      if (
        companyId !== undefined &&
        String(companyId) !== contractCompanyId
      ) {

        await client.query("ROLLBACK");

        return res.status(403).json({
          error:
            "Kontratın şirketi değiştirilemez",
          code:
            "COMPANY_CHANGE_NOT_ALLOWED"
        });

      }


      /**
       * P6 (GC-DUP-REASS düzeltmesi): client'ın gönderdiği details.reassessments
       * (ve details.modifications), DB'deki mevcut satırla karşılaştırılmadan
       * komple üzerine yazılıyordu. Bu, checkAllIndexReassessments() gibi eşzamanlı/
       * art arda tetiklenen istemci akışlarında TOCTOU race'ine yol açıyordu:
       * her istemci kopyası kendi (o anki) reassessments[] listesi üzerinde dedup
       * kontrolü yapıp yeni bir kayıt ekliyor, DB'deki önceki APPLIED kaydı
       * göremediği için silmiyor — sonuç: aynı ekonomik reassessment (aynı type +
       * effectiveDate + newTerms) DB'de birden çok kez birikiyor (bkz. LEASE-012,
       * 2026-09-03 — aynı endeks reassessment'ı 6 kez APPLIED olarak kaydedilmiş).
       *
       * Çözüm client-side değil burada (persist noktasında, DB'ye en yakın yerde)
       * uygulanıyor: gelen details.reassessments içinde, DB'de ZATEN status!=
       * CANCELLED olarak var olan bir (type, effectiveDate, newTerms) ekonomik
       * anahtarına sahip YENİ bir kayıt (id DB'de yoksa) tespit edilirse istek
       * 409 ile reddedilir. Var olan kayıtların düzenlenmesi (aynı id, status
       * güncellemesi vb.) etkilenmez.
       */
      if (details !== undefined && details !== null) {
        const existingDetails = contractResult.rows[0]?.details || {};
        const duplicateReassessment = findEconomicDuplicate(
          existingDetails.reassessments,
          details.reassessments,
          reassessmentEconomicKey
        );
        const duplicateModification = findEconomicDuplicate(
          existingDetails.modifications,
          details.modifications,
          modificationEconomicKey
        );

        if (duplicateReassessment || duplicateModification) {
          await client.query("ROLLBACK");
          const isModification = Boolean(duplicateModification);
          const duplicate = duplicateModification || duplicateReassessment;
          return res.status(409).json({
            error: isModification
              ? "Aynı modifikasyon (tip + effective date + şartlar) bu kontrat için zaten mevcut."
              : "Aynı reassessment (tip + effective date + şartlar) bu kontrat için zaten mevcut.",
            code: isModification
              ? "DUPLICATE_MODIFICATION"
              : "DUPLICATE_REASSESSMENT",
            conflictingId: duplicate.id
          });
        }
      }

      // Clients can legitimately hold a stale snapshot while another event
      // is being applied. Preserve the database's event history and merge
      // same-id edits instead of replacing the whole array with that stale
      // snapshot (which previously made the first modification disappear).
      const persistedDetails =
        details !== undefined && details !== null
          ? mergePersistedDetails(contractResult.rows[0]?.details, details)
          : null;


      const result = await client.query(
        `
          UPDATE contracts
          SET
            company = COALESCE($1, company),
            supplier = COALESCE($2, supplier),
            monthly_payment = COALESCE($3, monthly_payment),
            start_date = COALESCE($4, start_date),
            end_date = COALESCE($5, end_date),
            discount_rate = COALESCE($6, discount_rate),
            currency = COALESCE($7, currency),
            status = COALESCE($8, status),
            details = COALESCE($9, details),
            updated_at = NOW()
          WHERE id = $10
            AND company_id = $11
          RETURNING *
        `,
        [
          company,
          supplier,
          monthlyPayment,
          startDate,
          endDate,
          discountRate,
          currency,
          status,
          /**
           * DÜZELTME (birlikte): details client tarafından
           * gönderilmediyse (undefined) mevcut satırdaki değeri
           * KORUYORUZ (COALESCE ile null geçip eski değeri bırakıyoruz).
           * pg, JS 'undefined' parametresini kabul etmediği için
           * null'a çeviriyoruz — COALESCE($9, details) null'ı da
           * "değiştirme" olarak yorumlar.
           */
          details !== undefined && details !== null
            ? JSON.stringify(persistedDetails)
            : null,
          req.params.id,
          contractCompanyId
        ]
      );

      await client.query("COMMIT");


      return res.json(
        result.rows[0]
      );

    } catch (error) {

      if (client) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          console.error("PUT /api/contracts/:id rollback hatası:", rollbackError);
        }
      }

      console.error(
        "PUT /api/contracts/:id hatası:",
        error
      );

      return res.status(500).json({
        error:
          "Kontrat güncellenirken beklenmeyen bir hata oluştu",
        code: error.code || null,
        detail: process.env.DEBUG_ERRORS === "true" ? (error.message || String(error)) : undefined
      });

    } finally {
      if (client) client.release();
    }

  }
);


/**
 * ============================================================
 * DELETE /api/contracts/:id
 * ============================================================
 *
 * Silme işlemi:
 * - kullanıcı şirketine ait olmalı
 * - aktif lisans bulunmalı
 */
router.delete(
  "/:id",
  requireContractWriteRole,
  async (req, res) => {

    try {

      const scope = req.accessScope;

      const contractResult = scope.isGlobalAdmin
        ? await pool.query(
            `
              SELECT
                company_id,
                start_date
              FROM contracts
              WHERE id = $1
              LIMIT 1
            `,
            [req.params.id]
          )
        : await pool.query(
            `
              SELECT
                company_id,
                start_date
              FROM contracts
              WHERE id = $1
                AND company_id = ANY($2)
              LIMIT 1
            `,
            [
              req.params.id,
              scope.allowedCompanyIds
            ]
          );


      if (
        contractResult.rows.length === 0
      ) {

        return res.status(404).json({
          error: "Contract not found"
        });

      }


      const companyId =
        String(
          contractResult.rows[0].company_id
        );

      const startDate = contractResult.rows[0].start_date;
      if (startDate) {
        await assertPeriodOpen(pool, companyId, String(startDate).slice(0, 7));
      }


      const licenseResult =
        await pool.query(
          `
            SELECT 1
            FROM company_licenses
            WHERE company_id = $1
              AND status = 'active'
              AND starts_at <= NOW()
              AND (
                expires_at IS NULL
                OR expires_at > NOW()
              )
            LIMIT 1
          `,
          [companyId]
        );


      if (
        licenseResult.rows.length === 0
      ) {

        return res.status(403).json({
          error:
            "Şirketin aktif lisansı bulunmamaktadır",
          code:
            "COMPANY_LICENSE_INACTIVE"
        });

      }


      const result = await pool.query(
        `
          DELETE FROM contracts
          WHERE id = $1
            AND company_id = $2
          RETURNING id
        `,
        [
          req.params.id,
          companyId
        ]
      );


      if (
        result.rows.length === 0
      ) {

        return res.status(404).json({
          error: "Contract not found"
        });

      }


      return res.status(204).send();

    } catch (error) {

      console.error(
        "DELETE /api/contracts/:id hatası:",
        error
      );

      return res.status(500).json({
        error:
          "Kontrat silinirken beklenmeyen bir hata oluştu"
      });

    }

  }
);


module.exports = router;
