document.addEventListener("DOMContentLoaded", () => {

  /*
  ============================================================
  GK FINANCE INTELLIGENCE
  TFRS 16 ACCOUNTING ENGINE V15
  ------------------------------------------------------------
  V15
  - Existing V14 functionality preserved
  - Contract portfolio
  - New contract
  - Excel bulk import
  - Contract detail
  - TFRS 16 calculation engine
  - Initial recognition
  - Monthly / quarterly / annual journal
  - Current / non-current reclassification
  - Bulk journal generation
  - Voucher numbering
  - Excel journal export
  - Debit / credit validation
  - Contract audit trace
  - Safer date / input validation
  - Duplicate contract protection
  - Existing localStorage key preserved

  ------------------------------------------------------------
  V16.1 (additive — nothing above removed or altered)
  - New calculateLeaseEngine(): professional TFRS 16 engine
    supporting extended parameters (payment frequency/timing,
    initial direct costs, incentives, prepayments, restoration
    obligation, short-term/low-value exemption, renewal/
    termination flags). Produces identical numbers to
    calculateLease() when only legacy fields are present.
    Escalation and non-monthly frequency math are intentionally
    deferred to later approved phases (V16.2+).
  - New "Kira Ödeme Planı" (Payment Schedule) panel in contract
    detail view, with Yıl / Ay / Çeyrek filters and Excel export.
  ============================================================
  */

  const STORAGE_KEY = "gk_tfrs16_contracts_v7";

  let contracts = loadContracts();
  let selectedContractId = null;
  let bulkImportData = [];
  let bulkJournalData = [];


  /* ==========================================================
     DEMO DATA
  ========================================================== */

  function getDefaultContracts() {
    return [
      {
        id: "LEASE-001",
        company: "GK Holding",
        supplier: "ABC Plaza",
        monthlyPayment: 125000,
        startDate: "2026-01-01",
        endDate: "2030-12-31",
        discountRate: 18,
        renewalDate: "2030-09-30",
        status: "active",
        modification: false
      },
      {
        id: "LEASE-002",
        company: "GK Holding",
        supplier: "XYZ Logistics",
        monthlyPayment: 85000,
        startDate: "2026-03-01",
        endDate: "2028-02-29",
        discountRate: 17,
        renewalDate: "2027-12-01",
        status: "active",
        modification: true
      },
      {
        id: "LEASE-003",
        company: "GK Teknoloji",
        supplier: "Tech Office",
        monthlyPayment: 65000,
        startDate: "2025-07-01",
        endDate: "2027-06-30",
        discountRate: 16,
        renewalDate: "2027-04-01",
        status: "active",
        modification: false
      }
    ];
  }


  /* ==========================================================
     STORAGE
  ========================================================== */

  function loadContracts() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);

      if (stored) {
        const parsed = JSON.parse(stored);

        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (error) {
      console.error("TFRS 16 storage error:", error);
    }

    const defaults = getDefaultContracts();
    saveContracts(defaults);

    return defaults;
  }


  function saveContracts(data) {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(data)
    );
  }


  /* ==========================================================
     HELPERS
  ========================================================== */

  function escapeHtml(value) {
    if (value === null || value === undefined) {
      return "";
    }

    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }


  function formatNumber(value) {
    return Number(value || 0).toLocaleString(
      "tr-TR",
      {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      }
    );
  }


  function formatCurrency(value) {
    return `₺${formatNumber(value)}`;
  }


  function parseDate(value) {

    if (!value) return null;

    if (value instanceof Date) {
      return isNaN(value.getTime())
        ? null
        : value;
    }

    const text = String(value).trim();

    if (!text) return null;

    let date = null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {

      date = new Date(
        `${text}T00:00:00`
      );

    } else if (
      /^\d{1,2}\.\d{1,2}\.\d{4}$/.test(text)
    ) {

      const p = text.split(".");

      date = new Date(
        Number(p[2]),
        Number(p[1]) - 1,
        Number(p[0])
      );

    } else if (
      /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(text)
    ) {

      const p = text.split("/");

      date = new Date(
        Number(p[2]),
        Number(p[1]) - 1,
        Number(p[0])
      );

    } else {

      date = new Date(text);

    }

    return date && !isNaN(date.getTime())
      ? date
      : null;
  }


  function normalizeDate(value) {

    const date = parseDate(value);

    if (!date) return "";

    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-");
  }


  function formatDate(value) {

    const date = parseDate(value);

    if (!date) return "-";

    return date.toLocaleDateString("tr-TR");
  }


  function getMonthName(month) {

    const months = [
      "Ocak",
      "Şubat",
      "Mart",
      "Nisan",
      "Mayıs",
      "Haziran",
      "Temmuz",
      "Ağustos",
      "Eylül",
      "Ekim",
      "Kasım",
      "Aralık"
    ];

    return months[month - 1] || "";
  }


  function setText(id, value) {

    const element =
      document.getElementById(id);

    if (element) {
      element.textContent = value;
    }
  }


  function setInput(id, value) {

    const input =
      document.getElementById(id);

    if (input) {
      input.value = value ?? "";
    }
  }


  function getInput(id) {

    return (
      document.getElementById(id)?.value || ""
    );
  }


  /* ==========================================================
     DATE / PERIOD ENGINE
  ========================================================== */

  function monthsBetween(start, end) {

    const startDate = parseDate(start);
    const endDate = parseDate(end);

    if (!startDate || !endDate) {
      return 0;
    }

    const months =
      (
        endDate.getFullYear() -
        startDate.getFullYear()
      ) * 12 +
      (
        endDate.getMonth() -
        startDate.getMonth()
      );

    return Math.max(
      1,
      months + 1
    );
  }


  /* ==========================================================
     TFRS 16 CALCULATION ENGINE
  ========================================================== */

  function calculateLease(contract) {

    const payment =
      Number(contract.monthlyPayment) || 0;

    const annualRate =
      Number(contract.discountRate) || 0;

    const monthlyRate =
      annualRate / 100 / 12;

    const months =
      monthsBetween(
        contract.startDate,
        contract.endDate
      );

    if (
      payment <= 0 ||
      months <= 0
    ) {

      return {
        months: 0,
        liability: 0,
        rouAssets: 0,
        depreciation: 0,
        monthlyInterest: 0,
        schedule: []
      };
    }

    let liability = 0;

    if (monthlyRate === 0) {

      liability =
        payment * months;

    } else {

      liability =
        payment *
        (
          (
            1 -
            Math.pow(
              1 + monthlyRate,
              -months
            )
          ) /
          monthlyRate
        );
    }

    const initialLiability =
      liability;

    const initialROU =
      initialLiability;

    const depreciation =
      initialROU / months;

    const schedule = [];

    let openingLiability =
      initialLiability;

    let rouOpening =
      initialROU;

    const contractStart =
      parseDate(contract.startDate);

    for (
      let i = 1;
      i <= months;
      i++
    ) {

      const interest =
        openingLiability *
        monthlyRate;

      let principal =
        payment - interest;

      if (principal < 0) {
        principal = 0;
      }

      if (
        principal >
        openingLiability
      ) {
        principal =
          openingLiability;
      }

      const closingLiability =
        Math.max(
          0,
          openingLiability - principal
        );

      const rouDepreciation =
        Math.min(
          depreciation,
          rouOpening
        );

      const rouClosing =
        Math.max(
          0,
          rouOpening -
          rouDepreciation
        );

      const periodDate =
        new Date(
          contractStart.getFullYear(),
          contractStart.getMonth() +
            i -
            1,
          1
        );

      schedule.push({

        period: i,

        date: periodDate,

        year:
          periodDate.getFullYear(),

        month:
          periodDate.getMonth() + 1,

        openingLiability,

        payment,

        interest,

        principal,

        closingLiability,

        rouOpening,

        depreciation:
          rouDepreciation,

        rouClosing

      });

      openingLiability =
        closingLiability;

      rouOpening =
        rouClosing;
    }

    return {

      months,

      liability:
        initialLiability,

      rouAssets:
        initialROU,

      depreciation,

      monthlyInterest:
        schedule[0]?.interest || 0,

      schedule
    };
  }


  /* ==========================================================
     PROFESSIONAL CALCULATION ENGINE (V16.1)
     ----------------------------------------------------------
     calculateLease() above is untouched and remains the engine
     used by every existing V15 screen (detail summary, initial
     journal, accounting center, bulk journal, current/non-current
     KPIs). Nothing in this file has been rewired to use the new
     engine except the new Payment Schedule panel below.

     calculateLeaseEngine() is additive. It wraps the same core
     amortization math but accepts a wider set of TFRS 16
     parameters: paymentFrequency, paymentTiming, leaseIncreaseType/
     Rate, fixedIncrease, variablePayment, renewalOption,
     terminationOption, initialDirectCosts, leaseIncentives,
     prepayments, restorationObligation, shortTermLease,
     lowValueAsset, effectiveMonthlyRate. When a contract only has
     the legacy V15 fields (monthlyPayment, discountRate,
     startDate, endDate) it produces numerically identical results
     to calculateLease().

     NOT yet implemented (reserved for later approved phases, do
     NOT assume these are active):
       - Payment frequency other than monthly — accepted but the
         schedule is still computed monthly
       - Modification / reassessment recalculation — Faz 5/6
       - Index-based escalation ("index" type) — structure ready,
         math deferred; behaves as flat payment until implemented
     These fields are captured in the "assumptions" object of the
     result so the data model is ready, without silently producing
     wrong numbers for math that hasn't been built yet.

     V16.2 UPDATE: lease escalation (fixedRate / fixedAmount) is
     now implemented via computeEscalatedPayment() below. When
     leaseIncreaseType is "none"/undefined (every legacy contract),
     the ORIGINAL closed-form annuity path executes UNCHANGED —
     same code, same numbers as V16.1. Escalation only activates
     the alternate PV-summation path when explicitly requested.
  ========================================================== */

  function computeEscalatedPayment(
    basePayment,
    periodIndex,
    escalationType,
    escalationRate,
    fixedIncrease
  ) {

    // Escalation steps up once per contract year (every 12
    // periods from commencement), not on calendar year boundary.
    const contractYearIndex =
      Math.floor(
        (periodIndex - 1) / 12
      );

    if (escalationType === "fixedRate") {

      return (
        basePayment *
        Math.pow(
          1 + (escalationRate / 100),
          contractYearIndex
        )
      );
    }

    if (escalationType === "fixedAmount") {

      return (
        basePayment +
        (fixedIncrease * contractYearIndex)
      );
    }

    // "none", "index" (not yet computed), or anything else:
    // flat payment, unchanged.
    return basePayment;
  }

  function calculateLeaseEngine(contract) {

    const assumptions = {

      paymentFrequency:
        contract.paymentFrequency || "monthly",

      paymentTiming:
        contract.paymentTiming || "arrears",

      leaseIncreaseType:
        contract.leaseIncreaseType || "none",

      leaseIncreaseRate:
        Number(contract.leaseIncreaseRate) || 0,

      fixedIncrease:
        Number(contract.fixedIncrease) || 0,

      variablePayment:
        Number(contract.variablePayment) || 0,

      renewalOption:
        contract.renewalOption === true,

      terminationOption:
        contract.terminationOption === true,

      initialDirectCosts:
        Number(contract.initialDirectCosts) || 0,

      leaseIncentives:
        Number(contract.leaseIncentives) || 0,

      prepayments:
        Number(contract.prepayments) || 0,

      restorationObligation:
        Number(contract.restorationObligation) || 0,

      shortTermLease:
        contract.shortTermLease === true,

      lowValueAsset:
        contract.lowValueAsset === true
    };


    // TFRS 16.5-8 recognition exemption: short-term / low-value
    // leases are expensed on a straight-line basis. No ROU asset
    // or lease liability is recognized.
    if (
      assumptions.shortTermLease ||
      assumptions.lowValueAsset
    ) {

      const payment =
        Number(contract.monthlyPayment) || 0;

      const months =
        monthsBetween(
          contract.startDate,
          contract.endDate
        );

      const contractStart =
        parseDate(contract.startDate);

      const schedule = [];

      if (
        payment > 0 &&
        months > 0 &&
        contractStart
      ) {

        for (
          let i = 1;
          i <= months;
          i++
        ) {

          const periodDate =
            new Date(
              contractStart.getFullYear(),
              contractStart.getMonth() +
                i -
                1,
              1
            );

          schedule.push({
            period: i,
            date: periodDate,
            year: periodDate.getFullYear(),
            month: periodDate.getMonth() + 1,
            openingLiability: 0,
            payment,
            interest: 0,
            principal: 0,
            closingLiability: 0,
            rouOpening: 0,
            depreciation: 0,
            rouClosing: 0,
            straightLineExpense: payment
          });
        }
      }

      return {
        months,
        liability: 0,
        rouAssets: 0,
        depreciation: 0,
        monthlyInterest: 0,
        schedule,
        assumptions,
        exempt: true
      };
    }


    const payment =
      Number(contract.monthlyPayment) || 0;

    const annualRate =
      Number(contract.discountRate) || 0;

    const monthlyRate =
      contract.effectiveMonthlyRate !== undefined &&
      contract.effectiveMonthlyRate !== null &&
      contract.effectiveMonthlyRate !== ""
        ? Number(contract.effectiveMonthlyRate)
        : annualRate / 100 / 12;

    const months =
      monthsBetween(
        contract.startDate,
        contract.endDate
      );

    if (
      payment <= 0 ||
      months <= 0
    ) {

      return {
        months: 0,
        liability: 0,
        rouAssets: 0,
        depreciation: 0,
        monthlyInterest: 0,
        schedule: [],
        assumptions,
        exempt: false
      };
    }

    let liability = 0;

    // V16.2: escalating leases need a per-period payment array,
    // since the closed-form flat annuity formula no longer holds
    // once payments vary. Liability becomes the PV of the actual
    // (escalated) payment stream — TFRS 16.26/BC166 principle.
    const hasEscalation =
      assumptions.leaseIncreaseType === "fixedRate" ||
      assumptions.leaseIncreaseType === "fixedAmount";

    let paymentSchedule = null;

    if (hasEscalation) {

      paymentSchedule = [];

      for (
        let i = 1;
        i <= months;
        i++
      ) {

        paymentSchedule.push(
          computeEscalatedPayment(
            payment,
            i,
            assumptions.leaseIncreaseType,
            assumptions.leaseIncreaseRate,
            assumptions.fixedIncrease
          )
        );
      }

      if (monthlyRate === 0) {

        liability =
          paymentSchedule.reduce(
            (total, p) => total + p,
            0
          );

      } else {

        liability =
          paymentSchedule.reduce(
            (total, p, index) =>
              total +
              p /
                Math.pow(
                  1 + monthlyRate,
                  index + 1
                ),
            0
          );
      }

    } else if (monthlyRate === 0) {

      liability =
        payment * months;

    } else {

      liability =
        payment *
        (
          (
            1 -
            Math.pow(
              1 + monthlyRate,
              -months
            )
          ) /
          monthlyRate
        );
    }

    const initialLiability =
      liability;

    // Initial ROU measurement per TFRS 16.24:
    // liability + initial direct costs + prepayments
    // - lease incentives + restoration/dismantling obligation.
    // When all extended fields are 0 (legacy contracts), this
    // equals initialLiability exactly, matching calculateLease().
    const initialROU =
      initialLiability +
      assumptions.initialDirectCosts +
      assumptions.prepayments -
      assumptions.leaseIncentives +
      assumptions.restorationObligation;

    const depreciation =
      initialROU / months;

    const schedule = [];

    let openingLiability =
      initialLiability;

    let rouOpening =
      initialROU;

    const contractStart =
      parseDate(contract.startDate);

    for (
      let i = 1;
      i <= months;
      i++
    ) {

      const periodPayment =
        paymentSchedule
          ? paymentSchedule[i - 1]
          : payment;

      const interest =
        openingLiability *
        monthlyRate;

      let principal =
        periodPayment - interest;

      if (principal < 0) {
        principal = 0;
      }

      if (
        principal >
        openingLiability
      ) {
        principal =
          openingLiability;
      }

      const closingLiability =
        Math.max(
          0,
          openingLiability - principal
        );

      const rouDepreciation =
        Math.min(
          depreciation,
          rouOpening
        );

      const rouClosing =
        Math.max(
          0,
          rouOpening -
          rouDepreciation
        );

      const periodDate =
        new Date(
          contractStart.getFullYear(),
          contractStart.getMonth() +
            i -
            1,
          1
        );

      schedule.push({
        period: i,
        date: periodDate,
        year: periodDate.getFullYear(),
        month: periodDate.getMonth() + 1,
        openingLiability,
        payment: periodPayment,
        interest,
        principal,
        closingLiability,
        rouOpening,
        depreciation: rouDepreciation,
        rouClosing
      });

      openingLiability =
        closingLiability;

      rouOpening =
        rouClosing;
    }

    return {
      months,
      liability: initialLiability,
      rouAssets: initialROU,
      depreciation,
      monthlyInterest:
        schedule[0]?.interest || 0,
      schedule,
      assumptions,
      exempt: false
    };
  }


  function buildQuarterOptions() {

    return [1, 2, 3, 4]
      .map(
        quarter =>
          `<option value="${quarter}">${quarter}. Çeyrek</option>`
      )
      .join("");
  }


  function filterSchedule(
    schedule,
    year,
    subPeriod,
    periodType
  ) {

    if (!schedule || !schedule.length) {
      return [];
    }

    if (periodType === "all") {
      return schedule;
    }

    if (periodType === "annual") {

      return schedule.filter(
        item => item.year === year
      );
    }

    if (periodType === "quarterly") {

      const quarter =
        Number(subPeriod);

      const startMonth =
        (quarter - 1) * 3 + 1;

      const endMonth =
        quarter * 3;

      return schedule.filter(
        item =>
          item.year === year &&
          item.month >= startMonth &&
          item.month <= endMonth
      );
    }

    if (periodType === "monthly") {

      const month =
        Number(subPeriod);

      return schedule.filter(
        item =>
          item.year === year &&
          item.month === month
      );
    }

    return schedule;
  }


  /* ==========================================================
     PERIOD SELECTION
  ========================================================== */

  function getScheduleForYear(
    contract,
    year,
    month,
    period
  ) {

    const engine =
      calculateLease(contract);

    if (!engine.schedule.length) {
      return [];
    }

    if (period === "monthly") {

      return engine.schedule.filter(
        item =>
          item.year === year &&
          item.month === month
      );
    }


    if (period === "quarterly") {

      const quarter =
        Math.ceil(month / 3);

      const startMonth =
        (quarter - 1) * 3 + 1;

      const endMonth =
        quarter * 3;

      return engine.schedule.filter(
        item =>
          item.year === year &&
          item.month >= startMonth &&
          item.month <= endMonth
      );
    }


    if (period === "annual") {

      return engine.schedule.filter(
        item =>
          item.year === year
      );
    }


    return [];
  }


  /* ==========================================================
     LIABILITY
  ========================================================== */

  function calculateCurrentLiability(
    contract
  ) {

    const engine =
      calculateLease(contract);

    return engine.schedule
      .slice(0, 12)
      .reduce(
        (total, item) =>
          total + item.principal,
        0
      );
  }


  function calculateNonCurrentLiability(
    contract
  ) {

    const engine =
      calculateLease(contract);

    const current =
      calculateCurrentLiability(
        contract
      );

    return Math.max(
      0,
      engine.liability - current
    );
  }


  /* ==========================================================
     CURRENT / NON-CURRENT — REPORTING DATE BASED (V16.3 / Faz 6)
     ----------------------------------------------------------
     calculateCurrentLiability()/calculateNonCurrentLiability()
     above are UNTOUCHED and keep working exactly as in V15 (they
     always look at the first 12 months from contract inception).

     The functions below are additive: given an actual reporting
     date, they find the outstanding liability AS OF that date
     (from calculateLeaseEngine()'s schedule) and split it into
     the next-12-months current portion and the remaining
     non-current portion — the correct TFRS 16 classification
     basis, independent of when the contract started.
  ========================================================== */

  function getScheduleAsOfReportingDate(
    contract,
    reportingDate
  ) {

    const engine =
      calculateLeaseEngine(
        contract
      );

    const ry =
      reportingDate.getFullYear();

    const rm =
      reportingDate.getMonth() + 1;

    const isClosed =
      item =>
        item.year < ry ||
        (
          item.year === ry &&
          item.month <= rm
        );

    const closedPeriods =
      engine.schedule.filter(
        isClosed
      );

    const futurePeriods =
      engine.schedule.filter(
        item => !isClosed(item)
      );

    const outstandingLiability =
      closedPeriods.length
        ? closedPeriods[
            closedPeriods.length - 1
          ].closingLiability
        : engine.liability;

    return {
      engine,
      closedPeriods,
      futurePeriods,
      outstandingLiability
    };
  }


  function calculateLiabilitySplitAsOf(
    contract,
    reportingDate
  ) {

    const {
      futurePeriods,
      outstandingLiability
    } = getScheduleAsOfReportingDate(
      contract,
      reportingDate
    );

    const next12 =
      futurePeriods.slice(0, 12);

    const current =
      next12.reduce(
        (total, item) =>
          total + item.principal,
        0
      );

    const nonCurrent =
      Math.max(
        0,
        outstandingLiability - current
      );

    return {
      reportingDate,
      outstandingLiability,
      current,
      nonCurrent,
      total: outstandingLiability,
      next12Payments:
        next12.reduce(
          (t, i) => t + i.payment,
          0
        ),
      next12Interest:
        next12.reduce(
          (t, i) => t + i.interest,
          0
        ),
      next12Principal:
        current
    };
  }


  function calculateCurrentLiabilityAsOf(
    contract,
    reportingDate
  ) {

    return calculateLiabilitySplitAsOf(
      contract,
      reportingDate
    ).current;
  }


  function calculateNonCurrentLiabilityAsOf(
    contract,
    reportingDate
  ) {

    return calculateLiabilitySplitAsOf(
      contract,
      reportingDate
    ).nonCurrent;
  }


  function calculateNext12Months(
    contract
  ) {

    const engine =
      calculateLease(contract);

    return engine.schedule
      .slice(0, 12)
      .reduce(
        (total, item) =>
          total + item.payment,
        0
      );
  }


  /* ==========================================================
     RENEWAL
  ========================================================== */

  function isRenewalWithin90Days(
    contract
  ) {

    if (!contract.renewalDate) {
      return false;
    }

    const renewal =
      parseDate(contract.renewalDate);

    if (!renewal) {
      return false;
    }

    const today =
      new Date();

    today.setHours(
      0,
      0,
      0,
      0
    );

    const difference =
      renewal.getTime() -
      today.getTime();

    const days =
      difference /
      (1000 * 60 * 60 * 24);

    return (
      days >= 0 &&
      days <= 90
    );
  }


  /* ==========================================================
     KPI
  ========================================================== */

  function updateKPIs() {

    const active =
      contracts.filter(
        c => c.status === "active"
      );

    let liability = 0;
    let rou = 0;
    let next12 = 0;

    active.forEach(
      contract => {

        const engine =
          calculateLease(contract);

        liability +=
          engine.liability;

        rou +=
          engine.rouAssets;

        next12 +=
          calculateNext12Months(
            contract
          );
      }
    );

    const renewals =
      active.filter(
        isRenewalWithin90Days
      ).length;

    const modifications =
      active.filter(
        c => c.modification === true
      ).length;

    setText(
      "contractCount",
      active.length
    );

    setText(
      "leaseLiability",
      formatCurrency(liability)
    );

    setText(
      "rouAssets",
      formatCurrency(rou)
    );

    setText(
      "next12Months",
      formatCurrency(next12)
    );

    setText(
      "renewals90Days",
      renewals
    );

    setText(
      "modifications",
      modifications
    );
  }


  /* ==========================================================
     COMPANY FILTER
  ========================================================== */

  function populateCompanyFilter() {

    const select =
      document.getElementById(
        "companyFilter"
      );

    if (!select) return;

    const current =
      select.value;

    const companies =
      [
        ...new Set(
          contracts
            .map(
              c => c.company
            )
            .filter(Boolean)
        )
      ].sort();

    select.innerHTML =
      `<option value="all">Tüm Şirketler</option>`;

    companies.forEach(
      company => {

        const option =
          document.createElement(
            "option"
          );

        option.value =
          company;

        option.textContent =
          company;

        select.appendChild(
          option
        );
      }
    );

    if (
      companies.includes(current)
    ) {
      select.value =
        current;
    }
  }


  /* ==========================================================
     TABLE
  ========================================================== */

  function renderTable() {

    const tbody =
      document.getElementById(
        "contractTableBody"
      );

    if (!tbody) return;

    const search =
      (
        document.getElementById(
          "searchInput"
        )?.value || ""
      )
        .trim()
        .toLowerCase();

    const status =
      document.getElementById(
        "statusFilter"
      )?.value || "all";

    const company =
      document.getElementById(
        "companyFilter"
      )?.value || "all";

    const filtered =
      contracts.filter(
        contract => {

          const searchable =
            `
            ${contract.id}
            ${contract.company}
            ${contract.supplier}
            `
              .toLowerCase();

          return (

            (
              !search ||
              searchable.includes(
                search
              )
            )

            &&

            (
              status === "all" ||
              contract.status === status
            )

            &&

            (
              company === "all" ||
              contract.company === company
            )

          );
        }
      );

    tbody.innerHTML = "";

    filtered.forEach(
      contract => {

        const renewal =
          isRenewalWithin90Days(
            contract
          );

        const row =
          document.createElement(
            "tr"
          );

        row.innerHTML = `

          <td>
            <div class="contract-id">
              ${escapeHtml(
                contract.id
              )}
            </div>
          </td>

          <td>
            ${escapeHtml(
              contract.company
            )}
          </td>

          <td>
            <div class="supplier">
              ${escapeHtml(
                contract.supplier
              )}
            </div>
          </td>

          <td class="date">
            ${formatDate(
              contract.startDate
            )}
          </td>

          <td class="date">
            ${formatDate(
              contract.endDate
            )}
          </td>

          <td>
            ${formatCurrency(
              contract.monthlyPayment
            )}
          </td>

          <td>
            <span class="status ${
              contract.status
            }">

              ${
                contract.status ===
                "active"
                  ? "Aktif"
                  : "Pasif"
              }

            </span>
          </td>

          <td>
            <span class="${
              renewal
                ? "renewal-warning"
                : ""
            }">

              ${formatDate(
                contract.renewalDate
              )}

              ${
                renewal
                  ? " ⚠"
                  : ""
              }

            </span>
          </td>

          <td>

            <button
              class="row-action"
              type="button"
              data-id="${escapeHtml(
                contract.id
              )}"
            >
              Görüntüle
            </button>

          </td>

        `;

        row
          .querySelector(
            ".row-action"
          )
          ?.addEventListener(
            "click",
            () =>
              openDetail(
                contract.id
              )
          );

        tbody.appendChild(
          row
        );
      }
    );

    setText(
      "resultCount",
      `${filtered.length} kayıt`
    );

    document
      .getElementById(
        "emptyState"
      )
      ?.classList.toggle(
        "hidden",
        filtered.length > 0
      );
  }


  /* ==========================================================
     REFRESH
  ========================================================== */

  function refresh() {

    updateKPIs();

    populateCompanyFilter();

    renderTable();
  }


  /* ==========================================================
     CONTRACT MODAL
  ========================================================== */

  document
    .getElementById(
      "newContractButton"
    )
    ?.addEventListener(
      "click",
      () =>
        openContractModal()
    );


  function openContractModal(
    contract = null
  ) {

    const modal =
      document.getElementById(
        "contractModal"
      );

    if (!modal) return;

    document
      .getElementById(
        "contractForm"
      )
      ?.reset();

    setInput(
      "contractId",
      contract?.id || ""
    );

    setInput(
      "company",
      contract?.company ||
        "GK Holding"
    );

    setInput(
      "supplier",
      contract?.supplier || ""
    );

    setInput(
      "monthlyPayment",
      contract?.monthlyPayment || ""
    );

    setInput(
      "startDate",
      contract?.startDate || ""
    );

    setInput(
      "endDate",
      contract?.endDate || ""
    );

    setInput(
      "discountRate",
      contract?.discountRate ??
        18
    );

    setInput(
      "renewalDate",
      contract?.renewalDate || ""
    );

    const title =
      document.getElementById(
        "modalTitle"
      );

    if (title) {

      title.textContent =
        contract
          ? "Sözleşmeyi Düzenle"
          : "Yeni Sözleşme";
    }

    modal.classList.remove(
      "hidden"
    );
  }


  function closeContractModal() {

    document
      .getElementById(
        "contractModal"
      )
      ?.classList.add(
        "hidden"
      );
  }


  document
    .getElementById(
      "closeModal"
    )
    ?.addEventListener(
      "click",
      closeContractModal
    );


  document
    .getElementById(
      "cancelModal"
    )
    ?.addEventListener(
      "click",
      closeContractModal
    );


  /* ==========================================================
     CONTRACT VALIDATION
  ========================================================== */

  function validateContract(
    contract
  ) {

    const errors = [];

    if (!contract.id) {
      errors.push(
        "Sözleşme ID boş."
      );
    }

    if (!contract.company) {
      errors.push(
        "Şirket boş."
      );
    }

    if (!contract.supplier) {
      errors.push(
        "Tedarikçi boş."
      );
    }

    if (
      !contract.monthlyPayment ||
      contract.monthlyPayment <= 0
    ) {
      errors.push(
        "Aylık kira tutarı geçersiz."
      );
    }

    if (!contract.startDate) {
      errors.push(
        "Başlangıç tarihi geçersiz."
      );
    }

    if (!contract.endDate) {
      errors.push(
        "Bitiş tarihi geçersiz."
      );
    }

    const start =
      parseDate(
        contract.startDate
      );

    const end =
      parseDate(
        contract.endDate
      );

    if (
      start &&
      end &&
      start >= end
    ) {
      errors.push(
        "Başlangıç tarihi bitiş tarihinden önce olmalıdır."
      );
    }

    if (
      contract.discountRate < 0
    ) {
      errors.push(
        "İskonto oranı negatif olamaz."
      );
    }

    return {
      valid:
        errors.length === 0,
      errors
    };
  }


  /* ==========================================================
     SAVE CONTRACT
  ========================================================== */

  document
    .getElementById(
      "contractForm"
    )
    ?.addEventListener(
      "submit",
      event => {

        event.preventDefault();

        const id =
          getInput(
            "contractId"
          ).trim();

        const existing =
          contracts.find(
            c => c.id === id
          );

        const contract = {

          id,

          company:
            getInput(
              "company"
            ).trim(),

          supplier:
            getInput(
              "supplier"
            ).trim(),

          monthlyPayment:
            Number(
              getInput(
                "monthlyPayment"
              )
            ) || 0,

          startDate:
            normalizeDate(
              getInput(
                "startDate"
              )
            ),

          endDate:
            normalizeDate(
              getInput(
                "endDate"
              )
            ),

          discountRate:
            Number(
              getInput(
                "discountRate"
              )
            ) || 0,

          renewalDate:
            normalizeDate(
              getInput(
                "renewalDate"
              )
            ),

          status:
            existing?.status ||
            "active",

          modification:
            existing?.modification ||
            false
        };


        const validation =
          validateContract(
            contract
          );

        if (!validation.valid) {

          alert(
            validation.errors.join(
              "\n"
            )
          );

          return;
        }


        if (
          !existing &&
          contracts.some(
            c => c.id === id
          )
        ) {

          alert(
            "Bu Sözleşme ID zaten mevcut."
          );

          return;
        }


        if (existing) {

          contracts =
            contracts.map(
              item =>
                item.id === id
                  ? contract
                  : item
            );

        } else {

          contracts.push(
            contract
          );
        }


        saveContracts(
          contracts
        );

        refresh();

        closeContractModal();

        openDetail(id);
      }
    );


  /* ==========================================================
     JOURNAL HELPERS
  ========================================================== */

  function generateInitialEntry(
    contract
  ) {

    const engine =
      calculateLease(
        contract
      );

    return [

      {
        account:
          "260 Kullanım Hakkı Varlığı",

        debit:
          engine.rouAssets,

        credit: 0
      },

      {
        account:
          "401 Kiralama Yükümlülüğü",

        debit: 0,

        credit:
          engine.liability
      }

    ];
  }


  function generateReclassificationEntry(
    contract,
    reportingDate
  ) {

    let current;
    let nonCurrent;

    if (reportingDate) {

      // V16.3: reporting-date-aware split (Faz 6)
      const split =
        calculateLiabilitySplitAsOf(
          contract,
          reportingDate
        );

      current = split.current;
      nonCurrent = split.nonCurrent;

    } else {

      // No reportingDate passed: exact V15 behavior, unchanged.
      current =
        calculateCurrentLiability(
          contract
        );

      nonCurrent =
        calculateNonCurrentLiability(
          contract
        );
    }

    return [

      {
        account:
          "401 Kiralama Yükümlülüğü - Non-current",

        debit: 0,

        credit:
          nonCurrent
      },

      {
        account:
          "301 Kiralama Yükümlülüğü - Current",

        debit:
          current,

        credit: 0
      }

    ];
  }


  function getJournalForPeriod(
    contract,
    startMonth,
    endMonth
  ) {

    const engine =
      calculateLease(
        contract
      );

    const selected =
      engine.schedule.slice(
        startMonth - 1,
        endMonth
      );

    if (!selected.length) {
      return [];
    }

    const interest =
      selected.reduce(
        (total, item) =>
          total + item.interest,
        0
      );

    const principal =
      selected.reduce(
        (total, item) =>
          total + item.principal,
        0
      );

    const payment =
      selected.reduce(
        (total, item) =>
          total + item.payment,
        0
      );

    const depreciation =
      selected.reduce(
        (total, item) =>
          total + item.depreciation,
        0
      );

    return [

      {
        account:
          "780 Finansman Giderleri",

        debit:
          interest,

        credit: 0
      },

      {
        account:
          "401 Kiralama Yükümlülüğü",

        debit:
          principal,

        credit: 0
      },

      {
        account:
          "381 Kira Borçları / Ödeme",

        debit: 0,

        credit:
          payment
      },

      {
        account:
          "770 / 730 Amortisman Giderleri",

        debit:
          depreciation,

        credit: 0
      },

      {
        account:
          "268 Birikmiş Amortismanlar",

        debit: 0,

        credit:
          depreciation
      }

    ];
  }


  /* ==========================================================
     JOURNAL RENDER
  ========================================================== */

  function renderJournalEntry(
    title,
    entries
  ) {

    if (
      !entries ||
      !entries.length
    ) {
      return "";
    }

    const debit =
      entries.reduce(
        (total, item) =>
          total +
          Number(
            item.debit || 0
          ),
        0
      );

    const credit =
      entries.reduce(
        (total, item) =>
          total +
          Number(
            item.credit || 0
          ),
        0
      );

    const difference =
      Math.abs(
        debit - credit
      );

    const balanced =
      difference < 0.01;


    return `

      <div
        style="
          margin-top:22px;
          border:1px solid #e5e7eb;
          border-radius:12px;
          overflow:hidden;
          background:white;
        "
      >

        <div
          style="
            padding:14px 16px;
            background:#f8fafc;
            border-bottom:1px solid #e5e7eb;
          "
        >

          <strong>
            ${escapeHtml(title)}
          </strong>

        </div>


        <div style="overflow:auto;">

          <table
            style="
              width:100%;
              border-collapse:collapse;
              min-width:600px;
            "
          >

            <thead>

              <tr>

                <th
                  style="
                    padding:10px;
                    text-align:left;
                  "
                >
                  Hesap
                </th>

                <th
                  style="
                    padding:10px;
                    text-align:right;
                  "
                >
                  Borç
                </th>

                <th
                  style="
                    padding:10px;
                    text-align:right;
                  "
                >
                  Alacak
                </th>

              </tr>

            </thead>


            <tbody>

              ${entries.map(
                item => `

                  <tr>

                    <td
                      style="
                        padding:10px;
                        border-top:1px solid #edf0f4;
                      "
                    >
                      ${escapeHtml(
                        item.account
                      )}
                    </td>

                    <td
                      style="
                        padding:10px;
                        text-align:right;
                        border-top:1px solid #edf0f4;
                      "
                    >
                      ${
                        item.debit
                          ? formatCurrency(
                              item.debit
                            )
                          : "-"
                      }
                    </td>

                    <td
                      style="
                        padding:10px;
                        text-align:right;
                        border-top:1px solid #edf0f4;
                      "
                    >
                      ${
                        item.credit
                          ? formatCurrency(
                              item.credit
                            )
                          : "-"
                      }
                    </td>

                  </tr>

                `
              ).join("")}

            </tbody>


            <tfoot>

              <tr>

                <td
                  style="
                    padding:11px;
                    font-weight:800;
                    border-top:2px solid #cbd5e1;
                  "
                >
                  TOPLAM
                </td>

                <td
                  style="
                    padding:11px;
                    text-align:right;
                    font-weight:800;
                    border-top:2px solid #cbd5e1;
                  "
                >
                  ${formatCurrency(
                    debit
                  )}
                </td>

                <td
                  style="
                    padding:11px;
                    text-align:right;
                    font-weight:800;
                    border-top:2px solid #cbd5e1;
                  "
                >
                  ${formatCurrency(
                    credit
                  )}
                </td>

              </tr>

            </tfoot>

          </table>

        </div>


        <div
          style="
            padding:10px 14px;
            background:${
              balanced
                ? "#ecfdf5"
                : "#fef2f2"
            };
            color:${
              balanced
                ? "#166534"
                : "#991b1b"
            };
            font-size:11px;
            font-weight:800;
          "
        >

          ${
            balanced
              ? "✓ Borç / Alacak kontrolü başarılı"
              : "✕ BORÇ / ALACAK DENGESİZ"
          }

        </div>

      </div>
    `;
  }


  /* ==========================================================
     ACCOUNTING CENTER
  ========================================================== */

  function buildYearOptions(
    contract
  ) {

    const start =
      parseDate(
        contract.startDate
      )?.getFullYear();

    const end =
      parseDate(
        contract.endDate
      )?.getFullYear();

    if (!start || !end) {

      return `
        <option>
          ${new Date().getFullYear()}
        </option>
      `;
    }

    let html = "";

    for (
      let year = start;
      year <= end;
      year++
    ) {

      html += `
        <option value="${year}">
          ${year}
        </option>
      `;
    }

    return html;
  }


  function buildMonthOptions() {

    const months = [
      "Ocak",
      "Şubat",
      "Mart",
      "Nisan",
      "Mayıs",
      "Haziran",
      "Temmuz",
      "Ağustos",
      "Eylül",
      "Ekim",
      "Kasım",
      "Aralık"
    ];

    return months
      .map(
        (month, index) =>
          `
          <option value="${
            index + 1
          }">
            ${month}
          </option>
          `
      )
      .join("");
  }


  function renderAccountingCenter(
    contract
  ) {

    return `

      <div
        style="
          margin-top:28px;
          border-top:1px solid #e5e7eb;
          padding-top:24px;
        "
      >

        <div>

          <div
            style="
              font-size:10px;
              color:#64748b;
              font-weight:800;
              letter-spacing:1px;
            "
          >
            MUHASEBE İŞLEMLERİ
          </div>

          <h3
            style="
              margin:5px 0 0;
              font-size:18px;
            "
          >
            Muhasebe Fiş Merkezi
          </h3>

          <p
            style="
              margin:5px 0 0;
              color:#64748b;
              font-size:11px;
            "
          >
            Tek sözleşme için fiş oluşturabilirsiniz.
          </p>

        </div>


        <div
          style="
            display:grid;
            grid-template-columns:
              repeat(auto-fit,minmax(170px,1fr));
            gap:12px;
            margin-top:18px;
          "
        >

          <div
            style="
              background:#f8fafc;
              border:1px solid #e5e7eb;
              border-radius:10px;
              padding:14px;
            "
          >

            <label
              style="
                display:block;
                font-size:10px;
                color:#64748b;
                margin-bottom:7px;
              "
            >
              Raporlama Yılı
            </label>

            <select
              id="accountingYear"
              style="
                width:100%;
                padding:9px;
                border:1px solid #d1d5db;
                border-radius:7px;
              "
            >
              ${buildYearOptions(
                contract
              )}
            </select>

          </div>


          <div
            style="
              background:#f8fafc;
              border:1px solid #e5e7eb;
              border-radius:10px;
              padding:14px;
            "
          >

            <label
              style="
                display:block;
                font-size:10px;
                color:#64748b;
                margin-bottom:7px;
              "
            >
              Fiş Periyodu
            </label>

            <select
              id="accountingPeriod"
              style="
                width:100%;
                padding:9px;
                border:1px solid #d1d5db;
                border-radius:7px;
              "
            >

              <option value="monthly">
                Aylık
              </option>

              <option value="quarterly">
                Çeyreklik
              </option>

              <option value="annual">
                Yıllık
              </option>

              <option value="closing">
                Yıllık Kapanış
              </option>

            </select>

          </div>


          <div
            style="
              background:#f8fafc;
              border:1px solid #e5e7eb;
              border-radius:10px;
              padding:14px;
            "
          >

            <label
              style="
                display:block;
                font-size:10px;
                color:#64748b;
                margin-bottom:7px;
              "
            >
              Dönem
            </label>

            <select
              id="accountingMonth"
              style="
                width:100%;
                padding:9px;
                border:1px solid #d1d5db;
                border-radius:7px;
              "
            >
              ${buildMonthOptions()}
            </select>

          </div>


          <div
            style="
              display:flex;
              align-items:end;
            "
          >

            <button
              id="generateJournal"
              class="primary-button"
              type="button"
              style="
                width:100%;
                min-height:42px;
              "
            >
              Fişi Oluştur
            </button>

          </div>

        </div>


        <div
          id="journalPreview"
        ></div>


        <div
          style="
            margin-top:18px;
            padding:14px;
            border:1px solid #dbeafe;
            background:#eff6ff;
            border-radius:10px;
          "
        >

          <strong
            style="
              display:block;
              margin-bottom:5px;
              font-size:12px;
            "
          >
            Toplu Muhasebe Merkezi
          </strong>

          <span
            style="
              font-size:11px;
              color:#475569;
            "
          >
            Portföydeki tüm aktif sözleşmeler için toplu fiş üretin.
          </span>

          <button
            id="openBulkJournalButton"
            type="button"
            style="
              margin-top:12px;
              width:100%;
              min-height:42px;
              border:0;
              border-radius:8px;
              background:#0f172a;
              color:white;
              font-weight:700;
              cursor:pointer;
            "
          >
            Tüm Sözleşmeler İçin Toplu Fiş Üret
          </button>

        </div>

      </div>

    `;
  }


  /* ==========================================================
     SINGLE JOURNAL
  ========================================================== */

  function generateSelectedJournal(
    contract
  ) {

    const year =
      Number(
        document.getElementById(
          "accountingYear"
        )?.value
      );

    const period =
      document.getElementById(
        "accountingPeriod"
      )?.value;

    const month =
      Number(
        document.getElementById(
          "accountingMonth"
        )?.value
      );

    const preview =
      document.getElementById(
        "journalPreview"
      );


    if (period === "closing") {

      const reportingDate =
        new Date(
          year,
          11,
          31
        );

      const entries =
        generateReclassificationEntry(
          contract,
          reportingDate
        );

      if (preview) {

        preview.innerHTML =
          renderJournalEntry(
            `${year} Yıl Sonu Current / Non-current Kapanış Fişi`,
            entries
          );
      }

      return;
    }


    const selected =
      getScheduleForYear(
        contract,
        year,
        month,
        period
      );


    if (!selected.length) {

      if (preview) {

        preview.innerHTML = `

          <div
            style="
              margin-top:18px;
              padding:15px;
              background:#fff7ed;
              border:1px solid #fed7aa;
              border-radius:9px;
              color:#9a3412;
            "
          >
            Bu sözleşmede seçilen dönem için ödeme planı bulunmuyor.
          </div>

        `;
      }

      return;
    }


    const interest =
      selected.reduce(
        (total, item) =>
          total + item.interest,
        0
      );

    const principal =
      selected.reduce(
        (total, item) =>
          total + item.principal,
        0
      );

    const payment =
      selected.reduce(
        (total, item) =>
          total + item.payment,
        0
      );

    const depreciation =
      selected.reduce(
        (total, item) =>
          total + item.depreciation,
        0
      );


    const entries = [

      {
        account:
          "780 Finansman Giderleri",

        debit:
          interest,

        credit: 0
      },

      {
        account:
          "401 Kiralama Yükümlülüğü",

        debit:
          principal,

        credit: 0
      },

      {
        account:
          "381 Kira Borçları / Ödeme",

        debit: 0,

        credit:
          payment
      },

      {
        account:
          "770 / 730 Amortisman Giderleri",

        debit:
          depreciation,

        credit: 0
      },

      {
        account:
          "268 Birikmiş Amortismanlar",

        debit: 0,

        credit:
          depreciation
      }

    ];


    let title =
      `${year} - Yıllık Muhasebe Fişi`;

    if (
      period === "monthly"
    ) {

      title =
        `${year} - ${
          getMonthName(month)
        } Aylık Muhasebe Fişi`;

    } else if (
      period === "quarterly"
    ) {

      title =
        `${year} - ${
          Math.ceil(month / 3)
        }. Çeyrek Muhasebe Fişi`;
    }


    if (preview) {

      preview.innerHTML =
        renderJournalEntry(
          title,
          entries
        );
    }
  }


  /* ==========================================================
     PAYMENT SCHEDULE — "Kira Ödeme Planı" (V16.1 / Faz 3)
     ----------------------------------------------------------
     Read-only view of the full amortization schedule for a
     single contract, built on top of calculateLeaseEngine().
     Does not touch renderAccountingCenter() or any journal
     generation logic above.
  ========================================================== */

  function renderPaymentScheduleSection(contract) {

    return `

      <div
        style="
          margin-top:28px;
          border-top:1px solid #e5e7eb;
          padding-top:24px;
        "
      >

        <div>

          <div
            style="
              font-size:10px;
              color:#64748b;
              font-weight:800;
              letter-spacing:1px;
            "
          >
            ÖDEME PLANI
          </div>

          <h3
            style="
              margin:5px 0 0;
              font-size:18px;
            "
          >
            Kira Ödeme Planı
          </h3>

          <p
            style="
              margin:5px 0 0;
              color:#64748b;
              font-size:11px;
            "
          >
            Her dönem için açılış/kapanış yükümlülüğü, faiz, anapara, amortisman ve ROU net defter değeri.
          </p>

        </div>


        <div
          style="
            display:grid;
            grid-template-columns:
              repeat(auto-fit,minmax(150px,1fr));
            gap:12px;
            margin-top:16px;
          "
        >

          <div
            style="
              background:#f8fafc;
              border:1px solid #e5e7eb;
              border-radius:10px;
              padding:12px;
            "
          >
            <label
              style="
                display:block;
                font-size:10px;
                color:#64748b;
                margin-bottom:6px;
              "
            >
              Periyot
            </label>

            <select
              id="schedulePeriodType"
              style="
                width:100%;
                padding:8px;
                border:1px solid #d1d5db;
                border-radius:7px;
              "
            >
              <option value="all">Tümü</option>
              <option value="monthly">Aylık</option>
              <option value="quarterly">Çeyreklik</option>
              <option value="annual">Yıllık</option>
            </select>
          </div>


          <div
            style="
              background:#f8fafc;
              border:1px solid #e5e7eb;
              border-radius:10px;
              padding:12px;
            "
          >
            <label
              style="
                display:block;
                font-size:10px;
                color:#64748b;
                margin-bottom:6px;
              "
            >
              Yıl
            </label>

            <select
              id="scheduleYear"
              style="
                width:100%;
                padding:8px;
                border:1px solid #d1d5db;
                border-radius:7px;
              "
            >
              ${buildYearOptions(contract)}
            </select>
          </div>


          <div
            style="
              background:#f8fafc;
              border:1px solid #e5e7eb;
              border-radius:10px;
              padding:12px;
            "
          >
            <label
              style="
                display:block;
                font-size:10px;
                color:#64748b;
                margin-bottom:6px;
              "
            >
              Ay / Çeyrek
            </label>

            <select
              id="scheduleSubPeriod"
              disabled
              style="
                width:100%;
                padding:8px;
                border:1px solid #d1d5db;
                border-radius:7px;
                opacity:.5;
              "
            >
              ${buildMonthOptions()}
            </select>
          </div>


          <div
            style="
              display:flex;
              align-items:end;
            "
          >
            <button
              id="exportScheduleButton"
              type="button"
              class="primary-button"
              style="
                width:100%;
                min-height:38px;
              "
            >
              Excel'e Aktar
            </button>
          </div>

        </div>


        <div
          style="
            overflow:auto;
            margin-top:16px;
            border:1px solid #e5e7eb;
            border-radius:10px;
          "
        >
          <table
            style="
              width:100%;
              border-collapse:collapse;
              min-width:820px;
            "
          >
            <thead>
              <tr style="background:#f8fafc;">
                <th style="padding:9px;text-align:left;font-size:11px;">Dönem</th>
                <th style="padding:9px;text-align:left;font-size:11px;">Tarih</th>
                <th style="padding:9px;text-align:right;font-size:11px;">Açılış Yükümlülüğü</th>
                <th style="padding:9px;text-align:right;font-size:11px;">Ödeme</th>
                <th style="padding:9px;text-align:right;font-size:11px;">Faiz</th>
                <th style="padding:9px;text-align:right;font-size:11px;">Anapara</th>
                <th style="padding:9px;text-align:right;font-size:11px;">Kapanış Yükümlülüğü</th>
                <th style="padding:9px;text-align:right;font-size:11px;">Amortisman</th>
                <th style="padding:9px;text-align:right;font-size:11px;">ROU Net Defter Değeri</th>
              </tr>
            </thead>
            <tbody id="scheduleTableBody"></tbody>
          </table>
        </div>

        <div
          id="scheduleEmptyState"
          style="
            display:none;
            padding:14px;
            text-align:center;
            color:#64748b;
            font-size:12px;
          "
        >
          Seçilen dönem için ödeme planı kaydı bulunmuyor.
        </div>

      </div>

    `;
  }


  function renderPaymentScheduleTable(contract) {

    const tbody =
      document.getElementById(
        "scheduleTableBody"
      );

    if (!tbody) return;

    const periodType =
      document.getElementById(
        "schedulePeriodType"
      )?.value || "all";

    const year =
      Number(
        document.getElementById(
          "scheduleYear"
        )?.value
      );

    const subPeriod =
      document.getElementById(
        "scheduleSubPeriod"
      )?.value;

    const engine =
      calculateLeaseEngine(
        contract
      );

    const rows =
      filterSchedule(
        engine.schedule,
        year,
        subPeriod,
        periodType
      );

    tbody.innerHTML =
      rows
        .map(
          item => `
            <tr>
              <td style="padding:8px;border-top:1px solid #edf0f4;font-size:12px;">${item.period}</td>
              <td style="padding:8px;border-top:1px solid #edf0f4;font-size:12px;">${getMonthName(item.month)} ${item.year}</td>
              <td style="padding:8px;border-top:1px solid #edf0f4;text-align:right;font-size:12px;">${formatCurrency(item.openingLiability)}</td>
              <td style="padding:8px;border-top:1px solid #edf0f4;text-align:right;font-size:12px;">${formatCurrency(item.payment)}</td>
              <td style="padding:8px;border-top:1px solid #edf0f4;text-align:right;font-size:12px;">${formatCurrency(item.interest)}</td>
              <td style="padding:8px;border-top:1px solid #edf0f4;text-align:right;font-size:12px;">${formatCurrency(item.principal)}</td>
              <td style="padding:8px;border-top:1px solid #edf0f4;text-align:right;font-size:12px;">${formatCurrency(item.closingLiability)}</td>
              <td style="padding:8px;border-top:1px solid #edf0f4;text-align:right;font-size:12px;">${formatCurrency(item.depreciation)}</td>
              <td style="padding:8px;border-top:1px solid #edf0f4;text-align:right;font-size:12px;">${formatCurrency(item.rouClosing)}</td>
            </tr>
          `
        )
        .join("");

    const empty =
      document.getElementById(
        "scheduleEmptyState"
      );

    if (empty) {
      empty.style.display =
        rows.length
          ? "none"
          : "block";
    }
  }


  function updateScheduleSubPeriodUI() {

    const periodType =
      document.getElementById(
        "schedulePeriodType"
      )?.value;

    const subPeriod =
      document.getElementById(
        "scheduleSubPeriod"
      );

    if (!subPeriod) return;

    if (periodType === "quarterly") {

      subPeriod.innerHTML =
        buildQuarterOptions();

      subPeriod.disabled = false;
      subPeriod.style.opacity = "1";

    } else if (periodType === "monthly") {

      subPeriod.innerHTML =
        buildMonthOptions();

      subPeriod.disabled = false;
      subPeriod.style.opacity = "1";

    } else {

      subPeriod.disabled = true;
      subPeriod.style.opacity = ".5";
    }
  }


  function initPaymentScheduleEvents(contract) {

    updateScheduleSubPeriodUI();
    renderPaymentScheduleTable(contract);

    document
      .getElementById(
        "schedulePeriodType"
      )
      ?.addEventListener(
        "change",
        () => {
          updateScheduleSubPeriodUI();
          renderPaymentScheduleTable(contract);
        }
      );

    document
      .getElementById(
        "scheduleYear"
      )
      ?.addEventListener(
        "change",
        () =>
          renderPaymentScheduleTable(contract)
      );

    document
      .getElementById(
        "scheduleSubPeriod"
      )
      ?.addEventListener(
        "change",
        () =>
          renderPaymentScheduleTable(contract)
      );

    document
      .getElementById(
        "exportScheduleButton"
      )
      ?.addEventListener(
        "click",
        () =>
          exportPaymentSchedule(contract)
      );
  }


  function exportPaymentSchedule(contract) {

    const engine =
      calculateLeaseEngine(
        contract
      );

    if (!engine.schedule.length) {

      alert(
        "Aktarılacak ödeme planı bulunamadı."
      );

      return;
    }

    const assumptionRows = [
      { "Alan": "Sözleşme ID", "Değer": contract.id },
      { "Alan": "Şirket", "Değer": contract.company },
      { "Alan": "Tedarikçi", "Değer": contract.supplier },
      { "Alan": "Başlangıç Tarihi", "Değer": formatDate(contract.startDate) },
      { "Alan": "Bitiş Tarihi", "Değer": formatDate(contract.endDate) },
      { "Alan": "Aylık Kira", "Değer": contract.monthlyPayment },
      { "Alan": "Yıllık İskonto Oranı (%)", "Değer": contract.discountRate },
      { "Alan": "İlk Kira Yükümlülüğü", "Değer": engine.liability },
      { "Alan": "ROU Varlığı (Başlangıç)", "Değer": engine.rouAssets },
      { "Alan": "Rapor Tarihi", "Değer": formatDate(new Date()) }
    ];

    const scheduleRows =
      engine.schedule.map(
        item => ({
          "Dönem": item.period,
          "Yıl": item.year,
          "Ay": getMonthName(item.month),
          "Açılış Yükümlülüğü": item.openingLiability,
          "Ödeme": item.payment,
          "Faiz": item.interest,
          "Anapara": item.principal,
          "Kapanış Yükümlülüğü": item.closingLiability,
          "Amortisman": item.depreciation,
          "ROU Net Defter Değeri": item.rouClosing
        })
      );

    if (typeof XLSX !== "undefined") {

      try {

        const workbook =
          XLSX.utils.book_new();

        const assumptionSheet =
          XLSX.utils.json_to_sheet(
            assumptionRows
          );

        XLSX.utils.book_append_sheet(
          workbook,
          assumptionSheet,
          "Varsayimlar"
        );

        const scheduleSheet =
          XLSX.utils.json_to_sheet(
            scheduleRows
          );

        XLSX.utils.book_append_sheet(
          workbook,
          scheduleSheet,
          "Odeme Plani"
        );

        XLSX.writeFile(
          workbook,
          `${contract.id}_Odeme_Plani.xlsx`
        );

        return;

      } catch (error) {

        console.error(
          "Payment schedule export error:",
          error
        );
      }
    }

    const headers =
      Object.keys(
        scheduleRows[0]
      );

    const csv =
      [
        headers.join(";"),
        ...scheduleRows.map(
          row =>
            headers
              .map(h => row[h])
              .join(";")
        )
      ].join("\n");

    const blob =
      new Blob(
        [
          "\uFEFF" +
          csv
        ],
        {
          type:
            "text/csv;charset=utf-8;"
        }
      );

    const url =
      URL.createObjectURL(
        blob
      );

    const link =
      document.createElement(
        "a"
      );

    link.href = url;

    link.download =
      `${contract.id}_Odeme_Plani.csv`;

    document.body.appendChild(
      link
    );

    link.click();
    link.remove();

    URL.revokeObjectURL(
      url
    );
  }


  /* ==========================================================
     DETAIL MODAL
  ========================================================== */

  function openDetail(id) {

    const contract =
      contracts.find(
        item => item.id === id
      );

    if (!contract) return;

    selectedContractId =
      id;

    const engine =
      calculateLease(
        contract
      );

    const modal =
      document.getElementById(
        "detailModal"
      );

    const title =
      document.getElementById(
        "detailTitle"
      );

    const content =
      document.getElementById(
        "detailContent"
      );


    if (title) {
      title.textContent =
        contract.id;
    }


    if (content) {

      content.innerHTML = `

        <div class="detail-grid">

          <div class="detail-item">

            <span>
              Şirket
            </span>

            <strong>
              ${escapeHtml(
                contract.company
              )}
            </strong>

          </div>


          <div class="detail-item">

            <span>
              Tedarikçi
            </span>

            <strong>
              ${escapeHtml(
                contract.supplier
              )}
            </strong>

          </div>


          <div class="detail-item">

            <span>
              Aylık Kira
            </span>

            <strong>
              ${formatCurrency(
                contract.monthlyPayment
              )}
            </strong>

          </div>


          <div class="detail-item">

            <span>
              ROU Varlığı
            </span>

            <strong>
              ${formatCurrency(
                engine.rouAssets
              )}
            </strong>

          </div>


          <div class="detail-item">

            <span>
              İlk Kira Yükümlülüğü
            </span>

            <strong>
              ${formatCurrency(
                engine.liability
              )}
            </strong>

          </div>


          <div class="detail-item">

            <span>
              Aylık Amortisman
            </span>

            <strong>
              ${formatCurrency(
                engine.depreciation
              )}
            </strong>

          </div>

        </div>


        ${renderPaymentScheduleSection(
          contract
        )}


        ${renderJournalEntry(
          "İlk Muhasebeleştirme Fişi",
          generateInitialEntry(
            contract
          )
        )}


        ${renderAccountingCenter(
          contract
        )}

      `;
    }


    modal?.classList.remove(
      "hidden"
    );


    setTimeout(
      () => {

        document
          .getElementById(
            "generateJournal"
          )
          ?.addEventListener(
            "click",
            () =>
              generateSelectedJournal(
                contract
              )
          );


        document
          .getElementById(
            "openBulkJournalButton"
          )
          ?.addEventListener(
            "click",
            openBulkJournalModal
          );


        initPaymentScheduleEvents(
          contract
        );

      },
      0
    );
  }


  function closeDetail() {

    document
      .getElementById(
        "detailModal"
      )
      ?.classList.add(
        "hidden"
      );

    selectedContractId =
      null;
  }


  document
    .getElementById(
      "closeDetailModal"
    )
    ?.addEventListener(
      "click",
      closeDetail
    );


  document
    .getElementById(
      "detailCloseButton"
    )
    ?.addEventListener(
      "click",
      closeDetail
    );


  /* ==========================================================
     BULK JOURNAL MODAL
  ========================================================== */

  function openBulkJournalModal() {

    createBulkJournalModal();

    const modal =
      document.getElementById(
        "bulkJournalModal"
      );

    if (!modal) return;

    modal.classList.remove(
      "hidden"
    );

    modal.style.display =
      "flex";

    populateBulkYears();

    const today =
      new Date();

    const voucherDate =
      document.getElementById(
        "bulkVoucherDate"
      );

    if (voucherDate) {

      voucherDate.value =
        [
          today.getFullYear(),
          String(
            today.getMonth() + 1
          ).padStart(2, "0"),
          String(
            today.getDate()
          ).padStart(2, "0")
        ].join("-");
    }


    updateBulkPeriodUI();

    updateBulkVoucherDefaults();

    bulkJournalData = [];

    setBulkPreview("");
  }


  function createBulkJournalModal() {

    if (
      document.getElementById(
        "bulkJournalModal"
      )
    ) {
      return;
    }


    const modal =
      document.createElement(
        "div"
      );

    modal.id =
      "bulkJournalModal";

    modal.className =
      "hidden";

    modal.style.cssText = `
      position:fixed;
      inset:0;
      z-index:99999;
      background:rgba(15,23,42,.55);
      display:flex;
      align-items:center;
      justify-content:center;
      padding:20px;
    `;


    modal.innerHTML = `

      <div
        style="
          width:min(1200px,100%);
          max-height:92vh;
          overflow:auto;
          background:white;
          border-radius:16px;
          box-shadow:0 25px 80px rgba(0,0,0,.25);
        "
      >

        <div
          style="
            padding:20px 22px;
            border-bottom:1px solid #e5e7eb;
            display:flex;
            justify-content:space-between;
            align-items:center;
            gap:15px;
          "
        >

          <div>

            <div
              style="
                font-size:10px;
                font-weight:800;
                letter-spacing:1px;
                color:#64748b;
              "
            >
              TFRS 16 / V15
            </div>

            <h2
              style="
                margin:4px 0 0;
                font-size:20px;
              "
            >
              Toplu Muhasebe Fiş Merkezi
            </h2>

          </div>


          <button
            id="closeBulkJournalModal"
            type="button"
            style="
              width:36px;
              height:36px;
              border:0;
              border-radius:8px;
              background:#f1f5f9;
              cursor:pointer;
              font-size:18px;
            "
          >
            ×
          </button>

        </div>


        <div
          style="
            padding:20px;
          "
        >

          <div
            style="
              display:grid;
              grid-template-columns:
                repeat(auto-fit,minmax(180px,1fr));
              gap:12px;
            "
          >

            <div>

              <label
                style="
                  display:block;
                  font-size:10px;
                  font-weight:700;
                  color:#64748b;
                  margin-bottom:7px;
                "
              >
                Raporlama Yılı
              </label>

              <select
                id="bulkAccountingYear"
                style="
                  width:100%;
                  padding:9px;
                  border:1px solid #d1d5db;
                  border-radius:7px;
                "
              ></select>

            </div>


            <div>

              <label
                style="
                  display:block;
                  font-size:10px;
                  font-weight:700;
                  color:#64748b;
                  margin-bottom:7px;
                "
              >
                Fiş Periyodu
              </label>

              <select
                id="bulkAccountingPeriod"
                style="
                  width:100%;
                  padding:9px;
                  border:1px solid #d1d5db;
                  border-radius:7px;
                "
              >

                <option value="monthly">
                  Aylık
                </option>

                <option value="quarterly">
                  Çeyreklik
                </option>

                <option value="annual">
                  Yıllık
                </option>

              </select>

            </div>


            <div>

              <label
                style="
                  display:block;
                  font-size:10px;
                  font-weight:700;
                  color:#64748b;
                  margin-bottom:7px;
                "
              >
                Dönem / Ay
              </label>

              <select
                id="bulkAccountingMonth"
                style="
                  width:100%;
                  padding:9px;
                  border:1px solid #d1d5db;
                  border-radius:7px;
                "
              >
                ${buildMonthOptions()}
              </select>

            </div>


            <div>

              <label
                style="
                  display:block;
                  font-size:10px;
                  font-weight:700;
                  color:#64748b;
                  margin-bottom:7px;
                "
              >
                Fiş Tarihi
              </label>

              <input
                id="bulkVoucherDate"
                type="date"
                style="
                  width:100%;
                  padding:9px;
                  border:1px solid #d1d5db;
                  border-radius:7px;
                "
              />

            </div>

          </div>


          <div
            style="
              display:grid;
              grid-template-columns:1fr 1fr;
              gap:12px;
              margin-top:12px;
            "
          >

            <div>

              <label
                style="
                  display:block;
                  font-size:10px;
                  font-weight:700;
                  color:#64748b;
                  margin-bottom:7px;
                "
              >
                Fiş No Başlangıç
              </label>

              <input
                id="bulkVoucherNumber"
                value="TFRS16-2026-0001"
                style="
                  width:100%;
                  padding:9px;
                  border:1px solid #d1d5db;
                  border-radius:7px;
                "
              />

            </div>


            <div>

              <label
                style="
                  display:block;
                  font-size:10px;
                  font-weight:700;
                  color:#64748b;
                  margin-bottom:7px;
                "
              >
                Fiş Açıklaması
              </label>

              <input
                id="bulkVoucherDescription"
                value="TFRS 16 kira muhasebe kaydı"
                style="
                  width:100%;
                  padding:9px;
                  border:1px solid #d1d5db;
                  border-radius:7px;
                "
              />

            </div>

          </div>


          <div
            id="bulkJournalSummary"
            style="
              margin-top:18px;
            "
          ></div>


          <div
            id="bulkJournalPreview"
            style="
              margin-top:18px;
            "
          ></div>

        </div>


        <div
          style="
            padding:16px 20px;
            border-top:1px solid #e5e7eb;
            display:flex;
            justify-content:flex-end;
            gap:10px;
          "
        >

          <button
            id="generateBulkJournals"
            type="button"
            style="
              padding:11px 16px;
              border:0;
              border-radius:8px;
              background:#0f172a;
              color:white;
              font-weight:700;
              cursor:pointer;
            "
          >
            Toplu Fişleri Oluştur
          </button>


          <button
            id="exportBulkJournals"
            type="button"
            disabled
            style="
              padding:11px 16px;
              border:0;
              border-radius:8px;
              background:#166534;
              color:white;
              font-weight:700;
              cursor:pointer;
              opacity:.5;
            "
          >
            Excel'e Aktar
          </button>

        </div>

      </div>

    `;


    document.body.appendChild(
      modal
    );


    document
      .getElementById(
        "closeBulkJournalModal"
      )
      ?.addEventListener(
        "click",
        closeBulkJournalModal
      );


    document
      .getElementById(
        "generateBulkJournals"
      )
      ?.addEventListener(
        "click",
        generateBulkJournals
      );


    document
      .getElementById(
        "exportBulkJournals"
      )
      ?.addEventListener(
        "click",
        exportBulkJournals
      );


    document
      .getElementById(
        "bulkAccountingPeriod"
      )
      ?.addEventListener(
        "change",
        () => {

          updateBulkPeriodUI();

          updateBulkVoucherDefaults();
        }
      );


    document
      .getElementById(
        "bulkAccountingYear"
      )
      ?.addEventListener(
        "change",
        updateBulkVoucherDefaults
      );


    document
      .getElementById(
        "bulkAccountingMonth"
      )
      ?.addEventListener(
        "change",
        updateBulkVoucherDefaults
      );
  }


  function closeBulkJournalModal() {

    const modal =
      document.getElementById(
        "bulkJournalModal"
      );

    if (!modal) return;

    modal.classList.add(
      "hidden"
    );

    modal.style.display =
      "none";

    bulkJournalData = [];
  }


  function populateBulkYears() {

    const select =
      document.getElementById(
        "bulkAccountingYear"
      );

    if (!select) return;

    const years =
      new Set();


    contracts.forEach(
      contract => {

        const start =
          parseDate(
            contract.startDate
          );

        const end =
          parseDate(
            contract.endDate
          );

        if (!start || !end) {
          return;
        }

        for (
          let year =
            start.getFullYear();

          year <=
            end.getFullYear();

          year++
        ) {

          years.add(
            year
          );
        }
      }
    );


    const sorted =
      [...years].sort(
        (a, b) => a - b
      );

    const currentYear =
      new Date().getFullYear();


    select.innerHTML =
      sorted
        .map(
          year =>
            `
            <option
              value="${year}"
              ${
                year === currentYear
                  ? "selected"
                  : ""
              }
            >
              ${year}
            </option>
            `
        )
        .join("");


    if (!sorted.length) {

      select.innerHTML =
        `
        <option
          value="${currentYear}"
        >
          ${currentYear}
        </option>
        `;
    }
  }


  function updateBulkPeriodUI() {

    const period =
      document.getElementById(
        "bulkAccountingPeriod"
      )?.value;

    const month =
      document.getElementById(
        "bulkAccountingMonth"
      );

    if (!month) return;

    const annual =
      period === "annual";

    month.disabled =
      annual;

    month.style.opacity =
      annual
        ? ".5"
        : "1";
  }


  function updateBulkVoucherDefaults() {

    const year =
      Number(
        document.getElementById(
          "bulkAccountingYear"
        )?.value
      );

    const numberInput =
      document.getElementById(
        "bulkVoucherNumber"
      );

    if (
      numberInput &&
      year
    ) {

      numberInput.value =
        `TFRS16-${year}-0001`;
    }


    const description =
      document.getElementById(
        "bulkVoucherDescription"
      );

    const period =
      document.getElementById(
        "bulkAccountingPeriod"
      )?.value;

    const month =
      Number(
        document.getElementById(
          "bulkAccountingMonth"
        )?.value
      );


    if (
      description &&
      year
    ) {

      if (
        period === "monthly"
      ) {

        description.value =
          `${getMonthName(
            month
          )} ${year} TFRS 16 kira muhasebe kaydı`;

      } else if (
        period === "quarterly"
      ) {

        description.value =
          `${year} ${
            Math.ceil(
              month / 3
            )
          }. çeyrek TFRS 16 kira muhasebe kaydı`;

      } else {

        description.value =
          `${year} TFRS 16 yıllık kira muhasebe kaydı`;
      }
    }
  }


  /* ==========================================================
     BULK JOURNAL GENERATION
  ========================================================== */

  function generateBulkJournals() {

    const year =
      Number(
        document.getElementById(
          "bulkAccountingYear"
        )?.value
      );

    const period =
      document.getElementById(
        "bulkAccountingPeriod"
      )?.value;

    const month =
      Number(
        document.getElementById(
          "bulkAccountingMonth"
        )?.value
      );

    const voucherDate =
      document.getElementById(
        "bulkVoucherDate"
      )?.value || "";

    const voucherStart =
      document
        .getElementById(
          "bulkVoucherNumber"
        )
        ?.value
        ?.trim()
        ||
        `TFRS16-${year}-0001`;

    const description =
      document
        .getElementById(
          "bulkVoucherDescription"
        )
        ?.value
        ?.trim()
        ||
        "TFRS 16 kira muhasebe kaydı";


    if (
      !year ||
      !voucherDate
    ) {

      alert(
        "Lütfen raporlama yılını ve fiş tarihini eksiksiz girin."
      );

      return;
    }


    const activeContracts =
      contracts.filter(
        c =>
          c.status ===
          "active"
      );


    bulkJournalData = [];

    let sequence = 1;


    activeContracts.forEach(
      contract => {

        const selected =
          getScheduleForYear(
            contract,
            year,
            month,
            period
          );

        if (!selected.length) {
          return;
        }


        const interest =
          selected.reduce(
            (total, item) =>
              total + item.interest,
            0
          );

        const principal =
          selected.reduce(
            (total, item) =>
              total + item.principal,
            0
          );

        const payment =
          selected.reduce(
            (total, item) =>
              total + item.payment,
            0
          );

        const depreciation =
          selected.reduce(
            (total, item) =>
              total + item.depreciation,
            0
          );


        const entries = [

          {
            account:
              "780 Finansman Giderleri",

            debit:
              interest,

            credit: 0
          },

          {
            account:
              "401 Kiralama Yükümlülüğü",

            debit:
              principal,

            credit: 0
          },

          {
            account:
              "381 Kira Borçları / Ödeme",

            debit: 0,

            credit:
              payment
          },

          {
            account:
              "770 / 730 Amortisman Giderleri",

            debit:
              depreciation,

            credit: 0
          },

          {
            account:
              "268 Birikmiş Amortismanlar",

            debit: 0,

            credit:
              depreciation
          }

        ];


        const totalDebit =
          entries.reduce(
            (total, item) =>
              total +
              Number(
                item.debit || 0
              ),
            0
          );


        const totalCredit =
          entries.reduce(
            (total, item) =>
              total +
              Number(
                item.credit || 0
              ),
            0
          );


        const difference =
          Math.abs(
            totalDebit -
            totalCredit
          );


        const voucherNo =
          createVoucherNumber(
            voucherStart,
            sequence
          );


        bulkJournalData.push({

          voucherNo,

          voucherDate,

          contractId:
            contract.id,

          company:
            contract.company,

          supplier:
            contract.supplier,

          description,

          year,

          period,

          month,

          entries,

          totalDebit,

          totalCredit,

          difference,

          balanced:
            difference < 0.01

        });


        sequence++;
      }
    );


    renderBulkJournalResults();
  }


  function createVoucherNumber(
    base,
    sequence
  ) {

    const match =
      String(base)
        .match(
          /^(.*?)(\d+)$/
        );


    if (!match) {

      return (
        `${base}-` +
        String(sequence)
          .padStart(
            4,
            "0"
          )
      );
    }


    const prefix =
      match[1];

    const number =
      match[2];

    const width =
      Math.max(
        4,
        number.length
      );

    const start =
      Number(number);


    return (
      prefix +
      String(
        start +
        sequence -
        1
      ).padStart(
        width,
        "0"
      )
    );
  }


  /* ==========================================================
     BULK JOURNAL RESULT
  ========================================================== */

  function renderBulkJournalResults() {

    const summary =
      document.getElementById(
        "bulkJournalSummary"
      );

    const preview =
      document.getElementById(
        "bulkJournalPreview"
      );

    const exportButton =
      document.getElementById(
        "exportBulkJournals"
      );


    if (
      !summary ||
      !preview
    ) {
      return;
    }


    if (
      !bulkJournalData.length
    ) {

      summary.innerHTML = `

        <div
          style="
            padding:15px;
            background:#fff7ed;
            color:#9a3412;
            border:1px solid #fed7aa;
            border-radius:10px;
          "
        >
          Seçilen dönemde aktif sözleşme kaydı bulunamadı.
        </div>

      `;

      preview.innerHTML =
        "";

      if (exportButton) {

        exportButton.disabled =
          true;

        exportButton.style.opacity =
          ".5";
      }

      return;
    }


    const balanced =
      bulkJournalData.filter(
        item =>
          item.balanced
      );


    const unbalanced =
      bulkJournalData.filter(
        item =>
          !item.balanced
      );


    const totalDebit =
      bulkJournalData.reduce(
        (total, item) =>
          total +
          item.totalDebit,
        0
      );


    const totalCredit =
      bulkJournalData.reduce(
        (total, item) =>
          total +
          item.totalCredit,
        0
      );


    summary.innerHTML = `

      <div
        style="
          display:grid;
          grid-template-columns:
            repeat(auto-fit,minmax(150px,1fr));
          gap:10px;
        "
      >

        <div
          style="
            padding:14px;
            border-radius:10px;
            background:#f8fafc;
            border:1px solid #e5e7eb;
          "
        >

          <div
            style="
              font-size:10px;
              color:#64748b;
            "
          >
            SÖZLEŞME
          </div>

          <strong
            style="
              font-size:20px;
            "
          >
            ${bulkJournalData.length}
          </strong>

        </div>


        <div
          style="
            padding:14px;
            border-radius:10px;
            background:#ecfdf5;
            border:1px solid #bbf7d0;
            color:#166534;
          "
        >

          <div
            style="
              font-size:10px;
            "
          >
            DENGELİ FİŞ
          </div>

          <strong
            style="
              font-size:20px;
            "
          >
            ${balanced.length}
          </strong>

        </div>


        <div
          style="
            padding:14px;
            border-radius:10px;
            background:#fef2f2;
            border:1px solid #fecaca;
            color:#991b1b;
          "
        >

          <div
            style="
              font-size:10px;
            "
          >
            HATALI FİŞ
          </div>

          <strong
            style="
              font-size:20px;
            "
          >
            ${unbalanced.length}
          </strong>

        </div>


        <div
          style="
            padding:14px;
            border-radius:10px;
            background:#f8fafc;
            border:1px solid #e5e7eb;
          "
        >

          <div
            style="
              font-size:10px;
              color:#64748b;
            "
          >
            TOPLAM BORÇ
          </div>

          <strong>
            ${formatCurrency(
              totalDebit
            )}
          </strong>

        </div>


        <div
          style="
            padding:14px;
            border-radius:10px;
            background:#f8fafc;
            border:1px solid #e5e7eb;
          "
        >

          <div
            style="
              font-size:10px;
              color:#64748b;
            "
          >
            TOPLAM ALACAK
          </div>

          <strong>
            ${formatCurrency(
              totalCredit
            )}
          </strong>

        </div>

      </div>

    `;


    preview.innerHTML = `

      <div
        style="
          border:1px solid #e5e7eb;
          border-radius:10px;
          overflow:auto;
        "
      >

        <table
          style="
            width:100%;
            border-collapse:collapse;
            min-width:900px;
          "
        >

          <thead>

            <tr>

              <th
                style="
                  padding:10px;
                "
              >
                Fiş No
              </th>

              <th
                style="
                  padding:10px;
                "
              >
                Tarih
              </th>

              <th
                style="
                  padding:10px;
                "
              >
                Sözleşme
              </th>

              <th
                style="
                  padding:10px;
                "
              >
                Şirket
              </th>

              <th
                style="
                  padding:10px;
                  text-align:right;
                "
              >
                Borç
              </th>

              <th
                style="
                  padding:10px;
                  text-align:right;
                "
              >
                Alacak
              </th>

              <th
                style="
                  padding:10px;
                "
              >
                Kontrol
              </th>

            </tr>

          </thead>


          <tbody>

            ${bulkJournalData
              .map(
                item => `

                  <tr>

                    <td
                      style="
                        padding:10px;
                        border-top:1px solid #edf0f4;
                      "
                    >
                      ${escapeHtml(
                        item.voucherNo
                      )}
                    </td>

                    <td
                      style="
                        padding:10px;
                        border-top:1px solid #edf0f4;
                      "
                    >
                      ${formatDate(
                        item.voucherDate
                      )}
                    </td>

                    <td
                      style="
                        padding:10px;
                        border-top:1px solid #edf0f4;
                        font-weight:700;
                      "
                    >
                      ${escapeHtml(
                        item.contractId
                      )}
                    </td>

                    <td
                      style="
                        padding:10px;
                        border-top:1px solid #edf0f4;
                      "
                    >
                      ${escapeHtml(
                        item.company
                      )}
                    </td>

                    <td
                      style="
                        padding:10px;
                        text-align:right;
                        border-top:1px solid #edf0f4;
                      "
                    >
                      ${formatCurrency(
                        item.totalDebit
                      )}
                    </td>

                    <td
                      style="
                        padding:10px;
                        text-align:right;
                        border-top:1px solid #edf0f4;
                      "
                    >
                      ${formatCurrency(
                        item.totalCredit
                      )}
                    </td>

                    <td
                      style="
                        padding:10px;
                        border-top:1px solid #edf0f4;
                        font-weight:800;
                        color:${
                          item.balanced
                            ? "#166534"
                            : "#991b1b"
                        };
                      "
                    >
                      ${
                        item.balanced
                          ? "✓ Dengeli"
                          : "✕ Hatalı"
                      }
                    </td>

                  </tr>

                `
              )
              .join("")}

          </tbody>

        </table>

      </div>

    `;


    if (exportButton) {

      const allowed =
        unbalanced.length === 0;

      exportButton.disabled =
        !allowed;

      exportButton.style.opacity =
        allowed
          ? "1"
          : ".5";
    }
  }


  function setBulkPreview(
    html
  ) {

    const summary =
      document.getElementById(
        "bulkJournalSummary"
      );

    const preview =
      document.getElementById(
        "bulkJournalPreview"
      );

    if (summary) {
      summary.innerHTML =
        html || "";
    }

    if (preview) {
      preview.innerHTML =
        "";
    }

    const exportButton =
      document.getElementById(
        "exportBulkJournals"
      );

    if (exportButton) {

      exportButton.disabled =
        true;

      exportButton.style.opacity =
        ".5";
    }
  }


  /* ==========================================================
     EXCEL EXPORT
  ========================================================== */

  function exportBulkJournals() {

    if (
      !bulkJournalData.length
    ) {
      return;
    }


    const invalid =
      bulkJournalData.some(
        item =>
          !item.balanced
      );


    if (invalid) {

      alert(
        "Dengesiz fiş bulunduğu için Excel aktarımı yapılamaz."
      );

      return;
    }


    const rows = [];


    bulkJournalData.forEach(
      item => {

        item.entries.forEach(
          entry => {

            rows.push({

              "Fiş No":
                item.voucherNo,

              "Fiş Tarihi":
                item.voucherDate,

              "Sözleşme ID":
                item.contractId,

              "Şirket":
                item.company,

              "Tedarikçi":
                item.supplier,

              "Raporlama Yılı":
                item.year,

              "Periyot":
                item.period,

              "Dönem":
                item.month,

              "Açıklama":
                item.description,

              "Hesap":
                entry.account,

              "Borç":
                Number(
                  entry.debit || 0
                ),

              "Alacak":
                Number(
                  entry.credit || 0
                ),

              "Kontrol":
                "OK"

            });

          }
        );
      }
    );


    if (
      typeof XLSX !==
      "undefined"
    ) {

      try {

        const worksheet =
          XLSX.utils.json_to_sheet(
            rows
          );

        const workbook =
          XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(
          workbook,
          worksheet,
          "TFRS16 Fisleri"
        );

        XLSX.writeFile(
          workbook,
          `TFRS16_Toplu_Fisler_${Date.now()}.xlsx`
        );

        return;

      } catch (error) {

        console.error(
          "Excel export error:",
          error
        );
      }
    }


    const headers =
      Object.keys(
        rows[0]
      );


    const csvRows =
      [
        headers,
        ...rows.map(
          row =>
            headers.map(
              header =>
                row[header]
            )
        )
      ];


    const csv =
      csvRows
        .map(
          row =>
            row
              .map(
                value =>
                  `"${String(
                    value ?? ""
                  ).replaceAll(
                    '"',
                    '""'
                  )}"`
              )
              .join(";")
        )
        .join("\n");


    const blob =
      new Blob(
        [
          "\uFEFF" +
          csv
        ],
        {
          type:
            "text/csv;charset=utf-8;"
        }
      );


    const url =
      URL.createObjectURL(
        blob
      );

    const link =
      document.createElement(
        "a"
      );

    link.href =
      url;

    link.download =
      "TFRS16_Toplu_Fisler.csv";

    document.body.appendChild(
      link
    );

    link.click();

    link.remove();

    URL.revokeObjectURL(
      url
    );
  }


  /* ==========================================================
     BASIC EXCEL CONTRACT IMPORT
     ========================================================== */

  function normalizeHeader(
    value
  ) {

    return String(
      value || ""
    )
      .trim()
      .toLowerCase()
      .replace(
        /ğ/g,
        "g"
      )
      .replace(
        /ü/g,
        "u"
      )
      .replace(
        /ş/g,
        "s"
      )
      .replace(
        /ı/g,
        "i"
      )
      .replace(
        /ö/g,
        "o"
      )
      .replace(
        /ç/g,
        "c"
      );
  }


  function findImportValue(
    row,
    aliases
  ) {

    const keys =
      Object.keys(
        row
      );

    for (
      const key of keys
    ) {

      const normalized =
        normalizeHeader(
          key
        );

      if (
        aliases.includes(
          normalized
        )
      ) {

        return row[key];
      }
    }

    return "";
  }


  function mapImportedContract(
    row
  ) {

    return {

      id:
        String(
          findImportValue(
            row,
            [
              "sozlesme id",
              "sozlesme",
              "contract id",
              "contract",
              "id"
            ]
          ) || ""
        ).trim(),

      company:
        String(
          findImportValue(
            row,
            [
              "sirket",
              "company"
            ]
          ) || ""
        ).trim(),

      supplier:
        String(
          findImportValue(
            row,
            [
              "tedarikci",
              "supplier"
            ]
          ) || ""
        ).trim(),

      monthlyPayment:
        Number(
          String(
            findImportValue(
              row,
              [
                "aylik kira",
                "monthly payment",
                "monthly rent"
              ]
            ) || 0
          )
            .replace(
              /\./g,
              ""
            )
            .replace(
              ",",
              "."
            )
        ) || 0,

      startDate:
        normalizeDate(
          findImportValue(
            row,
            [
              "baslangic",
              "baslangic tarihi",
              "start date"
            ]
          )
        ),

      endDate:
        normalizeDate(
          findImportValue(
            row,
            [
              "bitis",
              "bitis tarihi",
              "end date"
            ]
          )
        ),

      discountRate:
        Number(
          String(
            findImportValue(
              row,
              [
                "iskonto orani",
                "discount rate",
                "discount"
              ]
            ) || 0
          ).replace(
            ",",
            "."
          )
        ) || 0,

      renewalDate:
        normalizeDate(
          findImportValue(
            row,
            [
              "yenileme",
              "yenileme tarihi",
              "renewal date"
            ]
          )
        ),

      status:
        "active",

      modification:
        false
    };
  }


  function validateImportedContract(
    contract
  ) {

    return validateContract(
      contract
    );
  }


  function openBulkImportModal() {

    const modal =
      document.getElementById(
        "bulkImportModal"
      );

    if (!modal) return;

    modal.classList.remove(
      "hidden"
    );

    bulkImportData = [];

    const preview =
      document.getElementById(
        "bulkPreview"
      );

    const status =
      document.getElementById(
        "bulkImportStatus"
      );

    if (preview) {
      preview.innerHTML =
        "";
    }

    if (status) {
      status.innerHTML =
        "";
    }

    const confirm =
      document.getElementById(
        "confirmBulkImport"
      );

    if (confirm) {
      confirm.disabled =
        true;
    }
  }


  function closeBulkImportModal() {

    document
      .getElementById(
        "bulkImportModal"
      )
      ?.classList.add(
        "hidden"
      );
  }


  document
    .getElementById(
      "bulkImportButton"
    )
    ?.addEventListener(
      "click",
      openBulkImportModal
    );


  document
    .getElementById(
      "closeBulkModal"
    )
    ?.addEventListener(
      "click",
      closeBulkImportModal
    );


  document
    .getElementById(
      "cancelBulkImport"
    )
    ?.addEventListener(
      "click",
      closeBulkImportModal
    );


  document
    .getElementById(
      "bulkFileInput"
    )
    ?.addEventListener(
      "change",
      event => {

        const file =
          event.target.files?.[0];

        if (!file) {
          return;
        }

        readBulkImportFile(
          file
        );
      }
    );


  async function readBulkImportFile(
    file
  ) {

    const status =
      document.getElementById(
        "bulkImportStatus"
      );

    const preview =
      document.getElementById(
        "bulkPreview"
      );

    try {

      if (
        typeof XLSX ===
        "undefined"
      ) {

        throw new Error(
          "Excel motoru yüklenemedi."
        );
      }


      const buffer =
        await file.arrayBuffer();


      const workbook =
        XLSX.read(
          buffer,
          {
            type: "array",
            cellDates: true
          }
        );


      const firstSheet =
        workbook.Sheets[
          workbook.SheetNames[0]
        ];


      const rows =
        XLSX.utils.sheet_to_json(
          firstSheet,
          {
            defval: ""
          }
        );


      if (!rows.length) {

        throw new Error(
          "Dosyada veri bulunamadı."
        );
      }


      bulkImportData =
        rows.map(
          mapImportedContract
        );


      const validationResults =
        bulkImportData.map(
          contract => ({
            contract,
            validation:
              validateImportedContract(
                contract
              )
          })
        );


      const valid =
        validationResults.filter(
          item =>
            item.validation.valid
        );


      const invalid =
        validationResults.filter(
          item =>
            !item.validation.valid
        );


      if (status) {

        status.innerHTML = `

          <div
            style="
              padding:10px;
              border-radius:8px;
              background:#f8fafc;
              border:1px solid #e5e7eb;
            "
          >

            <strong>
              ${bulkImportData.length}
              kayıt okundu.
            </strong>

            <br>

            <span>
              ${valid.length}
              geçerli,
              ${invalid.length}
              hatalı kayıt.
            </span>

          </div>

        `;
      }


      if (preview) {

        preview.innerHTML = `

          <div
            style="
              border:1px solid #e5e7eb;
              border-radius:10px;
              overflow:auto;
            "
          >

            <table
              style="
                width:100%;
                border-collapse:collapse;
                min-width:850px;
              "
            >

              <thead>

                <tr>

                  <th style="padding:9px;">
                    Sözleşme
                  </th>

                  <th style="padding:9px;">
                    Şirket
                  </th>

                  <th style="padding:9px;">
                    Tedarikçi
                  </th>

                  <th style="padding:9px;">
                    Aylık Kira
                  </th>

                  <th style="padding:9px;">
                    Başlangıç
                  </th>

                  <th style="padding:9px;">
                    Bitiş
                  </th>

                  <th style="padding:9px;">
                    Kontrol
                  </th>

                </tr>

              </thead>


              <tbody>

                ${validationResults
                  .map(
                    item => {

                      const c =
                        item.contract;

                      const ok =
                        item.validation
                          .valid;

                      return `

                        <tr>

                          <td style="padding:9px;border-top:1px solid #edf0f4;">
                            ${escapeHtml(
                              c.id
                            )}
                          </td>

                          <td style="padding:9px;border-top:1px solid #edf0f4;">
                            ${escapeHtml(
                              c.company
                            )}
                          </td>

                          <td style="padding:9px;border-top:1px solid #edf0f4;">
                            ${escapeHtml(
                              c.supplier
                            )}
                          </td>

                          <td style="padding:9px;border-top:1px solid #edf0f4;">
                            ${formatCurrency(
                              c.monthlyPayment
                            )}
                          </td>

                          <td style="padding:9px;border-top:1px solid #edf0f4;">
                            ${formatDate(
                              c.startDate
                            )}
                          </td>

                          <td style="padding:9px;border-top:1px solid #edf0f4;">
                            ${formatDate(
                              c.endDate
                            )}
                          </td>

                          <td
                            style="
                              padding:9px;
                              border-top:1px solid #edf0f4;
                              font-weight:700;
                              color:${
                                ok
                                  ? "#166534"
                                  : "#991b1b"
                              };
                            "
                          >
                            ${
                              ok
                                ? "✓ Geçerli"
                                : "✕ Hatalı"
                            }
                          </td>

                        </tr>

                      `;
                    }
                  )
                  .join("")}

              </tbody>

            </table>

          </div>

        `;
      }


      const confirm =
        document.getElementById(
          "confirmBulkImport"
        );

      if (confirm) {

        confirm.disabled =
          valid.length === 0;
      }

    } catch (error) {

      console.error(
        "Bulk import error:",
        error
      );

      if (status) {

        status.innerHTML = `

          <div
            style="
              padding:10px;
              border-radius:8px;
              background:#fef2f2;
              color:#991b1b;
              border:1px solid #fecaca;
            "
          >
            Dosya okunamadı:
            ${escapeHtml(
              error.message
            )}
          </div>

        `;
      }
    }
  }


  document
    .getElementById(
      "confirmBulkImport"
    )
    ?.addEventListener(
      "click",
      confirmBulkImport
    );


  function confirmBulkImport() {

    const valid =
      bulkImportData.filter(
        contract =>
          validateImportedContract(
            contract
          ).valid
      );


    if (!valid.length) {

      alert(
        "Aktarılabilir geçerli kayıt bulunamadı."
      );

      return;
    }


    let added = 0;
    let updated = 0;


    valid.forEach(
      contract => {

        const existing =
          contracts.find(
            c =>
              c.id ===
              contract.id
          );


        if (existing) {

          contracts =
            contracts.map(
              item =>
                item.id ===
                contract.id
                  ? {
                      ...item,
                      ...contract,
                      status:
                        item.status ||
                        "active",
                      modification:
                        item.modification ||
                        false
                    }
                  : item
            );

          updated++;

        } else {

          contracts.push(
            contract
          );

          added++;
        }
      }
    );


    saveContracts(
      contracts
    );

    refresh();

    closeBulkImportModal();


    alert(
      `${added} yeni sözleşme eklendi, ${updated} sözleşme güncellendi.`
    );
  }


  /* ==========================================================
     TEMPLATE DOWNLOAD
  ========================================================== */

  document
    .getElementById(
      "downloadTemplateButton"
    )
    ?.addEventListener(
      "click",
      downloadTemplate
    );


  function downloadTemplate() {

    const rows = [

      {
        "Sözleşme ID":
          "LEASE-004",

        "Şirket":
          "GK Holding",

        "Tedarikçi":
          "Örnek Tedarikçi",

        "Aylık Kira":
          100000,

        "Başlangıç Tarihi":
          "2026-01-01",

        "Bitiş Tarihi":
          "2030-12-31",

        "İskonto Oranı":
          18,

        "Yenileme Tarihi":
          "2030-09-30"
      }

    ];


    if (
      typeof XLSX !==
      "undefined"
    ) {

      const worksheet =
        XLSX.utils.json_to_sheet(
          rows
        );

      const workbook =
        XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Sözleşmeler"
      );

      XLSX.writeFile(
        workbook,
        "TFRS16_Sozlesme_Sablonu.xlsx"
      );

      return;
    }


    const headers =
      Object.keys(
        rows[0]
      );


    const csv =
      [
        headers.join(";"),
        headers
          .map(
            h =>
              rows[0][h]
          )
          .join(";")
      ].join("\n");


    const blob =
      new Blob(
        [
          "\uFEFF" +
          csv
        ],
        {
          type:
            "text/csv;charset=utf-8;"
        }
      );


    const url =
      URL.createObjectURL(
        blob
      );

    const link =
      document.createElement(
        "a"
      );

    link.href =
      url;

    link.download =
      "TFRS16_Sozlesme_Sablonu.csv";

    document.body.appendChild(
      link
    );

    link.click();

    link.remove();

    URL.revokeObjectURL(
      url
    );
  }


  /* ==========================================================
     SEARCH / FILTER EVENTS
  ========================================================== */

  document
    .getElementById(
      "searchInput"
    )
    ?.addEventListener(
      "input",
      renderTable
    );


  document
    .getElementById(
      "statusFilter"
    )
    ?.addEventListener(
      "change",
      renderTable
    );


  document
    .getElementById(
      "companyFilter"
    )
    ?.addEventListener(
      "change",
      renderTable
    );


  /* ==========================================================
     DELETE CONTRACT
  ========================================================== */

  document
    .getElementById(
      "deleteContract"
    )
    ?.addEventListener(
      "click",
      () => {

        if (
          !selectedContractId
        ) {
          return;
        }


        const contract =
          contracts.find(
            item =>
              item.id ===
              selectedContractId
          );


        if (!contract) {
          return;
        }


        const confirmed =
          confirm(
            `${contract.id} sözleşmesini silmek istediğinizden emin misiniz?`
          );


        if (!confirmed) {
          return;
        }


        contracts =
          contracts.filter(
            item =>
              item.id !==
              selectedContractId
          );


        saveContracts(
          contracts
        );

        closeDetail();

        refresh();
      }
    );


  /* ==========================================================
     INITIALIZATION
  ========================================================== */

  refresh();

});
