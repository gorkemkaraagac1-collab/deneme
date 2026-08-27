const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

// ============================================================
// GET /api/customer/license - Müşterinin lisans bilgilerini getir
// ============================================================
router.get('/license', requireAuth, async (req, res) => {
    // 1. Kullanıcının erişebileceği şirket ID'lerini al
    const companyIds = req.user.companyIds;

    // 2. Kullanıcının herhangi bir şirkete bağlı olup olmadığını kontrol et
    if (!companyIds || companyIds.length === 0) {
        return res.status(404).json({
            success: false,
            error: 'No company found for this user.'
        });
    }

    // 3. Sadece ilk şirketi kullan (veya tümünü listeleyebilirsin, ama tasarım gereği tek bir şirket lisansı gösterilecek)
    // Not: req.user.companyIds zaten backend tarafından doğrulanmış ve güvenilir bir kaynaktan geliyor.
    const companyId = companyIds[0];

    try {
        // 4. Bu şirkete ait aktif lisans bilgilerini sorgula
        const result = await pool.query(`
            SELECT 
                cl.status AS license_status,
                cl.starts_at AS start_date,
                cl.expires_at AS end_date,
                p.name AS plan_name,
                p.max_users
            FROM company_licenses cl
            JOIN plans p ON cl.plan_id = p.id
            WHERE cl.company_id = $1
              AND cl.status = 'active'
            ORDER BY cl.created_at DESC
            LIMIT 1
        `, [companyId]);

        // 5. Lisans bulunamazsa 404 döndür
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'No active license found for this company.'
            });
        }

        // 6. Başarılı yanıt
        const licenseData = result.rows[0];
        res.json({
            success: true,
            data: licenseData
        });

    } catch (error) {
        console.error('Customer license fetch error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

module.exports = router;
