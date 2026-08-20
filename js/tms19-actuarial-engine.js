/* ============================================================
   GK ADVISORY — TMS 19 AKTÜERYAL MOTOR
   Version: 3.0.0

   TMS 19 — Çalışanlara Sağlanan Faydalar

   Metodoloji:
   Projected Unit Credit (PUC)

   Amaç:
   - DBO hesaplama
   - Current Service Cost
   - Interest Cost
   - P&L / OCI
   - DBO Roll-forward
   - Sensitivity
   - Stress Test
   - Varsayım kontrolü
   - CFO karar desteği

   NOT:
   Bu motor aktüeryal rapor yerine geçmez.
   Gerçek değerleme için plan şartları ve aktüeryal
   varsayımlar profesyonel aktüer tarafından doğrulanmalıdır.
============================================================ */

"use strict";


/* ============================================================
   1. MOTOR KONFİGÜRASYONU
============================================================ */

const TMS19_CONFIG = {

    version: "3.0.0",

    standard: "TMS 19",

    methodology: "Projected Unit Credit",

    currency: "TRY",

    defaultAssumptions: {

        discountRate: 0.30,

        salaryIncreaseRate: 0.35,

        inflationRate: 0.30,

        turnoverRate: 0.05,

        retirementAge: 60,

        benefitRate: 0.03,

        mortalityRate: 0.00,

        disabilityRate: 0.00

    },

    sensitivity: {

        discountRate: 0.01,

        salaryIncreaseRate: 0.01,

        turnoverRate: 0.01

    }

};


/* ============================================================
   2. SAYISAL YARDIMCILAR
============================================================ */

function toNumber(value, fallback = 0) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return fallback;
    }

    if (typeof value === "number") {

        return Number.isFinite(value)
            ? value
            : fallback;

    }

    let text =
        String(value)
            .trim()
            .replace(/\s/g, "");

    /*
       Türkçe sayı formatı:
       1.250.000,50
    */

    if (
        text.includes(",") &&
        text.includes(".")
    ) {

        text =
            text
                .replace(/\./g, "")
                .replace(",", ".");

    } else if (
        text.includes(",")
    ) {

        text =
            text.replace(",", ".");

    }

    text =
        text.replace("%", "");

    const result =
        parseFloat(text);

    return Number.isFinite(result)
        ? result
        : fallback;
}


function round(value, decimals = 2) {

    const factor =
        Math.pow(10, decimals);

    return Math.round(
        (value + Number.EPSILON) *
        factor
    ) / factor;
}


function clamp(
    value,
    min,
    max
) {

    return Math.min(
        Math.max(value, min),
        max
    );

}


function pv(
    futureValue,
    discountRate,
    years
) {

    if (
        futureValue <= 0
    ) {
        return 0;
    }

    return (
        futureValue /
        Math.pow(
            1 + discountRate,
            years
        )
    );

}


/* ============================================================
   3. PERSONEL MODELİ
============================================================ */

function createEmployee(data = {}) {

    const a =
        TMS19_CONFIG.defaultAssumptions;


    return {

        id:
            data.id ||
            `PRS-${Date.now()}`,

        employeeNumber:
            data.employeeNumber ||
            "",

        name:
            data.name ||
            "Yeni Personel",

        gender:
            data.gender ||
            "Belirtilmemiş",

        currentAge:
            toNumber(
                data.currentAge,
                35
            ),

        retirementAge:
            toNumber(
                data.retirementAge,
                a.retirementAge
            ),

        yearsOfService:
            toNumber(
                data.yearsOfService,
                5
            ),

        currentAnnualSalary:
            toNumber(
                data.currentAnnualSalary,
                600000
            ),

        benefitRate:
            toNumber(
                data.benefitRate,
                a.benefitRate
            ),

        discountRate:
            toNumber(
                data.discountRate,
                a.discountRate
            ),

        salaryIncreaseRate:
            toNumber(
                data.salaryIncreaseRate,
                a.salaryIncreaseRate
            ),

        inflationRate:
            toNumber(
                data.inflationRate,
                a.inflationRate
            ),

        turnoverRate:
            toNumber(
                data.turnoverRate,
                a.turnoverRate
            ),

        mortalityRate:
            toNumber(
                data.mortalityRate,
                a.mortalityRate
            ),

        disabilityRate:
            toNumber(
                data.disabilityRate,
                a.disabilityRate
            ),

        openingDBO:
            toNumber(
                data.openingDBO,
                0
            ),

        planAssets:
            toNumber(
                data.planAssets,
                0
            ),

        benefitPayments:
            toNumber(
                data.benefitPayments,
                0
            )

    };

}


