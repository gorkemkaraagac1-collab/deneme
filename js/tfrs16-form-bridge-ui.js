/*
 * LeaseQant TFRS16 — public UI-only form bridge.
 *
 * This module owns capture-phase wiring for the contract and Excel-import
 * controls. It deliberately delegates every operation to the private runtime's
 * UI callbacks once that runtime has booted; it contains no calculation,
 * persistence, or API logic.
 */
(() => {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.__GK_TFRS16_UI_BRIDGE_V2__) return;
  window.__GK_TFRS16_UI_BRIDGE_V2__ = true;

  const callback = name => {
    const callbacks = window.__GK_TFRS16_FORM_UI__;
    return callbacks && typeof callbacks[name] === "function" ? callbacks[name] : null;
  };

  const notify = (message, type = "info") => {
    const showToast = callback("showToast");
    if (showToast) return showToast(message, type);
    const showAlert = callback("showAlert");
    if (showAlert) return showAlert(message, type);
    if (typeof window.alert === "function") window.alert(String(message || ""));
    return undefined;
  };

  document.addEventListener("click", event => {
    const button = event.target?.closest?.("button");
    if (!button) return;

    const id = button.id;
    try {
      if (id === "newContractButton") {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (button.dataset.writeBlocked === "true") {
          notify("Bu işlem için yazma yetkiniz bulunmamaktadır (salt okunur rol).");
          return;
        }
        const open = callback("openContractModal");
        if (open) open();
        else document.getElementById("contractModal")?.classList.remove("hidden");
        return;
      }

      if (id === "bulkImportButton") {
        event.preventDefault();
        event.stopImmediatePropagation();
        const open = callback("openBulkImportModal");
        if (open) open();
        else document.getElementById("bulkImportModal")?.classList.remove("hidden");
        return;
      }

      if (id === "closeModal" || id === "cancelModal") {
        event.preventDefault();
        event.stopImmediatePropagation();
        const close = callback("closeContractModal");
        if (close) close();
        else document.getElementById("contractModal")?.classList.add("hidden");
        return;
      }

      if (id === "closeBulkModal" || id === "cancelBulkImport") {
        event.preventDefault();
        event.stopImmediatePropagation();
        const close = callback("closeBulkImportModal");
        if (close) close();
        else document.getElementById("bulkImportModal")?.classList.add("hidden");
        return;
      }

      if (id === "downloadTemplateButton") {
        event.preventDefault();
        event.stopImmediatePropagation();
        callback("downloadTemplate")?.();
        return;
      }

      if (id === "confirmBulkImport") {
        event.preventDefault();
        event.stopImmediatePropagation();
        callback("confirmBulkImport")?.();
        return;
      }
    } catch (error) {
      console.error("GK TFRS16 UI form bridge error:", error);
      notify(`İşlem başlatılamadı: ${error?.message || String(error)}`, "error");
    }
  }, true);

  document.addEventListener("change", event => {
    const input = event.target;
    if (!input || input.id !== "bulkFileInput") return;
    const file = input.files?.[0];
    if (!file) return;
    try {
      event.stopImmediatePropagation();
      const read = callback("readBulkImportFile");
      const parse = callback("parseIntegrationFile");
      if (read) read(file);
      else if (parse) parse(file);
      else throw new Error("Excel import fonksiyonu yüklenemedi.");
    } catch (error) {
      console.error("GK TFRS16 Excel import bridge error:", error);
      const status = document.getElementById("bulkImportStatus");
      if (status) status.textContent = `Excel aktarımı başlatılamadı: ${error?.message || String(error)}`;
    }
  }, true);
})();
