// ============================================================
// ADMIN PANEL - BACKEND ENTEGRATION
// ============================================================

/*

* ============================================================
* API CONFIGURATION
* ============================================================
* Frontend:
* GitHub Pages
* Backend:
* Cloud Run
* Relative “/api/…” kullanmıyoruz.
    */

const API_BASE_URL =
    "https://deneme-git-285469227510.europe-west1.run.app";

const AdminAPI = {

/*
 * Backend admin API
 */
baseURL:
    `${API_BASE_URL}/api/admin`,
/*
 * ========================================================
 * AUTH HEADERS
 * ========================================================
 */
getHeaders() {
    const token =
        localStorage.getItem("access_token");
    return {
        "Content-Type":
            "application/json",
        ...(token
            ? {
                "Authorization":
                    `Bearer ${token}`
            }
            : {})
    };
},
/*
 * ========================================================
 * DASHBOARD
 * ========================================================
 */
async getDashboard() {
    const response =
        await fetch(
            `${this.baseURL}/dashboard`,
            {
                method: "GET",
                headers: this.getHeaders()
            }
        );
    return response.json();
},
/*
 * ========================================================
 * COMPANIES
 * ========================================================
 */
async getCompanies(params = {}) {
    const query =
        new URLSearchParams(params)
            .toString();
    const url =
        query
            ? `${this.baseURL}/companies?${query}`
            : `${this.baseURL}/companies`;
    const response =
        await fetch(
            url,
            {
                method: "GET",
                headers: this.getHeaders()
            }
        );
    return response.json();
},
async updateCompanyStatus(id, status) {
    const response =
        await fetch(
            `${this.baseURL}/companies/${encodeURIComponent(id)}/status`,
            {
                method: "PATCH",
                headers: this.getHeaders(),
                body: JSON.stringify({ status })
            }
        );
    return response.json();
},
/*
 * ========================================================
 * TFRS16 CUSTOMERS (drill-down)
 * ========================================================
 */
async getTfrs16Customers() {
    const response =
        await fetch(
            `${this.baseURL}/tfrs16/customers`,
            {
                method: "GET",
                headers: this.getHeaders()
            }
        );
    return response.json();
},
async createCompany(data) {
    const response =
        await fetch(
            `${this.baseURL}/companies`,
            {
                method: "POST",
                headers:
                    this.getHeaders(),
                body:
                    JSON.stringify(data)
            }
        );
    return response.json();
},
async getCompany(id) {
    const response =
        await fetch(
            `${this.baseURL}/companies/${encodeURIComponent(id)}`,
            {
                method: "GET",
                headers: this.getHeaders()
            }
        );
    return response.json();
},
/*
 * ========================================================
 * USERS
 * ========================================================
 */
async getUsers(params = {}) {
    const query =
        new URLSearchParams(params)
            .toString();
    const url =
        query
            ? `${this.baseURL}/users?${query}`
            : `${this.baseURL}/users`;
    const response =
        await fetch(
            url,
            {
                method: "GET",
                headers: this.getHeaders()
            }
        );
    return response.json();
},
async createUser(data) {
    const response =
        await fetch(
            `${this.baseURL}/users`,
            {
                method: "POST",
                headers:
                    this.getHeaders(),
                body:
                    JSON.stringify(data)
            }
        );
    return response.json();
},
async updateUser(id, data) {
    const response =
        await fetch(
            `${this.baseURL}/users/${encodeURIComponent(id)}`,
            {
                method: "PATCH",
                headers:
                    this.getHeaders(),
                body:
                    JSON.stringify(data)
            }
        );
    return response.json();
},
async resetUserPassword(id, newPassword) {
    const response =
        await fetch(
            `${this.baseURL}/users/${encodeURIComponent(id)}/password`,
            {
                method: "PATCH",
                headers:
                    this.getHeaders(),
                body:
                    JSON.stringify({ new_password: newPassword })
            }
        );
    return response.json();
},
/*
 * ========================================================
 * LICENSES
 * ========================================================
 */
async getLicenses() {
    const response =
        await fetch(
            `${this.baseURL}/licenses`,
            {
                method: "GET",
                headers: this.getHeaders()
            }
        );
    return response.json();
},
async getExpiringLicenses(days) {
    const query =
        days
            ? `?days=${encodeURIComponent(days)}`
            : "";
    const response =
        await fetch(
            `${this.baseURL}/licenses/expiring${query}`,
            {
                method: "GET",
                headers: this.getHeaders()
            }
        );
    return response.json();
},
/*
 * ========================================================
 * AUDIT
 * ========================================================
 */
async getAudit(params = {}) {
    const query =
        new URLSearchParams(params)
            .toString();
    const url =
        query
            ? `${this.baseURL}/audit?${query}`
            : `${this.baseURL}/audit`;
    const response =
        await fetch(
            url,
            {
                method: "GET",
                headers: this.getHeaders()
            }
        );
    return response.json();
},
/*
 * ========================================================
 * LICENSES (assign / extend / cancel / plans)
 * ------------------------------------------------------
 * Not: routes/admin-licenses.js diğer admin route'larının
 * aksine { success, data } formatını KULLANMIYOR — sadece
 * { license/plans } ya da { error } döndürüyor. Burada
 * frontend'in geri kalanıyla tutarlı olması için
 * response.ok'a göre { success, data, error } formatına
 * normalize ediyoruz.
 * ========================================================
 */
async getPlans() {
    const response =
        await fetch(
            `${this.baseURL}/plans`,
            {
                method: "GET",
                headers: this.getHeaders()
            }
        );
    const result = await response.json();
    if (!response.ok) {
        return { success: false, error: result.error || "Planlar alınamadı" };
    }
    return { success: true, data: result.plans || [] };
},
async assignLicense(companyId, data) {
    const response =
        await fetch(
            `${this.baseURL}/companies/${encodeURIComponent(companyId)}/license`,
            {
                method: "POST",
                headers: this.getHeaders(),
                body: JSON.stringify(data)
            }
        );
    const result = await response.json();
    if (!response.ok) {
        return { success: false, error: result.error || "Lisans atanamadı" };
    }
    return { success: true, data: result.license, message: result.message };
},
async extendLicense(licenseId, data) {
    const response =
        await fetch(
            `${this.baseURL}/licenses/${encodeURIComponent(licenseId)}/extend`,
            {
                method: "PATCH",
                headers: this.getHeaders(),
                body: JSON.stringify(data)
            }
        );
    const result = await response.json();
    if (!response.ok) {
        return { success: false, error: result.error || "Lisans uzatılamadı" };
    }
    return { success: true, data: result.license, message: result.message };
},
async cancelLicense(licenseId) {
    const response =
        await fetch(
            `${this.baseURL}/licenses/${encodeURIComponent(licenseId)}/cancel`,
            {
                method: "POST",
                headers: this.getHeaders()
            }
        );
    const result = await response.json();
    if (!response.ok) {
        return { success: false, error: result.error || "Lisans iptal edilemedi" };
    }
    return { success: true, data: result.license, message: result.message };
},
async updatePlan(planId, data) {
    const response =
        await fetch(
            `${this.baseURL}/plans/${encodeURIComponent(planId)}`,
            {
                method: "PATCH",
                headers: this.getHeaders(),
                body: JSON.stringify(data)
            }
        );
    const result = await response.json();
    if (!response.ok) {
        return { success: false, error: result.error || "Plan güncellenemedi" };
    }
    return { success: true, data: result };
},
/*
 * ========================================================
 * LICENSE LIMITS (P2 — Custom plan override düzenleme)
 * ------------------------------------------------------
 * PATCH /api/admin/licenses/:licenseId/limits
 * Body: { maxUsersOverride, maxContractsOverride, maxCompaniesOverride }
 * Her alan: undefined = dokunma, null = override'ı temizle
 * (plan'ın kendi değerine dön), number = yeni override.
 * ========================================================
 */
async updateLicenseLimits(licenseId, data) {
    const response =
        await fetch(
            `${this.baseURL}/licenses/${encodeURIComponent(licenseId)}/limits`,
            {
                method: "PATCH",
                headers: this.getHeaders(),
                body: JSON.stringify(data)
            }
        );
    const result = await response.json();
    if (!response.ok) {
        return { success: false, error: result.error || "Lisans limitleri güncellenemedi" };
    }
    return { success: true, data: result.license, message: result.message };
}

};

