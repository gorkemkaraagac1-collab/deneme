/* ================================================================
   GK FINANCIAL DECISION COCKPIT
   TMS 19 PORTFOLIO ENGINE
   ----------------------------------------------------------------
   Sürüm    : 2.0.0
   Standart : TMS 19

   SORUMLULUKLAR
   -------------
   ✓ Personel listesini toplu hesaplamak
   ✓ Toplam DBO
   ✓ Toplam cari hizmet maliyeti
   ✓ Toplam faiz maliyeti
   ✓ P&L özeti
   ✓ Personel bazlı sonuçlar
   ✓ Departman analizi
   ✓ Yaş grubu analizi
   ✓ Hizmet süresi analizi
   ✓ DBO yoğunlaşması
   ✓ Risk analizi
   ✓ Sensitivity
   ✓ Portföy KPI'ları

   AKTÜERYAL HESAPLAMA
   -------------------
   Tek personelin aktüeryal hesabı bu dosyada yapılmaz.

   Bunun tek kaynağı:

       TMS19ActuarialEngine

================================================================ */

(function (global) {

    "use strict";


    /* ============================================================
       01 — ENGINE
    ============================================================ */

    const Portfolio = {};


    Portfolio.version =
        "2.0.0";


    Portfolio.engineName =
        "GK TMS 19 Portfolio Engine";


    Portfolio.standard =
        "TMS 19";


    /* ============================================================
       02 — ACTUARIAL ENGINE KONTROLÜ
    ============================================================ */

    function actuarialEngineAl() {

        const engine =
            global.TMS19ActuarialEngine;


        if (
            !engine ||
            typeof engine.hesapla !== "function"
        ) {

            throw new Error(
                "TMS19ActuarialEngine yüklenmemiş. " +
                "Önce tms19-actuarial-engine.js yüklenmelidir."
            );
        }


        return engine;
    }


    /* ============================================================
       03 — YARDIMCILAR
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


        const metin =
            String(deger)
                .trim()
                .replace(/\s/g, "")
                .replace(/\./g, "")
                .replace(",", ".");


        const sonuc =
            Number(metin);


        return Number.isFinite(sonuc)
            ? sonuc
            : varsayilan;
    }


    function yuzde(
        deger
    ) {

        return sayi(
            deger
        ) * 100;
    }


    function ortalama(
        liste
    ) {

        if (
            !liste ||
            liste.length === 0
        ) {

            return 0;
        }


        return liste.reduce(
            (
                toplam,
                deger
            ) =>
                toplam +
                sayi(deger),
            0
        ) / liste.length;
    }


    function benzersiz(
        liste
    ) {

        return [
            ...new Set(
                liste
            )
        ];
    }


    /* ============================================================
       04 — PERSONEL LİSTESİ NORMALİZASYONU
    ============================================================ */

    function personellerNormalizeEt(
        personeller
    ) {

        if (
            !Array.isArray(
                personeller
            )
        ) {

            return [];
        }


        return personeller.filter(
            personel =>
                personel &&
                typeof personel === "object"
        );
    }


    /* ============================================================
       05 — TEK PERSONEL HESABI
    ============================================================ */

    function personelHesapla(
        personel,
        varsayimlar
    ) {

        const engine =
            actuarialEngineAl();


        return engine.hesapla(
            personel,
            varsayimlar
        );
    }


    /* ============================================================
       06 — PORTFÖY HESAPLAMA
    ============================================================ */

    function hesapla(
        personeller,
        varsayimlar,
        options = {}
    ) {

        const liste =
            personellerNormalizeEt(
                personeller
            );


        const engine =
            actuarialEngineAl();


        const sonuclar = [];


        const hatalar = [];


        liste.forEach(
            (
                personel,
                index
            ) => {

                try {

                    const sonuc =
                        engine.hesapla(
                            personel,
                            varsayimlar,
                            options
                        );


                    sonuclar.push(
                        sonuc
                    );

                }

                catch (error) {

                    hatalar.push({

                        index:
                            index,

                        personel:
                            personel,

                        mesaj:
                            error.message
                    });
                }
            }
        );


        /* --------------------------------------------------------
           TOPLAMLAR
        -------------------------------------------------------- */

        const toplamDBO =
            sonuclar.reduce(
                (
                    toplam,
                    sonuc
                ) =>
                    toplam +
                    sayi(
                        sonuc.muhasebe?.dbo
                    ),
                0
            );


        const toplamCariHizmetMaliyeti =
            sonuclar.reduce(
                (
                    toplam,
                    sonuc
                ) =>
                    toplam +
                    sayi(
                        sonuc.muhasebe
                            ?.cariHizmetMaliyeti
                    ),
                0
            );


        const toplamFaizMaliyeti =
            sonuclar.reduce(
                (
                    toplam,
                    sonuc
                ) =>
                    toplam +
                    sayi(
                        sonuc.muhasebe
                            ?.faizMaliyeti
                    ),
                0
            );


        const toplamYillikFayda =
            sonuclar.reduce(
                (
                    toplam,
                    sonuc
                ) =>
                    toplam +
                    sayi(
                        sonuc.fayda
                            ?.yillikFayda
                    ),
                0
            );


        const toplamBeklenenFayda =
            sonuclar.reduce(
                (
                    toplam,
                    sonuc
                ) =>
                    toplam +
                    sayi(
                        sonuc.fayda
                            ?.beklenenFayda
                    ),
                0
            );


        const toplamMevcutMaas =
            sonuclar.reduce(
                (
                    toplam,
                    sonuc
                ) =>
                    toplam +
                    sayi(
                        sonuc.maas
                            ?.mevcutMaas
                    ),
                0
            );


        const toplamEmeklilikMaasi =
            sonuclar.reduce(
                (
                    toplam,
                    sonuc
                ) =>
                    toplam +
                    sayi(
                        sonuc.maas
                            ?.emeklilikMaasi
                    ),
                0
            );


        /* --------------------------------------------------------
           ORTALAMALAR
        -------------------------------------------------------- */

        const ortalamaYas =
            ortalama(
                sonuclar.map(
                    sonuc =>
                        sonuc.demografi?.yas
                )
            );


        const ortalamaHizmet =
            ortalama(
                sonuclar.map(
                    sonuc =>
                        sonuc.hizmet
                            ?.mevcutHizmet
                )
            );


        const ortalamaKalanYil =
            ortalama(
                sonuclar.map(
                    sonuc =>
                        sonuc.demografi
                            ?.emekliligeKalanYil
                )
            );


        const ortalamaDevamOlasiligi =
            ortalama(
                sonuclar.map(
                    sonuc =>
                        sonuc.demografi
                            ?.devamOlasiligi
                )
            );


        /* --------------------------------------------------------
           KIDEM TAVANI
        -------------------------------------------------------- */

        const tavanUygulananPersonel =
            sonuclar.filter(
                sonuc =>
                    sonuc.kidemTavani
                        ?.uygulandi === true
            ).length;


        /* --------------------------------------------------------
           KPI
        -------------------------------------------------------- */

        const dboPerPersonel =
            sonuclar.length > 0
                ? toplamDBO /
                  sonuclar.length
                : 0;


        const dboMaasOrani =
            toplamMevcutMaas > 0
                ? toplamDBO /
                  toplamMevcutMaas
                : 0;


        return {

            engine: {

                name:
                    Portfolio.engineName,

                version:
                    Portfolio.version,

                standard:
                    Portfolio.standard
            },


            ozet: {

                personelSayisi:
                    sonuclar.length,

                hataliPersonelSayisi:
                    hatalar.length,

                toplamDBO:
                    toplamDBO,

                toplamCariHizmetMaliyeti:
                    toplamCariHizmetMaliyeti,

                toplamFaizMaliyeti:
                    toplamFaizMaliyeti,

                toplamYillikFayda:
                    toplamYillikFayda,

                toplamBeklenenFayda:
                    toplamBeklenenFayda,

                toplamMevcutMaas:
                    toplamMevcutMaas,

                toplamEmeklilikMaasi:
                    toplamEmeklilikMaasi,

                dboPerPersonel:
                    dboPerPersonel,

                dboMaasOrani:
                    dboMaasOrani,

                ortalamaYas:
                    ortalamaYas,

                ortalamaHizmet:
                    ortalamaHizmet,

                ortalamaKalanYil:
                    ortalamaKalanYil,

                ortalamaDevamOlasiligi:
                    ortalamaDevamOlasiligi,

                tavanUygulananPersonel:
                    tavanUygulananPersonel
            },


            pnl: {

                cariHizmetMaliyeti:
                    toplamCariHizmetMaliyeti,

                faizMaliyeti:
                    toplamFaizMaliyeti,

                toplamPnlMaliyeti:
                    toplamCariHizmetMaliyeti +
                    toplamFaizMaliyeti
            },


            personeller:
                sonuclar,


            hatalar:
                hatalar
        };
    }


    /* ============================================================
       07 — DEPARTMAN ANALİZİ
    ============================================================ */

    function departmanAnalizi(
        sonuclar
    ) {

        const gruplar = {};


        sonuclar.forEach(
            sonuc => {

                const departman =
                    sonuc.personel
                        ?.departman ||
                    "Belirtilmemiş";


                if (
                    !gruplar[departman]
                ) {

                    gruplar[departman] = {

                        departman:
                            departman,

                        personelSayisi:
                            0,

                        dbo:
                            0,

                        cariHizmetMaliyeti:
                            0,

                        faizMaliyeti:
                            0,

                        toplamMaas:
                            0,

                        ortalamaYas:
                            0,

                        ortalamaHizmet:
                            0,

                        yaslar: [],

                        hizmetler: []
                    };
                }


                const grup =
                    gruplar[departman];


                grup.personelSayisi++;


                grup.dbo +=
                    sayi(
                        sonuc.muhasebe
                            ?.dbo
                    );


                grup.cariHizmetMaliyeti +=
                    sayi(
                        sonuc.muhasebe
                            ?.cariHizmetMaliyeti
                    );


                grup.faizMaliyeti +=
                    sayi(
                        sonuc.muhasebe
                            ?.faizMaliyeti
                    );


                grup.toplamMaas +=
                    sayi(
                        sonuc.maas
                            ?.mevcutMaas
                    );


                grup.yaslar.push(
                    sayi(
                        sonuc.demografi
                            ?.yas
                    )
                );


                grup.hizmetler.push(
                    sayi(
                        sonuc.hizmet
                            ?.mevcutHizmet
                    )
                );
            }
        );


        return Object.values(
            gruplar
        ).map(
            grup => {

                grup.ortalamaYas =
                    ortalama(
                        grup.yaslar
                    );


                grup.ortalamaHizmet =
                    ortalama(
                        grup.hizmetler
                    );


                delete grup.yaslar;
                delete grup.hizmetler;


                return grup;
            }
        ).sort(
            (
                a,
                b
            ) =>
                b.dbo -
                a.dbo
        );
    }


    /* ============================================================
       08 — YAŞ GRUBU ANALİZİ
    ============================================================ */

    function yasGrubuBelirle(
        yas
    ) {

        const y =
            sayi(
                yas
            );


        if (
            y < 30
        ) {

            return "30 yaş altı";
        }


        if (
            y < 40
        ) {

            return "30-39";
        }


        if (
            y < 50
        ) {

            return "40-49";
        }


        if (
            y < 60
        ) {

            return "50-59";
        }


        return "60+";
    }


    function yasGrubuAnalizi(
        sonuclar
    ) {

        const gruplar = {};


        sonuclar.forEach(
            sonuc => {

                const grupAdi =
                    yasGrubuBelirle(
                        sonuc.demografi
                            ?.yas
                    );


                if (
                    !gruplar[grupAdi]
                ) {

                    gruplar[grupAdi] = {

                        yasGrubu:
                            grupAdi,

                        personelSayisi:
                            0,

                        dbo:
                            0,

                        cariHizmetMaliyeti:
                            0,

                        toplamMaas:
                            0
                    };
                }


                const grup =
                    gruplar[grupAdi];


                grup.personelSayisi++;


                grup.dbo +=
                    sayi(
                        sonuc.muhasebe
                            ?.dbo
                    );


                grup.cariHizmetMaliyeti +=
                    sayi(
                        sonuc.muhasebe
                            ?.cariHizmetMaliyeti
                    );


                grup.toplamMaas +=
                    sayi(
                        sonuc.maas
                            ?.mevcutMaas
                    );
            }
        );


        return Object.values(
            gruplar
        );
    }


    /* ============================================================
       09 — HİZMET SÜRESİ ANALİZİ
    ============================================================ */

    function hizmetGrubuBelirle(
        hizmet
    ) {

        const h =
            sayi(
                hizmet
            );


        if (
            h < 3
        ) {

            return "0-2 yıl";
        }


        if (
            h < 5
        ) {

            return "3-4 yıl";
        }


        if (
            h < 10
        ) {

            return "5-9 yıl";
        }


        if (
            h < 15
        ) {

            return "10-14 yıl";
        }


        return "15+ yıl";
    }


    function hizmetSuresiAnalizi(
        sonuclar
    ) {

        const gruplar = {};


        sonuclar.forEach(
            sonuc => {

                const grupAdi =
                    hizmetGrubuBelirle(
                        sonuc.hizmet
                            ?.mevcutHizmet
                    );


                if (
                    !gruplar[grupAdi]
                ) {

                    gruplar[grupAdi] = {

                        hizmetGrubu:
                            grupAdi,

                        personelSayisi:
                            0,

                        dbo:
                            0,

                        toplamMaas:
                            0
                    };
                }


                const grup =
                    gruplar[grupAdi];


                grup.personelSayisi++;


                grup.dbo +=
                    sayi(
                        sonuc.muhasebe
                            ?.dbo
                    );


                grup.toplamMaas +=
                    sayi(
                        sonuc.maas
                            ?.mevcutMaas
                    );
            }
        );


        return Object.values(
            gruplar
        );
    }


    /* ============================================================
       10 — DBO YOĞUNLAŞMASI
    ============================================================ */

    function dboYogunlasmasi(
        sonuclar,
        limit = 10
    ) {

        const sirali =
            [...sonuclar]
                .sort(
                    (
                        a,
                        b
                    ) =>
                        sayi(
                            b.muhasebe?.dbo
                        ) -
                        sayi(
                            a.muhasebe?.dbo
                        )
                );


        const toplamDBO =
            sirali.reduce(
                (
                    toplam,
                    sonuc
                ) =>
                    toplam +
                    sayi(
                        sonuc.muhasebe?.dbo
                    ),
                0
            );


        const top =
            sirali
                .slice(
                    0,
                    limit
                )
                .map(
                    (
                        sonuc,
                        index
                    ) => {

                        const dbo =
                            sayi(
                                sonuc.muhasebe
                                    ?.dbo
                            );


                        return {

                            sira:
                                index + 1,

                            personelId:
                                sonuc.personel
                                    ?.personelId,

                            adSoyad:
                                sonuc.personel
                                    ?.adSoyad,

                            departman:
                                sonuc.personel
                                    ?.departman,

                            dbo:
                                dbo,

                            dboPayi:
                                toplamDBO > 0
                                    ? dbo /
                                      toplamDBO
                                    : 0
                        };
                    }
                );


        const top5 =
            sirali.slice(
                0,
                5
            ).reduce(
                (
                    toplam,
                    sonuc
                ) =>
                    toplam +
                    sayi(
                        sonuc.muhasebe?.dbo
                    ),
                0
            );


        const top10 =
            sirali.slice(
                0,
                10
            ).reduce(
                (
                    toplam,
                    sonuc
                ) =>
                    toplam +
                    sayi(
                        sonuc.muhasebe?.dbo
                    ),
                0
            );


        return {

            topPersoneller:
                top,

            top5DBOPayi:
                toplamDBO > 0
                    ? top5 /
                      toplamDBO
                    : 0,

            top10DBOPayi:
                toplamDBO > 0
                    ? top10 /
                      toplamDBO
                    : 0
        };
    }


    /* ============================================================
       11 — RİSK ANALİZİ
    ============================================================ */

    function riskAnalizi(
        sonuclar
    ) {

        const riskler = [];


        sonuclar.forEach(
            sonuc => {

                const dbo =
                    sayi(
                        sonuc.muhasebe
                            ?.dbo
                    );


                const kalanYil =
                    sayi(
                        sonuc.demografi
                            ?.emekliligeKalanYil
                    );


                const yas =
                    sayi(
                        sonuc.demografi
                            ?.yas
                    );


                const devam =
                    sayi(
                        sonuc.demografi
                            ?.devamOlasiligi
                    );


                let skor = 0;


                /*
                 * Yüksek DBO
                 */

                if (
                    dbo > 1000000
                ) {

                    skor += 3;
                }

                else if (
                    dbo > 500000
                ) {

                    skor += 2;
                }

                else if (
                    dbo > 250000
                ) {

                    skor += 1;
                }


                /*
                 * Emekliliğe yakınlık
                 */

                if (
                    kalanYil <= 3
                ) {

                    skor += 3;
                }

                else if (
                    kalanYil <= 5
                ) {

                    skor += 2;
                }

                else if (
                    kalanYil <= 10
                ) {

                    skor += 1;
                }


                /*
                 * Düşük devam olasılığı
                 */

                if (
                    devam < 0.5
                ) {

                    skor += 2;
                }

                else if (
                    devam < 0.75
                ) {

                    skor += 1;
                }


                let seviye =
                    "Düşük";


                if (
                    skor >= 6
                ) {

                    seviye =
                        "Kritik";
                }

                else if (
                    skor >= 4
                ) {

                    seviye =
                        "Yüksek";
                }

                else if (
                    skor >= 2
                ) {

                    seviye =
                        "Orta";
                }


                riskler.push({

                    personelId:
                        sonuc.personel
                            ?.personelId,

                    adSoyad:
                        sonuc.personel
                            ?.adSoyad,

                    departman:
                        sonuc.personel
                            ?.departman,

                    yas:
                        yas,

                    kalanYil:
                        kalanYil,

                    dbo:
                        dbo,

                    devamOlasiligi:
                        devam,

                    skor:
                        skor,

                    seviye:
                        seviye
                });
            }
        );


        return riskler.sort(
            (
                a,
                b
            ) =>
                b.skor -
                a.skor
        );
    }


    /* ============================================================
       12 — DUYARLILIK ANALİZİ
    ============================================================ */

    function duyarlilikAnalizi(
        personeller,
        varsayimlar,
        parametre,
        degisimler = [-0.02, -0.01, 0, 0.01, 0.02]
    ) {

        const engine =
            actuarialEngineAl();


        const temel =
            hesapla(
                personeller,
                varsayimlar
            );


        const senaryolar = [];


        degisimler.forEach(
            degisim => {

                const senaryo =
                    {
                        ...varsayimlar
                    };


                senaryo[parametre] =
                    sayi(
                        varsayimlar[
                            parametre
                        ]
                    ) +
                    degisim;


                let toplamDBO = 0;


                personeller.forEach(
                    personel => {

                        try {

                            toplamDBO +=
                                sayi(
                                    engine.hesapla(
                                        personel,
                                        senaryo
                                    ).muhasebe?.dbo
                                );

                        }

                        catch (
                            error
                        ) {

                            /*
                             * Hatalı personel
                             * sensitivity toplamını
                             * bozmaz.
                             */
                        }
                    }
                );


                const fark =
                    toplamDBO -
                    temel.ozet.toplamDBO;


                const farkOrani =
                    temel.ozet.toplamDBO !== 0
                        ? fark /
                          temel.ozet.toplamDBO
                        : 0;


                senaryolar.push({

                    parametre:
                        parametre,

                    degisim:
                        degisim,

                    degisimYuzde:
                        degisim * 100,

                    toplamDBO:
                        toplamDBO,

                    fark:
                        fark,

                    farkOrani:
                        farkOrani
                });
            }
        );


        return {

            temelDBO:
                temel.ozet.toplamDBO,

            parametre:
                parametre,

            senaryolar:
                senaryolar
        };
    }


    /* ============================================================
       13 — YÖNETİM ÖZETİ
    ============================================================ */

    function yonetimOzeti(
        portfoy
    ) {

        const ozet =
            portfoy.ozet;


        const riskler =
            riskAnalizi(
                portfoy.personeller
            );


        const kritik =
            riskler.filter(
                risk =>
                    risk.seviye ===
                    "Kritik"
            ).length;


        const yuksek =
            riskler.filter(
                risk =>
                    risk.seviye ===
                    "Yüksek"
            ).length;


        return {

            toplamDBO:
                ozet.toplamDBO,

            personelSayisi:
                ozet.personelSayisi,

            ortalamaYas:
                ozet.ortalamaYas,

            ortalamaHizmet:
                ozet.ortalamaHizmet,

            emekliligeOrtalamaKalanYil:
                ozet.ortalamaKalanYil,

            cariHizmetMaliyeti:
                ozet.toplamCariHizmetMaliyeti,

            faizMaliyeti:
                ozet.toplamFaizMaliyeti,

            toplamPnlMaliyeti:
                ozet.toplamCariHizmetMaliyeti +
                ozet.toplamFaizMaliyeti,

            kritikRiskSayisi:
                kritik,

            yuksekRiskSayisi:
                yuksek,

            tavanUygulananPersonel:
                ozet.tavanUygulananPersonel
        };
    }


    /* ============================================================
       14 — CFO KPI
    ============================================================ */

    function cfoKPI(
        portfoy
    ) {

        const ozet =
            portfoy.ozet;


        const toplamDBO =
            sayi(
                ozet.toplamDBO
            );


        const toplamMaas =
            sayi(
                ozet.toplamMevcutMaas
            );


        return {

            DBO:
                toplamDBO,

            DBO_MaasOrani:
                toplamMaas > 0
                    ? toplamDBO /
                      toplamMaas
                    : 0,

            CariHizmetMaliyeti:
                sayi(
                    ozet.toplamCariHizmetMaliyeti
                ),

            FaizMaliyeti:
                sayi(
                    ozet.toplamFaizMaliyeti
                ),

            ToplamPnLMaliyeti:
                sayi(
                    ozet.toplamCariHizmetMaliyeti
                ) +
                sayi(
                    ozet.toplamFaizMaliyeti
                ),

            PersonelSayisi:
                sayi(
                    ozet.personelSayisi
                ),

            DBO_Personel:
                sayi(
                    ozet.dboPerPersonel
                ),

            OrtalamaYas:
                sayi(
                    ozet.ortalamaYas
                ),

            OrtalamaHizmet:
                sayi(
                    ozet.ortalamaHizmet
                )
        };
    }


    /* ============================================================
       15 — TAM PORTFÖY ANALİZİ
    ============================================================ */

    function tamAnaliz(
        personeller,
        varsayimlar
    ) {

        const portfoy =
            hesapla(
                personeller,
                varsayimlar
            );


        return {

            engine:
                portfoy.engine,


            ozet:
                portfoy.ozet,


            pnl:
                portfoy.pnl,


            personeller:
                portfoy.personeller,


            hatalar:
                portfoy.hatalar,


            departman:
                departmanAnalizi(
                    portfoy.personeller
                ),


            yasGruplari:
                yasGrubuAnalizi(
                    portfoy.personeller
                ),


            hizmetGruplari:
                hizmetSuresiAnalizi(
                    portfoy.personeller
                ),


            yogunlasma:
                dboYogunlasmasi(
                    portfoy.personeller
                ),


            risk:
                riskAnalizi(
                    portfoy.personeller
                ),


            yonetim:
                yonetimOzeti(
                    portfoy
                ),


            cfo:
                cfoKPI(
                    portfoy
                )
        };
    }


    /* ============================================================
       16 — SAĞLIK KONTROLÜ
    ============================================================ */

    function healthCheck() {

        let actuarialStatus =
            false;


        try {

            actuarialStatus =
                !!actuarialEngineAl();

        }

        catch (
            error
        ) {

            actuarialStatus =
                false;
        }


        return {

            status:
                actuarialStatus
                    ? "OK"
                    : "ACTUARIAL_ENGINE_MISSING",

            engine:
                Portfolio.engineName,

            version:
                Portfolio.version,

            actuarialEngine:
                actuarialStatus,

            timestamp:
                new Date().toISOString()
        };
    }


    /* ============================================================
       17 — PUBLIC API
    ============================================================ */

    Portfolio.personelHesapla =
        personelHesapla;


    Portfolio.hesapla =
        hesapla;


    Portfolio.tamAnaliz =
        tamAnaliz;


    Portfolio.departmanAnalizi =
        departmanAnalizi;


    Portfolio.yasGrubuBelirle =
        yasGrubuBelirle;


    Portfolio.yasGrubuAnalizi =
        yasGrubuAnalizi;


    Portfolio.hizmetGrubuBelirle =
        hizmetGrubuBelirle;


    Portfolio.hizmetSuresiAnalizi =
        hizmetSuresiAnalizi;


    Portfolio.dboYogunlasmasi =
        dboYogunlasmasi;


    Portfolio.riskAnalizi =
        riskAnalizi;


    Portfolio.duyarlilikAnalizi =
        duyarlilikAnalizi;


    Portfolio.yonetimOzeti =
        yonetimOzeti;


    Portfolio.cfoKPI =
        cfoKPI;


    Portfolio.healthCheck =
        healthCheck;


    /* ============================================================
       18 — GLOBAL EXPORT
    ============================================================ */

    global.TMS19PortfolioEngine =
        Portfolio;


    /*
     * Eski erişim yapıları için alias.
     */

    if (
        !global.TMS19
    ) {

        global.TMS19 = {};
    }


    global.TMS19.PortfolioEngine =
        Portfolio;


})(typeof window !== "undefined"
    ? window
    : globalThis);

