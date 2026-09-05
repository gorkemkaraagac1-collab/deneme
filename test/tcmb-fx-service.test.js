jest.mock("../backend/db/pool", () => ({ query: jest.fn() }));

const { parseRateNumber, parseTcmbXml, tcmbUrl, fetchTcmbDate } = require("../backend/services/tcmb-fx-service");

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