// ============================================================
// ADMIN AUTH CHECK
// ------------------------------------------------------------
// P2 DÜZELTMESİ: Önceden bu fonksiyon SADECE role === "ADMIN"
// kabul ediyordu — P1 backend'de requireStaffAccess (users/
// companies route'ları) ADMIN'in yanı sıra ACCOUNTANT_MANAGER'a
// da izin verdiği hâlde, frontend bu rolü admin panelinin
// KAPISINDA reddediyordu. Yani ACCOUNTANT_MANAGER, backend'in
// zaten yetkili olduğu users.html/companies.html sayfalarına HİÇ
// giremiyordu.
//
// Artık her sayfa, kendisine hangi rollerin izinli olduğunu
// allowedRoles parametresiyle bildirir (varsayılan: yalnızca
// ADMIN — Licenses/Plans/Audit/Dashboard/TFRS16-Customers gibi
// requireAdmin ile korunan sayfalar için mevcut davranış aynen
// korunur, hiçbir şey değişmez).
//
// GÜVENLİK NOTU (mevcut): bu hâlâ yalnızca bir UX/görünürlük
// katmanıdır. Gerçek yetki sınırı backend'deki requireAdmin/
// requireStaffAccess'tir — buradaki kontrol sadece yanlış role
// sahip bir kullanıcıyı, zaten 403 alacağı bir sayfada
// "Loading..." ekranında sonsuza kadar bekletmemek içindir.
// ============================================================

