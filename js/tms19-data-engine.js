/* =========================================================
   GK ADVISORY
   TMS 19 — PERSONEL VERİ MOTORU
   tms19-data-engine.js

   Amaç:
   - CSV / JSON personel verisini almak
   - Alanları normalize etmek
   - Tarihleri standartlaştırmak
   - Veri kalite kontrolleri yapmak
   - Aktüeryal motor için temiz veri üretmek
   - Denetim izi / veri kalite özeti oluşturmak

   NOT:
   Bu dosya aktüeryal hesaplamayı yapmaz.
   Hesaplama:
   tms19-actuarial-engine.js

   Portföy analizi:
   tms19-portfolio-engine.js
========================================================= */

(function (global) {

    "use strict";


    /* =====================================================
       YARDIMCI FONKSİYONLAR
    ===================================================== */

    function temizle(value) {

        if (
            value === null ||
            value === undefined
        ) {
            return "";
        }

        return String(value)
            .trim();

    }


    function sayiyaCevir(value) {

        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {
            return 0;
        }

        if (
            typeof value === "number"
        ) {
            return value;
        }

        let text =
            String(value)
                .trim();

        /*
         * Türkçe format:
         * 1.250.000,50
         */

        if (
            text.includes(",") &&
            text.includes(".")
        ) {

            text =
                text
                    .replace(/\./g, "")
                    .replace(",", ".");

        }
        else if (
            text.includes(",")
        ) {

            text =
                text.replace(",", ".");

        }

        text =
            text.replace(
                /[^0-9.-]/g,
                ""
            );

        const number =
            Number(text);

        return Number.isFinite(number)
            ? number
            : 0;

    }


    function tarihCevir(value) {

        if (!value) {
            return null;
        }


        if (
            value instanceof Date
        ) {

            return isNaN(
                value.getTime()
            )
                ? null
                : value;

        }


        const text =
            String(value)
                .trim();


        /*
         * DD.MM.YYYY
         */

        const trMatch =
            text.match(
                /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/
            );


        if (trMatch) {

            const day =
                Number(trMatch[1]);

            const month =
                Number(trMatch[2]) - 1;

            const year =
                Number(trMatch[3]);

            const date =
                new Date(
                    year,
                    month,
                    day
                );

            return isNaN(
                date.getTime()
            )
                ? null
                : date;

        }


        /*
         * YYYY-MM-DD
         */

        const isoMatch =
            text.match(
                /^(\d{4})-(\d{1,2})-(\d{1,2})$/
            );


        if (isoMatch) {

            const date =
                new Date(
                    Number(isoMatch[1]),
                    Number(isoMatch[2]) - 1,
                    Number(isoMatch[3])
                );

            return isNaN(
                date.getTime()
            )
                ? null
                : date;

        }


        const parsed =
            new Date(text);


        return isNaN(
            parsed.getTime()
        )
            ? null
            : parsed;

    }


    function tarihISO(value) {

        const date =
            tarihCevir(value);


        if (!date) {
            return "";
        }


        const year =
            date.getFullYear();


        const month =
            String(
                date.getMonth() + 1
            )
                .padStart(2, "0");


        const day =
            String(
                date.getDate()
            )
                .padStart(2, "0");


        return (
            year +
            "-" +
            month +
            "-" +
            day
        );

    }


    function yasHesapla(
        birthDate,
        valuationDate
    ) {

        const birth =
            tarihCevir(
                birthDate
            );


        const valuation =
            tarihCevir(
                valuationDate
            );


        if (
            !birth ||
            !valuation
        ) {

            return 0;

        }


        let age =
            valuation.getFullYear() -
            birth.getFullYear();


        const monthDifference =
            valuation.getMonth() -
            birth.getMonth();


        if (
            monthDifference < 0 ||
            (
                monthDifference === 0 &&
                valuation.getDate() <
                birth.getDate()
            )
        ) {

            age--;

        }


        return age;

    }


    function hizmetSuresiHesapla(
        startDate,
        valuationDate
    ) {

        const start =
            tarihCevir(
                startDate
            );


        const valuation =
            tarihCevir(
                valuationDate
            );


        if (
            !start ||
            !valuation
        ) {

            return 0;

        }


        const difference =
            valuation.getTime() -
            start.getTime();


        const years =
            difference /
            (
                1000 *
                60 *
                60 *
                24 *
                365.25
            );


        return Math.max(
            0,
            years
        );

    }


    function normalizasyonAnahtari(
        value
    ) {

        return temizle(value)
            .toLowerCase()
            .replace(
                /ı/g,
                "i"
            )
            .replace(
                /ğ/g,
                "g"
            )
            .replace(
                /ü/g,
                "u"
            )
            .replace(
                /ş/g,
                "s"
            )
            .replace(
                /ö/g,
                "o"
            )
            .replace(
                /ç/g,
                "c"
            )
            .replace(
                /[^a-z0-9]/g,
                ""
            );

    }


    /* =====================================================
       ALAN EŞLEŞTİRME
    ===================================================== */

    const FIELD_ALIASES = {

        employeeId: [
            "sicilno",
            "sicil",
            "employeeid",
            "employee_id",
            "id",
            "personelno",
            "personelid"
        ],

        name: [
            "adsoyad",
            "adsoyadı",
            "isim",
            "name",
            "fullname",
            "calisan",
            "personel"
        ],

        birthDate: [
            "dogumtarihi",
            "doğumtarihi",
            "birthdate",
            "birth_date",
            "dogum"
        ],

        hireDate: [
            "isegiristarihi",
            "işegiriştarihi",
            "hiredate",
            "hire_date",
            "startdate",
            "employmentdate"
        ],

        department: [
            "departman",
            "department",
            "bolum",
            "bölüm",
            "organizasyon"
        ],

        gender: [
            "cinsiyet",
            "gender",
            "sex"
        ],

        salary: [
            "brutmaas",
            "brütmaaş",
            "maas",
            "maaş",
            "salary",
            "grosssalary",
            "gross_salary"
        ],

        annualSalary: [
            "yillikbrutmaas",
            "yıllıkbrütmaaş",
            "annualsalary",
            "annual_salary",
            "yillikmaas",
            "yıllıkmaaş"
        ],

        retirementAge: [
            "emeklilikyasi",
            "emeklilikyaşı",
            "retirementage",
            "retirement_age"
        ],

        openingDBO: [
            "openingdbo",
            "opening_dbo",
            "acilisdbo",
            "açılışdbo",
            "oncekidbo",
            "öncekidbo"
        ],

        openingPlanAsset: [
            "openingplanasset",
            "opening_plan_asset",
            "acilisplanvarligi",
            "açılışplanvarlığı"
        ],

        benefitRate: [
            "faydaorani",
            "faydaoranı",
            "benefitrate",
            "benefit_rate"
        ],

        serviceYears: [
            "hizmetsuresi",
            "hizmetyılı",
            "hizmetyili",
            "serviceyears",
            "service_years"
        ]

    };


    function alanBul(
        row,
        aliases
    ) {

        const keys =
            Object.keys(row);


        for (
            let i = 0;
            i < aliases.length;
            i++
        ) {

            const alias =
                normalizasyonAnahtari(
                    aliases[i]
                );


            for (
                let j = 0;
                j < keys.length;
                j++
            ) {

                const normalizedKey =
                    normalizasyonAnahtari(
                        keys[j]
                    );


                if (
                    normalizedKey ===
                    alias
                ) {

                    return row[keys[j]];

                }

            }

        }


        return "";

    }


    /* =====================================================
       TEK PERSONEL NORMALİZASYONU
    ===================================================== */

    function personelNormalizeEt(
        row,
        options
    ) {

        options =
            options || {};


        const valuationDate =
            tarihCevir(
                options.valuationDate
            ) ||
            new Date();


        const employeeId =
            temizle(
                alanBul(
                    row,
                    FIELD_ALIASES.employeeId
                )
            );


        const name =
            temizle(
                alanBul(
                    row,
                    FIELD_ALIASES.name
                )
            );


        const birthDate =
            tarihCevir(
                alanBul(
                    row,
                    FIELD_ALIASES.birthDate
                )
            );


        const hireDate =
            tarihCevir(
                alanBul(
                    row,
                    FIELD_ALIASES.hireDate
                )
            );


        const department =
            temizle(
                alanBul(
                    row,
                    FIELD_ALIASES.department
                )
            ) ||
            "Belirtilmemiş";


        const gender =
            temizle(
                alanBul(
                    row,
                    FIELD_ALIASES.gender
                )
            ) ||
            "Belirtilmemiş";


        let annualSalary =
            sayiyaCevir(
                alanBul(
                    row,
                    FIELD_ALIASES.annualSalary
                )
            );


        const monthlySalary =
            sayiyaCevir(
                alanBul(
                    row,
                    FIELD_ALIASES.salary
                )
            );


        if (
            annualSalary <= 0 &&
            monthlySalary > 0
        ) {

            annualSalary =
                monthlySalary * 12;

        }


        const retirementAgeRaw =
            sayiyaCevir(
                alanBul(
                    row,
                    FIELD_ALIASES.retirementAge
                )
            );


        const retirementAge =
            retirementAgeRaw > 0
                ? retirementAgeRaw
                : (
                    options.defaultRetirementAge ||
                    60
                );


        const openingDBO =
            sayiyaCevir(
                alanBul(
                    row,
                    FIELD_ALIASES.openingDBO
                )
            );


        const openingPlanAsset =
            sayiyaCevir(
                alanBul(
                    row,
                    FIELD_ALIASES.openingPlanAsset
                )
            );


        const benefitRateRaw =
            sayiyaCevir(
                alanBul(
                    row,
                    FIELD_ALIASES.benefitRate
                )
            );


        const benefitRate =
            benefitRateRaw > 1
                ? benefitRateRaw / 100
                : benefitRateRaw;


        const calculatedAge =
            yasHesapla(
                birthDate,
                valuationDate
            );


        const calculatedService =
            hizmetSuresiHesapla(
                hireDate,
                valuationDate
            );


        const importedService =
            sayiyaCevir(
                alanBul(
                    row,
                    FIELD_ALIASES.serviceYears
                )
            );


        const serviceYears =
            importedService > 0
                ? importedService
                : calculatedService;


        return {

            employeeId:
                employeeId ||
                (
                    "AUTO-" +
                    Date.now() +
                    "-" +
                    Math.floor(
                        Math.random() * 100000
                    )
                ),

            name:
                name ||
                "İsimsiz Personel",

            birthDate:
                tarihISO(
                    birthDate
                ),

            hireDate:
                tarihISO(
                    hireDate
                ),

            department:
                department,

            gender:
                gender,

            salary:
                annualSalary,

            annualSalary:
                annualSalary,

            monthlySalary:
                annualSalary / 12,

            age:
                calculatedAge,

            service:
                serviceYears,

            serviceYears:
                serviceYears,

            retirementAge:
                retirementAge,

            remainingService:
                Math.max(
                    0,
                    retirementAge -
                    calculatedAge
                ),

            openingDBO:
                openingDBO,

            openingPlanAsset:
                openingPlanAsset,

            benefitRate:
                benefitRate,

            valuationDate:
                tarihISO(
                    valuationDate
                ),

            /*
             * Kaynağın orijinal satırını
             * kaybetmiyoruz.
             *
             * Denetim izi açısından önemli.
             */

            sourceData:
                Object.assign(
                    {},
                    row
                )

        };

    }


    /* =====================================================
       PERSONEL LİSTESİ NORMALİZASYONU
    ===================================================== */

    function normalizeEmployees(
        rows,
        options
    ) {

        if (
            !Array.isArray(rows)
        ) {

            throw new Error(
                "Personel verisi bir dizi olmalıdır."
            );

        }


        const normalized =
            rows.map(
                function (
                    row
                ) {

                    return personelNormalizeEt(
                        row,
                        options
                    );

                }
            );


        return normalized;

    }


    /* =====================================================
       VERİ KALİTESİ
    ===================================================== */

    function validateEmployees(
        employees
    ) {

        const issues = [];

        let criticalCount = 0;

        let warningCount = 0;

        let validCount = 0;


        employees.forEach(
            function (
                employee,
                index
            ) {

                const rowNumber =
                    index + 1;


                const employeeIssues =
                    [];


                if (
                    !employee.name ||
                    employee.name ===
                    "İsimsiz Personel"
                ) {

                    employeeIssues.push(
                        "Ad soyad eksik"
                    );

                }


                if (
                    !employee.birthDate
                ) {

                    employeeIssues.push(
                        "Doğum tarihi eksik"
                    );

                }


                if (
                    !employee.hireDate
                ) {

                    employeeIssues.push(
                        "İşe giriş tarihi eksik"
                    );

                }


                if (
                    employee.salary <= 0
                ) {

                    employeeIssues.push(
                        "Brüt yıllık maaş eksik veya sıfır"
                    );

                }


                if (
                    employee.age < 16 ||
                    employee.age > 75
                ) {

                    employeeIssues.push(
                        "Yaş olağandışı"
                    );

                }


                if (
                    employee.serviceYears < 0
                ) {

                    employeeIssues.push(
                        "Hizmet süresi negatif"
                    );

                }


                if (
                    employee.retirementAge <=
                    employee.age
                ) {

                    employeeIssues.push(
                        "Emeklilik yaşı mevcut yaştan küçük veya eşit"
                    );

                }


                if (
                    employee.openingDBO < 0
                ) {

                    employeeIssues.push(
                        "Opening DBO negatif"
                    );

                }


                if (
                    employeeIssues.length === 0
                ) {

                    validCount++;

                }
                else {

                    warningCount++;

                }


                employee.validation =
                    {

                        valid:
                            employeeIssues.length === 0,

                        issues:
                            employeeIssues,

                        row:
                            rowNumber

                    };

            }
        );


        /*
         * Kritik veri kontrolleri
         */

        const ids =
            new Set();


        employees.forEach(
            function (
                employee
            ) {

                if (
                    ids.has(
                        employee.employeeId
                    )
                ) {

                    criticalCount++;

                    employee.validation.valid =
                        false;

                    employee.validation.issues.push(
                        "Mükerrer personel sicil numarası"
                    );

                }


                ids.add(
                    employee.employeeId
                );

            }
        );


        const total =
            employees.length;


        const completeness =
            total === 0
                ? 0
                : (
                    validCount /
                    total
                ) * 100;


        let level =
            "Kritik";


        if (
            completeness >= 98 &&
            criticalCount === 0
        ) {

            level =
                "Mükemmel";

        }
        else if (
            completeness >= 95 &&
            criticalCount === 0
        ) {

            level =
                "Yüksek";

        }
        else if (
            completeness >= 85
        ) {

            level =
                "Orta";

        }
        else if (
            completeness >= 70
        ) {

            level =
                "Düşük";

        }


        return {

            totalRecords:
                total,

            validRecords:
                validCount,

            warningRecords:
                warningCount,

            criticalRecords:
                criticalCount,

            completeness:
                Number(
                    completeness.toFixed(2)
                ),

            level:
                level,

            issues:
                employees
                    .filter(
                        employee =>
                            !employee.validation.valid
                    )
                    .map(
                        employee => ({
                            employeeId:
                                employee.employeeId,

                            name:
                                employee.name,

                            issues:
                                employee.validation
                                    .issues
                        })
                    )

        };

    }


    /* =====================================================
       DUPLICATE KONTROLÜ
    ===================================================== */

    function duplicateKontrolu(
        employees
    ) {

        const map =
            new Map();


        employees.forEach(
            function (
                employee
            ) {

                const id =
                    employee.employeeId;


                if (
                    !map.has(id)
                ) {

                    map.set(
                        id,
                        []
                    );

                }


                map.get(id).push(
                    employee
                );

            }
        );


        const duplicates = [];


        map.forEach(
            function (
                records,
                id
            ) {

                if (
                    records.length > 1
                ) {

                    duplicates.push({

                        employeeId:
                            id,

                        count:
                            records.length,

                        names:
                            records.map(
                                x =>
                                    x.name
                            )

                    });

                }

            }
        );


        return duplicates;

    }


    /* =====================================================
       PORTFÖY ÖZETİ
    ===================================================== */

    function portfolioSummary(
        employees
    ) {

        const totalSalary =
            employees.reduce(
                (
                    sum,
                    employee
                ) =>
                    sum +
                    employee.annualSalary,
                0
            );


        const totalDBO =
            employees.reduce(
                (
                    sum,
                    employee
                ) =>
                    sum +
                    employee.openingDBO,
                0
            );


        const totalEmployees =
            employees.length;


        const averageAge =
            totalEmployees === 0
                ? 0
                : employees.reduce(
                    (
                        sum,
                        employee
                    ) =>
                        sum +
                        employee.age,
                    0
                ) /
                totalEmployees;


        const averageService =
            totalEmployees === 0
                ? 0
                : employees.reduce(
                    (
                        sum,
                        employee
                    ) =>
                        sum +
                        employee.serviceYears,
                    0
                ) /
                totalEmployees;


        const departments =
            {};


        employees.forEach(
            function (
                employee
            ) {

                const department =
                    employee.department;


                if (
                    !departments[
                        department
                    ]
                ) {

                    departments[
                        department
                    ] = {

                        employeeCount:
                            0,

                        salary:
                            0,

                        dbo:
                            0

                    };

                }


                departments[
                    department
                ].employeeCount++;


                departments[
                    department
                ].salary +=
                    employee.annualSalary;


                departments[
                    department
                ].dbo +=
                    employee.openingDBO;

            }
        );


        return {

            employeeCount:
                totalEmployees,

            totalSalary:
                totalSalary,

            totalOpeningDBO:
                totalDBO,

            averageAge:
                Number(
                    averageAge.toFixed(2)
                ),

            averageService:
                Number(
                    averageService.toFixed(2)
                ),

            dboToSalary:
                totalSalary === 0
                    ? 0
                    : Number(
                        (
                            totalDBO /
                            totalSalary
                        ).toFixed(4)
                    ),

            departments:
                departments

        };

    }


    /* =====================================================
       CSV PARSER
    ===================================================== */

    function parseCSV(
        csvText,
        delimiter
    ) {

        if (
            typeof csvText !==
            "string"
        ) {

            throw new Error(
                "CSV içeriği metin formatında olmalıdır."
            );

        }


        delimiter =
            delimiter ||
            detectDelimiter(
                csvText
            );


        const rows = [];

        let current = [];

        let value = "";

        let insideQuotes =
            false;


        for (
            let i = 0;
            i < csvText.length;
            i++
        ) {

            const char =
                csvText[i];


            const next =
                csvText[i + 1];


            if (
                char === '"' &&
                next === '"'
            ) {

                value += '"';

                i++;

                continue;

            }


            if (
                char === '"'
            ) {

                insideQuotes =
                    !insideQuotes;

                continue;

            }


            if (
                char === delimiter &&
                !insideQuotes
            ) {

                current.push(
                    value
                );

                value = "";

                continue;

            }


            if (
                (
                    char === "\n" ||
                    char === "\r"
                ) &&
                !insideQuotes
            ) {

                if (
                    char === "\r" &&
                    next === "\n"
                ) {

                    i++;

                }


                current.push(
                    value
                );

                value = "";


                if (
                    current.some(
                        cell =>
                            String(
                                cell
                            ).trim() !== ""
                    )
                ) {

                    rows.push(
                        current
                    );

                }


                current = [];

                continue;

            }


            value += char;

        }


        if (
            value !== "" ||
            current.length > 0
        ) {

            current.push(
                value
            );

            rows.push(
                current
            );

        }


        if (
            rows.length < 2
        ) {

            return [];

        }


        const headers =
            rows[0].map(
                header =>
                    String(
                        header
                    ).trim()
            );


        return rows
            .slice(1)
            .map(
                function (
                    row
                ) {

                    const object = {};


                    headers.forEach(
                        function (
                            header,
                            index
                        ) {

                            object[
                                header
                            ] =
                                row[index] ??
                                "";

                        }
                    );


                    return object;

                }
            );

    }


    function detectDelimiter(
        csvText
    ) {

        const firstLine =
            csvText.split(
                /\r?\n/
            )[0] ||
            "";


        const candidates = [
            ";",
            ",",
            "\t",
            "|"
        ];


        let best =
            ",";

        let max =
            0;


        candidates.forEach(
            function (
                delimiter
            ) {

                const count =
                    firstLine.split(
                        delimiter
                    ).length - 1;


                if (
                    count > max
                ) {

                    max =
                        count;

                    best =
                        delimiter;

                }

            }
        );


        return best;

    }


    /* =====================================================
       CSV'DEN PERSONEL IMPORT
    ===================================================== */

    function importCSV(
        csvText,
        options
    ) {

        const rawRows =
            parseCSV(
                csvText
            );


        const employees =
            normalizeEmployees(
                rawRows,
                options
            );


        const validation =
            validateEmployees(
                employees
            );


        const duplicates =
            duplicateKontrolu(
                employees
            );


        return {

            employees:
                employees,

            validation:
                validation,

            duplicates:
                duplicates,

            summary:
                portfolioSummary(
                    employees
                ),

            importedAt:
                new Date().toISOString(),

            source:
                "CSV"

        };

    }


    /* =====================================================
       JSON IMPORT
    ===================================================== */

    function importJSON(
        json,
        options
    ) {

        let rows =
            json;


        if (
            typeof json ===
            "string"
        ) {

            rows =
                JSON.parse(
                    json
                );

        }


        if (
            !Array.isArray(rows)
        ) {

            if (
                Array.isArray(
                    rows.employees
                )
            ) {

                rows =
                    rows.employees;

            }
            else {

                throw new Error(
                    "JSON personel listesi bulunamadı."
                );

            }

        }


        const employees =
            normalizeEmployees(
                rows,
                options
            );


        const validation =
            validateEmployees(
                employees
            );


        return {

            employees:
                employees,

            validation:
                validation,

            duplicates:
                duplicateKontrolu(
                    employees
                ),

            summary:
                portfolioSummary(
                    employees
                ),

            importedAt:
                new Date().toISOString(),

            source:
                "JSON"

        };

    }


    /* =====================================================
       DEMO VERİ ÜRETİCİ
    ===================================================== */

    function generateDemoData(
        count
    ) {

        count =
            Number(count) ||
            100;


        const departments = [

            "Finans",

            "İnsan Kaynakları",

            "Operasyon",

            "Satış",

            "Pazarlama",

            "Bilgi Teknolojileri",

            "Hukuk",

            "Tedarik Zinciri"

        ];


        const names = [

            "Ahmet Yılmaz",

            "Ayşe Demir",

            "Mehmet Kaya",

            "Zeynep Şahin",

            "Can Aydın",

            "Elif Arslan",

            "Burak Çelik",

            "Selin Koç",

            "Murat Özkan",

            "Derya Akın"

        ];


        const employees = [];


        for (
            let i = 0;
            i < count;
            i++
        ) {

            const age =
                25 +
                Math.floor(
                    Math.random() * 33
                );


            const service =
                Math.min(
                    age - 22,
                    Math.max(
                        1,
                        Math.floor(
                            Math.random() * 15
                        )
                    )
                );


            const birthYear =
                new Date()
                    .getFullYear() -
                age;


            const hireYear =
                new Date()
                    .getFullYear() -
                Math.floor(
                    service
                );


            const salary =
                350000 +
                Math.floor(
                    Math.random() *
                    750000
                );


            const name =
                names[
                    i %
                    names.length
                ] +
                " " +
                (
                    i + 1
                );


            employees.push({

                SicilNo:
                    "P" +
                    String(
                        i + 1
                    )
                    .padStart(
                        5,
                        "0"
                    ),

                AdSoyad:
                    name,

                DogumTarihi:
                    `${birthYear}-01-15`,

                IseGirisTarihi:
                    `${hireYear}-01-01`,

                Departman:
                    departments[
                        i %
                        departments.length
                    ],

                Cinsiyet:
                    i % 2 === 0
                        ? "E"
                        : "K",

                BrutMaas:
                    salary,

                EmeklilikYasi:
                    60,

                OpeningDBO:
                    Math.round(
                        salary *
                        service *
                        0.035
                    )

            });

        }


        return importJSON(
            employees
        );

    }


    /* =====================================================
       EXPORT
    ===================================================== */

    global.TMS19DataEngine = {

        normalizeEmployees:
            normalizeEmployees,

        normalizeEmployee:
            personelNormalizeEt,

        validateEmployees:
            validateEmployees,

        duplicateCheck:
            duplicateKontrolu,

        portfolioSummary:
            portfolioSummary,

        parseCSV:
            parseCSV,

        importCSV:
            importCSV,

        importJSON:
            importJSON,

        generateDemoData:
            generateDemoData,

        formatNumber:
            sayiyaCevir,

        parseDate:
            tarihCevir,

        dateToISO:
            tarihISO,

        calculateAge:
            yasHesapla,

        calculateServiceYears:
            hizmetSuresiHesapla

    };


    console.log(
        "TMS 19 Veri Motoru hazır."
    );


})(window);
