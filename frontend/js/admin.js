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
    "https://api.leaseqant.com";

// Send HttpOnly session cookies on cross-origin API calls while preserving explicit options.
const _nativeFetch = window.fetch.bind(window);
window.fetch = (input, init = {}) => {
  const url = typeof input === "string" ? input : input && input.url;
  if (url && url.startsWith(API_BASE_URL)) return _nativeFetch(input, { ...init, credentials: init.credentials || "include" });
  return _nativeFetch(input, init);
};


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
    const token = localStorage.getItem("access_token") || sessionStorage.getItem("gk_session_token");
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
async getPeriods(params = {}) {
    const query = new URLSearchParams(params).toString();
    const response = await fetch(
        `${this.baseURL}/periods${query ? `?${query}` : ""}`,
        { method: "GET", headers: this.getHeaders() }
    );
    return response.json();
},
async closePeriod(companyId, periodKey) {
    const response = await fetch(`${this.baseURL}/periods/close`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({ companyId, periodKey })
    });
    return response.json();
},
async reopenPeriod(companyId, periodKey) {
    const response = await fetch(`${this.baseURL}/periods/reopen`, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({ companyId, periodKey })
    });
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
},
/*
 * ========================================================
 * INFLATION INDICES (Manuel Endeks Girişi — TÜİK yerine)
 * ------------------------------------------------------
 * GET    /api/admin/inflation-indices?status=&months=
 * POST   /api/admin/inflation-indices          { month, value }
 * POST   /api/admin/inflation-indices/bulk     { text }
 * POST   /api/inflation-indices/sync           { months }
 * PATCH  /api/admin/inflation-indices/:id/verify
 * PATCH  /api/admin/inflation-indices/:id/reject { reason? }
 * ========================================================
 */
async getInflationIndices(params = {}) {
    const query = new URLSearchParams(params).toString();
    const url = query
        ? `${this.baseURL}/inflation-indices?${query}`
        : `${this.baseURL}/inflation-indices`;
    const response = await fetch(url, {
        method: "GET",
        headers: this.getHeaders()
    });
    const result = await response.json();
    if (!response.ok) {
        return { success: false, error: result.error || "Endeks kayıtları alınamadı" };
    }
    return result;
},
async createInflationIndex(month, value) {
    const response = await fetch(
        `${this.baseURL}/inflation-indices`,
        {
            method: "POST",
            headers: this.getHeaders(),
            body: JSON.stringify({ month, value })
        }
    );
    const result = await response.json();
    if (!response.ok) {
        return { success: false, error: result.error || "Endeks kaydı oluşturulamadı" };
    }
    return result;
},
async createInflationIndicesBulk(text) {
    const response = await fetch(
        `${this.baseURL}/inflation-indices/bulk`,
        {
            method: "POST",
            headers: this.getHeaders(),
            body: JSON.stringify({ text })
        }
    );
    const result = await response.json();
    if (!response.ok) {
        return {
            success: false,
            error: result.error || "Toplu endeks girişi başarısız",
            invalid: result.invalid,
            duplicateMonthsInInput: result.duplicateMonthsInInput
        };
    }
    return result;
},
async syncInflationIndices(months) {
    const response = await fetch(
        `${API_BASE_URL}/api/inflation-indices/sync`,
        {
            method: "POST",
            headers: this.getHeaders(),
            body: JSON.stringify({ months })
        }
    );
    const result = await response.json();
    if (!response.ok) {
        return { success: false, error: result.error || "TÜİK senkronizasyonu başarısız" };
    }
    return { success: true, ...result };
},
async verifyInflationIndex(id) {
    const response = await fetch(
        `${this.baseURL}/inflation-indices/${encodeURIComponent(id)}/verify`,
        {
            method: "PATCH",
            headers: this.getHeaders()
        }
    );
    const result = await response.json();
    if (!response.ok) {
        return { success: false, error: result.error || "Endeks doğrulanamadı" };
    }
    return result;
},
async rejectInflationIndex(id, reason) {
    const response = await fetch(
        `${this.baseURL}/inflation-indices/${encodeURIComponent(id)}/reject`,
        {
            method: "PATCH",
            headers: this.getHeaders(),
            body: JSON.stringify(reason ? { reason } : {})
        }
    );
    const result = await response.json();
    if (!response.ok) {
        return { success: false, error: result.error || "Endeks reddedilemedi" };
    }
    return result;
},
/*
 * ========================================================
 * FAQ (SSS) — index.html "Sık sorulanlar" bölümü
 * ------------------------------------------------------
 * GET    /api/admin/faq            (yayınlanmış + taslak, tümü)
 * POST   /api/admin/faq            { question, answer, sortOrder?, isPublished? }
 * PATCH  /api/admin/faq/:id        { question?, answer?, sortOrder?, isPublished? }
 * DELETE /api/admin/faq/:id
 * ========================================================
 */
