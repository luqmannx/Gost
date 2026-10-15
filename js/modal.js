/* =====================================================================
   js/modal.js — OPEN / CLOSE POPUPS (+ keyboard accessibility)
   ---------------------------------------------------------------------
   Accessibility features, so keyboard and screen-reader users can use it:
     - Escape closes the top-most modal
     - Tab / Shift+Tab stay INSIDE the open modal ("focus trap")
     - The page behind gets the "inert" attribute (can't be clicked
       or focused while a modal is open)
     - When closed, focus goes back to the button that opened it
   ===================================================================== */

(function (Vibex) {
  "use strict";

  var MODAL_IDS = ["vaultModalBackdrop", "infoModalBackdrop"];   // bottom -> top
  var FOCUSABLE = "button:not([disabled]), input:not([disabled]), [href], select, textarea, [tabindex]:not([tabindex='-1'])";
  var lastFocused = null;

  function el(id) {
    return document.getElementById(id);
  }

  function isOpen(id) {
    return el(id).classList.contains("is-open");
  }

  function topOpenModal() {
    for (var i = MODAL_IDS.length - 1; i >= 0; i--) {
      if (isOpen(MODAL_IDS[i])) return MODAL_IDS[i];
    }
    return null;
  }

  /** Make everything on the page EXCEPT the modals non-interactive. */
  function setBackgroundInert(on) {
    Array.prototype.forEach.call(document.body.children, function (child) {
      if (child.tagName === "SCRIPT") return;
      if (MODAL_IDS.indexOf(child.id) !== -1) return;
      if (on) child.setAttribute("inert", "");
      else child.removeAttribute("inert");
    });
  }

  function open(id) {
    lastFocused = document.activeElement;
    el(id).classList.add("is-open");
    document.body.style.overflow = "hidden";       // stop the page scrolling behind
    setBackgroundInert(true);

    // Focus the first control inside, after the open animation starts.
    setTimeout(function () {
      var first = el(id).querySelector(FOCUSABLE);
      if (first) first.focus();
    }, 60);
  }

  function close(id) {
    el(id).classList.remove("is-open");
    if (!topOpenModal()) {
      setBackgroundInert(false);
      document.body.style.overflow = "";
    }
    if (lastFocused && lastFocused.focus) {
      try { lastFocused.focus(); } catch (e) { /* element may be gone */ }
    }
  }

  /* ---------- Keyboard handling ---------- */
  document.addEventListener("keydown", function (e) {
    var openId = topOpenModal();
    if (!openId) return;

    if (e.key === "Escape") {
      close(openId);
      return;
    }

    if (e.key === "Tab") {
      // Visible focusable elements inside the open modal
      var items = Vibex.utils.qsa(FOCUSABLE, el(openId)).filter(function (item) {
        return item.offsetParent !== null || item === document.activeElement;
      });
      if (!items.length) return;

      var first = items[0];
      var last = items[items.length - 1];
      // Wrap around: Tab on the last item -> first; Shift+Tab on first -> last
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  /* ---------- Clicking the dark backdrop (outside the box) closes it ---------- */
  MODAL_IDS.forEach(function (id) {
    el(id).addEventListener("click", function (e) {
      if (e.target === e.currentTarget) close(id);
    });
  });

  Vibex.modal = { open: open, close: close, isOpen: isOpen };
})(window.Vibex = window.Vibex || {});
