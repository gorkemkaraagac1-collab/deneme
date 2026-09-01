/**
 * ============================================================
 * FAZ 0.2 — IMMUTABLE BASELINE DEPOSU
 * ============================================================
 *
 * Plan kuralı: "Baseline sonuçları IMMUTABLE olarak saklanır
 * (write-once dosya/klasör; üzerine yazma yok, her yeni ölçüm
 * yeni versiyon/timestamp ile eklenir)."
 *
 * Bu modül bu kuralı ZORLA uygular, sadece rica etmez:
 *  - Her yazım YENİ bir timestamp'li klasör açar.
 *  - Var olan bir klasöre yazmayı REDDEDER (istisna fırlatır).
 *  - Yazılan dosyalar 0444 (salt okunur) yapılır.
 *  - `LATEST` işaretçisi hangi versiyonun karşılaştırma referansı
 *    olduğunu tutar; işaretçiyi değiştirmek baseline'ı SİLMEZ.
 *
 * Karşılaştırma referansı `GOLDEN_BASELINE` ortam değişkeniyle
 * geçersiz kılınabilir (eski bir versiyona karşı koşmak için).
 */

"use strict";

const fs = require("fs");
const path = require("path");

const BASELINE_ROOT = path.join(__dirname, "..", "baseline");
const LATEST_POINTER = path.join(BASELINE_ROOT, "LATEST");

function ensureRoot() {
  if (!fs.existsSync(BASELINE_ROOT)) {
    fs.mkdirSync(BASELINE_ROOT, { recursive: true });
  }
}

/** `2026-06-30T09-00-00-000Z` biçiminde, dosya sistemi güvenli damga. */
function versionStamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

/**
 * Yeni bir baseline versiyonu yazar.
 * @param {Object} payload - { meta, contracts, slb, sublease }
 * @param {string} [stamp] - Açıkça verilirse kullanılır (test için).
 * @returns {string} yazılan versiyon klasörünün yolu
 */
function writeBaseline(payload, stamp) {
  ensureRoot();
  const version = stamp || versionStamp();
  const dir = path.join(BASELINE_ROOT, version);

  if (fs.existsSync(dir)) {
    throw new Error(
      `IMMUTABILITY İHLALİ: baseline versiyonu zaten var → ${dir}. ` +
      "Baseline'ların üzerine yazılamaz; yeni bir damga kullanın."
    );
  }

  fs.mkdirSync(dir, { recursive: true });

  const files = {
    "meta.json": payload.meta,
    "contracts.json": payload.contracts,
    "slb.json": payload.slb,
    "sublease.json": payload.sublease
  };

  Object.entries(files).forEach(([name, content]) => {
    const filePath = path.join(dir, name);
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + "\n", "utf8");
    fs.chmodSync(filePath, 0o444);
  });

  fs.writeFileSync(LATEST_POINTER, version + "\n", "utf8");
  return dir;
}

/** Karşılaştırma için kullanılacak versiyonun adını çözer. */
function resolveVersion() {
  if (process.env.GOLDEN_BASELINE) return process.env.GOLDEN_BASELINE.trim();
  if (!fs.existsSync(LATEST_POINTER)) return null;
  const value = fs.readFileSync(LATEST_POINTER, "utf8").trim();
  return value || null;
}

/** Baseline var mı? (Faz 0 kapanış koşulu bunu denetler.) */
function hasBaseline() {
  const version = resolveVersion();
  if (!version) return false;
  return fs.existsSync(path.join(BASELINE_ROOT, version, "contracts.json"));
}

/**
 * Aktif baseline'ı okur.
 * @returns {{version:string, dir:string, meta:Object, contracts:Array, slb:Array, sublease:Array}}
 */
function readBaseline() {
  const version = resolveVersion();
  if (!version) {
    throw new Error(
      "Baseline bulunamadı. Önce şunu koşun: GOLDEN_WRITE=1 npx jest test/golden/baseline-writer.test.js --runInBand"
    );
  }
  const dir = path.join(BASELINE_ROOT, version);
  const read = name => JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
  return {
    version,
    dir,
    meta: read("meta.json"),
    contracts: read("contracts.json"),
    slb: read("slb.json"),
    sublease: read("sublease.json")
  };
}

/** Mevcut tüm baseline versiyonlarını (eskiden yeniye) listeler. */
function listVersions() {
  ensureRoot();
  return fs
    .readdirSync(BASELINE_ROOT, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort();
}

module.exports = {
  BASELINE_ROOT,
  LATEST_POINTER,
  versionStamp,
  writeBaseline,
  readBaseline,
  resolveVersion,
  hasBaseline,
  listVersions
};
