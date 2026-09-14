(function exposeCalculationShadow(global) {
  "use strict";

  const MAX_REPORTS = 25;
  const NUMERIC_FIELDS = [
    "liability",
    "rouAssets",
    "depreciation",
    "monthlyInterest",
    "advancePaymentAtCommencement",
    "months"
  ];

  const reports = [];

  function isEnabled() {
    return global.LEASEQANT_CALCULATION_SHADOW === true;
  }

  function finiteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function firstNumber(source, names) {
    for (const name of names) {
      const value = finiteNumber(source?.[name]);
      if (value !== null) return value;
    }
    return null;
  }

  function numericDelta(left, right) {
    if (left === null || right === null) return null;
    return Math.abs(left - right);
  }

  function normalizeDate(value) {
    if (value == null || value === "") return null;
    // Local engine schedule rows are Date objects at local midnight. Using
    // toISOString() converts them to the previous UTC day in Istanbul and
    // creates a false one-day shadow mismatch against the API's date string.
    if (
      value instanceof Date ||
      (typeof value?.getFullYear === "function" &&
        typeof value?.getMonth === "function" &&
        typeof value?.getDate === "function")
    ) {
      if (typeof value.getTime === "function" && Number.isNaN(value.getTime())) return null;
      return [
        value.getFullYear(),
        String(value.getMonth() + 1).padStart(2, "0"),
        String(value.getDate()).padStart(2, "0")
      ].join("-");
    }
    const text = String(value);
    const isoDate = text.match(/^\d{4}-\d{2}-\d{2}/);
    return isoDate ? isoDate[0] : text;
  }

  function withinTolerance(left, right, tolerance) {
    if (left === null || right === null) return left === right;
    const allowed = Math.max(tolerance, Math.abs(left) * 1e-8, Math.abs(right) * 1e-8);
    return Math.abs(left - right) <= allowed;
  }

  function scheduleSummary(result) {
    const schedule = Array.isArray(result?.schedule) ? result.schedule : [];
    const payments = schedule.reduce((sum, row) => sum + (finiteNumber(row?.payment) || 0), 0);
    const interest = schedule.reduce((sum, row) => sum + (finiteNumber(row?.interest) || 0), 0);
    const principal = schedule.reduce((sum, row) => sum + (finiteNumber(row?.principal) || 0), 0);
    const first = schedule[0] || null;
    const last = schedule[schedule.length - 1] || null;

    return {
      count: schedule.length,
      firstDate: normalizeDate(first?.date),
      lastDate: normalizeDate(last?.date),
      payments,
      interest,
      principal,
      firstClosingLiability: firstNumber(first, ["closingLiability", "closingBalance", "endingLiability"]),
      lastClosingLiability: firstNumber(last, ["closingLiability", "closingBalance", "endingLiability"])
    };
  }

  function summarize(result) {
    const values = {};
    NUMERIC_FIELDS.forEach(field => { values[field] = finiteNumber(result?.[field]); });
    return { values, schedule: scheduleSummary(result) };
  }

  function compare(localResult, privateResult) {
    const local = summarize(localResult);
    const remote = summarize(privateResult);
    const fields = {};
    let matched = true;

    NUMERIC_FIELDS.forEach(field => {
      const left = local.values[field];
      const right = remote.values[field];
      const fieldMatched = withinTolerance(left, right, 0.01);
      fields[field] = {
        local: left,
        private: right,
        delta: numericDelta(left, right),
        matched: fieldMatched
      };
      if (!fieldMatched) matched = false;
    });

    const localSchedule = local.schedule;
    const remoteSchedule = remote.schedule;
    const scheduleFields = [
      ["count", 0],
      ["payments", 0.01],
      ["interest", 0.01],
      ["principal", 0.01],
      ["firstClosingLiability", 0.01],
      ["lastClosingLiability", 0.01]
    ];
    scheduleFields.forEach(([field, tolerance]) => {
      const left = localSchedule[field];
      const right = remoteSchedule[field];
      const fieldMatched = withinTolerance(left, right, tolerance);
      fields["schedule." + field] = {
        local: left,
        private: right,
        delta: numericDelta(left, right),
        matched: fieldMatched
      };
      if (!fieldMatched) matched = false;
    });

    ["firstDate", "lastDate"].forEach(field => {
      const left = normalizeDate(localSchedule[field]);
      const right = normalizeDate(remoteSchedule[field]);
      const fieldMatched = left === right;
      fields["schedule." + field] = { local: left, private: right, delta: null, matched: fieldMatched };
      if (!fieldMatched) matched = false;
    });

    return { matched, fields, local, private: remote };
  }

  function remember(report) {
    reports.push(report);
    if (reports.length > MAX_REPORTS) reports.splice(0, reports.length - MAX_REPORTS);
    try {
      global.dispatchEvent(new CustomEvent("leaseqant:calculation-shadow", { detail: report }));
    } catch (_) {}
    return report;
  }

  async function run(contract, localResult, options) {
    if (!isEnabled()) return { status: "disabled" };
    if (!global.LeaseQantPrivateCalculation || typeof global.LeaseQantPrivateCalculation.calculate !== "function") {
      return remember({ status: "error", code: "ADAPTER_UNAVAILABLE", contractId: contract?.id || null, timestamp: new Date().toISOString() });
    }

    const started = Date.now();
    const reportBase = {
      contractId: contract?.id || null,
      timestamp: new Date().toISOString()
    };

    try {
      const privateResult = await global.LeaseQantPrivateCalculation.calculate(contract, options);
      const comparison = compare(localResult, privateResult);
      const report = remember({
        ...reportBase,
        status: comparison.matched ? "match" : "mismatch",
        durationMs: Date.now() - started,
        ...comparison
      });
      if (!comparison.matched && global.LEASEQANT_CALCULATION_SHADOW_DEBUG === true) {
        console.warn("LeaseQant hesaplama gölge karşılaştırması uyuşmuyor", report);
      }
      return report;
    } catch (error) {
      return remember({
        ...reportBase,
        status: "error",
        code: error?.code || "CALCULATION_API_ERROR",
        httpStatus: error?.status ?? null,
        message: String(error?.message || error),
        durationMs: Date.now() - started
      });
    }
  }

  function observe(contract, localResult, options) {
    return run(contract, localResult, options);
  }

  function getReports() {
    return reports.map(report => ({ ...report }));
  }

  function clearReports() {
    reports.length = 0;
  }

  global.LeaseQantCalculationShadow = Object.freeze({
    observe,
    run,
    getReports,
    clearReports,
    isEnabled
  });
})(window);
