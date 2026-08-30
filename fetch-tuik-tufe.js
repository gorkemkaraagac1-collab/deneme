#!/usr/bin/env node
/**
 * TÜİK SDMX servisinden TÜFE Genel Endeksi'ni çekip JSON olarak kaydeder.
 *
 * KULLANIM:
 *   TUIK_API_KEY=xxxxx node fetch-tuik-tufe.js
 *   veya (Türkiye telefon hattı olmayan kullanıcılar için)
 *   TUIK_CLIENT_ID=xxx TUIK_CLIENT_SECRET=yyy node fetch-tuik-tufe.js
 *
 * NE YAPAR:
 *   1. TÜİK giriş sisteminden access token alır.
 *   2. Tüm dataflow'ları listeler, adında "Tüketici Fiyat Endeksi" geçen
 *      ve "Genel" / genel endeks niteliğinde olan dataflow'u bulmaya çalışır.
 *   3. Bulduğu dataflow'un DSD'sini çeker, boyut sırasını çıkarır.
 *   4. İlgili "genel/toplam" kod değerini (GENEL, TOPLAM, _T, 0 gibi olası
 *      adaylar arasından) codelist içinden bulmaya çalışır.
 *   5. Seri anahtarını dinamik olarak kurup veriyi SDMX-CSV formatında çeker.
 *   6. Sonucu ./data/tufe-endeks.json içine { "YYYY-MM": deger, ... } olarak yazar.
 *
 * ÖNEMLİ: Otomatik keşif her TÜİK dataflow yapısı için %100 garanti değildir.
 * Adım 2 veya 4'te birden fazla aday bulunursa, script bunları ekrana yazdırıp
 * .env / CLI argümanı ile net bir seçim yapmanızı ister (bkz. aşağıdaki
 * TUIK_DATAFLOW_ID / TUIK_ITEM_CODE override'ları). İlk çalıştırmada
 * konsol çıktısını bana gönderirseniz doğru kodları birlikte sabitleriz.
 */

const TOKEN_URL = "https://giris.tuik.gov.tr/realms/web/protocol/openid-connect/token";
const BASE = "https://nsiws.tuik.gov.tr/rest";
const AGENCY = "TR";

const OUT_DIR = "./data";
const OUT_FILE = `${OUT_DIR}/tufe-endeks.json`;

// Manuel override'lar (otomatik keşif başarısız olursa doldurup tekrar çalıştırın)
const OVERRIDE_DATAFLOW_ID = process.env.TUIK_DATAFLOW_ID || null; // örn "DF_TUFE"
const OVERRIDE_DATAFLOW_VERSION = process.env.TUIK_DATAFLOW_VERSION || null; // örn "1.0"
const OVERRIDE_ITEM_CODE = process.env.TUIK_ITEM_CODE || null; // örn "GENEL"
const OVERRIDE_FREQ_CODE = process.env.TUIK_FREQ_CODE || "M"; // aylık varsayım

async function getToken() {
  const apiKey = process.env.TUIK_API_KEY;
  const clientId = process.env.TUIK_CLIENT_ID;
  const clientSecret = process.env.TUIK_CLIENT_SECRET;

  const body = new URLSearchParams();
  if (apiKey) {
    body.set("grant_type", "password");
    body.set("client_id", "nsi-ws-consumer");
    body.set("api_key", apiKey);
  } else if (clientId && clientSecret) {
    body.set("grant_type", "client_credentials");
    body.set("client_id", clientId);
    body.set("client_secret", clientSecret);
  } else {
    throw new Error(
      "TUIK_API_KEY ya da (TUIK_CLIENT_ID + TUIK_CLIENT_SECRET) ortam değişkenlerinden biri gerekli."
    );
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Token alınamadı: ${res.status} ${res.statusText}\n${await res.text()}`);
  }
  const json = await res.json();
  return json.access_token;
}

async function authedFetch(url, token, headers = {}) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, ...headers },
  });
  if (!res.ok) {
    throw new Error(`İstek başarısız: ${url}\n${res.status} ${res.statusText}\n${await res.text()}`);
  }
  return res.text();
}

// --- Çok hafif XML yardımcıları (regex tabanlı, bağımlılıksız) ---

function extractBlocks(xml, tagLocalName) {
  // <ns:TagLocalName ...>...</ns:TagLocalName> veya <TagLocalName ...>...</TagLocalName> yakalar
  const re = new RegExp(
    `<(?:[\\w.]+:)?${tagLocalName}\\b[^>]*>[\\s\\S]*?<\\/(?:[\\w.]+:)?${tagLocalName}>`,
    "g"
  );
  return xml.match(re) || [];
}

function attr(block, name) {
  const m = block.match(new RegExp(`${name}="([^"]*)"`));
  return m ? m[1] : null;
}

