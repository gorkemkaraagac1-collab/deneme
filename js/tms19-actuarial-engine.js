/* ================================================================
   TMS 19 ACTUARIAL ENGINE
   GK FINANCIAL DECISION COCKPIT

   TMS 19 Employee Benefits
   Projected Unit Credit Method

   VERSION: 2.0.0

   ANA MODÜLLER
   ----------------------------------------------------------------
   01. Genel yardımcı fonksiyonlar
   02. Tarih motoru
   03. Personel normalizasyonu
   04. Personel validation
   05. Varsayım validation
   06. Maaş projeksiyonu
   07. Kıdem tavanı
   08. Demografik varsayımlar
   09. İskonto
   10. Projected Unit Credit
   11. Personel bazlı DBO
   12. Toplu hesaplama
   13. Portföy özeti
   14. Dönemsel roll-forward
   15. Aktüeryal kazanç / zarar
   16. P&L
   17. OCI
   18. Net defined benefit liability
   19. Duyarlılık analizi
   20. Audit trail
   21. Export için düzleştirilmiş veri
   22. Health check
================================================================ */

(function (global) {

    "use strict";


    /* ============================================================
       ANA NAMESPACE
    ============================================================ */

    const TMS19 = {};


    /* ============================================================
       MOTOR BİLGİLERİ
    ============================================================ */

    TMS19.motorAdi =
        "TMS 19 Actuarial Engine";

    TMS19.versiyon =
        "2.0.0";

    TMS19.hesaplamaYontemi =
        "Projected Unit Credit";


    /* ============================================================
       01 — GENEL YARDIMCI FONKSİYONLAR
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


        if (
            typeof deger === "number"
        ) {

            return isFinite(deger)
                ? deger
                : varsayilan;
        }


        let temiz =
            String(deger)
                .trim()
                .replace(/\s/g, "");


        /*
         * Türkçe:
         * 1.234.567,89
         */

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
            TMS19.sayi(deger) *
            katsayi
        ) / katsayi;
    };


    TMS19.yuzde = function (
        deger
    ) {

        return (
            TMS19.sayi(deger) *
            100
        );
    };


    TMS19.sifirla = function (
        deger,
        tolerans = 0.000001
    ) {

        return Math.abs(
            TMS19.sayi(deger)
        ) < tolerans
            ? 0
            : deger;
    };


    /* ============================================================
       02 — TARİH MOTORU
    ============================================================ */

    TMS19.tarih = function (
        deger
    ) {

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


    TMS19.tarihEkleYil =
        function (
            tarih,
            yil
        ) {

            const sonuc =
                TMS19.tarih(
                    tarih
                );


            if (
                !sonuc
            ) {

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

    TMS19.personelNormalizeEt =
        function (
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

    TMS19.personelValidate =
        function (
            personel
        ) {

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
       05 — VARSAYIM VALIDATION
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


            if (
                maasArtis <= -1
            ) {

                errors.push(
                    "Maaş artış oranı -100%'den küçük veya eşit olamaz."
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
       06 — MAAŞ PROJEKSİYONU
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
                TMS19.sayi(
                    varsayimlar.maasArtisOrani
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
       07 — KIDEM TAVANI
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

                    tavanArtisOrani:
                        artis,

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
       08 — DEMOGRAFİK OLASILIKLAR
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


    TMS19.yillikDevamOlasiligi =
        function (
            varsayimlar
        ) {

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


            return (
                1 - turnover
            ) *
            (
                1 - mortality
            );
        };


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


            return Math.pow(
                TMS19.yillikDevamOlasiligi(
                    varsayimlar
                ),
                yil
            );
        };


    /* ============================================================
       09 — İSKONTO
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


    TMS19.bugunkuDeger =
        function (
            tutar,
            oran,
            yil
        ) {

            return (
                TMS19.sayi(
                    tutar
                ) *
                TMS19.iskontoFaktoru(
                    oran,
                    yil
                )
            );
        };


    /* ============================================================
       10 — PUС PERSONEL HESAPLAMA
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


            const varsayimValidation =
                TMS19.varsayimlariValidateEt(
                    varsayimlar
                );


            if (
                !varsayimValidation.valid
            ) {

                throw new Error(
                    varsayimValidation.errors.join(" ")
                );
            }


            /* ----------------------------------------------------
               TARİHLER
            ---------------------------------------------------- */

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
                    varsayimlar.emeklilikYasi
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
                    p.mevcutMaas,
                    emekliligeKalanYil,
                    varsayimlar
                );


            /* ----------------------------------------------------
               TAVAN
            ---------------------------------------------------- */

            const tavan =
                TMS19.kidemTavaniHesapla(
                    maas.emeklilikMaasi,
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
               HİZMET ORANI
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
               DEMOGRAFİK
            ---------------------------------------------------- */

            const devirOlasiligi =
                TMS19.devirOlasiligi(
                    emekliligeKalanYil,
                    varsayimlar
                );


            const olumOlasiligi =
                TMS19.olumOlasiligi(
                    emekliligeKalanYil,
                    varsayimlar
                );


            const devamOlasiligi =
                TMS19.devamOlasiligi(
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
            ---------------------------------------------------- */

            const faizMaliyeti =
                dbo *
                iskontoOrani;


            /* ----------------------------------------------------
               TOPLAM MALİYET
            ---------------------------------------------------- */

            const toplamDonemMaliyeti =
                cariHizmetMaliyeti +
                faizMaliyeti;


            /* ----------------------------------------------------
               KONTROL
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
                    p.mevcutMaas,

                maasArtisOrani:
                    maas.maasArtisOrani,

                emeklilikMaasi:
                    maas.emeklilikMaasi,

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

                devirOlasiligi:
                    devirOlasiligi,

                olumOlasiligi:
                    olumOlasiligi,

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
       11 — TOPLU PERSONEL HESAPLAMA
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

                        sonuclar.push(
                            TMS19.pucHesapla(
                                personel,
                                varsayimlar,
                                index
                            )
                        );

                    }

                    catch (error) {

                        const p =
                            TMS19.personelNormalizeEt(
                                personel
                            );


                        sonuclar.push({

                            index:
                                index,

                            personelId:
                                p.personelId,

                            adSoyad:
                                p.adSoyad,

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
       12 — PORTFÖY ÖZETİ
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


            const toplam =
                function (
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
                };


            return {

                personelSayisi:
                    liste.length,

                basariliPersonelSayisi:
                    basarili.length,

                hataliPersonelSayisi:
                    hatali.length,


                toplamMevcutMaas:
                    toplam(
                        "mevcutMaas"
                    ),

                toplamEmeklilikMaasi:
                    toplam(
                        "emeklilikMaasi"
                    ),

                toplamFayda:
                    toplam(
                        "toplamFayda"
                    ),

                toplamKazanilmisFayda:
                    toplam(
                        "kazanilmisFayda"
                    ),

                toplamBeklenenFayda:
                    toplam(
                        "beklenenFayda"
                    ),

                toplamDBO:
                    toplam(
                        "dbo"
                    ),

                toplamCariHizmetMaliyeti:
                    toplam(
                        "cariHizmetMaliyeti"
                    ),

                toplamFaizMaliyeti:
                    toplam(
                        "faizMaliyeti"
                    ),

                toplamDonemMaliyeti:
                    toplam(
                        "toplamDonemMaliyeti"
                    ),

                hesaplamaKontrol:
                    hatali.length === 0
                        ? "BAŞARILI"
                        : "HATALI PERSONEL VAR"
            };
        };


    /* ============================================================
       13 — ROLL-FORWARD
    ============================================================ */

    TMS19.rollForward =
        function (
            openingDBO,
            currentServiceCost,
            interestCost,
            benefitPayments,
            actuarialGainLoss,
            pastServiceCost = 0
        ) {

            const acilis =
                TMS19.sayi(
                    openingDBO
                );


            const cariHizmet =
                TMS19.sayi(
                    currentServiceCost
                );


            const faiz =
                TMS19.sayi(
                    interestCost
                );


            const odeme =
                TMS19.sayi(
                    benefitPayments
                );


            const akt =
                TMS19.sayi(
                    actuarialGainLoss
                );


            const gecmisHizmet =
                TMS19.sayi(
                    pastServiceCost
                );


            const kapanis =
                acilis +
                cariHizmet +
                faiz +
                gecmisHizmet +
                akt -
                odeme;


            return {

                openingDBO:
                    acilis,

                currentServiceCost:
                    cariHizmet,

                interestCost:
                    faiz,

                pastServiceCost:
                    gecmisHizmet,

                actuarialGainLoss:
                    akt,

                benefitPayments:
                    odeme,

                closingDBO:
                    kapanis
            };
        };


    /* ============================================================
       14 — AKTÜERYAL KAZANÇ / ZARAR
    ============================================================ */

    TMS19.aktueriyelKazancZarar =
        function (
            beklenenDBO,
            gerceklesenDBO
        ) {

            const beklenen =
                TMS19.sayi(
                    beklenenDBO
                );


            const gerceklesen =
                TMS19.sayi(
                    gerceklesenDBO
                );


            /*
             * Pozitif değer:
             * DBO beklenenden yüksek.
             *
             * Negatif değer:
             * DBO beklenenden düşük.
             */

            return {

                beklenenDBO:
                    beklenen,

                gerceklesenDBO:
                    gerceklesen,

                fark:
                    gerceklesen -
                    beklenen,

                aktueriyelKazanc:
                    Math.max(
                        0,
                        beklenen -
                        gerceklesen
                    ),

                aktueriyelZarar:
                    Math.max(
                        0,
                        gerceklesen -
                        beklenen
                    )
            };
        };


    /* ============================================================
       15 — NET FAİZ / NET YÜKÜMLÜLÜK
    ============================================================ */

    TMS19.netFaizHesapla =
        function (
            openingNetLiability,
            iskontoOrani
        ) {

            const netYukumluluk =
                TMS19.sayi(
                    openingNetLiability
                );


            const oran =
                TMS19.sayi(
                    iskontoOrani
                );


            return {

                openingNetLiability:
                    netYukumluluk,

                iskontoOrani:
                    oran,

                netFaiz:
                    netYukumluluk *
                    oran
            };
        };


    /* ============================================================
       16 — P&L
    ============================================================ */

    TMS19.pnlHesapla =
        function (
            currentServiceCost,
            pastServiceCost,
            netInterest
        ) {

            const cari =
                TMS19.sayi(
                    currentServiceCost
                );


            const gecmis =
                TMS19.sayi(
                    pastServiceCost
                );


            const faiz =
                TMS19.sayi(
                    netInterest
                );


            return {

                cariHizmetMaliyeti:
                    cari,

                gecmisHizmetMaliyeti:
                    gecmis,

                netFaiz:
                    faiz,

                karZararToplam:
                    cari +
                    gecmis +
                    faiz
            };
        };


    /* ============================================================
       17 — OCI
    ============================================================ */

    TMS19.ociHesapla =
        function (
            actuarialGainLoss
        ) {

            const akt =
                TMS19.sayi(
                    actuarialGainLoss
                );


            return {

                aktueriyelKazancZarar:
                    akt,

                oci:
                    akt
            };
        };


    /* ============================================================
       18 — NET DEFINED BENEFIT LIABILITY
    ============================================================ */

    TMS19.netYukumlulukHesapla =
        function (
            dbo,
            planAssets
        ) {

            const yukumluluk =
                TMS19.sayi(
                    dbo
                );


            const varlik =
                TMS19.sayi(
                    planAssets
                );


            return {

                dbo:
                    yukumluluk,

                planAssets:
                    varlik,

                netDefinedBenefitLiability:
                    yukumluluk -
                    varlik
            };
        };


    /* ============================================================
       19 — DUYARLILIK ANALİZİ
    ============================================================ */

    TMS19.duyarlilik =
        function (
            personel,
            varsayimlar,
            parametre,
            degisim
        ) {

            const baz =
                TMS19.pucHesapla(
                    personel,
                    varsayimlar,
                    0
                );


            const alternatif =
                Object.assign(
                    {},
                    varsayimlar
                );


            alternatif[parametre] =
                TMS19.sayi(
                    varsayimlar[parametre]
                ) +
                TMS19.sayi(
                    degisim
                );


            const senaryo =
                TMS19.pucHesapla(
                    personel,
                    alternatif,
                    0
                );


            return {

                parametre:
                    parametre,

                degisim:
                    degisim,

                bazDBO:
                    baz.dbo,

                senaryoDBO:
                    senaryo.dbo,

                fark:
                    senaryo.dbo -
                    baz.dbo,

                farkYuzde:
                    baz.dbo !== 0
                        ? (
                            (
                                senaryo.dbo -
                                baz.dbo
                            ) /
                            baz.dbo
                        )
                        : 0
            };
        };


    /* ============================================================
       20 — PORTFÖY DUYARLILIK ANALİZİ
    ============================================================ */

    TMS19.portfoyDuyarlilik =
        function (
            personeller,
            varsayimlar,
            parametre,
            degisim
        ) {

            const bazSonuclar =
                TMS19.topluHesapla(
                    personeller,
                    varsayimlar
                );


            const bazOzet =
                TMS19.ozetHesapla(
                    bazSonuclar
                );


            const alternatifVarsayimlar =
                Object.assign(
                    {},
                    varsayimlar
                );


            alternatifVarsayimlar[parametre] =
                TMS19.sayi(
                    varsayimlar[parametre]
                ) +
                TMS19.sayi(
                    degisim
                );


            const alternatifSonuclar =
                TMS19.topluHesapla(
                    personeller,
                    alternatifVarsayimlar
                );


            const alternatifOzet =
                TMS19.ozetHesapla(
                    alternatifSonuclar
                );


            return {

                parametre:
                    parametre,

                degisim:
                    degisim,

                bazDBO:
                    bazOzet.toplamDBO,

                senaryoDBO:
                    alternatifOzet.toplamDBO,

                fark:
                    alternatifOzet.toplamDBO -
                    bazOzet.toplamDBO,

                farkYuzde:
                    bazOzet.toplamDBO !== 0
                        ? (
                            (
                                alternatifOzet.toplamDBO -
                                bazOzet.toplamDBO
                            ) /
                            bazOzet.toplamDBO
                        )
                        : 0
            };
        };


    /* ============================================================
       21 — SENARYO MATRİSİ
    ============================================================ */

    TMS19.senaryoMatrisi =
        function (
            personeller,
            varsayimlar
        ) {

            const senaryolar = [

                {
                    ad:
                        "Baz Senaryo",

                    parametre:
                        null,

                    degisim:
                        0
                },

                {
                    ad:
                        "İskonto Oranı +%1",

                    parametre:
                        "iskontoOrani",

                    degisim:
                        0.01
                },

                {
                    ad:
                        "İskonto Oranı -%1",

                    parametre:
                        "iskontoOrani",

                    degisim:
                        -0.01
                },

                {
                    ad:
                        "Maaş Artışı +%1",

                    parametre:
                        "maasArtisOrani",

                    degisim:
                        0.01
                },

                {
                    ad:
                        "Maaş Artışı -%1",

                    parametre:
                        "maasArtisOrani",

                    degisim:
                        -0.01
                },

                {
                    ad:
                        "Devir Oranı +%1",

                    parametre:
                        "personelDevirOrani",

                    degisim:
                        0.01
                },

                {
                    ad:
                        "Devir Oranı -%1",

                    parametre:
                        "personelDevirOrani",

                    degisim:
                        -0.01
                }
            ];


            return senaryolar.map(
                function (
                    senaryo
                ) {

                    if (
                        !senaryo.parametre
                    ) {

                        const sonuclar =
                            TMS19.topluHesapla(
                                personeller,
                                varsayimlar
                            );


                        const ozet =
                            TMS19.ozetHesapla(
                                sonuclar
                            );


                        return {

                            ad:
                                senaryo.ad,

                            dbo:
                                ozet.toplamDBO,

                            fark:
                                0,

                            farkYuzde:
                                0
                        };
                    }


                    const sonuc =
                        TMS19.portfoyDuyarlilik(
                            personeller,
                            varsayimlar,
                            senaryo.parametre,
                            senaryo.degisim
                        );


                    return {

                        ad:
                            senaryo.ad,

                        dbo:
                            sonuc.senaryoDBO,

                        fark:
                            sonuc.fark,

                        farkYuzde:
                            sonuc.farkYuzde
                    };
                }
            );
        };


    /* ============================================================
       22 — PERSONEL DETAY EXPORT
    ============================================================ */

    TMS19.exportSatiri =
        function (
            sonuc
        ) {

            return {

                "Personel ID":
                    sonuc.personelId,

                "Ad Soyad":
                    sonuc.adSoyad,

                "Departman":
                    sonuc.departman,

                "Pozisyon":
                    sonuc.pozisyon,

                "Yaş":
                    TMS19.yuvarla(
                        sonuc.yas,
                        2
                    ),

                "Hizmet Süresi":
                    TMS19.yuvarla(
                        sonuc.hizmetSuresi,
                        2
                    ),

                "Emekliliğe Kalan Yıl":
                    TMS19.yuvarla(
                        sonuc.emekliligeKalanYil,
                        2
                    ),

                "Toplam Hizmet":
                    TMS19.yuvarla(
                        sonuc.toplamHizmet,
                        2
                    ),

                "Mevcut Maaş":
                    sonuc.mevcutMaas,

                "Emeklilik Maaşı":
                    sonuc.emeklilikMaasi,

                "Kıdem Tavanı":
                    sonuc.kidemTavani,

                "Projeksiyon Tavanı":
                    sonuc.projectedCeiling,

                "Tavan Uygulandı":
                    sonuc.tavanUygulandi
                        ? "Evet"
                        : "Hayır",

                "Yıllık Fayda":
                    sonuc.yillikFayda,

                "Toplam Fayda":
                    sonuc.toplamFayda,

                "Kazanılmış Fayda":
                    sonuc.kazanilmisFayda,

                "Devam Olasılığı":
                    sonuc.devamOlasiligi,

                "Beklenen Fayda":
                    sonuc.beklenenFayda,

                "İskonto Oranı":
                    sonuc.iskontoOrani,

                "İskonto Faktörü":
                    sonuc.iskontoFaktoru,

                "DBO":
                    sonuc.dbo,

                "Cari Hizmet Maliyeti":
                    sonuc.cariHizmetMaliyeti,

                "Faiz Maliyeti":
                    sonuc.faizMaliyeti,

                "Toplam Dönem Maliyeti":
                    sonuc.toplamDonemMaliyeti,

                "Hesaplama Durumu":
                    sonuc.hesaplamaDurumu
            };
        };


    /* ============================================================
       23 — AUDIT TRAIL
    ============================================================ */

    TMS19.auditTrail =
        function (
            personel,
            varsayimlar
        ) {

            const sonuc =
                TMS19.pucHesapla(
                    personel,
                    varsayimlar,
                    0
                );


            return [

                {
                    adim:
                        1,

                    alan:
                        "Mevcut Maaş",

                    deger:
                        sonuc.mevcutMaas,

                    aciklama:
                        "Değerleme tarihindeki mevcut maaş."
                },

                {
                    adim:
                        2,

                    alan:
                        "Yaş",

                    deger:
                        sonuc.yas,

                    aciklama:
                        "Değerleme tarihi itibarıyla personelin yaşı."
                },

                {
                    adim:
                        3,

                    alan:
                        "Hizmet Süresi",

                    deger:
                        sonuc.hizmetSuresi,

                    aciklama:
                        "Değerleme tarihine kadar geçen hizmet süresi."
                },

                {
                    adim:
                        4,

                    alan:
                        "Emekliliğe Kalan Yıl",

                    deger:
                        sonuc.emekliligeKalanYil,

                    aciklama:
                        "Emeklilik yaşına kadar kalan süre."
                },

                {
                    adim:
                        5,

                    alan:
                        "Emeklilik Maaşı",

                    deger:
                        sonuc.emeklilikMaasi,

                    aciklama:
                        "Varsayılan maaş artış oranı ile projekte edilen maaş."
                },

                {
                    adim:
                        6,

                    alan:
                        "Kıdem Tavanı",

                    deger:
                        sonuc.projectedCeiling,

                    aciklama:
                        "Emeklilik tarihine projekte edilen kıdem tavanı."
                },

                {
                    adim:
                        7,

                    alan:
                        "Fayda Hesaplama Maaşı",

                    deger:
                        sonuc.faydaHesaplamaMaasi,

                    aciklama:
                        "Tavan uygulanmışsa tavan ile sınırlandırılmış maaş."
                },

                {
                    adim:
                        8,

                    alan:
                        "Toplam Fayda",

                    deger:
                        sonuc.toplamFayda,

                    aciklama:
                        "Toplam beklenen hizmet faydası."
                },

                {
                    adim:
                        9,

                    alan:
                        "Kazanılmış Fayda",

                    deger:
                        sonuc.kazanilmisFayda,

                    aciklama:
                        "Mevcut hizmet dönemine tahsis edilen fayda."
                },

                {
                    adim:
                        10,

                    alan:
                        "Devam Olasılığı",

                    deger:
                        sonuc.devamOlasiligi,

                    aciklama:
                        "Turnover ve mortality varsayımlarına göre devam olasılığı."
                },

                {
                    adim:
                        11,

                    alan:
                        "Beklenen Fayda",

                    deger:
                        sonuc.beklenenFayda,

                    aciklama:
                        "Demografik olasılıklar uygulandıktan sonraki beklenen fayda."
                },

                {
                    adim:
                        12,

                    alan:
                        "İskonto Faktörü",

                    deger:
                        sonuc.iskontoFaktoru,

                    aciklama:
                        "Değerleme tarihindeki bugünkü değer faktörü."
                },

                {
                    adim:
                        13,

                    alan:
                        "DBO",

                    deger:
                        sonuc.dbo,

                    aciklama:
                        "Defined Benefit Obligation."
                },

                {
                    adim:
                        14,

                    alan:
                        "Cari Hizmet Maliyeti",

                    deger:
                        sonuc.cariHizmetMaliyeti,

                    aciklama:
                        "Dönemde kazanılan ilave hizmet faydasının bugünkü değeri."
                },

                {
                    adim:
                        15,

                    alan:
                        "Faiz Maliyeti",

                    deger:
                        sonuc.faizMaliyeti,

                    aciklama:
                        "DBO üzerinden hesaplanan yaklaşık finansman maliyeti."
                }
            ];
        };


    /* ============================================================
       24 — RİSK GÖSTERGELERİ
    ============================================================ */

    TMS19.riskAnalizi =
        function (
            sonuc
        ) {

            const riskler = [];


            if (
                sonuc.tavanUygulandi
            ) {

                riskler.push({

                    kod:
                        "KIDEM_TAVANI",

                    seviye:
                        "ORTA",

                    mesaj:
                        "Kıdem tavanı fayda hesaplama maaşını sınırlandırmaktadır."
                });
            }


            if (
                sonuc.devamOlasiligi < 0.5
            ) {

                riskler.push({

                    kod:
                        "DEMOGRAFİK",

                    seviye:
                        "YÜKSEK",

                    mesaj:
                        "Devam olasılığı %50'nin altındadır."
                });
            }


            if (
                sonuc.emekliligeKalanYil <= 3
            ) {

                riskler.push({

                    kod:
                        "EMEKLİLİK",

                    seviye:
                        "YÜKSEK",

                    mesaj:
                        "Personelin emekliliğine üç yıl veya daha az kalmıştır."
                });
            }


            if (
                sonuc.dbo >
                sonuc.mevcutMaas * 5
            ) {

                riskler.push({

                    kod:
                        "DBO",

                    seviye:
                        "YÜKSEK",

                    mesaj:
                        "DBO mevcut yıllık maaşa göre yüksek seviyededir."
                });
            }


            return {

                riskSayisi:
                    riskler.length,

                riskler:
                    riskler,

                genelRisk:
                    riskler.some(
                        function (r) {

                            return r.seviye ===
                                "YÜKSEK";
                        }
                    )
                        ? "YÜKSEK"
                        :
                    riskler.some(
                        function (r) {

                            return r.seviye ===
                                "ORTA";
                        }
                    )
                        ? "ORTA"
                        : "DÜŞÜK"
            };
        };


    /* ============================================================
       25 — TAM PERSONEL RAPORU
    ============================================================ */

    TMS19.personelRaporu =
        function (
            personel,
            varsayimlar
        ) {

            const sonuc =
                TMS19.pucHesapla(
                    personel,
                    varsayimlar,
                    0
                );


            const audit =
                TMS19.auditTrail(
                    personel,
                    varsayimlar
                );


            const risk =
                TMS19.riskAnalizi(
                    sonuc
                );


            return {

                sonuc:
                    sonuc,

                auditTrail:
                    audit,

                riskAnalizi:
                    risk
            };
        };


    /* ============================================================
       26 — TAM PORTFÖY RAPORU
    ============================================================ */

    TMS19.portfoyRaporu =
        function (
            personeller,
            varsayimlar
        ) {

            const sonuclar =
                TMS19.topluHesapla(
                    personeller,
                    varsayimlar
                );


            const ozet =
                TMS19.ozetHesapla(
                    sonuclar
                );


            const senaryolar =
                TMS19.senaryoMatrisi(
                    personeller,
                    varsayimlar
                );


            const riskler =
                sonuclar
                    .filter(
                        function (x) {

                            return (
                                x &&
                                x.hesaplamaDurumu ===
                                "BAŞARILI"
                            );
                        }
                    )
                    .map(
                        function (x) {

                            return {

                                personelId:
                                    x.personelId,

                                adSoyad:
                                    x.adSoyad,

                                risk:
                                    TMS19.riskAnalizi(
                                        x
                                    )
                            };
                        }
                    );


            return {

                metadata: {

                    motor:
                        TMS19.motorAdi,

                    versiyon:
                        TMS19.versiyon,

                    yontem:
                        TMS19.hesaplamaYontemi,

                    degerlemeTarihi:
                        varsayimlar.degerlemeTarihi,

                    olusturmaZamani:
                        new Date().toISOString()
                },


                varsayimlar:
                    varsayimlar,


                sonuclar:
                    sonuclar,


                ozet:
                    ozet,


                senaryolar:
                    senaryolar,


                riskler:
                    riskler
            };
        };


    /* ============================================================
       27 — HEALTH CHECK
    ============================================================ */

    TMS19.healthCheck =
        function () {

            return {

                motor:
                    TMS19.motorAdi,

                durum:
                    "AKTİF",

                versiyon:
                    TMS19.versiyon,

                hesaplamaYontemi:
                    TMS19.hesaplamaYontemi,

                fonksiyonlar:
                    [

                        "sayi",

                        "tarih",

                        "yilFarki",

                        "yasHesapla",

                        "tarihEkleYil",

                        "personelNormalizeEt",

                        "personelValidate",

                        "varsayimlariValidateEt",

                        "maasProjeksiyonu",

                        "kidemTavaniHesapla",

                        "devirOlasiligi",

                        "olumOlasiligi",

                        "yillikDevamOlasiligi",

                        "devamOlasiligi",

                        "iskontoFaktoru",

                        "bugunkuDeger",

                        "pucHesapla",

                        "topluHesapla",

                        "ozetHesapla",

                        "rollForward",

                        "aktueriyelKazancZarar",

                        "netFaizHesapla",

                        "pnlHesapla",

                        "ociHesapla",

                        "netYukumlulukHesapla",

                        "duyarlilik",

                        "portfoyDuyarlilik",

                        "senaryoMatrisi",

                        "exportSatiri",

                        "auditTrail",

                        "riskAnalizi",

                        "personelRaporu",

                        "portfoyRaporu"

                    ]
            };
        };


    /* ============================================================
       28 — GLOBAL EXPORT
    ============================================================ */

    global.TMS19 =
        TMS19;


})(window);
