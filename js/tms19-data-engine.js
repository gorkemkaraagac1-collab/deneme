/* ============================================================
   GK ADVISORY — TMS 19 DATA ENGINE
   TMS 19 / IAS 19 Actuarial Data Management Layer

   Amaç:
   - CSV / Excel benzeri verileri normalize etmek
   - Türkçe / İngilizce kolon isimlerini tanımak
   - Personel verilerini standartlaştırmak
   - Veri kalitesi kontrollerini yapmak
   - Aktüeryal motor için temiz veri üretmek

   Versiyon: 1.0
============================================================ */

"use strict";


/* ============================================================
   GLOBAL NAMESPACE
============================================================ */

window.TMS19Data = window.TMS19Data || {};


/* ============================================================
   1. KOLON SÖZLÜĞÜ
============================================================ */

TMS19Data.kolonSozlugu = {

    sicilNo: [
        "sicil no",
        "sicil_no",
        "sicil",
        "employee id",
        "employee_id",
        "employee number",
        "employee no",
        "personel no",
        "personel numarası",
        "çalışan no",
        "çalışan numarası",
        "id"
    ],

    adSoyad: [
        "ad soyad",
        "ad_soyad",
        "adsoyad",
        "isim",
        "isim soyisim",
        "personel adı",
        "çalışan adı",
        "employee name",
        "employee_name",
        "name",
        "full name",
        "fullname"
    ],

    doğumTarihi: [
        "doğum tarihi",
        "dogum tarihi",
        "doğum_tarihi",
        "dogum_tarihi",
        "birth date",
        "birth_date",
        "date of birth",
        "dob",
        "birthdate"
    ],

    işeGirişTarihi: [
        "işe giriş tarihi",
        "işe giriş",
        "işe_giriş_tarihi",
        "ise giris tarihi",
        "ise_giris_tarihi",
        "işe başlama tarihi",
        "işe başlama",
        "hire date",
        "hire_date",
        "joining date",
        "join date",
        "employment start date",
        "start date"
    ],

    iştenAyrılmaTarihi: [
        "işten ayrılma tarihi",
        "işten ayrılış tarihi",
        "işten_ayrılma_tarihi",
        "isten ayrilma tarihi",
        "termination date",
        "termination_date",
        "leaving date",
        "leave date",
        "exit date",
        "end date"
    ],

    mevcutMaaş: [
        "maaş",
        "maas",
        "brüt maaş",
        "brut maas",
        "brüt ücret",
        "brut ucret",
        "ücret",
        "ucret",
        "aylık ücret",
        "aylik ucret",
        "aylık brüt ücret",
        "monthly salary",
        "monthly_salary",
        "gross salary",
        "gross_salary",
        "salary",
        "basic salary",
        "pay"
    ],

    cinsiyet: [
        "cinsiyet",
        "gender",
        "sex"
    ],

    departman: [
        "departman",
        "department",
        "bölüm",
        "bolum",
        "birim",
        "unit",
        "division"
    ],

    pozisyon: [
        "pozisyon",
        "position",
        "job title",
        "job_title",
        "unvan",
        "title"
    ],

    medeniDurum: [
        "medeni durum",
        "medeni_durum",
        "marital status",
        "marital_status"
    ],

    çalışanDurumu: [
        "çalışan durumu",
        "calisan durumu",
        "employee status",
        "employee_status",
        "status",
        "durum",
        "aktif pasif",
        "active inactive"
    ]

};


/* ============================================================
   2. STANDARD KOLONLAR
============================================================ */

TMS19Data.zorunluAlanlar = [

    "sicilNo",
    "adSoyad",
    "doğumTarihi",
    "işeGirişTarihi",
    "mevcutMaaş"

];


TMS19Data.opsiyonelAlanlar = [

    "iştenAyrılmaTarihi",
    "cinsiyet",
    "departman",
    "pozisyon",
    "medeniDurum",
    "çalışanDurumu"

];


