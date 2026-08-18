document.addEventListener("DOMContentLoaded", () => {

    /*
    =====================================================
    TFRS 16 - CONTRACT PORTFOLIO ENGINE
    =====================================================
    */

    const STORAGE_KEY = "gk_tfrs16_contracts";

    let contracts = loadContracts();

    let editingContractId = null;
    let selectedContractId = null;


    /*
    =====================================================
    DOM ELEMENTS
    =====================================================
    */

    const elements = {

        contractCount:
            document.getElementById("contractCount"),

        leaseLiability:
            document.getElementById("leaseLiability"),

        rouAssets:
            document.getElementById("rouAssets"),

        next12Months:
            document.getElementById("next12Months"),

        renewals90Days:
            document.getElementById("renewals90Days"),

        modifications:
            document.getElementById("modifications"),

        searchInput:
            document.getElementById("searchInput"),

        statusFilter:
            document.getElementById("statusFilter"),

        companyFilter:
            document.getElementById("companyFilter"),

        contractTableBody:
            document.getElementById("contractTableBody"),

        resultCount:
            document.getElementById("resultCount"),

        emptyState:
            document.getElementById("emptyState"),

        contractModal:
            document.getElementById("contractModal"),

        detailModal:
            document.getElementById("detailModal"),

        contractForm:
            document.getElementById("contractForm")

    };


    /*
    =====================================================
    INITIALIZE
    =====================================================
    */

    initialize();


    function initialize() {

        bindEvents();

        renderCompanyFilter();

        renderPortfolio();

        updateKPIs();

    }


    /*
    =====================================================
    EVENTS
    =====================================================
    */

    function bindEvents() {

        document
            .getElementById("newContractButton")
            ?.addEventListener(
                "click",
                openNewContractModal
            );


        document
            .getElementById("closeModal")
            ?.addEventListener(
                "click",
                closeContractModal
            );


        document
            .getElementById("cancelModal")
            ?.addEventListener(
                "click",
                closeContractModal
            );


        document
            .getElementById("closeDetailModal")
            ?.addEventListener(
                "click",
                closeDetailModal
            );


        document
            .getElementById("detailCloseButton")
            ?.addEventListener(
                "click",
                closeDetailModal
            );


        elements.contractForm
            ?.addEventListener(
                "submit",
                saveContract
            );


        elements.searchInput
            ?.addEventListener(
                "input",
                renderPortfolio
            );


        elements.statusFilter
            ?.addEventListener(
                "change",
                renderPortfolio
            );


        elements.companyFilter
            ?.addEventListener(
                "change",
                renderPortfolio
            );


        document
            .getElementById("deleteContract")
            ?.addEventListener(
                "click",
                deleteSelectedContract
            );


        /*
        Close modal when clicking outside
        */

        elements.contractModal
            ?.addEventListener(
                "click",
                event => {

                    if (
                        event.target ===
                        elements.contractModal
                    ) {

                        closeContractModal();

                    }

                }
            );


        elements.detailModal
            ?.addEventListener(
                "click",
                event => {

                    if (
                        event.target ===
                        elements.detailModal
                    ) {

                        closeDetailModal();

                    }

                }
            );

    }


    /*
    =====================================================
    LOAD DATA
    =====================================================
    */

    function loadContracts() {

        try {

            const stored =
                localStorage.getItem(
                    STORAGE_KEY
                );


            if (stored) {

                const parsed =
                    JSON.parse(stored);


                if (
                    Array.isArray(parsed) &&
                    parsed.length > 0
                ) {

                    return parsed;

                }

            }

        } catch (error) {

            console.error(
                "TFRS 16 localStorage okunamadı:",
                error
            );

        }


        return getDemoContracts();

    }


    /*
    =====================================================
    DEMO CONTRACTS
    =====================================================
    */

    function getDemoContracts() {

        return [

            {
                id: "LEASE-001",

                company: "GK Holding",

                supplier: "ABC Gayrimenkul",

                startDate: "2024-01-01",

                endDate: "2028-12-31",

                monthlyPayment: 250000,

                discountRate: 18,

                renewalDate: "2027-12-31",

                status: "active",

                modification: false

            },


            {
                id: "LEASE-002",

                company: "GK Holding",

                supplier: "XYZ Plaza",

                startDate: "2025-01-01",

                endDate: "2030-12-31",

                monthlyPayment: 180000,

                discountRate: 17,

                renewalDate: "2026-11-30",

                status: "active",

                modification: false

            },


            {
                id: "LEASE-003",

                company: "GK Holding",

                supplier: "Delta Logistics",

                startDate: "2023-07-01",

                endDate: "2027-06-30",

                monthlyPayment: 120000,

                discountRate: 19,

                renewalDate: "2027-03-31",

                status: "active",

                modification: false

            }

        ];

    }


    /*
    =====================================================
    SAVE STORAGE
    =====================================================
    */

    function persist() {

        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(contracts)
        );

    }


    /*
    =====================================================
    RENDER COMPANY FILTER
    =====================================================
    */

    function renderCompanyFilter() {

        if (!elements.companyFilter) {
            return;
        }


        const companies =
            [
                ...new Set(
                    contracts.map(
                        contract =>
                            contract.company
                    )
                )
            ]
            .sort();


        elements.companyFilter.innerHTML =
            `
                <option value="all">
                    Tüm Şirketler
                </option>
            `;


        companies.forEach(
            company => {

                const option =
                    document.createElement(
                        "option"
                    );

                option.value = company;

                option.textContent = company;

                elements.companyFilter
                    .appendChild(option);

            }
        );

    }


    /*
    =====================================================
    FILTER
    =====================================================
    */

    function getFilteredContracts() {

        const search =
            (
                elements.searchInput
                    ?.value || ""
            )
            .toLowerCase()
            .trim();


        const status =
            elements.statusFilter
                ?.value || "all";


        const company =
            elements.companyFilter
                ?.value || "all";


        return contracts.filter(
            contract => {

                const searchableText = [

                    contract.id,

                    contract.company,

                    contract.supplier

                ]
                .join(" ")
                .toLowerCase();


                const matchesSearch =
                    !search ||
                    searchableText.includes(
                        search
                    );


                const matchesStatus =
                    status === "all" ||
                    contract.status === status;


                const matchesCompany =
                    company === "all" ||
                    contract.company === company;


                return (
                    matchesSearch &&
                    matchesStatus &&
                    matchesCompany
                );

            }
        );

    }


    /*
    =====================================================
    RENDER TABLE
    =====================================================
    */

    function renderPortfolio() {

        const filtered =
            getFilteredContracts();


        elements.contractTableBody.innerHTML =
            "";


        elements.resultCount.textContent =
            `${filtered.length} kayıt`;


        if (!filtered.length) {

            elements.emptyState
                .classList
                .remove("hidden");

            return;

        }


        elements.emptyState
            .classList
            .add("hidden");


        filtered.forEach(
            contract => {

                const row =
                    document.createElement(
                        "tr"
                    );


                row.innerHTML = `

                    <td>
                        <strong>
                            ${escapeHTML(contract.id)}
                        </strong>
                    </td>

                    <td>
                        ${escapeHTML(contract.company)}
                    </td>

                    <td>
                        ${escapeHTML(contract.supplier)}
                    </td>

                    <td>
                        ${formatDate(
                            contract.startDate
                        )}
                    </td>

                    <td>
                        ${formatDate(
                            contract.endDate
                        )}
                    </td>

                    <td>
                        ${formatMoney(
                            contract.monthlyPayment
                        )}
                    </td>

                    <td>
                        <span class="
                            status-badge
                            ${contract.status}
                        ">
                            ${getStatusLabel(
                                contract.status
                            )}
                        </span>
                    </td>

                    <td>
                        ${getRenewalStatus(
                            contract.renewalDate
                        )}
                    </td>

                    <td>

                        <button
                            class="table-action"
                            data-action="view"
                            data-id="${contract.id}"
                        >
                            Görüntüle
                        </button>

                    </td>

                `;


                elements.contractTableBody
                    .appendChild(row);

            }
        );


        bindTableActions();

    }


    /*
    =====================================================
    TABLE ACTIONS
    =====================================================
    */

    function bindTableActions() {

        document
            .querySelectorAll(
                '[data-action="view"]'
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () => {

                            openDetailModal(
                                button.dataset.id
                            );

                        }
                    );

                }
            );

    }


    /*
    =====================================================
    KPI CALCULATIONS
    =====================================================
    */

    function updateKPIs() {

        const activeContracts =
            contracts.filter(
                contract =>
                    contract.status ===
                    "active"
            );


        const totalLeaseLiability =
            activeContracts.reduce(
                (
                    total,
                    contract
                ) => {

                    return (
                        total +
                        calculateLeaseLiability(
                            contract
                        )
                    );

                },
                0
            );


        const totalROU =
            activeContracts.reduce(
                (
                    total,
                    contract
                ) => {

                    return (
                        total +
                        calculateROU(
                            contract
                        )
                    );

                },
                0
            );


        const next12Months =
            activeContracts.reduce(
                (
                    total,
                    contract
                ) => {

                    return (
                        total +
                        calculateNext12Months(
                            contract
                        )
                    );

                },
                0
            );


        const renewals90 =
            activeContracts.filter(
                contract =>
                    isWithin90Days(
                        contract.renewalDate
                    )
            ).length;


        const modifications =
            activeContracts.filter(
                contract =>
                    contract.modification === true
            ).length;


        elements.contractCount.textContent =
            activeContracts.length;


        elements.leaseLiability.textContent =
            formatMoney(
                totalLeaseLiability
            );


        elements.rouAssets.textContent =
            formatMoney(
                totalROU
            );


        elements.next12Months.textContent =
            formatMoney(
                next12Months
            );


        elements.renewals90Days.textContent =
            renewals90;


        elements.modifications.textContent =
            modifications;

    }


    /*
    =====================================================
    TFRS 16 LEASE LIABILITY
    =====================================================
    */

    function calculateLeaseLiability(
        contract
    ) {

        const months =
            calculateLeaseMonths(
                contract.startDate,
                contract.endDate
            );


        const monthlyPayment =
            Number(
                contract.monthlyPayment || 0
            );


        const annualRate =
            Number(
                contract.discountRate || 0
            );


        const monthlyRate =
            annualRate /
            100 /
            12;


        if (
            months <= 0 ||
            monthlyPayment <= 0
        ) {

            return 0;

        }


        if (
            monthlyRate === 0
        ) {

            return (
                monthlyPayment *
                months
            );

        }


        return (
            monthlyPayment *
            (
                1 -
                Math.pow(
                    1 + monthlyRate,
                    -months
                )
            )
            /
            monthlyRate
        );

    }


    /*
    =====================================================
    ROU ASSET
    =====================================================
    */

    function calculateROU(
        contract
    ) {

        const liability =
            calculateLeaseLiability(
                contract
            );


        const initialDirectCosts =
            Number(
                contract.initialDirectCosts ||
                0
            );


        const incentives =
            Number(
                contract.incentives ||
                0
            );


        const prepaidLease =
            Number(
                contract.prepaidLease ||
                0
            );


        return (
            liability +
            initialDirectCosts +
            prepaidLease -
            incentives
        );

    }


    /*
    =====================================================
    NEXT 12 MONTHS
    =====================================================
    */

    function calculateNext12Months(
        contract
    ) {

        const monthlyPayment =
            Number(
                contract.monthlyPayment || 0
            );


        const remainingMonths =
            calculateLeaseMonths(
                contract.startDate,
                contract.endDate
            );


        return (
            monthlyPayment *
            Math.min(
                12,
                Math.max(
                    0,
                    remainingMonths
                )
            )
        );

    }


    /*
    =====================================================
    MONTH CALCULATION
    =====================================================
    */

    function calculateLeaseMonths(
        startDate,
        endDate
    ) {

        const start =
            new Date(startDate);

        const end =
            new Date(endDate);


        if (
            Number.isNaN(
                start.getTime()
            ) ||
            Number.isNaN(
                end.getTime()
            )
        ) {

            return 0;

        }


        return Math.max(
            0,
            (
                (
                    end.getFullYear() -
                    start.getFullYear()
                ) * 12
                +
                (
                    end.getMonth() -
                    start.getMonth()
                )
                + 1
            )
        );

    }


    /*
    =====================================================
    RENEWAL
    =====================================================
    */

    function isWithin90Days(
        renewalDate
    ) {

        if (!renewalDate) {
            return false;
        }


        const today =
            new Date();


        const renewal =
            new Date(
                renewalDate
            );


        const difference =
            renewal.getTime() -
            today.getTime();


        const days =
            difference /
            (
                1000 *
                60 *
                60 *
                24
            );


        return (
            days >= 0 &&
            days <= 90
        );

    }


    function getRenewalStatus(
        renewalDate
    ) {

        if (!renewalDate) {

            return "—";

        }


        if (
            isWithin90Days(
                renewalDate
            )
        ) {

            return `
                <span class="warning-text">
                    ${formatDate(
                        renewalDate
                    )}
                </span>
            `;

        }


        return formatDate(
            renewalDate
        );

    }


    /*
    =====================================================
    NEW CONTRACT
    =====================================================
    */

    function openNewContractModal() {

        editingContractId =
            null;


        elements.contractForm.reset();


        document.getElementById(
            "modalTitle"
        ).textContent =
            "Yeni Sözleşme";


        document.getElementById(
            "company"
        ).value =
            "GK Holding";


        document.getElementById(
            "discountRate"
        ).value =
            "18";


        elements.contractModal
            .classList
            .remove("hidden");

    }


    /*
    =====================================================
    CLOSE CONTRACT MODAL
    =====================================================
    */

    function closeContractModal() {

        elements.contractModal
            .classList
            .add("hidden");

    }


    /*
    =====================================================
    SAVE CONTRACT
    =====================================================
    */

    function saveContract(
        event
    ) {

        event.preventDefault();


        const contract = {

            id:
                document.getElementById(
                    "contractId"
                ).value.trim(),

            company:
                document.getElementById(
                    "company"
                ).value.trim(),

            supplier:
                document.getElementById(
                    "supplier"
                ).value.trim(),

            monthlyPayment:
                Number(
                    document.getElementById(
                        "monthlyPayment"
                    ).value
                ),

            startDate:
                document.getElementById(
                    "startDate"
                ).value,

            endDate:
                document.getElementById(
                    "endDate"
                ).value,

            discountRate:
                Number(
                    document.getElementById(
                        "discountRate"
                    ).value
                ),

            renewalDate:
                document.getElementById(
                    "renewalDate"
                ).value,

            status:
                "active",

            modification:
                false

        };


        if (
            !contract.id ||
            !contract.company ||
            !contract.supplier
        ) {

            alert(
                "Lütfen zorunlu alanları doldurun."
            );

            return;

        }


        if (
            new Date(
                contract.endDate
            ) <
            new Date(
                contract.startDate
            )
        ) {

            alert(
                "Bitiş tarihi başlangıç tarihinden önce olamaz."
            );

            return;

        }


        const duplicate =
            contracts.some(
                existing =>
                    existing.id ===
                    contract.id &&
                    existing.id !==
                    editingContractId
            );


        if (duplicate) {

            alert(
                "Bu Sözleşme ID zaten mevcut."
            );

            return;

        }


        if (editingContractId) {

            contracts =
                contracts.map(
                    existing =>
                        existing.id ===
                        editingContractId
                            ? contract
                            : existing
                );

        } else {

            contracts.push(
                contract
            );

        }


        persist();

        renderCompanyFilter();

        renderPortfolio();

        updateKPIs();

        closeContractModal();


        console.log(
            "TFRS 16 sözleşmesi kaydedildi:",
            contract
        );

    }


    /*
    =====================================================
    DETAIL MODAL
    =====================================================
    */

    function openDetailModal(
        contractId
    ) {

        const contract =
            contracts.find(
                item =>
                    item.id ===
                    contractId
            );


        if (!contract) {
            return;
        }


        selectedContractId =
            contractId;


        const liability =
            calculateLeaseLiability(
                contract
            );


        const rou =
            calculateROU(
                contract
            );


        const months =
            calculateLeaseMonths(
                contract.startDate,
                contract.endDate
            );


        document.getElementById(
            "detailTitle"
        ).textContent =
            contract.id;


        document.getElementById(
            "detailContent"
        ).innerHTML = `

            <div class="detail-grid">

                <div>
                    <span>Şirket</span>
                    <strong>
                        ${escapeHTML(
                            contract.company
                        )}
                    </strong>
                </div>

                <div>
                    <span>Tedarikçi</span>
                    <strong>
                        ${escapeHTML(
                            contract.supplier
                        )}
                    </strong>
                </div>

                <div>
                    <span>Aylık Kira</span>
                    <strong>
                        ${formatMoney(
                            contract.monthlyPayment
                        )}
                    </strong>
                </div>

                <div>
                    <span>İskonto Oranı</span>
                    <strong>
                        %${Number(
                            contract.discountRate
                        ).toLocaleString(
                            "tr-TR",
                            {
                                minimumFractionDigits: 2
                            }
                        )}
                    </strong>
                </div>

                <div>
                    <span>Sözleşme Süresi</span>
                    <strong>
                        ${months} ay
                    </strong>
                </div>

                <div>
                    <span>Kira Yükümlülüğü</span>
                    <strong>
                        ${formatMoney(
                            liability
                        )}
                    </strong>
                </div>

                <div>
                    <span>ROU Varlığı</span>
                    <strong>
                        ${formatMoney(
                            rou
                        )}
                    </strong>
                </div>

                <div>
                    <span>Yenileme Tarihi</span>
                    <strong>
                        ${
                            contract.renewalDate
                                ? formatDate(
                                    contract.renewalDate
                                )
                                : "—"
                        }
                    </strong>
                </div>

            </div>

        `;


        elements.detailModal
            .classList
            .remove("hidden");

    }


    /*
    =====================================================
    CLOSE DETAIL
    =====================================================
    */

    function closeDetailModal() {

        elements.detailModal
            .classList
            .add("hidden");

        selectedContractId =
            null;

    }


    /*
    =====================================================
    DELETE
    =====================================================
    */

    function deleteSelectedContract() {

        if (
            !selectedContractId
        ) {

            return;

        }


        const contract =
            contracts.find(
                item =>
                    item.id ===
                    selectedContractId
            );


        if (!contract) {
            return;
        }


        const confirmed =
            confirm(
                `${contract.id} sözleşmesini silmek istediğinize emin misiniz?`
            );


        if (!confirmed) {
            return;
        }


        contracts =
            contracts.filter(
                item =>
                    item.id !==
                    selectedContractId
            );


        persist();

        renderCompanyFilter();

        renderPortfolio();

        updateKPIs();

        closeDetailModal();

    }


    /*
    =====================================================
    FORMATTERS
    =====================================================
    */

    function formatMoney(
        value
    ) {

        return (
            "₺" +
            Number(
                value || 0
            ).toLocaleString(
                "tr-TR",
                {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                }
            )
        );

    }


    function formatDate(
        value
    ) {

        if (!value) {
            return "—";
        }


        const date =
            new Date(value);


        if (
            Number.isNaN(
                date.getTime()
            )
        ) {

            return value;

        }


        return date.toLocaleDateString(
            "tr-TR"
        );

    }


    function getStatusLabel(
        status
    ) {

        const labels = {

            active:
                "Aktif",

            inactive:
                "Pasif"

        };


        return (
            labels[status] ||
            status
        );

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


    /*
    =====================================================
    EXPOSE ENGINE
    =====================================================
    */

    window.TFRS16_ENGINE = {

        getContracts:
            () => contracts,

        calculateLeaseLiability,

        calculateROU,

        calculateNext12Months,

        calculateLeaseMonths,

        refresh: () => {

            renderPortfolio();

            updateKPIs();

        }

    };


});
