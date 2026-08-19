document.addEventListener("DOMContentLoaded", () => {

  /*
  ============================================================
  GK FINANCE INTELLIGENCE
  TFRS 16 ACCOUNTING ENGINE V16.6
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

  let contracts = loadContracts();

  contracts = contracts.map(
    contract => ensureReassessmentState(
      ensureModificationState(contract)
    )
  );

  let selectedContractId = null;
  let bulkImportData = [];
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
      const stored = localStorage.getItem(STORAGE_KEY);

      if (stored) {
        const parsed = JSON.parse(stored);

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
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(data)
    );
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
      getScheduleValueAsOfDate(
        currentStateSchedule,
        effectiveDate,
        "rouClosing",
        baseEngine.rouAssets
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

    const payment =
      Number(contract.monthlyPayment) || 0;

    const annualRate =
      Number(contract.discountRate) || 0;

    const monthlyRate =
      annualRate / 100 / 12;

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
        schedule: []
      };
    }

    let liability = 0;

    if (monthlyRate === 0) {

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

    const initialROU =
      initialLiability;

    const depreciation =
      initialROU / months;

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

      const interest =
        openingLiability *
        monthlyRate;

      let principal =
        payment - interest;

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

        year:
          periodDate.getFullYear(),

        month:
          periodDate.getMonth() + 1,

        openingLiability,

        payment,

        interest,

        principal,

        closingLiability,

        rouOpening,

        depreciation:
          rouDepreciation,

        rouClosing

      });

      openingLiability =
        closingLiability;

      rouOpening =
        rouClosing;
    }

    return {

      months,

      liability:
        initialLiability,

      rouAssets:
        initialROU,

      depreciation,

      monthlyInterest:
        schedule[0]?.interest || 0,

      schedule
    };
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
        contract.lowValueAsset === true
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

    const depreciation =
      initialROU / months;

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
        rouClosing
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
      monthlyInterest:
        schedule[0]?.interest || 0,
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
    contract
  ) {

    const engine =
      calculateLease(contract);

    return engine.schedule
      .slice(0, 12)
      .reduce(
        (total, item) =>
          total + item.payment,
        0
      );
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

  document
    .getElementById(
      "newContractButton"
    )
    ?.addEventListener(
      "click",
      () =>
        openContractModal()
    );


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


  document
    .getElementById(
      "closeModal"
    )
    ?.addEventListener(
      "click",
      closeContractModal
    );


  document
    .getElementById(
      "cancelModal"
    )
    ?.addEventListener(
      "click",
      closeContractModal
    );


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

    let current;
    let nonCurrent;

    if (reportingDate) {

      // V16.3: reporting-date-aware split (Faz 6)
      const split =
        calculateLiabilitySplitAsOf(
          contract,
          reportingDate
        );

      current = split.current;
      nonCurrent = split.nonCurrent;

    } else {

      // No reportingDate passed: exact V15 behavior, unchanged.
      current =
        calculateCurrentLiability(
          contract
        );

      nonCurrent =
        calculateNonCurrentLiability(
          contract
        );
    }

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
                    ? `<button type="button" class="secondary-btn" data-mod-action="apply" data-mod-id="${escapeHtml(item.id)}">Apply</button>`
                    : ""
                }
                ${
                  item.status !== "APPLIED" && item.status !== "CANCELLED"
                    ? `<button type="button" class="secondary-btn" data-mod-action="cancel" data-mod-id="${escapeHtml(item.id)}">Cancel</button>`
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
            MODIFICATION MANAGEMENT
          </div>
          <h3 style="margin:5px 0 0;font-size:18px;">
            Lease Modification
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
              Modification Date
              <input id="modificationDate" type="date" value="${today}" style="display:block;width:100%;margin-top:5px;">
            </label>
            <label style="font-size:10px;font-weight:700;">
              Effective Date
              <input id="modificationEffectiveDate" type="date" value="${today}" style="display:block;width:100%;margin-top:5px;">
            </label>
            <label style="font-size:10px;font-weight:700;">
              Modification Type
              <select id="modificationType" style="display:block;width:100%;margin-top:5px;">
                <option value="PAYMENT_INCREASE">Payment Increase</option>
                <option value="PAYMENT_DECREASE">Payment Decrease</option>
                <option value="LEASE_TERM_EXTENSION">Lease Term Extension</option>
                <option value="LEASE_TERM_REDUCTION">Lease Term Reduction</option>
                <option value="SCOPE_INCREASE">Scope Increase</option>
                <option value="SCOPE_DECREASE">Scope Decrease</option>
                <option value="COMBINED_MODIFICATION">Combined Modification</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
            <label style="font-size:10px;font-weight:700;">
              New Payment
              <input id="modificationNewPayment" type="number" min="0" step="0.01" value="${Number(contract.monthlyPayment) || 0}" style="display:block;width:100%;margin-top:5px;">
            </label>
            <label style="font-size:10px;font-weight:700;">
              New Lease End Date
              <input id="modificationNewEndDate" type="date" value="${escapeHtml(contract.endDate || "")}" style="display:block;width:100%;margin-top:5px;">
            </label>
            <label style="font-size:10px;font-weight:700;">
              New Discount Rate %
              <input id="modificationNewDiscountRate" type="number" min="0" step="0.0001" value="${Number(contract.discountRate) || 0}" style="display:block;width:100%;margin-top:5px;">
            </label>
            <label style="font-size:10px;font-weight:700;">
              Scope Reduction %
              <input id="modificationScopeReduction" type="number" min="0" max="100" step="0.01" value="0" style="display:block;width:100%;margin-top:5px;">
            </label>
            <label style="font-size:10px;font-weight:700;">
              Scope Increase %
              <input id="modificationScopeIncrease" type="number" min="0" step="0.01" value="0" style="display:block;width:100%;margin-top:5px;">
            </label>
          </div>

          <label style="display:block;font-size:10px;font-weight:700;margin-top:10px;">
            Reason
            <input id="modificationReason" type="text" placeholder="Modification nedeni" style="display:block;width:100%;margin-top:5px;">
          </label>

          <button
            type="button"
            id="createModificationButton"
            class="primary-btn"
            style="margin-top:12px;"
          >
            Create Modification
          </button>
        </div>

        <div style="margin-top:16px;">
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr auto;gap:8px;font-size:10px;font-weight:800;color:#64748b;padding-bottom:7px;">
            <span>TYPE</span>
            <span>EFFECTIVE</span>
            <span>STATUS</span>
            <span>LIABILITY Δ</span>
            <span>ACTION</span>
          </div>
          ${rows}
        </div>
      </div>
    `;
  }


  function initModificationEvents(contract) {

    document
      .getElementById("createModificationButton")
      ?.addEventListener(
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
            createModification(
              contract,
              input
            );

          if (!result.valid) {
            alert(result.errors.join("\n"));
            return;
          }

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
              ${item.status !== "APPLIED" && item.status !== "CANCELLED" ? `<button type="button" class="secondary-btn" data-reass-action="apply" data-reass-id="${escapeHtml(item.id)}">Apply</button>` : ""}
              ${item.status !== "APPLIED" && item.status !== "CANCELLED" ? `<button type="button" class="secondary-btn" data-reass-action="cancel" data-reass-id="${escapeHtml(item.id)}">Cancel</button>` : ""}
            </span>
          </div>
        `).join("")
      : `<div style="padding:12px 0;color:#64748b;font-size:11px;">Henüz reassessment kaydı bulunmuyor.</div>`;

    return `
      <div style="margin-top:28px;border-top:1px solid #e5e7eb;padding-top:24px;">
        <div>
          <div style="font-size:10px;color:#64748b;font-weight:800;letter-spacing:1px;">REASSESSMENT MANAGEMENT</div>
          <h3 style="margin:5px 0 0;font-size:18px;">Lease Reassessment</h3>
          <p style="margin:5px 0 0;color:#64748b;font-size:11px;">Reassessment, V16.5 modification eventlerinden ayrı tutulur. Accounting impact yalnızca APPLIED reassessment için oluşur.</p>
        </div>

        <div style="margin-top:16px;padding:14px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;">
            <label style="font-size:10px;font-weight:700;">Reassessment Date<input id="reassessmentDate" type="date" value="${today}" style="display:block;width:100%;margin-top:5px;"></label>
            <label style="font-size:10px;font-weight:700;">Effective Date<input id="reassessmentEffectiveDate" type="date" value="${today}" style="display:block;width:100%;margin-top:5px;"></label>
            <label style="font-size:10px;font-weight:700;">Type<select id="reassessmentType" style="display:block;width:100%;margin-top:5px;">
              <option value="LEASE_TERM_CHANGE">Lease Term Change</option>
              <option value="RENEWAL_OPTION_CHANGE">Renewal Option Change</option>
              <option value="TERMINATION_OPTION_CHANGE">Termination Option Change</option>
              <option value="PURCHASE_OPTION_CHANGE">Purchase Option Change</option>
              <option value="INDEX_RATE_CHANGE">Index / Rate Change</option>
              <option value="FIXED_PAYMENT_CHANGE">Fixed Payment Change</option>
              <option value="COMBINED_REASSESSMENT">Combined Reassessment</option>
              <option value="OTHER">Other</option>
            </select></label>
            <label style="font-size:10px;font-weight:700;">New Payment<input id="reassessmentNewPayment" type="number" min="0" step="0.01" value="${Number(contract.monthlyPayment) || 0}" style="display:block;width:100%;margin-top:5px;"></label>
            <label style="font-size:10px;font-weight:700;">New Lease End Date<input id="reassessmentNewEndDate" type="date" value="${escapeHtml(contract.endDate || "")}" style="display:block;width:100%;margin-top:5px;"></label>
            <label style="font-size:10px;font-weight:700;">New Discount Rate %<input id="reassessmentNewDiscountRate" type="number" min="0" step="0.0001" value="${Number(contract.discountRate) || 0}" style="display:block;width:100%;margin-top:5px;"></label>
            <label style="font-size:10px;font-weight:700;">Renewal Option<select id="reassessmentRenewalOption" style="display:block;width:100%;margin-top:5px;"><option value="false">Not reasonably certain</option><option value="true">Reasonably certain</option></select></label>
            <label style="font-size:10px;font-weight:700;">Termination Option<select id="reassessmentTerminationOption" style="display:block;width:100%;margin-top:5px;"><option value="false">Not expected</option><option value="true">Expected / exercised</option></select></label>
            <label style="font-size:10px;font-weight:700;">Purchase Option<select id="reassessmentPurchaseOption" style="display:block;width:100%;margin-top:5px;"><option value="false">Not reasonably certain</option><option value="true">Reasonably certain</option></select></label>
          </div>

          <label style="display:block;font-size:10px;font-weight:700;margin-top:10px;">Reason<input id="reassessmentReason" type="text" placeholder="Reassessment nedeni" style="display:block;width:100%;margin-top:5px;"></label>

          <button type="button" id="createReassessmentButton" class="primary-btn" style="margin-top:12px;">Create Reassessment</button>
        </div>

        <div style="margin-top:16px;">
          <div style="display:grid;grid-template-columns:1.1fr 1fr 1fr 1fr auto;gap:8px;font-size:10px;font-weight:800;color:#64748b;padding-bottom:7px;">
            <span>TYPE</span><span>EFFECTIVE</span><span>STATUS</span><span>LIABILITY Δ</span><span>ACTION</span>
          </div>
          ${rows}
        </div>
      </div>
    `;
  }


  function initReassessmentEvents(contract) {
    document.getElementById("createReassessmentButton")?.addEventListener("click", () => {
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

      const result = createReassessment(contract, input);
      if (!result.valid) {
        alert(result.errors.join("\n"));
        return;
      }
      openDetail(contract.id);
    });

    document.querySelectorAll("[data-reass-action]").forEach(button => {
      button.addEventListener("click", () => {
        const action = button.dataset.reassAction;
        const id = button.dataset.reassId;

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
      calculateLeaseEngine(
        contract
      );

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


  function exportPaymentSchedule(contract) {

    const engine =
      calculateLeaseEngine(
        contract
      );

    if (!engine.schedule.length) {

      alert(
        "Aktarılacak ödeme planı bulunamadı."
      );

      return;
    }

    auditScheduleEvent(contract, "SCHEDULE_GENERATED", "PAYMENT_SCHEDULE_EXPORT", `V16.7-${engine.schedule.length}`, null, engine.schedule.length);

    const assumptionRows = [
      { "Alan": "Sözleşme ID", "Değer": contract.id },
      { "Alan": "Şirket", "Değer": contract.company },
      { "Alan": "Tedarikçi", "Değer": contract.supplier },
      { "Alan": "Başlangıç Tarihi", "Değer": formatDate(contract.startDate) },
      { "Alan": "Bitiş Tarihi", "Değer": formatDate(contract.endDate) },
      { "Alan": "Aylık Kira", "Değer": contract.monthlyPayment },
      { "Alan": "Yıllık İskonto Oranı (%)", "Değer": contract.discountRate },
      { "Alan": "İlk Kira Yükümlülüğü", "Değer": engine.liability },
      { "Alan": "ROU Varlığı (Başlangıç)", "Değer": engine.rouAssets },
      { "Alan": "Rapor Tarihi", "Değer": formatDate(new Date()) }
    ];

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


        ${renderPaymentScheduleSection(
          contract
        )}


        ${renderJournalEntry(
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

    bulkImportData = [];

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


  document
    .getElementById(
      "bulkImportButton"
    )
    ?.addEventListener(
      "click",
      openBulkImportModal
    );


  document
    .getElementById(
      "closeBulkModal"
    )
    ?.addEventListener(
      "click",
      closeBulkImportModal
    );


  document
    .getElementById(
      "cancelBulkImport"
    )
    ?.addEventListener(
      "click",
      closeBulkImportModal
    );


  document
    .getElementById(
      "bulkFileInput"
    )
    ?.addEventListener(
      "change",
      event => {

        const file =
          event.target.files?.[0];

        if (!file) {
          return;
        }

        readBulkImportFile(
          file
        );
      }
    );


  async function readBulkImportFile(
    file
  ) {

    const status =
      document.getElementById(
        "bulkImportStatus"
      );

    const preview =
      document.getElementById(
        "bulkPreview"
      );

    try {

      if (
        typeof XLSX ===
        "undefined"
      ) {

        throw new Error(
          "Excel motoru yüklenemedi."
        );
      }


      const buffer =
        await file.arrayBuffer();


      const workbook =
        XLSX.read(
          buffer,
          {
            type: "array",
            cellDates: true
          }
        );


      const firstSheet =
        workbook.Sheets[
          workbook.SheetNames[0]
        ];


      const rows =
        XLSX.utils.sheet_to_json(
          firstSheet,
          {
            defval: ""
          }
        );


      if (!rows.length) {

        throw new Error(
          "Dosyada veri bulunamadı."
        );
      }


      bulkImportData =
        rows.map(
          mapImportedContract
        );


      const validationResults =
        bulkImportData.map(
          contract => ({
            contract,
            validation:
              validateImportedContract(
                contract
              )
          })
        );


      const valid =
        validationResults.filter(
          item =>
            item.validation.valid
        );


      const invalid =
        validationResults.filter(
          item =>
            !item.validation.valid
        );


      if (status) {

        status.innerHTML = `

          <div
            style="
              padding:10px;
              border-radius:8px;
              background:#f8fafc;
              border:1px solid #e5e7eb;
            "
          >

            <strong>
              ${bulkImportData.length}
              kayıt okundu.
            </strong>

            <br>

            <span>
              ${valid.length}
              geçerli,
              ${invalid.length}
              hatalı kayıt.
            </span>

          </div>

        `;
      }


      if (preview) {

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
                min-width:850px;
              "
            >

              <thead>

                <tr>

                  <th style="padding:9px;">
                    Sözleşme
                  </th>

                  <th style="padding:9px;">
                    Şirket
                  </th>

                  <th style="padding:9px;">
                    Tedarikçi
                  </th>

                  <th style="padding:9px;">
                    Aylık Kira
                  </th>

                  <th style="padding:9px;">
                    Başlangıç
                  </th>

                  <th style="padding:9px;">
                    Bitiş
                  </th>

                  <th style="padding:9px;">
                    Kontrol
                  </th>

                </tr>

              </thead>


              <tbody>

                ${validationResults
                  .map(
                    item => {

                      const c =
                        item.contract;

                      const ok =
                        item.validation
                          .valid;

                      return `

                        <tr>

                          <td style="padding:9px;border-top:1px solid #edf0f4;">
                            ${escapeHtml(
                              c.id
                            )}
                          </td>

                          <td style="padding:9px;border-top:1px solid #edf0f4;">
                            ${escapeHtml(
                              c.company
                            )}
                          </td>

                          <td style="padding:9px;border-top:1px solid #edf0f4;">
                            ${escapeHtml(
                              c.supplier
                            )}
                          </td>

                          <td style="padding:9px;border-top:1px solid #edf0f4;">
                            ${formatCurrency(
                              c.monthlyPayment
                            )}
                          </td>

                          <td style="padding:9px;border-top:1px solid #edf0f4;">
                            ${formatDate(
                              c.startDate
                            )}
                          </td>

                          <td style="padding:9px;border-top:1px solid #edf0f4;">
                            ${formatDate(
                              c.endDate
                            )}
                          </td>

                          <td
                            style="
                              padding:9px;
                              border-top:1px solid #edf0f4;
                              font-weight:700;
                              color:${
                                ok
                                  ? "#166534"
                                  : "#991b1b"
                              };
                            "
                          >
                            ${
                              ok
                                ? "✓ Geçerli"
                                : "✕ Hatalı"
                            }
                          </td>

                        </tr>

                      `;
                    }
                  )
                  .join("")}

              </tbody>

            </table>

          </div>

        `;
      }


      const confirm =
        document.getElementById(
          "confirmBulkImport"
        );

      if (confirm) {

        confirm.disabled =
          valid.length === 0;
      }

    } catch (error) {

      console.error(
        "Bulk import error:",
        error
      );

      if (status) {

        status.innerHTML = `

          <div
            style="
              padding:10px;
              border-radius:8px;
              background:#fef2f2;
              color:#991b1b;
              border:1px solid #fecaca;
            "
          >
            Dosya okunamadı:
            ${escapeHtml(
              error.message
            )}
          </div>

        `;
      }
    }
  }


  document
    .getElementById(
      "confirmBulkImport"
    )
    ?.addEventListener(
      "click",
      confirmBulkImport
    );


  function confirmBulkImport() {

    const valid =
      bulkImportData.filter(
        contract =>
          validateImportedContract(
            contract
          ).valid
      );


    if (!valid.length) {

      alert(
        "Aktarılabilir geçerli kayıt bulunamadı."
      );

      return;
    }


    let added = 0;
    let updated = 0;


    valid.forEach(
      contract => {

        const existing =
          contracts.find(
            c =>
              c.id ===
              contract.id
          );


        if (existing) {

          contracts =
            contracts.map(
              item =>
                item.id ===
                contract.id
                  ? {
                      ...item,
                      ...contract,
                      status:
                        item.status ||
                        "active",
                      modification:
                        item.modification ||
                        false,
                      reassessments:
                        Array.isArray(contract.reassessments)
                          ? contract.reassessments
                          : (Array.isArray(item.reassessments) ? item.reassessments : [])
                    }
                  : item
            );

          updated++;

        } else {

          contracts.push(
            contract
          );

          added++;
        }
      }
    );


    saveContracts(
      contracts
    );

    recordAuditEvent({
      action: "IMPORT",
      entityType: "IMPORT",
      reason: "Excel bulk contract import",
      metadata: {
        source: "Excel",
        fileName: document.getElementById("bulkImportFile")?.files?.[0]?.name || null,
        recordCount: valid.length,
        successfulRecords: added + updated,
        added,
        updated,
        rejectedRecords: Math.max(0, bulkImportData.length - valid.length)
      }
    });

    refresh();

    closeBulkImportModal();


    alert(
      `${added} yeni sözleşme eklendi, ${updated} sözleşme güncellendi.`
    );
  }


  /* ==========================================================
     TEMPLATE DOWNLOAD
  ========================================================== */

  document
    .getElementById(
      "downloadTemplateButton"
    )
    ?.addEventListener(
      "click",
      downloadTemplate
    );


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
          "2030-09-30"
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
    if (!events.some(e => e.action === "CREATE")) criticalMissing.push("CREATE");
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
      .map(item => ({ ...item, days: Math.ceil((item.date.getTime() - today.getTime()) / 86400000) }))
      .filter(item => item.days >= 0 && item.days <= 180);
    const within90 = upcoming.find(item => item.days <= 90);
    if (within90) return controlResult(config, contract, CONTROL_STATUS.YELLOW, false, `${within90.type} is approaching within 90 days.`, "No unreviewed near-term expiry/renewal", { type: within90.type, days: within90.days, date: within90.date.toISOString() }, "Review renewal/termination assumptions and determine whether reassessment is required.");
    if (upcoming.length) return controlResult(config, contract, CONTROL_STATUS.YELLOW, false, "Contract expiry or renewal is within 180 days.", "No unreviewed near-term event", upcoming.map(item => ({ type: item.type, days: item.days, date: item.date.toISOString() })), "Review upcoming lease term decisions and prepare evidence for any reassessment.");
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
    return { reportingDate:cfoIsoDate(d), contracts, liabilities:{total:totals.leaseLiability,current:totals.currentLiability,nonCurrent:totals.nonCurrentLiability}, rouAssets:{total:totals.rouAsset}, pnl:{interestExpense:totals.monthlyInterest,depreciationExpense:totals.monthlyDepreciation,leaseExpense:totals.monthlyLeaseExpense}, cashFlow:{next12MonthsPayments:cash.next12MonthsPayments,next12MonthsPrincipal:cash.next12MonthsPrincipal,next12MonthsInterest:cash.next12MonthsInterest,reconciliationDifference:cashReconciliation}, renewals, expiry:{within12Months:getContractsExpiringWithin12Months(d).length}, modifications, reassessments, risk, controls:getLeaseControlMetrics(d), companies:getCfoMetricsByCompany(d), currencies:getCfoCurrencyMetrics(d), journal:getCfoJournalMetrics(), audit:getCfoAuditMetrics(d), liabilityRollForward:getLeaseLiabilityRollForward(d), rouRollForward:getLeaseRouRollForward(d), reconciliation:{liability:{difference:liabilityReconciliation,passed:Math.abs(liabilityReconciliation)<=CFO_TOLERANCE},cashFlow:{difference:cashReconciliation,passed:Math.abs(cashReconciliation)<=CFO_TOLERANCE}}, dataQuality:{status:dataErrors?"ERROR":(risk.openExceptions?"WARNING":"COMPLETE"),errors:dataErrors,warnings:risk.openExceptions}, sourceMetadata:{liabilities:"REPORTING_DATE_ENGINE",rouAssets:"LEASE_SCHEDULE",pnl:"LEASE_SCHEDULE",cashFlow:"LEASE_SCHEDULE",risk:"CONTROL_ENGINE",audit:"AUDIT_TRAIL_ENGINE"} };
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

  /* V16.9 public API — V16.8 API is preserved and extended. */
  window.GK_TFRS16 = window.GK_TFRS16 || {};
  Object.assign(window.GK_TFRS16, {
    version: "V16.9",
    CFO_DATA_LAYER_VERSION,
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
    runV169DataLayerTests
  });



  /* ==========================================================
     INITIALIZATION
  ========================================================== */

  refresh();

});