/* ============================================================
   3. METİN NORMALİZASYONU
============================================================ */

TMS19Data.normalizeText = function (
    değer
) {

    if (
        değer === null ||
        değer === undefined
    ) {

        return "";

    }

    return String(değer)
        .trim()
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
            /[_\-]+/g,
            " "
        )
        .replace(
            /\s+/g,
            " "
        )
        .trim();

};


/* ============================================================
   4. KOLON EŞLEŞTİRME
============================================================ */

TMS19Data.kolonBul = function (
    kolonAdi
) {

    const normalizeEdilmis =
        TMS19Data.normalizeText(
            kolonAdi
        );


    for (
        const standartAlan
        in TMS19Data.kolonSozlugu
    ) {

        const alternatifler =
            TMS19Data.kolonSozlugu[
                standartAlan
            ];


        for (
            const alternatif
            of alternatifler
        ) {

            if (
                TMS19Data.normalizeText(
                    alternatif
                )
                ===
                normalizeEdilmis
            ) {

                return standartAlan;

            }

        }

    }


    return null;

};


/* ============================================================
   5. OTOMATİK KOLON EŞLEŞTİRME
============================================================ */

TMS19Data.kolonlariEsle = function (
    kolonlar
) {

    const eslesme = {};

    const eslesmeyenler = [];


    kolonlar.forEach(
        kolon => {

            const standartAlan =
                TMS19Data.kolonBul(
                    kolon
                );


            if (
                standartAlan
            ) {

                eslesme[
                    kolon
                ] =
                    standartAlan;

            } else {

                eslesmeyenler.push(
                    kolon
                );

            }

        }
    );


    return {

        eslesme,
        eslesmeyenler

    };

};


/* ============================================================
   6. SAYI PARSE
============================================================ */

TMS19Data.parseNumber = function (
    değer
) {

    if (
        değer === null ||
        değer === undefined ||
        değer === ""
    ) {

        return null;

    }


    if (
        typeof değer === "number"
    ) {

        return isFinite(değer)
            ? değer
            : null;

    }


    let metin =
        String(değer)
            .trim();


    metin =
        metin.replace(
            /\s/g,
            ""
        );


    /*
       Türkçe format:

       125.000,50
       → 125000.50

       İngilizce format:

       125,000.50
       → 125000.50
    */


    if (
        metin.includes(",") &&
        metin.includes(".")
    ) {

        const sonVirgul =
            metin.lastIndexOf(",");

        const sonNokta =
            metin.lastIndexOf(".");


        if (
            sonVirgul >
            sonNokta
        ) {

            metin =
                metin
                    .replace(
                        /\./g,
                        ""
                    )
                    .replace(
                        ",",
                        "."
                    );

        } else {

            metin =
                metin.replace(
                    /,/g,
                    ""
                );

        }

    } else if (
        metin.includes(",")
    ) {

        const parçalar =
            metin.split(",");


        if (
            parçalar.length === 2 &&
            parçalar[1].length <= 2
        ) {

            metin =
                metin.replace(
                    ",",
                    "."
                );

        } else {

            metin =
                metin.replace(
                    /,/g,
                    ""
                );

        }

    } else if (
        metin.includes(".")
    ) {

        const parçalar =
            metin.split(".");


        if (
            parçalar.length > 2
        ) {

            metin =
                metin.replace(
                    /\./g,
                    ""
                );

        }

    }


    const sayı =
        Number(
            metin
                .replace(
                    /[^0-9.\-]/g,
                    ""
                )
        );


    return isFinite(sayı)
        ? sayı
        : null;

};


/* ============================================================
   7. TARİH PARSE
============================================================ */

