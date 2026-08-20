/* ============================================================
   GK ADVISORY
   TMS 19 ACTUARIAL ENGINE V3
   Türkiye Kıdem Tazminatı / Tanımlanmış Fayda Aktüeryal Motoru

   METODOLOJİ
   ------------------------------------------------------------
   • Projected Unit Credit Method (PUC)
   • Personel bazlı değerleme
   • Gelecekteki maaş projeksiyonu
   • Kıdem tazminatı tavanı
   • Personel devir olasılığı
   • Emeklilik olasılığı
   • Ölüm olasılığı
   • Fayda alma olasılığı
   • İskonto
   • DBO
   • Cari hizmet maliyeti
   • Net faiz maliyeti
   • Aktüeryal duyarlılık
   • Veri kalite kontrolü
   • CFO / Finance Director içgörüleri

   ÖNEMLİ
   ------------------------------------------------------------
   Bu model analitik / eğitim / karar destek amacı taşır.
   Gerçek aktüeryal değerleme için seçilen aktüeryal varsayımlar,
   mevzuat, kıdem tazminatı tavanı, aktüeryal tablo ve şirket
   geçmiş verileri ayrıca doğrulanmalıdır.
============================================================ */


/* ============================================================
   ANA MOTOR
============================================================ */

const TMS19 = (() => {

    /* ========================================================
       1. GENEL SABİTLER
    ======================================================== */

    const SABİTLER = {

        DEFAULT_İSKONTO_ORANI: 0.28,

        DEFAULT_MAAŞ_ARTIŞ_ORANI: 0.25,

        DEFAULT_TURNOVER_ORANI: 0.08,

        DEFAULT_EMEKLİLİK_YAŞI: 60,

        DEFAULT_KIDEM_TAVANI: 50000,

        DEFAULT_KIDEM_KATSAYISI: 1,

        MAX_PROJEKSİYON_YILI: 50,

        MIN_İSKONTO_ORANI: 0.0001,

        MAX_İSKONTO_ORANI: 1,

        MIN_MAAŞ_ARTIŞI: -0.50,

        MAX_MAAŞ_ARTIŞI: 2,

        MIN_TURNOVER: 0,

        MAX_TURNOVER: 0.90

    };


    /* ========================================================
       2. GENEL YARDIMCI FONKSİYONLAR
    ======================================================== */

    function güvenliSayı(değer, varsayılan = 0) {

        const sayı = Number(değer);

        return Number.isFinite(sayı)
            ? sayı
            : varsayılan;

    }


    function sınırla(değer, minimum, maksimum) {

        return Math.min(
            Math.max(
                güvenliSayı(değer),
                minimum
            ),
            maksimum
        );

    }


    function yuvarla(değer, basamak = 2) {

        const katsayı = Math.pow(10, basamak);

        return Math.round(
            güvenliSayı(değer) * katsayı
        ) / katsayı;

    }


    function yüzde(değer) {

        return güvenliSayı(değer) / 100;

    }


    function formatPara(değer) {

        return güvenliSayı(değer).toLocaleString(
            "tr-TR",
            {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }
        );

    }


    /* ========================================================
       3. TARİH FONKSİYONLARI
    ======================================================== */

    function tarihOku(değer) {

        if (!değer) {
            return null;
        }

        const tarih = new Date(değer);

        if (Number.isNaN(tarih.getTime())) {
            return null;
        }

        return tarih;

    }


    function yaşHesapla(doğumTarihi, değerlemeTarihi) {

        const doğum = tarihOku(doğumTarihi);

        const değerleme = tarihOku(değerlemeTarihi);

        if (!doğum || !değerleme) {
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

        return Math.max(0, yaş);

    }


    function hizmetSüresiHesapla(
        işeGirişTarihi,
        değerlemeTarihi
    ) {

        const giriş = tarihOku(
            işeGirişTarihi
        );

        const değerleme = tarihOku(
            değerlemeTarihi
        );

        if (!giriş || !değerleme) {
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
       4. MORTALİTE MODELİ
    ======================================================== */

    /*
       Bu oranlar örnek aktüeryal varsayımlardır.

       Gerçek modelde seçilen mortalite tablosu
       buraya parametre olarak alınmalıdır.
    */

    function ölümOlasılığı(
        yaş,
        cinsiyet = "E"
    ) {

        yaş = güvenliSayı(
            yaş,
            40
        );

        cinsiyet =
            String(cinsiyet)
                .toUpperCase();

        let oran;

        if (yaş < 25) {

            oran = 0.0005;

        } else if (yaş < 35) {

            oran =
                cinsiyet === "K"
                    ? 0.0010
                    : 0.0015;

        } else if (yaş < 45) {

            oran =
                cinsiyet === "K"
                    ? 0.0018
                    : 0.0025;

        } else if (yaş < 55) {

            oran =
                cinsiyet === "K"
                    ? 0.0035
                    : 0.0050;

        } else if (yaş < 60) {

            oran =
                cinsiyet === "K"
                    ? 0.0055
                    : 0.0080;

        } else if (yaş < 65) {

            oran =
                cinsiyet === "K"
                    ? 0.0080
                    : 0.0120;

        } else if (yaş < 70) {

            oran =
                cinsiyet === "K"
                    ? 0.0120
                    : 0.0180;

        } else if (yaş < 75) {

            oran =
                cinsiyet === "K"
                    ? 0.0200
                    : 0.0300;

        } else if (yaş < 80) {

            oran =
                cinsiyet === "K"
                    ? 0.0450
                    : 0.0600;

        } else {

            oran =
                cinsiyet === "K"
                    ? 0.0900
                    : 0.1200;

        }

        return sınırla(
            oran,
            0,
            0.99
        );

    }


    /* ========================================================
       5. PERSONEL DEVİR MODELİ
    ======================================================== */

    function devirOlasılığı(
        yaş,
        temelOran
    ) {

        yaş = güvenliSayı(
            yaş,
            40
        );

        temelOran = sınırla(
            güvenliSayı(
                temelOran,
                SABİTLER.DEFAULT_TURNOVER_ORANI
            ),
            SABİTLER.MIN_TURNOVER,
            SABİTLER.MAX_TURNOVER
        );

        let düzeltme;

        if (yaş < 25) {

            düzeltme = 1.50;

        } else if (yaş < 30) {

            düzeltme = 1.35;

        } else if (yaş < 40) {

            düzeltme = 1.10;

        } else if (yaş < 50) {

            düzeltme = 0.85;

        } else if (yaş < 55) {

            düzeltme = 0.60;

        } else if (yaş < 60) {

            düzeltme = 0.35;

        } else {

            düzeltme = 0.15;

        }

        return sınırla(
            temelOran * düzeltme,
            0,
            0.80
        );

    }


    /* ========================================================
       6. EMEKLİLİK MODELİ
    ======================================================== */

    function emeklilikOlasılığı(
        yaş,
        emeklilikYaşı
    ) {

        yaş = güvenliSayı(
            yaş,
            40
        );

        emeklilikYaşı = güvenliSayı(
            emeklilikYaşı,
            SABİTLER.DEFAULT_EMEKLİLİK_YAŞI
        );

        if (yaş < emeklilikYaşı - 2) {

            return 0;

        }

        if (yaş === emeklilikYaşı - 2) {

            return 0.50;

        }

        if (yaş === emeklilikYaşı - 1) {

            return 0.90;

        }

        if (yaş >= emeklilikYaşı) {

            return 1;

        }

        return 0;

    }


    /* ========================================================
       7. HAYATTA KALMA / HAK KAZANMA OLASILIĞI
    ======================================================== */

    function faydaAlmaOlasılığı(
        başlangıçYaşı,
        yıl,
        personel,
        varsayımlar
    ) {

        let olasılık = 1;

        const cinsiyet =
            personel.cinsiyet
            ||
            personel.Cinsiyet
            ||
            "E";

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
                    varsayımlar.personelDevirOranı
                );

            const emeklilik =
                emeklilikOlasılığı(
                    yaş,
                    varsayımlar.emeklilikYaşı
                );

            /*
               Emeklilik veya şirketten ayrılma
               durumuna ilişkin hak kazanma varsayımı.

               İstenirse personel bazında override edilebilir.
            */

            let hakKazanma;

            if (emeklilik > 0) {

                hakKazanma =
                    varsayımlar.emeklilikHakKazanmaOranı;

            } else {

                hakKazanma =
                    varsayımlar.ayrılmaHakKazanmaOranı;

            }

            const devam =
                (
                    1 - ölüm
                )
                *
                (
                    1 - turnover
            );

            olasılık *=
                devam;

            /*
               Emeklilik yılında faydanın gerçekleşme
               olasılığı ayrıca dikkate alınır.
            */

            if (emeklilik > 0) {

                olasılık *=
                    Math.max(
                        0,
                        hakKazanma
                    );

            }

        }

        return sınırla(
            olasılık,
            0,
            1
        );

    }


    /* ========================================================
       8. MAAŞ PROJEKSİYONU
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
                1 + maaşArtışOranı,
                yıl
            )
        );

    }


    /* ========================================================
       9. KIDEME ESAS ÜCRET
    ======================================================== */

    function kıdemeEsasÜcret(
        maaş,
        tavan,
        katsayı = 1
    ) {

        maaş =
            Math.max(
                0,
                güvenliSayı(
                    maaş
                )
            );

        tavan =
            Math.max(
                0,
                güvenliSayı(
                    tavan
                )
            );

        katsayı =
            Math.max(
                0,
                güvenliSayı(
                    katsayı,
                    SABİTLER.DEFAULT_KIDEM_KATSAYISI
                )
            );

        /*
           Kıdem tazminatında ücret,
           ilgili tavan ile sınırlandırılır.
        */

        const esas =
            Math.min(
                maaş,
                tavan
            );

        return {

            brütÜcret:
                maaş,

            kıdemTavanı:
                tavan,

            kıdemeEsasÜcret:
                esas,

            tavanAşımı:
                Math.max(
                    0,
                    maaş - tavan
                ),

            katsayı

        };

    }


    /* ========================================================
       10. KIDEM TAZMİNATI HESABI
    ======================================================== */

    function kıdemTazminatıHesapla(
        maaş,
        toplamHizmet,
        varsayımlar
    ) {

        const ücret =
            kıdemeEsasÜcret(
                maaş,
                varsayımlar.kıdemTazminatıTavanı,
                varsayımlar.kıdemKatsayısı
            );

        const brütKıdem =
            ücret.kıdemeEsasÜcret
            *
            Math.max(
                0,
                toplamHizmet
            )
            *
            ücret.katsayı;

        return {

            ...ücret,

            toplamHizmet,

            brütKıdemTazminatı:
                brütKıdem

        };

    }


    /* ========================================================
       11. İSKONTO FAKTÖRÜ
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
                SABİTLER.MIN_İSKONTO_ORANI,
                SABİTLER.MAX_İSKONTO_ORANI
            );

        return (
            1 /
            Math.pow(
                1 + oran,
                Math.max(
                    0,
                    yıl
                )
            )
        );

    }


    /* ========================================================
       12. PERSONEL VERİSİ NORMALİZASYONU
    ======================================================== */

    function personelNormalizeEt(
        hamPersonel,
        varsayımlar
    ) {

        const mevcutMaaş =
            güvenliSayı(
                hamPersonel.mevcutMaaş
                ??
                hamPersonel.mevcutMaas
                ??
                hamPersonel.brütMaaş
                ??
                hamPersonel.brutMaas
                ??
                hamPersonel.Maaş
                ??
                hamPersonel.Maas,
                0
            );

        let yaş =
            hamPersonel.yaş
            ??
            hamPersonel.yas;

        if (
            yaş === undefined
            ||
            yaş === null
        ) {

            yaş =
                yaşHesapla(
                    hamPersonel.doğumTarihi
                    ??
                    hamPersonel.dogumTarihi,
                    varsayımlar.değerlemeTarihi
                );

        }

        yaş =
            güvenliSayı(
                yaş,
                40
            );

        let hizmet =
            hamPersonel.hizmetSüresi
            ??
            hamPersonel.hizmetSuresi;

        if (
            hizmet === undefined
            ||
            hizmet === null
        ) {

            hizmet =
                hizmetSüresiHesapla(
                    hamPersonel.işeGirişTarihi
                    ??
                    hamPersonel.iseGirisTarihi,
                    varsayımlar.değerlemeTarihi
                );

        }

        hizmet =
            güvenliSayı(
                hizmet,
                0
            );

        const emeklilikYaşı =
            güvenliSayı(
                hamPersonel.emeklilikYaşı
                ??
                hamPersonel.emeklilikYasi
                ??
                varsayımlar.emeklilikYaşı,
                SABİTLER.DEFAULT_EMEKLİLİK_YAŞI
            );

        return {

            ...hamPersonel,

            mevcutMaaş,

            yaş,

            hizmetSüresi:
                hizmet,

            emeklilikYaşı,

            cinsiyet:
                hamPersonel.cinsiyet
                ??
                hamPersonel.Cinsiyet
                ??
                "E"

        };

    }


    /* ========================================================
       13. PERSONEL BAZLI AKTÜERYAL PROJEKSİYON
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

        const başlangıçYaşı =
            personel.yaş;

        const mevcutHizmet =
            personel.hizmetSüresi;

        const emeklilikYaşı =
            personel.emeklilikYaşı;

        /*
           Emeklilik yaşına kadar projeksiyon.
        */

        const kalanYıl =
            Math.max(
                1,
                Math.ceil(
                    emeklilikYaşı
                    -
                    başlangıçYaşı
                )
            );

        const maksimumYıl =
            Math.min(
                SABİTLER.MAKS_PROJEKSİYON_YILI,
                kalanYıl
            );

        const yıllık = [];

        let kapanışDBO = 0;

        let toplamCariHizmet = 0;

        let toplamFaiz = 0;

        let toplamBeklenenFayda = 0;

        let toplamBugünküDeğer = 0;

        let öncekiDBO = 0;


        /* ----------------------------------------------------
           YIL BAZLI PROJEKSİYON
        ---------------------------------------------------- */

        for (
            let yıl = 1;
            yıl <= maksimumYıl;
            yıl++
        ) {

            const gelecekYaş =
                başlangıçYaşı
                +
                yıl;

            const gelecekHizmet =
                mevcutHizmet
                +
                yıl;

            const gelecektekiMaaş =
                gelecektekiMaaşFonksiyonu(
                    personel.mevcutMaaş,
                    yıl,
                    varsayımlar.maaşArtışOranı
                );

            const kıdem =
                kıdemTazminatıHesapla(
                    gelecektekiMaaş,
                    gelecekHizmet,
                    varsayımlar
                );

            const ölüm =
                ölümOlasılığı(
                    gelecekYaş,
                    personel.cinsiyet
                );

            const turnover =
                devirOlasılığı(
                    gelecekYaş,
                    varsayımlar.personelDevirOranı
                );

            const emeklilik =
                emeklilikOlasılığı(
                    gelecekYaş,
                    emeklilikYaşı
                );

            const faydaOlasılığı =
                faydaAlmaOlasılığı(
                    başlangıçYaşı,
                    yıl,
                    personel,
                    varsayımlar
                );

            const beklenenFayda =
                kıdem.brütKıdemTazminatı
                *
                faydaOlasılığı;

            const iskonto =
                iskontoFaktörü(
                    varsayımlar.iskontoOranı,
                    yıl
                );

            const bugünküDeğer =
                beklenenFayda
                *
                iskonto;


            /* ------------------------------------------------
               PUC ATTRIBUTION
            ------------------------------------------------ */

            const toplamHizmet =
                Math.max(
                    gelecekHizmet,
                    0.0001
                );

            /*
               PUC yaklaşımı:
               Toplam beklenen fayda,
               hizmet dönemlerine sistematik olarak dağıtılır.
            */

            const yıllıkBirimFayda =
                beklenenFayda
                /
                toplamHizmet;

            const geçmişHizmeteAtfedilen =
                yıllıkBirimFayda
                *
                mevcutHizmet;

            const yılDBO =
                geçmişHizmeteAtfedilen
                *
                iskonto;

            const cariHizmetMaliyeti =
                yıllıkBirimFayda
                *
                iskonto;

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

                maaş:
                    gelecektekiMaaş,

                kıdemTavanı:
                    kıdem.kıdemTavanı,

                kıdemeEsasÜcret:
                    kıdem.kıdemeEsasÜcret,

                tavanAşımı:
                    kıdem.tavanAşımı,

                brütKıdemTazminatı:
                    kıdem.brütKıdemTazminatı,

                ölümOlasılığı:
                    ölüm,

                turnoverOlasılığı:
                    turnover,

                emeklilikOlasılığı:
                    emeklilik,

                faydaOlasılığı,

                beklenenFayda,

                iskontoFaktörü:
                    iskonto,

                bugünküDeğer,

                PUC:
                    yıllıkBirimFayda,

                geçmişHizmeteAtfedilen,

                DBO:
                    yılDBO,

                cariHizmetMaliyeti,

                faizMaliyeti

            });


            öncekiDBO =
                yılDBO;

            kapanışDBO =
                yılDBO;

            toplamCariHizmet +=
                cariHizmetMaliyeti;

            toplamFaiz +=
                faizMaliyeti;

            toplamBeklenenFayda +=
                beklenenFayda;

            toplamBugünküDeğer +=
                bugünküDeğer;

        }


        /* ----------------------------------------------------
           BUGÜNKÜ DÖNEM KAPANIŞ DEĞERİ
        ---------------------------------------------------- */

        const mevcutKıdem =
            kıdemTazminatıHesapla(
                personel.mevcutMaaş,
                mevcutHizmet,
                varsayımlar
            );


        /*
           PUC yaklaşımında mevcut hizmet süresine
           ilişkin yükümlülük, gelecekteki faydanın
           bugünkü değerinin hizmete atfedilen kısmıdır.
        */

        let mevcutDBO = 0;

        if (
            yıllık.length > 0
        ) {

            mevcutDBO =
                yıllık[0].DBO;

        }


        /*
           Eğer personel emeklilik yaşına çok yakınsa
           modelin stabil kalması için mevcut kıdem
           bilgisi ayrıca tutulur.
        */

        const sonuç = {

            personel,

            mevcutKıdem,

            yıllık,

            kapanışDBO:

                mevcutDBO,

            gelecektekiToplamDBO:

                kapanışDBO,

            cariHizmetMaliyeti:

                toplamCariHizmet,

            faizMaliyeti:

                toplamFaiz,

            toplamBeklenenFayda,

            toplamBugünküDeğer,

            emekliliğeKalanYıl:

                Math.max(
                    0,
                    emeklilikYaşı
                    -
                    personel.yaş
                )

        };

        return sonuç;

    }


    /* ========================================================
       14. MAAŞ PROJEKSİYON WRAPPER
    ======================================================== */

    function gelecektekiMaaşFonksiyonu(
        mevcutMaaş,
        yıl,
        maaşArtışOranı
    ) {

        return gelecektekiMaaş(
            mevcutMaaş,
            yıl,
            maaşArtışOranı
        );

    }


    /* ========================================================
       15. TOPLU DEĞERLEME
    ======================================================== */

    function değerle(
        personelListesi,
        varsayımlar
    ) {

        const sonuçlar = [];

        let toplamDBO = 0;

        let toplamCariHizmet = 0;

        let toplamFaiz = 0;

        let toplamBeklenenFayda = 0;

        let toplamBugünküDeğer = 0;

        let toplamMevcutKıdem = 0;

        let toplamTavanAşımı = 0;


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

                toplamBugünküDeğer +=
                    sonuç.toplamBugünküDeğer;

                toplamMevcutKıdem +=
                    sonuç.mevcutKıdem.brütKıdemTazminatı;

                toplamTavanAşımı +=
                    sonuç.mevcutKıdem.tavanAşımı;

            }
        );


        return {

            personelSonuçları:
                sonuçlar,

            toplamDBO,

            toplamCariHizmet,

            toplamFaiz,

            toplamBeklenenFayda,

            toplamBugünküDeğer,

            toplamMevcutKıdem,

            toplamTavanAşımı

        };

    }


    /* ========================================================
       16. DBO KÖPRÜSÜ
    ======================================================== */

    function dboKöprüsü(
        değerleme,
        açılışDBO = 0,
        ödemeler = 0,
        aktüeryalKazançKayıp = 0
    ) {

        const kapanış =
            değerleme.toplamDBO;

        return [

            {

                açıklama:
                    "Açılış DBO",

                tutar:
                    açılışDBO,

                tür:
                    "base"

            },

            {

                açıklama:
                    "Cari Hizmet Maliyeti",

                tutar:
                    değerleme.toplamCariHizmet,

                tür:
                    "pnl"

            },

            {

                açıklama:
                    "Net Faiz Maliyeti",

                tutar:
                    değerleme.toplamFaiz,

                tür:
                    "pnl"

            },

            {

                açıklama:
                    "Aktüeryal Kazanç / Kayıp",

                tutar:
                    aktüeryalKazançKayıp,

                tür:
                    "oci"

            },

            {

                açıklama:
                    "Fayda Ödemeleri",

                tutar:
                    -Math.abs(
                        güvenliSayı(
                            ödemeler
                        )
                    ),

                tür:
                    "cash"

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
       17. YILLIK PROJEKSİYON
    ======================================================== */

    function yıllıkProjeksiyon(
        personelSonuçları
    ) {

        const harita = {};


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
                                    0,

                                toplamBrütKıdem:
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
                            dönem.beklenenFayda;

                        hedef.toplamBugünküDeğer +=
                            dönem.bugünküDeğer;

                        hedef.toplamBrütKıdem +=
                            dönem.brütKıdemTazminatı;

                    }
                );

            }
        );


        return Object.values(
            harita
        ).sort(
            (
                a,
                b
            ) =>
                a.yıl - b.yıl
        );

    }


    /* ========================================================
       18. DUYARLILIK ANALİZİ
    ======================================================== */

    function duyarlılıkHesapla(
        personel,
        varsayımlar
    ) {

        const baz =
            değerle(
                personel,
                varsayımlar
            );

        const bazDBO =
            baz.toplamDBO;


        function senaryo(
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
                    sınırla(
                        varsayımlar.iskontoOranı
                        +
                        değişim,
                        SABİTLER.MIN_İSKONTO_ORANI,
                        SABİTLER.MAX_İSKONTO_ORANI
                    );

            }


            if (
                alan ===
                "maaş"
            ) {

                yeni.maaşArtışOranı =
                    sınırla(
                        varsayımlar.maaşArtışOranı
                        +
                        değişim,
                        SABİTLER.MIN_MAAŞ_ARTIŞI,
                        SABİTLER.MAX_MAAŞ_ARTIŞI
                    );

            }


            if (
                alan ===
                "turnover"
            ) {

                yeni.personelDevirOranı =
                    sınırla(
                        varsayımlar.personelDevirOranı
                        +
                        değişim,
                        SABİTLER.MIN_TURNOVER,
                        SABİTLER.MAX_TURNOVER
                    );

            }


            if (
                alan ===
                "tavan"
            ) {

                yeni.kıdemTazminatıTavanı =
                    Math.max(
                        0,
                        varsayımlar.kıdemTazminatıTavanı
                        *
                        (
                            1 +
                            değişim
                        )
                    );

            }


            const sonuç =
                değerle(
                    personel,
                    yeni
                );


            const fark =
                sonuç.toplamDBO
                -
                bazDBO;


            return {

                DBO:
                    sonuç.toplamDBO,

                fark,

                farkYüzdesi:
                    bazDBO !== 0
                        ? fark /
                          bazDBO
                        : 0

            };

        }


        return {

            iskontoOranı: {

                eksi100bp:
                    senaryo(
                        "iskonto",
                        -0.01
                    ),

                baz:
                    {
                        DBO:
                            bazDBO,

                        fark:
                            0,

                        farkYüzdesi:
                            0
                    },

                artı100bp:
                    senaryo(
                        "iskonto",
                        0.01
                    )

            },


            maaşArtışı: {

                eksi100bp:
                    senaryo(
                        "maaş",
                        -0.01
                    ),

                baz:
                    {
                        DBO:
                            bazDBO,

                        fark:
                            0,

                        farkYüzdesi:
                            0
                    },

                artı100bp:
                    senaryo(
                        "maaş",
                        0.01
                    )

            },


            turnover: {

                eksi100bp:
                    senaryo(
                        "turnover",
                        -0.01
                    ),

                baz:
                    {
                        DBO:
                            bazDBO,

                        fark:
                            0,

                        farkYüzdesi:
                            0
                    },

                artı100bp:
                    senaryo(
                        "turnover",
                        0.01
                    )

            },


            kıdemTavanı: {

                eksi10:
                    senaryo(
                        "tavan",
                        -0.10
                    ),

                baz:
                    {
                        DBO:
                            bazDBO,

                        fark:
                            0,

                        farkYüzdesi:
                            0
                    },

                artı10:
                    senaryo(
                        "tavan",
                        0.10
                    )

            }

        };

    }


    /* ========================================================
       19. VERİ KALİTESİ
    ======================================================== */

    function veriKalitesi(
        personel,
        varsayımlar
    ) {

        let skor = 100;

        const hatalar = [];

        const uyarılar = [];


        if (
            !Array.isArray(
                personel
            )
            ||
            personel.length === 0
        ) {

            return {

                kaliteSkoru:
                    0,

                seviye:
                    "veri yok",

                toplamHata:
                    1,

                toplamUyarı:
                    0,

                hatalar:
                    [
                        "Personel verisi bulunamadı."
                    ],

                uyarılar:
                    []

            };

        }


        personel.forEach(
            (
                p,
                index
            ) => {

                const sıra =
                    index + 1;


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
                        ??
                        p.brütMaaş
                        ??
                        p.brutMaas,
                        0
                    );


                if (!doğum) {

                    skor -= 5;

                    hatalar.push(
                        `Personel ${sıra}: doğum tarihi bulunamadı.`
                    );

                }


                if (!giriş) {

                    skor -= 5;

                    hatalar.push(
                        `Personel ${sıra}: işe giriş tarihi bulunamadı.`
                    );

                }


                if (
                    maaş <= 0
                ) {

                    skor -= 10;

                    hatalar.push(
                        `Personel ${sıra}: geçerli brüt maaş bulunamadı.`
                    );

                }


                if (
                    doğum
                    &&
                    giriş
                    &&
                    giriş < doğum
                ) {

                    skor -= 15;

                    hatalar.push(
                        `Personel ${sıra}: işe giriş tarihi doğum tarihinden önce.`
                    );

                }

            }
        );


        if (
            varsayımlar.iskontoOranı <= 0
        ) {

            skor -= 15;

            hatalar.push(
                "İskonto oranı geçerli değil."
            );

        }


        if (
            varsayımlar.maaşArtışOranı >
            1
        ) {

            skor -= 10;

            uyarılar.push(
                "Maaş artış varsayımı %100'ün üzerindedir."
            );

        }


        if (
            varsayımlar.kıdemTazminatıTavanı <= 0
        ) {

            skor -= 15;

            hatalar.push(
                "Kıdem tazminatı tavanı geçerli değil."
            );

        }


        if (
            varsayımlar.emeklilikYaşı < 45
            ||
            varsayımlar.emeklilikYaşı > 75
        ) {

            skor -= 5;

            uyarılar.push(
                "Emeklilik yaşı olağandışı bir seviyededir."
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
                "Çok İyi";

        } else if (
            skor >= 75
        ) {

            seviye =
                "İyi";

        } else if (
            skor >= 60
        ) {

            seviye =
                "Orta";

        } else {

            seviye =
                "Zayıf";

        }


        return {

            kaliteSkoru:
                skor,

            seviye,

            toplamHata:
                hatalar.length,

            toplamUyarı:
                uyarılar.length,

            hatalar,

            uyarılar

        };

    }


    /* ========================================================
       20. RİSK ANALİZİ
    ======================================================== */

    function riskAnalizi(
        personel,
        varsayımlar,
        sensitivity
    ) {

        const riskler = [];


        function enYüksekEtki(
            alan
        ) {

            const değerler =
                Object.values(
                    sensitivity[
                        alan
                    ]
                )
                .map(
                    x =>
                        Math.abs(
                            x.farkYüzdesi
                            ??
                            0
                        )
                );

            return Math.max(
                ...değerler
            );

        }


        const iskontoEtki =
            enYüksekEtki(
                "iskontoOranı"
            );


        const maaşEtki =
            enYüksekEtki(
                "maaşArtışı"
            );


        const turnoverEtki =
            enYüksekEtki(
                "turnover"
            );


        const tavanEtki =
            enYüksekEtki(
                "kıdemTavanı"
            );


        if (
            iskontoEtki >= 0.10
        ) {

            riskler.push({

                alan:
                    "İskonto Oranı",

                seviye:
                    "Yüksek",

                etki:
                    iskontoEtki,

                açıklama:
                    "DBO iskonto oranındaki değişimlere yüksek hassasiyet göstermektedir."

            });

        } else if (
            iskontoEtki >= 0.05
        ) {

            riskler.push({

                alan:
                    "İskonto Oranı",

                seviye:
                    "Orta",

                etki:
                    iskontoEtki,

                açıklama:
                    "İskonto oranı DBO açısından önemli bir aktüeryal varsayımdır."

            });

        }


        if (
            maaşEtki >= 0.10
        ) {

            riskler.push({

                alan:
                    "Maaş Artış Oranı",

                seviye:
                    "Yüksek",

                etki:
                    maaşEtki,

                açıklama:
                    "Uzun vadeli ücret artışları DBO üzerinde yüksek etki yaratmaktadır."

            });

        } else if (
            maaşEtki >= 0.05
        ) {

            riskler.push({

                alan:
                    "Maaş Artış Oranı",

                seviye:
                    "Orta",

                etki:
                    maaşEtki,

                açıklama:
                    "Maaş artış varsayımı DBO üzerinde anlamlı etkiye sahiptir."

            });

        }


        if (
            tavanEtki >= 0.05
        ) {

            riskler.push({

                alan:
                    "Kıdem Tazminatı Tavanı",

                seviye:
                    "Orta",

                etki:
                    tavanEtki,

                açıklama:
                    "Kıdem tazminatı tavanındaki değişiklik DBO üzerinde anlamlı etki yaratmaktadır."

            });

        }


        if (
            turnoverEtki >= 0.05
        ) {

            riskler.push({

                alan:
                    "Personel Devir Oranı",

                seviye:
                    "Orta",

                etki:
                    turnoverEtki,

                açıklama:
                    "Personel hareketliliği DBO'nun büyüklüğünü anlamlı şekilde etkileyebilir."

            });

        }


        const yaş45Üzeri =
            personel.filter(
                p =>
                    güvenliSayı(
                        p.yaş
                        ??
                        p.yas,
                        0
                    )
                    >= 45
            ).length;


        if (
            personel.length > 0
            &&
            yaş45Üzeri /
            personel.length
            >= 0.40
        ) {

            riskler.push({

                alan:
                    "Demografik Risk",

                seviye:
                    "Orta",

                etki:
                    yaş45Üzeri /
                    personel.length,

                açıklama:
                    "Çalışan popülasyonunun önemli bölümü 45 yaş üzerindedir."

            });

        }


        return {

            toplamRisk:
                riskler.length,

            riskler

        };

    }


    /* ========================================================
       21. CFO YÖNETİCİ ÖZETİ
    ======================================================== */

    function yöneticiÖzeti(
        değerleme,
        sensitivity,
        risk,
        kalite
    ) {

        const DBO =
            değerleme.toplamDBO;

        const cariHizmet =
            değerleme.toplamCariHizmet;

        const faiz =
            değerleme.toplamFaiz;

        const dönemPnl =
            cariHizmet
            +
            faiz;

        const tavanAşımı =
            değerleme.toplamTavanAşımı;


        const yorumlar = [];


        yorumlar.push(
            `Toplam DBO ${formatPara(DBO)} TL seviyesindedir.`
        );


        yorumlar.push(
            `Cari hizmet maliyeti ${formatPara(cariHizmet)} TL, net faiz maliyeti ise ${formatPara(faiz)} TL'dir.`
        );


        yorumlar.push(
            `Dönemsel P&L etkisi yaklaşık ${formatPara(dönemPnl)} TL'dir.`
        );


        if (
            tavanAşımı > 0
        ) {

            yorumlar.push(
                `Mevcut ücretler üzerinden toplam ${formatPara(tavanAşımı)} TL tutarında kıdem tazminatı tavanı aşımı bulunmaktadır.`
            );

        }


        const iskontoEtki =
            Math.max(
                Math.abs(
                    sensitivity
                        .iskontoOranı
                        .eksi100bp
                        .farkYüzdesi
                ),
                Math.abs(
                    sensitivity
                        .iskontoOranı
                        .artı100bp
                        .farkYüzdesi
                )
            );


        if (
            iskontoEtki >= 0.05
        ) {

            yorumlar.push(
                "İskonto oranı DBO'nun önemli bir değerleme riskidir. Kapanışta kullanılan iskonto oranının piyasa getirileri ve benzer vadeli yüksek kaliteli tahvil getirileriyle desteklenmesi önerilir."
            );

        }


        const maaşEtki =
            Math.max(
                Math.abs(
                    sensitivity
                        .maaşArtışı
                        .eksi100bp
                        .farkYüzdesi
                ),
                Math.abs(
                    sensitivity
                        .maaşArtışı
                        .artı100bp
                        .farkYüzdesi
                )
            );


        if (
            maaşEtki >= 0.05
        ) {

            yorumlar.push(
                "Maaş artış varsayımı DBO açısından önemli bir risk faktörüdür. Varsayımın bütçe, ücret politikası ve geçmiş gerçekleşmelerle tutarlılığı değerlendirilmelidir."
            );

        }


        if (
            risk.toplamRisk > 0
        ) {

            yorumlar.push(
                `${risk.toplamRisk} adet aktüeryal risk alanı belirlenmiştir.`
            );

        }


        yorumlar.push(
            `Model veri kalite skoru ${yuvarla(kalite.kaliteSkoru, 0)}/100 seviyesindedir.`
        );


        yorumlar.push(
            "CFO perspektifinden izlenmesi gereken temel göstergeler: DBO, P&L maliyeti, OCI volatilitesi, iskonto oranı, maaş artış oranı, kıdem tazminatı tavanı, çalışan yaş dağılımı ve beklenen nakit ödeme profili."
        );


        return {

            DBO,

            cariHizmet,

            faiz,

            dönemPnl,

            oci:
                0,

            yorumlar

        };

    }


    /* ========================================================
       22. TAM HESAPLAMA
    ======================================================== */

    function tamHesapla(
        personel,
        hamVarsayımlar = {}
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


        const varsayımlar = {

            /*
               Finansal varsayımlar
            */

            iskontoOranı:
                güvenliSayı(
                    hamVarsayımlar.iskontoOranı,
                    SABİTLER.DEFAULT_İSKONTO_ORANI
                ),

            maaşArtışOranı:
                güvenliSayı(
                    hamVarsayımlar.maaşArtışOranı,
                    SABİTLER.DEFAULT_MAAŞ_ARTIŞ_ORANI
                ),


            /*
               Demografik varsayımlar
            */

            personelDevirOranı:
                güvenliSayı(
                    hamVarsayımlar.personelDevirOranı,
                    SABİTLER.DEFAULT_TURNOVER_ORANI
                ),

            emeklilikYaşı:
                güvenliSayı(
                    hamVarsayımlar.emeklilikYaşı,
                    SABİTLER.DEFAULT_EMEKLİLİK_YAŞI
                ),


            /*
               Türkiye kıdem tazminatı
            */

            kıdemTazminatıTavanı:
                güvenliSayı(
                    hamVarsayımlar.kıdemTazminatıTavanı,
                    SABİTLER.DEFAULT_KIDEM_TAVANI
                ),

            kıdemKatsayısı:
                güvenliSayı(
                    hamVarsayımlar.kıdemKatsayısı,
                    SABİTLER.DEFAULT_KIDEM_KATSAYISI
                ),


            /*
               Hak kazanma varsayımları
            */

            emeklilikHakKazanmaOranı:
                sınırla(
                    güvenliSayı(
                        hamVarsayımlar.emeklilikHakKazanmaOranı,
                        1
                    ),
                    0,
                    1
                ),

            ayrılmaHakKazanmaOranı:
                sınırla(
                    güvenliSayı(
                        hamVarsayımlar.ayrılmaHakKazanmaOranı,
                        0.50
                    ),
                    0,
                    1
                ),


            /*
               Değerleme tarihi
            */

            değerlemeTarihi:
                hamVarsayımlar.değerlemeTarihi
                ||
                new Date()
                    .toISOString()
                    .slice(
                        0,
                        10
                    )

        };


        varsayımlar.iskontoOranı =
            sınırla(
                varsayımlar.iskontoOranı,
                SABİTLER.MIN_İSKONTO_ORANI,
                SABİTLER.MAX_İSKONTO_ORANI
            );


        varsayımlar.maaşArtışOranı =
            sınırla(
                varsayımlar.maaşArtışOranı,
                SABİTLER.MIN_MAAŞ_ARTIŞI,
                SABİTLER.MAX_MAAŞ_ARTIŞI
            );


        varsayımlar.personelDevirOranı =
            sınırla(
                varsayımlar.personelDevirOranı,
                SABİTLER.MIN_TURNOVER,
                SABİTLER.MAX_TURNOVER
            );


        /*
           1. Değerleme
        */

        const değerleme =
            değerle(
                personel,
                varsayımlar
            );


        /*
           2. DBO köprüsü
        */

        const dboKöprü =
            dboKöprüsü(
                değerleme,
                güvenliSayı(
                    hamVarsayımlar.açılışDBO,
                    0
                ),
                güvenliSayı(
                    hamVarsayımlar.faydaÖdemeleri,
                    0
                ),
                güvenliSayı(
                    hamVarsayımlar.aktüeryalKazançKayıp,
                    0
                )
            );


        /*
           3. Duyarlılık
        */

        const sensitivity =
            duyarlılıkHesapla(
                personel,
                varsayımlar
            );


        /*
           4. Yıllık projeksiyon
        */

        const projeksiyon =
            yıllıkProjeksiyon(
                değerleme.personelSonuçları
            );


        /*
           5. Veri kalite
        */

        const kalite =
            veriKalitesi(
                personel,
                varsayımlar
            );


        /*
           6. Risk
        */

        const risk =
            riskAnalizi(
                personel,
                varsayımlar,
                sensitivity
            );


        /*
           7. CFO özeti
        */

        const özet =
            yöneticiÖzeti(
                değerleme,
                sensitivity,
                risk,
                kalite
            );


        /*
           8. Ana sonuç objesi
        */

        return {

            /* ------------------------------------------------
               ANA KPI
            ------------------------------------------------ */

            closingDBO:
                değerleme.toplamDBO,

            currentServiceCost:
                değerleme.toplamCariHizmet,

            netInterestCost:
                değerleme.toplamFaiz,

            oci:
                güvenliSayı(
                    hamVarsayımlar.aktüeryalKazançKayıp,
                    0
                ),

            personelSayısı:
                personel.length,


            /* ------------------------------------------------
               KIDEM
            ------------------------------------------------ */

            toplamMevcutKıdem:
                değerleme.toplamMevcutKıdem,

            toplamTavanAşımı:
                değerleme.toplamTavanAşımı,


            /* ------------------------------------------------
               DETAY
            ------------------------------------------------ */

            personelSonuçları:
                değerleme.personelSonuçları,

            dboKöprüsü:
                dboKöprü,

            yıllıkProjeksiyon:
                projeksiyon,

            sensitivity,

            veriKalitesi:
                kalite,

            riskAnalizi:
                risk,

            yöneticiÖzeti:
                özet,


            /* ------------------------------------------------
               VARSAYIMLAR
            ------------------------------------------------ */

            varsayımlar,


            /* ------------------------------------------------
               METADATA
            ------------------------------------------------ */

            model:

                {

                    isim:
                        "TMS 19 Aktüeryal Değerleme Motoru",

                    sürüm:
                        "V3",

                    yöntem:
                        "Projected Unit Credit Method",

                    kapsam:
                        "Türkiye Kıdem Tazminatı / Tanımlanmış Fayda",

                    değerlemeTarihi:
                        varsayımlar.değerlemeTarihi

                }

        };

    }


    /* ========================================================
       23. PERSONEL TABLOSU İÇİN DÜZ VERİ
    ======================================================== */

    function personelTablosu(
        sonuç
    ) {

        if (
            !sonuç
            ||
            !Array.isArray(
                sonuç.personelSonuçları
            )
        ) {

            return [];

        }


        return sonuç.personelSonuçları.map(
            (
                sonuçPersonel,
                index
            ) => {

                const p =
                    sonuçPersonel.personel;


                return {

                    sıra:
                        index + 1,

                    sicilNo:
                        p.sicilNo
                        ??
                        p.sicil
                        ??
                        p.id
                        ??
                        "",

                    adSoyad:
                        p.adSoyad
                        ??
                        p.ad
                        ??
                        p.name
                        ??
                        `Personel ${index + 1}`,

                    yaş:
                        yuvarla(
                            p.yaş,
                            1
                        ),

                    hizmetSüresi:
                        yuvarla(
                            p.hizmetSüresi,
                            1
                        ),

                    mevcutMaaş:
                        p.mevcutMaaş,

                    emeklilikYaşı:
                        p.emeklilikYaşı,

                    emekliliğeKalanYıl:
                        sonuçPersonel.emekliliğeKalanYıl,

                    mevcutKıdem:
                        sonuçPersonel
                            .mevcutKıdem
                            .brütKıdemTazminatı,

                    kıdemeEsasÜcret:
                        sonuçPersonel
                            .mevcutKıdem
                            .kıdemeEsasÜcret,

                    tavanAşımı:
                        sonuçPersonel
                            .mevcutKıdem
                            .tavanAşımı,

                    DBO:
                        sonuçPersonel
                            .kapanışDBO,

                    cariHizmetMaliyeti:
                        sonuçPersonel
                            .cariHizmetMaliyeti,

                    faizMaliyeti:
                        sonuçPersonel
                            .faizMaliyeti

                };

            }
        );

    }


    /* ========================================================
       24. ISKONTO DUYARLILIK TABLOSU
    ======================================================== */

    function iskontoDuyarlılıkTablosu(
        sensitivity
    ) {

        return [

            {

                senaryo:
                    "İskonto oranı -100 bp",

                DBO:
                    sensitivity
                        .iskontoOranı
                        .eksi100bp
                        .DBO,

                fark:
                    sensitivity
                        .iskontoOranı
                        .eksi100bp
                        .fark,

                farkYüzdesi:
                    sensitivity
                        .iskontoOranı
                        .eksi100bp
                        .farkYüzdesi

            },

            {

                senaryo:
                    "Baz Senaryo",

                DBO:
                    sensitivity
                        .iskontoOranı
                        .baz
                        .DBO,

                fark:
                    0,

                farkYüzdesi:
                    0

            },

            {

                senaryo:
                    "İskonto oranı +100 bp",

                DBO:
                    sensitivity
                        .iskontoOranı
                        .artı100bp
                        .DBO,

                fark:
                    sensitivity
                        .iskontoOranı
                        .artı100bp
                        .fark,

                farkYüzdesi:
                    sensitivity
                        .iskontoOranı
                        .artı100bp
                        .farkYüzdesi

            }

        ];

    }


    /* ========================================================
       25. CFO DASHBOARD KPI
    ======================================================== */

    function dashboardKPI(
        sonuç
    ) {

        const DBO =
            güvenliSayı(
                sonuç.closingDBO
            );

        const cariHizmet =
            güvenliSayı(
                sonuç.currentServiceCost
            );

        const faiz =
            güvenliSayı(
                sonuç.netInterestCost
            );

        const PnL =
            cariHizmet
            +
            faiz;


        const kalite =
            sonuç.veriKalitesi
            ?.kaliteSkoru
            ??
            0;


        const risk =
            sonuç.riskAnalizi
            ?.toplamRisk
            ??
            0;


        return {

            DBO,

            cariHizmetMaliyeti:
                cariHizmet,

            faizMaliyeti:
                faiz,

            dönemPnl:
                PnL,

            personelSayısı:
                sonuç.personelSayısı,

            veriKalitesi:
                kalite,

            riskSayısı:
                risk,

            mevcutKıdem:
                sonuç.toplamMevcutKıdem,

            tavanAşımı:
                sonuç.toplamTavanAşımı

        };

    }


    /* ========================================================
       26. PUBLIC API
    ======================================================== */

    return {

        /* Ana motor */

        tamHesapla,

        değerle,

        personelProjeksiyonu,


        /* Demografik */

        ölümOlasılığı,

        devirOlasılığı,

        emeklilikOlasılığı,

        faydaAlmaOlasılığı,


        /* Finansal */

        gelecektekiMaaş,

        kıdemeEsasÜcret,

        kıdemTazminatıHesapla,

        iskontoFaktörü,


        /* Analitik */

        duyarlılıkHesapla,

        veriKalitesi,

        riskAnalizi,

        yöneticiÖzeti,


        /* Dashboard */

        personelTablosu,

        iskontoDuyarlılıkTablosu,

        dashboardKPI,


        /* Sabitler */

        SABİTLER

    };

})();


