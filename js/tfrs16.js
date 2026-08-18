document.addEventListener("DOMContentLoaded", function () {

  /*
  =====================================================
  TFRS 16 CONTRACT ENGINE
  GK FINANCE INTELLIGENCE PLATFORM
  =====================================================
  */

  const STORAGE_KEY = "gk_tfrs16_contracts";


  /*
  =====================================================
  DOM
  =====================================================
  */

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

  const deleteContract =
    document.getElementById("deleteContract");


  /*
  =====================================================
  STATE
  =====================================================
  */

  let contracts =
    loadContracts();

  let selectedContractId =
    null;


  /*
  =====================================================
  INITIAL LOAD
  =====================================================
  */

  render();


  /*
  =====================================================
  SAMPLE DATA
  İlk kullanımda boş ekran yerine
  demo portföy gösteriyoruz.
  =====================================================
  */

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

    render();

  }


  /*
  =====================================================
  NEW CONTRACT
  =====================================================
  */

  if (newContractButton) {

    newContractButton.addEventListener(
      "click",
      function () {

        openNewContractModal();

      }
    );

  }


  /*
  =====================================================
  CLOSE MODAL
  =====================================================
  */

  if (closeModal) {

    closeModal.addEventListener(
      "click",
      closeContractModal
    );

  }


  if (cancelModal) {

    cancelModal.addEventListener(
      "click",
      closeContractModal
    );

  }


  /*
  =====================================================
  FORM SUBMIT
  =====================================================
  */

  if (contractForm) {

    contractForm.addEventListener(
      "submit",
      function (event) {

        event.preventDefault();

        const contract =
          getContractFromForm();

        if (!contract) {
          return;
        }

        contracts.push(contract);

        saveContracts();

        closeContractModal();

        render();

      }
    );

  }


  /*
  =====================================================
  SEARCH
  =====================================================
  */

  if (searchInput) {

    searchInput.addEventListener(
      "input",
      renderTable
    );

  }


  /*
  =====================================================
  FILTER
  =====================================================
  */

  if (statusFilter) {

    statusFilter.addEventListener(
      "change",
      renderTable
    );

  }


  if (companyFilter) {

    companyFilter.addEventListener(
      "change",
      renderTable
    );

  }


  /*
  =====================================================
  DETAIL MODAL
  =====================================================
  */

  if (closeDetailModal) {

    closeDetailModal.addEventListener(
      "click",
      closeDetail
    );

  }


  if (detailCloseButton) {

    detailCloseButton.addEventListener(
      "click",
      closeDetail
    );

  }


  /*
  =====================================================
  DELETE
  =====================================================
  */

  if (deleteContract) {

    deleteContract.addEventListener(
      "click",
      function () {

        if (!selectedContractId) {
          return;
        }

        const contract =
          contracts.find(
            item =>
              item.id === selectedContractId
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
              item.id !== selectedContractId
          );

        saveContracts();

        closeDetail();

        render();

      }
    );

  }


  /*
  =====================================================
  RENDER
  =====================================================
  */

  function render() {

    updateKPIs();

    updateCompanyFilter();

    renderTable();

  }


  /*
  =====================================================
  KPI
  =====================================================
  */

  function updateKPIs() {

    const activeContracts =
      contracts.filter(
        contract =>
          contract.status === "active"
      );


    const totalLeaseLiability =
      activeContracts.reduce(
        (sum, contract) =>
          sum + contract.leaseLiability,
        0
      );


    const totalROU =
      activeContracts.reduce(
        (sum, contract) =>
          sum + contract.rouAsset,
        0
      );


    const next12Months =
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
        contract =>
          daysUntil(
            contract.renewalDate
          ) <= 90 &&
          daysUntil(
            contract.renewalDate
          ) >= 0
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
          next12Months
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


  /*
  =====================================================
  TABLE
  =====================================================
  */

  function renderTable() {

    if (!contractTableBody) {
      return;
    }


    const search =
      searchInput
        ? searchInput.value
            .trim()
            .toLowerCase()
        : "";


    const status =
      statusFilter
        ? statusFilter.value
        : "all";


    const company =
      companyFilter
        ? companyFilter.value
        : "all";


    const filtered =
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
        `${filtered.length} kayıt`;

    }


    if (emptyState) {

      emptyState.classList.toggle(
        "hidden",
        filtered.length !== 0
      );

    }


    filtered.forEach(
      contract => {

        const row =
          document.createElement("tr");


        const renewalDays =
          daysUntil(
            contract.renewalDate
          );


        const renewalHTML =
          renewalDays >= 0 &&
          renewalDays <= 90

            ? `<span class="renewal-warning">
                ${renewalDays} gün
               </span>`

            : contract.renewalDate
              ? formatDate(
                  contract.renewalDate
                )
              : "-";


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
              ${contract.status === "active"
                ? "Aktif"
                : "Pasif"}
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


        const button =
          row.querySelector(
            ".row-action"
          );


        if (button) {

          button.addEventListener(
            "click",
            function () {

              openDetail(
                contract.id
              );

            }
          );

        }


        contractTableBody.appendChild(row);

      }
    );

  }


  /*
  =====================================================
  COMPANY FILTER
  =====================================================
  */

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


    companyFilter.innerHTML =
      `<option value="all">
        Tüm Şirketler
      </option>`;


    companies.forEach(
      company => {

        const option =
          document.createElement(
            "option"
          );

        option.value = company;

        option.textContent = company;

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


  /*
  =====================================================
  CREATE CONTRACT
  =====================================================
  */

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


  /*
  =====================================================
  GET FORM DATA
  =====================================================
  */

  function getContractFromForm() {

    const id =
      getValue("contractId");

    const company =
      getValue("company");

    const supplier =
      getValue("supplier");

    const monthlyPayment =
      Number(
        getValue("monthlyPayment")
      );

    const startDate =
      getValue("startDate");

    const endDate =
      getValue("endDate");

    const discountRate =
      Number(
        getValue("discountRate")
      );

    const renewalDate =
      getValue("renewalDate");


    if (
      !id ||
      !company ||
      !supplier ||
      !monthlyPayment ||
      !startDate ||
      !endDate ||
      !discountRate
    ) {

      alert(
        "Lütfen zorunlu alanları doldurun."
      );

      return null;

    }


    if (
      new Date(endDate) <=
      new Date(startDate)
    ) {

      alert(
        "Bitiş tarihi başlangıç tarihinden sonra olmalıdır."
      );

      return null;

    }


    if (
      contracts.some(
        contract =>
          contract.id === id
      )
    ) {

      alert(
        "Bu sözleşme ID'si zaten mevcut."
      );

      return null;

    }


    return createContract({

      id,
      company,
      supplier,
      monthlyPayment,
      startDate,
      endDate,
      discountRate,
      renewalDate

    });

  }


  /*
  =====================================================
  TFRS 16 CALCULATION ENGINE
  =====================================================
  */

  function calculateTFRS16(data) {

    const start =
      new Date(data.startDate);

    const end =
      new Date(data.endDate);


    const termMonths =
      monthDifference(
        start,
        end
      );


    const monthlyRate =
      Math.pow(
        1 + Number(data.discountRate) / 100,
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

      termMonths

    };

  }


  /*
  =====================================================
  NEXT 12 MONTH CASH FLOW
  =====================================================
  */

  function calculateNext12MonthsCashOutflow(
    contract
  ) {

    const start =
      new Date(contract.startDate);

    const end =
      new Date(contract.endDate);

    const today =
      new Date();


    let effectiveStart =
      start > today
        ? start
        : today;


    let months =
      monthDifference(
        effectiveStart,
        end
      );


    months =
      Math.max(
        0,
        Math.min(
          12,
          months
        )
      );


    return (
      months *
      Number(
        contract.monthlyPayment
      )
    );

  }


  /*
  =====================================================
  DETAIL
  =====================================================
  */

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


    const days =
      daysUntil(
        contract.renewalDate
      );


    const renewalStatus =
      days >= 0 && days <= 90
        ? `${days} gün içinde yenileme riski`
        : contract.renewalDate
          ? formatDate(
              contract.renewalDate
            )
          : "Tanımlanmamış";


    const totalInterest =
      contract.leaseLiability *
      (
        Math.pow(
          1 +
          (
            Number(
              contract.discountRate
            ) / 100
          ),
          1
        ) - 1
      );


    if (detailContent) {

      detailContent.innerHTML = `

        <div class="detail-grid">

          <div class="detail-item">
            <span>Sözleşme</span>
            <strong>
              ${escapeHTML(contract.id)}
            </strong>
          </div>

          <div class="detail-item">
            <span>Şirket</span>
            <strong>
              ${escapeHTML(contract.company)}
            </strong>
          </div>

          <div class="detail-item">
            <span>Tedarikçi</span>
            <strong>
              ${escapeHTML(contract.supplier)}
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
            <span>Kira Yükümlülüğü</span>
            <strong>
              ${formatCurrency(
                contract.leaseLiability
              )}
            </strong>
          </div>

          <div class="detail-item">
            <span>ROU Varlığı</span>
            <strong>
              ${formatCurrency(
                contract.rouAsset
              )}
            </strong>
          </div>

          <div class="detail-item">
            <span>İskonto Oranı</span>
            <strong>
              %${Number(
                contract.discountRate
              ).toFixed(2)}
            </strong>
          </div>

          <div class="detail-item">
            <span>Vade</span>
            <strong>
              ${contract.termMonths} ay
            </strong>
          </div>

          <div class="detail-item">
            <span>Aylık Faiz</span>
            <strong>
              ${formatCurrency(
                contract.monthlyInterest
              )}
            </strong>
          </div>

          <div class="detail-item">
            <span>Aylık Amortisman</span>
            <strong>
              ${formatCurrency(
                contract.monthlyDepreciation
              )}
            </strong>
          </div>

          <div class="detail-item">
            <span>Önümüzdeki 12 Ay</span>
            <strong>
              ${formatCurrency(
                calculateNext12MonthsCashOutflow(
                  contract
                )
              )}
            </strong>
          </div>

          <div class="detail-item">
            <span>Yenileme</span>
            <strong>
              ${renewalStatus}
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
            <span>Durum</span>
            <strong>
              ${
                contract.status === "active"
                  ? "Aktif"
                  : "Pasif"
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

        <div style="
          margin-top:18px;
          padding:14px;
          background:#f8fafc;
          border-radius:10px;
          font-size:11px;
          color:#64748b;
          line-height:1.6;
        ">

          <strong style="color:#172033;">
            CFO Notu
          </strong>

          <br>

          Bu sözleşmenin TFRS 16 etkisi yalnızca
          bilanço yükümlülüğü ile sınırlı değildir.
          Gelecek 12 aylık nakit çıkışı,
          faiz maliyeti, ROU amortismanı ve
          yenileme riski birlikte değerlendirilmelidir.

        </div>

      `;

    }


    if (detailModal) {

      detailModal.classList.remove(
        "hidden"
      );

    }

  }


  /*
  =====================================================
  MODAL FUNCTIONS
  =====================================================
  */

  function openNewContractModal() {

    if (contractForm) {

      contractForm.reset();

    }


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


    if (contractModal) {

      contractModal.classList.remove(
        "hidden"
      );

    }

  }


  function closeContractModal() {

    if (contractModal) {

      contractModal.classList.add(
        "hidden"
      );

    }

  }


  function closeDetail() {

    selectedContractId =
      null;

    if (detailModal) {

      detailModal.classList.add(
        "hidden"
      );

    }

  }


  /*
  =====================================================
  STORAGE
  =====================================================
  */

  function loadContracts() {

    try {

      const stored =
        localStorage.getItem(
          STORAGE_KEY
        );


      if (!stored) {
        return [];
      }


      return JSON.parse(
        stored
      );

    } catch (error) {

      console.error(
        "TFRS16 storage error:",
        error
      );

      return [];

    }

  }


  function saveContracts() {

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        contracts
      )
    );

  }


  /*
  =====================================================
  UTILITIES
  =====================================================
  */

  function getValue(id) {

    const element =
      document.getElementById(id);

    return element
      ? element.value.trim()
      : "";

  }


  function formatCurrency(value) {

    return Number(
      value || 0
    ).toLocaleString(
      "tr-TR",
      {
        style: "currency",
        currency: "TRY",
        maximumFractionDigits: 0
      }
    );

  }


  function formatDate(value) {

    if (!value) {
      return "-";
    }


    const date =
      new Date(value);


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
        (end.getFullYear() -
          start.getFullYear()) *
          12
      ) +
      (
        end.getMonth() -
        start.getMonth()
      ) +
      1
    );

  }


  function daysUntil(value) {

    if (!value) {
      return 9999;
    }


    const target =
      new Date(value);


    const today =
      new Date();


    target.setHours(
      0, 0, 0, 0
    );

    today.setHours(
      0, 0, 0, 0
    );


    return Math.ceil(
      (
        target - today
      ) /
      (
        1000 *
        60 *
        60 *
        24
      )
    );

  }


  function escapeHTML(value) {

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


  /*
  =====================================================
  DEBUG
  =====================================================
  */

  console.log(
    "GK TFRS 16 Engine loaded.",
    contracts
  );

});
