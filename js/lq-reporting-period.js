/* LeaseQant ortak raporlama dönemi.
   - Raporlama ayı (dönem sonu, YYYY-MM) ve dönem kapsamı tutar: tek ay, son
     3 ay, son 6 ay, hesap dönemi başından (mali yıl başlangıç ayı seçilir)
     veya özel başlangıç ayı. Dönem her zaman ay başında başlar, ay sonunda
     biter (sunucu raporları bu sınırları kabul eder).
   - Hesaplama yapmaz, API çağırmaz. Rapor modülleri dönem tarihini
     buradan okur; seçim yoksa eski davranış (önceki ayın son günü) aynen sürer.
   - Seçim yalnızca bu tarayıcı sekmesinde saklanır (sessionStorage). */
(function (global) {
  "use strict";

  const STORAGE_KEY = "lq-reporting-period";
  const listeners = new Set();
  const pad = n => String(n).padStart(2, "0");

  function monthKey(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
  }

  /* Seçilebilecek en son ay: bir önceki takvim ayı (raporlar ay sonu tarihiyle üretilir). */
  function latestKey(now) {
    const d = now || new Date();
    return monthKey(new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }

  function earliestKey(now) {
    const d = now || new Date();
    return monthKey(new Date(d.getFullYear(), d.getMonth() - 24, 1));
  }

  function isValidKey(key) {
    if (typeof key !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(key)) return false;
    return key >= earliestKey() && key <= latestKey();
  }

  function read() {
    try {
      const value = global.sessionStorage.getItem(STORAGE_KEY);
      return isValidKey(value) ? value : null;
    } catch (_) {
      return null;
    }
  }

  let selected = read();

  // Scope preference (per viewer): survives sessions, never required.
  const SCOPE_KEY = "lq-reporting-scope";
  const SCOPES = ["MONTH", "QUARTER", "HALF", "YTD", "CUSTOM"];
  function readScope() {
    try {
      const value = JSON.parse(global.localStorage.getItem(SCOPE_KEY) || "null");
      if (value && SCOPES.includes(value.scope)) return { scope: value.scope,
        fiscalStart: Number.isInteger(value.fiscalStart) && value.fiscalStart >= 1 && value.fiscalStart <= 12 ? value.fiscalStart : 1,
        customStart: typeof value.customStart === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value.customStart) ? value.customStart : null };
    } catch (_) { /* default below */ }
    return { scope: "MONTH", fiscalStart: 1, customStart: null };
  }
  let scope = readScope();
  const shift = (key, months) => {
    const [y, m] = key.split("-").map(Number);
    return monthKey(new Date(y, m - 1 + months, 1));
  };
  // First month of the period that ends with the reporting month.
  function startKey(endKey) {
    if (scope.scope === "QUARTER") return shift(endKey, -2);
    if (scope.scope === "HALF") return shift(endKey, -5);
    if (scope.scope === "YTD") {
      const [y, m] = endKey.split("-").map(Number);
      return `${m >= scope.fiscalStart ? y : y - 1}-${pad(scope.fiscalStart)}`;
    }
    if (scope.scope === "CUSTOM" && scope.customStart && scope.customStart <= endKey && scope.customStart >= shift(endKey, -35)) return scope.customStart;
    return endKey;
  }

  function currentKey() {
    return selected && isValidKey(selected) ? selected : latestKey();
  }

  function range(key) {
    const k = isValidKey(key) ? key : currentKey();
    const [y, m] = k.split("-").map(Number);
    const end = new Date(y, m, 0);
    const first = startKey(k);
    const periodStart = `${first}-01`;
    const periodEnd = `${y}-${pad(m)}-${pad(end.getDate())}`;
    return { key: k, periodStart, periodEnd, reportingDate: periodEnd, scope: scope.scope,
      fiscalStart: scope.fiscalStart, startKey: first, months: monthsBetween(first, k) };
  }
  function monthsBetween(a, b) {
    const [ya, ma] = a.split("-").map(Number), [yb, mb] = b.split("-").map(Number);
    return (yb - ya) * 12 + (mb - ma) + 1;
  }

  // Period scope: MONTH | QUARTER | HALF | YTD (fiscalStart 1-12) | CUSTOM (customStart YYYY-MM).
  function setScope(next) {
    if (!next || !SCOPES.includes(next.scope)) return false;
    const value = { scope: next.scope,
      fiscalStart: Number.isInteger(next.fiscalStart) && next.fiscalStart >= 1 && next.fiscalStart <= 12 ? next.fiscalStart : scope.fiscalStart,
      customStart: typeof next.customStart === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(next.customStart) ? next.customStart : scope.customStart };
    if (JSON.stringify(value) === JSON.stringify(scope)) return true;
    scope = value;
    try { global.localStorage.setItem(SCOPE_KEY, JSON.stringify(scope)); } catch (_) {}
    const current = range(currentKey());
    listeners.forEach(fn => { try { fn(current); } catch (_) {} });
    return true;
  }

  function set(key) {
    if (!isValidKey(key)) return false;
    if (key === currentKey() && selected) return true;
    selected = key;
    try { global.sessionStorage.setItem(STORAGE_KEY, key); } catch (_) {}
    const value = range(key);
    listeners.forEach(fn => { try { fn(value); } catch (_) {} });
    return true;
  }

  function months(count) {
    const n = Math.max(1, Math.min(24, count || 12));
    const [y, m] = latestKey().split("-").map(Number);
    const out = [];
    for (let i = n - 1; i >= 0; i--) out.push(monthKey(new Date(y, m - 1 - i, 1)));
    return out;
  }

  function subscribe(fn) {
    if (typeof fn !== "function") return () => {};
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  global.LeaseQantReportingPeriod = Object.freeze({
    get: () => range(currentKey()),
    set,
    setScope,
    getScope: () => ({ ...scope }),
    months,
    subscribe,
    isValidKey,
    isExplicit: () => Boolean(selected)
  });
})(window);
