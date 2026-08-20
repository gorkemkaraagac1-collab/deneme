/* ============================================================
   TMS 19 – AKTÜERYAL HESAPLAMA MOTORU
   Financial Decision Cockpit
   GK Advisory

   Amaç:
   TMS 19 Çalışanlara Sağlanan Faydalar kapsamında
   tanımlanmış fayda planlarının aktüeryal analizini yapmak.

   Kapsam:
   - DBO / PBO
   - Current Service Cost
   - Interest Cost
   - Expected Benefit Payment
   - Actuarial Gain / Loss
   - Net Defined Benefit Liability
   - P&L / OCI etkisi
   - Duyarlılık analizi
   - Senaryo analizi
   - Aktüeryal varsayım kontrolleri
   ============================================================ */

"use strict";

/* ============================================================
   1. GLOBAL AYARLAR
   ============================================================ */

const TMS19_ENGINE = {

    versiyon: "1.0.0",

    paraBirimi: "TRY",

    varsayilanlar: {

        iskontoOrani: 0.30,

        maasArtisOrani: 0.35,

        enflasyonOrani: 0.30,

        personelDevirOrani: 0.05,

        emeklilikYasi: 60,

        mevcutYas: 35,

        mevcutHizmetYili: 10,

        kalanHizmetYili: 15,

        yillikFaydaOrani: 0.03,

        mevcutYillikMaas: 600000,

        beklenenFaydaYili: 15,

        planFaydaLimiti: 0,

        buyumeOrani: 0.00
    },

    esikler: {

        yuksekIskonto: 0.40,

        dusukIskonto: 0.15,

        yuksekMaasArtisi: 0.50,

        yuksekDevir: 0.15,

        yuksekDurum: 0.20
    }
};


/* ============================================================
   2. YARDIMCI MATEMATİK FONKSİYONLARI
   ============================================================ */

function sayiyaCevir(deger, varsayilan = 0) {

    if (deger === null || deger === undefined || deger === "") {
        return varsayilan;
    }

    if (typeof deger === "number") {
        return Number.isFinite(deger) ? deger : varsayilan;
    }

    const temiz = String(deger)
        .replace(/\./g, "")
        .replace(",", ".")
        .replace("%", "")
        .trim();

    const sayi = parseFloat(temiz);

    return Number.isFinite(sayi) ? sayi : varsayilan;
}


function yuvarla(deger, basamak = 2) {

    const carpan = Math.pow(10, basamak);

    return Math.round((deger + Number.EPSILON) * carpan) / carpan;
}


function yuzde(deger) {

    return sayiyaCevir(deger) / 100;

}


function bugunkuDeger(gelecektekiTutar, iskontoOrani, yil) {

    if (!gelecektekiTutar || yil < 0) {
        return 0;
    }

    return gelecektekiTutar /
        Math.pow(1 + iskontoOrani, yil);
}


function bileşikBuyume(baslangic, oran, yil) {

    return baslangic *
        Math.pow(1 + oran, yil);
}


/* ============================================================
   3. PERSONEL VERİSİ
   ============================================================ */

