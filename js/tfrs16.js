document.addEventListener("DOMContentLoaded", () => {

  /*
  ============================================================
  GK FINANCE INTELLIGENCE
  TFRS 16 ACCOUNTING ENGINE
  STABLE REPLACEMENT VERSION
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
      const stored = localStorage.getItem(STORAGE_KEY);

      if (stored) {
        const parsed = JSON.parse(stored);

        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (error) {
      console.error("TFRS 16 storage error:", error);
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

  /*
  ============================================================
  HELPERS
  ============================================================
  */

  function escapeHtml(value) {
    if (value === null || value === undefined) {
      return "";
    }

    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString(
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
      return isNaN(value.getTime()) ? null : value;
    }

    const text = String(value).trim();

    if (!text) {
      return null;
    }

    let date = null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {

      date = new Date(
        `${text}T00:00:00`
      );

    } else if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(text)) {

      const p = text.split(".");

      date = new Date(
        Number(p[2]),
        Number(p[1]) - 1,
        Number(p[0])
      );

    } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(text)) {

      const p = text.split("/");

      date = new Date(
        Number(p[2]),
        Number(p[1]) - 1,
        Number(p[0])
      );

    } else if (!isNaN(Number(text))) {

      const excelDate = Number(text);

      if (
        excelDate > 20000 &&
        excelDate < 60000
      ) {
        date = new Date(
          Math.round(
            (excelDate - 25569) *
            86400 *
            1000
          )
        );
      }

    } else {

      date = new Date(text);

    }

    return date && !isNaN(date.getTime())
      ? date
      : null;
  }

  function normalizeDate(value) {

    const date = parseDate(value);

    if (!date) {
      return "";
    }

    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-");
  }

  function formatDate(value) {

    const date = parseDate(value);

    if (!date) {
      return "-";
    }

    return date.toLocaleDateString("tr-TR");
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

    return months[month - 1] || "";
  }

  function setText(id, value) {

    const element =
      document.getElementById(id);

    if (element) {
      element.textContent = value;
    }
  }

  function setInput(id, value) {

    const element =
      document.getElementById(id);

    if (element) {
      element.value = value ?? "";
    }
  }

  function getInput(id) {

    return (
      document.getElementById(id)?.value || ""
    );
  }

  /*
  ============================================================
  NUMBER PARSER
  ============================================================
  */

  function parseNumber(value) {

    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return 0;
    }

    if (typeof value === "number") {
      return value;
    }

    let text = String(value)
      .trim()
      .replaceAll("₺", "")
      .replaceAll(" ", "");

    if (
      text.includes(",") &&
      text.includes(".")
    ) {

      if (
        text.lastIndexOf(",") >
        text.lastIndexOf(".")
      ) {

        text = text
          .replaceAll(".", "")
          .replace(",", ".");

      } else {

        text = text.replaceAll(",", "");

      }

    } else if (text.includes(",")) {

      text = text.replace(",", ".");

    }

    const number = Number(text);

    return isNaN(number)
      ? 0
      : number;
  }

  /*
  ============================================================
  TFRS 16 ENGINE
  ============================================================
  */

  function monthsBetween(start, end) {

    const startDate = parseDate(start);
    const endDate = parseDate(end);

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

    const initialROU =
      initialLiability;

    const depreciation =
      initialROU / months;

    const schedule = [];

    let openingLiability =
      initialLiability;

    let rouOpening =
      initialROU;

    const startDate =
      parseDate(contract.startDate);

    for (
      let i = 1;
      i <= months;
      i++
    ) {

      const interest =
        openingLiability *
        monthlyRate;

      let principal =
        payment - interest;

      if (
        principal >
        openingLiability
      ) {
        principal =
          openingLiability;
      }

      if (principal < 0) {
        principal = 0;
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
          startDate.getFullYear(),
          startDate.getMonth() + i - 1,
          1
        );

      schedule.push({
        period: i,
        date: periodDate,
        year: periodDate.getFullYear(),
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
  PERIOD
  ============================================================
  */

  function getScheduleForYear(
    contract,
    year,
    month,
    period
  ) {

    const engine =
      calculateLease(contract);

    if (!engine.schedule.length) {
      return [];
    }

    if (period === "monthly") {

      return engine.schedule.filter(
        item =>
          item.year === year &&
          item.month === month
      );

    }

    if (period === "quarterly") {

      const quarter =
        Math.ceil(month / 3);

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

    if (period === "annual") {

      return engine.schedule.filter(
        item =>
          item.year === year
      );
    }

    return [];
  }

  /*
  ============================================================
  LIABILITY
  ============================================================
  */

  function calculateCurrentLiability(contract) {

    const engine =
      calculateLease(contract);

    return engine.schedule
      .slice(0, 12)
      .reduce(
        (total, item) =>
          total + item.principal,
        0
      );
  }

  function calculateNonCurrentLiability(contract) {

    const engine =
      calculateLease(contract);

    const current =
      calculateCurrentLiability(contract);

    return Math.max(
      0,
      engine.liability - current
    );
  }

  function calculateNext12Months(contract) {

    const engine =
      calculateLease(contract);

    return engine.schedule
      .slice(0, 12)
      .reduce(
        (total, item) =>
          total + item.payment,
        0
      );
  }

  /*
  ============================================================
  RENEWAL
  ============================================================
  */

  function isRenewalWithin90Days(contract) {

    if (!contract.renewalDate) {
      return false;
    }

    const renewal =
      parseDate(contract.renewalDate);

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
      (1000 * 60 * 60 * 24);

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
        c => c.status === "active"
      );

    let liability = 0;
    let rou = 0;
    let next12 = 0;

    active.forEach(contract => {

      const engine =
        calculateLease(contract);

      liability +=
        engine.liability;

      rou +=
        engine.rouAssets;

      next12 +=
        calculateNext12Months(contract);

    });

    const renewals =
      active.filter(
        isRenewalWithin90Days
      ).length;

    const modifications =
      active.filter(
        c => c.modification === true
      ).length;

    setText(
      "contractCount",
      active.length
    );

    setText(
      "leaseLiability",
      formatCurrency(liability)
    );

    setText(
      "rouAssets",
      formatCurrency(rou)
    );

    setText(
      "next12Months",
      formatCurrency(next12)
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
            .map(c => c.company)
            .filter(Boolean)
        )
      ].sort();

    select.innerHTML =
      `<option value="all">Tüm Şirketler</option>`;

    companies.forEach(company => {

      const option =
        document.createElement("option");

      option.value =
        company;

      option.textContent =
        company;

      select.appendChild(option);

    });

    if (companies.includes(current)) {
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

        return (
          (
            !search ||
            searchable.includes(search)
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
      });

    tbody.innerHTML = "";

    filtered.forEach(contract => {

      const renewal =
        isRenewalWithin90Days(
          contract
        );

      const row =
        document.createElement("tr");

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
          <span class="status ${escapeHtml(contract.status)}">
            ${
              contract.status === "active"
                ? "Aktif"
                : "Pasif"
            }
          </span>
        </td>

        <td>
          <span class="${renewal ? "renewal-warning" : ""}">
            ${formatDate(contract.renewalDate)}
            ${renewal ? " ⚠" : ""}
          </span>
        </td>

        <td>
          <button
            class="row-action"
            type="button"
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

      tbody.appendChild(row);
    });

    setText(
      "resultCount",
      `${filtered.length} kayıt`
    );

    document
      .getElementById("emptyState")
      ?.classList.toggle(
        "hidden",
        filtered.length > 0
      );
  }

  function refresh() {

    updateKPIs();
    populateCompanyFilter();
    renderTable();

  }

  /*
  ============================================================
  CONTRACT MODAL
  ============================================================
  */

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
      .getElementById("contractForm")
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

    modal.classList.remove("hidden");
  }

  function closeContractModal() {

    document
      .getElementById("contractModal")
      ?.classList.add("hidden");
  }

  document
    .getElementById("newContractButton")
    ?.addEventListener(
      "click",
      () => openContractModal()
    );

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

  /*
  ============================================================
  SAVE CONTRACT
  ============================================================
  */

  document
    .getElementById("contractForm")
    ?.addEventListener(
      "submit",
      event => {

        event.preventDefault();

        const id =
          getInput("contractId").trim();

        if (!id) {
          return;
        }

        const existing =
          contracts.find(
            c => c.id === id
          );

        const contract = {

          id,

          company:
            getInput("company")
              .trim(),

          supplier:
            getInput("supplier")
              .trim(),

          monthlyPayment:
            parseNumber(
              getInput(
                "monthlyPayment"
              )
            ),

          startDate:
            normalizeDate(
              getInput("startDate")
            ),

          endDate:
            normalizeDate(
              getInput("endDate")
            ),

          discountRate:
            parseNumber(
              getInput("discountRate")
            ),

          renewalDate:
            normalizeDate(
              getInput("renewalDate")
            ),

          status:
            existing?.status ||
            "active",

          modification:
            existing?.modification ||
            false
        };

        const validation =
          validateImportedContract(
            contract
          );

        if (!validation.valid) {

          alert(
            validation.errors.join("\n")
          );

          return;
        }

        if (existing) {

          contracts =
            contracts.map(
              item =>
                item.id === id
                  ? contract
                  : item
            );

        } else {

          if (
            contracts.some(
              item => item.id === id
            )
          ) {

            alert(
              "Bu Sözleşme ID zaten mevcut."
            );

            return;
          }

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
  JOURNAL
  ============================================================
  */

  function generateInitialEntry(
    contract
  ) {

    const engine =
      calculateLease(contract);

    return [
      {
        account:
          "260 Kullanım Hakkı Varlığı",
        debit:
          engine.rouAssets,
        credit: 0
      },
      {
        account:
          "401 Kiralama Yükümlülüğü",
        debit: 0,
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
        debit: 0,
        credit: nonCurrent
      },
      {
        account:
          "301 Kiralama Yükümlülüğü - Current",
        debit: current,
        credit: 0
      }
    ];
  }

  function renderJournalEntry(
    title,
    entries
  ) {

    if (!entries?.length) {
      return "";
    }

    const debit =
      entries.reduce(
        (t, i) =>
          t + Number(i.debit || 0),
        0
      );

    const credit =
      entries.reduce(
        (t, i) =>
          t + Number(i.credit || 0),
        0
      );

    const balanced =
      Math.abs(
        debit - credit
      ) < 0.01;

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
              <th style="padding:10px;text-align:left;">
                Hesap
              </th>
              <th style="padding:10px;text-align:right;">
                Borç
              </th>
              <th style="padding:10px;text-align:right;">
                Alacak
              </th>
            </tr>
          </thead>

          <tbody>

            ${entries.map(item => `
              <tr>

                <td style="
                  padding:10px;
                  border-top:1px solid #edf0f4;
                ">
                  ${escapeHtml(item.account)}
                </td>

                <td style="
                  padding:10px;
                  text-align:right;
                  border-top:1px solid #edf0f4;
                ">
                  ${
                    item.debit
                      ? formatCurrency(item.debit)
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
                      ? formatCurrency(item.credit)
                      : "-"
                  }
                </td>

              </tr>
            `).join("")}

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

        <div style="
          padding:10px 14px;
          background:${
            balanced
              ? "#ecfdf5"
              : "#fef2f2"
          };
          color:${
            balanced
              ? "#166534"
              : "#991b1b"
          };
          font-size:11px;
          font-weight:800;
        ">
          ${
            balanced
              ? "✓ Borç / Alacak kontrolü başarılı"
              : "✕ BORÇ / ALACAK DENGESİZ"
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

    const current =
      new Date().getFullYear();

    if (!start || !end) {

      return `
        <option value="${current}">
          ${current}
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

    return [
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
    ]
      .map(
        (month, index) =>
          `
          <option value="${index + 1}">
            ${month}
          </option>
          `
      )
      .join("");
  }

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
            Tek sözleşme için fiş oluşturabilirsiniz.
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
              ${buildYearOptions(contract)}
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
                Yıllık
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
          margin-top:18px;
          padding:14px;
          border:1px solid #dbeafe;
          background:#eff6ff;
          border-radius:10px;
        ">

          <strong style="
            display:block;
            margin-bottom:5px;
            font-size:12px;
          ">
            Toplu Muhasebe Merkezi
          </strong>

          <span style="
            font-size:11px;
            color:#475569;
          ">
            Portföydeki tüm aktif sözleşmeler için toplu fiş üretin.
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
            Tüm Sözleşmeler İçin Toplu Fiş Üret
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

    if (!preview) {
      return;
    }

    if (period === "closing") {

      const entries =
        generateReclassificationEntry(
          contract
        );

      preview.innerHTML =
        renderJournalEntry(
          `${year} Yıl Sonu Current / Non-current Kapanış Fişi`,
          entries
        );

      return;
    }

    const selected =
      getScheduleForYear(
        contract,
        year,
        month,
        period
      );

    if (!selected.length) {

      preview.innerHTML = `
        <div style="
          margin-top:18px;
          padding:15px;
          background:#fff7ed;
          border:1px solid #fed7aa;
          border-radius:9px;
          color:#9a3412;
        ">
          Bu sözleşmede seçilen dönem için ödeme planı bulunmuyor.
        </div>
      `;

      return;
    }

    const interest =
      selected.reduce(
        (t, i) =>
          t + i.interest,
        0
      );

    const principal =
      selected.reduce(
        (t, i) =>
          t + i.principal,
        0
      );

    const payment =
      selected.reduce(
        (t, i) =>
          t + i.payment,
        0
      );

    const depreciation =
      selected.reduce(
        (t, i) =>
          t + i.depreciation,
        0
      );

    const entries = [
      {
        account:
          "780 Finansman Giderleri",
        debit: interest,
        credit: 0
      },
      {
        account:
          "401 Kiralama Yükümlülüğü",
        debit: principal,
        credit: 0
      },
      {
        account:
          "381 Kira Borçları / Ödeme",
        debit: 0,
        credit: payment
      },
      {
        account:
          "770 / 730 Amortisman Giderleri",
        debit: depreciation,
        credit: 0
      },
      {
        account:
          "268 Birikmiş Amortismanlar",
        debit: 0,
        credit: depreciation
      }
    ];

    let title =
      `${year} - Yıllık Muhasebe Fişi`;

    if (period === "monthly") {

      title =
        `${year} - ${getMonthName(month)} Aylık Muhasebe Fişi`;

    } else if (period === "quarterly") {

      title =
        `${year} - ${Math.ceil(month / 3)}. Çeyrek Muhasebe Fişi`;

    }

    preview.innerHTML =
      renderJournalEntry(
        title,
        entries
      );
  }

  /*
  ============================================================
  DETAIL MODAL
  ============================================================
  */

  function openDetail(id) {

    const contract =
      contracts.find(
        item => item.id === id
      );

    if (!contract) {
      return;
    }

    selectedContractId =
      id;

    const engine =
      calculateLease(contract);

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
            <span>İskonto Oranı</span>
            <strong>
              %${formatNumber(contract.discountRate)}
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

    modal?.classList.remove(
      "hidden"
    );

    setTimeout(() => {

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

    }, 0);
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

        if (!selectedContractId) {
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
  BULK JOURNAL MODAL
  ============================================================
  */

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
      "hidden";

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
        width:min(1200px,100%);
        max-height:92vh;
        overflow:auto;
        background:white;
        border-radius:16px;
        box-shadow:0 25px 80px rgba(0,0,0,.25);
      ">

        <div style="
          padding:20px 22px;
          border-bottom:1px solid #e5e7eb;
          display:flex;
          justify-content:space-between;
          align-items:center;
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
              font-size:20px;
            ">
              Toplu Muhasebe Fiş Merkezi
            </h2>

          </div>

          <button
            id="closeBulkJournalModal"
            type="button"
            style="
              width:36px;
              height:36px;
              border:0;
              border-radius:8px;
              background:#f1f5f9;
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

            <div>
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
                id="bulkAccountingYear"
                style="
                  width:100%;
                  padding:9px;
                  border:1px solid #d1d5db;
                  border-radius:7px;
                "
              ></select>
            </div>

            <div>
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
                id="bulkAccountingPeriod"
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
              </select>
            </div>

            <div>
              <label style="
                display:block;
                font-size:10px;
                font-weight:700;
                color:#64748b;
                margin-bottom:7px;
              ">
                Dönem / Ay
              </label>

              <select
                id="bulkAccountingMonth"
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

            <div>
              <label style="
                display:block;
                font-size:10px;
                font-weight:700;
                color:#64748b;
                margin-bottom:7px;
              ">
                Fiş Tarihi
              </label>

              <input
                id="bulkVoucherDate"
                type="date"
                style="
                  width:100%;
                  padding:9px;
                  border:1px solid #d1d5db;
                  border-radius:7px;
                "
              />
            </div>

          </div>

          <div style="
            display:grid;
            grid-template-columns:1fr 1fr;
            gap:12px;
            margin-top:12px;
          ">

            <div>

              <label style="
                display:block;
                font-size:10px;
                font-weight:700;
                color:#64748b;
                margin-bottom:7px;
              ">
                Fiş No Başlangıç
              </label>

              <input
                id="bulkVoucherNumber"
                value="TFRS16-2026-0001"
                style="
                  width:100%;
                  padding:9px;
                  border:1px solid #d1d5db;
                  border-radius:7px;
                "
              />

            </div>

            <div>

              <label style="
                display:block;
                font-size:10px;
                font-weight:700;
                color:#64748b;
                margin-bottom:7px;
              ">
                Fiş Açıklaması
              </label>

              <input
                id="bulkVoucherDescription"
                value="TFRS 16 kira muhasebe kaydı"
                style="
                  width:100%;
                  padding:9px;
                  border:1px solid #d1d5db;
                  border-radius:7px;
                "
              />

            </div>

          </div>

          <div
            id="bulkJournalSummary"
            style="
              margin-top:18px;
            "
          ></div>

          <div
            id="bulkJournalPreview"
            style="
              margin-top:18px;
            "
          ></div>

        </div>

        <div style="
          padding:16px 20px;
          border-top:1px solid #e5e7eb;
          display:flex;
          justify-content:flex-end;
          gap:10px;
        ">

          <button
            id="generateBulkJournals"
            type="button"
            style="
              padding:11px 16px;
              border:0;
              border-radius:8px;
              background:#0f172a;
              color:white;
              font-weight:700;
              cursor:pointer;
            "
          >
            Toplu Fişleri Oluştur
          </button>

          <button
            id="exportBulkJournals"
            type="button"
            disabled
            style="
              padding:11px 16px;
              border:0;
              border-radius:8px;
              background:#166534;
              color:white;
              font-weight:700;
              cursor:pointer;
              opacity:.5;
            "
          >
            Excel'e Aktar
          </button>

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

    document
      .getElementById(
        "bulkAccountingPeriod"
      )
      ?.addEventListener(
        "change",
        updateBulkPeriodUI
      );

    document
      .getElementById(
        "bulkAccountingYear"
      )
      ?.addEventListener(
        "change",
        updateBulkVoucherDefaults
      );
  }

  function openBulkJournalModal() {

    createBulkJournalModal();

    const modal =
      document.getElementById(
        "bulkJournalModal"
      );

    if (!modal) {
      return;
    }

    modal.classList.remove(
      "hidden"
    );

    modal.style.display =
      "flex";

    populateBulkYears();

    const today =
      new Date();

    const voucherDate =
      document.getElementById(
        "bulkVoucherDate"
      );

    if (voucherDate) {

      voucherDate.value =
        [
          today.getFullYear(),
          String(
            today.getMonth() + 1
          ).padStart(2, "0"),
          String(
            today.getDate()
          ).padStart(2, "0")
        ].join("-");
    }

    updateBulkVoucherDefaults();

    bulkJournalData = [];

    setBulkPreview("");
  }

  function closeBulkJournalModal() {

    const modal =
      document.getElementById(
        "bulkJournalModal"
      );

    if (!modal) {
      return;
    }

    modal.classList.add(
      "hidden"
    );

    modal.style.display =
      "none";

    bulkJournalData = [];
  }

  function populateBulkYears() {

    const select =
      document.getElementById(
        "bulkAccountingYear"
      );

    if (!select) {
      return;
    }

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

        if (!start || !end) {
          return;
        }

        for (
          let year =
            start.getFullYear();

          year <=
          end.getFullYear();

          year++
        ) {

          years.add(
            year
          );
        }
      }
    );

    const sorted =
      [...years].sort(
        (a, b) => a - b
      );

    const currentYear =
      new Date().getFullYear();

    select.innerHTML =
      sorted
        .map(
          year =>
            `
            <option
              value="${year}"
              ${
                year === currentYear
                  ? "selected"
                  : ""
              }
            >
              ${year}
            </option>
            `
        )
        .join("");

    if (!sorted.length) {

      select.innerHTML = `
        <option value="${currentYear}">
          ${currentYear}
        </option>
      `;
    }
  }

  function updateBulkPeriodUI() {

    const period =
      document.getElementById(
        "bulkAccountingPeriod"
      )?.value;

    const month =
      document.getElementById(
        "bulkAccountingMonth"
      );

    if (!month) {
      return;
    }

    month.disabled =
      period === "annual";

    month.style.opacity =
      period === "annual"
        ? ".5"
        : "1";
  }

  function updateBulkVoucherDefaults() {

    const year =
      Number(
        document.getElementById(
          "bulkAccountingYear"
        )?.value
      );

    const numberInput =
      document.getElementById(
        "bulkVoucherNumber"
      );

    if (
      numberInput &&
      year
    ) {

      numberInput.value =
        `TFRS16-${year}-0001`;
    }

    const description =
      document.getElementById(
        "bulkVoucherDescription"
      );

    const period =
      document.getElementById(
        "bulkAccountingPeriod"
      )?.value;

    const month =
      Number(
        document.getElementById(
          "bulkAccountingMonth"
        )?.value
      );

    if (
      description &&
      year
    ) {

      if (
        period === "monthly"
      ) {

        description.value =
          `${getMonthName(month)} ${year} TFRS 16 kira muhasebe kaydı`;

      } else if (
        period === "quarterly"
      ) {

        description.value =
          `${year} ${Math.ceil(month / 3)}. çeyrek TFRS 16 kira muhasebe kaydı`;

      } else {

        description.value =
          `${year} TFRS 16 yıllık kira muhasebe kaydı`;
      }
    }
  }

  function createVoucherNumber(
    base,
    sequence
  ) {

    const match =
      String(base).match(
        /^(.*?)(\d+)$/
      );

    if (!match) {

      return (
        `${base}-` +
        String(sequence)
          .padStart(4, "0")
      );
    }

    const prefix =
      match[1];

    const number =
      match[2];

    const width =
      Math.max(
        4,
        number.length
      );

    const start =
      Number(number);

    return (
      prefix +
      String(
        start +
        sequence -
        1
      ).padStart(
        width,
        "0"
      )
    );
  }

  function generateBulkJournals() {

    const year =
      Number(
        document.getElementById(
          "bulkAccountingYear"
        )?.value
      );

    const period =
      document.getElementById(
        "bulkAccountingPeriod"
      )?.value;

    const month =
      Number(
        document.getElementById(
          "bulkAccountingMonth"
        )?.value
      );

    const voucherDate =
      document.getElementById(
        "bulkVoucherDate"
      )?.value || "";

    const voucherStart =
      document.getElementById(
        "bulkVoucherNumber"
      )?.value.trim()
      ||
      `TFRS16-${year}-0001`;

    const description =
      document.getElementById(
        "bulkVoucherDescription"
      )?.value.trim()
      ||
      "TFRS 16 kira muhasebe kaydı";

    if (
      !year ||
      !voucherDate
    ) {

      alert(
        "Lütfen raporlama yılını ve fiş tarihini eksiksiz girin."
      );

      return;
    }

    const activeContracts =
      contracts.filter(
        c =>
          c.status === "active"
      );

    bulkJournalData = [];

    let sequence = 1;

    activeContracts.forEach(
      contract => {

        const selected =
          getScheduleForYear(
            contract,
            year,
            month,
            period
          );

        if (!selected.length) {
          return;
        }

        const interest =
          selected.reduce(
            (t, i) =>
              t + i.interest,
            0
          );

        const principal =
          selected.reduce(
            (t, i) =>
              t + i.principal,
            0
          );

        const payment =
          selected.reduce(
            (t, i) =>
              t + i.payment,
            0
          );

        const depreciation =
          selected.reduce(
            (t, i) =>
              t + i.depreciation,
            0
          );

        const entries = [
          {
            account:
              "780 Finansman Giderleri",
            debit: interest,
            credit: 0
          },
          {
            account:
              "401 Kiralama Yükümlülüğü",
            debit: principal,
            credit: 0
          },
          {
            account:
              "381 Kira Borçları / Ödeme",
            debit: 0,
            credit: payment
          },
          {
            account:
              "770 / 730 Amortisman Giderleri",
            debit: depreciation,
            credit: 0
          },
          {
            account:
              "268 Birikmiş Amortismanlar",
            debit: 0,
            credit: depreciation
          }
        ];

        const totalDebit =
          entries.reduce(
            (t, i) =>
              t + Number(
                i.debit || 0
              ),
            0
          );

        const totalCredit =
          entries.reduce(
            (t, i) =>
              t + Number(
                i.credit || 0
              ),
            0
          );

        const difference =
          Math.abs(
            totalDebit -
            totalCredit
          );

        bulkJournalData.push({

          voucherNo:
            createVoucherNumber(
              voucherStart,
              sequence
            ),

          voucherDate,

          contractId:
            contract.id,

          company:
            contract.company,

          supplier:
            contract.supplier,

          description,

          year,

          period,

          month,

          entries,

          totalDebit,

          totalCredit,

          difference,

          balanced:
            difference < 0.01
        });

        sequence++;
      }
    );

    renderBulkJournalResults();
  }

  function renderBulkJournalResults() {

    const summary =
      document.getElementById(
        "bulkJournalSummary"
      );

    const preview =
      document.getElementById(
        "bulkJournalPreview"
      );

    const exportButton =
      document.getElementById(
        "exportBulkJournals"
      );

    if (
      !summary ||
      !preview
    ) {
      return;
    }

    if (!bulkJournalData.length) {

      summary.innerHTML = `
        <div style="
          padding:15px;
          background:#fff7ed;
          color:#9a3412;
          border:1px solid #fed7aa;
          border-radius:10px;
        ">
          Seçilen dönemde aktif sözleşme kaydı bulunamadı.
        </div>
      `;

      preview.innerHTML = "";

      if (exportButton) {

        exportButton.disabled =
          true;

        exportButton.style.opacity =
          ".5";
      }

      return;
    }

    const balanced =
      bulkJournalData.filter(
        x => x.balanced
      );

    const unbalanced =
      bulkJournalData.filter(
        x => !x.balanced
      );

    const totalDebit =
      bulkJournalData.reduce(
        (t, x) =>
          t + x.totalDebit,
        0
      );

    const totalCredit =
      bulkJournalData.reduce(
        (t, x) =>
          t + x.totalCredit,
        0
      );

    summary.innerHTML = `

      <div style="
        display:grid;
        grid-template-columns:
          repeat(auto-fit,minmax(150px,1fr));
        gap:10px;
      ">

        <div style="
          padding:14px;
          border-radius:10px;
          background:#f8fafc;
          border:1px solid #e5e7eb;
        ">
          <div style="
            font-size:10px;
            color:#64748b;
          ">
            SÖZLEŞME
          </div>

          <strong style="
            font-size:20px;
          ">
            ${bulkJournalData.length}
          </strong>
        </div>

        <div style="
          padding:14px;
          border-radius:10px;
          background:#ecfdf5;
          border:1px solid #bbf7d0;
          color:#166534;
        ">
          <div style="
            font-size:10px;
          ">
            DENGELİ FİŞ
          </div>

          <strong style="
            font-size:20px;
          ">
            ${balanced.length}
          </strong>
        </div>

        <div style="
          padding:14px;
          border-radius:10px;
          background:#fef2f2;
          border:1px solid #fecaca;
          color:#991b1b;
        ">
          <div style="
            font-size:10px;
          ">
            HATALI FİŞ
          </div>

          <strong style="
            font-size:20px;
          ">
            ${unbalanced.length}
          </strong>
        </div>

        <div style="
          padding:14px;
          border-radius:10px;
          background:#f8fafc;
          border:1px solid #e5e7eb;
        ">
          <div style="
            font-size:10px;
            color:#64748b;
          ">
            TOPLAM BORÇ
          </div>

          <strong>
            ${formatCurrency(totalDebit)}
          </strong>
        </div>

        <div style="
          padding:14px;
          border-radius:10px;
          background:#f8fafc;
          border:1px solid #e5e7eb;
        ">
          <div style="
            font-size:10px;
            color:#64748b;
          ">
            TOPLAM ALACAK
          </div>

          <strong>
            ${formatCurrency(totalCredit)}
          </strong>
        </div>

      </div>
    `;

    preview.innerHTML = `

      <div style="
        border:1px solid #e5e7eb;
        border-radius:10px;
        overflow:auto;
      ">

        <table style="
          width:100%;
          border-collapse:collapse;
          min-width:900px;
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

              <th style="padding:10px;text-align:right;">
                Borç
              </th>

              <th style="padding:10px;text-align:right;">
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
                ">
                  ${escapeHtml(
                    item.voucherNo
                  )}
                </td>

                <td style="
                  padding:10px;
                  border-top:1px solid #edf0f4;
                ">
                  ${formatDate(
                    item.voucherDate
                  )}
                </td>

                <td style="
                  padding:10px;
                  border-top:1px solid #edf0f4;
                  font-weight:700;
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
                    item.totalDebit
                  )}
                </td>

                <td style="
                  padding:10px;
                  text-align:right;
                  border-top:1px solid #edf0f4;
                ">
                  ${formatCurrency(
                    item.totalCredit
                  )}
                </td>

                <td style="
                  padding:10px;
                  border-top:1px solid #edf0f4;
                  font-weight:800;
                  color:${
                    item.balanced
                      ? "#166534"
                      : "#991b1b"
                  };
                ">
                  ${
                    item.balanced
                      ? "✓ Dengeli"
                      : "✕ Hatalı"
                  }
                </td>

              </tr>

            `
            ).join("")}

          </tbody>

        </table>

      </div>
    `;

    if (exportButton) {

      const allowed =
        unbalanced.length === 0;

      exportButton.disabled =
        !allowed;

      exportButton.style.opacity =
        allowed
          ? "1"
          : ".5";
    }
  }

  function setBulkPreview(
    html
  ) {

    const summary =
      document.getElementById(
        "bulkJournalSummary"
      );

    const preview =
      document.getElementById(
        "bulkJournalPreview"
      );

    if (summary) {
      summary.innerHTML =
        html || "";
    }

    if (preview) {
      preview.innerHTML =
        "";
    }

    const exportButton =
      document.getElementById(
        "exportBulkJournals"
      );

    if (exportButton) {

      exportButton.disabled =
        true;

      exportButton.style.opacity =
        ".5";
    }
  }

  /*
  ============================================================
  EXCEL JOURNAL EXPORT
  ============================================================
  */

  function exportBulkJournals() {

    if (!bulkJournalData.length) {
      return;
    }

    const rows = [];

    bulkJournalData.forEach(
      item => {

        item.entries.forEach(
          entry => {

            rows.push({

              "Fiş No":
                item.voucherNo,

              "Fiş Tarihi":
                item.voucherDate,

              "Sözleşme ID":
                item.contractId,

              "Şirket":
                item.company,

              "Tedarikçi":
                item.supplier,

              "Dönem":
                item.period,

              "Açıklama":
                item.description,

              "Hesap":
                entry.account,

              "Borç":
                Number(
                  entry.debit || 0
                ),

              "Alacak":
                Number(
                  entry.credit || 0
                ),

              "Kontrol":
                "OK"
            });
          }
        );
      }
    );

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
          "TFRS16 Fisleri"
        );

        XLSX.writeFile(
          workbook,
          `TFRS16_Toplu_Fisler_${Date.now()}.xlsx`
        );

        return;

      } catch (error) {

        console.error(
          "Excel export error:",
          error
        );
      }
    }

    const headers =
      Object.keys(
        rows[0]
      );

    const csvRows = [
      headers,
      ...rows.map(
        row =>
          headers.map(
            header =>
              row[header]
          )
      )
    ];

    const csv =
      csvRows
        .map(
          row =>
            row
              .map(
                cell =>
                  `"${String(
                    cell ?? ""
                  ).replaceAll(
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
      "TFRS16_Toplu_Fisler.csv";

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
  EXCEL BULK CONTRACT IMPORT
  ============================================================
  */

  function createImportContract(
    row
  ) {

    function getRowValue(
      keys
    ) {

      for (
        const key of keys
      ) {

        if (
          Object.prototype.hasOwnProperty.call(
            row,
            key
          )
        ) {

          const value =
            row[key];

          if (
            value !==
              null &&
            value !==
              undefined &&
            String(value).trim() !==
              ""
          ) {

            return value;
          }
        }
      }

      return "";
    }

    const modificationRaw =
      String(
        getRowValue([
          "Modification",
          "Modifikasyon"
        ]) || "false"
      )
      .trim()
      .toLowerCase();

    const statusRaw =
      String(
        getRowValue([
          "Status",
          "Durum"
        ]) || "active"
      )
      .trim()
      .toLowerCase();

    return {

      id:
        String(
          getRowValue([
            "Contract ID",
            "ContractID",
            "Sözleşme ID",
            "SözleşmeID",
            "ID"
          ])
        ).trim(),

      company:
        String(
          getRowValue([
            "Company",
            "Şirket",
            "Sirket"
          ])
        ).trim(),

      supplier:
        String(
          getRowValue([
            "Supplier",
            "Tedarikçi",
            "Tedarikci"
          ])
        ).trim(),

      monthlyPayment:
        parseNumber(
          getRowValue([
            "Monthly Payment",
            "MonthlyPayment",
            "Aylık Kira",
            "AylıkKira"
          ])
        ),

      startDate:
        normalizeDate(
          getRowValue([
            "Start Date",
            "StartDate",
            "Başlangıç Tarihi",
            "Baslangic Tarihi"
          ])
        ),

      endDate:
        normalizeDate(
          getRowValue([
            "End Date",
            "EndDate",
            "Bitiş Tarihi",
            "Bitis Tarihi"
          ])
        ),

      discountRate:
        parseNumber(
          getRowValue([
            "Discount Rate",
            "DiscountRate",
            "İskonto Oranı",
            "Iskonto Orani",
            "IskontoOrani"
          ])
        ),

      renewalDate:
        normalizeDate(
          getRowValue([
            "Renewal Date",
            "RenewalDate",
            "Yenileme Tarihi",
            "YenilemeTarihi"
          ])
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
      contract.monthlyPayment <= 0
    ) {
      errors.push(
        "Aylık kira geçersiz"
      );
    }

    if (!contract.startDate) {
      errors.push(
        "Başlangıç tarihi geçersiz"
      );
    }

    if (!contract.endDate) {
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
        start >= end
      ) {

        errors.push(
          "Başlangıç tarihi bitiş tarihinden sonra veya eşit olamaz"
        );
      }
    }

    return {
      errors,
      valid:
        errors.length === 0
    };
  }

  /*
  ============================================================
  BULK IMPORT MODAL
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

    const input =
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

    const confirm =
      document.getElementById(
        "confirmBulkImport"
      );

    if (input) {
      input.value = "";
    }

    if (preview) {
      preview.innerHTML = "";
    }

    if (status) {
      status.innerHTML = "";
    }

    if (confirm) {
      confirm.disabled =
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
  }

  function downloadTemplate() {

    const rows = [
      {
        "Contract ID":
          "LEASE-004",

        "Company":
          "GK Holding",

        "Supplier":
          "Örnek Tedarikçi",

        "Monthly Payment":
          100000,

        "Start Date":
          "2026-01-01",

        "End Date":
          "2030-12-31",

        "Discount Rate":
          18,

        "Renewal Date":
          "2030-09-30",

        "Status":
          "active",

        "Modification":
          false
      }
    ];

    if (
      typeof XLSX !==
      "undefined"
    ) {

      const worksheet =
        XLSX.utils.json_to_sheet(
          rows
        );

      const workbook =
        XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "TFRS16"
      );

      XLSX.writeFile(
        workbook,
        "TFRS16_Sozlesme_Sablonu.xlsx"
      );

      return;
    }

    alert(
      "Excel motoru yüklenemedi."
    );
  }

  async function processBulkFile(
    file
  ) {

    if (!file) {
      return;
    }

    const status =
      document.getElementById(
        "bulkImportStatus"
      );

    const preview =
      document.getElementById(
        "bulkPreview"
      );

    const confirm =
      document.getElementById(
        "confirmBulkImport"
      );

    if (status) {

      status.innerHTML =
        "Dosya okunuyor...";
    }

    try {

      if (
        typeof XLSX ===
        "undefined"
      ) {

        throw new Error(
          "Excel motoru yüklenemedi."
        );
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
            defval: ""
          }
        );

      bulkImportData =
        rows.map(
          createImportContract
        );

      const validRows = [];
      const errors = [];

      bulkImportData.forEach(
        (contract, index) => {

          const validation =
            validateImportedContract(
              contract
            );

          if (
            validation.valid
          ) {

            validRows.push(
              contract
            );

          } else {

            errors.push(
              `Satır ${index + 2}: ${validation.errors.join(", ")}`
            );
          }
        }
      );

      bulkImportData =
        validRows;

      if (status) {

        status.innerHTML = `
          <strong>
            ${bulkImportData.length}
          </strong>
          geçerli sözleşme bulundu.
          ${
            errors.length
              ? `<br><span style="color:#b91c1c;">
                  ${errors.length} satır hatalı.
                </span>`
              : ""
          }
        `;
      }

      if (preview) {

        preview.innerHTML = `

          <div style="
            border:1px solid #e5e7eb;
            border-radius:10px;
            overflow:auto;
          ">

            <table style="
              width:100%;
              border-collapse:collapse;
              min-width:850px;
            ">

              <thead>

                <tr>

                  <th style="padding:9px;">
                    ID
                  </th>

                  <th style="padding:9px;">
                    Şirket
                  </th>

                  <th style="padding:9px;">
                    Tedarikçi
                  </th>

                  <th style="padding:9px;">
                    Başlangıç
                  </th>

                  <th style="padding:9px;">
                    Bitiş
                  </th>

                  <th style="padding:9px;text-align:right;">
                    Aylık Kira
                  </th>

                </tr>

              </thead>

              <tbody>

                ${bulkImportData
                  .slice(0, 100)
                  .map(
                    contract => `
                      <tr>

                        <td style="padding:9px;border-top:1px solid #edf0f4;">
                          ${escapeHtml(contract.id)}
                        </td>

                        <td style="padding:9px;border-top:1px solid #edf0f4;">
                          ${escapeHtml(contract.company)}
                        </td>

                        <td style="padding:9px;border-top:1px solid #edf0f4;">
                          ${escapeHtml(contract.supplier)}
                        </td>

                        <td style="padding:9px;border-top:1px solid #edf0f4;">
                          ${formatDate(contract.startDate)}
                        </td>

                        <td style="padding:9px;border-top:1px solid #edf0f4;">
                          ${formatDate(contract.endDate)}
                        </td>

                        <td style="padding:9px;text-align:right;border-top:1px solid #edf0f4;">
                          ${formatCurrency(contract.monthlyPayment)}
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

      if (confirm) {

        confirm.disabled =
          bulkImportData.length === 0;
      }

    } catch (error) {

      console.error(
        "Bulk import error:",
        error
      );

      bulkImportData = [];

      if (status) {

        status.innerHTML = `
          <span style="color:#b91c1c;">
            Dosya okunamadı:
            ${escapeHtml(
              error.message
            )}
          </span>
        `;
      }

      if (confirm) {
        confirm.disabled =
          true;
      }
    }
  }

  function confirmBulkImport() {

    if (
      !bulkImportData.length
    ) {
      return;
    }

    let added = 0;
    let updated = 0;

    bulkImportData.forEach(
      incoming => {

        const existingIndex =
          contracts.findIndex(
            item =>
              item.id ===
              incoming.id
          );

        if (
          existingIndex >= 0
        ) {

          contracts[
            existingIndex
          ] = {

            ...contracts[
              existingIndex
            ],

            ...incoming
          };

          updated++;

        } else {

          contracts.push(
            incoming
          );

          added++;
        }
      }
    );

    saveContracts(
      contracts
    );

    refresh();

    closeBulkImportModal();

    alert(
      `Aktarım tamamlandı.\n\nEklenen: ${added}\nGüncellenen: ${updated}`
    );
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

  document
    .getElementById(
      "downloadTemplateButton"
    )
    ?.addEventListener(
      "click",
      downloadTemplate
    );

  document
    .getElementById(
      "bulkFileInput"
    )
    ?.addEventListener(
      "change",
      event =>
        processBulkFile(
          event.target.files?.[0]
        )
    );

  document
    .getElementById(
      "confirmBulkImport"
    )
    ?.addEventListener(
      "click",
      confirmBulkImport
    );

  /*
  ============================================================
  INITIALIZATION
  ============================================================
  */

  refresh();

});