async function checkAdminAuth(allowedRoles) {

const roles = Array.isArray(allowedRoles) && allowedRoles.length > 0
    ? allowedRoles
    : ["ADMIN"];

const token =
    localStorage.getItem(
        "access_token"
    );
/*
 * Token yok
 */
if (!token) {
    window.location.href =
        "../login.html";
    return false;
}
try {
    /*
     * Backend /me endpoint
     */
    const response =
        await fetch(
            `${API_BASE_URL}/api/auth/me`,
            {
                method: "GET",
                headers: {
                    "Authorization":
                        `Bearer ${token}`
                }
            }
        );
    /*
     * Token geçersiz
     */
    if (!response.ok) {
        localStorage.removeItem(
            "access_token"
        );
        localStorage.removeItem(
            "current_user"
        );
        window.location.href =
            "../login.html";
        return false;
    }
    const result =
        await response.json();
    /*
     * Backend response formatını
     * kontrollü şekilde ele al.
     *
     * Öncelik:
     *
     * result.data (GET /me gerçek formatı)
     *
     * fallback:
     *
     * result.user
     */
    const user =
        result.data ||
        result.user;

    if (!user) {
        window.location.href =
            "../login.html";
        return false;
    }

    /*
     * P1-D — MUST CHANGE PASSWORD: kullanıcı normal admin
     * panelini kullanamadan önce parolasını değiştirmek
     * zorunda. change-password.html kendisi checkAdminAuth
     * ÇAĞIRMAZ (aksi halde sonsuz yönlendirme döngüsü olur) —
     * bkz. o dosyadaki ayrı, hafif auth kontrolü.
     */
    if (user.mustChangePassword) {
        window.location.href =
            "change-password.html";
        return false;
    }

    if (!roles.includes(user.role)) {
        /*
         * ACCOUNTANT_MANAGER: kendi erişebildiği bir sayfaya
         * (Users) yönlendir. Diğer roller (ACCOUNTANT/
         * CONTROLLER/VIEWER) zaten admin panelinde hiçbir
         * sayfaya erişemez — müşteri dashboard'una gönderilir.
         */
        window.location.href =
            user.role === "ACCOUNTANT_MANAGER"
                ? "users.html"
                : "../dashboard.html";
        return false;
    }

    /*
     * Header kullanıcı adı — Ad + Soyad varsa onu, yoksa
     * güvenli fallback olarak username'i göster (P0: legacy
     * kullanıcılarda first_name/last_name NULL olabilir).
     */
    const usernameElement =
        document.getElementById(
            "adminUsername"
        );
    if (usernameElement) {
        const fullName = [user.firstName, user.lastName]
            .filter(part => typeof part === "string" && part.trim())
            .join(" ");
        usernameElement.textContent =
            fullName || user.username || "";
    }

    /*
     * Sayfada "Hoş geldiniz, ..." metni göstermek isteyen bir
     * element varsa (id="adminWelcome") doldur. Yoksa sessizce
     * atlanır — sayfa yapısını değiştirmeye gerek yok.
     */
    const welcomeElement =
        document.getElementById("adminWelcome");
    if (welcomeElement) {
        const fullName = [user.firstName, user.lastName]
            .filter(part => typeof part === "string" && part.trim())
            .join(" ");
        welcomeElement.textContent = fullName
            ? `Hoş geldiniz, ${fullName}`
            : "Hoş geldiniz";
    }

    /*
     * Rol rozeti — önceden HTML'de sabit "ADMIN" yazıyordu;
     * artık gerçek role göre dinamik.
     */
    const roleBadgeElement =
        document.querySelector(".role-badge");
    if (roleBadgeElement) {
        roleBadgeElement.textContent = user.role || "";
    }

    /*
     * P2: ACCOUNTANT_MANAGER, backend'de requireAdmin (ADMIN-only)
     * ile korunan sayfalara (Licenses/Plans/Audit/Dashboard/
     * TFRS16 Customers) erişemez — bu linkleri sidebar'dan
     * gizliyoruz ki tıklayıp 403 ile karşılaşmasın. data-admin-only
     * attribute'u olan linkler bu kapsamdadır (bkz. sidebar HTML).
     */
    if (user.role !== "ADMIN") {
        document
            .querySelectorAll("[data-admin-only]")
            .forEach(el => { el.style.display = "none"; });
    }

    /*
     * Local user cache
     */
    localStorage.setItem(
        "current_user",
        JSON.stringify(user)
    );
    return true;
} catch (error) {
    console.error(
        "Admin auth check error:",
        error
    );
    localStorage.removeItem(
        "access_token"
    );
    localStorage.removeItem(
        "current_user"
    );
    window.location.href =
        "../login.html";
    return false;
}

}

