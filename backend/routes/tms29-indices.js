const express = require("express");
const router = express.Router();

const {
  getIndices,
  getIndex,
  upsertIndex,
  deleteIndex,
  getInflationRatio
} = require("../services/tms29-index-service");

const { requireAuth } = require("../middleware/auth");

// Local development'ta auth bypass.
// Production'da TMS29_LOCAL_BYPASS=false olmalıdır.
const TMS29_LOCAL_BYPASS =
  process.env.TMS29_LOCAL_BYPASS === "true";

if (!TMS29_LOCAL_BYPASS) {
  router.use(requireAuth);
}

// GET /api/tms29/indices
router.get("/indices", async (req, res) => {
  try {
    const rows = await getIndices({
      index_type: req.query.index_type || "CPI",
      index_month: req.query.index_month,
      is_verified:
        req.query.is_verified === undefined
          ? undefined
          : req.query.is_verified === "true"
    });

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error("TMS29 indices GET error:", error);

    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/tms29/indices/:month
router.get("/indices/:month", async (req, res) => {
  try {
    const row = await getIndex(
      req.params.month,
      req.query.index_type || "CPI"
    );

    if (!row) {
      return res.status(404).json({
        success: false,
        error: "Endeks bulunamadı."
      });
    }

    res.json({
      success: true,
      data: row
    });
  } catch (error) {
    console.error("TMS29 index GET error:", error);

    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/tms29/indices
router.post("/indices", async (req, res) => {
  try {
    const row = await upsertIndex({
      ...req.body,
      created_by: req.user?.id || null
    });

    res.status(201).json({
      success: true,
      data: row
    });
  } catch (error) {
    console.error("TMS29 index POST error:", error);

    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// DELETE /api/tms29/indices/:month
router.delete("/indices/:month", async (req, res) => {
  try {
    const row = await deleteIndex({
      indexMonth: req.params.month,
      indexType: req.query.index_type || "CPI"
    });

    if (!row) {
      return res.status(404).json({
        success: false,
        error: "Endeks bulunamadı."
      });
    }

    res.json({
      success: true,
      data: row
    });
  } catch (error) {
    console.error("TMS29 index DELETE error:", error);

    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/tms29/ratio
router.get("/ratio", async (req, res) => {
  try {
    const {
      baseMonth,
      reportingMonth,
      indexType = "CPI"
    } = req.query;

    const result = await getInflationRatio(
      baseMonth,
      reportingMonth,
      indexType
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error("TMS29 ratio GET error:", error);

    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
