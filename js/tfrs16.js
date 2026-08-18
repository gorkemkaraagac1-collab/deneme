document.addEventListener("DOMContentLoaded", () => {

  /* =====================================================
     TFRS 16 CONTRACT PORTFOLIO V4
     ===================================================== */

  const STORAGE_KEY = "gk_tfrs16_contracts_v4";

  let contracts = loadContracts();
  let selectedContractId = null;

  /* =====================================================
     DEMO DATA
     ===================================================== */

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


  /* =====================================================
     STORAGE
     ===================================================== */

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


  /* =====================================================
     HELPERS
     ===================================================== */

  function formatNumber(value) {

    return Number(value || 0).toLocaleString(
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

    if (!value) return null;

    return new Date(`${value}T00:00:00`);

  }


  function formatDate(value) {

    if (!value) return "-";

    const date = parseDate(value);

    if (!date || isNaN(date)) {
      return "-";
    }

    return date.toLocaleDateString(
      "tr-TR"
    );

  }


  function monthsBetween(start, end) {

    const startDate = parseDate(start);
    const endDate = parseDate(end);

    if (!startDate || !endDate) {
      return 0;
    }

    const months =
      (endDate.getFullYear() - startDate.getFullYear()) * 12 +
      (endDate.getMonth() - startDate.getMonth());

    return Math.max(
      1,
      months + 1
    );

  }


  /* =====================================================
     TFRS 16 CALCULATION
     ===================================================== */

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

    let liability = 0;

    if (monthlyRate === 0) {

      liability =
        payment * months;

    } else {

      liability =
        payment *
        (
          (1 -
            Math.pow(
              1 + monthlyRate,
              -months
            )
          ) /
          monthlyRate
        );

    }

    /*
      Simplified ROU calculation.

      V4:
      Initial ROU ≈ Lease Liability

      İlerleyen versiyonda:
      + initial direct costs
      + prepaid lease payments
      - lease incentives
      + restoration obligations
      eklenecek.
    */

    const rouAssets = liability;

    return {
      months,
      liability,
      rouAssets
    };

  }


  /* =====================================================
     NEXT 12 MONTHS
     ===================================================== */

  function calculateNext12Months(contract) {

    const payment =
      Number(contract.monthlyPayment) || 0;

    const endDate =
      parseDate(contract.endDate);

    const today =
      new Date();

    let monthsRemaining = 12;

    if (endDate) {

      const diffMonths =
        (
          endDate.getFullYear() -
          today.getFullYear()
        ) * 12 +
        (
          endDate.getMonth() -
          today.getMonth()
        );

      monthsRemaining =
        Math.max(
          0,
          Math.min(
            12,
            diffMonths
          )
        );

    }

    return payment * monthsRemaining;

  }


  /* =====================================================
     RENEWAL
     ===================================================== */

  function isRenewalWithin90Days(contract) {

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
      (1000 * 60 * 60 * 24);

    return (
      days >= 0 &&
      days <= 90
    );

  }


  /* =====================================================
     KPI
     ===================================================== */

  function updateKPIs() {

    const activeContracts =
      contracts.filter(
        c => c.status === "active"
      );

    let totalLiability = 0;
    let totalROU = 0;
    let next12Months = 0;

    activeContracts.forEach(contract => {

      const calculation =
        calculateLease(contract);

      totalLiability +=
        calculation.liability;

      totalROU +=
        calculation.rouAssets;

      next12Months +=
        calculateNext12Months(
          contract
        );

    });


    const renewalCount =
      activeContracts.filter(
        isRenewalWithin90Days
      ).length;


    const modificationCount =
      activeContracts.filter(
        c => c.modification === true
      ).length;


    setText(
      "contractCount",
      activeContracts.length
    );

    setText(
      "leaseLiability",
      formatCurrency(
        totalLiability
      )
    );

    setText(
      "rouAssets",
      formatCurrency(
        totalROU
      )
    );

    setText(
      "next12Months",
      formatCurrency(
        next12Months
      )
    );

    setText(
      "renewals90Days",
      renewalCount
    );

    setText(
      "modifications",
      modificationCount
    );

  }


  function setText(id, value) {

    const element =
      document.getElementById(id);

    if (element) {
      element.textContent = value;
    }

  }


  /* =====================================================
     COMPANY FILTER
     ===================================================== */

  function populateCompanyFilter() {

    const select =
      document.getElementById(
        "companyFilter"
      );

    if (!select) return;

    const currentValue =
      select.value;

    const companies =
      [
        ...new Set(
          contracts.map(
            c => c.company
          )
        )
      ].sort();


    select.innerHTML = `
      <option value="all">
        Tüm Şirketler
      </option>
    `;


    companies.forEach(company => {

      const option =
        document.createElement(
          "option"
        );

      option.value = company;
      option.textContent = company;

      select.appendChild(option);

    });


    if (
      companies.includes(
        currentValue
      )
    ) {

      select.value =
        currentValue;

    }

  }


  /* =====================================================
     TABLE
     ===================================================== */

  function renderTable() {

    const tbody =
      document.getElementById(
        "contractTableBody"
      );

    const emptyState =
      document.getElementById(
        "emptyState"
      );

    const resultCount =
      document.getElementById(
        "resultCount"
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
      contracts.filter(contract => {

        const searchable =
          `
          ${contract.id}
          ${contract.company}
          ${contract.supplier}
          `
          .toLowerCase();


        const matchesSearch =
          !search ||
          searchable.includes(
            search
          );


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


    tbody.innerHTML = "";


    filtered.forEach(contract => {

      const renewalWarning =
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
            ${escapeHtml(contract.id)}
          </div>
        </td>

        <td>
          ${escapeHtml(contract.company)}
        </td>

        <td>
          <div class="supplier">
            ${escapeHtml(contract.supplier)}
          </div>
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
            ${contract.status === "active"
              ? "Aktif"
              : "Pasif"}
          </span>

        </td>

        <td>

          <span class="${renewalWarning
            ? "renewal-warning"
            : ""}">

            ${formatDate(
              contract.renewalDate
            )}

            ${renewalWarning
              ? " ⚠"
              : ""}

          </span>

        </td>

        <td>

          <button
            class="row-action"
            data-id="${contract.id}"
          >
            Görüntüle
          </button>

        </td>

      `;


      const button =
        row.querySelector(
          ".row-action"
        );


      button.addEventListener(
        "click",
        () => openDetail(
          contract.id
        )
      );


      tbody.appendChild(row);

    });


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

  }


  /* =====================================================
     NEW CONTRACT
     ===================================================== */

  const newButton =
    document.getElementById(
      "newContractButton"
    );


  if (newButton) {

    newButton.addEventListener(
      "click",
      () => openContractModal()
    );

  }


  function openContractModal(
    contract = null
  ) {

    const modal =
      document.getElementById(
        "contractModal"
      );

    if (!modal) return;


    const form =
      document.getElementById(
        "contractForm"
      );


    if (form) {
      form.reset();
    }


    setInput(
      "contractId",
      contract?.id || ""
    );

    setInput(
      "company",
      contract?.company || "GK Holding"
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
      contract?.discountRate ?? 18
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


  function setInput(id, value) {

    const input =
      document.getElementById(id);

    if (input) {
      input.value = value;
    }

  }


  function closeContractModal() {

    const modal =
      document.getElementById(
        "contractModal"
      );

    if (modal) {

      modal.classList.add(
        "hidden"
      );

    }

  }


  document
    .getElementById("closeModal")
    ?.addEventListener(
      "click",
      closeContractModal
    );


  document
    .getElementById("cancelModal")
    ?.addEventListener(
      "click",
      closeContractModal
    );


  /* =====================================================
     SAVE CONTRACT
     ===================================================== */

  document
    .getElementById("contractForm")
    ?.addEventListener(
      "submit",
      event => {

        event.preventDefault();


        const id =
          document
            .getElementById(
              "contractId"
            )
            .value
            .trim();


        if (!id) return;


        const existing =
          contracts.find(
            c => c.id === id
          );


        const contract = {

          id,

          company:
            getInputValue(
              "company"
            ),

          supplier:
            getInputValue(
              "supplier"
            ),

          monthlyPayment:
            Number(
              getInputValue(
                "monthlyPayment"
              )
            ) || 0,

          startDate:
            getInputValue(
              "startDate"
            ),

          endDate:
            getInputValue(
              "endDate"
            ),

          discountRate:
            Number(
              getInputValue(
                "discountRate"
              )
            ) || 0,

          renewalDate:
            getInputValue(
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
              c =>
                c.id === id
                  ? contract
                  : c
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


  function getInputValue(id) {

    return (
      document.getElementById(id)
        ?.value || ""
    );

  }


  /* =====================================================
     DETAIL MODAL
     ===================================================== */

  function openDetail(id) {

    const contract =
      contracts.find(
        c => c.id === id
      );


    if (!contract) return;


    selectedContractId =
      id;


    const calculation =
      calculateLease(
        contract
      );


    const renewalWarning =
      isRenewalWithin90Days(
        contract
      );


    const detailModal =
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
              ${escapeHtml(contract.company)}
            </strong>
          </div>

          <div class="detail-item">
            <span>Tedarikçi</span>
            <strong>
              ${escapeHtml(contract.supplier)}
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
            <span>Sözleşme Süresi</span>
            <strong>
              ${calculation.months} Ay
            </strong>
          </div>

          <div class="detail-item">
            <span>İskonto Oranı</span>
            <strong>
              %${contract.discountRate}
            </strong>
          </div>

          <div class="detail-item">
            <span>Kira Yükümlülüğü</span>
            <strong>
              ${formatCurrency(
                calculation.liability
              )}
            </strong>
          </div>

          <div class="detail-item">
            <span>ROU Varlığı</span>
            <strong>
              ${formatCurrency(
                calculation.rouAssets
              )}
            </strong>
          </div>

          <div class="detail-item">
            <span>Önümüzdeki 12 Ay</span>
            <strong>
              ${formatCurrency(
                calculateNext12Months(
                  contract
                )
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
              renewalWarning
                ? "renewal-warning"
                : ""
            }">

              ${formatDate(
                contract.renewalDate
              )}

              ${
                renewalWarning
                  ? " ⚠ 90 gün içinde"
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
              CFO Değerlendirmesi
            </strong>

            <p>

              Bu sözleşmenin toplam
              iskonto edilmiş yükümlülüğü
              <strong>
                ${formatCurrency(
                  calculation.liability
                )}
              </strong>
              seviyesindedir.

              ${
                renewalWarning
                  ? " Yenileme tarihi 90 gün içinde olduğu için yönetim aksiyonu önerilir."
                  : " Yaklaşan kritik yenileme bulunmamaktadır."
              }

              ${
                contract.modification
                  ? " Sözleşmede modification incelemesi beklenmektedir."
                  : ""
              }

            </p>

          </div>

        </div>

      `;

    }


    if (detailModal) {

      detailModal.classList.remove(
        "hidden"
      );

    }

  }


  function closeDetail() {

    const modal =
      document.getElementById(
        "detailModal"
      );

    if (modal) {

      modal.classList.add(
        "hidden"
      );

    }

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


  /* =====================================================
     DELETE
     ===================================================== */

  document
    .getElementById(
      "deleteContract"
    )
    ?.addEventListener(
      "click",
      () => {

        if (!selectedContractId) {
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


  /* =====================================================
     FILTER EVENTS
     ===================================================== */

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


  /* =====================================================
     ESC KEY
     ===================================================== */

  document.addEventListener(
    "keydown",
    event => {

      if (event.key !== "Escape") {
        return;
      }

      closeContractModal();
      closeDetail();

    }
  );


  /* =====================================================
     HTML SECURITY
     ===================================================== */

  function escapeHtml(value) {

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


  /* =====================================================
     REFRESH
     ===================================================== */

  function refresh() {

    populateCompanyFilter();

    updateKPIs();

    renderTable();

  }


  /* =====================================================
     INIT
     ===================================================== */

  refresh();


  console.log(
    "GK TFRS 16 V4 loaded successfully."
  );

});
