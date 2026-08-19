document.addEventListener("DOMContentLoaded", () => {

  /*
  ============================================================
  GK FINANCE INTELLIGENCE
  TFRS 16 ACCOUNTING ENGINE V16
  ------------------------------------------------------------
  V16
  - V15 fonksiyonları korunmuştur
  - Contract Portfolio
  - Yeni sözleşme
  - Sözleşme düzenleme
  - Excel bulk import
  - Contract detail
  - TFRS 16 calculation engine
  - Initial recognition
  - Monthly / Quarterly / Annual journal
  - Current / Non-current reclassification
  - Bulk journal generation
  - Voucher numbering
  - Excel journal export
  - Debit / Credit validation
  - Contract audit trace
  - Duplicate contract protection
  - Safer date / input validation
  - V16 accounting data layer
  - V16 payment schedule visibility
  - V16 audit/control framework
  - Existing localStorage key preserved
  ============================================================
  */

  const STORAGE_KEY = "gk_tfrs16_contracts_v7";
  const JOURNAL_STORAGE_KEY = "gk_tfrs16_journals_v16";
  const AUDIT_STORAGE_KEY = "gk_tfrs16_audit_v16";

  let contracts = loadContracts();
  let selectedContractId = null;
  let bulkImportData = [];
  let bulkJournalData = [];
  let selectedAccountingPeriod = null;


  /*
  ============================================================
  DEMO DATA
  ============================================================
  */

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


  /*
  ============================================================
  STORAGE
  ============================================================
  */

  function loadContracts() {

    try {

      const stored =
        localStorage.getItem(STORAGE_KEY);

      if (stored) {

        const parsed =
          JSON.parse(stored);

        if (Array.isArray(parsed)) {
          return parsed;
        }

      }

    } catch (error) {

      console.error(
        "TFRS 16 storage error:",
        error
      );

    }

    const defaults =
      getDefaultContracts();

    saveContracts(defaults);

    return defaults;

  }


  function saveContracts(data) {

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(data)
    );

  }


  function loadJournals() {

    try {

      const stored =
        localStorage.getItem(
          JOURNAL_STORAGE_KEY
        );

      if (!stored) return [];

      const parsed =
        JSON.parse(stored);

      return Array.isArray(parsed)
        ? parsed
        : [];

    } catch (error) {

      console.error(
        "Journal storage error:",
        error
      );

      return [];

    }

  }


  function saveJournals(data) {

    localStorage.setItem(
      JOURNAL_STORAGE_KEY,
      JSON.stringify(data)
    );

  }


  function loadAuditTrail() {

    try {

      const stored =
        localStorage.getItem(
          AUDIT_STORAGE_KEY
        );

      if (!stored) return [];

      const parsed =
        JSON.parse(stored);

      return Array.isArray(parsed)
        ? parsed
        : [];

    } catch (error) {

      console.error(
        "Audit storage error:",
        error
      );

      return [];

    }

  }


  function saveAuditTrail(data) {

    localStorage.setItem(
      AUDIT_STORAGE_KEY,
      JSON.stringify(data)
    );

  }


  /*
  ============================================================
  AUDIT TRAIL
  ============================================================
  */

  function writeAudit(
    action,
    contractId = "",
    details = {}
  ) {

    try {

      const audit =
        loadAuditTrail();

      audit.push({

        id:
          `AUDIT-${Date.now()}-${Math.floor(
            Math.random() * 1000
          )}`,

        timestamp:
          new Date().toISOString(),

        action,

        contractId,

        details

      });

      saveAuditTrail(audit);

    } catch (error) {

      console.error(
        "Audit trail error:",
        error
      );

    }

  }


  /*
  ============================================================
  HELPERS
  ============================================================
  */

  function escapeHtml(value) {

    if (
      value === null ||
      value === undefined
    ) {
      return "";
    }

    return String(value)

      .replace(
        /&/g,
        "&amp;"
      )

      .replace(
        /</g,
        "&lt;"
      )

      .replace(
        />/g,
        "&gt;"
      )

      .replace(
        /"/g,
        "&quot;"
      )

      .replace(
        /'/g,
        "&#039;"
      );

  }


  function formatNumber(value) {

    return Number(value || 0)
      .toLocaleString(
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


  function parseNumber(value) {

    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return 0;
    }

    if (typeof value === "number") {
      return Number.isFinite(value)
        ? value
        : 0;
    }

    let text =
      String(value).trim();

    text =
      text.replace(
        /₺/g,
        ""
      );

    text =
      text.replace(
        /\s/g,
        ""
      );

    /*
      Türkçe Excel:
      125.000,50
    */

    if (
      text.includes(",") &&
      text.includes(".")
    ) {

      text =
        text.replace(
          /\./g,
          ""
        );

      text =
        text.replace(
          ",",
          "."
        );

    } else if (
      text.includes(",")
    ) {

      text =
        text.replace(
          ",",
          "."
        );

    }

    const number =
      Number(text);

    return Number.isFinite(number)
      ? number
      : 0;

  }


  /*
  ============================================================
  DATE ENGINE
  ============================================================
  */

  function parseDate(value) {

    if (!value) return null;

    if (value instanceof Date) {

      return isNaN(
        value.getTime()
      )
        ? null
        : value;

    }

    const text =
      String(value).trim();

    if (!text) return null;

    let date = null;


    if (
      /^\d{4}-\d{2}-\d{2}$/.test(text)
    ) {

      date =
        new Date(
          `${text}T00:00:00`
        );

    }

    else if (
      /^\d{1,2}\.\d{1,2}\.\d{4}$/
        .test(text)
    ) {

      const p =
        text.split(".");

      date =
        new Date(
          Number(p[2]),
          Number(p[1]) - 1,
          Number(p[0])
        );

    }

    else if (
      /^\d{1,2}\/\d{1,2}\/\d{4}$/
        .test(text)
    ) {

      const p =
        text.split("/");

      date =
        new Date(
          Number(p[2]),
          Number(p[1]) - 1,
          Number(p[0])
        );

    }

    else {

      /*
        Excel serial date
      */

      if (
        /^\d+(\.\d+)?$/.test(text)
      ) {

        const serial =
          Number(text);

        if (
          serial > 20000 &&
          serial < 60000
        ) {

          date =
            new Date(
              Date.UTC(
                1899,
                11,
                30
              ) +
              serial *
              86400000
            );

        }

      }

      if (!date) {
        date =
          new Date(text);
      }

    }

    return date &&
      !isNaN(
        date.getTime()
      )
      ? date
      : null;

  }


  function normalizeDate(value) {

    const date =
      parseDate(value);

    if (!date) return "";

    return [

      date.getFullYear(),

      String(
        date.getMonth() + 1
      ).padStart(2, "0"),

      String(
        date.getDate()
      ).padStart(2, "0")

    ].join("-");

  }


  function formatDate(value) {

    const date =
      parseDate(value);

    if (!date) return "-";

    return date.toLocaleDateString(
      "tr-TR"
    );

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

    return months[
      month - 1
    ] || "";

  }


  function getQuarterName(month) {

    const quarter =
      Math.ceil(
        Number(month) / 3
      );

    return `${quarter}. Çeyrek`;

  }


  function daysBetween(
    start,
    end
  ) {

    const a =
      parseDate(start);

    const b =
      parseDate(end);

    if (!a || !b) return 0;

    return Math.round(
      (
        b.getTime() -
        a.getTime()
      ) /
      86400000
    );

  }


  /*
  ============================================================
  PERIOD ENGINE
  ============================================================
  */

  function monthsBetween(
    start,
    end
  ) {

    const startDate =
      parseDate(start);

    const endDate =
      parseDate(end);

    if (
      !startDate ||
      !endDate
    ) {

      return 0;

    }

    const months =

      (
        endDate.getFullYear() -
        startDate.getFullYear()
      ) * 12

      +

      (
        endDate.getMonth() -
        startDate.getMonth()
      );

    return Math.max(
      1,
      months + 1
    );

  }


  /*
  ============================================================
  TFRS 16 CALCULATION ENGINE
  ============================================================
  */

  function calculateLease(
    contract
  ) {

    const payment =
      parseNumber(
        contract.monthlyPayment
      );

    const annualRate =
      parseNumber(
        contract.discountRate
      );

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


    if (
      monthlyRate === 0
    ) {

      liability =
        payment * months;

    }

    else {

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
      parseDate(
        contract.startDate
      );


    if (!contractStart) {

      return {

        months: 0,

        liability: 0,

        rouAssets: 0,

        depreciation: 0,

        monthlyInterest: 0,

        schedule: []

      };

    }


    for (
      let i = 1;
      i <= months;
      i++
    ) {

      const interest =
        openingLiability *
        monthlyRate;

      let principal =
        payment -
        interest;


      if (
        principal < 0
      ) {

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
          openingLiability -
          principal
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

          contractStart
            .getFullYear(),

          contractStart
            .getMonth() +
            i -
            1,

          1

        );


      schedule.push({

        period: i,

        date:
          periodDate,

        year:
          periodDate
            .getFullYear(),

        month:
          periodDate
            .getMonth() + 1,

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
        schedule[0]?.interest ||
        0,

      schedule

    };

  }


  /*
  ============================================================
  PERIOD SELECTION
  ============================================================
  */

  function getScheduleForYear(
    contract,
    year,
    month,
    period
  ) {

    const engine =
      calculateLease(
        contract
      );

    if (
      !engine.schedule.length
    ) {

      return [];

    }


    if (
      period === "monthly"
    ) {

      return engine.schedule.filter(
        item =>
          item.year === year &&
          item.month === month
      );

    }


    if (
      period === "quarterly"
    ) {

      const quarter =
        Math.ceil(
          month / 3
        );

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


    if (
      period === "annual"
    ) {

      return engine.schedule.filter(
        item =>
          item.year === year
      );

    }


    return [];

  }


  /*
  ============================================================
  LIABILITY CALCULATIONS
  ============================================================
  */

  function calculateCurrentLiability(
    contract
  ) {

    const engine =
      calculateLease(
        contract
      );

    return engine.schedule

      .slice(0, 12)

      .reduce(
        (
          total,
          item
        ) =>
          total +
          item.principal,
        0
      );

  }


  function calculateNonCurrentLiability(
    contract
  ) {

    const engine =
      calculateLease(
        contract
      );

    const current =
      calculateCurrentLiability(
        contract
      );

    return Math.max(
      0,
      engine.liability -
      current
    );

  }


  function calculateNext12Months(
    contract
  ) {

    const engine =
      calculateLease(
        contract
      );

    return engine.schedule

      .slice(0, 12)

      .reduce(
        (
          total,
          item
        ) =>
          total +
          item.payment,
        0
      );

  }


  function calculateRemainingLiability(
    contract
  ) {

    const engine =
      calculateLease(
        contract
      );

    return engine.schedule.length
      ? engine.schedule[
          engine.schedule.length - 1
        ].closingLiability
      : 0;

  }


  /*
  ============================================================
  RENEWAL / MODIFICATION
  ============================================================
  */

  function isRenewalWithin90Days(
    contract
  ) {

    if (
      !contract.renewalDate
    ) {

      return false;

    }


    const renewal =
      parseDate(
        contract.renewalDate
      );

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
      (
        1000 *
        60 *
        60 *
        24
      );


    return (
      days >= 0 &&
      days <= 90
    );

  }


  function isContractExpired(
    contract
  ) {

    const end =
      parseDate(
        contract.endDate
      );

    if (!end) return false;

    const today =
      new Date();

    today.setHours(
      0,
      0,
      0,
      0
    );

    return end < today;

  }


  /*
  ============================================================
  KPI
  ============================================================
  */

  function updateKPIs() {

    const active =
      contracts.filter(
        c =>
          c.status ===
          "active"
      );


    let liability = 0;
    let rou = 0;
    let next12 = 0;


    active.forEach(
      contract => {

        const engine =
          calculateLease(
            contract
          );

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
        c =>
          c.modification === true
      ).length;


    setText(
      "contractCount",
      active.length
    );


    setText(
      "leaseLiability",
      formatCurrency(
        liability
      )
    );


    setText(
      "rouAssets",
      formatCurrency(
        rou
      )
    );


    setText(
      "next12Months",
      formatCurrency(
        next12
      )
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


  /*
  ============================================================
  DOM HELPERS
  ============================================================
  */

  function setText(
    id,
    value
  ) {

    const element =
      document.getElementById(
        id
      );

    if (element) {

      element.textContent =
        value;

    }

  }


  function setInput(
    id,
    value
  ) {

    const input =
      document.getElementById(
        id
      );

    if (input) {

      input.value =
        value ?? "";

    }

  }


  function getInput(id) {

    return (
      document.getElementById(
        id
      )?.value || ""
    );

  }


  /*
  ============================================================
  COMPANY FILTER
  ============================================================
  */

  function populateCompanyFilter() {

    const select =
      document.getElementById(
        "companyFilter"
      );

    if (!select) return;


    const current =
      select.value;


    const companies = [

      ...new Set(

        contracts

          .map(
            c =>
              c.company
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
      companies.includes(
        current
      )
    ) {

      select.value =
        current;

    }

  }


  /*
  ============================================================
  CONTRACT TABLE
  ============================================================
  */

  function renderTable() {

    const tbody =
      document.getElementById(
        "contractTableBody"
      );

    if (!tbody) return;


    const search = (

      document.getElementById(
        "searchInput"
      )?.value || ""

    )
      .trim()
      .toLowerCase();


    const status =
      document.getElementById(
        "statusFilter"
      )?.value ||
      "all";


    const company =
      document.getElementById(
        "companyFilter"
      )?.value ||
      "all";


    const filtered =
      contracts.filter(
        contract => {

          const searchable = `

            ${contract.id}

            ${contract.company}

            ${contract.supplier}

          `.toLowerCase();


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
              contract.status ===
              status
            )

            &&

            (
              company === "all" ||
              contract.company ===
              company
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


        const expired =
          isContractExpired(
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


  /*
  ============================================================
  REFRESH
  ============================================================
  */

  function refresh() {

    updateKPIs();

    populateCompanyFilter();

    renderTable();

  }


  /*
  ============================================================
  CONTRACT VALIDATION
  ============================================================
  */

  function validateImportedContract(
    contract
  ) {

    const errors = [];


    if (!contract.id) {

      errors.push(
        "Contract ID boş"
      );

    }


    if (!contract.company) {

      errors.push(
        "Şirket boş"
      );

    }


    if (!contract.supplier) {

      errors.push(
        "Tedarikçi boş"
      );

    }


    if (
      parseNumber(
        contract.monthlyPayment
      ) <= 0
    ) {

      errors.push(
        "Aylık kira geçersiz"
      );

    }


    if (
      !normalizeDate(
        contract.startDate
      )
    ) {

      errors.push(
        "Başlangıç tarihi geçersiz"
      );

    }


    if (
      !normalizeDate(
        contract.endDate
      )
    ) {

      errors.push(
        "Bitiş tarihi geçersiz"
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
        "Başlangıç tarihi bitiş tarihinden sonra olamaz"
      );

    }


    const discount =
      parseNumber(
        contract.discountRate
      );


    if (
      discount < 0 ||
      discount > 100
    ) {

      errors.push(
        "İskonto oranı 0-100 arasında olmalıdır"
      );

    }


    return {

      errors,

      valid:
        errors.length === 0

    };

  }


  /*
  ============================================================
  DUPLICATE CONTROL
  ============================================================
  */

  function contractExists(
    id,
    ignoreId = null
  ) {

    const normalized =
      String(id || "")
        .trim()
        .toLowerCase();


    if (!normalized) {
      return false;
    }


    return contracts.some(
      contract => {

        const current =
          String(
            contract.id || ""
          )
            .trim()
            .toLowerCase();


        if (
          ignoreId &&
          current ===
          String(
            ignoreId
          )
            .trim()
            .toLowerCase()
        ) {

          return false;

        }


        return current ===
          normalized;

      }
    );

  }


  /*
  ============================================================
  CONTRACT MODAL
  ============================================================
  */

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
      contract?.supplier ||
      ""
    );


    setInput(
      "monthlyPayment",
      contract?.monthlyPayment ||
      ""
    );


    setInput(
      "startDate",
      contract?.startDate ||
      ""
    );


    setInput(
      "endDate",
      contract?.endDate ||
      ""
    );


    setInput(
      "discountRate",
      contract?.discountRate ??
      18
    );


    setInput(
      "renewalDate",
      contract?.renewalDate ||
      ""
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


  /*
  ============================================================
  CONTRACT SAVE
  ============================================================
  */

  document
    .getElementById(
      "contractForm"
    )
    ?.addEventListener(
      "submit",
      event => {

        event.preventDefault();


        const contract = {

          id:
            getInput(
              "contractId"
            ).trim(),

          company:
            getInput(
              "company"
            ).trim(),

          supplier:
            getInput(
              "supplier"
            ).trim(),

          monthlyPayment:
            parseNumber(
              getInput(
                "monthlyPayment"
              )
            ),

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
            parseNumber(
              getInput(
                "discountRate"
              )
            ),

          renewalDate:
            normalizeDate(
              getInput(
                "renewalDate"
              )
            ),

          status:
            "active",

          modification:
            false

        };


        const validation =
          validateImportedContract(
            contract
          );


        if (
          !validation.valid
        ) {

          alert(
            validation.errors.join(
              "\n"
            )
          );

          return;

        }


        const existingIndex =
          contracts.findIndex(
            item =>
              String(
                item.id
              )
                .trim()
                .toLowerCase() ===
              contract.id
                .trim()
                .toLowerCase()
          );


        if (
          existingIndex >= 0
        ) {

          const old =
            contracts[
              existingIndex
            ];


          const confirmed =
            confirm(
              `${contract.id} sözleşmesi zaten mevcut.\n\nMevcut sözleşme güncellensin mi?`
            );


          if (!confirmed) {
            return;
          }


          contract.status =
            old.status ||
            "active";

          contract.modification =
            old.modification ===
            true;


          contracts[
            existingIndex
          ] = contract;


          writeAudit(
            "CONTRACT_UPDATED",
            contract.id,
            {
              previous:
                old,
              current:
                contract
            }
          );

        }

        else {

          contracts.push(
            contract
          );


          writeAudit(
            "CONTRACT_CREATED",
            contract.id,
            {
              contract
            }
          );

        }


        saveContracts(
          contracts
        );


        closeContractModal();

        refresh();


        openDetail(
          contract.id
        );

      }
    );


  /*
  ============================================================
  FILTER EVENTS
  ============================================================
  */

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


  /*
  ============================================================
  INITIAL ACCOUNTING ENTRIES
  ============================================================
  */

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

        credit:
          0
      },

      {
        account:
          "401 Kiralama Yükümlülüğü",

        debit:
          0,

        credit:
          engine.liability
      }

    ];

  }


  /*
  ============================================================
  CURRENT / NON-CURRENT
  ============================================================
  */

  function generateReclassificationEntry(
    contract
  ) {

    const current =
      calculateCurrentLiability(
        contract
      );


    const nonCurrent =
      calculateNonCurrentLiability(
        contract
      );


    return [

      {
        account:
          "401 Kiralama Yükümlülüğü - Non-current",

        debit:
          0,

        credit:
          nonCurrent
      },

      {
        account:
          "301 Kiralama Yükümlülüğü - Current",

        debit:
          current,

        credit:
          0
      }

    ];

  }


  /*
  ============================================================
  JOURNAL BALANCE CONTROL
  ============================================================
  */

  function calculateJournalTotals(
    entries
  ) {

    const debit =
      entries.reduce(
        (
          total,
          item
        ) =>
          total +
          parseNumber(
            item.debit
          ),
        0
      );


    const credit =
      entries.reduce(
        (
          total,
          item
        ) =>
          total +
          parseNumber(
            item.credit
          ),
        0
      );


    const difference =
      Math.abs(
        debit -
        credit
      );


    return {

      debit,

      credit,

      difference,

      balanced:
        difference < 0.01

    };

  }


  function renderJournalEntry(
    title,
    entries
  ) {

    if (
      !entries?.length
    ) {

      return "";

    }


    const totals =
      calculateJournalTotals(
        entries
      );


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

            ${escapeHtml(
              title
            )}

          </strong>

        </div>


        <table

          style="
            width:100%;
            border-collapse:collapse;
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

            ${entries
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
                        parseNumber(
                          item.debit
                        ) > 0

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
                        parseNumber(
                          item.credit
                        ) > 0

                          ? formatCurrency(
                              item.credit
                            )

                          : "-"
                      }

                    </td>

                  </tr>

                `
              )
              .join("")}

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
                  totals.debit
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
                  totals.credit
                )}

              </td>

            </tr>

          </tfoot>

        </table>


        <div

          style="
            padding:10px 14px;
            background:${
              totals.balanced
                ? "#ecfdf5"
                : "#fef2f2"
            };
            color:${
              totals.balanced
                ? "#166534"
                : "#991b1b"
            };
            font-size:11px;
            font-weight:800;
          "

        >

          ${
            totals.balanced

              ? "✓ Borç / Alacak kontrolü başarılı"

              : "✕ BORÇ / ALACAK DENGESİZ"
          }

        </div>

      </div>

    `;

  }


  /*
  ============================================================
  YEAR / MONTH OPTIONS
  ============================================================
  */

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


    if (
      !start ||
      !end
    ) {

      return `

        <option>

          ${new Date()
            .getFullYear()}

        </option>

      `;

    }


    let html = "";


    for (
      let y = start;
      y <= end;
      y++
    ) {

      html += `

        <option
          value="${y}"
        >

          ${y}

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
        (
          month,
          index
        ) => `

          <option
            value="${index + 1}"
          >

            ${month}

          </option>

        `
      )

      .join("");

  }


  /*
  ============================================================
  ACCOUNTING CENTER
  ============================================================
  */

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

            Sözleşme bazında TFRS 16
            muhasebe fişi oluşturun.

          </p>

        </div>


        <div

          style="
            display:grid;
            grid-template-columns:
              repeat(
                auto-fit,
                minmax(170px,1fr)
              );
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

            Portföydeki tüm aktif
            sözleşmeler için toplu fiş üretin.

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

            Tüm Sözleşmeler İçin
            Toplu Fiş Üret

          </button>

        </div>

      </div>

    `;

  }


  /*
  ============================================================
  SELECTED JOURNAL
  ============================================================
  */

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


    if (
      period === "closing"
    ) {

      const entries =
        generateReclassificationEntry(
          contract
        );


      if (preview) {

        preview.innerHTML =
          renderJournalEntry(
            `${year} Yıl Sonu Current / Non-current Kapanış Fişi`,
            entries
          );

      }


      selectedAccountingPeriod = {
        year,
        period,
        month
      };

      return;

    }


    const selected =
      getScheduleForYear(
        contract,
        year,
        month,
        period
      );


    if (
      !selected.length
    ) {

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

            Bu sözleşmede seçilen dönem
            için ödeme planı bulunmuyor.

          </div>

        `;

      }

      return;

    }


    const interest =
      selected.reduce(
        (
          total,
          item
        ) =>
          total +
          item.interest,
        0
      );


    const principal =
      selected.reduce(
        (
          total,
          item
        ) =>
          total +
          item.principal,
        0
      );


    const payment =
      selected.reduce(
        (
          total,
          item
        ) =>
          total +
          item.payment,
        0
      );


    const depreciation =
      selected.reduce(
        (
          total,
          item
        ) =>
          total +
          item.depreciation,
        0
      );


    const entries = [

      {
        account:
          "780 Finansman Giderleri",

        debit:
          interest,

        credit:
          0
      },

      {
        account:
          "401 Kiralama Yükümlülüğü",

        debit:
          principal,

        credit:
          0
      },

      {
        account:
          "381 Kira Borçları / Ödeme",

        debit:
          0,

        credit:
          payment
      },

      {
        account:
          "770 / 730 Amortisman Giderleri",

        debit:
          depreciation,

        credit:
          0
      },

      {
        account:
          "268 Birikmiş Amortismanlar",

        debit:
          0,

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

    }


    if (
      period === "quarterly"
    ) {

      title =
        `${year} - ${
          Math.ceil(
            month / 3
          )
        }. Çeyrek Muhasebe Fişi`;

    }


    if (preview) {

      preview.innerHTML =
        renderJournalEntry(
          title,
          entries
        );

    }


    selectedAccountingPeriod = {

      year,

      period,

      month

    };

  }


  /*
  ============================================================
  DETAIL MODAL
  ============================================================
  */

  function openDetail(id) {

    const contract =
      contracts.find(
        item =>
          item.id === id
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
              Kira Yükümlülüğü
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


          <div class="detail-item">

            <span>
              Current Yükümlülük
            </span>

            <strong>
              ${formatCurrency(
                calculateCurrentLiability(
                  contract
                )
              )}
            </strong>

          </div>


          <div class="detail-item">

            <span>
              Non-current Yükümlülük
            </span>

            <strong>
              ${formatCurrency(
                calculateNonCurrentLiability(
                  contract
                )
              )}
            </strong>

          </div>

        </div>


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

      },
      0
    );


    writeAudit(
      "CONTRACT_VIEWED",
      contract.id
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


  /*
  ============================================================
  DELETE CONTRACT
  ============================================================
  */

  document
    .getElementById(
      "deleteContract"
    )
    ?.addEventListener(
      "click",
      () => {

        if (
          !selectedContractId
        ) return;


        const contract =
          contracts.find(
            item =>
              item.id ===
              selectedContractId
          );


        if (!contract) return;


        const confirmed =
          confirm(

            `${contract.id} sözleşmesi silinsin mi?\n\nBu işlem geri alınamaz.`

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


        writeAudit(
          "CONTRACT_DELETED",
          contract.id,
          {
            contract
          }
        );


        closeDetail();

        refresh();

      }
    );


  /*
  ============================================================
  V16 PAYMENT SCHEDULE SUMMARY
  ============================================================
  */

  function renderScheduleSummary(
    contract
  ) {

    const engine =
      calculateLease(
        contract
      );


    if (
      !engine.schedule.length
    ) {

      return `

        <div

          style="
            margin-top:18px;
            padding:14px;
            background:#fff7ed;
            border:1px solid #fed7aa;
            border-radius:10px;
            color:#9a3412;
          "

        >

          Ödeme planı oluşturulamadı.

        </div>

      `;

    }


    const first =
      engine.schedule[0];


    const last =
      engine.schedule[
        engine.schedule.length - 1
      ];


    return `

      <div

        style="
          margin-top:20px;
          border:1px solid #e5e7eb;
          border-radius:12px;
          background:#f8fafc;
          padding:16px;
        "

      >

        <div

          style="
            font-size:10px;
            font-weight:800;
            color:#64748b;
            letter-spacing:1px;
          "

        >

          ÖDEME PLANI ÖZETİ

        </div>


        <div

          style="
            display:grid;
            grid-template-columns:
              repeat(
                auto-fit,
                minmax(150px,1fr)
              );
            gap:10px;
            margin-top:12px;
          "

        >

          <div>

            <span
              style="
                display:block;
                font-size:10px;
                color:#64748b;
              "
            >
              Toplam Dönem
            </span>

            <strong>
              ${engine.months} ay
            </strong>

          </div>


          <div>

            <span
              style="
                display:block;
                font-size:10px;
                color:#64748b;
              "
            >
              İlk Dönem
            </span>

            <strong>
              ${formatDate(
                first.date
              )}
            </strong>

          </div>


          <div>

            <span
              style="
                display:block;
                font-size:10px;
                color:#64748b;
              "
            >
              Son Dönem
            </span>

            <strong>
              ${formatDate(
                last.date
              )}
            </strong>

          </div>


          <div>

            <span
              style="
                display:block;
                font-size:10px;
                color:#64748b;
              "
            >
              Toplam Ödeme
            </span>

            <strong>
              ${formatCurrency(
                engine.schedule.reduce(
                  (
                    total,
                    item
                  ) =>
                    total +
                    item.payment,
                  0
                )
              )}
            </strong>

          </div>

        </div>

      </div>

    `;

  }


  /*
  ============================================================
  BULK IMPORT - TEMPLATE
  ============================================================
  */

  function createExcelTemplate() {

    const rows = [

      {

        "Sözleşme ID":
          "LEASE-004",

        "Şirket":
          "GK Holding",

        "Tedarikçi":
          "ABC Plaza",

        "Aylık Kira":
          100000,

        "Başlangıç Tarihi":
          "01.01.2026",

        "Bitiş Tarihi":
          "31.12.2030",

        "İskonto Oranı":
          18,

        "Yenileme Tarihi":
          "30.09.2030"

      }

    ];


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
          "TFRS16 Sozlesmeler"
        );


        XLSX.writeFile(
          workbook,
          "TFRS16_Sozlesme_Sablonu.xlsx"
        );


        return;

      } catch (error) {

        console.error(
          error
        );

      }

    }


    const headers =
      Object.keys(
        rows[0]
      );


    const csv = [

      headers,

      ...rows.map(
        row =>
          headers.map(
            header =>
              row[header]
          )
      )

    ]

      .map(
        row =>
          row.map(
            value =>
              `"${String(
                value ?? ""
              ).replaceAll(
                '"',
                '""'
              )}"`
          ).join(";")
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


  /*
  ============================================================
  BULK IMPORT MODAL
  ============================================================
  */

  document
    .getElementById(
      "bulkImportButton"
    )
    ?.addEventListener(
      "click",
      openBulkImportModal
    );


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


    setText(
      "bulkImportStatus",
      ""
    );


    const preview =
      document.getElementById(
        "bulkPreview"
      );


    if (preview) {

      preview.innerHTML =
        "";

    }


    const confirmButton =
      document.getElementById(
        "confirmBulkImport"
      );


    if (confirmButton) {

      confirmButton.disabled =
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

    bulkImportData = [];

  }


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
      "downloadTemplateButton"
    )
    ?.addEventListener(
      "click",
      createExcelTemplate
    );


  /*
  ============================================================
  BULK FILE READER
  ============================================================
  */

  document
    .getElementById(
      "bulkFileInput"
    )
    ?.addEventListener(
      "change",
      handleBulkFile
    );


  function handleBulkFile(
    event
  ) {

    const file =
      event.target.files?.[0];


    if (!file) return;


    const extension =
      file.name
        .split(".")
        .pop()
        .toLowerCase();


    const reader =
      new FileReader();


    reader.onload =
      function () {

        try {

          if (
            extension ===
            "csv"
          ) {

            processCSV(
              reader.result
            );

          }

          else {

            processExcel(
              reader.result
            );

          }

        } catch (error) {

          console.error(
            error
          );


          setBulkStatus(
            "Dosya okunamadı. Lütfen şablonu ve kolon isimlerini kontrol edin.",
            "error"
          );

        }

      };


    if (
      extension ===
      "csv"
    ) {

      reader.readAsText(
        file,
        "UTF-8"
      );

    }

    else {

      reader.readAsArrayBuffer(
        file
      );

    }

  }


  function processExcel(
    buffer
  ) {

    if (
      typeof XLSX ===
      "undefined"
    ) {

      setBulkStatus(
        "Excel motoru yüklenemedi.",
        "error"
      );

      return;

    }


    const workbook =
      XLSX.read(
        buffer,
        {
          type:
            "array",
          cellDates:
            true
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


    processImportedRows(
      rows
    );

  }


  function processCSV(
    text
  ) {

    const lines =
      String(text || "")
        .split(/\r?\n/)
        .filter(
          line =>
            line.trim()
        );


    if (
      !lines.length
    ) {

      setBulkStatus(
        "CSV dosyası boş.",
        "error"
      );

      return;

    }


    const separator =
      lines[0].includes(";")
        ? ";"
        : ",";


    const headers =
      parseCSVLine(
        lines[0],
        separator
      );


    const rows = [];


    for (
      let i = 1;
      i < lines.length;
      i++
    ) {

      const values =
        parseCSVLine(
          lines[i],
          separator
        );


      const row = {};


      headers.forEach(
        (
          header,
          index
        ) => {

          row[
            header
          ] =
            values[
              index
            ] ??
            "";

        }
      );


      rows.push(
        row
      );

    }


    processImportedRows(
      rows
    );

  }


  function parseCSVLine(
    line,
    separator
  ) {

    const result = [];

    let current = "";

    let quoted = false;


    for (
      let i = 0;
      i < line.length;
      i++
    ) {

      const char =
        line[i];


      if (
        char === '"'
      ) {

        if (
          quoted &&
          line[i + 1] === '"'
        ) {

          current += '"';

          i++;

        } else {

          quoted =
            !quoted;

        }

      }

      else if (
        char ===
        separator &&
        !quoted
      ) {

        result.push(
          current
        );

        current = "";

      }

      else {

        current +=
          char;

      }

    }


    result.push(
      current
    );


    return result;

  }


  /*
  ============================================================
  IMPORT COLUMN NORMALIZATION
  ============================================================
  */

  function getImportedValue(
    row,
    aliases
  ) {

    const keys =
      Object.keys(
        row || {}
      );


    for (
      const alias of aliases
    ) {

      const normalizedAlias =
        normalizeColumnName(
          alias
        );


      const key =
        keys.find(
          item =>
            normalizeColumnName(
              item
            ) ===
            normalizedAlias
        );


      if (
        key !==
        undefined
      ) {

        return row[key];

      }

    }


    return "";

  }


  function normalizeColumnName(
    value
  ) {

    return String(
      value ?? ""
    )

      .trim()
      .toLowerCase()

      .replace(
        /ı/g,
        "i"
      )

      .replace(
        /ş/g,
        "s"
      )

      .replace(
        /ğ/g,
        "g"
      )

      .replace(
        /ü/g,
        "u"
      )

      .replace(
        /ö/g,
        "o"
      )

      .replace(
        /ç/g,
        "c"
      )

      .replace(
        /\s+/g,
        " "
      );

  }


  function normalizeImportedRow(
    row
  ) {

    return {

      id:
        String(
          getImportedValue(
            row,
            [
              "Sözleşme ID",
              "Sozlesme ID",
              "Contract ID",
              "ID"
            ]
          )
        ).trim(),


      company:
        String(
          getImportedValue(
            row,
            [
              "Şirket",
              "Sirket",
              "Company"
            ]
          )
        ).trim(),


      supplier:
        String(
          getImportedValue(
            row,
            [
              "Tedarikçi",
              "Tedarikci",
              "Supplier"
            ]
          )
        ).trim(),


      monthlyPayment:
        parseNumber(
          getImportedValue(
            row,
            [
              "Aylık Kira",
              "Aylik Kira",
              "Monthly Payment",
              "Monthly Rent"
            ]
          )
        ),


      startDate:
        normalizeDate(
          getImportedValue(
            row,
            [
              "Başlangıç Tarihi",
              "Baslangic Tarihi",
              "Start Date"
            ]
          )
        ),


      endDate:
        normalizeDate(
          getImportedValue(
            row,
            [
              "Bitiş Tarihi",
              "Bitis Tarihi",
              "End Date"
            ]
          )
        ),


      discountRate:
        parseNumber(
          getImportedValue(
            row,
            [
              "İskonto Oranı",
              "Iskonto Orani",
              "Discount Rate"
            ]
          )
        ),


      renewalDate:
        normalizeDate(
          getImportedValue(
            row,
            [
              "Yenileme Tarihi",
              "Renewal Date"
            ]
          )
        ),


      status:
        "active",


      modification:
        false

    };

  }


  function processImportedRows(
    rows
  ) {

    if (
      !Array.isArray(rows) ||
      !rows.length
    ) {

      setBulkStatus(
        "Aktarılacak kayıt bulunamadı.",
        "error"
      );

      return;

    }


    bulkImportData =
      rows.map(
        normalizeImportedRow
      );


    const results =
      bulkImportData.map(
        (
          contract,
          index
        ) => {

          const validation =
            validateImportedContract(
              contract
            );


          const duplicate =
            contractExists(
              contract.id
            );


          return {

            ...contract,

            row:
              index + 2,

            errors:
              [
                ...validation.errors,

                ...(duplicate
                  ? [
                      "Sözleşme ID zaten mevcut"
                    ]
                  : [])

              ],

            valid:
              validation.valid &&
              !duplicate

          };

        }
      );


    bulkImportData =
      results;


    renderBulkPreview();


    const validCount =
      results.filter(
        item =>
          item.valid
      ).length;


    const invalidCount =
      results.length -
      validCount;


    setBulkStatus(

      `${results.length} kayıt okundu. ${validCount} kayıt aktarılabilir, ${invalidCount} kayıt hatalı.`,

      invalidCount
        ? "warning"
        : "success"

    );


    const confirmButton =
      document.getElementById(
        "confirmBulkImport"
      );


    if (confirmButton) {

      confirmButton.disabled =
        validCount === 0;

    }

  }


  function setBulkStatus(
    message,
    type = "info"
  ) {

    const element =
      document.getElementById(
        "bulkImportStatus"
      );


    if (!element) return;


    const styles = {

      success:
        "padding:10px;border-radius:8px;background:#ecfdf5;color:#166534;border:1px solid #bbf7d0;",

      warning:
        "padding:10px;border-radius:8px;background:#fff7ed;color:#9a3412;border:1px solid #fed7aa;",

      error:
        "padding:10px;border-radius:8px;background:#fef2f2;color:#991b1b;border:1px solid #fecaca;",

      info:
        "padding:10px;border-radius:8px;background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;"

    };


    element.style.cssText =
      styles[type] ||
      styles.info;


    element.textContent =
      message;

  }


  function renderBulkPreview() {

    const preview =
      document.getElementById(
        "bulkPreview"
      );


    if (!preview) return;


    if (
      !bulkImportData.length
    ) {

      preview.innerHTML =
        "";

      return;

    }


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
                style="padding:9px;"
              >
                Satır
              </th>

              <th
                style="padding:9px;"
              >
                Sözleşme
              </th>

              <th
                style="padding:9px;"
              >
                Şirket
              </th>

              <th
                style="padding:9px;"
              >
                Tedarikçi
              </th>

              <th
                style="padding:9px;text-align:right;"
              >
                Aylık Kira
              </th>

              <th
                style="padding:9px;"
              >
                Başlangıç
              </th>

              <th
                style="padding:9px;"
              >
                Bitiş
              </th>

              <th
                style="padding:9px;"
              >
                Kontrol
              </th>

            </tr>

          </thead>


          <tbody>

            ${bulkImportData
              .map(
                item => `

                  <tr>

                    <td
                      style="
                        padding:9px;
                        border-top:1px solid #edf0f4;
                      "
                    >

                      ${item.row}

                    </td>


                    <td
                      style="
                        padding:9px;
                        border-top:1px solid #edf0f4;
                        font-weight:700;
                      "
                    >

                      ${escapeHtml(
                        item.id
                      )}

                    </td>


                    <td
                      style="
                        padding:9px;
                        border-top:1px solid #edf0f4;
                      "
                    >

                      ${escapeHtml(
                        item.company
                      )}

                    </td>


                    <td
                      style="
                        padding:9px;
                        border-top:1px solid #edf0f4;
                      "
                    >

                      ${escapeHtml(
                        item.supplier
                      )}

                    </td>


                    <td
                      style="
                        padding:9px;
                        text-align:right;
                        border-top:1px solid #edf0f4;
                      "
                    >

                      ${formatCurrency(
                        item.monthlyPayment
                      )}

                    </td>


                    <td
                      style="
                        padding:9px;
                        border-top:1px solid #edf0f4;
                      "
                    >

                      ${formatDate(
                        item.startDate
                      )}

                    </td>


                    <td
                      style="
                        padding:9px;
                        border-top:1px solid #edf0f4;
                      "
                    >

                      ${formatDate(
                        item.endDate
                      )}

                    </td>


                    <td
                      style="
                        padding:9px;
                        border-top:1px solid #edf0f4;
                        font-weight:800;
                        color:${
                          item.valid
                            ? "#166534"
                            : "#991b1b"
                        };
                      "
                    >

                      ${
                        item.valid
                          ? "✓ OK"
                          : "✕ " +
                            escapeHtml(
                              item.errors.join(
                                ", "
                              )
                            )
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

  }


  /*
  ============================================================
  BULK IMPORT CONFIRM
  ============================================================
  */

  document
    .getElementById(
      "confirmBulkImport"
    )
    ?.addEventListener(
      "click",
      confirmBulkImport
    );


  function confirmBulkImport() {

    const validRows =
      bulkImportData.filter(
        item =>
          item.valid
      );


    if (
      !validRows.length
    ) {

      alert(
        "Aktarılabilecek geçerli kayıt bulunamadı."
      );

      return;

    }


    const confirmed =
      confirm(
        `${validRows.length} sözleşme portföye aktarılacak. Devam edilsin mi?`
      );


    if (!confirmed) {
      return;
    }


    validRows.forEach(
      item => {

        contracts.push({

          id:
            item.id,

          company:
            item.company,

          supplier:
            item.supplier,

          monthlyPayment:
            item.monthlyPayment,

          startDate:
            item.startDate,

          endDate:
            item.endDate,

          discountRate:
            item.discountRate,

          renewalDate:
            item.renewalDate,

          status:
            "active",

          modification:
            false

        });


        writeAudit(
          "CONTRACT_IMPORTED",
          item.id,
          {
            source:
              "Excel Bulk Import"
          }
        );

      }
    );


    saveContracts(
      contracts
    );


    closeBulkImportModal();


    refresh();


    alert(
      `${validRows.length} sözleşme başarıyla aktarıldı.`
    );

  }


  /*
  ============================================================
  V16 — SCHEDULE TABLE
  ============================================================
  */

  function renderPaymentSchedule(
    contract
  ) {

    const engine =
      calculateLease(
        contract
      );


    if (
      !engine.schedule.length
    ) {

      return "";

    }


    const rows =
      engine.schedule
        .slice(0, 24);


    return `

      <div

        style="
          margin-top:20px;
          border:1px solid #e5e7eb;
          border-radius:12px;
          overflow:auto;
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
            İlk 24 Dönem Ödeme Planı
          </strong>

        </div>


        <table

          style="
            width:100%;
            min-width:900px;
            border-collapse:collapse;
          "

        >

          <thead>

            <tr>

              <th style="padding:9px;">
                Dönem
              </th>

              <th style="padding:9px;">
                Tarih
              </th>

              <th style="padding:9px;text-align:right;">
                Açılış Yükümlülük
              </th>

              <th style="padding:9px;text-align:right;">
                Ödeme
              </th>

              <th style="padding:9px;text-align:right;">
                Faiz
              </th>

              <th style="padding:9px;text-align:right;">
                Anapara
              </th>

              <th style="padding:9px;text-align:right;">
                Kapanış Yükümlülük
              </th>

              <th style="padding:9px;text-align:right;">
                Amortisman
              </th>

            </tr>

          </thead>


          <tbody>

            ${rows
              .map(
                item => `

                  <tr>

                    <td
                      style="
                        padding:9px;
                        border-top:1px solid #edf0f4;
                      "
                    >
                      ${item.period}
                    </td>


                    <td
                      style="
                        padding:9px;
                        border-top:1px solid #edf0f4;
                      "
                    >
                      ${formatDate(
                        item.date
                      )}
                    </td>


                    <td
                      style="
                        padding:9px;
                        text-align:right;
                        border-top:1px solid #edf0f4;
                      "
                    >
                      ${formatCurrency(
                        item.openingLiability
                      )}
                    </td>


                    <td
                      style="
                        padding:9px;
                        text-align:right;
                        border-top:1px solid #edf0f4;
                      "
                    >
                      ${formatCurrency(
                        item.payment
                      )}
                    </td>


                    <td
                      style="
                        padding:9px;
                        text-align:right;
                        border-top:1px solid #edf0f4;
                      "
                    >
                      ${formatCurrency(
                        item.interest
                      )}
                    </td>


                    <td
                      style="
                        padding:9px;
                        text-align:right;
                        border-top:1px solid #edf0f4;
                      "
                    >
                      ${formatCurrency(
                        item.principal
                      )}
                    </td>


                    <td
                      style="
                        padding:9px;
                        text-align:right;
                        border-top:1px solid #edf0f4;
                      "
                    >
                      ${formatCurrency(
                        item.closingLiability
                      )}
                    </td>


                    <td
                      style="
                        padding:9px;
                        text-align:right;
                        border-top:1px solid #edf0f4;
                      "
                    >
                      ${formatCurrency(
                        item.depreciation
                      )}
                    </td>

                  </tr>

                `
              )
              .join("")}

          </tbody>

        </table>

      </div>

    `;

  }
