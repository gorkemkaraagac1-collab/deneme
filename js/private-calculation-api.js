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

  async function calculate(contract, options) {
    if (!contract || typeof contract !== "object" || Array.isArray(contract)) {
      throw new TypeError("contract must be an object");
    }
    const config = options || {};
    const timeoutMs = Number.isFinite(config.timeoutMs) ? Math.max(1000, config.timeoutMs) : DEFAULT_TIMEOUT_MS;
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timer = controller ? global.setTimeout(() => controller.abort(), timeoutMs) : null;
    const headers = { Accept: "application/json", "Content-Type": "application/json", ...(config.headers || {}) };
    const token = getBearerToken();
    if (token && !headers.Authorization) headers.Authorization = "Bearer " + token;
    try {
      const response = await global.fetch(getApiBase() + "/api/calculations/lease", {
        method: "POST", credentials: "include", headers, body: JSON.stringify({ contract }),
        signal: controller ? controller.signal : undefined,
      });
      const text = await response.text();
      let body = null;
      try { body = text ? JSON.parse(text) : null; } catch (_) { body = text; }
      if (!response.ok) throw createRequestError(response.status, body);
      if (body && body.success === false) throw createRequestError(response.status, body);
      return body && Object.prototype.hasOwnProperty.call(body, "data") ? body.data : body;
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

  global.LeaseQantPrivateCalculation = Object.freeze({ calculate, apiBase: getApiBase, timeoutMs: DEFAULT_TIMEOUT_MS });
})(window);
