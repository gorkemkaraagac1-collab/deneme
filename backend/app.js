const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// ============================================================
// Middleware
// ============================================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
app.use(cors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
    credentials: true
}));

// Static files
app.use(express.static(path.join(__dirname, '../frontend')));

// ============================================================
// Routes
// ============================================================
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin')); // Admin panel API'leri
app.use('/api/admin', require('./routes/admin-licenses')); // Mevcut license API'leri
app.use('/api/customer', require('./routes/customer')); // YENİ: Customer API'leri
app.use('/api/org', require('./routes/org')); // P3: Organization API (limits/companies)
app.use('/api/contracts', require('./routes/contracts'));
app.use('/api/audit', require('./routes/audit'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/inflation-indices', require('./routes/inflation-indices'));
app.use('/api/license-test', require('./routes/license-test'));

// ============================================================
// Error handling
// ============================================================
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ 
        success: false, 
        error: 'Internal server error' 
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ 
        success: false, 
        error: 'Endpoint not found' 
    });
});

module.exports = app;
