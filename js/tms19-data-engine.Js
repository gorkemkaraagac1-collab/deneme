/* ============================================================
   GK ADVISORY
   TMS 19 — AKTÜERYAL VERİ YÖNETİM MOTORU
   ------------------------------------------------------------
   Amaç:
   - CSV personel verisi almak
   - Türkçe / İngilizce kolonları tanımak
   - Verileri standardize etmek
   - Veri kalitesi kontrolü yapmak
   - Hatalı / eksik kayıtları ayırmak
   - Aktüeryal engine'e hazır veri üretmek

   Not:
   Bu dosya aktüeryal hesaplama motoru değildir.
   Veri hazırlama ve kontrol katmanıdır.
============================================================ */

(function (window) {

    "use strict";


    /* ========================================================
       ANA MOTOR
    ======================================================== */

    const DataEngine = {


        employees: [],

        validEmployees: [],

        warningEmployees: [],

        invalidEmployees: [],

        qualityResult: null,


        /* ====================================================
           KOLON ALIASLARI
        ==================================================== */

        columnAliases: {

            employeeNumber: [
                "sicil",
                "sicilno",
                "sicil_no",
                "employee",
                "employeeid",
                "employee_id",
                "employeenumber",
                "personelno",
                "personel_no",
                "id"
            ],

            name: [
                "ad",
                "soyad",
                "adsoyad",
                "ad_soyad",
                "personel",
                "personeladi",
                "personel_adi",
                "name",
                "fullname",
                "employee_name"
            ],

            department: [
                "departman",
                "department",
                "bolum",
                "bölüm",
                "birim",
                "unit"
            ],

            gender: [
                "cinsiyet",
                "gender",
                "sex"
            ],

            currentAge: [
                "yas",
                "yaş",
                "age",
                "currentage",
                "current_age",
                "mevcutyas"
            ],

            yearsOfService: [
                "hizmet",
                "hizmetsuresi",
                "hizmet_suresi",
                "hizmetyili",
                "hizmet_yili",
                "service",
                "serviceyears",
                "service_years",
                "yearsofservice"
            ],

            currentAnnualSalary: [
                "maas",
                "maaş",
                "yillikmaas",
                "yillik_maas",
                "yillikbrutmaas",
                "yillik_brut_maas",
                "salary",
                "annualsalary",
                "annual_salary",
                "grosssalary"
            ],

            openingDBO: [
                "acilisdbo",
                "acilis_dbo",
                "dboacilis",
                "openingdbo",
                "opening_dbo",
                "openingobligation"
            ],

            planAssets: [
                "planvarliklari",
                "plan_varliklari",
                "planvarligi",
                "plan_assets",
                "planassets",
                "fairvalueplanassets"
            ],

            benefitPayments: [
                "faydaodemeleri",
                "fayda_odemeleri",
                "odemeler",
                "ödemeler",
                "benefitpayments",
                "benefit_payments",
                "payments"
            ],

            retirementAge: [
                "emeklilikyasi",
                "emeklilik_yasi",
                "retirementage",
                "retirement_age"
            ],

            discountRate: [
                "iskontoorani",
                "iskonto_orani",
                "iskonto",
                "discountrate",
                "discount_rate"
            ],

            salaryIncreaseRate: [
                "maasartis",
                "maasartisorani",
                "maas_artis_orani",
                "maaşartışı",
                "salaryincrease",
                "salaryincreaserate",
                "salary_increase_rate"
            ],

            inflationRate: [
                "enflasyon",
                "enflasyonorani",
                "enflasyon_orani",
                "inflation",
                "inflationrate",
                "inflation_rate"
            ],

            turnoverRate: [
                "turnover",
                "turnoverrate",
                "turnover_rate",
                "devir",
                "devirorani",
                "devir_orani",
                "personeldevir"
            ],

            benefitRate: [
                "faydaorani",
                "fayda_orani",
                "benefitrate",
                "benefit_rate"
            ]

        },


        /* ====================================================
           METİN NORMALİZASYONU
        ==================================================== */

        normalizeText(value) {

            if (
                value === null ||
                value === undefined
            ) {

                return "";

            }


            return String(value)
                .trim()
                .toLowerCase()
                .replace(/ı/g, "i")
                .replace(/ğ/g, "g")
                .replace(/ü/g, "u")
                .replace(/ş/g, "s")
                .replace(/ö/g, "o")
                .replace(/ç/g, "c")
                .replace(/[\s\-\.\/]+/g, "_")
                .replace(/[^a-z0-9_]/g, "");

        },


        /* ====================================================
           NUMERİK DEĞER
        ==================================================== */

        toNumber(value) {

            if (
                value === null ||
                value === undefined ||
                value === ""
            ) {

                return null;

            }


            if (
                typeof value === "number"
            ) {

                return Number.isFinite(value)
                    ? value
                    : null;

            }


            let text =
                String(value)
                    .trim()
                    .replace(/\s/g, "");


            /*
               Türkçe Excel formatı:

               1.250.000,50

               İngilizce:

               1,250,000.50
            */

            if (
                text.includes(",") &&
                text.includes(".")
            ) {

                if (
                    text.lastIndexOf(",") >
                    text.lastIndexOf(".")
                ) {

                    text =
                        text
                            .replace(/\./g, "")
                            .replace(",", ".");

                }
                else {

                    text =
                        text
                            .replace(/,/g, "");

                }

            }

            else if (
                text.includes(",")
            ) {

                text =
                    text.replace(",", ".");

            }


            text =
                text.replace(
                    /[^0-9.\-]/g,
                    ""
                );


            const number =
                Number(text);


            return Number.isFinite(number)
                ? number
                : null;

        },


        /* ====================================================
           ORAN NORMALİZASYONU
        ==================================================== */

        toRate(value) {

            const number =
                this.toNumber(value);


            if (
                number === null
            ) {

                return null;

            }


            /*
               30 → %30
               0.30 → %30
            */

            if (
                Math.abs(number) > 1
            ) {

                return number / 100;

            }


            return number;

        },


        /* ====================================================
           KOLON EŞLEŞTİRME
        ==================================================== */

        mapColumns(headers) {

            const mapping = {};


            headers.forEach(
                header => {

                    const normalized =
                        this.normalizeText(
                            header
                        );


                    Object.entries(
                        this.columnAliases
                    )
                    .forEach(
                        (
                            [
                                field,
                                aliases
                            ]
                        ) => {

                            const normalizedAliases =
                                aliases.map(
                                    alias =>
                                        this.normalizeText(
                                            alias
                                        )
                                );


                            if (
                                normalizedAliases
                                    .includes(
                                        normalized
                                    )
                            ) {

                                if (
                                    !mapping[field]
                                ) {

                                    mapping[field] =
                                        header;

                                }

                            }

                        }
                    );

                }
            );


            return mapping;

        },


        /* ====================================================
           HAM KAYDI STANDARDİZE ET
        ==================================================== */

        normalizeEmployee(
            raw,
            mapping
        ) {

            const get =
                field => {

                    const column =
                        mapping[field];

                    return column
                        ? raw[column]
                        : null;

                };


            return {

                employeeNumber:
                    get(
                        "employeeNumber"
                    ),

                name:
                    get(
                        "name"
                    ),

                department:
                    get(
                        "department"
                    ),

                gender:
                    get(
                        "gender"
                    ),

                currentAge:
                    this.toNumber(
                        get(
                            "currentAge"
                        )
                    ),

                yearsOfService:
                    this.toNumber(
                        get(
                            "yearsOfService"
                        )
                    ),

                currentAnnualSalary:
                    this.toNumber(
                        get(
                            "currentAnnualSalary"
                        )
                    ),

                openingDBO:
                    this.toNumber(
                        get(
                            "openingDBO"
                        )
                    ) || 0,

                planAssets:
                    this.toNumber(
                        get(
                            "planAssets"
                        )
                    ) || 0,

                benefitPayments:
                    this.toNumber(
                        get(
                            "benefitPayments"
                        )
                    ) || 0,

                retirementAge:
                    this.toNumber(
                        get(
                            "retirementAge"
                        )
                    ) || 60,

                discountRate:
                    this.toRate(
                        get(
                            "discountRate"
                        )
                    ),

                salaryIncreaseRate:
                    this.toRate(
                        get(
                            "salaryIncreaseRate"
                        )
                    ),

                inflationRate:
                    this.toRate(
                        get(
                            "inflationRate"
                        )
                    ),

                turnoverRate:
                    this.toRate(
                        get(
                            "turnoverRate"
                        )
                    ),

                benefitRate:
                    this.toRate(
                        get(
                            "benefitRate"
                        )
                    )

            };

        },


        /* ====================================================
           PERSONEL KAYIT KONTROLÜ
        ==================================================== */

        validateEmployee(
            employee,
            index
        ) {

            const errors = [];

            const warnings = [];


            /* SİCİL */

            if (
                !employee.employeeNumber
            ) {

                errors.push(
                    "Sicil numarası eksik."
                );

            }


            /* İSİM */

            if (
                !employee.name
            ) {

                warnings.push(
                    "Personel adı eksik."
                );

            }


            /* YAŞ */

            if (
                employee.currentAge === null
            ) {

                errors.push(
                    "Yaş bilgisi eksik."
                );

            }
            else if (
                employee.currentAge < 18 ||
                employee.currentAge > 75
            ) {

                errors.push(
                    "Yaş değeri makul aralık dışında."
                );

            }


            /* HİZMET */

            if (
                employee.yearsOfService === null
            ) {

                errors.push(
                    "Hizmet süresi eksik."
                );

            }
            else if (
                employee.yearsOfService < 0
            ) {

                errors.push(
                    "Hizmet süresi negatif olamaz."
                );

            }


            /* MAAŞ */

            if (
                employee.currentAnnualSalary === null
            ) {

                errors.push(
                    "Yıllık brüt maaş eksik."
                );

            }
            else if (
                employee.currentAnnualSalary < 0
            ) {

                errors.push(
                    "Maaş negatif olamaz."
                );

            }


            /* HİZMET / YAŞ */

            if (
                employee.currentAge !== null &&
                employee.yearsOfService !== null
            ) {

                if (
                    employee.yearsOfService >
                    employee.currentAge - 16
                ) {

                    warnings.push(
                        "Hizmet süresi yaşa göre olağandışı görünüyor."
                    );

                }

            }


            /* EMEKLİLİK */

            if (
                employee.retirementAge <=
                employee.currentAge
            ) {

                warnings.push(
                    "Emeklilik yaşı mevcut yaştan düşük veya eşit."
                );

            }


            /* ORANLAR */

            const rates = [

                [
                    "İskonto oranı",
                    employee.discountRate
                ],

                [
                    "Maaş artış oranı",
                    employee.salaryIncreaseRate
                ],

                [
                    "Enflasyon oranı",
                    employee.inflationRate
                ],

                [
                    "Turnover oranı",
                    employee.turnoverRate
                ]

            ];


            rates.forEach(
                ([name, value]) => {

                    if (
                        value !== null &&
                        (
                            value < 0 ||
                            value > 1
                        )
                    ) {

                        warnings.push(
                            `${name} %0-%100 aralığı dışında.`
                        );

                    }

                }
            );


            return {

                index,

                valid:
                    errors.length === 0,

                warning:
                    errors.length === 0 &&
                    warnings.length > 0,

                errors,

                warnings

            };

        },


        /* ====================================================
           MÜKERRER SİCİL KONTROLÜ
        ==================================================== */

        findDuplicates(
            employees
        ) {

            const seen =
                new Map();

            const duplicates = [];


            employees.forEach(
                (
                    employee,
                    index
                ) => {

                    const id =
                        String(
                            employee.employeeNumber ||
                            ""
                        )
                        .trim();


                    if (!id) {

                        return;

                    }


                    if (
                        seen.has(id)
                    ) {

                        duplicates.push({

                            employeeNumber:
                                id,

                            firstIndex:
                                seen.get(id),

                            duplicateIndex:
                                index

                        });

                    }
                    else {

                        seen.set(
                            id,
                            index
                        );

                    }

                }
            );


            return duplicates;

        },


        /* ====================================================
           VERİ SETİNİ DOĞRULA
        ==================================================== */

        validateDataset(
            employees
        ) {

            const valid = [];

            const warning = [];

            const invalid = [];

            const checks = [];


            const duplicates =
                this.findDuplicates(
                    employees
                );


            employees.forEach(
                (
                    employee,
                    index
                ) => {

                    const validation =
                        this.validateEmployee(
                            employee,
                            index
                        );


                    const duplicate =
                        duplicates.some(
                            x =>
                                x.duplicateIndex ===
                                index
                        );


                    if (
                        duplicate
                    ) {

                        validation.errors.push(
                            "Mükerrer sicil numarası."
                        );

                        validation.valid =
                            false;

                    }


                    const result = {

                        employee,

                        index,

                        ...validation

                    };


                    if (
                        !validation.valid
                    ) {

                        invalid.push(
                            result
                        );

                    }

                    else if (
                        validation.warning
                    ) {

                        warning.push(
                            result
                        );

                    }

                    else {

                        valid.push(
                            result
                        );

                    }


                    checks.push(
                        result
                    );

                }
            );


            const total =
                employees.length;


            const validCount =
                valid.length;


            const warningCount =
                warning.length;


            const invalidCount =
                invalid.length;


            const qualityScore =
                total === 0
                    ? 0
                    :
                    (
                        (
                            validCount +
                            warningCount * 0.5
                        )
                        /
                        total
                    ) * 100;


            let qualityLevel =
                "Kritik";


            if (
                qualityScore >= 95
            ) {

                qualityLevel =
                    "Mükemmel";

            }
            else if (
                qualityScore >= 85
            ) {

                qualityLevel =
                    "İyi";

            }
            else if (
                qualityScore >= 70
            ) {

                qualityLevel =
                    "Orta";

            }
            else if (
                qualityScore >= 50
            ) {

                qualityLevel =
                    "Düşük";

            }


            this.validEmployees =
                valid.map(
                    x =>
                        x.employee
                );


            this.warningEmployees =
                warning.map(
                    x =>
                        x.employee
                );


            this.invalidEmployees =
                invalid.map(
                    x =>
                        x.employee
                );


            this.qualityResult = {

                total,

                validCount,

                warningCount,

                invalidCount,

                duplicateCount:
                    duplicates.length,

                qualityScore,

                qualityLevel,

                checks,

                duplicates,

                readyForActuarial:
                    invalidCount === 0

            };


            return this.qualityResult;

        },


        /* ====================================================
           CSV PARSE
        ==================================================== */

        parseCSV(
            csvText
        ) {

            if (
                !csvText ||
                !csvText.trim()
            ) {

                throw new Error(
                    "CSV verisi boş."
                );

            }


            const lines =
                csvText
                    .split(/\r?\n/)
                    .filter(
                        line =>
                            line.trim()
                    );


            if (
                lines.length < 2
            ) {

                throw new Error(
                    "CSV dosyasında yeterli veri bulunmuyor."
                );

            }


            const headers =
                this.parseCSVLine(
                    lines[0]
                );


            const rawEmployees = [];


            for (
                let i = 1;
                i < lines.length;
                i++
            ) {

                const values =
                    this.parseCSVLine(
                        lines[i]
                    );


                if (
                    values.every(
                        value =>
                            !String(
                                value || ""
                            ).trim()
                    )
                ) {

                    continue;

                }


                const raw = {};


                headers.forEach(
                    (
                        header,
                        index
                    ) => {

                        raw[header] =
                            values[index] ??
                            "";

                    }
                );


                rawEmployees.push(
                    raw
                );

            }


            const mapping =
                this.mapColumns(
                    headers
                );


            const employees =
                rawEmployees.map(
                    raw =>
                        this.normalizeEmployee(
                            raw,
                            mapping
                        )
                );


            this.employees =
                employees;


            const quality =
                this.validateDataset(
                    employees
                );


            return {

                employees,

                mapping,

                quality

            };

        },


        /* ====================================================
           CSV SATIR PARSER
        ==================================================== */

        parseCSVLine(
            line
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
                    char === "," &&
                    !insideQuotes
                ) {

                    result.push(
                        current.trim()
                    );

                    current = "";

                }

                else {

                    current += char;

                }

            }


            result.push(
                current.trim()
            );


            return result;

        },


        /* ====================================================
           AKTÜERYAL ENGINE'E HAZIR VERİ
        ==================================================== */

        getActuarialDataset() {

            if (
                !this.qualityResult
            ) {

                this.validateDataset(
                    this.employees
                );

            }


            return [
                ...this.validEmployees
            ];

        },


        /* ====================================================
           VERİ ÖZETİ
        ==================================================== */

        getSummary() {

            if (
                !this.qualityResult
            ) {

                return {

                    total: 0,

                    valid: 0,

                    warning: 0,

                    invalid: 0,

                    qualityScore: 0,

                    qualityLevel:
                        "Veri Yok",

                    readyForActuarial:
                        false

                };

            }


            return {

                total:
                    this.qualityResult.total,

                valid:
                    this.qualityResult.validCount,

                warning:
                    this.qualityResult.warningCount,

                invalid:
                    this.qualityResult.invalidCount,

                duplicates:
                    this.qualityResult.duplicateCount,

                qualityScore:
                    this.qualityResult.qualityScore,

                qualityLevel:
                    this.qualityResult.qualityLevel,

                readyForActuarial:
                    this.qualityResult
                        .readyForActuarial

            };

        },


        /* ====================================================
           DEMO VERİ
        ==================================================== */

        createSampleDataset(
            count = 25
        ) {

            const departments = [

                "Finans",

                "Satış",

                "Operasyon",

                "İnsan Kaynakları",

                "Üretim",

                "Bilgi Teknolojileri"

            ];


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
                            Math.random() * 12
                        ),
                        Math.max(
                            age - 18,
                            0
                        )
                    );


                const salary =
                    450000 +
                    Math.floor(
                        Math.random() *
                        1250000
                    );


                employees.push({

                    employeeNumber:
                        `P-${String(i)
                            .padStart(5, "0")}`,

                    name:
                        `Personel ${i}`,

                    department:
                        departments[
                            i %
                            departments.length
                        ],

                    gender:
                        i % 2 === 0
                            ? "E"
                            : "K",

                    currentAge:
                        age,

                    yearsOfService:
                        service,

                    currentAnnualSalary:
                        salary,

                    openingDBO:
                        Math.round(
                            salary *
                            0.10 *
                            service
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


            this.employees =
                employees;


            this.validateDataset(
                employees
            );


            return {

                employees,

                quality:
                    this.qualityResult

            };

        },


        /* ====================================================
           JSON DIŞARI AKTAR
        ==================================================== */

        exportJSON() {

            return JSON.stringify(
                this.employees,
                null,
                2
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


        formatPercent(
            value
        ) {

            return (
                Number(value || 0) *
                100
            ).toFixed(1) + "%";

        }

    };


    /* ========================================================
       GLOBAL
    ======================================================== */

    window.TMS19DataEngine =
        DataEngine;


})(window);
