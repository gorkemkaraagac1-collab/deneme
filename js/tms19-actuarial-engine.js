/* ================================================================
   GK FINANCIAL DECISION COCKPIT
   TMS 19 ACTUARIAL ENGINE
   ----------------------------------------------------------------
   TMS 19 Employee Benefit Obligation Calculation Engine

   ANA SORUMLULUKLAR
   -----------------
   1. Personel normalizasyonu
   2. Personel validation
   3. Yaş hesaplama
   4. Hizmet süresi hesaplama
   5. Maaş projeksiyonu
   6. Kıdem tavanı projeksiyonu
   7. Demografik olasılık
   8. İskonto
   9. DBO
   10. Cari hizmet maliyeti
   11. Faiz maliyeti
   12. Aktüeryal sonuç üretimi

   NOT
   ---
   Bu dosya UI içermez.
   Bu dosya tablo çizmez.
   Bu dosya Excel / CSV okumaz.

   Sadece aktüeryal hesaplama yapar.
================================================================ */

(function (global) {

    "use strict";


    /* ============================================================
       01 — TMS19 NAMESPACE
    ============================================================ */

    const TMS19 =
        global.TMS19 ||
        {};


    /* ============================================================
       02 — ENGINE BİLGİSİ
    ============================================================ */

    TMS19.engineVersion =
        "3.0.0";

    TMS19.engineName =
        "GK TMS 19 Actuarial Engine";


    /* ============================================================
       03 — SAYI NORMALİZASYONU
    ============================================================ */

    TMS19.sayi =
        function (value) {

            if (
                value === null ||
                value === undefined ||
                value === ""
            ) {

                return 0;
            }


            if (
                typeof value === "number"
            ) {

                return isFinite(value)
                    ? value
                    : 0;
            }


            let text =
                String(value)
                    .trim();


            /*
             * Türkçe sayı formatı:
             *
             * 1.234.567,89
             *
             * İngilizce:
             *
             * 1234567.89
             */

            if (
                text.includes(",") &&
                text.includes(".")
            ) {

                text =
                    text
                        .replace(
                            /\./g,
                            ""
                        )
                        .replace(
                            ",",
                            "."
                        );

            }

            else if (
                text.includes(",")
            ) {

                text =
                    text.replace(
                        ",",
                        "."
                    );
            }


            const number =
                Number(
                    text
                );


            return isFinite(number)
                ? number
                : 0;
        };


    /* ============================================================
       04 — TARİH NORMALİZASYONU
    ============================================================ */

    TMS19.tarih =
        function (value) {

            if (
                value instanceof Date
            ) {

                return new Date(
                    value.getTime()
                );
            }


            if (
                !value
            ) {

                return null;
            }


            if (
                typeof value === "number"
            ) {

                const excelEpoch =
                    new Date(
                        Date.UTC(
                            1899,
                            11,
                            30
                        )
                    );


                const result =
                    new Date(
                        excelEpoch.getTime() +
                        value *
                        86400000
                    );


                return isNaN(
                    result.getTime()
                )
                    ? null
                    : result;
            }


            const text =
                String(value)
                    .trim();


            /*
             * DD.MM.YYYY
             */

            const turkishDate =
                text.match(
                    /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/
                );


            if (
                turkishDate
            ) {

                const day =
                    Number(
                        turkishDate[1]
                    );


                const month =
                    Number(
                        turkishDate[2]
                    ) - 1;


                const year =
                    Number(
                        turkishDate[3]
                    );


                const result =
                    new Date(
                        year,
                        month,
                        day
                    );


                return isNaN(
                    result.getTime()
                )
                    ? null
                    : result;
            }


            const result =
                new Date(
                    text
                );


            return isNaN(
                result.getTime()
            )
                ? null
                : result;
        };


    /* ============================================================
       05 — TARİH FARKI
    ============================================================ */

    TMS19.yilFarki =
        function (
            startDate,
            endDate
        ) {

            if (
                !startDate ||
                !endDate
            ) {

                return 0;
            }


            const start =
                TMS19.tarih(
                    startDate
                );


            const end =
                TMS19.tarih(
                    endDate
                );


            if (
                !start ||
                !end
            ) {

                return 0;
            }


            const fark =
                end.getTime() -
                start.getTime();


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


    /* ============================================================
       06 — YAŞ HESAPLA
    ============================================================ */

    TMS19.yasHesapla =
        function (
            dogumTarihi,
            degerlemeTarihi
        ) {

            const birth =
                TMS19.tarih(
                    dogumTarihi
                );


            const valuation =
                TMS19.tarih(
                    degerlemeTarihi
                );


            if (
                !birth ||
                !valuation
            ) {

                return 0;
            }


            let age =
                valuation.getFullYear() -
                birth.getFullYear();


            const monthDifference =
                valuation.getMonth() -
                birth.getMonth();


            if (
                monthDifference < 0 ||
                (
                    monthDifference === 0 &&
                    valuation.getDate() <
                    birth.getDate()
                )
            ) {

                age--;
            }


            return Math.max(
                0,
                age
            );
        };


    /* ============================================================
       06B — SGK KADEMELİ EMEKLİLİK + EYT MOTORU
       ------------------------------------------------------------
       Kaynaklar:
         - 506 sayılı Kanun (08.09.1999 öncesi girişliler) + 4759
           sayılı Kanun kademeli geçiş tablosu (23.05.2002 bazlı)
         - 4447 sayılı Kanun (09.09.1999–30.04.2008 girişliler)
         - 5510 sayılı Kanun md. 28 + Geçici md. 81 (01.05.2008
           sonrası girişliler, 2036-2048 arası kademeli yaş)
         - 7438 sayılı Kanun (03.03.2023, EYT): 08.09.1999 öncesi
           girişliler için yaş şartını kaldırır; sadece
           sigortalılık süresi + prim gün sayısı şartı aranır.

       NOT: Bu motor "sigortalılık başlangıç tarihi" ve kesintisiz
       prim ödendiği varsayımı ile prim gün sayısını hizmet
       süresinden (yıl × 360 gün) türetir. Gerçek prim hizmet
       dökümü (eksik gün, borçlanma, hizmet birleştirme vb.)
       mevcutsa, p.primGunSayisi alanı ile bu varsayımın üzerine
       yazılabilir. Bu motor gerçek SGK tahsis hesaplamasının
       yerine geçmez; TMS 19 aktüeryal projeksiyonu için makul bir
       kademeli emeklilik tarihi yaklaşımı üretir.
    ============================================================ */

    const SGK_GUN_YIL =
        360;

    const SGK_EYT_KESIM_TARIHI =
        new Date(
            1999,
            8,
            8
        );

    const SGK_4447_BASLANGIC =
        new Date(
            1999,
            8,
            9
        );

    const SGK_5510_KESIM_TARIHI =
        new Date(
            2008,
            3,
            30
        );

    const SGK_5510_BASLANGIC =
        new Date(
            2008,
            4,
            1
        );


    /*
     * 08.09.1999 öncesi girişliler için, sigortalılık başlangıç
     * tarihine göre kademeli PRİM GÜN SAYISI tablosu (5000-5975 gün).
     * "son" alanı, o kademenin geçerli olduğu son sigorta başlangıç
     * tarihidir (dahil).
     */

    const SGK_EYT_GUN_TABLO_KADIN =
        [
            { son: new Date(1981, 8, 8), gun: 5000 },
            { son: new Date(1984, 4, 23), gun: 5000 },
            { son: new Date(1985, 4, 23), gun: 5000 },
            { son: new Date(1986, 4, 23), gun: 5075 },
            { son: new Date(1987, 4, 23), gun: 5150 },
            { son: new Date(1988, 4, 23), gun: 5225 },
            { son: new Date(1989, 4, 23), gun: 5300 },
            { son: new Date(1990, 4, 23), gun: 5375 },
            { son: new Date(1991, 4, 23), gun: 5450 },
            { son: new Date(1992, 4, 23), gun: 5525 },
            { son: new Date(1993, 4, 23), gun: 5600 },
            { son: new Date(1994, 4, 23), gun: 5675 },
            { son: new Date(1995, 4, 23), gun: 5750 },
            { son: new Date(1996, 4, 23), gun: 5825 },
            { son: new Date(1997, 4, 23), gun: 5900 },
            { son: new Date(1998, 4, 23), gun: 5975 },
            { son: new Date(1999, 4, 23), gun: 5975 },
            { son: SGK_EYT_KESIM_TARIHI, gun: 5975 }
        ];

    const SGK_EYT_GUN_TABLO_ERKEK =
        [
            { son: new Date(1976, 8, 8), gun: 5000 },
            { son: new Date(1979, 4, 23), gun: 5000 },
            { son: new Date(1980, 10, 23), gun: 5000 },
            { son: new Date(1982, 4, 23), gun: 5075 },
            { son: new Date(1983, 10, 23), gun: 5150 },
            { son: new Date(1985, 4, 23), gun: 5225 },
            { son: new Date(1986, 10, 23), gun: 5300 },
            { son: new Date(1988, 4, 23), gun: 5375 },
            { son: new Date(1989, 10, 23), gun: 5450 },
            { son: new Date(1991, 4, 23), gun: 5525 },
            { son: new Date(1992, 10, 23), gun: 5600 },
            { son: new Date(1994, 4, 23), gun: 5675 },
            { son: new Date(1995, 10, 23), gun: 5750 },
            { son: new Date(1997, 4, 23), gun: 5825 },
            { son: new Date(1998, 10, 23), gun: 5900 },
            { son: SGK_EYT_KESIM_TARIHI, gun: 5975 }
        ];


    /*
     * 01.05.2008 sonrası girişliler için, 7200 prim gün koşulunun
     * TAMAMLANDIĞI tarihe göre kademeli YAŞ tablosu
     * (5510 sayılı Kanun, Geçici md. 81).
     */

    const SGK_5510_YAS_TABLO =
        [
            { son: new Date(2035, 11, 31), kadin: 58, erkek: 60 },
            { son: new Date(2037, 11, 31), kadin: 59, erkek: 61 },
            { son: new Date(2039, 11, 31), kadin: 60, erkek: 62 },
            { son: new Date(2041, 11, 31), kadin: 61, erkek: 63 },
            { son: new Date(2043, 11, 31), kadin: 62, erkek: 64 },
            { son: new Date(2045, 11, 31), kadin: 63, erkek: 65 },
            { son: new Date(2047, 11, 31), kadin: 64, erkek: 65 },
            { son: null, kadin: 65, erkek: 65 }
        ];


    TMS19.sgkTarihKarsilastir =
        function (a, b) {

            return a.getTime() - b.getTime();
        };


    TMS19.sgkGunTablosundanBul =
        function (tablo, sigortaBaslangicTarihi) {

            for (let i = 0; i < tablo.length; i++) {

                if (
                    TMS19.sgkTarihKarsilastir(
                        sigortaBaslangicTarihi,
                        tablo[i].son
                    ) <= 0
                ) {

                    return tablo[i].gun;
                }
            }

            return tablo[tablo.length - 1].gun;
        };


    TMS19.sgkYasTablosundanBul =
        function (tamamlanmaTarihi, cinsiyet) {

            for (let i = 0; i < SGK_5510_YAS_TABLO.length; i++) {

                const satir =
                    SGK_5510_YAS_TABLO[i];

                if (
                    satir.son === null ||
                    TMS19.sgkTarihKarsilastir(
                        tamamlanmaTarihi,
                        satir.son
                    ) <= 0
                ) {

                    return cinsiyet === "K"
                        ? satir.kadin
                        : satir.erkek;
                }
            }

            return 65;
        };


    TMS19.sgkCinsiyetNormalizeEt =
        function (deger, varsayilan) {

            const text =
                String(
                    deger ?? ""
                )
                    .trim()
                    .toUpperCase();

            if (
                text === "K" ||
                text === "KADIN" ||
                text === "KADın" ||
                text === "F" ||
                text === "FEMALE" ||
                text === "WOMAN"
            ) {

                return "K";
            }

            if (
                text === "E" ||
                text === "ERKEK" ||
                text === "M" ||
                text === "MALE" ||
                text === "MAN"
            ) {

                return "E";
            }

            return varsayilan === "K"
                ? "K"
                : "E";
        };


    /*
     * Bir tarihe (ondalıklı) yıl ekler. Tam yıl kısmı takvim yılı
     * olarak, küsurat kısmı gün bazlı (365.25) olarak eklenir.
     */

    TMS19.sgkTarihYilEkle =
        function (baseDate, yil) {

            if (
                !baseDate ||
                !isFinite(yil)
            ) {

                return null;
            }

            const tamYil =
                Math.floor(
                    Math.max(
                        0,
                        yil
                    )
                );

            const kesirYil =
                Math.max(
                    0,
                    yil
                ) - tamYil;

            const sonuc =
                new Date(
                    baseDate.getTime()
                );

            sonuc.setFullYear(
                sonuc.getFullYear() +
                tamYil
            );

            if (
                kesirYil > 0
            ) {

                sonuc.setTime(
                    sonuc.getTime() +
                    kesirYil *
                    365.25 *
                    24 *
                    60 *
                    60 *
                    1000
                );
            }

            return sonuc;
        };


    /*
     * SGK 4/a (hizmet akdi/SSK) kademeli emeklilik + EYT motoru.
     *
     * Personelin sigorta başlangıç tarihine göre üç rejimden
     * birine tabi tutulur:
     *
     *   A) <= 08.09.1999  → EYT (7438 sayılı Kanun): yaş şartı YOK,
     *      sadece sigortalılık süresi (K:20/E:25 yıl) + kademeli
     *      prim gün sayısı (5000-5975) şartı aranır.
     *
     *   B) 09.09.1999 - 30.04.2008 → yaş şartı sabit (K:58/E:60) +
     *      7000 prim günü.
     *
     *   C) >= 01.05.2008 → 7200 prim günü + bu günün TAMAMLANDIĞI
     *      tarihe göre kademeli yaş (K/E 58/60'tan başlayıp 2048'de
     *      65'te sabitlenir).
     *
     * SGK verisi (doğum tarihi / sigorta başlangıç tarihi /
     * cinsiyet) eksikse, geriye dönük uyumluluk için
     * varsayimlar.emeklilikYasi düz varsayımına düşer.
     */

    /*
     * Grup kodunu UI'da gösterilecek kısa etikete çevirir
     * (örn. tablo sütunu, badge).
     */

    TMS19.sgkGrupEtiketi =
        function (grup) {

            switch (grup) {

                case "A_EYT":
                    return "EYT";

                case "B_KADEMELI_1999_2008":
                    return "Kademeli (1999–2008)";

                case "C_5510_KADEMELI":
                    return "Kademeli (5510)";

                default:
                    return "Belirsiz";
            }
        };


    TMS19.sgkGrupAciklamasi =
        function (grup) {

            switch (grup) {

                case "A_EYT":
                    return "7438 sayılı Kanun (EYT) — 08.09.1999 öncesi sigorta girişi, yaş şartı aranmaz.";

                case "B_KADEMELI_1999_2008":
                    return "4447 sayılı Kanun — 09.09.1999-30.04.2008 arası sigorta girişi, sabit yaş şartı.";

                case "C_5510_KADEMELI":
                    return "5510 sayılı Kanun — 01.05.2008 sonrası sigorta girişi, kademeli yaş tablosu.";

                default:
                    return "Sigorta başlangıç tarihi/doğum tarihi eksik olduğu için sabit varsayım kullanıldı.";
            }
        };


    TMS19.sgkEmeklilikBilgisiHesapla =
        function (personel, varsayimlar, degerlemeTarihi) {

            const p =
                personel &&
                personel.personelId !== undefined
                    ? personel
                    : TMS19.personelNormalizeEt(
                        personel
                    );

            const dogumTarihi =
                TMS19.tarih(
                    p.dogumTarihi
                );

            const sigortaBaslangicTarihi =
                TMS19.tarih(
                    p.sigortaBaslangicTarihi ??
                    p.iseGirisTarihi
                );

            const valuationDate =
                TMS19.tarih(
                    degerlemeTarihi
                );

            const legacyEmeklilikYasi =
                TMS19.sayi(
                    varsayimlar?.emeklilikYasi
                ) ||
                65;

            if (
                !dogumTarihi ||
                !sigortaBaslangicTarihi
            ) {

                return {
                    emeklilikYasi: legacyEmeklilikYasi,
                    emeklilikTarihi: null,
                    kural: "VARSAYIM (SGK verisi eksik — sabit emeklilikYasi kullanıldı)",
                    grup: null,
                    eytUygulandi: false,
                    gerekliYas: legacyEmeklilikYasi,
                    gerekliPrimGunu: null,
                    gerekliSigortalilikYili: null
                };
            }

            const cinsiyet =
                TMS19.sgkCinsiyetNormalizeEt(
                    p.cinsiyet,
                    varsayimlar?.varsayilanCinsiyet
                );

            const manuelPrimGunu =
                p.primGunSayisi !== undefined &&
                p.primGunSayisi !== null &&
                p.primGunSayisi !== ""
                    ? TMS19.sayi(p.primGunSayisi)
                    : null;

            let grup =
                null;

            let gerekliYas =
                null;

            let gerekliPrimGunu =
                null;

            let gerekliSigortalilikYili =
                null;

            let eytUygulandi =
                false;

            /* ---- GRUP A: EYT (<= 08.09.1999) ---- */

            if (
                TMS19.sgkTarihKarsilastir(
                    sigortaBaslangicTarihi,
                    SGK_EYT_KESIM_TARIHI
                ) <= 0
            ) {

                grup =
                    "A_EYT";

                eytUygulandi =
                    true;

                gerekliYas =
                    null;

                gerekliSigortalilikYili =
                    cinsiyet === "K"
                        ? 20
                        : 25;

                gerekliPrimGunu =
                    TMS19.sgkGunTablosundanBul(
                        cinsiyet === "K"
                            ? SGK_EYT_GUN_TABLO_KADIN
                            : SGK_EYT_GUN_TABLO_ERKEK,
                        sigortaBaslangicTarihi
                    );
            }

            /* ---- GRUP B: 09.09.1999 - 30.04.2008 ---- */

            else if (
                TMS19.sgkTarihKarsilastir(
                    sigortaBaslangicTarihi,
                    SGK_5510_KESIM_TARIHI
                ) <= 0
            ) {

                grup =
                    "B_KADEMELI_1999_2008";

                gerekliYas =
                    cinsiyet === "K"
                        ? 58
                        : 60;

                gerekliPrimGunu =
                    7000;

                gerekliSigortalilikYili =
                    null;
            }

            /* ---- GRUP C: >= 01.05.2008 (5510 sayılı Kanun) ---- */

            else {

                grup =
                    "C_5510_KADEMELI";

                gerekliPrimGunu =
                    7200;

                gerekliSigortalilikYili =
                    null;

                /*
                 * Yaş tablosu, 7200 günün TAMAMLANDIĞI tarihe göre
                 * kademelidir. Bu tarih, sigorta başlangıcı üzerine
                 * gerekli gün sayısının (yıla çevrilerek) eklenmesiyle
                 * bulunur; manuel prim gün sayısı verilmişse eksik
                 * gün üzerinden tamamlanma tarihi buna göre kayar.
                 */

                const primYiliBazli =
                    manuelPrimGunu !== null
                        ? Math.max(
                            0,
                            (gerekliPrimGunu - manuelPrimGunu) /
                            SGK_GUN_YIL
                        )
                        : gerekliPrimGunu /
                        SGK_GUN_YIL;

                const tahminiTamamlanmaTarihi =
                    manuelPrimGunu !== null
                        ? TMS19.sgkTarihYilEkle(
                            valuationDate ||
                            sigortaBaslangicTarihi,
                            primYiliBazli
                        )
                        : TMS19.sgkTarihYilEkle(
                            sigortaBaslangicTarihi,
                            primYiliBazli
                        );

                gerekliYas =
                    TMS19.sgkYasTablosundanBul(
                        tahminiTamamlanmaTarihi,
                        cinsiyet
                    );
            }

            /* ----------------------------------------------------
               HİZMET/PRİM ŞARTININ TAMAMLANMA TARİHİ
            ---------------------------------------------------- */

            let sureTamamlanmaTarihi;

            if (
                manuelPrimGunu !== null
            ) {

                const eksikGun =
                    Math.max(
                        0,
                        gerekliPrimGunu -
                        manuelPrimGunu
                    );

                sureTamamlanmaTarihi =
                    TMS19.sgkTarihYilEkle(
                        valuationDate ||
                        sigortaBaslangicTarihi,
                        eksikGun /
                        SGK_GUN_YIL
                    );
            }

            else if (
                gerekliSigortalilikYili !== null
            ) {

                const gunKarsiligiYil =
                    gerekliPrimGunu /
                    SGK_GUN_YIL;

                sureTamamlanmaTarihi =
                    TMS19.sgkTarihYilEkle(
                        sigortaBaslangicTarihi,
                        Math.max(
                            gerekliSigortalilikYili,
                            gunKarsiligiYil
                        )
                    );
            }

            else {

                sureTamamlanmaTarihi =
                    TMS19.sgkTarihYilEkle(
                        sigortaBaslangicTarihi,
                        gerekliPrimGunu /
                        SGK_GUN_YIL
                    );
            }

            /* ----------------------------------------------------
               YAŞ ŞARTININ TAMAMLANMA TARİHİ
            ---------------------------------------------------- */

            const yasTamamlanmaTarihi =
                eytUygulandi
                    ? null
                    : TMS19.sgkTarihYilEkle(
                        dogumTarihi,
                        gerekliYas
                    );

            const emeklilikTarihi =
                yasTamamlanmaTarihi &&
                TMS19.sgkTarihKarsilastir(
                    yasTamamlanmaTarihi,
                    sureTamamlanmaTarihi
                ) > 0
                    ? yasTamamlanmaTarihi
                    : sureTamamlanmaTarihi;

            const efektifEmeklilikYasi =
                TMS19.yasHesapla(
                    dogumTarihi,
                    emeklilikTarihi
                );

            return {

                emeklilikYasi:
                    efektifEmeklilikYasi,

                emeklilikTarihi:
                    emeklilikTarihi,

                kural:
                    grup,

                grup:
                    grup,

                eytUygulandi:
                    eytUygulandi,

                cinsiyet:
                    cinsiyet,

                sigortaBaslangicTarihi:
                    sigortaBaslangicTarihi,

                gerekliYas:
                    gerekliYas,

                gerekliPrimGunu:
                    gerekliPrimGunu,

                gerekliSigortalilikYili:
                    gerekliSigortalilikYili
            };
        };


    /* ============================================================
       07 — PERSONEL NORMALİZASYONU
    ============================================================ */

    TMS19.personelNormalizeEt =
        function (
            personel
        ) {

            const p =
                personel ||
                {};


            return {

                personelId:
                    p.personelId ??
                    p.id ??
                    p.PersonelID ??
                    "",


                adSoyad:
                    p.adSoyad ??
                    p.ad ??
                    p.AdSoyad ??
                    p.name ??
                    "",


                dogumTarihi:
                    p.dogumTarihi ??
                    p.dogumTarihi ??
                    p.DogumTarihi ??
                    p.birthDate ??
                    null,


                iseGirisTarihi:
                    p.iseGirisTarihi ??
                    p.IseGirisTarihi ??
                    p.hireDate ??
                    null,


                sigortaBaslangicTarihi:
                    p.sigortaBaslangicTarihi ??
                    p.SigortaBaslangicTarihi ??
                    p.sskGirisTarihi ??
                    p.ilkSigortaTarihi ??
                    p.iseGirisTarihi ??
                    p.IseGirisTarihi ??
                    p.hireDate ??
                    null,


                mevcutMaas:
                    TMS19.sayi(
                        p.mevcutMaas ??
                        p.MevcutMaas ??
                        p.maas ??
                        p.salary
                    ),


                departman:
                    p.departman ??
                    p.Departman ??
                    "",


                pozisyon:
                    p.pozisyon ??
                    p.Pozisyon ??
                    "",


                cinsiyet:
                    p.cinsiyet ??
                    p.Cinsiyet ??
                    p.gender ??
                    "",


                raw:
                    p
            };
        };


    /* ============================================================
       08 — PERSONEL VALIDATION
    ============================================================ */

    TMS19.personelValidate =
        function (
            personel
        ) {

            const p =
                TMS19.personelNormalizeEt(
                    personel
                );


            const errors =
                [];


            if (
                !p.personelId
            ) {

                errors.push(
                    "Personel ID eksik."
                );
            }


            if (
                !p.dogumTarihi
            ) {

                errors.push(
                    "Doğum tarihi eksik."
                );
            }


            if (
                !p.iseGirisTarihi
            ) {

                errors.push(
                    "İşe giriş tarihi eksik."
                );
            }


            if (
                p.mevcutMaas <= 0
            ) {

                errors.push(
                    "Mevcut maaş sıfır veya negatif."
                );
            }


            const birth =
                TMS19.tarih(
                    p.dogumTarihi
                );


            const hire =
                TMS19.tarih(
                    p.iseGirisTarihi
                );


            if (
                !birth
            ) {

                errors.push(
                    "Doğum tarihi geçersiz."
                );
            }


            if (
                !hire
            ) {

                errors.push(
                    "İşe giriş tarihi geçersiz."
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
       09 — FAZ 1 DEMOGRAFİK AKTÜERYAL MOTOR
       ------------------------------------------------------------
       Ölüm: TÜİK Türkiye tek yaş hayat tablosu
       Yaş aralığı: 18–65
       Cinsiyet: Kadın / Erkek
       Ölüm olasılığı: qx
    ============================================================ */

    TMS19.tuikHayatTablosuOlumOrani =
        function (
            yas,
            cinsiyet,
            varsayimlar = {}
        ) {

            const y =
                Math.max(
                    18,
                    Math.min(
                        65,
                        Math.floor(
                            TMS19.sayi(yas)
                        )
                    )
                );

            const c =
                TMS19.sgkCinsiyetNormalizeEt
                    ? TMS19.sgkCinsiyetNormalizeEt(
                        cinsiyet,
                        "E"
                    )
                    : String(
                        cinsiyet ?? "E"
                    ).toUpperCase() === "K"
                        ? "K"
                        : "E";

            const tablo =
                c === "K"
                    ? varsayimlar.tuikHayatTablosuKadin
                    : varsayimlar.tuikHayatTablosuErkek;

            if (
                !Array.isArray(tablo)
            ) {
                return 0;
            }

            const kayit =
                tablo.find(
                    satir =>
                        TMS19.sayi(
                            satir.yas
                        ) === y
                );

            if (!kayit) {
                return 0;
            }

            return Math.min(
                1,
                Math.max(
                    0,
                    TMS19.sayi(
                        kayit.qx ??
                        kayit.olumOlasiligi
                    )
                )
            );
        };


    TMS19.yasBazliOlumOrani =
        function (
            yas,
            cinsiyet,
            varsayimlar = {}
        ) {

            return TMS19.tuikHayatTablosuOlumOrani(
                yas,
                cinsiyet,
                varsayimlar
            );
        };


    TMS19.yasBazliDevirOrani =
        function (
            yas,
            varsayimlar = {}
        ) {

            const tablo =
                varsayimlar.devirTablosu;

            if (
                Array.isArray(tablo) &&
                tablo.length > 0
            ) {

                const kayit =
                    tablo.find(
                        satir =>
                            yas >=
                                TMS19.sayi(
                                    satir.minYas ??
                                    satir.yas
                                ) &&
                            yas <=
                                TMS19.sayi(
                                    satir.maxYas ??
                                    satir.yas
                                )
                    );

                if (kayit) {
                    return Math.min(
                        1,
                        Math.max(
                            0,
                            TMS19.sayi(
                                kayit.oran
                            )
                        )
                    );
                }
            }

            return Math.min(
                1,
                Math.max(
                    0,
                    TMS19.sayi(
                        varsayimlar.personelDevirOrani
                    )
                )
            );
        };


    TMS19.yillikDemografikOlasilik =
        function (
            yas,
            cinsiyet,
            varsayimlar = {}
        ) {

            const devir =
                TMS19.yasBazliDevirOrani(
                    yas,
                    varsayimlar
                );

            const olumHam =
                TMS19.yasBazliOlumOrani(
                    yas,
                    cinsiyet,
                    varsayimlar
                );

            const olum =
                (1 - devir) * olumHam;

            const devam =
                (1 - devir) *
                (1 - olumHam);

            return {
                yas,
                devirOlasiligi: devir,
                olumOlasiligi: olum,
                devamOlasiligi: devam,
                toplamOlasilik:
                    devir + olum + devam
            };
        };


    TMS19.demografikProjeksiyon =
        function (
            mevcutYas,
            kalanYil,
            cinsiyet,
            varsayimlar = {}
        ) {

            const projection = [];
            let cumulativeSurvival = 1;

            const baslangicYasi =
                Math.floor(
                    TMS19.sayi(mevcutYas)
                );

            const yilSayisi =
                Math.max(
                    0,
                    Math.ceil(
                        TMS19.sayi(kalanYil)
                    )
                );

            for (
                let i = 0;
                i < yilSayisi;
                i++
            ) {

                const yas =
                    baslangicYasi + i;

                if (yas > 65) {
                    break;
                }

                const olay =
                    TMS19.yillikDemografikOlasilik(
                        yas,
                        cinsiyet,
                        varsayimlar
                    );

                cumulativeSurvival *=
                    olay.devamOlasiligi;

                projection.push({
                    yil: i + 1,
                    yas,
                    devirOlasiligi:
                        olay.devirOlasiligi,
                    olumOlasiligi:
                        olay.olumOlasiligi,
                    devamOlasiligi:
                        olay.devamOlasiligi,
                    kumulatifDevamOlasiligi:
                        cumulativeSurvival
                });
            }

            return projection;
        };


    TMS19.demografikKontrol =
        function (projection) {

            const errors = [];

            (Array.isArray(projection)
                ? projection
                : projection?.projection || []
            ).forEach(
                row => {

                    const toplam =
                        TMS19.sayi(
                            row.devirOlasiligi
                        ) +
                        TMS19.sayi(
                            row.olumOlasiligi
                        ) +
                        TMS19.sayi(
                            row.devamOlasiligi
                        );

                    if (
                        Math.abs(
                            toplam - 1
                        ) > 0.000001
                    ) {
                        errors.push(
                            `Yaş ${row.yas}: olasılık toplamı 1 değil.`
                        );
                    }

                    if (
                        row.kumulatifDevamOlasiligi < 0 ||
                        row.kumulatifDevamOlasiligi > 1
                    ) {
                        errors.push(
                            `Yaş ${row.yas}: kümülatif devam olasılığı hatalı.`
                        );
                    }
                }
            );

            return {
                valid:
                    errors.length === 0,
                errors
            };
        };


    TMS19.devamOlasiligi =
        function (
            kalanYil,
            varsayimlar = {},
            mevcutYas = null,
            cinsiyet = null
        ) {

            if (
                TMS19.sayi(kalanYil) <= 0
            ) {
                return 1;
            }

            if (
                mevcutYas !== null &&
                mevcutYas !== undefined
            ) {

                const projection =
                    TMS19.demografikProjeksiyon(
                        mevcutYas,
                        kalanYil,
                        cinsiyet,
                        varsayimlar
                    );

                return projection.length
                    ? projection[
                        projection.length - 1
                    ].kumulatifDevamOlasiligi
                    : 1;
            }

            const turnover =
                Math.min(
                    1,
                    Math.max(
                        0,
                        TMS19.sayi(
                            varsayimlar.personelDevirOrani
                        )
                    )
                );

            const mortality =
                Math.min(
                    1,
                    Math.max(
                        0,
                        TMS19.sayi(
                            varsayimlar.olumOrani
                        )
                    )
                );

            return Math.pow(
                (1 - turnover) *
                (1 - mortality),
                TMS19.sayi(kalanYil)
            );
        };


    /* ============================================================
       10 — MAAŞ PROJEKSİYONU
    ============================================================ */

    TMS19.maasProjeksiyonu =
        function (
            mevcutMaas,
            kalanYil,
            varsayimlar
        ) {

            const salary =
                TMS19.sayi(
                    mevcutMaas
                );


            const salaryIncrease =
                Math.max(
                    0,
                    TMS19.sayi(
                        varsayimlar
                            ?.maasArtisOrani
                    )
                );


            const projected =
                salary *
                Math.pow(
                    1 +
                    salaryIncrease,
                    Math.max(
                        0,
                        kalanYil
                    )
                );


            return {

                mevcutMaas:
                    salary,

                emeklilikMaasi:
                    projected,

                artisOrani:
                    salaryIncrease,

                kalanYil:
                    Math.max(
                        0,
                        kalanYil
                    )
            };
        };


    /* ============================================================
       11 — İSKONTO FAKTÖRÜ
    ============================================================ */

    TMS19.iskontoFaktoru =
        function (
            iskontoOrani,
            yil
        ) {

            const rate =
                TMS19.sayi(
                    iskontoOrani
                );


            const years =
                Math.max(
                    0,
                    TMS19.sayi(
                        yil
                    )
                );


            if (
                rate <= -1
            ) {

                return 1;
            }


            return 1 /
                Math.pow(
                    1 +
                    rate,
                    years
                );
        };


    /* ============================================================
       12 — TEK PERSONEL AKTÜERYAL HESAPLAMA
    ============================================================ */

    TMS19.personelHesapla =
        function (
            personel,
            varsayimlar = {},
            index = 0
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
                    validation.errors.join(
                        " "
                    )
                );
            }


            const degerlemeTarihi =
                TMS19.tarih(
                    varsayimlar
                        .degerlemeTarihi
                );


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
               DEMOGRAFİ
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


            const sgkEmeklilik =
                TMS19.sgkEmeklilikBilgisiHesapla(
                    p,
                    varsayimlar,
                    degerlemeTarihi
                );


            const emeklilikYasi =
                sgkEmeklilik.emeklilikYasi;


            const emekliligeKalanYil =
                sgkEmeklilik.emeklilikTarihi
                    ? Math.max(
                        0,
                        TMS19.yilFarki(
                            degerlemeTarihi,
                            sgkEmeklilik.emeklilikTarihi
                        )
                    )
                    : Math.max(
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
                    mevcutMaas,
                    emekliligeKalanYil,
                    varsayimlar
                );


            const emeklilikMaasi =
                maas.emeklilikMaasi;


            /* ----------------------------------------------------
               KIDEM TAVANI
            ---------------------------------------------------- */

            let faydaHesaplamaMaasi =
                emeklilikMaasi;


            let tavanUygulandi =
                false;


            let projectedCeiling =
                Infinity;


            const mevcutKidemTavani =
                TMS19.sayi(
                    varsayimlar
                        .kidemTavani
                );


            const kidemTavaniArtisOrani =
                TMS19.sayi(
                    varsayimlar
                        .kidemTavaniArtisOrani
                );


            if (
                isFinite(
                    mevcutKidemTavani
                ) &&
                mevcutKidemTavani > 0
            ) {

                projectedCeiling =
                    mevcutKidemTavani *
                    Math.pow(
                        1 +
                        kidemTavaniArtisOrani,
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


            /* ----------------------------------------------------
               FAYDA
            ---------------------------------------------------- */

            const faydaOrani =
                TMS19.sayi(
                    varsayimlar
                        .faydaOrani
                );


            const yillikFayda =
                faydaHesaplamaMaasi *
                faydaOrani;


            const toplamFayda =
                yillikFayda *
                toplamHizmet;


            /* ----------------------------------------------------
               GEÇMİŞ HİZMET
            ---------------------------------------------------- */

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


            /* ----------------------------------------------------
               DEMOGRAFİK OLASILIK
            ---------------------------------------------------- */

            const cinsiyet =
                TMS19.sgkCinsiyetNormalizeEt
                    ? TMS19.sgkCinsiyetNormalizeEt(
                        p.cinsiyet,
                        "E"
                    )
                    : p.cinsiyet;


            const devamOlasiligi =
                TMS19.devamOlasiligi(
                    emekliligeKalanYil,
                    varsayimlar,
                    yas,
                    cinsiyet
                );


            const beklenenFayda =
                kazanilmisFayda *
                devamOlasiligi;


            /* ----------------------------------------------------
               İSKONTO
            ---------------------------------------------------- */

            const iskontoOrani =
                TMS19.sayi(
                    varsayimlar
                        .iskontoOrani
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


            const cariHizmetMaliyeti =
                birYillikFayda *
                devamOlasiligi *
                iskontoFaktoru;


            /* ----------------------------------------------------
               FAİZ MALİYETİ

               Basitleştirilmiş:
               Opening DBO × iskonto oranı

               İlk dönem hesaplamasında opening DBO
               verilmemişse 0 döndürülür.
            ---------------------------------------------------- */

            const openingDBO =
                TMS19.sayi(
                    varsayimlar
                        .openingDBO
                );


            const faizMaliyeti =
                openingDBO *
                iskontoOrani;


            /* ----------------------------------------------------
               AKTÜERYAL SONUÇ
            ---------------------------------------------------- */

            return {

                index:
                    index,

                personel:
                    {

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

                        mevcutMaas:
                            mevcutMaas
                    },


                demografi:
                    {

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

                        devamOlasiligi:
                            devamOlasiligi,

                        cinsiyet:
                            cinsiyet,

                        sgkGrup:
                            sgkEmeklilik.grup,

                        sgkRejimEtiketi:
                            TMS19.sgkGrupEtiketi(
                                sgkEmeklilik.grup
                            ),

                        sgkRejimAciklamasi:
                            TMS19.sgkGrupAciklamasi(
                                sgkEmeklilik.grup
                            ),

                        eytUygulandi:
                            sgkEmeklilik.eytUygulandi,

                        sigortaBaslangicTarihi:
                            sgkEmeklilik.sigortaBaslangicTarihi,

                        gerekliYas:
                            sgkEmeklilik.gerekliYas,

                        gerekliPrimGunu:
                            sgkEmeklilik.gerekliPrimGunu,

                        gerekliSigortalilikYili:
                            sgkEmeklilik.gerekliSigortalilikYili,

                        emeklilikTarihi:
                            sgkEmeklilik.emeklilikTarihi
                    },


                maas:
                    {

                        mevcutMaas:
                            mevcutMaas,

                        emeklilikMaasi:
                            emeklilikMaasi,

                        faydaHesaplamaMaasi:
                            faydaHesaplamaMaasi,

                        maasArtisOrani:
                            maas.artisOrani
                    },


                kidemTavani:
                    {

                        mevcutTavan:
                            mevcutKidemTavani,

                        projectedCeiling:
                            projectedCeiling,

                        uygulandi:
                            tavanUygulandi,

                        tavanArtisOrani:
                            kidemTavaniArtisOrani
                    },


                hizmet:
                    {

                        gecmisHizmetOrani:
                            gecmisHizmetOrani,

                        kazanilmisFayda:
                            kazanilmisFayda,

                        toplamFayda:
                            toplamFayda,

                        yillikFayda:
                            yillikFayda
                    },


                demografik:
                    {

                        devamOlasiligi:
                            devamOlasiligi,

                        cinsiyet:
                            cinsiyet,

                        olumOlasiligi:
                            TMS19.yasBazliOlumOrani(
                                yas,
                                cinsiyet,
                                varsayimlar
                            ),

                        devirOlasiligi:
                            TMS19.yasBazliDevirOrani(
                                yas,
                                varsayimlar
                            ),

                        beklenenFayda:
                            beklenenFayda
                    },


                iskonto:
                    {

                        oran:
                            iskontoOrani,

                        yil:
                            emekliligeKalanYil,

                        faktor:
                            iskontoFaktoru
                    },


                muhasebe:
                    {

                        dbo:
                            dbo,

                        cariHizmetMaliyeti:
                            cariHizmetMaliyeti,

                        faizMaliyeti:
                            faizMaliyeti
                    },


                /*
                 * Portfolio Engine için
                 * hızlı erişim alanları
                 */

                dbo:
                    dbo,

                cariHizmetMaliyeti:
                    cariHizmetMaliyeti,

                faizMaliyeti:
                    faizMaliyeti,


                validation:
                    validation,


                hesaplamaDurumu:
                    "BAŞARILI",


                /*
                 * UI (tms19.html) için düz erişim
                 * alanları — personel, demografi, maas
                 * objelerinin kopyası
                 */

                personelId:
                    p.personelId,

                adSoyad:
                    p.adSoyad,

                departman:
                    p.departman,

                pozisyon:
                    p.pozisyon,

                mevcutMaas:
                    mevcutMaas,

                yas:
                    yas,

                hizmetSuresi:
                    hizmetSuresi,

                emekliligeKalanYil:
                    emekliligeKalanYil,

                emeklilikMaasi:
                    emeklilikMaasi,

                kazanilmisFayda:
                    kazanilmisFayda,

                devamOlasiligi:
                    devamOlasiligi,

                sgkRejimEtiketi:
                    TMS19.sgkGrupEtiketi(
                        sgkEmeklilik.grup
                    ),

                sgkRejimAciklamasi:
                    TMS19.sgkGrupAciklamasi(
                        sgkEmeklilik.grup
                    ),

                eytUygulandi:
                    sgkEmeklilik.eytUygulandi,


                metadata:
                    {

                        engine:
                            TMS19.engineName,

                        version:
                            TMS19.engineVersion,

                        calculationDate:
                            new Date()
                                .toISOString()
                    }
            };
        };


    /* ============================================================
       13 — TOPLU HESAPLAMA
    ============================================================ */

    TMS19.topluHesapla =
        function (
            personeller,
            varsayimlar = {}
        ) {

            if (
                !Array.isArray(
                    personeller
                )
            ) {

                throw new Error(
                    "Personel listesi array olmalıdır."
                );
            }


            const results =
                [];


            const errors =
                [];


            personeller.forEach(
                (
                    personel,
                    index
                ) => {

                    try {

                        const result =
                            TMS19.personelHesapla(
                                personel,
                                varsayimlar,
                                index
                            );


                        results.push(
                            result
                        );

                    }

                    catch (
                        error
                    ) {

                        errors.push({

                            index:
                                index,

                            personelId:
                                personel
                                    ?.personelId ??
                                "",

                            error:
                                error.message
                        });
                    }
                }
            );


            return {

                results:
                    results,

                errors:
                    errors,

                success:
                    errors.length === 0,

                total:
                    personeller.length,

                calculated:
                    results.length,

                failed:
                    errors.length
            };
        };


    /* ============================================================
       14 — ÖZET
    ============================================================ */

    TMS19.ozetOlustur =
        function (
            results
        ) {

            if (
                !Array.isArray(
                    results
                ) ||
                results.length === 0
            ) {

                return {

                    personelSayisi:
                        0,

                    toplamDBO:
                        0,

                    toplamCariHizmetMaliyeti:
                        0,

                    toplamFaizMaliyeti:
                        0,

                    toplamFayda:
                        0,

                    ortalamaYas:
                        0,

                    ortalamaHizmet:
                        0,

                    tavanUygulananPersonel:
                        0
                };
            }


            let dbo =
                0;


            let csc =
                0;


            let interest =
                0;


            let benefit =
                0;


            let age =
                0;


            let service =
                0;


            let ceilingCount =
                0;


            results.forEach(
                result => {

                    dbo +=
                        TMS19.sayi(
                            result.dbo
                        );


                    csc +=
                        TMS19.sayi(
                            result.cariHizmetMaliyeti
                        );


                    interest +=
                        TMS19.sayi(
                            result.faizMaliyeti
                        );


                    benefit +=
                        TMS19.sayi(
                            result.hizmet
                                ?.toplamFayda
                        );


                    age +=
                        TMS19.sayi(
                            result.demografi
                                ?.yas
                        );


                    service +=
                        TMS19.sayi(
                            result.demografi
                                ?.hizmetSuresi
                        );


                    if (
                        result.kidemTavani
                            ?.uygulandi
                    ) {

                        ceilingCount++;
                    }
                }
            );


            return {

                personelSayisi:
                    results.length,

                toplamDBO:
                    dbo,

                toplamCariHizmetMaliyeti:
                    csc,

                toplamFaizMaliyeti:
                    interest,

                toplamFayda:
                    benefit,

                ortalamaYas:
                    age /
                    results.length,

                ortalamaHizmet:
                    service /
                    results.length,

                tavanUygulananPersonel:
                    ceilingCount,

                dboMaasOrani:
                    0
            };
        };


    /* ============================================================
       14b — KONTROL MOTORU
    ============================================================ */

    TMS19.kontrolMotoru =
        function (
            results
        ) {

            if (
                !Array.isArray(
                    results
                ) ||
                results.length === 0
            ) {

                return {

                    durum:
                        "TEMİZ",

                    toplamKontrol:
                        0,

                    kontroller:
                        []
                };
            }


            const kontroller =
                [];


            results.forEach(
                function (
                    r
                ) {

                    const personelId =
                        r
                            ?.personel
                            ?.personelId ??
                        "";


                    if (
                        r
                            ?.kidemTavani
                            ?.uygulandi
                    ) {

                        kontroller.push({

                            personelId:
                                personelId,

                            kontrol:
                                "Kıdem Tavanı",

                            durum:
                                "Bilgi",

                            mesaj:
                                "Fayda hesaplama maaşı kıdem tavanı ile sınırlandırıldı."
                        });
                    }


                    if (
                        TMS19.sayi(
                            r
                                ?.muhasebe
                                ?.dbo
                        ) < 0
                    ) {

                        kontroller.push({

                            personelId:
                                personelId,

                            kontrol:
                                "DBO",

                            durum:
                                "Uyarı",

                            mesaj:
                                "Hesaplanan DBO negatif çıktı."
                        });
                    }


                    if (
                        TMS19.sayi(
                            r
                                ?.personel
                                ?.mevcutMaas
                        ) <= 0
                    ) {

                        kontroller.push({

                            personelId:
                                personelId,

                            kontrol:
                                "Maaş",

                            durum:
                                "Hata",

                            mesaj:
                                "Mevcut maaş sıfır veya negatif."
                        });
                    }


                    if (
                        TMS19.sayi(
                            r
                                ?.demografi
                                ?.hizmetSuresi
                        ) < 0
                    ) {

                        kontroller.push({

                            personelId:
                                personelId,

                            kontrol:
                                "Hizmet Süresi",

                            durum:
                                "Hata",

                            mesaj:
                                "İşe giriş tarihi değerleme tarihinden sonra."
                        });
                    }


                    if (
                        TMS19.sayi(
                            r
                                ?.demografi
                                ?.yas
                        ) >=
                        TMS19.sayi(
                            r
                                ?.demografi
                                ?.emeklilikYasi
                        )
                    ) {

                        kontroller.push({

                            personelId:
                                personelId,

                            kontrol:
                                "Emeklilik Yaşı",

                            durum:
                                "Uyarı",

                            mesaj:
                                "Personel emeklilik yaşına ulaşmış veya geçmiş."
                        });
                    }
                }
            );


            return {

                durum:
                    kontroller.length === 0
                        ? "TEMİZ"
                        : "İNCELENMELİ",

                toplamKontrol:
                    kontroller.length,

                kontroller:
                    kontroller
            };
        };


    /* ============================================================
       14c — SENARYO MATRİSİ (DUYARLILIK ANALİZİ)
    ============================================================ */

    TMS19.senaryoMatrisi =
        function (
            personeller,
            varsayimlar = {}
        ) {

            function dboHesapla(
                v
            ) {

                const toplu =
                    TMS19.topluHesapla(
                        personeller,
                        v
                    );

                const ozet =
                    TMS19.ozetOlustur(
                        toplu.results
                    );

                return ozet.toplamDBO;
            }


            const baseDBO =
                dboHesapla(
                    varsayimlar
                );


            const iskontoOrani =
                TMS19.sayi(
                    varsayimlar
                        .iskontoOrani
                );


            const maasArtisOrani =
                TMS19.sayi(
                    varsayimlar
                        .maasArtisOrani
                );


            const senaryolar =
                [

                    {
                        ad:
                            "Baz Senaryo",

                        dbo:
                            baseDBO
                    },

                    {
                        ad:
                            "İskonto Oranı +%1",

                        dbo:
                            dboHesapla(
                                Object.assign(
                                    {},
                                    varsayimlar,
                                    {
                                        iskontoOrani:
                                            iskontoOrani +
                                            0.01
                                    }
                                )
                            )
                    },

                    {
                        ad:
                            "İskonto Oranı -%1",

                        dbo:
                            dboHesapla(
                                Object.assign(
                                    {},
                                    varsayimlar,
                                    {
                                        iskontoOrani:
                                            iskontoOrani -
                                            0.01
                                    }
                                )
                            )
                    },

                    {
                        ad:
                            "Maaş Artış Oranı +%1",

                        dbo:
                            dboHesapla(
                                Object.assign(
                                    {},
                                    varsayimlar,
                                    {
                                        maasArtisOrani:
                                            maasArtisOrani +
                                            0.01
                                    }
                                )
                            )
                    },

                    {
                        ad:
                            "Maaş Artış Oranı -%1",

                        dbo:
                            dboHesapla(
                                Object.assign(
                                    {},
                                    varsayimlar,
                                    {
                                        maasArtisOrani:
                                            maasArtisOrani -
                                            0.01
                                    }
                                )
                            )
                    }
                ];


            senaryolar.forEach(
                function (
                    s
                ) {

                    s.fark =
                        s.dbo -
                        baseDBO;

                    s.farkYuzde =
                        baseDBO !== 0
                            ? s.fark /
                              baseDBO
                            : 0;
                }
            );


            return senaryolar;
        };


    /* ============================================================
       14d — RİSK ANALİZİ (TEK PERSONEL)
    ============================================================ */

    TMS19.riskAnalizi =
        function (
            sonuc
        ) {

            const dbo =
                TMS19.sayi(
                    sonuc
                        ?.muhasebe
                        ?.dbo ??
                    sonuc
                        ?.dbo
                );


            const kalanYil =
                TMS19.sayi(
                    sonuc
                        ?.demografi
                        ?.emekliligeKalanYil ??
                    sonuc
                        ?.emekliligeKalanYil
                );


            const devam =
                TMS19.sayi(
                    sonuc
                        ?.demografi
                        ?.devamOlasiligi ??
                    sonuc
                        ?.devamOlasiligi
                );


            let skor =
                0;


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


            let genelRisk =
                "DÜŞÜK";


            if (
                skor >= 6
            ) {

                genelRisk =
                    "YÜKSEK";
            }
            else if (
                skor >= 3
            ) {

                genelRisk =
                    "ORTA";
            }


            return {

                personelId:
                    sonuc
                        ?.personel
                        ?.personelId ??
                    sonuc
                        ?.personelId,

                dbo:
                    dbo,

                kalanYil:
                    kalanYil,

                devamOlasiligi:
                    devam,

                skor:
                    skor,

                genelRisk:
                    genelRisk
            };
        };


    /* ============================================================
       14e — AUDIT TRAIL (TEK PERSONEL)
    ============================================================ */

    TMS19.auditTrail =
        function (
            personel,
            varsayimlar = {}
        ) {

            if (
                !personel
            ) {

                return [];
            }


            let sonuc;


            try {

                sonuc =
                    TMS19.personelHesapla(
                        personel,
                        varsayimlar,
                        0
                    );
            }
            catch (
                error
            ) {

                return [

                    {
                        adim:
                            1,

                        alan:
                            "Hata",

                        deger:
                            0,

                        aciklama:
                            error.message
                    }
                ];
            }


            return [

                {
                    adim:
                        1,

                    alan:
                        "Yaş",

                    deger:
                        sonuc.demografi.yas,

                    birim:
                        "yil",

                    aciklama:
                        "Değerleme tarihi itibarıyla personel yaşı."
                },

                {
                    adim:
                        2,

                    alan:
                        "Hizmet Süresi",

                    deger:
                        sonuc.demografi
                            .hizmetSuresi,

                    birim:
                        "yil",

                    aciklama:
                        "İşe giriş tarihinden değerleme tarihine kadar geçen süre."
                },

                {
                    adim:
                        3,

                    alan:
                        "Emekliliğe Kalan Yıl",

                    deger:
                        sonuc.demografi
                            .emekliligeKalanYil,

                    birim:
                        "yil",

                    aciklama:
                        "Emeklilik yaşına kalan süre."
                },

                {
                    adim:
                        4,

                    alan:
                        "Projekte Edilen Maaş",

                    deger:
                        sonuc.maas
                            .emeklilikMaasi,

                    birim:
                        "para",

                    aciklama:
                        "Maaş artış oranı ile emeklilik tarihine taşınan maaş."
                },

                {
                    adim:
                        5,

                    alan:
                        "Kıdem Tavanı Uygulandı mı",

                    deger:
                        sonuc.kidemTavani
                            .uygulandi
                            ? 1
                            : 0,

                    birim:
                        "boolean",

                    aciklama:
                        sonuc.kidemTavani
                            .uygulandi
                            ? "Fayda hesaplama maaşı kıdem tavanı ile sınırlandırıldı."
                            : "Kıdem tavanı uygulanmadı."
                },

                {
                    adim:
                        6,

                    alan:
                        "Devam Olasılığı",

                    deger:
                        sonuc.demografik
                            .devamOlasiligi,

                    birim:
                        "yuzde",

                    aciklama:
                        "Personel devir ve ölüm oranına göre hesaplanan devam olasılığı."
                },

                {
                    adim:
                        7,

                    alan:
                        "Kazanılmış Fayda",

                    deger:
                        sonuc.hizmet
                            .kazanilmisFayda,

                    birim:
                        "para",

                    aciklama:
                        "Hizmet oranına göre kazanılmış kıdem tazminatı tutarı."
                },

                {
                    adim:
                        8,

                    alan:
                        "İskonto Faktörü",

                    deger:
                        sonuc.iskonto
                            .faktor,

                    birim:
                        "oran",

                    aciklama:
                        "İskonto oranı ile bugüne indirgeme faktörü."
                },

                {
                    adim:
                        9,

                    alan:
                        "DBO",

                    deger:
                        sonuc.muhasebe
                            .dbo,

                    birim:
                        "para",

                    aciklama:
                        "Tanımlanmış Fayda Yükümlülüğü (bugünkü değer)."
                },

                {
                    adim:
                        10,

                    alan:
                        "Cari Hizmet Maliyeti",

                    deger:
                        sonuc.muhasebe
                            .cariHizmetMaliyeti,

                    birim:
                        "para",

                    aciklama:
                        "Cari döneme ait hizmet maliyeti."
                },

                {
                    adim:
                        11,

                    alan:
                        "Faiz Maliyeti",

                    deger:
                        sonuc.muhasebe
                            .faizMaliyeti,

                    birim:
                        "para",

                    aciklama:
                        "Açılış DBO üzerinden hesaplanan faiz maliyeti."
                }
            ];
        };


    /* ============================================================
       15 — HEALTH CHECK
    ============================================================ */

    TMS19.actuarialHealthCheck =
        function () {

            return {

                status:
                    "OK",

                engine:
                    TMS19.engineName,

                version:
                    TMS19.engineVersion,

                functions:
                    {

                        sayi:
                            typeof TMS19.sayi ===
                            "function",

                        tarih:
                            typeof TMS19.tarih ===
                            "function",

                        yasHesapla:
                            typeof TMS19.yasHesapla ===
                            "function",

                        personelNormalizeEt:
                            typeof TMS19.personelNormalizeEt ===
                            "function",

                        personelValidate:
                            typeof TMS19.personelValidate ===
                            "function",

                        maasProjeksiyonu:
                            typeof TMS19.maasProjeksiyonu ===
                            "function",

                        devamOlasiligi:
                            typeof TMS19.devamOlasiligi ===
                            "function",

                        iskontoFaktoru:
                            typeof TMS19.iskontoFaktoru ===
                            "function",

                        personelHesapla:
                            typeof TMS19.personelHesapla ===
                            "function",

                        topluHesapla:
                            typeof TMS19.topluHesapla ===
                            "function"
                    },

                timestamp:
                    new Date()
                        .toISOString()
            };
        };


    /* ============================================================
       16 — GLOBAL EXPORT
    ============================================================ */

    global.TMS19 =
        TMS19;


    /*
     * Backward compatibility
     */

    global.TMS19ActuarialEngine =
        TMS19;


})(typeof window !== "undefined"
    ? window
    : globalThis);

/* ================================================================
   TMS 19 — PERIODIC ACTUARIAL ENGINE
   ----------------------------------------------------------------
   Opening DBO
   + Current Service Cost
   + Interest Cost
   + Past Service Cost
   + Actuarial Gain / Loss
   - Benefits Paid
   = Closing DBO

   GK Financial Decision Cockpit
================================================================ */


/* ================================================================
   17 — AÇILIŞ DBO
================================================================ */

TMS19.acilisDBOHesapla =
    function (
        personel,
        varsayimlar = {}
    ) {

        const openingDBO =
            TMS19.sayi(
                personel?.openingDBO ??
                personel?.acilisDBO ??
                varsayimlar?.openingDBO
            );


        return Math.max(
            0,
            openingDBO
        );
    };


/* ================================================================
   18 — CARİ HİZMET MALİYETİ
================================================================ */

TMS19.cariHizmetMaliyetiHesapla =
    function (
        hesap
    ) {

        if (
            !hesap
        ) {

            return 0;
        }


        return Math.max(
            0,
            TMS19.sayi(
                hesap.cariHizmetMaliyeti
            )
        );
    };


/* ================================================================
   19 — FAİZ MALİYETİ
================================================================ */

TMS19.faizMaliyetiHesapla =
    function (
        openingDBO,
        iskontoOrani
    ) {

        const dbo =
            Math.max(
                0,
                TMS19.sayi(
                    openingDBO
                )
            );


        const rate =
            TMS19.sayi(
                iskontoOrani
            );


        return dbo * rate;
    };


/* ================================================================
   20 — PAST SERVICE COST
================================================================ */

TMS19.gecmisHizmetMaliyetiHesapla =
    function (
        personel,
        varsayimlar = {}
    ) {

        /*
         * Varsayılan olarak geçmiş hizmet maliyeti yoktur.
         *
         * Ancak sistemde manuel olarak girilebilmesi gerekir.
         */

        const value =
            personel?.pastServiceCost ??
            personel?.gecmisHizmetMaliyeti ??
            varsayimlar?.pastServiceCost ??
            0;


        return TMS19.sayi(
            value
        );
    };


/* ================================================================
   21 — ÖDENEN FAYDALAR
================================================================ */

TMS19.odenenFaydaHesapla =
    function (
        personel,
        varsayimlar = {}
    ) {

        const value =
            personel?.benefitsPaid ??
            personel?.odenenFayda ??
            varsayimlar?.benefitsPaid ??
            0;


        return Math.max(
            0,
            TMS19.sayi(
                value
            )
        );
    };


/* ================================================================
   22 — AKTÜERYAL KAZANÇ / KAYIP
================================================================ */

TMS19.aktueryalKazancKayipHesapla =
    function (
        openingDBO,
        currentServiceCost,
        interestCost,
        pastServiceCost,
        benefitsPaid,
        closingDBO
    ) {

        /*
         * DBO reconciliation:
         *
         * Opening DBO
         * + Current Service Cost
         * + Interest Cost
         * + Past Service Cost
         * + Actuarial Gain/Loss
         * - Benefits Paid
         * = Closing DBO
         *
         * Dolayısıyla:
         *
         * Actuarial Gain/Loss =
         * Closing DBO
         * - Opening DBO
         * - CSC
         * - Interest
         * - PSC
         * + Benefits Paid
         */


        const opening =
            TMS19.sayi(
                openingDBO
            );


        const csc =
            TMS19.sayi(
                currentServiceCost
            );


        const interest =
            TMS19.sayi(
                interestCost
            );


        const psc =
            TMS19.sayi(
                pastServiceCost
            );


        const benefits =
            TMS19.sayi(
                benefitsPaid
            );


        const closing =
            TMS19.sayi(
                closingDBO
            );


        return (
            closing -
            opening -
            csc -
            interest -
            psc +
            benefits
        );
    };


/* ================================================================
   23 — KAPANIŞ DBO
================================================================ */

TMS19.kapanisDBOHesapla =
    function (
        openingDBO,
        currentServiceCost,
        interestCost,
        pastServiceCost,
        actuarialGainLoss,
        benefitsPaid
    ) {

        const opening =
            TMS19.sayi(
                openingDBO
            );


        const csc =
            TMS19.sayi(
                currentServiceCost
            );


        const interest =
            TMS19.sayi(
                interestCost
            );


        const psc =
            TMS19.sayi(
                pastServiceCost
            );


        const actuarial =
            TMS19.sayi(
                actuarialGainLoss
            );


        const benefits =
            TMS19.sayi(
                benefitsPaid
            );


        return Math.max(
            0,
            opening +
            csc +
            interest +
            psc +
            actuarial -
            benefits
        );
    };


/* ================================================================
   24 — DBO RECONCILIATION
================================================================ */

TMS19.dboReconciliation =
    function (
        input = {}
    ) {

        const openingDBO =
            TMS19.sayi(
                input.openingDBO
            );


        const currentServiceCost =
            TMS19.sayi(
                input.currentServiceCost
            );


        const interestCost =
            TMS19.sayi(
                input.interestCost
            );


        const pastServiceCost =
            TMS19.sayi(
                input.pastServiceCost
            );


        const actuarialGainLoss =
            TMS19.sayi(
                input.actuarialGainLoss
            );


        const benefitsPaid =
            TMS19.sayi(
                input.benefitsPaid
            );


        const closingDBO =
            TMS19.kapanisDBOHesapla(
                openingDBO,
                currentServiceCost,
                interestCost,
                pastServiceCost,
                actuarialGainLoss,
                benefitsPaid
            );


        return {

            openingDBO:
                openingDBO,

            currentServiceCost:
                currentServiceCost,

            interestCost:
                interestCost,

            pastServiceCost:
                pastServiceCost,

            actuarialGainLoss:
                actuarialGainLoss,

            benefitsPaid:
                benefitsPaid,

            closingDBO:
                closingDBO,


            /*
             * Kontrol:
             *
             * Eğer sistem dışından closing DBO
             * girildiyse farkı hesapla.
             */

            externalClosingDBO:
                input.externalClosingDBO !==
                undefined
                    ? TMS19.sayi(
                        input.externalClosingDBO
                    )
                    : null,


            reconciliationDifference:
                input.externalClosingDBO !==
                undefined
                    ? closingDBO -
                      TMS19.sayi(
                          input.externalClosingDBO
                      )
                    : 0,


            balanced:
                input.externalClosingDBO !==
                undefined
                    ? Math.abs(
                        closingDBO -
                        TMS19.sayi(
                            input.externalClosingDBO
                        )
                      ) < 0.01
                    : true
        };
    };


/* ================================================================
   25 — PERSONEL DÖNEMSEL AKTÜERYAL HESABI
================================================================ */

TMS19.personelDonemHesapla =
    function (
        personel,
        varsayimlar = {},
        index = 0
    ) {

        /*
         * Önce temel aktüeryal hesap.
         */

        const valuation =
            TMS19.personelHesapla(
                personel,
                varsayimlar,
                index
            );


        /*
         * Opening DBO
         */

        const openingDBO =
            TMS19.acilisDBOHesapla(
                personel,
                varsayimlar
            );


        /*
         * Current Service Cost
         */

        const currentServiceCost =
            TMS19.cariHizmetMaliyetiHesapla(
                valuation
            );


        /*
         * Interest Cost
         */

        const interestCost =
            TMS19.faizMaliyetiHesapla(
                openingDBO,
                varsayimlar.iskontoOrani
            );


        /*
         * Past Service Cost
         */

        const pastServiceCost =
            TMS19.gecmisHizmetMaliyetiHesapla(
                personel,
                varsayimlar
            );


        /*
         * Benefits Paid
         */

        const benefitsPaid =
            TMS19.odenenFaydaHesapla(
                personel,
                varsayimlar
            );


        /*
         * Eğer closing DBO dışarıdan verilmişse
         * actuarial gain/loss residual olarak hesaplanır.
         */

        const externalClosingDBO =
            personel?.closingDBO ??
            personel?.kapanisDBO ??
            null;


        let actuarialGainLoss =
            TMS19.sayi(
                personel?.actuarialGainLoss ??
                personel?.aktueryalKazancKayip ??
                0
            );


        if (
            externalClosingDBO !==
            null &&
            externalClosingDBO !==
            undefined
        ) {

            actuarialGainLoss =
                TMS19.aktueryalKazancKayipHesapla(
                    openingDBO,
                    currentServiceCost,
                    interestCost,
                    pastServiceCost,
                    benefitsPaid,
                    externalClosingDBO
                );
        }


        /*
         * Closing DBO
         */

        const reconciliation =
            TMS19.dboReconciliation({

                openingDBO:
                    openingDBO,

                currentServiceCost:
                    currentServiceCost,

                interestCost:
                    interestCost,

                pastServiceCost:
                    pastServiceCost,

                actuarialGainLoss:
                    actuarialGainLoss,

                benefitsPaid:
                    benefitsPaid,

                externalClosingDBO:
                    externalClosingDBO
            });


        return {

            ...valuation,


            period:
                {

                    openingDBO:
                        openingDBO,

                    currentServiceCost:
                        currentServiceCost,

                    interestCost:
                        interestCost,

                    pastServiceCost:
                        pastServiceCost,

                    actuarialGainLoss:
                        actuarialGainLoss,

                    benefitsPaid:
                        benefitsPaid,

                    closingDBO:
                        reconciliation
                            .closingDBO
                },


            reconciliation:
                reconciliation
        };
    };


/* ================================================================
   26 — PORTFÖY DÖNEMSEL HESAPLAMA
================================================================ */

TMS19.portfoyDonemHesapla =
    function (
        personeller,
        varsayimlar = {}
    ) {

        if (
            !Array.isArray(
                personeller
            )
        ) {

            throw new Error(
                "Personel listesi array olmalıdır."
            );
        }


        const results =
            [];


        const errors =
            [];


        personeller.forEach(
            (
                personel,
                index
            ) => {

                try {

                    const result =
                        TMS19.personelDonemHesapla(
                            personel,
                            varsayimlar,
                            index
                        );


                    results.push(
                        result
                    );

                }

                catch (
                    error
                ) {

                    errors.push({

                        index:
                            index,

                        personelId:
                            personel?.personelId ??
                            personel?.id ??
                            "",

                        error:
                            error.message
                    });
                }
            }
        );


        /*
         * Portfolio totals
         */

        let openingDBO =
            0;


        let currentServiceCost =
            0;


        let interestCost =
            0;


        let pastServiceCost =
            0;


        let actuarialGainLoss =
            0;


        let benefitsPaid =
            0;


        let closingDBO =
            0;


        results.forEach(
            result => {

                openingDBO +=
                    TMS19.sayi(
                        result.period
                            ?.openingDBO
                    );


                currentServiceCost +=
                    TMS19.sayi(
                        result.period
                            ?.currentServiceCost
                    );


                interestCost +=
                    TMS19.sayi(
                        result.period
                            ?.interestCost
                    );


                pastServiceCost +=
                    TMS19.sayi(
                        result.period
                            ?.pastServiceCost
                    );


                actuarialGainLoss +=
                    TMS19.sayi(
                        result.period
                            ?.actuarialGainLoss
                    );


                benefitsPaid +=
                    TMS19.sayi(
                        result.period
                            ?.benefitsPaid
                    );


                closingDBO +=
                    TMS19.sayi(
                        result.period
                            ?.closingDBO
                    );
            }
        );


        /*
         * Portfolio reconciliation
         */

        const expectedClosing =
            openingDBO +
            currentServiceCost +
            interestCost +
            pastServiceCost +
            actuarialGainLoss -
            benefitsPaid;


        const difference =
            closingDBO -
            expectedClosing;


        return {

            results:
                results,

            errors:
                errors,


            summary:
                {

                    personelSayisi:
                        personeller.length,

                    hesaplananPersonel:
                        results.length,

                    hataliPersonel:
                        errors.length,

                    openingDBO:
                        openingDBO,

                    currentServiceCost:
                        currentServiceCost,

                    interestCost:
                        interestCost,

                    pastServiceCost:
                        pastServiceCost,

                    actuarialGainLoss:
                        actuarialGainLoss,

                    benefitsPaid:
                        benefitsPaid,

                    closingDBO:
                        closingDBO,

                    expectedClosingDBO:
                        expectedClosing,

                    reconciliationDifference:
                        difference,

                    balanced:
                        Math.abs(
                            difference
                        ) < 0.01
                },


            success:
                errors.length === 0
        };
    };


/* ================================================================
   27 — P&L / OCI AYRIŞTIRMASI
================================================================ */

TMS19.muhasebeEtkiHesapla =
    function (
        period = {}
    ) {

        const currentServiceCost =
            TMS19.sayi(
                period.currentServiceCost
            );


        const pastServiceCost =
            TMS19.sayi(
                period.pastServiceCost
            );


        const interestCost =
            TMS19.sayi(
                period.interestCost
            );


        const actuarialGainLoss =
            TMS19.sayi(
                period.actuarialGainLoss
            );


        /*
         * IAS 19 mantığında:
         *
         * P&L:
         * Current service cost
         * Past service cost
         * Net interest
         *
         * OCI:
         * Remeasurement
         *
         * Burada remeasurement'ın ana bileşeni
         * aktüeryal kazanç/kayıptır.
         */

        const profitLoss =
            currentServiceCost +
            pastServiceCost +
            interestCost;


        const oci =
            actuarialGainLoss;


        const totalDefinedBenefitCost =
            profitLoss +
            oci;


        return {

            karZarar:
                {

                    cariHizmetMaliyeti:
                        currentServiceCost,

                    gecmisHizmetMaliyeti:
                        pastServiceCost,

                    netFaizMaliyeti:
                        interestCost,

                    toplam:
                        profitLoss
                },


            digerKapsamliGelir:
                {

                    aktueryalKazancKayip:
                        oci,

                    toplam:
                        oci
                },


            toplamAktueryalEtki:
                totalDefinedBenefitCost
        };
    };


/* ================================================================
   28 — SENSITIVITY ANALYSIS
================================================================ */

TMS19.senaryoHesapla =
    function (
        personeller,
        varsayimlar,
        degisiklikler = {}
    ) {

        const baseAssumptions =
            {
                ...varsayimlar
            };


        const scenarioAssumptions =
            {
                ...varsayimlar,
                ...degisiklikler
            };


        const base =
            TMS19.portfoyDonemHesapla(
                personeller,
                baseAssumptions
            );


        const scenario =
            TMS19.portfoyDonemHesapla(
                personeller,
                scenarioAssumptions
            );


        const baseDBO =
            TMS19.sayi(
                base.summary
                    .closingDBO
            );


        const scenarioDBO =
            TMS19.sayi(
                scenario.summary
                    .closingDBO
            );


        const difference =
            scenarioDBO -
            baseDBO;


        const percentage =
            baseDBO !== 0
                ? difference /
                  Math.abs(
                      baseDBO
                  )
                : 0;


        return {

            base:
                base,

            scenario:
                scenario,

            impact:
                {

                    dboDifference:
                        difference,

                    dboPercentage:
                        percentage
                }
        };
    };


/* ================================================================
   29 — İSKONTO SENSİTİVİTESİ
================================================================ */

TMS19.iskontoSensitivitesi =
    function (
        personeller,
        varsayimlar,
        basisPoints = 100
    ) {

        const rate =
            TMS19.sayi(
                varsayimlar
                    .iskontoOrani
            );


        const change =
            TMS19.sayi(
                basisPoints
            ) / 10000;


        const lowerRate =
            rate -
            change;


        const upperRate =
            rate +
            change;


        const lower =
            TMS19.senaryoHesapla(
                personeller,
                varsayimlar,
                {
                    iskontoOrani:
                        lowerRate
                }
            );


        const upper =
            TMS19.senaryoHesapla(
                personeller,
                varsayimlar,
                {
                    iskontoOrani:
                        upperRate
                }
            );


        return {

            baseRate:
                rate,

            lowerRate:
                lowerRate,

            upperRate:
                upperRate,

            lower:
                lower,

            upper:
                upper
        };
    };


/* ================================================================
   30 — MAAŞ SENSİTİVİTESİ
================================================================ */

TMS19.maasArtisSensitivitesi =
    function (
        personeller,
        varsayimlar,
        basisPoints = 100
    ) {

        const rate =
            TMS19.sayi(
                varsayimlar
                    .maasArtisOrani
            );


        const change =
            TMS19.sayi(
                basisPoints
            ) / 10000;


        const lowerRate =
            Math.max(
                0,
                rate -
                change
            );


        const upperRate =
            rate +
            change;


        const lower =
            TMS19.senaryoHesapla(
                personeller,
                varsayimlar,
                {
                    maasArtisOrani:
                        lowerRate
                }
            );


        const upper =
            TMS19.senaryoHesapla(
                personeller,
                varsayimlar,
                {
                    maasArtisOrani:
                        upperRate
                }
            );


        return {

            baseRate:
                rate,

            lowerRate:
                lowerRate,

            upperRate:
                upperRate,

            lower:
                lower,

            upper:
                upper
        };
    };


/* ================================================================
   31 — AKTÜERYAL ENGINE HEALTH CHECK
================================================================ */

TMS19.periodicEngineHealthCheck =
    function () {

        const requiredFunctions =
            [

                "personelHesapla",

                "acilisDBOHesapla",

                "cariHizmetMaliyetiHesapla",

                "faizMaliyetiHesapla",

                "gecmisHizmetMaliyetiHesapla",

                "odenenFaydaHesapla",

                "aktueryalKazancKayipHesapla",

                "kapanisDBOHesapla",

                "dboReconciliation",

                "personelDonemHesapla",

                "portfoyDonemHesapla",

                "muhasebeEtkiHesapla",

                "senaryoHesapla",

                "iskontoSensitivitesi",

                "maasArtisSensitivitesi"
            ];


        const status =
            {};


        let healthy =
            true;


        requiredFunctions.forEach(
            functionName => {

                const exists =
                    typeof TMS19[
                        functionName
                    ] ===
                    "function";


                status[
                    functionName
                ] =
                    exists;


                if (
                    !exists
                ) {

                    healthy =
                        false;
                }
            }
        );


        return {

            healthy:
                healthy,

            engine:
                "TMS19 Periodic Actuarial Engine",

            functions:
                status,

            timestamp:
                new Date()
                    .toISOString()
        };
    };

/* ================================================================
   TMS 19 — ACCOUNTING ENGINE
   ----------------------------------------------------------------
   DBO
   PLAN ASSETS
   NET DEFINED BENEFIT LIABILITY / ASSET
   P&L
   OCI
   EQUITY
   ROLL-FORWARD
================================================================ */


/* ================================================================
   32 — PLAN ASSET HESAPLA
================================================================ */

TMS19.planVarlikHesapla =
    function (
        personel,
        varsayimlar = {}
    ) {

        const value =
            personel?.planAssets ??
            personel?.planVarliklari ??
            varsayimlar?.planAssets ??
            varsayimlar?.planVarliklari ??
            0;


        return Math.max(
            0,
            TMS19.sayi(
                value
            )
        );
    };


/* ================================================================
   33 — NET TANIMLI FAYDA YÜKÜMLÜLÜĞÜ
================================================================ */

TMS19.netDefinedBenefitHesapla =
    function (
        dbo,
        planAssets
    ) {

        const definedBenefitObligation =
            Math.max(
                0,
                TMS19.sayi(
                    dbo
                )
            );


        const assets =
            Math.max(
                0,
                TMS19.sayi(
                    planAssets
                )
            );


        const netPosition =
            definedBenefitObligation -
            assets;


        return {

            dbo:
                definedBenefitObligation,

            planAssets:
                assets,

            netPosition:
                netPosition,

            /*
             * Pozitif:
             * Net Defined Benefit Liability
             *
             * Negatif:
             * Net Defined Benefit Asset
             */

            liability:
                Math.max(
                    0,
                    netPosition
                ),

            asset:
                Math.max(
                    0,
                    -netPosition
                ),

            position:
                netPosition >= 0
                    ? "LIABILITY"
                    : "ASSET"
        };
    };


/* ================================================================
   34 — PLAN VARLIKLARI HAREKETİ
================================================================ */

TMS19.planVarlikRollForward =
    function (
        input = {}
    ) {

        const openingAssets =
            Math.max(
                0,
                TMS19.sayi(
                    input.openingPlanAssets
                )
            );


        const expectedReturn =
            TMS19.sayi(
                input.expectedReturn
            );


        const employerContributions =
            Math.max(
                0,
                TMS19.sayi(
                    input.employerContributions
                )
            );


        const employeeContributions =
            Math.max(
                0,
                TMS19.sayi(
                    input.employeeContributions
                )
            );


        const benefitsPaid =
            Math.max(
                0,
                TMS19.sayi(
                    input.benefitsPaid
                )
            );


        const actuarialGainLoss =
            TMS19.sayi(
                input.actuarialGainLoss
            );


        const closingAssets =
            Math.max(
                0,
                openingAssets +
                expectedReturn +
                employerContributions +
                employeeContributions -
                benefitsPaid +
                actuarialGainLoss
            );


        return {

            openingPlanAssets:
                openingAssets,

            expectedReturn:
                expectedReturn,

            employerContributions:
                employerContributions,

            employeeContributions:
                employeeContributions,

            benefitsPaid:
                benefitsPaid,

            actuarialGainLoss:
                actuarialGainLoss,

            closingPlanAssets:
                closingAssets
        };
    };


/* ================================================================
   35 — NET FAİZ MALİYETİ
================================================================ */

TMS19.netFaizMaliyetiHesapla =
    function (
        openingDBO,
        openingPlanAssets,
        discountRate
    ) {

        const dbo =
            Math.max(
                0,
                TMS19.sayi(
                    openingDBO
                )
            );


        const assets =
            Math.max(
                0,
                TMS19.sayi(
                    openingPlanAssets
                )
            );


        const rate =
            TMS19.sayi(
                discountRate
            );


        /*
         * Net defined benefit liability /
         * asset × discount rate
         */

        return (
            dbo -
            assets
        ) * rate;
    };


/* ================================================================
   36 — P&L HESAPLA
================================================================ */

TMS19.karZararHesapla =
    function (
        input = {}
    ) {

        const currentServiceCost =
            TMS19.sayi(
                input.currentServiceCost
            );


        const pastServiceCost =
            TMS19.sayi(
                input.pastServiceCost
            );


        const netInterestCost =
            TMS19.sayi(
                input.netInterestCost
            );


        /*
         * TMS 19 P&L:
         *
         * Current Service Cost
         * + Past Service Cost
         * + Net Interest
         */

        const total =
            currentServiceCost +
            pastServiceCost +
            netInterestCost;


        return {

            currentServiceCost:
                currentServiceCost,

            pastServiceCost:
                pastServiceCost,

            netInterestCost:
                netInterestCost,

            total:
                total
        };
    };


/* ================================================================
   37 — OCI / REMEASUREMENT
================================================================ */

TMS19.ociHesapla =
    function (
        input = {}
    ) {

        const actuarialGainLossDBO =
            TMS19.sayi(
                input.actuarialGainLossDBO
            );


        const actuarialGainLossPlanAssets =
            TMS19.sayi(
                input.actuarialGainLossPlanAssets
            );


        /*
         * Remeasurement:
         *
         * DBO actuarial gain/loss
         * +
         * Plan asset return
         * excluding net interest
         */

        const remeasurement =
            actuarialGainLossDBO +
            actuarialGainLossPlanAssets;


        return {

            actuarialGainLossDBO:
                actuarialGainLossDBO,

            actuarialGainLossPlanAssets:
                actuarialGainLossPlanAssets,

            remeasurement:
                remeasurement
        };
    };


/* ================================================================
   38 — TAM MUHASEBE ETKİSİ
================================================================ */

TMS19.tamMuhasebeEtkiHesapla =
    function (
        input = {}
    ) {

        const profitLoss =
            TMS19.karZararHesapla({

                currentServiceCost:
                    input.currentServiceCost,

                pastServiceCost:
                    input.pastServiceCost,

                netInterestCost:
                    input.netInterestCost
            });


        const oci =
            TMS19.ociHesapla({

                actuarialGainLossDBO:
                    input.actuarialGainLossDBO,

                actuarialGainLossPlanAssets:
                    input.actuarialGainLossPlanAssets
            });


        const totalExpense =
            profitLoss.total +
            oci.remeasurement;


        return {

            profitLoss:
                profitLoss,

            oci:
                oci,

            totalDefinedBenefitEffect:
                totalExpense
        };
    };


/* ================================================================
   39 — NET DEFINED BENEFIT ROLL-FORWARD
================================================================ */

TMS19.netDefinedBenefitRollForward =
    function (
        input = {}
    ) {

        const openingDBO =
            TMS19.sayi(
                input.openingDBO
            );


        const openingPlanAssets =
            TMS19.sayi(
                input.openingPlanAssets
            );


        const closingDBO =
            TMS19.sayi(
                input.closingDBO
            );


        const closingPlanAssets =
            TMS19.sayi(
                input.closingPlanAssets
            );


        const openingNet =
            openingDBO -
            openingPlanAssets;


        const closingNet =
            closingDBO -
            closingPlanAssets;


        const movement =
            closingNet -
            openingNet;


        return {

            openingDBO:
                openingDBO,

            openingPlanAssets:
                openingPlanAssets,

            openingNetDefinedBenefitPosition:
                openingNet,

            closingDBO:
                closingDBO,

            closingPlanAssets:
                closingPlanAssets,

            closingNetDefinedBenefitPosition:
                closingNet,

            netMovement:
                movement,

            closingLiability:
                Math.max(
                    0,
                    closingNet
                ),

            closingAsset:
                Math.max(
                    0,
                    -closingNet
                ),

            position:
                closingNet >= 0
                    ? "LIABILITY"
                    : "ASSET"
        };
    };


/* ================================================================
   40 — PERSONEL MUHASEBE HESABI
================================================================ */

TMS19.personelMuhasebeHesapla =
    function (
        personel,
        varsayimlar = {},
        index = 0
    ) {

        const actuarial =
            TMS19.personelDonemHesapla(
                personel,
                varsayimlar,
                index
            );


        const period =
            actuarial.period ||
            {};


        const openingPlanAssets =
            TMS19.sayi(
                personel?.openingPlanAssets ??
                personel?.acilisPlanVarliklari ??
                varsayimlar?.openingPlanAssets ??
                0
            );


        const planAssets =
            TMS19.planVarlikHesapla(
                personel,
                varsayimlar
            );


        const netInterestCost =
            TMS19.netFaizMaliyetiHesapla(
                period.openingDBO,
                openingPlanAssets,
                varsayimlar.iskontoOrani
            );


        const profitLoss =
            TMS19.karZararHesapla({

                currentServiceCost:
                    period.currentServiceCost,

                pastServiceCost:
                    period.pastServiceCost,

                netInterestCost:
                    netInterestCost
            });


        const oci =
            TMS19.ociHesapla({

                actuarialGainLossDBO:
                    period.actuarialGainLoss,

                actuarialGainLossPlanAssets:
                    0
            });


        const netPosition =
            TMS19.netDefinedBenefitHesapla(
                period.closingDBO,
                planAssets
            );


        const rollForward =
            TMS19.netDefinedBenefitRollForward({

                openingDBO:
                    period.openingDBO,

                openingPlanAssets:
                    openingPlanAssets,

                closingDBO:
                    period.closingDBO,

                closingPlanAssets:
                    planAssets
            });


        return {

            ...actuarial,


            accounting:
                {

                    planAssets:
                        planAssets,

                    netInterestCost:
                        netInterestCost,

                    netDefinedBenefit:
                        netPosition,

                    profitLoss:
                        profitLoss,

                    oci:
                        oci,

                    rollForward:
                        rollForward
                }
        };
    };


/* ================================================================
   41 — PORTFÖY MUHASEBE HESABI
================================================================ */

TMS19.portfoyMuhasebeHesapla =
    function (
        personeller,
        varsayimlar = {}
    ) {

        if (
            !Array.isArray(
                personeller
            )
        ) {

            throw new Error(
                "Personel listesi array olmalıdır."
            );
        }


        const results =
            [];


        const errors =
            [];


        personeller.forEach(
            (
                personel,
                index
            ) => {

                try {

                    results.push(
                        TMS19.personelMuhasebeHesapla(
                            personel,
                            varsayimlar,
                            index
                        )
                    );

                }
                catch (
                    error
                ) {

                    errors.push({

                        index:
                            index,

                        personelId:
                            personel?.personelId ??
                            personel?.id ??
                            "",

                        error:
                            error.message
                    });
                }
            }
        );


        let dbo =
            0;


        let planAssets =
            0;


        let netPosition =
            0;


        let currentServiceCost =
            0;


        let pastServiceCost =
            0;


        let netInterestCost =
            0;


        let oci =
            0;


        results.forEach(
            result => {

                dbo +=
                    TMS19.sayi(
                        result.accounting
                            ?.netDefinedBenefit
                            ?.dbo
                    );


                planAssets +=
                    TMS19.sayi(
                        result.accounting
                            ?.netDefinedBenefit
                            ?.planAssets
                    );


                netPosition +=
                    TMS19.sayi(
                        result.accounting
                            ?.netDefinedBenefit
                            ?.netPosition
                    );


                currentServiceCost +=
                    TMS19.sayi(
                        result.accounting
                            ?.profitLoss
                            ?.currentServiceCost
                    );


                pastServiceCost +=
                    TMS19.sayi(
                        result.accounting
                            ?.profitLoss
                            ?.pastServiceCost
                    );


                netInterestCost +=
                    TMS19.sayi(
                        result.accounting
                            ?.profitLoss
                            ?.netInterestCost
                    );


                oci +=
                    TMS19.sayi(
                        result.accounting
                            ?.oci
                            ?.remeasurement
                    );
            }
        );


        return {

            results:
                results,

            errors:
                errors,

            summary:
                {

                    personelSayisi:
                        personeller.length,

                    hesaplananPersonel:
                        results.length,

                    hataliPersonel:
                        errors.length,

                    toplamDBO:
                        dbo,

                    toplamPlanVarligi:
                        planAssets,

                    netDefinedBenefitPosition:
                        netPosition,

                    netDefinedBenefitLiability:
                        Math.max(
                            0,
                            netPosition
                        ),

                    netDefinedBenefitAsset:
                        Math.max(
                            0,
                            -netPosition
                        ),

                    cariHizmetMaliyeti:
                        currentServiceCost,

                    gecmisHizmetMaliyeti:
                        pastServiceCost,

                    netFaizMaliyeti:
                        netInterestCost,

                    oci:
                        oci,

                    toplamKarZararEtkisi:
                        currentServiceCost +
                        pastServiceCost +
                        netInterestCost
                },

            success:
                errors.length === 0
        };
    };

/* ================================================================
   TMS 19 — PROJECTED UNIT CREDIT ENGINE
   ----------------------------------------------------------------
   Year-by-Year Actuarial Projection

   Amaç:
   Her personel için değerleme tarihinden emeklilik tarihine kadar
   gelecek yılların beklenen faydalarını hesaplamak.

   Ana akış:

   Değerleme Tarihi
        ↓
   Gelecek Yıllar
        ↓
   Maaş Projeksiyonu
        ↓
   Kıdem Tavanı
        ↓
   Fayda
        ↓
   Hizmet Birikimi
        ↓
   Demografik Olasılık
        ↓
   İskonto
        ↓
   Present Value
================================================================ */


/* ================================================================
   42 — YILLIK MAAŞ PROJEKSİYONU
================================================================ */

TMS19.yillikMaasProjeksiyonu =
    function (
        mevcutMaas,
        yil,
        maasArtisOrani
    ) {

        const salary =
            Math.max(
                0,
                TMS19.sayi(
                    mevcutMaas
                )
            );


        const increase =
            TMS19.sayi(
                maasArtisOrani
            );


        return (
            salary *
            Math.pow(
                1 + increase,
                Math.max(
                    0,
                    yil
                )
            )
        );
    };


/* ================================================================
   43 — YILLIK KIDEM TAVANI
================================================================ */

TMS19.yillikKidemTavani =
    function (
        mevcutTavan,
        yil,
        artisOrani
    ) {

        const ceiling =
            TMS19.sayi(
                mevcutTavan
            );


        if (
            ceiling <= 0
        ) {

            return Infinity;
        }


        const increase =
            TMS19.sayi(
                artisOrani
            );


        return (
            ceiling *
            Math.pow(
                1 + increase,
                Math.max(
                    0,
                    yil
                )
            )
        );
    };


/* ================================================================
   44 — YILLIK DEVAM OLASILIĞI — FAZ 1
================================================================ */

TMS19.yillikDevamOlasiligi =
    function (
        varsayimlar = {},
        yas = null,
        cinsiyet = null
    ) {

        if (
            yas !== null &&
            yas !== undefined
        ) {
            return TMS19.yillikDemografikOlasilik(
                yas,
                cinsiyet,
                varsayimlar
            ).devamOlasiligi;
        }

        const turnover =
            Math.min(
                1,
                Math.max(
                    0,
                    TMS19.sayi(
                        varsayimlar.personelDevirOrani
                    )
                )
            );

        const mortality =
            Math.min(
                1,
                Math.max(
                    0,
                    TMS19.sayi(
                        varsayimlar.olumOrani
                    )
                )
            );

        return (
            1 - turnover
        ) *
        (
            1 - mortality
        );
    };


/* ================================================================
   45 — KÜMÜLATİF DEVAM OLASILIĞI — FAZ 1
================================================================ */

TMS19.kumulatifDevamOlasiligi =
    function (
        yil,
        varsayimlar = {},
        mevcutYas = null,
        cinsiyet = null
    ) {

        if (
            TMS19.sayi(yil) <= 0
        ) {
            return 1;
        }

        if (
            mevcutYas !== null &&
            mevcutYas !== undefined
        ) {

            return TMS19.devamOlasiligi(
                yil,
                varsayimlar,
                mevcutYas,
                cinsiyet
            );
        }

        return Math.pow(
            TMS19.yillikDevamOlasiligi(
                varsayimlar
            ),
            TMS19.sayi(yil)
        );
    };


/* ================================================================
   46 — YILLIK HİZMET BİRİMİ
================================================================ */

TMS19.yillikHizmetBirimi =
    function (
        faydaHesaplamaMaasi,
        faydaOrani
    ) {

        return (
            Math.max(
                0,
                TMS19.sayi(
                    faydaHesaplamaMaasi
                )
            ) *
            Math.max(
                0,
                TMS19.sayi(
                    faydaOrani
                )
            )
        );
    };


/* ================================================================
   47 — PUCl YILLIK PROJECTION
================================================================ */

TMS19.pucProjection =
    function (
        personel,
        varsayimlar = {}
    ) {

        const p =
            TMS19.personelNormalizeEt(
                personel
            );


        const degerlemeTarihi =
            TMS19.tarih(
                varsayimlar
                    .degerlemeTarihi
            );


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


        if (
            !degerlemeTarihi ||
            !dogumTarihi ||
            !iseGirisTarihi
        ) {

            throw new Error(
                "PUC projection için tarih bilgileri eksik."
            );
        }


        const currentAge =
            TMS19.yasHesapla(
                dogumTarihi,
                degerlemeTarihi
            );


        const currentService =
            TMS19.yilFarki(
                iseGirisTarihi,
                degerlemeTarihi
            );


        const sgkEmeklilikPuc =
            TMS19.sgkEmeklilikBilgisiHesapla(
                p,
                varsayimlar,
                degerlemeTarihi
            );


        const retirementAge =
            sgkEmeklilikPuc.emeklilikYasi;


        const remainingYears =
            sgkEmeklilikPuc.emeklilikTarihi
                ? Math.max(
                    0,
                    TMS19.yilFarki(
                        degerlemeTarihi,
                        sgkEmeklilikPuc.emeklilikTarihi
                    )
                )
                : Math.max(
                    0,
                    retirementAge -
                    currentAge
                );


        const totalServiceAtRetirement =
            currentService +
            remainingYears;


        const salaryGrowth =
            TMS19.sayi(
                varsayimlar
                    .maasArtisOrani
            );


        const discountRate =
            TMS19.sayi(
                varsayimlar
                    .iskontoOrani
            );


        const benefitRate =
            TMS19.sayi(
                varsayimlar
                    .faydaOrani
            );


        const ceiling =
            TMS19.sayi(
                varsayimlar
                    .kidemTavani
            );


        const ceilingGrowth =
            TMS19.sayi(
                varsayimlar
                    .kidemTavaniArtisOrani
            );


        const projection =
            [];


        let cumulativeProbability =
            1;


        let totalPresentValue =
            0;


        let totalExpectedBenefit =
            0;


        /*
         * Değerleme tarihinden emekliliğe kadar
         * her yıl için hesaplama.
         */

        for (
            let year = 1;
            year <= remainingYears;
            year++
        ) {

            const projectedAge =
                currentAge +
                year;


            const projectedService =
                currentService +
                year;


            /*
             * Maaş
             */

            const projectedSalary =
                TMS19.yillikMaasProjeksiyonu(
                    mevcutMaas,
                    year,
                    salaryGrowth
                );


            /*
             * Kıdem tavanı
             */

            const projectedCeiling =
                TMS19.yillikKidemTavani(
                    ceiling,
                    year,
                    ceilingGrowth
                );


            /*
             * Fayda hesabında kullanılacak maaş.
             */

            const benefitSalary =
                Math.min(
                    projectedSalary,
                    projectedCeiling
                );


            /*
             * Yıllık fayda.
             */

            const annualBenefit =
                TMS19.yillikHizmetBirimi(
                    benefitSalary,
                    benefitRate
                );


            /*
             * Emeklilikte toplam beklenen fayda.
             *
             * Burada geçmiş + gelecek hizmet
             * dikkate alınır.
             */

            const accruedBenefitAtRetirement =
                annualBenefit *
                totalServiceAtRetirement;


            /*
             * Yıllık devam olasılığı.
             */

            const annualProbability =
                TMS19.yillikDevamOlasiligi(
                    varsayimlar,
                    projectedAge,
                    p.cinsiyet
                );


            cumulativeProbability *=
                annualProbability;


            /*
             * Beklenen fayda.
             */

            const expectedBenefit =
                accruedBenefitAtRetirement *
                cumulativeProbability;


            /*
             * Gelecekteki faydanın bugünkü değeri.
             */

            const discountFactor =
                TMS19.iskontoFaktoru(
                    discountRate,
                    year
                );


            const presentValue =
                expectedBenefit *
                discountFactor;


            totalExpectedBenefit +=
                expectedBenefit;


            totalPresentValue +=
                presentValue;


            projection.push({

                year:
                    year,

                age:
                    projectedAge,

                service:
                    projectedService,

                yearsToRetirement:
                    remainingYears -
                    year,


                projectedSalary:
                    projectedSalary,

                projectedCeiling:
                    projectedCeiling,

                benefitSalary:
                    benefitSalary,

                annualBenefit:
                    annualBenefit,

                accruedBenefit:
                    accruedBenefitAtRetirement,

                annualProbability:
                    annualProbability,

                cumulativeProbability:
                    cumulativeProbability,

                expectedBenefit:
                    expectedBenefit,

                discountRate:
                    discountRate,

                discountFactor:
                    discountFactor,

                presentValue:
                    presentValue
            });
        }


        /*
         * Eğer kişi emeklilik yaşındaysa
         * doğrudan mevcut hizmet üzerinden
         * fayda hesapla.
         */

        if (
            remainingYears === 0
        ) {

            const benefitSalary =
                Math.min(
                    mevcutMaas,
                    ceiling > 0
                        ? ceiling
                        : Infinity
                );


            const accruedBenefit =
                benefitSalary *
                benefitRate *
                currentService;


            totalExpectedBenefit =
                accruedBenefit;


            totalPresentValue =
                accruedBenefit;
        }


        return {

            personelId:
                p.personelId,

            currentAge:
                currentAge,

            currentService:
                currentService,

            retirementAge:
                retirementAge,

            remainingYears:
                remainingYears,

            totalServiceAtRetirement:
                totalServiceAtRetirement,

            projection:
                projection,

            totalExpectedBenefit:
                totalExpectedBenefit,

            projectedDBO:
                totalPresentValue
        };
    };


/* ================================================================
   48 — PORTFÖY PUC PROJECTION
================================================================ */

TMS19.portfoyPucProjection =
    function (
        personeller,
        varsayimlar = {}
    ) {

        if (
            !Array.isArray(
                personeller
            )
        ) {

            throw new Error(
                "Personel listesi array olmalıdır."
            );
        }


        const results =
            [];


        const errors =
            [];


        personeller.forEach(
            (
                personel,
                index
            ) => {

                try {

                    const result =
                        TMS19.pucProjection(
                            personel,
                            varsayimlar
                        );


                    result.index =
                        index;


                    results.push(
                        result
                    );

                }

                catch (
                    error
                ) {

                    errors.push({

                        index:
                            index,

                        personelId:
                            personel?.personelId ??
                            personel?.id ??
                            "",

                        error:
                            error.message
                    });
                }
            }
        );


        const totalDBO =
            results.reduce(
                (
                    total,
                    item
                ) => {

                    return (
                        total +
                        TMS19.sayi(
                            item.projectedDBO
                        )
                    );

                },
                0
            );


        const totalExpectedBenefit =
            results.reduce(
                (
                    total,
                    item
                ) => {

                    return (
                        total +
                        TMS19.sayi(
                            item.totalExpectedBenefit
                        )
                    );

                },
                0
            );


        return {

            results:
                results,

            errors:
                errors,

            summary:
                {

                    personelSayisi:
                        personeller.length,

                    hesaplananPersonel:
                        results.length,

                    hataliPersonel:
                        errors.length,

                    toplamDBO:
                        totalDBO,

                    toplamBeklenenFayda:
                        totalExpectedBenefit
                },

            success:
                errors.length === 0
        };
    };


/* ================================================================
   49 — PUC VS MEVCUT DBO KARŞILAŞTIRMASI
================================================================ */

TMS19.pucKarsilastirma =
    function (
        personeller,
        varsayimlar = {}
    ) {

        const puc =
            TMS19.portfoyPucProjection(
                personeller,
                varsayimlar
            );


        const mevcut =
            TMS19.portfoyDonemHesapla(
                personeller,
                varsayimlar
            );


        const pucDBO =
            TMS19.sayi(
                puc.summary
                    .toplamDBO
            );


        const currentDBO =
            TMS19.sayi(
                mevcut.summary
                    .closingDBO
            );


        const difference =
            pucDBO -
            currentDBO;


        const percentage =
            currentDBO !== 0
                ? difference /
                  Math.abs(
                      currentDBO
                  )
                : 0;


        return {

            puc:
                puc,

            current:
                mevcut,

            comparison:
                {

                    pucDBO:
                        pucDBO,

                    currentDBO:
                        currentDBO,

                    difference:
                        difference,

                    percentage:
                        percentage
                }
        };
    };


/* ================================================================
   50 — PUC HEALTH CHECK
================================================================ */

TMS19.pucHealthCheck =
    function () {

        const functions =
            [

                "yillikMaasProjeksiyonu",

                "yillikKidemTavani",

                "yillikDevamOlasiligi",

                "kumulatifDevamOlasiligi",

                "yillikHizmetBirimi",

                "pucProjection",

                "portfoyPucProjection",

                "pucKarsilastirma"
            ];


        const status =
            {};


        let healthy =
            true;


        functions.forEach(
            functionName => {

                const exists =
                    typeof TMS19[
                        functionName
                    ] ===
                    "function";


                status[
                    functionName
                ] =
                    exists;


                if (
                    !exists
                ) {

                    healthy =
                        false;
                }
            }
        );


        return {

            healthy:
                healthy,

            functions:
                status,

            timestamp:
                new Date()
                    .toISOString()
        };
    };

/* ================================================================
   TMS 19 — PUC ALLOCATION ENGINE
   ----------------------------------------------------------------
   Projected Unit Credit Method

   Ana prensip:

   Emeklilikte beklenen toplam fayda
              ↓
       Toplam hizmet süresine
           dağıtılır
              ↓
   Değerleme tarihine kadar kazanılmış hizmet
              ↓
          DBO / PUC
================================================================ */


/* ================================================================
   51 — EMEKLİLİKTE BEKLENEN TOPLAM FAYDA
================================================================ */

TMS19.emeklilikToplamFayda =
    function (
        personel,
        varsayimlar = {}
    ) {

        const p =
            TMS19.personelNormalizeEt(
                personel
            );


        const degerlemeTarihi =
            TMS19.tarih(
                varsayimlar.degerlemeTarihi
            );


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


        const sgkEmeklilikToplam =
            TMS19.sgkEmeklilikBilgisiHesapla(
                p,
                varsayimlar,
                degerlemeTarihi
            );


        const emeklilikYasi =
            sgkEmeklilikToplam.emeklilikYasi;


        const kalanYil =
            sgkEmeklilikToplam.emeklilikTarihi
                ? Math.max(
                    0,
                    TMS19.yilFarki(
                        degerlemeTarihi,
                        sgkEmeklilikToplam.emeklilikTarihi
                    )
                )
                : Math.max(
                    0,
                    emeklilikYasi -
                    yas
                );


        const toplamHizmet =
            hizmetSuresi +
            kalanYil;


        /*
         * Emeklilik tarihindeki maaş.
         */

        const emeklilikMaasi =
            TMS19.yillikMaasProjeksiyonu(
                mevcutMaas,
                kalanYil,
                varsayimlar.maasArtisOrani
            );


        /*
         * Emeklilik tarihindeki kıdem tavanı.
         */

        const emeklilikTavani =
            TMS19.yillikKidemTavani(
                varsayimlar.kidemTavani,
                kalanYil,
                varsayimlar.kidemTavaniArtisOrani
            );


        /*
         * Fayda hesabına girecek maaş.
         */

        const faydaMaasi =
            Math.min(
                emeklilikMaasi,
                emeklilikTavani
            );


        /*
         * Emeklilikte toplam beklenen fayda.
         */

        const faydaOrani =
            TMS19.sayi(
                varsayimlar.faydaOrani
            );


        const toplamFayda =
            faydaMaasi *
            faydaOrani *
            toplamHizmet;


        return {

            mevcutYas:
                yas,

            mevcutHizmet:
                hizmetSuresi,

            kalanYil:
                kalanYil,

            toplamHizmet:
                toplamHizmet,

            emeklilikMaasi:
                emeklilikMaasi,

            emeklilikTavani:
                emeklilikTavani,

            faydaMaasi:
                faydaMaasi,

            faydaOrani:
                faydaOrani,

            toplamFayda:
                toplamFayda
        };
    };


/* ================================================================
   52 — PUC HİZMET TAHSİSİ
================================================================ */

TMS19.pucHizmetTahsisEt =
    function (
        toplamFayda,
        gecmisHizmet,
        toplamHizmet
    ) {

        const benefit =
            Math.max(
                0,
                TMS19.sayi(
                    toplamFayda
                )
            );


        const pastService =
            Math.max(
                0,
                TMS19.sayi(
                    gecmisHizmet
                )
            );


        const totalService =
            Math.max(
                0,
                TMS19.sayi(
                    toplamHizmet
                )
            );


        if (
            totalService <= 0
        ) {

            return {

                pastServiceBenefit:
                    0,

                futureServiceBenefit:
                    benefit,

                allocationRatio:
                    0
            };
        }


        const allocationRatio =
            Math.min(
                1,
                pastService /
                totalService
            );


        const pastServiceBenefit =
            benefit *
            allocationRatio;


        const futureServiceBenefit =
            benefit -
            pastServiceBenefit;


        return {

            pastServiceBenefit:
                pastServiceBenefit,

            futureServiceBenefit:
                futureServiceBenefit,

            allocationRatio:
                allocationRatio
        };
    };


/* ================================================================
   53 — PUCl BUGÜNKÜ YÜKÜMLÜLÜK
================================================================ */

TMS19.pucDboHesapla =
    function (
        emeklilikFayda,
        gecmisHizmet,
        toplamHizmet,
        kalanYil,
        varsayimlar = {}
    ) {

        const allocation =
            TMS19.pucHizmetTahsisEt(
                emeklilikFayda,
                gecmisHizmet,
                toplamHizmet
            );


        /*
         * Geçmiş hizmete tahsis edilen fayda.
         */

        const accruedBenefit =
            allocation.pastServiceBenefit;


        /*
         * Demografik devam olasılığı.
         */

        const survivalProbability =
            TMS19.kumulatifDevamOlasiligi(
                kalanYil,
                varsayimlar
            );


        /*
         * Beklenen değer.
         */

        const expectedBenefit =
            accruedBenefit *
            survivalProbability;


        /*
         * Bugünkü değer.
         */

        const discountFactor =
            TMS19.iskontoFaktoru(
                varsayimlar.iskontoOrani,
                kalanYil
            );


        const dbo =
            expectedBenefit *
            discountFactor;


        return {

            accruedBenefit:
                accruedBenefit,

            futureServiceBenefit:
                allocation.futureServiceBenefit,

            allocationRatio:
                allocation.allocationRatio,

            survivalProbability:
                survivalProbability,

            discountFactor:
                discountFactor,

            dbo:
                dbo
        };
    };


/* ================================================================
   54 — PERSONEL BAZLI GERÇEK PUC HESABI
================================================================ */

TMS19.personelPucHesapla =
    function (
        personel,
        varsayimlar = {},
        index = 0
    ) {

        const p =
            TMS19.personelNormalizeEt(
                personel
            );


        /*
         * Validation
         */

        const validation =
            TMS19.personelValidate(
                personel
            );


        if (
            !validation.valid
        ) {

            throw new Error(
                validation.errors.join(
                    " "
                )
            );
        }


        /*
         * Emeklilik faydası.
         */

        const retirementBenefit =
            TMS19.emeklilikToplamFayda(
                personel,
                varsayimlar
            );


        /*
         * PUC tahsisi.
         */

        const puc =
            TMS19.pucDboHesapla(

                retirementBenefit.toplamFayda,

                retirementBenefit.mevcutHizmet,

                retirementBenefit.toplamHizmet,

                retirementBenefit.kalanYil,

                varsayimlar
            );


        /*
         * Current Service Cost
         *
         * Bir yıllık hizmet biriminin,
         * gelecekteki ödeme riskleri ve
         * iskonto dikkate alınarak bugünkü değeri.
         */

        const annualServiceBenefit =
            retirementBenefit.toplamHizmet > 0
                ? retirementBenefit.toplamFayda /
                  retirementBenefit.toplamHizmet
                : 0;


        const nextYearProbability =
            TMS19.kumulatifDevamOlasiligi(
                retirementBenefit.kalanYil > 0
                    ? retirementBenefit.kalanYil - 1
                    : 0,
                varsayimlar
            );


        const nextYearDiscount =
            TMS19.iskontoFaktoru(
                varsayimlar.iskontoOrani,
                retirementBenefit.kalanYil
            );


        const currentServiceCost =
            annualServiceBenefit *
            nextYearProbability *
            nextYearDiscount;


        /*
         * Interest Cost
         *
         * Opening DBO × discount rate
         */

        const openingDBO =
            TMS19.sayi(
                personel.openingDBO ??
                personel.acilisDBO ??
                0
            );


        const interestCost =
            openingDBO *
            TMS19.sayi(
                varsayimlar.iskontoOrani
            );


        /*
         * Eğer opening DBO verilmemişse,
         * mevcut PUC DBO üzerinden alternatif
         * hesap kullanılabilir.
         */

        const effectiveInterestCost =
            openingDBO > 0
                ? interestCost
                : puc.dbo *
                  TMS19.sayi(
                      varsayimlar.iskontoOrani
                  );


        return {

            index:
                index,

            personelId:
                p.personelId,

            yas:
                retirementBenefit.mevcutYas,

            hizmetSuresi:
                retirementBenefit.mevcutHizmet,

            kalanYil:
                retirementBenefit.kalanYil,

            toplamHizmet:
                retirementBenefit.toplamHizmet,


            /*
             * Projection
             */

            emeklilik:
                {

                    emeklilikMaasi:
                        retirementBenefit.emeklilikMaasi,

                    emeklilikTavani:
                        retirementBenefit.emeklilikTavani,

                    faydaMaasi:
                        retirementBenefit.faydaMaasi,

                    toplamFayda:
                        retirementBenefit.toplamFayda
                },


            /*
             * PUC
             */

            puc:
                {

                    accruedBenefit:
                        puc.accruedBenefit,

                    futureServiceBenefit:
                        puc.futureServiceBenefit,

                    allocationRatio:
                        puc.allocationRatio,

                    survivalProbability:
                        puc.survivalProbability,

                    discountFactor:
                        puc.discountFactor,

                    dbo:
                        puc.dbo
                },


            /*
             * P&L
             */

            accounting:
                {

                    currentServiceCost:
                        currentServiceCost,

                    interestCost:
                        effectiveInterestCost,

                    pastServiceCost:
                        0,

                    profitLoss:
                        currentServiceCost +
                        effectiveInterestCost
                },


            /*
             * Kontrol alanları
             */

            quality:
                {

                    dboPositive:
                        puc.dbo >= 0,

                    serviceAllocationValid:
                        puc.allocationRatio >= 0 &&
                        puc.allocationRatio <= 1,

                    probabilityValid:
                        puc.survivalProbability >= 0 &&
                        puc.survivalProbability <= 1,

                    discountFactorValid:
                        puc.discountFactor > 0
                }
        };
    };


/* ================================================================
   55 — PORTFÖY GERÇEK PUC
================================================================ */

TMS19.portfoyPucHesapla =
    function (
        personeller,
        varsayimlar = {}
    ) {

        if (
            !Array.isArray(
                personeller
            )
        ) {

            throw new Error(
                "Personel listesi array olmalıdır."
            );
        }


        const results =
            [];


        const errors =
            [];


        personeller.forEach(
            (
                personel,
                index
            ) => {

                try {

                    results.push(

                        TMS19.personelPucHesapla(
                            personel,
                            varsayimlar,
                            index
                        )

                    );

                }

                catch (
                    error
                ) {

                    errors.push({

                        index:
                            index,

                        personelId:
                            personel?.personelId ??
                            personel?.id ??
                            "",

                        error:
                            error.message
                    });
                }
            }
        );


        /*
         * TOPLAMLAR
         */

        const toplamDBO =
            results.reduce(
                (
                    sum,
                    r
                ) => {

                    return (
                        sum +
                        TMS19.sayi(
                            r.puc?.dbo
                        )
                    );

                },
                0
            );


        const toplamCariHizmetMaliyeti =
            results.reduce(
                (
                    sum,
                    r
                ) => {

                    return (
                        sum +
                        TMS19.sayi(
                            r.accounting
                                ?.currentServiceCost
                        )
                    );

                },
                0
            );


        const toplamFaizMaliyeti =
            results.reduce(
                (
                    sum,
                    r
                ) => {

                    return (
                        sum +
                        TMS19.sayi(
                            r.accounting
                                ?.interestCost
                        )
                    );

                },
                0
            );


        const toplamGecmisHizmet =
            results.reduce(
                (
                    sum,
                    r
                ) => {

                    return (
                        sum +
                        TMS19.sayi(
                            r.accounting
                                ?.pastServiceCost
                        )
                    );

                },
                0
            );


        /*
         * YILLIK P&L
         */

        const toplamKarZarar =
            toplamCariHizmetMaliyeti +
            toplamFaizMaliyeti +
            toplamGecmisHizmet;


        /*
         * PLAN VARLIKLARI
         */

        const toplamPlanVarligi =
            personeller.reduce(
                (
                    sum,
                    personel
                ) => {

                    return (
                        sum +
                        Math.max(
                            0,
                            TMS19.sayi(
                                personel.planAssets ??
                                personel.planVarliklari ??
                                0
                            )
                        )
                    );

                },
                0
            );


        /*
         * NET POZİSYON
         */

        const netDefinedBenefitPosition =
            toplamDBO -
            toplamPlanVarligi;


        return {

            success:
                errors.length === 0,

            results:
                results,

            errors:
                errors,

            summary:
                {

                    personelSayisi:
                        personeller.length,

                    hesaplananPersonel:
                        results.length,

                    hataliPersonel:
                        errors.length,

                    toplamDBO:
                        toplamDBO,

                    toplamPlanVarligi:
                        toplamPlanVarligi,

                    netDefinedBenefitPosition:
                        netDefinedBenefitPosition,

                    netDefinedBenefitLiability:
                        Math.max(
                            0,
                            netDefinedBenefitPosition
                        ),

                    netDefinedBenefitAsset:
                        Math.max(
                            0,
                            -netDefinedBenefitPosition
                        ),

                    toplamCariHizmetMaliyeti:
                        toplamCariHizmetMaliyeti,

                    toplamFaizMaliyeti:
                        toplamFaizMaliyeti,

                    toplamGecmisHizmetMaliyeti:
                        toplamGecmisHizmet,

                    toplamKarZararEtkisi:
                        toplamKarZarar
                }
        };
    };


/* ================================================================
   56 — PUC RECONCILIATION
================================================================ */

TMS19.pucReconciliation =
    function (
        personeller,
        varsayimlar = {}
    ) {

        const puc =
            TMS19.portfoyPucHesapla(
                personeller,
                varsayimlar
            );


        const oldEngine =
            TMS19.portfoyDonemHesapla(
                personeller,
                varsayimlar
            );


        const pucDBO =
            TMS19.sayi(
                puc.summary
                    .toplamDBO
            );


        const oldDBO =
            TMS19.sayi(
                oldEngine.summary
                    .closingDBO
            );


        const difference =
            pucDBO -
            oldDBO;


        const percentage =
            oldDBO !== 0
                ? difference /
                  Math.abs(
                      oldDBO
                  )
                : 0;


        return {

            pucDBO:
                pucDBO,

            legacyDBO:
                oldDBO,

            difference:
                difference,

            differencePercentage:
                percentage,

            puc:
                puc,

            legacy:
                oldEngine
        };
    };


/* ================================================================
   57 — PUC ENGINE HEALTH CHECK
================================================================ */

TMS19.pucEngineHealthCheck =
    function () {

        const requiredFunctions =
            [

                "emeklilikToplamFayda",

                "pucHizmetTahsisEt",

                "pucDboHesapla",

                "personelPucHesapla",

                "portfoyPucHesapla",

                "pucReconciliation"
            ];


        const status =
            {};


        let healthy =
            true;


        requiredFunctions.forEach(
            name => {

                const exists =
                    typeof TMS19[name] ===
                    "function";


                status[name] =
                    exists;


                if (
                    !exists
                ) {

                    healthy =
                        false;
                }
            }
        );


        return {

            healthy:
                healthy,

            functions:
                status,

            timestamp:
                new Date()
                    .toISOString()
        };
    };


/* ================================================================
   TMS 19 — ACTUARIAL MOVEMENT ENGINE
   ----------------------------------------------------------------
   Opening DBO → Closing DBO reconciliation
================================================================ */

TMS19.dboMovementHesapla =
    function (
        openingDBO,
        currentServiceCost,
        interestCost,
        pastServiceCost,
        actuarialGainLoss,
        benefitsPaid
    ) {

        const opening =
            TMS19.sayi(
                openingDBO
            );

        const currentService =
            TMS19.sayi(
                currentServiceCost
            );

        const interest =
            TMS19.sayi(
                interestCost
            );

        const pastService =
            TMS19.sayi(
                pastServiceCost
            );

        const actuarial =
            TMS19.sayi(
                actuarialGainLoss
            );

        const benefits =
            TMS19.sayi(
                benefitsPaid
            );


        /*
         * TMS 19 DBO reconciliation
         *
         * Opening DBO
         * + Current Service Cost
         * + Interest Cost
         * + Past Service Cost
         * +/- Actuarial Gain/Loss
         * - Benefits Paid
         * = Closing DBO
         */

        const closingDBO =
            opening +
            currentService +
            interest +
            pastService +
            actuarial -
            benefits;


        return {

            openingDBO:
                opening,

            currentServiceCost:
                currentService,

            interestCost:
                interest,

            pastServiceCost:
                pastService,

            actuarialGainLoss:
                actuarial,

            benefitsPaid:
                benefits,

            closingDBO:
                closingDBO
        };
    };


/* ================================================================
   DBO MOVEMENT VALIDATION
================================================================ */

TMS19.dboMovementValidate =
    function (
        movement
    ) {

        if (
            !movement
        ) {

            return {

                valid:
                    false,

                errors:
                    [
                        "DBO movement bulunamadı."
                    ]
            };
        }


        const calculated =
            TMS19.sayi(
                movement.openingDBO
            ) +

            TMS19.sayi(
                movement.currentServiceCost
            ) +

            TMS19.sayi(
                movement.interestCost
            ) +

            TMS19.sayi(
                movement.pastServiceCost
            ) +

            TMS19.sayi(
                movement.actuarialGainLoss
            ) -

            TMS19.sayi(
                movement.benefitsPaid
            );


        const reported =
            TMS19.sayi(
                movement.closingDBO
            );


        const difference =
            calculated -
            reported;


        const tolerance =
            0.01;


        return {

            valid:
                Math.abs(
                    difference
                ) <= tolerance,

            calculatedClosingDBO:
                calculated,

            reportedClosingDBO:
                reported,

            difference:
                difference
        };
    };


/* ================================================================
   P&L COMPONENTS
================================================================ */

TMS19.plHesapla =
    function (
        currentServiceCost,
        interestCost,
        pastServiceCost
    ) {

        const currentService =
            TMS19.sayi(
                currentServiceCost
            );

        const interest =
            TMS19.sayi(
                interestCost
            );

        const pastService =
            TMS19.sayi(
                pastServiceCost
            );


        return {

            currentServiceCost:
                currentService,

            netInterestCost:
                interest,

            pastServiceCost:
                pastService,

            totalPLImpact:
                currentService +
                interest +
                pastService
        };
    };


/* ================================================================
   OCI — ACTUARIAL GAIN / LOSS
================================================================ */

TMS19.ociHesapla =
    function (
        actuarialGainLoss
    ) {

        const amount =
            TMS19.sayi(
                actuarialGainLoss
            );


        return {

            actuarialGainLoss:
                amount,

            ociImpact:
                amount
        };
    };


/* ================================================================
   FAZ 1 VERİ KONTRATI
   ---------------------------------------------------------------
   varsayimlar.tuikHayatTablosuKadin = [
       { yas: 18, qx: 0 }, ... { yas: 65, qx: 0 }
   ];
   varsayimlar.tuikHayatTablosuErkek = [
       { yas: 18, qx: 0 }, ... { yas: 65, qx: 0 }
   ];

   qx değerleri dışarıdan verilmezse ölüm olasılığı 0 kabul edilir.
   Varsayılan ölüm oranı kullanılmaz.
================================================================ */


/* ================================================================
   NET DEFINED BENEFIT POSITION
================================================================ */

TMS19.netYukumlulukHesapla =
    function (
        closingDBO,
        planAssets
    ) {

        const dbo =
            Math.max(
                0,
                TMS19.sayi(
                    closingDBO
                )
            );


        const assets =
            Math.max(
                0,
                TMS19.sayi(
                    planAssets
                )
            );


        const netPosition =
            dbo -
            assets;


        return {

            closingDBO:
                dbo,

            planAssets:
                assets,

            netDefinedBenefitPosition:
                netPosition,

            netDefinedBenefitLiability:
                Math.max(
                    0,
                    netPosition
                ),

            netDefinedBenefitAsset:
                Math.max(
                    0,
                    -netPosition
                )
        };
    };



/* ================================================================
   FAZ 2 — TMS 19 PUC + DBO ÇEKİRDEĞİ
   Mevcut Faz 1 fonksiyonlarını tekrar tanımlamaz.
================================================================ */

TMS19.pucHizmetOrani =
    function (mevcutHizmet, toplamHizmet) {
        const m = Math.max(0, TMS19.sayi(mevcutHizmet));
        const t = Math.max(m, TMS19.sayi(toplamHizmet));
        return t > 0 ? Math.min(1, m / t) : 0;
    };


TMS19.pucFaydaDagilimi =
    function (toplamFayda, mevcutHizmet, toplamHizmet) {

        const fayda = Math.max(0, TMS19.sayi(toplamFayda));
        const oran =
            TMS19.pucHizmetOrani(
                mevcutHizmet,
                toplamHizmet
            );

        return {
            toplamFayda: fayda,
            kazanilmisFayda: fayda * oran,
            gelecekHizmetFayda:
                fayda * (1 - oran),
            hizmetOrani: oran
        };
    };


TMS19.dboBugunkuDeger =
    function (
        beklenenFayda,
        iskontoOrani,
        yil
    ) {

        const fayda =
            Math.max(
                0,
                TMS19.sayi(beklenenFayda)
            );

        const oran =
            TMS19.sayi(iskontoOrani);

        const n =
            Math.max(
                0,
                TMS19.sayi(yil)
            );

        if (n === 0) return fayda;

        return fayda /
            Math.pow(
                1 + oran,
                n
            );
    };


TMS19.pucDbo =
    function (
        toplamFayda,
        mevcutHizmet,
        toplamHizmet,
        devamOlasiligi,
        iskontoOrani,
        kalanYil
    ) {

        const dagilim =
            TMS19.pucFaydaDagilimi(
                toplamFayda,
                mevcutHizmet,
                toplamHizmet
            );

        const survival =
            Math.min(
                1,
                Math.max(
                    0,
                    TMS19.sayi(
                        devamOlasiligi
                    )
                )
            );

        const beklenenFayda =
            dagilim.kazanilmisFayda *
            survival;

        const dbo =
            TMS19.dboBugunkuDeger(
                beklenenFayda,
                iskontoOrani,
                kalanYil
            );

        return {
            toplamFayda:
                dagilim.toplamFayda,

            kazanilmisFayda:
                dagilim.kazanilmisFayda,

            gelecekHizmetFayda:
                dagilim.gelecekHizmetFayda,

            hizmetOrani:
                dagilim.hizmetOrani,

            devamOlasiligi:
                survival,

            beklenenFayda,

            iskontoFaktoru:
                dbo === 0 || beklenenFayda === 0
                    ? 0
                    : dbo / beklenenFayda,

            dbo
        };
    };


TMS19.currentServiceCost =
    function (
        toplamFayda,
        toplamHizmet,
        gelecekYilDevamOlasiligi,
        iskontoOrani,
        kalanYil
    ) {

        const hizmet =
            Math.max(
                0,
                TMS19.sayi(toplamHizmet)
            );

        if (hizmet <= 0) return 0;

        const yillikFayda =
            Math.max(
                0,
                TMS19.sayi(toplamFayda)
            ) / hizmet;

        return TMS19.dboBugunkuDeger(
            yillikFayda *
                Math.min(
                    1,
                    Math.max(
                        0,
                        TMS19.sayi(
                            gelecekYilDevamOlasiligi
                        )
                    )
                ),
            iskontoOrani,
            kalanYil
        );
    };


TMS19.netFaizDBO =
    function (
        openingDBO,
        iskontoOrani
    ) {

        return Math.max(
            0,
            TMS19.sayi(openingDBO)
        ) *
        TMS19.sayi(iskontoOrani);
    };


TMS19.dboRollForward =
    function ({
        openingDBO = 0,
        currentServiceCost = 0,
        interestCost = 0,
        benefitsPaid = 0,
        actuarialGainLoss = 0,
        pastServiceCost = 0
    } = {}) {

        const opening =
            TMS19.sayi(openingDBO);

        const csc =
            TMS19.sayi(currentServiceCost);

        const interest =
            TMS19.sayi(interestCost);

        const paid =
            TMS19.sayi(benefitsPaid);

        const actuarial =
            TMS19.sayi(actuarialGainLoss);

        const past =
            TMS19.sayi(pastServiceCost);

        /*
         * Pozitif aktüeryal kazanç DBO'yu azaltır.
         * Bu nedenle kazanç (+), kayıp (-) olarak
         * kullanıcı girdisi kabul edilir.
         */
        const closing =
            opening +
            csc +
            interest +
            past -
            actuarial -
            paid;

        return {
            openingDBO: opening,
            currentServiceCost: csc,
            interestCost: interest,
            pastServiceCost: past,
            actuarialGainLoss: actuarial,
            benefitsPaid: paid,
            closingDBO: closing,
            reconciliationDifference:
                opening +
                csc +
                interest +
                past -
                actuarial -
                paid -
                closing
        };
    };


TMS19.pucDboKontrol =
    function (sonuc) {

        const errors = [];

        if (!sonuc) {
            return {
                valid: false,
                errors: [
                    "PUC/DBO sonucu bulunamadı."
                ]
            };
        }

        const toplam =
            TMS19.sayi(
                sonuc.kazanilmisFayda
            );

        const dbo =
            TMS19.sayi(
                sonuc.dbo
            );

        if (toplam < 0 || dbo < 0) {
            errors.push(
                "PUC/DBO negatif olamaz."
            );
        }

        if (
            sonuc.hizmetOrani < 0 ||
            sonuc.hizmetOrani > 1
        ) {
            errors.push(
                "Hizmet oranı 0-1 aralığında olmalı."
            );
        }

        if (
            sonuc.devamOlasiligi < 0 ||
            sonuc.devamOlasiligi > 1
        ) {
            errors.push(
                "Devam olasılığı 0-1 aralığında olmalı."
            );
        }

        return {
            valid: errors.length === 0,
            errors
        };
    };


TMS19.faz2PersonelHesapla =
    function (
        personel,
        varsayimlar = {},
        index = 0
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
            validation &&
            validation.valid === false
        ) {
            throw new Error(
                validation.errors.join(" ")
            );
        }

        const fayda =
            TMS19.emeklilikToplamFayda
                ? TMS19.emeklilikToplamFayda(
                    personel,
                    varsayimlar
                )
                : null;

        if (!fayda) {
            throw new Error(
                "emeklilikToplamFayda bulunamadı."
            );
        }

        const kalanYil =
            Math.max(
                0,
                TMS19.sayi(
                    fayda.kalanYil
                )
            );

        const mevcutHizmet =
            Math.max(
                0,
                TMS19.sayi(
                    fayda.mevcutHizmet
                )
            );

        const toplamHizmet =
            Math.max(
                mevcutHizmet,
                TMS19.sayi(
                    fayda.toplamHizmet
                )
            );

        const yas =
            TMS19.yasHesapla(
                p.dogumTarihi,
                varsayimlar.degerlemeTarihi
            );

        const demo =
            TMS19.personelDemografikHesapla
                ? TMS19.personelDemografikHesapla(
                    personel,
                    kalanYil,
                    varsayimlar
                )
                : null;

        const devam =
            demo
                ? TMS19.sayi(
                    demo.devamOlasiligi
                )
                : 1;

        const dbo =
            TMS19.pucDbo(
                fayda.toplamFayda,
                mevcutHizmet,
                toplamHizmet,
                devam,
                varsayimlar.iskontoOrani,
                kalanYil
            );

        const gelecekYilDevam =
            kalanYil > 1 && demo
                ? TMS19.kumulatifDevamOlasiligiYas
                    ? TMS19.kumulatifDevamOlasiligiYas(
                        yas,
                        kalanYil - 1,
                        p.cinsiyet,
                        varsayimlar
                    )
                    : devam
                : 1;

        const csc =
            TMS19.currentServiceCost(
                fayda.toplamFayda,
                toplamHizmet,
                gelecekYilDevam,
                varsayimlar.iskontoOrani,
                kalanYil
            );

        const openingDBO =
            TMS19.sayi(
                personel.openingDBO ??
                personel.acilisDBO ??
                0
            );

        const interestCost =
            TMS19.netFaizDBO(
                openingDBO,
                varsayimlar.iskontoOrani
            );

        const rollForward =
            TMS19.dboRollForward({
                openingDBO,
                currentServiceCost: csc,
                interestCost,
                benefitsPaid:
                    personel.benefitsPaid ??
                    personel.odenenFayda ??
                    0,
                actuarialGainLoss:
                    personel.actuarialGainLoss ??
                    personel.aktuerYelKazancKayip ??
                    0,
                pastServiceCost:
                    personel.pastServiceCost ??
                    personel.gecmisHizmetMaliyeti ??
                    0
            });

        return {
            index,
            personelId: p.personelId,
            yas,
            mevcutHizmet,
            toplamHizmet,
            kalanYil,

            toplamFayda:
                fayda.toplamFayda,

            devamOlasiligi:
                devam,

            kazanilmisFayda:
                dbo.kazanilmisFayda,

            gelecekHizmetFayda:
                dbo.gelecekHizmetFayda,

            allocationRatio:
                dbo.hizmetOrani,

            dbo:
                dbo.dbo,

            currentServiceCost:
                csc,

            interestCost,

            openingDBO,

            closingDBO:
                rollForward.closingDBO,

            rollForward
        };
    };


TMS19.faz2Kontrol =
    function (sonuc) {

        const errors = [];

        if (!sonuc) {
            errors.push(
                "Faz 2 sonucu bulunamadı."
            );
        } else {

            if (
                TMS19.sayi(sonuc.dbo) < 0
            ) {
                errors.push(
                    "DBO negatif olamaz."
                );
            }

            if (
                TMS19.sayi(
                    sonuc.currentServiceCost
                ) < 0
            ) {
                errors.push(
                    "Current Service Cost negatif olamaz."
                );
            }

            if (
                TMS19.sayi(
                    sonuc.interestCost
                ) < 0
            ) {
                errors.push(
                    "Interest Cost negatif olamaz."
                );
            }

            const rf =
                sonuc.rollForward;

            if (rf) {

                const diff =
                    TMS19.sayi(
                        rf.reconciliationDifference
                    );

                if (
                    Math.abs(diff) >
                    0.01
                ) {
                    errors.push(
                        "DBO roll-forward reconcile olmadı."
                    );
                }
            }
        }

        return {
            valid:
                errors.length === 0,
            errors
        };
    };



/* ================================================================
   FAZ 3 — TMS 19 AKTÜERYAL KAZANÇ/KAYIP + OCI/P&L
   Faz 1 + Faz 2 fonksiyonlarını tekrar tanımlamaz.
================================================================ */

TMS19.aktuerYelFarkHesapla =
    function ({
        actualDBO = 0,
        expectedDBO = 0,
        assumptionChange = 0,
        experienceDifference = 0
    } = {}) {

        const actual =
            TMS19.sayi(actualDBO);

        const expected =
            TMS19.sayi(expectedDBO);

        const assumption =
            TMS19.sayi(assumptionChange);

        const experience =
            TMS19.sayi(experienceDifference);

        const total =
            actual - expected;

        return {
            actualDBO: actual,
            expectedDBO: expected,
            assumptionChange: assumption,
            experienceDifference: experience,
            totalActuarialDifference: total
        };
    };


TMS19.aktuerYelKazancKayip =
    function (actualDBO, expectedDBO) {

        return TMS19.sayi(actualDBO) -
               TMS19.sayi(expectedDBO);
    };


TMS19.aktuerYelKazancKayipAyrimi =
    function ({
        actualDBO = 0,
        expectedDBO = 0,
        assumptionChange = 0,
        experienceDifference = null
    } = {}) {

        const total =
            TMS19.aktuerYelKazancKayip(
                actualDBO,
                expectedDBO
            );

        const assumption =
            TMS19.sayi(
                assumptionChange
            );

        const experience =
            experienceDifference === null
                ? total - assumption
                : TMS19.sayi(
                    experienceDifference
                );

        return {
            total: total,
            assumptionChange: assumption,
            experienceDifference: experience
        };
    };


TMS19.ociAktuerYel =
    function (actuarialGainLoss) {

        return TMS19.sayi(
            actuarialGainLoss
        );
    };


TMS19.pnlHizmetMaliyeti =
    function ({
        currentServiceCost = 0,
        pastServiceCost = 0,
        settlementGainLoss = 0
    } = {}) {

        return (
            TMS19.sayi(currentServiceCost) +
            TMS19.sayi(pastServiceCost) +
            TMS19.sayi(settlementGainLoss)
        );
    };


TMS19.pnlNetFaiz =
    function ({
        openingDBO = 0,
        openingPlanAsset = 0,
        iskontoOrani = 0
    } = {}) {

        const dboInterest =
            TMS19.sayi(openingDBO) *
            TMS19.sayi(iskontoOrani);

        const assetInterest =
            TMS19.sayi(openingPlanAsset) *
            TMS19.sayi(iskontoOrani);

        return {
            dboInterest,
            planAssetInterest: assetInterest,
            netInterest:
                dboInterest - assetInterest
        };
    };


TMS19.tms19PnlOci =
    function ({
        currentServiceCost = 0,
        pastServiceCost = 0,
        settlementGainLoss = 0,
        netInterest = 0,
        actuarialGainLoss = 0
    } = {}) {

        const serviceCost =
            TMS19.pnlHizmetMaliyeti({
                currentServiceCost,
                pastServiceCost,
                settlementGainLoss
            });

        const interest =
            TMS19.sayi(netInterest);

        const oci =
            TMS19.ociAktuerYel(
                actuarialGainLoss
            );

        return {
            pAndL: serviceCost + interest,
            serviceCost,
            netInterest: interest,
            oci,
            totalComprehensiveEffect:
                serviceCost +
                interest +
                oci
        };
    };


TMS19.faz3RollForward =
    function ({
        openingDBO = 0,
        currentServiceCost = 0,
        pastServiceCost = 0,
        netInterest = 0,
        actuarialGainLoss = 0,
        benefitsPaid = 0,
        settlements = 0
    } = {}) {

        const opening =
            TMS19.sayi(openingDBO);

        const csc =
            TMS19.sayi(currentServiceCost);

        const psc =
            TMS19.sayi(pastServiceCost);

        const interest =
            TMS19.sayi(netInterest);

        const actuarial =
            TMS19.sayi(actuarialGainLoss);

        const paid =
            TMS19.sayi(benefitsPaid);

        const settlement =
            TMS19.sayi(settlements);

        const closing =
            opening +
            csc +
            psc +
            interest -
            actuarial -
            paid -
            settlement;

        return {
            openingDBO: opening,
            currentServiceCost: csc,
            pastServiceCost: psc,
            netInterest: interest,
            actuarialGainLoss: actuarial,
            benefitsPaid: paid,
            settlements: settlement,
            closingDBO: closing,
            reconciliationDifference:
                opening +
                csc +
                psc +
                interest -
                actuarial -
                paid -
                settlement -
                closing
        };
    };


TMS19.faz3PersonelHesapla =
    function (
        personel,
        varsayimlar = {},
        index = 0
    ) {

        const faz2 =
            TMS19.faz2PersonelHesapla(
                personel,
                varsayimlar,
                index
            );

        const actuarial =
            TMS19.aktuerYelKazancKayipAyrimi({
                actualDBO:
                    personel.actualDBO ??
                    faz2.dbo,

                expectedDBO:
                    personel.expectedDBO ??
                    faz2.dbo,

                assumptionChange:
                    personel.assumptionChange ??
                    personel.varsayimKazancKaybi ??
                    0,

                experienceDifference:
                    personel.experienceDifference ??
                    null
            });

        const interest =
            TMS19.pnlNetFaiz({
                openingDBO:
                    faz2.openingDBO,

                openingPlanAsset:
                    personel.openingPlanAsset ??
                    0,

                iskontoOrani:
                    varsayimlar.iskontoOrani
            });

        const pnlOci =
            TMS19.tms19PnlOci({
                currentServiceCost:
                    faz2.currentServiceCost,

                pastServiceCost:
                    personel.pastServiceCost ??
                    0,

                settlementGainLoss:
                    personel.settlementGainLoss ??
                    0,

                netInterest:
                    interest.netInterest,

                actuarialGainLoss:
                    actuarial.total
            });

        const rollForward =
            TMS19.faz3RollForward({
                openingDBO:
                    faz2.openingDBO,

                currentServiceCost:
                    faz2.currentServiceCost,

                pastServiceCost:
                    personel.pastServiceCost ??
                    0,

                netInterest:
                    interest.netInterest,

                actuarialGainLoss:
                    actuarial.total,

                benefitsPaid:
                    personel.benefitsPaid ??
                    personel.odenenFayda ??
                    0,

                settlements:
                    personel.settlements ??
                    0
            });

        return {
            ...faz2,

            actuarialGainLoss:
                actuarial.total,

            assumptionChange:
                actuarial.assumptionChange,

            experienceDifference:
                actuarial.experienceDifference,

            dboInterest:
                interest.dboInterest,

            planAssetInterest:
                interest.planAssetInterest,

            netInterest:
                interest.netInterest,

            pAndL:
                pnlOci.pAndL,

            serviceCost:
                pnlOci.serviceCost,

            oci:
                pnlOci.oci,

            totalComprehensiveEffect:
                pnlOci.totalComprehensiveEffect,

            faz3RollForward:
                rollForward
        };
    };


TMS19.faz3Kontrol =
    function (sonuc) {

        const errors = [];

        if (!sonuc) {
            errors.push(
                "Faz 3 sonucu bulunamadı."
            );
        } else {

            if (
                !Number.isFinite(
                    TMS19.sayi(
                        sonuc.pAndL
                    )
                )
            ) {
                errors.push(
                    "P&L sonucu geçersiz."
                );
            }

            if (
                !Number.isFinite(
                    TMS19.sayi(
                        sonuc.oci
                    )
                )
            ) {
                errors.push(
                    "OCI sonucu geçersiz."
                );
            }

            const rf =
                sonuc.faz3RollForward;

            if (rf) {

                const diff =
                    TMS19.sayi(
                        rf.reconciliationDifference
                    );

                if (
                    Math.abs(diff) >
                    0.01
                ) {
                    errors.push(
                        "Faz 3 DBO roll-forward reconcile olmadı."
                    );
                }
            }
        }

        return {
            valid:
                errors.length === 0,
            errors
        };
    };



/* ================================================================
   FAZ 4 — TMS 19 VARSAYIM YÖNETİMİ + DUYARLILIK ANALİZİ
   Faz 1–3 fonksiyonlarını tekrar tanımlamaz.
================================================================ */

TMS19.varsayimSetiOlustur =
    function (varsayimlar = {}) {

        return {
            degerlemeTarihi:
                varsayimlar.degerlemeTarihi ?? null,

            iskontoOrani:
                TMS19.sayi(
                    varsayimlar.iskontoOrani
                ),

            maasArtisOrani:
                TMS19.sayi(
                    varsayimlar.maasArtisOrani
                ),

            personelDevirOrani:
                TMS19.sayi(
                    varsayimlar.personelDevirOrani
                ),

            emeklilikYasi:
                TMS19.sayi(
                    varsayimlar.emeklilikYasi
                ),

            tuikHayatTablosuErkek:
                varsayimlar.tuikHayatTablosuErkek,

            tuikHayatTablosuKadin:
                varsayimlar.tuikHayatTablosuKadin,

            devirTablosu:
                varsayimlar.devirTablosu,

            kaynak:
                varsayimlar.kaynak ?? "TMS19",

            versiyon:
                varsayimlar.versiyon ?? "1.0"
        };
    };


TMS19.varsayimKontrol =
    function (varsayimlar = {}) {

        const errors = [];
        const warnings = [];

        const iskonto =
            TMS19.sayi(
                varsayimlar.iskontoOrani
            );

        const maasArtis =
            TMS19.sayi(
                varsayimlar.maasArtisOrani
            );

        const devir =
            TMS19.sayi(
                varsayimlar.personelDevirOrani
            );

        if (
            iskonto <= -1
        ) {
            errors.push(
                "İskonto oranı -100% veya altında olamaz."
            );
        }

        if (
            maasArtis <= -1
        ) {
            errors.push(
                "Maaş artış oranı -100% veya altında olamaz."
            );
        }

        if (
            devir < 0 ||
            devir > 1
        ) {
            errors.push(
                "Devir oranı 0-1 aralığında olmalı."
            );
        }

        if (
            !Array.isArray(
                varsayimlar.tuikHayatTablosuErkek
            )
        ) {
            warnings.push(
                "Erkek TÜİK qx tablosu bulunamadı."
            );
        }

        if (
            !Array.isArray(
                varsayimlar.tuikHayatTablosuKadin
            )
        ) {
            warnings.push(
                "Kadın TÜİK qx tablosu bulunamadı."
            );
        }

        return {
            valid:
                errors.length === 0,

            errors,
            warnings
        };
    };


TMS19.varsayimSenaryoUret =
    function (
        temelVarsayimlar = {},
        degisiklikler = {}
    ) {

        return {
            ...temelVarsayimlar,
            ...degisiklikler
        };
    };


TMS19.duyarlilikSenaryosu =
    function (
        personel,
        temelVarsayimlar,
        degisiklik
    ) {

        const senaryo =
            TMS19.varsayimSenaryoUret(
                temelVarsayimlar,
                degisiklik
            );

        const sonuc =
            TMS19.faz3PersonelHesapla(
                personel,
                senaryo
            );

        return {
            degisiklik,
            varsayimlar: senaryo,
            dbo:
                TMS19.sayi(
                    sonuc.dbo
                ),
            currentServiceCost:
                TMS19.sayi(
                    sonuc.currentServiceCost
                ),
            netInterest:
                TMS19.sayi(
                    sonuc.netInterest
                ),
            pAndL:
                TMS19.sayi(
                    sonuc.pAndL
                ),
            oci:
                TMS19.sayi(
                    sonuc.oci
                )
        };
    };


TMS19.duyarlilikAnalizi =
    function (
        personel,
        varsayimlar = {},
        senaryolar = []
    ) {

        const temel =
            TMS19.varsayimSetiOlustur(
                varsayimlar
            );

        const kontrol =
            TMS19.varsayimKontrol(
                temel
            );

        if (
            !kontrol.valid
        ) {
            return {
                valid: false,
                errors: kontrol.errors,
                warnings: kontrol.warnings,
                scenarios: []
            };
        }

        const scenarios =
            senaryolar.map(
                degisiklik =>
                    TMS19.duyarlilikSenaryosu(
                        personel,
                        temel,
                        degisiklik
                    )
            );

        return {
            valid: true,
            errors: [],
            warnings: kontrol.warnings,
            base:
                TMS19.faz3PersonelHesapla(
                    personel,
                    temel
                ),
            scenarios
        };
    };


TMS19.standartDuyarlilikSenaryolari =
    function (
        varsayimlar = {},
        puan = 0.01
    ) {

        const p =
            Math.abs(
                TMS19.sayi(puan)
            );

        const iskonto =
            TMS19.sayi(
                varsayimlar.iskontoOrani
            );

        const maas =
            TMS19.sayi(
                varsayimlar.maasArtisOrani
            );

        return [

            {
                ad: "İskonto +100 bp",
                iskontoOrani:
                    iskonto + p
            },

            {
                ad: "İskonto -100 bp",
                iskontoOrani:
                    iskonto - p
            },

            {
                ad: "Maaş artışı +100 bp",
                maasArtisOrani:
                    maas + p
            },

            {
                ad: "Maaş artışı -100 bp",
                maasArtisOrani:
                    maas - p
            }
        ];
    };


TMS19.duyarlilikPortfoy =
    function (
        personeller = [],
        varsayimlar = {},
        senaryolar = []
    ) {

        const sonuc = [];

        personeller.forEach(
            (personel, index) => {

                const analiz =
                    TMS19.duyarlilikAnalizi(
                        personel,
                        varsayimlar,
                        senaryolar
                    );

                sonuc.push({
                    index,
                    personelId:
                        personel.personelId ??
                        personel.id ??
                        index,

                    analiz
                });
            }
        );

        return sonuc;
    };


TMS19.duyarlilikOzet =
    function (portfoySonuclari = []) {

        const toplam = {
            baseDBO: 0,
            baseCSC: 0,
            baseNetInterest: 0,
            basePnL: 0,
            baseOCI: 0,
            scenarios: {}
        };

        portfoySonuclari.forEach(
            kayit => {

                const analiz =
                    kayit.analiz;

                if (
                    !analiz ||
                    !analiz.valid
                ) {
                    return;
                }

                const base =
                    analiz.base;

                toplam.baseDBO +=
                    TMS19.sayi(
                        base.dbo
                    );

                toplam.baseCSC +=
                    TMS19.sayi(
                        base.currentServiceCost
                    );

                toplam.baseNetInterest +=
                    TMS19.sayi(
                        base.netInterest
                    );

                toplam.basePnL +=
                    TMS19.sayi(
                        base.pAndL
                    );

                toplam.baseOCI +=
                    TMS19.sayi(
                        base.oci
                    );

                (
                    analiz.scenarios || []
                ).forEach(
                    scenario => {

                        const ad =
                            scenario.degisiklik
                                ?.ad ??
                            "Senaryo";

                        if (
                            !toplam.scenarios[ad]
                        ) {
                            toplam.scenarios[ad] = {
                                dbo: 0,
                                currentServiceCost: 0,
                                netInterest: 0,
                                pAndL: 0,
                                oci: 0
                            };
                        }

                        toplam.scenarios[ad].dbo +=
                            TMS19.sayi(
                                scenario.dbo
                            );

                        toplam.scenarios[ad]
                            .currentServiceCost +=
                            TMS19.sayi(
                                scenario.currentServiceCost
                            );

                        toplam.scenarios[ad]
                            .netInterest +=
                            TMS19.sayi(
                                scenario.netInterest
                            );

                        toplam.scenarios[ad].pAndL +=
                            TMS19.sayi(
                                scenario.pAndL
                            );

                        toplam.scenarios[ad].oci +=
                            TMS19.sayi(
                                scenario.oci
                            );
                    }
                );
            }
        );

        return toplam;
    };



/* ================================================================
   FAZ 5 — TMS 19 TAM PORTFÖY AKTÜERYAL HESAPLAMA + KONSOLİDASYON
   Faz 1–4 fonksiyonlarını tekrar tanımlamaz.
================================================================ */

TMS19.faz5PersonelSonucu =
    function (
        personel,
        varsayimlar = {},
        index = 0
    ) {

        const sonuc =
            TMS19.faz3PersonelHesapla(
                personel,
                varsayimlar,
                index
            );

        return {
            ...sonuc,
            faz: 5
        };
    };


TMS19.faz5PortfoyHesapla =
    function (
        personeller = [],
        varsayimlar = {}
    ) {

        const rows = [];

        const toplam = {
            personelSayisi: 0,
            dbo: 0,
            currentServiceCost: 0,
            pastServiceCost: 0,
            interestCost: 0,
            netInterest: 0,
            actuarialGainLoss: 0,
            pAndL: 0,
            oci: 0,
            benefitsPaid: 0,
            openingDBO: 0,
            closingDBO: 0
        };

        personeller.forEach(
            (personel, index) => {

                try {

                    const sonuc =
                        TMS19.faz5PersonelSonucu(
                            personel,
                            varsayimlar,
                            index
                        );

                    rows.push({
                        success: true,
                        ...sonuc
                    });

                    toplam.personelSayisi++;

                    toplam.dbo +=
                        TMS19.sayi(sonuc.dbo);

                    toplam.currentServiceCost +=
                        TMS19.sayi(
                            sonuc.currentServiceCost
                        );

                    toplam.pastServiceCost +=
                        TMS19.sayi(
                            sonuc.pastServiceCost
                        );

                    toplam.interestCost +=
                        TMS19.sayi(
                            sonuc.interestCost
                        );

                    toplam.netInterest +=
                        TMS19.sayi(
                            sonuc.netInterest
                        );

                    toplam.actuarialGainLoss +=
                        TMS19.sayi(
                            sonuc.actuarialGainLoss
                        );

                    toplam.pAndL +=
                        TMS19.sayi(
                            sonuc.pAndL
                        );

                    toplam.oci +=
                        TMS19.sayi(
                            sonuc.oci
                        );

                    toplam.benefitsPaid +=
                        TMS19.sayi(
                            sonuc.rollForward?.benefitsPaid
                        );

                    toplam.openingDBO +=
                        TMS19.sayi(
                            sonuc.openingDBO
                        );

                    toplam.closingDBO +=
                        TMS19.sayi(
                            sonuc.closingDBO
                        );

                } catch (error) {

                    rows.push({
                        success: false,
                        index,
                        personelId:
                            personel.personelId ??
                            personel.id ??
                            index,
                        error:
                            error?.message ??
                            String(error)
                    });
                }
            }
        );

        return {
            success:
                rows.every(
                    x => x.success
                ),

            personelSayisi:
                toplam.personelSayisi,

            toplam,

            rows
        };
    };


TMS19.faz5PortfoyKontrol =
    function (sonuc) {

        const errors = [];

        if (!sonuc) {
            errors.push(
                "Portföy sonucu bulunamadı."
            );

            return {
                valid: false,
                errors
            };
        }

        const t =
            sonuc.toplam || {};

        const alanlar = [
            "dbo",
            "currentServiceCost",
            "pastServiceCost",
            "interestCost",
            "netInterest",
            "actuarialGainLoss",
            "pAndL",
            "oci",
            "openingDBO",
            "closingDBO"
        ];

        alanlar.forEach(
            alan => {

                if (
                    !Number.isFinite(
                        TMS19.sayi(
                            t[alan]
                        )
                    )
                ) {
                    errors.push(
                        `${alan} geçersiz.`
                    );
                }
            }
        );

        const basarili =
            (sonuc.rows || [])
                .filter(
                    x => x.success
                ).length;

        if (
            basarili !==
            (sonuc.rows || []).length
        ) {
            errors.push(
                "Bir veya daha fazla personel hesabı başarısız."
            );
        }

        return {
            valid:
                errors.length === 0,

            errors
        };
    };


TMS19.faz5PortfoyRollForward =
    function (sonuc) {

        const t =
            sonuc?.toplam || {};

        const expectedClosing =
            TMS19.sayi(t.openingDBO) +
            TMS19.sayi(t.currentServiceCost) +
            TMS19.sayi(t.pastServiceCost) +
            TMS19.sayi(t.netInterest) -
            TMS19.sayi(t.actuarialGainLoss) -
            TMS19.sayi(t.benefitsPaid);

        const actualClosing =
            TMS19.sayi(t.closingDBO);

        return {
            openingDBO:
                TMS19.sayi(t.openingDBO),

            currentServiceCost:
                TMS19.sayi(t.currentServiceCost),

            pastServiceCost:
                TMS19.sayi(t.pastServiceCost),

            netInterest:
                TMS19.sayi(t.netInterest),

            actuarialGainLoss:
                TMS19.sayi(t.actuarialGainLoss),

            benefitsPaid:
                TMS19.sayi(t.benefitsPaid),

            expectedClosingDBO:
                expectedClosing,

            actualClosingDBO:
                actualClosing,

            reconciliationDifference:
                actualClosing -
                expectedClosing,

            reconciled:
                Math.abs(
                    actualClosing -
                    expectedClosing
                ) <= 0.01
        };
    };


TMS19.faz5Kpi =
    function (sonuc) {

        const t =
            sonuc?.toplam || {};

        const personelSayisi =
            TMS19.sayi(
                sonuc?.personelSayisi
            );

        const dbo =
            TMS19.sayi(t.dbo);

        return {

            personelSayisi,

            toplamDBO: dbo,

            ortalamaDBO:
                personelSayisi > 0
                    ? dbo / personelSayisi
                    : 0,

            toplamCSC:
                TMS19.sayi(
                    t.currentServiceCost
                ),

            toplamNetInterest:
                TMS19.sayi(
                    t.netInterest
                ),

            toplamPnL:
                TMS19.sayi(
                    t.pAndL
                ),

            toplamOCI:
                TMS19.sayi(
                    t.oci
                ),

            toplamAktuerYelKazancKayip:
                TMS19.sayi(
                    t.actuarialGainLoss
                ),

            openingDBO:
                TMS19.sayi(
                    t.openingDBO
                ),

            closingDBO:
                TMS19.sayi(
                    t.closingDBO
                )
        };
    };


TMS19.faz5Hesapla =
    function (
        personeller = [],
        varsayimlar = {}
    ) {

        const portfoy =
            TMS19.faz5PortfoyHesapla(
                personeller,
                varsayimlar
            );

        const kontrol =
            TMS19.faz5PortfoyKontrol(
                portfoy
            );

        const rollForward =
            TMS19.faz5PortfoyRollForward(
                portfoy
            );

        const kpi =
            TMS19.faz5Kpi(
                portfoy
            );

        return {
            ...portfoy,
            kontrol,
            rollForward,
            kpi
        };
    };



/* ================================================================
   FAZ 6 — TMS 19 RAPORLAMA + DİPNOT + AUDIT TRAIL
   Faz 1–5 fonksiyonlarını tekrar tanımlamaz.
================================================================ */

TMS19.auditTrailKaydi =
    function ({
        personelId = null,
        islem = "",
        alan = "",
        oncekiDeger = null,
        yeniDeger = null,
        kaynak = "",
        aciklama = ""
    } = {}) {

        return {
            zaman:
                new Date().toISOString(),

            personelId,
            islem,
            alan,
            oncekiDeger,
            yeniDeger,
            kaynak,
            aciklama
        };
    };


TMS19.auditTrailOlustur =
    function (
        personelSonuclari = [],
        varsayimlar = {}
    ) {

        const trail = [];

        trail.push(
            TMS19.auditTrailKaydi({
                islem: "HESAPLAMA_BASLATILDI",
                kaynak:
                    varsayimlar.kaynak ??
                    "TMS19",
                aciklama:
                    "TMS 19 aktüeryal portföy hesaplaması başlatıldı."
            })
        );

        personelSonuclari.forEach(
            sonuc => {

                trail.push(
                    TMS19.auditTrailKaydi({
                        personelId:
                            sonuc.personelId,

                        islem:
                            "PERSONEL_HESAPLAMA",

                        alan: "DBO",

                        yeniDeger:
                            sonuc.dbo,

                        kaynak:
                            varsayimlar.kaynak ??
                            "TMS19"
                    })
                );

                trail.push(
                    TMS19.auditTrailKaydi({
                        personelId:
                            sonuc.personelId,

                        islem:
                            "PERSONEL_HESAPLAMA",

                        alan:
                            "CURRENT_SERVICE_COST",

                        yeniDeger:
                            sonuc.currentServiceCost,

                        kaynak:
                            varsayimlar.kaynak ??
                            "TMS19"
                    })
                );
            }
        );

        trail.push(
            TMS19.auditTrailKaydi({
                islem: "HESAPLAMA_TAMAMLANDI",
                kaynak:
                    varsayimlar.kaynak ??
                    "TMS19"
            })
        );

        return trail;
    };


TMS19.tms19DipnotVerisi =
    function (
        portfoySonucu,
        varsayimlar = {}
    ) {

        const t =
            portfoySonucu?.toplam || {};

        const rf =
            portfoySonucu?.rollForward || {};

        return {

            personelSayisi:
                TMS19.sayi(
                    portfoySonucu?.personelSayisi
                ),

            openingDBO:
                TMS19.sayi(
                    t.openingDBO
                ),

            currentServiceCost:
                TMS19.sayi(
                    t.currentServiceCost
                ),

            pastServiceCost:
                TMS19.sayi(
                    t.pastServiceCost
                ),

            netInterest:
                TMS19.sayi(
                    t.netInterest
                ),

            actuarialGainLoss:
                TMS19.sayi(
                    t.actuarialGainLoss
                ),

            benefitsPaid:
                TMS19.sayi(
                    t.benefitsPaid
                ),

            closingDBO:
                TMS19.sayi(
                    t.closingDBO
                ),

            pAndL:
                TMS19.sayi(
                    t.pAndL
                ),

            oci:
                TMS19.sayi(
                    t.oci
                ),

            assumptions: {
                valuationDate:
                    varsayimlar.degerlemeTarihi ??
                    null,

                discountRate:
                    varsayimlar.iskontoOrani ??
                    null,

                salaryIncreaseRate:
                    varsayimlar.maasArtisOrani ??
                    null,

                retirementAge:
                    varsayimlar.emeklilikYasi ??
                    null
            },

            rollForward: rf
        };
    };


TMS19.tms19RaporOlustur =
    function (
        personeller = [],
        varsayimlar = {}
    ) {

        const hesap =
            TMS19.faz5Hesapla(
                personeller,
                varsayimlar
            );

        const dipnot =
            TMS19.tms19DipnotVerisi(
                hesap,
                varsayimlar
            );

        const auditTrail =
            TMS19.auditTrailOlustur(
                hesap.rows.filter(
                    x => x.success
                ),
                varsayimlar
            );

        return {

            valuationDate:
                varsayimlar.degerlemeTarihi ??
                null,

            assumptions:
                hesap.kontrol,

            kpi:
                hesap.kpi,

            dboRollForward:
                hesap.rollForward,

            pnl: {
                currentServiceCost:
                    hesap.toplam
                        .currentServiceCost,

                pastServiceCost:
                    hesap.toplam
                        .pastServiceCost,

                netInterest:
                    hesap.toplam
                        .netInterest,

                totalPnL:
                    hesap.toplam.pAndL
            },

            oci: {
                actuarialGainLoss:
                    hesap.toplam
                        .actuarialGainLoss,

                totalOCI:
                    hesap.toplam.oci
            },

            footnote:
                dipnot,

            auditTrail
        };
    };


TMS19.tms19RaporJson =
    function (
        personeller = [],
        varsayimlar = {}
    ) {

        return JSON.stringify(
            TMS19.tms19RaporOlustur(
                personeller,
                varsayimlar
            ),
            null,
            2
        );
    };


TMS19.faz6Kontrol =
    function (rapor) {

        const errors = [];

        if (!rapor) {
            errors.push(
                "TMS 19 raporu oluşturulamadı."
            );

            return {
                valid: false,
                errors
            };
        }

        if (!rapor.kpi) {
            errors.push(
                "KPI bölümü eksik."
            );
        }

        if (!rapor.dboRollForward) {
            errors.push(
                "DBO roll-forward eksik."
            );
        }

        if (!rapor.pnl) {
            errors.push(
                "P&L bölümü eksik."
            );
        }

        if (!rapor.oci) {
            errors.push(
                "OCI bölümü eksik."
            );
        }

        if (!rapor.footnote) {
            errors.push(
                "Dipnot verisi eksik."
            );
        }

        if (!Array.isArray(rapor.auditTrail)) {
            errors.push(
                "Audit trail eksik."
            );
        }

        return {
            valid:
                errors.length === 0,
            errors
        };
    };