function nameByLang(block, lang) {
  const re = new RegExp(
    `<(?:[\\w.]+:)?Name[^>]*xml:lang="${lang}"[^>]*>([^<]*)<`,
    "i"
  );
  const m = block.match(re);
  return m ? m[1].trim() : null;
}

// --- Adım 1: TÜFE dataflow'unu bul ---

async function findTufeDataflow(token) {
  if (OVERRIDE_DATAFLOW_ID && OVERRIDE_DATAFLOW_VERSION) {
    console.log(
      `[bilgi] Manuel override kullanılıyor: ${OVERRIDE_DATAFLOW_ID} v${OVERRIDE_DATAFLOW_VERSION}`
    );
    return { id: OVERRIDE_DATAFLOW_ID, version: OVERRIDE_DATAFLOW_VERSION };
  }

  console.log("[1/5] Dataflow listesi çekiliyor (bu biraz sürebilir)...");
  const xml = await authedFetch(`${BASE}/dataflow/${AGENCY}/all`, token);
  const blocks = extractBlocks(xml, "Dataflow");
  console.log(`[bilgi] Toplam ${blocks.length} dataflow bulundu.`);

  const candidates = blocks
    .map((b) => ({
      id: attr(b, "id"),
      version: attr(b, "version"),
      nameTr: nameByLang(b, "tr"),
      nameEn: nameByLang(b, "en"),
    }))
    .filter((c) => {
      const t = (c.nameTr || "") + " " + (c.nameEn || "");
      return /t[üu]ketici fiyat endeksi/i.test(t) || /consumer price index/i.test(t);
    });

  if (candidates.length === 0) {
    throw new Error(
      "Adında 'Tüketici Fiyat Endeksi' geçen dataflow bulunamadı. TUIK_DATAFLOW_ID / TUIK_DATAFLOW_VERSION ile manuel belirtin."
    );
  }

  // "Genel" içeren veya en az kelimeli (muhtemelen en üst seviye/genel) olanı önceliklendir
  candidates.sort((a, b) => {
    const aGeneral = /genel/i.test(a.nameTr || "") ? 0 : 1;
    const bGeneral = /genel/i.test(b.nameTr || "") ? 0 : 1;
    if (aGeneral !== bGeneral) return aGeneral - bGeneral;
    return (a.nameTr || "").length - (b.nameTr || "").length;
  });

  console.log("[bilgi] Aday dataflow'lar (en olası önce):");
  candidates.forEach((c, i) =>
    console.log(`  ${i + 1}. ${c.id} v${c.version} — ${c.nameTr || c.nameEn}`)
  );

  if (candidates.length > 1) {
    console.log(
      "\n[uyarı] Birden fazla aday var. En üsttekini kullanıyorum ama YANLIŞSA " +
        "TUIK_DATAFLOW_ID ve TUIK_DATAFLOW_VERSION ortam değişkenleriyle doğrusunu belirtip tekrar çalıştırın.\n"
    );
  }

  return candidates[0];
}

// --- Adım 2: DSD'den boyut sırasını çıkar ---

async function getDimensionOrder(token, dataflowId, version) {
  console.log("[2/5] DSD (veri yapısı tanımı) çekiliyor...");
  const xml = await authedFetch(
    `${BASE}/dataflow/${AGENCY}/${dataflowId}/${version}?references=children`,
    token
  );

  const dsdBlocks = extractBlocks(xml, "DataStructure");
  if (dsdBlocks.length === 0) {
    throw new Error("DSD bulunamadı — dataflow referansı beklenenden farklı yapıda olabilir.");
  }
  const dsd = dsdBlocks[0];

  const dimBlocks = extractBlocks(dsd, "Dimension").concat(
    extractBlocks(dsd, "TimeDimension")
  );

  // Orijinal sıradaki position attribute'una göre sırala
  const dims = dimBlocks
    .map((b) => ({
      id: attr(b, "id"),
      position: parseInt(attr(b, "position") || "0", 10),
      isTime: /TimeDimension/.test(b.slice(0, 30)),
    }))
    .sort((a, b) => a.position - b.position);

  console.log(`[bilgi] Boyut sırası: ${dims.map((d) => d.id).join(" . ")}`);
  return dims;
}

// --- Adım 3: Genel/toplam kodunu belirle ---

function guessGeneralItemDimension(dims) {
  // FREQ, REF_AREA/GEO, TIME_PERIOD dışındaki "ürün/madde/kalem" boyutunu tahmin et
  const known = ["FREQ", "REF_AREA", "GEO", "TIME_PERIOD", "TIME"];
  return dims.filter((d) => !known.includes(d.id) && !d.isTime);
}

function buildSeriesKey(dims, values) {
  // values: { DIM_ID: code }  — belirtilmeyenler boş bırakılır (wildcard)
  return dims
    .filter((d) => !d.isTime)
    .map((d) => values[d.id] ?? "")
    .join(".");
}

// --- Adım 4: Veriyi SDMX-CSV formatında çek ---

