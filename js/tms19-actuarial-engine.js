/* ============================================================
   GK ADVISORY — TMS 19 ACTUARIAL ENGINE
   ------------------------------------------------------------
   Version: 2.0.0
   Purpose:
   - Defined Benefit Obligation (DBO)
   - Projected Unit Credit (PUC)
   - Salary projection
   - TFRS 19 / IAS 19 style actuarial projection
   - Competing decrements
   - Mortality
   - Turnover
   - Disability
   - Retirement
   - Benefit probability
   - Discounting
   - Service allocation
   - Current service cost
   - Interest cost
   - Roll-forward
   - Sensitivity analysis
   - Portfolio aggregation

   IMPORTANT:
   This engine is an actuarial calculation framework.
   Official actuarial valuation requires review/approval
   by a qualified actuary and validation of local Turkish
   labour-law / SGK assumptions.

   No external dependencies.
   ============================================================ */

(function (global) {

    "use strict";

    const VERSION = "2.0.0";

    /* =========================================================
       1. CONSTANTS
    ========================================================= */

    const DEFAULTS = {

        // Financial assumptions
        discountRate: 0.28,
        salaryGrowthRate: 0.24,
        ceilingGrowthRate: 0.24,

        // Demographic assumptions
        turnoverRate: 0.05,
        mortalityRate: 0.002,
        disabilityRate: 0.001,

        // Retirement
        retirementAge: 60,

        // Valuation
        valuationDate: new Date(),

        // Benefit
        benefitFormula: "salary_x_service",

        // Currency
        currency: "TRY",

        // Minimum rates
        minRate: 0,

        // Projection horizon
        maxProjectionYears: 50
    };


    /* =========================================================
       2. GENERAL UTILITIES
    ========================================================= */

    function toNumber(value, fallback = 0) {

        if (value === null || value === undefined || value === "") {
            return fallback;
        }

        if (typeof value === "number") {
            return Number.isFinite(value) ? value : fallback;
        }

        const normalized = String(value)
            .replace(/\s/g, "")
            .replace(/\./g, "")
            .replace(",", ".");

        const parsed = Number(normalized);

        return Number.isFinite(parsed) ? parsed : fallback;
    }


    function clamp(value, min, max) {

        return Math.min(
            Math.max(value, min),
            max
        );
    }


    function percentage(value) {

        const n = toNumber(value, 0);

        return n > 1 ? n / 100 : n;
    }


    function round(value, decimals = 2) {

        const factor = Math.pow(10, decimals);

        return Math.round(
            (toNumber(value) + Number.EPSILON) * factor
        ) / factor;
    }


    function safeDivide(a, b, fallback = 0) {

        if (!Number.isFinite(a) ||
            !Number.isFinite(b) ||
            Math.abs(b) < 1e-12) {

            return fallback;
        }

        return a / b;
    }


    function clone(value) {

        try {

            return JSON.parse(
                JSON.stringify(value)
            );

        } catch (error) {

            return value;
        }
    }


    /* =========================================================
       3. DATE ENGINE
    ========================================================= */

    function parseDate(value) {

        if (value instanceof Date &&
            !Number.isNaN(value.getTime())) {

            return new Date(value.getTime());
        }

        if (!value) {
            return null;
        }

        const date = new Date(value);

        if (!Number.isNaN(date.getTime())) {
            return date;
        }

        // Turkish DD.MM.YYYY
        const match = String(value).match(
            /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/
        );

        if (match) {

            const day = Number(match[1]);
            const month = Number(match[2]) - 1;
            const year = Number(match[3]);

            const result = new Date(
                year,
                month,
                day
            );

            if (!Number.isNaN(result.getTime())) {
                return result;
            }
        }

        return null;
    }


    function yearsBetween(startDate, endDate) {

        const start = parseDate(startDate);
        const end = parseDate(endDate);

        if (!start || !end) {
            return 0;
        }

        const diff =
            end.getTime() -
            start.getTime();

        return diff /
            (365.25 * 24 * 60 * 60 * 1000);
    }


    function completedYears(startDate, valuationDate) {

        const start = parseDate(startDate);
        const valuation = parseDate(valuationDate);

        if (!start || !valuation) {
            return 0;
        }

        let years =
            valuation.getFullYear() -
            start.getFullYear();

        const monthDiff =
            valuation.getMonth() -
            start.getMonth();

        if (
            monthDiff < 0 ||
            (
                monthDiff === 0 &&
                valuation.getDate() < start.getDate()
            )
        ) {

            years--;
        }

        return Math.max(0, years);
    }


    function ageAtDate(birthDate, date) {

        const birth = parseDate(birthDate);
        const target = parseDate(date);

        if (!birth || !target) {
            return 0;
        }

        let age =
            target.getFullYear() -
            birth.getFullYear();

        const monthDiff =
            target.getMonth() -
            birth.getMonth();

        if (
            monthDiff < 0 ||
            (
                monthDiff === 0 &&
                target.getDate() < birth.getDate()
            )
        ) {

            age--;
        }

        return Math.max(0, age);
    }


    function addYears(date, years) {

        const result = new Date(date);

        result.setFullYear(
            result.getFullYear() + years
        );

        return result;
    }


    /* =========================================================
       4. ASSUMPTION NORMALIZATION
    ========================================================= */

    function normalizeAssumptions(input = {}) {

        const assumptions = {
            ...DEFAULTS,
            ...input
        };

        assumptions.discountRate =
            percentage(assumptions.discountRate);

        assumptions.salaryGrowthRate =
            percentage(assumptions.salaryGrowthRate);

        assumptions.ceilingGrowthRate =
            percentage(assumptions.ceilingGrowthRate);

        assumptions.turnoverRate =
            percentage(assumptions.turnoverRate);

        assumptions.mortalityRate =
            percentage(assumptions.mortalityRate);

        assumptions.disabilityRate =
            percentage(assumptions.disabilityRate);

        assumptions.retirementAge =
            Math.round(
                toNumber(
                    assumptions.retirementAge,
                    DEFAULTS.retirementAge
                )
            );

        assumptions.valuationDate =
            parseDate(
                assumptions.valuationDate
            ) ||
            new Date();

        assumptions.maxProjectionYears =
            Math.max(
                1,
                Math.round(
                    toNumber(
                        assumptions.maxProjectionYears,
                        DEFAULTS.maxProjectionYears
                    )
                )
            );

        return assumptions;
    }


    /* =========================================================
       5. EMPLOYEE NORMALIZATION
    ========================================================= */

    function normalizeEmployee(employee = {}, assumptions = {}) {

        const valuationDate =
            assumptions.valuationDate ||
            new Date();

        const normalized = {

            id:
                employee.id ||
                employee.employeeId ||
                employee.sicilNo ||
                `EMP-${Date.now()}-${Math.random()
                    .toString(36)
                    .slice(2, 8)}`,

            name:
                employee.name ||
                employee.employeeName ||
                employee.fullName ||
                "Unnamed Employee",

            title:
                employee.title ||
                employee.position ||
                employee.jobTitle ||
                "",

            hireDate:
                parseDate(
                    employee.hireDate ||
                    employee.startDate ||
                    employee.employmentDate
                ),

            birthDate:
                parseDate(
                    employee.birthDate ||
                    employee.dateOfBirth
                ),

            monthlySalary:
                Math.max(
                    0,
                    toNumber(
                        employee.monthlySalary ??
                        employee.salary ??
                        employee.monthlyWage,
                        0
                    )
                ),

            currentCeiling:
                Math.max(
                    0,
                    toNumber(
                        employee.currentCeiling ??
                        employee.ceiling ??
                        assumptions.ceiling,
                        0
                    )
                ),

            gender:
                employee.gender ||
                employee.sex ||
                null,

            department:
                employee.department ||
                "",

            grade:
                employee.grade ||
                employee.level ||
                null,

            annualSalaryGrowth:
                employee.salaryGrowthRate ??
                employee.annualSalaryGrowth ??
                null,

            turnoverRate:
                employee.turnoverRate ??
                null,

            mortalityRate:
                employee.mortalityRate ??
                null,

            disabilityRate:
                employee.disabilityRate ??
                null,

            retirementAge:
                employee.retirementAge ??
                assumptions.retirementAge,

            eligible:
                employee.eligible !== false,

            metadata:
                clone(employee.metadata || {})
        };

        normalized.age =
            normalized.birthDate
                ? ageAtDate(
                    normalized.birthDate,
                    valuationDate
                )
                : toNumber(
                    employee.age,
                    0
                );

        normalized.serviceYears =
            normalized.hireDate
                ? completedYears(
                    normalized.hireDate,
                    valuationDate
                )
                : Math.max(
                    0,
                    toNumber(
                        employee.serviceYears ??
                        employee.service,
                        0
                    )
                );

        normalized.retirementAge =
            Math.max(
                normalized.age + 1,
                toNumber(
                    normalized.retirementAge,
                    assumptions.retirementAge
                )
            );

        return normalized;
    }


    /* =========================================================
       6. MORTALITY TABLE ENGINE
    ========================================================= */

    function mortalityProbability(
        age,
        year,
        assumptions,
        employee
    ) {

        const customTable =
            assumptions.mortalityTable;

        if (
            customTable &&
            typeof customTable === "object"
        ) {

            const tableValue =
                customTable[age + year];

            if (tableValue !== undefined) {

                return clamp(
                    percentage(tableValue),
                    0,
                    1
                );
            }
        }

        const employeeRate =
            employee?.mortalityRate;

        if (
            employeeRate !== null &&
            employeeRate !== undefined
        ) {

            return clamp(
                percentage(employeeRate),
                0,
                1
            );
        }

        /*
         * Default simplified mortality curve.
         *
         * This is deliberately conservative and should be
         * replaced by an approved mortality table in a
         * formal actuarial valuation.
         */

        const projectedAge =
            age + year;

        if (projectedAge < 40) {
            return 0.001;
        }

        if (projectedAge < 50) {
            return 0.002;
        }

        if (projectedAge < 60) {
            return 0.004;
        }

        if (projectedAge < 65) {
            return 0.007;
        }

        if (projectedAge < 70) {
            return 0.012;
        }

        if (projectedAge < 75) {
            return 0.025;
        }

        if (projectedAge < 80) {
            return 0.050;
        }

        return Math.min(
            0.20,
            0.08 + (projectedAge - 80) * 0.012
        );
    }


    /* =========================================================
       7. TURNOVER TABLE ENGINE
    ========================================================= */

    function turnoverProbability(
        age,
        service,
        year,
        assumptions,
        employee
    ) {

        if (
            employee?.turnoverRate !== null &&
            employee?.turnoverRate !== undefined
        ) {

            return clamp(
                percentage(
                    employee.turnoverRate
                ),
                0,
                1
            );
        }

        const table =
            assumptions.turnoverTable;

        if (
            table &&
            typeof table === "object"
        ) {

            /*
             * Supported formats:
             *
             * {
             *   "25": 0.08,
             *   "30": 0.06
             * }
             */

            const value =
                table[Math.round(age)];

            if (value !== undefined) {

                return clamp(
                    percentage(value),
                    0,
                    1
                );
            }
        }

        /*
         * Service-sensitive simplified turnover curve.
         */

        let rate;

        if (age < 25) {
            rate = 0.12;
        } else if (age < 30) {
            rate = 0.09;
        } else if (age < 40) {
            rate = 0.06;
        } else if (age < 50) {
            rate = 0.045;
        } else if (age < 55) {
            rate = 0.035;
        } else {
            rate = 0.025;
        }

        // Longer service normally reduces voluntary turnover.
        if (service >= 10) {
            rate *= 0.70;
        } else if (service >= 5) {
            rate *= 0.85;
        }

        return clamp(
            rate,
            0,
            0.50
        );
    }


    /* =========================================================
       8. DISABILITY ENGINE
    ========================================================= */

    function disabilityProbability(
        age,
        year,
        assumptions,
        employee
    ) {

        if (
            employee?.disabilityRate !== null &&
            employee?.disabilityRate !== undefined
        ) {

            return clamp(
                percentage(
                    employee.disabilityRate
                ),
                0,
                1
            );
        }

        const table =
            assumptions.disabilityTable;

        if (
            table &&
            typeof table === "object"
        ) {

            const value =
                table[Math.round(age)];

            if (value !== undefined) {

                return clamp(
                    percentage(value),
                    0,
                    1
                );
            }
        }

        const projectedAge =
            age + year;

        if (projectedAge < 40) {
            return 0.0005;
        }

        if (projectedAge < 50) {
            return 0.001;
        }

        if (projectedAge < 60) {
            return 0.002;
        }

        return 0.004;
    }


    /* =========================================================
       9. RETIREMENT ENGINE
    ========================================================= */

    function retirementProbability(
        age,
        retirementAge,
        year,
        assumptions
    ) {

        const projectedAge =
            age + year;

        if (
            projectedAge < retirementAge
        ) {

            return 0;
        }

        /*
         * Base case:
         * retirement occurs at retirement age.
         *
         * This can later be replaced with an age-specific
         * retirement decrement table.
         */

        const table =
            assumptions.retirementTable;

        if (
            table &&
            typeof table === "object"
        ) {

            const value =
                table[Math.round(projectedAge)];

            if (value !== undefined) {

                return clamp(
                    percentage(value),
                    0,
                    1
                );
            }
        }

        return projectedAge === retirementAge
            ? 1
            : 0;
    }


    /* =========================================================
       10. COMPETING DECREMENT ENGINE
    ========================================================= */

    function calculateCompetingDecrements(params = {}) {

        const age =
            toNumber(params.age, 0);

        const service =
            toNumber(params.service, 0);

        const year =
            toNumber(params.year, 0);

        const assumptions =
            normalizeAssumptions(
                params.assumptions || {}
            );

        const employee =
            params.employee || {};

        const retirementAge =
            toNumber(
                employee.retirementAge ??
                assumptions.retirementAge,
                60
            );

        const mortality =
            mortalityProbability(
                age,
                year,
                assumptions,
                employee
            );

        const turnover =
            turnoverProbability(
                age + year,
                service + year,
                year,
                assumptions,
                employee
            );

        const disability =
            disabilityProbability(
                age,
                year,
                assumptions,
                employee
            );

        const retirement =
            retirementProbability(
                age,
                retirementAge,
                year,
                assumptions
            );

        /*
         * Competing decrement probability:
         *
         * P(event) =
         * survival-to-event × event hazard
         *
         * Multiple events compete during the same period.
         */

        const totalHazard =
            mortality +
            turnover +
            disability +
            retirement;

        let scale = 1;

        if (totalHazard > 1) {
            scale = 1 / totalHazard;
        }

        return {

            mortality:
                mortality * scale,

            turnover:
                turnover * scale,

            disability:
                disability * scale,

            retirement:
                retirement * scale,

            total:
                (
                    mortality +
                    turnover +
                    disability +
                    retirement
                ) * scale
        };
    }


    /* =========================================================
       11. SALARY PROJECTION ENGINE
    ========================================================= */

    function salaryProjection(
        currentSalary,
        year,
        assumptions,
        employee
    ) {

        const salary =
            Math.max(
                0,
                toNumber(currentSalary, 0)
            );

        const individualGrowth =
            employee?.annualSalaryGrowth !== null &&
            employee?.annualSalaryGrowth !== undefined
                ? percentage(
                    employee.annualSalaryGrowth
                )
                : null;

        const growth =
            individualGrowth !== null
                ? individualGrowth
                : percentage(
                    assumptions.salaryGrowthRate
                );

        return salary *
            Math.pow(
                1 + growth,
                year
            );
    }


    /* =========================================================
       12. CEILING PROJECTION ENGINE
    ========================================================= */

    function ceilingProjection(
        currentCeiling,
        year,
        assumptions
    ) {

        const ceiling =
            Math.max(
                0,
                toNumber(
                    currentCeiling,
                    0
                )
            );

        const growth =
            percentage(
                assumptions.ceilingGrowthRate
            );

        if (!ceiling) {
            return Infinity;
        }

        return ceiling *
            Math.pow(
                1 + growth,
                year
            );
    }


    /* =========================================================
       13. BENEFIT ENGINE
    ========================================================= */

    function calculateProjectedBenefit(params = {}) {

        const salary =
            Math.max(
                0,
                toNumber(
                    params.projectedSalary,
                    0
                )
            );

        const ceiling =
            toNumber(
                params.projectedCeiling,
                Infinity
            );

        const serviceYears =
            Math.max(
                0,
                toNumber(
                    params.serviceYears,
                    0
                )
            );

        /*
         * Turkish severance:
         *
         * approximately one gross monthly salary
         * for each completed service year,
         * subject to statutory ceiling.
         *
         * This is a modelling assumption and not
         * a legal eligibility determination.
         */

        const cappedMonthlySalary =
            Math.min(
                salary,
                ceiling
            );

        return {

            cappedMonthlySalary,

            annualBenefit:
                cappedMonthlySalary,

            totalBenefit:
                cappedMonthlySalary *
                serviceYears
        };
    }


    /* =========================================================
       14. DISCOUNT ENGINE
    ========================================================= */

    function discountFactor(
        year,
        discountRate
    ) {

        const rate =
            percentage(discountRate);

        return 1 /
            Math.pow(
                1 + rate,
                year
            );
    }


    function getDiscountRate(
        year,
        assumptions
    ) {

        /*
         * Optional spot / yield curve:
         *
         * {
         *   1: 0.27,
         *   2: 0.265,
         *   3: 0.26
         * }
         */

        const curve =
            assumptions.discountCurve;

        if (
            curve &&
            typeof curve === "object"
        ) {

            const rate =
                curve[year];

            if (rate !== undefined) {

                return percentage(rate);
            }
        }

        return percentage(
            assumptions.discountRate
        );
    }


    /* =========================================================
       15. SURVIVAL PROBABILITY ENGINE
    ========================================================= */

    function calculateProjectionPath(
        employee,
        assumptions
    ) {

        const rows = [];

        let survivalProbability = 1;

        const age =
            employee.age;

        const service =
            employee.serviceYears;

        const retirementAge =
            employee.retirementAge ||
            assumptions.retirementAge;

        const maxYears =
            Math.min(
                assumptions.maxProjectionYears,
                Math.max(
                    0,
                    retirementAge - age
                ) + 1
            );

        for (
            let year = 1;
            year <= maxYears;
            year++
        ) {

            const projectedAge =
                age + year;

            const projectedService =
                service + year;

            const decrements =
                calculateCompetingDecrements({

                    age,
                    service,
                    year,

                    assumptions,

                    employee
                });

            const mortalityProb =
                survivalProbability *
                decrements.mortality;

            const turnoverProb =
                survivalProbability *
                decrements.turnover;

            const disabilityProb =
                survivalProbability *
                decrements.disability;

            const retirementProb =
                survivalProbability *
                decrements.retirement;

            const eventProbability =
                mortalityProb +
                turnoverProb +
                disabilityProb +
                retirementProb;

            const endSurvival =
                Math.max(
                    0,
                    survivalProbability -
                    eventProbability
                );

            const projectedSalary =
                salaryProjection(
                    employee.monthlySalary,
                    year,
                    assumptions,
                    employee
                );

            const projectedCeiling =
                ceilingProjection(
                    employee.currentCeiling,
                    year,
                    assumptions
                );

            const benefit =
                calculateProjectedBenefit({

                    projectedSalary,

                    projectedCeiling,

                    serviceYears:
                        projectedService
                });

            const discountRate =
                getDiscountRate(
                    year,
                    assumptions
                );

            const df =
                discountFactor(
                    year,
                    discountRate
                );

            /*
             * Benefit payable at retirement /
             * qualifying termination event.
             *
             * For simplified Turkish severance model,
             * voluntary turnover is treated as non-qualifying.
             */

            const qualifyingProbability =
                mortalityProb +
                disabilityProb +
                retirementProb;

            const expectedBenefit =
                benefit.totalBenefit *
                qualifyingProbability;

            const presentValue =
                expectedBenefit *
                df;

            rows.push({

                year,

                projectedAge,

                projectedService,

                survivalProbability,

                mortalityRate:
                    decrements.mortality,

                turnoverRate:
                    decrements.turnover,

                disabilityRate:
                    decrements.disability,

                retirementRate:
                    decrements.retirement,

                mortalityProbability:
                    mortalityProb,

                turnoverProbability:
                    turnoverProb,

                disabilityProbability:
                    disabilityProb,

                retirementProbability:
                    retirementProb,

                qualifyingProbability,

                projectedSalary,

                projectedCeiling,

                cappedMonthlySalary:
                    benefit.cappedMonthlySalary,

                projectedBenefit:
                    benefit.totalBenefit,

                discountRate,

                discountFactor:
                    df,

                expectedBenefit,

                presentValue
            });

            survivalProbability =
                endSurvival;

            if (
                survivalProbability <=
                0.0000001
            ) {
                break;
            }
        }

        return rows;
    }


    /* =========================================================
       16. PUC ENGINE
    ========================================================= */

    function calculatePUC(
        employee,
        projection,
        assumptions
    ) {

        if (
            !employee ||
            !projection ||
            !projection.length
        ) {

            return {

                projectedBenefit: 0,

                expectedPV: 0,

                DBO: 0,

                pastServiceDBO: 0,

                currentServiceCost: 0,

                futureServiceDBO: 0
            };
        }

        const totalServiceAtBenefit =
            projection.length > 0
                ? projection[
                    projection.length - 1
                ].projectedService
                : employee.serviceYears;

        /*
         * PUC allocation:
         *
         * Projected benefit is allocated
         * systematically over service.
         *
         * DBO =
         *
         * PV of total projected benefit
         * × completed service / total service
         *
         * For a full actuarial implementation,
         * each decrement event and service fraction
         * should be allocated on a cohort basis.
         */

        let totalPV = 0;

        projection.forEach(row => {

            totalPV +=
                row.presentValue;
        });

        const completedService =
            Math.max(
                0,
                employee.serviceYears
            );

        const totalService =
            Math.max(
                completedService,
                totalServiceAtBenefit
            );

        const serviceFraction =
            totalService > 0
                ? clamp(
                    completedService /
                    totalService,
                    0,
                    1
                )
                : 0;

        const DBO =
            totalPV *
            serviceFraction;

        /*
         * Future service component.
         */

        const futureServiceFraction =
            Math.max(
                0,
                1 - serviceFraction
            );

        const futureServiceDBO =
            totalPV *
            futureServiceFraction;

        /*
         * Current service cost:
         *
         * Marginal one-year PUC allocation.
         */

        const currentServiceCost =
            totalPV /
            Math.max(
                totalService,
                1
            );

        return {

            projectedBenefit:
                projection.length
                    ? projection[
                        projection.length - 1
                    ].projectedBenefit
                    : 0,

            expectedPV:
                totalPV,

            DBO,

            pastServiceDBO:
                DBO,

            currentServiceCost,

            futureServiceDBO,

            serviceFraction,

            totalService:
                totalService
        };
    }


    /* =========================================================
       17. EMPLOYEE VALUATION
    ========================================================= */

    function calculateEmployee(
        employeeInput,
        assumptionsInput = {}
    ) {

        const assumptions =
            normalizeAssumptions(
                assumptionsInput
            );

        const employee =
            normalizeEmployee(
                employeeInput,
                assumptions
            );

        if (!employee.eligible) {

            return {

                employee,

                eligible: false,

                projection: [],

                valuation: {

                    projectedBenefit: 0,

                    expectedPV: 0,

                    DBO: 0,

                    pastServiceDBO: 0,

                    currentServiceCost: 0,

                    futureServiceDBO: 0
                }
            };
        }

        const projection =
            calculateProjectionPath(
                employee,
                assumptions
            );

        const puc =
            calculatePUC(
                employee,
                projection,
                assumptions
            );

        const firstYear =
            projection[0] || {};

        const lastYear =
            projection[
                projection.length - 1
            ] || {};

        const result = {

            employee,

            eligible: true,

            age:
                employee.age,

            serviceYears:
                employee.serviceYears,

            projectedRetirementAge:
                employee.retirementAge,

            yearsToRetirement:
                Math.max(
                    0,
                    employee.retirementAge -
                    employee.age
                ),

            currentSalary:
                employee.monthlySalary,

            currentCeiling:
                employee.currentCeiling,

            currentNominalBenefit:
                employee.currentCeiling > 0
                    ? Math.min(
                        employee.monthlySalary,
                        employee.currentCeiling
                    ) *
                    employee.serviceYears
                    : employee.monthlySalary *
                    employee.serviceYears,

            projection,

            valuation: puc,

            firstYear,

            lastYear,

            calculationDate:
                new Date().toISOString(),

            engineVersion:
                VERSION
        };

        return result;
    }


    /* =========================================================
       18. PORTFOLIO VALUATION
    ========================================================= */

    function calculatePortfolio(
        employees = [],
        assumptionsInput = {}
    ) {

        const assumptions =
            normalizeAssumptions(
                assumptionsInput
            );

        const valuations =
            employees.map(
                employee =>
                    calculateEmployee(
                        employee,
                        assumptions
                    )
            );

        const eligible =
            valuations.filter(
                item => item.eligible
            );

        const totals =
            eligible.reduce(
                (acc, item) => {

                    const valuation =
                        item.valuation;

                    acc.employeeCount++;

                    acc.nominalBenefit +=
                        item.currentNominalBenefit ||
                        0;

                    acc.projectedBenefit +=
                        valuation.projectedBenefit ||
                        0;

                    acc.expectedPV +=
                        valuation.expectedPV ||
                        0;

                    acc.DBO +=
                        valuation.DBO ||
                        0;

                    acc.pastServiceDBO +=
                        valuation.pastServiceDBO ||
                        0;

                    acc.currentServiceCost +=
                        valuation.currentServiceCost ||
                        0;

                    acc.futureServiceDBO +=
                        valuation.futureServiceDBO ||
                        0;

                    return acc;

                },
                {

                    employeeCount: 0,

                    nominalBenefit: 0,

                    projectedBenefit: 0,

                    expectedPV: 0,

                    DBO: 0,

                    pastServiceDBO: 0,

                    currentServiceCost: 0,

                    futureServiceDBO: 0
                }
            );

        const averageBenefitProbability =
            eligible.length
                ? safeDivide(
                    eligible.reduce(
                        (sum, item) => {

                            const probability =
                                item.projection.reduce(
                                    (
                                        pSum,
                                        row
                                    ) =>
                                        pSum +
                                        (
                                            row.qualifyingProbability ||
                                            0
                                        ),
                                    0
                                );

                            return sum +
                                probability;

                        },
                        0
                    ),
                    eligible.length
                )
                : 0;

        return {

            engineVersion:
                VERSION,

            valuationDate:
                assumptions.valuationDate,

            assumptions:

                clone(assumptions),

            employees:
                valuations,

            totals: {

                ...totals,

                averageBenefitProbability,

                DBO:
                    round(
                        totals.DBO
                    ),

                currentServiceCost:
                    round(
                        totals.currentServiceCost
                    ),

                expectedPV:
                    round(
                        totals.expectedPV
                    )
            }
        };
    }


    /* =========================================================
       19. INTEREST COST
    ========================================================= */

    function calculateInterestCost(
        openingDBO,
        discountRate
    ) {

        const DBO =
            Math.max(
                0,
                toNumber(
                    openingDBO,
                    0
                )
            );

        const rate =
            percentage(
                discountRate
            );

        return DBO * rate;
    }


    /* =========================================================
       20. ACTUARIAL ROLL-FORWARD
    ========================================================= */

    function calculateRollForward(
        params = {}
    ) {

        const openingDBO =
            toNumber(
                params.openingDBO,
                0
            );

        const currentServiceCost =
            toNumber(
                params.currentServiceCost,
                0
            );

        const interestCost =
            params.interestCost !== undefined
                ? toNumber(
                    params.interestCost,
                    0
                )
                : calculateInterestCost(
                    openingDBO,
                    params.discountRate
                );

        const benefitsPaid =
            toNumber(
                params.benefitsPaid,
                0
            );

        const actuarialGainLoss =
            toNumber(
                params.actuarialGainLoss,
                0
            );

        const otherMovement =
            toNumber(
                params.otherMovement,
                0
            );

        const closingDBO =
            openingDBO +
            currentServiceCost +
            interestCost -
            benefitsPaid +
            actuarialGainLoss +
            otherMovement;

        return {

            openingDBO,

            currentServiceCost,

            interestCost,

            benefitsPaid,

            actuarialGainLoss,

            otherMovement,

            closingDBO
        };
    }


    /* =========================================================
       21. ACTUARIAL GAIN / LOSS
    ========================================================= */

    function calculateActuarialGainLoss(params = {}) {

        const expectedClosing =
            toNumber(
                params.expectedClosingDBO,
                0
            );

        const actualClosing =
            toNumber(
                params.actualClosingDBO,
                0
            );

        /*
         * Positive:
         * actual liability > expected liability
         *
         * => actuarial loss
         *
         * Negative:
         * actual liability < expected liability
         *
         * => actuarial gain
         */

        const experienceAdjustment =
            toNumber(
                params.experienceAdjustment,
                0
            );

        const demographicChange =
            toNumber(
                params.demographicAssumptionChange,
                0
            );

        const financialChange =
            toNumber(
                params.financialAssumptionChange,
                0
            );

        const total =
            experienceAdjustment +
            demographicChange +
            financialChange;

        return {

            experienceAdjustment,

            demographicAssumptionChange:
                demographicChange,

            financialAssumptionChange:
                financialChange,

            total,

            expectedClosing,

            actualClosing
        };
    }


    /* =========================================================
       22. SENSITIVITY ENGINE
    ========================================================= */

    function sensitivity(
        employees,
        assumptionsInput = {},
        variable,
        shifts = [-0.01, 0.01]
    ) {

        const base =
            normalizeAssumptions(
                assumptionsInput
            );

        const baseResult =
            calculatePortfolio(
                employees,
                base
            );

        const scenarios = [];

        shifts.forEach(
            shift => {

                const scenario =
                    normalizeAssumptions(
                        clone(base)
                    );

                const baseValue =
                    scenario[variable];

                if (
                    typeof baseValue !==
                    "number"
                ) {
                    return;
                }

                scenario[variable] =
                    Math.max(
                        0,
                        baseValue +
                        shift
                    );

                const result =
                    calculatePortfolio(
                        employees,
                        scenario
                    );

                scenarios.push({

                    variable,

                    shift,

                    baseValue,

                    scenarioValue:
                        scenario[variable],

                    DBO:
                        result.totals.DBO,

                    change:
                        result.totals.DBO -
                        baseResult.totals.DBO,

                    percentageChange:
                        safeDivide(
                            result.totals.DBO -
                            baseResult.totals.DBO,
                            baseResult.totals.DBO
                        )
                });
            }
        );

        return {

            variable,

            baseDBO:
                baseResult.totals.DBO,

            scenarios
        };
    }


    function calculateFullSensitivity(
        employees,
        assumptions = {}
    ) {

        const variables = [

            "discountRate",

            "salaryGrowthRate",

            "ceilingGrowthRate",

            "turnoverRate",

            "mortalityRate",

            "disabilityRate"
        ];

        const result = {};

        variables.forEach(
            variable => {

                result[variable] =
                    sensitivity(
                        employees,
                        assumptions,
                        variable,
                        [-0.01, 0.01]
                    );
            }
        );

        return result;
    }


    /* =========================================================
       23. DBO MOVEMENT ANALYSIS
    ========================================================= */

    function calculateDBOMovement(
        opening,
        closing
    ) {

        const movement =
            closing -
            opening;

        return {

            openingDBO:
                opening,

            closingDBO:
                closing,

            movement,

            movementPercentage:
                safeDivide(
                    movement,
                    opening
                )
        };
    }


    /* =========================================================
       24. DISCOUNT CURVE SUPPORT
    ========================================================= */

    function buildDiscountCurve(
        rates = {}
    ) {

        const curve = {};

        Object.keys(rates)
            .sort(
                (a, b) =>
                    Number(a) -
                    Number(b)
            )
            .forEach(
                year => {

                    curve[
                        Number(year)
                    ] =
                        percentage(
                            rates[year]
                        );
                }
            );

        return curve;
    }


    /* =========================================================
       25. ACTUARIAL REPORT SUMMARY
    ========================================================= */

    function createValuationSummary(
        portfolioResult
    ) {

        if (!portfolioResult) {
            return null;
        }

        const totals =
            portfolioResult.totals || {};

        return {

            engineVersion:
                VERSION,

            valuationDate:
                portfolioResult.valuationDate,

            employeeCount:
                totals.employeeCount || 0,

            nominalBenefit:
                round(
                    totals.nominalBenefit || 0
                ),

            projectedBenefit:
                round(
                    totals.projectedBenefit || 0
                ),

            expectedPV:
                round(
                    totals.expectedPV || 0
                ),

            DBO:
                round(
                    totals.DBO || 0
                ),

            currentServiceCost:
                round(
                    totals.currentServiceCost || 0
                ),

            futureServiceDBO:
                round(
                    totals.futureServiceDBO || 0
                ),

            averageBenefitProbability:
                round(
                    totals.averageBenefitProbability || 0,
                    6
                )
        };
    }


    /* =========================================================
       26. VALIDATION ENGINE
    ========================================================= */

    function validateEmployee(employee) {

        const errors = [];
        const warnings = [];

        if (!employee) {

            errors.push(
                "Employee object is missing."
            );

            return {
                valid: false,
                errors,
                warnings
            };
        }

        if (
            !employee.monthlySalary &&
            !employee.salary
        ) {

            warnings.push(
                "Monthly salary is zero or missing."
            );
        }

        if (
            !employee.birthDate &&
            employee.age === undefined
        ) {

            warnings.push(
                "Birth date / age is missing."
            );
        }

        if (
            !employee.hireDate &&
            employee.serviceYears === undefined
        ) {

            warnings.push(
                "Hire date / service years is missing."
            );
        }

        if (
            employee.age !== undefined &&
            (
                employee.age < 16 ||
                employee.age > 100
            )
        ) {

            errors.push(
                "Employee age is outside expected range."
            );
        }

        if (
            employee.monthlySalary !== undefined &&
            employee.monthlySalary < 0
        ) {

            errors.push(
                "Monthly salary cannot be negative."
            );
        }

        return {

            valid:
                errors.length === 0,

            errors,

            warnings
        };
    }


    function validatePortfolio(
        employees = []
    ) {

        const result = {

            valid: true,

            employeeCount:
                employees.length,

            errors: [],

            warnings: []

        };

        employees.forEach(
            (employee, index) => {

                const validation =
                    validateEmployee(
                        employee
                    );

                validation.errors
                    .forEach(
                        error => {

                            result.errors.push({
                                index,
                                employeeId:
                                    employee?.id ||
                                    employee?.employeeId ||
                                    null,
                                message:
                                    error
                            });
                        }
                    );

                validation.warnings
                    .forEach(
                        warning => {

                            result.warnings.push({
                                index,
                                employeeId:
                                    employee?.id ||
                                    employee?.employeeId ||
                                    null,
                                message:
                                    warning
                            });
                        }
                    );
            }
        );

        result.valid =
            result.errors.length === 0;

        return result;
    }


    /* =========================================================
       27. CSV EXPORT DATA
    ========================================================= */

    function flattenEmployeeResult(
        result
    ) {

        if (!result) {
            return null;
        }

        return {

            EmployeeID:
                result.employee.id,

            EmployeeName:
                result.employee.name,

            Age:
                result.age,

            ServiceYears:
                round(
                    result.serviceYears,
                    2
                ),

            MonthlySalary:
                round(
                    result.currentSalary
                ),

            CurrentCeiling:
                round(
                    result.currentCeiling
                ),

            NominalBenefit:
                round(
                    result.currentNominalBenefit
                ),

            ProjectedBenefit:
                round(
                    result.valuation.projectedBenefit
                ),

            ExpectedPV:
                round(
                    result.valuation.expectedPV
                ),

            DBO:
                round(
                    result.valuation.DBO
                ),

            CurrentServiceCost:
                round(
                    result.valuation.currentServiceCost
                ),

            FutureServiceDBO:
                round(
                    result.valuation.futureServiceDBO
                ),

            RetirementAge:
                result.projectedRetirementAge,

            YearsToRetirement:
                result.yearsToRetirement
        };
    }


    function createProjectionExport(
        employeeResult
    ) {

        if (
            !employeeResult ||
            !employeeResult.projection
        ) {
            return [];
        }

        return employeeResult.projection.map(
            row => ({

                Year:
                    row.year,

                ProjectedAge:
                    row.projectedAge,

                ProjectedService:
                    round(
                        row.projectedService,
                        2
                    ),

                SurvivalProbability:
                    row.survivalProbability,

                MortalityProbability:
                    row.mortalityProbability,

                TurnoverProbability:
                    row.turnoverProbability,

                DisabilityProbability:
                    row.disabilityProbability,

                RetirementProbability:
                    row.retirementProbability,

                QualifyingProbability:
                    row.qualifyingProbability,

                ProjectedSalary:
                    round(
                        row.projectedSalary
                    ),

                ProjectedCeiling:
                    round(
                        row.projectedCeiling
                    ),

                ProjectedBenefit:
                    round(
                        row.projectedBenefit
                    ),

                DiscountRate:
                    row.discountRate,

                DiscountFactor:
                    row.discountFactor,

                ExpectedBenefit:
                    round(
                        row.expectedBenefit
                    ),

                PresentValue:
                    round(
                        row.presentValue
                    )
            })
        );
    }


    /* =========================================================
       28. ENGINE API
    ========================================================= */

    const Engine = {

        version:
            VERSION,

        defaults:
            clone(DEFAULTS),

        utils: {

            toNumber,

            percentage,

            clamp,

            round,

            safeDivide,

            parseDate,

            yearsBetween,

            completedYears,

            ageAtDate,

            addYears
        },

        assumptions: {

            normalize:
                normalizeAssumptions,

            buildDiscountCurve
        },

        employee: {

            normalize:
                normalizeEmployee,

            validate:
                validateEmployee
        },

        demographic: {

            mortality:
                mortalityProbability,

            turnover:
                turnoverProbability,

            disability:
                disabilityProbability,

            retirement:
                retirementProbability,

            competingDecrements:
                calculateCompetingDecrements
        },

        compensation: {

            salaryProjection,

            ceilingProjection
        },

        benefit: {

            calculate:
                calculateProjectedBenefit
        },

        discount: {

            factor:
                discountFactor,

            rate:
                getDiscountRate
        },

        projection: {

            calculate:
                calculateProjectionPath
        },

        puc: {

            calculate:
                calculatePUC
        },

        valuation: {

            employee:
                calculateEmployee,

            portfolio:
                calculatePortfolio
        },

        accounting: {

            interestCost:
                calculateInterestCost,

            rollForward:
                calculateRollForward,

            actuarialGainLoss:
                calculateActuarialGainLoss,

            dboMovement:
                calculateDBOMovement
        },

        sensitivity: {

            calculate:
                sensitivity,

            full:
                calculateFullSensitivity
        },

        validation: {

            employee:
                validateEmployee,

            portfolio:
                validatePortfolio
        },

        reporting: {

            summary:
                createValuationSummary,

            employee:
                flattenEmployeeResult,

            projection:
                createProjectionExport
        }
    };


    /* =========================================================
       29. GLOBAL EXPORT
    ========================================================= */

    global.TMS19ActuarialEngine =
        Engine;


    /* =========================================================
       30. BACKWARD / DEBUG HELPERS
    ========================================================= */

    global.calculateTMS19Employee =
        function (
            employee,
            assumptions
        ) {

            return Engine.valuation.employee(
                employee,
                assumptions
            );
        };


    global.calculateTMS19Portfolio =
        function (
            employees,
            assumptions
        ) {

            return Engine.valuation.portfolio(
                employees,
                assumptions
            );
        };


    global.calculateTMS19Sensitivity =
        function (
            employees,
            assumptions
        ) {

            return Engine.sensitivity.full(
                employees,
                assumptions
            );
        };


    /* =========================================================
       31. CONSOLE IDENTIFICATION
    ========================================================= */

    if (
        typeof console !== "undefined"
    ) {

        console.log(
            `%cGK Advisory TMS 19 Actuarial Engine v${VERSION} loaded`,
            "font-weight:bold;color:#B08D57;"
        );
    }


})(window);
