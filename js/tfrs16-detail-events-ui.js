/* LeaseQant TFRS16 — contract detail event binding UI. */
(function (global) {
  "use strict";

  /**
   * Bind the detail modal's per-contract UI events after its read-only shell
   * has been rendered. Calculation and persistence remain callbacks supplied
   * by the private-gated runtime; this module only coordinates DOM events.
   */
  function bind(options = {}) {
    const contract = options.contract;
    if (!contract) return;

    const call = (name, ...args) => typeof options[name] === "function"
      ? options[name](...args)
      : undefined;
    const reporting = global.LeaseQantTfrs16ReportingUi || {};

    setTimeout(() => {
      reporting.bindContractAuditTab?.(contract);
      call("initPaymentScheduleEvents", contract);

      const reopenSameContract = () => call("reopenDetail", contract.id);
      call("initModificationEvents", contract, reopenSameContract);
      call("initReassessmentEvents", contract, reopenSameContract);

      call("renderSlbSection", contract);
      call("renderSubleaseSection", contract);

      document.getElementById("generateJournal")
        ?.addEventListener("click", () => call("generateSelectedJournal", contract));
      document.getElementById("openBulkJournalButton")
        ?.addEventListener("click", () => call("openBulkJournalModal"));

      reporting.bindContractDetailTabs?.({
        getActiveTab: () => call("getActiveTab"),
        setActiveTab: value => call("setActiveTab", value)
      });
    }, 0);
  }

  global.LeaseQantTfrs16DetailEvents = { bind };
})(window);
