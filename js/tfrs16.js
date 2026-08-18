document.addEventListener("DOMContentLoaded", () => {

  /*
  ============================================================
  GK FINANCE INTELLIGENCE
  TFRS 16 ENGINE V5
  ============================================================
  */

  const STORAGE_KEY = "gk_tfrs16_contracts_v5";

  let contracts = loadContracts();
  let selectedContractId = null;


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

        const parsed = JSON.parse(stored);

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
          maximumFractionDigits: 0
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

    const date =
      new Date(
        `${value}T00:00:00`
      );

    return isNaN(date.getTime())
      ? null
      : date;

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

    if (!startDate || !endDate) {
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

  Simplified financial model:

  Initial Lease Liability
  =
  PV of future lease payments

  Monthly Interest
  =
  Opening Liability × Monthly Discount Rate

  Principal
  =
  Payment - Interest

  Closing Liability
  =
  Opening Liability - Principal

  ROU Asset
  =
  Initial Lease Liability

  Monthly Depreciation
  =
  Initial ROU / Lease Term
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
        interest: 0,
        schedule: []
      };

    }


    /*
    INITIAL LIABILITY
    */

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


    /*
    INITIAL ROU

    V5 simplified:

    ROU = lease liability

    V6:
    + prepaid payments
    + direct costs
    - incentives
    + restoration
    */

    const initialROU =
      initialLiability;


    const depreciation =
      initialROU /
      months;


    /*
    PAYMENT SCHEDULE
    */

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
  CURRENT / NON-CURRENT
  ============================================================
  */

  function calculateCurrentLiability(
    contract
  ) {

    const engine =
      calculateLease(
        contract
      );

    if (
      !engine.schedule.length
    ) {
      return 0;
    }


    const current =
      engine.schedule
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


    return Math.min(
      engine.liability,
      current
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

    if (!contract.renewalDate) {
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
            c =>
              c.company
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

          const text =
            `
            ${contract.id}
            ${contract.company}
            ${contract.supplier}
            `
            .toLowerCase();


          const matchSearch =
            !search ||
            text.includes(
              search
            );


          const matchStatus =
            status === "all" ||
            contract.status ===
              status;


          const matchCompany =
            company === "all" ||
            contract.company ===
              company;


          return (
            matchSearch &&
            matchStatus &&
            matchCompany
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


    const empty =
      document.getElementById(
        "emptyState"
      );


    if (empty) {

      empty.classList.toggle(
        "hidden",
        filtered.length > 0
      );

    }

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
  SAVE
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
            c =>
              c.id === id
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
  DETAIL
  ============================================================
  */

  function openDetail(
    id
  ) {

    const contract =
      contracts.find(
        c =>
          c.id === id
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
            <span>Aylık Faiz Gideri</span>
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
              TFRS 16 Finansal Etki
            </strong>

            <p>

              İlk ölçümde kira yükümlülüğü
              <strong>
                ${formatCurrency(
                  engine.liability
                )}
              </strong>
              olarak hesaplanmıştır.

              ROU varlığı
              <strong>
                ${formatCurrency(
                  engine.rouAssets
                )}
              </strong>
              seviyesindedir.

              Aylık faiz gideri yaklaşık
              <strong>
                ${formatCurrency(
                  engine.monthlyInterest
                )}
              </strong>
              , aylık ROU amortismanı ise
              <strong>
                ${formatCurrency(
                  engine.depreciation
                )}
              </strong>
              seviyesindedir.

            </p>

          </div>

        </div>


        <div style="
          margin-top:20px;
          border-top:1px solid #e5e7eb;
          padding-top:18px;
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
              min-width:700px;
            ">

              <thead>

                <tr>

                  <th>Ay</th>
                  <th>Açılış Yükümlülüğü</th>
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

      `;

    }


    modal
      ?.classList.remove(
        "hidden"
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
            c =>
              c.id ===
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
            c =>
              c.id !==
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
  ESC
  ============================================================
  */

  document.addEventListener(
    "keydown",
    event => {

      if (
        event.key !==
        "Escape"
      ) {
        return;
      }

      closeContractModal();
      closeDetail();

    }
  );


  /*
  ============================================================
  SECURITY
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

  }


  /*
  ============================================================
  INIT
  ============================================================
  */

  refresh();


  console.log(
    "GK TFRS 16 Engine V5 loaded successfully."
  );

});
