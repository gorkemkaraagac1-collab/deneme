document.addEventListener("DOMContentLoaded", function () {

  /* =====================================================
     CONFIG
  ===================================================== */

  const STORAGE_KEY = "gk_tfrs16_contracts";


  /* =====================================================
     DOM ELEMENTS
  ===================================================== */

  const contractTableBody =
    document.getElementById("contractTableBody");

  const contractCount =
    document.getElementById("contractCount");

  const leaseLiabilityEl =
    document.getElementById("leaseLiability");

  const rouAssetsEl =
    document.getElementById("rouAssets");

  const next12MonthsEl =
    document.getElementById("next12Months");

  const renewals90DaysEl =
    document.getElementById("renewals90Days");

  const modificationsEl =
    document.getElementById("modifications");

  const resultCount =
    document.getElementById("resultCount");

  const emptyState =
    document.getElementById("emptyState");

  const searchInput =
    document.getElementById("searchInput");

  const statusFilter =
    document.getElementById("statusFilter");

  const companyFilter =
    document.getElementById("companyFilter");

  const newContractButton =
    document.getElementById("newContractButton");

  const contractModal =
    document.getElementById("contractModal");

  const closeModal =
    document.getElementById("closeModal");

  const cancelModal =
    document.getElementById("cancelModal");

  const contractForm =
    document.getElementById("contractForm");

  const detailModal =
    document.getElementById("detailModal");

  const closeDetailModal =
    document.getElementById("closeDetailModal");

  const detailCloseButton =
    document.getElementById("detailCloseButton");

  const detailContent =
    document.getElementById("detailContent");

  const detailTitle =
    document.getElementById("detailTitle");

  const deleteContractButton =
    document.getElementById("deleteContract");


  /* =====================================================
     STATE
  ===================================================== */

  let contracts = loadContracts();

  let selectedContractId = null;


  /* =====================================================
     INITIAL DEMO DATA
  ===================================================== */

  if (contracts.length === 0) {

    contracts = [

      createContract({
        id: "LEASE-001",
        company: "GK Holding",
        supplier: "ABC Plaza",
        monthlyPayment: 125000,
        startDate: "2026-01-01",
        endDate: "2030-12-31",
        discountRate: 18,
        renewalDate: "2030-10-01"
      }),

      createContract({
        id: "LEASE-002",
        company: "GK Holding",
        supplier: "XYZ Logistics",
        monthlyPayment: 85000,
        startDate: "2026-03-01",
        endDate: "2029-02-28",
        discountRate: 18,
        renewalDate: "2028-12-01"
      }),

      createContract({
        id: "LEASE-003",
        company: "GK Teknoloji",
        supplier: "Tech Office",
        monthlyPayment: 65000,
        startDate: "2026-02-01",
        endDate: "2028-01-31",
        discountRate: 19,
        renewalDate: "2027-10-15"
      })

    ];

    saveContracts();

  }


  /* =====================================================
     INITIAL RENDER
  ===================================================== */

  render();


  /* =====================================================
     EVENTS
  ===================================================== */

  newContractButton?.addEventListener(
    "click",
    openNewContractModal
  );

  closeModal?.addEventListener(
    "click",
    closeContractModal
  );

  cancelModal?.addEventListener(
    "click",
    closeContractModal
  );

  contractForm?.addEventListener(
    "submit",
    handleContractSubmit
  );

  searchInput?.addEventListener(
    "input",
    renderTable
  );

  statusFilter?.addEventListener(
    "change",
    renderTable
  );

  companyFilter?.addEventListener(
    "change",
    renderTable
  );

  closeDetailModal?.addEventListener(
    "click",
    closeDetail
  );

  detailCloseButton?.addEventListener(
    "click",
    closeDetail
  );

  deleteContractButton?.addEventListener(
    "click",
    handleDelete
  );


  /* =====================================================
     MAIN RENDER
  ===================================================== */

  function render() {

    updateKPIs();

    updateCompanyFilter();

    renderTable();

  }


  /* =====================================================
     KPI
  ===================================================== */

  function updateKPIs() {

    const activeContracts =
      contracts.filter(
        contract =>
          contract.status === "active"
      );

    const totalLeaseLiability =
      activeContracts.reduce(
        (sum, contract) =>
          sum +
          Number(
            contract.leaseLiability || 0
          ),
        0
      );

    const totalROU =
      activeContracts.reduce(
        (sum, contract) =>
          sum +
          Number(
            contract.rouAsset || 0
          ),
        0
      );

    const totalNext12Months =
      activeContracts.reduce(
        (sum, contract) =>
          sum +
          calculateNext12MonthsCashOutflow(
            contract
          ),
        0
      );

    const renewalRisk =
      activeContracts.filter(
        contract => {

          const days =
            daysUntil(
              contract.renewalDate
            );

          return (
            days >= 0 &&
            days <= 90
          );

        }
      ).length;

    const modifications =
      activeContracts.filter(
        contract =>
          contract.modification === true
      ).length;


    if (contractCount) {
      contractCount.textContent =
        activeContracts.length;
    }

    if (leaseLiabilityEl) {
      leaseLiabilityEl.textContent =
        formatCurrency(
          totalLeaseLiability
        );
    }

    if (rouAssetsEl) {
      rouAssetsEl.textContent =
        formatCurrency(
          totalROU
        );
    }

    if (next12MonthsEl) {
      next12MonthsEl.textContent =
        formatCurrency(
          totalNext12Months
        );
    }

    if (renewals90DaysEl) {
      renewals90DaysEl.textContent =
        renewalRisk;
    }

    if (modificationsEl) {
      modificationsEl.textContent =
        modifications;
    }

  }


  /* =====================================================
     TABLE
  ===================================================== */

  function renderTable() {

    if (!contractTableBody) {
      return;
    }

    const search =
      searchInput?.value
        ?.trim()
        ?.toLowerCase() || "";

    const status =
      statusFilter?.value || "all";

    const company =
      companyFilter?.value || "all";


    const filteredContracts =
      contracts.filter(
        contract => {

          const matchesSearch =
            !search ||
            contract.id
              .toLowerCase()
              .includes(search) ||
            contract.company
              .toLowerCase()
              .includes(search) ||
            contract.supplier
              .toLowerCase()
              .includes(search);


          const matchesStatus =
            status === "all" ||
            contract.status === status;


          const matchesCompany =
            company === "all" ||
            contract.company === company;


          return (
            matchesSearch &&
            matchesStatus &&
            matchesCompany
          );

        }
      );


    contractTableBody.innerHTML = "";


    if (resultCount) {

      resultCount.textContent =
        `${filteredContracts.length} kayıt`;

    }


    if (emptyState) {

      emptyState.classList.toggle(
        "hidden",
        filteredContracts.length !== 0
      );

    }


    filteredContracts.forEach(
      contract => {

        const row =
          document.createElement("tr");


        const renewalDays =
          daysUntil(
            contract.renewalDate
          );


        let renewalHTML = "-";


        if (
          renewalDays >= 0 &&
          renewalDays <= 90
        ) {

          renewalHTML = `
            <span class="renewal-warning">
              ${renewalDays} gün
            </span>
          `;

        }
        else if (
          contract.renewalDate
        ) {

          renewalHTML =
            formatDate(
              contract.renewalDate
            );

        }


        row.innerHTML = `

          <td>
            <span class="contract-id">
              ${escapeHTML(contract.id)}
            </span>
          </td>

          <td>
            ${escapeHTML(contract.company)}
          </td>

          <td>
            <span class="supplier">
              ${escapeHTML(contract.supplier)}
            </span>
          </td>

          <td class="date">
            ${formatDate(contract.startDate)}
          </td>

          <td class="date">
            ${formatDate(contract.endDate)}
          </td>

          <td>
            ${formatCurrency(
              contract.monthlyPayment
            )}
          </td>

          <td>

            <span class="status ${contract.status}">

              ${
                contract.status === "active"
                  ? "Aktif"
                  : "Pasif"
              }

            </span>

          </td>

          <td>
            ${renewalHTML}
          </td>

          <td>

            <button
              class="row-action"
              data-id="${escapeHTML(contract.id)}"
            >
              Görüntüle
            </button>

          </td>

        `;


        const viewButton =
          row.querySelector(
            ".row-action"
          );


        viewButton?.addEventListener(
          "click",
          function () {

            openDetail(
              contract.id
            );

          }
        );


        contractTableBody.appendChild(
          row
        );

      }
    );

  }


  /* =====================================================
     COMPANY FILTER
  ===================================================== */

  function updateCompanyFilter() {

    if (!companyFilter) {
      return;
    }


    const currentValue =
      companyFilter.value;


    const companies =
      [
        ...new Set(
          contracts.map(
            contract =>
              contract.company
          )
        )
      ];


    companyFilter.innerHTML = `
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

        companyFilter.appendChild(
          option
        );

      }
    );


    if (
      companies.includes(
        currentValue
      )
    ) {

      companyFilter.value =
        currentValue;

    }

  }


  /* =====================================================
     CONTRACT CREATION
  ===================================================== */

  function createContract(data) {

    const calculation =
      calculateTFRS16(data);


    return {

      ...data,

      status: "active",

      modification: false,

      leaseLiability:
        calculation.leaseLiability,

      rouAsset:
        calculation.rouAsset,

      monthlyInterest:
        calculation.monthlyInterest,

      monthlyDepreciation:
        calculation.monthlyDepreciation,

      termMonths:
        calculation.termMonths,

      createdAt:
        new Date().toISOString()

    };

  }


  /* =====================================================
     TFRS 16 INITIAL MEASUREMENT
  ===================================================== */

  function calculateTFRS16(data) {

    const startDate =
      new Date(
        data.startDate
      );

    const endDate =
      new Date(
        data.endDate
      );


    const termMonths =
      monthDifference(
        startDate,
        endDate
      );


    const annualRate =
      Number(
        data.discountRate
      ) / 100;


    const monthlyRate =
      Math.pow(
        1 + annualRate,
        1 / 12
      ) - 1;


    let leaseLiability = 0;


    for (
      let month = 1;
      month <= termMonths;
      month++
    ) {

      leaseLiability +=
        Number(
          data.monthlyPayment
        ) /
        Math.pow(
          1 + monthlyRate,
          month
        );

    }


    const rouAsset =
      leaseLiability;


    const monthlyInterest =
      leaseLiability *
      monthlyRate;


    const monthlyDepreciation =
      rouAsset /
      termMonths;


    return {

      leaseLiability,

      rouAsset,

      monthlyInterest,

      monthlyDepreciation,

      termMonths,

      monthlyRate

    };

  }


  /* =====================================================
     SCHEDULE ENGINE
  ===================================================== */

  function buildSchedule(contract) {

    const termMonths =
      Number(
        contract.termMonths
      );

    const payment =
      Number(
        contract.monthlyPayment
      );


    const annualRate =
      Number(
        contract.discountRate
      ) / 100;


    const monthlyRate =
      Math.pow(
        1 + annualRate,
        1 / 12
      ) - 1;


    let openingLiability =
      Number(
        contract.leaseLiability
      );


    let openingROU =
      Number(
        contract.rouAsset
      );


    const monthlyDepreciation =
      openingROU /
      termMonths;


    const schedule = [];


    const startDate =
      new Date(
        contract.startDate
      );


    for (
      let period = 1;
      period <= termMonths;
      period++
    ) {

      const periodDate =
        new Date(startDate);


      periodDate.setMonth(
        periodDate.getMonth() +
        period
      );


      const interest =
        openingLiability *
        monthlyRate;


      const principal =
        Math.min(
          Math.max(
            0,
            payment - interest
          ),
          openingLiability
        );


      const closingLiability =
        Math.max(
          0,
          openingLiability -
          principal
        );


      const depreciation =
        Math.min(
          monthlyDepreciation,
          openingROU
        );


      const closingROU =
        Math.max(
          0,
          openingROU -
          depreciation
        );


      schedule.push({

        period,

        date:
          periodDate
            .toISOString()
            .split("T")[0],

        openingLiability,

        payment,

        interest,

        principal,

        closingLiability,

        openingROU,

        depreciation,

        closingROU

      });


      openingLiability =
        closingLiability;

      openingROU =
        closingROU;

    }


    return schedule;

  }


  /* =====================================================
     DETAIL VIEW
  ===================================================== */

  function openDetail(id) {

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


    if (detailTitle) {

      detailTitle.textContent =
        contract.id;

    }


    const schedule =
      buildSchedule(
        contract
      );


    const first12Months =
      schedule.slice(
        0,
        12
      );


    const totalInterest12 =
      first12Months.reduce(
        (sum, row) =>
          sum + row.interest,
        0
      );


    const totalPrincipal12 =
      first12Months.reduce(
        (sum, row) =>
          sum + row.principal,
        0
      );


    const totalDepreciation12 =
      first12Months.reduce(
        (sum, row) =>
          sum + row.depreciation,
        0
      );


    const totalCash12 =
      first12Months.reduce(
        (sum, row) =>
          sum + row.payment,
        0
      );


    const renewalDays =
      daysUntil(
        contract.renewalDate
      );


    let renewalMessage =
      "Tanımlanmamış";


    if (
      renewalDays >= 0 &&
      renewalDays <= 90
    ) {

      renewalMessage =
        `${renewalDays} gün içinde`;

    }
    else if (
      contract.renewalDate
    ) {

      renewalMessage =
        formatDate(
          contract.renewalDate
        );

    }


    let html = `

      <!-- SUMMARY -->

      <div class="detail-grid">

        ${detailItem(
          "Sözleşme",
          contract.id
        )}

        ${detailItem(
          "Şirket",
          contract.company
        )}

        ${detailItem(
          "Tedarikçi",
          contract.supplier
        )}

        ${detailItem(
          "Aylık Kira",
          formatCurrency(
            contract.monthlyPayment
          )
        )}

        ${detailItem(
          "Lease Liability",
          formatCurrency(
            contract.leaseLiability
          )
        )}

        ${detailItem(
          "ROU Asset",
          formatCurrency(
            contract.rouAsset
          )
        )}

        ${detailItem(
          "İskonto Oranı",
          `%${Number(
            contract.discountRate
          ).toFixed(2)}`
        )}

        ${detailItem(
          "Vade",
          `${contract.termMonths} ay`
        )}

        ${detailItem(
          "Aylık Faiz",
          formatCurrency(
            contract.monthlyInterest
          )
        )}

        ${detailItem(
          "Aylık Amortisman",
          formatCurrency(
            contract.monthlyDepreciation
          )
        )}

        ${detailItem(
          "Yenileme",
          renewalMessage
        )}

        ${detailItem(
          "Durum",
          contract.status === "active"
            ? "Aktif"
            : "Pasif"
        )}

      </div>


      <!-- MANAGEMENT METRICS -->

      <div class="v3-metric-grid">

        ${managementMetric(
          "12A Faiz",
          formatCurrency(
            totalInterest12
          )
        )}

        ${managementMetric(
          "12A Anapara",
          formatCurrency(
            totalPrincipal12
          )
        )}

        ${managementMetric(
          "12A Amortisman",
          formatCurrency(
            totalDepreciation12
          )
        )}

        ${managementMetric(
          "12A Nakit Çıkışı",
          formatCurrency(
            totalCash12
          )
        )}

      </div>


      <!-- FINANCIAL IMPACT -->

      ${renderFinancialImpact(
        contract,
        first12Months[0]
      )}


      <!-- ACCOUNTING -->

      ${renderAccountingEntries(
        contract,
        1
      )}


      <!-- SCHEDULE -->

      <div class="v3-section">

        <h3>
          TFRS 16 Ödeme Planı
        </h3>

        <p class="v3-description">
          İlk 12 aylık lease liability ve ROU hareketi
        </p>

        <div class="v3-table-wrapper">

          <table class="v3-table">

            <thead>

              <tr>

                <th>Dönem</th>
                <th>Tarih</th>
                <th>Açılış Yük.</th>
                <th>Faiz</th>
                <th>Ödeme</th>
                <th>Anapara</th>
                <th>Kapanış Yük.</th>
                <th>Amortisman</th>
                <th>ROU Net</th>

              </tr>

            </thead>

            <tbody>

              ${first12Months
                .map(
                  row => `

                    <tr>

                      <td>
                        ${row.period}
                      </td>

                      <td>
                        ${formatDate(
                          row.date
                        )}
                      </td>

                      <td>
                        ${formatCurrency(
                          row.openingLiability
                        )}
                      </td>

                      <td>
                        ${formatCurrency(
                          row.interest
                        )}
                      </td>

                      <td>
                        ${formatCurrency(
                          row.payment
                        )}
                      </td>

                      <td>
                        ${formatCurrency(
                          row.principal
                        )}
                      </td>

                      <td>
                        ${formatCurrency(
                          row.closingLiability
                        )}
                      </td>

                      <td>
                        ${formatCurrency(
                          row.depreciation
                        )}
                      </td>

                      <td>
                        ${formatCurrency(
                          row.closingROU
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


      <!-- CFO ACTION CENTER -->

      ${renderCFOActions(
        contract
      )}

    `;


    if (detailContent) {

      detailContent.innerHTML =
        html;

    }


    detailModal?.classList.remove(
      "hidden"
    );

  }


  /* =====================================================
     FINANCIAL IMPACT
  ===================================================== */

  function calculateFinancialImpact(
    contract,
    period
  ) {

    const schedule =
      buildSchedule(
        contract
      );


    const row =
      schedule[
        period - 1
      ];


    if (!row) {
      return null;
    }


    return {

      rouAsset:
        row.closingROU,

      leaseLiability:
        row.closingLiability,

      depreciationExpense:
        row.depreciation,

      interestExpense:
        row.interest,

      cashOutflow:
        row.payment,

      ebitdaImpact:
        0,

      totalPnlImpact:
        row.depreciation +
        row.interest

    };

  }


  /* =====================================================
     FINANCIAL IMPACT HTML
  ===================================================== */

  function renderFinancialImpact(
    contract,
    period
  ) {

    const impact =
      calculateFinancialImpact(
        contract,
        period
      );


    if (!impact) {
      return "";
    }


    return `

      <div class="v3-section">

        <h3>
          Finansal Tablo Etkisi
        </h3>

        <div class="v3-metric-grid">

          ${managementMetric(
            "ROU Asset",
            formatCurrency(
              impact.rouAsset
            )
          )}

          ${managementMetric(
            "Lease Liability",
            formatCurrency(
              impact.leaseLiability
            )
          )}

          ${managementMetric(
            "Amortisman Gideri",
            formatCurrency(
              impact.depreciationExpense
            )
          )}

          ${managementMetric(
            "Finansman Gideri",
            formatCurrency(
              impact.interestExpense
            )
          )}

          ${managementMetric(
            "Nakit Çıkışı",
            formatCurrency(
              impact.cashOutflow
            )
          )}

          ${managementMetric(
            "EBITDA Etkisi",
            "₺0"
          )}

        </div>

      </div>

    `;

  }


  /* =====================================================
     ACCOUNTING ENGINE
  ===================================================== */

  function generateAccountingEntries(
    contract,
    period = 1
  ) {

    const schedule =
      buildSchedule(
        contract
      );


    const row =
      schedule[
        period - 1
      ];


    if (!row) {
      return [];
    }


    return [

      {
        type:
          "ROU Amortismanı",

        debit:
          "Amortisman Gideri",

        credit:
          "Birikmiş Amortisman - ROU",

        amount:
          row.depreciation
      },

      {
        type:
          "Faiz Tahakkuku",

        debit:
          "Finansman Gideri",

        credit:
          "Kira Yükümlülüğü",

        amount:
          row.interest
      },

      {
        type:
          "Kira Ödemesi",

        debit:
          "Kira Yükümlülüğü",

        credit:
          "Banka",

        amount:
          row.payment
      }

    ];

  }


  /* =====================================================
     ACCOUNTING HTML
  ===================================================== */

  function renderAccountingEntries(
    contract,
    period = 1
  ) {

    const entries =
      generateAccountingEntries(
        contract,
        period
      );


    if (
      entries.length === 0
    ) {

      return "";

    }


    return `

      <div class="v3-section">

        <h3>
          Muhasebe Fişi
        </h3>

        <p class="v3-description">
          Dönem ${period} için önerilen TFRS 16 kayıtları
        </p>

        <div class="v3-table-wrapper">

          <table class="v3-table">

            <thead>

              <tr>

                <th>
                  İşlem
                </th>

                <th>
                  Borç
                </th>

                <th>
                  Alacak
                </th>

                <th>
                  Tutar
                </th>

              </tr>

            </thead>

            <tbody>

              ${entries
                .map(
                  entry => `

                    <tr>

                      <td>
                        ${escapeHTML(
                          entry.type
                        )}
                      </td>

                      <td>
                        ${escapeHTML(
                          entry.debit
                        )}
                      </td>

                      <td>
                        ${escapeHTML(
                          entry.credit
                        )}
                      </td>

                      <td>
                        <strong>
                          ${formatCurrency(
                            entry.amount
                          )}
                        </strong>
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


  /* =====================================================
     CFO ACTION ENGINE
  ===================================================== */

  function generateCFOActions(
    contract
  ) {

    const actions = [];


    const renewalDays =
      daysUntil(
        contract.renewalDate
      );


    if (
      renewalDays >= 0 &&
      renewalDays <= 90
    ) {

      actions.push({

        severity:
          "high",

        title:
          "Yaklaşan sözleşme yenilemesi",

        description:
          `${contract.id} sözleşmesinin yenileme tarihi ${renewalDays} gün içinde.`,

        action:
          "Yenileme veya sonlandırma kararının yönetim tarafından değerlendirilmesi önerilir."

      });

    }


    const next12 =
      calculateNext12MonthsCashOutflow(
        contract
      );


    if (
      next12 >= 1000000
    ) {

      actions.push({

        severity:
          "medium",

        title:
          "Yüksek nakit çıkışı",

        description:
          `Önümüzdeki 12 aylık kira ödemesi ${formatCurrency(next12)}.`,

        action:
          "Likidite ve nakit akışı planlamasında dikkate alınmalıdır."

      });

    }


    if (
      contract.modification === true
    ) {

      actions.push({

        severity:
          "high",

        title:
          "Sözleşme değişikliği",

        description:
          "Sözleşmede modification işareti bulunmaktadır.",

        action:
          "TFRS 16 kapsamında yeniden ölçüm değerlendirmesi yapılmalıdır."

      });

    }


    if (
      actions.length === 0
    ) {

      actions.push({

        severity:
          "low",

        title:
          "Normal",

        description:
          "Sözleşme için kritik bir aksiyon tespit edilmedi.",

        action:
          "Normal dönemsel izleme devam etmelidir."

      });

    }


    return actions;

  }


  /* =====================================================
     CFO ACTION HTML
  ===================================================== */

  function renderCFOActions(
    contract
  ) {

    const actions =
      generateCFOActions(
        contract
      );


    return `

      <div class="v3-section">

        <h3>
          CFO Action Center
        </h3>

        <div class="v3-actions">

          ${actions
            .map(
              action => {

                let className =
                  "v3-action-normal";


                if (
                  action.severity ===
                  "high"
                ) {

                  className =
                    "v3-action-high";

                }
                else if (
                  action.severity ===
                  "medium"
                ) {

                  className =
                    "v3-action-medium";

                }


                return `

                  <div class="
                    v3-action
                    ${className}
                  ">

                    <strong>
                      ${escapeHTML(
                        action.title
                      )}
                    </strong>

                    <p>
                      ${escapeHTML(
                        action.description
                      )}
                    </p>

                    <span>
                      <strong>
                        Aksiyon:
                      </strong>
                      ${escapeHTML(
                        action.action
                      )}
                    </span>

                  </div>

                `;

              }
            )
            .join("")}

        </div>

      </div>

    `;

  }


  /* =====================================================
     NEXT 12 MONTH CASH FLOW
  ===================================================== */

  function calculateNext12MonthsCashOutflow(
    contract
  ) {

    const schedule =
      buildSchedule(
        contract
      );


    return schedule
      .slice(
        0,
        12
      )
      .reduce(
        (sum, row) =>
          sum + row.payment,
        0
      );

  }


  /* =====================================================
     NEW CONTRACT MODAL
  ===================================================== */

  function openNewContractModal() {

    contractForm?.reset();


    const company =
      document.getElementById(
        "company"
      );


    const discountRate =
      document.getElementById(
        "discountRate"
      );


    if (company) {

      company.value =
        "GK Holding";

    }


    if (discountRate) {

      discountRate.value =
        "18";

    }


    contractModal?.classList.remove(
      "hidden"
    );

  }


  function closeContractModal() {

    contractModal?.classList.add(
      "hidden"
    );

  }


  /* =====================================================
     CREATE CONTRACT
  ===================================================== */

  function handleContractSubmit(
    event
  ) {

    event.preventDefault();


    const data = {

      id:
        getValue("contractId"),

      company:
        getValue("company"),

      supplier:
        getValue("supplier"),

      monthlyPayment:
        Number(
          getValue(
            "monthlyPayment"
          )
        ),

      startDate:
        getValue(
          "startDate"
        ),

      endDate:
        getValue(
          "endDate"
        ),

      discountRate:
        Number(
          getValue(
            "discountRate"
          )
        ),

      renewalDate:
        getValue(
          "renewalDate"
        )

    };


    if (
      !data.id ||
      !data.company ||
      !data.supplier ||
      !data.monthlyPayment ||
      !data.startDate ||
      !data.endDate ||
      !data.discountRate
    ) {

      alert(
        "Lütfen zorunlu alanları doldurun."
      );

      return;

    }


    if (
      new Date(
        data.endDate
      ) <=
      new Date(
        data.startDate
      )
    ) {

      alert(
        "Bitiş tarihi başlangıç tarihinden sonra olmalıdır."
      );

      return;

    }


    if (
      contracts.some(
        contract =>
          contract.id === data.id
      )
    ) {

      alert(
        "Bu sözleşme ID'si zaten mevcut."
      );

      return;

    }


    contracts.push(
      createContract(
        data
      )
    );


    saveContracts();


    closeContractModal();


    render();

  }


  /* =====================================================
     DELETE CONTRACT
  ===================================================== */

  function handleDelete() {

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


    saveContracts();


    closeDetail();


    render();

  }


  /* =====================================================
     CLOSE DETAIL
  ===================================================== */

  function closeDetail() {

    selectedContractId =
      null;


    detailModal?.classList.add(
      "hidden"
    );

  }


  /* =====================================================
     STORAGE
  ===================================================== */

  function loadContracts() {

    try {

      const stored =
        localStorage.getItem(
          STORAGE_KEY
        );


      if (!stored) {

        return [];

      }


      const parsed =
        JSON.parse(
          stored
        );


      return Array.isArray(
        parsed
      )
        ? parsed
        : [];

    }
    catch (error) {

      console.error(
        "TFRS 16 storage error:",
        error
      );

      return [];

    }

  }


  function saveContracts() {

    try {

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
          contracts
        )
      );

    }
    catch (error) {

      console.error(
        "TFRS 16 save error:",
        error
      );

    }

  }


  /* =====================================================
     HELPERS
  ===================================================== */

  function getValue(id) {

    return (
      document
        .getElementById(id)
        ?.value
        ?.trim() || ""
    );

  }


  function formatCurrency(
    value
  ) {

    return Number(
      value || 0
    ).toLocaleString(
      "tr-TR",
      {
        style:
          "currency",

        currency:
          "TRY",

        maximumFractionDigits:
          0
      }
    );

  }


  function formatDate(
    value
  ) {

    if (!value) {

      return "-";

    }


    const date =
      new Date(
        value
      );


    if (
      Number.isNaN(
        date.getTime()
      )
    ) {

      return "-";

    }


    return date.toLocaleDateString(
      "tr-TR"
    );

  }


  function monthDifference(
    start,
    end
  ) {

    return Math.max(
      1,

      (
        (
          end.getFullYear() -
          start.getFullYear()
        ) * 12
      ) +

      (
        end.getMonth() -
        start.getMonth()
      ) +

      1
    );

  }


  function daysUntil(
    value
  ) {

    if (!value) {

      return 9999;

    }


    const target =
      new Date(
        value
      );


    const today =
      new Date();


    target.setHours(
      0,
      0,
      0,
      0
    );


    today.setHours(
      0,
      0,
      0,
      0
    );


    return Math.ceil(
      (
        target -
        today
      ) /
      86400000
    );

  }


  function detailItem(
    label,
    value
  ) {

    return `

      <div class="detail-item">

        <span>
          ${escapeHTML(
            label
          )}
        </span>

        <strong>
          ${escapeHTML(
            value
          )}
        </strong>

      </div>

    `;

  }


  function managementMetric(
    label,
    value
  ) {

    return `

      <div class="v3-metric">

        <div>
          ${escapeHTML(
            label
          )}
        </div>

        <strong>
          ${escapeHTML(
            value
          )}
        </strong>

      </div>

    `;

  }


  function escapeHTML(
    value
  ) {

    return String(
      value ?? ""
    )
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


  /* =====================================================
     V3 DETAIL CSS
     Injected automatically
  ===================================================== */

  const v3Style =
    document.createElement(
      "style"
    );


  v3Style.textContent = `

    .v3-section {
      margin-top: 22px;
    }

    .v3-section h3 {
      margin: 0 0 6px;
      font-size: 15px;
      color: #172033;
    }

    .v3-description {
      margin: 0 0 12px;
      color: #64748b;
      font-size: 10px;
    }

    .v3-metric-grid {
      display: grid;
      grid-template-columns:
        repeat(4, 1fr);
      gap: 10px;
      margin-top: 18px;
    }

    .v3-metric {
      background: #f8fafc;
      border: 1px solid #e5e7eb;
      border-radius: 9px;
      padding: 12px;
    }

    .v3-metric div {
      color: #64748b;
      font-size: 9px;
    }

    .v3-metric strong {
      display: block;
      margin-top: 5px;
      font-size: 14px;
      color: #172033;
    }

    .v3-table-wrapper {
      overflow-x: auto;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
    }

    .v3-table {
      width: 100%;
      border-collapse: collapse;
      min-width: 900px;
    }

    .v3-table th {
      padding: 10px;
      text-align: left;
      font-size: 9px;
      color: #64748b;
      background: #f8fafc;
      white-space: nowrap;
    }

    .v3-table td {
      padding: 10px;
      border-top: 1px solid #edf0f4;
      font-size: 9px;
      white-space: nowrap;
    }

    .v3-actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .v3-action {
      border-radius: 9px;
      padding: 12px;
      border: 1px solid #e5e7eb;
    }

    .v3-action strong {
      font-size: 11px;
    }

    .v3-action p {
      margin: 5px 0;
      font-size: 10px;
      color: #64748b;
    }

    .v3-action span {
      font-size: 10px;
      color: #172033;
    }

    .v3-action-high {
      background: #fff7ed;
      border-color: #fed7aa;
    }

    .v3-action-medium {
      background: #fffbeb;
      border-color: #fde68a;
    }

    .v3-action-normal {
      background: #f8fafc;
    }

    @media (max-width: 700px) {

      .v3-metric-grid {
        grid-template-columns:
          repeat(2, 1fr);
      }

    }

  `;


  document.head.appendChild(
    v3Style
  );


  /* =====================================================
     DEBUG
  ===================================================== */

  console.log(
    "GK TFRS 16 V3 loaded successfully.",
    contracts
  );

});
