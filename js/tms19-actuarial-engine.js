/* ================================================================
   GK FINANCIAL DECISION COCKPIT
   TMS 19 ACTUARIAL ENGINE
   ----------------------------------------------------------------
   Standard      : TMS 19 Employee Benefits
   Method        : Projected Unit Credit
   Engine        : GK Actuarial Engine
   Version       : 3.0.0
   Language      : Turkish
================================================================ */

(function (global) {

    "use strict";

    /* ============================================================
       NAMESPACE
    ============================================================ */

    const TMS19 = {};

    TMS19.motorAdi = "GK TMS 19 Actuarial Engine";
    TMS19.versiyon = "3.0.0";
    TMS19.yontem = "Projected Unit Credit";


    /* ============================================================
       01 — GENEL YARDIMCILAR
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

        let temiz = String(deger)
            .trim()
            .replace(/\s/g, "");

        if (
            temiz.includes(".") &&
            temiz.includes(",")
        ) {
            temiz = temiz
                .replace(/\./g, "")
                .replace(",", ".");
        }
        else if (temiz.includes(",")) {
            temiz = temiz.replace(",", ".");
        }

        const sonuc = Number(temiz);

        return isFinite(sonuc)
            ? sonuc
            : varsayilan;
    };


    TMS19.sinirla = function (deger, min, max) {

        return Math.min(
            Math.max(
                TMS19.sayi(deger),
                min
            ),
            max
        );
    };


    TMS19.yuvarla = function (deger, basamak = 2) {

        const katsayi = Math.pow(
            10,
            basamak
        );

        return Math.round(
            TMS19.sayi(deger) * katsayi
        ) / katsayi;
    };


    TMS19.mutlak = function (deger) {

        return Math.abs(
            TMS19.sayi(deger)
        );
    };


    TMS19.oran = function (deger) {

        return TMS19.sayi(deger);
    };


    /* ============================================================
       02 — TARİH MOTORU
    ============================================================ */

    TMS19.tarih = function (deger) {

        if (deger instanceof Date) {
            return new Date(
                deger.getTime()
            );
        }

        if (!deger) {
            return null;
        }

        const sonuc = new Date(deger);

        if (isNaN(sonuc.getTime())) {
            return null;
        }

        return sonuc;
    };


    TMS19.yilFarki = function (
        baslangic,
        bitis
    ) {

        const bas = TMS19.tarih(baslangic);
        const bit = TMS19.tarih(bitis);

        if (!bas || !bit) {
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

        return TMS19.yilFarki(
            baslangic,
            bitis
        ) * 12;
    };


    TMS19.yasHesapla = function (
        dogumTarihi,
        degerlemeTarihi
    ) {

        const dogum =
            TMS19.tarih(dogumTarihi);

        const degerleme =
            TMS19.tarih(degerlemeTarihi);

        if (!dogum || !degerleme) {
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
            TMS19.tarih(tarih);

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

        const p = personel || {};

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

        if (p.mevcutMaas < 0) {
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

            const giris =
                TMS19.tarih(
                    p.iseGirisTarihi
                );

            if (giris < dogum) {
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
                )
        };
    };


    /* ============================================================
       06 — VARSAYIM VALIDATION
    ============================================================ */

    TMS19.varsayimlariValidateEt = function (
        varsayimlar
    ) {

        const v =
            TMS19.varsayimNormalizeEt(
                varsayimlar
            );

        const errors = [];

        if (v.emeklilikYasi <= 0) {
            errors.push(
                "Emeklilik yaşı geçerli değil."
            );
        }

        if (v.iskontoOrani <= -1) {
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

        if (v.faydaOrani < 0) {
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

            for (
                let yil = 0;
                yil <= yilSayisi;
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

    TMS19.kidemTavaniHesapla = function (
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
                    : maas,

            tavanEtkiTutari:
                Math.max(
                    0,
                    maas -
                    projekteTavan
                )
        };
    };


    /* ============================================================
       10 — DEMOGRAFİK OLASILIKLAR
    ============================================================ */

    TMS19.devirOlasiligi = function (
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
                varsayimlar.personelDevirOrani,
                0,
                1
            );

        return Math.pow(
            1 - turnover,
            yil
        );
    };


    TMS19.olumOlasiligi = function (
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
                varsayimlar.olumOrani,
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
                    varsayimlar.personelDevirOrani,
                    0,
                    1
                );

            const mortality =
                TMS19.sinirla(
                    varsayimlar.olumOrani,
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


    TMS19.devamOlasiligi = function (
        kalanYil,
        varsayimlar
    ) {

        if (
            TMS19.sayi(kalanYil) <= 0
        ) {
            return 1;
        }

        return Math.pow(
            TMS19.yillikDevamOlasiligi(
                varsayimlar
            ),
            Math.max(
                0,
                TMS19.sayi(
                    kalanYil
                )
            )
        );
    };


    /* ============================================================
       11 — İSKONTO
    ============================================================ */

    TMS19.iskontoFaktoru = function (
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

        if (sure <= 0) {
            return 1;
        }

        return 1 /
            Math.pow(
                1 + oran,
                sure
            );
    };


    TMS19.bugunkuDeger = function (
        tutar,
        iskontoOrani,
        yil
    ) {

        return (
            TMS19.sayi(tutar) *
            TMS19.iskontoFaktoru(
                iskontoOrani,
                yil
            )
        );
    };


    /* ============================================================
       12 — TEK PERSONEL PUC HESAPLAMA
    ============================================================ */

    TMS19.pucHesapla = function (
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


        /* --------------------------------------------------------
           VALIDATION
        -------------------------------------------------------- */

        const personelValidation =
            TMS19.personelValidate(
                personel
            );

        if (
            !personelValidation.valid
        ) {

            throw new Error(
                personelValidation.errors.join(" ")
            );
        }


        const varsayimValidation =
            TMS19.varsayimlariValidateEt(
                v
            );

        if (
            !varsayimValidation.valid
        ) {

            throw new Error(
                varsayimValidation.errors.join(" ")
            );
        }


        /* --------------------------------------------------------
           TARİHLER
        -------------------------------------------------------- */

        const degerlemeTarihi =
            v.degerlemeTarihi;

        const dogumTarihi =
            TMS19.tarih(
                p.dogumTarihi
            );

        const iseGirisTarihi =
            TMS19.tarih(
                p.iseGirisTarihi
            );


        /* --------------------------------------------------------
           YAŞ / HİZMET
        -------------------------------------------------------- */

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

        const toplamHizmet =
            hizmetSuresi +
            emekliligeKalanYil;


        /* --------------------------------------------------------
           MAAŞ
        -------------------------------------------------------- */

        const maas =
            TMS19.maasProjeksiyonu(
                p.mevcutMaas,
                emekliligeKalanYil,
                v
            );


        /* --------------------------------------------------------
           KIDEM TAVANI
        -------------------------------------------------------- */

        const tavan =
            TMS19.kidemTavaniHesapla(
                maas.emeklilikMaasi,
                emekliligeKalanYil,
                v
            );

        const faydaHesaplamaMaasi =
            tavan.hesaplamaMaasi;


        /* --------------------------------------------------------
           FAYDA
        -------------------------------------------------------- */

        const yillikFayda =
            faydaHesaplamaMaasi *
            v.faydaOrani;

        const toplamFayda =
            yillikFayda *
            toplamHizmet;


        /* --------------------------------------------------------
           HİZMET TAHSİSİ
        -------------------------------------------------------- */

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
                ? Math.min(
                    1,
                    emekliligeKalanYil /
                    toplamHizmet
                )
                : 0;


        const kazanilmisFayda =
            toplamFayda *
            gecmisHizmetOrani;


        /* --------------------------------------------------------
           DEMOGRAFİK
        -------------------------------------------------------- */

        const devirOlasiligi =
            TMS19.devirOlasiligi(
                emekliligeKalanYil,
                v
            );

        const olumOlasiligi =
            TMS19.olumOlasiligi(
                emekliligeKalanYil,
                v
            );

        const devamOlasiligi =
            TMS19.devamOlasiligi(
                emekliligeKalanYil,
                v
            );


        /* --------------------------------------------------------
           BEKLENEN FAYDA
        -------------------------------------------------------- */

        const beklenenFayda =
            kazanilmisFayda *
            devamOlasiligi;


        /* --------------------------------------------------------
           İSKONTO
        -------------------------------------------------------- */

        const iskontoFaktoru =
            TMS19.iskontoFaktoru(
                v.iskontoOrani,
                emekliligeKalanYil
            );


        /* --------------------------------------------------------
           DBO
        -------------------------------------------------------- */

        const dbo =
            beklenenFayda *
            iskontoFaktoru;


        /* --------------------------------------------------------
           CURRENT SERVICE COST
        -------------------------------------------------------- */

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


        /* --------------------------------------------------------
           INTEREST COST
        -------------------------------------------------------- */

        const faizMaliyeti =
            dbo *
            v.iskontoOrani;


        /* --------------------------------------------------------
           TOTAL SERVICE / FINANCE COST
        -------------------------------------------------------- */

        const toplamDonemMaliyeti =
            cariHizmetMaliyeti +
            faizMaliyeti;


        /* --------------------------------------------------------
           KONTROLLER
        -------------------------------------------------------- */

        const hizmetKontrol =
            gecmisHizmetOrani +
            gelecekHizmetOrani;

        const hizmetKontrolFarki =
            hizmetKontrol - 1;


        const faydaKontrol =
            (
                kazanilmisFayda
            ) +
            (
                toplamFayda -
                kazanilmisFayda
            );


        /* --------------------------------------------------------
           SONUÇ
        -------------------------------------------------------- */

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
                v.degerlemeTarihi,


            yas:
                yas,

            hizmetSuresi:
                hizmetSuresi,

            emeklilikYasi:
                v.emeklilikYasi,

            emekliligeKalanYil:
                emekliligeKalanYil,

            toplamHizmet:
                toplamHizmet,


            mevcutMaas:
                p.mevcutMaas,

            maasArtisOrani:
                v.maasArtisOrani,

            emeklilikMaasi:
                maas.emeklilikMaasi,

            faydaHesaplamaMaasi:
                faydaHesaplamaMaasi,


            kidemTavani:
                v.kidemTavani,

            projectedCeiling:
                tavan.projekteTavan,

            tavanUygulandi:
                tavan.uygulandi,

            tavanEtkiTutari:
                tavan.tavanEtkiTutari,


            faydaOrani:
                v.faydaOrani,

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
                v.personelDevirOrani,

            olumOrani:
                v.olumOrani,

            devirOlasiligi:
                devirOlasiligi,

            olumOlasiligi:
                olumOlasiligi,

            devamOlasiligi:
                devamOlasiligi,


            beklenenFayda:
                beklenenFayda,


            iskontoOrani:
                v.iskontoOrani,

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


            kontrolHizmetOrani:
                hizmetKontrol,

            kontrolHizmetFarki:
                hizmetKontrolFarki,

            kontrolToplamFayda:
                faydaKontrol,

            hesaplamaDurumu:
                "BAŞARILI",

            hesaplamaYontemi:
                "Projected Unit Credit",

            hata:
                null
        };
    };


    /* ============================================================
       13 — YILLIK PERSONEL PROJEKSİYONU
    ============================================================ */

    TMS19.personelProjeksiyonu =
        function (
            personel,
            varsayimlar
        ) {

            const baz =
                TMS19.pucHesapla(
                    personel,
                    varsayimlar,
                    0
                );

            const v =
                TMS19.varsayimNormalizeEt(
                    varsayimlar
                );

            const yillar = [];

            const maxYil =
                Math.max(
                    0,
                    Math.ceil(
                        baz.emekliligeKalanYil
                    )
                );


            for (
                let yil = 0;
                yil <= maxYil;
                yil++
            ) {

                const kalan =
                    Math.max(
                        0,
                        baz.emekliligeKalanYil -
                        yil
                    );

                const projekteMaas =
                    baz.mevcutMaas *
                    Math.pow(
                        1 +
                        v.maasArtisOrani,
                        yil
                    );

                const tavan =
                    TMS19.kidemTavaniHesapla(
                        projekteMaas,
                        kalan,
                        v
                    );

                const hesaplamaMaasi =
                    tavan.hesaplamaMaasi;

                const gelecekHizmet =
                    Math.max(
                        0,
                        baz.toplamHizmet -
                        yil
                    );

                const gecmisHizmet =
                    Math.min(
                        baz.toplamHizmet,
                        baz.hizmetSuresi +
                        yil
                    );

                const toplamFayda =
                    hesaplamaMaasi *
                    v.faydaOrani *
                    Math.max(
                        0,
                        baz.toplamHizmet
                    );

                const hizmetOrani =
                    baz.toplamHizmet > 0
                        ? Math.min(
                            1,
                            gecmisHizmet /
                            baz.toplamHizmet
                        )
                        : 0;

                const kazanilmis =
                    toplamFayda *
                    hizmetOrani;

                const devam =
                    TMS19.devamOlasiligi(
                        kalan,
                        v
                    );

                const beklenen =
                    kazanilmis *
                    devam;

                const iskonto =
                    TMS19.iskontoFaktoru(
                        v.iskontoOrani,
                        kalan
                    );

                const dbo =
                    beklenen *
                    iskonto;


                yillar.push({

                    yil:
                        yil,

                    kalanYil:
                        kalan,

                    yas:
                        baz.yas + yil,

                    hizmetSuresi:
                        baz.hizmetSuresi + yil,

                    maas:
                        projekteMaas,

                    tavan:
                        tavan.projekteTavan,

                    hesaplamaMaasi:
                        hesaplamaMaasi,

                    toplamFayda:
                        toplamFayda,

                    kazanilmisFayda:
                        kazanilmis,

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


            return yillar;
        };


    /* ============================================================
       14 — TOPLU HESAPLAMA
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
                                error.message
                        });
                    }
                }
            );

            return sonuclar;
        };


    /* ============================================================
       15 — PORTFÖY ÖZETİ
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
                function (alan) {

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


            const toplamDBO =
                toplam("dbo");


            const toplamCariHizmet =
                toplam(
                    "cariHizmetMaliyeti"
                );


            const toplamFaiz =
                toplam(
                    "faizMaliyeti"
                );


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
                    toplamDBO,

                toplamCariHizmetMaliyeti:
                    toplamCariHizmet,

                toplamFaizMaliyeti:
                    toplamFaiz,

                toplamDonemMaliyeti:
                    toplamCariHizmet +
                    toplamFaiz,

                ortalamaDBOPersonel:
                    basarili.length > 0
                        ? toplamDBO /
                        basarili.length
                        : 0,

                hataOrani:
                    liste.length > 0
                        ? hatali.length /
                        liste.length
                        : 0,

                hesaplamaDurumu:
                    hatali.length === 0
                        ? "BAŞARILI"
                        : "KONTROL GEREKLİ"
            };
        };


    /* ============================================================
       16 — DBO ROLL-FORWARD
    ============================================================ */

    TMS19.rollForward =
        function (
            openingDBO,
            currentServiceCost,
            interestCost,
            benefitPayments,
            actuarialGainLoss = 0,
            pastServiceCost = 0
        ) {

            const acilis =
                TMS19.sayi(
                    openingDBO
                );

            const cari =
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

            const aktueriyel =
                TMS19.sayi(
                    actuarialGainLoss
                );

            const gecmis =
                TMS19.sayi(
                    pastServiceCost
                );

            const kapanis =
                acilis +
                cari +
                faiz +
                gecmis +
                aktueriyel -
                odeme;


            return {

                openingDBO:
                    acilis,

                currentServiceCost:
                    cari,

                interestCost:
                    faiz,

                pastServiceCost:
                    gecmis,

                actuarialGainLoss:
                    aktueriyel,

                benefitPayments:
                    odeme,

                closingDBO:
                    kapanis,

                reconciliationCheck:
                    kapanis -
                    (
                        acilis +
                        cari +
                        faiz +
                        gecmis +
                        aktueriyel -
                        odeme
                    )
            };
        };


    /* ============================================================
       17 — AKTÜERYAL KAZANÇ / ZARAR
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

            const fark =
                gerceklesen -
                beklenen;


            return {

                beklenenDBO:
                    beklenen,

                gerceklesenDBO:
                    gerceklesen,

                fark:
                    fark,

                aktueriyelKazanc:
                    Math.max(
                        0,
                        -fark
                    ),

                aktueriyelZarar:
                    Math.max(
                        0,
                        fark
                    ),

                oci:
                    fark
            };
        };


    /* ============================================================
       18 — NET FAİZ
    ============================================================ */

    TMS19.netFaizHesapla =
        function (
            openingNetLiability,
            iskontoOrani
        ) {

            const acilis =
                TMS19.sayi(
                    openingNetLiability
                );

            const oran =
                TMS19.sayi(
                    iskontoOrani
                );

            return {

                openingNetLiability:
                    acilis,

                iskontoOrani:
                    oran,

                netFaiz:
                    acilis *
                    oran
            };
        };


    /* ============================================================
       19 — P&L
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

                toplamPnlGideri:
                    cari +
                    gecmis +
                    faiz
            };
        };


    /* ============================================================
       20 — OCI
    ============================================================ */

    TMS19.ociHesapla =
        function (
            actuarialGainLoss
        ) {

            const tutar =
                TMS19.sayi(
                    actuarialGainLoss
                );

            return {

                aktueriyelKazancZarar:
                    tutar,

                oci:
                    tutar
            };
        };


    /* ============================================================
       21 — NET DEFINED BENEFIT LIABILITY
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
       22 — TAM DÖNEM TMS 19 HESAPLAMASI
    ============================================================ */

    TMS19.donemHesapla =
        function (
            openingDBO,
            openingPlanAssets,
            varsayimlar,
            currentServiceCost,
            benefitPayments = 0,
            employerContributions = 0,
            actuarialGainLoss = 0,
            pastServiceCost = 0
        ) {

            const v =
                TMS19.varsayimNormalizeEt(
                    varsayimlar
                );


            const openingNet =
                TMS19.netYukumlulukHesapla(
                    openingDBO,
                    openingPlanAssets
                );


            const netFaiz =
                TMS19.netFaizHesapla(
                    openingNet.netDefinedBenefitLiability,
                    v.iskontoOrani
                );


            const dboRollForward =
                TMS19.rollForward(
                    openingDBO,
                    currentServiceCost,
                    netFaiz.netFaiz,
                    benefitPayments,
                    actuarialGainLoss,
                    pastServiceCost
                );


            const pnl =
                TMS19.pnlHesapla(
                    currentServiceCost,
                    pastServiceCost,
                    netFaiz.netFaiz
                );


            const oci =
                TMS19.ociHesapla(
                    actuarialGainLoss
                );


            const closingPlanAssets =
                TMS19.sayi(
                    openingPlanAssets
                ) +
                TMS19.sayi(
                    employerContributions
                );


            const closingNet =
                TMS19.netYukumlulukHesapla(
                    dboRollForward.closingDBO,
                    closingPlanAssets
                );


            return {

                opening:

                    {

                        dbo:
                            TMS19.sayi(
                                openingDBO
                            ),

                        planAssets:
                            TMS19.sayi(
                                openingPlanAssets
                            ),

                        netLiability:
                            openingNet.netDefinedBenefitLiability
                    },


                movement:

                    {

                        currentServiceCost:
                            currentServiceCost,

                        netInterest:
                            netFaiz.netFaiz,

                        pastServiceCost:
                            pastServiceCost,

                        actuarialGainLoss:
                            actuarialGainLoss,

                        benefitPayments:
                            benefitPayments,

                        employerContributions:
                            employerContributions
                    },


                closing:

                    {

                        dbo:
                            dboRollForward.closingDBO,

                        planAssets:
                            closingPlanAssets,

                        netLiability:
                            closingNet.netDefinedBenefitLiability
                    },


                pnl:
                    pnl,

                oci:
                    oci,

                kontrol:
                    {

                        dboRollForward:
                            dboRollForward.reconciliationCheck
                    }
            };
        };


    /* ============================================================
       23 — DUYARLILIK
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
                    varsayimlar
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
                    alternatif
                );


            const fark =
                senaryo.dbo -
                baz.dbo;


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
                    fark,

                farkYuzde:
                    baz.dbo !== 0
                        ? fark /
                        baz.dbo
                        : 0
            };
        };


    /* ============================================================
       24 — PORTFÖY DUYARLILIK
    ============================================================ */

    TMS19.portfoyDuyarlilik =
        function (
            personeller,
            varsayimlar,
            parametre,
            degisim
        ) {

            const baz =
                TMS19.ozetHesapla(
                    TMS19.topluHesapla(
                        personeller,
                        varsayimlar
                    )
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
                TMS19.ozetHesapla(
                    TMS19.topluHesapla(
                        personeller,
                        alternatif
                    )
                );


            const fark =
                senaryo.toplamDBO -
                baz.toplamDBO;


            return {

                parametre:
                    parametre,

                degisim:
                    degisim,

                bazDBO:
                    baz.toplamDBO,

                senaryoDBO:
                    senaryo.toplamDBO,

                fark:
                    fark,

                farkYuzde:
                    baz.toplamDBO !== 0
                        ? fark /
                        baz.toplamDBO
                        : 0
            };
        };


    /* ============================================================
       25 — SENARYO MATRİSİ
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
                        "İskonto +%1",

                    parametre:
                        "iskontoOrani",

                    degisim:
                        0.01
                },

                {
                    ad:
                        "İskonto -%1",

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
                        "Devir +%1",

                    parametre:
                        "personelDevirOrani",

                    degisim:
                        0.01
                },

                {
                    ad:
                        "Devir -%1",

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

                        const ozet =
                            TMS19.ozetHesapla(
                                TMS19.topluHesapla(
                                    personeller,
                                    varsayimlar
                                )
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
       26 — AUDIT TRAIL
    ============================================================ */

    TMS19.auditTrail =
        function (
            personel,
            varsayimlar
        ) {

            const sonuc =
                TMS19.pucHesapla(
                    personel,
                    varsayimlar
                );


            return [

                {
                    adim: 1,
                    alan: "Mevcut Maaş",
                    deger: sonuc.mevcutMaas,
                    aciklama:
                        "Değerleme tarihindeki mevcut maaş."
                },

                {
                    adim: 2,
                    alan: "Yaş",
                    deger: sonuc.yas,
                    aciklama:
                        "Değerleme tarihi itibarıyla yaş."
                },

                {
                    adim: 3,
                    alan: "Hizmet Süresi",
                    deger: sonuc.hizmetSuresi,
                    aciklama:
                        "Mevcut hizmet süresi."
                },

                {
                    adim: 4,
                    alan: "Emekliliğe Kalan Yıl",
                    deger: sonuc.emekliligeKalanYil,
                    aciklama:
                        "Emeklilik yaşına kalan süre."
                },

                {
                    adim: 5,
                    alan: "Toplam Hizmet",
                    deger: sonuc.toplamHizmet,
                    aciklama:
                        "Mevcut ve gelecekteki toplam hizmet."
                },

                {
                    adim: 6,
                    alan: "Emeklilik Maaşı",
                    deger: sonuc.emeklilikMaasi,
                    aciklama:
                        "Maaş artış varsayımı ile projekte edilen maaş."
                },

                {
                    adim: 7,
                    alan: "Projeksiyon Kıdem Tavanı",
                    deger: sonuc.projectedCeiling,
                    aciklama:
                        "Emeklilik tarihine projekte edilen kıdem tavanı."
                },

                {
                    adim: 8,
                    alan: "Fayda Hesaplama Maaşı",
                    deger: sonuc.faydaHesaplamaMaasi,
                    aciklama:
                        "Kıdem tavanı uygulandıktan sonra kullanılan maaş."
                },

                {
                    adim: 9,
                    alan: "Toplam Fayda",
                    deger: sonuc.toplamFayda,
                    aciklama:
                        "Toplam hizmet dönemi için hesaplanan fayda."
                },

                {
                    adim: 10,
                    alan: "Kazanılmış Fayda",
                    deger: sonuc.kazanilmisFayda,
                    aciklama:
                        "Geçmiş hizmet dönemine tahsis edilen fayda."
                },

                {
                    adim: 11,
                    alan: "Devam Olasılığı",
                    deger: sonuc.devamOlasiligi,
                    aciklama:
                        "Turnover ve mortality varsayımları sonrası devam olasılığı."
                },

                {
                    adim: 12,
                    alan: "Beklenen Fayda",
                    deger: sonuc.beklenenFayda,
                    aciklama:
                        "Demografik olasılıklar uygulanmış fayda."
                },

                {
                    adim: 13,
                    alan: "İskonto Faktörü",
                    deger: sonuc.iskontoFaktoru,
                    aciklama:
                        "Bugünkü değer faktörü."
                },

                {
                    adim: 14,
                    alan: "DBO",
                    deger: sonuc.dbo,
                    aciklama:
                        "Defined Benefit Obligation."
                },

                {
                    adim: 15,
                    alan: "Cari Hizmet Maliyeti",
                    deger: sonuc.cariHizmetMaliyeti,
                    aciklama:
                        "Cari dönemde kazanılan hizmet maliyeti."
                },

                {
                    adim: 16,
                    alan: "Faiz Maliyeti",
                    deger: sonuc.faizMaliyeti,
                    aciklama:
                        "DBO üzerinden hesaplanan faiz maliyeti."
                },

                {
                    adim: 17,
                    alan: "Toplam Dönem Maliyeti",
                    deger: sonuc.toplamDonemMaliyeti,
                    aciklama:
                        "Cari hizmet maliyeti ve faiz maliyetinin toplamı."
                }
            ];
        };


    /* ============================================================
       27 — RİSK ANALİZİ
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
                sonuc.devamOlasiligi < 0.50
            ) {

                riskler.push({

                    kod:
                        "DEMOGRAFİK_RİSK",

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
                        "EMEKLİLİK_RİSKİ",

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
                        "DBO_RİSKİ",

                    seviye:
                        "YÜKSEK",

                    mesaj:
                        "DBO mevcut maaş seviyesine göre yüksektir."
                });
            }


            let genelRisk = "DÜŞÜK";


            if (
                riskler.some(
                    function (x) {
                        return x.seviye === "YÜKSEK";
                    }
                )
            ) {

                genelRisk = "YÜKSEK";

            }
            else if (
                riskler.some(
                    function (x) {
                        return x.seviye === "ORTA";
                    }
                )
            ) {

                genelRisk = "ORTA";
            }


            return {

                genelRisk:
                    genelRisk,

                riskSayisi:
                    riskler.length,

                riskler:
                    riskler
            };
        };


    /* ============================================================
       28 — EXPORT SATIRI
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

                "Durum":
                    sonuc.hesaplamaDurumu
            };
        };


    /* ============================================================
       29 — PERSONEL RAPORU
    ============================================================ */

    TMS19.personelRaporu =
        function (
            personel,
            varsayimlar
        ) {

            const sonuc =
                TMS19.pucHesapla(
                    personel,
                    varsayimlar
                );

            return {

                sonuc:
                    sonuc,

                projeksiyon:
                    TMS19.personelProjeksiyonu(
                        personel,
                        varsayimlar
                    ),

                auditTrail:
                    TMS19.auditTrail(
                        personel,
                        varsayimlar
                    ),

                risk:
                    TMS19.riskAnalizi(
                        sonuc
                    )
            };
        };


    /* ============================================================
       30 — PORTFÖY RAPORU
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
                        TMS19.yontem,

                    degerlemeTarihi:
                        varsayimlar.degerlemeTarihi,

                    olusturmaZamani:
                        new Date().toISOString()
                },

                varsayimlar:
                    TMS19.varsayimNormalizeEt(
                        varsayimlar
                    ),

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
       31 — FULL EXPORT DATASET
    ============================================================ */

    TMS19.exportDataset =
        function (
            personeller,
            varsayimlar
        ) {

            const sonuclar =
                TMS19.topluHesapla(
                    personeller,
                    varsayimlar
                );


            return sonuclar
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

                        return TMS19.exportSatiri(
                            x
                        );
                    }
                );
        };


    /* ============================================================
       32 — KONTROL MOTORU
    ============================================================ */

    TMS19.kontrolMotoru =
        function (
            sonuclar
        ) {

            const kontroller = [];


            sonuclar.forEach(
                function (
                    sonuc
                ) {

                    if (
                        sonuc.hesaplamaDurumu !==
                        "BAŞARILI"
                    ) {

                        kontroller.push({

                            personelId:
                                sonuc.personelId,

                            kontrol:
                                "Hesaplama",

                            durum:
                                "HATA",

                            mesaj:
                                sonuc.hata
                        });

                        return;
                    }


                    if (
                        Math.abs(
                            sonuc.kontrolHizmetFarki
                        ) > 0.000001
                    ) {

                        kontroller.push({

                            personelId:
                                sonuc.personelId,

                            kontrol:
                                "Hizmet Tahsisi",

                            durum:
                                "KONTROL",

                            mesaj:
                                "Geçmiş ve gelecek hizmet oranları toplamı 1 değil."
                        });
                    }


                    if (
                        sonuc.dbo < 0
                    ) {

                        kontroller.push({

                            personelId:
                                sonuc.personelId,

                            kontrol:
                                "DBO",

                            durum:
                                "KONTROL",

                            mesaj:
                                "DBO negatif hesaplandı."
                        });
                    }
                }
            );


            return {

                toplamKontrol:
                    kontroller.length,

                durum:
                    kontroller.length === 0
                        ? "TEMİZ"
                        : "KONTROL GEREKLİ",

                kontroller:
                    kontroller
            };
        };


    /* ============================================================
       33 — HEALTH CHECK
    ============================================================ */

    TMS19.healthCheck =
        function () {

            return {

                durum:
                    "AKTİF",

                motor:
                    TMS19.motorAdi,

                versiyon:
                    TMS19.versiyon,

                yontem:
                    TMS19.yontem,

                zaman:
                    new Date().toISOString(),

                fonksiyonSayisi:
                    Object.keys(
                        TMS19
                    ).length,

                fonksiyonlar:
                    Object.keys(
                        TMS19
                    )
            };
        };


    /* ============================================================
       34 — GLOBAL EXPORT
    ============================================================ */

    global.TMS19 = TMS19;


})(window);
