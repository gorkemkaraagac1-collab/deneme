document.addEventListener("DOMContentLoaded", function () {

  const STORAGE_KEY = "gk_tfrs16_contracts";

  const contractTableBody = document.getElementById("contractTableBody");
  const contractCount = document.getElementById("contractCount");
  const leaseLiabilityEl = document.getElementById("leaseLiability");
  const rouAssetsEl = document.getElementById("rouAssets");
  const next12MonthsEl = document.getElementById("next12Months");
  const renewals90DaysEl = document.getElementById("renewals90Days");
  const modificationsEl = document.getElementById("modifications");

  const resultCount = document.getElementById("resultCount");
  const emptyState = document.getElementById("emptyState");

  const searchInput = document.getElementById("searchInput");
  const statusFilter = document.getElementById("statusFilter");
  const companyFilter = document.getElementById("companyFilter");

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

  let contracts = loadContracts();
  let selectedContractId = null;

  /*
  =====================================================
  INITIAL DATA
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
  }

  render();


  /*
  =====================================================
  EVENTS
  =====================================================
  */

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

  deleteContract?.addEventListener(
    "click",
    handleDelete
  );


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
        c => c.status === "active"
      );

    const totalLeaseLiability =
      activeContracts.reduce(
        (sum, c) =>
          sum + Number(c.leaseLiability || 0),
        0
      );

    const totalROU =
      activeContracts.reduce(
        (sum, c) =>
          sum + Number(c.rouAsset || 0),
        0
      );

    const next12Months =
      activeContracts.reduce(
        (sum, c) =>
          sum + calculateNext12MonthsCashOutflow(c),
        0
      );

    const renewalRisk =
      activeContracts.filter(c => {

        const days =
          daysUntil(c.renewalDate);

        return days >= 0 && days <= 90;

      }).length;

    const modifications =
      activeContracts.filter(
        c => c.modification === true
      ).length;

    contractCount.textContent =
      activeContracts.length;

    leaseLiabilityEl.textContent =
      formatCurrency(totalLeaseLiability);

    rouAssetsEl.textContent =
      formatCurrency(totalROU);

    next12MonthsEl.textContent =
      formatCurrency(next12Months);

    renewals90DaysEl.textContent =
      renewalRisk;

    modificationsEl.textContent =
      modifications;

  }


  /*
  =====================================================
  TABLE
  =====================================================
  */

  function renderTable() {

    const search =
      searchInput?.value
        .trim()
        .toLowerCase() || "";

    const status =
      statusFilter?.value || "all";

    const company =
      companyFilter?.value || "all";

    const filtered =
      contracts.filter(contract => {

        const matchesSearch =
          !search ||
          contract.id.toLowerCase().includes(search) ||
          contract.company.toLowerCase().includes(search) ||
          contract.supplier.toLowerCase().includes(search);

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

      });

    contractTableBody.innerHTML = "";

    resultCount.textContent =
      `${filtered.length} kayıt`;

    emptyState.classList.toggle(
      "hidden",
      filtered.length !== 0
    );

    filtered.forEach(contract => {

      const row =
        document.createElement("tr");

      const renewalDays =
        daysUntil(contract.renewalDate);

      let renewalHTML = "-";

      if (
        renewalDays >= 0 &&
        renewalDays <= 90
      ) {

        renewalHTML =
          `<span class="renewal-warning">
            ${renewalDays} gün
           </span>`;

      } else if (contract.renewalDate) {

        renewalHTML =
          formatDate(contract.renewalDate);

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
          ${formatCurrency(contract.monthlyPayment)}
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

      row
        .querySelector(".row-action")
        ?.addEventListener(
          "click",
          () => openDetail(contract.id)
        );

      contractTableBody.appendChild(row);

    });

  }


  /*
  =====================================================
  COMPANY FILTER
  =====================================================
  */

  function updateCompanyFilter() {

    if (!companyFilter) return;

    const current =
      companyFilter.value;

    const companies =
      [...new Set(
        contracts.map(
          c => c.company
        )
      )];

    companyFilter.innerHTML =
      `<option value="all">
        Tüm Şirketler
      </option>`;

    companies.forEach(company => {

      const option =
        document.createElement("option");

      option.value = company;
      option.textContent = company;

      companyFilter.appendChild(option);

    });

    if (companies.includes(current)) {

      companyFilter.value = current;

    }

  }


  /*
  =====================================================
  CONTRACT CREATION
  =====================================================
  */

  function createContract(data) {

    const engine =
      calculateTFRS16(data);

    return {

      ...data,

      status: "active",

      modification: false,

      leaseLiability:
        engine.leaseLiability,

      rouAsset:
        engine.rouAsset,

      monthlyInterest:
        engine.monthlyInterest,

      monthlyDepreciation:
        engine.monthlyDepreciation,

      termMonths:
        engine.termMonths,

      createdAt:
        new Date().toISOString()

    };

  }


  /*
  =====================================================
  TFRS 16 ENGINE
  =====================================================
  */

  function calculateTFRS16(data) {

    const start =
      new Date(data.startDate);

    const end =
      new Date(data.endDate);

    const termMonths =
      monthDifference(start, end);

    const annualRate =
      Number(data.discountRate) / 100;

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
        Number(data.monthlyPayment) /
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
      rouAsset / termMonths;

    return {

      leaseLiability,
      rouAsset,
      monthlyInterest,
      monthlyDepreciation,
      termMonths,
      monthlyRate

    };

  }


  /*
  =====================================================
  SCHEDULE ENGINE
  =====================================================
  */

  function buildSchedule(contract) {

    const termMonths =
      Number(contract.termMonths);

    const payment =
      Number(contract.monthlyPayment);

    const annualRate =
      Number(contract.discountRate) / 100;

    const monthlyRate =
      Math.pow(
        1 + annualRate,
        1 / 12
      ) - 1;

    let openingLiability =
      Number(contract.leaseLiability);

    let openingROU =
      Number(contract.rouAsset);

    const monthlyDepreciation =
      openingROU / termMonths;

    const schedule = [];

    const start =
      new Date(contract.startDate);

    for (
      let i = 1;
      i <= termMonths;
      i++
    ) {

      const periodDate =
        new Date(start);

      periodDate.setMonth(
        periodDate.getMonth() + i
      );

      const interest =
        openingLiability *
        monthlyRate;

      const principal =
        Math.min(
          payment - interest,
          openingLiability
        );

      const closingLiability =
        Math.max(
          0,
          openingLiability - principal
        );

      const depreciation =
        Math.min(
          monthlyDepreciation,
          openingROU
        );

      const closingROU =
        Math.max(
          0,
          openingROU - depreciation
        );

      schedule.push({

        period: i,

        date:
          periodDate.toISOString()
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


  /*
  =====================================================
  DETAIL
  =====================================================
  */

  function openDetail(id) {

    const contract =
      contracts.find(
        c => c.id === id
      );

    if (!contract) return;

    selectedContractId = id;

    detailTitle.textContent =
      contract.id;

    const schedule =
      buildSchedule(contract);

    const first12 =
      schedule.slice(0, 12);

    const totalInterest12 =
      first12.reduce(
        (sum, row) =>
          sum + row.interest,
        0
      );

    const totalPrincipal12 =
      first12.reduce(
        (sum, row) =>
          sum + row.principal,
        0
      );

    const totalDepreciation12 =
      first12.reduce(
        (sum, row) =>
          sum + row.depreciation,
        0
      );

    const renewalDays =
      daysUntil(contract.renewalDate);

    const renewalMessage =
      renewalDays >= 0 &&
      renewalDays <= 90

        ? `${renewalDays} gün içinde`

        : contract.renewalDate
          ? formatDate(contract.renewalDate)
          : "Tanımlanmamış";


    /*
    -----------------------------------------------------
    DETAIL SUMMARY
    -----------------------------------------------------
    */

    let html = `

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
          formatCurrency(contract.monthlyPayment)
        )}

        ${detailItem(
          "Lease Liability",
          formatCurrency(contract.leaseLiability)
        )}

        ${detailItem(
          "ROU Asset",
          formatCurrency(contract.rouAsset)
        )}

        ${detailItem(
          "İskonto Oranı",
          `%${Number(contract.discountRate).toFixed(2)}`
        )}

        ${detailItem(
          "Vade",
          `${contract.termMonths} ay`
        )}

        ${detailItem(
          "Aylık Faiz",
          formatCurrency(contract.monthlyInterest)
        )}

        ${detailItem(
          "Aylık Amortisman",
          formatCurrency(contract.monthlyDepreciation)
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


      <div style="
        margin-top:20px;
        display:grid;
        grid-template-columns:repeat(3,1fr);
        gap:10px;
      ">

        ${managementMetric(
          "12A Faiz",
          formatCurrency(totalInterest12)
        )}

        ${managementMetric(
          "12A Anapara",
          formatCurrency(totalPrincipal12)
        )}

        ${managementMetric(
          "12A Amortisman",
          formatCurrency(totalDepreciation12)
        )}

      </div>


      <div style="
        margin-top:25px;
      ">

        <h3 style="
          margin:0 0 5px;
          font-size:15px;
        ">
          TFRS 16 Ödeme Planı
        </h3>

        <p style="
          margin:0 0 12px;
          color:#64748b;
          font-size:10px;
        ">
          Lease liability ve ROU asset hareketi
        </p>

        <div style="
          overflow-x:auto;
          border:1px solid #e5e7eb;
          border-radius:10px;
        ">

          <table style="
            width:100%;
            border-collapse:collapse;
            min-width:900px;
          ">

            <thead style="
              background:#f8fafc;
            ">

              <tr>

                <th style="${thStyle}">
                  Dönem
                </th>

                <th style="${thStyle}">
                  Tarih
                </th>

                <th style="${thStyle}">
                  Açılış Yükümlülük
                </th>

                <th style="${thStyle}">
                  Faiz
                </th>

                <th style="${thStyle}">
                  Ödeme
                </th>

                <th style="${thStyle}">
                  Anapara
                </th>

                <th style="${thStyle}">
                  Kapanış Yükümlülük
                </th>

                <th style="${thStyle}">
                  Amortisman
                </th>

                <th style="${thStyle}">
                  ROU Net
                </th>

              </tr>

            </thead>

            <tbody>

              ${first12.map(row => `

                <tr>

                  <td style="${tdStyle}">
                    ${row.period}
                  </td>

                  <td style="${tdStyle}">
                    ${formatDate(row.date)}
                  </td>

                  <td style="${tdStyle}">
                    ${formatCurrency(row.openingLiability)}
                  </td>

                  <td style="${tdStyle}">
                    ${formatCurrency(row.interest)}
                  </td>

                  <td style="${tdStyle}">
                    ${formatCurrency(row.payment)}
                  </td>

                  <td style="${tdStyle}">
                    ${formatCurrency(row.principal)}
                  </td>

                  <td style="${tdStyle}">
                    ${formatCurrency(row.closingLiability)}
                  </td>

                  <td style="${tdStyle}">
                    ${formatCurrency(row.depreciation)}
                  </td>

                  <td style="${tdStyle}">
                    ${formatCurrency(row.closingROU)}
                  </td>

                </tr>

              `).join("")}

            </tbody>

          </table>

        </div>

      </div>


      <div style="
        margin-top:18px;
        padding:15px;
        background:#f8fafc;
        border-radius:10px;
        font-size:11px;
        line-height:1.6;
        color:#64748b;
      ">

        <strong style="
          color:#172033;
        ">
          CFO Perspektifi
        </strong>

        <br>

        Önümüzdeki 12 ayda bu sözleşme için
        yaklaşık
        <strong>
          ${formatCurrency(totalPrincipal12)}
        </strong>
        anapara,
        <strong>
          ${formatCurrency(totalInterest12)}
        </strong>
        faiz ve
        <strong>
          ${formatCurrency(totalDepreciation12)}
        </strong>
        ROU amortismanı oluşacaktır.

        Bu nedenle TFRS 16 portföyü,
        yalnızca bilanço değil;
        <strong>
        P&L, nakit akışı ve likidite planlaması
        </strong>
        açısından da takip edilmelidir.

      </div>

    `;

    detailContent.innerHTML = html;

    detailModal.classList.remove("hidden");

  }


  /*
  =====================================================
  NEW CONTRACT
  =====================================================
  */

  function openNewContractModal() {

    contractForm?.reset();

    const company =
      document.getElementById("company");

    const discountRate =
      document.getElementById("discountRate");

    if (company) {
      company.value = "GK Holding";
    }

    if (discountRate) {
      discountRate.value = "18";
    }

    contractModal?.classList.remove("hidden");

  }


  function closeContractModal() {

    contractModal?.classList.add("hidden");

  }


  /*
  =====================================================
  FORM
  =====================================================
  */

  function handleContractSubmit(event) {

    event.preventDefault();

    const data = {

      id: getValue("contractId"),

      company: getValue("company"),

      supplier: getValue("supplier"),

      monthlyPayment:
        Number(getValue("monthlyPayment")),

      startDate:
        getValue("startDate"),

      endDate:
        getValue("endDate"),

      discountRate:
        Number(getValue("discountRate")),

      renewalDate:
        getValue("renewalDate")

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
      new Date(data.endDate) <=
      new Date(data.startDate)
    ) {

      alert(
        "Bitiş tarihi başlangıç tarihinden sonra olmalıdır."
      );

      return;

    }

    if (
      contracts.some(
        c => c.id === data.id
      )
    ) {

      alert(
        "Bu sözleşme ID'si zaten mevcut."
      );

      return;

    }

    contracts.push(
      createContract(data)
    );

    saveContracts();

    closeContractModal();

    render();

  }


  /*
  =====================================================
  DELETE
  =====================================================
  */

  function handleDelete() {

    if (!selectedContractId) return;

    const contract =
      contracts.find(
        c => c.id === selectedContractId
      );

    if (!contract) return;

    const confirmed =
      confirm(
        `"${contract.id}" sözleşmesini silmek istediğinize emin misiniz?`
      );

    if (!confirmed) return;

    contracts =
      contracts.filter(
        c => c.id !== selectedContractId
      );

    saveContracts();

    closeDetail();

    render();

  }


  /*
  =====================================================
  CASH FLOW
  =====================================================
  */

  function calculateNext12MonthsCashOutflow(contract) {

    const schedule =
      buildSchedule(contract);

    return schedule
      .slice(0, 12)
      .reduce(
        (sum, row) =>
          sum + row.payment,
        0
      );

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

      return stored
        ? JSON.parse(stored)
        : [];

    } catch {

      return [];

    }

  }


  function saveContracts() {

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(contracts)
    );

  }


  /*
  =====================================================
  HELPERS
  =====================================================
  */

  function getValue(id) {

    return (
      document.getElementById(id)
        ?.value
        ?.trim() || ""
    );

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

    if (!value) return "-";

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


  function monthDifference(start, end) {

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

    if (!value) return 9999;

    const target =
      new Date(value);

    const today =
      new Date();

    target.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    return Math.ceil(
      (
        target - today
      ) /
      86400000
    );

  }


  function detailItem(label, value) {

    return `

      <div class="detail-item">

        <span>
          ${escapeHTML(label)}
        </span>

        <strong>
          ${escapeHTML(value)}
        </strong>

      </div>

    `;

  }


  function managementMetric(label, value) {

    return `

      <div style="
        background:#f8fafc;
        border:1px solid #e5e7eb;
        border-radius:9px;
        padding:12px;
      ">

        <div style="
          font-size:9px;
          color:#64748b;
        ">
          ${label}
        </div>

        <strong style="
          display:block;
          margin-top:5px;
          font-size:14px;
        ">
          ${value}
        </strong>

      </div>

    `;

  }


  function escapeHTML(value) {

    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  }


  function closeDetail() {

    selectedContractId = null;

    detailModal?.classList.add("hidden");

  }


  const thStyle = `
    padding:10px;
    text-align:left;
    font-size:9px;
    color:#64748b;
    white-space:nowrap;
  `;

  const tdStyle = `
    padding:10px;
    border-top:1px solid #edf0f4;
    font-size:9px;
    white-space:nowrap;
  `;


  console.log(
    "GK TFRS 16 Schedule Engine V2 loaded.",
    contracts
  );

});
