"use strict";

/*
===========================================================
 GK ADVISORY
 TMS 19 — PORTFÖY / YÖNETİM ANALİZ MOTORU
-----------------------------------------------------------
 Amaç:
 Personel bazlı aktüeryal sonuçları yönetim seviyesinde
 anlamlandırmak ve TMS 19 dashboard'una aktarmak.

 Katman:
 Employee Data
      ↓
 Actuarial Engine
      ↓
 Portfolio Engine
      ↓
 CFO / Finance Dashboard

 Ana çıktılar:
 - DBO toplamı
 - P&L maliyeti
 - OCI / yeniden ölçüm
 - DBO roll-forward
 - Personel yoğunlaşması
 - Yaş analizi
 - Hizmet süresi analizi
 - Departman analizi
 - Risk skoru
 - Veri kalitesi
 - Duyarlılık analizi
===========================================================
*/


window.TMS19PortfolioEngine = (function () {


    /* =====================================================
       YARDIMCI FONKSİYONLAR
    ===================================================== */

    function number(value, fallback = 0) {

        const n = Number(value);

        return Number.isFinite(n)
            ? n
            : fallback;

    }


    function round(value, decimals = 2) {

        const factor =
            Math.pow(10, decimals);

        return Math.round(
            value * factor
        ) / factor;

    }


    function percentage(value) {

        return round(
            value * 100,
            2
        );

    }


    function average(values) {

        if (!values.length) {

            return 0;

        }

        return values.reduce(
            (a, b) => a + b,
            0
        ) / values.length;

    }


    function min(values) {

        if (!values.length) {

            return 0;

        }

        return Math.min(...values);

    }


    function max(values) {

        if (!values.length) {

            return 0;

        }

        return Math.max(...values);

    }


    /* =====================================================
       PERSONEL NORMALİZASYONU
    ===================================================== */

    function normalizeEmployee(employee) {

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
                "Belirtilmemiş",

            age:
                number(
                    employee.currentAge ??
                    employee.age
                ),

            service:
                number(
                    employee.yearsOfService ??
                    employee.serviceYears
                ),

            salary:
                number(
                    employee.currentAnnualSalary ??
                    employee.annualSalary ??
                    employee.salary
                )

        };

    }


    /* =====================================================
       PERSONEL PORTFÖY ÖZETİ
    ===================================================== */

    function employeeSummary(
        employees,
        actuarialResults
    ) {

        const rows = [];


        for (
            let i = 0;
            i < employees.length;
            i++
        ) {

            const employee =
                normalizeEmployee(
                    employees[i]
                );


            const actuarial =
                actuarialResults[i] ||
                {};


            rows.push({

                id:
                    employee.id,

                name:
                    employee.name,

                department:
                    employee.department,

                age:
                    employee.age,

                service:
                    employee.service,

                salary:
                    round(
                        employee.salary
                    ),

                dbo:
                    round(
                        number(
                            actuarial.dbo
                        )
                    ),

                currentServiceCost:
                    round(
                        number(
                            actuarial.currentServiceCost
                        )
                    ),

                interestCost:
                    round(
                        number(
                            actuarial.interestCost
                        )
                    ),

                actuarialGainLoss:
                    round(
                        number(
                            actuarial.actuarialGainLoss
                        )
                    ),

                benefitPayments:
                    round(
                        number(
                            actuarial.benefitPayments
                        )
                    )

            });

        }


        return rows;

    }


    /* =====================================================
       DBO YOĞUNLAŞMASI
    ===================================================== */

    function dboConcentration(
        rows
    ) {

        if (!rows.length) {

            return {

                top5Share: 0,

                top10Share: 0,

                highestEmployee: null,

                concentrationRisk:
                    "Veri Yok"

            };

        }


        const sorted =
            [...rows].sort(
                (a, b) =>
                    b.dbo - a.dbo
            );


        const total =
            rows.reduce(
                (sum, row) =>
                    sum + row.dbo,
                0
            );


        const top5 =
            sorted
                .slice(0, 5)
                .reduce(
                    (sum, row) =>
                        sum + row.dbo,
                    0
                );


        const top10 =
            sorted
                .slice(0, 10)
                .reduce(
                    (sum, row) =>
                        sum + row.dbo,
                    0
                );


        const top5Share =
            total > 0
                ? top5 / total
                : 0;


        const top10Share =
            total > 0
                ? top10 / total
                : 0;


        let risk =
            "Düşük";


        if (
            top5Share >= 0.50
        ) {

            risk =
                "Yüksek";

        }
        else if (
            top5Share >= 0.30
        ) {

            risk =
                "Orta";

        }


        return {

            top5Share:
                percentage(
                    top5Share
                ),

            top10Share:
                percentage(
                    top10Share
                ),

            highestEmployee:
                sorted[0] || null,

            concentrationRisk:
                risk

        };

    }


    /* =====================================================
       YAŞ ANALİZİ
    ===================================================== */

    function ageAnalysis(
        employees
    ) {

        const ages =
            employees
                .map(
                    employee =>
                        normalizeEmployee(
                            employee
                        ).age
                )
                .filter(
                    age => age > 0
                );


        const bands = {

            "30 Yaş Altı": 0,

            "30-39": 0,

            "40-49": 0,

            "50-59": 0,

            "60+": 0

        };


        ages.forEach(
            age => {

                if (
                    age < 30
                ) {

                    bands["30 Yaş Altı"]++;

                }
                else if (
                    age < 40
                ) {

                    bands["30-39"]++;

                }
                else if (
                    age < 50
                ) {

                    bands["40-49"]++;

                }
                else if (
                    age < 60
                ) {

                    bands["50-59"]++;

                }
                else {

                    bands["60+"]++;

                }

            }
        );


        return {

            employeeCount:
                ages.length,

            averageAge:
                round(
                    average(
                        ages
                    ),
                    1
                ),

            minimumAge:
                min(ages),

            maximumAge:
                max(ages),

            bands

        };

    }


    /* =====================================================
       HİZMET SÜRESİ ANALİZİ
    ===================================================== */

    function serviceAnalysis(
        employees
    ) {

        const services =
            employees
                .map(
                    employee =>
                        normalizeEmployee(
                            employee
                        ).service
                )
                .filter(
                    service =>
                        service >= 0
                );


        const bands = {

            "0-2 Yıl": 0,

            "3-5 Yıl": 0,

            "6-10 Yıl": 0,

            "11-15 Yıl": 0,

            "15+ Yıl": 0

        };


        services.forEach(
            service => {

                if (
                    service <= 2
                ) {

                    bands["0-2 Yıl"]++;

                }
                else if (
                    service <= 5
                ) {

                    bands["3-5 Yıl"]++;

                }
                else if (
                    service <= 10
                ) {

                    bands["6-10 Yıl"]++;

                }
                else if (
                    service <= 15
                ) {

                    bands["11-15 Yıl"]++;

                }
                else {

                    bands["15+ Yıl"]++;

                }

            }
        );


        return {

            averageService:
                round(
                    average(
                        services
                    ),
                    1
                ),

            minimumService:
                min(services),

            maximumService:
                max(services),

            bands

        };

    }


    /* =====================================================
       DEPARTMAN ANALİZİ
    ===================================================== */

    function departmentAnalysis(
        rows
    ) {

        const departments = {};


        rows.forEach(
            row => {

                const department =
                    row.department ||
                    "Belirtilmemiş";


                if (
                    !departments[
                        department
                    ]
                ) {

                    departments[
                        department
                    ] = {

                        department,

                        employeeCount: 0,

                        dbo: 0,

                        salary: 0,

                        currentServiceCost: 0,

                        interestCost: 0,

                        actuarialGainLoss: 0

                    };

                }


                const item =
                    departments[
                        department
                    ];


                item.employeeCount++;

                item.dbo +=
                    row.dbo;

                item.salary +=
                    row.salary;

                item.currentServiceCost +=
                    row.currentServiceCost;

                item.interestCost +=
                    row.interestCost;

                item.actuarialGainLoss +=
                    row.actuarialGainLoss;

            }
        );


        const result =
            Object.values(
                departments
            );


        result.forEach(
            item => {

                item.dbo =
                    round(
                        item.dbo
                    );

                item.salary =
                    round(
                        item.salary
                    );

                item.currentServiceCost =
                    round(
                        item.currentServiceCost
                    );

                item.interestCost =
                    round(
                        item.interestCost
                    );

                item.actuarialGainLoss =
                    round(
                        item.actuarialGainLoss
                    );

            }
        );


        result.sort(
            (a, b) =>
                b.dbo - a.dbo
        );


        return result;

    }


    /* =====================================================
       EMEKLİLİK RİSKİ
    ===================================================== */

    function retirementRisk(
        employees
    ) {

        let high = 0;

        let medium = 0;

        let low = 0;


        employees.forEach(
            employee => {

                const e =
                    normalizeEmployee(
                        employee
                    );


                const years =
                    60 - e.age;


                if (
                    years <= 2
                ) {

                    high++;

                }
                else if (
                    years <= 5
                ) {

                    medium++;

                }
                else {

                    low++;

                }

            }
        );


        const total =
            employees.length || 1;


        return {

            high,

            medium,

            low,

            highShare:
                percentage(
                    high / total
                ),

            mediumShare:
                percentage(
                    medium / total
                ),

            lowShare:
                percentage(
                    low / total
                )

        };

    }


    /* =====================================================
       P&L / OCI ANALİZİ
    ===================================================== */

    function pnlOciAnalysis(
        totals
    ) {

        const serviceCost =
            number(
                totals.currentServiceCost
            );


        const interestCost =
            number(
                totals.interestCost
            );


        const actuarialGainLoss =
            number(
                totals.actuarialGainLoss
            );


        const benefitPayments =
            number(
                totals.benefitPayments
            );


        const pnl =
            serviceCost +
            interestCost;


        const oci =
            actuarialGainLoss;


        const total =
            pnl + oci;


        return {

            serviceCost:
                round(
                    serviceCost
                ),

            interestCost:
                round(
                    interestCost
                ),

            pnl:
                round(
                    pnl
                ),

            oci:
                round(
                    oci
                ),

            benefitPayments:
                round(
                    benefitPayments
                ),

            total:
                round(
                    total
                )

        };

    }


    /* =====================================================
       RİSK SKORU
    ===================================================== */

    function riskScore(
        employees,
        rows,
        concentration,
        retirement
    ) {

        let score = 0;


        /*
        1. Yaş riski
        */

        if (
            retirement.highShare >= 30
        ) {

            score += 30;

        }
        else if (
            retirement.highShare >= 15
        ) {

            score += 20;

        }
        else {

            score += 10;

        }


        /*
        2. DBO yoğunlaşması
        */

        if (
            concentration.top5Share >= 50
        ) {

            score += 30;

        }
        else if (
            concentration.top5Share >= 30
        ) {

            score += 20;

        }
        else {

            score += 10;

        }


        /*
        3. Personel büyüklüğü
        */

        if (
            employees.length < 10
        ) {

            score += 20;

        }
        else if (
            employees.length < 50
        ) {

            score += 10;

        }
        else {

            score += 5;

        }


        /*
        4. DBO / maaş oranı
        */

        const totalDBO =
            rows.reduce(
                (sum, row) =>
                    sum + row.dbo,
                0
            );


        const totalSalary =
            rows.reduce(
                (sum, row) =>
                    sum + row.salary,
                0
            );


        const ratio =
            totalSalary > 0
                ? totalDBO /
                  totalSalary
                : 0;


        if (
            ratio >= 2
        ) {

            score += 20;

        }
        else if (
            ratio >= 1
        ) {

            score += 10;

        }
        else {

            score += 5;

        }


        score =
            Math.min(
                score,
                100
            );


        let level;


        if (
            score >= 75
        ) {

            level =
                "Yüksek";

        }
        else if (
            score >= 50
        ) {

            level =
                "Orta";

        }
        else {

            level =
                "Düşük";

        }


        return {

            score,

            level,

            dboToSalaryRatio:
                round(
                    ratio,
                    2
                )

        };

    }


    /* =====================================================
       CFO YÖNETİM ÖZETİ
    ===================================================== */

    function managementSummary(
        portfolio
    ) {

        const totals =
            portfolio.totals;


        const dbo =
            number(
                totals.dbo
            );


        const employees =
            number(
                totals.employees
            );


        const averageDBO =
            employees > 0
                ? dbo / employees
                : 0;


        return {

            toplamDBO:
                round(
                    dbo
                ),

            personelSayisi:
                employees,

            personelBasinaDBO:
                round(
                    averageDBO
                ),

            karZararMaliyeti:
                round(
                    portfolio.profitLossEffect
                ),

            digerKapsamliGelir:
                round(
                    portfolio.ociEffect
                ),

            toplamNetEtki:
                round(
                    portfolio.netDefinedBenefitCost
                ),

            aktüeryalRisk:
                portfolio.risk.level,

            veriKalitesi:
                portfolio.dataQuality.level

        };

    }


    /* =====================================================
       ANA PORTFÖY HESAPLAMASI
    ===================================================== */

    function analyze(
        employees = [],
        actuarialResult = null
    ) {

        /*
        Eğer actuarialResult verilmemişse
        engine'den yeniden hesaplanabilir.

        Ancak normal mimaride:
        actuarialResult dışarıdan gelir.
        */

        if (
            !actuarialResult
        ) {

            if (
                window.TMS19ActuarialEngine
            ) {

                actuarialResult =
                    window.TMS19ActuarialEngine.calculate(
                        employees
                    );

            }
            else {

                throw new Error(
                    "TMS19ActuarialEngine bulunamadı."
                );

            }

        }


        const rows =
            employeeSummary(
                employees,
                actuarialResult.employeeResults
            );


        const concentration =
            dboConcentration(
                rows
            );


        const age =
            ageAnalysis(
                employees
            );


        const service =
            serviceAnalysis(
                employees
            );


        const department =
            departmentAnalysis(
                rows
            );


        const retirement =
            retirementRisk(
                employees
            );


        const pnlOci =
            pnlOciAnalysis(
                actuarialResult.totals
            );


        /*
        Veri kalite kontrolü
        */

        let dataQualityScore =
            100;


        employees.forEach(
            employee => {

                const e =
                    normalizeEmployee(
                        employee
                    );


                if (
                    !e.age
                ) {

                    dataQualityScore -= 10;

                }


                if (
                    !e.salary
                ) {

                    dataQualityScore -= 10;

                }


                if (
                    e.service < 0
                ) {

                    dataQualityScore -= 10;

                }

            }
        );


        dataQualityScore =
            Math.max(
                dataQualityScore,
                0
            );


        let dataQualityLevel;


        if (
            dataQualityScore >= 90
        ) {

            dataQualityLevel =
                "Yüksek";

        }
        else if (
            dataQualityScore >= 75
        ) {

            dataQualityLevel =
                "Orta";

        }
        else {

            dataQualityLevel =
                "Düşük";

        }


        const dataQuality = {

            score:
                dataQualityScore,

            level:
                dataQualityLevel

        };


        const risk =
            riskScore(
                employees,
                rows,
                concentration,
                retirement
            );


        const result = {

            generatedAt:
                new Date()
                    .toISOString(),

            employeeCount:
                employees.length,

            totals:
                actuarialResult.totals,

            rows,

            concentration,

            age,

            service,

            department,

            retirement,

            pnlOci,

            risk,

            dataQuality,

            rollForward:
                actuarialResult.rollForward,

            managementSummary: null

        };


        result.managementSummary =
            managementSummary(
                result
            );


        return result;

    }


    /* =====================================================
       TOP PERSONEL
    ===================================================== */

    function topEmployeesByDBO(
        portfolio,
        limit = 10
    ) {

        if (
            !portfolio ||
            !portfolio.rows
        ) {

            return [];

        }


        return [
            ...portfolio.rows
        ]
            .sort(
                (a, b) =>
                    b.dbo - a.dbo
            )
            .slice(
                0,
                limit
            );

    }


    /* =====================================================
       TOP DEPARTMANLAR
    ===================================================== */

    function topDepartmentsByDBO(
        portfolio,
        limit = 10
    ) {

        if (
            !portfolio ||
            !portfolio.department
        ) {

            return [];

        }


        return [
            ...portfolio.department
        ]
            .sort(
                (a, b) =>
                    b.dbo - a.dbo
            )
            .slice(
                0,
                limit
            );

    }


    /* =====================================================
       YÖNETİMSEL UYARI ÜRETİCİ
    ===================================================== */

    function generateAlerts(
        portfolio
    ) {

        const alerts = [];


        if (
            portfolio.risk.level ===
            "Yüksek"
        ) {

            alerts.push({

                severity:
                    "yüksek",

                title:
                    "Yüksek Aktüeryal Risk",

                message:
                    "TMS 19 yükümlülüğünün yaş, yoğunlaşma veya maliyet yapısı açısından yüksek risk taşıdığı görülüyor."

            });

        }


        if (
            portfolio.concentration
                .top5Share >= 50
        ) {

            alerts.push({

                severity:
                    "yüksek",

                title:
                    "DBO Yoğunlaşması",

                message:
                    "Toplam DBO'nun önemli bölümü sınırlı sayıdaki personelde yoğunlaşmaktadır."

            });

        }


        if (
            portfolio.retirement
                .highShare >= 20
        ) {

            alerts.push({

                severity:
                    "orta",

                title:
                    "Yaklaşan Emeklilikler",

                message:
                    "Çalışan portföyünde kısa vadede emeklilik riski taşıyan önemli sayıda personel bulunmaktadır."

            });

        }


        if (
            portfolio.dataQuality
                .score < 80
        ) {

            alerts.push({

                severity:
                    "orta",

                title:
                    "Veri Kalitesi",

                message:
                    "Aktüeryal değerleme öncesinde personel master datasının kontrol edilmesi gerekmektedir."

            });

        }


        if (
            !alerts.length
        ) {

            alerts.push({

                severity:
                    "bilgi",

                title:
                    "Önemli Uyarı Yok",

                message:
                    "Mevcut veri seti ve varsayımlar kapsamında kritik bir portföy uyarısı oluşmamıştır."

            });

        }


        return alerts;

    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    return {

        analyze,

        employeeSummary,

        dboConcentration,

        ageAnalysis,

        serviceAnalysis,

        departmentAnalysis,

        retirementRisk,

        pnlOciAnalysis,

        riskScore,

        topEmployeesByDBO,

        topDepartmentsByDBO,

        generateAlerts

    };


})();
