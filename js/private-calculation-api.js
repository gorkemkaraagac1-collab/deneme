(function exposePrivateCalculationAdapter(global) {
  "use strict";

  const DEFAULT_API_BASE = "https://api.leaseqant.com";
  const DEFAULT_TIMEOUT_MS = 20000;

  function getApiBase() {
    return String(global.LEASEQANT_API_BASE || DEFAULT_API_BASE).replace(/\/$/, "");
  }

  function getBearerToken() {
    return typeof global.tfrs16GetToken === "function" ? global.tfrs16GetToken() : null;
  }

  function createRequestError(status, body) {
    const message = body && (body.error || body.message);
    const error = new Error(message || "Hesaplama API hatası (HTTP " + status + ")");
    error.status = status;
    if (body && typeof body === "object") error.details = body;
    return error;
  }

  // The backend serializes schedule dates as JSON strings, while the public
  // UI's reporting and journal helpers intentionally operate on Date objects.
  // Rebuild date-only values in local calendar time so Istanbul (and other
  // non-UTC zones) cannot shift a period to the previous day.
  function normalizeCalendarDate(value) {
    if (value instanceof Date) return value;
    if (typeof value !== "string") return value;
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return value;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(date.getTime()) ? value : date;
  }

  function normalizeCalculationResult(result) {
    if (!result || typeof result !== "object" || !Array.isArray(result.schedule)) return result;
    function normalizeNestedDates(value) {
      if (!value || typeof value !== "object") return value;
      if (Array.isArray(value)) return value.map(normalizeNestedDates);
      const normalized = { ...value };
      ["date", "paymentDate", "openingDate", "closingDate"].forEach(key => {
        if (Object.prototype.hasOwnProperty.call(normalized, key)) {
          normalized[key] = normalizeCalendarDate(normalized[key]);
        }
      });
      Object.keys(normalized).forEach(key => {
        if (normalized[key] && typeof normalized[key] === "object") {
          normalized[key] = normalizeNestedDates(normalized[key]);
        }
      });
      return normalized;
    }

    return {
      ...result,
      schedule: result.schedule.map(row => {
        if (!row || typeof row !== "object") return row;
        const normalized = { ...row };
        ["date", "paymentDate", "openingDate", "closingDate"].forEach(key => {
          if (Object.prototype.hasOwnProperty.call(normalized, key)) {
            normalized[key] = normalizeCalendarDate(normalized[key]);
          }
        });
        return normalized;
      }),
      periodEffects: Array.isArray(result.periodEffects)
        ? result.periodEffects.map(effect => {
          if (!effect || typeof effect !== "object") return effect;
          const normalized = { ...effect };
          if (Object.prototype.hasOwnProperty.call(normalized, "date")) {
            normalized.date = normalizeCalendarDate(normalized.date);
          }
          return normalized;
        })
        : [],
      specialFlows: result.specialFlows && typeof result.specialFlows === "object"
        ? normalizeNestedDates(result.specialFlows)
        : {}
    };
  }

  async function requestCalculation(path, payload, options) {
    const config = options || {};
    const timeoutMs = Number.isFinite(config.timeoutMs) ? Math.max(1000, config.timeoutMs) : DEFAULT_TIMEOUT_MS;
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timer = controller ? global.setTimeout(() => controller.abort(), timeoutMs) : null;
    const headers = { Accept: "application/json", "Content-Type": "application/json", ...(config.headers || {}) };
    const token = getBearerToken();
    if (token && !headers.Authorization) headers.Authorization = "Bearer " + token;
    try {
      const response = await global.fetch(getApiBase() + path, {
        method: "POST", credentials: "include", headers, body: JSON.stringify(payload),
        signal: controller ? controller.signal : undefined,
      });
      const text = await response.text();
      let body = null;
      try { body = text ? JSON.parse(text) : null; } catch (_) { body = text; }
      if (!response.ok) throw createRequestError(response.status, body);
      if (body && body.success === false) throw createRequestError(response.status, body);
      const result = body && Object.prototype.hasOwnProperty.call(body, "data") ? body.data : body;
      return normalizeCalculationResult(result);
    } catch (error) {
      if (error && error.name === "AbortError") {
        const timeoutError = new Error("Hesaplama API zaman aşımına uğradı");
        timeoutError.code = "CALCULATION_TIMEOUT";
        throw timeoutError;
      }
      throw error;
    } finally {
      if (timer) global.clearTimeout(timer);
    }
  }

  async function calculate(contract, options) {
    if (!contract || typeof contract !== "object" || Array.isArray(contract)) {
      throw new TypeError("contract must be an object");
    }
    return requestCalculation("/api/calculations/lease", { contract }, options);
  }

  // The backend accepts up to 20 contracts per batch. Split larger lists
  // here so the UI has no artificial contract-count limit.
  async function calculateMany(contracts, options) {
    if (!Array.isArray(contracts)) throw new TypeError("contracts must be an array");
    if (contracts.length === 0) return [];
    const results = [];
    for (let offset = 0; offset < contracts.length; offset += 20) {
      const chunk = contracts.slice(offset, offset + 20);
      if (chunk.some(contract => !contract || typeof contract !== "object" || Array.isArray(contract))) {
        throw new TypeError("contracts must contain only objects");
      }
      const response = await requestCalculation("/api/calculations/lease/batch", { contracts: chunk }, options);
      if (!Array.isArray(response)) throw new Error("Toplu hesaplama API boş sonuç döndürdü");
      // A batch response is an array, so requestCalculation cannot apply the
      // object-level normalizer to each item automatically. Normalize every
      // result here before it reaches the portfolio cache; otherwise schedule
      // dates remain JSON strings and reporting helpers that call getTime()
      // fail for API-primary portfolio views.
      results.push(...response.map(normalizeCalculationResult));
    }
    return results;
  }

  async function calculateTms29(contract, reportingPeriod, periodStart, options) {
    if (!contract || typeof contract !== "object" || Array.isArray(contract)) {
      throw new TypeError("contract must be an object");
    }
    return requestCalculation("/api/calculations/lease/tms29", {
      contract,
      reportingPeriod,
      periodStart: periodStart || null
    }, options);
  }

  async function calculateModificationPreview(contract, input, options) {
    if (!contract || typeof contract !== "object" || Array.isArray(contract)) {
      throw new TypeError("contract must be an object");
    }
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new TypeError("input must be an object");
    }
    return requestCalculation("/api/calculations/lease/modification", { contract, input }, options);
  }

  async function calculateReassessmentPreview(contract, input, options) {
    if (!contract || typeof contract !== "object" || Array.isArray(contract)) {
      throw new TypeError("contract must be an object");
    }
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new TypeError("input must be an object");
    }
    return requestCalculation("/api/calculations/lease/reassessment", { contract, input }, options);
  }

  async function applyModification(contract, modificationId, options) {
    if (!contract || typeof contract !== "object" || Array.isArray(contract)) {
      throw new TypeError("contract must be an object");
    }
    if (modificationId == null || String(modificationId).trim() === "") {
      throw new TypeError("modificationId is required");
    }
    return requestCalculation("/api/calculations/lease/modification/apply", {
      contract,
      modificationId: String(modificationId)
    }, options);
  }

  async function applyReassessment(contract, reassessmentId, options) {
    if (!contract || typeof contract !== "object" || Array.isArray(contract)) {
      throw new TypeError("contract must be an object");
    }
    if (reassessmentId == null || String(reassessmentId).trim() === "") {
      throw new TypeError("reassessmentId is required");
    }
    return requestCalculation("/api/calculations/lease/reassessment/apply", {
      contract,
      reassessmentId: String(reassessmentId)
    }, options);
  }

  global.LeaseQantPrivateCalculation = Object.freeze({
    calculate,
    calculateMany,
    calculateTms29,
    calculateModificationPreview,
    calculateReassessmentPreview,
    applyModification,
    applyReassessment,
    apiBase: getApiBase,
    timeoutMs: DEFAULT_TIMEOUT_MS
  });
})(window);
