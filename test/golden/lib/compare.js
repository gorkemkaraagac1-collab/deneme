/**
 * ============================================================
 * FAZ 0.2 — GOLDEN KARŞILAŞTIRICI
 * ============================================================
 *
 * VARSAYILAN: TAM eşitlik. Saf kod taşıma (extract-and-delegate)
 * aritmetiği değiştirmez; yuvarlama toleransı vermek gerçek bir
 * sapmayı gizleyebilirdi.
 *
 * `GOLDEN_TOLERANCE` ortam değişkeni ile sayısal tolerans verilebilir
 * — bu YALNIZCA teşhis içindir ("sapma büyük mü küçük mü?"). CI'da
 * ayarlanmamalıdır.
 *
 * Çıktı, "hangi alanda ne kadar saptı" sorusunu tek bakışta
 * cevaplayacak biçimde yol (path) bazlıdır; 30 bin satırlık bir
 * dosyada hata ayıklarken "JSON eşleşmedi" mesajı işe yaramaz.
 */

"use strict";

const TOLERANCE = process.env.GOLDEN_TOLERANCE
  ? Number(process.env.GOLDEN_TOLERANCE)
  : 0;

/** Bir diff kaydında gösterilecek maksimum uzunluk. */
const MAX_PREVIEW = 120;

function preview(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (text === undefined) return "undefined";
  return text.length > MAX_PREVIEW ? text.slice(0, MAX_PREVIEW) + "…" : text;
}

function typeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

/**
 * İki normalize edilmiş yapıyı derinlemesine karşılaştırır.
 * @returns {Array<{path:string, kind:string, expected:*, actual:*, delta?:number}>}
 */
function diff(expected, actual, basePath = "", out = []) {
  if (out.length >= 200) return out; // rapor patlamasını önle

  const te = typeOf(expected);
  const ta = typeOf(actual);

  if (te !== ta) {
    out.push({ path: basePath || "<root>", kind: "type", expected: preview(expected), actual: preview(actual) });
    return out;
  }

  if (te === "number") {
    const delta = Math.abs(expected - actual);
    if (!(Object.is(expected, actual) || delta <= TOLERANCE)) {
      out.push({ path: basePath, kind: "number", expected, actual, delta });
    }
    return out;
  }

  if (te === "string" || te === "boolean" || te === "null") {
    if (expected !== actual) {
      out.push({ path: basePath, kind: te, expected: preview(expected), actual: preview(actual) });
    }
    return out;
  }

  if (te === "array") {
    if (expected.length !== actual.length) {
      out.push({
        path: basePath,
        kind: "arrayLength",
        expected: expected.length,
        actual: actual.length
      });
    }
    const limit = Math.min(expected.length, actual.length);
    for (let i = 0; i < limit; i++) {
      diff(expected[i], actual[i], `${basePath}[${i}]`, out);
      if (out.length >= 200) break;
    }
    return out;
  }

  if (te === "object") {
    const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
    for (const key of Array.from(keys).sort()) {
      const nextPath = basePath ? `${basePath}.${key}` : key;
      if (!(key in expected)) {
        out.push({ path: nextPath, kind: "extraKey", expected: undefined, actual: preview(actual[key]) });
        continue;
      }
      if (!(key in actual)) {
        out.push({ path: nextPath, kind: "missingKey", expected: preview(expected[key]), actual: undefined });
        continue;
      }
      diff(expected[key], actual[key], nextPath, out);
      if (out.length >= 200) break;
    }
    return out;
  }

  return out;
}

/** Diff listesini okunabilir bir rapora çevirir. */
function formatDiff(fixtureId, diffs) {
  if (!diffs.length) return "";
  const lines = [`GOLDEN SAPMA — fixture: ${fixtureId} (${diffs.length} fark)`];
  diffs.slice(0, 40).forEach(d => {
    if (d.kind === "number") {
      lines.push(`  ${d.path}\n    beklenen: ${d.expected}\n    gerçek  : ${d.actual}\n    sapma   : ${d.delta}`);
    } else if (d.kind === "arrayLength") {
      lines.push(`  ${d.path}  dizi uzunluğu ${d.expected} → ${d.actual}`);
    } else {
      lines.push(`  ${d.path}  [${d.kind}]\n    beklenen: ${d.expected}\n    gerçek  : ${d.actual}`);
    }
  });
  if (diffs.length > 40) {
    lines.push(`  … ve ${diffs.length - 40} fark daha (ilk 40 gösterildi).`);
  }
  return lines.join("\n");
}

/**
 * Kayıt listelerini fixtureId üzerinden eşleştirip karşılaştırır.
 * @returns {{ok:boolean, report:string, missing:string[], added:string[], changed:number}}
 */
function compareRecordSets(baselineRecords, currentRecords, setName) {
  const baseMap = new Map(baselineRecords.map(r => [r.fixtureId, r]));
  const currMap = new Map(currentRecords.map(r => [r.fixtureId, r]));

  const missing = [...baseMap.keys()].filter(id => !currMap.has(id));
  const added = [...currMap.keys()].filter(id => !baseMap.has(id));

  const reports = [];
  let changed = 0;

  for (const [id, baseRecord] of baseMap) {
    if (!currMap.has(id)) continue;
    const diffs = diff(baseRecord, currMap.get(id));
    if (diffs.length) {
      changed += 1;
      reports.push(formatDiff(`${setName}/${id}`, diffs));
    }
  }

  if (missing.length) {
    reports.unshift(`${setName}: baseline'da olup şimdi ÜRETİLMEYEN fixture'lar → ${missing.join(", ")}`);
  }
  if (added.length) {
    reports.unshift(
      `${setName}: baseline'da OLMAYAN yeni fixture'lar → ${added.join(", ")}. ` +
      "Matris genişletildiyse YENİ bir baseline versiyonu yazılmalı (eskisi silinmez)."
    );
  }

  return {
    ok: !reports.length,
    report: reports.join("\n\n"),
    missing,
    added,
    changed
  };
}

module.exports = { diff, formatDiff, compareRecordSets, TOLERANCE };
