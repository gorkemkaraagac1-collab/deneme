/* ============================================================
   GK ADVISORY
   TMS 19 ACTUARIAL ENGINE V2
   Türkçe Aktüeryal Değerleme Motoru

   Yaklaşım:
   - Projected Unit Credit Method
   - Personel bazlı projeksiyon
   - Maaş artışı
   - Turnover
   - Emeklilik
   - Ölüm
   - Hayatta kalma olasılığı
   - Beklenen fayda
   - İskonto
   - DBO
   - Cari hizmet maliyeti
   - Faiz maliyeti
   - OCI / aktüeryal yeniden ölçüm
   - Duyarlılık analizi
   - Veri kalite kontrolü
   - CFO içgörüleri

   ÖNEMLİ:
   Bu motor eğitim / analitik / modelleme amaçlıdır.
   Gerçek aktüeryal raporun yerine geçmez.
============================================================ */


/* ============================================================
   ANA NESNE
============================================================ */

const TMS19 = (() => {


    /* ========================================================
       SABİTLER
    ======================================================== */

    const SABİTLER = {

        DEFAULT_EMEKLİLİK_YAŞI: 60,

        DEFAULT_İSKONTO_ORANI: 0.28,

        DEFAULT_MAAŞ_ARTIŞ_ORANI: 0.25,

        DEFAULT_TURNOVER_ORANI: 0.08,

        MAKS_PROJEKSİYON_YILI: 45,

        MIN_İSKONTO:
            0.0001,

        MAX_İSKONTO:
            1.00,

        MIN_MAAŞ_ARTIŞ:
            -0.50,

        MAX_MAAŞ_ARTIŞ:
            2.00

    };


    /* ========================================================
       YARDIMCI MATEMATİK
    ======================================================== */

    function güvenliSayı(
        değer,
        varsayılan = 0
    ) {

        const sayı =
            Number(
                değer
            );

        return Number.isFinite(
            sayı
        )
            ? sayı
            : varsayılan;

    }


    function sınırla(
        değer,
        min,
        max
    ) {

        return Math.min(
            Math.max(
                değer,
                min
            ),
            max
        );

    }


    function yuvarla(
        değer,
        basamak = 2
    ) {

        const katsayı =
            Math.pow(
                10,
                basamak
            );

        return (
            Math.round(
                güvenliSayı(
                    değer
                ) *
                katsayı
            )
            /
            katsayı
        );

    }


    function yüzde(
        değer
    ) {

        return güvenliSayı(
            değer
        ) / 100;

    }


    /* ========================================================
       TARİH FONKSİYONLARI
    ======================================================== */

    function tarihOku(
        değer
    ) {

        if (
            !değer
        ) {

            return null;

        }

        const tarih =
            new Date(
                değer
            );


        if (
            Number.isNaN(
                tarih.getTime()
            )
        ) {

            return null;

        }

        return tarih;

    }


    function yaşHesapla(
        doğumTarihi,
        değerlemeTarihi
    ) {

        const doğum =
            tarihOku(
                doğumTarihi
            );

        const değerleme =
            tarihOku(
                değerlemeTarihi
            );


        if (
            !doğum ||
            !değerleme
        ) {

            return null;

        }


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


        return yaş;

    }


    function hizmetSüresiHesapla(
        işeGirişTarihi,
        değerlemeTarihi
    ) {

        const giriş =
            tarihOku(
                işeGirişTarihi
            );

        const değerleme =
            tarihOku(
                değerlemeTarihi
            );


        if (
            !giriş ||
            !değerleme
        ) {

            return null;

        }


        const gün =
            (
                değerleme.getTime()
                -
                giriş.getTime()
            )
            /
            (
                1000 *
                60 *
                60 *
                24
            );


        return Math.max(
            0,
            gün / 365.25
        );

    }


    /* ========================================================
       AKTÜERYAL DEMOGRAFİK MODEL
    ======================================================== */

    /*
       Örnek yıllık mortalite oranları.

       Gerçek uygulamada:
       - TÜİK / resmi istatistik
       - şirket aktüeryal çalışması
       - seçilen mortality table

       kullanılmalıdır.
    */

    function ölümOlasılığı(
        yaş,
        cinsiyet = "E"
    ) {

        yaş =
            güvenliSayı(
                yaş,
                40
            );


        let oran;


        if (
            yaş < 25
        ) {

            oran = 0.0005;

        } else if (
            yaş < 35
        ) {

            oran =
                cinsiyet === "K"
                    ? 0.0010
                    : 0.0015;

        } else if (
            yaş < 45
        ) {

            oran =
                cinsiyet === "K"
                    ? 0.0018
                    : 0.0025;

        } else if (
            yaş < 55
        ) {

            oran =
                cinsiyet === "K"
                    ? 0.0035
                    : 0.0050;

        } else if (
            yaş < 60
        ) {

            oran =
                cinsiyet === "K"
                    ? 0.0055
                    : 0.0080;

        } else if (
            yaş < 65
        ) {

            oran =
                cinsiyet === "K"
                    ? 0.0080
                    : 0.0120;

        } else if (
            yaş < 70
        ) {

            oran =
                cinsiyet === "K"
                    ? 0.0120
                    : 0.0180;

        } else if (
            yaş < 75
        ) {

            oran =
                cinsiyet === "K"
                    ? 0.0200
                    : 0.0300;

        } else {

            oran =
                cinsiyet === "K"
                    ? 0.0450
                    : 0.0600;

        }


        return sınırla(
            oran,
            0,
            0.99
        );

    }


    /*
       Yaşa göre turnover.

       Gerçek şirket verisi varsa
       şirket deneyimine göre kalibre edilmelidir.
    */

    function devirOlasılığı(
        yaş,
        temelOran
    ) {

        yaş =
            güvenliSayı(
                yaş,
                40
            );


        temelOran =
            güvenliSayı(
                temelOran,
                SABİTLER.DEFAULT_TURNOVER_ORANI
            );


        let düzeltme;


        if (
            yaş < 30
        ) {

            düzeltme = 1.35;

        } else if (
            yaş < 40
        ) {

            düzeltme = 1.10;

        } else if (
            yaş < 50
        ) {

            düzeltme = 0.85;

        } else if (
            yaş < 55
        ) {

            düzeltme = 0.60;

        } else {

            düzeltme = 0.30;

        }


        return sınırla(
            temelOran *
            düzeltme,
            0,
            0.80
        );

    }


    /*
       Emeklilik olasılığı.

       Basit model:
       Emeklilik yaşına gelene kadar
       olasılık 0 kabul edilir.
    */

    function emeklilikOlasılığı(
        yaş,
        emeklilikYaşı
    ) {

        if (
            yaş >=
            emeklilikYaşı
        ) {

            return 1;

        }


        if (
            yaş >=
            emeklilikYaşı - 1
        ) {

            return 0.90;

        }


        if (
            yaş >=
            emeklilikYaşı - 2
        ) {

            return 0.50;

        }


        return 0;

    }


    /* ========================================================
       HAYATTA KALMA / FAYDA ALMA OLASILIĞI
    ======================================================== */

    function faydaAlmaOlasılığı(
        başlangıçYaşı,
        yıl,
        personel,
        varsayımlar
    ) {

        let hayattaKalma =
            1;


        let çalışmayaDevam =
            1;


        const cinsiyet =
            personel.cinsiyet
            ||
            personel.Cinsiyet
            ||
            "E";


        const temelTurnover =
            varsayımlar.personelDevirOranı;


        for (
            let i = 1;
            i <= yıl;
            i++
        ) {

            const yaş =
                başlangıçYaşı
                +
                i
                -
                1;


            const ölüm =
                ölümOlasılığı(
                    yaş,
                    cinsiyet
                );


            const turnover =
                devirOlasılığı(
                    yaş,
                    temelTurnover
                );


            const emeklilik =
                emeklilikOlasılığı(
                    yaş,
                    varsayımlar.emeklilikYaşı
                );


            if (
                emeklilik > 0
            ) {

                /*
                   Emeklilik yılına kadar
                   çalışma devam eder.
                */

                çalışmayaDevam *=
                    (
                        1
                        -
                        turnover
                    )
                    *
                    (
                        1
                        -
                        ölüm
                    );

            } else {

                çalışmayaDevam *=
                    (
                        1
                        -
                        turnover
                    )
                    *
                    (
                        1
                        -
                        ölüm
                    );

            }


            hayattaKalma *=
                (
                    1
                    -
                    ölüm
                );

        }


        return sınırla(
            çalışmayaDevam,
            0,
            1
        );

    }


    /* ========================================================
       MAAŞ PROJEKSİYONU
    ======================================================== */

    function gelecektekiMaaş(
        mevcutMaaş,
        yıl,
        maaşArtışOranı
    ) {

        mevcutMaaş =
            güvenliSayı(
                mevcutMaaş
            );


        maaşArtışOranı =
            sınırla(
                maaşArtışOranı,
                SABİTLER.MIN_MAAŞ_ARTIŞ,
                SABİTLER.MAX_MAAŞ_ARTIŞ
            );


        return (
            mevcutMaaş
            *
            Math.pow(
                1 +
                maaşArtışOranı,
                yıl
            )
        );

    }


    /* ========================================================
       FAYDA FORMÜLÜ
    ======================================================== */

    /*
       Türkiye kıdem tazminatı benzeri
       basitleştirilmiş analitik model.

       Gerçek uygulamada:
       - kıdem tazminatı tavanı
       - yasal ödeme koşulları
       - ihbar / özel planlar
       - şirket uygulamaları

       ayrıca modellenmelidir.
    */

    function faydaHesapla(
        maaş,
        toplamHizmet
    ) {

        return (
            güvenliSayı(
                maaş
            )
            *
            Math.max(
                0,
                toplamHizmet
            )
        );

    }


    /* ========================================================
       İSKONTO
    ======================================================== */

    function iskontoFaktörü(
        oran,
        yıl
    ) {

        oran =
            sınırla(
                güvenliSayı(
                    oran,
                    SABİTLER.DEFAULT_İSKONTO_ORANI
                ),
                SABİTLER.MIN_İSKONTO,
                SABİTLER.MAX_İSKONTO
            );


        return (
            1 /
            Math.pow(
                1 + oran,
                yıl
            )
        );

    }


    /* ========================================================
       PERSONEL NORMALİZASYONU
    ======================================================== */

    function personelNormalizeEt(
        personel,
        varsayımlar
    ) {

        const mevcutMaaş =
            güvenliSayı(
                personel.mevcutMaaş
                ??
                personel.mevcutMaas
                ??
                personel.Maaş
                ??
                personel.Maas
            );


        const yaş =
            güvenliSayı(
                personel.yaş
                ??
                personel.yas
                ??
                yaşHesapla(
                    personel.doğumTarihi
                    ??
                    personel.dogumTarihi,
                    varsayımlar.değerlemeTarihi
                ),
                40
            );


        const hizmet =
            güvenliSayı(
                personel.hizmetSüresi
                ??
                personel.hizmetSuresi
                ??
                hizmetSüresiHesapla(
                    personel.işeGirişTarihi
                    ??
                    personel.iseGirisTarihi,
                    varsayımlar.değerlemeTarihi
                ),
                0
            );


        const emeklilikYaşı =
            güvenliSayı(
                personel.emeklilikYaşı
                ??
                personel.emeklilikYasi
                ??
                varsayımlar.emeklilikYaşı,
                SABİTLER.DEFAULT_EMEKLİLİK_YAŞI
            );


        return {

            ...personel,

            mevcutMaaş,

            yaş,

            hizmetSüresi:
                hizmet,

            emeklilikYaşı,

            cinsiyet:
                personel.cinsiyet
                ??
                personel.Cinsiyet
                ??
                "E"

        };

    }


    /* ========================================================
       PERSONEL BAZLI AKTÜERYAL PROJEKSİYON
    ======================================================== */

    function personelProjeksiyonu(
        hamPersonel,
        varsayımlar
    ) {

        const personel =
            personelNormalizeEt(
                hamPersonel,
                varsayımlar
            );


        const yaş =
            personel.yaş;


        const hizmet =
            personel.hizmetSüresi;


        const emeklilikYaşı =
            personel.emeklilikYaşı;


        const maksimumYıl =
            Math.min(
                SABİTLER.MAKS_PROJEKSİYON_YILI,
                Math.max(
                    1,
                    emeklilikYaşı
                    -
                    yaş
                    +
                    1
                )
            );


        const yıllık = [];


        let DBO =
            0;


        let öncekiDBO =
            0;


        let toplamCariHizmet =
            0;


        let toplamFaiz =
            0;


        let toplamBeklenenFayda =
            0;


        for (
            let yıl = 1;
            yıl <= maksimumYıl;
            yıl++
        ) {

            const gelecekYaş =
                yaş
                +
                yıl;


            const gelecekHizmet =
                hizmet
                +
                yıl;


            const maaş =
                gelecektekiMaaş(
                    personel.mevcutMaaş,
                    yıl,
                    varsayımlar.maaşArtışOranı
                );


            const beklenenFayda =
                faydaHesapla(
                    maaş,
                    gelecekHizmet
                );


            const faydaOlasılığı =
                faydaAlmaOlasılığı(
                    yaş,
                    yıl,
                    personel,
                    varsayımlar
                );


            const beklenenFaydaTutari =
                beklenenFayda
                *
                faydaOlasılığı;


            const iskonto =
                iskontoFaktörü(
                    varsayımlar.iskontoOranı,
                    yıl
                );


            const bugünküDeğer =
                beklenenFaydaTutari
                *
                iskonto;


            /*
               PUC:
               Toplam faydanın hizmet yılına
               dağıtılması.
            */

            const toplamHizmet =
                Math.max(
                    gelecekHizmet,
                    1
                );


            const birimFayda =
                beklenenFaydaTutari
                /
                toplamHizmet;


            const geçmişHizmeteAtfedilen =
                birimFayda
                *
                hizmet;


            const yılDBO =
                geçmişHizmeteAtfedilen
                *
                iskonto;


            /*
               Cari hizmet maliyeti:
               Bir yıllık ilave hizmetin
               bugünkü değeri.
            */

            const cariHizmetMaliyeti =
                birimFayda
                *
                iskonto;


            /*
               Faiz maliyeti:
               Önceki DBO × iskonto oranı.
            */

            const faizMaliyeti =
                öncekiDBO
                *
                varsayımlar.iskontoOranı;


            yıllık.push({

                yıl,

                yaş:
                    gelecekYaş,

                hizmet:
                    gelecekHizmet,

                maaş,

                beklenenFayda,

                faydaOlasılığı,

                beklenenFaydaTutari,

                iskontoFaktörü:
                    iskonto,

                bugünküDeğer,

                DBO:
                    yılDBO,

                cariHizmetMaliyeti,

                faizMaliyeti

            });


            öncekiDBO =
                yılDBO;


            DBO =
                yılDBO;


            toplamCariHizmet +=
                cariHizmetMaliyeti;


            toplamFaiz +=
                faizMaliyeti;


            toplamBeklenenFayda +=
                beklenenFaydaTutari;

        }


        return {

            personel,

            yıllık,

            kapanışDBO:
                DBO,

            cariHizmetMaliyeti:
                toplamCariHizmet,

            faizMaliyeti:
                toplamFaiz,

            toplamBeklenenFayda

        };

    }


    /* ========================================================
       TOPLU DEĞERLEME
    ======================================================== */

    function değerle(
        personelListesi,
        varsayımlar
    ) {

        const sonuçlar =
            [];


        let toplamDBO =
            0;


        let toplamCariHizmet =
            0;


        let toplamFaiz =
            0;


        let toplamBeklenenFayda =
            0;


        personelListesi.forEach(
            personel => {

                const sonuç =
                    personelProjeksiyonu(
                        personel,
                        varsayımlar
                    );


                sonuçlar.push(
                    sonuç
                );


                toplamDBO +=
                    sonuç.kapanışDBO;


                toplamCariHizmet +=
                    sonuç.cariHizmetMaliyeti;


                toplamFaiz +=
                    sonuç.faizMaliyeti;


                toplamBeklenenFayda +=
                    sonuç.toplamBeklenenFayda;

            }
        );


        return {

            personelSonuçları:
                sonuçlar,

            toplamDBO,

            toplamCariHizmet,

            toplamFaiz,

            toplamBeklenenFayda

        };

    }


    /* ========================================================
       DBO KÖPRÜSÜ
    ======================================================== */

    function dboKöprüsü(
        değerleme
    ) {

        const açılış =
            0;


        const cariHizmet =
            değerleme.toplamCariHizmet;


        const faiz =
            değerleme.toplamFaiz;


        const aktüeryal =
            0;


        const ödemeler =
            0;


        const kapanış =
            değerleme.toplamDBO;


        return [

            {

                açıklama:
                    "Açılış DBO",

                tutar:
                    açılış,

                tür:
                    "base"

            },

            {

                açıklama:
                    "Cari Hizmet Maliyeti",

                tutar:
                    cariHizmet,

                tür:
                    "pnl"

            },

            {

                açıklama:
                    "Faiz Maliyeti",

                tutar:
                    faiz,

                tür:
                    "pnl"

            },

            {

                açıklama:
                    "Aktüeryal Yeniden Ölçüm",

                tutar:
                    aktüeryal,

                tür:
                    "oci"

            },

            {

                açıklama:
                    "Fayda Ödemeleri",

                tutar:
                    -ödemeler,

                tür:
                    "base"

            },

            {

                açıklama:
                    "Kapanış DBO",

                tutar:
                    kapanış,

                tür:
                    "base"

            }

        ];

    }


    /* ========================================================
       YILLIK PROJEKSİYON
    ======================================================== */

    function yıllıkProjeksiyon(
        personelSonuçları
    ) {

        const harita =
            {};


        personelSonuçları.forEach(
            sonuç => {

                sonuç.yıllık.forEach(
                    dönem => {

                        if (
                            !harita[
                                dönem.yıl
                            ]
                        ) {

                            harita[
                                dönem.yıl
                            ] = {

                                yıl:
                                    dönem.yıl,

                                personelSayısı:
                                    0,

                                toplamDBO:
                                    0,

                                toplamCariHizmetMaliyeti:
                                    0,

                                toplamFaizMaliyeti:
                                    0,

                                toplamBeklenenFayda:
                                    0,

                                toplamBugünküDeğer:
                                    0

                            };

                        }


                        const hedef =
                            harita[
                                dönem.yıl
                            ];


                        hedef.personelSayısı++;


                        hedef.toplamDBO +=
                            dönem.DBO;


                        hedef.toplamCariHizmetMaliyeti +=
                            dönem.cariHizmetMaliyeti;


                        hedef.toplamFaizMaliyeti +=
                            dönem.faizMaliyeti;


                        hedef.toplamBeklenenFayda +=
                            dönem.beklenenFaydaTutari;


                        hedef.toplamBugünküDeğer +=
                            dönem.bugünküDeğer;

                    }
                );

            }
        );


        return {

            yıllık:
                Object.values(
                    harita
                ).sort(
                    (
                        a,
                        b
                    ) =>
                        a.yıl
                        -
                        b.yıl
                )

        };

    }


    /* ========================================================
       DUYARLILIK
    ======================================================== */

    function tekDuyarlılık(
        personel,
        varsayımlar,
        alan,
        değişim
    ) {

        const yeni =
            {
                ...varsayımlar
            };


        if (
            alan ===
            "iskonto"
        ) {

            yeni.iskontoOranı =
                varsayımlar.iskontoOranı
                +
                değişim;

        }


        if (
            alan ===
            "maaş"
        ) {

            yeni.maaşArtışOranı =
                varsayımlar.maaşArtışOranı
                +
                değişim;

        }


        const sonuç =
            değerle(
                personel,
                yeni
            );


        return {

            dbo:
                sonuç.toplamDBO

        };

    }


    function duyarlılık(
        personel,
        varsayımlar,
        bazDBO
    ) {

        const iskontoMinus =
            tekDuyarlılık(
                personel,
                varsayımlar,
                "iskonto",
                -0.01
            );


        const iskontoPlus =
            tekDuyarlılık(
                personel,
                varsayımlar,
                "iskonto",
                0.01
            );


        const maaşMinus =
            tekDuyarlılık(
                personel,
                varsayımlar,
                "maaş",
                -0.01
            );


        const maaşPlus =
            tekDuyarlılık(
                personel,
                varsayımlar,
                "maaş",
                0.01
            );


        function hazırla(
            veri
        ) {

            const değişim =
                veri.dbo
                -
                bazDBO;


            return {

                dbo:
                    veri.dbo,

                change:
                    değişim,

                changePercent:
                    bazDBO !== 0
                        ? değişim /
                          bazDBO
                        : 0

            };

        }


        return {

            discount: {

                minus:
                    hazırla(
                        iskontoMinus
                    ),

                base:
                    hazırla({
                        dbo:
                            bazDBO
                    }),

                plus:
                    hazırla(
                        iskontoPlus
                    )

            },

            salary: {

                minus:
                    hazırla(
                        maaşMinus
                    ),

                base:
                    hazırla({
                        dbo:
                            bazDBO
                    }),

                plus:
                    hazırla(
                        maaşPlus
                    )

            }

        };

    }


    /* ========================================================
       VERİ KALİTESİ
    ======================================================== */

    function veriKalitesi(
        personel,
        varsayımlar
    ) {

        let skor =
            100;


        const hatalar =
            [];


        personel.forEach(
            (
                p,
                index
            ) => {

                const doğum =
                    tarihOku(
                        p.doğumTarihi
                        ??
                        p.dogumTarihi
                    );


                const giriş =
                    tarihOku(
                        p.işeGirişTarihi
                        ??
                        p.iseGirisTarihi
                    );


                const maaş =
                    güvenliSayı(
                        p.mevcutMaaş
                        ??
                        p.mevcutMaas
                    );


                if (
                    !doğum
                ) {

                    skor -= 8;

                    hatalar.push(
                        `Personel ${index + 1}: doğum tarihi eksik.`
                    );

                }


                if (
                    !giriş
                ) {

                    skor -= 8;

                    hatalar.push(
                        `Personel ${index + 1}: işe giriş tarihi eksik.`
                    );

                }


                if (
                    maaş <= 0
                ) {

                    skor -= 10;

                    hatalar.push(
                        `Personel ${index + 1}: geçerli maaş bulunamadı.`
                    );

                }

            }
        );


        if (
            varsayımlar.iskontoOranı <= 0
        ) {

            skor -= 20;

            hatalar.push(
                "İskonto oranı geçerli değil."
            );

        }


        if (
            varsayımlar.maaşArtışOranı <
            -0.50
        ) {

            skor -= 10;

            hatalar.push(
                "Maaş artış oranı olağandışı."
            );

        }


        skor =
            sınırla(
                skor,
                0,
                100
            );


        let seviye;


        if (
            skor >= 90
        ) {

            seviye =
                "çok iyi";

        } else if (
            skor >= 75
        ) {

            seviye =
                "iyi";

        } else if (
            skor >= 60
        ) {

            seviye =
                "orta";

        } else {

            seviye =
                "zayıf";

        }


        return {

            kaliteSkoru:
                skor,

            seviye,

            toplamHata:
                hatalar.length,

            hatalar

        };

    }


    /* ========================================================
       RİSK ANALİZİ
    ======================================================== */

    function riskAnalizi(
        personel,
        varsayımlar,
        sensitivity
    ) {

        const riskler =
            [];


        const iskontoHassasiyeti =
            Math.max(
                Math.abs(
                    sensitivity.discount.minus.changePercent
                ),
                Math.abs(
                    sensitivity.discount.plus.changePercent
                )
            );


        const maaşHassasiyeti =
            Math.max(
                Math.abs(
                    sensitivity.salary.minus.changePercent
                ),
                Math.abs(
                    sensitivity.salary.plus.changePercent
                )
            );


        if (
            iskontoHassasiyeti >
            0.10
        ) {

            riskler.push({

                seviye:
                    "yüksek",

                alan:
                    "İskonto Oranı",

                açıklama:
                    "DBO, iskonto oranındaki değişimlere yüksek hassasiyet göstermektedir."

            });

        } else if (
            iskontoHassasiyeti >
            0.05
        ) {

            riskler.push({

                seviye:
                    "orta",

                alan:
                    "İskonto Oranı",

                açıklama:
                    "İskonto varsayımındaki değişiklik DBO üzerinde anlamlı etki yaratabilir."

            });

        }


        if (
            maaşHassasiyeti >
            0.10
        ) {

            riskler.push({

                seviye:
                    "yüksek",

                alan:
                    "Maaş Artış Oranı",

                açıklama:
                    "Gelecekteki maaş artışları DBO üzerinde yüksek hassasiyet yaratmaktadır."

            });

        } else if (
            maaşHassasiyeti >
            0.05
        ) {

            riskler.push({

                seviye:
                    "orta",

                alan:
                    "Maaş Artış Oranı",

                açıklama:
                    "Maaş artış varsayımı DBO açısından önemli bir aktüeryal varsayımdır."

            });

        }


        const yaşlar =
            personel.map(
                p =>
                    güvenliSayı(
                        p.yaş
                        ??
                        p.yas,
                        0
                    )
            );


        const yaş45Üzeri =
            yaşlar.filter(
                yaş =>
                    yaş >= 45
            ).length;


        if (
            personel.length > 0
            &&
            yaş45Üzeri /
            personel.length
            >
            0.40
        ) {

            riskler.push({

                seviye:
                    "orta",

                alan:
                    "Demografik Yapı",

                açıklama:
                    "Çalışanların önemli bir bölümü 45 yaş üzerindedir. DBO'nun emeklilik ve maaş varsayımlarına duyarlılığı artabilir."

            });

        }


        if (
            personel.length <
            10
        ) {

            riskler.push({

                seviye:
                    "orta",

                alan:
                    "Veri Seti",

                açıklama:
                    "Küçük personel popülasyonu aktüeryal varsayımların istatistiksel kalibrasyonunu sınırlayabilir."

            });

        }


        return {

            riskler

        };

    }


    /* ========================================================
       CFO YÖNETİCİ ÖZETİ
    ======================================================== */

    function yöneticiÖzeti(
        değerleme,
        sensitivity,
        risk
    ) {

        const DBO =
            değerleme.toplamDBO;


        const PnL =
            değerleme.toplamCariHizmet
            +
            değerleme.toplamFaiz;


        const OCI =
            0;


        const PnLDBOOranı =
            DBO !== 0
                ? PnL / DBO
                : 0;


        const yorumlar =
            [];


        yorumlar.push(
            `Toplam tanımlanmış fayda yükümlülüğü ${DBO.toLocaleString("tr-TR", {
                maximumFractionDigits: 0
            })} TL seviyesindedir.`
        );


        yorumlar.push(
            `Cari hizmet maliyeti ve faiz maliyetinin toplam dönemsel P&L etkisi yaklaşık ${PnL.toLocaleString("tr-TR", {
                maximumFractionDigits: 0
            })} TL'dir.`
        );


        const iskontoEtki =
            Math.max(
                Math.abs(
                    sensitivity.discount.minus.changePercent
                ),
                Math.abs(
                    sensitivity.discount.plus.changePercent
                )
            );


        if (
            iskontoEtki >
            0.05
        ) {

            yorumlar.push(
                "DBO'nun iskonto oranına anlamlı hassasiyeti bulunmaktadır. Finansal kapanışta iskonto oranının destekleyici piyasa verileriyle belgelenmesi önemlidir."
            );

        }


        const maaşEtki =
            Math.max(
                Math.abs(
                    sensitivity.salary.minus.changePercent
                ),
                Math.abs(
                    sensitivity.salary.plus.changePercent
                )
            );


        if (
            maaşEtki >
            0.05
        ) {

            yorumlar.push(
                "Maaş artış varsayımı DBO üzerinde anlamlı etkiye sahiptir. Bütçe ve uzun vadeli ücret artış beklentileriyle tutarlılık kontrol edilmelidir."
            );

        }


        if (
            risk.riskler.length
        ) {

            yorumlar.push(
                `${risk.riskler.length} adet aktüeryal / veri riski tespit edilmiştir.`
            );

        }


        yorumlar.push(
            "CFO perspektifinden temel odak noktaları: DBO volatilitesi, OCI hassasiyeti, iskonto oranı, maaş artışı, çalışan demografisi ve nakit ödeme profili."
        );


        return {

            DBO,

            PnL,

            OCI,

            PnLDBOOranı,

            yorumlar

        };

    }


    /* ========================================================
       TAM HESAPLAMA
    ======================================================== */

    function tamHesapla(
        personel,
        varsayımlar
    ) {

        if (
            !Array.isArray(
                personel
            )
        ) {

            throw new Error(
                "Personel verisi dizi formatında olmalıdır."
            );

        }


        varsayımlar =
            {

                iskontoOranı:
                    güvenliSayı(
                        varsayımlar?.iskontoOranı,
                        SABİTLER.DEFAULT_İSKONTO_ORANI
                    ),

                maaşArtışOranı:
                    güvenliSayı(
                        varsayımlar?.maaşArtışOranı,
                        SABİTLER.DEFAULT_MAAŞ_ARTIŞ_ORANI
                    ),

                personelDevirOranı:
                    güvenliSayı(
                        varsayımlar?.personelDevirOranı,
                        SABİTLER.DEFAULT_TURNOVER_ORANI
                    ),

                emeklilikYaşı:
                    güvenliSayı(
                        varsayımlar?.emeklilikYaşı,
                        SABİTLER.DEFAULT_EMEKLİLİK_YAŞI
                    ),

                değerlemeTarihi:
                    varsayımlar?.değerlemeTarihi
                    ||
                    new Date()
                        .toISOString()
                        .slice(
                            0,
                            10
                        )

            };


        const değerleme =
            değerle(
                personel,
                varsayımlar
            );


        const köprü =
            dboKöprüsü(
                değerleme
            );


        const sensitivity =
            duyarlılık(
                personel,
                varsayımlar,
                değerleme.toplamDBO
            );


        const projeksiyon =
            yıllıkProjeksiyon(
                değerleme.personelSonuçları
            );


        const kalite =
            veriKalitesi(
                personel,
                varsayımlar
            );


        const risk =
            riskAnalizi(
                personel,
                varsayımlar,
                sensitivity
            );


        const özet =
            yöneticiÖzeti(
                değerleme,
                sensitivity,
                risk
            );


        return {

            /* ANA SONUÇLAR */

            closingDBO:
                değerleme.toplamDBO,

            currentServiceCost:
                değerleme.toplamCariHizmet,

            netInterestCost:
                değerleme.toplamFaiz,

            oci:
                0,

            personelSayısı:
                personel.length,


            /* DETAY */

            personelSonuçları:
                değerleme.personelSonuçları,

            dboKöprüsü:
                köprü,

            sensitivity,

            yıllıkProjeksiyon:
                projeksiyon,

            veriKalitesi:
                kalite,

            riskAnalizi:
                risk,

            yöneticiÖzeti:
                özet,


            /* MODEL */

            varsayımlar

        };

    }


    /* ========================================================
       PUBLIC API
    ======================================================== */

    return {

        tamHesapla,

        değerle,

        personelProjeksiyonu,

        ölümOlasılığı,

        devirOlasılığı,

        emeklilikOlasılığı,

        faydaAlmaOlasılığı,

        gelecektekiMaaş,

        faydaHesapla,

        iskontoFaktörü,

        veriKalitesi,

        riskAnalizi,

        SABİTLER

    };


})();


/* ============================================================
   GLOBAL ERİŞİM
============================================================ */

window.TMS19 =
    TMS19;


/* ============================================================
   DEBUG
============================================================ */

console.log(
    "TMS 19 Aktüeryal Motor V2 yüklendi."
);