/* ============================================================
   4. KALAN HİZMET
============================================================ */

function remainingService(
    employee
) {

    return Math.max(
        employee.retirementAge -
        employee.currentAge,
        0
    );

}


/* ============================================================
   5. TOPLAM HİZMET
============================================================ */

function totalService(
    employee
) {

    return (
        employee.yearsOfService +
        remainingService(employee)
    );

}


/* ============================================================
   6. MAAŞ PROJEKSİYONU
============================================================ */

function projectedSalary(
    employee,
    years
) {

    const salary =
        employee.currentAnnualSalary *
        Math.pow(
            1 +
            employee.salaryIncreaseRate,
            years
        );

    return salary;

}


/* ============================================================
   7. AKTÜERYAL OLASILIK
============================================================ */

function survivalProbability(
    employee,
    years
) {

    const turnover =
        clamp(
            employee.turnoverRate,
            0,
            1
        );

    const mortality =
        clamp(
            employee.mortalityRate,
            0,
            1
        );

    const disability =
        clamp(
            employee.disabilityRate,
            0,
            1
        );


    const annualRetention =

        (1 - turnover) *
        (1 - mortality) *
        (1 - disability);


    return Math.pow(
        annualRetention,
        years
    );

}


/* ============================================================
   8. GELECEKTEKİ TOPLAM FAYDA
============================================================ */

function projectedRetirementBenefit(
    employee
) {

    const remaining =
        remainingService(
            employee
        );

    const total =
        totalService(
            employee
        );

    const finalSalary =
        projectedSalary(
            employee,
            remaining
        );


    const benefit =

        finalSalary *
        employee.benefitRate *
        total;


    return {

        remainingService:
            remaining,

        totalService:
            total,

        finalSalary,

        projectedBenefit:
            benefit

    };

}


/* ============================================================
   9. PUC DEĞERLEME TABLOSU
============================================================ */

function calculatePUC(
    employee
) {

    const remaining =
        remainingService(
            employee
        );


    const total =
        totalService(
            employee
        );


    const rows = [];


    let dbo = 0;

    let serviceCost = 0;


    /*
       Her gelecek hizmet yılı için:

       - gelecekteki maaş
       - o yıldaki toplam hizmet
       - hizmet birimi
       - kalma olasılığı
       - beklenen fayda
       - iskonto
       - bugünkü değer
    */

    for (
        let year = 1;
        year <= remaining;
        year++
    ) {

        const salary =
            projectedSalary(
                employee,
                year
            );


        const serviceAtYear =
            employee.yearsOfService +
            year;


        /*
           Emeklilikte toplam beklenen fayda
        */

        const totalBenefit =

            salary *
            employee.benefitRate *
            serviceAtYear;


        /*
           Bir yıllık hizmet birimi
        */

        const annualBenefitUnit =

            salary *
            employee.benefitRate;


        /*
           Aktif kalma olasılığı
        */

        const survival =

            survivalProbability(
                employee,
                year
            );


        /*
           Beklenen toplam fayda
        */

        const expectedBenefit =

            totalBenefit *
            survival;


        /*
           Beklenen bir yıllık hizmet maliyeti
        */

        const expectedServiceBenefit =

            annualBenefitUnit *
            survival;


        /*
           Bugünkü değer
        */

        const discountedBenefit =

            pv(
                expectedBenefit,
                employee.discountRate,
                year
            );


        const discountedServiceCost =

            pv(
                expectedServiceBenefit,
                employee.discountRate,
                year
            );


        dbo +=
            discountedBenefit;


        serviceCost +=
            discountedServiceCost;


        rows.push({

            year,

            age:
                employee.currentAge +
                year,

            salary,

            serviceAtYear,

            totalBenefit,

            annualBenefitUnit,

            survivalProbability:
                survival,

            expectedBenefit,

            expectedServiceBenefit,

            discountedBenefit,

            discountedServiceCost

        });

    }


    return {

        rows,

        dbo,

        projectedServiceCost:
            serviceCost,

        totalService:
            total,

        remainingService:
            remaining

    };

}


