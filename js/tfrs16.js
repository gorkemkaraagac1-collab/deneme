document.addEventListener("DOMContentLoaded", () => {

  /*
  ============================================================
  GK FINANCE INTELLIGENCE
  TFRS 16 ACCOUNTING ENGINE V10
  ============================================================

  V10 FEATURES
  ------------------------------------------------------------
  ✓ TFRS 16 lease calculation
  ✓ Monthly / quarterly / annual journals
  ✓ Current / non-current classification
  ✓ Contract portfolio
  ✓ Contract CRUD
  ✓ Excel bulk import
  ✓ Duplicate contract detection
  ✓ Import validation
  ✓ Import summary
  ✓ LocalStorage persistence
  ============================================================
  */


  const STORAGE_KEY =
    "gk_tfrs16_contracts_v10";


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


        if (
          Array.isArray(parsed)
        ) {

          return parsed;

        }

      }

    }

    catch (error) {

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

    return `₺${formatNumber(
      value
    )}`;

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
      parseDate(
        value
      );


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
      parseDate(
        start
      );


    const endDate =
      parseDate(
        end
      );


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


    let liability;


    if (
      monthlyRate === 0
    ) {

      liability =
        payment *
        months;

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


      principal =
        Math.max(
          0,
          Math.min(
            principal,
            openingLiability
          )
        );


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

        period: i,

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
      .slice(
        0,
        12
      )
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
      .slice(
        0,
        12
      )
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
        )?.value ||
        ""
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


    tbody.innerHTML =
      "";


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
      )?.value ||
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
          )
          .trim();


        if (!id) {

          alert(
            "Sözleşme ID zorunludur."
          );

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

        }

        else {

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


    if (
      !selected.length
    ) {

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
            Aylık, çeyreklik ve yıllık fişleri oluşturun.
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
  JOURNAL GENERATOR
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

      startMonth =
        1;

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


      document.getElementById(
        "journalPreview"
      ).innerHTML =

        renderJournalEntry(
          `${year} Yıl Sonu Current / Non-current Kapanış Fişi`,
          entries
        );


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

          Bu sözleşmede seçilen dönem için
          ödeme planı bulunmuyor.

        </div>

      `;


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


    document.getElementById(
      "journalPreview"
    ).innerHTML =

      renderJournalEntry(
        title,
        entries
      );

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
  DETAIL
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
                  .slice(
                    0,
                    12
                  )
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
  EXCEL IMPORT UI
  ============================================================
  */

  function injectExcelImportButton() {

    const actions =
      document.querySelector(
        ".topbar-actions"
      );


    if (
      !actions ||
      document.getElementById(
        "excelImportButton"
      )
    ) {

      return;

    }


    const button =
      document.createElement(
        "button"
      );


    button.id =
      "excelImportButton";


    button.className =
      "secondary-button";


    button.innerHTML =
      "⇩ Excel'den Toplu Aktar";


    actions.insertBefore(
      button,
      actions.firstChild
    );


    button.addEventListener(
      "click",
      openExcelImport
    );

  }


  /*
  ============================================================
  EXCEL IMPORT MODAL
  ============================================================
  */

  function openExcelImport() {

    if (
      typeof XLSX ===
      "undefined"
    ) {

      alert(
        "Excel modülü yüklenemedi. HTML dosyasına SheetJS bağlantısını ekleyin."
      );

      return;

    }


    const modal =
      document.createElement(
        "div"
      );


    modal.id =
      "excelImportModal";


    modal.className =
      "modal";


    modal.innerHTML = `

      <div class="modal-content">

        <div class="modal-header">

          <div>

            <div class="eyebrow">
              TFRS 16
            </div>

            <h2>
              Excel'den Toplu Sözleşme Aktarımı
            </h2>

            <p style="
              margin:5px 0 0;
              color:#64748b;
              font-size:11px;
            ">
              Yüzlerce sözleşmeyi tek seferde portföye aktarın.
            </p>

          </div>


          <button
            id="closeExcelModal"
            class="close-button"
          >
            ×
          </button>

        </div>


        <div style="
          background:#f8fafc;
          border:1px solid #e5e7eb;
          border-radius:10px;
          padding:15px;
        ">

          <strong style="
            font-size:12px;
          ">
            1. Excel şablonunu kullanın
          </strong>


          <p style="
            font-size:10px;
            color:#64748b;
            line-height:1.5;
          ">

            Sözleşme ID, şirket, tedarikçi,
            aylık kira, başlangıç, bitiş,
            iskonto oranı ve yenileme tarihi
            alanlarını doldurun.

          </p>


          <button
            id="downloadTemplate"
            class="secondary-button"
          >
            ↓ Excel Şablonunu İndir
          </button>

        </div>


        <div style="
          margin-top:14px;
          border:2px dashed #cbd5e1;
          border-radius:10px;
          padding:25px;
          text-align:center;
        ">

          <div style="
            font-size:25px;
          ">
            ⇧
          </div>


          <strong style="
            display:block;
            margin-top:8px;
          ">
            Excel dosyanızı seçin
          </strong>


          <p style="
            color:#64748b;
            font-size:10px;
          ">
            .xlsx veya .xls
          </p>


          <input
            id="excelFileInput"
            type="file"
            accept=".xlsx,.xls"
          >

        </div>


        <div id="excelImportResult"></div>


        <div class="modal-footer">

          <button
            id="cancelExcelImport"
            class="secondary-button"
          >
            Kapat
          </button>

        </div>

      </div>

    `;


    document.body.appendChild(
      modal
    );


    document
      .getElementById(
        "closeExcelModal"
      )
      ?.addEventListener(
        "click",
        () =>
          modal.remove()
      );


    document
      .getElementById(
        "cancelExcelImport"
      )
      ?.addEventListener(
        "click",
        () =>
          modal.remove()
      );


    document
      .getElementById(
        "downloadTemplate"
      )
      ?.addEventListener(
        "click",
        downloadExcelTemplate
      );


    document
      .getElementById(
        "excelFileInput"
      )
      ?.addEventListener(
        "change",
        handleExcelFile
      );

  }


  /*
  ============================================================
  EXCEL TEMPLATE
  ============================================================
  */

  function downloadExcelTemplate() {

    if (
      typeof XLSX ===
      "undefined"
    ) {

      alert(
        "Excel modülü yüklenemedi."
      );

      return;

    }


    const data = [

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
          "2026-01-01",

        "Bitiş Tarihi":
          "2030-12-31",

        "İskonto Oranı":
          18,

        "Yenileme Tarihi":
          "2030-09-30",

        "Durum":
          "active",

        "Modification":
          false

      }

    ];


    const worksheet =
      XLSX.utils.json_to_sheet(
        data
      );


    const workbook =
      XLSX.utils.book_new();


    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "TFRS16_Sozlesmeler"
    );


    worksheet["!cols"] = [

      { wch: 18 },
      { wch: 20 },
      { wch: 25 },
      { wch: 15 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 12 },
      { wch: 15 }

    ];


    XLSX.writeFile(
      workbook,
      "TFRS16_Sozlesme_Sablonu.xlsx"
    );

  }


  /*
  ============================================================
  EXCEL FILE HANDLER
  ============================================================
  */

  function handleExcelFile(
    event
  ) {

    const file =
      event.target.files?.[0];


    if (!file) {

      return;

    }


    const result =
      document.getElementById(
        "excelImportResult"
      );


    if (!result) {

      return;

    }


    result.innerHTML = `

      <div style="
        margin-top:15px;
        padding:14px;
        background:#f8fafc;
        border:1px solid #e5e7eb;
        border-radius:9px;
        font-size:11px;
      ">

        Excel dosyası okunuyor...

      </div>

    `;


    const reader =
      new FileReader();


    reader.onload =
      function(e) {

        try {

          const workbook =
            XLSX.read(
              e.target.result,
              {
                type:
                  "array"
              }
            );


          const firstSheet =
            workbook
              .SheetNames[0];


          const worksheet =
            workbook
              .Sheets[
                firstSheet
              ];


          const rows =
            XLSX.utils.sheet_to_json(
              worksheet,
              {
                defval: ""
              }
            );


          processImportedRows(
            rows
          );

        }

        catch(error) {

          console.error(
            error
          );


          result.innerHTML = `

            <div style="
              margin-top:15px;
              padding:14px;
              background:#fee2e2;
              border:1px solid #fecaca;
              border-radius:9px;
              color:#991b1b;
              font-size:11px;
            ">

              Excel dosyası okunamadı.
              Dosyanın formatını kontrol edin.

            </div>

          `;

        }

      };


    reader.readAsArrayBuffer(
      file
    );

  }


  /*
  ============================================================
  IMPORT PROCESSOR
  ============================================================
  */

  function processImportedRows(
    rows
  ) {

    const result =
      document.getElementById(
        "excelImportResult"
      );


    if (!rows.length) {

      result.innerHTML = `

        <div style="
          margin-top:15px;
          padding:14px;
          background:#fff7ed;
          border:1px solid #fed7aa;
          border-radius:9px;
          color:#9a3412;
          font-size:11px;
        ">

          Excel dosyasında veri bulunamadı.

        </div>

      `;


      return;

    }


    const imported = [];
    const errors = [];
    const duplicates = [];


    rows.forEach(
      (
        row,
        index
      ) => {

        const excelRow =
          index + 2;


        const contract =
          normalizeImportedContract(
            row
          );


        const validation =
          validateImportedContract(
            contract
          );


        if (
          !validation.valid
        ) {

          errors.push({

            row:
              excelRow,

            errors:
              validation.errors

          });


          return;

        }


        const duplicate =
          contracts.some(
            item =>
              item.id ===
              contract.id
          );


        if (duplicate) {

          duplicates.push(
            contract.id
          );


          return;

        }


        imported.push(
          contract
        );

      }
    );


    /*
    ----------------------------------------------------------
    IMPORT
    ----------------------------------------------------------
    */

    if (
      imported.length
    ) {

      contracts =
        [
          ...contracts,
          ...imported
        ];


      saveContracts(
        contracts
      );


      refresh();

    }


    renderImportResult(
      imported,
      errors,
      duplicates
    );

  }


  /*
  ============================================================
  NORMALIZE EXCEL DATA
  ============================================================
  */

  function normalizeImportedContract(
    row
  ) {

    return {

      id:
        String(
          row["Sözleşme ID"] ??
          row["contractId"] ??
          row["ID"] ??
          ""
        ).trim(),


      company:
        String(
          row["Şirket"] ??
          row["company"] ??
          ""
        ).trim(),


      supplier:
        String(
          row["Tedarikçi"] ??
          row["supplier"] ??
          ""
        ).trim(),


      monthlyPayment:
        normalizeNumber(
          row["Aylık Kira"] ??
          row["monthlyPayment"]
        ),


      startDate:
        normalizeExcelDate(
          row["Başlangıç Tarihi"] ??
          row["startDate"]
        ),


      endDate:
        normalizeExcelDate(
          row["Bitiş Tarihi"] ??
          row["endDate"]
        ),


      discountRate:
        normalizeNumber(
          row["İskonto Oranı"] ??
          row["discountRate"]
        ),


      renewalDate:
        normalizeExcelDate(
          row["Yenileme Tarihi"] ??
          row["renewalDate"]
        ),


      status:
        normalizeStatus(
          row["Durum"] ??
          row["status"]
        ),


      modification:
        normalizeBoolean(
          row["Modification"] ??
          row["modification"]
        )

    };

  }


  /*
  ============================================================
  NUMBER NORMALIZATION
  ============================================================
  */

  function normalizeNumber(
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
      String(
        value
      ).trim();


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
      text.includes(",")
    ) {

      text =
        text
          .replace(
            /\./g,
            ""
          )
          .replace(
            ",",
            "."
          );

    }


    return Number(
      text
    ) || 0;

  }


  /*
  ============================================================
  DATE NORMALIZATION
  ============================================================
  */

  function normalizeExcelDate(
    value
  ) {

    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {

      return "";

    }


    if (
      typeof value ===
      "number"
    ) {

      const date =
        XLSX.SSF.parse_date_code(
          value
        );


      if (!date) {

        return "";

      }


      return [

        date.y,

        String(
          date.m
        ).padStart(
          2,
          "0"
        ),

        String(
          date.d
        ).padStart(
          2,
          "0"
        )

      ].join("-");

    }


    const text =
      String(
        value
      ).trim();


    if (
      /^\d{4}-\d{2}-\d{2}$/
        .test(text)
    ) {

      return text;

    }


    const trMatch =
      text.match(
        /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/
      );


    if (
      trMatch
    ) {

      return [

        trMatch[3],

        String(
          trMatch[2]
        ).padStart(
          2,
          "0"
        ),

        String(
          trMatch[1]
        ).padStart(
          2,
          "0"
        )

      ].join("-");

    }


    return "";

  }


  /*
  ============================================================
  STATUS
  ============================================================
  */

  function normalizeStatus(
    value
  ) {

    const text =
      String(
        value || "active"
      )
      .trim()
      .toLowerCase();


    if (
      [
        "pasif",
        "inactive",
        "false"
      ].includes(
        text
      )
    ) {

      return "inactive";

    }


    return "active";

  }


  /*
  ============================================================
  BOOLEAN
  ============================================================
  */

  function normalizeBoolean(
    value
  ) {

    const text =
      String(
        value
      )
      .trim()
      .toLowerCase();


    return [

      "true",
      "1",
      "yes",
      "evet",
      "var"

    ].includes(
      text
    );

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


    if (!contract.id) {

      errors.push(
        "Sözleşme ID eksik"
      );

    }


    if (!contract.company) {

      errors.push(
        "Şirket eksik"
      );

    }


    if (!contract.supplier) {

      errors.push(
        "Tedarikçi eksik"
      );

    }


    if (
      contract.monthlyPayment <= 0
    ) {

      errors.push(
        "Aylık kira 0'dan büyük olmalı"
      );

    }


    if (
      !parseDate(
        contract.startDate
      )
    ) {

      errors.push(
        "Başlangıç tarihi hatalı"
      );

    }


    if (
      !parseDate(
        contract.endDate
      )
    ) {

      errors.push(
        "Bitiş tarihi hatalı"
      );

    }


    if (
      contract.startDate &&
      contract.endDate &&
      contract.startDate >
      contract.endDate
    ) {

      errors.push(
        "Başlangıç tarihi bitiş tarihinden sonra"
      );

    }


    if (
      contract.discountRate < 0
    ) {

      errors.push(
        "İskonto oranı negatif olamaz"
      );

    }


    return {

      valid:
        errors.length === 0,

      errors

    };

  }


  /*
  ============================================================
  IMPORT RESULT
  ============================================================
  */

  function renderImportResult(
    imported,
    errors,
    duplicates
  ) {

    const result =
      document.getElementById(
        "excelImportResult"
      );


    if (!result) {

      return;

    }


    const total =
      imported.length +
      errors.length +
      duplicates.length;


    let html = `

      <div style="
        margin-top:15px;
        padding:15px;
        border:1px solid #e5e7eb;
        border-radius:10px;
        background:white;
      ">

        <strong style="
          font-size:12px;
        ">
          Excel Aktarım Sonucu
        </strong>


        <div style="
          display:grid;
          grid-template-columns:
            repeat(3,1fr);
          gap:8px;
          margin-top:12px;
        ">

          <div style="
            padding:10px;
            background:#f0fdf4;
            border-radius:7px;
            color:#166534;
          ">

            <strong>
              ${imported.length}
            </strong>

            <div style="
              font-size:9px;
            ">
              Başarılı
            </div>

          </div>


          <div style="
            padding:10px;
            background:#fff7ed;
            border-radius:7px;
            color:#9a3412;
          ">

            <strong>
              ${duplicates.length}
            </strong>

            <div style="
              font-size:9px;
            ">
              Duplicate
            </div>

          </div>


          <div style="
            padding:10px;
            background:#fee2e2;
            border-radius:7px;
            color:#991b1b;
          ">

            <strong>
              ${errors.length}
            </strong>

            <div style="
              font-size:9px;
            ">
              Hatalı Satır
            </div>

          </div>

        </div>

    `;


    if (
      duplicates.length
    ) {

      html += `

        <div style="
          margin-top:12px;
          font-size:10px;
          color:#92400e;
        ">

          <strong>
            Atlanan sözleşmeler:
          </strong>

          ${duplicates
            .map(
              id =>
                escapeHtml(id)
            )
            .join(", ")}

        </div>

      `;

    }


    if (
      errors.length
    ) {

      html += `

        <div style="
          margin-top:12px;
          padding-top:10px;
          border-top:1px solid #e5e7eb;
        ">

          <strong style="
            font-size:10px;
            color:#991b1b;
          ">
            Hatalı Satırlar
          </strong>

          <div style="
            margin-top:8px;
            max-height:160px;
            overflow:auto;
            font-size:9px;
          ">

            ${errors
              .map(
                item => `

                  <div style="
                    padding:6px 0;
                    border-bottom:1px solid #f1f5f9;
                  ">

                    <strong>
                      Satır ${item.row}
                    </strong>

                    :
                    ${item.errors
                      .map(
                        error =>
                          escapeHtml(
                            error
                          )
                      )
                      .join(
                        ", "
                      )}

                  </div>

                `
              )
              .join("")}

          </div>

        </div>

      `;

    }


    html += `

        <div style="
          margin-top:12px;
          color:#64748b;
          font-size:9px;
        ">

          Toplam işlenen satır:
          ${total}

        </div>

      </div>

    `;


    result.innerHTML =
      html;

  }


  /*
  ============================================================
  ESCAPE
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
  ESCAPE / KEYBOARD
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
            "excelImportModal"
          )
          ?.remove();

      }

    }
  );


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

  injectExcelImportButton();


  refresh();


  console.log(
    "GK TFRS 16 Accounting Engine V10 loaded successfully."
  );

});
