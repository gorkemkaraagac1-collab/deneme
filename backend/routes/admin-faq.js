const express = require('express');
const crypto = require('crypto');

const pool = require('../db/pool');
const { requireAdmin } = require('../middleware/admin');
const { createRateLimiter } = require('../middleware/rate-limit');

const router = express.Router();

// Mutation rate limiter — admin.js'deki adminMutationRateLimiter ile
// aynı yapı (paylaşımlı bir modül olmadığı için burada da tanımlanır,
// bkz. routes/admin.js satır ~33).
const adminMutationRateLimiter = createRateLimiter({
    windowMs: Number(process.env.ADMIN_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: Number(process.env.ADMIN_RATE_LIMIT_MAX) || 60,
    keyGenerator: req => `admin-faq-mutation:${req.ip}:${(req.user && req.user.id) || 'anon'}`,
    message: 'Çok fazla admin işlem isteği. Lütfen daha sonra tekrar deneyin.'
});

function generateFaqId() {
    const suffix = crypto.randomBytes(8).toString('hex');
    return `faq-${Date.now()}-${suffix}`.slice(0, 50);
}

function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

// ============================================================
// GET /api/admin/faq
// ============================================================
// Admin panel listesi — yayınlanmış/yayınlanmamış TÜM kayıtları
// döner (public /api/faq'nin aksine).
router.get('/faq', requireAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                id,
                question,
                answer,
                sort_order,
                is_published,
                created_at,
                updated_at
            FROM faq_items
            ORDER BY sort_order ASC, id ASC
        `);

        return res.json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        console.error('Admin FAQ list error:', error);

        return res.status(500).json({
            success: false,
            error: 'SSS listesi alınırken bir hata oluştu'
        });
    }
});

// ============================================================
// POST /api/admin/faq
// ============================================================
// Body: { question: string, answer: string, sortOrder?: number, isPublished?: boolean }
// Yeni sıra numarası verilmezse, mevcut en büyük sort_order + 10
// kullanılır (yeni kayıt listenin sonuna eklenir).
router.post('/faq', requireAdmin, adminMutationRateLimiter, async (req, res) => {
    const { question, answer, sortOrder, isPublished } = req.body;

    if (!isNonEmptyString(question) || !isNonEmptyString(answer)) {
        return res.status(400).json({
            success: false,
            error: 'question ve answer alanları zorunludur ve boş olamaz'
        });
    }

    if (sortOrder !== undefined && (!Number.isInteger(sortOrder) || sortOrder < 0)) {
        return res.status(400).json({
            success: false,
            error: 'sortOrder 0 veya daha büyük bir tam sayı olmalıdır'
        });
    }

    if (isPublished !== undefined && typeof isPublished !== 'boolean') {
        return res.status(400).json({
            success: false,
            error: 'isPublished bir boolean olmalıdır'
        });
    }

    try {
        let resolvedSortOrder = sortOrder;

        if (resolvedSortOrder === undefined) {
            const maxResult = await pool.query(
                'SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order FROM faq_items'
            );
            resolvedSortOrder = Number(maxResult.rows[0].max_sort_order) + 10;
        }

        const id = generateFaqId();

        const insertResult = await pool.query(
            `
                INSERT INTO faq_items (id, question, answer, sort_order, is_published)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id, question, answer, sort_order, is_published, created_at, updated_at
            `,
            [
                id,
                question.trim(),
                answer.trim(),
                resolvedSortOrder,
                isPublished === undefined ? true : isPublished
            ]
        );

        return res.status(201).json({
            success: true,
            data: insertResult.rows[0]
        });

    } catch (error) {
        console.error('Admin FAQ create error:', error);

        return res.status(500).json({
            success: false,
            error: 'SSS oluşturulurken bir hata oluştu'
        });
    }
});

// ============================================================
// PATCH /api/admin/faq/:id
// ============================================================
// Body: { question?, answer?, sortOrder?, isPublished? }
// Gönderilmeyen alanlar değiştirilmez (undefined = dokunma).
router.patch('/faq/:id', requireAdmin, adminMutationRateLimiter, async (req, res) => {
    const { id } = req.params;
    const { question, answer, sortOrder, isPublished } = req.body;

    if (question !== undefined && !isNonEmptyString(question)) {
        return res.status(400).json({
            success: false,
            error: 'question boş olamaz'
        });
    }

    if (answer !== undefined && !isNonEmptyString(answer)) {
        return res.status(400).json({
            success: false,
            error: 'answer boş olamaz'
        });
    }

    if (sortOrder !== undefined && (!Number.isInteger(sortOrder) || sortOrder < 0)) {
        return res.status(400).json({
            success: false,
            error: 'sortOrder 0 veya daha büyük bir tam sayı olmalıdır'
        });
    }

    if (isPublished !== undefined && typeof isPublished !== 'boolean') {
        return res.status(400).json({
            success: false,
            error: 'isPublished bir boolean olmalıdır'
        });
    }

    try {
        const existingResult = await pool.query(
            'SELECT id FROM faq_items WHERE id = $1',
            [id]
        );

        if (existingResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Belirtilen SSS kaydı bulunamadı'
            });
        }

        const updateResult = await pool.query(
            `
                UPDATE faq_items
                SET
                    question = COALESCE($2, question),
                    answer = COALESCE($3, answer),
                    sort_order = COALESCE($4, sort_order),
                    is_published = COALESCE($5, is_published),
                    updated_at = NOW()
                WHERE id = $1
                RETURNING id, question, answer, sort_order, is_published, created_at, updated_at
            `,
            [
                id,
                question !== undefined ? question.trim() : null,
                answer !== undefined ? answer.trim() : null,
                sortOrder !== undefined ? sortOrder : null,
                isPublished !== undefined ? isPublished : null
            ]
        );

        return res.json({
            success: true,
            data: updateResult.rows[0]
        });

    } catch (error) {
        console.error('Admin FAQ update error:', error);

        return res.status(500).json({
            success: false,
            error: 'SSS güncellenirken bir hata oluştu'
        });
    }
});

// ============================================================
// DELETE /api/admin/faq/:id
// ============================================================
router.delete('/faq/:id', requireAdmin, adminMutationRateLimiter, async (req, res) => {
    const { id } = req.params;

    try {
        const deleteResult = await pool.query(
            'DELETE FROM faq_items WHERE id = $1 RETURNING id',
            [id]
        );

        if (deleteResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Belirtilen SSS kaydı bulunamadı'
            });
        }

        return res.json({
            success: true,
            data: { id }
        });

    } catch (error) {
        console.error('Admin FAQ delete error:', error);

        return res.status(500).json({
            success: false,
            error: 'SSS silinirken bir hata oluştu'
        });
    }
});

module.exports = router;