TMS19Data.parseDate = function (
    değer
) {

    if (
        değer === null ||
        değer === undefined ||
        değer === ""
    ) {

        return null;

    }


    if (
        değer instanceof Date
    ) {

        return isNaN(
            değer.getTime()
        )
            ? null
            : değer;

    }


    /*
       Excel serial date
    */

    if (
        typeof değer === "number"
    ) {

        const excelEpoch =
            new Date(
                Date.UTC(
                    1899,
                    11,
                    30
                )
            );


        const tarih =
            new Date(
                excelEpoch.getTime()
                +
                değer *
                86400000
            );


        return isNaN(
            tarih.getTime()
        )
            ? null
            : tarih;

    }


    let metin =
        String(değer)
            .trim();


    /*
       DD.MM.YYYY
       DD/MM/YYYY
       DD-MM-YYYY
    */

    const türkTarih =
        metin.match(
            /^(\d{1,2})[.\/\-](\d{1,2})[.\/\-](\d{4})$/
        );


    if (
        türkTarih
    ) {

        const gün =
            Number(
                türkTarih[1]
            );

        const ay =
            Number(
                türkTarih[2]
            ) - 1;

        const yıl =
            Number(
                türkTarih[3]
            );


        const tarih =
            new Date(
                yıl,
                ay,
                gün
            );


        if (
            tarih.getFullYear() === yıl &&
            tarih.getMonth() === ay &&
            tarih.getDate() === gün
        ) {

            return tarih;

        }

    }


    const tarih =
        new Date(
            metin
        );


    return isNaN(
        tarih.getTime()
    )
        ? null
        : tarih;

};


/* ============================================================
   8. TARİH FORMAT
============================================================ */

TMS19Data.formatDate = function (
    tarih
) {

    if (
        !tarih
    ) {

        return "";

    }


    const d =
        tarih instanceof Date
            ? tarih
            : TMS19Data.parseDate(
                tarih
            );


    if (
        !d
    ) {

        return "";

    }


    const gün =
        String(
            d.getDate()
        ).padStart(
            2,
            "0"
        );


    const ay =
        String(
            d.getMonth() + 1
        ).padStart(
            2,
            "0"
        );


    const yıl =
        d.getFullYear();


    return (
        gün
        +
        "."
        +
        ay
        +
        "."
        +
        yıl
    );

};


/* ============================================================
   9. YAŞ HESAPLA
============================================================ */

TMS19Data.yasHesapla = function (
    doğumTarihi,
    değerlemeTarihi
) {

    const doğum =
        TMS19Data.parseDate(
            doğumTarihi
        );


    const değerleme =
        TMS19Data.parseDate(
            değerlemeTarihi
        );


    if (
        !doğum ||
        !değerleme
    ) {

        return null;

    }


    let yaş =
        değerleme.getFullYear()
        -
        doğum.getFullYear();


    const ay =
        değerleme.getMonth()
        -
        doğum.getMonth();


    if (
        ay < 0 ||
        (
            ay === 0 &&
            değerleme.getDate()
            <
            doğum.getDate()
        )
    ) {

        yaş--;

    }


    return yaş;

};


/* ============================================================
   10. HİZMET SÜRESİ
============================================================ */

TMS19Data.hizmetSuresiHesapla = function (
    işeGirişTarihi,
    değerlemeTarihi
) {

    const giriş =
        TMS19Data.parseDate(
            işeGirişTarihi
        );


    const değerleme =
        TMS19Data.parseDate(
            değerlemeTarihi
        );


    if (
        !giriş ||
        !değerleme
    ) {

        return null;

    }


    const fark =
        değerleme.getTime()
        -
        giriş.getTime();


    return Math.max(
        0,
        fark /
        (
            365.25 *
            24 *
            60 *
            60 *
            1000
        )
    );

};


/* ============================================================
   11. TEK PERSONEL NORMALİZASYONU
============================================================ */

