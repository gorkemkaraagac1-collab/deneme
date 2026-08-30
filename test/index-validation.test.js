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
  validateInflationIndexEntry,
  parseBulkIndexInput
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

describe("parseBulkIndexInput", () => {
  test("tab ile ayrılmış geçerli satırlar doğru ayrıştırılır", () => {
    const result = parseBulkIndexInput("2025-01\t2648.12\n2025-02\t2701.34\n2025-03\t2756.81");
    expect(result.valid).toEqual([
      { month: "2025-01", value: 2648.12, line: 1 },
      { month: "2025-02", value: 2701.34, line: 2 },
      { month: "2025-03", value: 2756.81, line: 3 }
    ]);
    expect(result.invalid).toEqual([]);
    expect(result.duplicateMonthsInInput).toEqual([]);
  });

  test("boşluk ile ayrılmış satırlar da desteklenir (yalnızca tab zorunlu değil)", () => {
    const result = parseBulkIndexInput("2025-01   2648.12\n2025-02 2701.34");
    expect(result.valid.length).toBe(2);
    expect(result.invalid).toEqual([]);
  });

  test("boş satırlar sessizce atlanır (hata değildir)", () => {
    const result = parseBulkIndexInput("2025-01\t2648.12\n\n\n2025-02\t2701.34\n");
    expect(result.valid.length).toBe(2);
    expect(result.invalid).toEqual([]);
  });

  test("geçersiz ay formatı olan satır invalid listesine düşer, sessizce atlanmaz", () => {
    const result = parseBulkIndexInput("2025-13\t2648.12\n2025-02\t2701.34");
    expect(result.valid).toEqual([{ month: "2025-02", value: 2701.34, line: 2 }]);
    expect(result.invalid.length).toBe(1);
    expect(result.invalid[0].line).toBe(1);
    expect(result.invalid[0].errors.length).toBeGreaterThan(0);
  });

  test("geçersiz/negatif değer olan satır invalid listesine düşer", () => {
    const result = parseBulkIndexInput("2025-01\t-5\n2025-02\tabc");
    expect(result.valid).toEqual([]);
    expect(result.invalid.length).toBe(2);
  });

  test("iki alan içermeyen satır (eksik/fazla) invalid sayılır", () => {
    const result = parseBulkIndexInput("2025-01\n2025-02\t2701.34\t3");
    expect(result.invalid.length).toBe(2);
    expect(result.valid).toEqual([]);
  });

  test("aynı ay birden fazla kez geçiyorsa duplicateMonthsInInput içinde raporlanır", () => {
    const result = parseBulkIndexInput("2025-01\t2648.12\n2025-01\t2650.00\n2025-02\t2701.34");
    expect(result.duplicateMonthsInInput).toEqual(["2025-01"]);
    // duplicate ay yine de valid listesinde görünür (hangisinin kullanılacağına
    // üst katman/route karar verir — parse aşaması bunu sessizce çözmez).
    expect(result.valid.filter(v => v.month === "2025-01").length).toBe(2);
  });

  test("tamamen boş girdi -> valid ve invalid boş, hata fırlatmaz", () => {
    const result = parseBulkIndexInput("");
    expect(result.valid).toEqual([]);
    expect(result.invalid).toEqual([]);
    expect(result.duplicateMonthsInInput).toEqual([]);
  });

  test("anormal sıçrama gösteren satır (önceki ayla karşılaştırma yapılmaz, çünkü satır-bazlı karşılaştırma referansı yok) -> reddedilmez", () => {
    // parseBulkIndexInput satır başına validateInflationIndexEntry'yi
    // previousActiveValue OLMADAN çağırır (aralık kontrolü DB'den önceki
    // aktif değeri gerektirir, parse aşaması DB'ye dokunmaz) — bu kasıtlıdır.
    const result = parseBulkIndexInput("2025-01\t100000");
    expect(result.valid).toEqual([{ month: "2025-01", value: 100000, line: 1 }]);
    expect(result.invalid).toEqual([]);
  });
});
