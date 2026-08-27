// ============================================================
// Admin Panel - Backend Entegrasyonu
// ============================================================

const AdminAPI = {
    // Base URL
    baseURL: '/api/admin',
    
    // Auth header
    getHeaders() {
        const token = localStorage.getItem('access_token');
        return {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
        };
    },
    
    // Dashboard
    async getDashboard() {
        const response = await fetch(`${this.baseURL}/dashboard`, {
            headers: this.getHeaders()
        });
        return response.json();
    },
    
    // Companies
    async getCompanies() {
        const response = await fetch(`${this.baseURL}/companies`, {
            headers: this.getHeaders()
        });
        return response.json();
    },
    
    async createCompany(data) {
        const response = await fetch(`${this.baseURL}/companies`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(data)
        });
        return response.json();
    },
    
    async getCompany(id) {
        const response = await fetch(`${this.baseURL}/companies/${id}`, {
            headers: this.getHeaders()
        });
        return response.json();
    },
    
    // Users
    async getUsers() {
        const response = await fetch(`${this.baseURL}/users`, {
            headers: this.getHeaders()
        });
        return response.json();
    },
    
    async createUser(data) {
        const response = await fetch(`${this.baseURL}/users`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(data)
        });
        return response.json();
    },
    
    async updateUser(id, data) {
        const response = await fetch(`${this.baseURL}/users/${id}`, {
            method: 'PATCH',
            headers: this.getHeaders(),
            body: JSON.stringify(data)
        });
        return response.json();
    },
    
    // Licenses
    async getLicenses() {
        const response = await fetch(`${this.baseURL}/licenses`, {
            headers: this.getHeaders()
        });
        return response.json();
    },
    
    // Audit
    async getAudit(params = {}) {
        const query = new URLSearchParams(params).toString();
        const response = await fetch(`${this.baseURL}/audit?${query}`, {
            headers: this.getHeaders()
        });
        return response.json();
    }
};

// ============================================================
// Admin Auth Check
// ============================================================

async function checkAdminAuth() {
    const token = localStorage.getItem('access_token');
    if (!token) {
        window.location.href = '/login.html';
        return false;
    }
    
    try {
        const response = await fetch('/api/auth/me', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            localStorage.removeItem('access_token');
            window.location.href = '/login.html';
            return false;
        }
        
        const data = await response.json();
        if (data.data.role !== 'ADMIN') {
            window.location.href = '/dashboard.html';
            return false;
        }
        
        // Header'a kullanıcı bilgisini yaz
        document.getElementById('adminUsername').textContent = data.data.username;
        return true;
        
    } catch (error) {
        console.error('Auth check error:', error);
        window.location.href = '/login.html';
        return false;
    }
}

// ============================================================
// Admin UI Helpers
// ============================================================

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('tr-TR') + ' ' + d.toLocaleTimeString('tr-TR', {hour: '2-digit', minute: '2-digit'});
}

function formatDateShort(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('tr-TR');
}

function getStatusBadge(status) {
    const map = {
        'ACTIVE': 'badge-active',
        'INACTIVE': 'badge-inactive',
        'PENDING': 'badge-pending',
        'EXPIRED': 'badge-expired'
    };
    return `<span class="badge ${map[status] || 'badge-inactive'}">${status || 'UNKNOWN'}</span>`;
}

function showModal(title, content) {
    const overlay = document.getElementById('modalOverlay');
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = content;
    overlay.classList.add('active');
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================
// Logout
// ============================================================

function logout() {
    localStorage.removeItem('access_token');
    window.location.href = '/login.html';
}
