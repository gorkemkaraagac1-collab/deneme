/**
 * @jest-environment jsdom
 *
 * ============================================================
 * FAZ 0.2 — DETERMİNİZM TESTİ
 * ============================================================
 *
 * Golden-output'un TEK varsayımı vardır: aynı girdi → aynı çıktı.
 * Bu varsayım sessizce bozulursa (bir yerde `new Date()`, bir yerde
 * `Math.random()`, bir yerde Map iterasyon sırası), golden testi
 * gürültüden dolayı kırmızıya döner ve ekip onu görmezden gelmeye
 * başlar — güvenlik ağı böyle ölür.
 *
 * Bu test harness'ı AYNI süreçte İKİ KEZ koşar ve çıktının birebir
 * aynı olduğunu doğrular. Kırmızıysa sorun refaktörde değil,
 * ÖLÇÜM ALTYAPISINDADIR ve önce o düzeltilmelidir.
 */

const { runGolden } = require("./lib/run-golden");
const { compareRecordSets } = require("./lib/compare");

describe("golden harness — determinizm", () => {
  jest.setTimeout(300000);

  let first;
  let second;

  beforeAll(async () => {
    first = await runGolden();
    second = await runGolden();
  });

  test("iki ardışık koşum aynı sayıda kayıt üretir", () => {
    expect(second.contracts.length).toBe(first.contracts.length);
    expect(second.slb.length).toBe(first.slb.length);
    expect(second.sublease.length).toBe(first.sublease.length);
  });

  test("kontrat kayıtları iki koşumda BİREBİR aynı", () => {
    const outcome = compareRecordSets(first.contracts, second.contracts, "contracts");
    if (!outcome.ok) {
      throw new Error(
        "DETERMİNİZM İHLALİ — harness aynı girdi için farklı çıktı üretti.\n" +
        "Golden baseline bu sorun çözülmeden ANLAMSIZDIR.\n\n" + outcome.report
      );
    }
    expect(outcome.ok).toBe(true);
  });

  test("SLB ve sublease kayıtları iki koşumda BİREBİR aynı", () => {
    const slb = compareRecordSets(first.slb, second.slb, "slb");
    const sublease = compareRecordSets(first.sublease, second.sublease, "sublease");
    if (!slb.ok) throw new Error(slb.report);
    if (!sublease.ok) throw new Error(sublease.report);
    expect(slb.ok && sublease.ok).toBe(true);
  });

  test("üretilen kimlikler kanonikleştirilmiş (ham epoch/uuid sızmıyor)", () => {
    // Serileştirilmiş metin üzerinde regex çalıştırmak YANLIŞ sonuç verir:
    // JSON'daki ondalıklı sayılar da 13+ haneli rakam dizisi içerebilir.
    // Bu yüzden yapı gezilir ve YALNIZCA string DEĞERLERİ denetlenir.
    const leaked = [];
    const walk = (node, path) => {
      if (leaked.length > 20) return;
      if (typeof node === "string") {
        if (/\d{13}/.test(node) || /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(node)) {
          leaked.push(`${path} = ${node}`);
        }
        return;
      }
      if (Array.isArray(node)) {
        node.forEach((item, i) => walk(item, `${path}[${i}]`));
        return;
      }
      if (node && typeof node === "object") {
        Object.keys(node).forEach(key => walk(node[key], path ? `${path}.${key}` : key));
      }
    };
    first.contracts.forEach(record => walk(record, record.fixtureId));

    if (leaked.length) {
      throw new Error(
        `Normalize edilmemiş ${leaked.length} üretilmiş kimlik sızdı:\n  ` + leaked.join("\n  ")
      );
    }
    expect(leaked).toHaveLength(0);
  });
});
