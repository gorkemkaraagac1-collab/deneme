"use strict";

/*
===========================================================
 GK ADVISORY
 TMS 19 — AKTÜERYAL DEĞERLEME MOTORU
-----------------------------------------------------------
 Yöntem:
 Projected Unit Credit (PUC)

 Kapsam:
 - DBO
 - Cari hizmet maliyeti
 - Faiz maliyeti
 - Fayda ödemeleri
 - Aktüeryal kazanç/kayıplar
 - Maaş projeksiyonu
 - Personel devir olasılığı
 - Emeklilik
 - Ölüm olasılığı
 - P&L / OCI ayrımı
 - Duyarlılık analizi
 - Roll-forward

 Not:
 Bu motor yönetim / ön değerleme ve karar destek
 amacıyla tasarlanmıştır. Resmi aktüeryal raporun
 yerine geçmez.
===========================================================
*/


window.TMS19ActuarialEngine = (function () {

    /* =====================================================
       YARDIMCI FONKSİYONLAR
    ===================================================== */

    function number(value, fallback = 0) {

        const n = Number(value);

        return Number.isFinite(n)
            ? n
            : fallback;
    }


    function clamp(value, min, max) {

        return Math.min(
            Math.max(value, min),
            max
        );

    }


    function round(value, decimals = 2) {

        const factor =
            Math.pow(10, decimals);

        return Math.round(
            value * factor
        ) / factor;

    }


    function presentValue(
        futureValue,
        discountRate,
        years
    ) {

        if (years <= 0) {

            return futureValue;

        }

        return futureValue /
            Math.pow(
                1 + discountRate,
                years
            );

    }


    /* =====================================================
       VARSAYIMLAR
    ===================================================== */

    function normalizeAssumptions(
        assumptions = {}
    ) {

        return {

            discountRate:
                number(
                    assumptions.discountRate,
                    0.30
                ),

            salaryIncreaseRate:
                number(
                    assumptions.salaryIncreaseRate,
                    0.30
                ),

            inflationRate:
                number(
                    assumptions.inflationRate,
                    0.25
                ),

            turnoverRate:
                number(
                    assumptions.turnoverRate,
                    0.05
                ),

            mortalityRate:
                number(
                    assumptions.mortalityRate,
                    0.001
                ),

            retirementAge:
                number(
                    assumptions.retirementAge,
                    60
                ),

            benefitRate:
                number(
                    assumptions.benefitRate,
                    0.03
                ),

            salaryCap:
                number(
                    assumptions.salaryCap,
                    Infinity
                ),

            probabilityMethod:
                assumptions.probabilityMethod ||
                "basit",

            projectionYears:
                number(
                    assumptions.projectionYears,
                    40
                )

        };

    }


    /* =====================================================
       PERSONEL VERİSİNİ NORMALİZE ET
    ===================================================== */

    function normalizeEmployee(
        employee = {}
    ) {

        const age =
            number(
                employee.currentAge ??
                employee.age,
                0
            );

        const service =
            number(
                employee.yearsOfService ??
                employee.serviceYears,
                0
            );

        const salary =
            number(
                employee.currentAnnualSalary ??
                employee.annualSalary ??
                employee.salary,
                0
            );

        const openingDBO =
            number(
                employee.openingDBO ??
                employee.dbo ??
                0,
                0
            );

        const retirementAge =
            number(
                employee.retirementAge,
                60
            );

        return {

            id:
                employee.employeeNumber ??
                employee.id ??
                "",

            name:
                employee.name ??
                employee.employeeName ??
                "Bilinmeyen Personel",

            department:
                employee.department ??
                "",

            gender:
                employee.gender ??
                "",

            age,

            service,

            salary,

            openingDBO,

            retirementAge,

            hireDate:
                employee.hireDate ??
                null

        };

    }


    /* =====================================================
       HİZMET SÜRESİ
    ===================================================== */

    function projectedService(
        employee,
        years
    ) {

        return (
            employee.service +
            years
        );

    }


    /* =====================================================
       PROJEKSİYON MAAŞI
    ===================================================== */

    function projectedSalary(
        currentSalary,
        salaryIncreaseRate,
        years,
        salaryCap
    ) {

        const projected =
            currentSalary *
            Math.pow(
                1 + salaryIncreaseRate,
                years
            );

        return Math.min(
            projected,
            salaryCap
        );

    }


    /* =====================================================
       EMEKLİLİK OLASILIĞI
    ===================================================== */

    function retirementProbability(
        employee,
        year,
        assumptions
    ) {

        const age =
            employee.age + year;

        if (
            age >=
            employee.retirementAge
        ) {

            return 1;

        }

        return 0;

    }


    /* =====================================================
       DEVRİM / İŞTEN AYRILMA OLASILIĞI
    ===================================================== */

    function turnoverProbability(
        employee,
        year,
        assumptions
    ) {

        const baseRate =
            clamp(
                assumptions.turnoverRate,
                0,
                1
            );

        const age =
            employee.age + year;


        /*
        Basit demografik yaklaşım.

        Genç çalışanlarda devir biraz daha yüksek,
        ileri yaşlarda ise daha düşük kabul edilir.
        */

        let adjustment = 1;


        if (age < 30) {

            adjustment = 1.20;

        }
        else if (age < 40) {

            adjustment = 1.00;

        }
        else if (age < 50) {

            adjustment = 0.80;

        }
        else {

            adjustment = 0.60;

        }


        return clamp(
            baseRate *
            adjustment,
            0,
            0.95
        );

    }


    /* =====================================================
       ÖLÜM OLASILIĞI
    ===================================================== */

    function mortalityProbability(
        employee,
        year,
        assumptions
    ) {

        const age =
            employee.age + year;


        let rate =
            assumptions.mortalityRate;


        /*
        Yaş arttıkça ölüm olasılığını
        kademeli şekilde artıran basitleştirilmiş
        aktüeryal yaklaşım.
        */

        if (age >= 60) {

            rate *= 3;

        }

        if (age >= 70) {

            rate *= 5;

        }

        if (age >= 80) {

            rate *= 8;

        }


        return clamp(
            rate,
            0,
            0.95
        );

    }


    /* =====================================================
       HAYATTA KALMA / PLANDA KALMA OLASILIĞI
    ===================================================== */

    function survivalProbability(
        employee,
        year,
        assumptions
    ) {

        if (year <= 0) {

            return 1;

        }


        let probability = 1;


        for (
            let y = 1;
            y <= year;
            y++
        ) {

            const turnover =
                turnoverProbability(
                    employee,
                    y,
                    assumptions
                );

            const mortality =
                mortalityProbability(
                    employee,
                    y,
                    assumptions
                );


            const retirement =
                retirementProbability(
                    employee,
                    y,
                    assumptions
                );


            if (
                retirement >= 1
            ) {

                if (
                    y < year
                ) {

                    return 0;

                }

            }


            probability *=
                (1 - turnover) *
                (1 - mortality);

        }


        return clamp(
            probability,
            0,
            1
        );

    }


    /* =====================================================
       EMEKLİLİKTE BEKLENEN FAYDA
    ===================================================== */

    function projectedBenefit(
        employee,
        year,
        assumptions
    ) {

        const salary =
            projectedSalary(
                employee.salary,
                assumptions.salaryIncreaseRate,
                year,
                assumptions.salaryCap
            );


        const totalService =
            projectedService(
                employee,
                year
            );


        /*
        Basitleştirilmiş kıdem / tanımlanmış fayda
        formülü:

        Son maaş x toplam hizmet x fayda oranı
        */

        return (
            salary *
            totalService *
            assumptions.benefitRate
        );

    }


    /* =====================================================
       PUC — PERSONEL BAZLI DBO
    ===================================================== */

    function calculateEmployee(
        rawEmployee,
        assumptionsInput = {}
    ) {

        const assumptions =
            normalizeAssumptions(
                assumptionsInput
            );


        const employee =
            normalizeEmployee(
                rawEmployee
            );


        const currentAge =
            employee.age;


        const retirementAge =
            employee.retirementAge ||
            assumptions.retirementAge;


        const yearsToRetirement =
            Math.max(
                retirementAge -
                currentAge,
                0
            );


        /*
        Aktüeryal değerleme ufku.
        */

        const projectionYears =
            Math.min(
                yearsToRetirement,
                assumptions.projectionYears
            );


        let dbo = 0;

        let expectedBenefit = 0;

        let serviceCost = 0;

        let expectedPayment = 0;


        const projection = [];


        /* =================================================
           GELECEK DÖNEMLERİ PROJEKTE ET
        ================================================= */

        for (
            let year = 1;
            year <= projectionYears;
            year++
        ) {

            const age =
                currentAge + year;


            const salary =
                projectedSalary(
                    employee.salary,
                    assumptions.salaryIncreaseRate,
                    year,
                    assumptions.salaryCap
                );


            const totalService =
                projectedService(
                    employee,
                    year
                );


            const benefit =
                projectedBenefit(
                    employee,
                    year,
                    assumptions
                );


            const survival =
                survivalProbability(
                    employee,
                    year,
                    assumptions
                );


            const retirement =
                retirementProbability(
                    employee,
                    year,
                    assumptions
                );


            /*
            Beklenen fayda.

            Emeklilik yaşında faydanın gerçekleşmesi
            varsayımı kullanılır.
            */

            let probability =
                survival;


            if (
                retirement >= 1
            ) {

                probability =
                    survival;

            }
            else {

                probability = 0;

            }


            const expected =
                benefit *
                probability;


            const pv =
                presentValue(
                    expected,
                    assumptions.discountRate,
                    year
                );


            /*
            PUC yaklaşımında cari hizmet yılına
            düşen fayda:

            toplam beklenen faydanın
            toplam hizmet süresine oranı.
            */

            const accruedRatio =
                totalService > 0
                    ? employee.service /
                      totalService
                    : 0;


            const accruedPV =
                pv *
                accruedRatio;


            dbo +=
                accruedPV;


            projection.push({

                year,

                age,

                salary:

                    round(
                        salary
                    ),

                service:

                    round(
                        totalService
                    ),

                survival:

                    round(
                        survival,
                        6
                    ),

                retirement:

                    round(
                        retirement,
                        6
                    ),

                expectedBenefit:

                    round(
                        expected,
                        2
                    ),

                presentValue:

                    round(
                        pv,
                        2
                    ),

                accruedPV:

                    round(
                        accruedPV,
                        2
                    )

            });

        }


        /* =================================================
           CARİ HİZMET MALİYETİ
        ================================================= */

        const nextYear =
            projectedBenefit(
                employee,
                1,
                assumptions
            );


        const nextYearSurvival =
            survivalProbability(
                employee,
                1,
                assumptions
            );


        const nextYearPV =
            presentValue(
                nextYear *
                nextYearSurvival,
                assumptions.discountRate,
                1
            );


        serviceCost =
            nextYearPV *
            (
                1 /
                Math.max(
                    employee.service + 1,
                    1
                )
            );


        /* =================================================
           FAİZ MALİYETİ
        ================================================= */

        const interestCost =
            dbo *
            assumptions.discountRate;


        /* =================================================
           BEKLENEN ÖDEME
        ================================================= */

        if (
            projection.length > 0
        ) {

            const last =
                projection[
                    projection.length - 1
                ];


            expectedPayment =
                last.expectedBenefit;

        }


        /* =================================================
           YENİDEN ÖLÇÜM
        ================================================= */

        const expectedClosingDBO =
            dbo +
            serviceCost +
            interestCost -
            expectedPayment;


        const openingDBO =
            employee.openingDBO ||
            dbo;


        const actuarialGainLoss =
            dbo -
            openingDBO;


        return {

            employee,

            openingDBO:

                round(
                    openingDBO
                ),

            dbo:

                round(
                    dbo
                ),

            currentServiceCost:

                round(
                    serviceCost
                ),

            interestCost:

                round(
                    interestCost
                ),

            benefitPayments:

                round(
                    expectedPayment
                ),

            actuarialGainLoss:

                round(
                    actuarialGainLoss
                ),

            expectedClosingDBO:

                round(
                    expectedClosingDBO
                ),

            projection

        };

    }


    /* =====================================================
       PORTFÖY DEĞERLEMESİ
    ===================================================== */

    function calculate(
        employees = [],
        assumptionsInput = {}
    ) {

        const assumptions =
            normalizeAssumptions(
                assumptionsInput
            );


        const results = [];


        for (
            const employee of employees
        ) {

            results.push(
                calculateEmployee(
                    employee,
                    assumptions
                )
            );

        }


        /* =================================================
           TOPLAMLAR
        ================================================= */

        const totals = {

            employees:
                results.length,

            openingDBO: 0,

            dbo: 0,

            currentServiceCost: 0,

            interestCost: 0,

            benefitPayments: 0,

            actuarialGainLoss: 0,

            expectedClosingDBO: 0

        };


        results.forEach(
            result => {

                totals.openingDBO +=
                    result.openingDBO;

                totals.dbo +=
                    result.dbo;

                totals.currentServiceCost +=
                    result.currentServiceCost;

                totals.interestCost +=
                    result.interestCost;

                totals.benefitPayments +=
                    result.benefitPayments;

                totals.actuarialGainLoss +=
                    result.actuarialGainLoss;

                totals.expectedClosingDBO +=
                    result.expectedClosingDBO;

            }
        );


        Object.keys(
            totals
        ).forEach(
            key => {

                if (
                    typeof totals[key] ===
                    "number"
                ) {

                    totals[key] =
                        round(
                            totals[key]
                        );

                }

            }
        );


        /* =================================================
           P&L / OCI
        ================================================= */

        const profitLossEffect =
            totals.currentServiceCost +
            totals.interestCost;


        const ociEffect =
            totals.actuarialGainLoss;


        const netDefinedBenefitCost =
            profitLossEffect +
            ociEffect;


        /* =================================================
           ROLL FORWARD
        ================================================= */

        const rollForward = {

            openingDBO:
                totals.openingDBO,

            currentServiceCost:
                totals.currentServiceCost,

            interestCost:
                totals.interestCost,

            remeasurement:
                totals.actuarialGainLoss,

            benefitPayments:
                -totals.benefitPayments,

            closingDBO:
                totals.expectedClosingDBO

        };


        return {

            assumptions,

            employeeResults:
                results,

            totals,

            profitLossEffect:
                round(
                    profitLossEffect
                ),

            ociEffect:
                round(
                    ociEffect
                ),

            netDefinedBenefitCost:
                round(
                    netDefinedBenefitCost
                ),

            rollForward

        };

    }


    /* =====================================================
       DUYARLILIK ANALİZİ
    ===================================================== */

    function sensitivityAnalysis(
        employees,
        assumptionsInput = {}
    ) {

        const base =
            normalizeAssumptions(
                assumptionsInput
            );


        const scenarios = [];


        const discountRates = [

            base.discountRate - 0.01,

            base.discountRate,

            base.discountRate + 0.01

        ];


        discountRates.forEach(
            rate => {

                const assumptions = {

                    ...base,

                    discountRate:
                        rate

                };


                const result =
                    calculate(
                        employees,
                        assumptions
                    );


                scenarios.push({

                    type:
                        "İskonto Oranı",

                    assumption:
                        rate,

                    dbo:
                        result.totals.dbo,

                    pnl:
                        result.profitLossEffect,

                    oci:
                        result.ociEffect

                });

            }
        );


        const salaryRates = [

            base.salaryIncreaseRate - 0.01,

            base.salaryIncreaseRate,

            base.salaryIncreaseRate + 0.01

        ];


        salaryRates.forEach(
            rate => {

                const assumptions = {

                    ...base,

                    salaryIncreaseRate:
                        rate

                };


                const result =
                    calculate(
                        employees,
                        assumptions
                    );


                scenarios.push({

                    type:
                        "Maaş Artış Oranı",

                    assumption:
                        rate,

                    dbo:
                        result.totals.dbo,

                    pnl:
                        result.profitLossEffect,

                    oci:
                        result.ociEffect

                });

            }
        );


        return scenarios;

    }


    /* =====================================================
       AKTÜERYAL HAZIRLIK KONTROLÜ
    ===================================================== */

    function actuarialReadiness(
        employees = []
    ) {

        if (
            !employees.length
        ) {

            return {

                ready: false,

                score: 0,

                level:
                    "Veri Yok",

                issues: [
                    "Personel verisi bulunmuyor."
                ]

            };

        }


        const issues = [];


        let score = 100;


        employees.forEach(
            (
                employee,
                index
            ) => {

                const e =
                    normalizeEmployee(
                        employee
                    );


                if (
                    e.age <= 0
                ) {

                    score -= 10;

                    issues.push(
                        `${index + 1}. kayıtta yaş eksik.`
                    );

                }


                if (
                    e.salary <= 0
                ) {

                    score -= 10;

                    issues.push(
                        `${index + 1}. kayıtta maaş eksik.`
                    );

                }


                if (
                    e.service < 0
                ) {

                    score -= 10;

                    issues.push(
                        `${index + 1}. kayıtta hizmet süresi hatalı.`
                    );

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
            score >= 95
        ) {

            level =
                "Aktüeryal Değerlemeye Hazır";

        }
        else if (
            score >= 80
        ) {

            level =
                "Küçük Kontroller Gerekli";

        }
        else if (
            score >= 60
        ) {

            level =
                "Önemli Veri Eksikleri Var";

        }
        else {

            level =
                "Aktüeryal Hesaplamaya Hazır Değil";

        }


        return {

            ready:
                score >= 80,

            score,

            level,

            issues

        };

    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    return {

        calculate,

        calculateEmployee,

        sensitivityAnalysis,

        actuarialReadiness,

        normalizeEmployee,

        normalizeAssumptions,

        projectedSalary,

        projectedBenefit,

        survivalProbability,

        turnoverProbability,

        mortalityProbability

    };

})();