/* ============================================================
   10. CURRENT SERVICE COST
============================================================ */

function calculateCurrentServiceCost(
    employee
) {

    const puc =
        calculatePUC(
            employee
        );


    if (
        puc.rows.length === 0
    ) {
        return 0;
    }


    /*
       Bir sonraki hizmet döneminin
       aktüeryal bugünkü değeri.
    */

    return puc.rows[0]
        .discountedServiceCost;

}


/* ============================================================
   11. INTEREST COST
============================================================ */

function calculateInterestCost(
    openingDBO,
    discountRate
) {

    return (
        openingDBO *
        discountRate
    );

}


/* ============================================================
   12. PLAN VARLIKLARI ÜZERİNDEN FAİZ GELİRİ
============================================================ */

function calculateInterestIncome(
    openingPlanAssets,
    discountRate
) {

    return (
        openingPlanAssets *
        discountRate
    );

}


/* ============================================================
   13. NET FAİZ
============================================================ */

function calculateNetInterest(
    openingDBO,
    openingPlanAssets,
    discountRate
) {

    const interestCost =

        calculateInterestCost(
            openingDBO,
            discountRate
        );


    const interestIncome =

        calculateInterestIncome(
            openingPlanAssets,
            discountRate
        );


    return {

        interestCost,

        interestIncome,

        netInterest:

            interestCost -
            interestIncome

    };

}


/* ============================================================
   14. AKTÜERYAL KAZANÇ / KAYIP
============================================================ */

function calculateRemeasurement(
    expectedDBO,
    actualDBO
) {

    return (
        actualDBO -
        expectedDBO
    );

}


/* ============================================================
   15. DBO ROLL-FORWARD
============================================================ */

function calculateDBORollForward({

    openingDBO = 0,

    currentServiceCost = 0,

    interestCost = 0,

    remeasurement = 0,

    pastServiceCost = 0,

    benefitPayments = 0

} = {}) {


    const closingDBO =

        openingDBO +

        currentServiceCost +

        interestCost +

        remeasurement +

        pastServiceCost -

        benefitPayments;


    return {

        openingDBO,

        currentServiceCost,

        interestCost,

        remeasurement,

        pastServiceCost,

        benefitPayments,

        closingDBO

    };

}


/* ============================================================
   16. NET DEFINED BENEFIT LIABILITY
============================================================ */

function calculateNetLiability(
    dbo,
    planAssets
) {

    return (
        dbo -
        planAssets
    );

}


/* ============================================================
   17. P&L ETKİSİ
============================================================ */

function calculatePL({

    currentServiceCost = 0,

    pastServiceCost = 0,

    settlementEffect = 0,

    netInterest = 0

} = {}) {


    return {

        currentServiceCost,

        pastServiceCost,

        settlementEffect,

        netInterest,

        totalPL:

            currentServiceCost +
            pastServiceCost +
            settlementEffect +
            netInterest

    };

}


/* ============================================================
   18. OCI / REMEASUREMENT
============================================================ */

function calculateOCI({

    actuarialGainLoss = 0,

    assetReturnDifference = 0,

    assetCeilingEffect = 0

} = {}) {


    return {

        actuarialGainLoss,

        assetReturnDifference,

        assetCeilingEffect,

        totalOCI:

            actuarialGainLoss +
            assetReturnDifference +
            assetCeilingEffect

    };

}


