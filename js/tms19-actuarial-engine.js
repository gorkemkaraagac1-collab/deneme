/* ============================================================
   GK ADVISORY
   TMS 19 — AKTÜERYAL HESAPLAMA MOTORU
   ------------------------------------------------------------
   Projected Unit Credit yaklaşımı
   Personel bazlı DBO projeksiyonu
   Aktüeryal varsayımlar
   Duyarlılık analizi
   Roll-forward
   P&L / OCI ayrıştırması
   ============================================================ */

"use strict";


/* ============================================================
   1. GENEL AYARLAR
============================================================ */

const TMS19_CONFIG = {

    sürüm: "2.0.0",

    değerlemeTarihi: new Date("2026-12-31"),

    varsayımlar: {

        iskontoOranı: 0.28,

        maaşArtışOranı: 0.25,

        personelDevirOranı: 0.08,

        emeklilikYaşı: 60,

        yıllıkÇalışmaGünü: 365,

        aylıkÇalışmaGünü: 30,

        yıllıkÖdemeArtışOranı: 0.00

    },

    hesaplama: {

        minimumHizmetSüresi: 0,

        maksimumProjeksiyonYılı: 60,

        aylıkProjeksiyon: false,

        terminalDeğer: false

    }

};


/* ============================================================
   2. YARDIMCI FONKSİYONLAR
============================================================ */


/**
 * Sayısal değeri güvenli şekilde döndürür.
 */
function sayıDeğeri(
    değer,
    varsayılan = 0
) {

    if (
        değer === null ||
        değer === undefined ||
        değer === ""
    ) {

        return varsayılan;

    }

    const sayı =
        Number(
            String(değer)
                .replace(/\./g, "")
                .replace(",", ".")
        );

    return Number.isFinite(sayı)
        ? sayı
        : varsayılan;

}


/**
 * Tarihi güvenli şekilde oluşturur.
 */
function tarihDeğeri(
    değer
) {

    if (değer instanceof Date) {

        return new Date(
            değer.getTime()
        );

    }

    if (!değer) {

        return null;

    }

    const tarih =
        new Date(
            değer
        );

    return Number.isNaN(
        tarih.getTime()
    )
        ? null
        : tarih;

}


/**
 * Yılları hesaplar.
 */
function yılFarkı(
    başlangıç,
    bitiş
) {

    const başlangıçTarihi =
        tarihDeğeri(
            başlangıç
        );

    const bitişTarihi =
        tarihDeğeri(
            bitiş
        );

    if (
        !başlangıçTarihi ||
        !bitişTarihi
    ) {

        return 0;

    }

    return (
        bitişTarihi.getTime()
        -
        başlangıçTarihi.getTime()
    )
    /
    (
        365.25 *
        24 *
        60 *
        60 *
        1000
    );

}


/**
 * İki tarih arasındaki tam yaş.
 */
function yaşHesapla(
    doğumTarihi,
    değerlemeTarihi
) {

    const doğum =
        tarihDeğeri(
            doğumTarihi
        );

    const değerleme =
        tarihDeğeri(
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
        ay < 0 ||
        (
            ay === 0 &&
            değerleme.getDate()
            <
            doğum.getDate()
        )
    ) {

        yaş--;

    }

    return yaş;

}


/**
 * Para yuvarlama.
 */
function yuvarla(
    değer,
    basamak = 2
) {

    const çarpan =
        Math.pow(
            10,
            basamak
        );

    return Math.round(
        sayıDeğeri(
            değer
        ) *
        çarpan
    ) /
    çarpan;

}


/**
 * Oran normalizasyonu.
 *
 * Kullanıcı %28 yazarsa:
 * 28 -> 0.28
 *
 * Kullanıcı 0.28 yazarsa:
 * 0.28 -> 0.28
 */
function oranNormalizeEt(
    değer
) {

    const sayı =
        sayıDeğeri(
            değer
        );

    if (
        Math.abs(sayı) > 1
    ) {

        return sayı / 100;

    }

    return sayı;

}


/**
 * Bugünkü değer.
 */
function bugünküDeğer(
    tutar,
    oran,
    dönem
) {

    return sayıDeğeri(
        tutar
    )
    /
    Math.pow(
        1 + oran,
        dönem
    );

}


/**
 * Gelecekteki değer.
 */
function gelecekDeğer(
    tutar,
    oran,
    dönem
) {

    return sayıDeğeri(
        tutar
    )
    *
    Math.pow(
        1 + oran,
        dönem
    );

}


/* ============================================================
   3. PERSONEL VERİ MODELİ
============================================================ */


/**
 * Personel verisini standart modele dönüştürür.
 */
function personelNormalizeEt(
    personel,
    varsayımlar = {}
) {

    const değerlemeTarihi =
        tarihDeğeri(
            varsayımlar.değerlemeTarihi
        )
        ||
        TMS19_CONFIG.değerlemeTarihi;


    const doğumTarihi =
        tarihDeğeri(
            personel.doğumTarihi
            ??
            personel.dogumTarihi
            ??
            personel.birthDate
        );


    const işeGirişTarihi =
        tarihDeğeri(
            personel.işeGirişTarihi
            ??
            personel.iseGirisTarihi
            ??
            personel.startDate
            ??
            personel.hireDate
        );


    const mevcutMaaş =
        sayıDeğeri(
            personel.mevcutMaaş
            ??
            personel.mevcutMaas
            ??
            personel.salary
            ??
            personel.aylıkMaaş
            ??
            personel.aylikMaas
        );


    const yıllıkMaaş =
        sayıDeğeri(
            personel.yıllıkMaaş
            ??
            personel.yillikMaas
        )
        ||
        mevcutMaaş * 12;


    const yaş =
        sayıDeğeri(
            personel.yaş
            ??
            personel.yas
        )
        ||
        yaşHesapla(
            doğumTarihi,
            değerlemeTarihi
        );


    const hizmetSüresi =
        sayıDeğeri(
            personel.hizmetSüresi
            ??
            personel.hizmetSuresi
        )
        ||
        (
            işeGirişTarihi
                ? Math.max(
                    0,
                    yılFarkı(
                        işeGirişTarihi,
                        değerlemeTarihi
                    )
                )
                : 0
        );


    return {

        sicilNo:
            personel.sicilNo
            ??
            personel.sicil
            ??
            personel.employeeId
            ??
            personel.id
            ??
            "",

        adSoyad:
            personel.adSoyad
            ??
            personel.ad
            ??
            personel.name
            ??
            "",

        cinsiyet:
            personel.cinsiyet
            ??
            personel.gender
            ??
            "",

        doğumTarihi,

        işeGirişTarihi,

        yaş,

        hizmetSüresi,

        mevcutMaaş,

        yıllıkMaaş,

        pozisyon:
            personel.pozisyon
            ??
            personel.position
            ??
            "",

        departman:
            personel.departman
            ??
            personel.department
            ??
            "",

        emeklilikYaşı:
            sayıDeğeri(
                personel.emeklilikYaşı
                ??
                personel.emeklilikYasi
            )
            ||
            sayıDeğeri(
                varsayımlar.emeklilikYaşı
            ),

        devirOranı:
            oranNormalizeEt(
                personel.devirOranı
                ??
                personel.devirOrani
                ??
                varsayımlar.personelDevirOranı
            ),

        özelFaydaTutarı:
            sayıDeğeri(
                personel.özelFaydaTutarı
                ??
                personel.ozelFaydaTutari
            )

    };

}


