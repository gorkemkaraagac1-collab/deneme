/*
 * TFRS16 private-result hydration coordinator.
 *
 * This UI-only boundary owns the one-shot invocation of the runtime's
 * private hydration hook. The calculation implementation remains inside the
 * runtime; this module only coordinates when the already-loaded private
 * result cache is warmed for page consumers.
 */
(() => {
  let inFlight = null;
  let completed = false;
  const HYDRATION_TIMEOUT_MS = 30000;

  const run = () => {
    if (completed) return Promise.resolve({ status: "already-complete" });
    if (inFlight) return inFlight;

    const hydrate = window.__GK_TFRS16_UI_HYDRATE__;
    if (typeof hydrate !== "function") {
      console.error("TFRS16 private hydration başlatılamadı: hydration hook bulunamadı.");
      return Promise.resolve({ status: "missing-hook" });
    }

    const deadline = new Promise((_, reject) => {
      window.setTimeout(() => {
        const error = new Error("Private hydration zaman aşımına uğradı");
        error.code = "PRIVATE_HYDRATION_TIMEOUT";
        reject(error);
      }, HYDRATION_TIMEOUT_MS);
    });

    inFlight = Promise.race([
      Promise.resolve().then(() => hydrate()),
      deadline
    ])
      .then(result => {
        completed = true;
        return result;
      })
      .catch(error => {
        completed = true;
        console.error("TFRS16 private hydration tamamlanamadı:", error?.message || error);
        return { status: "failed", error: error?.code || "PRIVATE_HYDRATION_FAILED" };
      })
      .finally(() => {
        // A rejected or missing runtime hydration hook must settle the
        // dashboard's loading gate. The runtime will repaint its own KPI
        // values when available; this marker prevents an unrecoverable
        // promise failure from leaving the public dashboard spinning forever.
        window.__GK_TFRS16_PRIVATE_HYDRATION_SETTLED__ = true;
        try { window.GK_TFRS16?.refresh?.(); } catch (_) { /* best effort */ }
        try { window.LeaseQantDashboard?.refresh?.(); } catch (_) { /* best effort */ }
        inFlight = null;
      });

    return inFlight;
  };

  window.__GK_TFRS16_PRIVATE_HYDRATION__ = { run };
})();
