const pool = require("../db/pool");

const SUPPORTED_CURRENCIES = Object.freeze(["TRY", "USD", "EUR"]);
const EFFECTIVE_FROM = "2019-01-01";
const TCMB_BASE_URL = "https://www.tcmb.gov.tr/kurlar";

function parseRateNumber(value) {
  const raw = String(value || "").trim();
  if (!/^[0-9]+([.,][0-9]+)?$/.test(raw)) return NaN;
  return Number(raw.replace(",", "."));
}

function parseTcmbXml(xml) {
  const text = String(xml || "");
  if (!text.includes("Tarih") || !text.includes("Currency")) {
    throw Object.assign(new Error("TCMB yanıtı beklenen XML formatında değil."), { code: "TCMB_RESPONSE_SHAPE_ERROR" });
  }
  const date = text.match(/Tarih="(\d{2})\.(\d{2})\.(\d{4})"/i);
  if (!date) throw Object.assign(new Error("TCMB yanıtında tarih bulunamadı."), { code: "TCMB_RESPONSE_SHAPE_ERROR" });
  const rateDate = `${date[3]}-${date[2]}-${date[1]}`;
  const rows = [];
  for (const block of text.matchAll(/<Currency\b[^>]*CurrencyCode="(USD|EUR)"[^>]*>([\s\S]*?)<\/Currency>/gi)) {
    const value = block[2].match(/<ForexBuying>\s*([0-9.,]+)\s*<\/ForexBuying>/i)?.[1];
    if (!value) throw Object.assign(new Error(`TCMB ${block[1]} alış kuru bulunamadı.`), { code: "TCMB_RESPONSE_SHAPE_ERROR" });
    const rate = parseRateNumber(value);
    if (!(rate > 0) || !Number.isFinite(rate)) throw Object.assign(new Error("TCMB kuru geçersiz."), { code: "TCMB_INVALID_RATE" });
    rows.push({ fromCurrency: block[1], toCurrency: "TRY", rateDate, rate });
  }
  if (rows.length !== 2) throw Object.assign(new Error("TCMB USD ve EUR doğrudan kurlarının ikisini de döndürmelidir."), { code: "TCMB_RESPONSE_SHAPE_ERROR" });
  if (rateDate < EFFECTIVE_FROM) throw Object.assign(new Error("TCMB yanıtı kapsam dışında."), { code: "TCMB_RESPONSE_SHAPE_ERROR" });
  return rows;
}

async function insertPendingRates(rows, actor = null) {
  const inserted = [];
  for (const row of rows) {
    const result = await pool.query(`INSERT INTO fx_rates (from_currency,to_currency,rate_date,rate,source,source_url,retrieved_by) VALUES ($1,$2,$3,$4,'TCMB_AUTO',$5,$6) ON CONFLICT DO NOTHING RETURNING id`, [row.fromCurrency,row.toCurrency,row.rateDate,row.rate,"https://www.tcmb.gov.tr/kurlar/",actor]);
    if (result.rows[0]) inserted.push({ ...row, id: result.rows[0].id, verificationStatus: "PENDING" });
  }
  return inserted;
}

function tcmbUrl(date) {
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) throw new Error("Geçersiz TCMB tarihi.");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${TCMB_BASE_URL}/${yyyy}${mm}/${dd}${mm}${yyyy}.xml`;
}

async function fetchTcmbDate(date, fetchImpl = global.fetch) {
  if (String(date) < EFFECTIVE_FROM) throw new Error("TCMB tarihi 2019-01-01 öncesinde olamaz.");
  const response = await fetchImpl(tcmbUrl(date), { headers: { Accept: "application/xml" } });
  if (response.status === 404) return { date, rows: [], published: false };
  if (!response.ok) throw Object.assign(new Error(`TCMB HTTP ${response.status}`), { code: "TCMB_SOURCE_UNREACHABLE" });
  return { date, rows: parseTcmbXml(await response.text()), published: true };
}

module.exports = { EFFECTIVE_FROM, SUPPORTED_CURRENCIES, parseRateNumber, parseTcmbXml, insertPendingRates, tcmbUrl, fetchTcmbDate };
