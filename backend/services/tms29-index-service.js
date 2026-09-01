const pool = require("../db/pool");
const crypto = require("crypto");

function validateMonth(monthStr) {
  if (!monthStr || typeof monthStr !== "string") {
    throw new Error("Invalid month: Month must be a non-empty string.");
  }

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthStr)) {
    throw new Error("Invalid month format: Expected YYYY-MM.");
  }

  return true;
}

function validateIndexValue(value) {
  const num = Number(value);

  if (!Number.isFinite(num) || num <= 0) {
    throw new Error("Invalid index value: Must be a positive number.");
  }

  return num;
}

async function getIndices(filters = {}) {
  const conditions = [];
  const values = [];
  let param = 1;

  if (filters.index_type) {
    conditions.push(`index_type = $${param++}`);
    values.push(filters.index_type);
  }

  if (filters.index_month) {
    validateMonth(filters.index_month);
    conditions.push(`index_month = $${param++}`);
    values.push(filters.index_month);
  }

  if (typeof filters.is_verified === "boolean") {
    conditions.push(`is_verified = $${param++}`);
    values.push(filters.is_verified);
  }

  const where = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const result = await pool.query(
    `
      SELECT
        id,
        index_type,
        index_month,
        index_value,
        source,
        source_url,
        retrieved_at,
        is_verified,
        created_by,
        created_at,
        updated_at
      FROM tms29_indices
      ${where}
      ORDER BY index_month DESC
    `,
    values
  );

  return result.rows;
}

async function getIndex(indexMonth, indexType = "CPI") {
  validateMonth(indexMonth);

  if (!indexType) {
    throw new Error("Index type is required.");
  }

  const result = await pool.query(
    `
      SELECT
        id,
        index_type,
        index_month,
        index_value,
        source,
        source_url,
        retrieved_at,
        is_verified,
        created_by,
        created_at,
        updated_at
      FROM tms29_indices
      WHERE index_month = $1
        AND index_type = $2
      LIMIT 1
    `,
    [indexMonth, indexType]
  );

  return result.rows[0] || null;
}

async function upsertIndex(data) {
  const {
    index_type = "CPI",
    index_month,
    index_value,
    source = "TÜİK",
    source_url = null,
    retrieved_at = new Date(),
    is_verified = false,
    created_by = null
  } = data || {};

  validateMonth(index_month);
  const validatedValue = validateIndexValue(index_value);

  const id = crypto.randomUUID();

  const result = await pool.query(
    `
      INSERT INTO tms29_indices (
        id,
        index_type,
        index_month,
        index_value,
        source,
        source_url,
        retrieved_at,
        is_verified,
        created_by,
        created_at,
        updated_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW()
      )
      ON CONFLICT (index_type, index_month)
      DO UPDATE SET
        index_value = EXCLUDED.index_value,
        source = EXCLUDED.source,
        source_url = EXCLUDED.source_url,
        retrieved_at = EXCLUDED.retrieved_at,
        is_verified = EXCLUDED.is_verified,
        updated_at = NOW()
      RETURNING *
    `,
    [
      id,
      index_type,
      index_month,
      validatedValue,
      source,
      source_url,
      retrieved_at,
      is_verified,
      created_by
    ]
  );

  return result.rows[0];
}

async function deleteIndex({ id, indexMonth, indexType = "CPI" }) {
  if (id) {
    const result = await pool.query(
      `DELETE FROM tms29_indices WHERE id = $1 RETURNING *`,
      [id]
    );

    return result.rows[0] || null;
  }

  if (indexMonth) {
    validateMonth(indexMonth);

    const result = await pool.query(
      `
        DELETE FROM tms29_indices
        WHERE index_month = $1
          AND index_type = $2
        RETURNING *
      `,
      [indexMonth, indexType]
    );

    return result.rows[0] || null;
  }

  throw new Error(
    "Must provide either 'id' or 'indexMonth'."
  );
}

async function getInflationRatio(
  baseMonth,
  reportingMonth,
  indexType = "CPI"
) {
  validateMonth(baseMonth);
  validateMonth(reportingMonth);

  const base = await getIndex(baseMonth, indexType);
  const reporting = await getIndex(reportingMonth, indexType);

  if (!base) {
    throw new Error(
      `Base month index not found: ${baseMonth}`
    );
  }

  if (!reporting) {
    throw new Error(
      `Reporting month index not found: ${reportingMonth}`
    );
  }

  const baseValue = Number(base.index_value);
  const reportingValue = Number(reporting.index_value);

  return {
    baseMonth,
    reportingMonth,
    indexType,
    baseIndexValue: baseValue,
    reportingIndexValue: reportingValue,
    ratio: Number(
      (reportingValue / baseValue).toFixed(6)
    )
  };
}

module.exports = {
  getIndices,
  getIndex,
  upsertIndex,
  deleteIndex,
  getInflationRatio,
  validateMonth,
  validateIndexValue
};
