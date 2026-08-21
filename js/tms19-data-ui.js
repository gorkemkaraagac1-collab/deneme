/* ================================================================
   GK FINANCIAL DECISION COCKPIT
   TMS 19 DATA UI ENGINE
   ----------------------------------------------------------------
   Sürüm    : 2.0.0
   Standart : TMS 19

   SORUMLULUKLAR
   -------------
   ✓ Excel / CSV dosyası seçimi
   ✓ JSON import
   ✓ Data Engine entegrasyonu
   ✓ Aktüeryal Engine entegrasyonu
   ✓ Portfolio Engine entegrasyonu
   ✓ Personel tablosu
   ✓ Veri kalite göstergeleri
   ✓ KPI güncelleme
   ✓ Hata yönetimi
   ✓ Dashboard event yönetimi
   ✓ Filtreleme
   ✓ Export
================================================================ */

(function (global) {

    "use strict";


    /* ============================================================
       01 — UI ENGINE
    ============================================================ */

    const DataUI = {};


    DataUI.version =
        "2.0.0";


    DataUI.engineName =
        "GK TMS 19 Data UI";


    /* ============================================================
       02 — STATE
    ============================================================ */

    const state = {

        personeller: [],

        sonuc: null,

        varsayimlar: {},

        filtre: {

            arama: "",

            departman: "",

            pozisyon: ""
        },

        selectedPersonelId:
            null,

        initialized:
            false
    };


    /* ============================================================
       03 — ENGINE AL
    ============================================================ */

    function dataEngine() {

        if (
            !global.TMS19DataEngine
        ) {

            throw new Error(
                "TMS19DataEngine bulunamadı."
            );
        }


        return global.TMS19DataEngine;
    }


    function portfolioEngine() {

        if (
            !global.TMS19PortfolioEngine
        ) {

            throw new Error(
                "TMS19PortfolioEngine bulunamadı."
            );
        }


        return global.TMS19PortfolioEngine;
    }


    /* ============================================================
       04 — DOM HELPER
    ============================================================ */

    function el(
        id
    ) {

        return document.getElementById(
            id
        );
    }


    function query(
        selector
    ) {

        return document.querySelector(
            selector
        );
    }


    function queryAll(
        selector
    ) {

        return [
            ...document.querySelectorAll(
                selector
            )
        ];
    }


    /* ============================================================
       05 — EVENT HELPER
    ============================================================ */

    function on(
        element,
        event,
        callback
    ) {

        if (
            !element
        ) {

            return;
        }


        element.addEventListener(
            event,
            callback
        );
    }


    /* ============================================================
       06 — FORMAT
    ============================================================ */

    function para(
        value
    ) {

        const number =
            Number(value) || 0;


        return new Intl.NumberFormat(
            "tr-TR",
            {

                minimumFractionDigits:
                    0,

                maximumFractionDigits:
                    0
            }
        ).format(
            number
        );
    }


    function oran(
        value
    ) {

        const number =
            Number(value) || 0;


        return new Intl.NumberFormat(
            "tr-TR",
            {

                style:
                    "percent",

                minimumFractionDigits:
                    1,

                maximumFractionDigits:
                    2
            }
        ).format(
            number
        );
    }


    function tarih(
        value
    ) {

        if (
            !value
        ) {

            return "-";
        }


        const date =
            value instanceof Date
                ? value
                : new Date(
                    value
                );


        if (
            Number.isNaN(
                date.getTime()
            )
        ) {

            return "-";
        }


        return new Intl.DateTimeFormat(
            "tr-TR"
        ).format(
            date
        );
    }


    /* ============================================================
       07 — TOAST
    ============================================================ */

    function toast(
        message,
        type = "info"
    ) {

        let container =
            el(
                "tms19-toast-container"
            );


        if (
            !container
        ) {

            container =
                document.createElement(
                    "div"
                );


            container.id =
                "tms19-toast-container";


            container.style.position =
                "fixed";


            container.style.right =
                "24px";


            container.style.bottom =
                "24px";


            container.style.zIndex =
                "99999";


            container.style.display =
                "flex";


            container.style.flexDirection =
                "column";


            container.style.gap =
                "10px";


            document.body.appendChild(
                container
            );
        }


        const item =
            document.createElement(
                "div"
            );


        item.textContent =
            message;


        item.className =
            "tms19-toast " +
            "tms19-toast-" +
            type;


        item.style.padding =
            "12px 16px";


        item.style.borderRadius =
            "10px";


        item.style.background =
            "#111827";


        item.style.color =
            "#ffffff";


        item.style.fontSize =
            "13px";


        item.style.boxShadow =
            "0 10px 30px rgba(0,0,0,.15)";


        container.appendChild(
            item
        );


        setTimeout(
            () => {

                item.remove();

            },
            3500
        );
    }


    /* ============================================================
       08 — DURUM GÖSTER
    ============================================================ */

    function durumGoster(
        message,
        type = "info"
    ) {

        const candidates = [

            "tms19-data-status",

            "data-status",

            "import-status",

            "status-message"
        ];


        let target =
            null;


        for (
            const id of candidates
        ) {

            target =
                el(id);


            if (
                target
            ) {

                break;
            }
        }


        if (
            !target
        ) {

            toast(
                message,
                type
            );

            return;
        }


        target.textContent =
            message;


        target.dataset.status =
            type;
    }


    /* ============================================================
       09 — VARSAYIMLAR AL
       ============================================================ */

    function varsayimlariAl() {

        /*
         * Öncelik:
         *
         * 1. TMS19 global
         * 2. window.tms19Varsayimlar
         * 3. boş object
         */

        if (
            global.TMS19 &&
            global.TMS19.varsayimlar
        ) {

            return {
                ...global.TMS19.varsayimlar
            };
        }


        if (
            global.tms19Varsayimlar
        ) {

            return {
                ...global.tms19Varsayimlar
            };
        }


        return {};
    }


    /* ============================================================
       10 — GLOBAL PERSONEL STATE
    ============================================================ */

    function globalPersonelStateGuncelle() {

        global.TMS19CurrentEmployees =
            state.personeller;


        global.TMS19.currentEmployees =
            state.personeller;


        global.TMS19Personeller =
            state.personeller;
    }


    /* ============================================================
       11 — DATA IMPORT SONUCU
    ============================================================ */

    function importSonucunuIsle(
        result
    ) {

        if (
            !result
        ) {

            throw new Error(
                "Import sonucu alınamadı."
            );
        }


        if (
            !result.success
        ) {

            const message =
                result.hatalar?.join(
                    " "
                ) ||
                "Veri içe aktarılamadı.";


            throw new Error(
                message
            );
        }


        state.personeller =
            result.personeller ||
            [];


        globalPersonelStateGuncelle();


        state.sonuc =
            null;


        veriKalitesiRender(
            result.veriKalitesi
        );


        hatalarRender(
            result.hatalar
        );


        duplicateRender(
            result.duplicate
        );


        filtreleriDoldur();


        tabloRender();


        durumGoster(
            state.personeller.length +
            " personel başarıyla yüklendi.",
            "success"
        );


        toast(
            state.personeller.length +
            " personel yüklendi.",
            "success"
        );


        return result;
    }


    /* ============================================================
       12 — CSV DOSYASI OKU
    ============================================================ */

    async function csvDosyasiOku(
        file
    ) {

        if (
            !file
        ) {

            return;
        }


        const text =
            await file.text();


        const result =
            dataEngine().csvImport(
                text
            );


        return importSonucunuIsle(
            result
        );
    }


    /* ============================================================
       13 — JSON DOSYASI OKU
    ============================================================ */

    async function jsonDosyasiOku(
        file
    ) {

        if (
            !file
        ) {

            return;
        }


        const text =
            await file.text();


        const result =
            dataEngine().jsonImport(
                text
            );


        return importSonucunuIsle(
            result
        );
    }


    /* ============================================================
       14 — DOSYA INPUT
    ============================================================ */

    function dosyaInputBagla() {

        const inputs =
            queryAll(
                'input[type="file"]'
            );


        inputs.forEach(
            input => {

                on(
                    input,
                    "change",
                    async event => {

                        const file =
                            event.target
                                .files?.[0];


                        if (
                            !file
                        ) {

                            return;
                        }


                        try {

                            const name =
                                file.name
                                    .toLowerCase();


                            durumGoster(
                                "Dosya okunuyor...",
                                "loading"
                            );


                            if (
                                name.endsWith(
                                    ".csv"
                                )
                            ) {

                                await csvDosyasiOku(
                                    file
                                );
                            }

                            else if (
                                name.endsWith(
                                    ".json"
                                )
                            ) {

                                await jsonDosyasiOku(
                                    file
                                );
                            }

                            else if (
                                name.endsWith(
                                    ".xlsx"
                                ) ||
                                name.endsWith(
                                    ".xls"
                                )
                            ) {

                                toast(
                                    "Excel desteği için XLSX kütüphanesini bağlamamız gerekiyor.",
                                    "info"
                                );


                                durumGoster(
                                    "Excel dosyası seçildi. XLSX parser bekleniyor.",
                                    "warning"
                                );

                            }

                            else {

                                throw new Error(
                                    "Desteklenmeyen dosya formatı."
                                );
                            }

                        }

                        catch (
                            error
                        ) {

                            console.error(
                                error
                            );


                            durumGoster(
                                error.message,
                                "error"
                            );


                            toast(
                                error.message,
                                "error"
                            );
                        }
                    }
                );
            }
        );
    }


    /* ============================================================
       15 — DEMO VERİ
    ============================================================ */

    function demoVeriYukle(
        adet = 20
    ) {

        const personeller =
            dataEngine()
                .demoVeriOlustur(
                    adet
                );


        state.personeller =
            personeller;


        globalPersonelStateGuncelle();


        state.sonuc =
            null;


        filtreleriDoldur();


        tabloRender();


        durumGoster(
            adet +
            " adet demo personel yüklendi.",
            "success"
        );


        toast(
            "Demo veri yüklendi.",
            "success"
        );


        return personeller;
    }


    /* ============================================================
       16 — PORTFÖY HESAPLA
    ============================================================ */

    function hesapla() {

        if (
            state.personeller.length === 0
        ) {

            toast(
                "Önce personel verisi yüklemelisiniz.",
                "warning"
            );


            return null;
        }


        state.varsayimlar =
            varsayimlariAl();


        try {

            durumGoster(
                "Aktüeryal hesaplama yapılıyor...",
                "loading"
            );


            const result =
                portfolioEngine()
                    .tamAnaliz(
                        state.personeller,
                        state.varsayimlar
                    );


            state.sonuc =
                result;


            global.TMS19CurrentResult =
                result;


            global.TMS19PortfolioResult =
                result;


            kpiRender(
                result
            );


            tabloRender();


            departmanRender(
                result.departman
            );


            yasGrubuRender(
                result.yasGruplari
            );


            riskRender(
                result.risk
            );


            yogunlasmaRender(
                result.yogunlasma
            );


            yonetimRender(
                result.yonetim
            );


            durumGoster(
                "Aktüeryal hesaplama tamamlandı.",
                "success"
            );


            toast(
                "TMS 19 hesaplaması tamamlandı.",
                "success"
            );


            document.dispatchEvent(
                new CustomEvent(
                    "tms19:calculated",
                    {
                        detail:
                            result
                    }
                )
            );


            return result;

        }

        catch (
            error
        ) {

            console.error(
                error
            );


            durumGoster(
                error.message,
                "error"
            );


            toast(
                "Hesaplama hatası: " +
                error.message,
                "error"
            );


            return null;
        }
    }


    /* ============================================================
       17 — KPI RENDER
    ============================================================ */

    function kpiRender(
        result
    ) {

        if (
            !result
        ) {

            return;
        }


        const ozet =
            result.ozet;


        const mapping = {

            "tms19-total-dbo":
                ozet.toplamDBO,

            "total-dbo":
                ozet.toplamDBO,

            "tms19-csc":
                ozet.toplamCariHizmetMaliyeti,

            "total-csc":
                ozet.toplamCariHizmetMaliyeti,

            "tms19-interest":
                ozet.toplamFaizMaliyeti,

            "total-interest":
                ozet.toplamFaizMaliyeti,

            "tms19-employees":
                ozet.personelSayisi,

            "total-employees":
                ozet.personelSayisi,

            "tms19-average-age":
                ozet.ortalamaYas,

            "average-age":
                ozet.ortalamaYas,

            "tms19-average-service":
                ozet.ortalamaHizmet,

            "average-service":
                ozet.ortalamaHizmet,

            "tms19-dbo-salary-ratio":
                ozet.dboMaasOrani,

            "dbo-salary-ratio":
                ozet.dboMaasOrani
        };


        Object.entries(
            mapping
        ).forEach(
            (
                [
                    id,
                    value
                ]
            ) => {

                const target =
                    el(id);


                if (
                    !target
                ) {

                    return;
                }


                if (
                    id.includes(
                        "ratio"
                    )
                ) {

                    target.textContent =
                        oran(
                            value
                        );

                }

                else if (
                    id.includes(
                        "age"
                    ) ||
                    id.includes(
                        "service"
                    )
                ) {

                    target.textContent =
                        Number(
                            value
                        ).toFixed(
                            1
                        );

                }

                else {

                    target.textContent =
                        para(
                            value
                        );
                }
            }
        );
    }


    /* ============================================================
       18 — TABLO FİLTRE
    ============================================================ */

    function filtreUygula(
        personeller
    ) {

        const arama =
            state.filtre.arama
                .toLowerCase()
                .trim();


        const departman =
            state.filtre.departman;


        const pozisyon =
            state.filtre.pozisyon;


        return personeller.filter(
            personel => {

                const matchesSearch =
                    !arama ||
                    String(
                        personel.personelId
                    )
                        .toLowerCase()
                        .includes(
                            arama
                        ) ||
                    String(
                        personel.adSoyad
                    )
                        .toLowerCase()
                        .includes(
                            arama
                        );


                const matchesDepartment =
                    !departman ||
                    personel.departman ===
                    departman;


                const matchesPosition =
                    !pozisyon ||
                    personel.pozisyon ===
                    pozisyon;


                return (
                    matchesSearch &&
                    matchesDepartment &&
                    matchesPosition
                );
            }
        );
    }


    /* ============================================================
       19 — TABLO RENDER
    ============================================================ */

    function tabloRender() {

        const tbody =
            query(
                "#tms19-personel-table tbody"
            ) ||
            query(
                "#tms19-personel-body"
            ) ||
            query(
                "#personel-table-body"
            );


        if (
            !tbody
        ) {

            return;
        }


        const filtered =
            filtreUygula(
                state.personeller
            );


        tbody.innerHTML =
            "";


        filtered.forEach(
            personel => {

                const sonuc =
                    state.sonuc
                        ?.personeller
                        ?.find(
                            item =>
                                item.personel
                                    ?.personelId ===
                                personel.personelId
                        );


                const tr =
                    document.createElement(
                        "tr"
                    );


                tr.dataset.personelId =
                    personel.personelId;


                tr.innerHTML = `

                    <td>
                        ${escapeHtml(
                            personel.personelId
                        )}
                    </td>

                    <td>
                        ${escapeHtml(
                            personel.adSoyad
                        )}
                    </td>

                    <td>
                        ${escapeHtml(
                            personel.departman ||
                            "-"
                        )}
                    </td>

                    <td>
                        ${escapeHtml(
                            personel.pozisyon ||
                            "-"
                        )}
                    </td>

                    <td>
                        ${tarih(
                            personel.dogumTarihi
                        )}
                    </td>

                    <td>
                        ${tarih(
                            personel.iseGirisTarihi
                        )}
                    </td>

                    <td>
                        ${para(
                            personel.mevcutMaas
                        )}
                    </td>

                    <td>
                        ${
                            sonuc
                                ? para(
                                    sonuc.muhasebe
                                        ?.dbo
                                )
                                : "-"
                        }
                    </td>

                    <td>
                        ${
                            sonuc
                                ? para(
                                    sonuc.muhasebe
                                        ?.cariHizmetMaliyeti
                                )
                                : "-"
                        }
                    </td>

                `;


                on(
                    tr,
                    "click",
                    () => {

                        personelSec(
                            personel.personelId
                        );
                    }
                );


                tbody.appendChild(
                    tr
                );
            }
        );


        tabloSayacGuncelle(
            filtered.length
        );
    }


    /* ============================================================
       20 — TABLO SAYACI
    ============================================================ */

    function tabloSayacGuncelle(
        count
    ) {

        const ids = [

            "tms19-table-count",

            "personel-count",

            "filtered-personel-count"
        ];


        ids.forEach(
            id => {

                const target =
                    el(id);


                if (
                    target
                ) {

                    target.textContent =
                        count;
                }
            }
        );
    }


    /* ============================================================
       21 — PERSONEL SEÇ
    ============================================================ */

    function personelSec(
        personelId
    ) {

        state.selectedPersonelId =
            personelId;


        const personel =
            state.personeller.find(
                item =>
                    item.personelId ===
                    personelId
            );


        if (
            !personel
        ) {

            return null;
        }


        const sonuc =
            state.sonuc
                ?.personeller
                ?.find(
                    item =>
                        item.personel
                            ?.personelId ===
                        personelId
                );


        global.TMS19SelectedEmployee =
            personel;


        global.TMS19SelectedResult =
            sonuc ||
            null;


        document.dispatchEvent(
            new CustomEvent(
                "tms19:employee-selected",
                {

                    detail: {

                        personel:
                            personel,

                        sonuc:
                            sonuc
                    }
                }
            )
        );


        return {

            personel:
                personel,

            sonuc:
                sonuc
        };
    }


    /* ============================================================
       22 — FİLTRELER
    ============================================================ */

    function filtreleriDoldur() {

        const departments =
            [
                ...new Set(
                    state.personeller
                        .map(
                            item =>
                                item.departman
                        )
                        .filter(
                            Boolean
                        )
                )
            ]
            .sort();


        const positions =
            [
                ...new Set(
                    state.personeller
                        .map(
                            item =>
                                item.pozisyon
                        )
                        .filter(
                            Boolean
                        )
                )
            ]
            .sort();


        selectDoldur(
            [
                "#tms19-department-filter",
                "#department-filter",
                "#departman-filter"
            ],
            departments,
            "Tüm Departmanlar"
        );


        selectDoldur(
            [
                "#tms19-position-filter",
                "#position-filter",
                "#pozisyon-filter"
            ],
            positions,
            "Tüm Pozisyonlar"
        );
    }


    function selectDoldur(
        selectors,
        values,
        placeholder
    ) {

        let select =
            null;


        for (
            const selector of selectors
        ) {

            select =
                query(
                    selector
                );


            if (
                select
            ) {

                break;
            }
        }


        if (
            !select
        ) {

            return;
        }


        const oldValue =
            select.value;


        select.innerHTML =
            "";


        const option =
            document.createElement(
                "option"
            );


        option.value =
            "";


        option.textContent =
            placeholder;


        select.appendChild(
            option
        );


        values.forEach(
            value => {

                const item =
                    document.createElement(
                        "option"
                    );


                item.value =
                    value;


                item.textContent =
                    value;


                select.appendChild(
                    item
                );
            }
        );


        if (
            values.includes(
                oldValue
            )
        ) {

            select.value =
                oldValue;
        }
    }


    /* ============================================================
       23 — FİLTRE EVENTLERİ
    ============================================================ */

    function filtreEventleriBagla() {

        const search =
            query(
                "#tms19-search"
            ) ||
            query(
                "#personel-search"
            ) ||
            query(
                "#employee-search"
            );


        on(
            search,
            "input",
            event => {

                state.filtre.arama =
                    event.target.value;


                tabloRender();
            }
        );


        const department =
            query(
                "#tms19-department-filter"
            ) ||
            query(
                "#department-filter"
            ) ||
            query(
                "#departman-filter"
            );


        on(
            department,
            "change",
            event => {

                state.filtre.departman =
                    event.target.value;


                tabloRender();
            }
        );


        const position =
            query(
                "#tms19-position-filter"
            ) ||
            query(
                "#position-filter"
            ) ||
            query(
                "#pozisyon-filter"
            );


        on(
            position,
            "change",
            event => {

                state.filtre.pozisyon =
                    event.target.value;


                tabloRender();
            }
        );
    }


    /* ============================================================
       24 — VERİ KALİTESİ RENDER
    ============================================================ */

    function veriKalitesiRender(
        quality
    ) {

        if (
            !quality
        ) {

            return;
        }


        const mapping = {

            "tms19-data-quality":
                quality.kaliteYuzdesi,

            "data-quality":
                quality.kaliteYuzdesi,

            "valid-record-count":
                quality.validKayit,

            "invalid-record-count":
                quality.gecersizKayit,

            "missing-birth-date":
                quality.eksikDogumTarihi,

            "missing-hire-date":
                quality.eksikIseGirisTarihi,

            "invalid-salary":
                quality.gecersizMaas
        };


        Object.entries(
            mapping
        ).forEach(
            (
                [
                    id,
                    value
                ]
            ) => {

                const target =
                    el(id);


                if (
                    !target
                ) {

                    return;
                }


                target.textContent =
                    id ===
                    "tms19-data-quality" ||
                    id ===
                    "data-quality"
                        ? Number(
                            value
                        ).toFixed(
                            1
                        ) + "%"
                        : para(
                            value
                        );
            }
        );
    }


    /* ============================================================
       25 — HATALAR RENDER
    ============================================================ */

    function hatalarRender(
        errors
    ) {

        const target =
            el(
                "tms19-data-errors"
            ) ||
            el(
                "data-errors"
            );


        if (
            !target
        ) {

            return;
        }


        target.innerHTML =
            "";


        if (
            !errors ||
            errors.length === 0
        ) {

            target.textContent =
                "Veri hatası bulunamadı.";

            return;
        }


        const ul =
            document.createElement(
                "ul"
            );


        errors.forEach(
            error => {

                const li =
                    document.createElement(
                        "li"
                    );


                li.textContent =
                    "Satır " +
                    error.satir +
                    ": " +
                    error.errors.join(
                        " "
                    );


                ul.appendChild(
                    li
                );
            }
        );


        target.appendChild(
            ul
        );
    }


    /* ============================================================
       26 — DUPLICATE RENDER
    ============================================================ */

    function duplicateRender(
        result
    ) {

        const target =
            el(
                "tms19-duplicate-count"
            );


        if (
            !target
        ) {

            return;
        }


        target.textContent =
            result?.duplicates?.length ||
            0;
    }


    /* ============================================================
       27 — DEPARTMAN RENDER
    ============================================================ */

    function departmanRender(
        departments
    ) {

        const tbody =
            query(
                "#tms19-department-table tbody"
            ) ||
            el(
                "tms19-department-body"
            );


        if (
            !tbody
        ) {

            return;
        }


        tbody.innerHTML =
            "";


        (
            departments ||
            []
        ).forEach(
            department => {

                const tr =
                    document.createElement(
                        "tr"
                    );


                tr.innerHTML = `

                    <td>
                        ${escapeHtml(
                            department.departman
                        )}
                    </td>

                    <td>
                        ${para(
                            department.personelSayisi
                        )}
                    </td>

                    <td>
                        ${para(
                            department.dbo
                        )}
                    </td>

                    <td>
                        ${para(
                            department.cariHizmetMaliyeti
                        )}
                    </td>

                    <td>
                        ${para(
                            department.faizMaliyeti
                        )}
                    </td>

                    <td>
                        ${para(
                            department.toplamMaas
                        )}
                    </td>

                `;


                tbody.appendChild(
                    tr
                );
            }
        );
    }


    /* ============================================================
       28 — YAŞ GRUBU RENDER
    ============================================================ */

    function yasGrubuRender(
        groups
    ) {

        const tbody =
            query(
                "#tms19-age-table tbody"
            ) ||
            el(
                "tms19-age-body"
            );


        if (
            !tbody
        ) {

            return;
        }


        tbody.innerHTML =
            "";


        (
            groups ||
            []
        ).forEach(
            group => {

                const tr =
                    document.createElement(
                        "tr"
                    );


                tr.innerHTML = `

                    <td>
                        ${escapeHtml(
                            group.yasGrubu
                        )}
                    </td>

                    <td>
                        ${para(
                            group.personelSayisi
                        )}
                    </td>

                    <td>
                        ${para(
                            group.dbo
                        )}
                    </td>

                    <td>
                        ${para(
                            group.cariHizmetMaliyeti
                        )}
                    </td>

                    <td>
                        ${para(
                            group.toplamMaas
                        )}
                    </td>

                `;


                tbody.appendChild(
                    tr
                );
            }
        );
    }


    /* ============================================================
       29 — RİSK RENDER
    ============================================================ */

    function riskRender(
        risks
    ) {

        const tbody =
            query(
                "#tms19-risk-table tbody"
            ) ||
            el(
                "tms19-risk-body"
            );


        if (
            !tbody
        ) {

            return;
        }


        tbody.innerHTML =
            "";


        (
            risks ||
            []
        )
            .slice(
                0,
                50
            )
            .forEach(
                risk => {

                    const tr =
                        document.createElement(
                            "tr"
                        );


                    tr.innerHTML = `

                        <td>
                            ${escapeHtml(
                                risk.adSoyad ||
                                "-"
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                risk.departman ||
                                "-"
                            )}
                        </td>

                        <td>
                            ${Number(
                                risk.yas
                            ).toFixed(
                                1
                            )}
                        </td>

                        <td>
                            ${Number(
                                risk.kalanYil
                            ).toFixed(
                                1
                            )}
                        </td>

                        <td>
                            ${para(
                                risk.dbo
                            )}
                        </td>

                        <td>
                            ${risk.skor}
                        </td>

                        <td>
                            ${escapeHtml(
                                risk.seviye
                            )}
                        </td>

                    `;


                    tbody.appendChild(
                        tr
                    );
                }
            );
    }


    /* ============================================================
       30 — YOĞUNLAŞMA RENDER
    ============================================================ */

    function yogunlasmaRender(
        result
    ) {

        if (
            !result
        ) {

            return;
        }


        const mapping = {

            "tms19-top5-dbo":
                result.top5DBOPayi,

            "tms19-top10-dbo":
                result.top10DBOPayi
        };


        Object.entries(
            mapping
        ).forEach(
            (
                [
                    id,
                    value
                ]
            ) => {

                const target =
                    el(id);


                if (
                    target
                ) {

                    target.textContent =
                        oran(
                            value
                        );
                }
            }
        );
    }


    /* ============================================================
       31 — YÖNETİM ÖZETİ RENDER
    ============================================================ */

    function yonetimRender(
        result
    ) {

        if (
            !result
        ) {

            return;
        }


        const mapping = {

            "tms19-critical-risk":
                result.kritikRiskSayisi,

            "tms19-high-risk":
                result.yuksekRiskSayisi,

            "tms19-total-pnl":
                result.toplamPnlMaliyeti,

            "tms19-ceiling-count":
                result.tavanUygulananPersonel
        };


        Object.entries(
            mapping
        ).forEach(
            (
                [
                    id,
                    value
                ]
            ) => {

                const target =
                    el(id);


                if (
                    !target
                ) {

                    return;
                }


                target.textContent =
                    id ===
                    "tms19-total-pnl"
                        ? para(
                            value
                        )
                        : para(
                            value
                        );
            }
        );
    }


    /* ============================================================
       32 — EXPORT JSON
    ============================================================ */

    function exportJSON() {

        if (
            state.personeller.length === 0
        ) {

            toast(
                "Export edilecek veri yok.",
                "warning"
            );


            return;
        }


        const json =
            dataEngine().jsonExport(
                state.personeller
            );


        download(
            json,
            "TMS19_personel_verisi.json",
            "application/json"
        );
    }


    /* ============================================================
       33 — EXPORT CSV
    ============================================================ */

    function exportCSV() {

        if (
            state.personeller.length === 0
        ) {

            toast(
                "Export edilecek veri yok.",
                "warning"
            );


            return;
        }


        const csv =
            dataEngine().csvExport(
                state.personeller
            );


        download(
            csv,
            "TMS19_personel_verisi.csv",
            "text/csv;charset=utf-8"
        );
    }


    /* ============================================================
       34 — DOWNLOAD
    ============================================================ */

    function download(
        content,
        filename,
        type
    ) {

        const blob =
            new Blob(
                [
                    content
                ],
                {
                    type:
                        type
                }
            );


        const url =
            URL.createObjectURL(
                blob
            );


        const a =
            document.createElement(
                "a"
            );


        a.href =
            url;


        a.download =
            filename;


        document.body.appendChild(
            a
        );


        a.click();


        a.remove();


        URL.revokeObjectURL(
            url
        );


        toast(
            filename +
            " oluşturuldu.",
            "success"
        );
    }


    /* ============================================================
       35 — BUTTON EVENTLERİ
    ============================================================ */

    function butonlariBagla() {

        const calculateButtons = [

            "#tms19-calculate",

            "#calculate-tms19",

            "#btn-tms19-calculate",

            "[data-action='calculate-tms19']"
        ];


        calculateButtons.forEach(
            selector => {

                queryAll(
                    selector
                ).forEach(
                    button => {

                        on(
                            button,
                            "click",
                            hesapla
                        );
                    }
                );
            }
        );


        const demoButtons = [

            "#tms19-demo",

            "#load-demo-data",

            "[data-action='load-demo']"
        ];


        demoButtons.forEach(
            selector => {

                queryAll(
                    selector
                ).forEach(
                    button => {

                        on(
                            button,
                            "click",
                            () =>
                                demoVeriYukle(
                                    25
                                )
                        );
                    }
                );
            }
        );


        const jsonButtons = [

            "#tms19-export-json",

            "#export-json"
        ];


        jsonButtons.forEach(
            selector => {

                queryAll(
                    selector
                ).forEach(
                    button => {

                        on(
                            button,
                            "click",
                            exportJSON
                        );
                    }
                );
            }
        );


        const csvButtons = [

            "#tms19-export-csv",

            "#export-csv"
        ];


        csvButtons.forEach(
            selector => {

                queryAll(
                    selector
                ).forEach(
                    button => {

                        on(
                            button,
                            "click",
                            exportCSV
                        );
                    }
                );
            }
        );
    }


    /* ============================================================
       36 — ESCAPE HTML
    ============================================================ */

    function escapeHtml(
        value
    ) {

        return String(
            value ??
            ""
        )
            .replace(
                /&/g,
                "&amp;"
            )
            .replace(
                /</g,
                "&lt;"
            )
            .replace(
                />/g,
                "&gt;"
            )
            .replace(
                /"/g,
                "&quot;"
            )
            .replace(
                /'/g,
                "&#039;"
            );
    }


    /* ============================================================
       37 — INIT
    ============================================================ */

    function init(
        options = {}
    ) {

        if (
            state.initialized
        ) {

            return;
        }


        state.varsayimlar =
            options.varsayimlar ||
            varsayimlariAl();


        dosyaInputBagla();


        filtreEventleriBagla();


        butonlariBagla();


        globalPersonelStateGuncelle();


        state.initialized =
            true;


        document.dispatchEvent(
            new CustomEvent(
                "tms19:data-ui-ready",
                {

                    detail:
                        {
                            version:
                                DataUI.version
                        }
                }
            )
        );
    }


    /* ============================================================
       38 — STATE GET
    ============================================================ */

    function getState() {

        return {

            ...state,

            personeller:
                [
                    ...state.personeller
                ]
        };
    }


    /* ============================================================
       39 — PUBLIC API
    ============================================================ */

    DataUI.init =
        init;


    DataUI.hesapla =
        hesapla;


    DataUI.demoVeriYukle =
        demoVeriYukle;


    DataUI.csvDosyasiOku =
        csvDosyasiOku;


    DataUI.jsonDosyasiOku =
        jsonDosyasiOku;


    DataUI.exportJSON =
        exportJSON;


    DataUI.exportCSV =
        exportCSV;


    DataUI.personelSec =
        personelSec;


    DataUI.tabloRender =
        tabloRender;


    DataUI.kpiRender =
        kpiRender;


    DataUI.getState =
        getState;


    DataUI.healthCheck =
        function () {

            return {

                status:
                    "OK",

                engine:
                    DataUI.engineName,

                version:
                    DataUI.version,

                dataEngine:
                    !!global.TMS19DataEngine,

                portfolioEngine:
                    !!global.TMS19PortfolioEngine,

                timestamp:
                    new Date().toISOString()
            };
        };


    /* ============================================================
       40 — GLOBAL EXPORT
    ============================================================ */

    global.TMS19DataUI =
        DataUI;


    if (
        !global.TMS19
    ) {

        global.TMS19 = {};
    }


    global.TMS19.DataUI =
        DataUI;


    /* ============================================================
       41 — DOM READY
    ============================================================ */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            () => {

                init();

            }
        );

    }

    else {

        init();
    }


})(typeof window !== "undefined"
    ? window
    : globalThis);
