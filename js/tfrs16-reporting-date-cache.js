/* TFRS 16 reporting-date result cache.
 *
 * This module stores only the narrow, authenticated reporting-date envelope
 * returned by the private backend. It never derives liability, ROU, or
 * current/non-current values in the browser.
 */
(function exposeReportingDateCache(global) {
  "use strict";

  const results = new Map();
  const inFlight = new Map();

  function dateKey(value) {
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function contractKey(contract) {
    if (!contract || typeof contract !== "object") return "";
    const fields = {
      id: contract.id || "",
      updatedAt: contract.updatedAt || "",
      monthlyPayment: contract.monthlyPayment || "",
      discountRate: contract.discountRate || "",
      startDate: contract.startDate || "",
      endDate: contract.endDate || "",
      paymentFrequency: contract.paymentFrequency || "",
      paymentTiming: contract.paymentTiming || "",
      leaseIncreaseType: contract.leaseIncreaseType || "",
      leaseIncreaseRate: contract.leaseIncreaseRate || "",
      fixedIncrease: contract.fixedIncrease || "",
      indexBaseRate: contract.indexBaseRate || "",
      indexCurrentRate: contract.indexCurrentRate || "",
      indexReviewMonth: contract.indexReviewMonth || "",
      indexReviewDay: contract.indexReviewDay || "",
      initialDirectCosts: contract.initialDirectCosts || "",
      restorationObligation: contract.restorationObligation || "",
      leaseIncentives: contract.leaseIncentives || "",
      prepayments: contract.prepayments || "",
      variablePayment: contract.variablePayment || "",
      variablePaymentType: contract.variablePaymentType || "",
      inSubstanceFixedPayment: contract.inSubstanceFixedPayment || "",
      terminationOption: contract.terminationOption === true,
      terminationDate: contract.terminationDate || "",
      terminationPenalty: contract.terminationPenalty || "",
      purchaseOption: contract.purchaseOption === true,
      purchaseOptionPrice: contract.purchaseOptionPrice || "",
      residualValueGuarantee: contract.residualValueGuarantee === true,
      expectedResidualValueGuaranteePayment: contract.expectedResidualValueGuaranteePayment || "",
      renewalOption: contract.renewalOption === true,
      renewalOptionExpectedToExercise: contract.renewalOptionExpectedToExercise === true,
      renewalEndDate: contract.renewalEndDate || "",
      modifications: Array.isArray(contract.modifications) ? contract.modifications : [],
      reassessments: Array.isArray(contract.reassessments) ? contract.reassessments : [],
      openingBalance: contract.openingBalance || contract.migration || null
    };
    return `${String(contract.id || "")}:${JSON.stringify(fields)}`;
  }

  function key(contract, reportingDate) {
    const date = dateKey(reportingDate);
    const identity = contractKey(contract);
    return date && identity ? `${identity}|${date}` : "";
  }

  function get(contract, reportingDate) {
    const cacheKey = key(contract, reportingDate);
    return cacheKey ? results.get(cacheKey) || null : null;
  }

  async function load(contract, reportingDate, options = {}) {
    const cacheKey = key(contract, reportingDate);
    if (!cacheKey) throw new TypeError("contract and reportingDate are required");
    const cached = results.get(cacheKey);
    if (cached) return cached;
    if (inFlight.has(cacheKey)) return inFlight.get(cacheKey);
    const facade = global.LeaseQantPrivateTfrs16Facade;
    if (typeof facade?.loadReportingDate !== "function") {
      const error = new Error("Private reporting-date calculation is unavailable");
      error.code = "PRIVATE_REPORTING_DATE_UNAVAILABLE";
      throw error;
    }
    const promise = Promise.resolve(facade.loadReportingDate(contract, dateKey(reportingDate), options))
      .then(result => {
        if (!result || typeof result !== "object") throw new Error("Private reporting-date result is invalid");
        results.set(cacheKey, result);
        return result;
      })
      .finally(() => inFlight.delete(cacheKey));
    inFlight.set(cacheKey, promise);
    return promise;
  }

  async function preload(contracts, reportingDate, options = {}) {
    const list = Array.isArray(contracts) ? contracts.filter(Boolean) : [];
    const concurrency = Math.max(1, Math.min(8, Number(options.concurrency) || 6));
    const output = [];
    let cursor = 0;
    async function worker() {
      while (cursor < list.length) {
        const index = cursor++;
        const contract = list[index];
        try {
          output[index] = { contract, result: await load(contract, reportingDate, options), error: null };
        } catch (error) {
          output[index] = { contract, result: null, error };
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, list.length) }, worker));
    return {
      attempted: list.length,
      succeeded: output.filter(item => item?.result).length,
      failed: output.filter(item => item?.error).length,
      results: output
    };
  }

  function clear(contractId) {
    if (contractId == null) {
      results.clear();
      inFlight.clear();
      return;
    }
    const prefix = `${String(contractId)}:`;
    for (const cacheKey of results.keys()) if (cacheKey.includes(prefix)) results.delete(cacheKey);
    for (const cacheKey of inFlight.keys()) if (cacheKey.includes(prefix)) inFlight.delete(cacheKey);
  }

  global.LeaseQantTfrs16ReportingDateCache = Object.freeze({ dateKey, key, get, load, preload, clear });
})(window);
