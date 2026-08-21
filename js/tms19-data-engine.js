/* ================================================================
   GK FINANCIAL DECISION COCKPIT
   TMS 19 DATA ENGINE
   ----------------------------------------------------------------
   Sürüm    : 2.0.0
   Standart : TMS 19

   SORUMLULUKLAR
   -------------
   ✓ CSV okuma
   ✓ JSON okuma
   ✓ Array veri okuma
   ✓ Kolon eşleştirme
   ✓ Türkçe / İngilizce kolon desteği
   ✓ Tarih normalizasyonu
   ✓ Sayı normalizasyonu
   ✓ Personel standardizasyonu
   ✓ Veri kalite kontrolü
   ✓ Duplicate kontrolü
   ✓ Eksik veri kontrolü
   ✓ Dashboard'a hazır veri üretimi

   BU DOSYA AKTÜERYAL HESAPLAMA YAPMAZ.
================================================================ */

(function (global) {

    "use strict";


    /* ============================================================
       01 — ENGINE
    ============================================================ */

    const DataEngine = {};


    DataEngine.version =
        "2.0.0";


    DataEngine.engineName =
        "GK TMS 19 Data Engine";


    DataEngine.standard =
        "TMS 19";


    /* ============================================================
       02 — VERİ SÖZLÜĞÜ
    ============================================================ */

    const FIELD_ALIASES = {

        personelId: [
            "personelid",
            "personel_id",
            "personel no",
            "personelno",
            "sicil no",
            "sicilno",
            "sicil",
            "employee id",
            "employeeid",
            "employee no",
            "employeeno",
            "id"
        ],


        adSoyad: [
            "adsoyad",
            "ad soyad",
            "ad_soyad",
            "isim",
            "çalışan",
            "calisan",
            "çalışan adı",
            "calisan adi",
            "employee name",
            "employeename",
            "name",
            "full name",
            "fullname"
        ],


        departman: [
            "departman",
            "department",
            "departman adı",
            "departman adi",
            "department name",
            "departmentname",
            "birim",
            "organizasyon"
        ],


        pozisyon: [
            "pozisyon",
            "position",
            "görev",
            "gorev",
            "ünvan",
            "unvan",
            "title",
            "job title",
            "jobtitle"
        ],


        dogumTarihi: [
            "doğum tarihi",
            "dogum tarihi",
            "doğumtarihi",
            "dogumtarihi",
            "dogum_tarihi",
            "birth date",
            "birthdate",
            "birth_date",
            "date of birth",
            "dateofbirth",
            "dob"
        ],


        iseGirisTarihi: [
            "işe giriş tarihi",
            "ise giris tarihi",
            "işe giriş",
            "ise giris",
            "işegiriştarihi",
            "isegiristarihi",
            "ise_giris_tarihi",
            "hire date",
            "hiredate",
            "hire_date",
            "employment date",
            "employmentdate",
            "start date",
            "startdate"
        ],


        mevcutMaas: [
            "mevcut maaş",
            "mevcut maas",
            "mevcutmaaş",
            "mevcutmaas",
            "maaş",
            "maas",
            "brüt maaş",
            "brut maas",
            "brüt ücret",
            "brut ucret",
            "salary",
            "currentsalary",
            "current salary",
            "monthly salary",
            "gross salary"
        ],


        cinsiyet: [
            "cinsiyet",
            "gender",
            "sex"
        ],


        kalanIzin: [
            "kalan izin",
            "kalanizin",
            "izin bakiyesi",
            "izinbakiyesi",
            "remaining leave",
            "remainingleave",
            "leave balance",
            "leavebalance"
        ]
    };


    /* ============================================================
       03 — STRING NORMALİZASYONU
    ============================================================ */

    function normalizeKey(
        value
    ) {

        if (
            value === null ||
            value === undefined
        ) {

            return "";
        }


        return String(value)
            .trim()
            .toLowerCase()
            .normalize("NFD")
            .replace(
                /[\u0300-\u036f]/g,
                ""
            )
            .replace(
                /ı/g,
                "i"
            )
            .replace(
                /[^a-z0-9]/g,
                ""
            );
    }


    function normalizeText(
        value
    ) {

        if (
            value === null ||
            value === undefined
        ) {

            return "";
        }


        return String(value)
            .trim()
            .replace(
                /\s+/g,
                " "
            );
    }


    /* ============================================================
       04 — SAYI PARSE
    ============================================================ */

    function sayi(
        value,
        varsayilan = 0
    ) {

        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {

            return varsayilan;
        }


        if (
            typeof value === "number"
        ) {

            return Number.isFinite(
                value
            )
                ? value
                : varsayilan;
        }


        let text =
            String(value)
                .trim()
                .replace(
                    /\s/g,
                    ""
                );


        /*
         * Türkçe:
         *
         * 1.234.567,89
         */

        if (
            text.includes(".") &&
            text.includes(",")
        ) {

            text =
                text
                    .replace(
                        /\./g,
                        ""
                    )
                    .replace(
                        ",",
                        "."
                    );
        }

        /*
         * 1.234
         *
         * Burada Excel'in binlik ayırıcı
         * kullanmış olabileceğini varsayıyoruz.
         */

        else if (
            /^\d{1,3}(\.\d{3})+$/.test(
                text
            )
        ) {

            text =
                text.replace(
                    /\./g,
                    ""
                );
        }

        else if (
            text.includes(",")
        ) {

            text =
                text.replace(
                    ",",
                    "."
                );
        }


        const result =
            Number(text);


        return Number.isFinite(
            result
        )
            ? result
            : varsayilan;
    }


    /* ============================================================
       05 — TARİH PARSE
    ============================================================ */

    function tarih(
        value
    ) {

        if (
            value instanceof Date
        ) {

            const copy =
                new Date(
                    value.getTime()
                );


            return Number.isNaN(
                copy.getTime()
            )
                ? null
                : copy;
        }


        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {

            return null;
        }


        /*
         * Excel serial date
         */

        if (
            typeof value === "number"
        ) {

            if (
                value > 20000 &&
                value < 60000
            ) {

                const excelEpoch =
                    new Date(
                        Date.UTC(
                            1899,
                            11,
                            30
                        )
                    );


                const result =
                    new Date(
                        excelEpoch.getTime() +
                        value *
                        86400000
                    );


                return result;
            }
        }


        const text =
            String(value)
                .trim();


        /*
         * DD.MM.YYYY
         */

        let match =
            text.match(
                /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/
            );


        if (
            match
        ) {

            const day =
                Number(
                    match[1]
                );


            const month =
                Number(
                    match[2]
                );


            const year =
                Number(
                    match[3]
                );


            const result =
                new Date(
                    year,
                    month - 1,
                    day
                );


            if (
                result.getFullYear() === year &&
                result.getMonth() === month - 1 &&
                result.getDate() === day
            ) {

                return result;
            }


            return null;
        }


        /*
         * YYYY-MM-DD
         */

        match =
            text.match(
                /^(\d{4})-(\d{1,2})-(\d{1,2})$/
            );


        if (
            match
        ) {

            const year =
                Number(
                    match[1]
                );


            const month =
                Number(
                    match[2]
                );


            const day =
                Number(
                    match[3]
                );


            const result =
                new Date(
                    year,
                    month - 1,
                    day
                );


            return (
                result.getFullYear() === year &&
                result.getMonth() === month - 1 &&
                result.getDate() === day
            )
                ? result
                : null;
        }


        /*
         * Native parser
         */

        const result =
            new Date(
                text
            );


        return Number.isNaN(
            result.getTime()
        )
            ? null
            : result;
    }


    /* ============================================================
       06 — TARİH FORMAT
    ============================================================ */

    function tarihFormatla(
        value
    ) {

        const date =
            tarih(
                value
            );


        if (
            !date
        ) {

            return "";
        }


        const day =
            String(
                date.getDate()
            ).padStart(
                2,
                "0"
            );


        const month =
            String(
                date.getMonth() + 1
            ).padStart(
                2,
                "0"
            );


        const year =
            date.getFullYear();


        return (
            day +
            "." +
            month +
            "." +
            year
        );
    }


    /* ============================================================
       07 — ALIAS HARİTASI
    ============================================================ */

    function kolonlariTespitEt(
        headers
    ) {

        const mapping = {};


        const normalizedHeaders =
            headers.map(
                header => ({

                    original:
                        header,

                    normalized:
                        normalizeKey(
                            header
                        )
                })
            );


        Object.entries(
            FIELD_ALIASES
        ).forEach(
            (
                [
                    field,
                    aliases
                ]
            ) => {

                const normalizedAliases =
                    aliases.map(
                        normalizeKey
                    );


                const found =
                    normalizedHeaders.find(
                        header =>
                            normalizedAliases.includes(
                                header.normalized
                            )
                    );


                mapping[field] =
                    found
                        ? found.original
                        : null;
            }
        );


        return mapping;
    }


    /* ============================================================
       08 — STANDARD PERSONEL OBJECT
    ============================================================ */

    function personelNormalizeEt(
        row,
        mapping = null
    ) {

        const map =
            mapping ||
            kolonlariTespitEt(
                Object.keys(
                    row || {}
                )
            );


        const get =
            field => {

                const key =
                    map[field];


                return key
                    ? row[key]
                    : undefined;
            };


        return {

            personelId:
                normalizeText(
                    get(
                        "personelId"
                    )
                ),


            adSoyad:
                normalizeText(
                    get(
                        "adSoyad"
                    )
                ),


            departman:
                normalizeText(
                    get(
                        "departman"
                    )
                ),


            pozisyon:
                normalizeText(
                    get(
                        "pozisyon"
                    )
                ),


            dogumTarihi:
                tarih(
                    get(
                        "dogumTarihi"
                    )
                ),


            iseGirisTarihi:
                tarih(
                    get(
                        "iseGirisTarihi"
                    )
                ),


            mevcutMaas:
                sayi(
                    get(
                        "mevcutMaas"
                    )
                ),


            cinsiyet:
                normalizeText(
                    get(
                        "cinsiyet"
                    )
                ),


            kalanIzin:
                sayi(
                    get(
                        "kalanIzin"
                    )
                )
        };
    }


    /* ============================================================
       09 — REQUIRED FIELD CHECK
    ============================================================ */

    function zorunluKolonKontrol(
        mapping
    ) {

        const required = [

            "personelId",

            "dogumTarihi",

            "iseGirisTarihi",

            "mevcutMaas"
        ];


        const missing =
            required.filter(
                field =>
                    !mapping[field]
            );


        return {

            valid:
                missing.length === 0,

            missing:
                missing
        };
    }


    /* ============================================================
       10 — PERSONEL VALIDATION
    ============================================================ */

    function personelValidate(
        personel
    ) {

        const errors = [];


        if (
            !personel.personelId
        ) {

            errors.push(
                "Personel ID eksik."
            );
        }


        if (
            !personel.dogumTarihi
        ) {

            errors.push(
                "Doğum tarihi eksik veya geçersiz."
            );
        }


        if (
            !personel.iseGirisTarihi
        ) {

            errors.push(
                "İşe giriş tarihi eksik veya geçersiz."
            );
        }


        if (
            personel.mevcutMaas < 0
        ) {

            errors.push(
                "Mevcut maaş negatif olamaz."
            );
        }


        if (
            personel.dogumTarihi &&
            personel.iseGirisTarihi &&
            personel.iseGirisTarihi <
            personel.dogumTarihi
        ) {

            errors.push(
                "İşe giriş tarihi doğum tarihinden önce."
            );
        }


        return {

            valid:
                errors.length === 0,

            errors:
                errors
        };
    }


    /* ============================================================
       11 — DUPLICATE KONTROL
    ============================================================ */

    function duplicateKontrol(
        personeller
    ) {

        const seen =
            new Map();


        const duplicates = [];


        personeller.forEach(
            (
                personel,
                index
            ) => {

                const id =
                    normalizeText(
                        personel.personelId
                    );


                if (
                    !id
                ) {

                    return;
                }


                if (
                    seen.has(
                        id
                    )
                ) {

                    duplicates.push({

                        personelId:
                            id,

                        ilkSatir:
                            seen.get(
                                id
                            ),

                        tekrarSatiri:
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


        return {

            valid:
                duplicates.length === 0,

            duplicates:
                duplicates
        };
    }


    /* ============================================================
       12 — VERİ KALİTESİ ANALİZİ
    ============================================================ */

    function veriKalitesi(
        personeller
    ) {

        const toplam =
            personeller.length;


        let eksikPersonelId =
            0;


        let eksikDogumTarihi =
            0;


        let eksikIseGirisTarihi =
            0;


        let gecersizMaas =
            0;


        let eksikDepartman =
            0;


        let eksikPozisyon =
            0;


        personeller.forEach(
            personel => {

                if (
                    !personel.personelId
                ) {

                    eksikPersonelId++;
                }


                if (
                    !personel.dogumTarihi
                ) {

                    eksikDogumTarihi++;
                }


                if (
                    !personel.iseGirisTarihi
                ) {

                    eksikIseGirisTarihi++;
                }


                if (
                    !Number.isFinite(
                        personel.mevcutMaas
                    ) ||
                    personel.mevcutMaas < 0
                ) {

                    gecersizMaas++;
                }


                if (
                    !personel.departman
                ) {

                    eksikDepartman++;
                }


                if (
                    !personel.pozisyon
                ) {

                    eksikPozisyon++;
                }
            }
        );


        const validCount =
            personeller.filter(
                personel =>
                    personelValidate(
                        personel
                    ).valid
            ).length;


        const kaliteOrani =
            toplam > 0
                ? validCount /
                  toplam
                : 0;


        return {

            toplamKayit:
                toplam,

            gecersizKayit:
                toplam -
                validCount,

            validKayit:
                validCount,

            kaliteOrani:
                kaliteOrani,

            kaliteYuzdesi:
                kaliteOrani * 100,

            eksikPersonelId:
                eksikPersonelId,

            eksikDogumTarihi:
                eksikDogumTarihi,

            eksikIseGirisTarihi:
                eksikIseGirisTarihi,

            gecersizMaas:
                gecersizMaas,

            eksikDepartman:
                eksikDepartman,

            eksikPozisyon:
                eksikPozisyon
        };
    }


    /* ============================================================
       13 — ARRAY IMPORT
    ============================================================ */

    function arrayImport(
        rows,
        options = {}
    ) {

        if (
            !Array.isArray(
                rows
            )
        ) {

            throw new Error(
                "Veri bir Array olmalıdır."
            );
        }


        if (
            rows.length === 0
        ) {

            return {

                success:
                    false,

                personeller:
                    [],

                hatalar:
                    [
                        "İçe aktarılacak veri bulunamadı."
                    ],

                veriKalitesi:
                    veriKalitesi(
                        []
                    )
            };
        }


        const headers =
            Object.keys(
                rows[0]
            );


        const mapping =
            kolonlariTespitEt(
                headers
            );


        const kolonKontrol =
            zorunluKolonKontrol(
                mapping
            );


        if (
            !kolonKontrol.valid
        ) {

            return {

                success:
                    false,

                personeller:
                    [],

                mapping:
                    mapping,

                hatalar: [
                    "Zorunlu kolonlar bulunamadı: " +
                    kolonKontrol.missing.join(
                        ", "
                    )
                ],

                veriKalitesi:
                    null
            };
        }


        const personeller = [];


        const hatalar = [];


        rows.forEach(
            (
                row,
                index
            ) => {

                const personel =
                    personelNormalizeEt(
                        row,
                        mapping
                    );


                const validation =
                    personelValidate(
                        personel
                    );


                if (
                    validation.valid ||
                    options.gecersizleriTut
                ) {

                    personeller.push(
                        personel
                    );
                }


                if (
                    !validation.valid
                ) {

                    hatalar.push({

                        satir:
                            index + 2,

                        personelId:
                            personel.personelId,

                        errors:
                            validation.errors
                    });
                }
            }
        );


        const duplicate =
            duplicateKontrol(
                personeller
            );


        return {

            success:
                true,

            personeller:
                personeller,

            mapping:
                mapping,

            hatalar:
                hatalar,

            duplicate:
                duplicate,

            veriKalitesi:
                veriKalitesi(
                    personeller
                ),

            metadata: {

                rowCount:
                    rows.length,

                importedCount:
                    personeller.length,

                errorCount:
                    hatalar.length,

                importDate:
                    new Date()
            }
        };
    }


    /* ============================================================
       14 — JSON IMPORT
    ============================================================ */

    function jsonImport(
        data,
        options = {}
    ) {

        let rows =
            data;


        if (
            typeof data === "string"
        ) {

            try {

                rows =
                    JSON.parse(
                        data
                    );

            }

            catch (
                error
            ) {

                throw new Error(
                    "JSON verisi okunamadı."
                );
            }
        }


        /*
         * Bazı JSON dosyaları:
         *
         * {
         *   employees: [...]
         * }
         */

        if (
            !Array.isArray(
                rows
            )
        ) {

            if (
                Array.isArray(
                    rows?.employees
                )
            ) {

                rows =
                    rows.employees;
            }

            else if (
                Array.isArray(
                    rows?.personeller
                )
            ) {

                rows =
                    rows.personeller;
            }

            else {

                throw new Error(
                    "JSON içinde personel listesi bulunamadı."
                );
            }
        }


        return arrayImport(
            rows,
            options
        );
    }


    /* ============================================================
       15 — CSV PARSER
       ============================================================ */

    function csvParse(
        csv
    ) {

        if (
            typeof csv !== "string"
        ) {

            throw new Error(
                "CSV verisi metin olmalıdır."
            );
        }


        const rows = [];


        let current = "";


        let row = [];


        let inQuotes =
            false;


        for (
            let i = 0;
            i < csv.length;
            i++
        ) {

            const char =
                csv[i];


            const next =
                csv[i + 1];


            if (
                char === '"'
            ) {

                if (
                    inQuotes &&
                    next === '"'
                ) {

                    current +=
                        '"';

                    i++;

                }

                else {

                    inQuotes =
                        !inQuotes;
                }

                continue;
            }


            if (
                char === "," &&
                !inQuotes
            ) {

                row.push(
                    current
                );

                current =
                    "";

                continue;
            }


            if (
                (
                    char === "\n" ||
                    char === "\r"
                ) &&
                !inQuotes
            ) {

                if (
                    char === "\r" &&
                    next === "\n"
                ) {

                    i++;
                }


                row.push(
                    current
                );


                current =
                    "";


                if (
                    row.some(
                        value =>
                            value.trim() !== ""
                    )
                ) {

                    rows.push(
                        row
                    );
                }


                row = [];


                continue;
            }


            current +=
                char;
        }


        if (
            current !== "" ||
            row.length > 0
        ) {

            row.push(
                current
            );


            if (
                row.some(
                    value =>
                        value.trim() !== ""
                )
            ) {

                rows.push(
                    row
                );
            }
        }


        if (
            rows.length === 0
        ) {

            return [];
        }


        const headers =
            rows[0].map(
                header =>
                    header
                        .replace(
                            /^\uFEFF/,
                            ""
                        )
                        .trim()
            );


        return rows
            .slice(1)
            .map(
                values => {

                    const object = {};


                    headers.forEach(
                        (
                            header,
                            index
                        ) => {

                            object[header] =
                                values[index]
                                    ??
                                "";
                        }
                    );


                    return object;
                }
            );
    }


    /* ============================================================
       16 — CSV IMPORT
    ============================================================ */

    function csvImport(
        csv,
        options = {}
    ) {

        const rows =
            csvParse(
                csv
            );


        return arrayImport(
            rows,
            options
        );
    }


    /* ============================================================
       17 — VERİ EXPORT
    ============================================================ */

    function jsonExport(
        personeller
    ) {

        return JSON.stringify(
            personeller,
            (
                key,
                value
            ) => {

                if (
                    value instanceof Date
                ) {

                    return value.toISOString();
                }


                return value;
            },
            2
        );
    }


    /* ============================================================
       18 — CSV EXPORT
    ============================================================ */

    function csvExport(
        personeller
    ) {

        const headers = [

            "personelId",

            "adSoyad",

            "departman",

            "pozisyon",

            "dogumTarihi",

            "iseGirisTarihi",

            "mevcutMaas",

            "cinsiyet",

            "kalanIzin"
        ];


        const escape =
            value => {

                if (
                    value === null ||
                    value === undefined
                ) {

                    return "";
                }


                let text =
                    value;


                if (
                    value instanceof Date
                ) {

                    text =
                        tarihFormatla(
                            value
                        );
                }


                text =
                    String(
                        text
                    );


                if (
                    text.includes(",") ||
                    text.includes('"') ||
                    text.includes("\n")
                ) {

                    return '"' +
                        text.replace(
                            /"/g,
                            '""'
                        ) +
                        '"';
                }


                return text;
            };


        const lines = [];


        lines.push(
            headers.join(
                ","
            )
        );


        personeller.forEach(
            personel => {

                lines.push(
                    headers
                        .map(
                            header =>
                                escape(
                                    personel[
                                        header
                                    ]
                                )
                        )
                        .join(
                            ","
                        )
                );
            }
        );


        return lines.join(
            "\n"
        );
    }


    /* ============================================================
       19 — DEMO DATA
    ============================================================ */

    function demoVeriOlustur(
        adet = 10
    ) {

        const liste = [];


        const bugun =
            new Date();


        for (
            let i = 1;
            i <= adet;
            i++
        ) {

            const yas =
                25 +
                (
                    i % 30
                );


            const dogum =
                new Date(
                    bugun.getFullYear() -
                    yas,
                    bugun.getMonth(),
                    bugun.getDate()
                );


            const hizmet =
                1 +
                (
                    i % 15
                );


            const iseGiris =
                new Date(
                    bugun.getTime() -
                    hizmet *
                    365.25 *
                    24 *
                    60 *
                    60 *
                    1000
                );


            liste.push({

                personelId:
                    "DEMO-" +
                    String(i)
                        .padStart(
                            4,
                            "0"
                        ),

                adSoyad:
                    "Demo Çalışan " +
                    i,

                departman:
                    [
                        "Finans",
                        "İnsan Kaynakları",
                        "Operasyon",
                        "Satış",
                        "IT"
                    ][
                        i % 5
                    ],

                pozisyon:
                    "Uzman",


                dogumTarihi:
                    dogum,


                iseGirisTarihi:
                    iseGiris,


                mevcutMaas:
                    35000 +
                    i * 2500,


                cinsiyet:
                    i % 2 === 0
                        ? "Kadın"
                        : "Erkek",


                kalanIzin:
                    10 +
                    (
                        i % 15
                    )
            });
        }


        return liste;
    }


    /* ============================================================
       20 — AKTÜERYAL MOTOR İLE ENTEGRASYON
       ============================================================ */

    function aktuerHesaplamayaHazirla(
        personeller
    ) {

        if (
            !Array.isArray(
                personeller
            )
        ) {

            return [];
        }


        return personeller.map(
            personel => ({

                ...personel,

                dogumTarihi:
                    personel.dogumTarihi
                        instanceof Date
                        ? personel.dogumTarihi
                        : tarih(
                            personel.dogumTarihi
                        ),


                iseGirisTarihi:
                    personel.iseGirisTarihi
                        instanceof Date
                        ? personel.iseGirisTarihi
                        : tarih(
                            personel.iseGirisTarihi
                        ),


                mevcutMaas:
                    sayi(
                        personel.mevcutMaas
                    )
            })
        );
    }


    /* ============================================================
       21 — HEALTH CHECK
       ============================================================ */

    function healthCheck() {

        return {

            status:
                "OK",

            engine:
                DataEngine.engineName,

            version:
                DataEngine.version,

            standard:
                DataEngine.standard,

            timestamp:
                new Date().toISOString()
        };
    }


    /* ============================================================
       22 — PUBLIC API
       ============================================================ */

    DataEngine.sayi =
        sayi;


    DataEngine.tarih =
        tarih;


    DataEngine.tarihFormatla =
        tarihFormatla;


    DataEngine.normalizeKey =
        normalizeKey;


    DataEngine.normalizeText =
        normalizeText;


    DataEngine.kolonlariTespitEt =
        kolonlariTespitEt;


    DataEngine.personelNormalizeEt =
        personelNormalizeEt;


    DataEngine.personelValidate =
        personelValidate;


    DataEngine.zorunluKolonKontrol =
        zorunluKolonKontrol;


    DataEngine.duplicateKontrol =
        duplicateKontrol;


    DataEngine.veriKalitesi =
        veriKalitesi;


    DataEngine.arrayImport =
        arrayImport;


    DataEngine.jsonImport =
        jsonImport;


    DataEngine.csvParse =
        csvParse;


    DataEngine.csvImport =
        csvImport;


    DataEngine.jsonExport =
        jsonExport;


    DataEngine.csvExport =
        csvExport;


    DataEngine.demoVeriOlustur =
        demoVeriOlustur;


    DataEngine.aktuerHesaplamayaHazirla =
        aktuerHesaplamayaHazirla;


    DataEngine.healthCheck =
        healthCheck;


    DataEngine.FIELD_ALIASES =
        FIELD_ALIASES;


    /* ============================================================
       23 — GLOBAL EXPORT
       ============================================================ */

    global.TMS19DataEngine =
        DataEngine;


    if (
        !global.TMS19
    ) {

        global.TMS19 = {};
    }


    global.TMS19.DataEngine =
        DataEngine;


})(typeof window !== "undefined"
    ? window
    : globalThis);
