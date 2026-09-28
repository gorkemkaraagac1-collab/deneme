/* LeaseQant ortak raporlama dönemi.
   - Tek bir "raporlama ayı" durumu tutar: YYYY-MM.
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

  function currentKey() {
    return selected && isValidKey(selected) ? selected : latestKey();
  }

  function range(key) {
    const k = isValidKey(key) ? key : currentKey();
    const [y, m] = k.split("-").map(Number);
    const end = new Date(y, m, 0);
    const periodStart = `${y}-${pad(m)}-01`;
    const periodEnd = `${y}-${pad(m)}-${pad(end.getDate())}`;
    return { key: k, periodStart, periodEnd, reportingDate: periodEnd };
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
    months,
    subscribe,
    isValidKey,
    isExplicit: () => Boolean(selected)
  });
})(window);
