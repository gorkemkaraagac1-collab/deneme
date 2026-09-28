/* LeaseQant UI v2 — GG.AA.YYYY tarih alanları.
   Tarayıcının yerel tarih kutusu (input[type=date]) işletim sistemi diline göre
   mm/dd/yyyy gösterebiliyor. Bu modül her tarih kutusunun yanına Türkçe
   biçimli bir metin kutusu ekler ve ikisini senkron tutar.

   Motorun sözleşmesi değişmez:
   - Özgün <input type="date"> DOM'da, aynı id ve name ile kalır.
   - .value her zaman ISO (YYYY-MM-DD) döner; motor ve formlar bunu okur.
   - Kullanıcı metin kutusuna geçerli bir tarih yazınca özgün kutuya ISO değer
     yazılır ve özgün kutuda "input" + "change" olayları tetiklenir.
   - Kod özgün kutunun .value'sunu değiştirirse metin kutusu kendini günceller.
   - required / disabled / readonly / min / max metin kutusuna yansıtılır.
   Yalnızca html[data-lq-ui="2"] iken çalışır; data-lq-native olan kutulara
   dokunmaz. */
((global) => {
  "use strict";
  const root = document.documentElement;
  if (root.getAttribute("data-lq-ui") !== "2") return;

  const proto = global.HTMLInputElement && global.HTMLInputElement.prototype;
  const valueDesc = proto && Object.getOwnPropertyDescriptor(proto, "value");
  if (!valueDesc || !valueDesc.get || !valueDesc.set) return;

  const pad = n => String(n).padStart(2, "0");
  const esc = v => (global.CSS && typeof global.CSS.escape === "function") ? global.CSS.escape(v) : String(v).replace(/["\\]/g, "\\$&");
  const MESSAGE = "Tarihi GG.AA.YYYY biçiminde girin (örn. 31.12.2026).";

  function isoToTr(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
    return m ? `${m[3]}.${m[2]}.${m[1]}` : "";
  }

  function validParts(y, mo, d) {
    if (y < 1900 || y > 2200 || mo < 1 || mo > 12 || d < 1) return false;
    return d <= new Date(y, mo, 0).getDate();
  }

  /* "31.12.2026", "31/12/2026", "31-12-2026", "3.1.2026", "2026-12-31", "31122026" */
  function parseTr(text) {
    const t = String(text || "").trim();
    if (!t) return "";
    let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
    if (m) {
      const y = +m[1], mo = +m[2], d = +m[3];
      return validParts(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null;
    }
    m = /^(\d{1,2})[./\-\s](\d{1,2})[./\-\s](\d{4})$/.exec(t) || /^(\d{2})(\d{2})(\d{4})$/.exec(t);
    if (!m) return null;
    const d = +m[1], mo = +m[2], y = +m[3];
    return validParts(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null;
  }

  /* Yazarken noktaları kendisi ekler: 01012027 -> 01.01.2027.
     Elle yazılmış kısa biçimler (3.1.2026) olduğu gibi bırakılır. */
  function fromDigits(digits) {
    const d = digits.slice(0, 8);
    if (d.length <= 2) return d;
    if (d.length <= 4) return `${d.slice(0, 2)}.${d.slice(2)}`;
    return `${d.slice(0, 2)}.${d.slice(2, 4)}.${d.slice(4)}`;
  }
  function autoFormat(raw) {
    if (/[^\d.]/.test(raw)) return raw; // yapıştırılan başka biçimlere dokunma
    const parts = raw.split(".");
    const limits = [2, 2, 4];
    const overflow = parts.length > 3 || parts.some((p, i) => p.length > limits[i]);
    if (!raw.includes(".") || overflow) return fromDigits(raw.replace(/\D/g, ""));
    return raw;
  }

  function setNative(input, iso) {
    valueDesc.set.call(input, iso);
  }

  function enhance(input) {
    if (!input || input.__lqDate || input.hasAttribute("data-lq-native")) return;
    if (input.type !== "date") return;
    input.__lqDate = true;

    const wrap = document.createElement("span");
    wrap.className = "lq-date";
    const text = document.createElement("input");
    text.type = "text";
    text.className = "lq-date-text";
    text.inputMode = "numeric";
    text.autocomplete = "off";
    text.placeholder = "GG.AA.YYYY";
    text.setAttribute("data-lq-date-proxy", input.id || input.name || "");
    const pick = document.createElement("button");
    pick.type = "button";
    pick.className = "lq-date-pick";
    pick.setAttribute("aria-label", "Takvimi aç");
    pick.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M3 10h18M8 3v4M16 3v4"></path></svg>';

    input.parentNode.insertBefore(wrap, input);
    wrap.append(text, input, pick);
    const err = document.createElement("small");
    err.className = "lq-date-error";
    err.setAttribute("role", "alert");
    err.hidden = true;
    err.id = `lq-date-err-${Math.random().toString(36).slice(2, 9)}`;
    wrap.after(err);

    input.classList.add("lq-date-native");
    input.tabIndex = -1;
    input.setAttribute("aria-hidden", "true");

    // Etiket: özgün kutunun etiketi metin kutusunu da adlandırsın
    const labelText = (() => {
      const byFor = input.id ? document.querySelector(`label[for="${esc(input.id)}"]`) : null;
      const lbl = byFor || input.closest("label");
      return lbl ? (lbl.textContent || "").replace(/\s+/g, " ").trim() : "";
    })();
    if (labelText) text.setAttribute("aria-label", labelText);
    if (input.getAttribute("aria-describedby")) text.setAttribute("aria-describedby", input.getAttribute("aria-describedby"));

    const setError = msg => {
      text.setCustomValidity(msg || "");
      if (msg) { text.setAttribute("aria-invalid", "true"); err.textContent = msg; err.hidden = false; text.setAttribute("aria-errormessage", err.id); }
      else { text.removeAttribute("aria-invalid"); err.hidden = true; err.textContent = ""; text.removeAttribute("aria-errormessage"); }
    };
    let syncingFromText = false;
    const showFromNative = () => {
      if (syncingFromText) return;
      const tr = isoToTr(valueDesc.get.call(input));
      if (text.value !== tr) text.value = tr;
      setError("");
    };

    // Kod .value yazarsa metin kutusu da güncellenir
    Object.defineProperty(input, "value", {
      configurable: true,
      get() { return valueDesc.get.call(this); },
      set(v) { valueDesc.set.call(this, v); showFromNative(); }
    });
    const vad = Object.getOwnPropertyDescriptor(proto, "valueAsDate");
    if (vad && vad.set) {
      Object.defineProperty(input, "valueAsDate", {
        configurable: true,
        get() { return vad.get.call(this); },
        set(v) { vad.set.call(this, v); showFromNative(); }
      });
    }

    const reqDesc = Object.getOwnPropertyDescriptor(proto, "required");
    const mirrorAttrs = () => {
      // Özgün kutu gizli olduğundan "required" onun üzerinde kalırsa tarayıcı
      // gönderimi odaklanamayan alan hatasıyla sessizce durdurur; zorunluluk
      // metin kutusuna taşınır.
      if (reqDesc.get.call(input)) {
        input.setAttribute("data-lq-required", "1");
        reqDesc.set.call(input, false);
      }
      text.required = input.hasAttribute("data-lq-required");
      text.disabled = input.disabled;
      pick.disabled = input.disabled || input.readOnly;
      text.readOnly = input.readOnly;
    };
    mirrorAttrs();
    new MutationObserver(mirrorAttrs).observe(input, { attributes: true, attributeFilter: ["required", "disabled", "readonly", "min", "max"] });
    // Kod "required=false" yaparsa (örn. opsiyon kapatıldı) metin kutusu da serbest kalır
    if (reqDesc && reqDesc.set) {
      Object.defineProperty(input, "required", {
        configurable: true,
        get() { return this.hasAttribute("data-lq-required") || reqDesc.get.call(this); },
        set(v) {
          if (v) { input.setAttribute("data-lq-required", "1"); text.required = true; }
          else { input.removeAttribute("data-lq-required"); text.required = false; }
          reqDesc.set.call(this, false);
        }
      });
    }

    const inRange = iso => {
      const min = input.getAttribute("min"), max = input.getAttribute("max");
      if (min && iso < min) return `Tarih ${isoToTr(min)} veya sonrası olmalı.`;
      if (max && iso > max) return `Tarih ${isoToTr(max)} veya öncesi olmalı.`;
      return "";
    };

    const commit = (final) => {
      const raw = text.value;
      const iso = parseTr(raw);
      if (iso === null) {
        if (final) setError(MESSAGE);
        return;
      }
      const rangeMsg = iso ? inRange(iso) : "";
      setError(rangeMsg);
      if (final && iso) text.value = isoToTr(iso);
      if (valueDesc.get.call(input) === iso) return;
      syncingFromText = true;
      setNative(input, iso);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      syncingFromText = false;
    };

    text.addEventListener("input", e => {
      if (e.inputType && e.inputType.startsWith("insert")) {
        const f = autoFormat(text.value);
        if (f !== text.value) text.value = f;
      }
      setError("");
      commit(false);
    });
    text.addEventListener("blur", () => commit(true));
    text.addEventListener("keydown", e => {
      if (e.key === "Enter") commit(true);
      if ((e.key === "ArrowDown" && e.altKey) || e.key === "F4") { e.preventDefault(); openPicker(); }
    });

    // Takvim: özgün kutunun yerel seçicisi; seçim olayları normal akar
    function openPicker() {
      if (input.disabled || input.readOnly) return;
      try {
        if (typeof input.showPicker === "function") { input.showPicker(); return; }
      } catch (_) {}
      input.focus();
    }
    pick.addEventListener("click", openPicker);
    input.addEventListener("change", showFromNative);
    input.addEventListener("input", showFromNative);
    // Etikete tıklanınca metin kutusuna odaklan
    input.addEventListener("focus", () => { if (document.activeElement === input) text.focus(); });

    const form = input.form;
    if (form) form.addEventListener("reset", () => setTimeout(showFromNative, 0));
    showFromNative();
  }

  function scan(rootNode) {
    const nodes = rootNode.querySelectorAll ? rootNode.querySelectorAll('input[type="date"]') : [];
    nodes.forEach(enhance);
    if (rootNode.matches && rootNode.matches('input[type="date"]')) enhance(rootNode);
  }

  function init() {
    scan(document);
    new MutationObserver(mutations => {
      mutations.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) scan(n); }));
    }).observe(document.body, { childList: true, subtree: true });
  }

  global.LeaseQantDateFields = Object.freeze({ parseTr, isoToTr });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})(window);
