/*
============================================================
TFRS 16 ACCOUNTING ENGINE
============================================================
*/

function calculateAccountingEngine(
  contract,
  year,
  month,
  period
) {

  const lease =
    calculateLease(contract);

  const selected =
    getScheduleForYear(
      contract,
      year,
      month,
      period
    ) || [];

  const interest =
    selected.reduce(
      (t, i) => t + Number(i.interest || 0),
      0
    );

  const principal =
    selected.reduce(
      (t, i) => t + Number(i.principal || 0),
      0
    );

  const payment =
    selected.reduce(
      (t, i) => t + Number(i.payment || 0),
      0
    );

  const depreciation =
    selected.reduce(
      (t, i) =>
        t + Number(i.depreciation || 0),
      0
    );

  const openingLiability =
    selected.length
      ? Number(
          selected[0].openingLiability || 0
        )
      : 0;

  const closingLiability =
    selected.length
      ? Number(
          selected[
            selected.length - 1
          ].closingLiability || 0
        )
      : openingLiability;

  const liabilityRollForward =
    openingLiability +
    interest -
    principal -
    closingLiability;

  const journal = generatePeriodJournal({
    interest,
    principal,
    payment,
    depreciation
  });

  const totalDebit =
    journal.reduce(
      (t, i) =>
        t + Number(i.debit || 0),
      0
    );

  const totalCredit =
    journal.reduce(
      (t, i) =>
        t + Number(i.credit || 0),
      0
    );

  const journalDifference =
    totalDebit -
    totalCredit;

  const controls =
    runLeaseControls({
      contract,
      lease,
      selected,
      interest,
      principal,
      payment,
      depreciation,
      openingLiability,
      closingLiability,
      liabilityRollForward,
      journal,
      totalDebit,
      totalCredit
    });

  return {

    contractId:
      contract.id,

    year,

    month,

    period,

    schedule:
      selected,

    payment,

    interest,

    principal,

    depreciation,

    openingLiability,

    closingLiability,

    liabilityRollForward,

    rouAsset:
      Number(lease.rouAssets || 0),

    initialLiability:
      Number(lease.liability || 0),

    monthlyDepreciation:
      Number(lease.depreciation || 0),

    monthlyInterest:
      Number(lease.monthlyInterest || 0),

    journal,

    totalDebit,

    totalCredit,

    journalDifference,

    balanced:
      Math.abs(journalDifference) < 0.01,

    controls,

    allControlsPassed:
      controls.every(
        control => control.passed
      )
  };
}


/*
============================================================
INITIAL RECOGNITION
============================================================
*/

function generateInitialEntry(contract) {

  const engine =
    calculateLease(contract);

  return [

    {
      account:
        "260 Kullanım Hakkı Varlığı",

      debit:
        Number(engine.rouAssets || 0),

      credit:
        0
    },

    {
      account:
        "401 Kiralama Yükümlülüğü",

      debit:
        0,

      credit:
        Number(engine.liability || 0)
    }

  ];
}


/*
============================================================
CURRENT / NON-CURRENT RECLASSIFICATION
============================================================
*/

function generateReclassificationEntry(
  contract
) {

  const current =
    Number(
      calculateCurrentLiability(
        contract
      ) || 0
    );

  if (current <= 0) {
    return [];
  }

  return [

    {
      account:
        "401 Kiralama Yükümlülüğü",

      debit:
        current,

      credit:
        0
    },

    {
      account:
        "301 Kiralama Yükümlülüğü - Current",

      debit:
        0,

      credit:
        current
    }

  ];
}


/*
============================================================
PERIOD JOURNAL
============================================================
*/

function generatePeriodJournal(data) {

  const interest =
    Number(data.interest || 0);

  const principal =
    Number(data.principal || 0);

  const payment =
    Number(data.payment || 0);

  const depreciation =
    Number(data.depreciation || 0);

  const entries = [];

  if (interest > 0) {

    entries.push({

      account:
        "780 Finansman Giderleri",

      debit:
        interest,

      credit:
        0

    });

  }

  if (principal > 0) {

    entries.push({

      account:
        "401 Kiralama Yükümlülüğü",

      debit:
        principal,

      credit:
        0

    });

  }

  if (payment > 0) {

    entries.push({

      account:
        "381 Kira Borçları / Ödeme",

      debit:
        0,

      credit:
        payment

    });

  }

  if (depreciation > 0) {

    entries.push({

      account:
        "770 / 730 Amortisman Giderleri",

      debit:
        depreciation,

      credit:
        0

    });

    entries.push({

      account:
        "268 Birikmiş Amortismanlar",

      debit:
        0,

      credit:
        depreciation

    });

  }

  return entries;
}


