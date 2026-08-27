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
            body
