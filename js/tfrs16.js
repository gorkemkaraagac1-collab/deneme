document.addEventListener("DOMContentLoaded", () => {

  /*
  ============================================================
  GK FINANCE INTELLIGENCE
  TFRS 16 ACCOUNTING ENGINE V13
  BULK CONTRACT IMPORT
  BULK JOURNAL CENTER
  ERP EXCEL EXPORT
  AUDIT TRAIL
  DEBIT / CREDIT CONTROL
  ============================================================
  */

  const STORAGE_KEY = "gk_tfrs16_contracts_v7";

  let contracts = loadContracts();
  let selectedContractId = null;
  let bulkImportData = [];
  let bulkJournalData = [];


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


  /*
  ============================================================
  FORMAT
  ============================================================
  */

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


  function parseDate(value) {

    if (!value) {
      return null;
    }

    if (value instanceof Date) {

      return isNaN(value.getTime())
        ? null
        : value;

    }

    const text =
      String(value).trim();

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
      /^\d{1,2}\.\d{1,2}\.\d{4}$/.test(text)
    ) {

      const parts =
        text.split(".");

      date =
        new Date(
          Number(parts[2]),
          Number(parts[1]) - 1,
          Number(parts[0])
        );

    }

    else if (
      /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(text)
    ) {

      const parts =
        text.split("/");

      date =
        new Date(
          Number(parts[2]),
          Number(parts[1]) - 1,
          Number(parts[0])
        );

    }

    else {

      date =
        new Date(text);

    }


    return (
      date &&
      !isNaN(date.getTime())
    )
      ? date
      : null;

  }


  function normalizeDate(value) {

    if (!value) {
      return "";
    }

    const date =
      parseDate(value);

    if (!date) {
      return "";
    }

    const year =
      date.getFullYear();

    const month =
      String(
        date.getMonth() + 1
      ).padStart(2, "0");

    const day =
      String(
        date.getDate()
      ).padStart(2, "0");

    return `${year}-${month}-${day}`;

  }


  function formatDate(value) {

    const date =
      parseDate(value);

    if (!date) {
      return "-";
    }

    return date.toLocaleDateString(
      "tr-TR"
    );

  }


  function getPeriodEndDate(
    year,
    month
  ) {

    const date =
      new Date(
        year,
        month,
        0
      );

    return normalizeDate(date);

  }


  /*
  ============================================================
  MONTH CALCULATION
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
  TFRS 16 ENGINE
  ============================================================
  */

  function calculateLease(
    contract
  ) {

    const payment =
      Number(
        contract.monthlyPayment
      ) || 0;

    const annualRate =
      Number(
        contract.discountRate
      ) || 0;

    const monthlyRate =
      annualRate /
      100 /
      12;

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
        payment *
        months;

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
      initialROU /
      months;


    const schedule = [];

    let openingLiability =
      initialLiability;

    let rouOpening =
      initialROU;


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


      schedule.push({

        period:
          i,

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


  /*
  ============================================================
  LIABILITY
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


  /*
  ============================================================
  RENEWAL
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


  /*
  ============================================================
  KPI
  ============================================================
  */

  function updateKPIs() {

    const active =
      contracts.filter(
        contract =>
          contract.status ===
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
        contract =>
          contract.modification ===
          true
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


  function setText(
    id,
    value
  ) {

    const element =
      document.getElementById(id);

    if (element) {
      element.textContent =
        value;
    }

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

    if (!select) {
      return;
    }

    const current =
      select.value;


    const companies =
      [
        ...new Set(
          contracts
            .map(
              contract =>
                contract.company
            )
            .filter(Boolean)
        )
      ].sort();


    select.innerHTML = `
      <option value="all">
        Tüm Şirketler
      </option>
    `;


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
  TABLE
  ============================================================
  */

  function renderTable() {

    const tbody =
      document.getElementById(
        "contractTableBody"
      );

    if (!tbody) {
      return;
    }


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
  NEW CONTRACT
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

    if (!modal) {
      return;
    }


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


  function setInput(
    id,
    value
  ) {

    const input =
      document.getElementById(id);

    if (input) {
      input.value =
        value;
    }

  }


  function getInput(
    id
  ) {

    return (
      document.getElementById(id)?.value ||
      ""
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
  SAVE CONTRACT
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


        const id =
          getInput(
            "contractId"
          ).trim();


        if (!id) {
          return;
        }


        const existing =
          contracts.find(
            contract =>
              contract.id === id
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

        openDetail(
          id
        );

      }
    );


  /*
  ============================================================
  ACCOUNTING ENGINE
  ============================================================
  */

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


    return [

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

  }


  /*
  ============================================================
  INITIAL ENTRY
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
  RECLASSIFICATION
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
  DEBIT / CREDIT CONTROL
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
          Number(
            item.debit || 0
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
          Number(
            item.credit || 0
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


  function validateJournal(
    entries
  ) {

    const totals =
      calculateJournalTotals(
        entries
      );

    return totals.balanced;

  }


  /*
  ============================================================
  JOURNAL HTML
  ============================================================
  */

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


    const totals =
      calculateJournalTotals(
        entries
      );


    const controlHtml =
      totals.balanced
        ? `
          <div style="
            margin-top:12px;
            padding:10px 12px;
            background:#ecfdf5;
            border:1px solid #bbf7d0;
            color:#166534;
            border-radius:8px;
            font-size:11px;
            font-weight:700;
          ">
            ✓ Borç / Alacak dengeli
          </div>
        `
        : `
          <div style="
            margin-top:12px;
            padding:10px 12px;
            background:#fef2f2;
            border:1px solid #fecaca;
            color:#991b1b;
            border-radius:8px;
            font-size:11px;
            font-weight:700;
          ">
            ⚠ Borç / Alacak dengesi bozuk.
            Fark:
            ${formatCurrency(
              totals.difference
            )}
          </div>
        `;


    return `

      <div style="
        margin-top:22px;
        border:1px solid #e5e7eb;
        border-radius:12px;
        overflow:hidden;
        background:white;
      ">

        <div style="
          padding:14px 16px;
          background:#f8fafc;
          border-bottom:1px solid #e5e7eb;
        ">

          <strong>
            ${escapeHtml(title)}
          </strong>

        </div>


        <table style="
          width:100%;
          border-collapse:collapse;
        ">

          <thead>

            <tr>

              <th style="
                padding:10px;
                text-align:left;
              ">
                Hesap
              </th>

              <th style="
                padding:10px;
                text-align:right;
              ">
                Borç
              </th>

              <th style="
                padding:10px;
                text-align:right;
              ">
                Alacak
              </th>

            </tr>

          </thead>


          <tbody>

            ${entries.map(
              item => `

                <tr>

                  <td style="
                    padding:10px;
                    border-top:1px solid #edf0f4;
                  ">
                    ${escapeHtml(
                      item.account
                    )}
                  </td>

                  <td style="
                    padding:10px;
                    text-align:right;
                    border-top:1px solid #edf0f4;
                  ">
                    ${
                      item.debit
                        ? formatCurrency(
                            item.debit
                          )
                        : "-"
                    }
                  </td>

                  <td style="
                    padding:10px;
                    text-align:right;
                    border-top:1px solid #edf0f4;
                  ">
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

              <td style="
                padding:11px;
                font-weight:800;
                border-top:2px solid #cbd5e1;
              ">
                TOPLAM
              </td>

              <td style="
                padding:11px;
                text-align:right;
                font-weight:800;
                border-top:2px solid #cbd5e1;
              ">
                ${formatCurrency(
                  totals.debit
                )}
              </td>

              <td style="
                padding:11px;
                text-align:right;
                font-weight:800;
                border-top:2px solid #cbd5e1;
              ">
                ${formatCurrency(
                  totals.credit
                )}
              </td>

            </tr>

          </tfoot>

        </table>

        ${controlHtml}

      </div>

    `;

  }


  /*
  ============================================================
  YEAR OPTIONS
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
          ${new Date().getFullYear()}
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
        <option value="${y}">
          ${y}
        </option>
      `;

    }


    return html;

  }


  /*
  ============================================================
  MONTH OPTIONS
  ============================================================
  */

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


    return months.map(
      (
        month,
        index
      ) => `

        <option value="${
          index + 1
        }">

          ${month}

        </option>

      `
    ).join("");

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

      <div style="
        margin-top:28px;
        border-top:1px solid #e5e7eb;
        padding-top:24px;
      ">

        <div>

          <div style="
            font-size:10px;
            color:#64748b;
            font-weight:800;
            letter-spacing:1px;
          ">
            MUHASEBE İŞLEMLERİ
          </div>

          <h3 style="
            margin:5px 0 0;
            font-size:18px;
          ">
            Muhasebe Fiş Merkezi
          </h3>

          <p style="
            margin:5px 0 0;
            color:#64748b;
            font-size:11px;
          ">
            Bu ekran tek sözleşme için fiş üretir.
            Tüm portföy için aşağıdaki Toplu Fiş Merkezi kullanılabilir.
          </p>

        </div>


        <div style="
          display:grid;
          grid-template-columns:
            repeat(auto-fit,minmax(170px,1fr));
          gap:12px;
          margin-top:18px;
        ">

          <div style="
            background:#f8fafc;
            border:1px solid #e5e7eb;
            border-radius:10px;
            padding:14px;
          ">

            <label style="
              display:block;
              font-size:10px;
              color:#64748b;
              margin-bottom:7px;
            ">
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


          <div style="
            background:#f8fafc;
            border:1px solid #e5e7eb;
            border-radius:10px;
            padding:14px;
          ">

            <label style="
              display:block;
              font-size:10px;
              color:#64748b;
              margin-bottom:7px;
            ">
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
                12 Aylık Toplu
              </option>

              <option value="closing">
                Yıllık Kapanış
              </option>

            </select>

          </div>


          <div style="
            background:#f8fafc;
            border:1px solid #e5e7eb;
            border-radius:10px;
            padding:14px;
          ">

            <label style="
              display:block;
              font-size:10px;
              color:#64748b;
              margin-bottom:7px;
            ">
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


          <div style="
            display:flex;
            align-items:end;
          ">

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


        <div id="journalPreview"></div>


        <div style="
          margin-top:14px;
          padding:12px 14px;
          background:#fffdf7;
          border:1px solid #f3e8c5;
          border-radius:9px;
          color:#92400e;
          font-size:10px;
          line-height:1.5;
        ">

          <strong>Kontrol:</strong>

          Fişler önce önizleme olarak oluşturulur.
          ERP'ye otomatik kayıt bu sürümde yapılmaz.

        </div>

      </div>

    `;

  }


  /*
  ============================================================
  SINGLE JOURNAL GENERATOR
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


    const engine =
      calculateLease(
        contract
      );


    let startMonth;
    let endMonth;
    let title;


    if (
      period === "monthly"
    ) {

      startMonth =
        month;

      endMonth =
        month;

      title =
        `${year} - ${getMonthName(
          month
        )} Aylık Muhasebe Fişi`;

    }


    if (
      period === "quarterly"
    ) {

      const quarter =
        Math.ceil(
          month / 3
        );


      startMonth =
        (
          quarter - 1
        ) * 3 + 1;


      endMonth =
        Math.min(
          quarter * 3,
          engine.schedule.length
        );


      title =
        `${year} - ${quarter}. Çeyrek Muhasebe Fişi`;

    }


    if (
      period === "annual"
    ) {

      startMonth = 1;

      endMonth =
        Math.min(
          12,
          engine.schedule.length
        );


      title =
        `${year} - 12 Aylık Toplu Muhasebe Fişi`;

    }


    if (
      period === "closing"
    ) {

      const entries =
        generateReclassificationEntry(
          contract
        );


      const preview =
        document.getElementById(
          "journalPreview"
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


    if (
      !startMonth ||
      !endMonth
    ) {
      return;
    }


    if (
      startMonth >
      engine.schedule.length
    ) {

      const preview =
        document.getElementById(
          "journalPreview"
        );


      if (preview) {

        preview.innerHTML = `

          <div style="
            margin-top:18px;
            padding:15px;
            background:#fff7ed;
            border:1px solid #fed7aa;
            border-radius:9px;
            color:#9a3412;
          ">

            Bu sözleşmede seçilen dönem için
            ödeme planı bulunmuyor.

          </div>

        `;

      }

      return;

    }


    endMonth =
      Math.min(
        endMonth,
        engine.schedule.length
      );


    const entries =
      getJournalForPeriod(
        contract,
        startMonth,
        endMonth
      );


    const preview =
      document.getElementById(
        "journalPreview"
      );


    if (preview) {

      preview.innerHTML =
        renderJournalEntry(
          title,
          entries
        );

    }

  }


  function getMonthName(
    month
  ) {

    const names = [
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


    return (
      names[month - 1] ||
      "-"
    );

  }


  /*
  ============================================================
  ============================================================
  BULK JOURNAL CENTER
  ============================================================
  ============================================================
  */

  function openBulkJournalModal() {

    const modal =
      document.getElementById(
        "bulkJournalModal"
      );

    if (!modal) {

      createBulkJournalModal();

    }


    const target =
      document.getElementById(
        "bulkJournalModal"
      );

    if (!target) {
      return;
    }


    populateBulkJournalCompanies();

    populateBulkJournalYears();

    bulkJournalData = [];

    const preview =
      document.getElementById(
        "bulkJournalPreview"
      );

    if (preview) {
      preview.innerHTML = "";
    }


    const status =
      document.getElementById(
        "bulkJournalStatus"
      );

    if (status) {
      status.innerHTML = "";
    }


    target.classList.remove(
      "hidden"
    );

  }


  function closeBulkJournalModal() {

    document
      .getElementById(
        "bulkJournalModal"
      )
      ?.classList.add(
        "hidden"
      );

    bulkJournalData = [];

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
      "modal hidden";


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

      <div style="
        width:min(1100px,100%);
        max-height:92vh;
        overflow:auto;
        background:white;
        border-radius:16px;
        box-shadow:0 25px 80px rgba(0,0,0,.22);
      ">

        <div style="
          padding:20px 22px;
          border-bottom:1px solid #e5e7eb;
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap:15px;
        ">

          <div>

            <div style="
              font-size:10px;
              font-weight:800;
              letter-spacing:1px;
              color:#64748b;
            ">
              TFRS 16
            </div>

            <h2 style="
              margin:4px 0 0;
              font-size:21px;
            ">
              Toplu Muhasebe Fiş Merkezi
            </h2>

            <p style="
              margin:5px 0 0;
              color:#64748b;
              font-size:11px;
            ">
              Tüm aktif sözleşmeler için tek seferde
              muhasebe fişi oluşturun.
            </p>

          </div>


          <button
            id="closeBulkJournalModal"
            type="button"
            style="
              border:0;
              background:#f1f5f9;
              border-radius:8px;
              width:36px;
              height:36px;
              cursor:pointer;
              font-size:18px;
            "
          >
            ×
          </button>

        </div>


        <div style="
          padding:20px;
        ">

          <div style="
            display:grid;
            grid-template-columns:
              repeat(auto-fit,minmax(180px,1fr));
            gap:12px;
          ">

            <div style="
              background:#f8fafc;
              border:1px solid #e5e7eb;
              border-radius:10px;
              padding:14px;
            ">

              <label style="
                display:block;
                font-size:10px;
                font-weight:700;
                color:#64748b;
                margin-bottom:7px;
              ">
                Şirket
              </label>

              <select
                id="bulkJournalCompany"
                style="
                  width:100%;
                  padding:9px;
                  border:1px solid #d1d5db;
                  border-radius:7px;
                "
              >
                <option value="all">
                  Tüm Şirketler
                </option>
              </select>

            </div>


            <div style="
              background:#f8fafc;
              border:1px solid #e5e7eb;
              border-radius:10px;
              padding:14px;
            ">

              <label style="
                display:block;
                font-size:10px;
                font-weight:700;
                color:#64748b;
                margin-bottom:7px;
              ">
                Raporlama Yılı
              </label>

              <select
                id="bulkJournalYear"
                style="
                  width:100%;
                  padding:9px;
                  border:1px solid #d1d5db;
                  border-radius:7px;
                "
              ></select>

            </div>


            <div style="
              background:#f8fafc;
              border:1px solid #e5e7eb;
              border-radius:10px;
              padding:14px;
            ">

              <label style="
                display:block;
                font-size:10px;
                font-weight:700;
                color:#64748b;
                margin-bottom:7px;
              ">
                Fiş Periyodu
              </label>

              <select
                id="bulkJournalPeriod"
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
                  Yıllık / 12 Aylık
                </option>

                <option value="closing">
                  Yıllık Kapanış
                </option>

              </select>

            </div>


            <div style="
              background:#f8fafc;
              border:1px solid #e5e7eb;
              border-radius:10px;
              padding:14px;
            ">

              <label style="
                display:block;
                font-size:10px;
                font-weight:700;
                color:#64748b;
                margin-bottom:7px;
              ">
                Ay / Çeyrek
              </label>

              <select
                id="bulkJournalMonth"
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

          </div>


          <div style="
            margin-top:14px;
            padding:12px 14px;
            background:#eff6ff;
            border:1px solid #bfdbfe;
            color:#1e40af;
            border-radius:9px;
            font-size:11px;
            line-height:1.5;
          ">

            <strong>Toplu işlem mantığı:</strong>

            Seçilen kriterlere uyan tüm aktif sözleşmeler
            tek seferde hesaplanır. Her sözleşme ayrı
            fiş numarasıyla oluşturulur ve Borç / Alacak
            dengesi kontrol edilir.

          </div>


          <div style="
            display:flex;
            gap:10px;
            flex-wrap:wrap;
            margin-top:15px;
          ">

            <button
              id="generateBulkJournals"
              type="button"
              class="primary-button"
              style="
                min-height:42px;
                padding:0 18px;
              "
            >
              Toplu Fişleri Oluştur
            </button>


            <button
              id="exportBulkJournals"
              type="button"
              style="
                min-height:42px;
                padding:0 18px;
                border:1px solid #cbd5e1;
                background:white;
                border-radius:8px;
                cursor:pointer;
              "
              disabled
            >
              Excel'e Aktar
            </button>

          </div>


          <div
            id="bulkJournalStatus"
            style="
              margin-top:14px;
            "
          ></div>


          <div
            id="bulkJournalPreview"
            style="
              margin-top:16px;
            "
          ></div>

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

  }


  /*
  ============================================================
  BULK JOURNAL COMPANIES
  ============================================================
  */

  function populateBulkJournalCompanies() {

    const select =
      document.getElementById(
        "bulkJournalCompany"
      );

    if (!select) {
      return;
    }


    const current =
      select.value ||
      "all";


    const companies =
      [
        ...new Set(
          contracts
            .filter(
              c =>
                c.status ===
                "active"
            )
            .map(
              c =>
                c.company
            )
            .filter(Boolean)
        )
      ].sort();


    select.innerHTML = `
      <option value="all">
        Tüm Şirketler
      </option>
    `;


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
      current === "all" ||
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
  BULK JOURNAL YEARS
  ============================================================
  */

  function populateBulkJournalYears() {

    const select =
      document.getElementById(
        "bulkJournalYear"
      );

    if (!select) {
      return;
    }


    const years = [];


    contracts.forEach(
      contract => {

        const start =
          parseDate(
            contract.startDate
          )?.getFullYear();

        const end =
          parseDate(
            contract.endDate
          )?.getFullYear();


        if (
          start &&
          end
        ) {

          for (
            let year = start;
            year <= end;
            year++
          ) {

            if (
              !years.includes(
                year
              )
            ) {

              years.push(
                year
              );

            }

          }

        }

      }
    );


    if (
      !years.length
    ) {

      years.push(
        new Date().getFullYear()
      );

    }


    years.sort(
      (
        a,
        b
      ) =>
        a - b
    );


    select.innerHTML =
      years.map(
        year => `
          <option value="${year}">
            ${year}
          </option>
        `
      ).join("");


    const currentYear =
      new Date().getFullYear();


    if (
      years.includes(
        currentYear
      )
    ) {

      select.value =
        currentYear;

    }

  }


  /*
  ============================================================
  BULK JOURNAL CALCULATION
  ============================================================
  */

  function getBulkPeriodRange(
    contract,
    year,
    period,
    month
  ) {

    const engine =
      calculateLease(
        contract
      );


    if (
      !engine.schedule.length
    ) {

      return null;

    }


    let startMonth;
    let endMonth;


    if (
      period === "monthly"
    ) {

      startMonth =
        month;

      endMonth =
        month;

    }


    else if (
      period === "quarterly"
    ) {

      const quarter =
        Math.ceil(
          month / 3
        );


      startMonth =
        (
          quarter - 1
        ) * 3 + 1;


      endMonth =
        quarter * 3;

    }


    else if (
      period === "annual"
    ) {

      startMonth = 1;

      endMonth = 12;

    }


    else {

      return null;

    }


    /*
    ----------------------------------------------------------
    IMPORTANT
    ----------------------------------------------------------
    Schedule is contract-relative.

    A contract starting in March 2026 has
    March 2026 = schedule month 1.

    Therefore calculate the relative schedule
    month from the actual reporting period.
    ----------------------------------------------------------
    */


    const contractStart =
      parseDate(
        contract.startDate
      );


    if (!contractStart) {
      return null;
    }


    const absolutePeriodStart =
      new Date(
        year,
        startMonth - 1,
        1
      );


    const relativeStart =
      (
        absolutePeriodStart.getFullYear() -
        contractStart.getFullYear()
      ) * 12
      +
      (
        absolutePeriodStart.getMonth() -
        contractStart.getMonth()
      )
      + 1;


    const absolutePeriodEnd =
      new Date(
        year,
        endMonth - 1,
        1
      );


    const relativeEnd =
      (
        absolutePeriodEnd.getFullYear() -
        contractStart.getFullYear()
      ) * 12
      +
      (
        absolutePeriodEnd.getMonth() -
        contractStart.getMonth()
      )
      + 1;


    return {

      startMonth:
        Math.max(
          1,
          relativeStart
        ),

      endMonth:
        Math.min(
          engine.schedule.length,
          relativeEnd
        ),

      calendarStartMonth:
        startMonth,

      calendarEndMonth:
        endMonth

    };

  }


  /*
  ============================================================
  GENERATE BULK JOURNALS
  ============================================================
  */

  function generateBulkJournals() {

    const company =
      document.getElementById(
        "bulkJournalCompany"
      )?.value ||
      "all";


    const year =
      Number(
        document.getElementById(
          "bulkJournalYear"
        )?.value
      );


    const period =
      document.getElementById(
        "bulkJournalPeriod"
      )?.value ||
      "monthly";


    const month =
      Number(
        document.getElementById(
          "bulkJournalMonth"
        )?.value
      );


    const activeContracts =
      contracts.filter(
        contract =>
          contract.status ===
          "active"
      );


    const selectedContracts =
      activeContracts.filter(
        contract =>
          company === "all" ||
          contract.company ===
            company
      );


    bulkJournalData = [];


    let sequence =
      1;


    selectedContracts.forEach(
      contract => {

        const range =
          getBulkPeriodRange(
            contract,
            year,
            period,
            month
          );


        if (
          period ===
          "closing"
        ) {

          const entries =
            generateReclassificationEntry(
              contract
            );


          if (
            entries.length
          ) {

            const totals =
              calculateJournalTotals(
                entries
              );


            bulkJournalData.push({

              journalNo:
                createJournalNumber(
                  year,
                  month,
                  sequence
                ),

              date:
                getPeriodEndDate(
                  year,
                  12
                ),

              description:
                `TFRS 16 ${year} Yıl Sonu Current / Non-current Kapanış Fişi - ${contract.id}`,

              contractId:
                contract.id,

              company:
                contract.company,

              supplier:
                contract.supplier,

              entries,

              debit:
                totals.debit,

              credit:
                totals.credit,

              difference:
                totals.difference,

              balanced:
                totals.balanced

            });


            sequence++;

          }


          return;

        }


        if (
          !range ||
          range.startMonth >
          range.endMonth
        ) {

          return;

        }


        const entries =
          getJournalForPeriod(
            contract,
            range.startMonth,
            range.endMonth
          );


        if (
          !entries.length
        ) {

          return;

        }


        const totals =
          calculateJournalTotals(
            entries
          );


        let journalDate =
          getPeriodEndDate(
            year,
            range.calendarEndMonth
          );


        let description = "";


        if (
          period ===
          "monthly"
        ) {

          description =
            `TFRS 16 ${getMonthName(
              month
            )} ${year} Muhasebe Fişi - ${contract.id}`;

        }

        else if (
          period ===
          "quarterly"
        ) {

          const quarter =
            Math.ceil(
              month / 3
            );


          description =
            `TFRS 16 ${year} ${quarter}. Çeyrek Muhasebe Fişi - ${contract.id}`;

        }

        else {

          description =
            `TFRS 16 ${year} Yıllık Toplu Muhasebe Fişi - ${contract.id}`;

        }


        bulkJournalData.push({

          journalNo:
            createJournalNumber(
              year,
              range.calendarEndMonth,
              sequence
            ),

          date:
            journalDate,

          description,

          contractId:
            contract.id,

          company:
            contract.company,

          supplier:
            contract.supplier,

          entries,

          debit:
            totals.debit,

          credit:
            totals.credit,

          difference:
            totals.difference,

          balanced:
            totals.balanced

        });


        sequence++;

      }
    );


    renderBulkJournalPreview();

  }


  function createJournalNumber(
    year,
    month,
    sequence
  ) {

    return `TFRS16-${year}-${String(
      month
    ).padStart(2, "0")}-${String(
      sequence
    ).padStart(4, "0")}`;

  }


  /*
  ============================================================
  BULK JOURNAL PREVIEW
  ============================================================
  */

  function renderBulkJournalPreview() {

    const preview =
      document.getElementById(
        "bulkJournalPreview"
      );


    const exportButton =
      document.getElementById(
        "exportBulkJournals"
      );


    if (!preview) {
      return;
    }


    if (
      !bulkJournalData.length
    ) {

      preview.innerHTML = `

        <div style="
          padding:16px;
          background:#fff7ed;
          border:1px solid #fed7aa;
          color:#9a3412;
          border-radius:9px;
          font-size:11px;
        ">
          Seçilen dönem için fiş üretilebilecek
          aktif sözleşme bulunamadı.
        </div>

      `;


      if (exportButton) {
        exportButton.disabled =
          true;
      }


      showBulkJournalStatus(
        "Fiş oluşturulamadı veya seçilen dönemde kayıt bulunamadı.",
        "warning"
      );


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


    if (exportButton) {

      exportButton.disabled =
        unbalanced.length > 0;

    }


    const totalDebit =
      bulkJournalData.reduce(
        (
          total,
          item
        ) =>
          total +
          item.debit,
        0
      );


    const totalCredit =
      bulkJournalData.reduce(
        (
          total,
          item
        ) =>
          total +
          item.credit,
        0
      );


    preview.innerHTML = `

      <div style="
        display:grid;
        grid-template-columns:
          repeat(4,1fr);
        gap:8px;
        margin-bottom:14px;
      ">

        <div style="
          padding:12px;
          background:#f8fafc;
          border:1px solid #e5e7eb;
          border-radius:9px;
        ">
          <div style="
            font-size:10px;
            color:#64748b;
          ">
            Sözleşme / Fiş
          </div>
          <strong>
            ${bulkJournalData.length}
          </strong>
        </div>


        <div style="
          padding:12px;
          background:#ecfdf5;
          border:1px solid #bbf7d0;
          color:#166534;
          border-radius:9px;
        ">
          <div style="
            font-size:10px;
          ">
            Dengeli
          </div>
          <strong>
            ${balanced.length}
          </strong>
        </div>


        <div style="
          padding:12px;
          background:#fef2f2;
          border:1px solid #fecaca;
          color:#991b1b;
          border-radius:9px;
        ">
          <div style="
            font-size:10px;
          ">
            Dengesiz
          </div>
          <strong>
            ${unbalanced.length}
          </strong>
        </div>


        <div style="
          padding:12px;
          background:#f8fafc;
          border:1px solid #e5e7eb;
          border-radius:9px;
        ">
          <div style="
            font-size:10px;
            color:#64748b;
          ">
            Toplam Borç
          </div>
          <strong>
            ${formatCurrency(
              totalDebit
            )}
          </strong>
        </div>

      </div>


      <div style="
        border:1px solid #e5e7eb;
        border-radius:10px;
        overflow:auto;
      ">

        <table style="
          width:100%;
          border-collapse:collapse;
          min-width:1000px;
        ">

          <thead>

            <tr>

              <th style="padding:10px;">
                Fiş No
              </th>

              <th style="padding:10px;">
                Tarih
              </th>

              <th style="padding:10px;">
                Sözleşme
              </th>

              <th style="padding:10px;">
                Şirket
              </th>

              <th style="
                padding:10px;
                text-align:right;
              ">
                Borç
              </th>

              <th style="
                padding:10px;
                text-align:right;
              ">
                Alacak
              </th>

              <th style="padding:10px;">
                Kontrol
              </th>

            </tr>

          </thead>


          <tbody>

            ${bulkJournalData.map(
              item => `

                <tr>

                  <td style="
                    padding:10px;
                    border-top:1px solid #edf0f4;
                    font-weight:700;
                  ">
                    ${escapeHtml(
                      item.journalNo
                    )}
                  </td>


                  <td style="
                    padding:10px;
                    border-top:1px solid #edf0f4;
                  ">
                    ${formatDate(
                      item.date
                    )}
                  </td>


                  <td style="
                    padding:10px;
                    border-top:1px solid #edf0f4;
                  ">
                    ${escapeHtml(
                      item.contractId
                    )}
                  </td>


                  <td style="
                    padding:10px;
                    border-top:1px solid #edf0f4;
                  ">
                    ${escapeHtml(
                      item.company
                    )}
                  </td>


                  <td style="
                    padding:10px;
                    text-align:right;
                    border-top:1px solid #edf0f4;
                  ">
                    ${formatCurrency(
                      item.debit
                    )}
                  </td>


                  <td style="
                    padding:10px;
                    text-align:right;
                    border-top:1px solid #edf0f4;
                  ">
                    ${formatCurrency(
                      item.credit
                    )}
                  </td>


                  <td style="
                    padding:10px;
                    border-top:1px solid #edf0f4;
                    color:${
                      item.balanced
                        ? "#166534"
                        : "#991b1b"
                    };
                    font-weight:800;
                  ">
                    ${
                      item.balanced
                        ? "✓ Dengeli"
                        : `⚠ ${formatCurrency(
                            item.difference
                          )}`
                    }
                  </td>

                </tr>

              `
            ).join("")}

          </tbody>


          <tfoot>

            <tr>

              <td
                colspan="4"
                style="
                  padding:11px;
                  border-top:2px solid #cbd5e1;
                  font-weight:800;
                "
              >
                PORTFÖY TOPLAMI
              </td>


              <td style="
                padding:11px;
                text-align:right;
                border-top:2px solid #cbd5e1;
                font-weight:800;
              ">
                ${formatCurrency(
                  totalDebit
                )}
              </td>


              <td style="
                padding:11px;
                text-align:right;
                border-top:2px solid #cbd5e1;
                font-weight:800;
              ">
                ${formatCurrency(
                  totalCredit
                )}
              </td>


              <td style="
                padding:11px;
                border-top:2px solid #cbd5e1;
                font-weight:800;
              ">
                ${
                  Math.abs(
                    totalDebit -
                    totalCredit
                  ) < 0.01
                    ? "✓ Dengeli"
                    : "⚠ Kontrol"
                }
              </td>

            </tr>

          </tfoot>

        </table>

      </div>


      <div style="
        margin-top:14px;
        padding:12px 14px;
        background:${
          unbalanced.length
            ? "#fef2f2"
            : "#ecfdf5"
        };
        border:1px solid ${
          unbalanced.length
            ? "#fecaca"
            : "#bbf7d0"
        };
        color:${
          unbalanced.length
            ? "#991b1b"
            : "#166534"
        };
        border-radius:9px;
        font-size:11px;
        line-height:1.5;
      ">

        ${
          unbalanced.length
            ? `
              <strong>
                ⚠ Excel aktarımı kilitlendi.
              </strong>

              ${unbalanced.length}
              fişte Borç / Alacak kontrolü başarısız.
              ERP'ye aktarım öncesinde bu kayıtlar düzeltilmelidir.
            `
            : `
              <strong>
                ✓ İç kontrol başarılı.
              </strong>

              Tüm fişler Borç / Alacak açısından dengeli.
              Excel ERP aktarımına hazır.
            `
        }

      </div>

    `;


    showBulkJournalStatus(
      `${bulkJournalData.length} sözleşme için fiş oluşturuldu. ${balanced.length} dengeli, ${unbalanced.length} kontrol gerektiriyor.`,
      unbalanced.length
        ? "error"
        : "success"
    );

  }


  /*
  ============================================================
  BULK STATUS
  ============================================================
  */

  function showBulkJournalStatus(
    message,
    type = "info"
  ) {

    const element =
      document.getElementById(
        "bulkJournalStatus"
      );


    if (!element) {
      return;
    }


    const styles = {

      success: {
        background:
          "#ecfdf5",
        color:
          "#166534",
        border:
          "#bbf7d0"
      },

      warning: {
        background:
          "#fff7ed",
        color:
          "#9a3412",
        border:
          "#fed7aa"
      },

      error: {
        background:
          "#fef2f2",
        color:
          "#991b1b",
        border:
          "#fecaca"
      },

      info: {
        background:
          "#eff6ff",
        color:
          "#1d4ed8",
        border:
          "#bfdbfe"
      }

    };


    const style =
      styles[type] ||
      styles.info;


    element.innerHTML = `

      <div style="
        padding:10px 12px;
        background:${style.background};
        color:${style.color};
        border:1px solid ${style.border};
        border-radius:8px;
      ">
        ${escapeHtml(
          message
        )}
      </div>

    `;

  }


  /*
  ============================================================
  BULK JOURNAL EXCEL EXPORT
  ============================================================
  */

  function exportBulkJournals() {

    if (
      !bulkJournalData.length
    ) {

      showBulkJournalStatus(
        "Önce toplu fişleri oluşturun.",
        "warning"
      );

      return;

    }


    const unbalanced =
      bulkJournalData.filter(
        item =>
          !item.balanced
      );


    if (
      unbalanced.length
    ) {

      showBulkJournalStatus(
        "Dengesiz fişler bulunduğu için Excel aktarımı engellendi.",
        "error"
      );

      return;

    }


    const rows = [

      [
        "Fiş No",
        "Fiş Tarihi",
        "Açıklama",
        "Sözleşme ID",
        "Şirket",
        "Tedarikçi",
        "Hesap",
        "Borç",
        "Alacak"
      ]

    ];


    bulkJournalData.forEach(
      journal => {

        journal.entries.forEach(
          entry => {

            rows.push([

              journal.journalNo,

              journal.date,

              journal.description,

              journal.contractId,

              journal.company,

              journal.supplier,

              entry.account,

              Number(
                entry.debit || 0
              ),

              Number(
                entry.credit || 0
              )

            ]);

          }
        );

      }
    );


    /*
    ----------------------------------------------------------
    XLSX
    ----------------------------------------------------------
    */

    if (
      typeof XLSX !==
      "undefined"
    ) {

      try {

        const worksheet =
          XLSX.utils.aoa_to_sheet(
            rows
          );


        worksheet["!cols"] = [

          { wch: 22 },
          { wch: 15 },
          { wch: 55 },
          { wch: 18 },
          { wch: 22 },
          { wch: 25 },
          { wch: 40 },
          { wch: 18 },
          { wch: 18 }

        ];


        const workbook =
          XLSX.utils.book_new();


        XLSX.utils.book_append_sheet(
          workbook,
          worksheet,
          "Muhasebe Fişleri"
        );


        XLSX.writeFile(
          workbook,
          `TFRS16_Toplu_Muhasebe_Fisleri_${new Date().getTime()}.xlsx`
        );


        showBulkJournalStatus(
          "Toplu muhasebe fişleri Excel'e aktarıldı.",
          "success"
        );


        return;

      } catch (error) {

        console.error(
          "Bulk journal XLSX export error:",
          error
        );

      }

    }


    /*
    ----------------------------------------------------------
    CSV FALLBACK
    ----------------------------------------------------------
    */

    const csv =
      rows
        .map(
          row =>
            row
              .map(
                cell =>
                  `"${String(cell)
                    .replaceAll(
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
      "TFRS16_Toplu_Muhasebe_Fisleri.csv";


    document.body.appendChild(
      link
    );

    link.click();

    link.remove();

    URL.revokeObjectURL(
      url
    );


    showBulkJournalStatus(
      "Excel modülü bulunamadı. CSV dosyası oluşturuldu.",
      "warning"
    );

  }


  /*
  ============================================================
  BULK JOURNAL BUTTON
  ============================================================
  */

  document.addEventListener(
    "click",
    event => {

      const button =
        event.target.closest(
          "#bulkJournalButton"
        );


      if (
        button
      ) {

        openBulkJournalModal();

      }

    }
  );


  /*
  ============================================================
  DETAIL MODAL
  ============================================================
  */

  function openDetail(
    id
  ) {

    const contract =
      contracts.find(
        item =>
          item.id === id
      );


    if (!contract) {
      return;
    }


    selectedContractId =
      id;


    const engine =
      calculateLease(
        contract
      );


    const current =
      calculateCurrentLiability(
        contract
      );


    const nonCurrent =
      calculateNonCurrentLiability(
        contract
      );


    const next12 =
      calculateNext12Months(
        contract
      );


    const renewal =
      isRenewalWithin90Days(
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
            <span>Şirket</span>
            <strong>
              ${escapeHtml(
                contract.company
              )}
            </strong>
          </div>


          <div class="detail-item">
            <span>Tedarikçi</span>
            <strong>
              ${escapeHtml(
                contract.supplier
              )}
            </strong>
          </div>


          <div class="detail-item">
            <span>Aylık Kira</span>
            <strong>
              ${formatCurrency(
                contract.monthlyPayment
              )}
            </strong>
          </div>


          <div class="detail-item">
            <span>Kira Süresi</span>
            <strong>
              ${engine.months} Ay
            </strong>
          </div>


          <div class="detail-item">
            <span>İskonto Oranı</span>
            <strong>
              %${contract.discountRate}
            </strong>
          </div>


          <div class="detail-item">
            <span>İlk Kira Yükümlülüğü</span>
            <strong>
              ${formatCurrency(
                engine.liability
              )}
            </strong>
          </div>


          <div class="detail-item">
            <span>ROU Varlığı</span>
            <strong>
              ${formatCurrency(
                engine.rouAssets
              )}
            </strong>
          </div>


          <div class="detail-item">
            <span>Aylık Amortisman</span>
            <strong>
              ${formatCurrency(
                engine.depreciation
              )}
            </strong>
          </div>


          <div class="detail-item">
            <span>Aylık Faiz</span>
            <strong>
              ${formatCurrency(
                engine.monthlyInterest
              )}
            </strong>
          </div>


          <div class="detail-item">
            <span>Current Liability</span>
            <strong>
              ${formatCurrency(
                current
              )}
            </strong>
          </div>


          <div class="detail-item">
            <span>Non-current Liability</span>
            <strong>
              ${formatCurrency(
                nonCurrent
              )}
            </strong>
          </div>


          <div class="detail-item">
            <span>Önümüzdeki 12 Ay</span>
            <strong>
              ${formatCurrency(
                next12
              )}
            </strong>
          </div>


          <div class="detail-item">
            <span>Başlangıç</span>
            <strong>
              ${formatDate(
                contract.startDate
              )}
            </strong>
          </div>


          <div class="detail-item">
            <span>Bitiş</span>
            <strong>
              ${formatDate(
                contract.endDate
              )}
            </strong>
          </div>


          <div class="detail-item">
            <span>Yenileme</span>
            <strong class="${
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

            </strong>
          </div>


          <div class="detail-item">
            <span>Modification</span>
            <strong>
              ${
                contract.modification
                  ? "İnceleme gerekli"
                  : "Yok"
              }
            </strong>
          </div>

        </div>


        <div class="insight-panel">

          <div class="insight-icon">
            !
          </div>

          <div>

            <strong>
              CFO Finansal Etki
            </strong>

            <p>

              İlk ölçüm:

              <strong>
                ${formatCurrency(
                  engine.liability
                )}
              </strong>

              · ROU:

              <strong>
                ${formatCurrency(
                  engine.rouAssets
                )}
              </strong>

              · Aylık faiz:

              <strong>
                ${formatCurrency(
                  engine.monthlyInterest
                )}
              </strong>

              · Aylık amortisman:

              <strong>
                ${formatCurrency(
                  engine.depreciation
                )}
              </strong>

            </p>

          </div>

        </div>


        <div style="
          margin-top:22px;
        ">

          <h3 style="
            margin:0 0 12px;
            font-size:14px;
          ">
            İlk 12 Aylık Ödeme Planı
          </h3>


          <div style="
            overflow-x:auto;
          ">

            <table style="
              width:100%;
              border-collapse:collapse;
              min-width:750px;
            ">

              <thead>

                <tr>

                  <th>Ay</th>
                  <th>Açılış</th>
                  <th>Ödeme</th>
                  <th>Faiz</th>
                  <th>Anapara</th>
                  <th>Kapanış</th>
                  <th>Amortisman</th>

                </tr>

              </thead>


              <tbody>

                ${engine.schedule
                  .slice(0, 12)
                  .map(
                    item => `

                      <tr>

                        <td>
                          ${item.period}
                        </td>

                        <td>
                          ${formatCurrency(
                            item.openingLiability
                          )}
                        </td>

                        <td>
                          ${formatCurrency(
                            item.payment
                          )}
                        </td>

                        <td>
                          ${formatCurrency(
                            item.interest
                          )}
                        </td>

                        <td>
                          ${formatCurrency(
                            item.principal
                          )}
                        </td>

                        <td>
                          ${formatCurrency(
                            item.closingLiability
                          )}
                        </td>

                        <td>
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


    modal
      ?.classList.remove(
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

      },
      0
    );

  }


  /*
  ============================================================
  CLOSE DETAIL
  ============================================================
  */

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
  DELETE
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
          window.confirm(
            `"${contract.id}" sözleşmesini silmek istediğinize emin misiniz?`
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


  /*
  ============================================================
  FILTERS
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
  BULK IMPORT
  ============================================================
  */

  function openBulkImportModal() {

    const modal =
      document.getElementById(
        "bulkImportModal"
      );

    if (!modal) {
      return;
    }


    bulkImportData = [];


    const fileInput =
      document.getElementById(
        "bulkFileInput"
      );

    const preview =
      document.getElementById(
        "bulkPreview"
      );

    const status =
      document.getElementById(
        "bulkImportStatus"
      );

    const confirmButton =
      document.getElementById(
        "confirmBulkImport"
      );


    if (fileInput) {
      fileInput.value = "";
    }

    if (preview) {
      preview.innerHTML = "";
    }

    if (status) {
      status.innerHTML = "";
    }

    if (confirmButton) {
      confirmButton.disabled =
        true;
    }


    modal.classList.remove(
      "hidden"
    );

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


  /*
  ============================================================
  DOWNLOAD EXCEL TEMPLATE
  ============================================================
  */

  document
    .getElementById(
      "downloadTemplateButton"
    )
    ?.addEventListener(
      "click",
      downloadExcelTemplate
    );


  function downloadExcelTemplate() {

    const headers = [

      "Contract ID",
      "Company",
      "Supplier",
      "Monthly Payment",
      "Start Date",
      "End Date",
      "Discount Rate",
      "Renewal Date",
      "Status",
      "Modification"

    ];


    const example = [

      "LEASE-101",
      "GK Holding",
      "ABC Plaza",
      125000,
      "2026-01-01",
      "2030-12-31",
      18,
      "2030-09-30",
      "active",
      "false"

    ];


    if (
      typeof XLSX !==
      "undefined"
    ) {

      try {

        const worksheet =
          XLSX.utils.aoa_to_sheet([
            headers,
            example
          ]);


        worksheet["!cols"] = [

          { wch: 18 },
          { wch: 20 },
          { wch: 25 },
          { wch: 18 },
          { wch: 15 },
          { wch: 15 },
          { wch: 16 },
          { wch: 18 },
          { wch: 12 },
          { wch: 15 }

        ];


        const workbook =
          XLSX.utils.book_new();


        XLSX.utils.book_append_sheet(
          workbook,
          worksheet,
          "Contracts"
        );


        XLSX.writeFile(
          workbook,
          "TFRS16_Sozlesme_Portfoyu_Sablon.xlsx"
        );


        showBulkStatus(
          "Excel şablonu başarıyla indirildi.",
          "success"
        );


        return;

      } catch (error) {

        console.error(
          "XLSX template error:",
          error
        );

      }

    }


    const csvRows = [
      headers,
      example
    ];


    const csv =
      csvRows
        .map(
          row =>
            row
              .map(
                cell =>
                  `"${String(cell)
                    .replaceAll(
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
          "\uFEFF" + csv
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
      "TFRS16_Sozlesme_Portfoyu_Sablon.csv";


    document.body.appendChild(
      link
    );

    link.click();

    link.remove();

    URL.revokeObjectURL(
      url
    );


    showBulkStatus(
      "Excel modülü bulunamadı. CSV şablonu indirildi; bu dosyayı Excel ile açabilirsiniz.",
      "warning"
    );

  }


  /*
  ============================================================
  FILE INPUT
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


  async function handleBulkFile(
    event
  ) {

    const file =
      event.target.files?.[0];


    if (!file) {
      return;
    }


    bulkImportData = [];


    showBulkStatus(
      "Dosya okunuyor...",
      "info"
    );


    try {

      const extension =
        file.name
          .split(".")
          .pop()
          .toLowerCase();


      if (
        extension === "csv"
      ) {

        const text =
          await file.text();

        processCSV(
          text
        );

        return;

      }


      if (
        extension === "xlsx" ||
        extension === "xls"
      ) {

        if (
          typeof XLSX ===
          "undefined"
        ) {

          showBulkStatus(
            "Excel modülü yüklenemedi. Lütfen internet bağlantınızı kontrol edin veya CSV dosyası kullanın.",
            "error"
          );

          return;

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
              defval: "",
              raw: false
            }
          );


        processImportedRows(
          rows
        );

        return;

      }


      showBulkStatus(
        "Desteklenmeyen dosya formatı.",
        "error"
      );

    } catch (error) {

      console.error(
        "Bulk import error:",
        error
      );


      showBulkStatus(
        "Dosya okunurken hata oluştu. Şablon formatını kontrol edin.",
        "error"
      );

    }

  }


  /*
  ============================================================
  CSV PARSER
  ============================================================
  */

  function processCSV(
    text
  ) {

    const lines =
      text
        .replace(
          /^\uFEFF/,
          ""
        )
        .split(/\r?\n/)
        .filter(
          line =>
            line.trim() !== ""
        );


    if (
      lines.length <
      2
    ) {

      showBulkStatus(
        "CSV dosyasında veri bulunamadı.",
        "error"
      );

      return;

    }


    const delimiter =
      lines[0].includes(";")
        ? ";"
        : ",";


    const headers =
      parseCSVLine(
        lines[0],
        delimiter
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
          delimiter
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
            values[index] ??
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
    delimiter
  ) {

    const result = [];

    let current = "";

    let insideQuotes =
      false;


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
          insideQuotes &&
          line[i + 1] === '"'
        ) {

          current += '"';

          i++;

        } else {

          insideQuotes =
            !insideQuotes;

        }

      }

      else if (
        char === delimiter &&
        !insideQuotes
      ) {

        result.push(
          current.trim()
        );

        current = "";

      }

      else {

        current += char;

      }

    }


    result.push(
      current.trim()
    );


    return result;

  }


  /*
  ============================================================
  HEADER NORMALIZATION
  ============================================================
  */

  function normalizeHeader(
    value
  ) {

    return String(
      value ?? ""
    )
      .trim()
      .toLowerCase()
      .replaceAll(
        "ı",
        "i"
      )
      .replaceAll(
        "ş",
        "s"
      )
      .replaceAll(
        "ğ",
        "g"
      )
      .replaceAll(
        "ü",
        "u"
      )
      .replaceAll(
        "ö",
        "o"
      )
      .replaceAll(
        "ç",
        "c"
      )
      .replace(
        /[^a-z0-9]/g,
        ""
      );

  }


  function getRowValue(
    row,
    possibleHeaders
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


      for (
        const candidate of possibleHeaders
      ) {

        if (
          normalized ===
          normalizeHeader(
            candidate
          )
        ) {

          return row[key];

        }

      }

    }


    return "";

  }


  /*
  ============================================================
  IMPORT PROCESSING
  ============================================================
  */

  function processImportedRows(
    rows
  ) {

    if (
      !Array.isArray(rows) ||
      !rows.length
    ) {

      showBulkStatus(
        "Dosyada kayıt bulunamadı.",
        "error"
      );

      return;

    }


    const results = [];


    rows.forEach(
      (
        row,
        index
      ) => {

        const contract =
          normalizeImportedContract(
            row
          );


        const validation =
          validateImportedContract(
            contract
          );


        const existing =
          contracts.some(
            item =>
              String(
                item.id
              ).toLowerCase() ===
              String(
                contract.id
              ).toLowerCase()
          );


        results.push({

          row:
            index + 2,

          contract,

          errors:
            validation.errors,

          duplicate:
            existing

        });

      }
    );


    bulkImportData =
      results;


    renderBulkPreview();

  }


  /*
  ============================================================
  NORMALIZE CONTRACT
  ============================================================
  */

  function normalizeImportedContract(
    row
  ) {

    const id =
      String(
        getRowValue(
          row,
          [
            "Contract ID",
            "ContractID",
            "Sözleşme ID",
            "SözleşmeID",
            "ID"
          ]
        ) || ""
      ).trim();


    const company =
      String(
        getRowValue(
          row,
          [
            "Company",
            "Şirket",
            "Sirket"
          ]
        ) || ""
      ).trim();


    const supplier =
      String(
        getRowValue(
          row,
          [
            "Supplier",
            "Tedarikçi",
            "Tedarikci"
          ]
        ) || ""
      ).trim();


    const paymentRaw =
      getRowValue(
        row,
        [
          "Monthly Payment",
          "MonthlyPayment",
          "Aylık Kira",
          "AylıkKira"
        ]
      );


    const discountRaw =
      getRowValue(
        row,
        [
          "Discount Rate",
          "DiscountRate",
          "İskonto Oranı",
          "Iskonto Orani",
          "IskontoOrani"
        ]
      );


    const statusRaw =
      String(
        getRowValue(
          row,
          [
            "Status",
            "Durum"
          ]
        ) || "active"
      )
      .trim()
      .toLowerCase();


    const modificationRaw =
      String(
        getRowValue(
          row,
          [
            "Modification",
            "Modifikasyon"
          ]
        ) || "false"
      )
      .trim()
      .toLowerCase();


    return {

      id,

      company,

      supplier,

      monthlyPayment:
        parseNumber(
          paymentRaw
        ),

      startDate:
        normalizeDate(
          getRowValue(
            row,
            [
              "Start Date",
              "StartDate",
              "Başlangıç Tarihi",
              "Baslangic Tarihi"
            ]
          )
        ),

      endDate:
        normalizeDate(
          getRowValue(
            row,
            [
              "End Date",
              "EndDate",
              "Bitiş Tarihi",
              "Bitis Tarihi"
            ]
          )
        ),

      discountRate:
        parseNumber(
          discountRaw
        ),

      renewalDate:
        normalizeDate(
          getRowValue(
            row,
            [
              "Renewal Date",
              "RenewalDate",
              "Yenileme Tarihi",
              "YenilemeTarihi"
            ]
          )
        ),

      status:
        (
          statusRaw === "inactive" ||
          statusRaw === "pasif"
        )
          ? "inactive"
          : "active",

      modification:
        (
          modificationRaw === "true" ||
          modificationRaw === "1" ||
          modificationRaw === "yes" ||
          modificationRaw === "evet"
        )

    };

  }


  /*
  ============================================================
  NUMBER PARSER
  ============================================================
  */

  function parseNumber(
    value
  ) {

    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {

      return 0;

    }


    if (
      typeof value ===
      "number"
    ) {

      return value;

    }


    let text =
      String(value)
        .trim()
        .replaceAll(
          "₺",
          ""
        )
        .replaceAll(
          " ",
          ""
        );


    if (
      text.includes(",") &&
      text.includes(".")
    ) {

      if (
        text.lastIndexOf(",") >
        text.lastIndexOf(".")
      ) {

        text =
          text
            .replaceAll(
              ".",
              ""
            )
            .replace(
              ",",
              "."
            );

      } else {

        text =
          text.replaceAll(
            ",",
            ""
          );

      }

    }

    else if (
      text.includes(",")
    ) {

      text =
        text.replace(
          ",",
          "."
        );

    }


    const number =
      Number(
        text
      );


    return isNaN(number)
      ? 0
      : number;

  }


  /*
  ============================================================
  VALIDATION
  ============================================================
  */

  function validateImportedContract(
    contract
  ) {

    const errors = [];


    if (
      !contract.id
    ) {

      errors.push(
        "Contract ID boş"
      );

    }


    if (
      !contract.company
    ) {

      errors.push(
        "Şirket boş"
      );

    }


    if (
      !contract.supplier
    ) {

      errors.push(
        "Tedarikçi boş"
      );

    }


    if (
      contract.monthlyPayment <=
      0
    ) {

      errors.push(
        "Aylık kira geçersiz"
      );

    }


    if (
      !contract.startDate
    ) {

      errors.push(
        "Başlangıç tarihi geçersiz"
      );

    }


    if (
      !contract.endDate
    ) {

      errors.push(
        "Bitiş tarihi geçersiz"
      );

    }


    if (
      contract.startDate &&
      contract.endDate
    ) {

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
        end < start
      ) {

        errors.push(
          "Bitiş tarihi başlangıçtan önce"
        );

      }

    }


    if (
      contract.discountRate <
      0
    ) {

      errors.push(
        "İskonto oranı geçersiz"
      );

    }


    return {
      errors
    };

  }


  /*
  ============================================================
  BULK PREVIEW
  ============================================================
  */

  function renderBulkPreview() {

    const preview =
      document.getElementById(
        "bulkPreview"
      );


    const confirmButton =
      document.getElementById(
        "confirmBulkImport"
      );


    if (!preview) {
      return;
    }


    if (
      !bulkImportData.length
    ) {

      preview.innerHTML = "";

      if (confirmButton) {
        confirmButton.disabled =
          true;
      }

      return;

    }


    const valid =
      bulkImportData.filter(
        item =>
          item.errors.length === 0 &&
          !item.duplicate
      );


    const errors =
      bulkImportData.filter(
        item =>
          item.errors.length > 0
      );


    const duplicates =
      bulkImportData.filter(
        item =>
          item.errors.length === 0 &&
          item.duplicate
      );


    if (confirmButton) {

      confirmButton.disabled =
        valid.length === 0;

    }


    preview.innerHTML = `

      <div style="
        display:grid;
        grid-template-columns:
          repeat(3,1fr);
        gap:8px;
        margin-bottom:12px;
      ">

        <div style="
          padding:11px;
          border-radius:8px;
          background:#ecfdf5;
          color:#166534;
          font-size:11px;
        ">
          <strong>${valid.length}</strong>
          Geçerli
        </div>


        <div style="
          padding:11px;
          border-radius:8px;
          background:#fff7ed;
          color:#9a3412;
          font-size:11px;
        ">
          <strong>${duplicates.length}</strong>
          Mükerrer
        </div>


        <div style="
          padding:11px;
          border-radius:8px;
          background:#fef2f2;
          color:#991b1b;
          font-size:11px;
        ">
          <strong>${errors.length}</strong>
          Hatalı
        </div>

      </div>


      <div style="
        border:1px solid #e5e7eb;
        border-radius:9px;
        overflow:auto;
      ">

        <table style="
          width:100%;
          border-collapse:collapse;
          min-width:700px;
        ">

          <thead>

            <tr>

              <th style="padding:9px;">
                Satır
              </th>

              <th style="padding:9px;">
                Contract ID
              </th>

              <th style="padding:9px;">
                Şirket
              </th>

              <th style="padding:9px;">
                Aylık Kira
              </th>

              <th style="padding:9px;">
                Durum
              </th>

            </tr>

          </thead>


          <tbody>

            ${bulkImportData.map(
              item => {

                let state =
                  "Geçerli";

                let stateColor =
                  "#166534";

                if (
                  item.errors.length
                ) {

                  state =
                    item.errors.join(
                      ", "
                    );

                  stateColor =
                    "#991b1b";

                }

                else if (
                  item.duplicate
                ) {

                  state =
                    "Mükerrer kayıt";

                  stateColor =
                    "#9a3412";

                }


                return `

                  <tr>

                    <td style="
                      padding:9px;
                      border-top:1px solid #edf0f4;
                    ">
                      ${item.row}
                    </td>


                    <td style="
                      padding:9px;
                      border-top:1px solid #edf0f4;
                    ">
                      ${escapeHtml(
                        item.contract.id
                      )}
                    </td>


                    <td style="
                      padding:9px;
                      border-top:1px solid #edf0f4;
                    ">
                      ${escapeHtml(
                        item.contract.company
                      )}
                    </td>


                    <td style="
                      padding:9px;
                      border-top:1px solid #edf0f4;
                    ">
                      ${formatCurrency(
                        item.contract.monthlyPayment
                      )}
                    </td>


                    <td style="
                      padding:9px;
                      border-top:1px solid #edf0f4;
                      color:${stateColor};
                      font-weight:700;
                    ">
                      ${escapeHtml(
                        state
                      )}
                    </td>

                  </tr>

                `;

              }
            ).join("")}

          </tbody>

        </table>

      </div>

    `;


    showBulkStatus(
      `${bulkImportData.length} kayıt analiz edildi. ${valid.length} kayıt aktarılmaya hazır.`,
      valid.length > 0
        ? "success"
        : "warning"
    );

  }


  /*
  ============================================================
  CONFIRM BULK IMPORT
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

    const valid =
      bulkImportData.filter(
        item =>
          item.errors.length === 0 &&
          !item.duplicate
      );


    if (
      !valid.length
    ) {

      showBulkStatus(
        "Aktarılacak geçerli kayıt bulunamadı.",
        "error"
      );

      return;

    }


    const newContracts =
      valid.map(
        item =>
          item.contract
      );


    contracts = [
      ...contracts,
      ...newContracts
    ];


    saveContracts(
      contracts
    );


    const importedCount =
      newContracts.length;


    bulkImportData = [];


    refresh();


    showBulkStatus(
      `${importedCount} sözleşme başarıyla portföye aktarıldı.`,
      "success"
    );


    const preview =
      document.getElementById(
        "bulkPreview"
      );


    if (preview) {

      preview.innerHTML = `

        <div style="
          padding:18px;
          background:#ecfdf5;
          border:1px solid #bbf7d0;
          border-radius:10px;
          color:#166534;
          font-size:12px;
        ">

          <strong>
            ✓ Aktarım tamamlandı
          </strong>

          <div style="
            margin-top:5px;
            font-size:11px;
          ">
            ${importedCount}
            yeni sözleşme portföye eklendi.
          </div>

        </div>

      `;

    }


    const confirmButton =
      document.getElementById(
        "confirmBulkImport"
      );


    if (confirmButton) {
      confirmButton.disabled =
        true;
    }


    setTimeout(
      closeBulkImportModal,
      1200
    );

  }


  /*
  ============================================================
  BULK STATUS
  ============================================================
  */

  function showBulkStatus(
    message,
    type = "info"
  ) {

    const element =
      document.getElementById(
        "bulkImportStatus"
      );


    if (!element) {
      return;
    }


    const styles = {

      success: {
        background:
          "#ecfdf5",
        color:
          "#166534",
        border:
          "#bbf7d0"
      },

      warning: {
        background:
          "#fff7ed",
        color:
          "#9a3412",
        border:
          "#fed7aa"
      },

      error: {
        background:
          "#fef2f2",
        color:
          "#991b1b",
        border:
          "#fecaca"
      },

      info: {
        background:
          "#eff6ff",
        color:
          "#1d4ed8",
        border:
          "#bfdbfe"
      }

    };


    const style =
      styles[type] ||
      styles.info;


    element.innerHTML = `

      <div style="
        padding:10px 12px;
        background:${style.background};
        color:${style.color};
        border:1px solid ${style.border};
        border-radius:8px;
      ">

        ${escapeHtml(
          message
        )}

      </div>

    `;

  }


  /*
  ============================================================
  ESCAPE
  ============================================================
  */

  document.addEventListener(
    "keydown",
    event => {

      if (
        event.key ===
        "Escape"
      ) {

        closeContractModal();

        closeDetail();

        closeBulkImportModal();

        closeBulkJournalModal();

      }

    }
  );


  function escapeHtml(
    value
  ) {

    return String(
      value ?? ""
    )
      .replaceAll(
        "&",
        "&amp;"
      )
      .replaceAll(
        "<",
        "&lt;"
      )
      .replaceAll(
        ">",
        "&gt;"
      )
      .replaceAll(
        '"',
        "&quot;"
      )
      .replaceAll(
        "'",
        "&#039;"
      );

  }


  /*
  ============================================================
  REFRESH
  ============================================================
  */

  function refresh() {

    populateCompanyFilter();

    updateKPIs();

    renderTable();

  }


  /*
  ============================================================
  INIT
  ============================================================
  */

  refresh();


  /*
  ------------------------------------------------------------
  CREATE BULK JOURNAL BUTTON IF HTML DOES NOT CONTAIN IT
  ------------------------------------------------------------
  */

  function ensureBulkJournalButton() {

    if (
      document.getElementById(
        "bulkJournalButton"
      )
    ) {
      return;
    }


    /*
    Try common toolbar locations.
    */

    const candidates = [

      document.querySelector(
        ".toolbar"
      ),

      document.querySelector(
        ".actions"
      ),

      document.querySelector(
        ".page-actions"
      ),

      document.querySelector(
        "header"
      )

    ];


    const target =
      candidates.find(
        element =>
          element
      );


    if (!target) {
      return;
    }


    const button =
      document.createElement(
        "button"
      );


    button.id =
      "bulkJournalButton";


    button.type =
      "button";


    button.className =
      "primary-button";


    button.style.cssText = `
      margin-left:8px;
      min-height:40px;
      padding:0 15px;
      cursor:pointer;
    `;


    button.innerHTML =
      "📒 Toplu Muhasebe Fişleri";


    target.appendChild(
      button
    );

  }


  ensureBulkJournalButton();


  console.log(
    "GK TFRS 16 Accounting Engine V13 loaded successfully."
  );

});
