/**
 * @jest-environment jsdom
 *
 * ============================================================
 * FAZ A — SIDEBAR BİLGİ MİMARİSİ YENİDEN YAPILANDIRMASI
 * ============================================================
 *
 * Sorun (kullanıcı geri bildirimi): dashboard 10 tur boyunca parça
 * parça, her seferinde "bir link daha ekle" şeklinde büyüdü. Ortaya
 * bilgi mimarisi olmayan, 16 linklik düz bir liste çıktı — "Genel"
 * grubu tek başına 8 link taşıyordu, 6 farklı link AYNI (⌁) ikonu
 * kullanıyordu, ve aktif sayfa vurgusu hiç çalışmıyordu (her zaman
 * "Genel Bakış" aktif görünüyordu).
 *
 * Faz A: sidebar 5 mantıksal gruba ayrıldı, "Yeni Sözleşme" ayrı
 * link olmaktan çıkıp Sözleşmeler satırının içinde bir "+" aksiyonu
 * oldu, ikonlar ayrıştırıldı, aktif sayfa vurgusu çalışır hale
 * getirildi.
 *
 * NOT: Modifikasyon/SLB/Sublease sidebar'da KALDI (kendi "Sözleşme
 * İşlemleri" grubunda) — bunların sözleşme detayına tab olarak geri
 * taşınması Faz B'nin konusu, henüz onaylanmadı.
 */

const fs = require("fs");
const path = require("path");

function dashboardHtml() {
  return fs.readFileSync(path.join(__dirname, "../frontend/dashboard.html"), "utf-8");
}

function sidebarSection() {
  const html = dashboardHtml();
  return html.match(/<nav class="side-nav">[\s\S]*?<\/nav>/)[0];
}

describe("Sidebar grup yapısı — 5 mantıksal grup", () => {
  test("dört grup başlığı da mevcut ve doğru sırada", () => {
    // FAZ B GÜNCELLEMESİ: "Sözleşme İşlemleri" grubu KALDIRILDI —
    // içindeki üç modül (Modifikasyon & Reassessment / SLB / Alt
    // Kiralama) sözleşme detay ekranına TAB olarak geri taşındı
    // (bkz. test/contract-detail-tabs-faz-b.test.js). Bu, dört ayrı
    // senkronize olmayan sözleşme seçici sorununu çözdü.
    const nav = sidebarSection();
    const labels = [...nav.matchAll(/<div class="side-group-label">(.*?)<\/div>/g)].map(m => m[1]);
    expect(labels).toEqual([
      "Genel",
      "Raporlama",
      "Kapanış &amp; Kontrol",
      "Tanımlar"
    ]);
  });

  test("'Genel' grubu artık 8 değil, sadece 2 link içeriyor (Genel Bakış + Sözleşmeler)", () => {
    const nav = sidebarSection();
    const genelBlock = nav.split('<div class="side-group-label">')[1]; // "Genel" bloğu
    const linkCount = (genelBlock.match(/class="side-link"/g) || []).length
      + (genelBlock.match(/class="side-link active"/g) || []).length;
    expect(linkCount).toBe(2);
  });

  test("13 portföy-seviyesi modül linki mevcut (3'ü Faz B'de sözleşme detayına taşındı)", () => {
    // FAZ B GÜNCELLEMESİ: modification/slb/sublease artık sidebar'da
    // DEĞİL — sözleşme detay ekranında tab olarak. Fonksiyonları
    // silinmedi (eski ?open=... deep-link'leri çalışmaya devam eder),
    // yalnızca sidebar'dan kaldırıldılar.
    const nav = sidebarSection();
    const keys = [...nav.matchAll(/data-v26-open="([^"]+)"/g)].map(m => m[1]);
    expect(keys.sort()).toEqual([
      "accountMapping", "accountingCenter", "audit", "close", "companies",
      "consolidation", "eliminations", "financialReporting", "footnotes",
      "fxRates", "groups", "inflation", "riskControls"
    ].sort());
  });
});