TMS19Data.personelNormalizeEt = function (
    hamVeri,
    kolonEslesmesi
) {

    const personel = {};


    Object.keys(
        kolonEslesmesi
    ).forEach(
        orijinalKolon => {

            const standartAlan =
                kolonEslesmesi[
                    orijinalKolon
                ];


            personel[
                standartAlan
            ] =
            hamVeri[
                orijinalKolon
            ];

        }
    );


    personel.sicilNo =
        personel.sicilNo !== undefined
            ? String(
                personel.sicilNo
            ).trim()
            : "";


    personel.adSoyad =
        personel.adSoyad !== undefined
            ? String(
                personel.adSoyad
            ).trim()
            : "";


    personel.doğumTarihi =
        TMS19Data.parseDate(
            personel.doğumTarihi
        );


    personel.işeGirişTarihi =
        TMS19Data.parseDate(
            personel.işeGirişTarihi
        );


    personel.iştenAyrılmaTarihi =
        TMS19Data.parseDate(
            personel.iştenAyrılmaTarihi
        );


    personel.mevcutMaaş =
        TMS19Data.parseNumber(
            personel.mevcutMaaş
        );


    personel.cinsiyet =
        personel.cinsiyet !== undefined
            ? String(
                personel.cinsiyet
            ).trim()
            : "";


    personel.departman =
        personel.departman !== undefined
            ? String(
                personel.departman
            ).trim()
            : "";


    personel.pozisyon =
        personel.pozisyon !== undefined
            ? String(
                personel.pozisyon
            ).trim()
            : "";


    personel.medeniDurum =
        personel.medeniDurum !== undefined
            ? String(
                personel.medeniDurum
            ).trim()
            : "";


    personel.çalışanDurumu =
        personel.çalışanDurumu !== undefined
            ? String(
                personel.çalışanDurumu
            ).trim()
            : "Aktif";


    return personel;

};


/* ============================================================
   12. VERİ SETİ NORMALİZASYONU
============================================================ */

TMS19Data.veriSetiNormalizeEt = function (
    hamVeri
) {

    if (
        !Array.isArray(
            hamVeri
        ) ||
        hamVeri.length === 0
    ) {

        throw new Error(
            "Veri seti boş veya geçersiz."
        );

    }


    const kolonlar =
        Object.keys(
            hamVeri[0]
        );


    const eşleştirme =
        TMS19Data.kolonlariEsle(
            kolonlar
        );


    const eksikZorunluAlanlar =
        TMS19Data.zorunluAlanlar
            .filter(
                alan =>
                    !Object.values(
                        eşleştirme.eslesme
                    )
                    .includes(
                        alan
                    )
            );


    const normalizeVeri =
        hamVeri.map(
            satır =>
                TMS19Data.personelNormalizeEt(
                    satır,
                    eşleştirme.eslesme
                )
        );


    return {

        veri:
            normalizeVeri,

        eşleştirme:
            eşleştirme.eslesme,

        eslesmeyenKolonlar:
            eşleştirme.eslesmeyenler,

        eksikZorunluAlanlar

    };

};


/* ============================================================
   13. VERİ KALİTESİ — ANA MOTOR
============================================================ */

