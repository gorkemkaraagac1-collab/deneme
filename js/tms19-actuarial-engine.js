/* ================================================================
   GK FINANCIAL DECISION COCKPIT
   TMS 19 ACTUARIAL ENGINE
   ----------------------------------------------------------------
   TMS 19 Employee Benefit Obligation Calculation Engine

   ANA SORUMLULUKLAR
   -----------------
   1. Personel normalizasyonu
   2. Personel validation
   3. Yaş hesaplama
   4. Hizmet süresi hesaplama
   5. Maaş projeksiyonu
   6. Kıdem tavanı projeksiyonu
   7. Demografik olasılık
   8. İskonto
   9. DBO
   10. Cari hizmet maliyeti
   11. Faiz maliyeti
   12. Aktüeryal sonuç üretimi

   NOT
   ---
   Bu dosya UI içermez.
   Bu dosya tablo çizmez.
   Bu dosya Excel / CSV okumaz.

   Sadece aktüeryal hesaplama yapar.
================================================================ */

(function (global) {

    "use strict";


    /* ============================================================
       01 — TMS19 NAMESPACE
    ============================================================ */

    const TMS19 =
        global.TMS19 ||
        {};


    /* ============================================================
       02 — ENGINE BİLGİSİ
    ============================================================ */

    TMS19.engineVersion =
        "3.0.0";

    TMS19.engineName =
        "GK TMS 19 Actuarial Engine";


    /* ============================================================
       03 — SAYI NORMALİZASYONU
    ============================================================ */

    TMS19.sayi =
        function (value) {

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

                return isFinite(value)
                    ? value
                    : 0;
            }


            let text =
                String(value)
                    .trim();


            /*
             * Türkçe sayı formatı:
             *
             * 1.234.567,89
             *
             * İngilizce:
             *
             * 1234567.89
             */

            if (
                text.includes(",") &&
                text.includes(".")
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

            else if (
                text.includes(",")
            ) {

                text =
                    text.replace(
                        ",",
                        "."
                    );
            }


            const number =
                Number(
                    text
                );


            return isFinite(number)
                ? number
                : 0;
        };


    /* ============================================================
       04 — TARİH NORMALİZASYONU
    ============================================================ */

    TMS19.tarih =
        function (value) {

            if (
                value instanceof Date
            ) {

                return new Date(
                    value.getTime()
                );
            }


            if (
                !value
            ) {

                return null;
            }


            if (
                typeof value === "number"
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


                return isNaN(
                    result.getTime()
                )
                    ? null
                    : result;
            }


            const text =
                String(value)
                    .trim();


            /*
             * DD.MM.YYYY
             */

            const turkishDate =
                text.match(
                    /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/
                );


            if (
                turkishDate
            ) {

                const day =
                    Number(
                        turkishDate[1]
                    );


                const month =
                    Number(
                        turkishDate[2]
                    ) - 1;


                const year =
                    Number(
                        turkishDate[3]
                    );


                const result =
                    new Date(
                        year,
                        month,
                        day
                    );


                return isNaN(
                    result.getTime()
                )
                    ? null
                    : result;
            }


            const result =
                new Date(
                    text
                );


            return isNaN(
                result.getTime()
            )
                ? null
                : result;
        };


    /* ============================================================
       05 — TARİH FARKI
    ============================================================ */

    TMS19.yilFarki =
        function (
            startDate,
            endDate
        ) {

            if (
                !startDate ||
                !endDate
            ) {

                return 0;
            }


            const start =
                TMS19.tarih(
                    startDate
                );


            const end =
                TMS19.tarih(
                    endDate
                );


            if (
                !start ||
                !end
            ) {

                return 0;
            }


            const fark =
                end.getTime() -
                start.getTime();


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
       06 — YAŞ HESAPLA
    ============================================================ */

    TMS19.yasHesapla =
        function (
            dogumTarihi,
            degerlemeTarihi
        ) {

            const birth =
                TMS19.tarih(
                    dogumTarihi
                );


            const valuation =
                TMS19.tarih(
                    degerlemeTarihi
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


            return Math.max(
                0,
                age
            );
        };


    /* ============================================================
       07 — PERSONEL NORMALİZASYONU
    ============================================================ */

    TMS19.personelNormalizeEt =
        function (
            personel
        ) {

            const p =
                personel ||
                {};


            return {

                personelId:
                    p.personelId ??
                    p.id ??
                    p.PersonelID ??
                    "",


                adSoyad:
                    p.adSoyad ??
                    p.ad ??
                    p.AdSoyad ??
                    p.name ??
                    "",


                dogumTarihi:
                    p.dogumTarihi ??
                    p.dogumTarihi ??
                    p.DogumTarihi ??
                    p.birthDate ??
                    null,


                iseGirisTarihi:
                    p.iseGirisTarihi ??
                    p.IseGirisTarihi ??
                    p.hireDate ??
                    null,


                mevcutMaas:
                    TMS19.sayi(
                        p.mevcutMaas ??
                        p.MevcutMaas ??
                        p.maas ??
                        p.salary
                    ),


                departman:
                    p.departman ??
                    p.Departman ??
                    "",


                pozisyon:
                    p.pozisyon ??
                    p.Pozisyon ??
                    "",


                cinsiyet:
                    p.cinsiyet ??
                    p.Cinsiyet ??
                    p.gender ??
                    "",


                raw:
                    p
            };
        };


    /* ============================================================
       08 — PERSONEL VALIDATION
    ============================================================ */

    TMS19.personelValidate =
        function (
            personel
        ) {

            const p =
                TMS19.personelNormalizeEt(
                    personel
                );


            const errors =
                [];


            if (
                !p.personelId
            ) {

                errors.push(
                    "Personel ID eksik."
                );
            }


            if (
                !p.dogumTarihi
            ) {

                errors.push(
                    "Doğum tarihi eksik."
                );
            }


            if (
                !p.iseGirisTarihi
            ) {

                errors.push(
                    "İşe giriş tarihi eksik."
                );
            }


            if (
                p.mevcutMaas <= 0
            ) {

                errors.push(
                    "Mevcut maaş sıfır veya negatif."
                );
            }


            const birth =
                TMS19.tarih(
                    p.dogumTarihi
                );


            const hire =
                TMS19.tarih(
                    p.iseGirisTarihi
                );


            if (
                !birth
            ) {

                errors.push(
                    "Doğum tarihi geçersiz."
                );
            }


            if (
                !hire
            ) {

                errors.push(
                    "İşe giriş tarihi geçersiz."
                );
            }


            return {

                valid:
                    errors.length === 0,

                errors:
                    errors
            };
        };


    /* ============================================================
       09 — DEVAM OLASILIĞI
    ============================================================ */

    TMS19.devamOlasiligi =
        function (
            kalanYil,
            varsayimlar
        ) {

            if (
                kalanYil <= 0
            ) {

                return 1;
            }


            const turnover =
                Math.min(
                    Math.max(
                        TMS19.sayi(
                            varsayimlar
                                ?.personelDevirOrani
                        ),
                        0
                    ),
                    1
                );


            const mortality =
                Math.min(
                    Math.max(
                        TMS19.sayi(
                            varsayimlar
                                ?.olumOrani
                        ),
                        0
                    ),
                    1
                );


            const annualSurvival =
                (
                    1 -
                    turnover
                ) *
                (
                    1 -
                    mortality
                );


            return Math.pow(
                annualSurvival,
                kalanYil
            );
        };


    /* ============================================================
       10 — MAAŞ PROJEKSİYONU
    ============================================================ */

    TMS19.maasProjeksiyonu =
        function (
            mevcutMaas,
            kalanYil,
            varsayimlar
        ) {

            const salary =
                TMS19.sayi(
                    mevcutMaas
                );


            const salaryIncrease =
                Math.max(
                    0,
                    TMS19.sayi(
                        varsayimlar
                            ?.maasArtisOrani
                    )
                );


            const projected =
                salary *
                Math.pow(
                    1 +
                    salaryIncrease,
                    Math.max(
                        0,
                        kalanYil
                    )
                );


            return {

                mevcutMaas:
                    salary,

                emeklilikMaasi:
                    projected,

                artisOrani:
                    salaryIncrease,

                kalanYil:
                    Math.max(
                        0,
                        kalanYil
                    )
            };
        };


    /* ============================================================
       11 — İSKONTO FAKTÖRÜ
    ============================================================ */

    TMS19.iskontoFaktoru =
        function (
            iskontoOrani,
            yil
        ) {

            const rate =
                TMS19.sayi(
                    iskontoOrani
                );


            const years =
                Math.max(
                    0,
                    TMS19.sayi(
                        yil
                    )
                );


            if (
                rate <= -1
            ) {

                return 1;
            }


            return 1 /
                Math.pow(
                    1 +
                    rate,
                    years
                );
        };


    /* ============================================================
       12 — TEK PERSONEL AKTÜERYAL HESAPLAMA
    ============================================================ */

    TMS19.personelHesapla =
        function (
            personel,
            varsayimlar = {},
            index = 0
        ) {

            const p =
                TMS19.personelNormalizeEt(
                    personel
                );


            const validation =
                TMS19.personelValidate(
                    personel
                );


            if (
                !validation.valid
            ) {

                throw new Error(
                    validation.errors.join(
                        " "
                    )
                );
            }


            const degerlemeTarihi =
                TMS19.tarih(
                    varsayimlar
                        .degerlemeTarihi
                );


            const dogumTarihi =
                TMS19.tarih(
                    p.dogumTarihi
                );


            const iseGirisTarihi =
                TMS19.tarih(
                    p.iseGirisTarihi
                );


            const mevcutMaas =
                TMS19.sayi(
                    p.mevcutMaas
                );


            /* ----------------------------------------------------
               DEMOGRAFİ
            ---------------------------------------------------- */

            const yas =
                TMS19.yasHesapla(
                    dogumTarihi,
                    degerlemeTarihi
                );


            const hizmetSuresi =
                TMS19.yilFarki(
                    iseGirisTarihi,
                    degerlemeTarihi
                );


            const emeklilikYasi =
                TMS19.sayi(
                    varsayimlar
                        .emeklilikYasi
                );


            const emekliligeKalanYil =
                Math.max(
                    0,
                    emeklilikYasi -
                    yas
                );


            const toplamHizmet =
                hizmetSuresi +
                emekliligeKalanYil;


            /* ----------------------------------------------------
               MAAŞ
            ---------------------------------------------------- */

            const maas =
                TMS19.maasProjeksiyonu(
                    mevcutMaas,
                    emekliligeKalanYil,
                    varsayimlar
                );


            const emeklilikMaasi =
                maas.emeklilikMaasi;


            /* ----------------------------------------------------
               KIDEM TAVANI
            ---------------------------------------------------- */

            let faydaHesaplamaMaasi =
                emeklilikMaasi;


            let tavanUygulandi =
                false;


            let projectedCeiling =
                Infinity;


            const mevcutKidemTavani =
                TMS19.sayi(
                    varsayimlar
                        .kidemTavani
                );


            const kidemTavaniArtisOrani =
                TMS19.sayi(
                    varsayimlar
                        .kidemTavaniArtisOrani
                );


            if (
                isFinite(
                    mevcutKidemTavani
                ) &&
                mevcutKidemTavani > 0
            ) {

                projectedCeiling =
                    mevcutKidemTavani *
                    Math.pow(
                        1 +
                        kidemTavaniArtisOrani,
                        emekliligeKalanYil
                    );


                if (
                    faydaHesaplamaMaasi >
                    projectedCeiling
                ) {

                    faydaHesaplamaMaasi =
                        projectedCeiling;


                    tavanUygulandi =
                        true;
                }
            }


            /* ----------------------------------------------------
               FAYDA
            ---------------------------------------------------- */

            const faydaOrani =
                TMS19.sayi(
                    varsayimlar
                        .faydaOrani
                );


            const yillikFayda =
                faydaHesaplamaMaasi *
                faydaOrani;


            const toplamFayda =
                yillikFayda *
                toplamHizmet;


            /* ----------------------------------------------------
               GEÇMİŞ HİZMET
            ---------------------------------------------------- */

            const gecmisHizmetOrani =
                toplamHizmet > 0
                    ? Math.min(
                        1,
                        hizmetSuresi /
                        toplamHizmet
                    )
                    : 0;


            const kazanilmisFayda =
                toplamFayda *
                gecmisHizmetOrani;


            /* ----------------------------------------------------
               DEMOGRAFİK OLASILIK
            ---------------------------------------------------- */

            const devamOlasiligi =
                TMS19.devamOlasiligi(
                    emekliligeKalanYil,
                    varsayimlar
                );


            const beklenenFayda =
                kazanilmisFayda *
                devamOlasiligi;


            /* ----------------------------------------------------
               İSKONTO
            ---------------------------------------------------- */

            const iskontoOrani =
                TMS19.sayi(
                    varsayimlar
                        .iskontoOrani
                );


            const iskontoFaktoru =
                TMS19.iskontoFaktoru(
                    iskontoOrani,
                    emekliligeKalanYil
                );


            /* ----------------------------------------------------
               DBO
            ---------------------------------------------------- */

            const dbo =
                beklenenFayda *
                iskontoFaktoru;


            /* ----------------------------------------------------
               CARİ HİZMET MALİYETİ
            ---------------------------------------------------- */

            const birYillikFayda =
                toplamHizmet > 0
                    ? toplamFayda /
                    toplamHizmet
                    : 0;


            const cariHizmetMaliyeti =
                birYillikFayda *
                devamOlasiligi *
                iskontoFaktoru;


            /* ----------------------------------------------------
               FAİZ MALİYETİ

               Basitleştirilmiş:
               Opening DBO × iskonto oranı

               İlk dönem hesaplamasında opening DBO
               verilmemişse 0 döndürülür.
            ---------------------------------------------------- */

            const openingDBO =
                TMS19.sayi(
                    varsayimlar
                        .openingDBO
                );


            const faizMaliyeti =
                openingDBO *
                iskontoOrani;


            /* ----------------------------------------------------
               AKTÜERYAL SONUÇ
            ---------------------------------------------------- */

            return {

                index:
                    index,

                personel:
                    {

                        personelId:
                            p.personelId,

                        adSoyad:
                            p.adSoyad,

                        departman:
                            p.departman,

                        pozisyon:
                            p.pozisyon,

                        dogumTarihi:
                            p.dogumTarihi,

                        iseGirisTarihi:
                            p.iseGirisTarihi,

                        mevcutMaas:
                            mevcutMaas
                    },


                demografi:
                    {

                        yas:
                            yas,

                        hizmetSuresi:
                            hizmetSuresi,

                        emeklilikYasi:
                            emeklilikYasi,

                        emekliligeKalanYil:
                            emekliligeKalanYil,

                        toplamHizmet:
                            toplamHizmet,

                        devamOlasiligi:
                            devamOlasiligi
                    },


                maas:
                    {

                        mevcutMaas:
                            mevcutMaas,

                        emeklilikMaasi:
                            emeklilikMaasi,

                        faydaHesaplamaMaasi:
                            faydaHesaplamaMaasi,

                        maasArtisOrani:
                            maas.artisOrani
                    },


                kidemTavani:
                    {

                        mevcutTavan:
                            mevcutKidemTavani,

                        projectedCeiling:
                            projectedCeiling,

                        uygulandi:
                            tavanUygulandi,

                        tavanArtisOrani:
                            kidemTavaniArtisOrani
                    },


                hizmet:
                    {

                        gecmisHizmetOrani:
                            gecmisHizmetOrani,

                        kazanilmisFayda:
                            kazanilmisFayda,

                        toplamFayda:
                            toplamFayda,

                        yillikFayda:
                            yillikFayda
                    },


                demografik:
                    {

                        devamOlasiligi:
                            devamOlasiligi,

                        beklenenFayda:
                            beklenenFayda
                    },


                iskonto:
                    {

                        oran:
                            iskontoOrani,

                        yil:
                            emekliligeKalanYil,

                        faktor:
                            iskontoFaktoru
                    },


                muhasebe:
                    {

                        dbo:
                            dbo,

                        cariHizmetMaliyeti:
                            cariHizmetMaliyeti,

                        faizMaliyeti:
                            faizMaliyeti
                    },


                /*
                 * Portfolio Engine için
                 * hızlı erişim alanları
                 */

                dbo:
                    dbo,

                cariHizmetMaliyeti:
                    cariHizmetMaliyeti,

                faizMaliyeti:
                    faizMaliyeti,


                validation:
                    validation,


                metadata:
                    {

                        engine:
                            TMS19.engineName,

                        version:
                            TMS19.engineVersion,

                        calculationDate:
                            new Date()
                                .toISOString()
                    }
            };
        };


    /* ============================================================
       13 — TOPLU HESAPLAMA
    ============================================================ */

    TMS19.topluHesapla =
        function (
            personeller,
            varsayimlar = {}
        ) {

            if (
                !Array.isArray(
                    personeller
                )
            ) {

                throw new Error(
                    "Personel listesi array olmalıdır."
                );
            }


            const results =
                [];


            const errors =
                [];


            personeller.forEach(
                (
                    personel,
                    index
                ) => {

                    try {

                        const result =
                            TMS19.personelHesapla(
                                personel,
                                varsayimlar,
                                index
                            );


                        results.push(
                            result
                        );

                    }

                    catch (
                        error
                    ) {

                        errors.push({

                            index:
                                index,

                            personelId:
                                personel
                                    ?.personelId ??
                                "",

                            error:
                                error.message
                        });
                    }
                }
            );


            return {

                results:
                    results,

                errors:
                    errors,

                success:
                    errors.length === 0,

                total:
                    personeller.length,

                calculated:
                    results.length,

                failed:
                    errors.length
            };
        };


    /* ============================================================
       14 — ÖZET
    ============================================================ */

    TMS19.ozetOlustur =
        function (
            results
        ) {

            if (
                !Array.isArray(
                    results
                ) ||
                results.length === 0
            ) {

                return {

                    personelSayisi:
                        0,

                    toplamDBO:
                        0,

                    toplamCariHizmetMaliyeti:
                        0,

                    toplamFaizMaliyeti:
                        0,

                    toplamFayda:
                        0,

                    ortalamaYas:
                        0,

                    ortalamaHizmet:
                        0,

                    tavanUygulananPersonel:
                        0
                };
            }


            let dbo =
                0;


            let csc =
                0;


            let interest =
                0;


            let benefit =
                0;


            let age =
                0;


            let service =
                0;


            let ceilingCount =
                0;


            results.forEach(
                result => {

                    dbo +=
                        TMS19.sayi(
                            result.dbo
                        );


                    csc +=
                        TMS19.sayi(
                            result.cariHizmetMaliyeti
                        );


                    interest +=
                        TMS19.sayi(
                            result.faizMaliyeti
                        );


                    benefit +=
                        TMS19.sayi(
                            result.hizmet
                                ?.toplamFayda
                        );


                    age +=
                        TMS19.sayi(
                            result.demografi
                                ?.yas
                        );


                    service +=
                        TMS19.sayi(
                            result.demografi
                                ?.hizmetSuresi
                        );


                    if (
                        result.kidemTavani
                            ?.uygulandi
                    ) {

                        ceilingCount++;
                    }
                }
            );


            return {

                personelSayisi:
                    results.length,

                toplamDBO:
                    dbo,

                toplamCariHizmetMaliyeti:
                    csc,

                toplamFaizMaliyeti:
                    interest,

                toplamFayda:
                    benefit,

                ortalamaYas:
                    age /
                    results.length,

                ortalamaHizmet:
                    service /
                    results.length,

                tavanUygulananPersonel:
                    ceilingCount,

                dboMaasOrani:
                    0
            };
        };


    /* ============================================================
       15 — HEALTH CHECK
    ============================================================ */

    TMS19.actuarialHealthCheck =
        function () {

            return {

                status:
                    "OK",

                engine:
                    TMS19.engineName,

                version:
                    TMS19.engineVersion,

                functions:
                    {

                        sayi:
                            typeof TMS19.sayi ===
                            "function",

                        tarih:
                            typeof TMS19.tarih ===
                            "function",

                        yasHesapla:
                            typeof TMS19.yasHesapla ===
                            "function",

                        personelNormalizeEt:
                            typeof TMS19.personelNormalizeEt ===
                            "function",

                        personelValidate:
                            typeof TMS19.personelValidate ===
                            "function",

                        maasProjeksiyonu:
                            typeof TMS19.maasProjeksiyonu ===
                            "function",

                        devamOlasiligi:
                            typeof TMS19.devamOlasiligi ===
                            "function",

                        iskontoFaktoru:
                            typeof TMS19.iskontoFaktoru ===
                            "function",

                        personelHesapla:
                            typeof TMS19.personelHesapla ===
                            "function",

                        topluHesapla:
                            typeof TMS19.topluHesapla ===
                            "function"
                    },

                timestamp:
                    new Date()
                        .toISOString()
            };
        };


    /* ============================================================
       16 — GLOBAL EXPORT
    ============================================================ */

    global.TMS19 =
        TMS19;


    /*
     * Backward compatibility
     */

    global.TMS19ActuarialEngine =
        TMS19;


})(typeof window !== "undefined"
    ? window
    : globalThis);

/* ================================================================
   TMS 19 — PERIODIC ACTUARIAL ENGINE
   ----------------------------------------------------------------
   Opening DBO
   + Current Service Cost
   + Interest Cost
   + Past Service Cost
   + Actuarial Gain / Loss
   - Benefits Paid
   = Closing DBO

   GK Financial Decision Cockpit
================================================================ */


/* ================================================================
   17 — AÇILIŞ DBO
================================================================ */

TMS19.acilisDBOHesapla =
    function (
        personel,
        varsayimlar = {}
    ) {

        const openingDBO =
            TMS19.sayi(
                personel?.openingDBO ??
                personel?.acilisDBO ??
                varsayimlar?.openingDBO
            );


        return Math.max(
            0,
            openingDBO
        );
    };


/* ================================================================
   18 — CARİ HİZMET MALİYETİ
================================================================ */

TMS19.cariHizmetMaliyetiHesapla =
    function (
        hesap
    ) {

        if (
            !hesap
        ) {

            return 0;
        }


        return Math.max(
            0,
            TMS19.sayi(
                hesap.cariHizmetMaliyeti
            )
        );
    };


/* ================================================================
   19 — FAİZ MALİYETİ
================================================================ */

TMS19.faizMaliyetiHesapla =
    function (
        openingDBO,
        iskontoOrani
    ) {

        const dbo =
            Math.max(
                0,
                TMS19.sayi(
                    openingDBO
                )
            );


        const rate =
            TMS19.sayi(
                iskontoOrani
            );


        return dbo * rate;
    };


/* ================================================================
   20 — PAST SERVICE COST
================================================================ */

TMS19.gecmisHizmetMaliyetiHesapla =
    function (
        personel,
        varsayimlar = {}
    ) {

        /*
         * Varsayılan olarak geçmiş hizmet maliyeti yoktur.
         *
         * Ancak sistemde manuel olarak girilebilmesi gerekir.
         */

        const value =
            personel?.pastServiceCost ??
            personel?.gecmisHizmetMaliyeti ??
            varsayimlar?.pastServiceCost ??
            0;


        return TMS19.sayi(
            value
        );
    };


/* ================================================================
   21 — ÖDENEN FAYDALAR
================================================================ */

TMS19.odenenFaydaHesapla =
    function (
        personel,
        varsayimlar = {}
    ) {

        const value =
            personel?.benefitsPaid ??
            personel?.odenenFayda ??
            varsayimlar?.benefitsPaid ??
            0;


        return Math.max(
            0,
            TMS19.sayi(
                value
            )
        );
    };


/* ================================================================
   22 — AKTÜERYAL KAZANÇ / KAYIP
================================================================ */

TMS19.aktueryalKazancKayipHesapla =
    function (
        openingDBO,
        currentServiceCost,
        interestCost,
        pastServiceCost,
        benefitsPaid,
        closingDBO
    ) {

        /*
         * DBO reconciliation:
         *
         * Opening DBO
         * + Current Service Cost
         * + Interest Cost
         * + Past Service Cost
         * + Actuarial Gain/Loss
         * - Benefits Paid
         * = Closing DBO
         *
         * Dolayısıyla:
         *
         * Actuarial Gain/Loss =
         * Closing DBO
         * - Opening DBO
         * - CSC
         * - Interest
         * - PSC
         * + Benefits Paid
         */


        const opening =
            TMS19.sayi(
                openingDBO
            );


        const csc =
            TMS19.sayi(
                currentServiceCost
            );


        const interest =
            TMS19.sayi(
                interestCost
            );


        const psc =
            TMS19.sayi(
                pastServiceCost
            );


        const benefits =
            TMS19.sayi(
                benefitsPaid
            );


        const closing =
            TMS19.sayi(
                closingDBO
            );


        return (
            closing -
            opening -
            csc -
            interest -
            psc +
            benefits
        );
    };


/* ================================================================
   23 — KAPANIŞ DBO
================================================================ */

TMS19.kapanisDBOHesapla =
    function (
        openingDBO,
        currentServiceCost,
        interestCost,
        pastServiceCost,
        actuarialGainLoss,
        benefitsPaid
    ) {

        const opening =
            TMS19.sayi(
                openingDBO
            );


        const csc =
            TMS19.sayi(
                currentServiceCost
            );


        const interest =
            TMS19.sayi(
                interestCost
            );


        const psc =
            TMS19.sayi(
                pastServiceCost
            );


        const actuarial =
            TMS19.sayi(
                actuarialGainLoss
            );


        const benefits =
            TMS19.sayi(
                benefitsPaid
            );


        return Math.max(
            0,
            opening +
            csc +
            interest +
            psc +
            actuarial -
            benefits
        );
    };


/* ================================================================
   24 — DBO RECONCILIATION
================================================================ */

TMS19.dboReconciliation =
    function (
        input = {}
    ) {

        const openingDBO =
            TMS19.sayi(
                input.openingDBO
            );


        const currentServiceCost =
            TMS19.sayi(
                input.currentServiceCost
            );


        const interestCost =
            TMS19.sayi(
                input.interestCost
            );


        const pastServiceCost =
            TMS19.sayi(
                input.pastServiceCost
            );


        const actuarialGainLoss =
            TMS19.sayi(
                input.actuarialGainLoss
            );


        const benefitsPaid =
            TMS19.sayi(
                input.benefitsPaid
            );


        const closingDBO =
            TMS19.kapanisDBOHesapla(
                openingDBO,
                currentServiceCost,
                interestCost,
                pastServiceCost,
                actuarialGainLoss,
                benefitsPaid
            );


        return {

            openingDBO:
                openingDBO,

            currentServiceCost:
                currentServiceCost,

            interestCost:
                interestCost,

            pastServiceCost:
                pastServiceCost,

            actuarialGainLoss:
                actuarialGainLoss,

            benefitsPaid:
                benefitsPaid,

            closingDBO:
                closingDBO,


            /*
             * Kontrol:
             *
             * Eğer sistem dışından closing DBO
             * girildiyse farkı hesapla.
             */

            externalClosingDBO:
                input.externalClosingDBO !==
                undefined
                    ? TMS19.sayi(
                        input.externalClosingDBO
                    )
                    : null,


            reconciliationDifference:
                input.externalClosingDBO !==
                undefined
                    ? closingDBO -
                      TMS19.sayi(
                          input.externalClosingDBO
                      )
                    : 0,


            balanced:
                input.externalClosingDBO !==
                undefined
                    ? Math.abs(
                        closingDBO -
                        TMS19.sayi(
                            input.externalClosingDBO
                        )
                      ) < 0.01
                    : true
        };
    };


/* ================================================================
   25 — PERSONEL DÖNEMSEL AKTÜERYAL HESABI
================================================================ */

TMS19.personelDonemHesapla =
    function (
        personel,
        varsayimlar = {},
        index = 0
    ) {

        /*
         * Önce temel aktüeryal hesap.
         */

        const valuation =
            TMS19.personelHesapla(
                personel,
                varsayimlar,
                index
            );


        /*
         * Opening DBO
         */

        const openingDBO =
            TMS19.acilisDBOHesapla(
                personel,
                varsayimlar
            );


        /*
         * Current Service Cost
         */

        const currentServiceCost =
            TMS19.cariHizmetMaliyetiHesapla(
                valuation
            );


        /*
         * Interest Cost
         */

        const interestCost =
            TMS19.faizMaliyetiHesapla(
                openingDBO,
                varsayimlar.iskontoOrani
            );


        /*
         * Past Service Cost
         */

        const pastServiceCost =
            TMS19.gecmisHizmetMaliyetiHesapla(
                personel,
                varsayimlar
            );


        /*
         * Benefits Paid
         */

        const benefitsPaid =
            TMS19.odenenFaydaHesapla(
                personel,
                varsayimlar
            );


        /*
         * Eğer closing DBO dışarıdan verilmişse
         * actuarial gain/loss residual olarak hesaplanır.
         */

        const externalClosingDBO =
            personel?.closingDBO ??
            personel?.kapanisDBO ??
            null;


        let actuarialGainLoss =
            TMS19.sayi(
                personel?.actuarialGainLoss ??
                personel?.aktueryalKazancKayip ??
                0
            );


        if (
            externalClosingDBO !==
            null &&
            externalClosingDBO !==
            undefined
        ) {

            actuarialGainLoss =
                TMS19.aktueryalKazancKayipHesapla(
                    openingDBO,
                    currentServiceCost,
                    interestCost,
                    pastServiceCost,
                    benefitsPaid,
                    externalClosingDBO
                );
        }


        /*
         * Closing DBO
         */

        const reconciliation =
            TMS19.dboReconciliation({

                openingDBO:
                    openingDBO,

                currentServiceCost:
                    currentServiceCost,

                interestCost:
                    interestCost,

                pastServiceCost:
                    pastServiceCost,

                actuarialGainLoss:
                    actuarialGainLoss,

                benefitsPaid:
                    benefitsPaid,

                externalClosingDBO:
                    externalClosingDBO
            });


        return {

            ...valuation,


            period:
                {

                    openingDBO:
                        openingDBO,

                    currentServiceCost:
                        currentServiceCost,

                    interestCost:
                        interestCost,

                    pastServiceCost:
                        pastServiceCost,

                    actuarialGainLoss:
                        actuarialGainLoss,

                    benefitsPaid:
                        benefitsPaid,

                    closingDBO:
                        reconciliation
                            .closingDBO
                },


            reconciliation:
                reconciliation
        };
    };


/* ================================================================
   26 — PORTFÖY DÖNEMSEL HESAPLAMA
================================================================ */

TMS19.portfoyDonemHesapla =
    function (
        personeller,
        varsayimlar = {}
    ) {

        if (
            !Array.isArray(
                personeller
            )
        ) {

            throw new Error(
                "Personel listesi array olmalıdır."
            );
        }


        const results =
            [];


        const errors =
            [];


        personeller.forEach(
            (
                personel,
                index
            ) => {

                try {

                    const result =
                        TMS19.personelDonemHesapla(
                            personel,
                            varsayimlar,
                            index
                        );


                    results.push(
                        result
                    );

                }

                catch (
                    error
                ) {

                    errors.push({

                        index:
                            index,

                        personelId:
                            personel?.personelId ??
                            personel?.id ??
                            "",

                        error:
                            error.message
                    });
                }
            }
        );


        /*
         * Portfolio totals
         */

        let openingDBO =
            0;


        let currentServiceCost =
            0;


        let interestCost =
            0;


        let pastServiceCost =
            0;


        let actuarialGainLoss =
            0;


        let benefitsPaid =
            0;


        let closingDBO =
            0;


        results.forEach(
            result => {

                openingDBO +=
                    TMS19.sayi(
                        result.period
                            ?.openingDBO
                    );


                currentServiceCost +=
                    TMS19.sayi(
                        result.period
                            ?.currentServiceCost
                    );


                interestCost +=
                    TMS19.sayi(
                        result.period
                            ?.interestCost
                    );


                pastServiceCost +=
                    TMS19.sayi(
                        result.period
                            ?.pastServiceCost
                    );


                actuarialGainLoss +=
                    TMS19.sayi(
                        result.period
                            ?.actuarialGainLoss
                    );


                benefitsPaid +=
                    TMS19.sayi(
                        result.period
                            ?.benefitsPaid
                    );


                closingDBO +=
                    TMS19.sayi(
                        result.period
                            ?.closingDBO
                    );
            }
        );


        /*
         * Portfolio reconciliation
         */

        const expectedClosing =
            openingDBO +
            currentServiceCost +
            interestCost +
            pastServiceCost +
            actuarialGainLoss -
            benefitsPaid;


        const difference =
            closingDBO -
            expectedClosing;


        return {

            results:
                results,

            errors:
                errors,


            summary:
                {

                    personelSayisi:
                        personeller.length,

                    hesaplananPersonel:
                        results.length,

                    hataliPersonel:
                        errors.length,

                    openingDBO:
                        openingDBO,

                    currentServiceCost:
                        currentServiceCost,

                    interestCost:
                        interestCost,

                    pastServiceCost:
                        pastServiceCost,

                    actuarialGainLoss:
                        actuarialGainLoss,

                    benefitsPaid:
                        benefitsPaid,

                    closingDBO:
                        closingDBO,

                    expectedClosingDBO:
                        expectedClosing,

                    reconciliationDifference:
                        difference,

                    balanced:
                        Math.abs(
                            difference
                        ) < 0.01
                },


            success:
                errors.length === 0
        };
    };


/* ================================================================
   27 — P&L / OCI AYRIŞTIRMASI
================================================================ */

TMS19.muhasebeEtkiHesapla =
    function (
        period = {}
    ) {

        const currentServiceCost =
            TMS19.sayi(
                period.currentServiceCost
            );


        const pastServiceCost =
            TMS19.sayi(
                period.pastServiceCost
            );


        const interestCost =
            TMS19.sayi(
                period.interestCost
            );


        const actuarialGainLoss =
            TMS19.sayi(
                period.actuarialGainLoss
            );


        /*
         * IAS 19 mantığında:
         *
         * P&L:
         * Current service cost
         * Past service cost
         * Net interest
         *
         * OCI:
         * Remeasurement
         *
         * Burada remeasurement'ın ana bileşeni
         * aktüeryal kazanç/kayıptır.
         */

        const profitLoss =
            currentServiceCost +
            pastServiceCost +
            interestCost;


        const oci =
            actuarialGainLoss;


        const totalDefinedBenefitCost =
            profitLoss +
            oci;


        return {

            karZarar:
                {

                    cariHizmetMaliyeti:
                        currentServiceCost,

                    gecmisHizmetMaliyeti:
                        pastServiceCost,

                    netFaizMaliyeti:
                        interestCost,

                    toplam:
                        profitLoss
                },


            digerKapsamliGelir:
                {

                    aktueryalKazancKayip:
                        oci,

                    toplam:
                        oci
                },


            toplamAktueryalEtki:
                totalDefinedBenefitCost
        };
    };


/* ================================================================
   28 — SENSITIVITY ANALYSIS
================================================================ */

TMS19.senaryoHesapla =
    function (
        personeller,
        varsayimlar,
        degisiklikler = {}
    ) {

        const baseAssumptions =
            {
                ...varsayimlar
            };


        const scenarioAssumptions =
            {
                ...varsayimlar,
                ...degisiklikler
            };


        const base =
            TMS19.portfoyDonemHesapla(
                personeller,
                baseAssumptions
            );


        const scenario =
            TMS19.portfoyDonemHesapla(
                personeller,
                scenarioAssumptions
            );


        const baseDBO =
            TMS19.sayi(
                base.summary
                    .closingDBO
            );


        const scenarioDBO =
            TMS19.sayi(
                scenario.summary
                    .closingDBO
            );


        const difference =
            scenarioDBO -
            baseDBO;


        const percentage =
            baseDBO !== 0
                ? difference /
                  Math.abs(
                      baseDBO
                  )
                : 0;


        return {

            base:
                base,

            scenario:
                scenario,

            impact:
                {

                    dboDifference:
                        difference,

                    dboPercentage:
                        percentage
                }
        };
    };


/* ================================================================
   29 — İSKONTO SENSİTİVİTESİ
================================================================ */

TMS19.iskontoSensitivitesi =
    function (
        personeller,
        varsayimlar,
        basisPoints = 100
    ) {

        const rate =
            TMS19.sayi(
                varsayimlar
                    .iskontoOrani
            );


        const change =
            TMS19.sayi(
                basisPoints
            ) / 10000;


        const lowerRate =
            rate -
            change;


        const upperRate =
            rate +
            change;


        const lower =
            TMS19.senaryoHesapla(
                personeller,
                varsayimlar,
                {
                    iskontoOrani:
                        lowerRate
                }
            );


        const upper =
            TMS19.senaryoHesapla(
                personeller,
                varsayimlar,
                {
                    iskontoOrani:
                        upperRate
                }
            );


        return {

            baseRate:
                rate,

            lowerRate:
                lowerRate,

            upperRate:
                upperRate,

            lower:
                lower,

            upper:
                upper
        };
    };


/* ================================================================
   30 — MAAŞ SENSİTİVİTESİ
================================================================ */

TMS19.maasArtisSensitivitesi =
    function (
        personeller,
        varsayimlar,
        basisPoints = 100
    ) {

        const rate =
            TMS19.sayi(
                varsayimlar
                    .maasArtisOrani
            );


        const change =
            TMS19.sayi(
                basisPoints
            ) / 10000;


        const lowerRate =
            Math.max(
                0,
                rate -
                change
            );


        const upperRate =
            rate +
            change;


        const lower =
            TMS19.senaryoHesapla(
                personeller,
                varsayimlar,
                {
                    maasArtisOrani:
                        lowerRate
                }
            );


        const upper =
            TMS19.senaryoHesapla(
                personeller,
                varsayimlar,
                {
                    maasArtisOrani:
                        upperRate
                }
            );


        return {

            baseRate:
                rate,

            lowerRate:
                lowerRate,

            upperRate:
                upperRate,

            lower:
                lower,

            upper:
                upper
        };
    };


/* ================================================================
   31 — AKTÜERYAL ENGINE HEALTH CHECK
================================================================ */

TMS19.periodicEngineHealthCheck =
    function () {

        const requiredFunctions =
            [

                "personelHesapla",

                "acilisDBOHesapla",

                "cariHizmetMaliyetiHesapla",

                "faizMaliyetiHesapla",

                "gecmisHizmetMaliyetiHesapla",

                "odenenFaydaHesapla",

                "aktueryalKazancKayipHesapla",

                "kapanisDBOHesapla",

                "dboReconciliation",

                "personelDonemHesapla",

                "portfoyDonemHesapla",

                "muhasebeEtkiHesapla",

                "senaryoHesapla",

                "iskontoSensitivitesi",

                "maasArtisSensitivitesi"
            ];


        const status =
            {};


        let healthy =
            true;


        requiredFunctions.forEach(
            functionName => {

                const exists =
                    typeof TMS19[
                        functionName
                    ] ===
                    "function";


                status[
                    functionName
                ] =
                    exists;


                if (
                    !exists
                ) {

                    healthy =
                        false;
                }
            }
        );


        return {

            healthy:
                healthy,

            engine:
                "TMS19 Periodic Actuarial Engine",

            functions:
                status,

            timestamp:
                new Date()
                    .toISOString()
        };
    };

/* ================================================================
   TMS 19 — ACCOUNTING ENGINE
   ----------------------------------------------------------------
   DBO
   PLAN ASSETS
   NET DEFINED BENEFIT LIABILITY / ASSET
   P&L
   OCI
   EQUITY
   ROLL-FORWARD
================================================================ */


/* ================================================================
   32 — PLAN ASSET HESAPLA
================================================================ */

TMS19.planVarlikHesapla =
    function (
        personel,
        varsayimlar = {}
    ) {

        const value =
            personel?.planAssets ??
            personel?.planVarliklari ??
            varsayimlar?.planAssets ??
            varsayimlar?.planVarliklari ??
            0;


        return Math.max(
            0,
            TMS19.sayi(
                value
            )
        );
    };


/* ================================================================
   33 — NET TANIMLI FAYDA YÜKÜMLÜLÜĞÜ
================================================================ */

TMS19.netDefinedBenefitHesapla =
    function (
        dbo,
        planAssets
    ) {

        const definedBenefitObligation =
            Math.max(
                0,
                TMS19.sayi(
                    dbo
                )
            );


        const assets =
            Math.max(
                0,
                TMS19.sayi(
                    planAssets
                )
            );


        const netPosition =
            definedBenefitObligation -
            assets;


        return {

            dbo:
                definedBenefitObligation,

            planAssets:
                assets,

            netPosition:
                netPosition,

            /*
             * Pozitif:
             * Net Defined Benefit Liability
             *
             * Negatif:
             * Net Defined Benefit Asset
             */

            liability:
                Math.max(
                    0,
                    netPosition
                ),

            asset:
                Math.max(
                    0,
                    -netPosition
                ),

            position:
                netPosition >= 0
                    ? "LIABILITY"
                    : "ASSET"
        };
    };


/* ================================================================
   34 — PLAN VARLIKLARI HAREKETİ
================================================================ */

TMS19.planVarlikRollForward =
    function (
        input = {}
    ) {

        const openingAssets =
            Math.max(
                0,
                TMS19.sayi(
                    input.openingPlanAssets
                )
            );


        const expectedReturn =
            TMS19.sayi(
                input.expectedReturn
            );


        const employerContributions =
            Math.max(
                0,
                TMS19.sayi(
                    input.employerContributions
                )
            );


        const employeeContributions =
            Math.max(
                0,
                TMS19.sayi(
                    input.employeeContributions
                )
            );


        const benefitsPaid =
            Math.max(
                0,
                TMS19.sayi(
                    input.benefitsPaid
                )
            );


        const actuarialGainLoss =
            TMS19.sayi(
                input.actuarialGainLoss
            );


        const closingAssets =
            Math.max(
                0,
                openingAssets +
                expectedReturn +
                employerContributions +
                employeeContributions -
                benefitsPaid +
                actuarialGainLoss
            );


        return {

            openingPlanAssets:
                openingAssets,

            expectedReturn:
                expectedReturn,

            employerContributions:
                employerContributions,

            employeeContributions:
                employeeContributions,

            benefitsPaid:
                benefitsPaid,

            actuarialGainLoss:
                actuarialGainLoss,

            closingPlanAssets:
                closingAssets
        };
    };


/* ================================================================
   35 — NET FAİZ MALİYETİ
================================================================ */

TMS19.netFaizMaliyetiHesapla =
    function (
        openingDBO,
        openingPlanAssets,
        discountRate
    ) {

        const dbo =
            Math.max(
                0,
                TMS19.sayi(
                    openingDBO
                )
            );


        const assets =
            Math.max(
                0,
                TMS19.sayi(
                    openingPlanAssets
                )
            );


        const rate =
            TMS19.sayi(
                discountRate
            );


        /*
         * Net defined benefit liability /
         * asset × discount rate
         */

        return (
            dbo -
            assets
        ) * rate;
    };


/* ================================================================
   36 — P&L HESAPLA
================================================================ */

TMS19.karZararHesapla =
    function (
        input = {}
    ) {

        const currentServiceCost =
            TMS19.sayi(
                input.currentServiceCost
            );


        const pastServiceCost =
            TMS19.sayi(
                input.pastServiceCost
            );


        const netInterestCost =
            TMS19.sayi(
                input.netInterestCost
            );


        /*
         * TMS 19 P&L:
         *
         * Current Service Cost
         * + Past Service Cost
         * + Net Interest
         */

        const total =
            currentServiceCost +
            pastServiceCost +
            netInterestCost;


        return {

            currentServiceCost:
                currentServiceCost,

            pastServiceCost:
                pastServiceCost,

            netInterestCost:
                netInterestCost,

            total:
                total
        };
    };


/* ================================================================
   37 — OCI / REMEASUREMENT
================================================================ */

TMS19.ociHesapla =
    function (
        input = {}
    ) {

        const actuarialGainLossDBO =
            TMS19.sayi(
                input.actuarialGainLossDBO
            );


        const actuarialGainLossPlanAssets =
            TMS19.sayi(
                input.actuarialGainLossPlanAssets
            );


        /*
         * Remeasurement:
         *
         * DBO actuarial gain/loss
         * +
         * Plan asset return
         * excluding net interest
         */

        const remeasurement =
            actuarialGainLossDBO +
            actuarialGainLossPlanAssets;


        return {

            actuarialGainLossDBO:
                actuarialGainLossDBO,

            actuarialGainLossPlanAssets:
                actuarialGainLossPlanAssets,

            remeasurement:
                remeasurement
        };
    };


/* ================================================================
   38 — TAM MUHASEBE ETKİSİ
================================================================ */

TMS19.tamMuhasebeEtkiHesapla =
    function (
        input = {}
    ) {

        const profitLoss =
            TMS19.karZararHesapla({

                currentServiceCost:
                    input.currentServiceCost,

                pastServiceCost:
                    input.pastServiceCost,

                netInterestCost:
                    input.netInterestCost
            });


        const oci =
            TMS19.ociHesapla({

                actuarialGainLossDBO:
                    input.actuarialGainLossDBO,

                actuarialGainLossPlanAssets:
                    input.actuarialGainLossPlanAssets
            });


        const totalExpense =
            profitLoss.total +
            oci.remeasurement;


        return {

            profitLoss:
                profitLoss,

            oci:
                oci,

            totalDefinedBenefitEffect:
                totalExpense
        };
    };


/* ================================================================
   39 — NET DEFINED BENEFIT ROLL-FORWARD
================================================================ */

TMS19.netDefinedBenefitRollForward =
    function (
        input = {}
    ) {

        const openingDBO =
            TMS19.sayi(
                input.openingDBO
            );


        const openingPlanAssets =
            TMS19.sayi(
                input.openingPlanAssets
            );


        const closingDBO =
            TMS19.sayi(
                input.closingDBO
            );


        const closingPlanAssets =
            TMS19.sayi(
                input.closingPlanAssets
            );


        const openingNet =
            openingDBO -
            openingPlanAssets;


        const closingNet =
            closingDBO -
            closingPlanAssets;


        const movement =
            closingNet -
            openingNet;


        return {

            openingDBO:
                openingDBO,

            openingPlanAssets:
                openingPlanAssets,

            openingNetDefinedBenefitPosition:
                openingNet,

            closingDBO:
                closingDBO,

            closingPlanAssets:
                closingPlanAssets,

            closingNetDefinedBenefitPosition:
                closingNet,

            netMovement:
                movement,

            closingLiability:
                Math.max(
                    0,
                    closingNet
                ),

            closingAsset:
                Math.max(
                    0,
                    -closingNet
                ),

            position:
                closingNet >= 0
                    ? "LIABILITY"
                    : "ASSET"
        };
    };


/* ================================================================
   40 — PERSONEL MUHASEBE HESABI
================================================================ */

TMS19.personelMuhasebeHesapla =
    function (
        personel,
        varsayimlar = {},
        index = 0
    ) {

        const actuarial =
            TMS19.personelDonemHesapla(
                personel,
                varsayimlar,
                index
            );


        const period =
            actuarial.period ||
            {};


        const openingPlanAssets =
            TMS19.sayi(
                personel?.openingPlanAssets ??
                personel?.acilisPlanVarliklari ??
                varsayimlar?.openingPlanAssets ??
                0
            );


        const planAssets =
            TMS19.planVarlikHesapla(
                personel,
                varsayimlar
            );


        const netInterestCost =
            TMS19.netFaizMaliyetiHesapla(
                period.openingDBO,
                openingPlanAssets,
                varsayimlar.iskontoOrani
            );


        const profitLoss =
            TMS19.karZararHesapla({

                currentServiceCost:
                    period.currentServiceCost,

                pastServiceCost:
                    period.pastServiceCost,

                netInterestCost:
                    netInterestCost
            });


        const oci =
            TMS19.ociHesapla({

                actuarialGainLossDBO:
                    period.actuarialGainLoss,

                actuarialGainLossPlanAssets:
                    0
            });


        const netPosition =
            TMS19.netDefinedBenefitHesapla(
                period.closingDBO,
                planAssets
            );


        const rollForward =
            TMS19.netDefinedBenefitRollForward({

                openingDBO:
                    period.openingDBO,

                openingPlanAssets:
                    openingPlanAssets,

                closingDBO:
                    period.closingDBO,

                closingPlanAssets:
                    planAssets
            });


        return {

            ...actuarial,


            accounting:
                {

                    planAssets:
                        planAssets,

                    netInterestCost:
                        netInterestCost,

                    netDefinedBenefit:
                        netPosition,

                    profitLoss:
                        profitLoss,

                    oci:
                        oci,

                    rollForward:
                        rollForward
                }
        };
    };


/* ================================================================
   41 — PORTFÖY MUHASEBE HESABI
================================================================ */

TMS19.portfoyMuhasebeHesapla =
    function (
        personeller,
        varsayimlar = {}
    ) {

        if (
            !Array.isArray(
                personeller
            )
        ) {

            throw new Error(
                "Personel listesi array olmalıdır."
            );
        }


        const results =
            [];


        const errors =
            [];


        personeller.forEach(
            (
                personel,
                index
            ) => {

                try {

                    results.push(
                        TMS19.personelMuhasebeHesapla(
                            personel,
                            varsayimlar,
                            index
                        )
                    );

                }
                catch (
                    error
                ) {

                    errors.push({

                        index:
                            index,

                        personelId:
                            personel?.personelId ??
                            personel?.id ??
                            "",

                        error:
                            error.message
                    });
                }
            }
        );


        let dbo =
            0;


        let planAssets =
            0;


        let netPosition =
            0;


        let currentServiceCost =
            0;


        let pastServiceCost =
            0;


        let netInterestCost =
            0;


        let oci =
            0;


        results.forEach(
            result => {

                dbo +=
                    TMS19.sayi(
                        result.accounting
                            ?.netDefinedBenefit
                            ?.dbo
                    );


                planAssets +=
                    TMS19.sayi(
                        result.accounting
                            ?.netDefinedBenefit
                            ?.planAssets
                    );


                netPosition +=
                    TMS19.sayi(
                        result.accounting
                            ?.netDefinedBenefit
                            ?.netPosition
                    );


                currentServiceCost +=
                    TMS19.sayi(
                        result.accounting
                            ?.profitLoss
                            ?.currentServiceCost
                    );


                pastServiceCost +=
                    TMS19.sayi(
                        result.accounting
                            ?.profitLoss
                            ?.pastServiceCost
                    );


                netInterestCost +=
                    TMS19.sayi(
                        result.accounting
                            ?.profitLoss
                            ?.netInterestCost
                    );


                oci +=
                    TMS19.sayi(
                        result.accounting
                            ?.oci
                            ?.remeasurement
                    );
            }
        );


        return {

            results:
                results,

            errors:
                errors,

            summary:
                {

                    personelSayisi:
                        personeller.length,

                    hesaplananPersonel:
                        results.length,

                    hataliPersonel:
                        errors.length,

                    toplamDBO:
                        dbo,

                    toplamPlanVarligi:
                        planAssets,

                    netDefinedBenefitPosition:
                        netPosition,

                    netDefinedBenefitLiability:
                        Math.max(
                            0,
                            netPosition
                        ),

                    netDefinedBenefitAsset:
                        Math.max(
                            0,
                            -netPosition
                        ),

                    cariHizmetMaliyeti:
                        currentServiceCost,

                    gecmisHizmetMaliyeti:
                        pastServiceCost,

                    netFaizMaliyeti:
                        netInterestCost,

                    oci:
                        oci,

                    toplamKarZararEtkisi:
                        currentServiceCost +
                        pastServiceCost +
                        netInterestCost
                },

            success:
                errors.length === 0
        };
    };
