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

  const run = () => {
    if (completed) return Promise.resolve({ status: "already-complete" });
    if (inFlight) return inFlight;

    const hydrate = window.__GK_TFRS16_UI_HYDRATE__;
    if (typeof hydrate !== "function") {
      console.error("TFRS16 private hydration başlatılamadı: hydration hook bulunamadı.");
      return Promise.resolve({ status: "missing-hook" });
    }

    inFlight = Promise.resolve()
      .then(() => hydrate())
      .then(result => {
        completed = true;
        return result;
      })
      .finally(() => {
        inFlight = null;
      });

    return inFlight;
  };

  window.__GK_TFRS16_PRIVATE_HYDRATION__ = { run };
})();