// ============================================================
// STANDART BACKEND HATA KODLARI → KULLANICI DOSTU MESAJ
// ------------------------------------------------------------
// admin.js'in çeşitli endpoint'leri {error, code} formatında
// hata döndürür (bkz. routes/admin.js, admin-licenses.js).
// Önceden frontend her yerde ham result.error metnini
// gösteriyordu — bu genelde İngilizce/teknik bir cümleydi.
// Bilinen code'lar için daha anlaşılır bir Türkçe karşılık
// veriyoruz; bilinmeyen code'larda backend'in kendi error
// metnine (fallback) düşüyoruz — mesaj UYDURULMUYOR.
// ============================================================

const ADMIN_ERROR_CODE_MESSAGES = {
    LICENSE_EXPIRED: "Şirketin aktif lisansı bulunmuyor veya süresi dolmuş.",
    COMPANY_LICENSE_INACTIVE: "Şirketin aktif lisansı bulunmuyor veya süresi dolmuş.",
    FORBIDDEN: "Bu işlem için yetkiniz bulunmuyor.",
    STAFF_ACCESS_REQUIRED: "Bu işlem için ADMIN veya ACCOUNTANT_MANAGER yetkisi gereklidir.",
    ADMIN_REQUIRED: "Bu işlem için ADMIN yetkisi gereklidir.",
    ROLE_ASSIGNMENT_FORBIDDEN: "Bu role sahip bir kullanıcı, seçtiğiniz rolü oluşturamaz.",
    COMPANY_ACCESS_DENIED: "Bu şirkete erişim/işlem yetkiniz bulunmuyor.",
    PARENT_COMPANY_REQUIRED: "Kendi holding ağacınıza alt şirket eklerken üst şirket (parent) seçmeniz zorunludur.",
    MUST_CHANGE_PASSWORD: "Devam etmeden önce parolanızı değiştirmeniz gerekiyor.",
    MAX_USERS_REACHED: "Şirket, lisansının izin verdiği maksimum kullanıcı sayısına ulaşmış.",
    MAX_CONTRACTS_REACHED: "Şirket, lisansının izin verdiği maksimum sözleşme sayısına ulaşmış.",
    MAX_COMPANIES_REACHED: "Holding ağacı, lisansının izin verdiği maksimum şirket sayısına ulaşmış.",
    NO_ACTIVE_LICENSE: "Bu holding ağacının aktif bir lisansı yok."
};