/* ============================================================
   4. TMS 19 FAYDA FORMÜLÜ
============================================================ */


/**
 * Hizmet yılına bağlı tahmini nihai fayda.
 *
 * Bu fonksiyon şirketin gerçek kıdem / emeklilik
 * formülüyle parametrik hale getirilebilir.
 *
 * Varsayılan yaklaşım:
 *
 * Nihai aylık maaş
 * × toplam hizmet yılı
 *
 * Burada 1 aylık maaş / hizmet yılı
 * temel fayda faktörü olarak kullanılır.
 */
function nihaiFaydaHesapla(
    personel,
    varsayımlar,
    toplamHizmetYılı,
    nihaiMaaş
) {

    const faydaFaktörü =
        sayıDeğeri(
            varsayımlar.faydaFaktörü,
            1
        );


    return (
        nihaiMaaş
        *
        toplamHizmetYılı
        *
        faydaFaktörü
    );

}


/* ============================================================
   5. GELECEK MAAŞ PROJEKSİYONU
============================================================ */

function gelecektekiMaaşHesapla(
    mevcutMaaş,
    maaşArtışOranı,
    yıl
) {

    return gelecekDeğer(
        mevcutMaaş,
        maaşArtışOranı,
        yıl
    );

}


/* ============================================================
   6. EMEKLİLİK SÜRESİ
============================================================ */

function emekliliğeKalanYılHesapla(
    personel,
    varsayımlar
) {

    const yaş =
        sayıDeğeri(
            personel.yaş
        );


    const emeklilikYaşı =
        sayıDeğeri(
            personel.emeklilikYaşı
            ||
            varsayımlar.emeklilikYaşı
        );


    if (
        yaş <= 0 ||
        emeklilikYaşı <= 0
    ) {

        return 0;

    }


    return Math.max(
        0,
        emeklilikYaşı - yaş
    );

}


/* ============================================================
   7. PROJEKSİYON YILI
============================================================ */

function projeksiyonYılıHesapla(
    personel,
    varsayımlar
) {

    const emekliliğeKalan =
        emekliliğeKalanYılHesapla(
            personel,
            varsayımlar
        );


    return Math.min(
        emekliliğeKalan,
        sayıDeğeri(
            varsayımlar.maksimumProjeksiyonYılı,
            60
        )
    );

}


/* ============================================================
   8. DEVRİ / TURNOVER OLASILIĞI
============================================================ */

function hayattaKalmaOlasılığıHesapla(
    devirOranı,
    yıl
) {

    const oran =
        Math.max(
            0,
            Math.min(
                1,
                oranNormalizeEt(
                    devirOranı
                )
            )
        );


    return Math.pow(
        1 - oran,
        Math.max(
            0,
            yıl
        )
    );

}


/* ============================================================
   9. HAK EDİŞ / VESTING
============================================================ */


/**
 * Çalışanın ilgili yılda sistemde kalma
 * olasılığını dikkate alır.
 */
function hakEdilmeOlasılığıHesapla(
    personel,
    yıl
) {

    return hayattaKalmaOlasılığıHesapla(
        personel.devirOranı,
        yıl
    );

}


/* ============================================================
   10. PUC — SERVICE RATIO
============================================================ */


/**
 * Projected Unit Credit yaklaşımında
 * toplam hizmetin ilgili dönem birimine
 * düşen kısmını hesaplar.
 */
function hizmetOranıHesapla(
    mevcutHizmet,
    toplamHizmet
) {

    if (
        toplamHizmet <= 0
    ) {

        return 0;

    }


    return Math.min(
        1,
        Math.max(
            0,
            mevcutHizmet /
            toplamHizmet
        )
    );

}


/* ============================================================
   11. PERSONEL BAZLI DBO
============================================================ */

