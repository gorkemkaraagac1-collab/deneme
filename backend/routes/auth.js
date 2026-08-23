const express = require("express");
const bcrypt = require("bcryptjs");
const pool = require("../db/pool");
const { signUserToken } = require("../utils/jwt");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const BCRYPT_ROUNDS = 12;

/**
 * Bir kullanıcının hangi şirketlere erişebildiğini user_companies
 * tablosundan okur.
 */
async function getUserCompanyIds(userId) {
  const result = await pool.query(
    "SELECT company_id FROM user_companies WHERE user_id = $1",
    [userId]
  );
  return result.rows.map(row => row.company_id);
}

// POST /api/auth/register
// NOT: Bu boilerplate'te kayıt açık bırakılmıştır. Üretimde bunu ya
// tamamen kapatıp kullanıcıları elle/admin panelinden oluşturmalı,
// ya da requireAuth + role==='ADMIN' kontrolüyle korumalısınız —
// aksi halde herkes kendine hesap açıp companyIds atayabilir.
router.post("/register", async (req, res) => {
  const client = await pool.connect();
  try {
    const { id, username, password, role, companyIds } = req.body;

    if (!id || !username || !password || !Array.isArray(companyIds) || companyIds.length === 0) {
      return res.status(400).json({ error: "id, username, password ve en az bir companyIds zorunludur" });
    }
    if (password.length < 10) {
      return res.status(400).json({ error: "Parola en az 10 karakter olmalıdır" });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    await client.query("BEGIN");

    await client.query(
      `INSERT INTO users (id, username, password_hash, role, status)
       VALUES ($1, $2, $3, $4, 'ACTIVE')`,
      [id, username, passwordHash, role || "VIEWER"]
    );

    for (const companyId of companyIds) {
      await client.query(
        "INSERT INTO user_companies (user_id, company_id) VALUES ($1, $2)",
        [id, companyId]
      );
    }

    await client.query("COMMIT");
    res.status(201).json({ id, username, role: role || "VIEWER", companyIds });
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23505") {
      return res.status(409).json({ error: "Bu id veya username zaten kayıtlı" });
    }
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "username ve password zorunludur" });
    }

    const result = await pool.query(
      "SELECT * FROM users WHERE username = $1 AND status = 'ACTIVE'",
      [username]
    );
    const user = result.rows[0];

    // Kullanıcı bulunamasa bile bcrypt.compare'a benzer bir gecikme
    // vermek timing-attack riskini azaltır; burada basitlik için
    // atlanmıştır ama üretimde eklenmesi önerilir.
    if (!user) {
      return res.status(401).json({ error: "Kullanıcı adı veya parola hatalı" });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: "Kullanıcı adı veya parola hatalı" });
    }

    const companyIds = await getUserCompanyIds(user.id);

    const token = signUserToken({
      id: user.id,
      username: user.username,
      role: user.role,
      companyIds
    });

    res.json({
      token,
      user: { id: user.id, username: user.username, role: user.role, companyIds }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/auth/me — geçerli token'ın kime ve hangi şirketlere ait
// olduğunu döndürür (frontend oturum kontrolü için kullanışlı).
router.get("/me", requireAuth, (req, res) => {
  res.json(req.user);
});

module.exports = router;