/* ============================================================
   19. SENSITIVITY
============================================================ */

function calculateSensitivity(
    employeeData
) {

    const base =
        createEmployee(
            employeeData
        );


    function dboFor(
        overrides
    ) {

        const employee =
            createEmployee({

                ...employeeData,

                ...overrides

            });


        return calculatePUC(
            employee
        ).dbo;

    }


    const baseDBO =
        dboFor({});


    const discountMinus =
        dboFor({

            discountRate:

                base.discountRate -
                TMS19_CONFIG.sensitivity.discountRate

        });


    const discountPlus =
        dboFor({

            discountRate:

                base.discountRate +
                TMS19_CONFIG.sensitivity.discountRate

        });


    const salaryMinus =
        dboFor({

            salaryIncreaseRate:

                base.salaryIncreaseRate -
                TMS19_CONFIG.sensitivity.salaryIncreaseRate

        });


    const salaryPlus =
        dboFor({

            salaryIncreaseRate:

                base.salaryIncreaseRate +
                TMS19_CONFIG.sensitivity.salaryIncreaseRate

        });


    const turnoverMinus =
        dboFor({

            turnoverRate:

                Math.max(
                    0,
                    base.turnoverRate -
                    TMS19_CONFIG.sensitivity.turnoverRate
                )

        });


    const turnoverPlus =
        dboFor({

            turnoverRate:

                base.turnoverRate +
                TMS19_CONFIG.sensitivity.turnoverRate

        });


    return {

        base:
            baseDBO,

        discountRate: {

            minus100bps:
                discountMinus,

            base:
                baseDBO,

            plus100bps:
                discountPlus,

            minusImpact:
                discountMinus -
                baseDBO,

            plusImpact:
                discountPlus -
                baseDBO

        },

        salaryIncreaseRate: {

            minus100bps:
                salaryMinus,

            base:
                baseDBO,

            plus100bps:
                salaryPlus,

            minusImpact:
                salaryMinus -
                baseDBO,

            plusImpact:
                salaryPlus -
                baseDBO

        },

        turnoverRate: {

            minus100bps:
                turnoverMinus,

            base:
                baseDBO,

            plus100bps:
                turnoverPlus,

            minusImpact:
                turnoverMinus -
                baseDBO,

            plusImpact:
                turnoverPlus -
                baseDBO

        }

    };

}


/* ============================================================
   20. STRESS TEST
============================================================ */

function calculateStressTest(
    employeeData
) {

    const base =
        createEmployee(
            employeeData
        );


    const scenarios = {

        "Baz Senaryo": {

            discountRate: 0,

            salaryIncreaseRate: 0,

            turnoverRate: 0

        },

        "Olumlu Senaryo": {

            discountRate: +0.01,

            salaryIncreaseRate: -0.01,

            turnoverRate: +0.01

        },

        "Olumsuz Senaryo": {

            discountRate: -0.01,

            salaryIncreaseRate: +0.01,

            turnoverRate: -0.01

        },

        "Stres Senaryosu": {

            discountRate: -0.02,

            salaryIncreaseRate: +0.02,

            turnoverRate: -0.02

        }

    };


    const result = {};


    Object.entries(
        scenarios
    ).forEach(
        ([name, scenario]) => {


            const employee =
                createEmployee({

                    ...employeeData,

                    discountRate:

                        base.discountRate +
                        scenario.discountRate,

                    salaryIncreaseRate:

                        base.salaryIncreaseRate +
                        scenario.salaryIncreaseRate,

                    turnoverRate:

                        Math.max(
                            0,
                            base.turnoverRate +
                            scenario.turnoverRate
                        )

                });


            const dbo =
                calculatePUC(
                    employee
                ).dbo;


            result[name] = {

                dbo,

                difference:
                    dbo -
                    calculatePUC(
                        base
                    ).dbo,

                differencePercent:

                    base.currentAnnualSalary === 0

                        ? 0

                        :

                        (
                            dbo -
                            calculatePUC(
                                base
                            ).dbo
                        ) /
                        calculatePUC(
                            base
                        ).dbo

            };

        }
    );


    return result;

}