function personelOlustur(veri = {}) {

    return {

        id: veri.id || `PRS-${Date.now()}`,

        adSoyad: veri.adSoyad || "Yeni Personel",

        cinsiyet: veri.cinsiyet || "Belirtilmemiş",

        dogumYili: sayiyaCevir(veri.dogumYili),

        mevcutYas: sayiyaCevir(
            veri.mevcutYas,
            TMS19_ENGINE.varsayilanlar.mevcutYas
        ),

        hizmetYili: sayiyaCevir(
            veri.hizmetYili,
            TMS19_ENGINE.varsayilanlar.mevcutHizmetYili
        ),

        kalanHizmetYili: sayiyaCevir(
            veri.kalanHizmetYili,
            TMS19_ENGINE.varsayilanlar.kalanHizmetYili
        ),

        yillikMaas: sayiyaCevir(
            veri.yillikMaas,
            TMS19_ENGINE.varsayilanlar.mevcutYillikMaas
        ),

        emeklilikYasi: sayiyaCevir(
            veri.emeklilikYasi,
            TMS19_ENGINE.varsayilanlar.emeklilikYasi
        ),

        faydaOrani: sayiyaCevir(
            veri.faydaOrani,
            TMS19_ENGINE.varsayilanlar.yillikFaydaOrani
        ),

        beklenenFaydaYili: sayiyaCevir(
            veri.beklenenFaydaYili,
            TMS19_ENGINE.varsayilanlar.beklenenFaydaYili
        ),

        devirOrani: sayiyaCevir(
            veri.devirOrani,
            TMS19_ENGINE.varsayilanlar.personelDevirOrani
        ),

        iskontoOrani: sayiyaCevir(
            veri.iskontoOrani,
            TMS19_ENGINE.varsayilanlar.iskontoOrani
        ),

        maasArtisOrani: sayiyaCevir(
            veri.maasArtisOrani,
            TMS19_ENGINE.varsayilanlar.maasArtisOrani
        ),

        enflasyonOrani: sayiyaCevir(
            veri.enflasyonOrani,
            TMS19_ENGINE.varsayilanlar.enflasyonOrani
        )
    };
}


/* ============================================================
   4. GELECEK MAAŞ HESAPLAMA
   ============================================================ */

function gelecektekiMaasHesapla(personel, yil) {

    return bileşikBuyume(
        personel.yillikMaas,
        personel.maasArtisOrani,
        yil
    );
}


/* ============================================================
   5. EMEKLİLİK FAYDASI HESAPLAMA
   ============================================================ */

function emeklilikFaydasiHesapla(personel) {

    const gelecekMaas = gelecektekiMaasHesapla(
        personel,
        personel.kalanHizmetYili
    );

    const toplamHizmet =
        personel.hizmetYili +
        personel.kalanHizmetYili;

    const fayda =
        gelecekMaas *
        personel.faydaOrani *
        toplamHizmet;

    return {

        gelecekMaas: fayda > 0 ? gelecekMaas : 0,

        toplamHizmet,

        brutEmeklilikFaydasi: fayda
    };
}


/* ============================================================
   6. ÇALIŞANIN KALMA OLASILIĞI
   ============================================================ */

function kalmaOlasiligiHesapla(personel) {

    const yil = personel.kalanHizmetYili;

    const devirOrani = personel.devirOrani;

    return Math.pow(
        1 - devirOrani,
        yil
    );
}


/* ============================================================
   7. DÜZELTİLMİŞ BEKLENEN FAYDA
   ============================================================ */

function beklenenFaydaHesapla(personel) {

    const fayda =
        emeklilikFaydasiHesapla(personel);

    const kalmaOlasiligi =
        kalmaOlasiligiHesapla(personel);

    const beklenenFayda =
        fayda.brutEmeklilikFaydasi *
        kalmaOlasiligi;

    return {

        brutFayda:
            fayda.brutEmeklilikFaydasi,

        kalmaOlasiligi,

        beklenenFayda
    };
}


/* ============================================================
   8. DBO / PBO HESAPLAMA
   ============================================================ */

function dboHesapla(personel) {

    const beklenen =
        beklenenFaydaHesapla(personel);

    const iskonto =
        personel.iskontoOrani;

    const kalanYil =
        personel.kalanHizmetYili;

    const bugunkuDeger =
        bugunkuDegerHesapla(
            beklenen.beklenenFayda,
            iskonto,
            kalanYil
        );

    return {

        beklenenFayda:
            beklenen.beklenenFayda,

        kalmaOlasiligi:
            beklenen.kalmaOlasiligi,

        iskontoOrani:
            iskonto,

        kalanYil,

        dbo:
            bugunkuDeger
    };
}


/* ============================================================
   9. BUGÜNKÜ DEĞER
   ============================================================ */

