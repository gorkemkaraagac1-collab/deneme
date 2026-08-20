"use strict";

/* ================================================================
   GK ADVISORY — TMS 19 ACTUARIAL ENGINE
   TMS 19 / IAS 19
   Projected Unit Credit (PUC) — Aktüeryal Hesaplama Motoru
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
            .replace(/\s/g, "");

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
        }

        const number = Number(text);

        return isFinite(number)
            ? number
            : defaultValue;
    };


    TMS19.oran = function (value, defaultValue = 0) {

        let oran = TMS19.sayi(
            value,
            defaultValue
        );

        if (Math.abs(oran) > 1) {
            oran = oran / 100;
        }

        return oran;
    };


    TMS19.tarih = function (value) {

        if (!value) {
            return null;
        }

        if (value instanceof Date) {
            return isNaN(value.getTime())
                ? null
                : value;
        }

        const text = String(value).trim();

        /* DD.MM.YYYY */

        if (
            /^\d{1,2}\.\d{1,2}\.\d{4}$/.test(text)
        ) {

            const p = text.split(".");

            return new Date(
                Number(p[2]),
                Number(p[1]) - 1,
                Number(p[0])
            );
        }

        /* DD/MM/YYYY */

        if (
            /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(text)
        ) {

            const p = text.split("/");

            return new Date(
                Number(p[2]),
                Number(p[1]) - 1,
                Number(p[0])
            );
        }

        const date = new Date(text);

        return isNaN(date.getTime())
            ? null
            : date;
    };


    TMS19.yilFarki = function (
        baslangic,
        bitis
    ) {

        if (!baslangic || !bitis) {
            return 0;
        }

        const fark =
            bitis.getTime() -
            baslangic.getTime();

        return Math.max(
            0,
            fark /
            (365.25 * 24 * 60 * 60 * 1000)
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

        return Math.max(0, yas);
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
       2. VARSAYIMLAR
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

            emeklilikYasiniAsma:
                TMS19.sayi(
                    v.emeklilikYasiniAsma,
                    0
                )
        };
    };


    /* ============================================================
       3. PERSONEL VERİSİ NORMALİZASYONU
    ============================================================ */

    TMS19.personelNormalizeEt = function (
        personel
    ) {

        const p =
            personel || {};

        const bul = function () {

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
       4. MAAŞ PROJEKSİYONU
    ============================================================ */

    TMS19.maasProjeksiyonu = function (
        mevcutMaas,
        kalanYil,
        varsayimlar
    ) {

        let maas =
            mevcutMaas;

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
       5. YAŞAMDA KALMA / İŞTE KALMA OLASILIĞI
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
       6. İSKONTO
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
       7. ÇALIŞAN BAZLI PUC
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

        if (
            isFinite(
                varsayimlar.kidemTavani
            )
        ) {

            const projectedCeiling =
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
           PUC
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
                "Hesaplandı"
        };
    };


    /* ============================================================
       8. ANA HESAPLAMA
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
         * Dönem içi gerçek aktüeryal veri henüz
         * sisteme girilmediğinde yeniden ölçüm sıfırdır.
         */

        const remeasurement =
            0;


        const closingDBO =
            dbo;


        const pl =
            serviceCost +
            netInterest;


        const oci =
            remeasurement;


        return {

            başarılı:
                true,

            varsayimlar:
                vars,

            çalışanSonuçları:
                calisanSonuclari,

            openingDBO:
                dbo,

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

            toplamMaaş:
                toplamMaas,

            toplamFayda:
                toplamFayda,

            ortalamaYaş:
                ortalamaYas,

            ortalamaHizmet:
                ortalamaHizmet,

            durum:
                "Hesaplama tamamlandı"
        };
    };


    /* ============================================================
       9. DUYARLILIK ANALİZİ
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
       10. HTML VARSAYIMLARINI OKU
    ============================================================ */

    TMS19.htmlVarsayimlariniOku = function () {

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
       11. DASHBOARD SONUÇLARI
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
                employees: 0
            };
        }


        return {

            dbo:
                TMS19.sayi(
                    sonuc.closingDBO ||
                    sonuc.dbo
                ),

            serviceCost:
                TMS19.sayi(
                    sonuc.serviceCost ||
                    sonuc.cariHizmetMaliyeti
                ),

            netInterest:
                TMS19.sayi(
                    sonuc.netInterest ||
                    sonuc.netFaiz
                ),

            remeasurement:
                TMS19.sayi(
                    sonuc.remeasurement ||
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
       12. KPI GÜNCELLEME
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
       13. TEK TUŞ HESAPLAMA API
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
       14. GLOBAL API
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
       15. HESAPLAMA TAMAMLANDI EVENT
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
       16. BOŞ SONUÇ
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

            personelSayısı:
                0,

            toplamMaaş:
                0,

            toplamFayda:
                0,

            durum:
                "Personel verisi bulunamadı."
        };
    };


    /* ============================================================
       17. KONSOL
    ============================================================ */

    console.log(
        "GK Advisory — TMS 19 Aktüeryal Motoru aktif."
    );

    console.log(
        "PUC + maaş projeksiyonu + turnover + mortality + iskonto + DBO + hizmet maliyeti + net faiz + duyarlılık aktif."
    );

})(window);
