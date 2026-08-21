/* ================================================================
   TMS 19 ACTUARIAL ENGINE
   GK FINANCIAL DECISION COCKPIT

   TMS 19 Employee Benefits
   Projected Unit Credit Approach

   Ana modüller:
   - Veri normalizasyonu
   - Validation
   - Tarih hesaplamaları
   - Maaş projeksiyonu
   - Kıdem tavanı projeksiyonu
   - Turnover / mortality
   - Devam olasılığı
   - İskonto
   - PUC
   - DBO
   - Cari hizmet maliyeti
   - Faiz maliyeti
   - Personel bazlı hesaplama
   - Toplu hesaplama
   - Özet / kontrol
================================================================ */

(function (global) {

    "use strict";


    /* ============================================================
       ANA NAMESPACE
    ============================================================ */

    const TMS19 = {};


    /* ============================================================
       GENEL YARDIMCI FONKSİYONLAR
    ============================================================ */

    TMS19.sayi = function (deger, varsayilan = 0) {

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

        /*
         * Türkçe sayı formatı:
         *
         * 1.234.567,89
         *
         * veya
         *
         * 1234567.89
         */

        if (
            temiz.includes(".") &&
            temiz.includes(",")
        ) {

            temiz =
                temiz
                    .replace(/\./g, "")
                    .replace(",", ".");

        } else if (
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
                deger,
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
            deger * katsayi
        ) / katsayi;
    };


    /* ============================================================
       TARİH FONKSİYONLARI
    ============================================================ */

    TMS19.tarih = function (deger) {

        if (
            deger instanceof Date
        ) {

            return new Date(
                deger.getTime()
            );
        }

        if (
            !deger
        ) {

            return null;
        }

        const tarih =
            new Date(deger);

        if (
            isNaN(
                tarih.getTime()
            )
        ) {

            return null;
        }

        return tarih;
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


    /* ============================================================
       PERSONEL NORMALİZASYONU
    ============================================================ */

    TMS19.personelNormalizeEt =
        function (personel) {

            const p =
                personel || {};

            return {

                personelId:
                    p.personelId ??
                    p.id ??
                    p.sicilNo ??
                    "",

                adSoyad:
                    p.adSoyad ??
                    p.ad_soyad ??
                    p.name ??
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
                        p.maas
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
       PERSONEL VALIDATION
    ============================================================ */

    TMS19.personelValidate =
        function (personel) {

            const errors = [];

            const p =
                TMS19.personelNormalizeEt(
                    personel
                );


            if (
                !p.dogumTarihi ||
                !TMS19.tarih(
                    p.dogumTarihi
                )
            ) {

                errors.push(
                    "Doğum tarihi geçerli değil."
                );
            }


            if (
                !p.iseGirisTarihi ||
                !TMS19.tarih(
                    p.iseGirisTarihi
                )
            ) {

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
                p.dogumTarihi &&
                p.iseGirisTarihi
            ) {

                const dogum =
                    TMS19.tarih(
                        p.dogumTarihi
                    );

                const iseGiris =
                    TMS19.tarih(
                        p.iseGirisTarihi
                    );

                if (
                    iseGiris <
                    dogum
                ) {

                    errors.push(
                        "İşe giriş tarihi doğum tarihinden önce olamaz."
                    );
                }
            }


            return {

                valid:
                    errors.length === 0,

                errors:
                    errors
            };
        };


    /* ============================================================
       MAAŞ PROJEKSİYONU
    ============================================================ */

    TMS19.maasProjeksiyonu =
        function (
            mevcutMaas,
            kalanYil,
            varsayimlar
        ) {

            const baslangicMaasi =
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

            const maasArtisOrani =
                TMS19.sinirla(
                    TMS19.sayi(
                        varsayimlar.maasArtisOrani
                    ),
                    -1,
                    10
                );


            const emeklilikMaasi =
                baslangicMaasi *
                Math.pow(
                    1 +
                    maasArtisOrani,
                    yil
                );


            return {

                mevcutMaas:
                    baslangicMaasi,

                kalanYil:
                    yil,

                maasArtisOrani:
                    maasArtisOrani,

                emeklilikMaasi:
                    emeklilikMaasi
            };
        };


    /* ============================================================
       KIDEM TAVANI
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
                TMS19.sinirla(
                    TMS19.sayi(
                        varsayimlar.kidemTavaniArtisOrani
                    ),
                    -1,
                    10
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
                        maas
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


            return {

                uygulandi:
                    uygulandi,

                mevcutTavan:
                    mevcutTavan,

                tavanArtisOrani:
                    artis,

                projekteTavan:
                    projekteTavan,

                hesaplamaMaasi:
                    uygulandi
                        ? projekteTavan
                        : maas
            };
        };


    /* ============================================================
       DEMOGRAFİK VARSAYIMLAR
    ============================================================ */

    TMS19.devirOlasiligi =
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

            const turnover =
                TMS19.sinirla(
                    TMS19.sayi(
                        varsayimlar.personelDevirOrani
                    ),
                    0,
                    1
                );


            return Math.pow(
                1 - turnover,
                yil
            );
        };


    TMS19.olumOlasiligi =
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

            const mortality =
                TMS19.sinirla(
                    TMS19.sayi(
                        varsayimlar.olumOrani
                    ),
                    0,
                    1
                );


            return Math.pow(
                1 - mortality,
                yil
            );
        };


    /* ============================================================
       DEVAM OLASILIĞI
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


            if (
                yil <= 0
            ) {

                return 1;
            }


            const turnover =
                TMS19.sinirla(
                    TMS19.sayi(
                        varsayimlar.personelDevirOrani
                    ),
                    0,
                    1
                );


            const mortality =
                TMS19.sinirla(
                    TMS19.sayi(
                        varsayimlar.olumOrani
                    ),
                    0,
                    1
                );


            /*
             * Her yıl çalışanın sistemde kalma olasılığı.
             *
             * Basitleştirilmiş model:
             *
             * turnover ve mortality bağımsız
             * riskler olarak ele alınır.
             */

            const yillikDevam =
                (
                    1 - turnover
                ) *
                (
                    1 - mortality
                );


            return Math.pow(
                yillikDevam,
                yil
            );
        };


    /* ============================================================
       İSKONTO FAKTÖRÜ
    ============================================================ */

    TMS19.iskontoFaktoru =
        function (
            iskontoOrani,
            yil
        ) {

            const oran =
                TMS19.sayi(
                    iskontoOrani
                );

            const sure =
                Math.max(
                    0,
                    TMS19.sayi(
                        yil
                    )
                );


            if (
                sure <= 0
            ) {

                return 1;
            }


            return 1 /
                Math.pow(
                    1 + oran,
                    sure
                );
        };


    /* ============================================================
       PUC HESAPLAMA
    ============================================================ */

    TMS19.pucHesapla =
        function (
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


            /* ----------------------------------------------------
               VALIDATION
            ---------------------------------------------------- */

            const validation =
                TMS19.personelValidate(
                    personel
                );


            if (
                !validation.valid
            ) {

                throw new Error(
                    validation.errors.join(" ")
                );
            }


            /* ----------------------------------------------------
               DEMOGRAFİK
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
                    varsayimlar.emeklilikYasi,
                    60
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
               MAAŞ PROJEKSİYONU
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

            const tavan =
                TMS19.kidemTavaniHesapla(
                    emeklilikMaasi,
                    emekliligeKalanYil,
                    varsayimlar
                );


            const faydaHesaplamaMaasi =
                tavan.hesaplamaMaasi;


            /* ----------------------------------------------------
               FAYDA
            ---------------------------------------------------- */

            const faydaOrani =
                TMS19.sayi(
                    varsayimlar.faydaOrani
                );


            const yillikFayda =
                faydaHesaplamaMaasi *
                faydaOrani;


            const toplamFayda =
                yillikFayda *
                toplamHizmet;


            /* ----------------------------------------------------
               HİZMET ORANLARI
            ---------------------------------------------------- */

            const gecmisHizmetOrani =
                toplamHizmet > 0
                    ? Math.min(
                        1,
                        hizmetSuresi /
                        toplamHizmet
                    )
                    : 0;


            const gelecekHizmetOrani =
                toplamHizmet > 0
                    ? Math.max(
                        0,
                        Math.min(
                            1,
                            emekliligeKalanYil /
                            toplamHizmet
                        )
                    )
                    : 0;


            /* ----------------------------------------------------
               KAZANILMIŞ FAYDA
            ---------------------------------------------------- */

            const kazanilmisFayda =
                toplamFayda *
                gecmisHizmetOrani;


            /* ----------------------------------------------------
               DEVAM OLASILIĞI
            ---------------------------------------------------- */

            const devamOlasiligi =
                TMS19.devamOlasiligi(
                    emekliligeKalanYil,
                    varsayimlar
                );


            const devirSonrasiOlasilik =
                TMS19.devirOlasiligi(
                    emekliligeKalanYil,
                    varsayimlar
                );


            const olumSonrasiOlasilik =
                TMS19.olumOlasiligi(
                    emekliligeKalanYil,
                    varsayimlar
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

            const iskontoOrani =
                TMS19.sayi(
                    varsayimlar.iskontoOrani
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


            const gelecekYilBeklenenFayda =
                birYillikFayda *
                devamOlasiligi;


            const cariHizmetMaliyeti =
                gelecekYilBeklenenFayda *
                iskontoFaktoru;


            /* ----------------------------------------------------
               FAİZ MALİYETİ

               Bu değer mevcut DBO üzerinden yaklaşık kontrol
               amaçlı hesaplanmaktadır.
            ---------------------------------------------------- */

            const faizMaliyeti =
                dbo *
                iskontoOrani;


            /* ----------------------------------------------------
               TOPLAM DÖNEM MALİYETİ
            ---------------------------------------------------- */

            const toplamDonemMaliyeti =
                cariHizmetMaliyeti +
                faizMaliyeti;


            /* ----------------------------------------------------
               KONTROLLER
            ---------------------------------------------------- */

            const gecmisHizmetFaydaPayi =
                toplamFayda *
                gecmisHizmetOrani;


            const gelecekHizmetFaydaPayi =
                toplamFayda *
                gelecekHizmetOrani;


            const kontrolToplamFayda =
                gecmisHizmetFaydaPayi +
                gelecekHizmetFaydaPayi;


            const kontrolFarki =
                toplamFayda -
                kontrolToplamFayda;


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


                dogumTarihi:
                    p.dogumTarihi,

                iseGirisTarihi:
                    p.iseGirisTarihi,

                degerlemeTarihi:
                    degerlemeTarihi,


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


                mevcutMaas:
                    mevcutMaas,

                maasArtisOrani:
                    maas.maasArtisOrani,

                emeklilikMaasi:
                    emeklilikMaasi,

                faydaHesaplamaMaasi:
                    faydaHesaplamaMaasi,


                kidemTavani:
                    tavan.mevcutTavan,

                kidemTavaniArtisOrani:
                    tavan.tavanArtisOrani,

                projectedCeiling:
                    tavan.projekteTavan,

                tavanUygulandi:
                    tavan.uygulandi,


                faydaOrani:
                    faydaOrani,

                yillikFayda:
                    yillikFayda,

                toplamFayda:
                    toplamFayda,


                gecmisHizmetOrani:
                    gecmisHizmetOrani,

                gelecekHizmetOrani:
                    gelecekHizmetOrani,


                kazanilmisFayda:
                    kazanilmisFayda,


                personelDevirOrani:
                    TMS19.sayi(
                        varsayimlar.personelDevirOrani
                    ),

                olumOrani:
                    TMS19.sayi(
                        varsayimlar.olumOrani
                    ),

                devirSonrasiOlasilik:
                    devirSonrasiOlasilik,

                olumSonrasiOlasilik:
                    olumSonrasiOlasilik,

                devamOlasiligi:
                    devamOlasiligi,


                beklenenFayda:
                    beklenenFayda,


                iskontoOrani:
                    iskontoOrani,

                iskontoFaktoru:
                    iskontoFaktoru,


                dbo:
                    dbo,


                birYillikFayda:
                    birYillikFayda,

                gelecekYilBeklenenFayda:
                    gelecekYilBeklenenFayda,

                cariHizmetMaliyeti:
                    cariHizmetMaliyeti,


                faizMaliyeti:
                    faizMaliyeti,

                toplamDonemMaliyeti:
                    toplamDonemMaliyeti,


                gecmisHizmetFaydaPayi:
                    gecmisHizmetFaydaPayi,

                gelecekHizmetFaydaPayi:
                    gelecekHizmetFaydaPayi,

                kontrolToplamFayda:
                    kontrolToplamFayda,

                kontrolFarki:
                    kontrolFarki,


                hesaplamaDurumu:
                    "BAŞARILI",

                hesaplamaTipi:
                    "Projected Unit Credit",

                tms19:
                    true
            };
        };


    /* ============================================================
       TOPLU PERSONEL HESAPLAMA
    ============================================================ */

    TMS19.topluHesapla =
        function (
            personeller,
            varsayimlar
        ) {

            if (
                !Array.isArray(
                    personeller
                )
            ) {

                throw new Error(
                    "Personel listesi dizi formatında olmalıdır."
                );
            }


            const sonuclar = [];


            personeller.forEach(
                function (
                    personel,
                    index
                ) {

                    try {

                        const sonuc =
                            TMS19.pucHesapla(
                                personel,
                                varsayimlar,
                                index
                            );


                        sonuclar.push(
                            sonuc
                        );

                    } catch (error) {

                        sonuclar.push({

                            index:
                                index,

                            personelId:
                                personel?.personelId ??
                                personel?.id ??
                                "",

                            adSoyad:
                                personel?.adSoyad ??
                                "",

                            hesaplamaDurumu:
                                "HATA",

                            hata:
                                error.message,

                            tms19:
                                false
                        });
                    }
                }
            );


            return sonuclar;
        };


    /* ============================================================
       PORTFÖY ÖZETİ
    ============================================================ */

    TMS19.ozetHesapla =
        function (
            sonuclar
        ) {

            const liste =
                Array.isArray(
                    sonuclar
                )
                    ? sonuclar
                    : [];


            const basarili =
                liste.filter(
                    function (x) {

                        return (
                            x &&
                            x.hesaplamaDurumu ===
                            "BAŞARILI"
                        );
                    }
                );


            const hatali =
                liste.filter(
                    function (x) {

                        return (
                            x &&
                            x.hesaplamaDurumu ===
                            "HATA"
                        );
                    }
                );


            function toplam(
                alan
            ) {

                return basarili.reduce(
                    function (
                        toplamDeger,
                        kayit
                    ) {

                        return (
                            toplamDeger +
                            TMS19.sayi(
                                kayit[alan]
                            )
                        );

                    },
                    0
                );
            }


            const toplamDBO =
                toplam(
                    "dbo"
                );


            const toplamCariHizmetMaliyeti =
                toplam(
                    "cariHizmetMaliyeti"
                );


            const toplamFaizMaliyeti =
                toplam(
                    "faizMaliyeti"
                );


            const toplamDonemMaliyeti =
                toplam(
                    "toplamDonemMaliyeti"
                );


            const toplamKazanilmisFayda =
                toplam(
                    "kazanilmisFayda"
                );


            const toplamBeklenenFayda =
                toplam(
                    "beklenenFayda"
                );


            const toplamFayda =
                toplam(
                    "toplamFayda"
                );


            const toplamMevcutMaas =
                toplam(
                    "mevcutMaas"
                );


            const toplamEmeklilikMaasi =
                toplam(
                    "emeklilikMaasi"
                );


            return {

                personelSayisi:
                    liste.length,

                basariliPersonelSayisi:
                    basarili.length,

                hataliPersonelSayisi:
                    hatali.length,


                toplamMevcutMaas:
                    toplamMevcutMaas,

                toplamEmeklilikMaasi:
                    toplamEmeklilikMaasi,


                toplamFayda:
                    toplamFayda,

                toplamKazanilmisFayda:
                    toplamKazanilmisFayda,

                toplamBeklenenFayda:
                    toplamBeklenenFayda,


                toplamDBO:
                    toplamDBO,


                toplamCariHizmetMaliyeti:
                    toplamCariHizmetMaliyeti,

                toplamFaizMaliyeti:
                    toplamFaizMaliyeti,

                toplamDonemMaliyeti:
                    toplamDonemMaliyeti,


                hesaplamaKontrol:
                    hatali.length === 0
                        ? "BAŞARILI"
                        : "HATALI PERSONEL VAR"
            };
        };


    /* ============================================================
       VARSAYIM VALIDATION
    ============================================================ */

    TMS19.varsayimlariValidateEt =
        function (
            varsayimlar
        ) {

            const errors = [];

            const v =
                varsayimlar || {};


            const emeklilikYasi =
                TMS19.sayi(
                    v.emeklilikYasi
                );


            const maasArtis =
                TMS19.sayi(
                    v.maasArtisOrani
                );


            const iskonto =
                TMS19.sayi(
                    v.iskontoOrani
                );


            const turnover =
                TMS19.sayi(
                    v.personelDevirOrani
                );


            const mortality =
                TMS19.sayi(
                    v.olumOrani
                );


            const faydaOrani =
                TMS19.sayi(
                    v.faydaOrani
                );


            if (
                emeklilikYasi <= 0
            ) {

                errors.push(
                    "Emeklilik yaşı geçerli değil."
                );
            }


            if (
                iskonto <= -1
            ) {

                errors.push(
                    "İskonto oranı -100%'den küçük veya eşit olamaz."
                );
            }


            if (
                turnover < 0 ||
                turnover > 1
            ) {

                errors.push(
                    "Personel devir oranı 0-1 arasında olmalıdır."
                );
            }


            if (
                mortality < 0 ||
                mortality > 1
            ) {

                errors.push(
                    "Ölüm oranı 0-1 arasında olmalıdır."
                );
            }


            if (
                faydaOrani < 0
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
       MOTOR HEALTH CHECK
    ============================================================ */

    TMS19.healthCheck =
        function () {

            return {

                motor:
                    "TMS 19 Actuarial Engine",

                durum:
                    "AKTİF",

                versiyon:
                    "1.0.0",

                hesaplamaYontemi:
                    "Projected Unit Credit",

                fonksiyonlar:
                    [
                        "sayi",
                        "tarih",
                        "yilFarki",
                        "yasHesapla",
                        "personelNormalizeEt",
                        "personelValidate",
                        "maasProjeksiyonu",
                        "kidemTavaniHesapla",
                        "devirOlasiligi",
                        "olumOlasiligi",
                        "devamOlasiligi",
                        "iskontoFaktoru",
                        "pucHesapla",
                        "topluHesapla",
                        "ozetHesapla",
                        "varsayimlariValidateEt"
                    ]
            };
        };


    /* ============================================================
       GLOBAL EXPORT
    ============================================================ */

    global.TMS19 =
        TMS19;


})(window);
