const fs = require("fs");
const path = require("path");

jest.mock("../backend/db/pool", () => ({ query: jest.fn() }));

const pool = require("../backend/db/pool");
const { parseRateNumber, parseTcmbXml, insertPendingRates, tcmbUrl, fetchTcmbDate } = require("../backend/services/tcmb-fx-service");

test("TCMB noktalı ondalık kuru doğru parse eder", () => {
  expect(parseRateNumber("35.1234")).toBeCloseTo(35.1234, 8);
});

test("TCMB virgüllü ondalık kuru doğru parse eder", () => {
  expect(parseRateNumber("35,1234")).toBeCloseTo(35.1234, 8);
});

test("yalnızca USD ve EUR, 2019 sonrası resmi kayıtlar kabul edilir", () => {
  const xml = `<Tarih_Date Tarih="02.01.2019"><Currency CurrencyCode="USD"><ForexBuying>5.3196</ForexBuying></Currency><Currency CurrencyCode="EUR"><ForexBuying>6.0711</ForexBuying></Currency></Tarih_Date>`;
  expect(parseTcmbXml(xml)).toEqual([
    { fromCurrency: "USD", toCurrency: "TRY", rateDate: "2019-01-02", rate: 5.3196 },
    { fromCurrency: "EUR", toCurrency: "TRY", rateDate: "2019-01-02", rate: 6.0711 }
  ]);
});

test("eksik doğrudan çift fail-closed davranır", () => {
  const xml = `<Tarih_Date Tarih="02.01.2019"><Currency CurrencyCode="USD"><ForexBuying>5.3196</ForexBuying></Currency></Tarih_Date>`;
  expect(() => parseTcmbXml(xml)).toThrow(/EUR/);
});

test("TCMB geçmiş gün URL'sini doğru üretir", () => {
  expect(tcmbUrl("2019-01-02")).toBe("https://www.tcmb.gov.tr/kurlar/201901/02012019.xml");
});

test("2019 öncesi tarih çekimi reddedilir", async () => {
  await expect(fetchTcmbDate("2018-12-31", jest.fn())).rejects.toThrow(/2019-01-01/);
});

test("yayınlanmamış gün 404 ile güvenli şekilde atlanır", async () => {
  const fetchImpl = jest.fn().mockResolvedValue({ status: 404, ok: false });
  await expect(fetchTcmbDate("2024-01-01", fetchImpl)).resolves.toEqual({ date: "2024-01-01", rows: [], published: false });
});

test("TCMB HTTP hatası açık kaynak hatası üretir", async () => {
  const fetchImpl = jest.fn().mockResolvedValue({ status: 503, ok: false });
  await expect(fetchTcmbDate("2024-01-02", fetchImpl)).rejects.toMatchObject({ code: "TCMB_SOURCE_UNREACHABLE" });
});

test("FX şeması ve senkron INSERT'i retrieved_by denetim alanını birlikte taşır", async () => {
  const initSql = fs.readFileSync(path.join(__dirname, "../backend/db/init.sql"), "utf8");
  const fxSchema = initSql.match(/CREATE TABLE IF NOT EXISTS fx_rates[\s\S]*?\n\);/)?.[0] || "";
  expect(fxSchema).toMatch(/retrieved_by\s+VARCHAR\(50\)/);

  pool.query.mockResolvedValueOnce({ rows: [{ id: 42 }] });
  await insertPendingRates([
    { fromCurrency: "USD", toCurrency: "TRY", rateDate: "2019-01-02", rate: 5.3196 }
  ], "admin-1");

  expect(pool.query).toHaveBeenCalledWith(
    expect.stringMatching(/source_url,retrieved_by/),
    ["USD", "TRY", "2019-01-02", 5.3196, "https://www.tcmb.gov.tr/kurlar/", "admin-1"]
  );
});