function bugunkuDegerHesapla(
    tutar,
    iskontoOrani,
    yil
) {

    return bugunkuDeger(
        tutar,
        iskontoOrani,
        yil
    );
}


/* ============================================================
   10. CURRENT SERVICE COST
   ============================================================ */

function currentServiceCostHesapla(personel) {

    const gelecekMaas =
        gelecektekiMaasHesapla(
            personel,
            1
        );

    const birYillikFayda =
        gelecekMaas *
        personel.faydaOrani;

    const beklenen =
        birYillikFayda *
        (1 - personel.devirOrani);

    const iskontoEdilmis =
        bugunkuDeger(
            beklenen,
            personel.iskontoOrani,
            personel.kalanHizmetYili
        );

    return iskontoEdilmis;
}


/* ============================================================
   11. INTEREST COST
   ============================================================ */

function interestCostHesapla(
    acilisDbo,
    iskontoOrani
) {

    return acilisDbo *
        iskontoOrani;
}


/* ============================================================
   12. BENEFIT PAYMENT
   ============================================================ */

function benefitPaymentHesapla(
    toplamFayda,
    yil
) {

    if (yil <= 0) {
        return toplamFayda;
    }

    return toplamFayda / yil;
}


/* ============================================================
   13. AKTÜERYAL KAZANÇ / KAYIP
   ============================================================ */

function aktüeryalKazancKayipHesapla(
    beklenenDbo,
    gerceklesenDbo
) {

    return gerceklesenDbo -
        beklenenDbo;
}


/* ============================================================
   14. NET TANIMLANMIŞ FAYDA YÜKÜMLÜLÜĞÜ
   ============================================================ */

function netYukumlulukHesapla(
    dbo,
    planVarliklari = 0
) {

    return dbo -
        planVarliklari;
}


/* ============================================================
   15. P&L ETKİSİ
   ============================================================ */

function pnlEtkisiHesapla({

    currentServiceCost = 0,

    pastServiceCost = 0,

    interestCost = 0,

    interestIncome = 0,

    settlementGainLoss = 0

} = {}) {

    return (
        currentServiceCost +
        pastServiceCost +
        interestCost -
        interestIncome +
        settlementGainLoss
    );
}


/* ============================================================
   16. OCI ETKİSİ
   ============================================================ */

function ociEtkisiHesapla({

    aktüeryalKazancKayip = 0,

    varlikLimitiEtkisi = 0,

    digerYenidenOlcum = 0

} = {}) {

    return (
        aktüeryalKazancKayip +
        varlikLimitiEtkisi +
        digerYenidenOlcum
    );
}


/* ============================================================
   17. PERSONEL BAZLI AKTÜERYAL HESAPLAMA
   ============================================================ */

function personelAktüeryalAnaliz(veri) {

    const personel =
        personelOlustur(veri);

    const fayda =
        emeklilikFaydasiHesapla(personel);

    const dbo =
        dboHesapla(personel);

    const currentServiceCost =
        currentServiceCostHesapla(personel);

    return {

        personel,

        analiz: {

            gelecekMaas:
                fayda.gelecekMaas,

            toplamHizmet:
                fayda.toplamHizmet,

            brutEmeklilikFaydasi:
                fayda.brutEmeklilikFaydasi,

            kalmaOlasiligi:
                dbo.kalmaOlasiligi,

            beklenenFayda:
                dbo.beklenenFayda,

            dbo:
                dbo.dbo,

            currentServiceCost
        }
    };
}


/* ============================================================
   18. PORTFÖY BAZLI HESAPLAMA
   ============================================================ */

