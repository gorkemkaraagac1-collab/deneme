const { loadTfrs16 } = require("./helpers/loadTfrs16");

describe("formatCurrency", () => {
  let tfrs16;

  beforeEach(() => {
    tfrs16 = loadTfrs16();
  });

  test("₺ sembolü ile birlikte biçimlendirir", () => {
    expect(tfrs16.formatCurrency(1000)).toMatch(/^₺/);
  });

  test("sıfırı doğru biçimlendirir", () => {
    expect(tfrs16.formatCurrency(0)).toBe("₺0");
  });

  test("negatif değerleri biçimlendirir", () => {
    expect(tfrs16.formatCurrency(-500)).toContain("500");
  });
});