async getFaqs() {
    const response = await fetch(
        `${this.baseURL}/faq`,
        {
            method: "GET",
            headers: this.getHeaders()
        }
    );
    const result = await response.json();
    if (!response.ok) {
        return { success: false, error: result.error || "SSS listesi alınamadı" };
    }
    return result;
},
async createFaq(data) {
    const response = await fetch(
        `${this.baseURL}/faq`,
        {
            method: "POST",
            headers: this.getHeaders(),
            body: JSON.stringify(data)
        }
    );
    const result = await response.json();
    if (!response.ok) {
        return { success: false, error: result.error || "SSS oluşturulamadı" };
    }
    return result;
},
async updateFaq(id, data) {
    const response = await fetch(
        `${this.baseURL}/faq/${encodeURIComponent(id)}`,
        {
            method: "PATCH",
            headers: this.getHeaders(),
            body: JSON.stringify(data)
        }
    );
    const result = await response.json();
    if (!response.ok) {
        return { success: false, error: result.error || "SSS güncellenemedi" };
    }
    return result;
},
async deleteFaq(id) {
    const response = await fetch(
        `${this.baseURL}/faq/${encodeURIComponent(id)}`,
        {
            method: "DELETE",
            headers: this.getHeaders()
        }
    );
    const result = await response.json();
    if (!response.ok) {
        return { success: false, error: result.error || "SSS silinemedi" };
    }
    return result;
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

const token = localStorage.getItem("access_token") || sessionStorage.getItem("gk_session_token");
/*
 * Token yok
 */
if (!token && !document.cookie.includes("gk_session")) {
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
                    ...(token ? { "Authorization": "Bearer " + token } : {})
                }
            }
        );
    /*
     * Token geçersiz
     */
    if (!response.ok) {
        localStorage.removeItem("access_token");
        sessionStorage.removeItem("gk_session_token");
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
         * sayfaya erişemez — TFRS16 motoruna gönderilir.
         */
        window.location.href =
            user.role === "ACCOUNTANT_MANAGER"
                ? "users.html"
                : "../../tfrs16.html";
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
        roleBadgeElement.textContent = ADMIN_ROLE_LABEL[user.role] || user.role || "";
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
    else if (typeof loadRailBadges === "function") {
        window.__lqRailBadges = loadRailBadges();
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
    localStorage.removeItem("access_token");
        sessionStorage.removeItem("gk_session_token");
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

// Veritabanı lisans durumunu küçük harfle tutar (active/expired/cancelled);
// arayüz büyük harfle karşılaştırır. Yüklemede tek yerden normalize edilir.
function normalizeLicense(license) {
if (!license || typeof license !== "object") return license;
return { ...license, status: String(license.status || "").toUpperCase() };
}

function getStatusBadge(status) {

const map = {
    CANCELLED:
        "badge-expired",
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
// Çağıranların çoğu başlığı escapeHtml ile verir; textContent ile
// yazılınca "&amp;" gibi görünüyordu. Varlıklar çözülüp yine
// textContent ile yazılır (HTML olarak yorumlanmaz).
const titleDecoder = document.createElement("textarea");
titleDecoder.innerHTML = String(title == null ? "" : title);
document.getElementById(
    "modalTitle"
).textContent = titleDecoder.value;
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

async function logout() { await fetch(API_BASE_URL + "/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});

localStorage.removeItem(
    "access_token"
);
localStorage.removeItem(
    "current_user"
);
try { sessionStorage.removeItem("gk_session_token"); } catch (_) {}
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

// ============================================================
// YÖNETİM RAYI (v2) — tüm admin sayfalarında tek, tutarlı menü
// ------------------------------------------------------------
// Her sayfanın kendi <nav class="sidebar"> içeriği farklıydı
// (sıra, eksik bağlantılar, İngilizce etiketler). Burada tek
// kanonik liste ile yeniden kurulur. Yalnızca Şirketler ve
// Kullanıcılar ACCOUNTANT_MANAGER'a açıktır; diğerleri
// data-admin-only ile checkAdminAuth tarafından gizlenir.
// ============================================================
const ADMIN_RAIL_ICON = {
    genel: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    sirket: '<path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/><path d="M16 9h2a2 2 0 0 1 2 2v10"/><path d="M8 7h4M8 11h4M8 15h4M3 21h18"/>',
    kullanici: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    lisans: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M14 9l2 2"/>',
    donem: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    acilis: '<path d="M12 15V3M7 8l5-5 5 5"/><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
    kur: '<path d="M7 4v16M4 9l12-4M4 14l12-4"/><path d="M16 20a4 4 0 0 0 4-4"/>',
    endeks: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    denetim: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
    sss: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.01"/>',
    uygulama: '<path d="M7 17L17 7M9 7h8v8"/>'
};
const ADMIN_RAIL = [
    { href: "index.html", label: "Genel bakış", icon: "genel", adminOnly: true },
    { group: "Müşteriler" },
    { href: "companies.html", label: "Şirketler", icon: "sirket", also: ["tfrs16.html"] },
    { href: "users.html", label: "Kullanıcılar", icon: "kullanici" },
    { href: "licenses.html", label: "Lisanslar ve planlar", icon: "lisans", adminOnly: true, also: ["plans.html"], badge: "licenses" },
    { group: "Muhasebe verisi", adminOnly: true },
    { href: "periods.html", label: "Dönem yönetimi", icon: "donem", adminOnly: true },
    { href: "opening-balances.html", label: "Açılış bakiyeleri", icon: "acilis", adminOnly: true },
    { href: "fx-rates.html", label: "Döviz kurları", icon: "kur", adminOnly: true, badge: "fx" },
    { href: "inflation-indices.html", label: "Enflasyon endeksleri", icon: "endeks", adminOnly: true, badge: "cpi" },
    { group: "Sistem", adminOnly: true },
    { href: "audit.html", label: "Denetim izi", icon: "denetim", adminOnly: true },
    { href: "faq.html", label: "Site SSS", icon: "sss", adminOnly: true }
];

function adminRailSvg(name) {
    return `<svg class="lq-rail-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ADMIN_RAIL_ICON[name] || ""}</svg>`;
}

function buildAdminRail() {
    const nav = document.getElementById("sidebar");
    if (!nav || nav.dataset.lqRail === "1") return;
    const page = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
    const items = ADMIN_RAIL.map(item => {
        const gate = item.adminOnly ? " data-admin-only" : "";
        if (item.group) return `<div class="nav-label"${gate}>${escapeHtml(item.group)}</div>`;
        const active = item.href === page || (item.also || []).includes(page);
        const badge = item.badge ? `<span class="lq-rail-badge" data-rail-badge="${item.badge}" hidden></span>` : "";
        return `<a href="${item.href}"${active ? ' class="active" aria-current="page"' : ""}${gate}>${adminRailSvg(item.icon)}<span class="lq-rail-label">${escapeHtml(item.label)}</span>${badge}</a>`;
    }).join("");
    nav.innerHTML = `
        <div class="sidebar-brand lq-rail-brand">
            <a href="index.html" class="lq-rail-logo"><img src="../../logo-nav.png" alt="LeaseQant"></a>
            <span class="lq-rail-tag">YÖNETİM</span>
        </div>
        <div class="sidebar-nav" role="navigation" aria-label="Yönetim menüsü">${items}</div>
        <div class="lq-rail-foot">
            <a class="lq-rail-app" href="../../tfrs16.html">${adminRailSvg("uygulama")}<span>Uygulamaya geç</span></a>
        </div>`;
    nav.dataset.lqRail = "1";
    document.documentElement.setAttribute("data-lq-admin", "2");
}

const ADMIN_ROLE_LABEL = {
    ADMIN: "Yönetici",
    ACCOUNTANT_MANAGER: "Muhasebe müdürü",
    ACCOUNTANT: "Muhasebeci",
    CONTROLLER: "Kontrolör",
    VIEWER: "İzleyici"
};

function setRailBadge(key, count) {
    const el = document.querySelector(`[data-rail-badge="${key}"]`);
    if (!el) return;
    const n = Number(count) || 0;
    el.textContent = n > 99 ? "99+" : String(n);
    el.hidden = n === 0;
    el.title = key === "licenses" ? `${n} lisans 30 gün içinde bitiyor` : `${n} kayıt doğrulama bekliyor`;
}

/* Yalnızca ADMIN için: rozet sayıları. Hata olursa rozet gizli kalır. */
async function loadRailBadges() {
    const safe = p => p.then(r => r.json()).catch(() => null);
    const headers = AdminAPI.getHeaders();
    const [expiring, fx, cpi] = await Promise.all([
        safe(fetch(`${AdminAPI.baseURL}/licenses/expiring?days=30`, { headers })),
        safe(fetch(`${API_BASE_URL}/api/fx-rates/pending`, { headers })),
        safe(fetch(`${AdminAPI.baseURL}/inflation-indices?status=PENDING`, { headers }))
    ]);
    const len = v => (Array.isArray(v) ? v.length : 0);
    const exp = expiring && (expiring.data || expiring.licenses);
    setRailBadge("licenses", len(Array.isArray(exp) ? exp.filter(l => String(l.status || "").toLowerCase() === "active") : exp));
    setRailBadge("fx", len(fx && fx.rates));
    setRailBadge("cpi", len(cpi && cpi.data));
    return { expiring, fx, cpi };
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", buildAdminRail);
} else {
    buildAdminRail();
}


// ============================================================
// SAĞ PANEL (drawer) — detay ve düzenleme için
// ------------------------------------------------------------
// showDrawer({ title, eyebrow, body, footer }) — body/footer HTML
// çağıran tarafından escape edilmiş olmalıdır; title/eyebrow düz metin.
// ============================================================
let lqDrawerReturnFocus = null;
function ensureDrawer() {
    let root = document.getElementById("lqDrawer");
    if (root) return root;
    root = document.createElement("div");
    root.id = "lqDrawer";
    root.className = "lq-drawer-root";
    root.hidden = true;
    root.innerHTML = `
        <div class="lq-drawer-scrim" data-drawer-close></div>
        <aside class="lq-drawer" role="dialog" aria-modal="true" aria-labelledby="lqDrawerTitle" tabindex="-1">
            <header class="lq-drawer-head">
                <div class="lq-drawer-titles"><div class="lq-drawer-eyebrow" id="lqDrawerEyebrow"></div><h2 id="lqDrawerTitle"></h2></div>
                <button type="button" class="lq-drawer-x" data-drawer-close aria-label="Paneli kapat">×</button>
            </header>
            <div class="lq-drawer-body" id="lqDrawerBody"></div>
            <footer class="lq-drawer-foot" id="lqDrawerFoot" hidden></footer>
        </aside>`;
    document.body.appendChild(root);
    root.addEventListener("click", e => { if (e.target.closest("[data-drawer-close]")) closeDrawer(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && !root.hidden && !document.querySelector(".modal-overlay.active")) closeDrawer(); });
    return root;
}
function showDrawer({ title = "", eyebrow = "", body = "", footer = "", modeless = false } = {}) {
    const root = ensureDrawer();
    // modeless: arkadaki sayfa tıklanabilir kalır (örn. takvimde başka hücre seçmek).
    root.classList.toggle("modeless", !!modeless);
    root.querySelector(".lq-drawer").setAttribute("aria-modal", modeless ? "false" : "true");
    if (root.hidden) lqDrawerReturnFocus = document.activeElement;
    document.getElementById("lqDrawerTitle").textContent = title;
    document.getElementById("lqDrawerEyebrow").innerHTML = eyebrow;
    document.getElementById("lqDrawerBody").innerHTML = body;
    const foot = document.getElementById("lqDrawerFoot");
    foot.innerHTML = footer;
    foot.hidden = !footer;
    root.hidden = false;
    document.documentElement.classList.add("lq-drawer-open");
    document.documentElement.classList.toggle("lq-drawer-side", !!modeless);
    root.querySelector(".lq-drawer").focus({ preventScroll: true });
    return root;
}
function closeDrawer() {
    const root = document.getElementById("lqDrawer");
    if (!root || root.hidden) return;
    root.hidden = true;
    document.documentElement.classList.remove("lq-drawer-open");
    document.documentElement.classList.remove("lq-drawer-side");
    if (lqDrawerReturnFocus && lqDrawerReturnFocus.isConnected) lqDrawerReturnFocus.focus({ preventScroll: true });
    lqDrawerReturnFocus = null;
}


// ============================================================
// DENETİM İZİ ETİKETLERİ (Genel bakış ve Denetim izi ortak)
// Sunucunun yazdığı işlem kodları; bilinmeyen kod olduğu gibi gösterilir.
// ============================================================
const ADMIN_ACTION_LABEL = {
    CREATE_USER: "Kullanıcı oluşturuldu", UPDATE_USER: "Kullanıcı güncellendi", RESET_PASSWORD: "Şifre sıfırlandı",
    CREATE_COMPANY: "Şirket oluşturuldu", UPDATE_COMPANY_STATUS: "Şirket durumu değişti",
    CREATE_LICENSE: "Lisans atandı", EXTEND_LICENSE: "Lisans süresi uzatıldı", CANCEL_LICENSE: "Lisans iptal edildi",
    UPDATE_LICENSE_LIMITS: "Lisans limiti güncellendi", UPDATE_PLAN: "Plan güncellendi",
    PERIOD_CLOSED: "Dönem kapatıldı", PERIOD_REOPENED: "Dönem yeniden açıldı",
    INFLATION_INDEX_SYNCED: "Endeks TÜİK'ten alındı", INFLATION_INDEX_OVERRIDDEN: "Endeks değiştirildi",
    INFLATION_INDEX_MANUAL_ENTRY_CREATED: "Endeks elle girildi", INFLATION_INDEX_VERIFIED: "Endeks doğrulandı",
    INFLATION_INDEX_REJECTED: "Endeks reddedildi",
    LESSEE_DISCLOSURE_PROFILE_APPROVED: "Dipnot profili onaylandı",
    LESSEE_DISCLOSURE_MATURITY_POLICY_APPROVED: "Vade politikası onaylandı",
    LESSEE_DISCLOSURE_ENTITY_INPUT_APPROVED: "Dipnot girdisi onaylandı",
    MODIFICATION_ROLLED_BACK: "Modifikasyon geri alındı", REASSESSMENT_ROLLED_BACK: "Yeniden değerlendirme geri alındı"
};
const ADMIN_ENTITY_LABEL = {
    user: "Kullanıcı", company: "Şirket", license: "Lisans", period: "Dönem",
    INFLATION_INDEX: "Endeks", MODIFICATION: "Modifikasyon", REASSESSMENT: "Yeniden değerlendirme", plan: "Plan"
};
function auditActionLabel(code) { return ADMIN_ACTION_LABEL[code] || String(code || "İşlem"); }
function auditEntityLabel(code) { return ADMIN_ENTITY_LABEL[code] || String(code || "—"); }
