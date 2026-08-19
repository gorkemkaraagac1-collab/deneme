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

    contract.auditTrail.push({
      timestamp: new Date().toISOString(),
      actor: "CURRENT_USER",
      contractId: contract.id,
      reassessmentId: reassessment?.id || null,
      action,
      oldValue: cloneModificationValue(oldValue),
      newValue: cloneModificationValue(newValue)
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

    contract.auditTrail.push({
      timestamp: new Date().toISOString(),
      actor: "CURRENT_USER",
      contractId: contract.id,
      modificationId: modification?.id || null,
      action,
      oldValue: cloneModificationValue(oldValue),
      newValue: cloneModificationValue(newValue)
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

          contracts =
            contracts.map(
              item =>
                item.id === id
                  ? contract
                  : item
            );

        } else {

          ensureModificationState(contract);
          ensureReassessmentState(contract);

          contracts.push(
            contract
          );
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
     INITIALIZATION
  ========================================================== */

  refresh();

});