function portfoyAktüeryalAnaliz(personeller = []) {

    const sonuclar =
        personeller.map(
            personel =>
                personelAktüeryalAnaliz(personel)
        );

    const toplamDbo =
        sonuclar.reduce(
            (toplam, item) =>
                toplam + item.analiz.dbo,
            0
        );

    const toplamCSC =
        sonuclar.reduce(
            (toplam, item) =>
                toplam + item.analiz.currentServiceCost,
            0
        );

    const toplamFayda =
        sonuclar.reduce(
            (toplam, item) =>
                toplam + item.analiz.beklenenFayda,
            0
        );

    return {

        personelSayisi:
            personeller.length,

        sonuclar,

        toplamlar: {

            toplamDbo,

            toplamCurrentServiceCost:
                toplamCSC,

            toplamBeklenenFayda:
                toplamFayda
        }
    };
}


/* ============================================================
   19. DUYARLILIK ANALİZİ
   ============================================================ */

function duyarlilikAnalizi(
    personelVerisi
) {

    const baz =
        personelAktüeryalAnaliz(
            personelVerisi
        );

    const bazDbo =
        baz.analiz.dbo;

    const sonuc = {};

    /* İskonto oranı */

    const iskontoDusuk =
        personelOlustur({
            ...personelVerisi,
            iskontoOrani:
                personelVerisi.iskontoOrani - 0.01
        });

    const iskontoYuksek =
        personelOlustur({
            ...personelVerisi,
            iskontoOrani:
                personelVerisi.iskontoOrani + 0.01
        });

    sonuc.iskonto = {

        dusuk:
            dboHesapla(
                iskontoDusuk
            ).dbo,

        baz:
            bazDbo,

        yuksek:
            dboHesapla(
                iskontoYuksek
            ).dbo
    };


    /* Maaş artış oranı */

    const maasDusuk =
        personelOlustur({
            ...personelVerisi,
            maasArtisOrani:
                personelVerisi.maasArtisOrani - 0.01
        });

    const maasYuksek =
        personelOlustur({
            ...personelVerisi,
            maasArtisOrani:
                personelVerisi.maasArtisOrani + 0.01
        });

    sonuc.maasArtisi = {

        dusuk:
            dboHesapla(
                maasDusuk
            ).dbo,

        baz:
            bazDbo,

        yuksek:
            dboHesapla(
                maasYuksek
            ).dbo
    };


    /* Devir oranı */

    const devirDusuk =
        personelOlustur({
            ...personelVerisi,
            devirOrani:
                Math.max(
                    0,
                    personelVerisi.devirOrani - 0.01
                )
        });

    const devirYuksek =
        personelOlustur({
            ...personelVerisi,
            devirOrani:
                personelVerisi.devirOrani + 0.01
        });

    sonuc.devir = {

        dusuk:
            dboHesapla(
                devirDusuk
            ).dbo,

        baz:
            bazDbo,

        yuksek:
            dboHesapla(
                devirYuksek
            ).dbo
    };


    return sonuc;
}


/* ============================================================
   20. SENARYO ANALİZİ
   ============================================================ */

function senaryoAnalizi(
    personelVerisi
) {

    const senaryolar = {

        baz: {},

        olumlu: {

            iskontoDegisimi: 0.01,

            maasArtisDegisimi: -0.01,

            devirDegisimi: 0.01
        },

        olumsuz: {

            iskontoDegisimi: -0.01,

            maasArtisDegisimi: 0.01,

            devirDegisimi: -0.01
        },

        stres: {

            iskontoDegisimi: -0.02,

            maasArtisDegisimi: 0.02,

            devirDegisimi: -0.02
        }
    };


    const sonuc = {};


    Object.entries(
        senaryolar
    ).forEach(
        ([isim, senaryo]) => {

            const veri = {

                ...personelVerisi,

                iskontoOrani:
                    (personelVerisi.iskontoOrani || 0)
                    + (senaryo.iskontoDegisimi || 0),

                maasArtisOrani:
                    (personelVerisi.maasArtisOrani || 0)
                    + (senaryo.maasArtisDegisimi || 0),

                devirOrani:
                    Math.max(
                        0,
                        (personelVerisi.devirOrani || 0)
                        + (senaryo.devirDegisimi || 0)
                    )
            };


            const analiz =
                personelAktüeryalAnaliz(
                    veri
                );


            sonuc[isim] = analiz;
        }
    );


    return sonuc;
}