/*
============================================================
ACCOUNTING CONTROLS
============================================================
*/

function runLeaseControls(data) {

  const controls = [];

  const tolerance =
    0.01;

  /*
  ----------------------------------------------------------
  1. JOURNAL BALANCE
  ----------------------------------------------------------
  */

  controls.push({

    id:
      "JOURNAL_BALANCE",

    title:
      "Borç / Alacak dengesi",

    passed:
      Math.abs(
        Number(data.totalDebit || 0) -
        Number(data.totalCredit || 0)
      ) < tolerance

  });


  /*
  ----------------------------------------------------------
  2. LIABILITY ROLL FORWARD
  ----------------------------------------------------------
  */

  controls.push({

    id:
      "LIABILITY_ROLL_FORWARD",

    title:
      "Lease liability roll-forward",

    passed:
      Math.abs(
        Number(
          data.liabilityRollForward || 0
        )
      ) < tolerance

  });


  /*
  ----------------------------------------------------------
  3. PAYMENT PRINCIPAL + INTEREST
  ----------------------------------------------------------
  */

  controls.push({

    id:
      "PAYMENT_COMPONENTS",

    title:
      "Ödeme = faiz + anapara",

    passed:
      Math.abs(
        Number(data.payment || 0) -
        (
          Number(data.interest || 0) +
          Number(data.principal || 0)
        )
      ) < tolerance

  });


  /*
  ----------------------------------------------------------
  4. SCHEDULE EXISTENCE
  ----------------------------------------------------------
  */

  controls.push({

    id:
      "SCHEDULE_EXISTENCE",

    title:
      "Ödeme planı kontrolü",

    passed:
      Array.isArray(data.selected) &&
      data.selected.length > 0

  });


  /*
  ----------------------------------------------------------
  5. NEGATIVE LIABILITY
  ----------------------------------------------------------
  */

  controls.push({

    id:
      "NEGATIVE_LIABILITY",

    title:
      "Negatif lease liability kontrolü",

    passed:
      Number(
        data.closingLiability || 0
      ) >= -tolerance

  });


  /*
  ----------------------------------------------------------
  6. CONTRACT DATE
  ----------------------------------------------------------
  */

  const validDates =
    Boolean(
      parseDate(
        data.contract?.startDate
      ) &&
      parseDate(
        data.contract?.endDate
      )
    );

  controls.push({

    id:
      "CONTRACT_DATES",

    title:
      "Sözleşme tarihleri",

    passed:
      validDates

  });


  /*
  ----------------------------------------------------------
  7. PAYMENT VALIDITY
  ----------------------------------------------------------
  */

  controls.push({

    id:
      "PAYMENT_VALIDITY",

    title:
      "Kira tutarı kontrolü",

    passed:
      Number(
        data.contract?.monthlyPayment || 0
      ) > 0

  });


  /*
  ----------------------------------------------------------
  8. DISCOUNT RATE
  ----------------------------------------------------------
  */

  controls.push({

    id:
      "DISCOUNT_RATE",

    title:
      "İskonto oranı kontrolü",

    passed:
      Number(
        data.contract?.discountRate || 0
      ) >= 0

  });


  /*
  ----------------------------------------------------------
  9. RENEWAL WARNING
  ----------------------------------------------------------
  */

  const renewalWarning =
    isRenewalWithin90Days(
      data.contract
    );

  controls.push({

    id:
      "RENEWAL_WARNING",

    title:
      "Yenileme tarihi",

    passed:
      !renewalWarning,

    warning:
      renewalWarning

  });


  /*
  ----------------------------------------------------------
  10. MODIFICATION WARNING
  ----------------------------------------------------------
  */

  const modification =
    Boolean(
      data.contract?.modification
    );

  controls.push({

    id:
      "MODIFICATION_REVIEW",

    title:
      "Modification kontrolü",

    passed:
      !modification,

    warning:
      modification

  });


  return controls;
}


