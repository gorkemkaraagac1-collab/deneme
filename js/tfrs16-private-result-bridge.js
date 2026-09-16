(function (global) {
  "use strict";

  function getPrivateResult(contract) {
    const api = global.GK_TFRS16;
    if (typeof api?.getPrivateCalculationForConsumer !== "function") {
      const error = new Error("Private TFRS16 sonuç köprüsü hazır değil");
      error.code = "PRIVATE_CALCULATION_NOT_READY";
      throw error;
    }
    return api.getPrivateCalculationForConsumer(contract);
  }

  function calculate(contract) {
    return getPrivateResult(contract);
  }

  function calculateEngine(contract) {
    return getPrivateResult(contract);
  }

  function getEscalatedPayments(contract) {
    const result = getPrivateResult(contract);
    const basePayment = Number(contract?.monthlyPayment) || 0;
    return (Array.isArray(result?.schedule) ? result.schedule : []).map(row => ({
      date: row.date,
      payment: row.payment,
      basePayment,
      escalationMultiplier: basePayment > 0 ? row.payment / basePayment : 1
    }));
  }

  global.LeaseQantTfrs16PrivateResultBridge = Object.freeze({
    calculate,
    calculateEngine,
    getEscalatedPayments
  });
})(window);
