/* LeaseQant TFRS16 — private-result operation page entrypoints. */
(function (global) {
  "use strict";

  function bridge() {
    return global.GK_TFRS16 || {};
  }

  function renderThrough(container, bridgeName, fallbackMessage) {
    if (!container) return;
    const renderer = bridge()[bridgeName];
    if (typeof renderer === "function") return renderer(container);
    container.innerHTML = `<div class="gk-v26-card" style="color:#991b1b;">${fallbackMessage}</div>`;
  }

  function renderModificationReassessment(container) {
    return renderThrough(container, "renderModificationReassessmentBody", "Modifikasyon ve reassessment işlem köprüsü hazır değil.");
  }

  function renderSaleAndLeaseback(container) {
    return renderThrough(container, "renderSaleAndLeasebackBody", "Satış ve geri kiralama işlem köprüsü hazır değil.");
  }

  function renderSublease(container) {
    return renderThrough(container, "renderSubleaseBody", "Alt kiralama işlem köprüsü hazır değil.");
  }

  function renderAccountingCenter(container) {
    return renderThrough(container, "renderAccountingCenterBody", "Toplu fiş işlem köprüsü hazır değil.");
  }

  global.LeaseQantTfrs16OperationsUi = {
    renderModificationReassessment,
    renderSaleAndLeaseback,
    renderSublease,
    renderAccountingCenter
  };
})(window);