/* ============================================================
   21. VARSAYIM KONTROLÜ
============================================================ */

function validateAssumptions(
    employee
) {

    const warnings = [];


    if (
        employee.discountRate <= 0
    ) {

        warnings.push({

            level: "Kritik",

            category: "İskonto",

            message:
                "İskonto oranı sıfırdan büyük olmalıdır."

        });

    }


    if (
        employee.discountRate > 0.50
    ) {

        warnings.push({

            level: "Yüksek",

            category: "İskonto",

            message:
                "İskonto oranı olağandışı yüksek görünüyor."

        });

    }


    if (
        employee.salaryIncreaseRate > 0.50
    ) {

        warnings.push({

            level: "Yüksek",

            category: "Maaş",

            message:
                "Maaş artış varsayımı %50'nin üzerinde."

        });

    }


    if (
        employee.turnoverRate > 0.20
    ) {

        warnings.push({

            level: "Yüksek",

            category: "Turnover",

            message:
                "Personel devir varsayımı %20'nin üzerinde."

        });

    }


    if (
        employee.retirementAge <=
        employee.currentAge
    ) {

        warnings.push({

            level: "Kritik",

            category: "Emeklilik",

            message:
                "Emeklilik yaşı mevcut yaştan büyük olmalıdır."

        });

    }


    if (
        employee.yearsOfService < 0
    ) {

        warnings.push({

            level: "Kritik",

            category: "Hizmet",

            message:
                "Hizmet süresi negatif olamaz."

        });

    }


    if (
        employee.currentAnnualSalary <= 0
    ) {

        warnings.push({

            level: "Kritik",

            category: "Maaş",

            message:
                "Yıllık ücret sıfırdan büyük olmalıdır."

        });

    }


    return warnings;

}


/* ============================================================
   22. RİSK SKORU
============================================================ */

function calculateRiskScore(
    employee,
    sensitivity
) {

    const warnings =
        validateAssumptions(
            employee
        );


    let score = 0;


    warnings.forEach(
        warning => {

            if (
                warning.level === "Kritik"
            ) {

                score += 35;

            } else if (
                warning.level === "Yüksek"
            ) {

                score += 20;

            } else {

                score += 10;

            }

        }
    );


    const dbo =
        sensitivity.base;


    const discountImpact =

        Math.abs(
            sensitivity
                .discountRate
                .minusImpact
        ) / dbo;


    const salaryImpact =

        Math.abs(
            sensitivity
                .salaryIncreaseRate
                .plusImpact
        ) / dbo;


    const turnoverImpact =

        Math.abs(
            sensitivity
                .turnoverRate
                .minusImpact
        ) / dbo;


    if (
        discountImpact > 0.10
    ) {

        score += 20;

    } else if (
        discountImpact > 0.05
    ) {

        score += 10;

    }


    if (
        salaryImpact > 0.10
    ) {

        score += 20;

    } else if (
        salaryImpact > 0.05
    ) {

        score += 10;

    }


    if (
        turnoverImpact > 0.10
    ) {

        score += 15;

    } else if (
        turnoverImpact > 0.05
    ) {

        score += 7;

    }


    score =
        clamp(
            score,
            0,
            100
        );


    let level;


    if (
        score >= 70
    ) {

        level = "Kritik";

    } else if (
        score >= 50
    ) {

        level = "Yüksek";

    } else if (
        score >= 25
    ) {

        level = "Orta";

    } else {

        level = "Düşük";

    }


    return {

        score,

        level,

        warnings

    };

}


/* ============================================================
   23. CFO İÇGÖRÜSÜ
============================================================ */

