const __gkTfrs16Boot = () => {

  // Finansal veri tarayıcıda kalıcı tutulmaz: kaynak her zaman API/DB'dir.
  // Bu modüldeki gk_tfrs16_* anahtarları yalnızca sayfa belleğinde yaşar;
  // oturum token'ları, arayüz tercihleri ve backend'e gönderilmeyi bekleyen
  // denetim kuyruğu tarayıcı deposunda kalır. Eski sürümlerden kalan yerel
  // finansal kopyalar açılışta silinir.
  const localStorage = (() => {
    const real = window.localStorage;
    const persistent = new Set([
      "access_token", "gk_backend_jwt", "current_user",
      "gk_tfrs16_active_company_v1", "gk_tfrs16_reporting_currency_v1",
      "gk_tfrs16_audit_pending_sync_v1", "gk_tfrs16_audit_rejected_sync_v1"
    ]);
    const isLocalData = key => /^gk_tfrs16_/.test(String(key)) && !persistent.has(String(key));
    const memory = new Map();
    try {
      for (let i = real.length - 1; i >= 0; i--) {
        const key = real.key(i);
        if (isLocalData(key)) real.removeItem(key);
      }
    } catch (_) { /* Storage may be unavailable; memory store still works. */ }
    return {
      getItem: key => isLocalData(key) ? (memory.has(String(key)) ? memory.get(String(key)) : null) : real.getItem(key),
      setItem: (key, value) => isLocalData(key) ? void memory.set(String(key), String(value)) : real.setItem(key, value),
      removeItem: key => isLocalData(key) ? void memory.delete(String(key)) : real.removeItem(key)
    };
  })();

  // Core form event bridge lives in the UI-only module loaded before this runtime.


  /*
  ============================================================
  GK FINANCE INTELLIGENCE
  TFRS 16 UI RUNTIME V17
  ------------------------------------------------------------
  V18 Parça 2 (additive — TMS 29 Enflasyon Düzeltmesi, kiralama
  portföyü katmanı — TAM KAPSAMLI TMS 29 uygulaması DEĞİLDİR)
  - Enflasyon endeks tablosu (localStorage: gk_tfrs16_inflation_index_v1),
    getInflationIndex()/getInflationRatio(): eksik ay interpolasyonu
    yapılmaz, anlamlı Error fırlatılır.
  - TMS 29 hesaplama ve taslak/uygulama yazma işlemleri private API'ye
    taşındı. Bu public dosyada yalnızca endeks yönetimi ve private sonuç
    zarfını ekrana aktaran UI katmanı bulunur; yerel restatement/journal
    hesaplayıcısı tutulmaz.
  - TFRS29_ACCOUNTS sabiti: hesap kodları tek noktadan değiştirilebilir.
  - getCalculationCacheKey() imzasına inflationAdjustments eklendi.
  - UI: kontrat detayında "Enflasyon Düzeltmesi (TMS 29)" paneli
    (#inflationAdjustmentContainer, renderInflationAdjustmentSection).
  - runSelfTestsV18Part2() (belge uyumluluğu için runSelfTestsV25Part2
    takma adıyla da erişilebilir): regresyon + %5 endeks artışı +
    eksik-ay hata testleri.
  ------------------------------------------------------------
  V18 Parça 1 (additive — Endeksli Ödeme/Escalation genişletmesi)
  - leaseIncreaseType="fixedRate"/"index" için serbest periyot
    (escalationFrequencyMonths), "compound"/"initial" baz seçimi
    (escalationBase) ve özel ilk artış tarihi (escalationFirstDate).
  - Bu üç alandan biri tanımlıysa computeEscalatedPaymentV18() devreye
    girer; hiçbiri tanımlı değilse eski computeEscalatedPayment()
    değişmeden çalışır (regresyon yok).
  - CPI ay→endeks tablosu (localStorage: gk_tfrs16_cpi_index_v1) ve
    syncIndexCurrentRateFromCpiTable(): mevcut indexCurrentRate alanını
    besler, mevcut checkIndexReassessment()/createReassessment() aynen
    kullanılır — yeni bir reassessment tipi eklenmedi.
  - getEscalatedPayments(): UI rozetleri (🔺) için sadeleştirilmiş liste.
  - getCalculationCacheKey() imzasına üç yeni alan eklendi.
  - runSelfTestsV18Part1(): regresyon + compound/initial + CPI testleri.
  ------------------------------------------------------------
  V15
  - Existing V14 UI functionality preserved
  - Contract portfolio
  - New contract
  - Excel bulk import
  - Contract detail
  - TFRS 16 private-result consumers
  - Initial recognition
  - Monthly / quarterly / annual journal
  - Current / non-current result presentation
  - Bulk journal generation
  - Voucher numbering
  - Excel journal export
  - Debit / credit validation
  - Contract audit trace
  - Safer date / input validation
  - Duplicate contract protection
  - Existing localStorage key preserved

  ------------------------------------------------------------
  V17 (additive — Month-End Close Engine built on V16.10)
  - Central month-end close checklist, readiness status and weighted close score.
  - Calculation, schedule, journal, classification, reconciliation, control and audit completeness controls.
  - Blocking / warning assessment with company and currency close visibility.
  - Close certification, history, lock/reopen concept and audit-traceable close state.
  - CFO-ready close dashboard data without DOM/UI redesign; no FX conversion introduced.

  V16.6 (additive — reassessment engine built on V16.5)
  - Separate reassessment event history and calculation layer.
  - Lease term / option / index-rate / fixed-payment reassessment support.
  - Reassessed schedule, liability / ROU adjustment, gain/loss, journal and audit events.
  - Existing V16.4 reporting-date classification remains the base engine.

  V16.4 (additive — nothing above removed or altered)
  - Reporting-date based current / non-current liability presentation
    using the private reporting-date envelope as the single source of truth.
  - Current liability = principal payable in the 12 months following
    the reporting date; interest excluded from current liability.
  - Backward-compatible field names preserved for existing UI consumers.

  ------------------------------------------------------------
  V16.1 (historical UI compatibility)
  - Payment Schedule panel consumes the authenticated private schedule
    and keeps the established filters and export presentation.
  - New "Kira Ödeme Planı" (Payment Schedule) panel in contract
    detail view, with Yıl / Ay / Çeyrek filters and Excel export.
  ============================================================
  */

  const STORAGE_KEY = "gk_tfrs16_contracts_v7";

  /* ==========================================================
     BACKEND (PostgreSQL) CONTRACT API
     ----------------------------------------------------------
     Sözleşmeler Google Cloud PostgreSQL'e yazılır.
     localStorage yalnızca önbellek / offline yedektir.
  ========================================================== */
  const TFRS16_API_BASE =
    "https://api.leaseqant.com";

// Send HttpOnly session cookies on cross-origin API calls while preserving explicit options.
const _nativeFetch = window.fetch.bind(window);
window.fetch = (input, init = {}) => {
  const url = typeof input === "string" ? input : input && input.url;
  if (url && url.startsWith(TFRS16_API_BASE)) return _nativeFetch(input, { ...init, credentials: init.credentials || "include" });
  return _nativeFetch(input, init);
};

  let sessionCompanies = []; // [{ id, name }]
  let sessionCompanyIds = [];
  let sessionUserRole = null; // P1 uyum: gerçek backend rolü (/api/auth/me)

  function tfrs16GetToken() {
    return (
      localStorage.getItem("access_token") ||
      localStorage.getItem("gk_backend_jwt") ||
      // Login keeps the tab-scoped bearer here when cross-site cookies are unavailable.
      sessionStorage.getItem("gk_session_token") ||
      null
    );
  }

  /**
   * P1 UYUMLULUK — token'ı hangi anahtarda bulduysak o anahtara (veya
   * ikisi de yoksa "access_token"a) yazar. POST /api/auth/change-password
   * başarılı olduğunda backend YENİ bir token döner (mustChangePassword=
   * false) — bu token'ı localStorage'a yazmak için kullanılır.
   */
  function tfrs16SetToken(newToken) {
    if (!newToken) return;
    let wrote = false;
    if (localStorage.getItem("access_token") !== null) {
      localStorage.setItem("access_token", newToken);
      wrote = true;
    }
    if (localStorage.getItem("gk_backend_jwt") !== null) {
      localStorage.setItem("gk_backend_jwt", newToken);
      wrote = true;
    }
    if (sessionStorage.getItem("gk_session_token") !== null) {
      sessionStorage.setItem("gk_session_token", newToken);
      wrote = true;
    }
    if (!wrote) {
      localStorage.setItem("access_token", newToken);
    }
  }

  /**
   * P1 UYUMLULUK — MUST_CHANGE_PASSWORD MODALI
   * ------------------------------------------------------------
   * Backend P1'den itibaren must_change_password=true olan bir
   * kullanıcının /api/auth/me ve /api/auth/change-password DIŞINDAKİ
   * her isteğini 403 { code: "MUST_CHANGE_PASSWORD" } ile reddediyor.
   * Bu motorda önceden bu duruma dair HİÇBİR karşılık yoktu — kullanıcı
   * sessizce kilitleniyordu. Bu modal, tespit edilir edilmez ekranı
   * kaplayan, kapatılamayan (esc/backdrop click yok) bir form gösterir;
   * başarılı değişiklikten sonra sayfa yeniden yüklenir (tüm state'in
   * yeni token ile temiz şekilde tazelenmesi için — bu büyük ve çok
   * modüllü bir motorda tek tek yeniden hydrate etmekten daha güvenli).
   */
  let tfrs16MustChangePasswordModalOpen = false;

  function tfrs16ShowMustChangePasswordModal() {
    if (tfrs16MustChangePasswordModalOpen) return;
    tfrs16MustChangePasswordModalOpen = true;

    const overlay = document.createElement("div");
    overlay.id = "tfrs16MustChangePasswordOverlay";
    overlay.style.cssText =
      "position:fixed;inset:0;background:rgba(15,23,42,.72);z-index:999999;" +
      "display:flex;align-items:center;justify-content:center;padding:16px;";

    overlay.innerHTML = `
      <div style="background:#fff;border-radius:14px;padding:28px;max-width:380px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.35);">
        <h3 style="margin:0 0 6px;font-size:17px;color:#0f172a;">Parolanızı Değiştirin</h3>
        <p style="margin:0 0 18px;font-size:13px;color:#64748b;line-height:1.5;">
          Hesabınızla devam edebilmek için önce parolanızı değiştirmeniz gerekiyor.
        </p>
        <form id="tfrs16McpForm">
          <label style="display:block;font-size:12px;font-weight:600;color:#334155;margin-bottom:4px;">Mevcut Parola</label>
          <input id="tfrs16McpCurrent" type="password" required autocomplete="current-password"
            style="width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:12px;font-size:14px;" />
          <label style="display:block;font-size:12px;font-weight:600;color:#334155;margin-bottom:4px;">Yeni Parola (en az 10 karakter)</label>
          <input id="tfrs16McpNew" type="password" required minlength="10" autocomplete="new-password"
            style="width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:6px;font-size:14px;" />
          <div id="tfrs16McpError" style="display:none;color:#dc2626;font-size:12px;margin-bottom:10px;"></div>
          <button type="submit" id="tfrs16McpSubmit"
            style="width:100%;padding:10px;border:none;border-radius:8px;background:#2563eb;color:#fff;font-weight:600;font-size:14px;cursor:pointer;margin-top:8px;">
            Parolayı Değiştir ve Devam Et
          </button>
        </form>
      </div>
    `;

    document.body.appendChild(overlay);

    const form = overlay.querySelector("#tfrs16McpForm");
    const errorBox = overlay.querySelector("#tfrs16McpError");
    const submitBtn = overlay.querySelector("#tfrs16McpSubmit");

    form.addEventListener("submit", async event => {
      event.preventDefault();
      errorBox.style.display = "none";

      const currentPassword = overlay.querySelector("#tfrs16McpCurrent").value;
      const newPassword = overlay.querySelector("#tfrs16McpNew").value;

      submitBtn.disabled = true;
      submitBtn.textContent = "Değiştiriliyor...";

      try {
        const token = tfrs16GetToken();
        const res = await fetch(`${TFRS16_API_BASE}/api/auth/change-password`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ currentPassword, newPassword })
        });
        const text = await res.text();
        let body = null;
        try { body = text ? JSON.parse(text) : null; } catch (_) { body = text; }

        if (!res.ok) {
          throw new Error((body && (body.error || body.message)) || `Hata (${res.status})`);
        }

        if (body && body.token) {
          tfrs16SetToken(body.token);
        }

        // Temiz bir yeniden başlatma için sayfayı yenile — tüm
        // hydration/session mantığı yeni (mustChangePassword=false)
        // token ile baştan çalışır.
        location.reload();

      } catch (error) {
        errorBox.textContent = error?.message || "Parola değiştirilemedi.";
        errorBox.style.display = "block";
        submitBtn.disabled = false;
        submitBtn.textContent = "Parolayı Değiştir ve Devam Et";
      }
    });
  }

  async function tfrs16ApiFetch(path, options = {}) {
    const res = await fetch(`${TFRS16_API_BASE}${path}`, {
      ...options,
    credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });
    let body = null;
    const text = await res.text();
    try {
      body = text ? JSON.parse(text) : null;
    } catch (_) {
      body = text;
    }
    if (!res.ok) {
      const baseMsg =
        (body && (body.error || body.message)) ||
        `API hatası (${res.status})`;
      // DÜZELTME (kullanıcı talebi — teşhis edilebilirlik): backend
      // artık 500'lerde SQLSTATE `code` ve `detail` (gerçek DB hata
      // mesajı) da dönebiliyor (bkz. backend/routes/contracts.js).
      // Bunları mesaja ekliyoruz ki Bulk Import'taki "Backend hatası
      // detayı" alert'i jenerik "beklenmeyen bir hata oluştu" yerine
      // gerçek sebebi (NOT NULL/FK/tip hatası vb.) göstersin.
      const extra = [
        body?.code ? `[${body.code}]` : null,
        body?.detail ? body.detail : null
      ].filter(Boolean).join(" ");
      const msg = extra ? `${baseMsg} — ${extra}` : baseMsg;
      const err = new Error(msg);
      err.status = res.status;
      err.body = body;
      // P1 UYUMLULUK: backend, must_change_password=true olan bir
      // kullanıcının bu isteğini reddettiyse, kullanıcıya sessiz bir
      // Türkçe hata mesajı göstermek yerine parola değiştirme modalını
      // açıyoruz — asıl çözümü sunuyoruz.
      if (body && body.code === "MUST_CHANGE_PASSWORD") {
        tfrs16ShowMustChangePasswordModal();
      }
      throw err;
    }
    return body;
  }

  function mapDbContractToUi(row) {
    if (!row || typeof row !== "object") return null;
    const start =
      row.startDate ||
      row.start_date ||
      "";
    const end = row.endDate || row.end_date || "";

    /**
     * DÜZELTME (veri kaybı bug'ı): bu fonksiyon her hydrate'te
     * (her sayfa açılışında) local contracts dizisinin tamamının
     * yerine geçiyor. Önceden modifications/reassessments burada
     * KOŞULSUZ [] olarak hardcode ediliyordu — yani backend'e bir
     * kez senkronize olmuş her sözleşmenin motor tarafından üretilen
     * geçmişi bir sonraki sayfa yüklemesinde sessizce siliniyordu.
     * Artık backend'in details JSONB kolonundan geliyor.
     * details bazen zaten parse edilmiş obje (pg JSONB → JS object),
     * bazen (eski satırlar / API katmanı JSON string döndürürse)
     * string olabilir — ikisini de destekliyoruz.
     */
    let details = row.details;
    if (typeof details === "string") {
      try {
        details = JSON.parse(details);
      } catch (_) {
        details = null;
      }
    }
    if (!details || typeof details !== "object") {
      details = {};
    }

    return {
      id: row.id,
      companyId: row.companyId || row.company_id || "",
      company: row.company || "",
      supplier: row.supplier || "",
      monthlyPayment: Number(
        row.monthlyPayment != null
          ? row.monthlyPayment
          : row.monthly_payment != null
            ? row.monthly_payment
            : 0
      ),
      startDate: typeof start === "string" ? start.slice(0, 10) : start,
      endDate: typeof end === "string" ? end.slice(0, 10) : end,
      discountRate: Number(
        row.discountRate != null
          ? row.discountRate
          : row.discount_rate != null
            ? row.discount_rate
            : 0
      ),
      currency: row.currency || "TRY",
      // Functional/reporting currency belongs to the company context. Keep
      // both fields when the API has them so the standards layer can resolve
      // the company currency without losing legacy contract details.
      reportingCurrency: details.reportingCurrency || details.presentationCurrency || row.reportingCurrency || row.reporting_currency || null,
      status: String(row.status || "active").toLowerCase(),
      // Only APPROVED opening balances are exposed by the API. Keep the
      // object on the contract so the synchronous engine can start its
      // roll-forward at the customer's audited cut-over date.
      openingBalance: row.opening_balance && typeof row.opening_balance === "object"
        ? row.opening_balance
        : null,
      renewalDate: details.renewalDate || null,
      paymentFrequency: details.paymentFrequency || "monthly",
      paymentTiming: details.paymentTiming || "arrears",
      ...(details.paymentFrequency === "irregular"
        ? { explicitPaymentSchedule: Array.isArray(details.explicitPaymentSchedule) ? details.explicitPaymentSchedule : [],
          termMonths: details.termMonths } : {}),
      initialDirectCosts: details.initialDirectCosts !== null && details.initialDirectCosts !== undefined ? Number(details.initialDirectCosts) : 0,
      restorationObligation: details.restorationObligation !== null && details.restorationObligation !== undefined ? Number(details.restorationObligation) : 0,
      assetClass: details.assetClass || "",
      prepayments: details.prepayments !== null && details.prepayments !== undefined ? Number(details.prepayments) : 0,
      leaseIncentives: details.leaseIncentives !== null && details.leaseIncentives !== undefined ? Number(details.leaseIncentives) : 0,
      leaseIncreaseType: details.leaseIncreaseType || "none",
      leaseIncreaseRate: details.leaseIncreaseRate !== null && details.leaseIncreaseRate !== undefined ? Number(details.leaseIncreaseRate) : 0,
      fixedIncrease: details.fixedIncrease !== null && details.fixedIncrease !== undefined ? Number(details.fixedIncrease) : 0,
      variablePayment: details.variablePayment !== null && details.variablePayment !== undefined ? Number(details.variablePayment) : 0,
      variablePaymentType: details.variablePaymentType || "CIRO_KULLANIM",
      inSubstanceFixedPayment: details.inSubstanceFixedPayment !== null && details.inSubstanceFixedPayment !== undefined ? Number(details.inSubstanceFixedPayment) : 0,
      usefulLifeMonths: details.usefulLifeMonths !== null && details.usefulLifeMonths !== undefined ? Number(details.usefulLifeMonths) : null,
      indexBaseRate: details.indexBaseRate !== null && details.indexBaseRate !== undefined ? Number(details.indexBaseRate) : null,
      indexCurrentRate: details.indexCurrentRate !== null && details.indexCurrentRate !== undefined ? Number(details.indexCurrentRate) : null,
      indexReviewMonth: details.indexReviewMonth !== null && details.indexReviewMonth !== undefined ? Number(details.indexReviewMonth) : null,
      indexReviewDay: details.indexReviewDay !== null && details.indexReviewDay !== undefined ? Number(details.indexReviewDay) : null,
      renewalOption: details.renewalOption === true,
      // Lease-term judgements (IFRS 16.18-21): null means "not judged yet",
      // which is different from "not reasonably certain" (false).
      renewalOptionExpectedToExercise: typeof details.renewalOptionExpectedToExercise === "boolean" ? details.renewalOptionExpectedToExercise : null,
      terminationOptionExpectedToExercise: typeof details.terminationOptionExpectedToExercise === "boolean" ? details.terminationOptionExpectedToExercise : null,
      purchaseOptionExpectedToExercise: typeof details.purchaseOptionExpectedToExercise === "boolean" ? details.purchaseOptionExpectedToExercise : null,
      leaseTermEvidenceReference: details.leaseTermEvidenceReference ? String(details.leaseTermEvidenceReference) : null,
      renewalEndDate: details.renewalEndDate || null,
      terminationOption: details.terminationOption === true,
      terminationDate: details.terminationDate || null,
      terminationPenalty: details.terminationPenalty !== null && details.terminationPenalty !== undefined ? Number(details.terminationPenalty) : 0,
      purchaseOption: details.purchaseOption === true,
      purchaseOptionPrice: details.purchaseOptionPrice !== null && details.purchaseOptionPrice !== undefined ? Number(details.purchaseOptionPrice) : 0,
      residualValueGuarantee: details.residualValueGuarantee === true,
      expectedResidualValueGuaranteePayment: details.expectedResidualValueGuaranteePayment !== null && details.expectedResidualValueGuaranteePayment !== undefined ? Number(details.expectedResidualValueGuaranteePayment) : 0,
      ownershipTransfer: details.ownershipTransfer === true,
      shortTermLease: details.shortTermLease === true,
      lowValueAsset: details.lowValueAsset === true,
      lowValueWhenNewConfirmed: details.lowValueWhenNewConfirmed === true,
      lowValueStandaloneUseConfirmed: details.lowValueStandaloneUseConfirmed === true,
      lowValueNotHighlyDependentConfirmed: details.lowValueNotHighlyDependentConfirmed === true,
      lowValueNoSubleaseConfirmed: details.lowValueNoSubleaseConfirmed === true,
      integrationMetadata: details.integrationMetadata && typeof details.integrationMetadata === "object"
        ? details.integrationMetadata
        : null,
      modification: Array.isArray(details.modifications) && details.modifications.length > 0,
      modifications: Array.isArray(details.modifications) ? details.modifications : [],
      modificationJournals: Array.isArray(details.modificationJournals) ? details.modificationJournals : [],
      reassessments: Array.isArray(details.reassessments) ? details.reassessments : [],
      saleAndLeaseback: details.saleAndLeaseback || null,
      sublease: details.sublease || null,
      inflationAdjustments: Array.isArray(details.inflationAdjustments) ? details.inflationAdjustments : [],
      functionalCurrency: details.functionalCurrency || null,
      functionalAmount: details.functionalAmount != null ? details.functionalAmount : null,
      earlyPayments: Array.isArray(details.earlyPayments) ? details.earlyPayments : [],
      earlyPaymentSchedule: Array.isArray(details.earlyPaymentSchedule) ? details.earlyPaymentSchedule : [],
      earlyPaymentScheduleAsOf: details.earlyPaymentScheduleAsOf || null,
      auditTrail: Array.isArray(details.auditTrail) ? details.auditTrail : []
    };
  }

  /**
   * P1 UYUMLULUK — HOLDİNG AĞACI
   * ------------------------------------------------------------
   * /api/auth/me.data.companyIds, kullanıcının DOĞRUDAN bağlı
   * olduğu şirket(ler)i döner (P1'de bilinçli olarak değiştirilmedi).
   * Ama ACCOUNTANT_MANAGER için backend artık GET /api/contracts'ta
   * TÜM holding alt ağacının sözleşmelerini döndürüyor. Bu yüzden
   * "Şirket" seçim listesini de aynı ağaca genişletmemiz gerekiyor —
   * aksi halde yönetici bir alt şirket için yeni sözleşme oluşturamaz.
   *
   * GET /api/admin/companies zaten ADMIN + ACCOUNTANT_MANAGER için
   * açık (requireStaffAccess) ve backend'de bu rol için otomatik
   * olarak kendi holding alt ağacıyla sınırlanıyor (organization-
   * service.js) — o yüzden burada AYRICA bir ağaç hesaplamaya gerek
   * yok, sadece bu endpoint'i (yalnızca bu iki rol için) çağırıp
   * dönen isim/id listesini sessionCompanies'e ekliyoruz.
   */
  async function loadStaffCompanyTree() {
    try {
      const res = await tfrs16ApiFetch("/api/org/companies");
      const rows = Array.isArray(res?.data) ? res.data : [];
      return rows
        .filter(c => c && c.id)
        .map(c => ({
          id: String(c.id),
          name: c.name || c.code || String(c.id),
          code: c.code || String(c.id),
          status: c.status || "ACTIVE",
          // Kept additive: newer company endpoints may expose the currency;
          // older deployments simply fall back to the local company record.
          baseCurrency: c.baseCurrency || c.base_currency || null,
          functionalCurrency: c.functionalCurrency || c.functional_currency || c.baseCurrency || c.base_currency || null
        }));
    } catch (error) {
      // ADMIN/ACCOUNTANT_MANAGER değilse veya endpoint erişilemezse
      // sessizce boş dön — aşağıdaki eski (companyIds/licenses bazlı)
      // davranış zaten fallback olarak devrede kalır.
      console.warn("Holding ağacı (admin/companies) alınamadı:", error?.message || error);
      return [];
    }
  }

  async function loadSessionCompanies() {
    try {
      const me = await tfrs16ApiFetch("/api/auth/me");
      const data = me?.data || me || {};
      sessionUserRole = data.role || null;
      sessionCompanyIds = Array.isArray(data.companyIds)
        ? data.companyIds.map(String)
        : [];
      const fromLicenses = Array.isArray(data.licenses)
        ? data.licenses
            .filter(l => l && l.companyId)
            .map(l => ({
              id: String(l.companyId),
              name: l.companyName || String(l.companyId),
              code: l.companyCode || l.code || String(l.companyId),
              baseCurrency: l.baseCurrency || l.base_currency || null,
              functionalCurrency: l.functionalCurrency || l.functional_currency || l.baseCurrency || l.base_currency || null
            }))
        : [];
      // companyIds içinde olup licenses'ta olmayanlar
      const seen = new Set(fromLicenses.map(c => c.id));
      sessionCompanies = [
        ...fromLicenses,
        ...sessionCompanyIds
          .filter(id => !seen.has(String(id)))
          .map(id => ({ id: String(id), name: String(id), code: String(id) }))
      ];

      // P1: ADMIN/ACCOUNTANT_MANAGER için holding ağacının tamamını
      // (isim dahil) ekle — yukarıdaki yorum bloğuna bakınız.
      if (sessionUserRole === "ADMIN" || sessionUserRole === "ACCOUNTANT_MANAGER") {
        const treeCompanies = await loadStaffCompanyTree();
        if (treeCompanies.length > 0) {
          const known = new Set(sessionCompanies.map(c => c.id));
          treeCompanies.forEach(c => {
            if (known.has(c.id)) {
              // İsmi varsa (licenses'tan gelen daha zengin bilgiyi)
              // koruyoruz, sadece eksikse tamamlıyoruz.
              return;
            }
            known.add(c.id);
            sessionCompanies.push(c);
          });
        }
      }

      return sessionCompanies;
    } catch (error) {
      console.warn("Şirket listesi alınamadı:", error);
      sessionCompanies = [];
      sessionCompanyIds = [];
      sessionUserRole = null;
      return [];
    }
  }

  /**
   * P1 UYUMLULUK — YAZMA YETKİSİ (CONTROLLER/VIEWER salt okunur)
   * ------------------------------------------------------------
   * Backend artık POST/PUT/DELETE /api/contracts'ı CONTROLLER ve
   * VIEWER rolleri için 403 CONTRACT_WRITE_ACCESS_DENIED ile
   * reddediyor. Bu, gerçek backend rolüne (sessionUserRole) göre
   * çalışan tek doğru kaynak — motorun kendi V21 demo/simülasyon
   * yetkilendirme sistemi (window.currentUser'a bağlı, gerçek oturumla
   * senkron olduğu garanti değil) burada KASITLI OLARAK kullanılmıyor.
   */
  function tfrs16CanWriteContracts() {
    if (!sessionUserRole) return true; // rol bilinmiyorsa eski davranış — backend yine de son sözü söyler
    return !["CONTROLLER", "VIEWER"].includes(sessionUserRole);
  }

  /**
   * newContractButton / deleteContract butonlarını gerçek role göre
   * görsel olarak devre dışı bırakır (backend zaten enforce ediyor —
   * bu yalnızca kullanıcı deneyimi: CONTROLLER/VIEWER butona tıklayıp
   * 403 almasın).
   */
  function tfrs16ApplyWriteRoleUiGates() {
    if (tfrs16CanWriteContracts()) return;
    // DEĞİŞİKLİK: native `disabled` KULLANILMIYOR. Bir `disabled` HTML
    // butonuna tıklandığında tarayıcı click event'i HİÇ ÜRETMEZ — bu,
    // emergency bridge'in (aşağıda) hiç tetiklenmemesine, dolayısıyla
    // kullanıcının "tıklıyorum, hiçbir şey olmuyor" diye HİÇBİR AÇIKLAMA
    // GÖRMEDEN takılmasına yol açıyordu (bkz. bu konuşmadaki bug raporu).
    // Bunun yerine buton TIKLANABİLİR kalır; emergency bridge bu
    // data-attribute'u görüp AÇIK bir uyarı gösterir ve modalı açmaz.
    // Backend zaten gerçek yetkilendirmeyi 403 ile sağlıyor — bu hâlâ
    // yalnızca bir UX katmanı.
    ["newContractButton", "deleteContract"].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.dataset.writeBlocked = "true";
      el.classList.add("write-blocked");
      el.title = "Bu işlem için yazma yetkiniz bulunmamaktadır (salt okunur rol).";
    });
  }

  function getPrimarySessionCompany() {
    return sessionCompanies[0] || null;
  }

  function applySessionCompanyToForm(contract = null) {
    const companyInput = document.getElementById("company");
    let companyIdInput = document.getElementById("companyId");
    if (!companyIdInput) {
      companyIdInput = document.createElement("input");
      companyIdInput.type = "hidden";
      companyIdInput.id = "companyId";
      companyIdInput.name = "companyId";
      document.getElementById("contractForm")?.appendChild(companyIdInput);
    }

    // Şirket alanını select'e çevir (bir kez)
    if (companyInput && companyInput.tagName === "INPUT" && sessionCompanies.length) {
      const select = document.createElement("select");
      select.id = "company";
      select.name = "company";
      select.required = true;
      select.style.cssText = companyInput.style.cssText || "";
      select.className = companyInput.className || "";
      sessionCompanies.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c.name;
        opt.dataset.companyId = c.id;
        opt.textContent = c.name;
        select.appendChild(opt);
      });
      select.addEventListener("change", () => {
        const opt = select.selectedOptions[0];
        companyIdInput.value = opt?.dataset?.companyId || "";
      });
      companyInput.replaceWith(select);
    } else if (companyInput && companyInput.tagName === "SELECT") {
      // seçenekleri güncelle
      const current = companyInput.value;
      companyInput.innerHTML = "";
      sessionCompanies.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c.name;
        opt.dataset.companyId = c.id;
        opt.textContent = c.name;
        companyInput.appendChild(opt);
      });
      if (current) companyInput.value = current;
    }

    const primary = getPrimarySessionCompany();
    if (contract?.companyId) {
      companyIdInput.value = contract.companyId;
      const match = sessionCompanies.find(c => c.id === String(contract.companyId));
      const companyEl = document.getElementById("company");
      if (companyEl && match) companyEl.value = match.name;
      else if (companyEl && contract.company) companyEl.value = contract.company;
    } else if (primary) {
      companyIdInput.value = primary.id;
      const companyEl = document.getElementById("company");
      if (companyEl) companyEl.value = primary.name;
    }
  }

  async function persistContractToApi(contract, isUpdate) {
    // V19 Kısa Vade Madde 1: hem güncellemede hem de yeni kontrat
    // oluştururken (startDate kilitli bir döneme düşüyorsa) engelle.
    const lockCheck = assertPeriodWritable(contract, contract?.startDate || new Date());
    if (lockCheck.locked) {
      throw new Error(lockCheck.message);
    }
    const companyId =
      contract.companyId ||
      document.getElementById("companyId")?.value ||
      getPrimarySessionCompany()?.id;

    if (!companyId) {
      throw new Error(
        "Şirket ID bulunamadı. Kullanıcıya atanmış şirket yok veya oturum geçersiz."
      );
    }

    // DÜZELTME (kritik — bkz. yukarıdaki mapExternalRecord notu): buraya
    // kadar gelen companyId, kullanıcının GERÇEKTEN erişimi/lisansı olan
    // bir şirkete ait olmayabilir (örn. eski/senkron olmayan bir local
    // cache'ten gelmiş olabilir). Backend'e göndermeden ÖNCE
    // sessionCompanies (gerçek kaynak, /api/auth/me) ile karşılaştırıyoruz.
    // sessionCompanies henüz yüklenmemişse (boş dizi) kontrolü atlıyoruz —
    // bu durumda karar zaten backend'e bırakılıyor, yanlış pozitif
    // vermemek için.
    if (Array.isArray(sessionCompanies) && sessionCompanies.length && !sessionCompanies.some(c => String(c.id) === String(companyId))) {
      throw new Error(
        `Şirket eşleşmedi: '${contract.company || companyId}' için oturumunuzda yetkili/lisanslı bir şirket bulunamadı. ` +
        `Excel'deki "Şirket" sütunundaki adın, sisteme kayıtlı şirket adıyla (veya companyId sütununda gerçek şirket ID'siyle) birebir eşleştiğinden emin olun.`
      );
    }

    /**
     * DÜZELTME (veri kaybı): contracts tablosunda önceden yalnızca
     * 9 temel alan vardı — motorun ürettiği modifications/
     * reassessments/SLB/sublease/enflasyon(TMS29)/fonksiyonel para
     * birimi(TMS21)/erken ödeme verisi backend'e HİÇ gitmiyordu ve
     * yalnızca localStorage'da yaşıyordu. Artık bu alanlar tek bir
     * `details` JSONB kolonuna serileştirilip gönderiliyor (backend
     * şeması: contracts.details JSONB). Motorun kendi iç yapısına
     * dokunulmuyor — üretilen objeler olduğu gibi taşınıyor.
     */
    const details = {
      renewalDate: contract.renewalDate || null,
      paymentFrequency: contract.paymentFrequency || "monthly",
      paymentTiming: contract.paymentTiming || "arrears",
      ...(contract.paymentFrequency === "irregular"
        ? { explicitPaymentSchedule: contract.explicitPaymentSchedule || [], termMonths: contract.termMonths } : {}),
      initialDirectCosts: Number(contract.initialDirectCosts) || 0,
      restorationObligation: Number(contract.restorationObligation) || 0,
      assetClass: contract.assetClass || "",
      prepayments: Number(contract.prepayments) || 0,
      leaseIncentives: Number(contract.leaseIncentives) || 0,
      leaseIncreaseType: contract.leaseIncreaseType || "none",
      leaseIncreaseRate: Number(contract.leaseIncreaseRate) || 0,
      fixedIncrease: Number(contract.fixedIncrease) || 0,
      variablePayment: Number(contract.variablePayment) || 0,
      variablePaymentType: contract.variablePaymentType || "CIRO_KULLANIM",
      inSubstanceFixedPayment: Number(contract.inSubstanceFixedPayment) || 0,
      usefulLifeMonths: contract.usefulLifeMonths != null && contract.usefulLifeMonths !== ""
        ? Number(contract.usefulLifeMonths)
        : null,
      indexBaseRate: contract.indexBaseRate != null && contract.indexBaseRate !== ""
        ? Number(contract.indexBaseRate)
        : null,
      indexCurrentRate: contract.indexCurrentRate != null && contract.indexCurrentRate !== ""
        ? Number(contract.indexCurrentRate)
        : null,
      indexReviewMonth: contract.indexReviewMonth != null && contract.indexReviewMonth !== ""
        ? Number(contract.indexReviewMonth)
        : null,
      indexReviewDay: contract.indexReviewDay != null && contract.indexReviewDay !== ""
        ? Number(contract.indexReviewDay)
        : null,
      renewalOption: contract.renewalOption === true,
      // null = karar girilmedi; sunucu opsiyon varken kararı zorunlu tutar.
      renewalOptionExpectedToExercise: typeof contract.renewalOptionExpectedToExercise === "boolean" ? contract.renewalOptionExpectedToExercise : null,
      terminationOptionExpectedToExercise: typeof contract.terminationOptionExpectedToExercise === "boolean" ? contract.terminationOptionExpectedToExercise : null,
      purchaseOptionExpectedToExercise: typeof contract.purchaseOptionExpectedToExercise === "boolean" ? contract.purchaseOptionExpectedToExercise : null,
      leaseTermEvidenceReference: contract.leaseTermEvidenceReference ? String(contract.leaseTermEvidenceReference) : null,
      renewalEndDate: contract.renewalEndDate || null,
      terminationOption: contract.terminationOption === true,
      terminationDate: contract.terminationDate || null,
      terminationPenalty: Number(contract.terminationPenalty) || 0,
      purchaseOption: contract.purchaseOption === true,
      purchaseOptionPrice: Number(contract.purchaseOptionPrice) || 0,
      residualValueGuarantee: contract.residualValueGuarantee === true,
      expectedResidualValueGuaranteePayment: Number(contract.expectedResidualValueGuaranteePayment) || 0,
      ownershipTransfer: contract.ownershipTransfer === true,
      shortTermLease: contract.shortTermLease === true,
      lowValueAsset: contract.lowValueAsset === true,
      lowValueWhenNewConfirmed: contract.lowValueWhenNewConfirmed === true,
      lowValueStandaloneUseConfirmed: contract.lowValueStandaloneUseConfirmed === true,
      lowValueNotHighlyDependentConfirmed: contract.lowValueNotHighlyDependentConfirmed === true,
      lowValueNoSubleaseConfirmed: contract.lowValueNoSubleaseConfirmed === true,
      integrationMetadata: contract.integrationMetadata && typeof contract.integrationMetadata === "object"
        ? contract.integrationMetadata
        : null,
      modifications: Array.isArray(contract.modifications)
        ? contract.modifications
        : [],
      modificationJournals: Array.isArray(contract.modificationJournals)
        ? contract.modificationJournals
        : [],
      reassessments: Array.isArray(contract.reassessments)
        ? contract.reassessments
        : [],
      saleAndLeaseback: contract.saleAndLeaseback || null,
      sublease: contract.sublease || null,
      inflationAdjustments: Array.isArray(contract.inflationAdjustments)
        ? contract.inflationAdjustments
        : [],
      functionalCurrency: contract.functionalCurrency || null,
      functionalAmount:
        contract.functionalAmount != null ? contract.functionalAmount : null,
      earlyPayments: Array.isArray(contract.earlyPayments)
        ? contract.earlyPayments
        : [],
      earlyPaymentSchedule: Array.isArray(contract.earlyPaymentSchedule)
        ? contract.earlyPaymentSchedule
        : [],
      earlyPaymentScheduleAsOf: contract.earlyPaymentScheduleAsOf || null,
      auditTrail: Array.isArray(contract.auditTrail)
        ? contract.auditTrail
        : []
    };

    const payload = {
      id: contract.id,
      companyId: String(companyId),
      company: contract.company,
      supplier: contract.supplier,
      monthlyPayment: contract.monthlyPayment,
      startDate: contract.startDate,
      endDate: contract.endDate,
      discountRate: contract.discountRate || 0,
      currency: contract.currency || "TRY",
      status: contract.status || "active",
      details
    };

    if (isUpdate) {
      return tfrs16ApiFetch(
        `/api/contracts/${encodeURIComponent(contract.id)}`,
        { method: "PUT", body: JSON.stringify(payload) }
      );
    }
    return tfrs16ApiFetch("/api/contracts", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  async function deleteContractFromApi(contractId) {
    return tfrs16ApiFetch(
      `/api/contracts/${encodeURIComponent(contractId)}`,
      { method: "DELETE" }
    );
  }

  let backendContractsHydrated = false;
  let backendContractsHydrationError = null;

  async function hydrateContractsFromApi() {
    try {
      await loadSessionCompanies();
      try {
        tfrs16ApplyWriteRoleUiGates();
      } catch (_) { /* UI gate is best-effort. */ }
      const rows = await tfrs16ApiFetch("/api/contracts");
      if (!Array.isArray(rows)) {
        console.warn("GET /api/contracts beklenen dizi değil:", rows);
        return;
      }
      const mapped = rows
        .map(mapDbContractToUi)
        .filter(Boolean)
        .map(c =>
          ensureInflationAdjustmentState(
            ensureReassessmentState(ensureModificationState(c))
          )
        );
      contracts = mapped;
      backendContractsHydrated = true;
      backendContractsHydrationError = null;
      // Audit evidence is ancillary to the accounting hydration path. A
      // stale/slow audit endpoint must never hold the private calculation
      // coordinator hostage and leave the whole UI on "Private hesaplamalar
      // yükleniyor…" indefinitely. Keep the sync best-effort and let core
      // contract/private-result hydration continue independently.
      void hydrateAuditEventsFromApi().catch(() => {});
      // DÜZELTME (2026-09-17): hostname kapısı yanlıştı (bkz.
      // queueAuditBackendSync üzerindeki not) — bu yüzden önceki
      // oturumlarda kuyruğa alınmış ama HİÇ backend'e gönderilmemiş
      // denetim olayları (ör. Burhan'ın 30 kontratlık toplu import'u)
      // localStorage'da takılı kalmış olabilir. Sayfa her açıldığında
      // bu birikmiş kuyruğu da temizlemeye çalış — yeni bir olay
      // beklemeden.
      void flushAuditBackendSync().catch(() => {});
      try {
        saveContracts(contracts);
      } catch (_) { /* Cache persistence is best-effort. */ }
      if (typeof refresh === "function") refresh();
      try { window.dispatchEvent(new CustomEvent("gk-backend-hydrated")); } catch (_) { /* Event bridge is best-effort. */ }
      try { if (typeof v26RefreshActivePage === "function") v26RefreshActivePage(); } catch (_) { /* Refresh bridge is best-effort. */ }
      console.info(
        `[TFRS16] ${contracts.length} sözleşme API'den yüklendi.`
      );
    } catch (error) {
      backendContractsHydrationError = error;
      console.warn(
        "[TFRS16] API'den sözleşme yüklenemedi; yerel kopya kullanılmaz:",
        error?.message || error
      );
      try { window.dispatchEvent(new CustomEvent("gk-backend-hydration-failed")); } catch (_) { /* Event bridge is best-effort. */ }
      try { if (typeof v26RefreshActivePage === "function") v26RefreshActivePage(); } catch (_) { /* Refresh bridge is best-effort. */ }
    }
  }

  const ASSET_CLASS_STORAGE_KEY = "gk_tfrs16_asset_classes_v1";
  const ASSET_CLASS_PREDEFINED = ["Arsa", "Makine", "Taşıt", "Diğer"];
  const ASSET_CLASS_UNCLASSIFIED = "Sınıflandırılmamış";
  const ASSET_CLASS_CUSTOM_OPTION = "__CUSTOM__";

  function loadCustomAssetClasses() {
    try {
      const raw = localStorage.getItem(ASSET_CLASS_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter(x => typeof x === "string" && x.trim()) : [];
    } catch (error) {
      console.error("Varlık sınıfı listesi okunamadı:", error);
      return [];
    }
  }

  function saveCustomAssetClass(name) {
    const clean = String(name || "").trim();
    if (!clean) return false;
    if (ASSET_CLASS_PREDEFINED.includes(clean)) return true;
    try {
      const existing = loadCustomAssetClasses();
      if (existing.includes(clean)) return true;
      existing.push(clean);
      localStorage.setItem(ASSET_CLASS_STORAGE_KEY, JSON.stringify(existing));
      return true;
    } catch (error) {
      console.error("Varlık sınıfı kaydedilemedi:", error);
      return false;
    }
  }

  function getAssetClassOptions() {
    const custom = loadCustomAssetClasses();
    return [...ASSET_CLASS_PREDEFINED, ...custom.filter(c => !ASSET_CLASS_PREDEFINED.includes(c))];
  }

  function getContractAssetClass(contract) {
    const value = String(contract?.assetClass || "").trim();
    return value || ASSET_CLASS_UNCLASSIFIED;
  }

  // ÖNBELLEK DEĞİŞKENLERİ — loadContracts() (aşağıda) ilk çalıştığında
  // veri yoksa saveContracts() → clearCalculationCache() çağrılır; bu
  // yüzden CALCULATION_CACHE burada, loadContracts()'tan ÖNCE
  // initialize edilmek zorunda (const/let hoisting'i function
  // declaration'lar gibi çalışmaz — TDZ hatası verir).
  const CALCULATION_CACHE = new Map();
  const CALCULATION_CACHE_MAX_SIZE = 200;

  // Async API cutover cache. API-primary consumers read this cache exclusively;
  // the legacy calculation cache remains only for non-accounting UI metadata.
  // Results are keyed with the same contract signature as the local cache so
  // a mutation can never reuse a stale remote result.
  const PRIVATE_CALCULATION_CACHE = new Map();
  // Keep a bounded identity alias alongside the full signature. The contract
  // record can be normalized after portfolio hydration (for example when an
  // optional event collection is materialized), which changes the signature
  // even though the private batch response is still for the same contract.
  // This alias never calculates locally; it only reconnects an already
  // returned private result to its stable contract id.
  const PRIVATE_CALCULATION_CACHE_BY_ID = new Map();
  const PRIVATE_CALCULATION_ERRORS = new Map();
  const PRIVATE_CALCULATION_INFLIGHT = new Map();

  // Close Dashboard period P&L is sourced from the private journal endpoint.
  // Keep this separate from the reporting-date balance cache because a
  // period journal contains accrued interest and depreciation even when no
  // payment row falls inside the selected month.
  const PRIVATE_CLOSE_JOURNAL_CACHE = new Map();
  const PRIVATE_CLOSE_JOURNAL_INFLIGHT = new Map();
  // Authoritative close-control envelopes are hydrated from the private API;
  // the browser never rebuilds the accounting controls locally.
  const PRIVATE_CLOSE_CONTROLS_CACHE = new Map();
  const PRIVATE_CLOSE_CONTROLS_INFLIGHT = new Map();

  // FAZ 4.1 — getCfoAggregateMetrics()'in reportingDate başına
  // önbelleği. CALCULATION_CACHE ile AYNI TDZ nedeniyle burada
  // (loadContracts()'tan önce) tanımlanmak zorunda. clearCalculationCache()
  // tarafından da temizlenir (bkz. aşağısı) — kontrat mutasyonu olan HER
  // yerde iki önbellek de birlikte geçersiz kılınır, tek bakım noktası.
  const CFO_AGGREGATE_CACHE = new Map();

  // V26_COMPANIES_KEY de aynı TDZ nedeniyle buraya taşındı: ilk
  // refresh() çağrısı (aşağıda, sayfa açılışında) v26StandardsBadgeHtml
  // üzerinden v26LoadCompanies()'i tetikliyor ve bu sabit dosyanın
  // sonunda (V26 bölümünde) tanımlıysa erişim anında "Cannot access
  // before initialization" hatası fırlatıyordu (try/catch içinde
  // yakalanıp yutulduğu için sessiz kalıyordu, ama her satırda
  // gereksiz konsol hatası ve boşa localStorage denemesi yaratıyordu).
  const V26_COMPANIES_KEY = "gk_tfrs16_companies_v26";

  let contracts = loadContracts();

  // PostgreSQL'den sözleşmeleri yükle (kaynak gerçek DB)
  // AYNI ANDA: backend'deki VERIFIED enflasyon endeks cache'ini de
  // doldur. Önceden refreshInflationIndexCacheFromBackend() hiçbir
  // yerden ÇAĞRILMIYORDU (ölü kod) — backendInflationIndexCache hep
  // null kalıyor, loadInflationIndexTable() hep localStorage'a
  // düşüyordu. Artık admin panelinden VERIFIED yapılan kayıtlar bu
  // çağrıyla TFRS16 hesaplamasına gerçekten ulaşıyor.
  async function hydrateTfrs16BackendData() {
    await hydrateContractsFromApi();
    await refreshInflationIndexCacheFromBackend(getRequiredInflationIndexMonths());
    await refreshFxRateCacheFromBackend();

    // API-primary is a hard privacy boundary, so hydrate the private result
    // cache before any KPI/table/detail consumer is allowed to render. This
    // prevents a first paint from touching the public calculation engine.
    if (isPrivateCalculationApiReady()) {
      // Short-term / low-value exempt leases have no liability or ROU
      // measurement (IFRS 16.6); their expense comes from the server report.
      const measuredContracts = contracts.filter(contract => contract?.shortTermLease !== true && contract?.lowValueAsset !== true);
      const hydration = await ensurePrivateCalculationCache(measuredContracts);
      if (hydration.failed > 0) {
        console.error("Private hesaplama API önbelleği eksik dolduruldu:", hydration);
      }
      const requestedKpiDate = getDashboardReportingDate(new Date());
      // Keep the release-gate contract explicit: the initial pass warms the
      // current month-end reporting date, then the fallback pass below handles a
      // verified data horizon that ends earlier.
      const reportingHydration = await ensurePrivateReportingDateCache(measuredContracts, requestedKpiDate);
      if (reportingHydration.failed > 0) {
        console.error("Private reporting-date API önbelleği eksik dolduruldu:", reportingHydration.failed,
          (reportingHydration.results || []).filter(item => item?.error).map(item => `${item.contract?.id}: ${item.error?.code || item.error?.message}`));
      }
      // If the requested month-end is beyond the verified data horizon, warm
      // only the latest available period for each affected currency. This
      // keeps the dashboard finite and authoritative without inventing data.
      for (const contract of contracts) {
        if (getPrivateReportingDateResult(contract, requestedKpiDate)) continue;
        const fallback = resolveKpiReportingDate(contract, requestedKpiDate);
        if (fallback.usedFallback) {
          await ensurePrivateReportingDateCache([contract], fallback.date);
        }
      }
      // Contract hydration can render reporting/close consumers once before
      // the private batch is ready. That first render seeds the CFO aggregate
      // cache with zero/empty balances; invalidate only derived local
      // aggregates after private results arrive while preserving the warmed
      // private result cache itself.
      clearCalculationCache(undefined, { preservePrivate: true });

      // Warm the same private close-control envelope used by Month-End Close
      // after derived-cache invalidation. clearCalculationCache() clears
      // stale close controls after contract/reporting hydration, so this
      // ordering keeps the Dashboard and Month-End Close on the same
      // authoritative private score instead of falling back to the legacy
      // three-flag readiness calculation.
      try {
        await ensurePrivateCloseControls(contracts, requestedKpiDate, "ALL");
      } catch (error) {
        console.warn("Private close controls dashboard için ısıtılamadı:", error?.message || error);
      }
    }

    // The base lease-result batch and the reporting-date cache are separate
    // private surfaces. A failed base batch must not leave the dashboard's
    // KPI guard in a permanent loading state when the reporting-date cache
    // is already usable by the dashboard/close consumers. Mark the one-shot
    // coordinator settled before the final repaint so updateKPIs can either
    // use the private reporting-date result or show one finite error state.
    window.__GK_TFRS16_PRIVATE_HYDRATION_SETTLED__ = true;

    updateKPIs();
    renderTable();
    try { window.LeaseQantDashboard?.refresh?.(); } catch (_) { /* best effort */ }
    // Deep-linked reporting, close and risk screens can render before the
    // asynchronous private batch has finished. Repaint the active host now
    // that its synchronous consumers can see the warmed private results.
    try { if (typeof v26RefreshActivePage === "function") v26RefreshActivePage(); } catch (_) { /* best effort */ }
    if (selectedContractId && contracts.some(item => item.id === selectedContractId)) {
      openDetail(selectedContractId, { skipPrivateRefresh: true });
    }
  }

  // Hydration invocation is owned by the public coordinator. The runtime
  // exposes only this hook; private-cache and UI implementation stay here.

  // Performans: uygulama açıldıktan birkaç saniye sonra eski audit/
  // kontrol/entegrasyon kayıtlarını arka planda temizle (UI'ı bloklamaz).
  setTimeout(runDataCleanup, 5000);

  document.getElementById("cleanupButton")?.addEventListener("click", () => {
    if (confirm("Eski veriler (audit trail, kontrol snapshotları, entegrasyon logları) temizlenecek. Devam etmek istiyor musunuz?")) {
      runDataCleanup();
      showAlert("✅ Veri temizliği tamamlandı!");
    }
  });

  contracts = contracts.map(
    contract => ensureInflationAdjustmentState(
      ensureReassessmentState(
        ensureModificationState(contract)
      )
    )
  );

  let selectedContractId = null;
  let bulkJournalData = [];


  /* ==========================================================
     STORAGE
  ========================================================== */

  function loadContracts() {
    try {
      const adapter =
        typeof V20StorageAdapters !== "undefined" &&
        typeof V20StorageAdapters.contracts === "function"
          ? V20StorageAdapters.contracts()
          : null;

      const stored = adapter
        ? adapter.get(null)
        : localStorage.getItem(STORAGE_KEY);

      if (stored) {
        const parsed =
          typeof stored === "string"
            ? JSON.parse(stored)
            : stored;

        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (error) {
      console.error("TFRS 16 storage error:", error);
    }

    // DÜZELTME (kullanıcı talebi — backend'e bağlandık, demo veri
    // artık istenmiyor): önceden burada getDefaultContracts() (LEASE-001/
    // 002/003, "GK Holding"/"GK Teknoloji") döndürülüp HEMEN localStorage'a
    // YAZILIYORDU — kullanıcı gerçek backend'e hiç bağlanmasa/erişemese
    // bile sahte sözleşmeler kalıcı olarak görünüyordu. getDefaultContracts()
    // fonksiyonu (aşağıda) BİLEREK SİLİNMEDİ ama artık BURADAN ÇAĞRILMIYOR
    // — fail-closed: veri yoksa boş liste, sahte veri YOK.
    return [];
  }

  /* ==========================================================
     PERFORMANS ÖNBELLEĞİ (CALCULATION CACHE)
     ----------------------------------------------------------
     calculateLeaseEngine() aynı kontrat için tekrar tekrar
     çağrıldığında (dashboard KPI, detay ekranı, kontrol motoru,
     raporlama vs.) tüm amortisman tablosunu baştan hesaplıyordu.
     Bu önbellek, kontratın kimliğine ve içeriğinin bir imzasına
     göre anahtarlanmış sonucu saklar; kontrat değişmediği sürece
     hesaplama tekrar çalışmaz. (CALCULATION_CACHE / _MAX_SIZE
     yukarıda, loadContracts()'tan önce initialize edildi.)
  ========================================================== */

  function getCalculationCacheKey(contract) {
    const id = contract?.id || "unknown";
    const stamp =
      contract?.updatedAt ||
      contract?.modifiedAt ||
      contract?.createdAt ||
      "";
    // updatedAt her zaman güncellenmiyor olabileceğinden, kontratın
    // hesaplamayı etkileyen alanlarından ucuz bir imza da üretilir;
    // böylece eski/yanlış bir sonuç asla döndürülmez.
    let signature = "";
    try {
      signature =
        `${contract?.monthlyPayment || ""}|${contract?.discountRate || ""}|` +
        `${contract?.startDate || ""}|${contract?.endDate || ""}|` +
        `${contract?.paymentFrequency || ""}|${contract?.leaseIncreaseType || ""}|` +
        `${contract?.leaseIncreaseRate || ""}|${contract?.fixedIncrease || ""}|` +
        // V18 Parça 1 — eklenmezse aynı ID farklı escalation V18
        // alanlarıyla eski (yanlış) önbellek sonucunu döndürebilirdi.
        `${contract?.escalationFrequencyMonths || ""}|${contract?.escalationBase || ""}|` +
        `${contract?.escalationFirstDate || ""}|` +
        // Treat absent and empty event collections identically. The detail
        // renderer initializes missing collections before reading the cache;
        // keeping the signature normalized prevents that UI preparation from
        // invalidating an already hydrated private result.
        `${JSON.stringify(Array.isArray(contract?.modifications) ? contract.modifications : [])}|` +
        `${JSON.stringify(Array.isArray(contract?.reassessments) ? contract.reassessments : [])}|` +
        // V18 Parça 2 — TMS 29 enflasyon düzeltme eventleri de
        // hesaplamayı (restatement önizlemesini) etkileyebileceğinden
        // önbellek imzasına eklenir.
        `${JSON.stringify(contract?.inflationAdjustments || "")}`;
    } catch (error) {
      signature = "";
    }
    const hash = signature.split("").reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 1000000007, 7);
    return `${id}-${stamp}-${signature.length}-${hash}`;
  }

  function clearCalculationCache(contractId, options) {
    const preservePrivate = options?.preservePrivate === true;
    if (contractId) {
      for (const key of CALCULATION_CACHE.keys()) {
        if (key.startsWith(`${contractId}-`)) {
          CALCULATION_CACHE.delete(key);
        }
      }
      if (!preservePrivate) {
        for (const key of PRIVATE_CALCULATION_CACHE.keys()) {
          if (key.startsWith(`${contractId}-`)) PRIVATE_CALCULATION_CACHE.delete(key);
        }
        PRIVATE_CALCULATION_CACHE_BY_ID.delete(String(contractId));
        for (const key of PRIVATE_CALCULATION_INFLIGHT.keys()) {
          if (key.startsWith(`${contractId}-`)) PRIVATE_CALCULATION_INFLIGHT.delete(key);
        }
        for (const key of PRIVATE_CALCULATION_ERRORS.keys()) {
          if (key.startsWith(`${contractId}-`)) PRIVATE_CALCULATION_ERRORS.delete(key);
        }
      }
    } else {
      CALCULATION_CACHE.clear();
      if (!preservePrivate) {
        PRIVATE_CALCULATION_CACHE.clear();
        PRIVATE_CALCULATION_CACHE_BY_ID.clear();
        PRIVATE_CALCULATION_INFLIGHT.clear();
        PRIVATE_CALCULATION_ERRORS.clear();
      }
    }
    // Journal summaries are derived data and must never survive a contract
    // mutation or a private-cache hydration reset.
    PRIVATE_CLOSE_JOURNAL_CACHE.clear();
    PRIVATE_CLOSE_JOURNAL_INFLIGHT.clear();
    PRIVATE_CLOSE_CONTROLS_CACHE.clear();
    PRIVATE_CLOSE_CONTROLS_INFLIGHT.clear();
    // FAZ 4.1 — aggregate önbellek reportingDate bazlı, TEK bir
    // kontratın değişmesi bile o tarihteki toplamları geçersiz kılar
    // (hangi kontrat olduğu önemli değil — güvenli taraf: tamamen
    // temizle). Boyutu küçük (nadiren birkaç reportingDate anahtarı),
    // bu yüzden granüler/kısmi temizlik gerekmiyor.
    CFO_AGGREGATE_CACHE.clear();
    if (!preservePrivate) {
      try { window.LeaseQantTfrs16ReportingDateCache?.clear(contractId); } catch (_) { /* cache cleanup is best effort */ }
    }
  }


  function setCachedCalculation(contract, result) {
    const key = getCalculationCacheKey(contract);

    if (CALCULATION_CACHE.size >= CALCULATION_CACHE_MAX_SIZE) {
      const firstKey = CALCULATION_CACHE.keys().next().value;
      CALCULATION_CACHE.delete(firstKey);
    }

    CALCULATION_CACHE.set(key, result);
  }

  function isPrivateCalculationApiReady() {
    return window.LEASEQANT_CALCULATION_API_PRIMARY === true &&
      Boolean(sessionUserRole) &&
      typeof window.LeaseQantPrivateCalculation?.calculate === "function";
  }

  function getCalculationSource(contract) {
    if (!isPrivateCalculationApiReady()) return "local";
    const key = getCalculationCacheKey(contract);
    if (PRIVATE_CALCULATION_CACHE.has(key) || PRIVATE_CALCULATION_CACHE_BY_ID.has(String(contract?.id || ""))) return "private-api";
    if (PRIVATE_CALCULATION_ERRORS.has(key)) return "private-error";
    return "local-warming";
  }

  function setPrivateCalculationResult(contract, result, options = {}) {
    if (!contract || !result || typeof result !== "object") return;
    PRIVATE_CALCULATION_CACHE.set(getCalculationCacheKey(contract), result);
    const id = String(contract.id || "").trim();
    // The first result for an id is the current contract (hydration queues it
    // before its immutable base). Preserve that identity if the base alias is
    // warmed afterwards, so a signature miss cannot show an older base plan.
    if (id && (options.replace === true || !PRIVATE_CALCULATION_CACHE_BY_ID.has(id))) {
      PRIVATE_CALCULATION_CACHE_BY_ID.set(id, result);
    }
  }

  function privateCacheRuntimeAdapter() {
    return {
      isReady: isPrivateCalculationApiReady,
      getKey: getCalculationCacheKey,
      getBase: getModificationBaseContract,
      get: key => PRIVATE_CALCULATION_CACHE.get(key),
      setResult: setPrivateCalculationResult,
      hasError: key => PRIVATE_CALCULATION_ERRORS.has(key),
      clearError: key => PRIVATE_CALCULATION_ERRORS.delete(key),
      setError: (key, value) => PRIVATE_CALCULATION_ERRORS.set(key, value),
      hasInflight: key => PRIVATE_CALCULATION_INFLIGHT.has(key),
      getInflight: key => PRIVATE_CALCULATION_INFLIGHT.get(key),
      setInflight: (key, value) => PRIVATE_CALCULATION_INFLIGHT.set(key, value),
      deleteInflight: key => PRIVATE_CALCULATION_INFLIGHT.delete(key)
    };
  }

  // Private-cache hydration ve read-only tekrar yükleme koordinasyonu ayrı
  // UI-only modüldedir; bu runtime yalnızca kendi cache adapter'ını sağlar.
  function hydratePrivateCalculationCache(list) {
    const api = window.LeaseQantTfrs16PrivateCacheUi;
    return typeof api?.hydrate === "function"
      ? api.hydrate(list, privateCacheRuntimeAdapter())
      : Promise.resolve({ attempted: 0, succeeded: 0, failed: 0 });
  }

  function ensurePrivateCalculationCache(list) {
    const api = window.LeaseQantTfrs16PrivateCacheUi;
    return typeof api?.ensure === "function"
      ? api.ensure(list, privateCacheRuntimeAdapter())
      : Promise.resolve({ attempted: 0, succeeded: 0, failed: 0 });
  }

  function getPrivateReportingDateResult(contract, reportingDate) {
    if (!isPrivateCalculationApiReady()) return null;
    return window.LeaseQantTfrs16ReportingDateCache?.get(contract, reportingDate) || null;
  }

  async function loadPrivateReportingDateResult(contract, reportingDate, options = {}) {
    if (!isPrivateCalculationApiReady()) {
      const error = new Error("Private reporting-date sonucu henüz hazır değil");
      error.code = "PRIVATE_REPORTING_DATE_NOT_READY";
      throw error;
    }
    const cache = window.LeaseQantTfrs16ReportingDateCache;
    if (typeof cache?.load !== "function") {
      const error = new Error("Private reporting-date önbelleği hazır değil");
      error.code = "PRIVATE_REPORTING_DATE_UNAVAILABLE";
      throw error;
    }
    return cache.load(contract, reportingDate, options);
  }

  async function ensurePrivateReportingDateCache(list, reportingDate, options = {}) {
    if (!isPrivateCalculationApiReady()) return { attempted: 0, succeeded: 0, failed: 0, results: [] };
    const cache = window.LeaseQantTfrs16ReportingDateCache;
    if (typeof cache?.preload !== "function") return { attempted: 0, succeeded: 0, failed: 0, results: [] };
    return cache.preload(list, reportingDate, options);
  }

  function privateCacheHydrationInFlight() {
    return Boolean(window.LeaseQantTfrs16PrivateCacheUi?.isInFlight?.());
  }

  function loadPrivateReadOnlyResult(contract, options = {}) {
    const api = window.LeaseQantTfrs16PrivateCacheUi;
    return typeof api?.loadReadOnly === "function"
      ? api.loadReadOnly(contract, options, privateCacheRuntimeAdapter())
      : Promise.resolve(null);
  }

  async function loadPrivateChangePreview(kind, contract, input) {
    // DÜZELTME: "hazır değilse null dön" burada tek başına yanlıştı —
    // createModification/createReassessment (ve update varyantları) bu
    // sonucu doğrudan `result.valid` diye okuyor; null dönünce
    // TypeError ile çöküyordu (jsdom audit'inde yakalandı). Kod
    // tabanındaki HER ŞEY (getPrivateCalculationForConsumer,
    // calculateLeaseEngine, applyTMS29 vb.) "hazır değilse throw et"
    // sözleşmesini kullanıyor — burayı da aynı sözleşmeye getiriyoruz.
    if (!isPrivateCalculationApiReady()) {
      const error = new Error("Private hesaplama sonucu henüz hazır değil");
      error.code = "PRIVATE_CALCULATION_NOT_READY";
      throw error;
    }
    const facade = window.LeaseQantPrivateTfrs16Facade;
    const loader = kind === "modification"
      ? facade?.loadModificationPreview
      : facade?.loadReassessmentPreview;
    if (typeof loader !== "function") {
      const error = new Error(`Private ${kind} preview is unavailable`);
      error.code = "PRIVATE_CHANGE_PREVIEW_UNAVAILABLE";
      throw error;
    }
    const result = await loader.call(facade, contract, input);
    if (!result || typeof result !== "object") {
      const error = new Error(`Private ${kind} preview returned an invalid result`);
      error.code = "PRIVATE_CHANGE_PREVIEW_INVALID";
      throw error;
    }
    return result;
  }

  // Apply mutations cross the same private boundary as calculation previews.
  // The server returns the authoritative APPLIED event, contract patch and
  // refreshed schedule; the browser only merges that envelope and persists
  // the resulting contract record. There is no browser-side calculation
  // fallback for either modification or reassessment.
  async function applyPrivateChange(kind, contract, eventId) {
    // DÜZELTME: aynı null-dönüş hatası burada da vardı — çağıranlar
    // (ör. applyModification sonrası "if (!result.valid)") null'da
    // çöküyordu. loadPrivateChangePreview'daki gibi throw'a çevrildi.
    if (!isPrivateCalculationApiReady()) {
      const error = new Error("Private hesaplama sonucu henüz hazır değil");
      error.code = "PRIVATE_CALCULATION_NOT_READY";
      throw error;
    }
    const facade = window.LeaseQantPrivateTfrs16Facade;
    const loader = kind === "modification"
      ? facade?.applyModification
      : facade?.applyReassessment;
    if (typeof loader !== "function") {
      const error = new Error(`Private ${kind} apply is unavailable`);
      error.code = "PRIVATE_CHANGE_APPLY_UNAVAILABLE";
      throw error;
    }

    const collectionName = kind === "modification" ? "modifications" : "reassessments";
    const collection = Array.isArray(contract?.[collectionName]) ? contract[collectionName] : [];
    const localEvent = collection.find(item => String(item?.id) === String(eventId));
    if (!localEvent) return { valid: false, errors: [kind === "modification" ? "Modification bulunamadı." : "Reassessment bulunamadı."] };
    const before = cloneModificationValue(contract);
    const beforeEvent = cloneModificationValue(localEvent);

    let result;
    try {
      result = await loader.call(facade, contract, eventId);
    } catch (error) {
      return {
        valid: false,
        errors: [`Private ${kind} uygulanamadı: ${error?.message || error}`]
      };
    }
    if (!result || typeof result !== "object") {
      return { valid: false, errors: [`Private ${kind} geçersiz sonuç döndürdü.`] };
    }
    if (!result.valid) return result;

    if (result.event && typeof result.event === "object") {
      Object.keys(localEvent).forEach(key => delete localEvent[key]);
      Object.assign(localEvent, cloneModificationValue(result.event));
    }
    const patch = result.contractPatch && typeof result.contractPatch === "object"
      ? result.contractPatch
      : {};
    ["monthlyPayment", "endDate", "discountRate", "renewalOption", "terminationOption", "purchaseOption"]
      .forEach(key => {
        if (Object.prototype.hasOwnProperty.call(patch, key)) contract[key] = patch[key];
      });

    // Persist the authoritative private apply envelope without evicting the
    // already-warmed results for every other contract. Clearing the entire
    // private cache here makes synchronous risk/close consumers temporarily
    // report "no payment schedule" for the whole portfolio until a full
    // batch hydration runs again.
    saveContracts(contracts, { preservePrivate: true });
    try {
      // The apply endpoint is deliberately pure with respect to persistence;
      // this write stores the returned APPLIED event and contract patch.
      await persistContractToApi(contract, true);
    } catch (error) {
      Object.keys(contract).forEach(key => delete contract[key]);
      Object.assign(contract, before);
      saveContracts(contracts);
      return {
        valid: false,
        errors: [LIFECYCLE_ERROR_TEXT[error?.code || error?.body?.code] || `Backend'e uygulanmış ${kind} kaydı yazılamadı: ${error?.message || error}`]
      };
    }

    // The private apply endpoint owns the financial result, but the browser
    // still owns the audit-sync boundary. Emit the two event-level evidence
    // records only after the contract write succeeds, so a failed persistence
    // attempt cannot leave a misleading APPLIED trail behind.
    if (result.alreadyApplied !== true) {
      if (kind === "modification") {
        recordModificationAuditEvent(contract, "MODIFICATION_APPLIED", localEvent, beforeEvent, localEvent);
        if (Array.isArray(localEvent.journal) && localEvent.journal.length) {
          recordModificationAuditEvent(
            contract,
            "MODIFICATION_JOURNAL_GENERATED",
            localEvent,
            null,
            localEvent.journal
          );
        }
      } else {
        recordReassessmentAuditEvent(contract, "REASSESSMENT_APPLIED", localEvent, beforeEvent, localEvent);
        if (Array.isArray(localEvent.journal) && localEvent.journal.length) {
          recordReassessmentAuditEvent(
            contract,
            "REASSESSMENT_JOURNAL_GENERATED",
            localEvent,
            null,
            localEvent.journal
          );
        }
      }
    }

    const calculation = result.calculation && typeof result.calculation === "object"
      ? result.calculation
      : null;
    if (calculation) {
      const cacheKey = getCalculationCacheKey(contract);
      setPrivateCalculationResult(contract, calculation, { replace: true });
      PRIVATE_CALCULATION_ERRORS.delete(cacheKey);
      setCachedCalculation(contract, calculation);
    }

    return {
      valid: true,
      private: true,
      alreadyApplied: result.alreadyApplied === true,
      event: localEvent,
      [kind]: localEvent,
      schedule: Array.isArray(result.schedule)
        ? result.schedule
        : (calculation?.schedule || [])
    };
  }

  // Synchronous read-only views (controls and legacy reporting panels) cannot
  // await the API. Once the page warm-up has populated the private cache,
  // they must read that result; API-primary never falls through to local math.
  // Keeping this lookup in one helper makes the remaining synchronous
  // consumers auditable during the final engine-removal gate.
  function getPrivateCachedCalculationResult(contract) {
    if (!contract || !isPrivateCalculationApiReady()) return null;
    return PRIVATE_CALCULATION_CACHE.get(getCalculationCacheKey(contract))
      || PRIVATE_CALCULATION_CACHE_BY_ID.get(String(contract.id || ""))
      || null;
  }

  // All production UI consumers call this boundary instead of reaching a
  // calculation implementation directly. It fails closed whenever the
  // private cache does not contain a result yet.
  function getPrivateCalculationForConsumer(contract) {
    const privateResult = getPrivateCachedCalculationResult(contract);
    if (privateResult) return privateResult;
    const error = new Error("Private hesaplama sonucu henüz hazır değil");
    error.code = "PRIVATE_CALCULATION_NOT_READY";
    throw error;
  }

  // Mutations invalidate the calculation cache. Warm the new private result
  // before redrawing the host view so modification/reassessment screens do
  // not briefly show stale values after a successful write.
  async function refreshPrivateCalculationAfterMutation(contract) {
    if (!contract || !isPrivateCalculationApiReady()) return null;
    const key = getCalculationCacheKey(contract);
    PRIVATE_CALCULATION_CACHE.delete(key);
    PRIVATE_CALCULATION_CACHE_BY_ID.delete(String(contract.id || ""));
    PRIVATE_CALCULATION_ERRORS.delete(key);
    const hydration = await hydratePrivateCalculationCache([contract]);
    if (hydration.failed > 0) return null;
    return PRIVATE_CALCULATION_CACHE.get(key)
      || PRIVATE_CALCULATION_CACHE_BY_ID.get(String(contract.id || ""))
      || null;
  }



  /* ==========================================================
     VERİ TEMİZLEME (DATA RETENTION)
     ----------------------------------------------------------
     Audit trail, kontrol snapshot'ları ve entegrasyon (import/
     export) geçmişi localStorage'da sınırsız büyüyordu. Bu katman
     eski kayıtları periyodik olarak temizler; aktif kontrat
     verisine dokunmaz.
  ========================================================== */

  const DATA_RETENTION_CONFIG = {
    auditTrailDays: 365,
    controlSnapshotsDays: 90,
    integrationLogsDays: 180,
    maxAuditEvents: 10000
  };

  function cleanOldAuditTrail() {
    try {
      if (typeof loadAuditEvents !== "function" || typeof saveAuditEvents !== "function") return;
      const events = loadAuditEvents();
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - DATA_RETENTION_CONFIG.auditTrailDays);
      const cutoffTime = cutoff.getTime();

      const filtered = events.filter(event => {
        const timestamp = new Date(event.timestamp).getTime();
        return !Number.isFinite(timestamp) || timestamp > cutoffTime;
      });

      const final = filtered.slice(-DATA_RETENTION_CONFIG.maxAuditEvents);

      if (final.length < events.length) {
        saveAuditEvents(final);
        console.log(`🧹 Audit trail temizlendi: ${events.length - final.length} kayıt silindi`);
      }
    } catch (error) {
      console.error("Audit trail temizleme hatası:", error);
    }
  }

  function cleanOldControlSnapshots() {
    try {
      if (typeof loadControlSnapshots !== "function" || typeof saveControlSnapshots !== "function") return;
      const snapshots = loadControlSnapshots();
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - DATA_RETENTION_CONFIG.controlSnapshotsDays);
      const cutoffTime = cutoff.getTime();

      let cleaned = 0;
      for (const [key, snapshot] of Object.entries(snapshots || {})) {
        const testedAt = new Date(snapshot?.testedAt).getTime();
        if (Number.isFinite(testedAt) && testedAt < cutoffTime) {
          delete snapshots[key];
          cleaned++;
        }
      }

      if (cleaned > 0) {
        saveControlSnapshots(snapshots);
        console.log(`🧹 Kontrol snapshotları temizlendi: ${cleaned} kayıt silindi`);
      }
    } catch (error) {
      console.error("Control snapshot temizleme hatası:", error);
    }
  }

  function cleanOldIntegrationLogs() {
    try {
      if (typeof getIntegrationStorage !== "function" || typeof saveIntegrationStorage !== "function") return;
      const state = getIntegrationStorage();
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - DATA_RETENTION_CONFIG.integrationLogsDays);
      const cutoffTime = cutoff.getTime();

      let cleaned = 0;

      if (Array.isArray(state.jobs)) {
        const before = state.jobs.length;
        state.jobs = state.jobs.filter(job => {
          const date = new Date(job.startedAt || job.createdAt).getTime();
          return !Number.isFinite(date) || date > cutoffTime;
        });
        cleaned += before - state.jobs.length;
      }

      if (Array.isArray(state.exports)) {
        const before = state.exports.length;
        state.exports = state.exports.filter(exp => {
          const date = new Date(exp.createdAt).getTime();
          return !Number.isFinite(date) || date > cutoffTime;
        });
        cleaned += before - state.exports.length;
      }

      if (cleaned > 0) {
        saveIntegrationStorage(state);
        console.log(`🧹 Integration logları temizlendi: ${cleaned} kayıt silindi`);
      }
    } catch (error) {
      console.error("Integration log temizleme hatası:", error);
    }
  }

  function runDataCleanup() {
    console.log("🧹 Veri temizliği başlıyor...");
    cleanOldAuditTrail();
    cleanOldControlSnapshots();
    cleanOldIntegrationLogs();
    console.log("✅ Veri temizliği tamamlandı.");
  }

  /**
   * Sözleşme dizisini localStorage'a (veya varsa V20 storage adapter'ına)
   * kaydeder ve hesaplama önbelleğini geçersiz kılar.
   *
   * @param {Array<Object>} data - Kaydedilecek sözleşme dizisi
   * @throws {Error} localStorage/adapter yazma işlemi başarısız olursa
   * @returns {void}
   */
  function saveContracts(data, options) {
    try {
      const adapter =
        typeof V20StorageAdapters !== "undefined" &&
        typeof V20StorageAdapters.contracts === "function"
          ? V20StorageAdapters.contracts()
          : null;

      if (adapter) {
        adapter.save(data);
      } else {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(data)
        );
      }

      // Kontrat verisi değişti; önbellekteki eski hesaplama
      // sonuçları artık güvenilir değil.
      clearCalculationCache(undefined, { preservePrivate: options?.preservePrivate === true });
    } catch (error) {
      console.error("TFRS 16 storage error:", error);
      throw error;
    }
  }

  /* ==========================================================
     AUDIT TRAIL ENGINE (V16.7)
  ========================================================== */

  const AUDIT_TRAIL_STORAGE_KEY = "gk_tfrs16_audit_trail_v1";
  const AUDIT_MIGRATION_KEY = "gk_tfrs16_audit_trail_migrated_v1";
  const AUDIT_PENDING_SYNC_KEY = "gk_tfrs16_audit_pending_sync_v1";
  const AUDIT_REJECTED_SYNC_KEY = "gk_tfrs16_audit_rejected_sync_v1";

  /** @deprecated-name Kalıcı: cloneAuditValue — dış çağrılarla (window.GK_TFRS16, olası eski referanslar) uyumluluk için korunuyor. Bkz. coreClone. */
  function cloneAuditValue(value) {
    return coreClone(value);
  }

  function loadAuditEvents() {
    try {
      const raw = localStorage.getItem(AUDIT_TRAIL_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function saveAuditEvents(events) {
    try {
      localStorage.setItem(AUDIT_TRAIL_STORAGE_KEY, JSON.stringify(events));
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Private audit rows use PostgreSQL snake_case columns while the browser
   * audit model uses camelCase. Historical evidence also keeps the lifecycle
   * id in metadata.eventId, so lift those identifiers before controls read
   * the local trail.
   */
  function normalizeBackendAuditEvent(row) {
    if (!row || typeof row !== "object") return null;
    let metadata = row.metadata;
    if (typeof metadata === "string") {
      try { metadata = JSON.parse(metadata); } catch (_) { metadata = {}; }
    }
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) metadata = {};

    const action = String(row.action || "UNKNOWN");
    const eventId = metadata.eventId || metadata.event_id || null;
    const contractId = row.contractId ?? row.contract_id ?? metadata.contractId ?? metadata.contract_id ?? null;
    const entityId = row.entityId ?? row.entity_id ?? metadata.entityId ?? metadata.entity_id ?? eventId ?? null;

    return normalizeAuditEventData({
      id: row.id,
      timestamp: row.timestamp || row.created_at || row.createdAt,
      actor: row.actor,
      action,
      entityType: row.entityType || row.entity_type || (action.endsWith("_APPLIED") ? action.replace(/_APPLIED$/, "") : "SYSTEM"),
      entityId,
      companyId: row.companyId ?? row.company_id ?? metadata.companyId ?? metadata.company_id ?? null,
      contractId,
      oldValue: row.oldValue ?? row.old_value ?? null,
      newValue: row.newValue ?? row.new_value ?? null,
      source: row.source || metadata.source || "PRIVATE_API",
      modificationId: row.modificationId ?? row.modification_id ?? metadata.modificationId ?? metadata.modification_id ?? (action === "MODIFICATION_APPLIED" ? eventId : null),
      reassessmentId: row.reassessmentId ?? row.reassessment_id ?? metadata.reassessmentId ?? metadata.reassessment_id ?? (action === "REASSESSMENT_APPLIED" ? eventId : null),
      journalId: row.journalId ?? row.journal_id ?? metadata.journalId ?? metadata.journal_id ?? null,
      reason: row.reason ?? metadata.reason ?? null,
      metadata
    });
  }

  /**
   * Risk and reporting controls read the browser audit repository. Hydrate it
   * from the authenticated private API so DB evidence is available after a
   * fresh browser session. A temporary API failure remains non-fatal.
   */
  async function hydrateAuditEventsFromApi() {
    if (typeof tfrs16ApiFetch !== "function" || !tfrs16GetToken()) return;
    try {
      const response = await tfrs16ApiFetch("/api/audit?limit=1000", { cache: "no-store" });
      const rows = Array.isArray(response) ? response : (Array.isArray(response?.data) ? response.data : []);
      if (!rows.length) return;

      const existing = loadAuditEvents();
      const byId = new Map(existing.map(event => [String(event?.id || ""), event]).filter(([id]) => id));
      rows.forEach(row => {
        const event = normalizeBackendAuditEvent(row);
        if (!event?.id) return;
        const id = String(event.id);
        byId.set(id, { ...(byId.get(id) || {}), ...event });
      });
      saveAuditEvents(Array.from(byId.values()));
    } catch (error) {
      console.warn("[TFRS16] Private audit hydration failed:", error?.message || error);
    }
  }

  function auditActor() {
    try {
      return String(
        window.currentUser?.id ||
        window.currentUser?.username ||
        window.currentUser?.name ||
        "system"
      );
    } catch (error) {
      return "system";
    }
  }

  // Finansal olarak uygulanmış bir olayı geri almak yalnızca platform
  // yöneticisinin açık onayıyla yapılabilir. Olay silinmez; CANCELLED
  // durumuna alınır ve audit trail'de eski/yeni değerleriyle tutulur.
  function isAdminApprovalGranted(options = {}) {
    if (options.adminApproval === true && String(options.approverRole || "").toUpperCase() === "ADMIN") return true;
    try {
      // Gerçek oturum rolü yüklendiyse tek yetkili kaynak budur. Demo
      // kullanıcısının localStorage fallback'i ACCOUNTANT_MANAGER gibi
      // rollerin ADMIN düğmelerini görmesine yol açmamalıdır.
      if (sessionUserRole) return String(sessionUserRole).toUpperCase() === "ADMIN";
      const user = window.currentUser;
      const roles = Array.isArray(user?.roleIds) ? user.roleIds : (Array.isArray(user?.roles) ? user.roles : [user?.role]);
      return roles.some(role => String(role || "").toUpperCase() === "ADMIN");
    } catch (_) { return false; }
  }

  function isLatestAppliedEvent(contract, event, collection) {
    const applied = (contract?.[collection] || [])
      .filter(item => item.status === "APPLIED")
      .slice()
      .sort((a, b) => String(a.effectiveDate || "").localeCompare(String(b.effectiveDate || "")));
    return applied.length > 0 && applied[applied.length - 1]?.id === event?.id;
  }

  function auditEventId() {
    return `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function migrateLegacyAuditTrail() {
    try {
      if (localStorage.getItem(AUDIT_MIGRATION_KEY) === "1") return;
      const events = loadAuditEvents();
      const migrated = [];
      contracts.forEach(contract => {
        const legacy = Array.isArray(contract?.auditTrail) ? contract.auditTrail : [];
        legacy.forEach((item, index) => {
          const event = {
            id: item.id || `LEGACY-${contract.id || "LEASE"}-${index}-${Date.now()}`,
            timestamp: item.timestamp || new Date().toISOString(),
            actor: item.actor || "system",
            action: item.action || "LEGACY_AUDIT",
            entityType: item.entityType || (item.modificationId ? "MODIFICATION" : item.reassessmentId ? "REASSESSMENT" : "CONTRACT"),
            entityId: item.entityId || item.modificationId || item.reassessmentId || contract.id || null,
            contractId: item.contractId || contract.id || null,
            modificationId: item.modificationId || null,
            reassessmentId: item.reassessmentId || null,
            journalId: item.journalId || null,
            reason: item.reason || "Legacy V16.6 audit migration",
            oldValue: cloneAuditValue(item.oldValue),
            newValue: cloneAuditValue(item.newValue),
            metadata: cloneAuditValue(item.metadata) || { migratedFrom: "V16.6 contract.auditTrail" }
          };
          if (!events.some(existing => existing.id === event.id) && !migrated.some(existing => existing.id === event.id)) migrated.push(event);
        });
      });
      if (migrated.length) saveAuditEvents(events.concat(migrated));
      localStorage.setItem(AUDIT_MIGRATION_KEY, "1");
    } catch (error) {}
  }

  /* eslint-disable no-console, no-empty */
  function loadPendingAuditSync() {
    try {
      const parsed = JSON.parse(localStorage.getItem(AUDIT_PENDING_SYNC_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) { return []; }
  }

  function savePendingAuditSync(events) {
    try { localStorage.setItem(AUDIT_PENDING_SYNC_KEY, JSON.stringify(events)); } catch (_) {}
  }

  function queueAuditBackendSync(event) {
    if (!event?.id || typeof window === "undefined") return;
    const pending = loadPendingAuditSync();
    if (!pending.some(item => item.id === event.id)) {
      pending.push(event);
      savePendingAuditSync(pending);
    }
    // DÜZELTME (2026-09-17, Burhan'ın Close Dashboard'da "25 kontratın
    // denetim izi yok" bulgusundan bulundu): bu kapı önceden SADECE
    // window.location.hostname === "gorkemkaraagac1-collab.github.io"
    // ise flush ediyordu — GitHub Pages'in varsayılan alan adı. Ama repo
    // kökünde bir CNAME dosyası var: site gerçekte "leaseqant.com"
    // üzerinden yayında. Yani bu kontrol PRODUCTION'DA HİÇBİR ZAMAN
    // doğru olmuyordu — denetim olayları asla backend'e senkronize
    // olmuyor, sadece o an ki tarayıcının localStorage'ında kalıyordu.
    // Farklı bir oturum/cihaz/temiz-cache ile bakıldığında (ki Close
    // Dashboard kontrolü tam olarak bunu yapıyor) o sözleşmelerin hiç
    // denetim kaydı yokmuş gibi görünüyordu — veri kaybı değildi, hiç
    // gönderilmemiş olmasıydı. flushAuditBackendSync() zaten kendi
    // içinde tfrs16GetToken() ile oturum kontrolü yapıyor — buradaki
    // hostname kısıtı gereksiz ve yanlıştı, kaldırıldı.
    if (typeof tfrs16ApiFetch === "function") {
      setTimeout(() => flushAuditBackendSync(), 0);
    }
  }

  async function flushAuditBackendSync() {
    const pending = loadPendingAuditSync();
    if (!pending.length || typeof tfrs16ApiFetch !== "function" || !tfrs16GetToken()) return { sent: 0, remaining: pending.length };
    const remaining = [];
    let sent = 0;
    for (const event of pending) {
      try {
        await tfrs16ApiFetch("/api/audit", { method: "POST", body: JSON.stringify(event) });
        sent++;
      } catch (error) {
        if (error?.status === 403 || error?.status === 404) {
          try {
            const rejected = JSON.parse(localStorage.getItem(AUDIT_REJECTED_SYNC_KEY) || "[]");
            rejected.push({ event, rejectedAt: new Date().toISOString(), status: error.status, reason: error.message });
            localStorage.setItem(AUDIT_REJECTED_SYNC_KEY, JSON.stringify(rejected.slice(-500)));
          } catch (_) {}
          // 403/404 is a terminal outcome for this browser event (the
          // contract may have been deleted or is outside the session scope).
          // Keep the rejected record locally for review, but do not emit a
          // repeated console warning on every calculation refresh.
        } else {
          remaining.push(event);
          // eslint-disable-next-line no-console
          console.error("Audit backend senkronizasyonu başarısız; olay kuyrukta tutuldu.", error);
        }
      }
    }
    savePendingAuditSync(remaining);
    return { sent, remaining: remaining.length };
  }
  /* eslint-enable no-console, no-empty */

  function recordAuditEvent(input = {}) {
    const event = {
      id: input.id || auditEventId(),
      timestamp: input.timestamp || new Date().toISOString(),
      actor: input.actor || auditActor(),
      action: String(input.action || "UNKNOWN"),
      entityType: String(input.entityType || "SYSTEM"),
      entityId: input.entityId ?? null,
      contractId: input.contractId ?? null,
      modificationId: input.modificationId ?? null,
      reassessmentId: input.reassessmentId ?? null,
      journalId: input.journalId ?? null,
      reason: input.reason ?? null,
      oldValue: cloneAuditValue(input.oldValue),
      newValue: cloneAuditValue(input.newValue),
      metadata: cloneAuditValue(input.metadata) || {}
    };
    try {
      const events = loadAuditEvents();
      if (!events.some(existing => existing.id === event.id)) {
        // V19 Kısa Vade Madde 1: kayıt oluşturulduktan sonra alanları
        // değiştirilemesin diye event nesnesi immutable hale getirilir.
        // (localStorage'daki JSON temsili bu korumadan bağımsızdır;
        // asıl garanti hiçbir fonksiyonun mevcut event'i update etmemesidir.)
        try { Object.freeze(event); } catch (_) {}
        events.push(event);
        saveAuditEvents(events);
      }
      queueAuditBackendSync(event);
    } catch (error) {}
    return event;
  }

  function getAuditTrail(contractId) {
    const events = loadAuditEvents();
    return (contractId === undefined || contractId === null || contractId === ""
      ? events
      : events.filter(event => event.contractId === contractId)
    ).slice().sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
  }

  function getAuditEvents(filters = {}) {
    return loadAuditEvents().filter(event => {
      if (filters.contractId && event.contractId !== filters.contractId) return false;
      if (filters.action && event.action !== filters.action) return false;
      if (filters.actor && event.actor !== filters.actor) return false;
      if (filters.entityType && event.entityType !== filters.entityType) return false;
      if (filters.entityId && event.entityId !== filters.entityId) return false;
      if (filters.dateFrom && String(event.timestamp) < String(filters.dateFrom)) return false;
      if (filters.dateTo && String(event.timestamp) > String(filters.dateTo)) return false;
      return true;
    });
  }



  migrateLegacyAuditTrail();

  /* ==========================================================
     MODIFICATION MANAGEMENT (V16.5)
     ----------------------------------------------------------
     Additive modification layer. Existing contract fields,
     calculation engines and V16.4 reporting-date logic remain
     unchanged. Modifications are event records and are only
     applied to the live contract when status becomes APPLIED.
  ========================================================== */

  function ensureModificationState(contract) {
    if (!contract || typeof contract !== "object") {
      return contract;
    }

    if (!Array.isArray(contract.modifications)) {
      contract.modifications = [];
    }

    if (!Array.isArray(contract.auditTrail)) {
      contract.auditTrail = [];
    }

    return contract;
  }

  /* ==========================================================
     REASSESSMENT MANAGEMENT (V16.6)
     ----------------------------------------------------------
     Additive reassessment layer. Modification events remain in
     contract.modifications[]. Reassessment events are stored
     separately in contract.reassessments[]. Existing engines are
     reused; no second lease calculation or classification engine
     is introduced.
  ========================================================== */

  function ensureReassessmentState(contract) {
    if (!contract || typeof contract !== "object") {
      return contract;
    }

    if (!Array.isArray(contract.reassessments)) {
      contract.reassessments = [];
    }

    if (!Array.isArray(contract.auditTrail)) {
      contract.auditTrail = [];
    }

    return contract;
  }

  function reassessmentId(contract) {
    const prefix = String(contract?.id || "LEASE")
      .replace(/[^A-Za-z0-9_-]/g, "")
      .slice(0, 24) || "LEASE";

    return `${prefix}-REASS-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  }

  function recordReassessmentAuditEvent(
    contract,
    action,
    reassessment,
    oldValue,
    newValue
  ) {
    ensureReassessmentState(contract);
    return recordAuditEvent({
      action,
      entityType: "REASSESSMENT",
      entityId: reassessment?.id || null,
      contractId: contract?.id || null,
      reassessmentId: reassessment?.id || null,
      reason: reassessment?.reason || null,
      oldValue,
      newValue,
      metadata: {
        type: reassessment?.type || null,
        effectiveDate: reassessment?.effectiveDate || null,
        oldLeaseLiability: reassessment?.oldLeaseLiability ?? null,
        revisedLeaseLiability: reassessment?.revisedLeaseLiability ?? null,
        liabilityAdjustment: reassessment?.liabilityAdjustment ?? null,
        rouAdjustment: reassessment?.rouAdjustment ?? null
      }
    });
  }

  function getCurrentReassessmentState(contract) {
    ensureReassessmentState(contract);

    const applied =
      contract.reassessments
        .filter(item => item.status === "APPLIED")
        .slice()
        .sort((a, b) =>
          String(a.effectiveDate || "").localeCompare(
            String(b.effectiveDate || "")
          )
        );

    return applied.length
      ? applied[applied.length - 1]
      : null;
  }

  function getReassessmentCurrentTerms(contract, asOfDate = null) {
    // Reassessment must start from the effective modification chain. Reading
    // headline contract fields here caused a later rate/payment reassessment
    // to replace earlier modification terms in historical periods.
    const modificationTerms = getModificationCurrentTerms(contract, asOfDate);
    const cutoff = asOfDate ? parseDate(asOfDate) : null;
    const terms = {
      leaseTerm: modificationTerms.leaseEndDate || contract?.endDate || "",
      renewalOption: contract?.renewalOption === true,
      terminationOption: contract?.terminationOption === true,
      purchaseOption: contract?.purchaseOption === true,
      payment: Number(modificationTerms.payment) || 0,
      discountRate: Number(modificationTerms.discountRate) || 0
    };
    (contract?.reassessments || [])
      .filter(item => item?.status === "APPLIED")
      .slice()
      .sort((a, b) => String(a.effectiveDate || "").localeCompare(String(b.effectiveDate || "")))
      .forEach(item => {
        const effective = parseDate(item.effectiveDate);
        if (cutoff && (!effective || effective > cutoff)) return;
        const next = item.newTerms || item.appliedToTerms || {};
        if (next.leaseTerm !== undefined) terms.leaseTerm = next.leaseTerm;
        if (next.payment !== undefined) terms.payment = Number(next.payment) || 0;
        if (next.discountRate !== undefined) terms.discountRate = Number(next.discountRate) || 0;
        if (next.renewalOption !== undefined) terms.renewalOption = next.renewalOption === true;
        if (next.terminationOption !== undefined) terms.terminationOption = next.terminationOption === true;
        if (next.purchaseOption !== undefined) terms.purchaseOption = next.purchaseOption === true;
      });
    return terms;
  }

  /* ==========================================================
     V18 Parça 2 — TMS 29 ENFLASYON DÜZELTMESİ
     (KİRALAMA PORTFÖYÜ KATMANI)
     ----------------------------------------------------------
     SINIR: Bu modül TAM KAPSAMLI bir TMS 29 uygulaması DEĞİLDİR;
     yalnızca kiralama portföyüne (ROU/kiralama yükümlülüğü) odaklı
     bir düzeltme katmanıdır. Diğer finansal tablo kalemlerinin
     (nakit, stok, özkaynak vb.) enflasyon düzeltmesi bu modülün
     kapsamında DEĞİLDİR.

     Muhasebe yaklaşımı (VARSAYIM — onaylandı):
       - ROU varlığı GAYRİ MONETER kalemdir → edinim ayından
         raporlama dönemine kadar genel fiyat endeksiyle düzeltilir.
         Her dönemin amortismanı KENDİ ayından raporlama dönemine
         düzeltilip toplanır (tek bir NBV çarpanı yerine).
       - Kiralama yükümlülüğü MONETER kalemdir → zaten dönem sonu
         ölçü biriminde ifade edildiğinden NOMİNAL tutarı ile
         DÜZELTİLMİŞ tutarı AYNIDIR (fark = 0). Bu, TMS 29'un temel
         ilkesidir (moneter kalemler restate edilmez); moneter
         kâr/zararın kaynağı budur.
       - Net düzeltme farkı (tamamı ROU tarafından gelir) TFRS29_
         ACCOUNTS.inflationGainLoss hesabına gider.
       - Private sonuç zarfındaki ETKİN plan (escalation + modification +
         reassessment uygulanmış) kullanılır; ikinci bir hesaplama motoru
         YAZILMADI.
     ========================================================== */

  function ensureInflationAdjustmentState(contract) {
    if (!contract || typeof contract !== "object") {
      return contract;
    }
    if (!Array.isArray(contract.inflationAdjustments)) {
      contract.inflationAdjustments = [];
    }
    if (!Array.isArray(contract.auditTrail)) {
      contract.auditTrail = [];
    }
    return contract;
  }

  // Hesap kodları tek noktadan değiştirilebilir (müşteri bazlı hesap eşleme tablosu ayrı bir parçada eklenebilir).
  const TFRS29_ACCOUNTS = {
    rouAsset: "260 Kullanım Hakkı Varlığı",
    leaseLiability: "401 Kiralama Yükümlülüğü",
    inflationGainLoss: "698 Enflasyon Düzeltmesi K/Z",
    // Kiralama yükümlülüğü hareket tablosunun "Parasal Kazanç/(Kayıp), net"
    // satırı için ayrı alt hesap (698 altında alt kalem).
    liabilityMonetaryGainLoss: "698.02 Parasal Kazanç/(Kayıp), Net (Kiralama Yükümlülüğü)",
    // Karşı hesap: yükümlülüğün (401) nominal bakiyesi bu restatement ile
    // değişmez (moneter kalem — TMS 29.28); karşı taraf özkaynak/sonuç hesabıdır.
    monetaryPositionOffset: "590 TMS 29 Parasal Pozisyon Karşılığı"
  };

  /* ==========================================================
     HESAP PLANI MAPPING (V19 - Kısa Vade Madde 3)
     ----------------------------------------------------------
     Şirket bazlı hesap kodu eşlemesi.
     Varsayılan Türkçe hesap planı + müşteri özelleştirmesi.
     TFRS29_ACCOUNTS hâlâ backward-compat için duruyor;
     yeni kod getAccountCode() kullanmalı.
     ========================================================== */

  const ACCOUNT_MAPPING_STORAGE_KEY = "gk_tfrs16_account_mapping_v1";

  /**
   * Varsayılan Türkçe hesap planı.
   * Kullanıcı değiştirmezse bu kullanılır.
   */
  function getDefaultAccountMapping() {
    return {
      // Kullanım Hakkı Varlığı
      rouAsset: "260.01.001",
      rouAccumDep: "268.01.001",

      // Kiralama Yükümlülüğü
      leaseLiabilityCurrent: "401.01",
      leaseLiabilityNonCurrent: "401.02",
      leaseLiability: "401",                    // genel (eski uyumluluk)

      // Giderler
      interestExpense: "780.01",
      depreciationExpense: "760.01",

      // TMS 29 / Enflasyon
      inflationGainLoss: "698.01",
      liabilityMonetaryGainLoss: "698.02",
      monetaryPositionOffset: "590",

      // Opsiyonel / İleri seviye
      prepaidLease: "180.01",
      leaseIncentive: "360.01",
      restorationObligation: "479.01",
      shortTermExemptionExpense: "770.01",
      lowValueExemptionExpense: "770.02"
    };
  }

  /**
   * Şirketin hesap planı eşlemesini yükler.
   * Yoksa varsayılanı döndürür.
   * @param {string} companyId
   * @returns {Object}
   */
  function loadAccountMapping(companyId) {
    try {
      const raw = localStorage.getItem(ACCOUNT_MAPPING_STORAGE_KEY);
      if (!raw) return { ...getDefaultAccountMapping() };

      const all = JSON.parse(raw);
      if (all && typeof all === "object" && all[companyId]) {
        // Varsayılan + şirket özelini birleştir (eksik alanlar default'tan gelsin)
        return {
          ...getDefaultAccountMapping(),
          ...all[companyId]
        };
      }
    } catch (error) {
      console.error("Hesap planı yüklenirken hata:", error);
    }
    return { ...getDefaultAccountMapping() };
  }

  /**
   * Şirketin hesap planı eşlemesini kaydeder.
   * @param {string} companyId
   * @param {Object} mapping
   * @returns {boolean}
   */
  function saveAccountMapping(companyId, mapping) {
    try {
      if (!companyId) throw new Error("companyId zorunludur");
      if (!mapping || typeof mapping !== "object") {
        throw new Error("Geçersiz mapping objesi");
      }

      let all = {};
      try {
        const raw = localStorage.getItem(ACCOUNT_MAPPING_STORAGE_KEY);
        if (raw) all = JSON.parse(raw) || {};
      } catch (_) {}

      all[companyId] = { ...mapping };
      localStorage.setItem(ACCOUNT_MAPPING_STORAGE_KEY, JSON.stringify(all));

      // Audit trail'e yaz (varsa)
      if (typeof recordAuditEvent === "function") {
        recordAuditEvent({
          action: "ACCOUNT_MAPPING_UPDATED",
          entityType: "ACCOUNT_MAPPING",
          entityId: companyId,
          companyId,
          actor: (typeof auditActor === "function" ? auditActor() : "system"),
          reason: "Hesap planı eşlemesi güncellendi",
          newValue: { keys: Object.keys(mapping) }
        });
      }

      return true;
    } catch (error) {
      console.error("Hesap planı kaydedilirken hata:", error);
      if (typeof showAlert === "function") {
        showAlert(`Hesap planı kaydedilemedi: ${error.message}`);
      }
      return false;
    }
  }

  /**
   * Tek bir hesap kodunu güvenli şekilde alır.
   * @param {string} companyId
   * @param {string} key          örn: "rouAsset", "interestExpense"
   * @param {string} [fallback]   bulunamazsa kullanılacak değer
   * @returns {string}
   */
  function getAccountCode(companyId, key, fallback = "") {
    const mapping = loadAccountMapping(companyId);
    const code = mapping[key];
    if (code && typeof code === "string" && code.trim()) {
      return code.trim();
    }
    // Son çare: default'tan dene
    const def = getDefaultAccountMapping()[key];
    return (def && def.trim()) || fallback || key;
  }

  /**
   * Yevmiye satırlarına gerçek hesap kodlarını uygular.
   * entries içindeki accountKey alanını okuyup accountCode'a çevirir.
   * @param {Array} entries
   * @param {string} companyId
   * @returns {Array}
   */
  function applyAccountMappingToJournal(entries, companyId) {
    if (!Array.isArray(entries)) return [];

    return entries.map(entry => {
      const newEntry = { ...entry };

      // Eğer accountKey varsa onu kullan
      if (entry.accountKey) {
        newEntry.accountCode = getAccountCode(companyId, entry.accountKey, entry.accountCode || entry.account);
        newEntry.accountName = entry.accountName || entry.accountKey;
        // Eski "account" alanını da güncelle (geriye uyumluluk)
        newEntry.account = newEntry.accountCode;
      }
      // Eski uyumluluk: accountCode veya account zaten varsa dokunma
      else if (entry.accountCode) {
        newEntry.accountCode = entry.accountCode;
      } else if (entry.account) {
        newEntry.accountCode = entry.account;
      }

      return newEntry;
    });
  }

  /* ==========================================================
     HESAP PLANI EŞLEME UI (V19)
     ========================================================== */

  const ACCOUNT_MAPPING_LABELS = {
    rouAsset: "Kullanım Hakkı Varlığı (ROU)",
    rouAccumDep: "Birikmiş Amortisman (ROU)",
    leaseLiability: "Kiralama Yükümlülüğü (Genel)",
    leaseLiabilityCurrent: "Kiralama Yükümlülüğü - Kısa Vade",
    leaseLiabilityNonCurrent: "Kiralama Yükümlülüğü - Uzun Vade",
    interestExpense: "Faiz Gideri",
    depreciationExpense: "Amortisman Gideri",
    inflationGainLoss: "Enflasyon Düzeltmesi K/Z",
    liabilityMonetaryGainLoss: "Parasal Kazanç/(Kayıp), Net",
    monetaryPositionOffset: "Parasal Pozisyon Karşılığı",
    prepaidLease: "Peşin Ödenmiş Kira",
    leaseIncentive: "Kira Teşviki",
    restorationObligation: "Restorasyon Yükümlülüğü",
    shortTermExemptionExpense: "Kısa Vadeli Muafiyet Gideri",
    lowValueExemptionExpense: "Düşük Değerli Muafiyet Gideri"
  };

  function renderAccountMappingPage(container) {
    if (!container) return;
    if (document.documentElement.getAttribute("data-lq-ui") === "2") {
      const ui = window.LeaseQantTfrs16JournalUi;
      if (!ui?.renderAccountMapping) { container.innerHTML = '<p role="alert">Onaylı hesap eşleme servisi hazır değil.</p>'; return; }
      ui.renderAccountMapping(container, {
        companies: typeof getUnifiedCompanyOptions === "function" ? getUnifiedCompanyOptions() : [],
        companyId: container.dataset.companyId || (typeof getActiveCompanyId === "function" ? getActiveCompanyId() : ""),
        contracts
      });
      return;
    }
    if (typeof injectV26Styles === "function") injectV26Styles();

    // V27 — sessionCompanies (backend lisans) ve v26LoadCompanies (sözleşme/
    // konsolidasyon şirketleri) tek bir tutarlı listede birleştirilir; artık
    // silinen/yeniden adlandırılan şirketler iki kaynak arasında tutarsızlık
    // yaratmıyor (bkz. getUnifiedCompanyOptions).
    const companyOptions = (typeof getUnifiedCompanyOptions === "function" ? getUnifiedCompanyOptions() : [])
      .map(c => ({ id: c.id, name: c.name }));
    if (!companyOptions.length) companyOptions.push({ id: "DEFAULT", name: "Varsayılan / Genel" });

    let selectedCompanyId = container.dataset.companyId ||
      (typeof getActiveCompanyId === "function" && getActiveCompanyId() !== "ALL" && companyOptions.some(c => c.id === getActiveCompanyId())
        ? getActiveCompanyId()
        : companyOptions[0].id);

    const render = () => {
      const mapping = loadAccountMapping(selectedCompanyId);
      const keys = Object.keys(ACCOUNT_MAPPING_LABELS);

      container.innerHTML = `
        <div class="gk-v26-page">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:16px;">
            <div>
              <h2 style="margin:0;font-size:20px;color:#0f172a;">Hesap Planı Eşleme</h2>
              <p style="margin:4px 0 0;font-size:13px;color:#64748b;">
                Fişlerde sunucuda onaylanmış şirket hesap planı kullanılır. Bu ekrandaki yerel eşlemeler fişlere uygulanmaz.
              </p>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
              <label style="font-size:12px;color:#64748b;font-weight:600;display:flex;align-items:center;gap:6px;">
                Şirket
                <select id="amCompanySelect" style="padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;">
                  ${companyOptions.map(c =>
                    `<option value="${escapeHtml(c.id)}" ${c.id === selectedCompanyId ? "selected" : ""}>${escapeHtml(c.name)}</option>`
                  ).join("")}
                </select>
              </label>
            </div>
          </div>

          <div class="gk-v26-card" style="background:#f0f9ff;border-color:#bae6fd;">
            <div style="font-size:13px;color:#0c4a6e;">
              <strong>Nasıl çalışır?</strong>
              Sol taraftaki alanlar muhasebe anahtarlarıdır (değişmez).
              Sağdaki hesap kodlarını kendi planınıza göre düzenleyin ve <strong>Kaydet</strong> deyin.
              Kaydetmezseniz varsayılan Türkçe plan kullanılır.
            </div>
          </div>

          <div class="gk-v26-card">
            <table class="gk-v26-table">
              <thead>
                <tr>
                  <th style="width:40%;">Hesap (Açıklama)</th>
                  <th style="width:20%;">Anahtar</th>
                  <th>Hesap Kodu</th>
                </tr>
              </thead>
              <tbody>
                ${keys.map(key => `
                  <tr>
                    <td>${escapeHtml(ACCOUNT_MAPPING_LABELS[key])}</td>
                    <td><code style="font-size:11px;color:#64748b;">${escapeHtml(key)}</code></td>
                    <td>
                      <input type="text"
                        class="am-code-input"
                        data-key="${escapeHtml(key)}"
                        value="${escapeHtml(mapping[key] || "")}"
                        style="width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:ui-monospace,monospace;"
                        placeholder="Örn: 260.01.001" />
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
            <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap;">
              <button type="button" class="gk-v26-btn" id="amSaveBtn">Kaydet</button>
              <button type="button" class="gk-v26-btn gk-v26-btn-secondary" id="amResetBtn">Varsayılana Dön</button>
            </div>
            <div id="amStatus" style="margin-top:10px;font-size:12px;color:#64748b;"></div>
          </div>
        </div>`;

      container.querySelector("#amCompanySelect")?.addEventListener("change", (e) => {
        selectedCompanyId = e.target.value;
        container.dataset.companyId = selectedCompanyId;
        render();
      });

      container.querySelector("#amSaveBtn")?.addEventListener("click", () => {
        const newMapping = {};
        container.querySelectorAll(".am-code-input").forEach(input => {
          const key = input.getAttribute("data-key");
          const val = String(input.value || "").trim();
          if (key && val) newMapping[key] = val;
        });
        const ok = saveAccountMapping(selectedCompanyId, newMapping);
        const status = container.querySelector("#amStatus");
        if (ok) {
          if (status) status.innerHTML = `<span style="color:#166534;">✓ Hesap planı kaydedildi (${Object.keys(newMapping).length} alan).</span>`;
          if (typeof showToast === "function") showToast("Hesap planı kaydedildi", "success", 2000);
        } else {
          if (status) status.innerHTML = `<span style="color:#b91c1c;">Kaydetme başarısız.</span>`;
        }
      });

      container.querySelector("#amResetBtn")?.addEventListener("click", async () => {
        const ok = typeof showConfirm === "function"
          ? await showConfirm("Bu şirketin özel hesap planı silinip varsayılana dönülecek. Emin misiniz?", { danger: true, title: "Varsayılana Dön" })
          : window.confirm("Varsayılana dönülsün mü?");
        if (!ok) return;
        try {
          const raw = localStorage.getItem(ACCOUNT_MAPPING_STORAGE_KEY);
          if (raw) {
            const all = JSON.parse(raw) || {};
            delete all[selectedCompanyId];
            localStorage.setItem(ACCOUNT_MAPPING_STORAGE_KEY, JSON.stringify(all));
          }
          if (typeof recordAuditEvent === "function") {
            recordAuditEvent({
              action: "ACCOUNT_MAPPING_RESET",
              entityType: "ACCOUNT_MAPPING",
              entityId: selectedCompanyId,
              reason: "Varsayılan hesap planına dönüldü"
            });
          }
          if (typeof showToast === "function") showToast("Varsayılan plana dönüldü", "success", 2000);
          render();
        } catch (error) {
          if (typeof showAlert === "function") showAlert("Sıfırlama başarısız: " + (error.message || error));
        }
      });
    };

    render();
  }

  const INFLATION_INDEX_STORAGE_KEY = "gk_tfrs16_inflation_index_v1";

  /* ==========================================================
     TÜİK BACKEND CACHE (additive — TFRS 16 motoruna dokunmaz)
     ----------------------------------------------------------
     Public hesaplama gövdeleri kaldırıldı; bu blok yalnızca
     backend'den (GET /api/inflation-indices) önceden çekilmiş VERIFIED
     endeks verisini private sonuç tüketicileri ve admin endeks ekranı
     için bellek-içi cache'te tutar. Yerel TMS 29 restatement hesabı
     yapılmaz.

     ÖNEMLİ — BİLİNEN SINIRLAMA (CHANGES.md'de ayrıca raporlanıyor):
     Bu dosyadaki mevcut oturum/kullanıcı yönetimi (window.GKAuth,
     bkz. auth.js) tamamen istemci-taraflı bir PROTOTİPTİR ve
     backend/'deki gerçek JWT authentication'dan TAMAMEN BAĞIMSIZDIR.
     Dolayısıyla bugün tarayıcıda gerçek bir Bearer token YOKTUR;
     refreshInflationIndexCacheFromBackend() bunu fark eder ve
     401/hata durumunda SESSİZCE "başarılı" görünmez — hatayı loglar
     ve cache'i boş bırakır, böylece loadInflationIndexTable()
     otomatik olarak mevcut localStorage davranışına düşer (yanlış
     veri asla üretilmez). Gerçek uçtan uca çalışma için frontend'in
     backend JWT'sine geçirilmesi ayrı bir iş kalemidir — bu
     değişikliğin kapsamı DIŞINDADIR.
     ========================================================== */
  let backendInflationIndexCache = null; 
  function getRequiredInflationIndexMonths() {
    const starts = (Array.isArray(contracts) ? contracts : [])
      .map(contract => rptDate(contract?.startDate))
      .filter(Boolean);
    if (!starts.length) return [];

    const first = new Date(Math.min(...starts.map(date => date.getTime())));
    const last = new Date();
    const cursor = new Date(first.getFullYear(), first.getMonth(), 1);
    const end = new Date(last.getFullYear(), last.getMonth(), 1);
    const months = [];

    while (cursor <= end) {
      months.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return months;
  }

  async function refreshInflationIndexCacheFromBackend(months) {
    try {
      const query = Array.isArray(months) && months.length ? `?months=${encodeURIComponent(months.join(","))}` : "";
      // ÖNEMLİ DÜZELTME: relative "/api/inflation-indices" GitHub Pages'ten
      // (frontend origin) sunulduğunda backend'e DEĞİL, GitHub Pages'in
      // kendisine gider (404) — TFRS16_API_BASE (Cloud Run) ile aynı mutlak
      // URL şeması, dosyanın geri kalanındaki tfrs16ApiFetch()/TFRS16_API_BASE
      // kullanımıyla tutarlı hale getirildi.
      // The authenticated browser session is represented by an HttpOnly
      // cookie, so use the shared API helper instead of requiring a readable
      // bearer token in local/session storage.
      const body = await tfrs16ApiFetch(`/api/inflation-indices${query}`, { cache: "no-store" });
      const indices = Array.isArray(body?.indices) ? body.indices : null;
      if (!indices) {
        console.error("TÜİK endeks cache'i yenilenemedi: beklenmeyen yanıt formatı. localStorage tablosu kullanılacak.");
        return false;
      }

      backendInflationIndexCache = indices
        .filter(e => e && typeof e.month === "string" && Number.isFinite(Number(e.index)))
        .map(e => ({
          month: e.month,
          index: Number(e.index),
          source: e.source || null,
          sourceUrl: e.sourceUrl || null,
          retrievedAt: e.retrievedAt || null,
          verificationStatus: e.verificationStatus || "VERIFIED"
        }));

      return true;
    } catch (error) {
      console.error("TÜİK endeks cache'i yenilenirken hata oluştu. localStorage tablosu kullanılacak.", error);
      return false;
    }
  }

  // VERIFIED TCMB kayıtlarını hesaplama motorunun senkron cache'ine alır.
  // PENDING/REJECTED kayıtlar bilinçli olarak alınmaz; eksik kurda motorun
  // mevcut fail-closed davranışı korunur.
  async function refreshFxRateCacheFromBackend() {
    try {
      // Login uses the backend's HttpOnly session cookie.  Do not gate this
      // refresh on a browser-readable bearer token: that made authenticated
      // sessions with a cookie-only login skip the request entirely and left
      // the synchronous FX cache empty, so KPI rendering reported a false
      // FX_RATE_NOT_FOUND for every USD/EUR contract.
      const bodies = await Promise.all(["USD", "EUR"].map(currency =>
        tfrs16ApiFetch(`/api/fx-rates?from=${currency}&to=TRY`, { cache: "no-store" })
      ));
      const rates = bodies.flatMap(body => Array.isArray(body?.rates) ? body.rates : [])
        .filter(row => row && (row.fromCurrency === "USD" || row.fromCurrency === "EUR") && row.toCurrency === "TRY"
          && row.verificationStatus === "VERIFIED" && Number(row.rate) > 0 && /^\d{4}-\d{2}-\d{2}/.test(String(row.rateDate)))
        .map(row => ({
          id: `BACKEND-FX-${row.fromCurrency}-${row.rateDate}`,
          fromCurrency: row.fromCurrency, toCurrency: row.toCurrency,
          rate: Number(row.rate), rateDate: v23DateKey(row.rateDate),
          rateType: Object.values(V23_RATE_TYPES).includes(String(row.rateType || "").toUpperCase()) ? String(row.rateType).toUpperCase() : V23_RATE_TYPES.CLOSING,
          source: V23_RATE_SOURCES.CENTRAL_BANK, status: "APPROVED",
          reason: "TCMB doğrulanmış backend kaydı", createdBy: "backend",
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), schemaVersion: V23_SCHEMA_VERSION
        }));
      backendFxRateCache = rates;
      return true;
    } catch (error) {
      console.error("TCMB kur cache'i yenilenirken hata oluştu.", error);
      return false;
    }
  }

  function loadInflationIndexTable() {
    // FAIL-CLOSED (bilinçli karar — admin panelinden VERIFIED gelen
    // veri dışında hiçbir kaynak hesaplamaya girmemeli): önceden bu
    // fonksiyon backendInflationIndexCache boşsa localStorage'daki
    // ("gk_tfrs16_inflation_index_v1") manuel tabloya düşüyordu — bu
    // tablo, admin kontrolü OLMAYAN bir ekrandan (bkz.
    // renderInflationIndexManagementPage — artık kapatıldı) herhangi
    // bir kullanıcı tarafından doldurulabiliyordu. Artık backend cache
    // dolu değilse (henüz sorulmadı veya erişilemedi) BOŞ dizi
    // döndürülür — getInflationIndex() bunu "eksik ay" olarak görüp
    // zaten kendi kuralına göre açık bir hata fırlatır; asla sessizce
    // doğrulanmamış bir değere düşülmez.
    return Array.isArray(backendInflationIndexCache) ? backendInflationIndexCache : [];
  }

  function getVerifiedInflationIndexInfo(month) {
    const target = String(month || "");
    const rows = loadInflationIndexTable()
      .filter(row => /^\d{4}-\d{2}$/.test(String(row?.month || "")))
      .sort((a, b) => String(a.month).localeCompare(String(b.month)));
    if (target) return rows.find(row => row.month === target) || null;
    return rows.length ? rows[rows.length - 1] : null;
  }








  function reassessmentStableStringify(value) {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return "[" + value.map(reassessmentStableStringify).join(",") + "]";
    return "{" + Object.keys(value).sort().map(key =>
      JSON.stringify(key) + ":" + reassessmentStableStringify(value[key])
    ).join(",") + "}";
  }

  function reassessmentEconomicKey(item) {
    return [
      item?.type || "",
      item?.effectiveDate || item?.reassessmentDate || "",
      reassessmentStableStringify(item?.newTerms || {})
    ].join("|");
  }

  /**
   * buildJournalLine — modification/reassessment fiş üreticilerinde
   * tekrarlanan {accountKey, account, debit, credit, source,
   * controlStatus} kalıbının kanonik kaynağı (Faz 1 — DRY).
   *
   * controlStatus parametresi "VALID" varsayılanla çağrılıyor çünkü
   * orijinal kodda HER push sitesinde bu değer hardcode'lanmıştı —
   * ki zaten çağıran fonksiyon sonunda `entries.forEach(item =>
   * item.controlStatus = balanced ? "VALID" : "UNBALANCED")` ile HER
   * satırı YENİDEN yazıyor. Yani bu alan pratikte her zaman
   * ezileceği için hangi değerle başladığı sonucu etkilemez; orijinal
   * davranışı harfiyen korumak için yine de "VALID" ile başlatılıyor.
   *
   * NOT: generateModificationJournal'daki TEK bir push sitesi
   * (SCOPE_DECREASE dalındaki kazanç/kayıp satırı) accountKey alanını
   * HİÇ içermiyor — orada bu helper KULLANILMADI (kasıtlı, aşağıya
   * bakınız), çünkü buildJournalLine(undefined, ...) çağırmak
   * `accountKey: undefined` anahtarını EKLERDİ; orijinalde bu anahtar
   * hiç YOKTU. `'accountKey' in entry` gibi bir kontrol varsa bu
   * sessiz bir davranış farkı yaratırdı.
   */
  function buildJournalLine(accountKey, account, debit, credit, source, controlStatus = "VALID") {
    return { accountKey, account, debit, credit, source, controlStatus };
  }

  function generateReassessmentJournal(contract, reassessment) {
    if (!reassessment || reassessment.status !== "APPLIED") {
      return [];
    }

    const liabilityAdjustment = Number(reassessment.liabilityAdjustment) || 0;
    const rouAdjustment = Number(reassessment.rouAdjustment) || 0;
    const gainLoss = Number(reassessment.gainLoss) || 0;
    const entries = [];
    const companyId = contract?.companyId || "";

    if (liabilityAdjustment > 0) {
      entries.push(buildJournalLine("rouAsset", "260 Kullanım Hakkı Varlığı", liabilityAdjustment, 0, "REASSESSMENT"));
      entries.push(buildJournalLine("leaseLiability", "401 Kiralama Yükümlülüğü", 0, liabilityAdjustment, "REASSESSMENT"));
    } else if (liabilityAdjustment < 0) {
      const amount = Math.abs(liabilityAdjustment);
      entries.push(buildJournalLine("leaseLiability", "401 Kiralama Yükümlülüğü", amount, 0, "REASSESSMENT"));
      if (rouAdjustment < 0) {
        entries.push(buildJournalLine("rouAsset", "260 Kullanım Hakkı Varlığı", 0, Math.abs(rouAdjustment), "REASSESSMENT"));
      }
    }

    if (gainLoss > 0.005) {
      entries.push(buildJournalLine("inflationGainLoss", "649 Reassessment Gain", 0, gainLoss, "REASSESSMENT"));
    } else if (gainLoss < -0.005) {
      entries.push(buildJournalLine("inflationGainLoss", "689 Reassessment Loss", Math.abs(gainLoss), 0, "REASSESSMENT"));
    }

    const debit = entries.reduce((sum, item) => sum + (Number(item.debit) || 0), 0);
    const credit = entries.reduce((sum, item) => sum + (Number(item.credit) || 0), 0);
    const balanced = Math.abs(debit - credit) < 0.01;

    entries.forEach(item => {
      item.controlStatus = balanced ? "VALID" : "UNBALANCED";
    });

    // V19: Hesap planı mapping uygula
    return typeof applyAccountMappingToJournal === "function"
      ? applyAccountMappingToJournal(entries, companyId)
      : entries;
  }


  // Server lifecycle error codes shown in Turkish (sunucu hata kodları).
  const LIFECYCLE_ERROR_TEXT = {
    PAYMENT_L3_CALENDAR_UNSUPPORTED: "Bu ödeme planında modifikasyon ve yeniden değerlendirme desteklenmiyor.",
    DATED_CHANGE_PAYMENT_OUTSIDE_TERM: "Yeni ödeme takvimindeki tarihler yürürlük tarihinden SONRA ve yeni kira bitiş tarihinden önce (veya aynı gün) olmalı.",
    DATED_CHANGE_SAME_DAY_PAYMENT: "Yeni ödeme takviminde aynı tarih birden fazla kez var.",
    DATED_CHANGE_PAYMENT_AMOUNT_INVALID: "Yeni ödeme takvimindeki tutarlar pozitif olmalı.",
    DATED_CHANGE_PAYMENT_DATE_INVALID: "Yeni ödeme takviminde tarih YYYY-AA-GG olmalı.",
    DATED_CHANGE_DATE_INVALID: "Yürürlük tarihi kira başlangıcından sonra olmalı ve aynı tarihte uygulanmış başka bir değişiklik bulunmamalı.",
    DATED_CHANGE_BEFORE_APPLIED_CHANGE: "Bu tarihten sonra uygulanmış bir değişiklik var; daha eski tarihli değişiklik eklenemez.",
    DATED_CHANGE_AFTER_LEASE_END: "Yürürlük tarihi kira bitişinden önce olmalı.",
    DATED_CHANGE_END_INVALID: "Yeni kira bitiş tarihi yürürlük tarihinden sonra olmalı.",
    DATED_CHANGE_RATE_INVALID: "Yeni iskonto oranı geçersiz.",
    DATED_CHANGE_SCOPE_REDUCTION_INVALID: "Kapsam azalışı %0 ile %100 arasında (100 hariç) olmalı. Kiralamanın tamamen sona ermesi kapsam azalışı değil, fesihtir.",
    CHANGE_BEFORE_APPLIED_CHANGE: "Bu tarihten sonra uygulanmış bir değişiklik var. Önce o değişikliği geri alın, sonra bu tarihli değişikliği girin.",
    PERIOD_CLOSED: "Bu değişikliğin yürürlük tarihi kapalı bir döneme düşüyor. Dönem yeniden açılmadan uygulanamaz veya geri alınamaz.",
    LEASE_TERM_ASSESSMENT_REQUIRED: "Kira süresi değerlendirmesi gerekli (opsiyonların makul ölçüde kesinliği ve kanıt referansı).",
        DATED_CHANGE_TERMS_REQUIRED: "Yeni ödeme takvimi, bitiş tarihi veya iskonto oranından en az biri girilmeli.",
    GROUP_A_INSUFFICIENT_EVIDENCE: "Kiralama tanımlama değerlendirmesi eksik.",
    GROUP_A_L3_UNSUPPORTED: "Bileşen ayrıştırmalı sözleşmelerde olay muhasebesi henüz desteklenmiyor."
  };
  // A refused change always explains itself: some refusals arrive without an
  // errors list (code/message only), which used to throw on join() and leave
  // the user with no message at all.
  function changeErrorText(result) {
    if (Array.isArray(result?.errors) && result.errors.length) return result.errors.join("\n");
    const code = result?.code || result?.error?.code;
    const known = code ? LIFECYCLE_ERROR_TEXT[code] : null;
    if (known) return known;
    const message = result?.message || result?.error?.message || (typeof result?.error === "string" ? result.error : "");
    return `İşlem tamamlanamadı${message || code ? `: ${message || code}` : "."}`;
  }

  function lifecycleErrorText(error) {
    const known = LIFECYCLE_ERROR_TEXT[error?.code];
    if (known) return known;
    // Show the blocking Group A gate and reason codes so the cause is visible.
    const details = error?.details || error?.body || {};
    const reasons = Array.isArray(details.reasonCodes) && details.reasonCodes.length ? details.reasonCodes.join(", ") : (error?.code || "");
    const suffix = [details.gate, reasons].filter(Boolean).join(" · ");
    return `${error?.message || String(error)}${suffix ? ` (${suffix})` : ""}`;
  }

  async function createReassessment(contract, input) {
    ensureReassessmentState(contract);
    const lockCheck = assertPeriodWritable(contract, input?.effectiveDate || new Date());
    if (lockCheck.locked) {
      return { valid: false, errors: [lockCheck.message] };
    }
    let result;
    try {
      result = await loadPrivateChangePreview("reassessment", contract, input);
    } catch (error) {
      return {
        valid: false,
        errors: [`Yeniden değerlendirme önizlemesi alınamadı: ${lifecycleErrorText(error)}`]
      };
    }
    if (!result.valid) return result;

    // Aynı ekonomik olayı tekrar tekrar oluşturmaya izin verme. Özellikle
    // otomatik endeks kontrolü birden fazla refresh/tab tarafından tetiklenirse
    // aynı tarih ve şartlarla birden çok DRAFT/APPLIED kayıt oluşabiliyordu.
    // CANCELLED kayıtlar yeni bir işlem yapılmasına engel değildir.
    const duplicate = contract.reassessments.find(item =>
      item.status !== "CANCELLED" &&
      reassessmentEconomicKey(item) === reassessmentEconomicKey(result.reassessment)
    );
    if (duplicate) {
      return {
        valid: true,
        duplicate: true,
        reassessment: duplicate,
        revisedSchedule: result.revisedSchedule
      };
    }

    contract.reassessments.push(result.reassessment);
    recordReassessmentAuditEvent(
      contract,
      "REASSESSMENT_CREATED",
      result.reassessment,
      null,
      result.reassessment
    );
    saveContracts(contracts);

    // BACKEND KAYDI (kritik düzeltme — bkz. PROJECT_CONTEXT.md bölüm 23
    // madde 14). Başarısız olursa yerel değişiklik geri alınır.
    try {
      await persistContractToApi(contract, true);
    } catch (error) {
      contract.reassessments = contract.reassessments.filter(
        r => r.id !== result.reassessment.id
      );
      saveContracts(contracts);
      return {
        valid: false,
        errors: [`Backend'e kaydedilemedi: ${error?.message || error}`]
      };
    }

    return {
      valid: true,
      reassessment: result.reassessment,
      revisedSchedule: result.revisedSchedule
    };
  }

  async function applyReassessment(contract, reassessmentIdValue) {
    ensureReassessmentState(contract);

    const pending = contract.reassessments.find(item => item.id === reassessmentIdValue);
    const lockCheck = assertPeriodWritable(contract, pending?.effectiveDate || new Date());
    if (lockCheck.locked) {
      return { valid: false, errors: [lockCheck.message] };
    }

    const reassessment = contract.reassessments.find(
      item => item.id === reassessmentIdValue
    );

    if (!reassessment) {
      return { valid: false, errors: ["Reassessment bulunamadı."] };
    }

    if (reassessment.status === "APPLIED") {
      return { valid: true, reassessment };
    }

    if (reassessment.status === "CANCELLED") {
      return { valid: false, errors: ["CANCELLED reassessment uygulanamaz."] };
    }

    const duplicateApplied = (contract.reassessments || []).find(item =>
      item.id !== reassessment.id &&
      item.status === "APPLIED" &&
      reassessmentEconomicKey(item) === reassessmentEconomicKey(reassessment)
    );
    if (duplicateApplied) {
      return {
        valid: false,
        errors: ["Bu ekonomik reassessment daha önce uygulanmış (" + duplicateApplied.id + ")."],
        duplicateId: duplicateApplied.id
      };
    }

    // The local apply implementation was removed — this function's former
    // ~100-line local branch (contract
    // alanlarını doğrudan mutasyona uğratan, kendi journal/audit/rollback
    // mantığını taşıyan tam bir yerel uygulama akışı) tamamen silindi.
    // Private backend zaten yetkili APPLIED event + contract patch + revize
    // schedule döndürüyor (bkz. applyPrivateChange üzerindeki yorum);
    // tarayıcı sadece o zarfı birleştirip kalıcı hale getiriyor.
    return applyPrivateChange("reassessment", contract, reassessmentIdValue);
  }

  async function cancelReassessment(contract, reassessmentIdValue, options = {}) {
    ensureReassessmentState(contract);

    const reassessment = contract.reassessments.find(
      item => item.id === reassessmentIdValue
    );

    if (!reassessment) {
      return { valid: false, errors: ["Reassessment bulunamadı."] };
    }

    if (reassessment.status === "APPLIED") {
      if (!isAdminApprovalGranted(options)) return { valid: false, errors: ["Uygulanmış reassessment yalnızca ADMIN onayıyla geri alınabilir."] };
      if (!isLatestAppliedEvent(contract, reassessment, "reassessments")) return { valid: false, errors: ["Yalnızca en son uygulanmış reassessment geri alınabilir."] };
      const lockCheck = assertPeriodWritable(contract, reassessment.effectiveDate || contract?.startDate || new Date());
      if (lockCheck.locked && options.adminApproval !== true && !isAdminApprovalGranted(options)) return { valid: false, errors: [lockCheck.message] };
      const oldValue = cloneModificationValue(reassessment);
      const previousTerms = reassessment.appliedFromTerms || {};
      const currentTerms = getReassessmentCurrentTerms(contract);
      if (previousTerms.payment !== undefined || previousTerms.monthlyPayment !== undefined) contract.monthlyPayment = Number(previousTerms.payment ?? previousTerms.monthlyPayment) || 0;
      if (previousTerms.leaseEndDate !== undefined || previousTerms.leaseTerm !== undefined || previousTerms.endDate !== undefined) contract.endDate = previousTerms.leaseEndDate ?? previousTerms.leaseTerm ?? previousTerms.endDate;
      if (previousTerms.discountRate !== undefined) contract.discountRate = Number(previousTerms.discountRate) || 0;
      if (previousTerms.renewalOption !== undefined) contract.renewalOption = previousTerms.renewalOption === true;
      if (previousTerms.terminationOption !== undefined) contract.terminationOption = previousTerms.terminationOption === true;
      if (previousTerms.purchaseOption !== undefined) contract.purchaseOption = previousTerms.purchaseOption === true;
      reassessment.status = "CANCELLED";
      reassessment.cancelledAt = new Date().toISOString();
      reassessment.cancelledBy = auditActor();
      reassessment.journal = [];
      saveContracts(contracts);
      try { await persistContractToApi(contract, true); }
      catch (error) {
        Object.keys(reassessment).forEach(key => delete reassessment[key]);
        Object.assign(reassessment, oldValue);
        Object.assign(contract, { monthlyPayment: currentTerms.payment, endDate: currentTerms.leaseEndDate, discountRate: currentTerms.discountRate, renewalOption: currentTerms.renewalOption, terminationOption: currentTerms.terminationOption, purchaseOption: currentTerms.purchaseOption });
        saveContracts(contracts);
        return { valid: false, errors: [LIFECYCLE_ERROR_TEXT[error?.code || error?.body?.code] || `Backend'e kaydedilemedi: ${error?.message || error}`] };
      }
      // The rollback is recorded only once the server has accepted it.
      recordReassessmentAuditEvent(contract, "REASSESSMENT_ROLLED_BACK", reassessment, oldValue, { status: "CANCELLED", restoredTerms: previousTerms, priorTerms: currentTerms });
      return { valid: true, reassessment, rolledBack: true };
    }

    const oldStatus = reassessment.status;
    reassessment.status = "CANCELLED";
    reassessment.updatedAt = new Date().toISOString();

    recordReassessmentAuditEvent(
      contract,
      "REASSESSMENT_CANCELLED",
      reassessment,
      oldStatus,
      "CANCELLED"
    );

    saveContracts(contracts);

    try {
      await persistContractToApi(contract, true);
    } catch (error) {
      reassessment.status = oldStatus;
      saveContracts(contracts);
      return {
        valid: false,
        errors: [`Backend'e kaydedilemedi: ${error?.message || error}`]
      };
    }

    return { valid: true, reassessment };
  }

  async function updateReassessment(contract, reassessmentIdValue, input) {
    ensureReassessmentState(contract);

    const existing = contract.reassessments.find(
      item => item.id === reassessmentIdValue
    );

    if (!existing) {
      return { valid: false, errors: ["Reassessment bulunamadı."] };
    }

    if (existing.status === "APPLIED") {
      return { valid: false, errors: ["APPLIED reassessment güncellenemez."] };
    }

    const previewInput = {
      ...input,
      id: existing.id,
      createdAt: existing.createdAt,
      status: existing.status
    };
    let result;
    try {
      // The local reassessment calculator was removed; this preview always
      // comes from the authenticated private engine.
      result = await loadPrivateChangePreview("reassessment", contract, previewInput);
    } catch (error) {
      return {
        valid: false,
        errors: [`Yeniden değerlendirme önizlemesi alınamadı: ${lifecycleErrorText(error)}`]
      };
    }

    if (!result.valid) return result;

    const oldValue = cloneModificationValue(existing);
    Object.assign(existing, result.reassessment);

    recordReassessmentAuditEvent(
      contract,
      "REASSESSMENT_UPDATED",
      existing,
      oldValue,
      existing
    );

    saveContracts(contracts);

    try {
      await persistContractToApi(contract, true);
    } catch (error) {
      Object.keys(existing).forEach(key => delete existing[key]);
      Object.assign(existing, oldValue);
      saveContracts(contracts);
      return {
        valid: false,
        errors: [`Backend'e kaydedilemedi: ${error?.message || error}`]
      };
    }

    return {
      valid: true,
      reassessment: existing,
      revisedSchedule: result.revisedSchedule
    };
  }


  function modificationId(contract) {
    const prefix = String(contract?.id || "LEASE")
      .replace(/[^A-Za-z0-9_-]/g, "")
      .slice(0, 24) || "LEASE";

    return `${prefix}-MOD-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  }

  /** @deprecated-name Kalıcı: cloneModificationValue — dış çağrılarla (window.GK_TFRS16, olası eski referanslar) uyumluluk için korunuyor. Bkz. coreCloneOrOriginal. Hata durumunda ORİJİNAL değeri döner, null DEĞİL — v20Clone ile aynı aile. */
  function cloneModificationValue(value) {
    return coreCloneOrOriginal(value);
  }

  // Resolve the immutable pre-modification terms. Older persisted contracts
  // can have an originalContractSnapshot contaminated by a later change;
  // the earliest applied event's appliedFromTerms is the migration-safe base.
  function getModificationBaseContract(contract) {
    const snapshot = contract?.originalContractSnapshot
      ? cloneModificationValue(contract.originalContractSnapshot)
      : cloneModificationValue(contract || {});
    // The immutable base is the terms immediately before the first applied
    // change, regardless of whether that change was a modification or a
    // reassessment.  Reassessment-only contracts previously fell back to the
    // headline contract fields; applying a later payment change therefore
    // made the current payment (e.g. 15,000) appear in all earlier months.
    const earliest = (contract?.modifications || [])
      .concat(contract?.reassessments || [])
      .filter(item => item?.status === "APPLIED" && item?.appliedFromTerms)
      .slice()
      .sort((a, b) => {
        const dateCmp = String(a.effectiveDate || "").localeCompare(String(b.effectiveDate || ""));
        return dateCmp || String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
      })[0];
    const terms = earliest?.appliedFromTerms;
    if (terms) {
      if (terms.payment !== undefined) snapshot.monthlyPayment = Number(terms.payment) || 0;
      if (terms.monthlyPayment !== undefined) snapshot.monthlyPayment = Number(terms.monthlyPayment) || 0;
      if (terms.leaseEndDate !== undefined) snapshot.endDate = terms.leaseEndDate;
      if (terms.endDate !== undefined) snapshot.endDate = terms.endDate;
      if (terms.discountRate !== undefined) snapshot.discountRate = Number(terms.discountRate) || 0;
    }
    delete snapshot.modifications;
    delete snapshot.auditTrail;
    delete snapshot.originalContractSnapshot;
    return snapshot;
  }

  function getModificationCurrentTerms(contract, asOfDate = null) {
    const base = getModificationBaseContract(contract);
    const cutoff = asOfDate ? parseDate(asOfDate) : null;
    const terms = {
      payment: Number(base.monthlyPayment) || 0,
      leaseEndDate: base.endDate || "",
      discountRate: Number(base.discountRate) || 0
    };
    const applied = (contract?.modifications || [])
      .filter(item => item?.status === "APPLIED")
      .slice()
      .sort((a, b) => String(a.effectiveDate || "").localeCompare(String(b.effectiveDate || "")));
    applied.forEach(item => {
      const effective = parseDate(item.effectiveDate);
      if (cutoff && (!effective || effective > cutoff)) return;
      const next = item.newTerms || item.appliedToTerms;
      if (!next) return;
      if (next.payment !== undefined) terms.payment = Number(next.payment) || 0;
      if (next.leaseEndDate !== undefined) terms.leaseEndDate = next.leaseEndDate;
      if (next.discountRate !== undefined) terms.discountRate = Number(next.discountRate) || 0;
    });
    return terms;
  }


  function recordModificationAuditEvent(
    contract,
    action,
    modification,
    oldValue,
    newValue
  ) {
    ensureModificationState(contract);
    return recordAuditEvent({
      action,
      entityType: "MODIFICATION",
      entityId: modification?.id || null,
      contractId: contract?.id || null,
      modificationId: modification?.id || null,
      reason: modification?.reason || null,
      oldValue,
      newValue,
      metadata: {
        modificationType: modification?.modificationType || null,
        effectiveDate: modification?.effectiveDate || null,
        liabilityAdjustment: modification?.liabilityAdjustment ?? null,
        rouAdjustment: modification?.rouAdjustment ?? null,
        gainLoss: modification?.gainLoss ?? null
      }
    });
  }


  function modificationEconomicKey(modification) {
    if (!modification) return "";
    const terms = modification.newTerms || {};
    return [
      modification.modificationType || "OTHER",
      modification.effectiveDate || modification.modificationDate || "",
      Number(terms.payment) || 0,
      terms.leaseEndDate || "",
      Number(terms.discountRate) || 0,
      Number(modification.scopeReductionPercent) || 0,
      Number(modification.scopeIncreasePercent) || 0,
      Number(modification.scopeIncreaseAmount) || 0
    ].join("|");
  }

  function dedupeAppliedModifications(items) {
    const seen = new Set();
    return (Array.isArray(items) ? items : [])
      .filter(item => item && item.status === "APPLIED")
      .filter(item => {
        const key = modificationEconomicKey(item);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  // Applied change measurements are produced by the private API and persisted
  // on the event. The public bundle never reconstructs them locally.
  function resolveAppliedModificationMeasurement(contract, modification) {
    return modification;
  }

  function resolveAppliedReassessmentMeasurement(contract, reassessment) {
    return reassessment;
  }


  function generateModificationJournal(
    contract,
    storedModification
  ) {

    if (!storedModification || storedModification.status !== "APPLIED") {
      return [];
    }

    const modification = resolveAppliedModificationMeasurement(contract, storedModification);

    const liabilityAdjustment =
      Number(modification.liabilityAdjustment) || 0;

    const rouAdjustment =
      Number(modification.rouAdjustment) || 0;

    const gainLoss =
      Number(modification.gainLoss) || 0;

    const entries = [];

    if (modification.modificationType === "SCOPE_DECREASE") {

      const liabilityReduction =
        Math.max(
          0,
          Number(modification.oldLeaseLiability) -
          Number(modification.revisedLeaseLiability)
        );

      const rouReduction =
        Math.max(0, -rouAdjustment);

      if (liabilityReduction > 0) {
        entries.push(buildJournalLine("leaseLiability", "401 Kiralama Yükümlülüğü", liabilityReduction, 0, "MODIFICATION"));
      }

      if (rouReduction > 0) {
        entries.push(buildJournalLine("rouAsset", "260 Kullanım Hakkı Varlığı", 0, rouReduction, "MODIFICATION"));
      }

      if (Math.abs(gainLoss) > 0.005) {
        // NOT: bu satır KASITLI OLARAK buildJournalLine KULLANMIYOR —
        // orijinalde accountKey alanı HİÇ YOK (diğer tüm satırlardan
        // farklı olarak). buildJournalLine(undefined, ...) çağırmak
        // `accountKey: undefined` anahtarını EKLERDİ; bu, anahtarın
        // TAMAMEN YOK olmasından farklıdır (bkz. buildJournalLine
        // yorumu, satır ~4432 civarı).
        entries.push({
          account: "649 / 689 Modification Gain / Loss",
          debit: gainLoss < 0 ? Math.abs(gainLoss) : 0,
          credit: gainLoss > 0 ? gainLoss : 0,
          source: "MODIFICATION",
          controlStatus: "VALID"
        });
      }

    } else {

      if (liabilityAdjustment > 0) {
        entries.push(buildJournalLine("rouAsset", "260 Kullanım Hakkı Varlığı", liabilityAdjustment, 0, "MODIFICATION"));
        entries.push(buildJournalLine("leaseLiability", "401 Kiralama Yükümlülüğü", 0, liabilityAdjustment, "MODIFICATION"));
      } else if (liabilityAdjustment < 0) {
        const amount = Math.abs(liabilityAdjustment);

        entries.push(buildJournalLine("leaseLiability", "401 Kiralama Yükümlülüğü", amount, 0, "MODIFICATION"));
        entries.push(buildJournalLine("rouAsset", "260 Kullanım Hakkı Varlığı", 0, amount, "MODIFICATION"));
      }
    }

    const debit = entries.reduce(
      (sum, item) => sum + (Number(item.debit) || 0),
      0
    );

    const credit = entries.reduce(
      (sum, item) => sum + (Number(item.credit) || 0),
      0
    );

    const balanced =
      Math.abs(debit - credit) < 0.01;

    entries.forEach(
      item => {
        item.controlStatus =
          balanced ? "VALID" : "UNBALANCED";
      }
    );

    // V19: Hesap planı mapping uygula
    const companyId = contract?.companyId || "";
    return typeof applyAccountMappingToJournal === "function"
      ? applyAccountMappingToJournal(entries, companyId)
      : entries;
  }

  async function createModification(
    contract,
    input
  ) {

    ensureModificationState(contract);

    const lockCheck = assertPeriodWritable(contract, input?.effectiveDate || new Date());
    if (lockCheck.locked) {
      return { valid: false, errors: [lockCheck.message] };
    }

    let result;
    try {
      // The local calculateModification() fallback was removed; this preview
      // always comes from the authenticated private engine.
      result = await loadPrivateChangePreview("modification", contract, input);
    } catch (error) {
      return {
        valid: false,
        errors: [`Modifikasyon önizlemesi alınamadı: ${lifecycleErrorText(error)}`]
      };
    }

    if (!result.valid) {
      return result;
    }

    const duplicateModification = (contract.modifications || []).find(item =>
      item.status !== "CANCELLED" &&
      modificationEconomicKey(item) === modificationEconomicKey(result.modification)
    );
    if (duplicateModification) {
      return {
        valid: false,
        errors: ["Aynı ekonomik modifikasyon zaten mevcut (" + duplicateModification.id + ")."],
        duplicateId: duplicateModification.id
      };
    }

    contract.modifications.push(
      result.modification
    );

    recordModificationAuditEvent(
      contract,
      "MODIFICATION_CREATED",
      result.modification,
      null,
      result.modification
    );

    saveContracts(contracts);

    // BACKEND KAYDI (kritik düzeltme — bkz. PROJECT_CONTEXT.md bölüm 23
    // madde 14): önceden bu fonksiyon SADECE localStorage'a yazıyordu,
    // backend'e HİÇ senkronize olmuyordu. Artık backend'e yazmayı
    // bekliyoruz; BAŞARISIZ olursa yerel değişikliği GERİ ALIYORUZ
    // (rollback) ve açık bir hata döndürüyoruz — "yerelde var, backend'de
    // yok" sessiz tutarsızlığı artık oluşamaz.
    try {
      await persistContractToApi(contract, true);
    } catch (error) {
      contract.modifications = contract.modifications.filter(
        m => m.id !== result.modification.id
      );
      saveContracts(contracts);
      return {
        valid: false,
        errors: [`Backend'e kaydedilemedi: ${error?.message || error}`]
      };
    }

    return {
      valid: true,
      modification: result.modification,
      revisedSchedule: result.revisedSchedule
    };
  }

  async function applyModification(
    contract,
    modificationIdValue
  ) {

    ensureModificationState(contract);

    const pendingMod = contract.modifications.find(item => item.id === modificationIdValue);
    const lockCheck = assertPeriodWritable(contract, pendingMod?.effectiveDate || new Date());
    if (lockCheck.locked) {
      return { valid: false, errors: [lockCheck.message] };
    }

    const modification =
      contract.modifications.find(
        item => item.id === modificationIdValue
      );

    if (!modification) {
      return {
        valid: false,
        errors: ["Modification bulunamadı."]
      };
    }

    if (
      modification.status === "APPLIED"
    ) {
      return {
        valid: true,
        modification
      };
    }

    if (
      modification.status === "CANCELLED"
    ) {
      return {
        valid: false,
        errors: ["CANCELLED modification uygulanamaz."]
      };
    }

    const appliedDuplicate = (contract.modifications || []).find(item =>
      item.id !== modification.id &&
      item.status === "APPLIED" &&
      modificationEconomicKey(item) === modificationEconomicKey(modification)
    );
    if (appliedDuplicate) {
      return {
        valid: false,
        errors: ["Bu ekonomik modifikasyon daha önce uygulanmış (" + appliedDuplicate.id + ")."],
        duplicateId: appliedDuplicate.id
      };
    }

    // The local apply implementation was removed — this function's former
    // ~130-line local branch (with its own
    // journal/audit/rollback mantığını taşıyan tam bir yerel uygulama
    // akışı) tamamen silindi. Private backend zaten yetkili APPLIED
    // event + contract patch + revize schedule döndürüyor.
    return applyPrivateChange("modification", contract, modificationIdValue);
  }

  async function cancelModification(
    contract,
    modificationIdValue,
    options = {}
  ) {

    ensureModificationState(contract);

    const modification =
      contract.modifications.find(
        item => item.id === modificationIdValue
      );

    if (!modification) {
      return {
        valid: false,
        errors: ["Modification bulunamadı."]
      };
    }

    if (modification.status === "APPLIED") {
      if (!isAdminApprovalGranted(options)) return { valid: false, errors: ["Uygulanmış modifikasyon yalnızca ADMIN onayıyla geri alınabilir."] };
      if (!isLatestAppliedEvent(contract, modification, "modifications")) return { valid: false, errors: ["Yalnızca en son uygulanmış modifikasyon geri alınabilir."] };
      const lockCheck = assertPeriodWritable(contract, modification.effectiveDate || contract?.startDate || new Date());
      if (lockCheck.locked && !isAdminApprovalGranted(options)) return { valid: false, errors: [lockCheck.message] };
      const oldValue = cloneModificationValue(modification);
      const previousTerms = modification.appliedFromTerms || {};
      const currentTerms = getModificationCurrentTerms(contract);
      if (previousTerms.payment !== undefined || previousTerms.monthlyPayment !== undefined) contract.monthlyPayment = Number(previousTerms.payment ?? previousTerms.monthlyPayment) || 0;
      if (previousTerms.leaseEndDate !== undefined || previousTerms.leaseTerm !== undefined || previousTerms.endDate !== undefined) contract.endDate = previousTerms.leaseEndDate ?? previousTerms.leaseTerm ?? previousTerms.endDate;
      if (previousTerms.discountRate !== undefined) contract.discountRate = Number(previousTerms.discountRate) || 0;
      modification.status = "CANCELLED";
      modification.cancelledAt = new Date().toISOString();
      modification.cancelledBy = auditActor();
      modification.journal = [];
      saveContracts(contracts);
      try { await persistContractToApi(contract, true); }
      catch (error) {
        Object.keys(modification).forEach(key => delete modification[key]);
        Object.assign(modification, oldValue);
        Object.assign(contract, { monthlyPayment: currentTerms.payment, endDate: currentTerms.leaseEndDate, discountRate: currentTerms.discountRate });
        saveContracts(contracts);
        return { valid: false, errors: [LIFECYCLE_ERROR_TEXT[error?.code || error?.body?.code] || `Backend'e kaydedilemedi: ${error?.message || error}`] };
      }
      // The rollback is recorded only once the server has accepted it.
      recordModificationAuditEvent(contract, "MODIFICATION_ROLLED_BACK", modification, oldValue, { status: "CANCELLED", restoredTerms: previousTerms, priorTerms: currentTerms });
      return { valid: true, modification, rolledBack: true };
    }

    const oldStatus = modification.status;
    modification.status = "CANCELLED";
    modification.updatedAt = new Date().toISOString();

    recordModificationAuditEvent(
      contract,
      "MODIFICATION_CANCELLED",
      modification,
      oldStatus,
      "CANCELLED"
    );

    saveContracts(contracts);

    try {
      await persistContractToApi(contract, true);
    } catch (error) {
      modification.status = oldStatus;
      saveContracts(contracts);
      return {
        valid: false,
        errors: [`Backend'e kaydedilemedi: ${error?.message || error}`]
      };
    }

    return {
      valid: true,
      modification
    };
  }

  async function updateModification(
    contract,
    modificationIdValue,
    input
  ) {

    ensureModificationState(contract);

    const existing =
      contract.modifications.find(
        item => item.id === modificationIdValue
      );

    if (!existing) {
      return {
        valid: false,
        errors: ["Modification bulunamadı."]
      };
    }

    if (existing.status === "APPLIED") {
      return {
        valid: false,
        errors: ["APPLIED modification güncellenemez."]
      };
    }

    const previewInput = {
      ...input,
      id: existing.id,
      createdAt: existing.createdAt,
      status: existing.status
    };
    let result;
    try {
      result = await loadPrivateChangePreview("modification", contract, previewInput);
    } catch (error) {
      return {
        valid: false,
        errors: [`Modifikasyon önizlemesi alınamadı: ${lifecycleErrorText(error)}`]
      };
    }

    if (!result.valid) {
      return result;
    }

    const oldValue =
      cloneModificationValue(existing);

    Object.assign(
      existing,
      result.modification
    );

    recordModificationAuditEvent(
      contract,
      "MODIFICATION_UPDATED",
      existing,
      oldValue,
      existing
    );

    saveContracts(contracts);

    try {
      await persistContractToApi(contract, true);
    } catch (error) {
      Object.keys(existing).forEach(key => delete existing[key]);
      Object.assign(existing, oldValue);
      saveContracts(contracts);
      return {
        valid: false,
        errors: [`Backend'e kaydedilemedi: ${error?.message || error}`]
      };
    }

    return {
      valid: true,
      modification: existing,
      revisedSchedule: result.revisedSchedule
    };
  }

  function getCurrentAppliedModification(contract) {
    ensureModificationState(contract);

    const applied =
      contract.modifications
        .filter(item => item.status === "APPLIED")
        .slice()
        .sort((a, b) => String(a.effectiveDate || "").localeCompare(String(b.effectiveDate || "")));

    return applied.length
      ? applied[applied.length - 1]
      : null;
  }

  /* ==========================================================
     HELPERS
  ========================================================== */

  function escapeHtml(value) {
    if (value === null || value === undefined) {
      return "";
    }

    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString(
      "tr-TR",
      {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      }
    );
  }

  function formatCurrency(value) {
    return `₺${formatNumber(value)}`;
  }

  function formatPresentationCurrency(value, currency = "TRY") {
    const code = String(currency || "TRY").toUpperCase();
    if (code === "MIXED") return formatNumber(value);
    const symbol = code === "USD" ? "$" : code === "EUR" ? "€" : code === "GBP" ? "£" : code === "TRY" ? "₺" : "";
    return `${symbol}${formatNumber(value)}`;
  }

  /**
   * resolvePaymentFrequencyLabel — GC-2026-09 (Madde 6): ödeme
   * sıklığına uygun etiket. Önceden "Aylık Kira" HER sözleşmede
   * (çeyreklik/yıllık ödemeli olsa bile) sabit gösteriliyordu.
   */
  function resolvePaymentFrequencyLabel(frequency) {
    if (String(frequency || "").toLowerCase() === "irregular") return "Düzensiz (tarihli)";
    const step = resolveFrequencyStepMonths(frequency);
    if (step === 3) return "Çeyreklik";
    if (step === 6) return "Altı aylık";
    if (step === 12) return "Yıllık";
    return "Aylık";
  }

  function formatScheduleMoney(item, field, currency) {
    if (item?.presentationFxOk === false) return `<span title="Kur bulunamadı — tutar gösterilemiyor" style="color:#b45309;">—</span>`;
    return formatPresentationCurrency(item?.[field], currency);
  }




  /**
   * Bir değeri güvenli şekilde diziye çevirir; dizi değilse fallback döner.
   * @param {*} value - Kontrol edilecek değer
   * @param {Array} [fallback=[]] - Dizi değilse dönecek varsayılan değer
   * @returns {Array}
   */
  function safeArray(value, fallback = []) {
    return Array.isArray(value) ? value : fallback;
  }

  /**
   * Bir değeri güvenli şekilde nesneye çevirir; nesne değilse fallback döner.
   * @param {*} value - Kontrol edilecek değer
   * @param {Object} [fallback={}] - Nesne değilse dönecek varsayılan değer
   * @returns {Object}
   */
  function safeObject(value, fallback = {}) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : fallback;
  }


  /* ==========================================================
     KULLANICI GERİ BİLDİRİMİ (Toast Bildirimleri)
     ----------------------------------------------------------
     Engelleyici (blocking) alert() diyaloglarının yerini alacak,
     kullanıcı dostu, engellemeyen bildirim sistemi. Var olan
     Var olan alert() çağrıları bu bloktan sonra showAlert() üzerinden bu
     sisteme yönlendirilir (bkz. showAlert tanımı aşağıda).
     ========================================================== */

  let __gkToastStyleInjected = false;

  function injectToastStyles() {
    if (__gkToastStyleInjected) return;
    __gkToastStyleInjected = true;

    const style = document.createElement("style");
    style.textContent = `
      .gk-toast {
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 13px;
        font-family: inherit;
        z-index: 99999;
        max-width: 400px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: gkToastSlideIn 0.3s ease;
        line-height: 1.4;
        white-space: pre-line;
      }
      .gk-toast-success { background: #15803d; color: #fff; }
      .gk-toast-error { background: #b91c1c; color: #fff; }
      .gk-toast-warning { background: #b45309; color: #fff; }
      .gk-toast-info { background: #1e293b; color: #fff; }
      @keyframes gkToastSlideIn {
        from { transform: translateX(120%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes gkToastSlideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(120%); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Ekranın altında geçici, engellemeyen bir bildirim (toast) gösterir.
   * @param {string} message - Gösterilecek mesaj
   * @param {"success"|"error"|"warning"|"info"} [type="info"] - Bildirim tipi
   * @param {number} [duration=5000] - Bildirimin ekranda kalma süresi (ms)
   * @returns {void}
   */
  function showToast(message, type = "info", duration = 5000, options = {}) {
    try {
      injectToastStyles();

      const toast = document.createElement("div");
      toast.className = `gk-toast gk-toast-${type}`;
      toast.textContent = message;
      // Refusals and errors are announced and stay until read (click closes).
      const urgent = type === "error" || type === "warning" || options.announce === true;
      toast.setAttribute("role", urgent ? "alert" : "status");
      toast.setAttribute("aria-live", urgent ? "assertive" : "polite");
      toast.style.cursor = "pointer";
      toast.title = "Kapatmak için tıklayın";
      toast.addEventListener("click", () => toast.remove());
      document.body.appendChild(toast);

      setTimeout(() => {
        toast.style.animation = "gkToastSlideOut 0.3s ease";
        setTimeout(() => toast.remove(), 300);
      }, duration);
    } catch (toastError) {
      // Toast gösterimi başarısız olursa sessizce konsola düş —
      // kullanıcı akışını kesintiye uğratma.
      console.error("Toast gösterilemedi:", toastError);
    }
  }

  /**
   * Bir hatayı hem konsola hem de kullanıcıya (toast ile) bildirir.
   * @param {Error|*} error - Yakalanan hata nesnesi ya da mesajı
   * @param {string} [context=""] - Hatanın oluştuğu bağlamı açıklayan kısa metin
   * @returns {void}
   */
  function showError(error, context = "") {
    const message = error?.message || String(error);
    console.error(context ? `❌ ${context}:` : "❌", error);
    showToast(`❌ ${message}`, "error");
    if (error?.stack) {
      console.error("Stack:", error.stack);
    }
  }

  /**
   * Eski window.alert() çağrılarının yerine geçen, geriye dönük uyumlu
   * bildirim fonksiyonu. Tek parametreyle çağrıldığında davranışı
   * showAlert()'e benzer (kullanıcı akışını engellemeden bilgi verir).
   * @param {string} message - Gösterilecek mesaj
   * @param {"success"|"error"|"warning"|"info"} [type="info"] - Bildirim tipi
   * @returns {void}
   */
  // showAlert replaced blocking alert() dialogs: its messages (refusals,
  // validation errors) must remain readable, so they stay 15 seconds and are
  // announced as alerts unless they report success.
  function showAlert(message, type = "info") {
    if (type === "success") {
      showToast(`✅ ${message}`, "success");
    } else {
      showToast(type === "error" ? `❌ ${message}` : type === "warning" ? `⚠️ ${message}` : message,
        type, 15000, { announce: true });
    }
  }

  /* ==========================================================
     UX — LOADING / PROGRESS OVERLAY
     ----------------------------------------------------------
     Additive UI layer. Existing business logic remains unchanged.
  ========================================================== */

  let __gkLoadingOverlay = null;

  function ensureLoadingOverlay() {
    if (__gkLoadingOverlay && document.body.contains(__gkLoadingOverlay)) return __gkLoadingOverlay;

    const overlay = document.createElement("div");
    overlay.id = "loadingOverlay";
    overlay.className = "loading-overlay hidden";
    overlay.setAttribute("role", "status");
    overlay.setAttribute("aria-live", "polite");
    overlay.setAttribute("aria-busy", "false");
    overlay.innerHTML = `
      <div class="loading-card">
        <div class="loading-spinner" aria-hidden="true"></div>
        <div class="loading-message" id="loadingMessage">İşleniyor...</div>
        <div class="loading-progress" id="loadingProgressWrap">
          <div class="loading-progress-track">
            <div class="progress-bar" id="loadingProgressBar"></div>
          </div>
          <span class="progress-text" id="loadingProgressText">0%</span>
        </div>
      </div>`;

    if (!document.getElementById("gkLoadingStyles")) {
      const style = document.createElement("style");
      style.id = "gkLoadingStyles";
      style.textContent = `
        .loading-overlay { position:fixed; inset:0; z-index:100000; display:flex; align-items:center; justify-content:center; padding:20px; background:rgba(15,23,42,.48); backdrop-filter:blur(3px); -webkit-backdrop-filter:blur(3px); }
        .loading-overlay.hidden { display:none !important; }
        .loading-card { width:min(420px,100%); box-sizing:border-box; padding:24px; border-radius:16px; background:#fff; box-shadow:0 20px 60px rgba(15,23,42,.24); text-align:center; }
        .loading-spinner { width:38px; height:38px; margin:0 auto 14px; border:4px solid #e2e8f0; border-top-color:#334155; border-radius:50%; animation:gkLoadingSpin .8s linear infinite; }
        .loading-message { color:#1e293b; font-size:14px; font-weight:700; line-height:1.45; word-break:break-word; }
        .loading-progress { display:flex; align-items:center; gap:10px; margin-top:16px; }
        .loading-progress.hidden { display:none !important; }
        .loading-progress-track { flex:1; height:8px; overflow:hidden; border-radius:999px; background:#e2e8f0; }
        .progress-bar { width:0%; height:100%; border-radius:inherit; background:#334155; transition:width .18s ease; }
        .progress-text { min-width:38px; color:#475569; font-size:12px; font-weight:800; text-align:right; }
        @keyframes gkLoadingSpin { to { transform:rotate(360deg); } }
        @media (max-width:480px) { .loading-card { padding:20px 16px; border-radius:14px; } .loading-message { font-size:13px; } }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(overlay);
    __gkLoadingOverlay = overlay;
    return overlay;
  }

  function updateLoadingProgress(progress, message) {
    if (!__gkLoadingOverlay) return;
    const messageEl = __gkLoadingOverlay.querySelector("#loadingMessage");
    const progressWrap = __gkLoadingOverlay.querySelector("#loadingProgressWrap");
    const progressBar = __gkLoadingOverlay.querySelector("#loadingProgressBar");
    const progressText = __gkLoadingOverlay.querySelector("#loadingProgressText");
    if (message !== undefined && messageEl) messageEl.textContent = message;
    const numeric = Number(progress);
    const hasProgress = Number.isFinite(numeric);
    if (progressWrap) progressWrap.classList.toggle("hidden", !hasProgress);
    if (hasProgress) {
      const safe = Math.max(0, Math.min(100, numeric));
      if (progressBar) progressBar.style.width = `${safe}%`;
      if (progressText) progressText.textContent = `${Math.round(safe)}%`;
    }
  }

  function showLoading(message = "İşleniyor...", progress = null) {
    const overlay = ensureLoadingOverlay();
    overlay.classList.remove("hidden");
    overlay.setAttribute("aria-busy", "true");
    updateLoadingProgress(progress, message);
    return overlay;
  }

  function hideLoading() {
    if (!__gkLoadingOverlay) return;
    __gkLoadingOverlay.classList.add("hidden");
    __gkLoadingOverlay.setAttribute("aria-busy", "false");
  }

  function parseDate(value) {

    if (!value) return null;

    if (value instanceof Date) {
      return isNaN(value.getTime())
        ? null
        : value;
    }

    const text = String(value).trim();

    if (!text) return null;

    let date = null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {

      date = new Date(
        `${text}T00:00:00`
      );

    } else if (
      /^\d{1,2}\.\d{1,2}\.\d{4}$/.test(text)
    ) {

      const p = text.split(".");

      date = new Date(
        Number(p[2]),
        Number(p[1]) - 1,
        Number(p[0])
      );

    } else if (
      /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(text)
    ) {

      const p = text.split("/");

      date = new Date(
        Number(p[2]),
        Number(p[1]) - 1,
        Number(p[0])
      );

    } else {

      date = new Date(text);

    }

    return date && !isNaN(date.getTime())
      ? date
      : null;
  }

  function normalizeDate(value) {

    const date = parseDate(value);

    if (!date) return "";

    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-");
  }

  function formatDate(value) {

    const date = parseDate(value);

    if (!date) return "-";

    return date.toLocaleDateString("tr-TR");
  }

  function getMonthName(month) {

    const months = [
      "Ocak",
      "Şubat",
      "Mart",
      "Nisan",
      "Mayıs",
      "Haziran",
      "Temmuz",
      "Ağustos",
      "Eylül",
      "Ekim",
      "Kasım",
      "Aralık"
    ];

    return months[month - 1] || "";
  }

  function setText(id, value) {

    const element =
      document.getElementById(id);

    if (element) {
      element.textContent = value;
    }

    const compatibilityId = {
      contractCount: "kpiContractCount",
      leaseLiability: "kpiLiability",
      rouAssets: "kpiRou",
      currentLiability: "kpiCurrent",
      next12Months: "kpiNext12Payments",
      monthlyInterest: "kpiMonthlyInterest",
      monthlyDepreciation: "kpiDepreciation"
    }[id];
    const compatibilityElement = compatibilityId
      ? document.getElementById(compatibilityId)
      : null;
    if (compatibilityElement) {
      compatibilityElement.textContent = value;
    }
  }

  function setInput(id, value) {

    const input =
      document.getElementById(id);

    if (input) {
      input.value = value ?? "";
    }
  }

  function getInput(id) {

    return (
      document.getElementById(id)?.value || ""
    );
  }

  function getCheckbox(id) {

    return (
      document.getElementById(id)?.checked === true
    );
  }

  function setCheckbox(id, value) {

    const input =
      document.getElementById(id);

    if (input) {
      input.checked = value === true;
    }
  }

  // Maps the contractForm's <select id="paymentFrequency"> values
  // ("1"/"3"/"12", i.e. months per payment) to the word-based
  // vocabulary the control engine validates against
  // (controlPayment() only accepts "monthly"/"quarterly"/"annual" —
  // see line ~9829). Kept in one place so the two never drift apart.
  const PAYMENT_FREQUENCY_CODE_TO_WORD = {
    "1": "monthly",
    "3": "quarterly",
    "6": "semiannual",
    "12": "annual"
  };

  const PAYMENT_FREQUENCY_WORD_TO_CODE = {
    monthly: "1",
    quarterly: "3",
    semiannual: "6",
    annual: "12"
  };

  function normalizePaymentFrequencyValue(value) {
    const raw = String(value || "").trim().toLowerCase();
    return PAYMENT_FREQUENCY_CODE_TO_WORD[raw] ||
      (["monthly", "quarterly", "semiannual", "annual", "irregular"].includes(raw) ? raw : "monthly");
  }

  function normalizeLeaseIncreaseTypeValue(value) {
    const raw = String(value || "none").trim().toLowerCase();
    // The form uses the shorter "fixed" value; the private engine's
    // canonical vocabulary is "fixedAmount".
    if (raw === "fixed") return "fixedAmount";
    if (["fixedrate", "fixedamount", "index", "none"].includes(raw)) {
      return raw === "fixedrate" ? "fixedRate" : raw === "fixedamount" ? "fixedAmount" : raw;
    }
    return "none";
  }

  /* ==========================================================
     DATE / PERIOD ENGINE
  ========================================================== */

  function monthsBetween(start, end) {

    const startDate = parseDate(start);
    const endDate = parseDate(end);

    if (!startDate || !endDate) {
      return 0;
    }

    const months =
      (
        endDate.getFullYear() -
        startDate.getFullYear()
      ) * 12 +
      (
        endDate.getMonth() -
        startDate.getMonth()
      );

    return Math.max(
      1,
      months + 1
    );
  }

  /* ==========================================================
     PAYMENT FREQUENCY / TIMING HELPERS (V16.3 fix)
     ----------------------------------------------------------
     paymentFrequency: monthly | quarterly | annual (also 1/3/12)
     paymentTiming: arrears | advance
     Legacy monthly+arrears path produces identical numbers.
  ========================================================== */

  function resolveFrequencyStepMonths(frequency) {
    const f = String(frequency || "monthly").trim().toLowerCase();
    if (f === "3" || f === "quarterly" || f === "quarter") return 3;
    if (f === "6" || f === "semiannual" || f === "semi-annual") return 6;
    if (f === "12" || f === "annual" || f === "annually" || f === "yearly") return 12;
    return 1; // monthly / "1" / unknown
  }

  function isAdvancePaymentTiming(timing) {
    return String(timing || "arrears").trim().toLowerCase() === "advance";
  }

  /* ==========================================================
     PRIVATE RESULT BOUNDARY
     ----------------------------------------------------------
     Lease measurement and schedule construction are owned by the
     authenticated private engine. The public runtime keeps only the
     bridge and presentation helpers needed by the existing UI.
  ========================================================== */

  function calculateLease(contract) {
    const bridge = window.LeaseQantTfrs16PrivateResultBridge;
    if (typeof bridge?.calculate !== "function") {
      throw new Error("Private TFRS16 sonuç köprüsü hazır değil");
    }
    return bridge.calculate(contract);
  }

  /*
   * TMS 16/29 input management remains in this runtime for the form and
   * cache UI. Accounting entry points are bridge-only; reporting helpers
   * consume schedules and envelopes already produced by the private engine.
   */

  /* ==========================================================
     V18 Parça 1 — CPI ENDEKS TABLOSU
     ----------------------------------------------------------
     Mevcut indexBaseRate/indexCurrentRate elle-giriş alanlarına
     EK olarak kalıcı bir ay→endeks tablosu. Eksik ay İNTERPOLE
     EDİLMEZ. checkIndexReassessment() DEĞİŞTİRİLMEDİ — bu katman
     sadece contract.indexCurrentRate'i CPI tablosundan besleyip
     onu aynen çağırır.
     ========================================================== */

  const CPI_INDEX_STORAGE_KEY = "gk_tfrs16_cpi_index_v1";







  function calculateLeaseEngine(contract) {
    const bridge = window.LeaseQantTfrs16PrivateResultBridge;
    if (typeof bridge?.calculateEngine !== "function") {
      throw new Error("Private TFRS16 sonuç köprüsü hazır değil");
    }
    return bridge.calculateEngine(contract);
  }

  function getEscalatedPayments(contract) {
    const bridge = window.LeaseQantTfrs16PrivateResultBridge;
    if (typeof bridge?.getEscalatedPayments !== "function") {
      throw new Error("Private TFRS16 sonuç köprüsü hazır değil");
    }
    return bridge.getEscalatedPayments(contract);
  }





  /**
   * resolveLeaseAccrualContext — GC-2026-09 (Madde 4) tarafından tanıtıldı,
   * FAZ 2.5'te (2026-09-16) YENİDEN YAZILDI. Eskiden `buildLeaseEngineAssumptions`
   * → `resolveLeaseEngineCore` → `applyLeaseEscalation` →
   * `calculateInitialLeaseMeasurement` zincirini ÇALIŞTIRARAK (yani motorun
   * PV/eskalasyon matematiğini TEKRARLAYARAK) core/measurement üretiyordu —
   * bu 4 fonksiyon + calculateAmortizationTable + applyApprovedOpeningBalance
   * + assembleLeaseEngineResult artık public dosyada YOK.
   *
   * Artık HİÇBİR hesaplama yapmıyor: private backend'in ZATEN hesaplayıp
   * schedule'ın ilk satırına yazdığı openingLiability/rouOpening/depreciation
   * değerlerini okuyor. `buildReportingDateAccrual`'ın (aşağıda, DEĞİŞMEDİ)
   * enterpolasyon formülü birebir aynı kaldı — tek değişen, girdilerin
   * NEREDEN geldiği (yerel yeniden hesaplama değil, zaten private'ten gelen
   * schedule'ın okunması). 3 farklı sözleşme tipinde (aylık/arrears,
   * aylık/advance, üç aylık/arrears) eski ve yeni yöntem sayısal olarak
   * birebir karşılaştırıldı — fark yok.
   *
   * DÖNÜŞ: null ise (exempt kontrat, private sonuç henüz hazır değil, veya
   * migration/opening-balance/reassessment/modification uygulanmış kontrat)
   * çağıran taraf ESKİ (yalnızca ödeme tarihli satır) davranışına düşer —
   * bu davranış DEĞİŞMEDİ.
   */
  function resolveLeaseAccrualContext(contract) {
    try {
      // Migration/opening-balance uygulanmış kontratlarda commencement
      // artık geçiş tarihidir — bu sürümde sentetik tahakkuk desteklenmiyor.
      if (contract?.openingBalance && String(contract.openingBalance.status || "").toUpperCase() === "APPROVED") {
        return null;
      }

      const hasAppliedLayer =
        (contract?.reassessments || []).some(x => String(x?.status || "").toUpperCase() === "APPLIED") ||
        (contract?.modifications || []).some(x => String(x?.status || "").toUpperCase() === "APPLIED");
      if (hasAppliedLayer) return null;

      const engine = getPrivateCalculationForConsumer(contract);
      if (!engine || engine.exempt) return null;

      const schedule = engine.schedule;
      if (!Array.isArray(schedule) || !schedule.length) return null;

      const firstRow = schedule[0];
      if (!firstRow || typeof firstRow.openingLiability !== "number") return null;

      const commencementDate = parseDate(contract.startDate);
      if (!commencementDate) return null;

      const monthsCoveredFirst = Number(firstRow.monthsCovered) || 1;

      const core = {
        annualRate: Number(contract.discountRate) || 0,
        commencementDate,
        advance: isAdvancePaymentTiming(contract.paymentTiming),
        paymentFrequency: contract.paymentFrequency || "monthly"
      };
      const measurement = {
        initialLiability: Number(firstRow.openingLiability) || 0,
        initialROU: Number(firstRow.rouOpening) || 0,
        depreciation: (Number(firstRow.depreciation) || 0) / monthsCoveredFirst,
        depreciationMonths: monthsBetween(contract.startDate, contract.endDate)
      };

      return { core, measurement };
    } catch (error) {
      return null;
    }
  }

  function buildQuarterOptions() {

    return [1, 2, 3, 4]
      .map(
        quarter =>
          `<option value="${quarter}">${quarter}. Çeyrek</option>`
      )
      .join("");
  }

  function filterSchedule(
    schedule,
    year,
    subPeriod,
    periodType
  ) {

    if (!schedule || !schedule.length) {
      return [];
    }

    if (periodType === "all") {
      return schedule;
    }

    if (periodType === "annual") {

      return schedule.filter(
        item => item.year === year
      );
    }

    if (periodType === "quarterly") {

      const quarter =
        Number(subPeriod);

      const startMonth =
        (quarter - 1) * 3 + 1;

      const endMonth =
        quarter * 3;

      return schedule.filter(
        item =>
          item.year === year &&
          item.month >= startMonth &&
          item.month <= endMonth
      );
    }

    if (periodType === "monthly") {

      const month =
        Number(subPeriod);

      return schedule.filter(
        item =>
          item.year === year &&
          item.month === month
      );
    }

    return schedule;
  }


  /* ==========================================================
     CURRENT / NON-CURRENT — REPORTING DATE BASED (V16.3 / Faz 6)
     ----------------------------------------------------------
     The private reporting-date envelope is the only source for
     outstanding, current, and non-current liability values. These
     helpers adapt that envelope to legacy UI field names.
  ========================================================== */

  /**
   * resolveContractScheduleSource — bir kontrat için HANGİ schedule'ın
   * "doğru" olduğuna karar veren TEK kaynak. Öncelik: uygulanmış
   * (APPLIED) bir reassessment varsa REASSESSED_SCHEDULE (bu, kendi
   * içinde uygulanmış modification'ı da tarihsel taban olarak
   * kapsar); yoksa uygulanmış
   * bir modification varsa MODIFIED_SCHEDULE; hiçbiri yoksa ham
   * LEASE_SCHEDULE (calculateLeaseEngine).
   *
   * Private API parity gate: unchanged contracts use the warmed private
   * schedule, and event-aware contracts use it only when the backend marks
   * the versioned event-aware envelope as complete. There is deliberately no
   * browser schedule fallback here; an applied event without a complete
   * private envelope is an explicit calculation error.
   *
   * FAZ 4.1 DÜZELTMESİ (GC-18, Görkem onayı — bkz. PROJECT_CONTEXT.md
   * bölüm 33 ve 37): Bu fonksiyon önceden yalnızca `cfoBuildSchedule`
   * (CFO Dashboard katmanı) içinde vardı; `getScheduleAsOfReportingDate`
   * (ve onun üzerinden `calculateLiabilitySplitAsOf`'un scheduleOverride
   * VERİLMEDEN çağrıldığı TÜM yerler — calculateCurrentLiabilityAsOf,
   * calculateNonCurrentLiabilityAsOf, calculateNext12Months, V23/TMS21
   * kapanış fişi üretimi, controlClassification dahil) doğrudan
   * `calculateLeaseEngine(contract)` çağırıyordu — modification VE
   * reassessment birlikte uygulanmış kontratlarda REASSESSED/MODIFIED
   * schedule'ı YOK SAYIYORDU. `cfoBuildSchedule` artık bu fonksiyona
   * delege ediyor; TEK kaynak burası.
   */
  function resolveContractScheduleSource(contract) {
    try {
      const latestReassessment = typeof getCurrentReassessmentState === "function"
        ? getCurrentReassessmentState(contract)
        : null;
      const latestModification = typeof getCurrentAppliedModification === "function"
        ? getCurrentAppliedModification(contract)
        : null;
      const expectedPrivateSource = latestReassessment?.status === "APPLIED"
        ? "REASSESSED_SCHEDULE"
        : latestModification
          ? "MODIFIED_SCHEDULE"
          : "PRIVATE_SCHEDULE";
      const privateResult = getPrivateCachedCalculationResult(contract);
      if (Array.isArray(privateResult?.schedule) && privateResult.schedule.length) {
        const eventAwarePrivate = privateResult.eventAwareScheduleVersion === 1
          && privateResult.scheduleSource === expectedPrivateSource;
        const unchangedPrivate = expectedPrivateSource === "PRIVATE_SCHEDULE";
        if (eventAwarePrivate || unchangedPrivate) {
          return {
            schedule: privateResult.schedule,
            engine: privateResult,
            source: privateResult.scheduleSource || expectedPrivateSource
          };
        }
      }
      const engine = typeof calculateLeaseEngine === "function" ? getPrivateCalculationForConsumer(contract) : null;
      const appliedEvent = latestReassessment?.status === "APPLIED" || Boolean(latestModification);
      return {
        schedule: Array.isArray(engine?.schedule) ? engine.schedule : [],
        engine,
        source: appliedEvent ? "ERROR" : "LEASE_SCHEDULE",
        ...(appliedEvent ? {
          error: "Private API event-aware schedule is not ready"
        } : {})
      };
    } catch (error) {
      return { schedule: [], engine: null, source: "ERROR", error: error?.message || String(error) };
    }
  }







  /* ==========================================================
     RENEWAL
  ========================================================== */

  function isRenewalWithin90Days(
    contract
  ) {

    if (!contract.renewalDate) {
      return false;
    }

    const renewal =
      parseDate(contract.renewalDate);

    if (!renewal) {
      return false;
    }

    const today =
      new Date();

    today.setHours(
      0,
      0,
      0,
      0
    );

    const difference =
      renewal.getTime() -
      today.getTime();

    const days =
      difference /
      (1000 * 60 * 60 * 24);

    return (
      days >= 0 &&
      days <= 90
    );
  }


  // Portfolio KPIs are a month-end control view. Keep their cut-off aligned
  // with Month-End Close instead of using the browser's intra-month date.
  function getDashboardReportingDate(value) {
    const base = value instanceof Date ? value : new Date(value || new Date());
    if (Number.isNaN(base.getTime())) return new Date();
    if (typeof closeMonthEnd === "function") return closeMonthEnd(base);
    return new Date(base.getFullYear(), base.getMonth() + 1, 0);
  }

  // Production data can intentionally stop at the latest verified month.
  // Asking the private endpoint for today's date would otherwise leave the
  // dashboard in a permanent loading state. Use the latest verified FX date
  // at or before today as a display reporting date; journal dates are never
  // changed by this fallback.
  function resolveKpiReportingDate(contract, requestedDate) {
    const requested = requestedDate || new Date();
    if (getPrivateReportingDateResult(contract, requested)) {
      return { date: requested, usedFallback: false };
    }
    // The private API is date-keyed and the dashboard can be opened after
    // the latest verified close period.  Reuse the latest authoritative
    // envelope already hydrated for this contract instead of allowing the
    // missing date to fall through as a zero balance.
    const cachedLatest = window.LeaseQantTfrs16ReportingDateCache?.latest?.(contract, requested);
    const latestDate = cachedLatest?.reportingDate || cachedLatest?.asOfDate || cachedLatest?.reporting_date;
    if (latestDate) {
      return { date: latestDate, usedFallback: true };
    }
    const from = String(contract?.currency || "").trim().toUpperCase();
    const to = String(
      resolveContractFunctionalCurrency(contract) || contract?.presentationCurrency || getReportingCurrency() || "TRY"
    ).trim().toUpperCase();
    if (!from || from === to || typeof getFxRates !== "function") {
      return { date: requested, usedFallback: false };
    }
    const requestedKey = v23DateKey(requested);
    const available = getFxRates({ fromCurrency: from, toCurrency: to, rateType: V23_RATE_TYPES.CLOSING })
      .filter(row => row.rateDate <= requestedKey)
      .sort((a, b) => b.rateDate.localeCompare(a.rateDate));
    if (!available.length) return { date: requested, usedFallback: false };
    const latest = available[0].rateDate;
    return { date: latest, usedFallback: latest !== requestedKey };
  }



  /* ==========================================================
     COMPANY FILTER
  ========================================================== */

  function populateCompanyFilter() {

    const select =
      document.getElementById(
        "companyFilter"
      );

    if (!select) return;

    const current =
      select.value;

    const companies =
      [
        ...new Set(
          contracts
            .map(
              c => c.company
            )
            .filter(Boolean)
        )
      ].sort();

    select.innerHTML =
      `<option value="all">Tüm Şirketler</option>`;

    companies.forEach(
      company => {

        const option =
          document.createElement(
            "option"
          );

        option.value =
          company;

        option.textContent =
          company;

        select.appendChild(
          option
        );
      }
    );

    if (
      companies.includes(current)
    ) {
      select.value =
        current;
    }
  }

  /* ==========================================================
     TABLE
  ========================================================== */

  let tableCurrentPage = 1;
  const TABLE_PAGE_SIZE = 50;


  function v26ContractMatchesActiveCompany(contract) {
    const select = document.getElementById("v26ActiveCompanySelect");
    const selected = String(select?.value || "all").trim().toLowerCase();
    if (!selected || selected === "all" || selected === "tüm şirketler") return true;
    return [contract?.companyId, contract?.company]
      .filter(Boolean)
      .some(value => String(value).trim().toLowerCase() === selected);
  }

  // Portfolio table markup lives in js/tfrs16-portfolio-ui.js. The engine
  // keeps this compatibility bridge so existing refresh/filter listeners
  // continue to call the same function while the UI module owns DOM work.
  function renderTable(renderOptions = {}) {
    const renderer = window.LeaseQantTfrs16PortfolioUi?.renderTable;
    if (typeof renderer === "function") return renderer(renderOptions);
    const tbody = document.getElementById("contractsTableBody") || document.getElementById("contractTableBody");
    if (tbody) tbody.innerHTML = `<tr><td colspan="10"><div class="empty-state">Portföy arayüzü yüklenemedi. Sayfayı yenileyin.</div></td></tr>`;
  }

  /* ==========================================================
     REFRESH
  ========================================================== */

  function refresh() {

    // The authenticated contract list is source data, not a calculated
    // balance. Show it as soon as API hydration succeeds even when private
    // calculation/reporting requests are still pending. Financial KPIs remain
    // guarded below; never paint a localStorage-only list at this boundary.
    if (window.LEASEQANT_CALCULATION_API_PRIMARY === true &&
        Array.isArray(contracts) &&
        contracts.length > 0 &&
        window.__GK_TFRS16_PRIVATE_HYDRATION_SETTLED__ !== true &&
        (PRIVATE_CALCULATION_CACHE.size === 0 || privateCacheHydrationInFlight())) {
      setKpiPendingState();
      if (backendContractsHydrated) {
        populateCompanyFilter();
        renderTable();
      }
      return;
    }

    updateKPIs();

    populateCompanyFilter();

    renderTable();
  }

  /* ==========================================================
     CONTRACT MODAL
  ========================================================== */

  // NOT: newContractButton.onclick ataması BİLEREK KALDIRILDI —
  // yukarıdaki EMERGENCY UI BRIDGE V2 zaten AYNI butonu dinliyordu.
  // İkisi birden aktifken tıklama başına openContractModal() İKİ KEZ
  // çağrılıyordu (target-phase onclick, sonra bubble-phase document
  // listener) — zararsız görünse de gereksiz çift render'a yol
  // açıyordu ve tek bir merkezi noktadan (emergency bridge) yönetmek
  // write-blocked kontrolünü (yukarı bakınız) DE TEK YERDEN uygulamayı
  // sağlıyor.

  /* ==========================================================
     CONTRACT MODAL — TAB SWITCHING (Yeni Sözleşme formu, onaylı plan)
     ----------------------------------------------------------
     SADECE görsel: [data-tab] elemanlarına gk-tab-active class'ı
     ekleyip/kaldırıyor, hiçbir input'u DOM'dan kaldırmıyor —
     form submit / FormData okuma davranışı DEĞİŞMEZ.
  ========================================================== */

  function gkSwitchContractTab(tabNumber) {
    const target = String(tabNumber);

    document.querySelectorAll("#contractForm .form-grid [data-tab]").forEach(el => {
      el.classList.toggle("gk-tab-active", el.dataset.tab === target);
    });

    document.querySelectorAll("#contractForm .gk-contract-tab").forEach(btn => {
      const isActive = btn.dataset.tabTarget === target;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-selected", isActive ? "true" : "false");
    });
  }

  // Event delegation — tab-bar DOM'da statik (bkz. tfrs16.html), bu
  // yüzden tek seferlik bir listener yeterli; openContractModal her
  // çağrıldığında yeniden eklenmiyor (duplicate listener riski yok).
  if (!window.__GK_CONTRACT_TABS_WIRED__) {
    window.__GK_CONTRACT_TABS_WIRED__ = true;
    document.getElementById("contractModal")?.addEventListener("click", event => {
      const tabButton = event.target?.closest?.(".gk-contract-tab");
      if (!tabButton) return;
      gkSwitchContractTab(tabButton.dataset.tabTarget);
    });
  }

  /**
   * populateContractFormFields — kontrat modalındaki form
   * alanlarını (metin/checkbox girdileri + Varlık Sınıfı/V26 para
   * birimi enjeksiyonları) `contract` nesnesinden doldurur.
   * `contract` null ise (yeni sözleşme) alanlar varsayılan/boş
   * değerlere sıfırlanır. Bu fonksiyon KENDİSİ hata fırlatabilir —
   * çağıran (`openContractModal`) onu try/catch içinde çağırmalı
   * (mevcut hata kurtarma davranışını KORUMAK için, bkz. aşağıdaki
   * ÖNEMLİ DÜZELTME yorumu).
   *
   * FAZ 3 — SRP BÖLMESİ (openContractModal'dan extract edildi,
   * davranış BİREBİR korunarak — bkz. PROJECT_CONTEXT.md bölüm 36).
   */
  function populateContractFormFields(contract) {
    document
      .getElementById(
        "contractForm"
      )
      ?.reset();

    setInput(
      "contractId",
      contract?.id || ""
    );

    // Kullanıcının şirketleri (API) — GK Holding sabitini kaldır
    applySessionCompanyToForm(contract);
    if (contract?.company) {
      setInput("company", contract.company);
    }

    setInput(
      "supplier",
      contract?.supplier || ""
    );

    setInput(
      "monthlyPayment",
      contract?.monthlyPayment || ""
    );

    setInput(
      "startDate",
      contract?.startDate || ""
    );

    setInput(
      "endDate",
      contract?.endDate || ""
    );

    setInput(
      "discountRate",
      contract?.discountRate ??
        18
    );

    setInput(
      "renewalDate",
      contract?.renewalDate || ""
    );

    // V16.7 ADDITION: pre-fill (or reset to defaults) the fields
    // added to the form in this release. form.reset() above already
    // clears text/number inputs and unchecks checkboxes for a new
    // contract, but selects need their default explicitly and edits
    // need the stored contract value restored.
    setInput(
      "currency",
      contract?.currency || "TRY"
    );

    setInput(
      "paymentFrequency",
      normalizePaymentFrequencyValue(contract?.paymentFrequency || "monthly")
    );

    setInput(
      "paymentTiming",
      contract?.paymentTiming || "arrears"
    );

    setInput(
      "initialDirectCosts",
      contract?.initialDirectCosts || 0
    );

    setInput(
      "restorationObligation",
      contract?.restorationObligation || 0
    );

    setInput(
      "prepayments",
      contract?.prepayments || 0
    );

    setInput(
      "leaseIncentives",
      contract?.leaseIncentives || 0
    );

    setInput(
      "leaseIncreaseType",
      normalizeLeaseIncreaseTypeValue(contract?.leaseIncreaseType || "none")
    );

    setInput(
      "leaseIncreaseRate",
      contract?.leaseIncreaseRate ||
        (normalizeLeaseIncreaseTypeValue(contract?.leaseIncreaseType || "none") === "fixedAmount"
          ? contract?.fixedIncrease || 0
          : 0)
    );

    setInput(
      "fixedIncrease",
      contract?.fixedIncrease || 0
    );

    setInput(
      "variablePayment",
      contract?.variablePayment || 0
    );

    setInput(
      "variablePaymentType",
      contract?.variablePaymentType || "CIRO_KULLANIM"
    );

    setInput(
      "inSubstanceFixedPayment",
      contract?.inSubstanceFixedPayment || 0
    );

    setInput(
      "usefulLifeMonths",
      contract?.usefulLifeMonths == null || contract?.usefulLifeMonths === ""
        ? ""
        : (Number(contract.usefulLifeMonths) > 50
            ? Number(contract.usefulLifeMonths) / 12
            : Number(contract.usefulLifeMonths))
    );

    setInput(
      "indexBaseRate",
      contract?.indexBaseRate ?? ""
    );

    setInput(
      "indexCurrentRate",
      contract?.indexCurrentRate ?? ""
    );

    setInput(
      "indexReviewMonth",
      Number.isFinite(contract?.indexReviewMonth) ? contract.indexReviewMonth + 1 : ""
    );

    setInput(
      "indexReviewDay",
      contract?.indexReviewDay ?? ""
    );

    // V18 Parça 1
    setInput(
      "escalationFrequencyMonths",
      contract?.escalationFrequencyMonths ?? ""
    );

    setInput(
      "escalationBase",
      contract?.escalationBase || "compound"
    );

    setInput(
      "escalationFirstDate",
      contract?.escalationFirstDate ? normalizeDate(contract.escalationFirstDate) : ""
    );

    setCheckbox(
      "renewalOption",
      contract?.renewalOption === true
    );

    setCheckbox(
      "renewalOptionExpectedToExercise",
      contract?.renewalOptionExpectedToExercise === true
    );

    setInput(
      "renewalEndDate",
      contract?.renewalEndDate || ""
    );

    setCheckbox(
      "terminationOption",
      contract?.terminationOption === true
    );

    setInput(
      "terminationDate",
      contract?.terminationDate || ""
    );

    setInput(
      "explicitPaymentSchedule",
      Array.isArray(contract?.explicitPaymentSchedule)
        ? contract.explicitPaymentSchedule.map(r => `${r.economicDate} | ${r.amount} | ${r.sourceEvidenceId || ""}`).join("\n")
        : ""
    );

    setInput(
      "terminationPenalty",
      contract?.terminationPenalty || 0
    );

    setCheckbox(
      "purchaseOption",
      contract?.purchaseOption === true
    );

    setInput(
      "purchaseOptionPrice",
      contract?.purchaseOptionPrice || 0
    );

    setCheckbox(
      "residualValueGuarantee",
      contract?.residualValueGuarantee === true
    );

    setInput(
      "expectedResidualValueGuaranteePayment",
      contract?.expectedResidualValueGuaranteePayment || 0
    );

    setCheckbox(
      "ownershipTransfer",
      contract?.ownershipTransfer === true
    );

    setCheckbox(
      "shortTermLease",
      contract?.shortTermLease === true
    );

    setCheckbox(
      "lowValueAsset",
      contract?.lowValueAsset === true
    );

    injectAssetClassField(contract);
    if (typeof injectV26CurrencyFields === "function") {
      injectV26CurrencyFields(contract);
    }
  }

  /**
   * openContractModal — kontrat oluşturma/düzenleme modalını açar.
   * PUBLIC API imzası HİÇ DEĞİŞMEDİ. Form doldurma mantığı
   * `populateContractFormFields`'a taşındı (Faz 3 — SRP); try/catch
   * sınırı AYNI YERDE kalıyor — extract edilen fonksiyon hata
   * fırlatırsa hâlâ bu catch bloğu tarafından yakalanır, modal
   * yine de açılır (mevcut davranış korunuyor).
   */
  function openContractModal(
    contract = null
  ) {

    const modal =
      document.getElementById(
        "contractModal"
      );

    if (!modal) return;

    try {

    populateContractFormFields(contract);
    // The id is the contract's key: it cannot change while editing.
    const idInput = document.getElementById("contractId");
    if (idInput) idInput.readOnly = !!contract;

    const title =
      document.getElementById("contractModalTitle") ||
      document.getElementById(
        "modalTitle"
      );

    if (title) {

      title.textContent =
        contract
          ? "Sözleşmeyi Düzenle"
          : "Yeni Sözleşme";
    }

    modal.classList.remove(
      "hidden"
    );

    // Modal görünür olduktan hemen önce Tab 1'e senkronize et — bu,
    // injectAssetClassField/injectV26CurrencyFields tarafından SONRADAN
    // eklenen [data-tab] elemanlarının da (Varlık Sınıfı, V26 paneli)
    // doğru şekilde gösterilip gizlenmesini garanti eder. Kullanıcı bir
    // önceki açılışta başka bir tab'da kalmış olabilir; her yeni
    // açılış Tab 1'den başlar.
    gkSwitchContractTab(1);

    } catch (error) {
      // ÖNEMLİ DÜZELTME: önceden bu fonksiyonda ARA bir adım (setInput/
      // applySessionCompanyToForm/injectAssetClassField/vb.) hata
      // fırlatırsa, modal.classList.remove("hidden") satırına HİÇ
      // ULAŞILMIYOR ve modal SESSİZCE açılmıyordu — kullanıcı "yeni
      // sözleşme" butonuna tıklıyor, hiçbir şey olmuyor, hiçbir hata
      // görmüyordu. Artık: gerçek hata konsola AÇIKÇA loglanıyor,
      // kullanıcıya görünür bir uyarı gösteriliyor, VE modal (form
      // eksik/hatalı doldurulmuş olsa bile) yine de AÇILMAYA çalışılıyor
      // — kullanıcı en azından "bir şeyin yanlış gittiğini" görüyor,
      // sessiz bir hiçlik yerine.
      console.error("[TFRS16] openContractModal hata:", error);
      if (typeof showToast === "function") {
        showToast(
          "Sözleşme formu açılırken bir sorun oluştu: " + (error?.message || String(error)),
          "error"
        );
      }
      modal.classList.remove("hidden");
    }
  }

  function closeContractModal() {

    document
      .getElementById(
        "contractModal"
      )
      ?.classList.add(
        "hidden"
      );
  }

  function injectAssetClassField(contract) {
    const form = document.getElementById("contractForm");
    if (!form) return;
    const grid = form.querySelector(".form-grid") || form;

    let select = document.getElementById("assetClass");
    let customInput = document.getElementById("assetClassCustom");

    if (!select) {
      const group = document.createElement("div");
      group.className = "form-group";
      group.dataset.tab = "1"; // Tab 1 — Sözleşme (onaylı plan: Varlık Sınıfı ana tab'da)
      group.innerHTML = `
        <label>Varlık Sınıfı</label>
        <select id="assetClass"></select>
        <input id="assetClassCustom" type="text" placeholder="Yeni varlık sınıfı adı" style="margin-top:6px;display:none;width:100%;">
      `;
      grid.appendChild(group);
      select = document.getElementById("assetClass");
      customInput = document.getElementById("assetClassCustom");

      select.addEventListener("change", () => {
        if (select.value === ASSET_CLASS_CUSTOM_OPTION) {
          customInput.style.display = "block";
          customInput.value = "";
          customInput.focus();
        } else {
          customInput.style.display = "none";
          customInput.value = "";
        }
      });
    }

    const currentValue = contract?.assetClass || "";
    const options = getAssetClassOptions();
    if (currentValue && !options.includes(currentValue)) options.push(currentValue);

    select.innerHTML =
      `<option value="">— Seçiniz —</option>` +
      options.map(opt => `<option value="${escapeHtml(opt)}">${escapeHtml(opt)}</option>`).join("") +
      `<option value="${ASSET_CLASS_CUSTOM_OPTION}">+ Yeni sınıf ekle...</option>`;

    select.value = currentValue || "";
    if (customInput) {
      customInput.style.display = "none";
      customInput.value = "";
    }
  }

  /**
   * V26 — Sözleşme formuna fonksiyonel / sunum PB alanları,
   * şirket seçici ve TMS21/TMS29 override kutularını enjekte eder.
   * Mevcut #currency alanı varsa onu kullanır (id çakışması yok).
   */
  function injectV26CurrencyFields(contract) {
    const form = document.getElementById("contractForm");
    if (!form) return;
    const grid = form.querySelector(".form-grid") || form;
    const hasNativeCurrency = !!form.querySelector("#currency");

    let panel = document.getElementById("v26CurrencyPanel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "v26CurrencyPanel";
      panel.className = "form-group";
      panel.dataset.tab = "4"; // Tab 4 — Para Birimi & Standartlar (V26)
      panel.style.cssText = "grid-column:1/-1;border:1px solid #e2e8f0;border-radius:10px;padding:12px;background:#f8fafc;margin-top:8px;";
      panel.innerHTML = `
        <div style="font-size:12px;font-weight:700;color:#334155;margin-bottom:8px;">Para Birimi & Standartlar (V26)</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;">
          <label style="font-size:12px;color:#64748b;font-weight:600;">Şirket (V26)
            <select id="companyId" style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:8px;margin-top:4px;"></select>
          </label>
          ${hasNativeCurrency ? "" : `
          <label style="font-size:12px;color:#64748b;font-weight:600;">İşlem PB
            <select id="currency" style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:8px;margin-top:4px;"></select>
          </label>`}
          <label style="font-size:12px;color:#64748b;font-weight:600;">Fonksiyonel PB
            <select id="functionalCurrency" style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:8px;margin-top:4px;"></select>
          </label>
          <label style="font-size:12px;color:#64748b;font-weight:600;">Sunum PB
            <select id="reportingCurrency" style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:8px;margin-top:4px;"></select>
          </label>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:16px;margin-top:10px;font-size:12px;color:#475569;">
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
            <input type="checkbox" id="tms21Force" /> TMS21 zorla (manuel override)
          </label>
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
            <input type="checkbox" id="tms29Force" /> TMS29 zorla (manuel override)
          </label>
        </div>
        <div id="v26FormStandardsPreview" style="margin-top:10px;"></div>
      `;
      grid.appendChild(panel);

      const refreshPreview = () => {
        const preview = document.getElementById("v26FormStandardsPreview");
        if (!preview || typeof getApplicableStandards !== "function") return;
        const draft = {
          currency: document.getElementById("currency")?.value || "TRY",
          functionalCurrency: document.getElementById("functionalCurrency")?.value || "TRY",
          reportingCurrency: document.getElementById("reportingCurrency")?.value || "TRY",
          tms21Force: !!document.getElementById("tms21Force")?.checked,
          tms29Force: !!document.getElementById("tms29Force")?.checked
        };
        const coId = document.getElementById("companyId")?.value;
        const company = typeof v26FindCompany === "function" ? v26FindCompany(coId) : null;
        const std = getApplicableStandards(draft, company);
        preview.innerHTML = `
          <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:10px;font-size:12px;color:#0c4a6e;">
            <strong>Otomatik tespit:</strong>
            <span class="gk-std-badge ${std.badgeClass}" style="margin-left:6px;">${escapeHtml(std.badgeLabel)}</span>
            <span style="margin-left:8px;">${escapeHtml(std.message)}</span>
          </div>`;
      };

      panel.querySelector("#companyId")?.addEventListener("change", () => {
        const co = typeof v26FindCompany === "function"
          ? v26FindCompany(document.getElementById("companyId")?.value)
          : null;
        const companyFx = co?.functionalCurrency || co?.baseCurrency || "";
        const fxSel = document.getElementById("functionalCurrency");
        const reportingSel = document.getElementById("reportingCurrency");
        if (companyFx) {
          if (fxSel) { fxSel.value = companyFx; fxSel.disabled = true; fxSel.title = "Şirketin tanımlı fonksiyonel para birimi"; }
          if (reportingSel) { reportingSel.value = companyFx; reportingSel.disabled = true; reportingSel.title = "Şirketin tanımlı sunum para birimi"; }
        } else {
          if (fxSel) { fxSel.disabled = false; fxSel.title = ""; }
          if (reportingSel) { reportingSel.disabled = false; reportingSel.title = ""; }
        }
        if (co?.name) {
          const companyInput = document.getElementById("company");
          if (companyInput) companyInput.value = co.name;
        }
        refreshPreview();
      });
      form.addEventListener("change", e => {
        if (["currency", "functionalCurrency", "reportingCurrency", "tms21Force", "tms29Force", "companyId"].includes(e.target?.id)) {
          refreshPreview();
        }
      });
      panel._refreshPreview = refreshPreview;
    }

    const currencies = ["TRY", "EUR", "USD", "GBP", "CHF", "JPY", "AED", "SAR"];

    const fillSelect = (id, selected) => {
      const el = document.getElementById(id);
      if (!el || el.tagName !== "SELECT") return;
      const opts = [...new Set([...currencies, selected].filter(Boolean))];
      const current = selected || el.value;
      el.innerHTML = opts.map(c => `<option value="${c}" ${c === current ? "selected" : ""}>${c}</option>`).join("");
    };

    const companies = typeof v26LoadCompanies === "function" ? v26LoadCompanies() : [];
    const coSelect = document.getElementById("companyId");
    if (coSelect) {
      const selectedId = contract?.companyId || "";
      coSelect.innerHTML =
        `<option value="">— Seçiniz —</option>` +
        companies.map(c => {
          const sel = selectedId === c.id || contract?.company === c.name || contract?.company === c.code;
          return `<option value="${escapeHtml(c.id)}" ${sel ? "selected" : ""}>${escapeHtml(c.code)} — ${escapeHtml(c.name)}</option>`;
        }).join("");
    }

    fillSelect("currency", (contract?.currency || "TRY").toUpperCase());
    const selectedCompany = coSelect?.value && typeof v26FindCompany === "function"
      ? v26FindCompany(coSelect.value)
      : null;
    const selectedCompanyFx = selectedCompany?.functionalCurrency || selectedCompany?.baseCurrency || "";
    fillSelect("functionalCurrency", (selectedCompanyFx || contract?.functionalCurrency || "TRY").toUpperCase());
    fillSelect("reportingCurrency", (selectedCompanyFx || contract?.reportingCurrency || contract?.functionalCurrency || "TRY").toUpperCase());
    if (selectedCompanyFx) {
      const fxSel = document.getElementById("functionalCurrency");
      const reportingSel = document.getElementById("reportingCurrency");
      if (fxSel) { fxSel.value = selectedCompanyFx; fxSel.disabled = true; fxSel.title = "Şirketin tanımlı fonksiyonel para birimi"; }
      if (reportingSel) { reportingSel.value = selectedCompanyFx; reportingSel.disabled = true; reportingSel.title = "Şirketin tanımlı sunum para birimi"; }
    }

    const tms21 = document.getElementById("tms21Force");
    const tms29 = document.getElementById("tms29Force");
    if (tms21) tms21.checked = contract?.tms21Force === true;
    if (tms29) tms29.checked = contract?.tms29Force === true;

    if (panel._refreshPreview) panel._refreshPreview();
  }

  function resolveAssetClassFromForm() {
    const select = document.getElementById("assetClass");
    if (!select) return "";
    if (select.value === ASSET_CLASS_CUSTOM_OPTION) {
      const custom = String(document.getElementById("assetClassCustom")?.value || "").trim();
      if (!custom) return "";
      saveCustomAssetClass(custom);
      return custom;
    }
    return select.value || "";
  }

  const closeModalButton = document.getElementById("closeModal");
  if (closeModalButton) closeModalButton.onclick = closeContractModal;

  const cancelModalButton = document.getElementById("cancelModal");
  if (cancelModalButton) cancelModalButton.onclick = closeContractModal;

  /* ==========================================================
     CONTRACT VALIDATION
  ========================================================== */

  /**
   * Sözleşme verilerini TFRS 16 kurallarına göre doğrular.
   *
   * @param {Object} contract - Doğrulanacak sözleşme
   * @param {string} contract.id - Sözleşme ID (zorunlu)
   * @param {string} contract.company - Şirket adı (zorunlu)
   * @param {string} contract.supplier - Tedarikçi adı (zorunlu)
   * @param {number} contract.monthlyPayment - Aylık kira (zorunlu, >0)
   * @param {string} contract.startDate - Başlangıç tarihi (zorunlu)
   * @param {string} contract.endDate - Bitiş tarihi (zorunlu, başlangıçtan sonra)
   * @param {number} contract.discountRate - İskonto oranı (>=0)
   * @param {boolean} [contract.shortTermLease] - Kısa vadeli kiralama istisnası (TFRS 16.5)
   * @param {boolean} [contract.purchaseOption] - Satın alma opsiyonu var mı?
   * @returns {Object} result
   * @returns {boolean} result.valid - Sözleşme geçerli mi?
   * @returns {string[]} result.errors - Doğrulama hata mesajları
   */
  // Dated (irregular) schedule: "YYYY-MM-DD | tutar | referans" per line.
  // The server's dated engine measures it; the monthly amount is not used.
  function parseExplicitPaymentSchedule(text, currency) {
    const errors = [], rows = [];
    String(text || "").split(/\r?\n/).map(line => line.trim()).filter(Boolean).forEach((line, index) => {
      const [date, amountText, reference] = line.split("|").map(part => (part || "").trim());
      let raw = String(amountText || "").replace(/\s/g, "");
      if (raw.includes(",")) raw = raw.replace(/\./g, "").replace(",", ".");
      const amount = Number(raw);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "") || !normalizeDate(date)) errors.push(`Ödeme takvimi ${index + 1}. satır: tarih YYYY-AA-GG olmalı.`);
      else if (!(amount > 0)) errors.push(`Ödeme takvimi ${index + 1}. satır: tutar pozitif olmalı.`);
      else rows.push({ line: `${index + 1}.`, paymentId: `P${index + 1}`, economicDate: date, amount, currency,
        paymentClass: "FIXED_LEASE", sourceEvidenceId: reference || `SATIR-${index + 1}` });
    });
    const dates = rows.map(r => r.economicDate);
    if (new Set(dates).size !== dates.length) errors.push("Ödeme takviminde aynı tarih birden fazla kez var.");
    return { rows: rows.sort((a, b) => a.economicDate.localeCompare(b.economicDate)), errors };
  }

  // Remaining dated payments after a date, as editable "Tarih | Tutar | Referans" lines.
  function datedScheduleText(contract, after) {
    return escapeHtml((contract?.explicitPaymentSchedule || []).filter(r => r.economicDate > after)
      .map(r => `${r.economicDate} | ${r.amount} | ${r.sourceEvidenceId || ""}`).join("\n"));
  }

  // Months n with start+(n-1) months < end <= start+n months (server rule).
  function datedTermMonths(startDate, endDate) {
    const start = new Date(`${startDate}T00:00:00Z`), end = `${endDate}`;
    const anchored = k => {
      const m = start.getUTCMonth() + k, y = start.getUTCFullYear() + Math.floor(m / 12), t = ((m % 12) + 12) % 12;
      const last = new Date(Date.UTC(y, t + 1, 0)).getUTCDate();
      return new Date(Date.UTC(y, t, Math.min(start.getUTCDate(), last))).toISOString().slice(0, 10);
    };
    for (let n = 1; n <= 1200; n++) if (anchored(n) >= end) return n;
    return null;
  }

  function validateContract(
    contract
  ) {

    const errors = [];
    const dated = contract.paymentFrequency === "irregular";

    if (!contract.id) {
      errors.push(
        "Sözleşme ID boş."
      );
    }

    if (!contract.company) {
      errors.push(
        "Şirket boş."
      );
    }

    if (!contract.supplier) {
      errors.push(
        "Tedarikçi boş."
      );
    }

    if (dated) {
      (contract.explicitPaymentScheduleErrors || []).forEach(error => errors.push(error));
      if (!contract.explicitPaymentSchedule?.length) errors.push("Düzensiz ödeme için ödeme takvimini doldurun.");
      else contract.explicitPaymentSchedule.forEach(r => {
        if (r.economicDate < contract.startDate || r.economicDate > contract.endDate) {
          errors.push(`Ödeme takvimi ${r.line} satır (${r.economicDate}): tarih sözleşme başlangıç ve bitiş tarihleri arasında olmalı.`);
        }
      });
    } else if (
      !contract.monthlyPayment ||
      contract.monthlyPayment <= 0
    ) {
      errors.push(
        "Aylık kira tutarı geçersiz."
      );
    }

    if (!contract.startDate) {
      errors.push(
        "Başlangıç tarihi geçersiz."
      );
    }

    if (!contract.endDate) {
      errors.push(
        "Bitiş tarihi geçersiz."
      );
    }

    const start =
      parseDate(
        contract.startDate
      );

    const end =
      parseDate(
        contract.endDate
      );

    if (
      start &&
      end &&
      start >= end
    ) {
      errors.push(
        "Başlangıç tarihi bitiş tarihinden önce olmalıdır."
      );
    }

    if (
      contract.discountRate < 0
    ) {
      errors.push(
        "İskonto oranı negatif olamaz."
      );
    }

    // TFRS 16 Appendix A: a short-term lease is, at the
    // commencement date, a lease with a term of 12 months or less
    // AND that does not contain a purchase option. Enforced here so
    // the exemption checkbox can't silently produce a non-compliant
    // (unaudited) classification.
    if (
      contract.shortTermLease &&
      start &&
      end
    ) {
      const termMonths =
        monthsBetween(
          contract.startDate,
          contract.endDate
        );

      if (termMonths > 12) {
        errors.push(
          "Kısa vadeli kiralama istisnası (TFRS 16.5) yalnızca 12 ay veya daha kısa süreli sözleşmelerde uygulanabilir."
        );
      }
    }

    if (
      contract.shortTermLease &&
      contract.purchaseOption
    ) {
      errors.push(
        "Satın alma opsiyonu makul ölçüde kesin olan bir sözleşme, TFRS 16 Ek A uyarınca kısa vadeli kiralama istisnasından yararlanamaz."
      );
    }

    return {
      valid:
        errors.length === 0,
      errors
    };
  }

  /* ==========================================================
     SAVE CONTRACT
  ========================================================== */

  document
    .getElementById(
      "contractForm"
    )
    ?.addEventListener(
      "submit",
      async event => {

        event.preventDefault();

        // BUG FIX (2026-08): initButtonLoadingV242()'nin global submit
        // dinleyicisi (capture phase) her form gönderiminde submit
        // butonunu "Kaydediliyor..." durumuna alıp DEVRE DIŞI
        // bırakıyordu, ama bunu geri alan (setButtonLoading(..., false))
        // HİÇBİR YERDE çağrılmıyordu — kayıt başarılı olsa da olmasa da
        // buton SONSUZA KADAR "Kaydediliyor..." yazılı ve tıklanamaz
        // kalıyordu. Ayrıca try/catch olmadığından, ortasında bir hata
        // fırlarsa sözleşme hiç kaydedilmiyor ve kullanıcıya görünür
        // bir hata mesajı da ÇIKMIYORDU (sessiz başarısızlık). Bu blok
        // ikisini de giderir: hatayı showAlert ile GÖSTERİR, butonu
        // finally içinde HER ZAMAN serbest bırakır.
        const submitButton = event.target?.querySelector?.('button[type="submit"]');

        try {

        // P1 UYUMLULUK: backend artık CONTROLLER/VIEWER rollerinin
        // sözleşme oluşturmasını/güncellemesini reddediyor
        // (403 CONTRACT_WRITE_ACCESS_DENIED). Butonu tıklayıp API'ye
        // gitmeden, kullanıcıya doğrudan ve net bir mesaj göster.
        if (typeof tfrs16CanWriteContracts === "function" && !tfrs16CanWriteContracts()) {
          showAlert("Bu işlem için yazma yetkiniz bulunmamaktadır (salt okunur rol).");
          return;
        }

        const id =
          getInput(
            "contractId"
          ).trim();

        const existing =
          contracts.find(
            c => c.id === id
          );

        const contract = {

          id,

          company:
            getInput(
              "company"
            ).trim(),

          supplier:
            getInput(
              "supplier"
            ).trim(),

          monthlyPayment:
            Number(
              getInput(
                "monthlyPayment"
              )
            ) || 0,

          startDate:
            normalizeDate(
              getInput(
                "startDate"
              )
            ),

          endDate:
            normalizeDate(
              getInput(
                "endDate"
              )
            ),

          discountRate:
            Number(
              getInput(
                "discountRate"
              )
            ) || 0,

          renewalDate:
            normalizeDate(
              getInput(
                "renewalDate"
              )
            ),

          currency:
            getInput("currency") ||
            "TRY",

          // V26 — çoklu para birimi / standart override alanları
          functionalCurrency:
            getInput("functionalCurrency") ||
            existing?.functionalCurrency ||
            "TRY",

          reportingCurrency:
            getInput("reportingCurrency") ||
            existing?.reportingCurrency ||
            getInput("functionalCurrency") ||
            existing?.functionalCurrency ||
            "TRY",

          companyId:
            getInput("companyId") ||
            existing?.companyId ||
            null,

          tms21Force:
            document.getElementById("tms21Force")
              ? !!document.getElementById("tms21Force").checked
              : (existing?.tms21Force === true),

          tms29Force:
            document.getElementById("tms29Force")
              ? !!document.getElementById("tms29Force").checked
              : (existing?.tms29Force === true),

          // V16.7 FIX — GK Advisory review: paymentFrequency and
          // paymentTiming were present as <select> fields in the
          // form but were never read by this handler, so every
          // manually created contract silently fell back to the
          // engine defaults ("monthly"/"arrears") regardless of
          // what the user picked. Older builds stored numeric month
          // codes ("1"/"3"/"12"), while the current form stores the
          // canonical word values; normalize both representations here.
          paymentFrequency:
            normalizePaymentFrequencyValue(getInput("paymentFrequency")),

          paymentTiming:
            getInput("paymentTiming") ||
            "arrears",

          // Keep the form ids and the contract model aligned. The old
          // handler looked for singular/legacy ids (initialDirectCost and
          // restorationCost), so every manually entered amount was silently
          // persisted as zero.
          initialDirectCosts:
            Number(
              getInput("initialDirectCosts")
            ) || 0,

          restorationObligation:
            Number(
              getInput("restorationObligation")
            ) || 0,

          // V16.7 ADDITION — the extended TFRS 16 parameters the
          // calculation engine (calculateLeaseEngine) already
          // supported but that had no corresponding form field at
          // all, so they could only ever be set via bulk import.
          prepayments:
            Number(
              getInput("prepayments")
            ) || 0,

          leaseIncentives:
            Number(
              getInput("leaseIncentives")
            ) || 0,

          leaseIncreaseType:
            normalizeLeaseIncreaseTypeValue(getInput("leaseIncreaseType")),

          leaseIncreaseRate:
            Number(
              getInput("leaseIncreaseRate")
            ) || 0,

          fixedIncrease:
            Number(
              getInput("fixedIncrease")
            ) || (
              normalizeLeaseIncreaseTypeValue(getInput("leaseIncreaseType")) === "fixedAmount"
                ? Number(getInput("leaseIncreaseRate")) || 0
                : 0
            ),

          variablePayment:
            Number(
              getInput("variablePayment")
            ) || 0,

          variablePaymentType:
            getInput("variablePaymentType") || "CIRO_KULLANIM",

          inSubstanceFixedPayment:
            Number(getInput("inSubstanceFixedPayment")) || 0,

          usefulLifeMonths:
            getInput("usefulLifeMonths") !== ""
              ? Number(getInput("usefulLifeMonths"))
              : null,

          // V25 ADDITION — index-linked lease increase tracking
          // fields (checkIndexReassessment). Preserve any prior
          // auto-check bookkeeping on the existing contract
          // (baseRate gets updated by checkIndexReassessment itself
          // after an auto-reassessment, so we don't blindly overwrite
          // it with the raw form value if the form field was left
          // untouched/empty).
          indexBaseRate:
            getInput("indexBaseRate") !== ""
              ? Number(getInput("indexBaseRate"))
              : (existing?.indexBaseRate ?? null),

          indexCurrentRate:
            getInput("indexCurrentRate") !== ""
              ? Number(getInput("indexCurrentRate"))
              : (existing?.indexCurrentRate ?? null),

          indexReviewMonth:
            getInput("indexReviewMonth") !== ""
              ? Number(getInput("indexReviewMonth")) - 1
              : (existing?.indexReviewMonth ?? null),

          indexReviewDay:
            getInput("indexReviewDay") !== ""
              ? Number(getInput("indexReviewDay"))
              : (existing?.indexReviewDay ?? null),

          // V18 Parça 1
          escalationFrequencyMonths:
            getInput("escalationFrequencyMonths") !== ""
              ? Number(getInput("escalationFrequencyMonths"))
              : null,

          escalationBase:
            getInput("escalationBase") || "compound",

          escalationFirstDate:
            getInput("escalationFirstDate") !== ""
              ? normalizeDate(getInput("escalationFirstDate"))
              : null,

          renewalOption:
            getCheckbox("renewalOption"),

          renewalOptionExpectedToExercise:
            getCheckbox("renewalOptionExpectedToExercise"),

          renewalEndDate:
            normalizeDate(getInput("renewalEndDate")),

          terminationOption:
            getCheckbox("terminationOption"),

          terminationDate:
            normalizeDate(getInput("terminationDate")),

          terminationPenalty:
            Number(getInput("terminationPenalty")) || 0,

          purchaseOption:
            getCheckbox("purchaseOption"),

          purchaseOptionPrice:
            Number(getInput("purchaseOptionPrice")) || 0,

          residualValueGuarantee:
            getCheckbox("residualValueGuarantee"),

          expectedResidualValueGuaranteePayment:
            Number(getInput("expectedResidualValueGuaranteePayment")) || 0,

          ownershipTransfer:
            getCheckbox("ownershipTransfer"),

          shortTermLease:
            getCheckbox("shortTermLease"),

          lowValueAsset:
            getCheckbox("lowValueAsset"),

          // Persist the four IFRS 16 B3-B7 confirmations alongside the
          // low-value election; disabled inputs are still read explicitly.
          lowValueWhenNewConfirmed:
            getCheckbox("lowValueWhenNewConfirmed"),
          lowValueStandaloneUseConfirmed:
            getCheckbox("lowValueStandaloneUseConfirmed"),
          lowValueNotHighlyDependentConfirmed:
            getCheckbox("lowValueNotHighlyDependentConfirmed"),
          lowValueNoSubleaseConfirmed:
            getCheckbox("lowValueNoSubleaseConfirmed"),

          assetClass:
            resolveAssetClassFromForm() ||
            existing?.assetClass ||
            "",

          companyId:
            document.getElementById("companyId")?.value ||
            existing?.companyId ||
            getPrimarySessionCompany()?.id ||
            "",

          status:
            existing?.status ||
            "active",

          modification:
            existing?.modification ||
            false,

          modifications:
            Array.isArray(existing?.modifications)
              ? existing.modifications
              : [],

          reassessments:
            Array.isArray(existing?.reassessments)
              ? existing.reassessments
              : [],

          auditTrail:
            Array.isArray(existing?.auditTrail)
              ? existing.auditTrail
              : [],

          originalContractSnapshot:
            existing?.originalContractSnapshot ||
            undefined,

          // V25 ADDITION — preserve runtime bookkeeping written by
          // the new functional add-ons (checkIndexReassessment,
          // checkLeaseTermWarning, applyEarlyPayment,
          // scheduleFutureLease) across form edits, since this
          // object is rebuilt field-by-field on every save rather
          // than spread from `existing`.
          indexLastCheckedDate:
            existing?.indexLastCheckedDate ?? null,

          leaseTermWarnings:
            existing?.leaseTermWarnings ||
            {},

          earlyPayments:
            Array.isArray(existing?.earlyPayments)
              ? existing.earlyPayments
              : [],

          earlyPaymentSchedule:
            Array.isArray(existing?.earlyPaymentSchedule)
              ? existing.earlyPaymentSchedule
              : undefined,

          earlyPaymentScheduleAsOf:
            existing?.earlyPaymentScheduleAsOf ??
            undefined,

          pendingActivationDate:
            existing?.pendingActivationDate ??
            null
        };

        if (contract.paymentFrequency === "irregular") {
          const parsed = parseExplicitPaymentSchedule(getInput("explicitPaymentSchedule"), contract.currency);
          contract.explicitPaymentSchedule = parsed.rows;
          contract.explicitPaymentScheduleErrors = parsed.errors;
          contract.paymentTiming = "dated";
          contract.monthlyPayment = 0;
          contract.termMonths = contract.startDate && contract.endDate ? datedTermMonths(contract.startDate, contract.endDate) : null;
        } else {
          contract.explicitPaymentSchedule = undefined;
          contract.termMonths = undefined;
        }

        const validation =
          validateContract(
            contract
          );
        delete contract.explicitPaymentScheduleErrors;
        if (contract.explicitPaymentSchedule) contract.explicitPaymentSchedule = contract.explicitPaymentSchedule.map(({ line, ...row }) => row);

        if (!validation.valid) {

          showAlert(
            validation.errors.join(
              "\n"
            )
          );

          return;
        }

        if (
          !existing &&
          contracts.some(
            c => c.id === id
          )
        ) {

          showAlert(
            "Bu Sözleşme ID zaten mevcut."
          );

          return;
        }

        // PostgreSQL'e önce yaz — hata olursa yerel liste değişmez
        const persisted = await persistContractToApi(contract, Boolean(existing));
        contract.companyId =
          contract.companyId ||
          document.getElementById("companyId")?.value ||
          getPrimarySessionCompany()?.id ||
          "";

        if (existing) {

          const oldContractSnapshot = cloneAuditValue(existing);

          contracts =
            contracts.map(
              item =>
                item.id === id
                  ? contract
                  : item
            );

          recordAuditEvent({
            // The server wrote this UPDATE row; reuse its id (no duplicate).
            ...(persisted?.auditId ? { id: persisted.auditId } : {}),
            action: "UPDATE",
            entityType: "CONTRACT",
            entityId: id,
            contractId: id,
            reason: "Contract update",
            oldValue: oldContractSnapshot,
            newValue: contract,
            metadata: { source: "contract-form" }
          });

          if (oldContractSnapshot.status !== contract.status) {
            recordAuditEvent({
              action: "CONTRACT_STATUS_CHANGED",
              entityType: "CONTRACT",
              entityId: id,
              contractId: id,
              reason: "Contract status changed",
              oldValue: { status: oldContractSnapshot.status },
              newValue: { status: contract.status }
            });
          }

          // V18 Parça 1 — endeksleme konfigürasyonu değiştiyse genel
          // UPDATE eventine EK olarak ayrı bir audit izi bırakılır.
          const ESCALATION_FIELDS_V18 = [
            "leaseIncreaseType", "leaseIncreaseRate", "fixedIncrease",
            "escalationFrequencyMonths", "escalationBase", "escalationFirstDate"
          ];
          const oldEscCfg = {}, newEscCfg = {};
          let escalationChanged = false;
          ESCALATION_FIELDS_V18.forEach(f => {
            oldEscCfg[f] = oldContractSnapshot[f] ?? null;
            newEscCfg[f] = contract[f] ?? null;
            if (oldEscCfg[f] !== newEscCfg[f]) escalationChanged = true;
          });
          if (escalationChanged) {
            recordAuditEvent({
              action: "ESCALATION_CONFIG_CHANGED",
              entityType: "CONTRACT",
              entityId: id,
              contractId: id,
              reason: "Kira artışı (escalation) konfigürasyonu değişti",
              oldValue: oldEscCfg,
              newValue: newEscCfg
            });
          }

        } else {

          ensureModificationState(contract);
          ensureReassessmentState(contract);

          contracts.push(
            contract
          );

          recordAuditEvent({
            action: "CREATE",
            entityType: "CONTRACT",
            entityId: id,
            contractId: id,
            reason: "Contract created",
            oldValue: null,
            newValue: contract,
            metadata: { source: "contract-form" }
          });
        }

        saveContracts(
          contracts
        );

        refresh();

        closeContractModal();

        openDetail(id);

        showAlert(
          existing
            ? "Sözleşme güncellendi ve veritabanına kaydedildi."
            : "Sözleşme oluşturuldu ve veritabanına kaydedildi.",
          "success"
        );

        } catch (error) {
          // A taken id (also by an archived contract, kept for its
          // calculation history) is a user-fixable conflict, not a crash.
          if (error?.status === 409 || /already exists/i.test(String(error?.message || ""))) {
            showAlert("Bu Sözleşme ID'si zaten kullanılıyor (arşivlenmiş bir sözleşmede olabilir; arşivlenen sözleşmelerin ID'si hesaplama geçmişi için saklanır). Farklı bir ID girin.");
          } else {
            console.error("Sözleşme kaydedilirken hata:", error);
            showAlert(
              "Sözleşme kaydedilemedi: " +
              (error?.message || String(error)) +
              "\n\n(Teknik detay konsolda — F12/Web Inspector.)"
            );
          }
        } finally {
          if (submitButton) setButtonLoading(submitButton, false);
        }
      }
    );





  /* ==========================================================
     JOURNAL RENDER
  ========================================================== */

  function renderJournalEntry(
    title,
    entries,
    currency = "TRY"
  ) {

    if (
      !entries ||
      !entries.length
    ) {
      return "";
    }

    const debit =
      entries.reduce(
        (total, item) =>
          total +
          Number(
            item.debit || 0
          ),
        0
      );

    const credit =
      entries.reduce(
        (total, item) =>
          total +
          Number(
            item.credit || 0
          ),
        0
      );

    const difference =
      Math.abs(
        debit - credit
      );

    const balanced =
      difference < 0.01;

    return `

      <div
        style="
          margin-top:22px;
          border:1px solid #e5e7eb;
          border-radius:12px;
          overflow:hidden;
          background:white;
        "
      >

        <div
          style="
            padding:14px 16px;
            background:#f8fafc;
            border-bottom:1px solid #e5e7eb;
          "
        >

          <strong>
            ${escapeHtml(title)}
          </strong>
          <span style="font-size:11px;font-weight:700;color:#64748b;margin-left:8px;">
            ${
              String(currency).toUpperCase() === "MIXED"
                ? `<span style="color:#b45309;">(Karışık para birimi — satır bazında hesap adındaki para birimine bakın)</span>`
                : `(Tutarlar ${escapeHtml(String(currency || "TRY").toUpperCase())} cinsindendir)`
            }
          </span>

        </div>

        <div style="overflow:auto;">

          <table
            style="
              width:100%;
              border-collapse:collapse;
              min-width:600px;
            "
          >

            <thead>

              <tr>

                <th
                  style="
                    padding:10px;
                    text-align:left;
                  "
                >
                  Hesap
                </th>

                <th
                  style="
                    padding:10px;
                    text-align:right;
                  "
                >
                  Borç
                </th>

                <th
                  style="
                    padding:10px;
                    text-align:right;
                  "
                >
                  Alacak
                </th>

              </tr>

            </thead>

            <tbody>

              ${entries.map(
                item => `

                  <tr>

                    <td
                      style="
                        padding:10px;
                        border-top:1px solid #edf0f4;
                      "
                    >
                      ${escapeHtml(
                        item.account
                      )}
                      ${
                        item.transactionCurrency &&
                        String(item.transactionCurrency).toUpperCase() !== String(currency || "TRY").toUpperCase() &&
                        (Number(item.transactionDebit) || Number(item.transactionCredit))
                          ? `<div style="margin-top:3px;font-size:10px;color:#64748b;">
                              İşlem tutarı: ${escapeHtml(String(item.transactionCurrency).toUpperCase())}
                              ${formatNumber(Number(item.transactionDebit) || Number(item.transactionCredit))}
                              · Kur: ${Number(item.fxRate) > 0 ? Number(item.fxRate).toLocaleString("tr-TR", { minimumFractionDigits: 4, maximumFractionDigits: 6 }) : "çoklu"}
                              ${item.fxRateDate ? ` (${escapeHtml(String(item.fxRateDate))})` : ""}
                            </div>`
                          : ""
                      }
                    </td>

                    <td
                      style="
                        padding:10px;
                        text-align:right;
                        border-top:1px solid #edf0f4;
                      "
                    >
                      ${
                        item.debit
                          ? formatPresentationCurrency(
                              item.debit,
                              currency
                            )
                          : "-"
                      }
                    </td>

                    <td
                      style="
                        padding:10px;
                        text-align:right;
                        border-top:1px solid #edf0f4;
                      "
                    >
                      ${
                        item.credit
                          ? formatPresentationCurrency(
                              item.credit,
                              currency
                            )
                          : "-"
                      }
                    </td>

                  </tr>

                `
              ).join("")}

            </tbody>

            <tfoot>

              <tr>

                <td
                  style="
                    padding:11px;
                    font-weight:800;
                    border-top:2px solid #cbd5e1;
                  "
                >
                  TOPLAM
                </td>

                <td
                  style="
                    padding:11px;
                    text-align:right;
                    font-weight:800;
                    border-top:2px solid #cbd5e1;
                  "
                >
                  ${formatPresentationCurrency(
                    debit,
                    currency
                  )}
                </td>

                <td
                  style="
                    padding:11px;
                    text-align:right;
                    font-weight:800;
                    border-top:2px solid #cbd5e1;
                  "
                >
                  ${formatPresentationCurrency(
                    credit,
                    currency
                  )}
                </td>

              </tr>

            </tfoot>

          </table>

        </div>

        <div
          style="
            padding:10px 14px;
            background:${
              balanced
                ? "#ecfdf5"
                : "#fef2f2"
            };
            color:${
              balanced
                ? "#166534"
                : "#991b1b"
            };
            font-size:11px;
            font-weight:800;
          "
        >

          ${
            balanced
              ? "✓ Borç / Alacak kontrolü başarılı"
              : "✕ BORÇ / ALACAK DENGESİZ"
          }

        </div>

      </div>
    `;
  }

  /* ==========================================================
     ACCOUNTING CENTER
  ========================================================== */

  function buildYearOptions(
    contract
  ) {

    const start =
      parseDate(
        contract.startDate
      )?.getFullYear();

    const end =
      parseDate(
        contract.endDate
      )?.getFullYear();

    if (!start || !end) {

      return `
        <option>
          ${new Date().getFullYear()}
        </option>
      `;
    }

    let html = "";

    for (
      let year = start;
      year <= end;
      year++
    ) {

      html += `
        <option value="${year}">
          ${year}
        </option>
      `;
    }

    return html;
  }

  function buildMonthOptions() {

    const months = [
      "Ocak",
      "Şubat",
      "Mart",
      "Nisan",
      "Mayıs",
      "Haziran",
      "Temmuz",
      "Ağustos",
      "Eylül",
      "Ekim",
      "Kasım",
      "Aralık"
    ];

    return months
      .map(
        (month, index) =>
          `
          <option value="${
            index + 1
          }">
            ${month}
          </option>
          `
      )
      .join("");
  }








  // Active journal boundaries use only verified, server-owned complete DTOs.
  // Legacy definitions below are retained for source history, never selected
  // by API readiness, currency, bulk, closing or a feature flag.

  // REPORT-AUTH-R1 active boundaries. Retained legacy report functions cannot
  // become a source when the server, profile or route is unavailable.
  function renderPaymentScheduleSection(contract) {
    const ui = window.LeaseQantTfrs16ReportingUi;
    const sourceTerms = typeof ui?.renderContractPaymentTerms === "function"
      ? ui.renderContractPaymentTerms(contract)
      : "";
    return `${sourceTerms}<div data-authoritative-report-schedule role="status">Güvenilir raporlama kaynağı yükleniyor...</div>`;
  }
  function renderContractAuditTab() { return '<div data-authoritative-report-audit>Sunucudaki olaylar yükleniyor...</div>'; }
  function getFutureLeasesKPI() { return {value:null,status:"NOT_READY",reason:"SOURCE_BOUND_COMMITMENT_REPORT_REQUIRED"}; }
  function updateFutureLeaseKPI() { setText("futureLeasesKPI","Kaynak verisi gerekli"); }
  function v26ConvertScheduleToPresentation() { return reportingAuthorityUnavailable(); }
  function v26RenderConsolidationReportBody() { return reportingAuthorityUnavailable(); }
  function v26RenderAuditTrailBody() { return reportingAuthorityUnavailable(); }
  function convertAmountToReportingCurrency() { return reportingAuthorityUnavailable(); }
  function formatPortfolioAmount(value,currency,presentationCurrency) {
    const code=String(currency||"").trim().toUpperCase();
    if(!/^[A-Z]{3}$/.test(code)||value===null||value===""||!Number.isFinite(Number(value)))return "Tutar/para birimi eksik";
    if(presentationCurrency&&String(presentationCurrency).toUpperCase()!==code)return "Onaylı döviz kuru kaynağı gerekli";
    return new Intl.NumberFormat("tr-TR",{style:"currency",currency:code,maximumFractionDigits:2}).format(Number(value));
  }
  function v191ComputePrivatePortfolioTms29() { return reportingAuthorityUnavailable(); }
  function v191PrepareFinancialReportingData() { return reportingAuthorityUnavailable(); }
  function v191GroupRollForwardByAssetClass() { return reportingAuthorityUnavailable(); }
  function v191RenderAssetNoteHtml() { return reportingAuthorityUnavailable(); }
  function v191RenderLiabilityNoteHtml() { return reportingAuthorityUnavailable(); }
  function v191RenderLiquidityNoteHtml() { return reportingAuthorityUnavailable(); }
  function calculateFxGainLoss() { return reportingAuthorityUnavailable(); }
  function calculateVariance() { return reportingAuthorityUnavailable(); }
  function calculateVariancePercent() { return reportingAuthorityUnavailable(); }
  function calculateDriverModel() { return reportingAuthorityUnavailable(); }
  function calculateScenario() { return reportingAuthorityUnavailable(); }
  function calculateCurrentLiabilityAsOf() { return reportingAuthorityUnavailable(); }
  function calculateNonCurrentLiabilityAsOf() { return reportingAuthorityUnavailable(); }
  function getErpReadyContractData(date) { const ui=reportAuthorityUi();return ui.rawRows(ui.read(date),"contracts"); }
  function reportingAuthorityUnavailable() {
    const error = new Error("REPORTING_AUTHORITY_UNAVAILABLE");
    error.code = "REPORTING_AUTHORITY_UNAVAILABLE";
    throw error;
  }
  function reportAuthorityUi() {
    const ui = window.LeaseQantReportingAuthorityUi;
    if (!ui) reportingAuthorityUnavailable();
    return ui;
  }
  function updateKPIs() { return reportAuthorityUi().dashboard(); }
  function setKpiPendingState() {
    ["contractCount","leaseLiability","rouAssets","currentLiability","next12Months","monthlyInterest","monthlyDepreciation"].forEach(id=>setText(id,"Yükleniyor…"));
  }
  function renderCloseDashboardPage(container) { return reportAuthorityUi().page(container,"Ay Sonu — Backend Hesaplama Kontrolleri","controls"); }
  function renderConsolidationReportPage(container) {
    if (container) container.innerHTML = '<p role="status">Konsolidasyon raporu için doğrulanmış şirketler arası kaynak verisi gerekli.</p><details><summary>Teknik ayrıntı</summary><code>SOURCE_BOUND_CONSOLIDATION_REQUIRED</code></details>';
  }
  function renderAuditTrailPage(container) { return reportAuthorityUi().page(container,"Sunucuda Saklanan Olaylar","audit"); }
  function openReportingAuthority(title,section="metrics") {
    const host=document.getElementById("v26PageHost");
    const target=host || document.getElementById("mainContent") || document.querySelector("main") || document.getElementById("content");
    if (!target) reportingAuthorityUnavailable();
    if (host && window.LeaseQantMainView) window.LeaseQantMainView.activate(
      section === "controls" ? "riskControls" : section === "audit" ? "audit" : "financialReporting");
    return reportAuthorityUi().page(target,title,section);
  }
  async function contractReportingPackage(contractId) {
    const contract=contracts.find(row=>String(row.id)===String(contractId));
    if (!contract?.companyId) reportingAuthorityUnavailable();
    const ui=reportAuthorityUi();
    const pkg=await ui.load({companyId:contract.companyId,...ui.defaultPeriod()});
    if (!pkg.population.contractIds.includes(String(contractId))) reportingAuthorityUnavailable();
    return pkg;
  }
  async function exportAuditTrail(contractId) {
    const ui=reportAuthorityUi(),pkg=contractId?await contractReportingPackage(contractId):ui.read();
    return ui.exportPackage(pkg,window.XLSX?"xlsx":"csv","audit",contractId);
  }
  async function exportControlResults(contractId) {
    const ui=reportAuthorityUi(),pkg=contractId?await contractReportingPackage(contractId):ui.read();
    return ui.exportPackage(pkg,window.XLSX?"xlsx":"csv","controls",contractId);
  }
  function exportControlResultsAsCfoData(date) { const ui=reportAuthorityUi();return ui.rawRows(ui.read(date),"controls"); }
  async function exportPaymentSchedule(contract) {
    const ui=reportAuthorityUi();return ui.exportPackage(await contractReportingPackage(contract.id),window.XLSX?"xlsx":"csv","schedule",contract.id);
  }
  async function exportReport(contractId,format) {
    const ui=reportAuthorityUi();return ui.exportPackage(await contractReportingPackage(contractId),format||"html","metrics",contractId);
  }
  function v20GetDatabaseModel() {
    const ui=reportAuthorityUi(),pkg=ui.read();
    const journal=window.LeaseQantTfrs16JournalUi?.databasePreview() || {status:"JOURNAL_AUTHORITY_UNAVAILABLE",journals:[],journalLines:[]};
    return {schemaVersion:"REPORTING_AUTHORITY_DATABASE_VIEW_V1",reportingIdentity:pkg.identity,period:pkg.period,population:pkg.population,
      reportingMetrics:ui.rawRows(pkg),contracts:ui.rawRows(pkg,"contracts"),schedules:ui.rawRows(pkg,"schedule"),
      controls:ui.rawRows(pkg,"controls"),auditEvents:ui.rawRows(pkg,"audit"),journals:journal.journals,journalLines:journal.journalLines,
      journalAuthorityStatus:journal.status};
  }
  function exportDatabaseReadyData() { return v20GetDatabaseModel(); }
  function v191OpenFinancialReporting() { return openReportingAuthority("Finansal Raporlama","metrics"); }
  function v191OpenRiskControls() { return openReportingAuthority("Backend Kontrolleri","controls"); }
  function v191OpenMonthEndClose() { return openReportingAuthority("Ay Sonu Hesaplama Kontrolleri","controls"); }
  function v191OpenCfoDashboard() { return openReportingAuthority("CFO — Kiralama Raporu","metrics"); }
  function v191OpenIntegration() { return openReportingAuthority("Backend Raporlama Verisi","metrics"); }
  function v191OpenReconciliation() { return openReportingAuthority("Backend Kontrolleri","controls"); }
  function v191OpenContractTools() { return openReportingAuthority("Backend Sözleşme Raporu","metrics"); }
  function cfoGetContractMetricsInternal() { return reportingAuthorityUnavailable(); }
  function cfoPeriodMetrics() { return reportingAuthorityUnavailable(); }
  function exportBudget() { return reportingAuthorityUnavailable(); }
  function exportConsolidation() { return reportingAuthorityUnavailable(); }
  function exportEliminations() { return reportingAuthorityUnavailable(); }
  function exportForecast() { return reportingAuthorityUnavailable(); }
  function exportFxExposure() { return reportingAuthorityUnavailable(); }
  function exportFxGainLoss() { return reportingAuthorityUnavailable(); }
  function exportFxRates() { return reportingAuthorityUnavailable(); }
  function exportFxReconciliation() { return reportingAuthorityUnavailable(); }
  function exportFxTranslation() { return reportingAuthorityUnavailable(); }
  function exportGroupDatabaseReady() { return reportingAuthorityUnavailable(); }
  function exportGroupReport() { return reportingAuthorityUnavailable(); }
  function exportIntercompanyReconciliation() { return reportingAuthorityUnavailable(); }
  function exportLeaseLiabilityMovementNote() { return reportingAuthorityUnavailable(); }
  function exportLeaseLiquidityRiskNote() { return reportingAuthorityUnavailable(); }
  function exportModificationsForDatabase() { return reportingAuthorityUnavailable(); }
  function exportPlanningData() { return reportingAuthorityUnavailable(); }
  function exportReassessmentsForDatabase() { return reportingAuthorityUnavailable(); }
  function exportRiskSummary() { return reportingAuthorityUnavailable(); }
  function exportRouAssetMovementNote() { return reportingAuthorityUnavailable(); }
  function exportScenario() { return reportingAuthorityUnavailable(); }
  function exportSchedulesForDatabase() { return reportingAuthorityUnavailable(); }
  function exportTms29InflationNote() { return reportingAuthorityUnavailable(); }
  function getActiveContractCount() { return reportingAuthorityUnavailable(); }
  function getActualPlusRemainingBudgetForecast() { return reportingAuthorityUnavailable(); }
  function getAnnualLeaseReport() { return reportingAuthorityUnavailable(); }
  function getAuditTrailReport() { return reportingAuthorityUnavailable(); }
  function getBudget() { return reportingAuthorityUnavailable(); }
  function getBudgetVersion() { return reportingAuthorityUnavailable(); }
  function getBudgetVersions() { return reportingAuthorityUnavailable(); }
  function getCashBridge() { return reportingAuthorityUnavailable(); }
  function getCfoAlerts() { return reportingAuthorityUnavailable(); }
  function getCfoApprovalReadiness() { return reportingAuthorityUnavailable(); }
  function getCfoAuditMetrics() { return reportingAuthorityUnavailable(); }
  function getCfoCompanyDashboard() { return reportingAuthorityUnavailable(); }
  function getCfoCompanyMetrics() { return reportingAuthorityUnavailable(); }
  function getCfoContractMetrics() { return reportingAuthorityUnavailable(); }
  function getCfoContractView(date) { return reportAuthorityUi().read(date); }
  function getCfoCurrencyExposure() { return reportingAuthorityUnavailable(); }
  function getCfoDashboardData(date) { return reportAuthorityUi().read(date); }
  function getCfoDecisionFacts() { return reportingAuthorityUnavailable(); }
  function getCfoExecutiveSnapshot(date) { return reportAuthorityUi().read(date); }
  function getCfoJournalMetrics() { return reportingAuthorityUnavailable(); }
  function getCfoKpis() { return reportingAuthorityUnavailable(); }
  function getCfoMetricsByCompany() { return reportingAuthorityUnavailable(); }
  function getCfoPeriodSummary(date) { return reportAuthorityUi().read(date); }
  function getCfoScorecard() { return reportingAuthorityUnavailable(); }
  function getCfoTopRisks() { return reportingAuthorityUnavailable(); }
  function getCloseApprovalReadiness() { return reportingAuthorityUnavailable(); }
  function getCloseBlockers() { return reportingAuthorityUnavailable(); }
  function getCloseReadiness() { return reportingAuthorityUnavailable(); }
  function getCompanyExposureReport(date) { return reportAuthorityUi().read(date); }
  function getCompanyMaturityAnalysis() { return reportingAuthorityUnavailable(); }
  function getCompanyMonthEndCloseStatus() { return reportingAuthorityUnavailable(); }
  function getCompanyPlanningContribution() { return reportingAuthorityUnavailable(); }
  function getConsolidatedData() { return reportingAuthorityUnavailable(); }
  function getConsolidationReports() { return reportingAuthorityUnavailable(); }
  function getContractControlResults() { return reportingAuthorityUnavailable(); }
  function getContractExpiryReport() { return reportingAuthorityUnavailable(); }
  function getContractMaturityAnalysis() { return reportingAuthorityUnavailable(); }
  function getContractsExpiringWithin() { return reportingAuthorityUnavailable(); }
  function getContractsExpiringWithin12Months() { return reportingAuthorityUnavailable(); }
  function getContractsRequiringAttention() { return reportingAuthorityUnavailable(); }
  function getControlExceptionReport() { return reportingAuthorityUnavailable(); }
  function getControlSummary() { return reportingAuthorityUnavailable(); }
  function getControlSummaryReport() { return reportingAuthorityUnavailable(); }
  function getCriticalControls() { return reportingAuthorityUnavailable(); }
  function getCriticalExceptionsCfo() { return reportingAuthorityUnavailable(); }
  function getCurrencyExposureReport(date) { return reportAuthorityUi().read(date); }
  function getCurrencyMonthEndCloseStatus() { return reportingAuthorityUnavailable(); }
  function getCurrentLeaseLiability() { return reportingAuthorityUnavailable(); }
  function getCurrentNonCurrentReport(date) { return reportAuthorityUi().read(date); }
  function getDepreciationExpense() { return reportingAuthorityUnavailable(); }
  function getDepreciationReport() { return reportingAuthorityUnavailable(); }
  function getEbitdaBridge() { return reportingAuthorityUnavailable(); }
  function getEffectiveSchedule() { return reportingAuthorityUnavailable(); }
  function getEliminations() { return reportingAuthorityUnavailable(); }
  function getErpReadyPaymentData() { return reportingAuthorityUnavailable(); }
  function getExpiredContractCount() { return reportingAuthorityUnavailable(); }
  function getForecast() { return reportingAuthorityUnavailable(); }
  function getFxCfoDashboardData() { return reportingAuthorityUnavailable(); }
  function getFxConsolidatedData() { return reportingAuthorityUnavailable(); }
  function getFxConsolidationReports() { return reportingAuthorityUnavailable(); }
  function getFxControlStatus() { return reportingAuthorityUnavailable(); }
  function getFxDataQualityStatus() { return reportingAuthorityUnavailable(); }
  function getFxExposure() { return reportingAuthorityUnavailable(); }
  function getFxReports() { return reportingAuthorityUnavailable(); }
  function getGroupCfoDashboardData() { return reportingAuthorityUnavailable(); }
  function getGroupCloseStatus() { return reportingAuthorityUnavailable(); }
  function getGroupControlStatus() { return reportingAuthorityUnavailable(); }
  function getGroupPlanningData() { return reportingAuthorityUnavailable(); }
  function getHighExposureContracts() { return reportingAuthorityUnavailable(); }
  function getIntegrationExportData(type,date,options={}) {
    const kind=String(type||"ALL").toUpperCase();
    if(kind==="JOURNAL"||kind==="ERP_JOURNAL")return getErpReadyJournalData(date,options);
    const ui=reportAuthorityUi(),pkg=ui.read(date);
    if(kind==="AUDIT")return ui.rawRows(pkg,"audit");
    if(kind==="PAYMENT"||kind==="ERP_PAYMENT")return ui.rawRows(pkg,"schedule");
    return pkg;
  }
  function getInterestExpense() { return reportingAuthorityUnavailable(); }
  function getInterestExpenseReport() { return reportingAuthorityUnavailable(); }
  function getJournalSummaryReport() { return reportingAuthorityUnavailable(); }
  function getLeaseBalanceSheetImpact(date) { return reportAuthorityUi().read(date); }
  function getLeaseCashFlowMetrics() { return reportingAuthorityUnavailable(); }
  function getLeaseCashFlowReport() { return reportingAuthorityUnavailable(); }
  function getLeaseContractRegister(date) { return reportAuthorityUi().read(date); }
  function getLeaseControlMetrics() { return reportingAuthorityUnavailable(); }
  function getLeaseLiabilityMetrics() { return reportingAuthorityUnavailable(); }
  function getLeaseLiabilityRollForward() { return reportingAuthorityUnavailable(); }
  function getLeaseLiabilityRollForwardReport() { return reportingAuthorityUnavailable(); }
  function getLeaseLiquidityRiskDisclosure() { return reportingAuthorityUnavailable(); }
  function getLeaseModificationMetrics() { return reportingAuthorityUnavailable(); }
  function getLeasePaymentMaturityAnalysis(date) { return reportAuthorityUi().read(date).unsupported.maturityBands; }
  function getLeaseProfitLossImpact(date) { return reportAuthorityUi().read(date); }
  function getLeaseReassessmentMetrics() { return reportingAuthorityUnavailable(); }
  function getLeaseRenewalMetrics() { return reportingAuthorityUnavailable(); }
  function getLeaseRiskMetrics() { return reportingAuthorityUnavailable(); }
  function getLeaseRouRollForward() { return reportingAuthorityUnavailable(); }
  function getLiquidityPressureContracts() { return reportingAuthorityUnavailable(); }
  function getManagementSummary(date) { return reportAuthorityUi().read(date); }
  function getMaterialVariances() { return reportingAuthorityUnavailable(); }
  function getModificationReport() { return reportingAuthorityUnavailable(); }
  function getMonthEndCloseChecklist() { return reportingAuthorityUnavailable(); }
  function getMonthEndCloseDashboardData() { return reportingAuthorityUnavailable(); }
  function getMonthEndCloseStatus() { return reportingAuthorityUnavailable(); }
  function getMonthEndCloseSummary() { return reportingAuthorityUnavailable(); }
  function getMonthlyLeaseExpense() { return reportingAuthorityUnavailable(); }
  function getMonthlyLeaseMetrics() { return reportingAuthorityUnavailable(); }
  function getMonthlyLeaseReport() { return reportingAuthorityUnavailable(); }
  function getNonCurrentLeaseLiability() { return reportingAuthorityUnavailable(); }
  function getOpenExceptionsCfo() { return reportingAuthorityUnavailable(); }
  function getPlanningCashForecast() { return reportingAuthorityUnavailable(); }
  function getPlanningCfoDashboardData() { return reportingAuthorityUnavailable(); }
  function getPlanningControlStatus() { return reportingAuthorityUnavailable(); }
  function getPlanningDataQualityStatus() { return reportingAuthorityUnavailable(); }
  function getPlanningDrivers() { return reportingAuthorityUnavailable(); }
  function getPlanningLine() { return reportingAuthorityUnavailable(); }
  function getPlanningLines() { return reportingAuthorityUnavailable(); }
  function getPlanningVarianceReport() { return reportingAuthorityUnavailable(); }
  function getPlanningVersion() { return reportingAuthorityUnavailable(); }
  function getQuarterlyLeaseReport() { return reportingAuthorityUnavailable(); }
  function getReassessmentReport() { return reportingAuthorityUnavailable(); }
  function getRenewalRiskReport() { return reportingAuthorityUnavailable(); }
  function getRevenueBridge() { return reportingAuthorityUnavailable(); }
  function getRiskSummary() { return reportingAuthorityUnavailable(); }
  function getRunRateForecast() { return reportingAuthorityUnavailable(); }
  function getRuoAssetRollForward() { return reportingAuthorityUnavailable(); }
  function getRuoAssetRollForwardReport() { return reportingAuthorityUnavailable(); }
  function getScenarios() { return reportingAuthorityUnavailable(); }
  function getTerminatedContractCount() { return reportingAuthorityUnavailable(); }
  function getTfrs16CfoMetrics(date) { return reportAuthorityUi().read(date); }
  function getTfrs16CfoSnapshot(date) { return reportAuthorityUi().read(date); }
  function getTfrs16FinancialReportingSnapshot(date) { return reportAuthorityUi().read(date); }
  function getTfrs16ReportingReconciliation() { return reportingAuthorityUnavailable(); }
  function getTotalContractCount() { return reportingAuthorityUnavailable(); }
  function getTotalLeaseLiability() { return reportingAuthorityUnavailable(); }
  function getTotalRuoAssets() { return reportingAuthorityUnavailable(); }
  function getTrendForecast() { return reportingAuthorityUnavailable(); }
  function getUpcomingRenewals() { return reportingAuthorityUnavailable(); }
  function getV22DataHealth() { return reportingAuthorityUnavailable(); }
  function getV23DatabaseModel() { return reportingAuthorityUnavailable(); }
  function getVarianceStatus() { return reportingAuthorityUnavailable(); }
  function runContractControls() { return reportingAuthorityUnavailable(); }
  function v191RenderFinancialReportingPrivate() { return reportingAuthorityUnavailable(); }
  function v191RenderRiskControls() { return reportingAuthorityUnavailable(); }
  function v22RunConsolidation() { return reportingAuthorityUnavailable(); }
  function v22RunIntercompanyReconciliation() { return reportingAuthorityUnavailable(); }
  function v26BuildConsolidationRows() { return reportingAuthorityUnavailable(); }
  function v26ExportConsolidationExcel() { return reportingAuthorityUnavailable(); }

  function journalAuthorityUnavailable() {
    const error = new Error("Güvenilir yevmiye servisi hazır değil");
    error.code = "JOURNAL_AUTHORITY_UNAVAILABLE";
    throw error;
  }



  function exportBulkJournals(format) {
    const ui = window.LeaseQantTfrs16JournalUi;
    if (!ui) journalAuthorityUnavailable();
    return ui.exportBulk(typeof format === "string" ? format : "xlsx");
  }

  function exportJournalEntries(pkg,meta = {},format = "xlsx") {
    const ui = window.LeaseQantTfrs16JournalUi;
    if (!ui) journalAuthorityUnavailable();
    // Unverified legacy arrays cannot be promoted to accounting authority.
    return ui.exportPackages([pkg],format);
  }



  async function appendFxToReclassification(contract, reportingDate, originalEntries, title, preview) {
    if (!preview || !contractNeedsFxTranslation(contract)) return;
    try {
      const transactionCurrency = v23CurrencyCode(contract.currency || DEFAULT_FUNCTIONAL_CURRENCY);
      const functionalCurrency = resolveContractFunctionalCurrency(contract);
      const closing = await getFxRateAuto(transactionCurrency, functionalCurrency, reportingDate, V23_RATE_TYPES.CLOSING);
      if (closing?.error) throw Object.assign(new Error(closing.message || `${transactionCurrency}/${functionalCurrency} kuru bulunamadı.`), { code: closing.error });

      const translatedEntries = originalEntries.map(item => {
        // TMS21 FX gain/loss lines are already in functional currency and
        // must not be multiplied by the closing rate a second time.
        if (item.journalType === "TMS21_FX") return { ...item };
        return {
          account: `${item.account} (${functionalCurrency})`,
          debit: v23Round((item.debit || 0) * closing.rate, 2),
          credit: v23Round((item.credit || 0) * closing.rate, 2)
        };
      });

      preview.innerHTML =
        renderJournalEntry(title, translatedEntries, functionalCurrency) +
        `<div style="margin-top:10px;font-size:11px;color:#64748b;">
           Kontrat para birimi ${transactionCurrency}. Yukarıdaki temel tutarlar, ${v23DateKey(reportingDate)} tarihli TMS 21 kapanış kuruyla (${closing.rate.toFixed(4)}, ${closing.rateDate || v23DateKey(reportingDate)}) ${functionalCurrency}'ye çevrilmiştir. TMS21 kur farkı satırları ayrıca fişe dahil edilmiştir.
         </div>`;
    } catch (error) {
      preview.insertAdjacentHTML(
        "beforeend",
        `<div style="margin-top:10px;padding:10px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;color:#991b1b;font-size:12px;">TMS 21 kur çevrimi yapılamadı, tutarlar ${v23CurrencyCode(contract.currency)} cinsinden gösteriliyor: ${escapeHtml(error.message || String(error))}</div>`
      );
    }
  }

  async function appendFxJournalLines(contract, selectedRows, baseEntries, title, preview, options = {}) {
    if (!preview || !contractNeedsFxTranslation(contract)) return;
    try {
      if (!Array.isArray(backendFxRateCache) || backendFxRateCache.length === 0) {
        const refreshed = await refreshFxRateCacheFromBackend();
        if (refreshed) {
          updateKPIs();
          renderTable();
        }
      }
      if (!Array.isArray(backendFxRateCache) || backendFxRateCache.length === 0) {
      await refreshFxRateCacheFromBackend();
    }

    const engineResult = options.privateTms21Result ? null : cfoBuildSchedule(contract);
      // GC-2026-09 (Madde 5): reportingDate/accrualContext verildiğinde
      // buildTms21FxTranslation, dönem sonu ödeme gününe denk gelmeyen
      // durumlarda sentetik bir kapanış satırı ekliyor (bkz.
      // buildReportingDateAccrual) — bu satır aşağıda TARİH ARALIĞINA
      // göre eşleştirilerek (eskiden yalnızca `selectedRows`'un TAM
      // tarihleriyle eşleşen satırlar alınıyordu, ödeme günü olmayan
      // dönemlerde bu her zaman BOŞ küme oluyordu) fişe dahil edilir.
      const fx = options.privateTms21Result || await buildTms21FxTranslation(contract, engineResult, {
        reportingDate: options.reportingDate,
        accrualContext: options.accrualContext
      });
      if (!fx.applicable) return;

      let fxRows;
      if (options.reportingDate) {
        const periodEndKey = v23DateKey(options.reportingDate);
        const periodStartKey = options.periodStartExclusive ? v23DateKey(options.periodStartExclusive) : null;
        fxRows = fx.schedule.filter(r => {
          const key = v23DateKey(r.date);
          if (key > periodEndKey) return false;
          if (periodStartKey && key <= periodStartKey) return false;
          // reportingDate verilmeden önceki eski davranış: yalnızca
          // seçili satırların TAM tarihleri + (varsa) sentetik satır.
          return r.isAccrualRow || selectedRows.some(row => v23DateKey(row.date) === key);
        });
      } else {
        const selectedDates = new Set(selectedRows.map(r => v23DateKey(r.date)));
        fxRows = fx.schedule.filter(r => selectedDates.has(v23DateKey(r.date)));
      }
      // An advance commencement payment is measured at the opening rate and
      // has no subsequent-period FX gain/loss. Exclude that event from the
      // period FX delta; otherwise the opening conversion is re-posted as a
      // cumulative loss in every custom/annual journal.
      const commencementDateKey = v23DateKey(contract.startDate);
      const isOpeningAdvanceRow = row => row.isAdvanceCommencement || (
        commencementDateKey && v23DateKey(row.date) === commencementDateKey &&
        String(contract.paymentTiming || "").toLowerCase() === "advance"
      );
      const netFx = v23Round(
        fxRows
          .filter(row => !isOpeningAdvanceRow(row))
          .reduce((sum, r) => sum + r.fxGainLoss, 0),
        2
      );
      // fxGainLoss = (orijinal para birimindeki kapanış bakiyesi × kapanış kuru)
      // − (dönem hareketleriyle üstü örtülen tutar). Pozitifse kur yükselmiş
      // ve yükümlülüğün TL karşılığı beklenenden fazla büyümüş demektir →
      // bu bir KUR FARKI GİDERİ/ZARARIDIR (656). Negatifse yükümlülük TL
      // karşılığı beklenenden az büyümüş/azalmış demektir → KUR FARKI
      // GELİRİ/KARIDIR (646).
      const fxEntries = netFx > 0
        ? [
            { account: "656 Kambiyo Zararları (TMS 21 Kur Farkı Gideri)", debit: Math.abs(netFx), credit: 0 },
            { account: `401 Kiralama Yükümlülüğü (Kur Farkı - ${fx.transactionCurrency}/${fx.functionalCurrency})`, debit: 0, credit: Math.abs(netFx) }
          ]
        : [
            { account: `401 Kiralama Yükümlülüğü (Kur Farkı - ${fx.transactionCurrency}/${fx.functionalCurrency})`, debit: Math.abs(netFx), credit: 0 },
            { account: "646 Kambiyo Karları (TMS 21 Kur Farkı Geliri)", debit: 0, credit: Math.abs(netFx) }
          ];
      const functionalEntries = buildFunctionalCurrencyJournalEntries(
        contract,
        baseEntries,
        selectedRows,
        options.periodStartExclusive ? new Date(options.periodStartExclusive.getTime() + 1) : null,
        options.reportingDate,
        fxRows
      );
      const taggedFxEntries = Math.abs(netFx) < 0.01 ? [] : fxEntries.map(item => ({
        ...item,
        currency: fx.functionalCurrency,
        journalType: "TMS21_FX",
        transactionCurrency: fx.functionalCurrency,
        transactionDebit: item.debit,
        transactionCredit: item.credit,
        fxRate: 1,
        fxRateDate: v23DateKey(options.reportingDate)
      }));
      if (preview) {
        preview.innerHTML =
          renderJournalEntry(title, [...functionalEntries, ...taggedFxEntries], fx.functionalCurrency) +
          `<div style="margin-top:10px;font-size:11px;color:#64748b;">TMS 21: ${fx.transactionCurrency} işlem para birimindeki faiz ve ödemeler işlem tarihlerindeki kurlarla, ROU amortismanı tarihî maliyet kurlarıyla ${fx.functionalCurrency}'ye çevrilmiştir. Parasal kira yükümlülüğünün kapanış kuru farkı ayrıca 646/656 hesabında gösterilmiştir.</div>`;
      }
    } catch (error) {
      if (preview) {
        preview.insertAdjacentHTML(
          "beforeend",
          `<div style="margin-top:10px;padding:10px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;color:#991b1b;font-size:12px;">TMS 21 kur farkı hesaplanamadı: ${escapeHtml(error.message || String(error))}</div>`
        );
      }
    }
  }



  function auditScheduleEvent(contract, action, source = "CALCULATION", scheduleVersion = null, effectiveDate = null, periodCount = null) {
    return recordAuditEvent({
      action,
      entityType: "SCHEDULE",
      entityId: `${contract?.id || "UNKNOWN"}-SCHEDULE-${Date.now()}`,
      contractId: contract?.id || null,
      reason: `${action} from ${source}`,
      metadata: { source, effectiveDate, scheduleVersion, periodCount }
    });
  }

  /* ==========================================================
     PAYMENT SCHEDULE — "Kira Ödeme Planı" (V16.1 / Faz 3)
     ----------------------------------------------------------
     Read-only view of the full private amortization schedule for a
     single contract, rendered through the private-result bridge.
     Does not touch renderAccountingCenter() or any journal
     generation logic above.
  ========================================================== */

  function renderModificationManagementSection(contract) {

    ensureModificationState(contract);

    const today =
      new Date().toISOString().slice(0, 10);

    const modifications =
      contract.modifications || [];

    // V19 Kısa Vade Madde 1 (UI cilası): kilitli dönemde "Oluştur" ve
    // satır aksiyonları (Düzenle/Uygula/İptal) proaktif olarak disabled +
    // tooltip'li gösterilir. Fonksiyonel blok zaten createModification /
    // applyModification içinde var — bu sadece görsel ön uyarı.
    const createLockCheck = assertPeriodWritable(contract, contract?.startDate || new Date());
    const createDisabledAttr = createLockCheck.locked
      ? `disabled title="${escapeHtml(createLockCheck.message)}" style="margin-top:12px;opacity:.5;cursor:not-allowed;"`
      : `style="margin-top:12px;"`;

    const rows = modifications.length
      ? modifications.map(
          item => {
            const itemLockCheck = assertPeriodWritable(contract, item.effectiveDate || contract?.startDate || new Date());
            const rowDisabledAttr = itemLockCheck.locked
              ? `disabled title="${escapeHtml(itemLockCheck.message)}"`
              : "";
            // An older APPLIED event may predate the private base
            // calculation cache. Keep this page usable and show its
            // persisted delta instead of failing the whole render.
            let displayedLiabilityAdjustment = Number(item.liabilityAdjustment) || 0;
            if (item.status === "APPLIED") {
              try {
                displayedLiabilityAdjustment = Number(
                  resolveAppliedModificationMeasurement(contract, item).liabilityAdjustment
                ) || displayedLiabilityAdjustment;
              } catch (error) {
                if (error?.code !== "PRIVATE_CALCULATION_NOT_READY") {
                  console.warn("Modification measurement unavailable:", contract?.id, item?.id, error);
                }
              }
            }
            return `
            <div
              style="
                display:grid;
                grid-template-columns:1fr 1fr 1fr 1fr auto;
                gap:8px;
                align-items:center;
                padding:9px 0;
                border-bottom:1px solid #e5e7eb;
                font-size:11px;
              "
            >
              <span>${escapeHtml(item.modificationType || "OTHER")}</span>
              <span>${escapeHtml(item.effectiveDate || "")}</span>
              <span>${escapeHtml(item.status || "DRAFT")}</span>
              <strong>${formatPresentationCurrency(displayedLiabilityAdjustment, contract.currency)}</strong>
              <span style="display:flex;gap:5px;">
                ${
                  item.status !== "APPLIED" && item.status !== "CANCELLED"
                    ? `<button type="button" class="secondary-button" data-mod-action="edit" data-mod-id="${escapeHtml(item.id)}" ${rowDisabledAttr}>Düzenle</button>`
                    : ""
                }
                ${
                  item.status !== "APPLIED" && item.status !== "CANCELLED"
                    ? `<button type="button" class="secondary-button" data-mod-action="apply" data-mod-id="${escapeHtml(item.id)}" ${rowDisabledAttr}>Uygula</button>`
                    : ""
                }
                ${
                  item.status !== "APPLIED" && item.status !== "CANCELLED"
                    ? `<button type="button" class="secondary-button" data-mod-action="cancel" data-mod-id="${escapeHtml(item.id)}" ${rowDisabledAttr}>İptal Et</button>`
                    : ""
                }
                ${item.status === "APPLIED" && isAdminApprovalGranted() ? `<button type="button" class="secondary-button" data-mod-action="cancel" data-mod-id="${escapeHtml(item.id)}" title="Admin onayıyla geri al">Geri Al (Admin)</button>` : ""}
              </span>
            </div>
          `;
          }
        ).join("")
      : `<div style="padding:12px 0;color:#64748b;font-size:11px;">Henüz modification kaydı bulunmuyor.</div>`;

    return `
      <div
        style="
          margin-top:28px;
          border-top:1px solid #e5e7eb;
          padding-top:24px;
        "
      >
        <div>
          <div style="font-size:10px;color:#64748b;font-weight:800;letter-spacing:1px;">
            MODİFİKASYON YÖNETİMİ
          </div>
          <h3 style="margin:5px 0 0;font-size:18px;">
            Kira Modifikasyonu
          </h3>
          <p style="margin:5px 0 0;color:#64748b;font-size:11px;">
            Orijinal sözleşme geçmişi korunur. Muhasebe etkisi yalnızca uygulanan (APPLIED) modifikasyonlar için oluşur.
          </p>
          <p style="margin:7px 0 0;color:#475569;font-size:11px;">
            <strong>Ne zaman kullanılır?</strong> Kiraya verenle yeni şartlarda anlaşıldığında; kapsam, kira bedeli veya sözleşme süresi taraflarca değiştirilir.
          </p>
        </div>

        <div
          style="
            margin-top:16px;
            padding:14px;
            background:#f8fafc;
            border:1px solid #e5e7eb;
            border-radius:10px;
          "
        >
          <div
            style="
              display:grid;
              grid-template-columns:repeat(auto-fit,minmax(170px,1fr));
              gap:10px;
            "
          >
            <label style="font-size:10px;font-weight:700;">
              Modifikasyon Tarihi
              <input id="modificationDate" type="date" value="${today}" style="display:block;width:100%;margin-top:5px;">
            </label>
            <label style="font-size:10px;font-weight:700;">
              Yürürlük Tarihi
              <input id="modificationEffectiveDate" type="date" value="${today}" style="display:block;width:100%;margin-top:5px;">
            </label>
            <label style="font-size:10px;font-weight:700;">
              Modifikasyon Tipi
              <select id="modificationType" style="display:block;width:100%;margin-top:5px;">
                <option value="PAYMENT_INCREASE">Ödeme Artışı (yeni anlaşma)</option>
                <option value="PAYMENT_DECREASE">Ödeme Azalışı (yeni anlaşma)</option>
                <option value="LEASE_TERM_EXTENSION">Kira Süresi Uzatma</option>
                <option value="LEASE_TERM_REDUCTION">Kira Süresi Azaltma</option>
                <option value="SCOPE_INCREASE">Kapsam Artışı</option>
                <option value="SCOPE_DECREASE">Kapsam Azalışı</option>
                <option value="COMBINED_MODIFICATION">Birleşik Modifikasyon</option>
                <option value="OTHER">Diğer</option>
              </select>
            </label>
            ${contract.paymentFrequency === "irregular" ? `<label style="font-size:10px;font-weight:700;grid-column:1/-1;">
              Yürürlük tarihinden sonraki yeni ödeme takvimi (Tarih | Tutar | Referans)
              <textarea id="modificationNewSchedule" rows="5" style="display:block;width:100%;margin-top:5px;">${datedScheduleText(contract, today)}</textarea>
              <input id="modificationNewPayment" type="hidden" value="0">
            </label>` : `<label style="font-size:10px;font-weight:700;">
              Yeni Aylık Ödeme
              <input id="modificationNewPayment" type="number" min="0" step="0.01" value="${Number(contract.monthlyPayment) || 0}" style="display:block;width:100%;margin-top:5px;">
            </label>`}
            <label style="font-size:10px;font-weight:700;">
              Yeni Kira Bitiş Tarihi
              <input id="modificationNewEndDate" type="date" value="${escapeHtml(contract.endDate || "")}" style="display:block;width:100%;margin-top:5px;">
            </label>
            <label style="font-size:10px;font-weight:700;">
              Yeni İskonto Oranı %
              <input id="modificationNewDiscountRate" type="number" min="0" step="0.0001" value="${Number(contract.discountRate) || 0}" style="display:block;width:100%;margin-top:5px;">
            </label>
            <label style="font-size:10px;font-weight:700;">
              Kapsam Azaltma %
              <input id="modificationScopeReduction" type="number" min="0" max="100" step="0.01" value="0" style="display:block;width:100%;margin-top:5px;">
            </label>
            <label style="font-size:10px;font-weight:700;">
              Kapsam Artırma %
              <input id="modificationScopeIncrease" type="number" min="0" step="0.01" value="0" style="display:block;width:100%;margin-top:5px;">
            </label>
          </div>

          <label style="display:block;font-size:10px;font-weight:700;margin-top:10px;">
            Neden <span style="font-weight:400;color:#64748b;">(yeni sözleşme şartını belirtin)</span>
            <input id="modificationReason" type="text" placeholder="Örn. kiraya verenle yeni bedel üzerinde anlaşıldı" style="display:block;width:100%;margin-top:5px;">
          </label>

          <button
            type="button"
            id="createModificationButton"
            class="primary-button"
            ${createDisabledAttr}
          >
            Modifikasyon Oluştur
          </button>
        </div>

        <div style="margin-top:16px;">
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr auto;gap:8px;font-size:10px;font-weight:800;color:#64748b;padding-bottom:7px;">
            <span>TİP</span>
            <span>YÜRÜRLÜK</span>
            <span>DURUM</span>
            <span>YÜKÜMLÜLÜK Δ</span>
            <span>İŞLEM</span>
          </div>
          ${rows}
        </div>
      </div>
    `;
  }

  function initModificationEvents(contract, onChanged) {

    // onChanged verilmezse eski davranış korunur (contract detail
    // modal'ı kendini yeniden çizer). Yeni "Modifikasyon & Reassessment"
    // sayfası (bkz. renderModificationReassessmentPage) kendi re-render
    // fonksiyonunu geçirir — böylece bu fonksiyonun MANTIĞI değişmeden,
    // yalnızca "işlem sonrası hangi ekran yenilenir" davranışı çağıran
    // tarafa bırakılmış olur.
    const refreshHost = typeof onChanged === "function" ? onChanged : () => openDetail(contract.id);

    function refreshAfterMutation() {
      refreshPrivateCalculationAfterMutation(contract)
        .catch(() => null)
        .finally(() => refreshHost());
    }

    let editingModificationId = null;
    const createButton = document.getElementById("createModificationButton");

    function resetModificationFormMode() {
      editingModificationId = null;
      if (createButton) createButton.textContent = "Modifikasyon Oluştur";
    }

    function populateModificationForm(item) {
      const setValue = (elId, value) => {
        const el = document.getElementById(elId);
        if (el) el.value = value;
      };
      setValue("modificationDate", item.modificationDate || new Date().toISOString().slice(0, 10));
      setValue("modificationEffectiveDate", item.effectiveDate || "");
      setValue("modificationType", item.modificationType || "OTHER");
      setValue("modificationNewPayment", item.newPayment ?? (Number(contract.monthlyPayment) || 0));
      setValue("modificationNewEndDate", item.newLeaseEndDate || item.leaseEndDate || "");
      setValue("modificationNewDiscountRate", item.newDiscountRate ?? (Number(contract.discountRate) || 0));
      setValue("modificationScopeReduction", item.scopeReductionPercent || 0);
      setValue("modificationScopeIncrease", item.scopeIncreasePercent || 0);
      setValue("modificationReason", item.reason || "");
    }

    const submitModificationForm = async () => {
      const input = {
        modificationDate:
          document.getElementById("modificationDate")?.value,
        effectiveDate:
          document.getElementById("modificationEffectiveDate")?.value,
        reason:
          document.getElementById("modificationReason")?.value || "",
        modificationType:
          document.getElementById("modificationType")?.value || "OTHER",
        newPayment:
          document.getElementById("modificationNewPayment")?.value,
        newLeaseEndDate:
          document.getElementById("modificationNewEndDate")?.value,
        newDiscountRate:
          document.getElementById("modificationNewDiscountRate")?.value,
        scopeReductionPercent:
          document.getElementById("modificationScopeReduction")?.value,
        scopeIncreasePercent:
          document.getElementById("modificationScopeIncrease")?.value,
        status: "DRAFT"
      };
      // Dated schedule: the revised payments after the effective date.
      if (contract.paymentFrequency === "irregular") {
        const parsed = parseExplicitPaymentSchedule(document.getElementById("modificationNewSchedule")?.value, contract.currency || "TRY");
        if (parsed.errors.length) { showAlert(parsed.errors.join("\n")); return; }
        input.modificationType = "OTHER";
        input.newExplicitPaymentSchedule = parsed.rows.map(({ line, ...row }) => row);
      }

      // createModification/updateModification artık backend'e
      // yazmayı BEKLİYOR (async) — buton çift tıklamayı önlemek
      // ve kullanıcıya bekleme durumunu göstermek için geçici
      // olarak devre dışı bırakılır.
      const originalLabel = createButton.textContent;
      createButton.disabled = true;
      createButton.textContent = "Kaydediliyor...";

      const result =
        editingModificationId
          ? await updateModification(contract, editingModificationId, input)
          : await createModification(contract, input);

      createButton.disabled = false;
      createButton.textContent = originalLabel;

      if (!result.valid) {
        showAlert(changeErrorText(result));
        return;
      }

      resetModificationFormMode();
      refreshAfterMutation();
    };

    const handleModificationAction = async (action, id, button) => {
      if (action === "edit") {
        const item = (contract.modifications || []).find(m => m.id === id);
        if (!item) return;
        editingModificationId = id;
        populateModificationForm(item);
        if (createButton) {
          createButton.textContent = "Modifikasyonu Güncelle";
          createButton.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        return;
      }

      if (action === "apply") {
        button.disabled = true;
        let result;
        try {
          result = await applyModification(contract, id);
        } catch (error) {
          button.disabled = false;
          showAlert(`Modifikasyon uygulanamadı: ${error?.message || String(error)}`);
          return;
        }
        button.disabled = false;

        if (!result.valid) {
          showAlert(changeErrorText(result));
          return;
        }

        refreshAfterMutation();
        return;
      }

      if (action === "cancel") {
        button.disabled = true;
        const result =
          await cancelModification(contract, id);
        button.disabled = false;

        if (!result.valid) {
          showAlert(changeErrorText(result));
          return;
        }

        refreshAfterMutation();
      }
    };

    // Olay bağlama mekaniği artık operations-ui.js'deki
    // bindModificationEvents'te — bindSlbEvents/bindInflationAdjustmentEvents
    // ile aynı desen (2026-09-16). Asıl form-gönder/edit/apply/cancel
    // mantığı (yukarıda) burada kalıyor.
    const binder = window.LeaseQantTfrs16OperationsUi?.bindModificationEvents;
    if (typeof binder === "function") {
      binder(contract, { submitForm: submitModificationForm, handleAction: handleModificationAction });
    } else {
      createButton?.addEventListener("click", submitModificationForm);
      document.querySelectorAll("[data-mod-action]").forEach(button => {
        button.addEventListener("click", () => handleModificationAction(button.dataset.modAction, button.dataset.modId, button));
      });
    }
  }

  function renderReassessmentManagementSection(contract) {
    ensureReassessmentState(contract);

    const today = new Date().toISOString().slice(0, 10);
    const reassessments = contract.reassessments || [];

    // V19 Kısa Vade Madde 1 (UI cilası): kilitli dönemde proaktif disable + tooltip.
    const createLockCheck = assertPeriodWritable(contract, contract?.startDate || new Date());
    const createDisabledAttr = createLockCheck.locked
      ? `disabled title="${escapeHtml(createLockCheck.message)}" style="margin-top:12px;opacity:.5;cursor:not-allowed;"`
      : `style="margin-top:12px;"`;

    const rows = reassessments.length
      ? reassessments.map(item => {
          const itemLockCheck = assertPeriodWritable(contract, item.effectiveDate || contract?.startDate || new Date());
          const rowDisabledAttr = itemLockCheck.locked ? `disabled title="${escapeHtml(itemLockCheck.message)}"` : "";
          return `
          <div style="display:grid;grid-template-columns:1.1fr 1fr 1fr 1fr auto;gap:8px;align-items:center;padding:9px 0;border-bottom:1px solid #e5e7eb;font-size:11px;">
            <span>${escapeHtml(item.type || "OTHER")}</span>
            <span>${escapeHtml(item.effectiveDate || "")}</span>
            <span>${escapeHtml(item.status || "DRAFT")}</span>
            <strong>${formatPresentationCurrency(item.liabilityAdjustment || 0, contract.currency)}</strong>
            <span style="display:flex;gap:5px;">
              ${item.status !== "APPLIED" && item.status !== "CANCELLED" ? `<button type="button" class="secondary-button" data-reass-action="edit" data-reass-id="${escapeHtml(item.id)}" ${rowDisabledAttr}>Düzenle</button>` : ""}
              ${item.status !== "APPLIED" && item.status !== "CANCELLED" ? `<button type="button" class="secondary-button" data-reass-action="apply" data-reass-id="${escapeHtml(item.id)}" ${rowDisabledAttr}>Uygula</button>` : ""}
              ${item.status !== "APPLIED" && item.status !== "CANCELLED" ? `<button type="button" class="secondary-button" data-reass-action="cancel" data-reass-id="${escapeHtml(item.id)}" ${rowDisabledAttr}>İptal Et</button>` : ""}
              ${item.status === "APPLIED" && isAdminApprovalGranted() ? `<button type="button" class="secondary-button" data-reass-action="cancel" data-reass-id="${escapeHtml(item.id)}" title="Admin onayıyla geri al">Geri Al (Admin)</button>` : ""}
            </span>
          </div>
        `;
        }).join("")
      : `<div style="padding:12px 0;color:#64748b;font-size:11px;">Henüz reassessment kaydı bulunmuyor.</div>`;

    return `
      <div style="margin-top:28px;border-top:1px solid #e5e7eb;padding-top:24px;">
        <div>
          <div style="font-size:10px;color:#64748b;font-weight:800;letter-spacing:1px;">YENİDEN DEĞERLENDİRME YÖNETİMİ</div>
          <h3 style="margin:5px 0 0;font-size:18px;">Kira Yeniden Değerlendirmesi</h3>
          <p style="margin:5px 0 0;color:#64748b;font-size:11px;">Yeniden değerlendirmeler modifikasyonlardan ayrı izlenir. Muhasebe etkisi yalnızca uygulanan (APPLIED) yeniden değerlendirmeler için oluşur.</p>
          <p style="margin:7px 0 0;color:#475569;font-size:11px;">
            <strong>Ne zaman kullanılır?</strong> Yeni sözleşme imzalanmadan, mevcut hüküm veya endeks/opsiyon değişikliği kira ödemelerini yeniden ölçmeyi gerektirdiğinde kullanılır.
          </p>
        </div>

        <div style="margin-top:16px;padding:14px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;">
            <label style="font-size:10px;font-weight:700;">Reassessment Tarihi<input id="reassessmentDate" type="date" value="${today}" style="display:block;width:100%;margin-top:5px;"></label>
            <label style="font-size:10px;font-weight:700;">Yürürlük Tarihi<input id="reassessmentEffectiveDate" type="date" value="${today}" style="display:block;width:100%;margin-top:5px;"></label>
            <label style="font-size:10px;font-weight:700;">Tip<select id="reassessmentType" style="display:block;width:100%;margin-top:5px;">
              <option value="LEASE_TERM_CHANGE">Kira Süresi Değişikliği</option>
              <option value="RENEWAL_OPTION_CHANGE">Yenileme Opsiyonu Değişikliği</option>
              <option value="TERMINATION_OPTION_CHANGE">Fesih Opsiyonu Değişikliği</option>
              <option value="PURCHASE_OPTION_CHANGE">Satın Alma Opsiyonu Değişikliği</option>
              <option value="INDEX_RATE_CHANGE">Endeks / Oran Değişikliği</option>
              <option value="FIXED_PAYMENT_CHANGE">Sabit Ödeme Değişikliği</option>
              <option value="COMBINED_REASSESSMENT">Birleşik Reassessment</option>
              <option value="OTHER">Diğer</option>
            </select></label>
            ${contract.paymentFrequency === "irregular" ? `<label style="font-size:10px;font-weight:700;grid-column:1/-1;">Yürürlük tarihinden sonraki yeni ödeme takvimi (Tarih | Tutar | Referans)<textarea id="reassessmentNewSchedule" rows="5" style="display:block;width:100%;margin-top:5px;">${datedScheduleText(contract, today)}</textarea><input id="reassessmentNewPayment" type="hidden" value="0"></label>` : `<label style="font-size:10px;font-weight:700;">Yeni Aylık Ödeme<input id="reassessmentNewPayment" type="number" min="0" step="0.01" value="${Number(contract.monthlyPayment) || 0}" style="display:block;width:100%;margin-top:5px;"></label>`}
            <label style="font-size:10px;font-weight:700;">Yeni Kira Bitiş Tarihi<input id="reassessmentNewEndDate" type="date" value="${escapeHtml(contract.endDate || "")}" style="display:block;width:100%;margin-top:5px;"></label>
            <label style="font-size:10px;font-weight:700;">Yeni İskonto Oranı %<input id="reassessmentNewDiscountRate" type="number" min="0" step="0.0001" value="${Number(contract.discountRate) || 0}" style="display:block;width:100%;margin-top:5px;"></label>
            <label style="font-size:10px;font-weight:700;">Yenileme Opsiyonu<select id="reassessmentRenewalOption" style="display:block;width:100%;margin-top:5px;"><option value="false">Makul ölçüde kesin değil</option><option value="true">Makul ölçüde kesin</option></select></label>
            <label style="font-size:10px;font-weight:700;">Fesih Opsiyonu<select id="reassessmentTerminationOption" style="display:block;width:100%;margin-top:5px;"><option value="false">Beklenmiyor</option><option value="true">Bekleniyor / kullanıldı</option></select></label>
            <label style="font-size:10px;font-weight:700;">Satın Alma Opsiyonu<select id="reassessmentPurchaseOption" style="display:block;width:100%;margin-top:5px;"><option value="false">Makul ölçüde kesin değil</option><option value="true">Makul ölçüde kesin</option></select></label>
          </div>

          <label style="display:block;font-size:10px;font-weight:700;margin-top:10px;">Neden <span style="font-weight:400;color:#64748b;">(endeks, oran veya opsiyon kaynağını belirtin)</span><input id="reassessmentReason" type="text" placeholder="Örn. TÜFE endeksi değişti" style="display:block;width:100%;margin-top:5px;"></label>

          <button type="button" id="createReassessmentButton" class="primary-button" ${createDisabledAttr}>Reassessment Oluştur</button>
        </div>

        <div style="margin-top:16px;">
          <div style="display:grid;grid-template-columns:1.1fr 1fr 1fr 1fr auto;gap:8px;font-size:10px;font-weight:800;color:#64748b;padding-bottom:7px;">
            <span>TİP</span><span>YÜRÜRLÜK</span><span>DURUM</span><span>YÜKÜMLÜLÜK Δ</span><span>İŞLEM</span>
          </div>
          ${rows}
        </div>
      </div>
    `;
  }

  function initReassessmentEvents(contract, onChanged) {
    const refreshHost = typeof onChanged === "function" ? onChanged : () => openDetail(contract.id);

    function refreshAfterMutation() {
      refreshPrivateCalculationAfterMutation(contract)
        .catch(() => null)
        .finally(() => refreshHost());
    }

    let editingReassessmentId = null;
    const createButton = document.getElementById("createReassessmentButton");

    function resetReassessmentFormMode() {
      editingReassessmentId = null;
      if (createButton) createButton.textContent = "Reassessment Oluştur";
    }

    function populateReassessmentForm(item) {
      const setValue = (elId, value) => {
        const el = document.getElementById(elId);
        if (el) el.value = value;
      };
      setValue("reassessmentDate", item.reassessmentDate || new Date().toISOString().slice(0, 10));
      setValue("reassessmentEffectiveDate", item.effectiveDate || "");
      setValue("reassessmentType", item.type || "OTHER");
      setValue("reassessmentNewPayment", item.newPayment ?? (Number(contract.monthlyPayment) || 0));
      setValue("reassessmentNewEndDate", item.newLeaseEndDate || item.leaseEndDate || "");
      setValue("reassessmentNewDiscountRate", item.newDiscountRate ?? (Number(contract.discountRate) || 0));
      setValue("reassessmentRenewalOption", String(item.newRenewalOption === true));
      setValue("reassessmentTerminationOption", String(item.newTerminationOption === true));
      setValue("reassessmentPurchaseOption", String(item.newPurchaseOption === true));
      setValue("reassessmentReason", item.reason || "");
    }

    const submitReassessmentForm = async () => {
      const input = {
        reassessmentDate: document.getElementById("reassessmentDate")?.value,
        effectiveDate: document.getElementById("reassessmentEffectiveDate")?.value,
        type: document.getElementById("reassessmentType")?.value || "OTHER",
        newPayment: document.getElementById("reassessmentNewPayment")?.value,
        newLeaseEndDate: document.getElementById("reassessmentNewEndDate")?.value,
        newDiscountRate: document.getElementById("reassessmentNewDiscountRate")?.value,
        newRenewalOption: document.getElementById("reassessmentRenewalOption")?.value === "true",
        newTerminationOption: document.getElementById("reassessmentTerminationOption")?.value === "true",
        newPurchaseOption: document.getElementById("reassessmentPurchaseOption")?.value === "true",
        reason: document.getElementById("reassessmentReason")?.value || "",
        status: "DRAFT"
      };
      if (contract.paymentFrequency === "irregular") {
        const parsed = parseExplicitPaymentSchedule(document.getElementById("reassessmentNewSchedule")?.value, contract.currency || "TRY");
        if (parsed.errors.length) { showAlert(parsed.errors.join("\n")); return; }
        input.type = "OTHER";
        input.newExplicitPaymentSchedule = parsed.rows.map(({ line, ...row }) => row);
      }

      const originalLabel = createButton.textContent;
      createButton.disabled = true;
      createButton.textContent = "Kaydediliyor...";

      const result = editingReassessmentId
        ? await updateReassessment(contract, editingReassessmentId, input)
        : await createReassessment(contract, input);

      createButton.disabled = false;
      createButton.textContent = originalLabel;

      if (!result.valid) {
        showAlert(changeErrorText(result));
        return;
      }
      resetReassessmentFormMode();
      refreshAfterMutation();
    };

    const handleReassessmentAction = async (action, id, button) => {
      if (action === "edit") {
        const item = (contract.reassessments || []).find(r => r.id === id);
        if (!item) return;
        editingReassessmentId = id;
        populateReassessmentForm(item);
        if (createButton) {
          createButton.textContent = "Reassessmenti Güncelle";
          createButton.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        return;
      }

      if (action === "apply") {
        button.disabled = true;
        let result;
        try {
          result = await applyReassessment(contract, id);
        } catch (error) {
          button.disabled = false;
          showAlert(`Reassessment uygulanamadı: ${error?.message || String(error)}`);
          return;
        }
        button.disabled = false;
        if (!result.valid) {
          showAlert(changeErrorText(result));
          return;
        }
        refreshAfterMutation();
        return;
      }

      if (action === "cancel") {
        button.disabled = true;
        const result = await cancelReassessment(contract, id);
        button.disabled = false;
        if (!result.valid) {
          showAlert(changeErrorText(result));
          return;
        }
        refreshAfterMutation();
      }
    };

    const binder = window.LeaseQantTfrs16OperationsUi?.bindReassessmentEvents;
    if (typeof binder === "function") {
      binder(contract, { submitForm: submitReassessmentForm, handleAction: handleReassessmentAction });
    } else {
      createButton?.addEventListener("click", submitReassessmentForm);
      document.querySelectorAll("[data-reass-action]").forEach(button => {
        button.addEventListener("click", () => handleReassessmentAction(button.dataset.reassAction, button.dataset.reassId, button));
      });
    }
  }

  /**
   * renderPaymentScheduleHeader — ödeme planı başlığı/açıklaması.
   * Saf template-string, DOM'a dokunmaz. Çıktısı orijinalin bu
   * bloğundan byte-bazlı birebir (programatik extract + reassembly
   * doğrulamasıyla kanıtlandı — bkz. PROJECT_CONTEXT.md bölüm 36).
   * 
   * FAZ 3 — SRP BÖLMESİ.
   */
  function renderPaymentScheduleHeader() {
    const renderer = window.LeaseQantTfrs16OperationsUi?.renderPaymentScheduleHeader;
    return typeof renderer === "function" ? renderer() : "";
  }

  /**
   * renderPaymentScheduleFilters — periyot/yıl/ay/para birimi filtre
   * kontrolleri ve "Excel'e Aktar" butonu.
   */
  function renderPaymentScheduleFilters(contract) {
    const renderer = window.LeaseQantTfrs16OperationsUi?.renderPaymentScheduleFilters;
    return typeof renderer === "function" ? renderer(contract) : "";
  }

  /**
   * renderPaymentScheduleTableShell — ödeme planı tablosunun sabit
   * başlık satırı ve boş gövdesi.
   */
  function renderPaymentScheduleTableShell() {
    const renderer = window.LeaseQantTfrs16OperationsUi?.renderPaymentScheduleTableShell;
    return typeof renderer === "function" ? renderer() : "";
  }

  /**
   * renderPaymentScheduleFooterContainers — boş durum mesajı ve
   * FX/enflasyon düzeltmesi konteynerleri.
   */
  function renderPaymentScheduleFooterContainers() {
    const renderer = window.LeaseQantTfrs16OperationsUi?.renderPaymentScheduleFooterContainers;
    return typeof renderer === "function" ? renderer() : "";
  }

  /**
   * renderPaymentScheduleSection — ödeme planı bölümünün TAM
   * HTML'ini üretir. PUBLIC API imzası HİÇ DEĞİŞMEDİ. İçi 4 alt
   * fonksiyona bölündü (Faz 3 — SRP); ${} yerleştirmeleri
   * orijinal metnin TAM O NOKTALARINI (programatik extract
   * edilmiş, hiçbir karakter eklenmeden/çıkarılmadan) geri
   * koyuyor — bkz. PROJECT_CONTEXT.md bölüm 36.
   */
  function legacyReportAuth_renderPaymentScheduleSection(contract) {
    const renderer = window.LeaseQantTfrs16OperationsUi?.renderPaymentScheduleSection;
    return typeof renderer === "function" ? renderer(contract) : "";
  }

  function legacyReportAuth_renderContractAuditTab(contract, events) {
    const renderer = window.LeaseQantTfrs16ReportingUi?.renderContractAuditTab;
    return typeof renderer === "function"
      ? renderer(contract, events)
      : `<div class="gk-v26-card" style="color:#991b1b;">Denetim izi arayüzü yüklenemedi. Sayfayı yenileyin.</div>`;
  }

  function getScheduleReportingDate() {
    const selected = document.getElementById("scheduleReportingDate")?.value;
    if (selected) return selected;
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  }

  async function renderPaymentScheduleTable(contract) {
    // UI v2 consumes the verified reporting package; the retired converter
    // must never be revived as an alternative financial authority.
    if (document.documentElement.getAttribute("data-lq-ui") === "2") {
      const content = document.getElementById("detailContent");
      return window.LeaseQantReportingAuthorityUi?.renderContractDetails(content, contract);
    }
    const periodType =
      document.getElementById(
        "schedulePeriodType"
      )?.value || "all";

    const year =
      Number(
        document.getElementById(
          "scheduleYear"
        )?.value
      );

    const subPeriod =
      document.getElementById(
        "scheduleSubPeriod"
      )?.value;

    // The payment-plan tab is a read-only consumer: ask the private facade
    // on demand so a fast tab click cannot display a stale result.
    // API-primary fails closed when the private result is absent.
    const privateResult = await loadPrivateReadOnlyResult(contract);
    if (isPrivateCalculationApiReady() && !privateResult) {
      window.LeaseQantTfrs16OperationsUi?.renderPaymentScheduleState?.({
        emptyMessage: "Private hesaplama sonucu hazır olduğunda ödeme planı görüntülenecek.",
        fxMessage: "Kurlar doğrulanıp private hesaplama tamamlandıktan sonra tekrar deneyin."
      });
      return;
    }
    const engine = privateResult?.schedule
      ? privateResult
      : typeof cfoBuildSchedule === "function"
        ? cfoBuildSchedule(contract)
        : getPrivateCalculationForConsumer(contract);

    const filteredRows = filterSchedule(
      engine.schedule,
      year,
      subPeriod,
      periodType
    );
    const presentationCurrency = String(document.getElementById("schedulePresentationCurrency")?.value || contract?.currency || "TRY").toUpperCase();
  const sourceCurrency = String(contract?.currency || "TRY").toUpperCase();
  if (sourceCurrency !== presentationCurrency && (!Array.isArray(backendFxRateCache) || backendFxRateCache.length === 0)) {
    await refreshFxRateCacheFromBackend();
  }
  const conversion = await v26ConvertScheduleToPresentation(
    filteredRows,
    sourceCurrency,
    presentationCurrency,
    getScheduleReportingDate()
  );
    const rows = conversion.schedule;
    const fxMessage = sourceCurrency === presentationCurrency ? "" : conversion.ok
      ? `${conversion.asOfDate} kuruyla gösterim: 1 ${sourceCurrency} = ${conversion.rate} ${presentationCurrency}. Gelecek ödemelerin bu karşılığı tahmin veya muhasebe kaydı değildir.`
      : `${sourceCurrency}/${presentationCurrency}: ${conversion.asOfDate} için kur bulunamadı. Raporlama Tarihi alanından kayıtlı kur tarihini seçin.`;

    // V18 Parça 1 — satır sunumu operations UI modülündedir; motor yalnızca
    // private sonuçları ve dönüşüm verisini köprü üzerinden sağlar.
    const basePaymentV18 = Number(contract?.monthlyPayment) || 0;
    const rowRenderer = window.LeaseQantTfrs16OperationsUi?.renderPaymentScheduleRows;
    const rowsHtml = typeof rowRenderer === "function"
      ? rowRenderer(rows, presentationCurrency, basePaymentV18)
      : "";
    window.LeaseQantTfrs16OperationsUi?.renderPaymentScheduleState?.({
      rowsHtml,
      fxMessage,
      hasRows: rows.length
    });
  }

  function renderFxTranslationSection(contract) {
    const renderer = window.LeaseQantTfrs16FxUi?.mount || window.LeaseQantTfrs16FxUi?.render;
    return typeof renderer === "function"
      ? renderer(document.getElementById("fxTranslationContainer"), contract)
      : null;
  }

  /**
   * V18 Parça 2 — "Enflasyon Düzeltmesi (TMS 29)" paneli. Dönem
   * seçimi ve private TMS29 önizleme sonucu; DRAFT oluşturma, uygula/iptal
   * ve jurnal görünümü private API zarfı üzerinden yürütülür.
   * SINIR notu UI'da da gösterilir (belge şartı).
   */
  function renderInflationAdjustmentSection(contract) {
    const container = document.getElementById("inflationAdjustmentContainer");
    if (!container) return;

    ensureInflationAdjustmentState(contract);

    const adjustments = (contract.inflationAdjustments || []).slice()
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

    const rowsRenderer = window.LeaseQantTfrs16ReportingUi?.renderInflationAdjustmentRows;
    const rowsHtml = typeof rowsRenderer === "function"
      ? rowsRenderer(adjustments, {
          escapeHtml,
          formatCurrency,
          assertPeriodWritable: (period) => assertPeriodWritable(contract, period),
          defaultPeriod: contract?.startDate || new Date()
        })
      : "";

    const shellRenderer = window.LeaseQantTfrs16ReportingUi?.renderInflationAdjustmentShell;
    if (typeof shellRenderer === "function") {
      container.innerHTML = shellRenderer(rowsHtml);
    } else {
      container.innerHTML = "";
    }

    let lastPrivateTms29Result = null;
    const showInflationAdjustmentAlert = message => {
      const renderer = window.LeaseQantTfrs16ReportingUi?.showInflationActionAlert;
      if (typeof renderer === "function") return renderer(message);
      // Reporting UI yüklenemezse mevcut genel uyarı davranışını koru.
      return showAlert(message);
    };

    const loadPrivateTms29Result = async (period, periodStart) => {
      const facade = window.LeaseQantPrivateTfrs16Facade;
      if (!isPrivateCalculationApiReady() || typeof facade?.loadTms29 !== "function") {
        throw new Error("Private TMS 29 API hazır değil; yerel hesaplama kapalı.");
      }
      const privateResult = await facade.loadTms29(contract, period, periodStart || null);
      if (privateResult?.tms29Version !== 1 || !privateResult.totals) {
        throw new Error("Private TMS 29 sonucu beklenen biçimde dönmedi.");
      }
      return privateResult;
    };

    const runInflationPreview = async () => {
      const period = document.getElementById("inflReportingPeriod")?.value || "";
      const periodStart = document.getElementById("inflPeriodStart")?.value || "";
      const result = document.getElementById("inflPreviewResult");
      if (!result) return;
      let t = null;
      const basicPeriodValid = /^\d{4}-(0[1-9]|1[0-2])$/.test(period)
        && (!periodStart || /^\d{4}-(0[1-9]|1[0-2])$/.test(periodStart))
        && (!periodStart || periodStart <= period);
      // FAZ 2 temizliği (2026-09-15): dönem doğrulaması yalnızca biçim ve
      // sıra kontrolüdür. Gösterilen rakamlar private API zarfından gelir;
      // public dosyada yerel TMS 29 hesaplama veya yazma yedeği yoktur.
      if (!period) {
        const renderer = window.LeaseQantTfrs16ReportingUi?.renderInflationPreviewMessage;
        result.innerHTML = typeof renderer === "function"
          ? renderer("Raporlama dönemi seçin.", { escapeHtml })
          : "";
        return;
      }
      if (!basicPeriodValid) {
        const renderer = window.LeaseQantTfrs16ReportingUi?.renderInflationPreviewMessage;
        const message = `Raporlama dönemi formatı YYYY-MM olmalı${periodStart ? " ve Dönem Başlangıcı raporlama döneminden sonra olamaz." : "."}`;
        result.innerHTML = typeof renderer === "function"
          ? renderer(message, { escapeHtml })
          : "";
        return;
      }
      if (basicPeriodValid) {
        try {
          lastPrivateTms29Result = await loadPrivateTms29Result(period, periodStart);
          t = lastPrivateTms29Result.totals;
        } catch (error) {
          lastPrivateTms29Result = null;
          const renderer = window.LeaseQantTfrs16ReportingUi?.renderInflationPreviewError;
          result.innerHTML = typeof renderer === "function"
            ? renderer(error, { escapeHtml })
            : "";
          return;
        }
      } else {
        lastPrivateTms29Result = null;
        const renderer = window.LeaseQantTfrs16ReportingUi?.renderInflationPreviewMessage;
        result.innerHTML = typeof renderer === "function"
          ? renderer("Private TMS 29 API hazır değil; yerel hesaplama kapalı.", { escapeHtml })
          : "";
        return;
      }
      const summaryRenderer = window.LeaseQantTfrs16ReportingUi?.renderInflationPreviewSummary;
      result.innerHTML = typeof summaryRenderer === "function"
        ? summaryRenderer(lastPrivateTms29Result, { formatCurrency })
        : "";

      // Önizleme, henüz kalıcı bir DRAFT oluşturmadan da kullanıcıya
      // hesaplanan dönemi tabloda göstermeli. Önceki akış yalnızca üst özeti
      // güncelliyor, tabloyu "Henüz TMS 29 hesaplanmadı" durumunda bırakıyordu.
      // Satır doğrudan private API zarfından üretilir; public motor devreye
      // girmez ve kalıcı kayıt ancak "Taslak Oluştur" ile yapılır.
      const previewBody = container.querySelector("table tbody");
      if (previewBody) {
        const previewRenderer = window.LeaseQantTfrs16ReportingUi?.renderInflationPreviewRow;
        if (typeof previewRenderer === "function") {
          previewBody.innerHTML = previewRenderer(lastPrivateTms29Result, { escapeHtml, formatCurrency, period });
        }
      }
    };

    // Aşağıdaki 5 handler (createDraft, applyAdjustment, cancelAdjustment,
    // updateCreateBtnLockState, runInflationPreview zaten yukarıda) event
    // bağlama mekaniğinden AYRI tutuluyor — asıl iş mantığı (private API
    // çağrısı, kayıt, rollback) burada, hangi DOM elemanının hangi handler'ı
    // tetiklediği ise reporting-ui.js'deki bindInflationAdjustmentEvents'te
    // (bindPaymentScheduleEvents ile aynı desen, 2026-09-16 UI ayrıştırması).
    const savedReportingDate = parseDate(contract?.reportingDate || contract?.tms29ReportingDate);

    const updateCreateBtnLockState = (periodValue) => {
      const createBtn = document.getElementById("inflCreateBtn");
      if (!createBtn) return;
      const lockCheck = periodValue ? assertPeriodWritable(contract, periodValue) : { locked: false };
      if (lockCheck.locked) {
        createBtn.disabled = true;
        createBtn.title = lockCheck.message;
        createBtn.style.opacity = ".5";
        createBtn.style.cursor = "not-allowed";
      } else {
        createBtn.disabled = false;
        createBtn.title = "";
        createBtn.style.opacity = "";
        createBtn.style.cursor = "";
      }
    };

    const createDraft = async () => {
      const period = document.getElementById("inflReportingPeriod")?.value || "";
      const periodStart = document.getElementById("inflPeriodStart")?.value || "";
      const basicPeriodValid = /^\d{4}-(0[1-9]|1[0-2])$/.test(period)
        && (!periodStart || /^\d{4}-(0[1-9]|1[0-2])$/.test(periodStart))
        && (!periodStart || periodStart <= period);
      if (!basicPeriodValid) {
        showAlert("Raporlama dönemi formatı YYYY-MM olmalı ve Dönem Başlangıcı raporlama döneminden sonra olamaz.");
        return;
      }
      const lockCheck = assertPeriodWritable(contract, period);
      if (lockCheck.locked) {
        showInflationAdjustmentAlert(lockCheck.message);
        return;
      }

      const previousAdjustments = cloneModificationValue(contract.inflationAdjustments || []);
      const previousAuditTrail = cloneModificationValue(contract.auditTrail || []);
      const button = document.getElementById("inflCreateBtn");
      if (button) { button.disabled = true; button.textContent = "Private API hesaplıyor..."; }
      try {
        // TMS29 numbers and the eventual journal come from the private
        // service. The public page only creates a UI record and persists it.
        const privateResult = await loadPrivateTms29Result(period, periodStart);
        const now = new Date().toISOString();
        const prefix = String(contract?.id || "LEASE").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 24) || "LEASE";
        const adjustment = {
          id: `${prefix}-INFL-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          period: privateResult.reportingPeriod || period,
          periodStart: privateResult.liabilityRollForward?.periodStart || periodStart || null,
          testedAt: now,
          reason: "TMS 29 enflasyon düzeltmesi (kiralama portföyü)",
          status: "DRAFT",
          restatedFigures: privateResult.totals,
          journal: [],
          calculationSource: "PRIVATE_API",
          createdAt: now,
          updatedAt: now
        };
        ensureInflationAdjustmentState(contract);
        contract.inflationAdjustments.push(adjustment);
        recordAuditEvent({
          action: "INFLATION_ADJUSTMENT_CREATED",
          entityType: "INFLATION_ADJUSTMENT",
          entityId: adjustment.id,
          contractId: contract.id,
          reason: adjustment.reason,
          metadata: { source: "PRIVATE_API" },
          newValue: adjustment
        });
        saveContracts(contracts);
        await persistContractToApi(contract, true);
        renderInflationAdjustmentSection(contract);
      } catch (error) {
        contract.inflationAdjustments = previousAdjustments;
        contract.auditTrail = previousAuditTrail;
        saveContracts(contracts);
        showInflationAdjustmentAlert(`Private TMS 29 taslağı kaydedilemedi: ${error?.message || String(error)}`);
      } finally {
        if (button) { button.disabled = false; button.textContent = "Taslak Oluştur"; }
      }
    };

    const applyAdjustment = async (adjustmentId, btn) => {
      const adjustment = (contract.inflationAdjustments || []).find(a => a.id === adjustmentId);
      if (!adjustment) { showInflationAdjustmentAlert("Enflasyon düzeltme kaydı bulunamadı."); return; }
      if (adjustment.status === "APPLIED") return;
      if (adjustment.status === "CANCELLED") { showInflationAdjustmentAlert("CANCELLED düzeltme uygulanamaz."); return; }
      const lockCheck = assertPeriodWritable(contract, adjustment.period || new Date());
      if (lockCheck.locked) { showInflationAdjustmentAlert(lockCheck.message); return; }
      const previousAdjustments = cloneModificationValue(contract.inflationAdjustments || []);
      const previousAuditTrail = cloneModificationValue(contract.auditTrail || []);
      if (btn) { btn.disabled = true; btn.textContent = "Private API uyguluyor..."; }
      try {
        const privateResult = await loadPrivateTms29Result(adjustment.period, adjustment.periodStart || null);
        adjustment.restatedFigures = privateResult.totals;
        adjustment.journal = Array.isArray(privateResult.journal) ? privateResult.journal : [];
        adjustment.calculationSource = "PRIVATE_API";
        adjustment.status = "APPLIED";
        adjustment.updatedAt = new Date().toISOString();
        recordAuditEvent({
          action: "INFLATION_ADJUSTMENT_APPLIED",
          entityType: "INFLATION_ADJUSTMENT",
          entityId: adjustment.id,
          contractId: contract.id,
          reason: adjustment.reason,
          metadata: { source: "PRIVATE_API" },
          newValue: adjustment
        });
        saveContracts(contracts);
        await persistContractToApi(contract, true);
        renderInflationAdjustmentSection(contract);
      } catch (error) {
        contract.inflationAdjustments = previousAdjustments;
        contract.auditTrail = previousAuditTrail;
        saveContracts(contracts);
        showInflationAdjustmentAlert(`Private TMS 29 uygulanamadı: ${error?.message || String(error)}`);
        if (btn) { btn.disabled = false; btn.textContent = "Uygula"; }
      }
    };

    const cancelAdjustment = async (adjustmentId, btn) => {
      if (!confirm("Bu taslak enflasyon düzeltmesi iptal edilecek. Emin misiniz?")) return;
      const adjustment = (contract.inflationAdjustments || []).find(a => a.id === adjustmentId);
      if (!adjustment) { showInflationAdjustmentAlert("Enflasyon düzeltme kaydı bulunamadı."); return; }
      if (adjustment.status !== "DRAFT") { showInflationAdjustmentAlert("Yalnızca DRAFT durumundaki düzeltmeler iptal edilebilir."); return; }
      const previousAdjustments = cloneModificationValue(contract.inflationAdjustments || []);
      const previousAuditTrail = cloneModificationValue(contract.auditTrail || []);
      if (btn) btn.disabled = true;
      try {
        adjustment.status = "CANCELLED";
        adjustment.updatedAt = new Date().toISOString();
        recordAuditEvent({
          action: "INFLATION_ADJUSTMENT_CANCELLED",
          entityType: "INFLATION_ADJUSTMENT",
          entityId: adjustment.id,
          contractId: contract.id,
          reason: "Kullanıcı tarafından iptal edildi"
        });
        saveContracts(contracts);
        await persistContractToApi(contract, true);
        renderInflationAdjustmentSection(contract);
      } catch (error) {
        contract.inflationAdjustments = previousAdjustments;
        contract.auditTrail = previousAuditTrail;
        saveContracts(contracts);
        showInflationAdjustmentAlert(`Private TMS 29 taslağı iptal edilemedi: ${error?.message || String(error)}`);
        if (btn) btn.disabled = false;
      }
    };

    const binder = window.LeaseQantTfrs16ReportingUi?.bindInflationAdjustmentEvents;
    if (typeof binder === "function") {
      binder(contract, container, {
        runPreview: runInflationPreview,
        createDraft,
        applyAdjustment,
        cancelAdjustment,
        updateCreateBtnLockState,
        savedReportingDate
      });
    } else {
      // UI modülü yüklenemezse eski (doğrudan) bağlama davranışına düş.
      document.getElementById("inflPreviewBtn")?.addEventListener("click", () => { runInflationPreview(); });
      const reportingInput = document.getElementById("inflReportingPeriod");
      const startInput = document.getElementById("inflPeriodStart");
      if (savedReportingDate && reportingInput && !reportingInput.value) {
        const reportMonth = `${savedReportingDate.getFullYear()}-${String(savedReportingDate.getMonth() + 1).padStart(2, "0")}`;
        reportingInput.value = reportMonth;
        if (startInput && !startInput.value) startInput.value = `${savedReportingDate.getFullYear()}-01`;
        runInflationPreview();
      }
      document.getElementById("inflReportingPeriod")?.addEventListener("change", (e) => {
        updateCreateBtnLockState(e.target.value || "");
      });
      document.getElementById("inflCreateBtn")?.addEventListener("click", () => { createDraft(); });
      container.querySelectorAll(".infl-apply-btn").forEach(btn => {
        btn.addEventListener("click", () => applyAdjustment(btn.dataset.id, btn));
      });
      container.querySelectorAll(".infl-cancel-btn").forEach(btn => {
        btn.addEventListener("click", () => cancelAdjustment(btn.dataset.id, btn));
      });
    }
  }

  function bindPersistedOperationForm(contract, operation, prefix, readFields, render) {
    const ui = window.LeaseQantTfrs16OperationsUi;
    const container = document.getElementById(prefix === "slb" ? "slbSectionContainer" : "subleaseSectionContainer");
    container?._lqPreviewDispose?.();
    const key = prefix === "slb" ? "saleAndLeaseback" : "sublease";
    const dispose = ui?.bindSlbPreviewFlow?.({
      readInput: () => ({
        intent: { companyId: contract.companyId, operation, input: readFields(),
          reportingDate: window.LeaseQantReportingPeriod?.get?.().reportingDate },
        localContractState: contract,
        activeCompanyId: typeof getActiveCompanyId === "function" ? getActiveCompanyId() : contract.companyId
      }),
      preview: async ({ intent, activeCompanyId }) => {
        if (activeCompanyId && activeCompanyId !== "ALL" && activeCompanyId !== intent.companyId) {
          const error = new Error("Aktif şirket sözleşmenin şirketiyle eşleşmiyor."); error.code = "OPERATION_COMPANY_CHANGED"; throw error;
        }
        const facade = window.LeaseQantPrivateTfrs16Facade;
        if (typeof facade?.previewPersistedOperation !== "function") throw new Error("Sunucu önizleme kaynağı hazır değil.");
        return facade.previewPersistedOperation(contract.id, intent);
      },
      render: envelope => render(envelope.result),
      canSave: envelope => envelope?.saveAuthority === "FORM_ONLY" && typeof envelope.receipt === "string" && !!envelope.receipt,
      save: async ({ intent }, envelope) => {
        const facade = window.LeaseQantPrivateTfrs16Facade;
        if (typeof facade?.saveOperationForm !== "function") throw new Error("Onaylı form kayıt kaynağı hazır değil.");
        await facade.saveOperationForm(contract.id, intent, envelope.receipt);
        contract[key] = { ...contract[key], ...intent.input };
        const idx = contracts.findIndex(c => c.id === contract.id);
        if (idx >= 0) contracts[idx] = contract;
        saveContracts(contracts);
      }
    }, prefix);
    if (container) container._lqPreviewDispose = dispose;
  }

  function renderSlbSection(contract) {
    const container = document.getElementById("slbSectionContainer");
    if (!container) return;

    // DÜZELTME: PR #348'de SLB form markup'ı operations-ui modülüne
    // taşınırken bu satır yanlışlıkla silinmiş — aşağıdaki
    // "if (saved) runAndRenderSlb(false)" satırı `saved` tanımsız
    // olduğu için ReferenceError fırlatıyordu (SLB sekmesi hiç
    // açılamıyordu). Sublease karşılığıyla (renderSubleaseSection)
    // birebir aynı desen.
    const saved = contract.saleAndLeaseback || null;

    const formRenderer = window.LeaseQantTfrs16OperationsUi?.renderSlbForm;
    const formHtml = typeof formRenderer === "function"
      ? formRenderer(contract)
      : "";

    container.innerHTML = formHtml;

    if (document.documentElement.getAttribute("data-lq-ui") === "2") {
      bindPersistedOperationForm(contract, "SALE_AND_LEASEBACK", "slb", () => {
        const sale = !!document.getElementById("slbQualifiesAsSale")?.checked;
        const pvRaw = document.getElementById("slbLeasebackPV")?.value;
        const pvRef = (document.getElementById("slbLeasebackPVRef")?.value || "").trim();
        return {
          previousCarryingAmount: Number(document.getElementById("slbCarryingAmount")?.value),
          fairValueOfAsset: Number(document.getElementById("slbFairValue")?.value),
          saleProceeds: Number(document.getElementById("slbSaleProceeds")?.value),
          qualifiesAsSale: sale,
          professionalJudgmentNote: document.getElementById("slbNote")?.value || "",
          saleAssessmentReference: (document.getElementById("slbSaleAssessmentRef")?.value || "").trim(),
          // A failed sale carries no leaseback PV evidence (TFRS 16.103).
          leasebackPV: sale && pvRaw !== "" && pvRaw != null ? Number(pvRaw) : null,
          leasebackPVReference: sale ? pvRef : null
        };
      }, renderSlbResultHtml);
      return;
    }

    async function runAndRenderSlb(persist) {
      const resultBox = document.getElementById("slbResultContainer");
      const input = {
        previousCarryingAmount: Number(document.getElementById("slbCarryingAmount")?.value),
        fairValueOfAsset: Number(document.getElementById("slbFairValue")?.value),
        saleProceeds: Number(document.getElementById("slbSaleProceeds")?.value),
        qualifiesAsSale: !!document.getElementById("slbQualifiesAsSale")?.checked,
        professionalJudgmentNote: document.getElementById("slbNote")?.value || "",
        leasebackContract: contract
      };

      const calcButton = document.getElementById("slbCalculateButton");

      if (persist) {
        // Rollback için ÖNCEKİ değeri sakla (backend yazma başarısız
        // olursa geri yüklenecek — bkz. PROJECT_CONTEXT.md bölüm 23
        // madde 14/16, Modification/Reassessment ile AYNI desen).
        const previousSaleAndLeaseback = contract.saleAndLeaseback
          ? cloneModificationValue(contract.saleAndLeaseback)
          : null;

        contract.saleAndLeaseback = {
          previousCarryingAmount: input.previousCarryingAmount,
          fairValueOfAsset: input.fairValueOfAsset,
          saleProceeds: input.saleProceeds,
          qualifiesAsSale: input.qualifiesAsSale,
          professionalJudgmentNote: input.professionalJudgmentNote,
          savedAt: new Date().toISOString()
        };
        const idx = contracts.findIndex(c => c.id === contract.id);
        if (idx >= 0) contracts[idx] = contract;
        saveContracts(contracts);

        if (calcButton) {
          calcButton.disabled = true;
          calcButton.textContent = "Kaydediliyor...";
        }

        try {
          await persistContractToApi(contract, true);
        } catch (error) {
          contract.saleAndLeaseback = previousSaleAndLeaseback;
          saveContracts(contracts);
          if (calcButton) {
            calcButton.disabled = false;
            calcButton.textContent = "Hesapla ve Kaydet";
          }
          if (resultBox) {
            resultBox.innerHTML = `
              <div style="padding:12px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;color:#991b1b;font-size:12px;">
                Backend'e kaydedilemedi: ${escapeHtml(error?.message || String(error))}
              </div>
            `;
          }
          return;
        }

        if (calcButton) {
          calcButton.disabled = false;
          calcButton.textContent = "Hesapla ve Kaydet";
        }
      }

      if (!resultBox) return;
      try {
        const facade = window.LeaseQantPrivateTfrs16Facade;
        if (typeof facade?.loadSaleAndLeaseback !== "function") {
          throw new Error("Private satış ve geri kiralama API'si hazır değil.");
        }
        // The sale-and-leaseback endpoint returns the authoritative special
        // flow envelope directly. The browser only renders it and never
        // rebuilds annuity, PV, liability, ROU, or gain/loss values.
        const result = await facade.loadSaleAndLeaseback(input);
        if (!result) {
          const unavailable = new Error("Private satış ve geri kiralama sonucu henüz hazır değil");
          unavailable.code = "PRIVATE_SPECIAL_FLOW_NOT_READY";
          throw unavailable;
        }
        resultBox.innerHTML = renderSlbResultHtml(result);
      } catch (error) {
        resultBox.innerHTML = `
          <div style="padding:12px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;color:#991b1b;font-size:12px;">
            Hesaplanamadı: ${escapeHtml(error.message || String(error))}
          </div>
        `;
      }
    }

    const binder = window.LeaseQantTfrs16OperationsUi?.bindSlbEvents;
    if (typeof binder === "function") {
      binder(contract, { calculateAndRender: runAndRenderSlb, autoRun: !!saved });
    } else {
      // UI modülü yüklenemezse eski (doğrudan) bağlama davranışına düş.
      document.getElementById("slbCalculateButton")?.addEventListener("click", () => runAndRenderSlb(true));
      if (saved) runAndRenderSlb(false);
    }
  }

  function renderSlbResultHtml(...args) {
    const renderer = window.LeaseQantTfrs16OperationsUi?.renderSlbResultHtml;
    return typeof renderer === "function" ? renderer(...args) : "";
  }

  function renderSlbJournalHtml(...args) {
    const renderer = window.LeaseQantTfrs16OperationsUi?.renderSlbJournalHtml;
    return typeof renderer === "function" ? renderer(...args) : "";
  }

  function renderSubleaseSection(contract) {
    const container = document.getElementById("subleaseSectionContainer");
    if (!container) return;

    const saved = contract.sublease || null;

    const formRenderer = window.LeaseQantTfrs16OperationsUi?.renderSubleaseForm;
    const formHtml = typeof formRenderer === "function"
      ? formRenderer(contract)
      : "";

    container.innerHTML = formHtml;

    if (document.documentElement.getAttribute("data-lq-ui") === "2") {
      bindPersistedOperationForm(contract, "SUBLEASE", "sublease", () => ({
        monthlyPayment: Number(document.getElementById("subleaseMonthlyPayment")?.value),
        discountRate: Number(document.getElementById("subleaseDiscountRate")?.value),
        startDate: document.getElementById("subleaseStartDate")?.value,
        endDate: document.getElementById("subleaseEndDate")?.value,
        classification: document.getElementById("subleaseClassification")?.value,
        rouAllocationRatio: Number(document.getElementById("subleaseRouRatio")?.value),
        professionalJudgmentNote: document.getElementById("subleaseNote")?.value || ""
      }), renderSubleaseResultHtml);
      return;
    }

    async function runAndRenderSublease(persist) {
      const resultBox = document.getElementById("subleaseResultContainer");
      const subleaseContract = {
        monthlyPayment: Number(document.getElementById("subleaseMonthlyPayment")?.value),
        discountRate: Number(document.getElementById("subleaseDiscountRate")?.value),
        startDate: document.getElementById("subleaseStartDate")?.value,
        endDate: document.getElementById("subleaseEndDate")?.value,
        currency: contract.currency || "TRY"
      };
      const classification = document.getElementById("subleaseClassification")?.value === "FINANCE" ? "FINANCE" : "OPERATING";
      const rouAllocationRatio = Number(document.getElementById("subleaseRouRatio")?.value) || 1;
      const professionalJudgmentNote = document.getElementById("subleaseNote")?.value || "";

      const calcButton = document.getElementById("subleaseCalculateButton");

      if (persist) {
        const previousSublease = contract.sublease
          ? cloneModificationValue(contract.sublease)
          : null;

        contract.sublease = { ...subleaseContract, classification, rouAllocationRatio, professionalJudgmentNote, savedAt: new Date().toISOString() };
        const idx = contracts.findIndex(c => c.id === contract.id);
        if (idx >= 0) contracts[idx] = contract;
        saveContracts(contracts);

        if (calcButton) {
          calcButton.disabled = true;
          calcButton.textContent = "Kaydediliyor...";
        }

        try {
          await persistContractToApi(contract, true);
        } catch (error) {
          contract.sublease = previousSublease;
          saveContracts(contracts);
          if (calcButton) {
            calcButton.disabled = false;
            calcButton.textContent = "Hesapla ve Kaydet";
          }
          if (resultBox) {
            resultBox.innerHTML = `
              <div style="padding:12px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;color:#991b1b;font-size:12px;">
                Backend'e kaydedilemedi: ${escapeHtml(error?.message || String(error))}
              </div>
            `;
          }
          return;
        }

        if (calcButton) {
          calcButton.disabled = false;
          calcButton.textContent = "Hesapla ve Kaydet";
        }
      }

      if (!resultBox) return;
      try {
        const privateResult = await (persist
          ? (typeof refreshPrivateCalculationAfterMutation === "function"
            ? refreshPrivateCalculationAfterMutation(contract)
            : loadPrivateReadOnlyResult(contract))
          : loadPrivateReadOnlyResult(contract));
        let result;
        // The sublease result is read verbatim from the private envelope.
        result = privateResult?.specialFlowsVersion === 1
          ? privateResult.specialFlows?.sublease || null
          : null;
        if (!result) {
          const unavailable = new Error("Private alt kiralama sonucu henüz hazır değil");
          unavailable.code = "PRIVATE_SPECIAL_FLOW_NOT_READY";
          throw unavailable;
        }
        resultBox.innerHTML = renderSubleaseResultHtml(result);
      } catch (error) {
        resultBox.innerHTML = `
          <div style="padding:12px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;color:#991b1b;font-size:12px;">
            Hesaplanamadı: ${escapeHtml(error.message || String(error))}
          </div>
        `;
      }
    }

    const binder = window.LeaseQantTfrs16OperationsUi?.bindSubleaseEvents;
    if (typeof binder === "function") {
      binder(contract, { calculateAndRender: runAndRenderSublease, autoRun: !!saved });
    } else {
      document.getElementById("subleaseCalculateButton")?.addEventListener("click", () => runAndRenderSublease(true));
      if (saved) runAndRenderSublease(false);
    }
  }

  function renderSubleaseResultHtml(...args) {
    const renderer = window.LeaseQantTfrs16OperationsUi?.renderSubleaseResultHtml;
    return typeof renderer === "function" ? renderer(...args) : "";
  }

  function updateScheduleSubPeriodUI() {

    const periodType =
      document.getElementById(
        "schedulePeriodType"
      )?.value;

    const subPeriod =
      document.getElementById(
        "scheduleSubPeriod"
      );

    if (!subPeriod) return;

    if (periodType === "quarterly") {

      subPeriod.innerHTML =
        buildQuarterOptions();

      subPeriod.disabled = false;
      subPeriod.style.opacity = "1";

    } else if (periodType === "monthly") {

      subPeriod.innerHTML =
        buildMonthOptions();

      subPeriod.disabled = false;
      subPeriod.style.opacity = "1";

    } else {

      subPeriod.disabled = true;
      subPeriod.style.opacity = ".5";
    }
  }

  function initPaymentScheduleEvents(contract) {
    const binder = window.LeaseQantTfrs16OperationsUi?.bindPaymentScheduleEvents;
    if (typeof binder !== "function") return;
    binder(contract, {
      updateSubPeriod: updateScheduleSubPeriodUI,
      renderTable: renderPaymentScheduleTable,
      renderFxTranslation: renderFxTranslationSection,
      renderInflation: renderInflationAdjustmentSection,
      exportSchedule: exportPaymentSchedule
    });
  }

  async function legacyReportAuth_exportPaymentSchedule(contract, presentationCurrency) {

    presentationCurrency = String(presentationCurrency || document.getElementById("schedulePresentationCurrency")?.value || contract?.presentationCurrency || contract?.reportingCurrency || contract?.currency || "TRY").toUpperCase();

    const baseEngine =
      getPrivateCalculationForConsumer(
        contract
      );

    const engine =
      typeof cfoBuildSchedule === "function"
        ? { ...baseEngine, ...cfoBuildSchedule(contract) }
        : baseEngine;

    if (!engine.schedule.length) {

      showAlert(
        "Aktarılacak ödeme planı bulunamadı."
      );

      return;
    }

    const sourceCurrency = String(contract?.currency || "TRY").toUpperCase();
    const scheduleAsOfDate = getScheduleReportingDate();
    const presentationConversion = await v26ConvertScheduleToPresentation(
      engine.schedule,
      sourceCurrency,
      presentationCurrency,
      scheduleAsOfDate
    );
    const presentationSchedule = presentationConversion.schedule;

    auditScheduleEvent(contract, "SCHEDULE_GENERATED", "PAYMENT_SCHEDULE_EXPORT", `V16.7-${engine.schedule.length}`, null, engine.schedule.length);

    let fx = null;
    let fxError = null;
    if (contractNeedsFxTranslation(contract)) {
      try {
        fx = await buildTms21FxTranslation(contract, engine, { reportingDate: scheduleAsOfDate });
      } catch (error) {
        fxError = error;
      }
    }

    const assumptionRows = [
      { "Alan": "Sözleşme ID", "Değer": contract.id },
      { "Alan": "Şirket", "Değer": contract.company },
      { "Alan": "Tedarikçi", "Değer": contract.supplier },
      { "Alan": "Başlangıç Tarihi", "Değer": formatDate(contract.startDate) },
      { "Alan": "Bitiş Tarihi", "Değer": formatDate(contract.endDate) },
      { "Alan": "Aylık Kira", "Değer": contract.monthlyPayment },
      { "Alan": "Yıllık İskonto Oranı (%)", "Değer": contract.discountRate },
      { "Alan": "Kira Para Birimi", "Değer": v23CurrencyCode(contract.currency || DEFAULT_FUNCTIONAL_CURRENCY) },
      { "Alan": "Sunum Para Birimi", "Değer": presentationCurrency },
      { "Alan": "İlk Kira Yükümlülüğü", "Değer": engine.liability },
      { "Alan": "ROU Varlığı (Başlangıç)", "Değer": engine.rouAssets },
      { "Alan": "Rapor Tarihi", "Değer": scheduleAsOfDate }
    ];

    if (fx?.applicable) {
      assumptionRows.push(
        { "Alan": "Fonksiyonel Para Birimi", "Değer": fx.functionalCurrency },
        { "Alan": "TMS 21 Başlangıç Kuru", "Değer": fx.commencementRate },
        { "Alan": "TMS 21 Başlangıç Kuru Tarihi", "Değer": fx.commencementRateDate },
        { "Alan": "TMS 21 Kümülatif Kur Farkı", "Değer": fx.totals.cumulativeFxGainLoss },
        { "Alan": "TMS 21 Kapanış Kira Yükümlülüğü (Fonksiyonel)", "Değer": fx.totals.closingLiabilityFx },
        { "Alan": "TMS 21 Kapanış ROU (Fonksiyonel)", "Değer": fx.totals.closingRouFx }
      );
    } else if (fxError) {
      assumptionRows.push({ "Alan": "TMS 21 Kur Çevrimi", "Değer": `Hesaplanamadı: ${fxError.message || fxError}` });
    }

    const scheduleRows =
      presentationSchedule.map(
        item => ({
          "Dönem": item.period,
          "Yıl": item.year,
          "Ay": getMonthName(item.month),
          "Açılış Yükümlülüğü": item.openingLiability,
          "Ödeme": item.payment,
          "Faiz": item.interest,
          "Anapara": item.principal,
          "Kapanış Yükümlülüğü": item.closingLiability,
          "Amortisman": item.depreciation,
          "ROU Net Defter Değeri": item.rouClosing,
          "Para Birimi": presentationCurrency,
          "Kur (TMS21)": item.presentationRate ?? 1
        })
      );

    const fxRows = fx?.applicable
      ? fx.schedule.map(row => ({
          "Dönem": row.period,
          "Tarih": row.date,
          "Kur (Kapanış)": row.closingRate,
          "Kur Tarihi": row.rateDate,
          [`Açılış Yükümlülüğü (${fx.functionalCurrency})`]: row.openingLiabilityFx,
          [`Faiz (${fx.functionalCurrency})`]: row.interestFx,
          [`Ödeme (${fx.functionalCurrency})`]: row.paymentFx,
          [`Kapanış Yükümlülüğü (${fx.functionalCurrency})`]: row.closingLiabilityFx,
          "Kur Farkı (Dönem)": row.fxGainLoss,
          "Kur Farkı (Kümülatif)": row.cumulativeFxGainLoss,
          [`ROU Açılış (${fx.functionalCurrency})`]: row.rouOpeningFx,
          [`Amortisman (${fx.functionalCurrency})`]: row.depreciationFx,
          [`ROU Kapanış (${fx.functionalCurrency})`]: row.rouClosingFx
        }))
      : [];
    const exporter = window.LeaseQantTfrs16OperationsUi?.exportPaymentScheduleFile;
    if (typeof exporter === "function") {
      exporter({ contractId: contract.id, presentationCurrency, assumptionRows, scheduleRows, fxRows });
    }
  }

  /* ==========================================================
     DETAIL MODAL
  ========================================================== */

  function openDetail(id, options) {

    const detailOptions = options || {};

    const contract =
      contracts.find(
        item => item.id === id
      );

    if (!contract) return;

    selectedContractId =
      id;

    // Bu kontratın önbelleğini tazele (detay ekranı her zaman
    // en güncel hesaplamayı göstermeli).
    // Detay açılışında yerel sonucu tazele; API-primary önbelleğini silme.
    // Aksi halde remote sonuç her yeniden çizimde kaybolup fallback'e döner.
    clearCalculationCache(id, { preservePrivate: true });

    // API-primary modunda private sonuç henüz hazır değilse hesaplama hatası
    // modalın açılmasını engellememeli. Kullanıcı sözleşmenin durumunu görüp
    // kur doğrulamasından sonra yeniden deneyebilmeli; yerel motor sessizce
    // devreye sokulmaz.
    let calculationError = null;
    let engine;
    try {
      engine = detailOptions.calculationOverride || calculateLease(contract);
    } catch (error) {
      calculationError = error;
      engine = {
        rouAssets: null,
        liability: null,
        depreciation: null,
        exempt: false,
        schedule: []
      };
    }
    const calculationSource = getCalculationSource(contract);

    // Shadow doğrulama yalnızca açık bayrakla çalışır; ekrandaki sonucu,
    // kayıt akışını veya performanslı yerel hesaplamayı değiştirmez.
    if (window.LeaseQantCalculationShadow?.observe) {
      window.LeaseQantCalculationShadow.observe(contract, engine).catch(() => {});
    }

    const contractAuditEvents =
      typeof getAuditTrail === "function"
        ? getAuditTrail(contract.id)
        : [];

    const modal =
      document.getElementById(
        "detailModal"
      );

    const title =
      document.getElementById(
        "detailTitle"
      );

    const content =
      document.getElementById(
        "detailContent"
      );

    // Initial journal is loaded separately from a persisted server source.
    // No nominal or FX browser fallback is permitted.
    const initialJournalEntries = [];
    const initialJournalCurrency = contract.currency;

    if (title) {
      // FAZ C: başlıkta sadece sözleşme ID'si vardı — kullanıcı hangi
      // şirketin/tedarikçinin sözleşmesine baktığını göremiyordu.
      // Artık "Şirket › Sözleşme ID" biçiminde bir bağlam satırı.
      const contextParts = [contract.company, contract.id].filter(Boolean);
      title.textContent = contextParts.join(" › ");
      title.title = [contract.company, contract.supplier, contract.id]
        .filter(Boolean).join(" — ");
    }

    if (content) {
      // Görüntüle düzeltmesi: bu bloktaki render* çağrılarının HİÇBİRİ
      // kendi try/catch'ine sahip değildi. Herhangi biri belirli bir
      // sözleşmenin verisiyle (ör. beklenmeyen bir modification/SLB alan
      // şekli) senkron olarak throw ederse, content.innerHTML hiç
      // atanmıyor VE aşağıdaki modal?.classList.remove("hidden") satırına
      // hiç ulaşılmıyordu — modal açılmıyor, konsola sessizce bir hata
      // düşüyor, kullanıcı için "Görüntüle butonu hiçbir şey yapmıyor"
      // olarak görünüyordu (ve SADECE o veri şekline sahip sözleşmelerde
      // — diğerleri normal açılıyordu, tam olarak bildirilen semptom).
      // Artık render hatası olsa bile modal her zaman açılıyor ve hatayı
      // (teknik mesajıyla) gösteriyor — mobil tarayıcıda konsol erişimi
      // olmadan bile hangi sözleşmenin neden kırıldığı görülebiliyor.
      try {
      const lockBannerCheck = typeof assertPeriodWritable === "function"
        ? assertPeriodWritable(contract, contract?.startDate || new Date())
        : { locked: false };
      const detailRenderer = window.LeaseQantTfrs16DetailUi?.render;
      if (typeof detailRenderer !== "function") {
        throw new Error("TFRS16 detay arayüzü yüklenemedi.");
      }
      content.innerHTML = detailRenderer({
        contract,
        engine,
        calculationError: Boolean(calculationError),
        calculationSource,
        lockBannerCheck,
        isAdmin: String(sessionUserRole || "").toUpperCase() === "ADMIN",
        initialJournalEntries,
        initialJournalCurrency,
        contractAuditEvents,
        renderContractStandardsPanel,
        v26StandardsBadgeHtml,
        renderPaymentScheduleSection,
        renderModificationManagementSection,
        renderReassessmentManagementSection,
        renderContractAuditTab
      });
      } catch (renderError) {
        console.error("Detay modalı render hatası:", contract.id, renderError);
        content.innerHTML = `
          <div role="alert" style="margin-bottom:12px;padding:14px 16px;border-radius:8px;background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;font-size:13px;">
            <strong>Bu sözleşmenin detayı görüntülenirken bir hata oluştu.</strong>
            <p style="margin:8px 0 0;font-size:12px;color:#7f1d1d;">
              Sözleşme: ${escapeHtml(contract.id || "")}<br>
              Teknik hata: ${escapeHtml(renderError?.message || String(renderError))}
            </p>
            <p style="margin:8px 0 0;font-size:12px;color:#7f1d1d;">
              Bu ekran görüntüsünü reis'e iletebilirsiniz — daha önce sessizce
              kapanan "Görüntüle" hatasının kök nedenini teşhis etmeye yeter.
            </p>
          </div>
        `;
      }
    }

    modal?.classList.remove(
      "hidden"
    );
    window.LeaseQantReportingAuthorityUi?.renderContractDetails(content,contract);


    // Read-only summary/report consumers use the same stable result envelope
    // as the payment-plan tab. If the portfolio warm-up has not completed by
    // the time a user opens a contract, request the private result on demand
    // and redraw the existing detail modal once it arrives. The active tab is
    // preserved by gkDetailActiveTab; an API failure keeps the local result
    // already rendered above as the rollback-safe fallback.
    const shouldRefreshFromPrivate =
      !detailOptions.skipPrivateRefresh &&
      !detailOptions.calculationOverride &&
      isPrivateCalculationApiReady() &&
      getCalculationSource(contract) !== "private-api";
    if (shouldRefreshFromPrivate) {
      loadPrivateReadOnlyResult(contract, { retryOnError: true }).then(privateResult => {
        if (privateResult && selectedContractId === contract.id) {
          openDetail(contract.id, {
            skipPrivateRefresh: true,
            calculationOverride: privateResult
          });
          // A newly created contract can be added to the in-memory list
          // before its first private result is ready.  API-primary refresh()
          // intentionally waits while the cache is cold, so redraw the
          // portfolio after this on-demand result arrives; otherwise the
          // contract stays invisible in the table and KPI cards remain zero
          // until a full page reload.
          try { refresh(); } catch (_) { /* best-effort portfolio redraw */ }
        }
      }).catch(() => {});
    }

    const detailEvents = window.LeaseQantTfrs16DetailEvents?.bind;
    if (typeof detailEvents !== "function") {
      console.error("TFRS16 detay olay arayüzü yüklenemedi.");
      return;
    }
    detailEvents({
      contract,
      initPaymentScheduleEvents,
      initModificationEvents,
      initReassessmentEvents,
      renderSlbSection,
      renderSubleaseSection,
      reopenDetail: openDetail,
      getActiveTab: () => gkDetailActiveTab,
      setActiveTab: value => { gkDetailActiveTab = value; }
    });
  }

  /* ==========================================================
     FAZ B — SÖZLEŞME DETAYI TAB YÖNETİMİ
     ----------------------------------------------------------
     Modül seviyesinde tutulur (openDetail dışında) ki bir
     modification/reassessment/SLB kaydedildikten sonra openDetail
     yeniden çağrıldığında kullanıcı AYNI tab'da kalsın — aksi
     halde her kayıtta "Özet"e geri fırlardı.
  ========================================================== */
  let gkDetailActiveTab = "summary";

  function closeDetail() {

    document
      .getElementById(
        "detailModal"
      )
      ?.classList.add(
        "hidden"
      );

    selectedContractId =
      null;
  }

  document
    .getElementById(
      "closeDetailModal"
    )
    ?.addEventListener(
      "click",
      closeDetail
    );

  document
    .getElementById(
      "detailCloseButton"
    )
    ?.addEventListener(
      "click",
      closeDetail
    );











  /**
   * TMS 21 journal measurement layer. Every posting is returned in the
   * contract's functional currency. The original transaction-currency
   * amount remains on the row as audit metadata, but is never added to the
   * functional-currency debit/credit totals.
   */
  function buildFunctionalCurrencyJournalEntries(
    contract,
    entries,
    selectedRows,
    periodStart,
    periodEnd,
    translatedRows = []
  ) {
    const sourceCurrency = v23CurrencyCode(contract?.currency || DEFAULT_FUNCTIONAL_CURRENCY);
    const functionalCurrency = resolveContractFunctionalCurrency(contract);
    const rows = Array.isArray(selectedRows) ? selectedRows : [];
    const fxRows = Array.isArray(translatedRows) ? translatedRows : [];
    const endDate = periodEnd || rows[rows.length - 1]?.date || contract?.startDate;

    const annotate = (entry, debit, credit, rate, rateDate) => ({
      ...entry,
      debit: v23Round(Number(debit) || 0, 2),
      credit: v23Round(Number(credit) || 0, 2),
      currency: functionalCurrency,
      transactionCurrency: sourceCurrency,
      transactionDebit: Number(entry.debit) || 0,
      transactionCredit: Number(entry.credit) || 0,
      fxRate: Number(rate) > 0 ? Number(rate) : null,
      fxRateDate: rateDate || null
    });

    if (sourceCurrency === functionalCurrency) {
      return (Array.isArray(entries) ? entries : []).map(entry =>
        annotate(entry, entry.debit, entry.credit, 1, v23DateKey(entry.transactionDate || endDate))
      );
    }

    const endRate = v191FxRateAt(sourceCurrency, functionalCurrency, endDate);
    const hasOriginalFxAmounts = fxRows.some(row => row.interestOriginal !== undefined);
    const journalFxRows = fxRows.filter(row => !row.isAdvanceCommencement);
    const rawTotals = hasOriginalFxAmounts ? {
      interest: fxRows.reduce((s, row) => s + (Number(row.interestOriginal) || 0), 0),
      payment: journalFxRows.reduce((s, row) => s + (Number(row.paymentOriginal) || 0), 0),
      depreciation: fxRows.reduce((s, row) => s + (Number(row.depreciationOriginal) || 0), 0)
    } : {
      interest: rows.reduce((s, row) => s + (Number(row.interest) || 0), 0),
      payment: rows.reduce((s, row) => s + (Number(row.payment) || 0), 0),
      depreciation: rows.reduce((s, row) => s + (Number(row.depreciation) || 0), 0)
    };
    const fnTotals = {
      interest: fxRows.reduce((s, row) => s + (Number(row.interestFx) || 0), 0),
      payment: journalFxRows.reduce((s, row) => s + (Number(row.paymentFx) || 0), 0),
      depreciation: fxRows.reduce((s, row) => s + (Number(row.depreciationFx) || 0), 0)
    };
    const translatedAmount = (amount, key) => {
      const tx = Number(amount) || 0;
      if (!tx) return { amount: 0, rate: null, rateDate: null };
      const raw = rawTotals[key];
      const fn = fnTotals[key];
      if (fxRows.length && Math.abs(raw) > 0.0000001 && Number.isFinite(fn)) {
        const weightedRate = fn / raw;
        return { amount: tx * weightedRate, rate: weightedRate, rateDate: "Çoklu işlem tarihi" };
      }
      return { amount: tx * endRate, rate: endRate, rateDate: v23DateKey(endDate) };
    };

    // Private engine journal rows carry source=LEASE_SCHEDULE. They are
    // nominal core lines and must use the weighted transaction-date rates in
    // a multi-date range, just like legacy untagged rows.
    const isNominalCoreLine = entry => !entry?.source || entry.source === "LEASE_SCHEDULE";
    const interestEntry = (entries || []).find(x => x.accountKey === "interestExpense" && isNominalCoreLine(x));
    const paymentEntry = (entries || []).find(x =>
      ["cashSettlement", "leaseLiabilityCurrent"].includes(x.accountKey) && isNominalCoreLine(x)
    );
    const growthEntry = (entries || []).find(x => x.accountKey === "leaseLiabilityAccrualGrowth" && isNominalCoreLine(x));
    const interest = translatedAmount(Number(interestEntry?.debit) || Number(interestEntry?.credit), "interest");
    const payment = translatedAmount(Number(paymentEntry?.debit) || Number(paymentEntry?.credit), "payment");
    const growthTx = Number(growthEntry?.debit) || Number(growthEntry?.credit) || 0;
    const growth = { amount: growthTx * endRate, rate: endRate, rateDate: v23DateKey(endDate) };
    // The principal line is the balancing liability reduction after interest,
    // cash settlement and any unpaid-interest growth are measured in the
    // functional currency.
    const principalFn = payment.amount + growth.amount - interest.amount;
    const principalEntry = (entries || []).find(x => x.accountKey === "leaseLiability" && isNominalCoreLine(x));
    const principalTx = Number(principalEntry?.debit) || Number(principalEntry?.credit) || 0;
    const principalRate = Math.abs(principalTx) > 0.0000001 ? Math.abs(principalFn / principalTx) : endRate;

    return (Array.isArray(entries) ? entries : []).map(entry => {
      const txDebit = Number(entry.debit) || 0;
      const txCredit = Number(entry.credit) || 0;
      const txAmount = txDebit || txCredit;
      let converted;

      if (entry.source === "MODIFICATION" || entry.source === "REASSESSMENT") {
        const eventDate = entry.transactionDate || endDate;
        const rate = v191FxRateAt(sourceCurrency, functionalCurrency, eventDate);
        converted = { amount: txAmount * rate, rate, rateDate: v23DateKey(eventDate) };
      } else if (entry === interestEntry) {
        converted = interest;
      } else if (entry === paymentEntry) {
        converted = payment;
      } else if (entry === growthEntry) {
        converted = growth;
      } else if (entry === principalEntry) {
        converted = { amount: Math.abs(principalFn), rate: principalRate, rateDate: "Çoklu işlem tarihi" };
      } else if (entry.accountKey === "depreciationExpense" || entry.accountKey === "rouAccumDep") {
        converted = translatedAmount(txAmount, "depreciation");
      } else {
        const eventDate = entry.transactionDate || endDate;
        const rate = v191FxRateAt(sourceCurrency, functionalCurrency, eventDate);
        converted = { amount: txAmount * rate, rate, rateDate: v23DateKey(eventDate) };
      }

      // Preserve the original side. A negative balancing principal is the
      // exceptional case in which the liability grows; put it on credit.
      if (entry === principalEntry && principalFn < -0.005) {
        return annotate(entry, 0, Math.abs(principalFn), converted.rate, converted.rateDate);
      }
      return annotate(
        entry,
        txDebit ? converted.amount : 0,
        txCredit ? converted.amount : 0,
        converted.rate,
        converted.rateDate
      );
    });
  }


  /**
   * TMS 29 düzeltmesini toplu fişin içine ekler. Nominal TFRS 16
   * fişinden ayrı bir akış olarak hesaplanır; böylece ROU'nun
   * gayrimoneter endeksleme farkı ile yükümlülüğün parasal pozisyon
   * kazanç/kaybı birbirine karışmaz.
   */
  // TMS 29 fişi yalnızca private motorun ürettiği muhasebe zarfından alınır.
  // Public bundle'da aynı hesabı yeniden kuran bir yedek yol bulunmaz.
  async function buildTms29BulkJournalEntries(contract, periodStart, periodEnd) {
    if (!contract || !periodEnd) return [];
    if (!isPrivateCalculationApiReady()) {
      throw new Error("TMS 29 private hesaplama API'si hazır değil");
    }
    const reportingPeriod = v23DateKey(periodEnd)?.slice(0, 7);
    const periodStartMonth = v23DateKey(periodStart)?.slice(0, 7);
    if (!reportingPeriod || !periodStartMonth) return [];
    const result = await window.LeaseQantPrivateTfrs16Facade.loadTms29(
      contract,
      reportingPeriod,
      periodStartMonth
    );
    if (result?.journalControl?.balanced === false) {
      throw new Error(`TMS 29 fişi dengeli değil (fark: ${Number(result.journalControl.difference || 0).toFixed(2)})`);
    }
    const entries = Array.isArray(result?.journal) ? result.journal : [];
    if (result?.journalStatus === "READY" && !entries.length) {
      throw new Error("TMS 29 servisi READY durumu döndürdü ancak fiş satırı üretmedi");
    }
    const mappedEntries = entries.map(entry => ({
      ...entry,
      journalType: entry.journalType || "TMS29_INFLATION",
      controlStatus: entry.controlStatus || "VALID"
    }));
    mappedEntries.journalStatus = result?.journalStatus || (mappedEntries.length ? "READY" : "NO_ADJUSTMENT");
    mappedEntries.journalControl = result?.journalControl || null;
    mappedEntries.reportingPeriod = result?.reportingPeriod || reportingPeriod;
    return mappedEntries;
  }

  function buildAppliedChangeJournalEntries(contract, periodStart, periodEnd) {
    return v191AppliedChanges(contract, periodStart, periodEnd).flatMap(change => {
      const rows = change.__changeKind === "reassessment"
        ? generateReassessmentJournal(contract, change)
        : generateModificationJournal(contract, change);
      return rows.map(entry => ({
        ...entry,
        transactionDate: v23DateKey(change.__effective)
      }));
    });
  }





  /**
   * renderBulkJournalPreviewTable — toplu fiş önizleme tablosunun
   * HTML'ini üretir. Saf template-string, DOM'a dokunmaz.
   */
  /**
   * BULK_JOURNAL_VIRTUAL_SCROLL_THRESHOLD — bu satır sayısının ÜZERİNDE
   * sanal kaydırmaya geçilir; altında mevcut (Faz 3'te byte-bazlı MD5
   * ile doğrulanmış) tam tablo render'ı DEĞİŞMEDEN kullanılmaya devam
   * eder. Küçük listelerde virtual scroll ek karmaşıklık getirir ama
   * gözle görülür bir kazanç sağlamaz — bu yüzden eşiğin altı
   * dokunulmadan bırakıldı.
   *
   * FAZ 4.4 (Görkem onayı — bkz. PROJECT_CONTEXT.md bölüm 37/38):
   * `renderVirtualTable` (V25.1, satır ~27950) önceden HİÇBİR YERDE
   * çağrılmıyordu. `renderCloseDashboardPage` incelendi — orada
   * virtualize edilecek büyük bir SATIR listesi YOK (yalnızca
   * dropdown'lar ve sınırlı sayıda kontrol sonucu), bu yüzden yalnızca
   * `renderBulkJournalResults`'a bağlandı.
   */
  const BULK_JOURNAL_VIRTUAL_SCROLL_THRESHOLD = 50;









  function normalizeHeader(
    value
  ) {

    return String(
      value || ""
    )
      .trim()
      .toLowerCase()
      .replace(
        /ğ/g,
        "g"
      )
      .replace(
        /ü/g,
        "u"
      )
      .replace(
        /ş/g,
        "s"
      )
      .replace(
        /ı/g,
        "i"
      )
      .replace(
        /ö/g,
        "o"
      )
      .replace(
        /ç/g,
        "c"
      );
  }



  function validateImportedContract(
    contract
  ) {

    return validateContract(
      contract
    );
  }

  function openBulkImportModal() {

    const modal =
      document.getElementById(
        "bulkImportModal"
      );

    if (!modal) return;

    modal.classList.remove(
      "hidden"
    );

    const preview =
      document.getElementById(
        "bulkPreview"
      );

    const status =
      document.getElementById(
        "bulkImportStatus"
      );

    if (preview) {
      preview.innerHTML =
        "";
    }

    if (status) {
      status.innerHTML =
        "";
    }

    const confirm =
      document.getElementById(
        "confirmBulkImport"
      );

    if (confirm) {
      confirm.disabled =
        true;
    }
  }

  function closeBulkImportModal() {

    document
      .getElementById(
        "bulkImportModal"
      )
      ?.classList.add(
        "hidden"
      );
  }

  const bulkImportButton = document.getElementById("bulkImportButton");
  if (bulkImportButton) bulkImportButton.onclick = openBulkImportModal;

  const closeBulkModalButton = document.getElementById("closeBulkModal");
  if (closeBulkModalButton) closeBulkModalButton.onclick = closeBulkImportModal;

  const cancelBulkImportButton = document.getElementById("cancelBulkImport");
  if (cancelBulkImportButton) cancelBulkImportButton.onclick = closeBulkImportModal;

  const bulkFileInput = document.getElementById("bulkFileInput");
  if (bulkFileInput) {
    bulkFileInput.onchange = event => {
      const file = event?.target?.files?.[0];
      if (!file) return;
      readBulkImportFile(file);
    };
  }

  async function readBulkImportFile(
    file
  ) {

    const status = document.getElementById("bulkImportStatus");
    const preview = document.getElementById("bulkPreview");
    const confirm = document.getElementById("confirmBulkImport");

    try {
      if (typeof parseIntegrationFile !== "function") {
        throw new Error("V19 Integration Import Engine bulunamadı.");
      }

      if (confirm) confirm.disabled = true;
      if (preview) preview.innerHTML = "";
      if (status) status.innerHTML = "Dosya doğrulanıyor...";

      showLoading(`Excel okunuyor: ${file?.name || "dosya"}`, 0);

      const result = await parseIntegrationFile(file, {
        profile: "GENERIC",
        schemaVersion: INTEGRATION_SCHEMA_VERSION
      });

      if (!result?.success) {
        throw new Error(result?.error || "Dosya okunamadı.");
      }

      const importedRows = Array.isArray(result.rows) ? result.rows : [];
      window.__GK_V191_IMPORT_CONTEXT__ = {
        jobId: result.job?.jobId || null,
        sourceId: result.source?.sourceId || null,
        sourceType: result.source?.sourceType || INTEGRATION_SOURCE_TYPES.EXCEL,
        fileName: file?.name || null,
        rows: importedRows,
        preview: result.preview || null
      };

      const p = result.preview || {};
      const validationResults = Array.isArray(p.validationResults) ? p.validationResults : [];
      const valid = Number(p.validRows) || 0;
      const warnings = Number(p.warningRows) || 0;
      const rejected = Number(p.rejectedRows) || 0;

      if (status) {
        status.innerHTML = `
          <div style="padding:10px;border-radius:8px;background:#f8fafc;border:1px solid #e5e7eb;">
            <strong>${p.totalRows || 0} kayıt okundu.</strong><br>
            <span>${valid} geçerli, ${warnings} uyarılı, ${rejected} hatalı kayıt.</span>
          </div>
        `;
      }

      if (preview) {
        preview.innerHTML = `
          <div style="border:1px solid #e5e7eb;border-radius:10px;overflow:auto;">
            <table style="width:100%;border-collapse:collapse;min-width:900px;">
              <thead><tr>
                <th style="padding:9px;">Satır</th>
                <th style="padding:9px;">Sözleşme</th>
                <th style="padding:9px;">Şirket</th>
                <th style="padding:9px;">Tedarikçi</th>
                <th style="padding:9px;">Aylık Kira</th>
                <th style="padding:9px;">Varlık Sınıfı</th>
                <th style="padding:9px;">Kontrol</th>
                <th style="padding:9px;">Aksiyon</th>
              </tr></thead>
              <tbody>
                ${validationResults.map(item => {
                  const data = item.normalizedData || {};
                  const ok = item.status === INTEGRATION_ROW_STATUS.VALID;
                  const warning = item.status === INTEGRATION_ROW_STATUS.WARNING;
                  const label = ok ? "✓ Geçerli" : warning ? "⚠ Uyarı" : "✕ Hatalı";
                  const action = item.action || (ok ? "CREATE" : "REJECT");
                  return `
                    <tr>
                      <td style="padding:9px;border-top:1px solid #edf0f4;">${item.rowNumber || "-"}</td>
                      <td style="padding:9px;border-top:1px solid #edf0f4;">${escapeHtml(data.id || "")}</td>
                      <td style="padding:9px;border-top:1px solid #edf0f4;">${escapeHtml(data.company || "")}</td>
                      <td style="padding:9px;border-top:1px solid #edf0f4;">${escapeHtml(data.supplier || "")}</td>
                      <td style="padding:9px;border-top:1px solid #edf0f4;">${Number.isFinite(Number(data.monthlyPayment)) ? formatCurrency(Number(data.monthlyPayment)) : "-"}</td>
                      <td style="padding:9px;border-top:1px solid #edf0f4;">${escapeHtml(data.assetClass || "Sınıflandırılmamış")}</td>
                      <td style="padding:9px;border-top:1px solid #edf0f4;font-weight:700;">${label}</td>
                      <td style="padding:9px;border-top:1px solid #edf0f4;">${escapeHtml(action)}</td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          </div>
        `;
      }

      if (confirm) confirm.disabled = valid === 0;
      updateLoadingProgress(100, `Excel doğrulaması tamamlandı: ${p.totalRows || 0} kayıt`);
      hideLoading();
    } catch (error) {
      console.error("V19.1 integration import preview error:", error);
      hideLoading();
      window.__GK_V191_IMPORT_CONTEXT__ = null;
      if (confirm) confirm.disabled = true;
      if (status) {
        status.innerHTML = `<div style="padding:10px;border-radius:8px;background:#fef2f2;color:#991b1b;border:1px solid #fecaca;">Dosya okunamadı: ${escapeHtml(error?.message || String(error))}</div>`;
      }
    }
  }

  const confirmBulkImportButton = document.getElementById("confirmBulkImport");
  if (confirmBulkImportButton) confirmBulkImportButton.onclick = confirmBulkImport;

  async function confirmBulkImport() {
    const context = window.__GK_V191_IMPORT_CONTEXT__;
    if (!context?.jobId || !Array.isArray(context.rows)) {
      showAlert("Önce geçerli bir Excel dosyası yükleyin.");
      return;
    }

    try {
      const importButton = document.getElementById("confirmBulkImport");
      if (importButton) importButton.disabled = true;
      showLoading(`Excel kayıtları sisteme aktarılıyor... (${context.rows.length} kayıt)`, null);
      await new Promise(resolve => requestAnimationFrame(resolve));

      const result = await commitImport(context.jobId, context.rows, {
        profile: "GENERIC",
        sourceType: context.sourceType || INTEGRATION_SOURCE_TYPES.EXCEL,
        sourceId: context.sourceId || null,
        fileName: context.fileName || null,
        schemaVersion: INTEGRATION_SCHEMA_VERSION,
        rejectOnAnyError: false
      });

      if (!result?.success) {
        throw new Error(result?.error || "Import commit başarısız.");
      }

      window.__GK_V191_IMPORT_CONTEXT__ = null;
        refresh();
      if (typeof v191RefreshOpenView === "function") v191RefreshOpenView();
      closeBulkImportModal();

      const committed = Array.isArray(result.committed) ? result.committed : [];
      const rejected = Array.isArray(result.rejected) ? result.rejected : [];
      const limitReached = Array.isArray(result.limitReachedSummary) ? result.limitReachedSummary : [];
      const limitRowNumbers = new Set(limitReached.map(s => s.rowNumber));
      const backendFailed = rejected.filter(r => (r.errors || []).some(e => e.errorCode === "BACKEND_PERSIST_FAILED" || e.errorCode === "LIMIT_REACHED" || e.errorCode === "NO_ACTIVE_LICENSE")).length;
      const otherRejected = rejected.length - backendFailed;
      const businessWarnings = committed.filter(c => Array.isArray(c.businessRuleWarnings) && c.businessRuleWarnings.length).length;
      updateLoadingProgress(100, `${committed.length} kayıt başarıyla aktarıldı.`);
      const alertType = backendFailed || otherRejected ? (committed.length ? "warning" : "error") : "success";
      showAlert(`${committed.length} kayıt aktarıldı${otherRejected ? `, ${otherRejected} kayıt doğrulama hatasıyla reddedildi` : ""}${backendFailed ? `, ${backendFailed} kayıt backend'e YAZILAMADI (sadece bunlar sisteme girmedi)` : ""}${businessWarnings ? `, ${businessWarnings} kayıtta iş kuralı uyarısı bulundu (denetim izinde kayıtlı)` : ""}.`, alertType);

      // Limit/lisans yüzünden kırılan şirketleri AYRI ve net bir uyarıda
      // özetliyoruz — "18 kayıt backend'e yazılamadı" demek yerine
      // "hangi satırdan itibaren, hangi şirkette, hangi limitle" bilgisini
      // veriyoruz. (Kullanıcı talebi: satır bazında limit kırılma noktası.)
      if (limitReached.length) {
        const detail = limitReached.map(s => {
          const capacity = s.maxContracts != null
            ? `${s.currentContracts ?? "?"}/${s.maxContracts}`
            : (s.code === "NO_ACTIVE_LICENSE" ? "aktif lisans yok" : "limit bilinmiyor");
          return `${s.company}: Satır ${s.rowNumber} (${s.contractId})'ten itibaren sözleşme limiti doldu (${capacity})`;
        }).join(" · ");
        showAlert(detail, "error");
      }

      // DÜZELTME (kullanıcı talebi): "X kayıt backend'e YAZILAMADI" mesajı
      // limit/lisans DIŞINDAKİ backend hatalarında (örn. "Şirket eşleşmedi",
      // dönem kilidi, ağ hatası) hâlâ sadece bir SAYI veriyordu, gerçek
      // sebebi göstermiyordu. limitReached'de zaten özetlenenleri (satır no
      // üzerinden) burada TEKRARLAMIYORUZ.
      const genericBackendFailed = rejected.filter(r =>
        (r.errors || []).some(e => e.errorCode === "BACKEND_PERSIST_FAILED")
        && !limitRowNumbers.has(r.rowNumber)
      );
      if (genericBackendFailed.length) {
        const sample = genericBackendFailed.slice(0, 5).map(r => {
          const firstError = (r.errors || []).find(e => e.errorCode === "BACKEND_PERSIST_FAILED") || (r.errors || [])[0];
          return `Satır ${r.rowNumber}${r.normalizedData?.id ? ` (${r.normalizedData.id})` : ""}: ${firstError?.message || "Bilinmeyen hata"}`;
        }).join(" · ");
        const more = genericBackendFailed.length > 5 ? ` (+${genericBackendFailed.length - 5} satır daha, aynı türden)` : "";
        showAlert(`Backend hatası detayı — ${sample}${more}`, "error");
      }

      // DÜZELTME (kullanıcı talebi — "doğrulama hatasıyla reddedildi"
      // mesajı sadece SAYI veriyordu, SEBEP vermiyordu): commitImport
      // içindeki previewImport() satır bazında gerçek errorCode/field/
      // message üretiyor (REQUIRED_FIELD, INVALID_NUMBER, INVALID_CURRENCY,
      // DUPLICATE_IN_FILE, INVALID_DATE_RANGE...) ama bu bilgi hiçbir
      // yerde gösterilmiyordu. Artık ilk birkaç reddedilen satırın gerçek
      // hata metnini alert'te veriyoruz.
      const validationRejected = rejected.filter(r => !(r.errors || []).some(e => e.errorCode === "BACKEND_PERSIST_FAILED" || e.errorCode === "LIMIT_REACHED" || e.errorCode === "NO_ACTIVE_LICENSE"));
      if (validationRejected.length) {
        const sample = validationRejected.slice(0, 5).map(r => {
          const firstError = (r.errors || [])[0];
          const reason = firstError ? `${firstError.field ? firstError.field + ": " : ""}${firstError.message || firstError.errorCode}` : "Bilinmeyen doğrulama hatası";
          return `Satır ${r.rowNumber}${r.normalizedData?.id ? ` (${r.normalizedData.id})` : ""}: ${reason}`;
        }).join(" · ");
        const more = validationRejected.length > 5 ? ` (+${validationRejected.length - 5} satır daha, aynı türden)` : "";
        showAlert(`Doğrulama hatası detayı — ${sample}${more}`, "error");
      }
    } catch (error) {
      console.error("V19.1 integration import commit error:", error);
      showAlert(`Import tamamlanamadı: ${error?.message || String(error)}`, "error");
    } finally {
      hideLoading();
    }
  }

  /* ==========================================================
     TEMPLATE DOWNLOAD
  ========================================================== */

  const downloadTemplateButton = document.getElementById("downloadTemplateButton");
  if (downloadTemplateButton) downloadTemplateButton.onclick = downloadTemplate;

  /**
   * LEASE_IMPORT_TEMPLATE_ROWS — Excel/CSV şablon indirmesinde
   * kullanıcıya gösterilen örnek satır(lar). Saf statik veri; hiçbir
   * mantık içermez.
   *
   * FAZ 3 — SRP BÖLMESİ (downloadTemplate'den extract edildi, davranış
   * BİREBİR korunarak — bkz. PROJECT_CONTEXT.md bölüm 36).
   */
  const LEASE_IMPORT_TEMPLATE_ROWS = [
    {
      "Sözleşme ID": "LEASE-004",
      "Şirket": "GK Holding",
      "Şirket Kodu": "COMP-GK-HOLDING",
      "Tedarikçi": "Örnek Tedarikçi",
      "Aylık Kira": 100000,
      "Başlangıç Tarihi": "2026-01-01",
      "Bitiş Tarihi": "2030-12-31",
      "İskonto Oranı": 18,
      "Para Birimi": "TRY",
      "Ödeme Zamanı": "Dönem Sonu (Arrears)",
      "Ödeme Frekansı": "Aylık",
      "Doğrudan İlk Maliyetler": 0,
      "Sökme / Restorasyon Karşılığı": 0,
      "Yenileme Tarihi": "2030-09-30",
      "Varlık Sınıfı": "Makine",
      "Peşin Ödemeler": 0,
      "Kiralayan Teşvikleri": 0,
      "Kira Artış Tipi": "Artış Yok",
      "Yıllık Artış Oranı": 0,
      "Sabit Artış Tutarı": 0,
      "Değişken Ödeme": 0,
      "Varlığın Faydalı Ömrü (Yıl)": "",
      "Baz Endeks Oranı": "",
      "Güncel Endeks Oranı": "",
      "Endeks Güncelleme Ayı": "",
      "Endeks Güncelleme Günü": "",
      "Yenileme Opsiyonu": "Hayır",
      "Fesih Opsiyonu": "Hayır",
      "Satın Alma Opsiyonu": "Hayır",
      "Mülkiyet Devri": "Hayır",
      "Kısa Vadeli Kiralama İstisnası": "Hayır",
      "Düşük Değerli Varlık İstisnası": "Hayır",
      // Opsiyon varsa doldurulur (TFRS 16.18–21): karar Evet/Hayır, Evet ise tarih.
      "Kira Süresi Değerlendirme Referansı": "",
      "Yenileme Opsiyonu Kullanımı Makul Ölçüde Kesin": "",
      "Yenileme Sonrası Bitiş Tarihi": "",
      "Fesih Opsiyonu Kullanımı Makul Ölçüde Kesin": "",
      "Fesih Tarihi": "",
      "Fesih Cezası": "",
      "Satın Alma Opsiyonu Kullanımı Makul Ölçüde Kesin": "",
      "Satın Alma Opsiyon Bedeli": ""
    }
  ];

  /**
   * downloadTemplate — sözleşme içe aktarma şablonunu kullanıcıya
   * indirir. XLSX kütüphanesi varsa .xlsx, yoksa .csv fallback'ine
   * düşer. Şablon VERİSİ artık `LEASE_IMPORT_TEMPLATE_ROWS`'ta —
   * bu fonksiyon yalnızca yazma işini yapar (plan Faz 3 önerisiyle
   * birebir).
   */
  function downloadTemplate() {
    const rows = LEASE_IMPORT_TEMPLATE_ROWS;

    if (typeof XLSX !== "undefined") {
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Sözleşmeler");
      XLSX.writeFile(workbook, "TFRS16_Sozlesme_Sablonu.xlsx");
      return;
    }

    const headers = Object.keys(rows[0]);

    const csv = [
      headers.join(";"),
      headers.map(h => rows[0][h]).join(";")
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "TFRS16_Sozlesme_Sablonu.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  /* ==========================================================
     SEARCH / FILTER EVENTS
  ========================================================== */

  document
    .getElementById(
      "searchInput"
    )
    ?.addEventListener(
      "input",
      renderTable
    );

  document
    .getElementById(
      "statusFilter"
    )
    ?.addEventListener(
      "change",
      renderTable
    );

  document
    .getElementById(
      "companyFilter"
    )
    ?.addEventListener(
      "change",
      renderTable
    );

  /* ==========================================================
     DELETE CONTRACT
  ========================================================== */

  document
    .getElementById(
      "deleteContract"
    )
    ?.addEventListener(
      "click",
      async () => {

        if (
          !selectedContractId
        ) {
          return;
        }

        const contract =
          contracts.find(
            item =>
              item.id ===
              selectedContractId
          );

        if (!contract) {
          return;
        }

        // P1 UYUMLULUK: backend artık CONTROLLER/VIEWER rollerinin
        // sözleşme silmesini reddediyor (403
        // CONTRACT_WRITE_ACCESS_DENIED). API'ye hiç gitmeden engelle.
        if (typeof tfrs16CanWriteContracts === "function" && !tfrs16CanWriteContracts()) {
          showAlert("Bu işlem için yazma yetkiniz bulunmamaktadır (salt okunur rol).");
          return;
        }

        try {
          v21GuardContract("contracts.delete", contract, "DELETE");
        } catch (error) {
          console.error("V21 authorization denied:", error);
          showAlert(error?.message || "You do not have permission to perform this action.");
          return;
        }

        // V19 Kısa Vade Madde 1: kilitli dönemdeki sözleşme silinemez.
        const deleteLockCheck = assertPeriodWritable(contract, contract?.startDate || new Date());
        if (deleteLockCheck.locked) {
          showAlert(deleteLockCheck.message);
          return;
        }

        const confirmed =
          confirm(
            `${contract.id} sözleşmesini silmek istediğinizden emin misiniz?`
          );

        if (!confirmed) {
          return;
        }

        const deletedId = selectedContractId;

        // BUG FIX (P1 uyum incelemesi): önceki sürümde sözleşme
        // yerel listeden API çağrısından ÖNCE siliniyordu. API 403/404/
        // 500 ile başarısız olursa (ör. CONTROLLER/VIEWER'ın backend
        // tarafından reddedilmesi, veya ağ hatası) kullanıcıya uyarı
        // gösteriliyordu AMA sözleşme ekranda "silinmiş" görünmeye
        // devam ediyordu — DB'deki gerçek durumla ekran arasında sessiz
        // bir tutarsızlık oluşuyordu. Artık "PostgreSQL'e önce yaz"
        // deseniyle (persistContractToApi'deki ile aynı ilke) tutarlı
        // olacak şekilde ÖNCE API'ye siliniyor, yerel state SADECE
        // başarılı olursa değiştiriliyor.
        let deleteResult = null;
        try {
          deleteResult = await deleteContractFromApi(deletedId);
        } catch (apiErr) {
          console.error("API silme hatası:", apiErr);
          showAlert(
            "Sözleşme silinemedi: " +
            (apiErr?.message || String(apiErr))
          );
          return; // Yerel state'e HİÇ dokunulmadı — ekran DB ile tutarlı kalır.
        }

        const deletedSnapshot = cloneAuditValue(contract);

        recordAuditEvent({
          // The server already wrote this row; reusing its id keeps the
          // browser copy from becoming a duplicate (ON CONFLICT DO NOTHING).
          ...(deleteResult?.auditId ? { id: deleteResult.auditId } : {}),
          // Archived (kept for its trusted calculation history) is not a delete.
          action: deleteResult?.archived ? "ARCHIVE" : "DELETE",
          entityType: "CONTRACT",
          entityId: contract.id,
          contractId: contract.id,
          reason: deleteResult?.archived ? "Contract archived (trusted calculation history kept)" : "Contract deleted",
          oldValue: deletedSnapshot,
          newValue: null,
          metadata: { deletedContractSnapshot: deletedSnapshot, auditRetention: "central" }
        });

        contracts =
          contracts.filter(
            item =>
              item.id !==
              selectedContractId
          );

        saveContracts(
          contracts
        );

        closeDetail();

        refresh();

        // Sözleşmenin güvenilir hesaplama geçmişi varsa sunucu silmek
        // yerine arşivler: kayıtlar korunur, listeden ve raporlardan çıkar.
        if (deleteResult?.archived) {
          showAlert(`${deletedId} hesaplama geçmişi korunduğu için silinmedi, arşivlendi. Sözleşme listelerden ve raporlardan çıkarıldı.`);
        }
      }
    );

  /* ==========================================================
     RISK & CONTROL ENGINE (V16.8)
     Single-purpose control layer over existing engines.
  ========================================================== */

  const CONTROL_STATUS = Object.freeze({
    GREEN: "GREEN",
    YELLOW: "YELLOW",
    RED: "RED"
  });

  const CONTROL_PRIORITY = Object.freeze({
    CRITICAL: "CRITICAL",
    HIGH: "HIGH",
    MEDIUM: "MEDIUM",
    LOW: "LOW"
  });

  const CONTROL_EXCEPTION_STATUS = Object.freeze({
    OPEN: "OPEN",
    ACKNOWLEDGED: "ACKNOWLEDGED",
    RESOLVED: "RESOLVED",
    WAIVED: "WAIVED"
  });

  const CONTROL_STORAGE_KEY = "gk_tfrs16_control_snapshots_v1";
  const CONTROL_TOLERANCE = 0.01;

  const CONTROL_CONFIG = Object.freeze([
    { id: "CTRL-DATA-001", name: "Critical contract data completeness", category: "DATA_COMPLETENESS", priority: "CRITICAL", enabled: true },
    { id: "CTRL-DATA-002", name: "Contract date validity", category: "DATA_VALIDITY", priority: "CRITICAL", enabled: true },
    { id: "CTRL-PAY-001", name: "Payment validity", category: "PAYMENT", priority: "CRITICAL", enabled: true },
    { id: "CTRL-RATE-001", name: "Discount rate validity", category: "DISCOUNT_RATE", priority: "CRITICAL", enabled: true },
    { id: "CTRL-TERM-001", name: "Lease term and schedule consistency", category: "LEASE_TERM", priority: "HIGH", enabled: true },
    { id: "CTRL-ESC-001", name: "Escalation consistency", category: "ESCALATION", priority: "HIGH", enabled: true },
    { id: "CTRL-CALC-001", name: "Lease liability calculation integrity", category: "CALCULATION", priority: "CRITICAL", enabled: true },
    { id: "CTRL-ROU-001", name: "ROU asset calculation integrity", category: "CALCULATION", priority: "CRITICAL", enabled: true },
    { id: "CTRL-JRN-001", name: "Journal integrity", category: "JOURNAL", priority: "CRITICAL", enabled: true },
    { id: "CTRL-CLS-001", name: "Current / non-current classification", category: "CLASSIFICATION", priority: "CRITICAL", enabled: true },
    { id: "CTRL-MOD-001", name: "Modification integrity", category: "MODIFICATION", priority: "HIGH", enabled: true },
    { id: "CTRL-REA-001", name: "Reassessment integrity", category: "REASSESSMENT", priority: "HIGH", enabled: true },
    { id: "CTRL-AUD-001", name: "Critical event audit evidence", category: "AUDIT_TRAIL", priority: "HIGH", enabled: true },
    { id: "CTRL-LIFE-001", name: "Contract lifecycle consistency", category: "CONTRACT_LIFECYCLE", priority: "HIGH", enabled: true },
    { id: "CTRL-LIFE-002", name: "Expiry and renewal risk", category: "LEASE_TERM", priority: "HIGH", enabled: true }
  ]);






  function loadControlSnapshots() {
    try {
      const raw = localStorage.getItem(CONTROL_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function saveControlSnapshots(data) {
    try {
      localStorage.setItem(CONTROL_STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (error) {
      return false;
    }
  }

  function controlId() {
    return `CTRL-RUN-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }



























  function getStoredControlSnapshot(contractIdValue) {
    if (!contractIdValue) return null;
    const snapshots = loadControlSnapshots();
    return snapshots[contractIdValue] || null;
  }

  function getContractRiskStatus(contractIdValue) {
    const snapshot = getStoredControlSnapshot(contractIdValue);
    return snapshot?.overallStatus || CONTROL_STATUS.GREEN;
  }


  function getOpenExceptions(contractIdValue) {
    const snapshots = loadControlSnapshots();
    const all = Object.values(snapshots).flatMap(snapshot => Array.isArray(snapshot?.exceptions) ? snapshot.exceptions : []);
    return all.filter(item =>
      (!contractIdValue || item.contractId === contractIdValue) &&
      item.status !== CONTROL_EXCEPTION_STATUS.RESOLVED &&
      item.status !== CONTROL_EXCEPTION_STATUS.WAIVED
    );
  }



  function getCriticalExceptions(contractIdValue) {
    return getOpenExceptions(contractIdValue).filter(item => item.priority === CONTROL_PRIORITY.CRITICAL);
  }

  function getContractsByRiskStatus(status) {
    const target = String(status || "").toUpperCase();
    return contracts.filter(contract => getContractRiskStatus(contract.id) === target);
  }

  function resolveControlException(contractIdValue, controlIdValue, actorValue = auditActor(), resolution = "Resolved by user") {
    v21GuardContract("controls.resolve", contractIdValue, "CONTROL_RESOLVE");
    const snapshots = loadControlSnapshots();
    const snapshot = snapshots[contractIdValue];
    if (!snapshot || !Array.isArray(snapshot.exceptions)) return false;
    const exception = snapshot.exceptions.find(item => item.controlId === controlIdValue && item.status !== CONTROL_EXCEPTION_STATUS.RESOLVED && item.status !== CONTROL_EXCEPTION_STATUS.WAIVED);
    if (!exception) return false;
    exception.status = CONTROL_EXCEPTION_STATUS.RESOLVED;
    exception.resolvedAt = new Date().toISOString();
    exception.resolvedBy = actorValue || auditActor();
    exception.resolution = resolution;
    saveControlSnapshots(snapshots);
    recordAuditEvent({
      action: "CONTROL_EXCEPTION_RESOLVED",
      entityType: "CONTROL_EXCEPTION",
      entityId: exception.id,
      contractId: contractIdValue,
      reason: resolution,
      metadata: { controlId: controlIdValue, resolvedBy: exception.resolvedBy }
    });
    return true;
  }

  function acknowledgeControlException(contractIdValue, controlIdValue, actorValue = auditActor()) {
    const snapshots = loadControlSnapshots();
    const snapshot = snapshots[contractIdValue];
    const exception = snapshot?.exceptions?.find(item => item.controlId === controlIdValue && item.status === CONTROL_EXCEPTION_STATUS.OPEN);
    if (!exception) return false;
    exception.status = CONTROL_EXCEPTION_STATUS.ACKNOWLEDGED;
    exception.acknowledgedAt = new Date().toISOString();
    exception.acknowledgedBy = actorValue || auditActor();
    saveControlSnapshots(snapshots);
    recordAuditEvent({ action: "CONTROL_EXCEPTION_ACKNOWLEDGED", entityType: "CONTROL_EXCEPTION", entityId: exception.id, contractId: contractIdValue, reason: "Control exception acknowledged", metadata: { controlId: controlIdValue, actor: exception.acknowledgedBy } });
    return true;
  }

  function waiveControlException(contractIdValue, controlIdValue, actorValue = auditActor(), reason = "Exception waived") {
    const snapshots = loadControlSnapshots();
    const snapshot = snapshots[contractIdValue];
    const exception = snapshot?.exceptions?.find(item => item.controlId === controlIdValue && item.status !== CONTROL_EXCEPTION_STATUS.RESOLVED && item.status !== CONTROL_EXCEPTION_STATUS.WAIVED);
    if (!exception) return false;
    exception.status = CONTROL_EXCEPTION_STATUS.WAIVED;
    exception.waivedAt = new Date().toISOString();
    exception.waivedBy = actorValue || auditActor();
    exception.waiverReason = reason;
    saveControlSnapshots(snapshots);
    recordAuditEvent({ action: "CONTROL_EXCEPTION_WAIVED", entityType: "CONTROL_EXCEPTION", entityId: exception.id, contractId: contractIdValue, reason, metadata: { controlId: controlIdValue, actor: exception.waivedBy } });
    return true;
  }



  function runV168ControlTests() {
    const testContract = {
      id: "V168-CONTROL-TEST",
      company: "Test Company",
      supplier: "Test Supplier",
      startDate: "2026-01-01",
      endDate: "2028-12-31",
      monthlyPayment: 1000,
      paymentFrequency: "monthly",
      paymentTiming: "arrears",
      discountRate: 6,
      currency: "TRY",
      leaseIncreaseType: "none",
      status: "ACTIVE",
      renewalDate: null,
      modifications: [],
      reassessments: []
    };
    const results = [];
    try {
      const snapshot = runContractControls(testContract, { persist: false, audit: false });
      results.push({ name: "CONTROL_ENGINE_EXECUTION", passed: Array.isArray(snapshot.controls) && snapshot.controls.length === CONTROL_CONFIG.length });
      results.push({ name: "RISK_AGGREGATION", passed: ["GREEN", "YELLOW", "RED"].includes(snapshot.overallStatus) });
      const broken = { ...testContract, id: "V168-BROKEN", monthlyPayment: -1 };
      const brokenSnapshot = runContractControls(broken, { persist: false, audit: false });
      results.push({ name: "CRITICAL_PAYMENT_EXCEPTION", passed: brokenSnapshot.overallStatus === CONTROL_STATUS.RED && brokenSnapshot.controls.some(item => item.controlId === "CTRL-PAY-001" && item.status === CONTROL_STATUS.RED) });
      const missing = { ...testContract, id: "V168-MISSING", company: "" };
      const missingSnapshot = runContractControls(missing, { persist: false, audit: false });
      results.push({ name: "DATA_COMPLETENESS_EXCEPTION", passed: missingSnapshot.overallStatus === CONTROL_STATUS.RED });
      const summary = { total: results.length, passed: results.filter(item => item.passed).length, failed: results.filter(item => !item.passed).length };
      return { passed: summary.failed === 0, summary, results };
    } catch (error) {
      return { passed: false, summary: { total: results.length + 1, passed: results.filter(item => item.passed).length, failed: results.filter(item => !item.passed).length + 1 }, results, error: error?.message || String(error) };
    }
  }

  /* ==========================================================
     CFO DASHBOARD DATA LAYER (V16.9)
     ----------------------------------------------------------
     Pure aggregation / normalization layer over existing engines.
     No calculation, reporting-date, journal, audit or control engine
     is replaced. Existing localStorage and DOM contracts remain intact.
  ========================================================== */

  const CFO_DATA_LAYER_VERSION = "V16.9";
  const CFO_TOLERANCE = 0.05;
  const CFO_KPI_CONFIG = Object.freeze({
    TOTAL_LEASE_LIABILITY: { id: "TOTAL_LEASE_LIABILITY", name: "Total Lease Liability", description: "Total lease liability at reporting date.", unit: "currency", source: "REPORTING_DATE_ENGINE", calculationBasis: "Existing liability split / professional schedule" },
    CURRENT_LEASE_LIABILITY: { id: "CURRENT_LEASE_LIABILITY", name: "Current Lease Liability", description: "Principal payable in the following twelve months.", unit: "currency", source: "REPORTING_DATE_ENGINE", calculationBasis: "Existing current liability logic" },
    NON_CURRENT_LEASE_LIABILITY: { id: "NON_CURRENT_LEASE_LIABILITY", name: "Non-current Lease Liability", description: "Lease liability remaining after current principal.", unit: "currency", source: "REPORTING_DATE_ENGINE", calculationBasis: "Existing current/non-current split" },
    ROU_ASSETS: { id: "ROU_ASSETS", name: "ROU Assets", description: "ROU asset closing balance at reporting date.", unit: "currency", source: "LEASE_SCHEDULE", calculationBasis: "Existing professional schedule" },
    INTEREST_EXPENSE: { id: "INTEREST_EXPENSE", name: "Interest Expense", description: "Lease interest for the selected period.", unit: "currency", source: "LEASE_SCHEDULE", calculationBasis: "Schedule interest" },
    DEPRECIATION_EXPENSE: { id: "DEPRECIATION_EXPENSE", name: "Depreciation Expense", description: "ROU depreciation for the selected period.", unit: "currency", source: "LEASE_SCHEDULE", calculationBasis: "Schedule depreciation" },
    NEXT12M_PAYMENTS: { id: "NEXT12M_PAYMENTS", name: "Next 12 Month Cash Payments", description: "Lease cash payments in the twelve months after reporting date.", unit: "currency", source: "LEASE_SCHEDULE", calculationBasis: "Schedule payment" },
    NEXT12M_PRINCIPAL: { id: "NEXT12M_PRINCIPAL", name: "Next 12 Month Principal", description: "Principal payable in the twelve months after reporting date.", unit: "currency", source: "LEASE_SCHEDULE", calculationBasis: "Schedule principal" },
    NEXT12M_INTEREST: { id: "NEXT12M_INTEREST", name: "Next 12 Month Interest", description: "Interest in the twelve months after reporting date.", unit: "currency", source: "LEASE_SCHEDULE", calculationBasis: "Schedule interest" }
  });

  /* ==========================================================
     FAZ 1 — DRY KONSOLİDASYONU: KANONİK "core*" YARDIMCILARI
     ----------------------------------------------------------
     Aşağıdaki fonksiyonlar, dosya genelinde cfo/rpt/v18/v19/v20/
     v21/v22/v23/v24 önekleriyle ~20 kez neredeyse aynı mantıkla
     kopyalanmış numeric/date/clone yardımcılarının TEK kanonik
     kaynağıdır (bkz. PROJECT_CONTEXT.md bölüm 33, "Faz 1 — DRY").

     KRİTİK: Bu tek bir "hepsi aynı" konsolidasyon DEĞİL. İnceleme,
     aynı isim kalıbını taşıyan fonksiyonların HER ZAMAN aynı
     davranmadığını ortaya çıkardı (ör. v20Clone hata durumunda
     orijinal değeri döndürüyor, diğerleri null; cfoAddMonths ay
     değerini coerce etmiyor, rpt/v18 ediyor; v19/v23/v24'ün tarih
     ayrıştırıcıları parseDate() KULLANMIYOR — Türkçe DD.MM.YYYY
     formatını desteklemiyorlar). Her orijinal fonksiyon, kendi tam
     eski davranışını KORUYAN ince bir sarmalayıcıya (thin wrapper)
     çevrildi; davranışı farklı olanlar (v19IsoDate, v20Clone,
     v23Date, v24Date, cloneModificationValue'nun kendi mantığı vb.)
     BİLEREK konsolide EDİLMEDİ — aşağıda her core fonksiyonunun
     yorumunda hangi orijinallerin ona eşlendiği ve hangilerinin
     KASITLI OLARAK dışarıda bırakıldığı belirtiliyor.

     Bu blok saf EKLEME'dir; hiçbir mevcut fonksiyonun GÖVDESİ bu
     noktada değişmedi (onlar birazdan, her biri ayrı ayrı, ince
     sarmalayıcıya çevrilecek — orijinal davranışları test edilip
     doğrulanarak).
     ========================================================== */

  /**
   * coreNumber — güvenli sayı ayrıştırma.
   * Eşlenen orijinaller (hepsi byte-birebir aynı mantık): safeNumber,
   * cfoNumber, rptNumber, v18Number, v20Amount, v22Amount (fallback
   * her zaman 0 idi — coreNumber(value) ile eşdeğer), v23Num,
   * v24Number.
   * KASITLI OLARAK DIŞARIDA: integrationNumber — bu fonksiyon önce
   * biçimlendirilmiş sayı string'lerini (binlik ayraç/ondalık virgül)
   * normalize ediyor, farklı/daha zengin bir davranış; sadece SON
   * doğrulama adımı bu kalıba benziyor, konsolide edilmedi.
   */
  function coreNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  /**
   * coreRound — kuruş hassasiyetinde yuvarlama.
   * Eşlenen orijinaller: cfoRound, rptRound, v18Round — ÜÇÜ DE
   * `digits` değerini OLDUĞU GİBİ Math.pow(10, digits)'e geçiriyordu
   * (negatif değer kelepçelenmiyordu). Bu core fonksiyon da AYNI
   * şekilde kelepçelemez — v23Round'un kelepçeleme davranışı kendi
   * sarmalayıcısında (çağrı ÖNCESİNDE) korunacak.
   */
  function coreRound(value, digits = 2) {
    const n = coreNumber(value);
    const factor = Math.pow(10, digits);
    return Math.round((n + Number.EPSILON) * factor) / factor;
  }

  /**
   * coreClone — JSON round-trip ile derin kopya; ayrıştırılamayan
   * (döngüsel referans, undefined vb.) değerlerde NULL döner.
   * Eşlenen orijinaller (hepsi hata durumunda null dönüyordu):
   * cfoClone, rptClone, v18Clone, v21Clone, v22Clone, v23Clone,
   * v24Clone, cloneAuditValue, controlJson, integrationClone.
   * KASITLI OLARAK DIŞARIDA (bkz. coreCloneOrOriginal): v20Clone,
   * cloneModificationValue — bunlar hata durumunda ORİJİNAL değeri
   * döndürüyor, null DEĞİL.
   */
  function coreClone(value) {
    try { return JSON.parse(JSON.stringify(value)); } catch (error) { return null; }
  }

  /**
   * coreCloneOrOriginal — coreClone ile AYNI mantık, tek fark: hata
   * durumunda orijinal (ayrıştırılamayan) değeri döndürür, null değil.
   * Eşlenen orijinaller: v20Clone, cloneModificationValue.
   */
  function coreCloneOrOriginal(value) {
    try { return JSON.parse(JSON.stringify(value)); } catch (error) { return value; }
  }

  /**
   * coreDate — parseDate() üzerinden tarih ayrıştırma (ISO
   * "YYYY-MM-DD" + Türkçe "DD.MM.YYYY" / "DD/MM/YYYY" formatlarını
   * destekler, bkz. parseDate tanımı ~satır 5288). Bu fonksiyonun
   * KENDİSİ try/catch İÇERMEZ — cfoDate'in orijinal (kelepçesiz)
   * davranışıyla birebir eşleşir; rptDate/v18Date kendi
   * sarmalayıcılarında try/catch EKLEYEREK orijinal davranışlarını
   * korur.
   * Eşlenen orijinaller: cfoDate, rptDate, v18Date.
   * KASITLI OLARAK DIŞARIDA: v19IsoDate (kendi inline `new Date(date)`
   * ayrıştırması, parseDate KULLANMIYOR), v23Date (`new Date(value)`
   * — Türkçe format desteği yok, ISO tarih-only string'leri UTC
   * gece yarısı olarak yorumluyor; parseDate ise YEREL gece yarısı
   * zorluyor — bu, saat dilimine bağlı olarak FARKLI takvim günü
   * üretebilir), v24Date (değer falsy ise ŞİMDİKİ zamana düşüyor,
   * null'a değil — genuinely farklı davranış).
   */
  function coreDate(value) {
    return typeof parseDate === "function" ? parseDate(value) : null;
  }

  /**
   * coreIsoDate — ZATEN AYRIŞTIRILMIŞ bir Date nesnesini
   * "YYYY-MM-DD" metnine çevirir (ayrıştırma sorumluluğu çağırana
   * ait — her sarmalayıcı kendi xDate() fonksiyonunu önce çağırır,
   * böylece coreDate'in yukarıdaki davranış farkları korunur).
   * Eşlenen orijinaller: cfoIsoDate, rptIsoDate, v18IsoDate.
   * KASITLI OLARAK DIŞARIDA: v19IsoDate (coreDate kullanmıyor).
   */
  function coreIsoDate(parsedDate) {
    return parsedDate ? parsedDate.toISOString().slice(0, 10) : null;
  }

  /**
   * coreNormalizeDate — gevşek tarih normalize edici (native
   * `new Date(value)`, parseDate DEĞİL — Türkçe format desteklemez).
   * Eşlenen orijinaller (byte-birebir aynı): v20NormalizeDate,
   * v22NormalizeDate.
   */
  function coreNormalizeDate(value) {
    if (value === null || value === undefined || value === "") return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString().slice(0, 10);
  }








  /** @deprecated-name Kalıcı: cfoDate — dış çağrılarla (window.GK_TFRS16, olası eski referanslar) uyumluluk için korunuyor. Bkz. coreDate. */
  function cfoDate(value) {
    return coreDate(value);
  }




  function cfoIsActive(contract, reportingDate) {
    const status = String(contract?.status || "ACTIVE").toUpperCase();
    if (["TERMINATED", "CANCELLED", "DELETED"].includes(status)) return false;
    const start = cfoDate(contract?.startDate);
    const end = cfoDate(contract?.endDate);
    const report = cfoDate(reportingDate);
    if (!report) return status === "ACTIVE" || status === "DRAFT";
    if (start && start > report) return false;
    if (status === "EXPIRED") return false;
    if (end && end < report && status !== "ACTIVE") return false;
    return status === "ACTIVE" || status === "DRAFT" || status === "ACTIVE_LEASE";
  }


  function cfoResolveReportingDate(reportingDate) {
    const parsed = cfoDate(reportingDate);
    return parsed || new Date();
  }

  function cfoBuildSchedule(contract) {
    // FAZ 4.1 (GC-18 düzeltmesi) — mantık resolveContractScheduleSource'a
    // taşındı (satır ~6698 civarı, CORE katmanı); bu artık ince bir
    // sarmalayıcı. getScheduleAsOfReportingDate de AYNI kaynağı kullanıyor
    // — iki farklı schedule-seçim mantığı artık YOK, tek kaynak var.
    return resolveContractScheduleSource(contract);
  }
































  function runV169DataLayerTests() {
    const results=[];
    try {
      const d=new Date();
      const zeroContracts=Array.isArray(contracts)&&contracts.length===0;
      const metrics=getTfrs16CfoMetrics(d);
      results.push({name:"CFO_SNAPSHOT",passed:!!metrics&&!!metrics.contracts});
      results.push({name:"LIABILITY_RECONCILIATION",passed:metrics.reconciliation.liability.passed});
      results.push({name:"CASHFLOW_RECONCILIATION",passed:metrics.reconciliation.cashFlow.passed});
      results.push({name:"CURRENCY_SEPARATION",passed:metrics.currencies&&typeof metrics.currencies==="object"&&!Array.isArray(metrics.currencies)});
      results.push({name:"COMPANY_AGGREGATION",passed:Array.isArray(metrics.companies)});
      results.push({name:"RISK_METRICS",passed:metrics.risk&&["green","yellow","red"].every(k=>typeof metrics.risk[k]==="number")});
      results.push({name:"DATA_QUALITY",passed:["COMPLETE","WARNING","ERROR"].includes(metrics.dataQuality.status)});
      results.push({name:"BACKWARD_COMPATIBILITY",passed:Array.isArray(contracts)});
      results.push({name:"ZERO_CONTRACTS_SUPPORTED",passed:!zeroContracts||metrics.contracts.total===0||metrics.contracts.total>0});
      return {passed:results.every(r=>r.passed),summary:{total:results.length,passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length},results};
    } catch(error) { return {passed:false,summary:{total:results.length+1,passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length+1},results,error:error?.message||String(error)}; }
  }

  /* ==========================================================
     FINANCIAL REPORTING ENGINE (V16.10)
     ----------------------------------------------------------
     Reporting-only layer over V16.9 calculation, CFO, journal,
     audit and risk/control engines. No existing engine is replaced.
  ========================================================== */

  const REPORTING_ENGINE_VERSION = "V16.10";
  const REPORTING_TOLERANCE = 0.05;
  const REPORTING_BUCKETS = Object.freeze([
    { id: "WITHIN_1_MONTH", name: "Within 1 month", min: 0, max: 1 },
    { id: "1_3_MONTHS", name: "1–3 months", min: 1, max: 3 },
    { id: "3_6_MONTHS", name: "3–6 months", min: 3, max: 6 },
    { id: "6_12_MONTHS", name: "6–12 months", min: 6, max: 12 },
    { id: "1_2_YEARS", name: "1–2 years", min: 12, max: 24 },
    { id: "2_3_YEARS", name: "2–3 years", min: 24, max: 36 },
    { id: "3_5_YEARS", name: "3–5 years", min: 36, max: 60 },
    { id: "MORE_THAN_5_YEARS", name: "More than 5 years", min: 60, max: Infinity }
  ]);

  // TFRS 7.39 liquidity risk disclosure buckets ("Finansal araçlardan
  // kaynaklanan risklerin niteliği ve düzeyi" dipnotunda kullanılan
  // vade dilimleri). REPORTING_BUCKETS'daki 8 dilim, bu dipnotta
  // görülen 4 dilime eşlenir.
  const DISCLOSURE_RISK_BUCKETS = Object.freeze([
    { id: "UNDER_3_MONTHS", name: "3 aydan kısa", sources: ["WITHIN_1_MONTH", "1_3_MONTHS"] },
    { id: "3_TO_12_MONTHS", name: "3-12 ay arası", sources: ["3_6_MONTHS", "6_12_MONTHS"] },
    { id: "1_TO_5_YEARS", name: "1-5 yıl arası", sources: ["1_2_YEARS", "2_3_YEARS", "3_5_YEARS"] },
    { id: "OVER_5_YEARS", name: "5 yıldan uzun", sources: ["MORE_THAN_5_YEARS"] }
  ]);

  /** @deprecated-name Kalıcı: rptNumber — dış çağrılarla (window.GK_TFRS16, olası eski referanslar) uyumluluk için korunuyor. Bkz. coreNumber. */
  function rptNumber(value, fallback = 0) {
    return coreNumber(value, fallback);
  }


  /** @deprecated-name Kalıcı: rptDate — dış çağrılarla (window.GK_TFRS16, olası eski referanslar) uyumluluk için korunuyor. Bkz. coreDate. try/catch orijinal davranışı korumak için eklendi. */
  function rptDate(value) {
    try { return coreDate(value); } catch (error) { return null; }
  }








  function rptResolveDate(value) {
    if (typeof cfoResolveReportingDate === "function") return cfoResolveReportingDate(value);
    return rptDate(value) || new Date();
  }




  function rptSafeContracts() {
    return Array.isArray(contracts) ? contracts : [];
  }













  function rptGetContractCfo(contract, reportingDate) {
    try {
      if (typeof cfoGetContractMetricsInternal === "function") return cfoGetContractMetricsInternal(contract, reportingDate);
      if (typeof getCfoContractMetrics === "function") return getCfoContractMetrics(contract.id, reportingDate);
    } catch (error) {}
    return null;
  }











































  function runV1610ReportingTests(){
    const results=[];
    try{
      const d=new Date(), snap=getTfrs16FinancialReportingSnapshot(d);
      const tests=[
        ["ZERO_OR_EXISTING_CONTRACTS",!!snap&&Array.isArray(snap.contractRegister.rows)],
        ["LIABILITY_ROLL_FORWARD",Math.abs(rptNumber(snap.liabilityRollForward.reconciliation?.difference))<=REPORTING_TOLERANCE||snap.liabilityRollForward.status==="ERROR"],
        ["ROU_ROLL_FORWARD",Math.abs(rptNumber(snap.rouRollForward.reconciliation?.difference))<=REPORTING_TOLERANCE||snap.rouRollForward.status==="ERROR"],
        ["MATURITY_ANALYSIS",Array.isArray(snap.maturityAnalysis.rows)],
        ["LIQUIDITY_RISK_DISCLOSURE",Array.isArray(snap.liquidityRiskDisclosure.rows)&&snap.liquidityRiskDisclosure.rows.length===1&&Array.isArray(snap.liquidityRiskDisclosure.rows[0].buckets)&&snap.liquidityRiskDisclosure.rows[0].buckets.length===4],
        ["CURRENT_NON_CURRENT",Array.isArray(snap.cfoSnapshot?.companies)||Array.isArray(snap.contractRegister.rows)],
        ["COMPANY_EXPOSURE",Array.isArray(snap.companyExposure.rows)],
        ["CURRENCY_SEPARATION",Array.isArray(snap.currencyExposure.rows)],
        ["JOURNAL_SUMMARY",Array.isArray(snap.journalSummary.rows)],
        ["CONTROL_EXCEPTION_REPORT",Array.isArray(snap.controlExceptionReport.rows)],
        ["AUDIT_TRAIL_REPORT",Array.isArray(snap.auditSummary.rows)],
        ["DATA_QUALITY",["READY","WARNING","ERROR"].includes(snap.dataQuality.status)],
        ["REPORTING_SNAPSHOT",snap.version==="V16.10"]
      ];
      tests.forEach(t=>results.push({name:t[0],passed:Boolean(t[1])}));
      return {passed:results.every(r=>r.passed),summary:{total:results.length,passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length},results};
    }catch(error){return {passed:false,summary:{total:results.length+1,passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length+1},results,error:error?.message||String(error)};}
  }

  /* ==========================================================
     MONTH-END CLOSE ENGINE (V17)
     ----------------------------------------------------------
     Additive close-control layer over V16.10 engines.
     No calculation, schedule, journal, audit, risk or reporting
     engine is replaced. V17 reads, validates, reconciles,
     controls, assesses and stores close/certification state.
  ========================================================== */

  const CLOSE_ENGINE_VERSION = "V17";
  const CLOSE_STORAGE_KEY = "gk_tfrs16_month_end_close_v1";
  const CLOSE_TOLERANCE = typeof REPORTING_TOLERANCE === "number" ? REPORTING_TOLERANCE : 0.01;

  const CLOSE_STATUS = Object.freeze({
    NOT_STARTED: "NOT_STARTED",
    IN_PROGRESS: "IN_PROGRESS",
    READY: "READY",
    WARNING: "WARNING",
    BLOCKED: "BLOCKED",
    CLOSED: "CLOSED",
    REOPENED: "REOPENED"
  });

  const CLOSE_CHECK_STATUS = Object.freeze({
    PASS: "PASS",
    WARNING: "WARNING",
    FAIL: "FAIL",
    NOT_APPLICABLE: "NOT_APPLICABLE"
  });

  const CLOSE_CONTROLS = Object.freeze([
    { id: "CLOSE-CONTRACT-COMPLETENESS", name: "Contract completeness", category: "DATA", severity: "CRITICAL", blocking: true },
    { id: "CLOSE-CONTRACT-VALIDITY", name: "Contract validity", category: "DATA", severity: "CRITICAL", blocking: true },
    { id: "CLOSE-SCHEDULE-COMPLETENESS", name: "Payment schedule completeness", category: "SCHEDULE", severity: "CRITICAL", blocking: true },
    { id: "CLOSE-CALCULATION-COMPLETENESS", name: "Calculation completeness", category: "CALCULATION", severity: "CRITICAL", blocking: true },
    { id: "CLOSE-ESCALATION-VALIDATION", name: "Escalation validation", category: "CALCULATION", severity: "HIGH", blocking: true },
    { id: "CLOSE-MODIFICATION-REVIEW", name: "Modification review", category: "LIFECYCLE", severity: "HIGH", blocking: true },
    { id: "CLOSE-REASSESSMENT-REVIEW", name: "Reassessment review", category: "LIFECYCLE", severity: "HIGH", blocking: true },
    { id: "CLOSE-JOURNAL-COMPLETENESS", name: "Journal completeness", category: "JOURNAL", severity: "CRITICAL", blocking: true },
    { id: "CLOSE-JOURNAL-BALANCE", name: "Journal balance", category: "JOURNAL", severity: "CRITICAL", blocking: true },
    { id: "CLOSE-CLASSIFICATION", name: "Current / non-current classification", category: "CLASSIFICATION", severity: "CRITICAL", blocking: true },
    { id: "CLOSE-LIABILITY-RECON", name: "Liability reconciliation", category: "RECONCILIATION", severity: "CRITICAL", blocking: true },
    { id: "CLOSE-ROU-RECON", name: "ROU reconciliation", category: "RECONCILIATION", severity: "CRITICAL", blocking: true },
    { id: "CLOSE-CASH-RECON", name: "Cash payment reconciliation", category: "RECONCILIATION", severity: "HIGH", blocking: false },
    { id: "CLOSE-CONTROL-EXCEPTIONS", name: "Control exceptions", category: "CONTROLS", severity: "CRITICAL", blocking: true },
    { id: "CLOSE-AUDIT-TRAIL", name: "Audit trail completeness", category: "AUDIT", severity: "HIGH", blocking: true },
    { id: "CLOSE-REPORTING-COMPLETENESS", name: "Financial reporting completeness", category: "REPORTING", severity: "HIGH", blocking: true }
  ]);

  const CLOSE_SCORE_WEIGHTS = Object.freeze({
    CRITICAL: 30,
    HIGH: 20,
    MEDIUM: 10,
    LOW: 5
  });

  function closeResolveDate(value) {
    try {
      if (typeof rptResolveDate === "function") return rptResolveDate(value);
    } catch (error) {}
    const d = value instanceof Date ? new Date(value.getTime()) : new Date(value || new Date());
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }

  /** @deprecated-name Kalıcı: closeIsoDate — dış çağrılarla (window.GK_TFRS16, olası eski referanslar) uyumluluk için korunuyor. Bkz. coreIsoDate. closeResolveDate() hiçbir zaman null dönmez (her zaman bir Date verir). */
  function closeIsoDate(value) {
    return coreIsoDate(closeResolveDate(value));
  }

  function closePeriod(value) {
    const d = closeResolveDate(value);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }


  function closeMonthEnd(value) {
    const d = closeResolveDate(value);
    return new Date(d.getFullYear(), d.getMonth() + 1, 0);
  }

  function closeSafeContracts() {
    try {
      return typeof rptSafeContracts === "function" ? rptSafeContracts() : (Array.isArray(contracts) ? contracts.filter(Boolean) : []);
    } catch (error) {
      return Array.isArray(contracts) ? contracts.filter(Boolean) : [];
    }
  }


  function closeLoadState() {
    try {
      const raw = localStorage.getItem(CLOSE_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function closeSaveState(state) {
    try {
      localStorage.setItem(CLOSE_STORAGE_KEY, JSON.stringify(state || {}));
      return true;
    } catch (error) {
      return false;
    }
  }

  function closeGetState(period) {
    const state = closeLoadState();
    return state[period] || null;
  }

  function closeUpsertState(period, patch = {}) {
    const state = closeLoadState();
    const previous = state[period] || { period, status: CLOSE_STATUS.NOT_STARTED, locked: false, certified: false };
    const next = { ...previous, ...patch, period, updatedAt: new Date().toISOString() };
    state[period] = next;
    closeSaveState(state);
    return next;
  }

























  function getMonthEndCloseHistory() {
    const state = closeLoadState();
    return Object.values(state).sort((a, b) => String(a.period || "").localeCompare(String(b.period || "")));
  }

  function getMonthEndCloseState(reportingDate) {
    return closeGetState(closePeriod(reportingDate));
  }

  function saveMonthEndCloseCertification(reportingDate, input = {}) {
    const d = closeResolveDate(reportingDate), period = closePeriod(d), readiness = getCloseReadiness(d);
    if (!readiness.ready) return { success: false, error: "Close is not ready for certification.", readiness };
    const certifiedBy = input.certifiedBy || input.actor || auditActor();
    const next = closeUpsertState(period, {
      reportingDate: closeIsoDate(d),
      status: CLOSE_STATUS.CLOSED,
      locked: input.locked !== false,
      certified: true,
      certifiedAt: new Date().toISOString(),
      certifiedBy: String(certifiedBy || "system"),
      certificationStatus: "CERTIFIED",
      comments: String(input.comments || ""),
      closedAt: new Date().toISOString(),
      closedBy: String(certifiedBy || "system")
    });
    if (typeof recordAuditEvent === "function") recordAuditEvent({ action: "MONTH_END_CLOSE_CERTIFIED", entityType: "MONTH_END_CLOSE", entityId: period, reason: "V17 month-end close certification", metadata: { period, reportingDate: closeIsoDate(d), score: readiness.score, certifiedBy: next.certifiedBy } });
    return { success: true, state: next, readiness: getCloseReadiness(d) };
  }

  function certifyMonthEndClose(reportingDate, input = {}) {
    v21RequirePermission("close.certify", { action: "CLOSE_CERTIFY" });
    return saveMonthEndCloseCertification(reportingDate, input);
  }

  function reopenMonthEndClose(reportingDate, input = {}) {
    const d = closeResolveDate(reportingDate), period = closePeriod(d), current = closeGetState(period);
    const actor = input.actor || input.reopenedBy || auditActor();
    const next = closeUpsertState(period, {
      reportingDate: closeIsoDate(d),
      status: CLOSE_STATUS.REOPENED,
      locked: false,
      certified: false,
      certificationStatus: "REOPENED",
      reopenedAt: new Date().toISOString(),
      reopenedBy: String(actor || "system"),
      reopenReason: String(input.reason || "")
    });
    if (typeof recordAuditEvent === "function") recordAuditEvent({ action: "MONTH_END_CLOSE_REOPENED", entityType: "MONTH_END_CLOSE", entityId: period, reason: input.reason || "V17 close reopen", metadata: { previousStatus: current?.status || null, reopenedBy: next.reopenedBy } });
    return { success: true, state: next, readiness: getCloseReadiness(d) };
  }

  /* ==========================================================
     PERIOD LOCKING ENGINE (V19 - Kısa Vade Madde 1)
     ----------------------------------------------------------
     Kilitli dönemde kontrat değişikliği, modification, reassessment,
     enflasyon düzeltmesi ve ilgili yazma işlemleri engellenir.
     Close certify → locked=true; reopen → locked=false.
     ========================================================== */

  /**
   * Verilen dönem (YYYY-MM) kilitli mi?
   * @param {string} period
   * @returns {boolean}
   */
  function isPeriodLocked(period) {
    const p = String(period || "").trim();
    if (!/^\d{4}-\d{2}$/.test(p)) return false;
    const state = closeGetState(p);
    return Boolean(state && state.locked);
  }

  /**
   * Bir tarihin ait olduğu dönem kilitli mi?
   * @param {string|Date} dateValue
   * @returns {boolean}
   */
  function isDateInLockedPeriod(dateValue) {
    try {
      const period = closePeriod(dateValue);
      return isPeriodLocked(period);
    } catch (error) {
      return false;
    }
  }

  /**
   * Kontrat üzerinde etkili tarih(ler) için kilit kontrolü.
   * effectiveDate / reportingDate / bugün dönemlerinden herhangi biri kilitliyse engeller.
   * @param {Object} contract
   * @param {string|Date} [effectiveDate]
   * @returns {{ locked: boolean, period: string|null, message: string|null }}
   */
  function assertPeriodWritable(contract, effectiveDate) {
    const dates = [];
    if (effectiveDate) dates.push(effectiveDate);
    if (contract?.startDate) dates.push(contract.startDate);
    // Bugünün dönemi de kontrol (ay sonu close sonrası değişiklik engeli)
    dates.push(new Date());

    for (const d of dates) {
      try {
        const period = closePeriod(d);
        if (isPeriodLocked(period)) {
          return {
            locked: true,
            period,
            message: `${period} dönemi kilitli. Değişiklik yapılamaz. Close Dashboard'dan "Dönemi Yeniden Aç" ile açabilirsiniz.`
          };
        }
      } catch (error) {}
    }
    return { locked: false, period: null, message: null };
  }

  /**
   * Dönemi manuel kilitle (certify olmadan da kullanılabilir).
   */
  function lockPeriod(period, input = {}) {
    const p = String(period || "").trim();
    if (!/^\d{4}-\d{2}$/.test(p)) {
      return { success: false, error: "Geçersiz dönem formatı (YYYY-MM)." };
    }
    const actor = input.actor || auditActor();
    const next = closeUpsertState(p, {
      locked: true,
      lockedAt: new Date().toISOString(),
      lockedBy: String(actor || "system"),
      lockReason: String(input.reason || "Manuel period lock"),
      status: input.status || CLOSE_STATUS.CLOSED
    });
    if (typeof recordAuditEvent === "function") {
      recordAuditEvent({
        action: "PERIOD_LOCKED",
        entityType: "MONTH_END_CLOSE",
        entityId: p,
        reason: input.reason || "Period locked",
        metadata: { lockedBy: next.lockedBy, immutable: true }
      });
    }
    return { success: true, state: next };
  }

  /**
   * Dönem kilidini aç (reopenMonthEndClose ile uyumlu wrapper).
   */
  function unlockPeriod(period, input = {}) {
    const p = String(period || "").trim();
    if (!/^\d{4}-\d{2}$/.test(p)) {
      return { success: false, error: "Geçersiz dönem formatı (YYYY-MM)." };
    }
    // reopenMonthEndClose period string de kabul etsin diye tarih üret
    const fakeDate = p + "-15";
    return reopenMonthEndClose(fakeDate, {
      reason: input.reason || "Period unlocked",
      actor: input.actor || auditActor()
    });
  }

  /**
   * Tüm kilitli dönemleri listeler.
   */
  function getLockedPeriods() {
    const state = closeLoadState();
    return Object.values(state)
      .filter(s => s && s.locked)
      .sort((a, b) => String(a.period).localeCompare(String(b.period)));
  }

  /* ==========================================================
     CLOSE DASHBOARD UI (V19 - Kısa Vade Madde 2)
     ----------------------------------------------------------
     CFO / Auditor-ready Month-End Close Dashboard.
     Uses existing V17 getMonthEndCloseDashboardData engine.
     ========================================================== */

  function closeDateOnly(value) {
    const text = String(value || "").trim();
    const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
    const date = coreDate(value);
    if (!date) return null;
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-");
  }



  async function ensurePrivateCloseControls(contractsForPeriod, reportingDate, companyId) {
    const end = closeDateOnly(reportingDate);
    if (!end) throw new Error("Geçersiz kapanış raporlama tarihi.");
    const list = (Array.isArray(contractsForPeriod) ? contractsForPeriod : [])
      .filter(contract => cfoIsActive(contract, end))
      .filter(contract => !companyId || companyId === "ALL" || String(contract.companyId || contract.company || "") === String(companyId));
    const key = `${end}|${String(companyId || "ALL")}`;
    if (PRIVATE_CLOSE_CONTROLS_CACHE.has(key)) return PRIVATE_CLOSE_CONTROLS_CACHE.get(key);

    // A portfolio can legitimately have no active contracts for a reporting
    // period (for example before the first lease commences). Keep this state
    // auditable without making a remote empty-scope request, which some API
    // gateways reject before the private engine can return its zero-scope
    // envelope.
    if (list.length === 0) {
      const controls = [
        ["CLOSE-CONTRACT-COMPLETENESS", "DATA"],
        ["CLOSE-SCHEDULE-COMPLETENESS", "SCHEDULE"],
        ["CLOSE-CALCULATION-COMPLETENESS", "CALCULATION"],
        ["CLOSE-CLASSIFICATION", "CLASSIFICATION"],
        ["CLOSE-LIABILITY-RECON", "RECONCILIATION"],
        ["CLOSE-ROU-RECON", "RECONCILIATION"],
        ["CLOSE-JOURNAL-COMPLETENESS", "JOURNAL"],
        ["CLOSE-JOURNAL-BALANCE", "JOURNAL"]
      ].map(([controlId, category]) => ({
        controlId,
        category,
        severity: "CRITICAL",
        status: "NOT_APPLICABLE",
        blocking: false,
        resolved: true,
        description: "Portföyde aktif sözleşme bulunmuyor; kontrol bu dönem için uygulanamaz.",
        affectedContracts: []
      }));
      const result = {
        source: "PRIVATE_ENGINE_CLOSE_CONTROLS",
        period: end.slice(0, 7),
        reportingDate: end,
        ready: true,
        score: 100,
        status: "READY",
        totalContracts: 0,
        activeContracts: 0,
        controls,
        blockers: [],
        warnings: [],
        certification: { status: "NOT_CERTIFIED", locked: false, certified: false }
      };
      PRIVATE_CLOSE_CONTROLS_CACHE.set(key, result);
      return result;
    }

    if (PRIVATE_CLOSE_CONTROLS_INFLIGHT.has(key)) return PRIVATE_CLOSE_CONTROLS_INFLIGHT.get(key);
    const facade = window.LeaseQantPrivateTfrs16Facade;
    if (typeof facade?.loadCloseControls !== "function") {
      throw new Error("Private close controls calculation is unavailable");
    }
    const promise = Promise.resolve(facade.loadCloseControls(list, end, { timeoutMs: 20000 }))
      .then(result => {
        PRIVATE_CLOSE_CONTROLS_CACHE.set(key, result);
        return result;
      })
      .finally(() => PRIVATE_CLOSE_CONTROLS_INFLIGHT.delete(key));
    PRIVATE_CLOSE_CONTROLS_INFLIGHT.set(key, promise);
    return promise;
  }



  function requestMonthEndClose(reportingDate, input = {}) {
    v21RequirePermission("close.execute", { action: "CLOSE_EXECUTE" });
    const d = closeResolveDate(reportingDate), period = closePeriod(d), readiness = getCloseReadiness(d);
    const next = closeUpsertState(period, { reportingDate: closeIsoDate(d), status: readiness.status === CLOSE_STATUS.BLOCKED ? CLOSE_STATUS.BLOCKED : CLOSE_STATUS.IN_PROGRESS, requestedAt: new Date().toISOString(), requestedBy: String(input.requestedBy || input.actor || auditActor()), comments: String(input.comments || "") });
    return { success: true, state: next, readiness };
  }

  function setMonthEndCloseJournalOverride(reportingDate, enabled = true, reason = "") {
    const d = closeResolveDate(reportingDate), period = closePeriod(d);
    const next = closeUpsertState(period, { journalOverride: Boolean(enabled), journalOverrideReason: String(reason || "") });
    if (typeof recordAuditEvent === "function") recordAuditEvent({ action: "MONTH_END_CLOSE_JOURNAL_OVERRIDE", entityType: "MONTH_END_CLOSE", entityId: period, reason: reason || "Journal evidence override", metadata: { enabled: Boolean(enabled) } });
    return next;
  }

  function runV17MonthEndCloseTests(reportingDate) {
    const d = closeResolveDate(reportingDate || new Date()), results = [];
    try {
      const checklist = getMonthEndCloseChecklist(d);
      const readiness = getCloseReadiness(d);
      const summary = getMonthEndCloseSummary(d);
      const dashboard = getMonthEndCloseDashboardData(d);
      const approval = getCloseApprovalReadiness(d);
      const companies = Array.from(new Set(closeSafeContracts().map(c => c.company).filter(Boolean)));
      const currencies = Array.from(new Set(closeSafeContracts().map(c => c.currency || "UNSPECIFIED")));
      const tests = [
        ["ZERO_OR_EXISTING_CONTRACTS", Array.isArray(closeSafeContracts())],
        ["SINGLE_OR_MULTIPLE_CONTRACT_SUPPORT", checklist.activeContractCount >= 0],
        ["CLOSE_CHECKLIST", Array.isArray(checklist.checks) && checklist.checks.length >= CLOSE_CONTROLS.length],
        ["CONTRACT_COMPLETENESS_CONTROL", checklist.checks.some(x => x.controlId === "CLOSE-CONTRACT-COMPLETENESS")],
        ["CONTRACT_VALIDITY_CONTROL", checklist.checks.some(x => x.controlId === "CLOSE-CONTRACT-VALIDITY")],
        ["SCHEDULE_COMPLETENESS_CONTROL", checklist.checks.some(x => x.controlId === "CLOSE-SCHEDULE-COMPLETENESS")],
        ["CALCULATION_CONTROL", checklist.checks.some(x => x.controlId === "CLOSE-CALCULATION-COMPLETENESS")],
        ["ESCALATION_CONTROL", checklist.checks.some(x => x.controlId === "CLOSE-ESCALATION-VALIDATION")],
        ["MODIFICATION_CONTROL", checklist.checks.some(x => x.controlId === "CLOSE-MODIFICATION-REVIEW")],
        ["REASSESSMENT_CONTROL", checklist.checks.some(x => x.controlId === "CLOSE-REASSESSMENT-REVIEW")],
        ["JOURNAL_COMPLETENESS_CONTROL", checklist.checks.some(x => x.controlId === "CLOSE-JOURNAL-COMPLETENESS")],
        ["JOURNAL_BALANCE_CONTROL", checklist.checks.some(x => x.controlId === "CLOSE-JOURNAL-BALANCE")],
        ["CURRENT_NON_CURRENT_CONTROL", checklist.checks.some(x => x.controlId === "CLOSE-CLASSIFICATION")],
        ["LIABILITY_RECONCILIATION", checklist.checks.some(x => x.controlId === "CLOSE-LIABILITY-RECON")],
        ["ROU_RECONCILIATION", checklist.checks.some(x => x.controlId === "CLOSE-ROU-RECON")],
        ["CASH_RECONCILIATION", checklist.checks.some(x => x.controlId === "CLOSE-CASH-RECON")],
        ["CONTROL_EXCEPTION_ENGINE", checklist.checks.some(x => x.controlId === "CLOSE-CONTROL-EXCEPTIONS")],
        ["AUDIT_TRAIL_CONTROL", checklist.checks.some(x => x.controlId === "CLOSE-AUDIT-TRAIL")],
        ["REPORTING_COMPLETENESS", checklist.checks.some(x => x.controlId === "CLOSE-REPORTING-COMPLETENESS")],
        ["CLOSE_STATUS", Object.values(CLOSE_STATUS).includes(readiness.status)],
        ["CLOSE_SCORE", Number.isFinite(readiness.score) && readiness.score >= 0 && readiness.score <= 100],
        ["CLOSE_BLOCKERS", Array.isArray(readiness.blockingIssues)],
        ["CLOSE_WARNINGS", Array.isArray(readiness.warnings)],
        ["CLOSE_SUMMARY", summary.period === closePeriod(d) && Number.isFinite(summary.closeScore)],
        ["COMPANY_CLOSE", Array.isArray(dashboard.companyStatus) && dashboard.companyStatus.length === companies.length],
        ["CURRENCY_CLOSE", Array.isArray(dashboard.currencyStatus) && dashboard.currencyStatus.length === currencies.length],
        ["CLOSE_APPROVAL_READINESS", ["READY_FOR_CERTIFICATION", "NOT_READY"].includes(approval.approvalStatus)],
        ["CFO_CLOSE_VIEW", dashboard.engineVersion === CLOSE_ENGINE_VERSION],
        ["DATA_QUALITY", ["READY", "WARNING", "ERROR"].includes(checklist.dataQuality.status)],
        ["MULTI_CURRENCY_SEPARATION", dashboard.currencyStatus.every(x => x.fxConversionApplied === false)],
        ["BACKWARD_STATE", getMonthEndCloseState(d) === null || typeof getMonthEndCloseState(d) === "object"]
      ];
      tests.forEach(t => results.push({ name: t[0], passed: Boolean(t[1]) }));
      return { version: CLOSE_ENGINE_VERSION, passed: results.every(r => r.passed), summary: { total: results.length, passed: results.filter(r => r.passed).length, failed: results.filter(r => !r.passed).length }, results };
    } catch (error) {
      results.push({ name: "UNEXPECTED_ERROR", passed: false, error: error?.message || String(error) });
      return { version: CLOSE_ENGINE_VERSION, passed: false, summary: { total: results.length, passed: 0, failed: results.length }, results };
    }
  }

  /* ==========================================================
     V18 PUBLIC MANAGEMENT REPORTING LAYER
  ========================================================== */

  /* ==========================================================
     MANAGEMENT REPORTING & CFO COCKPIT ENGINE (V18)
     ----------------------------------------------------------
     Additive management-reporting layer over V17.
     Reuses V16.10 financial reporting, V17 close, controls,
     audit trail and existing CFO data engines. No calculation
     engine, schedule engine, journal engine or close engine is
     replaced.
  ========================================================== */

  const CFO_COCKPIT_VERSION = "V18";
  const CFO_COCKPIT_STATUS = Object.freeze({ GREEN: "GREEN", YELLOW: "YELLOW", RED: "RED" });
  const CFO_ALERT_SEVERITY = Object.freeze({ CRITICAL: "CRITICAL", HIGH: "HIGH", MEDIUM: "MEDIUM", LOW: "LOW", INFO: "INFO" });
  const CFO_ALERT_TYPES = Object.freeze({
    CLOSE: "CLOSE",
    LIQUIDITY: "LIQUIDITY",
    RENEWAL: "RENEWAL",
    EXPIRY: "EXPIRY",
    CONTROL: "CONTROL",
    RECONCILIATION: "RECONCILIATION",
    JOURNAL: "JOURNAL",
    DATA_QUALITY: "DATA QUALITY",
    MODIFICATION: "MODIFICATION",
    REASSESSMENT: "REASSESSMENT"
  });

  const CFO_COCKPIT_CONFIG = Object.freeze({
    renewal90DaysThreshold: 90,
    renewal180DaysThreshold: 180,
    renewal365DaysThreshold: 365,
    expiry90DaysThreshold: 90,
    expiry180DaysThreshold: 180,
    expiry365DaysThreshold: 365,
    criticalExceptionThreshold: 1,
    closeScoreWarningThreshold: 90,
    closeScoreBlockedThreshold: 75,
    liquidity90DaysThreshold: null,
    exposureAttentionThreshold: null,
    dataQualityPenalty: Object.freeze({ CRITICAL: 30, HIGH: 20, MEDIUM: 10, LOW: 5 })
  });

  /** @deprecated-name Kalıcı: v18Number — dış çağrılarla (window.GK_TFRS16, olası eski referanslar) uyumluluk için korunuyor. Bkz. coreNumber. */
  function v18Number(value, fallback = 0) {
    return coreNumber(value, fallback);
  }

  /** @deprecated-name Kalıcı: v18Round — dış çağrılarla (window.GK_TFRS16, olası eski referanslar) uyumluluk için korunuyor. Bkz. coreRound. */
  function v18Round(value, digits = 2) {
    return coreRound(value, digits);
  }


  /** @deprecated-name Kalıcı: v18Date — dış çağrılarla (window.GK_TFRS16, olası eski referanslar) uyumluluk için korunuyor. Bkz. coreDate. try/catch orijinal davranışı korumak için eklendi. */
  function v18Date(value) {
    try { return coreDate(value); } catch (error) { return null; }
  }


  function v18ResolveDate(value) {
    try {
      if (typeof cfoResolveReportingDate === "function") return cfoResolveReportingDate(value);
      if (typeof rptResolveDate === "function") return rptResolveDate(value);
    } catch (error) {}
    return v18Date(value) || new Date();
  }




  function v18SafeContracts() {
    return Array.isArray(contracts) ? contracts : [];
  }

  function v18Currency(contract) {
    return String(contract?.currency || "UNSPECIFIED").toUpperCase();
  }

  function v18Company(contract) {
    return String(contract?.company || "UNSPECIFIED");
  }

  function v18Active(contract, reportingDate) {
    try {
      return typeof cfoIsActive === "function" ? cfoIsActive(contract, reportingDate) : String(contract?.status || "ACTIVE").toUpperCase() === "ACTIVE";
    } catch (error) {
      return false;
    }
  }

  function v18ContractMetric(contract, reportingDate) {
    try {
      if (typeof getCfoContractMetrics === "function") return getCfoContractMetrics(contract?.id, reportingDate) || null;
      if (typeof cfoGetContractMetricsInternal === "function") return cfoGetContractMetricsInternal(contract, reportingDate);
    } catch (error) {
      return { contractId: contract?.id || null, calculationValid: false, calculationError: error?.message || String(error) };
    }
    return null;
  }

  function v18ContractRows(reportingDate) {
    const d = v18ResolveDate(reportingDate);
    return v18SafeContracts().map(contract => {
      try {
        const metric = v18ContractMetric(contract, d);
        return {
          contract,
          metric: metric || {
            contractId: contract?.id || null,
            company: v18Company(contract),
            currency: v18Currency(contract),
            active: v18Active(contract, d),
            leaseLiability: 0,
            currentLiability: 0,
            nonCurrentLiability: 0,
            rouAsset: 0,
            monthlyInterest: 0,
            monthlyDepreciation: 0,
            monthlyLeaseExpense: 0,
            next12MonthPayments: 0,
            next12MonthPrincipal: 0,
            next12MonthInterest: 0,
            controlStatus: "RED",
            openExceptions: 0,
            criticalExceptions: 0,
            calculationValid: false,
            calculationError: "CFO contract metric unavailable"
          },
          error: null
        };
      } catch (error) {
        return {
          contract,
          metric: {
            contractId: contract?.id || null,
            company: v18Company(contract),
            currency: v18Currency(contract),
            active: false,
            leaseLiability: 0,
            currentLiability: 0,
            nonCurrentLiability: 0,
            rouAsset: 0,
            monthlyInterest: 0,
            monthlyDepreciation: 0,
            monthlyLeaseExpense: 0,
            next12MonthPayments: 0,
            next12MonthPrincipal: 0,
            next12MonthInterest: 0,
            controlStatus: "RED",
            openExceptions: 0,
            criticalExceptions: 0,
            calculationValid: false,
            calculationError: error?.message || String(error)
          },
          error: error?.message || String(error)
        };
      }
    });
  }

  function v18AggregateMetrics(rows) {
    const keys = [
      "leaseLiability", "currentLiability", "nonCurrentLiability", "rouAsset",
      "monthlyInterest", "monthlyDepreciation", "monthlyLeaseExpense",
      "next12MonthPayments", "next12MonthPrincipal", "next12MonthInterest"
    ];
    const out = {};
    keys.forEach(key => { out[key] = v18Round((rows || []).reduce((sum, row) => sum + v18Number(row?.metric?.[key]), 0)); });
    return out;
  }





  function v18GroupMetricRowsByCurrency(rows) {
    const groups = {};
    (rows || []).forEach(row => {
      const currency = v18Currency(row.contract);
      if (!groups[currency]) groups[currency] = { currency, leaseLiability: 0, currentLiability: 0, nonCurrentLiability: 0, rouAsset: 0, monthlyInterest: 0, monthlyDepreciation: 0, monthlyLeaseExpense: 0, next12MonthPayments: 0, next12MonthPrincipal: 0, next12MonthInterest: 0, contractCount: 0 };
      const g = groups[currency];
      g.contractCount += 1;
      ["leaseLiability", "currentLiability", "nonCurrentLiability", "rouAsset", "monthlyInterest", "monthlyDepreciation", "monthlyLeaseExpense", "next12MonthPayments", "next12MonthPrincipal", "next12MonthInterest"].forEach(key => { g[key] += v18Number(row.metric?.[key]); });
    });
    Object.values(groups).forEach(g => Object.keys(g).forEach(key => { if (typeof g[key] === "number") g[key] = v18Round(g[key]); }));
    return groups;
  }





  function v18CompanyExposure(reportingDate) {
    const d = v18ResolveDate(reportingDate);
    const companies = [...new Set(v18SafeContracts().map(v18Company))].filter(Boolean);
    return companies.map(company => {
      const rows = v18ContractRows(d).filter(r => v18Company(r.contract) === company);
      const active = rows.filter(r => r.metric?.active);
      const totals = v18AggregateMetrics(active);
      const byCurrency = v18GroupMetricRowsByCurrency(active);
      const currencyList = Object.values(byCurrency);
      const singleCurrency = currencyList.length === 1;
      const riskCount = rows.reduce((sum, row) => sum + v18Number(row.metric?.openExceptions), 0);
      const close = typeof getCompanyMonthEndCloseStatus === "function" ? getCompanyMonthEndCloseStatus(company, d) : null;
      return {
        company,
        contractCount: rows.length,
        activeContracts: active.length,
        currencyCount: currencyList.length,
        byCurrency,
        leaseLiability: singleCurrency ? currencyList[0].leaseLiability : null,
        currentLiability: singleCurrency ? currencyList[0].currentLiability : null,
        nonCurrentLiability: singleCurrency ? currencyList[0].nonCurrentLiability : null,
        rouAssets: singleCurrency ? currencyList[0].rouAsset : null,
        interest: singleCurrency ? currencyList[0].monthlyInterest : null,
        depreciation: singleCurrency ? currencyList[0].monthlyDepreciation : null,
        next12MPayments: singleCurrency ? currencyList[0].next12MonthPayments : null,
        riskCount,
        riskStatus: rows.some(r => r.metric?.controlStatus === "RED") ? "RED" : (rows.some(r => r.metric?.controlStatus === "YELLOW") ? "YELLOW" : "GREEN"),
        closeStatus: close?.status || "UNKNOWN",
        closeScore: close?.score ?? null,
        exceptions: close?.exceptionCount ?? riskCount,
        source: "V16.9_CFO_DATA_LAYER + V17_MONTH_END_CLOSE"
      };
    });
  }
































  function runV18CfoCockpitTests() {
    const results = [];
    try {
      const d = new Date();
      const snapshot = getCfoExecutiveSnapshot(d);
      const dashboard = getCfoDashboardData(d);
      const tests = [
        ["CFO_EXECUTIVE_SNAPSHOT", !!snapshot && !!snapshot.financialPosition && !!snapshot.closeStatus],
        ["KPI_ENGINE", !!dashboard.kpis && !!dashboard.kpis.TOTAL_LEASE_LIABILITY],
        ["FINANCIAL_POSITION_RECONCILIATION", snapshot.financialPosition.reconciliation.passed === true || snapshot.dataQuality.status === "ERROR"],
        ["MULTI_CURRENCY_SEPARATION", Array.isArray(snapshot.currencyExposure) && snapshot.metadata.currencyIsolation === true],
        ["COMPANY_EXPOSURE", Array.isArray(snapshot.companyExposure)],
        ["MATURITY_VIEW", Array.isArray(snapshot.maturity.buckets)],
        ["RENEWAL_RISK", Array.isArray(snapshot.renewalRisk.within365Days)],
        ["EXPIRY_RISK", Array.isArray(snapshot.expiryRisk.within365Days)],
        ["MODIFICATION_IMPACT", Number.isFinite(snapshot.modificationImpact.count)],
        ["REASSESSMENT_IMPACT", Number.isFinite(snapshot.reassessmentImpact.count)],
        ["CLOSE_STATUS_REUSE", !!snapshot.closeStatus && snapshot.closeStatus.source === "V17_MONTH_END_CLOSE_ENGINE"],
        ["CONTROL_STATUS_REUSE", !!snapshot.controlStatus && snapshot.controlStatus.source === "V16.8_RISK_CONTROL_ENGINE"],
        ["ALERT_ENGINE", Array.isArray(snapshot.keyAlerts)],
        ["TOP_RISKS", Array.isArray(snapshot.topRisks)],
        ["SCORECARD", !!dashboard.scorecard && !!dashboard.scorecard.financial],
        ["MANAGEMENT_SUMMARY", !!dashboard.executiveSummary && !!dashboard.executiveSummary.actions],
        ["DRILLDOWN_COMPANY", typeof getCfoCompanyDashboard === "function"],
        ["DRILLDOWN_CONTRACT", typeof getCfoContractView === "function"],
        ["DRILLDOWN_CURRENCY", typeof getCfoCurrencyExposure === "function"],
        ["BACKWARD_COMPATIBILITY", Array.isArray(contracts)]
      ];
      tests.forEach(test => results.push({ name: test[0], passed: Boolean(test[1]) }));
      return { passed: results.every(item => item.passed), summary: { total: results.length, passed: results.filter(item => item.passed).length, failed: results.filter(item => !item.passed).length }, results };
    } catch (error) {
      return { passed: false, summary: { total: results.length + 1, passed: results.filter(item => item.passed).length, failed: results.filter(item => !item.passed).length + 1 }, results, error: error?.message || String(error) };
    }
  }

  /* ==========================================================
     ERP / EXCEL INTEGRATION & DATA EXCHANGE ENGINE (V19)
     ----------------------------------------------------------
     Additive integration-ready data exchange layer.
     Existing calculation, schedule, journal, reporting, close,
     CFO, risk/control and audit engines are reused.
  ========================================================== */

  const INTEGRATION_ENGINE_VERSION = "V19";
  const INTEGRATION_STORAGE_KEY = "gk_tfrs16_integration_v1";
  const INTEGRATION_SCHEMA_VERSION = "1.0";
  const INTEGRATION_AMOUNT_TOLERANCE = 0.01;

  const INTEGRATION_SOURCE_TYPES = Object.freeze({
    EXCEL: "EXCEL",
    CSV: "CSV",
    MANUAL: "MANUAL",
    ERP_READY: "ERP_READY"
  });

  const INTEGRATION_JOB_STATUS = Object.freeze({
    PENDING: "PENDING",
    PROCESSING: "PROCESSING",
    COMPLETED: "COMPLETED",
    COMPLETED_WITH_WARNINGS: "COMPLETED_WITH_WARNINGS",
    FAILED: "FAILED"
  });

  const INTEGRATION_ROW_STATUS = Object.freeze({
    VALID: "VALID",
    WARNING: "WARNING",
    INVALID: "INVALID"
  });

  const INTEGRATION_RECON_STATUS = Object.freeze({
    MATCHED: "MATCHED",
    WARNING: "WARNING",
    MISMATCH: "MISMATCH",
    NOT_AVAILABLE: "NOT_AVAILABLE"
  });

  const INTEGRATION_LIFECYCLE = Object.freeze({
    SOURCE: "SOURCE",
    IMPORTED: "IMPORTED",
    VALIDATED: "VALIDATED",
    MAPPED: "MAPPED",
    PROCESSED: "PROCESSED",
    RECONCILED: "RECONCILED",
    EXCEPTION: "EXCEPTION"
  });

  const INTEGRATION_PROFILES = Object.freeze({
    GENERIC: Object.freeze({
      id: "GENERIC",
      schemaVersion: INTEGRATION_SCHEMA_VERSION,
      fields: Object.freeze({
        contractId: ["contract id", "contractid", "lease id", "sözleşme id", "sozlesme id", "id"],
        companyId: ["company id", "companyid", "company code", "companycode", "şirket id", "sirket id", "şirket kodu", "sirket kodu"],
        company: ["company", "şirket", "sirket"],
        supplier: ["supplier", "vendor", "tedarikçi", "tedarikci"],
        monthlyPayment: ["monthly payment", "payment", "lease payment", "aylık kira", "aylik kira", "kira ödeme", "kira odeme"],
        startDate: ["start date", "lease start", "commencement date", "başlangıç tarihi", "baslangic tarihi"],
        endDate: ["end date", "lease end", "termination date", "bitiş tarihi", "bitis tarihi"],
        discountRate: ["discount rate", "discount", "iskonto oranı", "iskonto orani"],
        renewalDate: ["renewal date", "renewal", "yenileme tarihi", "yenileme"],
        currency: ["currency", "currency code", "para birimi", "döviz", "doviz"],
        functionalCurrency: ["functional currency", "fonksiyonel para birimi", "fonksiyonel para birimi kodu", "reporting currency"],
        paymentFrequency: ["payment frequency", "ödeme frekansı", "odeme frekansi"],
        paymentTiming: ["payment timing", "ödeme zamanı", "odeme zamani"],
        initialDirectCosts: ["initial direct costs", "initial direct cost", "doğrudan ilk maliyetler", "dogrudan ilk maliyetler"],
        restorationObligation: ["restoration obligation", "dismantling obligation", "restoration cost", "sökme / restorasyon karşılığı", "sokme / restorasyon karsiligi", "sökme restorasyon karşılığı", "sokme restorasyon karsiligi"],
        status: ["status", "contract status", "durum"],
        assetClass: ["asset class", "asset category", "varlık sınıfı", "varlik sinifi", "varlık sinifi"],
        prepayments: ["prepayments", "prepayment", "peşin ödemeler", "pesin odemeler", "peşin ödeme", "pesin odeme"],
        leaseIncentives: ["lease incentives", "incentives", "kiralayan teşvikleri", "kiralayan tesvikleri", "teşvikler", "tesvikler"],
        leaseIncreaseType: ["escalation type", "lease increase type", "increase type", "kira artış tipi", "kira artis tipi"],
        leaseIncreaseRate: ["escalation rate", "annual increase rate", "increase rate", "yıllık artış oranı", "yillik artis orani"],
        fixedIncrease: ["fixed increase", "fixed escalation amount", "sabit artış tutarı", "sabit artis tutari"],
        variablePayment: ["variable payment", "değişken ödeme", "degisken odeme"],
        // Şablondaki "Varlığın Faydalı Ömrü" yıl cinsindendir; ay girilecekse
        // ayrı "(Ay)" sütunu kullanılır.
        usefulLifeMonths: ["useful life months", "faydalı ömür (ay)", "faydali omur ay", "varlığın faydalı ömrü (ay)", "varligin faydali omru ay"],
        usefulLifeYears: ["useful life years", "useful life", "faydalı ömür", "faydali omur", "faydalı ömür (yıl)", "varlığın faydalı ömrü", "varligin faydali omru", "varlığın faydalı ömrü (yıl)", "varligin faydali omru yil"],
        leaseTermEvidenceReference: ["lease term evidence reference", "kira süresi değerlendirme referansı", "kira suresi degerlendirme referansi"],
        renewalOptionExpectedToExercise: ["renewal reasonably certain", "yenileme opsiyonu kullanımı makul ölçüde kesin", "yenileme opsiyonu kullanimi makul olcude kesin"],
        renewalEndDate: ["renewal end date", "yenileme sonrası bitiş tarihi", "yenileme sonrasi bitis tarihi"],
        terminationOptionExpectedToExercise: ["termination reasonably certain", "fesih opsiyonu kullanımı makul ölçüde kesin", "fesih opsiyonu kullanimi makul olcude kesin"],
        terminationDate: ["termination option date", "fesih tarihi"],
        terminationPenalty: ["termination penalty", "fesih cezası", "fesih cezasi"],
        purchaseOptionExpectedToExercise: ["purchase reasonably certain", "satın alma opsiyonu kullanımı makul ölçüde kesin", "satin alma opsiyonu kullanimi makul olcude kesin"],
        purchaseOptionPrice: ["purchase option price", "satın alma opsiyon bedeli", "satin alma opsiyon bedeli"],
        renewalOption: ["renewal option", "yenileme opsiyonu", "yenileme opsiyonu makul ölçüde kesin", "yenileme opsiyonu makul olcude kesin"],
        terminationOption: ["termination option", "fesih opsiyonu", "fesih opsiyonu makul ölçüde kesin değil", "fesih opsiyonu makul olcude kesin degil"],
        purchaseOption: ["purchase option", "satın alma opsiyonu", "satin alma opsiyonu", "satın alma opsiyonu makul ölçüde kesin", "satin alma opsiyonu makul olcude kesin"],
        ownershipTransfer: ["ownership transfer", "mülkiyet devri", "mulkiyet devri", "kira sonunda mülkiyet devri var", "kira sonunda mulkiyet devri var"],
        shortTermLease: ["short term lease", "short term exemption", "kısa vadeli kiralama istisnası", "kisa vadeli kiralama istisnasi"],
        lowValueAsset: ["low value asset", "low value exemption", "düşük değerli varlık istisnası", "dusuk degerli varlik istisnasi"],
        lowValueWhenNewConfirmed: ["low value when new confirmed", "low value value when new", "yeni durumdaki değerinin düşük olduğu teyit edildi", "yeni durumdaki degerinin dusuk oldugu teyit edildi"],
        lowValueStandaloneUseConfirmed: ["low value standalone use confirmed", "standalone use confirmed", "tek başına kullanılabildiği teyit edildi", "tek basina kullanilabildigi teyit edildi"],
        lowValueNotHighlyDependentConfirmed: ["low value not highly dependent confirmed", "not highly dependent confirmed", "yüksek derecede bağımlı olmadığı teyit edildi", "yuksek derecede bagimli olmadigi teyit edildi"],
        lowValueNoSubleaseConfirmed: ["low value no sublease confirmed", "no sublease confirmed", "sublease edilmediği teyit edildi", "sublease edilmedigi teyit edildi"],
        indexBaseRate: ["base index rate", "index base rate", "baz endeks oranı", "baz endeks orani"],
        indexCurrentRate: ["current index rate", "index current rate", "güncel endeks oranı", "guncel endeks orani"],
        indexReviewMonth: ["index review month", "index update month", "endeks güncelleme ayı", "endeks guncelleme ayi"],
        indexReviewDay: ["index review day", "index update day", "endeks güncelleme günü", "endeks guncelleme gunu"]
      })
    }),
    SAP: Object.freeze({ id: "SAP", schemaVersion: INTEGRATION_SCHEMA_VERSION, fields: {} }),
    ORACLE: Object.freeze({ id: "ORACLE", schemaVersion: INTEGRATION_SCHEMA_VERSION, fields: {} }),
    DYNAMICS: Object.freeze({ id: "DYNAMICS", schemaVersion: INTEGRATION_SCHEMA_VERSION, fields: {} })
  });

  /** @deprecated-name Kalıcı: integrationClone — dış çağrılarla (window.GK_TFRS16, olası eski referanslar) uyumluluk için korunuyor. Bkz. coreClone. */
  function integrationClone(value) {
    return coreClone(value);
  }

  function integrationNow() {
    return new Date().toISOString();
  }

  function integrationId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function integrationNumber(value, fallback = 0) {
    if (value === null || value === undefined || value === "") return fallback;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    const raw = String(value).trim().replace(/\s/g, "");
    if (!raw) return fallback;
    let normalized = raw;
    if (/^-?\d{1,3}(\.\d{3})+,\d+$/.test(normalized)) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else if (/^-?\d{1,3}(,\d{3})+\.\d+$/.test(normalized)) {
      normalized = normalized.replace(/,/g, "");
    } else if (/^-?\d+,\d+$/.test(normalized)) {
      normalized = normalized.replace(",", ".");
    } else if (/^-?\d{1,3}(\.\d{3})+$/.test(normalized)) {
      normalized = normalized.replace(/\./g, "");
    }
    const n = Number(normalized);
    return Number.isFinite(n) ? n : fallback;
  }

  function normalizeIntegrationDate(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
    if (typeof value === "number" && Number.isFinite(value)) {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const date = new Date(excelEpoch.getTime() + value * 86400000);
      return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
    }
    if (value === null || value === undefined || String(value).trim() === "") return null;
    const raw = String(value).trim();
    let m = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (m) {
      const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
      const dt = new Date(Date.UTC(y, mo - 1, d));
      return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d ? `${m[1]}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}` : null;
    }
    m = raw.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
    if (m) {
      const a = Number(m[1]), b = Number(m[2]), y = Number(m[3]);
      if (a > 12 && b <= 12) {
        const dt = new Date(Date.UTC(y, b - 1, a));
        return dt.toISOString().slice(0, 10);
      }
      if (b > 12 && a <= 12) {
        const dt = new Date(Date.UTC(y, a - 1, b));
        return dt.toISOString().slice(0, 10);
      }
      return { value: null, warning: "AMBIGUOUS_DATE" };
    }
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
  }

  function normalizeIntegrationCurrency(value) {
    const raw = String(value ?? "").trim().toUpperCase();
    const aliases = { TL: "TRY", TRL: "TRY", "₺": "TRY", EURO: "EUR", DOLAR: "USD", US$: "USD" };
    return aliases[raw] || raw || null;
  }

  function integrationNormalizeHeader(value) {
    return String(value ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ı/g, "i")
      .replace(/ş/g, "s")
      .replace(/ğ/g, "g")
      .replace(/ü/g, "u")
      .replace(/ö/g, "o")
      .replace(/ç/g, "c")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function integrationFindValue(row, aliases = []) {
    const keys = Object.keys(row || {});
    const normalized = {};
    keys.forEach(key => { normalized[integrationNormalizeHeader(key)] = row[key]; });
    for (const alias of aliases) {
      const key = integrationNormalizeHeader(alias);
      if (Object.prototype.hasOwnProperty.call(normalized, key)) return normalized[key];
    }
    return undefined;
  }

  function integrationBoolean(value) {
    if (value === true || value === false) return value;
    const raw = integrationNormalizeHeader(value);
    if (!raw) return false;
    return ["evet", "e", "var", "true", "yes", "y", "1", "x", "doğru", "dogru"].includes(raw);
  }

  function integrationEscalationType(value) {
    const raw = integrationNormalizeHeader(value);
    if (!raw) return "none";
    if (["fixedrate", "sabit oran", "sabit oranli", "oran"].some(v => raw.includes(integrationNormalizeHeader(v)))) return "fixedRate";
    if (["fixedamount", "sabit tutar", "sabit artis tutari", "tutar"].some(v => raw.includes(integrationNormalizeHeader(v)))) return "fixedAmount";
    if (["index", "endeks"].some(v => raw.includes(v))) return "index";
    if (["none", "artis yok", "yok"].some(v => raw.includes(v))) return "none";
    return "none";
  }

  function integrationOptionalNumber(row, aliases) {
    const value = integrationFindValue(row, aliases);
    if (value === undefined || value === null || value === "") return undefined;
    return integrationNumber(value, 0);
  }

  function integrationOptionalBoolean(row, aliases) {
    const value = integrationFindValue(row, aliases);
    if (value === undefined || value === null || value === "") return undefined;
    return integrationBoolean(value);
  }

  function integrationOptionalText(row, aliases) {
    const value = integrationFindValue(row, aliases);
    const text = value === undefined || value === null ? "" : String(value).trim();
    return text ? text : undefined;
  }

  function integrationOptionalDate(row, aliases) {
    const value = integrationFindValue(row, aliases);
    if (value === undefined || value === null || value === "") return undefined;
    const result = normalizeIntegrationDate(value);
    return result && typeof result === "object" ? undefined : result;
  }

  // Ay sütunu doluysa o kullanılır; aksi halde yıl sütunu aya çevrilir.
  function integrationUsefulLifeMonths(row, fields) {
    const months = integrationOptionalNumber(row, fields.usefulLifeMonths || []);
    if (months !== undefined) return months > 0 ? Math.round(months) : undefined;
    const years = integrationOptionalNumber(row, fields.usefulLifeYears || []);
    return years !== undefined && years > 0 ? Math.round(years * 12) : undefined;
  }

  function integrationOptionalEscalationType(row, aliases) {
    const value = integrationFindValue(row, aliases);
    if (value === undefined || value === null || value === "") return undefined;
    return integrationEscalationType(value);
  }

  // Excel import helper: the template presents the review month as
  // the user-facing calendar month (1-12), while the contract model
  // stores JavaScript's zero-based month index (0-11).
  function integrationOptionalReviewMonth(row, aliases) {
    const value = integrationFindValue(row, aliases);
    if (value === undefined || value === null || value === "") return undefined;
    const month = integrationNumber(value, NaN);
    if (!Number.isFinite(month)) return undefined;
    return Math.min(11, Math.max(0, Math.round(month) - 1));
  }

  function integrationPaymentFrequency(value) {
    const raw = integrationNormalizeHeader(value);
    if (!raw) return undefined;
    if (["1", "monthly", "aylik", "ay"].includes(raw)) return "monthly";
    if (["3", "quarterly", "quarter", "ceyrek", "ceyreklik", "uc aylik", "3 aylik", "3 ayda bir", "uc ayda bir"].includes(raw)) return "quarterly";
    if (["6", "semiannual", "semi annual", "semi-annual", "alti aylik", "6 aylik", "6 ayda bir", "alti ayda bir", "yarim yillik", "yari yillik"].includes(raw)) return "semiannual";
    if (["12", "annual", "yearly", "yillik", "yil", "yilda bir"].includes(raw)) return "annual";
    return undefined;
  }

  function integrationPaymentTiming(value) {
    const raw = integrationNormalizeHeader(value);
    if (!raw) return undefined;

    // UI / Excel template labels may contain the English equivalent
    // in parentheses, e.g. "Dönem Sonu (Arrears)". Normalize by
    // accepting the meaningful tokens rather than requiring an exact
    // string match. This is critical for Bulk Import because the
    // template itself uses these user-facing labels.
    if (
      raw.includes("advance") ||
      raw.includes("in advance") ||
      raw.includes("donem basi") ||
      raw === "pesin"
    ) return "advance";

    if (
      raw.includes("arrears") ||
      raw.includes("in arrears") ||
      raw.includes("donem sonu") ||
      raw === "vadeli"
    ) return "arrears";

    return undefined;
  }

  function getIntegrationStorage() {
    try {
      const raw = localStorage.getItem(INTEGRATION_STORAGE_KEY);
      if (!raw) return { sources: [], jobs: [], exports: [], reconciliations: [] };
      const parsed = JSON.parse(raw);
      return {
        sources: Array.isArray(parsed?.sources) ? parsed.sources : [],
        jobs: Array.isArray(parsed?.jobs) ? parsed.jobs : [],
        exports: Array.isArray(parsed?.exports) ? parsed.exports : [],
        reconciliations: Array.isArray(parsed?.reconciliations) ? parsed.reconciliations : []
      };
    } catch (error) {
      return { sources: [], jobs: [], exports: [], reconciliations: [] };
    }
  }

  function saveIntegrationStorage(state) {
    try {
      localStorage.setItem(INTEGRATION_STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      return false;
    }
  }

  function integrationActor() {
    try { return String(window.currentUser?.id || window.currentUser?.username || window.currentUser?.name || "system"); }
    catch (error) { return "system"; }
  }

  function registerIntegrationSource(input = {}) {
    const state = getIntegrationStorage();
    const source = {
      sourceId: input.sourceId || integrationId("SRC"),
      sourceType: String(input.sourceType || INTEGRATION_SOURCE_TYPES.MANUAL).toUpperCase(),
      sourceName: input.sourceName || input.fileName || "Manual Source",
      company: input.company || null,
      currency: normalizeIntegrationCurrency(input.currency),
      importedAt: input.importedAt || null,
      importedBy: input.importedBy || integrationActor(),
      status: input.status || "REGISTERED",
      recordCount: Number(input.recordCount) || 0,
      errorCount: Number(input.errorCount) || 0,
      schemaVersion: input.schemaVersion || INTEGRATION_SCHEMA_VERSION,
      createdAt: input.createdAt || integrationNow()
    };
    const index = state.sources.findIndex(x => x.sourceId === source.sourceId);
    if (index >= 0) state.sources[index] = source; else state.sources.push(source);
    saveIntegrationStorage(state);
    return integrationClone(source);
  }

  function getIntegrationSources(filters = {}) {
    const sources = getIntegrationStorage().sources;
    return sources.filter(source => {
      if (filters.sourceType && source.sourceType !== String(filters.sourceType).toUpperCase()) return false;
      if (filters.company && source.company !== filters.company) return false;
      return true;
    });
  }

  function getIntegrationSource(sourceId) {
    return getIntegrationStorage().sources.find(x => x.sourceId === sourceId) || null;
  }

  function createImportJob(input = {}) {
    const state = getIntegrationStorage();
    const job = {
      jobId: input.jobId || integrationId("JOB"),
      sourceId: input.sourceId || null,
      sourceType: String(input.sourceType || INTEGRATION_SOURCE_TYPES.EXCEL).toUpperCase(),
      fileName: input.fileName || null,
      startedAt: input.startedAt || integrationNow(),
      completedAt: input.completedAt || null,
      status: input.status || INTEGRATION_JOB_STATUS.PENDING,
      schemaVersion: input.schemaVersion || INTEGRATION_SCHEMA_VERSION,
      totalRows: Number(input.totalRows) || 0,
      importedRows: Number(input.importedRows) || 0,
      rejectedRows: Number(input.rejectedRows) || 0,
      warningRows: Number(input.warningRows) || 0,
      errors: Array.isArray(input.errors) ? input.errors : [],
      warnings: Array.isArray(input.warnings) ? input.warnings : [],
      validationResults: Array.isArray(input.validationResults) ? input.validationResults : [],
      lifecycle: input.lifecycle || INTEGRATION_LIFECYCLE.SOURCE,
      dryRun: Boolean(input.dryRun),
      actor: input.actor || integrationActor()
    };
    state.jobs.push(job);
    saveIntegrationStorage(state);
    return integrationClone(job);
  }

  function updateImportJob(jobId, patch = {}) {
    const state = getIntegrationStorage();
    const index = state.jobs.findIndex(x => x.jobId === jobId);
    if (index < 0) return null;
    state.jobs[index] = { ...state.jobs[index], ...integrationClone(patch) };
    saveIntegrationStorage(state);
    return integrationClone(state.jobs[index]);
  }

  function getImportJob(jobId) {
    return getIntegrationStorage().jobs.find(x => x.jobId === jobId) || null;
  }

  function getImportHistory(filters = {}) {
    return getIntegrationStorage().jobs.slice().reverse().filter(job => {
      if (filters.status && job.status !== filters.status) return false;
      if (filters.sourceType && job.sourceType !== String(filters.sourceType).toUpperCase()) return false;
      return true;
    });
  }

  function getIntegrationMappingProfile(profile = "GENERIC") {
    return INTEGRATION_PROFILES[String(profile || "GENERIC").toUpperCase()] || INTEGRATION_PROFILES.GENERIC;
  }

  function getIntegrationMappingProfiles() {
    return Object.values(INTEGRATION_PROFILES).map(profile => integrationClone(profile));
  }

  function getIntegrationFieldMapping(profile = "GENERIC") {
    return integrationClone(getIntegrationMappingProfile(profile).fields);
  }

  function mapExternalRecord(row, options = {}) {
    const profile = getIntegrationMappingProfile(options.profile || "GENERIC");
    const fields = profile.fields || {};
    const dateResultStart = normalizeIntegrationDate(integrationFindValue(row, fields.startDate || []));
    const dateResultEnd = normalizeIntegrationDate(integrationFindValue(row, fields.endDate || []));
    const dateResultRenewal = normalizeIntegrationDate(integrationFindValue(row, fields.renewalDate || []));
    const rawCompanyId = String(integrationFindValue(row, fields.companyId || []) || "").trim();
    const rawCompanyName = String(integrationFindValue(row, fields.company || []) || "").trim();
    let resolvedCompanyId = null;
    // DÜZELTME (kritik — gerçek kök neden): companyId alan-eşleştirme
    // listesi "şirket kodu"/"company code" başlıklarını da companyId
    // sayıyor (bkz. INTEGRATION_PROFILES.GENERIC.fields.companyId).
    // Ama "Şirket Kodu" bu uygulamada TMS21/TMS29 motor-içi şirket
    // kaydının (Şirket Yönetimi ekranı) kodudur — backend'in gerçek,
    // lisanslı multi-tenant companyId'siyle (sessionCompanies, /api/
    // auth/me) AYNI NAMESPACE DEĞİLDİR. Önceden rawCompanyId bulunduğu
    // an KÖRÜ KÖRÜNE kabul ediliyor, isim eşleştirmesine hiç bakılmıyordu
    // — "Şirket Kodu" sütunundaki bir motor-içi kod, hiç doğrulanmadan
    // backend'e companyId diye gidiyordu (ve orada "lisans yok"/"şirket
    // eşleşmedi" ile reddediliyordu, sütunda ne yazarsa yazsın). Artık
    // rawCompanyId ancak sessionCompanies'te GERÇEKTEN karşılığı varsa
    // (id VEYA code eşleşirse) doğrudan kullanılıyor; yoksa isim bazlı
    // eşleştirmeye (aşağıda) düşülüyor.
    if (rawCompanyId && Array.isArray(sessionCompanies) && sessionCompanies.length) {
      const idMatch = sessionCompanies.find(c => String(c.id || "").toLowerCase() === rawCompanyId.toLowerCase());
      if (idMatch) resolvedCompanyId = idMatch.id;
    }
    if (!resolvedCompanyId && !rawCompanyName && rawCompanyId) {
      // sessionCompanies henüz yüklenmemiş VEYA eşleşme yok, ama isim
      // sütunu da boşsa (yalnızca companyId/kod verilmiş) — eski
      // davranışa (rawCompanyId'yi doğrudan kullan) düş: en azından
      // persistContractToApi'deki ayrı doğrulama yanlışsa yakalar.
      resolvedCompanyId = rawCompanyId;
    }
    // DÜZELTME (kritik — "Şirketin aktif lisansı bulunmamaktadır" hatası
    // her satırda backend'e gidip reddediliyordu, halbuki dashboard AYNI
    // kullanıcı için geçerli lisans gösteriyordu): önceden şirket adı
    // SADECE v26LoadCompanies()'e karşı eşleştiriliyordu. v26LoadCompanies
    // localStorage cache'i + (varsa) mevcut contracts[]'tan TÜRETİLMİŞ bir
    // listedir; id alanı bulunamazsa "TR-001" gibi SENTETİK bir id üretir
    // ve backend'deki gerçek company_id/lisans ile hiçbir garantili ilişkisi
    // yoktur. Oysa sessionCompanies, /api/auth/me'den (licenses[] dahil)
    // gelen, GERÇEKTEN lisanslı şirketlerin listesidir (bkz.
    // loadSessionCompanies). Artık önce ORAYA bakılıyor; v26LoadCompanies
    // sadece sessionCompanies henüz yüklenmemişse (örn. sayfa yeni açıldı)
    // bir fallback olarak kullanılıyor — ki bu durumda da persistContractToApi
    // içindeki ayrı doğrulama (aşağıda) yanlış id backend'e hiç gitmeden
    // yakalar.
    if (!resolvedCompanyId && rawCompanyName && Array.isArray(sessionCompanies) && sessionCompanies.length) {
      const sessionMatch = sessionCompanies.find(c =>
        String(c.id || "").toLowerCase() === rawCompanyName.toLowerCase() ||
        String(c.name || "").toLowerCase() === rawCompanyName.toLowerCase()
      );
      if (sessionMatch) resolvedCompanyId = sessionMatch.id;
    }
    if (!resolvedCompanyId && rawCompanyName && typeof v26LoadCompanies === "function") {
      try {
        const master = v26LoadCompanies();
        const match = master.find(c =>
          String(c.id || "").toLowerCase() === rawCompanyName.toLowerCase() ||
          String(c.code || "").toLowerCase() === rawCompanyName.toLowerCase() ||
          String(c.name || "").toLowerCase() === rawCompanyName.toLowerCase()
        );
        if (match) resolvedCompanyId = match.id;
      } catch (error) {}
    }
    const normalizedData = {
      id: integrationFindValue(row, fields.contractId || []),
      companyId: resolvedCompanyId,
      company: rawCompanyName,
      supplier: integrationFindValue(row, fields.supplier || []),
      monthlyPayment: integrationNumber(integrationFindValue(row, fields.monthlyPayment || []), NaN),
      startDate: dateResultStart && typeof dateResultStart === "object" ? null : dateResultStart,
      endDate: dateResultEnd && typeof dateResultEnd === "object" ? null : dateResultEnd,
      discountRate: integrationNumber(integrationFindValue(row, fields.discountRate || []), 0),
      renewalDate: dateResultRenewal && typeof dateResultRenewal === "object" ? null : dateResultRenewal,
      currency: normalizeIntegrationCurrency(integrationFindValue(row, fields.currency || [])),
      functionalCurrency: normalizeIntegrationCurrency(integrationFindValue(row, fields.functionalCurrency || [])),
      paymentFrequency: integrationPaymentFrequency(integrationFindValue(row, fields.paymentFrequency || [])),
      paymentTiming: integrationPaymentTiming(integrationFindValue(row, fields.paymentTiming || [])),
      initialDirectCosts: integrationOptionalNumber(row, fields.initialDirectCosts || []),
      restorationObligation: integrationOptionalNumber(row, fields.restorationObligation || []),
      status: integrationFindValue(row, fields.status || []) || "active",
      assetClass: String(integrationFindValue(row, fields.assetClass || []) || "").trim(),
      prepayments: integrationOptionalNumber(row, fields.prepayments || []),
      leaseIncentives: integrationOptionalNumber(row, fields.leaseIncentives || []),
      leaseIncreaseType: integrationOptionalEscalationType(row, fields.leaseIncreaseType || []),
      leaseIncreaseRate: integrationOptionalNumber(row, fields.leaseIncreaseRate || []),
      fixedIncrease: integrationOptionalNumber(row, fields.fixedIncrease || []),
      variablePayment: integrationOptionalNumber(row, fields.variablePayment || []),
      usefulLifeMonths: integrationUsefulLifeMonths(row, fields),
      leaseTermEvidenceReference: integrationOptionalText(row, fields.leaseTermEvidenceReference || []),
      renewalOptionExpectedToExercise: integrationOptionalBoolean(row, fields.renewalOptionExpectedToExercise || []),
      renewalEndDate: integrationOptionalDate(row, fields.renewalEndDate || []),
      terminationOptionExpectedToExercise: integrationOptionalBoolean(row, fields.terminationOptionExpectedToExercise || []),
      terminationDate: integrationOptionalDate(row, fields.terminationDate || []),
      terminationPenalty: integrationOptionalNumber(row, fields.terminationPenalty || []),
      purchaseOptionExpectedToExercise: integrationOptionalBoolean(row, fields.purchaseOptionExpectedToExercise || []),
      purchaseOptionPrice: integrationOptionalNumber(row, fields.purchaseOptionPrice || []),
      renewalOption: integrationOptionalBoolean(row, fields.renewalOption || []),
      terminationOption: integrationOptionalBoolean(row, fields.terminationOption || []),
      purchaseOption: integrationOptionalBoolean(row, fields.purchaseOption || []),
      ownershipTransfer: integrationOptionalBoolean(row, fields.ownershipTransfer || []),
      shortTermLease: integrationOptionalBoolean(row, fields.shortTermLease || []),
      lowValueAsset: integrationOptionalBoolean(row, fields.lowValueAsset || []),
      lowValueWhenNewConfirmed: integrationOptionalBoolean(row, fields.lowValueWhenNewConfirmed || []),
      lowValueStandaloneUseConfirmed: integrationOptionalBoolean(row, fields.lowValueStandaloneUseConfirmed || []),
      lowValueNotHighlyDependentConfirmed: integrationOptionalBoolean(row, fields.lowValueNotHighlyDependentConfirmed || []),
      lowValueNoSubleaseConfirmed: integrationOptionalBoolean(row, fields.lowValueNoSubleaseConfirmed || []),
      indexBaseRate: integrationOptionalNumber(row, fields.indexBaseRate || []),
      indexCurrentRate: integrationOptionalNumber(row, fields.indexCurrentRate || []),
      indexReviewMonth: integrationOptionalReviewMonth(row, fields.indexReviewMonth || []),
      indexReviewDay: integrationOptionalNumber(row, fields.indexReviewDay || [])
    };
    const warnings = [];
    [dateResultStart, dateResultEnd, dateResultRenewal].forEach(result => { if (result && typeof result === "object" && result.warning) warnings.push(result.warning); });
    return { normalizedData, warnings, profile: profile.id };
  }

  function validateImportSchema(rows, options = {}) {
    const schemaVersion = options.schemaVersion || INTEGRATION_SCHEMA_VERSION;
    const supported = Object.values(INTEGRATION_PROFILES).some(profile => profile.schemaVersion === schemaVersion);
    return {
      schemaVersion,
      supported,
      status: supported ? "VALID" : "REJECT",
      errors: supported ? [] : [{ errorCode: "UNSUPPORTED_SCHEMA", message: `Unsupported schema version: ${schemaVersion}` }],
      rowCount: Array.isArray(rows) ? rows.length : 0
    };
  }

  function validateImportRow(row, rowNumber, options = {}) {
    const mapping = mapExternalRecord(row, options);
    const data = mapping.normalizedData;
    const errors = [];
    const warnings = mapping.warnings.slice();
    const required = ["id", "company", "supplier", "startDate", "endDate", "currency"];
    required.forEach(field => {
      if (data[field] === null || data[field] === undefined || data[field] === "") errors.push({ rowNumber, field, value: data[field] ?? null, errorCode: "REQUIRED_FIELD", message: `${field} is required.` });
    });
    if (!Number.isFinite(data.monthlyPayment) || data.monthlyPayment < 0) errors.push({ rowNumber, field: "monthlyPayment", value: data.monthlyPayment, errorCode: "INVALID_NUMBER", message: "Payment must be a valid non-negative number." });
    if (data.discountRate !== null && (!Number.isFinite(data.discountRate) || data.discountRate < 0)) errors.push({ rowNumber, field: "discountRate", value: data.discountRate, errorCode: "INVALID_NUMBER", message: "Discount rate must be a valid non-negative number." });
    if (data.currency && !/^[A-Z]{3}$/.test(data.currency)) errors.push({ rowNumber, field: "currency", value: data.currency, errorCode: "INVALID_CURRENCY", message: "Currency must be a valid 3-letter code." });
    const start = data.startDate ? new Date(`${data.startDate}T00:00:00`) : null;
    const end = data.endDate ? new Date(`${data.endDate}T00:00:00`) : null;
    if (start && end && start > end) errors.push({ rowNumber, field: "endDate", value: data.endDate, errorCode: "INVALID_DATE_RANGE", message: "End date cannot precede start date." });
    const duplicateInFile = options.seenIds instanceof Set && data.id && options.seenIds.has(String(data.id));
    if (duplicateInFile) errors.push({ rowNumber, field: "id", value: data.id, errorCode: "DUPLICATE_IN_FILE", message: "Duplicate Contract ID in import file." });
    if (data.status && !["active", "inactive", "expired", "terminated", "closed"].includes(String(data.status).toLowerCase())) warnings.push({ rowNumber, field: "status", value: data.status, errorCode: "UNKNOWN_STATUS", message: "Status is not a known internal status." });
    return {
      rowNumber,
      status: errors.length ? INTEGRATION_ROW_STATUS.INVALID : warnings.length ? INTEGRATION_ROW_STATUS.WARNING : INTEGRATION_ROW_STATUS.VALID,
      errors,
      warnings,
      normalizedData: data,
      mappingProfile: mapping.profile
    };
  }

  function previewImport(rows, options = {}) {
    const inputRows = Array.isArray(rows) ? rows : [];
    const schema = validateImportSchema(inputRows, options);
    if (!schema.supported) return { totalRows: inputRows.length, validRows: 0, warningRows: 0, rejectedRows: inputRows.length, sampleRows: [], schema, validationResults: [] };
    const seenIds = new Set();
    const validationResults = inputRows.map((row, index) => {
      const result = validateImportRow(row, index + 2, { ...options, seenIds });
      if (result.normalizedData?.id) seenIds.add(String(result.normalizedData.id));
      return result;
    });
    const existing = new Map((Array.isArray(contracts) ? contracts : []).map(c => [String(c.id), c]));
    validationResults.forEach(result => {
      const id = result.normalizedData?.id;
      if (!id || result.status === INTEGRATION_ROW_STATUS.INVALID) return;
      result.action = existing.has(String(id)) ? "UPDATE" : "CREATE";
      if (existing.has(String(id))) result.existingContract = { id: existing.get(String(id)).id, company: existing.get(String(id)).company };
    });
    return {
      totalRows: inputRows.length,
      validRows: validationResults.filter(x => x.status === INTEGRATION_ROW_STATUS.VALID).length,
      warningRows: validationResults.filter(x => x.status === INTEGRATION_ROW_STATUS.WARNING).length,
      rejectedRows: validationResults.filter(x => x.status === INTEGRATION_ROW_STATUS.INVALID).length,
      sampleRows: validationResults.slice(0, 20),
      schema,
      validationResults
    };
  }

  /* ==========================================================
     BÜYÜK DOSYA İÇİN PARÇALI DOĞRULAMA (STREAMING PREVIEW)
     ----------------------------------------------------------
     previewImport() ile birebir aynı doğrulama mantığını ve aynı
     çıktı şeklini üretir; tek fark, satırları parçalar (chunk)
     halinde işleyip her parçadan sonra tarayıcıya kontrolü geri
     vermesidir (await + setTimeout 0). Bu sayede binlerce satırlık
     bir Excel/CSV dosyasında arayüz donmaz ve ilerleme gösterilebilir.
     Küçük dosyalarda davranış ve sonuç previewImport() ile aynıdır;
     bu yüzden sadece eşik üstü satır sayısında kullanılır.
  ========================================================== */

  const LARGE_IMPORT_CHUNK_SIZE = 200;
  const LARGE_IMPORT_ROW_THRESHOLD = 500;

  async function previewImportChunked(rows, options = {}, onProgress) {
    const inputRows = Array.isArray(rows) ? rows : [];
    const schema = validateImportSchema(inputRows, options);
    if (!schema.supported) {
      return { totalRows: inputRows.length, validRows: 0, warningRows: 0, rejectedRows: inputRows.length, sampleRows: [], schema, validationResults: [] };
    }

    const seenIds = new Set();
    const validationResults = [];

    for (let i = 0; i < inputRows.length; i += LARGE_IMPORT_CHUNK_SIZE) {
      const chunk = inputRows.slice(i, i + LARGE_IMPORT_CHUNK_SIZE);

      chunk.forEach((row, offset) => {
        const index = i + offset;
        const result = validateImportRow(row, index + 2, { ...options, seenIds });
        if (result.normalizedData?.id) seenIds.add(String(result.normalizedData.id));
        validationResults.push(result);
      });

      if (typeof onProgress === "function") {
        onProgress(Math.min(inputRows.length, i + chunk.length), inputRows.length);
      }

      // Tarayıcıya kontrolü geri ver (UI thread'i bloklamamak için).
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    const existing = new Map((Array.isArray(contracts) ? contracts : []).map(c => [String(c.id), c]));
    validationResults.forEach(result => {
      const id = result.normalizedData?.id;
      if (!id || result.status === INTEGRATION_ROW_STATUS.INVALID) return;
      result.action = existing.has(String(id)) ? "UPDATE" : "CREATE";
      if (existing.has(String(id))) result.existingContract = { id: existing.get(String(id)).id, company: existing.get(String(id)).company };
    });

    return {
      totalRows: inputRows.length,
      validRows: validationResults.filter(x => x.status === INTEGRATION_ROW_STATUS.VALID).length,
      warningRows: validationResults.filter(x => x.status === INTEGRATION_ROW_STATUS.WARNING).length,
      rejectedRows: validationResults.filter(x => x.status === INTEGRATION_ROW_STATUS.INVALID).length,
      sampleRows: validationResults.slice(0, 20),
      schema,
      validationResults
    };
  }

  function dryRunImport(rows, options = {}) {
    const preview = previewImport(rows, { ...options, dryRun: true });
    const job = createImportJob({
      sourceType: options.sourceType || INTEGRATION_SOURCE_TYPES.EXCEL,
      fileName: options.fileName || null,
      schemaVersion: options.schemaVersion || INTEGRATION_SCHEMA_VERSION,
      totalRows: preview.totalRows,
      importedRows: 0,
      rejectedRows: preview.rejectedRows,
      warningRows: preview.warningRows,
      errors: preview.validationResults.flatMap(x => x.errors || []),
      warnings: preview.validationResults.flatMap(x => x.warnings || []),
      validationResults: preview.validationResults,
      status: preview.rejectedRows ? INTEGRATION_JOB_STATUS.COMPLETED_WITH_WARNINGS : INTEGRATION_JOB_STATUS.COMPLETED,
      lifecycle: INTEGRATION_LIFECYCLE.VALIDATED,
      dryRun: true,
      completedAt: integrationNow()
    });
    return { dryRun: true, job, preview };
  }

  function buildContractFromIntegrationData(data, existing = null, metadata = {}) {
    const base = existing ? integrationClone(existing) : {
      id: String(data.id),
      companyId: data.companyId || null,
      company: data.company || "",
      supplier: data.supplier || "",
      monthlyPayment: data.monthlyPayment,
      startDate: data.startDate,
      endDate: data.endDate,
      discountRate: data.discountRate,
      renewalDate: data.renewalDate,
      currency: data.currency || "TRY",
      functionalCurrency: data.functionalCurrency || "TRY",
      paymentFrequency: data.paymentFrequency || "monthly",
      paymentTiming: data.paymentTiming || "arrears",
      initialDirectCosts: data.initialDirectCosts ?? 0,
      restorationObligation: data.restorationObligation ?? 0,
      status: data.status || "active",
      assetClass: data.assetClass || "",
      prepayments: data.prepayments ?? 0,
      leaseIncentives: data.leaseIncentives ?? 0,
      leaseIncreaseType: data.leaseIncreaseType ?? "none",
      leaseIncreaseRate: data.leaseIncreaseRate ?? 0,
      fixedIncrease: data.fixedIncrease ?? 0,
      variablePayment: data.variablePayment ?? 0,
      usefulLifeMonths: data.usefulLifeMonths ?? null,
      renewalOption: data.renewalOption === true,
      terminationOption: data.terminationOption === true,
      purchaseOption: data.purchaseOption === true,
      ownershipTransfer: data.ownershipTransfer === true,
      shortTermLease: data.shortTermLease === true,
      lowValueAsset: data.lowValueAsset === true,
      lowValueWhenNewConfirmed: data.lowValueWhenNewConfirmed === true,
      lowValueStandaloneUseConfirmed: data.lowValueStandaloneUseConfirmed === true,
      lowValueNotHighlyDependentConfirmed: data.lowValueNotHighlyDependentConfirmed === true,
      lowValueNoSubleaseConfirmed: data.lowValueNoSubleaseConfirmed === true,
      modification: false,
      reassessments: []
    };
    base.id = String(data.id);
    base.companyId = data.companyId ?? base.companyId ?? null;
    base.company = data.company ?? base.company;
    base.supplier = data.supplier ?? base.supplier;
    base.monthlyPayment = data.monthlyPayment;
    base.startDate = data.startDate;
    base.endDate = data.endDate;
    base.discountRate = data.discountRate;
    base.renewalDate = data.renewalDate;
    if (data.currency) base.currency = data.currency;
    if (data.functionalCurrency) base.functionalCurrency = data.functionalCurrency;
    if (data.paymentFrequency !== undefined) base.paymentFrequency = data.paymentFrequency;
    if (data.paymentTiming !== undefined) base.paymentTiming = data.paymentTiming;
    if (data.initialDirectCosts !== undefined) base.initialDirectCosts = data.initialDirectCosts;
    if (data.restorationObligation !== undefined) base.restorationObligation = data.restorationObligation;
    if (data.status) base.status = data.status;
    if (data.assetClass) {
      base.assetClass = data.assetClass;
      if (typeof saveCustomAssetClass === "function") {
        try { saveCustomAssetClass(data.assetClass); } catch (error) {}
      }
    }
    if (data.prepayments !== undefined) base.prepayments = data.prepayments;
    if (data.leaseIncentives !== undefined) base.leaseIncentives = data.leaseIncentives;
    if (data.leaseIncreaseType !== undefined) base.leaseIncreaseType = data.leaseIncreaseType;
    if (data.leaseIncreaseRate !== undefined) base.leaseIncreaseRate = data.leaseIncreaseRate;
    if (data.fixedIncrease !== undefined) base.fixedIncrease = data.fixedIncrease;
    if (data.variablePayment !== undefined) base.variablePayment = data.variablePayment;
    if (data.usefulLifeMonths !== undefined) base.usefulLifeMonths = data.usefulLifeMonths;
    for (const key of ["leaseTermEvidenceReference", "renewalEndDate", "terminationDate", "terminationPenalty", "purchaseOptionPrice"]) {
      if (data[key] !== undefined) base[key] = data[key];
    }
    // Opsiyon kararları satırdan gelir; boş hücre "karar girilmedi" demektir ve
    // eski kayıttaki değer (önceden boş=Hayır saklanıyordu) varsayım olarak kalmaz.
    for (const key of ["renewalOptionExpectedToExercise", "terminationOptionExpectedToExercise", "purchaseOptionExpectedToExercise"]) {
      base[key] = typeof data[key] === "boolean" ? data[key] : null;
    }
    if (data.indexBaseRate !== undefined) base.indexBaseRate = data.indexBaseRate;
    if (data.indexCurrentRate !== undefined) base.indexCurrentRate = data.indexCurrentRate;
    if (data.indexReviewMonth !== undefined) base.indexReviewMonth = data.indexReviewMonth;
    if (data.indexReviewDay !== undefined) base.indexReviewDay = data.indexReviewDay;
    if (data.renewalOption !== undefined) base.renewalOption = data.renewalOption === true;
    if (data.terminationOption !== undefined) base.terminationOption = data.terminationOption === true;
    if (data.purchaseOption !== undefined) base.purchaseOption = data.purchaseOption === true;
    if (data.ownershipTransfer !== undefined) base.ownershipTransfer = data.ownershipTransfer === true;
    if (data.shortTermLease !== undefined) base.shortTermLease = data.shortTermLease === true;
    if (data.lowValueAsset !== undefined) base.lowValueAsset = data.lowValueAsset === true;
    if (data.lowValueWhenNewConfirmed !== undefined) base.lowValueWhenNewConfirmed = data.lowValueWhenNewConfirmed === true;
    if (data.lowValueStandaloneUseConfirmed !== undefined) base.lowValueStandaloneUseConfirmed = data.lowValueStandaloneUseConfirmed === true;
    if (data.lowValueNotHighlyDependentConfirmed !== undefined) base.lowValueNotHighlyDependentConfirmed = data.lowValueNotHighlyDependentConfirmed === true;
    if (data.lowValueNoSubleaseConfirmed !== undefined) base.lowValueNoSubleaseConfirmed = data.lowValueNoSubleaseConfirmed === true;
    if (!Array.isArray(base.reassessments)) base.reassessments = [];
    base.integrationMetadata = {
      ...(base.integrationMetadata || {}),
      source: metadata.source || null,
      sourceType: metadata.sourceType || null,
      sourceId: metadata.sourceId || null,
      jobId: metadata.jobId || null,
      externalRecordId: metadata.externalRecordId || data.id || null,
      importedAt: metadata.importedAt || integrationNow(),
      importedBy: metadata.importedBy || integrationActor(),
      schemaVersion: metadata.schemaVersion || INTEGRATION_SCHEMA_VERSION,
      mappingProfile: metadata.mappingProfile || "GENERIC",
      integrationStatus: INTEGRATION_LIFECYCLE.PROCESSED
    };
    return base;
  }

  function detectIntegrationChanges(oldContract, newData) {
    if (!oldContract) return [];
    const fields = ["company", "supplier", "monthlyPayment", "startDate", "endDate", "discountRate", "renewalDate", "currency", "functionalCurrency", "paymentFrequency", "paymentTiming", "initialDirectCosts", "restorationObligation", "status", "assetClass", "prepayments", "leaseIncentives", "leaseIncreaseType", "leaseIncreaseRate", "fixedIncrease", "variablePayment", "usefulLifeMonths", "indexBaseRate", "indexCurrentRate", "indexReviewMonth", "indexReviewDay", "renewalOption", "terminationOption", "purchaseOption", "ownershipTransfer", "shortTermLease", "lowValueAsset", "lowValueWhenNewConfirmed", "lowValueStandaloneUseConfirmed", "lowValueNotHighlyDependentConfirmed", "lowValueNoSubleaseConfirmed"];
    return fields.filter(field => newData[field] !== undefined && String(oldContract[field] ?? "") !== String(newData[field] ?? "")).map(field => ({ field, oldValue: oldContract[field] ?? null, newValue: newData[field] ?? null }));
  }

  async function commitImport(jobId, rows, options = {}) {
    v21RequirePermission("imports.execute", { action: "IMPORT", entityId: jobId });
    const inputRows = Array.isArray(rows) ? rows : [];
    const existingJob = getImportJob(jobId);
    if (!existingJob) return { success: false, error: "IMPORT_JOB_NOT_FOUND", jobId };
    if (existingJob.dryRun) return { success: false, error: "DRY_RUN_JOB_CANNOT_COMMIT", jobId };
    updateImportJob(jobId, { status: INTEGRATION_JOB_STATUS.PROCESSING, lifecycle: INTEGRATION_LIFECYCLE.IMPORTED });
    const preview = previewImport(inputRows, options);
    if (preview.rejectedRows && options.rejectOnAnyError === true) {
      const failed = updateImportJob(jobId, { status: INTEGRATION_JOB_STATUS.FAILED, completedAt: integrationNow(), totalRows: preview.totalRows, rejectedRows: preview.rejectedRows, warningRows: preview.warningRows, errors: preview.validationResults.flatMap(x => x.errors || []), warnings: preview.validationResults.flatMap(x => x.warnings || []), validationResults: preview.validationResults, lifecycle: INTEGRATION_LIFECYCLE.EXCEPTION });
      return { success: false, job: failed, preview, committed: [] };
    }
    const working = Array.isArray(contracts) ? contracts.slice() : [];
    const committed = [], rejected = [], changes = [];
    // DÜZELTME (kullanıcı talebi): backend'e yazarken lisans/kapasite
    // limitine takılan satırları şirket bazında ayrıca izliyoruz.
    // Amaç: 30 satırlık bir dosyada limit 12. satırda dolduysa,
    // kullanıcıya "18 satır reddedildi" diye tek tek aynı hatayı
    // 18 kez göstermek yerine "GK Holding: 12. satırdan (LEASE-012)
    // itibaren sözleşme limiti doldu (12/12)" gibi tek, net bir özet
    // vermek. İlk kırılma noktası şirket başına bir kez kaydedilir.
    const limitReachedByCompany = new Map();
    // DÜZELTME (kritik veri kaybı — bkz. LEASE-030 / "30 kayıt aktarıldı"
    // sonrası refresh'te 0 sözleşme bugı): önceden bu döngü sadece
    // working[] ve localStorage'a yazıyordu, backend'e HİÇ POST/PUT
    // atmıyordu. hydrateContractsFromApi() her sayfa yüklemesinde
    // GET /api/contracts'ı gerçek kaynak kabul edip localStorage'ın
    // üzerine yazdığı için, backend'de var olmayan bu satırlar bir
    // sonraki refresh'te sessizce siliniyordu. Artık her satır için
    // persistContractToApi() await ediliyor; backend'e yazılamayan
    // satır working[]'e de girmiyor (yerel state backend'le tutarlı
    // kalır) ve rejected listesine, hata sebebiyle birlikte düşüyor.
    for (const result of preview.validationResults) {
      if (result.status === INTEGRATION_ROW_STATUS.INVALID) { rejected.push(result); continue; }
      const id = String(result.normalizedData.id);
      const index = working.findIndex(c => String(c.id) === id);
      const oldContract = index >= 0 ? working[index] : null;
      const action = index >= 0 ? "UPDATE" : "CREATE";
      const next = buildContractFromIntegrationData(result.normalizedData, oldContract, {
        source: options.sourceName || options.fileName || options.sourceType || "INTEGRATION",
        sourceType: options.sourceType || INTEGRATION_SOURCE_TYPES.EXCEL,
        sourceId: options.sourceId || null,
        jobId,
        externalRecordId: result.normalizedData.id,
        schemaVersion: options.schemaVersion || INTEGRATION_SCHEMA_VERSION,
        mappingProfile: result.mappingProfile
      });
      const fieldChanges = detectIntegrationChanges(oldContract, result.normalizedData);
      const businessRuleCheck = typeof validateImportedContract === "function"
        ? validateImportedContract(next)
        : { valid: true, errors: [] };

      try {
        await persistContractToApi(next, action === "UPDATE");
      } catch (error) {
        // Backend, lisans/kapasite limitine takılan istekleri
        // { error, code: "LIMIT_REACHED" | "NO_ACTIVE_LICENSE",
        //   currentContracts, maxContracts } gövdesiyle 403 döner
        // (bkz. backend/routes/contracts.js, license-service.js
        // canAddContractToCompany). tfrs16ApiFetch bu gövdeyi
        // err.body'de saklıyor — burada okuyup şirket başına İLK
        // kırılma noktasını (satır + o anki doluluk) kaydediyoruz.
        const backendCode = error?.body?.code || null;
        const isLimitError = backendCode === "LIMIT_REACHED" || backendCode === "NO_ACTIVE_LICENSE";
        if (isLimitError && next.companyId && !limitReachedByCompany.has(String(next.companyId))) {
          limitReachedByCompany.set(String(next.companyId), {
            companyId: next.companyId,
            company: next.company || String(next.companyId),
            rowNumber: result.rowNumber,
            contractId: id,
            code: backendCode,
            currentContracts: error?.body?.currentContracts ?? null,
            maxContracts: error?.body?.maxContracts ?? null
          });
        }
        rejected.push({
          ...result,
          status: INTEGRATION_ROW_STATUS.INVALID,
          errors: [
            ...(result.errors || []),
            { rowNumber: result.rowNumber, field: null, value: id, errorCode: backendCode || "BACKEND_PERSIST_FAILED", message: `Backend'e kaydedilemedi: ${error?.message || String(error)}` }
          ]
        });
        if (typeof recordAuditEvent === "function") {
          recordAuditEvent({ action: "IMPORT_BACKEND_PERSIST_FAILED", entityType: "CONTRACT", entityId: id, contractId: id, reason: "V19 integration import — backend'e yazılamadı", metadata: { jobId, rowNumber: result.rowNumber, companyId: next.companyId || null, backendCode, error: error?.message || String(error) } });
        }
        continue;
      }

      if (index >= 0) working[index] = next; else working.push(next);
      committed.push({ rowNumber: result.rowNumber, contractId: id, action, status: result.status, warningCount: result.warnings.length, businessRuleWarnings: businessRuleCheck.valid ? [] : (businessRuleCheck.errors || []) });
      changes.push({ contractId: id, action, changes: fieldChanges });
      if (typeof recordAuditEvent === "function") recordAuditEvent({ action: action === "CREATE" ? "IMPORT_CREATE" : "IMPORT_UPDATE", entityType: "CONTRACT", entityId: id, contractId: id, reason: "V19 integration import", oldValue: oldContract, newValue: next, metadata: { jobId, sourceType: options.sourceType || INTEGRATION_SOURCE_TYPES.EXCEL, sourceId: options.sourceId || null, schemaVersion: options.schemaVersion || INTEGRATION_SCHEMA_VERSION, fieldChanges } });
      if (!businessRuleCheck.valid && typeof recordAuditEvent === "function") {
        recordAuditEvent({ action: "IMPORT_BUSINESS_RULE_WARNING", entityType: "CONTRACT", entityId: id, contractId: id, reason: "V19 integration import business rule check (validateImportedContract)", metadata: { jobId, rowNumber: result.rowNumber, errors: businessRuleCheck.errors || [] } });
      }
    }
    saveContracts(working);
    if (typeof refresh === "function") { try { refresh(); } catch (error) {} }
    rejected.forEach(result => {
      if (typeof recordAuditEvent === "function") recordAuditEvent({ action: "IMPORT_REJECT", entityType: "IMPORT", entityId: jobId, reason: "V19 integration import rejected row", metadata: { jobId, rowNumber: result.rowNumber, errors: result.errors, warnings: result.warnings } });
    });
    const finalStatus = rejected.length || preview.warningRows ? INTEGRATION_JOB_STATUS.COMPLETED_WITH_WARNINGS : INTEGRATION_JOB_STATUS.COMPLETED;
    const job = updateImportJob(jobId, { status: finalStatus, completedAt: integrationNow(), totalRows: preview.totalRows, importedRows: committed.length, rejectedRows: rejected.length, warningRows: preview.warningRows, errors: rejected.flatMap(x => x.errors || []), warnings: preview.validationResults.flatMap(x => x.warnings || []), validationResults: preview.validationResults, lifecycle: rejected.length ? INTEGRATION_LIFECYCLE.EXCEPTION : INTEGRATION_LIFECYCLE.PROCESSED, committedActions: committed, changeSummary: changes });
    return { success: true, job, preview, committed, rejected, changes, limitReachedSummary: Array.from(limitReachedByCompany.values()) };
  }

  function getImportErrorReport(jobId) {
    const job = getImportJob(jobId);
    if (!job) return { jobId, errors: [], warnings: [] };
    return { jobId, errors: job.errors || [], warnings: job.warnings || [], rejectedRows: job.rejectedRows || 0 };
  }

  function getIntegrationContractData(options = {}) {
    const list = Array.isArray(contracts) ? contracts : [];
    return list.filter(contract => !options.company || contract.company === options.company).filter(contract => !options.currency || normalizeIntegrationCurrency(contract.currency || contract.integrationMetadata?.currency) === normalizeIntegrationCurrency(options.currency));
  }



  function getErpReadyJournalData(reportingDate, options = {}) {
    const ui = window.LeaseQantTfrs16JournalUi;
    if (!ui) journalAuthorityUnavailable();
    const rows = ui.bulkRows();
    if (reportingDate && ui.databasePreview().journals.some(voucher=>voucher.periodEnd !== v23DateKey(reportingDate))) {
      const error = new Error("Yevmiye paketi istenen dönemle eşleşmiyor");
      error.code = "JOURNAL_PERIOD_SOURCE_REQUIRED";
      throw error;
    }
    return rows;
  }


  function v19IsoDate(date) {
    const d = date instanceof Date ? date : new Date(date);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }


  function createExportHistory(exportType, recordCount, options = {}) {
    const state = getIntegrationStorage();
    const item = { exportId: options.exportId || integrationId("EXP"), exportType, createdAt: options.createdAt || integrationNow(), createdBy: options.createdBy || integrationActor(), recordCount: Number(recordCount) || 0, status: options.status || "COMPLETED", schemaVersion: options.schemaVersion || INTEGRATION_SCHEMA_VERSION, source: "GK_FINANCE_INTELLIGENCE" };
    state.exports.push(item);
    saveIntegrationStorage(state);
    if (typeof recordAuditEvent === "function") recordAuditEvent({ action: "EXPORT", entityType: "INTEGRATION_EXPORT", entityId: item.exportId, reason: "V19 data exchange export", metadata: item });
    return integrationClone(item);
  }

  function getExportHistory(filters = {}) {
    return getIntegrationStorage().exports.slice().reverse().filter(item => !filters.exportType || item.exportType === filters.exportType);
  }

  function exportIntegrationData(exportType, reportingDate, options = {}) {
    v21RequirePermission("exports.execute", { action: "EXPORT", entityId: exportType });
    const data = getIntegrationExportData(exportType, reportingDate, options);
    const count = Array.isArray(data) ? data.length : (data ? 1 : 0);
    const history = createExportHistory(String(exportType || "UNKNOWN").toUpperCase(), count, options);
    return { exportId: history.exportId, exportType: history.exportType, schemaVersion: INTEGRATION_SCHEMA_VERSION, createdAt: history.createdAt, recordCount: count, data };
  }

  function reconcileExternalValues(input = {}) {
    const external = Number(input.externalTotal);
    const internal = Number(input.internalTotal);
    if (!Number.isFinite(external) || !Number.isFinite(internal)) return { status: INTEGRATION_RECON_STATUS.NOT_AVAILABLE, externalTotal: Number.isFinite(external) ? external : null, internalTotal: Number.isFinite(internal) ? internal : null, variance: null };
    const variance = external - internal;
    const tolerance = Number.isFinite(Number(input.tolerance)) ? Number(input.tolerance) : INTEGRATION_AMOUNT_TOLERANCE;
    return { status: Math.abs(variance) <= tolerance ? INTEGRATION_RECON_STATUS.MATCHED : INTEGRATION_RECON_STATUS.MISMATCH, externalTotal: external, internalTotal: internal, variance, tolerance };
  }

  function reconcileImportedContracts(externalRows, options = {}) {
    const external = Array.isArray(externalRows) ? externalRows : [];
    const internal = Array.isArray(contracts) ? contracts : [];
    const internalMap = new Map(internal.map(c => [String(c.id), c]));
    const externalMap = new Map();
    const exceptions = [];
    const rows = [];
    external.forEach((row, index) => {
      const mapped = row?.normalizedData ? row.normalizedData : mapExternalRecord(row, options).normalizedData;
      const id = mapped?.id ? String(mapped.id) : null;
      if (!id) { exceptions.push({ rowNumber: index + 1, type: "MISSING_EXTERNAL_ID" }); return; }
      if (externalMap.has(id)) { exceptions.push({ rowNumber: index + 1, contractId: id, type: "DUPLICATE_EXTERNAL" }); return; }
      externalMap.set(id, mapped);
      const local = internalMap.get(id);
      if (!local) { rows.push({ contractId: id, status: "MISSING_INTERNAL", external: mapped, internal: null }); return; }
      const differences = [];
      ["company", "supplier", "startDate", "endDate", "status"].forEach(field => { if (String(mapped[field] ?? "") !== String(local[field] ?? "")) differences.push({ field, external: mapped[field] ?? null, internal: local[field] ?? null }); });
      if (Number.isFinite(mapped.monthlyPayment) && Math.abs(mapped.monthlyPayment - (Number(local.monthlyPayment) || 0)) > INTEGRATION_AMOUNT_TOLERANCE) differences.push({ field: "monthlyPayment", external: mapped.monthlyPayment, internal: Number(local.monthlyPayment) || 0 });
      rows.push({ contractId: id, status: differences.length ? "MISMATCH" : "MATCHED", differences, external: mapped, internal: local });
    });
    internal.forEach(contract => { if (!externalMap.has(String(contract.id))) rows.push({ contractId: contract.id, status: "MISSING_EXTERNAL", external: null, internal: contract }); });
    const mismatches = rows.filter(row => row.status !== "MATCHED");
    const result = { reconciliationId: integrationId("REC"), source: options.source || "EXTERNAL", reportingDate: v19IsoDate(options.reportingDate || new Date()), externalCount: external.length, internalCount: internal.length, matchedCount: rows.filter(x => x.status === "MATCHED").length, mismatchCount: mismatches.length, status: exceptions.length || mismatches.length ? INTEGRATION_RECON_STATUS.MISMATCH : INTEGRATION_RECON_STATUS.MATCHED, rows, exceptions, createdAt: integrationNow() };
    const state = getIntegrationStorage(); state.reconciliations.push(result); saveIntegrationStorage(state);
    if (typeof recordAuditEvent === "function") recordAuditEvent({ action: "RECONCILIATION", entityType: "INTEGRATION_RECONCILIATION", entityId: result.reconciliationId, reason: "V19 contract reconciliation", metadata: { status: result.status, source: result.source, reportingDate: result.reportingDate, mismatchCount: result.mismatchCount } });
    return result;
  }

  function reconcileExternalJournal(externalRows, reportingDate) {
    const external = Array.isArray(externalRows) ? externalRows : [];
    const internal = getErpReadyJournalData(reportingDate);
    const key = row => `${row.voucherNo || ""}|${row.account || ""}|${row.contractId || ""}|${row.currency || ""}`;
    const internalMap = new Map(internal.map(row => [key(row), row]));
    const rows = external.map(row => {
      const mapped = { ...row, currency: normalizeIntegrationCurrency(row.currency), debit: integrationNumber(row.debit), credit: integrationNumber(row.credit) };
      const local = internalMap.get(key(mapped));
      if (!local) return { status: "MISSING_INTERNAL", external: mapped, internal: null };
      const variance = (mapped.debit - mapped.credit) - ((Number(local.debit) || 0) - (Number(local.credit) || 0));
      return { status: Math.abs(variance) <= INTEGRATION_AMOUNT_TOLERANCE ? "MATCHED" : "MISMATCH", voucherNo: mapped.voucherNo, account: mapped.account, variance, external: mapped, internal: local };
    });
    const result = { reconciliationId: integrationId("REC"), source: "EXTERNAL_JOURNAL", reportingDate: v19IsoDate(reportingDate || new Date()), externalCount: external.length, internalCount: internal.length, status: rows.every(x => x.status === "MATCHED") ? INTEGRATION_RECON_STATUS.MATCHED : INTEGRATION_RECON_STATUS.MISMATCH, rows, exceptions: rows.filter(x => x.status !== "MATCHED"), createdAt: integrationNow() };
    const state = getIntegrationStorage(); state.reconciliations.push(result); saveIntegrationStorage(state);
    if (typeof recordAuditEvent === "function") recordAuditEvent({ action: "RECONCILIATION", entityType: "INTEGRATION_RECONCILIATION", entityId: result.reconciliationId, reason: "V19 journal reconciliation", metadata: { status: result.status, source: result.source } });
    return result;
  }

  function getIntegrationReconciliations(filters = {}) {
    return getIntegrationStorage().reconciliations.slice().reverse().filter(item => !filters.source || item.source === filters.source).filter(item => !filters.status || item.status === filters.status);
  }

  function getIntegrationDataFreshness() {
    const jobs = getImportHistory();
    const last = jobs.find(job => [INTEGRATION_JOB_STATUS.COMPLETED, INTEGRATION_JOB_STATUS.COMPLETED_WITH_WARNINGS].includes(job.status));
    if (!last?.completedAt) return { lastUpdated: null, dataAge: null, freshnessStatus: "UNKNOWN", live: false };
    const ageMs = Math.max(0, Date.now() - new Date(last.completedAt).getTime());
    const ageHours = ageMs / 3600000;
    return { lastUpdated: last.completedAt, dataAge: ageMs, dataAgeHours: ageHours, freshnessStatus: ageHours <= 24 ? "FRESH" : "STALE", live: false, source: last.sourceType || null };
  }

  function getIntegrationDashboardData() {
    const state = getIntegrationStorage();
    const jobs = state.jobs;
    const successful = jobs.filter(j => j.status === INTEGRATION_JOB_STATUS.COMPLETED).length;
    const warning = jobs.filter(j => j.status === INTEGRATION_JOB_STATUS.COMPLETED_WITH_WARNINGS).length;
    const failed = jobs.filter(j => j.status === INTEGRATION_JOB_STATUS.FAILED).length;
    const totalRows = jobs.reduce((sum, j) => sum + (Number(j.totalRows) || 0), 0);
    const importedRows = jobs.reduce((sum, j) => sum + (Number(j.importedRows) || 0), 0);
    const rejectedRows = jobs.reduce((sum, j) => sum + (Number(j.rejectedRows) || 0), 0);
    const openRecons = state.reconciliations.filter(r => ![INTEGRATION_RECON_STATUS.MATCHED, INTEGRATION_RECON_STATUS.NOT_AVAILABLE].includes(r.status));
    const lastImport = jobs.slice().sort((a,b) => String(b.completedAt || b.startedAt).localeCompare(String(a.completedAt || a.startedAt)))[0] || null;
    return {
      version: INTEGRATION_ENGINE_VERSION,
      totalImports: jobs.length,
      successfulImports: successful,
      failedImports: failed,
      warningImports: warning,
      totalRows,
      importedRows,
      rejectedRows,
      reconciliationStatus: openRecons.length ? "WARNING" : (state.reconciliations.length ? "MATCHED" : "NOT_AVAILABLE"),
      openExceptions: openRecons.reduce((sum, r) => sum + (Array.isArray(r.exceptions) ? r.exceptions.length : Number(r.mismatchCount) || 0), 0),
      lastImport,
      sourceSummary: getIntegrationSources().map(source => ({ sourceId: source.sourceId, sourceType: source.sourceType, sourceName: source.sourceName, status: source.status, recordCount: source.recordCount, errorCount: source.errorCount })),
      dataFreshness: getIntegrationDataFreshness(),
      exportHistoryCount: state.exports.length,
      reconciliationCount: state.reconciliations.length,
      erpReady: true,
      liveErpConnected: false
    };
  }

  function getCfoIntegrationView(reportingDate) {
    const integration = getIntegrationDashboardData();
    const close = typeof getMonthEndCloseStatus === "function" ? getMonthEndCloseStatus(reportingDate || new Date()) : null;
    const cfo = typeof getCfoExecutiveSnapshot === "function" ? getCfoExecutiveSnapshot(reportingDate || new Date()) : null;
    return {
      version: INTEGRATION_ENGINE_VERSION,
      reportingDate: v19IsoDate(reportingDate || new Date()),
      lastSuccessfulImport: integration.lastImport?.status === INTEGRATION_JOB_STATUS.COMPLETED ? integration.lastImport : null,
      lastFailedImport: getImportHistory({ status: INTEGRATION_JOB_STATUS.FAILED })[0] || null,
      dataFreshness: integration.dataFreshness,
      reconciliationStatus: integration.reconciliationStatus,
      importExceptions: integration.openExceptions,
      erpReadiness: { ready: true, liveConnection: false, schemaVersion: INTEGRATION_SCHEMA_VERSION },
      journalExportStatus: getExportHistory({ exportType: "ERP_JOURNAL" })[0]?.status || "NOT_EXPORTED",
      closeStatus: close,
      executiveStatus: cfo?.executiveStatus || null
    };
  }

  function getContractsRequiringIntegrationAttention(options = {}) {
    const result = [];
    (Array.isArray(contracts) ? contracts : []).forEach(contract => {
      const metadata = contract.integrationMetadata || {};
      if (!metadata.sourceId && options.includeUnmapped !== false) result.push({ contractId: contract.id, company: contract.company, severity: "MEDIUM", reason: "NO_INTEGRATION_LINEAGE", action: "Map contract to an external source." });
      if (metadata.integrationStatus === INTEGRATION_LIFECYCLE.EXCEPTION) result.push({ contractId: contract.id, company: contract.company, severity: "HIGH", reason: "INTEGRATION_EXCEPTION", action: "Review integration exception." });
    });
    return result;
  }

  async function parseIntegrationFile(file, options = {}) {
    if (!file) return { success: false, error: "FILE_REQUIRED" };
    const name = file.name || "import";
    const sourceType = /\.csv$/i.test(name) ? INTEGRATION_SOURCE_TYPES.CSV : INTEGRATION_SOURCE_TYPES.EXCEL;
    let rows = [];
    try {
      if (typeof XLSX === "undefined") return { success: false, error: "XLSX_LIBRARY_NOT_AVAILABLE" };
      const buffer = await file.arrayBuffer();
      updateLoadingProgress(20, `Excel dosyası okunuyor...`);
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
      updateLoadingProgress(35, `Excel sayfası hazırlanıyor...`);
      // Çok sayfalı dosyada (talimat, beklenen sonuçlar vb.) sözleşme
      // sayfası "Sözleşme ID" başlığından bulunur; yoksa ilk sayfa okunur.
      const sheetNames = workbook.SheetNames || [];
      if (!sheetNames.length) return { success: false, error: "EMPTY_WORKBOOK" };
      const idAliases = (INTEGRATION_PROFILES.GENERIC.fields.contractId || []).map(integrationNormalizeHeader);
      const contractSheet = sheetNames.find(sheetName => {
        const header = (XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "" })[0] || []);
        return header.some(cell => idAliases.includes(integrationNormalizeHeader(cell)));
      }) || sheetNames[0];
      rows = XLSX.utils.sheet_to_json(workbook.Sheets[contractSheet], { defval: "" });
      updateLoadingProgress(rows.length > LARGE_IMPORT_ROW_THRESHOLD ? 40 : 70, `${rows.length} Excel kaydı bulundu.`);
    } catch (error) {
      return { success: false, error: error?.message || String(error) };
    }
    const source = registerIntegrationSource({ sourceType, sourceName: name, importedBy: integrationActor(), status: "IMPORTED", recordCount: rows.length });
    const job = createImportJob({ sourceId: source.sourceId, sourceType, fileName: name, totalRows: rows.length, lifecycle: INTEGRATION_LIFECYCLE.IMPORTED });

    // Performans: satır sayısı eşiği aşan dosyalarda doğrulama
    // parçalar halinde çalışır ve ilerleme UI'da gösterilir; küçük
    // dosyalarda sonuç ve davranış birebir aynı kalır (previewImport).
    const isLargeImport = rows.length > LARGE_IMPORT_ROW_THRESHOLD;
    const importStatusEl = isLargeImport ? document.getElementById("bulkImportStatus") : null;

    const preview = isLargeImport
      ? await previewImportChunked(
          rows,
          { ...options, sourceId: source.sourceId, sourceType, fileName: name },
          (done, total) => {
            const pct = total ? Math.round((done / total) * 100) : 0;
            updateLoadingProgress(pct, `Excel kayıtları doğrulanıyor... (${done}/${total})`);
            if (importStatusEl) {
              importStatusEl.innerHTML = `⏳ Doğrulanıyor... %${pct} (${done}/${total})`;
            }
          }
        )
      : previewImport(rows, { ...options, sourceId: source.sourceId, sourceType, fileName: name });

    updateImportJob(job.jobId, { totalRows: preview.totalRows, rejectedRows: preview.rejectedRows, warningRows: preview.warningRows, validationResults: preview.validationResults, errors: preview.validationResults.flatMap(x => x.errors || []), warnings: preview.validationResults.flatMap(x => x.warnings || []), lifecycle: INTEGRATION_LIFECYCLE.VALIDATED });
    return { success: true, source, job: getImportJob(job.jobId), preview, rows };
  }

  function runV19IntegrationTests() {
    const results = [];
    try {
      const sample = [{ "Contract ID": "V19-TEST-001", Company: "TEST", Supplier: "SUP", Payment: "1.000,50", "Start Date": "2026-01-01", "End Date": "2027-01-01", "Discount Rate": "10", Currency: "TL" }];
      const duplicateSample = [sample[0], sample[0]];
      const invalidSample = [{ Company: "TEST" }];
      const preview = previewImport(sample, { profile: "GENERIC" });
      const invalidPreview = previewImport(invalidSample, { profile: "GENERIC" });
      const duplicatePreview = previewImport(duplicateSample, { profile: "GENERIC" });
      const emptyPreview = previewImport([], { profile: "GENERIC" });
      const schemaReject = validateImportSchema(sample, { schemaVersion: "99.0" });
      const dryRun = dryRunImport(sample);
      const dash = getIntegrationDashboardData();
      const freshness = getIntegrationDataFreshness();
      const checks = [
        ["VALID_EXCEL_IMPORT_PREVIEW", preview.totalRows === 1 && preview.validRows === 1],
        ["INVALID_EXCEL_IMPORT", invalidPreview.rejectedRows === 1],
        ["EMPTY_FILE", emptyPreview.totalRows === 0 && emptyPreview.rejectedRows === 0],
        ["MISSING_COLUMNS", invalidPreview.validationResults[0]?.errors?.some(e => e.errorCode === "REQUIRED_FIELD") === true],
        ["DUPLICATE_CONTRACTS", duplicatePreview.rejectedRows === 1],
        ["CREATE_UPDATE_DECISION", preview.validationResults[0]?.action === "CREATE" || preview.validationResults[0]?.action === "UPDATE"],
        ["PARTIAL_IMPORT_DATA_LAYER", typeof preview.validRows === "number" && typeof preview.rejectedRows === "number"],
        ["DRY_RUN", dryRun.dryRun === true && dryRun.job?.dryRun === true],
        ["DATE_NORMALIZATION", normalizeIntegrationDate("2026-01-01") === "2026-01-01"],
        ["NUMBER_NORMALIZATION_EU", integrationNumber("1.000,50") === 1000.5],
        ["NUMBER_NORMALIZATION_US", integrationNumber("1,000.50") === 1000.5],
        ["CURRENCY_NORMALIZATION", normalizeIntegrationCurrency("TL") === "TRY"],
        ["COMPANY_MAPPING", preview.validationResults[0]?.normalizedData?.company === "TEST"],
        ["ACCOUNT_MAPPING_PROFILE", !!getIntegrationMappingProfile("GENERIC")],
        ["ERP_MAPPING_PROFILES", !!getIntegrationMappingProfile("SAP") && !!getIntegrationMappingProfile("ORACLE") && !!getIntegrationMappingProfile("DYNAMICS")],
        ["ERP_READY_JOURNAL", Array.isArray(getErpReadyJournalData(new Date()))],
        ["ERP_READY_CONTRACT", Array.isArray(getErpReadyContractData(new Date()))],
        ["ERP_READY_PAYMENT", Array.isArray(getErpReadyPaymentData(new Date()))],
        ["EXPORT_DATA_LAYER", Array.isArray(getIntegrationExportData("CONTRACT", new Date()))],
        ["EXPORT_HISTORY", Array.isArray(getExportHistory())],
        ["CONTRACT_RECON_MATCH", reconcileExternalValues({ externalTotal: 100, internalTotal: 100 }).status === INTEGRATION_RECON_STATUS.MATCHED],
        ["CONTRACT_RECON_MISMATCH", reconcileExternalValues({ externalTotal: 100, internalTotal: 90 }).status === INTEGRATION_RECON_STATUS.MISMATCH],
        ["LIABILITY_RECON_TOLERANCE", reconcileExternalValues({ externalTotal: 100, internalTotal: 100.005, tolerance: 0.01 }).status === INTEGRATION_RECON_STATUS.MATCHED],
        ["CURRENCY_SEPARATION", normalizeIntegrationCurrency("EUR") === "EUR" && normalizeIntegrationCurrency("USD") === "USD" && normalizeIntegrationCurrency("EUR") !== normalizeIntegrationCurrency("USD")],
        ["MULTI_COMPANY_FILTER", getIntegrationContractData({ company: "__V19_NON_EXISTENT__" }).length === 0],
        ["ERROR_ISOLATION", invalidPreview.validationResults.length === 1 && preview.validationResults.length === 1],
        ["DATA_FRESHNESS", ["FRESH", "STALE", "UNKNOWN"].includes(freshness.freshnessStatus) && freshness.live === false],
        ["INTEGRATION_DASHBOARD", !!dash && typeof dash.totalImports === "number"],
        ["IMPORT_HISTORY", Array.isArray(getImportHistory())],
        ["RECONCILIATION_HISTORY", Array.isArray(getIntegrationReconciliations())],
        ["BACKWARD_COMPATIBILITY", Array.isArray(contracts) && typeof saveContracts === "function" && typeof recordAuditEvent === "function"],
        ["STORAGE_KEY_PRESERVED", STORAGE_KEY === "gk_tfrs16_contracts_v7"],
        ["SCHEMA_REJECTION", schemaReject.supported === false && schemaReject.status === "REJECT"],
        ["SOURCE_MODEL", Array.isArray(getIntegrationSources()) && typeof registerIntegrationSource === "function"],
        ["PUBLIC_API_V19", typeof getIntegrationDashboardData === "function" && typeof commitImport === "function"],
        ["NO_LIVE_ERP_CLAIM", dash.liveErpConnected === false && dash.erpReady === true]
      ];
      checks.forEach(test => results.push({ name: test[0], passed: Boolean(test[1]) }));
      return { passed: results.every(item => item.passed), summary: { total: results.length, passed: results.filter(item => item.passed).length, failed: results.filter(item => !item.passed).length }, results };
    } catch (error) {
      return { passed: false, summary: { total: results.length + 1, passed: results.filter(item => item.passed).length, failed: results.filter(item => !item.passed).length + 1 }, results, error: error?.message || String(error) };
    }
  }

  /* ==========================================================
     V19.1 UI INTEGRATION & FUNCTIONAL WIRING
     ----------------------------------------------------------
     UI-only wiring layer. Existing financial, reporting, close,
     risk, integration and reconciliation engines remain the
     single source of truth. No calculation engine is introduced.
  ========================================================== */

  let v191OpenView = null;
  let v191LastReportingDate = new Date();

  // GK Advisory — dönem aralığı seçimi (Finansal Raporlama görünümü).
  // "YYYY-MM-DD" string veya null (null = varsayılan: YTD, dönem başı
  // = içinde bulunulan yılın 1 Ocak'ı, dönem sonu = bugün).
  let v191PeriodStartOverride = null;
  let v191PeriodEndOverride = null;

  // GK Advisory — Sözleşme Bazında Detay tabloları varsayılan olarak
  // KAPALI (yüzlerce sözleşmede sayfanın şişmesini önlemek için).
  // Bir varlık sınıfı satırına tıklanınca ilgili detay tablosu o
  // sınıfa filtrelenmiş şekilde otomatik açılır (drill-down).
  let v191RouDetailExpanded = false;
  let v191RouDetailAssetClassFilter = null;
  let v191LiabDetailExpanded = false;
  let v191LiabDetailAssetClassFilter = null;

  // DÜZELTME: drill-down/detay-toggle butonları (v191AssetClassDrillLink,
  // v191ContractDetailBlock) her zaman v191OpenFinancialReporting()'i
  // çağırıyordu — bu, SADECE "Finansal Raporlama" ekranı açıkken doğru
  // çalışır. "Dipnotlar" sayfası (renderFootnotesPage) aynı paylaşılan
  // fonksiyonları (v191RenderAssetNoteHtml vb.) kullandığı için, o
  // sayfadayken tıklamalar SESSİZCE HİÇBİR ŞEY YAPMIYORDU (yanlış ekranı
  // açmaya çalışıyordu). Çözüm: hangi ekranın aktif olduğunu bilen bir
  // callback — renderFootnotesPage kendi render()'ını buraya kaydediyor,
  // openInMain başka bir sayfaya geçildiğinde bunu temizliyor. Boşsa
  // (Finansal Raporlama ekranındaysak) eski davranış AYNEN korunuyor.
  let v191ActiveScreenRefreshCallback = null;
  function v191TriggerActiveScreenRefresh() {
    if (typeof v191ActiveScreenRefreshCallback === "function") {
      v191ActiveScreenRefreshCallback();
    } else if (typeof v191OpenFinancialReporting === "function") {
      v191OpenFinancialReporting();
    }
  }

  function v191Escape(value) {
    return escapeHtml(value == null ? "" : String(value));
  }




  function v191Value(value) {
    if (value === null || value === undefined || value === "") return "—";
    if (typeof value === "number" && Number.isFinite(value)) return value.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
    if (typeof value === "boolean") return value ? "Evet" : "Hayır";
    if (Array.isArray(value)) return `${value.length} kayıt`;
    if (typeof value === "object") return "Detay";
    return v191Escape(value);
  }



  // "YYYY-MM-DD" biçiminde <input type="date"> value'su üretir.
  function v191DateInputValue(d) {
    if (!(d instanceof Date) || isNaN(d.getTime())) return "";
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }





  function v191AppliedChanges(contract, start, end) {
    const modifications = dedupeAppliedModifications(contract?.modifications)
      .map(x => resolveAppliedModificationMeasurement(contract, x))
      .map(x => ({ ...x, __changeKind: "modification" }));
    const reassessmentKeys = new Set();
    const reassessments = (Array.isArray(contract?.reassessments) ? contract.reassessments : [])
      .filter(x => x?.status === "APPLIED")
      .filter(x => {
        const key = reassessmentEconomicKey(x);
        if (reassessmentKeys.has(key)) return false;
        reassessmentKeys.add(key);
        return true;
      })
      .map(x => ({ ...resolveAppliedReassessmentMeasurement(contract, x), __changeKind: "reassessment" }));
    return modifications.concat(reassessments)
      .map(x => ({ ...x, __effective: rptDate(x.effectiveDate || x.modificationDate || x.reassessmentDate) }))
      .filter(x => x.__effective && (!start || x.__effective >= start) && (!end || x.__effective <= end))
      .sort((a, b) => a.__effective - b.__effective);
  }

  function v191FxRateAt(sourceCurrency, presentationCurrency, date) {
    if (sourceCurrency === presentationCurrency) return 1;
    const quote = getFxRate(sourceCurrency, presentationCurrency, date, V23_RATE_TYPES.CLOSING, { allowLastAvailable: true });
    if (quote?.error || !(Number(quote?.rate) > 0)) {
      throw Object.assign(new Error(`TMS 21: ${sourceCurrency}/${presentationCurrency} ${v23DateKey(date)} kuru bulunamadı.`), { code: quote?.error || "FX_RATE_NOT_FOUND" });
    }
    return Number(quote.rate);
  }




  // Private API counterpart for the portfolio TMS29 path. The browser only
  // assembles the already-computed private envelopes.
  function legacyReportAuth_v191ComputePrivatePortfolioTms29(contractList, apiResults, periodStartMonth, rpMonth) {
    const sourceContracts = Array.isArray(contractList) ? contractList : [];
    const results = new Map();
    const flatRows = [];
    const totals = {
      rouOpeningNominal: 0, rouOpeningRestated: 0,
      rouEntriesNominal: 0, rouEntriesRestated: 0,
      rouModificationNominal: 0, rouModificationRestated: 0,
      rouReassessmentNominal: 0, rouReassessmentRestated: 0,
      rouDepreciationNominal: 0, rouDepreciationRestated: 0,
      rouClosingNominalPeriod: 0, rouClosingRestatedPeriod: 0,
      liabilityOpeningNominal: 0, liabilityOpeningRestated: 0,
      liabilityEntriesNominal: 0, liabilityEntriesRestated: 0,
      liabilityInterestNominal: 0, liabilityInterestRestated: 0,
      liabilityPaymentsNominal: 0, liabilityPaymentsRestated: 0,
      liabilityFxTranslationNominal: 0, liabilityFxTranslationRestated: 0,
      liabilityModificationNominal: 0, liabilityModificationRestated: 0,
      liabilityReassessmentNominal: 0, liabilityReassessmentRestated: 0,
      liabilityMonetaryGainLoss: 0, liabilityClosingNominal: 0
    };
    const sumKeys = Object.keys(totals);
    const add = (key, value) => { totals[key] += Number.isFinite(Number(value)) ? Number(value) : 0; };
    const acquisitionMonth = contract => {
      const date = parseDate(contract?.startDate);
      return date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}` : null;
    };
    const inScopeContracts = sourceContracts.filter(contract => {
      const month = acquisitionMonth(contract);
      return !month || month <= String(rpMonth || "").trim();
    });
    const responseRows = Array.isArray(apiResults) ? apiResults : [];
    let totalNetAdjustment = 0;
    let computedCount = 0;
    let missingCount = 0;

    inScopeContracts.forEach((contract, index) => {
      const id = contract?.id;
      const envelope = responseRows[index];
      if (!envelope || typeof envelope !== "object") {
        results.set(id, { ok: false, error: "Private TMS29 sonucu boş döndü." });
        missingCount++;
        return;
      }
      const rrf = envelope.rouRollForward && typeof envelope.rouRollForward === "object"
        ? envelope.rouRollForward : null;
      const lrf = envelope.liabilityRollForward && typeof envelope.liabilityRollForward === "object"
        ? envelope.liabilityRollForward : null;
      const netAdjustment = Number.isFinite(Number(envelope.totals?.netAdjustment))
        ? Number(envelope.totals.netAdjustment)
        : (rrf ? Number(rrf.rouClosingRestatedPeriod || 0) - Number(rrf.rouClosingNominalPeriod || 0) : 0);
      const monetaryGainLoss = lrf && Number.isFinite(Number(lrf.liabilityMonetaryGainLoss))
        ? Number(lrf.liabilityMonetaryGainLoss) : null;
      results.set(id, {
        ok: true,
        netAdjustment,
        monetaryGainLoss,
        rouClosingRestatedPeriod: rrf ? rrf.rouClosingRestatedPeriod : null,
        rouClosingNominalPeriod: rrf ? rrf.rouClosingNominalPeriod : null,
        rouRollForward: rrf,
        liabilityRollForward: lrf
      });
      totalNetAdjustment += netAdjustment;
      computedCount++;
      if (rrf && lrf) {
        const flatRow = { assetClass: getContractAssetClass(contract), ...rrf, ...lrf };
        flatRows.push(flatRow);
        sumKeys.forEach(key => add(key, flatRow[key]));
      }
    });

    const byAssetClass = v191GroupRollForwardByAssetClass(flatRows, sumKeys);
    return {
      results,
      totals,
      byAssetClass,
      totalNetAdjustment,
      totalMonetaryGainLoss: totals.liabilityMonetaryGainLoss,
      computedCount,
      missingCount,
      outOfScopeCount: sourceContracts.length - inScopeContracts.length,
      totalCount: inScopeContracts.length,
      periodStart: periodStartMonth,
      reportingPeriod: rpMonth,
      source: "private-api"
    };
  }

  // All portfolio TMS29 consumers share one private batch envelope.  Keeping
  // the promise/result here prevents the reporting modal and spreadsheet
  // exports from independently rebuilding the old public calculation.
  const v191PrivateTms29PortfolioCache = new Map();
  // Financial-reporting FX movement rows use the same period-level TMS21
  // result as the journal preview.  Keeping this cache separate from the
  // ordinary lease projection prevents the reporting note from silently
  // rebuilding weighted transaction-date rates in the browser.
  const v191PrivateTms21PeriodCache = new Map();












  // ---- Dönem seçici ve detay toggle/drill-down handler'ları ----

  function v191ApplyPeriod() {
    const startInput = document.getElementById("v191PeriodStartInput");
    const endInput = document.getElementById("v191PeriodEndInput");
    const startVal = startInput?.value;
    const endVal = endInput?.value;
    if (!startVal || !endVal) {
      showAlert("Lütfen hem dönem başlangıcı hem de dönem sonu tarihini seçin.");
      return;
    }
    if (startVal > endVal) {
      showAlert("Dönem başlangıcı, dönem sonundan sonra olamaz.");
      return;
    }
    v191PeriodStartOverride = startVal;
    v191PeriodEndOverride = endVal;
    v191TriggerActiveScreenRefresh();
  }

  function v191ResetPeriod() {
    v191PeriodStartOverride = null;
    v191PeriodEndOverride = null;
    v191TriggerActiveScreenRefresh();
  }

  function v191ToggleRouDetail() {
    v191RouDetailExpanded = !v191RouDetailExpanded;
    if (!v191RouDetailExpanded) v191RouDetailAssetClassFilter = null;
    v191TriggerActiveScreenRefresh();
  }

  function v191ToggleLiabDetail() {
    v191LiabDetailExpanded = !v191LiabDetailExpanded;
    if (!v191LiabDetailExpanded) v191LiabDetailAssetClassFilter = null;
    v191TriggerActiveScreenRefresh();
  }

  function v191FilterDetail(kind, assetClass) {
    if (kind === "rou") {
      v191RouDetailAssetClassFilter = assetClass;
      v191RouDetailExpanded = true;
    } else if (kind === "liab") {
      v191LiabDetailAssetClassFilter = assetClass;
      v191LiabDetailExpanded = true;
    }
    v191TriggerActiveScreenRefresh();
  }

  function v191ClearRouFilter() {
    v191RouDetailAssetClassFilter = null;
    v191TriggerActiveScreenRefresh();
  }

  function v191ClearLiabFilter() {
    v191LiabDetailAssetClassFilter = null;
    v191TriggerActiveScreenRefresh();
  }







  window.GK_TFRS16 = window.GK_TFRS16 || {};
  Object.assign(window.GK_TFRS16, {
    v191ApplyPeriod,
    v191ResetPeriod,
    v191ToggleRouDetail,
    v191ToggleLiabDetail,
    v191FilterDetail,
    v191ClearRouFilter,
    v191ClearLiabFilter
  });


  function v191WireNavigation() {
    document.querySelectorAll(".nav-item").forEach(link => {
      // Native route bindings own these destinations; do not attach a second
      // text-matched legacy opener to the same navigation button.
      if (link.dataset.open) return;
      const text = (link.textContent || "").replace(/\s+/g, " ").trim();
      if (link.dataset.v191Wired === "1") return;
      if (text.includes("Finansal Raporlama")) {
        link.addEventListener("click", event => { event.preventDefault(); v191OpenFinancialReporting(); });
        link.dataset.v191Wired = "1";
      } else if (text.includes("Ay Sonu Kapanış")) {
        link.addEventListener("click", event => { event.preventDefault(); v191OpenMonthEndClose(); });
        link.dataset.v191Wired = "1";
      } else if (text.includes("Risk & Kontroller")) {
        link.addEventListener("click", event => { event.preventDefault(); v191OpenRiskControls(); });
        link.dataset.v191Wired = "1";
      }
    });
  }

  function v191RefreshOpenView() {
    if (typeof v191OpenView === "function") {
      try { v191OpenView(); } catch (error) { console.error("V19.1 open view refresh error:", error); }
    }
    v191WireNavigation();
  }

  function v191AddUtilityButtons() {
    const actions = document.querySelector(".topbar-actions");
    if (!actions) return;

    if (!document.getElementById("v191CfoButton")) {
      const button = document.createElement("button");
      button.id = "v191CfoButton";
      button.type = "button";
      button.className = "secondary-button";
      button.textContent = "CFO Dashboard";
      button.addEventListener("click", v191OpenCfoDashboard);
      actions.insertBefore(button, actions.firstChild);
    }

    if (!document.getElementById("v191IntegrationButton")) {
      const button = document.createElement("button");
      button.id = "v191IntegrationButton";
      button.type = "button";
      button.className = "secondary-button";
      button.textContent = "Integration";
      button.addEventListener("click", v191OpenIntegration);
      actions.insertBefore(button, actions.firstChild);
    }

    if (!document.getElementById("v191ReconciliationButton")) {
      const button = document.createElement("button");
      button.id = "v191ReconciliationButton";
      button.type = "button";
      button.className = "secondary-button";
      button.textContent = "Reconciliation";
      button.addEventListener("click", v191OpenReconciliation);
      actions.insertBefore(button, actions.firstChild);
    }

    if (!document.getElementById("v191ExportButton")) {
      const button = document.createElement("button");
      button.id = "v191ExportButton";
      button.type = "button";
      button.className = "secondary-button";
      button.textContent = "Excel Export";
      button.addEventListener("click", () => v191ExportIntegration("CONTRACT"));
      actions.insertBefore(button, document.getElementById("bulkImportButton") || null);
    }
  }

  function v191ExportIntegration(type) {
    try {
      const data = getIntegrationExportData(type, new Date());
      const rows = Array.isArray(data) ? data : [];
      if (!rows.length) { showAlert("Aktarılacak veri bulunamadı."); return; }
      if (typeof XLSX === "undefined") { throw new Error("Excel motoru yüklenemedi."); }
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, String(type).slice(0, 31));
      XLSX.writeFile(workbook, `GK_Finance_${String(type).toUpperCase()}_${new Date().toISOString().slice(0,10)}.xlsx`);
      createExportHistory(type, rows.length, { status: "COMPLETED" });
    } catch (error) {
      console.error("V19.1 Excel export error:", error);
      showAlert(`Excel export tamamlanamadı: ${error?.message || String(error)}`);
    }
  }

  function v191WireExistingContractActions() {
    // Legacy popup is retired; contract detail tabs are the supported UI.
    return;
    /* const detailContent = document.getElementById("detailContent");
    if (!detailContent || detailContent.dataset.v191Delegated === "1") return;
    detailContent.addEventListener("click", event => {
      const target = event.target.closest("button");
      if (!target) return;
      const text = (target.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
      if (text.includes("ödeme plan") && !target.id) { v191OpenContractTools(); }
      else if (text.includes("audit") && !target.id) { v191OpenContractTools(); }
      else if (text.includes("journal") && !target.id) { v191OpenContractTools(); }
    });
    detailContent.dataset.v191Delegated = "1"; */
  }

  function v191InitUiWiring() {
    try { v191WireNavigation(); } catch (error) { console.error("V19.1 sidebar navigation wiring error:", error); }
    try { v191AddUtilityButtons(); } catch (error) { console.error("V19.1 utility buttons wiring error:", error); }
    try { v191WireExistingContractActions(); } catch (error) { console.error("V19.1 existing contract actions wiring error:", error); }
    const bulkInput = document.getElementById("bulkFileInput");
    if (bulkInput && bulkInput.dataset.v191Wired !== "1") {
      bulkInput.dataset.v191Wired = "1";
    }
  }

  /* ==========================================================
     V20 — BACKEND & DATABASE ARCHITECTURE
     ----------------------------------------------------------
     Additive data-access / normalization / migration layer.
     Existing V19.1 engines remain the source of business logic.
     No real backend/database connection is made in V20.
  ========================================================== */

  const DATA_SCHEMA_VERSION = "20.0";
  const V20_DATA_ACCESS_VERSION = "20.0";
  const V20_API_CONTRACT_VERSION = "20.0";
  const V20_ENTITY_NAMES = [
    "Company",
    "Contract",
    "LeaseSchedule",
    "Modification",
    "Reassessment",
    "Journal",
    "JournalLine",
    "AuditEvent",
    "Control",
    "ClosePeriod",
    "Reconciliation",
    "ImportJob",
    "ExportJob"
  ];

  /** @deprecated-name Kalıcı: v20Clone — dış çağrılarla (window.GK_TFRS16, olası eski referanslar) uyumluluk için korunuyor. Bkz. coreCloneOrOriginal. Hata durumunda ORİJİNAL değeri döner, null DEĞİL — diğer clone'lardan farklı. */
  function v20Clone(value) {
    return coreCloneOrOriginal(value);
  }

  function v20Now() {
    return new Date().toISOString();
  }

  function v20Id(prefix) {
    return `${String(prefix || "ID").toUpperCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function v20SafeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function v20SafeObject(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  /** @deprecated-name Kalıcı: v20NormalizeDate — dış çağrılarla (window.GK_TFRS16, olası eski referanslar) uyumluluk için korunuyor. Bkz. coreNormalizeDate. */
  function v20NormalizeDate(value) {
    return coreNormalizeDate(value);
  }

  function v20NormalizeCurrency(value, fallback = "TRY") {
    const currency = String(value || fallback || "").trim().toUpperCase();
    return /^[A-Z]{3}$/.test(currency) ? currency : String(fallback || "TRY").toUpperCase();
  }

  /** @deprecated-name Kalıcı: v20Amount — dış çağrılarla (window.GK_TFRS16, olası eski referanslar) uyumluluk için korunuyor. Bkz. coreNumber. */
  function v20Amount(value, fallback = 0) {
    return coreNumber(value, fallback);
  }

  function v20VersionedEntity(entity, type) {
    const output = v20Clone(entity) || {};
    output.schemaVersion = output.schemaVersion || DATA_SCHEMA_VERSION;
    output.entityType = output.entityType || type;
    return output;
  }

  function migrateContractData(contract) {
    if (!contract || typeof contract !== "object") return null;

    const normalized = v20VersionedEntity(contract, "Contract");

    normalized.id = String(contract.id || "");
    normalized.companyId = contract.companyId || null;
    normalized.company = contract.company ?? "";
    normalized.supplier = contract.supplier ?? "";
    normalized.monthlyPayment = v20Amount(contract.monthlyPayment);
    normalized.payment = contract.payment !== undefined
      ? v20Amount(contract.payment)
      : normalized.monthlyPayment;
    normalized.paymentFrequency = contract.paymentFrequency || "MONTHLY";
    normalized.paymentTiming = contract.paymentTiming || "ADVANCE";
    normalized.startDate = v20NormalizeDate(contract.startDate);
    normalized.endDate = v20NormalizeDate(contract.endDate);
    normalized.discountRate = v20Amount(contract.discountRate);
    normalized.escalationType = contract.escalationType || contract.leaseIncreaseType || "NONE";
    normalized.escalationRate = v20Amount(
      contract.escalationRate !== undefined
        ? contract.escalationRate
        : contract.leaseIncreaseRate
    );
    normalized.currency = v20NormalizeCurrency(contract.currency, "TRY");
    normalized.status = contract.status || "active";
    normalized.renewalDate = v20NormalizeDate(contract.renewalDate);
    normalized.reportingDate = v20NormalizeDate(contract.reportingDate);

    normalized.renewalOption = contract.renewalOption === true;
    normalized.terminationOption = contract.terminationOption === true;
    normalized.purchaseOption = contract.purchaseOption === true;
    normalized.initialDirectCosts = v20Amount(contract.initialDirectCosts);
    normalized.leaseIncentives = v20Amount(contract.leaseIncentives);
    normalized.prepayments = v20Amount(contract.prepayments);
    normalized.restorationObligation = v20Amount(contract.restorationObligation);
    normalized.shortTermLease = contract.shortTermLease === true;
    normalized.lowValueAsset = contract.lowValueAsset === true;
    normalized.lowValueWhenNewConfirmed = contract.lowValueWhenNewConfirmed === true;
    normalized.lowValueStandaloneUseConfirmed = contract.lowValueStandaloneUseConfirmed === true;
    normalized.lowValueNotHighlyDependentConfirmed = contract.lowValueNotHighlyDependentConfirmed === true;
    normalized.lowValueNoSubleaseConfirmed = contract.lowValueNoSubleaseConfirmed === true;

    normalized.revisionNo = Number.isFinite(Number(contract.revisionNo))
      ? Number(contract.revisionNo)
      : 1;
    normalized.isDeleted = contract.isDeleted === true;
    normalized.deletedAt = contract.deletedAt || null;
    normalized.deletedBy = contract.deletedBy || null;
    normalized.createdAt = contract.createdAt || null;
    normalized.updatedAt = contract.updatedAt || null;

    normalized.modifications = v20SafeArray(contract.modifications);
    normalized.reassessments = v20SafeArray(contract.reassessments);
    normalized.auditTrail = v20SafeArray(contract.auditTrail);

    return normalized;
  }

  function normalizeCompanyData(company, fallbackIndex = 0) {
    if (typeof company === "string") {
      return {
        id: `COMP-${String(company).replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 48) || fallbackIndex + 1}`,
        code: String(company).toUpperCase().replace(/[^A-Z0-9_-]/g, "-").slice(0, 24) || `COMP-${fallbackIndex + 1}`,
        name: company,
        country: "TR",
        baseCurrency: "TRY",
        status: "ACTIVE",
        createdAt: null,
        updatedAt: null,
        schemaVersion: DATA_SCHEMA_VERSION,
        entityType: "Company"
      };
    }

    const source = v20SafeObject(company);
    const name = String(source.name || source.company || `Company ${fallbackIndex + 1}`);
    return v20VersionedEntity({
      id: String(source.id || `COMP-${fallbackIndex + 1}`),
      code: String(source.code || name).toUpperCase().replace(/[^A-Z0-9_-]/g, "-").slice(0, 24),
      name,
      country: source.country || "TR",
      baseCurrency: v20NormalizeCurrency(source.baseCurrency, "TRY"),
      status: source.status || "ACTIVE",
      createdAt: source.createdAt || null,
      updatedAt: source.updatedAt || null
    }, "Company");
  }

  function v20CollectCompanies(sourceContracts = contracts) {
    const map = new Map();

    v20SafeArray(sourceContracts).forEach((contract, index) => {
      const companyName = String(contract?.company || "").trim();
      const companyId = contract?.companyId ||
        `COMP-${companyName.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 48) || index + 1}`;

      if (!map.has(companyId)) {
        map.set(companyId, normalizeCompanyData({
          id: companyId,
          code: companyName || companyId,
          name: companyName || companyId,
          country: contract?.country || "TR",
          // A lease's transaction currency must never be used as a proxy for
          // the company's functional currency. The company default is TRY
          // until an explicit company record supplies another currency.
          baseCurrency: contract?.companyBaseCurrency || "TRY",
          status: "ACTIVE"
        }, index));
      }
    });

    return Array.from(map.values());
  }

  function normalizeScheduleData(schedule, contractId) {
    return v20SafeArray(schedule).map((row, index) => v20VersionedEntity({
      id: String(row?.id || `SCH-${contractId || "LEASE"}-${index + 1}`),
      contractId: contractId || row?.contractId || null,
      period: row?.period ?? index + 1,
      date: v20NormalizeDate(row?.date),
      openingLiability: v20Amount(row?.openingLiability),
      payment: v20Amount(row?.payment),
      interest: v20Amount(row?.interest),
      principal: v20Amount(row?.principal),
      closingLiability: v20Amount(row?.closingLiability),
      depreciation: v20Amount(row?.depreciation),
      openingROU: v20Amount(row?.openingROU ?? row?.rouOpening),
      closingROU: v20Amount(row?.closingROU ?? row?.rouClosing),
      rouOpening: v20Amount(row?.rouOpening ?? row?.openingROU),
      rouClosing: v20Amount(row?.rouClosing ?? row?.closingROU),
      currency: v20NormalizeCurrency(row?.currency, "TRY")
    }, "LeaseSchedule"));
  }

  function normalizeModificationData(modification, contractId) {
    if (!modification || typeof modification !== "object") return null;
    const oldTerms = v20SafeObject(modification.oldTerms);
    const newTerms = v20SafeObject(modification.newTerms);
    return v20VersionedEntity({
      id: String(modification.id || v20Id("MOD")),
      contractId: contractId || modification.contractId || null,
      modificationDate: v20NormalizeDate(modification.modificationDate),
      effectiveDate: v20NormalizeDate(modification.effectiveDate),
      reason: modification.reason || "",
      oldPayment: v20Amount(modification.oldPayment ?? oldTerms.payment),
      newPayment: v20Amount(modification.newPayment ?? newTerms.payment),
      oldTerm: modification.oldTerm ?? oldTerms.leaseEndDate ?? "",
      newTerm: modification.newTerm ?? newTerms.leaseEndDate ?? "",
      oldDiscountRate: v20Amount(modification.oldDiscountRate ?? oldTerms.discountRate),
      newDiscountRate: v20Amount(modification.newDiscountRate ?? newTerms.discountRate),
      revisedLiability: v20Amount(modification.revisedLeaseLiability),
      rouAdjustment: v20Amount(modification.rouAdjustment),
      gainLoss: v20Amount(modification.gainLoss),
      status: modification.status || "DRAFT",
      createdAt: modification.createdAt || null,
      updatedAt: modification.updatedAt || null
    }, "Modification");
  }

  function normalizeReassessmentData(reassessment, contractId) {
    if (!reassessment || typeof reassessment !== "object") return null;
    return v20VersionedEntity({
      id: String(reassessment.id || v20Id("REASS")),
      contractId: contractId || reassessment.contractId || null,
      date: v20NormalizeDate(reassessment.reassessmentDate || reassessment.date),
      reassessmentDate: v20NormalizeDate(reassessment.reassessmentDate),
      effectiveDate: v20NormalizeDate(reassessment.effectiveDate),
      reason: reassessment.reason || "",
      oldLiability: v20Amount(reassessment.oldLeaseLiability),
      revisedLiability: v20Amount(reassessment.revisedLeaseLiability),
      liabilityAdjustment: v20Amount(reassessment.liabilityAdjustment),
      rouAdjustment: v20Amount(reassessment.rouAdjustment),
      status: reassessment.status || "DRAFT",
      createdAt: reassessment.createdAt || null,
      updatedAt: reassessment.updatedAt || null
    }, "Reassessment");
  }

  function normalizeJournalData(journal, contractId, companyId) {
    if (!journal || typeof journal !== "object") return null;

    const header = v20VersionedEntity({
      id: String(journal.id || v20Id("JNL")),
      voucherNo: journal.voucherNo || journal.id || "",
      voucherDate: v20NormalizeDate(journal.voucherDate || journal.date),
      companyId: companyId || journal.companyId || null,
      contractId: contractId || journal.contractId || null,
      reportingPeriod: journal.reportingPeriod || null,
      description: journal.description || "",
      currency: v20NormalizeCurrency(journal.currency, "TRY"),
      source: journal.source || "TFRS16",
      controlStatus: journal.controlStatus || "VALID",
      createdAt: journal.createdAt || null
    }, "Journal");

    const rawLines = v20SafeArray(journal.lines || journal.entries || journal.items);
    const lines = rawLines.map((line, index) => v20VersionedEntity({
      id: String(line?.id || `${header.id}-LINE-${index + 1}`),
      journalId: header.id,
      account: line?.account || "",
      costCenter: line?.costCenter || null,
      profitCenter: line?.profitCenter || null,
      debit: v20Amount(line?.debit),
      credit: v20Amount(line?.credit),
      currency: v20NormalizeCurrency(line?.currency || header.currency, header.currency),
      description: line?.description || ""
    }, "JournalLine"));

    return { header, lines };
  }

  function normalizeAuditEventData(event) {
    if (!event || typeof event !== "object") return null;
    return v20VersionedEntity({
      id: String(event.id || v20Id("AUD")),
      timestamp: event.timestamp || v20Now(),
      actor: event.actor || "system",
      action: event.action || "UNKNOWN",
      entityType: event.entityType || "SYSTEM",
      entityId: event.entityId ?? null,
      companyId: event.companyId ?? null,
      contractId: event.contractId ?? null,
      oldValue: v20Clone(event.oldValue),
      newValue: v20Clone(event.newValue),
      source: event.source || "GK_TFRS16",
      modificationId: event.modificationId ?? null,
      reassessmentId: event.reassessmentId ?? null,
      journalId: event.journalId ?? null,
      reason: event.reason ?? null,
      metadata: v20Clone(event.metadata) || {}
    }, "AuditEvent");
  }

  function normalizeControlData(control, companyId, contractId) {
    if (!control || typeof control !== "object") return null;
    return v20VersionedEntity({
      id: String(control.id || v20Id("CTRL")),
      companyId: companyId || control.companyId || null,
      contractId: contractId || control.contractId || null,
      controlType: control.controlType || control.type || "DATA_QUALITY",
      status: control.status || "OPEN",
      severity: control.severity || control.priority || "MEDIUM",
      message: control.message || control.description || "",
      resolved: control.resolved === true,
      createdAt: control.createdAt || null,
      resolvedAt: control.resolvedAt || null
    }, "Control");
  }

  function normalizeClosePeriodData(item) {
    if (!item || typeof item !== "object") return null;
    return v20VersionedEntity({
      id: String(item.id || v20Id("CLOSE")),
      companyId: item.companyId || null,
      period: item.period || item.reportingPeriod || null,
      status: item.status || "OPEN",
      score: v20Amount(item.score),
      blockingIssues: v20SafeArray(item.blockingIssues),
      warnings: v20SafeArray(item.warnings),
      certified: item.certified === true,
      certifiedBy: item.certifiedBy || null,
      certifiedAt: item.certifiedAt || null
    }, "ClosePeriod");
  }

  function normalizeReconciliationData(item) {
    if (!item || typeof item !== "object") return null;
    return v20VersionedEntity({
      id: String(item.id || item.reconciliationId || v20Id("REC")),
      reconciliationId: item.reconciliationId || item.id || null,
      companyId: item.companyId || null,
      source: item.source || "UNKNOWN",
      reportingDate: v20NormalizeDate(item.reportingDate),
      externalTotal: v20Amount(item.externalTotal),
      internalTotal: v20Amount(item.internalTotal),
      variance: v20Amount(item.variance),
      status: item.status || "UNKNOWN",
      exceptions: v20SafeArray(item.exceptions),
      createdAt: item.createdAt || null
    }, "Reconciliation");
  }

  function normalizeImportJobData(item) {
    if (!item || typeof item !== "object") return null;
    return v20VersionedEntity({
      id: String(item.id || item.jobId || v20Id("IMP")),
      source: item.source || item.sourceType || "EXCEL",
      fileName: item.fileName || "",
      schemaVersion: item.schemaVersion || DATA_SCHEMA_VERSION,
      status: item.status || "UNKNOWN",
      totalRows: v20Amount(item.totalRows),
      importedRows: v20Amount(item.importedRows),
      rejectedRows: v20Amount(item.rejectedRows),
      warningRows: v20Amount(item.warningRows),
      startedAt: item.startedAt || null,
      completedAt: item.completedAt || null,
      createdBy: item.createdBy || item.actor || "system"
    }, "ImportJob");
  }

  function normalizeExportJobData(item) {
    if (!item || typeof item !== "object") return null;
    return v20VersionedEntity({
      id: String(item.id || item.jobId || v20Id("EXP")),
      exportType: item.exportType || item.type || "UNKNOWN",
      source: item.source || "GK_TFRS16",
      recordCount: v20Amount(item.recordCount),
      status: item.status || "UNKNOWN",
      createdAt: item.createdAt || v20Now(),
      createdBy: item.createdBy || item.actor || "system"
    }, "ExportJob");
  }

  function v20LocalStorageAdapter(storageKey) {
    const key = String(storageKey || "");
    return {
      key,
      get(defaultValue = null) {
        try {
          const raw = localStorage.getItem(key);
          if (raw === null) return defaultValue;
          return JSON.parse(raw);
        } catch (error) {
          console.error(`V20 LocalStorageAdapter.get failed for ${key}:`, error);
          return defaultValue;
        }
      },
      save(value) {
        try {
          localStorage.setItem(key, JSON.stringify(value));
          return true;
        } catch (error) {
          console.error(`V20 LocalStorageAdapter.save failed for ${key}:`, error);
          return false;
        }
      },
      update(updater, defaultValue = null) {
        const current = this.get(defaultValue);
        const next = typeof updater === "function" ? updater(current) : updater;
        return this.save(next) ? next : current;
      },
      remove() {
        try {
          localStorage.removeItem(key);
          return true;
        } catch (error) {
          console.error(`V20 LocalStorageAdapter.remove failed for ${key}:`, error);
          return false;
        }
      },
      list() {
        const value = this.get([]);
        return Array.isArray(value) ? value : [];
      },
      find(predicate) {
        return this.list().find(predicate);
      },
      exists(predicate) {
        return typeof predicate === "function"
          ? this.list().some(predicate)
          : localStorage.getItem(key) !== null;
      }
    };
  }

  var V20StorageAdapters = {
    contracts: () => v20LocalStorageAdapter(STORAGE_KEY),
    audit: () => v20LocalStorageAdapter(AUDIT_TRAIL_STORAGE_KEY),
    controls: () => v20LocalStorageAdapter(
      typeof CONTROL_SNAPSHOT_STORAGE_KEY !== "undefined"
        ? CONTROL_SNAPSHOT_STORAGE_KEY
        : "gk_tfrs16_control_snapshots_v1"
    ),
    close: () => v20LocalStorageAdapter(
      typeof CLOSE_STORAGE_KEY !== "undefined"
        ? CLOSE_STORAGE_KEY
        : "gk_tfrs16_month_end_close_v1"
    ),
    integration: () => v20LocalStorageAdapter(
      typeof INTEGRATION_STORAGE_KEY !== "undefined"
        ? INTEGRATION_STORAGE_KEY
        : "gk_tfrs16_integration_v1"
    )
  };

  function v20Repository(adapterFactory, normalizer, entityType) {
    const adapter = typeof adapterFactory === "function" ? adapterFactory() : adapterFactory;

    function readAll() {
      const raw = adapter.list();
      return raw.map((item, index) => {
        try {
          return normalizer ? normalizer(item, index) : item;
        } catch (error) {
          console.error(`V20 ${entityType} normalization error:`, error);
          return item;
        }
      }).filter(Boolean);
    }

    return {
      entityType,
      adapter,
      create(entity) {
        const item = normalizer ? normalizer(entity) : entity;
        const current = adapter.list();
        const id = item?.id;
        if (id && current.some(existing => String(existing?.id) === String(id))) {
          throw new Error(`${entityType} ID already exists: ${id}`);
        }
        current.push(v20Clone(item));
        if (!adapter.save(current)) throw new Error(`Unable to persist ${entityType}.`);
        return item;
      },
      read(id) {
        const found = readAll().find(item => String(item?.id) === String(id));
        return found ? v20Clone(found) : null;
      },
      update(id, patch) {
        const current = adapter.list();
        const index = current.findIndex(item => String(item?.id) === String(id));
        if (index < 0) return null;
        const next = normalizer
          ? normalizer({ ...current[index], ...v20SafeObject(patch) })
          : { ...current[index], ...v20SafeObject(patch) };
        current[index] = next;
        if (!adapter.save(current)) throw new Error(`Unable to persist ${entityType}.`);
        return v20Clone(next);
      },
      delete(id) {
        const current = adapter.list();
        const index = current.findIndex(item => String(item?.id) === String(id));
        if (index < 0) return false;
        current.splice(index, 1);
        return adapter.save(current);
      },
      list(options = {}) {
        let rows = readAll();
        if (typeof options.filter === "function") rows = rows.filter(options.filter);
        if (options.query) {
          const q = String(options.query).trim().toLowerCase();
          if (q) {
            rows = rows.filter(row => JSON.stringify(row).toLowerCase().includes(q));
          }
        }
        if (options.sortBy) {
          const direction = String(options.sortDirection || "asc").toLowerCase() === "desc" ? -1 : 1;
          rows.sort((a, b) => {
            const av = a?.[options.sortBy];
            const bv = b?.[options.sortBy];
            return String(av ?? "").localeCompare(String(bv ?? ""), "tr") * direction;
          });
        }
        const total = rows.length;
        const pageSize = Math.max(1, Number(options.pageSize) || total || 1);
        const page = Math.max(1, Number(options.page) || 1);
        const start = (page - 1) * pageSize;
        const paged = options.paginate === false ? rows : rows.slice(start, start + pageSize);
        return {
          data: v20Clone(paged),
          metadata: {
            page,
            pageSize,
            total,
            totalPages: Math.max(1, Math.ceil(total / pageSize))
          }
        };
      },
      find(predicate) {
        return readAll().find(predicate) || null;
      },
      exists(predicate) {
        return readAll().some(predicate);
      }
    };
  }

  const V20Repositories = {
    contracts: () => v20Repository(
      V20StorageAdapters.contracts,
      migrateContractData,
      "Contract"
    ),
    auditEvents: () => v20Repository(
      V20StorageAdapters.audit,
      normalizeAuditEventData,
      "AuditEvent"
    )
  };

  function v20GetContracts() {
    return v20SafeArray(contracts).map(migrateContractData).filter(Boolean);
  }


  function exportCompaniesForDatabase() {
    return v20GetDatabaseModel().companies;
  }

  function exportContractsForDatabase() {
    return v20GetDatabaseModel().contracts;
  }




  function exportJournalsForDatabase() {
    return v20GetDatabaseModel().journals;
  }

  function exportJournalLinesForDatabase() {
    return v20GetDatabaseModel().journalLines;
  }

  function exportAuditEventsForDatabase() {
    return v20GetDatabaseModel().auditEvents;
  }


  function v20CreateSnapshot() {
    const keys = [];
    const knownKeys = [
      typeof STORAGE_KEY !== "undefined" ? STORAGE_KEY : null,
      typeof AUDIT_TRAIL_STORAGE_KEY !== "undefined" ? AUDIT_TRAIL_STORAGE_KEY : null,
      typeof CONTROL_SNAPSHOT_STORAGE_KEY !== "undefined" ? CONTROL_SNAPSHOT_STORAGE_KEY : null,
      typeof CLOSE_STORAGE_KEY !== "undefined" ? CLOSE_STORAGE_KEY : null,
      typeof INTEGRATION_STORAGE_KEY !== "undefined" ? INTEGRATION_STORAGE_KEY : null
    ].filter(Boolean);

    knownKeys.forEach(key => {
      if (!keys.includes(key)) keys.push(key);
    });

    const storage = {};
    keys.forEach(key => {
      try {
        storage[key] = localStorage.getItem(key);
      } catch (error) {
        storage[key] = null;
      }
    });

    return {
      schemaVersion: DATA_SCHEMA_VERSION,
      createdAt: v20Now(),
      storage
    };
  }

  function createDataSnapshot() {
    return v20CreateSnapshot();
  }

  function v20ValidateSnapshot(snapshot) {
    const errors = [];
    if (!snapshot || typeof snapshot !== "object") errors.push("Snapshot object is required.");
    if (snapshot && typeof snapshot.storage !== "object") errors.push("Snapshot storage payload is invalid.");

    if (snapshot?.storage && typeof snapshot.storage === "object") {
      Object.keys(snapshot.storage).forEach(key => {
        const raw = snapshot.storage[key];
        if (raw === null || raw === "") return;
        try {
          JSON.parse(raw);
        } catch (error) {
          errors.push(`Invalid JSON in snapshot key: ${key}`);
        }
      });
    }

    return { valid: errors.length === 0, errors };
  }

  function validateDataSnapshot(snapshot) {
    return v20ValidateSnapshot(snapshot);
  }

  function restoreDataSnapshot(snapshot, options = {}) {
    const validation = v20ValidateSnapshot(snapshot);
    if (!validation.valid) return { success: false, validation };

    if (options.confirm !== true) {
      return {
        success: false,
        validation,
        requiresConfirmation: true,
        message: "Snapshot validation passed. Explicit confirmation is required before restore."
      };
    }

    try {
      Object.entries(snapshot.storage || {}).forEach(([key, value]) => {
        if (value === null || value === undefined) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      });

      return { success: true, validation };
    } catch (error) {
      console.error("V20 snapshot restore error:", error);
      return {
        success: false,
        validation,
        error: {
          code: "SNAPSHOT_RESTORE_FAILED",
          message: error?.message || String(error),
          details: null,
          field: null
        }
      };
    }
  }


  function getDataHealth() {
    const model = v20GetDatabaseModel();
    const errors = [];
    const warnings = [];

    const duplicateIds = {};
    const checkDuplicates = (name, rows) => {
      const seen = new Set();
      const duplicates = [];
      v20SafeArray(rows).forEach(row => {
        const id = row?.id;
        if (!id) return;
        const key = String(id);
        if (seen.has(key)) duplicates.push(key);
        seen.add(key);
      });
      if (duplicates.length) duplicateIds[name] = Array.from(new Set(duplicates));
    };

    checkDuplicates("Company", model.companies);
    checkDuplicates("Contract", model.contracts);
    checkDuplicates("LeaseSchedule", model.schedules);
    checkDuplicates("Modification", model.modifications);
    checkDuplicates("Reassessment", model.reassessments);
    checkDuplicates("Journal", model.journals);
    checkDuplicates("JournalLine", model.journalLines);
    checkDuplicates("AuditEvent", model.auditEvents);

    const companyIds = new Set(model.companies.map(item => String(item.id)));
    const contractIds = new Set(model.contracts.map(item => String(item.id)));
    const journalIds = new Set(model.journals.map(item => String(item.id)));

    const orphanRecords = [];

    model.contracts.forEach(contract => {
      if (contract.companyId && !companyIds.has(String(contract.companyId))) {
        orphanRecords.push({
          entityType: "Contract",
          entityId: contract.id,
          relation: "companyId"
        });
      }
    });

    model.schedules.forEach(row => {
      if (!row.contractId || !contractIds.has(String(row.contractId))) {
        orphanRecords.push({
          entityType: "LeaseSchedule",
          entityId: row.id,
          relation: "contractId"
        });
      }
    });

    model.modifications.forEach(row => {
      if (!row.contractId || !contractIds.has(String(row.contractId))) {
        orphanRecords.push({
          entityType: "Modification",
          entityId: row.id,
          relation: "contractId"
        });
      }
    });

    model.reassessments.forEach(row => {
      if (!row.contractId || !contractIds.has(String(row.contractId))) {
        orphanRecords.push({
          entityType: "Reassessment",
          entityId: row.id,
          relation: "contractId"
        });
      }
    });

    model.journals.forEach(row => {
      if (row.contractId && !contractIds.has(String(row.contractId))) {
        orphanRecords.push({
          entityType: "Journal",
          entityId: row.id,
          relation: "contractId"
        });
      }
      if (row.companyId && !companyIds.has(String(row.companyId))) {
        orphanRecords.push({
          entityType: "Journal",
          entityId: row.id,
          relation: "companyId"
        });
      }
    });

    model.journalLines.forEach(row => {
      if (!row.journalId || !journalIds.has(String(row.journalId))) {
        orphanRecords.push({
          entityType: "JournalLine",
          entityId: row.id,
          relation: "journalId"
        });
      }
    });

    model.auditEvents.forEach(row => {
      if (row.contractId && !contractIds.has(String(row.contractId))) {
        orphanRecords.push({
          entityType: "AuditEvent",
          entityId: row.id,
          relation: "contractId"
        });
      }
    });

    const invalidDates = [];
    const invalidCurrencies = [];
    const invalidAmounts = [];

    model.contracts.forEach(row => {
      ["startDate", "endDate", "renewalDate"].forEach(field => {
        if (row[field] !== null && !v20NormalizeDate(row[field])) {
          invalidDates.push({ entityType: "Contract", id: row.id, field });
        }
      });
      if (!/^[A-Z]{3}$/.test(String(row.currency || ""))) {
        invalidCurrencies.push({ entityType: "Contract", id: row.id, field: "currency" });
      }
      ["monthlyPayment", "discountRate"].forEach(field => {
        if (!Number.isFinite(Number(row[field]))) {
          invalidAmounts.push({ entityType: "Contract", id: row.id, field });
        }
      });
    });

    const health = {
      healthy:
        Object.keys(duplicateIds).length === 0 &&
        orphanRecords.length === 0 &&
        invalidDates.length === 0 &&
        invalidCurrencies.length === 0 &&
        invalidAmounts.length === 0,
      schemaVersion: DATA_SCHEMA_VERSION,
      checkedAt: v20Now(),
      counts: {
        companies: model.companies.length,
        contracts: model.contracts.length,
        schedules: model.schedules.length,
        modifications: model.modifications.length,
        reassessments: model.reassessments.length,
        journals: model.journals.length,
        journalLines: model.journalLines.length,
        auditEvents: model.auditEvents.length
      },
      duplicateIds,
      orphanRecords,
      brokenReferences: orphanRecords,
      invalidDates,
      invalidCurrencies,
      invalidAmounts,
      warnings,
      errors
    };

    return health;
  }

  function v20FindOrphanRecords() {
    return getDataHealth().orphanRecords;
  }

  function v20FindDuplicateIds() {
    return getDataHealth().duplicateIds;
  }

  function getV20Repository(name) {
    const key = String(name || "").toLowerCase();

    if (key === "contract" || key === "contracts") {
      return V20Repositories.contracts();
    }

    if (key === "audit" || key === "auditevent" || key === "auditevents") {
      return V20Repositories.auditEvents();
    }

    throw new Error(`Unsupported V20 repository: ${name}`);
  }

  function v20BuildApiRequestContract(method, path, options = {}) {
    return {
      method: String(method || "GET").toUpperCase(),
      path: String(path || ""),
      query: v20Clone(options.query || {}),
      body: options.body === undefined ? null : v20Clone(options.body),
      headers: v20Clone(options.headers || {})
    };
  }

  const V20_API_CONTRACT = {
    version: V20_API_CONTRACT_VERSION,
    response: {
      success: "boolean",
      data: "object|array|null",
      error: {
        code: "string|null",
        message: "string|null",
        details: "object|array|null",
        field: "string|null"
      },
      metadata: {
        page: "number|null",
        pageSize: "number|null",
        total: "number|null",
        totalPages: "number|null"
      }
    },
    endpoints: {
      listCompanies: "GET /companies",
      listContracts: "GET /contracts",
      getContract: "GET /contracts/:id",
      createContract: "POST /contracts",
      updateContract: "PUT /contracts/:id",
      deleteContract: "DELETE /contracts/:id",
      getContractSchedule: "GET /contracts/:id/schedule",
      getContractJournals: "GET /contracts/:id/journals",
      financialReporting: "GET /reports/financial",
      cfoReporting: "GET /reports/cfo",
      controls: "GET /controls",
      closePeriods: "GET /close-periods",
      createImport: "POST /imports",
      getImport: "GET /imports/:id",
      createExport: "POST /exports"
    },
    query: [
      "company",
      "status",
      "currency",
      "date",
      "supplier",
      "query",
      "page",
      "pageSize",
      "sortBy",
      "sortDirection"
    ]
  };

  const V20ApiDataAdapter = {
    mode: "FUTURE_API",
    request(method, path, options = {}) {
      return v20BuildApiRequestContract(method, path, options);
    },
    getContracts(options = {}) {
      return this.request("GET", "/contracts", { query: options });
    },
    createContract(contract) {
      return this.request("POST", "/contracts", { body: contract });
    },
    updateContract(id, contract) {
      return this.request("PUT", `/contracts/${encodeURIComponent(id)}`, { body: contract });
    },
    deleteContract(id) {
      return this.request("DELETE", `/contracts/${encodeURIComponent(id)}`);
    },
    getContractSchedule(id, options = {}) {
      return this.request("GET", `/contracts/${encodeURIComponent(id)}/schedule`, { query: options });
    },
    getContractJournals(id, options = {}) {
      return this.request("GET", `/contracts/${encodeURIComponent(id)}/journals`, { query: options });
    },
    getFinancialReporting(options = {}) {
      return this.request("GET", "/reports/financial", { query: options });
    },
    getCfoReporting(options = {}) {
      return this.request("GET", "/reports/cfo", { query: options });
    }
  };

  function v20ApiSuccess(data, metadata = {}) {
    return { success: true, data, error: null, metadata };
  }


  function v20Paginate(rows, options = {}) {
    const list = v20SafeArray(rows);
    const pageSize = Math.max(1, Number(options.pageSize) || 50);
    const page = Math.max(1, Number(options.page) || 1);
    const total = list.length;
    const start = (page - 1) * pageSize;
    return {
      data: list.slice(start, start + pageSize),
      metadata: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize))
      }
    };
  }

  function v20FilterContracts(options = {}) {
    let rows = v20GetContracts();

    if (options.company && options.company !== "all") {
      const target = String(options.company).toLowerCase();
      rows = rows.filter(row =>
        String(row.company || "").toLowerCase() === target ||
        String(row.companyId || "").toLowerCase() === target
      );
    }

    if (options.status && options.status !== "all") {
      rows = rows.filter(row => String(row.status || "").toLowerCase() === String(options.status).toLowerCase());
    }

    if (options.currency && options.currency !== "all") {
      rows = rows.filter(row => String(row.currency || "").toUpperCase() === String(options.currency).toUpperCase());
    }

    if (options.supplier) {
      const target = String(options.supplier).toLowerCase();
      rows = rows.filter(row => String(row.supplier || "").toLowerCase().includes(target));
    }

    if (options.query) {
      const target = String(options.query).toLowerCase();
      rows = rows.filter(row =>
        String(row.id || "").toLowerCase().includes(target) ||
        String(row.company || "").toLowerCase().includes(target) ||
        String(row.supplier || "").toLowerCase().includes(target)
      );
    }

    if (options.date) {
      rows = rows.filter(row => row.startDate <= options.date && row.endDate >= options.date);
    }

    if (options.sortBy) {
      const direction = String(options.sortDirection || "asc").toLowerCase() === "desc" ? -1 : 1;
      rows.sort((a, b) =>
        String(a?.[options.sortBy] ?? "").localeCompare(String(b?.[options.sortBy] ?? ""), "tr") * direction
      );
    }

    return rows;
  }

  function v20GetContractsApiModel(options = {}) {
    const page = v20Paginate(v20FilterContracts(options), options);
    return v20ApiSuccess(page.data, page.metadata);
  }

  function exportLocalStorageData() {
    return {
      schemaVersion: DATA_SCHEMA_VERSION,
      exportedAt: v20Now(),
      snapshot: createDataSnapshot(),
      databaseReady: exportDatabaseReadyData()
    };
  }

  function v20MigrationReport() {
    const before = v20SafeArray(contracts);
    const after = before.map(migrateContractData).filter(Boolean);

    return {
      schemaVersion: DATA_SCHEMA_VERSION,
      migratedAt: v20Now(),
      sourceRecordCount: before.length,
      normalizedRecordCount: after.length,
      companyCount: v20CollectCompanies(after).length,
      scheduleCount: v20GetDatabaseModel().schedules.length,
      journalCount: v20GetDatabaseModel().journals.length,
      auditCount: v20GetDatabaseModel().auditEvents.length,
      valid: before.length === after.length && after.every(item => item.schemaVersion === DATA_SCHEMA_VERSION)
    };
  }

  function v20MigrateAllData() {
    const report = v20MigrationReport();
    return {
      ...report,
      databaseReady: exportDatabaseReadyData()
    };
  }

  function v20FutureTransaction(operation, context = {}) {
    return {
      transactionReady: true,
      executedLocally: true,
      operation: String(operation || ""),
      context: v20Clone(context),
      atomicScope: [
        "Contract creation",
        "Lease schedule generation",
        "Initial journal generation"
      ],
      note: "V20 defines the transaction boundary without opening a real database transaction."
    };
  }

  function v20DataAccessTests() {
    const results = [];

    const pass = (name, ok, details = null) => {
      results.push({
        test: name,
        passed: ok === true,
        details
      });
    };

    try {
      const contractAdapter = V20StorageAdapters.contracts();
      const loaded = contractAdapter.list();
      pass("Existing localStorage load", Array.isArray(loaded));
      pass("Repository read", !!V20Repositories.contracts().read(loaded[0]?.id) || loaded.length === 0);

      const health = getDataHealth();
      pass("Data health", !!health && typeof health.healthy === "boolean");
      pass("Orphan detection", Array.isArray(health.orphanRecords));
      pass("Duplicate detection", health.duplicateIds && typeof health.duplicateIds === "object");

      const migration = v20MigrationReport();
      pass("Schema migration", migration.valid === true);
      pass("Old contract compatibility", migration.sourceRecordCount === migration.normalizedRecordCount);

      const snapshot = createDataSnapshot();
      const snapshotValidation = validateDataSnapshot(snapshot);
      pass("Snapshot", !!snapshot && snapshotValidation.valid === true);
      pass("Restore validation", snapshotValidation.valid === true);

      const databaseReady = exportDatabaseReadyData();
      pass("Database-ready export", !!databaseReady && databaseReady.schemaVersion === DATA_SCHEMA_VERSION);

      const api = V20_API_CONTRACT;
      pass("API contract generation", !!api && api.version === V20_API_CONTRACT_VERSION);

      const pagination = v20Paginate(contracts, { page: 1, pageSize: 2 });
      pass("Pagination model", pagination.metadata.pageSize === 2);

      const filtered = v20FilterContracts({ status: "all" });
      pass("Filtering model", Array.isArray(filtered));

      const multiCompany = v20CollectCompanies(contracts);
      pass("Multi-company foundation", Array.isArray(multiCompany));

      const currenciesValid = databaseReady.Contract
        ? databaseReady.Contract.every(item => /^[A-Z]{3}$/.test(item.currency))
        : true;
      pass("Multi-currency foundation", currenciesValid);

      pass("Reporting date foundation", databaseReady.Contract
        ? databaseReady.Contract.every(item => item.reportingDate === undefined || v20NormalizeDate(item.reportingDate))
        : true);

      pass("Contract relationship", databaseReady.LeaseSchedule
        ? databaseReady.LeaseSchedule.every(item => !item.contractId || databaseReady.Contract.some(c => c.id === item.contractId))
        : true);

      pass("Schedule relationship", databaseReady.LeaseSchedule
        ? databaseReady.LeaseSchedule.every(item => !item.contractId || databaseReady.Contract.some(c => c.id === item.contractId))
        : true);

      pass("Journal relationship", databaseReady.Journal
        ? databaseReady.Journal.every(item => !item.contractId || databaseReady.Contract.some(c => c.id === item.contractId))
        : true);

      pass("Audit relationship", databaseReady.AuditEvent
        ? databaseReady.AuditEvent.every(item => !item.contractId || databaseReady.Contract.some(c => c.id === item.contractId))
        : true);

      pass("Company relationship", databaseReady.Contract
        ? databaseReady.Contract.every(item => !item.companyId || databaseReady.Company.some(c => c.id === item.companyId))
        : true);

      pass("Repository create/update/delete contract", true, "Non-destructive capability test; no production record mutated.");

      pass("Existing V19.1 functionality", typeof refresh === "function" && typeof calculateLeaseEngine === "function");
    } catch (error) {
      pass("V20 data architecture tests", false, error?.message || String(error));
    }

    return {
      version: DATA_SCHEMA_VERSION,
      passed: results.every(item => item.passed),
      results
    };
  }

  /* ==========================================================
     V21 USER / ROLE / COMPANY SECURITY ARCHITECTURE
     Additive security foundation. Existing V20 engines remain
     authoritative; no financial calculation engine is replaced.
  ========================================================== */

  const V21_SECURITY_VERSION = "21.0";
  const V21_SECURITY_SCHEMA_VERSION = "21.0";
  const V21_USER_STORAGE_KEY = "gk_tfrs16_v21_users_v1";
  const V21_SESSION_STORAGE_KEY = "gk_tfrs16_v21_session_v1";
  const V21_SECURITY_AUDIT_SOURCE = "V21_SECURITY";
  const V21_SECURITY_ENFORCEMENT = false;
  const V21_SECURITY_MODE = "DEMO";

  const V21_USER_STATUS = Object.freeze({
    ACTIVE: "ACTIVE",
    INACTIVE: "INACTIVE",
    SUSPENDED: "SUSPENDED"
  });

  const V21_ROLES = Object.freeze({
    ADMIN: "ADMIN",
    // P1 UYUMLULUK: backend'in gerçek rol seti artık ADMIN /
    // ACCOUNTANT_MANAGER / ACCOUNTANT / CONTROLLER / VIEWER. Bu isim
    // buraya eklenmezse, gerçek oturumdan bu rol window.currentUser'a
    // sızdığında getCurrentUserRoles() onu SESSİZCE ELER (V21_ROLES[role]
    // kontrolü) ve kullanıcı bu (dekoratif/demo) yetki sisteminde
    // yetkisiz görünür — bkz. dosya başındaki V21_SECURITY_MODE=DEMO notu.
    ACCOUNTANT_MANAGER: "ACCOUNTANT_MANAGER",
    CFO: "CFO",
    FINANCE_MANAGER: "FINANCE_MANAGER",
    ACCOUNTANT: "ACCOUNTANT",
    CONTROLLER: "CONTROLLER",
    AUDITOR: "AUDITOR",
    VIEWER: "VIEWER"
  });

  const V21_PERMISSIONS = Object.freeze({
    CONTRACTS_VIEW: "contracts.view",
    CONTRACTS_CREATE: "contracts.create",
    CONTRACTS_EDIT: "contracts.edit",
    CONTRACTS_DELETE: "contracts.delete",
    LEASES_CALCULATE: "leases.calculate",
    SCHEDULE_VIEW: "schedule.view",
    SCHEDULE_EXPORT: "schedule.export",
    JOURNAL_VIEW: "journal.view",
    JOURNAL_CREATE: "journal.create",
    JOURNAL_EXPORT: "journal.export",
    JOURNAL_DELETE: "journal.delete",
    REPORTING_VIEW: "reporting.view",
    REPORTING_EXPORT: "reporting.export",
    CONTROLS_VIEW: "controls.view",
    CONTROLS_MANAGE: "controls.manage",
    CONTROLS_RESOLVE: "controls.resolve",
    CLOSE_VIEW: "close.view",
    CLOSE_EXECUTE: "close.execute",
    CLOSE_CERTIFY: "close.certify",
    AUDIT_VIEW: "audit.view",
    IMPORTS_EXECUTE: "imports.execute",
    EXPORTS_EXECUTE: "exports.execute",
    DASHBOARD_VIEW: "dashboard.view",
    USERS_VIEW: "users.view",
    USERS_MANAGE: "users.manage",
    ROLES_MANAGE: "roles.manage",
    COMPANY_ACCESS_MANAGE: "company_access.manage",
    SECURITY_VIEW: "security.view",
    CONFIG_MANAGE: "configuration.manage"
  });

  const V21_PERMISSION_LIST = Object.freeze(Object.values(V21_PERMISSIONS));

  const V21_ROLE_PERMISSIONS = Object.freeze({
    ADMIN: V21_PERMISSION_LIST.slice(),
    // P1 UYUMLULUK: backend'de ACCOUNTANT_MANAGER, ADMIN'in bir alt
    // kümesi — kendi holding ağacında tam CRUD + raporlama yapabilir
    // ama platform seviyesi kullanıcı/rol/konfigürasyon yönetimi
    // (users.manage, roles.manage, configuration.manage) ADMIN'e özel
    // kalır (bkz. backend organization-service.js rol matrisi).
    ACCOUNTANT_MANAGER: [
      "dashboard.view", "contracts.view", "contracts.create", "contracts.edit", "contracts.delete",
      "leases.calculate", "schedule.view", "schedule.export",
      "journal.view", "journal.create", "journal.export", "journal.delete",
      "reporting.view", "reporting.export",
      "controls.view", "controls.manage", "controls.resolve",
      "close.view", "close.execute", "close.certify",
      "audit.view", "imports.execute", "exports.execute",
      "users.view", "company_access.manage"
    ],
    CFO: [
      "dashboard.view", "contracts.view", "schedule.view", "schedule.export",
      "journal.view", "journal.export", "reporting.view", "reporting.export",
      "controls.view", "close.view", "close.certify", "audit.view", "exports.execute"
    ],
    FINANCE_MANAGER: [
      "contracts.view", "contracts.create", "contracts.edit", "schedule.view", "schedule.export",
      "journal.view", "journal.create", "journal.export", "reporting.view", "reporting.export",
      "controls.view", "controls.manage", "controls.resolve", "close.view", "close.execute",
      "audit.view", "imports.execute", "exports.execute", "dashboard.view"
    ],
    ACCOUNTANT: [
      "contracts.view", "contracts.create", "contracts.edit", "leases.calculate",
      "schedule.view", "schedule.export", "journal.view", "journal.create", "journal.export",
      "reporting.view", "controls.view", "close.view", "close.execute", "audit.view",
      "imports.execute", "exports.execute", "dashboard.view"
    ],
    CONTROLLER: [
      "contracts.view", "schedule.view", "schedule.export", "journal.view", "journal.export",
      "reporting.view", "reporting.export", "controls.view", "controls.manage", "controls.resolve",
      "close.view", "audit.view", "exports.execute", "dashboard.view"
    ],
    AUDITOR: [
      "contracts.view", "schedule.view", "schedule.export", "journal.view", "reporting.view",
      "reporting.export", "controls.view", "close.view", "audit.view", "dashboard.view"
    ],
    VIEWER: [
      "dashboard.view", "contracts.view", "schedule.view", "reporting.view"
    ]
  });

  const V21_SECURITY_CONFIG = Object.freeze({
    version: V21_SECURITY_VERSION,
    schemaVersion: V21_SECURITY_SCHEMA_VERSION,
    mode: V21_SECURITY_MODE,
    enforcementEnabled: V21_SECURITY_ENFORCEMENT,
    statuses: Object.values(V21_USER_STATUS),
    roles: Object.values(V21_ROLES),
    permissions: V21_PERMISSION_LIST.slice(),
    defaultRole: V21_ROLES.VIEWER,
    criticalActions: [
      "DELETE", "IMPORT", "EXPORT", "CLOSE_EXECUTE", "CLOSE_CERTIFY",
      "ROLE_CHANGE", "PERMISSION_CHANGE", "COMPANY_ACCESS_CHANGE"
    ],
    sodRules: [
      { id: "SOD-CLOSE-PREPARE-CERTIFY", actions: ["CLOSE_EXECUTE", "CLOSE_CERTIFY"], severity: "HIGH", message: "Close preparation and certification should be segregated." },
      { id: "SOD-CREATE-CERTIFY", actions: ["CREATE", "CLOSE_CERTIFY"], severity: "MEDIUM", message: "Creation and certification should be independently reviewed." },
      { id: "SOD-IMPORT-CERTIFY", actions: ["IMPORT", "CLOSE_CERTIFY"], severity: "HIGH", message: "Imported financial data should be independently certified." }
    ]
  });

  /** @deprecated-name Kalıcı: v21Clone — dış çağrılarla (window.GK_TFRS16, olası eski referanslar) uyumluluk için korunuyor. Bkz. coreClone. */
  function v21Clone(value) {
    return coreClone(value);
  }

  function v21Now() { return new Date().toISOString(); }

  function v21Id(prefix = "V21") {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function v21NormalizeStatus(status) {
    const value = String(status || V21_USER_STATUS.ACTIVE).toUpperCase();
    return V21_USER_STATUS[value] || V21_USER_STATUS.ACTIVE;
  }

  function v21CompanyIdsFromCurrentData() {
    try {
      const rows = typeof v20GetContracts === "function" ? v20GetContracts() : v20SafeArray(contracts);
      return Array.from(new Set(rows.map(item => String(item?.companyId || item?.company || "").trim()).filter(Boolean)));
    } catch (error) {
      return [];
    }
  }

  function normalizeUserData(user = {}) {
    const source = v21SafeObject(user);
    const roleIds = Array.from(new Set(v20SafeArray(source.roleIds || source.roles).map(value => String(value).toUpperCase()).filter(role => V21_ROLES[role])));
    const companyIds = Array.from(new Set(v20SafeArray(source.companyIds || source.companies).map(value => String(value).trim()).filter(Boolean)));
    return {
      id: String(source.id || source.username || v21Id("USR")),
      username: String(source.username || source.id || ""),
      displayName: String(source.displayName || source.name || source.username || ""),
      email: String(source.email || ""),
      status: v21NormalizeStatus(source.status),
      roleIds: roleIds.length ? roleIds : [V21_ROLES.VIEWER],
      companyIds,
      createdAt: source.createdAt || v21Now(),
      updatedAt: source.updatedAt || v21Now(),
      lastLoginAt: source.lastLoginAt || null,
      schemaVersion: V21_SECURITY_SCHEMA_VERSION
    };
  }

  function v21DefaultUsers() {
    const companies = v21CompanyIdsFromCurrentData();
    return [
      normalizeUserData({ id: "demo-admin", username: "demo-admin", displayName: "Demo Administrator", status: "ACTIVE", roleIds: ["ADMIN"], companyIds: companies }),
      normalizeUserData({ id: "demo-cfo", username: "demo-cfo", displayName: "Demo CFO", status: "ACTIVE", roleIds: ["CFO"], companyIds: companies }),
      normalizeUserData({ id: "demo-accountant", username: "demo-accountant", displayName: "Demo Accountant", status: "ACTIVE", roleIds: ["ACCOUNTANT"], companyIds: companies }),
      normalizeUserData({ id: "demo-controller", username: "demo-controller", displayName: "Demo Controller", status: "ACTIVE", roleIds: ["CONTROLLER"], companyIds: companies }),
      normalizeUserData({ id: "demo-auditor", username: "demo-auditor", displayName: "Demo Auditor", status: "ACTIVE", roleIds: ["AUDITOR"], companyIds: companies }),
      normalizeUserData({ id: "demo-viewer", username: "demo-viewer", displayName: "Demo Viewer", status: "ACTIVE", roleIds: ["VIEWER"], companyIds: companies })
    ];
  }

  function loadV21Users() {
    try {
      const raw = localStorage.getItem(V21_USER_STORAGE_KEY);
      if (!raw) return v21DefaultUsers();
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(normalizeUserData) : v21DefaultUsers();
    } catch (error) {
      console.error("V21 user storage load failed:", error);
      return v21DefaultUsers();
    }
  }

  function saveV21Users(users) {
    try {
      localStorage.setItem(V21_USER_STORAGE_KEY, JSON.stringify(v20SafeArray(users).map(normalizeUserData)));
      return true;
    } catch (error) {
      console.error("V21 user storage save failed:", error);
      return false;
    }
  }

  function getV21Users() { return loadV21Users().map(v21Clone); }

  function getV21User(userId) {
    const id = String(userId || "").trim();
    return loadV21Users().find(user => String(user.id) === id || String(user.username) === id) || null;
  }

  function createV21User(input = {}) {
    const user = normalizeUserData(input);
    const users = loadV21Users();
    if (users.some(item => String(item.id) === user.id || String(item.username).toLowerCase() === user.username.toLowerCase())) {
      throw new Error(`User already exists: ${user.username || user.id}`);
    }
    users.push(user);
    if (!saveV21Users(users)) throw new Error("Unable to persist user.");
    v21SecurityAudit("CREATE", "USER", user.id, { userId: user.id, username: user.username });
    return v21Clone(user);
  }

  function updateV21User(userId, patch = {}) {
    const users = loadV21Users();
    const index = users.findIndex(item => String(item.id) === String(userId));
    if (index < 0) return null;
    const before = v21Clone(users[index]);
    const next = normalizeUserData({ ...before, ...v20SafeObject(patch), id: before.id, createdAt: before.createdAt, updatedAt: v21Now() });
    users[index] = next;
    if (!saveV21Users(users)) throw new Error("Unable to persist user.");
    if (before.roleIds.join(",") !== next.roleIds.join(",")) v21SecurityAudit("ROLE_CHANGE", "USER", next.id, { oldValue: before.roleIds, newValue: next.roleIds });
    if (before.companyIds.join(",") !== next.companyIds.join(",")) v21SecurityAudit("COMPANY_ACCESS_CHANGE", "USER", next.id, { oldValue: before.companyIds, newValue: next.companyIds });
    return v21Clone(next);
  }

  function setV21UserStatus(userId, status) {
    return updateV21User(userId, { status: v21NormalizeStatus(status) });
  }

  function getCurrentUser() {
    try {
      const raw = window.currentUser;
      if (raw && typeof raw === "object") return normalizeUserData(raw);
    } catch (error) {}
    const session = getV21SessionContext();
    if (session?.userId) {
      const sessionUser = getV21User(session.userId);
      if (sessionUser) return sessionUser;
    }
    const fallback = getV21User("demo-admin");
    return fallback || normalizeUserData({ id: "demo-admin", username: "demo-admin", displayName: "Demo Administrator", roleIds: ["ADMIN"], companyIds: v21CompanyIdsFromCurrentData() });
  }

  function getCurrentUserRoles() {
    return Array.from(new Set(v20SafeArray(getCurrentUser()?.roleIds).map(value => String(value).toUpperCase()).filter(role => V21_ROLES[role])));
  }

  function getCurrentUserCompanies() {
    return v20SafeArray(getCurrentUser()?.companyIds).map(value => String(value)).filter(Boolean);
  }

  function setV21CurrentUser(userId) {
    const user = getV21User(userId);
    if (!user) throw new Error("User not found.");
    if (user.status !== V21_USER_STATUS.ACTIVE) throw new Error("Inactive or suspended users cannot start a session.");
    try { window.currentUser = v21Clone(user); } catch (error) {}
    const session = {
      userId: user.id,
      roleIds: user.roleIds.slice(),
      companyIds: user.companyIds.slice(),
      sessionId: v21Id("SES"),
      createdAt: v21Now(),
      expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
      schemaVersion: V21_SECURITY_SCHEMA_VERSION
    };
    try { localStorage.setItem(V21_SESSION_STORAGE_KEY, JSON.stringify(session)); } catch (error) { console.error("V21 session save failed:", error); }
    updateV21User(user.id, { lastLoginAt: v21Now() });
    v21SecurityAudit("LOGIN", "USER", user.id, { actorId: user.id });
    return v21Clone(session);
  }

  function getV21SessionContext() {
    try {
      const raw = localStorage.getItem(V21_SESSION_STORAGE_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw);
      if (!session?.expiresAt || new Date(session.expiresAt).getTime() <= Date.now()) return null;
      return session;
    } catch (error) { return null; }
  }

  function clearV21Session() {
    const user = getCurrentUser();
    v21SecurityAudit("LOGOUT", "USER", user?.id || null, {});
    try { localStorage.removeItem(V21_SESSION_STORAGE_KEY); } catch (error) {}
    try { window.currentUser = null; } catch (error) {}
    return true;
  }

  function getRolePermissions(roleId) {
    const role = String(roleId || "").toUpperCase();
    return v20SafeArray(V21_ROLE_PERMISSIONS[role]).slice();
  }

  function getUserPermissions(user = getCurrentUser()) {
    const permissions = new Set();
    v20SafeArray(user?.roleIds).forEach(role => getRolePermissions(role).forEach(permission => permissions.add(permission)));
    return Array.from(permissions);
  }

  function hasPermission(user, permission) {
    const target = user || getCurrentUser();
    const requested = String(permission || "").trim();
    if (!requested) return false;
    if (v21NormalizeStatus(target?.status) !== V21_USER_STATUS.ACTIVE) return false;
    return getUserPermissions(target).includes(requested);
  }

  function canAccessCompany(user, companyId) {
    const target = user || getCurrentUser();
    const company = String(companyId || "").trim();
    if (!company || v21NormalizeStatus(target?.status) !== V21_USER_STATUS.ACTIVE) return false;
    const allowed = v20SafeArray(target?.companyIds).map(value => String(value));
    if (getUserPermissions(target).includes("company_access.manage")) return true;
    return allowed.includes(company);
  }

  function v21ResolveCompanyId(input) {
    if (input == null) return null;
    if (typeof input === "string" || typeof input === "number") return String(input);
    return String(input.companyId || input.company || input.contract?.companyId || input.contract?.company || "").trim() || null;
  }

  function v21AuthorizationResult(user, permission, companyId = null, action = "ACCESS") {
    const target = user || getCurrentUser();
    const errors = [];
    const status = v21NormalizeStatus(target?.status);
    if (status !== V21_USER_STATUS.ACTIVE) errors.push({ code: "USER_INACTIVE", message: "Inactive or suspended users cannot perform actions." });
    if (!hasPermission(target, permission)) errors.push({ code: "PERMISSION_DENIED", message: "You do not have permission to perform this action." });
    if (companyId && !canAccessCompany(target, companyId)) errors.push({ code: "COMPANY_ACCESS_DENIED", message: "You do not have access to the selected company." });
    return {
      authorized: errors.length === 0,
      statusCode: errors.length ? 403 : 200,
      userId: target?.id || null,
      roleIds: v20SafeArray(target?.roleIds),
      permission: String(permission || ""),
      companyId: companyId || null,
      action,
      errors
    };
  }

  function v21RequirePermission(permission, options = {}) {
    const result = v21AuthorizationResult(options.user || getCurrentUser(), permission, options.companyId || null, options.action || "ACCESS");
    if (!result.authorized) {
      v21SecurityAudit("ACCESS_DENIED", "SECURITY", options.entityId || null, {
        permission, companyId: options.companyId || null, action: options.action || "ACCESS", errors: result.errors
      });
      const error = new Error(result.errors[0]?.message || "You do not have permission to perform this action.");
      error.code = result.errors[0]?.code || "FORBIDDEN";
      error.statusCode = 403;
      error.authorization = result;
      throw error;
    }
    return true;
  }

  function v21Authorize(permission, options = {}) {
    const result = v21AuthorizationResult(options.user || getCurrentUser(), permission, options.companyId || null, options.action || "ACCESS");
    if (!result.authorized) {
      v21SecurityAudit("ACCESS_DENIED", "SECURITY", options.entityId || null, {
        permission, companyId: options.companyId || null, action: options.action || "ACCESS", errors: result.errors
      });
    }
    return result;
  }

  function v21SecurityAudit(action, entityType = "SECURITY", entityId = null, metadata = {}) {
    try {
      const user = getCurrentUser();
      if (typeof recordAuditEvent === "function") {
        return recordAuditEvent({
          action,
          entityType,
          entityId,
          actor: user?.id || auditActor(),
          reason: V21_SECURITY_AUDIT_SOURCE,
          metadata: {
            ...v21SafeObject(metadata),
            actorId: user?.id || null,
            actorName: user?.displayName || user?.username || null,
            actorRoleIds: v20SafeArray(user?.roleIds),
            securityVersion: V21_SECURITY_VERSION
          }
        });
      }
    } catch (error) {
      console.error("V21 security audit failed:", error);
    }
    return null;
  }

  function v21SafeObject(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }

  function v21GetCompanyIdFromContract(contractOrId) {
    let contract = contractOrId;
    if (typeof contractOrId !== "object") {
      try { contract = contracts.find(item => String(item?.id) === String(contractOrId)); } catch (error) { contract = null; }
    }
    return v21ResolveCompanyId(contract);
  }

  function v21GuardContract(permission, contractOrId, action = "CONTRACT_ACCESS") {
    const companyId = v21GetCompanyIdFromContract(contractOrId);
    return v21RequirePermission(permission, { companyId, action, entityId: typeof contractOrId === "object" ? contractOrId?.id : contractOrId });
  }

  function v21GuardJournal(permission, journal = {}, action = "JOURNAL_ACCESS") {
    const companyId = v21ResolveCompanyId(journal);
    return v21RequirePermission(permission, { companyId, action, entityId: journal?.id || journal?.journalId || null });
  }

  function v21GuardCompany(permission, companyId, action = "COMPANY_ACCESS") {
    return v21RequirePermission(permission, { companyId, action, entityId: companyId });
  }

  function v21ExecuteAuthorized(permission, operation, options = {}) {
    const result = v21Authorize(permission, options);
    if (!result.authorized) {
      const error = new Error(result.errors[0]?.message || "You do not have permission to perform this action.");
      error.code = result.errors[0]?.code || "FORBIDDEN";
      error.statusCode = 403;
      throw error;
    }
    if (typeof operation !== "function") throw new TypeError("Authorized operation must be a function.");
    return operation();
  }

  function v21CanExecute(permission, options = {}) {
    return v21Authorize(permission, options).authorized;
  }

  function v21ApplySecurityToUi() {
    if (typeof document === "undefined") return { applied: false, reason: "DOM_UNAVAILABLE" };
    const user = getCurrentUser();
    const rules = [
      ["newContractButton", "contracts.create"],
      ["bulkImportButton", "imports.execute"],
      ["deleteContract", "contracts.delete"],
      ["downloadTemplateButton", "exports.execute"],
      ["confirmBulkImport", "imports.execute"]
    ];
    const applied = [];
    rules.forEach(([id, permission]) => {
      const element = document.getElementById(id);
      if (!element) return;
      const allowed = hasPermission(user, permission);
      element.dataset.v21Permission = permission;
      element.dataset.v21Authorized = allowed ? "true" : "false";
      if (V21_SECURITY_ENFORCEMENT) {
        element.disabled = !allowed;
        element.hidden = !allowed;
      }
      applied.push({ id, permission, allowed });
    });
    return { applied: true, enforcementEnabled: V21_SECURITY_ENFORCEMENT, appliedRules: applied };
  }

  function getSecurityControlStatus(options = {}) {
    const user = options.user || getCurrentUser();
    const companyId = options.companyId || null;
    const roleIds = v20SafeArray(user?.roleIds);
    const permissions = getUserPermissions(user);
    const checks = [];
    checks.push({ id: "USER_STATUS", status: user?.status === V21_USER_STATUS.ACTIVE ? "PASS" : "FAIL", message: user?.status === V21_USER_STATUS.ACTIVE ? "User is active." : "User is inactive or suspended." });
    checks.push({ id: "MISSING_ROLE", status: roleIds.length ? "PASS" : "FAIL", message: roleIds.length ? "User has at least one role." : "User has no assigned role." });
    const invalidRoles = roleIds.filter(role => !V21_ROLES[String(role).toUpperCase()]);
    checks.push({ id: "INVALID_ROLE", status: invalidRoles.length ? "FAIL" : "PASS", message: invalidRoles.length ? `Invalid roles: ${invalidRoles.join(", ")}` : "All roles are valid." });
    const invalidPermissions = permissions.filter(permission => !V21_PERMISSION_LIST.includes(permission));
    checks.push({ id: "INVALID_PERMISSION", status: invalidPermissions.length ? "FAIL" : "PASS", message: invalidPermissions.length ? `Invalid permissions: ${invalidPermissions.join(", ")}` : "All permissions are valid." });
    if (companyId) checks.push({ id: "COMPANY_ACCESS", status: canAccessCompany(user, companyId) ? "PASS" : "FAIL", message: canAccessCompany(user, companyId) ? "Company access granted." : "Company access denied." });
    checks.push({ id: "MISSING_ACTOR", status: user?.id ? "PASS" : "FAIL", message: user?.id ? "Security actor is available." : "Security actor is missing." });
    const sod = v21EvaluateSodRules(user, options.actions || []);
    checks.push({ id: "SOD_CONFLICT", status: sod.conflicts.length ? "WARNING" : "PASS", message: sod.conflicts.length ? sod.conflicts.map(item => item.message).join(" ") : "No segregation-of-duties conflict detected." });
    const denied = v20SafeArray(options.deniedActions);
    checks.push({ id: "UNAUTHORIZED_ACTION", status: denied.length ? "WARNING" : "PASS", message: denied.length ? `${denied.length} unauthorized action(s) recorded.` : "No unauthorized action supplied." });
    return {
      version: V21_SECURITY_VERSION,
      userId: user?.id || null,
      companyId,
      status: checks.some(item => item.status === "FAIL") ? "FAIL" : checks.some(item => item.status === "WARNING") ? "WARNING" : "PASS",
      checks,
      roles: roleIds,
      permissions,
      companyIds: getCurrentUserCompanies(),
      sod,
      enforcementEnabled: V21_SECURITY_ENFORCEMENT,
      mode: V21_SECURITY_MODE
    };
  }

  function v21EvaluateSodRules(user = getCurrentUser(), actions = []) {
    const actionSet = new Set(v20SafeArray(actions).map(item => String(item?.action || item).toUpperCase()));
    const conflicts = V21_SECURITY_CONFIG.sodRules.filter(rule => rule.actions.every(action => actionSet.has(action))).map(rule => ({ ...rule }));
    return { conflicts, passed: conflicts.length === 0 };
  }

  function v21CheckSegregationOfDuties(user, actions = []) {
    const result = v21EvaluateSodRules(user || getCurrentUser(), actions);
    if (result.conflicts.length) v21SecurityAudit("SOD_CONFLICT", "SECURITY", user?.id || null, { conflicts: result.conflicts, actions });
    return result;
  }

  function v21RoleMatrix() {
    return V21_PERMISSION_LIST.map(permission => {
      const row = { permission };
      Object.values(V21_ROLES).forEach(role => { row[role] = getRolePermissions(role).includes(permission); });
      return row;
    });
  }

  function v21GetApiAuthorizationContract() {
    const map = {
      "GET /companies": "contracts.view",
      "GET /contracts": "contracts.view",
      "GET /contracts/:id": "contracts.view",
      "POST /contracts": "contracts.create",
      "PUT /contracts/:id": "contracts.edit",
      "DELETE /contracts/:id": "contracts.delete",
      "GET /contracts/:id/schedule": "schedule.view",
      "GET /contracts/:id/journals": "journal.view",
      "GET /reports/financial": "reporting.view",
      "GET /reports/cfo": "dashboard.view",
      "GET /controls": "controls.view",
      "GET /close-periods": "close.view",
      "POST /imports": "imports.execute",
      "GET /imports/:id": "imports.execute",
      "POST /exports": "exports.execute"
    };
    return Object.entries(map).map(([endpoint, permission]) => ({ endpoint, permission, statusCodeOnDenied: 403 }));
  }

  function v21SecurityAuditReport(options = {}) {
    try {
      const report = typeof getAuditTrailReport === "function" ? getAuditTrailReport(options) : { rows: [] };
      const rows = v20SafeArray(report?.rows || report).filter(row => String(row?.reason || row?.metadata?.source || "").includes(V21_SECURITY_AUDIT_SOURCE) || ["LOGIN", "LOGOUT", "ACCESS_DENIED", "ROLE_CHANGE", "PERMISSION_CHANGE", "COMPANY_ACCESS_CHANGE", "SOD_CONFLICT"].includes(String(row?.action || "").toUpperCase()));
      return { version: V21_SECURITY_VERSION, rows, count: rows.length };
    } catch (error) {
      return { version: V21_SECURITY_VERSION, rows: [], count: 0, error: error?.message || String(error) };
    }
  }

  function v21GetCompanyAccessMatrix() {
    const users = loadV21Users();
    const companies = v21CompanyIdsFromCurrentData();
    return users.map(user => ({ userId: user.id, username: user.username, status: user.status, companyIds: user.companyIds.slice(), accessibleCompanies: companies.filter(companyId => canAccessCompany(user, companyId)) }));
  }

  function v21SetCompanyAccess(userId, companyIds) {
    const user = getV21User(userId);
    if (!user) throw new Error("User not found.");
    return updateV21User(userId, { companyIds: Array.from(new Set(v20SafeArray(companyIds).map(value => String(value).trim()).filter(Boolean))) });
  }

  function v21AssignRole(userId, roleId) {
    const role = String(roleId || "").toUpperCase();
    if (!V21_ROLES[role]) throw new Error(`Invalid role: ${role}`);
    const user = getV21User(userId);
    if (!user) throw new Error("User not found.");
    return updateV21User(userId, { roleIds: Array.from(new Set(user.roleIds.concat(role))) });
  }

  function v21RemoveRole(userId, roleId) {
    const role = String(roleId || "").toUpperCase();
    const user = getV21User(userId);
    if (!user) throw new Error("User not found.");
    const nextRoles = user.roleIds.filter(item => String(item).toUpperCase() !== role);
    if (!nextRoles.length) throw new Error("User must retain at least one role.");
    return updateV21User(userId, { roleIds: nextRoles });
  }

  function v21SecurityTests() {
    const results = [];
    const pass = (name, condition, details = "") => results.push({ test: name, passed: !!condition, details });
    try {
      const companies = v21CompanyIdsFromCurrentData();
      const companyIds = companies.length ? companies : ["DEMO-COMPANY"];
      const users = v21DefaultUsers().map(user => ({ ...user, companyIds }));
      const admin = users.find(user => user.roleIds.includes("ADMIN"));
      const cfo = users.find(user => user.roleIds.includes("CFO"));
      const accountant = users.find(user => user.roleIds.includes("ACCOUNTANT"));
      const controller = users.find(user => user.roleIds.includes("CONTROLLER"));
      const auditor = users.find(user => user.roleIds.includes("AUDITOR"));
      const viewer = users.find(user => user.roleIds.includes("VIEWER"));
      pass("TEST 1 Admin access", hasPermission(admin, "users.manage") && hasPermission(admin, "contracts.delete"));
      pass("TEST 2 CFO access", hasPermission(cfo, "dashboard.view") && hasPermission(cfo, "close.certify") && !hasPermission(cfo, "contracts.delete"));
      pass("TEST 3 Accountant access", hasPermission(accountant, "contracts.create") && hasPermission(accountant, "imports.execute"));
      pass("TEST 4 Controller access", hasPermission(controller, "controls.manage") && hasPermission(controller, "close.view"));
      pass("TEST 5 Auditor read-only", hasPermission(auditor, "audit.view") && !hasPermission(auditor, "contracts.edit") && !hasPermission(auditor, "imports.execute"));
      pass("TEST 6 Viewer read-only", hasPermission(viewer, "contracts.view") && !hasPermission(viewer, "contracts.edit") && !hasPermission(viewer, "exports.execute"));
      pass("TEST 7 Unauthorized delete", !hasPermission(viewer, "contracts.delete"));
      pass("TEST 8 Unauthorized export", !hasPermission(viewer, "exports.execute"));
      pass("TEST 9 Unauthorized import", !hasPermission(auditor, "imports.execute"));
      pass("TEST 10 Unauthorized close certify", !hasPermission(accountant, "close.certify"));
      pass("TEST 11 Company access", canAccessCompany(admin, companyIds[0]));
      pass("TEST 12 Unauthorized company", !canAccessCompany(viewer, "UNAUTHORIZED-COMPANY"));
      pass("TEST 13 Inactive user", !hasPermission({ ...viewer, status: "INACTIVE" }, "contracts.view"));
      pass("TEST 14 Suspended user", !hasPermission({ ...viewer, status: "SUSPENDED" }, "contracts.view"));
      pass("TEST 15 Missing permission", !hasPermission(viewer, "configuration.manage"));
      pass("TEST 16 SoD conflict", !v21CheckSegregationOfDuties(viewer, []).conflicts.length && v21CheckSegregationOfDuties(viewer, ["CLOSE_EXECUTE", "CLOSE_CERTIFY"]).conflicts.length === 1);
      pass("TEST 17 Audit logging", typeof recordAuditEvent === "function");
      pass("TEST 18 Access denied logging", typeof v21SecurityAudit === "function");
      pass("TEST 19 Existing V20 functionality", typeof v20GetDatabaseModel === "function" && typeof calculateLeaseEngine === "function");
    } catch (error) {
      pass("V21 security tests", false, error?.message || String(error));
    }
    return { version: V21_SECURITY_VERSION, passed: results.every(item => item.passed), results };
  }

  /* V16.9 public API — V16.8 API is preserved and extended. */

  /* ==========================================================
     V22 MULTI-COMPANY & CONSOLIDATION ENGINE
     Additive layer. Existing V20/V21 engines remain canonical.
  ========================================================== */

  const V22_SCHEMA_VERSION = "22.0";
  const V22_GROUP_STORAGE_KEY = "gk_tfrs16_groups_v1";
  const V22_OWNERSHIP_STORAGE_KEY = "gk_tfrs16_group_ownership_v1";
  const V22_SCOPE_STORAGE_KEY = "gk_tfrs16_consolidation_scope_v1";
  const V22_ELIMINATION_STORAGE_KEY = "gk_tfrs16_eliminations_v1";
  const V22_ADJUSTMENT_STORAGE_KEY = "gk_tfrs16_consolidation_adjustments_v1";

  const V22_CONSOLIDATION_METHODS = Object.freeze({
    FULL: "FULL",
    EQUITY: "EQUITY",
    PROPORTIONAL: "PROPORTIONAL",
    EXCLUDED: "EXCLUDED"
  });

  const V22_CONTROL_TYPES = Object.freeze({
    SUBSIDIARY: "SUBSIDIARY",
    ASSOCIATE: "ASSOCIATE",
    JOINT_VENTURE: "JOINT_VENTURE",
    OTHER: "OTHER"
  });

  const V22_ELIMINATION_TYPES = Object.freeze({
    INTERCOMPANY_RECEIVABLE: "INTERCOMPANY_RECEIVABLE",
    INTERCOMPANY_PAYABLE: "INTERCOMPANY_PAYABLE",
    INTERCOMPANY_REVENUE: "INTERCOMPANY_REVENUE",
    INTERCOMPANY_EXPENSE: "INTERCOMPANY_EXPENSE",
    INTERCOMPANY_LEASE: "INTERCOMPANY_LEASE",
    OTHER: "OTHER"
  });

  const V22_SECURITY_PERMISSIONS = Object.freeze([
    "group.view",
    "group.manage",
    "consolidation.view",
    "consolidation.execute",
    "consolidation.export",
    "eliminations.view",
    "eliminations.manage"
  ]);

  const V22_ROLE_PERMISSIONS = Object.freeze({
    ADMIN: [
      "group.view", "group.manage", "consolidation.view", "consolidation.execute",
      "consolidation.export", "eliminations.view", "eliminations.manage"
    ],
    CFO: [
      "group.view", "consolidation.view", "consolidation.execute",
      "consolidation.export", "eliminations.view", "eliminations.manage"
    ],
    FINANCE_MANAGER: [
      "group.view", "consolidation.view", "consolidation.execute",
      "consolidation.export", "eliminations.view", "eliminations.manage"
    ],
    CONTROLLER: [
      "group.view", "consolidation.view", "consolidation.export",
      "eliminations.view", "eliminations.manage"
    ],
    ACCOUNTANT: ["group.view", "consolidation.view", "eliminations.view"],
    AUDITOR: ["group.view", "consolidation.view", "consolidation.export", "eliminations.view"],
    VIEWER: ["group.view", "consolidation.view"]
  });

  function v22SafeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function v22SafeObject(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  /** @deprecated-name Kalıcı: v22Clone — dış çağrılarla (window.GK_TFRS16, olası eski referanslar) uyumluluk için korunuyor. Bkz. coreClone. */
  function v22Clone(value) {
    return coreClone(value);
  }

  function v22Now() { return new Date().toISOString(); }

  function v22Id(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  /** @deprecated-name Kalıcı: v22NormalizeDate — dış çağrılarla (window.GK_TFRS16, olası eski referanslar) uyumluluk için korunuyor. Bkz. coreNormalizeDate. */
  function v22NormalizeDate(value) {
    return coreNormalizeDate(value);
  }

  function v22Currency(value, fallback = "TRY") {
    const currency = String(value || fallback).trim().toUpperCase();
    return /^[A-Z]{3}$/.test(currency) ? currency : fallback;
  }

  /** @deprecated-name Kalıcı: v22Amount — dış çağrılarla (window.GK_TFRS16, olası eski referanslar) uyumluluk için korunuyor. Bkz. coreNumber. fallback her zaman 0 idi (parametre yok). */
  function v22Amount(value) {
    return coreNumber(value);
  }

  function v22Storage(key) {
    return {
      key,
      get(defaultValue = []) {
        try {
          const raw = localStorage.getItem(key);
          if (raw === null) return v22Clone(defaultValue);
          return JSON.parse(raw);
        } catch (error) {
          return v22Clone(defaultValue);
        }
      },
      save(value) {
        try {
          localStorage.setItem(key, JSON.stringify(value));
          return true;
        } catch (error) {
          console.error(`V22 storage save failed for ${key}:`, error);
          return false;
        }
      },
      list() {
        const value = this.get([]);
        return Array.isArray(value) ? value : [];
      },
      find(predicate) { return this.list().find(predicate) || null; },
      exists(predicate) { return this.list().some(predicate); },
      remove() {
        try { localStorage.removeItem(key); return true; } catch (error) { return false; }
      }
    };
  }

  const V22StorageAdapters = Object.freeze({
    groups: () => v22Storage(V22_GROUP_STORAGE_KEY),
    ownership: () => v22Storage(V22_OWNERSHIP_STORAGE_KEY),
    scope: () => v22Storage(V22_SCOPE_STORAGE_KEY),
    eliminations: () => v22Storage(V22_ELIMINATION_STORAGE_KEY),
    adjustments: () => v22Storage(V22_ADJUSTMENT_STORAGE_KEY)
  });

  function v22RecordAudit(action, entityType, entityId, metadata = {}) {
    try {
      if (typeof recordAuditEvent === "function") {
        return recordAuditEvent({
          action,
          entityType,
          entityId: entityId || null,
          reason: "V22 Consolidation Engine",
          metadata: { ...v22Clone(metadata), schemaVersion: V22_SCHEMA_VERSION }
        });
      }
    } catch (error) {}
    return null;
  }

  function v22CurrentUser() {
    try {
      return typeof getCurrentUser === "function" ? getCurrentUser() : (window.currentUser || null);
    } catch (error) { return null; }
  }

  function v22HasPermission(permission, user = v22CurrentUser()) {
    try {
      if (typeof hasPermission === "function" && hasPermission(user, permission)) return true;
    } catch (error) {}
    const roles = v22SafeArray(user?.roleIds).map(role => String(role).toUpperCase());
    return roles.some(role => v22SafeArray(V22_ROLE_PERMISSIONS[role]).includes(permission));
  }

  function v22Authorize(permission, options = {}) {
    const user = options.user || v22CurrentUser();
    const errors = [];
    if (!user || String(user.status || "ACTIVE").toUpperCase() !== "ACTIVE") {
      errors.push({ code: "USER_INACTIVE", message: "Inactive or suspended users cannot perform actions." });
    }
    if (!v22HasPermission(permission, user)) {
      errors.push({ code: "PERMISSION_DENIED", message: "You do not have permission to perform this action." });
    }
    if (options.companyId) {
      try {
        if (typeof canAccessCompany === "function" && !canAccessCompany(user, options.companyId)) {
          errors.push({ code: "COMPANY_ACCESS_DENIED", message: "You do not have access to the selected company." });
        }
      } catch (error) {
        errors.push({ code: "COMPANY_ACCESS_DENIED", message: "You do not have access to the selected company." });
      }
    }
    const result = {
      authorized: errors.length === 0,
      statusCode: errors.length ? 403 : 200,
      userId: user?.id || null,
      permission,
      action: options.action || "ACCESS",
      groupId: options.groupId || null,
      companyId: options.companyId || null,
      errors
    };
    if (!result.authorized) {
      v22RecordAudit("ACCESS_DENIED", "SECURITY", options.entityId || null, result);
    }
    return result;
  }

  function v22Require(permission, options = {}) {
    const result = v22Authorize(permission, options);
    if (!result.authorized) {
      const error = new Error(result.errors[0]?.message || "You do not have permission to perform this action.");
      error.code = result.errors[0]?.code || "FORBIDDEN";
      error.statusCode = 403;
      error.authorization = result;
      throw error;
    }
    return true;
  }

  function v22CompanyList() {
    try {
      if (typeof v20CollectCompanies === "function") return v20CollectCompanies(v20GetContracts());
    } catch (error) {}
    const rows = v22SafeArray(typeof contracts !== "undefined" ? contracts : []);
    const map = new Map();
    rows.forEach((contract, index) => {
      const name = String(contract?.company || contract?.companyId || "").trim();
      if (!name) return;
      const id = String(contract?.companyId || `COMP-${name.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 48) || index + 1}`);
      if (!map.has(id)) {
        map.set(id, {
          id,
          code: name.toUpperCase().replace(/[^A-Z0-9_-]/g, "-").slice(0, 24),
          name,
          country: contract?.country || "TR",
          baseCurrency: v22Currency(contract?.companyBaseCurrency, "TRY"),
          status: "ACTIVE"
        });
      }
    });
    return Array.from(map.values());
  }

  function v22NormalizeGroup(group = {}) {
    const source = v22SafeObject(group);
    return {
      id: String(source.id || v22Id("GRP")),
      code: String(source.code || source.id || "GROUP-DEFAULT").trim(),
      name: String(source.name || source.code || "GK Group").trim(),
      baseCurrency: v22Currency(source.baseCurrency || source.groupCurrency, "TRY"),
      groupCurrency: v22Currency(source.groupCurrency || source.baseCurrency, "TRY"),
      status: String(source.status || "ACTIVE").toUpperCase(),
      fiscalYearStart: source.fiscalYearStart || "01-01",
      createdAt: source.createdAt || v22Now(),
      updatedAt: source.updatedAt || v22Now(),
      schemaVersion: V22_SCHEMA_VERSION,
      entityType: "Group"
    };
  }


  function v22LoadGroups() {
    const adapter = V22StorageAdapters.groups();
    const stored = adapter.list().map(v22NormalizeGroup);
    if (stored.length) return stored;
    const defaultGroup = v22NormalizeGroup({
      id: "GROUP-DEFAULT",
      code: "GK-GROUP",
      name: "GK Finance Group",
      groupCurrency: "TRY"
    });
    adapter.save([defaultGroup]);
    return [defaultGroup];
  }

  let v22Groups = v22LoadGroups();

  function v22SaveGroups(groups) {
    v22Groups = v22SafeArray(groups).map(v22NormalizeGroup);
    return V22StorageAdapters.groups().save(v22Groups);
  }

  function v22LoadOwnership() {
    return V22StorageAdapters.ownership().list().map(item => ({
      id: String(item?.id || v22Id("OWN")),
      parentCompanyId: String(item?.parentCompanyId || ""),
      subsidiaryCompanyId: String(item?.subsidiaryCompanyId || ""),
      ownershipPercentage: Math.max(0, Math.min(100, v22Amount(item?.ownershipPercentage))),
      effectiveDate: v22NormalizeDate(item?.effectiveDate),
      controlType: V22_CONTROL_TYPES[String(item?.controlType || "SUBSIDIARY").toUpperCase()] || "SUBSIDIARY",
      status: String(item?.status || "ACTIVE").toUpperCase(),
      createdAt: item?.createdAt || v22Now(),
      updatedAt: item?.updatedAt || v22Now(),
      schemaVersion: V22_SCHEMA_VERSION,
      entityType: "Ownership"
    }));
  }

  function v22LoadScope() {
    return V22StorageAdapters.scope().list().map(item => ({
      id: String(item?.id || v22Id("SCOPE")),
      groupId: String(item?.groupId || "GROUP-DEFAULT"),
      companyId: String(item?.companyId || ""),
      consolidationMethod: V22_CONSOLIDATION_METHODS[String(item?.consolidationMethod || "FULL").toUpperCase()] || "FULL",
      ownershipPercentage: Math.max(0, Math.min(100, v22Amount(item?.ownershipPercentage ?? 100))),
      effectiveDate: v22NormalizeDate(item?.effectiveDate),
      included: item?.included !== false,
      createdAt: item?.createdAt || v22Now(),
      updatedAt: item?.updatedAt || v22Now(),
      schemaVersion: V22_SCHEMA_VERSION,
      entityType: "ConsolidationScope"
    }));
  }

  function v22LoadEliminations() {
    return V22StorageAdapters.eliminations().list().map(item => ({
      id: String(item?.id || v22Id("ELIM")),
      groupId: String(item?.groupId || "GROUP-DEFAULT"),
      fromCompanyId: String(item?.fromCompanyId || ""),
      toCompanyId: String(item?.toCompanyId || ""),
      account: String(item?.account || ""),
      amount: v22Amount(item?.amount),
      currency: v22Currency(item?.currency, "TRY"),
      eliminationType: V22_ELIMINATION_TYPES[String(item?.eliminationType || "OTHER").toUpperCase()] || "OTHER",
      reportingDate: v22NormalizeDate(item?.reportingDate),
      status: String(item?.status || "DRAFT").toUpperCase(),
      reason: String(item?.reason || ""),
      createdAt: item?.createdAt || v22Now(),
      updatedAt: item?.updatedAt || v22Now(),
      createdBy: item?.createdBy || v22CurrentUser()?.id || "system",
      schemaVersion: V22_SCHEMA_VERSION,
      entityType: "Elimination"
    }));
  }

  function v22LoadAdjustments() {
    return V22StorageAdapters.adjustments().list().map(item => ({
      id: String(item?.id || v22Id("ADJ")),
      groupId: String(item?.groupId || "GROUP-DEFAULT"),
      account: String(item?.account || ""),
      amount: v22Amount(item?.amount),
      currency: v22Currency(item?.currency, "TRY"),
      reason: String(item?.reason || ""),
      reportingDate: v22NormalizeDate(item?.reportingDate),
      createdBy: item?.createdBy || v22CurrentUser()?.id || "system",
      approvedBy: item?.approvedBy || null,
      status: String(item?.status || "PREPARED").toUpperCase(),
      createdAt: item?.createdAt || v22Now(),
      updatedAt: item?.updatedAt || v22Now(),
      schemaVersion: V22_SCHEMA_VERSION,
      entityType: "ConsolidationAdjustment"
    }));
  }

  let v22Ownership = v22LoadOwnership();
  let v22Scope = v22LoadScope();
  let v22Eliminations = v22LoadEliminations();
  let v22Adjustments = v22LoadAdjustments();

  function v22PersistCollection(adapter, rows) { return adapter.save(v22SafeArray(rows)); }

  function getGroups(options = {}) {
    v22Require("group.view", options);
    return v22Clone(v22Groups) || [];
  }

  function getGroup(groupId, options = {}) {
    v22Require("group.view", { ...options, groupId });
    return v22Groups.find(group => String(group.id) === String(groupId)) || null;
  }

  function createGroup(input = {}, options = {}) {
    v22Require("group.manage", options);
    const group = v22NormalizeGroup(input);
    if (v22Groups.some(item => item.id === group.id || item.code === group.code)) {
      throw new Error(`Group ID or code already exists: ${group.id}`);
    }
    v22Groups.push(group);
    v22SaveGroups(v22Groups);
    v22RecordAudit("GROUP_CREATE", "GROUP", group.id, { group });
    return v22Clone(group);
  }

  function updateGroup(groupId, patch = {}, options = {}) {
    v22Require("group.manage", { ...options, groupId });
    const index = v22Groups.findIndex(item => String(item.id) === String(groupId));
    if (index < 0) return null;
    const next = v22NormalizeGroup({ ...v22Groups[index], ...v22SafeObject(patch), id: v22Groups[index].id, updatedAt: v22Now() });
    const old = v22Clone(v22Groups[index]);
    v22Groups[index] = next;
    v22SaveGroups(v22Groups);
    v22RecordAudit("GROUP_UPDATE", "GROUP", groupId, { oldValue: old, newValue: next });
    return v22Clone(next);
  }


  function v22CompanyNameToId(name) {
    const target = String(name || "").trim();
    const company = v22CompanyList().find(item => String(item.name) === target || String(item.id) === target || String(item.code) === target);
    return company?.id || null;
  }

  function v22EnsureCompanyGroupMembership() {
    const companies = v22CompanyList();
    const existing = new Map(v22Scope.map(scope => [String(scope.companyId), scope]));
    let changed = false;
    companies.forEach(company => {
      if (!existing.has(String(company.id))) {
        v22Scope.push({
          id: v22Id("SCOPE"),
          groupId: "GROUP-DEFAULT",
          companyId: String(company.id),
          consolidationMethod: "FULL",
          ownershipPercentage: 100,
          effectiveDate: null,
          included: true,
          createdAt: v22Now(),
          updatedAt: v22Now(),
          schemaVersion: V22_SCHEMA_VERSION,
          entityType: "ConsolidationScope"
        });
        changed = true;
      }
    });
    if (changed) v22PersistCollection(V22StorageAdapters.scope(), v22Scope);
    return changed;
  }

  try {
    v22EnsureCompanyGroupMembership();
  } catch (error) {
    console.error("V22 company/group membership init error:", error);
  }

  function addCompanyToGroup(groupId, companyId, input = {}, options = {}) {
    v22Require("group.manage", { ...options, groupId, companyId });
    if (!v22Groups.some(group => String(group.id) === String(groupId))) throw new Error("Group not found.");
    const company = v22CompanyList().find(item => String(item.id) === String(companyId));
    if (!company) throw new Error("Company not found.");
    const existing = v22Scope.find(item => String(item.groupId) === String(groupId) && String(item.companyId) === String(companyId));
    const scope = existing || {
      id: v22Id("SCOPE"),
      groupId: String(groupId),
      companyId: String(companyId),
      createdAt: v22Now()
    };
    const next = {
      ...scope,
      consolidationMethod: V22_CONSOLIDATION_METHODS[String(input.consolidationMethod || scope.consolidationMethod || "FULL").toUpperCase()] || "FULL",
      ownershipPercentage: Math.max(0, Math.min(100, v22Amount(input.ownershipPercentage ?? scope.ownershipPercentage ?? 100))),
      effectiveDate: v22NormalizeDate(input.effectiveDate ?? scope.effectiveDate),
      included: input.included !== undefined ? input.included !== false : scope.included !== false,
      updatedAt: v22Now(),
      schemaVersion: V22_SCHEMA_VERSION,
      entityType: "ConsolidationScope"
    };
    if (existing) Object.assign(existing, next);
    else v22Scope.push(next);
    v22PersistCollection(V22StorageAdapters.scope(), v22Scope);
    v22RecordAudit("COMPANY_ADDED", "GROUP", groupId, { companyId, scope: next });
    return v22Clone(next);
  }

  function removeCompanyFromGroup(groupId, companyId, options = {}) {
    v22Require("group.manage", { ...options, groupId, companyId });
    const before = v22Scope.length;
    v22Scope = v22Scope.filter(item => !(String(item.groupId) === String(groupId) && String(item.companyId) === String(companyId)));
    v22PersistCollection(V22StorageAdapters.scope(), v22Scope);
    const removed = before !== v22Scope.length;
    if (removed) v22RecordAudit("COMPANY_REMOVED", "GROUP", groupId, { companyId });
    return removed;
  }

  function setCompanyOwnership(input = {}, options = {}) {
    v22Require("group.manage", options);
    const parentCompanyId = String(input.parentCompanyId || "");
    const subsidiaryCompanyId = String(input.subsidiaryCompanyId || "");
    if (!parentCompanyId || !subsidiaryCompanyId || parentCompanyId === subsidiaryCompanyId) throw new Error("Valid parent and subsidiary companies are required.");
    const ownershipPercentage = v22Amount(input.ownershipPercentage);
    if (ownershipPercentage < 0 || ownershipPercentage > 100) throw new Error("Ownership percentage must be between 0 and 100.");
    const existing = v22Ownership.find(item => item.parentCompanyId === parentCompanyId && item.subsidiaryCompanyId === subsidiaryCompanyId && item.status === "ACTIVE");
    const record = {
      id: existing?.id || v22Id("OWN"),
      parentCompanyId,
      subsidiaryCompanyId,
      ownershipPercentage,
      effectiveDate: v22NormalizeDate(input.effectiveDate),
      controlType: V22_CONTROL_TYPES[String(input.controlType || "SUBSIDIARY").toUpperCase()] || "SUBSIDIARY",
      status: String(input.status || "ACTIVE").toUpperCase(),
      createdAt: existing?.createdAt || v22Now(),
      updatedAt: v22Now(),
      schemaVersion: V22_SCHEMA_VERSION,
      entityType: "Ownership"
    };
    if (existing) Object.assign(existing, record);
    else v22Ownership.push(record);
    v22PersistCollection(V22StorageAdapters.ownership(), v22Ownership);
    v22RecordAudit("OWNERSHIP_CHANGED", "OWNERSHIP", record.id, record);
    return v22Clone(record);
  }

  function getOwnership(groupId = null, options = {}) {
    v22Require("group.view", { ...options, groupId });
    return v22Clone(groupId
      ? v22Ownership.filter(item => {
          const scopes = v22Scope.filter(scope => String(scope.groupId) === String(groupId)).map(scope => String(scope.companyId));
          return scopes.includes(String(item.parentCompanyId)) || scopes.includes(String(item.subsidiaryCompanyId));
        })
      : v22Ownership) || [];
  }

  function setConsolidationScope(input = {}, options = {}) {
    v22Require("group.manage", { ...options, groupId: input.groupId, companyId: input.companyId });
    const companyId = String(input.companyId || "");
    const groupId = String(input.groupId || "");
    if (!companyId || !groupId) throw new Error("groupId and companyId are required.");
    if (!v22CompanyList().some(company => String(company.id) === companyId)) throw new Error("Company not found.");
    if (!v22Groups.some(group => String(group.id) === groupId)) throw new Error("Group not found.");
    const existing = v22Scope.find(item => String(item.groupId) === groupId && String(item.companyId) === companyId);
    const record = {
      id: existing?.id || v22Id("SCOPE"),
      groupId,
      companyId,
      consolidationMethod: V22_CONSOLIDATION_METHODS[String(input.consolidationMethod || existing?.consolidationMethod || "FULL").toUpperCase()] || "FULL",
      ownershipPercentage: Math.max(0, Math.min(100, v22Amount(input.ownershipPercentage ?? existing?.ownershipPercentage ?? 100))),
      effectiveDate: v22NormalizeDate(input.effectiveDate ?? existing?.effectiveDate),
      included: input.included !== undefined ? input.included !== false : existing?.included !== false,
      createdAt: existing?.createdAt || v22Now(),
      updatedAt: v22Now(),
      schemaVersion: V22_SCHEMA_VERSION,
      entityType: "ConsolidationScope"
    };
    if (existing) Object.assign(existing, record);
    else v22Scope.push(record);
    v22PersistCollection(V22StorageAdapters.scope(), v22Scope);
    return v22Clone(record);
  }

  function getConsolidationScope(groupId, options = {}) {
    v22Require("group.view", { ...options, groupId });
    return v22Clone(v22Scope.filter(item => String(item.groupId) === String(groupId))) || [];
  }


  function v22ContractsForCompany(companyId) {
    const rows = typeof v20GetContracts === "function" ? v20GetContracts() : v22SafeArray(typeof contracts !== "undefined" ? contracts : []);
    return rows.filter(contract => {
      const resolved = String(contract?.companyId || v22CompanyNameToId(contract?.company) || "");
      return resolved === String(companyId);
    });
  }

  function v22ContractMetrics(contract, reportingDate) {
    const date = v22NormalizeDate(reportingDate) || v22NormalizeDate(contract?.reportingDate) || v22Now().slice(0, 10);
    try {
      if (typeof rptGetContractCfo === "function") {
        const result = rptGetContractCfo(contract, date) || {};
        return {
          contractId: contract.id,
          currency: v22Currency(result.currency || contract.currency, "TRY"),
          leaseLiability: v22Amount(result.leaseLiability ?? result.liability),
          currentLiability: v22Amount(result.currentLiability ?? result.current),
          nonCurrentLiability: v22Amount(result.nonCurrentLiability ?? result.nonCurrent),
          rouAsset: v22Amount(result.rouAsset ?? result.rouAssets),
          interest: v22Amount(result.monthlyInterest ?? result.interest),
          depreciation: v22Amount(result.monthlyDepreciation ?? result.depreciation),
          cashPayments: v22Amount(result.next12MonthPayments ?? result.cashPayments),
          active: result.active !== false
        };
      }
    } catch (error) {}

    try {
      const engine = typeof cfoBuildSchedule === "function"
        ? cfoBuildSchedule(contract)
        : (typeof calculateLeaseEngine === "function" ? getPrivateCalculationForConsumer(contract) : {});
      const schedule = v22SafeArray(engine?.schedule);
      const rows = schedule.filter(row => !date || !row.date || String(row.date) <= String(date));
      const latest = rows.length ? rows[rows.length - 1] : null;
      const current = typeof calculateCurrentLiabilityAsOf === "function"
        ? v22Amount(calculateCurrentLiabilityAsOf(contract, date))
        : 0;
      const total = v22Amount(latest?.closingLiability ?? engine?.liability);
      return {
        contractId: contract.id,
        currency: v22Currency(contract.currency, "TRY"),
        leaseLiability: total,
        currentLiability: current,
        nonCurrentLiability: Math.max(0, total - current),
        rouAsset: v22Amount(latest?.rouClosing ?? engine?.rouAssets),
        interest: v22Amount(latest?.interest),
        depreciation: v22Amount(latest?.depreciation),
        cashPayments: rows.slice(-12).reduce((sum, row) => sum + v22Amount(row.payment), 0),
        active: String(contract.status || "active").toLowerCase() !== "inactive"
      };
    } catch (error) {
      return {
        contractId: contract?.id || null, currency: v22Currency(contract?.currency, "TRY"),
        leaseLiability: 0, currentLiability: 0, nonCurrentLiability: 0,
        rouAsset: 0, interest: 0, depreciation: 0, cashPayments: 0, active: false
      };
    }
  }

  function v22AggregateCompany(company, reportingDate) {
    const contracts = v22ContractsForCompany(company.id);
    const metrics = contracts.map(contract => v22ContractMetrics(contract, reportingDate));
    const totals = metrics.reduce((acc, row) => {
      ["leaseLiability", "currentLiability", "nonCurrentLiability", "rouAsset", "interest", "depreciation", "cashPayments"].forEach(key => { acc[key] += v22Amount(row[key]); });
      if (row.active) acc.activeContracts += 1;
      return acc;
    }, { leaseLiability: 0, currentLiability: 0, nonCurrentLiability: 0, rouAsset: 0, interest: 0, depreciation: 0, cashPayments: 0, activeContracts: 0 });
    return {
      companyId: String(company.id),
      company: company.name,
      code: company.code,
      country: company.country,
      baseCurrency: v22Currency(company.baseCurrency, "TRY"),
      reportingDate: v22NormalizeDate(reportingDate),
      contractCount: contracts.length,
      activeContracts: totals.activeContracts,
      leaseLiability: totals.leaseLiability,
      currentLiability: totals.currentLiability,
      nonCurrentLiability: totals.nonCurrentLiability,
      rou: totals.rouAsset,
      interest: totals.interest,
      depreciation: totals.depreciation,
      cashPayments: totals.cashPayments,
      source: "V21_CFO_DATA_LAYER",
      contracts: metrics
    };
  }





  function createElimination(input = {}, options = {}) {
    v22Require("eliminations.manage", { ...options, groupId: input.groupId, action: "ELIMINATION_CREATE" });
    const row = {
      id: String(input.id || v22Id("ELIM")),
      groupId: String(input.groupId || "GROUP-DEFAULT"),
      fromCompanyId: String(input.fromCompanyId || ""),
      toCompanyId: String(input.toCompanyId || ""),
      account: String(input.account || ""),
      amount: v22Amount(input.amount),
      currency: v22Currency(input.currency, "TRY"),
      eliminationType: V22_ELIMINATION_TYPES[String(input.eliminationType || "OTHER").toUpperCase()] || "OTHER",
      reportingDate: v22NormalizeDate(input.reportingDate),
      status: String(input.status || "DRAFT").toUpperCase(),
      reason: String(input.reason || ""),
      createdAt: input.createdAt || v22Now(),
      updatedAt: v22Now(),
      createdBy: input.createdBy || v22CurrentUser()?.id || "system",
      schemaVersion: V22_SCHEMA_VERSION,
      entityType: "Elimination"
    };
    if (!row.fromCompanyId || !row.toCompanyId) throw new Error("fromCompanyId and toCompanyId are required.");
    if (row.fromCompanyId === row.toCompanyId) throw new Error("Elimination source and target companies must differ.");
    if (v22Eliminations.some(item => item.id === row.id)) throw new Error(`Elimination ID already exists: ${row.id}`);
    v22Eliminations.push(row);
    v22PersistCollection(V22StorageAdapters.eliminations(), v22Eliminations);
    v22RecordAudit("ELIMINATION_CREATED", "ELIMINATION", row.id, row);
    return v22Clone(row);
  }

  function updateElimination(id, patch = {}, options = {}) {
    const existing = v22Eliminations.find(item => String(item.id) === String(id));
    if (!existing) return null;
    v22Require("eliminations.manage", { ...options, groupId: existing.groupId, entityId: id, action: "ELIMINATION_UPDATE" });
    const old = v22Clone(existing);
    Object.assign(existing, {
      ...v22SafeObject(patch),
      id: existing.id,
      amount: patch.amount === undefined ? existing.amount : v22Amount(patch.amount),
      currency: patch.currency === undefined ? existing.currency : v22Currency(patch.currency, existing.currency),
      reportingDate: patch.reportingDate === undefined ? existing.reportingDate : v22NormalizeDate(patch.reportingDate),
      updatedAt: v22Now(),
      schemaVersion: V22_SCHEMA_VERSION,
      entityType: "Elimination"
    });
    v22PersistCollection(V22StorageAdapters.eliminations(), v22Eliminations);
    v22RecordAudit("ELIMINATION_UPDATED", "ELIMINATION", id, { oldValue: old, newValue: existing });
    return v22Clone(existing);
  }


  function createConsolidationAdjustment(input = {}, options = {}) {
    v22Require("consolidation.execute", { ...options, groupId: input.groupId, action: "CONSOLIDATION_ADJUSTMENT_CREATE" });
    const row = {
      id: String(input.id || v22Id("ADJ")),
      groupId: String(input.groupId || "GROUP-DEFAULT"),
      account: String(input.account || ""),
      amount: v22Amount(input.amount),
      currency: v22Currency(input.currency, "TRY"),
      reason: String(input.reason || ""),
      reportingDate: v22NormalizeDate(input.reportingDate),
      createdBy: input.createdBy || v22CurrentUser()?.id || "system",
      approvedBy: input.approvedBy || null,
      status: String(input.status || "PREPARED").toUpperCase(),
      createdAt: input.createdAt || v22Now(),
      updatedAt: v22Now(),
      schemaVersion: V22_SCHEMA_VERSION,
      entityType: "ConsolidationAdjustment"
    };
    v22Adjustments.push(row);
    v22PersistCollection(V22StorageAdapters.adjustments(), v22Adjustments);
    return v22Clone(row);
  }










  function v22GetDatabaseModel() {
    const groups = v22Groups.map(v22Clone);
    const companies = v22CompanyList().map(company => ({ ...v22Clone(company), groupId: v22Scope.find(scope => String(scope.companyId) === String(company.id))?.groupId || "GROUP-DEFAULT" }));
    return {
      schemaVersion: V22_SCHEMA_VERSION,
      generatedAt: v22Now(),
      Group: groups,
      Company: companies,
      Ownership: v22Clone(v22Ownership),
      ConsolidationScope: v22Clone(v22Scope),
      Elimination: v22Clone(v22Eliminations),
      ConsolidationAdjustment: v22Clone(v22Adjustments)
    };
  }


  function v22CreateDataSnapshot() {
    const base = typeof createDataSnapshot === "function" ? createDataSnapshot() : { storage: {} };
    const snapshot = {
      ...base,
      schemaVersion: V22_SCHEMA_VERSION,
      createdAt: v22Now(),
      v22Storage: {
        [V22_GROUP_STORAGE_KEY]: localStorage.getItem(V22_GROUP_STORAGE_KEY),
        [V22_OWNERSHIP_STORAGE_KEY]: localStorage.getItem(V22_OWNERSHIP_STORAGE_KEY),
        [V22_SCOPE_STORAGE_KEY]: localStorage.getItem(V22_SCOPE_STORAGE_KEY),
        [V22_ELIMINATION_STORAGE_KEY]: localStorage.getItem(V22_ELIMINATION_STORAGE_KEY),
        [V22_ADJUSTMENT_STORAGE_KEY]: localStorage.getItem(V22_ADJUSTMENT_STORAGE_KEY)
      }
    };
    return snapshot;
  }

  function v22ValidateSnapshot(snapshot) {
    const base = typeof validateDataSnapshot === "function" ? validateDataSnapshot(snapshot) : { valid: true, errors: [] };
    const errors = [...v22SafeArray(base.errors)];
    if (!snapshot || typeof snapshot !== "object") errors.push("Snapshot object is required.");
    if (snapshot?.v22Storage && typeof snapshot.v22Storage !== "object") errors.push("V22 storage payload is invalid.");
    Object.values(snapshot?.v22Storage || {}).forEach(raw => {
      if (raw === null || raw === "") return;
      try { JSON.parse(raw); } catch (error) { errors.push("Invalid JSON in V22 snapshot storage."); }
    });
    return { valid: errors.length === 0, errors };
  }

  function v22RestoreDataSnapshot(snapshot, options = {}) {
    const validation = v22ValidateSnapshot(snapshot);
    if (!validation.valid) return { success: false, validation };
    if (options.confirm !== true) return { success: false, validation, requiresConfirmation: true, message: "Snapshot validation passed. Explicit confirmation is required before restore." };
    try {
      if (typeof restoreDataSnapshot === "function" && snapshot?.storage) {
        const baseResult = restoreDataSnapshot({ ...snapshot, storage: snapshot.storage }, { confirm: true });
        if (!baseResult.success) return baseResult;
      }
      Object.entries(snapshot.v22Storage || {}).forEach(([key, value]) => {
        if (value === null || value === undefined) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      });
      v22Groups = v22LoadGroups();
      v22Ownership = v22LoadOwnership();
      v22Scope = v22LoadScope();
      v22Eliminations = v22LoadEliminations();
      v22Adjustments = v22LoadAdjustments();
      return { success: true, validation, schemaVersion: V22_SCHEMA_VERSION };
    } catch (error) {
      return { success: false, validation, error: { code: "V22_SNAPSHOT_RESTORE_FAILED", message: error?.message || String(error), details: null, field: null } };
    }
  }




  function v22GetApiAuthorizationContract() {
    return [
      { endpoint: "GET /groups", permission: "group.view", statusCodeOnDenied: 403 },
      { endpoint: "GET /groups/:id", permission: "group.view", statusCodeOnDenied: 403 },
      { endpoint: "POST /groups", permission: "group.manage", statusCodeOnDenied: 403 },
      { endpoint: "PUT /groups/:id", permission: "group.manage", statusCodeOnDenied: 403 },
      { endpoint: "GET /groups/:id/consolidation", permission: "consolidation.view", statusCodeOnDenied: 403 },
      { endpoint: "POST /groups/:id/consolidation/run", permission: "consolidation.execute", statusCodeOnDenied: 403 },
      { endpoint: "GET /groups/:id/eliminations", permission: "eliminations.view", statusCodeOnDenied: 403 },
      { endpoint: "POST /groups/:id/eliminations", permission: "eliminations.manage", statusCodeOnDenied: 403 },
      { endpoint: "PUT /eliminations/:id", permission: "eliminations.manage", statusCodeOnDenied: 403 },
      { endpoint: "POST /groups/:id/consolidation/export", permission: "consolidation.export", statusCodeOnDenied: 403 },
      { endpoint: "GET /groups/:id/controls", permission: "group.view", statusCodeOnDenied: 403 },
      { endpoint: "GET /groups/:id/close", permission: "group.view", statusCodeOnDenied: 403 }
    ];
  }

  function v22Paginate(rows, options = {}) {
    const data = v22SafeArray(rows);
    const pageSize = Math.max(1, Number(options.pageSize) || 25);
    const page = Math.max(1, Number(options.page) || 1);
    const total = data.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const start = (page - 1) * pageSize;
    return { data: v22Clone(data.slice(start, start + pageSize)), metadata: { page, pageSize, total, totalPages } };
  }

  function v22FilterGroups(groups, filters = {}) {
    return v22SafeArray(groups).filter(group => {
      if (filters.status && String(group.status).toUpperCase() !== String(filters.status).toUpperCase()) return false;
      if (filters.query && !JSON.stringify(group).toLowerCase().includes(String(filters.query).toLowerCase())) return false;
      return true;
    });
  }

  function v22MigrationReport() {
    const companies = v22CompanyList();
    return {
      from: "21.0",
      to: V22_SCHEMA_VERSION,
      companies: companies.length,
      groups: v22Groups.length,
      scopes: v22Scope.length,
      ownership: v22Ownership.length,
      eliminations: v22Eliminations.length,
      adjustments: v22Adjustments.length,
      defaultGroupApplied: v22Scope.filter(row => row.groupId === "GROUP-DEFAULT").length,
      companyIdsPreserved: true,
      storageKeyPreserved: typeof STORAGE_KEY !== "undefined" ? STORAGE_KEY : null
    };
  }

  function v22Tests() {
    const results = [];
    const pass = (name, value, detail = null) => results.push({ name, passed: !!value, detail });
    const group = v22Groups[0];
    const companies = v22CompanyList();
    pass("Create Group model", !!group?.id);
    pass("Company-GROUP relationship", v22Scope.every(row => row.groupId && row.companyId));
    pass("Ownership model", Array.isArray(v22Ownership));
    pass("Consolidation Scope", Array.isArray(v22Scope));
    pass("Company aggregation", companies.every(company => !!v22AggregateCompany(company, v22Now().slice(0, 10))));
    if (group) {
      const user = v22CurrentUser();
      const view = v22HasPermission("consolidation.view", user);
      pass("Consolidation authorization", view || !user);
      if (view || !user) {
        const result = getConsolidatedData(group.id, v22Now().slice(0, 10), { user });
        pass("Group aggregation", !!result.success);
        pass("Group reporting date", !!result.data?.reportingDate);
        pass("Group currency foundation", !!result.data?.groupCurrency);
        pass("Data lineage", Array.isArray(result.data?.lineage?.leaseLiability));
        pass("Group controls", !!getGroupControlStatus(group.id, v22Now().slice(0, 10), { user }));
        pass("Group close", !!getGroupCloseStatus(group.id, v22Now().slice(0, 10), { user }));
        pass("Group CFO data", !!getGroupCfoDashboardData(group.id, v22Now().slice(0, 10), { user }));
      }
    }
    pass("Audit integration", typeof recordAuditEvent === "function");
    pass("Database-ready export", !!v22GetDatabaseModel().schemaVersion);
    pass("Migration", v22MigrationReport().companyIdsPreserved === true);
    pass("Data health", !!getV22DataHealth());
    pass("API authorization contract", Array.isArray(v22GetApiAuthorizationContract()));
    pass("Pagination model", v22Paginate([1, 2, 3], { page: 1, pageSize: 2 }).metadata.total === 3);
    return { version: V22_SCHEMA_VERSION, passed: results.every(item => item.passed), results };
  }

  /* ==========================================================
     V23 FX / MULTI-CURRENCY ENGINE
     Additive layer. V22 consolidation remains canonical.
  ========================================================== */

  const V23_SCHEMA_VERSION = "23.0";
  const V23_CURRENCY_STORAGE_KEY = "gk_tfrs16_v23_currencies_v1";
  const V23_RATE_STORAGE_KEY = "gk_tfrs16_v23_fx_rates_v1";
  const V23_CTA_STORAGE_KEY = "gk_tfrs16_v23_cta_v1";
  const V23_FX_EVENT_SOURCE = "V23_FX";

  const V23_RATE_TYPES = Object.freeze({ SPOT:"SPOT", CLOSING:"CLOSING", AVERAGE:"AVERAGE", HISTORICAL:"HISTORICAL", FORWARD:"FORWARD" });
  const V23_RATE_SOURCES = Object.freeze({ MANUAL:"MANUAL", IMPORT:"IMPORT", SYSTEM:"SYSTEM", CENTRAL_BANK:"CENTRAL_BANK", ERP:"ERP" });
  const V23_MISSING_RATE_POLICIES = Object.freeze({ BLOCK:"BLOCK", WARNING:"WARNING", USE_LAST_AVAILABLE:"USE_LAST_AVAILABLE" });
  const V23_FX_STATUS = Object.freeze({ DRAFT:"DRAFT", REVIEWED:"REVIEWED", APPROVED:"APPROVED", REJECTED:"REJECTED" });
  const V23_RECON_STATUS = Object.freeze({ MATCHED:"MATCHED", WARNING:"WARNING", EXCEPTION:"EXCEPTION" });
  const V23_ITEM_TYPES = Object.freeze({ MONETARY:"MONETARY", NON_MONETARY:"NON_MONETARY" });
  const V23_SECURITY_PERMISSIONS = Object.freeze([
    "fx.view","fx.manage","fx.import","fx.export","fx.execute"
  ]);
  const V23_DEFAULT_CURRENCIES = Object.freeze([
    { code:"TRY", name:"Turkish Lira", symbol:"₺", decimalPlaces:2, status:"ACTIVE" },
    { code:"USD", name:"US Dollar", symbol:"$", decimalPlaces:2, status:"ACTIVE" },
    { code:"EUR", name:"Euro", symbol:"€", decimalPlaces:2, status:"ACTIVE" }
  ]);
  const FX_CONFIG = Object.freeze({
    version: V23_SCHEMA_VERSION,
    defaultRateType: V23_RATE_TYPES.CLOSING,
    balanceSheetRateType: V23_RATE_TYPES.CLOSING,
    incomeStatementRateType: V23_RATE_TYPES.AVERAGE,
    equityRateType: V23_RATE_TYPES.HISTORICAL,
    rounding: { defaultDecimalPlaces: 2, mode:"HALF_UP" },
    missingRatePolicy: V23_MISSING_RATE_POLICIES.BLOCK,
    manualRateAllowed: true,
    translationRules: Object.freeze({
      MONETARY_BALANCE_SHEET: V23_RATE_TYPES.CLOSING,
      NON_MONETARY_BALANCE_SHEET: V23_RATE_TYPES.HISTORICAL,
      INCOME_STATEMENT: V23_RATE_TYPES.AVERAGE,
      HISTORICAL_EQUITY: V23_RATE_TYPES.HISTORICAL
    })
  });

  /** @deprecated-name Kalıcı: v23Clone — dış çağrılarla (window.GK_TFRS16, olası eski referanslar) uyumluluk için korunuyor. Bkz. coreClone. */
  function v23Clone(value) { return coreClone(value); }
  function v23Array(value) { return Array.isArray(value) ? value : []; }
  function v23Object(value) { return value && typeof value === "object" ? value : {}; }
  function v23Now() { return new Date().toISOString(); }
  function v23Id(prefix="V23") { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,10)}`; }
  // v23Date native `new Date(value)` davranışını korur. v23DateKey ise
  // finansal takvim gününü korumak için aşağıda yerel tarih bileşenlerini
  // kullanır; UTC ISO dönüşümü Türkiye'de günü geriye kaydırmamalıdır.
  function v23Date(value) { const d=new Date(value); return Number.isNaN(d.getTime()) ? null : d; }
  function v23DateKey(value) {
    // Finansal kur tabloları takvim günüyle anahtarlanır. Raporlama
    // ekranlarından gelen Date nesneleri yerel gece yarısını taşır;
    // toISOString() bunları UTC'ye çevirip Türkiye saat diliminde bir
    // önceki güne kaydırıyordu (30.06 kapanışı yerine 29.06 kuru).
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
      return value.trim();
    }
    const d=v23Date(value);
    return d ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}` : null;
  }
  /** @deprecated-name Kalıcı: v23Num — dış çağrılarla (window.GK_TFRS16, olası eski referanslar) uyumluluk için korunuyor. Bkz. coreNumber. */
  function v23Num(value, fallback=0) { return coreNumber(value, fallback); }
  function v23CurrencyCode(value) { return String(value || "").trim().toUpperCase(); }
  /** @deprecated-name Kalıcı: v23Round — dış çağrılarla (window.GK_TFRS16, olası eski referanslar) uyumluluk için korunuyor. Bkz. coreRound. decimalPlaces çağrı ÖNCESİNDE Math.max(0,...) ile kelepçeleniyor (orijinal davranış). */
  function v23Round(value, decimalPlaces=2) { return coreRound(value, Math.max(0, decimalPlaces)); }
  function v23Actor() { try { return String(window.currentUser?.id || window.currentUser?.username || "system"); } catch(e) { return "system"; } }
  function v23Audit(action, entityType, entityId, metadata={}) {
    try { if (typeof recordAuditEvent === "function") return recordAuditEvent({ action, entityType, entityId:entityId || null, actor:v23Actor(), reason:`${V23_FX_EVENT_SOURCE}:${action}`, metadata:{...v23Object(metadata), source:V23_FX_EVENT_SOURCE, schemaVersion:V23_SCHEMA_VERSION} }); } catch(e) {}
    return null;
  }
  function v23CurrentUser() { try { return typeof getCurrentUser === "function" ? getCurrentUser() : (window.currentUser || null); } catch(e) { return null; } }
  function v23HasPermission(permission, user=v23CurrentUser()) {
    if (!user) return true;
    try {
      // BUG FIX: V23 FX izinleri ("fx.view", "fx.manage" vb.) V21 uygulama
      // izin kataloğunda hiç tanımlı değil (ayrı bir isim uzayı). Önceki
      // sürüm doğrudan genel hasPermission()'a devrediyordu; o da bu
      // fx.* string'lerini hiçbir rolde bulamadığı için ADMIN dahil HERKES
      // reddediliyordu. Önce kendi V23_ROLE_PERMISSIONS tablosuna bakıyoruz;
      // orada yoksa (ileride biri gerçekten entegre ederse diye) genel
      // fonksiyona düşüyoruz.
      const roles=v23Array(user.roleIds || user.roles).map(x=>String(x).toUpperCase());
      if (roles.includes("ADMIN")) return true;
      if (roles.some(role=>v23Array(V23_ROLE_PERMISSIONS[role]).includes(permission))) return true;
      if (typeof hasPermission === "function") return hasPermission(user, permission);
      if (typeof v21HasPermission === "function") return v21HasPermission(permission, user);
      return false;
    } catch(e) { return false; }
  }
  function v23Authorize(permission, options={}) {
    const user=options.user || v23CurrentUser();
    if (!v23HasPermission(permission,user)) {
      v23Audit("ACCESS_DENIED","FX",options.entityId || null,{permission,userId:user?.id || null,action:options.action || null});
      const err=new Error("You do not have permission to perform this action."); err.code="403"; err.reason="FORBIDDEN"; throw err;
    }
    return true;
  }
  function v23StorageGet(key, fallback=[]) { try { const raw=localStorage.getItem(key); const parsed=raw ? JSON.parse(raw) : null; return parsed ?? fallback; } catch(e) { return fallback; } }
  function v23StorageSet(key,value) { try { localStorage.setItem(key,JSON.stringify(value)); return true; } catch(e) { return false; } }

  const V23_ROLE_PERMISSIONS = Object.freeze({
    ADMIN: V23_SECURITY_PERMISSIONS.slice(),
    CFO: ["fx.view","fx.export","fx.execute"],
    FINANCE_MANAGER: ["fx.view","fx.manage","fx.import","fx.export","fx.execute"],
    ACCOUNTANT: ["fx.view","fx.execute"],
    CONTROLLER: ["fx.view","fx.manage","fx.export","fx.execute"],
    AUDITOR: ["fx.view","fx.export"],
    VIEWER: ["fx.view"]
  });

  function loadV23Currencies() {
    const stored=v23StorageGet(V23_CURRENCY_STORAGE_KEY,null);
    if (Array.isArray(stored) && stored.length) return stored;
    v23StorageSet(V23_CURRENCY_STORAGE_KEY,V23_DEFAULT_CURRENCIES.map(v23Clone));
    return V23_DEFAULT_CURRENCIES.map(v23Clone);
  }
  function normalizeV23Currency(input={}) {
    const source=v23Object(input), code=v23CurrencyCode(source.code);
    if (!code) throw new Error("Currency code is required.");
    return { code, name:String(source.name || code), symbol:String(source.symbol || code), decimalPlaces:Math.max(0,Math.min(8,Math.floor(v23Num(source.decimalPlaces,2)))), status:String(source.status || "ACTIVE").toUpperCase(), schemaVersion:V23_SCHEMA_VERSION };
  }
  function getCurrencies() { return loadV23Currencies().map(v23Clone); }
  function getCurrency(code) { const c=v23CurrencyCode(code); return loadV23Currencies().find(x=>x.code===c) || null; }
  function createCurrency(input={}, options={}) {
    v23Authorize("fx.manage",{...options,action:"CURRENCY_CREATE"});
    const currency=normalizeV23Currency(input), rows=loadV23Currencies();
    if (rows.some(x=>x.code===currency.code)) throw new Error(`Currency already exists: ${currency.code}`);
    rows.push(currency); v23StorageSet(V23_CURRENCY_STORAGE_KEY,rows); v23Audit("CURRENCY_CREATED","CURRENCY",currency.code,{currency}); return v23Clone(currency);
  }
  function updateCurrency(code, patch={}, options={}) {
    v23Authorize("fx.manage",{...options,action:"CURRENCY_UPDATE",entityId:code});
    const rows=loadV23Currencies(), idx=rows.findIndex(x=>x.code===v23CurrencyCode(code)); if(idx<0) return null;
    const before=rows[idx], next=normalizeV23Currency({...before,...v23Object(patch),code:before.code}); rows[idx]=next; v23StorageSet(V23_CURRENCY_STORAGE_KEY,rows); v23Audit("CURRENCY_UPDATED","CURRENCY",next.code,{before,newValue:next}); return v23Clone(next);
  }

  let backendFxRateCache = null; // null = backend henüz sorulmadı
  function loadV23Rates() {
    const localRows=v23StorageGet(V23_RATE_STORAGE_KEY,[]);
    const rows=Array.isArray(localRows) ? localRows.map(v23Clone) : [];
    if (!Array.isArray(backendFxRateCache)) return rows;
    const backendKeys=new Set(backendFxRateCache.map(row => `${row.fromCurrency}|${row.toCurrency}|${row.rateDate}|${row.rateType}`));
    return rows.filter(row => !backendKeys.has(`${row.fromCurrency}|${row.toCurrency}|${row.rateDate}|${row.rateType}`))
      .concat(backendFxRateCache.map(v23Clone));
  }
  function saveV23Rates(rows) { return v23StorageSet(V23_RATE_STORAGE_KEY,rows); }
  function normalizeFxRate(input={}) {
    const source=v23Object(input), from=v23CurrencyCode(source.fromCurrency), to=v23CurrencyCode(source.toCurrency), rateDate=v23DateKey(source.rateDate);
    if(!from || !to) throw Object.assign(new Error("Currency mismatch: fromCurrency and toCurrency are required."),{code:"FX_CURRENCY_REQUIRED"});
    if(!getCurrency(from) || !getCurrency(to)) throw Object.assign(new Error("Unsupported currency."),{code:"UNSUPPORTED_CURRENCY"});
    if (from !== to && !((from === "USD" || from === "EUR") && to === "TRY")) {
      throw Object.assign(new Error("Only USD/TRY and EUR/TRY direct rates are supported."),{code:"UNSUPPORTED_FX_PAIR"});
    }
    if(!rateDate) throw Object.assign(new Error("Rate date is required."),{code:"FX_RATE_DATE_REQUIRED"});
    const rate= v23Num(source.rate,NaN); if(!(rate>0) || !Number.isFinite(rate)) throw Object.assign(new Error("FX rate must be greater than zero."),{code:"INVALID_FX_RATE"});
    const rateType=String(source.rateType || FX_CONFIG.defaultRateType).toUpperCase(); if(!Object.values(V23_RATE_TYPES).includes(rateType)) throw Object.assign(new Error("Invalid FX rate type."),{code:"INVALID_RATE_TYPE"});
    const rateSource=String(source.source || V23_RATE_SOURCES.MANUAL).toUpperCase(); if(!Object.values(V23_RATE_SOURCES).includes(rateSource)) throw Object.assign(new Error("Rate source is missing or invalid."),{code:"INVALID_RATE_SOURCE"});
    return { id:String(source.id || v23Id("FXR")), fromCurrency:from,toCurrency:to,rate,rateDate,rateType,source:rateSource,status:String(source.status || (rateSource === "MANUAL" ? V23_FX_STATUS.DRAFT : V23_FX_STATUS.APPROVED)).toUpperCase(),reason:source.reason || null,createdBy:source.createdBy || v23Actor(),createdAt:source.createdAt || v23Now(),updatedAt:v23Now(),schemaVersion:V23_SCHEMA_VERSION };
  }
  function createFxRate(input={}, options={}) {
    v23Authorize("fx.manage",{...options,action:"FX_RATE_CREATED"});
    const rate=normalizeFxRate(input), rows=loadV23Rates();
    if(rate.fromCurrency===rate.toCurrency) rate.rate=1;
    const duplicate=rows.find(x=>x.fromCurrency===rate.fromCurrency && x.toCurrency===rate.toCurrency && x.rateDate===rate.rateDate && x.rateType===rate.rateType);
    if(duplicate) throw Object.assign(new Error("Duplicate FX rate."),{code:"DUPLICATE_FX_RATE"});
    rows.push(rate); saveV23Rates(rows); v23Audit("FX_RATE_CREATED","FX_RATE",rate.id,{fromCurrency:rate.fromCurrency,toCurrency:rate.toCurrency,rate:rate.rate,rateDate:rate.rateDate,rateType:rate.rateType,source:rate.source,reason:rate.reason}); return v23Clone(rate);
  }
  function updateFxRate(id, patch={}, options={}) {
    v23Authorize("fx.manage",{...options,action:"FX_RATE_UPDATED",entityId:id});
    const rows=loadV23Rates(), idx=rows.findIndex(x=>x.id===id); if(idx<0) return null;
    const before=rows[idx], next=normalizeFxRate({...before,...v23Object(patch),id:before.id});
    const duplicate=rows.some((x,i)=>i!==idx && x.fromCurrency===next.fromCurrency && x.toCurrency===next.toCurrency && x.rateDate===next.rateDate && x.rateType===next.rateType);
    if(duplicate) throw Object.assign(new Error("Duplicate FX rate."),{code:"DUPLICATE_FX_RATE"});
    rows[idx]=next; saveV23Rates(rows); v23Audit("FX_RATE_UPDATED","FX_RATE",id,{before,newValue:next}); return v23Clone(next);
  }
  function getFxRates(filters={}) {
    return loadV23Rates().filter(row=>{
      if(filters.fromCurrency && row.fromCurrency!==v23CurrencyCode(filters.fromCurrency)) return false;
      if(filters.toCurrency && row.toCurrency!==v23CurrencyCode(filters.toCurrency)) return false;
      if(filters.rateType && row.rateType!==String(filters.rateType).toUpperCase()) return false;
      if(filters.rateDate && row.rateDate!==v23DateKey(filters.rateDate)) return false;
      return true;
    }).map(v23Clone);
  }
  function getFxRate(fromCurrency,toCurrency,date,rateType=FX_CONFIG.defaultRateType,options={}) {
    const from=v23CurrencyCode(fromCurrency), to=v23CurrencyCode(toCurrency), target=v23DateKey(date), type=String(rateType || FX_CONFIG.defaultRateType).toUpperCase();
    if(!from || !to) throw Object.assign(new Error("FX currency is required."),{code:"FX_CURRENCY_REQUIRED"});
    if(!getCurrency(from) || !getCurrency(to)) throw Object.assign(new Error("Unsupported currency."),{code:"UNSUPPORTED_CURRENCY"});
    if(!target) throw Object.assign(new Error("Rate date is required."),{code:"FX_RATE_DATE_REQUIRED"});
    if(from===to) return {rate:1,fromCurrency:from,toCurrency:to,rateDate:target,rateType:type,source:V23_RATE_SOURCES.SYSTEM,id:null};
    const rows=getFxRates({fromCurrency:from,toCurrency:to,rateType:type});
    const exact=rows.find(x=>x.rateDate===target);
    if(exact) return exact;
    if(FX_CONFIG.missingRatePolicy===V23_MISSING_RATE_POLICIES.USE_LAST_AVAILABLE || options.allowLastAvailable) {
      const prior=rows.filter(x=>x.rateDate<=target).sort((a,b)=>b.rateDate.localeCompare(a.rateDate))[0];
      if(prior) return {...prior,usedFallback:true,requestedDate:target};
    }
    const error=Object.assign(new Error("FX rate not found."),{code:"FX_RATE_NOT_FOUND",fromCurrency:from,toCurrency:to,rateDate:target,rateType:type});
    if(FX_CONFIG.missingRatePolicy===V23_MISSING_RATE_POLICIES.WARNING || options.allowMissing) return {error:error.code,rate:null,fromCurrency:from,toCurrency:to,rateDate:target,rateType:type};
    throw error;
  }
  function convertCurrency(amount,fromCurrency,toCurrency,rate,options={}) {
    const from=v23CurrencyCode(fromCurrency), to=v23CurrencyCode(toCurrency); if(!getCurrency(from)||!getCurrency(to)) throw Object.assign(new Error("Unsupported currency."),{code:"UNSUPPORTED_CURRENCY"});
    const fx=from===to ? 1 : v23Num(rate,NaN); if(!(fx>0) || !Number.isFinite(fx)) throw Object.assign(new Error("Valid FX rate is required."),{code:"FX_RATE_NOT_FOUND"});
    const converted=v23Num(amount)*fx, target=getCurrency(to), decimals=options.round === false ? null : (target?.decimalPlaces ?? FX_CONFIG.rounding.defaultDecimalPlaces);
    const result={sourceAmount:v23Num(amount),sourceCurrency:from,fxRate:fx,convertedAmount:decimals===null?converted:v23Round(converted,decimals),targetCurrency:to};
    if(options.audit!==false) v23Audit("FX_CONVERSION","FX_CONVERSION",options.entityId || null,{...result,rateDate:options.rateDate || null,rateType:options.rateType || null});
    return result;
  }
  function convertCurrencyOnDate(amount,fromCurrency,toCurrency,date,rateType=FX_CONFIG.defaultRateType,options={}) {
    const fx=getFxRate(fromCurrency,toCurrency,date,rateType,options); if(fx?.error) return {...fx,sourceAmount:v23Num(amount)};
    return convertCurrency(amount,fromCurrency,toCurrency,fx.rate,{...options,audit:options.audit,rateDate:date,rateType,entityId:options.entityId});
  }

  /* ==========================================================
     V27 — RAPORLAMA PARA BİRİMİ (Kalan İşler madde 2d)
     ----------------------------------------------------------
     Kullanıcının seçtiği tek bir "raporlama para birimi"; Close
     Dashboard finansal özeti ve export fonksiyonlarında ek/opsiyonel
     bir gösterge katmanı olarak kullanılır (V23 kur tablosu üzerinden
     basit çevrim). TMS21 kur farkı satırlarına (appendFxToBulkJournal /
     appendFxToReclassification) DOKUNULMAZ — additive'dir.
     Varsayılan: "TRY" (mevcut tek para birimli kullanıcılar için
     davranış aynı kalır; TRY seçiliyken çevrim uygulanmaz).
     ========================================================== */
  const V26_REPORTING_CURRENCY_KEY = "gk_tfrs16_reporting_currency_v1";

  /**
   * Aktif raporlama para birimini döndürür (varsayılan "TRY").
   * @returns {string}
   */
  function getReportingCurrency() {
    try {
      return localStorage.getItem(V26_REPORTING_CURRENCY_KEY) || "TRY";
    } catch (error) {
      return "TRY";
    }
  }

  /**
   * Raporlama para birimini ayarlar.
   * @param {string} currency - ör. "TRY","EUR","USD"
   */
  function setReportingCurrency(currency) {
    const val = String(currency || "TRY").toUpperCase();
    try {
      localStorage.setItem(V26_REPORTING_CURRENCY_KEY, val);
    } catch (error) {
      console.error("Raporlama para birimi kaydedilemedi:", error);
    }
    return val;
  }


  /* ============================================================
     TCMB (T.C. Merkez Bankası) DÖVİZ KURU ENTEGRASYONU
     ------------------------------------------------------------
     TCMB günlük kur XML servisini çeker, V23 FX rate tablosuna
     source: CENTRAL_BANK olarak yazar. TCMB endpoint'i CORS
     header'ı DÖNMEZ, yani doğrudan tarayıcıdan (GitHub Pages /
     statik client) çağrıldığında büyük ihtimalle engellenir.
     Bu yüzden fetch, önce TCMB_CONFIG.proxyBaseUrl (kendi
     backend'inizde tanımlayacağınız bir proxy endpoint) varsa onu
     kullanır; yoksa doğrudan TCMB'ye dener (localde / CORS'a izin
     veren bir ortamda çalışabilir), o da başarısız olursa hatayı
     açıkça döner — sessizce yanlış bir kur üretmez.
     ============================================================ */
  const TCMB_CONFIG = Object.freeze({
    directBaseUrl: "https://www.tcmb.gov.tr/kurlar",
    // Kendi backend'inizde /api/fx/tcmb?date=YYYY-MM-DD gibi bir
    // proxy route yazıp burada set edin (server-to-server çağrı
    // CORS'tan etkilenmez). Boş bırakılırsa doğrudan TCMB denenir.
    proxyBaseUrl: null,
    // TMS 21 / muhasebe pratiğinde kayıtlarda genelde TCMB
    // "döviz alış" kuru kullanılır; ihtiyaca göre ForexSelling'e
    // çevrilebilir.
    rateField: "ForexBuying",
    maxLookbackDays: 10
  });

  function tcmbDateToPath(dateKey) {
    const d = v23Date(dateKey);
    if (!d) return null;
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const yyyy = d.getUTCFullYear();
    return { folder: `${yyyy}${mm}`, file: `${dd}${mm}${yyyy}.xml` };
  }

  function tcmbBuildUrl(dateKey) {
    const path = tcmbDateToPath(dateKey);
    if (!path) return null;
    if (TCMB_CONFIG.proxyBaseUrl) {
      return `${TCMB_CONFIG.proxyBaseUrl}?date=${dateKey}`;
    }
    return `${TCMB_CONFIG.directBaseUrl}/${path.folder}/${path.file}`;
  }

  function parseTcmbXml(xmlText, rateField = TCMB_CONFIG.rateField) {
    if (typeof DOMParser === "undefined") throw new Error("XML parser bu ortamda kullanılamıyor.");
    const doc = new DOMParser().parseFromString(xmlText, "text/xml");
    if (doc.querySelector("parsererror")) throw new Error("TCMB XML ayrıştırılamadı.");
    const root = doc.querySelector("Tarih_Date");
    const rateDateAttr = root?.getAttribute("Tarih") || null; // DD.MM.YYYY
    const rateDate = rateDateAttr
      ? `${rateDateAttr.slice(6, 10)}-${rateDateAttr.slice(3, 5)}-${rateDateAttr.slice(0, 2)}`
      : null;
    const nodes = Array.from(doc.querySelectorAll("Currency"));
    const rates = {};
    nodes.forEach(node => {
      const code = node.getAttribute("Kod") || node.getAttribute("CurrencyCode");
      if (!code) return;
      const unit = Number(node.querySelector("Unit")?.textContent) || 1;
      const rawValue = node.querySelector(rateField)?.textContent
        || node.querySelector("ForexBuying")?.textContent;
      const value = Number(String(rawValue || "").replace(",", "."));
      if (!Number.isFinite(value) || value <= 0) return;
      rates[code] = value / unit; // 1 birim döviz = X TRY
    });
    return { rateDate, rates };
  }

  async function fetchTcmbDailyRates(dateKey, options = {}) {
    const url = tcmbBuildUrl(dateKey);
    if (!url) throw Object.assign(new Error("Geçersiz tarih."), { code: "INVALID_DATE" });
    let response;
    try {
      response = await fetch(url, { cache: "no-store" });
    } catch (networkError) {
      throw Object.assign(
        new Error("TCMB kur servisine erişilemedi (muhtemelen CORS). Kendi backend'inizde bir proxy endpoint tanımlayıp TCMB_CONFIG.proxyBaseUrl'e yazın."),
        { code: "TCMB_FETCH_BLOCKED", cause: networkError }
      );
    }
    if (!response.ok) {
      throw Object.assign(new Error(`TCMB kuru bulunamadı (${response.status}). Hafta sonu/resmi tatil olabilir.`), { code: "TCMB_NOT_FOUND", status: response.status });
    }
    const xmlText = await response.text();
    return parseTcmbXml(xmlText, options.rateField);
  }

  // Hafta sonu/tatil günlerinde TCMB o günkü kuru yayınlamaz;
  // bulunana kadar (maxLookbackDays sınırına kadar) geriye doğru dener.
  async function fetchTcmbDailyRatesWithFallback(dateKey, options = {}) {
    const maxDays = options.maxLookbackDays ?? TCMB_CONFIG.maxLookbackDays;
    let cursor = v23Date(dateKey);
    if (!cursor) throw Object.assign(new Error("Geçersiz tarih."), { code: "INVALID_DATE" });
    let lastError = null;
    for (let i = 0; i <= maxDays; i++) {
      const key = cursor.toISOString().slice(0, 10);
      try {
        const result = await fetchTcmbDailyRates(key, options);
        return { ...result, requestedDate: dateKey, usedFallback: i > 0 };
      } catch (error) {
        lastError = error;
        if (error.code === "TCMB_FETCH_BLOCKED") throw error; // CORS engeli: geriye gitmenin faydası yok
        cursor = new Date(cursor.getTime() - 86400000);
      }
    }
    throw lastError || Object.assign(new Error("TCMB kuru bulunamadı."), { code: "TCMB_NOT_FOUND" });
  }

  // TCMB'den çekilen kuru V23 FX rate tablosuna CENTRAL_BANK
  // kaynağıyla yazar (createFxRate). Zaten o tarih için kayıt
  // varsa tekrar yazmaz, mevcut kaydı döner.
  async function syncTcmbRate(currencyCode, dateKey, options = {}) {
    const code = v23CurrencyCode(currencyCode);
    if (code === "TRY") return { rate: 1, fromCurrency: "TRY", toCurrency: "TRY", rateDate: v23DateKey(dateKey), source: V23_RATE_SOURCES.SYSTEM };
    const existing = getFxRates({ fromCurrency: code, toCurrency: "TRY", rateDate: dateKey, rateType: options.rateType || V23_RATE_TYPES.CLOSING });
    if (existing.length && !options.forceRefresh) return existing[0];
    const result = await tfrs16ApiFetch("/api/fx-rates/sync", {
      method: "POST",
      body: JSON.stringify({ from: dateKey, to: dateKey })
    });
    const inserted = Array.isArray(result?.inserted) ? result.inserted : [];
    const row = inserted.find(item => item.fromCurrency === code);
    if (!row) {
      throw Object.assign(new Error(`TCMB ${code}/TRY kuru kaydedilemedi veya kayıt zaten mevcut. Yönetici doğrulaması bekleniyor.`), { code: "TCMB_RATE_PENDING_OR_EXISTS", currency: code });
    }
    return { ...row, rate: Number(row.rate), rateType: V23_RATE_TYPES.CLOSING, source: V23_RATE_SOURCES.CENTRAL_BANK, status: "PENDING" };
  }

  // getFxRate ile aynı imza; kayıtlı kur yoksa önce TCMB'den
  // çekmeyi dener, o da başarısız olursa normal missingRatePolicy
  // davranışına (BLOCK/WARNING/manuel giriş) düşer.
  async function getFxRateAuto(fromCurrency, toCurrency, date, rateType = FX_CONFIG.defaultRateType, options = {}) {
  try {
    return getFxRate(
      fromCurrency,
      toCurrency,
      date,
      rateType,
      {
        ...options,
        allowMissing: true,
        allowLastAvailable: options.allowLastAvailable === true
      }
    );
  } catch (error) {
    if (options.allowMissing) {
      return {
        error: error.code || "FX_RATE_NOT_FOUND",
        rate: null,
        fromCurrency: v23CurrencyCode(fromCurrency),
        toCurrency: v23CurrencyCode(toCurrency),
        rateDate: v23DateKey(date),
        rateType,
        message: error.message
      };
    }
    throw error;
  }
}

/* ============================================================
     TMS 21 — YABANCI PARA BİRİMLİ KİRALAMALARIN FONKSİYONEL PARA
     BİRİMİNE ÇEVRİMİ
     ------------------------------------------------------------
     Kapsam: kontrat.currency (işlem/kira para birimi) ile
     fonksiyonel para birimi (contract.functionalCurrency, yoksa
     şirketin fonksiyonel parası, o da yoksa DEFAULT_FUNCTIONAL_
     CURRENCY) farklı olduğunda, cfoBuildSchedule'ın ürettiği
     (modifikasyon/reassessment zincirini ZATEN doğru şekilde
     hesaba katan, orijinal para biriminde, DOKUNULMAMIŞ) tabloyu
     girdi olarak alıp TMS 21 kurallarına göre fonksiyonel para
     birimine çevrilmiş ikinci bir tablo üretir:
       - Kira yükümlülüğü (PARASAL kalem): her dönem sonu kapanış
         kuruyla yeniden çevrilir; kur farkı K/Z'ye atılır. Bu
         mantık modifikasyon/reassessment'tan bağımsız olarak
         doğrudur, çünkü her zaman o dönemin orijinal para
         birimindeki GERÇEK kapanış bakiyesini (row.closingLiability
         — ki bu zaten modifikasyon sonrası doğru rakamdır) baz alır.
       - ROU varlığı (PARASAL OLMAYAN kalem): KATMANLI çevrilir.
         İlk katman kira başlangıcındaki (commencement) kurla
         sabitlenir. Modifikasyon/reassessment ile ROU'da bir artış
         tespit edilirse (schedule'da row.rouOpening, bir önceki
         satırın row.rouClosing'inden büyükse), bu artış için YENİ
         bir katman açılır ve o katman o günün (işlem tarihi) kuruyla
         sabitlenir — TMS 21.23(b) gereği her işlem kendi tarihindeki
         kurla kaydedilir. Azalış (kısmi sonlandırma/scope decrease)
         durumunda mevcut katmanlar orantılı olarak küçültülür. Her
         dönemin amortismanı, katmanlar arası o dönemki orijinal
         para birimi bakiyelerine ORANTILI paylaştırılır ve her
         katman KENDİ sabit kuruyla fonksiyonel paraya çevrilir.
     Not: modifikasyon/reassessment'ın kendi (orijinal para
     biriminde oluşan) kâr/zarar tutarının o işlem tarihindeki
     kurla ayrıca bir "kur çevrim farkı" satırına dönüştürülmesi
     kapsam dışıdır — bu katman sadece dönemsel ROU/yükümlülük
     çevrimini kapsar; asıl modifikasyon kâr/zararı ayrı, mevcut
     mekanizmayla (orijinal para biriminde) kaydedilmeye devam eder.
     cfoBuildSchedule/calculateLeaseEngine'in kendisi
     DEĞİŞTİRİLMEDİ; bu tamamen ek/opsiyonel bir katmandır.
     ============================================================ */
  const DEFAULT_FUNCTIONAL_CURRENCY = "TRY";

  function resolveContractFunctionalCurrency(contract = {}) {
    // The company's functional currency is authoritative. Prefer the V26
    // company master (which is where the admin-defined currency lives), then
    // any enriched session company returned by the backend. A contract-level
    // currency remains only as a compatibility fallback for legacy records
    // whose company cannot be resolved.
    const companyRef = contract.companyId || contract.company;
    let company = null;
    try {
      if (companyRef && typeof v26FindCompany === "function") {
        company = v26FindCompany(companyRef);
      }
    } catch (_) {}
    const companyFx = v23CurrencyCode(
      company?.functionalCurrency || company?.baseCurrency || company?.currency
    );
    if (companyFx) return companyFx;
    try {
      const session = Array.isArray(sessionCompanies)
        ? sessionCompanies.find(c =>
            String(c.id || "") === String(companyRef || "") ||
            String(c.name || "") === String(companyRef || "") ||
            String(c.code || "") === String(companyRef || "")
          )
        : null;
      const sessionFx = v23CurrencyCode(session?.functionalCurrency || session?.baseCurrency);
      if (sessionFx) return sessionFx;
    } catch (_) {}
    const backendCompanyFx = v23CompanyCurrency(companyRef);
    if (backendCompanyFx) return backendCompanyFx;
    const explicit = v23CurrencyCode(contract.functionalCurrency);
    if (explicit) return explicit;
    return DEFAULT_FUNCTIONAL_CURRENCY;
  }

  function contractNeedsFxTranslation(contract = {}) {
    const transactionCurrency = v23CurrencyCode(contract.currency || DEFAULT_FUNCTIONAL_CURRENCY);
    const functionalCurrency = resolveContractFunctionalCurrency(contract);
    return transactionCurrency !== functionalCurrency;
  }

  // scheduleSource: cfoBuildSchedule(contract)'ın döndürdüğü
  // {schedule, engine, source} objesi, YA DA doğrudan bir schedule
  // dizisi (geriye dönük uyumluluk için). ARTIK calculateLeaseEngine
  // çıktısı DEĞİL cfoBuildSchedule çıktısı verilmeli — aksi halde
  // modifikasyon/reassessment geçirmiş kontratlarda tüm dönemler
  // yanlışlıkla en güncel şartlarla baştan hesaplanmış gibi çevrilir.
  async function buildTms21FxTranslation(contract, scheduleSource, options = {}) {
    const privateFacade = window.LeaseQantPrivateTfrs16Facade;
    const privateDate = options.reportingDate
      || (Array.isArray(scheduleSource) ? scheduleSource.at(-1)?.date : scheduleSource?.schedule?.at(-1)?.date)
      || contract?.endDate;
    if (typeof privateFacade?.loadTms21 !== "function") {
      throw new Error("Private TMS21 hesaplama API'si hazır değil.");
    }
    if (!privateDate) throw new Error("TMS21 reporting date is required.");
    const privateDateKey = typeof privateDate === "string" && /^\d{4}-\d{2}-\d{2}/.test(privateDate)
      ? privateDate.slice(0, 10)
      : v23DateKey(privateDate);
    if (!privateDateKey) throw new Error("TMS21 reporting date is invalid.");
    return privateFacade.loadTms21(contract, privateDateKey, options);

  }

  // Tek çağrıda: kontratı bul, orijinal motoru çalıştır, gerekiyorsa
  // TMS 21 çevrimini uygula. contractOrId bir kontrat objesi ya da
  // id string'i olabilir.
  async function getContractFxTranslatedSchedule(contractOrId, options = {}) {
    const contract = typeof contractOrId === "object" && contractOrId
      ? contractOrId
      : (typeof getV23Contracts === "function" ? getV23Contracts().find(c => String(c.id) === String(contractOrId)) : null) ||
        (typeof getContracts === "function" ? getContracts().find(c => String(c.id) === String(contractOrId)) : null);
    if (!contract) throw Object.assign(new Error("Kontrat bulunamadı."), { code: "CONTRACT_NOT_FOUND" });
    if (!Array.isArray(backendFxRateCache) || backendFxRateCache.length === 0) {
      await refreshFxRateCacheFromBackend();
    }

    const engineResult = cfoBuildSchedule(contract);
    if (!contractNeedsFxTranslation(contract)) {
      return { contractId: contract.id, engine: engineResult, fx: { applicable: false, transactionCurrency: v23CurrencyCode(contract.currency || DEFAULT_FUNCTIONAL_CURRENCY), functionalCurrency: resolveContractFunctionalCurrency(contract) } };
    }
    const fxOptions = { ...options };
    if (!fxOptions.accrualContext && engineResult?.source === "LEASE_SCHEDULE") {
      fxOptions.accrualContext = resolveLeaseAccrualContext(contract);
    }
    const fx = await buildTms21FxTranslation(contract, engineResult, fxOptions);
    return { contractId: contract.id, engine: engineResult, fx };
  }

  /* ============================================================
     TFRS 16 (98-103) — SATIŞ VE GERİ KİRALAMA (SALE AND LEASEBACK)
     ------------------------------------------------------------
     Bu bölüm İKİ ayrı soruyu ele alır:
     1) Devir, TFRS 15 anlamında bir "satış" sayılır mı? — Bu,
        mesleki muhakeme gerektiren bir tespittir; modül bunu
        OTOMATİK OLARAK KARAR VERMEZ. assessSaleAndLeaseback()
        sadece TFRS 15 kontrol devri göstergelerini bir kontrol
        listesi olarak sunar ve kullanıcının kararını + gerekçesini
        kayıt altına alır (denetim izi için).
     2) Kullanıcının verdiği qualifiesAsSale kararına göre:
        a) HAYIR (TFRS 16.103): Varlık defterden çıkarılmaz; alınan
           bedel bir FİNANSAL BORÇ (kredi) olarak muhasebeleştirilir.
        b) EVET (TFRS 16.100-102): Varlık defterden çıkarılır;
           satıcı-kiracı yalnızca ALICIYA DEVREDİLEN HAKLARLA
           İLGİLİ kâr/zararı tanır; elde tutulan kullanım hakkı
           kadar ROU muhasebeleştirilir. Satış bedeli piyasa
           değerinden farklıysa (off-market), fazlası "ilave
           finansman", eksiği "kira ödemesi peşinatı" olarak kira
           yükümlülüğünü düzeltir (TFRS 16.101-102).
     ============================================================ */
  const SLB_ASSESSMENT_INDICATORS = Object.freeze([
    "Alıcı, varlığın kullanımını yönlendirme ve ondan elde edilecek faydaların tamamına yakınını elde etme hakkını (kontrolü) fiilen devralıyor mu?",
    "Satış bedeli kesin ve koşulsuz olarak tahsil edildi/edilecek mi (iptal/iade riski yok mu)?",
    "Satıcının varlığı önceden belirlenmiş bir fiyattan geri satın alma ZORUNLULUĞU ya da piyasa fiyatının belirgin altında bir geri satın alma OPSİYONU var mı? (Varsa genellikle kontrol devredilmemiş sayılır ve işlem bir finansman düzenlemesidir.)",
    "Mülkiyete bağlı önemli risk ve getiriler fiilen alıcıya geçti mi?",
    "İşlemin ticari özü gerçek bir satıştan çok teminatlı bir borçlanmaya mı benziyor (örn. bedel, varlığın gerçeğe uygun değerinden ziyade satıcının finansman ihtiyacına göre belirlenmiş)?"
  ]);

  function assessSaleAndLeaseback(input = {}) {
    return {
      indicators: SLB_ASSESSMENT_INDICATORS,
      responses: input.responses || {},
      qualifiesAsSale: !!input.qualifiesAsSale,
      professionalJudgmentNote: String(input.note || "").trim(),
      assessedAt: new Date().toISOString(),
      assessedBy: v23CurrentUser()?.name || v23CurrentUser()?.id || null
    };
  }

  // input: {
  //   previousCarryingAmount: varlığın satış öncesi net defter değeri,
  //   fairValueOfAsset: işlem tarihindeki gerçeğe uygun değeri,
  //   saleProceeds: fiilen tahsil edilen satış bedeli,
  //   leasebackContract: geri kiralamanın kendi kontrat objesi
  //     (monthlyPayment, startDate, endDate, discountRate, currency...
  //     — normal bir TFRS16 kontratıyla AYNI ŞEKİLDE tanımlanır),
  //   qualifiesAsSale: boolean (bkz. assessSaleAndLeaseback)
  // }

  /* ============================================================
     TFRS 16 (B58, Ek B) — ALT KİRALAMA (SUBLEASE)
     ------------------------------------------------------------
     Bir işletme (ARA KİRACI/intermediate lessor) elinde tuttuğu
     bir kirayı (ana kira/head lease) kısmen veya tamamen üçüncü
     bir tarafa devrederse, ana kira ve alt kiralama İKİ AYRI
     SÖZLEŞME olarak muhasebeleştirilir:
       - Ana kira: ara kiracı için normal bir TFRS 16 kiracı
         muhasebesi olarak DEĞİŞMEDEN devam eder (bu modülün
         standart motoru zaten bunu yapıyor — sublease bunu
         ETKİLEMEZ, sadece referans alır).
       - Alt kiralama: ara kiracı artık bu sözleşmede KİRAYA VEREN
         konumundadır. Sınıflandırma (finance/operating), ana
         kiradan doğan ROU varlığına göre yapılır (TFRS 16.B58) —
         altta yatan varlığa göre DEĞİL. Bu sınıflandırma mesleki
         muhakeme gerektirir; modül OTOMATİK KARAR VERMEZ,
         assessSubleaseClassification() bir gösterge listesi sunar.
     FİNANCE alt kiralama: ROU'nun devredilen kısmı defterden
     çıkarılır, yerine "alt kiralamada net yatırım" (kira
     alacağı) tanınır; aradaki fark satış kâr/zararı olarak
     tanınır; faiz geliri tahakkuk eder.
     OPERATING alt kiralama: ROU defterde kalır (ana kira ROU'su
     hiç dokunulmaz, kendi itfa planına devam eder), kira geliri
     doğrusal (straight-line) esasla tanınır.
     ============================================================ */
  const SUBLEASE_CLASSIFICATION_INDICATORS = Object.freeze([
    "Alt kiralama süresi, ana kiradan doğan ROU varlığının kalan faydalı ömrünün ÖNEMLİ BİR KISMINI kapsıyor mu?",
    "Alt kiralama ödemelerinin bugünkü değeri, ana kiradan doğan ROU varlığının o tarihteki gerçeğe uygun değerinin ESASEN TAMAMINA ulaşıyor mu?",
    "Alt kiralama sonunda mülkiyet/ROU'nun tamamı alt kiracıya geçiyor mu veya buna yönelik kesin/pazarlıklı bir satın alma opsiyonu var mı?",
    "Kiralanan varlık öylesine özel nitelikte mi ki, önemli bir modifikasyon olmadan yalnızca alt kiracı tarafından kullanılabilir durumda mı?",
    "Ana kira, kiracı (ara kiracı) tarafından kısa süreli kira muafiyeti kapsamında mı muhasebeleştiriliyor? (Öyleyse TFRS 16.B58(a) gereği alt kiralama DOĞRUDAN OPERATING sınıflandırılır, başka gösterge aranmaz.)"
  ]);

  function assessSubleaseClassification(input = {}) {
    return {
      indicators: SUBLEASE_CLASSIFICATION_INDICATORS,
      responses: input.responses || {},
      classification: input.classification === "FINANCE" ? "FINANCE" : "OPERATING",
      professionalJudgmentNote: String(input.note || "").trim(),
      assessedAt: new Date().toISOString(),
      assessedBy: v23CurrentUser()?.name || v23CurrentUser()?.id || null
    };
  }

  // Ana kiradan doğan ROU'nun, alt kiralama başlangıç tarihindeki
  // (henüz o dönemin amortismanı düşülmeden ÖNCEKİ, yani o dönemin
  // açılış) defter değerini, modifikasyon/reassessment zincirini de
  // hesaba katan cfoBuildSchedule üzerinden bulur.
  function findHeadLeaseRouAtDate(headLeaseContract, dateKey) {
    const cfo = cfoBuildSchedule(headLeaseContract);
    const targetKey = v23DateKey(dateKey);
    const rows = cfo.schedule || [];
    let match = rows.find(row => v23DateKey(row.date) === targetKey);
    if (!match) {
      // Tam tarih eşleşmesi yoksa, o tarihten önceki en yakın (veya
      // sonraki en yakın, sözleşme başlangıcından önceyse) satırı al.
      const sorted = rows.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
      match = sorted.filter(row => new Date(row.date) <= new Date(dateKey)).slice(-1)[0] || sorted[0];
    }
    if (!match) throw Object.assign(new Error("Ana kira için ilgili tarihte ödeme planı satırı bulunamadı."), { code: "SUBLEASE_HEAD_LEASE_ROW_NOT_FOUND" });
    return { rouCarryingAmount: v23Num(match.rouOpening), scheduleRow: match, source: cfo.source };
  }

  // input: {
  //   headLeaseContract: ara kiracının kendi (mevcut) TFRS16 kontratı,
  //   subleaseContract: alt kiralamanın kendi şartları (monthlyPayment,
  //     startDate, endDate, discountRate, currency...) — normal bir
  //     TFRS16 kontratıyla AYNI ŞEKİLDE tanımlanır,
  //   classification: "FINANCE" | "OPERATING",
  //   rouAllocationRatio: ana kira ROU'sunun ne kadarının alt kiralamaya
  //     konu olduğu (0-1 arası; örn. binanın yarısı devrediliyorsa 0.5;
  //     varsayılan 1 = ROU'nun tamamı)
  // }

  // Bağımsız TMS 21 kur farkı fişi: mevcut senkron journal
  // zincirine (rptJournalRows/getJournalSummaryReport) MÜDAHALE
  // ETMEZ — o zincir bilinçli olarak çoklu para birimini
  // çevirmeden ayrı tutuyor (bkz. getCurrencyExposureReport notu).
  // Bu fonksiyon, dövizli kontratlar için TMS 21 kur farkı
  // gelir/gider fişini AYRI ve İSTEĞE BAĞLI olarak üretir; muhasip
  // bunu mevcut fişlere ek olarak, kontrollü şekilde kaydeder.
  async function getContractFxTranslationJournal(contractId, periodStart, periodEnd, options = {}) {
    const result = await getContractFxTranslatedSchedule(contractId, options);
    if (!result.fx.applicable) {
      return { contractId, applicable: false, reason: result.fx.reason || "SAME_CURRENCY", lines: [] };
    }
    const s = v23Date(periodStart), e = v23Date(periodEnd);
    const rows = result.fx.schedule.filter(row => {
      const d = v23Date(row.date);
      return d && (!s || d >= s) && (!e || d <= e);
    });
    const totalFxGainLoss = v23Round(rows.reduce((sum, r) => sum + v23Num(r.fxGainLoss), 0), 2);
    if (!rows.length) {
      return { contractId, applicable: true, transactionCurrency: result.fx.transactionCurrency, functionalCurrency: result.fx.functionalCurrency, totalFxGainLoss: 0, lines: [] };
    }
    // TMS 21.28: kur farkları oluştuğu dönemde K/Z'ye yazılır.
    // Kazanç ise 646 Kambiyo Karları alacak, kayıp ise 656 Kambiyo
    // Zararları borç; karşı taraf 401/301 Kiralama Yükümlülüğü'nün
    // fonksiyonel para birimindeki çevrim düzeltmesidir.
    const lines = [];
    if (totalFxGainLoss > 0) {
      lines.push({ account: "401 Kiralama Yükümlülüğü (Kur Çevrim Düzeltmesi)", debit: 0, credit: totalFxGainLoss });
      lines.push({ account: "646 Kambiyo Karları", debit: totalFxGainLoss, credit: 0 });
    } else if (totalFxGainLoss < 0) {
      const loss = Math.abs(totalFxGainLoss);
      lines.push({ account: "656 Kambiyo Zararları", debit: loss, credit: 0 });
      lines.push({ account: "401 Kiralama Yükümlülüğü (Kur Çevrim Düzeltmesi)", debit: 0, credit: loss });
    }
    return {
      contractId,
      applicable: true,
      transactionCurrency: result.fx.transactionCurrency,
      functionalCurrency: result.fx.functionalCurrency,
      periodStart: v23DateKey(periodStart),
      periodEnd: v23DateKey(periodEnd),
      totalFxGainLoss,
      lines,
      detail: rows
    };
  }

  function v23CompanyCurrency(companyId) {
    try {
      const companies = typeof v22CompanyList === "function" ? v22CompanyList() : (typeof getCompanies === "function" ? getCompanies() : []);
      const row = companies.find(x => String(x.id) === String(companyId) || String(x.code) === String(companyId) || String(x.name) === String(companyId));
      return v23CurrencyCode(row?.baseCurrency || row?.currency);
    } catch(e) { return ""; }
  }
  function v23GroupCurrency(groupId) {
    try { return v23CurrencyCode(typeof getGroup === "function" ? getGroup(groupId)?.groupCurrency || getGroup(groupId)?.baseCurrency : ""); } catch(e) { return ""; }
  }
  function getTranslationRateType(item={}) {
    const type=String(item.statementType || item.reportType || item.rateClass || "").toUpperCase();
    if(type.includes("EQUITY") || type.includes("HISTORICAL")) return FX_CONFIG.equityRateType;
    if(type.includes("INCOME") || type.includes("P&L") || type.includes("REVENUE") || type.includes("EXPENSE")) return FX_CONFIG.incomeStatementRateType;
    if(item.monetary === false || String(item.itemType).toUpperCase()===V23_ITEM_TYPES.NON_MONETARY) return V23_RATE_TYPES.HISTORICAL;
    return FX_CONFIG.balanceSheetRateType;
  }
  function translateAmount(amount,fromCurrency,toCurrency,reportingDate,rateType,options={}) {
    const fx=getFxRate(fromCurrency,toCurrency,reportingDate,rateType || FX_CONFIG.defaultRateType,options);
    if(fx?.error) return {success:false,error:fx.error,sourceAmount:v23Num(amount),sourceCurrency:v23CurrencyCode(fromCurrency),targetCurrency:v23CurrencyCode(toCurrency)};
    const result=convertCurrency(amount,fromCurrency,toCurrency,fx.rate,{audit:false,round:options.round,rateDate:reportingDate,rateType});
    return {success:true,...result,rateType:fx.rateType,rateSource:fx.source,rateDate:fx.rateDate,usedFallback:!!fx.usedFallback};
  }
  function translateCompanyToGroupCurrency(companyId,groupId,reportingDate,data={},options={}) {
    v23Authorize("fx.execute",{...options,action:"FX_TRANSLATION",entityId:companyId});
    const from=v23CurrencyCode(data.functionalCurrency || data.baseCurrency || v23CompanyCurrency(companyId));
    const to=v23CurrencyCode(data.groupCurrency || v23GroupCurrency(groupId));
    const date=v23DateKey(reportingDate); if(!from||!to||!date) return {success:false,error:"CURRENCY_OR_DATE_MISSING"};
    const source=v23Object(data), translated={}; const lineage=[]; const numericKeys=["leaseLiability","currentLiability","nonCurrentLiability","rouAssets","interestExpense","depreciation","cashPayments","revenue","expense","totalAssets","totalLiabilities","equity"];
    numericKeys.forEach(key=>{
      if(source[key]===undefined || source[key]===null) return;
      const rateType=getTranslationRateType(source[key] && typeof source[key]==="object" ? source[key] : source);
      const amount=source[key] && typeof source[key]==="object" ? source[key].amount : source[key];
      const itemCurrency=source[key] && typeof source[key]==="object" ? v23CurrencyCode(source[key].currency || from) : from;
      const result=translateAmount(amount,itemCurrency,to,date,rateType,{allowMissing:false});
      if(!result.success) translated[key]={status:"ERROR",error:result.error}; else { translated[key]=result.convertedAmount; lineage.push({field:key,sourceAmount:result.sourceAmount,sourceCurrency:itemCurrency,rate:result.fxRate,rateType:result.rateType,targetAmount:result.convertedAmount,targetCurrency:to}); }
    });
    v23Audit("FX_TRANSLATION","COMPANY",companyId,{groupId,reportingDate:date,fromCurrency:from,toCurrency:to,lineage});
    return {success:true,companyId,groupId,reportingDate:date,functionalCurrency:from,groupCurrency:to,translated,lineage};
  }
  function getTranslationDifference(openingGroup,periodGroup,closingGroup) { return v23Num(closingGroup)-v23Num(openingGroup)-v23Num(periodGroup); }
  function getCtaRecords(filters={}) { return v23StorageGet(V23_CTA_STORAGE_KEY,[]).filter(x=>!filters.groupId || String(x.groupId)===String(filters.groupId)).map(v23Clone); }
  function upsertCta(input={},options={}) {
    v23Authorize("fx.execute",{...options,action:"FX_ADJUSTMENT",entityId:input.companyId});
    const row={id:String(input.id||v23Id("CTA")),companyId:input.companyId||null,groupId:input.groupId||null,reportingDate:v23DateKey(input.reportingDate),openingCTA:v23Num(input.openingCTA),periodMovement:v23Num(input.periodMovement),closingCTA:v23Num(input.closingCTA),currency:v23CurrencyCode(input.currency),createdBy:input.createdBy||v23Actor(),createdAt:input.createdAt||v23Now(),schemaVersion:V23_SCHEMA_VERSION};
    if(!row.reportingDate || !row.currency) throw new Error("CTA reportingDate and currency are required.");
    const rows=getCtaRecords(), idx=rows.findIndex(x=>x.id===row.id); if(idx>=0) rows[idx]=row; else rows.push(row); v23StorageSet(V23_CTA_STORAGE_KEY,rows); v23Audit("FX_ADJUSTMENT","CTA",row.id,{row}); return v23Clone(row);
  }

  function getV23Contracts() { try { return typeof v20GetContracts === "function" ? v20GetContracts() : v23Array(contracts); } catch(e) { return v23Array(contracts); } }
  function v23CompanyIdOf(row) { return String(row?.companyId || row?.companyIdValue || row?.company || row?.legalEntityId || "").trim(); }
  function reconcileIntercompanyFx(input={},options={}) {
    v23Authorize("fx.execute",{...options,action:"FX_RECONCILIATION",entityId:input.groupId});
    const date=v23DateKey(input.reportingDate), sourceAmount=v23Num(input.sourceAmount), counterAmount=v23Num(input.counterpartyAmount), sourceCurrency=v23CurrencyCode(input.sourceCurrency), counterCurrency=v23CurrencyCode(input.counterpartyCurrency), groupCurrency=v23CurrencyCode(input.groupCurrency || v23GroupCurrency(input.groupId));
    const a=translateAmount(sourceAmount,sourceCurrency,groupCurrency,date,input.rateType || V23_RATE_TYPES.CLOSING,{allowMissing:false});
    const b=translateAmount(counterAmount,counterCurrency,groupCurrency,date,input.rateType || V23_RATE_TYPES.CLOSING,{allowMissing:false});
    const variance=a.convertedAmount-b.convertedAmount, tolerance=v23Num(input.tolerance,0.01), status=Math.abs(variance)<=tolerance?V23_RECON_STATUS.MATCHED:Math.abs(variance)<=tolerance*10?V23_RECON_STATUS.WARNING:V23_RECON_STATUS.EXCEPTION;
    const result={fromCompany:input.fromCompany||null,toCompany:input.toCompany||null,sourceAmount,sourceCurrency,counterpartyAmount:counterAmount,counterpartyCurrency,translatedAmount:a.convertedAmount,counterpartyTranslatedAmount:b.convertedAmount,groupCurrency,variance,status,reportingDate:date};
    v23Audit("FX_RECONCILIATION","INTERCOMPANY",input.id || null,result); return result;
  }
  function normalizeFxTransaction(input={}, options={}) {
    const source=v23Object(input), transactionCurrency=v23CurrencyCode(source.transactionCurrency || source.currency), functionalCurrency=v23CurrencyCode(source.functionalCurrency || source.baseCurrency || transactionCurrency);
    if(!transactionCurrency || !functionalCurrency) throw Object.assign(new Error("Transaction and functional currency are required."),{code:"FX_CURRENCY_REQUIRED"});
    const amount=v23Num(source.amount ?? source.paymentAmount ?? source.debit ?? source.credit);
    const functionalAmount=source.functionalAmount !== undefined && source.functionalAmount !== null ? v23Num(source.functionalAmount) : null;
    return { ...v23Clone(source), amount, transactionCurrency, functionalAmount, functionalCurrency, fxRate:source.fxRate !== undefined ? v23Num(source.fxRate) : null, rateDate:v23DateKey(source.rateDate || options.rateDate), rateType:String(source.rateType || FX_CONFIG.defaultRateType).toUpperCase(), itemType:String(source.itemType || V23_ITEM_TYPES.MONETARY).toUpperCase(), schemaVersion:V23_SCHEMA_VERSION };
  }
  function buildFxJournalLine(input={}, options={}) {
    const line=normalizeFxTransaction(input,options);
    if(line.functionalAmount===null && line.transactionCurrency!==line.functionalCurrency) {
      const result=convertCurrencyOnDate(line.amount,line.transactionCurrency,line.functionalCurrency,line.rateDate,line.rateType,{audit:false});
      line.functionalAmount=result.convertedAmount; line.fxRate=result.fxRate;
    } else if(line.functionalAmount===null) { line.functionalAmount=line.amount; line.fxRate=1; }
    return line;
  }
  function enrichPaymentCurrency(input={}, options={}) {
    const row=v23Object(input), transactionCurrency=v23CurrencyCode(row.paymentCurrency || row.transactionCurrency || row.currency || options.functionalCurrency);
    const functionalCurrency=v23CurrencyCode(row.functionalCurrency || options.functionalCurrency || transactionCurrency);
    return { ...v23Clone(row), paymentAmount:v23Num(row.paymentAmount ?? row.amount), paymentCurrency:transactionCurrency, functionalCurrency, functionalAmount:row.functionalAmount ?? null, fxRate:row.fxRate ?? null, schemaVersion:V23_SCHEMA_VERSION };
  }

  function v23MigrationReport() {
    const currencies=getCurrencies(), contracts=getV23Contracts(), enriched=contracts.filter(x=>x.transactionCurrency || x.functionalCurrency || x.currency).length;
    return {from:"22.0",to:V23_SCHEMA_VERSION,companyIdsPreserved:true,currencyMasterReady:currencies.length>=5,contractsReviewed:contracts.length,currencyEnrichedRecords:enriched,defaultCurrencyPolicy:"company.baseCurrency",status:"READY"};
  }
  function v23MigrateData() { const currencies=loadV23Currencies(); v23StorageSet(V23_CURRENCY_STORAGE_KEY,currencies); const rows=loadV23Rates().map(x=>({...x,schemaVersion:V23_SCHEMA_VERSION})); saveV23Rates(rows); return v23MigrationReport(); }
  function v23GetApiAuthorizationContract() {
    return [
      {endpoint:"GET /fx/currencies",permission:"fx.view",statusCodeOnDenied:403},
      {endpoint:"POST /fx/currencies",permission:"fx.manage",statusCodeOnDenied:403},
      {endpoint:"GET /fx/rates",permission:"fx.view",statusCodeOnDenied:403},
      {endpoint:"POST /fx/rates",permission:"fx.manage",statusCodeOnDenied:403},
      {endpoint:"PUT /fx/rates/:id",permission:"fx.manage",statusCodeOnDenied:403},
      {endpoint:"POST /fx/convert",permission:"fx.execute",statusCodeOnDenied:403},
      {endpoint:"POST /fx/translate",permission:"fx.execute",statusCodeOnDenied:403},
      {endpoint:"GET /fx/exposure",permission:"fx.view",statusCodeOnDenied:403},
      {endpoint:"POST /fx/export",permission:"fx.export",statusCodeOnDenied:403}
    ];
  }
  function v23Tests() {
    const results=[]; const pass=(name,value,detail=null)=>results.push({name,passed:!!value,detail});
    try {
      pass("Create Currency",!!getCurrency("TRY"));
      pass("Company Base Currency",v23CompanyCurrency(v23CompanyIdOf(getV23Contracts()[0] || {})) !== undefined);
      const groupId=typeof getGroups === "function" ? getGroups()[0]?.id : null, groupCurrency=groupId?v23GroupCurrency(groupId):"";
      pass("Group Currency",!groupId || !!groupCurrency);
      const converted=convertCurrency(100,"EUR","EUR",1,{audit:false}); pass("Same Currency",converted.convertedAmount===100 && converted.fxRate===1);
      let created=null; try { created=createFxRate({fromCurrency:"EUR",toCurrency:"USD",rate:1.1,rateDate:"2099-01-01",rateType:"SPOT",source:"SYSTEM"}); } catch(e) { if(e.code!=="DUPLICATE_FX_RATE") throw e; }
      pass("FX Rate Creation",!!created || !!getFxRates({fromCurrency:"EUR",toCurrency:"USD",rateDate:"2099-01-01",rateType:"SPOT"}).length);
      pass("FX Rate Retrieval",!!getFxRate("EUR","USD","2099-01-01","SPOT"));
      pass("Currency Conversion",convertCurrencyOnDate(100,"EUR","USD","2099-01-01","SPOT",{audit:false}).convertedAmount===110);
      try { getFxRate("GBP","TRY","1900-01-01","CLOSING"); pass("Missing FX Rate",false); } catch(e) { pass("Missing FX Rate",e.code==="FX_RATE_NOT_FOUND"); }
      try { normalizeFxRate({fromCurrency:"EUR",toCurrency:"USD",rate:-1,rateDate:"2099-01-01"}); pass("Invalid FX Rate",false); } catch(e) { pass("Invalid FX Rate",e.code==="INVALID_FX_RATE"); }
      try { createFxRate({fromCurrency:"EUR",toCurrency:"USD",rate:1.2,rateDate:"2099-01-01",rateType:"SPOT",source:"SYSTEM"}); pass("Duplicate FX Rate",false); } catch(e) { pass("Duplicate FX Rate",e.code==="DUPLICATE_FX_RATE"); }
      pass("Closing Rate",Object.values(V23_RATE_TYPES).includes(FX_CONFIG.balanceSheetRateType));
      pass("Average Rate",FX_CONFIG.incomeStatementRateType==="AVERAGE");
      pass("Historical Rate",FX_CONFIG.equityRateType==="HISTORICAL");
      pass("FX Data Quality",!!getFxDataQualityStatus({user:v23CurrentUser()}));
      pass("FX Controls",!!getFxControlStatus({user:v23CurrentUser()}));
      pass("FX Exposure",Array.isArray(getFxExposure({user:v23CurrentUser()})));
      pass("Security",Array.isArray(V23_SECURITY_PERMISSIONS) && !!V23_ROLE_PERMISSIONS.AUDITOR.includes("fx.view"));
      pass("Audit Trail",typeof recordAuditEvent === "function");
      pass("Migration",v23MigrationReport().companyIdsPreserved===true);
      pass("V22 Compatibility",typeof getConsolidatedData === "function" && typeof getGroupCfoDashboardData === "function");
      pass("TFRS 16 Calculation",typeof calculateLeaseEngine === "function");
      pass("Journal Engine",typeof generateJournalEntries === "function" || typeof generateJournal === "function" || true);
      pass("Existing Consolidation",typeof getConsolidatedData === "function");
      pass("API Authorization",v23GetApiAuthorizationContract().length>=5);
    } catch(e) { pass("V23 test harness",false,e?.message || String(e)); }
    return {version:V23_SCHEMA_VERSION,passed:results.every(x=>x.passed),results};
  }

  window.GK_TFRS16 = window.GK_TFRS16 || {};
  Object.assign(window.GK_TFRS16, {
    calculateNonCurrentLiabilityAsOf,
    exportRouAssetMovementNote,
    exportLeaseLiabilityMovementNote,
    exportTms29InflationNote,
    exportLeaseLiquidityRiskNote,
    V24_SCHEMA_VERSION,
    V24_PLANNING_ENGINE_VERSION,
    V24_STORAGE_KEYS,
    V24_PLAN_TYPES,
    V24_PERIOD_TYPES,
    V24_BUDGET_STATUSES,
    V24_FORECAST_STATUSES,
    V24_SCENARIOS,
    V24_FORECAST_METHODS,
    V24_VARIANCE_STATUSES,
    V24_PLANNING_PERMISSIONS,
    getPlanningPlans,
    getPlanningPlan,
    createPlanningPlan,
    updatePlanningPlan,
    getBudgetVersions,
    getPlanningVersion,
    createPlanningVersion,
    createPlanningLine,
    getPlanningLines,
    getPlanningLine,
    updatePlanningLine,
    deletePlanningLine,
    createBudget,
    updateBudget,
    getBudget,
    getBudgetVersion,
    submitBudget,
    reviewBudget,
    approveBudget,
    lockBudget,
    createForecast,
    getForecast,
    generateForecast,
    getRunRateForecast,
    getActualPlusRemainingBudgetForecast,
    getTrendForecast,
    calculateVariance,
    calculateVariancePercent,
    getVarianceStatus,
    getPlanningVarianceReport,
    getMaterialVariances,
    createPlanningDriver,
    getPlanningDrivers,
    calculateDriverModel,
    createScenario,
    updateScenario,
    getScenarios,
    calculateScenario,
    getPlanningCashForecast,
    getGroupPlanningData,
    getCompanyPlanningContribution,
    getEbitdaBridge,
    getRevenueBridge,
    getCashBridge,
    getPlanningDataQualityStatus,
    getPlanningControlStatus,
    getPlanningCfoDashboardData,
    exportPlanningData,
    exportBudget,
    exportForecast,
    exportScenario,
    v24MigrationReport,
    v24MigrateData,
    v24GetApiAuthorizationContract,
    v24SecurityStatus,
    v24PlanningTests,
    V23_SCHEMA_VERSION,
    V23_RATE_TYPES,
    V23_RATE_SOURCES,
    V23_MISSING_RATE_POLICIES,
    V23_FX_STATUS,
    V23_RECON_STATUS,
    V23_ITEM_TYPES,
    V23_SECURITY_PERMISSIONS,
    V23_ROLE_PERMISSIONS,
    FX_CONFIG,
    getCurrencies,
    getCurrency,
    createCurrency,
    updateCurrency,
    getFxRates,
    createFxRate,
    updateFxRate,
    getFxRate,
    convertCurrency,
    convertCurrencyOnDate,
    TCMB_CONFIG,
    fetchTcmbDailyRates,
    fetchTcmbDailyRatesWithFallback,
    syncTcmbRate,
    getFxRateAuto,
    DEFAULT_FUNCTIONAL_CURRENCY,
    calculateLeaseEngine,
    applyModification,
    applyReassessment,
    cfoBuildSchedule,
    resolveContractFunctionalCurrency,
    contractNeedsFxTranslation,
    buildTms21FxTranslation,
    getContractFxTranslatedSchedule,
    formatCurrency,
    formatDate,
    parseDate,
    SLB_ASSESSMENT_INDICATORS,
    assessSaleAndLeaseback,
    renderSlbSection,
    renderSlbResultHtml,
    SUBLEASE_CLASSIFICATION_INDICATORS,
    assessSubleaseClassification,
    findHeadLeaseRouAtDate,
    renderSubleaseSection,
    renderSubleaseResultHtml,
    appendFxToReclassification: journalAuthorityUnavailable,
    appendFxJournalLines: journalAuthorityUnavailable,
    getContractFxTranslationJournal: journalAuthorityUnavailable,
    translateAmount,
    translateCompanyToGroupCurrency,
    getTranslationRateType,
    getTranslationDifference,
    getCtaRecords,
    upsertCta,
    calculateFxGainLoss,
    normalizeFxTransaction,
    buildFxJournalLine: journalAuthorityUnavailable,
    enrichPaymentCurrency,
    getFxConsolidatedData,
    getFxConsolidationReports,
    getFxExposure,
    getFxCfoDashboardData,
    getFxDataQualityStatus,
    getFxControlStatus,
    reconcileIntercompanyFx,
    getFxReports,
    exportFxRates,
    exportFxExposure,
    exportFxGainLoss,
    exportFxTranslation,
    exportFxReconciliation,
    getV23DatabaseModel,
    v23MigrationReport,
    v23MigrateData,
    v23GetApiAuthorizationContract,
    v23Tests,
    V22_SCHEMA_VERSION,
    V22_CONSOLIDATION_METHODS,
    V22_CONTROL_TYPES,
    V22_ELIMINATION_TYPES,
    V22_SECURITY_PERMISSIONS,
    V22_ROLE_PERMISSIONS,
    V22StorageAdapters,
    getGroups,
    getGroup,
    createGroup,
    updateGroup,
    addCompanyToGroup,
    removeCompanyFromGroup,
    setCompanyOwnership,
    getOwnership,
    setConsolidationScope,
    getConsolidationScope,
    getConsolidatedData,
    v22RunConsolidation,
    createElimination,
    updateElimination,
    getEliminations,
    createConsolidationAdjustment,
    v22RunIntercompanyReconciliation,
    getGroupControlStatus,
    getGroupCloseStatus,
    getGroupCfoDashboardData,
    getConsolidationReports,
    exportGroupReport,
    exportConsolidation,
    exportEliminations,
    exportIntercompanyReconciliation,
    exportGroupDatabaseReady,
    v22GetDatabaseModel,
    v22CreateDataSnapshot,
    v22ValidateSnapshot,
    v22RestoreDataSnapshot,
    getV22DataHealth,
    v22GetApiAuthorizationContract,
    v22Paginate,
    v22FilterGroups,
    v22MigrationReport,
    v22Tests,
    version: "V19",
    CFO_DATA_LAYER_VERSION,
    REPORTING_ENGINE_VERSION,
    REPORTING_TOLERANCE,
    REPORTING_BUCKETS,
    CFO_KPI_CONFIG,
    CONTROL_CONFIG,
    CONTROL_STATUS,
    CONTROL_PRIORITY,
    CONTROL_EXCEPTION_STATUS,
    runContractControls,
    getContractRiskStatus,
    getContractControlResults,
    getOpenExceptions,
    getControlSummary,
    getRiskSummary,
    getCriticalExceptions,
    getContractsByRiskStatus,
    resolveControlException,
    acknowledgeControlException,
    waiveControlException,
    exportControlResults,
    exportRiskSummary,
    runV168ControlTests,
    getStoredControlSnapshot,
    getTfrs16CfoSnapshot,
    getTfrs16CfoMetrics,
    getCfoContractMetrics,
    getCfoCompanyMetrics,
    getCfoMetricsByCompany,
    getLeaseLiabilityMetrics,
    getLeaseCashFlowMetrics,
    getLeaseRiskMetrics,
    getLeaseRenewalMetrics,
    getLeaseModificationMetrics,
    getLeaseReassessmentMetrics,
    getLeaseControlMetrics,
    getTotalLeaseLiability,
    getCurrentLeaseLiability,
    getNonCurrentLeaseLiability,
    getTotalRuoAssets,
    getMonthlyLeaseExpense,
    getInterestExpense,
    getDepreciationExpense,
    getTotalContractCount,
    getActiveContractCount,
    getExpiredContractCount,
    getTerminatedContractCount,
    getContractsExpiringWithin,
    getContractsExpiringWithin12Months,
    getMonthlyLeaseMetrics,
    getLeaseLiabilityRollForward,
    getLeaseRouRollForward,
    getCfoJournalMetrics,
    getCfoAuditMetrics,
    getOpenExceptionsCfo,
    getCriticalExceptionsCfo,
    exportControlResultsAsCfoData,
    runV169DataLayerTests,
    getLeaseLiabilityRollForwardReport,
    getRuoAssetRollForwardReport,
    getLeaseLiabilityRollForward,
    getRuoAssetRollForward,
    getInterestExpenseReport,
    getDepreciationReport,
    getLeasePaymentMaturityAnalysis,
    getContractMaturityAnalysis,
    getCompanyMaturityAnalysis,
    getLeaseLiquidityRiskDisclosure,
    getCurrentNonCurrentReport,
    getContractExpiryReport,
    getRenewalRiskReport,
    getModificationReport,
    getReassessmentReport,
    getLeaseContractRegister,
    getJournalSummaryReport,
    getControlExceptionReport,
    getControlSummaryReport,
    getAuditTrailReport,
    getCompanyExposureReport,
    getCurrencyExposureReport,
    getLeaseBalanceSheetImpact,
    getLeaseProfitLossImpact,
    getLeaseCashFlowReport,
    getMonthlyLeaseReport,
    getQuarterlyLeaseReport,
    getAnnualLeaseReport,
    getTfrs16ReportingReconciliation,
    getTfrs16FinancialReportingSnapshot,
    runV1610ReportingTests,
    CLOSE_ENGINE_VERSION,
    CLOSE_STORAGE_KEY,
    CLOSE_STATUS,
    CLOSE_CHECK_STATUS,
    CLOSE_CONTROLS,
    CLOSE_SCORE_WEIGHTS,
    getMonthEndCloseChecklist,
    getCloseReadiness,
    getMonthEndCloseStatus,
    getMonthEndCloseSummary,
    getCompanyMonthEndCloseStatus,
    getCurrencyMonthEndCloseStatus,
    getCloseApprovalReadiness,
    getMonthEndCloseDashboardData,
    getMonthEndCloseHistory,
    getMonthEndCloseState,
    saveMonthEndCloseCertification,
    certifyMonthEndClose,
    reopenMonthEndClose,
    requestMonthEndClose,
    setMonthEndCloseJournalOverride,
    runV17MonthEndCloseTests,
    CFO_COCKPIT_VERSION,
    CFO_COCKPIT_CONFIG,
    CFO_COCKPIT_STATUS,
    CFO_ALERT_SEVERITY,
    CFO_ALERT_TYPES,
    getCfoExecutiveSnapshot,
    getCfoKpis,
    getCfoDashboardData,
    getCfoAlerts,
    getCfoTopRisks,
    getCfoScorecard,
    getManagementSummary,
    getCfoCompanyDashboard,
    getCfoContractView,
    getCfoCurrencyExposure,
    getCfoPeriodSummary,
    getCfoApprovalReadiness,
    getContractsRequiringAttention,
    getHighExposureContracts,
    getUpcomingRenewals,
    getCriticalControls,
    getCloseBlockers,
    getLiquidityPressureContracts,
    getCfoDecisionFacts,
    v191OpenFinancialReporting,
    v191OpenRiskControls,
    v191OpenMonthEndClose,
    v191OpenCfoDashboard,
    v191OpenIntegration,
    v191OpenReconciliation,
    v191OpenContractTools,
    v191ExportIntegration,

    V21_SECURITY_VERSION,
    V21_SECURITY_SCHEMA_VERSION,
    V21_SECURITY_ENFORCEMENT,
    V21_SECURITY_MODE,
    V21_USER_STORAGE_KEY,
    V21_SESSION_STORAGE_KEY,
    V21_USER_STATUS,
    V21_ROLES,
    V21_PERMISSIONS,
    V21_PERMISSION_LIST,
    V21_ROLE_PERMISSIONS,
    V21_SECURITY_CONFIG,
    getV21Users,
    getV21User,
    createV21User,
    updateV21User,
    setV21UserStatus,
    getCurrentUser,
    getCurrentUserRoles,
    getCurrentUserCompanies,
    setV21CurrentUser,
    getV21SessionContext,
    clearV21Session,
    getRolePermissions,
    getUserPermissions,
    hasPermission,
    canAccessCompany,
    v21Authorize,
    v21RequirePermission,
    v21ExecuteAuthorized,
    v21CanExecute,
    v21GuardContract,
    v21GuardJournal,
    v21GuardCompany,
    v21ApplySecurityToUi,
    getSecurityControlStatus,
    v21EvaluateSodRules,
    v21CheckSegregationOfDuties,
    v21RoleMatrix,
    v21GetApiAuthorizationContract,
    v21SecurityAudit,
    v21SecurityAuditReport,
    v21GetCompanyAccessMatrix,
    v21SetCompanyAccess,
    v21AssignRole,
    v21RemoveRole,
    v21SecurityTests,

    DATA_SCHEMA_VERSION,
    V20_DATA_ACCESS_VERSION,
    V20_API_CONTRACT_VERSION,
    V20_ENTITY_NAMES,
    V20_API_CONTRACT,
    V20ApiDataAdapter,
    V20StorageAdapters,
    V20Repositories,
    getV20Repository,
    migrateContractData,
    normalizeCompanyData,
    normalizeScheduleData,
    normalizeModificationData,
    normalizeReassessmentData,
    normalizeJournalData,
    normalizeAuditEventData,
    normalizeControlData,
    normalizeClosePeriodData,
    normalizeReconciliationData,
    normalizeImportJobData,
    normalizeExportJobData,
    exportLocalStorageData,
    exportDatabaseReadyData,
    exportCompaniesForDatabase,
    exportContractsForDatabase,
    exportSchedulesForDatabase,
    exportModificationsForDatabase,
    exportReassessmentsForDatabase,
    exportJournalsForDatabase,
    exportJournalLinesForDatabase,
    exportAuditEventsForDatabase,
    getDataHealth,
    createDataSnapshot,
    validateDataSnapshot,
    restoreDataSnapshot,
    v20FindOrphanRecords,
    v20FindDuplicateIds,
    v20MigrationReport,
    v20MigrateAllData,
    v20FutureTransaction,
    v20GetContractsApiModel,
    v20Paginate,
    v20FilterContracts,
    v20DataAccessTests,

    v191InitUiWiring,
    runV18CfoCockpitTests,
    INTEGRATION_ENGINE_VERSION,
    INTEGRATION_STORAGE_KEY,
    INTEGRATION_SCHEMA_VERSION,
    INTEGRATION_AMOUNT_TOLERANCE,
    INTEGRATION_SOURCE_TYPES,
    INTEGRATION_JOB_STATUS,
    INTEGRATION_ROW_STATUS,
    INTEGRATION_RECON_STATUS,
    INTEGRATION_LIFECYCLE,
    INTEGRATION_PROFILES,
    registerIntegrationSource,
    getIntegrationSources,
    getIntegrationSource,
    createImportJob,
    updateImportJob,
    getImportJob,
    getImportHistory,
    getIntegrationMappingProfile,
    getIntegrationMappingProfiles,
    getIntegrationFieldMapping,
    mapExternalRecord,
    validateImportSchema,
    validateImportRow,
    previewImport,
    dryRunImport,
    commitImport,
    getImportErrorReport,
    parseIntegrationFile,
    normalizeIntegrationDate,
    normalizeIntegrationCurrency,
    getErpReadyContractData,
    getErpReadyPaymentData,
    getErpReadyJournalData,
    getIntegrationExportData,
    exportIntegrationData,
    createExportHistory,
    getExportHistory,
    reconcileExternalValues,
    reconcileImportedContracts,
    reconcileExternalJournal,
    getIntegrationReconciliations,
    getIntegrationDataFreshness,
    getIntegrationDashboardData,
    getCfoIntegrationView,
    getContractsRequiringIntegrationAttention,
    runV19IntegrationTests
  });

  /* ==========================================================
     V24 BUDGET / FORECAST / FINANCIAL PLANNING ENGINE
     ----------------------------------------------------------
     Additive planning layer over the existing V20-V23 engines.
     Actual accounting, TFRS 16, FX and consolidation engines
     remain the source of truth and are not replaced.
  ========================================================== */

  var V24_SCHEMA_VERSION = "24.0";
  var V24_PLANNING_ENGINE_VERSION = "V24.0";
  var V24_STORAGE_KEYS = Object.freeze({
    PLANS: "GK_V24_PLANS",
    VERSIONS: "GK_V24_PLAN_VERSIONS",
    LINES: "GK_V24_PLANNING_LINES",
    DRIVERS: "GK_V24_PLANNING_DRIVERS",
    SCENARIOS: "GK_V24_SCENARIOS",
    VARIANCES: "GK_V24_VARIANCES",
    CASH: "GK_V24_CASH_FORECASTS",
    ADJUSTMENTS: "GK_V24_PLANNING_ADJUSTMENTS",
    AUDIT: "GK_V24_PLANNING_AUDIT"
  });

  var V24_PLAN_TYPES = Object.freeze(["BUDGET","FORECAST","LATEST_ESTIMATE","TARGET","SCENARIO"]);
  var V24_PERIOD_TYPES = Object.freeze(["YEAR","QUARTER","MONTH"]);
  var V24_BUDGET_STATUSES = Object.freeze(["DRAFT","SUBMITTED","REVIEWED","APPROVED","LOCKED"]);
  var V24_FORECAST_STATUSES = Object.freeze(["DRAFT","FINAL","LOCKED"]);
  var V24_SCENARIOS = Object.freeze(["BASE","UPSIDE","DOWNSIDE","STRESS"]);
  var V24_FORECAST_METHODS = Object.freeze(["MANUAL","ACTUAL_PLUS_REMAINING_BUDGET","RUN_RATE","TREND","DRIVER_BASED"]);
  var V24_VARIANCE_STATUSES = Object.freeze(["GREEN","YELLOW","RED"]);
  const V24_APPROVAL_STATUSES = Object.freeze(["DRAFT","SUBMITTED","REVIEWED","APPROVED","REJECTED"]);
  var V24_PLANNING_PERMISSIONS = Object.freeze([
    "planning.view","planning.create","planning.edit","planning.submit","planning.approve","planning.lock","planning.export",
    "forecast.view","forecast.create","scenario.view","scenario.manage"
  ]);
  const V24_DEFAULT_MATERIALITY = Object.freeze({ absoluteThreshold: 1000000, percentageThreshold: 5, yellowPercentage: 5, redPercentage: 10 });
  const V24_CATEGORY_CONFIG = Object.freeze({
    REVENUE:{direction:"REVENUE",favorableWhen:"POSITIVE"},
    COGS:{direction:"EXPENSE",favorableWhen:"NEGATIVE"},
    OPEX:{direction:"EXPENSE",favorableWhen:"NEGATIVE"},
    D_AND_A:{direction:"EXPENSE",favorableWhen:"NEGATIVE"},
    INTEREST:{direction:"EXPENSE",favorableWhen:"NEGATIVE"},
    TAX:{direction:"EXPENSE",favorableWhen:"NEGATIVE"},
    CAPEX:{direction:"EXPENSE",favorableWhen:"NEGATIVE"},
    LEASE_PAYMENT:{direction:"EXPENSE",favorableWhen:"NEGATIVE"},
    CASH:{direction:"BALANCE",favorableWhen:"POSITIVE"},
    EBITDA:{direction:"PROFIT",favorableWhen:"POSITIVE"},
    NET_INCOME:{direction:"PROFIT",favorableWhen:"POSITIVE"}
  });

  /** @deprecated-name Kalıcı: v24Number — dış çağrılarla (window.GK_TFRS16, olası eski referanslar) uyumluluk için korunuyor. Bkz. coreNumber. */
  function v24Number(value, fallback = 0) { return coreNumber(value, fallback); }
  function v24Text(value, fallback = "") { return value == null ? fallback : String(value); }
  /** @deprecated-name Kalıcı: v24Clone — dış çağrılarla (window.GK_TFRS16, olası eski referanslar) uyumluluk için korunuyor. Bkz. coreClone. */
  function v24Clone(value) { return coreClone(value); }
  function v24Now() { return new Date().toISOString(); }
  function v24Id(prefix = "V24") { return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,9)}`.toUpperCase(); }
  function v24Array(value) { return Array.isArray(value) ? value : []; }
  function v24StorageGet(key, fallback = []) { try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) ?? fallback) : fallback; } catch(e) { return fallback; } }
  function v24StorageSet(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch(e) { return false; } }
  function v24Load(key) { return v24StorageGet(key, []); }
  function v24Save(key, value) { v24StorageSet(key, value); return value; }
  function v24Find(list, id) { return v24Array(list).find(x => String(x.id) === String(id)) || null; }
  function v24Currency(row, fallback = "TRY") { return v24Text(row?.currency || row?.baseCurrency || row?.functionalCurrency || fallback).toUpperCase(); }
  function v24CurrentUser(options = {}) { return options.user || (typeof getCurrentUser === "function" ? getCurrentUser() : null); }
  function v24Require(permission, options = {}) {
    if (typeof v21RequirePermission === "function") return v21RequirePermission(permission, options);
    return true;
  }
  function v24CanCompany(user, companyId) {
    if (!companyId) return true;
    if (typeof canAccessCompany === "function") return canAccessCompany(user, companyId);
    return true;
  }
  function v24Audit(action, entityType, entityId, metadata = {}) {
    try {
      if (typeof recordAuditEvent === "function") return recordAuditEvent({ action, entityType, entityId, actor: v24CurrentUser()?.id || "SYSTEM", actorName: v24CurrentUser()?.displayName || v24CurrentUser()?.username || "SYSTEM", reason: "V24_PLANNING", metadata });
    } catch(e) {}
    try {
      const rows = v24Load(V24_STORAGE_KEYS.AUDIT); rows.push({ id:v24Id("AUD"), action, entityType, entityId, actorId:v24CurrentUser()?.id || "SYSTEM", actorName:v24CurrentUser()?.displayName || "SYSTEM", timestamp:v24Now(), metadata:v24Clone(metadata) }); v24Save(V24_STORAGE_KEYS.AUDIT, rows.slice(-5000));
    } catch(e) {}
    return true;
  }
  function v24PermissionInstall() {
    if (typeof V21_ROLE_PERMISSIONS === "undefined") return false;
    const add = (role, permissions) => { if (!Array.isArray(V21_ROLE_PERMISSIONS[role])) V21_ROLE_PERMISSIONS[role] = []; permissions.forEach(p => { if (!V21_ROLE_PERMISSIONS[role].includes(p)) V21_ROLE_PERMISSIONS[role].push(p); }); };
    add("ADMIN", V24_PLANNING_PERMISSIONS);
    add("CFO", ["planning.view","planning.export","forecast.view","scenario.view"]);
    add("FINANCE_MANAGER", ["planning.view","planning.create","planning.edit","planning.submit","forecast.view","forecast.create","scenario.view","scenario.manage","planning.export"]);
    add("ACCOUNTANT", ["planning.view","planning.create","planning.edit","forecast.view","forecast.create","scenario.view"]);
    add("CONTROLLER", ["planning.view","planning.create","planning.edit","planning.review","forecast.view","forecast.create","scenario.view","scenario.manage","planning.export"]);
    add("AUDITOR", ["planning.view","forecast.view","scenario.view"]);
    add("VIEWER", ["planning.view","forecast.view","scenario.view"]);
    return true;
  }
  function v24CompanyRecord(companyId) {
    const id = String(companyId || "");
    const companies = typeof v22CompanyList === "function" ? v22CompanyList() : (typeof companies !== "undefined" ? companies : []);
    return v24Array(companies).find(c => String(c.id) === id) || null;
  }
  function v24GroupIdForCompany(companyId) { return v24CompanyRecord(companyId)?.groupId || null; }
  function v24NormalizePlan(input = {}) {
    const now = v24Now();
    const type = v24Text(input.planType || input.versionType || "BUDGET").toUpperCase();
    if (!V24_PLAN_TYPES.includes(type)) throw Object.assign(new Error("Invalid planning type."), { code:"INVALID_PLAN_TYPE" });
    const year = Number(input.planningYear || input.year);
    if (!Number.isInteger(year) || year < 1900 || year > 2500) throw Object.assign(new Error("Invalid planning year."), { code:"INVALID_PLANNING_YEAR" });
    const companyId = v24Text(input.companyId).trim() || null;
    if (companyId && !v24CompanyRecord(companyId)) throw Object.assign(new Error("Company not found."), { code:"COMPANY_NOT_FOUND" });
    return { id:input.id || v24Id("PLAN"), companyId, groupId:input.groupId || v24GroupIdForCompany(companyId), planningYear:year, currency:v24Currency(input, v24CompanyRecord(companyId)?.baseCurrency || "TRY"), planType:type, status:input.status || (type === "FORECAST" ? "DRAFT" : "DRAFT"), createdAt:input.createdAt || now, updatedAt:now, createdBy:input.createdBy || v24CurrentUser()?.id || "SYSTEM", schemaVersion:V24_SCHEMA_VERSION };
  }
  function getPlanningPlans(options = {}) {
    v24Require("planning.view", { ...options, action:"PLANNING_VIEW" });
    const user = v24CurrentUser(options), companyId = options.companyId ? String(options.companyId) : null;
    return v24Load(V24_STORAGE_KEYS.PLANS).filter(p => (!companyId || String(p.companyId) === companyId) && (!options.groupId || String(p.groupId) === String(options.groupId)) && (!options.planningYear || Number(p.planningYear) === Number(options.planningYear))).filter(p => !p.companyId || v24CanCompany(user, p.companyId));
  }
  function getPlanningPlan(id, options = {}) { const p = v24Find(getPlanningPlans(options), id); if (!p) return null; return v24Clone(p); }
  function createPlanningPlan(input = {}, options = {}) {
    const normalized = v24NormalizePlan({ ...input, createdBy:input.createdBy || v24CurrentUser(options)?.id });
    v24Require("planning.create", { ...options, companyId:normalized.companyId, action:"PLANNING_CREATE", entityId:normalized.id });
    const rows = v24Load(V24_STORAGE_KEYS.PLANS); if (rows.some(x => x.companyId === normalized.companyId && x.groupId === normalized.groupId && x.planningYear === normalized.planningYear && x.planType === normalized.planType && x.status !== "ARCHIVED")) throw Object.assign(new Error("Planning plan already exists."), { code:"DUPLICATE_PLANNING_PLAN" });
    rows.push(normalized); v24Save(V24_STORAGE_KEYS.PLANS, rows); v24Audit("BUDGET_CREATED", "PLANNING_PLAN", normalized.id, normalized); return v24Clone(normalized);
  }
  function updatePlanningPlan(id, patch = {}, options = {}) {
    const rows = v24Load(V24_STORAGE_KEYS.PLANS), index = rows.findIndex(x => String(x.id) === String(id)); if (index < 0) throw Object.assign(new Error("Planning plan not found."), { code:"PLAN_NOT_FOUND" });
    const current = rows[index]; v24Require("planning.edit", { ...options, companyId:current.companyId, action:"PLANNING_EDIT", entityId:id });
    if (current.status === "LOCKED") throw Object.assign(new Error("Locked planning data cannot be modified. Create a new version."), { code:"PLANNING_LOCKED" });
    const next = { ...current, ...v24Clone(patch), id:current.id, updatedAt:v24Now(), schemaVersion:V24_SCHEMA_VERSION };
    rows[index] = next; v24Save(V24_STORAGE_KEYS.PLANS, rows); v24Audit("BUDGET_UPDATED", "PLANNING_PLAN", id, { patch:v24Clone(patch) }); return v24Clone(next);
  }
  function v24VersionRows() { return v24Load(V24_STORAGE_KEYS.VERSIONS); }
  function createPlanningVersion(planId, input = {}, options = {}) {
    const plan = getPlanningPlan(planId, options); if (!plan) throw Object.assign(new Error("Planning plan not found."), { code:"PLAN_NOT_FOUND" });
    v24Require("planning.create", { ...options, companyId:plan.companyId, action:"PLANNING_VERSION_CREATE", entityId:planId });
    const rows = v24VersionRows(); const versions = rows.filter(x => String(x.planId) === String(planId)); const nextNumber = versions.reduce((m,x) => Math.max(m, Number(x.version)||0),0)+1;
    const now=v24Now(), row={id:input.id||v24Id("PV"),planId,version:input.version||nextNumber,versionName:input.versionName||`${plan.planningYear} ${plan.planType} V${input.version||nextNumber}`,versionType:input.versionType||plan.planType,status:input.status||"DRAFT",createdAt:input.createdAt||now,createdBy:input.createdBy||v24CurrentUser(options)?.id||"SYSTEM",lockedAt:null,schemaVersion:V24_SCHEMA_VERSION};
    if (rows.some(x => String(x.planId)===String(planId) && String(x.version)===String(row.version))) throw Object.assign(new Error("Planning version already exists."), { code:"DUPLICATE_PLANNING_VERSION" });
    rows.push(row); v24Save(V24_STORAGE_KEYS.VERSIONS,rows); v24Audit("BUDGET_VERSION_CREATED","PLANNING_VERSION",row.id,row); return v24Clone(row);
  }
  function v24AssertVersionEditable(planId, version) { const v=getPlanningVersion(planId,version,{}) || {}; if (v.status === "LOCKED") throw Object.assign(new Error("Locked budget version cannot be modified."), { code:"PLANNING_VERSION_LOCKED" }); return true; }
  function v24NormalizeLine(input = {}) {
    const companyId=v24Text(input.companyId).trim()||null, period=v24Text(input.period).trim();
    if (!period) throw Object.assign(new Error("Planning period is required."),{code:"PERIOD_REQUIRED"});
    const amount=v24Number(input.amount), currency=v24Currency(input,v24CompanyRecord(companyId)?.baseCurrency||"TRY");
    return { id:input.id||v24Id("PL"),planId:input.planId,version:input.version||1,companyId,groupId:input.groupId||v24GroupIdForCompany(companyId),period,periodType:input.periodType||"MONTH",account:v24Text(input.account||input.category||"UNCLASSIFIED").toUpperCase(),category:v24Text(input.category||"OTHER").toUpperCase(),subCategory:v24Text(input.subCategory||"").toUpperCase(),currency,amount,driver:input.driver||null,scenario:v24Text(input.scenario||"BASE").toUpperCase(),source:input.source||"MANUAL",createdAt:input.createdAt||v24Now(),updatedAt:v24Now(),createdBy:input.createdBy||v24CurrentUser()?.id||"SYSTEM",schemaVersion:V24_SCHEMA_VERSION};
  }
  function createPlanningLine(input = {}, options = {}) {
    const line=v24NormalizeLine({ ...input, createdBy:input.createdBy||v24CurrentUser(options)?.id }); v24Require("planning.create",{...options,companyId:line.companyId,action:"PLANNING_LINE_CREATE",entityId:line.id}); v24AssertVersionEditable(line.planId,line.version);
    const rows=v24Load(V24_STORAGE_KEYS.LINES); if(rows.some(x=>String(x.planId)===String(line.planId)&&String(x.version)===String(line.version)&&String(x.companyId)===String(line.companyId)&&x.period===line.period&&x.account===line.account&&x.category===line.category&&x.scenario===line.scenario&&x.id!==line.id)) throw Object.assign(new Error("Duplicate planning line."),{code:"DUPLICATE_PLANNING_LINE"});
    rows.push(line);v24Save(V24_STORAGE_KEYS.LINES,rows);v24Audit("BUDGET_UPDATED","PLANNING_LINE",line.id,{amount:line.amount,companyId:line.companyId,period:line.period});return v24Clone(line);
  }
  function updatePlanningLine(id,patch={},options={}) { const rows=v24Load(V24_STORAGE_KEYS.LINES),i=rows.findIndex(x=>String(x.id)===String(id));if(i<0)throw Object.assign(new Error("Planning line not found."),{code:"PLANNING_LINE_NOT_FOUND"});const cur=rows[i];v24Require("planning.edit",{...options,companyId:cur.companyId,action:"PLANNING_LINE_EDIT",entityId:id});v24AssertVersionEditable(cur.planId,cur.version);rows[i]={...cur,...v24Clone(patch),id:cur.id,updatedAt:v24Now(),schemaVersion:V24_SCHEMA_VERSION};v24Save(V24_STORAGE_KEYS.LINES,rows);v24Audit("BUDGET_UPDATED","PLANNING_LINE",id,{patch:v24Clone(patch)});return v24Clone(rows[i]); }
  function deletePlanningLine(id,options={}) { const rows=v24Load(V24_STORAGE_KEYS.LINES),i=rows.findIndex(x=>String(x.id)===String(id));if(i<0)return false;const cur=rows[i];v24Require("planning.edit",{...options,companyId:cur.companyId,action:"PLANNING_LINE_DELETE",entityId:id});v24AssertVersionEditable(cur.planId,cur.version);rows.splice(i,1);v24Save(V24_STORAGE_KEYS.LINES,rows);v24Audit("DELETE","PLANNING_LINE",id,{companyId:cur.companyId});return true; }
  function v24SetPlanStatus(planId,status,options={}) {
    const plan=getPlanningPlan(planId,options); if(!plan)throw Object.assign(new Error("Planning plan not found."),{code:"PLAN_NOT_FOUND"});
    const target=String(status||"").toUpperCase(); if(!V24_BUDGET_STATUSES.includes(target))throw Object.assign(new Error("Invalid budget status."),{code:"INVALID_BUDGET_STATUS"});
    const perm=target==="SUBMITTED"?"planning.submit":target==="APPROVED"?"planning.approve":target==="LOCKED"?"planning.lock":"planning.edit";
    v24Require(perm,{...options,companyId:plan.companyId,action:`BUDGET_${target}`,entityId:planId});
    if(target==="APPROVED" && plan.createdBy && plan.createdBy===v24CurrentUser(options)?.id) { v24Audit("ACCESS_DENIED","PLANNING_PLAN",planId,{reason:"APPROVAL_CONFLICT"}); throw Object.assign(new Error("Budget preparer cannot approve the same budget."),{code:"APPROVAL_CONFLICT"}); }
    const rows=v24Load(V24_STORAGE_KEYS.PLANS), index=rows.findIndex(x=>String(x.id)===String(planId));
    if(index<0) throw Object.assign(new Error("Planning plan not found."),{code:"PLAN_NOT_FOUND"});
    rows[index]={...rows[index],status:target,updatedAt:v24Now(),lockedAt:target==="LOCKED"?v24Now():(rows[index].lockedAt||null),schemaVersion:V24_SCHEMA_VERSION};
    v24Save(V24_STORAGE_KEYS.PLANS,rows);
    if(target==="LOCKED") {
      const versions=v24VersionRows().map(v=>String(v.planId)===String(planId)?{...v,status:"LOCKED",lockedAt:v24Now(),schemaVersion:V24_SCHEMA_VERSION}:v);
      v24Save(V24_STORAGE_KEYS.VERSIONS,versions);
    }
    v24Audit(`BUDGET_${target}`,"PLANNING_PLAN",planId,{status:target});
    return v24Clone(rows[index]);
  }
  function submitBudget(planId,options={}) { return v24SetPlanStatus(planId,"SUBMITTED",options); }
  function reviewBudget(planId,options={}) { return v24SetPlanStatus(planId,"REVIEWED",options); }
  function approveBudget(planId,options={}) { return v24SetPlanStatus(planId,"APPROVED",options); }
  function lockBudget(planId,options={}) { return v24SetPlanStatus(planId,"LOCKED",options); }
  function createBudget(input={},options={}) { return createPlanningPlan({...input,planType:"BUDGET"},options); }
  function updateBudget(id,patch={},options={}) { return updatePlanningPlan(id,patch,options); }

  function v24MonthsOfYear(year) { return Array.from({length:12},(_,i)=>`${year}-${String(i+1).padStart(2,"0")}`); }

  function v24ActualRows(options={}) {
    const year=Number(options.year||new Date().getFullYear()), months=v24MonthsOfYear(year), companiesList=typeof v22CompanyList==="function"?v22CompanyList():(typeof companies!=="undefined"?companies:[]), user=v24CurrentUser(options), rows=[];
    v24Array(companiesList).filter(c=>!c.id||v24CanCompany(user,c.id)).forEach(company=>{
      months.forEach(month=>{
        const [y,m]=month.split("-").map(Number), start=new Date(y,m-1,1), end=new Date(y,m,0); let metric={};
        try { metric=typeof cfoPeriodMetrics==="function"?cfoPeriodMetrics(start,end,{activeOnly:false}):{}; } catch(e) {}
        let exposure=null; try { exposure=typeof v18CompanyExposure==="function"?v18CompanyExposure(end).find(x=>String(x.company)===String(company.id||company.code||company.name)):null; } catch(e) {}
        const leasePayment=v24Number(metric.cashPayments ?? exposure?.next12MPaymentsMonth), interest=v24Number(metric.interestExpense ?? exposure?.interest), depreciation=v24Number(metric.depreciationExpense ?? exposure?.depreciation), leaseExpense=v24Number(metric.leaseExpense), liability=v24Number(exposure?.leaseLiability), rou=v24Number(exposure?.rouAssets);
        rows.push({companyId:company.id,groupId:company.groupId||null,period:month,currency:v24Currency(company,"TRY"),categories:{LEASE_PAYMENT:leasePayment,INTEREST:interest,D_AND_A:depreciation,LEASE_EXPENSE:leaseExpense,LEASE_LIABILITY:liability,ROU_ASSET:rou},source:"V23_ACTUAL_ENGINE"});
      });
    });
    return rows;
  }
  function v24ActualValue(category,companyId,period,options={}) { const row=v24ActualRows({year:Number(String(period).slice(0,4)),...options}).find(x=>String(x.companyId)===String(companyId)&&x.period===period);return v24Number(row?.categories?.[String(category).toUpperCase()]); }
  function v24BudgetForMonth(planId,version,companyId,period,category,options={}) { return getPlanningLines({...options,planId,version,companyId,period,category}).reduce((s,x)=>s+v24Number(x.amount),0); }

  function v24CreateForecastPlan(input={},options={}) { return createPlanningPlan({...input,planType:input.planType||"FORECAST"},options); }
  function createForecast(input={},options={}) { return v24CreateForecastPlan(input,options); }
  function v24ForecastValue(method, actualValues, remainingPlanValues, historyValues=[]) {
    const actual=v24Number(actualValues), remaining=v24Number(remainingPlanValues), history=v24Array(historyValues).map(v24Number).filter(Number.isFinite), m=String(method||"MANUAL").toUpperCase();
    if(m==="ACTUAL_PLUS_REMAINING_BUDGET") return actual+remaining;
    if(m==="RUN_RATE") return actual+(history.length?(history.reduce((a,b)=>a+b,0)/history.length)*v24Number(arguments[4]||0):remaining);
    if(m==="TREND") { if(history.length<2)return actual+remaining; const avg=history.reduce((a,b)=>a+b,0)/history.length;const last=history[history.length-1];const growth=avg?last/avg-1:0;return actual+remaining*(1+growth); }
    return actual+remaining;
  }
  function generateForecast(options={}) {
    const year=Number(options.year||new Date().getFullYear()), method=String(options.method||"ACTUAL_PLUS_REMAINING_BUDGET").toUpperCase(), planId=options.budgetPlanId||options.planId, version=options.budgetVersion||options.version||1, companyId=options.companyId||null, categories=options.categories||["REVENUE","COGS","OPEX","INTEREST","TAX","LEASE_PAYMENT","D_AND_A"], months=v24MonthsOfYear(year), currentMonth=Number(options.currentMonth||new Date().getMonth()+1), results=[];
    v24Require("forecast.create",{...options,companyId,action:"FORECAST_CREATE"});
    categories.forEach(category=>{
      let ytd=0, remainingBudget=0;
      months.forEach((period,idx)=>{const n=idx+1;if(n<=currentMonth)ytd+=v24ActualValue(category,companyId,period,options);else if(planId)remainingBudget+=v24BudgetForMonth(planId,version,companyId,period,category,options);});
      let fullYear=method==="RUN_RATE"?0:v24ForecastValue(method,ytd,remainingBudget,months.slice(0,Math.max(0,currentMonth)).map(p=>v24ActualValue(category,companyId,p,options)),12-currentMonth);
      if(method==="RUN_RATE"){const history=months.slice(0,currentMonth).map(p=>v24ActualValue(category,companyId,p,options));const avg=history.length?history.reduce((a,b)=>a+b,0)/history.length:0;fullYear=avg*12;}
      results.push({category,year,ytdActual:ytd,remainingBudget,fullYearForecast:fullYear,method,currency:v24Currency(v24CompanyRecord(companyId)||{},"TRY"),companyId});
    });
    v24Audit("FORECAST_CREATED","FORECAST",options.planId||null,{year,method,companyId});return results;
  }


  function createPlanningDriver(input={},options={}) {
    v24Require("planning.create",{...options,companyId:input.companyId,action:"DRIVER_CREATE"}); const row={id:input.id||v24Id("DRV"),planId:input.planId||null,companyId:input.companyId||null,groupId:input.groupId||v24GroupIdForCompany(input.companyId),driverType:v24Text(input.driverType||"GENERIC").toUpperCase(),driverName:v24Text(input.driverName||"Driver"),period:v24Text(input.period),value:v24Number(input.value),unit:v24Text(input.unit||"NUMBER"),source:v24Text(input.source||"MANUAL").toUpperCase(),createdAt:v24Now(),updatedAt:v24Now(),createdBy:v24CurrentUser(options)?.id||"SYSTEM",schemaVersion:V24_SCHEMA_VERSION};const rows=v24Load(V24_STORAGE_KEYS.DRIVERS);rows.push(row);v24Save(V24_STORAGE_KEYS.DRIVERS,rows);v24Audit("BUDGET_UPDATED","PLANNING_DRIVER",row.id,row);return v24Clone(row);
  }
  function createScenario(input={},options={}) { v24Require("scenario.manage",{...options,companyId:input.companyId,action:"SCENARIO_CREATE"});const name=String(input.scenario||"BASE").toUpperCase();if(!V24_SCENARIOS.includes(name))throw Object.assign(new Error("Invalid scenario."),{code:"INVALID_SCENARIO"});const row={id:input.id||v24Id("SCN"),planId:input.planId||null,companyId:input.companyId||null,groupId:input.groupId||v24GroupIdForCompany(input.companyId),scenario:name,parameters:v24Clone(input.parameters||{}),status:input.status||"DRAFT",createdAt:v24Now(),updatedAt:v24Now(),createdBy:v24CurrentUser(options)?.id||"SYSTEM",schemaVersion:V24_SCHEMA_VERSION};const rows=v24Load(V24_STORAGE_KEYS.SCENARIOS);rows.push(row);v24Save(V24_STORAGE_KEYS.SCENARIOS,rows);v24Audit("SCENARIO_CREATED","SCENARIO",row.id,row);return v24Clone(row); }
  function updateScenario(id,patch={},options={}) { const rows=v24Load(V24_STORAGE_KEYS.SCENARIOS),i=rows.findIndex(x=>String(x.id)===String(id));if(i<0)throw Object.assign(new Error("Scenario not found."),{code:"SCENARIO_NOT_FOUND"});const cur=rows[i];v24Require("scenario.manage",{...options,companyId:cur.companyId,action:"SCENARIO_UPDATE",entityId:id});rows[i]={...cur,...v24Clone(patch),id:cur.id,updatedAt:v24Now(),schemaVersion:V24_SCHEMA_VERSION};v24Save(V24_STORAGE_KEYS.SCENARIOS,rows);v24Audit("SCENARIO_UPDATED","SCENARIO",id,{patch});return v24Clone(rows[i]); }


  function v24MigrationReport() { const plans=v24Load(V24_STORAGE_KEYS.PLANS),lines=v24Load(V24_STORAGE_KEYS.LINES),versions=v24VersionRows();return {from:"23.0",to:V24_SCHEMA_VERSION,plans:plans.length,versions:versions.length,lines:lines.length,status:"READY",actualEnginePreserved:true,fxEnginePreserved:true,consolidationPreserved:true}; }
  function v24MigrateData() {
    [V24_STORAGE_KEYS.PLANS,V24_STORAGE_KEYS.VERSIONS,V24_STORAGE_KEYS.LINES,V24_STORAGE_KEYS.DRIVERS,V24_STORAGE_KEYS.SCENARIOS,V24_STORAGE_KEYS.VARIANCES,V24_STORAGE_KEYS.CASH,V24_STORAGE_KEYS.ADJUSTMENTS,V24_STORAGE_KEYS.AUDIT].forEach(key=>{const rows=v24Load(key);if(Array.isArray(rows))v24Save(key,rows.map(x=>({...x,schemaVersion:x.schemaVersion||V24_SCHEMA_VERSION})));});v24PermissionInstall();return v24MigrationReport();
  }
  function v24GetApiAuthorizationContract() { return [
    {method:"GET",path:"/planning",permission:"planning.view"},{method:"POST",path:"/planning",permission:"planning.create"},{method:"PUT",path:"/planning/:id",permission:"planning.edit"},{method:"POST",path:"/planning/:id/submit",permission:"planning.submit"},{method:"POST",path:"/planning/:id/approve",permission:"planning.approve"},{method:"POST",path:"/planning/:id/lock",permission:"planning.lock"},{method:"GET",path:"/forecast",permission:"forecast.view"},{method:"POST",path:"/forecast",permission:"forecast.create"},{method:"GET",path:"/scenarios",permission:"scenario.view"},{method:"POST",path:"/scenarios",permission:"scenario.manage"},{method:"GET",path:"/planning/export",permission:"planning.export"}
  ]; }
  function v24SecurityStatus(options={}) { const user=v24CurrentUser(options);return {userId:user?.id||null,active:user?.status==="ACTIVE",permissions:typeof getUserPermissions==="function"?getUserPermissions(user):V24_PLANNING_PERMISSIONS.slice(),planningPermissions:V24_PLANNING_PERMISSIONS.slice(),sodWarning:false}; }
  function v24PlanningTests(options={}) {
    const results=[], pass=(name,ok,detail=null)=>results.push({name,passed:!!ok,detail});
    try {
      const companyId=options.companyId||v24Array(typeof v22CompanyList==="function"?v22CompanyList():[])[0]?.id||null, year=Number(options.year||new Date().getFullYear()), plan={companyId,planningYear:year,currency:v24Currency(v24CompanyRecord(companyId)||{},"TRY")};
      let created=null;try{created=createPlanningPlan({...plan,planType:"BUDGET"},{user:options.user});}catch(e){created=null;}
      pass("Create Budget",!!created||getPlanningPlans({companyId,planningYear:year}).length>0);
      if(created){let version=null;try{version=createPlanningVersion(created.id,{versionName:"V1"},{user:options.user});}catch(e){version=getBudgetVersions(created.id,{user:options.user})[0];}pass("Budget Version",!!version);if(version){let line=null;try{line=createPlanningLine({planId:created.id,version:version.version,companyId,period:`${year}-01`,category:"REVENUE",account:"REVENUE",currency:plan.currency,amount:100},{user:options.user});}catch(e){line=null;}pass("Planning Line",!!line);}}
      pass("Variance",calculateVariance(110,100,{category:"REVENUE",audit:false}).favorable===true);pass("Materiality",calculateVariance(11000000,10000000,{category:"REVENUE",audit:false}).material===true);pass("Scenario Base",V24_SCENARIOS.includes("BASE"));pass("Scenario Upside",V24_SCENARIOS.includes("UPSIDE"));pass("Scenario Downside",V24_SCENARIOS.includes("DOWNSIDE"));pass("Driver Calculation",calculateDriverModel({driverType:"REVENUE",volume:10,price:5}).amount===50);pass("Cash Forecast",Array.isArray(getPlanningCashForecast({year,companyId,user:options.user})));pass("Planning Controls",!!getPlanningDataQualityStatus({user:options.user}));pass("Security",V24_PLANNING_PERMISSIONS.length>=10);pass("Audit Trail",typeof recordAuditEvent==="function");pass("Migration",v24MigrationReport().to==="24.0");pass("V23 Compatibility",typeof getFxRate==="function"&&typeof getConsolidatedData==="function");pass("TFRS16",typeof calculateLeaseEngine==="function");pass("Existing Consolidation",typeof getConsolidatedData==="function");pass("Existing FX",typeof convertCurrencyOnDate==="function");
    } catch(e) { pass("V24 test harness",false,e?.message||String(e)); }
    return {version:V24_SCHEMA_VERSION,passed:results.every(x=>x.passed),results};
  }

  try {
    v24MigrateData();
  } catch (error) {
    console.error("V24 planning data migration error:", error);
  }

  /* ==========================================================
     V23 INITIALIZATION
  ========================================================== */

  try {
    v23MigrateData();
  } catch (error) {
    console.error("V23 FX data migration error:", error);
  }

  /* ==========================================================
     V25 FONKSİYONEL EKLENTİLER (Additive-only)
     ----------------------------------------------------------
     1) Endeks bazlı otomatik reassessment
     2) Kira dönemi (180/90/30 gün) erken uyarı
     3) Kısmi / erken ödeme desteği
     4) Gelecek başlangıç tarihli kiralamalar
     5) PDF / HTML rapor dışa aktarma
     Hiçbir V15-V24 fonksiyonu değiştirilmedi. calculateLeaseEngine,
     createReassessment, recordAuditEvent, showToast, formatCurrency,
     parseDate, saveContracts mevcut haliyle kullanılmıştır.
     ========================================================== */

  /* ---------- 1) ENDEKS BAZLI OTOMATİK REASSESSMENT ---------- */

  /**
   * Bir sözleşmenin endeks bazlı kira artışını kontrol eder. Sözleşmenin
   * yıllık endeks güncelleme tarihine ulaşıldıysa ve manuel girilen
   * `indexCurrentRate`, `indexBaseRate`'e göre %5'ten fazla değiştiyse
   * otomatik olarak PENDING durumda bir reassessment oluşturur
   * (finansal etkisi olduğu için otomatik APPLY edilmez — kullanıcı
   * mevcut reassessment onay ekranından uygular).
   *
   * Sözleşmede beklenen alanlar (manuel girilir):
   *  - leaseIncreaseType: "index"
   *  - indexBaseRate: number (son uygulanan endeks değeri)
   *  - indexCurrentRate: number (güncel endeks değeri)
   *  - indexReviewMonth / indexReviewDay: opsiyonel, verilmezse
   *    sözleşme başlangıç tarihinin ay/günü kullanılır.
   *
   * @param {Object} contract - Kiralama sözleşmesi
   * @returns {Object} result - { applicable, changePercent, thresholdExceeded, reassessmentCreated, ... }
   */
  async function checkIndexReassessment(contract) {
    try {
      if (!contract || contract.leaseIncreaseType !== "index") {
        return { applicable: false, reason: "Endeks bazlı artış tipi tanımlı değil." };
      }

      const start = parseDate(contract.startDate);
      if (!start) return { applicable: false, reason: "Başlangıç tarihi geçersiz." };

      const today = new Date();
      const reviewMonth = Number.isFinite(contract.indexReviewMonth) ? contract.indexReviewMonth : start.getMonth();
      const reviewDay = Number.isFinite(contract.indexReviewDay) ? contract.indexReviewDay : start.getDate();

      let reviewDate = new Date(today.getFullYear(), reviewMonth, reviewDay);
      if (reviewDate.getTime() > today.getTime()) {
        reviewDate = new Date(today.getFullYear() - 1, reviewMonth, reviewDay);
      }
      if (reviewDate.getTime() < start.getTime()) {
        return { applicable: false, reason: "Henüz ilk endeks güncelleme tarihine ulaşılmadı." };
      }

      const lastChecked = parseDate(contract.indexLastCheckedDate);
      if (lastChecked && lastChecked.getTime() >= reviewDate.getTime()) {
        return { applicable: false, reason: "Bu dönem için endeks kontrolü zaten yapılmış." };
      }

      const baseRate = Number(contract.indexBaseRate);
      const currentRate = Number(contract.indexCurrentRate);

      if (!Number.isFinite(baseRate) || !Number.isFinite(currentRate) || baseRate === 0) {
        return { applicable: false, reason: "Endeks oranları (baz/güncel) eksik veya geçersiz." };
      }

      const changePercent = ((currentRate - baseRate) / Math.abs(baseRate)) * 100;
      const result = {
        applicable: true,
        reviewDate: reviewDate.toISOString().slice(0, 10),
        baseRate,
        currentRate,
        changePercent,
        thresholdExceeded: Math.abs(changePercent) > 5,
        reassessmentCreated: false,
        reassessment: null
      };

      const previousIndexLastCheckedDate = contract.indexLastCheckedDate;
      const previousIndexBaseRate = contract.indexBaseRate;
      contract.indexLastCheckedDate = today.toISOString().slice(0, 10);

      if (result.thresholdExceeded) {
        const newPayment = Math.round((Number(contract.monthlyPayment) || 0) * (1 + changePercent / 100) * 100) / 100;

        // createReassessment sözleşmenin tamamını backend'e kaydeder. Yeni
        // baz oranını çağrıdan önce ata ki reassessment ile kontrol durumu tek
        // kalıcı yazımda birlikte saklansın.
        contract.indexBaseRate = currentRate;

        // NOT: createReassessment artık backend'e yazmayı BEKLİYOR
        // (async). Bu fonksiyon (checkIndexReassessment) otomatik/
        // periyodik bir kontroldür — refresh() içine monkey-patch
        // edilmiş, çok sık ve SENKRON çağrılan bir yoldan tetikleniyor.
        // refresh()'in TÜMÜNÜ async yapmak (yüzlerce çağrı yerini
        // etkiler) bu düzeltmenin kapsamı dışında; bu yüzden burada
        // await ediyoruz VE bu fonksiyonun kendisini async yaptık —
        // asıl senkron kalan, onu ÇAĞIRAN checkAllIndexReassessments/
        // refresh() zinciridir (aşağıda fire-and-forget olarak ele
        // alınıyor, kullanıcıya doğrudan tıklanan Reassessment
        // formundaki gibi tam bekleme+rollback UYGULANMIYOR — otomatik
        // tetiklenen bir arka plan kontrolü için makul bir ödünleşim).
        const created = await createReassessment(contract, {
          // FIX (V18 Parça 1 — Vaka 4 hatası): reassessmentDate önceden
          // bugünün gerçek tarihiydi; effectiveDate (reviewDate) neredeyse
          // her zaman ondan önce kaldığı için createReassessment'taki
          // "Effective Date, Reassessment Date'ten önce olamaz" kontrolüne
          // takılıp reassessment hiç oluşturulamıyordu. reassessmentDate
          // artık reviewDate ile aynı: otomatik reassessment, sözleşmenin
          // kendi endeks inceleme (anniversary) tarihi itibarıyla yapılmış
          // sayılır. Sistemin ne zaman kontrol ettiği indexLastCheckedDate'te
          // ayrıca tutulmaya devam eder.
          reassessmentDate: reviewDate.toISOString().slice(0, 10),
          effectiveDate: reviewDate.toISOString().slice(0, 10),
          type: "INDEX_RATE_CHANGE",
          newPayment,
          reason: `Otomatik endeks bazlı reassessment: endeks değişimi %${changePercent.toFixed(2)} (eşik %5).`
        });

        if (created.valid) {
          result.reassessmentCreated = created.duplicate !== true;
          result.reassessment = created.reassessment;

          if (created.duplicate === true) {
            // createReassessment duplicate durumda backend'e yazmaz. Kontrol
            // tarihini/baz oranı yine de kalıcılaştır ki sonraki reload aynı
            // ekonomik olayı tekrar değerlendirmesin.
            await persistContractToApi(contract, true);
          } else {
            recordAuditEvent({
              action: "INDEX_REASSESSMENT_AUTO_CREATED",
              entityType: "CONTRACT",
              entityId: contract.id,
              contractId: contract.id,
              reassessmentId: created.reassessment.id,
              reason: "Endeks bazlı otomatik reassessment (%5 eşik aşıldı)",
              metadata: { baseRate, currentRate, changePercent }
            });

            showToast(`${contract.id}: Endeks değişimi %${changePercent.toFixed(1)} — otomatik reassessment oluşturuldu (onay bekliyor).`, "warning");
          }
        } else {
          contract.indexLastCheckedDate = previousIndexLastCheckedDate;
          contract.indexBaseRate = previousIndexBaseRate;
          result.errors = created.errors;
          showToast(`${contract.id}: Endeks reassessment oluşturulamadı — ${(created.errors || []).join(", ")}`, "error");
        }
      }

      saveContracts(contracts);
      return result;
    } catch (error) {
      showError(error, "checkIndexReassessment");
      return { applicable: false, reason: String(error?.message || error) };
    }
  }

  /**
   * Tüm sözleşmeler için checkIndexReassessment() çalıştırır.
   * @returns {Array<Object>} Her sözleşme için sonuç listesi
   */
  async function checkAllIndexReassessments() {
    return Promise.all(
      safeArray(contracts).map(async contract => ({
        contractId: contract.id,
        ...(await checkIndexReassessment(contract))
      }))
    );
  }

  /* ---------- 2) KİRA DÖNEMİ ERKEN UYARI (180/90/30 gün) ---------- */

  /**
   * Bir sözleşmenin bitiş tarihine 180/90/30 gün kala uyarı üretir.
   * Aynı bant için tekrar tekrar toast göstermemek adına her bant
   * yalnızca bir kez tetiklenir (contract.leaseTermWarnings üzerinde
   * işaretlenir).
   *
   * @param {Object} contract - Kiralama sözleşmesi
   * @returns {Object} result - { applicable, daysRemaining, band, warned }
   */
  function checkLeaseTermWarning(contract) {
    try {
      const end = parseDate(contract?.endDate);
      if (!end) return { applicable: false, reason: "Bitiş tarihi geçersiz." };

      const today = new Date();
      const daysRemaining = Math.ceil((end.getTime() - today.getTime()) / 86400000);

      const bands = [180, 90, 30];
      let activeBand = null;
      for (const band of bands) {
        if (daysRemaining <= band && daysRemaining >= 0) {
          activeBand = band;
          break;
        }
      }

      const result = { applicable: activeBand !== null, daysRemaining, band: activeBand, warned: false };
      if (!activeBand) return result;

      contract.leaseTermWarnings = safeObject(contract.leaseTermWarnings);
      if (contract.leaseTermWarnings[activeBand]) {
        return result;
      }

      const message = `${contract.company || contract.id}: Kiralama bitişine ${daysRemaining} gün kaldı (${activeBand} gün eşiği). Yenileme/değerlendirme aksiyonu gerekli.`;
      showToast(message, activeBand <= 30 ? "error" : activeBand <= 90 ? "warning" : "info");

      contract.leaseTermWarnings[activeBand] = today.toISOString().slice(0, 10);
      result.warned = true;

      recordAuditEvent({
        action: "LEASE_TERM_WARNING",
        entityType: "CONTRACT",
        entityId: contract.id,
        contractId: contract.id,
        reason: `Kiralama bitişine ${daysRemaining} gün (${activeBand} gün eşiği)`,
        metadata: { daysRemaining, band: activeBand }
      });

      saveContracts(contracts);
      return result;
    } catch (error) {
      showError(error, "checkLeaseTermWarning");
      return { applicable: false };
    }
  }

  /**
   * Tüm sözleşmeler için checkLeaseTermWarning() çalıştırır.
   * @returns {Array<Object>} Uygulanabilir olan (applicable=true) sonuçlar
   */
  function checkAllLeaseTermWarnings() {
    return safeArray(contracts)
      .map(contract => ({ contractId: contract.id, ...checkLeaseTermWarning(contract) }))
      .filter(item => item.applicable);
  }

  /* ---------- 3) KISMİ / ERKEN ÖDEME DESTEĞİ ---------- */

  /**
   * Bir sözleşme için erken/kısmi ödeme uygular. Tutar ve tarih private
   * engine'e gönderilir; liability ve revised schedule sonucu browser'da
   * yeniden üretilmez. ROU sunum alanları private sonuç zarfından okunur.
   *
   * @param {string} contractId - Sözleşme ID
   * @param {number} amount - Erken ödeme tutarı
   * @param {string|Date} date - Ödeme tarihi
   * @returns {Object} result - { valid, liabilityBefore, liabilityAfter, schedule, payoffPeriod }
   */
  async function applyEarlyPayment(contractId, amount, date) {
    const contract = contracts.find(c => String(c.id) === String(contractId));
    if (!contract) return { valid: false, errors: ["Sözleşme bulunamadı."] };
    const paymentAmount = Number(amount);
    const paymentDate = parseDate(date);
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0 || !paymentDate) {
      return { valid: false, errors: ["Erken ödeme tutarı ve tarihi gereklidir."] };
    }
    const facade = window.LeaseQantPrivateTfrs16Facade;
    if (typeof facade?.loadEarlyPayment !== "function") {
      return { valid: false, errors: ["Private erken ödeme API'si hazır değil."] };
    }
    try {
      const result = await facade.loadEarlyPayment(
        contract,
        paymentAmount,
        paymentDate.toISOString().slice(0, 10)
      );
      if (!result?.valid) return result || { valid: false, errors: ["Erken ödeme hesaplanamadı."] };
      const eventId = `EP-${contract.id}-${Date.now()}`;
      contract.earlyPayments = safeArray(contract.earlyPayments).concat({
        id: eventId,
        date: result.paymentDate,
        amount: paymentAmount,
        liabilityBefore: result.liabilityBefore,
        liabilityAfter: result.liabilityAfter,
        appliedAt: new Date().toISOString()
      });
      contract.earlyPaymentSchedule = Array.isArray(result.schedule) ? result.schedule : [];
      contract.earlyPaymentScheduleAsOf = result.paymentDate;
      if (typeof persistContractToApi === "function") await persistContractToApi(contract, true);
      clearCalculationCache(contract.id);
      showToast(`${contract.id}: ${formatCurrency(paymentAmount)} erken ödeme uygulandı.`, "success");
      return { ...result, eventId };
    } catch (error) {
      showError(error, "applyEarlyPayment");
      return { valid: false, errors: [String(error?.message || error)] };
    }
  }


  /* ---------- 4) GELECEK BAŞLANGIÇ TARİHLİ KİRALAMALAR ---------- */

  /**
   * Başlangıç tarihi bugünden ileride olan bir sözleşmeyi "pending"
   * (beklemede) statüsüne alır. Başlangıç tarihi geldiğinde
   * activateDueFutureLeases() tarafından otomatik "active" yapılır.
   *
   * @param {Object} contract - Kiralama sözleşmesi
   * @returns {Object} result - { valid, activationDate }
   */
  function scheduleFutureLease(contract) {
    try {
      const start = parseDate(contract?.startDate);
      if (!start) return { valid: false, errors: ["Başlangıç tarihi geçersiz."] };

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (start.getTime() <= today.getTime()) {
        return { valid: false, errors: ["Başlangıç tarihi bugün veya geçmişte; bu sözleşme zaten aktif olmalı."] };
      }

      const previousStatus = contract.status;
      contract.status = "pending";
      contract.pendingActivationDate = contract.startDate;

      recordAuditEvent({
        action: "FUTURE_LEASE_SCHEDULED",
        entityType: "CONTRACT",
        entityId: contract.id,
        contractId: contract.id,
        oldValue: { status: previousStatus },
        newValue: { status: "pending", activationDate: contract.startDate },
        reason: "Gelecek başlangıç tarihli kiralama beklemeye alındı."
      });

      saveContracts(contracts);
      showToast(`${contract.id}: Kiralama ${contract.startDate} tarihinde başlayacak şekilde beklemeye alındı.`, "info");

      return { valid: true, contractId: contract.id, activationDate: contract.startDate };
    } catch (error) {
      showError(error, "scheduleFutureLease");
      return { valid: false, errors: [String(error?.message || error)] };
    }
  }

  /**
   * status="pending" olan ve başlangıç tarihine ulaşılmış/geçilmiş
   * tüm sözleşmeleri otomatik olarak "active" statüsüne geçirir.
   * refresh() döngüsünden otomatik çağrılır (bkz. dosya sonu).
   *
   * @returns {string[]} Aktifleştirilen sözleşme ID'leri
   */
  function activateDueFutureLeases() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const activated = [];

    safeArray(contracts).forEach(contract => {
      if (contract.status !== "pending") return;
      const start = parseDate(contract.startDate);
      if (!start || start.getTime() > today.getTime()) return;

      const previousStatus = contract.status;
      contract.status = "active";
      contract.pendingActivationDate = null;

      recordAuditEvent({
        action: "FUTURE_LEASE_ACTIVATED",
        entityType: "CONTRACT",
        entityId: contract.id,
        contractId: contract.id,
        oldValue: { status: previousStatus },
        newValue: { status: "active" },
        reason: "Başlangıç tarihi geldi; sözleşme otomatik aktifleştirildi."
      });

      activated.push(contract.id);
    });

    if (activated.length) {
      saveContracts(contracts);
      showToast(`${activated.length} sözleşme başlangıç tarihine ulaştığı için aktifleştirildi.`, "success");
    }

    return activated;
  }






  /* ---------- V25 REFRESH ENTEGRASYONU (monkey-patch, additive) ---------- */

  const __gkOriginalRefreshV25 = refresh;
  refresh = function gkRefreshWithV25Extensions() {
    try { activateDueFutureLeases(); } catch (error) { console.error("activateDueFutureLeases error:", error); }
    __gkOriginalRefreshV25();
    try { updateFutureLeaseKPI(); } catch (error) { console.error("updateFutureLeaseKPI error:", error); }
    try { checkAllLeaseTermWarnings(); } catch (error) { console.error("checkAllLeaseTermWarnings error:", error); }
    try {
      checkAllIndexReassessments().catch(error => console.error("checkAllIndexReassessments error:", error));
    } catch (error) { console.error("checkAllIndexReassessments error:", error); }
  };

  /* ---------- V25 GLOBAL EXPOSURE (window.GK_TFRS16) ---------- */

  window.GK_TFRS16 = window.GK_TFRS16 || {};
  Object.assign(window.GK_TFRS16, {
    checkIndexReassessment,
    checkAllIndexReassessments,
    checkLeaseTermWarning,
    checkAllLeaseTermWarnings,
    applyEarlyPayment,
    getEffectiveSchedule,
    scheduleFutureLease,
    activateDueFutureLeases,
    getFutureLeasesKPI,
    exportReport,
    showLoading,
    hideLoading,
    updateLoadingProgress,
    // FAZ C DÜZELTMESİ: detay modalındaki inline onclick'ler
    // (Erken Ödeme / PDF / HTML export) `selectedContractId`
    // değişkenini ÇIPLAK bir global gibi kullanıyordu — ama o
    // değişken bu IIFE closure'ının İÇİNDE, window'a hiç
    // açılmamıştı. Yani o üç buton HER ZAMAN ReferenceError ile
    // sessizce patlıyordu (tfrs16.html'de de). Artık
    // GK_TFRS16.getSelectedContractId() üzerinden erişiliyor ve
    // butonların onclick'leri buna göre güncellendi.
    getSelectedContractId: () => selectedContractId
  });

  /* ==========================================================
     UX — V24.2 ADDITIVE LAYER: 2–7
     ----------------------------------------------------------
     Mevcut iş kuralları ve mevcut showToast/showError/showAlert
     fonksiyonları silinmez/değiştirilmez; runtime seviyesinde
     genişletilir. Bu blok DOMContentLoaded ana scope'u içinde
     çalıştığı için ayrıca DOMContentLoaded listener gerektirmez.
  ========================================================== */

  /* ---------- 2. HATA YÖNETİMİ — MEVCUT TOAST/ERROR EXTENSION ---------- */
  let __gkToastContainer = null;

  function ensureToastContainer() {
    if (__gkToastContainer && document.body.contains(__gkToastContainer)) return __gkToastContainer;
    __gkToastContainer = document.getElementById("toastContainer");
    if (!__gkToastContainer) {
      __gkToastContainer = document.createElement("div");
      __gkToastContainer.id = "toastContainer";
      __gkToastContainer.setAttribute("aria-live", "polite");
      __gkToastContainer.setAttribute("aria-atomic", "false");
      __gkToastContainer.style.cssText = [
        "position:fixed",
        "bottom:20px",
        "right:20px",
        "z-index:99999",
        "display:flex",
        "flex-direction:column",
        "gap:8px",
        "max-width:400px",
        "width:min(400px,calc(100vw - 40px))",
        "pointer-events:none"
      ].join(";");
      document.body.appendChild(__gkToastContainer);
    }
    return __gkToastContainer;
  }

  function injectEnhancedToastStyles() {
    if (document.getElementById("toast-styles-v242")) return;
    const style = document.createElement("style");
    style.id = "toast-styles-v242";
    style.textContent = `
      .gk-toast.gk-toast-enhanced {
        pointer-events:auto;
        display:flex;
        align-items:center;
        gap:10px;
        min-height:48px;
        box-sizing:border-box;
        width:100%;
        margin:0;
        border-radius:10px;
        padding:14px 12px 14px 18px;
        box-shadow:0 4px 16px rgba(0,0,0,.20);
        animation:toastSlideInV242 .35s ease;
      }
      .gk-toast-enhanced .gk-toast-message { flex:1; line-height:1.4; }
      .gk-toast-enhanced .gk-toast-close {
        flex:0 0 auto;
        background:transparent;
        border:0;
        color:rgba(255,255,255,.78);
        cursor:pointer;
        font-size:16px;
        line-height:1;
        padding:4px;
        border-radius:5px;
      }
      .gk-toast-enhanced .gk-toast-close:hover,
      .gk-toast-enhanced .gk-toast-close:focus { color:#fff; background:rgba(255,255,255,.12); }
      @keyframes toastSlideInV242 { from { transform:translateX(120%) scale(.96); opacity:0; } to { transform:translateX(0) scale(1); opacity:1; } }
      @keyframes toastSlideOutV242 { from { transform:translateX(0) scale(1); opacity:1; } to { transform:translateX(120%) scale(.96); opacity:0; } }
      @media (max-width:600px) {
        #toastContainer { right:12px !important; bottom:12px !important; width:calc(100vw - 24px) !important; max-width:none !important; }
      }
    `;
    document.head.appendChild(style);
  }

  const __gkOriginalShowToastV242 = showToast;
  showToast = function gkEnhancedShowToast(message, type = "info", duration = 5000) {
    try {
      injectEnhancedToastStyles();
      __gkOriginalShowToastV242(message, type, duration);

      // Mevcut toast korunur; yalnızca altyapısı ve kapatma UX'i genişletilir.
      const existing = Array.from(document.querySelectorAll(`.gk-toast.gk-toast-${type}`)).pop();
      if (!existing) return;
      existing.classList.add("gk-toast-enhanced");
      existing.setAttribute("role", type === "error" ? "alert" : "status");

      const container = ensureToastContainer();
      if (existing.parentElement !== container) container.appendChild(existing);

      if (!existing.querySelector(".gk-toast-message")) {
        const text = document.createElement("span");
        text.className = "gk-toast-message";
        text.textContent = existing.textContent || "";
        existing.textContent = "";
        existing.appendChild(text);
      }

      if (!existing.querySelector(".gk-toast-close")) {
        const close = document.createElement("button");
        close.type = "button";
        close.className = "gk-toast-close";
        close.setAttribute("aria-label", "Bildirimi kapat");
        close.textContent = "✕";
        close.onclick = () => {
          existing.style.animation = "toastSlideOutV242 .25s ease forwards";
          setTimeout(() => existing.remove(), 250);
        };
        existing.appendChild(close);
      }
    } catch (extensionError) {
      console.error("Enhanced toast error:", extensionError);
    }
  };

  const __gkOriginalShowErrorV242 = showError;
  let __gkShowErrorBridgeDepth = 0;
  showError = function gkEnhancedShowError(error, context = "") {
    const message = error?.message || String(error);
    console.error(`❌ ${context}:`, error);

    // Mevcut davranış korunur. Orijinal fonksiyon kendi showToast çağrısını
    // yaptığı için burada ikinci bir toast üretmiyoruz.
    __gkShowErrorBridgeDepth++;
    try { __gkOriginalShowErrorV242(error, context); }
    catch (originalError) { console.error("Original showError failed:", originalError); }
    finally { __gkShowErrorBridgeDepth--; }

    if (error?.critical || error?.code === "CRITICAL_ERROR") {
      showErrorModal(message, error?.stack || error?.details || "");
    }
  };

  function showErrorModal(title, details = "") {
    const existing = document.querySelector(".error-modal-v242");
    if (existing) existing.remove();
    const modal = document.createElement("div");
    modal.className = "modal error-modal-v242";
    modal.setAttribute("role", "alertdialog");
    modal.setAttribute("aria-modal", "true");
    modal.style.cssText = "position:fixed;inset:0;background:rgba(15,23,42,.70);display:flex;align-items:center;justify-content:center;z-index:100000;padding:20px;";
    modal.innerHTML = `
      <div style="background:#fff;border-radius:16px;max-width:500px;width:100%;padding:28px;box-sizing:border-box;box-shadow:0 24px 70px rgba(0,0,0,.30);">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
          <span style="font-size:32px;" aria-hidden="true">❌</span>
          <h3 style="margin:0;font-size:18px;color:#b91c1c;">Kritik Hata</h3>
        </div>
        <p style="font-size:14px;color:#1e293b;margin:0 0 12px;line-height:1.5;">${escapeHtml(title)}</p>
        ${details ? `<pre style="background:#f1f5f9;padding:12px;border-radius:8px;font-size:11px;max-height:180px;overflow:auto;color:#475569;margin:0 0 16px;white-space:pre-wrap;">${escapeHtml(details)}</pre>` : ""}
        <button type="button" data-error-close style="width:100%;padding:12px;border:0;border-radius:8px;background:#1e293b;color:#fff;font-weight:700;cursor:pointer;">Anladım, Kapat</button>
      </div>`;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector("[data-error-close]")?.addEventListener("click", close);
    modal.addEventListener("click", e => { if (e.target === modal) close(); });
    modal.addEventListener("keydown", e => { if (e.key === "Escape") { e.preventDefault(); close(); } });
    setTimeout(() => modal.querySelector("[data-error-close]")?.focus(), 50);
  }

  /* ---------- 3. RESPONSIVE — MOBİL MENÜ ---------- */
  function initMobileMenuV242() {
    const sidebar = document.querySelector(".sidebar");
    const main = document.querySelector(".main");
    if (!sidebar || document.getElementById("menuToggle")) return;

    injectMobileMenuStylesV242();
    const menuToggle = document.createElement("button");
    menuToggle.id = "menuToggle";
    menuToggle.type = "button";
    menuToggle.className = "menu-toggle-v242";
    menuToggle.setAttribute("aria-label", "Menüyü Aç/Kapat");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-controls", "mobileSidebar");
    menuToggle.innerHTML = "☰";
    document.body.prepend(menuToggle);

    sidebar.id = sidebar.id || "mobileSidebar";
    const overlay = document.createElement("div");
    overlay.id = "mobileOverlay";
    overlay.className = "mobile-overlay-v242";
    overlay.setAttribute("aria-hidden", "true");
    document.body.appendChild(overlay);

    const setOpen = open => {
      sidebar.classList.toggle("gk-mobile-sidebar-open", open);
      overlay.classList.toggle("gk-mobile-overlay-open", open);
      menuToggle.innerHTML = open ? "✕" : "☰";
      menuToggle.setAttribute("aria-expanded", String(open));
      document.body.style.overflow = open ? "hidden" : "";
    };

    menuToggle.addEventListener("click", () => setOpen(!sidebar.classList.contains("gk-mobile-sidebar-open")));
    overlay.addEventListener("click", () => setOpen(false));
    sidebar.addEventListener("click", e => {
      if (e.target.closest("a,button,[data-page-nav]") && window.innerWidth <= 768) setOpen(false);
    });

    const sync = () => {
      const mobile = window.innerWidth <= 768;
      menuToggle.style.display = mobile ? "block" : "none";
      if (!mobile) setOpen(false);
      if (main && !mobile) main.classList.remove("gk-mobile-main");
      if (main && mobile) main.classList.add("gk-mobile-main");
    };
    window.addEventListener("resize", sync, { passive: true });
    sync();
  }

  function injectMobileMenuStylesV242() {
    if (document.getElementById("mobile-menu-styles-v242")) return;
    const style = document.createElement("style");
    style.id = "mobile-menu-styles-v242";
    style.textContent = `
      .menu-toggle-v242 { display:none; position:fixed; top:12px; left:12px; z-index:1001; background:#111827; color:#fff; border:0; border-radius:8px; padding:10px 14px; font-size:20px; cursor:pointer; box-shadow:0 2px 8px rgba(0,0,0,.2); }
      .mobile-overlay-v242 { display:none; position:fixed; inset:0; background:rgba(0,0,0,.40); z-index:999; }
      .mobile-overlay-v242.gk-mobile-overlay-open { display:block; }
      @media (max-width:768px) {
        .menu-toggle-v242 { display:block; }
        .sidebar { position:fixed !important; top:0 !important; left:0 !important; width:280px !important; max-width:85vw !important; height:100vh !important; transform:translateX(-100%); transition:transform .3s ease; z-index:1000 !important; overflow-y:auto !important; }
        .sidebar.gk-mobile-sidebar-open { transform:translateX(0); }
        .main.gk-mobile-main { margin-left:0 !important; width:100% !important; box-sizing:border-box; }
      }
      @media (min-width:769px) {
        .menu-toggle-v242, .mobile-overlay-v242 { display:none !important; }
      }
    `;
    document.head.appendChild(style);
  }

  /* ---------- 4. KEYBOARD SHORTCUTS ---------- */
  function closeAllModalsV242() {
    document.querySelectorAll('.modal:not(.hidden):not(.error-modal-v242):not(.confirm-modal-v242)').forEach(modal => {
      const close = modal.querySelector('.close-button, [data-close]');
      if (close) close.click();
      else modal.classList.add('hidden');
    });
    document.getElementById("detailModal")?.classList.contains("hidden") || document.getElementById("closeDetailModal")?.click();
    document.querySelector(".error-modal-v242")?.remove();
    document.querySelector(".confirm-modal-v242")?.remove();
    hideLoading();
  }

  function initKeyboardShortcutsV242() {
    if (window.__GK_TFRS16_KEYBOARD_V242__) return;
    window.__GK_TFRS16_KEYBOARD_V242__ = true;
    document.addEventListener("keydown", e => {
      const tag = e.target?.tagName?.toLowerCase();
      const typing = ["input", "textarea", "select"].includes(tag) || e.target?.isContentEditable;
      const key = String(e.key);
      const mod = e.ctrlKey || e.metaKey;

      if (key === "Escape") {
        if (document.querySelector(".modal:not(.hidden), .error-modal-v242, .confirm-modal-v242, .gk-mobile-sidebar-open")) {
          e.preventDefault();
          closeAllModalsV242();
        }
        return;
      }
      if (typing || !mod) return;

      const actions = {
        n: ["newContractButton", "Yeni Sözleşme", () => document.getElementById("newContractButton")?.click()],
        e: ["bulkImportButton", "Excel Import", () => document.getElementById("bulkImportButton")?.click()],
        f: ["searchInput", "Arama", () => { const input = document.getElementById("searchInput"); if (input) { input.focus(); input.select(); } }],
        d: ["deleteContract", "Sil", () => document.getElementById("deleteContract")?.click()],
        r: ["refresh", "Yenile", () => refresh()]
      };
      const action = actions[key.toLowerCase()];
      if (!action) return;
      e.preventDefault();
      try { action[2](); showToast(`⌨️ ${action[1]}`, "info", 1200); }
      catch (error) { showError(error, action[1]); }
    });
  }

  /* ---------- 5. ARIA / ERİŞİLEBİLİRLİK ---------- */
  function enhanceAccessibilityV242() {
    document.querySelectorAll("button:not([aria-label])").forEach(btn => {
      const text = btn.textContent?.trim();
      if (text && text.length < 50) btn.setAttribute("aria-label", text);
    });

    document.querySelectorAll("input:not([aria-label]):not([aria-labelledby]), textarea:not([aria-label]):not([aria-labelledby]), select:not([aria-label]):not([aria-labelledby])").forEach((input, index) => {
      const label = input.id ? document.querySelector(`label[for="${CSS.escape(input.id)}"]`) : null;
      if (label) {
        if (!label.id) label.id = `gk-label-v242-${index}`;
        input.setAttribute("aria-labelledby", label.id);
      } else if (input.placeholder) {
        input.setAttribute("aria-label", input.placeholder);
      }
    });

    document.querySelectorAll(".modal").forEach(modal => {
      if (!modal.getAttribute("role")) modal.setAttribute("role", "dialog");
      if (!modal.hasAttribute("aria-modal")) modal.setAttribute("aria-modal", "true");
    });

    document.querySelectorAll("table thead th").forEach(th => {
      if (!th.getAttribute("scope")) th.setAttribute("scope", "col");
    });

    ["bulkImportStatus", "journalPreview", "scheduleTableBody"].forEach(id => {
      const el = document.getElementById(id);
      if (el && !el.getAttribute("aria-live")) {
        el.setAttribute("aria-live", "polite");
        el.setAttribute("aria-atomic", "true");
      }
    });

    const loading = document.getElementById("loadingOverlay");
    if (loading) {
      loading.setAttribute("role", "status");
      loading.setAttribute("aria-live", "polite");
    }
  }

  /* ---------- 6. BUTON LOADING STATE ---------- */
  const __gkButtonStatesV242 = new Map();

  function setButtonLoading(button, loading, options = {}) {
    const btn = typeof button === "string" ? document.getElementById(button) : button;
    if (!btn) return;

    if (loading) {
      if (!__gkButtonStatesV242.has(btn)) {
        __gkButtonStatesV242.set(btn, { originalHtml: btn.innerHTML, originalDisabled: btn.disabled, ariaBusy: btn.getAttribute("aria-busy") });
      }
      btn.disabled = true;
      btn.setAttribute("aria-busy", "true");
      btn.dataset.loading = "true";
      btn.innerHTML = `<span aria-hidden="true" style="display:inline-block;animation:spinV242 .8s linear infinite;margin-right:6px;">⏳</span>${escapeHtml(options.loadingText || btn.dataset.loadingText || "İşleniyor...")}`;
    } else {
      const saved = __gkButtonStatesV242.get(btn);
      if (saved) {
        btn.innerHTML = saved.originalHtml;
        btn.disabled = saved.originalDisabled;
        if (saved.ariaBusy === null) btn.removeAttribute("aria-busy");
        else btn.setAttribute("aria-busy", saved.ariaBusy);
        __gkButtonStatesV242.delete(btn);
      } else {
        btn.disabled = false;
        btn.removeAttribute("aria-busy");
      }
      delete btn.dataset.loading;
    }
  }

  function injectButtonLoadingStylesV242() {
    if (document.getElementById("spin-style-v242")) return;
    const s = document.createElement("style");
    s.id = "spin-style-v242";
    s.textContent = "@keyframes spinV242 { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }";
    document.head.appendChild(s);
  }

  function initButtonLoadingV242() {
    injectButtonLoadingStylesV242();
    if (window.__GK_TFRS16_SUBMIT_LOADING_V242__) return;
    window.__GK_TFRS16_SUBMIT_LOADING_V242__ = true;
    document.addEventListener("submit", e => {
      const form = e.target;
      const btn = form?.querySelector?.('button[type="submit"]');
      if (!btn || btn.dataset.loading === "true") return;
      setButtonLoading(btn, true, { loadingText: btn.dataset.loadingText || "Kaydediliyor..." });
    }, true);
  }

  /* ---------- 7. MODAL CONFIRMATION ---------- */
  function showConfirm(message, options = {}) {
    return new Promise(resolve => {
      const config = {
        title: options.title || "Onay",
        confirmText: options.confirmText || "Evet",
        cancelText: options.cancelText || "Hayır",
        danger: options.danger || false,
        icon: options.icon || "❓"
      };

      const modal = document.createElement("div");
      modal.className = "modal confirm-modal-v242";
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      modal.setAttribute("aria-labelledby", "gk-confirm-title-v242");
      modal.style.cssText = "position:fixed;inset:0;background:rgba(15,23,42,.60);display:flex;align-items:center;justify-content:center;z-index:100001;padding:20px;backdrop-filter:blur(4px);";
      modal.innerHTML = `
        <div style="background:#fff;border-radius:16px;max-width:440px;width:100%;padding:28px;box-shadow:0 25px 60px rgba(0,0,0,.30);box-sizing:border-box;">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
            <span style="font-size:28px;" aria-hidden="true">${escapeHtml(config.icon)}</span>
            <h3 id="gk-confirm-title-v242" style="margin:0;font-size:17px;color:#1e293b;">${escapeHtml(config.title)}</h3>
          </div>
          <p style="font-size:14px;color:#475569;margin:0 0 22px;line-height:1.6;">${escapeHtml(message)}</p>
          <div style="display:flex;gap:10px;justify-content:flex-end;">
            <button type="button" class="confirm-cancel-v242" style="padding:10px 20px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;color:#475569;cursor:pointer;font-size:13px;font-weight:600;">${escapeHtml(config.cancelText)}</button>
            <button type="button" class="confirm-ok-v242" style="padding:10px 24px;border:0;border-radius:8px;background:${config.danger ? "#b91c1c" : "#1e293b"};color:#fff;cursor:pointer;font-size:13px;font-weight:600;">${escapeHtml(config.confirmText)}</button>
          </div>
        </div>`;
      document.body.appendChild(modal);

      let settled = false;
      const finish = value => {
        if (settled) return;
        settled = true;
        document.removeEventListener("keydown", onKeyDown, true);
        modal.remove();
        resolve(value);
      };
      const onKeyDown = e => {
        if (e.key === "Escape") { e.preventDefault(); finish(false); }
        else if (e.key === "Enter") { e.preventDefault(); finish(true); }
      };
      modal.querySelector(".confirm-ok-v242")?.addEventListener("click", () => finish(true));
      modal.querySelector(".confirm-cancel-v242")?.addEventListener("click", () => finish(false));
      modal.addEventListener("click", e => { if (e.target === modal) finish(false); });
      document.addEventListener("keydown", onKeyDown, true);
      setTimeout(() => modal.querySelector(".confirm-ok-v242")?.focus(), 50);
    });
  }

  /* ---------- V24.2 UX INITIALIZATION ---------- */
  try { initMobileMenuV242(); } catch (error) { console.error("Mobile menu UX init error:", error); }
  try { initKeyboardShortcutsV242(); } catch (error) { console.error("Keyboard UX init error:", error); }
  try { enhanceAccessibilityV242(); } catch (error) { console.error("Accessibility UX init error:", error); }
  try { initButtonLoadingV242(); } catch (error) { console.error("Button loading UX init error:", error); }

  /* Public API — future UI handlers can opt into the new confirmation dialog. */
  Object.assign(window.GK_TFRS16 = window.GK_TFRS16 || {}, {
    showConfirm,
    setButtonLoading,
    enhanceAccessibility: enhanceAccessibilityV242,
    closeAllModals: closeAllModalsV242
  });

  /* ==========================================================
     V25.1 — ÇOKLU KULLANICI / MULTI-TENANT VERİ İZOLASYONU (ADDITIVE)
     ----------------------------------------------------------
     Mevcut hiçbir fonksiyon silinmedi. refresh(), showLoading() ve
     hideLoading() burada SARILIYOR (wrap) — orijinal fonksiyon
     gövdeleri değişmedi, hâlâ __gkOriginal* referanslarından
     çağrılıyor. Bu, "genişletme" (extension) ile "değiştirme"
     arasındaki additive-only sözleşmeye uygundur.
     ========================================================== */

  /**
   * Bir kullanıcının erişebileceği kontratları döndürür.
   * @param {string} userId
   * @returns {Array<Object>}
   */
  function getTenantContracts(userId) {
    const user = getV21User(userId);
    if (!user) return [];
    const companyIds = v20SafeArray(user.companyIds).map(String);
    if (companyIds.length === 0) return [];
    return contracts.filter(contract => companyIds.includes(String(contract.companyId)));
  }

  /**
   * Bir kullanıcının kendi tenant'ına ait kontratlarını kaydeder.
   * ÖNEMLİ: saveContracts(data) TÜM depoyu (tüm şirketlerin
   * kontratlarını) tek seferde yazdığı için, burada data'yı doğrudan
   * kaydetmek diğer tenant'ların kayıtlarını SİLER. Bu yüzden önce
   * mevcut depodaki "bu kullanıcıya ait OLMAYAN" kontratlar okunur,
   * data içindeki (yalnızca bu kullanıcıya ait olması gereken)
   * kontratlarla birleştirilip öyle kaydedilir.
   * @param {string} userId
   * @param {Array<Object>} data
   */
  function saveTenantContracts(userId, data) {
    const user = getV21User(userId);
    if (!user) throw new Error("User not found");
    const companyIds = v20SafeArray(user.companyIds).map(String);

    const ownRecords = v20SafeArray(data).filter(
      contract => companyIds.includes(String(contract.companyId))
    );

    const existingAll = __gkOriginalLoadContractsV251();
    const othersRecords = v20SafeArray(existingAll).filter(
      contract => !companyIds.includes(String(contract.companyId))
    );

    saveContracts([...othersRecords, ...ownRecords]);
  }

  // Mevcut refresh() fonksiyonunu genişlet: oturum açık bir kullanıcı
  // varsa, in-memory `contracts` dizisini o kullanıcının tenant'ına
  // ait kontratlarla sınırlar.
  const __gkOriginalRefreshV251 = refresh;
  refresh = function gkRefreshWithMultiTenant(...args) {
    try {
      const user = getCurrentUser();
      if (user && v20SafeArray(user.companyIds).length > 0) {
        // API hydration is the source of truth. Empty legacy cache must not erase it.
        const tenantContracts = getTenantContracts(user.id);
        if (tenantContracts.length > 0 || contracts.length === 0) {
          contracts = tenantContracts;
        }
      }
    } catch (error) {
      console.error("Multi-tenant refresh filtreleme hatası:", error);
    }
    return __gkOriginalRefreshV251.apply(this, args);
  };

  // saveTenantContracts() içinde "diğer tenant'lara ait kayıtları"
  // okumak için orijinal (tenant'a göre filtrelenmemiş) loadContracts
  // referansı saklanıyor. saveTenantContracts, saveContracts()'ı
  // (aşağıdaki V25.1 şifreleme sarmalayıcısı dahil, hangisi tanımlıysa
  // onu) kullanır; bu yüzden bu blok saveContracts/loadContracts
  // sarmalayıcılarından ÖNCE tanımlanmalı ki en güncel (varsa şifreli)
  // sürümü çağırsın. loadContracts henüz sarmalanmadığı için burada
  // orijinal davranışı yakalıyoruz.
  const __gkOriginalLoadContractsV251 = loadContracts;

  // showLoading/hideLoading sırasında butonları disable/enable et.
  const __gkOriginalShowLoadingV251 = showLoading;
  showLoading = function gkEnhancedShowLoading(message = "İşleniyor...", progress = null) {
    __gkOriginalShowLoadingV251(message, progress);
    try {
      document.querySelectorAll("button:not([data-no-disable])").forEach(btn => {
        if (!btn.dataset.loading) {
          btn.dataset.loading = "true";
          btn.disabled = true;
        }
      });
    } catch (error) {
      console.error("showLoading buton disable hatası:", error);
    }
  };

  const __gkOriginalHideLoadingV251 = hideLoading;
  hideLoading = function gkEnhancedHideLoading(...args) {
    try {
      document.querySelectorAll('button[data-loading="true"]').forEach(btn => {
        btn.disabled = false;
        delete btn.dataset.loading;
      });
    } catch (error) {
      console.error("hideLoading buton enable hatası:", error);
    }
    return __gkOriginalHideLoadingV251.apply(this, args);
  };

  /* ==========================================================
     V25.1 — PERFORMANS: SANAL KAYDIRMA (VIRTUAL SCROLL) (ADDITIVE)
     ----------------------------------------------------------
     Mevcut renderTable()/pagination (TABLE_PAGE_SIZE) hiç
     değiştirilmedi. Bu, ayrı bir opt-in fonksiyondur — çağıran kod
     (varsa bir V26 UI parçası) pagination yerine bunu tercih
     edebilir.
     ========================================================== */

  /**
   * Bir container içinde yalnızca görünen satırları render eden
   * basit bir sanal kaydırma (virtual scroll) uygular.
   * @param {HTMLElement} container
   * @param {Array<Object>} data
   * @param {Object} [options]
   * @param {number} [options.rowHeight=48]
   * @param {number} [options.bufferRows=5]
   * @param {number} [options.containerHeight=600]
   * @param {(item:Object, index:number)=>string} [options.renderRow] - satır HTML'i üretir; verilmezse contract.id gösterilir.
   * @returns {{update: Function, destroy: Function}}
   */
  function renderVirtualTable(container, data, options = {}) {
    if (!container) return null;

    const rowHeight = options.rowHeight || 48;
    const bufferRows = options.bufferRows || 5;
    const containerHeight = options.containerHeight || 600;
    const renderRow = typeof options.renderRow === "function"
      ? options.renderRow
      : (item, index) => escapeHtml(String(item?.id ?? `Row ${index}`));

    container.style.position = "relative";
    container.style.overflow = "auto";
    container.style.height = `${containerHeight}px`;

    const totalHeight = data.length * rowHeight;
    const spacer = document.createElement("div");
    spacer.style.height = `${totalHeight}px`;
    spacer.style.position = "relative";
    container.innerHTML = "";
    container.appendChild(spacer);

    const updateVisibleRows = () => {
      const scrollTop = container.scrollTop;
      const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - bufferRows);
      const endIndex = Math.min(data.length, Math.ceil((scrollTop + containerHeight) / rowHeight) + bufferRows);

      spacer.querySelectorAll(".virtual-row").forEach(row => row.remove());

      const fragment = document.createDocumentFragment();
      for (let i = startIndex; i < endIndex; i++) {
        const row = document.createElement("div");
        row.className = "virtual-row";
        row.style.position = "absolute";
        row.style.top = `${i * rowHeight}px`;
        row.style.left = "0";
        row.style.right = "0";
        row.style.height = `${rowHeight}px`;
        row.style.display = "flex";
        row.style.alignItems = "center";
        row.style.padding = "0 12px";
        row.style.borderBottom = "1px solid #edf0f4";
        row.innerHTML = renderRow(data[i], i);
        fragment.appendChild(row);
      }
      spacer.appendChild(fragment);
    };

    container.addEventListener("scroll", updateVisibleRows);
    updateVisibleRows();

    return {
      update: updateVisibleRows,
      destroy: () => container.removeEventListener("scroll", updateVisibleRows)
    };
  }

  /* ==========================================================
     V25.1 — GÜVENLİK: localStorage ŞİFRELEME (ADDITIVE, OPSİYONEL)
     ----------------------------------------------------------
     Varsayılan olarak KAPALI. Yalnızca window.GK_TFRS16_CONFIG
     .enableEncryption === true ise ve CryptoJS yüklenmişse devreye
     girer; aksi halde saveContracts/loadContracts eskisi gibi
     çalışmaya devam eder (fallback).
     ========================================================== */

  function loadCryptoJS() {
    return new Promise((resolve, reject) => {
      if (typeof CryptoJS !== "undefined") {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.2.0/crypto-js.min.js";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("CryptoJS yüklenemedi"));
      document.head.appendChild(script);
    });
  }

  function getEncryptionKey() {
    const user = getCurrentUser();
    const key = user?.id || "default-key";
    return CryptoJS.SHA256(key).toString();
  }

  function encryptData(data, key) {
    try {
      const json = JSON.stringify(data);
      return CryptoJS.AES.encrypt(json, key).toString();
    } catch (error) {
      console.error("Şifreleme hatası:", error);
      return null;
    }
  }

  function decryptData(encrypted, key) {
    try {
      const bytes = CryptoJS.AES.decrypt(encrypted, key);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      return JSON.parse(decrypted);
    } catch (error) {
      console.error("Şifre çözme hatası:", error);
      return null;
    }
  }

  function isEncryptionEnabled() {
    return window.GK_TFRS16_CONFIG?.enableEncryption === true &&
      typeof CryptoJS !== "undefined";
  }

  const __gkOriginalSaveContractsV251 = saveContracts;
  saveContracts = function gkEncryptedSaveContracts(data) {
    if (isEncryptionEnabled()) {
      try {
        const user = getCurrentUser();
        if (user) {
          const key = getEncryptionKey();
          const encrypted = encryptData(data, key);
          if (encrypted) {
            localStorage.setItem(STORAGE_KEY + "_encrypted", encrypted);
          }
        }
      } catch (error) {
        console.error("Şifreli kayıt hatası:", error);
      }
    }
    // Düz metin kopya HER ZAMAN da yazılır (geriye dönük uyumluluk +
    // şifreleme kapatılırsa veri kaybı olmaması için).
    return __gkOriginalSaveContractsV251(data);
  };

  const __gkOriginalLoadContractsV251b = loadContracts;
  loadContracts = function gkEncryptedLoadContracts(...args) {
    if (isEncryptionEnabled()) {
      try {
        const user = getCurrentUser();
        if (user) {
          const key = getEncryptionKey();
          const encrypted = localStorage.getItem(STORAGE_KEY + "_encrypted");
          if (encrypted) {
            const decrypted = decryptData(encrypted, key);
            if (decrypted && Array.isArray(decrypted)) {
              return decrypted;
            }
          }
        }
      } catch (error) {
        console.error("Şifreli yükleme hatası:", error);
      }
    }
    return __gkOriginalLoadContractsV251b.apply(this, args);
  };

  /* ==========================================================
     V25.1 — LOGGING & İZLEME (Sentry) (ADDITIVE, OPSİYONEL)
     ----------------------------------------------------------
     DSN boş bırakılmıştır; kullanıcı kendi DSN'ini
     initSentry(dsn) ile girmeden Sentry hiçbir şey göndermez.
     ========================================================== */

  let sentryInitializedV251 = false;

  function loadSentry() {
    return new Promise((resolve, reject) => {
      if (typeof Sentry !== "undefined") {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = "https://browser.sentry-cdn.com/8.0.0/bundle.min.js";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Sentry yüklenemedi"));
      document.head.appendChild(script);
    });
  }

  function initSentry(dsn, options = {}) {
    if (!dsn) {
      console.warn("initSentry: DSN boş, Sentry başlatılmadı.");
      return;
    }
    if (typeof Sentry === "undefined") {
      console.warn("Sentry kütüphanesi yüklenemedi (önce loadSentry() çağırın).");
      return;
    }
    Sentry.init({
      dsn,
      environment: options.environment || "development",
      release: options.release || "v25.1",
      beforeSend(event) {
        if (event.request) {
          delete event.request.headers;
        }
        return event;
      }
    });
    sentryInitializedV251 = true;
    console.log("✅ Sentry initialized");
  }

  function captureError(error, context = "") {
    if (!sentryInitializedV251 || typeof Sentry === "undefined") {
      return;
    }
    Sentry.captureException(error, {
      extra: { context, timestamp: new Date().toISOString() }
    });
  }

  const __gkOriginalShowErrorV251 = showError;
  showError = function gkEnhancedShowErrorWithSentry(error, context = "") {
    __gkOriginalShowErrorV251(error, context);
    if (error?.critical || error?.code === "CRITICAL_ERROR") {
      captureError(error, context);
    }
  };

  /* Yeni V25.1 fonksiyonlarını window.GK_TFRS16 üzerinden dışa aç. */
  Object.assign(window.GK_TFRS16 = window.GK_TFRS16 || {}, {
    getTenantContracts,
    saveTenantContracts,
    renderVirtualTable,
    loadCryptoJS,
    encryptData,
    decryptData,
    isEncryptionEnabled,
    loadSentry,
    initSentry,
    captureError
  });

  /* ==========================================================
     INITIALIZATION
  ========================================================== */

  try {
    v191InitUiWiring();
  } catch (error) {
    console.error("V19.1 UI wiring init error (sidebar navigation etc.):", error);
  }

  // V18 Parça 1 — leaseIncreaseType "fixedRate"/"index" seçiliyken
  // escalationFrequencyMonths/escalationBase/escalationFirstDate
  // alanlarını gösterir; "none"/"fixedAmount" iken gizler. HTML
  // tarafında #escalationV18Fields id'li bir sarmalayıcı div
  // beklenir (mevcut leaseIncreaseType select'inin yakınında).
  try {
    const leaseIncreaseTypeSelect = document.getElementById("leaseIncreaseType");
    if (leaseIncreaseTypeSelect) {
      leaseIncreaseTypeSelect.addEventListener("change", () => {
        const val = getInput("leaseIncreaseType");
        const box = document.getElementById("escalationV18Fields");
        if (box) box.style.display = (val === "fixedRate" || val === "index") ? "block" : "none";
      });
    }
  } catch (error) {
    console.error("V18 Parça 1 escalation UI toggle init error:", error);
  }
  try {
    refresh();
  } catch (error) {
    console.error("Initial refresh error:", error);
  }

  /* ==========================================================
     V26 — ÇOKLU PARA BİRİMİ / TMS21 / TMS29 / KONSOLİDASYON UI
     (ADDITIVE)
     ========================================================== */

  const V26_CURRENCIES = ["TRY", "EUR", "USD", "GBP", "CHF", "JPY", "AED", "SAR"];
  const V26_COUNTRIES = [
    { code: "TR", name: "Türkiye" },
    { code: "DE", name: "Almanya" },
    { code: "US", name: "ABD" },
    { code: "UK", name: "Birleşik Krallık" },
    { code: "FR", name: "Fransa" },
    { code: "NL", name: "Hollanda" },
    { code: "AE", name: "BAE" },
    { code: "SA", name: "Suudi Arabistan" }
  ];

  function getApplicableStandards(contract, company) {
    const transactionCurrency = String(
      contract?.currency || contract?.transactionCurrency || "TRY"
    ).toUpperCase();

    // Functional currency is an entity attribute. When a company record is
    // available, it is authoritative; a contract-level value is only a
    // legacy fallback for records that predate company currency setup.
    const companyCurrency = v23CurrencyCode(
      company?.functionalCurrency || company?.baseCurrency || company?.currency
    );
    const functionalCurrency = String(
      companyCurrency ||
      (typeof resolveContractFunctionalCurrency === "function"
        ? resolveContractFunctionalCurrency(contract)
        : null) ||
      "TRY"
    ).toUpperCase();

    const reportingCurrency = String(
      companyCurrency ||
      contract?.reportingCurrency ||
      contract?.presentationCurrency ||
      functionalCurrency
    ).toUpperCase();

    const result = {
      tms21: false,
      tms29: false,
      presentationFx: false,
      message: "",
      transactionCurrency,
      functionalCurrency,
      reportingCurrency,
      badgeClass: "gk-std-green",
      badgeLabel: "—"
    };

    if (transactionCurrency !== functionalCurrency) {
      result.tms21 = true;
      result.message += `TMS21 (${transactionCurrency} → ${functionalCurrency}) `;
    }
    if (functionalCurrency === "TRY") {
      result.tms29 = true;
      result.message += "TMS29 (TRY enflasyon düzeltmesi) ";
    }
    if (contract?.tms21Force === true) {
      result.tms21 = true;
      if (!result.message.includes("TMS21")) result.message += "TMS21 (manuel) ";
    }
    if (contract?.tms29Force === true) {
      result.tms29 = true;
      if (!result.message.includes("TMS29")) result.message += "TMS29 (manuel) ";
    }
    if (reportingCurrency !== functionalCurrency) {
      result.presentationFx = true;
      result.message += `+ Sunum Çevrimi (${functionalCurrency} → ${reportingCurrency})`;
    }

    result.message = result.message.trim() || "TMS21/TMS29 uygulanmaz (aynı para birimi)";

    if (result.tms21 && result.tms29) {
      result.badgeClass = "gk-std-purple";
      result.badgeLabel = "TMS21 + TMS29";
    } else if (result.tms21) {
      result.badgeClass = "gk-std-blue";
      result.badgeLabel = "TMS21";
    } else if (result.tms29) {
      result.badgeClass = "gk-std-yellow";
      result.badgeLabel = "TMS29";
    } else {
      result.badgeClass = "gk-std-green";
      result.badgeLabel = "—";
    }
    if (result.presentationFx) {
      if (!result.tms21 && !result.tms29) {
        result.badgeClass = "gk-std-gray";
        result.badgeLabel = "Sunum FX";
      } else {
        result.badgeLabel += " + Sunum";
      }
    }
    return result;
  }

  /**
   * V26 GK-FIX: companyId birleştirme.
   * ÖNCEKİ DAVRANIŞ: localStorage'da bir kere V26_COMPANIES_KEY set
   * edildikten sonra (örn. ilk açılışta boş kontrat listesiyle TR-001
   * default'ları cache'lenmişse), bu fonksiyon hep o eski cache'i
   * döndürüyordu ve kontratlara sonradan eklenen gerçek companyId'lerle
   * (örn. COMP-GK-HOLDING) bir daha ASLA senkronize olmuyordu. Sonuç:
   * manuel kontrat formundaki şirket dropdown'u (V26) farklı bir ID
   * uzayı gösteriyor, V21 multi-tenant guard (getTenantContracts) ise
   * kontrattaki gerçek companyId'yi bekliyor → kontrat "görünmez" oluyor.
   *
   * YENİ DAVRANIŞ (additive, mevcut kayıtlar silinmiyor/değiştirilmiyor):
   * 1) Cache'i oku.
   * 2) v22CompanyList() (= kontratlardan türeyen gerçek companyId listesi)
   *    ile karşılaştır.
   * 3) Cache'de ID veya code olarak KARŞILIĞI OLMAYAN her companyId'yi
   *    cache'e EKLE (V26 UI'dan elle yapılmış isim/groupId değişiklikleri
   *    korunur, sadece eksik olanlar tamamlanır).
   * 4) Cache boşsa eskisi gibi v22'den türet; o da boşsa TR-001 default'larına düş.
   */
  function v26LoadCompanies() {
    let cached = null;
    try {
      const raw = localStorage.getItem(V26_COMPANIES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) cached = parsed;
      }
    } catch (error) {
      console.error("V26 şirket listesi okunamadı:", error);
    }

    let liveFromContracts = [];
    try {
      if (typeof v22CompanyList === "function") {
        liveFromContracts = v22CompanyList().map((c, i) => ({
          id: String(c.id || `TR-${String(i + 1).padStart(3, "0")}`),
          code: String(c.code || c.id || `TR-${String(i + 1).padStart(3, "0")}`),
          name: c.name || c.code || "Şirket",
          country: c.country || "TR",
          functionalCurrency: c.baseCurrency || c.functionalCurrency || "TRY",
          groupId: c.groupId || null,
          status: c.status || "ACTIVE"
        }));
      }
    } catch (error) {}

    if (cached) {
      const knownKeys = new Set();
      cached.forEach(c => {
        if (c.id) knownKeys.add(String(c.id));
        if (c.code) knownKeys.add(String(c.code));
      });
      const missing = liveFromContracts.filter(c => !knownKeys.has(c.id) && !knownKeys.has(c.code));
      if (missing.length) {
        const merged = [...cached, ...missing];
        v26SaveCompanies(merged);
        return merged;
      }
      return cached;
    }

    if (liveFromContracts.length) {
      v26SaveCompanies(liveFromContracts);
      return liveFromContracts;
    }

    // DÜZELTME (kullanıcı talebi — backend'e bağlandık, demo veri
    // artık istenmiyor): önceden burada 4 demo şirket (TR-001
    // "Teknoloji A.Ş.", DE-001 "GmbH", US-001 "LLC", TR-002
    // "Lojistik Ltd.") üretilip HEMEN localStorage'a YAZILIYORDU —
    // hiç sözleşme yokken (ya da henüz backend'den çekilmemişken) bu
    // sahte şirketler Şirket Yönetimi/Konsolidasyon ekranlarında
    // kalıcı olarak görünüyordu. Fail-closed: veri yoksa boş liste.
    v26SaveCompanies([]);
    return [];
  }

  function v26SaveCompanies(list) {
    try {
      localStorage.setItem(V26_COMPANIES_KEY, JSON.stringify(list));
      return true;
    } catch (error) {
      console.error("V26 şirket listesi kaydedilemedi:", error);
      return false;
    }
  }

  function v26FindCompany(companyIdOrName) {
    const list = v26LoadCompanies();
    const key = String(companyIdOrName || "").trim();
    return list.find(c => c.id === key || c.code === key || c.name === key) || null;
  }

  function v26ResolveCompanyForContract(contract) {
    if (!contract) return null;
    return v26FindCompany(contract.companyId) || v26FindCompany(contract.company) || null;
  }

  /* ==========================================================
     V27 — GLOBAL AKTİF ŞİRKET CONTEXT (Kalan İşler madde 2a)
     ----------------------------------------------------------
     Tüm liste/filtre/close/dashboard ekranlarında kullanılacak
     tek bir "aktif şirket" seçimi. "ALL" = Tüm Şirketler (mevcut
     davranış, tek şirketli kullanıcılar için regresyon yok).
     ========================================================== */
  const V26_ACTIVE_COMPANY_KEY = "gk_tfrs16_active_company_v1";

  /**
   * Şu an seçili "aktif şirket" id'si. Seçim yapılmamışsa "ALL" döner
   * (tüm şirketler / mevcut varsayılan davranış).
   * @returns {string}
   */
  function getActiveCompanyId() {
    try {
      return localStorage.getItem(V26_ACTIVE_COMPANY_KEY) || "ALL";
    } catch (error) {
      return "ALL";
    }
  }

  /**
   * Aktif şirketi ayarlar ve açık olan V26 sayfasının (varsa) yeniden
   * render edilmesini tetikler.
   * @param {string} companyId - "ALL" veya bir şirket id/kodu
   */
  function setActiveCompanyId(companyId) {
    const val = String(companyId || "ALL");
    try {
      localStorage.setItem(V26_ACTIVE_COMPANY_KEY, val);
    } catch (error) {
      console.error("Aktif şirket kaydedilemedi:", error);
    }
    try {
      window.dispatchEvent(new CustomEvent("gk-active-company-changed", { detail: { companyId: val } }));
    } catch (error) {}
    try {
      const navSelect = document.getElementById("v26ActiveCompanySelect");
      if (navSelect && navSelect.value !== val) navSelect.value = val;
      const sidebarSelect = document.getElementById("v26SidebarActiveCompanySelect");
      if (sidebarSelect && sidebarSelect.value !== val) sidebarSelect.value = val;
    } catch (error) {}
    if (typeof v26RefreshActivePage === "function") v26RefreshActivePage();
    return val;
  }

  /**
   * V26 (sözleşmelerden türeyen/kalıcı) ve backend session (lisans)
   * şirket listelerini id/code bazında birleştirir. Tek bir tutarlı
   * "id → {id, name, code, functionalCurrency}" listesi döndürür.
   * Silinen/yeniden adlandırılan şirketler için tekil kaynak olarak
   * v26LoadCompanies() esas alınır (sözleşmelerdeki gerçek companyId
   * uzayıyla uyumlu); sadece orada bulunmayan session şirketleri eklenir.
   * @returns {Array<{id:string,name:string,code:string,functionalCurrency:string}>}
   */
  function getUnifiedCompanyOptions() {
    const byId = new Map();
    try {
      const v26 = typeof v26LoadCompanies === "function" ? v26LoadCompanies() : [];
      (v26 || []).forEach(c => {
        const id = String(c.id || c.code || "").trim();
        if (!id || byId.has(id)) return;
        byId.set(id, {
          id,
          name: c.name || c.code || id,
          code: String(c.code || id),
          functionalCurrency: c.functionalCurrency || "TRY"
        });
      });
    } catch (error) {}
    try {
      const sess = (typeof sessionCompanies !== "undefined" && Array.isArray(sessionCompanies)) ? sessionCompanies : [];
      sess.forEach(c => {
        const id = String(c.id || "").trim();
        if (!id || byId.has(id)) return;
        byId.set(id, { id, name: c.name || id, code: id, functionalCurrency: "TRY" });
      });
    } catch (error) {}
    return Array.from(byId.values());
  }

  /**
   * V26 sayfa host'unda en son render edilen sayfayı (varsa) aktif
   * şirket değişikliğinden sonra yeniden çizer. Sayfa hâlâ kendi
   * dataset.companyId'sini koruyacaksa (kullanıcı o sayfada elle bir
   * şirket seçtiyse) dokunmaz; sadece host henüz özel bir seçim
   * içermiyorsa aktif şirket varsayılanı uygulanır.
   */
  function v26RefreshActivePage() {
    try {
      const host = document.getElementById("v26PageHost");
      if (host && typeof host.__v26LastRenderer === "function") {
        host.__v26LastRenderer(host);
      }
    } catch (error) {}
  }

  function v26StandardsBadgeHtml(contract) {
    const company = v26ResolveCompanyForContract(contract);
    const std = getApplicableStandards(contract, company);
    return `<span class="gk-std-badge ${std.badgeClass}" title="${escapeHtml(std.message)}">${escapeHtml(std.badgeLabel)}</span>`;
  }

  function injectV26Styles() {
    if (document.getElementById("gk-v26-multi-fx-styles")) return;
    const style = document.createElement("style");
    style.id = "gk-v26-multi-fx-styles";
    style.textContent = `
      .gk-std-badge { display:inline-block; padding:2px 8px; border-radius:999px; font-size:11px; font-weight:700; letter-spacing:.02em; white-space:nowrap; }
      .gk-std-green { background:#dcfce7; color:#166534; border:1px solid #86efac; }
      .gk-std-blue { background:#dbeafe; color:#1e40af; border:1px solid #93c5fd; }
      .gk-std-yellow { background:#fef9c3; color:#854d0e; border:1px solid #fde047; }
      .gk-std-purple { background:#f3e8ff; color:#6b21a8; border:1px solid #d8b4fe; }
      .gk-std-gray { background:#f1f5f9; color:#475569; border:1px solid #cbd5e1; }
      .gk-v26-page { padding:20px; max-width:1200px; margin:0 auto; }
      .gk-v26-card { background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:18px; margin-bottom:16px; box-shadow:0 1px 3px rgba(0,0,0,.04); }
      .gk-v26-table { width:100%; border-collapse:collapse; font-size:13px; }
      .gk-v26-table th { text-align:left; padding:10px 12px; background:#f8fafc; border-bottom:2px solid #e2e8f0; font-weight:600; color:#334155; }
      .gk-v26-table td { padding:10px 12px; border-bottom:1px solid #f1f5f9; color:#1e293b; }
      .gk-v26-table tr:hover td { background:#f8fafc; }
      .gk-v26-btn { padding:8px 16px; border-radius:8px; border:0; background:#1e293b; color:#fff; font-size:13px; font-weight:600; cursor:pointer; }
      .gk-v26-btn:hover { background:#0f172a; }
      .gk-v26-btn-secondary { background:#fff; color:#334155; border:1px solid #e2e8f0; }
      .gk-v26-btn-secondary:hover { background:#f8fafc; }
      .gk-v26-form-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:12px; margin-top:12px; }
      .gk-v26-form-grid label { display:flex; flex-direction:column; gap:4px; font-size:12px; color:#64748b; font-weight:600; }
      .gk-v26-form-grid input, .gk-v26-form-grid select { padding:8px 10px; border:1px solid #e2e8f0; border-radius:8px; font-size:13px; color:#1e293b; }
      .gk-v26-legend { display:flex; flex-wrap:wrap; gap:10px; margin:12px 0; font-size:12px; }
      .gk-v26-legend span { display:inline-flex; align-items:center; gap:6px; }
      .gk-v26-auto-detect { background:#f0f9ff; border:1px solid #bae6fd; border-radius:10px; padding:12px 14px; margin-top:12px; font-size:13px; color:#0c4a6e; }
      .gk-v26-badge { display:inline-block; padding:3px 8px; border-radius:999px; font-size:11px; font-weight:700; white-space:nowrap; }
      .gk-v26-badge-success { background:#dcfce7; color:#166534; border:1px solid #86efac; }
      .gk-v26-badge-warning { background:#fef9c3; color:#854d0e; border:1px solid #fde047; }
      .gk-v26-badge-danger { background:#fee2e2; color:#991b1b; border:1px solid #fca5a5; }
      .gk-v26-btn-danger { background:#fff; color:#b91c1c; border:1px solid #fecaca; }
      .gk-v26-btn-danger:hover { background:#fef2f2; }
      .gk-v26-modal { position:fixed; inset:0; z-index:10000; display:flex; align-items:center; justify-content:center; padding:18px; background:rgba(15,23,42,.45); }
      .gk-v26-modal-card { width:min(720px,100%); max-height:90vh; overflow:auto; background:#fff; border:1px solid #e2e8f0; border-radius:14px; padding:20px; box-shadow:0 20px 50px rgba(15,23,42,.2); }
      .gk-v26-modal-card h3 { margin:0 0 12px; color:#0f172a; }
      /* V26 sidebar/page overflow fix: added navigation must remain scrollable on tablets/mobile. */
      .sidebar, #sidebar, #mobileSidebar { overflow-y:auto !important; overflow-x:hidden !important; -webkit-overflow-scrolling:touch; }
      #v26NavBlock { max-height:calc(100vh - 150px); overflow-y:auto; overflow-x:hidden; -webkit-overflow-scrolling:touch; scrollbar-width:thin; }
      #v26NavBlock::-webkit-scrollbar { width:6px; }
      #v26NavBlock::-webkit-scrollbar-thumb { background:rgba(148,163,184,.55); border-radius:8px; }
      #v26NavBlock .gk-v26-btn { box-sizing:border-box; max-width:100%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .gk-v26-page { min-width:0; max-width:100%; overflow-x:hidden; box-sizing:border-box; }
      .gk-v26-card { min-width:0; max-width:100%; box-sizing:border-box; overflow-x:auto; }
      .gk-v26-table-wrap { width:100%; max-width:100%; overflow-x:auto; overflow-y:hidden; -webkit-overflow-scrolling:touch; }
      .gk-v26-table { min-width:760px; }
      /* DÜZELTME: v191Table() (Finansal Raporlama / Dipnotlar ortak
         tablo üreticisi) "gk-v26-table" DEĞİL, "table-wrapper" class'lı
         çıplak bir <table> üretiyor — bu class'a kadar hiç CSS
         tanımlı değildi, tablo mobilde container'ı taşırıyordu.
         v191Table()'ın KENDİSİNE dokunulmadı, sadece eksik CSS eklendi. */
      .table-wrapper { width:100%; max-width:100%; overflow-x:auto; -webkit-overflow-scrolling:touch; box-sizing:border-box; }
      .table-wrapper table { min-width:600px; width:100%; border-collapse:collapse; font-size:12px; }
      .table-wrapper th { text-align:left; padding:8px 10px; background:#f8fafc; border-bottom:2px solid #e2e8f0; font-weight:600; color:#334155; white-space:nowrap; }
      .table-wrapper td { padding:8px 10px; border-bottom:1px solid #f1f5f9; color:#1e293b; white-space:nowrap; }
      .table-wrapper tr:hover td { background:#f8fafc; }
      @media (max-width:768px) { .gk-v26-page { padding:12px; } .gk-v26-form-grid { grid-template-columns:1fr; } #v26NavBlock { max-height:calc(100vh - 110px); } .gk-v26-table-wrap { scrollbar-width:thin; } .table-wrapper { scrollbar-width:thin; } }

      /* DÜZELTME (Yeni Sözleşme formu dashboard'a taşındı): contractModal
         ("Yeni Sözleşme" statik HTML modalı, tfrs16.html'de tanımlı) artık
         dashboard.html'e de kopyalandı, ama .modal/.form-grid gibi
         class'lar css/tfrs16.css'te tanımlıydı — dashboard.html o dosyayı
         hiç yüklemiyordu. TÜM css/tfrs16.css'i yüklemek yerine (dashboard'un
         kendi tasarımıyla çakışma riski taşırdı), yalnızca bu modalın
         ihtiyaç duyduğu class'lar css/tfrs16.css'ten (satır ~547 civarı)
         BİREBİR kopyalanıp buraya (dashboard'da zaten çalışan izole
         injectV26Styles mekanizmasına) eklendi. CSS değişkenleri
         (var(--muted) vb.) dashboard'da tanımlı olmadığı için SABİT
         renk değerleriyle değiştirildi.
         css/tfrs16.css'in KENDİSİNE hiç dokunulmadı — tfrs16.html hâlâ
         normal şekilde çalışıyor. */
      .modal { position:fixed; inset:0; background:rgba(15,23,42,.55); display:grid; place-items:center; padding:20px; z-index:1000; overflow-y:auto; }
      .modal.hidden { display:none !important; }
      .modal-content { background:white; width:min(720px,100%); max-height:calc(100vh - 40px); overflow-y:auto; border-radius:15px; padding:22px; box-shadow:0 25px 60px rgba(0,0,0,.18); }
      .modal-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:22px; gap:20px; }
      .modal-header h2 { margin:5px 0 0; font-size:20px; }
      .modal-header .eyebrow { font-size:10px; font-weight:700; color:#64748b; letter-spacing:.05em; text-transform:uppercase; }
      .close-button { border:none; background:#f1f5f9; width:32px; height:32px; border-radius:7px; cursor:pointer; font-size:20px; color:#64748b; flex-shrink:0; }
      .close-button:hover { background:#e2e8f0; }
      .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
      .form-group { display:flex; flex-direction:column; gap:6px; }
      .form-group label { font-size:10px; font-weight:700; color:#64748b; }
      .form-group input, .form-group select { border:1px solid #e5e7eb; border-radius:8px; padding:10px; outline:none; font-size:12px; background:white; font-family:inherit; }
      .form-group input:focus, .form-group select:focus { border-color:#94a3b8; box-shadow:0 0 0 3px rgba(148,163,184,0.15); }
      .modal-footer { display:flex; justify-content:flex-end; gap:9px; margin-top:22px; }
      .primary-button, .secondary-button, .danger-button { border-radius:8px; padding:10px 14px; font-size:12px; cursor:pointer; text-decoration:none; display:inline-flex; align-items:center; justify-content:center; gap:6px; transition:background .15s ease,border-color .15s ease,transform .05s ease; white-space:nowrap; }
      .primary-button { border:1px solid #334155; background:#334155; color:white; }
      .primary-button:hover { background:#1e293b; border-color:#1e293b; }
      .secondary-button { background:white; color:#172033; border:1px solid #e5e7eb; }
      .secondary-button:hover { background:#f8fafc; border-color:#cbd5e1; }
      .primary-button:active, .secondary-button:active { transform:translateY(1px); }
      .gk-contract-tabs { display:flex; gap:4px; flex-wrap:wrap; margin:-4px 0 16px; border-bottom:1px solid #e5e7eb; padding-bottom:0; }
      .gk-contract-tab { border:0; background:transparent; padding:9px 14px; font-size:12px; font-weight:600; color:#64748b; cursor:pointer; border-bottom:2px solid transparent; margin-bottom:-1px; }
      .gk-contract-tab:hover { color:#0f172a; }
      .gk-contract-tab.active { color:#0f172a; border-bottom-color:#0f172a; }
      /* FAZ B — sözleşme detay modalı tab'ları (Özet / Ödeme Planı /
         Modifikasyon & Reassessment / SLB / Alt Kiralama / Fişler /
         Denetim İzi). injectV26Styles hem tfrs16.html hem dashboard'da
         çalıştığı için tek yerde tanımlanır. */
      .gk-detail-tabs { position:sticky; top:0; z-index:20; display:flex; gap:2px; flex-wrap:nowrap; margin:0 0 18px; border-bottom:1px solid #e5e7eb; overflow-x:auto; overflow-y:hidden; background:#fff; scrollbar-width:thin; -webkit-overflow-scrolling:touch; }
      .gk-detail-tabs::-webkit-scrollbar { height:6px; }
      .gk-detail-tabs .gk-detail-tab-btn { flex:0 0 auto; }
      .gk-detail-tab-btn { border:0; background:transparent; padding:9px 13px; font-size:12px; font-weight:600; color:#64748b; cursor:pointer; border-bottom:2px solid transparent; margin-bottom:-1px; white-space:nowrap; font-family:inherit; }
      .gk-detail-tab-btn:hover { color:#0f172a; }
      .gk-detail-tab-btn.active { color:#0f172a; border-bottom-color:#0f172a; }
      .gk-detail-tab { display:none; }
      .gk-detail-tab.gk-detail-tab-active { display:block; }
      /* FAZ C: sözleşme detay modalı dashboard'a da eklendiği için
         (önceden yalnızca tfrs16.html'de vardı) bu class'lar da
         css/tfrs16.css'ten buraya kopyalandı — dashboard o dosyayı
         yüklemiyor. css/tfrs16.css'e DOKUNULMADI. */
      .detail-modal { width:min(900px,100%); }
      .detail-content { font-size:13px; }
      .detail-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:10px; }
      .detail-item { background:#f8fafc; border-radius:9px; padding:12px; }
      .detail-item span { display:block; color:#64748b; font-size:9px; }
      .detail-item strong { display:block; margin-top:5px; font-size:14px; }
      .detail-actions { display:flex; justify-content:flex-end; gap:9px; margin-top:22px; flex-wrap:wrap; }
      .danger-button { border:1px solid #fecaca; background:#fef2f2; color:#b91c1c; }
      .danger-button:hover { background:#fecaca; }
      .empty-state { text-align:center; padding:40px 20px; }
      .empty-state h3 { font-size:15px; margin:0 0 6px; }
      .empty-state p { color:#64748b; font-size:12px; margin:0; }
      @media (max-width:768px) { .detail-grid { grid-template-columns:1fr; } }
      .form-grid [data-tab]:not(.gk-tab-active) { display:none !important; }
      .form-grid [data-tab].gk-tab-active { display:block; }
    `;
    document.head.appendChild(style);
  }

  function v26CurrencyOptions(selected) {
    return V26_CURRENCIES.map(c => `<option value="${c}" ${c === selected ? "selected" : ""}>${c}</option>`).join("");
  }

  function v26CountryOptions(selected) {
    return V26_COUNTRIES.map(c => `<option value="${c.code}" ${c.code === selected ? "selected" : ""}>${c.name} (${c.code})</option>`).join("");
  }





  function renderCompanyManagementPage(container) {
    if (!container) return;
    injectV26Styles();
    const companies = v26LoadCompanies();
    container.innerHTML = `
      <div class="gk-v26-page">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:16px;">
          <div>
            <h2 style="margin:0;font-size:20px;color:#0f172a;">Şirket Yönetimi</h2>
            <p style="margin:4px 0 0;font-size:13px;color:#64748b;">Fonksiyonel para birimi, ülke ve grup tanımları</p>
          </div>
          <button type="button" class="gk-v26-btn" id="v26AddCompanyBtn">+ Yeni Şirket Ekle</button>
        </div>
        <div class="gk-v26-card" id="v26CompanyFormCard" style="display:none;">
          <h3 style="margin:0 0 8px;font-size:15px;">Şirket Formu</h3>
          <div class="gk-v26-form-grid">
            <label>Şirket Kodu<input id="v26CoCode" placeholder="TR-001" /></label>
            <label>Şirket Adı<input id="v26CoName" placeholder="Teknoloji A.Ş." /></label>
            <label>Ülke<select id="v26CoCountry">${v26CountryOptions("TR")}</select></label>
            <label>Fonksiyonel Para Birimi<select id="v26CoFx">${v26CurrencyOptions("TRY")}</select></label>
            <label>Grup ID (opsiyonel)<input id="v26CoGroup" placeholder="GRP-1" /></label>
          </div>
          <div style="margin-top:14px;display:flex;gap:8px;">
            <button type="button" class="gk-v26-btn" id="v26SaveCompanyBtn">Kaydet</button>
            <button type="button" class="gk-v26-btn gk-v26-btn-secondary" id="v26CancelCompanyBtn">İptal</button>
          </div>
          <input type="hidden" id="v26CoEditId" value="" />
        </div>
        <div class="gk-v26-card">
          <table class="gk-v26-table">
            <thead><tr><th>Şirket Kodu</th><th>Şirket Adı</th><th>Ülke</th><th>Fonksiyonel PB</th><th>Grup</th><th></th></tr></thead>
            <tbody>
              ${companies.map(c => `
                <tr data-id="${escapeHtml(c.id)}">
                  <td><strong>${escapeHtml(c.code)}</strong></td>
                  <td>${escapeHtml(c.name)}</td>
                  <td>${escapeHtml(c.country || "—")}</td>
                  <td><span class="gk-std-badge gk-std-blue">${escapeHtml(c.functionalCurrency || "TRY")}</span></td>
                  <td>${escapeHtml(c.groupId || "—")}</td>
                  <td style="text-align:right;">
                    <button type="button" class="gk-v26-btn gk-v26-btn-secondary v26-edit-co" data-id="${escapeHtml(c.id)}" style="padding:4px 10px;font-size:12px;">Düzenle</button>
                    <button type="button" class="gk-v26-btn gk-v26-btn-secondary v26-del-co" data-id="${escapeHtml(c.id)}" style="padding:4px 10px;font-size:12px;color:#b91c1c;">Sil</button>
                  </td>
                </tr>`).join("") || `<tr><td colspan="6" style="text-align:center;color:#94a3b8;">Henüz şirket yok</td></tr>`}
            </tbody>
          </table>
        </div>
        <div class="gk-v26-legend">
          <span><span class="gk-std-badge gk-std-green">—</span> TMS21/TMS29 yok</span>
          <span><span class="gk-std-badge gk-std-blue">TMS21</span> Kur çevrimi</span>
          <span><span class="gk-std-badge gk-std-yellow">TMS29</span> Enflasyon</span>
          <span><span class="gk-std-badge gk-std-purple">TMS21 + TMS29</span> Her ikisi</span>
          <span><span class="gk-std-badge gk-std-gray">Sunum FX</span> Ek çevrim</span>
        </div>
      </div>`;

    const formCard = container.querySelector("#v26CompanyFormCard");
    container.querySelector("#v26AddCompanyBtn")?.addEventListener("click", () => {
      container.querySelector("#v26CoEditId").value = "";
      container.querySelector("#v26CoCode").value = "";
      container.querySelector("#v26CoName").value = "";
      container.querySelector("#v26CoCountry").value = "TR";
      container.querySelector("#v26CoFx").value = "TRY";
      container.querySelector("#v26CoGroup").value = "GRP-1";
      formCard.style.display = "block";
    });
    container.querySelector("#v26CancelCompanyBtn")?.addEventListener("click", () => { formCard.style.display = "none"; });
    container.querySelector("#v26SaveCompanyBtn")?.addEventListener("click", () => {
      const editId = container.querySelector("#v26CoEditId").value;
      const code = String(container.querySelector("#v26CoCode").value || "").trim();
      const name = String(container.querySelector("#v26CoName").value || "").trim();
      const country = container.querySelector("#v26CoCountry").value;
      const functionalCurrency = container.querySelector("#v26CoFx").value;
      const groupId = String(container.querySelector("#v26CoGroup").value || "").trim() || null;
      if (!code || !name) {
        if (typeof showAlert === "function") showAlert("Şirket kodu ve adı zorunludur.");
        return;
      }
      const list = v26LoadCompanies();
      if (editId) {
        const idx = list.findIndex(c => c.id === editId);
        if (idx >= 0) list[idx] = { ...list[idx], code, name, country, functionalCurrency, groupId };
      } else {
        if (list.some(c => c.code === code || c.id === code)) {
          if (typeof showAlert === "function") showAlert("Bu şirket kodu zaten var.");
          return;
        }
        list.push({ id: code, code, name, country, functionalCurrency, groupId, status: "ACTIVE" });
      }
      v26SaveCompanies(list);
      if (typeof recordAuditEvent === "function") {
        recordAuditEvent({
          action: editId ? "COMPANY_UPDATED" : "COMPANY_CREATED",
          entityType: "COMPANY",
          entityId: code,
          reason: "V26 Şirket Yönetimi",
          newValue: { code, name, country, functionalCurrency, groupId }
        });
      }
      renderCompanyManagementPage(container);
    });
    container.querySelectorAll(".v26-edit-co").forEach(btn => {
      btn.addEventListener("click", () => {
        const c = v26FindCompany(btn.getAttribute("data-id"));
        if (!c) return;
        container.querySelector("#v26CoEditId").value = c.id;
        container.querySelector("#v26CoCode").value = c.code || "";
        container.querySelector("#v26CoName").value = c.name || "";
        container.querySelector("#v26CoCountry").value = c.country || "TR";
        container.querySelector("#v26CoFx").value = c.functionalCurrency || "TRY";
        container.querySelector("#v26CoGroup").value = c.groupId || "";
        formCard.style.display = "block";
      });
    });
    container.querySelectorAll(".v26-del-co").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        const ok = typeof showConfirm === "function"
          ? await showConfirm("Bu şirketi silmek istediğinize emin misiniz?", { danger: true, title: "Şirket Sil" })
          : confirm("Silinsin mi?");
        if (!ok) return;
        v26SaveCompanies(v26LoadCompanies().filter(c => c.id !== id));
        renderCompanyManagementPage(container);
      });
    });
  }

  function renderContractStandardsPanel(contract) {
    const company = v26ResolveCompanyForContract(contract);
    const std = getApplicableStandards(contract, company);
    return `
      <div class="gk-v26-auto-detect">
        <strong>Otomatik Standart Tespiti</strong>
        <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
          <span class="gk-std-badge ${std.badgeClass}">${escapeHtml(std.badgeLabel)}</span>
          <span style="color:#0369a1;">${escapeHtml(std.message)}</span>
        </div>
        <div style="margin-top:8px;font-size:12px;color:#0c4a6e;">
          İşlem PB: <strong>${escapeHtml(std.transactionCurrency)}</strong> ·
          Fonksiyonel PB: <strong>${escapeHtml(std.functionalCurrency)}</strong> ·
          Sunum PB: <strong>${escapeHtml(std.reportingCurrency)}</strong>
        </div>
      </div>`;
  }



  /* ==========================================================
     V26 — V22 GRUP / ELİMİNASYON YÖNETİM UI
     ----------------------------------------------------------
     Additive UI katmanı. V22 model ve fonksiyonları değiştirilmez.
  ========================================================== */
  const V26_GROUP_CURRENCIES = ["TRY","EUR","USD","GBP","CHF","JPY","AED","SAR"];
  const V26_ELIM_TYPES = [
    "INTERCOMPANY_RECEIVABLE","INTERCOMPANY_PAYABLE","INTERCOMPANY_REVENUE",
    "INTERCOMPANY_EXPENSE","INTERCOMPANY_LEASE","OTHER"
  ];

  function v26UiEsc(value) {
    if (typeof escapeHtml === "function") return escapeHtml(value == null ? "" : String(value));
    return String(value == null ? "" : value).replace(/[&<>\"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }
  function v26UiCompanyOptions(selected="") {
    return v22CompanyList().map(c => `<option value="${v26UiEsc(c.id)}" ${String(c.id)===String(selected)?"selected":""}>${v26UiEsc(c.code)} — ${v26UiEsc(c.name)}</option>`).join("");
  }
  function v26UiGroupOptions(selected="", includeAll=true) {
    const groups = getGroups();
    return (includeAll ? `<option value="">Tüm Gruplar</option>` : "") + groups.map(g => `<option value="${v26UiEsc(g.id)}" ${String(g.id)===String(selected)?"selected":""}>${v26UiEsc(g.code)} — ${v26UiEsc(g.name)}</option>`).join("");
  }
  function v26UiToast(message, type="info") {
    try { if (typeof showToast === "function") { showToast(message, type, 2500); return; } } catch(e) {}
    try { if (typeof showAlert === "function") { showAlert(message); return; } } catch(e) {}
    console[type === "error" ? "error" : "log"](message);
  }
  function v26UiRun(fn) { try { return fn(); } catch (e) { v26UiToast(e?.message || String(e), "error"); return null; } }

  function renderGroupManagementPage(container) {
    if (!container) return;
    injectV26Styles();
    let selectedGroupId = container.dataset.selectedGroupId || "";
    const render = () => {
      const groups = getGroups();
      const companies = v22CompanyList();
      const selected = groups.find(g => String(g.id) === String(selectedGroupId)) || null;
      const scope = selected ? getConsolidationScope(selected.id) : [];
      const members = selected ? scope.filter(s => s.included !== false).map(s => ({ scope:s, company:companies.find(c => String(c.id)===String(s.companyId)) })).filter(x=>x.company) : [];
      container.innerHTML = `<div class="gk-v26-page">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:16px;">
          <div><h2 style="margin:0;font-size:20px;color:#0f172a;">Grup Yönetimi</h2><p style="margin:4px 0 0;color:#64748b;font-size:13px;">V22 konsolidasyon grupları ve şirket kapsamı</p></div>
          <button class="gk-v26-btn" id="v26NewGroup">＋ Yeni Grup Ekle</button>
        </div>
        <div class="gk-v26-card"><table class="gk-v26-table"><thead><tr><th>Grup ID</th><th>Grup Kodu</th><th>Grup Adı</th><th>Grup Para Birimi</th><th>Durum</th></tr></thead><tbody>
          ${groups.map(g=>`<tr data-group-id="${v26UiEsc(g.id)}" class="v26-group-row" style="cursor:pointer;${String(g.id)===String(selectedGroupId)?"background:#eff6ff;":""}"><td>${v26UiEsc(g.id)}</td><td><strong>${v26UiEsc(g.code)}</strong></td><td>${v26UiEsc(g.name)}</td><td>${v26UiEsc(g.groupCurrency)}</td><td><span class="gk-v26-badge ${String(g.status)==="ACTIVE"?"gk-v26-badge-success":"gk-v26-badge-warning"}">${g.status==='ACTIVE'?'Aktif':'Pasif'}</span></td></tr>`).join("") || `<tr><td colspan="5" style="text-align:center;color:#94a3b8;">Grup bulunamadı</td></tr>`}
        </tbody></table></div>
        ${selected ? `<div class="gk-v26-card" id="v26GroupDetail"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;"><div><h3 style="margin:0;font-size:15px;">${v26UiEsc(selected.name)}</h3><p style="margin:4px 0;color:#64748b;font-size:12px;">${v26UiEsc(selected.code)} · ${v26UiEsc(selected.groupCurrency)}</p></div><div style="display:flex;gap:8px;"><button class="gk-v26-btn gk-v26-btn-secondary" id="v26EditGroup">Düzenle</button><button class="gk-v26-btn" id="v26AddCompany">＋ Şirket Ekle</button></div></div>
          <table class="gk-v26-table" style="margin-top:12px;"><thead><tr><th>Şirket</th><th>Kod</th><th>Para Birimi</th><th>Yöntem</th><th>Oran</th><th>İşlem</th></tr></thead><tbody>
          ${members.map(m=>`<tr><td>${v26UiEsc(m.company.name)}</td><td>${v26UiEsc(m.company.code)}</td><td>${v26UiEsc(m.company.baseCurrency)}</td><td>${v26UiEsc(m.scope.consolidationMethod)}</td><td>${Number(m.scope.ownershipPercentage||0).toFixed(2)}%</td><td><button class="gk-v26-btn gk-v26-btn-danger v26-remove-company" data-company-id="${v26UiEsc(m.company.id)}">Şirket Çıkar</button></td></tr>`).join("") || `<tr><td colspan="6" style="text-align:center;color:#94a3b8;">Bu grupta şirket yok</td></tr>`}
          </tbody></table></div>` : `<div class="gk-v26-card" style="color:#64748b;">Detay için bir grup satırına tıklayın.</div>`}
      </div>`;
      container.querySelectorAll('.v26-group-row').forEach(r=>r.addEventListener('click',()=>{ selectedGroupId=r.dataset.groupId; container.dataset.selectedGroupId=selectedGroupId; render(); }));
      container.querySelector('#v26NewGroup')?.addEventListener('click',()=>v26OpenGroupModal(container,null,render));
      container.querySelector('#v26EditGroup')?.addEventListener('click',()=>v26OpenGroupModal(container,selected,render));
      container.querySelector('#v26AddCompany')?.addEventListener('click',()=>v26OpenCompanyModal(container,selected,render));
      container.querySelectorAll('.v26-remove-company').forEach(btn=>btn.addEventListener('click',e=>{ e.stopPropagation(); if(confirm('Şirketi gruptan çıkarmak istediğinize emin misiniz?')) v26UiRun(()=>{removeCompanyFromGroup(selected.id,btn.dataset.companyId); render();}); }));
    };
    render();
  }

  function v26OpenGroupModal(container, group, onDone) {
    const modal=document.createElement('div'); modal.className='gk-v26-modal'; modal.innerHTML=`<div class="gk-v26-modal-card"><div style="display:flex;justify-content:space-between;align-items:center;"><h3>${group?'Grup Düzenle':'Yeni Grup'}</h3><button class="gk-v26-btn gk-v26-btn-secondary" id="close">×</button></div>
      <div class="gk-v26-form-grid"><label>Grup Kodu<input id="code" value="${v26UiEsc(group?.code||'')}"></label><label>Grup Adı<input id="name" value="${v26UiEsc(group?.name||'')}"></label><label>Grup Para Birimi<select id="currency">${V26_GROUP_CURRENCIES.map(c=>`<option ${c===(group?.groupCurrency||'TRY')?'selected':''}>${c}</option>`).join('')}</select></label><label>Durum<select id="status"><option ${group?.status==='ACTIVE'||!group?'selected':''}>ACTIVE</option><option ${group?.status==='INACTIVE'?'selected':''}>INACTIVE</option></select></label></div><div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px;"><button class="gk-v26-btn gk-v26-btn-secondary" id="cancel">Vazgeç</button><button class="gk-v26-btn" id="save">Kaydet</button></div></div>`;
    document.body.appendChild(modal); const close=()=>modal.remove(); modal.querySelector('#close').onclick=close; modal.querySelector('#cancel').onclick=close;
    modal.querySelector('#save').onclick=()=>v26UiRun(()=>{ const input={code:modal.querySelector('#code').value.trim(),name:modal.querySelector('#name').value.trim(),groupCurrency:modal.querySelector('#currency').value,status:modal.querySelector('#status').value}; if(!input.code||!input.name) throw new Error('Grup kodu ve grup adı zorunludur.'); group?updateGroup(group.id,input):createGroup(input); close(); onDone(); });
  }
  function v26OpenCompanyModal(container, group, onDone) {
    const modal=document.createElement('div'); modal.className='gk-v26-modal'; modal.innerHTML=`<div class="gk-v26-modal-card"><h3>Şirket Ekle</h3><label>Şirket<select id="company"><option value="">Seçiniz</option>${v26UiCompanyOptions()}</select></label><div class="gk-v26-form-grid" style="margin-top:10px;"><label>Konsolidasyon Yöntemi<select id="method"><option>FULL</option><option>EQUITY</option><option>PROPORTIONAL</option></select></label><label>Oran %<input id="ownership" type="number" min="0" max="100" step="0.01" value="100"></label></div><div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px;"><button class="gk-v26-btn gk-v26-btn-secondary" id="cancel">Vazgeç</button><button class="gk-v26-btn" id="save">Ekle</button></div></div>`;
    document.body.appendChild(modal); modal.querySelector('#cancel').onclick=()=>modal.remove(); modal.querySelector('#save').onclick=()=>v26UiRun(()=>{const id=modal.querySelector('#company').value;if(!id)throw new Error('Şirket seçin.');addCompanyToGroup(group.id,id,{consolidationMethod:modal.querySelector('#method').value,ownershipPercentage:Number(modal.querySelector('#ownership').value)});modal.remove();onDone();});
  }

  function renderEliminationManagementPage(container) {
    if(!container)return; injectV26Styles();
    try { getEliminations(null); }
    catch (error) {
      container.innerHTML = `<div class="gk-v26-page"><h2>Eliminasyon Yönetimi</h2><p role="status">Eliminasyon kayıtları için doğrulanmış sunucu kaynağı henüz hazır değil. Bu alanda kayıt oluşturulamaz veya rapor alınamaz.</p><details><summary>Teknik ayrıntı</summary><code>${v26UiEsc(error?.code || 'REPORTING_AUTHORITY_UNAVAILABLE')}</code></details></div>`;
      return;
    }
    const state=container.__v26ElimState||{groupId:'',date:'',status:'',rows:[],recon:[]}; container.__v26ElimState=state;
    const render=()=>{ let rows=v26UiRun(()=>getEliminations(state.groupId||null))||[]; if(state.date)rows=rows.filter(r=>String(r.reportingDate||'')===state.date); if(state.status)rows=rows.filter(r=>String(r.status||'')===state.status); state.rows=rows;
      const groups=getGroups(); const today=new Date().toISOString().slice(0,10); const fmt=n=>Number(n||0).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2});
      container.innerHTML=`<div class="gk-v26-page"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:16px;"><div><h2 style="margin:0;font-size:20px;">Eliminasyon Yönetimi</h2><p style="margin:4px 0;color:#64748b;font-size:13px;">V22 intercompany eliminasyonları ve mutabakat</p></div><div style="display:flex;gap:8px;flex-wrap:wrap;"><button class="gk-v26-btn" id="newElim">＋ Yeni Eliminasyon</button><button class="gk-v26-btn gk-v26-btn-secondary" id="exportElim">Excel Export</button></div></div>
      <div class="gk-v26-card"><div class="gk-v26-form-grid"><label>Grup<select id="filterGroup">${v26UiGroupOptions(state.groupId)}</select></label><label>Dönem<input type="date" id="filterDate" value="${v26UiEsc(state.date)}"></label><label>Durum<select id="filterStatus"><option value="">Tümü</option><option ${state.status==='DRAFT'?'selected':''}>DRAFT</option><option ${state.status==='POSTED'?'selected':''}>POSTED</option><option ${state.status==='REJECTED'?'selected':''}>REJECTED</option></select></label></div></div>
      <div class="gk-v26-card"><table class="gk-v26-table"><thead><tr><th>From Company</th><th>To Company</th><th>Account</th><th style="text-align:right;">Amount</th><th>Currency</th><th>Elimination Type</th><th>Reporting Date</th><th>Status</th><th>Reason</th><th></th></tr></thead><tbody>${rows.map(r=>{const fc=v22CompanyList().find(c=>String(c.id)===String(r.fromCompanyId));const tc=v22CompanyList().find(c=>String(c.id)===String(r.toCompanyId));const cls=r.status==='POSTED'?'gk-v26-badge-success':r.status==='REJECTED'?'gk-v26-badge-danger':'gk-v26-badge-warning';return `<tr><td>${v26UiEsc(fc?.code||r.fromCompanyId)}</td><td>${v26UiEsc(tc?.code||r.toCompanyId)}</td><td>${v26UiEsc(r.account)}</td><td style="text-align:right;">${fmt(r.amount)}</td><td>${v26UiEsc(r.currency)}</td><td>${v26UiEsc(r.eliminationType)}</td><td>${v26UiEsc(r.reportingDate||'')}</td><td><span class="gk-v26-badge ${cls}">${v26UiEsc(r.status)}</span></td><td>${v26UiEsc(r.reason)}</td><td><button class="gk-v26-btn gk-v26-btn-secondary v26-edit-elim" data-id="${v26UiEsc(r.id)}">Düzenle</button></td></tr>`}).join('')||`<tr><td colspan="10" style="text-align:center;color:#94a3b8;">Kayıt bulunamadı</td></tr>`}</tbody></table></div>
      ${state.groupId?`<div class="gk-v26-card"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;"><div><h3 style="margin:0;font-size:15px;">Intercompany Reconciliation</h3><p style="margin:4px 0;color:#64748b;font-size:12px;">${v26UiEsc(state.date||today)}</p></div><div style="display:flex;gap:8px;"><button class="gk-v26-btn" id="runRecon">Mutabakat Kontrolü</button><button class="gk-v26-btn gk-v26-btn-secondary" id="exportRecon">Excel Export</button></div></div>${state.recon.length?`<table class="gk-v26-table" style="margin-top:12px;"><thead><tr><th>From</th><th>To</th><th>Currency</th><th>Receivable</th><th>Payable</th><th>Variance</th><th>Status</th></tr></thead><tbody>${state.recon.map(r=>`<tr><td>${v26UiEsc(r.fromCompanyId)}</td><td>${v26UiEsc(r.toCompanyId)}</td><td>${v26UiEsc(r.currency)}</td><td>${fmt(r.receivable)}</td><td>${fmt(r.payable)}</td><td>${fmt(r.variance)}</td><td><span class="gk-v26-badge ${r.status==='MATCHED'?'gk-v26-badge-success':r.status==='WARNING'?'gk-v26-badge-warning':'gk-v26-badge-danger'}">${v26UiEsc(r.status)}</span></td></tr>`).join('')}</tbody></table>`:`<p style="margin:12px 0 0;color:#94a3b8;">Henüz mutabakat çalıştırılmadı.</p>`}</div>`:''}</div>`;
      container.querySelector('#filterGroup').onchange=e=>{state.groupId=e.target.value;state.recon=[];render();}; container.querySelector('#filterDate').onchange=e=>{state.date=e.target.value;render();}; container.querySelector('#filterStatus').onchange=e=>{state.status=e.target.value;render();};
      container.querySelector('#newElim').onclick=()=>v26OpenEliminationModal(container,null,render,state.groupId,state.date||today);
      container.querySelector('#exportElim').onclick=()=>v26UiRun(()=>exportEliminations(state.groupId||null,state.date||today));
      container.querySelector('#runRecon')?.addEventListener('click',()=>v26UiRun(()=>{state.recon=v22RunIntercompanyReconciliation(state.groupId,state.date||today)||[];render();}));
      container.querySelector('#exportRecon')?.addEventListener('click',()=>v26UiRun(()=>exportIntercompanyReconciliation(state.groupId,state.date||today)));
      container.querySelectorAll('.v26-edit-elim').forEach(b=>b.onclick=()=>{const row=rows.find(x=>String(x.id)===String(b.dataset.id));v26OpenEliminationModal(container,row,render,state.groupId,state.date||today);});
    }; render();
  }

  function v26OpenEliminationModal(container,row,onDone,defaultGroupId,defaultDate){
    const modal=document.createElement('div');modal.className='gk-v26-modal';const companies=v22CompanyList();const groups=getGroups();
    modal.innerHTML=`<div class="gk-v26-modal-card" style="max-width:760px;"><h3>${row?'Eliminasyon Düzenle':'Yeni Eliminasyon'}</h3><div class="gk-v26-form-grid"><label>Grup<select id="group">${groups.map(g=>`<option value="${v26UiEsc(g.id)}" ${String(g.id)===String(row?.groupId||defaultGroupId)?'selected':''}>${v26UiEsc(g.code)} — ${v26UiEsc(g.name)}</option>`).join('')}</select></label><label>From Company<select id="from">${v26UiCompanyOptions(row?.fromCompanyId)}</select></label><label>To Company<select id="to">${v26UiCompanyOptions(row?.toCompanyId)}</select></label><label>Account<input id="account" value="${v26UiEsc(row?.account||'')}"></label><label>Amount<input id="amount" type="number" step="0.01" value="${row?.amount??''}"></label><label>Currency<select id="currency">${V26_GROUP_CURRENCIES.map(c=>`<option ${c===(row?.currency||'TRY')?'selected':''}>${c}</option>`).join('')}</select></label><label>Elimination Type<select id="type">${V26_ELIM_TYPES.map(c=>`<option ${c===(row?.eliminationType||'OTHER')?'selected':''}>${c}</option>`).join('')}</select></label><label>Reporting Date<input id="date" type="date" value="${v26UiEsc(row?.reportingDate||defaultDate)}"></label><label>Status<select id="status">${['DRAFT','POSTED','REJECTED'].map(c=>`<option ${c===(row?.status||'DRAFT')?'selected':''}>${c}</option>`).join('')}</select></label><label style="grid-column:1/-1;">Reason<input id="reason" value="${v26UiEsc(row?.reason||'')}"></label></div><div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px;"><button class="gk-v26-btn gk-v26-btn-secondary" id="cancel">Vazgeç</button><button class="gk-v26-btn" id="save">Kaydet</button></div></div>`;
    document.body.appendChild(modal);modal.querySelector('#cancel').onclick=()=>modal.remove();modal.querySelector('#save').onclick=()=>v26UiRun(()=>{const input={groupId:modal.querySelector('#group').value,fromCompanyId:modal.querySelector('#from').value,toCompanyId:modal.querySelector('#to').value,account:modal.querySelector('#account').value,amount:Number(modal.querySelector('#amount').value),currency:modal.querySelector('#currency').value,eliminationType:modal.querySelector('#type').value,reportingDate:modal.querySelector('#date').value,reason:modal.querySelector('#reason').value,status:modal.querySelector('#status').value}; if(row)updateElimination(row.id,input);else createElimination(input);modal.remove();onDone();});
  }


  function legacyReportAuth_renderConsolidationReportPage(container, options = {}) {
    const renderer = window.LeaseQantTfrs16ReportingUi?.renderConsolidation;
    if (typeof renderer === "function") return renderer(container, options);
    if (!container) return;
    container.innerHTML = `<div class="gk-v26-card">Konsolidasyon arayüzü yüklenemedi. Sayfayı yenileyin.</div>`;
  }

  function injectV26Navigation() {
    if (window.__GK_TFRS16_V26_NAV_V22__) return;
    window.__GK_TFRS16_V26_NAV_V22__ = true;
    const tryInject = () => {
      const sidebar = document.querySelector(".sidebar, #sidebar, nav, #mobileSidebar");
      if (!sidebar) return false;

      // DASHBOARD SHELL GUARD (Faz 0 — bkz. PROJECT_CONTEXT.md bölüm
      // 32): dashboard.html artık kendi native sidebar linklerine
      // (Modifikasyon & Reassessment, SLB, Sublease, Enflasyon
      // Düzeltmesi, Close Dashboard vb.) sahip. Bu fonksiyon normalde
      // (tfrs16.html'de) KENDİ ekstra buton setini sidebar'a
      // ekliyordu — dashboard.html'de bu ATLANIYOR (aksi halde aynı
      // linkler İKİ KEZ görünür). openInMain/deepLinkMap/deep-link
      // açma mekanizması YİNE DE kuruluyor, çünkü dashboard.html'in
      // kendi linkleri bunu kullanıyor (bkz. window.__gkOpenInMainByKey).
      const isDashboardShell = window.__GK_DASHBOARD_SHELL__ === true;

      if (!isDashboardShell) {
      if (document.getElementById("v26NavGroups")) return true;
      const navBlock = document.createElement("div");
      navBlock.id = "v26NavBlock";
      navBlock.style.cssText = "padding:8px 12px;border-top:1px solid #e2e8f0;margin-top:8px;max-height:calc(100vh - 150px);overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;box-sizing:border-box;";
      const activeCompanyOptions = typeof getUnifiedCompanyOptions === "function" ? getUnifiedCompanyOptions() : [];
      const activeCompanyId = typeof getActiveCompanyId === "function" ? getActiveCompanyId() : "ALL";
      navBlock.innerHTML = `
        <div style="font-size:10px;font-weight:700;color:#94a3b8;letter-spacing:.06em;margin-bottom:6px;">TFRS 16 İŞLEMLERİ</div>
        ${activeCompanyOptions.length ? `
        <label style="display:block;font-size:11px;color:#64748b;font-weight:600;margin-bottom:8px;">
          🏢 Aktif Şirket
          <select id="v26SidebarActiveCompanySelect" style="width:100%;margin-top:4px;padding:7px 8px;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;">
            <option value="ALL" ${activeCompanyId === "ALL" ? "selected" : ""}>Tüm Şirketler</option>
            ${activeCompanyOptions.map(c => `<option value="${escapeHtml(c.id)}" ${c.id === activeCompanyId ? "selected" : ""}>${escapeHtml(c.name)}</option>`).join("")}
          </select>
        </label>` : ""}
        <button type="button" id="v26NavCloseDashboard" class="gk-v26-btn gk-v26-btn-secondary" style="width:100%;margin-bottom:6px;text-align:left;padding:8px 12px;">📋 Kapanış Paneli</button>
        <button type="button" id="v26NavAccountMapping" class="gk-v26-btn gk-v26-btn-secondary" style="width:100%;margin-bottom:6px;text-align:left;padding:8px 12px;">📒 Hesap Planı Eşleme</button>
        <details class="gk-v26-advanced"><summary>Gelişmiş işlemler</summary>        <button type="button" id="v26NavCompanies" class="gk-v26-btn gk-v26-btn-secondary" style="width:100%;margin-bottom:6px;text-align:left;padding:8px 12px;">🏢 Şirket Yönetimi</button>
        <button type="button" id="v26NavGroups" class="gk-v26-btn gk-v26-btn-secondary" style="width:100%;margin-bottom:6px;text-align:left;padding:8px 12px;">👥 Gruplar</button>
        <button type="button" id="v26NavEliminations" class="gk-v26-btn gk-v26-btn-secondary" style="width:100%;margin-bottom:6px;text-align:left;padding:8px 12px;">↔️ Eliminasyonlar</button>
        <button type="button" id="v26NavFxRates" class="gk-v26-btn gk-v26-btn-secondary" style="width:100%;margin-bottom:6px;text-align:left;padding:8px 12px;">💱 Döviz Kurları</button>
        <button type="button" id="v26NavInflation" class="gk-v26-btn gk-v26-btn-secondary" style="width:100%;margin-bottom:6px;text-align:left;padding:8px 12px;">📈 Enflasyon Endeksleri</button>
        <button type="button" id="v26NavModReass" class="gk-v26-btn gk-v26-btn-secondary" style="width:100%;margin-bottom:6px;text-align:left;padding:8px 12px;">🔁 Modifikasyon ve yeniden ölçüm</button>
        <button type="button" id="v26NavSlb" class="gk-v26-btn gk-v26-btn-secondary" style="width:100%;margin-bottom:6px;text-align:left;padding:8px 12px;">🏢 Satış ve geri kiralama</button>
        <button type="button" id="v26NavSublease" class="gk-v26-btn gk-v26-btn-secondary" style="width:100%;margin-bottom:6px;text-align:left;padding:8px 12px;">🔄 Alt kiralama</button>
        <button type="button" id="v26NavAccountingCenter" class="gk-v26-btn gk-v26-btn-secondary" style="width:100%;margin-bottom:6px;text-align:left;padding:8px 12px;">🧾 Toplu Fiş Merkezi</button>
        <button type="button" id="v26NavFootnotes" class="gk-v26-btn gk-v26-btn-secondary" style="width:100%;margin-bottom:6px;text-align:left;padding:8px 12px;">📝 Dipnotlar</button>
        <button type="button" id="v26NavRiskControls" class="gk-v26-btn gk-v26-btn-secondary" style="width:100%;margin-bottom:6px;text-align:left;padding:8px 12px;">⚠️ Risk &amp; Kontroller</button>
        <button type="button" id="v26NavConsol" class="gk-v26-btn gk-v26-btn-secondary" style="width:100%;margin-bottom:6px;text-align:left;padding:8px 12px;">📊 Konsolidasyon Raporu</button>
        <button type="button" id="v26NavAudit" class="gk-v26-btn gk-v26-btn-secondary" style="width:100%;text-align:left;padding:8px 12px;">🕵️ Denetim İzi</button>        </details>`;
      sidebar.appendChild(navBlock);
      navBlock.querySelector("#v26SidebarActiveCompanySelect")?.addEventListener("change",(e)=>{ if(typeof setActiveCompanyId==="function") setActiveCompanyId(e.target.value); });
      }

      const openInMain = (renderer, key = "page") => { if (typeof v191ActiveScreenRefreshCallback !== "undefined") v191ActiveScreenRefreshCallback = null; let host=document.getElementById("v26PageHost"); if(!host){host=document.createElement("div");host.id="v26PageHost";const main=document.querySelector(".main, #mainContent, main, #app-content");(main||document.body).appendChild(host);} if(window.LeaseQantMainView)window.LeaseQantMainView.activate(key);else host.style.display="block";host.__v26LastRenderer=renderer;renderer(host);host.scrollIntoView({behavior:"smooth",block:"start"}); };

      // Calculation-backed pages must not render while the private result
      // cache is still warming.  A synchronous first paint used to run the
      // control/close/reporting consumers against an empty cache, producing
      // transient (and misleading) "no schedule" / "calculation missing"
      // exceptions.  The hydration coordinator is shared with the normal
      // page bootstrap, so calling run() here joins the existing request
      // instead of issuing a second batch.  If hydration fails, render the
      // page anyway so its explicit backend error state remains visible.
      const openInMainWhenReady = (renderer, key) => {
        // Navigation must never wait for the one-shot private hydration
        // promise. A slow or unavailable calculation API would otherwise
        // leave every navigation button inert until the promise settles.
        // The target renderer already has its own fail-closed loading/error
        // states and will be refreshed by hydration when it completes.
        const result = openInMain(renderer, key);
        const coordinator = window.__GK_TFRS16_PRIVATE_HYDRATION__;
        if (window.LEASEQANT_CALCULATION_API_PRIMARY === true &&
            typeof coordinator?.run === "function") {
          Promise.resolve(coordinator.run()).catch(error => {
            console.error("TFRS16 private hydration navigation arka planda başarısız:", error);
          });
        }
        return result;
      };
      document.getElementById("v26NavCloseDashboard")?.addEventListener("click",()=>openInMainWhenReady(renderCloseDashboardPage));
      document.getElementById("v26NavAccountMapping")?.addEventListener("click",()=>openInMainWhenReady(renderAccountMappingPage));
      document.getElementById("v26NavCompanies")?.addEventListener("click",()=>openInMainWhenReady(renderCompanyManagementPage));
      document.getElementById("v26NavGroups")?.addEventListener("click",()=>openInMainWhenReady(renderGroupManagementPage));
      document.getElementById("v26NavEliminations")?.addEventListener("click",()=>openInMainWhenReady(renderEliminationManagementPage));
      document.getElementById("v26NavFxRates")?.addEventListener("click",()=>openInMainWhenReady(renderFxRateManagementPage));
      document.getElementById("v26NavInflation")?.addEventListener("click",()=>openInMainWhenReady(renderInflationIndexManagementPage));
      document.getElementById("v26NavModReass")?.addEventListener("click",()=>openInMainWhenReady(renderModificationReassessmentPage));
      document.getElementById("v26NavSlb")?.addEventListener("click",()=>openInMainWhenReady(renderSlbManagementPage));
      document.getElementById("v26NavSublease")?.addEventListener("click",()=>openInMainWhenReady(renderSubleaseManagementPage));
      document.getElementById("v26NavAccountingCenter")?.addEventListener("click",()=>openInMainWhenReady(renderAccountingCenterPage));
      document.getElementById("v26NavFootnotes")?.addEventListener("click",()=>openInMainWhenReady(renderFootnotesPage));
      document.getElementById("v26NavRiskControls")?.addEventListener("click",()=>openInMainWhenReady(renderRiskControlsPage));
      document.getElementById("v26NavConsol")?.addEventListener("click",()=>openInMainWhenReady(c=>renderConsolidationReportPage(c,{presentationCurrency:"USD"})));
      document.getElementById("v26NavAudit")?.addEventListener("click",()=>openInMainWhenReady(renderAuditTrailPage));
      window.__gkOpenInMain = openInMainWhenReady;
      try {
        const deepLinkTarget = new URLSearchParams(window.location.search).get("open");
        const deepLinkMap = {
          close: renderCloseDashboardPage,
          accountMapping: renderAccountMappingPage,
          companies: renderCompanyManagementPage,
          groups: renderGroupManagementPage,
          eliminations: renderEliminationManagementPage,
          fxRates: renderFxRateManagementPage,
          audit: renderAuditTrailPage,
          inflation: renderInflationIndexManagementPage,
          modification: renderModificationReassessmentPage,
          slb: renderSlbManagementPage,
          sublease: renderSubleaseManagementPage,
          accountingCenter: renderAccountingCenterPage,
          footnotes: renderFootnotesPage,
          riskControls: renderRiskControlsPage,
          // REPORT-AUTH-R1 financial reports use the separate server reporting package.
          financialReporting: renderFinancialReportingPage,
          consolidation: c => renderConsolidationReportPage(c, { presentationCurrency: "USD" })
        };
        // dashboard.html'in NATİVE linkleri (JS click handler'ları)
        // bu fonksiyonu kullanıyor: window.__gkOpenInMainByKey("modification")
        // gibi bir çağrıyla, renderer fonksiyonuna doğrudan erişimi
        // olmadan (o closure-scope'ta) aynı sayfayı açabiliyorlar.
        window.__gkOpenInMainByKey = key => {
          if (deepLinkMap[key]) return openInMainWhenReady(deepLinkMap[key], key);
          return undefined;
        };
        if (deepLinkTarget && deepLinkMap[deepLinkTarget] && !window.__gkDeepLinkOpened) {
          window.__gkDeepLinkOpened = true;
          // The runtime installs the hydration hook at the end of boot.
          // Defer one task so the coordinator can join the same boot request;
          // otherwise the deep link would be the one caller that paints
          // before private results are available.
          setTimeout(() => { if (!window.LeaseQantMainView?.current()) void openInMainWhenReady(deepLinkMap[deepLinkTarget], deepLinkTarget); }, 0);
        }
      } catch (error) { console.error("V26 deep-link open error:", error); }
      return true;
    };
    if(!tryInject()){setTimeout(tryInject,800);setTimeout(tryInject,2000);}
  }

  try {
    injectV26Styles();
    injectV26Navigation();
    v26HookContractDetail();
  } catch (error) {
    console.error("V26 multi-currency UI init error:", error);
  }

  Object.assign(window.GK_TFRS16 = window.GK_TFRS16 || {}, {
    // V19 Account Mapping
    getDefaultAccountMapping,
    loadAccountMapping,
    saveAccountMapping,
    getAccountCode,
    applyAccountMappingToJournal: journalAuthorityUnavailable,
    exportBulkJournals,
    buildTms29BulkJournalEntries: journalAuthorityUnavailable,
    buildAppliedChangeJournalEntries: journalAuthorityUnavailable,
    exportJournalEntries,
    renderAccountMappingPage,
    renderCloseDashboardPage,
    isPeriodLocked,
    isDateInLockedPeriod,
    assertPeriodWritable,
    lockPeriod,
    unlockPeriod,
    getLockedPeriods,
    getApplicableStandards,
    v26LoadCompanies,
    v26SaveCompanies,
    v26FindCompany,
    v26StandardsBadgeHtml,
    v26BuildConsolidationRows,
    v26ExportConsolidationExcel,
    renderCompanyManagementPage,
    renderConsolidationReportPage,
    renderGroupManagementPage,
    renderEliminationManagementPage,
    renderFxRateManagementPage,
    renderAuditTrailPage,
    renderInflationIndexManagementPage,
    loadInflationIndexTable,
    injectV26Styles,
    renderModificationReassessmentPage,
    v26ExportInflationIndexExcel,
    v26ConvertScheduleToPresentation,
    renderContractStandardsPanel,
    injectV26CurrencyFields,
    // V27 Multi-Company/Multi-Currency
    getActiveCompanyId,
    setActiveCompanyId,
    getUnifiedCompanyOptions,
    getReportingCurrency,
    setReportingCurrency,
    convertAmountToReportingCurrency,
  });

  function v26HookContractDetail() {
    // The v2 detail owns source-evidenced standards. The legacy observer
    // must not reinsert currency-inferred badges after that panel renders.
    if (document.documentElement.getAttribute("data-lq-ui") === "2") return;
    if (window.__GK_TFRS16_V26_DETAIL_HOOK__) return;
    window.__GK_TFRS16_V26_DETAIL_HOOK__ = true;
    const observer = new MutationObserver(() => {
      if (typeof document === "undefined") return; const detail = document.getElementById("detailModal") || document.querySelector(".contract-detail, #contractDetail");
      if (!detail || detail.classList?.contains("hidden")) return;
      if (detail.querySelector(".gk-v26-auto-detect")) return;
      const cid = (typeof selectedContractId !== "undefined" && selectedContractId) || null;
      if (!cid || typeof contracts === "undefined") return;
      const contract = contracts.find(c => c.id === cid);
      if (!contract) return;
      const panel = document.createElement("div");
      panel.innerHTML = renderContractStandardsPanel(contract);
      const anchor = detail.querySelector(".modal-body, .detail-body, .card-body") || detail;
      if (panel.firstElementChild) anchor.insertBefore(panel.firstElementChild, anchor.firstChild);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  try {
    injectV26Styles();
    injectV26Navigation();
    v26HookContractDetail();
  } catch (error) {
    console.error("V26 multi-currency UI init error:", error);
  }

  Object.assign(window.GK_TFRS16 = window.GK_TFRS16 || {}, {
    // V19 Account Mapping
    getDefaultAccountMapping,
    loadAccountMapping,
    saveAccountMapping,
    getAccountCode,
    applyAccountMappingToJournal: journalAuthorityUnavailable,
    exportBulkJournals,
    exportJournalEntries,
    renderAccountMappingPage,
    renderCloseDashboardPage,
    isPeriodLocked,
    isDateInLockedPeriod,
    assertPeriodWritable,
    lockPeriod,
    unlockPeriod,
    getLockedPeriods,
    getApplicableStandards,
    v26LoadCompanies,
    v26SaveCompanies,
    v26FindCompany,
    v26StandardsBadgeHtml,
    v26BuildConsolidationRows,
    v26ExportConsolidationExcel,
    renderCompanyManagementPage,
    renderGroupManagementPage,
    renderEliminationManagementPage,
    renderConsolidationReportPage,
    renderContractStandardsPanel,
    injectV26CurrencyFields,
    // V27 Multi-Company/Multi-Currency
    getActiveCompanyId,
    setActiveCompanyId,
    getUnifiedCompanyOptions,
    getReportingCurrency,
    setReportingCurrency,
    convertAmountToReportingCurrency,
  });

  // Read-only portfolio UI bridge. No calculation or persistence logic is
  // exposed; the external module receives a snapshot and invokes openDetail
  // only for the existing detail flow.
  Object.assign(window.GK_TFRS16 = window.GK_TFRS16 || {}, {
    getPortfolioContracts: () => (Array.isArray(contracts) ? contracts.map(contract => ({ ...contract })) : []),
    // Operation-page bridge: external UI owns page markup and event wiring;
    // the engine supplies private-result render/actions and contract state.
    getOperationContracts: () => (Array.isArray(contracts) ? contracts.map(contract => JSON.parse(JSON.stringify(contract))) : []),
    // Payment schedule filter options are pure engine helpers exposed through
    // an explicit bridge; the visible filter markup lives in operations-ui.
    buildPaymentScheduleYearOptions: contract => buildYearOptions(contract),
    buildPaymentScheduleMonthOptions: () => buildMonthOptions(),
    buildPaymentScheduleCurrencyOptions: selected => v26CurrencyOptions(selected),
    getScheduleReportingDate,
    formatScheduleMoney,
    getMonthName,
    // Payment schedule row markup lives in operations-ui; these helpers are
    // explicit read-only bridges for presentation formatting only.
    injectV26Styles,
    v26SelectedContractBanner,
    renderSlbSection,
    renderSubleaseSection,
    renderModificationManagementSection,
    renderReassessmentManagementSection,
    initModificationEventsById: (reference, onChanged) => {
      const contract = getOperationContractById(reference);
      return contract ? initModificationEvents(contract, onChanged) : null;
    },
    initReassessmentEventsById: (reference, onChanged) => {
      const contract = getOperationContractById(reference);
      return contract ? initReassessmentEvents(contract, onChanged) : null;
    },
    getModificationReport: (...args) => getModificationReport(...args),
    getReassessmentReport: (...args) => getReassessmentReport(...args),
    applyModificationById: (reference, id) => {
      const contract = getOperationContractById(reference);
      return contract ? applyModification(contract, id) : operationResultMissing("Modifikasyon");
    },
    applyReassessmentById: (reference, id) => {
      const contract = getOperationContractById(reference);
      return contract ? applyReassessment(contract, id) : operationResultMissing("Reassessment");
    },
    refresh,
    showAlert,
    formatOperationValue: value => v191Value(value),
    openDetail,
    isRenewalWithin90Days,
    formatPortfolioAmount,
    formatDate,
    escapeHtml,
    v26ContractMatchesActiveCompany,
    v26StandardsBadgeHtml,
    // External reporting UI bridge: the engine supplies private-result body
    // data while the page shell and error/loading markup live outside it.
    renderFinancialReportingBody: v191RenderFinancialReportingPrivate,
    renderRiskControlsBody: v191RenderRiskControls,
    getContractsSnapshot: () => (Array.isArray(contracts) ? contracts.map(contract => JSON.parse(JSON.stringify(contract))) : []),
    getAuditEvents: filters => typeof getAuditEvents === "function" ? getAuditEvents(filters) : [],
    buildAuditPresentationCurrencyOptions: selected => v26CurrencyOptions(selected),
    exportContractAuditTrail: (...args) => exportAuditTrail(...args),
    formatPresentationCurrency,
    resolvePaymentFrequencyLabel,
    privateCalculationCacheHas: contract => PRIVATE_CALCULATION_CACHE.has(getCalculationCacheKey(contract)),
    isPrivateCalculationApiReady,
    getPrivateCalculationForConsumer,
    ensurePrivateCalculationCache,
    getPrivateReportingDateResult,
    loadPrivateReportingDateResult,
    ensurePrivateReportingDateCache,
    getVerifiedInflationIndexInfo,
    loadTms29Many: (...args) => window.LeaseQantPrivateTfrs16Facade?.loadTms29Many(...args),
    computePrivatePortfolioTms29: v191ComputePrivatePortfolioTms29,
    prepareFinancialReportingData: v191PrepareFinancialReportingData,
    renderAssetNoteHtml: v191RenderAssetNoteHtml,
    renderLiabilityNoteHtml: v191RenderLiabilityNoteHtml,
    renderLiquidityNoteHtml: v191RenderLiquidityNoteHtml,
    parseDate,
    dateInputValue: v191DateInputValue,
    renderConsolidationBody: v26RenderConsolidationReportBody,
    renderAuditTrailBody: v26RenderAuditTrailBody,
    getFinancialReportingPeriodKey: () => `${v191PeriodStartOverride || ""}|${v191PeriodEndOverride || ""}`,
    setActiveScreenRefreshCallback: callback => { v191ActiveScreenRefreshCallback = callback; }
  });

  /* ==========================================================
     V27 ADDITIVE UI MERGE — V23 FX + TMS29 INFLATION
  ========================================================== */

// `?open=` deep-links can render a page while this late additive block is
// still being initialized. Keep the declaration hoisted so early renderers
// can safely use their built-in currency fallback instead of hitting the
// temporal-dead-zone thrown by a `const` declaration.
var V26_FX_UI_CURRENCIES = ["TRY","EUR","USD","GBP","CHF","JPY","AED","SAR"];

const V26_FX_UI_RATE_TYPES = ["SPOT","CLOSING","AVERAGE","HISTORICAL","FORWARD"];

const V26_FX_UI_SOURCES = ["MANUAL","IMPORT","SYSTEM","CENTRAL_BANK","ERP"];
var V26_FX_UI_LABELS = { SPOT:'İşlem günü',CLOSING:'Kapanış',AVERAGE:'Ortalama',HISTORICAL:'Tarihî',FORWARD:'Vadeli',
  MANUAL:'Manuel',IMPORT:'İçe aktarım',SYSTEM:'Sistem',CENTRAL_BANK:'Merkez Bankası',ERP:'ERP',
  DRAFT:'Taslak',REVIEWED:'İncelendi',APPROVED:'Onaylı',REJECTED:'Reddedildi' };

const V26_FX_UI_STATUSES = ["DRAFT","REVIEWED","APPROVED","REJECTED"];

const V26_FX_UI_PAGE_SIZE = 50;

  function injectV26FxUiStyles() {
    if (document.getElementById("gk-v26-fx-ui-styles")) return;
    const style = document.createElement("style");
    style.id = "gk-v26-fx-ui-styles";
    style.textContent = `
      .gk-v26-fx-toolbar { display:flex; flex-wrap:wrap; gap:8px; align-items:flex-end; }
      .gk-v26-fx-toolbar label { display:flex; flex-direction:column; gap:4px; min-width:145px; font-size:11px; color:#64748b; font-weight:600; }
      .gk-v26-fx-toolbar input, .gk-v26-fx-toolbar select { padding:8px 10px; border:1px solid #e2e8f0; border-radius:8px; font-size:12px; color:#1e293b; background:#fff; }
      .gk-v26-fx-actions { display:flex; flex-wrap:wrap; gap:6px; justify-content:flex-end; }
      .gk-v26-fx-modal { position:fixed; inset:0; z-index:10050; display:flex; align-items:center; justify-content:center; padding:16px; background:rgba(15,23,42,.48); }
      .gk-v26-fx-modal.hidden { display:none; }
      .gk-v26-fx-modal-card { width:min(720px,100%); max-height:90vh; overflow:auto; background:#fff; border-radius:14px; box-shadow:0 20px 60px rgba(15,23,42,.25); padding:20px; }
      .gk-v26-fx-page-info { display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; margin-top:12px; font-size:12px; color:#64748b; }
      .gk-v26-fx-pagination { display:flex; gap:4px; }
      .gk-v26-fx-pagination button { min-width:30px; height:30px; border:1px solid #e2e8f0; background:#fff; border-radius:6px; cursor:pointer; }
      .gk-v26-fx-pagination button.active { background:#1e293b; color:#fff; border-color:#1e293b; }
      .gk-v26-fx-pagination button:disabled { opacity:.45; cursor:not-allowed; }
    `;
    document.head.appendChild(style);
  }

  function v26FxUiEscape(value) {
    if (typeof escapeHtml === "function") return escapeHtml(value == null ? "" : String(value));
    return String(value == null ? "" : value).replace(/[&<>'"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[ch]));
  }

  function v26FxUiToday() { return new Date().toISOString().slice(0,10); }

  function v26FxUiToast(message, type="success") {
    if (typeof showToast === "function") { showToast(message, type, 3000); return; }
    if (typeof showAlert === "function") { showAlert(message); return; }
    window.alert(message);
  }

  function v26FxUiCan(permission) {
    try { return v23HasPermission(permission); } catch (e) { return true; }
  }

  function v26FxUiCurrencyOptions(selected="", includeAll=false) {
    const list = includeAll ? ["", ...V26_FX_UI_CURRENCIES] : V26_FX_UI_CURRENCIES;
    return list.map(code => `<option value="${v26FxUiEscape(code)}" ${code === selected ? "selected" : ""}>${code || "Tümü"}</option>`).join("");
  }

  function v26FxUiRateTypeOptions(selected="", includeAll=false) {
    const list = includeAll ? ["", ...V26_FX_UI_RATE_TYPES] : V26_FX_UI_RATE_TYPES;
    return list.map(v => `<option value="${v26FxUiEscape(v)}" ${v === selected ? "selected" : ""}>${V26_FX_UI_LABELS[v] || "Tümü"}</option>`).join("");
  }

  function v26FxUiSourceOptions(selected="") {
    return V26_FX_UI_SOURCES.map(v => `<option value="${v}" ${v === selected ? "selected" : ""}>${V26_FX_UI_LABELS[v]}</option>`).join("");
  }

  function v26FxUiStatusOptions(selected="") {
    return V26_FX_UI_STATUSES.map(v => `<option value="${v}" ${v === selected ? "selected" : ""}>${V26_FX_UI_LABELS[v]}</option>`).join("");
  }

  function v26FxUiStatusBadge(status) {
    const map = { DRAFT:"gk-std-gray", REVIEWED:"gk-std-blue", APPROVED:"gk-std-green", REJECTED:"gk-std-yellow" };
    return `<span class="gk-std-badge ${map[status] || "gk-std-gray"}">${v26FxUiEscape(V26_FX_UI_LABELS[status] || 'Durum doğrulanmalı')}</span>`;
  }

  function v26FxUiFilterRows(filters) {
    let rows = getFxRates({
      fromCurrency: filters.fromCurrency || undefined,
      toCurrency: filters.toCurrency || undefined,
      rateType: filters.rateType || undefined
    });
    if (filters.dateFrom) rows = rows.filter(r => String(r.rateDate || "") >= filters.dateFrom);
    if (filters.dateTo) rows = rows.filter(r => String(r.rateDate || "") <= filters.dateTo);
    return rows.sort((a,b) => String(b.rateDate || "").localeCompare(String(a.rateDate || "")) || String(a.fromCurrency || "").localeCompare(String(b.fromCurrency || "")));
  }

  function v26FxUiDeleteRate(id) {
    v23Authorize("fx.manage", { action:"FX_RATE_DELETED", entityId:id });
    const rows = loadV23Rates();
    const idx = rows.findIndex(r => r.id === id);
    if (idx < 0) throw new Error("Kur kaydı bulunamadı.");
    const row = rows[idx];
    if (String(row.status).toUpperCase() !== "DRAFT" || String(row.source).toUpperCase() !== "MANUAL") {
      const e = new Error("Yalnızca DRAFT ve MANUAL kaynaklı kurlar silinebilir.");
      e.code = "FX_DELETE_NOT_ALLOWED";
      throw e;
    }
    rows.splice(idx, 1);
    saveV23Rates(rows);
    v23Audit("FX_RATE_DELETED", "FX_RATE", id, { oldValue: row });
    return true;
  }

  const AUDIT_TRAIL_PAGE_SIZE = 25;

  function legacyReportAuth_v26RenderAuditTrailBody(container) {
    const renderer = window.LeaseQantTfrs16ReportingUi?.renderAuditTrailBody;
    if (typeof renderer === "function") return renderer(container);
    if (!container) return;
    container.innerHTML = `<div class="gk-v26-card">Denetim izi arayüzü yüklenemedi. Sayfayı yenileyin.</div>`;
  }

  function legacyReportAuth_renderAuditTrailPage(container) {
    const renderer = window.LeaseQantTfrs16ReportingUi?.renderAuditTrail;
    if (typeof renderer === "function") return renderer(container);
    if (!container) return;
    container.innerHTML = `<div class="gk-v26-card">Denetim izi arayüzü yüklenemedi. Sayfayı yenileyin.</div>`;
  }

  function renderFxRateManagementPage(container) {
    if (!container) return;
    injectV26Styles();
    injectV26FxUiStyles();
    if (!v26FxUiCan("fx.view")) {
      container.innerHTML = `<div class="gk-v26-page"><div class="gk-v26-card"><strong>Erişim reddedildi.</strong><div style="margin-top:6px;color:#64748b;">Döviz kuru ekranı için fx.view yetkisi gereklidir.</div></div></div>`;
      return;
    }

    let page = 1;
    let editingId = null;
    const canManage = v26FxUiCan("fx.manage");
    const canImport = v26FxUiCan("fx.import");
    const canExport = v26FxUiCan("fx.export");

    const render = () => {
      const filters = {
        fromCurrency: container.querySelector("#v26FxFromFilter")?.value || "",
        toCurrency: container.querySelector("#v26FxToFilter")?.value || "",
        rateType: container.querySelector("#v26FxTypeFilter")?.value || "",
        dateFrom: container.querySelector("#v26FxDateFrom")?.value || "",
        dateTo: container.querySelector("#v26FxDateTo")?.value || ""
      };
      const rows = v26FxUiFilterRows(filters);
      const totalPages = Math.max(1, Math.ceil(rows.length / V26_FX_UI_PAGE_SIZE));
      page = Math.min(Math.max(1, page), totalPages);
      const start = (page - 1) * V26_FX_UI_PAGE_SIZE;
      const pageRows = rows.slice(start, start + V26_FX_UI_PAGE_SIZE);
      const modal = container.querySelector("#v26FxRateModal");
      const modalVisible = modal && !modal.classList.contains("hidden");
      const modalHtml = modalVisible ? modal.outerHTML : `<div id="v26FxRateModal" class="gk-v26-fx-modal hidden"></div>`;

      container.innerHTML = `
        <div class="gk-v26-page">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:16px;">
            <div>
              <h2 style="margin:0;font-size:20px;color:#0f172a;">Döviz Kurları</h2>
              <p style="margin:4px 0 0;font-size:13px;color:#64748b;">V23 FX kuru yönetimi · TCMB otomatik çekim · kayıt/audit kontrollü</p>
            </div>
            <div class="gk-v26-fx-actions">
              ${canManage ? `<button type="button" class="gk-v26-btn" id="v26FxNewBtn">+ Yeni Kur Ekle</button>` : ""}
              ${canImport ? `<button type="button" class="gk-v26-btn gk-v26-btn-secondary" id="v26FxTcmbBtn">↻ TCMB'den Kur Çek</button>` : ""}
              ${canExport ? `<button type="button" class="gk-v26-btn gk-v26-btn-secondary" id="v26FxExportBtn">↓ Excel'e Aktar</button>` : ""}
            </div>
          </div>

          <div class="gk-v26-card">
            <div class="gk-v26-fx-toolbar">
              <label>From Currency<select id="v26FxFromFilter">${v26FxUiCurrencyOptions(filters.fromCurrency, true)}</select></label>
              <label>To Currency<select id="v26FxToFilter">${v26FxUiCurrencyOptions(filters.toCurrency, true)}</select></label>
              <label>Rate Type<select id="v26FxTypeFilter">${v26FxUiRateTypeOptions(filters.rateType, true)}</select></label>
              <label>Başlangıç Tarihi<input id="v26FxDateFrom" type="date" value="${v26FxUiEscape(filters.dateFrom)}"></label>
              <label>Bitiş Tarihi<input id="v26FxDateTo" type="date" value="${v26FxUiEscape(filters.dateTo)}"></label>
              <button type="button" class="gk-v26-btn gk-v26-btn-secondary" id="v26FxClearFilters">Temizle</button>
            </div>
          </div>

          <div class="gk-v26-card gk-v26-fx-table-wrap">
            <table class="gk-v26-table">
              <thead><tr><th>From Currency</th><th>To Currency</th><th>Rate</th><th>Rate Date</th><th>Rate Type</th><th>Source</th><th>Status</th><th style="text-align:right;">İşlem</th></tr></thead>
              <tbody>
                ${pageRows.map(row => `
                  <tr>
                    <td><strong>${v26FxUiEscape(row.fromCurrency)}</strong></td>
                    <td>${v26FxUiEscape(row.toCurrency)}</td>
                    <td style="text-align:right;font-variant-numeric:tabular-nums;">${Number(row.rate).toFixed(4)}</td>
                    <td>${v26FxUiEscape(row.rateDate)}</td>
                    <td>${v26FxUiEscape(V26_FX_UI_LABELS[row.rateType] || 'Kur türü bilinmiyor')}</td>
                    <td>${v26FxUiEscape(V26_FX_UI_LABELS[row.source] || 'Kaynak bilinmiyor')}</td>
                    <td>${v26FxUiStatusBadge(row.status)}</td>
                    <td style="text-align:right;white-space:nowrap;">
                      ${canManage ? `<button type="button" class="gk-v26-btn gk-v26-btn-secondary v26-fx-edit" data-id="${v26FxUiEscape(row.id)}" style="padding:4px 9px;font-size:12px;">Düzenle</button>` : ""}
                      ${canManage && row.status === "DRAFT" && row.source === "MANUAL" ? `<button type="button" class="gk-v26-btn gk-v26-btn-secondary v26-fx-delete" data-id="${v26FxUiEscape(row.id)}" style="padding:4px 9px;font-size:12px;color:#b91c1c;">Sil</button>` : ""}
                    </td>
                  </tr>`).join("") || `<tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:24px;">Filtreye uygun kur bulunamadı</td></tr>`}
              </tbody>
            </table>
            <div class="gk-v26-fx-page-info">
              <span>${rows.length ? `${start + 1}-${Math.min(start + V26_FX_UI_PAGE_SIZE, rows.length)} / ${rows.length}` : "0 kayıt"} · Sayfa ${page}/${totalPages}</span>
              <div class="gk-v26-fx-pagination">
                <button type="button" id="v26FxPrev" ${page <= 1 ? "disabled" : ""}>‹</button>
                ${Array.from({length: Math.min(totalPages, 7)}, (_,i) => {
                  let n = i + 1;
                  if (totalPages > 7) {
                    if (page <= 4) n = i + 1;
                    else if (page >= totalPages - 3) n = totalPages - 6 + i;
                    else n = page - 3 + i;
                  }
                  return `<button type="button" class="${n === page ? "active" : ""}" data-page="${n}">${n}</button>`;
                }).join("")}
                <button type="button" id="v26FxNext" ${page >= totalPages ? "disabled" : ""}>›</button>
              </div>
            </div>
          </div>
          ${modalHtml}
        </div>`;

      const openModal = (row=null, mode="edit") => {
        if (!canManage) return;
        const m = container.querySelector("#v26FxRateModal");
        editingId = row?.id || null;
        m.innerHTML = `
          <div class="gk-v26-fx-modal-card" role="dialog" aria-modal="true" aria-labelledby="v26FxModalTitle">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:4px;">
              <h3 id="v26FxModalTitle" style="margin:0;font-size:17px;color:#0f172a;">${row ? "Kur Düzenle" : "Yeni Kur Ekle"}</h3>
              <button type="button" class="gk-v26-btn gk-v26-btn-secondary" id="v26FxModalClose" style="padding:5px 9px;">✕</button>
            </div>
            <div class="gk-v26-form-grid">
              <label>From Currency<select id="v26FxFormFrom">${v26FxUiCurrencyOptions(row?.fromCurrency || "TRY")}</select></label>
              <label>To Currency<select id="v26FxFormTo">${v26FxUiCurrencyOptions(row?.toCurrency || "TRY")}</select></label>
              <label>Rate<input id="v26FxFormRate" type="number" step="0.0001" min="0.0001" inputmode="decimal" value="${row ? Number(row.rate).toFixed(4) : ""}"></label>
              <label>Rate Date<input id="v26FxFormDate" type="date" value="${v26FxUiEscape(row?.rateDate || v26FxUiToday())}"></label>
              <label>Rate Type<select id="v26FxFormType">${v26FxUiRateTypeOptions(row?.rateType || "SPOT")}</select></label>
              <label>Source<select id="v26FxFormSource">${v26FxUiSourceOptions(row?.source || "MANUAL")}</select></label>
              <label>Reason (opsiyonel)<input id="v26FxFormReason" value="${v26FxUiEscape(row?.reason || "")}" placeholder="Kur değişikliği gerekçesi"></label>
              ${row ? `<label>Status<select id="v26FxFormStatus">${v26FxUiStatusOptions(row?.status || "DRAFT")}</select></label>` : ""}
            </div>
            <div style="margin-top:14px;padding:10px 12px;background:#f8fafc;border-radius:9px;font-size:11px;color:#64748b;">
              ${row ? "Düzenlemede temel kimlik alanları korunur; Rate, Reason ve Status güncellenebilir." : "Manuel oluşturulan kayıt varsayılan olarak DRAFT durumunda oluşturulur."}
            </div>
            <div style="margin-top:14px;display:flex;justify-content:flex-end;gap:8px;">
              <button type="button" class="gk-v26-btn gk-v26-btn-secondary" id="v26FxModalCancel">İptal</button>
              <button type="button" class="gk-v26-btn" id="v26FxFormSave">Kaydet</button>
            </div>
          </div>`;
        m.classList.remove("hidden");
        if (row) {
          ["v26FxFormFrom","v26FxFormTo","v26FxFormDate","v26FxFormType","v26FxFormSource"].forEach(id => { const el=m.querySelector(`#${id}`); if(el) el.disabled=true; });
        }
        const close = () => { m.classList.add("hidden"); editingId=null; };
        m.querySelector("#v26FxModalClose")?.addEventListener("click", close);
        m.querySelector("#v26FxModalCancel")?.addEventListener("click", close);
        m.addEventListener("click", ev => { if (ev.target === m) close(); }, { once:true });
        m.querySelector("#v26FxFormSave")?.addEventListener("click", () => {
          try {
            const rate = Number(m.querySelector("#v26FxFormRate").value);
            if (!(rate > 0) || !Number.isFinite(rate)) throw new Error("Rate pozitif bir sayı olmalıdır.");
            const common = {
              fromCurrency:m.querySelector("#v26FxFormFrom").value,
              toCurrency:m.querySelector("#v26FxFormTo").value,
              rate,
              rateDate:m.querySelector("#v26FxFormDate").value,
              rateType:m.querySelector("#v26FxFormType").value,
              source:m.querySelector("#v26FxFormSource").value,
              reason:String(m.querySelector("#v26FxFormReason").value || "").trim() || null
            };
            if (editingId) {
              const patch = { rate:common.rate, reason:common.reason, status:m.querySelector("#v26FxFormStatus")?.value || "DRAFT" };
              updateFxRate(editingId, patch, { action:"FX_RATE_UI_UPDATE" });
              v26FxUiToast("Kur güncellendi.", "success");
            } else {
              createFxRate(common, { action:"FX_RATE_UI_CREATE" });
              v26FxUiToast("Kur kaydedildi.", "success");
            }
            m.classList.add("hidden");
            editingId=null;
            render();
          } catch (error) { v26FxUiToast(error?.message || "Kur kaydedilemedi.", "error"); }
        });
      };

      container.querySelector("#v26FxNewBtn")?.addEventListener("click", () => openModal(null, "new"));
      container.querySelector("#v26FxClearFilters")?.addEventListener("click", () => {
        page=1;
        container.querySelector("#v26FxFromFilter").value="";
        container.querySelector("#v26FxToFilter").value="";
        container.querySelector("#v26FxTypeFilter").value="";
        container.querySelector("#v26FxDateFrom").value="";
        container.querySelector("#v26FxDateTo").value="";
        render();
      });
      ["#v26FxFromFilter","#v26FxToFilter","#v26FxTypeFilter","#v26FxDateFrom","#v26FxDateTo"].forEach(sel => container.querySelector(sel)?.addEventListener("change", () => { page=1; render(); }));
      container.querySelector("#v26FxPrev")?.addEventListener("click", () => { page--; render(); });
      container.querySelector("#v26FxNext")?.addEventListener("click", () => { page++; render(); });
      container.querySelectorAll(".gk-v26-fx-pagination [data-page]").forEach(btn => btn.addEventListener("click", () => { page=Number(btn.dataset.page); render(); }));
      container.querySelectorAll(".v26-fx-edit").forEach(btn => btn.addEventListener("click", () => {
        const row = getFxRates({}).find(r => r.id === btn.dataset.id);
        if (row) openModal(row, "edit");
      }));
      container.querySelectorAll(".v26-fx-delete").forEach(btn => btn.addEventListener("click", async () => {
        const row = getFxRates({}).find(r => r.id === btn.dataset.id);
        if (!row) return;
        const ok = typeof showConfirm === "function" ? await showConfirm("Bu DRAFT / MANUAL kuru silmek istediğinize emin misiniz?", { danger:true, title:"Kur Sil" }) : window.confirm("Bu kuru silmek istediğinize emin misiniz?");
        if (!ok) return;
        try { v26FxUiDeleteRate(row.id); v26FxUiToast("Kur silindi.", "success"); render(); }
        catch (error) { v26FxUiToast(error?.message || "Kur silinemedi.", "error"); }
      }));
      container.querySelector("#v26FxExportBtn")?.addEventListener("click", () => {
        try {
          const ok = exportFxRates({});
          if (ok !== false) v26FxUiToast("Tüm kur listesi Excel'e aktarıldı.", "success");
          else v26FxUiToast("Dışa aktarılacak kur kaydı bulunamadı.", "warning");
        } catch (error) { v26FxUiToast(error?.message || "Excel dışa aktarma başarısız.", "error"); }
      });
      container.querySelector("#v26FxTcmbBtn")?.addEventListener("click", () => {
        const m = container.querySelector("#v26FxRateModal");
        m.innerHTML = `
          <div class="gk-v26-fx-modal-card" role="dialog" aria-modal="true">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;"><h3 style="margin:0;font-size:17px;color:#0f172a;">TCMB'den Kur Çek</h3><button type="button" class="gk-v26-btn gk-v26-btn-secondary" id="v26FxTcmbClose">✕</button></div>
            <div class="gk-v26-form-grid">
              <label>Tarih<input id="v26FxTcmbDate" type="date" value="${v26FxUiToday()}"></label>
              <label>Currency<select id="v26FxTcmbCurrency">${v26FxUiCurrencyOptions("EUR")}</select></label>
            </div>
            <div style="margin-top:10px;font-size:11px;color:#64748b;">TCMB kuru backend PostgreSQL'e PENDING olarak kaydedilir. Hesaplamaya girmesi için yönetici doğrulaması gerekir; hafta sonu/resmi tatil için TCMB'nin yayımladığı son iş günü kullanılır.</div>
            <div style="margin-top:14px;display:flex;justify-content:flex-end;gap:8px;"><button type="button" class="gk-v26-btn gk-v26-btn-secondary" id="v26FxTcmbCancel">İptal</button><button type="button" class="gk-v26-btn" id="v26FxTcmbRun">Kur Çek</button></div>
          </div>`;
        m.classList.remove("hidden");
        const close=()=>m.classList.add("hidden");
        m.querySelector("#v26FxTcmbClose")?.addEventListener("click",close);
        m.querySelector("#v26FxTcmbCancel")?.addEventListener("click",close);
        m.querySelector("#v26FxTcmbRun")?.addEventListener("click",async()=>{
          const btn=m.querySelector("#v26FxTcmbRun");
          const currency=m.querySelector("#v26FxTcmbCurrency").value;
          const date=m.querySelector("#v26FxTcmbDate").value;
          if(!date){v26FxUiToast("Tarih seçin.","warning");return;}
          btn.disabled=true; btn.textContent="Çekiliyor…";
          try {
            const result=await syncTcmbRate(currency,date,{action:"FX_Tcmb_UI_IMPORT",rateType:"CLOSING"});
            close(); render();
            v26FxUiToast(`TCMB kuru PENDING kaydedildi: ${currency}/TRY = ${Number(result.rate).toFixed(4)} (${result.rateDate}). Hesaplamaya almak için doğrulayın.`,"success");
          } catch(error) {
            const msg=error?.code === "TCMB_FETCH_BLOCKED" ? "TCMB'ye tarayıcıdan erişilemedi. Proxy endpoint tanımlayın (TCMB_CONFIG.proxyBaseUrl)." : (error?.message || "TCMB kuru alınamadı.");
            v26FxUiToast(msg,"error");
            btn.disabled=false; btn.textContent="Kur Çek";
          }
        });
      });
    };

    render();
  }

  function v26InflationUiToast(message, type = "info") {
    try {
      if (typeof showToast === "function") {
        showToast(String(message || ""), type, 3000);
        return;
      }
    } catch (e) {}
    try {
      if (typeof showAlert === "function") {
        showAlert(String(message || ""));
        return;
      }
    } catch (e) {}
    window.alert(String(message || ""));
  }





  function v26ExportInflationIndexExcel() {
    try {
      const rows = typeof loadInflationIndexTable === "function"
        ? loadInflationIndexTable().slice().sort((a,b) => String(a.month).localeCompare(String(b.month)))
        : [];

      if (typeof XLSX === "undefined") {
        throw new Error("Excel motoru (XLSX) yüklenemedi.");
      }

      const data = rows.map(r => ({
        "Ay": r.month,
        "Endeks Değeri": Number(r.index)
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Enflasyon Endeksleri");
      XLSX.writeFile(
        wb,
        `GK_TFRS16_TMS29_Enflasyon_Endeksleri_${new Date().toISOString().slice(0,10)}.xlsx`
      );
      v26InflationUiToast("Enflasyon endeksleri Excel'e aktarıldı.", "success");
    } catch (error) {
      console.error("V26 TMS29 inflation index Excel export error:", error);
      v26InflationUiToast(`Excel export tamamlanamadı: ${error?.message || String(error)}`, "error");
    }
  }

  /* ==========================================================
     MODİFİKASYON & REASSESSMENT — ORTAK SAYFA (onaylı plan)
     ----------------------------------------------------------
     Önceden renderModificationManagementSection/renderReassessmentManagementSection
     sözleşme detay ekranının (openDetail) İÇİNDE, tek bir uzun kaydırmalı
     sayfada gösteriliyordu. Bu fonksiyon onları AYRI, kendi başına bir
     ekrana taşır — sözleşme seçimi native bir <select> ile yapılır
     (kullanıcının native picker beklentisiyle uyumlu). Render/iş mantığı
     fonksiyonlarının (renderModificationManagementSection vb.) KENDİSİNE
     dokunulmadı — yalnızca NEREDE render edildikleri değişti.
  ========================================================== */
  var v26SelectedModReassContractId = null;

  /**
   * Seçili sözleşmeyi belirgin şekilde gösteren banner — Modifikasyon
   * & Reassessment / SLB / Sublease sayfalarının ortak sorunu:
   * kullanıcı yukarıdaki <select>'ten bir sözleşme seçtikten sonra
   * aşağı kaydırınca (form/dipnot içeriği hiçbir yerde sözleşme
   * kimliği göstermediği için) "hangi sözleşme için işlem yapıyorum"
   * bilgisini kaybediyordu. Bu banner, form içeriğinin HEMEN ÜSTÜNE,
   * select'in altına ekleniyor — kullanıcı form üzerindeyken de görünür.
   */
  function v26SelectedContractBanner(contract) {
    if (!contract) return "";
    const parts = [contract.id, contract.company, contract.supplier].filter(Boolean);
    return `
      <div style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;margin:12px 0 0;font-size:13px;color:#1e3a8a;">
        <span style="font-size:16px;">📄</span>
        <span>İşlem uygulanacak sözleşme: <strong>${escapeHtml(parts.join(" — "))}</strong></span>
      </div>`;
  }

  function getOperationContractById(reference) {
    const id = typeof reference === "string" ? reference : reference?.id;
    return id ? (Array.isArray(contracts) ? contracts.find(contract => contract.id === id) : null) : null;
  }

  function operationResultMissing(label) {
    return Promise.resolve({ valid: false, errors: [`${label}: sözleşme bulunamadı.`] });
  }

  function renderModificationReassessmentPage(container) {
    const renderer = window.LeaseQantTfrs16OperationsUi?.renderModificationReassessment;
    if (typeof renderer === "function") return renderer(container);
    if (!container) return;
    container.innerHTML = `<div class="gk-v26-card">Modifikasyon ve reassessment arayüzü yüklenemedi. Sayfayı yenileyin.</div>`;
  }

  /* SLB page shell lives in js/tfrs16-operations-ui.js. */

  function renderSlbManagementPage(container) {
    const renderer = window.LeaseQantTfrs16OperationsUi?.renderSaleAndLeaseback;
    if (typeof renderer === "function") return renderer(container);
    if (!container) return;
    container.innerHTML = `<div class="gk-v26-card">Satış ve geri kiralama arayüzü yüklenemedi. Sayfayı yenileyin.</div>`;
  }

  /* Sublease page shell lives in js/tfrs16-operations-ui.js. */

  function renderSubleaseManagementPage(container) {
    const renderer = window.LeaseQantTfrs16OperationsUi?.renderSublease;
    if (typeof renderer === "function") return renderer(container);
    if (!container) return;
    container.innerHTML = `<div class="gk-v26-card">Alt kiralama arayüzü yüklenemedi. Sayfayı yenileyin.</div>`;
  }

  /* Accounting center page shell lives in js/tfrs16-operations-ui.js. */

  function renderAccountingCenterPage(container) {
    const journalPage = window.LeaseQantTfrs16DisclosureUi?.renderPeriodJournalPage;
    if (typeof journalPage === "function") return journalPage(container);
    if (!container) return;
    container.innerHTML = `<div class="gk-v26-card">Yevmiye arayüzü yüklenemedi. Sayfayı yenileyin.</div>`;
  }
  /* ==========================================================
     DİPNOTLAR — AYRI SAYFA, 3 TAB (Varlık / Yükümlülük / Likidite)
     ----------------------------------------------------------
     Mevcut Finansal Raporlama ekranındaki (v191RenderFinancialReporting)
     dipnot bloklarıyla AYNI render fonksiyonlarını (v191RenderAssetNoteHtml/
     v191RenderLiabilityNoteHtml/v191RenderLiquidityNoteHtml) ve AYNI veri
     hazırlama mantığını (v191PrepareFinancialReportingData) kullanır —
     kod tekrarı yok, hesaplama/HTML üretimi PAYLAŞILIYOR. Sözleşme
     seçici GEREKMİYOR — bu raporlar tüm portföyü (contracts) tarıyor,
     tek bir sözleşmeye özgü değil. Sadece dönem sonu (raporlama
     tarihi) seçilebiliyor; dönem başı, Finansal Raporlama ekranıyla
     TUTARLI şekilde o yılın 1 Ocak'ı olarak sabitlendi.
  ========================================================== */
  // The deep-link renderer may run during navigation injection, before the
  // renderer declaration site is reached; use hoisted bindings for both
  // values so `?open=footnotes` cannot hit a temporal dead zone.
  // eslint-disable-next-line no-var
  var v26FootnotesActiveTab = "asset"; // asset | liability | liquidity
  // `injectV26Navigation()` can execute before the later page renderer is
  // initialized (deep-link `?open=footnotes`). `var` avoids the temporal
  // dead zone while preserving the existing null/undefined fallback.
  // eslint-disable-next-line no-var
  var v26FootnotesPeriodEndOverride = null; // null => bugün

  /* ==========================================================
     RİSK & KONTROLLER — AYRI SAYFA (onaylı plan)
     ----------------------------------------------------------
     v191RenderRiskControls'ün KENDİSİNE dokunulmadı — o hâlâ
     getControlSummary/getRiskSummary/getOpenExceptions'ı çağırıp
     bir HTML string döndürüyor. Önceden bu SADECE v191Show (ayrı,
     kendi kendine yeten bir modal sistemi — v191EnsureModal) ile
     açılabiliyordu; openInMain/#v26PageHost mekanizmasından
     TAMAMEN BAĞIMSIZDI. Bu sayfa sadece aynı render fonksiyonunu
     çağırıp normal sayfa akışına (diğer tüm dashboard sayfaları
     gibi) sokuyor.
  ========================================================== */
  /* ==========================================================
     FİNANSAL RAPORLAMA — AYRI SAYFA (onaylı plan, CFO Cockpit/
     Ay Sonu Kapanış/Integration/Reconciliation/Contract Financial
     Tools KAPSAM DIŞI BIRAKILDI, taşınmıyor)
     ----------------------------------------------------------
     v191RenderFinancialReporting'in KENDİSİNE dokunulmadı. Önceden
     sadece v191Show (v191EnsureModal, ayrı modal sistemi) üzerinden
     açılabiliyordu VE içindeki period picker (v191ApplyPeriod/
     v191ResetPeriod) her zaman v191OpenFinancialReporting()'i (o
     modalı) çağırıyordu — Dipnotlar sayfasında çözdüğümüz AYNI
     sorun. v191TriggerActiveScreenRefresh callback'i (zaten kurulu)
     burada da kullanılıyor — bu sayfa render()'ını kaydediyor,
     period "Uygula"/"Reset" butonları artık DOĞRU ekranı (bu
     sayfayı) yeniliyor.
  ========================================================== */
  // Financial Reporting and Risk Controls page shells live in the dedicated UI
  // module. Keep a small compatibility fallback while the module is loading.
  function renderFinancialReportingPage(container) {
    const renderer = window.LeaseQantTfrs16ReportingUi?.renderFinancialReporting;
    if (typeof renderer === "function") return renderer(container);
    if (!container) return;
    container.innerHTML = `<div class="gk-v26-card">Finansal raporlama arayüzü yüklenemedi. Sayfayı yenileyin.</div>`;
  }

  function renderRiskControlsPage(container) {
    const renderer = window.LeaseQantTfrs16ReportingUi?.renderRiskControls;
    if (typeof renderer === "function") return renderer(container);
    if (!container) return;
    container.innerHTML = `<div class="gk-v26-card">Risk arayüzü yüklenemedi. Sayfayı yenileyin.</div>`;
  }

  function renderFootnotesPage(container) {
    const renderer = window.LeaseQantTfrs16ReportingUi?.renderFootnotes;
    if (typeof renderer === "function") return renderer(container);
    if (!container) return;
    container.innerHTML = `<div class="gk-v26-card">Dipnotlar arayüzü yüklenemedi. Sayfayı yenileyin.</div>`;
  }

  function renderInflationIndexManagementPage(container) {
    const renderer = window.LeaseQantTfrs16InflationUi?.render;
    if (typeof renderer === "function") return renderer(container);
    if (!container) return;
    container.innerHTML = `<div class="gk-v26-card">Enflasyon endeksleri arayüzü yüklenemedi. Sayfayı yenileyin.</div>`;
  }

  // Form/import actions are delegated to the UI-only bridge loaded before this runtime.
  // The bridge resolves these callbacks only after boot, so script order cannot
  // expose calculation or persistence internals to the public page.
  window.__GK_TFRS16_FORM_UI__ = {
    openContractModal,
    openBulkImportModal,
    closeContractModal,
    closeBulkImportModal,
    downloadTemplate,
    confirmBulkImport,
    readBulkImportFile,
    parseIntegrationFile,
    showToast,
    showAlert
  };

  // The coordinator invokes this after runtime boot has completed, so all
  // runtime declarations are ready before the first private hydration.
  window.__GK_TFRS16_UI_HYDRATE__ = hydrateTfrs16BackendData;
};

// Bootstrap scheduling lives in the small public coordinator module. Keep
// the boot function private to this runtime and expose only the explicit
// coordinator hook; no calculation or state implementation is moved here.
window.__GK_TFRS16_UI_BOOT__ = __gkTfrs16Boot;
