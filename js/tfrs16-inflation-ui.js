/*
 * TFRS16 UI slice: verified inflation-index read-only screen.
 *
 * The calculation engine stays private. This file only renders the admin
 * view from the public shell's already-hydrated, private-backed result API.
 */
(() => {
  const escapeHtml = value => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  function render(container) {
    if (!container) return;
    const api = window.GK_TFRS16 || {};
    try { api.injectV26Styles?.(); } catch (_) {}

    const rows = (typeof api.loadInflationIndexTable === "function"
      ? api.loadInflationIndexTable()
      : [])
      .slice()
      .sort((a, b) => String(a.month).localeCompare(String(b.month)));

    container.innerHTML = `
      <div class="gk-v26-page">
        <div class="gk-v26-card" style="background:#eff6ff;border-color:#bfdbfe;">
          <h2 style="margin:0 0 8px;font-size:18px;color:#0f172a;">Enflasyon Endeksleri artık Admin Panel'den yönetiliyor</h2>
          <p style="margin:0;font-size:13px;color:#334155;line-height:1.6;">
            TÜİK otomatik senkronizasyonu bu release kapsamında devre dışı. Aylık TÜFE endeksleri
            artık yalnızca yetkili bir admin tarafından, Admin Panel &rarr; Enflasyon Endeksleri
            ekranından girilip doğrulanabiliyor (PENDING &rarr; VERIFIED). Bu sayfadan manuel giriş
            kaldırıldı — aşağıda TFRS16 hesaplamasının şu anda kullandığı (backend'den VERIFIED
            olarak onaylanmış) endeksler salt-okunur şekilde listeleniyor.
          </p>
        </div>

        <div class="gk-v26-card">
          <h3 style="margin:0 0 8px;font-size:15px;">Hesaplamada Kullanılan Endeksler <span style="font-size:12px;color:#94a3b8;">(${rows.length} kayıt, salt-okunur)</span></h3>
          <div style="overflow:auto;">
            <table class="gk-v26-table">
              <thead><tr><th>Ay</th><th>Endeks Değeri</th></tr></thead>
              <tbody>
                ${rows.map(row => `
                  <tr>
                    <td><strong>${escapeHtml(row.month)}</strong></td>
                    <td>${Number(row.index).toFixed(6)}</td>
                  </tr>`).join("") ||
                  `<tr><td colspan="2" style="text-align:center;color:#94a3b8;padding:24px;">Henüz backend'den doğrulanmış endeks yüklenmedi (sayfa yeni açıldıysa birkaç saniye bekleyip yenileyin, veya Admin Panel'den kontrol edin).</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      </div>`;
  }

  window.LeaseQantTfrs16InflationUi = { render };
})();
