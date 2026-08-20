/* =========================================================
   GK ADVISORY
   TMS 19 — VERİ YÜKLEME & VERİ KALİTESİ ARAYÜZÜ
   tms19-data-ui.js
========================================================= */

(function (window) {

    "use strict";

    const Engine = window.TMS19DataEngine;

    if (!Engine) {

        console.error(
            "TMS19DataEngine bulunamadı."
        );

        return;

    }


    /* =====================================================
       DURUM
    ===================================================== */

    let mevcutVeri = [];

    let sonImport = null;


    /* =====================================================
       HTML
    ===================================================== */

    function veriMerkeziOlustur() {

        const existing =
            document.getElementById(
                "tms19-veri-merkezi"
            );

        if (existing) {
            return;
        }


        const container =
            document.createElement(
                "section"
            );

        container.id =
            "tms19-veri-merkezi";

        container.innerHTML = `

            <div class="tms19-data-header">

                <div>

                    <div class="tms19-eyebrow">
                        TMS 19 • VERİ YÖNETİMİ
                    </div>

                    <h2>
                        Personel Veri Merkezi
                    </h2>

                    <p>
                        Aktüeryal hesaplama öncesinde
                        personel verilerinin yüklenmesi,
                        standardize edilmesi ve kalite
                        kontrollerinden geçirilmesi.
                    </p>

                </div>

                <div class="tms19-data-actions">

                    <label
                        class="tms19-upload-button"
                        for="tms19-personel-file"
                    >

                        📂 Personel Dosyası Yükle

                    </label>

                    <input
                        type="file"
                        id="tms19-personel-file"
                        accept=".csv,.json"
                        hidden
                    >

                    <button
                        type="button"
                        id="tms19-demo-data"
                        class="tms19-secondary-button"
                    >
                        Demo Veri Oluştur
                    </button>

                </div>

            </div>


            <div
                id="tms19-data-message"
                class="tms19-data-message"
            ></div>


            <div class="tms19-data-kpis">

                <div class="tms19-data-card">

                    <span>
                        Toplam Personel
                    </span>

                    <strong id="tms19-kpi-personel">
                        0
                    </strong>

                </div>


                <div class="tms19-data-card">

                    <span>
                        Veri Kalitesi
                    </span>

                    <strong id="tms19-kpi-kalite">
                        —
                    </strong>

                </div>


                <div class="tms19-data-card">

                    <span>
                        Toplam Yıllık Brüt Maaş
                    </span>

                    <strong id="tms19-kpi-maas">
                        0
                    </strong>

                </div>


                <div class="tms19-data-card">

                    <span>
                        Opening DBO
                    </span>

                    <strong id="tms19-kpi-dbo">
                        0
                    </strong>

                </div>

            </div>


            <div class="tms19-quality-panel">

                <div class="tms19-quality-title">

                    <div>

                        <span>
                            Veri Kalite Skoru
                        </span>

                        <strong id="tms19-quality-score">
                            —
                        </strong>

                    </div>

                    <div
                        id="tms19-quality-status"
                        class="tms19-quality-status"
                    >
                        Veri bekleniyor
                    </div>

                </div>


                <div class="tms19-progress">

                    <div
                        id="tms19-progress-bar"
                    ></div>

                </div>


                <div class="tms19-quality-summary">

                    <div>
                        <small>
                            Geçerli kayıt
                        </small>

                        <strong id="tms19-valid-count">
                            0
                        </strong>
                    </div>


                    <div>
                        <small>
                            Uyarı
                        </small>

                        <strong id="tms19-warning-count">
                            0
                        </strong>
                    </div>


                    <div>
                        <small>
                            Kritik
                        </small>

                        <strong id="tms19-critical-count">
                            0
                        </strong>
                    </div>

                </div>

            </div>


            <div class="tms19-validation-panel">

                <div class="tms19-section-title">

                    <div>

                        <span>
                            Veri Kalite Kontrolleri
                        </span>

                        <p>
                            Aktüeryal hesaplamaya girmeden
                            önce tespit edilen veri problemleri.
                        </p>

                    </div>

                </div>


                <div id="tms19-validation-list">

                    <div class="tms19-empty-state">

                        Henüz personel verisi yüklenmedi.

                    </div>

                </div>

            </div>


            <div class="tms19-personel-panel">

                <div class="tms19-section-title">

                    <div>

                        <span>
                            Personel Portföyü
                        </span>

                        <p>
                            Normalize edilmiş aktüeryal veri seti.
                        </p>

                    </div>

                    <div>

                        <button
                            id="tms19-calculate-button"
                            class="tms19-primary-button"
                            type="button"
                            disabled
                        >
                            Aktüeryal Hesaplamayı Başlat →
                        </button>

                    </div>

                </div>


                <div class="tms19-table-wrapper">

                    <table
                        class="tms19-personel-table"
                    >

                        <thead>

                            <tr>

                                <th>
                                    Sicil No
                                </th>

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
                                    Kıdem
                                </th>

                                <th>
                                    Yıllık Brüt Maaş
                                </th>

                                <th>
                                    Emeklilik Yaşı
                                </th>

                                <th>
                                    Opening DBO
                                </th>

                            </tr>

                        </thead>

                        <tbody
                            id="tms19-personel-table-body"
                        >

                            <tr>

                                <td
                                    colspan="8"
                                    class="tms19-empty-cell"
                                >
                                    Veri bekleniyor.
                                </td>

                            </tr>

                        </tbody>

                    </table>

                </div>

            </div>

        `;


        /*
         * Dashboard içine yerleştir
         */

        const main =
            document.querySelector(
                "main"
            );


        if (main) {

            main.appendChild(
                container
            );

        }
        else {

            document.body.appendChild(
                container
            );

        }


        eventleriBagla();

    }


    /* =====================================================
       EVENTLER
    ===================================================== */

    function eventleriBagla() {

        const fileInput =
            document.getElementById(
                "tms19-personel-file"
            );


        const demoButton =
            document.getElementById(
                "tms19-demo-data"
            );


        const calculateButton =
            document.getElementById(
                "tms19-calculate-button"
            );


        if (fileInput) {

            fileInput.addEventListener(
                "change",
                dosyaYukle
            );

        }


        if (demoButton) {

            demoButton.addEventListener(
                "click",
                demoVeriYukle
            );

        }


        if (calculateButton) {

            calculateButton.addEventListener(
                "click",
                aktuerHesaplamayiBaslat
            );

        }

    }


    /* =====================================================
       DOSYA YÜKLEME
    ===================================================== */

    function dosyaYukle(event) {

        const file =
            event.target.files[0];


        if (!file) {
            return;
        }


        mesajGoster(
            "Dosya okunuyor...",
            "info"
        );


        const reader =
            new FileReader();


        reader.onload =
            function (e) {

                try {

                    const content =
                        e.target.result;


                    let result;


                    if (
                        file.name
                            .toLowerCase()
                            .endsWith(
                                ".json"
                            )
                    ) {

                        result =
                            Engine.importJSON(
                                content,
                                {
                                    valuationDate:
                                        new Date()
                                }
                            );

                    }
                    else {

                        result =
                            Engine.importCSV(
                                content,
                                {
                                    valuationDate:
                                        new Date()
                                }
                            );

                    }


                    veriIslendi(
                        result
                    );


                    mesajGoster(
                        "Personel dosyası başarıyla yüklendi.",
                        "success"
                    );

                }
                catch (error) {

                    console.error(
                        error
                    );


                    mesajGoster(
                        "Dosya işlenirken hata oluştu: " +
                        error.message,
                        "error"
                    );

                }

            };


        reader.onerror =
            function () {

                mesajGoster(
                    "Dosya okunamadı.",
                    "error"
                );

            };


        reader.readAsText(
            file,
            "UTF-8"
        );

    }


    /* =====================================================
       DEMO VERİ
    ===================================================== */

    function demoVeriYukle() {

        mesajGoster(
            "Aktüeryal demo portföyü hazırlanıyor...",
            "info"
        );


        try {

            const result =
                Engine.generateDemoData(
                    100
                );


            veriIslendi(
                result
            );


            mesajGoster(
                "100 kişilik demo portföy oluşturuldu.",
                "success"
            );

        }
        catch (error) {

            console.error(
                error
            );


            mesajGoster(
                "Demo veri oluşturulamadı.",
                "error"
            );

        }

    }


    /* =====================================================
       VERİ İŞLE
    ===================================================== */

    function veriIslendi(
        result
    ) {

        sonImport =
            result;


        mevcutVeri =
            result.employees || [];


        window.TMS19CurrentEmployees =
            mevcutVeri;


        window.TMS19CurrentImport =
            result;


        kpiGuncelle(
            result
        );


        kaliteGuncelle(
            result
        );


        sorunlariGoster(
            result
        );


        tabloGuncelle(
            mevcutVeri
        );


        const button =
            document.getElementById(
                "tms19-calculate-button"
            );


        if (button) {

            button.disabled =
                mevcutVeri.length === 0;

        }

    }


    /* =====================================================
       KPI
    ===================================================== */

    function kpiGuncelle(
        result
    ) {

        const summary =
            result.summary;


        setText(
            "tms19-kpi-personel",
            formatNumber(
                summary.employeeCount
            )
        );


        setText(
            "tms19-kpi-maas",
            formatMoney(
                summary.totalSalary
            )
        );


        setText(
            "tms19-kpi-dbo",
            formatMoney(
                summary.totalOpeningDBO
            )
        );


        setText(
            "tms19-kpi-kalite",
            "%" +
            (
                result.validation
                    ?.completeness ||
                0
            ).toFixed(1)
        );

    }


    /* =====================================================
       KALİTE
    ===================================================== */

    function kaliteGuncelle(
        result
    ) {

        const validation =
            result.validation;


        const score =
            validation.completeness ||
            0;


        setText(
            "tms19-quality-score",
            "%" +
            score.toFixed(1)
        );


        setText(
            "tms19-valid-count",
            validation.validRecords
        );


        setText(
            "tms19-warning-count",
            validation.warningRecords
        );


        setText(
            "tms19-critical-count",
            validation.criticalRecords
        );


        const progress =
            document.getElementById(
                "tms19-progress-bar"
            );


        if (progress) {

            progress.style.width =
                Math.min(
                    100,
                    Math.max(
                        0,
                        score
                    )
                ) +
                "%";

        }


        const status =
            document.getElementById(
                "tms19-quality-status"
            );


        if (!status) {
            return;
        }


        status.className =
            "tms19-quality-status";


        if (
            score >= 98 &&
            validation.criticalRecords === 0
        ) {

            status.textContent =
                "Mükemmel";


            status.classList.add(
                "excellent"
            );

        }
        else if (
            score >= 95
        ) {

            status.textContent =
                "Yüksek";


            status.classList.add(
                "high"
            );

        }
        else if (
            score >= 85
        ) {

            status.textContent =
                "Orta";


            status.classList.add(
                "medium"
            );

        }
        else {

            status.textContent =
                "Kontrol Gerekli";


            status.classList.add(
                "critical"
            );

        }

    }


    /* =====================================================
       SORUNLAR
    ===================================================== */

    function sorunlariGoster(
        result
    ) {

        const container =
            document.getElementById(
                "tms19-validation-list"
            );


        if (!container) {
            return;
        }


        const issues =
            result.validation.issues ||
            [];


        if (
            issues.length === 0
        ) {

            container.innerHTML = `

                <div class="tms19-success-box">

                    ✓ Veri kalite kontrolünde
                    önemli bir problem tespit edilmedi.

                </div>

            `;

            return;

        }


        let html = "";


        issues
            .slice(
                0,
                30
            )
            .forEach(
                function (
                    issue
                ) {

                    html += `

                        <div
                            class="tms19-validation-row"
                        >

                            <div>

                                <strong>
                                    ${escapeHTML(
                                        issue.name
                                    )}
                                </strong>

                                <small>
                                    Sicil:
                                    ${escapeHTML(
                                        issue.employeeId
                                    )}
                                </small>

                            </div>

                            <div>

                                ${
                                    issue.issues
                                        .map(
                                            x =>
                                                `
                                                <span
                                                    class="tms19-issue"
                                                >
                                                    ${escapeHTML(x)}
                                                </span>
                                                `
                                        )
                                        .join("")
                                }

                            </div>

                        </div>

                    `;

                }
            );


        container.innerHTML =
            html;

    }


    /* =====================================================
       PERSONEL TABLOSU
    ===================================================== */

    function tabloGuncelle(
        employees
    ) {

        const tbody =
            document.getElementById(
                "tms19-personel-table-body"
            );


        if (!tbody) {
            return;
        }


        if (
            employees.length === 0
        ) {

            tbody.innerHTML = `

                <tr>

                    <td
                        colspan="8"
                        class="tms19-empty-cell"
                    >
                        Veri bulunamadı.
                    </td>

                </tr>

            `;

            return;

        }


        tbody.innerHTML =
            employees
                .slice(
                    0,
                    100
                )
                .map(
                    function (
                        employee
                    ) {

                        return `

                            <tr>

                                <td>
                                    ${escapeHTML(
                                        employee.employeeId
                                    )}
                                </td>

                                <td>
                                    <strong>
                                        ${escapeHTML(
                                            employee.name
                                        )}
                                    </strong>
                                </td>

                                <td>
                                    ${escapeHTML(
                                        employee.department
                                    )}
                                </td>

                                <td>
                                    ${employee.age}
                                </td>

                                <td>
                                    ${employee.serviceYears.toFixed(1)}
                                </td>

                                <td>
                                    ${formatMoney(
                                        employee.annualSalary
                                    )}
                                </td>

                                <td>
                                    ${employee.retirementAge}
                                </td>

                                <td>
                                    ${formatMoney(
                                        employee.openingDBO
                                    )}
                                </td>

                            </tr>

                        `;

                    }
                )
                .join("");

    }


    /* =====================================================
       AKTÜERYAL HESAPLAMAYI BAŞLAT
    ===================================================== */

    function aktuerHesaplamayiBaslat() {

        if (
            mevcutVeri.length === 0
        ) {

            mesajGoster(
                "Önce personel verisi yüklemelisiniz.",
                "error"
            );

            return;

        }


        /*
         * Aktüeryal motoru kontrol ediyoruz.
         */

        const actuarial =
            window.TMS19ActuarialEngine;


        if (!actuarial) {

            mesajGoster(
                "Aktüeryal motor henüz yüklenmemiş. " +
                "tms19-actuarial-engine.js kontrol edilmeli.",
                "error"
            );

            console.warn(
                "TMS19ActuarialEngine bulunamadı."
            );

            return;

        }


        try {

            let result;


            /*
             * Motorun mevcut API'sine
             * mümkün olduğunca esnek bağlanıyoruz.
             */

            if (
                typeof actuarial
                    .calculatePortfolio ===
                "function"
            ) {

                result =
                    actuarial.calculatePortfolio(
                        mevcutVeri
                    );

            }
            else if (
                typeof actuarial
                    .calculate ===
                "function"
            ) {

                result =
                    actuarial.calculate(
                        mevcutVeri
                    );

            }
            else {

                mesajGoster(
                    "Aktüeryal motor bulundu ancak hesaplama fonksiyonu tanımlı değil.",
                    "error"
                );

                return;

            }


            window.TMS19CurrentActuarialResult =
                result;


            /*
             * Dashboard'daki event sistemi
             * varsa tetikle.
             */

            window.dispatchEvent(
                new CustomEvent(
                    "tms19:calculation-complete",
                    {
                        detail:
                            result
                    }
                )
            );


            mesajGoster(
                "Aktüeryal hesaplama tamamlandı.",
                "success"
            );


            /*
             * Dashboard'a dön
             */

            const dashboard =
                document.getElementById(
                    "tms19-dashboard"
                );


            if (dashboard) {

                dashboard.scrollIntoView({
                    behavior:
                        "smooth"
                });

            }

        }
        catch (error) {

            console.error(
                error
            );


            mesajGoster(
                "Aktüeryal hesaplama sırasında hata oluştu: " +
                error.message,
                "error"
            );

        }

    }


    /* =====================================================
       MESAJ
    ===================================================== */

    function mesajGoster(
        message,
        type
    ) {

        const element =
            document.getElementById(
                "tms19-data-message"
            );


        if (!element) {
            return;
        }


        element.textContent =
            message;


        element.className =
            "tms19-data-message " +
            (
                type ||
                "info"
            );


        clearTimeout(
            element._timer
        );


        element._timer =
            setTimeout(
                function () {

                    element.className =
                        "tms19-data-message";

                    element.textContent =
                        "";

                },
                5000
            );

    }


    /* =====================================================
       YARDIMCI
    ===================================================== */

    function setText(
        id,
        value
    ) {

        const element =
            document.getElementById(
                id
            );


        if (element) {

            element.textContent =
                value;

        }

    }


    function formatNumber(
        value
    ) {

        return new Intl.NumberFormat(
            "tr-TR"
        ).format(
            Number(value) || 0
        );

    }


    function formatMoney(
        value
    ) {

        return new Intl.NumberFormat(
            "tr-TR",
            {
                maximumFractionDigits:
                    0
            }
        ).format(
            Number(value) || 0
        ) +
        " TL";

    }


    function escapeHTML(
        value
    ) {

        return String(
            value ?? ""
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


    /* =====================================================
       CSS
    ===================================================== */

    function stilEkle() {

        if (
            document.getElementById(
                "tms19-data-ui-style"
            )
        ) {

            return;

        }


        const style =
            document.createElement(
                "style"
            );


        style.id =
            "tms19-data-ui-style";


        style.textContent = `

            #tms19-veri-merkezi {

                margin-top: 32px;

                padding: 28px;

                border-radius: 20px;

                background:
                    rgba(255,255,255,.96);

                border:
                    1px solid #e5e7eb;

                box-shadow:
                    0 15px 40px
                    rgba(15,23,42,.06);

            }


            .tms19-data-header {

                display:
                    flex;

                justify-content:
                    space-between;

                align-items:
                    flex-start;

                gap:
                    24px;

                margin-bottom:
                    24px;

            }


            .tms19-eyebrow {

                font-size:
                    11px;

                font-weight:
                    700;

                letter-spacing:
                    .12em;

                text-transform:
                    uppercase;

                color:
                    #64748b;

                margin-bottom:
                    8px;

            }


            .tms19-data-header h2 {

                margin:
                    0 0 8px;

                font-size:
                    25px;

                color:
                    #0f172a;

            }


            .tms19-data-header p {

                margin:
                    0;

                max-width:
                    700px;

                color:
                    #64748b;

                line-height:
                    1.6;

            }


            .tms19-data-actions {

                display:
                    flex;

                gap:
                    10px;

                flex-wrap:
                    wrap;

            }


            .tms19-upload-button,
            .tms19-primary-button,
            .tms19-secondary-button {

                border:
                    0;

                border-radius:
                    10px;

                padding:
                    12px 16px;

                font-weight:
                    700;

                cursor:
                    pointer;

                transition:
                    .2s;

            }


            .tms19-upload-button,
            .tms19-primary-button {

                background:
                    #0f172a;

                color:
                    white;

            }


            .tms19-secondary-button {

                background:
                    #f1f5f9;

                color:
                    #0f172a;

            }


            .tms19-upload-button:hover,
            .tms19-primary-button:hover,
            .tms19-secondary-button:hover {

                transform:
                    translateY(-1px);

            }


            .tms19-primary-button:disabled {

                opacity:
                    .45;

                cursor:
                    not-allowed;

                transform:
                    none;

            }


            .tms19-data-message {

                min-height:
                    0;

                margin-bottom:
                    12px;

                font-size:
                    13px;

            }


            .tms19-data-message.success {

                padding:
                    11px 14px;

                border-radius:
                    10px;

                background:
                    #ecfdf5;

                color:
                    #047857;

            }


            .tms19-data-message.error {

                padding:
                    11px 14px;

                border-radius:
                    10px;

                background:
                    #fef2f2;

                color:
                    #b91c1c;

            }


            .tms19-data-message.info {

                padding:
                    11px 14px;

                border-radius:
                    10px;

                background:
                    #eff6ff;

                color:
                    #1d4ed8;

            }


            .tms19-data-kpis {

                display:
                    grid;

                grid-template-columns:
                    repeat(4, 1fr);

                gap:
                    14px;

                margin-bottom:
                    20px;

            }


            .tms19-data-card {

                padding:
                    18px;

                border:
                    1px solid #e5e7eb;

                border-radius:
                    14px;

                background:
                    #f8fafc;

            }


            .tms19-data-card span {

                display:
                    block;

                font-size:
                    12px;

                color:
                    #64748b;

                margin-bottom:
                    8px;

            }


            .tms19-data-card strong {

                font-size:
                    21px;

                color:
                    #0f172a;

            }


            .tms19-quality-panel {

                padding:
                    20px;

                border:
                    1px solid #e5e7eb;

                border-radius:
                    14px;

                margin-bottom:
                    20px;

            }


            .tms19-quality-title {

                display:
                    flex;

                justify-content:
                    space-between;

                align-items:
                    center;

                margin-bottom:
                    14px;

            }


            .tms19-quality-title span {

                display:
                    block;

                font-size:
                    12px;

                color:
                    #64748b;

            }


            .tms19-quality-title strong {

                display:
                    block;

                margin-top:
                    3px;

                font-size:
                    25px;

                color:
                    #0f172a;

            }


            .tms19-quality-status {

                padding:
                    7px 11px;

                border-radius:
                    999px;

                background:
                    #f1f5f9;

                color:
                    #475569;

                font-size:
                    12px;

                font-weight:
                    700;

            }


            .tms19-quality-status.excellent,
            .tms19-quality-status.high {

                background:
                    #ecfdf5;

                color:
                    #047857;

            }


            .tms19-quality-status.medium {

                background:
                    #fffbeb;

                color:
                    #b45309;

            }


            .tms19-quality-status.critical {

                background:
                    #fef2f2;

                color:
                    #b91c1c;

            }


            .tms19-progress {

                width:
                    100%;

                height:
                    8px;

                overflow:
                    hidden;

                border-radius:
                    999px;

                background:
                    #e2e8f0;

            }


            #tms19-progress-bar {

                width:
                    0%;

                height:
                    100%;

                background:
                    #0f172a;

                transition:
                    width .5s ease;

            }


            .tms19-quality-summary {

                display:
                    flex;

                gap:
                    30px;

                margin-top:
                    16px;

            }


            .tms19-quality-summary small {

                display:
                    block;

                color:
                    #64748b;

                font-size:
                    11px;

            }


            .tms19-quality-summary strong {

                display:
                    block;

                margin-top:
                    4px;

                color:
                    #0f172a;

            }


            .tms19-validation-panel,
            .tms19-personel-panel {

                margin-top:
                    20px;

                padding:
                    20px;

                border:
                    1px solid #e5e7eb;

                border-radius:
                    14px;

            }


            .tms19-section-title {

                display:
                    flex;

                justify-content:
                    space-between;

                align-items:
                    center;

                gap:
                    15px;

                margin-bottom:
                    16px;

            }


            .tms19-section-title span {

                font-weight:
                    800;

                color:
                    #0f172a;

            }


            .tms19-section-title p {

                margin:
                    5px 0 0;

                font-size:
                    12px;

                color:
                    #64748b;

            }


            .tms19-success-box {

                padding:
                    14px;

                border-radius:
                    10px;

                background:
                    #ecfdf5;

                color:
                    #047857;

                font-size:
                    13px;

            }


            .tms19-validation-row {

                display:
                    flex;

                justify-content:
                    space-between;

                gap:
                    20px;

                padding:
                    13px 0;

                border-bottom:
                    1px solid #f1f5f9;

            }


            .tms19-validation-row strong {

                display:
                    block;

                color:
                    #0f172a;

            }


            .tms19-validation-row small {

                display:
                    block;

                margin-top:
                    4px;

                color:
                    #94a3b8;

            }


            .tms19-issue {

                display:
                    inline-block;

                margin:
                    3px;

                padding:
                    5px 8px;

                border-radius:
                    7px;

                background:
                    #fef2f2;

                color:
                    #b91c1c;

                font-size:
                    11px;

            }


            .tms19-table-wrapper {

                overflow-x:
                    auto;

            }


            .tms19-personel-table {

                width:
                    100%;

                border-collapse:
                    collapse;

                min-width:
                    900px;

            }


            .tms19-personel-table th {

                padding:
                    11px;

                text-align:
                    left;

                background:
                    #f8fafc;

                color:
                    #64748b;

                font-size:
                    11px;

                font-weight:
                    700;

                white-space:
                    nowrap;

            }


            .tms19-personel-table td {

                padding:
                    12px 11px;

                border-top:
                    1px solid #f1f5f9;

                color:
                    #334155;

                font-size:
                    12px;

                white-space:
                    nowrap;

            }


            .tms19-empty-cell {

                text-align:
                    center !important;

                color:
                    #94a3b8 !important;

                padding:
                    30px !important;

            }


            @media (
                max-width: 900px
            ) {

                .tms19-data-header {

                    flex-direction:
                        column;

                }


                .tms19-data-kpis {

                    grid-template-columns:
                        repeat(2, 1fr);

                }

            }


            @media (
                max-width: 600px
            ) {

                #tms19-veri-merkezi {

                    padding:
                        16px;

                    border-radius:
                        14px;

                }


                .tms19-data-kpis {

                    grid-template-columns:
                        1fr;

                }


                .tms19-quality-title {

                    align-items:
                        flex-start;

                    gap:
                        12px;

                }


                .tms19-validation-row {

                    flex-direction:
                        column;

                }


                .tms19-data-actions {

                    width:
                        100%;

                }


                .tms19-upload-button,
                .tms19-secondary-button {

                    flex:
                        1;

                    text-align:
                        center;

                }

            }

        `;


        document.head.appendChild(
            style
        );

    }


    /* =====================================================
       BAŞLAT
    ===================================================== */

    function baslat() {

        stilEkle();

        veriMerkeziOlustur();

    }


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            baslat
        );

    }
    else {

        baslat();

    }


    /* =====================================================
       GLOBAL API
    ===================================================== */

    window.TMS19DataUI = {

        getEmployees:
            function () {
                return mevcutVeri;
            },

        getImportResult:
            function () {
                return sonImport;
            },

        reload:
            baslat

    };


})(window);