function describeApiError(result, fallback) {
    if (!result) return fallback || "Bilinmeyen bir hata oluştu.";
    if (result.code && ADMIN_ERROR_CODE_MESSAGES[result.code]) {
        return ADMIN_ERROR_CODE_MESSAGES[result.code];
    }
    return result.error || fallback || "Bilinmeyen bir hata oluştu.";
}

// ============================================================
// UI HELPERS
// ============================================================

function formatDate(dateStr) {

if (!dateStr) {
    return "-";
}
const d =
    new Date(dateStr);
return (
    d.toLocaleDateString(
        "tr-TR"
    )
    +
    " "
    +
    d.toLocaleTimeString(
        "tr-TR",
        {
            hour: "2-digit",
            minute: "2-digit"
        }
    )
);

}

function formatDateShort(dateStr) {

if (!dateStr) {
    return "-";
}
const d =
    new Date(dateStr);
return d.toLocaleDateString(
    "tr-TR"
);

}

function getStatusBadge(status) {

const map = {
    ACTIVE:
        "badge-active",
    INACTIVE:
        "badge-inactive",
    PENDING:
        "badge-pending",
    EXPIRED:
        "badge-expired"
};
return `
    <span class="badge ${map[status] || "badge-inactive"}">
        ${status || "UNKNOWN"}
    </span>
`;

}

// ============================================================
// PAGINATION HELPER
// ------------------------------------------------------------
// companies.html ve users.html tarafından ortak kullanılır.
// pagination: { total, limit, offset } (bkz. admin.js backend
// route'larının döndürdüğü format).
// ============================================================

function renderPagination(pagination, onPageChange) {

    if (!pagination || !pagination.total) {
        return "";
    }

    const { total, limit, offset } = pagination;
    const currentPage = Math.floor(offset / limit) + 1;
    const totalPages = Math.max(Math.ceil(total / limit), 1);

    if (totalPages <= 1) {
        return `<div class="pagination-info">${total} sonuç</div>`;
    }

    window._paginationOnPageChange = onPageChange;

    const prevOffset = Math.max(offset - limit, 0);
    const nextOffset = offset + limit;
    const prevDisabled = offset <= 0 ? "disabled" : "";
    const nextDisabled = offset + limit >= total ? "disabled" : "";

    return `
        <div class="pagination">
            <span class="pagination-info">${total} sonuçtan ${offset + 1}-${Math.min(offset + limit, total)} arası</span>
            <div class="pagination-controls">
                <button class="btn btn-sm btn-outline" ${prevDisabled} onclick="window._paginationOnPageChange(${prevOffset})">‹ Prev</button>
                <span class="pagination-page">Sayfa ${currentPage} / ${totalPages}</span>
                <button class="btn btn-sm btn-outline" ${nextDisabled} onclick="window._paginationOnPageChange(${nextOffset})">Next ›</button>
            </div>
        </div>
    `;
}

// Basit debounce — arama kutusu her tuş vuruşunda değil, yazma
// durduktan bir süre sonra istek atar.
function debounce(fn, delayMs) {
    let timer = null;
    return function debounced(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delayMs);
    };
}

function showModal(title, content) {

const overlay =
    document.getElementById(
        "modalOverlay"
    );
document.getElementById(
    "modalTitle"
).textContent = title;
document.getElementById(
    "modalBody"
).innerHTML = content;
overlay.classList.add(
    "active"
);

}

function closeModal() {

document
    .getElementById(
        "modalOverlay"
    )
    .classList.remove(
        "active"
    );

}

function escapeHtml(text) {

if (!text) {
    return "";
}
const div =
    document.createElement(
        "div"
    );
div.textContent =
    text;
return div.innerHTML;

}

// ============================================================
// LOGOUT
// ============================================================

