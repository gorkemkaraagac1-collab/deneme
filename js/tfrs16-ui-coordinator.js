/*
 * TFRS16 public UI coordinator
 *
 * This file owns only startup timing. The legacy-compatible UI runtime keeps
 * its implementation private and exposes one explicit boot hook. Keeping the
 * scheduler separate lets later extraction slices move hydration and detail
 * composition without changing the page's load contract.
 */
(() => {
  const boot = () => {
    if (window.__GK_TFRS16_UI_COORDINATOR_RAN__) return;
    window.__GK_TFRS16_UI_COORDINATOR_RAN__ = true;
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
