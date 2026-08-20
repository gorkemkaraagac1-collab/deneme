/* ============================================================
   TMS 19 ACTUARIAL ENGINE V2
   GK Advisory | Financial Decision Cockpit

   TMS 19 - Çalışanlara Sağlanan Faydalar

   Ana metodoloji:
   Projected Unit Credit Method (PUC)

   Modüller:
   1. Personel verisi
   2. Aktüeryal varsayımlar
   3. Maaş projeksiyonu
   4. Fayda projeksiyonu
   5. Hizmet dönemlerine dağıtım
   6. DBO
   7. Current Service Cost
   8. Interest Cost
   9. Benefit Payments
   10. Actuarial Gain / Loss
   11. P&L / OCI
   12. Sensitivity
   13. Stress Test
   14. CFO Risk Analysis
   ============================================================ */

"use strict";


/* ============================================================
   1. MOTOR KONFİGÜRASYONU
   ============================================================ */

const TMS19_ENGINE = {

    version: "2.0.0",

    standard: "TMS 19",

    methodology: "Projected Unit Credit Method",

    currency: "TRY",

    defaultAssumptions: {

        discountRate: 0.30,

        salaryIncreaseRate: 0.35,

        inflationRate: 0.30,

        turnoverRate: 0.05,

        retirementAge: 60,

        mortalityRate: 0.00,

        disabilityRate: 0.00,

        benefitRate: 0.03,

        salaryCap: 0,

        expectedReturnOnPlanAssets: 0.00
    },

    sensitivity: {

        discountRate: 0.01,

        salaryIncreaseRate: 0.01,

        turnoverRate: 0.01
    }
};


/* ============================================================
   2. MATEMATİKSEL YARDIMCILAR
   ============================================================ */

function numberValue(value, fallback = 0) {

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

    const cleaned = String(value)
        .replace(/\s/g, "")
        .replace(/\./g, "")
        .replace(",", ".")
        .replace("%", "");

    const result = parseFloat(cleaned);

    return Number.isFinite(result)
        ? result
        : fallback;
}


function round(value, decimals = 2) {

    const multiplier =
        Math.pow(10, decimals);

    return Math.round(
        (value + Number.EPSILON) *
        multiplier
    ) / multiplier;
}


function clamp(value, min, max) {

    return Math.min(
        Math.max(value, min),
        max
    );
}


function presentValue(
    futureValue,
    discountRate,
    years
) {

    if (
        futureValue <= 0 ||
        years < 0
    ) {
        return 0;
    }

    return futureValue /
        Math.pow(
            1 + discountRate,
            years
        );
}


/* ============================================================
   3. PERSONEL MODELİ
   ============================================================ */

function createEmployee(data = {}) {

    const assumptions =
        TMS19_ENGINE.defaultAssumptions;

    const currentAge =
        numberValue(
            data.currentAge,
            35
        );

    const retirementAge =
        numberValue(
            data.retirementAge,
            assumptions.retirementAge
        );

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

        currentAge,

        retirementAge,

        yearsOfService:
            numberValue(
                data.yearsOfService,
                10
            ),

        currentAnnualSalary:
            numberValue(
                data.currentAnnualSalary,
                600000
            ),

        benefitRate:
            numberValue(
                data.benefitRate,
                assumptions.benefitRate
            ),

        discountRate:
            numberValue(
                data.discountRate,
                assumptions.discountRate
            ),

        salaryIncreaseRate:
            numberValue(
                data.salaryIncreaseRate,
                assumptions.salaryIncreaseRate
            ),

        inflationRate:
            numberValue(
                data.inflationRate,
                assumptions.inflationRate
            ),

        turnoverRate:
            numberValue(
                data.turnoverRate,
                assumptions.turnoverRate
            ),

        mortalityRate:
            numberValue(
                data.mortalityRate,
                assumptions.mortalityRate
            ),

        disabilityRate:
            numberValue(
                data.disabilityRate,
                assumptions.disabilityRate
            ),

        salaryCap:
            numberValue(
                data.salaryCap,
                assumptions.salaryCap
            )
    };
}


/* ============================================================
   4. KALAN HİZMET SÜRESİ
   ============================================================ */

function calculateRemainingService(employee) {

    return Math.max(
        employee.retirementAge -
        employee.currentAge,
        0
    );
}


