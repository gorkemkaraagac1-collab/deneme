/* Dipnot varsayımları: kullanıcıların uygulama içinden değiştirdiği şirket
   girdileri (vade dilimleri, sözleşme bazında varlık sınıfı, şirket
   beyanları). Yalnızca değiştirilen alanlar gönderilir; "Varsayılana dön"
   alanı sistem varsayılanına bırakır. Tutar hesaplamaz. */
(function (global) {
  "use strict";
  const doc = global.document;
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const CLASSES = [["PROPERTY", "Gayrimenkul"], ["VEHICLES", "Taşıtlar"], ["PLANT_EQUIPMENT", "Makine ve ekipman"],
    ["IT_EQUIPMENT", "Bilgi teknolojileri ekipmanı"], ["OTHER", "Diğer"]];
  const FIELDS = [["leasingActivity", "Kiralama faaliyetinin niteliği"], ["extensionTerminationExposure", "Uzatma ve fesih seçenekleri"],
    ["unrecognizedVariableExposure", "Ölçüme dahil edilmeyen değişken ödemeler"], ["residualValueGuaranteeExposure", "Kalıntı değer garantileri"],
    ["notYetCommencedCommitments", "Henüz başlamamış kiralama taahhütleri"], ["leaseRestrictionsOrCovenants", "Kiralama kısıtları ve taahhütleri"],
    ["saleAndLeasebackInformation", "Satış ve geri kiralama"], ["shortTermElection", "Kısa vadeli kiralama istisnası"],
    ["lowValueElection", "Düşük değerli varlık istisnası"], ["rentConcessionExpedient", "Kira imtiyazı kolaylaştırıcı uygulaması"],
    ["investmentPropertyRou", "Yatırım amaçlı gayrimenkul kullanım hakkı (TFRS 16.56)"], ["revaluedRou", "Yeniden değerlenmiş kullanım hakkı (TFRS 16.57)"]];
  const ERRORS = { DISCLOSURE_INPUT_REASON_REQUIRED: "'Uygulanmaz' için gerekçe yazın.", DISCLOSURE_INPUT_TEXT_REQUIRED: "Metin boş olamaz.",
    DISCLOSURE_INPUT_BANDS_INVALID: "Vade dilimleri artan ve birbirini izleyen gün sınırlarıyla girilmeli; son dilim açık uçludur.",
    DISCLOSURE_INPUT_WRITE_DENIED: "Bu işlem için yazma yetkiniz yok.", PERIOD_CLOSED: "Dönem kapalı; değişiklik yapılamaz.",
    DISCLOSURE_ENTITY_PROFILE_REQUIRED: "Şirketin onaylı para birimi profili yok." };
  const chip = source => source === "COMPANY"
    ? '<span class="lq-di-chip is-co">Şirket</span>' : '<span class="lq-di-chip">Sistem varsayılanı</span>';

  function injectStyles() {
    if (doc.getElementById("lqDiStyles")) return;
    const style = doc.createElement("style");
    style.id = "lqDiStyles";
    style.textContent = `.lq-di-back{position:fixed;inset:0;background:rgba(11,22,40,.45);z-index:9000;display:flex;justify-content:flex-end}
.lq-di{width:min(760px,100%);height:100%;background:#fff;display:flex;flex-direction:column;font-size:13.5px;color:#0B1628}
.lq-di-head{padding:18px 22px;border-bottom:1px solid #E3E7EE;display:flex;gap:12px;align-items:flex-start}
.lq-di-head h2{margin:0;font-size:18px;font-weight:600}.lq-di-head p{margin:4px 0 0;color:#46546A;font-size:12.5px}
.lq-di-x{margin-left:auto;border:0;background:none;font-size:22px;cursor:pointer;color:#46546A}
.lq-di-body{padding:16px 22px;overflow:auto;flex:1;display:grid;gap:18px}
.lq-di-sec h3{margin:0 0 8px;font-size:12px;letter-spacing:.06em;color:#5E6A7D;text-transform:uppercase}
.lq-di-chip{display:inline-block;font-size:11px;padding:2px 7px;border-radius:999px;background:#F1F4F8;color:#46546A;white-space:nowrap}
.lq-di-chip.is-co{background:#EAF1FD;color:#1660D6}
.lq-di table{width:100%;border-collapse:collapse}.lq-di td,.lq-di th{padding:6px 8px;border-bottom:1px solid #EEF1F5;text-align:left;vertical-align:top}
.lq-di input[type=text],.lq-di input[type=number],.lq-di select,.lq-di textarea{width:100%;box-sizing:border-box;border:1px solid #CBD3DF;border-radius:6px;padding:6px 8px;font:inherit}
.lq-di textarea{min-height:64px;resize:vertical}.lq-di-field{border:1px solid #E3E7EE;border-radius:8px;padding:10px 12px;display:grid;gap:6px}
.lq-di-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.lq-di-link{border:0;background:none;color:#1660D6;cursor:pointer;padding:0;font:inherit;font-size:12.5px}
.lq-di-foot{padding:14px 22px;border-top:1px solid #E3E7EE;display:flex;gap:10px;align-items:center}
.lq-di-btn{height:36px;padding:0 14px;border-radius:8px;border:1px solid #CBD3DF;background:#fff;cursor:pointer;font:inherit}
.lq-di-btn.is-primary{background:#1660D6;border-color:#1660D6;color:#fff}.lq-di-btn:disabled{opacity:.5;cursor:default}
.lq-di-msg{font-size:12.5px}.lq-di-msg.is-err{color:#B42318}.lq-di-msg.is-ok{color:#0F766E}.lq-di-muted{color:#5E6A7D;font-size:12px}`;
    doc.head.appendChild(style);
  }

  function open({ companyId, companyName, period, onSaved }) {
    const api = global.LeaseQantPrivateCalculation;
    if (!api?.getDisclosureInputs || !companyId) return;
    injectStyles();
    const back = doc.createElement("div");
    back.className = "lq-di-back";
    back.innerHTML = `<div class="lq-di" role="dialog" aria-modal="true" aria-labelledby="lqDiTitle"><div class="lq-di-head"><div>
      <h2 id="lqDiTitle">Dipnot varsayımları</h2><p>${esc(companyName || companyId)} · ${esc(period.reportingPeriodStart)} – ${esc(period.reportingPeriodEnd)}</p></div>
      <button type="button" class="lq-di-x" aria-label="Kapat" data-di="close">×</button></div>
      <div class="lq-di-body"><p class="lq-di-muted">Yükleniyor…</p></div>
      <div class="lq-di-foot"><button type="button" class="lq-di-btn is-primary" data-di="save" disabled>Kaydet</button>
      <button type="button" class="lq-di-btn" data-di="close">Vazgeç</button><span class="lq-di-msg" role="status" aria-live="polite"></span></div></div>`;
    doc.body.appendChild(back);
    const body = back.querySelector(".lq-di-body"), msg = back.querySelector(".lq-di-msg"), save = back.querySelector('[data-di="save"]');
    let data = null;
    const changes = { assetClassByContract: {}, disclosures: {}, maturityBands: undefined, tms29Applies: undefined };
    const close = () => { back.remove(); doc.removeEventListener("keydown", onKey); };
    const onKey = event => { if (event.key === "Escape") close(); };
    doc.addEventListener("keydown", onKey);
    back.addEventListener("click", event => { if (event.target === back || event.target.closest('[data-di="close"]')) close(); });
    const setMsg = (text, kind) => { msg.textContent = text || ""; msg.className = `lq-di-msg${kind ? ` is-${kind}` : ""}`; };
    const dirty = () => Object.keys(changes.assetClassByContract).length || Object.keys(changes.disclosures).length
      || changes.maturityBands !== undefined || changes.tms29Applies !== undefined;
    const refreshSave = () => { save.disabled = !data?.canEdit || !dirty(); };

    function bandsHtml(bands, editable) {
      return `<table><thead><tr><th>Dilim adı</th><th>Raporlama tarihinden itibaren (gün, dahil)</th><th></th></tr></thead><tbody>${bands.map((b, i) => {
        const last = i === bands.length - 1;
        return `<tr><td>${editable ? `<input type="text" data-band-label="${i}" value="${esc(b.label)}" maxlength="60">` : esc(b.label)}</td>
          <td>${last ? `${esc(b.fromDaysInclusive ?? "")} ve sonrası` : editable
            ? `<input type="number" min="1" step="1" data-band-through="${i}" value="${esc(b.throughDaysInclusive)}">` : `${esc(b.fromDaysInclusive)} – ${esc(b.throughDaysInclusive)}`}</td>
          <td>${editable && bands.length > 2 ? `<button type="button" class="lq-di-link" data-band-remove="${i}">Kaldır</button>` : ""}</td></tr>`;
      }).join("")}</tbody></table>`;
    }

    function render() {
      const editable = data.canEdit;
      const bands = changes.maturityBands === undefined ? data.maturity.bands : (changes.maturityBands || data.maturity.defaultBands);
      const bandSource = changes.maturityBands === null ? "SYSTEM_DEFAULT" : changes.maturityBands ? "COMPANY" : data.maturity.source;
      body.innerHTML = `${!editable ? '<p class="lq-di-muted">Salt okunur görünüm: değişiklik için sözleşme yazma yetkisi gerekir.</p>' : ""}
        ${data.companyInput?.carriedForwardFrom ? `<p class="lq-di-muted">Şirket değerleri ${esc(data.companyInput.carriedForwardFrom.start)} – ${esc(data.companyInput.carriedForwardFrom.end)} döneminden devrediyor; kaydederseniz bu dönem için yeni kayıt oluşur.</p>` : ""}
        ${data.tms29 ? (() => {
          const applies = changes.tms29Applies === undefined ? data.tms29.applies : changes.tms29Applies === null ? data.tms29.default : changes.tms29Applies;
          const source = changes.tms29Applies === undefined ? data.tms29.source : changes.tms29Applies === null ? "SYSTEM_DEFAULT" : "COMPANY";
          return `<section class="lq-di-sec"><h3>Yüksek enflasyon (TMS 29) ${chip(source)}</h3><div class="lq-di-field">
            <label class="lq-di-row"><input type="checkbox" data-tms29 ${applies ? "checked" : ""} ${editable ? "" : "disabled"}> Kullanım hakkı varlıkları TMS 29 uyarınca TÜFE ile düzeltilsin</label>
            <span class="lq-di-muted">Varsayılan: fonksiyonel para birimi TRY ve 31.12.2023 ve sonrası biten dönemlerde uygulanır (KGK). Kira yükümlülüğü parasal kalemdir, düzeltilmez.</span>
            ${editable && source === "COMPANY" ? '<div><button type="button" class="lq-di-link" data-tms29-reset>Varsayılana dön</button></div>' : ""}</div></section>`;
        })() : ""}
        <section class="lq-di-sec"><h3>Vade dilimleri (iskonto edilmemiş) ${chip(bandSource)}</h3>${bandsHtml(bands, editable)}
          ${editable ? `<div class="lq-di-row" style="margin-top:6px"><button type="button" class="lq-di-link" data-band-add>Dilim ekle</button>
          ${bandSource === "COMPANY" ? '<button type="button" class="lq-di-link" data-band-reset>Varsayılana dön</button>' : ""}</div>` : ""}</section>
        <section class="lq-di-sec"><h3>Varlık sınıfı</h3><table><thead><tr><th>Sözleşme</th><th>Sözleşmedeki sınıf</th><th>Dipnot sınıfı</th><th></th></tr></thead><tbody>
          ${data.contracts.map(c => {
            const pending = changes.assetClassByContract[c.id];
            const value = pending === undefined ? c.assetClass : (pending === null ? c.defaultAssetClass : pending);
            const source = pending === undefined ? c.source : pending === null ? "SYSTEM_DEFAULT" : "COMPANY";
            return `<tr><td>${esc(c.id)}<div class="lq-di-muted">${esc(c.supplier || "")}</div></td><td>${esc(c.assetClassText || "—")}</td>
              <td>${editable ? `<select data-class="${esc(c.id)}">${CLASSES.map(([k, l]) => `<option value="${k}" ${k === value ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`
                : esc((CLASSES.find(([k]) => k === value) || [, value])[1])}</td>
              <td>${chip(source)}${editable && source === "COMPANY" ? ` <button type="button" class="lq-di-link" data-class-reset="${esc(c.id)}">Varsayılan</button>` : ""}</td></tr>`;
          }).join("") || '<tr><td colspan="4" class="lq-di-muted">Bu dönemde sözleşme yok.</td></tr>'}</tbody></table></section>
        <section class="lq-di-sec"><h3>Şirket beyanları</h3><div style="display:grid;gap:10px">${FIELDS.filter(([key]) => data.disclosures[key]).map(([key, label]) => {
          const pending = changes.disclosures[key];
          const current = pending === undefined ? data.disclosures[key] : pending === null ? { ...data.disclosures[key].default, source: "SYSTEM_DEFAULT" } : { ...pending, source: "COMPANY" };
          const na = current.status === "NOT_APPLICABLE";
          return `<div class="lq-di-field"><div class="lq-di-row"><strong>${esc(label)}</strong>${chip(current.source)}
            ${editable ? `<label class="lq-di-muted" style="margin-left:auto"><input type="checkbox" data-na="${key}" ${na ? "checked" : ""}> Uygulanmaz</label>` : ""}</div>
            ${editable ? `<textarea data-text="${key}" placeholder="${na ? "Neden uygulanmadığını yazın" : "Dipnot metni"}">${esc(na ? current.reason : current.value)}</textarea>`
              : `<div>${esc(na ? `Uygulanmaz — ${current.reason || ""}` : current.value || "—")}</div>`}
            ${editable && current.source === "COMPANY" ? `<div><button type="button" class="lq-di-link" data-text-reset="${key}">Sistem metnine dön</button></div>` : ""}</div>`;
        }).join("")}</div></section>`;
      refreshSave();
    }

    function setDisclosure(key, next) {
      const stored = data.disclosures[key] || {};
      const same = next.status === "NOT_APPLICABLE"
        ? stored.status === "NOT_APPLICABLE" && (stored.reason || "") === next.reason
        : stored.status !== "NOT_APPLICABLE" && (stored.value || "") === next.value;
      if (same) delete changes.disclosures[key];
      else changes.disclosures[key] = next;
    }

    function readBands() {
      const base = changes.maturityBands || (changes.maturityBands === null ? data.maturity.defaultBands : data.maturity.bands);
      return base.map((band, i) => {
        const label = body.querySelector(`[data-band-label="${i}"]`)?.value ?? band.label;
        const through = body.querySelector(`[data-band-through="${i}"]`);
        return { label, throughDaysInclusive: i === base.length - 1 ? null : Number(through ? through.value : band.throughDaysInclusive) };
      });
    }

    body.addEventListener("change", event => {
      const t = event.target;
      // A value set back to what is stored is no longer a change.
      if (t.dataset.class) {
        const stored = data.contracts.find(c => c.id === t.dataset.class)?.assetClass;
        if (t.value === stored) delete changes.assetClassByContract[t.dataset.class];
        else changes.assetClassByContract[t.dataset.class] = t.value;
        render(); return;
      }
      if (t.dataset.tms29 !== undefined) { changes.tms29Applies = t.checked === data.tms29.applies ? undefined : t.checked; render(); return; }
      if (t.dataset.na) {
        const key = t.dataset.na, text = body.querySelector(`[data-text="${key}"]`)?.value || "";
        setDisclosure(key, t.checked ? { status: "NOT_APPLICABLE", reason: text } : { value: text });
        render(); return;
      }
      if (t.dataset.bandLabel !== undefined || t.dataset.bandThrough !== undefined) {
        const bands = readBands();
        const same = JSON.stringify(bands) === JSON.stringify(data.maturity.bands.map(b => ({ label: b.label, throughDaysInclusive: b.throughDaysInclusive })));
        changes.maturityBands = same ? undefined : bands;
        refreshSave();
      }
    });
    body.addEventListener("input", event => {
      const t = event.target;
      if (!t.dataset.text) return;
      const key = t.dataset.text, na = body.querySelector(`[data-na="${key}"]`)?.checked;
      setDisclosure(key, na ? { status: "NOT_APPLICABLE", reason: t.value } : { value: t.value });
      refreshSave();
    });
    body.addEventListener("click", event => {
      const t = event.target;
      if (t.dataset.tms29Reset !== undefined) { changes.tms29Applies = null; render(); }
      else if (t.dataset.classReset) { changes.assetClassByContract[t.dataset.classReset] = null; render(); }
      else if (t.dataset.textReset) { changes.disclosures[t.dataset.textReset] = null; render(); }
      else if (t.dataset.bandReset !== undefined) { changes.maturityBands = null; render(); }
      else if (t.dataset.bandAdd !== undefined) {
        const bands = readBands(), last = bands[bands.length - 1], prev = bands[bands.length - 2];
        const from = prev ? prev.throughDaysInclusive + 1 : 0;
        bands.splice(bands.length - 1, 0, { label: "Yeni dilim", throughDaysInclusive: from + 364 });
        last.label = last.label || "Sonrası";
        changes.maturityBands = bands; render();
      } else if (t.dataset.bandRemove !== undefined) {
        const bands = readBands(); bands.splice(Number(t.dataset.bandRemove), 1);
        bands[bands.length - 1].throughDaysInclusive = null; changes.maturityBands = bands; render();
      }
    });
    save.addEventListener("click", async () => {
      if (!dirty()) return;
      save.disabled = true; setMsg("Kaydediliyor…");
      const payload = {};
      if (Object.keys(changes.assetClassByContract).length) payload.assetClassByContract = changes.assetClassByContract;
      if (Object.keys(changes.disclosures).length) payload.disclosures = changes.disclosures;
      if (changes.maturityBands !== undefined) payload.maturityBands = changes.maturityBands;
      if (changes.tms29Applies !== undefined) payload.tms29Applies = changes.tms29Applies;
      try {
        const result = await api.saveDisclosureInputs(companyId, period, payload);
        data = { ...result.inputs, canEdit: data.canEdit };
        changes.assetClassByContract = {}; changes.disclosures = {}; changes.maturityBands = undefined; changes.tms29Applies = undefined;
        render(); setMsg("Kaydedildi. Dipnot yenileniyor.", "ok");
        onSaved?.();
      } catch (error) {
        setMsg(ERRORS[error?.code] || `Kaydedilemedi: ${error?.code || error?.message || "hata"}`, "err");
        refreshSave();
      }
    });

    api.getDisclosureInputs(companyId, period).then(result => { data = result; render(); })
      .catch(error => { body.innerHTML = `<p class="lq-di-msg is-err">Varsayımlar alınamadı: ${esc(ERRORS[error?.code] || error?.code || error?.message)}</p>`; });
  }

  global.LeaseQantDisclosureInputsUi = Object.freeze({ open });
})(window);
