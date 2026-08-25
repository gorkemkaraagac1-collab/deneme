/**
 * ============================================================
 * INDEX VALIDATION UNIT TESTS
 * ============================================================
 *
 * backend/utils/index-validation.js SAF fonksiyonlardır — DB/
 * network bağımlılığı yok, mock gerektirmez.
 */

const {
  isValidMonthFormat,
  isValidIndexValue,
  isWithinExpectedRange,
  validateInflationIndexEntry
} = require("../backend/utils/index-validation");

describe("isValidMonthFormat", () => {
  test("geçerli YYYY-MM kabul edilir", () => {
    expect(isValidMonthFormat("2025-01")).toBe(true);
    expect(isValidMonthFormat("2025-12")).toBe(true);
  });

  test("geçersiz ay (13, 00) reddedilir", () => {
    expect(isValidMonthFormat("2025-13")).toBe(false);
    expect(isValidMonthFormat("2025-00")).toBe(false);
  });

  test("eksik sıfır / yanlış format reddedilir", () => {
    expect(isValidMonthFormat("2025-1")).toBe(false);
    expect(isValidMonthFormat("2025/01")).toBe(false);
    expect(isValidMonthFormat("")).toBe(false);
    expect(isValidMonthFormat(null)).toBe(false);
    expect(isValidMonthFormat(undefined)).toBe(false);
  });
});

describe("isValidIndexValue", () => {
  test("pozitif sayı kabul edilir", () => {
    expect(isValidIndexValue(100)).toBe(true);
    expect(isValidIndexValue("3512.75")).toBe(true);
  });

  test("sıfır, negatif, NaN reddedilir", () => {
    expect(isValidIndexValue(0)).toBe(false);
    expect(isValidIndexValue(-5)).toBe(false);
    expect(isValidIndexValue("abc")).toBe(false);
    expect(isValidIndexValue(null)).toBe(false);
  });
});

describe("isWithinExpectedRange", () => {
  test("önceki değer yoksa her zaman geçerli (false negative üretmez)", () => {
    expect(isWithinExpectedRange(100, null)).toEqual({ valid: true });
    expect(isWithinExpectedRange(100, undefined)).toEqual({ valid: true });
  });

  test("makul artış/azalış (oran 0.5-2 arası) geçerli", () => {
    expect(isWithinExpectedRange(110, 100).valid).toBe(true);
    expect(isWithinExpectedRange(60, 100).valid).toBe(true);
  });

  test("anormal sıçrama (oran > 2 veya < 0.5) reddedilir", () => {
    const tooHigh = isWithinExpectedRange(300, 100);
    expect(tooHigh.valid).toBe(false);
    expect(tooHigh.warning).toMatch(/sıçrama/);

    const tooLow = isWithinExpectedRange(40, 100);
    expect(tooLow.valid).toBe(false);
  });
});

describe("validateInflationIndexEntry", () => {
  test("geçerli girdi -> valid: true", () => {
    const result = validateInflationIndexEntry({ month: "2025-01", value: 3500 }, 3400);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test("geçersiz ay formatı -> valid: false, aralık kontrolüne hiç girmez", () => {
    const result = validateInflationIndexEntry({ month: "2025-13", value: 3500 }, 3400);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(1);
  });

  test("geçersiz değer -> valid: false", () => {
    const result = validateInflationIndexEntry({ month: "2025-01", value: -1 }, null);
    expect(result.valid).toBe(false);
  });

  test("anormal sıçrama -> valid: false", () => {
    const result = validateInflationIndexEntry({ month: "2025-01", value: 10000 }, 3400);
    expect(result.valid).toBe(false);
  });
});