TMS19Data.veriKalitesiKontrol = function (
    personelListesi,
    varsayımlar
) {

    const hatalar = [];

    const uyarılar = [];

    const bilgiler = [];


    const sicilMap =
        new Map();


    const bugün =
        TMS19Data.parseDate(
            varsayımlar &&
            varsayımlar.değerlemeTarihi
        )
        ||
        new Date();


    personelListesi.forEach(
        (personel, index) => {

            const satır =
                index + 2;


            /* ---------------------------------------------
               Sicil kontrolü
            --------------------------------------------- */

            if (
                !personel.sicilNo
            ) {

                hatalar.push({

                    satır,

                    alan:
                        "Sicil No",

                    mesaj:
                        "Sicil numarası boş."

                });

            } else {

                if (
                    sicilMap.has(
                        personel.sicilNo
                    )
                ) {

                    hatalar.push({

                        satır,

                        alan:
                            "Sicil No",

                        mesaj:
                            "Tekrarlanan sicil numarası: "
                            +
                            personel.sicilNo

                    });

                }


                sicilMap.set(
                    personel.sicilNo,
                    true
                );

            }


            /* ---------------------------------------------
               Ad soyad
            --------------------------------------------- */

            if (
                !personel.adSoyad
            ) {

                uyarılar.push({

                    satır,

                    alan:
                        "Ad Soyad",

                    mesaj:
                        "Personel adı boş."

                });

            }


            /* ---------------------------------------------
               Doğum tarihi
            --------------------------------------------- */

            if (
                !personel.doğumTarihi
            ) {

                hatalar.push({

                    satır,

                    alan:
                        "Doğum Tarihi",

                    mesaj:
                        "Doğum tarihi bulunamadı."

                });

            } else {

                if (
                    personel.doğumTarihi
                    >
                    bugün
                ) {

                    hatalar.push({

                        satır,

                        alan:
                            "Doğum Tarihi",

                        mesaj:
                            "Doğum tarihi değerleme tarihinden sonra."

                    });

                }

            }


            /* ---------------------------------------------
               İşe giriş
            --------------------------------------------- */

            if (
                !personel.işeGirişTarihi
            ) {

                hatalar.push({

                    satır,

                    alan:
                        "İşe Giriş Tarihi",

                    mesaj:
                        "İşe giriş tarihi bulunamadı."

                });

            } else {

                if (
                    personel.işeGirişTarihi
                    >
                    bugün
                ) {

                    hatalar.push({

                        satır,

                        alan:
                            "İşe Giriş Tarihi",

                        mesaj:
                            "İşe giriş tarihi gelecek tarihli."

                    });

                }


                if (
                    personel.doğumTarihi &&
                    personel.işeGirişTarihi
                    <
                    personel.doğumTarihi
                ) {

                    hatalar.push({

                        satır,

                        alan:
                            "İşe Giriş Tarihi",

                        mesaj:
                            "İşe giriş tarihi doğum tarihinden önce."

                    });

                }

            }


            /* ---------------------------------------------
               Maaş
            --------------------------------------------- */

            if (
                personel.mevcutMaaş === null ||
                personel.mevcutMaaş === undefined
            ) {

                hatalar.push({

                    satır,

                    alan:
                        "Brüt Maaş",

                    mesaj:
                        "Brüt maaş bilgisi bulunamadı."

                });

            } else if (
                personel.mevcutMaaş <= 0
            ) {

                hatalar.push({

                    satır,

                    alan:
                        "Brüt Maaş",

                    mesaj:
                        "Brüt maaş sıfır veya negatif."

                });

            } else if (
                personel.mevcutMaaş < 1000
            ) {

                uyarılar.push({

                    satır,

                    alan:
                        "Brüt Maaş",

                    mesaj:
                        "Brüt maaş olağandışı düşük görünüyor."

                });

            }


            /* ---------------------------------------------
               Yaş
            --------------------------------------------- */

            const yaş =
                TMS19Data.yasHesapla(
                    personel.doğumTarihi,
                    bugün
                );


            if (
                yaş !== null
            ) {

                if (
                    yaş < 15
                ) {

                    hatalar.push({

                        satır,

                        alan:
                            "Yaş",

                        mesaj:
                            "Personel yaşı 15'in altında."

                    });

                }


                if (
                    yaş > 75
                ) {

                    uyarılar.push({

                        satır,

                        alan:
                            "Yaş",

                        mesaj:
                            "Personel yaşı 75'in üzerinde."

                    });

                }


                if (
                    varsayımlar &&
                    varsayımlar.emeklilikYaşı &&
                    yaş >
                    Number(
                        varsayımlar.emeklilikYaşı
                    )
                ) {

                    uyarılar.push({

                        satır,

                        alan:
                            "Yaş",

                        mesaj:
                            "Personel emeklilik yaşını aşmış."

                    });

                }

            }


            /* ---------------------------------------------
               Hizmet süresi
            --------------------------------------------- */

            const hizmet =
                TMS19Data.hizmetSuresiHesapla(
                    personel.işeGirişTarihi,
                    bugün
                );


            if (
                hizmet !== null &&
                hizmet > 50
            ) {

                uyarılar.push({

                    satır,

                    alan:
                        "Hizmet Süresi",

                    mesaj:
                        "Hizmet süresi 50 yılın üzerinde."

                });

            }


            /* ---------------------------------------------
               Cinsiyet
            --------------------------------------------- */

            if (
                personel.cinsiyet
            ) {

                const c =
                    TMS19Data.normalizeText(
                        personel.cinsiyet
                    );


                const geçerli = [

                    "e",
                    "k",
                    "erkek",
                    "kadin",
                    "kadın",
                    "male",
                    "female",
                    "m",
                    "f"

                ];


                if (
                    !geçerli.includes(
                        c
                    )
                ) {

                    uyarılar.push({

                        satır,

                        alan:
                            "Cinsiyet",

                        mesaj:
                            "Cinsiyet değeri standart formatta değil."

                    });

                }

            }

        }
    );


    /* ========================================================
       GENEL KONTROLLER
    ======================================================== */


    if (
        personelListesi.length === 0
    ) {

        hatalar.push({

            satır:
                0,

            alan:
                "Veri Seti",

            mesaj:
                "Personel veri seti boş."

        });

    }


    if (
        personelListesi.length > 0
    ) {

        bilgiler.push({

            mesaj:
                personelListesi.length
                +
                " personel kaydı kontrol edildi."

        });

    }


    const toplamKontrol =
        personelListesi.length *
        8;


    const toplamProblem =
        hatalar.length +
        uyarılar.length;


    let kaliteSkoru =
        100;


    if (
        toplamKontrol > 0
    ) {

        kaliteSkoru =
            100
            -
            (
                hatalar.length * 5
            )
            -
            (
                uyarılar.length * 1.5
            );

    }


    kaliteSkoru =
        Math.max(
            0,
            Math.min(
                100,
                kaliteSkoru
            )
        );


    let seviye =
        "Mükemmel";


    if (
        kaliteSkoru < 95
    ) {

        seviye =
            "İyi";

    }


    if (
        kaliteSkoru < 85
    ) {

        seviye =
            "İyileştirme Gerekli";

    }


    if (
        kaliteSkoru < 70
    ) {

        seviye =
            "Kritik";

    }


    return {

        kaliteSkoru:
            Math.round(
                kaliteSkoru
            ),

        seviye,

        hatalar,

        uyarılar,

        bilgiler,

        toplamHata:
            hatalar.length,

        toplamUyarı:
            uyarılar.length

    };

};


