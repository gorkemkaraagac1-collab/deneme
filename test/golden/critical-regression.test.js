/**
 * @jest-environment jsdom
 *
 * Üretim güvenlik ağı: golden çıktının biçimi değişmese bile motorun
 * muhasebe açısından temel sözleşmeleri korunuyor mu diye denetler.
 * Bu testler baseline'a değil, her koşumda hesaplanan gerçek çıktıya
 * bakar; böylece baseline'a yanlışlıkla hatalı bir sonuç yazılması
 * durumunda da bazı bozulmalar yakalanır.
 */

const { runGolden } = require("./lib/run-golden");

const finite = value => Number.isFinite(Number(value));

describe("kritik kontrat regresyon kontrolleri", () => {
  jest.setTimeout(300000);

  let result;

  beforeAll(async () => {
    result = await runGolden();
  });

  test("30 kontratlık matrisin her kaydı iki raporlama çıktısı üretir", () => {
    expect(result.contracts).toHaveLength(30);
    result.contracts.forEach(record => {
      expect(record.splits.length).toBeGreaterThanOrEqual(1);
      record.splits.forEach(({ reportingDate, split, metrics }) => {
        expect(reportingDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(split).toBeDefined();
        expect(metrics).toBeDefined();
        [metrics.leaseLiability, metrics.rouAsset, metrics.monthlyInterest,
          metrics.monthlyDepreciation].forEach(value => expect(finite(value)).toBe(true));
      });
    });
  });

  test("her schedule tarihi artan sırada ve dönem kapanışları geçerli", () => {
    result.contracts.forEach(record => {
      const dates = record.engine.schedule.map(row => row.date).filter(Boolean);
      for (let i = 1; i < dates.length; i += 1) {
        expect(new Date(dates[i]).getTime()).toBeGreaterThan(new Date(dates[i - 1]).getTime());
      }
      record.engine.schedule.forEach(row => {
        [row.openingLiability, row.payment, row.interest, row.closingLiability,
          row.rouOpening, row.depreciation, row.rouClosing].forEach(value => {
          expect(finite(value)).toBe(true);
        });
      });
    });
  });

  test("üretilen yaşam döngüsü fişleri borç/alacak olarak dengeli", () => {
    result.contracts.forEach(record => {
      [...record.modificationJournals, ...record.reassessmentJournals].forEach(journal => {
        const entries = Array.isArray(journal.entries) ? journal.entries : [];
        const debit = entries.reduce((sum, entry) => sum + Number(entry.debit || 0), 0);
        const credit = entries.reduce((sum, entry) => sum + Number(entry.credit || 0), 0);
        expect(Math.abs(debit - credit)).toBeLessThanOrEqual(0.01);
      });
    });
  });

  test("TMS 29 ROU reassessment hareketi ayrı sütunda ve mutabık", () => {
    const reassessed = result.contracts.filter(record => record.reassessmentJournals.length > 0);
    expect(reassessed.length).toBeGreaterThan(0);
    reassessed.forEach(record => {
      record.tms29.forEach(({ restatement }) => {
        if (!restatement || restatement.error || !restatement.rouRollForward) return;
        const rrf = restatement.rouRollForward;
        expect(Object.prototype.hasOwnProperty.call(rrf, "rouReassessmentRestated")).toBe(true);
        const reconstructed = Number(rrf.rouOpeningRestated || 0) +
          Number(rrf.rouEntriesRestated || 0) +
          Number(rrf.rouModificationRestated || 0) +
          Number(rrf.rouReassessmentRestated || 0) -
          Number(rrf.rouDepreciationRestated || 0);
        expect(Math.abs(reconstructed - Number(rrf.rouClosingRestatedPeriod || 0))).toBeLessThanOrEqual(0.01);
      });
    });
  });

  test("yabancı para fixture'larında çevrim kanıtı ve pozitif kur bulunur", () => {
    const foreign = result.contracts.filter(record => record.fx && record.fx.from !== record.fx.to);
    expect(foreign.length).toBeGreaterThan(0);
    foreign.forEach(record => {
      expect(record.fx.applied).toBe(true);
      expect(Number(record.fx.rate)).toBeGreaterThan(0);
      expect(record.fx.pairs.length).toBeGreaterThan(0);
    });
  });

  test("çıktılarda NaN veya sonsuz tutar sızmaz", () => {
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("<NaN>");
    expect(serialized).not.toContain("<Infinity>");
    expect(serialized).not.toContain("<-Infinity>");
  });
});
