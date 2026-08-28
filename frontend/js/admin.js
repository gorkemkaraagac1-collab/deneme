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
async getCompanies() {
    const response =
        await fetch(
            `${this.baseURL}/companies`,
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
async getUsers() {
    const response =
        await fetch(
            `${this.baseURL}/users`,
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
}

};

// ============================================================
// ADMIN AUTH CHECK
// ============================================================

async function checkAdminAuth() {

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
     * result.user
     *
     * fallback:
     *
     * result.data
     */
    const user =
        result.user ||
        result.data;
    if (
        !user ||
        user.role !== "ADMIN"
    ) {
        window.location.href =
            "../dashboard.html";
        return false;
    }
    /*
     * Header kullanıcı adı
     */
    const usernameElement =
        document.getElementById(
            "adminUsername"
        );
    if (usernameElement) {
        usernameElement.textContent =
            user.username || "";
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

    return `
        <form id="assignLicenseForm" onsubmit="submitAssignLicense(event)">
            <div class="form-group">
                <label>Company *</label>
                <select name="company_id" required>${companyOptions}</select>
            </div>
            <div class="form-group">
                <label>Plan *</label>
                <select name="plan_id" required>${planOptions}</select>
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
            <div id="assignLicenseError" style="color:var(--danger); margin-bottom:12px; display:none;"></div>
            <div class="modal-footer">
                <button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary" id="assignLicenseSubmitBtn">Assign License</button>
            </div>
        </form>
    `;
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
    const data = {
        planId: form.plan_id.value,
        startsAt: form.starts_at.value || undefined,
        expiresAt: form.expires_at.value || null
    };

    try {
        const result = await AdminAPI.assignLicense(companyId, data);
        if (result.success) {
            closeModal();
            if (typeof window._onLicenseAssigned === "function") {
                window._onLicenseAssigned();
            }
        } else {
            errorDiv.textContent = "Hata: " + (result.error || "Bilinmeyen bir hata oluştu.");
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