function generateCFOInsight(
    analysis
) {

    const dbo =
        analysis.puc.dbo;


    const sensitivity =
        analysis.sensitivity;


    const discountImpact =

        sensitivity
            .discountRate
            .minusImpact;


    const salaryImpact =

        sensitivity
            .salaryIncreaseRate
            .plusImpact;


    let primaryRisk =
        "Varsayım riski sınırlı.";


    if (
        Math.abs(discountImpact) >
        Math.abs(salaryImpact)
    ) {

        primaryRisk =
            "Ana risk iskonto oranıdır.";

    } else {

        primaryRisk =
            "Ana risk maaş artış varsayımıdır.";

    }


    let recommendation;


    if (
        analysis.risk.level ===
        "Kritik"
    ) {

        recommendation =
            "Aktüeryal varsayımlar ve plan hükümleri detaylı olarak yeniden değerlendirilmelidir.";

    } else if (
        analysis.risk.level ===
        "Yüksek"
    ) {

        recommendation =
            "Varsayımların bağımsız aktüeryal kanıtlarla ve bütçe/forecast varsayımlarıyla mutabakatı önerilir.";

    } else {

        recommendation =
            "Varsayımların dönemsel olarak izlenmesi ve gerçekleşen deneyimle karşılaştırılması yeterlidir.";

    }


    return {

        primaryRisk,

        recommendation,

        riskLevel:
            analysis.risk.level,

        dbo,

        discountSensitivity:
            discountImpact,

        salarySensitivity:
            salaryImpact

    };

}


/* ============================================================
   24. PERSONEL ANALİZİ
============================================================ */

function analyzeEmployee(
    employeeData
) {

    const employee =
        createEmployee(
            employeeData
        );


    const puc =
        calculatePUC(
            employee
        );


    const currentServiceCost =
        calculateCurrentServiceCost(
            employee
        );


    const netInterest =
        calculateNetInterest(

            employee.openingDBO,

            employee.planAssets,

            employee.discountRate

        );


    const projectedBenefit =
        projectedRetirementBenefit(
            employee
        );


    const sensitivity =
        calculateSensitivity(
            employee
        );


    const stressTest =
        calculateStressTest(
            employee
        );


    const risk =
        calculateRiskScore(
            employee,

            sensitivity

        );


    const netLiability =
        calculateNetLiability(

            puc.dbo,

            employee.planAssets

        );


    const pl =
        calculatePL({

            currentServiceCost,

            netInterest:
                netInterest.netInterest

        });


    const cfoBase = {

        employee,

        puc,

        currentServiceCost,

        netInterest,

        projectedBenefit,

        sensitivity,

        stressTest,

        risk,

        netLiability,

        pl

    };


    const cfoInsight =
        generateCFOInsight(
            cfoBase
        );


    return {

        ...cfoBase,

        cfoInsight

    };

}


/* ============================================================
   25. PORTFÖY ANALİZİ
============================================================ */

function analyzePortfolio(
    employees = []
) {

    const analyses =
        employees.map(
            employee =>
                analyzeEmployee(
                    employee
                )
        );


    const totalDBO =
        analyses.reduce(
            (
                total,
                analysis
            ) =>
                total +
                analysis.puc.dbo,

            0
        );


    const totalCSC =
        analyses.reduce(
            (
                total,
                analysis
            ) =>
                total +
                analysis.currentServiceCost,

            0
        );


    const totalNetLiability =
        analyses.reduce(
            (
                total,
                analysis
            ) =>
                total +
                analysis.netLiability,

            0
        );


    const totalProjectedBenefit =
        analyses.reduce(
            (
                total,
                analysis
            ) =>
                total +
                analysis
                    .projectedBenefit
                    .projectedBenefit,

            0
        );


    const highRiskCount =
        analyses.filter(
            analysis =>
                analysis.risk.level ===
                "Yüksek" ||

                analysis.risk.level ===
                "Kritik"
        ).length;


    const averageAge =

        analyses.length === 0

            ? 0

            :

            analyses.reduce(
                (
                    total,
                    analysis
                ) =>
                    total +
                    analysis
                        .employee
                        .currentAge,

                0

            ) /
            analyses.length;


    const averageDiscountRate =

        analyses.length === 0

            ? 0

            :

            analyses.reduce(
                (
                    total,
                    analysis
                ) =>
                    total +
                    analysis
                        .employee
                        .discountRate,

                0

            ) /
            analyses.length;


    return {

        employeeCount:
            employees.length,

        totalDBO,

        totalCSC,

        totalNetLiability,

        totalProjectedBenefit,

        highRiskCount,

        averageAge,

        averageDiscountRate,

        analyses

    };

}


