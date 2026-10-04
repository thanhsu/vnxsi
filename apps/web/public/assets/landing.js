// VNX-0709: rotates the landing deck every 4 s. No library, no network. Without it the first card stays in front.
(function () {
  var deck = document.querySelector("[data-deck]");
  if (!deck) return;
  var cards = deck.querySelectorAll(".deck-card");
  var dots = deck.querySelectorAll(".deck-dots button");
  var n = cards.length;
  if (n < 2 || dots.length !== n) return;
  var active = 0;

  function show(i) {
    active = (i + n) % n;
    for (var j = 0; j < n; j++) {
      var slot = (j - active + n) % n;
      cards[j].setAttribute("data-slot", slot);
      // Cards behind the front one are out of reach until they come to the front.
      cards[j].inert = slot !== 0;
      if (slot) cards[j].setAttribute("aria-hidden", "true");
      else cards[j].removeAttribute("aria-hidden");
      dots[j].setAttribute("aria-pressed", j === active ? "true" : "false");
    }
  }

  Array.prototype.forEach.call(dots, function (dot, j) {
    dot.addEventListener("click", function () {
      show(j);
    });
  });
  deck.querySelector(".deck-dots").hidden = false;
  show(0);

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  // Hover and keyboard focus each hold the deck still.
  var hover = false;
  var focus = false;
  deck.addEventListener("mouseenter", function () {
    hover = true;
  });
  deck.addEventListener("mouseleave", function () {
    hover = false;
  });
  deck.addEventListener("focusin", function () {
    focus = true;
  });
  deck.addEventListener("focusout", function (e) {
    focus = deck.contains(e.relatedTarget);
  });
  setInterval(function () {
    if (!hover && !focus && !document.hidden) show(active + 1);
  }, 4000);
})();
