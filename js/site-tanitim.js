/* Ana sayfa tanıtım videosu: tıklayınca oynat, bölüm başlıklarıyla ileri sar.
   Video yalnızca kullanıcı oynatınca indirilir (preload="none"). */
(function () {
  "use strict";
  var video = document.getElementById("tourVideo");
  var play = document.getElementById("tourPlay");
  if (!video || !play) return;
  var chapters = Array.prototype.slice.call(document.querySelectorAll("[data-tour-at]"));
  function start(at) {
    play.hidden = true;
    video.controls = true;
    if (typeof at === "number") {
      var seek = function () { try { video.currentTime = at; } catch (e) {} };
      if (video.readyState >= 1) seek(); else video.addEventListener("loadedmetadata", seek, { once: true });
    }
    var p = video.play();
    if (p && p.catch) p.catch(function () { play.hidden = false; });
  }
  play.addEventListener("click", function () { start(); });
  chapters.forEach(function (b) {
    b.addEventListener("click", function () {
      start(parseFloat(b.getAttribute("data-tour-at")));
      if (window.matchMedia("(max-width: 900px)").matches) video.scrollIntoView({ block: "center" });
    });
  });
  video.addEventListener("timeupdate", function () {
    var t = video.currentTime, active = null;
    chapters.forEach(function (b) { if (t >= parseFloat(b.getAttribute("data-tour-at"))) active = b; });
    chapters.forEach(function (b) { b.setAttribute("aria-current", String(b === active)); });
  });
  video.addEventListener("ended", function () { play.hidden = false; video.controls = false; });
})();
