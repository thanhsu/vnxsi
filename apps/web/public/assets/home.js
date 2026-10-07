// VNX-0704b: count-up, the Live strip and the chart tooltip. No library, no network, no cookies.
// Picks everything by data-* hooks, so a block works wherever the page puts it. Without this file every block shows its final state.
(function () {
  var rm = window.matchMedia("(prefers-reduced-motion: reduce)");
  var reduce = rm.matches;
  var nf;
  try {
    nf = new Intl.NumberFormat(document.documentElement.lang || undefined);
  } catch (e) {
    nf = new Intl.NumberFormat();
  }

  function run(el) {
    var target = Number(el.getAttribute("data-count"));
    if (!isFinite(target)) return;
    var start = null;
    function step(now) {
      if (start === null) start = now;
      var p = Math.min(1, (now - start) / 1200);
      el.textContent = nf.format(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = nf.format(target);
    }
    requestAnimationFrame(step);
  }

  function countUp() {
    var els = document.querySelectorAll("[data-count]");
    if (reduce || !els.length || !("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          io.unobserve(en.target);
          if (rm.matches) en.target.textContent = nf.format(Number(en.target.getAttribute("data-count")));
          else run(en.target);
        });
      },
      { threshold: 0.4 },
    );
    Array.prototype.forEach.call(els, function (el) {
      io.observe(el);
    });
  }

  function marquees() {
    if (reduce) return;
    Array.prototype.forEach.call(document.querySelectorAll("[data-marquee]"), function (list) {
      var n = list.children.length;
      if (n < 2) return;
      var host = list.parentNode;
      var toggle = host.querySelector("[data-motion-toggle]");
      var wrap = document.createElement("div");
      var track = document.createElement("div");
      var copy = list.cloneNode(true);
      wrap.className = "home-marquee";
      track.className = "home-marquee-track";
      track.style.setProperty("--marquee-s", n * 4 + "s");
      copy.removeAttribute("data-marquee");
      copy.setAttribute("aria-hidden", "true");
      copy.inert = true;
      Array.prototype.forEach.call(copy.querySelectorAll("a, button"), function (x) {
        x.setAttribute("tabindex", "-1");
      });
      host.insertBefore(wrap, list);
      wrap.appendChild(track);
      track.appendChild(list);
      track.appendChild(copy);
      if (!toggle) return;
      toggle.hidden = false;
      toggle.addEventListener("click", function () {
        var paused = wrap.classList.toggle("is-paused");
        toggle.setAttribute("aria-pressed", paused ? "true" : "false");
      });
    });
  }

  function tooltips() {
    var tip = null;
    var active = null;
    function hide() {
      if (tip) tip.hidden = true;
      if (active) active.classList.remove("is-active");
      active = null;
    }
    function place(e) {
      tip.style.left = Math.max(8, Math.min(e.clientX + 12, window.innerWidth - tip.offsetWidth - 8)) + "px";
      var y = e.pointerType === "touch" ? e.clientY - tip.offsetHeight - 16 : e.clientY + 16;
      tip.style.top = Math.max(8, Math.min(window.innerHeight - tip.offsetHeight - 8, y)) + "px";
    }
    document.addEventListener("pointerover", function (e) {
      var g = e.target && e.target.closest ? e.target.closest("[data-tip]") : null;
      if (!g) return hide();
      if (!tip) {
        tip = document.createElement("div");
        tip.className = "chart-tip";
        tip.setAttribute("aria-hidden", "true");
        document.body.appendChild(tip);
      }
      if (active && active !== g) active.classList.remove("is-active");
      active = g;
      g.classList.add("is-active");
      tip.textContent = g.getAttribute("data-tip");
      tip.hidden = false;
      place(e);
    });
    document.addEventListener("pointermove", function (e) {
      if (tip && !tip.hidden) place(e);
    });
    document.addEventListener("pointerout", function (e) {
      if (!e.relatedTarget && e.pointerType !== "touch") hide();
    });
    window.addEventListener("scroll", hide, { passive: true });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") hide();
    });
  }

  countUp();
  marquees();
  tooltips();
})();
