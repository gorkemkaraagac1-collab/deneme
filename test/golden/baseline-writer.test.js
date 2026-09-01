/**
 * @jest-environment jsdom
 *
 * ============================================================
 * FAZ 0.2 — BASELINE YAZICI
 * ============================================================
 *
 * BU DOSYA NORMAL TEST KOŞUMUNDA ATLANIR. Baseline yazmak kasıtlı
 * bir eylemdir; her `npm test` koşumunda kendini yeniden yazan bir
 * baseline hiçbir şeyi koruyamaz — regresyonu sessizce kabul eder.
 *
 * Kullanım:
 *   GOLDEN_WRITE=1 npx jest test/golden/baseline-writer.test.js --runInBand
 *
 * Her koşum YENİ bir timestamp'li versiyon yazar; eskisi silinmez,
 * üzerine yazılmaz (baseline-store.js bunu zorlar).
 */

const { runGolden } = require("./lib/run-golden");
const { writeBaseline, listVersions } = require("./lib/baseline-store");

const SHOULD_WRITE = process.env.GOLDEN_WRITE === "1";

(SHOULD_WRITE ? describe : describe.skip)("golden baseline yazıcı", () => {
  jest.setTimeout(300000);

  test("regresyon matrisini koşup yeni bir IMMUTABLE baseline versiyonu yazar", async () => {
    const payload = await runGolden();

    expect(payload.contracts.length).toBeGreaterThanOrEqual(25);
    expect(payload.slb.length).toBeGreaterThanOrEqual(1);
    expect(payload.sublease.length).toBeGreaterThanOrEqual(1);

    const dir = writeBaseline(payload);

    // eslint-disable-next-line no-console
    console.info(
      `\n[GOLDEN] Yeni baseline yazıldı → ${dir}\n` +
      `[GOLDEN] Toplam versiyon sayısı: ${listVersions().length}\n` +
      `[GOLDEN] Kontrat: ${payload.contracts.length}, SLB: ${payload.slb.length}, Sublease: ${payload.sublease.length}\n`
    );

    expect(dir).toContain("baseline");
  });
});
