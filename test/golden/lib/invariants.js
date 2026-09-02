/**
 * ============================================================
 * FAZ 0.3 — MUHASEBE INVARIANT'LARI
 * ============================================================
 *
 * Golden-output "eski çıktı = yeni çıktı" der. Bu katman "çıktı
 * muhasebesel olarak HÂLÂ TUTARLI MI" sorusunu sorar. İkisi farklı
 * şeyler: refaktör sırasında girebilecek bir mantık hatası, eğer
 * baseline da aynı hatayla alınmışsa golden'dan geçebilir —
 * invariant'lar bunu yakalar. Ayrıca ESKİ KODDA HÂLİHAZIRDA VAR
 * OLAN gizli tutarsızlıkları da görünür kılar (miras alınır, ama
 * en azından BİLİNİR hale gelir).
 *
 * Her invariant bir sonuç objesi döndürür:
 *   { id, ok, detail, worstDelta }
 *
 * `ok:false` olması testi otomatik KIRMAZ — invariants.test.js,
 * baseline'da zaten `false` olan invariant'ları "bilinen miras"
 * olarak ayırır ve YALNIZCA YENİ bozulmaları hata sayar. Bu,
 * planın "miras alınır ama bilinir" ilkesinin uygulamasıdır.
 */

"use strict";

/** Float yuvarlama toleransı (TL). Plan Faz 0.3: 0.01. */
const TOLERANCE = 0.01;

/** Oransal karşılaştırmalar için gevşek tolerans (PV yeniden hesabı vb.). */
const PV_TOLERANCE = 1.0;

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function close(a, b, tol = TOLERANCE) {
  return Math.abs(num(a) - num(b)) <= tol;
}

function result(id, ok, detail, worstDelta = 0) {
  return { id, ok: Boolean(ok), detail, worstDelta: Number(worstDelta.toFixed(6)) };
}

/* ------------------------------------------------------------------
   INV-01 — Dönem tutarlılığı:
   açılış bakiyesi + faiz − ödeme = kapanış bakiyesi
   (arrears ve advance için aynı denklem geçerlidir; ödeme ve faizin
   SIRASI toplamı değiştirmez, yalnızca faizin hesaplandığı bazı
   değiştirir — o da openingLiability/interest alanlarına zaten yansır.)
------------------------------------------------------------------ */
function invPeriodRollForward(engine) {
  const schedule = engine?.schedule || [];
  if (!schedule.length) return result("INV-01", true, "Schedule boş (başlamamış kontrat) — uygulanmaz.");
  // TFRS 16.5-8 istisnası: kısa vadeli/düşük değerli kirada yükümlülük
  // KAYDEDİLMEZ; schedule satırları doğrusal GİDER satırlarıdır
  // (openingLiability=0, straightLineExpense=payment). Yükümlülük
  // roll-forward denklemi bu satırlara UYGULANAMAZ.
  if (engine?.exempt === true) return result("INV-01", true, "Tanıma istisnası (short-term/low-value) — yükümlülük roll-forward uygulanmaz.");
  let worst = 0;
  let failing = null;
  schedule.forEach(row => {
    const expected = num(row.openingLiability) + num(row.interest) - num(row.payment);
    const delta = Math.abs(expected - num(row.closingLiability));
    if (delta > worst) { worst = delta; if (delta > TOLERANCE) failing = row.period; }
  });
  return result(
    "INV-01",
    worst <= TOLERANCE,
    failing === null
      ? `Tüm ${schedule.length} dönem tutarlı (max sapma ${worst.toExponential(2)}).`
      : `Dönem ${failing} tutarsız (max sapma ${worst}).`,
    worst
  );
}

