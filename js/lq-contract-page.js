/* LeaseQant UI v2 — Faz 5: tam sayfa sözleşme detayı.
   - Motorun #detailModal'ını, #detailContent'ini ve tüm olay bağlarını olduğu
     gibi kullanır; yalnızca sunumu değiştirir: v2'de detay, ray (sol menü)
     yanındaki içerik alanını kaplayan bir sayfa olarak açılır.
   - Adres çubuğu: #sozlesme/<id>. Tarayıcı "geri" tuşu detayı kapatır,
     bağlantı yeniden açıldığında (veya paylaşıldığında) aynı sözleşme açılır.
   - Hesaplama, API çağrısı veya veri yazımı yapmaz; açmak için motorun
     GK_TFRS16.openDetail(id) fonksiyonunu, kapatmak için mevcut kapat
     düğmesini kullanır.
   - html[data-lq-ui="2"] değilse hiçbir şey yapmaz. */
((global) => {
  "use strict";
  const doc = global.document;
  const root = doc.documentElement;

  const PREFIX = "#sozlesme/";
  function idFromHash(hash) {
    const h = String(hash || "");
    if (!h.startsWith(PREFIX)) return null;
    try { return decodeURIComponent(h.slice(PREFIX.length)) || null; } catch (_) { return null; }
  }
  const hashFor = id => PREFIX + encodeURIComponent(String(id));

  const helpers = Object.freeze({ idFromHash, hashFor });
  if (root.getAttribute("data-lq-ui") !== "2") { global.LeaseQantContractPage = helpers; return; }

  const $ = id => doc.getElementById(id);
  let modal = null;
  let pushed = false;        // bu oturumda adres çubuğuna kayıt eklendi mi
  let closingFromHistory = false;
  let baseTitle = doc.title;
  let lastFocus = null;

  const isOpen = () => !!modal && !modal.classList.contains("hidden");
  const selectedId = () => {
    try { return global.GK_TFRS16?.getSelectedContractId?.() || null; } catch (_) { return null; }
  };

  function closeDetail() {
    const btn = $("closeDetailModal") || $("closeDetailModalFooter");
    if (btn) btn.click(); else modal?.classList.add("hidden");
  }

  function buildHeader() {
    const header = modal.querySelector(".modal-header");
    if (!header || header.querySelector(".lq-cp-back")) return;
    const back = doc.createElement("button");
    back.type = "button";
    back.className = "lq-cp-back";
    back.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"></path></svg><span>Sözleşmeler</span>';
    back.setAttribute("aria-label", "Sözleşme listesine dön");
    back.addEventListener("click", closeDetail);
    header.prepend(back);
    const x = $("closeDetailModal");
    if (x) x.setAttribute("aria-label", "Detayı kapat");
  }

  /* Sayfa bağlam çubuğunun (dönem şeridi, şirket) altında açılır. */
  function measureContext() {
    const bar = $("lqContextBar");
    const h = bar ? Math.round(bar.getBoundingClientRect().bottom) : 0;
    root.style.setProperty("--lq-ctx-h", `${Math.max(0, h)}px`);
  }

  function onOpened() {
    measureContext();
    lastFocus = doc.activeElement && doc.activeElement !== doc.body ? doc.activeElement : null;
    const id = selectedId();
    const title = ($("detailTitle")?.textContent || "").trim();
    doc.title = `${title || "Sözleşme"} · LeaseQant`;
    root.setAttribute("data-lq-detail-page", "open");
    if (id && idFromHash(global.location.hash) !== String(id)) {
      const url = `${global.location.pathname}${global.location.search}${hashFor(id)}`;
      if (idFromHash(global.location.hash)) global.history.replaceState(global.history.state, "", url);
      else { global.history.pushState({ lqContract: String(id) }, "", url); pushed = true; }
    }
    modal.scrollTop = 0;
    modal.querySelector(".modal-card")?.scrollTo?.(0, 0);
    global.requestAnimationFrame?.(() => $("detailTitle")?.focus?.({ preventScroll: true }));
  }

  function onClosed() {
    root.removeAttribute("data-lq-detail-page");
    doc.title = baseTitle;
    if (!closingFromHistory && idFromHash(global.location.hash)) {
      if (pushed) { pushed = false; global.history.back(); }
      else global.history.replaceState(global.history.state, "", `${global.location.pathname}${global.location.search}`);
    }
    pushed = false;
    closingFromHistory = false;
    if (lastFocus && lastFocus.isConnected) lastFocus.focus?.({ preventScroll: true });
    lastFocus = null;
  }

  /* Bağlantıyla gelinirse: sözleşmeler yüklenene kadar bekleyip açar. */
  let openTimer = 0;
  function openFromHash(id) {
    global.clearInterval(openTimer);
    if (!id) return;
    let tries = 0;
    const attempt = () => {
      tries++;
      if (isOpen() && selectedId() === id) { global.clearInterval(openTimer); return; }
      const open = global.GK_TFRS16?.openDetail;
      if (typeof open === "function") {
        try { open(id); } catch (_) {}
        if (isOpen()) { global.clearInterval(openTimer); return; }
      }
      if (tries >= 40) {
        global.clearInterval(openTimer);
        global.history.replaceState(global.history.state, "", `${global.location.pathname}${global.location.search}`);
        global.GK_TFRS16?.showAlert?.("Bağlantıdaki sözleşme bulunamadı veya erişim yetkiniz yok.", "warning");
      }
    };
    openTimer = global.setInterval(attempt, 500);
    attempt();
  }

  function onHistory() {
    const id = idFromHash(global.location.hash);
    if (!id && isOpen()) { closingFromHistory = true; pushed = false; closeDetail(); return; }
    if (id && (!isOpen() || selectedId() !== id)) { pushed = false; openFromHash(id); }
  }

  function init() {
    modal = $("detailModal");
    if (!modal) return;
    modal.classList.add("lq-detail-page");
    modal.setAttribute("aria-modal", "false");
    modal.setAttribute("aria-labelledby", "detailTitle");
    $("detailTitle")?.setAttribute("tabindex", "-1");
    buildHeader();
    let wasOpen = isOpen();
    new MutationObserver(() => {
      const open = isOpen();
      if (open === wasOpen) return;
      wasOpen = open;
      if (open) onOpened(); else onClosed();
    }).observe(modal, { attributes: true, attributeFilter: ["class"] });
    // Başlık değişince (yeniden çizim) sekme başlığını da güncelle
    const title = $("detailTitle");
    if (title) new MutationObserver(() => {
      if (!isOpen()) return;
      doc.title = `${title.textContent.trim() || "Sözleşme"} · LeaseQant`;
      const id = selectedId(); // detay açıkken başka sözleşmeye geçildiyse adresi düzelt
      if (id && idFromHash(global.location.hash) && idFromHash(global.location.hash) !== String(id)) {
        global.history.replaceState(global.history.state, "", `${global.location.pathname}${global.location.search}${hashFor(id)}`);
      }
    }).observe(title, { childList: true, characterData: true, subtree: true });

    // Detay açıkken sol menüden başka bir ekrana geçilirse detay kapanır
    doc.addEventListener("click", e => {
      if (!isOpen()) return;
      const nav = e.target.closest?.("#sidebarNav .nav-item, .lq-topnav-shell .nav-item");
      if (nav) closeDetail();
    }, true);

    global.addEventListener("resize", () => { if (isOpen()) measureContext(); });
    global.addEventListener("popstate", onHistory);
    global.addEventListener("hashchange", onHistory);
    const initial = idFromHash(global.location.hash);
    if (initial) {
      doc.querySelector('.nav-item[data-view="contracts"]')?.click();
      openFromHash(initial);
    }
  }

  global.LeaseQantContractPage = Object.freeze({ ...helpers, open: id => openFromHash(String(id)) });
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})(window);
