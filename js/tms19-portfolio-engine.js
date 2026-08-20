/* ============================================================
   GK ADVISORY
   TMS 19 — PERSONEL PORTFÖYÜ VE TOPLU DEĞERLEME MOTORU

   Amaç:
   - Çoklu personel verisi yönetimi
   - Personel bazında PUC hesaplama
   - Toplam DBO
   - Current Service Cost
   - Interest Cost
   - Net Liability
   - Toplu aktüeryal risk analizi
   - CFO seviyesinde özetleme

   Not:
   Bu motor resmi aktüeryal rapor yerine geçmez.
============================================================ */

(function (window) {

    "use strict";

    const PortfolioEngine = {

        employees: [],

        results: [],

        portfolioResult: null,


        /* ====================================================
           PERSONEL EKLE
        ==================================================== */

        addEmployee(employee) {

            const normalized =
                this.normalizeEmployee(employee);

            this.employees.push(normalized);

            return normalized;
        },


        /* ====================================================
           PERSONEL LİSTESİNİ YÜKLE
        ==================================================== */

        loadEmployees(employees) {

            if (!Array.isArray(employees)) {

                throw new Error(
                    "Personel verisi bir dizi olmalıdır."
                );

            }

            this.employees =
                employees.map(
                    employee =>
                        this.normalizeEmployee(employee)
                );

            return this.employees;
        },


        /* ====================================================
           PERSONEL VERİSİNİ STANDARDİZE ET
        ==================================================== */

        normalizeEmployee(employee) {

            return {

                employeeNumber:
                    employee.employeeNumber ||
                    employee.sicilNo ||
                    "",

                name:
                    employee.name ||
                    employee.ad ||
                    "İsimsiz Personel",

                department:
                    employee.department ||
                    employee.departman ||
                    "Belirtilmemiş",

                gender:
                    employee.gender ||
                    employee.cinsiyet ||
                    "",

                currentAge:
                    Number(
                        employee.currentAge ||
                        employee.yas ||
                        0
                    ),

                yearsOfService:
                    Number(
                        employee.yearsOfService ||
                        employee.hizmetSuresi ||
                        0
                    ),

                currentAnnualSalary:
                    Number(
                        employee.currentAnnualSalary ||
                        employee.yillikBrutMaas ||
                        employee.maas ||
                        0
                    ),

                openingDBO:
                    Number(
                        employee.openingDBO ||
                        employee.acilisDBO ||
                        0
                    ),

                planAssets:
                    Number(
                        employee.planAssets ||
                        employee.planVarliklari ||
                        0
                    ),

                benefitPayments:
                    Number(
                        employee.benefitPayments ||
                        employee.faydaOdemeleri ||
                        0
                    ),

                retirementAge:
                    Number(
                        employee.retirementAge ||
                        employee.emeklilikYasi ||
                        60
                    ),

                discountRate:
                    Number(
                        employee.discountRate ||
                        employee.iskontoOrani ||
                        0.30
                    ),

                salaryIncreaseRate:
                    Number(
                        employee.salaryIncreaseRate ||
                        employee.maasArtisOrani ||
                        0.30
                    ),

                inflationRate:
                    Number(
                        employee.inflationRate ||
                        employee.enflasyonOrani ||
                        0.30
                    ),

                turnoverRate:
                    Number(
                        employee.turnoverRate ||
                        employee.devirOrani ||
                        0.05
                    ),

                benefitRate:
                    Number(
                        employee.benefitRate ||
                        employee.faydaOrani ||
                        0.03
                    )

            };

        },


        /* ====================================================
           TOPLU DEĞERLEME
        ==================================================== */

        calculatePortfolio() {

            if (
                !window.TMS19ActuarialEngine
            ) {

                throw new Error(
                    "TMS19ActuarialEngine bulunamadı."
                );

            }


            this.results =
                this.employees.map(
                    employee => {

                        try {

                            const result =
                                window.TMS19ActuarialEngine
                                    .analyzeEmployee(
                                        employee
                                    );

                            return {

                                employee,

                                result,

                                status: "Başarılı",

                                error: null

                            };

                        }

                        catch (error) {

                            return {

                                employee,

                                result: null,

                                status: "Hatalı",

                                error:
                                    error.message

                            };

                        }

                    }
                );


            this.portfolioResult =
                this.aggregateResults();


            return this.portfolioResult;

        },


        /* ====================================================
           TOPLU SONUÇLARI BİRLEŞTİR
        ==================================================== */

        aggregateResults() {

            const validResults =
                this.results.filter(
                    x =>
                        x.result !== null
                );


            let totalDBO = 0;

            let totalCSC = 0;

            let totalInterest = 0;

            let totalNetInterest = 0;

            let totalNetLiability = 0;

            let totalOpeningDBO = 0;

            let totalPlanAssets = 0;

            let totalPayments = 0;

            let totalEmployees =
                this.employees.length;


            validResults.forEach(
                item => {

                    const r =
                        item.result;

                    const e =
                        item.employee;


                    totalDBO +=
                        Number(
                            r.puc?.dbo || 0
                        );


                    totalCSC +=
                        Number(
                            r.currentServiceCost || 0
                        );


                    totalInterest +=
                        Number(
                            r.netInterest
                                ?.interestCost ||
                            0
                        );


                    totalNetInterest +=
                        Number(
                            r.netInterest
                                ?.netInterest ||
                            0
                        );


                    totalNetLiability +=
                        Number(
                            r.netLiability || 0
                        );


                    totalOpeningDBO +=
                        Number(
                            e.openingDBO || 0
                        );


                    totalPlanAssets +=
                        Number(
                            e.planAssets || 0
                        );


                    totalPayments +=
                        Number(
                            e.benefitPayments || 0
                        );

                }
            );


            const averageAge =
                this.calculateAverage(
                    this.employees,
                    "currentAge"
                );


            const averageService =
                this.calculateAverage(
                    this.employees,
                    "yearsOfService"
                );


            const averageSalary =
                this.calculateAverage(
                    this.employees,
                    "currentAnnualSalary"
                );


            const totalSalary =
                this.employees.reduce(
                    (sum, employee) =>
                        sum +
                        Number(
                            employee.currentAnnualSalary ||
                            0
                        ),
                    0
                );


            const risk =
                this.calculatePortfolioRisk();


            const departments =
                this.departmentBreakdown();


            return {

                totalEmployees,

                successfulEmployees:
                    validResults.length,

                failedEmployees:
                    totalEmployees -
                    validResults.length,

                totalDBO,

                totalCSC,

                totalInterest,

                totalNetInterest,

                totalNetLiability,

                totalOpeningDBO,

                totalPlanAssets,

                totalPayments,

                totalSalary,

                averageAge,

                averageService,

                averageSalary,

                dboToSalaryRatio:
                    totalSalary !== 0
                        ? totalDBO / totalSalary
                        : 0,

                netLiabilityToSalaryRatio:
                    totalSalary !== 0
                        ? totalNetLiability /
                          totalSalary
                        : 0,

                risk,

                departments,

                generatedAt:
                    new Date().toISOString()

            };

        },


        /* ====================================================
           ORTALAMA HESAPLA
        ==================================================== */

        calculateAverage(
            employees,
            field
        ) {

            if (
                employees.length === 0
            ) {

                return 0;

            }


            const total =
                employees.reduce(
                    (sum, employee) =>
                        sum +
                        Number(
                            employee[field] || 0
                        ),
                    0
                );


            return (
                total /
                employees.length
            );

        },


        /* ====================================================
           DEPARTMAN KIRILIMI
        ==================================================== */

        departmentBreakdown() {

            const map = {};


            this.results.forEach(
                item => {

                    if (
                        !item.result
                    ) {

                        return;

                    }


                    const department =
                        item.employee.department ||
                        "Belirtilmemiş";


                    if (
                        !map[department]
                    ) {

                        map[department] = {

                            department,

                            employeeCount: 0,

                            dbo: 0,

                            currentServiceCost: 0,

                            netLiability: 0

                        };

                    }


                    map[department]
                        .employeeCount++;


                    map[department]
                        .dbo +=
                        Number(
                            item.result
                                .puc?.dbo ||
                            0
                        );


                    map[department]
                        .currentServiceCost +=
                        Number(
                            item.result
                                .currentServiceCost ||
                            0
                        );


                    map[department]
                        .netLiability +=
                        Number(
                            item.result
                                .netLiability ||
                            0
                        );

                }
            );


            return Object.values(map);

        },


        /* ====================================================
           AKTÜERYAL RİSK
        ==================================================== */

        calculatePortfolioRisk() {

            if (
                this.results.length === 0
            ) {

                return {

                    score: 0,

                    level: "Veri Yok",

                    warnings: []

                };

            }


            let score = 0;

            const warnings = [];


            const successful =
                this.results.filter(
                    x =>
                        x.result
                );


            successful.forEach(
                item => {

                    const risk =
                        item.result
                            ?.risk;


                    if (
                        !risk
                    ) {

                        return;

                    }


                    score +=
                        Number(
                            risk.score || 0
                        );


                    if (
                        Array.isArray(
                            risk.warnings
                        )
                    ) {

                        risk.warnings
                            .forEach(
                                warning => {

                                    warnings.push(
                                        warning
                                    );

                                }
                            );

                    }

                }
            );


            const averageScore =
                successful.length
                    ? score /
                      successful.length
                    : 0;


            let level =
                "Düşük";


            if (
                averageScore >= 75
            ) {

                level =
                    "Kritik";

            }

            else if (
                averageScore >= 50
            ) {

                level =
                    "Yüksek";

            }

            else if (
                averageScore >= 25
            ) {

                level =
                    "Orta";

            }


            return {

                score:
                    averageScore,

                level,

                warnings:
                    [
                        ...new Set(
                            warnings
                        )
                    ]

            };

        },


        /* ====================================================
           CFO ÖZETİ
        ==================================================== */

        getCFOInsight() {

            if (
                !this.portfolioResult
            ) {

                return {

                    headline:
                        "Henüz değerleme yapılmadı.",

                    observations: [],

                    actions: []

                };

            }


            const p =
                this.portfolioResult;


            const observations = [];

            const actions = [];


            if (
                p.dboToSalaryRatio > 1
            ) {

                observations.push(
                    "Toplam DBO yıllık personel maliyetinin üzerinde."
                );

                actions.push(
                    "Uzun vadeli çalışan faydalarının nakit akışı ve bilanço etkisi ayrıca modellenmeli."
                );

            }


            if (
                p.risk.score >= 50
            ) {

                observations.push(
                    "Portföy seviyesinde aktüeryal risk orta/yüksek seviyede."
                );

                actions.push(
                    "İskonto oranı, maaş artış oranı ve turnover varsayımları benchmark edilmelidir."
                );

            }


            if (
                p.failedEmployees > 0
            ) {

                observations.push(
                    `${p.failedEmployees} personelin değerlemesi tamamlanamadı.`
                );

                actions.push(
                    "Eksik veya hatalı personel master datası düzeltilmelidir."
                );

            }


            if (
                observations.length === 0
            ) {

                observations.push(
                    "Portföy seviyesinde kritik bir aktüeryal sinyal tespit edilmedi."
                );

            }


            if (
                actions.length === 0
            ) {

                actions.push(
                    "Varsayımların dönemsel olarak gerçekleşen sonuçlarla back-test edilmesi önerilir."
                );

            }


            return {

                headline:
                    `Toplam DBO ${this.formatTRY(p.totalDBO)} seviyesindedir.`,

                observations,

                actions

            };

        },


        /* ====================================================
           PERSONEL SIRALAMA
        ==================================================== */

        rankByDBO(
            limit = 20
        ) {

            return [

                ...this.results

            ]

            .filter(
                x =>
                    x.result
            )

            .sort(
                (a,b) =>
                    (
                        b.result
                            .puc
                            .dbo || 0
                    )
                    -
                    (
                        a.result
                            .puc
                            .dbo || 0
                    )
            )

            .slice(
                0,
                limit
            );

        },


        /* ====================================================
           FORMAT
        ==================================================== */

        formatTRY(
            value
        ) {

            return new Intl.NumberFormat(
                "tr-TR",
                {

                    style:
                        "currency",

                    currency:
                        "TRY",

                    maximumFractionDigits:
                        0

                }
            ).format(
                Number(value) || 0
            );

        },


        /* ====================================================
           DEMO PORTFÖYÜ
        ==================================================== */

        createSamplePortfolio(
            count = 25
        ) {

            const employees = [];


            for (
                let i = 1;
                i <= count;
                i++
            ) {

                const age =
                    25 +
                    Math.floor(
                        Math.random() * 30
                    );


                const service =
                    Math.min(
                        Math.floor(
                            Math.random() *
                            12
                        ),
                        age - 20
                    );


                const salary =
                    450000 +
                    Math.floor(
                        Math.random() *
                        1250000
                    );


                employees.push({

                    employeeNumber:
                        `P-${String(i).padStart(4,"0")}`,

                    name:
                        `Personel ${i}`,

                    department:
                        [
                            "Finans",
                            "Satış",
                            "Operasyon",
                            "İnsan Kaynakları",
                            "Üretim"
                        ][
                            i % 5
                        ],

                    currentAge:
                        age,

                    yearsOfService:
                        service,

                    currentAnnualSalary:
                        salary,

                    openingDBO:
                        Math.floor(
                            salary *
                            0.20 *
                            Math.max(
                                service,
                                1
                            )
                        ),

                    planAssets:
                        0,

                    benefitPayments:
                        0,

                    retirementAge:
                        60,

                    discountRate:
                        0.30,

                    salaryIncreaseRate:
                        0.30,

                    inflationRate:
                        0.25,

                    turnoverRate:
                        0.05,

                    benefitRate:
                        0.03

                });

            }


            return employees;

        }

    };


    /* ========================================================
       GLOBAL
    ======================================================== */

    window.TMS19PortfolioEngine =
        PortfolioEngine;


})(window);
