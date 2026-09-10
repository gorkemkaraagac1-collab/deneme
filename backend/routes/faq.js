const express = require('express');

const pool = require('../db/pool');

const router = express.Router();

// ============================================================
// GET /api/faq
// ============================================================
// Public endpoint — auth gerektirmez. Yalnızca yayınlanmış
// (is_published = true) kayıtları, sıralama alanına göre döner.
// index.html "Sık sorulanlar" bölümü bu endpoint'i çağırır.
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                id,
                question,
                answer
            FROM faq_items
            WHERE is_published = TRUE
            ORDER BY sort_order ASC, id ASC
        `);

        return res.json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        console.error('Public FAQ list error:', error);

        return res.status(500).json({
            success: false,
            error: 'SSS listesi alınırken bir hata oluştu'
        });
    }
});

module.exports = router;