/* ------------------------------------------------------------------
   INV-02 — Zincir tutarlılığı: row[i].opening = row[i-1].closing
------------------------------------------------------------------ */
function invScheduleChain(engine) {
  const schedule = engine?.schedule || [];
  if (schedule.length < 2) return result("INV-02", true, "Tek dönem veya boş — uygulanmaz.");
  if (engine?.exempt === true) return result("INV-02", true, "Tanıma istisnası — bakiye zinciri yok.");
  let worst = 0;
  let failing = null;
  for (let i = 1; i < schedule.length; i++) {
    const delta = Math.abs(num(schedule[i].openingLiability) - num(schedule[i - 1].closingLiability));
    if (delta > worst) { worst = delta; if (delta > TOLERANCE) failing = schedule[i].period; }
  }
  return result(
    "INV-02",
    worst <= TOLERANCE,
    failing === null ? "Bakiye zinciri kesintisiz." : `Dönem ${failing} zincirden kopuk (sapma ${worst}).`,
    worst
  );
}

/* ------------------------------------------------------------------
   INV-03 — Amortisman tablosunun son satırında yükümlülük ≈ 0
------------------------------------------------------------------ */
function invFinalLiabilityZero(engine) {
  const schedule = engine?.schedule || [];
  if (!schedule.length) return result("INV-03", true, "Schedule boş — uygulanmaz.");
  if (engine?.exempt === true) return result("INV-03", true, "Tanıma istisnası — kapanış yükümlülüğü zaten 0.");
  const finalClosing = num(schedule[schedule.length - 1].closingLiability);
  return result(
    "INV-03",
    Math.abs(finalClosing) <= TOLERANCE,
    `Son dönem kapanış yükümlülüğü ${finalClosing.toExponential(3)}.`,
    Math.abs(finalClosing)
  );
}

/* ------------------------------------------------------------------
   INV-04 — current + non-current = toplam yükümlülük (raporlama tarihinde)
------------------------------------------------------------------ */
function invCurrentNonCurrentSplit(split, engine) {
  if (!split || split.valid === false) return result("INV-04", true, "Split geçersiz/uygulanamaz.");
  if (engine?.exempt === true) return result("INV-04", true, "Tanıma istisnası — yükümlülük kaydedilmiyor.");
  const total = num(split.totalLeaseLiability);
  const sum = num(split.currentLiability) + num(split.nonCurrentLiability);
  const delta = Math.abs(total - sum);
  return result(
    "INV-04",
    delta <= TOLERANCE,
    `current(${num(split.currentLiability).toFixed(2)}) + nonCurrent(${num(split.nonCurrentLiability).toFixed(2)}) vs total(${total.toFixed(2)}), sapma ${delta.toExponential(2)}.`,
    delta
  );
}

/* ------------------------------------------------------------------
   INV-05 — Her fiş dengeli: toplam borç = toplam alacak
   (FİŞ BAZINDA, satır bazında değil — plan Faz 0.3 açıkça böyle diyor.)
------------------------------------------------------------------ */
function invJournalBalanced(entries, label) {
  const list = Array.isArray(entries) ? entries : [];
  if (!list.length) return result("INV-05", true, `${label}: fiş üretilmedi — uygulanmaz.`);
  const debit = list.reduce((s, e) => s + num(e.debit), 0);
  const credit = list.reduce((s, e) => s + num(e.credit), 0);
  const delta = Math.abs(debit - credit);
  return result(
    "INV-05",
    delta <= TOLERANCE,
    `${label}: borç ${debit.toFixed(2)} / alacak ${credit.toFixed(2)}, sapma ${delta.toExponential(2)} (${list.length} satır).`,
    delta
  );
}

