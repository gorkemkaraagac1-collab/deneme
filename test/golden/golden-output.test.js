/**
 * @jest-environment jsdom
 *
 * ============================================================
 * FAZ 0.2 — GOLDEN-OUTPUT REGRESYON TESTİ
 * ============================================================
 *
 * Refaktörün "davranış SIFIR değişiklik" iddiasını KANITLAYAN test.
 * Aktif baseline versiyonuna karşı, matristeki her kontratın 6 hedef
 * fonksiyon çıktısını TAM eşitlikle karşılaştırır.
 *
 * Bu test kırmızıysa refaktör davranışı değiştirmiştir — istisnası
 * yoktur. "Küçük fark, önemsiz" değerlendirmesi burada yapılmaz;
 * fark kasıtlıysa yeni bir baseline versiyonu yazılır ve kararın
 * gerekçesi PROJECT_CONTEXT.md'ye işlenir.
 */

const { runGolden } = require("./lib/run-golden");
const { readBaseline, hasBaseline, resolveVersion } = require("./lib/baseline-store");
const { compareRecordSets } = require("./lib/compare");

describe("golden-output — baseline karşılaştırması", () => {
  jest.setTimeout(300000);

  let baseline;
  let current;

  beforeAll(async () => {
    if (!hasBaseline()) {
      throw new Error(
        "Golden baseline yok. Faz 0.2 tamamlanmadan bu test anlamsızdır.\n" +
        "Üretmek için: GOLDEN_WRITE=1 npx jest test/golden/baseline-writer.test.js --runInBand"
      );
    }
    baseline = readBaseline();
    current = await runGolden();
  });

  test("aktif baseline versiyonu çözülebiliyor", () => {
    expect(resolveVersion()).toBeTruthy();
    expect(baseline.meta.schemaVersion).toBe(1);
  });

  test("baseline ile aynı sistem saati dondurulmuş (aksi halde karşılaştırma geçersiz)", () => {
    expect(current.meta.frozenNow).toBe(baseline.meta.frozenNow);
  });

  test("kontrat matrisi çıktıları baseline ile BİREBİR aynı", () => {
    const outcome = compareRecordSets(baseline.contracts, current.contracts, "contracts");
    if (!outcome.ok) {
      throw new Error(
        `Golden karşılaştırma BAŞARISIZ (baseline: ${baseline.version}).\n` +
        `Değişen fixture sayısı: ${outcome.changed}\n\n${outcome.report}`
      );
    }
    expect(outcome.ok).toBe(true);
  });

  test("SLB senaryoları baseline ile BİREBİR aynı", () => {
    const outcome = compareRecordSets(baseline.slb, current.slb, "slb");
    if (!outcome.ok) throw new Error(outcome.report);
    expect(outcome.ok).toBe(true);
  });

  test("Sublease senaryoları baseline ile BİREBİR aynı", () => {
    const outcome = compareRecordSets(baseline.sublease, current.sublease, "sublease");
    if (!outcome.ok) throw new Error(outcome.report);
    expect(outcome.ok).toBe(true);
  });
});
