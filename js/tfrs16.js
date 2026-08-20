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
  ============================================================
  */

  const STORAGE_KEY = "gk_tfrs16_contracts_v7";

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
    const csv = [headers.join(";"), ...rows.map(row => headers.map(h => String(row[h] ?? "").replace(/;/g, ",")).join(";"))].join("
");
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


  function validateModification(contract, input) {
    const errors = [];

    if (!contract) {
      errors.push("Sözleşme bulunamadı.");
      return { valid: false, errors };
    }

    const effectiveDate = parseDate(input?.effectiveDate);
    const modificationDate = parseDate(input?.modificationDate);
    const startDate = parseDate(contract.startDate);
    const currentEndDate = parseDate(contract.endDate);

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

    const type = String(input?.modificationType || "OTHER");
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

    const newPayment = Number(input?.newPayment);
    const newEndDate = parseDate(input?.newLeaseEndDate);
    const newDiscountRate = Number(input?.newDiscountRate);

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


  function getScheduleValueAsOfDate(schedule, date, valueField, fallback) {
    const target = parseDate(date);

    if (!target) {
      return Math.max(0, Number(fallback) || 0);
    }

    const historical = (schedule || []).filter(item => {
      const itemDate = parseDate(item.date);
      return itemDate && itemDate.getTime() <= target.getTime();
    });

    if (!historical.length) {
      return Math.max(0, Number(fallback) || 0);
    }

    return Math.max(
      0,
      Number(historical[historical.length - 1][valueField]) || 0
    );
  }


  function getModificationROUAsOf(contract, effectiveDate, engine) {
    return getScheduleValueAsOfDate(
      engine?.schedule || [],
      effectiveDate,
      "rouClosing",
      engine?.rouAssets || 0
    );
  }


  function buildModificationFuturePayments(contract, effectiveDate, newTerms) {
    const effective = parseDate(effectiveDate);
    const newEnd = parseDate(newTerms.leaseEndDate);

    if (!effective || !newEnd || newEnd <= effective) {
      return [];
    }

    const basePayment = Number(newTerms.payment) || 0;
    const result = [];
    const cursor = new Date(
      effective.getFullYear(),
      effective.getMonth() + 1,
      1
    );

    let period = 1;

    while (cursor.getTime() <= newEnd.getTime()) {
      const contractStart = parseDate(contract.startDate) || effective;

      const globalPeriod = Math.max(
        1,
        (cursor.getFullYear() - contractStart.getFullYear()) * 12 +
        (cursor.getMonth() - contractStart.getMonth()) + 1
      );

      const payment = computeEscalatedPayment(
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


  function calculateModifiedLeaseLiability(contract, effectiveDate, newTerms) {
    const payments = buildModificationFuturePayments(
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
          item.payment / Math.pow(1 + monthlyRate, exponent);
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

    return {
      liability,
      monthlyRate,
      payments,
      schedule
    };
  }


  function buildScheduleFromModificationChain(contract, appliedModifications) {
    const baseContract = contract?.originalContractSnapshot
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

    const baseEngine = calculateLeaseEngine(baseContract);

    let currentSchedule = (baseEngine.schedule || []).map(item => ({ ...item }));

    const ordered = (appliedModifications || [])
      .filter(item => item.status === "APPLIED")
      .slice()
      .sort((a, b) =>
        String(a.effectiveDate || "").localeCompare(
          String(b.effectiveDate || "")
        )
      );

    ordered.forEach(modification => {
      const effectiveDate = parseDate(modification.effectiveDate);
      if (!effectiveDate) return;

      const oldROU = getScheduleValueAsOfDate(
        currentSchedule,
        effectiveDate,
        "rouClosing",
        baseEngine.rouAssets
      );

      const futureResult = calculateModifiedLeaseLiability(
        baseContract,
        effectiveDate,
        modification.newTerms
      );

      const historical = currentSchedule.filter(item => {
        const date = parseDate(item.date);
        return date && date.getTime() <= effectiveDate.getTime();
      });

      let rouOpening = Math.max(
        0,
        oldROU + (Number(modification.rouAdjustment) || 0)
      );

      const remainingMonths = futureResult.schedule.length;
      const depreciation = remainingMonths > 0 ? rouOpening / remainingMonths : 0;
      let rou = rouOpening;

      const future = futureResult.schedule.map((item, index) => {
        const rouDepreciation = Math.min(depreciation, rou);
        const rouClosing = Math.max(0, rou - rouDepreciation);

        const row = {
          ...item,
          period: historical.length + index + 1,
          rouOpening: rou,
          depreciation: rouDepreciation,
          rouClosing
        };

        rou = rouClosing;
        return row;
      });

      currentSchedule = historical.concat(future);
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
    const type = modification.modificationType;

    if (type === "SCOPE_DECREASE") {
      const pct = Math.min(
        100,
        Math.max(0, Number(modification.scopeReductionPercent) || 0)
      ) / 100;

      const rouReduction = oldROU * pct;
      const liabilityReduction = Math.max(
        0,
        oldLeaseLiability - revisedLeaseLiability
      );

      return {
        rouAdjustment: -rouReduction,
        rouReduction,
        gainLoss: liabilityReduction - rouReduction
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


  function calculateModification(contract, input) {
    ensureModificationState(contract);

    const validation = validateModification(contract, input);
    if (!validation.valid) {
      return { valid: false, errors: validation.errors };
    }

    const effectiveDate = parseDate(input.effectiveDate);
    const currentTerms = getModificationCurrentTerms(contract);
    const type = input.modificationType || "OTHER";

    const newTerms = {
      payment: Number.isFinite(Number(input.newPayment))
        ? Number(input.newPayment)
        : currentTerms.payment,
      leaseEndDate: input.newLeaseEndDate
        ? normalizeDate(input.newLeaseEndDate)
        : currentTerms.leaseEndDate,
      discountRate: input.newDiscountRate !== undefined &&
                    input.newDiscountRate !== null &&
                    input.newDiscountRate !== ""
        ? Number(input.newDiscountRate)
        : currentTerms.discountRate
    };

    if (type === "LEASE_TERM_EXTENSION" || type === "LEASE_TERM_REDUCTION") {
      newTerms.payment = currentTerms.payment;
    }

    if (type === "SCOPE_DECREASE" || type === "SCOPE_INCREASE") {
      newTerms.payment = input.newPayment !== undefined && input.newPayment !== ""
        ? Number(input.newPayment)
        : currentTerms.payment;
    }

    if (type === "PAYMENT_INCREASE" || type === "PAYMENT_DECREASE") {
      newTerms.leaseEndDate = currentTerms.leaseEndDate;
    }

    if (type === "SCOPE_INCREASE" && (!input.newLeaseEndDate || input.newLeaseEndDate === "")) {
      newTerms.leaseEndDate = currentTerms.leaseEndDate;
    }

    const appliedBefore = (contract.modifications || []).filter(
      item => item.status === "APPLIED" && item.id !== input.id
    );

    const currentStateSchedule = buildScheduleFromModificationChain(
      contract,
      appliedBefore
    );

    const baseEngine = calculateLeaseEngine(
      contract.originalContractSnapshot || contract
    );

    const oldLeaseLiability = getScheduleValueAsOfDate(
      currentStateSchedule,
      effectiveDate,
      "closingLiability",
      baseEngine.liability
    );

    const oldROU = getModificationROUAsOf(
      contract,
      effectiveDate,
      { schedule: currentStateSchedule, rouAssets: baseEngine.rouAssets }
    );

    const revised = calculateModifiedLeaseLiability(
      contract,
      effectiveDate,
      newTerms
    );

    const revisedLeaseLiability = Math.max(
      0,
      Number(revised.liability) || 0
    );

    const liabilityAdjustment = revisedLeaseLiability - oldLeaseLiability;

    const rou = calculateROUAdjustment(
      {
        ...input,
        scopeReductionPercent: Number(input.scopeReductionPercent) || 0
      },
      oldROU,
      liabilityAdjustment,
      oldLeaseLiability,
      revisedLeaseLiability
    );

    return {
      valid: true,
      modification: {
        id: input.id || modificationId(contract),
        modificationDate: normalizeDate(input.modificationDate),
        effectiveDate: normalizeDate(input.effectiveDate),
        reason: String(input.reason || "").trim(),
        modificationType: type,
        oldTerms: cloneModificationValue(currentTerms),
        newTerms: cloneModificationValue(newTerms),
        oldLeaseLiability,
        revisedLeaseLiability,
        liabilityAdjustment,
        oldROU,
        rouAdjustment: rou.rouAdjustment,
        gainLoss: rou.gainLoss,
        scopeReductionPercent: Number(input.scopeReductionPercent) || 0,
        scopeIncreasePercent: Number(input.scopeIncreasePercent) || 0,
        scopeIncreaseAmount: Number(input.scopeIncreaseAmount) || 0,
        status: input.status || "DRAFT",
        createdAt: input.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      revisedSchedule: revised.schedule,
      revisedPayments: revised.payments
    };
  }


  function buildModifiedSchedule(contract, modification) {
    if (!modification) {
      return calculateLeaseEngine(contract).schedule || [];
    }

    const priorApplied = (contract.modifications || []).filter(
      item => item.status === "APPLIED" && item.id !== modification.id
    );

    const chain = buildScheduleFromModificationChain(contract, priorApplied);
    const effectiveDate = parseDate(modification.effectiveDate);

    if (!effectiveDate) {
      return chain;
    }

    const oldROU = getScheduleValueAsOfDate(
      chain,
      effectiveDate,
      "rouClosing",
      0
    );

    const futureResult = calculateModifiedLeaseLiability(
      contract.originalContractSnapshot || contract,
      effectiveDate,
      modification.newTerms
    );

    const historical = chain.filter(item => {
      const itemDate = parseDate(item.date);
      return itemDate && itemDate.getTime() <= effectiveDate.getTime();
    });

    let rouOpening = Math.max(
      0,
      oldROU + (Number(modification.rouAdjustment) || 0)
    );

    const remainingMonths = futureResult.schedule.length;
    const depreciation = remainingMonths > 0 ? rouOpening / remainingMonths : 0;
    let rou = rouOpening;

    const future = futureResult.schedule.map((item, index) => {
      const rouDepreciation = Math.min(depreciation, rou);
      const rouClosing = Math.max(0, rou - rouDepreciation);

      const row = {
        ...item,
        period: historical.length + index + 1,
        rouOpening: rou,
        depreciation: rouDepreciation,
        rouClosing
      };

      rou = rouClosing;
      return row;
    });

    return historical.concat(future);
  }


  function generateModificationJournal(contract, modification) {
    if (!modification || modification.status !== "APPLIED") {
      return [];
    }

    const liabilityAdjustment = Number(modification.liabilityAdjustment) || 0;
    const rouAdjustment = Number(modification.rouAdjustment) || 0;
    const gainLoss = Number(modification.gainLoss) || 0;
    const entries = [];

    if (modification.modificationType === "SCOPE_DECREASE") {
      const liabilityReduction = Math.max(
        0,
        Number(modification.oldLeaseLiability) -
        Number(modification.revisedLeaseLiability)
      );

      const rouReduction = Math.max(0, -rouAdjustment);

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

    const balanced = Math.abs(debit - credit) < 0.01;

    entries.forEach(item => {
      item.controlStatus = balanced ? "VALID" : "UNBALANCED";
    });

    return entries;
  }


  function createModification(contract, input) {
    ensureModificationState(contract);

    const result = calculateModification(contract, input);

    if (!result.valid) {
      return result;
    }

    contract.modifications.push(result.modification);

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


  function applyModification(contract, modificationIdValue) {
    ensureModificationState(contract);

    const modification = contract.modifications.find(
      item => item.id === modificationIdValue
    );

    if (!modification) {
      return { valid: false, errors: ["Modification bulunamadı."] };
    }

    if (modification.status === "APPLIED") {
      return { valid: true, modification };
    }

    if (modification.status === "CANCELLED") {
      return { valid: false, errors: ["CANCELLED modification uygulanamaz."] };
    }

    const snapshot = cloneModificationValue({
      monthlyPayment: contract.monthlyPayment,
      startDate: contract.startDate,
      endDate: contract.endDate,
      discountRate: contract.discountRate,
      leaseIncreaseType: contract.leaseIncreaseType,
      leaseIncreaseRate: contract.leaseIncreaseRate,
      fixedIncrease: contract.fixedIncrease
    });

    if (!contract.originalContractSnapshot) {
      contract.originalContractSnapshot = cloneModificationValue(contract);
      delete contract.originalContractSnapshot.modifications;
      delete contract.originalContractSnapshot.auditTrail;
      delete contract.originalContractSnapshot.originalContractSnapshot;
    }

    const oldTerms = getModificationCurrentTerms(contract);
    const nextTerms = modification.newTerms || oldTerms;

    contract.monthlyPayment = Number(nextTerms.payment) || 0;
    contract.endDate = nextTerms.leaseEndDate || contract.endDate;
    contract.discountRate = Number(nextTerms.discountRate) || 0;

    modification.status = "APPLIED";
    modification.updatedAt = new Date().toISOString();
    modification.appliedFromTerms = cloneModificationValue(oldTerms);
    modification.appliedToTerms = cloneModificationValue(getModificationCurrentTerms(contract));
    modification.journal = generateModificationJournal(contract, modification);

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
      schedule: buildModifiedSchedule(contract, modification)
    };
  }


  function cancelModification(contract, modificationIdValue) {
    ensureModificationState(contract);

    const modification = contract.modifications.find(
      item => item.id === modificationIdValue
    );

    if (!modification) {
      return { valid: false, errors: ["Modification bulunamadı."] };
    }

    if (modification.status === "APPLIED") {
      return { valid: false, errors: ["APPLIED modification iptal edilemez."] };
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

    return { valid: true, modification };
  }


  function updateModification(contract, modificationIdValue, input) {
    ensureModificationState(contract);

    const existing = contract.modifications.find(
      item => item.id === modificationIdValue
    );

    if (!existing) {
      return { valid: false, errors: ["Modification bulunamadı."] };
    }

    if (existing.status === "APPLIED") {
      return { valid: false, errors: ["APPLIED modification güncellenemez."] };
    }

    const result = calculateModification(contract, {
      ...input,
      id: existing.id,
      createdAt: existing.createdAt,
      status: existing.status
    });

    if (!result.valid) {
      return result;
    }

    const oldValue = cloneModificationValue(existing);
    Object.assign(existing, result.modification);

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

    const applied = contract.modifications.filter(
      item => item.status === "APPLIED"
    );

    return applied.length
      ? applied[applied.length - 1]
      : null;
  }


  function getModifiedCurrentSchedule(contract) {
    const modification = getCurrentAppliedModification(contract);

    if (!modification) {
      return calculateLeaseEngine(contract).schedule || [];
    }

    return buildModifiedSchedule(contract, modification);
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
      return isNaN(value.getTime()) ? null : value;
    }

    const text = String(value).trim();
    if (!text) return null;

    let date = null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      date = new Date(`${text}T00:00:00`);
    } else if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(text)) {
      const p = text.split(".");
      date = new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0]));
    } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(text)) {
      const p = text.split("/");
      date = new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0]));
    } else {
      date = new Date(text);
    }

    return date && !isNaN(date.getTime()) ? date : null;
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
      "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
      "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
    ];

    return months[month - 1] || "";
  }


  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  }


  function setInput(id, value) {
    const input = document.getElementById(id);
    if (input) {
      input.value = value ?? "";
    }
  }


  function getInput(id) {
    return document.getElementById(id)?.value || "";
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
      (endDate.getFullYear() - startDate.getFullYear()) * 12 +
      (endDate.getMonth() - startDate.getMonth());

    return Math.max(1, months + 1);
  }


  /* ==========================================================
     TFRS 16 CALCULATION ENGINE
  ========================================================== */

  function calculateLease(contract) {
    const payment = Number(contract.monthlyPayment) || 0;
    const annualRate = Number(contract.discountRate) || 0;
    const monthlyRate = annualRate / 100 / 12;
    const months = monthsBetween(contract.startDate, contract.endDate);

    if (payment <= 0 || months <= 0) {
      return {
        months: 0,
        liability: 0,
        rouAssets: 0,
        depreciation: 0,
        monthlyInterest: 0,
        schedule: []
      };
    }

    let liability = 0;

    if (monthlyRate === 0) {
      liability = payment * months;
    } else {
      liability =
        payment * ((1 - Math.pow(1 + monthlyRate, -months)) / monthlyRate);
    }

    const initialLiability = liability;
    const initialROU = initialLiability;
    const depreciation = initialROU / months;
    const schedule = [];

    let openingLiability = initialLiability;
    let rouOpening = initialROU;
    const contractStart = parseDate(contract.startDate);

    for (let i = 1; i <= months; i++) {
      const interest = openingLiability * monthlyRate;
      let principal = payment - interest;

      if (principal < 0) principal = 0;
      if (principal > openingLiability) principal = openingLiability;

      const closingLiability = Math.max(0, openingLiability - principal);
      const rouDepreciation = Math.min(depreciation, rouOpening);
      const rouClosing = Math.max(0, rouOpening - rouDepreciation);

      const periodDate = new Date(
        contractStart.getFullYear(),
        contractStart.getMonth() + i - 1,
        1
      );

      schedule.push({
        period: i,
        date: periodDate,
        year: periodDate.getFullYear(),
        month: periodDate.getMonth() + 1,
        openingLiability,
        payment,
        interest,
        principal,
        closingLiability,
        rouOpening,
        depreciation: rouDepreciation,
        rouClosing
      });

      openingLiability = closingLiability;
      rouOpening = rouClosing;
    }

    return {
      months,
      liability: initialLiability,
      rouAssets: initialROU,
      depreciation,
      monthlyInterest: schedule[0]?.interest || 0,
      schedule
    };
  }


  function computeEscalatedPayment(
    basePayment,
    periodIndex,
    escalationType,
    escalationRate,
    fixedIncrease
  ) {
    const contractYearIndex = Math.floor((periodIndex - 1) / 12);

    if (escalationType === "fixedRate") {
      return basePayment * Math.pow(1 + (escalationRate / 100), contractYearIndex);
    }

    if (escalationType === "fixedAmount") {
      return basePayment + (fixedIncrease * contractYearIndex);
    }

    return basePayment;
  }

  function calculateLeaseEngine(contract) {
    const assumptions = {
      paymentFrequency: contract.paymentFrequency || "monthly",
      paymentTiming: contract.paymentTiming || "arrears",
      leaseIncreaseType: contract.leaseIncreaseType || "none",
      leaseIncreaseRate: Number(contract.leaseIncreaseRate) || 0,
      fixedIncrease: Number(contract.fixedIncrease) || 0,
      variablePayment: Number(contract.variablePayment) || 0,
      renewalOption: contract.renewalOption === true,
      terminationOption: contract.terminationOption === true,
      initialDirectCosts: Number(contract.initialDirectCosts) || 0,
      leaseIncentives: Number(contract.leaseIncentives) || 0,
      prepayments: Number(contract.prepayments) || 0,
      restorationObligation: Number(contract.restorationObligation) || 0,
      shortTermLease: contract.shortTermLease === true,
      lowValueAsset: contract.lowValueAsset === true
    };

    if (assumptions.shortTermLease || assumptions.lowValueAsset) {
      const payment = Number(contract.monthlyPayment) || 0;
      const months = monthsBetween(contract.startDate, contract.endDate);
      const contractStart = parseDate(contract.startDate);
      const schedule = [];

      if (payment > 0 && months > 0 && contractStart) {
        for (let i = 1; i <= months; i++) {
          const periodDate = new Date(
            contractStart.getFullYear(),
            contractStart.getMonth() + i - 1,
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

    const payment = Number(contract.monthlyPayment) || 0;
    const annualRate = Number(contract.discountRate) || 0;

    const monthlyRate =
      contract.effectiveMonthlyRate !== undefined &&
      contract.effectiveMonthlyRate !== null &&
      contract.effectiveMonthlyRate !== ""
        ? Number(contract.effectiveMonthlyRate)
        : annualRate / 100 / 12;

    const months = monthsBetween(contract.startDate, contract.endDate);

    if (payment <= 0 || months <= 0) {
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
    const hasEscalation =
      assumptions.leaseIncreaseType === "fixedRate" ||
      assumptions.leaseIncreaseType === "fixedAmount";

    let paymentSchedule = null;

    if (hasEscalation) {
      paymentSchedule = [];

      for (let i = 1; i <= months; i++) {
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
        liability = paymentSchedule.reduce((total, p) => total + p, 0);
      } else {
        liability = paymentSchedule.reduce(
          (total, p, index) =>
            total + p / Math.pow(1 + monthlyRate, index + 1),
          0
        );
      }
    } else if (monthlyRate === 0) {
      liability = payment * months;
    } else {
      liability =
        payment * ((1 - Math.pow(1 + monthlyRate, -months)) / monthlyRate);
    }

    const initialLiability = liability;
    const initialROU =
      initialLiability +
      assumptions.initialDirectCosts +
      assumptions.prepayments -
      assumptions.leaseIncentives +
      assumptions.restorationObligation;

    const depreciation = initialROU / months;
    const schedule = [];

    let openingLiability = initialLiability;
    let rouOpening = initialROU;
    const contractStart = parseDate(contract.startDate);

    for (let i = 1; i <= months; i++) {
      const periodPayment = paymentSchedule ? paymentSchedule[i - 1] : payment;
      const interest = openingLiability * monthlyRate;
      let principal = periodPayment - interest;

      if (principal < 0) principal = 0;
      if (principal > openingLiability) principal = openingLiability;

      const closingLiability = Math.max(0, openingLiability - principal);
      const rouDepreciation = Math.min(depreciation, rouOpening);
      const rouClosing = Math.max(0, rouOpening - rouDepreciation);

      const periodDate = new Date(
        contractStart.getFullYear(),
        contractStart.getMonth() + i - 1,
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
        rouClosing
      });

      openingLiability = closingLiability;
      rouOpening = rouClosing;
    }

    return {
      months,
      liability: initialLiability,
      rouAssets: initialROU,
      depreciation,
      monthlyInterest: schedule[0]?.interest || 0,
      schedule,
      assumptions,
      exempt: false
    };
  }


  function buildQuarterOptions() {
    return [1, 2, 3, 4]
      .map(quarter => `<option value="${quarter}">${quarter}. Çeyrek</option>`)
      .join("");
  }


  function filterSchedule(schedule, year, subPeriod, periodType) {
    if (!schedule || !schedule.length) {
      return [];
    }

    if (periodType === "all") {
      return schedule;
    }

    if (periodType === "annual") {
      return schedule.filter(item => item.year === year);
    }

    if (periodType === "quarterly") {
      const quarter = Number(subPeriod);
      const startMonth = (quarter - 1) * 3 + 1;
      const endMonth = quarter * 3;

      return schedule.filter(
        item =>
          item.year === year &&
          item.month >= startMonth &&
          item.month <= endMonth
      );
    }

    if (periodType === "monthly") {
      const month = Number(subPeriod);
      return schedule.filter(
        item => item.year === year && item.month === month
      );
    }

    return schedule;
  }


  /* ==========================================================
     PERIOD SELECTION
  ========================================================== */

  function getScheduleForYear(contract, year, month, period) {
    const engine = calculateLease(contract);

    if (!engine.schedule.length) {
      return [];
    }

    if (period === "monthly") {
      return engine.schedule.filter(
        item => item.year === year && item.month === month
      );
    }

    if (period === "quarterly") {
      const quarter = Math.ceil(month / 3);
      const startMonth = (quarter - 1) * 3 + 1;
      const endMonth = quarter * 3;

      return engine.schedule.filter(
        item =>
          item.year === year &&
          item.month >= startMonth &&
          item.month <= endMonth
      );
    }

    if (period === "annual") {
      return engine.schedule.filter(item => item.year === year);
    }

    return [];
  }


  /* ==========================================================
     LIABILITY
  ========================================================== */

  function calculateCurrentLiability(contract) {
    const engine = calculateLease(contract);

    return engine.schedule
      .slice(0, 12)
      .reduce((total, item) => total + item.principal, 0);
  }


  function calculateNonCurrentLiability(contract) {
    const engine = calculateLease(contract);
    const current = calculateCurrentLiability(contract);

    return Math.max(0, engine.liability - current);
  }


  /* ==========================================================
     CURRENT / NON-CURRENT — REPORTING DATE BASED (V16.3 / Faz 6)
  ========================================================== */

  function getScheduleAsOfReportingDate(contract, reportingDate) {
    const normalizedReportingDate = parseDate(reportingDate);
    const engine = calculateLeaseEngine(contract);

    if (!normalizedReportingDate) {
      return {
        engine,
        closedPeriods: [],
        futurePeriods: [],
        outstandingLiability: 0,
        valid: false
      };
    }

    const isClosed = item => {
      const itemDate = parseDate(item.date);
      return itemDate ? itemDate.getTime() <= normalizedReportingDate.getTime() : false;
    };

    const closedPeriods = engine.schedule.filter(isClosed);
    const futurePeriods = engine.schedule.filter(item => !isClosed(item));

    const outstandingLiability = closedPeriods.length
      ? Math.max(0, Number(closedPeriods[closedPeriods.length - 1].closingLiability) || 0)
      : Math.max(0, Number(engine.liability) || 0);

    return {
      engine,
      closedPeriods,
      futurePeriods,
      outstandingLiability,
      valid: true
    };
  }


  function calculateLiabilitySplitAsOf(contract, reportingDate, scheduleOverride) {
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

    if (!scheduleData.valid) {
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

    const { futurePeriods, outstandingLiability } = scheduleData;

    const next12Boundary = new Date(
      normalizedReportingDate.getFullYear() + 1,
      normalizedReportingDate.getMonth(),
      normalizedReportingDate.getDate()
    );

    const next12 = futurePeriods.filter(item => {
      const itemDate = parseDate(item.date);
      if (!itemDate) return false;

      return (
        itemDate.getTime() > normalizedReportingDate.getTime() &&
        itemDate.getTime() <= next12Boundary.getTime()
      );
    });

    const current = next12.reduce(
      (total, item) => total + Math.max(0, Number(item.principal) || 0),
      0
    );

    const total = Math.max(0, Number(outstandingLiability) || 0);
    const nonCurrent = Math.max(0, total - current);

    const next12Payments = next12.reduce(
      (totalValue, item) => totalValue + Math.max(0, Number(item.payment) || 0),
      0
    );

    const next12Interest = next12.reduce(
      (totalValue, item) => totalValue + Math.max(0, Number(item.interest) || 0),
      0
    );

    const next12Principal = current;

    return {
      reportingDate: normalizedReportingDate,
      totalLeaseLiability: total,
      currentLiability: current,
      nonCurrentLiability: nonCurrent,
      next12MonthPrincipal: next12Principal,
      next12MonthInterest: next12Interest,
      next12MonthPayments: next12Payments,
      outstandingLiability: total,
      current,
      nonCurrent,
      total,
      next12Payments,
      next12Interest,
      next12Principal,
      valid: true
    };
  }

});
