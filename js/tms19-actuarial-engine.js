/* ================================================================
   GK FINANCIAL DECISION COCKPIT
   TMS 19 ACTUARIAL ENGINE
   ----------------------------------------------------------------
   Standart : TMS 19
   Yöntem   : Projected Unit Credit (PUC)
   Sürüm    : 2.0.0
   Amaç     : TEK PERSONEL aktüeryal hesaplama motoru

   BU DOSYANIN SORUMLULUKLARI
   --------------------------
   ✓ Personel hesaplama
   ✓ Yaş / hizmet süresi
   ✓ Emekliliğe kalan süre
   ✓ Maaş projeksiyonu
   ✓ Kıdem tavanı
   ✓ Fayda projeksiyonu
   ✓ Geçmiş hizmet oranı
   ✓ Turnover / mortality
   ✓ Beklenen fayda
   ✓ İskonto
   ✓ DBO
   ✓ Cari hizmet maliyeti
   ✓ Faiz maliyeti
   ✓ Personel bazlı yıllık projeksiyon

   BU DOSYANIN SORUMLULUKLARI DEĞİL
   --------------------------------
   ✗ CSV / Excel import
   ✗ Data mapping
   ✗ UI
   ✗ Dashboard
   ✗ Portföy toplamları
   ✗ Departman analizi
   ✗ Yaş grubu analizi
   ✗ Sensitivity dashboard
================================================================ */