/* ============================================================
   21. VARSAYIM KONTROLÜ
   ============================================================ */

function varsayimKontrolu(personel) {

    const uyarilar = [];

    const iskonto =
        personel.iskontoOrani;

    const maasArtisi =
        personel.maasArtisOrani;

    const devir =
        personel.devirOrani;


    if (iskonto >
        TMS19_ENGINE.esikler.yuksekIskonto) {

        uyarilar.push({

            seviye: "Yüksek",

            baslik:
                "İskonto oranı yüksek",

            mesaj:
                "İskonto oranı aktüeryal varsayım açısından detaylı olarak desteklenmelidir."
        });
    }


    if (iskonto <
        TMS19_ENGINE.esikler.dusukIskonto) {

        uyarilar.push({

            seviye: "Yüksek",

            baslik:
                "İskonto oranı düşük",

            mesaj:
                "Düşük iskonto oranı DBO'nun önemli ölçüde artmasına neden olabilir."
        });
    }


    if (maasArtisi >
        TMS19_ENGINE.esikler.yuksekMaasArtisi) {

        uyarilar.push({

            seviye: "Orta",

            baslik:
                "Yüksek maaş artış varsayımı",

            mesaj:
                "Maaş artış varsayımının enflasyon, kıdem ve şirket ücret politikası ile tutarlılığı değerlendirilmelidir."
        });
    }


    if (devir >
        TMS19_ENGINE.esikler.yuksekDevir) {

        uyarilar.push({

            seviye: "Orta",

            baslik:
                "Yüksek personel devir oranı",

            mesaj:
                "Devir oranının geçmiş gerçekleşmeler ve geleceğe yönelik beklentilerle desteklenmesi gerekir."
        });
    }


    if (
        personel.emeklilikYasi <=
        personel.mevcutYas
    ) {

        uyarilar.push({

            seviye: "Kritik",

            baslik:
                "Emeklilik yaşı kontrolü",

            mesaj:
                "Mevcut yaş emeklilik yaşına eşit veya daha yüksek."
        });
    }


    return uyarilar;
}


/* ============================================================
   22. AKTÜERYAL RİSK SKORU
   ============================================================ */

function aktüeryalRiskSkoru(
    personel
) {

    let skor = 0;

    const uyarilar =
        varsayimKontrolu(
            personel
        );


    uyarilar.forEach(
        uyari => {

            if (
                uyari.seviye === "Kritik"
            ) {
                skor += 40;
            }

            else if (
                uyari.seviye === "Yüksek"
            ) {
                skor += 25;
            }

            else if (
                uyari.seviye === "Orta"
            ) {
                skor += 15;
            }

            else {
                skor += 5;
            }
        }
    );


    skor =
        Math.min(
            skor,
            100
        );


    let seviye;


    if (skor >= 70) {

        seviye = "Kritik";

    }

    else if (skor >= 50) {

        seviye = "Yüksek";

    }

    else if (skor >= 25) {

        seviye = "Orta";

    }

    else {

        seviye = "Düşük";
    }


    return {

        skor,

        seviye,

        uyarilar
    };
}


/* ============================================================
   23. CFO PERSPEKTİFİ
   ============================================================ */

