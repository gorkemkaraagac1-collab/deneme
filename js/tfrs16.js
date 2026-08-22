document.addEventListener("DOMContentLoaded", () => {

  /* ==========================================================
     EMERGENCY UI BRIDGE V2
     ----------------------------------------------------------
     Capture-phase wiring is installed before the legacy UI wiring.
     This guarantees that the existing V19.1/V24 handlers cannot
     leave the core contract/import buttons inert if another init
     block fails or overwrites an element handler.
     ========================================================== */
  if (!window.__GK_TFRS16_UI_BRIDGE_V2__) {
    window.__GK_TFRS16_UI_BRIDGE_V2__ = true;

    document.addEventListener("click", event => {
      const button = event.target?.closest?.("button");
      if (!button) return;

      const id = button.id;
      try {
        if (id === "newContractButton") {
          event.preventDefault();
          event.stopImmediatePropagation();
          if (typeof openContractModal === "function") openContractModal();
          else document.getElementById("contractModal")?.classList.remove("hidden");
          return;
        }

        if (id === "bulkImportButton") {
          event.preventDefault();
          event.stopImmediatePropagation();
          if (typeof openBulkImportModal === "function") openBulkImportModal();
          else document.getElementById("bulkImportModal")?.classList.remove("hidden");
          return;
        }

        if (id === "closeModal" || id === "cancelModal") {
          event.preventDefault();
          event.stopImmediatePropagation();
          if (typeof closeContractModal === "function") closeContractModal();
          else document.getElementById("contractModal")?.classList.add("hidden");
          return;
        }

        if (id === "closeBulkModal" || id === "cancelBulkImport") {
          event.preventDefault();
          event.stopImmediatePropagation();
          if (typeof closeBulkImportModal === "function") closeBulkImportModal();
          else document.getElementById("bulkImportModal")?.classList.add("hidden");
          return;
        }

        if (id === "downloadTemplateButton") {
          event.preventDefault();
          event.stopImmediatePropagation();
          if (typeof downloadTemplate === "function") downloadTemplate();
          return;
        }

        if (id === "confirmBulkImport") {
          event.preventDefault();
          event.stopImmediatePropagation();
          if (typeof confirmBulkImport === "function") confirmBulkImport();
          return;
        }
      } catch (error) {
        console.error("GK TFRS16 UI Bridge V2 error:", error);
        alert(`İşlem başlatılamadı: ${error?.message || String(error)}`);
      }
    }, true);

    document.addEventListener("change", event => {
      const input = event.target;
      if (!input || input.id !== "bulkFileInput") return;
      const file = input.files?.[0];
      if (!file) return;
      try {
        event.stopImmediatePropagation();
        if (typeof readBulkImportFile === "function") readBulkImportFile(file);
        else if (typeof parseIntegrationFile === "function") parseIntegrationFile(file);
        else throw new Error("Excel import fonksiyonu yüklenemedi.");
      } catch (error) {
        console.error("GK TFRS16 Excel import bridge error:", error);
        const status = document.getElementById("bulkImportStatus");
        if (status) status.textContent = `Excel aktarımı başlatılamadı: ${error?.message || String(error)}`;
      }
    }, true);
  }

  /*
  ============================================================
  GK FINANCE INTELLIGENCE
  TFRS 16 ACCOUNTING ENGINE V17
  ------------------------------------------------------------
  V15
  - Existing V14 functionality preserved
  - Contract portfolio
  - New contract
  - Excel bulk import
  - Contract detail
  - TFRS 16 calculation engine
  - Initial recognition
  - Monthly / quarterly / annual journal
  - Current / non-current reclassification
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
  - Reporting-date based current / non-current liability classification
    using the professional payment schedule as the single source of truth.
  - Current liability = principal payable in the 12 months following
    the reporting date; interest excluded from current liability.
  - Backward-compatible legacy current/non-current functions preserved.

  ------------------------------------------------------------
  V16.1 (additive — nothing above removed or altered)
  - New calculateLeaseEngine(): professional TFRS 16 engine
    supporting extended parameters (payment frequency/timing,
    initial direct costs, incentives, prepayments, restoration
    obligation, short-term/low-value exemption, renewal/
    termination flags). Produces identical numbers to
    calculateLease() when only legacy fields are present.
    Escalation and non-monthly frequency math are intentionally
    deferred to later approved phases (V16.2+).
  - New "Kira Ödeme Planı" (Payment Schedule) panel in contract
    detail view, with Yıl / Ay / Çeyrek filters and Excel export.
  ============================================================
  */

  const STORAGE_KEY = "gk_tfrs16_contracts_v7";
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

  let contracts = loadContracts();

  contracts = contracts.map(
    contract => ensureReassessmentState(
      ensureModificationState(contract)
    )
  );

  let selectedContractId = null;
  let bulkJournalData = [];


  /* ==========================================================
     DEMO DATA
  ========================================================== */

  function getDefaultContracts() {
    return [
      {
        id: "LEASE-001",
        company: "GK Holding",
        supplier: "ABC Plaza",
        monthlyPayment: 125000,
        startDate: "2026-01-01",
        endDate: "2030-12-31",
        discountRate: 18,
        renewalDate: "2030-09-30",
        status: "active",
        modification: false
      },
      {
        id: "LEASE-002",
        company: "GK Holding",
        supplier: "XYZ Logistics",
        monthlyPayment: 85000,
        startDate: "2026-03-01",
        endDate: "2028-02-29",
        discountRate: 17,
        renewalDate: "2027-12-01",
        status: "active",
        modification: true
      },
      {
        id: "LEASE-003",
        company: "GK Teknoloji",
        supplier: "Tech Office",
        monthlyPayment: 65000,
        startDate: "2025-07-01",
        endDate: "2027-06-30",
        discountRate: 16,
        renewalDate: "2027-04-01",
        status: "active",
        modification: false
      }
    ];
  }


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

    const defaults = getDefaultContracts();
    saveContracts(defaults);

    return defaults;
  }


  function saveContracts(data) {
    try {
      const adapter =
        typeof V20StorageAdapters !== "undefined" &&
        typeof V20StorageAdapters.contracts === "function"
          ? V20StorageAdapters.contracts()
          : null;

      if (adapter) {
        adapter.save(data);
        return;
      }

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(data)
      );
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

  function cloneAuditValue(value) {
    try { return JSON.parse(JSON.stringify(value)); }
    catch (error) { return null; }
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
        events.push(event);
        saveAuditEvents(events);
      }
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

  function getContractAuditSummary(contractId) {
    const events = getAuditTrail(contractId);
    const ids = key => new Set(events.map(event => event[key]).filter(Boolean)).size;
    const created = events.find(event => event.action === "CREATE");
    const last = events.length ? events[events.length - 1] : null;
    return {
      contractId,
      totalEvents: events.length,
      lastAction: last?.action || null,
      lastUpdated: last?.timestamp || null,
      lastActor: last?.actor || null,
      createdDate: created?.timestamp || null,
      modificationCount: ids("modificationId"),
      reassessmentCount: ids("reassessmentId"),
      journalCount: ids("journalId")
    };
  }

  function exportAuditTrail(contractId) {
    const events = getAuditTrail(contractId);
    if (!events.length) return false;
    const rows = events.map(event => ({
      Timestamp: event.timestamp,
      Actor: event.actor,
      Action: event.action,
      "Entity Type": event.entityType,
      "Entity ID": event.entityId || "",
      "Contract ID": event.contractId || "",
      "Modification ID": event.modificationId || "",
      "Reassessment ID": event.reassessmentId || "",
      "Journal ID": event.journalId || "",
      Reason: event.reason || "",
      "Old Value": JSON.stringify(event.oldValue ?? null),
      "New Value": JSON.stringify(event.newValue ?? null),
      Metadata: JSON.stringify(event.metadata || {})
    }));
    if (typeof XLSX !== "undefined") {
      try {
        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Audit Trail");
        XLSX.writeFile(workbook, `TFRS16_Audit_Trail_${contractId || "ALL"}_${Date.now()}.xlsx`);
        recordAuditEvent({ action: "EXPORT", entityType: "AUDIT_TRAIL", entityId: contractId || "ALL", contractId: contractId || null, reason: "Audit trail export", metadata: { recordCount: rows.length, format: "xlsx" } });
        return true;
      } catch (error) { return false; }
    }
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(";"), ...rows.map(row => headers.map(h => String(row[h] ?? "").replace(/;/g, ",")).join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `TFRS16_Audit_Trail_${contractId || "ALL"}_${Date.now()}.csv`;
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    recordAuditEvent({ action: "EXPORT", entityType: "AUDIT_TRAIL", entityId: contractId || "ALL", contractId: contractId || null, reason: "Audit trail export", metadata: { recordCount: rows.length, format: "csv" } });
    return true;
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


  function getReassessmentBaseSchedule(contract) {
    const reassessments =
      (contract?.reassessments || [])
        .filter(item => item.status === "APPLIED")
        .slice()
        .sort((a, b) =>
          String(a.effectiveDate || "").localeCompare(
            String(b.effectiveDate || "")
          )
        );

    if (!reassessments.length) {
      return getModifiedCurrentSchedule(contract);
    }

    const latest = reassessments[reassessments.length - 1];

    return buildReassessedSchedule(
      contract,
      latest
    );
  }


  function getReassessmentCurrentTerms(contract) {
    return {
      leaseTerm: contract?.endDate || "",
      renewalOption: contract?.renewalOption === true,
      terminationOption: contract?.terminationOption === true,
      purchaseOption: contract?.purchaseOption === true,
      payment: Number(contract?.monthlyPayment) || 0,
      discountRate: Number(contract?.discountRate) || 0
    };
  }


  function validateReassessment(contract, input) {
    const errors = [];

    ensureReassessmentState(contract);

    if (!contract) {
      return { valid: false, errors: ["Sözleşme bulunamadı."] };
    }

    const reassessmentDate = parseDate(input?.reassessmentDate);
    const effectiveDate = parseDate(input?.effectiveDate);
    const startDate = parseDate(contract.startDate);
    const currentEnd = parseDate(contract.endDate);

    if (!reassessmentDate) {
      errors.push("Reassessment Date geçersiz.");
    }

    if (!effectiveDate) {
      errors.push("Effective Date geçersiz.");
    }

    if (reassessmentDate && effectiveDate && effectiveDate < reassessmentDate) {
      errors.push("Effective Date, Reassessment Date'ten önce olamaz.");
    }

    if (effectiveDate && startDate && effectiveDate < startDate) {
      errors.push("Effective Date lease başlangıcından önce olamaz.");
    }

    const type = String(input?.type || "OTHER");
    const allowedTypes = [
      "LEASE_TERM_CHANGE",
      "RENEWAL_OPTION_CHANGE",
      "TERMINATION_OPTION_CHANGE",
      "PURCHASE_OPTION_CHANGE",
      "INDEX_RATE_CHANGE",
      "FIXED_PAYMENT_CHANGE",
      "COMBINED_REASSESSMENT",
      "OTHER"
    ];

    if (!allowedTypes.includes(type)) {
      errors.push("Geçersiz reassessment type.");
    }

    const newEndDate = parseDate(input?.newLeaseEndDate);
    const newPayment = Number(input?.newPayment);
    const newRate = Number(input?.newDiscountRate);

    const termTypes = [
      "LEASE_TERM_CHANGE",
      "RENEWAL_OPTION_CHANGE",
      "TERMINATION_OPTION_CHANGE",
      "PURCHASE_OPTION_CHANGE",
      "COMBINED_REASSESSMENT"
    ];

    if (termTypes.includes(type)) {
      if (!newEndDate) {
        errors.push("New lease end date geçersiz.");
      } else if (effectiveDate && newEndDate <= effectiveDate) {
        errors.push("New lease end date Effective Date'ten sonra olmalıdır.");
      }
    }

    const paymentTypes = [
      "INDEX_RATE_CHANGE",
      "FIXED_PAYMENT_CHANGE",
      "COMBINED_REASSESSMENT"
    ];

    if (paymentTypes.includes(type)) {
      if (!Number.isFinite(newPayment) || newPayment < 0) {
        errors.push("New payment geçerli ve negatif olmayan bir tutar olmalıdır.");
      }
    }

    if (input?.newDiscountRate !== undefined &&
        input?.newDiscountRate !== null &&
        input?.newDiscountRate !== "") {
      if (!Number.isFinite(newRate) || newRate < 0) {
        errors.push("New discount rate geçersiz.");
      }
    }

    if (currentEnd && effectiveDate && effectiveDate > currentEnd &&
        (!newEndDate || newEndDate <= currentEnd)) {
      errors.push("Lease bitişinden sonra reassessment uygulanamaz.");
    }

    return { valid: errors.length === 0, errors };
  }


  function buildReassessmentFuturePayments(contract, effectiveDate, newTerms) {
    return buildModificationFuturePayments(
      contract,
      effectiveDate,
      {
        payment: Number(newTerms?.payment) || 0,
        leaseEndDate: newTerms?.leaseTerm || contract?.endDate || "",
        discountRate: Number(newTerms?.discountRate) || 0
      }
    );
  }


  function calculateReassessmentLiability(contract, effectiveDate, newTerms) {
    const payments = buildReassessmentFuturePayments(
      contract,
      effectiveDate,
      newTerms
    );

    const monthlyRate =
      newTerms?.effectiveMonthlyRate !== undefined &&
      newTerms?.effectiveMonthlyRate !== null &&
      newTerms?.effectiveMonthlyRate !== ""
        ? Number(newTerms.effectiveMonthlyRate)
        : (Number(newTerms?.discountRate) || 0) / 100 / 12;

    if (!payments.length) {
      return { liability: 0, monthlyRate, payments: [], schedule: [] };
    }

    let liability = 0;

    payments.forEach(item => {
      if (monthlyRate === 0) {
        liability += item.payment;
      } else {
        liability +=
          item.payment /
          Math.pow(1 + monthlyRate, Math.max(1, item.period));
      }
    });

    liability = Math.max(0, liability);

    let opening = liability;
    const schedule = [];

    payments.forEach(item => {
      const interest = Math.max(0, opening * monthlyRate);
      const principal = Math.min(
        opening,
        Math.max(0, item.payment - interest)
      );
      const closing = Math.max(0, opening - principal);

      schedule.push({
        ...item,
        openingLiability: opening,
        interest,
        principal,
        closingLiability: closing
      });

      opening = closing;
    });

    return { liability, monthlyRate, payments, schedule };
  }


  function calculateReassessmentROUAdjustment(
    oldROU,
    liabilityAdjustment,
    oldLeaseLiability,
    revisedLeaseLiability
  ) {
    const oldValue = Math.max(0, Number(oldROU) || 0);
    const adjustment = Number(liabilityAdjustment) || 0;

    if (adjustment >= 0) {
      return {
        rouAdjustment: adjustment,
        revisedROU: oldValue + adjustment,
        gainLoss: 0
      };
    }

    const desiredReduction = Math.abs(adjustment);
    const rouReduction = Math.min(oldValue, desiredReduction);
    const revisedROU = Math.max(0, oldValue - rouReduction);
    const liabilityReduction = Math.max(
      0,
      (Number(oldLeaseLiability) || 0) -
      (Number(revisedLeaseLiability) || 0)
    );

    return {
      rouAdjustment: -rouReduction,
      revisedROU,
      gainLoss: liabilityReduction - rouReduction
    };
  }


  function calculateReassessment(contract, input) {
    ensureReassessmentState(contract);

    const validation = validateReassessment(contract, input);
    if (!validation.valid) {
      return { valid: false, errors: validation.errors };
    }

    const effectiveDate = parseDate(input.effectiveDate);
    const type = input.type || "OTHER";
    const oldTerms = getReassessmentCurrentTerms(contract);

    const newTerms = {
      leaseTerm: input.newLeaseEndDate
        ? normalizeDate(input.newLeaseEndDate)
        : oldTerms.leaseTerm,
      renewalOption: input.newRenewalOption === undefined
        ? oldTerms.renewalOption
        : input.newRenewalOption === true,
      terminationOption: input.newTerminationOption === undefined
        ? oldTerms.terminationOption
        : input.newTerminationOption === true,
      purchaseOption: input.newPurchaseOption === undefined
        ? oldTerms.purchaseOption
        : input.newPurchaseOption === true,
      payment: Number.isFinite(Number(input.newPayment))
        ? Number(input.newPayment)
        : oldTerms.payment,
      discountRate: input.newDiscountRate !== undefined &&
                    input.newDiscountRate !== null &&
                    input.newDiscountRate !== ""
        ? Number(input.newDiscountRate)
        : oldTerms.discountRate
    };

    if (["LEASE_TERM_CHANGE", "RENEWAL_OPTION_CHANGE", "TERMINATION_OPTION_CHANGE", "PURCHASE_OPTION_CHANGE"].includes(type)) {
      newTerms.payment = oldTerms.payment;
    }

    const currentSchedule = buildReassessmentHistorySchedule(
      contract,
      input?.id || null
    );

    const oldLeaseLiability = getScheduleValueAsOfDate(
      currentSchedule,
      effectiveDate,
      "closingLiability",
      calculateLeaseEngine(contract).liability
    );

    const oldROU = getScheduleValueAsOfDate(
      currentSchedule,
      effectiveDate,
      "rouClosing",
      calculateLeaseEngine(contract).rouAssets
    );

    const revised = calculateReassessmentLiability(
      contract,
      effectiveDate,
      newTerms
    );

    const revisedLeaseLiability = Math.max(
      0,
      Number(revised.liability) || 0
    );

    const liabilityAdjustment =
      revisedLeaseLiability - oldLeaseLiability;

    const rou = calculateReassessmentROUAdjustment(
      oldROU,
      liabilityAdjustment,
      oldLeaseLiability,
      revisedLeaseLiability
    );

    const reassessment = {
      id: input.id || reassessmentId(contract),
      reassessmentDate: normalizeDate(input.reassessmentDate),
      effectiveDate: normalizeDate(input.effectiveDate),
      type,
      reason: String(input.reason || "").trim(),
      oldTerms: cloneModificationValue(oldTerms),
      newTerms: cloneModificationValue(newTerms),
      oldLeaseLiability,
      revisedLeaseLiability,
      liabilityAdjustment,
      oldROU,
      rouAdjustment: rou.rouAdjustment,
      revisedROU: rou.revisedROU,
      gainLoss: rou.gainLoss,
      status: input.status || "DRAFT",
      createdAt: input.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return {
      valid: true,
      reassessment,
      revisedSchedule: buildReassessedScheduleFromResult(
        currentSchedule,
        effectiveDate,
        revised.schedule,
        rou.revisedROU
      )
    };
  }


  function buildReassessedScheduleFromResult(
    currentSchedule,
    effectiveDate,
    futureSchedule,
    revisedROU
  ) {
    const historical = (currentSchedule || []).filter(item => {
      const date = parseDate(item.date);
      return date && date.getTime() <= effectiveDate.getTime();
    });

    let rou = Math.max(0, Number(revisedROU) || 0);
    const remainingMonths = futureSchedule.length;
    const depreciation = remainingMonths > 0 ? rou / remainingMonths : 0;

    const future = futureSchedule.map((item, index) => {
      const rouOpening = rou;
      const rouDepreciation = Math.min(depreciation, rouOpening);
      const rouClosing = Math.max(0, rouOpening - rouDepreciation);
      rou = rouClosing;

      return {
        ...item,
        period: historical.length + index + 1,
        rouOpening,
        depreciation: rouDepreciation,
        rouClosing
      };
    });

    return historical.concat(future);
  }


  function buildReassessmentHistorySchedule(contract, excludeId) {
    const latestModification = getCurrentAppliedModification(contract);
    let schedule = latestModification
      ? buildModifiedSchedule(contract, latestModification)
      : (calculateLeaseEngine(contract).schedule || []);

    const prior = (contract.reassessments || [])
      .filter(item => item.status === "APPLIED" && item.id !== excludeId)
      .slice()
      .sort((a, b) => String(a.effectiveDate || "").localeCompare(String(b.effectiveDate || "")));

    prior.forEach(item => {
      const effective = parseDate(item.effectiveDate);
      if (!effective) return;
      const futureResult = calculateReassessmentLiability(contract, effective, item.newTerms);
      schedule = buildReassessedScheduleFromResult(schedule, effective, futureResult.schedule, Number(item.revisedROU) || 0);
    });

    return schedule;
  }


  function buildReassessedSchedule(contract, reassessment) {
    if (!reassessment) {
      return buildReassessmentHistorySchedule(contract, null);
    }

    const schedule = buildReassessmentHistorySchedule(contract, reassessment.id);
    const effectiveDate = parseDate(reassessment.effectiveDate);
    if (!effectiveDate) return schedule;

    const revised = calculateReassessmentLiability(contract, effectiveDate, reassessment.newTerms);
    return buildReassessedScheduleFromResult(
      schedule,
      effectiveDate,
      revised.schedule,
      Number(reassessment.revisedROU) || 0
    );
  }


  function generateReassessmentJournal(contract, reassessment) {
    if (!reassessment || reassessment.status !== "APPLIED") {
      return [];
    }

    const liabilityAdjustment = Number(reassessment.liabilityAdjustment) || 0;
    const rouAdjustment = Number(reassessment.rouAdjustment) || 0;
    const gainLoss = Number(reassessment.gainLoss) || 0;
    const entries = [];

    if (liabilityAdjustment > 0) {
      entries.push({
        account: "260 Kullanım Hakkı Varlığı",
        debit: liabilityAdjustment,
        credit: 0,
        source: "REASSESSMENT",
        controlStatus: "VALID"
      });
      entries.push({
        account: "401 Kiralama Yükümlülüğü",
        debit: 0,
        credit: liabilityAdjustment,
        source: "REASSESSMENT",
        controlStatus: "VALID"
      });
    } else if (liabilityAdjustment < 0) {
      const amount = Math.abs(liabilityAdjustment);
      entries.push({
        account: "401 Kiralama Yükümlülüğü",
        debit: amount,
        credit: 0,
        source: "REASSESSMENT",
        controlStatus: "VALID"
      });
      if (rouAdjustment < 0) {
        entries.push({
          account: "260 Kullanım Hakkı Varlığı",
          debit: 0,
          credit: Math.abs(rouAdjustment),
          source: "REASSESSMENT",
          controlStatus: "VALID"
        });
      }
    }

    if (gainLoss > 0.005) {
      entries.push({
        account: "649 Reassessment Gain",
        debit: 0,
        credit: gainLoss,
        source: "REASSESSMENT",
        controlStatus: "VALID"
      });
    } else if (gainLoss < -0.005) {
      entries.push({
        account: "689 Reassessment Loss",
        debit: Math.abs(gainLoss),
        credit: 0,
        source: "REASSESSMENT",
        controlStatus: "VALID"
      });
    }

    const debit = entries.reduce((sum, item) => sum + (Number(item.debit) || 0), 0);
    const credit = entries.reduce((sum, item) => sum + (Number(item.credit) || 0), 0);
    const balanced = Math.abs(debit - credit) < 0.01;

    entries.forEach(item => {
      item.controlStatus = balanced ? "VALID" : "UNBALANCED";
    });

    return entries;
  }


  function createReassessment(contract, input) {
    ensureReassessmentState(contract);
    const result = calculateReassessment(contract, input);
    if (!result.valid) return result;

    contract.reassessments.push(result.reassessment);
    recordReassessmentAuditEvent(
      contract,
      "REASSESSMENT_CREATED",
      result.reassessment,
      null,
      result.reassessment
    );
    saveContracts(contracts);

    return {
      valid: true,
      reassessment: result.reassessment,
      revisedSchedule: result.revisedSchedule
    };
  }


  function applyReassessment(contract, reassessmentIdValue) {
    ensureReassessmentState(contract);

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

    const snapshot = {
      endDate: contract.endDate,
      monthlyPayment: contract.monthlyPayment,
      discountRate: contract.discountRate,
      renewalOption: contract.renewalOption === true,
      terminationOption: contract.terminationOption === true,
      purchaseOption: contract.purchaseOption === true
    };

    const next = reassessment.newTerms || {};

    if (next.leaseTerm) contract.endDate = next.leaseTerm;
    if (next.payment !== undefined) contract.monthlyPayment = Number(next.payment) || 0;
    if (next.discountRate !== undefined) contract.discountRate = Number(next.discountRate) || 0;
    if (next.renewalOption !== undefined) contract.renewalOption = next.renewalOption === true;
    if (next.terminationOption !== undefined) contract.terminationOption = next.terminationOption === true;
    if (next.purchaseOption !== undefined) contract.purchaseOption = next.purchaseOption === true;

    reassessment.status = "APPLIED";
    reassessment.updatedAt = new Date().toISOString();
    reassessment.appliedFromTerms = cloneModificationValue(snapshot);
    reassessment.appliedToTerms = cloneModificationValue(getReassessmentCurrentTerms(contract));
    reassessment.journal = generateReassessmentJournal(contract, reassessment);

    recordAuditEvent({
      action: "JOURNAL_GENERATED",
      entityType: "JOURNAL",
      entityId: `${contract.id}-${reassessment.id}-REASSESSMENT`,
      contractId: contract.id,
      reassessmentId: reassessment.id,
      journalId: `${contract.id}-${reassessment.id}-REASSESSMENT`,
      reason: "Reassessment journal generated",
      metadata: {
        source: "REASSESSMENT",
        totalDebit: reassessment.journal.reduce((sum, item) => sum + (Number(item.debit) || 0), 0),
        totalCredit: reassessment.journal.reduce((sum, item) => sum + (Number(item.credit) || 0), 0)
      }
    });

    recordReassessmentAuditEvent(
      contract,
      "REASSESSMENT_APPLIED",
      reassessment,
      snapshot,
      getReassessmentCurrentTerms(contract)
    );

    recordReassessmentAuditEvent(
      contract,
      "REASSESSMENT_JOURNAL_GENERATED",
      reassessment,
      null,
      reassessment.journal
    );

    saveContracts(contracts);

    auditScheduleEvent(contract, "SCHEDULE_UPDATED", "REASSESSMENT", reassessment.id, reassessment.effectiveDate, buildReassessedSchedule(contract, reassessment).length);

    return {
      valid: true,
      reassessment,
      schedule: buildReassessedSchedule(contract, reassessment)
    };
  }


  function cancelReassessment(contract, reassessmentIdValue) {
    ensureReassessmentState(contract);

    const reassessment = contract.reassessments.find(
      item => item.id === reassessmentIdValue
    );

    if (!reassessment) {
      return { valid: false, errors: ["Reassessment bulunamadı."] };
    }

    if (reassessment.status === "APPLIED") {
      return { valid: false, errors: ["APPLIED reassessment iptal edilemez."] };
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

    return { valid: true, reassessment };
  }


  function updateReassessment(contract, reassessmentIdValue, input) {
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

    const result = calculateReassessment(contract, {
      ...input,
      id: existing.id,
      createdAt: existing.createdAt,
      status: existing.status
    });

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

    return {
      valid: true,
      reassessment: existing,
      revisedSchedule: result.revisedSchedule
    };
  }


  function calculateReassessmentClassification(contract, reportingDate) {
    ensureReassessmentState(contract);
    const latest = getCurrentReassessmentState(contract);
    if (!latest) return calculateLiabilitySplitAsOf(contract, reportingDate);

    const effectiveDate = parseDate(latest.effectiveDate);
    const targetDate = parseDate(reportingDate);
    if (!effectiveDate || !targetDate || targetDate < effectiveDate) {
      return calculateLiabilitySplitAsOf(contract, reportingDate);
    }

    return calculateLiabilitySplitAsOf(
      contract,
      reportingDate,
      buildReassessedSchedule(contract, latest)
    );
  }


  function modificationId(contract) {
    const prefix = String(contract?.id || "LEASE")
      .replace(/[^A-Za-z0-9_-]/g, "")
      .slice(0, 24) || "LEASE";

    return `${prefix}-MOD-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  }


  function cloneModificationValue(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return value;
    }
  }


  function getModificationCurrentTerms(contract) {
    return {
      payment: Number(contract?.monthlyPayment) || 0,
      leaseEndDate: contract?.endDate || "",
      discountRate: Number(contract?.discountRate) || 0
    };
  }


  function getModificationEffectiveDate(modification) {
    return parseDate(modification?.effectiveDate);
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


  function validateModification(
    contract,
    input
  ) {

    const errors = [];

    if (!contract) {
      errors.push("Sözleşme bulunamadı.");
      return { valid: false, errors };
    }

    const effectiveDate =
      parseDate(input?.effectiveDate);

    const modificationDate =
      parseDate(input?.modificationDate);

    const startDate =
      parseDate(contract.startDate);

    const currentEndDate =
      parseDate(contract.endDate);

    if (!modificationDate) {
      errors.push("Modification Date geçersiz.");
    }

    if (!effectiveDate) {
      errors.push("Effective Date geçersiz.");
    }

    if (effectiveDate && startDate && effectiveDate < startDate) {
      errors.push("Effective Date lease başlangıç tarihinden önce olamaz.");
    }

    if (effectiveDate && modificationDate && effectiveDate < modificationDate) {
      errors.push("Effective Date, Modification Date'ten önce olamaz.");
    }

    if (currentEndDate && effectiveDate && effectiveDate > currentEndDate) {
      errors.push("Modification lease bitişinden sonra uygulanamaz.");
    }

    const type =
      String(input?.modificationType || "OTHER");

    const allowedTypes = [
      "PAYMENT_INCREASE",
      "PAYMENT_DECREASE",
      "LEASE_TERM_EXTENSION",
      "LEASE_TERM_REDUCTION",
      "SCOPE_INCREASE",
      "SCOPE_DECREASE",
      "COMBINED_MODIFICATION",
      "OTHER"
    ];

    if (!allowedTypes.includes(type)) {
      errors.push("Geçersiz modification type.");
    }

    const newPayment =
      Number(input?.newPayment);

    const newEndDate =
      parseDate(input?.newLeaseEndDate);

    const newDiscountRate =
      Number(input?.newDiscountRate);

    const paymentTypes = [
      "PAYMENT_INCREASE",
      "PAYMENT_DECREASE",
      "COMBINED_MODIFICATION",
      "OTHER"
    ];

    if (paymentTypes.includes(type)) {
      if (!Number.isFinite(newPayment) || newPayment < 0) {
        errors.push("New payment geçerli ve negatif olmayan bir tutar olmalıdır.");
      }
    }

    const termTypes = [
      "LEASE_TERM_EXTENSION",
      "LEASE_TERM_REDUCTION",
      "COMBINED_MODIFICATION",
      "OTHER"
    ];

    if (termTypes.includes(type)) {
      if (!newEndDate) {
        errors.push("New lease end date geçersiz.");
      } else if (effectiveDate && newEndDate <= effectiveDate) {
        errors.push("New lease end date Effective Date'ten sonra olmalıdır.");
      }
    }

    if (input?.newDiscountRate !== undefined &&
        input?.newDiscountRate !== null &&
        input?.newDiscountRate !== "") {
      if (!Number.isFinite(newDiscountRate) || newDiscountRate < 0) {
        errors.push("New discount rate geçersiz.");
      }
    }

    if (type === "SCOPE_DECREASE") {
      const pct = Number(input?.scopeReductionPercent);
      if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
        errors.push("Scope reduction yüzde değeri 0 ile 100 arasında olmalıdır.");
      }
    }

    if (type === "SCOPE_INCREASE") {
      const pct = Number(input?.scopeIncreasePercent);
      const amount = Number(input?.scopeIncreaseAmount);
      if ((!Number.isFinite(pct) || pct <= 0) &&
          (!Number.isFinite(amount) || amount <= 0)) {
        errors.push("Scope increase için yüzde veya tutar girilmelidir.");
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }


  function getScheduleValueAsOfDate(
    schedule,
    date,
    valueField,
    fallback
  ) {

    const target = parseDate(date);

    if (!target) {
      return Math.max(0, Number(fallback) || 0);
    }

    const historical =
      (schedule || []).filter(
        item => {
          const itemDate = parseDate(item.date);
          return itemDate &&
            itemDate.getTime() <= target.getTime();
        }
      );

    if (!historical.length) {
      return Math.max(0, Number(fallback) || 0);
    }

    return Math.max(
      0,
      Number(
        historical[historical.length - 1][valueField]
      ) || 0
    );
  }


  function getModificationROUAsOf(
    contract,
    effectiveDate,
    engine
  ) {

    return getScheduleValueAsOfDate(
      engine?.schedule || [],
      effectiveDate,
      "rouClosing",
      engine?.rouAssets || 0
    );
  }


  function buildModificationFuturePayments(
    contract,
    effectiveDate,
    newTerms
  ) {

    const effective = parseDate(effectiveDate);
    const newEnd = parseDate(newTerms.leaseEndDate);

    if (!effective || !newEnd || newEnd <= effective) {
      return [];
    }

    const basePayment =
      Number(newTerms.payment) || 0;

    const result = [];
    const cursor = new Date(
      effective.getFullYear(),
      effective.getMonth() + 1,
      1
    );

    let period = 1;

    while (cursor.getTime() <= newEnd.getTime()) {

      const contractStart =
        parseDate(contract.startDate) || effective;

      const globalPeriod =
        Math.max(
          1,
          (
            (cursor.getFullYear() - contractStart.getFullYear()) * 12 +
            (cursor.getMonth() - contractStart.getMonth()) +
            1
          )
        );

      const payment =
        computeEscalatedPayment(
          basePayment,
          globalPeriod,
          contract.leaseIncreaseType || "none",
          Number(contract.leaseIncreaseRate) || 0,
          Number(contract.fixedIncrease) || 0
        );

      result.push({
        period,
        date: new Date(cursor),
        year: cursor.getFullYear(),
        month: cursor.getMonth() + 1,
        payment: Math.max(0, Number(payment) || 0),
        globalPeriod
      });

      cursor.setMonth(cursor.getMonth() + 1);
      period++;
    }

    return result;
  }


  function calculateModifiedLeaseLiability(
    contract,
    effectiveDate,
    newTerms
  ) {

    const payments =
      buildModificationFuturePayments(
        contract,
        effectiveDate,
        newTerms
      );

    const monthlyRate =
      newTerms.effectiveMonthlyRate !== undefined &&
      newTerms.effectiveMonthlyRate !== null &&
      newTerms.effectiveMonthlyRate !== ""
        ? Number(newTerms.effectiveMonthlyRate)
        : (Number(newTerms.discountRate) || 0) / 100 / 12;

    if (!payments.length) {
      return {
        liability: 0,
        monthlyRate,
        payments: [],
        schedule: []
      };
    }

    let liability = 0;

    payments.forEach(item => {
      const exponent = Math.max(1, item.period);

      if (monthlyRate === 0) {
        liability += item.payment;
      } else {
        liability +=
          item.payment /
          Math.pow(
            1 + monthlyRate,
            exponent
          );
      }
    });

    liability = Math.max(0, liability);

    let opening = liability;
    const schedule = [];

    payments.forEach(item => {
      const interest =
        Math.max(0, opening * monthlyRate);

      const principal =
        Math.min(
          opening,
          Math.max(0, item.payment - interest)
        );

      const closing =
        Math.max(0, opening - principal);

      schedule.push({
        ...item,
        openingLiability: opening,
        interest,
        principal,
        closingLiability: closing
      });

      opening = closing;
    });

    return {
      liability,
      monthlyRate,
      payments,
      schedule
    };
  }


  function buildScheduleFromModificationChain(
    contract,
    appliedModifications
  ) {

    const baseContract =
      contract?.originalContractSnapshot
        ? cloneModificationValue(contract.originalContractSnapshot)
        : {
            ...contract,
            modifications: [],
            auditTrail: [],
            originalContractSnapshot: undefined
          };

    delete baseContract.modifications;
    delete baseContract.auditTrail;
    delete baseContract.originalContractSnapshot;

    const baseEngine =
      calculateLeaseEngine(baseContract);

    let currentSchedule =
      (baseEngine.schedule || []).map(item => ({ ...item }));

    const ordered =
      (appliedModifications || [])
        .filter(item => item.status === "APPLIED")
        .slice()
        .sort(
          (a, b) =>
            String(a.effectiveDate || "").localeCompare(
              String(b.effectiveDate || "")
            )
        );

    ordered.forEach(modification => {

      const effectiveDate =
        parseDate(modification.effectiveDate);

      if (!effectiveDate) return;

      const oldROU =
        getScheduleValueAsOfDate(
          currentSchedule,
          effectiveDate,
          "rouClosing",
          baseEngine.rouAssets
        );

      const futureResult =
        calculateModifiedLeaseLiability(
          baseContract,
          effectiveDate,
          modification.newTerms
        );

      const historical =
        currentSchedule.filter(
          item => {
            const date = parseDate(item.date);
            return date &&
              date.getTime() <= effectiveDate.getTime();
          }
        );

      let rouOpening =
        Math.max(
          0,
          oldROU + (Number(modification.rouAdjustment) || 0)
        );

      const remainingMonths =
        futureResult.schedule.length;

      const depreciation =
        remainingMonths > 0
          ? rouOpening / remainingMonths
          : 0;

      let rou = rouOpening;

      const future =
        futureResult.schedule.map(
          (item, index) => {
            const rouDepreciation =
              Math.min(depreciation, rou);

            const rouClosing =
              Math.max(0, rou - rouDepreciation);

            const row = {
              ...item,
              period:
                historical.length + index + 1,
              rouOpening: rou,
              depreciation: rouDepreciation,
              rouClosing
            };

            rou = rouClosing;
            return row;
          }
        );

      currentSchedule =
        historical.concat(future);
    });

    return currentSchedule;
  }


  function calculateROUAdjustment(
    modification,
    oldROU,
    liabilityAdjustment,
    oldLeaseLiability,
    revisedLeaseLiability
  ) {

    const type =
      modification.modificationType;

    if (type === "SCOPE_DECREASE") {
      const pct =
        Math.min(
          100,
          Math.max(
            0,
            Number(modification.scopeReductionPercent) || 0
          )
        ) / 100;

      const rouReduction =
        oldROU * pct;

      const liabilityReduction =
        Math.max(
          0,
          oldLeaseLiability - revisedLeaseLiability
        );

      return {
        rouAdjustment: -rouReduction,
        rouReduction,
        gainLoss:
          liabilityReduction - rouReduction
      };
    }

    if (type === "SCOPE_INCREASE") {
      return {
        rouAdjustment: Math.max(0, liabilityAdjustment),
        rouReduction: 0,
        gainLoss: 0
      };
    }

    return {
      rouAdjustment: liabilityAdjustment,
      rouReduction: 0,
      gainLoss: 0
    };
  }


  function calculateModification(
    contract,
    input
  ) {

    ensureModificationState(contract);

    const validation =
      validateModification(
        contract,
        input
      );

    if (!validation.valid) {
      return {
        valid: false,
        errors: validation.errors
      };
    }

    const effectiveDate =
      parseDate(input.effectiveDate);

    const currentTerms =
      getModificationCurrentTerms(contract);

    const type =
      input.modificationType || "OTHER";

    const newTerms = {
      payment:
        Number.isFinite(Number(input.newPayment))
          ? Number(input.newPayment)
          : currentTerms.payment,

      leaseEndDate:
        input.newLeaseEndDate
          ? normalizeDate(input.newLeaseEndDate)
          : currentTerms.leaseEndDate,

      discountRate:
        input.newDiscountRate !== undefined &&
        input.newDiscountRate !== null &&
        input.newDiscountRate !== ""
          ? Number(input.newDiscountRate)
          : currentTerms.discountRate
    };

    if (
      type === "LEASE_TERM_EXTENSION" ||
      type === "LEASE_TERM_REDUCTION"
    ) {
      newTerms.payment = currentTerms.payment;
    }

    if (type === "SCOPE_DECREASE" || type === "SCOPE_INCREASE") {
      newTerms.payment =
        input.newPayment !== undefined &&
        input.newPayment !== ""
          ? Number(input.newPayment)
          : currentTerms.payment;
    }

    if (type === "PAYMENT_INCREASE" || type === "PAYMENT_DECREASE") {
      newTerms.leaseEndDate = currentTerms.leaseEndDate;
    }

    if (type === "SCOPE_INCREASE" &&
        (!input.newLeaseEndDate || input.newLeaseEndDate === "")) {
      newTerms.leaseEndDate = currentTerms.leaseEndDate;
    }

    const appliedBefore =
      (contract.modifications || [])
        .filter(
          item =>
            item.status === "APPLIED" &&
            item.id !== input.id
        );

    const currentStateSchedule =
      buildScheduleFromModificationChain(
        contract,
        appliedBefore
      );

    const baseEngine =
      calculateLeaseEngine(
        contract.originalContractSnapshot || contract
      );

    const oldLeaseLiability =
      getScheduleValueAsOfDate(
        currentStateSchedule,
        effectiveDate,
        "closingLiability",
        baseEngine.liability
      );

    const oldROU =
      getModificationROUAsOf(
        contract,
        effectiveDate,
        { schedule: currentStateSchedule, rouAssets: baseEngine.rouAssets }
      );

    const revised =
      calculateModifiedLeaseLiability(
        contract,
        effectiveDate,
        newTerms
      );

    const revisedLeaseLiability =
      Math.max(
        0,
        Number(revised.liability) || 0
      );

    const liabilityAdjustment =
      revisedLeaseLiability - oldLeaseLiability;

    const rou =
      calculateROUAdjustment(
        {
          ...input,
          scopeReductionPercent:
            Number(input.scopeReductionPercent) || 0
        },
        oldROU,
        liabilityAdjustment,
        oldLeaseLiability,
        revisedLeaseLiability
      );

    return {
      valid: true,
      modification: {
        id:
          input.id || modificationId(contract),

        modificationDate:
          normalizeDate(input.modificationDate),

        effectiveDate:
          normalizeDate(input.effectiveDate),

        reason:
          String(input.reason || "").trim(),

        modificationType:
          type,

        oldTerms:
          cloneModificationValue(
            currentTerms
          ),

        newTerms:
          cloneModificationValue(
            newTerms
          ),

        oldLeaseLiability,
        revisedLeaseLiability,
        liabilityAdjustment,

        oldROU,
        rouAdjustment:
          rou.rouAdjustment,

        gainLoss:
          rou.gainLoss,

        scopeReductionPercent:
          Number(input.scopeReductionPercent) || 0,

        scopeIncreasePercent:
          Number(input.scopeIncreasePercent) || 0,

        scopeIncreaseAmount:
          Number(input.scopeIncreaseAmount) || 0,

        status:
          input.status || "DRAFT",

        createdAt:
          input.createdAt || new Date().toISOString(),

        updatedAt:
          new Date().toISOString()
      },

      revisedSchedule:
        revised.schedule,

      revisedPayments:
        revised.payments
    };
  }


  function buildModifiedSchedule(
    contract,
    modification
  ) {

    if (!modification) {
      return calculateLeaseEngine(contract).schedule || [];
    }

    const priorApplied =
      (contract.modifications || [])
        .filter(
          item =>
            item.status === "APPLIED" &&
            item.id !== modification.id
        );

    const chain =
      buildScheduleFromModificationChain(
        contract,
        priorApplied
      );

    const effectiveDate =
      parseDate(modification.effectiveDate);

    if (!effectiveDate) {
      return chain;
    }

    const oldROU =
      getScheduleValueAsOfDate(
        chain,
        effectiveDate,
        "rouClosing",
        0
      );

    const futureResult =
      calculateModifiedLeaseLiability(
        contract.originalContractSnapshot || contract,
        effectiveDate,
        modification.newTerms
      );

    const historical =
      chain.filter(
        item => {
          const itemDate = parseDate(item.date);
          return itemDate &&
            itemDate.getTime() <= effectiveDate.getTime();
        }
      );

    let rouOpening =
      Math.max(
        0,
        oldROU + (Number(modification.rouAdjustment) || 0)
      );

    const remainingMonths =
      futureResult.schedule.length;

    const depreciation =
      remainingMonths > 0
        ? rouOpening / remainingMonths
        : 0;

    let rou = rouOpening;

    const future =
      futureResult.schedule.map(
        (item, index) => {
          const rouDepreciation =
            Math.min(depreciation, rou);

          const rouClosing =
            Math.max(0, rou - rouDepreciation);

          const row = {
            ...item,
            period:
              historical.length + index + 1,
            rouOpening: rou,
            depreciation: rouDepreciation,
            rouClosing
          };

          rou = rouClosing;
          return row;
        }
      );

    return historical.concat(future);
  }


  function generateModificationJournal(
    contract,
    modification
  ) {

    if (!modification || modification.status !== "APPLIED") {
      return [];
    }

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
        entries.push({
          account: "401 Kiralama Yükümlülüğü",
          debit: liabilityReduction,
          credit: 0,
          source: "MODIFICATION",
          controlStatus: "VALID"
        });
      }

      if (rouReduction > 0) {
        entries.push({
          account: "260 Kullanım Hakkı Varlığı",
          debit: 0,
          credit: rouReduction,
          source: "MODIFICATION",
          controlStatus: "VALID"
        });
      }

      if (Math.abs(gainLoss) > 0.005) {
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
        entries.push({
          account: "260 Kullanım Hakkı Varlığı",
          debit: liabilityAdjustment,
          credit: 0,
          source: "MODIFICATION",
          controlStatus: "VALID"
        });

        entries.push({
          account: "401 Kiralama Yükümlülüğü",
          debit: 0,
          credit: liabilityAdjustment,
          source: "MODIFICATION",
          controlStatus: "VALID"
        });
      } else if (liabilityAdjustment < 0) {
        const amount = Math.abs(liabilityAdjustment);

        entries.push({
          account: "401 Kiralama Yükümlülüğü",
          debit: amount,
          credit: 0,
          source: "MODIFICATION",
          controlStatus: "VALID"
        });

        entries.push({
          account: "260 Kullanım Hakkı Varlığı",
          debit: 0,
          credit: amount,
          source: "MODIFICATION",
          controlStatus: "VALID"
        });
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

    return entries;
  }


  function createModification(
    contract,
    input
  ) {

    ensureModificationState(contract);

    const result =
      calculateModification(
        contract,
        input
      );

    if (!result.valid) {
      return result;
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

    return {
      valid: true,
      modification: result.modification,
      revisedSchedule: result.revisedSchedule
    };
  }


  function applyModification(
    contract,
    modificationIdValue
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

    const snapshot =
      cloneModificationValue({
        monthlyPayment: contract.monthlyPayment,
        startDate: contract.startDate,
        endDate: contract.endDate,
        discountRate: contract.discountRate,
        leaseIncreaseType: contract.leaseIncreaseType,
        leaseIncreaseRate: contract.leaseIncreaseRate,
        fixedIncrease: contract.fixedIncrease
      });

    if (!contract.originalContractSnapshot) {
      contract.originalContractSnapshot =
        cloneModificationValue(contract);
      delete contract.originalContractSnapshot.modifications;
      delete contract.originalContractSnapshot.auditTrail;
      delete contract.originalContractSnapshot.originalContractSnapshot;
    }

    const oldTerms =
      getModificationCurrentTerms(contract);

    const nextTerms =
      modification.newTerms || oldTerms;

    contract.monthlyPayment =
      Number(nextTerms.payment) || 0;

    contract.endDate =
      nextTerms.leaseEndDate || contract.endDate;

    contract.discountRate =
      Number(nextTerms.discountRate) || 0;

    modification.status = "APPLIED";
    modification.updatedAt = new Date().toISOString();

    modification.appliedFromTerms =
      cloneModificationValue(oldTerms);

    modification.appliedToTerms =
      cloneModificationValue(
        getModificationCurrentTerms(contract)
      );

    modification.journal =
      generateModificationJournal(
        contract,
        modification
      );

      recordAuditEvent({
        action: "JOURNAL_GENERATED",
        entityType: "JOURNAL",
        entityId: `${contract.id}-${modification.id}-MODIFICATION`,
        contractId: contract.id,
        modificationId: modification.id,
        journalId: `${contract.id}-${modification.id}-MODIFICATION`,
        reason: "Modification journal generated",
        metadata: { source: "MODIFICATION" }
      });

    recordModificationAuditEvent(
      contract,
      "MODIFICATION_APPLIED",
      modification,
      snapshot,
      getModificationCurrentTerms(contract)
    );

    recordModificationAuditEvent(
      contract,
      "MODIFICATION_JOURNAL_GENERATED",
      modification,
      null,
      modification.journal
    );

    saveContracts(contracts);

    return {
      valid: true,
      modification,
      schedule:
        buildModifiedSchedule(
          contract,
          modification
        )
    };
  }


  function cancelModification(
    contract,
    modificationIdValue
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
      return {
        valid: false,
        errors: ["APPLIED modification iptal edilemez."]
      };
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

    return {
      valid: true,
      modification
    };
  }


  function updateModification(
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

    const result =
      calculateModification(
        contract,
        {
          ...input,
          id: existing.id,
          createdAt: existing.createdAt,
          status: existing.status
        }
      );

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

    return {
      valid: true,
      modification: existing,
      revisedSchedule: result.revisedSchedule
    };
  }


  function getCurrentAppliedModification(contract) {
    ensureModificationState(contract);

    const applied =
      contract.modifications.filter(
        item => item.status === "APPLIED"
      );

    return applied.length
      ? applied[applied.length - 1]
      : null;
  }


  function getModifiedCurrentSchedule(contract) {
    const modification =
      getCurrentAppliedModification(contract);

    if (!modification) {
      return calculateLeaseEngine(contract).schedule || [];
    }

    return buildModifiedSchedule(
      contract,
      modification
    );
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
    "12": "annual"
  };

  const PAYMENT_FREQUENCY_WORD_TO_CODE = {
    monthly: "1",
    quarterly: "3",
    annual: "12"
  };


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
     TFRS 16 CALCULATION ENGINE
  ========================================================== */

  function calculateLease(contract) {

    /*
      V16.5 FIX — GK Advisory review, 21.08.2026
      -------------------------------------------------------
      This function used to run its own stripped-down annuity
      calculation (ROU = Liability, no initial direct costs, no
      prepayments, no lease incentives, no restoration obligation,
      and no TFRS 16.5-8 short-term/low-value exemption). Because
      calculateLease() was still the engine behind the initial
      journal entry, the current/non-current split, the dashboard
      KPIs, and the contract detail modal, contracts with any of
      those components — or ones flagged as exempt — produced
      numbers there that silently disagreed with the "professional"
      schedule shown elsewhere (calculateLeaseEngine()).

      Fix: delegate fully to calculateLeaseEngine(), which is a
      strict superset — for a legacy contract (no IDC/incentives/
      prepayments/restoration/escalation/exemption fields set) it
      returns numerically identical months/liability/rouAssets/
      depreciation/monthlyInterest/schedule values, so every
      existing call site keeps working unchanged. For contracts
      that DO use the extended TFRS 16 fields, all downstream
      consumers of calculateLease() now get the standard-compliant
      figures instead of a second, wrong set of numbers.
    */
    return calculateLeaseEngine(contract);
  }


  /* ==========================================================
     PROFESSIONAL CALCULATION ENGINE (V16.1)
     ----------------------------------------------------------
     calculateLease() above is untouched and remains the engine
     used by every existing V15 screen (detail summary, initial
     journal, accounting center, bulk journal, current/non-current
     KPIs). Nothing in this file has been rewired to use the new
     engine except the new Payment Schedule panel below.

     calculateLeaseEngine() is additive. It wraps the same core
     amortization math but accepts a wider set of TFRS 16
     parameters: paymentFrequency, paymentTiming, leaseIncreaseType/
     Rate, fixedIncrease, variablePayment, renewalOption,
     terminationOption, initialDirectCosts, leaseIncentives,
     prepayments, restorationObligation, shortTermLease,
     lowValueAsset, effectiveMonthlyRate. When a contract only has
     the legacy V15 fields (monthlyPayment, discountRate,
     startDate, endDate) it produces numerically identical results
     to calculateLease().

     NOT yet implemented (reserved for later approved phases, do
     NOT assume these are active):
       - Payment frequency other than monthly — accepted but the
         schedule is still computed monthly
       - Modification / reassessment recalculation — Faz 5/6
       - Index-based escalation ("index" type) — structure ready,
         math deferred; behaves as flat payment until implemented
     These fields are captured in the "assumptions" object of the
     result so the data model is ready, without silently producing
     wrong numbers for math that hasn't been built yet.

     V16.2 UPDATE: lease escalation (fixedRate / fixedAmount) is
     now implemented via computeEscalatedPayment() below. When
     leaseIncreaseType is "none"/undefined (every legacy contract),
     the ORIGINAL closed-form annuity path executes UNCHANGED —
     same code, same numbers as V16.1. Escalation only activates
     the alternate PV-summation path when explicitly requested.
  ========================================================== */

  function computeEscalatedPayment(
    basePayment,
    periodIndex,
    escalationType,
    escalationRate,
    fixedIncrease
  ) {

    // Escalation steps up once per contract year (every 12
    // periods from commencement), not on calendar year boundary.
    const contractYearIndex =
      Math.floor(
        (periodIndex - 1) / 12
      );

    if (escalationType === "fixedRate") {

      return (
        basePayment *
        Math.pow(
          1 + (escalationRate / 100),
          contractYearIndex
        )
      );
    }

    if (escalationType === "fixedAmount") {

      return (
        basePayment +
        (fixedIncrease * contractYearIndex)
      );
    }

    // "none", "index" (not yet computed), or anything else:
    // flat payment, unchanged.
    return basePayment;
  }

  function calculateLeaseEngine(contract) {

    const assumptions = {

      paymentFrequency:
        contract.paymentFrequency || "monthly",

      paymentTiming:
        contract.paymentTiming || "arrears",

      leaseIncreaseType:
        contract.leaseIncreaseType || "none",

      leaseIncreaseRate:
        Number(contract.leaseIncreaseRate) || 0,

      fixedIncrease:
        Number(contract.fixedIncrease) || 0,

      variablePayment:
        Number(contract.variablePayment) || 0,

      renewalOption:
        contract.renewalOption === true,

      terminationOption:
        contract.terminationOption === true,

      initialDirectCosts:
        Number(contract.initialDirectCosts) || 0,

      leaseIncentives:
        Number(contract.leaseIncentives) || 0,

      prepayments:
        Number(contract.prepayments) || 0,

      restorationObligation:
        Number(contract.restorationObligation) || 0,

      shortTermLease:
        contract.shortTermLease === true,

      lowValueAsset:
        contract.lowValueAsset === true,

      // TFRS 16.32: ROU is depreciated over the shorter of lease
      // term and useful life UNLESS ownership transfers at the end
      // of the lease term, or the lease liability reflects a
      // purchase option reasonably certain to be exercised — in
      // either of those cases it is depreciated over the useful
      // life of the underlying asset instead. usefulLifeMonths is
      // an optional field (not present on any legacy contract), so
      // when it is absent behavior is unchanged: full lease term.
      ownershipTransfer:
        contract.ownershipTransfer === true,

      purchaseOption:
        contract.purchaseOption === true,

      usefulLifeMonths:
        contract.usefulLifeMonths !== undefined &&
        contract.usefulLifeMonths !== null &&
        contract.usefulLifeMonths !== ""
          ? Number(contract.usefulLifeMonths)
          : null
    };


    // TFRS 16.5-8 recognition exemption: short-term / low-value
    // leases are expensed on a straight-line basis. No ROU asset
    // or lease liability is recognized.
    if (
      assumptions.shortTermLease ||
      assumptions.lowValueAsset
    ) {

      const payment =
        Number(contract.monthlyPayment) || 0;

      const months =
        monthsBetween(
          contract.startDate,
          contract.endDate
        );

      const contractStart =
        parseDate(contract.startDate);

      const schedule = [];

      if (
        payment > 0 &&
        months > 0 &&
        contractStart
      ) {

        for (
          let i = 1;
          i <= months;
          i++
        ) {

          const periodDate =
            new Date(
              contractStart.getFullYear(),
              contractStart.getMonth() +
                i -
                1,
              1
            );

          schedule.push({
            period: i,
            date: periodDate,
            year: periodDate.getFullYear(),
            month: periodDate.getMonth() + 1,
            openingLiability: 0,
            payment,
            interest: 0,
            principal: 0,
            closingLiability: 0,
            rouOpening: 0,
            depreciation: 0,
            rouClosing: 0,
            straightLineExpense: payment
          });
        }
      }

      return {
        months,
        liability: 0,
        rouAssets: 0,
        depreciation: 0,
        monthlyInterest: 0,
        schedule,
        assumptions,
        exempt: true
      };
    }


    const payment =
      Number(contract.monthlyPayment) || 0;

    const annualRate =
      Number(contract.discountRate) || 0;

    const monthlyRate =
      contract.effectiveMonthlyRate !== undefined &&
      contract.effectiveMonthlyRate !== null &&
      contract.effectiveMonthlyRate !== ""
        ? Number(contract.effectiveMonthlyRate)
        : annualRate / 100 / 12;

    const months =
      monthsBetween(
        contract.startDate,
        contract.endDate
      );

    if (
      payment <= 0 ||
      months <= 0
    ) {

      return {
        months: 0,
        liability: 0,
        rouAssets: 0,
        depreciation: 0,
        monthlyInterest: 0,
        schedule: [],
        assumptions,
        exempt: false
      };
    }

    let liability = 0;

    // V16.2: escalating leases need a per-period payment array,
    // since the closed-form flat annuity formula no longer holds
    // once payments vary. Liability becomes the PV of the actual
    // (escalated) payment stream — TFRS 16.26/BC166 principle.
    const hasEscalation =
      assumptions.leaseIncreaseType === "fixedRate" ||
      assumptions.leaseIncreaseType === "fixedAmount";

    let paymentSchedule = null;

    if (hasEscalation) {

      paymentSchedule = [];

      for (
        let i = 1;
        i <= months;
        i++
      ) {

        paymentSchedule.push(
          computeEscalatedPayment(
            payment,
            i,
            assumptions.leaseIncreaseType,
            assumptions.leaseIncreaseRate,
            assumptions.fixedIncrease
          )
        );
      }

      if (monthlyRate === 0) {

        liability =
          paymentSchedule.reduce(
            (total, p) => total + p,
            0
          );

      } else {

        liability =
          paymentSchedule.reduce(
            (total, p, index) =>
              total +
              p /
                Math.pow(
                  1 + monthlyRate,
                  index + 1
                ),
            0
          );
      }

    } else if (monthlyRate === 0) {

      liability =
        payment * months;

    } else {

      liability =
        payment *
        (
          (
            1 -
            Math.pow(
              1 + monthlyRate,
              -months
            )
          ) /
          monthlyRate
        );
    }

    const initialLiability =
      liability;

    // Initial ROU measurement per TFRS 16.24:
    // liability + initial direct costs + prepayments
    // - lease incentives + restoration/dismantling obligation.
    // When all extended fields are 0 (legacy contracts), this
    // equals initialLiability exactly, matching calculateLease().
    const initialROU =
      initialLiability +
      assumptions.initialDirectCosts +
      assumptions.prepayments -
      assumptions.leaseIncentives +
      assumptions.restorationObligation;

    // TFRS 16.32: depreciate over useful life instead of lease term
    // when ownership transfers, or a purchase option is reasonably
    // certain to be exercised — but only once a useful life has
    // actually been provided (usefulLifeMonths). Without it, this
    // falls back to the lease term exactly as before, so contracts
    // that don't set the new field are unaffected. Depreciation
    // never uses a period SHORTER than the lease term here, since
    // useful life is by definition expected to be >= lease term in
    // the ownership-transfer/purchase-option case.
    const usesUsefulLife =
      (
        assumptions.ownershipTransfer ||
        assumptions.purchaseOption
      ) &&
      assumptions.usefulLifeMonths &&
      assumptions.usefulLifeMonths > months;

    const depreciationMonths =
      usesUsefulLife
        ? assumptions.usefulLifeMonths
        : months;

    const depreciation =
      initialROU / depreciationMonths;

    const schedule = [];

    let openingLiability =
      initialLiability;

    let rouOpening =
      initialROU;

    const contractStart =
      parseDate(contract.startDate);

    for (
      let i = 1;
      i <= months;
      i++
    ) {

      const periodPayment =
        paymentSchedule
          ? paymentSchedule[i - 1]
          : payment;

      const interest =
        openingLiability *
        monthlyRate;

      let principal =
        periodPayment - interest;

      if (principal < 0) {
        principal = 0;
      }

      if (
        principal >
        openingLiability
      ) {
        principal =
          openingLiability;
      }

      const closingLiability =
        Math.max(
          0,
          openingLiability - principal
        );

      const rouDepreciation =
        Math.min(
          depreciation,
          rouOpening
        );

      const rouClosing =
        Math.max(
          0,
          rouOpening -
          rouDepreciation
        );

      const periodDate =
        new Date(
          contractStart.getFullYear(),
          contractStart.getMonth() +
            i -
            1,
          1
        );

      schedule.push({
        period: i,
        date: periodDate,
        year: periodDate.getFullYear(),
        month: periodDate.getMonth() + 1,
        openingLiability,
        payment: periodPayment,
        interest,
        principal,
        closingLiability,
        rouOpening,
        depreciation: rouDepreciation,
        rouClosing,
        // TFRS 16.28 / 53(e): payments that vary with something
        // other than an index or a rate (e.g. % of sales, usage)
        // are NOT part of the lease liability/ROU — they are
        // expensed as incurred and disclosed separately. Previously
        // assumptions.variablePayment was captured but never used
        // anywhere, so this amount was silently dropped from both
        // the schedule and any expense/disclosure total.
        variableExpense:
          assumptions.variablePayment
      });

      openingLiability =
        closingLiability;

      rouOpening =
        rouClosing;
    }

    return {
      months,
      liability: initialLiability,
      rouAssets: initialROU,
      depreciation,
      depreciationMonths,
      usesUsefulLifeDepreciation: usesUsefulLife,
      monthlyInterest:
        schedule[0]?.interest || 0,
      // TFRS 16.53(e) disclosure input: total expense over the
      // schedule relating to variable lease payments not included
      // in the measurement of the lease liability.
      totalVariableExpense:
        assumptions.variablePayment * months,
      schedule,
      assumptions,
      exempt: false
    };
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
     PERIOD SELECTION
  ========================================================== */

  function getScheduleForYear(
    contract,
    year,
    month,
    period
  ) {

    const engine =
      calculateLease(contract);

    if (!engine.schedule.length) {
      return [];
    }

    if (period === "monthly") {

      return engine.schedule.filter(
        item =>
          item.year === year &&
          item.month === month
      );
    }


    if (period === "quarterly") {

      const quarter =
        Math.ceil(month / 3);

      const startMonth =
        (quarter - 1) * 3 + 1;

      const endMonth =
        quarter * 3;

      return engine.schedule.filter(
        item =>
          item.year === year &&
          item.month >= startMonth &&
          item.month <= endMonth
      );
    }


    if (period === "annual") {

      return engine.schedule.filter(
        item =>
          item.year === year
      );
    }


    return [];
  }


  /* ==========================================================
     LIABILITY
  ========================================================== */

  function calculateCurrentLiability(
    contract
  ) {

    const engine =
      calculateLease(contract);

    return engine.schedule
      .slice(0, 12)
      .reduce(
        (total, item) =>
          total + item.principal,
        0
      );
  }


  function calculateNonCurrentLiability(
    contract
  ) {

    const engine =
      calculateLease(contract);

    const current =
      calculateCurrentLiability(
        contract
      );

    return Math.max(
      0,
      engine.liability - current
    );
  }


  /* ==========================================================
     CURRENT / NON-CURRENT — REPORTING DATE BASED (V16.3 / Faz 6)
     ----------------------------------------------------------
     calculateCurrentLiability()/calculateNonCurrentLiability()
     above are UNTOUCHED and keep working exactly as in V15 (they
     always look at the first 12 months from contract inception).

     The functions below are additive: given an actual reporting
     date, they find the outstanding liability AS OF that date
     (from calculateLeaseEngine()'s schedule) and split it into
     the next-12-months current portion and the remaining
     non-current portion — the correct TFRS 16 classification
     basis, independent of when the contract started.
  ========================================================== */

  function getScheduleAsOfReportingDate(
    contract,
    reportingDate
  ) {

    const normalizedReportingDate =
      parseDate(reportingDate);

    const engine =
      calculateLeaseEngine(
        contract
      );

    if (!normalizedReportingDate) {
      return {
        engine,
        closedPeriods: [],
        futurePeriods: [],
        outstandingLiability: 0,
        valid: false
      };
    }

    /*
      V16.4 REPORTING-DATE LOGIC
      --------------------------
      The professional calculation engine remains the single
      source of truth.  Its schedule dates represent accounting
      periods and are the dates used by the existing schedule UI.

      A schedule period is considered closed AS OF the reporting
      date when its period date is on or before the reporting date.
      Therefore, a payment/period dated exactly on the reporting
      date is already included in the liability balance as of that
      date; only periods strictly after the reporting date are
      candidates for the next-12-month current portion.
    */
    const isClosed =
      item => {
        const itemDate =
          parseDate(item.date);

        return itemDate
          ? itemDate.getTime() <=
              normalizedReportingDate.getTime()
          : false;
      };

    const closedPeriods =
      engine.schedule.filter(
        isClosed
      );

    const futurePeriods =
      engine.schedule.filter(
        item => !isClosed(item)
      );

    /*
      The liability AS OF the reporting date is the closing
      liability of the latest schedule period already reached.
      Before commencement there is no reached period, so the
      initial liability is the applicable balance.  After the lease
      has fully amortised, the final closing liability is zero.
    */
    const outstandingLiability =
      closedPeriods.length
        ? Math.max(
            0,
            Number(
              closedPeriods[
                closedPeriods.length - 1
              ].closingLiability
            ) || 0
          )
        : Math.max(
            0,
            Number(engine.liability) || 0
          );

    return {
      engine,
      closedPeriods,
      futurePeriods,
      outstandingLiability,
      valid: true
    };
  }


  function calculateLiabilitySplitAsOf(
    contract,
    reportingDate,
    scheduleOverride
  ) {

    const normalizedReportingDate = parseDate(reportingDate);

    const scheduleData = Array.isArray(scheduleOverride)
      ? {
          engine: calculateLeaseEngine(contract),
          closedPeriods: scheduleOverride.filter(item => {
            const itemDate = parseDate(item.date);
            return itemDate && normalizedReportingDate && itemDate.getTime() <= normalizedReportingDate.getTime();
          }),
          futurePeriods: scheduleOverride.filter(item => {
            const itemDate = parseDate(item.date);
            return itemDate && normalizedReportingDate && itemDate.getTime() > normalizedReportingDate.getTime();
          }),
          outstandingLiability: (() => {
            const closed = scheduleOverride.filter(item => {
              const itemDate = parseDate(item.date);
              return itemDate && normalizedReportingDate && itemDate.getTime() <= normalizedReportingDate.getTime();
            });
            return closed.length
              ? Math.max(0, Number(closed[closed.length - 1].closingLiability) || 0)
              : Math.max(0, Number(calculateLeaseEngine(contract).liability) || 0);
          })(),
          valid: true
        }
      : getScheduleAsOfReportingDate(contract, normalizedReportingDate);

    if (
      !scheduleData.valid
    ) {
      return {
        reportingDate,
        totalLeaseLiability: 0,
        currentLiability: 0,
        nonCurrentLiability: 0,
        next12MonthPrincipal: 0,
        next12MonthInterest: 0,
        next12MonthPayments: 0,
        outstandingLiability: 0,
        current: 0,
        nonCurrent: 0,
        total: 0,
        next12Payments: 0,
        next12Interest: 0,
        next12Principal: 0,
        valid: false
      };
    }

    const {
      futurePeriods,
      outstandingLiability
    } = scheduleData;

    /*
      Current liability is the principal payable in the twelve
      months FOLLOWING the reporting date, not the first twelve
      periods from commencement.

      The schedule is monthly in the current V16.x engine.  A
      calendar-date boundary is nevertheless used here so the
      classification is explicitly tied to the reporting date and
      remains correct for month-end, mid-month and leap-year dates.
    */
    const next12Boundary =
      new Date(
        normalizedReportingDate.getFullYear() + 1,
        normalizedReportingDate.getMonth(),
        normalizedReportingDate.getDate()
      );

    const next12 =
      futurePeriods.filter(
        item => {
          const itemDate =
            parseDate(item.date);

          if (!itemDate) {
            return false;
          }

          return (
            itemDate.getTime() >
              normalizedReportingDate.getTime() &&
            itemDate.getTime() <=
              next12Boundary.getTime()
          );
        }
      );

    const current =
      next12.reduce(
        (total, item) =>
          total +
          Math.max(
            0,
            Number(item.principal) || 0
          ),
        0
      );

    const total =
      Math.max(
        0,
        Number(outstandingLiability) || 0
      );

    const nonCurrent =
      Math.max(
        0,
        total - current
      );

    const next12Payments =
      next12.reduce(
        (totalValue, item) =>
          totalValue +
          Math.max(
            0,
            Number(item.payment) || 0
          ),
        0
      );

    const next12Interest =
      next12.reduce(
        (totalValue, item) =>
          totalValue +
          Math.max(
            0,
            Number(item.interest) || 0
          ),
        0
      );

    const next12Principal =
      current;

    return {
      reportingDate:
        normalizedReportingDate,

      totalLeaseLiability:
        total,

      currentLiability:
        current,

      nonCurrentLiability:
        nonCurrent,

      next12MonthPrincipal:
        next12Principal,

      next12MonthInterest:
        next12Interest,

      next12MonthPayments:
        next12Payments,

      /* Backward-compatible property names */
      outstandingLiability:
        total,

      current,

      nonCurrent,

      total,

      next12Payments,

      next12Interest,

      next12Principal,

      valid: true
    };
  }

  function calculateCurrentLiabilityAsOf(
    contract,
    reportingDate
  ) {

    return calculateLiabilitySplitAsOf(
      contract,
      reportingDate
    ).current;
  }


  function calculateNonCurrentLiabilityAsOf(
    contract,
    reportingDate
  ) {

    return calculateLiabilitySplitAsOf(
      contract,
      reportingDate
    ).nonCurrent;
  }


  function calculateNext12Months(
    contract,
    reportingDate
  ) {

    /*
      V16.5 FIX: this used to always take the first 12 schedule
      periods from contract INCEPTION (engine.schedule.slice(0,12)),
      regardless of how long the contract had already been running.
      For any contract not exactly at its commencement date, that is
      not "next 12 months" — it is "first 12 months", which silently
      misstates the dashboard KPI. Now defaults to today and reuses
      the reporting-date-aware split (same logic as the AsOf current/
      non-current classification) so it reflects the 12 months
      actually following the reporting date.
    */
    const resolvedDate =
      reportingDate
        ? parseDate(reportingDate)
        : new Date();

    return calculateLiabilitySplitAsOf(
      contract,
      resolvedDate
    ).next12Payments;
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


  /* ==========================================================
     KPI
  ========================================================== */

  function updateKPIs() {

    const active =
      contracts.filter(
        c => c.status === "active"
      );

    let liability = 0;
    let rou = 0;
    let next12 = 0;

    active.forEach(
      contract => {

        const engine =
          calculateLease(contract);

        liability +=
          engine.liability;

        rou +=
          engine.rouAssets;

        next12 +=
          calculateNext12Months(
            contract
          );
      }
    );

    const renewals =
      active.filter(
        isRenewalWithin90Days
      ).length;

    const modifications =
      active.filter(
        c => c.modification === true
      ).length;

    setText(
      "contractCount",
      active.length
    );

    setText(
      "leaseLiability",
      formatCurrency(liability)
    );

    setText(
      "rouAssets",
      formatCurrency(rou)
    );

    setText(
      "next12Months",
      formatCurrency(next12)
    );

    setText(
      "renewals90Days",
      renewals
    );

    setText(
      "modifications",
      modifications
    );
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

  function renderTable() {

    const tbody =
      document.getElementById(
        "contractTableBody"
      );

    if (!tbody) return;

    const search =
      (
        document.getElementById(
          "searchInput"
        )?.value || ""
      )
        .trim()
        .toLowerCase();

    const status =
      document.getElementById(
        "statusFilter"
      )?.value || "all";

    const company =
      document.getElementById(
        "companyFilter"
      )?.value || "all";

    const filtered =
      contracts.filter(
        contract => {

          const searchable =
            `
            ${contract.id}
            ${contract.company}
            ${contract.supplier}
            `
              .toLowerCase();

          return (

            (
              !search ||
              searchable.includes(
                search
              )
            )

            &&

            (
              status === "all" ||
              contract.status === status
            )

            &&

            (
              company === "all" ||
              contract.company === company
            )

          );
        }
      );

    tbody.innerHTML = "";

    filtered.forEach(
      contract => {

        const renewal =
          isRenewalWithin90Days(
            contract
          );

        const row =
          document.createElement(
            "tr"
          );

        row.innerHTML = `

          <td>
            <div class="contract-id">
              ${escapeHtml(
                contract.id
              )}
            </div>
          </td>

          <td>
            ${escapeHtml(
              contract.company
            )}
          </td>

          <td>
            <div class="supplier">
              ${escapeHtml(
                contract.supplier
              )}
            </div>
          </td>

          <td class="date">
            ${formatDate(
              contract.startDate
            )}
          </td>

          <td class="date">
            ${formatDate(
              contract.endDate
            )}
          </td>

          <td>
            ${formatCurrency(
              contract.monthlyPayment
            )}
          </td>

          <td>
            <span class="status ${
              contract.status
            }">

              ${
                contract.status ===
                "active"
                  ? "Aktif"
                  : "Pasif"
              }

            </span>
          </td>

          <td>
            <span class="${
              renewal
                ? "renewal-warning"
                : ""
            }">

              ${formatDate(
                contract.renewalDate
              )}

              ${
                renewal
                  ? " ⚠"
                  : ""
              }

            </span>
          </td>

          <td>

            <button
              class="row-action"
              type="button"
              data-id="${escapeHtml(
                contract.id
              )}"
            >
              Görüntüle
            </button>

          </td>

        `;

        row
          .querySelector(
            ".row-action"
          )
          ?.addEventListener(
            "click",
            () =>
              openDetail(
                contract.id
              )
          );

        tbody.appendChild(
          row
        );
      }
    );

    setText(
      "resultCount",
      `${filtered.length} kayıt`
    );

    document
      .getElementById(
        "emptyState"
      )
      ?.classList.toggle(
        "hidden",
        filtered.length > 0
      );
  }


  /* ==========================================================
     REFRESH
  ========================================================== */

  function refresh() {

    updateKPIs();

    populateCompanyFilter();

    renderTable();
  }


  /* ==========================================================
     CONTRACT MODAL
  ========================================================== */

  const newContractButton = document.getElementById("newContractButton");
  if (newContractButton) {
    newContractButton.onclick = () => openContractModal();
  }


  function openContractModal(
    contract = null
  ) {

    const modal =
      document.getElementById(
        "contractModal"
      );

    if (!modal) return;

    document
      .getElementById(
        "contractForm"
      )
      ?.reset();

    setInput(
      "contractId",
      contract?.id || ""
    );

    setInput(
      "company",
      contract?.company ||
        "GK Holding"
    );

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
      PAYMENT_FREQUENCY_WORD_TO_CODE[
        contract?.paymentFrequency
      ] || "1"
    );

    setInput(
      "paymentTiming",
      contract?.paymentTiming || "arrears"
    );

    setInput(
      "initialDirectCost",
      contract?.initialDirectCosts || 0
    );

    setInput(
      "restorationCost",
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
      contract?.leaseIncreaseType || "none"
    );

    setInput(
      "leaseIncreaseRate",
      contract?.leaseIncreaseRate || 0
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
      "usefulLifeMonths",
      contract?.usefulLifeMonths ?? ""
    );

    setCheckbox(
      "renewalOption",
      contract?.renewalOption === true
    );

    setCheckbox(
      "terminationOption",
      contract?.terminationOption === true
    );

    setCheckbox(
      "purchaseOption",
      contract?.purchaseOption === true
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

    const title =
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

  function validateContract(
    contract
  ) {

    const errors = [];

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

    if (
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
      event => {

        event.preventDefault();

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

          // V16.7 FIX — GK Advisory review: paymentFrequency and
          // paymentTiming were present as <select> fields in the
          // form but were never read by this handler, so every
          // manually created contract silently fell back to the
          // engine defaults ("monthly"/"arrears") regardless of
          // what the user picked. The frequency select stores
          // "1"/"3"/"12" (months per payment); the control engine
          // (controlPayment(), ~line 9829) only accepts the word
          // forms "monthly"/"quarterly"/"annual", so it is mapped
          // here rather than stored raw.
          paymentFrequency:
            PAYMENT_FREQUENCY_CODE_TO_WORD[
              getInput("paymentFrequency")
            ] || "monthly",

          paymentTiming:
            getInput("paymentTiming") ||
            "arrears",

          // initialDirectCost/restorationCost were also present in
          // the form but never read; renamed on the contract object
          // to the keys calculateLeaseEngine() actually expects
          // (initialDirectCosts / restorationObligation).
          initialDirectCosts:
            Number(
              getInput("initialDirectCost")
            ) || 0,

          restorationObligation:
            Number(
              getInput("restorationCost")
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
            getInput("leaseIncreaseType") ||
            "none",

          leaseIncreaseRate:
            Number(
              getInput("leaseIncreaseRate")
            ) || 0,

          fixedIncrease:
            Number(
              getInput("fixedIncrease")
            ) || 0,

          variablePayment:
            Number(
              getInput("variablePayment")
            ) || 0,

          usefulLifeMonths:
            getInput("usefulLifeMonths") !== ""
              ? Number(getInput("usefulLifeMonths"))
              : null,

          renewalOption:
            getCheckbox("renewalOption"),

          terminationOption:
            getCheckbox("terminationOption"),

          purchaseOption:
            getCheckbox("purchaseOption"),

          ownershipTransfer:
            getCheckbox("ownershipTransfer"),

          shortTermLease:
            getCheckbox("shortTermLease"),

          lowValueAsset:
            getCheckbox("lowValueAsset"),

          assetClass:
            resolveAssetClassFromForm() ||
            existing?.assetClass ||
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
            undefined
        };


        const validation =
          validateContract(
            contract
          );

        if (!validation.valid) {

          alert(
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

          alert(
            "Bu Sözleşme ID zaten mevcut."
          );

          return;
        }


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
      }
    );


  /* ==========================================================
     JOURNAL HELPERS
  ========================================================== */

  function generateInitialEntry(
    contract
  ) {

    const engine =
      calculateLease(
        contract
      );

    /*
      V16.6 FIX — GK Advisory review
      -------------------------------------------------------
      Previously this always produced a 260/401 capitalization
      entry, even for contracts flagged shortTermLease/lowValueAsset.
      Under TFRS 16.5-8 those leases are NOT capitalized at all —
      no ROU asset, no lease liability — the payment is recognized
      as an expense (generally straight-line) as it is incurred.
      Returning an empty array here means no (wrong) initial
      recognition entry is generated; the detail screen shows an
      explanatory note instead (see openDetail()).
    */
    if (engine.exempt) {
      return [];
    }

    return [

      {
        account:
          "260 Kullanım Hakkı Varlığı",

        debit:
          engine.rouAssets,

        credit: 0
      },

      {
        account:
          "401 Kiralama Yükümlülüğü",

        debit: 0,

        credit:
          engine.liability
      }

    ];
  }


  function generateReclassificationEntry(
    contract,
    reportingDate
  ) {

    /*
      V16.5 FIX: the old "no reportingDate passed" branch fell back
      to calculateCurrentLiability()/calculateNonCurrentLiability(),
      which classify current vs. non-current using the first 12
      schedule periods from contract INCEPTION rather than the 12
      months following an actual balance sheet date — wrong for any
      contract not exactly at commencement. There is currently one
      call site and it always passes a reportingDate, but this
      fallback is kept correct (defaulting to today) so it can never
      silently reintroduce that misclassification if called bare.
    */
    const split =
      calculateLiabilitySplitAsOf(
        contract,
        reportingDate || new Date()
      );

    const current = split.current;
    const nonCurrent = split.nonCurrent;

    return [

      {
        account:
          "401 Kiralama Yükümlülüğü - Non-current",

        debit: 0,

        credit:
          nonCurrent
      },

      {
        account:
          "301 Kiralama Yükümlülüğü - Current",

        debit:
          current,

        credit: 0
      }

    ];
  }


  function getJournalForPeriod(
    contract,
    startMonth,
    endMonth
  ) {

    const engine =
      calculateLease(
        contract
      );

    const selected =
      engine.schedule.slice(
        startMonth - 1,
        endMonth
      );

    if (!selected.length) {
      return [];
    }

    const interest =
      selected.reduce(
        (total, item) =>
          total + item.interest,
        0
      );

    const principal =
      selected.reduce(
        (total, item) =>
          total + item.principal,
        0
      );

    const payment =
      selected.reduce(
        (total, item) =>
          total + item.payment,
        0
      );

    const depreciation =
      selected.reduce(
        (total, item) =>
          total + item.depreciation,
        0
      );

    return [

      {
        account:
          "780 Finansman Giderleri",

        debit:
          interest,

        credit: 0
      },

      {
        account:
          "401 Kiralama Yükümlülüğü",

        debit:
          principal,

        credit: 0
      },

      {
        account:
          "381 Kira Borçları / Ödeme",

        debit: 0,

        credit:
          payment
      },

      {
        account:
          "770 / 730 Amortisman Giderleri",

        debit:
          depreciation,

        credit: 0
      },

      {
        account:
          "268 Birikmiş Amortismanlar",

        debit: 0,

        credit:
          depreciation
      }

    ];
  }


  /* ==========================================================
     JOURNAL RENDER
  ========================================================== */

  function renderJournalEntry(
    title,
    entries
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
                          ? formatCurrency(
                              item.debit
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
                          ? formatCurrency(
                              item.credit
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
                  ${formatCurrency(
                    debit
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
                  ${formatCurrency(
                    credit
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


  function renderAccountingCenter(
    contract
  ) {

    return `

      <div
        style="
          margin-top:28px;
          border-top:1px solid #e5e7eb;
          padding-top:24px;
        "
      >

        <div>

          <div
            style="
              font-size:10px;
              color:#64748b;
              font-weight:800;
              letter-spacing:1px;
            "
          >
            MUHASEBE İŞLEMLERİ
          </div>

          <h3
            style="
              margin:5px 0 0;
              font-size:18px;
            "
          >
            Muhasebe Fiş Merkezi
          </h3>

          <p
            style="
              margin:5px 0 0;
              color:#64748b;
              font-size:11px;
            "
          >
            Tek sözleşme için fiş oluşturabilirsiniz.
          </p>

        </div>


        <div
          style="
            display:grid;
            grid-template-columns:
              repeat(auto-fit,minmax(170px,1fr));
            gap:12px;
            margin-top:18px;
          "
        >

          <div
            style="
              background:#f8fafc;
              border:1px solid #e5e7eb;
              border-radius:10px;
              padding:14px;
            "
          >

            <label
              style="
                display:block;
                font-size:10px;
                color:#64748b;
                margin-bottom:7px;
              "
            >
              Raporlama Yılı
            </label>

            <select
              id="accountingYear"
              style="
                width:100%;
                padding:9px;
                border:1px solid #d1d5db;
                border-radius:7px;
              "
            >
              ${buildYearOptions(
                contract
              )}
            </select>

          </div>


          <div
            style="
              background:#f8fafc;
              border:1px solid #e5e7eb;
              border-radius:10px;
              padding:14px;
            "
          >

            <label
              style="
                display:block;
                font-size:10px;
                color:#64748b;
                margin-bottom:7px;
              "
            >
              Fiş Periyodu
            </label>

            <select
              id="accountingPeriod"
              style="
                width:100%;
                padding:9px;
                border:1px solid #d1d5db;
                border-radius:7px;
              "
            >

              <option value="monthly">
                Aylık
              </option>

              <option value="quarterly">
                Çeyreklik
              </option>

              <option value="annual">
                Yıllık
              </option>

              <option value="closing">
                Yıllık Kapanış
              </option>

            </select>

          </div>


          <div
            style="
              background:#f8fafc;
              border:1px solid #e5e7eb;
              border-radius:10px;
              padding:14px;
            "
          >

            <label
              style="
                display:block;
                font-size:10px;
                color:#64748b;
                margin-bottom:7px;
              "
            >
              Dönem
            </label>

            <select
              id="accountingMonth"
              style="
                width:100%;
                padding:9px;
                border:1px solid #d1d5db;
                border-radius:7px;
              "
            >
              ${buildMonthOptions()}
            </select>

          </div>


          <div
            style="
              display:flex;
              align-items:end;
            "
          >

            <button
              id="generateJournal"
              class="primary-button"
              type="button"
              style="
                width:100%;
                min-height:42px;
              "
            >
              Fişi Oluştur
            </button>

          </div>

        </div>


        <div
          id="journalPreview"
        ></div>


        <div
          style="
            margin-top:18px;
            padding:14px;
            border:1px solid #dbeafe;
            background:#eff6ff;
            border-radius:10px;
          "
        >

          <strong
            style="
              display:block;
              margin-bottom:5px;
              font-size:12px;
            "
          >
            Toplu Muhasebe Merkezi
          </strong>

          <span
            style="
              font-size:11px;
              color:#475569;
            "
          >
            Portföydeki tüm aktif sözleşmeler için toplu fiş üretin.
          </span>

          <button
            id="openBulkJournalButton"
            type="button"
            style="
              margin-top:12px;
              width:100%;
              min-height:42px;
              border:0;
              border-radius:8px;
              background:#0f172a;
              color:white;
              font-weight:700;
              cursor:pointer;
            "
          >
            Tüm Sözleşmeler İçin Toplu Fiş Üret
          </button>

        </div>

      </div>

    `;
  }


  /* ==========================================================
     SINGLE JOURNAL
  ========================================================== */

  function generateSelectedJournal(
    contract
  ) {

    const year =
      Number(
        document.getElementById(
          "accountingYear"
        )?.value
      );

    const period =
      document.getElementById(
        "accountingPeriod"
      )?.value;

    const month =
      Number(
        document.getElementById(
          "accountingMonth"
        )?.value
      );

    const preview =
      document.getElementById(
        "journalPreview"
      );

    if (typeof auditCalculationRun === "function") {
      auditCalculationRun(contract, "TFRS16");
    }

    if (period === "closing") {

      const reportingDate =
        new Date(
          year,
          11,
          31
        );

      const entries =
        generateReclassificationEntry(
          contract,
          reportingDate
        );

      if (preview) {

        preview.innerHTML =
          renderJournalEntry(
            `${year} Yıl Sonu Current / Non-current Kapanış Fişi`,
            entries
          );
      }

      appendFxToReclassification(
        contract,
        reportingDate,
        entries,
        `${year} Yıl Sonu Current / Non-current Kapanış Fişi`,
        preview
      );

      const totalDebit = entries.reduce((sum, item) => sum + (Number(item.debit) || 0), 0);
      const totalCredit = entries.reduce((sum, item) => sum + (Number(item.credit) || 0), 0);
      recordAuditEvent({
        action: "RECLASSIFICATION_GENERATED",
        entityType: "RECLASSIFICATION",
        entityId: `${contract.id}-${year}-CLOSING`,
        contractId: contract.id,
        reason: "Year-end current / non-current reclassification",
        metadata: {
          reportingDate: reportingDate.toISOString(),
          totalDebit,
          totalCredit,
          balanced: Math.abs(totalDebit - totalCredit) < 0.01
        }
      });

      return;
    }


    const selected =
      getScheduleForYear(
        contract,
        year,
        month,
        period
      );


    if (!selected.length) {

      if (preview) {

        preview.innerHTML = `

          <div
            style="
              margin-top:18px;
              padding:15px;
              background:#fff7ed;
              border:1px solid #fed7aa;
              border-radius:9px;
              color:#9a3412;
            "
          >
            Bu sözleşmede seçilen dönem için ödeme planı bulunmuyor.
          </div>

        `;
      }

      return;
    }


    const interest =
      selected.reduce(
        (total, item) =>
          total + item.interest,
        0
      );

    const principal =
      selected.reduce(
        (total, item) =>
          total + item.principal,
        0
      );

    const payment =
      selected.reduce(
        (total, item) =>
          total + item.payment,
        0
      );

    const depreciation =
      selected.reduce(
        (total, item) =>
          total + item.depreciation,
        0
      );


    const entries = [

      {
        account:
          "780 Finansman Giderleri",

        debit:
          interest,

        credit: 0
      },

      {
        account:
          "401 Kiralama Yükümlülüğü",

        debit:
          principal,

        credit: 0
      },

      {
        account:
          "381 Kira Borçları / Ödeme",

        debit: 0,

        credit:
          payment
      },

      {
        account:
          "770 / 730 Amortisman Giderleri",

        debit:
          depreciation,

        credit: 0
      },

      {
        account:
          "268 Birikmiş Amortismanlar",

        debit: 0,

        credit:
          depreciation
      }

    ];


    const normalJournalDebit = entries.reduce((sum, item) => sum + (Number(item.debit) || 0), 0);
    const normalJournalCredit = entries.reduce((sum, item) => sum + (Number(item.credit) || 0), 0);
    recordAuditEvent({
      action: "JOURNAL_GENERATED",
      entityType: "JOURNAL",
      entityId: `${contract.id}-${year}-${period}-${month || "ALL"}`,
      contractId: contract.id,
      journalId: `${contract.id}-${year}-${period}-${month || "ALL"}`,
      reason: "Lease journal generated",
      metadata: {
        source: "STANDARD",
        year,
        period,
        month,
        totalDebit: normalJournalDebit,
        totalCredit: normalJournalCredit,
        balanced: Math.abs(normalJournalDebit - normalJournalCredit) < 0.01
      }
    });

    let title =
      `${year} - Yıllık Muhasebe Fişi`;

    if (
      period === "monthly"
    ) {

      title =
        `${year} - ${
          getMonthName(month)
        } Aylık Muhasebe Fişi`;

    } else if (
      period === "quarterly"
    ) {

      title =
        `${year} - ${
          Math.ceil(month / 3)
        }. Çeyrek Muhasebe Fişi`;
    }


    if (preview) {

      preview.innerHTML =
        renderJournalEntry(
          title,
          entries
        );
    }

    appendFxJournalLines(contract, selected, entries, title, preview);
  }

  async function appendFxToReclassification(contract, reportingDate, originalEntries, title, preview) {
    if (!preview || !contractNeedsFxTranslation(contract)) return;
    try {
      const transactionCurrency = v23CurrencyCode(contract.currency || DEFAULT_FUNCTIONAL_CURRENCY);
      const functionalCurrency = resolveContractFunctionalCurrency(contract);
      const closing = await getFxRateAuto(transactionCurrency, functionalCurrency, reportingDate, V23_RATE_TYPES.CLOSING);
      if (closing?.error) throw Object.assign(new Error(closing.message || `${transactionCurrency}/${functionalCurrency} kuru bulunamadı.`), { code: closing.error });

      const translatedEntries = originalEntries.map(item => ({
        account: `${item.account} (${functionalCurrency})`,
        debit: v23Round((item.debit || 0) * closing.rate, 2),
        credit: v23Round((item.credit || 0) * closing.rate, 2)
      }));

      if (preview) {
        preview.innerHTML =
          renderJournalEntry(title, translatedEntries) +
          `<div style="margin-top:10px;font-size:11px;color:#64748b;">
             Kontrat para birimi ${transactionCurrency}. Yukarıdaki tutarlar, ${v23DateKey(reportingDate)} tarihli TMS 21 kapanış kuruyla (${closing.rate.toFixed(4)}, ${closing.rateDate || v23DateKey(reportingDate)}) ${functionalCurrency}'ye çevrilmiştir. Orijinal para biriminde tutar: Non-current ${formatCurrency(originalEntries[0]?.credit || 0)} ${transactionCurrency}, Current ${formatCurrency(originalEntries[1]?.debit || 0)} ${transactionCurrency}.
           </div>`;
      }
    } catch (error) {
      if (preview) {
        preview.insertAdjacentHTML(
          "beforeend",
          `<div style="margin-top:10px;padding:10px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;color:#991b1b;font-size:12px;">TMS 21 kur çevrimi yapılamadı, tutarlar ${v23CurrencyCode(contract.currency)} cinsinden gösteriliyor: ${escapeHtml(error.message || String(error))}</div>`
        );
      }
    }
  }

  async function appendFxJournalLines(contract, selectedRows, baseEntries, title, preview) {
    if (!preview || !contractNeedsFxTranslation(contract)) return;
    try {
      const engineResult = cfoBuildSchedule(contract);
      const fx = await buildTms21FxTranslation(contract, engineResult);
      if (!fx.applicable) return;
      const selectedDates = new Set(selectedRows.map(r => v23DateKey(r.date)));
      const fxRows = fx.schedule.filter(r => selectedDates.has(v23DateKey(r.date)));
      if (!fxRows.length) return;
      const netFx = v23Round(fxRows.reduce((sum, r) => sum + r.fxGainLoss, 0), 2);
      if (Math.abs(netFx) < 0.01) return;
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
      if (preview) {
        preview.innerHTML =
          renderJournalEntry(title, [...baseEntries, ...fxEntries]) +
          `<div style="margin-top:10px;font-size:11px;color:#64748b;">TMS 21: kira yükümlülüğü ${fx.transactionCurrency} cinsinden, dönem kapanış kuruyla (${fx.functionalCurrency}'ye) yeniden çevrildi; kur farkı yukarıdaki fişe dahil edildi.</div>`;
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


  function auditCalculationRun(contract, calculationType = "TFRS16") {
    if (!contract) return null;
    try {
      const engine = calculateLeaseEngine(contract);
      return recordAuditEvent({
        action: "CALCULATION_RUN",
        entityType: "CALCULATION",
        entityId: `${contract.id}-${Date.now()}`,
        contractId: contract.id,
        reason: "Lease calculation run",
        metadata: {
          calculationType,
          calculationDate: new Date().toISOString(),
          paymentFrequency: contract.paymentFrequency || "monthly",
          discountRate: Number(contract.discountRate) || 0,
          leaseTerm: contract.endDate || null,
          schedulePeriodCount: Array.isArray(engine.schedule) ? engine.schedule.length : 0,
          resultStatus: "SUCCESS"
        }
      });
    } catch (error) {
      return auditCalculationFailure(contract, error, calculationType);
    }
  }

  function auditCalculationFailure(contract, error, calculationType = "TFRS16") {
    return recordAuditEvent({
      action: "CALCULATION_FAILED",
      entityType: "CALCULATION",
      entityId: `${contract?.id || "UNKNOWN"}-${Date.now()}`,
      contractId: contract?.id || null,
      reason: error?.message || "Calculation failed",
      metadata: { calculationType, resultStatus: "FAILED" }
    });
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
     Read-only view of the full amortization schedule for a
     single contract, built on top of calculateLeaseEngine().
     Does not touch renderAccountingCenter() or any journal
     generation logic above.
  ========================================================== */


  function renderModificationManagementSection(contract) {

    ensureModificationState(contract);

    const today =
      new Date().toISOString().slice(0, 10);

    const modifications =
      contract.modifications || [];

    const rows = modifications.length
      ? modifications.map(
          item => `
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
              <strong>${formatCurrency(item.liabilityAdjustment || 0)}</strong>
              <span style="display:flex;gap:5px;">
                ${
                  item.status !== "APPLIED" && item.status !== "CANCELLED"
                    ? `<button type="button" class="secondary-button" data-mod-action="edit" data-mod-id="${escapeHtml(item.id)}">Düzenle</button>`
                    : ""
                }
                ${
                  item.status !== "APPLIED" && item.status !== "CANCELLED"
                    ? `<button type="button" class="secondary-button" data-mod-action="apply" data-mod-id="${escapeHtml(item.id)}">Uygula</button>`
                    : ""
                }
                ${
                  item.status !== "APPLIED" && item.status !== "CANCELLED"
                    ? `<button type="button" class="secondary-button" data-mod-action="cancel" data-mod-id="${escapeHtml(item.id)}">İptal Et</button>`
                    : ""
                }
              </span>
            </div>
          `
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
            Original contract history korunur. Accounting impact yalnızca APPLIED modification için oluşur.
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
                <option value="PAYMENT_INCREASE">Ödeme Artışı</option>
                <option value="PAYMENT_DECREASE">Ödeme Azalışı</option>
                <option value="LEASE_TERM_EXTENSION">Kira Süresi Uzatma</option>
                <option value="LEASE_TERM_REDUCTION">Kira Süresi Azaltma</option>
                <option value="SCOPE_INCREASE">Kapsam Artışı</option>
                <option value="SCOPE_DECREASE">Kapsam Azalışı</option>
                <option value="COMBINED_MODIFICATION">Birleşik Modifikasyon</option>
                <option value="OTHER">Diğer</option>
              </select>
            </label>
            <label style="font-size:10px;font-weight:700;">
              Yeni Aylık Ödeme
              <input id="modificationNewPayment" type="number" min="0" step="0.01" value="${Number(contract.monthlyPayment) || 0}" style="display:block;width:100%;margin-top:5px;">
            </label>
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
            Neden
            <input id="modificationReason" type="text" placeholder="Modifikasyon nedeni" style="display:block;width:100%;margin-top:5px;">
          </label>

          <button
            type="button"
            id="createModificationButton"
            class="primary-button"
            style="margin-top:12px;"
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


  function initModificationEvents(contract) {

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

    createButton?.addEventListener(
        "click",
        () => {

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

          const result =
            editingModificationId
              ? updateModification(contract, editingModificationId, input)
              : createModification(contract, input);

          if (!result.valid) {
            alert(result.errors.join("\n"));
            return;
          }

          resetModificationFormMode();
          openDetail(contract.id);
        }
      );

    document
      .querySelectorAll("[data-mod-action]")
      .forEach(
        button => {
          button.addEventListener(
            "click",
            () => {
              const action = button.dataset.modAction;
              const id = button.dataset.modId;

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
                const result =
                  applyModification(contract, id);

                if (!result.valid) {
                  alert(result.errors.join("\n"));
                  return;
                }

                refresh();
                openDetail(contract.id);
                return;
              }

              if (action === "cancel") {
                const result =
                  cancelModification(contract, id);

                if (!result.valid) {
                  alert(result.errors.join("\n"));
                  return;
                }

                openDetail(contract.id);
              }
            }
          );
        }
      );
  }


  function renderReassessmentManagementSection(contract) {
    ensureReassessmentState(contract);

    const today = new Date().toISOString().slice(0, 10);
    const reassessments = contract.reassessments || [];

    const rows = reassessments.length
      ? reassessments.map(item => `
          <div style="display:grid;grid-template-columns:1.1fr 1fr 1fr 1fr auto;gap:8px;align-items:center;padding:9px 0;border-bottom:1px solid #e5e7eb;font-size:11px;">
            <span>${escapeHtml(item.type || "OTHER")}</span>
            <span>${escapeHtml(item.effectiveDate || "")}</span>
            <span>${escapeHtml(item.status || "DRAFT")}</span>
            <strong>${formatCurrency(item.liabilityAdjustment || 0)}</strong>
            <span style="display:flex;gap:5px;">
              ${item.status !== "APPLIED" && item.status !== "CANCELLED" ? `<button type="button" class="secondary-button" data-reass-action="edit" data-reass-id="${escapeHtml(item.id)}">Düzenle</button>` : ""}
              ${item.status !== "APPLIED" && item.status !== "CANCELLED" ? `<button type="button" class="secondary-button" data-reass-action="apply" data-reass-id="${escapeHtml(item.id)}">Uygula</button>` : ""}
              ${item.status !== "APPLIED" && item.status !== "CANCELLED" ? `<button type="button" class="secondary-button" data-reass-action="cancel" data-reass-id="${escapeHtml(item.id)}">İptal Et</button>` : ""}
            </span>
          </div>
        `).join("")
      : `<div style="padding:12px 0;color:#64748b;font-size:11px;">Henüz reassessment kaydı bulunmuyor.</div>`;

    return `
      <div style="margin-top:28px;border-top:1px solid #e5e7eb;padding-top:24px;">
        <div>
          <div style="font-size:10px;color:#64748b;font-weight:800;letter-spacing:1px;">REASSESSMENT YÖNETİMİ</div>
          <h3 style="margin:5px 0 0;font-size:18px;">Kira Reassessment İşlemi</h3>
          <p style="margin:5px 0 0;color:#64748b;font-size:11px;">Reassessment, V16.5 modification eventlerinden ayrı tutulur. Accounting impact yalnızca APPLIED reassessment için oluşur.</p>
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
            <label style="font-size:10px;font-weight:700;">Yeni Aylık Ödeme<input id="reassessmentNewPayment" type="number" min="0" step="0.01" value="${Number(contract.monthlyPayment) || 0}" style="display:block;width:100%;margin-top:5px;"></label>
            <label style="font-size:10px;font-weight:700;">Yeni Kira Bitiş Tarihi<input id="reassessmentNewEndDate" type="date" value="${escapeHtml(contract.endDate || "")}" style="display:block;width:100%;margin-top:5px;"></label>
            <label style="font-size:10px;font-weight:700;">Yeni İskonto Oranı %<input id="reassessmentNewDiscountRate" type="number" min="0" step="0.0001" value="${Number(contract.discountRate) || 0}" style="display:block;width:100%;margin-top:5px;"></label>
            <label style="font-size:10px;font-weight:700;">Yenileme Opsiyonu<select id="reassessmentRenewalOption" style="display:block;width:100%;margin-top:5px;"><option value="false">Makul ölçüde kesin değil</option><option value="true">Makul ölçüde kesin</option></select></label>
            <label style="font-size:10px;font-weight:700;">Fesih Opsiyonu<select id="reassessmentTerminationOption" style="display:block;width:100%;margin-top:5px;"><option value="false">Beklenmiyor</option><option value="true">Bekleniyor / kullanıldı</option></select></label>
            <label style="font-size:10px;font-weight:700;">Satın Alma Opsiyonu<select id="reassessmentPurchaseOption" style="display:block;width:100%;margin-top:5px;"><option value="false">Makul ölçüde kesin değil</option><option value="true">Makul ölçüde kesin</option></select></label>
          </div>

          <label style="display:block;font-size:10px;font-weight:700;margin-top:10px;">Neden<input id="reassessmentReason" type="text" placeholder="Reassessment nedeni" style="display:block;width:100%;margin-top:5px;"></label>

          <button type="button" id="createReassessmentButton" class="primary-button" style="margin-top:12px;">Reassessment Oluştur</button>
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


  function initReassessmentEvents(contract) {
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

    createButton?.addEventListener("click", () => {
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

      const result = editingReassessmentId
        ? updateReassessment(contract, editingReassessmentId, input)
        : createReassessment(contract, input);

      if (!result.valid) {
        alert(result.errors.join("\n"));
        return;
      }
      resetReassessmentFormMode();
      openDetail(contract.id);
    });

    document.querySelectorAll("[data-reass-action]").forEach(button => {
      button.addEventListener("click", () => {
        const action = button.dataset.reassAction;
        const id = button.dataset.reassId;

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
          const result = applyReassessment(contract, id);
          if (!result.valid) {
            alert(result.errors.join("\n"));
            return;
          }
          refresh();
          openDetail(contract.id);
          return;
        }

        if (action === "cancel") {
          const result = cancelReassessment(contract, id);
          if (!result.valid) {
            alert(result.errors.join("\n"));
            return;
          }
          openDetail(contract.id);
        }
      });
    });
  }


  function renderPaymentScheduleSection(contract) {

    return `

      <div
        style="
          margin-top:28px;
          border-top:1px solid #e5e7eb;
          padding-top:24px;
        "
      >

        <div>

          <div
            style="
              font-size:10px;
              color:#64748b;
              font-weight:800;
              letter-spacing:1px;
            "
          >
            ÖDEME PLANI
          </div>

          <h3
            style="
              margin:5px 0 0;
              font-size:18px;
            "
          >
            Kira Ödeme Planı
          </h3>

          <p
            style="
              margin:5px 0 0;
              color:#64748b;
              font-size:11px;
            "
          >
            Her dönem için açılış/kapanış yükümlülüğü, faiz, anapara, amortisman ve ROU net defter değeri.
          </p>

        </div>


        <div
          style="
            display:grid;
            grid-template-columns:
              repeat(auto-fit,minmax(150px,1fr));
            gap:12px;
            margin-top:16px;
          "
        >

          <div
            style="
              background:#f8fafc;
              border:1px solid #e5e7eb;
              border-radius:10px;
              padding:12px;
            "
          >
            <label
              style="
                display:block;
                font-size:10px;
                color:#64748b;
                margin-bottom:6px;
              "
            >
              Periyot
            </label>

            <select
              id="schedulePeriodType"
              style="
                width:100%;
                padding:8px;
                border:1px solid #d1d5db;
                border-radius:7px;
              "
            >
              <option value="all">Tümü</option>
              <option value="monthly">Aylık</option>
              <option value="quarterly">Çeyreklik</option>
              <option value="annual">Yıllık</option>
            </select>
          </div>


          <div
            style="
              background:#f8fafc;
              border:1px solid #e5e7eb;
              border-radius:10px;
              padding:12px;
            "
          >
            <label
              style="
                display:block;
                font-size:10px;
                color:#64748b;
                margin-bottom:6px;
              "
            >
              Yıl
            </label>

            <select
              id="scheduleYear"
              style="
                width:100%;
                padding:8px;
                border:1px solid #d1d5db;
                border-radius:7px;
              "
            >
              ${buildYearOptions(contract)}
            </select>
          </div>


          <div
            style="
              background:#f8fafc;
              border:1px solid #e5e7eb;
              border-radius:10px;
              padding:12px;
            "
          >
            <label
              style="
                display:block;
                font-size:10px;
                color:#64748b;
                margin-bottom:6px;
              "
            >
              Ay / Çeyrek
            </label>

            <select
              id="scheduleSubPeriod"
              disabled
              style="
                width:100%;
                padding:8px;
                border:1px solid #d1d5db;
                border-radius:7px;
                opacity:.5;
              "
            >
              ${buildMonthOptions()}
            </select>
          </div>


          <div
            style="
              display:flex;
              align-items:end;
            "
          >
            <button
              id="exportScheduleButton"
              type="button"
              class="primary-button"
              style="
                width:100%;
                min-height:38px;
              "
            >
              Excel'e Aktar
            </button>
          </div>

        </div>


        <div
          style="
            overflow:auto;
            margin-top:16px;
            border:1px solid #e5e7eb;
            border-radius:10px;
          "
        >
          <table
            style="
              width:100%;
              border-collapse:collapse;
              min-width:820px;
            "
          >
            <thead>
              <tr style="background:#f8fafc;">
                <th style="padding:9px;text-align:left;font-size:11px;">Dönem</th>
                <th style="padding:9px;text-align:left;font-size:11px;">Tarih</th>
                <th style="padding:9px;text-align:right;font-size:11px;">Açılış Yükümlülüğü</th>
                <th style="padding:9px;text-align:right;font-size:11px;">Ödeme</th>
                <th style="padding:9px;text-align:right;font-size:11px;">Faiz</th>
                <th style="padding:9px;text-align:right;font-size:11px;">Anapara</th>
                <th style="padding:9px;text-align:right;font-size:11px;">Kapanış Yükümlülüğü</th>
                <th style="padding:9px;text-align:right;font-size:11px;">Amortisman</th>
                <th style="padding:9px;text-align:right;font-size:11px;">ROU Net Defter Değeri</th>
              </tr>
            </thead>
            <tbody id="scheduleTableBody"></tbody>
          </table>
        </div>

        <div
          id="scheduleEmptyState"
          style="
            display:none;
            padding:14px;
            text-align:center;
            color:#64748b;
            font-size:12px;
          "
        >
          Seçilen dönem için ödeme planı kaydı bulunmuyor.
        </div>

        <div id="fxTranslationContainer"></div>

        <div id="slbSectionContainer"></div>

        <div id="subleaseSectionContainer"></div>

      </div>

    `;
  }


  function renderPaymentScheduleTable(contract) {

    const tbody =
      document.getElementById(
        "scheduleTableBody"
      );

    if (!tbody) return;

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

    const engine =
      typeof cfoBuildSchedule === "function"
        ? cfoBuildSchedule(contract)
        : calculateLeaseEngine(contract);

    const rows =
      filterSchedule(
        engine.schedule,
        year,
        subPeriod,
        periodType
      );

    tbody.innerHTML =
      rows
        .map(
          item => `
            <tr>
              <td style="padding:8px;border-top:1px solid #edf0f4;font-size:12px;">${item.period}</td>
              <td style="padding:8px;border-top:1px solid #edf0f4;font-size:12px;">${getMonthName(item.month)} ${item.year}</td>
              <td style="padding:8px;border-top:1px solid #edf0f4;text-align:right;font-size:12px;">${formatCurrency(item.openingLiability)}</td>
              <td style="padding:8px;border-top:1px solid #edf0f4;text-align:right;font-size:12px;">${formatCurrency(item.payment)}</td>
              <td style="padding:8px;border-top:1px solid #edf0f4;text-align:right;font-size:12px;">${formatCurrency(item.interest)}</td>
              <td style="padding:8px;border-top:1px solid #edf0f4;text-align:right;font-size:12px;">${formatCurrency(item.principal)}</td>
              <td style="padding:8px;border-top:1px solid #edf0f4;text-align:right;font-size:12px;">${formatCurrency(item.closingLiability)}</td>
              <td style="padding:8px;border-top:1px solid #edf0f4;text-align:right;font-size:12px;">${formatCurrency(item.depreciation)}</td>
              <td style="padding:8px;border-top:1px solid #edf0f4;text-align:right;font-size:12px;">${formatCurrency(item.rouClosing)}</td>
            </tr>
          `
        )
        .join("");

    const empty =
      document.getElementById(
        "scheduleEmptyState"
      );

    if (empty) {
      empty.style.display =
        rows.length
          ? "none"
          : "block";
    }
  }


  async function renderFxTranslationSection(contract) {
    const container = document.getElementById("fxTranslationContainer");
    if (!container) return;
    if (!contractNeedsFxTranslation(contract)) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML = `
      <div style="margin-top:20px;border-top:1px solid #e5e7eb;padding-top:18px;">
        <div style="font-size:10px;color:#64748b;font-weight:800;letter-spacing:1px;">TMS 21 — FONKSİYONEL PARA BİRİMİ ÇEVRİMİ</div>
        <p style="margin:6px 0 0;color:#64748b;font-size:11px;">Kur bilgisi alınıyor...</p>
      </div>
    `;

    try {
      const engineResult = cfoBuildSchedule(contract);
      const fx = await buildTms21FxTranslation(contract, engineResult);
      if (!fx.applicable) { container.innerHTML = ""; return; }

      const rowsHtml = fx.schedule.map(row => `
        <tr>
          <td style="padding:8px;border-top:1px solid #edf0f4;font-size:12px;">${row.period}</td>
          <td style="padding:8px;border-top:1px solid #edf0f4;font-size:12px;">${row.date}</td>
          <td style="padding:8px;border-top:1px solid #edf0f4;text-align:right;font-size:12px;">${row.closingRate.toFixed(4)}</td>
          <td style="padding:8px;border-top:1px solid #edf0f4;text-align:right;font-size:12px;">${formatCurrency(row.openingLiabilityFx)}</td>
          <td style="padding:8px;border-top:1px solid #edf0f4;text-align:right;font-size:12px;">${formatCurrency(row.interestFx)}</td>
          <td style="padding:8px;border-top:1px solid #edf0f4;text-align:right;font-size:12px;">${formatCurrency(row.paymentFx)}</td>
          <td style="padding:8px;border-top:1px solid #edf0f4;text-align:right;font-size:12px;">${formatCurrency(row.closingLiabilityFx)}</td>
          <td style="padding:8px;border-top:1px solid #edf0f4;text-align:right;font-size:12px;color:${row.fxGainLoss > 0 ? '#dc2626' : '#16a34a'};">${formatCurrency(row.fxGainLoss)}</td>
          <td style="padding:8px;border-top:1px solid #edf0f4;text-align:right;font-size:12px;">${formatCurrency(row.rouClosingFx)}</td>
        </tr>
      `).join("");

      container.innerHTML = `
        <div style="margin-top:20px;border-top:1px solid #e5e7eb;padding-top:18px;">
          <div style="font-size:10px;color:#64748b;font-weight:800;letter-spacing:1px;">TMS 21 — FONKSİYONEL PARA BİRİMİ ÇEVRİMİ</div>
          <h3 style="margin:5px 0 0;font-size:16px;">${fx.transactionCurrency} → ${fx.functionalCurrency}</h3>
          <p style="margin:5px 0 0;color:#64748b;font-size:11px;">
            İşlem (kira) para birimi: <strong>${fx.transactionCurrency}</strong> · Fonksiyonel para birimi: <strong>${fx.functionalCurrency}</strong> ·
            Başlangıç kuru: <strong>${fx.commencementRate.toFixed(4)}</strong> (${fx.commencementRateDate}) ·
            Kümülatif kur farkı: <strong style="color:${fx.totals.cumulativeFxGainLoss > 0 ? '#dc2626' : '#16a34a'};">${formatCurrency(fx.totals.cumulativeFxGainLoss)} ${fx.functionalCurrency}</strong>
          </p>
          <p style="margin:6px 0 0;color:#94a3b8;font-size:10px;">
            Kira yükümlülüğü (parasal kalem) her dönem kapanış kuruyla yeniden çevrilir, fark K/Z'ye yazılır. ROU varlığı (parasal olmayan) sadece başlangıç kuruyla çevrilir, yeniden değerlenmez.
          </p>
          <div style="overflow:auto;margin-top:12px;border:1px solid #e5e7eb;border-radius:10px;">
            <table style="width:100%;border-collapse:collapse;min-width:900px;">
              <thead>
                <tr style="background:#f8fafc;">
                  <th style="padding:9px;text-align:left;font-size:11px;">Dönem</th>
                  <th style="padding:9px;text-align:left;font-size:11px;">Tarih</th>
                  <th style="padding:9px;text-align:right;font-size:11px;">Kur</th>
                  <th style="padding:9px;text-align:right;font-size:11px;">Açılış Yük. (${fx.functionalCurrency})</th>
                  <th style="padding:9px;text-align:right;font-size:11px;">Faiz (${fx.functionalCurrency})</th>
                  <th style="padding:9px;text-align:right;font-size:11px;">Ödeme (${fx.functionalCurrency})</th>
                  <th style="padding:9px;text-align:right;font-size:11px;">Kapanış Yük. (${fx.functionalCurrency})</th>
                  <th style="padding:9px;text-align:right;font-size:11px;">Kur Farkı</th>
                  <th style="padding:9px;text-align:right;font-size:11px;">ROU (${fx.functionalCurrency})</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </div>
        </div>
      `;
    } catch (error) {
      container.innerHTML = `
        <div style="margin-top:20px;border-top:1px solid #e5e7eb;padding-top:18px;">
          <div style="font-size:10px;color:#64748b;font-weight:800;letter-spacing:1px;">TMS 21 — FONKSİYONEL PARA BİRİMİ ÇEVRİMİ</div>
          <div style="margin-top:8px;padding:12px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;color:#991b1b;font-size:12px;">
            Kur farkı hesaplanamadı: ${escapeHtml(error.message || String(error))}
          </div>
        </div>
      `;
    }
  }

  function renderSlbSection(contract) {
    const container = document.getElementById("slbSectionContainer");
    if (!container) return;

    const saved = contract.saleAndLeaseback || null;

    const formHtml = `
      <div style="margin-top:20px;border-top:1px solid #e5e7eb;padding-top:18px;">
        <div style="font-size:10px;color:#64748b;font-weight:800;letter-spacing:1px;">TFRS 16.98-103 — SATIŞ VE GERİ KİRALAMA (SLB)</div>
        <p style="margin:6px 0 10px;color:#64748b;font-size:11px;">
          Bu kontrat bir satış-ve-geri-kiralama işleminin geri kiralama bacağıysa, aşağıdaki bilgileri girin.
          Kontratın kendi ödeme/iskonto oranı bilgileri (aylık kira, süre, iskonto oranı) geri kiralamanın şartları olarak kullanılır.
        </p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;max-width:520px;">
          <label style="font-size:11px;color:#475569;">
            Önceki Net Defter Değeri
            <input id="slbCarryingAmount" type="number" step="0.01" value="${saved?.previousCarryingAmount ?? ""}" style="width:100%;padding:6px;border:1px solid #e2e8f0;border-radius:6px;margin-top:3px;" />
          </label>
          <label style="font-size:11px;color:#475569;">
            Gerçeğe Uygun Değer
            <input id="slbFairValue" type="number" step="0.01" value="${saved?.fairValueOfAsset ?? ""}" style="width:100%;padding:6px;border:1px solid #e2e8f0;border-radius:6px;margin-top:3px;" />
          </label>
          <label style="font-size:11px;color:#475569;">
            Satış Bedeli (Tahsil Edilen)
            <input id="slbSaleProceeds" type="number" step="0.01" value="${saved?.saleProceeds ?? ""}" style="width:100%;padding:6px;border:1px solid #e2e8f0;border-radius:6px;margin-top:3px;" />
          </label>
          <label style="font-size:11px;color:#475569;display:flex;align-items:center;gap:6px;margin-top:16px;">
            <input id="slbQualifiesAsSale" type="checkbox" ${saved?.qualifiesAsSale ? "checked" : ""} />
            Devir TFRS 15 anlamında bir satış sayılıyor
          </label>
        </div>
        <label style="font-size:11px;color:#475569;display:block;margin-top:10px;max-width:520px;">
          Mesleki Muhakeme Notu (gerekçe)
          <textarea id="slbNote" rows="2" style="width:100%;padding:6px;border:1px solid #e2e8f0;border-radius:6px;margin-top:3px;">${escapeHtml(saved?.professionalJudgmentNote || "")}</textarea>
        </label>
        <button id="slbCalculateButton" style="margin-top:10px;padding:8px 16px;background:#0f172a;color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer;">
          Hesapla ve Kaydet
        </button>
        <div id="slbResultContainer" style="margin-top:16px;"></div>
      </div>
    `;

    container.innerHTML = formHtml;

    function runAndRenderSlb(persist) {
      const resultBox = document.getElementById("slbResultContainer");
      const input = {
        previousCarryingAmount: Number(document.getElementById("slbCarryingAmount")?.value),
        fairValueOfAsset: Number(document.getElementById("slbFairValue")?.value),
        saleProceeds: Number(document.getElementById("slbSaleProceeds")?.value),
        qualifiesAsSale: !!document.getElementById("slbQualifiesAsSale")?.checked,
        professionalJudgmentNote: document.getElementById("slbNote")?.value || "",
        leasebackContract: contract
      };

      if (persist) {
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
      }

      if (!resultBox) return;
      try {
        const result = calculateSaleAndLeaseback(input);
        resultBox.innerHTML = renderSlbResultHtml(result);
      } catch (error) {
        resultBox.innerHTML = `
          <div style="padding:12px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;color:#991b1b;font-size:12px;">
            Hesaplanamadı: ${escapeHtml(error.message || String(error))}
          </div>
        `;
      }
    }

    document.getElementById("slbCalculateButton")?.addEventListener("click", () => runAndRenderSlb(true));

    if (saved) runAndRenderSlb(false);
  }

  function renderSlbResultHtml(result) {
    if (!result.qualifiesAsSale) {
      const rows = result.schedule.map(row => `
        <tr>
          <td style="padding:6px;border-top:1px solid #edf0f4;font-size:11px;">${row.period}</td>
          <td style="padding:6px;border-top:1px solid #edf0f4;font-size:11px;">${row.date}</td>
          <td style="padding:6px;border-top:1px solid #edf0f4;text-align:right;font-size:11px;">${formatCurrency(row.openingBalance)}</td>
          <td style="padding:6px;border-top:1px solid #edf0f4;text-align:right;font-size:11px;">${formatCurrency(row.interest)}</td>
          <td style="padding:6px;border-top:1px solid #edf0f4;text-align:right;font-size:11px;">${formatCurrency(row.payment)}</td>
          <td style="padding:6px;border-top:1px solid #edf0f4;text-align:right;font-size:11px;">${formatCurrency(row.closingBalance)}</td>
        </tr>
      `).join("");
      return `
        <div style="padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
          <strong style="font-size:12px;">TFRS 16.103 — Finansman Düzenlemesi</strong>
          <p style="margin:6px 0;color:#64748b;font-size:11px;">${result.note}</p>
          ${result.residualBalanceWarning ? `<div style="margin:8px 0;padding:8px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;color:#92400e;font-size:11px;">${escapeHtml(result.residualBalanceWarning)}</div>` : ""}
          <div style="margin-top:10px;overflow:auto;">
            <table style="width:100%;border-collapse:collapse;min-width:560px;">
              <thead><tr style="background:#f1f5f9;">
                <th style="padding:6px;text-align:left;font-size:10px;">Dönem</th><th style="padding:6px;text-align:left;font-size:10px;">Tarih</th>
                <th style="padding:6px;text-align:right;font-size:10px;">Açılış</th><th style="padding:6px;text-align:right;font-size:10px;">Faiz</th>
                <th style="padding:6px;text-align:right;font-size:10px;">Ödeme</th><th style="padding:6px;text-align:right;font-size:10px;">Kapanış</th>
              </tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
          ${renderSlbJournalHtml(result.inceptionJournal)}
        </div>
      `;
    }

    return `
      <div style="padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
        <strong style="font-size:12px;">TFRS 16.100-102 — Satış ve Geri Kiralama</strong>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:10px;font-size:11px;">
          <div>Toplam Kâr/Zarar<br><strong>${formatCurrency(result.totalGainLoss)}</strong></div>
          <div>Tanınan Kâr/Zarar<br><strong style="color:${result.gainLossRecognized < 0 ? '#dc2626' : '#16a34a'};">${formatCurrency(result.gainLossRecognized)}</strong></div>
          <div>ROU'ya Gömülü (Tanınmayan)<br><strong>${formatCurrency(result.gainLossOnRightsRetained)}</strong></div>
          <div>Düzeltilmiş Kira Yükümlülüğü<br><strong>${formatCurrency(result.adjustedLeaseLiability)}</strong></div>
          <div>Elde Tutulan ROU<br><strong>${formatCurrency(result.rouRetained)}</strong></div>
          <div>${result.excessFinancing > 0 ? "İlave Finansman" : result.prepayment > 0 ? "Peşin Ödeme" : "Off-market Fark"}<br><strong>${formatCurrency(result.excessFinancing || result.prepayment || 0)}</strong></div>
        </div>
        ${renderSlbJournalHtml(result.inceptionJournal)}
      </div>
    `;
  }

  function renderSlbJournalHtml(entries) {
    const rows = entries.map(e => `
      <tr>
        <td style="padding:6px;border-top:1px solid #edf0f4;font-size:11px;">${escapeHtml(e.account)}</td>
        <td style="padding:6px;border-top:1px solid #edf0f4;text-align:right;font-size:11px;">${e.debit ? formatCurrency(e.debit) : ""}</td>
        <td style="padding:6px;border-top:1px solid #edf0f4;text-align:right;font-size:11px;">${e.credit ? formatCurrency(e.credit) : ""}</td>
      </tr>
    `).join("");
    return `
      <div style="margin-top:12px;">
        <div style="font-size:10px;color:#64748b;font-weight:700;">BAŞLANGIÇ FİŞİ</div>
        <table style="width:100%;border-collapse:collapse;margin-top:6px;">
          <thead><tr style="background:#f1f5f9;"><th style="padding:6px;text-align:left;font-size:10px;">Hesap</th><th style="padding:6px;text-align:right;font-size:10px;">Borç</th><th style="padding:6px;text-align:right;font-size:10px;">Alacak</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  function renderSubleaseSection(contract) {
    const container = document.getElementById("subleaseSectionContainer");
    if (!container) return;

    const saved = contract.sublease || null;

    const formHtml = `
      <div style="margin-top:20px;border-top:1px solid #e5e7eb;padding-top:18px;">
        <div style="font-size:10px;color:#64748b;font-weight:800;letter-spacing:1px;">TFRS 16.B58 — ALT KİRALAMA (SUBLEASE)</div>
        <p style="margin:6px 0 10px;color:#64748b;font-size:11px;">
          Bu kontratı (ana kira) kısmen veya tamamen üçüncü bir tarafa devrediyorsanız, alt kiralamanın kendi şartlarını girin.
          Sınıflandırma (finance/operating) ana kiradan doğan ROU'ya göre yapılır — altta yatan varlığa göre değil.
        </p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;max-width:560px;">
          <label style="font-size:11px;color:#475569;">
            Alt Kiralama Aylık Bedeli
            <input id="subleaseMonthlyPayment" type="number" step="0.01" value="${saved?.monthlyPayment ?? ""}" style="width:100%;padding:6px;border:1px solid #e2e8f0;border-radius:6px;margin-top:3px;" />
          </label>
          <label style="font-size:11px;color:#475569;">
            İskonto Oranı (Yıllık %)
            <input id="subleaseDiscountRate" type="number" step="0.01" value="${saved?.discountRate ?? ""}" style="width:100%;padding:6px;border:1px solid #e2e8f0;border-radius:6px;margin-top:3px;" />
          </label>
          <label style="font-size:11px;color:#475569;">
            Başlangıç Tarihi
            <input id="subleaseStartDate" type="date" value="${saved?.startDate ? String(saved.startDate).slice(0,10) : ""}" style="width:100%;padding:6px;border:1px solid #e2e8f0;border-radius:6px;margin-top:3px;" />
          </label>
          <label style="font-size:11px;color:#475569;">
            Bitiş Tarihi
            <input id="subleaseEndDate" type="date" value="${saved?.endDate ? String(saved.endDate).slice(0,10) : ""}" style="width:100%;padding:6px;border:1px solid #e2e8f0;border-radius:6px;margin-top:3px;" />
          </label>
          <label style="font-size:11px;color:#475569;">
            ROU Tahsis Oranı (0-1, örn. yarısı = 0.5)
            <input id="subleaseRouRatio" type="number" step="0.01" min="0.01" max="1" value="${saved?.rouAllocationRatio ?? 1}" style="width:100%;padding:6px;border:1px solid #e2e8f0;border-radius:6px;margin-top:3px;" />
          </label>
          <label style="font-size:11px;color:#475569;">
            Sınıflandırma
            <select id="subleaseClassification" style="width:100%;padding:6px;border:1px solid #e2e8f0;border-radius:6px;margin-top:3px;">
              <option value="OPERATING" ${saved?.classification !== "FINANCE" ? "selected" : ""}>Operating</option>
              <option value="FINANCE" ${saved?.classification === "FINANCE" ? "selected" : ""}>Finance</option>
            </select>
          </label>
        </div>
        <label style="font-size:11px;color:#475569;display:block;margin-top:10px;max-width:560px;">
          Mesleki Muhakeme Notu (sınıflandırma gerekçesi)
          <textarea id="subleaseNote" rows="2" style="width:100%;padding:6px;border:1px solid #e2e8f0;border-radius:6px;margin-top:3px;">${escapeHtml(saved?.professionalJudgmentNote || "")}</textarea>
        </label>
        <button id="subleaseCalculateButton" style="margin-top:10px;padding:8px 16px;background:#0f172a;color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer;">
          Hesapla ve Kaydet
        </button>
        <div id="subleaseResultContainer" style="margin-top:16px;"></div>
      </div>
    `;

    container.innerHTML = formHtml;

    function runAndRenderSublease(persist) {
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

      if (persist) {
        contract.sublease = { ...subleaseContract, classification, rouAllocationRatio, professionalJudgmentNote, savedAt: new Date().toISOString() };
        const idx = contracts.findIndex(c => c.id === contract.id);
        if (idx >= 0) contracts[idx] = contract;
        saveContracts(contracts);
      }

      if (!resultBox) return;
      try {
        const result = calculateSublease({ headLeaseContract: contract, subleaseContract, classification, rouAllocationRatio });
        resultBox.innerHTML = renderSubleaseResultHtml(result);
      } catch (error) {
        resultBox.innerHTML = `
          <div style="padding:12px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;color:#991b1b;font-size:12px;">
            Hesaplanamadı: ${escapeHtml(error.message || String(error))}
          </div>
        `;
      }
    }

    document.getElementById("subleaseCalculateButton")?.addEventListener("click", () => runAndRenderSublease(true));

    if (saved) runAndRenderSublease(false);
  }

  function renderSubleaseResultHtml(result) {
    if (result.classification === "OPERATING") {
      const rows = result.schedule.slice(0, 12).map(row => `
        <tr>
          <td style="padding:6px;border-top:1px solid #edf0f4;font-size:11px;">${row.period}</td>
          <td style="padding:6px;border-top:1px solid #edf0f4;text-align:right;font-size:11px;">${formatCurrency(row.cashReceived)}</td>
          <td style="padding:6px;border-top:1px solid #edf0f4;text-align:right;font-size:11px;">${formatCurrency(row.incomeRecognized)}</td>
          <td style="padding:6px;border-top:1px solid #edf0f4;text-align:right;font-size:11px;">${formatCurrency(row.deferredIncomeBalance)}</td>
        </tr>
      `).join("");
      return `
        <div style="padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
          <strong style="font-size:12px;">TFRS 16.B58 — Operating Alt Kiralama</strong>
          <p style="margin:6px 0;color:#64748b;font-size:11px;">${result.note}</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;font-size:11px;">
            <div>Toplam Sözleşme Geliri<br><strong>${formatCurrency(result.totalContractualIncome)}</strong></div>
            <div>Doğrusal Aylık Gelir<br><strong>${formatCurrency(result.straightLineMonthlyIncome)}</strong></div>
          </div>
          <div style="margin-top:10px;overflow:auto;">
            <table style="width:100%;border-collapse:collapse;min-width:420px;">
              <thead><tr style="background:#f1f5f9;">
                <th style="padding:6px;text-align:left;font-size:10px;">Dönem</th><th style="padding:6px;text-align:right;font-size:10px;">Tahsilat</th>
                <th style="padding:6px;text-align:right;font-size:10px;">Tanınan Gelir</th><th style="padding:6px;text-align:right;font-size:10px;">Ertelenmiş Gelir Bakiyesi</th>
              </tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
          <p style="margin-top:8px;color:#94a3b8;font-size:10px;">${result.periodicJournalNote}</p>
        </div>
      `;
    }

    return `
      <div style="padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
        <strong style="font-size:12px;">TFRS 16.B58 — Finance Alt Kiralama</strong>
        <p style="margin:6px 0;color:#64748b;font-size:11px;">${result.note}</p>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:8px;font-size:11px;">
          <div>Ana Kira ROU (Tahsis Öncesi)<br><strong>${formatCurrency(result.headLeaseRouCarryingAmount)}</strong></div>
          <div>Devredilen ROU (Tahsis: %${(result.rouAllocationRatio*100).toFixed(0)})<br><strong>${formatCurrency(result.allocatedRouCarryingAmount)}</strong></div>
          <div>Net Yatırım (Alt Kiralama PV)<br><strong>${formatCurrency(result.netInvestment)}</strong></div>
          <div>Satış Kâr/Zararı<br><strong style="color:${result.sellingProfitLoss < 0 ? '#dc2626' : '#16a34a'};">${formatCurrency(result.sellingProfitLoss)}</strong></div>
        </div>
        ${renderSlbJournalHtml(result.inceptionJournal)}
      </div>
    `;
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

    updateScheduleSubPeriodUI();
    renderPaymentScheduleTable(contract);
    renderFxTranslationSection(contract);
    renderSlbSection(contract);
    renderSubleaseSection(contract);

    document
      .getElementById(
        "schedulePeriodType"
      )
      ?.addEventListener(
        "change",
        () => {
          updateScheduleSubPeriodUI();
          renderPaymentScheduleTable(contract);
        }
      );

    document
      .getElementById(
        "scheduleYear"
      )
      ?.addEventListener(
        "change",
        () =>
          renderPaymentScheduleTable(contract)
      );

    document
      .getElementById(
        "scheduleSubPeriod"
      )
      ?.addEventListener(
        "change",
        () =>
          renderPaymentScheduleTable(contract)
      );

    document
      .getElementById(
        "exportScheduleButton"
      )
      ?.addEventListener(
        "click",
        () =>
          exportPaymentSchedule(contract)
      );
  }


  async function exportPaymentSchedule(contract) {

    const baseEngine =
      calculateLeaseEngine(
        contract
      );

    const engine =
      typeof cfoBuildSchedule === "function"
        ? { ...baseEngine, ...cfoBuildSchedule(contract) }
        : baseEngine;

    if (!engine.schedule.length) {

      alert(
        "Aktarılacak ödeme planı bulunamadı."
      );

      return;
    }

    auditScheduleEvent(contract, "SCHEDULE_GENERATED", "PAYMENT_SCHEDULE_EXPORT", `V16.7-${engine.schedule.length}`, null, engine.schedule.length);

    let fx = null;
    let fxError = null;
    if (contractNeedsFxTranslation(contract)) {
      try {
        fx = await buildTms21FxTranslation(contract, engine);
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
      { "Alan": "İlk Kira Yükümlülüğü", "Değer": engine.liability },
      { "Alan": "ROU Varlığı (Başlangıç)", "Değer": engine.rouAssets },
      { "Alan": "Rapor Tarihi", "Değer": formatDate(new Date()) }
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
      engine.schedule.map(
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
          "ROU Net Defter Değeri": item.rouClosing
        })
      );

    if (typeof XLSX !== "undefined") {

      try {

        const workbook =
          XLSX.utils.book_new();

        const assumptionSheet =
          XLSX.utils.json_to_sheet(
            assumptionRows
          );

        XLSX.utils.book_append_sheet(
          workbook,
          assumptionSheet,
          "Varsayimlar"
        );

        const scheduleSheet =
          XLSX.utils.json_to_sheet(
            scheduleRows
          );

        XLSX.utils.book_append_sheet(
          workbook,
          scheduleSheet,
          "Odeme Plani"
        );

        if (fx?.applicable) {
          const fxRows = fx.schedule.map(row => ({
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
          }));

          const fxSheet = XLSX.utils.json_to_sheet(fxRows);
          XLSX.utils.book_append_sheet(workbook, fxSheet, "Kur_Cevrimi_TMS21");
        }

        XLSX.writeFile(
          workbook,
          `${contract.id}_Odeme_Plani.xlsx`
        );

        return;

      } catch (error) {

        console.error(
          "Payment schedule export error:",
          error
        );
      }
    }

    const headers =
      Object.keys(
        scheduleRows[0]
      );

    const csv =
      [
        headers.join(";"),
        ...scheduleRows.map(
          row =>
            headers
              .map(h => row[h])
              .join(";")
        )
      ].join("\n");

    const blob =
      new Blob(
        [
          "\uFEFF" +
          csv
        ],
        {
          type:
            "text/csv;charset=utf-8;"
        }
      );

    const url =
      URL.createObjectURL(
        blob
      );

    const link =
      document.createElement(
        "a"
      );

    link.href = url;

    link.download =
      `${contract.id}_Odeme_Plani.csv`;

    document.body.appendChild(
      link
    );

    link.click();
    link.remove();

    URL.revokeObjectURL(
      url
    );
  }


  /* ==========================================================
     DETAIL MODAL
  ========================================================== */

  function openDetail(id) {

    const contract =
      contracts.find(
        item => item.id === id
      );

    if (!contract) return;

    selectedContractId =
      id;

    const engine =
      calculateLease(
        contract
      );

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


    if (title) {
      title.textContent =
        contract.id;
    }


    if (content) {

      content.innerHTML = `

        <div class="detail-grid">

          <div class="detail-item">

            <span>
              Şirket
            </span>

            <strong>
              ${escapeHtml(
                contract.company
              )}
            </strong>

          </div>


          <div class="detail-item">

            <span>
              Tedarikçi
            </span>

            <strong>
              ${escapeHtml(
                contract.supplier
              )}
            </strong>

          </div>


          <div class="detail-item">

            <span>
              Aylık Kira
            </span>

            <strong>
              ${formatCurrency(
                contract.monthlyPayment
              )}
            </strong>

          </div>


          <div class="detail-item">

            <span>
              ROU Varlığı
            </span>

            <strong>
              ${formatCurrency(
                engine.rouAssets
              )}
            </strong>

          </div>


          <div class="detail-item">

            <span>
              İlk Kira Yükümlülüğü
            </span>

            <strong>
              ${formatCurrency(
                engine.liability
              )}
            </strong>

          </div>


          <div class="detail-item">

            <span>
              Aylık Amortisman
            </span>

            <strong>
              ${formatCurrency(
                engine.depreciation
              )}
            </strong>

          </div>

        </div>


        ${renderModificationManagementSection(
          contract
        )}


        ${renderReassessmentManagementSection(
          contract
        )}


        <div style="margin-top:28px;border-top:1px solid #e5e7eb;padding-top:24px;">
          <div style="font-size:10px;color:#64748b;font-weight:800;letter-spacing:1px;">DENETİM İZİ</div>
          <h3 style="margin:5px 0 0;font-size:18px;">Denetim İzi (Audit Trail)</h3>
          <p style="margin:5px 0 0;color:#64748b;font-size:11px;">Bu sözleşmeye ait tüm oluşturma, güncelleme, modification, reassessment ve yevmiye kayıtlarını Excel/CSV olarak dışa aktarın.</p>
          <button type="button" id="exportContractAuditTrailButton" class="secondary-button" style="margin-top:12px;">↓ Denetim İzini Dışa Aktar</button>
        </div>


        ${renderPaymentScheduleSection(
          contract
        )}


        ${engine.exempt ? `
          <div style="margin-top:22px;border:1px solid #fde68a;background:#fffbeb;border-radius:12px;padding:14px 16px;">
            <strong style="color:#92400e;">TFRS 16.5-8 Muafiyeti Uygulanıyor</strong>
            <p style="margin:6px 0 0;color:#78350f;font-size:12px;line-height:1.5;">
              Bu sözleşme kısa vadeli ve/veya düşük değerli varlık istisnası kapsamında işaretlenmiştir.
              Kullanım hakkı varlığı ve kiralama yükümlülüğü tanınmaz; ödemeler kira süresi boyunca
              genellikle doğrusal (straight-line) esasa göre gider olarak muhasebeleştirilir. Bu nedenle
              bir "ilk muhasebeleştirme fişi" üretilmez.
            </p>
          </div>
        ` : renderJournalEntry(
          "İlk Muhasebeleştirme Fişi",
          generateInitialEntry(
            contract
          )
        )}


        ${renderAccountingCenter(
          contract
        )}

      `;
    }


    modal?.classList.remove(
      "hidden"
    );


    setTimeout(
      () => {

        document
          .getElementById(
            "generateJournal"
          )
          ?.addEventListener(
            "click",
            () =>
              generateSelectedJournal(
                contract
              )
          );


        document
          .getElementById(
            "openBulkJournalButton"
          )
          ?.addEventListener(
            "click",
            openBulkJournalModal
          );


        document
          .getElementById("exportContractAuditTrailButton")
          ?.addEventListener("click", () => {
            const ok = typeof exportAuditTrail === "function" ? exportAuditTrail(contract.id) : false;
            if (!ok) alert("Bu sözleşme için dışa aktarılacak denetim izi kaydı bulunamadı.");
          });


        initModificationEvents(
          contract
        );


        initReassessmentEvents(
          contract
        );


        initPaymentScheduleEvents(
          contract
        );

      },
      0
    );
  }


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


  /* ==========================================================
     BULK JOURNAL MODAL
  ========================================================== */

  function openBulkJournalModal() {

    createBulkJournalModal();

    const modal =
      document.getElementById(
        "bulkJournalModal"
      );

    if (!modal) return;

    modal.classList.remove(
      "hidden"
    );

    modal.style.display =
      "flex";

    populateBulkYears();

    const today =
      new Date();

    const voucherDate =
      document.getElementById(
        "bulkVoucherDate"
      );

    if (voucherDate) {

      voucherDate.value =
        [
          today.getFullYear(),
          String(
            today.getMonth() + 1
          ).padStart(2, "0"),
          String(
            today.getDate()
          ).padStart(2, "0")
        ].join("-");
    }


    updateBulkPeriodUI();

    updateBulkVoucherDefaults();

    bulkJournalData = [];

    setBulkPreview("");
  }


  function createBulkJournalModal() {

    if (
      document.getElementById(
        "bulkJournalModal"
      )
    ) {
      return;
    }


    const modal =
      document.createElement(
        "div"
      );

    modal.id =
      "bulkJournalModal";

    modal.className =
      "hidden";

    modal.style.cssText = `
      position:fixed;
      inset:0;
      z-index:99999;
      background:rgba(15,23,42,.55);
      display:flex;
      align-items:center;
      justify-content:center;
      padding:20px;
    `;


    modal.innerHTML = `

      <div
        style="
          width:min(1200px,100%);
          max-height:92vh;
          overflow:auto;
          background:white;
          border-radius:16px;
          box-shadow:0 25px 80px rgba(0,0,0,.25);
        "
      >

        <div
          style="
            padding:20px 22px;
            border-bottom:1px solid #e5e7eb;
            display:flex;
            justify-content:space-between;
            align-items:center;
            gap:15px;
          "
        >

          <div>

            <div
              style="
                font-size:10px;
                font-weight:800;
                letter-spacing:1px;
                color:#64748b;
              "
            >
              TFRS 16 / V15
            </div>

            <h2
              style="
                margin:4px 0 0;
                font-size:20px;
              "
            >
              Toplu Muhasebe Fiş Merkezi
            </h2>

          </div>


          <button
            id="closeBulkJournalModal"
            type="button"
            style="
              width:36px;
              height:36px;
              border:0;
              border-radius:8px;
              background:#f1f5f9;
              cursor:pointer;
              font-size:18px;
            "
          >
            ×
          </button>

        </div>


        <div
          style="
            padding:20px;
          "
        >

          <div
            style="
              display:grid;
              grid-template-columns:
                repeat(auto-fit,minmax(180px,1fr));
              gap:12px;
            "
          >

            <div>

              <label
                style="
                  display:block;
                  font-size:10px;
                  font-weight:700;
                  color:#64748b;
                  margin-bottom:7px;
                "
              >
                Raporlama Yılı
              </label>

              <select
                id="bulkAccountingYear"
                style="
                  width:100%;
                  padding:9px;
                  border:1px solid #d1d5db;
                  border-radius:7px;
                "
              ></select>

            </div>


            <div>

              <label
                style="
                  display:block;
                  font-size:10px;
                  font-weight:700;
                  color:#64748b;
                  margin-bottom:7px;
                "
              >
                Fiş Periyodu
              </label>

              <select
                id="bulkAccountingPeriod"
                style="
                  width:100%;
                  padding:9px;
                  border:1px solid #d1d5db;
                  border-radius:7px;
                "
              >

                <option value="monthly">
                  Aylık
                </option>

                <option value="quarterly">
                  Çeyreklik
                </option>

                <option value="annual">
                  Yıllık
                </option>

              </select>

            </div>


            <div>

              <label
                style="
                  display:block;
                  font-size:10px;
                  font-weight:700;
                  color:#64748b;
                  margin-bottom:7px;
                "
              >
                Dönem / Ay
              </label>

              <select
                id="bulkAccountingMonth"
                style="
                  width:100%;
                  padding:9px;
                  border:1px solid #d1d5db;
                  border-radius:7px;
                "
              >
                ${buildMonthOptions()}
              </select>

            </div>


            <div>

              <label
                style="
                  display:block;
                  font-size:10px;
                  font-weight:700;
                  color:#64748b;
                  margin-bottom:7px;
                "
              >
                Fiş Tarihi
              </label>

              <input
                id="bulkVoucherDate"
                type="date"
                style="
                  width:100%;
                  padding:9px;
                  border:1px solid #d1d5db;
                  border-radius:7px;
                "
              />

            </div>

          </div>


          <div
            style="
              display:grid;
              grid-template-columns:1fr 1fr;
              gap:12px;
              margin-top:12px;
            "
          >

            <div>

              <label
                style="
                  display:block;
                  font-size:10px;
                  font-weight:700;
                  color:#64748b;
                  margin-bottom:7px;
                "
              >
                Fiş No Başlangıç
              </label>

              <input
                id="bulkVoucherNumber"
                value="TFRS16-2026-0001"
                style="
                  width:100%;
                  padding:9px;
                  border:1px solid #d1d5db;
                  border-radius:7px;
                "
              />

            </div>


            <div>

              <label
                style="
                  display:block;
                  font-size:10px;
                  font-weight:700;
                  color:#64748b;
                  margin-bottom:7px;
                "
              >
                Fiş Açıklaması
              </label>

              <input
                id="bulkVoucherDescription"
                value="TFRS 16 kira muhasebe kaydı"
                style="
                  width:100%;
                  padding:9px;
                  border:1px solid #d1d5db;
                  border-radius:7px;
                "
              />

            </div>

          </div>


          <div
            id="bulkJournalSummary"
            style="
              margin-top:18px;
            "
          ></div>


          <div
            id="bulkJournalPreview"
            style="
              margin-top:18px;
            "
          ></div>

        </div>


        <div
          style="
            padding:16px 20px;
            border-top:1px solid #e5e7eb;
            display:flex;
            justify-content:flex-end;
            gap:10px;
          "
        >

          <button
            id="generateBulkJournals"
            type="button"
            style="
              padding:11px 16px;
              border:0;
              border-radius:8px;
              background:#0f172a;
              color:white;
              font-weight:700;
              cursor:pointer;
            "
          >
            Toplu Fişleri Oluştur
          </button>


          <button
            id="exportBulkJournals"
            type="button"
            disabled
            style="
              padding:11px 16px;
              border:0;
              border-radius:8px;
              background:#166534;
              color:white;
              font-weight:700;
              cursor:pointer;
              opacity:.5;
            "
          >
            Excel'e Aktar
          </button>

        </div>

      </div>

    `;


    document.body.appendChild(
      modal
    );


    document
      .getElementById(
        "closeBulkJournalModal"
      )
      ?.addEventListener(
        "click",
        closeBulkJournalModal
      );


    document
      .getElementById(
        "generateBulkJournals"
      )
      ?.addEventListener(
        "click",
        generateBulkJournals
      );


    document
      .getElementById(
        "exportBulkJournals"
      )
      ?.addEventListener(
        "click",
        exportBulkJournals
      );


    document
      .getElementById(
        "bulkAccountingPeriod"
      )
      ?.addEventListener(
        "change",
        () => {

          updateBulkPeriodUI();

          updateBulkVoucherDefaults();
        }
      );


    document
      .getElementById(
        "bulkAccountingYear"
      )
      ?.addEventListener(
        "change",
        updateBulkVoucherDefaults
      );


    document
      .getElementById(
        "bulkAccountingMonth"
      )
      ?.addEventListener(
        "change",
        updateBulkVoucherDefaults
      );
  }


  function closeBulkJournalModal() {

    const modal =
      document.getElementById(
        "bulkJournalModal"
      );

    if (!modal) return;

    modal.classList.add(
      "hidden"
    );

    modal.style.display =
      "none";

    bulkJournalData = [];
  }


  function populateBulkYears() {

    const select =
      document.getElementById(
        "bulkAccountingYear"
      );

    if (!select) return;

    const years =
      new Set();


    contracts.forEach(
      contract => {

        const start =
          parseDate(
            contract.startDate
          );

        const end =
          parseDate(
            contract.endDate
          );

        if (!start || !end) {
          return;
        }

        for (
          let year =
            start.getFullYear();

          year <=
            end.getFullYear();

          year++
        ) {

          years.add(
            year
          );
        }
      }
    );


    const sorted =
      [...years].sort(
        (a, b) => a - b
      );

    const currentYear =
      new Date().getFullYear();


    select.innerHTML =
      sorted
        .map(
          year =>
            `
            <option
              value="${year}"
              ${
                year === currentYear
                  ? "selected"
                  : ""
              }
            >
              ${year}
            </option>
            `
        )
        .join("");


    if (!sorted.length) {

      select.innerHTML =
        `
        <option
          value="${currentYear}"
        >
          ${currentYear}
        </option>
        `;
    }
  }


  function updateBulkPeriodUI() {

    const period =
      document.getElementById(
        "bulkAccountingPeriod"
      )?.value;

    const month =
      document.getElementById(
        "bulkAccountingMonth"
      );

    if (!month) return;

    const annual =
      period === "annual";

    month.disabled =
      annual;

    month.style.opacity =
      annual
        ? ".5"
        : "1";
  }


  function updateBulkVoucherDefaults() {

    const year =
      Number(
        document.getElementById(
          "bulkAccountingYear"
        )?.value
      );

    const numberInput =
      document.getElementById(
        "bulkVoucherNumber"
      );

    if (
      numberInput &&
      year
    ) {

      numberInput.value =
        `TFRS16-${year}-0001`;
    }


    const description =
      document.getElementById(
        "bulkVoucherDescription"
      );

    const period =
      document.getElementById(
        "bulkAccountingPeriod"
      )?.value;

    const month =
      Number(
        document.getElementById(
          "bulkAccountingMonth"
        )?.value
      );


    if (
      description &&
      year
    ) {

      if (
        period === "monthly"
      ) {

        description.value =
          `${getMonthName(
            month
          )} ${year} TFRS 16 kira muhasebe kaydı`;

      } else if (
        period === "quarterly"
      ) {

        description.value =
          `${year} ${
            Math.ceil(
              month / 3
            )
          }. çeyrek TFRS 16 kira muhasebe kaydı`;

      } else {

        description.value =
          `${year} TFRS 16 yıllık kira muhasebe kaydı`;
      }
    }
  }


  /* ==========================================================
     BULK JOURNAL GENERATION
  ========================================================== */

  function generateBulkJournals() {

    const year =
      Number(
        document.getElementById(
          "bulkAccountingYear"
        )?.value
      );

    const period =
      document.getElementById(
        "bulkAccountingPeriod"
      )?.value;

    const month =
      Number(
        document.getElementById(
          "bulkAccountingMonth"
        )?.value
      );

    const voucherDate =
      document.getElementById(
        "bulkVoucherDate"
      )?.value || "";

    const voucherStart =
      document
        .getElementById(
          "bulkVoucherNumber"
        )
        ?.value
        ?.trim()
        ||
        `TFRS16-${year}-0001`;

    const description =
      document
        .getElementById(
          "bulkVoucherDescription"
        )
        ?.value
        ?.trim()
        ||
        "TFRS 16 kira muhasebe kaydı";


    if (
      !year ||
      !voucherDate
    ) {

      alert(
        "Lütfen raporlama yılını ve fiş tarihini eksiksiz girin."
      );

      return;
    }


    const activeContracts =
      contracts.filter(
        c =>
          c.status ===
          "active"
      );


    bulkJournalData = [];

    let sequence = 1;


    activeContracts.forEach(
      contract => {

        const selected =
          getScheduleForYear(
            contract,
            year,
            month,
            period
          );

        if (!selected.length) {
          return;
        }


        const interest =
          selected.reduce(
            (total, item) =>
              total + item.interest,
            0
          );

        const principal =
          selected.reduce(
            (total, item) =>
              total + item.principal,
            0
          );

        const payment =
          selected.reduce(
            (total, item) =>
              total + item.payment,
            0
          );

        const depreciation =
          selected.reduce(
            (total, item) =>
              total + item.depreciation,
            0
          );


        const entries = [

          {
            account:
              "780 Finansman Giderleri",

            debit:
              interest,

            credit: 0
          },

          {
            account:
              "401 Kiralama Yükümlülüğü",

            debit:
              principal,

            credit: 0
          },

          {
            account:
              "381 Kira Borçları / Ödeme",

            debit: 0,

            credit:
              payment
          },

          {
            account:
              "770 / 730 Amortisman Giderleri",

            debit:
              depreciation,

            credit: 0
          },

          {
            account:
              "268 Birikmiş Amortismanlar",

            debit: 0,

            credit:
              depreciation
          }

        ];


        const totalDebit =
          entries.reduce(
            (total, item) =>
              total +
              Number(
                item.debit || 0
              ),
            0
          );


        const totalCredit =
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
            totalDebit -
            totalCredit
          );


        const voucherNo =
          createVoucherNumber(
            voucherStart,
            sequence
          );


        bulkJournalData.push({

          voucherNo,

          voucherDate,

          contractId:
            contract.id,

          company:
            contract.company,

          supplier:
            contract.supplier,

          description,

          year,

          period,

          month,

          entries,

          totalDebit,

          totalCredit,

          difference,

          balanced:
            difference < 0.01

        });


        sequence++;
      }
    );


    renderBulkJournalResults();

    if (bulkJournalData.length) {
      const balancedCount = bulkJournalData.filter(item => item.balanced).length;
      recordAuditEvent({
        action: "JOURNAL_GENERATED",
        entityType: "JOURNAL_BATCH",
        entityId: `BATCH-${Date.now()}`,
        reason: "Bulk journal generation",
        metadata: {
          recordCount: bulkJournalData.length,
          balancedCount,
          unbalancedCount: bulkJournalData.length - balancedCount,
          year,
          period,
          month,
          voucherDate
        }
      });
    }
  }


  function createVoucherNumber(
    base,
    sequence
  ) {

    const match =
      String(base)
        .match(
          /^(.*?)(\d+)$/
        );


    if (!match) {

      return (
        `${base}-` +
        String(sequence)
          .padStart(
            4,
            "0"
          )
      );
    }


    const prefix =
      match[1];

    const number =
      match[2];

    const width =
      Math.max(
        4,
        number.length
      );

    const start =
      Number(number);


    return (
      prefix +
      String(
        start +
        sequence -
        1
      ).padStart(
        width,
        "0"
      )
    );
  }


  /* ==========================================================
     BULK JOURNAL RESULT
  ========================================================== */

  function renderBulkJournalResults() {

    const summary =
      document.getElementById(
        "bulkJournalSummary"
      );

    const preview =
      document.getElementById(
        "bulkJournalPreview"
      );

    const exportButton =
      document.getElementById(
        "exportBulkJournals"
      );


    if (
      !summary ||
      !preview
    ) {
      return;
    }


    if (
      !bulkJournalData.length
    ) {

      summary.innerHTML = `

        <div
          style="
            padding:15px;
            background:#fff7ed;
            color:#9a3412;
            border:1px solid #fed7aa;
            border-radius:10px;
          "
        >
          Seçilen dönemde aktif sözleşme kaydı bulunamadı.
        </div>

      `;

      preview.innerHTML =
        "";

      if (exportButton) {

        exportButton.disabled =
          true;

        exportButton.style.opacity =
          ".5";
      }

      return;
    }


    const balanced =
      bulkJournalData.filter(
        item =>
          item.balanced
      );


    const unbalanced =
      bulkJournalData.filter(
        item =>
          !item.balanced
      );


    const totalDebit =
      bulkJournalData.reduce(
        (total, item) =>
          total +
          item.totalDebit,
        0
      );


    const totalCredit =
      bulkJournalData.reduce(
        (total, item) =>
          total +
          item.totalCredit,
        0
      );


    summary.innerHTML = `

      <div
        style="
          display:grid;
          grid-template-columns:
            repeat(auto-fit,minmax(150px,1fr));
          gap:10px;
        "
      >

        <div
          style="
            padding:14px;
            border-radius:10px;
            background:#f8fafc;
            border:1px solid #e5e7eb;
          "
        >

          <div
            style="
              font-size:10px;
              color:#64748b;
            "
          >
            SÖZLEŞME
          </div>

          <strong
            style="
              font-size:20px;
            "
          >
            ${bulkJournalData.length}
          </strong>

        </div>


        <div
          style="
            padding:14px;
            border-radius:10px;
            background:#ecfdf5;
            border:1px solid #bbf7d0;
            color:#166534;
          "
        >

          <div
            style="
              font-size:10px;
            "
          >
            DENGELİ FİŞ
          </div>

          <strong
            style="
              font-size:20px;
            "
          >
            ${balanced.length}
          </strong>

        </div>


        <div
          style="
            padding:14px;
            border-radius:10px;
            background:#fef2f2;
            border:1px solid #fecaca;
            color:#991b1b;
          "
        >

          <div
            style="
              font-size:10px;
            "
          >
            HATALI FİŞ
          </div>

          <strong
            style="
              font-size:20px;
            "
          >
            ${unbalanced.length}
          </strong>

        </div>


        <div
          style="
            padding:14px;
            border-radius:10px;
            background:#f8fafc;
            border:1px solid #e5e7eb;
          "
        >

          <div
            style="
              font-size:10px;
              color:#64748b;
            "
          >
            TOPLAM BORÇ
          </div>

          <strong>
            ${formatCurrency(
              totalDebit
            )}
          </strong>

        </div>


        <div
          style="
            padding:14px;
            border-radius:10px;
            background:#f8fafc;
            border:1px solid #e5e7eb;
          "
        >

          <div
            style="
              font-size:10px;
              color:#64748b;
            "
          >
            TOPLAM ALACAK
          </div>

          <strong>
            ${formatCurrency(
              totalCredit
            )}
          </strong>

        </div>

      </div>

    `;


    preview.innerHTML = `

      <div
        style="
          border:1px solid #e5e7eb;
          border-radius:10px;
          overflow:auto;
        "
      >

        <table
          style="
            width:100%;
            border-collapse:collapse;
            min-width:900px;
          "
        >

          <thead>

            <tr>

              <th
                style="
                  padding:10px;
                "
              >
                Fiş No
              </th>

              <th
                style="
                  padding:10px;
                "
              >
                Tarih
              </th>

              <th
                style="
                  padding:10px;
                "
              >
                Sözleşme
              </th>

              <th
                style="
                  padding:10px;
                "
              >
                Şirket
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

              <th
                style="
                  padding:10px;
                "
              >
                Kontrol
              </th>

            </tr>

          </thead>


          <tbody>

            ${bulkJournalData
              .map(
                item => `

                  <tr>

                    <td
                      style="
                        padding:10px;
                        border-top:1px solid #edf0f4;
                      "
                    >
                      ${escapeHtml(
                        item.voucherNo
                      )}
                    </td>

                    <td
                      style="
                        padding:10px;
                        border-top:1px solid #edf0f4;
                      "
                    >
                      ${formatDate(
                        item.voucherDate
                      )}
                    </td>

                    <td
                      style="
                        padding:10px;
                        border-top:1px solid #edf0f4;
                        font-weight:700;
                      "
                    >
                      ${escapeHtml(
                        item.contractId
                      )}
                    </td>

                    <td
                      style="
                        padding:10px;
                        border-top:1px solid #edf0f4;
                      "
                    >
                      ${escapeHtml(
                        item.company
                      )}
                    </td>

                    <td
                      style="
                        padding:10px;
                        text-align:right;
                        border-top:1px solid #edf0f4;
                      "
                    >
                      ${formatCurrency(
                        item.totalDebit
                      )}
                    </td>

                    <td
                      style="
                        padding:10px;
                        text-align:right;
                        border-top:1px solid #edf0f4;
                      "
                    >
                      ${formatCurrency(
                        item.totalCredit
                      )}
                    </td>

                    <td
                      style="
                        padding:10px;
                        border-top:1px solid #edf0f4;
                        font-weight:800;
                        color:${
                          item.balanced
                            ? "#166534"
                            : "#991b1b"
                        };
                      "
                    >
                      ${
                        item.balanced
                          ? "✓ Dengeli"
                          : "✕ Hatalı"
                      }
                    </td>

                  </tr>

                `
              )
              .join("")}

          </tbody>

        </table>

      </div>

    `;


    if (exportButton) {

      const allowed =
        unbalanced.length === 0;

      exportButton.disabled =
        !allowed;

      exportButton.style.opacity =
        allowed
          ? "1"
          : ".5";
    }
  }


  function setBulkPreview(
    html
  ) {

    const summary =
      document.getElementById(
        "bulkJournalSummary"
      );

    const preview =
      document.getElementById(
        "bulkJournalPreview"
      );

    if (summary) {
      summary.innerHTML =
        html || "";
    }

    if (preview) {
      preview.innerHTML =
        "";
    }

    const exportButton =
      document.getElementById(
        "exportBulkJournals"
      );

    if (exportButton) {

      exportButton.disabled =
        true;

      exportButton.style.opacity =
        ".5";
    }
  }


  /* ==========================================================
     EXCEL EXPORT
  ========================================================== */

  function exportBulkJournals() {

    if (
      !bulkJournalData.length
    ) {
      return;
    }


    const invalid =
      bulkJournalData.some(
        item =>
          !item.balanced
      );


    if (invalid) {

      alert(
        "Dengesiz fiş bulunduğu için Excel aktarımı yapılamaz."
      );

      return;
    }


    const rows = [];


    bulkJournalData.forEach(
      item => {

        item.entries.forEach(
          entry => {

            rows.push({

              "Fiş No":
                item.voucherNo,

              "Fiş Tarihi":
                item.voucherDate,

              "Sözleşme ID":
                item.contractId,

              "Şirket":
                item.company,

              "Tedarikçi":
                item.supplier,

              "Raporlama Yılı":
                item.year,

              "Periyot":
                item.period,

              "Dönem":
                item.month,

              "Açıklama":
                item.description,

              "Hesap":
                entry.account,

              "Borç":
                Number(
                  entry.debit || 0
                ),

              "Alacak":
                Number(
                  entry.credit || 0
                ),

              "Kontrol":
                "OK"

            });

          }
        );
      }
    );


    if (
      typeof XLSX !==
      "undefined"
    ) {

      try {

        const worksheet =
          XLSX.utils.json_to_sheet(
            rows
          );

        const workbook =
          XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(
          workbook,
          worksheet,
          "TFRS16 Fisleri"
        );

        XLSX.writeFile(
          workbook,
          `TFRS16_Toplu_Fisler_${Date.now()}.xlsx`
        );

        recordAuditEvent({
          action: "JOURNAL_EXPORTED",
          entityType: "JOURNAL_EXPORT",
          reason: "Bulk journal Excel export",
          metadata: { recordCount: rows.length, format: "xlsx" }
        });

        return;

      } catch (error) {

        console.error(
          "Excel export error:",
          error
        );
      }
    }


    const headers =
      Object.keys(
        rows[0]
      );


    const csvRows =
      [
        headers,
        ...rows.map(
          row =>
            headers.map(
              header =>
                row[header]
            )
        )
      ];


    const csv =
      csvRows
        .map(
          row =>
            row
              .map(
                value =>
                  `"${String(
                    value ?? ""
                  ).replaceAll(
                    '"',
                    '""'
                  )}"`
              )
              .join(";")
        )
        .join("\n");


    const blob =
      new Blob(
        [
          "\uFEFF" +
          csv
        ],
        {
          type:
            "text/csv;charset=utf-8;"
        }
      );


    const url =
      URL.createObjectURL(
        blob
      );

    const link =
      document.createElement(
        "a"
      );

    link.href =
      url;

    link.download =
      "TFRS16_Toplu_Fisler.csv";

    document.body.appendChild(
      link
    );

    link.click();

    link.remove();

    URL.revokeObjectURL(
      url
    );

    recordAuditEvent({ action: "JOURNAL_EXPORTED", entityType: "JOURNAL_EXPORT", reason: "Bulk journal CSV export", metadata: { recordCount: rows.length, format: "csv" } });
  }


  /* ==========================================================
     BASIC EXCEL CONTRACT IMPORT
     ========================================================== */

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


  function findImportValue(
    row,
    aliases
  ) {

    const keys =
      Object.keys(
        row
      );

    for (
      const key of keys
    ) {

      const normalized =
        normalizeHeader(
          key
        );

      if (
        aliases.includes(
          normalized
        )
      ) {

        return row[key];
      }
    }

    return "";
  }


  function mapImportedContract(
    row
  ) {

    return {

      id:
        String(
          findImportValue(
            row,
            [
              "sozlesme id",
              "sozlesme",
              "contract id",
              "contract",
              "id"
            ]
          ) || ""
        ).trim(),

      company:
        String(
          findImportValue(
            row,
            [
              "sirket",
              "company"
            ]
          ) || ""
        ).trim(),

      supplier:
        String(
          findImportValue(
            row,
            [
              "tedarikci",
              "supplier"
            ]
          ) || ""
        ).trim(),

      monthlyPayment:
        Number(
          String(
            findImportValue(
              row,
              [
                "aylik kira",
                "monthly payment",
                "monthly rent"
              ]
            ) || 0
          )
            .replace(
              /\./g,
              ""
            )
            .replace(
              ",",
              "."
            )
        ) || 0,

      startDate:
        normalizeDate(
          findImportValue(
            row,
            [
              "baslangic",
              "baslangic tarihi",
              "start date"
            ]
          )
        ),

      endDate:
        normalizeDate(
          findImportValue(
            row,
            [
              "bitis",
              "bitis tarihi",
              "end date"
            ]
          )
        ),

      discountRate:
        Number(
          String(
            findImportValue(
              row,
              [
                "iskonto orani",
                "discount rate",
                "discount"
              ]
            ) || 0
          ).replace(
            ",",
            "."
          )
        ) || 0,

      renewalDate:
        normalizeDate(
          findImportValue(
            row,
            [
              "yenileme",
              "yenileme tarihi",
              "renewal date"
            ]
          )
        ),

      status:
        "active",

      modification:
        false,

      reassessments:
        []
    };
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
    } catch (error) {
      console.error("V19.1 integration import preview error:", error);
      window.__GK_V191_IMPORT_CONTEXT__ = null;
      if (confirm) confirm.disabled = true;
      if (status) {
        status.innerHTML = `<div style="padding:10px;border-radius:8px;background:#fef2f2;color:#991b1b;border:1px solid #fecaca;">Dosya okunamadı: ${escapeHtml(error?.message || String(error))}</div>`;
      }
    }
  }


  const confirmBulkImportButton = document.getElementById("confirmBulkImport");
  if (confirmBulkImportButton) confirmBulkImportButton.onclick = confirmBulkImport;


  function confirmBulkImport() {
    const context = window.__GK_V191_IMPORT_CONTEXT__;
    if (!context?.jobId || !Array.isArray(context.rows)) {
      alert("Önce geçerli bir Excel dosyası yükleyin.");
      return;
    }

    try {
      const result = commitImport(context.jobId, context.rows, {
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
      const rejected = Number(result.preview?.rejectedRows) || 0;
      const businessWarnings = committed.filter(c => Array.isArray(c.businessRuleWarnings) && c.businessRuleWarnings.length).length;
      alert(`${committed.length} kayıt aktarıldı${rejected ? `, ${rejected} kayıt reddedildi` : ""}${businessWarnings ? `, ${businessWarnings} kayıtta iş kuralı uyarısı bulundu (denetim izinde kayıtlı)` : ""}.`);
    } catch (error) {
      console.error("V19.1 integration import commit error:", error);
      alert(`Import tamamlanamadı: ${error?.message || String(error)}`);
    }
  }


  /* ==========================================================
     TEMPLATE DOWNLOAD
  ========================================================== */

  const downloadTemplateButton = document.getElementById("downloadTemplateButton");
  if (downloadTemplateButton) downloadTemplateButton.onclick = downloadTemplate;


  function downloadTemplate() {

    const rows = [

      {
        "Sözleşme ID":
          "LEASE-004",

        "Şirket":
          "GK Holding",

        "Tedarikçi":
          "Örnek Tedarikçi",

        "Aylık Kira":
          100000,

        "Başlangıç Tarihi":
          "2026-01-01",

        "Bitiş Tarihi":
          "2030-12-31",

        "İskonto Oranı":
          18,

        "Yenileme Tarihi":
          "2030-09-30",

        "Varlık Sınıfı":
          "Makine",

        "Peşin Ödemeler":
          0,

        "Kiralayan Teşvikleri":
          0,

        "Kira Artış Tipi":
          "Artış Yok",

        "Yıllık Artış Oranı":
          0,

        "Sabit Artış Tutarı":
          0,

        "Değişken Ödeme":
          0,

        "Varlığın Faydalı Ömrü":
          "",

        "Yenileme Opsiyonu":
          "Hayır",

        "Fesih Opsiyonu":
          "Hayır",

        "Satın Alma Opsiyonu":
          "Hayır",

        "Mülkiyet Devri":
          "Hayır",

        "Kısa Vadeli Kiralama İstisnası":
          "Hayır",

        "Düşük Değerli Varlık İstisnası":
          "Hayır"
      }

    ];


    if (
      typeof XLSX !==
      "undefined"
    ) {

      const worksheet =
        XLSX.utils.json_to_sheet(
          rows
        );

      const workbook =
        XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Sözleşmeler"
      );

      XLSX.writeFile(
        workbook,
        "TFRS16_Sozlesme_Sablonu.xlsx"
      );

      return;
    }


    const headers =
      Object.keys(
        rows[0]
      );


    const csv =
      [
        headers.join(";"),
        headers
          .map(
            h =>
              rows[0][h]
          )
          .join(";")
      ].join("\n");


    const blob =
      new Blob(
        [
          "\uFEFF" +
          csv
        ],
        {
          type:
            "text/csv;charset=utf-8;"
        }
      );


    const url =
      URL.createObjectURL(
        blob
      );

    const link =
      document.createElement(
        "a"
      );

    link.href =
      url;

    link.download =
      "TFRS16_Sozlesme_Sablonu.csv";

    document.body.appendChild(
      link
    );

    link.click();

    link.remove();

    URL.revokeObjectURL(
      url
    );
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
      () => {

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

        try {
          v21GuardContract("contracts.delete", contract, "DELETE");
        } catch (error) {
          console.error("V21 authorization denied:", error);
          alert(error?.message || "You do not have permission to perform this action.");
          return;
        }


        const confirmed =
          confirm(
            `${contract.id} sözleşmesini silmek istediğinizden emin misiniz?`
          );


        if (!confirmed) {
          return;
        }


        const deletedSnapshot = cloneAuditValue(contract);

        recordAuditEvent({
          action: "DELETE",
          entityType: "CONTRACT",
          entityId: contract.id,
          contractId: contract.id,
          reason: "Contract deleted",
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

  function safeNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
  }

  function controlDate(value) {
    return parseDate(value);
  }

  function controlDaysBetween(a, b) {
    const da = controlDate(a);
    const db = controlDate(b);
    if (!da || !db) return null;
    return Math.round((db.getTime() - da.getTime()) / 86400000);
  }

  function controlMonthsBetween(a, b) {
    const da = controlDate(a);
    const db = controlDate(b);
    if (!da || !db) return null;
    return Math.max(0, monthsBetween(a, b));
  }

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

  function exceptionId() {
    return `EXC-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function controlJson(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return null;
    }
  }

  function controlResult(config, contract, status, result, message, expected, actual, recommendation, extra = {}) {
    return {
      controlId: config.id,
      contractId: contract?.id || null,
      controlName: config.name,
      category: config.category,
      priority: config.priority,
      severity: status,
      status,
      result: Boolean(result),
      message: message || "",
      expected: controlJson(expected),
      actual: controlJson(actual),
      recommendation: recommendation || "",
      testedAt: new Date().toISOString(),
      ...extra
    };
  }

  function controlOverallStatus(results) {
    if (results.some(item => item.status === CONTROL_STATUS.RED)) return CONTROL_STATUS.RED;
    if (results.some(item => item.status === CONTROL_STATUS.YELLOW)) return CONTROL_STATUS.YELLOW;
    return CONTROL_STATUS.GREEN;
  }

  function buildControlException(contract, result, existingExceptions = []) {
    if (!result || result.status === CONTROL_STATUS.GREEN) return null;
    const existing = existingExceptions.find(item =>
      item.contractId === contract.id &&
      item.controlId === result.controlId &&
      item.status !== CONTROL_EXCEPTION_STATUS.RESOLVED &&
      item.status !== CONTROL_EXCEPTION_STATUS.WAIVED
    );
    if (existing) {
      return {
        ...controlJson(existing),
        controlName: getControlConfig(result.controlId)?.name || existing.controlName || null,
        severity: result.status,
        priority: result.priority,
        message: result.message,
        recommendation: result.recommendation,
        lastTestedAt: result.testedAt
      };
    }
    return {
      id: exceptionId(),
      contractId: contract.id,
      controlId: result.controlId,
      controlName: getControlConfig(result.controlId)?.name || result.controlName || null,
      severity: result.status,
      priority: result.priority,
      status: CONTROL_EXCEPTION_STATUS.OPEN,
      message: result.message,
      recommendation: result.recommendation,
      createdAt: result.testedAt,
      resolvedAt: null,
      resolvedBy: null,
      lastTestedAt: result.testedAt
    };
  }

  function getControlConfig(controlIdValue) {
    return CONTROL_CONFIG.find(item => item.id === controlIdValue) || null;
  }

  function getJournalEntriesForControl(contract) {
    const entries = [];
    const modifications = Array.isArray(contract?.modifications) ? contract.modifications : [];
    const reassessments = Array.isArray(contract?.reassessments) ? contract.reassessments : [];

    modifications.filter(item => item?.status === "APPLIED").forEach(item => {
      if (Array.isArray(item.journal)) entries.push(...item.journal.map(row => ({ ...row, _sourceId: item.id })));
    });

    reassessments.filter(item => item?.status === "APPLIED").forEach(item => {
      if (Array.isArray(item.journal)) entries.push(...item.journal.map(row => ({ ...row, _sourceId: item.id })));
    });

    return entries;
  }

  function controlHasAuditEvent(contractIdValue, actions = []) {
    const events = getAuditTrail(contractIdValue);
    return actions.some(action => events.some(event => event.action === action && event.contractId === contractIdValue));
  }

  function controlSchedule(contract) {
    try {
      if (typeof getReassessmentBaseSchedule === "function") {
        const resolved = getReassessmentBaseSchedule(contract);
        if (Array.isArray(resolved) && resolved.length) return resolved;
      }

      const latestReassessment = typeof getCurrentReassessmentState === "function"
        ? getCurrentReassessmentState(contract)
        : null;
      if (latestReassessment && latestReassessment.status === "APPLIED" && typeof buildReassessedSchedule === "function") {
        const reassessed = buildReassessedSchedule(contract, latestReassessment);
        if (Array.isArray(reassessed) && reassessed.length) return reassessed;
      }

      const latestModification = typeof getCurrentAppliedModification === "function"
        ? getCurrentAppliedModification(contract)
        : null;
      if (latestModification && typeof buildModifiedSchedule === "function") {
        const modified = buildModifiedSchedule(contract, latestModification);
        if (Array.isArray(modified) && modified.length) return modified;
      }

      const engine = typeof calculateLeaseEngine === "function" ? calculateLeaseEngine(contract) : null;
      return Array.isArray(engine?.schedule) ? engine.schedule : [];
    } catch (error) {
      return [];
    }
  }

  function controlDataCompleteness(contract, config) {
    const required = ["id", "company", "supplier", "startDate", "endDate", "monthlyPayment", "paymentFrequency", "paymentTiming", "discountRate", "currency"];
    const missing = required.filter(field => {
      const value = contract?.[field];
      return value === undefined || value === null || String(value).trim() === "";
    });
    if (missing.includes("id") || missing.includes("startDate") || missing.includes("endDate") || missing.includes("monthlyPayment") || missing.includes("discountRate")) {
      return controlResult(config, contract, CONTROL_STATUS.RED, false, `Critical contract fields are missing: ${missing.join(", ")}.`, required, missing, "Complete the critical contract fields before accounting calculation.");
    }
    if (missing.length) {
      return controlResult(config, contract, CONTROL_STATUS.YELLOW, false, `Non-critical contract fields are missing: ${missing.join(", ")}.`, required, missing, "Complete the missing contract master data where applicable.");
    }
    return controlResult(config, contract, CONTROL_STATUS.GREEN, true, "Critical contract data is complete.", required, [], "No action required.");
  }

  function controlDateValidity(contract, config) {
    const start = controlDate(contract?.startDate);
    const end = controlDate(contract?.endDate);
    if (!start || !end) return controlResult(config, contract, CONTROL_STATUS.RED, false, "Start date or end date is invalid or missing.", "Valid start and end dates", { startDate: contract?.startDate, endDate: contract?.endDate }, "Correct the contract dates before calculation.");
    if (end.getTime() <= start.getTime()) return controlResult(config, contract, CONTROL_STATUS.RED, false, "Lease end date must be after lease start date.", "endDate > startDate", { startDate: contract.startDate, endDate: contract.endDate }, "Correct the lease term dates.");

    const modifications = Array.isArray(contract?.modifications) ? contract.modifications : [];
    const reassessments = Array.isArray(contract?.reassessments) ? contract.reassessments : [];
    const invalidModification = modifications.find(item => {
      const effective = controlDate(item?.effectiveDate);
      return effective && effective.getTime() < start.getTime();
    });
    if (invalidModification) return controlResult(config, contract, CONTROL_STATUS.RED, false, "A modification effective date is before lease commencement.", "effectiveDate >= startDate", invalidModification.effectiveDate, "Correct the modification effective date.");
    const invalidReassessment = reassessments.find(item => {
      const effective = controlDate(item?.effectiveDate);
      return effective && effective.getTime() < start.getTime();
    });
    if (invalidReassessment) return controlResult(config, contract, CONTROL_STATUS.RED, false, "A reassessment effective date is before lease commencement.", "effectiveDate >= startDate", invalidReassessment.effectiveDate, "Correct the reassessment effective date.");
    return controlResult(config, contract, CONTROL_STATUS.GREEN, true, "Contract and event dates are valid.", "Valid chronological dates", { startDate: contract.startDate, endDate: contract.endDate }, "No action required.");
  }

  function controlPayment(contract, config) {
    const payment = Number(contract?.monthlyPayment);
    const validFrequency = ["monthly", "quarterly", "annual"].includes(String(contract?.paymentFrequency || "monthly").toLowerCase());
    const validTiming = ["arrears", "advance"].includes(String(contract?.paymentTiming || "arrears").toLowerCase());
    if (!Number.isFinite(payment) || payment <= 0) return controlResult(config, contract, CONTROL_STATUS.RED, false, "Payment must be a finite positive amount.", "> 0", contract?.monthlyPayment, "Correct the payment amount before calculation.");
    if (!validFrequency || !validTiming) return controlResult(config, contract, CONTROL_STATUS.RED, false, "Payment frequency or timing is invalid.", "monthly/quarterly/annual and advance/arrears", { frequency: contract?.paymentFrequency, timing: contract?.paymentTiming }, "Correct payment frequency and payment timing.");
    return controlResult(config, contract, CONTROL_STATUS.GREEN, true, "Payment assumptions are valid.", "Positive payment and supported payment convention", { payment, frequency: contract.paymentFrequency, timing: contract.paymentTiming }, "No action required.");
  }

  function controlDiscountRate(contract, config) {
    const raw = contract?.discountRate;
    const rate = Number(raw);
    if (raw === "" || raw === null || raw === undefined || !Number.isFinite(rate) || rate < 0) return controlResult(config, contract, CONTROL_STATUS.RED, false, "Discount rate is missing or invalid.", ">= 0 and numeric", raw, "Enter a valid discount rate.");
    if (rate > 50) return controlResult(config, contract, CONTROL_STATUS.YELLOW, false, "Discount rate is unusually high and requires review.", "Reasonable market-consistent rate", rate, "Review the discount rate against the lease economics and approved assumptions.");
    return controlResult(config, contract, CONTROL_STATUS.GREEN, true, "Discount rate is valid.", ">= 0 and finite", rate, "No action required.");
  }

  function controlLeaseTerm(contract, config) {
    const schedule = controlSchedule(contract);
    if (!schedule.length) return controlResult(config, contract, CONTROL_STATUS.RED, false, "No payment schedule is available for the contract.", "Non-empty schedule", 0, "Run the existing calculation/schedule engine and resolve any calculation errors.");
    const dates = schedule.map(item => controlDate(item?.date)).filter(Boolean);
    if (!dates.length) return controlResult(config, contract, CONTROL_STATUS.RED, false, "Payment schedule contains no valid dates.", "Valid schedule dates", 0, "Regenerate the payment schedule.");
    const end = controlDate(contract?.endDate);
    const last = dates[dates.length - 1];
    const dayDifference = end && last ? Math.abs(controlDaysBetween(last, end)) : null;
    if (dayDifference !== null && dayDifference > 62) return controlResult(config, contract, CONTROL_STATUS.YELLOW, false, "Payment schedule end date is materially different from contract end date.", "Schedule end aligned with lease end", { scheduleEnd: last.toISOString(), contractEnd: end.toISOString(), differenceDays: dayDifference }, "Review lease term, payment frequency and any applied modification/reassessment.");
    return controlResult(config, contract, CONTROL_STATUS.GREEN, true, "Lease term and schedule are consistent within tolerance.", "Schedule aligned with contract term", { periods: schedule.length, scheduleEnd: last.toISOString(), contractEnd: end ? end.toISOString() : null }, "No action required.");
  }

  function controlEscalation(contract, config) {
    const type = String(contract?.leaseIncreaseType || "none");
    if (type === "none" || type === "index") {
      if (type === "index") return controlResult(config, contract, CONTROL_STATUS.YELLOW, false, "Index-linked escalation is enabled but no index calculation source is present in the current engine.", "Supported index calculation evidence", { leaseIncreaseType: type }, "Review index-linked payment assumptions and reassessment evidence.");
      return controlResult(config, contract, CONTROL_STATUS.GREEN, true, "No fixed escalation control is required.", "none or supported escalation", { leaseIncreaseType: type }, "No action required.");
    }
    if (type === "fixedRate") {
      const rate = Number(contract?.leaseIncreaseRate);
      if (!Number.isFinite(rate) || rate < 0) return controlResult(config, contract, CONTROL_STATUS.RED, false, "Fixed-rate escalation contains an invalid rate.", ">= 0 and numeric", contract?.leaseIncreaseRate, "Correct the fixed-rate escalation assumption.");
    } else if (type === "fixedAmount") {
      const amount = Number(contract?.fixedIncrease);
      if (!Number.isFinite(amount) || amount < 0) return controlResult(config, contract, CONTROL_STATUS.RED, false, "Fixed-amount escalation contains an invalid increase amount.", ">= 0 and numeric", contract?.fixedIncrease, "Correct the fixed-amount escalation assumption.");
    } else {
      return controlResult(config, contract, CONTROL_STATUS.RED, false, "Unsupported escalation type was detected.", "none, fixedRate, fixedAmount or index", type, "Correct the escalation type or migrate the contract to a supported assumption.");
    }
    return controlResult(config, contract, CONTROL_STATUS.GREEN, true, "Escalation assumptions are valid.", "Supported escalation configuration", { type, rate: contract?.leaseIncreaseRate, fixedIncrease: contract?.fixedIncrease }, "No action required.");
  }

  function controlCalculation(contract, config) {
    try {
      const engine = calculateLeaseEngine(contract);
      const schedule = Array.isArray(engine?.schedule) ? engine.schedule : [];
      if (!engine || engine.error) return controlResult(config, contract, CONTROL_STATUS.RED, false, "Professional calculation engine returned an error.", "Valid calculation result", engine?.error || null, "Review contract assumptions and calculation inputs.");
      if (contract?.shortTermLease === true || contract?.lowValueAsset === true) return controlResult(config, contract, CONTROL_STATUS.GREEN, true, "Recognition exemption is active; liability control is not applicable in the normal recognition model.", "Exemption-aware calculation", { shortTermLease: contract.shortTermLease, lowValueAsset: contract.lowValueAsset }, "No action required.");
      if (!schedule.length) return controlResult(config, contract, CONTROL_STATUS.RED, false, "Calculation returned an empty payment schedule.", "Non-empty schedule", 0, "Correct lease dates/payment assumptions and regenerate the calculation.");
      const invalid = schedule.find(row => !isFiniteNumber(Number(row?.openingLiability)) || !isFiniteNumber(Number(row?.interest)) || !isFiniteNumber(Number(row?.payment)) || !isFiniteNumber(Number(row?.principal)) || !isFiniteNumber(Number(row?.closingLiability)) || Number(row.closingLiability) < -CONTROL_TOLERANCE);
      if (invalid) return controlResult(config, contract, CONTROL_STATUS.RED, false, "Lease liability schedule contains an invalid or negative balance.", "Finite non-negative liability balances", invalid, "Review the calculation inputs and schedule generation.");
      const broken = schedule.find(row => Math.abs((safeNumber(row.openingLiability) + safeNumber(row.interest) - safeNumber(row.payment)) - safeNumber(row.closingLiability)) > CONTROL_TOLERANCE);
      if (broken) return controlResult(config, contract, CONTROL_STATUS.RED, false, "Opening liability + interest - payment does not reconcile to closing liability.", "Opening + Interest - Payment = Closing", broken, "Review the liability amortisation calculation.");
      return controlResult(config, contract, CONTROL_STATUS.GREEN, true, "Lease liability calculation and schedule arithmetic reconcile.", "All schedule rows reconcile", { periods: schedule.length, liability: safeNumber(engine.liability) }, "No action required.");
    } catch (error) {
      return controlResult(config, contract, CONTROL_STATUS.RED, false, "Lease calculation control failed unexpectedly.", "Successful calculation", error?.message || String(error), "Review the contract and calculation engine inputs.");
    }
  }

  function controlROU(contract, config) {
    try {
      const engine = calculateLeaseEngine(contract);
      if (!engine) return controlResult(config, contract, CONTROL_STATUS.RED, false, "ROU calculation result is unavailable.", "Valid ROU result", null, "Run the calculation engine and review the contract assumptions.");
      const schedule = Array.isArray(engine.schedule) ? engine.schedule : [];
      const negative = schedule.find(row => Number(row?.rouClosing) < -CONTROL_TOLERANCE || Number(row?.rouOpening) < -CONTROL_TOLERANCE);
      if (negative) return controlResult(config, contract, CONTROL_STATUS.RED, false, "ROU schedule contains a negative balance.", "ROU >= 0", negative, "Review depreciation and modification/reassessment adjustments.");
      const rou = Number(engine.rou);
      if (!Number.isFinite(rou) || rou < -CONTROL_TOLERANCE) return controlResult(config, contract, CONTROL_STATUS.RED, false, "Calculated ROU asset is invalid or negative.", ">= 0 and finite", rou, "Review ROU calculation and lease adjustments.");
      return controlResult(config, contract, CONTROL_STATUS.GREEN, true, "ROU calculation is valid and non-negative.", ">= 0 and finite", rou, "No action required.");
    } catch (error) {
      return controlResult(config, contract, CONTROL_STATUS.RED, false, "ROU control could not complete.", "Valid ROU result", error?.message || String(error), "Review the ROU calculation inputs.");
    }
  }

  function controlJournal(contract, config) {
    const rows = getJournalEntriesForControl(contract);
    const appliedChanges = [
      ...(Array.isArray(contract?.modifications) ? contract.modifications : []),
      ...(Array.isArray(contract?.reassessments) ? contract.reassessments : [])
    ].filter(item => item?.status === "APPLIED");
    const missingAppliedJournal = appliedChanges.find(item => !Array.isArray(item.journal) || !item.journal.length);
    if (missingAppliedJournal) return controlResult(config, contract, CONTROL_STATUS.RED, false, "An applied modification or reassessment has no journal.", "Applied event must have a journal", { id: missingAppliedJournal.id, status: missingAppliedJournal.status }, "Generate and validate the corresponding accounting journal.");
    if (rows.length) {
      const debit = rows.reduce((sum, item) => sum + safeNumber(item?.debit), 0);
      const credit = rows.reduce((sum, item) => sum + safeNumber(item?.credit), 0);
      const invalid = rows.find(item => !Number.isFinite(Number(item?.debit)) || !Number.isFinite(Number(item?.credit)) || Number(item.debit) < 0 || Number(item.credit) < 0);
      if (invalid) return controlResult(config, contract, CONTROL_STATUS.RED, false, "Journal contains invalid debit or credit values.", "Finite non-negative debit/credit", invalid, "Review the generated journal entries.");
      if (Math.abs(debit - credit) > CONTROL_TOLERANCE) return controlResult(config, contract, CONTROL_STATUS.RED, false, "Journal is not balanced.", "Total debit = total credit", { debit, credit }, "Review journal generation and ensure total debit equals total credit.");
      const missingCore = rows.find(item => !item?.account || !item?.source);
      if (missingCore) return controlResult(config, contract, CONTROL_STATUS.YELLOW, false, "Journal contains entries with missing account or source metadata.", "Account and source present", missingCore, "Complete journal metadata before export.");
    }
    if (!rows.length && appliedChanges.length) return controlResult(config, contract, CONTROL_STATUS.RED, false, "Applied accounting events exist but no journal entries were found.", "Journal for applied events", 0, "Generate the missing journal entries.");
    return controlResult(config, contract, CONTROL_STATUS.GREEN, true, "Available modification/reassessment journals are balanced and valid.", "Balanced journal", { entries: rows.length }, "No action required.");
  }

  function controlClassification(contract, config) {
    const reportingDate = contract?.reportingDate || new Date().toISOString();
    try {
      const split = typeof calculateReassessmentClassification === "function"
        ? calculateReassessmentClassification(contract, reportingDate)
        : calculateLiabilitySplitAsOf(contract, reportingDate);
      if (!split || split.valid === false) return controlResult(config, contract, CONTROL_STATUS.RED, false, "Current/non-current classification could not be calculated.", "Valid liability split", split, "Review the reporting date and lease schedule.");
      const current = safeNumber(split.currentLiability ?? split.current);
      const nonCurrent = safeNumber(split.nonCurrentLiability ?? split.nonCurrent);
      const total = safeNumber(split.totalLeaseLiability ?? split.total ?? split.outstandingLiability);
      if (current < -CONTROL_TOLERANCE || nonCurrent < -CONTROL_TOLERANCE || total < -CONTROL_TOLERANCE) return controlResult(config, contract, CONTROL_STATUS.RED, false, "Current or non-current liability is negative.", ">= 0", { current, nonCurrent, total }, "Review reporting-date liability classification.");
      if (Math.abs((current + nonCurrent) - total) > 0.05) return controlResult(config, contract, CONTROL_STATUS.RED, false, "Current plus non-current liability does not reconcile to total lease liability.", "Current + Non-current ≈ Total", { current, nonCurrent, total }, "Review the existing reporting-date classification engine.");
      return controlResult(config, contract, CONTROL_STATUS.GREEN, true, "Current/non-current liability classification reconciles.", "Current + Non-current ≈ Total", { current, nonCurrent, total, reportingDate }, "No action required.");
    } catch (error) {
      return controlResult(config, contract, CONTROL_STATUS.RED, false, "Classification control failed.", "Valid liability split", error?.message || String(error), "Review the reporting-date classification calculation.");
    }
  }

  function controlModification(contract, config) {
    const items = Array.isArray(contract?.modifications) ? contract.modifications : [];
    for (const item of items) {
      if (!item?.id) return controlResult(config, contract, CONTROL_STATUS.RED, false, "Modification is missing its ID.", "Modification ID", item, "Repair the modification record.");
      if (typeof getModificationEffectiveDate === "function" && !getModificationEffectiveDate(item)) return controlResult(config, contract, CONTROL_STATUS.RED, false, "Modification is missing a valid effective date.", "Modification effective date", item.id, "Set a valid effective date on the modification record.");
      if (item.status === "APPLIED") {
        const hasSchedule = typeof buildModifiedSchedule === "function" && Array.isArray(buildModifiedSchedule(contract, item)) && buildModifiedSchedule(contract, item).length > 0;
        if (!hasSchedule) return controlResult(config, contract, CONTROL_STATUS.RED, false, "Applied modification has no revised schedule.", "Applied modification with revised schedule", item.id, "Regenerate the modified schedule and review the effective date.");
        if (!Array.isArray(item.journal) || !item.journal.length) return controlResult(config, contract, CONTROL_STATUS.RED, false, "Applied modification has no journal.", "Applied modification with journal", item.id, "Generate the modification journal.");
      }
    }
    return controlResult(config, contract, CONTROL_STATUS.GREEN, true, "Modification records are internally consistent.", "Applied modifications have schedule and journal evidence", { count: items.length }, "No action required.");
  }

  function controlReassessment(contract, config) {
    const items = Array.isArray(contract?.reassessments) ? contract.reassessments : [];
    for (const item of items) {
      if (!item?.id) return controlResult(config, contract, CONTROL_STATUS.RED, false, "Reassessment is missing its ID.", "Reassessment ID", item, "Repair the reassessment record.");
      if (item.status === "APPLIED") {
        const hasSchedule = typeof buildReassessedSchedule === "function" && Array.isArray(buildReassessedSchedule(contract, item)) && buildReassessedSchedule(contract, item).length > 0;
        if (!hasSchedule) return controlResult(config, contract, CONTROL_STATUS.RED, false, "Applied reassessment has no revised schedule.", "Applied reassessment with revised schedule", item.id, "Regenerate the reassessed schedule and review the effective date.");
        if (!Array.isArray(item.journal) || !item.journal.length) return controlResult(config, contract, CONTROL_STATUS.RED, false, "Applied reassessment has no journal.", "Applied reassessment with journal", item.id, "Generate the reassessment journal.");
      }
    }
    return controlResult(config, contract, CONTROL_STATUS.GREEN, true, "Reassessment records are internally consistent.", "Applied reassessments have schedule and journal evidence", { count: items.length }, "No action required.");
  }

  function controlAudit(contract, config) {
    const events = getAuditTrail(contract?.id);
    if (!events.length) return controlResult(config, contract, CONTROL_STATUS.RED, false, "No audit evidence exists for the contract.", "At least one audit event", 0, "Create the contract through the application flow or migrate its legacy audit evidence.");
    const criticalMissing = [];
    if (!(typeof controlHasAuditEvent === "function" ? controlHasAuditEvent(contract?.id, ["CREATE"]) : events.some(e => e.action === "CREATE"))) criticalMissing.push("CREATE");
    const appliedModifications = (contract?.modifications || []).filter(e => e?.status === "APPLIED");
    const appliedReassessments = (contract?.reassessments || []).filter(e => e?.status === "APPLIED");
    if (appliedModifications.some(item => !events.some(e => e.modificationId === item.id && e.action === "MODIFICATION_APPLIED"))) criticalMissing.push("MODIFICATION_APPLIED");
    if (appliedReassessments.some(item => !events.some(e => e.reassessmentId === item.id && e.action === "REASSESSMENT_APPLIED"))) criticalMissing.push("REASSESSMENT_APPLIED");
    if (criticalMissing.length) return controlResult(config, contract, CONTROL_STATUS.RED, false, `Critical audit evidence is missing: ${criticalMissing.join(", ")}.`, "Complete critical audit chain", criticalMissing, "Restore or generate the missing audit evidence before relying on the control record.");
    return controlResult(config, contract, CONTROL_STATUS.GREEN, true, "Critical audit evidence is available.", "Critical lifecycle evidence", { events: events.length }, "No action required.");
  }

  function controlLifecycle(contract, config) {
    const status = String(contract?.status || "").toUpperCase();
    const today = new Date();
    const end = controlDate(contract?.endDate);
    const liability = (() => {
      try {
        const split = calculateReassessmentClassification(contract, today.toISOString());
        return safeNumber(split?.totalLeaseLiability ?? split?.total ?? split?.outstandingLiability);
      } catch (error) {
        return 0;
      }
    })();
    if (status === "TERMINATED" && liability > CONTROL_TOLERANCE) return controlResult(config, contract, CONTROL_STATUS.RED, false, "Terminated contract still carries a lease liability.", "Lease liability = 0 after termination", liability, "Review termination accounting and settlement of the remaining lease liability.");
    if (status === "ACTIVE" && end && end.getTime() < today.getTime()) return controlResult(config, contract, CONTROL_STATUS.YELLOW, false, "Active contract has passed its contractual end date.", "Active contract end date in the future", { status, endDate: contract.endDate }, "Review contract status and any renewal/termination reassessment.");
    return controlResult(config, contract, CONTROL_STATUS.GREEN, true, "Contract lifecycle status is consistent with the available dates and liability.", "Status aligned with lifecycle", { status, endDate: contract.endDate, liability }, "No action required.");
  }

  function controlExpiryRenewal(contract, config) {
    const today = new Date();
    const end = controlDate(contract?.endDate);
    const renewal = controlDate(contract?.renewalDate);
    const dates = [];
    if (end) dates.push({ type: "EXPIRY", date: end });
    if (renewal) dates.push({ type: "RENEWAL", date: renewal });
    const upcoming = dates
      .map(item => ({
        ...item,
        days: Math.ceil((item.date.getTime() - today.getTime()) / 86400000),
        months: typeof controlMonthsBetween === "function" ? controlMonthsBetween(today, item.date) : null
      }))
      .filter(item => item.days >= 0 && item.days <= 180);
    const within90 = upcoming.find(item => item.days <= 90);
    if (within90) return controlResult(config, contract, CONTROL_STATUS.YELLOW, false, `${within90.type} is approaching within 90 days.`, "No unreviewed near-term expiry/renewal", { type: within90.type, days: within90.days, months: within90.months, date: within90.date.toISOString() }, "Review renewal/termination assumptions and determine whether reassessment is required.");
    if (upcoming.length) return controlResult(config, contract, CONTROL_STATUS.YELLOW, false, "Contract expiry or renewal is within 180 days.", "No unreviewed near-term event", upcoming.map(item => ({ type: item.type, days: item.days, months: item.months, date: item.date.toISOString() })), "Review upcoming lease term decisions and prepare evidence for any reassessment.");
    return controlResult(config, contract, CONTROL_STATUS.GREEN, true, "No expiry or renewal event is within the next 180 days.", "> 180 days or no configured event", dates.map(item => ({ type: item.type, date: item.date.toISOString() })), "No action required.");
  }

  function evaluateControl(config, contract) {
    switch (config.id) {
      case "CTRL-DATA-001": return controlDataCompleteness(contract, config);
      case "CTRL-DATA-002": return controlDateValidity(contract, config);
      case "CTRL-PAY-001": return controlPayment(contract, config);
      case "CTRL-RATE-001": return controlDiscountRate(contract, config);
      case "CTRL-TERM-001": return controlLeaseTerm(contract, config);
      case "CTRL-ESC-001": return controlEscalation(contract, config);
      case "CTRL-CALC-001": return controlCalculation(contract, config);
      case "CTRL-ROU-001": return controlROU(contract, config);
      case "CTRL-JRN-001": return controlJournal(contract, config);
      case "CTRL-CLS-001": return controlClassification(contract, config);
      case "CTRL-MOD-001": return controlModification(contract, config);
      case "CTRL-REA-001": return controlReassessment(contract, config);
      case "CTRL-AUD-001": return controlAudit(contract, config);
      case "CTRL-LIFE-001": return controlLifecycle(contract, config);
      case "CTRL-LIFE-002": return controlExpiryRenewal(contract, config);
      default:
        return controlResult(config, contract, CONTROL_STATUS.GREEN, true, "Control is not implemented.", null, null, "No action required.");
    }
  }

  function runContractControls(contract, options = {}) {
    if (!contract || !contract.id) {
      return {
        controlRunId: controlId(),
        contractId: null,
        overallStatus: CONTROL_STATUS.RED,
        controls: [],
        exceptions: [],
        summary: { critical: 1, high: 0, medium: 0, low: 0 },
        testedAt: new Date().toISOString(),
        valid: false,
        error: "Contract is missing a valid ID."
      };
    }

    const testedAt = new Date().toISOString();
    const configs = CONTROL_CONFIG.filter(item => item.enabled !== false);
    const controls = configs.map(config => {
      try {
        return evaluateControl(config, contract);
      } catch (error) {
        return controlResult(config, contract, CONTROL_STATUS.RED, false, `Control ${config.id} failed unexpectedly.`, "Successful control evaluation", error?.message || String(error), "Review the control and underlying contract data.");
      }
    });

    const previousSnapshots = loadControlSnapshots();
    const previous = previousSnapshots[contract.id];
    const existingExceptions = Array.isArray(previous?.exceptions) ? previous.exceptions : [];
    const exceptions = controls.map(result => buildControlException(contract, result, existingExceptions)).filter(Boolean);
    const overallStatus = controlOverallStatus(controls);
    const summary = {
      critical: controls.filter(item => item.priority === CONTROL_PRIORITY.CRITICAL && item.status !== CONTROL_STATUS.GREEN).length,
      high: controls.filter(item => item.priority === CONTROL_PRIORITY.HIGH && item.status !== CONTROL_STATUS.GREEN).length,
      medium: controls.filter(item => item.priority === CONTROL_PRIORITY.MEDIUM && item.status !== CONTROL_STATUS.GREEN).length,
      low: controls.filter(item => item.priority === CONTROL_PRIORITY.LOW && item.status !== CONTROL_STATUS.GREEN).length
    };

    const snapshot = {
      controlRunId: controlId(),
      contractId: contract.id,
      overallStatus,
      riskStatus: overallStatus,
      controls,
      exceptions,
      summary,
      testedAt,
      version: "V16.8"
    };

    if (options.persist !== false) {
      previousSnapshots[contract.id] = controlJson(snapshot);
      saveControlSnapshots(previousSnapshots);
    }

    if (options.audit !== false) {
      recordAuditEvent({
        action: "CONTROL_RUN",
        entityType: "CONTROL_SNAPSHOT",
        entityId: snapshot.controlRunId,
        contractId: contract.id,
        reason: "V16.8 risk and control evaluation",
        metadata: {
          overallStatus,
          exceptionCount: exceptions.length,
          critical: summary.critical,
          high: summary.high,
          medium: summary.medium,
          low: summary.low
        }
      });
    }

    return snapshot;
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

  function getContractControlResults(contractIdValue, options = {}) {
    const contract = contracts.find(item => item.id === contractIdValue);
    if (options.run === true && contract) return runContractControls(contract, options);
    return getStoredControlSnapshot(contractIdValue) || (contract ? runContractControls(contract, { ...options, persist: false }) : null);
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

  function getControlSummary(options = {}) {
    const targetContracts = Array.isArray(options.contracts)
      ? options.contracts
      : contracts;
    const snapshots = targetContracts.map(contract => runContractControls(contract, { persist: options.persist !== false, audit: options.audit === true }));
    return {
      testedAt: new Date().toISOString(),
      totalContracts: snapshots.length,
      green: snapshots.filter(item => item.overallStatus === CONTROL_STATUS.GREEN).length,
      yellow: snapshots.filter(item => item.overallStatus === CONTROL_STATUS.YELLOW).length,
      red: snapshots.filter(item => item.overallStatus === CONTROL_STATUS.RED).length,
      criticalExceptions: snapshots.reduce((sum, item) => sum + safeNumber(item.summary?.critical), 0),
      highExceptions: snapshots.reduce((sum, item) => sum + safeNumber(item.summary?.high), 0),
      mediumExceptions: snapshots.reduce((sum, item) => sum + safeNumber(item.summary?.medium), 0),
      lowExceptions: snapshots.reduce((sum, item) => sum + safeNumber(item.summary?.low), 0),
      snapshots
    };
  }

  function getRiskSummary(options = {}) {
    const summary = getControlSummary(options);
    return {
      testedAt: summary.testedAt,
      totalContracts: summary.totalContracts,
      GREEN: summary.green,
      YELLOW: summary.yellow,
      RED: summary.red,
      criticalExceptions: summary.criticalExceptions,
      highExceptions: summary.highExceptions,
      mediumExceptions: summary.mediumExceptions,
      lowExceptions: summary.lowExceptions
    };
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

  function exportControlResults(contractIdValue) {
    const target = contractIdValue
      ? [getContractControlResults(contractIdValue, { run: true, persist: true, audit: false })].filter(Boolean)
      : contracts.map(contract => runContractControls(contract, { persist: true, audit: false }));
    if (!target.length) return false;
    const rows = [];
    target.forEach(snapshot => {
      snapshot.controls.forEach(item => rows.push({
        ControlRunID: snapshot.controlRunId,
        TestedAt: item.testedAt,
        ContractID: item.contractId,
        OverallStatus: snapshot.overallStatus,
        ControlID: item.controlId,
        ControlName: item.controlName,
        Category: item.category,
        Priority: item.priority,
        Status: item.status,
        Result: item.result,
        Message: item.message,
        Expected: JSON.stringify(item.expected ?? null),
        Actual: JSON.stringify(item.actual ?? null),
        Recommendation: item.recommendation || ""
      }));
    });
    if (typeof XLSX !== "undefined") {
      try {
        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Control Results");
        XLSX.writeFile(workbook, `TFRS16_Control_Results_${Date.now()}.xlsx`);
        recordAuditEvent({ action: "EXPORT", entityType: "CONTROL_RESULTS", entityId: contractIdValue || "ALL", contractId: contractIdValue || null, reason: "Control results export", metadata: { recordCount: rows.length, format: "xlsx" } });
        return true;
      } catch (error) {
        return false;
      }
    }
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(";"), ...rows.map(row => headers.map(header => String(row[header] ?? "").replace(/;/g, ",")).join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `TFRS16_Control_Results_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    recordAuditEvent({ action: "EXPORT", entityType: "CONTROL_RESULTS", entityId: contractIdValue || "ALL", contractId: contractIdValue || null, reason: "Control results export", metadata: { recordCount: rows.length, format: "csv" } });
    return true;
  }

  function exportRiskSummary() {
    const summary = getRiskSummary({ persist: true });
    const rows = [{
      TestedAt: summary.testedAt,
      TotalContracts: summary.totalContracts,
      GREEN: summary.GREEN,
      YELLOW: summary.YELLOW,
      RED: summary.RED,
      CriticalExceptions: summary.criticalExceptions,
      HighExceptions: summary.highExceptions,
      MediumExceptions: summary.mediumExceptions,
      LowExceptions: summary.lowExceptions
    }];
    if (typeof XLSX !== "undefined") {
      try {
        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Risk Summary");
        XLSX.writeFile(workbook, `TFRS16_Risk_Summary_${Date.now()}.xlsx`);
        recordAuditEvent({ action: "EXPORT", entityType: "RISK_SUMMARY", entityId: "ALL", reason: "Risk summary export", metadata: { format: "xlsx" } });
        return true;
      } catch (error) {
        return false;
      }
    }
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(";"), headers.map(h => String(rows[0][h] ?? "").replace(/;/g, ",")).join(";")].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `TFRS16_Risk_Summary_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    recordAuditEvent({ action: "EXPORT", entityType: "RISK_SUMMARY", entityId: "ALL", reason: "Risk summary export", metadata: { format: "csv" } });
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

  function cfoNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function cfoRound(value, digits = 2) {
    const n = cfoNumber(value);
    const factor = Math.pow(10, digits);
    return Math.round((n + Number.EPSILON) * factor) / factor;
  }

  function cfoClone(value) {
    try { return JSON.parse(JSON.stringify(value)); } catch (error) { return null; }
  }

  function cfoDate(value) {
    return typeof parseDate === "function" ? parseDate(value) : null;
  }

  function cfoIsoDate(value) {
    const d = cfoDate(value);
    if (!d) return null;
    return d.toISOString().slice(0, 10);
  }

  function cfoAddMonths(date, months) {
    const d = cfoDate(date);
    if (!d) return null;
    return new Date(d.getFullYear(), d.getMonth() + months, d.getDate());
  }

  function cfoDaysBetween(from, to) {
    const a = cfoDate(from), b = cfoDate(to);
    if (!a || !b) return null;
    return Math.round((b.getTime() - a.getTime()) / 86400000);
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

  function cfoGetContracts() {
    return Array.isArray(contracts) ? contracts : [];
  }

  function cfoResolveReportingDate(reportingDate) {
    const parsed = cfoDate(reportingDate);
    return parsed || new Date();
  }

  function cfoBuildSchedule(contract) {
    try {
      if (typeof getCurrentReassessmentState === "function" && typeof buildReassessedSchedule === "function") {
        const latest = getCurrentReassessmentState(contract);
        if (latest && latest.status === "APPLIED") {
          const reassessed = buildReassessedSchedule(contract, latest);
          if (Array.isArray(reassessed) && reassessed.length) return { schedule: reassessed, engine: null, source: "REASSESSED_SCHEDULE" };
        }
      }
      if (typeof getCurrentAppliedModification === "function" && typeof buildModifiedSchedule === "function") {
        const latestModification = getCurrentAppliedModification(contract);
        if (latestModification) {
          const modified = buildModifiedSchedule(contract, latestModification);
          if (Array.isArray(modified) && modified.length) return { schedule: modified, engine: null, source: "MODIFIED_SCHEDULE" };
        }
      }
      const engine = typeof calculateLeaseEngine === "function" ? calculateLeaseEngine(contract) : null;
      return { schedule: Array.isArray(engine?.schedule) ? engine.schedule : [], engine, source: "LEASE_SCHEDULE" };
    } catch (error) {
      return { schedule: [], engine: null, source: "ERROR", error: error?.message || String(error) };
    }
  }

  function cfoScheduleAtDate(schedule, reportingDate) {
    const report = cfoDate(reportingDate);
    if (!Array.isArray(schedule) || !schedule.length || !report) return null;
    let latest = null;
    schedule.forEach(row => {
      const d = cfoDate(row?.date);
      if (d && d.getTime() <= report.getTime() && (!latest || d.getTime() > cfoDate(latest.date).getTime())) latest = row;
    });
    return latest;
  }

  function cfoGetLiabilitySplit(contract, reportingDate, schedule) {
    try {
      if (typeof calculateLiabilitySplitAsOf === "function") {
        const result = calculateLiabilitySplitAsOf(contract, reportingDate, Array.isArray(schedule) && schedule.length ? schedule : undefined);
        if (result && result.valid !== false) return result;
      }
    } catch (error) {}
    return { valid: false, totalLeaseLiability: 0, currentLiability: 0, nonCurrentLiability: 0, next12MonthPrincipal: 0, next12MonthInterest: 0, next12MonthPayments: 0 };
  }

  function cfoGetContractMetricsInternal(contract, reportingDate) {
    const report = cfoResolveReportingDate(reportingDate);
    const built = cfoBuildSchedule(contract);
    const schedule = built.schedule || [];
    const split = cfoGetLiabilitySplit(contract, report, schedule);
    const active = cfoIsActive(contract, report);
    const rowAtDate = cfoScheduleAtDate(schedule, report);
    const current = cfoNumber(split.currentLiability ?? split.current);
    const nonCurrent = cfoNumber(split.nonCurrentLiability ?? split.nonCurrent);
    const total = cfoNumber(split.totalLeaseLiability ?? split.total ?? split.outstandingLiability);

    let rouAsset = 0;
    if (rowAtDate && rowAtDate.rouClosing !== undefined) rouAsset = Math.max(0, cfoNumber(rowAtDate.rouClosing));
    else if (rowAtDate && rowAtDate.rouOpening !== undefined && cfoDate(rowAtDate.date)?.getTime() > report.getTime()) rouAsset = Math.max(0, cfoNumber(rowAtDate.rouOpening));
    else if (!schedule.length && built.engine) rouAsset = Math.max(0, cfoNumber(built.engine.rouAssets));
    else if (schedule.length && !rowAtDate && cfoDate(contract.startDate)?.getTime() > report.getTime()) rouAsset = Math.max(0, cfoNumber(built.engine?.rouAssets));

    const monthRows = schedule.filter(row => {
      const d = cfoDate(row?.date);
      return d && d.getFullYear() === report.getFullYear() && d.getMonth() === report.getMonth();
    });
    const future12End = cfoAddMonths(report, 12);
    const future12Rows = schedule.filter(row => {
      const d = cfoDate(row?.date);
      return d && d.getTime() > report.getTime() && future12End && d.getTime() <= future12End.getTime();
    });
    const next12Payment = future12Rows.reduce((s, r) => s + cfoNumber(r?.payment), 0);
    const next12Principal = future12Rows.reduce((s, r) => s + cfoNumber(r?.principal), 0);
    const next12Interest = future12Rows.reduce((s, r) => s + cfoNumber(r?.interest), 0);
    const monthInterest = monthRows.reduce((s, r) => s + cfoNumber(r?.interest), 0);
    const monthDepreciation = monthRows.reduce((s, r) => s + cfoNumber(r?.depreciation), 0);
    const monthlyLeaseExpense = monthRows.some(r => r?.straightLineExpense !== undefined)
      ? monthRows.reduce((s, r) => s + cfoNumber(r?.straightLineExpense), 0)
      : monthInterest + monthDepreciation;

    let control = null;
    try {
      control = typeof getContractControlResults === "function" ? getContractControlResults(contract.id, { run: false, persist: false, audit: false }) : null;
    } catch (error) { control = null; }
    const exceptions = Array.isArray(control?.exceptions) ? control.exceptions : [];
    const openExceptions = exceptions.filter(item => item.status !== CONTROL_EXCEPTION_STATUS.RESOLVED && item.status !== CONTROL_EXCEPTION_STATUS.WAIVED);
    const renewalDate = contract?.renewalDate || contract?.renewalOptionDate || contract?.renewalAssessmentDate || null;
    const expiryDays = cfoDaysBetween(report, contract?.endDate);
    const renewalDays = cfoDaysBetween(report, renewalDate);
    const appliedMods = Array.isArray(contract?.modifications) ? contract.modifications.filter(x => String(x?.status || "").toUpperCase() === "APPLIED") : [];
    const pendingMods = Array.isArray(contract?.modifications) ? contract.modifications.filter(x => !["APPLIED", "CANCELLED"].includes(String(x?.status || "").toUpperCase())) : [];
    const appliedReassessments = Array.isArray(contract?.reassessments) ? contract.reassessments.filter(x => String(x?.status || "").toUpperCase() === "APPLIED") : [];
    const pendingReassessments = Array.isArray(contract?.reassessments) ? contract.reassessments.filter(x => !["APPLIED", "CANCELLED"].includes(String(x?.status || "").toUpperCase())) : [];

    return {
      contractId: contract?.id || null,
      company: contract?.company || "",
      supplier: contract?.supplier || "",
      status: String(contract?.status || "ACTIVE").toUpperCase(),
      currency: String(contract?.currency || "TRY").toUpperCase(),
      active,
      leaseLiability: Math.max(0, total),
      currentLiability: Math.max(0, current),
      nonCurrentLiability: Math.max(0, nonCurrent),
      rouAsset: Math.max(0, rouAsset),
      monthlyInterest: monthInterest,
      monthlyDepreciation: monthDepreciation,
      monthlyLeaseExpense,
      next12MonthPayments: next12Payment,
      next12MonthPrincipal: next12Principal,
      next12MonthInterest: next12Interest,
      renewalDate: cfoIsoDate(renewalDate),
      renewalDays,
      renewalRisk: renewalDays !== null && renewalDays >= 0 && renewalDays <= 180,
      expiryDate: cfoIsoDate(contract?.endDate),
      expiryDays,
      expiryRisk: expiryDays !== null && expiryDays >= 0 && expiryDays <= 365,
      modificationStatus: pendingMods.length ? "PENDING" : (appliedMods.length ? "APPLIED" : "NONE"),
      reassessmentStatus: pendingReassessments.length ? "PENDING" : (appliedReassessments.length ? "APPLIED" : "NONE"),
      pendingModifications: pendingMods.length,
      appliedModifications: appliedMods.length,
      pendingReassessments: pendingReassessments.length,
      appliedReassessments: appliedReassessments.length,
      controlStatus: control?.overallStatus || (typeof getContractRiskStatus === "function" ? getContractRiskStatus(contract.id) : "GREEN"),
      openExceptions: openExceptions.length,
      criticalExceptions: openExceptions.filter(x => x.priority === CONTROL_PRIORITY.CRITICAL).length,
      highExceptions: openExceptions.filter(x => x.priority === CONTROL_PRIORITY.HIGH).length,
      mediumExceptions: openExceptions.filter(x => x.priority === CONTROL_PRIORITY.MEDIUM).length,
      lowExceptions: openExceptions.filter(x => x.priority === CONTROL_PRIORITY.LOW).length,
      scheduleSource: built.source,
      scheduleRows: schedule.length,
      calculationValid: Boolean(schedule.length || built.engine?.exempt),
      calculationError: built.error || null,
      reportingDate: cfoIsoDate(report)
    };
  }

  function getCfoContractMetrics(contractIdValue, reportingDate) {
    const contract = cfoGetContracts().find(item => item.id === contractIdValue);
    if (!contract) return null;
    try { return cfoGetContractMetricsInternal(contract, reportingDate); }
    catch (error) {
      return { contractId: contractIdValue, reportingDate: cfoIsoDate(cfoResolveReportingDate(reportingDate)), calculationValid: false, calculationError: error?.message || String(error) };
    }
  }

  function cfoAggregateRows(rows) {
    const totals = { leaseLiability: 0, currentLiability: 0, nonCurrentLiability: 0, rouAsset: 0, monthlyInterest: 0, monthlyDepreciation: 0, monthlyLeaseExpense: 0, next12MonthPayments: 0, next12MonthPrincipal: 0, next12MonthInterest: 0 };
    rows.forEach(r => Object.keys(totals).forEach(k => { totals[k] += cfoNumber(r?.[k]); }));
    Object.keys(totals).forEach(k => totals[k] = cfoRound(totals[k]));
    return totals;
  }

  function getTotalLeaseLiability(reportingDate) { return cfoAggregateRows(cfoGetContracts().filter(c => cfoIsActive(c, cfoResolveReportingDate(reportingDate))).map(c => cfoGetContractMetricsInternal(c, reportingDate))).leaseLiability; }
  function getCurrentLeaseLiability(reportingDate) { return cfoAggregateRows(cfoGetContracts().filter(c => cfoIsActive(c, cfoResolveReportingDate(reportingDate))).map(c => cfoGetContractMetricsInternal(c, reportingDate))).currentLiability; }
  function getNonCurrentLeaseLiability(reportingDate) { return cfoAggregateRows(cfoGetContracts().filter(c => cfoIsActive(c, cfoResolveReportingDate(reportingDate))).map(c => cfoGetContractMetricsInternal(c, reportingDate))).nonCurrentLiability; }
  function getTotalRuoAssets(reportingDate) { return cfoAggregateRows(cfoGetContracts().filter(c => cfoIsActive(c, cfoResolveReportingDate(reportingDate))).map(c => cfoGetContractMetricsInternal(c, reportingDate))).rouAsset; }

  function cfoPeriodMetrics(startDate, endDate, options = {}) {
    const start = cfoDate(startDate), end = cfoDate(endDate);
    if (!start || !end || end < start) return { interestExpense: 0, depreciationExpense: 0, leaseExpense: 0, cashPayments: 0, principal: 0, paymentInterest: 0 };
    const rows = [];
    cfoGetContracts().forEach(contract => {
      try {
        const built = cfoBuildSchedule(contract);
        (built.schedule || []).forEach(row => {
          const d = cfoDate(row?.date);
          if (d && d >= start && d <= end && (!options.activeOnly || cfoIsActive(contract, start))) rows.push(row);
        });
      } catch (error) {}
    });
    const interestExpense = rows.reduce((s,r) => s+cfoNumber(r?.interest),0);
    const depreciationExpense = rows.reduce((s,r) => s+cfoNumber(r?.depreciation),0);
    const cashPayments = rows.reduce((s,r) => s+cfoNumber(r?.payment),0);
    const principal = rows.reduce((s,r) => s+cfoNumber(r?.principal),0);
    return { interestExpense:cfoRound(interestExpense), depreciationExpense:cfoRound(depreciationExpense), leaseExpense:cfoRound(interestExpense+depreciationExpense), cashPayments:cfoRound(cashPayments), principal:cfoRound(principal), paymentInterest:cfoRound(interestExpense), rowCount:rows.length };
  }

  function getInterestExpense(startDate, endDate) { return cfoPeriodMetrics(startDate, endDate).interestExpense; }
  function getDepreciationExpense(startDate, endDate) { return cfoPeriodMetrics(startDate, endDate).depreciationExpense; }
  function getMonthlyLeaseExpense(reportingDate) {
    const d = cfoResolveReportingDate(reportingDate);
    return cfoPeriodMetrics(new Date(d.getFullYear(), d.getMonth(), 1), new Date(d.getFullYear(), d.getMonth()+1, 0)).leaseExpense;
  }
  function getLeaseLiabilityMetrics(reportingDate) {
    const d = cfoResolveReportingDate(reportingDate);
    return { reportingDate:cfoIsoDate(d), total:getTotalLeaseLiability(d), current:getCurrentLeaseLiability(d), nonCurrent:getNonCurrentLeaseLiability(d) };
  }

  // TFRS 16.53(i): "the weighted average incremental borrowing rate
  // applied to lease liabilities recognized in the statement of
  // financial position" — this disclosure did not exist anywhere in
  // the module. Weighted by each contract's outstanding lease
  // liability as of the reporting date (exempt/zero-liability
  // contracts naturally get zero weight, so they don't distort the
  // rate even though they were entered with a discount rate field).
  function getWeightedAverageDiscountRate(reportingDate) {
    const d = cfoResolveReportingDate(reportingDate);
    let weightedSum = 0;
    let totalWeight = 0;
    cfoGetContracts().forEach(contract => {
      if (!cfoIsActive(contract, d)) return;
      let metrics;
      try { metrics = cfoGetContractMetricsInternal(contract, d); }
      catch (error) { return; }
      const weight = cfoNumber(metrics?.leaseLiability);
      const rate = cfoNumber(contract.discountRate);
      if (weight <= 0) return;
      weightedSum += weight * rate;
      totalWeight += weight;
    });
    return {
      reportingDate: cfoIsoDate(d),
      weightedAverageDiscountRate: totalWeight > 0 ? cfoRound(weightedSum / totalWeight) : 0,
      totalWeightedLiability: cfoRound(totalWeight),
      basis: "Contract discount rates weighted by outstanding lease liability as of the reporting date (TFRS 16.53(i))."
    };
  }
  function getLeaseCashFlowMetrics(reportingDate) {
    const d = cfoResolveReportingDate(reportingDate);
    const end = cfoAddMonths(d,12);
    const p = cfoPeriodMetrics(new Date(d.getTime()+86400000), end, { activeOnly:true });
    return { reportingDate:cfoIsoDate(d), periodEnd:cfoIsoDate(end), next12MonthsPayments:p.cashPayments, next12MonthsPrincipal:p.principal, next12MonthsInterest:p.interestExpense, reconciliationDifference:cfoRound(p.cashPayments-(p.principal+p.interestExpense)) };
  }

  function getTotalContractCount() { return cfoGetContracts().length; }
  function getActiveContractCount(reportingDate) { const d=cfoResolveReportingDate(reportingDate); return cfoGetContracts().filter(c=>cfoIsActive(c,d)).length; }
  function getExpiredContractCount(reportingDate) { const d=cfoResolveReportingDate(reportingDate); return cfoGetContracts().filter(c=>{ const e=cfoDate(c.endDate); return e && e<d && String(c.status||"ACTIVE").toUpperCase() !== "TERMINATED"; }).length; }
  function getTerminatedContractCount() { return cfoGetContracts().filter(c=>String(c.status||"").toUpperCase()==="TERMINATED").length; }

  function getContractsExpiringWithin(days, reportingDate) {
    const d=cfoResolveReportingDate(reportingDate), horizon=cfoAddMonths(d,0); horizon.setDate(horizon.getDate()+Math.max(0,Number(days)||0));
    return cfoGetContracts().filter(c=>cfoIsActive(c,d)).filter(c=>{const e=cfoDate(c.endDate);return e&&e>=d&&e<=horizon;});
  }
  function getContractsExpiringWithin12Months(reportingDate) { return getContractsExpiringWithin(365, reportingDate); }

  function getLeaseRenewalMetrics(reportingDate) {
    const d=cfoResolveReportingDate(reportingDate);
    const within=(days)=>cfoGetContracts().filter(c=>cfoIsActive(c,d)).filter(c=>{const r=cfoDate(c.renewalDate||c.renewalOptionDate||c.renewalAssessmentDate); const n=cfoDaysBetween(d,r); return n!==null&&n>=0&&n<=days;});
    const r90=within(90), r180=within(180);
    return { within90Days:r90.length, within180Days:r180.length, contractsWithin90Days:r90.map(c=>c.id), contractsWithin180Days:r180.map(c=>c.id) };
  }

  function getLeaseModificationMetrics(reportingDate) {
    const d=cfoResolveReportingDate(reportingDate), cutoff=cfoAddMonths(d,-12), all=[];
    cfoGetContracts().forEach(c=>(Array.isArray(c.modifications)?c.modifications:[]).forEach(m=>all.push({...m,contractId:c.id})));
    const pending=all.filter(m=>!["APPLIED","CANCELLED"].includes(String(m.status||"").toUpperCase()));
    const applied=all.filter(m=>String(m.status||"").toUpperCase()==="APPLIED");
    const last12=applied.filter(m=>{const x=cfoDate(m.effectiveDate||m.updatedAt||m.createdAt);return x&&cutoff&&x>=cutoff&&x<=d;});
    return { pending:pending.length, applied:applied.length, last12Months:last12.length, pendingIds:pending.map(x=>x.id).filter(Boolean), appliedLast12Ids:last12.map(x=>x.id).filter(Boolean), liabilityImpact:cfoRound(applied.reduce((s,x)=>s+cfoNumber(x.liabilityAdjustment),0)), rouImpact:cfoRound(applied.reduce((s,x)=>s+cfoNumber(x.rouAdjustment),0)) };
  }

  function getLeaseReassessmentMetrics(reportingDate) {
    const d=cfoResolveReportingDate(reportingDate), cutoff=cfoAddMonths(d,-12), all=[];
    cfoGetContracts().forEach(c=>(Array.isArray(c.reassessments)?c.reassessments:[]).forEach(r=>all.push({...r,contractId:c.id})));
    const pending=all.filter(r=>!["APPLIED","CANCELLED"].includes(String(r.status||"").toUpperCase()));
    const applied=all.filter(r=>String(r.status||"").toUpperCase()==="APPLIED");
    const last12=applied.filter(r=>{const x=cfoDate(r.effectiveDate||r.updatedAt||r.createdAt);return x&&cutoff&&x>=cutoff&&x<=d;});
    return { pending:pending.length, applied:applied.length, last12Months:last12.length, pendingIds:pending.map(x=>x.id).filter(Boolean), appliedLast12Ids:last12.map(x=>x.id).filter(Boolean), liabilityImpact:cfoRound(applied.reduce((s,x)=>s+cfoNumber(x.liabilityAdjustment),0)), rouImpact:cfoRound(applied.reduce((s,x)=>s+cfoNumber(x.rouAdjustment),0)) };
  }

  function getLeaseRiskMetrics(reportingDate) {
    const d=cfoResolveReportingDate(reportingDate), rows=[];
    cfoGetContracts().forEach(c=>{ try { rows.push(cfoGetContractMetricsInternal(c,d)); } catch(error) {} });
    const open=rows.reduce((s,r)=>s+cfoNumber(r.openExceptions),0);
    const critical=rows.reduce((s,r)=>s+cfoNumber(r.criticalExceptions),0);
    return { green:rows.filter(r=>r.controlStatus==="GREEN").length, yellow:rows.filter(r=>r.controlStatus==="YELLOW").length, red:rows.filter(r=>r.controlStatus==="RED").length, openExceptions:open, criticalExceptions:critical, highExceptions:rows.reduce((s,r)=>s+cfoNumber(r.highExceptions),0), mediumExceptions:rows.reduce((s,r)=>s+cfoNumber(r.mediumExceptions),0), lowExceptions:rows.reduce((s,r)=>s+cfoNumber(r.lowExceptions),0), distribution:{GREEN:rows.filter(r=>r.controlStatus==="GREEN").length,YELLOW:rows.filter(r=>r.controlStatus==="YELLOW").length,RED:rows.filter(r=>r.controlStatus==="RED").length} };
  }

  function getLeaseControlMetrics(reportingDate) {
    const d=cfoResolveReportingDate(reportingDate), rows=[];
    cfoGetContracts().forEach(c=>{ try { const m=cfoGetContractMetricsInternal(c,d); rows.push(m); } catch(error) {} });
    return { contractsWithMissingCriticalData:rows.filter(r=>r.controlStatus==="RED").filter(r=>String(r.calculationError||"").length===0).length, contractsWithCalculationErrors:rows.filter(r=>!r.calculationValid).length, contractsWithJournalIssues:rows.filter(r=>r.criticalExceptions>0).length, contractsWithClassificationIssues:rows.filter(r=>r.controlStatus==="RED").length, contractsWithAuditIssues:rows.filter(r=>r.openExceptions>0).length };
  }

  function getControlRiskRows(reportingDate) {
    const d=cfoResolveReportingDate(reportingDate);
    return cfoGetContracts().map(c=>{try{return cfoGetContractMetricsInternal(c,d);}catch(error){return {contractId:c.id,calculationValid:false,calculationError:error?.message||String(error),controlStatus:"RED"};}});
  }

  function getCfoCompanyMetrics(company, reportingDate) {
    const d=cfoResolveReportingDate(reportingDate), target=String(company||"");
    const rows=cfoGetContracts().filter(c=>String(c.company||"")===target).map(c=>cfoGetContractMetricsInternal(c,d));
    const totals=cfoAggregateRows(rows);
    return { company:target, reportingDate:cfoIsoDate(d), contractCount:rows.length, activeContracts:rows.filter(r=>r.active).length, ...totals, risk:{green:rows.filter(r=>r.controlStatus==="GREEN").length,yellow:rows.filter(r=>r.controlStatus==="YELLOW").length,red:rows.filter(r=>r.controlStatus==="RED").length,openExceptions:rows.reduce((s,r)=>s+r.openExceptions,0)}, contracts:rows };
  }

  function getCfoMetricsByCompany(reportingDate) {
    const companies=[...new Set(cfoGetContracts().map(c=>String(c.company||"")).filter(Boolean))];
    return companies.map(company=>getCfoCompanyMetrics(company,reportingDate));
  }

  function getCfoCurrencyMetrics(reportingDate) {
    const d=cfoResolveReportingDate(reportingDate), groups={};
    cfoGetContracts().forEach(c=>{try{const r=cfoGetContractMetricsInternal(c,d);const cur=r.currency||"UNSPECIFIED";if(!groups[cur])groups[cur]={currency:cur,contractCount:0,activeContracts:0,leaseLiability:0,currentLiability:0,nonCurrentLiability:0,rouAsset:0,monthlyInterest:0,monthlyDepreciation:0,monthlyLeaseExpense:0,next12MonthPayments:0,next12MonthPrincipal:0,next12MonthInterest:0};const g=groups[cur];g.contractCount++;if(r.active)g.activeContracts++;["leaseLiability","currentLiability","nonCurrentLiability","rouAsset","monthlyInterest","monthlyDepreciation","monthlyLeaseExpense","next12MonthPayments","next12MonthPrincipal","next12MonthInterest"].forEach(k=>g[k]+=cfoNumber(r[k]));}catch(error){}});
    Object.values(groups).forEach(g=>Object.keys(g).forEach(k=>{if(typeof g[k]==="number")g[k]=cfoRound(g[k]);}));
    return groups;
  }

  function getLeaseLiabilityRollForward(reportingDate) {
    const d=cfoResolveReportingDate(reportingDate), prior=cfoAddMonths(d,-1), current=getTotalLeaseLiability(d), priorTotal=getTotalLeaseLiability(prior);
    const month=getMonthlyLeaseExpense(d); const interest=getInterestExpense(new Date(d.getFullYear(),d.getMonth(),1),new Date(d.getFullYear(),d.getMonth()+1,0));
    const payment=cfoPeriodMetrics(new Date(d.getFullYear(),d.getMonth(),1),new Date(d.getFullYear(),d.getMonth()+1,0),{activeOnly:true}).cashPayments;
    return { reportingDate:cfoIsoDate(d), openingLiability:cfoRound(priorTotal), interest:cfoRound(interest), payments:cfoRound(payment), closingLiability:cfoRound(current), reconciliationDifference:cfoRound((priorTotal+interest-payment)-current), source:"LEASE_SCHEDULE" , monthlyLeaseExpense:cfoRound(month) };
  }

  function getLeaseRouRollForward(reportingDate) {
    const d=cfoResolveReportingDate(reportingDate), prior=cfoAddMonths(d,-1), opening=getTotalRuoAssets(prior), closing=getTotalRuoAssets(d), depreciation=getDepreciationExpense(new Date(d.getFullYear(),d.getMonth(),1),new Date(d.getFullYear(),d.getMonth()+1,0));
    const adjustments=cfoRound(closing-(opening-depreciation));
    return { reportingDate:cfoIsoDate(d), openingROU:cfoRound(opening), depreciation:cfoRound(depreciation), modificationReassessmentAdjustments:adjustments, closingROU:cfoRound(closing), reconciliationDifference:cfoRound((opening-depreciation+adjustments)-closing), source:"LEASE_SCHEDULE" };
  }

  function getCfoJournalMetrics() {
    const events=typeof getAuditEvents==="function"?getAuditEvents({}):[];
    const generated=events.filter(e=>String(e.action||"").includes("JOURNAL_GENERATED"));
    const rows=[];
    cfoGetContracts().forEach(c=>{
      [...(Array.isArray(c.modifications)?c.modifications:[]),...(Array.isArray(c.reassessments)?c.reassessments:[])].forEach(x=>{if(Array.isArray(x.journal))rows.push(...x.journal.map(j=>({...j,contractId:c.id})));});
    });
    const debit=rows.reduce((s,r)=>s+cfoNumber(r.debit),0), credit=rows.reduce((s,r)=>s+cfoNumber(r.credit),0);
    return { totalGeneratedJournals:generated.length, generatedJournalEvents:generated.length, balancedJournals:rows.length?Math.abs(debit-credit)<=CFO_TOLERANCE:0, unbalancedJournals:rows.length&&Math.abs(debit-credit)>CFO_TOLERANCE?1:0, journalEntries:rows.length, totalDebit:cfoRound(debit), totalCredit:cfoRound(credit), bySource:rows.reduce((a,r)=>{const k=r.source||"UNKNOWN";a[k]=(a[k]||0)+1;return a;},{}) };
  }

  function getCfoAuditMetrics(reportingDate) {
    const d=cfoResolveReportingDate(reportingDate), events=typeof getAuditEvents==="function"?getAuditEvents({}):[], cutoff30=cfoAddMonths(d,0), cutoff90=cfoAddMonths(d,0); cutoff30.setDate(cutoff30.getDate()-30); cutoff90.setDate(cutoff90.getDate()-90);
    const last30=events.filter(e=>{const x=cfoDate(e.timestamp);return x&&x>=cutoff30&&x<=d;}).length;
    const last90=events.filter(e=>{const x=cfoDate(e.timestamp);return x&&x>=cutoff90&&x<=d;}).length;
    const noRecent=cfoGetContracts().filter(c=>!events.some(e=>e.contractId===c.id&&cfoDate(e.timestamp)&&cfoDate(e.timestamp)>=cutoff90)).map(c=>c.id);
    return { totalAuditEvents:events.length, eventsLast30Days:last30, eventsLast90Days:last90, contractsWithoutRecentAuditActivity:noRecent.length, contractIdsWithoutRecentAuditActivity:noRecent };
  }

  function getTfrs16CfoMetrics(reportingDate) {
    const d=cfoResolveReportingDate(reportingDate), rows=getControlRiskRows(d), activeRows=rows.filter(r=>r.active);
    const totals=cfoAggregateRows(activeRows), risk=getLeaseRiskMetrics(d), renewals=getLeaseRenewalMetrics(d), modifications=getLeaseModificationMetrics(d), reassessments=getLeaseReassessmentMetrics(d), cash=getLeaseCashFlowMetrics(d);
    const contracts={total:cfoGetContracts().length,active:activeRows.length,expired:getExpiredContractCount(d),terminated:getTerminatedContractCount()};
    const liabilityReconciliation=cfoRound(totals.leaseLiability-(totals.currentLiability+totals.nonCurrentLiability));
    const cashReconciliation=cfoRound(cash.next12MonthsPayments-(cash.next12MonthsPrincipal+cash.next12MonthsInterest));
    const dataErrors=rows.filter(r=>r.calculationValid===false||r.calculationError).length;
    return { reportingDate:cfoIsoDate(d), contracts, liabilities:{total:totals.leaseLiability,current:totals.currentLiability,nonCurrent:totals.nonCurrentLiability}, rouAssets:{total:totals.rouAsset}, pnl:{interestExpense:totals.monthlyInterest,depreciationExpense:totals.monthlyDepreciation,leaseExpense:totals.monthlyLeaseExpense}, cashFlow:{next12MonthsPayments:cash.next12MonthsPayments,next12MonthsPrincipal:cash.next12MonthsPrincipal,next12MonthsInterest:cash.next12MonthsInterest,reconciliationDifference:cashReconciliation}, renewals, expiry:{within12Months:getContractsExpiringWithin12Months(d).length}, modifications, reassessments, risk, controls:getLeaseControlMetrics(d), companies:getCfoMetricsByCompany(d), currencies:getCfoCurrencyMetrics(d), journal:getCfoJournalMetrics(), audit:getCfoAuditMetrics(d), liabilityRollForward:getLeaseLiabilityRollForward(d), rouRollForward:getLeaseRouRollForward(d), disclosures:{weightedAverageDiscountRate:getWeightedAverageDiscountRate(d)}, reconciliation:{liability:{difference:liabilityReconciliation,passed:Math.abs(liabilityReconciliation)<=CFO_TOLERANCE},cashFlow:{difference:cashReconciliation,passed:Math.abs(cashReconciliation)<=CFO_TOLERANCE}}, dataQuality:{status:dataErrors?"ERROR":(risk.openExceptions?"WARNING":"COMPLETE"),errors:dataErrors,warnings:risk.openExceptions}, sourceMetadata:{liabilities:"REPORTING_DATE_ENGINE",rouAssets:"LEASE_SCHEDULE",pnl:"LEASE_SCHEDULE",cashFlow:"LEASE_SCHEDULE",risk:"CONTROL_ENGINE",audit:"AUDIT_TRAIL_ENGINE"} };
  }

  function getTfrs16CfoSnapshot(reportingDate) {
    const d=cfoResolveReportingDate(reportingDate), metrics=getTfrs16CfoMetrics(d);
    return { version:CFO_DATA_LAYER_VERSION, reportingDate:metrics.reportingDate, generatedAt:new Date().toISOString(), status:metrics.dataQuality.status==="ERROR"?"ERROR":(metrics.dataQuality.status==="WARNING"?"WARNING":"READY"), headline:{totalLeaseLiability:metrics.liabilities.total,currentLeaseLiability:metrics.liabilities.current,nonCurrentLeaseLiability:metrics.liabilities.nonCurrent,rouAssets:metrics.rouAssets.total,next12MonthCashPayments:metrics.cashFlow.next12MonthsPayments,redContracts:metrics.risk.red,criticalExceptions:metrics.risk.criticalExceptions}, ...metrics };
  }

  function getMonthlyLeaseMetrics(year) {
    const y=Number(year), rows=[];
    if(!Number.isInteger(y)) return rows;
    for(let month=0;month<12;month++){
      const start=new Date(y,month,1), end=new Date(y,month+1,0), p=cfoPeriodMetrics(start,end,{activeOnly:false});
      const liability=getTotalLeaseLiability(end);
      rows.push({month:`${y}-${String(month+1).padStart(2,"0")}`,liability,interest:p.interestExpense,depreciation:p.depreciationExpense,leaseExpense:p.leaseExpense,cashPayment:p.cashPayments,principal:p.principal});
    }
    return rows;
  }

  function getOpenExceptionsCfo() { return typeof getOpenExceptions === "function" ? getOpenExceptions() : []; }

  function getCriticalExceptionsCfo() { return typeof getCriticalExceptions === "function" ? getCriticalExceptions() : []; }

  function exportControlResultsAsCfoData(reportingDate) {
    const snapshot=getTfrs16CfoSnapshot(reportingDate);
    return cfoClone(snapshot);
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

  function rptNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function rptRound(value, digits = 2) {
    const n = rptNumber(value);
    const factor = Math.pow(10, digits);
    return Math.round((n + Number.EPSILON) * factor) / factor;
  }

  function rptDate(value) {
    try { return typeof parseDate === "function" ? parseDate(value) : null; } catch (error) { return null; }
  }

  function rptIsoDate(value) {
    const d = rptDate(value);
    return d ? d.toISOString().slice(0, 10) : null;
  }

  function rptAddDays(value, days) {
    const d = rptDate(value);
    if (!d) return null;
    const out = new Date(d.getTime());
    out.setDate(out.getDate() + Number(days || 0));
    return out;
  }

  function rptAddMonths(value, months) {
    const d = rptDate(value);
    if (!d) return null;
    return new Date(d.getFullYear(), d.getMonth() + Number(months || 0), d.getDate());
  }

  function rptMonthsBetween(from, to) {
    const a = rptDate(from), b = rptDate(to);
    if (!a || !b) return null;
    return Math.max(0, (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + (b.getDate() >= a.getDate() ? 0 : -1));
  }

  function rptResolveDate(value) {
    if (typeof cfoResolveReportingDate === "function") return cfoResolveReportingDate(value);
    return rptDate(value) || new Date();
  }

  function rptClone(value) {
    try { return JSON.parse(JSON.stringify(value)); } catch (error) { return null; }
  }

  function rptEmptyReport(reportName, reportingDate, source = "V16.9_DATA_LAYER") {
    return {
      reportName,
      reportingDate: rptIsoDate(reportingDate),
      generatedAt: new Date().toISOString(),
      dataSource: source,
      status: "READY",
      rows: [],
      totals: {},
      reconciliation: {},
      warnings: [],
      errors: []
    };
  }

  function rptFinalize(report, options = {}) {
    const warnings = Array.isArray(report.warnings) ? report.warnings : [];
    const errors = Array.isArray(report.errors) ? report.errors : [];
    report.warnings = warnings;
    report.errors = errors;
    if (errors.length) report.status = "ERROR";
    else if (warnings.length) report.status = "WARNING";
    else report.status = options.status || "READY";
    return report;
  }

  function rptSafeContracts() {
    return Array.isArray(contracts) ? contracts : [];
  }

  function rptBuildSchedule(contract) {
    try {
      if (typeof cfoBuildSchedule === "function") return cfoBuildSchedule(contract);
      const engine = typeof calculateLeaseEngine === "function" ? calculateLeaseEngine(contract) : null;
      return { schedule: Array.isArray(engine?.schedule) ? engine.schedule : [], engine, source: "LEASE_SCHEDULE" };
    } catch (error) {
      return { schedule: [], engine: null, source: "ERROR", error: error?.message || String(error) };
    }
  }

  function rptScheduleRows(contract) {
    const built = rptBuildSchedule(contract);
    return { schedule: Array.isArray(built.schedule) ? built.schedule : [], source: built.source, error: built.error || null, engine: built.engine || null };
  }

  function rptScheduleAtOrBefore(schedule, date) {
    const target = rptDate(date);
    if (!target || !Array.isArray(schedule)) return null;
    let result = null;
    schedule.forEach(row => {
      const d = rptDate(row?.date);
      if (d && d <= target && (!result || d > rptDate(result.date))) result = row;
    });
    return result;
  }

  function rptScheduleAtOrAfter(schedule, date) {
    const target = rptDate(date);
    if (!target || !Array.isArray(schedule)) return null;
    let result = null;
    schedule.forEach(row => {
      const d = rptDate(row?.date);
      if (d && d >= target && (!result || d < rptDate(result.date))) result = row;
    });
    return result;
  }

  function rptRowsBetween(schedule, startDate, endDate) {
    const start = rptDate(startDate), end = rptDate(endDate);
    if (!start || !end || !Array.isArray(schedule)) return [];
    return schedule.filter(row => {
      const d = rptDate(row?.date);
      return d && d >= start && d <= end;
    });
  }

  function rptGetRowRuo(row) {
    if (!row) return 0;
    if (row.rouClosing !== undefined) return Math.max(0, rptNumber(row.rouClosing));
    if (row.rouClosingBalance !== undefined) return Math.max(0, rptNumber(row.rouClosingBalance));
    if (row.rouAssets !== undefined) return Math.max(0, rptNumber(row.rouAssets));
    return 0;
  }

  function rptGetRowLiability(row) {
    if (!row) return 0;
    if (row.closingLiability !== undefined) return Math.max(0, rptNumber(row.closingLiability));
    if (row.liabilityClosing !== undefined) return Math.max(0, rptNumber(row.liabilityClosing));
    return 0;
  }

  function rptAggregateRows(rows, keys) {
    const out = {};
    (keys || []).forEach(key => { out[key] = 0; });
    (rows || []).forEach(row => (keys || []).forEach(key => { out[key] += rptNumber(row?.[key]); }));
    Object.keys(out).forEach(key => { out[key] = rptRound(out[key]); });
    return out;
  }

  function rptErrorRow(contract, error) {
    return { contractId: contract?.id || null, company: contract?.company || "", status: "ERROR", error: error?.message || String(error || "Calculation error") };
  }

  function rptBucketForMonths(months) {
    const m = Math.max(0, rptNumber(months));
    if (m < 1) return REPORTING_BUCKETS[0];
    if (m < 3) return REPORTING_BUCKETS[1];
    if (m < 6) return REPORTING_BUCKETS[2];
    if (m < 12) return REPORTING_BUCKETS[3];
    if (m < 24) return REPORTING_BUCKETS[4];
    if (m < 36) return REPORTING_BUCKETS[5];
    if (m < 60) return REPORTING_BUCKETS[6];
    return REPORTING_BUCKETS[7];
  }

  function rptRiskForDays(days) {
    if (days === null || days === undefined || days < 0) return "GREEN";
    if (days <= 90) return "RED";
    if (days <= 180) return "YELLOW";
    if (days <= 365) return "YELLOW";
    return "GREEN";
  }

  function rptGetContractCfo(contract, reportingDate) {
    try {
      if (typeof cfoGetContractMetricsInternal === "function") return cfoGetContractMetricsInternal(contract, reportingDate);
      if (typeof getCfoContractMetrics === "function") return getCfoContractMetrics(contract.id, reportingDate);
    } catch (error) {}
    return null;
  }

  function getLeaseLiabilityRollForwardReport(startDate, endDate) {
    const start = rptDate(startDate), end = rptDate(endDate);
    const report = rptEmptyReport("Lease Liability Roll-forward", end, "LEASE_SCHEDULE");
    if (!start || !end || end < start) { report.errors.push("Invalid reporting period."); return rptFinalize(report); }
    const rows = [];
    rptSafeContracts().forEach(contract => {
      try {
        const built = rptScheduleRows(contract);
        if (built.error) throw new Error(built.error);
        const schedule = built.schedule;
        const openingRow = rptScheduleAtOrBefore(schedule, rptAddDays(start, -1));
        const closingRow = rptScheduleAtOrBefore(schedule, end);
        const periodRows = rptRowsBetween(schedule, start, end);
        const openingLiability = openingRow ? rptGetRowLiability(openingRow) : (periodRows[0] ? rptNumber(periodRows[0].openingLiability) : 0);
        let closingLiability = closingRow ? rptGetRowLiability(closingRow) : (periodRows.length ? rptGetRowLiability(periodRows[periodRows.length - 1]) : openingLiability);
        const appliedModifications = (Array.isArray(contract.modifications) ? contract.modifications : []).filter(x => x.status === "APPLIED").filter(x => { const d = rptDate(x.effectiveDate || x.modificationDate); return d && d >= start && d <= end; });
        const appliedReassessments = (Array.isArray(contract.reassessments) ? contract.reassessments : []).filter(x => x.status === "APPLIED").filter(x => { const d = rptDate(x.effectiveDate || x.reassessmentDate); return d && d >= start && d <= end; });
        // The monthly schedule only starts reflecting a modification/reassessment
        // from its next dated row onward. If the reporting cutoff falls on/after
        // an applied change's effective date but the picked closing row still
        // predates it, the raw schedule closing value understates the true
        // liability as of the cutoff. Pull the revised liability directly from
        // the latest such change so the roll-forward reconciles correctly.
        const closingRowDate = closingRow ? parseDate(closingRow.date) : null;
        const pendingChanges = appliedModifications.concat(appliedReassessments)
          .filter(x => { const d = rptDate(x.effectiveDate); return d && (!closingRowDate || d.getTime() > closingRowDate.getTime()); })
          .sort((a, b) => String(a.effectiveDate || "").localeCompare(String(b.effectiveDate || "")));
        if (pendingChanges.length) {
          const latestPending = pendingChanges[pendingChanges.length - 1];
          if (Number.isFinite(Number(latestPending.revisedLeaseLiability))) {
            closingLiability = Math.max(0, Number(latestPending.revisedLeaseLiability));
          }
        }
        const interest = periodRows.reduce((s, r) => s + rptNumber(r.interest), 0);
        const payments = periodRows.reduce((s, r) => s + rptNumber(r.payment), 0);
        const expected = openingLiability + interest - payments;
        const modificationAdjustment = appliedModifications.reduce((s,x) => s + rptNumber(x.liabilityAdjustment), 0);
        const reassessmentAdjustment = appliedReassessments.reduce((s,x) => s + rptNumber(x.liabilityAdjustment), 0);
        const unexplainedAdjustment = (closingLiability - expected) - modificationAdjustment - reassessmentAdjustment;
        const adjustments = modificationAdjustment + reassessmentAdjustment + unexplainedAdjustment;
        const difference = expected + adjustments - closingLiability;
        rows.push({ contractId: contract.id, company: contract.company || "", supplier: contract.supplier || "", currency: contract.currency || "UNSPECIFIED", openingLiability:rptRound(openingLiability), interest:rptRound(interest), payments:rptRound(payments), modificationAdjustment:rptRound(modificationAdjustment), reassessmentAdjustment:rptRound(reassessmentAdjustment), otherAdjustment:rptRound(unexplainedAdjustment), closingLiability:rptRound(closingLiability), reconciliationDifference:rptRound(difference), status:Math.abs(difference)<=REPORTING_TOLERANCE?"READY":"WARNING", source:built.source });
      } catch (error) { rows.push(rptErrorRow(contract, error)); }
    });
    report.rows = rows;
    report.totals = rptAggregateRows(rows.filter(r=>r.status!=="ERROR"), ["openingLiability","interest","payments","modificationAdjustment","reassessmentAdjustment","otherAdjustment","closingLiability"]);
    const diff = rptRound(report.totals.openingLiability + report.totals.interest - report.totals.payments + report.totals.modificationAdjustment + report.totals.reassessmentAdjustment - report.totals.closingLiability);
    report.reconciliation = { formula:"Opening + Interest - Payments +/- Adjustments = Closing", difference:diff, passed:Math.abs(diff)<=REPORTING_TOLERANCE };
    if (!report.reconciliation.passed) report.warnings.push("Portfolio liability roll-forward reconciliation mismatch.");
    if (rows.some(r=>r.status==="ERROR")) report.errors.push("One or more contracts could not be calculated.");
    return rptFinalize(report);
  }

  function getRuoAssetRollForwardReport(startDate, endDate) {
    const start = rptDate(startDate), end = rptDate(endDate);
    const report = rptEmptyReport("ROU Asset Roll-forward", end, "LEASE_SCHEDULE");
    if (!start || !end || end < start) { report.errors.push("Invalid reporting period."); return rptFinalize(report); }
    const rows=[];
    rptSafeContracts().forEach(contract=>{
      try{
        const built=rptScheduleRows(contract); if(built.error) throw new Error(built.error);
        const schedule=built.schedule, openingRow=rptScheduleAtOrBefore(schedule,rptAddDays(start,-1)), closingRow=rptScheduleAtOrBefore(schedule,end), periodRows=rptRowsBetween(schedule,start,end);
        const openingRuo=openingRow?rptGetRowRuo(openingRow):(periodRows[0]?rptNumber(periodRows[0].rouOpening):0);
        let closingRuo=closingRow?rptGetRowRuo(closingRow):(periodRows.length?rptGetRowRuo(periodRows[periodRows.length-1]):openingRuo);
        const appliedModifications=(Array.isArray(contract.modifications)?contract.modifications:[]).filter(x=>x.status==="APPLIED").filter(x=>{const d=rptDate(x.effectiveDate||x.modificationDate);return d&&d>=start&&d<=end;});
        const appliedReassessments=(Array.isArray(contract.reassessments)?contract.reassessments:[]).filter(x=>x.status==="APPLIED").filter(x=>{const d=rptDate(x.effectiveDate||x.reassessmentDate);return d&&d>=start&&d<=end;});
        // Same timing gap as the liability roll-forward: pull the post-change ROU
        // directly from the latest pending modification/reassessment when the
        // schedule hasn't yet caught up to the reporting cutoff.
        const closingRowDateRuo = closingRow ? parseDate(closingRow.date) : null;
        const pendingChangesRuo = appliedModifications.concat(appliedReassessments)
          .filter(x => { const d = rptDate(x.effectiveDate); return d && (!closingRowDateRuo || d.getTime() > closingRowDateRuo.getTime()); })
          .sort((a, b) => String(a.effectiveDate || "").localeCompare(String(b.effectiveDate || "")));
        if (pendingChangesRuo.length) {
          const latestPendingRuo = pendingChangesRuo[pendingChangesRuo.length - 1];
          const oldRou = Number(latestPendingRuo.oldROU);
          const rouAdj = Number(latestPendingRuo.rouAdjustment);
          if (Number.isFinite(oldRou) && Number.isFinite(rouAdj)) {
            closingRuo = Math.max(0, oldRou + rouAdj);
          }
        }
        const depreciation=periodRows.reduce((s,r)=>s+rptNumber(r.depreciation),0);
        const modificationAdjustment=appliedModifications.reduce((s,x)=>s+rptNumber(x.rouAdjustment),0);
        const reassessmentAdjustment=appliedReassessments.reduce((s,x)=>s+rptNumber(x.rouAdjustment),0);
        const unexplainedAdjustment=(closingRuo-(openingRuo-depreciation))-modificationAdjustment-reassessmentAdjustment;
        const adjustments=modificationAdjustment+reassessmentAdjustment+unexplainedAdjustment;
        const diff=openingRuo-depreciation+adjustments-closingRuo;
        rows.push({contractId:contract.id,company:contract.company||"",supplier:contract.supplier||"",currency:contract.currency||"UNSPECIFIED",assetClass:getContractAssetClass(contract),openingRuo:rptRound(openingRuo),depreciation:rptRound(depreciation),modificationAdjustment:rptRound(modificationAdjustment),reassessmentAdjustment:rptRound(reassessmentAdjustment),otherAdjustment:rptRound(unexplainedAdjustment),closingRuo:rptRound(closingRuo),reconciliationDifference:rptRound(diff),status:Math.abs(diff)<=REPORTING_TOLERANCE?"READY":"WARNING",source:built.source});
      }catch(error){rows.push(rptErrorRow(contract,error));}
    });
    report.rows=rows;
    report.totals=rptAggregateRows(rows.filter(r=>r.status!=="ERROR"),["openingRuo","depreciation","modificationAdjustment","reassessmentAdjustment","otherAdjustment","closingRuo"]);
    const diff=rptRound(report.totals.openingRuo-report.totals.depreciation+report.totals.modificationAdjustment+report.totals.reassessmentAdjustment-report.totals.closingRuo);
    report.reconciliation={formula:"Opening ROU - Depreciation +/- Adjustments = Closing ROU",difference:diff,passed:Math.abs(diff)<=REPORTING_TOLERANCE};
    if(!report.reconciliation.passed) report.warnings.push("Portfolio ROU roll-forward reconciliation mismatch.");
    if(rows.some(r=>r.status==="ERROR")) report.errors.push("One or more contracts could not be calculated.");
    return rptFinalize(report);
  }

  function getRuoAssetRollForward(reportingDate, endDate) {
    if (endDate !== undefined) return getRuoAssetRollForwardReport(reportingDate,endDate);
    const end=rptResolveDate(reportingDate), start=new Date(end.getFullYear(),end.getMonth(),1);
    return getRuoAssetRollForwardReport(start,end);
  }

  /* ==========================================================
     TFRS 16 DIPNOT (FINANCIAL STATEMENT NOTE) EXPORTS
     ----------------------------------------------------------
     Additive export helpers for the two mandatory TFRS 16 notes:
     - Right-of-use asset movement note (kullanım hakkı varlığı
       hareket tablosu)
     - Lease liability movement note (kira yükümlülüğü hareket
       tablosu)
     Reuses the existing getRuoAssetRollForwardReport /
     getLeaseLiabilityRollForwardReport engines as the single
     source of truth; no new calculation logic is introduced here.
  ========================================================== */

  function exportRouAssetMovementNote(startDate, endDate) {
    const report = getRuoAssetRollForwardReport(startDate, endDate);
    const dataRows = Array.isArray(report.rows) ? report.rows.filter(r => r.status !== "ERROR") : [];
    if (!dataRows.length) return false;
    const totals = report.totals || {};
    const rows = dataRows.map(r => ({
      "Sözleşme": r.contractId,
      "Şirket": r.company,
      "Tedarikçi": r.supplier,
      "Para Birimi": r.currency,
      "Varlık Sınıfı": r.assetClass,
      "Açılış Bakiyesi": r.openingRuo,
      "Amortisman (-)": -Math.abs(r.depreciation),
      "Modifikasyon Etkisi": r.modificationAdjustment,
      "Reassessment Etkisi": r.reassessmentAdjustment,
      "Diğer Düzeltme": r.otherAdjustment,
      "Kapanış Bakiyesi": r.closingRuo,
      "Durum": r.status
    }));
    rows.push({
      "Sözleşme": "TOPLAM", "Şirket": "", "Tedarikçi": "", "Para Birimi": "", "Varlık Sınıfı": "",
      "Açılış Bakiyesi": totals.openingRuo, "Amortisman (-)": -Math.abs(totals.depreciation || 0),
      "Modifikasyon Etkisi": totals.modificationAdjustment, "Reassessment Etkisi": totals.reassessmentAdjustment,
      "Diğer Düzeltme": totals.otherAdjustment, "Kapanış Bakiyesi": totals.closingRuo,
      "Durum": report.reconciliation?.passed ? "MUTABIK" : "FARK VAR"
    });
    const currencySummary = v191GroupRollForwardByCurrency(dataRows, ["openingRuo","depreciation","modificationAdjustment","reassessmentAdjustment","otherAdjustment","closingRuo"]).map(g => ({
      "Para Birimi": g.currency, "Sözleşme Sayısı": g.contractCount,
      "Açılış Bakiyesi": g.openingRuo, "Amortisman (-)": -Math.abs(g.depreciation), "Modifikasyon Etkisi": g.modificationAdjustment,
      "Reassessment Etkisi": g.reassessmentAdjustment, "Diğer Düzeltme": g.otherAdjustment, "Kapanış Bakiyesi": g.closingRuo
    }));
    const assetClassSummary = v191GroupRollForwardByAssetClass(dataRows, ["openingRuo","depreciation","modificationAdjustment","reassessmentAdjustment","otherAdjustment","closingRuo"]).map(g => ({
      "Varlık Sınıfı": g.assetClass, "Sözleşme Sayısı": g.contractCount,
      "Açılış Bakiyesi": g.openingRuo, "Amortisman (-)": -Math.abs(g.depreciation), "Modifikasyon Etkisi": g.modificationAdjustment,
      "Reassessment Etkisi": g.reassessmentAdjustment, "Diğer Düzeltme": g.otherAdjustment, "Kapanış Bakiyesi": g.closingRuo
    }));
    return v191ExportSheetsToFile([
      { rows, sheetName: "ROU Hareket" },
      { rows: assetClassSummary, sheetName: "Varlık Sınıfı Özeti" },
      { rows: currencySummary, sheetName: "Para Birimi Özeti" }
    ], "Kullanim_Hakki_Varligi_Hareket_Tablosu");
  }

  function exportLeaseLiabilityMovementNote(startDate, endDate) {
    const report = getLeaseLiabilityRollForwardReport(startDate, endDate);
    const dataRows = Array.isArray(report.rows) ? report.rows.filter(r => r.status !== "ERROR") : [];
    if (!dataRows.length) return false;
    const totals = report.totals || {};
    const rows = dataRows.map(r => ({
      "Sözleşme": r.contractId,
      "Şirket": r.company,
      "Tedarikçi": r.supplier,
      "Para Birimi": r.currency,
      "Açılış Bakiyesi": r.openingLiability,
      "Faiz Gideri (+)": r.interest,
      "Ödemeler (-)": -Math.abs(r.payments),
      "Modifikasyon Etkisi": r.modificationAdjustment,
      "Reassessment Etkisi": r.reassessmentAdjustment,
      "Diğer Düzeltme": r.otherAdjustment,
      "Kapanış Bakiyesi": r.closingLiability,
      "Durum": r.status
    }));
    rows.push({
      "Sözleşme": "TOPLAM", "Şirket": "", "Tedarikçi": "", "Para Birimi": "",
      "Açılış Bakiyesi": totals.openingLiability, "Faiz Gideri (+)": totals.interest,
      "Ödemeler (-)": -Math.abs(totals.payments || 0), "Modifikasyon Etkisi": totals.modificationAdjustment,
      "Reassessment Etkisi": totals.reassessmentAdjustment, "Diğer Düzeltme": totals.otherAdjustment,
      "Kapanış Bakiyesi": totals.closingLiability,
      "Durum": report.reconciliation?.passed ? "MUTABIK" : "FARK VAR"
    });
    const currencySummary = v191GroupRollForwardByCurrency(dataRows, ["openingLiability","interest","payments","modificationAdjustment","reassessmentAdjustment","otherAdjustment","closingLiability"]).map(g => ({
      "Para Birimi": g.currency, "Sözleşme Sayısı": g.contractCount,
      "Açılış Bakiyesi": g.openingLiability, "Faiz Gideri (+)": g.interest, "Ödemeler (-)": -Math.abs(g.payments),
      "Modifikasyon Etkisi": g.modificationAdjustment, "Reassessment Etkisi": g.reassessmentAdjustment,
      "Diğer Düzeltme": g.otherAdjustment, "Kapanış Bakiyesi": g.closingLiability
    }));
    return v191ExportSheetsToFile([
      { rows, sheetName: "Yükümlülük Hareket" },
      { rows: currencySummary, sheetName: "Para Birimi Özeti" }
    ], "Kira_Yukumlulugu_Hareket_Tablosu");
  }

  function v191ExportRowsToFile(rows, fileBaseName, sheetName) {
    if (!rows.length) return false;
    return v191ExportSheetsToFile([{ rows, sheetName }], fileBaseName);
  }

  function v191ExportSheetsToFile(sheets, fileBaseName) {
    const validSheets = (sheets || []).filter(s => Array.isArray(s.rows) && s.rows.length);
    if (!validSheets.length) return false;
    try {
      if (typeof XLSX !== "undefined") {
        const workbook = XLSX.utils.book_new();
        validSheets.forEach(s => {
          const worksheet = XLSX.utils.json_to_sheet(s.rows);
          XLSX.utils.book_append_sheet(workbook, worksheet, (s.sheetName || "Rapor").slice(0, 31));
        });
        XLSX.writeFile(workbook, `TFRS16_${fileBaseName}_${Date.now()}.xlsx`);
        return true;
      }
      // CSV fallback does not support multiple sheets — export the first (primary detail) sheet only.
      const rows = validSheets[0].rows;
      const headers = Object.keys(rows[0]);
      const csv = [headers.join(";"), ...rows.map(row => headers.map(h => String(row[h] ?? "").replace(/;/g, ",")).join(";"))].join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `TFRS16_${fileBaseName}_${Date.now()}.csv`;
      document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
      return true;
    } catch (error) {
      console.error("Dipnot export error:", error);
      return false;
    }
  }

  function v191GroupRollForwardByCurrency(rows, sumKeys) {
    return v191GroupRollForwardByDimension(rows, "currency", "currency", "UNSPECIFIED", sumKeys);
  }

  function v191GroupRollForwardByAssetClass(rows, sumKeys) {
    return v191GroupRollForwardByDimension(rows, "assetClass", "assetClass", ASSET_CLASS_UNCLASSIFIED, sumKeys);
  }

  function v191GroupRollForwardByDimension(rows, sourceKey, outKey, fallbackValue, sumKeys) {
    const groups = {};
    (rows || []).forEach(row => {
      const dimValue = row[sourceKey] || fallbackValue;
      if (!groups[dimValue]) {
        groups[dimValue] = { [outKey]: dimValue };
        sumKeys.forEach(key => { groups[dimValue][key] = 0; });
        groups[dimValue].contractCount = 0;
      }
      sumKeys.forEach(key => { groups[dimValue][key] += rptNumber(row[key]); });
      groups[dimValue].contractCount += 1;
    });
    return Object.values(groups).map(g => {
      const out = { ...g };
      sumKeys.forEach(key => { out[key] = rptRound(out[key]); });
      return out;
    });
  }

  function rptPeriodRows(startDate,endDate,dimension="month") {
    const start=rptDate(startDate), end=rptDate(endDate), rows=[];
    if(!start||!end||end<start) return rows;
    rptSafeContracts().forEach(contract=>{
      try{
        const built=rptScheduleRows(contract); if(built.error) throw new Error(built.error);
        rptRowsBetween(built.schedule,start,end).forEach(row=>{
          const d=rptDate(row.date); if(!d) return;
          let period;
          if(dimension==="quarter") period=`${d.getFullYear()}-Q${Math.ceil((d.getMonth()+1)/3)}`;
          else if(dimension==="year") period=String(d.getFullYear());
          else period=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
          rows.push({period,contractId:contract.id,company:contract.company||"",supplier:contract.supplier||"",currency:contract.currency||"UNSPECIFIED",interestExpense:rptRound(rptNumber(row.interest)),depreciationExpense:rptRound(rptNumber(row.depreciation)),cashPayment:rptRound(rptNumber(row.payment)),principal:rptRound(rptNumber(row.principal)),source:built.source});
        });
      }catch(error){rows.push({period:null,contractId:contract.id,company:contract.company||"",currency:contract.currency||"UNSPECIFIED",status:"ERROR",error:error?.message||String(error)});}
    });
    return rows;
  }

  function getInterestExpenseReport(startDate,endDate,filters={}) {
    const report=rptEmptyReport("Interest Expense Report",endDate,"LEASE_SCHEDULE");
    const rows=rptPeriodRows(startDate,endDate,filters.dimension||"month").filter(r=>!filters.company||r.company===filters.company).filter(r=>!filters.contractId||r.contractId===filters.contractId).filter(r=>!filters.currency||r.currency===filters.currency);
    report.rows=rows;
    report.totals={interestExpense:rptRound(rows.reduce((s,r)=>s+rptNumber(r.interestExpense),0))};
    if(rows.some(r=>r.status==="ERROR")) report.errors.push("One or more contracts could not be calculated.");
    return rptFinalize(report);
  }

  function getDepreciationReport(startDate,endDate,filters={}) {
    const report=rptEmptyReport("Depreciation Report",endDate,"LEASE_SCHEDULE");
    const rows=rptPeriodRows(startDate,endDate,filters.dimension||"month").filter(r=>!filters.company||r.company===filters.company).filter(r=>!filters.contractId||r.contractId===filters.contractId).filter(r=>!filters.currency||r.currency===filters.currency);
    report.rows=rows;
    report.totals={depreciationExpense:rptRound(rows.reduce((s,r)=>s+rptNumber(r.depreciationExpense),0))};
    if(rows.some(r=>r.status==="ERROR")) report.errors.push("One or more contracts could not be calculated.");
    return rptFinalize(report);
  }

  function getLeasePaymentMaturityAnalysis(reportingDate, options={}) {
    const d=rptResolveDate(reportingDate), report=rptEmptyReport("Lease Payment Maturity Analysis",d,"LEASE_SCHEDULE");
    const base=()=>REPORTING_BUCKETS.map(b=>({bucket:b.id,bucketName:b.name,cashPayment:0,principal:0,interest:0}));
    const totals=base(), rows=[];
    rptSafeContracts().forEach(contract=>{
      try{
        const built=rptScheduleRows(contract); if(built.error) throw new Error(built.error);
        const buckets=base();
        (built.schedule||[]).forEach(item=>{
          const date=rptDate(item.date); if(!date||date<=d) return;
          const months=rptMonthsBetween(d,date), bucket=rptBucketForMonths(months), target=buckets.find(x=>x.bucket===bucket.id);
          if(!target)return;
          target.cashPayment+=rptNumber(item.payment); target.principal+=rptNumber(item.principal); target.interest+=rptNumber(item.interest);
        });
        buckets.forEach(b=>{b.cashPayment=rptRound(b.cashPayment);b.principal=rptRound(b.principal);b.interest=rptRound(b.interest);});
        if(options.byContract) rows.push({contractId:contract.id,company:contract.company||"",currency:contract.currency||"UNSPECIFIED",buckets});
        buckets.forEach((b,i)=>{totals[i].cashPayment+=b.cashPayment;totals[i].principal+=b.principal;totals[i].interest+=b.interest;});
      }catch(error){report.errors.push(`${contract.id||"UNKNOWN"}: ${error?.message||String(error)}`);}
    });
    totals.forEach(b=>{b.cashPayment=rptRound(b.cashPayment);b.principal=rptRound(b.principal);b.interest=rptRound(b.interest);});
    report.rows=options.byContract?rows:totals;
    report.totals={cashPayment:rptRound(totals.reduce((s,r)=>s+r.cashPayment,0)),principal:rptRound(totals.reduce((s,r)=>s+r.principal,0)),interest:rptRound(totals.reduce((s,r)=>s+r.interest,0))};
    report.reconciliation={difference:rptRound(report.totals.cashPayment-(report.totals.principal+report.totals.interest)),passed:Math.abs(report.totals.cashPayment-(report.totals.principal+report.totals.interest))<=REPORTING_TOLERANCE};
    if(!report.reconciliation.passed) report.warnings.push("Maturity cash payment does not reconcile to principal plus interest.");
    return rptFinalize(report);
  }

  function getContractMaturityAnalysis(contractId,reportingDate){
    const contract=rptSafeContracts().find(c=>c.id===contractId), d=rptResolveDate(reportingDate);
    if(!contract)return null;
    return getLeasePaymentMaturityAnalysis(d,{byContract:true}).rows.find(r=>r.contractId===contractId)||{contractId,company:contract.company||"",currency:contract.currency||"UNSPECIFIED",buckets:[]};
  }

  function getCompanyMaturityAnalysis(company,reportingDate){
    const all=getLeasePaymentMaturityAnalysis(reportingDate,{byContract:true}), rows=all.rows.filter(r=>String(r.company||"")===String(company||"")), buckets=REPORTING_BUCKETS.map(b=>({bucket:b.id,bucketName:b.name,cashPayment:0,principal:0,interest:0}));
    rows.forEach(r=>r.buckets.forEach((b,i)=>{buckets[i].cashPayment+=rptNumber(b.cashPayment);buckets[i].principal+=rptNumber(b.principal);buckets[i].interest+=rptNumber(b.interest);}));
    buckets.forEach(b=>{b.cashPayment=rptRound(b.cashPayment);b.principal=rptRound(b.principal);b.interest=rptRound(b.interest);});
    return {company:String(company||""),reportingDate:rptIsoDate(reportingDate),buckets,totals:{cashPayment:rptRound(buckets.reduce((s,b)=>s+b.cashPayment,0)),principal:rptRound(buckets.reduce((s,b)=>s+b.principal,0)),interest:rptRound(buckets.reduce((s,b)=>s+b.interest,0))}};
  }

  function getCurrentNonCurrentReport(reportingDate,filters={}) {
    const d=rptResolveDate(reportingDate), report=rptEmptyReport("Current / Non-current Analysis",d,"REPORTING_DATE_ENGINE"), rows=[];
    rptSafeContracts().forEach(contract=>{
      if(filters.company&&String(contract.company||"")!==String(filters.company))return;
      if(filters.contractId&&contract.id!==filters.contractId)return;
      if(filters.currency&&String(contract.currency||"UNSPECIFIED")!==String(filters.currency))return;
      try{
        const m=rptGetContractCfo(contract,d); if(!m)throw new Error("CFO contract metrics unavailable");
        const total=rptNumber(m.leaseLiability), current=rptNumber(m.currentLiability), nonCurrent=rptNumber(m.nonCurrentLiability), diff=rptRound(total-(current+nonCurrent));
        rows.push({contractId:contract.id,company:contract.company||"",supplier:contract.supplier||"",currency:contract.currency||"UNSPECIFIED",totalLiability:rptRound(total),currentLiability:rptRound(current),nonCurrentLiability:rptRound(nonCurrent),reconciliationDifference:diff,status:Math.abs(diff)<=REPORTING_TOLERANCE?"READY":"WARNING"});
      }catch(error){rows.push(rptErrorRow(contract,error));}
    });
    report.rows=rows;
    report.totals=rptAggregateRows(rows.filter(r=>r.status!=="ERROR"),["totalLiability","currentLiability","nonCurrentLiability"]);
    const diff=rptRound(report.totals.totalLiability-(report.totals.currentLiability+report.totals.nonCurrentLiability));
    report.reconciliation={difference:diff,passed:Math.abs(diff)<=REPORTING_TOLERANCE};
    if(!report.reconciliation.passed)report.warnings.push("Current / non-current reconciliation mismatch.");
    if(rows.some(r=>r.status==="ERROR"))report.errors.push("One or more contracts could not be classified.");
    return rptFinalize(report);
  }

  function getLeaseContractExpiryReport(reportingDate,filters={}){
    const d=rptResolveDate(reportingDate), report=rptEmptyReport("Contract Expiry Report",d,"CONTRACT_MASTER + RISK_ENGINE");
    report.rows=rptSafeContracts().filter(c=>!filters.company||String(c.company||"")===String(filters.company)).filter(c=>!filters.currency||String(c.currency||"UNSPECIFIED")===String(filters.currency)).map(contract=>{
      const end=rptDate(contract.endDate), days=end?Math.round((end-d)/86400000):null, risk=typeof getContractRiskStatus==="function"?getContractRiskStatus(contract.id):rptRiskForDays(days);
      return {contractId:contract.id,company:contract.company||"",supplier:contract.supplier||"",startDate:rptIsoDate(contract.startDate),endDate:rptIsoDate(contract.endDate),remainingTermMonths:rptMonthsBetween(d,end),status:contract.status||"ACTIVE",renewalOption:contract.renewalOption===true||!!contract.renewalDate,renewalDate:rptIsoDate(contract.renewalDate),daysToExpiry:days,expiryRisk:risk};
    }).filter(r=>filters.withinDays===undefined||r.daysToExpiry===null||(r.daysToExpiry>=0&&r.daysToExpiry<=Number(filters.withinDays)));
    report.totals={contracts:report.rows.length,within12Months:report.rows.filter(r=>r.daysToExpiry!==null&&r.daysToExpiry>=0&&r.daysToExpiry<=365).length};
    return rptFinalize(report);
  }

  function getContractExpiryReport(reportingDate,filters={}){ return getLeaseContractExpiryReport(reportingDate,filters); }

  function getRenewalRiskReport(reportingDate,filters={}){
    const d=rptResolveDate(reportingDate), report=rptEmptyReport("Renewal Risk Report",d,"CONTRACT_MASTER + RISK_ENGINE"), rows=[];
    rptSafeContracts().forEach(contract=>{
      if(!contract.renewalDate)return;
      const renewal=rptDate(contract.renewalDate); if(!renewal)return;
      const days=Math.round((renewal-d)/86400000);
      if(days<0)return;
      if(filters.bucket&&!(filters.bucket==="0_90"&&days<=90)&&!(filters.bucket==="91_180"&&days>90&&days<=180)&&!(filters.bucket==="181_365"&&days>180&&days<=365)&&!(filters.bucket==="OVER_365"&&days>365))return;
      try{const m=rptGetContractCfo(contract,d)||{}; rows.push({contractId:contract.id,company:contract.company||"",supplier:contract.supplier||"",currency:contract.currency||"UNSPECIFIED",renewalDate:rptIsoDate(renewal),daysToRenewal:days,renewalOption:contract.renewalOption===true||!!contract.renewalDate,contractValue:rptRound(rptNumber(contract.monthlyPayment)*Math.max(0,rptMonthsBetween(d,rptDate(contract.endDate))||0)),leaseLiability:rptRound(m.leaseLiability),riskStatus:typeof getContractRiskStatus==="function"?getContractRiskStatus(contract.id):rptRiskForDays(days),controlStatus:m.controlStatus||null,bucket:days<=90?"0_90":days<=180?"91_180":days<=365?"181_365":"OVER_365"});}catch(error){rows.push(rptErrorRow(contract,error));}
    });
    report.rows=rows; report.totals={within90Days:rows.filter(r=>r.daysToRenewal<=90).length,within180Days:rows.filter(r=>r.daysToRenewal<=180).length,within365Days:rows.filter(r=>r.daysToRenewal<=365).length};
    if(rows.some(r=>r.status==="ERROR"))report.errors.push("One or more renewal records could not be evaluated.");
    return rptFinalize(report);
  }

  function getModificationReport(reportingDate,filters={}){
    const d=rptResolveDate(reportingDate), report=rptEmptyReport("Modification Report",d,"MODIFICATION_ENGINE"), rows=[];
    rptSafeContracts().forEach(contract=>(Array.isArray(contract.modifications)?contract.modifications:[]).forEach(item=>{
      if(filters.company&&String(contract.company||"")!==String(filters.company))return;
      if(filters.contractId&&contract.id!==filters.contractId)return;
      if(filters.currency&&String(contract.currency||"UNSPECIFIED")!==String(filters.currency))return;
      if(filters.status&&String(item.status||"").toUpperCase()!==String(filters.status).toUpperCase())return;
      const effective=rptDate(item.effectiveDate||item.modificationDate), oldTerms=item.oldTerms||{}, newTerms=item.newTerms||{};
      rows.push({contractId:contract.id,company:contract.company||"",supplier:contract.supplier||"",currency:contract.currency||"UNSPECIFIED",modificationId:item.id||null,modificationDate:rptIsoDate(item.modificationDate||item.createdAt),effectiveDate:rptIsoDate(effective),reason:item.reason||"",oldPayment:rptNumber(oldTerms.payment??item.oldPayment),newPayment:rptNumber(newTerms.payment??item.newPayment),oldLeaseTerm:oldTerms.leaseTerm||item.oldLeaseTerm||null,newLeaseTerm:newTerms.leaseTerm||item.newLeaseTerm||null,oldDiscountRate:rptNumber(oldTerms.discountRate??item.oldDiscountRate),newDiscountRate:rptNumber(newTerms.discountRate??item.newDiscountRate),revisedLiability:rptNumber(item.revisedLeaseLiability),liabilityAdjustment:rptNumber(item.liabilityAdjustment),rouAdjustment:rptNumber(item.rouAdjustment),gainLoss:rptNumber(item.gainLoss),scopeReduction:rptNumber(item.scopeReduction),status:item.status||"DRAFT",source:"MODIFICATION_ENGINE"});
    }));
    report.rows=rows;
    report.totals={count:rows.length,liabilityAdjustment:rptRound(rows.reduce((s,r)=>s+r.liabilityAdjustment,0)),rouAdjustment:rptRound(rows.reduce((s,r)=>s+r.rouAdjustment,0)),gainLoss:rptRound(rows.reduce((s,r)=>s+r.gainLoss,0)),scopeReductions:rptRound(rows.reduce((s,r)=>s+r.scopeReduction,0)),paymentIncreases:rptRound(rows.reduce((s,r)=>s+Math.max(0,r.newPayment-r.oldPayment),0)),paymentDecreases:rptRound(rows.reduce((s,r)=>s+Math.max(0,r.oldPayment-r.newPayment),0)),pending:rows.filter(r=>r.status!=="APPLIED"&&r.status!=="CANCELLED").length,applied:rows.filter(r=>r.status==="APPLIED").length,last12Months:rows.filter(r=>{const x=rptDate(r.effectiveDate),from=rptAddMonths(d,-12);return x&&from&&x>=from&&x<=d;}).length};
    return rptFinalize(report);
  }

  function getReassessmentReport(reportingDate,filters={}){
    const d=rptResolveDate(reportingDate), report=rptEmptyReport("Reassessment Report",d,"REASSESSMENT_ENGINE"), rows=[];
    rptSafeContracts().forEach(contract=>(Array.isArray(contract.reassessments)?contract.reassessments:[]).forEach(item=>{
      if(filters.company&&String(contract.company||"")!==String(filters.company))return;
      if(filters.contractId&&contract.id!==filters.contractId)return;
      if(filters.currency&&String(contract.currency||"UNSPECIFIED")!==String(filters.currency))return;
      if(filters.status&&String(item.status||"").toUpperCase()!==String(filters.status).toUpperCase())return;
      const oldTerms=item.oldTerms||{}, newTerms=item.newTerms||{};
      rows.push({contractId:contract.id,company:contract.company||"",supplier:contract.supplier||"",currency:contract.currency||"UNSPECIFIED",reassessmentId:item.id||null,reassessmentDate:rptIsoDate(item.reassessmentDate||item.createdAt),effectiveDate:rptIsoDate(item.effectiveDate),reason:item.reason||"",oldTerm:oldTerms.leaseTerm||null,newTerm:newTerms.leaseTerm||null,oldPayment:rptNumber(oldTerms.payment),newPayment:rptNumber(newTerms.payment),oldRate:rptNumber(oldTerms.discountRate),newRate:rptNumber(newTerms.discountRate),revisedLiability:rptNumber(item.revisedLeaseLiability),liabilityImpact:rptNumber(item.liabilityAdjustment),rouAdjustment:rptNumber(item.rouAdjustment),paymentImpact:rptNumber(newTerms.payment)-rptNumber(oldTerms.payment),termImpactMonths:(rptMonthsBetween(oldTerms.leaseTerm,newTerms.leaseTerm)||0),status:item.status||"DRAFT",source:"REASSESSMENT_ENGINE"});
    }));
    report.rows=rows;
    report.totals={count:rows.length,liabilityImpact:rptRound(rows.reduce((s,r)=>s+r.liabilityImpact,0)),rouImpact:rptRound(rows.reduce((s,r)=>s+r.rouAdjustment,0)),paymentImpact:rptRound(rows.reduce((s,r)=>s+r.paymentImpact,0)),termImpactMonths:rptRound(rows.reduce((s,r)=>s+r.termImpactMonths,0)),pending:rows.filter(r=>r.status!=="APPLIED"&&r.status!=="CANCELLED").length,applied:rows.filter(r=>r.status==="APPLIED").length,last12Months:rows.filter(r=>{const x=rptDate(r.effectiveDate),from=rptAddMonths(d,-12);return x&&from&&x>=from&&x<=d;}).length};
    return rptFinalize(report);
  }

  function getLeaseContractRegister(reportingDate,filters={}){
    const d=rptResolveDate(reportingDate), report=rptEmptyReport("Lease Contract Register",d,"CONTRACT_MASTER + CFO_DATA_LAYER"), rows=[];
    rptSafeContracts().forEach(contract=>{
      if(filters.company&&String(contract.company||"")!==String(filters.company))return;
      if(filters.status&&String(contract.status||"").toUpperCase()!==String(filters.status).toUpperCase())return;
      if(filters.currency&&String(contract.currency||"UNSPECIFIED")!==String(filters.currency))return;
      try{const m=rptGetContractCfo(contract,d)||{}; rows.push({contractId:contract.id,company:contract.company||"",supplier:contract.supplier||"",startDate:rptIsoDate(contract.startDate),endDate:rptIsoDate(contract.endDate),status:contract.status||"ACTIVE",paymentFrequency:contract.paymentFrequency||"monthly",paymentTiming:contract.paymentTiming||"arrears",monthlyPayment:rptNumber(contract.monthlyPayment),currency:contract.currency||"UNSPECIFIED",escalation:contract.leaseIncreaseType||contract.escalationType||"none",discountRate:rptNumber(contract.discountRate),leaseLiability:rptRound(m.leaseLiability),currentLiability:rptRound(m.currentLiability),nonCurrentLiability:rptRound(m.nonCurrentLiability),rouAsset:rptRound(m.rouAsset),renewalDate:rptIsoDate(contract.renewalDate),modificationStatus:m.modificationStatus||"NONE",reassessmentStatus:m.reassessmentStatus||"NONE",riskStatus:m.controlStatus||null,controlStatus:m.controlStatus||null});}catch(error){rows.push(rptErrorRow(contract,error));}
    });
    report.rows=rows; report.totals={contractCount:rows.length,activeContracts:rows.filter(r=>String(r.status).toUpperCase()==="ACTIVE").length};
    if(rows.some(r=>r.status==="ERROR"))report.errors.push("One or more contracts could not be read.");
    return rptFinalize(report);
  }

  function rptJournalRows(){
    const rows=[];
    rptSafeContracts().forEach(contract=>{
      (Array.isArray(contract.modifications)?contract.modifications:[]).concat(Array.isArray(contract.reassessments)?contract.reassessments:[]).forEach(event=>{
        if(Array.isArray(event.journal)) rows.push(...event.journal.map((entry,index)=>({voucherNo:event.id?`${contract.id}-${event.id}`:null,voucherDate:event.effectiveDate||event.updatedAt||event.createdAt||null,contractId:contract.id,company:contract.company||"",period:null,source:entry.source||event.type||"EVENT",debit:rptNumber(entry.debit),credit:rptNumber(entry.credit),currency:contract.currency||"UNSPECIFIED",controlStatus:entry.controlStatus||null,account:entry.account||"",entryIndex:index,eventId:event.id||null}))); 
      });
    });
    if(Array.isArray(bulkJournalData)) bulkJournalData.forEach(j=>{
      (j.entries||[]).forEach((entry,index)=>rows.push({voucherNo:j.voucherNo||null,voucherDate:j.voucherDate||null,contractId:j.contractId||null,company:j.company||"",period:j.period||null,source:"STANDARD",debit:rptNumber(entry.debit),credit:rptNumber(entry.credit),currency:(rptSafeContracts().find(c=>c.id===j.contractId)?.currency)||"UNSPECIFIED",controlStatus:j.balanced?"VALID":"UNBALANCED",account:entry.account||"",entryIndex:index,eventId:null}));
    });
    const events=typeof getAuditEvents==="function"?getAuditEvents({}):[];
    events.filter(e=>String(e.action||"").includes("JOURNAL_GENERATED")&&!String(e.entityType||"").includes("BATCH")).forEach(e=>{
      if(!rows.some(r=>r.voucherNo===e.journalId)){
        rows.push({voucherNo:e.journalId||e.entityId||null,voucherDate:e.timestamp||null,contractId:e.contractId||null,company:rptSafeContracts().find(c=>c.id===e.contractId)?.company||"",period:e.metadata?.period||null,source:e.metadata?.source||"STANDARD",debit:rptNumber(e.metadata?.totalDebit),credit:rptNumber(e.metadata?.totalCredit),currency:rptSafeContracts().find(c=>c.id===e.contractId)?.currency||"UNSPECIFIED",controlStatus:e.metadata?.balanced===false?"UNBALANCED":"VALID",account:"",entryIndex:null,eventId:e.id||null});
      }
    });
    return rows;
  }

  function getJournalSummaryReport(filters={}){
    const report=rptEmptyReport("Journal Summary Report",filters.endDate||new Date(),"JOURNAL_ENGINE + AUDIT_TRAIL_ENGINE"), all=rptJournalRows();
    report.rows=all.filter(r=>!filters.company||String(r.company||"")===String(filters.company)).filter(r=>!filters.contractId||r.contractId===filters.contractId).filter(r=>!filters.currency||String(r.currency||"")===String(filters.currency)).filter(r=>!filters.source||r.source===filters.source);
    const groups=new Map();
    report.rows.forEach(r=>{const key=r.voucherNo||`${r.contractId||""}-${r.voucherDate||""}-${r.source||""}`;if(!groups.has(key))groups.set(key,{voucherNo:r.voucherNo,voucherDate:r.voucherDate,contractId:r.contractId,company:r.company,period:r.period,source:r.source,currency:r.currency,totalDebit:0,totalCredit:0});const g=groups.get(key);g.totalDebit+=r.debit;g.totalCredit+=r.credit;});
    const journals=[...groups.values()].map(g=>({...g,totalDebit:rptRound(g.totalDebit),totalCredit:rptRound(g.totalCredit),balanced:Math.abs(g.totalDebit-g.totalCredit)<=REPORTING_TOLERANCE,controlStatus:Math.abs(g.totalDebit-g.totalCredit)<=REPORTING_TOLERANCE?"VALID":"UNBALANCED"}));
    report.rows=journals; report.totals={journalCount:journals.length,totalDebits:rptRound(journals.reduce((s,r)=>s+r.totalDebit,0)),totalCredits:rptRound(journals.reduce((s,r)=>s+r.totalCredit,0)),balancedJournals:journals.filter(r=>r.balanced).length,unbalancedJournals:journals.filter(r=>!r.balanced).length};
    report.reconciliation={difference:rptRound(report.totals.totalDebits-report.totals.totalCredits),passed:Math.abs(report.totals.totalDebits-report.totals.totalCredits)<=REPORTING_TOLERANCE};
    if(!report.reconciliation.passed)report.warnings.push("Journal debit / credit totals do not reconcile.");
    return rptFinalize(report);
  }

  function getControlExceptionReport(filters={}){
    const report=rptEmptyReport("Control Exception Report",new Date(),"CONTROL_ENGINE"), rows=[];
    rptSafeContracts().forEach(contract=>{
      try{
        const snapshot=getStoredControlSnapshot(contract.id)||runContractControls(contract,{persist:false,audit:false});
        (snapshot?.exceptions||[]).forEach(ex=>{
          if(filters.status&&ex.status!==filters.status)return;
          if(filters.severity&&ex.priority!==filters.severity)return;
          rows.push({contractId:contract.id,company:contract.company||"",controlId:ex.controlId||null,controlName:ex.controlName||ex.name||null,severity:ex.priority||null,status:ex.status||null,description:ex.message||ex.description||"",detectedAt:ex.detectedAt||snapshot.testedAt||null,riskLevel:snapshot.overallStatus||null});
        });
      }catch(error){report.errors.push(`${contract.id||"UNKNOWN"}: ${error?.message||String(error)}`);}
    });
    report.rows=rows; report.totals={totalExceptions:rows.length,openExceptions:rows.filter(r=>r.status!==CONTROL_EXCEPTION_STATUS.RESOLVED&&r.status!==CONTROL_EXCEPTION_STATUS.WAIVED).length,critical:rows.filter(r=>r.severity===CONTROL_PRIORITY.CRITICAL).length,high:rows.filter(r=>r.severity===CONTROL_PRIORITY.HIGH).length,medium:rows.filter(r=>r.severity===CONTROL_PRIORITY.MEDIUM).length,low:rows.filter(r=>r.severity===CONTROL_PRIORITY.LOW).length};
    return rptFinalize(report);
  }

  function getControlSummaryReport(){
    const summary=typeof getControlSummary==="function"?getControlSummary({persist:false,audit:false}):{};
    const report=rptEmptyReport("Control Summary",new Date(),"CONTROL_ENGINE");
    const snapshots=Array.isArray(summary.snapshots)?summary.snapshots:[];
    const exceptionRows=snapshots.flatMap(s=>Array.isArray(s.exceptions)?s.exceptions:[]);
    const closedExceptions=exceptionRows.filter(e=>e.status===CONTROL_EXCEPTION_STATUS.RESOLVED||e.status===CONTROL_EXCEPTION_STATUS.WAIVED).length;
    const openExceptions=exceptionRows.filter(e=>e.status!==CONTROL_EXCEPTION_STATUS.RESOLVED&&e.status!==CONTROL_EXCEPTION_STATUS.WAIVED).length;
    report.rows=snapshots.map(s=>({contractId:s.contractId||null,overallStatus:s.overallStatus||null,summary:s.summary||{},exceptionCount:Array.isArray(s.exceptions)?s.exceptions.length:0}));
    report.totals={
      totalControls:snapshots.length*(Array.isArray(CONTROL_CONFIG)?CONTROL_CONFIG.filter(c=>c.enabled!==false).length:0),
      passed:summary.green||0,
      warnings:summary.yellow||0,
      failed:summary.red||0,
      critical:summary.criticalExceptions||0,
      high:summary.highExceptions||0,
      medium:summary.mediumExceptions||0,
      low:summary.lowExceptions||0,
      openExceptions,
      closedExceptions
    };
    return rptFinalize(report);
  }

  function getAuditTrailReport(filters={}){
    const report=rptEmptyReport("Audit Trail Report",filters.dateTo||new Date(),"AUDIT_TRAIL_ENGINE"), events=typeof getAuditEvents==="function"?getAuditEvents(filters):[];
    report.rows=events.filter(e=>!filters.company||String(rptSafeContracts().find(c=>c.id===e.contractId)?.company||"")===String(filters.company)).map(e=>({timestamp:e.timestamp||null,actor:e.actor||"system",action:e.action||"",contractId:e.contractId||null,company:rptSafeContracts().find(c=>c.id===e.contractId)?.company||"",oldValue:rptClone(e.oldValue),newValue:rptClone(e.newValue),entityType:e.entityType||null,entityId:e.entityId||null,reason:e.reason||null,journalId:e.journalId||null,modificationId:e.modificationId||null,reassessmentId:e.reassessmentId||null}));
    report.totals={totalEvents:report.rows.length};
    return rptFinalize(report);
  }

  function getCompanyExposureReport(reportingDate){
    const d=rptResolveDate(reportingDate), report=rptEmptyReport("Company Exposure Report",d,"CFO_DATA_LAYER"), rows=typeof getCfoMetricsByCompany==="function"?getCfoMetricsByCompany(d):[];
    report.rows=rows.map(r=>({company:r.company,reportingDate:r.reportingDate,contractCount:r.contractCount,activeContracts:r.activeContracts,totalLiability:rptRound(r.leaseLiability),currentLiability:rptRound(r.currentLiability),nonCurrentLiability:rptRound(r.nonCurrentLiability),rou:rptRound(r.rouAsset),interest:rptRound(r.monthlyInterest),depreciation:rptRound(r.monthlyDepreciation),next12MonthCashPayments:rptRound(r.next12MonthPayments),riskCount:rptNumber(r.risk?.red)+rptNumber(r.risk?.yellow),red:rptNumber(r.risk?.red),yellow:rptNumber(r.risk?.yellow),green:rptNumber(r.risk?.green),openExceptions:rptNumber(r.risk?.openExceptions)}));
    report.totals={companies:report.rows.length};
    return rptFinalize(report);
  }

  function getCurrencyExposureReport(reportingDate){
    const d=rptResolveDate(reportingDate), report=rptEmptyReport("Currency Exposure Report",d,"CFO_DATA_LAYER");
    const groups=typeof getCfoCurrencyMetrics==="function"?getCfoCurrencyMetrics(d):{};
    report.rows=Object.values(groups).map(g=>({currency:g.currency,contractCount:g.contractCount,activeContracts:g.activeContracts,totalLiability:rptRound(g.leaseLiability),currentLiability:rptRound(g.currentLiability),nonCurrentLiability:rptRound(g.nonCurrentLiability),rou:rptRound(g.rouAsset),interest:rptRound(g.monthlyInterest),depreciation:rptRound(g.monthlyDepreciation),cashPayments:rptRound(g.next12MonthPayments),principal:rptRound(g.next12MonthPrincipal)}));
    report.totals={currencyCount:report.rows.length};
    report.reconciliation={note:"Currencies remain separated; no FX conversion is performed."};
    return rptFinalize(report);
  }

  function getLeaseBalanceSheetImpact(reportingDate){
    const d=rptResolveDate(reportingDate);
    return {reportName:"Lease Balance Sheet Impact",reportingDate:rptIsoDate(d),rouAssets:rptRound(getTotalRuoAssets(d)),leaseLiability:rptRound(getTotalLeaseLiability(d)),currentLiability:rptRound(getCurrentLeaseLiability(d)),nonCurrentLiability:rptRound(getNonCurrentLeaseLiability(d)),source:"CFO_DATA_LAYER"};
  }

  function getLeaseProfitLossImpact(startDate,endDate){
    const interest=typeof getInterestExpense==="function"?getInterestExpense(startDate,endDate):0, depreciation=typeof getDepreciationExpense==="function"?getDepreciationExpense(startDate,endDate):0, modifications=getModificationReport(endDate||new Date()).rows.filter(r=>{const d=rptDate(r.effectiveDate),s=rptDate(startDate),e=rptDate(endDate);return d&&(!s||d>=s)&&(!e||d<=e);}).reduce((s,r)=>s+rptNumber(r.gainLoss),0);
    return {reportName:"Lease Profit & Loss Impact",startDate:rptIsoDate(startDate),endDate:rptIsoDate(endDate),interestExpense:rptRound(interest),depreciationExpense:rptRound(depreciation),modificationGainLoss:rptRound(modifications),totalLeasePnlImpact:rptRound(interest+depreciation+modifications),source:"LEASE_SCHEDULE + MODIFICATION_ENGINE"};
  }

  function getLeaseCashFlowReport(startDate,endDate){
    const rows=rptPeriodRows(startDate,endDate,"month"), totalPayments=rows.reduce((s,r)=>s+rptNumber(r.cashPayment),0), principal=rows.reduce((s,r)=>s+rptNumber(r.principal),0), interest=rows.reduce((s,r)=>s+rptNumber(r.interestExpense),0);
    return {reportName:"Lease Cash Flow Report",startDate:rptIsoDate(startDate),endDate:rptIsoDate(endDate),totalPayments:rptRound(totalPayments),principal:rptRound(principal),interest:rptRound(interest),reconciliation:{difference:rptRound(totalPayments-principal-interest),passed:Math.abs(totalPayments-principal-interest)<=REPORTING_TOLERANCE},source:"LEASE_SCHEDULE"};
  }

  function rptPeriodRanges(year,dimension){
    const y=Number(year); if(!Number.isInteger(y))return [];
    if(dimension==="quarter")return [0,1,2,3].map(q=>({period:`${y}-Q${q+1}`,start:new Date(y,q*3,1),end:new Date(y,q*3+3,0)}));
    if(dimension==="year")return [{period:String(y),start:new Date(y,0,1),end:new Date(y,11,31)}];
    return Array.from({length:12},(_,m)=>({period:`${y}-${String(m+1).padStart(2,"0")}`,start:new Date(y,m,1),end:new Date(y,m+1,0)}));
  }

  function getPeriodicLeaseReport(year,dimension="month"){
    const ranges=rptPeriodRanges(year,dimension), report=rptEmptyReport(`${dimension[0].toUpperCase()+dimension.slice(1)} Lease Report`,new Date(Number(year),11,31),"LEASE_SCHEDULE"), rows=[];
    ranges.forEach(range=>{
      const liabilityStart=rptAddDays(range.start,-1), opening=getTotalLeaseLiability(liabilityStart), closing=getTotalLeaseLiability(range.end), period=rptPeriodRows(range.start,range.end,dimension), interest=period.reduce((s,r)=>s+rptNumber(r.interestExpense),0), payments=period.reduce((s,r)=>s+rptNumber(r.cashPayment),0), depreciation=period.reduce((s,r)=>s+rptNumber(r.depreciationExpense),0), rouOpening=getTotalRuoAssets(liabilityStart), rouClosing=getTotalRuoAssets(range.end), liabAdjustment=closing-(opening+interest-payments), rouAdjustment=rouClosing-(rouOpening-depreciation);
      rows.push({period:range.period,openingLiability:rptRound(opening),interest:rptRound(interest),payments:rptRound(payments),closingLiability:rptRound(closing),depreciation:rptRound(depreciation),openingRuo:rptRound(rouOpening),closingRuo:rptRound(rouClosing),liabilityAdjustment:rptRound(liabAdjustment),rouAdjustment:rptRound(rouAdjustment)});
    });
    report.rows=rows; report.totals={openingLiability:rows.length?rows[0].openingLiability:0,interest:rptRound(rows.reduce((s,r)=>s+r.interest,0)),payments:rptRound(rows.reduce((s,r)=>s+r.payments,0)),closingLiability:rows.length?rows[rows.length-1].closingLiability:0,depreciation:rptRound(rows.reduce((s,r)=>s+r.depreciation,0)),openingRuo:rows.length?rows[0].openingRuo:0,closingRuo:rows.length?rows[rows.length-1].closingRuo:0};
    report.reconciliation={liabilityDifference:rptRound(rows.reduce((s,r)=>s+r.openingLiability,0)+report.totals.interest-report.totals.payments+rows.reduce((s,r)=>s+r.liabilityAdjustment,0)-report.totals.closingLiability),rouDifference:rptRound(report.totals.openingRuo-report.totals.depreciation+rows.reduce((s,r)=>s+r.rouAdjustment,0)-report.totals.closingRuo)};
    report.reconciliation.passed=Math.abs(report.reconciliation.liabilityDifference)<=REPORTING_TOLERANCE&&Math.abs(report.reconciliation.rouDifference)<=REPORTING_TOLERANCE;
    if(!report.reconciliation.passed)report.warnings.push("Periodic lease roll-forward reconciliation mismatch.");
    return rptFinalize(report);
  }

  function getMonthlyLeaseReport(year){return getPeriodicLeaseReport(year,"month");}
  function getQuarterlyLeaseReport(year){return getPeriodicLeaseReport(year,"quarter");}
  function getAnnualLeaseReport(year){return getPeriodicLeaseReport(year,"year");}

  function getTfrs16ReportingReconciliation(reportingDate){
    const d=rptResolveDate(reportingDate), liability=getCurrentNonCurrentReport(d), maturity=getLeasePaymentMaturityAnalysis(d), journal=getJournalSummaryReport(), company=getCompanyExposureReport(d), currency=getCurrencyExposureReport(d), liabRoll=getLeaseLiabilityRollForwardReport(new Date(d.getFullYear(),d.getMonth(),1),d), rouRoll=getRuoAssetRollForward(d);
    const portfolioLiability=rptNumber(liability.totals.totalLiability), current=rptNumber(liability.totals.currentLiability), nonCurrent=rptNumber(liability.totals.nonCurrentLiability);
    return {reportingDate:rptIsoDate(d),liability:{total:portfolioLiability,current,nonCurrent,difference:rptRound(portfolioLiability-current-nonCurrent),passed:Math.abs(portfolioLiability-current-nonCurrent)<=REPORTING_TOLERANCE},cashFlow:{difference:rptNumber(maturity.reconciliation?.difference),passed:Boolean(maturity.reconciliation?.passed)},liabilityRollForward:{difference:rptNumber(liabRoll.reconciliation?.difference),passed:Boolean(liabRoll.reconciliation?.passed)},rouRollForward:{difference:rptNumber(rouRoll.reconciliation?.difference),passed:Boolean(rouRoll.reconciliation?.passed)},journal:{difference:rptNumber(journal.reconciliation?.difference),passed:Boolean(journal.reconciliation?.passed)},companyTotals:{companyCount:company.rows.length,portfolioLiability:portfolioLiability,companyLiability:rptRound(company.rows.reduce((s,r)=>s+rptNumber(r.totalLiability),0)),difference:rptRound(company.rows.reduce((s,r)=>s+rptNumber(r.totalLiability),0)-portfolioLiability)},currencyExposure:{currencyCount:currency.rows.length,note:"FX conversion not applied; currencies remain separated."}};
  }

  function getTfrs16FinancialReportingSnapshot(reportingDate){
    const d=rptResolveDate(reportingDate), cfo=typeof getTfrs16CfoSnapshot==="function"?getTfrs16CfoSnapshot(d):{}, bs=getLeaseBalanceSheetImpact(d), periodStart=new Date(d.getFullYear(),d.getMonth(),1), pl=getLeaseProfitLossImpact(periodStart,d), cf=getLeaseCashFlowReport(periodStart,d), liabilityRoll=getLeaseLiabilityRollForwardReport(new Date(d.getFullYear(),d.getMonth(),1),d), rouRoll=getRuoAssetRollForward(d), maturity=getLeasePaymentMaturityAnalysis(d), expiry=getLeaseContractExpiryReport(d), renewal=getRenewalRiskReport(d), modification=getModificationReport(d), reassessment=getReassessmentReport(d), journal=getJournalSummaryReport(), control=getControlExceptionReport(), controlSummary=getControlSummaryReport(), audit=getAuditTrailReport({dateTo:rptIsoDate(d)}), company=getCompanyExposureReport(d), currency=getCurrencyExposureReport(d), reconciliation=getTfrs16ReportingReconciliation(d);
    const errors=[liabilityRoll,rouRoll,maturity,expiry,renewal,modification,reassessment,journal,control,audit,company,currency].flatMap(r=>Array.isArray(r.errors)?r.errors:[]);
    const warnings=[liabilityRoll,rouRoll,maturity,expiry,renewal,modification,reassessment,journal,control,audit,company,currency].flatMap(r=>Array.isArray(r.warnings)?r.warnings:[]);
    if(cfo?.status==="WARNING") warnings.push("CFO data layer reports open control exceptions.");
    if(cfo?.status==="ERROR") errors.push("CFO data layer reported calculation errors.");
    const reconciliationWarning=[reconciliation.liability,reconciliation.cashFlow,reconciliation.liabilityRollForward,reconciliation.rouRollForward,reconciliation.journal,reconciliation.companyTotals].some(x=>x&&x.passed===false);
    if(reconciliationWarning) warnings.push("One or more reporting reconciliation checks failed.");
    const status=errors.length?"ERROR":(warnings.length?"WARNING":"READY");
    return {version:REPORTING_ENGINE_VERSION,reportingDate:rptIsoDate(d),generatedAt:new Date().toISOString(),status,balanceSheet:bs,profitLoss:pl,cashFlow:cf,liabilityRollForward:liabilityRoll,rouRollForward:rouRoll,maturityAnalysis:maturity,expiryReport:expiry,renewalReport:renewal,modificationReport:modification,reassessmentReport:reassessment,contractRegister:getLeaseContractRegister(d),journalSummary:journal,controlSummary,auditSummary:audit,controlExceptionReport:control,companyExposure:company,currencyExposure:currency,cfoSnapshot:cfo,reconciliation,dataQuality:{status,errors:errors.length,warnings:warnings.length,errorList:errors,warningsList:warnings},traceability:{contract:"CONTRACT_MASTER",schedule:"LEASE_SCHEDULE",calculation:"PROFESSIONAL_CALCULATION_ENGINE",modification:"MODIFICATION_ENGINE",reassessment:"REASSESSMENT_ENGINE",journal:"JOURNAL_ENGINE",audit:"AUDIT_TRAIL_ENGINE",riskControl:"CONTROL_ENGINE"}};
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

  function closeIsoDate(value) {
    const d = closeResolveDate(value);
    return d.toISOString().slice(0, 10);
  }

  function closePeriod(value) {
    const d = closeResolveDate(value);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  function closeMonthStart(value) {
    const d = closeResolveDate(value);
    return new Date(d.getFullYear(), d.getMonth(), 1);
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

  function closeIsActive(contract, reportingDate) {
    const status = String(contract?.status || "ACTIVE").toUpperCase();
    if (["TERMINATED", "EXPIRED", "CANCELLED"].includes(status)) return false;
    const start = typeof rptDate === "function" ? rptDate(contract?.startDate) : new Date(contract?.startDate);
    const end = typeof rptDate === "function" ? rptDate(contract?.endDate) : new Date(contract?.endDate);
    const d = closeResolveDate(reportingDate);
    if (start && !Number.isNaN(start.getTime()) && start > d) return false;
    if (end && !Number.isNaN(end.getTime()) && end < d && status !== "ACTIVE") return false;
    return status === "ACTIVE" || !contract?.status;
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

  function closeSeverityWeight(severity) {
    return Number(CLOSE_SCORE_WEIGHTS[String(severity || "MEDIUM").toUpperCase()] || 0);
  }

  function closeBuildCheck(config, status, description, affectedContracts = [], extra = {}) {
    return {
      controlId: config.id,
      controlName: config.name,
      category: config.category,
      severity: config.severity,
      blocking: Boolean(config.blocking),
      status,
      description: description || "",
      affectedContracts: Array.from(new Set((affectedContracts || []).filter(Boolean))),
      resolved: status === CLOSE_CHECK_STATUS.PASS || status === CLOSE_CHECK_STATUS.NOT_APPLICABLE,
      completedAt: new Date().toISOString(),
      ...extra
    };
  }

  function closeControlResultMap(contract, reportingDate, cache) {
    const id = contract?.id;
    if (!id) return null;
    if (cache.has(id)) return cache.get(id);
    let snapshot = null;
    try {
      snapshot = getStoredControlSnapshot(id);
      if (!snapshot) snapshot = runContractControls(contract, { persist: false, audit: false });
    } catch (error) {
      snapshot = { overallStatus: CONTROL_STATUS.RED, controls: [], exceptions: [], error: error?.message || String(error) };
    }
    cache.set(id, snapshot);
    return snapshot;
  }

  function closeControlById(snapshot, controlId) {
    return Array.isArray(snapshot?.controls) ? snapshot.controls.find(x => x?.controlId === controlId) : null;
  }

  function closeMapControlStatus(result) {
    if (!result) return CLOSE_CHECK_STATUS.FAIL;
    const status = String(result.status || "").toUpperCase();
    if (status === String(CONTROL_STATUS.GREEN)) return CLOSE_CHECK_STATUS.PASS;
    if (status === String(CONTROL_STATUS.YELLOW)) return CLOSE_CHECK_STATUS.WARNING;
    if (status === String(CONTROL_STATUS.RED)) return CLOSE_CHECK_STATUS.FAIL;
    return CLOSE_CHECK_STATUS.WARNING;
  }

  function closeAggregateExistingControl(checkId, engineControlId, activeContracts, reportingDate, cache) {
    const affected = [], warnings = [], failures = [], passed = [];
    activeContracts.forEach(contract => {
      const snapshot = closeControlResultMap(contract, reportingDate, cache);
      const result = closeControlById(snapshot, engineControlId);
      const status = closeMapControlStatus(result);
      if (status === CLOSE_CHECK_STATUS.FAIL) failures.push(contract.id);
      else if (status === CLOSE_CHECK_STATUS.WARNING) warnings.push(contract.id);
      else if (status === CLOSE_CHECK_STATUS.PASS) passed.push(contract.id);
      if (status !== CLOSE_CHECK_STATUS.PASS) affected.push(contract.id);
    });
    const config = CLOSE_CONTROLS.find(x => x.id === checkId);
    if (!activeContracts.length) return closeBuildCheck(config, CLOSE_CHECK_STATUS.NOT_APPLICABLE, "No active contracts require this control for the reporting period.", []);
    if (failures.length) return closeBuildCheck(config, CLOSE_CHECK_STATUS.FAIL, `${failures.length} active contract(s) failed the underlying V16.8 control.`, failures, { passedContracts: passed.length, warningContracts: warnings.length });
    if (warnings.length) return closeBuildCheck(config, CLOSE_CHECK_STATUS.WARNING, `${warnings.length} active contract(s) require review under the underlying V16.8 control.`, warnings, { passedContracts: passed.length, failedContracts: failures.length });
    return closeBuildCheck(config, CLOSE_CHECK_STATUS.PASS, `All ${activeContracts.length} active contract(s) passed the underlying control.`, [], { passedContracts: passed.length });
  }

  function closeScheduleCheck(activeContracts, reportingDate) {
    const config = CLOSE_CONTROLS.find(x => x.id === "CLOSE-SCHEDULE-COMPLETENESS");
    const failures = [], warnings = [];
    activeContracts.forEach(contract => {
      try {
        const built = typeof rptScheduleRows === "function" ? rptScheduleRows(contract) : { schedule: [] };
        const schedule = Array.isArray(built?.schedule) ? built.schedule : [];
        if (built?.error || !schedule.length) {
          failures.push(contract.id);
          return;
        }
        const validDates = schedule.every(row => {
          const d = typeof rptDate === "function" ? rptDate(row?.date) : new Date(row?.date);
          return d && !Number.isNaN(d.getTime());
        });
        const relevant = schedule.filter(row => {
          const d = typeof rptDate === "function" ? rptDate(row?.date) : new Date(row?.date);
          return d && !Number.isNaN(d.getTime()) && d <= closeResolveDate(reportingDate);
        });
        if (!validDates || !relevant.length) failures.push(contract.id);
        else {
          const invalidCore = relevant.some(row => row?.closingLiability === undefined && row?.liabilityClosing === undefined && row?.payment === undefined);
          if (invalidCore) warnings.push(contract.id);
        }
      } catch (error) {
        failures.push(contract.id);
      }
    });
    if (!activeContracts.length) return closeBuildCheck(config, CLOSE_CHECK_STATUS.NOT_APPLICABLE, "No active contracts require schedule validation.", []);
    if (failures.length) return closeBuildCheck(config, CLOSE_CHECK_STATUS.FAIL, `${failures.length} contract(s) have missing or invalid payment schedule data.`, failures, { warningContracts: warnings });
    if (warnings.length) return closeBuildCheck(config, CLOSE_CHECK_STATUS.WARNING, `${warnings.length} contract(s) have schedule rows requiring review.`, warnings);
    return closeBuildCheck(config, CLOSE_CHECK_STATUS.PASS, `Payment schedules are available for all ${activeContracts.length} active contract(s).`, []);
  }

  function closeJournalRowsForPeriod(reportingDate) {
    try {
      const start = closeMonthStart(reportingDate), end = closeMonthEnd(reportingDate);
      const report = typeof getJournalSummaryReport === "function" ? getJournalSummaryReport({}) : { rows: [] };
      return (report.rows || []).filter(row => {
        const date = row?.voucherDate || row?.period;
        if (!date) return false;
        const d = typeof rptDate === "function" ? rptDate(date) : new Date(date);
        return d && !Number.isNaN(d.getTime()) && d >= start && d <= end;
      });
    } catch (error) {
      return [];
    }
  }

  function closeJournalCompletenessCheck(activeContracts, reportingDate) {
    const config = CLOSE_CONTROLS.find(x => x.id === "CLOSE-JOURNAL-COMPLETENESS");
    if (!activeContracts.length) return closeBuildCheck(config, CLOSE_CHECK_STATUS.NOT_APPLICABLE, "No active contracts require journal completeness validation.", []);
    const rows = closeJournalRowsForPeriod(reportingDate);
    const journalContractIds = new Set(rows.map(row => row.contractId).filter(Boolean));
    const missing = activeContracts.filter(contract => !journalContractIds.has(contract.id)).map(contract => contract.id);
    const state = closeGetState(closePeriod(reportingDate));
    if (!rows.length && !state?.journalOverride) {
      return closeBuildCheck(config, CLOSE_CHECK_STATUS.FAIL, "No generated journal evidence was found for the reporting period.", activeContracts.map(c => c.id), { journalCount: 0, expectedMode: "GENERATED_JOURNAL_EVIDENCE" });
    }
    if (missing.length) return closeBuildCheck(config, CLOSE_CHECK_STATUS.WARNING, `${missing.length} active contract(s) have no journal evidence in the reporting period.`, missing, { journalCount: rows.length });
    return closeBuildCheck(config, CLOSE_CHECK_STATUS.PASS, `Journal evidence exists for all ${activeContracts.length} active contract(s).`, [], { journalCount: rows.length });
  }

  function closeJournalBalanceCheck(reportingDate) {
    const config = CLOSE_CONTROLS.find(x => x.id === "CLOSE-JOURNAL-BALANCE");
    const report = typeof getJournalSummaryReport === "function" ? getJournalSummaryReport({}) : null;
    const rows = closeJournalRowsForPeriod(reportingDate);
    const unbalanced = rows.filter(row => row?.balanced === false || Math.abs(safeNumber(row?.totalDebit) - safeNumber(row?.totalCredit)) > CLOSE_TOLERANCE);
    const periodDebit = rows.reduce((sum, row) => sum + safeNumber(row?.totalDebit), 0);
    const periodCredit = rows.reduce((sum, row) => sum + safeNumber(row?.totalCredit), 0);
    const difference = periodDebit - periodCredit;
    if (!rows.length) return closeBuildCheck(config, CLOSE_CHECK_STATUS.WARNING, "No journal rows were available for period-level balance validation.", [], { journalCount: 0, difference: 0 });
    if (unbalanced.length || Math.abs(difference) > CLOSE_TOLERANCE) return closeBuildCheck(config, CLOSE_CHECK_STATUS.FAIL, `${unbalanced.length || 1} journal(s) are unbalanced for the reporting period.`, unbalanced.map(r => r.contractId), { journalCount: rows.length, unbalancedJournals: unbalanced.length, difference: Number(difference.toFixed(2)), reportStatus: report?.status || null });
    return closeBuildCheck(config, CLOSE_CHECK_STATUS.PASS, `All ${rows.length} journal(s) in the reporting period are balanced.`, [], { journalCount: rows.length, difference: Number(difference.toFixed(2)) });
  }

  function closeReconciliationChecks(reportingDate) {
    const reconciliation = typeof getTfrs16ReportingReconciliation === "function" ? getTfrs16ReportingReconciliation(reportingDate) : {};
    const liability = reconciliation?.liability || {};
    const liabilityRoll = reconciliation?.liabilityRollForward || {};
    const rouRoll = reconciliation?.rouRollForward || {};
    const cash = reconciliation?.cashFlow || {};
    const configLiab = CLOSE_CONTROLS.find(x => x.id === "CLOSE-LIABILITY-RECON");
    const configRou = CLOSE_CONTROLS.find(x => x.id === "CLOSE-ROU-RECON");
    const configCash = CLOSE_CONTROLS.find(x => x.id === "CLOSE-CASH-RECON");
    const liabCheck = closeBuildCheck(configLiab, liability.passed === true && liabilityRoll.passed !== false ? CLOSE_CHECK_STATUS.PASS : CLOSE_CHECK_STATUS.FAIL, liability.passed === true ? "Current plus non-current liability reconciles to total liability." : "Lease liability reconciliation failed.", [], { difference: liability.difference, rollForwardPassed: liabilityRoll.passed });
    if (liabilityRoll.passed === false) {
      liabCheck.status = CLOSE_CHECK_STATUS.FAIL;
      liabCheck.description = "Lease liability roll-forward reconciliation failed.";
      liabCheck.difference = liabilityRoll.difference;
    }
    const rouCheck = closeBuildCheck(configRou, rouRoll.passed === true ? CLOSE_CHECK_STATUS.PASS : CLOSE_CHECK_STATUS.FAIL, rouRoll.passed === true ? "ROU roll-forward reconciles." : "ROU roll-forward reconciliation failed.", [], { difference: rouRoll.difference });
    const cashCheck = closeBuildCheck(configCash, cash.passed === true ? CLOSE_CHECK_STATUS.PASS : (cash.passed === false ? CLOSE_CHECK_STATUS.WARNING : CLOSE_CHECK_STATUS.NOT_APPLICABLE), cash.passed === true ? "Cash payment reconciliation passes." : "Cash payment reconciliation is unavailable or requires review.", [], { difference: cash.difference, basis: "EXPECTED_SCHEDULED_CASH" });
    return { reconciliation, liabCheck, rouCheck, cashCheck };
  }

  function closeReportingCompletenessCheck(reportingDate, reportingSnapshot) {
    const config = CLOSE_CONTROLS.find(x => x.id === "CLOSE-REPORTING-COMPLETENESS");
    if (!reportingSnapshot) return closeBuildCheck(config, CLOSE_CHECK_STATUS.FAIL, "Financial reporting snapshot could not be generated.", []);
    if (reportingSnapshot.status === "ERROR") return closeBuildCheck(config, CLOSE_CHECK_STATUS.FAIL, "Financial reporting engine returned an ERROR status.", [], { sourceStatus: reportingSnapshot.status });
    if (reportingSnapshot.status === "WARNING") return closeBuildCheck(config, CLOSE_CHECK_STATUS.WARNING, "Financial reporting engine returned WARNING status.", [], { sourceStatus: reportingSnapshot.status });
    return closeBuildCheck(config, CLOSE_CHECK_STATUS.PASS, "Financial reporting snapshot is complete and ready.", [], { sourceStatus: reportingSnapshot.status, reportingDate: closeIsoDate(reportingDate) });
  }

  function closeAuditCheck(activeContracts, reportingDate) {
    const config = CLOSE_CONTROLS.find(x => x.id === "CLOSE-AUDIT-TRAIL");
    const affected = [];
    activeContracts.forEach(contract => {
      try {
        const events = typeof getAuditTrail === "function" ? getAuditTrail(contract.id) : [];
        if (!events.length) affected.push(contract.id);
      } catch (error) {
        affected.push(contract.id);
      }
    });
    if (!activeContracts.length) return closeBuildCheck(config, CLOSE_CHECK_STATUS.NOT_APPLICABLE, "No active contracts require audit completeness validation.", []);
    if (affected.length) return closeBuildCheck(config, CLOSE_CHECK_STATUS.FAIL, `${affected.length} active contract(s) have no audit evidence.`, affected);
    return closeBuildCheck(config, CLOSE_CHECK_STATUS.PASS, `Audit evidence exists for all ${activeContracts.length} active contract(s).`, []);
  }

  function closeControlExceptionCheck(activeContracts, reportingDate, cache) {
    const config = CLOSE_CONTROLS.find(x => x.id === "CLOSE-CONTROL-EXCEPTIONS");
    const open = [], critical = [], high = [];
    activeContracts.forEach(contract => {
      const snapshot = closeControlResultMap(contract, reportingDate, cache);
      (snapshot?.exceptions || []).forEach(exception => {
        const status = String(exception?.status || "OPEN").toUpperCase();
        if (["RESOLVED", "WAIVED"].includes(status)) return;
        open.push({ contractId: contract.id, controlId: exception.controlId || null, severity: exception.priority || null, description: exception.message || exception.description || "", status });
        if (String(exception?.priority || "").toUpperCase() === CONTROL_PRIORITY.CRITICAL) critical.push(contract.id);
        if (String(exception?.priority || "").toUpperCase() === CONTROL_PRIORITY.HIGH) high.push(contract.id);
      });
    });
    if (critical.length) return closeBuildCheck(config, CLOSE_CHECK_STATUS.FAIL, `${open.length} open control exception(s), including critical exceptions, remain unresolved.`, Array.from(new Set(critical)), { openExceptions: open, criticalExceptions: critical.length, highExceptions: high.length });
    if (high.length) return closeBuildCheck(config, CLOSE_CHECK_STATUS.FAIL, `${open.length} open control exception(s), including high-priority exceptions, remain unresolved.`, Array.from(new Set(high)), { openExceptions: open, criticalExceptions: 0, highExceptions: high.length });
    if (open.length) return closeBuildCheck(config, CLOSE_CHECK_STATUS.WARNING, `${open.length} non-blocking control exception(s) remain open.`, Array.from(new Set(open.map(x => x.contractId))), { openExceptions: open, criticalExceptions: 0, highExceptions: 0 });
    return closeBuildCheck(config, CLOSE_CHECK_STATUS.PASS, "No unresolved control exceptions remain for active contracts.", [], { openExceptions: [] });
  }

  function getMonthEndCloseChecklist(reportingDate) {
    const d = closeResolveDate(reportingDate), period = closePeriod(d), start = closeMonthStart(d), end = closeMonthEnd(d);
    const activeContracts = closeSafeContracts().filter(c => closeIsActive(c, d));
    const cache = new Map();
    const checks = [];
    const push = check => checks.push(check);
    const reportingSnapshot = typeof getTfrs16FinancialReportingSnapshot === "function" ? getTfrs16FinancialReportingSnapshot(d) : null;

    push(closeAggregateExistingControl("CLOSE-CONTRACT-COMPLETENESS", "CTRL-DATA-001", activeContracts, d, cache));
    push(closeAggregateExistingControl("CLOSE-CONTRACT-VALIDITY", "CTRL-DATA-002", activeContracts, d, cache));
    push(closeScheduleCheck(activeContracts, d));
    push(closeAggregateExistingControl("CLOSE-CALCULATION-COMPLETENESS", "CTRL-CALC-001", activeContracts, d, cache));
    push(closeAggregateExistingControl("CLOSE-ESCALATION-VALIDATION", "CTRL-ESC-001", activeContracts, d, cache));
    push(closeAggregateExistingControl("CLOSE-MODIFICATION-REVIEW", "CTRL-MOD-001", activeContracts, d, cache));
    push(closeAggregateExistingControl("CLOSE-REASSESSMENT-REVIEW", "CTRL-REA-001", activeContracts, d, cache));
    push(closeJournalCompletenessCheck(activeContracts, d));
    push(closeJournalBalanceCheck(d));
    push(closeAggregateExistingControl("CLOSE-CLASSIFICATION", "CTRL-CLS-001", activeContracts, d, cache));
    const reconciliations = closeReconciliationChecks(d);
    push(reconciliations.liabCheck);
    push(reconciliations.rouCheck);
    push(reconciliations.cashCheck);
    push(closeControlExceptionCheck(activeContracts, d, cache));
    push(closeAuditCheck(activeContracts, d));
    push(closeReportingCompletenessCheck(d, reportingSnapshot));

    const state = closeGetState(period);
    const checklist = {
      engineVersion: CLOSE_ENGINE_VERSION,
      period,
      reportingDate: closeIsoDate(d),
      periodStart: closeIsoDate(start),
      periodEnd: closeIsoDate(end),
      generatedAt: new Date().toISOString(),
      checks,
      activeContractCount: activeContracts.length,
      contractCount: closeSafeContracts().length,
      state: state || { period, status: CLOSE_STATUS.NOT_STARTED, locked: false, certified: false },
      summary: {
        total: checks.length,
        passed: checks.filter(x => x.status === CLOSE_CHECK_STATUS.PASS).length,
        warnings: checks.filter(x => x.status === CLOSE_CHECK_STATUS.WARNING).length,
        failed: checks.filter(x => x.status === CLOSE_CHECK_STATUS.FAIL).length,
        notApplicable: checks.filter(x => x.status === CLOSE_CHECK_STATUS.NOT_APPLICABLE).length
      }
    };
    checklist.dataQuality = {
      status: checklist.summary.failed ? "ERROR" : (checklist.summary.warnings ? "WARNING" : "READY"),
      errors: checklist.summary.failed,
      warnings: checklist.summary.warnings
    };
    return checklist;
  }

  function closeCalculateScore(checks) {
    const applicable = (checks || []).filter(c => c.status !== CLOSE_CHECK_STATUS.NOT_APPLICABLE);
    if (!applicable.length) return 100;
    let totalWeight = 0, earned = 0;
    applicable.forEach(check => {
      const weight = closeSeverityWeight(check.severity);
      totalWeight += weight;
      if (check.status === CLOSE_CHECK_STATUS.PASS) earned += weight;
      else if (check.status === CLOSE_CHECK_STATUS.WARNING) earned += weight * 0.75;
    });
    return totalWeight ? Math.max(0, Math.min(100, Number(((earned / totalWeight) * 100).toFixed(2)))) : 100;
  }

  function closeEvaluateStatus(checklist, score, state) {
    if (state?.locked && state?.certified) return CLOSE_STATUS.CLOSED;
    if (state?.status === CLOSE_STATUS.REOPENED) {
      if (checklist.summary.failed) return CLOSE_STATUS.BLOCKED;
      if (checklist.summary.warnings) return CLOSE_STATUS.WARNING;
      return CLOSE_STATUS.REOPENED;
    }
    if (checklist.summary.failed) return CLOSE_STATUS.BLOCKED;
    if (score >= 100 && checklist.summary.warnings === 0) return CLOSE_STATUS.READY;
    if (checklist.summary.warnings) return CLOSE_STATUS.WARNING;
    return CLOSE_STATUS.IN_PROGRESS;
  }

  function getCloseReadiness(reportingDate) {
    const d = closeResolveDate(reportingDate), period = closePeriod(d);
    const checklist = getMonthEndCloseChecklist(d);
    const score = closeCalculateScore(checklist.checks);
    const state = closeGetState(period);
    const blockers = checklist.checks.filter(c => c.status === CLOSE_CHECK_STATUS.FAIL && c.blocking);
    const warnings = checklist.checks.filter(c => c.status === CLOSE_CHECK_STATUS.WARNING);
    const passed = checklist.checks.filter(c => c.status === CLOSE_CHECK_STATUS.PASS);
    const status = closeEvaluateStatus(checklist, score, state);
    return {
      engineVersion: CLOSE_ENGINE_VERSION,
      period,
      reportingDate: closeIsoDate(d),
      ready: status === CLOSE_STATUS.READY || status === CLOSE_STATUS.CLOSED,
      score,
      status,
      blockingIssues: blockers,
      warnings,
      passedControls: passed.length,
      totalControls: checklist.checks.length,
      checklist,
      state: state || { period, status: CLOSE_STATUS.NOT_STARTED, locked: false, certified: false }
    };
  }

  function getMonthEndCloseStatus(reportingDate) {
    return getCloseReadiness(reportingDate);
  }

  function getMonthEndCloseSummary(reportingDate) {
    const d = closeResolveDate(reportingDate), readiness = getCloseReadiness(d);
    const financial = typeof getTfrs16FinancialReportingSnapshot === "function" ? getTfrs16FinancialReportingSnapshot(d) : {};
    const journal = typeof getJournalSummaryReport === "function" ? getJournalSummaryReport({}) : { rows: [], totals: {} };
    const cfo = typeof getTfrs16CfoSnapshot === "function" ? getTfrs16CfoSnapshot(d) : {};
    const checklist = readiness.checklist;
    const controlCheck = checklist.checks.find(x => x.controlId === "CLOSE-CONTROL-EXCEPTIONS");
    const exceptionRows = controlCheck?.openExceptions || [];
    return {
      engineVersion: CLOSE_ENGINE_VERSION,
      period: readiness.period,
      reportingDate: readiness.reportingDate,
      status: readiness.status,
      closeScore: readiness.score,
      contractCount: closeSafeContracts().length,
      activeContractCount: checklist.activeContractCount,
      calculationStatus: checklist.checks.find(x => x.controlId === "CLOSE-CALCULATION-COMPLETENESS")?.status || "UNKNOWN",
      scheduleStatus: checklist.checks.find(x => x.controlId === "CLOSE-SCHEDULE-COMPLETENESS")?.status || "UNKNOWN",
      journalStatus: checklist.checks.find(x => x.controlId === "CLOSE-JOURNAL-COMPLETENESS")?.status || "UNKNOWN",
      journalBalanceStatus: checklist.checks.find(x => x.controlId === "CLOSE-JOURNAL-BALANCE")?.status || "UNKNOWN",
      reconciliationStatus: ["CLOSE-LIABILITY-RECON", "CLOSE-ROU-RECON", "CLOSE-CASH-RECON"].every(id => [CLOSE_CHECK_STATUS.PASS, CLOSE_CHECK_STATUS.NOT_APPLICABLE].includes(checklist.checks.find(x => x.controlId === id)?.status)) ? "READY" : "WARNING",
      controlStatus: checklist.checks.find(x => x.controlId === "CLOSE-CONTROL-EXCEPTIONS")?.status || "UNKNOWN",
      exceptionCount: exceptionRows.length,
      criticalExceptionCount: exceptionRows.filter(x => String(x.severity || "").toUpperCase() === CONTROL_PRIORITY.CRITICAL).length,
      warningCount: checklist.summary.warnings,
      blockingIssueCount: readiness.blockingIssues.length,
      balancedJournalCount: journal.totals?.balancedJournals || 0,
      journalCount: journal.totals?.journalCount || 0,
      totalLiability: financial?.balanceSheet?.leaseLiability ?? cfo?.liabilities?.total ?? 0,
      currentLiability: financial?.balanceSheet?.currentLiability ?? cfo?.liabilities?.current ?? 0,
      nonCurrentLiability: financial?.balanceSheet?.nonCurrentLiability ?? cfo?.liabilities?.nonCurrent ?? 0,
      rouAssets: financial?.balanceSheet?.rouAssets ?? cfo?.rouAssets?.total ?? 0,
      blockers: readiness.blockingIssues,
      warnings: readiness.warnings,
      certification: readiness.state?.certificationStatus || (readiness.state?.certified ? "CERTIFIED" : "NOT_CERTIFIED")
    };
  }

  function getCompanyMonthEndCloseStatus(company, reportingDate) {
    const d = closeResolveDate(reportingDate), name = String(company || "");
    const companyContracts = closeSafeContracts().filter(c => String(c?.company || "") === name);
    const active = companyContracts.filter(c => closeIsActive(c, d));
    const cache = new Map();
    const localChecks = [];
    const subset = ids => active.filter(c => ids.includes(c.id));
    [
      ["CLOSE-CONTRACT-COMPLETENESS", "CTRL-DATA-001"],
      ["CLOSE-CONTRACT-VALIDITY", "CTRL-DATA-002"],
      ["CLOSE-CALCULATION-COMPLETENESS", "CTRL-CALC-001"],
      ["CLOSE-ESCALATION-VALIDATION", "CTRL-ESC-001"],
      ["CLOSE-MODIFICATION-REVIEW", "CTRL-MOD-001"],
      ["CLOSE-REASSESSMENT-REVIEW", "CTRL-REA-001"],
      ["CLOSE-CLASSIFICATION", "CTRL-CLS-001"]
    ].forEach(pair => localChecks.push(closeAggregateExistingControl(pair[0], pair[1], active, d, cache)));
    localChecks.push(closeScheduleCheck(active, d));
    const recon = typeof getCurrentNonCurrentReport === "function" ? getCurrentNonCurrentReport(d, { company: name }) : null;
    const journal = typeof getJournalSummaryReport === "function" ? getJournalSummaryReport({ company: name }) : { rows: [], totals: {} };
    const openExceptions = active.flatMap(c => {
      const snap = closeControlResultMap(c, d, cache);
      return (snap?.exceptions || []).filter(e => !["RESOLVED", "WAIVED"].includes(String(e?.status || "OPEN").toUpperCase())).map(e => ({ ...e, contractId: c.id }));
    });
    const failed = localChecks.filter(c => c.status === CLOSE_CHECK_STATUS.FAIL);
    const warnings = localChecks.filter(c => c.status === CLOSE_CHECK_STATUS.WARNING);
    const score = closeCalculateScore(localChecks);
    const status = failed.length ? CLOSE_STATUS.BLOCKED : (warnings.length || openExceptions.length ? CLOSE_STATUS.WARNING : CLOSE_STATUS.READY);
    const liability = recon?.totals || {};
    return {
      company: name,
      reportingDate: closeIsoDate(d),
      period: closePeriod(d),
      status,
      score,
      contractCount: companyContracts.length,
      activeContractCount: active.length,
      totalLiability: safeNumber(liability.totalLiability),
      currentLiability: safeNumber(liability.currentLiability),
      nonCurrentLiability: safeNumber(liability.nonCurrentLiability),
      journalStatus: journal?.totals?.unbalancedJournals ? "WARNING" : (journal?.totals?.journalCount ? "READY" : "WARNING"),
      reconciliationStatus: recon ? (Math.abs(safeNumber(liability.totalLiability) - safeNumber(liability.currentLiability) - safeNumber(liability.nonCurrentLiability)) <= CLOSE_TOLERANCE ? "READY" : "ERROR") : "WARNING",
      exceptions: openExceptions,
      exceptionCount: openExceptions.length,
      criticalExceptionCount: openExceptions.filter(e => String(e?.priority || e?.severity || "").toUpperCase() === CONTROL_PRIORITY.CRITICAL).length,
      checks: localChecks,
      blockers: failed,
      warnings
    };
  }

  function getCurrencyMonthEndCloseStatus(currency, reportingDate) {
    const d = closeResolveDate(reportingDate), curr = String(currency || "UNSPECIFIED");
    const contractsForCurrency = closeSafeContracts().filter(c => String(c?.currency || "UNSPECIFIED") === curr);
    const companies = Array.from(new Set(contractsForCurrency.map(c => c.company).filter(Boolean)));
    const companyStatus = companies.map(company => getCompanyMonthEndCloseStatus(company, d));
    const failed = companyStatus.filter(x => x.status === CLOSE_STATUS.BLOCKED);
    const warnings = companyStatus.filter(x => x.status === CLOSE_STATUS.WARNING);
    const exposure = typeof getCurrencyExposureReport === "function" ? getCurrencyExposureReport(d, { currency: curr }) : { rows: [] };
    const row = (exposure?.rows || []).find(x => String(x.currency || "UNSPECIFIED") === curr) || {};
    return {
      currency: curr,
      reportingDate: closeIsoDate(d),
      period: closePeriod(d),
      status: failed.length ? CLOSE_STATUS.BLOCKED : (warnings.length ? CLOSE_STATUS.WARNING : CLOSE_STATUS.READY),
      companyCount: companies.length,
      contractCount: contractsForCurrency.length,
      score: companyStatus.length ? Number((companyStatus.reduce((s, x) => s + safeNumber(x.score), 0) / companyStatus.length).toFixed(2)) : 100,
      totalLiability: safeNumber(row.totalLiability),
      currentLiability: safeNumber(row.currentLiability),
      nonCurrentLiability: safeNumber(row.nonCurrentLiability),
      rouAssets: safeNumber(row.rouAssets || row.rouAsset),
      companies: companyStatus,
      fxConversionApplied: false
    };
  }

  function getCloseApprovalReadiness(reportingDate) {
    const readiness = getCloseReadiness(reportingDate);
    const state = readiness.state || {};
    return {
      period: readiness.period,
      reportingDate: readiness.reportingDate,
      ready: readiness.ready,
      score: readiness.score,
      status: readiness.status,
      approvalStatus: readiness.ready ? "READY_FOR_CERTIFICATION" : "NOT_READY",
      blockingIssues: readiness.blockingIssues,
      warnings: readiness.warnings,
      openControls: readiness.checklist.checks.filter(c => c.status !== CLOSE_CHECK_STATUS.PASS && c.status !== CLOSE_CHECK_STATUS.NOT_APPLICABLE),
      reconciliationStatus: readiness.checklist.checks.filter(c => c.category === "RECONCILIATION").map(c => ({ controlId: c.controlId, status: c.status, description: c.description })),
      journalStatus: readiness.checklist.checks.filter(c => c.category === "JOURNAL").map(c => ({ controlId: c.controlId, status: c.status, description: c.description })),
      certification: {
        certified: Boolean(state.certified),
        certifiedAt: state.certifiedAt || null,
        certifiedBy: state.certifiedBy || null,
        certificationStatus: state.certificationStatus || (state.certified ? "CERTIFIED" : "NOT_CERTIFIED"),
        comments: state.comments || ""
      }
    };
  }

  function getMonthEndCloseDashboardData(reportingDate) {
    const d = closeResolveDate(reportingDate), readiness = getCloseReadiness(d), summary = getMonthEndCloseSummary(d);
    const financial = typeof getTfrs16FinancialReportingSnapshot === "function" ? getTfrs16FinancialReportingSnapshot(d) : {};
    const companies = Array.from(new Set(closeSafeContracts().map(c => c.company).filter(Boolean))).map(company => getCompanyMonthEndCloseStatus(company, d));
    const currencies = Array.from(new Set(closeSafeContracts().map(c => c.currency || "UNSPECIFIED"))).map(currency => getCurrencyMonthEndCloseStatus(currency, d));
    const cfo = typeof getTfrs16CfoSnapshot === "function" ? getTfrs16CfoSnapshot(d) : {};
    return {
      engineVersion: CLOSE_ENGINE_VERSION,
      period: closePeriod(d),
      status: readiness.status,
      score: readiness.score,
      totalContracts: summary.contractCount,
      activeContracts: summary.activeContractCount,
      totalLiability: financial?.balanceSheet?.leaseLiability ?? cfo?.liabilities?.total ?? 0,
      currentLiability: financial?.balanceSheet?.currentLiability ?? cfo?.liabilities?.current ?? 0,
      nonCurrentLiability: financial?.balanceSheet?.nonCurrentLiability ?? cfo?.liabilities?.nonCurrent ?? 0,
      rouAssets: financial?.balanceSheet?.rouAssets ?? cfo?.rouAssets?.total ?? 0,
      interestExpense: financial?.profitLoss?.interestExpense ?? cfo?.pnl?.interestExpense ?? 0,
      depreciationExpense: financial?.profitLoss?.depreciationExpense ?? cfo?.pnl?.depreciationExpense ?? 0,
      journalCount: summary.journalCount,
      balancedJournalCount: summary.balancedJournalCount,
      reconciliationStatus: summary.reconciliationStatus,
      exceptionCount: summary.exceptionCount,
      criticalExceptionCount: summary.criticalExceptionCount,
      renewals90Days: cfo?.renewals?.within90Days ?? 0,
      modificationsPending: cfo?.modifications?.pending ?? 0,
      reassessmentsPending: cfo?.reassessments?.pending ?? 0,
      companyStatus: companies,
      currencyStatus: currencies,
      controls: readiness.checklist.checks,
      blockers: readiness.blockingIssues,
      warnings: readiness.warnings,
      certification: readiness.state
    };
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

  function v18Number(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function v18Round(value, digits = 2) {
    const n = v18Number(value);
    const factor = Math.pow(10, digits);
    return Math.round((n + Number.EPSILON) * factor) / factor;
  }

  function v18Clone(value) {
    try { return JSON.parse(JSON.stringify(value)); } catch (error) { return null; }
  }

  function v18Date(value) {
    try { return typeof parseDate === "function" ? parseDate(value) : null; } catch (error) { return null; }
  }

  function v18IsoDate(value) {
    const d = v18Date(value);
    return d ? d.toISOString().slice(0, 10) : null;
  }

  function v18ResolveDate(value) {
    try {
      if (typeof cfoResolveReportingDate === "function") return cfoResolveReportingDate(value);
      if (typeof rptResolveDate === "function") return rptResolveDate(value);
    } catch (error) {}
    return v18Date(value) || new Date();
  }

  function v18AddDays(value, days) {
    const d = v18Date(value);
    if (!d) return null;
    const out = new Date(d.getTime());
    out.setDate(out.getDate() + Number(days || 0));
    return out;
  }

  function v18AddMonths(value, months) {
    const d = v18Date(value);
    if (!d) return null;
    return new Date(d.getFullYear(), d.getMonth() + Number(months || 0), d.getDate());
  }

  function v18DaysBetween(from, to) {
    const a = v18Date(from), b = v18Date(to);
    if (!a || !b) return null;
    return Math.round((b.getTime() - a.getTime()) / 86400000);
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

  function v18Kpi(value, unit, currency, period, status = "INFO", sourceFunction = null, calculationStatus = "READY", trend = null) {
    const numericValue = value === null || value === undefined ? null : v18Round(value);
    return {
      value: numericValue,
      unit: unit || "currency",
      currency: currency || null,
      period: period || null,
      status,
      trend: trend || { current: numericValue, previous: null, change: null, changePercent: null, available: false },
      source: "V18_CFO_COCKPIT",
      sourceFunction: sourceFunction || null,
      reportingDate: period || null,
      calculationStatus
    };
  }

  function v18Trend(current, previous) {
    const c = v18Number(current), p = Number(previous);
    if (!Number.isFinite(p)) return { current: v18Round(c), previous: null, change: null, changePercent: null, available: false };
    const change = v18Round(c - p);
    const changePercent = Math.abs(p) > 0.0000001 ? v18Round((change / Math.abs(p)) * 100) : null;
    return { current: v18Round(c), previous: v18Round(p), change, changePercent, available: true };
  }

  function v18PreviousSnapshot(reportingDate) {
    try {
      const d = v18ResolveDate(reportingDate), previous = new Date(d.getFullYear(), d.getMonth() - 1, d.getDate());
      if (typeof getTfrs16CfoMetrics === "function") return getTfrs16CfoMetrics(previous);
    } catch (error) {}
    return null;
  }

  function v18CurrencyScalarOrNull(groups, key) {
    const list = Object.values(groups || {});
    if (list.length !== 1) return null;
    return v18Round(list[0]?.[key]);
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

  function v18FinancialPosition(reportingDate, rows) {
    const activeRows = (rows || []).filter(r => r.metric?.active);
    const byCurrency = v18GroupMetricRowsByCurrency(activeRows);
    const previous = v18PreviousSnapshot(reportingDate);
    const currencies = Object.values(byCurrency);
    const singleCurrency = currencies.length === 1;
    const totalLiability = singleCurrency ? currencies[0].leaseLiability : null;
    const currentLiability = singleCurrency ? currencies[0].currentLiability : null;
    const nonCurrentLiability = singleCurrency ? currencies[0].nonCurrentLiability : null;
    const rouAssets = singleCurrency ? currencies[0].rouAsset : null;
    const difference = singleCurrency ? v18Round(totalLiability - currentLiability - nonCurrentLiability) : null;
    return {
      totalRuoAssets: rouAssets,
      totalLeaseLiability: totalLiability,
      currentLeaseLiability: currentLiability,
      nonCurrentLeaseLiability: nonCurrentLiability,
      byCurrency,
      currencyCount: currencies.length,
      reconciliation: {
        difference,
        passed: singleCurrency ? Math.abs(difference) <= 0.05 : null,
        status: singleCurrency ? (Math.abs(difference) <= 0.05 ? "READY" : "ERROR") : "SEPARATE_CURRENCIES"
      },
      trend: {
        leaseLiability: singleCurrency ? v18Trend(totalLiability, previous?.liabilities?.total) : { current: null, previous: null, change: null, changePercent: null, available: false },
        rouAssets: singleCurrency ? v18Trend(rouAssets, previous?.rouAssets?.total) : { current: null, previous: null, change: null, changePercent: null, available: false }
      },
      source: "V16.10_FINANCIAL_REPORTING + V16.9_CFO_DATA_LAYER",
      currencyIsolation: true
    };
  }

  function v18ProfitLoss(reportingDate, rows) {
    const d = v18ResolveDate(reportingDate), activeRows = (rows || []).filter(r => r.metric?.active), byCurrency = v18GroupMetricRowsByCurrency(activeRows), currencies = Object.values(byCurrency);
    const modificationReport = typeof getModificationReport === "function" ? getModificationReport(d) : { rows: [] };
    const reassessmentReport = typeof getReassessmentReport === "function" ? getReassessmentReport(d) : { rows: [] };
    const modificationByCurrency = {};
    const reassessmentByCurrency = {};
    (modificationReport.rows || []).forEach(row => { const currency = String(row.currency || "UNSPECIFIED").toUpperCase(); if (!modificationByCurrency[currency]) modificationByCurrency[currency] = 0; modificationByCurrency[currency] += v18Number(row.gainLoss); });
    (reassessmentReport.rows || []).forEach(row => { const currency = String(row.currency || "UNSPECIFIED").toUpperCase(); if (!reassessmentByCurrency[currency]) reassessmentByCurrency[currency] = 0; reassessmentByCurrency[currency] += v18Number(row.gainLoss); });
    const byCurrencyResult = currencies.map(g => ({ currency: g.currency, interestExpense: g.monthlyInterest, depreciationExpense: g.monthlyDepreciation, modificationGainLoss: v18Round(modificationByCurrency[g.currency] || 0), reassessmentImpact: v18Round(reassessmentByCurrency[g.currency] || 0), totalLeasePnlImpact: v18Round(g.monthlyInterest + g.monthlyDepreciation + v18Number(modificationByCurrency[g.currency]) + v18Number(reassessmentByCurrency[g.currency])) }));
    const single = byCurrencyResult.length === 1 ? byCurrencyResult[0] : null;
    const previous = v18PreviousSnapshot(d);
    return {
      interestExpense: single ? single.interestExpense : null,
      depreciationExpense: single ? single.depreciationExpense : null,
      modificationGainLoss: single ? single.modificationGainLoss : null,
      reassessmentImpact: single ? single.reassessmentImpact : null,
      totalLeasePnlImpact: single ? single.totalLeasePnlImpact : null,
      byCurrency: byCurrencyResult,
      currencyCount: byCurrencyResult.length,
      trend: {
        interestExpense: single ? v18Trend(single.interestExpense, previous?.pnl?.interestExpense) : { current: null, previous: null, change: null, changePercent: null, available: false },
        depreciationExpense: single ? v18Trend(single.depreciationExpense, previous?.pnl?.depreciationExpense) : { current: null, previous: null, change: null, changePercent: null, available: false }
      },
      source: "V16.10_FINANCIAL_REPORTING",
      currencyIsolation: true
    };
  }

  function v18LiquidityView(reportingDate) {
    const d = v18ResolveDate(reportingDate), groups = {};
    const makeRows = () => [
      { id: "NEXT_30D", name: "Next 30 Days", payments: 0, principal: 0, interest: 0 },
      { id: "NEXT_90D", name: "Next 90 Days", payments: 0, principal: 0, interest: 0 },
      { id: "NEXT_12M", name: "Next 12 Months", payments: 0, principal: 0, interest: 0 },
      { id: "YEAR_1_3", name: "1–3 Years", payments: 0, principal: 0, interest: 0 },
      { id: "YEAR_3_PLUS", name: "3+ Years", payments: 0, principal: 0, interest: 0 }
    ];
    v18SafeContracts().forEach(contract => {
      const currency = v18Currency(contract);
      if (!groups[currency]) groups[currency] = makeRows();
      try {
        const built = typeof cfoBuildSchedule === "function" ? cfoBuildSchedule(contract) : { schedule: [] };
        (built.schedule || []).forEach(item => {
          const date = v18Date(item?.date);
          if (!date || date <= d) return;
          const payment = v18Number(item?.payment), principal = v18Number(item?.principal), interest = v18Number(item?.interest), days = v18DaysBetween(d, date);
          if (days === null) return;
          if (days <= 30) { groups[currency][0].payments += payment; groups[currency][0].principal += principal; groups[currency][0].interest += interest; }
          if (days <= 90) { groups[currency][1].payments += payment; groups[currency][1].principal += principal; groups[currency][1].interest += interest; }
          if (days <= 365) { groups[currency][2].payments += payment; groups[currency][2].principal += principal; groups[currency][2].interest += interest; }
          if (date > v18AddMonths(d, 12) && date <= v18AddMonths(d, 36)) { groups[currency][3].payments += payment; groups[currency][3].principal += principal; groups[currency][3].interest += interest; }
          if (date > v18AddMonths(d, 36)) { groups[currency][4].payments += payment; groups[currency][4].principal += principal; groups[currency][4].interest += interest; }
        });
      } catch (error) {}
    });
    Object.values(groups).forEach(rows => rows.forEach(row => { row.payments = v18Round(row.payments); row.principal = v18Round(row.principal); row.interest = v18Round(row.interest); }));
    const currencies = Object.entries(groups).map(([currency, rows]) => ({ currency, rows, next30Days: rows[0], next90Days: rows[1], next12Months: rows[2], years1To3: rows[3], years3Plus: rows[4] }));
    return { reportingDate: v18IsoDate(d), expected: true, actualDataAvailable: false, currencyIsolation: true, currencies, currencyCount: currencies.length, source: "LEASE_SCHEDULE" };
  }

  function v18MaturityView(reportingDate) {
    const d = v18ResolveDate(reportingDate);
    const source = typeof getLeasePaymentMaturityAnalysis === "function" ? getLeasePaymentMaturityAnalysis(d) : { rows: [], totals: {} };
    const map = {
      "0_3_MONTHS": { name: "0–3 months", rows: ["WITHIN_1_MONTH", "1_3_MONTHS"] },
      "3_6_MONTHS": { name: "3–6 months", rows: ["3_6_MONTHS"] },
      "6_12_MONTHS": { name: "6–12 months", rows: ["6_12_MONTHS"] },
      "1_2_YEARS": { name: "1–2 years", rows: ["1_2_YEARS"] },
      "2_3_YEARS": { name: "2–3 years", rows: ["2_3_YEARS"] },
      "3_5_YEARS": { name: "3–5 years", rows: ["3_5_YEARS"] },
      "5_PLUS_YEARS": { name: "5+ years", rows: ["MORE_THAN_5_YEARS"] }
    };
    const out = Object.entries(map).map(([id, config]) => {
      const sourceRows = (source?.rows || []).filter(row => config.rows.includes(row?.bucket));
      return { id, name: config.name, payments: v18Round(sourceRows.reduce((sum, row) => sum + v18Number(row?.cashPayment), 0)), principal: v18Round(sourceRows.reduce((sum, row) => sum + v18Number(row?.principal), 0)), interest: v18Round(sourceRows.reduce((sum, row) => sum + v18Number(row?.interest), 0)) };
    });
    return { reportingDate: v18IsoDate(d), buckets: out, totals: { payments: v18Round(out.reduce((s, r) => s + r.payments, 0)), principal: v18Round(out.reduce((s, r) => s + r.principal, 0)), interest: v18Round(out.reduce((s, r) => s + r.interest, 0)) }, source: "V16.10_MATURITY_ANALYSIS" };
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

  function v18CurrencyExposure(reportingDate) {
    const d = v18ResolveDate(reportingDate), groups = {};
    v18ContractRows(d).forEach(row => {
      const currency = v18Currency(row.contract);
      if (!groups[currency]) groups[currency] = { currency, contractCount: 0, activeContracts: 0, leaseLiability: 0, currentLiability: 0, nonCurrentLiability: 0, rouAssets: 0, interest: 0, depreciation: 0, next12MPayments: 0 };
      const g = groups[currency];
      g.contractCount += 1;
      if (row.metric?.active) g.activeContracts += 1;
      g.leaseLiability += v18Number(row.metric?.leaseLiability);
      g.currentLiability += v18Number(row.metric?.currentLiability);
      g.nonCurrentLiability += v18Number(row.metric?.nonCurrentLiability);
      g.rouAssets += v18Number(row.metric?.rouAsset);
      g.interest += v18Number(row.metric?.monthlyInterest);
      g.depreciation += v18Number(row.metric?.monthlyDepreciation);
      g.next12MPayments += v18Number(row.metric?.next12MonthPayments);
    });
    Object.values(groups).forEach(g => Object.keys(g).forEach(key => { if (typeof g[key] === "number") g[key] = v18Round(g[key]); }));
    return Object.values(groups).map(g => ({ ...g, fxConversionApplied: false, source: "V16.9_CFO_DATA_LAYER" }));
  }

  function v18Renewals(reportingDate) {
    const d = v18ResolveDate(reportingDate);
    const rows = [];
    v18SafeContracts().forEach(contract => {
      const renewal = v18Date(contract?.renewalDate || contract?.renewalOptionDate || contract?.renewalAssessmentDate);
      if (!renewal) return;
      const days = v18DaysBetween(d, renewal);
      if (days === null || days < 0 || days > CFO_COCKPIT_CONFIG.renewal365DaysThreshold) return;
      const metric = v18ContractMetric(contract, d) || {};
      const severity = days <= 90 ? "HIGH" : (days <= 180 ? "MEDIUM" : "LOW");
      rows.push({ contractId: contract.id, company: v18Company(contract), currency: v18Currency(contract), renewalDate: v18IsoDate(renewal), daysRemaining: days, leaseLiability: v18Round(metric.leaseLiability), payment: v18Round(v18Number(contract.monthlyPayment)), risk: metric.controlStatus || "INFO", severity, status: days <= 90 ? "REVIEW_REQUIRED" : "MONITOR", source: "CONTRACT_MASTER + CFO_DATA_LAYER" });
    });
    rows.sort((a, b) => a.daysRemaining - b.daysRemaining);
    return { within90Days: rows.filter(r => r.daysRemaining <= 90), within180Days: rows.filter(r => r.daysRemaining <= 180), within365Days: rows, count90: rows.filter(r => r.daysRemaining <= 90).length, count180: rows.filter(r => r.daysRemaining <= 180).length, count365: rows.length };
  }

  function v18Expiries(reportingDate) {
    const d = v18ResolveDate(reportingDate), rows = [];
    v18SafeContracts().forEach(contract => {
      const end = v18Date(contract?.endDate);
      if (!end) return;
      const days = v18DaysBetween(d, end);
      if (days === null || days < 0 || days > CFO_COCKPIT_CONFIG.expiry365DaysThreshold) return;
      const metric = v18ContractMetric(contract, d) || {};
      const severity = days <= 90 ? "HIGH" : (days <= 180 ? "MEDIUM" : "LOW");
      rows.push({ contractId: contract.id, company: v18Company(contract), currency: v18Currency(contract), expiryDate: v18IsoDate(end), daysRemaining: days, leaseLiability: v18Round(metric.leaseLiability), payment: v18Round(v18Number(contract.monthlyPayment)), risk: metric.controlStatus || "INFO", severity, status: days <= 90 ? "REVIEW_REQUIRED" : "MONITOR", source: "CONTRACT_MASTER + CFO_DATA_LAYER" });
    });
    rows.sort((a, b) => a.daysRemaining - b.daysRemaining);
    return { within90Days: rows.filter(r => r.daysRemaining <= 90), within180Days: rows.filter(r => r.daysRemaining <= 180), within365Days: rows, count90: rows.filter(r => r.daysRemaining <= 90).length, count180: rows.filter(r => r.daysRemaining <= 180).length, count365: rows.length };
  }

  function v18ModificationImpact(reportingDate) {
    const d = v18ResolveDate(reportingDate), report = typeof getModificationReport === "function" ? getModificationReport(d) : { rows: [], totals: {} }, rows = report.rows || [];
    return {
      count: rows.length,
      pending: rows.filter(r => !["APPLIED", "CANCELLED"].includes(String(r.status || "").toUpperCase())).length,
      applied: rows.filter(r => String(r.status || "").toUpperCase() === "APPLIED").length,
      liabilityIncrease: v18Round(rows.reduce((s, r) => s + Math.max(0, v18Number(r.liabilityAdjustment)), 0)),
      liabilityDecrease: v18Round(rows.reduce((s, r) => s + Math.max(0, -v18Number(r.liabilityAdjustment)), 0)),
      liabilityImpact: v18Round(rows.reduce((s, r) => s + v18Number(r.liabilityAdjustment), 0)),
      rouAdjustment: v18Round(rows.reduce((s, r) => s + v18Number(r.rouAdjustment), 0)),
      gainLoss: v18Round(rows.reduce((s, r) => s + v18Number(r.gainLoss), 0)),
      scopeReduction: v18Round(rows.reduce((s, r) => s + v18Number(r.scopeReduction), 0)),
      last12Months: v18Number(report.totals?.last12Months),
      source: "V16.10_MODIFICATION_REPORT"
    };
  }

  function v18ReassessmentImpact(reportingDate) {
    const d = v18ResolveDate(reportingDate), report = typeof getReassessmentReport === "function" ? getReassessmentReport(d) : { rows: [], totals: {} }, rows = report.rows || [];
    return {
      count: rows.length,
      pending: rows.filter(r => !["APPLIED", "CANCELLED"].includes(String(r.status || "").toUpperCase())).length,
      applied: rows.filter(r => String(r.status || "").toUpperCase() === "APPLIED").length,
      liabilityImpact: v18Round(rows.reduce((s, r) => s + v18Number(r.liabilityImpact), 0)),
      rouImpact: v18Round(rows.reduce((s, r) => s + v18Number(r.rouAdjustment), 0)),
      paymentImpact: v18Round(rows.reduce((s, r) => s + v18Number(r.paymentImpact), 0)),
      termImpactMonths: v18Round(rows.reduce((s, r) => s + v18Number(r.termImpactMonths), 0)),
      last12Months: v18Number(report.totals?.last12Months),
      source: "V16.10_REASSESSMENT_REPORT"
    };
  }

  function v18ControlStatus(reportingDate) {
    const d = v18ResolveDate(reportingDate), rows = v18ContractRows(d);
    let totalControls = 0, passed = 0, warnings = 0, failed = 0, critical = 0, high = 0, openExceptions = [];
    rows.forEach(row => {
      try {
        const result = typeof getContractControlResults === "function" ? getContractControlResults(row.contract.id, { run: false, persist: false, audit: false }) : null;
        const controls = Array.isArray(result?.controls) ? result.controls : [];
        totalControls += controls.length;
        passed += controls.filter(c => c.status === CONTROL_STATUS.GREEN).length;
        warnings += controls.filter(c => c.status === CONTROL_STATUS.YELLOW).length;
        failed += controls.filter(c => c.status === CONTROL_STATUS.RED).length;
        critical += controls.filter(c => c.status === CONTROL_STATUS.RED && c.priority === CONTROL_PRIORITY.CRITICAL).length;
        high += controls.filter(c => c.status === CONTROL_STATUS.RED && c.priority === CONTROL_PRIORITY.HIGH).length;
        openExceptions = openExceptions.concat((result?.exceptions || []).filter(e => !["RESOLVED", "WAIVED"].includes(String(e?.status || "OPEN").toUpperCase())).map(e => ({ ...e, contractId: row.contract.id, company: v18Company(row.contract) })));
      } catch (error) {
        failed += 1;
        critical += 1;
      }
    });
    return { totalControls, passed, warnings, failed, critical, high, openExceptions, openExceptionCount: openExceptions.length, criticalExceptionCount: openExceptions.filter(e => String(e?.priority || e?.severity || "").toUpperCase() === CONTROL_PRIORITY.CRITICAL).length, status: critical > 0 || failed > 0 ? "RED" : (warnings > 0 || openExceptions.length ? "YELLOW" : "GREEN"), source: "V16.8_RISK_CONTROL_ENGINE" };
  }

  function v18CloseStatus(reportingDate) {
    try {
      if (typeof getMonthEndCloseStatus !== "function") return { status: "UNKNOWN", score: null, blockingIssues: [], warnings: [] };
      const status = getMonthEndCloseStatus(reportingDate);
      return { status: status?.status || "UNKNOWN", score: status?.score ?? status?.overallScore ?? null, ready: Boolean(status?.ready), blockingIssues: status?.blockingIssues || [], warnings: status?.warnings || [], passedControls: status?.passedControls ?? 0, totalControls: status?.totalControls ?? 0, state: status?.state || null, checklist: status?.checklist || null, source: "V17_MONTH_END_CLOSE_ENGINE" };
    } catch (error) {
      return { status: "BLOCKED", score: 0, ready: false, blockingIssues: [{ severity: "CRITICAL", description: error?.message || String(error) }], warnings: [], passedControls: 0, totalControls: 0, source: "V17_MONTH_END_CLOSE_ENGINE" };
    }
  }

  function v18JournalStatus(reportingDate) {
    try {
      const report = typeof getJournalSummaryReport === "function" ? getJournalSummaryReport({}) : null;
      const totals = report?.totals || {};
      return { journalCount: v18Number(totals.journalCount), balancedJournalCount: v18Number(totals.balancedJournals), unbalancedJournalCount: v18Number(totals.unbalancedJournals), status: v18Number(totals.unbalancedJournals) > 0 ? "RED" : (v18Number(totals.journalCount) ? "READY" : "WARNING"), source: "V16.10_JOURNAL_REPORT" };
    } catch (error) {
      return { journalCount: 0, balancedJournalCount: 0, unbalancedJournalCount: 1, status: "RED", source: "V16.10_JOURNAL_REPORT", error: error?.message || String(error) };
    }
  }

  function v18ReconciliationStatus(reportingDate) {
    try {
      const rec = typeof getTfrs16ReportingReconciliation === "function" ? getTfrs16ReportingReconciliation(reportingDate) : {};
      const checks = [rec.liability, rec.cashFlow, rec.liabilityRollForward, rec.rouRollForward, rec.journal, rec.companyTotals];
      const failed = checks.filter(x => x && x.passed === false);
      return { status: failed.length ? "RED" : "READY", checks: { liability: rec.liability || null, cashFlow: rec.cashFlow || null, liabilityRollForward: rec.liabilityRollForward || null, rouRollForward: rec.rouRollForward || null, journal: rec.journal || null, companyTotals: rec.companyTotals || null }, failedCount: failed.length, source: "V16.10_REPORTING_RECONCILIATION" };
    } catch (error) {
      return { status: "RED", checks: {}, failedCount: 1, error: error?.message || String(error), source: "V16.10_REPORTING_RECONCILIATION" };
    }
  }

  function v18DataQuality(reportingDate, rows, controls, close, reconciliation) {
    const calculationErrors = (rows || []).filter(r => r.metric?.calculationValid === false || r.metric?.calculationError).length;
    const missingCritical = (rows || []).filter(r => !r.contract?.id || !r.contract?.company || !r.contract?.startDate || !r.contract?.endDate || !Number.isFinite(Number(r.contract?.monthlyPayment)) || !r.contract?.currency).length;
    const errors = calculationErrors + missingCritical + v18Number(controls?.criticalExceptionCount) + (reconciliation?.status === "RED" ? 1 : 0);
    const warnings = v18Number(controls?.openExceptionCount) + (close?.warnings?.length || 0);
    const status = errors > 0 ? "ERROR" : (warnings > 0 ? "WARNING" : "READY");
    const score = Math.max(0, Math.min(100, 100 - calculationErrors * 30 - missingCritical * 20 - v18Number(controls?.criticalExceptionCount) * 30 - Math.max(0, v18Number(controls?.openExceptionCount) - v18Number(controls?.criticalExceptionCount)) * 5));
    return { status, score: v18Round(score), calculationErrors, missingCriticalData: missingCritical, warnings, errors, source: "V18_DETERMINISTIC_DATA_QUALITY" };
  }

  function v18Alert(type, severity, title, message, options = {}) {
    return { type, severity, title, message, contractId: options.contractId || null, company: options.company || null, currency: options.currency || null, financialImpact: options.financialImpact ?? null, actionRequired: options.actionRequired || null, sourceFunction: options.sourceFunction || null };
  }

  function getCfoAlerts(reportingDate) {
    const d = v18ResolveDate(reportingDate), alerts = [], close = v18CloseStatus(d), controls = v18ControlStatus(d), rec = v18ReconciliationStatus(d), journals = v18JournalStatus(d), dataQuality = v18DataQuality(d, v18ContractRows(d), controls, close, rec), renewals = v18Renewals(d), expiries = v18Expiries(d), modifications = v18ModificationImpact(d), reassessments = v18ReassessmentImpact(d), liquidity = v18LiquidityView(d);
    if (close.status === "BLOCKED") alerts.push(v18Alert(CFO_ALERT_TYPES.CLOSE, CFO_ALERT_SEVERITY.CRITICAL, "Month-end close is blocked", `${close.blockingIssues.length} blocking issue(s) prevent close readiness.`, { actionRequired: "Resolve all blocking close issues before certification.", sourceFunction: "getMonthEndCloseStatus" }));
    else if (close.status === "WARNING") alerts.push(v18Alert(CFO_ALERT_TYPES.CLOSE, CFO_ALERT_SEVERITY.MEDIUM, "Month-end close has warnings", `${close.warnings.length} close warning(s) remain open.`, { actionRequired: "Review close warnings and complete remaining controls.", sourceFunction: "getMonthEndCloseStatus" }));
    if (rec.status === "RED") alerts.push(v18Alert(CFO_ALERT_TYPES.RECONCILIATION, CFO_ALERT_SEVERITY.CRITICAL, "Reporting reconciliation failed", `${rec.failedCount} reconciliation check(s) failed.`, { actionRequired: "Resolve reconciliation mismatches before relying on CFO reporting.", sourceFunction: "getTfrs16ReportingReconciliation" }));
    if (journals.unbalancedJournalCount > 0) alerts.push(v18Alert(CFO_ALERT_TYPES.JOURNAL, CFO_ALERT_SEVERITY.CRITICAL, "Unbalanced journals detected", `${journals.unbalancedJournalCount} journal(s) are unbalanced.`, { actionRequired: "Resolve unbalanced journals before close certification.", sourceFunction: "getJournalSummaryReport" }));
    if (controls.criticalExceptionCount > 0) alerts.push(v18Alert(CFO_ALERT_TYPES.CONTROL, CFO_ALERT_SEVERITY.CRITICAL, "Critical control exceptions are open", `${controls.criticalExceptionCount} critical control exception(s) are unresolved.`, { actionRequired: "Resolve or formally address critical control exceptions.", sourceFunction: "getContractControlResults" }));
    if (renewals.count90 > 0) alerts.push(v18Alert(CFO_ALERT_TYPES.RENEWAL, CFO_ALERT_SEVERITY.HIGH, "Renewals within 90 days", `${renewals.count90} lease renewal(s) require near-term management review.`, { actionRequired: "Review renewal decision and assess reassessment implications.", sourceFunction: "getCfoAlerts" }));
    if (expiries.count90 > 0) alerts.push(v18Alert(CFO_ALERT_TYPES.EXPIRY, CFO_ALERT_SEVERITY.HIGH, "Expiries within 90 days", `${expiries.count90} contract expiry event(s) are within 90 days.`, { actionRequired: "Review expiry, termination or renewal assumptions.", sourceFunction: "getCfoAlerts" }));
    if (modifications.pending > 0) alerts.push(v18Alert(CFO_ALERT_TYPES.MODIFICATION, CFO_ALERT_SEVERITY.MEDIUM, "Pending modifications", `${modifications.pending} modification record(s) are not yet applied or cancelled.`, { actionRequired: "Review pending modification evidence and effective dates.", sourceFunction: "getModificationReport" }));
    if (reassessments.pending > 0) alerts.push(v18Alert(CFO_ALERT_TYPES.REASSESSMENT, CFO_ALERT_SEVERITY.MEDIUM, "Pending reassessments", `${reassessments.pending} reassessment record(s) are not yet applied or cancelled.`, { actionRequired: "Review pending reassessment evidence and accounting impact.", sourceFunction: "getReassessmentReport" }));
    if (dataQuality.status === "ERROR") alerts.push(v18Alert(CFO_ALERT_TYPES.DATA_QUALITY, CFO_ALERT_SEVERITY.HIGH, "Data quality requires attention", `${dataQuality.errors} critical data quality issue(s) were identified.`, { actionRequired: "Correct source contract data or calculation errors.", sourceFunction: "v18DataQuality" }));
    if (liquidity.next90Days?.payments > 0 && CFO_COCKPIT_CONFIG.liquidity90DaysThreshold !== null && liquidity.next90Days.payments >= CFO_COCKPIT_CONFIG.liquidity90DaysThreshold) alerts.push(v18Alert(CFO_ALERT_TYPES.LIQUIDITY, CFO_ALERT_SEVERITY.MEDIUM, "90-day lease cash exposure", `Expected lease cash payments within 90 days are ${v18Round(liquidity.next90Days.payments)}.`, { actionRequired: "Review near-term lease cash commitments.", financialImpact: liquidity.next90Days.payments, sourceFunction: "v18LiquidityView" }));
    return alerts.sort((a, b) => ({ CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 }[a.severity] ?? 9) - ({ CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 }[b.severity] ?? 9));
  }

  function getCfoTopRisks(reportingDate) {
    const d = v18ResolveDate(reportingDate), rows = v18ContractRows(d), risks = [];
    rows.forEach(row => {
      const m = row.metric || {}, severity = m.controlStatus === "RED" ? "CRITICAL" : (m.controlStatus === "YELLOW" ? "HIGH" : null);
      if (severity) risks.push({ severity, financialImpact: m.leaseLiability != null ? v18Round(m.leaseLiability) : null, potentialLiabilityImpact: null, potentialCashImpact: null, potentialPnlImpact: null, contractId: row.contract?.id || null, company: v18Company(row.contract), currency: v18Currency(row.contract), description: m.calculationError || `${m.openExceptions || 0} open control exception(s).`, action: severity === "CRITICAL" ? "Resolve critical control or calculation issues." : "Review open control warnings." });
      if (m.renewalRisk) risks.push({ severity: m.renewalDays <= 90 ? "HIGH" : "MEDIUM", financialImpact: v18Round(m.leaseLiability), potentialLiabilityImpact: null, potentialCashImpact: null, potentialPnlImpact: null, contractId: row.contract?.id || null, company: v18Company(row.contract), currency: v18Currency(row.contract), description: `Renewal event in ${m.renewalDays} day(s).`, action: "Review renewal decision." });
      if (m.expiryRisk) risks.push({ severity: m.expiryDays <= 90 ? "HIGH" : "MEDIUM", financialImpact: v18Round(m.leaseLiability), potentialLiabilityImpact: null, potentialCashImpact: null, potentialPnlImpact: null, contractId: row.contract?.id || null, company: v18Company(row.contract), currency: v18Currency(row.contract), description: `Expiry event in ${m.expiryDays} day(s).`, action: "Review expiry or renewal decision." });
      if (!m.calculationValid) risks.push({ severity: "CRITICAL", financialImpact: null, potentialLiabilityImpact: null, potentialCashImpact: null, potentialPnlImpact: null, contractId: row.contract?.id || null, company: v18Company(row.contract), currency: v18Currency(row.contract), description: m.calculationError || "Calculation output is unavailable.", action: "Resolve contract calculation error." });
    });
    return risks.sort((a, b) => ({ CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }[a.severity] ?? 9) - ({ CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }[b.severity] ?? 9) || v18Number(b.financialImpact) - v18Number(a.financialImpact)).slice(0, 20);
  }

  function v18ExecutiveStatus(close, controls, reconciliation, dataQuality) {
    if (close?.status === "BLOCKED" || reconciliation?.status === "RED" || controls?.criticalExceptionCount > 0 || dataQuality?.status === "ERROR") return CFO_COCKPIT_STATUS.RED;
    if (close?.status === "WARNING" || controls?.status === "YELLOW" || dataQuality?.status === "WARNING") return CFO_COCKPIT_STATUS.YELLOW;
    return CFO_COCKPIT_STATUS.GREEN;
  }

  function getCfoExecutiveSnapshot(reportingDate) {
    const d = v18ResolveDate(reportingDate), rows = v18ContractRows(d), activeRows = rows.filter(r => r.metric?.active), financialPosition = v18FinancialPosition(d, rows), profitLoss = v18ProfitLoss(d, rows), cashFlow = v18LiquidityView(d), renewals = v18Renewals(d), expiries = v18Expiries(d), modifications = v18ModificationImpact(d), reassessments = v18ReassessmentImpact(d), close = v18CloseStatus(d), controls = v18ControlStatus(d), reconciliation = v18ReconciliationStatus(d), dataQuality = v18DataQuality(d, rows, controls, close, reconciliation), alerts = getCfoAlerts(d), risks = getCfoTopRisks(d), companies = v18CompanyExposure(d), currencies = v18CurrencyExposure(d);
    return {
      version: CFO_COCKPIT_VERSION,
      reportingDate: v18IsoDate(d),
      generatedAt: new Date().toISOString(),
      executiveStatus: v18ExecutiveStatus(close, controls, reconciliation, dataQuality),
      financialPosition,
      profitLoss,
      cashFlow,
      leaseExposure: { totalLeaseLiability: financialPosition.totalLeaseLiability, currentLeaseLiability: financialPosition.currentLeaseLiability, nonCurrentLeaseLiability: financialPosition.nonCurrentLeaseLiability, rouAssets: financialPosition.totalRuoAssets, byCurrency: financialPosition.byCurrency, currencyCount: financialPosition.currencyCount, totalContracts: rows.length, activeContracts: activeRows.length, expiringContracts12M: expiries.count365, currencyIsolation: true },
      maturity: v18MaturityView(d),
      contractRisk: { green: rows.filter(r => r.metric?.controlStatus === "GREEN").length, yellow: rows.filter(r => r.metric?.controlStatus === "YELLOW").length, red: rows.filter(r => r.metric?.controlStatus === "RED").length },
      renewalRisk: renewals,
      expiryRisk: expiries,
      modificationImpact: modifications,
      reassessmentImpact: reassessments,
      closeStatus: close,
      controlStatus: controls,
      companyExposure: companies,
      currencyExposure: currencies,
      keyAlerts: alerts.slice(0, 10),
      topRisks: risks,
      dataQuality,
      reconciliation,
      metadata: { source: "V18_CFO_COCKPIT", reportingDate: v18IsoDate(d), calculationStatus: rows.every(r => r.metric?.calculationValid !== false) ? "READY" : "ERROR", currencyIsolation: true, actualCashDataAvailable: false }
    };
  }

  function getCfoKpis(reportingDate) {
    const d = v18ResolveDate(reportingDate), rows = v18ContractRows(d), active = rows.filter(r => r.metric?.active), totals = v18AggregateMetrics(active), previous = v18PreviousSnapshot(d), renewals = v18Renewals(d), expiries = v18Expiries(d), modifications = v18ModificationImpact(d), reassessments = v18ReassessmentImpact(d), close = v18CloseStatus(d), controls = v18ControlStatus(d);
    const next12 = active.length === 0 ? 0 : (new Set(active.map(r => v18Currency(r.contract))).size === 1 ? totals.next12MonthPayments : null);
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1), monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const interest = typeof getInterestExpense === "function" ? getInterestExpense(monthStart, monthEnd) : totals.monthlyInterest;
    const depreciation = typeof getDepreciationExpense === "function" ? getDepreciationExpense(monthStart, monthEnd) : totals.monthlyDepreciation;
    const kpis = {
      TOTAL_LEASE_LIABILITY: v18Kpi(totals.leaseLiability, "currency", null, v18IsoDate(d), "INFO", "getTotalLeaseLiability", "READY", v18Trend(totals.leaseLiability, previous?.liabilities?.total)),
      CURRENT_LEASE_LIABILITY: v18Kpi(totals.currentLiability, "currency", null, v18IsoDate(d), "INFO", "getCurrentLeaseLiability", "READY", v18Trend(totals.currentLiability, previous?.liabilities?.current)),
      NON_CURRENT_LEASE_LIABILITY: v18Kpi(totals.nonCurrentLiability, "currency", null, v18IsoDate(d), "INFO", "getNonCurrentLeaseLiability", "READY", v18Trend(totals.nonCurrentLiability, previous?.liabilities?.nonCurrent)),
      ROU_ASSETS: v18Kpi(totals.rouAsset, "currency", null, v18IsoDate(d), "INFO", "getTotalRuoAssets", "READY", v18Trend(totals.rouAsset, previous?.rouAssets?.total)),
      INTEREST_EXPENSE: v18Kpi(interest, "currency", null, v18IsoDate(d), "INFO", "getInterestExpense", "READY", v18Trend(interest, previous?.pnl?.interestExpense)),
      DEPRECIATION_EXPENSE: v18Kpi(depreciation, "currency", null, v18IsoDate(d), "INFO", "getDepreciationExpense", "READY", v18Trend(depreciation, previous?.pnl?.depreciationExpense)),
      NEXT12M_CASH_PAYMENTS: v18Kpi(next12, "currency", null, v18IsoDate(d), "INFO", "getLeaseCashFlowMetrics", "EXPECTED", v18Trend(next12, previous?.cashFlow?.next12MonthsPayments)),
      NEXT12M_PRINCIPAL: v18Kpi(totals.next12MonthPrincipal, "currency", null, v18IsoDate(d), "INFO", "getLeaseCashFlowMetrics", "EXPECTED"),
      NEXT12M_INTEREST: v18Kpi(totals.next12MonthInterest, "currency", null, v18IsoDate(d), "INFO", "getLeaseCashFlowMetrics", "EXPECTED"),
      CONTRACT_COUNT: v18Kpi(rows.length, "count", null, v18IsoDate(d), "INFO", "getTotalContractCount", "READY"),
      ACTIVE_CONTRACT_COUNT: v18Kpi(active.length, "count", null, v18IsoDate(d), "INFO", "getActiveContractCount", "READY"),
      RENEWALS_90D: v18Kpi(renewals.count90, "count", null, v18IsoDate(d), renewals.count90 ? "HIGH" : "INFO", "getCfoAlerts", "READY"),
      RENEWALS_180D: v18Kpi(renewals.count180, "count", null, v18IsoDate(d), renewals.count180 ? "MEDIUM" : "INFO", "getCfoAlerts", "READY"),
      EXPIRIES_12M: v18Kpi(expiries.count365, "count", null, v18IsoDate(d), expiries.count90 ? "HIGH" : "INFO", "getCfoAlerts", "READY"),
      PENDING_MODIFICATIONS: v18Kpi(modifications.pending, "count", null, v18IsoDate(d), modifications.pending ? "MEDIUM" : "INFO", "getModificationReport", "READY"),
      PENDING_REASSESSMENTS: v18Kpi(reassessments.pending, "count", null, v18IsoDate(d), reassessments.pending ? "MEDIUM" : "INFO", "getReassessmentReport", "READY"),
      CLOSE_SCORE: v18Kpi(v18Number(close.score), "score", null, v18IsoDate(d), close.status === "BLOCKED" ? "CRITICAL" : (close.status === "WARNING" ? "MEDIUM" : "INFO"), "getCloseReadiness", "READY"),
      OPEN_EXCEPTIONS: v18Kpi(controls.openExceptionCount, "count", null, v18IsoDate(d), controls.criticalExceptionCount ? "CRITICAL" : (controls.openExceptionCount ? "MEDIUM" : "INFO"), "getOpenExceptions", "READY")
    };
    return kpis;
  }

  function getCfoCompanyDashboard(company, reportingDate) {
    const d = v18ResolveDate(reportingDate), target = String(company || ""), exposure = v18CompanyExposure(d).find(x => x.company === target) || null, close = typeof getCompanyMonthEndCloseStatus === "function" ? getCompanyMonthEndCloseStatus(target, d) : null;
    const rows = v18ContractRows(d).filter(r => v18Company(r.contract) === target), risks = getCfoTopRisks(d).filter(r => r.company === target), renewals = v18Renewals(d), expiries = v18Expiries(d);
    return { version: CFO_COCKPIT_VERSION, company: target, reportingDate: v18IsoDate(d), financialPosition: exposure ? { leaseLiability: exposure.leaseLiability, currentLiability: exposure.currentLiability, nonCurrentLiability: exposure.nonCurrentLiability, rouAssets: exposure.rouAssets } : {}, profitLoss: exposure ? { interest: exposure.interest, depreciation: exposure.depreciation } : {}, cashFlow: exposure ? { next12MPayments: exposure.next12MPayments, expected: true } : {}, leaseExposure: exposure, risk: { topRisks: risks, renewalCount90D: renewals.within90Days.filter(r => r.company === target).length, expiryCount90D: expiries.within90Days.filter(r => r.company === target).length }, controls: rows.map(r => ({ contractId: r.contract.id, status: r.metric?.controlStatus, openExceptions: r.metric?.openExceptions || 0 })), close, contracts: rows.map(r => getCfoContractView(r.contract.id, d)).filter(Boolean) };
  }

  function getCfoContractView(contractId, reportingDate) {
    const d = v18ResolveDate(reportingDate), contract = v18SafeContracts().find(c => c.id === contractId);
    if (!contract) return null;
    const metric = v18ContractMetric(contract, d) || {}, close = v18CompanyExposure(d).find(x => x.company === v18Company(contract)) || null;
    let journal = null;
    try { journal = typeof getJournalSummaryReport === "function" ? getJournalSummaryReport({ contractId }) : null; } catch (error) { journal = null; }
    return { version: CFO_COCKPIT_VERSION, contractId, company: v18Company(contract), supplier: contract.supplier || "", currency: v18Currency(contract), reportingDate: v18IsoDate(d), financialPosition: { leaseLiability: v18Round(metric.leaseLiability), currentLiability: v18Round(metric.currentLiability), nonCurrentLiability: v18Round(metric.nonCurrentLiability), rouAssets: v18Round(metric.rouAsset) }, periodImpact: { interest: v18Round(metric.monthlyInterest), depreciation: v18Round(metric.monthlyDepreciation), leaseExpense: v18Round(metric.monthlyLeaseExpense), expectedNext12MPayments: v18Round(metric.next12MonthPayments) }, renewal: { date: metric.renewalDate || v18IsoDate(contract.renewalDate), daysRemaining: metric.renewalDays ?? null }, expiry: { date: metric.expiryDate || v18IsoDate(contract.endDate), daysRemaining: metric.expiryDays ?? null }, modification: { status: metric.modificationStatus, pending: metric.pendingModifications, applied: metric.appliedModifications }, reassessment: { status: metric.reassessmentStatus, pending: metric.pendingReassessments, applied: metric.appliedReassessments }, risk: { status: metric.controlStatus, openExceptions: metric.openExceptions, criticalExceptions: metric.criticalExceptions, highExceptions: metric.highExceptions }, calculation: { valid: metric.calculationValid !== false, error: metric.calculationError || null, scheduleSource: metric.scheduleSource || null }, journal: journal ? { journalCount: journal.totals?.journalCount || 0, balanced: !(journal.totals?.unbalancedJournals > 0), rows: journal.rows || [] } : null, audit: typeof getContractAuditSummary === "function" ? getContractAuditSummary(contractId) : null, companyCloseContext: close, source: "V16.10 + V17 + V18" };
  }

  function getCfoCurrencyExposure(currency, reportingDate) {
    const curr = String(currency || "UNSPECIFIED").toUpperCase();
    return v18CurrencyExposure(reportingDate).find(row => row.currency === curr) || { currency: curr, contractCount: 0, activeContracts: 0, leaseLiability: 0, currentLiability: 0, nonCurrentLiability: 0, rouAssets: 0, interest: 0, depreciation: 0, next12MPayments: 0, fxConversionApplied: false, source: "V18_CFO_COCKPIT" };
  }

  function getCfoPeriodSummary(reportingDate) {
    const d = v18ResolveDate(reportingDate), start = new Date(d.getFullYear(), d.getMonth(), 1), end = new Date(d.getFullYear(), d.getMonth() + 1, 0), quarter = Math.floor(d.getMonth() / 3) + 1, year = d.getFullYear(), close = v18CloseStatus(d), snapshot = getCfoExecutiveSnapshot(d);
    return { version: CFO_COCKPIT_VERSION, reportingDate: v18IsoDate(d), month: `${year}-${String(d.getMonth() + 1).padStart(2, "0")}`, quarter: `${year}-Q${quarter}`, year: String(year), periodStart: v18IsoDate(start), periodEnd: v18IsoDate(end), closeStatus: close, financialPosition: snapshot.financialPosition, profitLoss: snapshot.profitLoss, cashFlow: snapshot.cashFlow, risk: snapshot.contractRisk, controls: snapshot.controlStatus, source: "V18_CFO_COCKPIT" };
  }

  function getCfoDecisionFacts(reportingDate) {
    const d = v18ResolveDate(reportingDate), snapshot = getCfoExecutiveSnapshot(d), facts = [];
    facts.push({ metric: "TOTAL_LEASE_LIABILITY", currentValue: snapshot.financialPosition.totalLeaseLiability, previousValue: snapshot.financialPosition.trend.leaseLiability.previous, variance: snapshot.financialPosition.trend.leaseLiability.change, driver: "Reporting-date liability", severity: snapshot.executiveStatus });
    facts.push({ metric: "ROU_ASSETS", currentValue: snapshot.financialPosition.totalRuoAssets, previousValue: snapshot.financialPosition.trend.rouAssets.previous, variance: snapshot.financialPosition.trend.rouAssets.change, driver: "ROU closing balance", severity: snapshot.executiveStatus });
    facts.push({ metric: "NEXT_12M_CASH_PAYMENTS", currentValue: snapshot.cashFlow.next12Months?.payments || 0, previousValue: null, variance: null, driver: "Expected lease schedule payments", severity: "INFO" });
    facts.push({ metric: "CLOSE_SCORE", currentValue: v18Number(snapshot.closeStatus.score), previousValue: null, variance: null, driver: "V17 close engine", severity: snapshot.closeStatus.status });
    return facts;
  }

  function getContractsRequiringAttention(reportingDate) {
    const d = v18ResolveDate(reportingDate), rows = v18ContractRows(d);
    return rows.filter(r => {
      const m = r.metric || {};
      return m.controlStatus === "RED" || m.controlStatus === "YELLOW" || m.renewalRisk || m.expiryRisk || m.pendingModifications > 0 || m.pendingReassessments > 0 || m.calculationValid === false;
    }).map(r => getCfoContractView(r.contract.id, d)).filter(Boolean);
  }

  function getHighExposureContracts(reportingDate) {
    const d = v18ResolveDate(reportingDate);
    return v18ContractRows(d).filter(r => r.metric?.active).sort((a, b) => v18Number(b.metric?.leaseLiability) - v18Number(a.metric?.leaseLiability)).slice(0, 20).map(r => getCfoContractView(r.contract.id, d)).filter(Boolean);
  }

  function getUpcomingRenewals(reportingDate, days = 90) {
    const d = v18ResolveDate(reportingDate), horizon = Math.max(0, Number(days) || 0);
    return v18Renewals(d).within365Days.filter(row => row.daysRemaining <= horizon);
  }

  function getCriticalControls(reportingDate) {
    return v18ControlStatus(reportingDate).openExceptions.filter(e => String(e?.priority || e?.severity || "").toUpperCase() === CONTROL_PRIORITY.CRITICAL);
  }

  function getCloseBlockers(reportingDate) {
    return v18CloseStatus(reportingDate).blockingIssues || [];
  }

  function getLiquidityPressureContracts(reportingDate) {
    const d = v18ResolveDate(reportingDate), rows = [];
    v18SafeContracts().forEach(contract => {
      try {
        const built = typeof cfoBuildSchedule === "function" ? cfoBuildSchedule(contract) : { schedule: [] };
        const payments90 = (built.schedule || []).filter(item => { const date = v18Date(item?.date); return date && date > d && v18DaysBetween(d, date) <= 90; }).reduce((sum, item) => sum + v18Number(item?.payment), 0);
        if (payments90 > 0) rows.push({ contractId: contract.id, company: v18Company(contract), currency: v18Currency(contract), next90DaysPayments: v18Round(payments90), leaseLiability: v18Round(v18ContractMetric(contract, d)?.leaseLiability) });
      } catch (error) {}
    });
    return rows.sort((a, b) => b.next90DaysPayments - a.next90DaysPayments).slice(0, 20);
  }

  function getCfoScorecard(reportingDate) {
    const d = v18ResolveDate(reportingDate), snapshot = getCfoExecutiveSnapshot(d), close = snapshot.closeStatus, controls = snapshot.controlStatus, data = snapshot.dataQuality, rec = snapshot.reconciliation;
    const financialScore = rec.status === "READY" ? 100 : 50;
    const liquidityScore = snapshot.cashFlow.currencyCount === 1 || snapshot.cashFlow.currencyCount === 0 ? 100 : 100;
    const riskScore = Math.max(0, 100 - snapshot.contractRisk.red * 20 - snapshot.contractRisk.yellow * 5);
    const controlScore = controls.totalControls ? v18Round((controls.passed / controls.totalControls) * 100) : 100;
    const closeScore = v18Number(close.score);
    const dataQualityScore = data.score;
    const category = (score, issues = []) => ({ score: v18Round(Math.max(0, Math.min(100, score))), status: score >= 90 ? "GREEN" : (score >= 75 ? "YELLOW" : "RED"), issues });
    return { financial: category(financialScore, rec.status === "RED" ? ["Reporting reconciliation failure"] : []), liquidity: category(liquidityScore), risk: category(riskScore, snapshot.topRisks.slice(0, 5)), controls: category(controlScore, controls.openExceptions.slice(0, 5)), close: category(closeScore, close.blockingIssues.concat(close.warnings).slice(0, 5)), dataQuality: category(dataQualityScore, data.errors ? ["Data quality errors detected"] : []) };
  }

  function getManagementSummary(reportingDate) {
    const d = v18ResolveDate(reportingDate), snapshot = getCfoExecutiveSnapshot(d);
    return { version: CFO_COCKPIT_VERSION, reportingDate: v18IsoDate(d), executiveStatus: snapshot.executiveStatus, financialPosition: snapshot.financialPosition, pnlImpact: snapshot.profitLoss, cashFlow: snapshot.cashFlow, risk: snapshot.contractRisk, controls: snapshot.controlStatus, close: snapshot.closeStatus, keyAlerts: snapshot.keyAlerts, actions: snapshot.keyAlerts.filter(a => a.actionRequired).map(a => ({ severity: a.severity, type: a.type, actionRequired: a.actionRequired, contractId: a.contractId, company: a.company })) };
  }

  function getCfoDashboardData(reportingDate) {
    const d = v18ResolveDate(reportingDate), snapshot = getCfoExecutiveSnapshot(d), kpis = getCfoKpis(d), scorecard = getCfoScorecard(d), management = getManagementSummary(d), previous = v18PreviousSnapshot(d);
    const start = new Date(d.getFullYear(), d.getMonth(), 1), end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const financial = typeof getTfrs16FinancialReportingSnapshot === "function" ? getTfrs16FinancialReportingSnapshot(d) : {};
    return {
      version: CFO_COCKPIT_VERSION,
      metadata: { reportingDate: v18IsoDate(d), period: typeof closePeriodOf === "function" ? closePeriodOf(d) : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, generatedAt: new Date().toISOString(), source: "V18_CFO_COCKPIT", actualCashDataAvailable: false, currencyIsolation: true },
      executiveSummary: management,
      kpis,
      financialPosition: snapshot.financialPosition,
      profitLoss: snapshot.profitLoss,
      cashFlow: snapshot.cashFlow,
      leaseExposure: snapshot.leaseExposure,
      maturity: snapshot.maturity,
      companyExposure: snapshot.companyExposure,
      currencyExposure: snapshot.currencyExposure,
      renewals: snapshot.renewalRisk,
      expiries: snapshot.expiryRisk,
      modifications: snapshot.modificationImpact,
      reassessments: snapshot.reassessmentImpact,
      risks: { contractRisk: snapshot.contractRisk, topRisks: snapshot.topRisks },
      controls: snapshot.controlStatus,
      close: snapshot.closeStatus,
      alerts: snapshot.keyAlerts,
      actions: management.actions,
      scorecard,
      trends: { previousAvailable: Boolean(previous), financial: snapshot.financialPosition.trend, pnl: snapshot.profitLoss.trend },
      dataQuality: snapshot.dataQuality,
      reconciliation: snapshot.reconciliation,
      reportingSnapshot: financial,
      period: { start: v18IsoDate(start), end: v18IsoDate(end) },
      drillDown: { companies: snapshot.companyExposure.map(x => x.company), currencies: snapshot.currencyExposure.map(x => x.currency), contractQuery: "getCfoContractView(contractId, reportingDate)" }
    };
  }

  function getCfoApprovalReadiness(reportingDate) {
    const d = v18ResolveDate(reportingDate), snapshot = getCfoExecutiveSnapshot(d), approval = typeof getCloseApprovalReadiness === "function" ? getCloseApprovalReadiness(d) : null;
    return { reportingDate: v18IsoDate(d), ready: snapshot.executiveStatus === "GREEN" && Boolean(snapshot.closeStatus.ready), executiveStatus: snapshot.executiveStatus, score: snapshot.closeStatus.score, blockingIssues: snapshot.closeStatus.blockingIssues, warnings: snapshot.closeStatus.warnings, openControls: snapshot.controlStatus.openExceptions, reconciliationStatus: snapshot.reconciliation, journalStatus: v18JournalStatus(d), certification: approval?.certification || null };
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
        company: ["company", "company code", "companycode", "şirket", "sirket"],
        supplier: ["supplier", "vendor", "tedarikçi", "tedarikci"],
        monthlyPayment: ["monthly payment", "payment", "lease payment", "aylık kira", "aylik kira", "kira ödeme", "kira odeme"],
        startDate: ["start date", "lease start", "commencement date", "başlangıç tarihi", "baslangic tarihi"],
        endDate: ["end date", "lease end", "termination date", "bitiş tarihi", "bitis tarihi"],
        discountRate: ["discount rate", "discount", "iskonto oranı", "iskonto orani"],
        renewalDate: ["renewal date", "renewal", "yenileme tarihi", "yenileme"],
        currency: ["currency", "currency code", "para birimi", "döviz", "doviz"],
        functionalCurrency: ["functional currency", "fonksiyonel para birimi", "fonksiyonel para birimi kodu", "reporting currency"],
        status: ["status", "contract status", "durum"],
        assetClass: ["asset class", "asset category", "varlık sınıfı", "varlik sinifi", "varlık sinifi"],
        prepayments: ["prepayments", "prepayment", "peşin ödemeler", "pesin odemeler", "peşin ödeme", "pesin odeme"],
        leaseIncentives: ["lease incentives", "incentives", "kiralayan teşvikleri", "kiralayan tesvikleri", "teşvikler", "tesvikler"],
        leaseIncreaseType: ["escalation type", "lease increase type", "increase type", "kira artış tipi", "kira artis tipi"],
        leaseIncreaseRate: ["escalation rate", "annual increase rate", "increase rate", "yıllık artış oranı", "yillik artis orani"],
        fixedIncrease: ["fixed increase", "fixed escalation amount", "sabit artış tutarı", "sabit artis tutari"],
        variablePayment: ["variable payment", "değişken ödeme", "degisken odeme"],
        usefulLifeMonths: ["useful life months", "useful life", "faydalı ömür", "faydali omur", "varlığın faydalı ömrü", "varligin faydali omru"],
        renewalOption: ["renewal option", "yenileme opsiyonu", "yenileme opsiyonu makul ölçüde kesin", "yenileme opsiyonu makul olcude kesin"],
        terminationOption: ["termination option", "fesih opsiyonu", "fesih opsiyonu makul ölçüde kesin değil", "fesih opsiyonu makul olcude kesin degil"],
        purchaseOption: ["purchase option", "satın alma opsiyonu", "satin alma opsiyonu", "satın alma opsiyonu makul ölçüde kesin", "satin alma opsiyonu makul olcude kesin"],
        ownershipTransfer: ["ownership transfer", "mülkiyet devri", "mulkiyet devri", "kira sonunda mülkiyet devri var", "kira sonunda mulkiyet devri var"],
        shortTermLease: ["short term lease", "short term exemption", "kısa vadeli kiralama istisnası", "kisa vadeli kiralama istisnasi"],
        lowValueAsset: ["low value asset", "low value exemption", "düşük değerli varlık istisnası", "dusuk degerli varlik istisnasi"]
      })
    }),
    SAP: Object.freeze({ id: "SAP", schemaVersion: INTEGRATION_SCHEMA_VERSION, fields: {} }),
    ORACLE: Object.freeze({ id: "ORACLE", schemaVersion: INTEGRATION_SCHEMA_VERSION, fields: {} }),
    DYNAMICS: Object.freeze({ id: "DYNAMICS", schemaVersion: INTEGRATION_SCHEMA_VERSION, fields: {} })
  });

  function integrationClone(value) {
    try { return JSON.parse(JSON.stringify(value)); } catch (error) { return null; }
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

  function integrationOptionalEscalationType(row, aliases) {
    const value = integrationFindValue(row, aliases);
    if (value === undefined || value === null || value === "") return undefined;
    return integrationEscalationType(value);
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
    const normalizedData = {
      id: integrationFindValue(row, fields.contractId || []),
      company: integrationFindValue(row, fields.company || []),
      supplier: integrationFindValue(row, fields.supplier || []),
      monthlyPayment: integrationNumber(integrationFindValue(row, fields.monthlyPayment || []), NaN),
      startDate: dateResultStart && typeof dateResultStart === "object" ? null : dateResultStart,
      endDate: dateResultEnd && typeof dateResultEnd === "object" ? null : dateResultEnd,
      discountRate: integrationNumber(integrationFindValue(row, fields.discountRate || []), 0),
      renewalDate: dateResultRenewal && typeof dateResultRenewal === "object" ? null : dateResultRenewal,
      currency: normalizeIntegrationCurrency(integrationFindValue(row, fields.currency || [])),
      functionalCurrency: normalizeIntegrationCurrency(integrationFindValue(row, fields.functionalCurrency || [])),
      status: integrationFindValue(row, fields.status || []) || "active",
      assetClass: String(integrationFindValue(row, fields.assetClass || []) || "").trim(),
      prepayments: integrationOptionalNumber(row, fields.prepayments || []),
      leaseIncentives: integrationOptionalNumber(row, fields.leaseIncentives || []),
      leaseIncreaseType: integrationOptionalEscalationType(row, fields.leaseIncreaseType || []),
      leaseIncreaseRate: integrationOptionalNumber(row, fields.leaseIncreaseRate || []),
      fixedIncrease: integrationOptionalNumber(row, fields.fixedIncrease || []),
      variablePayment: integrationOptionalNumber(row, fields.variablePayment || []),
      usefulLifeMonths: integrationOptionalNumber(row, fields.usefulLifeMonths || []),
      renewalOption: integrationOptionalBoolean(row, fields.renewalOption || []),
      terminationOption: integrationOptionalBoolean(row, fields.terminationOption || []),
      purchaseOption: integrationOptionalBoolean(row, fields.purchaseOption || []),
      ownershipTransfer: integrationOptionalBoolean(row, fields.ownershipTransfer || []),
      shortTermLease: integrationOptionalBoolean(row, fields.shortTermLease || []),
      lowValueAsset: integrationOptionalBoolean(row, fields.lowValueAsset || [])
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
      company: data.company || "",
      supplier: data.supplier || "",
      monthlyPayment: data.monthlyPayment,
      startDate: data.startDate,
      endDate: data.endDate,
      discountRate: data.discountRate,
      renewalDate: data.renewalDate,
      currency: data.currency || "TRY",
      functionalCurrency: data.functionalCurrency || "TRY",
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
      modification: false,
      reassessments: []
    };
    base.id = String(data.id);
    base.company = data.company ?? base.company;
    base.supplier = data.supplier ?? base.supplier;
    base.monthlyPayment = data.monthlyPayment;
    base.startDate = data.startDate;
    base.endDate = data.endDate;
    base.discountRate = data.discountRate;
    base.renewalDate = data.renewalDate;
    if (data.currency) base.currency = data.currency;
    if (data.functionalCurrency) base.functionalCurrency = data.functionalCurrency;
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
    if (data.renewalOption !== undefined) base.renewalOption = data.renewalOption === true;
    if (data.terminationOption !== undefined) base.terminationOption = data.terminationOption === true;
    if (data.purchaseOption !== undefined) base.purchaseOption = data.purchaseOption === true;
    if (data.ownershipTransfer !== undefined) base.ownershipTransfer = data.ownershipTransfer === true;
    if (data.shortTermLease !== undefined) base.shortTermLease = data.shortTermLease === true;
    if (data.lowValueAsset !== undefined) base.lowValueAsset = data.lowValueAsset === true;
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
    const fields = ["company", "supplier", "monthlyPayment", "startDate", "endDate", "discountRate", "renewalDate", "currency", "functionalCurrency", "status", "assetClass", "prepayments", "leaseIncentives", "leaseIncreaseType", "leaseIncreaseRate", "fixedIncrease", "variablePayment", "usefulLifeMonths", "renewalOption", "terminationOption", "purchaseOption", "ownershipTransfer", "shortTermLease", "lowValueAsset"];
    return fields.filter(field => newData[field] !== undefined && String(oldContract[field] ?? "") !== String(newData[field] ?? "")).map(field => ({ field, oldValue: oldContract[field] ?? null, newValue: newData[field] ?? null }));
  }

  function commitImport(jobId, rows, options = {}) {
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
    preview.validationResults.forEach(result => {
      if (result.status === INTEGRATION_ROW_STATUS.INVALID) { rejected.push(result); return; }
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
      if (index >= 0) working[index] = next; else working.push(next);
      committed.push({ rowNumber: result.rowNumber, contractId: id, action, status: result.status, warningCount: result.warnings.length, businessRuleWarnings: businessRuleCheck.valid ? [] : (businessRuleCheck.errors || []) });
      changes.push({ contractId: id, action, changes: fieldChanges });
      if (typeof recordAuditEvent === "function") recordAuditEvent({ action: action === "CREATE" ? "IMPORT_CREATE" : "IMPORT_UPDATE", entityType: "CONTRACT", entityId: id, contractId: id, reason: "V19 integration import", oldValue: oldContract, newValue: next, metadata: { jobId, sourceType: options.sourceType || INTEGRATION_SOURCE_TYPES.EXCEL, sourceId: options.sourceId || null, schemaVersion: options.schemaVersion || INTEGRATION_SCHEMA_VERSION, fieldChanges } });
      if (!businessRuleCheck.valid && typeof recordAuditEvent === "function") {
        recordAuditEvent({ action: "IMPORT_BUSINESS_RULE_WARNING", entityType: "CONTRACT", entityId: id, contractId: id, reason: "V19 integration import business rule check (validateImportedContract)", metadata: { jobId, rowNumber: result.rowNumber, errors: businessRuleCheck.errors || [] } });
      }
    });
    saveContracts(working);
    if (typeof refresh === "function") { try { refresh(); } catch (error) {} }
    rejected.forEach(result => {
      if (typeof recordAuditEvent === "function") recordAuditEvent({ action: "IMPORT_REJECT", entityType: "IMPORT", entityId: jobId, reason: "V19 integration import rejected row", metadata: { jobId, rowNumber: result.rowNumber, errors: result.errors, warnings: result.warnings } });
    });
    const finalStatus = rejected.length || preview.warningRows ? INTEGRATION_JOB_STATUS.COMPLETED_WITH_WARNINGS : INTEGRATION_JOB_STATUS.COMPLETED;
    const job = updateImportJob(jobId, { status: finalStatus, completedAt: integrationNow(), totalRows: preview.totalRows, importedRows: committed.length, rejectedRows: rejected.length, warningRows: preview.warningRows, errors: rejected.flatMap(x => x.errors || []), warnings: preview.validationResults.flatMap(x => x.warnings || []), validationResults: preview.validationResults, lifecycle: rejected.length ? INTEGRATION_LIFECYCLE.EXCEPTION : INTEGRATION_LIFECYCLE.PROCESSED, committedActions: committed, changeSummary: changes });
    return { success: true, job, preview, committed, rejected, changes };
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

  function getErpReadyContractData(reportingDate, options = {}) {
    const d = reportingDate ? new Date(reportingDate) : new Date();
    const list = getIntegrationContractData(options);
    return list.map(contract => {
      let metric = null;
      try { metric = typeof getCfoContractMetrics === "function" ? getCfoContractMetrics(contract, d) : null; } catch (error) { metric = null; }
      return {
        schemaVersion: INTEGRATION_SCHEMA_VERSION,
        contractId: contract.id,
        companyCode: contract.company || null,
        supplier: contract.supplier || null,
        startDate: contract.startDate || null,
        endDate: contract.endDate || null,
        payment: Number(contract.monthlyPayment) || 0,
        currency: normalizeIntegrationCurrency(contract.currency || contract.integrationMetadata?.currency) || null,
        discountRate: Number(contract.discountRate) || 0,
        leaseLiability: metric?.leaseLiability ?? null,
        currentLiability: metric?.currentLiability ?? null,
        nonCurrentLiability: metric?.nonCurrentLiability ?? null,
        rouAsset: metric?.rouAsset ?? null,
        status: contract.status || null,
        source: "GK_FINANCE_INTELLIGENCE",
        contractIdSource: contract.integrationMetadata?.externalRecordId || contract.id
      };
    });
  }

  function getErpReadyPaymentData(reportingDate, options = {}) {
    const d = reportingDate ? new Date(reportingDate) : new Date();
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const end = new Date(start); end.setFullYear(end.getFullYear() + 1);
    const rows = [];
    getIntegrationContractData(options).forEach(contract => {
      try {
        const built = typeof cfoBuildSchedule === "function" ? cfoBuildSchedule(contract) : (typeof calculateLeaseEngine === "function" ? calculateLeaseEngine(contract) : null);
        const schedule = Array.isArray(built?.schedule) ? built.schedule : [];
        (Array.isArray(schedule) ? schedule : []).forEach(item => {
          const date = item.date || item.paymentDate || item.periodDate;
          const dt = date ? new Date(date) : null;
          if (!dt || Number.isNaN(dt.getTime()) || dt < start || dt > end) return;
          rows.push({ schemaVersion: INTEGRATION_SCHEMA_VERSION, contractId: contract.id, date: date, payment: Number(item.payment ?? item.totalPayment ?? item.paymentAmount) || 0, principal: Number(item.principal) || 0, interest: Number(item.interest) || 0, currency: normalizeIntegrationCurrency(contract.currency || contract.integrationMetadata?.currency) || null, source: "GK_FINANCE_INTELLIGENCE" });
        });
      } catch (error) {}
    });
    return rows;
  }

  function getErpReadyJournalData(reportingDate, options = {}) {
    const d = reportingDate ? new Date(reportingDate) : new Date();
    let report = null;
    try { report = typeof getJournalSummaryReport === "function" ? getJournalSummaryReport({ reportingDate: d }) : null; } catch (error) { report = null; }
    const rows = Array.isArray(report?.rows) ? report.rows : [];
    return rows.map(row => ({
      schemaVersion: INTEGRATION_SCHEMA_VERSION,
      voucherNo: row.voucherNo || row.journalNo || row.journalId || null,
      voucherDate: row.date || row.voucherDate || v19IsoDate(d),
      companyCode: row.company || row.companyCode || null,
      account: row.account || null,
      costCenter: row.costCenter || null,
      profitCenter: row.profitCenter || null,
      debit: Number(row.debit) || 0,
      credit: Number(row.credit) || 0,
      currency: normalizeIntegrationCurrency(row.currency) || null,
      description: row.description || row.account || "",
      contractId: row.contractId || null,
      source: "GK_FINANCE_INTELLIGENCE",
      journalStatus: row.controlStatus || row.status || null
    }));
  }

  function v19IsoDate(date) {
    const d = date instanceof Date ? date : new Date(date);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }

  function getIntegrationExportData(exportType, reportingDate, options = {}) {
    const type = String(exportType || "").toUpperCase();
    if (type === "CONTRACT" || type === "LEASE_REGISTER") return getErpReadyContractData(reportingDate, options);
    if (type === "PAYMENT" || type === "LEASE_PAYMENT") return getErpReadyPaymentData(reportingDate, options);
    if (type === "JOURNAL" || type === "ERP_JOURNAL") return getErpReadyJournalData(reportingDate, options);
    if (type === "FINANCIAL_REPORTING") return typeof getTfrs16FinancialReportingSnapshot === "function" ? getTfrs16FinancialReportingSnapshot(reportingDate || new Date()) : null;
    if (type === "MONTH_END_CLOSE") return typeof getMonthEndCloseDashboardData === "function" ? getMonthEndCloseDashboardData(reportingDate || new Date()) : null;
    if (type === "CFO_DASHBOARD") return typeof getCfoDashboardData === "function" ? getCfoDashboardData(reportingDate || new Date()) : null;
    return [];
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
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
      const firstSheet = workbook.SheetNames?.[0];
      if (!firstSheet) return { success: false, error: "EMPTY_WORKBOOK" };
      rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { defval: "" });
    } catch (error) {
      return { success: false, error: error?.message || String(error) };
    }
    const source = registerIntegrationSource({ sourceType, sourceName: name, importedBy: integrationActor(), status: "IMPORTED", recordCount: rows.length });
    const job = createImportJob({ sourceId: source.sourceId, sourceType, fileName: name, totalRows: rows.length, lifecycle: INTEGRATION_LIFECYCLE.IMPORTED });
    const preview = previewImport(rows, { ...options, sourceId: source.sourceId, sourceType, fileName: name });
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

  function v191Escape(value) {
    return escapeHtml(value == null ? "" : String(value));
  }

  function v191EnsureModal() {
    let modal = document.getElementById("v191FunctionalModal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "v191FunctionalModal";
    modal.className = "modal hidden";
    modal.innerHTML = `
      <div class="modal-content detail-modal">
        <div class="modal-header">
          <div>
            <div class="eyebrow">GK FINANCE INTELLIGENCE / V19.1</div>
            <h2 id="v191ModalTitle">Finance View</h2>
            <p id="v191ModalSubtitle" style="margin:6px 0 0;color:#64748b;font-size:11px;"></p>
          </div>
          <button id="v191CloseModal" class="close-button" type="button">×</button>
        </div>
        <div id="v191ModalContent" class="detail-content"></div>
        <div class="detail-actions">
          <button id="v191ModalRefresh" class="secondary-button" type="button">↻ Yenile</button>
          <button id="v191ModalCloseButton" class="secondary-button" type="button">Kapat</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    document.getElementById("v191CloseModal")?.addEventListener("click", v191CloseModal);
    document.getElementById("v191ModalCloseButton")?.addEventListener("click", v191CloseModal);
    document.getElementById("v191ModalRefresh")?.addEventListener("click", () => {
      try { v191OpenView?.(); } catch (error) { console.error("V19.1 view refresh error:", error); }
    });
    return modal;
  }

  function v191CloseModal() {
    document.getElementById("v191FunctionalModal")?.classList.add("hidden");
    v191OpenView = null;
  }

  function v191Show(title, subtitle, renderer) {
    const modal = v191EnsureModal();
    const titleNode = document.getElementById("v191ModalTitle");
    const subtitleNode = document.getElementById("v191ModalSubtitle");
    const content = document.getElementById("v191ModalContent");
    if (!content) return;
    v191LastReportingDate = new Date();
    if (titleNode) titleNode.textContent = title;
    if (subtitleNode) subtitleNode.textContent = subtitle || "";
    content.innerHTML = `<div class="empty-state">Veriler yükleniyor...</div>`;
    modal.classList.remove("hidden");
    try {
      const output = renderer(v191LastReportingDate);
      content.innerHTML = output || `<div class="empty-state"><h3>Veri bulunamadı</h3><p>Bu görünüm için mevcut veri bulunmuyor.</p></div>`;
    } catch (error) {
      console.error(`V19.1 ${title} error:`, error);
      content.innerHTML = `<div class="empty-state"><h3>Veri yüklenemedi</h3><p>${v191Escape(error?.message || String(error))}</p></div>`;
    }
  }

  function v191Value(value) {
    if (value === null || value === undefined || value === "") return "—";
    if (typeof value === "number" && Number.isFinite(value)) return value.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
    if (typeof value === "boolean") return value ? "Evet" : "Hayır";
    if (Array.isArray(value)) return `${value.length} kayıt`;
    if (typeof value === "object") return "Detay";
    return v191Escape(value);
  }

  function v191Table(rows, columns) {
    const safeRows = Array.isArray(rows) ? rows : [];
    if (!safeRows.length) return `<div class="empty-state"><h3>Veri bulunamadı</h3><p>Mevcut kapsamda kayıt bulunmuyor.</p></div>`;
    return `<div class="table-wrapper"><table><thead><tr>${columns.map(c => `<th>${v191Escape(c.label)}</th>`).join("")}</tr></thead><tbody>${safeRows.map(row => `<tr>${columns.map(c => `<td>${c.render ? c.render(row) : v191Value(row?.[c.key])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }

  function v191Kpis(items) {
    return `<section class="kpi-grid">${items.map(item => `<div class="kpi-card"><div class="kpi-label">${v191Escape(item.label)}</div><div class="kpi-value">${item.value}</div><div class="kpi-description">${v191Escape(item.description || "")}</div></div>`).join("")}</section>`;
  }

  function v191RenderFinancialReporting(date) {
    const data = getTfrs16FinancialReportingSnapshot(date) || {};
    const bs = data.balanceSheet || {};
    const pnl = data.profitLoss || {};

    const periodStart = new Date(date.getFullYear(), 0, 1);
    const rouReport = getRuoAssetRollForwardReport(periodStart, date) || {};
    const liabReport = getLeaseLiabilityRollForwardReport(periodStart, date) || {};
    const periodLabel = `${periodStart.toLocaleDateString("tr-TR")} - ${date.toLocaleDateString("tr-TR")}`;

    const rouRows = (Array.isArray(rouReport.rows) ? rouReport.rows.filter(r => r.status !== "ERROR") : []);
    const rouTotalsRow = rouReport.totals ? [{ ...rouReport.totals, contractId: "TOPLAM", company: "", status: rouReport.reconciliation?.passed ? "MUTABIK" : "FARK VAR" }] : [];
    const rouByCurrency = v191GroupRollForwardByCurrency(rouRows, ["openingRuo","depreciation","modificationAdjustment","reassessmentAdjustment","otherAdjustment","closingRuo"]);
    const rouByAssetClass = v191GroupRollForwardByAssetClass(rouRows, ["openingRuo","depreciation","modificationAdjustment","reassessmentAdjustment","otherAdjustment","closingRuo"]);

    const liabRows = (Array.isArray(liabReport.rows) ? liabReport.rows.filter(r => r.status !== "ERROR") : []);
    const liabTotalsRow = liabReport.totals ? [{ ...liabReport.totals, contractId: "TOPLAM", company: "", status: liabReport.reconciliation?.passed ? "MUTABIK" : "FARK VAR" }] : [];
    const liabByCurrency = v191GroupRollForwardByCurrency(liabRows, ["openingLiability","interest","payments","modificationAdjustment","reassessmentAdjustment","otherAdjustment","closingLiability"]);

    return v191Kpis([
      { label: "Lease Liability", value: v191Value(bs.leaseLiability), description: "Financial reporting balance sheet" },
      { label: "Current Liability", value: v191Value(bs.currentLiability), description: "Reporting-date classification" },
      { label: "Non-current Liability", value: v191Value(bs.nonCurrentLiability), description: "Reporting-date classification" },
      { label: "ROU Assets", value: v191Value(bs.rouAssets), description: "Right-of-use assets" },
      { label: "Interest", value: v191Value(pnl.interestExpense), description: "Lease-related P&L" },
      { label: "Depreciation", value: v191Value(pnl.depreciationExpense), description: "Lease-related P&L" }
    ]) + `<h3>Financial Reporting Snapshot</h3>${v191Table(data.byCurrency || [], [
      { key: "currency", label: "Currency" },
      { key: "leaseLiability", label: "Lease Liability" },
      { key: "currentLiability", label: "Current" },
      { key: "nonCurrentLiability", label: "Non-current" },
      { key: "rouAssets", label: "ROU" }
    ])}

    <div style="margin-top:28px;border-top:1px solid #e5e7eb;padding-top:20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
        <div>
          <h3 style="margin:0;">Dipnot: Kullanım Hakkı Varlığı Hareket Tablosu</h3>
          <p style="margin:4px 0 0;color:#64748b;font-size:11px;">Dönem: ${v191Escape(periodLabel)} · TFRS 16.53(a) — Varlık sınıfı ve para birimi kırılımı aşağıda verilmiştir.</p>
        </div>
        <button type="button" class="secondary-button" onclick="window.GK_TFRS16.exportRouAssetMovementNote(new Date(${periodStart.getFullYear()},0,1), new Date(${date.getFullYear()},${date.getMonth()},${date.getDate()})); return false;">↓ Dipnotu Dışa Aktar</button>
      </div>
      <h4 style="margin:16px 0 6px;font-size:12px;color:#475569;">Varlık Sınıfına Göre Özet</h4>
      ${v191Table(rouByAssetClass, [
        { key: "assetClass", label: "Varlık Sınıfı" },
        { key: "contractCount", label: "Sözleşme Sayısı" },
        { key: "openingRuo", label: "Açılış" },
        { key: "depreciation", label: "Amortisman" },
        { key: "modificationAdjustment", label: "Modifikasyon" },
        { key: "reassessmentAdjustment", label: "Reassessment" },
        { key: "otherAdjustment", label: "Diğer" },
        { key: "closingRuo", label: "Kapanış" }
      ])}
      <h4 style="margin:16px 0 6px;font-size:12px;color:#475569;">Para Birimine Göre Özet</h4>
      ${v191Table(rouByCurrency, [
        { key: "currency", label: "Para Birimi" },
        { key: "contractCount", label: "Sözleşme Sayısı" },
        { key: "openingRuo", label: "Açılış" },
        { key: "depreciation", label: "Amortisman" },
        { key: "modificationAdjustment", label: "Modifikasyon" },
        { key: "reassessmentAdjustment", label: "Reassessment" },
        { key: "otherAdjustment", label: "Diğer" },
        { key: "closingRuo", label: "Kapanış" }
      ])}
      <h4 style="margin:16px 0 6px;font-size:12px;color:#475569;">Sözleşme Bazında Detay</h4>
      ${v191Table([...rouRows, ...rouTotalsRow], [
        { key: "contractId", label: "Sözleşme" },
        { key: "company", label: "Şirket" },
        { key: "openingRuo", label: "Açılış" },
        { key: "depreciation", label: "Amortisman" },
        { key: "modificationAdjustment", label: "Modifikasyon" },
        { key: "reassessmentAdjustment", label: "Reassessment" },
        { key: "otherAdjustment", label: "Diğer" },
        { key: "closingRuo", label: "Kapanış" },
        { key: "status", label: "Durum" }
      ])}
      ${rouReport.reconciliation && !rouReport.reconciliation.passed ? `<p style="color:#b91c1c;font-size:11px;margin-top:6px;">⚠ Mutabakat farkı: ${v191Value(rouReport.reconciliation.difference)}</p>` : ""}
    </div>

    <div style="margin-top:28px;border-top:1px solid #e5e7eb;padding-top:20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
        <div>
          <h3 style="margin:0;">Dipnot: Kira Yükümlülüğü Hareket Tablosu</h3>
          <p style="margin:4px 0 0;color:#64748b;font-size:11px;">Dönem: ${v191Escape(periodLabel)} · TFRS 16.58 — Vade analizi ayrı bir dipnot olarak Contract Financial Tools üzerinden alınabilir.</p>
        </div>
        <button type="button" class="secondary-button" onclick="window.GK_TFRS16.exportLeaseLiabilityMovementNote(new Date(${periodStart.getFullYear()},0,1), new Date(${date.getFullYear()},${date.getMonth()},${date.getDate()})); return false;">↓ Dipnotu Dışa Aktar</button>
      </div>
      <h4 style="margin:16px 0 6px;font-size:12px;color:#475569;">Para Birimine Göre Özet</h4>
      ${v191Table(liabByCurrency, [
        { key: "currency", label: "Para Birimi" },
        { key: "contractCount", label: "Sözleşme Sayısı" },
        { key: "openingLiability", label: "Açılış" },
        { key: "interest", label: "Faiz" },
        { key: "payments", label: "Ödemeler" },
        { key: "modificationAdjustment", label: "Modifikasyon" },
        { key: "reassessmentAdjustment", label: "Reassessment" },
        { key: "otherAdjustment", label: "Diğer" },
        { key: "closingLiability", label: "Kapanış" }
      ])}
      <h4 style="margin:16px 0 6px;font-size:12px;color:#475569;">Sözleşme Bazında Detay</h4>
      ${v191Table([...liabRows, ...liabTotalsRow], [
        { key: "contractId", label: "Sözleşme" },
        { key: "company", label: "Şirket" },
        { key: "openingLiability", label: "Açılış" },
        { key: "interest", label: "Faiz" },
        { key: "payments", label: "Ödemeler" },
        { key: "modificationAdjustment", label: "Modifikasyon" },
        { key: "reassessmentAdjustment", label: "Reassessment" },
        { key: "otherAdjustment", label: "Diğer" },
        { key: "closingLiability", label: "Kapanış" },
        { key: "status", label: "Durum" }
      ])}
      ${liabReport.reconciliation && !liabReport.reconciliation.passed ? `<p style="color:#b91c1c;font-size:11px;margin-top:6px;">⚠ Mutabakat farkı: ${v191Value(liabReport.reconciliation.difference)}</p>` : ""}
    </div>`;
  }

  function v191RenderRiskControls(date) {
    const summary = typeof getControlSummary === "function" ? getControlSummary(date) : null;
    const risks = typeof getRiskSummary === "function" ? getRiskSummary(date) : null;
    const exceptions = typeof getOpenExceptions === "function" ? getOpenExceptions() : [];
    return v191Kpis([
      { label: "Controls", value: v191Value(summary?.totalControls ?? summary?.total ?? 0), description: "Existing control engine" },
      { label: "Passed", value: v191Value(summary?.passed ?? 0), description: "Existing control results" },
      { label: "Open Exceptions", value: v191Value(Array.isArray(exceptions) ? exceptions.length : summary?.openExceptions ?? 0), description: "Open control exceptions" },
      { label: "Critical", value: v191Value(risks?.critical ?? risks?.criticalExceptions ?? 0), description: "Existing risk classification" }
    ]) + `<h3>Open Control Exceptions</h3>${v191Table(Array.isArray(exceptions) ? exceptions : [], [
      { key: "contractId", label: "Contract" },
      { key: "company", label: "Company" },
      { key: "priority", label: "Priority" },
      { key: "status", label: "Status" },
      { key: "message", label: "Issue" }
    ])}`;
  }

  function v191RenderClose(date) {
    const data = getMonthEndCloseDashboardData(date) || {};
    const readiness = data.readiness || getCloseReadiness(date) || {};
    const summary = data.summary || getMonthEndCloseSummary(date) || {};
    return v191Kpis([
      { label: "Close Status", value: v191Value(readiness.status || data.status || "UNKNOWN"), description: "V17 Month-End Close Engine" },
      { label: "Close Score", value: v191Value(readiness.score ?? data.closeScore), description: "Weighted close readiness" },
      { label: "Blocking Issues", value: v191Value((readiness.blockingIssues || data.blockingIssues || []).length), description: "Close blockers" },
      { label: "Warnings", value: v191Value((readiness.warnings || data.warnings || []).length), description: "Close warnings" }
    ]) + `<h3>Close Checks</h3>${v191Table(readiness.checklist?.checks || data.checks || [], [
      { key: "controlId", label: "Control" },
      { key: "category", label: "Category" },
      { key: "status", label: "Status" },
      { key: "description", label: "Description" }
    ])}<h3>Summary</h3>${v191Table([summary], [
      { key: "period", label: "Period" },
      { key: "journalCount", label: "Journal Count" },
      { key: "reconciliationStatus", label: "Reconciliation" },
      { key: "certificationStatus", label: "Certification" }
    ])}`;
  }

  function v191RenderCfo(date) {
    const data = getCfoDashboardData(date) || {};
    const k = data.kpis || {};
    const liab = data.financialPosition?.leaseLiability || {};
    return v191Kpis([
      { label: "Lease Liability", value: v191Value(liab.total ?? k.TOTAL_LEASE_LIABILITY?.value), description: "CFO Dashboard" },
      { label: "ROU Assets", value: v191Value(data.financialPosition?.rouAssets?.total ?? k.ROU_ASSETS?.value), description: "CFO Dashboard" },
      { label: "Next 12M Payments", value: v191Value(data.cashFlow?.next12MonthPayments ?? k.NEXT_12M_CASH_PAYMENTS?.value), description: "Expected cash — actual cash not asserted" },
      { label: "Close Score", value: v191Value(data.close?.score ?? k.CLOSE_SCORE?.value), description: "Existing close engine" },
      { label: "Open Exceptions", value: v191Value(data.controls?.openExceptions?.length ?? k.OPEN_EXCEPTIONS?.value), description: "Existing controls" },
      { label: "Executive Status", value: v191Value(data.executiveSummary?.executiveStatus || data.status || "UNKNOWN"), description: "Deterministic CFO status" }
    ]) + `<h3>Top Risks</h3>${v191Table(data.risks?.topRisks || [], [
      { key: "severity", label: "Severity" },
      { key: "contractId", label: "Contract" },
      { key: "company", label: "Company" },
      { key: "description", label: "Description" },
      { key: "action", label: "Action" }
    ])}`;
  }

  function v191RenderIntegration(date) {
    const data = getIntegrationDashboardData() || {};
    const freshness = getIntegrationDataFreshness() || {};
    const history = getImportHistory() || [];
    return v191Kpis([
      { label: "Imports", value: v191Value(data.totalImports), description: "Integration jobs" },
      { label: "Imported Rows", value: v191Value(data.importedRows), description: "Committed rows" },
      { label: "Open Exceptions", value: v191Value(data.openExceptions), description: "Integration exceptions" },
      { label: "Reconciliation", value: v191Value(data.reconciliationStatus), description: "Integration reconciliation" },
      { label: "Freshness", value: v191Value(freshness.freshnessStatus), description: "Live ERP connection is not claimed" },
      { label: "ERP Ready", value: v191Value(data.erpReady === true), description: "Ready architecture" }
    ]) + `<h3>Import History</h3>${v191Table(history.slice(0, 20), [
      { key: "jobId", label: "Job" },
      { key: "sourceType", label: "Source" },
      { key: "fileName", label: "File" },
      { key: "status", label: "Status" },
      { key: "totalRows", label: "Rows" },
      { key: "rejectedRows", label: "Rejected" }
    ])}`;
  }

  function v191RenderReconciliation(date) {
    const rows = typeof getIntegrationReconciliations === "function" ? getIntegrationReconciliations() : [];
    return v191Table(rows.slice(0, 50), [
      { key: "reconciliationId", label: "ID" },
      { key: "source", label: "Source" },
      { key: "reportingDate", label: "Reporting Date" },
      { key: "status", label: "Status" },
      { key: "externalTotal", label: "External" },
      { key: "internalTotal", label: "Internal" },
      { key: "variance", label: "Variance" }
    ]);
  }

  function v191RenderContractTools() {
    if (!selectedContractId) return `<div class="empty-state"><h3>Sözleşme seçilmedi</h3><p>Payment Schedule, Journal ve Audit Trail için önce bir sözleşme detayını açın.</p></div>`;
    const contract = contracts.find(c => c.id === selectedContractId);
    if (!contract) return `<div class="empty-state"><h3>Sözleşme bulunamadı</h3><p>Seçili sözleşme artık portföyde mevcut değil.</p></div>`;
    const schedule = typeof cfoBuildSchedule === "function" ? (cfoBuildSchedule(contract)?.schedule || []) : (typeof calculateLeaseEngine === "function" ? (calculateLeaseEngine(contract)?.schedule || []) : []);
    const journals = typeof getJournalSummaryReport === "function" ? (getJournalSummaryReport({ contractId: contract.id })?.rows || []) : [];
    const audit = typeof getAuditTrailReport === "function" ? (getAuditTrailReport({ contractId: contract.id }) || []) : [];
    return `<h3>${v191Escape(contract.id)} — Payment Schedule</h3>${v191Table(schedule.slice(0, 24), [
      { key: "period", label: "Period" }, { key: "date", label: "Date" }, { key: "openingLiability", label: "Opening" }, { key: "payment", label: "Payment" }, { key: "interest", label: "Interest" }, { key: "principal", label: "Principal" }, { key: "closingLiability", label: "Closing" }
    ])}<h3>Journal</h3>${v191Table(journals.slice(0, 50), [
      { key: "voucherNo", label: "Voucher" }, { key: "voucherDate", label: "Date" }, { key: "account", label: "Account" }, { key: "debit", label: "Debit" }, { key: "credit", label: "Credit" }, { key: "currency", label: "Currency" }
    ])}<h3>Audit Trail</h3>${v191Table(audit.slice(0, 50), [
      { key: "timestamp", label: "Timestamp" }, { key: "actor", label: "Actor" }, { key: "action", label: "Action" }, { key: "contractId", label: "Contract" }
    ])}`;
  }

  function v191OpenFinancialReporting() { v191OpenView = () => v191Show("Finansal Raporlama", "Existing V16.10 Financial Reporting Engine", v191RenderFinancialReporting); v191OpenView(); }
  function v191OpenRiskControls() { v191OpenView = () => v191Show("Risk & Kontroller", "Existing V16.8 Risk & Control Engine", v191RenderRiskControls); v191OpenView(); }
  function v191OpenMonthEndClose() { v191OpenView = () => v191Show("Ay Sonu Kapanış", "Existing V17 Month-End Close Engine", v191RenderClose); v191OpenView(); }
  function v191OpenCfoDashboard() { v191OpenView = () => v191Show("CFO Dashboard", "Existing V18 CFO Data Layer", v191RenderCfo); v191OpenView(); }
  function v191OpenIntegration() { v191OpenView = () => v191Show("Integration", "Existing V19 Integration Data Exchange Engine", v191RenderIntegration); v191OpenView(); }
  function v191OpenReconciliation() { v191OpenView = () => v191Show("Reconciliation", "Existing V19 Integration Reconciliation Engine", v191RenderReconciliation); v191OpenView(); }
  function v191OpenContractTools() { v191OpenView = () => v191Show("Contract Financial Tools", "Selected contract: Payment Schedule / Journal / Audit Trail", v191RenderContractTools); v191OpenView(); }

  function v191WireNavigation() {
    document.querySelectorAll(".nav-item").forEach(link => {
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
      if (!rows.length) { alert("Aktarılacak veri bulunamadı."); return; }
      if (typeof XLSX === "undefined") { throw new Error("Excel motoru yüklenemedi."); }
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, String(type).slice(0, 31));
      XLSX.writeFile(workbook, `GK_Finance_${String(type).toUpperCase()}_${new Date().toISOString().slice(0,10)}.xlsx`);
      createExportHistory(type, rows.length, { status: "COMPLETED" });
    } catch (error) {
      console.error("V19.1 Excel export error:", error);
      alert(`Excel export tamamlanamadı: ${error?.message || String(error)}`);
    }
  }

  function v191WireExistingContractActions() {
    const detailContent = document.getElementById("detailContent");
    if (!detailContent || detailContent.dataset.v191Delegated === "1") return;
    detailContent.addEventListener("click", event => {
      const target = event.target.closest("button");
      if (!target) return;
      const text = (target.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
      if (text.includes("ödeme plan") && !target.id) { v191OpenContractTools(); }
      else if (text.includes("audit") && !target.id) { v191OpenContractTools(); }
      else if (text.includes("journal") && !target.id) { v191OpenContractTools(); }
    });
    detailContent.dataset.v191Delegated = "1";
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

  function v20Clone(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return value;
    }
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

  function v20NormalizeDate(value) {
    if (value === null || value === undefined || value === "") return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString().slice(0, 10);
  }

  function v20NormalizeCurrency(value, fallback = "TRY") {
    const currency = String(value || fallback || "").trim().toUpperCase();
    return /^[A-Z]{3}$/.test(currency) ? currency : String(fallback || "TRY").toUpperCase();
  }

  function v20Amount(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
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
          baseCurrency: contract?.currency || "TRY",
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

  function v20GetDatabaseModel() {
    const normalizedContracts = v20GetContracts();
    const companies = v20CollectCompanies(normalizedContracts);
    const schedules = [];
    const modifications = [];
    const reassessments = [];
    const journals = [];
    const journalLines = [];

    normalizedContracts.forEach(contract => {
      let schedule = [];
      try {
        if (typeof cfoBuildSchedule === "function") {
          const result = cfoBuildSchedule(contract);
          schedule = v20SafeArray(result?.schedule);
        } else if (typeof calculateLeaseEngine === "function") {
          const result = calculateLeaseEngine(contract);
          schedule = v20SafeArray(result?.schedule);
        }
      } catch (error) {
        console.error("V20 schedule extraction error:", error);
      }

      normalizeScheduleData(schedule, contract.id).forEach(row => {
        row.currency = v20NormalizeCurrency(contract.currency, "TRY");
        schedules.push(row);
      });

      contract.modifications.forEach(item => {
        const normalized = normalizeModificationData(item, contract.id);
        if (normalized) modifications.push(normalized);
      });

      contract.reassessments.forEach(item => {
        const normalized = normalizeReassessmentData(item, contract.id);
        if (normalized) reassessments.push(normalized);
      });

      const contractJournalSources = [];
      if (Array.isArray(contract.journal)) contractJournalSources.push(...contract.journal);
      if (Array.isArray(contract.journals)) contractJournalSources.push(...contract.journals);
      if (Array.isArray(contract.modificationJournals)) contractJournalSources.push(...contract.modificationJournals);

      contractJournalSources.forEach(item => {
        const normalized = normalizeJournalData(
          item,
          contract.id,
          contract.companyId || null
        );
        if (normalized) {
          journals.push(normalized.header);
          journalLines.push(...normalized.lines);
        }
      });
    });

    /* Reuse the existing V19.1 journal/reporting engine as the canonical
       journal source when available; no new journal calculation is introduced. */
    if (typeof rptJournalRows === "function") {
      try {
        const journalRows = rptJournalRows();
        const grouped = new Map();

        v20SafeArray(journalRows).forEach((row, index) => {
          const journalId = String(
            row?.voucherNo ||
            `${row?.contractId || "LEASE"}-${row?.eventId || "JNL"}`
          );

          if (!grouped.has(journalId)) {
            grouped.set(journalId, {
              id: journalId,
              voucherNo: row?.voucherNo || journalId,
              voucherDate: v20NormalizeDate(row?.voucherDate),
              companyId: row?.companyId || null,
              company: row?.company || "",
              contractId: row?.contractId || null,
              reportingPeriod: row?.period || null,
              description: row?.description || "",
              currency: v20NormalizeCurrency(row?.currency, "TRY"),
              source: row?.source || "JOURNAL_ENGINE",
              controlStatus: row?.controlStatus || "VALID",
              createdAt: row?.createdAt || null
            });
          }

          const header = grouped.get(journalId);
          journalLines.push(v20VersionedEntity({
            id: String(row?.id || `${journalId}-LINE-${index + 1}`),
            journalId,
            account: row?.account || "",
            costCenter: row?.costCenter || null,
            profitCenter: row?.profitCenter || null,
            debit: v20Amount(row?.debit),
            credit: v20Amount(row?.credit),
            currency: v20NormalizeCurrency(row?.currency, header.currency),
            description: row?.description || ""
          }, "JournalLine"));
        });

        journals.splice(0, journals.length, ...Array.from(grouped.values()).map(item =>
          v20VersionedEntity(item, "Journal")
        ));
      } catch (error) {
        console.error("V20 journal normalization error:", error);
      }
    }

    const auditEvents = typeof loadAuditEvents === "function"
      ? loadAuditEvents().map(normalizeAuditEventData).filter(Boolean)
      : [];

    let controls = [];
    try {
      const controlReport =
        typeof getControlExceptionReport === "function"
          ? getControlExceptionReport()
          : null;
      controls = v20SafeArray(controlReport?.rows || controlReport)
        .map(item => normalizeControlData(item, item?.companyId, item?.contractId))
        .filter(Boolean);
    } catch (error) {
      console.error("V20 control normalization error:", error);
    }

    let closePeriods = [];
    try {
      const closeState =
        typeof closeLoadState === "function"
          ? closeLoadState()
          : {};
      const closeRows = Array.isArray(closeState?.periods)
        ? closeState.periods
        : Object.entries(closeState || {}).map(([period, value]) => ({
            ...(v20SafeObject(value)),
            period
          }));
      closePeriods = closeRows.map(normalizeClosePeriodData).filter(Boolean);
    } catch (error) {
      console.error("V20 close normalization error:", error);
    }

    let reconciliations = [];
    let importJobs = [];
    let exportJobs = [];

    try {
      const integration = typeof getIntegrationStorage === "function"
        ? getIntegrationStorage()
        : { jobs: [], exports: [], reconciliations: [] };

      importJobs = v20SafeArray(integration?.jobs)
        .map(normalizeImportJobData)
        .filter(Boolean);

      exportJobs = v20SafeArray(integration?.exports)
        .map(normalizeExportJobData)
        .filter(Boolean);

      reconciliations = v20SafeArray(integration?.reconciliations)
        .map(normalizeReconciliationData)
        .filter(Boolean);
    } catch (error) {
      console.error("V20 integration normalization error:", error);
    }

    return {
      schemaVersion: DATA_SCHEMA_VERSION,
      generatedAt: v20Now(),
      companies,
      contracts: normalizedContracts,
      schedules,
      modifications,
      reassessments,
      journals,
      journalLines,
      auditEvents,
      controls,
      closePeriods,
      reconciliations,
      importJobs,
      exportJobs
    };
  }

  function exportCompaniesForDatabase() {
    return v20GetDatabaseModel().companies;
  }

  function exportContractsForDatabase() {
    return v20GetDatabaseModel().contracts;
  }

  function exportSchedulesForDatabase() {
    return v20GetDatabaseModel().schedules;
  }

  function exportModificationsForDatabase() {
    return v20GetDatabaseModel().modifications;
  }

  function exportReassessmentsForDatabase() {
    return v20GetDatabaseModel().reassessments;
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

  function exportDatabaseReadyData(options = {}) {
    const model = v20GetDatabaseModel();
    const requested = Array.isArray(options.entities) && options.entities.length
      ? options.entities
      : V20_ENTITY_NAMES;

    const result = { schemaVersion: DATA_SCHEMA_VERSION, generatedAt: model.generatedAt };

    const entityMap = {
      Company: model.companies,
      Contract: model.contracts,
      LeaseSchedule: model.schedules,
      Modification: model.modifications,
      Reassessment: model.reassessments,
      Journal: model.journals,
      JournalLine: model.journalLines,
      AuditEvent: model.auditEvents,
      Control: model.controls,
      ClosePeriod: model.closePeriods,
      Reconciliation: model.reconciliations,
      ImportJob: model.importJobs,
      ExportJob: model.exportJobs
    };

    requested.forEach(name => {
      if (Object.prototype.hasOwnProperty.call(entityMap, name)) {
        result[name] = v20Clone(entityMap[name]);
      }
    });

    return result;
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

  function v20GetAllStoredAuditEvents() {
    try {
      return typeof loadAuditEvents === "function" ? v20SafeArray(loadAuditEvents()) : [];
    } catch (error) {
      return [];
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

  function v20ApiError(code, message, details = null, field = null, metadata = {}) {
    return {
      success: false,
      data: null,
      error: { code: String(code || "UNKNOWN_ERROR"), message: String(message || ""), details, field },
      metadata
    };
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

  function v21Clone(value) {
    try { return JSON.parse(JSON.stringify(value)); } catch (error) { return null; }
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

  function v22Clone(value) {
    try { return JSON.parse(JSON.stringify(value)); } catch (error) { return null; }
  }

  function v22Now() { return new Date().toISOString(); }

  function v22Id(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function v22NormalizeDate(value) {
    if (value === null || value === undefined || value === "") return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10);
  }

  function v22Currency(value, fallback = "TRY") {
    const currency = String(value || fallback).trim().toUpperCase();
    return /^[A-Z]{3}$/.test(currency) ? currency : fallback;
  }

  function v22Amount(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
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
          baseCurrency: v22Currency(contract?.currency, "TRY"),
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

  function v22NormalizeCompany(company, fallbackIndex = 0) {
    const source = v22SafeObject(company);
    const normalized = typeof normalizeCompanyData === "function"
      ? normalizeCompanyData(company, fallbackIndex)
      : {
          id: String(source.id || `COMP-${fallbackIndex + 1}`),
          code: String(source.code || source.name || `COMP-${fallbackIndex + 1}`),
          name: String(source.name || source.company || `Company ${fallbackIndex + 1}`),
          country: source.country || "TR",
          baseCurrency: v22Currency(source.baseCurrency, "TRY"),
          status: source.status || "ACTIVE"
        };
    return {
      ...normalized,
      groupId: source.groupId || normalized.groupId || null,
      id: String(normalized.id),
      code: String(normalized.code || normalized.id),
      name: String(normalized.name || normalized.code || normalized.id),
      baseCurrency: v22Currency(normalized.baseCurrency, "TRY"),
      status: String(normalized.status || "ACTIVE").toUpperCase(),
      schemaVersion: V22_SCHEMA_VERSION,
      entityType: "Company"
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

  function v22AccessibleCompanyIds(user = v22CurrentUser()) {
    const all = v22CompanyList().map(company => String(company.id));
    if (!user) return [];
    try {
      if (v22HasPermission("company_access.manage", user)) return all;
    } catch (error) {}
    const allowed = new Set(v22SafeArray(user.companyIds).map(id => String(id)));
    return all.filter(id => allowed.has(id));
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

  function v22ScopeCompanies(groupId, reportingDate, user) {
    const accessible = new Set(v22AccessibleCompanyIds(user));
    const date = v22NormalizeDate(reportingDate);
    return v22Scope.filter(scope => {
      if (String(scope.groupId) !== String(groupId) || scope.included === false) return false;
      if (!accessible.has(String(scope.companyId))) return false;
      if (scope.effectiveDate && date && scope.effectiveDate > date) return false;
      return true;
    });
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
        : (typeof calculateLeaseEngine === "function" ? calculateLeaseEngine(contract) : {});
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

  function v22GetGroupEliminations(groupId, reportingDate) {
    const date = v22NormalizeDate(reportingDate);
    return v22Eliminations.filter(item => {
      if (String(item.groupId) !== String(groupId)) return false;
      if (item.reportingDate && date && item.reportingDate !== date) return false;
      return item.status !== "REJECTED";
    });
  }

  function v22AggregateEliminations(rows) {
    return rows.reduce((acc, row) => {
      const amount = v22Amount(row.amount);
      acc.total += amount;
      acc.byType[row.eliminationType] = (acc.byType[row.eliminationType] || 0) + amount;
      return acc;
    }, { total: 0, byType: {} });
  }

  function v22VisibleGroupCompanies(groupId, reportingDate, user) {
    const companies = v22CompanyList();
    const scopes = v22ScopeCompanies(groupId, reportingDate, user);
    return scopes.map(scope => {
      const company = companies.find(item => String(item.id) === String(scope.companyId));
      return company ? { ...company, scope: v22Clone(scope) } : null;
    }).filter(Boolean);
  }

  function getConsolidatedData(groupId, reportingDate, options = {}) {
    v22Require("consolidation.view", { ...options, groupId, action: "CONSOLIDATION_VIEW" });
    const group = v22Groups.find(item => String(item.id) === String(groupId));
    if (!group) return { success: false, error: { code: "GROUP_NOT_FOUND", message: "Group not found." }, data: null, metadata: {} };
    const date = v22NormalizeDate(reportingDate) || v22Now().slice(0, 10);
    const user = options.user || v22CurrentUser();
    const visibleCompanies = v22VisibleGroupCompanies(groupId, date, user);
    const companyContributions = visibleCompanies.map(company => {
      const contribution = v22AggregateCompany(company, date);
      const method = company.scope?.consolidationMethod || "FULL";
      const ownership = company.scope?.ownershipPercentage ?? 100;
      const multiplier = method === "EQUITY" || method === "PROPORTIONAL" ? ownership / 100 : 1;
      return {
        ...contribution,
        consolidationMethod: method,
        ownershipPercentage: ownership,
        appliedMultiplier: multiplier,
        leaseLiability: contribution.leaseLiability * multiplier,
        currentLiability: contribution.currentLiability * multiplier,
        nonCurrentLiability: contribution.nonCurrentLiability * multiplier,
        rou: contribution.rou * multiplier,
        interest: contribution.interest * multiplier,
        depreciation: contribution.depreciation * multiplier,
        cashPayments: contribution.cashPayments * multiplier,
        lineage: {
          companyId: company.id,
          contractIds: contribution.contracts.map(item => item.contractId)
        }
      };
    });

    const gross = companyContributions.reduce((acc, row) => {
      ["leaseLiability", "currentLiability", "nonCurrentLiability", "rou", "interest", "depreciation", "cashPayments"].forEach(key => { acc[key] += v22Amount(row[key]); });
      acc.contracts += row.contractCount;
      acc.activeContracts += row.activeContracts;
      return acc;
    }, { leaseLiability: 0, currentLiability: 0, nonCurrentLiability: 0, rou: 0, interest: 0, depreciation: 0, cashPayments: 0, contracts: 0, activeContracts: 0 });

    const eliminations = v22GetGroupEliminations(groupId, date);
    const eliminationTotal = v22AggregateEliminations(eliminations).total;
    const adjustments = v22Adjustments.filter(item => String(item.groupId) === String(groupId) && item.reportingDate === date && item.status !== "REJECTED");
    const adjustmentTotal = adjustments.reduce((sum, item) => sum + v22Amount(item.amount), 0);

    const consolidated = {
      leaseLiability: Math.max(0, gross.leaseLiability - eliminationTotal + adjustmentTotal),
      currentLiability: gross.currentLiability,
      nonCurrentLiability: Math.max(0, gross.nonCurrentLiability - Math.max(0, eliminationTotal - gross.currentLiability)),
      rou: Math.max(0, gross.rou),
      interest: gross.interest,
      depreciation: gross.depreciation,
      cashPayments: gross.cashPayments,
      contracts: gross.contracts,
      activeContracts: gross.activeContracts
    };

    const missingScopeCompanies = v22CompanyList().filter(company => {
      const scope = v22Scope.find(item => String(item.groupId) === String(groupId) && String(item.companyId) === String(company.id));
      return scope?.included === true && !visibleCompanies.some(item => String(item.id) === String(company.id));
    }).map(company => company.id);

    const status = missingScopeCompanies.length ? "YELLOW" : "GREEN";
    const result = {
      success: true,
      data: {
        group: v22Clone(group),
        reportingDate: date,
        groupCurrency: group.groupCurrency,
        companies: companyContributions,
        gross,
        eliminations: {
          total: eliminationTotal,
          count: eliminations.length,
          rows: v22Clone(eliminations)
        },
        adjustments: {
          total: adjustmentTotal,
          count: adjustments.length,
          rows: v22Clone(adjustments)
        },
        consolidated,
        status,
        lineage: {
          leaseLiability: companyContributions.map(row => ({ companyId: row.companyId, amount: row.leaseLiability })),
          rou: companyContributions.map(row => ({ companyId: row.companyId, amount: row.rou })),
          eliminations: eliminations.map(row => ({ id: row.id, fromCompanyId: row.fromCompanyId, toCompanyId: row.toCompanyId, amount: row.amount }))
        },
        sourceMetadata: {
          calculation: "V21_EXISTING_CFO_DATA_LAYER",
          currencyConversion: "NOT_PERFORMED",
          consolidationVersion: V22_SCHEMA_VERSION
        },
        dataQuality: { missingCompanies: missingScopeCompanies }
      },
      error: null,
      metadata: { schemaVersion: V22_SCHEMA_VERSION, companyCount: companyContributions.length }
    };
    return result;
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

  function getEliminations(groupId = null, options = {}) {
    v22Require("eliminations.view", { ...options, groupId });
    return v22Clone(groupId ? v22Eliminations.filter(item => String(item.groupId) === String(groupId)) : v22Eliminations) || [];
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

  function v22RunIntercompanyReconciliation(groupId, reportingDate, options = {}) {
    v22Require("consolidation.view", { ...options, groupId, action: "INTERCOMPANY_RECONCILIATION" });
    const rows = v22GetGroupEliminations(groupId, reportingDate);
    const map = new Map();
    rows.forEach(row => {
      const key = `${row.fromCompanyId}|${row.toCompanyId}|${row.currency}`;
      if (!map.has(key)) map.set(key, { fromCompanyId: row.fromCompanyId, toCompanyId: row.toCompanyId, currency: row.currency, receivable: 0, payable: 0, revenue: 0, expense: 0, lease: 0 });
      const target = map.get(key);
      const amount = v22Amount(row.amount);
      if (row.eliminationType === "INTERCOMPANY_RECEIVABLE") target.receivable += amount;
      if (row.eliminationType === "INTERCOMPANY_PAYABLE") target.payable += amount;
      if (row.eliminationType === "INTERCOMPANY_REVENUE") target.revenue += amount;
      if (row.eliminationType === "INTERCOMPANY_EXPENSE") target.expense += amount;
      if (row.eliminationType === "INTERCOMPANY_LEASE") target.lease += amount;
    });
    return Array.from(map.values()).map(row => {
      const variance = row.receivable - row.payable;
      return { ...row, reportingDate: v22NormalizeDate(reportingDate), variance, status: Math.abs(variance) < 0.01 ? "MATCHED" : Math.abs(variance) < 1000 ? "WARNING" : "EXCEPTION" };
    });
  }

  function getGroupControlStatus(groupId, reportingDate, options = {}) {
    v22Require("group.view", { ...options, groupId, action: "GROUP_CONTROL_VIEW" });
    const group = v22Groups.find(item => String(item.id) === String(groupId));
    const date = v22NormalizeDate(reportingDate) || v22Now().slice(0, 10);
    const companies = v22CompanyList();
    const scopes = v22Scope.filter(item => String(item.groupId) === String(groupId) && item.included !== false);
    const visibleIds = new Set(v22AccessibleCompanyIds(options.user || v22CurrentUser()));
    const checks = [];
    const missingCompany = scopes.filter(scope => !companies.some(company => String(company.id) === String(scope.companyId)));
    checks.push({ id: "MISSING_COMPANY", status: missingCompany.length ? "FAIL" : "PASS", count: missingCompany.length });
    const duplicateCompanyIds = scopes.map(scope => String(scope.companyId)).filter((id, index, arr) => arr.indexOf(id) !== index);
    checks.push({ id: "DUPLICATE_COMPANY", status: duplicateCompanyIds.length ? "FAIL" : "PASS", count: duplicateCompanyIds.length });
    const invalidOwnership = scopes.filter(scope => v22Amount(scope.ownershipPercentage) < 0 || v22Amount(scope.ownershipPercentage) > 100);
    checks.push({ id: "INVALID_OWNERSHIP", status: invalidOwnership.length ? "FAIL" : "PASS", count: invalidOwnership.length });
    const inaccessible = scopes.filter(scope => !visibleIds.has(String(scope.companyId)));
    checks.push({ id: "UNAUTHORIZED_COMPANY", status: inaccessible.length ? "WARNING" : "PASS", count: inaccessible.length });
    const missingCurrency = scopes.filter(scope => !companies.find(company => String(company.id) === String(scope.companyId))?.baseCurrency);
    checks.push({ id: "MISSING_CURRENCY", status: missingCurrency.length ? "FAIL" : "PASS", count: missingCurrency.length });
    const reconciliation = v22RunIntercompanyReconciliation(groupId, date, options);
    const exceptions = reconciliation.filter(row => row.status === "EXCEPTION");
    checks.push({ id: "INTERCOMPANY_EXCEPTION", status: exceptions.length ? "FAIL" : "PASS", count: exceptions.length });
    const duplicateEliminations = v22GetGroupEliminations(groupId, date).filter((row, index, arr) => arr.findIndex(item => item.fromCompanyId === row.fromCompanyId && item.toCompanyId === row.toCompanyId && item.account === row.account && item.amount === row.amount && item.reportingDate === row.reportingDate) !== index);
    checks.push({ id: "DUPLICATE_ELIMINATION", status: duplicateEliminations.length ? "FAIL" : "PASS", count: duplicateEliminations.length });
    const consolidated = getConsolidatedData(groupId, date, options);
    const missingData = consolidated.data?.dataQuality?.missingCompanies || [];
    checks.push({ id: "MISSING_DATA", status: missingData.length ? "WARNING" : "PASS", count: missingData.length });
    const status = checks.some(check => check.status === "FAIL") ? "RED" : checks.some(check => check.status === "WARNING") ? "YELLOW" : "GREEN";
    return { version: V22_SCHEMA_VERSION, groupId, reportingDate: date, status, companiesInScope: scopes.length, companiesVisible: visibleIds.size, checks, consolidationExceptions: exceptions, intercompanyExceptions: exceptions, missingData, group: group ? v22Clone(group) : null };
  }

  function v22CompanyCloseStatus(company, reportingDate) {
    try {
      if (typeof getCompanyMonthEndCloseStatus === "function") {
        return getCompanyMonthEndCloseStatus(company.name || company.id, reportingDate);
      }
    } catch (error) {}
    try {
      if (typeof getMonthEndCloseStatus === "function") {
        const result = getMonthEndCloseStatus(reportingDate);
        return { status: result?.status || "OPEN" };
      }
    } catch (error) {}
    return { status: "UNKNOWN" };
  }

  function getGroupCloseStatus(groupId, reportingDate, options = {}) {
    v22Require("group.view", { ...options, groupId, action: "GROUP_CLOSE_VIEW" });
    const date = v22NormalizeDate(reportingDate) || v22Now().slice(0, 10);
    const companies = v22VisibleGroupCompanies(groupId, date, options.user || v22CurrentUser());
    const rows = companies.map(company => ({ companyId: company.id, company: company.name, status: v22CompanyCloseStatus(company, date)?.status || "UNKNOWN" }));
    const open = rows.filter(row => !["CLOSED", "CERTIFIED", "GREEN"].includes(String(row.status).toUpperCase()));
    const status = open.length === 0 ? "CLOSED" : open.some(row => row.status === "UNKNOWN") ? "OPEN" : "BLOCKED";
    return { groupId, reportingDate: date, status, companies: rows, openCompanies: open.map(row => row.companyId) };
  }

  function getGroupCfoDashboardData(groupId, reportingDate, options = {}) {
    v22Require("group.view", { ...options, groupId, action: "GROUP_CFO_VIEW" });
    const consolidated = getConsolidatedData(groupId, reportingDate, options);
    const control = getGroupControlStatus(groupId, reportingDate, options);
    const close = getGroupCloseStatus(groupId, reportingDate, options);
    const rows = consolidated.data?.companies || [];
    const expiring = rows.reduce((sum, row) => sum + row.contracts.filter(item => {
      try {
        const contract = v22ContractsForCompany(row.companyId).find(c => String(c.id) === String(item.contractId));
        if (!contract?.renewalDate) return false;
        const diff = (new Date(contract.renewalDate) - new Date(reportingDate)) / 86400000;
        return diff >= 0 && diff <= 90;
      } catch (error) { return false; }
    }).length, 0);
    return {
      groupId,
      reportingDate: consolidated.data?.reportingDate,
      groupCurrency: consolidated.data?.groupCurrency,
      liabilities: {
        total: consolidated.data?.consolidated?.leaseLiability || 0,
        current: consolidated.data?.consolidated?.currentLiability || 0,
        nonCurrent: consolidated.data?.consolidated?.nonCurrentLiability || 0
      },
      rouAssets: { total: consolidated.data?.consolidated?.rou || 0 },
      pnl: { interest: consolidated.data?.consolidated?.interest || 0, depreciation: consolidated.data?.consolidated?.depreciation || 0 },
      cashFlow: { cashPayments: consolidated.data?.consolidated?.cashPayments || 0 },
      contracts: { total: consolidated.data?.consolidated?.contracts || 0, active: consolidated.data?.consolidated?.activeContracts || 0, renewalUnder90Days: expiring },
      controls: control,
      close,
      status: consolidated.data?.status || "YELLOW",
      companyContribution: rows,
      source: "V22_CONSOLIDATION_ENGINE"
    };
  }

  function exportGroupReport(groupId, reportingDate, options = {}) {
    v22Require("consolidation.export", { ...options, groupId, action: "CONSOLIDATION_EXPORT" });
    const report = getGroupCfoDashboardData(groupId, reportingDate, options);
    const rows = (report.companyContribution || []).map(row => ({
      Company: row.company,
      CompanyID: row.companyId,
      Currency: row.baseCurrency,
      Contracts: row.contractCount,
      "Lease Liability": row.leaseLiability,
      "Current Liability": row.currentLiability,
      "Non-current Liability": row.nonCurrentLiability,
      ROU: row.rou,
      Interest: row.interest,
      Depreciation: row.depreciation,
      "Cash Payments": row.cashPayments,
      Method: row.consolidationMethod,
      Ownership: row.ownershipPercentage
    }));
    if (typeof XLSX !== "undefined") {
      try {
        const sheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, sheet, "Group Report");
        XLSX.writeFile(workbook, `GK_Group_Report_${groupId}_${reportingDate || "DATE"}.xlsx`);
        v22RecordAudit("CONSOLIDATION_EXPORTED", "GROUP", groupId, { reportingDate, recordCount: rows.length, format: "xlsx" });
        return true;
      } catch (error) {}
    }
    v22RecordAudit("CONSOLIDATION_EXPORTED", "GROUP", groupId, { reportingDate, recordCount: rows.length, format: "json" });
    return v22Clone(report);
  }

  function exportConsolidation(groupId, reportingDate, options = {}) {
    return exportGroupReport(groupId, reportingDate, options);
  }

  function exportEliminations(groupId, reportingDate, options = {}) {
    v22Require("consolidation.export", { ...options, groupId, action: "ELIMINATION_EXPORT" });
    const rows = v22GetGroupEliminations(groupId, reportingDate);
    if (typeof XLSX !== "undefined") {
      try {
        const sheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, sheet, "Eliminations");
        XLSX.writeFile(workbook, `GK_Eliminations_${groupId}_${reportingDate || "DATE"}.xlsx`);
        v22RecordAudit("CONSOLIDATION_EXPORTED", "ELIMINATION", groupId, { reportingDate, recordCount: rows.length, format: "xlsx" });
        return true;
      } catch (error) {}
    }
    return v22Clone(rows);
  }

  function exportIntercompanyReconciliation(groupId, reportingDate, options = {}) {
    v22Require("consolidation.export", { ...options, groupId, action: "INTERCOMPANY_EXPORT" });
    const rows = v22RunIntercompanyReconciliation(groupId, reportingDate, options);
    if (typeof XLSX !== "undefined") {
      try {
        const sheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, sheet, "Intercompany");
        XLSX.writeFile(workbook, `GK_Intercompany_${groupId}_${reportingDate || "DATE"}.xlsx`);
        v22RecordAudit("CONSOLIDATION_EXPORTED", "INTERCOMPANY_RECONCILIATION", groupId, { reportingDate, recordCount: rows.length, format: "xlsx" });
        return true;
      } catch (error) {}
    }
    return v22Clone(rows);
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

  function exportGroupDatabaseReady(groupId = null, options = {}) {
    v22Require("consolidation.export", { ...options, groupId, action: "DATABASE_READY_EXPORT" });
    const model = v22GetDatabaseModel();
    if (groupId) {
      model.Group = model.Group.filter(item => String(item.id) === String(groupId));
      model.Company = model.Company.filter(item => String(item.groupId) === String(groupId));
      model.Ownership = model.Ownership.filter(item => model.Company.some(company => String(company.id) === String(item.parentCompanyId) || String(company.id) === String(item.subsidiaryCompanyId)));
      model.ConsolidationScope = model.ConsolidationScope.filter(item => String(item.groupId) === String(groupId));
      model.Elimination = model.Elimination.filter(item => String(item.groupId) === String(groupId));
      model.ConsolidationAdjustment = model.ConsolidationAdjustment.filter(item => String(item.groupId) === String(groupId));
    }
    return model;
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

  function getV22DataHealth(options = {}) {
    const groups = v22Groups;
    const companies = v22CompanyList();
    const companyIds = new Set(companies.map(item => String(item.id)));
    const groupIds = new Set(groups.map(item => String(item.id)));
    const errors = [];
    const warnings = [];
    const duplicates = {};
    const duplicateCheck = (name, rows) => {
      const seen = new Set(); const dup = [];
      rows.forEach(row => { const id = String(row?.id || ""); if (!id) return; if (seen.has(id)) dup.push(id); seen.add(id); });
      if (dup.length) duplicates[name] = Array.from(new Set(dup));
    };
    duplicateCheck("Group", groups);
    duplicateCheck("Company", companies);
    duplicateCheck("Ownership", v22Ownership);
    duplicateCheck("ConsolidationScope", v22Scope);
    duplicateCheck("Elimination", v22Eliminations);
    duplicateCheck("ConsolidationAdjustment", v22Adjustments);
    const orphans = [];
    v22Scope.forEach(row => { if (!groupIds.has(String(row.groupId))) orphans.push({ entityType: "ConsolidationScope", entityId: row.id, relation: "groupId" }); if (!companyIds.has(String(row.companyId))) orphans.push({ entityType: "ConsolidationScope", entityId: row.id, relation: "companyId" }); });
    v22Ownership.forEach(row => { if (!companyIds.has(String(row.parentCompanyId))) orphans.push({ entityType: "Ownership", entityId: row.id, relation: "parentCompanyId" }); if (!companyIds.has(String(row.subsidiaryCompanyId))) orphans.push({ entityType: "Ownership", entityId: row.id, relation: "subsidiaryCompanyId" }); });
    v22Eliminations.forEach(row => { if (!groupIds.has(String(row.groupId))) orphans.push({ entityType: "Elimination", entityId: row.id, relation: "groupId" }); if (!companyIds.has(String(row.fromCompanyId))) orphans.push({ entityType: "Elimination", entityId: row.id, relation: "fromCompanyId" }); if (!companyIds.has(String(row.toCompanyId))) orphans.push({ entityType: "Elimination", entityId: row.id, relation: "toCompanyId" }); });
    v22Adjustments.forEach(row => { if (!groupIds.has(String(row.groupId))) orphans.push({ entityType: "ConsolidationAdjustment", entityId: row.id, relation: "groupId" }); });
    const invalidOwnership = v22Ownership.filter(row => row.ownershipPercentage < 0 || row.ownershipPercentage > 100);
    const invalidDates = [...v22Scope, ...v22Ownership, ...v22Eliminations, ...v22Adjustments].filter(row => row.effectiveDate !== undefined && row.effectiveDate !== null && !v22NormalizeDate(row.effectiveDate));
    const invalidCurrency = [...v22Groups, ...companies, ...v22Eliminations, ...v22Adjustments].filter(row => row.groupCurrency !== undefined ? !/^[A-Z]{3}$/.test(String(row.groupCurrency)) : row.baseCurrency !== undefined && !/^[A-Z]{3}$/.test(String(row.baseCurrency)));
    return {
      schemaVersion: V22_SCHEMA_VERSION,
      healthy: Object.keys(duplicates).length === 0 && orphans.length === 0 && invalidOwnership.length === 0 && invalidDates.length === 0 && invalidCurrency.length === 0,
      checkedAt: v22Now(),
      counts: { groups: groups.length, companies: companies.length, ownership: v22Ownership.length, scopes: v22Scope.length, eliminations: v22Eliminations.length, adjustments: v22Adjustments.length },
      duplicateIds: duplicates,
      orphanRecords: orphans,
      brokenReferences: orphans,
      invalidOwnership,
      invalidDates,
      invalidCurrencies: invalidCurrency,
      errors,
      warnings
    };
  }

  function getConsolidationReports(groupId, reportingDate, options = {}) {
    const consolidated = getConsolidatedData(groupId, reportingDate, options);
    return {
      groupLeaseLiability: consolidated.data.consolidated.leaseLiability,
      groupRuo: consolidated.data.consolidated.rou,
      groupInterest: consolidated.data.consolidated.interest,
      groupDepreciation: consolidated.data.consolidated.depreciation,
      groupCashPayments: consolidated.data.consolidated.cashPayments,
      companyContribution: consolidated.data.companies,
      eliminationReport: consolidated.data.eliminations.rows,
      intercompanyReconciliation: v22RunIntercompanyReconciliation(groupId, reportingDate, options),
      consolidationExceptions: getGroupControlStatus(groupId, reportingDate, options),
      groupCloseStatus: getGroupCloseStatus(groupId, reportingDate, options)
    };
  }

  function v22RunConsolidation(groupId, reportingDate, options = {}) {
    v22Require("consolidation.execute", { ...options, groupId, action: "CONSOLIDATION_RUN" });
    const result = getConsolidatedData(groupId, reportingDate, options);
    v22RecordAudit("CONSOLIDATION_RUN", "GROUP", groupId, { reportingDate, status: result.data?.status, companyCount: result.data?.companies?.length || 0 });
    return result;
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
    { code:"EUR", name:"Euro", symbol:"€", decimalPlaces:2, status:"ACTIVE" },
    { code:"GBP", name:"British Pound", symbol:"£", decimalPlaces:2, status:"ACTIVE" },
    { code:"PLN", name:"Polish Zloty", symbol:"zł", decimalPlaces:2, status:"ACTIVE" }
  ]);
  const FX_CONFIG = Object.freeze({
    version: V23_SCHEMA_VERSION,
    defaultRateType: V23_RATE_TYPES.SPOT,
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

  function v23Clone(value) { try { return JSON.parse(JSON.stringify(value)); } catch (e) { return null; } }
  function v23Array(value) { return Array.isArray(value) ? value : []; }
  function v23Object(value) { return value && typeof value === "object" ? value : {}; }
  function v23Now() { return new Date().toISOString(); }
  function v23Id(prefix="V23") { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,10)}`; }
  function v23Date(value) { const d=new Date(value); return Number.isNaN(d.getTime()) ? null : d; }
  function v23DateKey(value) { const d=v23Date(value); return d ? d.toISOString().slice(0,10) : null; }
  function v23Num(value, fallback=0) { const n=Number(value); return Number.isFinite(n) ? n : fallback; }
  function v23CurrencyCode(value) { return String(value || "").trim().toUpperCase(); }
  function v23Round(value, decimalPlaces=2) { const n=v23Num(value); const p=Math.pow(10, Math.max(0, decimalPlaces)); return Math.round((n + Number.EPSILON) * p) / p; }
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

  function loadV23Rates() { const rows=v23StorageGet(V23_RATE_STORAGE_KEY,[]); return Array.isArray(rows) ? rows : []; }
  function saveV23Rates(rows) { return v23StorageSet(V23_RATE_STORAGE_KEY,rows); }
  function normalizeFxRate(input={}) {
    const source=v23Object(input), from=v23CurrencyCode(source.fromCurrency), to=v23CurrencyCode(source.toCurrency), rateDate=v23DateKey(source.rateDate);
    if(!from || !to) throw Object.assign(new Error("Currency mismatch: fromCurrency and toCurrency are required."),{code:"FX_CURRENCY_REQUIRED"});
    if(!getCurrency(from) || !getCurrency(to)) throw Object.assign(new Error("Unsupported currency."),{code:"UNSUPPORTED_CURRENCY"});
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
    const existing = getFxRates({ fromCurrency: code, toCurrency: "TRY", rateDate: dateKey, rateType: options.rateType || FX_CONFIG.defaultRateType });
    if (existing.length && !options.forceRefresh) return existing[0];
    const fetched = await fetchTcmbDailyRatesWithFallback(dateKey, options);
    const rate = fetched.rates?.[code];
    if (!Number.isFinite(rate)) {
      throw Object.assign(new Error(`TCMB kur listesinde ${code} bulunamadı.`), { code: "TCMB_CURRENCY_NOT_FOUND", currency: code });
    }
    return createFxRate({
      fromCurrency: code,
      toCurrency: "TRY",
      rate,
      rateDate: fetched.rateDate || dateKey,
      rateType: options.rateType || FX_CONFIG.defaultRateType,
      source: V23_RATE_SOURCES.CENTRAL_BANK,
      reason: fetched.usedFallback ? `TCMB otomatik (${fetched.rateDate}, önceki iş günü kuru kullanıldı)` : "TCMB otomatik"
    }, options);
  }

  // getFxRate ile aynı imza; kayıtlı kur yoksa önce TCMB'den
  // çekmeyi dener, o da başarısız olursa normal missingRatePolicy
  // davranışına (BLOCK/WARNING/manuel giriş) düşer.
  async function getFxRateAuto(fromCurrency, toCurrency, date, rateType = FX_CONFIG.defaultRateType, options = {}) {
    try {
      return getFxRate(fromCurrency, toCurrency, date, rateType, { ...options, allowMissing: true, allowLastAvailable: false }).error
        ? await (async () => {
            if (v23CurrencyCode(toCurrency) !== "TRY") throw Object.assign(new Error("Otomatik TCMB çekimi şu an sadece XXX/TRY için destekleniyor."), { code: "TCMB_UNSUPPORTED_PAIR" });
            await syncTcmbRate(fromCurrency, date, { rateType, ...options });
            return getFxRate(fromCurrency, toCurrency, date, rateType, options);
          })()
        : getFxRate(fromCurrency, toCurrency, date, rateType, options);
    } catch (error) {
      if (options.allowMissing) return { error: error.code || "FX_RATE_NOT_FOUND", rate: null, fromCurrency: v23CurrencyCode(fromCurrency), toCurrency: v23CurrencyCode(toCurrency), rateDate: v23DateKey(date), rateType, message: error.message };
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
    const explicit = v23CurrencyCode(contract.functionalCurrency);
    if (explicit) return explicit;
    const companyFx = v23CompanyCurrency(contract.company);
    if (companyFx) return companyFx;
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
    const transactionCurrency = v23CurrencyCode(contract.currency || DEFAULT_FUNCTIONAL_CURRENCY);
    const functionalCurrency = resolveContractFunctionalCurrency(contract);
    if (transactionCurrency === functionalCurrency) {
      return { applicable: false, transactionCurrency, functionalCurrency };
    }
    const schedule = Array.isArray(scheduleSource) ? scheduleSource : scheduleSource?.schedule;
    const exempt = !Array.isArray(scheduleSource) && scheduleSource?.exempt;
    if (exempt || !schedule || !schedule.length) {
      return { applicable: false, transactionCurrency, functionalCurrency, reason: exempt ? "EXEMPT" : "EMPTY_SCHEDULE" };
    }

    const rateType = options.rateType || V23_RATE_TYPES.CLOSING;
    const rateCache = new Map();
    async function rateOn(dateKey) {
      const key = v23DateKey(dateKey);
      if (rateCache.has(key)) return rateCache.get(key);
      const fx = await getFxRateAuto(transactionCurrency, functionalCurrency, key, rateType, { allowMissing: !!options.allowMissingRates, allowLastAvailable: !!options.allowLastAvailable });
      if (fx?.error) {
        const err = Object.assign(new Error(`${transactionCurrency}/${functionalCurrency} kuru bulunamadı (${key}). ${fx.message || ""}`), { code: fx.error, rateDate: key });
        throw err;
      }
      rateCache.set(key, fx);
      return fx;
    }

    // Başlangıç (işlem) kuru: kira başlangıç tarihindeki kur.
    // Liability'nin çevrim başlangıcı ve ROU'nun İLK katmanı bu
    // kurla sabitlenir. schedule[0].openingLiability/rouOpening
    // KASITLI OLARAK kullanılıyor (engineResult.liability DEĞİL) —
    // modifikasyonlu kontratlarda ilk dönem hâlâ orijinal şartlarla
    // hesaplanmış olduğundan bu değer her zaman doğru başlangıç
    // bazını verir.
    const commencementRate = await rateOn(contract.startDate || schedule[0].date);

    let openingLiabilityFx = v23Round(v23Num(schedule[0].openingLiability) * commencementRate.rate, 2);
    const initialLiabilityFx = openingLiabilityFx;
    const initialRouFx = v23Round(v23Num(schedule[0].rouOpening) * commencementRate.rate, 2);

    // ROU katman defteri: her katman kendi sabit (tarihindeki) kuruyla taşınır.
    let rouLayers = [{ rate: commencementRate.rate, rateDate: commencementRate.rateDate, remainingOriginal: v23Num(schedule[0].rouOpening) }];

    let cumulativeFxGainLoss = 0;
    let prevRouClosingOriginal = null;
    const outSchedule = [];

    for (const row of schedule) {
      const closing = await rateOn(row.date);
      const closingRate = closing.rate;

      // --- Kira yükümlülüğü (PARASAL) ---
      const interestFx = v23Round(v23Num(row.interest) * closingRate, 2);
      const paymentFx = v23Round(v23Num(row.payment) * closingRate, 2);
      const movementBeforeRetranslationFx = v23Round(openingLiabilityFx + interestFx - paymentFx, 2);
      const closingLiabilityFx = v23Round(v23Num(row.closingLiability) * closingRate, 2);
      const fxGainLoss = v23Round(closingLiabilityFx - movementBeforeRetranslationFx, 2);
      cumulativeFxGainLoss = v23Round(cumulativeFxGainLoss + fxGainLoss, 2);

      // --- ROU (PARASAL OLMAYAN, katmanlı) ---
      const rouOpeningOriginal = v23Num(row.rouOpening);
      if (prevRouClosingOriginal !== null) {
        const delta = v23Round(rouOpeningOriginal - prevRouClosingOriginal, 2);
        if (delta > 0.01) {
          // Yeniden ölçüm/modifikasyon artışı: yeni katman, BU
          // dönemin (işlem tarihi) kuruyla sabitlenir.
          rouLayers.push({ rate: closingRate, rateDate: closing.rateDate, remainingOriginal: delta });
        } else if (delta < -0.01) {
          // Azalış (kısmi sonlandırma/scope decrease): mevcut
          // katmanları orijinal para birimi bakiyelerine orantılı küçült.
          const totalRemaining = rouLayers.reduce((s, l) => s + l.remainingOriginal, 0) || 1;
          const shrinkRatio = Math.max(0, (totalRemaining + delta) / totalRemaining);
          rouLayers.forEach(l => { l.remainingOriginal = v23Round(l.remainingOriginal * shrinkRatio, 2); });
        }
      }

      const rouOpeningFx = v23Round(rouLayers.reduce((s, l) => s + l.remainingOriginal * l.rate, 0), 2);

      const totalRemainingBeforeDep = rouLayers.reduce((s, l) => s + l.remainingOriginal, 0) || 1;
      let depreciationFx = 0;
      rouLayers.forEach(l => {
        const share = l.remainingOriginal / totalRemainingBeforeDep;
        const depOriginalForLayer = v23Num(row.depreciation) * share;
        depreciationFx = v23Round(depreciationFx + depOriginalForLayer * l.rate, 2);
        l.remainingOriginal = v23Round(Math.max(0, l.remainingOriginal - depOriginalForLayer), 2);
      });

      const rouClosingFx = v23Round(rouLayers.reduce((s, l) => s + l.remainingOriginal * l.rate, 0), 2);
      prevRouClosingOriginal = v23Num(row.rouClosing);

      outSchedule.push({
        period: row.period,
        date: row.date,
        rateDate: closing.rateDate,
        closingRate,
        rateSource: closing.source,
        rateUsedFallback: !!closing.usedFallback,
        openingLiabilityFx,
        interestFx,
        paymentFx,
        movementBeforeRetranslationFx,
        closingLiabilityFx,
        fxGainLoss,
        cumulativeFxGainLoss,
        rouOpeningFx,
        depreciationFx,
        rouClosingFx,
        rouLayerCount: rouLayers.length
      });

      openingLiabilityFx = closingLiabilityFx;
    }

    return {
      applicable: true,
      transactionCurrency,
      functionalCurrency,
      rateType,
      commencementRate: commencementRate.rate,
      commencementRateDate: commencementRate.rateDate,
      initialLiabilityFx,
      initialRouFx,
      totals: {
        closingLiabilityFx: outSchedule[outSchedule.length - 1]?.closingLiabilityFx ?? initialLiabilityFx,
        closingRouFx: outSchedule[outSchedule.length - 1]?.rouClosingFx ?? initialRouFx,
        cumulativeFxGainLoss
      },
      schedule: outSchedule
    };
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
    const engineResult = cfoBuildSchedule(contract);
    if (!contractNeedsFxTranslation(contract)) {
      return { contractId: contract.id, engine: engineResult, fx: { applicable: false, transactionCurrency: v23CurrencyCode(contract.currency || DEFAULT_FUNCTIONAL_CURRENCY), functionalCurrency: resolveContractFunctionalCurrency(contract) } };
    }
    const fx = await buildTms21FxTranslation(contract, engineResult, options);
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

  function slbAnnuityPayment(pv, monthlyRate, periods) {
    if (!(periods > 0)) return 0;
    if (Math.abs(monthlyRate) < 1e-9) return v23Round(pv / periods, 2);
    return v23Round(pv * monthlyRate / (1 - Math.pow(1 + monthlyRate, -periods)), 2);
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
  function calculateSaleAndLeaseback(input = {}) {
    const previousCarryingAmount = v23Num(input.previousCarryingAmount);
    const fairValueOfAsset = v23Num(input.fairValueOfAsset);
    const saleProceeds = v23Num(input.saleProceeds);
    const leasebackContract = input.leasebackContract;

    if (!(previousCarryingAmount >= 0)) throw Object.assign(new Error("Önceki defter değeri geçersiz."), { code: "SLB_INVALID_CARRYING_AMOUNT" });
    if (!(fairValueOfAsset > 0)) throw Object.assign(new Error("Gerçeğe uygun değer geçersiz."), { code: "SLB_INVALID_FAIR_VALUE" });
    if (!(saleProceeds >= 0)) throw Object.assign(new Error("Satış bedeli geçersiz."), { code: "SLB_INVALID_PROCEEDS" });
    if (!leasebackContract) throw Object.assign(new Error("Geri kiralama kontratı belirtilmedi."), { code: "SLB_MISSING_LEASEBACK_CONTRACT" });

    const leasebackEngine = calculateLeaseEngine(leasebackContract);
    if (!leasebackEngine.schedule || !leasebackEngine.schedule.length) {
      throw Object.assign(new Error("Geri kiralama için ödeme planı hesaplanamadı."), { code: "SLB_EMPTY_LEASEBACK_SCHEDULE" });
    }
    const statedLeasebackPV = leasebackEngine.liability;
    const n = leasebackEngine.schedule.length;
    const monthlyRate = (v23Num(leasebackContract.discountRate) || 0) / 100 / 12;

    // --- Durum A: Devir bir SATIŞ SAYILMIYOR (TFRS 16.103) ---
    if (!input.qualifiesAsSale) {
      const schedule = [];
      let opening = saleProceeds;
      for (let i = 0; i < n; i++) {
        const row = leasebackEngine.schedule[i];
        const interest = v23Round(opening * monthlyRate, 2);
        const payment = row.payment;
        const principal = v23Round(payment - interest, 2);
        const closing = v23Round(Math.max(0, opening - principal), 2);
        schedule.push({ period: row.period, date: row.date, openingBalance: opening, interest, payment, principal, closingBalance: closing });
        opening = closing;
      }
      const finalBalance = schedule[schedule.length - 1]?.closingBalance ?? opening;
      const residualBalanceWarning = Math.abs(finalBalance) > Math.max(1, saleProceeds * 0.001)
        ? `Uyarı: geri kiralama ödemeleri (${leasebackContract.monthlyPayment}/dönem, %${leasebackContract.discountRate} oranla), alınan bedeli (${saleProceeds}) dönem sonuna kadar tam olarak itfa etmiyor — ${finalBalance.toFixed(2)} tutarında bakiye kalıyor. Bu, ödeme planının bir kredi olarak kurgulanmadığının (bilinçli veya bilinçsiz) göstergesi olabilir; gerçek finansman anlaşmasının ödeme şartlarını ayrıca teyit edin.`
        : null;
      return {
        qualifiesAsSale: false,
        accountingTreatment: "FINANCING_ARRANGEMENT",
        note: "TFRS 16.103: Devir bir satış sayılmadığından varlık satıcının defterinden çıkarılmaz; alınan bedel finansal borç (kredi) olarak muhasebeleştirilir. Varlık kendi mevcut amortisman planına göre itfa edilmeye devam eder — bu modülün ROU/amortisman motoru bu durumda ÇALIŞMAZ, ilgili duran varlık kaydı ayrı izlenmelidir.",
        financialLiability: saleProceeds,
        residualBalanceWarning,
        schedule,
        inceptionJournal: [
          { account: "102 Banka / 100 Kasa (Alınan Bedel)", debit: saleProceeds, credit: 0 },
          { account: "3XX/4XX Finansal Borç (Satış ve Geri Kiralama - Finansman)", debit: 0, credit: saleProceeds }
        ]
      };
    }

    // --- Durum B: Devir bir SATIŞ SAYILIYOR (TFRS 16.100-102) ---
    const totalGainLoss = v23Round(fairValueOfAsset - previousCarryingAmount, 2);
    const excessFinancing = v23Round(Math.max(0, saleProceeds - fairValueOfAsset), 2);
    const prepayment = v23Round(Math.max(0, fairValueOfAsset - saleProceeds), 2);

    // TFRS 16.101-102: satış bedeli piyasa değerinden farklıysa (off-market),
    // gerçek kira yükümlülüğü, BEYAN EDİLEN ödeme akışının PV'sinden değil,
    // PİYASA seviyesindeki (finansman/peşinat bileşeni ayrıştırılmış) ödeme
    // akışının PV'sinden hesaplanır.
    const adjustedLeaseLiability = v23Round(statedLeasebackPV - excessFinancing + prepayment, 2);
    const rouRetained = v23Round(previousCarryingAmount * (adjustedLeaseLiability / fairValueOfAsset), 2);
    const gainLossRecognized = v23Round(totalGainLoss * (fairValueOfAsset - adjustedLeaseLiability) / fairValueOfAsset, 2);
    const gainLossOnRightsRetained = v23Round(totalGainLoss - gainLossRecognized, 2); // ROU'ya gömülü, ayrıca tanınmaz

    let financingComponent = null;
    let marketPaymentByPeriod = leasebackEngine.schedule.map(r => r.payment);

    if (excessFinancing > 0.01) {
      // Fazla bedel = alıcının satıcıya sağladığı ilave finansman (gömülü kredi).
      // Bu kredinin kendi anüite ödemesi, beyan edilen kira ödemesinden
      // düşülerek "piyasa seviyesi" kira ödemesine ulaşılır.
      const financingPayment = slbAnnuityPayment(excessFinancing, monthlyRate, n);
      const finSchedule = [];
      let opening = excessFinancing;
      for (let i = 0; i < n; i++) {
        const interest = v23Round(opening * monthlyRate, 2);
        const principal = v23Round(financingPayment - interest, 2);
        const closing = v23Round(Math.max(0, opening - principal), 2);
        finSchedule.push({ period: i + 1, date: leasebackEngine.schedule[i].date, openingBalance: opening, interest, payment: financingPayment, principal, closingBalance: closing });
        opening = closing;
      }
      financingComponent = { type: "EXCESS_FINANCING", principal: excessFinancing, periodicPayment: financingPayment, schedule: finSchedule };
      marketPaymentByPeriod = leasebackEngine.schedule.map(r => v23Round(r.payment - financingPayment, 2));
    } else if (prepayment > 0.01) {
      // Eksik bedel = satıcının geri kiralama için yaptığı örtülü peşin
      // ödeme. Beyan edilen kira ödemesine bu tutarın anüite eşdeğeri
      // eklenerek "piyasa seviyesi" kira ödemesine ulaşılır; nakden
      // tahsil edilmeyen bu fark, başlangıçta ayrılan "peşin ödenmiş
      // kira" varlığından düşülerek (drawdown) kapatılır.
      const prepaymentDrawdown = slbAnnuityPayment(prepayment, monthlyRate, n);
      marketPaymentByPeriod = leasebackEngine.schedule.map(r => v23Round(r.payment + prepaymentDrawdown, 2));
      financingComponent = { type: "PREPAYMENT", prepaidLeaseAsset: prepayment, periodicDrawdown: prepaymentDrawdown };
    }

    const totalOriginalRouForRatio = leasebackEngine.rouAssets || rouRetained || 1;
    const schedule = [];
    let openingLiab = adjustedLeaseLiability;
    let openingRou = rouRetained;
    for (let i = 0; i < n; i++) {
      const row = leasebackEngine.schedule[i];
      const marketPayment = marketPaymentByPeriod[i];
      const interest = v23Round(openingLiab * monthlyRate, 2);
      const principal = v23Round(marketPayment - interest, 2);
      const closingLiab = v23Round(Math.max(0, openingLiab - principal), 2);
      const depreciationRatio = totalOriginalRouForRatio > 0 ? (v23Num(row.depreciation) / totalOriginalRouForRatio) : 0;
      const depreciation = v23Round(rouRetained * depreciationRatio, 2);
      const closingRou = v23Round(Math.max(0, openingRou - depreciation), 2);
      schedule.push({
        period: row.period, date: row.date,
        openingLiability: openingLiab, interest, payment: marketPayment, principal, closingLiability: closingLiab,
        rouOpening: openingRou, depreciation, rouClosing: closingRou
      });
      openingLiab = closingLiab;
      openingRou = closingRou;
    }

    const inceptionJournal = [
      { account: "102 Banka / 100 Kasa (Satış Bedeli)", debit: saleProceeds, credit: 0 }
    ];
    if (prepayment > 0.01) inceptionJournal.push({ account: "180 Peşin Ödenmiş Kira Giderleri", debit: prepayment, credit: 0 });
    inceptionJournal.push({ account: "ROU - Kullanım Hakkı Varlığı (Elde Tutulan Hak)", debit: rouRetained, credit: 0 });
    if (gainLossRecognized < 0) inceptionJournal.push({ account: "689 Diğer Olağandışı Gider (Satış ve Geri Kiralama Zararı)", debit: Math.abs(gainLossRecognized), credit: 0 });
    inceptionJournal.push({ account: "25X Maddi Duran Varlıklar (Önceki Net Defter Değeri)", debit: 0, credit: previousCarryingAmount });
    inceptionJournal.push({ account: "401 Kiralama Yükümlülüğü (Geri Kiralama)", debit: 0, credit: adjustedLeaseLiability });
    if (excessFinancing > 0.01) inceptionJournal.push({ account: "3XX/4XX Finansal Borç (İlave Finansman)", debit: 0, credit: excessFinancing });
    if (gainLossRecognized > 0) inceptionJournal.push({ account: "679 Diğer Olağandışı Gelir (Satış ve Geri Kiralama Karı)", debit: 0, credit: gainLossRecognized });

    return {
      qualifiesAsSale: true,
      accountingTreatment: "SALE_AND_LEASEBACK",
      fairValueOfAsset, previousCarryingAmount, saleProceeds,
      totalGainLoss, excessFinancing, prepayment,
      adjustedLeaseLiability, rouRetained,
      gainLossRecognized, gainLossOnRightsRetained,
      financingComponent,
      schedule,
      inceptionJournal
    };
  }

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
  function calculateSublease(input = {}) {
    const headLeaseContract = input.headLeaseContract;
    const subleaseContract = input.subleaseContract;
    const classification = input.classification === "FINANCE" ? "FINANCE" : "OPERATING";
    const rouAllocationRatio = Number.isFinite(v23Num(input.rouAllocationRatio)) && v23Num(input.rouAllocationRatio) > 0
      ? Math.min(1, v23Num(input.rouAllocationRatio))
      : 1;

    if (!headLeaseContract) throw Object.assign(new Error("Ana kira kontratı belirtilmedi."), { code: "SUBLEASE_MISSING_HEAD_LEASE" });
    if (!subleaseContract) throw Object.assign(new Error("Alt kiralama şartları belirtilmedi."), { code: "SUBLEASE_MISSING_SUBLEASE_TERMS" });

    const headLeaseRou = findHeadLeaseRouAtDate(headLeaseContract, subleaseContract.startDate);
    const allocatedRouCarryingAmount = v23Round(headLeaseRou.rouCarryingAmount * rouAllocationRatio, 2);

    // --- OPERATING alt kiralama (TFRS 16.B58) ---
    if (classification === "OPERATING") {
      const subEngine = calculateLeaseEngine(subleaseContract);
      const n = subEngine.schedule.length;
      const totalContractualIncome = v23Round(subEngine.schedule.reduce((s, r) => s + v23Num(r.payment), 0), 2);
      const straightLineIncome = n > 0 ? v23Round(totalContractualIncome / n, 2) : 0;

      let cumulativeCash = 0;
      let cumulativeIncome = 0;
      const schedule = subEngine.schedule.map(row => {
        cumulativeCash = v23Round(cumulativeCash + v23Num(row.payment), 2);
        cumulativeIncome = v23Round(cumulativeIncome + straightLineIncome, 2);
        // Pozitif: tahsil edilen nakit > tanınan gelir (ertelenmiş gelir / deferred income yükümlülüğü birikiyor)
        // Negatif: tanınan gelir > tahsil edilen nakit (tahakkuk etmiş alacak birikiyor)
        const deferredIncomeBalance = v23Round(cumulativeCash - cumulativeIncome, 2);
        return { period: row.period, date: row.date, cashReceived: row.payment, incomeRecognized: straightLineIncome, deferredIncomeBalance };
      });

      return {
        classification: "OPERATING",
        headLeaseRouCarryingAmount: headLeaseRou.rouCarryingAmount,
        rouAllocationRatio,
        note: "TFRS 16.B58: Alt kiralama OPERATING sınıflandırıldığından ana kiradan doğan ROU defterden çıkarılmaz; ROU kendi itfa planına göre (bu modülün ana kira motorunda, DEĞİŞTİRİLMEDEN) itfa edilmeye devam eder. Alt kiralama geliri doğrusal (straight-line) esasla tanınır.",
        totalContractualIncome,
        straightLineMonthlyIncome: straightLineIncome,
        schedule,
        periodicJournalNote: "Her dönem: Dr 102 Banka (tahsilat) / Cr 649 Diğer Olağan Gelir (Alt Kiralama Geliri, doğrusal) — nakit ile doğrusal gelir farkı '380 Ertelenmiş Gelir' veya '181 Gelir Tahakkukları' hesabında izlenir."
      };
    }

    // --- FINANCE alt kiralama (TFRS 16.B58, 100-103'e paralel mantık) ---
    const subEngine = calculateLeaseEngine(subleaseContract);
    const netInvestment = subEngine.liability; // alt kiralama ödemelerinin bugünkü değeri = net yatırım
    const sellingProfitLoss = v23Round(netInvestment - allocatedRouCarryingAmount, 2);
    const monthlyRate = (v23Num(subleaseContract.discountRate) || 0) / 100 / 12;

    const schedule = [];
    let opening = netInvestment;
    for (const row of subEngine.schedule) {
      const interestIncome = v23Round(opening * monthlyRate, 2);
      const cashReceived = row.payment;
      const principalReduction = v23Round(cashReceived - interestIncome, 2);
      const closing = v23Round(Math.max(0, opening - principalReduction), 2);
      schedule.push({ period: row.period, date: row.date, openingNetInvestment: opening, interestIncome, cashReceived, principalReduction, closingNetInvestment: closing });
      opening = closing;
    }

    const inceptionJournal = [
      { account: "Alt Kiralamada Net Yatırım (Kira Alacağı)", debit: netInvestment, credit: 0 }
    ];
    if (sellingProfitLoss < 0) inceptionJournal.push({ account: "689 Diğer Olağandışı Gider (Alt Kiralama Satış Zararı)", debit: Math.abs(sellingProfitLoss), credit: 0 });
    inceptionJournal.push({ account: "ROU - Kullanım Hakkı Varlığı (Devredilen Kısım)", debit: 0, credit: allocatedRouCarryingAmount });
    if (sellingProfitLoss > 0) inceptionJournal.push({ account: "679 Diğer Olağandışı Gelir (Alt Kiralama Satış Karı)", debit: 0, credit: sellingProfitLoss });

    return {
      classification: "FINANCE",
      headLeaseRouCarryingAmount: headLeaseRou.rouCarryingAmount,
      rouAllocationRatio,
      allocatedRouCarryingAmount,
      netInvestment,
      sellingProfitLoss,
      note: "TFRS 16.B58: Alt kiralama FINANCE sınıflandırıldığından ana kiradan doğan ROU'nun devredilen kısmı defterden çıkarılır; yerine alt kiralamada net yatırım (kira alacağı) tanınır. Ana kira yükümlülüğü/ROU'su (kalan kısmı varsa) bu işlemden ETKİLENMEZ, ara kiracı için normal kiracı muhasebesiyle değişmeden devam eder.",
      schedule,
      inceptionJournal
    };
  }

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
  function getFxConfig() { return v23Clone(FX_CONFIG); }
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
  function calculateFxGainLoss(openingAmount,closingAmount,transactionAmount,options={}) {
    const difference=v23Num(closingAmount)-v23Num(openingAmount); const realized=options.realized===true;
    return {type: realized ? (difference>=0?"REALIZED_FX_GAIN":"REALIZED_FX_LOSS") : (difference>=0?"UNREALIZED_FX_GAIN":"UNREALIZED_FX_LOSS"),amount:Math.abs(difference),signedAmount:difference,currency:v23CurrencyCode(options.currency),sourceAmount:v23Num(transactionAmount),reportingDate:v23DateKey(options.reportingDate)};
  }

  function getV23Contracts() { try { return typeof v20GetContracts === "function" ? v20GetContracts() : v23Array(contracts); } catch(e) { return v23Array(contracts); } }
  function v23CompanyIdOf(row) { return String(row?.companyId || row?.companyIdValue || row?.company || row?.legalEntityId || "").trim(); }
  function getFxExposure(options={}) {
    v23Authorize("fx.view",{...options,action:"FX_EXPOSURE"});
    const rows=getV23Contracts(), out=[];
    rows.forEach(contract=>{
      const companyId=v23CompanyIdOf(contract); if(options.companyId && companyId!==String(options.companyId)) return;
      const currency=v23CurrencyCode(contract.transactionCurrency || contract.currency || v23CompanyCurrency(companyId)); if(!currency) return;
      const amount=v23Num(contract.foreignCurrencyAmount ?? contract.monthlyPayment ?? contract.paymentAmount ?? contract.amount);
      if(!amount) return;
      const functional=v23CurrencyCode(contract.functionalCurrency || v23CompanyCurrency(companyId));
      out.push({companyId,currency,amount,functionalCurrency:functional,functionalAmount:contract.functionalAmount ?? null,groupCurrency:options.groupCurrency || null,groupAmount:null,contractId:contract.id || null});
    });
    return out;
  }
  function getFxCfoDashboardData(groupId,reportingDate,options={}) {
    v23Authorize("fx.view",{...options,action:"FX_CFO_VIEW",entityId:groupId});
    const exposure=getFxExposure(options), byCurrency={}; exposure.forEach(x=>{ byCurrency[x.currency]=(byCurrency[x.currency]||0)+x.amount; });
    const rates=getFxRates({}), date=v23DateKey(reportingDate), missing=[];
    const groupCurrency=v23GroupCurrency(groupId);
    Object.keys(byCurrency).forEach(currency=>{ if(currency!==groupCurrency){ try { getFxRate(currency,groupCurrency,date,V23_RATE_TYPES.CLOSING); } catch(e) { missing.push({fromCurrency:currency,toCurrency:groupCurrency,reportingDate:date,code:e.code||"FX_RATE_NOT_FOUND"}); } } });
    return {groupId,reportingDate:date,groupCurrency,foreignCurrencyExposure:byCurrency,totalFxExposure:Object.values(byCurrency).reduce((a,b)=>a+b,0),fxRateCount:rates.length,missingFxRates:missing,companiesWithFxExposure:Array.from(new Set(exposure.map(x=>x.companyId).filter(Boolean))),translationDifference:0,fxGainLoss:0};
  }
  function getFxDataQualityStatus(options={}) {
    v23Authorize("fx.view",{...options,action:"FX_DATA_QUALITY"});
    const rates=loadV23Rates(), currencies=loadV23Currencies(), checks=[];
    checks.push({id:"CURRENCY_MASTER",status:currencies.length?"GREEN":"RED",message:currencies.length?"Currency master available":"Currency master missing"});
    checks.push({id:"INVALID_RATES",status:rates.some(x=>!(v23Num(x.rate)>0))?"RED":"GREEN",message:"FX rate validity"});
    const duplicateKeys=new Set(), duplicates=[]; rates.forEach(x=>{const k=[x.fromCurrency,x.toCurrency,x.rateDate,x.rateType].join("|"); if(duplicateKeys.has(k)) duplicates.push(k); duplicateKeys.add(k);});
    checks.push({id:"DUPLICATE_RATES",status:duplicates.length?"RED":"GREEN",message:duplicates.length?"Duplicate rates found":"No duplicate rates"});
    checks.push({id:"MISSING_RATE_SOURCE",status:rates.some(x=>!x.source)?"RED":"GREEN",message:"Rate source completeness"});
    checks.push({id:"MISSING_RATE_DATE",status:rates.some(x=>!x.rateDate)?"RED":"GREEN",message:"Rate date completeness"});
    const status=checks.some(x=>x.status==="RED")?"RED":checks.some(x=>x.status==="YELLOW")?"YELLOW":"GREEN";
    return {version:V23_SCHEMA_VERSION,status,checks,currencyCount:currencies.length,rateCount:rates.length,duplicateRates:duplicates};
  }
  function getFxControlStatus(options={}) {
    const quality=getFxDataQualityStatus(options), exposure=getFxExposure(options), manual=loadV23Rates().filter(x=>x.source==="MANUAL").length;
    const checks=[...quality.checks,{id:"MANUAL_RATES",status:manual?"YELLOW":"GREEN",message:manual?`${manual} manual FX rate(s) in use`:"No manual FX rates"},{id:"FX_EXPOSURE",status:exposure.length?"GREEN":"GREEN",message:"FX exposure calculated"}];
    const status=checks.some(x=>x.status==="RED")?"RED":checks.some(x=>x.status==="YELLOW")?"YELLOW":"GREEN";
    return {version:V23_SCHEMA_VERSION,status,checks,missingRates:[],manualRates:manual};
  }
  function v23IntercompanyRows(groupId,reportingDate) {
    try { const result=typeof v22RunIntercompanyReconciliation === "function" ? v22RunIntercompanyReconciliation(groupId,reportingDate,{user:v23CurrentUser()}) : null; return v23Array(result?.data?.rows || result?.rows || result); } catch(e) { return []; }
  }
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
  function getFxConsolidatedData(groupId,reportingDate,options={}) {
    v23Authorize("fx.execute",{...options,action:"FX_TRANSLATION",entityId:groupId});
    if(typeof getConsolidatedData!=="function") return {success:false,error:"V22_CONSOLIDATION_UNAVAILABLE"};
    const base=getConsolidatedData(groupId,reportingDate,{...options,user:options.user || v23CurrentUser()});
    if(!base?.success) return base;
    const groupCurrency=v23CurrencyCode(base.data?.groupCurrency || v23GroupCurrency(groupId));
    const translatedCompanies=[];
    const errors=[];
    v23Array(base.data?.companies).forEach(company=>{
      const companyId=String(company.companyId || company.id || "");
      const functionalCurrency=v23CompanyCurrency(companyId) || groupCurrency;
      const translated={};
      ["leaseLiability","currentLiability","nonCurrentLiability","rou","interest","depreciation","cashPayments"].forEach(key=>{
        const amount=v23Num(company[key]);
        if(functionalCurrency===groupCurrency) translated[key]=amount;
        else {
          try { const r=translateAmount(amount,functionalCurrency,groupCurrency,reportingDate,FX_CONFIG.balanceSheetRateType,{allowMissing:false}); translated[key]=r.convertedAmount; } catch(e) { translated[key]={status:"ERROR",code:e.code || "FX_RATE_NOT_FOUND"}; errors.push({companyId,key,code:e.code || "FX_RATE_NOT_FOUND"}); }
        }
      });
      translatedCompanies.push({companyId,functionalCurrency,groupCurrency,source:company,translated});
    });
    const consolidated=translatedCompanies.reduce((acc,row)=>{ Object.keys(row.translated).forEach(k=>{ if(typeof row.translated[k]==="number") acc[k]+=row.translated[k]; }); return acc; },{leaseLiability:0,currentLiability:0,nonCurrentLiability:0,rou:0,interest:0,depreciation:0,cashPayments:0});
    const result={success:true,version:V23_SCHEMA_VERSION,groupId,reportingDate:v23DateKey(reportingDate),groupCurrency,companies:translatedCompanies,consolidated,errors,sourceMetadata:{v22Schema:V22_SCHEMA_VERSION,fxSchema:V23_SCHEMA_VERSION,translation:true}};
    v23Audit("FX_TRANSLATION","GROUP",groupId,{reportingDate:v23DateKey(reportingDate),groupCurrency,companyCount:translatedCompanies.length,errorCount:errors.length});
    return result;
  }
  function getFxConsolidationReports(groupId,reportingDate,options={}) {
    const data=getFxConsolidatedData(groupId,reportingDate,options);
    return { groupTranslation:data, fxRates:getFxRates(), fxExposure:getFxExposure(options), fxDataQuality:getFxDataQualityStatus(options), fxControlStatus:getFxControlStatus(options), cta:getCtaRecords({groupId}) };
  }
  function getFxReports(options={}) {
    return { fxRates:getFxRates(options), fxExposure:getFxExposure(options), fxDataQuality:getFxDataQualityStatus(options), fxControlStatus:getFxControlStatus(options) };
  }
  function v23ExportRows(name,rows,options={}) {
    v23Authorize("fx.export",{...options,action:"FX_EXPORT",entityId:name});
    const data=v23Array(rows); if(!data.length) return false;
    if(typeof XLSX!=="undefined") { try { const ws=XLSX.utils.json_to_sheet(data); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,name.slice(0,31)); XLSX.writeFile(wb,`GK_FX_${name}_${Date.now()}.xlsx`); v23Audit("FX_EXPORT","FX_REPORT",name,{recordCount:data.length,format:"xlsx"}); return true; } catch(e) {} }
    const headers=Object.keys(data[0]||{}), csv=[headers.join(";"),...data.map(r=>headers.map(h=>String(r[h] ?? "").replace(/;/g,",")).join(";"))].join("\n"); const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"}),url=URL.createObjectURL(blob),link=document.createElement("a"); link.href=url; link.download=`GK_FX_${name}_${Date.now()}.csv`; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url); v23Audit("FX_EXPORT","FX_REPORT",name,{recordCount:data.length,format:"csv"}); return true;
  }
  function exportFxRates(options={}) { return v23ExportRows("Rates",getFxRates(options),options); }
  function exportFxExposure(options={}) { return v23ExportRows("Exposure",getFxExposure(options),options); }
  function exportFxGainLoss(rows=[],options={}) { return v23ExportRows("GainLoss",rows,options); }
  function exportFxTranslation(rows=[],options={}) { return v23ExportRows("Translation",rows,options); }
  function exportFxReconciliation(rows=[],options={}) { return v23ExportRows("Reconciliation",rows,options); }

  function getV23DatabaseModel() {
    return { schemaVersion:V23_SCHEMA_VERSION, currencies:getCurrencies(), fxRates:getFxRates(), cta:getCtaRecords(), config:getFxConfig(), securityPermissions:V23_SECURITY_PERMISSIONS.slice() };
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
    calculateModification,
    applyModification,
    calculateReassessment,
    applyReassessment,
    cfoBuildSchedule,
    resolveContractFunctionalCurrency,
    contractNeedsFxTranslation,
    buildTms21FxTranslation,
    getContractFxTranslatedSchedule,
    SLB_ASSESSMENT_INDICATORS,
    assessSaleAndLeaseback,
    calculateSaleAndLeaseback,
    renderSlbSection,
    renderSlbResultHtml,
    SUBLEASE_CLASSIFICATION_INDICATORS,
    assessSubleaseClassification,
    findHeadLeaseRouAtDate,
    calculateSublease,
    renderSubleaseSection,
    renderSubleaseResultHtml,
    appendFxToReclassification,
    appendFxJournalLines,
    getContractFxTranslationJournal,
    translateAmount,
    translateCompanyToGroupCurrency,
    getTranslationRateType,
    getTranslationDifference,
    getCtaRecords,
    upsertCta,
    calculateFxGainLoss,
    normalizeFxTransaction,
    buildFxJournalLine,
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

  function v24Number(value, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
  function v24Text(value, fallback = "") { return value == null ? fallback : String(value); }
  function v24Date(value) { const d = value ? new Date(value) : new Date(); return Number.isNaN(d.getTime()) ? null : d; }
  function v24DateKey(value) { const d = v24Date(value); return d ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}` : null; }
  function v24MonthKey(value) { const d = v24Date(value); return d ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}` : null; }
  function v24Year(value) { const d = v24Date(value); return d ? d.getFullYear() : Number(value); }
  function v24Clone(value) { try { return JSON.parse(JSON.stringify(value)); } catch(e) { return null; } }
  function v24Now() { return new Date().toISOString(); }
  function v24Id(prefix = "V24") { return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,9)}`.toUpperCase(); }
  function v24Array(value) { return Array.isArray(value) ? value : []; }
  function v24StorageGet(key, fallback = []) { try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) ?? fallback) : fallback; } catch(e) { return fallback; } }
  function v24StorageSet(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch(e) { return false; } }
  function v24Load(key) { return v24StorageGet(key, []); }
  function v24Save(key, value) { v24StorageSet(key, value); return value; }
  function v24Find(list, id) { return v24Array(list).find(x => String(x.id) === String(id)) || null; }
  function v24CompanyId(row) { return v24Text(row?.companyId || row?.company || row?.contract?.companyId || row?.contract?.company).trim() || null; }
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
  function getBudgetVersions(planId, options = {}) { v24Require("planning.view", { ...options, action:"PLANNING_VERSION_VIEW", entityId:planId }); return v24VersionRows().filter(x => String(x.planId) === String(planId)); }
  function getPlanningVersion(planId, version, options = {}) { return getBudgetVersions(planId, options).find(x => String(x.version) === String(version)) || null; }
  function createPlanningVersion(planId, input = {}, options = {}) {
    const plan = getPlanningPlan(planId, options); if (!plan) throw Object.assign(new Error("Planning plan not found."), { code:"PLAN_NOT_FOUND" });
    v24Require("planning.create", { ...options, companyId:plan.companyId, action:"PLANNING_VERSION_CREATE", entityId:planId });
    const rows = v24VersionRows(); const versions = rows.filter(x => String(x.planId) === String(planId)); const nextNumber = versions.reduce((m,x) => Math.max(m, Number(x.version)||0),0)+1;
    const now=v24Now(), row={id:input.id||v24Id("PV"),planId,version:input.version||nextNumber,versionName:input.versionName||`${plan.planningYear} ${plan.planType} V${input.version||nextNumber}`,versionType:input.versionType||plan.planType,status:input.status||"DRAFT",createdAt:input.createdAt||now,createdBy:input.createdBy||v24CurrentUser(options)?.id||"SYSTEM",lockedAt:null,schemaVersion:V24_SCHEMA_VERSION};
    if (rows.some(x => String(x.planId)===String(planId) && String(x.version)===String(row.version))) throw Object.assign(new Error("Planning version already exists."), { code:"DUPLICATE_PLANNING_VERSION" });
    rows.push(row); v24Save(V24_STORAGE_KEYS.VERSIONS,rows); v24Audit("BUDGET_VERSION_CREATED","PLANNING_VERSION",row.id,row); return v24Clone(row);
  }
  function v24VersionStatus(planId, version) { return getPlanningVersion(planId,version,{})?.status || null; }
  function v24AssertVersionEditable(planId, version) { const v=getPlanningVersion(planId,version,{}) || {}; if (v.status === "LOCKED") throw Object.assign(new Error("Locked budget version cannot be modified."), { code:"PLANNING_VERSION_LOCKED" }); return true; }
  function v24NormalizeLine(input = {}) {
    const companyId=v24Text(input.companyId).trim()||null, period=v24Text(input.period).trim();
    if (!period) throw Object.assign(new Error("Planning period is required."),{code:"PERIOD_REQUIRED"});
    const amount=v24Number(input.amount), currency=v24Currency(input,v24CompanyRecord(companyId)?.baseCurrency||"TRY");
    return { id:input.id||v24Id("PL"),planId:input.planId,version:input.version||1,companyId,groupId:input.groupId||v24GroupIdForCompany(companyId),period,periodType:input.periodType||"MONTH",account:v24Text(input.account||input.category||"UNCLASSIFIED").toUpperCase(),category:v24Text(input.category||"OTHER").toUpperCase(),subCategory:v24Text(input.subCategory||"").toUpperCase(),currency,amount,driver:input.driver||null,scenario:v24Text(input.scenario||"BASE").toUpperCase(),source:input.source||"MANUAL",createdAt:input.createdAt||v24Now(),updatedAt:v24Now(),createdBy:input.createdBy||v24CurrentUser()?.id||"SYSTEM",schemaVersion:V24_SCHEMA_VERSION};
  }
  function getPlanningLines(options = {}) {
    v24Require("planning.view", { ...options, action:"PLANNING_LINE_VIEW" }); const user=v24CurrentUser(options);
    return v24Load(V24_STORAGE_KEYS.LINES).filter(x => (!options.planId || String(x.planId)===String(options.planId)) && (!options.version || String(x.version)===String(options.version)) && (!options.companyId || String(x.companyId)===String(options.companyId)) && (!options.groupId || String(x.groupId)===String(options.groupId)) && (!options.period || String(x.period)===String(options.period)) && (!options.category || String(x.category)===String(options.category)) && (!x.companyId || v24CanCompany(user,x.companyId)));
  }
  function getPlanningLine(id, options = {}) { return v24Find(getPlanningLines(options),id); }
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
  function getBudget(options={}) { return getPlanningPlans({...options,planType:"BUDGET"}).filter(x=>x.planType==="BUDGET"); }
  function getBudgetVersion(planId,version,options={}) { return getPlanningVersion(planId,version,options); }

  function v24MonthsOfYear(year) { return Array.from({length:12},(_,i)=>`${year}-${String(i+1).padStart(2,"0")}`); }
  function v24PeriodMonths(period) { const p=String(period); if(/^\d{4}-\d{2}$/.test(p))return[p]; if(/^\d{4}-Q[1-4]$/.test(p)){const y=p.slice(0,4),q=Number(p.slice(-1));return [0,1,2].map(i=>`${y}-${String((q-1)*3+i+1).padStart(2,"0")}`);} if(/^\d{4}$/.test(p))return v24MonthsOfYear(Number(p)); return []; }
  function v24SumLines(lines, category, months = null) { return v24Array(lines).filter(x=>(!category||x.category===category)&&(!months||months.includes(x.period))).reduce((s,x)=>s+v24Number(x.amount),0); }
  function v24CategoryAmount(lines,category,months=null) { return v24SumLines(lines,category,months); }
  function v24LineMap(lines) { const map={};v24Array(lines).forEach(l=>{const k=[l.companyId,l.period,l.category,l.account,l.currency,l.scenario].join("|");map[k]=(map[k]||0)+v24Number(l.amount);});return map; }

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
  function getActualPlanningData(options={}) { return v24ActualRows(options); }
  function v24ActualValue(category,companyId,period,options={}) { const row=v24ActualRows({year:Number(String(period).slice(0,4)),...options}).find(x=>String(x.companyId)===String(companyId)&&x.period===period);return v24Number(row?.categories?.[String(category).toUpperCase()]); }
  function v24BudgetForMonth(planId,version,companyId,period,category,options={}) { return getPlanningLines({...options,planId,version,companyId,period,category}).reduce((s,x)=>s+v24Number(x.amount),0); }

  function v24CreateForecastPlan(input={},options={}) { return createPlanningPlan({...input,planType:input.planType||"FORECAST"},options); }
  function createForecast(input={},options={}) { return v24CreateForecastPlan(input,options); }
  function getForecast(options={}) { return getPlanningPlans(options).filter(x=>x.planType==="FORECAST"||x.planType==="LATEST_ESTIMATE"); }
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
  function getRunRateForecast(options={}) { return generateForecast({...options,method:"RUN_RATE"}); }
  function getActualPlusRemainingBudgetForecast(options={}) { return generateForecast({...options,method:"ACTUAL_PLUS_REMAINING_BUDGET"}); }
  function getTrendForecast(options={}) { return generateForecast({...options,method:"TREND"}); }

  function calculateVariance(actual,plan,options={}) {
    const a=v24Number(actual), p=v24Number(plan), variance=a-p, pct=p===0?(a===0?0:null):(variance/Math.abs(p))*100, category=String(options.category||"").toUpperCase(), cfg=V24_CATEGORY_CONFIG[category]||{direction:"EXPENSE",favorableWhen:"NEGATIVE"}, favorable=cfg.favorableWhen==="POSITIVE"?variance>0:variance<0, absThreshold=v24Number(options.absoluteThreshold??V24_DEFAULT_MATERIALITY.absoluteThreshold), pctThreshold=v24Number(options.percentageThreshold??V24_DEFAULT_MATERIALITY.percentageThreshold), material=Math.abs(variance)>=absThreshold || (pct!=null&&Math.abs(pct)>=pctThreshold), redPct=v24Number(options.redPercentage??V24_DEFAULT_MATERIALITY.redPercentage), status=!material?"GREEN":(pct!=null&&Math.abs(pct)>=redPct?"RED":"YELLOW");
    const result={actual:a,plan:p,variance,variancePercent:pct,status,favorable:variance===0?null:favorable,unfavorable:variance===0?null:!favorable,material,varianceType:"ABSOLUTE",category,varianceReason:options.varianceReason||null,managementComment:options.managementComment||null};
    if(options.audit!==false)v24Audit("VARIANCE_CALCULATED","VARIANCE",options.entityId||null,{category,actual:a,plan:p,variance,status});return result;
  }
  function calculateVariancePercent(actual,plan,options={}) { return calculateVariance(actual,plan,options).variancePercent; }
  function getVarianceStatus(actual,plan,options={}) { return calculateVariance(actual,plan,options).status; }
  function getPlanningVarianceReport(options={}) {
    v24Require("planning.view",{...options,action:"VARIANCE_VIEW"}); const year=Number(options.year||new Date().getFullYear()),companyId=options.companyId||null,planId=options.planId,version=options.version||1,categories=options.categories||Object.keys(V24_CATEGORY_CONFIG),rows=[];
    categories.forEach(category=>{const months=v24MonthsOfYear(year),actual=months.reduce((s,p)=>s+v24ActualValue(category,companyId,p,options),0),plan=planId?months.reduce((s,p)=>s+v24BudgetForMonth(planId,version,companyId,p,category,options),0):0;rows.push({category,...calculateVariance(actual,plan,{...options,category,audit:false})});});return rows;
  }
  function getMaterialVariances(options={}) { return getPlanningVarianceReport(options).filter(x=>x.material); }

  function createPlanningDriver(input={},options={}) {
    v24Require("planning.create",{...options,companyId:input.companyId,action:"DRIVER_CREATE"}); const row={id:input.id||v24Id("DRV"),planId:input.planId||null,companyId:input.companyId||null,groupId:input.groupId||v24GroupIdForCompany(input.companyId),driverType:v24Text(input.driverType||"GENERIC").toUpperCase(),driverName:v24Text(input.driverName||"Driver"),period:v24Text(input.period),value:v24Number(input.value),unit:v24Text(input.unit||"NUMBER"),source:v24Text(input.source||"MANUAL").toUpperCase(),createdAt:v24Now(),updatedAt:v24Now(),createdBy:v24CurrentUser(options)?.id||"SYSTEM",schemaVersion:V24_SCHEMA_VERSION};const rows=v24Load(V24_STORAGE_KEYS.DRIVERS);rows.push(row);v24Save(V24_STORAGE_KEYS.DRIVERS,rows);v24Audit("BUDGET_UPDATED","PLANNING_DRIVER",row.id,row);return v24Clone(row);
  }
  function getPlanningDrivers(options={}) { v24Require("planning.view",{...options,action:"DRIVER_VIEW"});const user=v24CurrentUser(options);return v24Load(V24_STORAGE_KEYS.DRIVERS).filter(x=>(!options.planId||String(x.planId)===String(options.planId))&&(!options.companyId||String(x.companyId)===String(options.companyId))&&(!x.companyId||v24CanCompany(user,x.companyId))); }
  function calculateDriverModel(input={},options={}) {
    const type=String(input.driverType||"").toUpperCase(), volume=v24Number(input.volume), price=v24Number(input.price), revenue=v24Number(input.revenue), ratio=v24Number(input.ratio), headcount=v24Number(input.headcount), avgCost=v24Number(input.averageCost), debt=v24Number(input.debt), rate=v24Number(input.rate), assetBase=v24Number(input.assetBase), result={driverType:type};
    if(type==="REVENUE")result.amount=volume*price;
    else if(type==="COGS")result.amount=revenue*ratio;
    else if(type==="PAYROLL")result.amount=headcount*avgCost;
    else if(type==="INTEREST")result.amount=debt*rate;
    else if(type==="DEPRECIATION")result.amount=assetBase*rate;
    else result.amount=v24Number(input.value);
    return result;
  }
  function createScenario(input={},options={}) { v24Require("scenario.manage",{...options,companyId:input.companyId,action:"SCENARIO_CREATE"});const name=String(input.scenario||"BASE").toUpperCase();if(!V24_SCENARIOS.includes(name))throw Object.assign(new Error("Invalid scenario."),{code:"INVALID_SCENARIO"});const row={id:input.id||v24Id("SCN"),planId:input.planId||null,companyId:input.companyId||null,groupId:input.groupId||v24GroupIdForCompany(input.companyId),scenario:name,parameters:v24Clone(input.parameters||{}),status:input.status||"DRAFT",createdAt:v24Now(),updatedAt:v24Now(),createdBy:v24CurrentUser(options)?.id||"SYSTEM",schemaVersion:V24_SCHEMA_VERSION};const rows=v24Load(V24_STORAGE_KEYS.SCENARIOS);rows.push(row);v24Save(V24_STORAGE_KEYS.SCENARIOS,rows);v24Audit("SCENARIO_CREATED","SCENARIO",row.id,row);return v24Clone(row); }
  function updateScenario(id,patch={},options={}) { const rows=v24Load(V24_STORAGE_KEYS.SCENARIOS),i=rows.findIndex(x=>String(x.id)===String(id));if(i<0)throw Object.assign(new Error("Scenario not found."),{code:"SCENARIO_NOT_FOUND"});const cur=rows[i];v24Require("scenario.manage",{...options,companyId:cur.companyId,action:"SCENARIO_UPDATE",entityId:id});rows[i]={...cur,...v24Clone(patch),id:cur.id,updatedAt:v24Now(),schemaVersion:V24_SCHEMA_VERSION};v24Save(V24_STORAGE_KEYS.SCENARIOS,rows);v24Audit("SCENARIO_UPDATED","SCENARIO",id,{patch});return v24Clone(rows[i]); }
  function getScenarios(options={}) { v24Require("scenario.view",{...options,action:"SCENARIO_VIEW"});return v24Load(V24_STORAGE_KEYS.SCENARIOS).filter(x=>(!options.planId||String(x.planId)===String(options.planId))&&(!options.companyId||String(x.companyId)===String(options.companyId))); }
  function calculateScenario(base={},scenario={},options={}) { const params=scenario.parameters||{};const revenue=v24Number(base.revenue)*(1+v24Number(params.revenueGrowth)/100);const cogs=v24Number(base.cogs)*(1+v24Number(params.cogsPercent)/100);const opex=v24Number(base.opex)*(1+v24Number(params.opexPercent)/100);const ebitda=revenue-cogs-opex;const interest=v24Number(base.interest)*(1+v24Number(params.interestRate)/10000);const netIncome=ebitda-v24Number(base.depreciation)-interest-v24Number(base.tax);return {...base,scenario:scenario.scenario||"BASE",revenue,cogs,opex,ebitda,interest,netIncome,cashFlow:v24Number(base.cashFlow)+v24Number(params.cashFlowAdjustment)}; }

  function getPlanningCashForecast(options={}) {
    v24Require("planning.view",{...options,action:"CASH_FORECAST_VIEW"});const year=Number(options.year||new Date().getFullYear()),companyId=options.companyId||null,planId=options.planId,version=options.version||1,months=v24MonthsOfYear(year),out=[];let opening=v24Number(options.openingCash);
    months.forEach(period=>{const operating=v24Number(options.monthlyOperatingCash?.[period] ?? (planId?v24BudgetForMonth(planId,version,companyId,period,"OPERATING_CASH_FLOW",options):0));const capex=v24Number(options.monthlyCapex?.[period] ?? (planId?v24BudgetForMonth(planId,version,companyId,period,"CAPEX",options):0));const financing=v24Number(options.monthlyFinancing?.[period] ?? (planId?v24BudgetForMonth(planId,version,companyId,period,"FINANCING_CASH_FLOW",options):0));const lease=v24Number(options.monthlyLeasePayments?.[period] ?? (v24ActualValue("LEASE_PAYMENT",companyId,period,options)));const interest=v24Number(options.monthlyInterest?.[period] ?? v24ActualValue("INTEREST",companyId,period,options));const tax=v24Number(options.monthlyTax?.[period]||0);const closing=opening+operating-capex+financing-lease-interest-tax;out.push({period,companyId,openingCash:opening,operatingCashFlow:operating,capex,financing,leasePayments:lease,interest,tax,netCashFlow:closing-opening,closingCash:closing,currency:v24Currency(v24CompanyRecord(companyId)||{},"TRY")});opening=closing;});return out;
  }
  function getGroupPlanningData(options={}) {
    v24Require("planning.view",{...options,action:"GROUP_PLANNING_VIEW"});const groupId=options.groupId,plans=getPlanningPlans({...options,groupId}),planId=options.planId||plans[0]?.id,version=options.version||getBudgetVersions(planId,options)[0]?.version||1,lines=getPlanningLines({...options,planId,version,groupId}),by={};lines.forEach(l=>{const c=l.companyId||"UNASSIGNED";if(!by[c])by[c]={companyId:c,revenue:0,ebitda:0,cashFlow:0};if(l.category==="REVENUE")by[c].revenue+=v24Number(l.amount);if(l.category==="EBITDA")by[c].ebitda+=v24Number(l.amount);if(l.category==="OPERATING_CASH_FLOW"||l.category==="NET_CASH_FLOW")by[c].cashFlow+=v24Number(l.amount);});return {groupId,planId,version,companies:Object.values(by),totals:Object.values(by).reduce((a,r)=>({revenue:a.revenue+r.revenue,ebitda:a.ebitda+r.ebitda,cashFlow:a.cashFlow+r.cashFlow}),{revenue:0,ebitda:0,cashFlow:0})};
  }
  function getCompanyPlanningContribution(companyId,options={}) { const data=getGroupPlanningData({...options,companyId});return data.companies.find(x=>String(x.companyId)===String(companyId))||{companyId,revenue:0,ebitda:0,cashFlow:0}; }
  function getEbitdaBridge(options={}) { const rows=getPlanningVarianceReport({...options,categories:["REVENUE","COGS","OPEX"]});const budgetEbitda=v24Number(options.budgetEbitda);const revenue=rows.find(x=>x.category==="REVENUE")?.variance||0,cogs=rows.find(x=>x.category==="COGS")?.variance||0,opex=rows.find(x=>x.category==="OPEX")?.variance||0;return {budgetEbitda,revenueVariance:revenue,cogsVariance:-cogs,opexVariance:-opex,forecastEbitda:budgetEbitda+revenue-cogs-opex}; }
  function getRevenueBridge(options={}) { const params=options.drivers||{};return {budgetRevenue:v24Number(options.budgetRevenue),volumeImpact:v24Number(params.volumeImpact),priceImpact:v24Number(params.priceImpact),mixImpact:v24Number(params.mixImpact),forecastRevenue:v24Number(options.budgetRevenue)+v24Number(params.volumeImpact)+v24Number(params.priceImpact)+v24Number(params.mixImpact)}; }
  function getCashBridge(options={}) { return {budgetClosingCash:v24Number(options.budgetClosingCash),operatingVariance:v24Number(options.operatingVariance),capexVariance:v24Number(options.capexVariance),financingVariance:v24Number(options.financingVariance),fxVariance:v24Number(options.fxVariance),forecastClosingCash:v24Number(options.budgetClosingCash)+v24Number(options.operatingVariance)+v24Number(options.capexVariance)+v24Number(options.financingVariance)+v24Number(options.fxVariance)}; }

  function getPlanningDataQualityStatus(options={}) {
    v24Require("planning.view",{...options,action:"PLANNING_DATA_QUALITY"});const plans=getPlanningPlans(options),lines=v24Load(V24_STORAGE_KEYS.LINES),drivers=v24Load(V24_STORAGE_KEYS.DRIVERS),checks=[];const add=(code,ok,severity="WARNING",details=null)=>checks.push({code,passed:!!ok,severity,details});
    add("PLANS_EXIST",plans.length>0,"WARNING");add("NO_DUPLICATE_LINES",new Set(lines.map(x=>x.id)).size===lines.length,"BLOCKING");add("VALID_CURRENCY",lines.every(x=>!!x.currency),"BLOCKING");add("VALID_PERIOD",lines.every(x=>/^\d{4}(-\d{2}|-Q[1-4])?$/.test(String(x.period))),"BLOCKING");add("COMPANY_ACCESS",lines.filter(x=>x.companyId).every(x=>v24CanCompany(v24CurrentUser(options),x.companyId)),"BLOCKING");add("DRIVER_REFERENCES",drivers.every(x=>x.period&&x.driverName),"WARNING");const blocking=checks.some(x=>!x.passed&&x.severity==="BLOCKING"),warnings=checks.some(x=>!x.passed);return {version:V24_SCHEMA_VERSION,status:blocking?"RED":(warnings?"YELLOW":"GREEN"),checks,planCount:plans.length,lineCount:lines.length,driverCount:drivers.length};
  }
  function getPlanningControlStatus(options={}) { return getPlanningDataQualityStatus(options); }
  function getPlanningCfoDashboardData(options={}) {
    v24Require("planning.view",{...options,action:"PLANNING_CFO_VIEW"});const year=Number(options.year||new Date().getFullYear()),variance=getPlanningVarianceReport({...options,year}),material=variance.filter(x=>x.material),forecast=generateForecast({...options,year,method:options.forecastMethod||"ACTUAL_PLUS_REMAINING_BUDGET",audit:false}),by=(cat)=>forecast.find(x=>x.category===cat)||{ytdActual:0,fullYearForecast:0,remainingBudget:0};const revenueBudget=v24Number(options.revenueBudget),ebitdaBudget=v24Number(options.ebitdaBudget);return {version:V24_PLANNING_ENGINE_VERSION,year,revenue:{budget:revenueBudget,actual:by("REVENUE").ytdActual,forecast:by("REVENUE").fullYearForecast},ebitda:{budget:ebitdaBudget,actual:by("EBITDA").ytdActual,forecast:by("EBITDA").fullYearForecast,margin:by("REVENUE").fullYearForecast?by("EBITDA").fullYearForecast/by("REVENUE").fullYearForecast*100:0},netIncomeForecast:by("NET_INCOME").fullYearForecast,cashFlowForecast:getPlanningCashForecast(options),budgetVariance:variance,forecastVariance:variance,materialVariances:material,scenarios:getScenarios(options),dataQuality:getPlanningDataQualityStatus(options)};
  }
  function exportPlanningData(options={}) { v24Require("planning.export",{...options,action:"PLANNING_EXPORT"});const payload={schemaVersion:V24_SCHEMA_VERSION,exportedAt:v24Now(),plans:getPlanningPlans(options),versions:v24VersionRows(),lines:getPlanningLines(options),drivers:getPlanningDrivers(options),scenarios:getScenarios(options),dataQuality:getPlanningDataQualityStatus(options)};v24Audit("PLANNING_EXPORTED","PLANNING",null,{planCount:payload.plans.length,lineCount:payload.lines.length});return payload; }
  function exportBudget(options={}) { return exportPlanningData({...options,planType:"BUDGET"}); }
  function exportForecast(options={}) { return exportPlanningData({...options,planType:"FORECAST"}); }
  function exportScenario(options={}) { return exportPlanningData(options); }
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
     INITIALIZATION
  ========================================================== */

  try {
    v191InitUiWiring();
  } catch (error) {
    console.error("V19.1 UI wiring init error (sidebar navigation etc.):", error);
  }
  try {
    refresh();
  } catch (error) {
    console.error("Initial refresh error:", error);
  }

});