/* ============================================================
   14. AKTÜERYAL ÖN KONTROL
============================================================ */

TMS19Data.aktüeryalÖnKontrol = function (
    personelListesi,
    varsayımlar
) {

    const sonuçlar = [];


    const iskonto =
        Number(
            varsayımlar &&
            varsayımlar.iskontoOranı
        );


    const maaşArtışı =
        Number(
            varsayımlar &&
            varsayımlar.maaşArtışOranı
        );


    const turnover =
        Number(
            varsayımlar &&
            varsayımlar.personelDevirOranı
        );


    if (
        !isFinite(
            iskonto
        ) ||
        iskonto <= 0
    ) {

        sonuçlar.push({

            seviye:
                "Kritik",

            alan:
                "İskonto Oranı",

            mesaj:
                "İskonto oranı sıfır veya geçersiz."

        });

    }


    if (
        iskonto > 1
    ) {

        sonuçlar.push({

            seviye:
                "Uyarı",

            alan:
                "İskonto Oranı",

            mesaj:
                "İskonto oranı %100'ün üzerinde."

        });

    }


    if (
        maaşArtışı < 0
    ) {

        sonuçlar.push({

            seviye:
                "Uyarı",

            alan:
                "Maaş Artış Oranı",

            mesaj:
                "Maaş artış oranı negatif."

        });

    }


    if (
        maaşArtışı > 1
    ) {

        sonuçlar.push({

            seviye:
                "Uyarı",

            alan:
                "Maaş Artış Oranı",

            mesaj:
                "Maaş artış oranı %100'ün üzerinde."

        });

    }


    if (
        turnover < 0 ||
        turnover > 1
    ) {

        sonuçlar.push({

            seviye:
                "Kritik",

            alan:
                "Personel Devir Oranı",

            mesaj:
                "Personel devir oranı %0-%100 aralığında olmalıdır."

        });

    }


    if (
        !varsayımlar.emeklilikYaşı ||
        Number(
            varsayımlar.emeklilikYaşı
        ) < 40 ||
        Number(
            varsayımlar.emeklilikYaşı
        ) > 80
    ) {

        sonuçlar.push({

            seviye:
                "Uyarı",

            alan:
                "Emeklilik Yaşı",

            mesaj:
                "Emeklilik yaşı olağandışı görünüyor."

        });

    }


    return sonuçlar;

};


