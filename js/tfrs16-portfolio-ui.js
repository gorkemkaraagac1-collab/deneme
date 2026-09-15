/*
 * TFRS16 UI slice: read-only portfolio table.
 *
 * This module owns the contracts list markup, search/filter rendering and
 * pagination. Calculation, private API hydration and detail actions remain
 * behind window.GK_TFRS16's narrow read-only bridge.
 */
(() => {
  "use strict";

  const PAGE_SIZE = 50;
  let currentPage = 1;

  function api() {
    return window.GK_TFRS16 || {};
  }

  function contracts() {
    const rows = api().getPortfolioContracts;
    return typeof rows === "function" ? rows() : [];
  }

  function renderPagination(tbody, totalRows, totalPages) {
    let container = document.getElementById("paginationContainer");
    if (!container) {
      container = document.createElement("div");
      container.id = "paginationContainer";
      const table = tbody.closest("table");
      const parent = table?.parentNode || tbody.parentNode;
      parent.insertBefore(container, table ? table.nextSibling : null);
    }
    if (totalRows <= PAGE_SIZE) {
      container.innerHTML = "";
      return;
    }
    container.innerHTML = `
      <div style="display:flex;gap:10px;align-items:center;justify-content:center;padding:10px;">
        <button type="button" class="secondary-button" data-page-nav="prev" ${currentPage <= 1 ? "disabled" : ""}>← Önceki</button>
        <span>${currentPage} / ${totalPages} (${totalRows} kayıt)</span>
        <button type="button" class="secondary-button" data-page-nav="next" ${currentPage >= totalPages ? "disabled" : ""}>Sonraki →</button>
      </div>`;
    container.querySelector('[data-page-nav="prev"]')?.addEventListener("click", () => {
      if (currentPage > 1) { currentPage -= 1; renderTable({ resetPage: false }); }
    });
    container.querySelector('[data-page-nav="next"]')?.addEventListener("click", () => {
      if (currentPage < totalPages) { currentPage += 1; renderTable({ resetPage: false }); }
    });
  }

  function renderTable(renderOptions = {}) {
    const tbody = document.getElementById("contractsTableBody") || document.getElementById("contractTableBody");
    if (!tbody) return;
    if (renderOptions?.resetPage !== false) currentPage = 1;

    const search = String(document.getElementById("searchInput")?.value || "").trim().toLowerCase();
    const status = document.getElementById("statusFilter")?.value || "all";
    const company = document.getElementById("companyFilter")?.value || "all";
    const helper = api();
    const filtered = contracts().filter(contract => {
      const searchable = `${contract.id || ""} ${contract.company || ""} ${contract.supplier || ""}`.toLowerCase();
      return (!search || searchable.includes(search)) &&
        (status === "all" || contract.status === status) &&
        (company === "all" || contract.company === company) &&
        (typeof helper.v26ContractMatchesActiveCompany !== "function" || helper.v26ContractMatchesActiveCompany(contract));
    });

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;
    const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    const esc = typeof helper.escapeHtml === "function" ? helper.escapeHtml : value => String(value ?? "");
    const date = typeof helper.formatDate === "function" ? helper.formatDate : value => String(value ?? "");
    const amount = typeof helper.formatPortfolioAmount === "function"
      ? helper.formatPortfolioAmount
      : value => String(value ?? "");
    const renewalCheck = typeof helper.isRenewalWithin90Days === "function" ? helper.isRenewalWithin90Days : () => false;
    const badge = typeof helper.v26StandardsBadgeHtml === "function" ? helper.v26StandardsBadgeHtml : () => "";

    const fragment = document.createDocumentFragment();
    rows.forEach(contract => {
      const renewal = renewalCheck(contract);
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><div class="contract-id">${esc(contract.id)}</div></td>
        <td>${esc(contract.company)}<div style="margin-top:4px;">${badge(contract)}<span style="font-size:10px;color:#64748b;margin-left:4px;">${esc(String(contract.currency || "Para birimi eksik/geçersiz").toUpperCase())}</span></div></td>
        <td><div class="supplier">${esc(contract.supplier)}</div></td>
        <td class="date">${date(contract.startDate)}</td>
        <td class="date">${date(contract.endDate)}</td>
        <td>${amount(contract.monthlyPayment, contract.currency, contract.currency)}</td>
        <td><span>${esc(String(contract.currency || "Para birimi eksik/geçersiz").toUpperCase())}</span></td>
        <td><span class="status ${esc(contract.status)}">${contract.status === "active" ? "Aktif" : "Pasif"}</span></td>
        <td><span class="${renewal ? "renewal-warning" : ""}">${date(contract.renewalDate)}${renewal ? " ⚠" : ""}</span></td>
        <td><button class="row-action" type="button" data-id="${esc(contract.id)}">Görüntüle</button></td>`;
      row.querySelector(".row-action")?.addEventListener("click", () => {
        if (typeof helper.openDetail === "function") helper.openDetail(contract.id);
      });
      fragment.appendChild(row);
    });
    tbody.innerHTML = "";
    tbody.appendChild(fragment);
    const resultCount = document.getElementById("resultCount");
    if (resultCount) resultCount.textContent = `${filtered.length} kayıt`;
    document.getElementById("emptyState")?.classList.toggle("hidden", filtered.length > 0);
    renderPagination(tbody, filtered.length, totalPages);
  }

  function init() {
    renderTable();
  }

  window.LeaseQantTfrs16PortfolioUi = { init, renderTable };
  init();
})();