/* ============================================================
   5. GELECEK MAAŞ
   ============================================================ */

function calculateProjectedSalary(
    employee,
    years
) {

    let salary =
        employee.currentAnnualSalary *
        Math.pow(
            1 + employee.salaryIncreaseRate,
            years
        );

    if (
        employee.salaryCap > 0
    ) {

        salary =
            Math.min(
                salary,
                employee.salaryCap
            );
    }

    return salary;
}


/* ============================================================
   6. KALMA OLASILIĞI
   ============================================================ */

function calculateSurvivalProbability(
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
   7. TOPLAM EMEKLİLİK FAYDASI
   ============================================================ */

function calculateProjectedBenefit(
    employee
) {

    const remainingService =
        calculateRemainingService(
            employee
        );

    const totalService =
        employee.yearsOfService +
        remainingService;

    const finalSalary =
        calculateProjectedSalary(
            employee,
            remainingService
        );

    const projectedBenefit =
        finalSalary *
        employee.benefitRate *
        totalService;

    return {

        remainingService,

        totalService,

        finalSalary,

        projectedBenefit
    };
}


/* ============================================================
   8. PUC – HİZMET YILI BAZLI FAYDA TAHSİSİ
   ============================================================ */

function calculatePUC(
    employee
) {

    const remainingService =
        calculateRemainingService(
            employee
        );

    const totalService =
        employee.yearsOfService +
        remainingService;

    const rows = [];

    let dbo = 0;

    /*
       PUC yaklaşımında toplam beklenen fayda,
       hizmet dönemlerine dağıtılır.

       Her gelecek hizmet yılı için:

       1. Gelecek maaş
       2. Toplam beklenen fayda
       3. İlgili hizmet birimi
       4. Kalma olasılığı
       5. İskonto
       6. Bugünkü değer
    */

    for (
        let year = 1;
        year <= remainingService;
        year++
    ) {

        const salary =
            calculateProjectedSalary(
                employee,
                year
            );

        const serviceAtYear =
            employee.yearsOfService +
            year;

        const totalProjectedBenefit =
            salary *
            employee.benefitRate *
            serviceAtYear;

        const benefitAttributedToCurrentPeriod =
            salary *
            employee.benefitRate;

        const survival =
            calculateSurvivalProbability(
                employee,
                year
            );

        const expectedBenefit =
            benefitAttributedToCurrentPeriod *
            survival;

        const discountedBenefit =
            presentValue(
                expectedBenefit,
                employee.discountRate,
                year
            );

        dbo += discountedBenefit;

        rows.push({

            year,

            age:
                employee.currentAge +
                year,

            salary,

            serviceAtYear,

            totalProjectedBenefit,

            benefitAttributed:
                benefitAttributedToCurrentPeriod,

            survivalProbability:
                survival,

            expectedBenefit,

            discountedBenefit
        });
    }

    return {

        rows,

        dbo,

        totalService,

        remainingService
    };
}


/* ============================================================
   9. CURRENT SERVICE COST
   ============================================================ */

function calculateCurrentServiceCost(
    employee
) {

    const nextYearSalary =
        calculateProjectedSalary(
            employee,
            1
        );

    const nextYearBenefit =
        nextYearSalary *
        employee.benefitRate;

    const survival =
        calculateSurvivalProbability(
            employee,
            1
        );

    const expectedBenefit =
        nextYearBenefit *
        survival;

    const serviceCost =
        presentValue(
            expectedBenefit,
            employee.discountRate,
            1
        );

    return serviceCost;
}


/* ============================================================
   10. INTEREST COST
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
   11. BENEFIT PAYMENT
   ============================================================ */

function calculateExpectedBenefitPayment(
    employee,
    projectedBenefit
) {

    const remainingService =
        calculateRemainingService(
            employee
        );

    if (
        remainingService <= 0
    ) {
        return projectedBenefit;
    }

    /*
       Basitleştirilmiş nakit akış yaklaşımı.
       Daha ileri versiyonda ödeme zamanlaması
       ayrı bir demografik ödeme eğrisi ile
       modellenebilir.
    */

    const probability =
        calculateSurvivalProbability(
            employee,
            remainingService
        );

    return (
        projectedBenefit *
        probability
    );
}


/* ============================================================
   12. AKTÜERYAL KAZANÇ / KAYIP
   ============================================================ */

function calculateActuarialGainLoss(
    expectedDBO,
    actualDBO
) {

    return (
        actualDBO -
        expectedDBO
    );
}


/* ============================================================
   13. NET TANIMLANMIŞ FAYDA YÜKÜMLÜLÜĞÜ
   ============================================================ */

function calculateNetDefinedBenefitLiability(
    dbo,
    planAssets = 0
) {

    return (
        dbo -
        planAssets
    );
}


/* ============================================================
   14. NET FAİZ
   ============================================================ */

function calculateNetInterest(
    openingDBO,
    openingPlanAssets,
    discountRate
) {

    const interestCost =
        openingDBO *
        discountRate;

    const interestIncome =
        openingPlanAssets *
        discountRate;

    return {

        interestCost,

        interestIncome,

        netInterest:
            interestCost -
            interestIncome
    };
}


/* ============================================================
   15. P&L
   ============================================================ */

function calculateProfitLossEffect({

    currentServiceCost = 0,

    pastServiceCost = 0,

    settlementEffect = 0,

    netInterest = 0

} = {}) {

    return (
        currentServiceCost +
        pastServiceCost +
        settlementEffect +
        netInterest
    );
}


/* ============================================================
   16. OCI
   ============================================================ */

function calculateOCIEffect({

    actuarialGainLoss = 0,

    assetCeilingEffect = 0

} = {}) {

    return (
        actuarialGainLoss +
        assetCeilingEffect
    );
}


/* ============================================================
   17. DBO MUTABAKAT TABLOSU
   ============================================================ */

function calculateDBORollForward({

    openingDBO = 0,

    currentServiceCost = 0,

    interestCost = 0,

    actuarialGainLoss = 0,

    benefitPayments = 0,

    pastServiceCost = 0

} = {}) {

    const closingDBO =

        openingDBO +

        currentServiceCost +

        interestCost +

        actuarialGainLoss +

        pastServiceCost -

        benefitPayments;


    return {

        openingDBO,

        currentServiceCost,

        interestCost,

        actuarialGainLoss,

        pastServiceCost,

        benefitPayments,

        closingDBO
    };
}


/* ============================================================
   18. SENSITIVITY ANALİZİ
   ============================================================ */

function calculateSensitivity(
    employeeData
) {

    const baseEmployee =
        createEmployee(
            employeeData
        );

    const basePUC =
        calculatePUC(
            baseEmployee
        );

    const baseDBO =
        basePUC.dbo;


    /*
       İskonto -100 bps
    */

    const discountDown =
        createEmployee({

            ...employeeData,

            discountRate:
                baseEmployee.discountRate -
                TMS19_ENGINE.sensitivity.discountRate
        });


    /*
       İskonto +100 bps
    */

    const discountUp =
        createEmployee({

            ...employeeData,

            discountRate:
                baseEmployee.discountRate +
                TMS19_ENGINE.sensitivity.discountRate
        });


    /*
       Maaş artışı -100 bps
    */

    const salaryDown =
        createEmployee({

            ...employeeData,

            salaryIncreaseRate:
                baseEmployee.salaryIncreaseRate -
                TMS19_ENGINE.sensitivity.salaryIncreaseRate
        });


    /*
       Maaş artışı +100 bps
    */

    const salaryUp =
        createEmployee({

            ...employeeData,

            salaryIncreaseRate:
                baseEmployee.salaryIncreaseRate +
                TMS19_ENGINE.sensitivity.salaryIncreaseRate
        });


    /*
       Turnover -100 bps
    */

    const turnoverDown =
        createEmployee({

            ...employeeData,

            turnoverRate:
                Math.max(
                    0,
                    baseEmployee.turnoverRate -
                    TMS19_ENGINE.sensitivity.turnoverRate
                )
        });


    /*
       Turnover +100 bps
    */

    const turnoverUp =
        createEmployee({

            ...employeeData,

            turnoverRate:
                baseEmployee.turnoverRate +
                TMS19_ENGINE.sensitivity.turnoverRate
        });


    const calculate =
        employee =>
            calculatePUC(
                employee
            ).dbo;


    return {

        base: baseDBO,

        discountRate: {

            minus100bps:
                calculate(discountDown),

            base:
                baseDBO,

            plus100bps:
                calculate(discountUp)
        },

        salaryIncreaseRate: {

            minus100bps:
                calculate(salaryDown),

            base:
                baseDBO,

            plus100bps:
                calculate(salaryUp)
        },

        turnoverRate: {

            minus100bps:
                calculate(turnoverDown),

            base:
                baseDBO,

            plus100bps:
                calculate(turnoverUp)
        }
    };
}


/* ============================================================
   19. SENARYO ANALİZİ
   ============================================================ */

function calculateScenarioAnalysis(
    employeeData
) {

    const scenarios = {

        base: {

            discountRate: 0,

            salaryIncreaseRate: 0,

            turnoverRate: 0
        },

        optimistic: {

            discountRate: +0.01,

            salaryIncreaseRate: -0.01,

            turnoverRate: +0.01
        },

        pessimistic: {

            discountRate: -0.01,

            salaryIncreaseRate: +0.01,

            turnoverRate: -0.01
        },

        stress: {

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
                        employeeData.discountRate +
                        scenario.discountRate,

                    salaryIncreaseRate:
                        employeeData.salaryIncreaseRate +
                        scenario.salaryIncreaseRate,

                    turnoverRate:
                        Math.max(
                            0,
                            employeeData.turnoverRate +
                            scenario.turnoverRate
                        )
                });


            const puc =
                calculatePUC(
                    employee
                );


            result[name] = {

                dbo:
                    puc.dbo,

                difference:
                    puc.dbo -
                    calculatePUC(
                        createEmployee(
                            employeeData
                        )
                    ).dbo,

                assumptions: {

                    discountRate:
                        employee.discountRate,

                    salaryIncreaseRate:
                        employee.salaryIncreaseRate,

                    turnoverRate:
                        employee.turnoverRate
                }
            };
        }
    );


    return result;
}


