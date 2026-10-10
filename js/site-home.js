/* LeaseQant pazarlama sayfaları: mobil menü, SSS (yönetim panelinden), demo talep formu. */
(function () {
  "use strict";
  var API_BASE = "https://api.leaseqant.com";
  var MAIL = "info@leaseqant.com";
  var english = document.documentElement.lang === "en";
  function t(tr, en) { return english ? en : tr; }
  var doc = document;

  /* ---------- mobil menü ---------- */
  var burger = doc.querySelector(".nav-burger");
  var sheet = doc.getElementById("navSheet");
  if (burger && sheet) {
    var setOpen = function (open) {
      sheet.hidden = !open;
      burger.setAttribute("aria-expanded", String(open));
      burger.setAttribute("aria-label", open ? "Menüyü kapat" : "Menüyü aç");
    };
    burger.addEventListener("click", function () { setOpen(sheet.hidden); });
    sheet.addEventListener("click", function (e) { if (e.target.closest("a")) setOpen(false); });
    doc.addEventListener("keydown", function (e) { if (e.key === "Escape" && !sheet.hidden) { setOpen(false); burger.focus(); } });
  }

  /* ---------- SSS: yayınlanmış kayıtlar varsa onları göster ---------- */
  function escapeHtml(value) {
    var div = doc.createElement("div");
    div.textContent = String(value == null ? "" : value);
    return div.innerHTML;
  }
  function sanitizeFaqHtml(value) {
    var template = doc.createElement("template");
    template.innerHTML = String(value == null ? "" : value);
    var allowed = { STRONG: true, CODE: true, EM: true, B: true, BR: true };
    Array.prototype.slice.call(template.content.querySelectorAll("*")).forEach(function (node) {
      if (allowed[node.tagName]) {
        Array.prototype.slice.call(node.attributes).forEach(function (a) { node.removeAttribute(a.name); });
        return;
      }
      if (/^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|SVG|MATH)$/i.test(node.tagName)) { node.remove(); return; }
      node.replaceWith(doc.createTextNode(node.textContent || ""));
    });
    return template.innerHTML;
  }
  var faqList = doc.getElementById("faqList");
  if (faqList && window.fetch) {
    fetch(API_BASE + "/api/faq")
      .then(function (r) { return r.json(); })
      .then(function (result) {
        if (!result || !result.success || !Array.isArray(result.data) || !result.data.length) return;
        faqList.innerHTML = result.data.map(function (item, i) {
          return '<details class="faq-item"' + (i === 0 ? " open" : "") + "><summary>" + escapeHtml(item.question) +
            '</summary><div class="faq-a">' + sanitizeFaqHtml(item.answer) + "</div></details>";
        }).join("");
      })
      .catch(function () {});
  }

  /* ---------- demo talep formu ---------- */
  var form = doc.getElementById("demoForm");
  if (!form) return;
  var submit = form.querySelector('button[type="submit"]');
  var msg = doc.getElementById("demoMsg");
  var done = doc.getElementById("demoDone");

  function fieldErr(name, text) {
    var input = form.elements[name];
    var slot = doc.getElementById("err-" + name);
    if (input && input.setAttribute) {
      if (text) input.setAttribute("aria-invalid", "true"); else input.removeAttribute("aria-invalid");
    }
    if (slot) slot.textContent = text || "";
  }
  function clearErrors() {
    ["name", "email", "company", "phone", "contracts", "erp", "consent"].forEach(function (n) { fieldErr(n, ""); });
    msg.hidden = true;
    msg.innerHTML = "";
  }
  function payload() {
    var f = form.elements;
    return {
      name: f.name.value, email: f.email.value, company: f.company.value, role: f.role.value,
      phone: f.phone.value, contracts: f.contracts.value, erp: f.erp.value, message: f.message.value,
      consent: f.consent.checked, website: f.website.value
    };
  }
  function mailtoLink(d) {
    var body = [
      "Ad soyad: " + d.name, "Şirket: " + d.company, "E-posta: " + d.email, "Pozisyon: " + (d.role || "-"),
      "Telefon: " + (d.phone || "-"), "Sözleşme sayısı: " + (d.contracts || "-"), "ERP: " + (d.erp || "-"), "", d.message || ""
    ].join("\n");
    return "mailto:" + MAIL + "?subject=" + encodeURIComponent("Demo talebi — " + (d.company || "")) + "&body=" + encodeURIComponent(body);
  }
  function showFailure(d, text) {
    msg.className = "form-msg err";
    msg.innerHTML = escapeHtml(text) + ' Talebinizi doğrudan <a href="' + mailtoLink(d).replace(/"/g, "&quot;") + '">' + MAIL + "</a> adresine de gönderebilirsiniz.";
    msg.hidden = false;
  }
  function localCheck(d) {
    var bad = false;
    if (d.name.trim().length < 2) { fieldErr("name", t("Ad soyad gerekli.", "Full name is required.")); bad = true; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email.trim())) { fieldErr("email", t("Geçerli bir e-posta adresi girin.", "Enter a valid email address.")); bad = true; }
    if (d.company.trim().length < 2) { fieldErr("company", t("Şirket adı gerekli.", "Company name is required.")); bad = true; }
    if (d.phone.trim() && !/^[0-9+()\s.-]{7,40}$/.test(d.phone.trim())) { fieldErr("phone", t("Telefon numarası geçersiz.", "Enter a valid phone number.")); bad = true; }
    if (!d.consent) { fieldErr("consent", t("Devam etmek için aydınlatma metnini onaylayın.", "Please confirm you have read the privacy notice.")); bad = true; }
    return !bad;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    clearErrors();
    var d = payload();
    if (!localCheck(d)) {
      var first = form.querySelector('[aria-invalid="true"]');
      if (first) first.focus();
      return;
    }
    submit.disabled = true;
    var label = submit.textContent;
    submit.textContent = t("Gönderiliyor…", "Sending…");
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 20000);
    fetch(API_BASE + "/api/public/demo-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(d),
      signal: ctrl ? ctrl.signal : undefined
    })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (body) { return { status: r.status, body: body }; }); })
      .then(function (res) {
        if (res.status === 201 || res.status === 202) {
          form.hidden = true;
          done.hidden = false;
          done.querySelector("[data-email]").textContent = d.email.trim();
          done.focus();
          return;
        }
        if (res.status === 400 && res.body && res.body.fields) {
          Object.keys(res.body.fields).forEach(function (k) { fieldErr(k, res.body.fields[k]); });
          var first = form.querySelector('[aria-invalid="true"]');
          if (first) first.focus();
          return;
        }
        if (res.status === 429) return showFailure(d, t("Kısa sürede çok fazla talep gönderildi.", "Too many requests. Please try again later."));
        showFailure(d, t("Talebiniz şu an iletilemedi.", "Your request could not be submitted."));
      })
      .catch(function () { showFailure(d, t("Sunucuya ulaşılamadı.", "Could not reach the server.")); })
      .then(function () {
        clearTimeout(timer);
        submit.disabled = false;
        submit.textContent = label;
      });
  });
})();
