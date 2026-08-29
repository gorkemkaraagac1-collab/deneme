const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getActiveCompanyLicense } = require('../services/license-service');

// ============================================================
// GET /api/customer/license - Müşterinin lisans bilgilerini getir
// ============================================================
//
// P3 DÜZELTMESİ: bu endpoint önceden company_licenses'i DOĞRUDAN
// companyId ile sorguluyordu (p.max_users, override YOK, tree/root
// mirası YOK). P0/P1'deki holding tasarımında lisans HER ZAMAN
// ağacın KÖKÜNE bağlıdır (bkz. license-service.js dosya başı notu)
// — yani req.user.companyIds[0] bir ALT şirketse (parent_company_id
// dolu), bu sorgu doğrudan o alt şirkete bağlı bir company_licenses
// satırı ARAR ve genelde hiç bulamaz (lisans kökte, altta değil),
// dolayısıyla aktif bir lisans olsa bile yanlışlıkla 404 dönerdü.
// Ayrıca Custom plan override'ları (max_users_override) da hiç
// uygulanmıyordu (p.max_users doğrudan planın ham değeriydi).
//
// getActiveCompanyLicense() zaten bu iki sorunu da (root'a
// mirası + COALESCE(override, plan)) çözüyor — burada yeniden
// yazılmıyor, sadece çağrılıyor.
//
// companyId seçimi (companyIds[0]) BİLEREK değiştirilmedi: bu
// endpoint client'tan hiçbir companyId almıyor (IDOR riski yok),
// sadece JWT'deki ilk şirketi kullanıyor — mevcut/eski davranışla
// aynı.
router.get('/license', requireAuth, async (req, res) => {
    const companyIds = req.user.companyIds;

    if (!companyIds || companyIds.length === 0) {
        return res.status(404).json({
            success: false,
            error: 'No company found for this user.'
        });
    }

    const companyId = companyIds[0];

    try {
        const license = await getActiveCompanyLicense(companyId);

        if (!license) {
            return res.status(404).json({
                success: false,
                error: 'No active license found for this company.'
            });
        }

        res.json({
            success: true,
            data: {
                license_status: license.status,
                start_date: license.starts_at,
                end_date: license.expires_at,
                plan_name: license.plan_name,
                // COALESCE(override, plan) — Custom lisanslarda
                // gerçek (efektif) limit, planın ham değeri değil.
                max_users: license.max_users
            }
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