/* ============================================================
   20. VARSAYIM KONTROLLERİ
   ============================================================ */

function validateAssumptions(
    employee
) {

    const warnings = [];


    if (
        employee.discountRate < 0
    ) {

        warnings.push({

            level: "Kritik",

            title:
                "Negatif iskonto oranı",

            message:
                "İskonto oranı sıfırın altında olamaz."
        });
    }


    if (
        employee.salaryIncreaseRate >
        0.50
    ) {

        warnings.push({

            level: "Yüksek",

            title:
                "Yüksek maaş artış varsayımı",

            message:
                "Maaş artış varsayımı %50'nin üzerinde."
        });
    }


    if (
        employee.turnoverRate >
        0.20
    ) {

        warnings.push({

            level: "Yüksek",

            title:
                "Yüksek personel devir oranı",

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

            title:
                "Emeklilik yaşı hatası",

            message:
                "Emeklilik yaşı mevcut yaştan büyük olmalıdır."
        });
    }


    if (
        employee.yearsOfService < 0
    ) {

        warnings.push({

            level: "Kritik",

            title:
                "Hizmet süresi hatası",

            message:
                "Hizmet süresi negatif olamaz."
        });
    }


    return warnings;
}


/* ============================================================
   21. AKTÜERYAL RİSK SKORU
   ============================================================ */

