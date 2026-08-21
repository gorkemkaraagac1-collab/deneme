/* ================================================================
   GK FINANCIAL DECISION COCKPIT
   TMS 19 ACTUARIAL ENGINE
   ----------------------------------------------------------------
   Standart      : TMS 19 Çalışanlara Sağlanan Faydalar
   Yöntem        : Projected Unit Credit (PUC)
   Motor         : GK Actuarial Engine
   Versiyon      : 4.0.0
   Dil           : Türkçe
================================================================ */

(function (global) {

    "use strict";


    /* ============================================================
       00 — NAMESPACE
    ============================================================ */

    const TMS19 = {};

    TMS19.motorAdi =
        "GK TMS 19 Aktüeryal Hesaplama Motoru";

    TMS19.versiyon =
        "4.0.0";

    TMS19.yontem =
        "Projected Unit Credit";

    TMS19.standart =
        "TMS 19";


    /* ============================================================
       01 — GENEL YARDIMCILAR
    ============================================================ */

    TMS19.sayi = function (
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

        if (typeof deger === "number") {

            return isFinite(deger)
                ? deger
                : varsayilan;
        }

        let temiz =
            String(deger)
                .trim()
                .replace(/\s/g, "");

        if (
            temiz.includes(".") &&
            temiz.includes(",")
        ) {

            temiz =
                temiz
                    .replace(/\./g, "")
                    .replace(",", ".");
        }

        else if (
            temiz.includes(",")
        ) {

            temiz =
                temiz.replace(",", ".");
        }

        const sonuc =
            Number(temiz);

        return isFinite(sonuc)
            ? sonuc
            : varsayilan;
    };


    TMS19.sinirla = function (
        deger,
        min,
        max
    ) {

        return Math.min(
            Math.max(
                TMS19.sayi(deger),
                min
            ),
            max
        );
    };


    TMS19.yuvarla = function (
        deger,
        basamak = 2
    ) {

        const katsayi =
            Math.pow(
                10,
                basamak
            );

        return Math.round(
            TMS19.sayi(deger) *
            katsayi
        ) / katsayi;
    };


    TMS19.mutlak = function (
        deger
    ) {

        return Math.abs(
            TMS19.sayi(deger)
        );
    };


    TMS19.sifiraBolme = function (
        pay,
        payda,
        varsayilan = 0
    ) {

        const p =
            TMS19.sayi(pay);

        const d =
            TMS19.sayi(payda);

        if (d === 0) {

            return varsayilan;
        }

        return p / d;
    };


    /* ============================================================
       02 — TARİH MOTORU
    ============================================================ */

    TMS19.tarih = function (
        deger
    ) {

        if (deger instanceof Date) {

            return new Date(
                deger.getTime()
            );
        }

        if (!deger) {

            return null;
        }

        const sonuc =
            new Date(deger);

        if (
            isNaN(
                sonuc.getTime()
            )
        ) {

            return null;
        }

        return sonuc;
    };


    TMS19.yilFarki = function (
        baslangic,
        bitis
    ) {

        const bas =
            TMS19.tarih(
                baslangic
            );

        const bit =
            TMS19.tarih(
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
    };


    TMS19.ayFarki = function (
        baslangic,
        bitis
    ) {

        return (
            TMS19.yilFarki(
                baslangic,
                bitis
            ) * 12
        );
    };


    TMS19.yasHesapla = function (
        dogumTarihi,
        degerlemeTarihi
    ) {

        const dogum =
            TMS19.tarih(
                dogumTarihi
            );

        const degerleme =
            TMS19.tarih(
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

        const ay =
            degerleme.getMonth() -
            dogum.getMonth();

        if (
            ay < 0 ||
            (
                ay === 0 &&
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
    };


    TMS19.tarihEkleYil = function (
        tarih,
        yil
    ) {

        const sonuc =
            TMS19.tarih(
                tarih
            );

        if (!sonuc) {

            return null;
        }

        sonuc.setFullYear(
            sonuc.getFullYear() +
            Math.round(
                TMS19.sayi(yil)
            )
        );

        return sonuc;
    };


    /* ============================================================
       03 — PERSONEL NORMALİZASYONU
    ============================================================ */

    TMS19.personelNormalizeEt = function (
        personel
    ) {

        const p =
            personel || {};

        return {

            personelId:
                p.personelId ??
                p.id ??
                p.sicilNo ??
                p.employeeId ??
                "",

            adSoyad:
                p.adSoyad ??
                p.ad_soyad ??
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
                TMS19.sayi(
                    p.mevcutMaas ??
                    p.mevcut_maas ??
                    p.salary ??
                    p.maas ??
                    p.currentSalary
                ),

            cinsiyet:
                p.cinsiyet ??
                p.gender ??
                "",

            kalanIzin:
                TMS19.sayi(
                    p.kalanIzin ??
                    p.remainingLeave
                )
        };
    };


    /* ============================================================
       04 — PERSONEL VALIDATION
    ============================================================ */

    TMS19.personelValidate = function (
        personel
    ) {

        const errors = [];

        const p =
            TMS19.personelNormalizeEt(
                personel
            );

        const dogum =
            TMS19.tarih(
                p.dogumTarihi
            );

        const giris =
            TMS19.tarih(
                p.iseGirisTarihi
            );

        if (!dogum) {

            errors.push(
                "Doğum tarihi geçerli değil."
            );
        }

        if (!giris) {

            errors.push(
                "İşe giriş tarihi geçerli değil."
            );
        }

        if (
            p.mevcutMaas < 0
        ) {

            errors.push(
                "Mevcut maaş negatif olamaz."
            );
        }

        if (
            dogum &&
            giris &&
            giris < dogum
        ) {

            errors.push(
                "İşe giriş tarihi doğum tarihinden önce olamaz."
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
       05 — VARSAYIM NORMALİZASYONU
    ============================================================ */

    TMS19.varsayimNormalizeEt = function (
        varsayimlar
    ) {

        const v =
            varsayimlar || {};

        return {

            degerlemeTarihi:
                v.degerlemeTarihi ||
                new Date(),

            emeklilikYasi:
                TMS19.sayi(
                    v.emeklilikYasi,
                    60
                ),

            maasArtisOrani:
                TMS19.sayi(
                    v.maasArtisOrani
                ),

            kidemTavani:
                TMS19.sayi(
                    v.kidemTavani
                ),

            kidemTavaniArtisOrani:
                TMS19.sayi(
                    v.kidemTavaniArtisOrani
                ),

            faydaOrani:
                TMS19.sayi(
                    v.faydaOrani
                ),

            iskontoOrani:
                TMS19.sayi(
                    v.iskontoOrani
                ),

            personelDevirOrani:
                TMS19.sayi(
                    v.personelDevirOrani
                ),

            olumOrani:
                TMS19.sayi(
                    v.olumOrani
                ),

            enflasyonOrani:
                TMS19.sayi(
                    v.enflasyonOrani
                ),

            paraBirimi:
                v.paraBirimi ||
                "TRY"
        };
    };


    /* ============================================================
       06 — VARSAYIM VALIDATION
    ============================================================ */

    TMS19.varsayimlariValidateEt =
        function (
            varsayimlar
        ) {

            const v =
                TMS19.varsayimNormalizeEt(
                    varsayimlar
                );

            const errors = [];

            if (
                v.emeklilikYasi <= 0
            ) {

                errors.push(
                    "Emeklilik yaşı geçerli değil."
                );
            }

            if (
                v.iskontoOrani <= -1
            ) {

                errors.push(
                    "İskonto oranı -100%'den küçük veya eşit olamaz."
                );
            }

            if (
                v.maasArtisOrani <= -1
            ) {

                errors.push(
                    "Maaş artış oranı -100%'den küçük veya eşit olamaz."
                );
            }

            if (
                v.kidemTavaniArtisOrani <= -1
            ) {

                errors.push(
                    "Kıdem tavanı artış oranı -100%'den küçük veya eşit olamaz."
                );
            }

            if (
                v.personelDevirOrani < 0 ||
                v.personelDevirOrani > 1
            ) {

                errors.push(
                    "Personel devir oranı 0-1 arasında olmalıdır."
                );
            }

            if (
                v.olumOrani < 0 ||
                v.olumOrani > 1
            ) {

                errors.push(
                    "Ölüm oranı 0-1 arasında olmalıdır."
                );
            }

            if (
                v.faydaOrani < 0
            ) {

                errors.push(
                    "Fayda oranı negatif olamaz."
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
       07 — MAAŞ PROJEKSİYONU
    ============================================================ */

    TMS19.maasProjeksiyonu = function (
        mevcutMaas,
        kalanYil,
        varsayimlar
    ) {

        const baslangic =
            TMS19.sayi(
                mevcutMaas
            );

        const yil =
            Math.max(
                0,
                TMS19.sayi(
                    kalanYil
                )
            );

        const artis =
            TMS19.sayi(
                varsayimlar.maasArtisOrani
            );

        const emeklilikMaasi =
            baslangic *
            Math.pow(
                1 + artis,
                yil
            );

        return {

            mevcutMaas:
                baslangic,

            kalanYil:
                yil,

            maasArtisOrani:
                artis,

            emeklilikMaasi:
                emeklilikMaasi
        };
    };


    /* ============================================================
       08 — YILLIK MAAŞ PROJEKSİYONU
    ============================================================ */

    TMS19.yillikMaasProjeksi =
        function (
            mevcutMaas,
            yilSayisi,
            varsayimlar
        ) {

            const liste = [];

            const baslangic =
                TMS19.sayi(
                    mevcutMaas
                );

            const artis =
                TMS19.sayi(
                    varsayimlar.maasArtisOrani
                );

            const toplamYil =
                Math.max(
                    0,
                    Math.floor(
                        TMS19.sayi(
                            yilSayisi
                        )
                    )
                );

            for (
                let yil = 0;
                yil <= toplamYil;
                yil++
            ) {

                const maas =
                    baslangic *
                    Math.pow(
                        1 + artis,
                        yil
                    );

                liste.push({

                    yil:
                        yil,

                    maas:
                        maas,

                    artisOrani:
                        artis
                });
            }

            return liste;
        };


    /* ============================================================
       09 — KIDEM TAVANI
    ============================================================ */

    TMS19.kidemTavaniHesapla =
        function (
            emeklilikMaasi,
            kalanYil,
            varsayimlar
        ) {

            const maas =
                TMS19.sayi(
                    emeklilikMaasi
                );

            const yil =
                Math.max(
                    0,
                    TMS19.sayi(
                        kalanYil
                    )
                );

            const mevcutTavan =
                TMS19.sayi(
                    varsayimlar.kidemTavani
                );

            const artis =
                TMS19.sayi(
                    varsayimlar.kidemTavaniArtisOrani
                );

            if (
                mevcutTavan <= 0
            ) {

                return {

                    uygulandi:
                        false,

                    mevcutTavan:
                        mevcutTavan,

                    projekteTavan:
                        Infinity,

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
        };


    /* ============================================================
       10 — DEMOGRAFİK OLASILIK
    ============================================================ */

    TMS19.devamOlasiligi =
        function (
            kalanYil,
            varsayimlar
        ) {

            const yil =
                Math.max(
                    0,
                    TMS19.sayi(
                        kalanYil
                    )
                );

            const devir =
                TMS19.sinirla(
                    varsayimlar.personelDevirOrani,
                    0,
                    1
                );

            const olum =
                TMS19.sinirla(
                    varsayimlar.olumOrani,
                    0,
                    1
                );

            /*
             * Her yıl çalışanın sistemde kalma
             * olasılığı:
             *
             * (1 - devir) x (1 - ölüm)
             */

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
        };


    TMS19.yillikDevamOlasiligi =
        function (
            varsayimlar
        ) {

            const devir =
                TMS19.sinirla(
                    varsayimlar.personelDevirOrani,
                    0,
                    1
                );

            const olum =
                TMS19.sinirla(
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
        };


    /* ============================================================
       11 — İSKONTO FAKTÖRÜ
    ============================================================ */

    TMS19.iskontoFaktoru =
        function (
            iskontoOrani,
            kalanYil
        ) {

            const oran =
                TMS19.sayi(
                    iskontoOrani
                );

            const yil =
                Math.max(
                    0,
                    TMS19.sayi(
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
        };


    /* ============================================================
       12 — TOPLAM HİZMET
    ============================================================ */

    TMS19.hizmetAnalizi =
        function (
            iseGirisTarihi,
            degerlemeTarihi,
            emekliligeKalanYil
        ) {

            const mevcutHizmet =
                TMS19.yilFarki(
                    iseGirisTarihi,
                    degerlemeTarihi
                );

            const gelecekHizmet =
                Math.max(
                    0,
                    TMS19.sayi(
                        emekliligeKalanYil
                    )
                );

            const toplamHizmet =
                mevcutHizmet +
                gelecekHizmet;

            return {

                mevcutHizmet:
                    mevcutHizmet,

                gelecekHizmet:
                    gelecekHizmet,

                toplamHizmet:
                    toplamHizmet
            };
        };


    /* ============================================================
       13 — TEK PERSONEL AKTÜERYAL HESAPLAMA
    ============================================================ */

    TMS19.personelHesapla =
        function (
            personel,
            varsayimlar,
            index = 0
        ) {

            const p =
                TMS19.personelNormalizeEt(
                    personel
                );

            const v =
                TMS19.varsayimNormalizeEt(
                    varsayimlar
                );

            /*
             * Validation
             */

            const personelValidation =
                TMS19.personelValidate(
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
                TMS19.varsayimlariValidateEt(
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


            /* ----------------------------------------------------
               TARİHLER
            ---------------------------------------------------- */

            const degerlemeTarihi =
                TMS19.tarih(
                    v.degerlemeTarihi
                );

            const dogumTarihi =
                TMS19.tarih(
                    p.dogumTarihi
                );

            const iseGirisTarihi =
                TMS19.tarih(
                    p.iseGirisTarihi
                );


            /* ----------------------------------------------------
               TEMEL DEĞİŞKENLER
            ---------------------------------------------------- */

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
                    v.emeklilikYasi -
                    yas
                );


            /* ----------------------------------------------------
               HİZMET ANALİZİ
            ---------------------------------------------------- */

            const hizmet =
                TMS19.hizmetAnalizi(
                    iseGirisTarihi,
                    degerlemeTarihi,
                    emekliligeKalanYil
                );

            const toplamHizmet =
                hizmet.toplamHizmet;


            /* ----------------------------------------------------
               MAAŞ PROJEKSİYONU
            ---------------------------------------------------- */

            const maas =
                TMS19.maasProjeksiyonu(
                    mevcutMaas,
                    emekliligeKalanYil,
                    v
                );

            const emeklilikMaasi =
                maas.emeklilikMaasi;


            /* ----------------------------------------------------
               KIDEM TAVANI
            ---------------------------------------------------- */

            const tavan =
                TMS19.kidemTavaniHesapla(
                    emeklilikMaasi,
                    emekliligeKalanYil,
                    v
                );

            const faydaHesaplamaMaasi =
                tavan.hesaplamaMaasi;


            /* ----------------------------------------------------
               YILLIK FAYDA
            ---------------------------------------------------- */

            const yillikFayda =
                faydaHesaplamaMaasi *
                v.faydaOrani;


            /* ----------------------------------------------------
               TOPLAM BEKLENEN FAYDA
            ---------------------------------------------------- */

            const toplamFayda =
                yillikFayda *
                toplamHizmet;


            /* ----------------------------------------------------
               GEÇMİŞ HİZMET ORANI
            ---------------------------------------------------- */

            const gecmisHizmetOrani =
                toplamHizmet > 0
                    ? Math.min(
                        1,
                        hizmetSuresi /
                        toplamHizmet
                    )
                    : 0;


            /* ----------------------------------------------------
               KAZANILMIŞ FAYDA
            ---------------------------------------------------- */

            const kazanilmisFayda =
                toplamFayda *
                gecmisHizmetOrani;


            /* ----------------------------------------------------
               DEMOGRAFİK OLASILIK
            ---------------------------------------------------- */

            const devamOlasiligi =
                TMS19.devamOlasiligi(
                    emekliligeKalanYil,
                    v
                );


            /* ----------------------------------------------------
               BEKLENEN FAYDA
            ---------------------------------------------------- */

            const beklenenFayda =
                kazanilmisFayda *
                devamOlasiligi;


            /* ----------------------------------------------------
               İSKONTO
            ---------------------------------------------------- */

            const iskontoFaktoru =
                TMS19.iskontoFaktoru(
                    v.iskontoOrani,
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
            ---------------------------------------------------- */

            const faizMaliyeti =
                dbo *
                v.iskontoOrani;


            /* ----------------------------------------------------
               NET HESAPLAMA
            ---------------------------------------------------- */

            const gelecektekiFayda =
                toplamFayda -
                kazanilmisFayda;

            const iskontoTutari =
                beklenenFayda -
                dbo;


            /* ----------------------------------------------------
               SONUÇ
            ---------------------------------------------------- */

            return {

                index:
                    index,

                personelId:
                    p.personelId,

                adSoyad:
                    p.adSoyad,

                departman:
                    p.departman,

                pozisyon:
                    p.pozisyon,

                cinsiyet:
                    p.cinsiyet,


                /*
                 * Tarihler
                 */

                dogumTarihi:
                    dogumTarihi,

                iseGirisTarihi:
                    iseGirisTarihi,

                degerlemeTarihi:
                    degerlemeTarihi,


                /*
                 * Demografik bilgiler
                 */

                yas:
                    yas,

                emeklilikYasi:
                    v.emeklilikYasi,

                emekliligeKalanYil:
                    emekliligeKalanYil,


                /*
                 * Hizmet
                 */

                hizmetSuresi:
                    hizmetSuresi,

                gelecekHizmet:
                    hizmet.gelecekHizmet,

                toplamHizmet:
                    toplamHizmet,

                gecmisHizmetOrani:
                    gecmisHizmetOrani,


                /*
                 * Maaş
                 */

                mevcutMaas:
                    mevcutMaas,

                emeklilikMaasi:
                    emeklilikMaasi,

                faydaHesaplamaMaasi:
                    faydaHesaplamaMaasi,

                maasArtisOrani:
                    v.maasArtisOrani,


                /*
                 * Kıdem tavanı
                 */

                kidemTavani:
                    tavan.mevcutTavan,

                projekteKidemTavani:
                    tavan.projekteTavan,

                tavanUygulandi:
                    tavan.uygulandi,

                tavanFarki:
                    tavan.tavanFarki,


                /*
                 * Fayda
                 */

                faydaOrani:
                    v.faydaOrani,

                yillikFayda:
                    yillikFayda,

                toplamFayda:
                    toplamFayda,

                kazanilmisFayda:
                    kazanilmisFayda,

                gelecektekiFayda:
                    gelecektekiFayda,


                /*
                 * Demografi
                 */

                personelDevirOrani:
                    v.personelDevirOrani,

                olumOrani:
                    v.olumOrani,

                devamOlasiligi:
                    devamOlasiligi,

                beklenenFayda:
                    beklenenFayda,


                /*
                 * İskonto
                 */

                iskontoOrani:
                    v.iskontoOrani,

                iskontoFaktoru:
                    iskontoFaktoru,

                iskontoTutari:
                    iskontoTutari,


                /*
                 * Muhasebe
                 */

                dbo:
                    dbo,

                cariHizmetMaliyeti:
                    cariHizmetMaliyeti,

                faizMaliyeti:
                    faizMaliyeti,


                /*
                 * Meta
                 */

                paraBirimi:
                    v.paraBirimi,

                hesaplamaTarihi:
                    new Date()
            };
        };


    /* ============================================================
       14 — YILLIK PROJEKSİYON
    ============================================================ */

    TMS19.personelYillikProjeksiyon =
        function (
            personel,
            varsayimlar
        ) {

            const p =
                TMS19.personelNormalizeEt(
                    personel
                );

            const v =
                TMS19.varsayimNormalizeEt(
                    varsayimlar
                );

            const temel =
                TMS19.personelHesapla(
                    p,
                    v
                );

            const liste = [];

            const toplamYil =
                Math.ceil(
                    temel.emekliligeKalanYil
                );

            for (
                let yil = 0;
                yil <= toplamYil;
                yil++
            ) {

                const gelecekTarih =
                    TMS19.tarihEkleYil(
                        v.degerlemeTarihi,
                        yil
                    );

                const gelecekYas =
                    temel.yas +
                    yil;

                const kalanYil =
                    Math.max(
                        0,
                        temel.emekliligeKalanYil -
                        yil
                    );

                const maas =
                    temel.mevcutMaas *
                    Math.pow(
                        1 + v.maasArtisOrani,
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
                        : Infinity;

                const hesaplamaMaasi =
                    Math.min(
                        maas,
                        projekteTavan
                    );

                const hizmet =
                    temel.hizmetSuresi +
                    yil;

                const toplamHizmet =
                    hizmet +
                    kalanYil;

                const yillikFayda =
                    hesaplamaMaasi *
                    v.faydaOrani;

                const toplamFayda =
                    yillikFayda *
                    toplamHizmet;

                const kazanilmisFayda =
                    toplamHizmet > 0
                        ? toplamFayda *
                          Math.min(
                              1,
                              hizmet /
                              toplamHizmet
                          )
                        : 0;

                const devam =
                    TMS19.devamOlasiligi(
                        kalanYil,
                        v
                    );

                const beklenen =
                    kazanilmisFayda *
                    devam;

                const iskonto =
                    TMS19.iskontoFaktoru(
                        v.iskontoOrani,
                        kalanYil
                    );

                const dbo =
                    beklenen *
                    iskonto;

                liste.push({

                    yil:
                        yil,

                    tarih:
                        gelecekTarih,

                    yas:
                        gelecekYas,

                    kalanYil:
                        kalanYil,

                    maas:
                        maas,

                    projekteTavan:
                        projekteTavan,

                    hesaplamaMaasi:
                        hesaplamaMaasi,

                    hizmetSuresi:
                        hizmet,

                    toplamHizmet:
                        toplamHizmet,

                    yillikFayda:
                        yillikFayda,

                    toplamFayda:
                        toplamFayda,

                    kazanilmisFayda:
                        kazanilmisFayda,

                    devamOlasiligi:
                        devam,

                    beklenenFayda:
                        beklenen,

                    iskontoFaktoru:
                        iskonto,

                    dbo:
                        dbo
                });
            }

            return liste;
        };


    /* ============================================================
       15 — TOPLU PERSONEL HESAPLAMA
    ============================================================ */

    TMS19.portfoyHesapla =
        function (
            personeller,
            varsayimlar
        ) {

            const liste = [];

            const hatalar = [];

            const personelListesi =
                Array.isArray(
                    personeller
                )
                    ? personeller
                    : [];

            personelListesi.forEach(
                function (
                    personel,
                    index
                ) {

                    try {

                        const sonuc =
                            TMS19.personelHesapla(
                                personel,
                                varsayimlar,
                                index
                            );

                        liste.push(
                            sonuc
                        );

                    }

                    catch (error) {

                        hatalar.push({

                            index:
                                index,

                            personelId:
                                personel?.personelId ??
                                personel?.id ??
                                "",

                            adSoyad:
                                personel?.adSoyad ??
                                "",

                            hata:
                                error.message
                        });
                    }
                }
            );


            /* ----------------------------------------------------
               TOPLAM KPI
            ---------------------------------------------------- */

            const toplamDBO =
                liste.reduce(
                    function (
                        toplam,
                        item
                    ) {

                        return toplam +
                            TMS19.sayi(
                                item.dbo
                            );
                    },
                    0
                );


            const toplamCariHizmetMaliyeti =
                liste.reduce(
                    function (
                        toplam,
                        item
                    ) {

                        return toplam +
                            TMS19.sayi(
                                item.cariHizmetMaliyeti
                            );
                    },
                    0
                );


            const toplamFaizMaliyeti =
                liste.reduce(
                    function (
                        toplam,
                        item
                    ) {

                        return toplam +
                            TMS19.sayi(
                                item.faizMaliyeti
                            );
                    },
                    0
                );


            const toplamMevcutMaas =
                liste.reduce(
                    function (
                        toplam,
                        item
                    ) {

                        return toplam +
                            TMS19.sayi(
                                item.mevcutMaas
                            );
                    },
                    0
                );


            const toplamEmeklilikMaasi =
                liste.reduce(
                    function (
                        toplam,
                        item
                    ) {

                        return toplam +
                            TMS19.sayi(
                                item.emeklilikMaasi
                            );
                    },
                    0
                );


            const toplamKazanilmisFayda =
                liste.reduce(
                    function (
                        toplam,
                        item
                    ) {

                        return toplam +
                            TMS19.sayi(
                                item.kazanilmisFayda
                            );
                    },
                    0
                );


            const toplamBeklenenFayda =
                liste.reduce(
                    function (
                        toplam,
                        item
                    ) {

                        return toplam +
                            TMS19.sayi(
                                item.beklenenFayda
                            );
                    },
                    0
                );


            const toplamTavanFarki =
                liste.reduce(
                    function (
                        toplam,
                        item
                    ) {

                        return toplam +
                            TMS19.sayi(
                                item.tavanFarki
                            );
                    },
                    0
                );


            const tavanUygulananPersonel =
                liste.filter(
                    function (item) {

                        return (
                            item.tavanUygulandi === true
                        );
                    }
                ).length;


            const ortalamaYas =
                liste.length > 0
                    ? liste.reduce(
                        function (
                            toplam,
                            item
                        ) {

                            return toplam +
                                item.yas;
                        },
                        0
                    ) / liste.length
                    : 0;


            const ortalamaHizmet =
                liste.length > 0
                    ? liste.reduce(
                        function (
                            toplam,
                            item
                        ) {

                            return toplam +
                                item.hizmetSuresi;
                        },
                        0
                    ) / liste.length
                    : 0;


            const ortalamaDBO =
                liste.length > 0
                    ? toplamDBO /
                      liste.length
                    : 0;


            return {

                meta: {

                    motor:
                        TMS19.motorAdi,

                    versiyon:
                        TMS19.versiyon,

                    standart:
                        TMS19.standart,

                    yontem:
                        TMS19.yontem,

                    hesaplamaTarihi:
                        new Date(),

                    personelSayisi:
                        personelListesi.length,

                    basariliPersonel:
                        liste.length,

                    hataliPersonel:
                        hatalar.length
                },

                kpi: {

                    toplamDBO:
                        toplamDBO,

                    toplamCariHizmetMaliyeti:
                        toplamCariHizmetMaliyeti,

                    toplamFaizMaliyeti:
                        toplamFaizMaliyeti,

                    toplamMevcutMaas:
                        toplamMevcutMaas,

                    toplamEmeklilikMaasi:
                        toplamEmeklilikMaasi,

                    toplamKazanilmisFayda:
                        toplamKazanilmisFayda,

                    toplamBeklenenFayda:
                        toplamBeklenenFayda,

                    toplamTavanFarki:
                        toplamTavanFarki,

                    ortalamaYas:
                        ortalamaYas,

                    ortalamaHizmet:
                        ortalamaHizmet,

                    ortalamaDBO:
                        ortalamaDBO,

                    tavanUygulananPersonel:
                        tavanUygulananPersonel
                },

                personeller:
                    liste,

                hatalar:
                    hatalar
            };
        };


    /* ============================================================
       16 — DEPARTMAN BAZLI ANALİZ
    ============================================================ */

    TMS19.departmanAnalizi =
        function (
            hesaplamaSonucu
        ) {

            const personeller =
                hesaplamaSonucu?.personeller ||
                [];

            const gruplar = {};

            personeller.forEach(
                function (
                    personel
                ) {

                    const departman =
                        personel.departman ||
                        "Tanımsız";

                    if (
                        !gruplar[departman]
                    ) {

                        gruplar[departman] = {

                            departman:
                                departman,

                            personelSayisi:
                                0,

                            toplamDBO:
                                0,

                            toplamCariHizmetMaliyeti:
                                0,

                            toplamFaizMaliyeti:
                                0,

                            toplamMaas:
                                0,

                            toplamKazanilmisFayda:
                                0
                        };
                    }

                    const grup =
                        gruplar[departman];

                    grup.personelSayisi++;

                    grup.toplamDBO +=
                        TMS19.sayi(
                            personel.dbo
                        );

                    grup.toplamCariHizmetMaliyeti +=
                        TMS19.sayi(
                            personel.cariHizmetMaliyeti
                        );

                    grup.toplamFaizMaliyeti +=
                        TMS19.sayi(
                            personel.faizMaliyeti
                        );

                    grup.toplamMaas +=
                        TMS19.sayi(
                            personel.mevcutMaas
                        );

                    grup.toplamKazanilmisFayda +=
                        TMS19.sayi(
                            personel.kazanilmisFayda
                        );
                }
            );

            return Object.values(
                gruplar
            );
        };


    /* ============================================================
       17 — YAŞ GRUBU ANALİZİ
    ============================================================ */

    TMS19.yasGrubuAnalizi =
        function (
            hesaplamaSonucu
        ) {

            const personeller =
                hesaplamaSonucu?.personeller ||
                [];

            const gruplar = {

                "30 Yaş Altı": [],
                "30-39": [],
                "40-49": [],
                "50-59": [],
                "60 Yaş ve Üzeri": []
            };


            personeller.forEach(
                function (
                    personel
                ) {

                    const yas =
                        TMS19.sayi(
                            personel.yas
                        );

                    if (
                        yas < 30
                    ) {

                        gruplar[
                            "30 Yaş Altı"
                        ].push(
                            personel
                        );
                    }

                    else if (
                        yas < 40
                    ) {

                        gruplar[
                            "30-39"
                        ].push(
                            personel
                        );
                    }

                    else if (
                        yas < 50
                    ) {

                        gruplar[
                            "40-49"
                        ].push(
                            personel
                        );
                    }

                    else if (
                        yas < 60
                    ) {

                        gruplar[
                            "50-59"
                        ].push(
                            personel
                        );
                    }

                    else {

                        gruplar[
                            "60 Yaş ve Üzeri"
                        ].push(
                            personel
                        );
                    }
                }
            );


            return Object.keys(
                gruplar
            ).map(
                function (
                    grup
                ) {

                    const liste =
                        gruplar[grup];

                    const dbo =
                        liste.reduce(
                            function (
                                toplam,
                                item
                            ) {

                                return toplam +
                                    TMS19.sayi(
                                        item.dbo
                                    );
                            },
                            0
                        );

                    return {

                        yasGrubu:
                            grup,

                        personelSayisi:
                            liste.length,

                        toplamDBO:
                            dbo
                    };
                }
            );
        };


    /* ============================================================
       18 — DUYARLILIK ANALİZİ
    ============================================================ */

    TMS19.duyarlilikAnalizi =
        function (
            personeller,
            varsayimlar,
            senaryolar
        ) {

            const temelVarsayim =
                TMS19.varsayimNormalizeEt(
                    varsayimlar
                );

            const senaryoListesi =
                Array.isArray(
                    senaryolar
                )
                    ? senaryolar
                    : [];


            return senaryoListesi.map(
                function (
                    senaryo
                ) {

                    const v = {

                        ...temelVarsayim,

                        ...senaryo
                    };

                    const sonuc =
                        TMS19.portfoyHesapla(
                            personeller,
                            v
                        );

                    return {

                        senaryo:
                            senaryo.ad ||
                            "Senaryo",

                        varsayimlar:
                            v,

                        toplamDBO:
                            sonuc.kpi.toplamDBO,

                        toplamCariHizmetMaliyeti:
                            sonuc.kpi.toplamCariHizmetMaliyeti,

                        toplamFaizMaliyeti:
                            sonuc.kpi.toplamFaizMaliyeti
                    };
                }
            );
        };


    /* ============================================================
       19 — STANDART DUYARLILIK SENARYOLARI
    ============================================================ */

    TMS19.standartDuyarlilik =
        function (
            personeller,
            varsayimlar
        ) {

            const v =
                TMS19.varsayimNormalizeEt(
                    varsayimlar
                );

            const iskonto =
                v.iskontoOrani;

            const maasArtisi =
                v.maasArtisOrani;


            const senaryolar = [

                {
                    ad:
                        "Temel Senaryo"
                },

                {
                    ad:
                        "İskonto +100 bp",

                    iskontoOrani:
                        iskonto + 0.01
                },

                {
                    ad:
                        "İskonto -100 bp",

                    iskontoOrani:
                        Math.max(
                            -0.99,
                            iskonto - 0.01
                        )
                },

                {
                    ad:
                        "Maaş Artışı +100 bp",

                    maasArtisOrani:
                        maasArtisi + 0.01
                },

                {
                    ad:
                        "Maaş Artışı -100 bp",

                    maasArtisOrani:
                        Math.max(
                            -0.99,
                            maasArtisi - 0.01
                        )
                }
            ];

            return TMS19.duyarlilikAnalizi(
                personeller,
                v,
                senaryolar
            );
        };


    /* ============================================================
       20 — SONUÇ ÖZETİ
    ============================================================ */

    TMS19.ozetOlustur =
        function (
            hesaplamaSonucu
        ) {

            if (
                !hesaplamaSonucu
            ) {

                return null;
            }

            const kpi =
                hesaplamaSonucu.kpi ||
                {};

            return {

                toplamPersonel:
                    hesaplamaSonucu.meta?.personelSayisi ||
                    0,

                hesaplananPersonel:
                    hesaplamaSonucu.meta?.basariliPersonel ||
                    0,

                hataliPersonel:
                    hesaplamaSonucu.meta?.hataliPersonel ||
                    0,

                toplamDBO:
                    TMS19.yuvarla(
                        kpi.toplamDBO
                    ),

                cariHizmetMaliyeti:
                    TMS19.yuvarla(
                        kpi.toplamCariHizmetMaliyeti
                    ),

                faizMaliyeti:
                    TMS19.yuvarla(
                        kpi.toplamFaizMaliyeti
                    ),

                ortalamaYas:
                    TMS19.yuvarla(
                        kpi.ortalamaYas
                    ),

                ortalamaHizmet:
                    TMS19.yuvarla(
                        kpi.ortalamaHizmet
                    ),

                tavanUygulananPersonel:
                    kpi.tavanUygulananPersonel ||
                    0
            };
        };


    /* ============================================================
       21 — JSON EXPORT
    ============================================================ */

    TMS19.jsonOlustur =
        function (
            hesaplamaSonucu
        ) {

            return JSON.stringify(
                hesaplamaSonucu,
                function (
                    key,
                    value
                ) {

                    if (
                        value instanceof Date
                    ) {

                        return value.toISOString();
                    }

                    if (
                        value === Infinity
                    ) {

                        return null;
                    }

                    return value;
                },
                2
            );
        };


    /* ============================================================
       22 — CSV EXPORT
    ============================================================ */

    TMS19.csvOlustur =
        function (
            personeller
        ) {

            const liste =
                Array.isArray(
                    personeller
                )
                    ? personeller
                    : [];

            const kolonlar = [

                "personelId",
                "adSoyad",
                "departman",
                "pozisyon",
                "yas",
                "hizmetSuresi",
                "emekliligeKalanYil",
                "mevcutMaas",
                "emeklilikMaasi",
                "faydaHesaplamaMaasi",
                "kidemTavani",
                "projeteKidemTavani",
                "tavanUygulandi",
                "yillikFayda",
                "toplamFayda",
                "kazanilmisFayda",
                "devamOlasiligi",
                "beklenenFayda",
                "iskontoFaktoru",
                "dbo",
                "cariHizmetMaliyeti",
                "faizMaliyeti"
            ];


            const satirlar = [

                kolonlar.join(";")
            ];


            liste.forEach(
                function (
                    item
                ) {

                    const satir =
                        kolonlar.map(
                            function (
                                kolon
                            ) {

                                let deger =
                                    item[kolon];

                                if (
                                    deger === null ||
                                    deger === undefined
                                ) {

                                    deger = "";
                                }

                                return String(
                                    deger
                                )
                                    .replace(
                                        /;/g,
                                        ","
                                    )
                                    .replace(
                                        /\r?\n/g,
                                        " "
                                    );
                            }
                        ).join(";");

                    satirlar.push(
                        satir
                    );
                }
            );

            return satirlar.join(
                "\n"
            );
        };


    /* ============================================================
       23 — MOTOR SAĞLIK KONTROLÜ
    ============================================================ */

    TMS19.motorKontrol =
        function () {

            return {

                aktif:
                    true,

                motor:
                    TMS19.motorAdi,

                versiyon:
                    TMS19.versiyon,

                standart:
                    TMS19.standart,

                yontem:
                    TMS19.yontem,

                zaman:
                    new Date(),

                fonksiyonlar: [

                    "sayi",
                    "sinirla",
                    "yuvarla",
                    "tarih",
                    "yilFarki",
                    "yasHesapla",
                    "personelNormalizeEt",
                    "personelValidate",
                    "varsayimNormalizeEt",
                    "varsayimlariValidateEt",
                    "maasProjeksiyonu",
                    "yillikMaasProjeksi",
                    "kidemTavaniHesapla",
                    "devamOlasiligi",
                    "iskontoFaktoru",
                    "personelHesapla",
                    "personelYillikProjeksiyon",
                    "portfoyHesapla",
                    "departmanAnalizi",
                    "yasGrubuAnalizi",
                    "duyarlilikAnalizi",
                    "standartDuyarlilik",
                    "ozetOlustur",
                    "jsonOlustur",
                    "csvOlustur"
                ]
            };
        };


    /* ============================================================
       24 — GLOBAL EXPORT
    ============================================================ */

    global.TMS19 =
        TMS19;


})(typeof window !== "undefined"
    ? window
    : globalThis);
