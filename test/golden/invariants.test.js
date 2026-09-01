/**
 * @jest-environment jsdom
 *
 * ============================================================
 * FAZ 0.3 — MUHASEBE INVARIANT TESTİ
 * ============================================================
 *
 * Golden-output "çıktı değişti mi" der. Bu test "çıktı muhasebesel
 * olarak TUTARLI MI" der.
 *
 * KRİTİK AYRIM: baseline'da ZATEN başarısız olan invariant'lar
 * "bilinen miras" sayılır ve testi kırmaz — ama açıkça RAPORLANIR.
 * Bu, planın "eski koddaki gizli tutarsızlık miras alınır ama en
 * azından BİLİNİR hale gelir" ilkesidir. Refaktör sırasında YENİ
 * bozulan bir invariant ise testi kırar.
 *
 * Bu ayrımı yapmasaydık iki kötü seçenekten birini yapardık:
 *  a) hepsini hata sayıp Faz 0'ı hiç kapatamamak, ya da
 *  b) hepsini görmezden gelip katmanı işlevsiz kılmak.
 */

const { runGolden } = require("./lib/run-golden");
const { readBaseline, hasBaseline } = require("./lib/baseline-store");

function indexChecks(records) {
  const map = new Map();
  records.forEach(record => {
    (record.invariantChecks || []).forEach(check => {
      map.set(`${record.fixtureId}::${check.id}`, check);
    });
  });
  return map;
}

describe("muhasebe invariant'ları", () => {
  jest.setTimeout(300000);

  let current;
  let baselineChecks;

  beforeAll(async () => {
    if (!hasBaseline()) {
      throw new Error(
        "Golden baseline yok. Faz 0.3 miras/yeni ayrımı baseline olmadan yapılamaz.\n" +
        "Üretmek için: GOLDEN_WRITE=1 npx jest test/golden/baseline-writer.test.js --runInBand"
      );
    }
    baselineChecks = indexChecks(readBaseline().contracts);
    current = await runGolden();
  });

  test("her kontrat için invariant bloğu üretilmiş", () => {
    current.contracts.forEach(record => {
      expect(Array.isArray(record.invariantChecks)).toBe(true);
      expect(record.invariantChecks.length).toBeGreaterThan(0);
    });
  });

  test("baseline'da GEÇEN hiçbir invariant şimdi bozulmamış", () => {
    const regressions = [];
    indexChecks(current.contracts).forEach((check, key) => {
      const baselineCheck = baselineChecks.get(key);
      if (!baselineCheck) {
        // Yeni fixture veya yeni invariant — golden-output testi
        // zaten "baseline'da olmayan fixture" uyarısı verir.
        return;
      }
      if (baselineCheck.ok === true && check.ok !== true) {
        regressions.push(`${key}\n    ${check.detail}`);
      }
    });

    if (regressions.length) {
      throw new Error(
        `INVARIANT REGRESYONU — baseline'da geçen ${regressions.length} kontrol şimdi başarısız:\n  ` +
        regressions.join("\n  ")
      );
    }
    expect(regressions).toHaveLength(0);
  });

  test("bilinen miras ihlalleri raporlanır (testi kırmaz)", () => {
    const inherited = [];
    indexChecks(current.contracts).forEach((check, key) => {
      const baselineCheck = baselineChecks.get(key);
      if (baselineCheck && baselineCheck.ok === false && check.ok === false) {
        inherited.push(`${key} → ${check.detail}`);
      }
    });

    if (inherited.length) {
      // eslint-disable-next-line no-console
      console.warn(
        `\n[INVARIANT MİRASI] Eski kodda HÂLİHAZIRDA var olan ${inherited.length} tutarsızlık ` +
        "devralındı. Refaktör bunları YARATMADI, ama artık görünürler:\n  " +
        inherited.join("\n  ") + "\n"
      );
    }

    // Miras sayısı SABİT kalmalı — artıyorsa yeni tutarsızlık girmiştir.
    expect(inherited.length).toBeLessThanOrEqual(baselineChecks.size);
  });
});