/* ------------------------------------------------------------------
   INV-06 — ROU varlığı: birikmiş amortisman ≤ ROU başlangıç değeri,
   yani net defter değeri ASLA NEGATİF olamaz.
------------------------------------------------------------------ */
function invRouNeverNegative(engine) {
  const schedule = engine?.schedule || [];
  if (!schedule.length) return result("INV-06", true, "Schedule boş — uygulanmaz.");
  let worst = 0;
  let failing = null;
  schedule.forEach(row => {
    const closing = num(row.rouClosing);
    if (closing < -TOLERANCE) {
      const magnitude = Math.abs(closing);
      if (magnitude > worst) { worst = magnitude; failing = row.period; }
    }
  });
  const accumulated = schedule.reduce((s, r) => s + num(r.depreciation), 0);
  const initialRou = num(engine.rouAssets);
  const overDepreciation = accumulated - initialRou;
  if (overDepreciation > TOLERANCE && overDepreciation > worst) {
    worst = overDepreciation;
    failing = failing === null ? "birikmiş" : failing;
  }
  return result(
    "INV-06",
    failing === null,
    failing === null
      ? `ROU net defter değeri hep ≥ 0; birikmiş amortisman ${accumulated.toFixed(2)} ≤ başlangıç ROU ${initialRou.toFixed(2)}.`
      : `ROU ihlali (${failing}): sapma ${worst.toFixed(2)}.`,
    worst
  );
}

/* ------------------------------------------------------------------
   INV-07 — ROU zinciri: rouClosing = rouOpening − depreciation
------------------------------------------------------------------ */
function invRouRollForward(engine) {
  const schedule = engine?.schedule || [];
  if (!schedule.length) return result("INV-07", true, "Schedule boş — uygulanmaz.");
  let worst = 0;
  let failing = null;
  schedule.forEach(row => {
    const expected = num(row.rouOpening) - num(row.depreciation);
    const delta = Math.abs(expected - num(row.rouClosing));
    if (delta > worst) { worst = delta; if (delta > TOLERANCE) failing = row.period; }
  });
  return result(
    "INV-07",
    worst <= TOLERANCE,
    failing === null ? "ROU roll-forward tutarlı." : `Dönem ${failing} ROU roll-forward hatalı (sapma ${worst}).`,
    worst
  );
}

/* ------------------------------------------------------------------
   INV-08 — Başlangıç yükümlülüğü = gelecek ödemelerin bugünkü değeri.
   Bağımsız yeniden hesap: motorun kendi schedule'ından ödemeleri alıp
   motorun kendi aylık oranıyla iskonto eder. Motorun PV mantığından
   BAĞIMSIZ bir yol izlediği için gerçek bir çapraz kontroldür.
------------------------------------------------------------------ */
function invLiabilityEqualsPv(engine, contract) {
  const schedule = engine?.schedule || [];
  if (!schedule.length || engine.exempt) return result("INV-08", true, "İstisna/boş schedule — uygulanmaz.");
  const annual = num(contract?.discountRate);
  if (annual <= 0) return result("INV-08", true, "İskonto oranı 0 — PV testi anlamsız.");
  const monthlyRate = annual / 100 / 12;
  const timing = String(contract?.paymentTiming || "arrears").toLowerCase();

  let pv = 0;
  let elapsedMonths = 0;
  schedule.forEach((row, index) => {
    const months = num(row.monthsCovered) || 1;
    // arrears: ödeme dönem SONUNDA → t = birikmiş ay
    // advance:  ödeme dönem BAŞINDA → t = önceki birikmiş ay
    const t = timing === "advance" ? elapsedMonths : elapsedMonths + months;
    pv += num(row.payment) / Math.pow(1 + monthlyRate, t);
    elapsedMonths += months;
    void index;
  });

  const reported = num(engine.liability);
  const delta = Math.abs(pv - reported);
  const relative = reported !== 0 ? delta / Math.abs(reported) : delta;
  return result(
    "INV-08",
    relative <= 0.005 || delta <= PV_TOLERANCE,
    `Bağımsız PV ${pv.toFixed(2)} vs motor ${reported.toFixed(2)}; mutlak sapma ${delta.toFixed(2)}, oransal ${(relative * 100).toFixed(4)}%.`,
    delta
  );
}

