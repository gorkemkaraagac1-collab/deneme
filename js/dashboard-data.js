const defaultTFRS16Contracts = [

    {
        id: "LEASE-001",
        company: "GK Holding",
        supplier: "ABC Gayrimenkul",
        startDate: "2024-01-01",
        endDate: "2028-12-31",
        monthlyPayment: 250000,
        discountRate: 18,
        renewalDate: "2027-12-31",
        status: "active"
    },

    {
        id: "LEASE-002",
        company: "GK Holding",
        supplier: "XYZ Plaza",
        startDate: "2025-01-01",
        endDate: "2030-12-31",
        monthlyPayment: 180000,
        discountRate: 17,
        renewalDate: "2026-11-30",
        status: "active"
    },

    {
        id: "LEASE-003",
        company: "GK Holding",
        supplier: "Delta Logistics",
        startDate: "2023-07-01",
        endDate: "2027-06-30",
        monthlyPayment: 120000,
        discountRate: 19,
        renewalDate: "2027-03-31",
        status: "active"
    }

];


function calculateLeaseLiability(
    contract
) {

    const start =
        new Date(
            contract.startDate
        );

    const end =
        new Date(
            contract.endDate
        );


    const months =
        (
            end.getFullYear() -
            start.getFullYear()
        ) * 12
        +
        (
            end.getMonth() -
            start.getMonth()
        )
        + 1;


    const monthlyRate =
        contract.discountRate /
        100 /
        12;


    if (monthlyRate === 0) {

        return (
            contract.monthlyPayment *
            months
        );

    }


    return (
        contract.monthlyPayment *
        (
            1 -
            Math.pow(
                1 + monthlyRate,
                -months
            )
        )
        /
        monthlyRate
    );

}


function buildTFRS16Summary() {

    const contracts =
        defaultTFRS16Contracts.filter(
            contract =>
                contract.status === "active"
        );


    const calculated =
        contracts.map(
            contract => {

                const liability =
                    calculateLeaseLiability(
                        contract
                    );


                return {

                    ...contract,

                    leaseLiability:
                        liability,

                    rouAssets:
                        liability

                };

            }
        );


    const leaseLiability =
        calculated.reduce(
            (sum, contract) =>
                sum +
                contract.leaseLiability,
            0
        );


    const rouAssets =
        calculated.reduce(
            (sum, contract) =>
                sum +
                contract.rouAssets,
            0
        );


    const next12Months =
        calculated.reduce(
            (sum, contract) =>
                sum +
                contract.monthlyPayment * 12,
            0
        );


    return {

        contracts:
            calculated.length,

        leaseLiability,

        rouAssets,

        next12Months,

        renewals90Days:
            1,

        modifications:
            0

    };

}


window.CFO_DATA = {

    period:
        "Ağustos 2026",

    company:
        "GK Holding",


    financial: {

        revenue:
            428.5,

        ebitda:
            76.2,

        ebitdaMargin:
            17.8,

        cash:
            92.0,

        freeCashFlow:
            34.0,

        netProfit:
            41.7

    },


    workingCapital: {

        dso:
            68,

        dpo:
            52,

        inventoryDays:
            58,

        cashConversionCycle:
            74

    },


    close: {

        progress:
            82,

        completed:
            41,

        total:
            50,

        target:
            "D+5"

    },


    tfrs16:
        buildTFRS16Summary(),


    risks: {

        critical:
            1,

        warning:
            2

    }

};