/* ================================================================
   GK TMS 19
   ACTUARIAL ENGINE COMPATIBILITY BRIDGE
   ----------------------------------------------------------------
   Eski Portfolio Engine:
       TMS19ActuarialEngine.calculate()

   Yeni Actuarial Engine:
       TMS19.portfoyDonemHesapla()

   Amaç:
   Eski dashboard contract'ını bozmadan yeni aktüeryal
   hesaplama motoruna geçiş yapmak.
================================================================ */

(function (global) {

    "use strict";


    if (
        !global.TMS19PortfolioEngine
    ) {

        console.error(
            "TMS19PortfolioEngine bulunamadı."
        );

        return;
    }


    /*
     * Yeni TMS19 namespace'i var mı?
     */

    if (
        !global.TMS19
    ) {

        console.warn(
            "TMS19 actuarial namespace henüz yüklenmemiş."
        );

        return;
    }


    /* ============================================================
       ACTUARIAL RESULT ADAPTER
    ============================================================ */

    function adaptPersonelResult(
        result
    ) {

        const period =
            result.period ||
            {};


        const muhasebe =
            result.muhasebe ||
            {};


        return {

            /*
             * Eski portfolio engine'in beklediği
             * düz alanlar
             */

            dbo:
                Number(
                    result.dbo ??
                    muhasebe.dbo ??
                    0
                ),


            currentServiceCost:
                Number(
                    result.cariHizmetMaliyeti ??
                    muhasebe.cariHizmetMaliyeti ??
                    period.currentServiceCost ??
                    0
                ),


            interestCost:
                Number(
                    result.faizMaliyeti ??
                    muhasebe.faizMaliyeti ??
                    period.interestCost ??
                    0
                ),


            actuarialGainLoss:
                Number(
                    period.actuarialGainLoss ??
                    0
                ),


            benefitPayments:
                Number(
                    period.benefitsPaid ??
                    0
                ),


            pastServiceCost:
                Number(
                    period.pastServiceCost ??
                    0
                ),


            openingDBO:
                Number(
                    period.openingDBO ??
                    0
                ),


            closingDBO:
                Number(
                    period.closingDBO ??
                    result.dbo ??
                    0
                ),


            /*
             * Yeni detaylı sonuç da kaybolmasın.
             */

            actuarialDetail:
                result
        };
    }


    /* ============================================================
       PORTFÖY ADAPTER
    ============================================================ */

    function calculate(
        employees,
        assumptions = {}
    ) {

        /*
         * Yeni motoru kullan.
         */

        const result =
            global.TMS19
                .portfoyDonemHesapla(
                    employees,
                    assumptions
                );


        const employeeResults =
            result.results
                .map(
                    adaptPersonelResult
                );


        const summary =
            result.summary ||
            {};


        /*
         * Portfolio Engine'in eski contract'ı.
         */

        const totals = {

            employees:
                employees.length,


            dbo:
                Number(
                    summary.closingDBO ??
                    0
                ),


            currentServiceCost:
                Number(
                    summary.currentServiceCost ??
                    0
                ),


            interestCost:
                Number(
                    summary.interestCost ??
                    0
                ),


            pastServiceCost:
                Number(
                    summary.pastServiceCost ??
                    0
                ),


            actuarialGainLoss:
                Number(
                    summary.actuarialGainLoss ??
                    0
                ),


            benefitPayments:
                Number(
                    summary.benefitsPaid ??
                    0
                ),


            openingDBO:
                Number(
                    summary.openingDBO ??
                    0
                ),


            closingDBO:
                Number(
                    summary.closingDBO ??
                    0
                )
        };


        /*
         * P&L
         */

        const profitLossEffect =
            totals.currentServiceCost +
            totals.interestCost +
            totals.pastServiceCost;


        /*
         * OCI
         */

        const ociEffect =
            totals.actuarialGainLoss;


        /*
         * Toplam defined benefit cost
         */

        const netDefinedBenefitCost =
            profitLossEffect +
            ociEffect;


        /*
         * Roll-forward
         */

        const rollForward = {

            openingDBO:
                totals.openingDBO,

            currentServiceCost:
                totals.currentServiceCost,

            interestCost:
                totals.interestCost,

            pastServiceCost:
                totals.pastServiceCost,

            actuarialGainLoss:
                totals.actuarialGainLoss,

            benefitPayments:
                totals.benefitPayments,

            closingDBO:
                totals.closingDBO,


            /*
             * Matematiksel kontrol
             */

            expectedClosingDBO:

                totals.openingDBO +

                totals.currentServiceCost +

                totals.interestCost +

                totals.pastServiceCost +

                totals.actuarialGainLoss -

                totals.benefitPayments,


            reconciliationDifference:

                totals.closingDBO -

                (
                    totals.openingDBO +

                    totals.currentServiceCost +

                    totals.interestCost +

                    totals.pastServiceCost +

                    totals.actuarialGainLoss -

                    totals.benefitPayments
                )
        };


        return {

            success:
                result.success,


            employeeResults:
                employeeResults,


            errors:
                result.errors || [],


            totals:
                totals,


            profitLossEffect:
                profitLossEffect,


            ociEffect:
                ociEffect,


            netDefinedBenefitCost:
                netDefinedBenefitCost,


            rollForward:
                rollForward,


            /*
             * Yeni engine'in detaylı çıktısı.
             */

            actuarialEngineResult:
                result
        };
    }


    /* ============================================================
       GLOBAL COMPATIBILITY
    ============================================================ */

    global.TMS19ActuarialEngine = {

        calculate,

        calculatePortfolio:
            calculate,


        calculateEmployee:
            function (
                employee,
                assumptions = {},
                index = 0
            ) {

                const result =
                    global.TMS19
                        .personelDonemHesapla(
                            employee,
                            assumptions,
                            index
                        );


                return adaptPersonelResult(
                    result
                );
            },


        healthCheck:
            function () {

                return global.TMS19
                    .periodicEngineHealthCheck();
            }
    };


})(window);

