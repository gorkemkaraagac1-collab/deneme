document.addEventListener("DOMContentLoaded", function () {

    /*
    =====================================================
    CFO DATA
    =====================================================
    */

    const data = window.CFO_DATA;

    if (!data) {

        console.error(
            "CFO_DATA bulunamadı. dashboard-data.js yüklenmemiş olabilir."
        );

        return;

    }


    /*
    =====================================================
    FINANCIAL KPI
    =====================================================
    */

    const financial = data.financial || {};

    setText(
        "revenueKpi",
        formatMoney(financial.revenue)
    );

    setText(
        "ebitdaKpi",
        formatMoney(financial.ebitda)
    );

    setText(
        "ebitdaMarginKpi",
        formatPercent(financial.ebitdaMargin)
    );

    setText(
        "cashKpi",
        formatMoney(financial.cash)
    );

    setText(
        "fcfKpi",
        formatMoney(financial.freeCashFlow)
    );

    setText(
        "netProfitKpi",
        formatMoney(financial.netProfit)
    );


    /*
    =====================================================
    FINANCIAL PERFORMANCE
    =====================================================
    */

    setText(
        "revenueMetric",
        formatMoney(financial.revenue)
    );

    setText(
        "ebitdaMetric",
        formatMoney(financial.ebitda)
    );

    setText(
        "ebitdaMarginMetric",
        formatPercent(financial.ebitdaMargin)
    );

    setText(
        "netProfitMetric",
        formatMoney(financial.netProfit)
    );

    setText(
        "fcfMetric",
        formatMoney(financial.freeCashFlow)
    );


    /*
    =====================================================
    WORKING CAPITAL
    =====================================================
    */

    const workingCapital =
        data.workingCapital || {};

    setText(
        "dsoMetric",
        formatDays(workingCapital.dso)
    );

    setText(
        "dpoMetric",
        formatDays(workingCapital.dpo)
    );

    setText(
        "inventoryMetric",
        formatDays(workingCapital.inventoryDays)
    );

    setText(
        "cccMetric",
        formatDays(
            workingCapital.cashConversionCycle
        )
    );


    /*
    =====================================================
    TFRS 16
    =====================================================
    */

    const tfrs =
        data.tfrs16 || {};

    setText(
        "tfrsLiability",
        formatMoney(
            tfrs.leaseLiability
        )
    );

    setText(
        "tfrsRou",
        formatMoney(
            tfrs.rouAssets
        )
    );

    setText(
        "tfrsNext12",
        formatMoney(
            tfrs.next12Months
        )
    );

    setText(
        "tfrsContracts",
        tfrs.contracts || 0
    );

    setText(
        "tfrsRenewals",
        tfrs.renewals90Days || 0
    );

    setText(
        "tfrsModifications",
        tfrs.modifications || 0
    );


    /*
    =====================================================
    CLOSE
    =====================================================
    */

    const close =
        data.close || {};

    const progress =
        Number(close.progress || 0);

    setText(
        "closeProgress",
        `%${progress}`
    );

    setText(
        "closeCompleted",
        `${close.completed || 0} / ${close.total || 0} tamamlandı`
    );

    setText(
        "closeTarget",
        `Hedef: ${close.target || "D+5"}`
    );


    const progressBar =
        document.getElementById(
            "closeProgressBar"
        );

    if (progressBar) {

        progressBar.style.width =
            `${Math.min(progress, 100)}%`;

    }


    /*
    =====================================================
    CFO ACTION CENTER
    =====================================================
    */

    const renewalCount =
        Number(
            tfrs.renewals90Days || 0
        );


    const renewalAction =
        document.getElementById(
            "renewalAction"
        );


    if (renewalAction) {

        if (renewalCount > 0) {

            renewalAction.textContent =
                `${renewalCount} sözleşmenin önümüzdeki 90 gün içinde yenileme tarihi bulunuyor.`;

        } else {

            renewalAction.textContent =
                "Önümüzdeki 90 gün içinde kritik sözleşme yenilemesi bulunmuyor.";

        }

    }


    /*
    =====================================================
    LOG
    =====================================================
    */

    console.log(
        "CFO Cockpit başarıyla yüklendi:",
        data
    );

});


/*
=========================================================
HELPER FUNCTIONS
=========================================================
*/


function setText(
    elementId,
    value
) {

    const element =
        document.getElementById(
            elementId
        );

    if (element) {

        element.textContent =
            value;

    }

}


function formatMoney(
    value
) {

    const number =
        Number(value || 0);


    return "₺" +
        number.toLocaleString(
            "tr-TR",
            {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1
            }
        );

}


function formatPercent(
    value
) {

    const number =
        Number(value || 0);


    return "%" +
        number.toLocaleString(
            "tr-TR",
            {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1
            }
        );

}


function formatDays(
    value
) {

    const number =
        Number(value || 0);


    return `${number.toLocaleString(
        "tr-TR",
        {
            maximumFractionDigits: 0
        }
    )} gün`;

}