function personelDBOHesapla(
    hamPersonel,
    hamVarsayımlar = {}
) {

    const varsayımlar = {

        ...TMS19_CONFIG.varsayımlar,

        ...hamVarsayımlar

    };


    const personel =
        personelNormalizeEt(
            hamPersonel,
            {
                ...varsayımlar,

                değerlemeTarihi:
                    varsayımlar.değerlemeTarihi
                    ||
                    TMS19_CONFIG.değerlemeTarihi

            }
        );


    const iskontoOranı =
        oranNormalizeEt(
            varsayımlar.iskontoOranı
        );


    const maaşArtışOranı =
        oranNormalizeEt(
            varsayımlar.maaşArtışOranı
            ??
            varsayımlar.maasArtisOrani
        );


    const mevcutHizmet =
        Math.max(
            0,
            personel.hizmetSüresi
        );


    const emekliliğeKalan =
        projeksiyonYılıHesapla(
            personel,
            varsayımlar
        );


    const toplamHizmet =
        mevcutHizmet
        +
        emekliliğeKalan;


    /*
     * Emeklilikteki tahmini aylık maaş.
     */

    const emeklilikMaaşı =
        gelecektekiMaaşHesapla(
            personel.mevcutMaaş,
            maaşArtışOranı,
            emekliliğeKalan
        );


    /*
     * Emeklilikteki toplam tahmini fayda.
     */

    const tahminiNihaiFayda =
        nihaiFaydaHesapla(
            personel,
            varsayımlar,
            toplamHizmet,
            emeklilikMaaşı
        );


    /*
     * Mevcut hizmet oranı.
     */

    const hizmetOranı =
        hizmetOranıHesapla(
            mevcutHizmet,
            toplamHizmet
        );


    /*
     * PUC ile ilgili hizmete atfedilen
     * tahmini fayda.
     */

    const hakEdilmişFayda =
        tahminiNihaiFayda
        *
        hizmetOranı;


    /*
     * Emeklilik tarihine kadar iskonto.
     */

    const iskontoEdilmişDBO =
        bugünküDeğer(
            hakEdilmişFayda,
            iskontoOranı,
            emekliliğeKalan
        );


    /*
     * Personelin sistemde kalma olasılığı.
     */

    const devamOlasılığı =
        hakEdilmeOlasılığıHesapla(
            personel,
            emekliliğeKalan
        );


    /*
     * Aktüeryal DBO.
     */

    const DBO =
        iskontoEdilmişDBO
        *
        devamOlasılığı;


    /*
     * Cari hizmet maliyeti için
     * gelecek bir yıllık hizmetin
     * bugünkü değeri.
     */

    const birYıllıkHizmet =
        emekliliğeKalan > 0
            ? (
                tahminiNihaiFayda
                /
                toplamHizmet
            )
            : 0;


    const cariHizmetMaliyeti =
        emekliliğeKalan > 0
            ? bugünküDeğer(
                birYıllıkHizmet,
                iskontoOranı,
                emekliliğeKalan
            )
            *
            hayattaKalmaOlasılığıHesapla(
                personel.devirOranı,
                emekliliğeKalan
            )
            : 0;


    /*
     * Faiz maliyeti.
     */

    const faizMaliyeti =
        DBO *
        iskontoOranı;


    return {

        ...personel,

        mevcutHizmet,

        emekliliğeKalan,

        toplamHizmet,

        emeklilikMaaşı:

            yuvarla(
                emeklilikMaaşı
            ),

        tahminiNihaiFayda:

            yuvarla(
                tahminiNihaiFayda
            ),

        hizmetOranı:

            yuvarla(
                hizmetOranı,
                6
            ),

        hakEdilmişFayda:

            yuvarla(
                hakEdilmişFayda
            ),

        devamOlasılığı:

            yuvarla(
                devamOlasılığı,
                6
            ),

        DBO:

            yuvarla(
                DBO
            ),

        cariHizmetMaliyeti:

            yuvarla(
                cariHizmetMaliyeti
            ),

        faizMaliyeti:

            yuvarla(
                faizMaliyeti
            )

    };

}


/* ============================================================
   12. PORTFÖY HESAPLAMA
============================================================ */

function portföyHesapla(
    personelListesi = [],
    hamVarsayımlar = {}
) {

    const varsayımlar = {

        ...TMS19_CONFIG.varsayımlar,

        ...hamVarsayımlar

    };


    const sonuçlar =
        personelListesi.map(
            personel =>
                personelDBOHesapla(
                    personel,
                    varsayımlar
                )
        );


    const toplamDBO =
        sonuçlar.reduce(
            (
                toplam,
                personel
            ) =>
                toplam
                +
                personel.DBO,
            0
        );


    const toplamCariHizmetMaliyeti =
        sonuçlar.reduce(
            (
                toplam,
                personel
            ) =>
                toplam
                +
                personel.cariHizmetMaliyeti,
            0
        );


    const toplamFaizMaliyeti =
        sonuçlar.reduce(
            (
                toplam,
                personel
            ) =>
                toplam
                +
                personel.faizMaliyeti,
            0
        );


    return {

        personeller:
            sonuçlar,

        personelSayısı:
            sonuçlar.length,

        toplamDBO:
            yuvarla(
                toplamDBO
            ),

        toplamCariHizmetMaliyeti:
            yuvarla(
                toplamCariHizmetMaliyeti
            ),

        toplamFaizMaliyeti:
            yuvarla(
                toplamFaizMaliyeti
            )

    };

}


/* ============================================================
   13. AÇILIŞ DBO
============================================================ */


/**
 * Gerçek uygulamada açılış DBO,
 * önceki yıl kapanış aktüeryal raporundan
 * gelmelidir.
 *
 * Eğer kullanıcı veri sağlamazsa
 * kapanış DBO proxy olarak kullanılabilir.
 */
function açılışDBOHesapla(
    personelListesi,
    varsayımlar,
    manuelAçılışDBO = null
) {

    if (
        manuelAçılışDBO !== null &&
        manuelAçılışDBO !== undefined
    ) {

        return sayıDeğeri(
            manuelAçılışDBO
        );

    }


    /*
     * Demo / ilk dönem yaklaşımı.
     *
     * Üretim sisteminde burası önceki dönem
     * kapanış verisine bağlanmalıdır.
     */

    const geçmişVarsayımlar = {

        ...varsayımlar,

        değerlemeTarihi:
            new Date(
                (
                    tarihDeğeri(
                        varsayımlar.değerlemeTarihi
                    )
                    ||
                    TMS19_CONFIG.değerlemeTarihi
                ).getFullYear() - 1,
                11,
                31
            )

    };


    const geçmiş =
        portföyHesapla(
            personelListesi,
            geçmişVarsayımlar
        );


    return geçmiş.toplamDBO;

}


/* ============================================================
   14. ROLL-FORWARD
============================================================ */

