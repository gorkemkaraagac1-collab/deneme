(function exposePrivateTfrs16Facade(global) {
  "use strict";

  function adapter() {
    const value = global.LeaseQantPrivateCalculation;
    if (!value || typeof value.calculate !== "function") {
      throw new Error("TFRS16 private calculation adapter is unavailable");
    }
    return value;
  }

  function copyResult(result) {
    if (!result || typeof result !== "object") {
      throw new Error("TFRS16 private calculation returned an invalid result");
    }
    return {
      ...result,
      schedule: Array.isArray(result.schedule)
        ? result.schedule.map(row => row && typeof row === "object" ? { ...row } : row)
        : [],
      periodEffects: Array.isArray(result.periodEffects)
        ? result.periodEffects.map(effect => effect && typeof effect === "object" ? { ...effect } : effect)
        : [],
      specialFlowsVersion: result.specialFlowsVersion,
      specialFlows: result.specialFlows && typeof result.specialFlows === "object"
        ? Object.fromEntries(Object.entries(result.specialFlows).map(([key, value]) => [
          key,
          value && typeof value === "object" ? { ...value } : value
        ]))
        : {}
    };
  }

  async function load(contract, options) {
    return copyResult(await adapter().calculate(contract, options));
  }

  async function loadMany(contracts, options) {
    const results = await adapter().calculateMany(contracts, options);
    if (!Array.isArray(results)) throw new Error("TFRS16 private batch returned an invalid result");
    return results.map(copyResult);
  }

  async function loadTms29(contract, reportingPeriod, periodStart, options) {
    const value = adapter();
    if (typeof value.calculateTms29 !== "function") {
      throw new Error("TMS29 private calculation adapter is unavailable");
    }
    return copyResult(await value.calculateTms29(contract, reportingPeriod, periodStart, options));
  }

  async function loadTms29Many(contracts, reportingPeriod, periodStart, options) {
    const value = adapter();
    if (typeof value.calculateTms29Many !== "function") {
      throw new Error("TMS29 private batch calculation adapter is unavailable");
    }
    const results = await value.calculateTms29Many(contracts, reportingPeriod, periodStart, options);
    if (!Array.isArray(results)) throw new Error("TMS29 private batch returned an invalid result");
    return results.map(copyResult);
  }

  async function loadReportingDate(contract, reportingDate, options) {
    const value = adapter();
    if (typeof value.calculateReportingDate !== "function") throw new Error("Private reporting-date calculation is unavailable");
    return copyResult(await value.calculateReportingDate(contract, reportingDate, options));
  }

  async function loadTms21(contract, reportingDate, options) {
    const value = adapter();
    if (typeof value.calculateTms21 !== "function") throw new Error("Private TMS21 calculation is unavailable");
    return copyResult(await value.calculateTms21(contract, reportingDate, options));
  }

  async function loadJournal(contract, periodStart, periodEnd, options) {
    const value = adapter();
    if (typeof value.calculateJournal !== "function") throw new Error("Private journal calculation is unavailable");
    return copyResult(await value.calculateJournal(contract, periodStart, periodEnd, options));
  }

  async function loadLeaseDisclosureAvailability(period, options) {
    const value = adapter();
    if (typeof value.getLeaseDisclosureAvailability !== "function") {
      throw new Error("Private disclosure availability adapter is unavailable");
    }
    return value.getLeaseDisclosureAvailability(period, options);
  }

  async function loadJournalAuthorityPackage(intent, bulk, options) {
    const value = adapter();
    if (typeof value.getJournalAuthorityPackage !== "function") {
      const error = new Error("Yevmiye servisi hazır değil");
      error.code = "JOURNAL_AUTHORITY_UNAVAILABLE";
      throw error;
    }
    // Preserve exact journal values/provenance; no calculation-date hydration.
    return value.getJournalAuthorityPackage(intent, bulk, options);
  }

  async function loadLeaseDisclosure(availability, options) {
    const value = adapter();
    if (typeof value.getLeaseDisclosure !== "function") {
      throw new Error("Private disclosure adapter is unavailable");
    }
    return value.getLeaseDisclosure(availability, options);
  }

  async function createTrustedDisclosureSnapshots(contractIds, period, options) {
    const value = adapter();
    if (!Array.isArray(contractIds) || !contractIds.length || contractIds.length > 500
      || contractIds.some(id => (typeof id !== "string" && typeof id !== "number") || !String(id).trim())
      || new Set(contractIds.map(String)).size !== contractIds.length) {
      throw new TypeError("Unique persisted contract IDs are required");
    }
    if (typeof value.executeTrustedDisclosureCalculation !== "function"
      || typeof value.createTrustedDisclosureSnapshot !== "function") {
      throw new Error("Trusted disclosure source production is unavailable");
    }
    const results = [];
    for (const rawId of contractIds) {
      const contractId = String(rawId);
      try {
        const execution = await value.executeTrustedDisclosureCalculation(contractId, period, options);
        if (execution.eligibleForDisclosureSnapshot !== true
          || typeof execution.calculationId !== "string" || !execution.calculationId) {
          throw Object.assign(new Error("The trusted calculation is not eligible for disclosure"), {
            code: "DISCLOSURE_TRUSTED_EXECUTION_NOT_ELIGIBLE"
          });
        }
        const snapshot = await value.createTrustedDisclosureSnapshot(execution.calculationId, options);
        if (typeof snapshot.snapshotId !== "string" || !snapshot.snapshotId
          || String(snapshot.trustedExecutionId) !== execution.calculationId) {
          throw Object.assign(new Error("Trusted disclosure snapshot response is invalid"), {
            code: "DISCLOSURE_SNAPSHOT_RESPONSE_INVALID"
          });
        }
        results.push({ contractId, success: true, calculationId: execution.calculationId,
          snapshotId: snapshot.snapshotId, replayed: execution.replayed === true || snapshot.replayed === true });
      } catch (error) {
        results.push({ contractId, success: false, code: error?.code || "TRUSTED_DISCLOSURE_SOURCE_FAILED" });
      }
    }
    return results;
  }

  async function loadCloseControls(contracts, reportingDate, options) {
    const value = adapter();
    if (typeof value.calculateCloseControls !== "function") {
      throw new Error("Private close controls calculation is unavailable");
    }
    const result = await value.calculateCloseControls(contracts, reportingDate, options);
    if (!result || typeof result !== "object" || !Array.isArray(result.controls)) {
      throw new Error("Private close controls returned an invalid result");
    }
    return result;
  }

  async function loadEarlyPayment(contract, amount, date, options) {
    const value = adapter();
    if (typeof value.calculateEarlyPayment !== "function") throw new Error("Private early-payment calculation is unavailable");
    return copyResult(await value.calculateEarlyPayment(contract, amount, date, options));
  }

  async function loadSaleAndLeaseback(input, options) {
    const value = adapter();
    if (typeof value.calculateSaleAndLeaseback !== "function") throw new Error("Private sale-and-leaseback calculation is unavailable");
    return copyResult(await value.calculateSaleAndLeaseback(input, options));
  }

  async function previewPersistedOperation(contractId, intent, options) {
    return copyResult(await adapter().previewPersistedOperation(contractId, intent, options));
  }

  async function saveOperationForm(contractId, intent, receipt, options) {
    return copyResult(await adapter().saveOperationForm(contractId, intent, receipt, options));
  }

  async function loadModificationPreview(contract, input, options) {
    const value = adapter();
    if (typeof value.calculateModificationPreview !== "function") {
      throw new Error("TFRS16 private modification preview is unavailable");
    }
    return copyResult(await value.calculateModificationPreview(contract, input, options));
  }

  async function loadReassessmentPreview(contract, input, options) {
    const value = adapter();
    if (typeof value.calculateReassessmentPreview !== "function") {
      throw new Error("TFRS16 private reassessment preview is unavailable");
    }
    return copyResult(await value.calculateReassessmentPreview(contract, input, options));
  }

  async function applyModification(contract, modificationId, options) {
    const value = adapter();
    if (typeof value.applyModification !== "function") {
      throw new Error("TFRS16 private modification apply is unavailable");
    }
    return copyResult(await value.applyModification(contract, modificationId, options));
  }

  async function applyReassessment(contract, reassessmentId, options) {
    const value = adapter();
    if (typeof value.applyReassessment !== "function") {
      throw new Error("TFRS16 private reassessment apply is unavailable");
    }
    return copyResult(await value.applyReassessment(contract, reassessmentId, options));
  }

  function project(result) {
    const value = copyResult(result);
    return {
      months: value.months,
      liability: value.liability,
      rouAssets: value.rouAssets,
      depreciation: value.depreciation,
      depreciationMonths: value.depreciationMonths,
      usesUsefulLifeDepreciation: value.usesUsefulLifeDepreciation,
      monthlyInterest: value.monthlyInterest,
      paymentFrequency: value.paymentFrequency,
      paymentTiming: value.paymentTiming,
      stepMonths: value.stepMonths,
      totalVariableExpense: value.totalVariableExpense,
      assumptions: value.assumptions,
      exempt: value.exempt,
      schedule: value.schedule,
      periodEffectsVersion: value.periodEffectsVersion,
      periodEffects: value.periodEffects,
      specialFlowsVersion: value.specialFlowsVersion,
      specialFlows: value.specialFlows
    };
  }

  global.LeaseQantPrivateTfrs16Facade = Object.freeze({
    load,
    loadMany,
    loadTms29,
    loadTms29Many,
    loadReportingDate,
    loadTms21,
    loadJournal,
    loadLeaseDisclosureAvailability,
    loadJournalAuthorityPackage,
    loadLeaseDisclosure,
    createTrustedDisclosureSnapshots,
    loadCloseControls,
    loadEarlyPayment,
    loadSaleAndLeaseback,
    previewPersistedOperation,
    saveOperationForm,
    loadModificationPreview,
    loadReassessmentPreview,
    applyModification,
    applyReassessment,
    project
  });
})(window);