function logout() {

localStorage.removeItem(
    "access_token"
);
localStorage.removeItem(
    "current_user"
);
window.location.href =
    "../login.html";

}

// ============================================================
// MOBILE NAV (hamburger + overlay)
// ------------------------------------------------------------
// Sidebar CSS zaten mobilde .sidebar'ı translateX(-100%) ile
// gizliyordu ama hiçbir sayfada onu açacak bir buton yoktu, bu
// yüzden telefonda sidebar'a hiç erişilemiyordu. Bunu tüm admin
// sayfalarında merkezi olarak (her HTML dosyasını tek tek
// değiştirmeden) çözüyoruz.
// ============================================================

function initMobileNav() {

    const sidebar = document.getElementById("sidebar");
    const header = document.querySelector(".top-header");
    if (!sidebar || !header) return;

    // Overlay (bir kere)
    let overlay = document.getElementById("sidebarOverlay");
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "sidebarOverlay";
        overlay.className = "sidebar-overlay";
        document.body.appendChild(overlay);
    }

    // Hamburger butonu (bir kere)
    let toggle = document.getElementById("menuToggle");
    if (!toggle) {
        toggle = document.createElement("button");
        toggle.id = "menuToggle";
        toggle.className = "menu-toggle";
        toggle.type = "button";
        toggle.setAttribute("aria-label", "Menüyü aç/kapat");
        toggle.textContent = "☰";
        header.insertBefore(toggle, header.firstChild);
    }

    function openSidebar() {
        sidebar.classList.add("open");
        overlay.classList.add("active");
    }

    function closeSidebar() {
        sidebar.classList.remove("open");
        overlay.classList.remove("active");
    }

    toggle.addEventListener("click", () => {
        if (sidebar.classList.contains("open")) {
            closeSidebar();
        } else {
            openSidebar();
        }
    });

    overlay.addEventListener("click", closeSidebar);

    // Bir linke tıklanınca kapat (sayfa değişse bile temiz olsun)
    sidebar.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", closeSidebar);
    });
}

document.addEventListener("DOMContentLoaded", initMobileNav);

// ============================================================
// SHARED: ASSIGN / MANAGE LICENSE MODAL
// ------------------------------------------------------------
// licenses.html ve companies.html tarafından ortak kullanılır.
// ============================================================

let _assignLicenseSubmitting = false;

function buildAssignLicenseFormHtml(companies, plans, preselectedCompanyId) {

    const companyOptions = (companies || []).map(c => `
        <option value="${c.id}" ${c.id === preselectedCompanyId ? "selected" : ""}>
            ${escapeHtml(c.name)} (${escapeHtml(c.code)})
        </option>
    `).join("");

    const planOptions = (plans || []).map(p => `
        <option value="${p.id}">
            ${escapeHtml(p.name)}${p.max_users ? " — max " + p.max_users + " kullanıcı" : ""}
        </option>
    `).join("");

    const today = new Date().toISOString().slice(0, 10);

    /*
     * P2 — CUSTOM PLAN: Custom plan'ın kendi limitleri yoktur
     * (plans.custom satırı bilinçli olarak NULL/NULL/NULL) — gerçek
     * limitler bu lisansa özel override alanlarına yazılır (bkz.
     * db/init.sql P0 yorumu, admin-licenses.js POST .../license).
     * "Custom" seçildiğinde bu alanları göster; diğer planlarda
     * (Starter/Professional/Enterprise) gizli kalır — onlarda limit
     * zaten plandan gelir, override GENELDE gerekmez ama backend
     * yine de kabul eder (advanced kullanım — burada UI'yı sade
     * tutmak için sadece Custom'da gösteriyoruz).
     */
    return `
        <form id="assignLicenseForm" onsubmit="submitAssignLicense(event)">
            <div class="form-group">
                <label>Company *</label>
                <select name="company_id" required>${companyOptions}</select>
            </div>
            <div class="form-group">
                <label>Plan *</label>
                <select name="plan_id" required onchange="onAssignLicensePlanChange(this.value)">${planOptions}</select>
            </div>
            <div class="form-group">
                <label>Start Date</label>
                <input type="date" name="starts_at" value="${today}">
            </div>
            <div class="form-group">
                <label>Expiry Date</label>
                <input type="date" name="expires_at">
                <small style="color:var(--text-light);">Boş bırakılırsa süresiz lisans oluşturulur.</small>
            </div>
            <div id="assignLicenseCustomLimits" style="display:none; border-top:1px solid var(--border); margin-top:8px; padding-top:8px;">
                <p style="font-size:13px; color:var(--text-light); margin-bottom:8px;">
                    Custom plan — limitleri buradan tanımlayın. Boş bırakmak <strong>sınırsız</strong> anlamına gelir.
                </p>
                <div class="form-group">
                    <label>Max Users</label>
                    <input type="number" name="max_users_override" min="1" step="1" placeholder="sınırsız">
                </div>
                <div class="form-group">
                    <label>Max Contracts</label>
                    <input type="number" name="max_contracts_override" min="1" step="1" placeholder="sınırsız">
                </div>
                <div class="form-group">
                    <label>Max Companies</label>
                    <input type="number" name="max_companies_override" min="1" step="1" placeholder="sınırsız">
                </div>
            </div>
            <div id="assignLicenseError" style="color:var(--danger); margin-bottom:12px; display:none;"></div>
            <div class="modal-footer">
                <button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary" id="assignLicenseSubmitBtn">Assign License</button>
            </div>
        </form>
    `;
}