/* ============================================================
   26. YILLIK DBO PROJEKSİYONU
============================================================ */

function projectDBO(
    employeeData,
    years = 10
) {

    const employee =
        createEmployee(
            employeeData
        );


    const result = [];


    let currentEmployee =
        {
            ...employee
        };


    for (
        let year = 0;
        year <= years;
        year++
    ) {

        const puc =
            calculatePUC(
                currentEmployee
            );


        result.push({

            year,

            age:
                currentEmployee.currentAge,

            salary:
                currentEmployee
                    .currentAnnualSalary,

            dbo:
                puc.dbo,

            currentServiceCost:
                calculateCurrentServiceCost(
                    currentEmployee
                )

        });


        currentEmployee = {

            ...currentEmployee,

            currentAge:
                currentEmployee.currentAge + 1,

            currentAnnualSalary:
                projectedSalary(
                    currentEmployee,
                    1
                ),

            yearsOfService:
                currentEmployee.yearsOfService + 1

        };

    }


    return result;

}


/* ============================================================
   27. DASHBOARD ÖZETİ
============================================================ */

function createDashboardSummary(
    employeeData
) {

    const analysis =
        analyzeEmployee(
            employeeData
        );


    return {

        dbo:
            analysis.puc.dbo,

        currentServiceCost:
            analysis.currentServiceCost,

        interestCost:
            analysis
                .netInterest
                .interestCost,

        netInterest:
            analysis
                .netInterest
                .netInterest,

        planAssets:
            analysis.employee.planAssets,

        netLiability:
            analysis.netLiability,

        projectedBenefit:
            analysis
                .projectedBenefit
                .projectedBenefit,

        finalSalary:
            analysis
                .projectedBenefit
                .finalSalary,

        remainingService:
            analysis
                .projectedBenefit
                .remainingService,

        riskScore:
            analysis
                .risk
                .score,

        riskLevel:
            analysis
                .risk
                .level,

        cfoPriority:
            analysis
                .cfoInsight
                .riskLevel,

        primaryRisk:
            analysis
                .cfoInsight
                .primaryRisk,

        recommendation:
            analysis
                .cfoInsight
                .recommendation

    };

}


/* ============================================================
   28. FORMATLAMA
============================================================ */

function formatTRY(
    value
) {

    return new Intl.NumberFormat(
        "tr-TR",
        {

            minimumFractionDigits: 0,

            maximumFractionDigits: 0

        }
    ).format(
        toNumber(value)
    );

}


function formatPercent(
    value
) {

    return new Intl.NumberFormat(
        "tr-TR",
        {

            style: "percent",

            minimumFractionDigits: 1,

            maximumFractionDigits: 2

        }
    ).format(
        toNumber(value)
    );

}


/* ============================================================
   29. HTML DASHBOARD GÜNCELLEME
============================================================ */