/* ============================================================
   15. VERİ SETİ ÖZETİ
============================================================ */

TMS19Data.veriÖzeti = function (
    personelListesi,
    değerlemeTarihi
) {

    const maaşlar =
        personelListesi
            .map(
                p =>
                    Number(
                        p.mevcutMaaş
                    )
            )
            .filter(
                x =>
                    isFinite(x)
                    &&
                    x > 0
            );


    const yaşlar =
        personelListesi
            .map(
                p =>
                    TMS19Data.yasHesapla(
                        p.doğumTarihi,
                        değerlemeTarihi
                    )
            )
            .filter(
                x =>
                    x !== null
            );


    const hizmetler =
        personelListesi
            .map(
                p =>
                    TMS19Data.hizmetSuresiHesapla(
                        p.işeGirişTarihi,
                        değerlemeTarihi
                    )
            )
            .filter(
                x =>
                    x !== null
            );


    const ortalama = (
        dizi
    ) => {

        if (
            !dizi.length
        ) {

            return 0;

        }


        return dizi.reduce(
            (
                toplam,
                değer
            ) =>
                toplam + değer,
            0
        ) / dizi.length;

    };


    return {

        personelSayısı:
            personelListesi.length,

        toplamMaaş:
            maaşlar.reduce(
                (
                    a,
                    b
                ) =>
                    a + b,
                0
            ),

        ortalamaMaaş:
            ortalama(
                maaşlar
            ),

        minimumMaaş:
            maaşlar.length
                ? Math.min(
                    ...maaşlar
                )
                : 0,

        maksimumMaaş:
            maaşlar.length
                ? Math.max(
                    ...maaşlar
                )
                : 0,

        ortalamaYaş:
            ortalama(
                yaşlar
            ),

        ortalamaHizmet:
            ortalama(
                hizmetler
            )

    };

};


/* ============================================================
   16. ANA VERİ YÜKLEME PIPELINE
============================================================ */

