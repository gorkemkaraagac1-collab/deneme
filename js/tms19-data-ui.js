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

/* ================================================================
   GK TMS 19 — DATA UI / DASHBOARD INTEGRATION
   ----------------------------------------------------------------
   Data Engine
        ↓
   Actuarial Engine
        ↓
   Portfolio Engine
        ↓
   UI
================================================================ */

(function (global) {

    "use strict";


    const TMS19 =
        global.TMS19;


    const DataEngine =
        global.TMS19DataEngine;


    const PortfolioEngine =
        global.TMS19PortfolioEngine;


    if (!TMS19) {

        console.error(
            "TMS19 core engine bulunamadı."
        );

        return;
    }


    /* ============================================================
       FORMATTERS
    ============================================================ */

    function number(
        value
    ) {

        const n =
            Number(value);


        return Number.isFinite(n)
            ? n
            : 0;
    }


    function formatNumber(
        value,
        decimals = 0
    ) {

        return number(
            value
        ).toLocaleString(
            "tr-TR",
            {
                minimumFractionDigits:
                    decimals,

                maximumFractionDigits:
                    decimals
            }
        );
    }


    function formatMoney(
        value,
        currency = "₺"
    ) {

        return (
            currency +
            " " +
            formatNumber(
                value,
                2
            )
        );
    }


    function formatPercent(
        value,
        decimals = 1
    ) {

        return (
            (
                number(value) *
                100
            ).toLocaleString(
                "tr-TR",
                {
                    minimumFractionDigits:
                        decimals,

                    maximumFractionDigits:
                        decimals
                }
            ) +
            "%"
        );
    }


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
       KPI OBJECT
    ============================================================ */

    function buildKPIs(
        portfolio
    ) {

        const totals =
            portfolio?.totals ||
            {};


        const risk =
            portfolio?.risk ||
            {};


        const dataQuality =
            portfolio
                ?.dataQuality ||
            null;


        return {

            personelSayisi:
                number(
                    totals.personelSayisi
                ),


            dbo:
                number(
                    totals.dbo
                ),


            planAssets:
                number(
                    totals.planAssets
                ),


            netLiability:
                number(
                    totals.netDefinedBenefitLiability
                ),


            netAsset:
                number(
                    totals.netDefinedBenefitAsset
                ),


            currentServiceCost:
                number(
                    totals.currentServiceCost
                ),


            interestCost:
                number(
                    totals.interestCost
                ),


            pastServiceCost:
                number(
                    totals.pastServiceCost
                ),


            actuarialGainLoss:
                number(
                    totals.actuarialGainLoss
                ),


            totalPL:
                number(
                    totals.totalPLImpact
                ),


            totalOCI:
                number(
                    totals.totalOCIImpact
                ),


            riskScore:
                number(
                    risk.score
                ),


            riskLevel:
                risk.level ||
                "LOW",


            dboConcentration:
                number(
                    risk.dboConcentration
                ),


            retirementWithin5Years:
                number(
                    risk.retirementWithin5Years
                ),


            dataQuality:
                dataQuality
        };
    }


    /* ============================================================
       DASHBOARD STATE
    ============================================================ */

    const state = {

        portfolio:
            null,

        kpis:
            null,

        employees:
            [],

        assumptions:
            {},

        lastUpdated:
            null,

        loading:
            false,

        error:
            null
    };


    /* ============================================================
       RUN FULL ANALYSIS
    ============================================================ */

    function runAnalysis(
        rawData,
        assumptions = {}
    ) {

        state.loading =
            true;

        state.error =
            null;


        try {

            /*
             * 1 — DATA ENGINE
             */

            const prepared =
                DataEngine
                    .prepareData(
                        rawData
                    );


            if (
                !prepared.success
            ) {

                state.error = {

                    stage:
                        "DATA_VALIDATION",

                    message:
                        "Veri doğrulama başarısız.",

                    details:
                        prepared.errors
                };


                state.loading =
                    false;


                return {

                    success:
                        false,

                    error:
                        state.error
                };
            }


            /*
             * 2 — PORTFOLIO / ACTUARIAL
             */

            const portfolio =
                PortfolioEngine
                    .calculatePUC(
                        prepared.data,
                        assumptions
                    );


            if (
                !portfolio
            ) {

                throw new Error(
                    "Portfolio Engine sonuç döndürmedi."
                );
            }


            /*
             * 3 — DATA QUALITY
             */

            portfolio.dataQuality =
                prepared.quality;


            /*
             * 4 — STATE
             */

            state.portfolio =
                portfolio;


            state.kpis =
                buildKPIs(
                    portfolio
                );


            state.employees =
                prepared.data;


            state.assumptions =
                assumptions;


            state.lastUpdated =
                new Date();


            state.loading =
                false;


            /*
             * 5 — AUTOMATIC RENDER
             */

            renderDashboard();


            return {

                success:
                    true,

                data:
                    portfolio
            };

        }

        catch (
            error
        ) {

            state.loading =
                false;


            state.error = {

                stage:
                    "UI_ANALYSIS",

                message:
                    error.message,

                error:
                    error
            };


            console.error(
                "TMS19 UI Analysis Error:",
                error
            );


            return {

                success:
                    false,

                error:
                    state.error
            };
        }
    }


    /* ============================================================
       KPI CARD
    ============================================================ */

    function createKPI(
        title,
        value,
        subtitle,
        className = ""
    ) {

        return `
            <div
                class="tms19-kpi-card ${className}"
            >

                <div class="tms19-kpi-title">
                    ${escapeHtml(title)}
                </div>

                <div class="tms19-kpi-value">
                    ${value}
                </div>

                <div class="tms19-kpi-subtitle">
                    ${escapeHtml(subtitle || "")}
                </div>

            </div>
        `;
    }


    /* ============================================================
       KPI GRID
    ============================================================ */

    function renderKPIs(
        container
    ) {

        if (
            !container ||
            !state.kpis
        ) {

            return;
        }


        const k =
            state.kpis;


        container.innerHTML = `

            <div class="tms19-kpi-grid">

                ${createKPI(
                    "Toplam DBO",
                    formatMoney(k.dbo),
                    "Tanımlanmış fayda yükümlülüğü"
                )}

                ${createKPI(
                    "Net Yükümlülük",
                    formatMoney(
                        k.netLiability
                    ),
                    "DBO eksi plan varlıkları"
                )}

                ${createKPI(
                    "Cari Hizmet Maliyeti",
                    formatMoney(
                        k.currentServiceCost
                    ),
                    "Dönem P&L etkisi"
                )}

                ${createKPI(
                    "Faiz Maliyeti",
                    formatMoney(
                        k.interestCost
                    ),
                    "Net faiz etkisi"
                )}

                ${createKPI(
                    "Aktüeryal Kazanç / Kayıp",
                    formatMoney(
                        k.actuarialGainLoss
                    ),
                    "OCI etkisi"
                )}

                ${createKPI(
                    "Personel",
                    formatNumber(
                        k.personelSayisi
                    ),
                    "Değerlemeye dahil personel"
                )}

            </div>
        `;
    }


    /* ============================================================
       RISK CARD
    ============================================================ */

    function renderRisk(
        container
    ) {

        if (
            !container ||
            !state.kpis
        ) {

            return;
        }


        const k =
            state.kpis;


        const level =
            k.riskLevel;


        const levelText = {

            LOW:
                "Düşük",

            MEDIUM:
                "Orta",

            HIGH:
                "Yüksek"
        };


        container.innerHTML = `

            <div class="tms19-risk-card">

                <div class="tms19-risk-header">

                    <div>
                        <div class="tms19-section-label">
                            AKTÜERYAL RİSK
                        </div>

                        <div class="tms19-risk-title">
                            Portföy Risk Seviyesi
                        </div>
                    </div>

                    <div
                        class="tms19-risk-badge
                        tms19-risk-${level.toLowerCase()}"
                    >
                        ${
                            levelText[level] ||
                            level
                        }
                    </div>

                </div>


                <div class="tms19-risk-score">

                    <strong>
                        ${formatNumber(
                            k.riskScore
                        )}
                    </strong>

                    <span>
                        / 100
                    </span>

                </div>


                <div class="tms19-risk-metrics">

                    <div>
                        <span>
                            İlk %10 DBO yoğunlaşması
                        </span>

                        <strong>
                            ${formatPercent(
                                k.dboConcentration
                            )}
                        </strong>
                    </div>


                    <div>
                        <span>
                            5 yıl içinde emeklilik
                        </span>

                        <strong>
                            ${formatPercent(
                                k.retirementWithin5Years
                            )}
                        </strong>
                    </div>

                </div>

            </div>
        `;
    }


    /* ============================================================
       DBO MOVEMENT
    ============================================================ */

    function renderMovement(
        container
    ) {

        if (
            !container ||
            !state.kpis
        ) {

            return;
        }


        const k =
            state.kpis;


        container.innerHTML = `

            <div class="tms19-movement-card">

                <div class="tms19-section-title">
                    DBO Hareket Analizi
                </div>


                <div class="tms19-movement-row">

                    <span>
                        Cari Hizmet Maliyeti
                    </span>

                    <strong>
                        ${formatMoney(
                            k.currentServiceCost
                        )}
                    </strong>

                </div>


                <div class="tms19-movement-row">

                    <span>
                        Faiz Maliyeti
                    </span>

                    <strong>
                        ${formatMoney(
                            k.interestCost
                        )}
                    </strong>

                </div>


                <div class="tms19-movement-row">

                    <span>
                        Geçmiş Hizmet Maliyeti
                    </span>

                    <strong>
                        ${formatMoney(
                            k.pastServiceCost
                        )}
                    </strong>

                </div>


                <div class="tms19-movement-row">

                    <span>
                        Aktüeryal Kazanç / Kayıp
                    </span>

                    <strong>
                        ${formatMoney(
                            k.actuarialGainLoss
                        )}
                    </strong>

                </div>


                <div class="tms19-movement-divider">
                </div>


                <div class="tms19-movement-row total">

                    <span>
                        Kapanış DBO
                    </span>

                    <strong>
                        ${formatMoney(
                            k.dbo
                        )}
                    </strong>

                </div>

            </div>
        `;
    }


    /* ============================================================
       AGE TABLE
    ============================================================ */

    function renderAgeAnalysis(
        container
    ) {

        if (
            !container ||
            !state.portfolio
        ) {

            return;
        }


        const rows =
            state.portfolio.byAge ||
            [];


        container.innerHTML = `

            <table class="tms19-data-table">

                <thead>

                    <tr>

                        <th>
                            Yaş Grubu
                        </th>

                        <th>
                            Personel
                        </th>

                        <th>
                            DBO
                        </th>

                    </tr>

                </thead>


                <tbody>

                    ${
                        rows.map(
                            row => `

                                <tr>

                                    <td>
                                        ${escapeHtml(
                                            row.bucket
                                        )}
                                    </td>

                                    <td>
                                        ${formatNumber(
                                            row.personelSayisi
                                        )}
                                    </td>

                                    <td>
                                        ${formatMoney(
                                            row.dbo
                                        )}
                                    </td>

                                </tr>
                            `
                        ).join("")
                    }

                </tbody>

            </table>
        `;
    }


    /* ============================================================
       DEPARTMENT TABLE
    ============================================================ */

    function renderDepartments(
        container
    ) {

        if (
            !container ||
            !state.portfolio
        ) {

            return;
        }


        const rows =
            state.portfolio
                .byDepartment ||
            [];


        container.innerHTML = `

            <table class="tms19-data-table">

                <thead>

                    <tr>

                        <th>
                            Departman
                        </th>

                        <th>
                            Personel
                        </th>

                        <th>
                            DBO
                        </th>

                        <th>
                            Cari Hizmet Maliyeti
                        </th>

                        <th>
                            Faiz Maliyeti
                        </th>

                    </tr>

                </thead>


                <tbody>

                    ${
                        rows.map(
                            row => `

                                <tr>

                                    <td>
                                        ${escapeHtml(
                                            row.departman
                                        )}
                                    </td>

                                    <td>
                                        ${formatNumber(
                                            row.personelSayisi
                                        )}
                                    </td>

                                    <td>
                                        ${formatMoney(
                                            row.dbo
                                        )}
                                    </td>

                                    <td>
                                        ${formatMoney(
                                            row.currentServiceCost
                                        )}
                                    </td>

                                    <td>
                                        ${formatMoney(
                                            row.interestCost
                                        )}
                                    </td>

                                </tr>

                            `
                        ).join("")
                    }

                </tbody>

            </table>
        `;
    }


    /* ============================================================
       TOP DBO TABLE
    ============================================================ */

    function renderTopDBO(
        container
    ) {

        if (
            !container ||
            !state.portfolio
        ) {

            return;
        }


        const employees =
            state.portfolio
                .topDBO ||
            [];


        container.innerHTML = `

            <table class="tms19-data-table">

                <thead>

                    <tr>

                        <th>
                            Personel
                        </th>

                        <th>
                            Departman
                        </th>

                        <th>
                            Yaş
                        </th>

                        <th>
                            Kalan Yıl
                        </th>

                        <th>
                            DBO
                        </th>

                    </tr>

                </thead>


                <tbody>

                    ${
                        employees.map(
                            employee => `

                                <tr>

                                    <td>
                                        ${escapeHtml(
                                            employee.personelAdi
                                        )}
                                    </td>

                                    <td>
                                        ${escapeHtml(
                                            employee.departman
                                        )}
                                    </td>

                                    <td>
                                        ${formatNumber(
                                            employee.yas
                                        )}
                                    </td>

                                    <td>
                                        ${formatNumber(
                                            employee.kalanYil,
                                            1
                                        )}
                                    </td>

                                    <td>
                                        ${formatMoney(
                                            employee.dbo
                                        )}
                                    </td>

                                </tr>

                            `
                        ).join("")
                    }

                </tbody>

            </table>
        `;
    }


    /* ============================================================
       DATA QUALITY
    ============================================================ */

    function renderDataQuality(
        container
    ) {

        if (
            !container
        ) {

            return;
        }


        const quality =
            state.portfolio
                ?.dataQuality;


        if (
            !quality
        ) {

            container.innerHTML =
                "";

            return;
        }


        container.innerHTML = `

            <div class="tms19-quality-card">

                <div>

                    <div class="tms19-section-label">
                        DATA GOVERNANCE
                    </div>

                    <div class="tms19-quality-title">
                        Veri Kalitesi
                    </div>

                </div>


                <div class="tms19-quality-score">

                    ${formatNumber(
                        quality.score,
                        1
                    )}%

                </div>


                <div class="tms19-quality-level">

                    ${escapeHtml(
                        quality.level
                    )}

                </div>

            </div>
        `;
    }


    /* ============================================================
       FULL DASHBOARD RENDER
    ============================================================ */

    function renderDashboard() {

        renderKPIs(
            document.getElementById(
                "tms19-kpi-container"
            )
        );


        renderRisk(
            document.getElementById(
                "tms19-risk-container"
            )
        );


        renderMovement(
            document.getElementById(
                "tms19-movement-container"
            )
        );


        renderAgeAnalysis(
            document.getElementById(
                "tms19-age-container"
            )
        );


        renderDepartments(
            document.getElementById(
                "tms19-department-container"
            )
        );


        renderTopDBO(
            document.getElementById(
                "tms19-top-dbo-container"
            )
        );


        renderDataQuality(
            document.getElementById(
                "tms19-data-quality-container"
            )
        );
    }


    /* ============================================================
       EMPLOYEE TABLE
    ============================================================ */

    function renderEmployeeTable(
        container
    ) {

        if (
            !container
        ) {

            return;
        }


        const employees =
            state.portfolio
                ?.results ||
            [];


        container.innerHTML = `

            <table class="tms19-data-table">

                <thead>

                    <tr>

                        <th>
                            Personel
                        </th>

                        <th>
                            Departman
                        </th>

                        <th>
                            Yaş
                        </th>

                        <th>
                            Hizmet
                        </th>

                        <th>
                            Kalan Yıl
                        </th>

                        <th>
                            Maaş
                        </th>

                        <th>
                            DBO
                        </th>

                        <th>
                            Cari Hizmet Maliyeti
                        </th>

                    </tr>

                </thead>


                <tbody>

                    ${
                        employees.map(
                            employee => `

                                <tr>

                                    <td>
                                        ${escapeHtml(
                                            employee.personelAdi
                                        )}
                                    </td>

                                    <td>
                                        ${escapeHtml(
                                            employee.departman
                                        )}
                                    </td>

                                    <td>
                                        ${formatNumber(
                                            employee.yas,
                                            1
                                        )}
                                    </td>

                                    <td>
                                        ${formatNumber(
                                            employee.hizmetSuresi,
                                            1
                                        )}
                                    </td>

                                    <td>
                                        ${formatNumber(
                                            employee.kalanYil,
                                            1
                                        )}
                                    </td>

                                    <td>
                                        ${formatMoney(
                                            employee.raw
                                                ?.mevcutMaas ||
                                            0
                                        )}
                                    </td>

                                    <td>
                                        ${formatMoney(
                                            employee.dbo
                                        )}
                                    </td>

                                    <td>
                                        ${formatMoney(
                                            employee.currentServiceCost
                                        )}
                                    </td>

                                </tr>

                            `
                        ).join("")
                    }

                </tbody>

            </table>
        `;
    }


    /* ============================================================
       PUBLIC API
    ============================================================ */

    global.TMS19DataUI =
        global.TMS19DataUI ||
        {};


    global.TMS19DataUI
        .state =
            state;


    global.TMS19DataUI
        .runAnalysis =
            runAnalysis;


    global.TMS19DataUI
        .renderDashboard =
            renderDashboard;


    global.TMS19DataUI
        .renderKPIs =
            renderKPIs;


    global.TMS19DataUI
        .renderRisk =
            renderRisk;


    global.TMS19DataUI
        .renderMovement =
            renderMovement;


    global.TMS19DataUI
        .renderAgeAnalysis =
            renderAgeAnalysis;


    global.TMS19DataUI
        .renderDepartments =
            renderDepartments;


    global.TMS19DataUI
        .renderTopDBO =
            renderTopDBO;


    global.TMS19DataUI
        .renderEmployeeTable =
            renderEmployeeTable;


    global.TMS19DataUI
        .renderDataQuality =
            renderDataQuality;


    global.TMS19DataUI
        .formatMoney =
            formatMoney;


    global.TMS19DataUI
        .formatNumber =
            formatNumber;


    global.TMS19DataUI
        .formatPercent =
            formatPercent;


    /* ============================================================
       HEALTH CHECK
    ============================================================ */

    global.TMS19DataUI
        .healthCheck =
            function () {

                return {

                    healthy:
                        typeof runAnalysis ===
                            "function" &&

                        typeof renderDashboard ===
                            "function",

                    engine:
                        "TMS19 Data UI",

                    version:
                        "2.0",

                    timestamp:
                        new Date()
                            .toISOString()
                };
            };


})(window);
