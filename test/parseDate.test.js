const { loadTfrs16 } = require("./helpers/loadTfrs16");

describe("parseDate", () => {
  let tfrs16;

  beforeEach(() => {
    tfrs16 = loadTfrs16();
  });

  test("ISO formatını (YYYY-MM-DD) ayrıştırır", () => {
    const result = tfrs16.parseDate("2026-01-15");
    expect(result).toBeInstanceOf(Date);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(0);
    expect(result.getDate()).toBe(15);
  });

  test("Date nesnesini olduğu gibi kabul eder", () => {
    const d = new Date(2026, 5, 1);
    expect(tfrs16.parseDate(d)).toBe(d);
  });

  test("boş/null/undefined değerler için null döner", () => {
    expect(tfrs16.parseDate(null)).toBeNull();
    expect(tfrs16.parseDate(undefined)).toBeNull();
    expect(tfrs16.parseDate("")).toBeNull();
  });

  test("geçersiz Date nesnesi için null döner", () => {
    expect(tfrs16.parseDate(new Date("invalid"))).toBeNull();
  });
});