TMS19Data.veriYükle = function (
    hamVeri,
    varsayımlar
) {

    try {

        const normalizeSonuç =
            TMS19Data.veriSetiNormalizeEt(
                hamVeri
            );


        const kalite =
            TMS19Data.veriKalitesiKontrol(
                normalizeSonuç.veri,
                varsayımlar
            );


        const aktüeryalKontrol =
            TMS19Data.aktüeryalÖnKontrol(
                normalizeSonuç.veri,
                varsayımlar
            );


        const özet =
            TMS19Data.veriÖzeti(
                normalizeSonuç.veri,
                varsayımlar.değerlemeTarihi
            );


        return {

            başarılı:
                normalizeSonuç
                    .eksikZorunluAlanlar
                    .length === 0,

            veri:
                normalizeSonuç.veri,

            kolonEşleşmesi:
                normalizeSonuç.eslesme,

            eslesmeyenKolonlar:
                normalizeSonuç
                    .eslesmeyenKolonlar,

            eksikZorunluAlanlar:
                normalizeSonuç
                    .eksikZorunluAlanlar,

            veriKalitesi:
                kalite,

            aktüeryalKontrol,

            özet

        };

    } catch (
        hata
    ) {

        return {

            başarılı:
                false,

            hata:
                hata.message,

            veri:
                [],

            veriKalitesi:
                {

                    kaliteSkoru:
                        0,

                    seviye:
                        "Kritik",

                    hatalar:
                        [

                            {

                                alan:
                                    "Sistem",

                                mesaj:
                                    hata.message

                            }

                        ],

                    uyarılar:
                        [],

                    toplamHata:
                        1,

                    toplamUyarı:
                        0

                }

        };

    }

};


/* ============================================================
   17. CSV PARSER
============================================================ */

TMS19Data.csvOku = function (
    csvMetni
) {

    if (
        !csvMetni ||
        !csvMetni.trim()
    ) {

        throw new Error(
            "CSV dosyası boş."
        );

    }


    const satırlar =
        csvMetni
            .replace(
                /\r\n/g,
                "\n"
            )
            .replace(
                /\r/g,
                "\n"
            )
            .split(
                "\n"
            )
            .filter(
                satır =>
                    satır.trim()
            );


    if (
        satırlar.length < 2
    ) {

        throw new Error(
            "CSV dosyasında veri satırı bulunamadı."
        );

    }


    const ayırıcı =
        satırlar[0].includes(";")
            ? ";"
            : ",";


    const parseSatır = (
        satır
    ) => {

        const sonuç = [];

        let mevcut =
            "";

        let tırnak =
            false;


        for (
            let i = 0;
            i < satır.length;
            i++
        ) {

            const karakter =
                satır[i];


            if (
                karakter === '"'
            ) {

                if (
                    tırnak &&
                    satır[i + 1] === '"'
                ) {

                    mevcut += '"';

                    i++;

                } else {

                    tırnak =
                        !tırnak;

                }

            } else if (
                karakter === ayırıcı &&
                !tırnak
            ) {

                sonuç.push(
                    mevcut.trim()
                );

                mevcut =
                    "";

            } else {

                mevcut +=
                    karakter;

            }

        }


        sonuç.push(
            mevcut.trim()
        );


        return sonuç;

    };


    const başlıklar =
        parseSatır(
            satırlar[0]
        );


    return satırlar
        .slice(1)
        .map(
            satır => {

                const değerler =
                    parseSatır(
                        satır
                    );


                const obje = {};


                başlıklar.forEach(
                    (
                        başlık,
                        index
                    ) => {

                        obje[
                            başlık
                        ] =
                            değerler[
                                index
                            ] !== undefined
                                ? değerler[
                                    index
                                ]
                                : "";

                    }
                );


                return obje;

            }
        );

};


/* ============================================================
   18. GLOBAL KISA YOLLAR
============================================================ */

window.tms19VeriYükle =
    TMS19Data.veriYükle;

window.tms19VeriKontrol =
    TMS19Data.veriKalitesiKontrol;

window.tms19CSVOku =
    TMS19Data.csvOku;


/* ============================================================
   19. CONSOLE MESAJI
============================================================ */

console.log(
    "GK Advisory — TMS 19 Data Engine V1 aktif."
);

console.log(
    "Desteklenen işlemler:",
    [
        "TMS19Data.veriYükle()",
        "TMS19Data.veriKalitesiKontrol()",
        "TMS19Data.csvOku()",
        "TMS19Data.kolonlariEsle()"
    ]
);