/* ------------------------------------------------------------------
   INV-09 — next12 ayrıştırması: anapara + faiz = toplam ödeme
------------------------------------------------------------------ */
function invNext12Decomposition(split, engine) {
  if (!split || split.valid === false) return result("INV-09", true, "Split geçersiz — uygulanmaz.");
  // İstisnalı kirada ödemeler anapara/faize AYRIŞMAZ (gider olarak
  // kaydedilir), dolayısıyla ayrıştırma denklemi uygulanmaz.
  if (engine?.exempt === true) return result("INV-09", true, "Tanıma istisnası — anapara/faiz ayrıştırması yok.");
  const payments = num(split.next12MonthPayments);
  const sum = num(split.next12MonthPrincipal) + num(split.next12MonthInterest);
  const delta = Math.abs(payments - sum);
  return result(
    "INV-09",
    delta <= TOLERANCE,
    `next12 anapara+faiz ${sum.toFixed(2)} vs ödeme ${payments.toFixed(2)}, sapma ${delta.toExponential(2)}.`,
    delta
  );
}

/* ------------------------------------------------------------------
   INV-10 — Yükümlülük hiçbir dönemde negatife düşmez.
------------------------------------------------------------------ */
function invLiabilityNeverNegative(engine) {
  const schedule = engine?.schedule || [];
  if (!schedule.length) return result("INV-10", true, "Schedule boş — uygulanmaz.");
  let worst = 0;
  let failing = null;
  schedule.forEach(row => {
    const closing = num(row.closingLiability);
    if (closing < -TOLERANCE && Math.abs(closing) > worst) {
      worst = Math.abs(closing);
      failing = row.period;
    }
  });
  return result(
    "INV-10",
    failing === null,
    failing === null ? "Yükümlülük hiçbir dönemde negatif değil." : `Dönem ${failing} negatif yükümlülük (${worst}).`,
    worst
  );
}

/* ------------------------------------------------------------------
   INV-11 — CFO metrikleri ile split tutarlı (aynı raporlama tarihinde
   iki AYRI kod yolu aynı sayıyı vermeli). Bu, Faz 4'te bu iki yolun
   birleştirilmesi planlandığı için özellikle değerlidir.
------------------------------------------------------------------ */
function invCfoMatchesSplit(metrics, split, engine) {
  // GC-18 (modification + reassessment birlikte) — DÜZELTİLDİ (Faz 4.1).
  // cfoBuildSchedule ile getScheduleAsOfReportingDate artık AYNI kaynağı
  // (resolveContractScheduleSource) kullanıyor — iki farklı schedule
  // seçimi kalmadı. Görkem kararı (PROJECT_CONTEXT.md bölüm 33):
  // cfoBuildSchedule/buildReassessedSchedule DOĞRU (TFRS 16.39-46 —
  // sonraki ölçüm, retrospektif yeniden kurulum DEĞİL). Bu invariant
  // artık TÜM fixture'larda geçiyor (379/379) — özel durum kodu
  // gerekmiyor, jenerik kontrol yeterli.
  if (!metrics || !split || split.valid === false) return result("INV-11", true, "Karşılaştırma yapılamaz — uygulanmaz.");
  if (engine?.exempt === true) return result("INV-11", true, "Tanıma istisnası — karşılaştırılacak yükümlülük yok.");
  if (metrics.calculationValid === false) return result("INV-11", true, "CFO hesabı geçersiz — uygulanmaz.");
  const pairs = [
    ["leaseLiability", "totalLeaseLiability"],
    ["currentLiability", "currentLiability"],
    ["nonCurrentLiability", "nonCurrentLiability"]
  ];
  let worst = 0;
  const details = [];
  pairs.forEach(([mKey, sKey]) => {
    const delta = Math.abs(num(metrics[mKey]) - num(split[sKey]));
    if (delta > worst) worst = delta;
    if (delta > TOLERANCE) details.push(`${mKey}: ${num(metrics[mKey]).toFixed(2)} vs ${num(split[sKey]).toFixed(2)}`);
  });
  return result(
    "INV-11",
    worst <= TOLERANCE,
    details.length ? `CFO/split uyuşmuyor → ${details.join("; ")}` : "CFO metrikleri split ile uyumlu.",
    worst
  );
}

