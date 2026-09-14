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
        : []
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
      periodEffects: value.periodEffects
    };
  }

  global.LeaseQantPrivateTfrs16Facade = Object.freeze({ load, loadMany, project });
})(window);
