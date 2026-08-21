"use strict";

/* ================================================================
   GK ADVISORY — TMS 19 ACTUARIAL ENGINE
   TMS 19 / IAS 19
   Projected Unit Credit (PUC)
   
   Version:
   - Robust personnel normalization
   - Turkish character tolerant field mapping
   - Excel / CSV / HTML compatible
   - Date normalization
   - PUC calculation
   - DBO
   - Current service cost
   - Net interest
   - Sensitivity analysis
   - Dashboard integration
================================================================ */

(function (window) {

    const TMS19 = {};

    /* ============================================================
       1. GENEL YARDIMCI FONKSİYONLAR
    ============================================================ */

    TMS19.sayi = function (value, defaultValue = 0) {

        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {
            return defaultValue;
        }

        if (typeof value === "number") {

            return isFinite(value)
                ? value
                : defaultValue;
        }

        let text = String(value)
            .trim()
            .replace(/TL/gi, "")
            .replace(/₺/g, "")
            .replace(/\s/g, "");

        /*
         * Türkçe / Avrupa formatı:
         * 1.234.567,89
         */
        if (
            text.includes(".") &&
            text.includes(",")
        ) {

            text = text
                .replace(/\./g, "")
                .replace(",", ".");

        } else if (
            text.includes(",")
        ) {

            text = text.replace(",", ".");

        } else if (
            text.includes(".")
        ) {

            /*
             * 50.000 gibi Türkçe sayı formatlarını
             * güvenli şekilde ele al.
             */
            const parts = text.split(".");

            if (
                parts.length === 2 &&
                parts[1].length === 3
            ) {

                text =
                    parts[0] +
                    parts[1];
            }
        }

        const number = Number(text);

        return isFinite(number)
            ? number
            : defaultValue;
    };


    TMS19.oran = function (
        value,
        defaultValue = 0
    ) {

        let oran =
            TMS19.sayi(
                value,
                defaultValue
            );

        if (Math.abs(oran) > 1) {
            oran = oran / 100;
        }

        return oran;
    };


    /* ============================================================
       2. FIELD KEY NORMALIZATION
    ============================================================ */

    TMS19.alanAdiNormalizeEt = function (value) {

        return String(value || "")
            .trim()
            .toLocaleLowerCase("tr-TR")
            .replace(/ı/g, "i")
            .replace(/İ/g, "i")
            .replace(/ğ/g, "g")
            .replace(/Ğ/g, "g")
            .replace(/ü/g, "u")
            .replace(/Ü/g, "u")
            .replace(/ş/g, "s")
            .replace(/Ş/g, "s")
            .replace(/ö/g, "o")
            .replace(/Ö/g, "o")
            .replace(/ç/g, "c")
            .replace(/Ç/g, "c")
            .replace(/[^a-z0-9]/g, "");
    };


    /* ============================================================
       3. TARİH
    ============================================================ */

    TMS19.tarih = function (value) {

        if (!value) {
            return null;
        }

        if (value instanceof Date) {

            return isNaN(value.getTime())
                ? null
                : value;
        }

        /*
         * Excel serial date
         */
        if (
            typeof value === "number" &&
            value > 20000 &&
            value < 100000
        ) {

            const excelEpoch =
                new Date(Date.UTC(1899, 11, 30));

            const date =
                new Date(
                    excelEpoch.getTime() +
                    value *
                    24 *
                    60 *
                    60 *
                    1000
                );

            return isNaN(date.getTime())
                ? null
                : date;
        }

        const text =
            String(value).trim();

        /*
         * DD.MM.YYYY
         */
        if (
            /^\d{1,2}\.\d{1,2}\.\d{4}$/.test(text)
        ) {

            const p =
                text.split(".");

            const date =
                new Date(
                    Number(p[2]),
                    Number(p[1]) - 1,
                    Number(p[0])
                );

            return isNaN(date.getTime())
                ? null
                : date;
        }


        /*
         * DD/MM/YYYY
         */
        if (
            /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(text)
        ) {

            const p =
                text.split("/");

            const date =
                new Date(
                    Number(p[2]),
                    Number(p[1]) - 1,
                    Number(p[0])
                );

            return isNaN(date.getTime())
                ? null
                : date;
        }


        /*
         * DD-MM-YYYY
         */
        if (
            /^\d{1,2}-\d{1,2}-\d{4}$/.test(text)
        ) {

            const p =
                text.split("-");

            const date =
                new Date(
                    Number(p[2]),
                    Number(p[1]) - 1,
                    Number(p[0])
                );

            return isNaN(date.getTime())
                ? null
                : date;
        }


        /*
         * YYYY-MM-DD
         */
        if (
            /^\d{4}-\d{1,2}-\d{1,2}$/.test(text)
        ) {

            const p =
                text.split("-");

            const date =
                new Date(
                    Number(p[0]),
                    Number(p[1]) - 1,
                    Number(p[2])
                );

            return isNaN(date.getTime())
                ? null
                : date;
        }


        /*
         * Native JS fallback
         */
        const date =
            new Date(text);

        return isNaN(date.getTime())
            ? null
            : date;
    };


    TMS19.tarihFormat = function (value) {

        const date =
            TMS19.tarih(value);

        if (!date) {
            return "";
        }

        return new Intl.DateTimeFormat(
            "tr-TR"
        ).format(date);
    };


    TMS19.yilFarki = function (
        baslangic,
        bitis
    ) {

        if (
            !baslangic ||
            !bitis
        ) {
            return 0;
        }

        const fark =
            bitis.getTime() -
            baslangic.getTime();

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


    TMS19.yasHesapla = function (
        dogumTarihi,
        degerlemeTarihi
    ) {

        if (
            !dogumTarihi ||
            !degerlemeTarihi
        ) {
            return 0;
        }

        let yas =
            degerlemeTarihi.getFullYear() -
            dogumTarihi.getFullYear();

        const ay =
            degerlemeTarihi.getMonth() -
            dogumTarihi.getMonth();

        if (
            ay < 0 ||
            (
                ay === 0 &&
                degerlemeTarihi.getDate() <
                dogumTarihi.getDate()
            )
        ) {

            yas--;
        }

        return Math.max(
            0,
            yas
        );
    };


    TMS19.paraFormat = function (value) {

        return new Intl.NumberFormat(
            "tr-TR",
            {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }
        ).format(
            TMS19.sayi(value)
        ) + " TL";
    };


    TMS19.yuzdeFormat = function (value) {

        return new Intl.NumberFormat(
            "tr-TR",
            {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }
        ).format(
            TMS19.oran(value) * 100
        ) + "%";
    };


    /* ============================================================
       4. VARSAYIMLAR
    ============================================================ */

    TMS19.varsayimlariNormalizeEt = function (
        varsayimlar
    ) {

        const v =
            varsayimlar || {};

        return {

            degerlemeTarihi:
                TMS19.tarih(
                    v.degerlemeTarihi ||
                    v.değerlemeTarihi ||
                    v.valuationDate ||
                    "2026-12-31"
                ),

            iskontoOrani:
                TMS19.oran(
                    v.iskontoOrani ??
                    v.iskontoOranı ??
                    v.discountRate,
                    0.25
                ),

            maasArtisOrani:
                TMS19.oran(
                    v.maasArtisOrani ??
                    v.maaşArtışOranı ??
                    v.salaryIncreaseRate,
                    0.20
                ),

            personelDevirOrani:
                TMS19.oran(
                    v.personelDevirOrani ??
                    v.personelDevirOranı ??
                    v.turnoverRate,
                    0.10
                ),

            olumOrani:
                TMS19.oran(
                    v.olumOrani ??
                    v.ölümOranı ??
                    v.mortalityRate,
                    0.005
                ),

            emeklilikYasi:
                TMS19.sayi(
                    v.emeklilikYasi ??
                    v.emeklilikYaşı ??
                    v.retirementAge,
                    60
                ),

            faydaOrani:
                TMS19.oran(
                    v.faydaOrani ??
                    v.faydaOranı ??
                    v.benefitRate,
                    0.025
                ),

            kidemTavani:
                TMS19.sayi(
                    v.kidemTavani ??
                    v.kıdemTavanı ??
                    v.severanceCeiling,
                    Infinity
                ),

            kidemTavaniArtisOrani:
                TMS19.oran(
                    v.kidemTavaniArtisOrani ??
                    v.kıdemTavanıArtışOranı ??
                    v.severanceCeilingIncreaseRate,
                    0.20
                ),

            emeklilikYasiniAsma:
                TMS19.sayi(
                    v.emeklilikYasiniAsma,
                    0
                )
        };
    };


    /* ============================================================
       5. PERSONEL VERİSİ NORMALİZASYONU
    ============================================================ */

    TMS19.personelNormalizeEt = function (
        personel
    ) {

        const p =
            personel || {};

        const alanMap = {};

        Object.keys(p).forEach(
            function (key) {

                const normalized =
                    TMS19.alanAdiNormalizeEt(
                        key
                    );

                alanMap[normalized] =
                    p[key];
            }
        );


        const bul = function () {

            const alanlar =
                Array.from(arguments);

            for (
                let i = 0;
                i < alanlar.length;
                i++
            ) {

                const normalized =
                    TMS19.alanAdiNormalizeEt(
                        alanlar[i]
                    );

                if (
                    Object.prototype.hasOwnProperty.call(
                        alanMap,
                        normalized
                    )
                ) {

                    const value =
                        alanMap[normalized];

                    if (
                        value !== undefined &&
                        value !== null &&
                        String(value).trim() !== ""
                    ) {

                        return value;
                    }
                }
            }

            return null;
        };


        return {

            sicilNo:
                bul(
                    "sicilNo",
                    "Sicil No",
                    "Sicil",
                    "Personel No",
                    "Personel Numarası",
                    "Çalışan No",
                    "Employee ID",
                    "EmployeeID",
                    "employeeId",
                    "id"
                ),

            adSoyad:
                bul(
                    "adSoyad",
                    "Ad Soyad",
                    "Ad Soyadı",
                    "Çalışan",
                    "Çalışan Adı",
                    "Personel",
                    "Personel Adı",
                    "Employee Name",
                    "EmployeeName",
                    "name"
                ),

            cinsiyet:
                bul(
                    "cinsiyet",
                    "Cinsiyet",
                    "Gender"
                ),

            dogumTarihi:
                bul(
                    "dogumTarihi",
                    "Doğum Tarihi",
                    "Dogum Tarihi",
                    "Doğum",
                    "Birth Date",
                    "BirthDate",
                    "birthDate",
                    "dateOfBirth"
                ),

            iseGirisTarihi:
                bul(
                    "iseGirisTarihi",
                    "İşe Giriş Tarihi",
                    "İşe Giris Tarihi",
                    "Işe Giriş Tarihi",
                    "Ise Giris Tarihi",
                    "İşe Başlama Tarihi",
                    "İşe Başlangıç Tarihi",
                    "İşe Başlama",
                    "İşe Giriş",
                    "Giriş Tarihi",
                    "Giris Tarihi",
                    "İstihdam Tarihi",
                    "Başlangıç Tarihi",
                    "Baslangic Tarihi",
                    "Hire Date",
                    "HireDate",
                    "hireDate",
                    "startDate",
                    "employmentDate",
                    "employmentStartDate"
                ),

            mevcutMaas:
                bul(
                    "mevcutMaas",
                    "Mevcut Maaş",
                    "Brüt Maaş",
                    "Brut Maaş",
                    "Brüt Ücret",
                    "Brut Ucret",
                    "Maaş",
                    "Maas",
                    "Ücret",
                    "Ucret",
                    "Mevcut Ücret",
                    "brutMaas",
                    "salary",
                    "Salary",
                    "Gross Salary",
                    "GrossSalary"
                )
        };
    };


    TMS19.personelleriNormalizeEt = function (
        personeller
    ) {

        if (!Array.isArray(personeller)) {
            return [];
        }

        return personeller.map(
            TMS19.personelNormalizeEt
        );
    };


    /* ============================================================
       6. PERSONEL VALIDATION
    ============================================================ */

    TMS19.personelValidate = function (
        personel
    ) {

        const p =
            TMS19.personelNormalizeEt(
                personel
            );

        const errors = [];

        if (!p.dogumTarihi) {

            errors.push(
                "Doğum tarihi bulunamadı."
            );
        }

        if (!p.iseGirisTarihi) {

            errors.push(
                "İşe giriş tarihi bulunamadı."
            );
        }

        if (
            p.mevcutMaas === null ||
            p.mevcutMaas === undefined ||
            p.mevcutMaas === ""
        ) {

            errors.push(
                "Mevcut maaş bulunamadı."
            );
        }

        return {

            valid:
                errors.length === 0,

            errors:
                errors,

            personel:
                p
        };
    };


    /* ============================================================
       7. MAAŞ PROJEKSİYONU
    ============================================================ */

    TMS19.maasProjeksiyonu = function (
        mevcutMaas,
        kalanYil,
        varsayimlar
    ) {

        let maas =
            TMS19.sayi(
                mevcutMaas
            );

        const yillar = [];

        for (
            let yil = 0;
            yil <= Math.ceil(kalanYil);
            yil++
        ) {

            yillar.push({

                yil:
                    yil,

                maas:
                    maas
            });

            maas *=
                1 +
                varsayimlar.maasArtisOrani;
        }

        return {

            mevcutMaas:
                mevcutMaas,

            emeklilikMaasi:
                maas,

            yillar:
                yillar
        };
    };


    /* ============================================================
       8. DEVAM OLASILIĞI
    ============================================================ */

    TMS19.devamOlasiligi = function (
        kalanYil,
        varsayimlar
    ) {

        if (kalanYil <= 0) {
            return 1;
        }

        const turnover =
            Math.min(
                Math.max(
                    varsayimlar.personelDevirOrani,
                    0
                ),
                1
            );

        const mortality =
            Math.min(
                Math.max(
                    varsayimlar.olumOrani,
                    0
                ),
                1
            );

        const yillikOlasilik =
            (
                1 - turnover
            ) *
            (
                1 - mortality
            );

        return Math.pow(
            yillikOlasilik,
            kalanYil
        );
    };


    /* ============================================================
       9. İSKONTO
    ============================================================ */

    TMS19.iskontoFaktoru = function (
        oran,
        yil
    ) {

        if (yil <= 0) {
            return 1;
        }

        return Math.pow(
            1 + oran,
            -yil
        );
    };


    /* ============================================================
       10. ÇALIŞAN BAZLI PUC
    ============================================================ */

    TMS19.calisanHesapla = function (
        personel,
        varsayimlar,
        index
    ) {

        const p =
            TMS19.personelNormalizeEt(
                personel
            );


        const degerlemeTarihi =
            varsayimlar.degerlemeTarihi;


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


        /*
         * Validation
         */
        const validation =
            TMS19.personelValidate(
                personel
            );


        if (!validation.valid) {

            throw new Error(
                validation.errors.join(" ")
            );
        }


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


        const emekliligeKalanYil =
            Math.max(
                0,
                varsayimlar.emeklilikYasi -
                yas
            );


        const toplamHizmet =
            hizmetSuresi +
            emekliligeKalanYil;


        const maas =
            TMS19.maasProjeksiyonu(
                mevcutMaas,
                emekliligeKalanYil,
                varsayimlar
            );


        const emeklilikMaasi =
            maas.emeklilikMaasi;


        /* --------------------------------------------------------
           KIDEM TAVANI
        -------------------------------------------------------- */

        let faydaHesaplamaMaasi =
            emeklilikMaasi;

        let tavanUygulandi =
            false;

        let projectedCeiling =
            Infinity;


        if (
            isFinite(
                varsayimlar.kidemTavani
            )
        ) {

            projectedCeiling =
                varsayimlar.kidemTavani *
                Math.pow(
                    1 +
                    varsayimlar.kidemTavaniArtisOrani,
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


        /* --------------------------------------------------------
           TOPLAM BEKLENEN FAYDA
        -------------------------------------------------------- */

        const yillikFayda =
            faydaHesaplamaMaasi *
            varsayimlar.faydaOrani;


        const toplamFayda =
            yillikFayda *
            toplamHizmet;


        /* --------------------------------------------------------
           GEÇMİŞ HİZMET ORANI
        -------------------------------------------------------- */

        const gecmisHizmetOrani =
            toplamHizmet > 0
                ? Math.min(
                    1,
                    hizmetSuresi /
                    toplamHizmet
                )
                : 0;


        /* --------------------------------------------------------
           KAZANILMIŞ FAYDA
        -------------------------------------------------------- */

        const kazanilmisFayda =
            toplamFayda *
            gecmisHizmetOrani;


        /* --------------------------------------------------------
           DEMOGRAFİK OLASILIK
        -------------------------------------------------------- */

        const devamOlasiligi =
            TMS19.devamOlasiligi(
                emekliligeKalanYil,
                varsayimlar
            );


        const beklenenFayda =
            kazanilmisFayda *
            devamOlasiligi;


        /* --------------------------------------------------------
           İSKONTO
        -------------------------------------------------------- */

        const iskontoFaktoru =
            TMS19.iskontoFaktoru(
                varsayimlar.iskontoOrani,
                emekliligeKalanYil
            );


        /* --------------------------------------------------------
           DBO
        -------------------------------------------------------- */

        const dbo =
            beklenenFayda *
            iskontoFaktoru;


        /* --------------------------------------------------------
           CARİ HİZMET MALİYETİ
        -------------------------------------------------------- */

        const birYillikFayda =
            toplamHizmet > 0
                ? toplamFayda /
                  toplamHizmet
                : 0;


        const cariHizmetMaliyeti =
            birYillikFayda *
            devamOlasiligi *
            iskontoFaktoru;


        /* --------------------------------------------------------
           NET FAİZ
        -------------------------------------------------------- */

        const netFaiz =
            dbo *
            varsayimlar.iskontoOrani;


        return {

            index:
                index,

            sicilNo:
                p.sicilNo ||
                String(index + 1),

            adSoyad:
                p.adSoyad ||
                "Çalışan " +
                (index + 1),

            cinsiyet:
                p.cinsiyet || "",

            dogumTarihi:
                dogumTarihi,

            iseGirisTarihi:
                iseGirisTarihi,

            dogumTarihiFormatted:
                TMS19.tarihFormat(
                    dogumTarihi
                ),

            iseGirisTarihiFormatted:
                TMS19.tarihFormat(
                    iseGirisTarihi
                ),

            yas:
                yas,

            hizmetSuresi:
                hizmetSuresi,

            emekliligeKalanYil:
                emekliligeKalanYil,

            toplamHizmet:
                toplamHizmet,

            mevcutMaas:
                mevcutMaas,

            emeklilikMaasi:
                emeklilikMaasi,

            faydaHesaplamaMaasi:
                faydaHesaplamaMaasi,

            projectedCeiling:
                projectedCeiling,

            toplamFayda:
                toplamFayda,

            kazanilmisFayda:
                kazanilmisFayda,

            devamOlasiligi:
                devamOlasiligi,

            iskontoFaktoru:
                iskontoFaktoru,

            dbo:
                dbo,

            cariHizmetMaliyeti:
                cariHizmetMaliyeti,

            serviceCost:
                cariHizmetMaliyeti,

            netFaiz:
                netFaiz,

            netInterest:
                netFaiz,

            tavanUygulandi:
                tavanUygulandi,

            durum:
                "Hesaplandı",

            hata:
                null
        };
    };


    /* ============================================================
       11. ANA HESAPLAMA
    ============================================================ */

    TMS19.calistir = function (
        personeller,
        varsayimlar
    ) {

        const vars =
            TMS19.varsayimlariNormalizeEt(
                varsayimlar
            );


        const liste =
            TMS19.personelleriNormalizeEt(
                personeller
            );


        if (!liste.length) {

            return TMS19.bosSonuc(
                vars
            );
        }


        const calisanSonuclari = [];


        liste.forEach(
            function (
                personel,
                index
            ) {

                try {

                    calisanSonuclari.push(
                        TMS19.calisanHesapla(
                            personel,
                            vars,
                            index
                        )
                    );

                } catch (error) {

                    console.error(
                        "TMS 19 çalışan hesaplama hatası:",
                        error
                    );


                    const normalized =
                        TMS19.personelNormalizeEt(
                            personel
                        );


                    calisanSonuclari.push({

                        index:
                            index,

                        sicilNo:
                            normalized.sicilNo ||
                            String(index + 1),

                        adSoyad:
                            normalized.adSoyad ||
                            "Çalışan " +
                            (index + 1),

                        dogumTarihi:
                            normalized.dogumTarihi,

                        iseGirisTarihi:
                            normalized.iseGirisTarihi,

                        mevcutMaas:
                            TMS19.sayi(
                                normalized.mevcutMaas
                            ),

                        dbo:
                            0,

                        cariHizmetMaliyeti:
                            0,

                        serviceCost:
                            0,

                        netFaiz:
                            0,

                        netInterest:
                            0,

                        durum:
                            "Hata",

                        hata:
                            error.message
                    });
                }
            }
        );


        /* --------------------------------------------------------
           TOPLAMLAR
        -------------------------------------------------------- */

        let dbo = 0;
        let serviceCost = 0;
        let netInterest = 0;

        let toplamMaas = 0;
        let toplamFayda = 0;
        let toplamHizmet = 0;
        let toplamYas = 0;

        let hataSayisi = 0;


        calisanSonuclari.forEach(
            function (p) {

                dbo +=
                    TMS19.sayi(
                        p.dbo
                    );


                serviceCost +=
                    TMS19.sayi(
                        p.cariHizmetMaliyeti
                    );


                netInterest +=
                    TMS19.sayi(
                        p.netFaiz
                    );


                toplamMaas +=
                    TMS19.sayi(
                        p.mevcutMaas
                    );


                toplamFayda +=
                    TMS19.sayi(
                        p.toplamFayda
                    );


                toplamHizmet +=
                    TMS19.sayi(
                        p.hizmetSuresi
                    );


                toplamYas +=
                    TMS19.sayi(
                        p.yas
                    );


                if (
                    p.durum === "Hata"
                ) {

                    hataSayisi++;
                }
            }
        );


        const personelSayisi =
            calisanSonuclari.length;


        const basariliPersonelSayisi =
            personelSayisi -
            hataSayisi;


        const ortalamaYas =
            personelSayisi
                ? toplamYas /
                  personelSayisi
                : 0;


        const ortalamaHizmet =
            personelSayisi
                ? toplamHizmet /
                  personelSayisi
                : 0;


        /*
         * Dönem içi aktüeryal veri
         * sisteme girilmediğinde 0.
         */
        const remeasurement =
            0;


        const openingDBO =
            dbo;


        const closingDBO =
            dbo;


        const pl =
            serviceCost +
            netInterest;


        const oci =
            remeasurement;


        return {

            başarılı:
                hataSayisi === 0,

            varsayimlar:
                vars,

            çalışanSonuçları:
                calisanSonuclari,

            openingDBO:
                openingDBO,

            serviceCost:
                serviceCost,

            cariHizmetMaliyeti:
                serviceCost,

            netInterest:
                netInterest,

            netFaiz:
                netInterest,

            remeasurement:
                remeasurement,

            aktüeryalKazancKayıp:
                remeasurement,

            oci:
                oci,

            payments:
                0,

            closingDBO:
                closingDBO,

            dbo:
                closingDBO,

            pl:
                pl,

            personelSayısı:
                personelSayisi,

            basariliPersonelSayisi:
                basariliPersonelSayisi,

            hataSayisi:
                hataSayisi,

            toplamMaaş:
                toplamMaas,

            toplamFayda:
                toplamFayda,

            ortalamaYaş:
                ortalamaYas,

            ortalamaHizmet:
                ortalamaHizmet,

            durum:
                hataSayisi === 0
                    ? "Hesaplama tamamlandı"
                    : "Hesaplama tamamlandı, bazı personellerde hata var."
        };
    };


    /* ============================================================
       12. DUYARLILIK ANALİZİ
    ============================================================ */

    TMS19.duyarlilikAnalizi = function (
        personeller,
        varsayimlar
    ) {

        const vars =
            TMS19.varsayimlariNormalizeEt(
                varsayimlar
            );


        const baz =
            TMS19.calistir(
                personeller,
                vars
            );


        const iskontoSenaryolari = [
            -0.02,
            -0.01,
            0,
            0.01,
            0.02
        ];


        const iskontoSonuclari =
            iskontoSenaryolari.map(
                function (degisim) {

                    const yeniVars = {

                        ...vars,

                        iskontoOrani:
                            Math.max(
                                -0.99,
                                vars.iskontoOrani +
                                degisim
                            )
                    };


                    const sonuc =
                        TMS19.calistir(
                            personeller,
                            yeniVars
                        );


                    return {

                        degisim:
                            degisim,

                        oran:
                            yeniVars.iskontoOrani,

                        dbo:
                            sonuc.closingDBO
                    };
                }
            );


        const maasSenaryolari = [
            -0.05,
            -0.025,
            0,
            0.025,
            0.05
        ];


        const maasSonuclari =
            maasSenaryolari.map(
                function (degisim) {

                    const yeniVars = {

                        ...vars,

                        maasArtisOrani:
                            Math.max(
                                -0.99,
                                vars.maasArtisOrani +
                                degisim
                            )
                    };


                    const sonuc =
                        TMS19.calistir(
                            personeller,
                            yeniVars
                        );


                    return {

                        degisim:
                            degisim,

                        oran:
                            yeniVars.maasArtisOrani,

                        dbo:
                            sonuc.closingDBO
                    };
                }
            );


        return {

            bazDBO:
                baz.closingDBO,

            iskonto:
                iskontoSonuclari,

            maasArtisi:
                maasSonuclari
        };
    };


    /* ============================================================
       13. HTML VARSAYIMLARINI OKU
    ============================================================ */

    TMS19.htmlVarsayimlariniOku = function () {

        if (
            typeof document ===
            "undefined"
        ) {

            return {};
        }


        const oku = function () {

            const ids =
                Array.from(arguments);


            for (
                let i = 0;
                i < ids.length;
                i++
            ) {

                const element =
                    document.getElementById(
                        ids[i]
                    );


                if (
                    element &&
                    element.value !== undefined &&
                    element.value !== ""
                ) {

                    return element.value;
                }
            }


            return null;
        };


        return {

            degerlemeTarihi:
                oku(
                    "degerlemeTarihi",
                    "değerlemeTarihi",
                    "valuationDate",
                    "tms19-degerleme-tarihi"
                ),

            iskontoOrani:
                oku(
                    "iskontoOrani",
                    "iskontoOranı",
                    "discountRate",
                    "tms19-iskonto-orani"
                ),

            maasArtisOrani:
                oku(
                    "maasArtisOrani",
                    "maaşArtışOranı",
                    "salaryIncreaseRate",
                    "tms19-maas-artis-orani"
                ),

            personelDevirOrani:
                oku(
                    "personelDevirOrani",
                    "personelDevirOranı",
                    "turnoverRate",
                    "tms19-turnover"
                ),

            emeklilikYasi:
                oku(
                    "emeklilikYasi",
                    "emeklilikYaşı",
                    "retirementAge",
                    "tms19-emeklilik-yasi"
                ),

            faydaOrani:
                oku(
                    "faydaOrani",
                    "faydaOranı",
                    "benefitRate",
                    "tms19-fayda-orani"
                ),

            olumOrani:
                oku(
                    "olumOrani",
                    "ölümOranı",
                    "mortalityRate",
                    "tms19-olum-orani"
                ),

            kidemTavani:
                oku(
                    "kidemTavani",
                    "kıdemTavanı",
                    "severanceCeiling",
                    "tms19-kidem-tavani"
                )
        };
    };


    /* ============================================================
       14. DASHBOARD SONUCU
    ============================================================ */

    TMS19.dashboardSonucu = function (
        sonuc
    ) {

        if (!sonuc) {

            return {

                dbo: 0,

                serviceCost: 0,

                netInterest: 0,

                remeasurement: 0,

                employees: 0,

                totalSalary: 0,

                averageAge: 0,

                averageService: 0
            };
        }


        return {

            dbo:
                TMS19.sayi(
                    sonuc.closingDBO ??
                    sonuc.dbo
                ),

            serviceCost:
                TMS19.sayi(
                    sonuc.serviceCost ??
                    sonuc.cariHizmetMaliyeti
                ),

            netInterest:
                TMS19.sayi(
                    sonuc.netInterest ??
                    sonuc.netFaiz
                ),

            remeasurement:
                TMS19.sayi(
                    sonuc.remeasurement ??
                    sonuc.aktüeryalKazancKayıp
                ),

            employees:
                TMS19.sayi(
                    sonuc.personelSayısı
                ),

            totalSalary:
                TMS19.sayi(
                    sonuc.toplamMaaş
                ),

            averageAge:
                TMS19.sayi(
                    sonuc.ortalamaYaş
                ),

            averageService:
                TMS19.sayi(
                    sonuc.ortalamaHizmet
                )
        };
    };


    /* ============================================================
       15. KPI GÜNCELLEME
    ============================================================ */

    TMS19.kpiGuncelle = function (
        sonuc
    ) {

        if (
            typeof document ===
            "undefined"
        ) {

            return;
        }


        const d =
            TMS19.dashboardSonucu(
                sonuc
            );


        const yaz = function (
            ids,
            value
        ) {

            if (!Array.isArray(ids)) {

                ids = [ids];
            }


            for (
                let i = 0;
                i < ids.length;
                i++
            ) {

                const el =
                    document.getElementById(
                        ids[i]
                    );


                if (el) {

                    el.textContent =
                        value;

                    return;
                }
            }
        };


        yaz(
            [
                "kpiDBO",
                "dboKpi",
                "toplamDBO",
                "kpi-dbo"
            ],
            TMS19.paraFormat(
                d.dbo
            )
        );


        yaz(
            [
                "kpiServiceCost",
                "serviceCostKpi",
                "kpi-hizmet-maliyeti"
            ],
            TMS19.paraFormat(
                d.serviceCost
            )
        );


        yaz(
            [
                "kpiNetInterest",
                "netInterestKpi",
                "kpi-net-faiz"
            ],
            TMS19.paraFormat(
                d.netInterest
            )
        );


        yaz(
            [
                "kpiRemeasurement",
                "remeasurementKpi",
                "kpi-aktüeryal"
            ],
            TMS19.paraFormat(
                d.remeasurement
            )
        );


        yaz(
            [
                "kpiEmployees",
                "employeeKpi",
                "kpi-personel"
            ],
            String(
                d.employees
            )
        );
    };


    /* ============================================================
       16. TEK TUŞ HESAPLAMA API
    ============================================================ */

    TMS19.htmlHesapla = function (
        personeller,
        varsayimlar
    ) {

        const veri =
            TMS19.personelleriNormalizeEt(
                personeller
            );


        const vars =
            varsayimlar ||
            TMS19.htmlVarsayimlariniOku();


        const sonuc =
            TMS19.calistir(
                veri,
                vars
            );


        TMS19.kpiGuncelle(
            sonuc
        );


        window.TMS19Sonuc =
            sonuc;


        window.TMS19Dashboard =
            TMS19.dashboardSonucu(
                sonuc
            );


        if (
            typeof document !==
            "undefined"
        ) {

            document.dispatchEvent(
                new CustomEvent(
                    "tms19:hesaplama-tamamlandi",
                    {
                        detail: {

                            sonuc:
                                sonuc,

                            dashboard:
                                window.TMS19Dashboard
                        }
                    }
                )
            );
        }


        return sonuc;
    };


    /* ============================================================
       17. GLOBAL API
    ============================================================ */

    window.TMS19ActuarialEngine =
        TMS19;


    window.TMS19Actuarial =
        TMS19;


    window.TMS19Hesapla =
        function (
            personeller,
            varsayimlar
        ) {

            return TMS19.htmlHesapla(
                personeller,
                varsayimlar
            );
        };


    /* ============================================================
       18. EVENT
    ============================================================ */

    if (
        typeof document !==
        "undefined"
    ) {

        document.addEventListener(
            "tms19:hesaplama-tamamlandi",
            function (event) {

                if (
                    event.detail &&
                    event.detail.sonuc
                ) {

                    TMS19.kpiGuncelle(
                        event.detail.sonuc
                    );
                }
            }
        );
    }


    /* ============================================================
       19. BOŞ SONUÇ
    ============================================================ */

    TMS19.bosSonuc = function (
        varsayimlar
    ) {

        return {

            başarılı:
                false,

            varsayimlar:
                varsayimlar || {},

            çalışanSonuçları:
                [],

            openingDBO:
                0,

            closingDBO:
                0,

            dbo:
                0,

            serviceCost:
                0,

            cariHizmetMaliyeti:
                0,

            netInterest:
                0,

            netFaiz:
                0,

            remeasurement:
                0,

            aktüeryalKazancKayıp:
                0,

            oci:
                0,

            pl:
                0,

            payments:
                0,

            personelSayısı:
                0,

            basariliPersonelSayisi:
                0,

            hataSayisi:
                0,

            toplamMaaş:
                0,

            toplamFayda:
                0,

            ortalamaYaş:
                0,

            ortalamaHizmet:
                0,

            durum:
                "Personel verisi bulunamadı."
        };
    };


    /* ============================================================
       20. DEBUG / TEST API
    ============================================================ */

    TMS19.testPersonel = function () {

        const testPersonel = {

            "Sicil No":
                "TEST001",

            "Ad Soyad":
                "Test Çalışan",

            "Cinsiyet":
                "E",

            "Doğum Tarihi":
                "15.05.1990",

            "İşe Giriş Tarihi":
                "01.06.2018",

            "Brüt Maaş":
                "50000"
        };


        const normalized =
            TMS19.personelNormalizeEt(
                testPersonel
            );


        console.log(
            "TMS19 TEST - Raw:",
            testPersonel
        );


        console.log(
            "TMS19 TEST - Normalized:",
            normalized
        );


        console.log(
            "TMS19 TEST - Hire Date:",
            normalized.iseGirisTarihi
        );


        return normalized;
    };


    /* ============================================================
       21. CONSOLE
    ============================================================ */

    console.log(
        "GK Advisory — TMS 19 Aktüeryal Motoru aktif."
    );

    console.log(
        "PUC + maaş projeksiyonu + turnover + mortality + iskonto + DBO + hizmet maliyeti + net faiz + duyarlılık aktif."
    );

    console.log(
        "TMS19 robust personnel normalization aktif."
    );


})(window);