function cfoYorumu(
    analiz
) {

    const dbo =
        analiz.analiz.dbo;

    const csc =
        analiz.analiz.currentServiceCost;

    const risk =
        aktüeryalRiskSkoru(
            analiz.personel
        );


    let yorum = "";


    if (risk.seviye === "Kritik") {

        yorum =
            "TMS 19 yükümlülüğü yüksek aktüeryal varsayım riski taşımaktadır. CFO seviyesinde varsayımların bağımsız aktüeryal rapor, geçmiş gerçekleşmeler ve finansal planlama ile mutabakatı önceliklendirilmelidir.";

    }

    else if (risk.seviye === "Yüksek") {

        yorum =
            "Aktüeryal yükümlülük üzerinde önemli varsayım riski bulunmaktadır. Özellikle iskonto oranı, maaş artışı ve personel devir oranı için duyarlılık analizi yönetim raporlamasına dahil edilmelidir.";

    }

    else if (risk.seviye === "Orta") {

        yorum =
            "Varsayımlar genel olarak yönetilebilir seviyededir; ancak DBO'nun finansal tablo etkisi ve nakit ödeme profili düzenli olarak izlenmelidir.";

    }

    else {

        yorum =
            "Aktüeryal varsayımlar mevcut model kapsamında düşük risk seviyesindedir. Yine de yıllık aktüeryal değerleme ve bağımsız makuliyet kontrolleri sürdürülmelidir.";
    }


    return {

        dbo,

        currentServiceCost: csc,

        riskSkoru: risk.skor,

        riskSeviyesi: risk.seviye,

        yorum
    };
}


/* ============================================================
   24. YILLIK PROJEKSİYON
   ============================================================ */

function yillikProjeksiyon(
    personel,
    yilSayisi = 10
) {

    const tablo = [];

    let acilisDbo =
        dboHesapla(personel).dbo;


    for (
        let yil = 1;
        yil <= yilSayisi;
        yil++
    ) {

        const maas =
            gelecektekiMaasHesapla(
                personel,
                yil
            );


        const serviceCost =
            currentServiceCostHesapla(
                personel
            );


        const interestCost =
            interestCostHesapla(
                acilisDbo,
                personel.iskontoOrani
            );


        const kapanisDbo =
            acilisDbo +
            serviceCost +
            interestCost;


        tablo.push({

            yil,

            acilisDbo:
                yuvarla(
                    acilisDbo
                ),

            maas:
                yuvarla(
                    maas
                ),

            currentServiceCost:
                yuvarla(
                    serviceCost
                ),

            interestCost:
                yuvarla(
                    interestCost
                ),

            kapanisDbo:
                yuvarla(
                    kapanisDbo
                )
        });


        acilisDbo =
            kapanisDbo;
    }


    return tablo;
}


/* ============================================================
   25. TAM AKTÜERYAL RAPOR
   ============================================================ */

function tamAktüeryalRapor(
    personelVerisi
) {

    const personel =
        personelOlustur(
            personelVerisi
        );


    const temelAnaliz =
        personelAktüeryalAnaliz(
            personel
        );


    const duyarlilik =
        duyarlilikAnalizi(
            personel
        );


    const senaryolar =
        senaryoAnalizi(
            personel
        );


    const risk =
        aktüeryalRiskSkoru(
            personel
        );


    const cfo =
        cfoYorumu(
            temelAnaliz
        );


    const projeksiyon =
        yillikProjeksiyon(
            personel
        );


    return {

        meta: {

            standart:
                "TMS 19 – Çalışanlara Sağlanan Faydalar",

            motor:
                "GK Advisory Aktüeryal Hesaplama Motoru",

            versiyon:
                TMS19_ENGINE.versiyon,

            tarih:
                new Date().toISOString()
        },


        personel,


        temelAnaliz:
            temelAnaliz.analiz,


        duyarlilik,


        senaryolar,


        risk,


        cfo,


        projeksiyon
    };
}


/* ============================================================
   26. FORMATLAMA
   ============================================================ */

function paraFormatla(
    deger
) {

    return new Intl.NumberFormat(
        "tr-TR",
        {

            minimumFractionDigits: 0,

            maximumFractionDigits: 0
        }
    ).format(
        sayiyaCevir(deger)
    );
}


function yuzdeFormatla(
    deger
) {

    return new Intl.NumberFormat(
        "tr-TR",
        {

            style: "percent",

            minimumFractionDigits: 1,

            maximumFractionDigits: 2
        }
    ).format(
        sayiyaCevir(deger)
    );
}


/* ============================================================
   27. DASHBOARD VERİSİ
   ============================================================ */