describe("İkon ayrıştırması — aynı ikon tekrarı azaltıldı", () => {
  test("önceden 6 link tarafından paylaşılan ⌁ ikonu artık kullanılmıyor", () => {
    const nav = sidebarSection();
    expect(nav).not.toMatch(/⌁/);
  });

  test("hiçbir ikon 2'den fazla link tarafından paylaşılmıyor", () => {
    const nav = sidebarSection();
    const icons = [...nav.matchAll(/<span class="side-ic">(.*?)<\/span>/g)].map(m => m[1]);
    const counts = {};
    icons.forEach(i => { counts[i] = (counts[i] || 0) + 1; });
    const overused = Object.entries(counts).filter(([, n]) => n > 2);
    expect(overused).toEqual([]);
  });
});

describe("'Yeni Sözleşme' — ayrı link değil, Sözleşmeler satırında + aksiyonu", () => {
  test("newContractButton, Sözleşmeler linkinin İÇİNDE ve side-inline-add class'ına sahip", () => {
    const nav = sidebarSection();
    const contractsLink = nav.match(/<a[^>]*data-nav-key="contracts"[\s\S]*?<\/a>/)[0];
    expect(contractsLink).toMatch(/id="newContractButton"/);
    expect(contractsLink).toMatch(/class="side-inline-add"/);
  });

  test("artık ayrı bir 'Yeni Sözleşme' side-link satırı YOK", () => {
    const nav = sidebarSection();
    expect(nav).not.toMatch(/class="side-link"[^>]*>[\s\S]{0,80}Yeni Sözleşme/);
  });

  test("side-inline-add için CSS tanımlı (görünmez buton riski yok)", () => {
    const html = dashboardHtml();
    expect(html).toMatch(/\.side-inline-add\s*{/);
    expect(html).toMatch(/\.side-inline-add:hover\s*{/);
  });
});

describe("İsimlendirme tutarlılığı — Türkçe", () => {
  test("'Close Dashboard' → 'Ay Sonu Kapanış'", () => {
    const nav = sidebarSection();
    expect(nav).not.toMatch(/Close Dashboard/);
    expect(nav).toMatch(/Ay Sonu Kapanış/);
  });

  test("'Kur Yönetimi (TCMB)' → 'Döviz Kurları (TCMB)'", () => {
    const nav = sidebarSection();
    expect(nav).toMatch(/Döviz Kurları \(TCMB\)/);
  });

  test("'Enflasyon Düzeltmesi' → 'Enflasyon Endeksleri' (sayfa gerçekte endeks yönetimi)", () => {
    const nav = sidebarSection();
    expect(nav).toMatch(/Enflasyon Endeksleri/);
  });
});

describe("Aktif sayfa vurgusu — artık çalışıyor", () => {
  test("her linkte data-nav-key var (aktif durumu takip edilebilir)", () => {
    const nav = sidebarSection();
    const links = (nav.match(/class="side-link[^"]*"/g) || []).length;
    const navKeys = (nav.match(/data-nav-key="/g) || []).length;
    expect(navKeys).toBe(links);
  });

  test("gkSetActiveNav fonksiyonu tanımlı ve tıklamada çağrılıyor", () => {
    const html = dashboardHtml();
    expect(html).toMatch(/function gkSetActiveNav/);
    expect(html).toMatch(/gkSetActiveNav\(link\)/);
  });

  test("'Genel Bakış' linki artık işlevsel (v26PageHost'u gizliyor)", () => {
    const html = dashboardHtml();
    expect(html).toMatch(/data-nav-key="overview"/);
    expect(html).toMatch(/host\.style\.display = "none"/);
  });

  test("mobilde sayfa açılınca sidebar kapanıyor", () => {
    const html = dashboardHtml();
    const handlerBlock = html.match(/document\.querySelectorAll\("\[data-v26-open\]"\)[\s\S]*?\}\);\s*\}\);/)[0];
    expect(handlerBlock).toMatch(/sidebar[\s\S]*?classList\.remove\("open"\)/);
  });
});

describe("Emergency bridge uyumluluğu — + butonu bozulmadı", () => {
  test("newContractButton'a stopPropagation ekleyen bir handler YOK (bridge'i engellerdi)", () => {
    const html = dashboardHtml();
    // Bu spesifik hatayı bir kez yapıp düzelttik — regresyon testi.
    const badPattern = /getElementById\("newContractButton"\)\?\.addEventListener\([\s\S]{0,200}stopPropagation/;
    expect(html).not.toMatch(badPattern);
  });
});