function rollForwardHesapla(
    personelListesi,
    varsayımlar = {},
    manuelAçılışDBO = null,
    ödenenFaydalar = 0
) {

    const portföy =
        portföyHesapla(
            personelListesi,
            varsayımlar
        );


    const kapanışDBO =
        portföy.toplamDBO;


    const açılışDBO =
        açılışDBOHesapla(
            personelListesi,
            varsayımlar,
            manuelAçılışDBO
        );


    const cariHizmetMaliyeti =
        portföy.toplamCariHizmetMaliyeti;


    const faizMaliyeti =
        açılışDBO
        *
        oranNormalizeEt(
            varsayımlar.iskontoOranı
        );


    const faydaÖdemeleri =
        Math.abs(
            sayıDeğeri(
                ödenenFaydalar
            )
        );


    /*
     * Aktüeryal yeniden ölçüm:
     *
     * Kapanış DBO =
     * Açılış DBO
     * + Cari hizmet
     * + Faiz
     * + Yeniden ölçüm
     * - Ödemeler
     *
     * Buradan yeniden ölçüm solve edilir.
     */

    const aktüeryalKazançKayıp =
        kapanışDBO
        -
        açılışDBO
        -
        cariHizmetMaliyeti
        -
        faizMaliyeti
        +
        faydaÖdemeleri;


    const netPnl =
        cariHizmetMaliyeti
        +
        faizMaliyeti;


    return {

        açılışDBO:
            yuvarla(
                açılışDBO
            ),

        cariHizmetMaliyeti:
            yuvarla(
                cariHizmetMaliyeti
            ),

        faizMaliyeti:
            yuvarla(
                faizMaliyeti
            ),

        aktüeryalKazançKayıp:
            yuvarla(
                aktüeryalKazançKayıp
            ),

        ödenenFaydalar:
            yuvarla(
                faydaÖdemeleri
            ),

        kapanışDBO:
            yuvarla(
                kapanışDBO
            ),

        netPnl:
            yuvarla(
                netPnl
            ),

        oci:
            yuvarla(
                aktüeryalKazançKayıp
            ),

        portföy

    };

}


/* ============================================================
   15. DUYARLILIK — GENEL
============================================================ */

function duyarlılıkHesapla(
    personelListesi,
    varsayımlar,
    bazDBO
) {

    const baz =
        portföyHesapla(
            personelListesi,
            varsayımlar
        );


    const bazDeğeri =
        bazDBO ??
        baz.toplamDBO;


    /*
     * İSKONTO
     */

    const iskonto =
        oranNormalizeEt(
            varsayımlar.iskontoOranı
        );


    const iskontoMinus =
        portföyHesapla(
            personelListesi,
            {
                ...varsayımlar,

                iskontoOranı:
                    iskonto - 0.01

            }
        );


    const iskontoPlus =
        portföyHesapla(
            personelListesi,
            {
                ...varsayımlar,

                iskontoOranı:
                    iskonto + 0.01

            }
        );


    /*
     * MAAŞ
     */

    const maaşArtışı =
        oranNormalizeEt(
            varsayımlar.maaşArtışOranı
            ??
            varsayımlar.maasArtisOrani
        );


    const maaşMinus =
        portföyHesapla(
            personelListesi,
            {
                ...varsayımlar,

                maaşArtışOranı:
                    maaşArtışı - 0.01

            }
        );


    const maaşPlus =
        portföyHesapla(
            personelListesi,
            {
                ...varsayımlar,

                maaşArtışOranı:
                    maaşArtışı + 0.01

            }
        );


    function senaryo(
        oran,
        DBO
    ) {

        return {

            rate:
                oran,

            dbo:
                DBO,

            change:
                DBO - bazDeğeri,

            changePercent:
                bazDeğeri !== 0
                    ? (
                        (
                            DBO -
                            bazDeğeri
                        )
                        /
                        bazDeğeri
                    )
                    * 100
                    : 0

        };

    }


    return {

        discount: {

            minus:
                senaryo(
                    iskonto - 0.01,
                    iskontoMinus.toplamDBO
                ),

            base:
                senaryo(
                    iskonto,
                    bazDeğeri
                ),

            plus:
                senaryo(
                    iskonto + 0.01,
                    iskontoPlus.toplamDBO
                )

        },


        salary: {

            minus:
                senaryo(
                    maaşArtışı - 0.01,
                    maaşMinus.toplamDBO
                ),

            base:
                senaryo(
                    maaşArtışı,
                    bazDeğeri
                ),

            plus:
                senaryo(
                    maaşArtışı + 0.01,
                    maaşPlus.toplamDBO
                )

        }

    };

}


/* ============================================================
   16. ANA AKTÜERYAL HESAPLAMA
============================================================ */

function TMS19AktüeryalHesapla(
    personelListesi = [],
    hamVarsayımlar = {},
    seçenekler = {}
) {

    const varsayımlar = {

        ...TMS19_CONFIG.varsayımlar,

        ...hamVarsayımlar

    };


    /*
     * Oranları normalize et.
     */

    varsayımlar.iskontoOranı =
        oranNormalizeEt(
            varsayımlar.iskontoOranı
        );


    varsayımlar.maaşArtışOranı =
        oranNormalizeEt(
            varsayımlar.maaşArtışOranı
            ??
            varsayımlar.maasArtisOrani
        );


    varsayımlar.personelDevirOranı =
        oranNormalizeEt(
            varsayımlar.personelDevirOranı
            ??
            varsayımlar.personelDevirOrani
        );


    varsayımlar.emeklilikYaşı =
        sayıDeğeri(
            varsayımlar.emeklilikYaşı,
            60
        );


    /*
     * Personel hesaplama.
     */

    const portföy =
        portföyHesapla(
            personelListesi,
            varsayımlar
        );


    /*
     * Roll-forward.
     */

    const rollForward =
        rollForwardHesapla(
            personelListesi,
            varsayımlar,
            seçenekler.açılışDBO,
            seçenekler.ödenenFaydalar
        );


    /*
     * Duyarlılık.
     */

    const duyarlılık =
        duyarlılıkHesapla(
            personelListesi,
            varsayımlar,
            portföy.toplamDBO
        );


    /*
     * Finansal sonuç.
     */

    const sonuç = {

        durum:
            "başarılı",

        hesaplamaTarihi:
            new Date(),

        değerlemeTarihi:
            tarihDeğeri(
                varsayımlar.değerlemeTarihi
            )
            ||
            TMS19_CONFIG.değerlemeTarihi,

        varsayımlar,

        personeller:
            portföy.personeller,

        personelSayısı:
            portföy.personelSayısı,

        openingDBO:
            rollForward.açılışDBO,

        closingDBO:
            rollForward.kapanışDBO,

        dbo:
            rollForward.kapanışDBO,

        totalDBO:
            rollForward.kapanışDBO,

        currentServiceCost:
            rollForward.cariHizmetMaliyeti,

        serviceCost:
            rollForward.cariHizmetMaliyeti,

        interestCost:
            rollForward.faizMaliyeti,

        netInterestCost:
            rollForward.faizMaliyeti,

        remeasurement:
            rollForward.aktüeryalKazançKayıp,

        actuarialGainLoss:
            rollForward.aktüeryalKazançKayıp,

        benefitsPaid:
            rollForward.ödenenFaydalar,

        oci:
            rollForward.oci,

        netPnl:
            rollForward.netPnl,

        rollForward,

        sensitivity:
            duyarlılık

    };


    /*
     * Global event.
     */

    try {

        window.dispatchEvent(
            new CustomEvent(
                "tms19:calculation-complete",
                {
                    detail:
                        sonuç
                }
            )
        );

    } catch (
        hata
    ) {

        console.warn(
            "TMS 19 event yayınlanamadı:",
            hata
        );

    }


    return sonuç;

}


