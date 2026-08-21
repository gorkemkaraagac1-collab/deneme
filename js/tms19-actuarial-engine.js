"use strict";

/* ================================================================
   GK ADVISORY — TMS 19 ACTUARIAL ENGINE
   TMS 19 / IAS 19
   PROJECTED UNIT CREDIT (PUC)
   
   MODÜLLER
   01. Veri normalizasyonu
   02. Aktüeryal varsayımlar
   03. Personel bazlı PUC
   04. Maaş projeksiyonu
   05. Kıdem tavanı
   06. Devir / mortalite olasılığı
   07. DBO
   08. Cari hizmet maliyeti
   09. Net faiz
   10. DBO roll-forward
   11. Aktüeryal kazanç / kayıp
   12. OCI
   13. P&L
   14. Duyarlılık analizi
   15. CFO karar göstergeleri
================================================================ */

(function (window) {

    const TMS19 = {};

    /* ============================================================
       01 — GENEL YARDIMCI FONKSİYONLAR
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

            return Number.isFinite(value)
                ? value
                : defaultValue;

        }

        let text =
            String(value)
                .trim()
                .replace(/TL/gi, "")
                .replace(/\s/g, "");

        /*
         * Türkçe sayı formatı:
         * 1.250.000,50
         */

        if (
            text.includes(".") &&
            text.includes(",")
        ) {

            text =
                text
                    .replace(/\./g, "")
                    .replace(",", ".");

        } else if (
            text.includes(",")
        ) {

            text =
                text.replace(",", ".");

        }

        const number =
            Number(text);

        return Number.isFinite(number)
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

        /*
         * 25 → %25
         * 0.25 → %25
         */

        if (
            Math.abs(oran) > 1
        ) {

            oran =
                oran / 100;

        }

        return oran;

    };


    TMS19.tarih = function (
        value
    ) {

        if (!value) {

            return null;

        }

        if (
            value instanceof Date
        ) {

            return Number.isNaN(
                value.getTime()
            )
                ? null
                : value;

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

            return new Date(
                Number(p[2]),
                Number(p[1]) - 1,
                Number(p[0])
            );

        }

        /*
         * DD/MM/YYYY
         */

        if (
            /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(text)
        ) {

            const p =
                text.split("/");

            return new Date(
                Number(p[2]),
                Number(p[1]) - 1,
                Number(p[0])
            );

        }

        /*
         * YYYY-MM-DD
         */

        if (
            /^\d{4}-\d{1,2}-\d{1,2}$/.test(text)
        ) {

            const p =
                text.split("-");

            return new Date(
                Number(p[0]),
                Number(p[1]) - 1,
                Number(p[2])
            );

        }

        const date =
            new Date(text);

        return Number.isNaN(
            date.getTime()
        )
            ? null
            : date;

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


    TMS19.paraFormat = function (
        value
    ) {

        return new Intl.NumberFormat(
            "tr-TR",
            {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }
        ).format(
            TMS19.sayi(value)
        )
        +
        " TL";

    };


    TMS19.yuzdeFormat = function (
        value
    ) {

        return new Intl.NumberFormat(
            "tr-TR",
            {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }
        ).format(
            TMS19.oran(value) * 100
        )
        +
        "%";

    };


    TMS19.sinirla = function (
        value,
        min,
        max
    ) {

        return Math.min(
            max,
            Math.max(
                min,
                value
            )
        );

    };


    /* ============================================================
       02 — VARSAYIMLAR
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
                    v.kıdemTavanı,
                    Infinity
                ),

            kidemTavaniArtisOrani:
                TMS19.oran(
                    v.kidemTavaniArtisOrani ??
                    v.kıdemTavanıArtışOranı,
                    0.20
                ),

            /*
             * Aktüeryal hesaplamanın raporlama dönemi.
             * Varsayılan olarak 1 yıl.
             */

            raporlamaDonemi:
                TMS19.sayi(
                    v.raporlamaDonemi ??
                    v.reportingPeriod ??
                    1,
                    1
                ),

            /*
             * Geçmiş dönem kapanış DBO'su sisteme
             * ayrıca girilebilecek şekilde tasarlanmıştır.
             */

            acilisDBO:
                TMS19.sayi(
                    v.acilisDBO ??
                    v.açılışDBO ??
                    v.openingDBO ??
                    0,
                    0
                ),

            /*
             * Gerçekleşen ödemeler.
             */

            odemeler:
                TMS19.sayi(
                    v.odemeler ??
                    v.ödemeler ??
                    v.payments ??
                    0,
                    0
                )

        };

    };


    /* ============================================================
       03 — PERSONEL NORMALİZASYONU
    ============================================================ */

    TMS19.personelNormalizeEt = function (
        personel
    ) {

        const p =
            personel || {};

        const bul =
            function () {

                const alanlar =
                    Array.from(arguments);

                for (
                    let i = 0;
                    i < alanlar.length;
                    i++
                ) {

                    const key =
                        alanlar[i];

                    if (
                        p[key] !== undefined &&
                        p[key] !== null &&
                        p[key] !== ""
                    ) {

                        return p[key];

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
                    "sicil",
                    "Employee ID",
                    "EmployeeID",
                    "employeeId"
                ),

            adSoyad:
                bul(
                    "adSoyad",
                    "Ad Soyad",
                    "Ad Soyadı",
                    "Çalışan",
                    "Personel",
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
                    "doğumTarihi",
                    "Doğum Tarihi",
                    "Dogum Tarihi",
                    "Birth Date",
                    "BirthDate",
                    "birthDate"
                ),

            iseGirisTarihi:
                bul(
                    "iseGirisTarihi",
                    "işeGirişTarihi",
                    "İşe Giriş Tarihi",
                    "Ise Giris Tarihi",
                    "İşe Başlama Tarihi",
                    "Hire Date",
                    "HireDate",
                    "hireDate"
                ),

            mevcutMaas:
                bul(
                    "mevcutMaas",
                    "mevcutMaaş",
                    "Mevcut Maaş",
                    "Brüt Maaş",
                    "Brut Maaş",
                    "Brüt Ücret",
                    "Brut Ucret",
                    "brutMaas",
                    "salary",
                    "Salary",
                    "Gross Salary",
                    "GrossSalary"
                ),

            departman:
                bul(
                    "departman",
                    "Departman",
                    "Department"
                ),

            pozisyon:
                bul(
                    "pozisyon",
                    "Pozisyon",
                    "Position"
                ),

            medeniDurum:
                bul(
                    "medeniDurum",
                    "Medeni Durum",
                    "Marital Status"
                )

        };

    };


    TMS19.personelleriNormalizeEt = function (
        personeller
    ) {

        if (
            !Array.isArray(personeller)
        ) {

            return [];

        }

        return personeller.map(
            function (personel) {

                return TMS19.personelNormalizeEt(
                    personel
                );

            }
        );

    };


    /* ============================================================
       04 — MAAŞ PROJEKSİYONU
    ============================================================ */

    TMS19.maasProjeksiyonu = function (
        mevcutMaas,
        kalanYil,
        varsayimlar
    ) {

        const yillar =
            [];

        const tamYil =
            Math.max(
                0,
                Math.ceil(
                    kalanYil
                )
            );

        for (
            let yil = 0;
            yil <= tamYil;
            yil++
        ) {

            const maas =
                mevcutMaas *
                Math.pow(
                    1 +
                    varsayimlar.maasArtisOrani,
                    yil
                );

            yillar.push({

                yil:
                    yil,

                maas:
                    maas

            });

        }

        return {

            mevcutMaas:
                mevcutMaas,

            emeklilikMaasi:
                mevcutMaas *
                Math.pow(
                    1 +
                    varsayimlar.maasArtisOrani,
                    kalanYil
                ),

            yillar:
                yillar

        };

    };


    /* ============================================================
       05 — DEMOGRAFİK OLASILIK
    ============================================================ */

    /*
     * Buradaki yapı gelecekte yaş bazlı mortalite tablosu
     * eklenebilmesi için fonksiyonlaştırılmıştır.
     */

    TMS19.yillikDevamOlasiligi = function (
        yas,
        varsayimlar
    ) {

        const turnover =
            TMS19.sinirla(
                varsayimlar.personelDevirOrani,
                0,
                1
            );

        const mortality =
            TMS19.sinirla(
                varsayimlar.olumOrani,
                0,
                1
            );

        /*
         * Yaşa bağlı basit mortalite yaklaşımı.
         * İleride gerçek mortalite tablosu ile değiştirilebilir.
         */

        const yasFaktoru =
            yas > 55
                ? 1 +
                  (
                    yas - 55
                  ) * 0.03
                : 1;

        const efektifMortalite =
            TMS19.sinirla(
                mortality *
                yasFaktoru,
                0,
                0.95
            );

        return (
            1 - turnover
        ) *
        (
            1 - efektifMortalite
        );

    };


    TMS19.devamOlasiligi = function (
        yas,
        kalanYil,
        varsayimlar
    ) {

        if (
            kalanYil <= 0
        ) {

            return 1;

        }

        let probability =
            1;

        for (
            let yil = 0;
            yil < kalanYil;
            yil++
        ) {

            probability *=
                TMS19.yillikDevamOlasiligi(
                    yas + yil,
                    varsayimlar
                );

        }

        return TMS19.sinirla(
            probability,
            0,
            1
        );

    };


    /* ============================================================
       06 — İSKONTO
    ============================================================ */

    TMS19.iskontoFaktoru = function (
        oran,
        yil
    ) {

        if (
            yil <= 0
        ) {

            return 1;

        }

        return Math.pow(
            1 + oran,
            -yil
        );

    };


    /* ============================================================
       07 — KIDEM TAVANI
    ============================================================ */

    TMS19.kidemTavaniHesapla = function (
        kalanYil,
        varsayimlar
    ) {

        if (
            !Number.isFinite(
                varsayimlar.kidemTavani
            )
        ) {

            return {

                uygulandi:
                    false,

                tavan:
                    Infinity

            };

        }

        const tavan =
            varsayimlar.kidemTavani *
            Math.pow(
                1 +
                varsayimlar.kidemTavaniArtisOrani,
                kalanYil
            );

        return {

            uygulandi:
                true,

            tavan:
                tavan

        };

    };


    /* ============================================================
       08 — ÇALIŞAN BAZLI AKTÜERYAL HESAPLAMA
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

        const kalanYil =
            Math.max(
                0,
                varsayimlar.emeklilikYasi -
                yas
            );

        /*
         * Toplam beklenen hizmet.
         */

        const toplamHizmet =
            hizmetSuresi +
            kalanYil;

        /*
         * Gelecekteki maaş.
         */

        const maas =
            TMS19.maasProjeksiyonu(
                mevcutMaas,
                kalanYil,
                varsayimlar
            );

        const emeklilikMaasi =
            maas.emeklilikMaasi;

        /*
         * Kıdem tavanı.
         */

        const tavan =
            TMS19.kidemTavaniHesapla(
                kalanYil,
                varsayimlar
            );

        const faydaHesaplamaMaasi =
            Math.min(
                emeklilikMaasi,
                tavan.tavan
            );

        /*
         * Toplam beklenen emeklilik faydası.
         */

        const yillikFayda =
            faydaHesaplamaMaasi *
            varsayimlar.faydaOrani;

        const toplamFayda =
            yillikFayda *
            toplamHizmet;

        /*
         * PUC:
         *
         * Geçmiş hizmet / toplam hizmet
         */

        const hizmetOrani =
            toplamHizmet > 0
                ? TMS19.sinirla(
                    hizmetSuresi /
                    toplamHizmet,
                    0,
                    1
                )
                : 0;

        const kazanilmisFayda =
            toplamFayda *
            hizmetOrani;

        /*
         * Demografik olasılık.
         */

        const devamOlasiligi =
            TMS19.devamOlasiligi(
                yas,
                kalanYil,
                varsayimlar
            );

        /*
         * Beklenen fayda.
         */

        const beklenenFayda =
            kazanilmisFayda *
            devamOlasiligi;

        /*
         * DBO.
         */

        const iskontoFaktoru =
            TMS19.iskontoFaktoru(
                varsayimlar.iskontoOrani,
                kalanYil
            );

        const dbo =
            beklenenFayda *
            iskontoFaktoru;

        /*
         * Cari hizmet maliyeti.
         *
         * Yaklaşım:
         * Bir yıllık kazanılan faydanın,
         * beklenen ödeme ve iskonto etkileri
         * dikkate alınarak bugünkü değeri.
         */

        const birYillikFayda =
            toplamHizmet > 0
                ? toplamFayda /
                  toplamHizmet
                : 0;

        const gelecekDonemHizmetOlasiligi =
            TMS19.devamOlasiligi(
                yas,
                Math.max(
                    0,
                    kalanYil - 1
                ),
                varsayimlar
            );

        const gelecekDonemIskonto =
            TMS19.iskontoFaktoru(
                varsayimlar.iskontoOrani,
                Math.max(
                    0,
                    kalanYil - 1
                )
            );

        const cariHizmetMaliyeti =
            birYillikFayda *
            gelecekDonemHizmetOlasiligi *
            gelecekDonemIskonto;

        /*
         * Net faiz.
         */

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

            departman:
                p.departman || "",

            pozisyon:
                p.pozisyon || "",

            yas:
                yas,

            hizmetSuresi:
                hizmetSuresi,

            kalanYil:
                kalanYil,

            emekliligeKalanYil:
                kalanYil,

            toplamHizmet:
                toplamHizmet,

            mevcutMaas:
                mevcutMaas,

            emeklilikMaasi:
                emeklilikMaasi,

            faydaHesaplamaMaasi:
                faydaHesaplamaMaasi,

            toplamFayda:
                toplamFayda,

            hizmetOrani:
                hizmetOrani,

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
                tavan.uygulandi &&
                emeklilikMaasi >
                tavan.tavan,

            projectedCeiling:
                tavan.tavan,

            durum:
                "Hesaplandı"

        };

    };


    /* ============================================================
       09 — PERSONEL BAZLI DBO PROJEKSİYONU
    ============================================================ */

    TMS19.personelProjeksiyonu = function (
        sonuc,
        varsayimlar,
        yilSayisi = 5
    ) {

        const projection =
            [];

        let mevcutDBO =
            TMS19.sayi(
                sonuc.closingDBO
            );

        for (
            let yil = 0;
            yil <= yilSayisi;
            yil++
        ) {

            projection.push({

                yil:
                    yil,

                dbo:
                    mevcutDBO

            });

            /*
             * Basit ileri dönem büyüme:
             *
             * hizmet maliyeti +
             * net faiz -
             * ödemeler
             */

            const serviceCost =
                TMS19.sayi(
                    sonuc.serviceCost
                );

            const interest =
                mevcutDBO *
                varsayimlar.iskontoOrani;

            mevcutDBO =
                Math.max(
                    0,
                    mevcutDBO +
                    serviceCost +
                    interest
                );

        }

        return projection;

    };


    /* ============================================================
       10 — DUYARLILIK ANALİZİ
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
                {
                    ...vars,
                    duyarlilikKapali:
                        true
                }
            );

        /*
         * İskonto:
         * -200 bp
         * -100 bp
         * baz
         * +100 bp
         * +200 bp
         */

        const iskontoDegisimleri = [
            -0.02,
            -0.01,
            0,
            0.01,
            0.02
        ];

        const iskonto =
            iskontoDegisimleri.map(
                function (degisim) {

                    const yeniOran =
                        TMS19.sinirla(
                            vars.iskontoOrani +
                            degisim,
                            -0.95,
                            5
                        );

                    const sonuc =
                        TMS19.calistir(
                            personeller,
                            {
                                ...vars,
                                iskontoOrani:
                                    yeniOran,
                                duyarlilikKapali:
                                    true
                            }
                        );

                    return {

                        degisim:
                            degisim,

                        oran:
                            yeniOran,

                        dbo:
                            sonuc.closingDBO,

                        fark:
                            sonuc.closingDBO -
                            baz.closingDBO

                    };

                }
            );


        /*
         * Maaş:
         * -5%
         * -2.5%
         * baz
         * +2.5%
         * +5%
         */

        const maasDegisimleri = [
            -0.05,
            -0.025,
            0,
            0.025,
            0.05
        ];

        const maasArtisi =
            maasDegisimleri.map(
                function (degisim) {

                    const yeniOran =
                        TMS19.sinirla(
                            vars.maasArtisOrani +
                            degisim,
                            -0.95,
                            5
                        );

                    const sonuc =
                        TMS19.calistir(
                            personeller,
                            {
                                ...vars,
                                maasArtisOrani:
                                    yeniOran,
                                duyarlilikKapali:
                                    true
                            }
                        );

                    return {

                        degisim:
                            degisim,

                        oran:
                            yeniOran,

                        dbo:
                            sonuc.closingDBO,

                        fark:
                            sonuc.closingDBO -
                            baz.closingDBO

                    };

                }
            );


        return {

            bazDBO:
                baz.closingDBO,

            iskonto:
                iskonto,

            maasArtisi:
                maasArtisi

        };

    };


    /* ============================================================
       11 — ANA HESAPLAMA
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

        if (
            !liste.length
        ) {

            return TMS19.bosSonuc(
                vars
            );

        }


        const calisanSonuclari =
            [];

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

                } catch (
                    error
                ) {

                    console.error(
                        "TMS 19 çalışan hesaplama hatası:",
                        error
                    );

                    calisanSonuclari.push({

                        index:
                            index,

                        sicilNo:
                            personel.sicilNo ||
                            String(index + 1),

                        adSoyad:
                            personel.adSoyad ||
                            "Çalışan",

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


        /*
         * TOPLAMLAR
         */

        let dbo = 0;

        let serviceCost = 0;

        let netInterest = 0;

        let toplamMaas = 0;

        let toplamFayda = 0;

        let toplamHizmet = 0;

        let toplamYas = 0;


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

            }
        );


        const personelSayisi =
            calisanSonuclari.length;


        const ortalamaYas =
            personelSayisi > 0
                ? toplamYas /
                  personelSayisi
                : 0;


        const ortalamaHizmet =
            personelSayisi > 0
                ? toplamHizmet /
                  personelSayisi
                : 0;


        /*
         * ========================================================
         * DBO ROLL-FORWARD
         * ========================================================
         *
         * Eğer geçmiş dönem kapanış DBO'su verilmişse:
         *
         * Açılış DBO
         * + Cari hizmet maliyeti
         * + Net faiz
         * +/- Yeniden ölçüm
         * - Ödemeler
         * = Kapanış DBO
         *
         * Ancak ilk değerleme ise mevcut hesaplanan DBO
         * kapanış yükümlülüğü olarak kabul edilir.
         */

        let openingDBO =
            vars.acilisDBO;

        const ilkDegerleme =
            openingDBO === 0;


        if (
            ilkDegerleme
        ) {

            openingDBO =
                Math.max(
                    0,
                    dbo -
                    serviceCost -
                    netInterest
                );

        }


        const beklenenKapanis =
            openingDBO +
            serviceCost +
            netInterest -
            vars.odemeler;


        /*
         * Aktüeryal yeniden ölçüm:
         *
         * Hesaplanan PUC DBO ile
         * roll-forward sonrası beklenen DBO
         * arasındaki fark.
         *
         * İlk değerlemede yeniden ölçüm
         * yapay olarak yaratılmaması için 0.
         */

        let remeasurement = 0;

        if (
            !ilkDegerleme
        ) {

            remeasurement =
                dbo -
                beklenenKapanis;

        }


        const closingDBO =
            ilkDegerleme
                ? dbo
                : dbo;


        const oci =
            remeasurement;


        const pl =
            serviceCost +
            netInterest;


        /*
         * CFO METRİKLERİ
         */

        const dboSalaryRatio =
            toplamMaas > 0
                ? dbo /
                  toplamMaas
                : 0;


        const hataSayisi =
            calisanSonuclari.filter(
                function (p) {

                    return p.durum ===
                        "Hata";

                }
            ).length;


        const tavanUygulananPersonel =
            calisanSonuclari.filter(
                function (p) {

                    return p.tavanUygulandi;

                }
            ).length;


        const ortalamaDBO =
            personelSayisi > 0
                ? dbo /
                  personelSayisi
                : 0;


        /*
         * Duyarlılık.
         */

        let duyarlilik =
            null;

        if (
            !vars.duyarlilikKapali
        ) {

            duyarlilik =
                TMS19.duyarlilikAnalizi(
                    liste,
                    {
                        ...vars,
                        duyarlilikKapali:
                            true
                    }
                );

        }


        /*
         * Projeksiyon.
         */

        const projeksiyon =
            TMS19.personelProjeksiyonu(
                {
                    closingDBO:
                        closingDBO,

                    serviceCost:
                        serviceCost
                },
                vars,
                5
            );


        return {

            başarılı:
                hataSayisi === 0,

            durum:
                hataSayisi === 0
                    ? "Hesaplama tamamlandı"
                    : "Bazı personel hesaplamalarında hata oluştu",

            varsayimlar:
                vars,

            çalışanSonuçları:
                calisanSonuclari,

            personelSonuclari:
                calisanSonuclari,

            /*
             * DBO
             */

            openingDBO:
                openingDBO,

            açılışDBO:
                openingDBO,

            closingDBO:
                closingDBO,

            kapanışDBO:
                closingDBO,

            dbo:
                closingDBO,

            /*
             * P&L
             */

            serviceCost:
                serviceCost,

            cariHizmetMaliyeti:
                serviceCost,

            netInterest:
                netInterest,

            netFaiz:
                netInterest,

            pl:
                pl,

            pnl:
                pl,

            /*
             * OCI
             */

            remeasurement:
                remeasurement,

            yenidenOlcum:
                remeasurement,

            yenidenÖlçüm:
                remeasurement,

            aktüeryalKazancKayıp:
                remeasurement,

            oci:
                oci,

            /*
             * Nakit çıkışı
             */

            payments:
                vars.odemeler,

            odemeler:
                vars.odemeler,

            /*
             * Özet
             */

            personelSayısı:
                personelSayisi,

            personelSayisi:
                personelSayisi,

            toplamMaaş:
                toplamMaas,

            toplamMaas:
                toplamMaas,

            toplamFayda:
                toplamFayda,

            ortalamaYaş:
                ortalamaYas,

            ortalamaYas:
                ortalamaYas,

            ortalamaHizmet:
                ortalamaHizmet,

            /*
             * Aktüeryal analiz
             */

            projeksiyon:
                projeksiyon,

            duyarlilik:
                duyarlilik,

            iskontoDuyarliligi:
                duyarlilik
                    ? duyarlilik.iskonto
                    : [],

            maasDuyarliligi:
                duyarlilik
                    ? duyarlilik.maasArtisi
                    : [],

            /*
             * CFO
             */

            cfo:
                {

                    dboMaasOrani:
                        dboSalaryRatio,

                    ortalamaDBO:
                        ortalamaDBO,

                    tavanUygulananPersonel:
                        tavanUygulananPersonel,

                    hataSayisi:
                        hataSayisi,

                    finansalRisk:
                        TMS19.finansalRiskSeviyesi(
                            dboSalaryRatio
                        )

                }

        };

    };


    /* ============================================================
       12 — FİNANSAL RİSK SEVİYESİ
    ============================================================ */

    TMS19.finansalRiskSeviyesi = function (
        oran
    ) {

        if (
            oran >= 5
        ) {

            return {

                seviye:
                    "Yüksek",

                kod:
                    "YUKSEK",

                aciklama:
                    "TMS 19 yükümlülüğünün ücret tabanına göre yüksek seviyede olduğu görülmektedir."

            };

        }

        if (
            oran >= 2
        ) {

            return {

                seviye:
                    "Orta",

                kod:
                    "ORTA",

                aciklama:
                    "TMS 19 yükümlülüğünün ücret tabanına göre yakından izlenmesi önerilir."

            };

        }

        return {

            seviye:
                "Düşük",

            kod:
                "DUSUK",

            aciklama:
                "TMS 19 yükümlülüğünün ücret tabanına göre düşük seviyede olduğu görülmektedir."

        };

    };


    /* ============================================================
       13 — DASHBOARD SONUCU
    ============================================================ */

    TMS19.dashboardSonucu = function (
        sonuc
    ) {

        if (!sonuc) {

            return {

                dbo:
                    0,

                serviceCost:
                    0,

                netInterest:
                    0,

                remeasurement:
                    0,

                employees:
                    0,

                totalSalary:
                    0,

                averageAge:
                    0,

                averageService:
                    0

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
                    sonuc.personelSayısı ??
                    sonuc.personelSayisi
                ),

            totalSalary:
                TMS19.sayi(
                    sonuc.toplamMaaş ??
                    sonuc.toplamMaas
                ),

            averageAge:
                TMS19.sayi(
                    sonuc.ortalamaYaş ??
                    sonuc.ortalamaYas
                ),

            averageService:
                TMS19.sayi(
                    sonuc.ortalamaHizmet
                )

        };

    };


    /* ============================================================
       14 — KPI GÜNCELLEME
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


        const yaz =
            function (
                ids,
                value
            ) {

                const liste =
                    Array.isArray(ids)
                        ? ids
                        : [ids];

                for (
                    let i = 0;
                    i < liste.length;
                    i++
                ) {

                    const element =
                        document.getElementById(
                            liste[i]
                        );

                    if (
                        element
                    ) {

                        element.textContent =
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
       15 — HTML VARSAYIMLARINI OKU
    ============================================================ */

    TMS19.htmlVarsayimlariniOku = function () {

        if (
            typeof document ===
            "undefined"
        ) {

            return {};

        }


        const oku =
            function () {

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
                        element.value !==
                        undefined &&
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
       16 — TEK TUŞ HESAPLAMA API
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
       17 — BOŞ SONUÇ
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

            personelSonuclari:
                [],

            openingDBO:
                0,

            açılışDBO:
                0,

            closingDBO:
                0,

            kapanışDBO:
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

            yenidenOlcum:
                0,

            yenidenÖlçüm:
                0,

            aktüeryalKazancKayıp:
                0,

            oci:
                0,

            payments:
                0,

            odemeler:
                0,

            pl:
                0,

            pnl:
                0,

            personelSayısı:
                0,

            personelSayisi:
                0,

            toplamMaaş:
                0,

            toplamMaas:
                0,

            toplamFayda:
                0,

            ortalamaYaş:
                0,

            ortalamaYas:
                0,

            ortalamaHizmet:
                0,

            projeksiyon:
                [],

            duyarlilik:
                null,

            iskontoDuyarliligi:
                [],

            maasDuyarliligi:
                [],

            cfo:
                {

                    dboMaasOrani:
                        0,

                    ortalamaDBO:
                        0,

                    tavanUygulananPersonel:
                        0,

                    hataSayisi:
                        0,

                    finansalRisk:
                        {

                            seviye:
                                "Düşük",

                            kod:
                                "DUSUK"

                        }

                },

            durum:
                "Personel verisi bulunamadı."

        };

    };


    /* ============================================================
       18 — GLOBAL API
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
       19 — EVENT
    ============================================================ */

    if (
        typeof document !==
        "undefined"
    ) {

        document.addEventListener(
            "tms19:hesaplama-tamamlandi",
            function (
                event
            ) {

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
       20 — KONSOL
    ============================================================ */

    console.log(
        "GK Advisory — TMS 19 Aktüeryal Motoru aktif."
    );

    console.log(
        "PUC + maaş projeksiyonu + kıdem tavanı + turnover + mortality + iskonto + DBO + hizmet maliyeti + net faiz + OCI + duyarlılık aktif."
    );


})(window);