/* ============================================================
   GLOBAL ERİŞİM
============================================================ */

window.TMS19 = TMS19;


/* ============================================================
   MOTOR KONTROL
============================================================ */

console.log(
    "GK Advisory — TMS 19 Aktüeryal Motor V3 başarıyla yüklendi."
);

console.log(
    "Yöntem:",
    "Projected Unit Credit Method"
);

console.log(
    "Kapsam:",
    "Türkiye Kıdem Tazminatı / Tanımlanmış Fayda"
);


/* ============================================================
   GELİŞTİRİCİ TESTİ
============================================================ */

function TMS19_Test() {

    const örnekPersonel = [

        {

            sicilNo:
                "1001",

            adSoyad:
                "Örnek Personel 1",

            doğumTarihi:
                "1985-05-15",

            işeGirişTarihi:
                "2015-01-01",

            mevcutMaaş:
                75000,

            cinsiyet:
                "E"

        },

        {

            sicilNo:
                "1002",

            adSoyad:
                "Örnek Personel 2",

            doğumTarihi:
                "1990-08-20",

            işeGirişTarihi:
                "2020-03-01",

            mevcutMaaş:
                55000,

            cinsiyet:
                "K"

        }

    ];


    const varsayımlar = {

        değerlemeTarihi:
            new Date()
                .toISOString()
                .slice(
                    0,
                    10
                ),

        iskontoOranı:
            0.28,

        maaşArtışOranı:
            0.25,

        personelDevirOranı:
            0.08,

        emeklilikYaşı:
            60,

        /*
           Dashboard üzerinden değiştirilmesi önerilir.
        */

        kıdemTazminatıTavanı:
            50000,

        kıdemKatsayısı:
            1,

        emeklilikHakKazanmaOranı:
            1,

        ayrılmaHakKazanmaOranı:
            0.50

    };


    const sonuç =
        TMS19.tamHesapla(
            örnekPersonel,
            varsayımlar
        );


    console.table(
        TMS19.personelTablosu(
            sonuç
        )
    );


    console.log(
        "TMS 19 Test Sonucu:",
        sonuç
    );


    return sonuç;

}


/* ============================================================
   İSTEĞE BAĞLI TEST
   ============================================================ */

window.TMS19_Test =
    TMS19_Test;
