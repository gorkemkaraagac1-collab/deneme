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