/* ============================================================
   17. CSV VERİSİNİ PERSONELE ÇEVİR
============================================================ */

function CSVPersonelDönüştür(
    satırlar = []
) {

    return satırlar.map(
        satır => {

            return {

                sicilNo:
                    satır["Sicil No"]
                    ??
                    satır["Sicil"]
                    ??
                    satır["Employee ID"]
                    ??
                    satır["employeeId"],

                adSoyad:
                    satır["Ad Soyad"]
                    ??
                    satır["Ad Soyad"]
                    ??
                    satır["Çalışan"]
                    ??
                    satır["Employee Name"],

                cinsiyet:
                    satır["Cinsiyet"]
                    ??
                    satır["Gender"],

                doğumTarihi:
                    satır["Doğum Tarihi"]
                    ??
                    satır["Dogum Tarihi"]
                    ??
                    satır["Birth Date"],

                işeGirişTarihi:
                    satır["İşe Giriş Tarihi"]
                    ??
                    satır["Ise Giris Tarihi"]
                    ??
                    satır["Hire Date"],

                mevcutMaaş:
                    satır["Mevcut Maaş"]
                    ??
                    satır["Mevcut Maas"]
                    ??
                    satır["Aylık Maaş"]
                    ??
                    satır["Salary"],

                hizmetSüresi:
                    satır["Hizmet Süresi"]
                    ??
                    satır["Hizmet Suresi"],

                yaş:
                    satır["Yaş"]
                    ??
                    satır["Yas"],

                pozisyon:
                    satır["Pozisyon"],

                departman:
                    satır["Departman"],

                emeklilikYaşı:
                    satır["Emeklilik Yaşı"]
                    ??
                    satır["Emeklilik Yasi"]

            };

        }
    );

}


/* ============================================================
   18. VERİ KALİTESİ
============================================================ */

function TMS19VeriKalitesiKontrol(
    personelListesi = []
) {

    const kontroller = {

        toplamPersonel:
            personelListesi.length,

        sicilEksik:
            0,

        adEksik:
            0,

        doğumTarihiEksik:
            0,

        işeGirişTarihiEksik:
            0,

        maaşEksik:
            0,

        negatifMaaş:
            0,

        emeklilikYaşıUyumsuz:
            0,

        mükerrerSicil:
            0

    };


    const siciller =
        new Set();


    personelListesi.forEach(
        hamPersonel => {

            const personel =
                personelNormalizeEt(
                    hamPersonel
                );


            if (
                !personel.sicilNo
            ) {

                kontroller.sicilEksik++;

            }


            if (
                !personel.adSoyad
            ) {

                kontroller.adEksik++;

            }


            if (
                !personel.doğumTarihi
            ) {

                kontroller.doğumTarihiEksik++;

            }


            if (
                !personel.işeGirişTarihi
            ) {

                kontroller.işeGirişTarihiEksik++;

            }


            if (
                !personel.mevcutMaaş
            ) {

                kontroller.maaşEksik++;

            }


            if (
                personel.mevcutMaaş < 0
            ) {

                kontroller.negatifMaaş++;

            }


            if (
                personel.emeklilikYaşı > 0 &&
                personel.yaş >=
                personel.emeklilikYaşı
            ) {

                kontroller.emeklilikYaşıUyumsuz++;

            }


            if (
                personel.sicilNo
            ) {

                if (
                    siciller.has(
                        personel.sicilNo
                    )
                ) {

                    kontroller.mükerrerSicil++;

                }

                siciller.add(
                    personel.sicilNo
                );

            }

        }
    );


    const toplamHata =
        Object.keys(
            kontroller
        )
        .filter(
            anahtar =>
                anahtar !==
                "toplamPersonel"
        )
        .reduce(
            (
                toplam,
                anahtar
            ) =>
                toplam
                +
                kontroller[anahtar],
            0
        );


    const veriSayısı =
        Math.max(
            1,
            personelListesi.length
        );


    /*
     * Basit fakat açıklanabilir kalite skoru.
     */

    const hataOranı =
        toplamHata
        /
        (
            veriSayısı * 9
        );


    const kaliteSkoru =
        Math.max(
            0,
            Math.min(
                100,
                100 -
                (
                    hataOranı *
                    100
                )
            )
        );


    let seviye =
        "kritik";


    if (
        kaliteSkoru >= 95
    ) {

        seviye =
            "mükemmel";

    } else if (
        kaliteSkoru >= 85
    ) {

        seviye =
            "yüksek";

    } else if (
        kaliteSkoru >= 70
    ) {

        seviye =
            "orta";

    }


    return {

        ...kontroller,

        toplamHata,

        kaliteSkoru:
            yuvarla(
                kaliteSkoru,
                1
            ),

        seviye

    };

}


/* ============================================================
   19. YÖNETİCİ ÖZETİ
============================================================ */