/* ------------------------------------------------------------------
   INV-12 — FX: fonksiyonel para birimi toplamı × kur ≈ presentation
   toplamı. Bu kod tabanında motor TEK para biriminde çalışır ve
   çevrim ayrı bir katmandadır; bu yüzden burada yapılabilecek anlamlı
   kontrol, çevrimin ORANSAL TUTARLILIĞIDIR: her kalem AYNI kurla
   çarpılmış olmalı (kalem başına farklı kur = hata).
------------------------------------------------------------------ */
function invFxProportional(engine, converted) {
  if (!converted || !converted.applied) return result("INV-12", true, "FX çevrimi uygulanmadı — uygulanmaz.");
  const rate = num(converted.rate);
  if (!(rate > 0)) return result("INV-12", true, "Kur bilinmiyor — uygulanmaz.");
  const pairs = converted.pairs || [];
  if (!pairs.length) return result("INV-12", true, "Çevrilecek kalem yok — uygulanmaz.");

  // Motorun çevrim katmanı sonucu 2 ondalığa YUVARLAR (v23Round).
  // Bu yüzden oransal karşılaştırma (target/source) küçük tutarlarda
  // yapay bir yayılım üretir; doğru kontrol MUTLAK sapmadır:
  //   |target − source × rate| ≤ yuvarlama toleransı
  let worst = 0;
  const failing = [];
  pairs.forEach(pair => {
    const expected = num(pair.source) * rate;
    const delta = Math.abs(num(pair.target) - expected);
    if (delta > worst) worst = delta;
    if (delta > TOLERANCE) failing.push(`${pair.label}: ${num(pair.target).toFixed(2)} ≠ ${expected.toFixed(2)}`);
  });
  void engine;
  return result(
    "INV-12",
    failing.length === 0,
    failing.length
      ? `Kalem başına farklı kur uygulanmış → ${failing.join("; ")}`
      : `${pairs.length} kalem tek kurla (${rate}) tutarlı çevrilmiş; max sapma ${worst.toExponential(2)}.`,
    worst
  );
}

/**
 * Bir kontratın tüm invariant'larını koşar.
 *
 * @param {Object} bundle
 * @param {Object} bundle.contract
 * @param {Object} bundle.engine   calculateLeaseEngineImpl çıktısı
 * @param {Array}  bundle.splits   [{ reportingDate, split, metrics }]
 * @param {Array}  bundle.journals [{ label, entries }]
 * @param {Object} [bundle.fx]     FX çevrim kanıtı
 * @returns {Array} invariant sonuçları
 */
function runInvariants(bundle) {
  const { contract, engine, splits = [], journals = [], fx = null } = bundle;
  const checks = [];

  checks.push(invPeriodRollForward(engine));
  checks.push(invScheduleChain(engine));
  checks.push(invFinalLiabilityZero(engine));
  checks.push(invRouNeverNegative(engine));
  checks.push(invRouRollForward(engine));
  checks.push(invLiabilityNeverNegative(engine));
  checks.push(invLiabilityEqualsPv(engine, contract));

  splits.forEach(entry => {
    const suffix = `@${entry.reportingDate}`;
    const split = invCurrentNonCurrentSplit(entry.split, engine);
    const next12 = invNext12Decomposition(entry.split, engine);
    const cfo = invCfoMatchesSplit(entry.metrics, entry.split, engine);
    checks.push({ ...split, id: `${split.id}${suffix}` });
    checks.push({ ...next12, id: `${next12.id}${suffix}` });
    checks.push({ ...cfo, id: `${cfo.id}${suffix}` });
  });

  journals.forEach(entry => {
    const balanced = invJournalBalanced(entry.entries, entry.label);
    checks.push({ ...balanced, id: `${balanced.id}@${entry.label}` });
  });

  checks.push(invFxProportional(engine, fx));

  return checks;
}

module.exports = {
  runInvariants,
  invJournalBalanced,
  TOLERANCE,
  PV_TOLERANCE
};