function onAssignLicensePlanChange(planId) {
    const box = document.getElementById("assignLicenseCustomLimits");
    if (box) {
        box.style.display = planId === "custom" ? "block" : "none";
    }
}

function parseOptionalPositiveInt(rawValue) {
    const trimmed = (rawValue || "").trim();
    if (trimmed === "") return undefined;
    const parsed = parseInt(trimmed, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
}

function showAssignLicenseModal(companies, plans, preselectedCompanyId, onSuccess) {

    if (!plans || plans.length === 0) {
        alert("Atanabilecek bir plan bulunamadı. Önce backend tarafında bir plan tanımlanmalı.");
        return;
    }
    if (!companies || companies.length === 0) {
        alert("Önce en az bir şirket oluşturmalısınız.");
        return;
    }

    window._onLicenseAssigned = onSuccess;
    showModal(
        "Assign License",
        buildAssignLicenseFormHtml(companies, plans, preselectedCompanyId)
    );
}

async function submitAssignLicense(event) {

    event.preventDefault();
    if (_assignLicenseSubmitting) return;

    const form = event.target;
    const errorDiv = document.getElementById("assignLicenseError");
    const submitBtn = document.getElementById("assignLicenseSubmitBtn");

    _assignLicenseSubmitting = true;
    submitBtn.disabled = true;
    submitBtn.textContent = "Saving...";
    errorDiv.style.display = "none";

    const companyId = form.company_id.value;
    const planId = form.plan_id.value;
    const data = {
        planId,
        startsAt: form.starts_at.value || undefined,
        expiresAt: form.expires_at.value || null
    };

    /*
     * Custom plan seçiliyse override alanlarını da gönder. Diğer
     * planlarda bu alanlar formda gizli/etkisiz olduğundan
     * gönderilmiyor (backend zaten undefined = "dokunma" olarak
     * yorumluyor, ama Custom dışı bir planda override göndermek
     * kafa karıştırıcı olur).
     */
    if (planId === "custom") {
        data.maxUsersOverride = parseOptionalPositiveInt(form.max_users_override?.value);
        data.maxContractsOverride = parseOptionalPositiveInt(form.max_contracts_override?.value);
        data.maxCompaniesOverride = parseOptionalPositiveInt(form.max_companies_override?.value);
    }

    try {
        const result = await AdminAPI.assignLicense(companyId, data);
        if (result.success) {
            closeModal();
            if (typeof window._onLicenseAssigned === "function") {
                window._onLicenseAssigned();
            }
        } else {
            errorDiv.textContent = "Hata: " + describeApiError(result);
            errorDiv.style.display = "block";
        }
    } catch (error) {
        errorDiv.textContent = "Hata: " + error.message;
        errorDiv.style.display = "block";
    } finally {
        _assignLicenseSubmitting = false;
        submitBtn.disabled = false;
        submitBtn.textContent = "Assign License";
    }
}