/*
============================================================
CONTROL SUMMARY
============================================================
*/

function renderControlSummary(
  controls
) {

  if (!controls?.length) {
    return "";
  }

  const failed =
    controls.filter(
      item => !item.passed
    );

  return `

    <div style="
      margin-top:18px;
      border:1px solid #e5e7eb;
      border-radius:10px;
      overflow:hidden;
      background:white;
    ">

      <div style="
        padding:12px 14px;
        background:#f8fafc;
        border-bottom:1px solid #e5e7eb;
        font-size:12px;
        font-weight:800;
      ">
        TFRS 16 Kontrol Merkezi
      </div>

      <div style="
        padding:12px;
      ">

        ${controls.map(control => `

          <div style="
            display:flex;
            justify-content:space-between;
            gap:12px;
            padding:8px 4px;
            border-bottom:1px solid #f1f5f9;
            font-size:11px;
          ">

            <span>
              ${escapeHtml(
                control.title
              )}
            </span>

            <strong style="
              color:${
                control.passed
                  ? "#166534"
                  : "#991b1b"
              };
            ">

              ${
                control.passed
                  ? "✓ OK"
                  : (
                      control.warning
                        ? "⚠ İnceleme"
                        : "✕ Hatalı"
                    )
              }

            </strong>

          </div>

        `).join("")}

      </div>

      <div style="
        padding:10px 14px;
        background:${
          failed.length
            ? "#fff7ed"
            : "#ecfdf5"
        };
        color:${
          failed.length
            ? "#9a3412"
            : "#166534"
        };
        font-size:11px;
        font-weight:800;
      ">

        ${
          failed.length
            ? `${failed.length} kontrol için inceleme gerekiyor.`
            : "✓ Tüm TFRS 16 kontrolleri başarılı."
        }

      </div>

    </div>

  `;
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

  if (!entries?.length) {

    return `

      <div style="
        margin-top:18px;
        padding:14px;
        background:#f8fafc;
        border:1px solid #e5e7eb;
        border-radius:10px;
        color:#64748b;
        font-size:11px;
      ">
        Bu işlem için muhasebe kaydı oluşturulmadı.
      </div>

    `;
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

  const difference =
    debit - credit;

  const balanced =
    Math.abs(difference) < 0.01;

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
                  Number(item.debit || 0) !== 0
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
                  Number(item.credit || 0) !== 0
                    ? formatCurrency(
                        item.credit
                      )
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
            : `✕ BORÇ / ALACAK DENGESİZ — Fark: ${formatCurrency(
                Math.abs(difference)
              )}`
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
          Tek sözleşme için fiş oluşturabilirsiniz.
          Toplu işlem için aşağıdaki merkezi kullanın.
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
          Portföydeki tüm aktif sözleşmeler için
          aynı döneme ait muhasebe fişlerini tek işlemde
          oluşturun ve Excel'e aktarın.
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
YEAR OPTIONS
============================================================
*/

function buildYearOptions(contract) {

  const start =
    parseDate(contract.startDate)
      ?.getFullYear();

  const end =
    parseDate(contract.endDate)
      ?.getFullYear();

  if (!start || !end) {

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
    (month, index) => `

      <option value="${index + 1}">
        ${month}
      </option>

    `
  ).join("");
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

  const preview =
    document.getElementById(
      "journalPreview"
    );

  if (!year) {

    if (preview) {

      preview.innerHTML = `

        <div style="
          margin-top:18px;
          padding:14px;
          background:#fef2f2;
          color:#991b1b;
          border-radius:10px;
        ">
          Raporlama yılı seçilmelidir.
        </div>

      `;

    }

    return;
  }


  /*
  ----------------------------------------------------------
  YEAR END CLOSING
  ----------------------------------------------------------
  */

  if (period === "closing") {

    const entries =
      generateReclassificationEntry(
        contract
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


  /*
  ----------------------------------------------------------
  ACCOUNTING ENGINE
  ----------------------------------------------------------
  */

  const engine =
    calculateAccountingEngine(
      contract,
      year,
      month,
      period
    );


  if (!engine.schedule.length) {

    if (preview) {

      preview.innerHTML = `

        <div style="
          margin-top:18px;
          padding:15px;
          background:#fff7ed;
          border:1px solid #fed7aa;
          border-radius:10px;
          color:#9a3412;
          font-size:11px;
        ">
          Bu sözleşmede seçilen dönem için
          ödeme planı bulunmuyor.
        </div>

      `;

    }

    return;
  }


  let title = "";

  if (period === "monthly") {

    title =
      `${year} - ${getMonthName(month)} Aylık Muhasebe Fişi`;

  }

  else if (period === "quarterly") {

    title =
      `${year} - ${Math.ceil(month / 3)}. Çeyrek Muhasebe Fişi`;

  }

  else {

    title =
      `${year} - Yıllık Muhasebe Fişi`;

  }


  if (preview) {

    preview.innerHTML =

      renderJournalEntry(
        title,
        engine.journal
      ) +

      renderControlSummary(
        engine.controls
      );

  }
}


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
    document.createElement("div");

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
            font-size:20px;
          ">
            Toplu Muhasebe Fiş Merkezi
          </h2>

          <p style="
            margin:5px 0 0;
            color:#64748b;
            font-size:11px;
          ">
            Tüm aktif sözleşmeler için toplu fiş üretin.
          </p>

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

      <div style="padding:20px;">

        <div style="
          display:grid;
          grid-template-columns:
            repeat(auto-fit,minmax(180px,1fr));
          gap:12px;
        ">

          <div style="
            padding:14px;
            background:#f8fafc;
            border:1px solid #e5e7eb;
            border-radius:10px;
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
              id="bulkAccountingYear"
              style="
                width:100%;
                padding:9px;
                border:1px solid #d1d5db;
                border-radius:7px;
              "
            ></select>

          </div>

          <div style="
            padding:14px;
            background:#f8fafc;
            border:1px solid #e5e7eb;
            border-radius:10px;
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

          <div style="
            padding:14px;
            background:#f8fafc;
            border:1px solid #e5e7eb;
            border-radius:10px;
          ">

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

          <div style="
            padding:14px;
            background:#f8fafc;
            border:1px solid #e5e7eb;
            border-radius:10px;
          ">

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
          grid-template-columns:
            1fr 1fr;
          gap:12px;
          margin-top:12px;
        ">

          <div style="
            padding:14px;
            background:#f8fafc;
            border:1px solid #e5e7eb;
            border-radius:10px;
          ">

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

          <div style="
            padding:14px;
            background:#f8fafc;
            border:1px solid #e5e7eb;
            border-radius:10px;
          ">

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
        flex-wrap:wrap;
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

  document.body.appendChild(modal);

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


/*
============================================================
BULK JOURNAL DATA
============================================================
*/

let bulkJournalData = [];


/*
============================================================
OPEN BULK MODAL
============================================================
*/

function openBulkJournalModal() {

  createBulkJournalModal();

  const modal =
    document.getElementById(
      "bulkJournalModal"
    );

  if (!modal) return;

  modal.classList.remove("hidden");

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


/*
============================================================
CLOSE BULK MODAL
============================================================
*/

function closeBulkJournalModal() {

  const modal =
    document.getElementById(
      "bulkJournalModal"
    );

  if (!modal) return;

  modal.classList.add("hidden");

  modal.style.display =
    "none";

  bulkJournalData = [];
}


/*
============================================================
POPULATE BULK YEARS
============================================================
*/

function populateBulkYears() {

  const select =
    document.getElementById(
      "bulkAccountingYear"
    );

  if (!select) return;

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

      if (!start || !end) return;

      for (
        let y =
          start.getFullYear();

        y <= end.getFullYear();

        y++
      ) {

        years.add(y);

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
    sorted.map(
      year => `

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
    ).join("");

  if (!sorted.length) {

    select.innerHTML = `

      <option
        value="${currentYear}"
      >
        ${currentYear}
      </option>

    `;

  }
}


/*
============================================================
BULK PERIOD UI
============================================================
*/

function updateBulkPeriodUI() {

  const period =
    document.getElementById(
      "bulkAccountingPeriod"
    )?.value;

  const month =
    document.getElementById(
      "bulkAccountingMonth"
    );

  if (!month) return;

  month.disabled =
    period === "annual";

  month.style.opacity =
    period === "annual"
      ? ".5"
      : "1";
}


/*
============================================================
BULK DEFAULTS
============================================================
*/

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

    }

    else if (
      period === "quarterly"
    ) {

      description.value =
        `${year} ${Math.ceil(month / 3)}. çeyrek TFRS 16 kira muhasebe kaydı`;

    }

    else {

      description.value =
        `${year} TFRS 16 yıllık kira muhasebe kaydı`;

    }

  }
}


/*
============================================================
CREATE BULK JOURNALS
============================================================
*/

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
    )?.value.trim() ||
    `TFRS16-${year}-0001`;

  const description =
    document.getElementById(
      "bulkVoucherDescription"
    )?.value.trim() ||
    "TFRS 16 kira muhasebe kaydı";

  if (!year) {

    alert(
      "Raporlama yılı seçilmelidir."
    );

    return;

  }

  if (!voucherDate) {

    alert(
      "Fiş tarihi girilmelidir."
    );

    return;

  }

  const activeContracts =
    contracts.filter(
      contract =>
        contract.status ===
        "active"
    );

  bulkJournalData = [];

  let sequence = 1;

  activeContracts.forEach(
    contract => {

      const engine =
        calculateAccountingEngine(
          contract,
          year,
          month,
          period
        );

      if (
        !engine.schedule.length
      ) {

        return;

      }

      const voucherNo =
        createVoucherNumber(
          voucherStart,
          sequence
        );

      const controlFailures =
        engine.controls.filter(
          control =>
            !control.passed
        );

      bulkJournalData.push({

        voucherNo,

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

        entries:
          engine.journal,

        totalDebit:
          engine.totalDebit,

        totalCredit:
          engine.totalCredit,

        difference:
          Math.abs(
            engine.journalDifference
          ),

        balanced:
          engine.balanced,

        controls:
          engine.controls,

        controlFailures

      });

      sequence++;

    }
  );

  renderBulkJournalResults();
}


/*
============================================================
VOUCHER NUMBER
============================================================
*/

function createVoucherNumber(
  base,
  sequence
) {

  const match =
    String(base).match(
      /^(.*?)(\d+)$/
    );

  if (!match) {

    return `${base}-${String(sequence).padStart(4, "0")}`;

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


/*
============================================================
BULK RESULTS
============================================================
*/

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

  if (
    !bulkJournalData.length
  ) {

    summary.innerHTML = `

      <div style="
        padding:15px;
        background:#fff7ed;
        color:#9a3412;
        border:1px solid #fed7aa;
        border-radius:10px;
      ">
        Seçilen dönemde kayıt üretilebilecek
        aktif sözleşme bulunamadı.
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

  const controlExceptionCount =
    bulkJournalData.reduce(
      (
        total,
        item
      ) =>
        total +
        item.controlFailures.length,
      0
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
        background:#fff7ed;
        border:1px solid #fed7aa;
        color:#9a3412;
      ">

        <div style="
          font-size:10px;
        ">
          KONTROL UYARISI
        </div>

        <strong style="
          font-size:20px;
        ">
          ${controlExceptionCount}
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


    <div style="
      margin-top:12px;
      padding:12px 14px;
      border-radius:9px;
      background:${
        unbalanced.length
          ? "#fef2f2"
          : "#ecfdf5"
      };
      color:${
        unbalanced.length
          ? "#991b1b"
          : "#166534"
      };
      border:1px solid ${
        unbalanced.length
          ? "#fecaca"
          : "#bbf7d0"
      };
      font-size:11px;
      font-weight:700;
    ">

      ${
        unbalanced.length
          ? "⚠ Dengesiz fiş bulundu. Excel aktarımı engellenecektir."
          : (
              controlExceptionCount
                ? "✓ Borç / Alacak dengesi başarılı. Ancak bazı kontrol uyarıları bulunmaktadır."
                : "✓ Tüm toplu fişler kontrol motorundan başarıyla geçti."
            )
      }

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
        min-width:1100px;
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
              Muhasebe
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


                <td style="
                  padding:10px;
                  border-top:1px solid #edf0f4;
                  font-weight:800;
                  color:${
                    item.controlFailures.length
                      ? "#9a3412"
                      : "#166534"
                  };
                ">
                  ${
                    item.controlFailures.length
                      ? `⚠ ${item.controlFailures.length} Uyarı`
                      : "✓ OK"
                  }
                </td>

              </tr>

            `
          ).join("")}

        </tbody>

      </table>

    </div>


    <div style="
      margin-top:14px;
    ">

      ${bulkJournalData.map(
        item => {

          if (
            !item.controlFailures.length
          ) {

            return "";

          }

          return `

            <div style="
              margin-bottom:8px;
              padding:11px 13px;
              border-radius:9px;
              background:#fff7ed;
              border:1px solid #fed7aa;
              color:#9a3412;
              font-size:11px;
            ">

              <strong>
                ${escapeHtml(
                  item.contractId
                )}
              </strong>

              :

              ${item.controlFailures
                .map(
                  control =>
                    escapeHtml(
                      control.title
                    )
                )
                .join(", ")}

            </div>

          `;

        }
      ).join("")}

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


/*
============================================================
SET BULK PREVIEW
============================================================
*/

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
EXCEL EXPORT
============================================================
*/

function exportBulkJournals() {

  if (
    !bulkJournalData.length
  ) {

    alert(
      "Önce toplu fişleri oluşturun."
    );

    return;

  }

  const invalid =
    bulkJournalData.filter(
      x => !x.balanced
    );

  if (invalid.length) {

    alert(
      "Borç-Alacak dengesi sağlanmayan fişler bulundu. Excel aktarımı engellendi."
    );

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
              getPeriodLabel(item),

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

            "Muhasebe Kontrol":
              "OK",

            "Kontrol Uyarısı":
              item.controlFailures.length
                ? item.controlFailures
                    .map(
                      x =>
                        x.title
                    )
                    .join(" | ")
                : "Yok"

          });

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
        XLSX.utils.json_to_sheet(
          rows
        );

      worksheet["!cols"] = [

        { wch: 20 },
        { wch: 14 },
        { wch: 18 },
        { wch: 20 },
        { wch: 25 },
        { wch: 20 },
        { wch: 45 },
        { wch: 38 },
        { wch: 18 },
        { wch: 18 },
        { wch: 18 },
        { wch: 50 }

      ];

      const workbook =
        XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "TFRS16 Fisleri"
      );

      XLSX.writeFile(
        workbook,
        `TFRS16_Toplu_Muhasebe_Fisleri_${new Date().getTime()}.xlsx`
      );

      return;

    }

    catch (error) {

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
      ["\uFEFF" + csv],
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
}


/*
============================================================
PERIOD LABEL
============================================================
*/

function getPeriodLabel(
  item
) {

  if (
    item.period ===
    "monthly"
  ) {

    return `${item.year} ${getMonthName(
      item.month
    )}`;

  }

  if (
    item.period ===
    "quarterly"
  ) {

    return `${item.year} ${Math.ceil(
      item.month / 3
    )}. Çeyrek`;

  }

  return `${item.year} Yıllık`;
}


/*
============================================================
DETAIL MODAL
============================================================
*/

function openDetail(id) {

  const contract =
    contracts.find(
      item =>
        item.id === id
    );

  if (!contract) return;

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


  modal?.classList.remove(
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

      document
        .getElementById(
          "openBulkJournalButton"
        )
        ?.addEventListener(
          "click",
          openBulkJournalModal
        );

    },
    0
  );

}


/*
============================================================
DETAIL CLOSE
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
BULK CONTRACT IMPORT
============================================================
*/

function openBulkImportModal() {

  const modal =
    document.getElementById(
      "bulkImportModal"
    );

  if (!modal) return;

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

    fileInput.value =
      "";

  }

  if (preview) {

    preview.innerHTML =
      "";

  }

  if (status) {

    status.innerHTML =
      "";

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
        XLSX.utils.aoa_to_sheet(
          [
            headers,
            example
          ]
        );

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

    }

    catch (error) {

      console.error(
        "XLSX template error:",
        error
      );

    }

  }


  const csv =
    [
      headers,
      example
    ]
      .map(
        row =>
          row
            .map(
              cell =>
                `"${String(
                  cell
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
      ["\uFEFF" + csv],
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
    "Excel modülü bulunamadı. CSV şablonu indirildi.",
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

  if (!file) return;

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
      extension ===
      "csv"
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
          "Excel modülü yüklenemedi. CSV dosyası kullanabilirsiniz.",
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
            type:
              "array",

            cellDates:
              true
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


  }

  catch (error) {

    console.error(
      "Bulk import error:",
      error
    );

    showBulkStatus(
      "Dosya okunurken hata oluştu.",
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
      .split(
        /\r?\n/
      )
      .filter(
        line =>
          line.trim() !== ""
      );


  if (
    lines.length < 2
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

        row[header] =
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

      }

      else {

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

      current =
        "";

    }


    else {

      current +=
        char;

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
      const candidate of
      possibleHeaders
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

        warnings:
          validation.warnings,

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
NORMALIZE IMPORTED CONTRACT
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

      statusRaw === "pasif" ||
      statusRaw === "passive" ||
      statusRaw === "inactive"

        ? "passive"
        : "active",

    modification:

      modificationRaw === "true" ||
      modificationRaw === "1" ||
      modificationRaw === "evet"

  };

}


/*
============================================================
ROBUST NUMBER PARSER
============================================================
*/

function parseNumber(
  value
) {

  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {

    return value;

  }


  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {

    return 0;

  }


  let str =
    String(value)
      .trim()
      .replace(
        /\s/g,
        ""
      );


  /*
  ----------------------------------------------------------
  TURKISH FORMAT
  125.000,50
  ----------------------------------------------------------
  */

  if (
    str.includes(".") &&
    str.includes(",")
  ) {

    str =
      str
        .replace(
          /\./g,
          ""
        )
        .replace(
          ",",
          "."
        );

  }


  /*
  ----------------------------------------------------------
  TURKISH DECIMAL
  125000,50
  ----------------------------------------------------------
  */

  else if (
    str.includes(",")
  ) {

    str =
      str.replace(
        ",",
        "."
      );

  }


  /*
  ----------------------------------------------------------
  MULTIPLE DOTS
  ----------------------------------------------------------
  */

  else if (
    (
      str.match(
        /\./g
      ) || []
    ).length > 1
  ) {

    str =
      str.replace(
        /\./g,
        ""
      );

  }


  const result =
    Number(str);


  return Number.isFinite(
    result
  )
    ? result
    : 0;

}


/*
============================================================
VALIDATE IMPORTED CONTRACT
============================================================
*/

function validateImportedContract(
  contract
) {

  const errors = [];

  const warnings = [];


  if (
    !contract.id
  ) {

    errors.push(
      "Sözleşme ID eksik"
    );

  }


  if (
    !contract.company
  ) {

    errors.push(
      "Şirket eksik"
    );

  }


  if (
    !contract.supplier
  ) {

    warnings.push(
      "Tedarikçi bilgisi eksik"
    );

  }


  if (
    !contract.startDate
  ) {

    errors.push(
      "Geçersiz Başlangıç Tarihi"
    );

  }


  if (
    !contract.endDate
  ) {

    errors.push(
      "Geçersiz Bitiş Tarihi"
    );

  }


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
    end <= start
  ) {

    errors.push(
      "Bitiş tarihi başlangıç tarihinden sonra olmalı"
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
    contract.discountRate < 0
  ) {

    errors.push(
      "İskonto oranı negatif olamaz"
    );

  }


  if (
    contract.discountRate > 100
  ) {

    errors.push(
      "İskonto oranı %100'den büyük olamaz"
    );

  }


  if (
    contract.modification
  ) {

    warnings.push(
      "Modification incelemesi gerekiyor"
    );

  }


  return {

    errors,

    warnings

  };

}


/*
============================================================
IMPORT PREVIEW
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


  if (!preview) return;


  if (
    !bulkImportData.length
  ) {

    preview.innerHTML =
      "";

    if (confirmButton) {

      confirmButton.disabled =
        true;

    }

    return;

  }


  const validCount =
    bulkImportData.filter(
      item =>
        !item.errors.length &&
        !item.duplicate
    ).length;


  const errorCount =
    bulkImportData.filter(
      item =>
        item.errors.length
    ).length;


  const duplicateCount =
    bulkImportData.filter(
      item =>
        item.duplicate
    ).length;


  preview.innerHTML = `

    <div style="
      display:grid;
      grid-template-columns:
        repeat(auto-fit,minmax(130px,1fr));
      gap:8px;
      margin-bottom:12px;
    ">

      <div style="
        padding:10px;
        background:#ecfdf5;
        border:1px solid #bbf7d0;
        border-radius:8px;
        color:#166534;
      ">
        <small>GEÇERLİ</small>
        <strong style="
          display:block;
          font-size:18px;
        ">
          ${validCount}
        </strong>
      </div>


      <div style="
        padding:10px;
        background:#fef2f2;
        border:1px solid #fecaca;
        border-radius:8px;
        color:#991b1b;
      ">
        <small>HATALI</small>
        <strong style="
          display:block;
          font-size:18px;
        ">
          ${errorCount}
        </strong>
      </div>


      <div style="
        padding:10px;
        background:#fff7ed;
        border:1px solid #fed7aa;
        border-radius:8px;
        color:#9a3412;
      ">
        <small>TEKRAR</small>
        <strong style="
          display:block;
          font-size:18px;
        ">
          ${duplicateCount}
        </strong>
      </div>

    </div>


    <div style="
      overflow:auto;
      border:1px solid #e5e7eb;
      border-radius:9px;
    ">

      <table style="
        width:100%;
        min-width:900px;
        border-collapse:collapse;
      ">

        <thead>

          <tr>

            <th style="padding:9px;">
              Satır
            </th>

            <th style="padding:9px;">
              Sözleşme
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

            <th style="padding:9px;">
              Kontrol
            </th>

          </tr>

        </thead>


        <tbody>

          ${bulkImportData.map(
            item => `

              <tr>

                <td style="padding:9px;">
                  ${item.row}
                </td>

                <td style="padding:9px;">
                  ${escapeHtml(
                    item.contract.id
                  )}
                </td>

                <td style="padding:9px;">
                  ${escapeHtml(
                    item.contract.company
                  )}
                </td>

                <td style="
                  padding:9px;
                  text-align:right;
                ">
                  ${formatCurrency(
                    item.contract.monthlyPayment
                  )}
                </td>

                <td style="padding:9px;">

                  ${
                    item.errors.length
                      ? "✕ Hatalı"
                      : item.duplicate
                        ? "⚠ Tekrar"
                        : "✓ Geçerli"
                  }

                </td>

                <td style="
                  padding:9px;
                  font-size:10px;
                ">

                  ${
                    [
                      ...item.errors,
                      ...item.warnings,
                      ...(item.duplicate
                        ? [
                            "Sözleşme zaten mevcut"
                          ]
                        : [])
                    ]
                    .map(
                      message =>
                        escapeHtml(
                          message
                        )
                    )
                    .join(
                      " · "
                    ) ||
                    "OK"
                  }

                </td>

              </tr>

            `
          ).join("")}

        </tbody>

      </table>

    </div>

  `;


  if (confirmButton) {

    confirmButton.disabled =
      validCount === 0;

  }

}


/*
============================================================
STATUS
============================================================
*/

function showBulkStatus(
  msg,
  type
) {

  const status =
    document.getElementById(
      "bulkImportStatus"
    );

  if (!status) return;

  status.textContent =
    msg;

  status.className =
    type;

}


/*
============================================================
MONTH NAME
============================================================
*/

function getMonthName(
  m
) {

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

  return (
    months[m - 1] ||
    ""
  );

}


/*
============================================================
HTML ESCAPE
============================================================
*/

function escapeHtml(
  text
) {

  if (
    text === null ||
    text === undefined
  ) {

    return "";

  }

  return String(text)

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
============================================================
REFRESH
============================================================
*/

function refresh() {

  populateCompanyFilter();

  renderTable();

  updateKPIs();

}


refresh();
