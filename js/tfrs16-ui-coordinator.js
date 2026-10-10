/*
 * TFRS16 public UI coordinator
 *
 * This file owns only startup timing. The legacy-compatible UI runtime keeps
 * its implementation private and exposes one explicit boot hook. Keeping the
 * scheduler separate lets later extraction slices move hydration and detail
 * composition without changing the page's load contract.
 */
(() => {
  const boot = async () => {
    if (window.__GK_TFRS16_UI_COORDINATOR_RAN__) return;
    window.__GK_TFRS16_UI_COORDINATOR_RAN__ = true;
    // Do not initialize the runtime (including local cache migration) until
    // the backend confirms the session. Missing gate fails closed.
    let authorized = false;
    try { authorized = (await window.__GK_AUTH_READY__) === true; } catch (_) {}
    if (!authorized) return;
    const runtimeBoot = window.__GK_TFRS16_UI_BOOT__;
    if (typeof runtimeBoot !== "function") {
      console.error("TFRS16 UI runtime başlatılamadı: boot hook bulunamadı.");
      return;
    }
    runtimeBoot();
    const privateHydration = window.__GK_TFRS16_PRIVATE_HYDRATION__;
    if (typeof privateHydration?.run !== "function") {
      console.error("TFRS16 private hydration koordinatörü bulunamadı.");
      return;
    }
    void privateHydration.run().catch(error => {
      console.error("TFRS16 private hydration başarısız:", error);
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