async function fetchDataCsv(token, dataflowId, version, seriesKey) {
  console.log(`[4/5] Veri çekiliyor — seri anahtarı: "${seriesKey || "(tüm seri)"}"`);
  const url = `${BASE}/data/${AGENCY},${dataflowId},${version}/${seriesKey}?format=SDMX-CSV`;
  return authedFetch(url, token, { Accept: "text/csv" });
}

function parseCsv(csvText) {
  const lines = csvText.trim().split("\n").filter(Boolean);
  if (lines.length < 2) return { header: [], rows: [] };
  const header = lines[0].split(",").map((h) => h.replace(/"/g, "").trim());
  const rows = lines.slice(1).map((l) => l.split(",").map((v) => v.replace(/"/g, "").trim()));
  return { header, rows };
}

// --- Ana akış ---

async function main() {
  const token = await getToken();
  console.log("[bilgi] Token alındı.\n");

  const flow = await findTufeDataflow(token);
  const dims = await getDimensionOrder(token, flow.id, flow.version);

  const itemDims = guessGeneralItemDimension(dims);
  console.log(
    `[3/5] "Genel/Toplam" boyutu tahmin ediliyor. Aday boyutlar: ${itemDims
      .map((d) => d.id)
      .join(", ")}`
  );

  const seriesValues = { REF_AREA: AGENCY, FREQ: OVERRIDE_FREQ_CODE };
  if (OVERRIDE_ITEM_CODE && itemDims[0]) {
    seriesValues[itemDims[0].id] = OVERRIDE_ITEM_CODE;
  }
  // Not: item kodu bilinmediği için ilk denemede boş bırakılıyor; TÜİK bu durumda
  // genelde tüm alt kalemleri de döndürür. Aşağıda GENEL/TOPLAM/_T adaylarını
  // sonuç içinden regex ile filtrelemeyi deniyoruz.

  const seriesKey = buildSeriesKey(dims, seriesValues);
  const csv = await fetchDataCsv(token, flow.id, flow.version, seriesKey);
  const { header, rows } = parseCsv(csv);

  if (rows.length === 0) {
    throw new Error("Veri sorgusu boş döndü. Seri anahtarını (TUIK_ITEM_CODE) kontrol edin.");
  }

  console.log(`[bilgi] ${rows.length} satır döndü. Sütunlar: ${header.join(", ")}`);

  const timeIdx = header.indexOf("TIME_PERIOD");
  const valueIdx = header.indexOf("OBS_VALUE");
  const itemIdx = itemDims[0] ? header.indexOf(itemDims[0].id) : -1;

  if (timeIdx === -1 || valueIdx === -1) {
    throw new Error(`Beklenen sütunlar (TIME_PERIOD, OBS_VALUE) CSV başlığında bulunamadı: ${header}`);
  }

  // "Genel" satırlarını filtrelemeye çalış: item kodu GENEL/TOPLAM/_T/0 gibi
  // bilinen adaylardan biriyse veya tek bir item kodu varsa onu kullan.
  let filteredRows = rows;
  if (itemIdx !== -1) {
    const uniqueItems = [...new Set(rows.map((r) => r[itemIdx]))];
    if (uniqueItems.length > 1) {
      const generalCandidates = uniqueItems.filter((v) =>
        /^(GENEL|TOPLAM|_T|0|TOTAL)$/i.test(v)
      );
      if (generalCandidates.length === 1) {
        filteredRows = rows.filter((r) => r[itemIdx] === generalCandidates[0]);
        console.log(`[bilgi] Genel endeks kodu bulundu: ${generalCandidates[0]}`);
      } else {
        console.log(
          `\n[uyarı] Birden fazla kalem kodu döndü ve "genel" olanı otomatik ayırt edilemedi.\n` +
            `Bulunan kodlar: ${uniqueItems.slice(0, 20).join(", ")}${uniqueItems.length > 20 ? " ..." : ""}\n` +
            `TUIK_ITEM_CODE ortam değişkeniyle doğru kodu belirtip tekrar çalıştırın.\n`
        );
        process.exit(1);
      }
    }
  }

  const result = {};
  for (const r of filteredRows) {
    result[r[timeIdx]] = parseFloat(r[valueIdx]);
  }

  const fs = await import("node:fs");
  await fs.promises.mkdir(OUT_DIR, { recursive: true });
  await fs.promises.writeFile(
    OUT_FILE,
    JSON.stringify(
      {
        kaynak: "TÜİK SDMX",
        dataflow: `${flow.id} v${flow.version}`,
        cekilme_tarihi: new Date().toISOString(),
        endeks: result,
      },
      null,
      2
    ),
    "utf-8"
  );

  console.log(`\n[5/5] Tamamlandı. ${Object.keys(result).length} dönem "${OUT_FILE}" içine yazıldı.`);
}

main().catch((err) => {
  console.error("\n[HATA]", err.message);
  process.exit(1);
});