/* ================================================================
   GK TMS 19 — PUC PORTFOLIO INTEGRATION
   ----------------------------------------------------------------
   Portfolio Engine artık ana DBO kaynağı olarak:

       TMS19.portfoyPucHesapla()

   kullanır.

   Eski dashboard contract'ı korunur.
================================================================ */

(function (global) {

    "use strict";


    if (
        !global.TMS19
    ) {

        console.error(
            "TMS19 actuarial engine bulunamadı."
        );

        return;
    }


    if (
        !global.TMS19PortfolioEngine
    ) {

        console.error(
            "TMS19PortfolioEngine bulunamadı."
        );

        return;
    }


    /* ============================================================
       PERSONEL RESULT ADAPTER
    ============================================================ */

    function personelAdapter(
        result
    ) {

        const puc =
            result.puc ||
            {};


        const accounting =
            result.accounting ||
            {};


        const projection =
            result.emeklilik ||
            {};


        return {

            /*
             * Identity
             */

            personelId:
                result.personelId ||
                "",


            /*
             * Demographic
             */

            age:
                Number(
                    result.yas ??
                    0
                ),


            serviceYears:
                Number(
                    result.hizmetSuresi ??
                    0
                ),


            yearsToRetirement:
                Number(
                    result.kalanYil ??
                    0
                ),


            totalService:
                Number(
                    result.toplamHizmet ??
                    0
                ),


            /*
             * Valuation
             */

            dbo:
                Number(
                    puc.dbo ??
                    0
                ),


            accruedBenefit:
                Number(
                    puc.accruedBenefit ??
                    0
                ),


            futureServiceBenefit:
                Number(
                    puc.futureServiceBenefit ??
                    0
                ),


            allocationRatio:
                Number(
                    puc.allocationRatio ??
                    0
                ),


            survivalProbability:
                Number(
                    puc.survivalProbability ??
                    0
                ),


            discountFactor:
                Number(
                    puc.discountFactor ??
                    0
                ),


            /*
             * Projection
             */

            retirementSalary:
                Number(
                    projection.emeklilikMaasi ??
                    0
                ),


            retirementCeiling:
                Number(
                    projection.emeklilikTavani ??
                    0
                ),


            benefitSalary:
                Number(
                    projection.faydaMaasi ??
                    0
                ),


            totalProjectedBenefit:
                Number(
                    projection.toplamFayda ??
                    0
                ),


            /*
             * P&L
             */

            currentServiceCost:
                Number(
                    accounting.currentServiceCost ??
                    0
                ),


            interestCost:
                Number(
                    accounting.interestCost ??
                    0
                ),


            pastServiceCost:
                Number(
                    accounting.pastServiceCost ??
                    0
                ),


            profitLoss:
                Number(
                    accounting.profitLoss ??
                    0
                ),


            /*
             * Original actuarial result
             */

            actuarialResult:
                result
        };
    }


    /* ============================================================
       DEPARTMENT AGGREGATION
    ============================================================ */

    function aggregateByField(
        results,
        field
    ) {

        const groups =
            {};


        results.forEach(
            result => {

                const key =
                    result[field] ||
                    "Belirtilmemiş";


                if (
                    !groups[key]
                ) {

                    groups[key] = {

                        name:
                            key,

                        employeeCount:
                            0,

                        dbo:
                            0,

                        currentServiceCost:
                            0,

                        interestCost:
                            0,

                        profitLoss:
                            0
                    };
                }


                groups[key]
                    .employeeCount++;


                groups[key]
                    .dbo +=
                    result.dbo;


                groups[key]
                    .currentServiceCost +=
                    result.currentServiceCost;


                groups[key]
                    .interestCost +=
                    result.interestCost;


                groups[key]
                    .profitLoss +=
                    result.profitLoss;
            }
        );


        return Object.values(
            groups
        );
    }


    /* ============================================================
       RISK ANALYSIS
    ============================================================ */

    function calculateRisk(
        results,
        totals
    ) {

        const employeeCount =
            results.length;


        if (
            employeeCount === 0
        ) {

            return {

                level:
                    "LOW",

                score:
                    0,

                concentration:
                    0
            };
        }


        /*
         * DBO concentration
         */

        const sorted =
            [...results]
                .sort(
                    (
                        a,
                        b
                    ) =>
                        b.dbo -
                        a.dbo
                );


        const top10Count =
            Math.max(
                1,
                Math.ceil(
                    employeeCount *
                    0.10
                )
            );


        const top10DBO =
            sorted
                .slice(
                    0,
                    top10Count
                )
                .reduce(
                    (
                        sum,
                        item
                    ) =>
                        sum +
                        item.dbo,
                    0
                );


        const concentration =
            totals.dbo > 0
                ? top10DBO /
                  totals.dbo
                : 0;


        let score =
            0;


        if (
            concentration >=
            0.50
        ) {

            score +=
                50;

        }

        else if (
            concentration >=
            0.35
        ) {

            score +=
                30;

        }

        else if (
            concentration >=
            0.20
        ) {

            score +=
                15;
        }


        /*
         * Retirement concentration
         */

        const retirementNear =
            results.filter(
                item =>
                    item.yearsToRetirement <=
                    5
            ).length;


        const retirementRatio =
            retirementNear /
            employeeCount;


        if (
            retirementRatio >=
            0.30
        ) {

            score +=
                30;

        }

        else if (
            retirementRatio >=
            0.20
        ) {

            score +=
                20;

        }

        else if (
            retirementRatio >=
            0.10
        ) {

            score +=
                10;
        }


        /*
         * Long service concentration
         */

        const longService =
            results.filter(
                item =>
                    item.serviceYears >=
                    20
            ).length;


        const longServiceRatio =
            longService /
            employeeCount;


        if (
            longServiceRatio >=
            0.30
        ) {

            score +=
                20;

        }

        else if (
            longServiceRatio >=
            0.20
        ) {

            score +=
                10;
        }


        let level =
            "LOW";


        if (
            score >=
            60
        ) {

            level =
                "HIGH";

        }

        else if (
            score >=
            30
        ) {

            level =
                "MEDIUM";
        }


        return {

            level:
                level,

            score:
                score,

            concentration:
                concentration,

            retirementWithin5Years:
                retirementRatio,

            longServiceRatio:
                longServiceRatio
        };
    }


    /* ============================================================
       MAIN PUC ANALYSIS
    ============================================================ */

    function analyzePUC(
        employees,
        assumptions = {}
    ) {

        if (
            !Array.isArray(
                employees
            )
        ) {

            throw new Error(
                "employees array olmalıdır."
            );
        }


        /*
         * ANA MOTOR
         */

        const puc =
            global.TMS19
                .portfoyPucHesapla(
                    employees,
                    assumptions
                );


        const results =
            puc.results.map(
                personelAdapter
            );


        const totals = {

            employeeCount:
                results.length,


            dbo:
                results.reduce(
                    (
                        sum,
                        item
                    ) =>
                        sum +
                        item.dbo,
                    0
                ),


            accruedBenefit:
                results.reduce(
                    (
                        sum,
                        item
                    ) =>
                        sum +
                        item.accruedBenefit,
                    0
                ),


            futureServiceBenefit:
                results.reduce(
                    (
                        sum,
                        item
                    ) =>
                        sum +
                        item.futureServiceBenefit,
                    0
                ),


            currentServiceCost:
                results.reduce(
                    (
                        sum,
                        item
                    ) =>
                        sum +
                        item.currentServiceCost,
                    0
                ),


            interestCost:
                results.reduce(
                    (
                        sum,
                        item
                    ) =>
                        sum +
                        item.interestCost,
                    0
                ),


            pastServiceCost:
                results.reduce(
                    (
                        sum,
                        item
                    ) =>
                        sum +
                        item.pastServiceCost,
                    0
                ),


            profitLoss:
                results.reduce(
                    (
                        sum,
                        item
                    ) =>
                        sum +
                        item.profitLoss,
                    0
                )
        };


        /*
         * PLAN ASSETS
         */

        const planAssets =
            employees.reduce(
                (
                    sum,
                    employee
                ) => {

                    return (
                        sum +
                        Math.max(
                            0,
                            Number(
                                employee.planAssets ??
                                employee.planVarliklari ??
                                0
                            )
                        )
                    );

                },
                0
            );


        totals.planAssets =
            planAssets;


        /*
         * NET POSITION
         */

        totals.netDefinedBenefitPosition =
            totals.dbo -
            totals.planAssets;


        totals.netDefinedBenefitLiability =
            Math.max(
                0,
                totals.netDefinedBenefitPosition
            );


        totals.netDefinedBenefitAsset =
            Math.max(
                0,
                -totals.netDefinedBenefitPosition
            );


        /*
         * RISK
         */

        const risk =
            calculateRisk(
                results,
                totals
            );


        /*
         * DEPARTMENT
         */

        const byDepartment =
            aggregateByField(
                results,
                "department"
            );


        /*
         * AGE BUCKET
         */

        const ageBuckets =
            {

                "30 Altı": [],
                "30-39": [],
                "40-49": [],
                "50-59": [],
                "60+": []
            };


        results.forEach(
            item => {

                if (
                    item.age < 30
                ) {

                    ageBuckets[
                        "30 Altı"
                    ].push(
                        item
                    );

                }

                else if (
                    item.age < 40
                ) {

                    ageBuckets[
                        "30-39"
                    ].push(
                        item
                    );

                }

                else if (
                    item.age < 50
                ) {

                    ageBuckets[
                        "40-49"
                    ].push(
                        item
                    );

                }

                else if (
                    item.age < 60
                ) {

                    ageBuckets[
                        "50-59"
                    ].push(
                        item
                    );

                }

                else {

                    ageBuckets[
                        "60+"
                    ].push(
                        item
                    );
                }
            }
        );


        const byAge =
            Object.keys(
                ageBuckets
            ).map(
                bucket => {

                    const group =
                        ageBuckets[
                            bucket
                        ];


                    return {

                        bucket:
                            bucket,

                        employeeCount:
                            group.length,

                        dbo:
                            group.reduce(
                                (
                                    sum,
                                    item
                                ) =>
                                    sum +
                                    item.dbo,
                                0
                            )
                    };
                }
            );


        /*
         * RETIREMENT ANALYSIS
         */

        const retirement =
            {

                within1Year:
                    results.filter(
                        item =>
                            item.yearsToRetirement <=
                            1
                    ).length,

                within3Years:
                    results.filter(
                        item =>
                            item.yearsToRetirement <=
                            3
                    ).length,

                within5Years:
                    results.filter(
                        item =>
                            item.yearsToRetirement <=
                            5
                    ).length,

                within10Years:
                    results.filter(
                        item =>
                            item.yearsToRetirement <=
                            10
                    ).length
            };


        /*
         * TOP DBO
         */

        const topEmployees =
            [...results]
                .sort(
                    (
                        a,
                        b
                    ) =>
                        b.dbo -
                        a.dbo
                )
                .slice(
                    0,
                    10
                );


        return {

            success:
                puc.success,


            results:
                results,


            errors:
                puc.errors || [],


            totals:
                totals,


            risk:
                risk,


            byDepartment:
                byDepartment,


            byAge:
                byAge,


            retirement:
                retirement,


            topEmployees:
                topEmployees,


            actuarialEngineResult:
                puc
        };
    }


    /* ============================================================
       PUBLIC API
    ============================================================ */

    global.TMS19PortfolioEngine =
        {

            /*
             * Yeni ana motor
             */

            analyzePUC:


                analyzePUC,


            /*
             * Dashboard compatibility
             */

            analyze:


                analyzePUC,


            calculate:


                analyzePUC,


            healthCheck:
                function () {

                    return global.TMS19
                        .pucEngineHealthCheck();

                }
        };


})(window);
