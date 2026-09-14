(function exposePrivateTms19Calculation(global) {
  "use strict";

  const DEFAULT_API_BASE = "https://api.leaseqant.com";
  const DEFAULT_TIMEOUT_MS = 20000;

  function apiBase() {
    return String(global.LEASEQANT_API_BASE || DEFAULT_API_BASE).replace(/\/$/, "");
  }

  function token() {
    try {
      return global.localStorage?.getItem("access_token") ||
        global.localStorage?.getItem("gk_backend_jwt") ||
        global.sessionStorage?.getItem("gk_session_token") ||
        null;
    } catch (_) {
      return null;
    }
  }

  async function calculate(employees, assumptions, options) {
    if (!Array.isArray(employees) || employees.length === 0) {
      throw new TypeError("employees must be a non-empty array");
    }

    const config = options || {};
    const controller = typeof global.AbortController === "function" ? new global.AbortController() : null;
    const timeout = controller
      ? global.setTimeout(() => controller.abort(), Number(config.timeoutMs) || DEFAULT_TIMEOUT_MS)
      : null;
    const headers = { Accept: "application/json", "Content-Type": "application/json" };
    const bearer = token();
    if (bearer) headers.Authorization = "Bearer " + bearer;

    try {
      const response = await global.fetch(apiBase() + "/api/calculations/tms19", {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({ mode: "portfolio", employees, assumptions: assumptions || {} }),
        signal: controller ? controller.signal : undefined
      });
      const text = await response.text();
      let body = null;
      try { body = text ? JSON.parse(text) : null; } catch (_) { body = text; }
      if (!response.ok) {
        const error = new Error(body?.error || body?.message || "TMS 19 API hatası (HTTP " + response.status + ")");
        error.status = response.status;
        throw error;
      }
      if (!body || body.success === false || !body.data) {
        throw new Error("TMS 19 API geçerli sonuç döndürmedi");
      }
      return body.data;
    } catch (error) {
      if (error?.name === "AbortError") {
        const timeoutError = new Error("TMS 19 API zaman aşımına uğradı");
        timeoutError.code = "TMS19_CALCULATION_TIMEOUT";
        throw timeoutError;
      }
      throw error;
    } finally {
      if (timeout) global.clearTimeout(timeout);
    }
  }

  global.LeaseQantPrivateTms19Calculation = Object.freeze({ calculate, apiBase, timeoutMs: DEFAULT_TIMEOUT_MS });
})(window);