(function (global) {

    "use strict";


    /* ============================================================
       01 — NAMESPACE
    ============================================================ */

    const TMS19ActuarialEngine = {};


    TMS19ActuarialEngine.version =
        "2.0.0";


    TMS19ActuarialEngine.engineName =
        "GK TMS 19 Actuarial Engine";


    TMS19ActuarialEngine.standard =
        "TMS 19";


    TMS19ActuarialEngine.method =
        "Projected Unit Credit";


    /* ============================================================
       02 — GENEL YARDIMCILAR
    ============================================================ */

    function sayi(
        deger,
        varsayilan = 0
    ) {

        if (
            deger === null ||
            deger === undefined ||
            deger === ""
        ) {

            return varsayilan;
        }


        if (
            typeof deger === "number"
        ) {

            return Number.isFinite(deger)
                ? deger
                : varsayilan;
        }


        let metin =
            String(deger)
                .trim()
                .replace(/\s/g, "");


        /*
         * Türkçe / Avrupa sayı formatı:
         *
         * 1.234.567,89
         * 1234,89
         */

        if (
            metin.includes(".") &&
            metin.includes(",")
        ) {

            metin =
                metin
                    .replace(/\./g, "")
                    .replace(",", ".");
        }

        else if (
            metin.includes(",")
        ) {

            metin =
                metin.replace(",", ".");
        }


        const sonuc =
            Number(metin);


        return Number.isFinite(
            sonuc
        )
            ? sonuc
            : varsayilan;
    }


    function sinirla(
        deger,
        minimum,
        maksimum
    ) {

        return Math.min(
            Math.max(
                sayi(deger),
                minimum
            ),
            maksimum
        );
    }


    function tarih(
        deger
    ) {

        if (
            deger instanceof Date
        ) {

            const sonuc =
                new Date(
                    deger.getTime()
                );


            return Number.isNaN(
                sonuc.getTime()
            )
                ? null
                : sonuc;
        }


        if (
            !deger
        ) {

            return null;
        }


        const sonuc =
            new Date(
                deger
            );


        return Number.isNaN(
            sonuc.getTime()
        )
            ? null
            : sonuc;
    }


    function yuvarla(
        deger,
        basamak = 2
    ) {

        const katsayi =
            Math.pow(
                10,
                basamak
            );


        return Math.round(
            sayi(deger) *
            katsayi
        ) / katsayi;
    }


    /* ============================================================
       03 — TARİH HESAPLAMALARI
    ============================================================ */

    function yilFarki(
        baslangic,
        bitis
    ) {

        const bas =
            tarih(
                baslangic
            );


        const bit =
            tarih(
                bitis
            );


        if (
            !bas ||
            !bit
        ) {

            return 0;
        }


        const fark =
            bit.getTime() -
            bas.getTime();


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
    }


    function yasHesapla(
        dogumTarihi,
        degerlemeTarihi
    ) {

        const dogum =
            tarih(
                dogumTarihi
            );


        const degerleme =
            tarih(
                degerlemeTarihi
            );


        if (
            !dogum ||
            !degerleme
        ) {

            return 0;
        }


        let yas =
            degerleme.getFullYear() -
            dogum.getFullYear();


        const ayFarki =
            degerleme.getMonth() -
            dogum.getMonth();


        if (
            ayFarki < 0 ||
            (
                ayFarki === 0 &&
                degerleme.getDate() <
                dogum.getDate()
            )
        ) {

            yas--;
        }


        return Math.max(
            0,
            yas
        );
    }


    function tarihEkleYil(
        baslangicTarihi,
        yil
    ) {

        const sonuc =
            tarih(
                baslangicTarihi
            );


        if (
            !sonuc
        ) {

            return null;
        }


        /*
         * Ondalıklı yıl kullanılıyorsa yaklaşık
         * gün bazlı hesaplama yapılır.
         */

        const tamYil =
            Math.floor(
                sayi(yil)
            );


        const kalan =
            sayi(yil) -
            tamYil;


        sonuc.setFullYear(
            sonuc.getFullYear() +
            tamYil
        );


        if (
            kalan > 0
        ) {

            sonuc.setDate(
                sonuc.getDate() +
                Math.round(
                    kalan * 365.25
                )
            );
        }


        return sonuc;
    }


    /* ============================================================
       04 — PERSONEL NORMALİZASYONU
    ============================================================ */

    function personelNormalizeEt(
        personel
    ) {

        const p =
            personel || {};


        return {

            personelId:
                p.personelId ??
                p.personelID ??
                p.id ??
                p.sicilNo ??
                p.employeeId ??
                "",


            adSoyad:
                p.adSoyad ??
                p.ad_soyad ??
                p.adSoyadUnvan ??
                p.name ??
                p.fullName ??
                "",


            departman:
                p.departman ??
                p.department ??
                "",


            pozisyon:
                p.pozisyon ??
                p.position ??
                "",


            dogumTarihi:
                p.dogumTarihi ??
                p.dogum_tarihi ??
                p.birthDate ??
                "",


            iseGirisTarihi:
                p.iseGirisTarihi ??
                p.ise_giris_tarihi ??
                p.hireDate ??
                "",


            mevcutMaas:
                sayi(
                    p.mevcutMaas ??
                    p.mevcut_maas ??
                    p.maas ??
                    p.salary ??
                    p.currentSalary
                ),


            cinsiyet:
                p.cinsiyet ??
                p.gender ??
                "",


            kalanIzin:
                sayi(
                    p.kalanIzin ??
                    p.remainingLeave
                )
        };
    }


    /* ============================================================
       05 — VARSAYIM NORMALİZASYONU
    ============================================================ */

    function varsayimNormalizeEt(
        varsayimlar
    ) {

        const v =
            varsayimlar || {};


        return {

            degerlemeTarihi:
                v.degerlemeTarihi ??
                v.valuationDate ??
                new Date(),


            emeklilikYasi:
                sayi(
                    v.emeklilikYasi ??
                    v.retirementAge,
                    60
                ),


            maasArtisOrani:
                sayi(
                    v.maasArtisOrani ??
                    v.salaryGrowthRate
                ),


            kidemTavani:
                sayi(
                    v.kidemTavani ??
                    v.kidemTavanı
                ),


            kidemTavaniArtisOrani:
                sayi(
                    v.kidemTavaniArtisOrani ??
                    v.kidemTavanArtisOrani ??
                    v.ceilingGrowthRate
                ),


            faydaOrani:
                sayi(
                    v.faydaOrani ??
                    v.benefitRate
                ),


            iskontoOrani:
                sayi(
                    v.iskontoOrani ??
                    v.discountRate
                ),


            personelDevirOrani:
                sayi(
                    v.personelDevirOrani ??
                    v.turnoverRate
                ),


            olumOrani:
                sayi(
                    v.olumOrani ??
                    v.mortalityRate
                ),


            paraBirimi:
                v.paraBirimi ??
                v.currency ??
                "TRY"
        };
    }


    /* ============================================================
       06 — PERSONEL VALIDATION
    ============================================================ */

    function personelValidate(
        personel
    ) {

        const p =
            personelNormalizeEt(
                personel
            );


        const hatalar = [];


        const dogum =
            tarih(
                p.dogumTarihi
            );


        const giris =
            tarih(
                p.iseGirisTarihi
            );


        if (
            !dogum
        ) {

            hatalar.push(
                "Doğum tarihi geçerli değil."
            );
        }


        if (
            !giris
        ) {

            hatalar.push(
                "İşe giriş tarihi geçerli değil."
            );
        }


        if (
            p.mevcutMaas < 0
        ) {

            hatalar.push(
                "Mevcut maaş negatif olamaz."
            );
        }


        if (
            dogum &&
            giris &&
            giris < dogum
        ) {

            hatalar.push(
                "İşe giriş tarihi doğum tarihinden önce olamaz."
            );
        }


        return {

            valid:
                hatalar.length === 0,

            errors:
                hatalar
        };
    }


    /* ============================================================
       07 — VARSAYIM VALIDATION
    ============================================================ */

    function varsayimValidate(
        varsayimlar
    ) {

        const v =
            varsayimNormalizeEt(
                varsayimlar
            );


        const hatalar = [];


        if (
            v.emeklilikYasi <= 0
        ) {

            hatalar.push(
                "Emeklilik yaşı geçerli değil."
            );
        }


        if (
            v.maasArtisOrani <= -1
        ) {

            hatalar.push(
                "Maaş artış oranı -100%'den küçük veya eşit olamaz."
            );
        }


        if (
            v.kidemTavaniArtisOrani <= -1
        ) {

            hatalar.push(
                "Kıdem tavanı artış oranı -100%'den küçük veya eşit olamaz."
            );
        }


        if (
            v.iskontoOrani <= -1
        ) {

            hatalar.push(
                "İskonto oranı -100%'den küçük veya eşit olamaz."
            );
        }


        if (
            v.faydaOrani < 0
        ) {

            hatalar.push(
                "Fayda oranı negatif olamaz."
            );
        }


        if (
            v.personelDevirOrani < 0 ||
            v.personelDevirOrani > 1
        ) {

            hatalar.push(
                "Personel devir oranı 0 ile 1 arasında olmalıdır."
            );
        }


        if (
            v.olumOrani < 0 ||
            v.olumOrani > 1
        ) {

            hatalar.push(
                "Ölüm oranı 0 ile 1 arasında olmalıdır."
            );
        }


        return {

            valid:
                hatalar.length === 0,

            errors:
                hatalar
        };
    }


    /* ============================================================
       08 — HİZMET ANALİZİ
    ============================================================ */

    function hizmetAnalizi(
        iseGirisTarihi,
        degerlemeTarihi,
        emekliligeKalanYil
    ) {

        const mevcutHizmet =
            yilFarki(
                iseGirisTarihi,
                degerlemeTarihi
            );


        const gelecekHizmet =
            Math.max(
                0,
                sayi(
                    emekliligeKalanYil
                )
            );


        const toplamHizmet =
            mevcutHizmet +
            gelecekHizmet;


        const gecmisHizmetOrani =
            toplamHizmet > 0
                ? Math.min(
                    1,
                    mevcutHizmet /
                    toplamHizmet
                )
                : 0;


        const gelecekHizmetOrani =
            toplamHizmet > 0
                ? Math.max(
                    0,
                    gelecekHizmet /
                    toplamHizmet
                )
                : 0;


        return {

            mevcutHizmet:
                mevcutHizmet,

            gelecekHizmet:
                gelecekHizmet,

            toplamHizmet:
                toplamHizmet,

            gecmisHizmetOrani:
                gecmisHizmetOrani,

            gelecekHizmetOrani:
                gelecekHizmetOrani
        };
    }


    /* ============================================================
       09 — MAAŞ PROJEKSİYONU
    ============================================================ */

    function maasProjeksiyonu(
        mevcutMaas,
        kalanYil,
        varsayimlar
    ) {

        const baslangicMaasi =
            sayi(
                mevcutMaas
            );


        const yil =
            Math.max(
                0,
                sayi(
                    kalanYil
                )
            );


        const artisOrani =
            sayi(
                varsayimlar.maasArtisOrani
            );


        const emeklilikMaasi =
            baslangicMaasi *
            Math.pow(
                1 + artisOrani,
                yil
            );


        return {

            mevcutMaas:
                baslangicMaasi,

            kalanYil:
                yil,

            artisOrani:
                artisOrani,

            emeklilikMaasi:
                emeklilikMaasi
        };
    }


    /* ============================================================
       10 — KIDEM TAVANI
    ============================================================ */

    function kidemTavaniHesapla(
        emeklilikMaasi,
        kalanYil,
        varsayimlar
    ) {

        const maas =
            sayi(
                emeklilikMaasi
            );


        const yil =
            Math.max(
                0,
                sayi(
                    kalanYil
                )
            );


        const mevcutTavan =
            sayi(
                varsayimlar.kidemTavani
            );


        const artis =
            sayi(
                varsayimlar.kidemTavaniArtisOrani
            );


        /*
         * Kıdem tavanı girilmemişse
         * herhangi bir tavan uygulanmaz.
         */

        if (
            mevcutTavan <= 0
        ) {

            return {

                uygulandi:
                    false,

                mevcutTavan:
                    null,

                projekteTavan:
                    null,

                hesaplamaMaasi:
                    maas,

                tavanFarki:
                    0
            };
        }


        const projekteTavan =
            mevcutTavan *
            Math.pow(
                1 + artis,
                yil
            );


        const uygulandi =
            maas >
            projekteTavan;


        const hesaplamaMaasi =
            uygulandi
                ? projekteTavan
                : maas;


        return {

            uygulandi:
                uygulandi,

            mevcutTavan:
                mevcutTavan,

            projekteTavan:
                projekteTavan,

            hesaplamaMaasi:
                hesaplamaMaasi,

            tavanFarki:
                Math.max(
                    0,
                    maas -
                    projekteTavan
                )
        };
    }


    /* ============================================================
       11 — DEMOGRAFİK OLASILIK
    ============================================================ */

    function devamOlasiligi(
        kalanYil,
        varsayimlar
    ) {

        const yil =
            Math.max(
                0,
                sayi(
                    kalanYil
                )
            );


        const devir =
            sinirla(
                varsayimlar.personelDevirOrani,
                0,
                1
            );


        const olum =
            sinirla(
                varsayimlar.olumOrani,
                0,
                1
            );


        const yillikDevam =
            (
                1 - devir
            ) *
            (
                1 - olum
            );


        return Math.pow(
            yillikDevam,
            yil
        );
    }


    function yillikDevamOlasiligi(
        varsayimlar
    ) {

        const devir =
            sinirla(
                varsayimlar.personelDevirOrani,
                0,
                1
            );


        const olum =
            sinirla(
                varsayimlar.olumOrani,
                0,
                1
            );


        return (
            1 - devir
        ) *
        (
            1 - olum
        );
    }


    /* ============================================================
       12 — İSKONTO FAKTÖRÜ
    ============================================================ */

    function iskontoFaktoru(
        iskontoOrani,
        kalanYil
    ) {

        const oran =
            sayi(
                iskontoOrani
            );


        const yil =
            Math.max(
                0,
                sayi(
                    kalanYil
                )
            );


        return (
            1 /
            Math.pow(
                1 + oran,
                yil
            )
        );
    }


    /* ============================================================
       13 — TEK PERSONEL ANA HESAPLAMA
    ============================================================ */

    function hesapla(
        personel,
        varsayimlar,
        options = {}
    ) {

        const p =
            personelNormalizeEt(
                personel
            );


        const v =
            varsayimNormalizeEt(
                varsayimlar
            );


        /*
         * Validation
         */

        const personelValidation =
            personelValidate(
                personel
            );


        if (
            !personelValidation.valid
        ) {

            throw new Error(
                personelValidation.errors.join(
                    " "
                )
            );
        }


        const varsayimValidation =
            varsayimValidate(
                varsayimlar
            );


        if (
            !varsayimValidation.valid
        ) {

            throw new Error(
                varsayimValidation.errors.join(
                    " "
                )
            );
        }


        /* --------------------------------------------------------
           TARİHLER
        -------------------------------------------------------- */

        const degerlemeTarihi =
            tarih(
                v.degerlemeTarihi
            );


        const dogumTarihi =
            tarih(
                p.dogumTarihi
            );


        const iseGirisTarihi =
            tarih(
                p.iseGirisTarihi
            );


        /* --------------------------------------------------------
           YAŞ
        -------------------------------------------------------- */

        const yas =
            yasHesapla(
                dogumTarihi,
                degerlemeTarihi
            );


        /* --------------------------------------------------------
           EMEKLİLİK
        -------------------------------------------------------- */

        const emekliligeKalanYil =
            Math.max(
                0,
                v.emeklilikYasi -
                yas
            );


        /* --------------------------------------------------------
           HİZMET
        -------------------------------------------------------- */

        const hizmet =
            hizmetAnalizi(
                iseGirisTarihi,
                degerlemeTarihi,
                emekliligeKalanYil
            );


        /* --------------------------------------------------------
           MAAŞ
        -------------------------------------------------------- */

        const maas =
            maasProjeksiyonu(
                p.mevcutMaas,
                emekliligeKalanYil,
                v
            );


        /* --------------------------------------------------------
           KIDEM TAVANI
        -------------------------------------------------------- */

        const tavan =
            kidemTavaniHesapla(
                maas.emeklilikMaasi,
                emekliligeKalanYil,
                v
            );


        const faydaHesaplamaMaasi =
            tavan.hesaplamaMaasi;


        /* --------------------------------------------------------
           YILLIK FAYDA
        -------------------------------------------------------- */

        const yillikFayda =
            faydaHesaplamaMaasi *
            v.faydaOrani;


        /* --------------------------------------------------------
           TOPLAM FAYDA
        -------------------------------------------------------- */

        const toplamFayda =
            yillikFayda *
            hizmet.toplamHizmet;


        /* --------------------------------------------------------
           GEÇMİŞ HİZMET
        -------------------------------------------------------- */

        const kazanilmisFayda =
            toplamFayda *
            hizmet.gecmisHizmetOrani;


        /* --------------------------------------------------------
           DEMOGRAFİK OLASILIK
        -------------------------------------------------------- */

        const devam =
            devamOlasiligi(
                emekliligeKalanYil,
                v
            );


        /* --------------------------------------------------------
           BEKLENEN FAYDA
        -------------------------------------------------------- */

        const beklenenFayda =
            kazanilmisFayda *
            devam;


        /* --------------------------------------------------------
           İSKONTO
        -------------------------------------------------------- */

        const iskonto =
            iskontoFaktoru(
                v.iskontoOrani,
                emekliligeKalanYil
            );


        /* --------------------------------------------------------
           DBO
        -------------------------------------------------------- */

        const dbo =
            beklenenFayda *
            iskonto;


        /* --------------------------------------------------------
           CARİ HİZMET MALİYETİ
        -------------------------------------------------------- */

        const birimFayda =
            hizmet.toplamHizmet > 0
                ? toplamFayda /
                  hizmet.toplamHizmet
                : 0;


        const cariHizmetMaliyeti =
            birimFayda *
            devam *
            iskonto;


        /* --------------------------------------------------------
           FAİZ MALİYETİ
        -------------------------------------------------------- */

        const faizMaliyeti =
            dbo *
            v.iskontoOrani;


        /* --------------------------------------------------------
           SONUÇ
        -------------------------------------------------------- */

        return {

            engine: {

                name:
                    TMS19ActuarialEngine.engineName,

                version:
                    TMS19ActuarialEngine.version,

                standard:
                    TMS19ActuarialEngine.standard,

                method:
                    TMS19ActuarialEngine.method
            },


            personel: {

                personelId:
                    p.personelId,

                adSoyad:
                    p.adSoyad,

                departman:
                    p.departman,

                pozisyon:
                    p.pozisyon,

                cinsiyet:
                    p.cinsiyet
            },


            tarihler: {

                dogumTarihi:
                    dogumTarihi,

                iseGirisTarihi:
                    iseGirisTarihi,

                degerlemeTarihi:
                    degerlemeTarihi
            },


            demografi: {

                yas:
                    yas,

                emeklilikYasi:
                    v.emeklilikYasi,

                emekliligeKalanYil:
                    emekliligeKalanYil,

                personelDevirOrani:
                    v.personelDevirOrani,

                olumOrani:
                    v.olumOrani,

                devamOlasiligi:
                    devam
            },


            hizmet: {

                mevcutHizmet:
                    hizmet.mevcutHizmet,

                gelecekHizmet:
                    hizmet.gelecekHizmet,

                toplamHizmet:
                    hizmet.toplamHizmet,

                gecmisHizmetOrani:
                    hizmet.gecmisHizmetOrani,

                gelecekHizmetOrani:
                    hizmet.gelecekHizmetOrani
            },


            maas: {

                mevcutMaas:
                    maas.mevcutMaas,

                maasArtisOrani:
                    maas.artisOrani,

                emeklilikMaasi:
                    maas.emeklilikMaasi,

                fark:
                    maas.emeklilikMaasi -
                    maas.mevcutMaas
            },


            kidemTavani: {

                uygulandi:
                    tavan.uygulandi,

                mevcutTavan:
                    tavan.mevcutTavan,

                projekteTavan:
                    tavan.projekteTavan,

                hesaplamaMaasi:
                    tavan.hesaplamaMaasi,

                tavanFarki:
                    tavan.tavanFarki
            },


            fayda: {

                faydaOrani:
                    v.faydaOrani,

                yillikFayda:
                    yillikFayda,

                toplamFayda:
                    toplamFayda,

                kazanilmisFayda:
                    kazanilmisFayda,

                gelecekFayda:
                    toplamFayda -
                    kazanilmisFayda,

                beklenenFayda:
                    beklenenFayda
            },


            iskonto: {

                iskontoOrani:
                    v.iskontoOrani,

                iskontoFaktoru:
                    iskonto,

                iskontoTutari:
                    beklenenFayda -
                    dbo
            },


            muhasebe: {

                dbo:
                    dbo,

                cariHizmetMaliyeti:
                    cariHizmetMaliyeti,

                faizMaliyeti:
                    faizMaliyeti
            },


            meta: {

                paraBirimi:
                    v.paraBirimi,

                hesaplamaTarihi:
                    new Date(),

                yuvarlamaBasamagi:
                    options.yuvarlamaBasamagi ??
                    2
            }
        };
    }


    /* ============================================================
       14 — YILLIK PROJEKSİYON
    ============================================================ */

    function yillikProjeksiyon(
        personel,
        varsayimlar
    ) {

        const temel =
            hesapla(
                personel,
                varsayimlar
            );


        const v =
            varsayimNormalizeEt(
                varsayimlar
            );


        const liste = [];


        const toplamYil =
            Math.ceil(
                temel.demografi.emekliligeKalanYil
            );


        for (
            let yil = 0;
            yil <= toplamYil;
            yil++
        ) {

            const tarih =
                tarihEkleYil(
                    v.degerlemeTarihi,
                    yil
                );


            const yas =
                temel.demografi.yas +
                yil;


            const kalanYil =
                Math.max(
                    0,
                    temel.demografi.emekliligeKalanYil -
                    yil
                );


            const maas =
                temel.maas.mevcutMaas *
                Math.pow(
                    1 +
                    v.maasArtisOrani,
                    yil
                );


            const projekteTavan =
                v.kidemTavani > 0
                    ? v.kidemTavani *
                      Math.pow(
                          1 +
                          v.kidemTavaniArtisOrani,
                          kalanYil
                      )
                    : null;


            const hesaplamaMaasi =
                projekteTavan === null
                    ? maas
                    : Math.min(
                        maas,
                        projekteTavan
                    );


            /*
             * Bu modelde hizmet süresi,
             * değerleme tarihinden itibaren
             * ileriye doğru artırılır.
             */

            const hizmetSuresi =
                temel.hizmet.mevcutHizmet +
                yil;


            const toplamHizmet =
                hizmetSuresi +
                kalanYil;


            const yillikFayda =
                hesaplamaMaasi *
                v.faydaOrani;


            const toplamFayda =
                yillikFayda *
                toplamHizmet;


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


            const devam =
                devamOlasiligi(
                    kalanYil,
                    v
                );


            const beklenenFayda =
                kazanilmisFayda *
                devam;


            const iskonto =
                iskontoFaktoru(
                    v.iskontoOrani,
                    kalanYil
                );


            const dbo =
                beklenenFayda *
                iskonto;


            liste.push({

                yil:
                    yil,

                tarih:
                    tarih,

                yas:
                    yas,

                kalanYil:
                    kalanYil,

                maas:
                    maas,

                projekteTavan:
                    projekteTavan,

                hesaplamaMaasi:
                    hesaplamaMaasi,

                hizmetSuresi:
                    hizmetSuresi,

                toplamHizmet:
                    toplamHizmet,

                gecmisHizmetOrani:
                    gecmisHizmetOrani,

                yillikFayda:
                    yillikFayda,

                toplamFayda:
                    toplamFayda,

                kazanilmisFayda:
                    kazanilmisFayda,

                devamOlasiligi:
                    devam,

                beklenenFayda:
                    beklenenFayda,

                iskontoFaktoru:
                    iskonto,

                dbo:
                    dbo
            });
        }


        return liste;
    }


    /* ============================================================
       15 — HIZLI DBO FONKSİYONU
       ------------------------------------------------------------
       Portfolio engine için kullanılabilecek sade interface.
    ============================================================ */

    function dboHesapla(
        personel,
        varsayimlar
    ) {

        const sonuc =
            hesapla(
                personel,
                varsayimlar
            );


        return sonuc.muhasebe.dbo;
    }


    /* ============================================================
       16 — DBO / P&L HESAPLARI İÇİN SADE INTERFACE
    ============================================================ */

    function muhasebeHesapla(
        personel,
        varsayimlar
    ) {

        const sonuc =
            hesapla(
                personel,
                varsayimlar
            );


        return {

            dbo:
                sonuc.muhasebe.dbo,

            cariHizmetMaliyeti:
                sonuc.muhasebe.cariHizmetMaliyeti,

            faizMaliyeti:
                sonuc.muhasebe.faizMaliyeti
        };
    }


    /* ============================================================
       17 — SENARYO HESAPLAMA
       ------------------------------------------------------------
       Portfolio engine / sensitivity katmanı için kullanılabilir.
       Ancak portföy toplamı burada yapılmaz.
    ============================================================ */

    function senaryoHesapla(
        personel,
        temelVarsayimlar,
        senaryoVarsayimlari
    ) {

        const temel =
            varsayimNormalizeEt(
                temelVarsayimlar
            );


        const senaryo =
            {
                ...temel,
                ...(senaryoVarsayimlari || {})
            };


        const sonuc =
            hesapla(
                personel,
                senaryo
            );


        return {

            varsayimlar:
                senaryo,

            sonuc:
                sonuc
        };
    }


    /* ============================================================
       18 — ENGINE HEALTH CHECK
    ============================================================ */

    function healthCheck() {

        return {

            status:
                "OK",

            engine:
                TMS19ActuarialEngine.engineName,

            version:
                TMS19ActuarialEngine.version,

            standard:
                TMS19ActuarialEngine.standard,

            method:
                TMS19ActuarialEngine.method,

            timestamp:
                new Date().toISOString()
        };
    }


    /* ============================================================
       19 — PUBLIC API
    ============================================================ */

    TMS19ActuarialEngine.sayi =
        sayi;


    TMS19ActuarialEngine.sinirla =
        sinirla;


    TMS19ActuarialEngine.tarih =
        tarih;


    TMS19ActuarialEngine.yuvarla =
        yuvarla;


    TMS19ActuarialEngine.yilFarki =
        yilFarki;


    TMS19ActuarialEngine.yasHesapla =
        yasHesapla;


    TMS19ActuarialEngine.tarihEkleYil =
        tarihEkleYil;


    TMS19ActuarialEngine.personelNormalizeEt =
        personelNormalizeEt;


    TMS19ActuarialEngine.varsayimNormalizeEt =
        varsayimNormalizeEt;


    TMS19ActuarialEngine.personelValidate =
        personelValidate;


    TMS19ActuarialEngine.varsayimValidate =
        varsayimValidate;


    TMS19ActuarialEngine.hizmetAnalizi =
        hizmetAnalizi;


    TMS19ActuarialEngine.maasProjeksiyonu =
        maasProjeksiyonu;


    TMS19ActuarialEngine.kidemTavaniHesapla =
        kidemTavaniHesapla;


    TMS19ActuarialEngine.devamOlasiligi =
        devamOlasiligi;


    TMS19ActuarialEngine.yillikDevamOlasiligi =
        yillikDevamOlasiligi;


    TMS19ActuarialEngine.iskontoFaktoru =
        iskontoFaktoru;


    TMS19ActuarialEngine.hesapla =
        hesapla;


    TMS19ActuarialEngine.dboHesapla =
        dboHesapla;


    TMS19ActuarialEngine.muhasebeHesapla =
        muhasebeHesapla;


    TMS19ActuarialEngine.yillikProjeksiyon =
        yillikProjeksiyon;


    TMS19ActuarialEngine.senaryoHesapla =
        senaryoHesapla;


    TMS19ActuarialEngine.healthCheck =
        healthCheck;


    /* ============================================================
       20 — GLOBAL EXPORT
    ============================================================ */

    global.TMS19ActuarialEngine =
        TMS19ActuarialEngine;


    /*
     * Geriye dönük uyumluluk:
     *
     * Eğer mevcut dashboard'un bazı bölümleri
     * window.TMS19 üzerinden erişiyorsa,
     * minimal bir alias bırakıyoruz.
     *
     * Portföy fonksiyonları burada oluşturulmuyor.
     */

    if (
        !global.TMS19
    ) {

        global.TMS19 = {};
    }


    global.TMS19.ActuarialEngine =
        TMS19ActuarialEngine;


})(typeof window !== "undefined"
    ? window
    : globalThis);