function TMS19YöneticiÖzeti(
    sonuç
) {

    if (!sonuç) {

        return null;

    }


    const dbo =
        sayıDeğeri(
            sonuç.closingDBO
        );


    const service =
        sayıDeğeri(
            sonuç.currentServiceCost
        );


    const interest =
        sayıDeğeri(
            sonuç.netInterestCost
        );


    const oci =
        sayıDeğeri(
            sonuç.oci
        );


    return {

        DBO:
            dbo,

        cariHizmetMaliyeti:
            service,

        faizMaliyeti:
            interest,

        PnL:
            service + interest,

        OCI:
            oci,

        personelSayısı:
            sonuç.personelSayısı,

        PnLDBOOranı:
            dbo !== 0
                ? (
                    (
                        service +
                        interest
                    )
                    /
                    dbo
                )
                : 0,

        yorumlar: [

            dbo > 0
                ? "TMS 19 yükümlülüğü mevcut."
                : "TMS 19 yükümlülüğü hesaplanamadı.",

            service > 0
                ? "Cari hizmet maliyeti dönem kâr veya zararını artırmaktadır."
                : "Cari hizmet maliyeti bulunmamaktadır.",

            Math.abs(oci) > 0
                ? "Aktüeryal yeniden ölçüm OCI üzerinde etki yaratmaktadır."
                : "Belirgin aktüeryal yeniden ölçüm etkisi bulunmamaktadır."

        ]

    };

}


/* ============================================================
   20. GLOBAL API
============================================================ */

window.TMS19 = {

    config:
        TMS19_CONFIG,

    hesapla:
        TMS19AktüeryalHesapla,

    personelHesapla:
        personelDBOHesapla,

    portföyHesapla:
        portföyHesapla,

    rollForwardHesapla:
        rollForwardHesapla,

    duyarlılıkHesapla:
        duyarlılıkHesapla,

    veriKalitesi:
        TMS19VeriKalitesiKontrol,

    yöneticiÖzeti:
        TMS19YöneticiÖzeti,

    CSVPersonelDönüştür:
        CSVPersonelDönüştür

};


/* ============================================================
   21. ESKİ İSİMLERLE UYUMLULUK
============================================================ */

window.TMS19AktüeryalMotor =
    TMS19AktüeryalHesapla;


window.hesaplaTMS19 =
    TMS19AktüeryalHesapla;


/* ============================================================
   22. KONSOL BİLGİSİ
============================================================ */

console.log(
    "GK Advisory — TMS 19 Aktüeryal Motor v" +
    TMS19_CONFIG.sürüm +
    " hazır."
);


/* ============================================================
   23. DEMO HESAPLAMA FONKSİYONU
============================================================ */

function TMS19DemoÇalıştır() {

    const demoPersoneller = [

        {

            sicilNo:
                "10001",

            adSoyad:
                "Demo Çalışan 1",

            doğumTarihi:
                "1988-05-10",

            işeGirişTarihi:
                "2018-01-01",

            mevcutMaaş:
                75000,

            cinsiyet:
                "E",

            departman:
                "Finans"

        },

        {

            sicilNo:
                "10002",

            adSoyad:
                "Demo Çalışan 2",

            doğumTarihi:
                "1992-08-20",

            işeGirişTarihi:
                "2020-06-01",

            mevcutMaaş:
                60000,

            cinsiyet:
                "K",

            departman:
                "İnsan Kaynakları"

        }

    ];


    return TMS19AktüeryalHesapla(

        demoPersoneller,

        {

            iskontoOranı:
                0.28,

            maaşArtışOranı:
                0.25,

            personelDevirOranı:
                0.08,

            emeklilikYaşı:
                60,

            değerlemeTarihi:
                "2026-12-31"

        },

        {

            ödenenFaydalar:
                0

        }

    );

}


/* ============================================================
   24. DEMO API
============================================================ */

window.TMS19DemoÇalıştır =
    TMS19DemoÇalıştır;

/* ============================================================
   25. YILLIK AKTÜERYAL PROJEKSİYON MOTORU
   ------------------------------------------------------------
   Personel bazında yıllık projeksiyon üretir.
   ============================================================ */

