document.addEventListener("DOMContentLoaded", function () {

  const data = window.CFO_DATA;


  /*
  =====================================================
  CFO KPI
  =====================================================
  */

  const kpis = {

    revenue: data.financial.revenue,

    ebitda: data.financial.ebitda,

    ebitdaMargin:
      data.financial.ebitdaMargin,

    cash:
      data.financial.cash,

    freeCashFlow:
      data.financial.freeCashFlow,

    netProfit:
      data.financial.netProfit

  };


  /*
  =====================================================
  TFRS 16
  =====================================================
  */

  const tfrs = data.tfrs16;


  const tfrsMain =
    document.querySelector(".tfrs-main");


  if (tfrsMain) {

    tfrsMain.innerHTML = `

      <div class="big-metric">

        <span>
          Kira Yükümlülüğü
        </span>

        <strong>
          ₺${formatNumber(tfrs.leaseLiability)}
        </strong>

      </div>


      <div class="big-metric">

        <span>
          ROU Varlıkları
        </span>

        <strong>
          ₺${formatNumber(tfrs.rouAssets)}
        </strong>

      </div>

    `;

  }


  /*
  =====================================================
  TFRS 16 MINI METRICS
  =====================================================
  */

  const miniGrid =
    document.querySelector(".tfrs-small-grid");


  if (miniGrid) {

    miniGrid.innerHTML = `

      <div>

        <span>
          Önümüzdeki 12 Ay
        </span>

        <strong>
          ₺${formatNumber(tfrs.next12Months)}
        </strong>

      </div>


      <div>

        <span>
          Sözleşme
        </span>

        <strong>
          ${tfrs.contracts}
        </strong>

      </div>


      <div>

        <span>
          Yenileme &lt;90 gün
        </span>

        <strong class="warning-text">
          ${tfrs.renewals90Days}
        </strong>

      </div>


      <div>

        <span>
          Modification
        </span>

        <strong class="warning-text">
          ${tfrs.modifications}
        </strong>

      </div>

    `;

  }


  /*
  =====================================================
  CFO ACTION CENTER
  =====================================================
  */

  const actionContainer =
    document.querySelector(".action");

  /*
  İlerleyen aşamada bu alanı da
  gerçek finansal verilere bağlayacağız.
  */


  console.log(
    "CFO Cockpit data loaded:",
    data
  );


});


function formatNumber(value) {

  return Number(value).toLocaleString(
    "tr-TR",
    {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }
  );

}