function dashboardVerisi(
    personelVerisi
) {

    const rapor =
        tamAktüeryalRapor(
            personelVerisi
        );


    return {

        "Tanımlanmış Fayda Yükümlülüğü":
            paraFormatla(
                rapor.temelAnaliz.dbo
            ),

        "Current Service Cost":
            paraFormatla(
                rapor.temelAnaliz.currentServiceCost
            ),

        "Beklenen Emeklilik Faydası":
            paraFormatla(
                rapor.temelAnaliz.beklenenFayda
            ),

        "Aktüeryal Risk Skoru":
            rapor.risk.skor,

        "Risk Seviyesi":
            rapor.risk.seviye,

        "İskonto Oranı":
            yuzdeFormatla(
                personelVerisi.iskontoOrani
            ),

        "Maaş Artış Oranı":
            yuzdeFormatla(
                personelVerisi.maasArtisOrani
            ),

        "Personel Devir Oranı":
            yuzdeFormatla(
                personelVerisi.devirOrani
            )
    };
}


/* ============================================================
   28. HTML DASHBOARD ENTEGRASYONU
   ============================================================ */

function dashboardGuncelle(
    personelVerisi
) {

    const veri =
        dashboardVerisi(
            personelVerisi
        );


    Object.entries(
        veri
    ).forEach(
        ([anahtar, deger]) => {

            const element =
                document.querySelector(
                    `[data-tms19="${anahtar}"]`
                );


            if (element) {

                element.textContent =
                    deger;
            }
        }
    );
}


/* ============================================================
   29. GLOBAL API
   ============================================================ */

window.TMS19ActuarialEngine = {

    motor:
        TMS19_ENGINE,

    personelOlustur,

    gelecektekiMaasHesapla,

    emeklilikFaydasiHesapla,

    kalmaOlasiligiHesapla,

    beklenenFaydaHesapla,

    dboHesapla,

    currentServiceCostHesapla,

    interestCostHesapla,

    benefitPaymentHesapla,

    aktüeryalKazancKayipHesapla,

    netYukumlulukHesapla,

    pnlEtkisiHesapla,

    ociEtkisiHesapla,

    personelAktüeryalAnaliz,

    portfoyAktüeryalAnaliz,

    duyarlilikAnalizi,

    senaryoAnalizi,

    varsayimKontrolu,

    aktüeryalRiskSkoru,

    cfoYorumu,

    yillikProjeksiyon,

    tamAktüeryalRapor,

    dashboardVerisi,

    dashboardGuncelle,

    paraFormatla,

    yuzdeFormatla
};


/* ============================================================
   30. ÖRNEK TEST
   ============================================================ */

function tms19TestCalistir() {

    const ornekPersonel = {

        id: "PRS-001",

        adSoyad:
            "Örnek Personel",

        mevcutYas:
            35,

        hizmetYili:
            10,

        kalanHizmetYili:
            15,

        yillikMaas:
            600000,

        emeklilikYasi:
            60,

        faydaOrani:
            0.03,

        devirOrani:
            0.05,

        iskontoOrani:
            0.30,

        maasArtisOrani:
            0.35
    };


    const rapor =
        tamAktüeryalRapor(
            ornekPersonel
        );


    console.group(
        "TMS 19 Aktüeryal Motor Test"
    );


    console.log(
        "DBO:",
        rapor.temelAnaliz.dbo
    );


    console.log(
        "Current Service Cost:",
        rapor.temelAnaliz.currentServiceCost
    );


    console.log(
        "Risk:",
        rapor.risk
    );


    console.log(
        "CFO Yorumu:",
        rapor.cfo
    );


    console.log(
        "Duyarlılık:",
        rapor.duyarlilik
    );


    console.groupEnd();


    return rapor;
}


/* ============================================================
   31. MOTOR HAZIR
   ============================================================ */

console.log(
    "TMS 19 Aktüeryal Hesaplama Motoru hazır."
);

console.log(
    "Kullanım: window.TMS19ActuarialEngine"
);
