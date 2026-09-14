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
    loadModificationPreview,
    loadReassessmentPreview,
    project
  });
})(window);