function TMS19YıllıkProjeksiyonHesapla(
    hamPersonel,
    hamVarsayımlar = {}
) {

    const varsayımlar = {

        ...TMS19_CONFIG.varsayımlar,

        ...hamVarsayımlar

    };


    const personel =
        personelNormalizeEt(
            hamPersonel,
            varsayımlar
        );


    const iskontoOranı =
        oranNormalizeEt(
            varsayımlar.iskontoOranı
        );


    const maaşArtışOranı =
        oranNormalizeEt(
            varsayımlar.maaşArtışOranı
        );


    const başlangıçTarihi =
        tarihDeğeri(
            varsayımlar.değerlemeTarihi
        )
        ||
        TMS19_CONFIG.değerlemeTarihi;


    const başlangıçYılı =
        başlangıçTarihi.getFullYear();


    const emeklilikYaşı =
        sayıDeğeri(
            personel.emeklilikYaşı,
            60
        );


    const mevcutYaş =
        sayıDeğeri(
            personel.yaş
        );


    const emekliliğeKalan =
        Math.max(
            0,
            emeklilikYaşı -
            mevcutYaş
        );


    const toplamHizmet =
        personel.hizmetSüresi +
        emekliliğeKalan;


    const projeksiyonlar = [];


    /*
     * Her gelecek yıl için hesaplama.
     */

    for (
        let yıl = 0;
        yıl <= emekliliğeKalan;
        yıl++
    ) {

        const takvimYılı =
            başlangıçYılı +
            yıl;


        const yaş =
            mevcutYaş +
            yıl;


        const hizmet =
            personel.hizmetSüresi +
            yıl;


        /*
         * Gelecekteki maaş.
         */

        const maaş =
            gelecektekiMaaşHesapla(
                personel.mevcutMaaş,
                maaşArtışOranı,
                yıl
            );


        /*
         * Kümülatif devir olasılığı.
         */

        const hayattaKalma =
            hayattaKalmaOlasılığıHesapla(
                personel.devirOranı,
                yıl
            );


        /*
         * Kalan hizmet.
         */

        const kalanHizmet =
            Math.max(
                0,
                toplamHizmet -
                hizmet
            );


        /*
         * İlgili yıldaki tahmini nihai maaş.
         *
         * Emeklilik maaşını temel alıyoruz.
         */

        const emeklilikMaaşı =
            gelecektekiMaaşHesapla(
                personel.mevcutMaaş,
                maaşArtışOranı,
                emekliliğeKalan
            );


        /*
         * Tahmini nihai fayda.
         */

        const nihaiFayda =
            nihaiFaydaHesapla(
                personel,
                varsayımlar,
                toplamHizmet,
                emeklilikMaaşı
            );


        /*
         * İlgili yılda kazanılmış hizmet oranı.
         */

        const hizmetOranı =
            hizmetOranıHesapla(
                hizmet,
                toplamHizmet
            );


        /*
         * O yıla kadar kazanılmış fayda.
         */

        const kazanılmışFayda =
            nihaiFayda *
            hizmetOranı;


        /*
         * Emeklilik tarihine kalan süre.
         */

        const emekliliğeKalanYıl =
            Math.max(
                0,
                emekliliğeKalan -
                yıl
            );


        /*
         * İskonto faktörü.
         */

        const iskontoFaktörü =
            1 /
            Math.pow(
                1 + iskontoOranı,
                emekliliğeKalanYıl
            );


        /*
         * Beklenen fayda.
         */

        const beklenenFayda =
            kazanılmışFayda *
            hayattaKalma;


        /*
         * Bugünkü değer.
         */

        const bugünküDeğerFayda =
            beklenenFayda *
            iskontoFaktörü;


        /*
         * Bir sonraki yılın hizmet katkısı.
         */

        const sonrakiHizmet =
            Math.min(
                toplamHizmet,
                hizmet + 1
            );


        const sonrakiHizmetOranı =
            hizmetOranıHesapla(
                sonrakiHizmet,
                toplamHizmet
            );


        const hizmetArtışı =
            Math.max(
                0,
                sonrakiHizmetOranı -
                hizmetOranı
            );


        /*
         * Tahmini cari hizmet maliyeti.
         */

        const tahminiCariHizmet =
            nihaiFayda *
            hizmetArtışı *
            hayattaKalma *
            iskontoFaktörü;


        /*
         * Dönem başı DBO.
         */

        const dönemBaşıDBO =
            yıl === 0
                ? 0
                : projeksiyonlar[
                    projeksiyonlar.length - 1
                ].dönemSonuDBO;


        /*
         * Faiz maliyeti.
         */

        const faizMaliyeti =
            dönemBaşıDBO *
            iskontoOranı;


        /*
         * Dönem sonu DBO.
         */

        const dönemSonuDBO =
            bugünküDeğerFayda;


        projeksiyonlar.push({

            yıl:

                takvimYılı,

            dönem:

                yıl,

            yaş:

                yaş,

            hizmetYılı:

                yuvarla(
                    hizmet,
                    2
                ),

            kalanHizmet:

                yuvarla(
                    kalanHizmet,
                    2
                ),

            mevcutMaaş:

                yuvarla(
                    maaş
                ),

            emeklilikMaaşı:

                yuvarla(
                    emeklilikMaaşı
                ),

            nihaiFayda:

                yuvarla(
                    nihaiFayda
                ),

            hizmetOranı:

                yuvarla(
                    hizmetOranı,
                    6
                ),

            hayattaKalmaOlasılığı:

                yuvarla(
                    hayattaKalma,
                    6
                ),

            iskontoFaktörü:

                yuvarla(
                    iskontoFaktörü,
                    8
                ),

            beklenenFayda:

                yuvarla(
                    beklenenFayda
                ),

            bugünküDeğer:

                yuvarla(
                    bugünküDeğerFayda
                ),

            cariHizmetMaliyeti:

                yuvarla(
                    tahminiCariHizmet
                ),

            faizMaliyeti:

                yuvarla(
                    faizMaliyeti
                ),

            dönemBaşıDBO:

                yuvarla(
                    dönemBaşıDBO
                ),

            dönemSonuDBO:

                yuvarla(
                    dönemSonuDBO
                )

        });

    }


    return {

        personel:

            personel,

        başlangıçYılı:

            başlangıçYılı,

        emeklilikYılı:

            başlangıçYılı +
            emekliliğeKalan,

        emekliliğeKalan:

            emekliliğeKalan,

        projeksiyon:

            projeksiyonlar

    };

}


/* ============================================================
   26. TÜM PERSONEL İÇİN PROJEKSİYON
============================================================ */

function TMS19TümProjeksiyonlarıHesapla(
    personelListesi = [],
    varsayımlar = {}
) {

    return personelListesi.map(
        personel =>

            TMS19YıllıkProjeksiyonHesapla(
                personel,
                varsayımlar
            )

    );

}


/* ============================================================
   27. YILLIK PORTFÖY AKIŞI
============================================================ */

function TMS19YıllıkPortföyHesapla(
    personelListesi = [],
    varsayımlar = {}
) {

    const projeksiyonlar =
        TMS19TümProjeksiyonlarıHesapla(
            personelListesi,
            varsayımlar
        );


    const yıllar =
        new Set();


    projeksiyonlar.forEach(
        personel => {

            personel.projeksiyon.forEach(
                dönem => {

                    yıllar.add(
                        dönem.yıl
                    );

                }
            );

        }
    );


    const sonuç =
        Array.from(
            yıllar
        )
        .sort(
            (
                a,
                b
            ) =>
                a - b
        )
        .map(
            yıl => {

                const dönemler = [];


                projeksiyonlar.forEach(
                    personel => {

                        const dönem =
                            personel.projeksiyon.find(
                                kayıt =>
                                    kayıt.yıl ===
                                    yıl
                            );


                        if (
                            dönem
                        ) {

                            dönemler.push(
                                dönem
                            );

                        }

                    }
                );


                return {

                    yıl,

                    personelSayısı:
                        dönemler.length,

                    toplamDBO:
                        yuvarla(
                            dönemler.reduce(
                                (
                                    toplam,
                                    dönem
                                ) =>
                                    toplam +
                                    dönem.dönemSonuDBO,
                                0
                            )
                        ),

                    toplamCariHizmetMaliyeti:
                        yuvarla(
                            dönemler.reduce(
                                (
                                    toplam,
                                    dönem
                                ) =>
                                    toplam +
                                    dönem.cariHizmetMaliyeti,
                                0
                            )
                        ),

                    toplamFaizMaliyeti:
                        yuvarla(
                            dönemler.reduce(
                                (
                                    toplam,
                                    dönem
                                ) =>
                                    toplam +
                                    dönem.faizMaliyeti,
                                0
                            )
                        ),

                    toplamBeklenenFayda:
                        yuvarla(
                            dönemler.reduce(
                                (
                                    toplam,
                                    dönem
                                ) =>
                                    toplam +
                                    dönem.beklenenFayda,
                                0
                            )
                        ),

                    toplamBugünküDeğer:
                        yuvarla(
                            dönemler.reduce(
                                (
                                    toplam,
                                    dönem
                                ) =>
                                    toplam +
                                    dönem.bugünküDeğer,
                                0
                            )
                        )

                };

            }
        );


    return {

        personelBazlı:
            projeksiyonlar,

        yıllık:
            sonuç

    };

}