function calculateRiskScore(
    employee
) {

    const warnings =
        validateAssumptions(
            employee
        );


    let score = 0;


    warnings.forEach(
        warning => {

            switch (
                warning.level
            ) {

                case "Kritik":

                    score += 40;

                    break;

                case "Yüksek":

                    score += 25;

                    break;

                case "Orta":

                    score += 15;

                    break;

                default:

                    score += 5;
            }
        }
    );


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
   22. CFO YÖNETİM ANALİZİ
   ============================================================ */

function generateCFOInsight(
    analysis
) {

    const dbo =
        analysis.puc.dbo;

    const csc =
        analysis.currentServiceCost;

    const sensitivity =
        analysis.sensitivity;


    const discountBase =
        sensitivity.discountRate.base;

    const discountLow =
        sensitivity.discountRate.minus100bps;


    const discountImpact =
        discountLow -
        discountBase;


    const salaryBase =
        sensitivity.salaryIncreaseRate.base;

    const salaryHigh =
        sensitivity.salaryIncreaseRate.plus100bps;


    const salaryImpact =
        salaryHigh -
        salaryBase;


    let priority =
        "Düşük";


    if (
        Math.abs(discountImpact) >
        dbo * 0.10 ||
        Math.abs(salaryImpact) >
        dbo * 0.10
    ) {

        priority = "Yüksek";

    } else if (
        Math.abs(discountImpact) >
        dbo * 0.05 ||
        Math.abs(salaryImpact) >
        dbo * 0.05
    ) {

        priority = "Orta";
    }


    return {

        priority,

        dbo,

        currentServiceCost: csc,

        discountSensitivity:
            discountImpact,

        salarySensitivity:
            salaryImpact,

        message:

            priority === "Yüksek"

                ?

                "TMS 19 yükümlülüğü finansal varsayımlara yüksek duyarlılık göstermektedir. CFO seviyesinde iskonto oranı ve ücret artış varsayımlarının bağımsız aktüeryal kanıtlarla desteklenmesi ve bütçe/forecast modelleriyle tutarlılığının test edilmesi önerilir."

                :

                priority === "Orta"

                    ?

                    "Aktüeryal varsayımların DBO üzerinde anlamlı ancak yönetilebilir etkisi bulunmaktadır. Varsayımların dönemsel olarak yeniden değerlendirilmesi önerilir."

                    :

                    "Aktüeryal varsayımlar mevcut model kapsamında DBO üzerinde sınırlı duyarlılık yaratmaktadır."
    };
}


/* ============================================================
   23. TAM PERSONEL ANALİZİ
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


    const projectedBenefit =
        calculateProjectedBenefit(
            employee
        );


    const sensitivity =
        calculateSensitivity(
            employee
        );


    const scenarios =
        calculateScenarioAnalysis(
            employee
        );


    const risk =
        calculateRiskScore(
            employee
        );


    const preliminaryAnalysis = {

        employee,

        puc,

        projectedBenefit,

        currentServiceCost,

        sensitivity,

        scenarios,

        risk
    };


    const cfoInsight =
        generateCFOInsight(
            preliminaryAnalysis
        );


    return {

        ...preliminaryAnalysis,

        cfoInsight
    };
}


/* ============================================================
   24. PORTFÖY ANALİZİ
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
            (sum, analysis) =>
                sum +
                analysis.puc.dbo,
            0
        );


    const totalCurrentServiceCost =
        analyses.reduce(
            (sum, analysis) =>
                sum +
                analysis.currentServiceCost,
            0
        );


    const totalProjectedBenefit =
        analyses.reduce(
            (sum, analysis) =>
                sum +
                analysis.projectedBenefit.projectedBenefit,
            0
        );


    const averageDiscountRate =
        analyses.length === 0

            ? 0

            :

            analyses.reduce(
                (sum, analysis) =>
                    sum +
                    analysis.employee.discountRate,
                0
            ) /
            analyses.length;


    const highRiskEmployees =
        analyses.filter(
            analysis =>
                analysis.risk.level === "Yüksek" ||
                analysis.risk.level === "Kritik"
        );


    return {

        employeeCount:
            employees.length,

        totalDBO,

        totalCurrentServiceCost,

        totalProjectedBenefit,

        averageDiscountRate,

        highRiskEmployeeCount:
            highRiskEmployees.length,

        analyses
    };
}


/* ============================================================
   25. DBO BRIDGE
   ============================================================ */

function createDBOBridge({

    openingDBO = 0,

    currentServiceCost = 0,

    interestCost = 0,

    actuarialGainLoss = 0,

    pastServiceCost = 0,

    benefitPayments = 0

} = {}) {

    const closingDBO =

        openingDBO +

        currentServiceCost +

        interestCost +

        actuarialGainLoss +

        pastServiceCost -

        benefitPayments;


    return {

        openingDBO,

        currentServiceCost,

        interestCost,

        actuarialGainLoss,

        pastServiceCost,

        benefitPayments,

        closingDBO
    };
}


/* ============================================================
   26. YILLIK PROJEKSİYON
   ============================================================ */

function projectDBO(
    employeeData,
    years = 10
) {

    const employee =
        createEmployee(
            employeeData
        );


    const projection = [];


    let openingDBO =
        calculatePUC(
            employee
        ).dbo;


    for (
        let year = 1;
        year <= years;
        year++
    ) {

        const salary =
            calculateProjectedSalary(
                employee,
                year
            );


        const currentServiceCost =
            calculateCurrentServiceCost(
                employee
            );


        const interestCost =
            calculateInterestCost(
                openingDBO,
                employee.discountRate
            );


        const closingDBO =

            openingDBO +

            currentServiceCost +

            interestCost;


        projection.push({

            year,

            age:
                employee.currentAge +
                year,

            projectedSalary:
                salary,

            openingDBO,

            currentServiceCost,

            interestCost,

            closingDBO
        });


        openingDBO =
            closingDBO;
    }


    return projection;
}


/* ============================================================
   27. FORMATLAMA
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
        numberValue(value)
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
        numberValue(value)
    );
}


/* ============================================================
   28. DASHBOARD ÖZETİ
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

        projectedBenefit:
            analysis.projectedBenefit.projectedBenefit,

        finalSalary:
            analysis.projectedBenefit.finalSalary,

        remainingService:
            analysis.projectedBenefit.remainingService,

        riskScore:
            analysis.risk.score,

        riskLevel:
            analysis.risk.level,

        discountSensitivity:
            analysis.cfoInsight.discountSensitivity,

        salarySensitivity:
            analysis.cfoInsight.salarySensitivity,

        cfoPriority:
            analysis.cfoInsight.priority
    };
}


/* ============================================================
   29. HTML DASHBOARD BAĞLANTISI
   ============================================================ */

function updateDashboard(
    employeeData
) {

    const summary =
        createDashboardSummary(
            employeeData
        );


    const mapping = {

        "dbo":
            formatTRY(
                summary.dbo
            ),

        "current-service-cost":
            formatTRY(
                summary.currentServiceCost
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

        "discount-sensitivity":
            formatTRY(
                summary.discountSensitivity
            ),

        "salary-sensitivity":
            formatTRY(
                summary.salarySensitivity
            ),

        "cfo-priority":
            summary.cfoPriority
    };


    Object.entries(
        mapping
    ).forEach(
        ([key, value]) => {

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
   30. GLOBAL API
   ============================================================ */

window.TMS19ActuarialEngine = {

    version:
        TMS19_ENGINE.version,

    standard:
        TMS19_ENGINE.standard,

    methodology:
        TMS19_ENGINE.methodology,

    createEmployee,

    calculateRemainingService,

    calculateProjectedSalary,

    calculateSurvivalProbability,

    calculateProjectedBenefit,

    calculatePUC,

    calculateCurrentServiceCost,

    calculateInterestCost,

    calculateExpectedBenefitPayment,

    calculateActuarialGainLoss,

    calculateNetDefinedBenefitLiability,

    calculateNetInterest,

    calculateProfitLossEffect,

    calculateOCIEffect,

    calculateDBORollForward,

    calculateSensitivity,

    calculateScenarioAnalysis,

    validateAssumptions,

    calculateRiskScore,

    generateCFOInsight,

    analyzeEmployee,

    analyzePortfolio,

    createDBOBridge,

    projectDBO,

    createDashboardSummary,

    updateDashboard,

    formatTRY,

    formatPercent
};


/* ============================================================
   31. TEST VERİSİ
   ============================================================ */

function testTMS19Engine() {

    const employee = {

        id:
            "TEST-001",

        name:
            "Örnek Personel",

        currentAge:
            35,

        retirementAge:
            60,

        yearsOfService:
            10,

        currentAnnualSalary:
            600000,

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
            0
    };


    const result =
        analyzeEmployee(
            employee
        );


    console.group(
        "TMS 19 ACTUARIAL ENGINE V2"
    );


    console.log(
        "PUC / DBO:",
        result.puc.dbo
    );


    console.log(
        "Current Service Cost:",
        result.currentServiceCost
    );


    console.log(
        "Projected Benefit:",
        result.projectedBenefit
    );


    console.log(
        "Sensitivity:",
        result.sensitivity
    );


    console.log(
        "Scenarios:",
        result.scenarios
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
   32. MOTOR BAŞLAT
   ============================================================ */

console.log(
    "TMS 19 Aktüeryal Motor V2 hazır."
);

console.log(
    "Metodoloji: Projected Unit Credit Method"
);

console.log(
    "API: window.TMS19ActuarialEngine"
);