function updateDashboard(
    employeeData
) {

    const summary =
        createDashboardSummary(
            employeeData
        );


    const values = {

        dbo:
            formatTRY(
                summary.dbo
            ),

        "current-service-cost":
            formatTRY(
                summary.currentServiceCost
            ),

        "interest-cost":
            formatTRY(
                summary.interestCost
            ),

        "net-interest":
            formatTRY(
                summary.netInterest
            ),

        "plan-assets":
            formatTRY(
                summary.planAssets
            ),

        "net-liability":
            formatTRY(
                summary.netLiability
            ),

        "projected-benefit":
            formatTRY(
                summary.projectedBenefit
            ),

        "final-salary":
            formatTRY(
                summary.finalSalary
            ),

        "remaining-service":
            `${summary.remainingService} yıl`,

        "risk-score":
            summary.riskScore,

        "risk-level":
            summary.riskLevel,

        "cfo-priority":
            summary.cfoPriority,

        "primary-risk":
            summary.primaryRisk,

        "recommendation":
            summary.recommendation

    };


    Object.entries(
        values
    ).forEach(
        (
            [
                key,
                value
            ]
        ) => {

            const element =
                document.querySelector(
                    `[data-tms19="${key}"]`
                );


            if (
                element
            ) {

                element.textContent =
                    value;

            }

        }
    );


    return summary;

}


/* ============================================================
   30. ÖRNEK PERSONEL
============================================================ */

function createSampleEmployee() {

    return {

        id:
            "TMS19-001",

        employeeNumber:
            "10001",

        name:
            "Örnek Personel",

        gender:
            "Erkek",

        currentAge:
            40,

        retirementAge:
            60,

        yearsOfService:
            8,

        currentAnnualSalary:
            1000000,

        benefitRate:
            0.03,

        discountRate:
            0.30,

        salaryIncreaseRate:
            0.35,

        inflationRate:
            0.30,

        turnoverRate:
            0.05,

        mortalityRate:
            0,

        disabilityRate:
            0,

        openingDBO:
            0,

        planAssets:
            0,

        benefitPayments:
            0

    };

}


/* ============================================================
   31. TEST
============================================================ */

function testTMS19() {

    const employee =
        createSampleEmployee();


    const result =
        analyzeEmployee(
            employee
        );


    console.group(
        "GK Advisory — TMS 19 V3"
    );


    console.log(
        "Personel:",
        result.employee
    );


    console.log(
        "DBO:",
        formatTRY(
            result.puc.dbo
        )
    );


    console.log(
        "Current Service Cost:",
        formatTRY(
            result.currentServiceCost
        )
    );


    console.log(
        "Net Interest:",
        formatTRY(
            result.netInterest.netInterest
        )
    );


    console.log(
        "Net Liability:",
        formatTRY(
            result.netLiability
        )
    );


    console.log(
        "Sensitivity:",
        result.sensitivity
    );


    console.log(
        "Stress Test:",
        result.stressTest
    );


    console.log(
        "Risk:",
        result.risk
    );


    console.log(
        "CFO Insight:",
        result.cfoInsight
    );


    console.groupEnd();


    return result;

}


/* ============================================================
   32. GLOBAL API
============================================================ */

window.TMS19ActuarialEngine = {

    version:
        TMS19_CONFIG.version,

    standard:
        TMS19_CONFIG.standard,

    methodology:
        TMS19_CONFIG.methodology,

    createEmployee,

    createSampleEmployee,

    remainingService,

    totalService,

    projectedSalary,

    survivalProbability,

    projectedRetirementBenefit,

    calculatePUC,

    calculateCurrentServiceCost,

    calculateInterestCost,

    calculateInterestIncome,

    calculateNetInterest,

    calculateRemeasurement,

    calculateDBORollForward,

    calculateNetLiability,

    calculatePL,

    calculateOCI,

    calculateSensitivity,

    calculateStressTest,

    validateAssumptions,

    calculateRiskScore,

    generateCFOInsight,

    analyzeEmployee,

    analyzePortfolio,

    projectDBO,

    createDashboardSummary,

    updateDashboard,

    formatTRY,

    formatPercent,

    testTMS19

};


/* ============================================================
   33. BAŞLANGIÇ
============================================================ */

console.log(
    "TMS 19 Aktüeryal Motor V3.0.0 hazır."
);

console.log(
    "Metodoloji: Projected Unit Credit"
);

console.log(
    "API: window.TMS19ActuarialEngine"
);
