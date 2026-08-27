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
