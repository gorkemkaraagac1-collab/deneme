document.addEventListener("DOMContentLoaded", () => {

  /*
  ============================================================
  GK FINANCE INTELLIGENCE
  TFRS 16 CONTRACT PORTFOLIO
  V10
  ============================================================
  */

  const STORAGE_KEY = "gk_tfrs16_contracts_v10";

  let contracts = loadContracts();
  let selectedContractId = null;

  let importedRows = [];


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
        "Storage error:",
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

    if (value instanceof Date) {
      return value;
    }

    const text =
      String(value).trim();

    let date;

    if (
      /^\d{4}-\d{2}-\d{2}$/.test(text)
    ) {

      date =
        new Date(
          `${text}T00:00:00`
        );

    }

    else if (
      /^\d{2}\.\d{2}\.\d{4}$/.test(text)
    ) {

      const [
        day,
        month,
        year
      ] =
        text.split(".");

      date =
        new Date(
          `${year}-${month}-${day}T00:00:00`
        );

    }

    else {

      date =
        new Date(text);

    }

    return isNaN(date.getTime())
      ? null
      : date;

  }


  function toISODate(value) {

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
          contract.modification === true
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
      companies.includes(current)
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
              ${
                contract.status === "active"
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

              ${formatDate(contract.renewalDate)}

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


  function setInput(
    id,
    value
  ) {

    const input =
      document.getElementById(id);

    if (input) {
      input.value = value;
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
            getInput("company"),

          supplier:
            getInput("supplier"),

          monthlyPayment:
            Number(
              getInput(
                "monthlyPayment"
              )
            ) || 0,

          startDate:
            getInput("startDate"),

          endDate:
            getInput("endDate"),

          discountRate:
            Number(
              getInput(
                "discountRate"
              )
            ) || 0,

          renewalDate:
            getInput("renewalDate"),

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

        openDetail(id);

      }
    );


  /*
  ============================================================
  EXCEL TEMPLATE
  ============================================================
  */

  function downloadExcelTemplate() {

    if (
      typeof XLSX === "undefined"
    ) {

      alert(
        "Excel modülü yüklenemedi. İnternet bağlantısını kontrol edin."
      );

      return;

    }

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
          "01.01.2026",

        "Bitiş Tarihi":
          "31.12.2030",

        "İskonto Oranı":
          18,

        "Yenileme Tarihi":
          "30.09.2030",

        "Durum":
          "active",

        "Modification":
          false

      }

    ];

    const worksheet =
      XLSX.utils.json_to_sheet(
        rows
      );

    worksheet["!cols"] = [

      { wch: 18 },
      { wch: 20 },
      { wch: 25 },
      { wch: 15 },
      { wch: 20 },
      { wch: 20 },
      { wch: 18 },
      { wch: 20 },
      { wch: 12 },
      { wch: 15 }

    ];

    const workbook =
      XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Sözleşmeler"
    );

    XLSX.writeFile(
      workbook,
      "TFRS16_Sozlesme_Portfoyu_Sablon.xlsx"
    );

  }


  document
    .getElementById(
      "downloadTemplateButton"
    )
    ?.addEventListener(
      "click",
      downloadExcelTemplate
    );


  /*
  ============================================================
  IMPORT BUTTON
  ============================================================
  */

  document
    .getElementById(
      "importExcelButton"
    )
    ?.addEventListener(
      "click",
      () => {

        document
          .getElementById(
            "excelFileInput"
          )
          ?.click();

      }
    );


  /*
  ============================================================
  EXCEL FILE INPUT
  ============================================================
  */

  document
    .getElementById(
      "excelFileInput"
    )
    ?.addEventListener(
      "change",
      event => {

        const file =
          event.target.files?.[0];

        if (!file) {
          return;
        }

        importExcelFile(file);

        event.target.value = "";

      }
    );


  /*
  ============================================================
  READ EXCEL
  ============================================================
  */

  function importExcelFile(
    file
  ) {

    if (
      typeof XLSX === "undefined"
    ) {

      alert(
        "Excel modülü yüklenemedi."
      );

      return;

    }

    const reader =
      new FileReader();

    reader.onload =
      event => {

        try {

          const data =
            new Uint8Array(
              event.target.result
            );

          const workbook =
            XLSX.read(
              data,
              {
                type: "array"
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
            rows,
            file.name
          );

        }

        catch (error) {

          console.error(error);

          alert(
            "Excel dosyası okunamadı."
          );

        }

      };

    reader.readAsArrayBuffer(
      file
    );

  }


  /*
  ============================================================
  IMPORT VALIDATION
  ============================================================
  */

  function processImportedRows(
    rows,
    fileName
  ) {

    importedRows = [];

    rows.forEach(
      (
        row,
        index
      ) => {

        const normalized =
          normalizeImportedRow(
            row
          );

        normalized.rowNumber =
          index + 2;

        normalized.existing =
          contracts.some(
            contract =>
              contract.id ===
              normalized.id
          );

        normalized.valid =
          validateImportedRow(
            normalized
          );

        importedRows.push(
          normalized
        );

      }
    );

    openImportPreview(
      fileName
    );

  }


  /*
  ============================================================
  NORMALIZE IMPORT
  ============================================================
  */

  function normalizeImportedRow(
    row
  ) {

    const get =
      (...keys) => {

        for (
          const key of keys
        ) {

          if (
            row[key] !== undefined &&
            row[key] !== null &&
            String(row[key]).trim() !== ""
          ) {

            return row[key];

          }

        }

        return "";

      };


    const statusRaw =
      String(
        get(
          "Durum",
          "Status",
          "status"
        )
      )
      .trim()
      .toLowerCase();


    const modificationRaw =
      get(
        "Modification",
        "modification"
      );


    return {

      id:
        String(
          get(
            "Sözleşme ID",
            "SözleşmeID",
            "Contract ID",
            "id"
          )
        ).trim(),

      company:
        String(
          get(
            "Şirket",
            "Company",
            "company"
          )
        ).trim(),

      supplier:
        String(
          get(
            "Tedarikçi",
            "Supplier",
            "supplier"
          )
        ).trim(),

      monthlyPayment:
        Number(
          get(
            "Aylık Kira",
            "Monthly Payment",
            "monthlyPayment"
          )
        ) || 0,

      startDate:
        toISODate(
          get(
            "Başlangıç Tarihi",
            "Başlangıç",
            "Start Date",
            "startDate"
          )
        ),

      endDate:
        toISODate(
          get(
            "Bitiş Tarihi",
            "Bitiş",
            "End Date",
            "endDate"
          )
        ),

      discountRate:
        Number(
          get(
            "İskonto Oranı",
            "Discount Rate",
            "discountRate"
          )
        ) || 0,

      renewalDate:
        toISODate(
          get(
            "Yenileme Tarihi",
            "Renewal Date",
            "renewalDate"
          )
        ),

      status:
        statusRaw === "inactive"
          ? "inactive"
          : "active",

      modification:
        modificationRaw === true ||
        String(
          modificationRaw
        ).toLowerCase() === "true" ||
        String(
          modificationRaw
        ).toLowerCase() === "evet"

    };

  }


  /*
  ============================================================
  VALIDATION
  ============================================================
  */

  function validateImportedRow(
    row
  ) {

    if (!row.id) {
      return "Sözleşme ID eksik";
    }

    if (!row.company) {
      return "Şirket eksik";
    }

    if (!row.supplier) {
      return "Tedarikçi eksik";
    }

    if (
      row.monthlyPayment <= 0
    ) {

      return "Aylık kira 0'dan büyük olmalı";

    }

    if (!row.startDate) {
      return "Başlangıç tarihi hatalı";
    }

    if (!row.endDate) {
      return "Bitiş tarihi hatalı";
    }

    const start =
      parseDate(
        row.startDate
      );

    const end =
      parseDate(
        row.endDate
      );

    if (
      start &&
      end &&
      start > end
    ) {

      return "Başlangıç tarihi bitiş tarihinden sonra";

    }

    if (
      row.discountRate < 0
    ) {

      return "İskonto oranı negatif olamaz";

    }

    return "";

  }


  /*
  ============================================================
  IMPORT PREVIEW
  ============================================================
  */

  function openImportPreview(
    fileName
  ) {

    const valid =
      importedRows.filter(
        row =>
          row.valid === ""
      );

    const invalid =
      importedRows.filter(
        row =>
          row.valid !== ""
      );

    const newRows =
      valid.filter(
        row =>
          !row.existing
      );

    const existingRows =
      valid.filter(
        row =>
          row.existing
      );


    const modal =
      document.createElement(
        "div"
      );

    modal.className =
      "modal";

    modal.id =
      "importPreviewModal";


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
              TFRS 16 / TOPLU İÇERİ AKTARMA
            </div>

            <h2>
              Excel Önizleme
            </h2>

            <p style="
              margin:5px 0 0;
              color:#64748b;
              font-size:11px;
            ">
              ${escapeHtml(fileName)}
            </p>

          </div>

          <button
            class="close-button"
            id="closeImportPreview"
          >
            ×
          </button>

        </div>


        <div style="
          display:grid;
          grid-template-columns:
            repeat(4,1fr);
          gap:10px;
          margin-bottom:18px;
        ">

          ${importStat(
            "Toplam Satır",
            importedRows.length
          )}

          ${importStat(
            "Yeni Sözleşme",
            newRows.length
          )}

          ${importStat(
            "Mevcut ID",
            existingRows.length
          )}

          ${importStat(
            "Hatalı",
            invalid.length
          )}

        </div>


        <div style="
          border:1px solid #e5e7eb;
          border-radius:10px;
          overflow:auto;
          max-height:400px;
        ">

          <table style="
            width:100%;
            border-collapse:collapse;
            min-width:900px;
          ">

            <thead>

              <tr>

                <th>Satır</th>
                <th>Sözleşme</th>
                <th>Şirket</th>
                <th>Tedarikçi</th>
                <th>Aylık Kira</th>
                <th>Başlangıç</th>
                <th>Bitiş</th>
                <th>Durum</th>
                <th>Kontrol</th>

              </tr>

            </thead>

            <tbody>

              ${
                importedRows
                  .map(
                    row => `

                      <tr>

                        <td>
                          ${row.rowNumber}
                        </td>

                        <td>
                          ${escapeHtml(row.id)}
                        </td>

                        <td>
                          ${escapeHtml(row.company)}
                        </td>

                        <td>
                          ${escapeHtml(row.supplier)}
                        </td>

                        <td>
                          ${formatCurrency(
                            row.monthlyPayment
                          )}
                        </td>

                        <td>
                          ${formatDate(
                            row.startDate
                          )}
                        </td>

                        <td>
                          ${formatDate(
                            row.endDate
                          )}
                        </td>

                        <td>
                          ${row.status}
                        </td>

                        <td style="
                          color:${
                            row.valid
                              ? "#b91c1c"
                              : row.existing
                                ? "#b45309"
                                : "#15803d"
                          };
                          font-weight:700;
                        ">

                          ${
                            row.valid
                              ? escapeHtml(
                                  row.valid
                                )
                              : row.existing
                                ? "Mevcut ID → Güncellenecek"
                                : "Hazır"
                          }

                        </td>

                      </tr>

                    `
                  )
                  .join("")
              }

            </tbody>

          </table>

        </div>


        <div style="
          margin-top:14px;
          padding:13px;
          background:#f8fafc;
          border:1px solid #e5e7eb;
          border-radius:9px;
          font-size:10px;
          line-height:1.6;
        ">

          <strong>İşlem mantığı:</strong>

          Yeni ID'ler portföye eklenecek.

          Mevcut ID'ler Excel'deki bilgilerle
          güncellenecek.

          Hatalı satırlar içeri alınmayacak.

        </div>


        <div style="
          display:flex;
          justify-content:flex-end;
          gap:9px;
          margin-top:20px;
        ">

          <button
            id="cancelImport"
            class="secondary-button"
          >
            Vazgeç
          </button>

          <button
            id="confirmImport"
            class="primary-button"
            ${
              valid.length === 0
                ? "disabled"
                : ""
            }
          >
            ${valid.length}
            Kaydı İçeri Aktar
          </button>

        </div>

      </div>

    `;


    document.body.appendChild(
      modal
    );


    document
      .getElementById(
        "closeImportPreview"
      )
      ?.addEventListener(
        "click",
        () =>
          modal.remove()
      );


    document
      .getElementById(
        "cancelImport"
      )
      ?.addEventListener(
        "click",
        () =>
          modal.remove()
      );


    document
      .getElementById(
        "confirmImport"
      )
      ?.addEventListener(
        "click",
        () => {

          applyImport();

          modal.remove();

        }
      );

  }


  function importStat(
    label,
    value
  ) {

    return `

      <div style="
        padding:13px;
        background:#f8fafc;
        border:1px solid #e5e7eb;
        border-radius:9px;
      ">

        <div style="
          font-size:10px;
          color:#64748b;
        ">
          ${label}
        </div>

        <div style="
          font-size:20px;
          font-weight:800;
          margin-top:5px;
        ">
          ${value}
        </div>

      </div>

    `;

  }


  /*
  ============================================================
  APPLY IMPORT
  ============================================================
  */

  function applyImport() {

    const valid =
      importedRows.filter(
        row =>
          row.valid === ""
      );


    if (!valid.length) {

      alert(
        "İçeri aktarılacak geçerli kayıt bulunamadı."
      );

      return;

    }


    let added = 0;
    let updated = 0;


    valid.forEach(
      row => {

        const contract = {

          id:
            row.id,

          company:
            row.company,

          supplier:
            row.supplier,

          monthlyPayment:
            row.monthlyPayment,

          startDate:
            row.startDate,

          endDate:
            row.endDate,

          discountRate:
            row.discountRate,

          renewalDate:
            row.renewalDate,

          status:
            row.status,

          modification:
            row.modification

        };


        const existingIndex =
          contracts.findIndex(
            item =>
              item.id === row.id
          );


        if (
          existingIndex >= 0
        ) {

          contracts[
            existingIndex
          ] = contract;

          updated++;

        }

        else {

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


    alert(
      `Toplu aktarım tamamlandı.\n\n` +
      `Yeni kayıt: ${added}\n` +
      `Güncellenen: ${updated}\n` +
      `Toplam işlenen: ${valid.length}`
    );

  }


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
          total + item.interest,
        0
      );

    const principal =
      selected.reduce(
        (
          total,
          item
        ) =>
          total + item.principal,
        0
      );

    const payment =
      selected.reduce(
        (
          total,
          item
        ) =>
          total + item.payment,
        0
      );

    const depreciation =
      selected.reduce(
        (
          total,
          item
        ) =>
          total + item.depreciation,
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
            ${title}
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
                ${formatCurrency(debit)}
              </td>

              <td style="
                padding:11px;
                text-align:right;
                font-weight:800;
                border-top:2px solid #cbd5e1;
              ">
                ${formatCurrency(credit)}
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

          <div>

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

              ${buildYearOptions(contract)}

            </select>

          </div>

          <div>

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

          <div>

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
        (
          month,
          index
        ) => `

          <option value="${index + 1}">
            ${month}
          </option>

        `
      )
      .join("");

  }


  function generateSelectedJournal(
    contract
  ) {

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
        `${getMonthName(month)} Aylık Muhasebe Fişi`;

    }


    if (
      period === "quarterly"
    ) {

      const quarter =
        Math.ceil(
          month / 3
        );

      startMonth =
        (quarter - 1) * 3 + 1;

      endMonth =
        Math.min(
          quarter * 3,
          engine.schedule.length
        );

      title =
        `${quarter}. Çeyrek Muhasebe Fişi`;

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
        "12 Aylık Toplu Muhasebe Fişi";

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
          "Yıl Sonu Current / Non-current Kapanış Fişi",
          entries
        );

      return;

    }


    if (
      !startMonth ||
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
          Seçilen dönem için ödeme planı bulunmuyor.
        </div>

      `;

      return;

    }


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

    return names[month - 1] || "-";

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
              ${formatCurrency(contract.monthlyPayment)}
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
              ${formatCurrency(engine.liability)}
            </strong>
          </div>

          <div class="detail-item">
            <span>ROU Varlığı</span>
            <strong>
              ${formatCurrency(engine.rouAssets)}
            </strong>
          </div>

          <div class="detail-item">
            <span>Aylık Amortisman</span>
            <strong>
              ${formatCurrency(engine.depreciation)}
            </strong>
          </div>

          <div class="detail-item">
            <span>Aylık Faiz</span>
            <strong>
              ${formatCurrency(engine.monthlyInterest)}
            </strong>
          </div>

          <div class="detail-item">
            <span>Current Liability</span>
            <strong>
              ${formatCurrency(current)}
            </strong>
          </div>

          <div class="detail-item">
            <span>Non-current Liability</span>
            <strong>
              ${formatCurrency(nonCurrent)}
            </strong>
          </div>

          <div class="detail-item">
            <span>Önümüzdeki 12 Ay</span>
            <strong>
              ${formatCurrency(next12)}
            </strong>
          </div>

          <div class="detail-item">
            <span>Başlangıç</span>
            <strong>
              ${formatDate(contract.startDate)}
            </strong>
          </div>

          <div class="detail-item">
            <span>Bitiş</span>
            <strong>
              ${formatDate(contract.endDate)}
            </strong>
          </div>

          <div class="detail-item">
            <span>Yenileme</span>
            <strong class="${
              renewal
                ? "renewal-warning"
                : ""
            }">
              ${formatDate(contract.renewalDate)}
              ${renewal ? " ⚠" : ""}
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
                ${formatCurrency(engine.liability)}
              </strong>

              · ROU:

              <strong>
                ${formatCurrency(engine.rouAssets)}
              </strong>

              · Aylık faiz:

              <strong>
                ${formatCurrency(engine.monthlyInterest)}
              </strong>

              · Aylık amortisman:

              <strong>
                ${formatCurrency(engine.depreciation)}
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
          generateInitialEntry(contract)
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
  ESCAPE
  ============================================================
  */

  document.addEventListener(
    "keydown",
    event => {

      if (
        event.key === "Escape"
      ) {

        closeContractModal();

        closeDetail();

        document
          .getElementById(
            "importPreviewModal"
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

  }


  /*
  ============================================================
  INIT
  ============================================================
  */

  refresh();


  console.log(
    "GK TFRS 16 Contract Portfolio V10 loaded successfully."
  );

});