/* ============================================================
   28. DBO KÖPRÜSÜ
============================================================ */

function TMS19DBOKöprüsü(
    rollForward
) {

    if (
        !rollForward
    ) {

        return null;

    }


    const açılış =
        sayıDeğeri(
            rollForward.açılışDBO
        );


    const hizmet =
        sayıDeğeri(
            rollForward.cariHizmetMaliyeti
        );


    const faiz =
        sayıDeğeri(
            rollForward.faizMaliyeti
        );


    const aktüeryal =
        sayıDeğeri(
            rollForward.aktüeryalKazançKayıp
        );


    const ödemeler =
        sayıDeğeri(
            rollForward.ödenenFaydalar
        );


    const kapanış =
        sayıDeğeri(
            rollForward.kapanışDBO
        );


    return [

        {

            açıklama:
                "Açılış DBO",

            tutar:
                açılış,

            tür:
                "açılış"

        },

        {

            açıklama:
                "Cari hizmet maliyeti",

            tutar:
                hizmet,

            tür:
                "pnl"

        },

        {

            açıklama:
                "Faiz maliyeti",

            tutar:
                faiz,

            tür:
                "pnl"

        },

        {

            açıklama:
                "Aktüeryal kazanç / kayıp",

            tutar:
                aktüeryal,

            tür:
                "oci"

        },

        {

            açıklama:
                "Ödenen faydalar",

            tutar:
                -ödemeler,

            tür:
                "ödeme"

        },

        {

            açıklama:
                "Kapanış DBO",

            tutar:
                kapanış,

            tür:
                "kapanış"

        }

    ];

}


/* ============================================================
   29. RİSK ANALİZİ
============================================================ */

function TMS19AktüeryalRiskAnalizi(
    sonuç
) {

    if (
        !sonuç
    ) {

        return null;

    }


    const riskler = [];


    const duyarlılık =
        sonuç.sensitivity;


    if (
        duyarlılık
    ) {

        const iskontoEtki =
            Math.abs(
                sayıDeğeri(
                    duyarlılık.discount
                        ?.minus
                        ?.changePercent
                )
            );


        const maaşEtki =
            Math.abs(
                sayıDeğeri(
                    duyarlılık.salary
                        ?.plus
                        ?.changePercent
                )
            );


        if (
            iskontoEtki > 10
        ) {

            riskler.push({

                seviye:
                    "yüksek",

                alan:
                    "İskonto oranı",

                açıklama:
                    "DBO iskonto oranındaki küçük değişimlere yüksek duyarlılık göstermektedir."

            });

        }


        if (
            maaşEtki > 10
        ) {

            riskler.push({

                seviye:
                    "yüksek",

                alan:
                    "Maaş artış varsayımı",

                açıklama:
                    "DBO maaş artış varsayımına yüksek duyarlılık göstermektedir."

            });

        }

    }


    if (
        sonuç.personelSayısı > 0
    ) {

        const kişiBaşınaDBO =
            sonuç.closingDBO
            /
            sonuç.personelSayısı;


        if (
            kişiBaşınaDBO > 1000000
        ) {

            riskler.push({

                seviye:
                    "izleme",

                alan:
                    "Kişi başına DBO",

                açıklama:
                    "Kişi başına düşen DBO yüksek seviyededir; aktüeryal varsayımların kalibrasyonu önemlidir."

            });

        }

    }


    return {

        riskSayısı:
            riskler.length,

        riskler

    };

}


/* ============================================================
   30. GELİŞMİŞ API
============================================================ */

window.TMS19.yıllıkProjeksiyon =
    TMS19YıllıkProjeksiyonHesapla;


window.TMS19.tümProjeksiyonlar =
    TMS19TümProjeksiyonlarıHesapla;


window.TMS19.yıllıkPortföy =
    TMS19YıllıkPortföyHesapla;


window.TMS19.DBOKöprüsü =
    TMS19DBOKöprüsü;


window.TMS19.riskAnalizi =
    TMS19AktüeryalRiskAnalizi;


/* ============================================================
   31. TAM AKTÜERYAL ÇALIŞTIRMA
============================================================ */

function TMS19TamAktüeryalÇalıştır(
    personelListesi = [],
    varsayımlar = {},
    seçenekler = {}
) {

    const anaHesaplama =
        TMS19AktüeryalHesapla(
            personelListesi,
            varsayımlar,
            seçenekler
        );


    const yıllık =
        TMS19YıllıkPortföyHesapla(
            personelListesi,
            varsayımlar
        );


    const veriKalitesi =
        TMS19VeriKalitesiKontrol(
            personelListesi
        );


    const yöneticiÖzeti =
        TMS19YöneticiÖzeti(
            anaHesaplama
        );


    const riskAnalizi =
        TMS19AktüeryalRiskAnalizi(
            anaHesaplama
        );


    const dboKöprüsü =
        TMS19DBOKöprüsü(
            anaHesaplama.rollForward
        );


    return {

        ...anaHesaplama,

        yıllıkProjeksiyon:
            yıllık,

        veriKalitesi,

        yöneticiÖzeti,

        riskAnalizi,

        dboKöprüsü

    };

}


window.TMS19.tamHesapla =
    TMS19TamAktüeryalÇalıştır;


window.TMS19TamAktüeryalÇalıştır =
    TMS19TamAktüeryalÇalıştır;


/* ============================================================
   32. MOTOR HAZIR
============================================================ */

console.log(
    "GK Advisory — TMS 19 Tam Aktüeryal Motor hazır."
);

console.log(
    "Aktif modüller:",
    [
        "PUC",
        "DBO",
        "Cari Hizmet Maliyeti",
        "Faiz Maliyeti",
        "Aktüeryal Kazanç/Kayıp",
        "OCI",
        "Roll-forward",
        "Duyarlılık",
        "Yıllık Projeksiyon",
        "Veri Kalitesi",
        "Risk Analizi"
    ]
);
