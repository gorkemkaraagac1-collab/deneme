"use strict";

/*
====================================================================
 GK ADVISORY — TMS 19 AKTÜERYAL MOTORU
====================================================================

 Amaç:
 - TMS 19 / IAS 19 kapsamında tanımlanmış fayda planlarının
   çalışan bazında aktüeryal değerlemesini gerçekleştirmek.
 - Projected Unit Credit (PUC) yaklaşımının temel mantığını
   uygulamak.
 - DBO, cari hizmet maliyeti, net faiz, yeniden ölçüm ve
   duyarlılık analizleri üretmek.

 ÖNEMLİ:
 Bu motor profesyonel aktüeryal raporun yerine geçmez.
 Gerçek değerlemede plan hükümleri, aktüeryal mortalite,
 turnover, emeklilik, maaş artış eğrisi, iskonto eğrisi,
 kıdem tazminatı mevzuatı ve diğer demografik varsayımlar
 ayrıca doğrulanmalıdır.

====================================================================
*/


/* ================================================================
   GLOBAL MOTOR
================================================================ */

window.TMS19ActuarialEngine = {


    /* ============================================================
       ANA MOTOR
    ============================================================ */

    calistir: function (
        personeller,
        varsayimlar
    ) {

        const vars =
            this.varsayimlariNormalizeEt(
                varsayimlar
            );


        const liste =
            Array.isArray(
                personeller
            )
                ? personeller
                : [];


        if (
            liste.length === 0
        ) {

            return this.bosSonuc();

        }


        const çalışanSonuçları = [];


        for (
            let i = 0;
            i < liste.length;
            i++
        ) {

            try {

                const sonuc =
                    this.çalışanHesapla(
                        liste[i],
                        vars,
                        i
                    );


                çalışanSonuçları.push(
                    sonuc
                );

            } catch (
                hata
            ) {

                console.error(
                    "TMS 19 çalışan hesaplama hatası:",
                    hata
                );


                çalışanSonuçları.push(

                    this.hatalıÇalışanSonucu(
                        liste[i],
                        i,
                        hata
                    )

                );

            }

        }


        const toplam =
            this.toplamSonuçlarıHesapla(
                çalışanSonuçları,
                vars
            );


        return {

            başarılı:
                true,

            varsayımlar:
                vars,

            çalışanSonuçları:
                çalışanSonuçları,

            ...toplam

        };

    },


    /* ============================================================
       VARSAYIMLAR
    ============================================================ */

    varsayimlariNormalizeEt: function (
        vars
    ) {

        vars =
            vars || {};


        return {

            değerlemeTarihi:
                this.tarih(
                    vars.değerlemeTarihi
                    ||
                    vars.valuationDate
                    ||
                    "2026-12-31"
                ),


            iskontoOranı:
                this.oran(
                    vars.iskontoOranı
                    ??
                    vars.discountRate,
                    0.25
                ),


            maaşArtışOranı:
                this.oran(
                    vars.maaşArtışOranı
                    ??
                    vars.salaryIncreaseRate,
                    0.20
                ),


            personelDevirOranı:
                this.oran(
                    vars.personelDevirOranı
                    ??
                    vars.turnoverRate,
                    0.10
                ),


            emeklilikYaşı:
                this.sayi(
                    vars.emeklilikYaşı
                    ??
                    vars.retirementAge,
                    60
                ),


            faydaOranı:
                this.oran(
                    vars.faydaOranı,
                    0.025
                ),


            ölümOranı:
                this.oran(
                    vars.ölümOranı,
                    0.005
                ),


            maaşArtışYöntemi:
                vars.maaşArtışYöntemi
                ||
                "sabit",


            kıdemTavanı:
                this.sayi(
                    vars.kıdemTavanı,
                    Infinity
                ),


            kıdemTavanıArtışOranı:
                this.oran(
                    vars.kıdemTavanıArtışOranı,
                    0.20
                ),


            planTipi:
                vars.planTipi
                ||
                "Kıdem Tazminatı"


        };

    },


    /* ============================================================
       ÇALIŞAN HESAPLAMA
    ============================================================ */

    çalışanHesapla: function (
        personel,
        vars,
        index
    ) {

        const değerlemeTarihi =
            vars.değerlemeTarihi;


        const doğumTarihi =
            this.tarih(
                personel.doğumTarihi
                ||
                personel.dogumTarihi
            );


        const işeGirişTarihi =
            this.tarih(
                personel.işeGirişTarihi
                ||
                personel.iseGirisTarihi
            );


        const maaş =
            this.para(
                personel.mevcutMaaş
                ??
                personel.mevcutMaas
                ??
                personel.brutMaas
                ??
                personel.brütMaaş
                ??
                personel.salary
            );


        const sicilNo =
            personel.sicilNo
            ||
            personel.sicil
            ||
            String(
                index + 1
            );


        const adSoyad =
            personel.adSoyad
            ||
            personel.ad
            ||
            "Çalışan "
            +
            (index + 1);


        /* --------------------------------------------------------
           TEMEL DEMOGRAFİ
        -------------------------------------------------------- */

        const yaş =
            doğumTarihi
                ? this.yaşHesapla(
                    doğumTarihi,
                    değerlemeTarihi
                )
                : 0;


        const hizmetSüresi =
            işeGirişTarihi
                ? this.yılFarkı(
                    işeGirişTarihi,
                    değerlemeTarihi
                )
                : 0;


        const emekliliğeKalanYıl =
            Math.max(
                0,
                vars.emeklilikYaşı - yaş
            );


        const toplamPlanHizmeti =
            hizmetSüresi
            +
            emekliliğeKalanYıl;


        /* --------------------------------------------------------
           GELECEK MAAŞ
        -------------------------------------------------------- */

        const projeksiyon =
            this.maaşProjeksiyonu(
                maaş,
                emekliliğeKalanYıl,
                vars
            );


        const emeklilikMaaşı =
            projeksiyon.emeklilikMaaşı;


        /* --------------------------------------------------------
           TOPLAM BEKLENEN FAYDA
        -------------------------------------------------------- */

        const toplamBeklenenFayda =
            this.beklenenEmeklilikFaydasınıHesapla(
                emeklilikMaaşı,
                toplamPlanHizmeti,
                vars
            );


        /* --------------------------------------------------------
           GELECEK HİZMET BİRİMLERİ
        -------------------------------------------------------- */

        const toplamHizmetPayı =
            toplamPlanHizmeti > 0
                ? hizmetSüresi /
                  toplamPlanHizmeti
                : 0;


        /*
         * PUC yaklaşımında mevcut hizmete ilişkin
         * kazanılmış fayda, gelecekteki toplam faydanın
         * geçmiş hizmet oranına göre ayrıştırılır.
         */


        const aktüeryalFayda =
            toplamBeklenenFayda *
            toplamHizmetPayı;


        /* --------------------------------------------------------
           TURNUVER / HAYATTA KALMA OLASILIĞI
        -------------------------------------------------------- */

        const devamOlasılığı =
            this.devamOlasılığı(
                emekliliğeKalanYıl,
                vars
            );


        const beklenenFayda =
            aktüeryalFayda *
            devamOlasılığı;


        /* --------------------------------------------------------
           BUGÜNKÜ DEĞER
        -------------------------------------------------------- */

        const iskontoFaktörü =
            this.iskontoFaktörü(
                vars.iskontoOranı,
                emekliliğeKalanYıl
            );


        const dbo =
            beklenenFayda *
            iskontoFaktörü;


        /* --------------------------------------------------------
           CARİ HİZMET MALİYETİ
        -------------------------------------------------------- */

        const gelecekHizmetPayı =
            toplamPlanHizmeti > 0
                ? 1 /
                  toplamPlanHizmeti
                : 0;


        const gelecektekiBirimFayda =
            toplamBeklenenFayda *
            gelecekHizmetPayı;


        const serviceCost =
            gelecektekiBirimFayda *
            devamOlasılığı *
            iskontoFaktörü;


        /* --------------------------------------------------------
           NET FAİZ
        -------------------------------------------------------- */

        const netInterest =
            dbo *
            vars.iskontoOranı;


        /* --------------------------------------------------------
           KAZANILMIŞ FAYDA
        -------------------------------------------------------- */

        const kazanılmışFayda =
            aktüeryalFayda *
            devamOlasılığı;


        /* --------------------------------------------------------
           SONUÇ
        -------------------------------------------------------- */

        return {

            index:
                index,

            sicilNo:
                sicilNo,

            adSoyad:
                adSoyad,

            yaş:
                yaş,

            hizmetSüresi:
                hizmetSüresi,

            emekliliğeKalanYıl:
                emekliliğeKalanYıl,

            toplamPlanHizmeti:
                toplamPlanHizmeti,

            mevcutMaaş:
                maaş,

            emeklilikMaaşı:
                emeklilikMaaşı,

            maaşProjeksiyonu:
                projeksiyon,

            toplamBeklenenFayda:
                toplamBeklenenFayda,

            kazanılmışFayda:
                kazanılmışFayda,

            devamOlasılığı:
                devamOlasılığı,

            iskontoFaktörü:
                iskontoFaktörü,

            dbo:
                dbo,

            serviceCost:
                serviceCost,

            netInterest:
                netInterest,

            expectedBenefit:
                beklenenFayda,

            aktüeryalFayda:
                aktüeryalFayda,

            durum:
                "Hesaplandı"

        };

    },


    /* ============================================================
       MAAŞ PROJEKSİYONU
    ============================================================ */

    maaşProjeksiyonu: function (
        mevcutMaaş,
        yıl,
        vars
    ) {

        const yıllıkMaaşlar = [];


        let maaş =
            mevcutMaaş;


        for (
            let i = 0;
            i <= yıl;
            i++
        ) {

            yıllıkMaaşlar.push({

                yıl:
                    i,

                maaş:
                    maaş

            });


            maaş *=
                (
                    1 +
                    vars.maaşArtışOranı
                );

        }


        const emeklilikMaaşı =
            maaş;


        return {

            mevcutMaaş:
                mevcutMaaş,

            emeklilikMaaşı:
                emeklilikMaaşı,

            yıllıkMaaşlar:
                yıllıkMaaşlar

        };

    },


    /* ============================================================
       BEKLENEN EMEKLİLİK FAYDASI
    ============================================================ */

    beklenenEmeklilikFaydasınıHesapla: function (
        emeklilikMaaşı,
        toplamHizmet,
        vars
    ) {

        /*
         * Varsayılan olarak kıdem benzeri %2,5
         * yıllık hakediş yaklaşımı kullanılır.
         *
         * Gerçek planlarda bu oran plan şartlarından
         * ve ilgili mevzuattan alınmalıdır.
         */


        let yıllıkFayda =
            emeklilikMaaşı *
            vars.faydaOranı;


        /*
         * Kıdem tavanı uygulanıyorsa maaş tavanlanır.
         */


        if (
            isFinite(
                vars.kıdemTavanı
            )
        ) {

            yıllıkFayda =
                Math.min(
                    emeklilikMaaşı,
                    vars.kıdemTavanı
                )
                *
                vars.faydaOranı;

        }


        return (
            yıllıkFayda *
            toplamHizmet
        );

    },


    /* ============================================================
       DEVAM OLASILIĞI
    ============================================================ */

    devamOlasılığı: function (
        yıl,
        vars
    ) {

        if (
            yıl <= 0
        ) {

            return 1;

        }


        const turnover =
            Math.min(
                Math.max(
                    vars.personelDevirOranı,
                    0
                ),
                1
            );


        const mortality =
            Math.min(
                Math.max(
                    vars.ölümOranı,
                    0
                ),
                1
            );


        /*
         * Basitleştirilmiş yıllık bağımsız
         * ayrılma / ölüm olasılığı.
         */


        const yıllıkHayattaKalma =
            1 -
            mortality;


        const yıllıkİşletmedeKalma =
            1 -
            turnover;


        return Math.pow(
            yıllıkHayattaKalma *
            yıllıkİşletmedeKalma,
            yıl
        );

    },


    /* ============================================================
       İSKONTO FAKTÖRÜ
    ============================================================ */

    iskontoFaktörü: function (
        oran,
        yıl
    ) {

        if (
            yıl <= 0
        ) {

            return 1;

        }


        return Math.pow(
            1 + oran,
            -yıl
        );

    },


    /* ============================================================
       TOPLAM SONUÇLAR
    ============================================================ */

    toplamSonuçlarıHesapla: function (
        çalışanlar,
        vars
    ) {

        let openingDBO =
            0;


        let serviceCost =
            0;


        let netInterest =
            0;


        let closingDBO =
            0;


        let totalExpectedBenefit =
            0;


        let totalSalary =
            0;


        let totalEmployees =
            çalışanlar.length;


        çalışanlar.forEach(
            function (
                personel
            ) {

                const dbo =
                    this.para(
                        personel.dbo
                    );


                openingDBO +=
                    dbo;


                closingDBO +=
                    dbo;


                serviceCost +=
                    this.para(
                        personel.serviceCost
                    );


                netInterest +=
                    this.para(
                        personel.netInterest
                    );


                totalExpectedBenefit +=
                    this.para(
                        personel.expectedBenefit
                    );


                totalSalary +=
                    this.para(
                        personel.mevcutMaaş
                    );

            }.bind(
                this
            )
        );


        /*
         * Baseline modelde dönem içi gerçek
         * yeniden ölçüm verisi bulunmadığı için
         * 0 kabul edilir.
         *
         * Gerçek aktüeryal rapor ile actual vs expected
         * karşılaştırması yapıldığında burada gerçek
         * remeasurement hesaplanacaktır.
         */


        const remeasurement =
            0;


        const payments =
            0;


        const pl =
            serviceCost +
            netInterest;


        const oci =
            remeasurement;


        return {

            openingDBO:
                openingDBO,

            serviceCost:
                serviceCost,

            netInterest:
                netInterest,

            remeasurement:
                remeasurement,

            payments:
                payments,

            closingDBO:
                closingDBO,

            oci:
                oci,

            pl:
                pl,

            toplamBeklenenFayda:
                totalExpectedBenefit,

            toplamMaaş:
                totalSalary,

            personelSayısı:
                totalEmployees,

            ortalamaDBO:
                totalEmployees
                    ?
                    closingDBO /
                    totalEmployees
                    :
                    0,

            ortalamaHizmet:
                this.ortalama(
                    çalışanlar,
                    "hizmetSüresi"
                ),

            ortalamaYaş:
                this.ortalama(
                    çalışanlar,
                    "yaş"
                ),

            ortalamaEmekliliğeKalanYıl:
                this.ortalama(
                    çalışanlar,
                    "emekliliğeKalanYıl"
                )

        };

    },


    /* ============================================================
       DUYARLILIK ANALİZİ
    ============================================================ */

    duyarlılıkAnalizi: function (
        personeller,
        varsayimlar
    ) {

        const vars =
            this.varsayimlariNormalizeEt(
                varsayimlar
            );


        const baz =
            this.calistir(
                personeller,
                vars
            );


        const oranlar = [

            vars.iskontoOranı - 0.02,

            vars.iskontoOranı - 0.01,

            vars.iskontoOranı,

            vars.iskontoOranı + 0.01,

            vars.iskontoOranı + 0.02

        ];


        const iskontoSonuçları =
            [];


        oranlar.forEach(
            function (
                oran
            ) {

                const yeniVars =
                    {
                        ...vars,
                        iskontoOranı:
                            Math.max(
                                -0.99,
                                oran
                            )
                    };


                const sonuc =
                    this.calistir(
                        personeller,
                        yeniVars
                    );


                iskontoSonuçları.push({

                    oran:
                        oran,

                    dbo:
                        sonuc.closingDBO

                });

            }.bind(
                this
            )
        );


        const maaşOranları = [

            vars.maaşArtışOranı - 0.05,

            vars.maaşArtışOranı - 0.025,

            vars.maaşArtışOranı,

            vars.maaşArtışOranı + 0.025,

            vars.maaşArtışOranı + 0.05

        ];


        const maaşSonuçları =
            [];


        maaşOranları.forEach(
            function (
                oran
            ) {

                const yeniVars =
                    {
                        ...vars,
                        maaşArtışOranı:
                            Math.max(
                                -0.99,
                                oran
                            )
                    };


                const sonuc =
                    this.calistir(
                        personeller,
                        yeniVars
                    );


                maaşSonuçları.push({

                    oran:
                        oran,

                    dbo:
                        sonuc.closingDBO

                });

            }.bind(
                this
            )
        );


        return {

            bazDBO:
                baz.closingDBO,

            iskonto:
                iskontoSonuçları,

            maaşArtışı:
                maaşSonuçları

        };

    },


    /* ============================================================
       YILLIK DBO PROJEKSİYONU
    ============================================================ */

    dboProjeksiyonu: function (
        personeller,
        varsayimlar,
        yılSayısı
    ) {

        const vars =
            this.varsayimlariNormalizeEt(
                varsayimlar
            );


        const yıllar =
            Number(
                yılSayısı
                ||
                5
            );


        const sonuçlar =
            [];


        for (
            let yıl = 0;
            yıl <= yıllar;
            yıl++
        ) {

            const yeniVars =
                {
                    ...vars
                };


            /*
             * İleri yıllarda maaş artışı ve
             * iskonto etkisi modelin içine
             * çalışan bazında tekrar alınır.
             */


            const sonuc =
                this.calistir(
                    personeller,
                    yeniVars
                );


            sonuçlar.push({

                yıl:
                    yıl,

                dbo:
                    sonuc.closingDBO,

                serviceCost:
                    sonuc.serviceCost,

                netInterest:
                    sonuc.netInterest

            });

        }


        return sonuçlar;

    },


    /* ============================================================
       BOŞ SONUÇ
    ============================================================ */

    bosSonuc: function () {

        return {

            başarılı:
                false,

            varsayımlar:
                {},

            çalışanSonuçları:
                [],

            openingDBO:
                0,

            serviceCost:
                0,

            netInterest:
                0,

            remeasurement:
                0,

            payments:
                0,

            closingDBO:
                0,

            oci:
                0,

            pl:
                0,

            personelSayısı:
                0,

            toplamMaaş:
                0

        };

    },


    /* ============================================================
       HATALI ÇALIŞAN
    ============================================================ */

    hatalıÇalışanSonucu: function (
        personel,
        index,
        hata
    ) {

        return {

            index:
                index,

            sicilNo:
                personel.sicilNo
                ||
                String(
                    index + 1
                ),

            adSoyad:
                personel.adSoyad
                ||
                "Bilinmeyen çalışan",

            yaş:
                0,

            hizmetSüresi:
                0,

            emekliliğeKalanYıl:
                0,

            mevcutMaaş:
                0,

            emeklilikMaaşı:
                0,

            dbo:
                0,

            serviceCost:
                0,

            netInterest:
                0,

            durum:
                "Hata",

            hata:
                hata.message
                ||
                String(
                    hata
                )

        };

    },


    /* ============================================================
       TARİH
    ============================================================ */

    tarih: function (
        value
    ) {

        if (
            value instanceof Date
        ) {

            return isNaN(
                value.getTime()
            )
                ? null
                : value;

        }


        if (
            !value
        ) {

            return null;

        }


        /*
         * Türkçe tarih formatı:
         * DD.MM.YYYY
         */

        if (
            typeof value ===
                "string"
            &&
            /^\d{1,2}\.\d{1,2}\.\d{4}$/
                .test(
                    value.trim()
                )
        ) {

            const parçalar =
                value
                    .trim()
                    .split(
                        "."
                    );


            return new Date(
                Number(
                    parçalar[2]
                ),
                Number(
                    parçalar[1]
                ) - 1,
                Number(
                    parçalar[0]
                )
            );

        }


        /*
         * YYYY-MM-DD
         */

        if (
            typeof value ===
                "string"
            &&
            /^\d{4}-\d{1,2}-\d{1,2}$/
                .test(
                    value.trim()
                )
        ) {

            const parçalar =
                value
                    .trim()
                    .split(
                        "-"
                    );


            return new Date(
                Number(
                    parçalar[0]
                ),
                Number(
                    parçalar[1]
                ) - 1,
                Number(
                    parçalar[2]
                )
            );

        }


        const tarih =
            new Date(
                value
            );


        return isNaN(
            tarih.getTime()
        )
            ? null
            : tarih;

    },


    /* ============================================================
       YAŞ
    ============================================================ */

    yaşHesapla: function (
        doğum,
        değerleme
    ) {

        let yaş =
            değerleme.getFullYear()
            -
            doğum.getFullYear();


        const ay =
            değerleme.getMonth()
            -
            doğum.getMonth();


        if (
            ay < 0
            ||
            (
                ay === 0
                &&
                değerleme.getDate()
                <
                doğum.getDate()
            )
        ) {

            yaş--;

        }


        return Math.max(
            0,
            yaş
        );

    },


    /* ============================================================
       YIL FARKI
    ============================================================ */

    yılFarkı: function (
        başlangıç,
        bitiş
    ) {

        const fark =
            bitiş.getTime()
            -
            başlangıç.getTime();


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

    },


    /* ============================================================
       ORAN NORMALİZASYONU
    ============================================================ */

    oran: function (
        value,
        defaultValue
    ) {

        if (
            value ===
                undefined
            ||
            value ===
                null
            ||
            value ===
                ""
        ) {

            return defaultValue;

        }


        let sayı =
            Number(
                value
            );


        if (
            isNaN(
                sayı
            )
        ) {

            return defaultValue;

        }


        /*
         * Kullanıcı 25 yazdıysa %25,
         * 0.25 yazdıysa yine %25 kabul edilir.
         */

        if (
            Math.abs(
                sayı
            ) > 1
        ) {

            sayı /=
                100;

        }


        return sayı;

    },


    /* ============================================================
       SAYI
    ============================================================ */

    sayi: function (
        value,
        defaultValue
    ) {

        const sayı =
            Number(
                value
            );


        return isNaN(
            sayı
        )
            ? defaultValue
            : sayı;

    },


    /* ============================================================
       PARA
    ============================================================ */

    para: function (
        value
    ) {

        if (
            value ===
                null
            ||
            value ===
                undefined
            ||
            value ===
                ""
        ) {

            return 0;

        }


        if (
            typeof value ===
                "number"
        ) {

            return isFinite(
                value
            )
                ? value
                : 0;

        }


        let metin =
            String(
                value
            )
            .trim();


        /*
         * "150.000,50 TL"
         */

        metin =
            metin
                .replace(
                    /TL/gi,
                    ""
                )
                .replace(
                    /\s/g,
                    ""
                );


        if (
            metin.includes(",")
            &&
            metin.includes(".")
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

        } else if (
            metin.includes(",")
        ) {

            metin =
                metin.replace(
                    ",",
                    "."
                );

        }


        const sayı =
            Number(
                metin
            );


        return isNaN(
            sayı
        )
            ? 0
            : sayı;

    },


    /* ============================================================
       ORTALAMA
    ============================================================ */

    ortalama: function (
        liste,
        alan
    ) {

        if (
            !liste.length
        ) {

            return 0;

        }


        let toplam =
            0;


        let adet =
            0;


        liste.forEach(
            function (
                item
            ) {

                const value =
                    Number(
                        item[alan]
                    );


                if (
                    isFinite(
                        value
                    )
                ) {

                    toplam +=
                        value;

                    adet++;

                }

            }
        );


        return adet
            ? toplam / adet
            : 0;

    }

};


/* =================================================================
   GLOBAL ALIAS
================================================================= */

window.TMS19Actuarial =
    window.TMS19ActuarialEngine;


/* =================================================================
   KOLAY ÇALIŞTIRMA FONKSİYONU
================================================================= */

window.TMS19AktüeryalHesapla =
    function (
        personeller,
        varsayimlar
    ) {

        return
            window.TMS19ActuarialEngine.calistir(
                personeller,
                varsayimlar
            );

    };


/* =================================================================
   KONSOL MESAJI
================================================================= */

console.log(
    "GK Advisory — TMS 19 Aktüeryal Motoru hazır."
);

console.log(
    "PUC tabanlı çalışan bazlı değerleme aktif."
);
