document.addEventListener("DOMContentLoaded", () => {

  /*
  ============================================================
  GK FINANCE INTELLIGENCE
  TFRS 16 ACCOUNTING ENGINE V8
  ============================================================

  V8 FEATURES
  ------------------------------------------------------------
  1. Contract portfolio
  2. Individual accounting entries
  3. Monthly / quarterly / annual entries
  4. Year-end current / non-current reclassification
  5. Calendar-year based calculation
  6. Portfolio-level batch accounting
  7. Company filtering
  8. Active contract filtering
  9. Debit / credit control
  10. CFO-oriented financial impact
  ============================================================
  */


  const STORAGE_KEY =
    "gk_tfrs16_contracts_v8";


  let contracts =
    loadContracts();


  let selectedContractId =
    null;


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
        localStorage.getItem(
          STORAGE_KEY
        );


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


    saveContracts(
      defaults
    );


    return defaults;

  }


  function saveContracts(
    data
  ) {

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

  function formatNumber(
    value
  ) {

    return Number(
      value || 0
    ).toLocaleString(
      "tr-TR",
      {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }
    );

  }


  function formatCurrency(
    value
  ) {

    return `₺${formatNumber(value)}`;

  }


  function parseDate(
    value
  ) {

    if (!value) {

      return null;

    }


    const date =
      new Date(
        `${value}T00:00:00`
      );


    return isNaN(
      date.getTime()
    )
      ? null
      : date;

  }


  function formatDate(
    value
  ) {

    const date =
      parseDate(value);


    if (!date) {

      return "-";

    }


    return date.toLocaleDateString(
      "tr-TR"
    );

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


    const startDate =
      parseDate(
        contract.startDate
      );


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


      const periodDate =
        new Date(
          startDate
        );


      periodDate.setMonth(
        periodDate.getMonth() +
        (i - 1)
      );


      schedule.push({

        period: i,

        date:
          periodDate,

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


  /*
  ============================================================
  CALENDAR YEAR FILTER
  ============================================================
  */

  function getScheduleForYear(
    contract,
    year
  ) {

    const engine =
      calculateLease(
        contract
      );


    return engine.schedule.filter(
      item =>
        item.year ===
        Number(year)
    );

  }


  /*
  ============================================================
  CURRENT LIABILITY
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


  /*
  ============================================================
  NON CURRENT LIABILITY
  ============================================================
  */

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


  /*
  ============================================================
  NEXT 12 MONTHS
  ============================================================
  */

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
      document.getElementById(
        id
      );


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
          contracts.map(
            contract =>
              contract.company
          )
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
      document.getElementById(
        id
      );


    if (input) {

      input.value =
        value;

    }

  }


  function getInput(
    id
  ) {

    return (
      document.getElementById(
        id
      )?.value || ""
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
              contract.id ===
              id
          );


        const contract = {

          id,

          company:
            getInput(
              "company"
            ),

          supplier:
            getInput(
              "supplier"
            ),

          monthlyPayment:
            Number(
              getInput(
                "monthlyPayment"
              )
            ) || 0,

          startDate:
            getInput(
              "startDate"
            ),

          endDate:
            getInput(
              "endDate"
            ),

          discountRate:
            Number(
              getInput(
                "discountRate"
              )
            ) || 0,

          renewalDate:
            getInput(
              "renewalDate"
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
  INDIVIDUAL JOURNAL ENGINE
  ============================================================
  */

  function getJournalForPeriod(
    contract,
    year,
    period
  ) {

    const schedule =
      getScheduleForYear(
        contract,
        year
      );


    if (!schedule.length) {

      return [];

    }


    let selected = [];


    if (
      period === "monthly"
    ) {

      const month =
        Number(
          document.getElementById(
            "accountingMonth"
          )?.value
        );


      selected =
        schedule.filter(
          item =>
            item.month ===
            month
        );

    }


    if (
      period === "quarterly"
    ) {

      const month =
        Number(
          document.getElementById(
            "accountingMonth"
          )?.value
        );


      const quarter =
        Math.ceil(
          month / 3
        );


      selected =
        schedule.filter(
          item =>
            Math.ceil(
              item.month / 3
            ) === quarter
        );

    }


    if (
      period === "annual"
    ) {

      selected =
        schedule;

    }


    if (!selected.length) {

      return [];

    }


    return aggregateSchedule(
      selected
    );

  }


  function aggregateSchedule(
    selected
  ) {

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
                  debit
                )}

              </td>


              <td style="
                padding:11px;
                text-align:right;
                font-weight:800;
                border-top:2px solid #cbd5e1;
              ">

                ${formatCurrency(
                  credit
                )}

              </td>

            </tr>

          </tfoot>

        </table>


        <div style="
          padding:11px 14px;
          background:${
            difference < 0.01
              ? "#f0fdf4"
              : "#fef2f2"
          };
          color:${
            difference < 0.01
              ? "#166534"
              : "#991b1b"
          };
          font-size:10px;
          font-weight:700;
        ">

          ${
            difference < 0.01
              ? "✓ Borç / Alacak dengeli"
              : "⚠ Borç / Alacak farkı mevcut"
          }

        </div>

      </div>

    `;

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

            Bu sözleşme için aylık,
            çeyreklik veya yıllık fiş oluşturun.

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

              Dönem / Ay

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
          ERP entegrasyonu sonraki aşamada eklenecektir.

        </div>

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
        <option value="${
          new Date().getFullYear()
        }">

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
  INDIVIDUAL JOURNAL
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


    if (
      period === "closing"
    ) {

      const entries =
        generateReclassificationEntry(
          contract
        );


      document.getElementById(
        "journalPreview"
      ).innerHTML =

        renderJournalEntry(
          `${year} Yıl Sonu Current / Non-current Kapanış Fişi`,
          entries
        );


      return;

    }


    const entries =
      getJournalForPeriod(
        contract,
        year,
        period
      );


    if (!entries.length) {

      document.getElementById(
        "journalPreview"
      ).innerHTML = `

        <div style="
          margin-top:18px;
          padding:15px;
          background:#fff7ed;
          border:1px solid #fed7aa;
          border-radius:9px;
          color:#9a3412;
        ">

          Seçilen yıl / dönem için
          bu sözleşmede ödeme planı bulunmuyor.

        </div>

      `;


      return;

    }


    let title =
      "";


    if (
      period === "monthly"
    ) {

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


      title =
        `${year} - ${quarter}. Çeyrek Muhasebe Fişi`;

    }


    if (
      period === "annual"
    ) {

      title =
        `${year} - 12 Aylık Toplu Muhasebe Fişi`;

    }


    document.getElementById(
      "journalPreview"
    ).innerHTML =

      renderJournalEntry(
        title,
        entries
      );

  }


  /*
  ============================================================
  MONTH NAME
  ============================================================
  */

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
      names[
        month - 1
      ] ||
      "-"
    );

  }


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
              Kira Süresi
            </span>

            <strong>
              ${engine.months} Ay
            </strong>

          </div>


          <div class="detail-item">

            <span>
              İskonto Oranı
            </span>

            <strong>
              %${contract.discountRate}
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
              Aylık Faiz
            </span>

            <strong>
              ${formatCurrency(
                engine.monthlyInterest
              )}
            </strong>

          </div>


          <div class="detail-item">

            <span>
              Current Liability
            </span>

            <strong>
              ${formatCurrency(
                current
              )}
            </strong>

          </div>


          <div class="detail-item">

            <span>
              Non-current Liability
            </span>

            <strong>
              ${formatCurrency(
                nonCurrent
              )}
            </strong>

          </div>


          <div class="detail-item">

            <span>
              Önümüzdeki 12 Ay
            </span>

            <strong>
              ${formatCurrency(
                next12
              )}
            </strong>

          </div>


          <div class="detail-item">

            <span>
              Başlangıç
            </span>

            <strong>
              ${formatDate(
                contract.startDate
              )}
            </strong>

          </div>


          <div class="detail-item">

            <span>
              Bitiş
            </span>

            <strong>
              ${formatDate(
                contract.endDate
              )}
            </strong>

          </div>


          <div class="detail-item">

            <span>
              Yenileme
            </span>

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

            <span>
              Modification
            </span>

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
  V8 — BATCH ACCOUNTING BUTTON
  ============================================================
  */

  function injectBatchButton() {

    const actions =
      document.querySelector(
        ".topbar-actions"
      );


    if (!actions) {

      return;

    }


    if (
      document.getElementById(
        "batchAccountingButton"
      )
    ) {

      return;

    }


    const button =
      document.createElement(
        "button"
      );


    button.id =
      "batchAccountingButton";


    button.className =
      "secondary-button";


    button.textContent =
      "▤ Toplu Fiş Merkezi";


    button.addEventListener(
      "click",
      openBatchAccounting
    );


    actions.insertBefore(
      button,
      document.getElementById(
        "newContractButton"
      )
    );

  }


  /*
  ============================================================
  BATCH ACCOUNTING MODAL
  ============================================================
  */

  function openBatchAccounting() {

    const modal =
      document.createElement(
        "div"
      );


    modal.id =
      "batchAccountingModal";


    modal.className =
      "modal";


    modal.innerHTML = `

      <div
        class="modal-content"
        style="
          width:min(1100px,100%);
          max-height:90vh;
          overflow:auto;
        "
      >

        <div class="modal-header">

          <div>

            <div class="eyebrow">
              TFRS 16
            </div>

            <h2>
              Toplu Muhasebe Fiş Merkezi
            </h2>

            <p style="
              margin:5px 0 0;
              color:#64748b;
              font-size:11px;
            ">

              Birden fazla sözleşmenin
              muhasebe hareketlerini tek fişte
              toplulaştırın.

            </p>

          </div>


          <button
            id="closeBatchModal"
            class="close-button"
          >
            ×
          </button>

        </div>


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
              color:#64748b;
              margin-bottom:7px;
            ">

              Raporlama Yılı

            </label>


            <select
              id="batchYear"
              style="
                width:100%;
                padding:9px;
                border:1px solid #d1d5db;
                border-radius:7px;
              "
            >

              ${buildBatchYearOptions()}

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

              Fiş Tipi

            </label>


            <select
              id="batchPeriod"
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

              Ay / Çeyrek

            </label>


            <select
              id="batchMonth"
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

              Şirket

            </label>


            <select
              id="batchCompany"
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

              ${getCompanyOptions()}

            </select>

          </div>

        </div>


        <div style="
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap:12px;
          margin-top:18px;
          padding:14px;
          background:#f8fafc;
          border:1px solid #e5e7eb;
          border-radius:10px;
          flex-wrap:wrap;
        ">

          <div>

            <strong
              id="batchContractCount"
              style="font-size:14px;"
            >
              0 sözleşme
            </strong>

            <div style="
              color:#64748b;
              font-size:10px;
              margin-top:4px;
            ">

              Aktif sözleşmeler üzerinden
              hesaplanacaktır.

            </div>

          </div>


          <button
            id="generateBatchJournal"
            class="primary-button"
          >

            Toplu Fişi Oluştur

          </button>

        </div>


        <div id="batchJournalPreview"></div>


        <div style="
          margin-top:15px;
          padding:12px 14px;
          background:#fffdf7;
          border:1px solid #f3e8c5;
          border-radius:9px;
          color:#92400e;
          font-size:10px;
          line-height:1.5;
        ">

          <strong>CFO Kontrolü:</strong>

          Bu ekran yüzlerce sözleşmenin
          muhasebe hareketlerini tek fişte
          toplulaştırmak için tasarlanmıştır.
          ERP entegrasyonu sonraki aşamada
          eklenecektir.

        </div>

      </div>

    `;


    document.body.appendChild(
      modal
    );


    document
      .getElementById(
        "closeBatchModal"
      )
      ?.addEventListener(
        "click",
        () => modal.remove()
      );


    document
      .getElementById(
        "generateBatchJournal"
      )
      ?.addEventListener(
        "click",
        generateBatchJournal
      );


    document
      .getElementById(
        "batchCompany"
      )
      ?.addEventListener(
        "change",
        updateBatchCount
      );


    updateBatchCount();

  }


  /*
  ============================================================
  BATCH YEARS
  ============================================================
  */

  function buildBatchYearOptions() {

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


        if (
          !start ||
          !end
        ) {

          return;

        }


        for (
          let y =
            start.getFullYear();

          y <=
          end.getFullYear();

          y++
        ) {

          years.add(y);

        }

      }
    );


    if (!years.size) {

      years.add(
        new Date().getFullYear()
      );

    }


    return [
      ...years
    ]
      .sort(
        (a, b) =>
          a - b
      )
      .map(
        year => `

          <option value="${year}">

            ${year}

          </option>

        `
      )
      .join("");

  }


  /*
  ============================================================
  COMPANY OPTIONS
  ============================================================
  */

  function getCompanyOptions() {

    return [
      ...new Set(
        contracts.map(
          contract =>
            contract.company
        )
      )
    ]
      .sort()
      .map(
        company => `

          <option value="${
            escapeHtml(company)
          }">

            ${escapeHtml(company)}

          </option>

        `
      )
      .join("");

  }


  /*
  ============================================================
  BATCH COUNT
  ============================================================
  */

  function getBatchContracts() {

    const company =
      document.getElementById(
        "batchCompany"
      )?.value ||
      "all";


    return contracts.filter(
      contract => {

        return (

          contract.status ===
          "active"

          &&

          (
            company === "all" ||
            contract.company ===
            company
          )

        );

      }
    );

  }


  function updateBatchCount() {

    const selected =
      getBatchContracts();


    setText(
      "batchContractCount",
      `${selected.length} sözleşme`
    );

  }


  /*
  ============================================================
  BATCH JOURNAL
  ============================================================
  */

  function generateBatchJournal() {

    const year =
      Number(
        document.getElementById(
          "batchYear"
        )?.value
      );


    const period =
      document.getElementById(
        "batchPeriod"
      )?.value;


    const month =
      Number(
        document.getElementById(
          "batchMonth"
        )?.value
      );


    const selectedContracts =
      getBatchContracts();


    if (
      !selectedContracts.length
    ) {

      showBatchMessage(
        "Toplu fiş oluşturmak için aktif sözleşme bulunamadı.",
        "warning"
      );


      return;

    }


    if (
      period === "closing"
    ) {

      generateBatchClosing(
        selectedContracts,
        year
      );


      return;

    }


    const totals = {

      interest: 0,

      principal: 0,

      payment: 0,

      depreciation: 0

    };


    let contractCount = 0;


    selectedContracts.forEach(
      contract => {

        const schedule =
          getScheduleForYear(
            contract,
            year
          );


        let selected = [];


        if (
          period === "monthly"
        ) {

          selected =
            schedule.filter(
              item =>
                item.month ===
                month
            );

        }


        if (
          period === "quarterly"
        ) {

          const quarter =
            Math.ceil(
              month / 3
            );


          selected =
            schedule.filter(
              item =>
                Math.ceil(
                  item.month / 3
                ) ===
                quarter
            );

        }


        if (
          period === "annual"
        ) {

          selected =
            schedule;

        }


        if (!selected.length) {

          return;

        }


        contractCount++;


        selected.forEach(
          item => {

            totals.interest +=
              item.interest;


            totals.principal +=
              item.principal;


            totals.payment +=
              item.payment;


            totals.depreciation +=
              item.depreciation;

          }
        );

      }
    );


    if (
      contractCount === 0
    ) {

      showBatchMessage(
        "Seçilen yıl / dönem için aktif sözleşmelerde hareket bulunamadı.",
        "warning"
      );


      return;

    }


    const entries = [

      {
        account:
          "780 Finansman Giderleri",
        debit:
          totals.interest,
        credit:
          0
      },

      {
        account:
          "401 Kiralama Yükümlülüğü",
        debit:
          totals.principal,
        credit:
          0
      },

      {
        account:
          "381 Kira Borçları / Ödeme",
        debit:
          0,
        credit:
          totals.payment
      },

      {
        account:
          "770 / 730 Amortisman Giderleri",
        debit:
          totals.depreciation,
        credit:
          0
      },

      {
        account:
          "268 Birikmiş Amortismanlar",
        debit:
          0,
        credit:
          totals.depreciation
      }

    ];


    let title;


    if (
      period === "monthly"
    ) {

      title =
        `${year} - ${getMonthName(
          month
        )} TOPLU TFRS 16 FİŞİ`;

    }


    if (
      period === "quarterly"
    ) {

      const quarter =
        Math.ceil(
          month / 3
        );


      title =
        `${year} - ${quarter}. ÇEYREK TOPLU TFRS 16 FİŞİ`;

    }


    if (
      period === "annual"
    ) {

      title =
        `${year} - 12 AYLIK TOPLU TFRS 16 FİŞİ`;

    }


    const summary = `

      <div style="
        display:grid;
        grid-template-columns:
          repeat(auto-fit,minmax(160px,1fr));
        gap:10px;
        margin-top:18px;
      ">

        ${batchMetric(
          "İşlenen Sözleşme",
          contractCount
        )}

        ${batchMetric(
          "Toplam Faiz",
          formatCurrency(
            totals.interest
          )
        )}

        ${batchMetric(
          "Toplam Anapara",
          formatCurrency(
            totals.principal
          )
        )}

        ${batchMetric(
          "Toplam Ödeme",
          formatCurrency(
            totals.payment
          )
        )}

        ${batchMetric(
          "Toplam Amortisman",
          formatCurrency(
            totals.depreciation
          )
        )}

      </div>

    `;


    document.getElementById(
      "batchJournalPreview"
    ).innerHTML =

      summary +

      renderJournalEntry(
        title,
        entries
      );

  }


  /*
  ============================================================
  BATCH CLOSING
  ============================================================
  */

  function generateBatchClosing(
    selectedContracts,
    year
  ) {

    let current = 0;

    let nonCurrent = 0;

    let count = 0;


    selectedContracts.forEach(
      contract => {

        const schedule =
          getScheduleForYear(
            contract,
            year
          );


        if (!schedule.length) {

          return;

        }


        const last =
          schedule[
            schedule.length - 1
          ];


        current +=
          calculateCurrentLiability(
            contract
          );


        nonCurrent +=
          Math.max(
            0,
            last.closingLiability -
            current
          );


        count++;

      }
    );


    const entries = [

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


    const summary = `

      <div style="
        display:grid;
        grid-template-columns:
          repeat(auto-fit,minmax(170px,1fr));
        gap:10px;
        margin-top:18px;
      ">

        ${batchMetric(
          "İşlenen Sözleşme",
          count
        )}

        ${batchMetric(
          "Current",
          formatCurrency(
            current
          )
        )}

        ${batchMetric(
          "Non-current",
          formatCurrency(
            nonCurrent
          )
        )}

      </div>

    `;


    document.getElementById(
      "batchJournalPreview"
    ).innerHTML =

      summary +

      renderJournalEntry(
        `${year} Yıl Sonu TOPLU Current / Non-current Fişi`,
        entries
      );

  }


  /*
  ============================================================
  BATCH METRIC
  ============================================================
  */

  function batchMetric(
    label,
    value
  ) {

    return `

      <div style="
        background:white;
        border:1px solid #e5e7eb;
        border-radius:10px;
        padding:13px;
      ">

        <div style="
          color:#64748b;
          font-size:9px;
        ">

          ${label}

        </div>

        <div style="
          margin-top:5px;
          font-size:15px;
          font-weight:800;
        ">

          ${value}

        </div>

      </div>

    `;

  }


  /*
  ============================================================
  BATCH MESSAGE
  ============================================================
  */

  function showBatchMessage(
    message,
    type
  ) {

    const color =
      type === "warning"
        ? "#9a3412"
        : "#166534";


    const background =
      type === "warning"
        ? "#fff7ed"
        : "#f0fdf4";


    const border =
      type === "warning"
        ? "#fed7aa"
        : "#bbf7d0";


    const preview =
      document.getElementById(
        "batchJournalPreview"
      );


    if (!preview) {

      return;

    }


    preview.innerHTML = `

      <div style="
        margin-top:18px;
        padding:15px;
        background:${background};
        border:1px solid ${border};
        border-radius:9px;
        color:${color};
      ">

        ${escapeHtml(
          message
        )}

      </div>

    `;

  }


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


        document
          .getElementById(
            "batchAccountingModal"
          )
          ?.remove();

      }

    }
  );


  /*
  ============================================================
  ESCAPE HTML
  ============================================================
  */

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

    injectBatchButton();

  }


  /*
  ============================================================
  INIT
  ============================================================
  */

  refresh();


  console.log(
    "GK TFRS 16 Accounting Engine V8 loaded successfully."
  );

});
