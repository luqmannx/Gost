/* =====================================================================
   js/utils.js — SMALL HELPERS USED BY MANY FILES
   ---------------------------------------------------------------------
   HOW ALL THE JS FILES CONNECT:
   Every file wraps its code in a function like this:

       (function (Vibex) {
         ...private code...
         Vibex.something = { publicFunction: publicFunction };
       })(window.Vibex = window.Vibex || {});

   - Variables inside the function stay PRIVATE to that file.
   - Anything attached to "Vibex" is PUBLIC, so other files can use it,
     e.g. Vibex.utils.formatBytes(1024).
   - That's why the ORDER of <script> tags in index.html matters:
     a file can only use Vibex.X if the file that creates X loaded first
     (or if it only calls it later, after everything has loaded).
   ===================================================================== */

(function (Vibex) {
  "use strict";

  /** Shortcut for document.getElementById */
  function $(id) {
    return document.getElementById(id);
  }

  /** querySelectorAll, but returns a real Array (so .filter() works) */
  function qsa(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  /** 1536 -> "1.5 KB" */
  function formatBytes(n) {
    if (n < 1024) return n + " B";
    if (n < 1048576) return (n / 1024).toFixed(1) + " KB";
    if (n < 1073741824) return (n / 1048576).toFixed(1) + " MB";
    return (n / 1073741824).toFixed(2) + " GB";
  }

  /**
   * Make a filename safe to save to disk.
   * The name inside a decrypted file comes from the FILE, which could
   * have been crafted by an attacker. Characters like / \ : could try
   * to escape folders ("../../evil.exe"), and control characters could
   * mess with the display. We replace all of them with "_".
   */
  function safeFileName(name, fallback) {
    var s = String(name || "")
      .replace(/[\\/?%*:|"<>\x00-\x1F\x7F]/g, "_")
      .trim();
    if (!s || s === "." || s === "..") s = fallback;
    return s.slice(0, 240);
  }

  /** Random hex string from the secure random generator, e.g. "9f3a0c1b" */
  function randomHex(byteCount) {
    var bytes = crypto.getRandomValues(new Uint8Array(byteCount));
    return Array.prototype.map.call(bytes, function (b) {
      return b.toString(16).padStart(2, "0");
    }).join("");
  }

  /** An Error marked as "the user pressed Cancel" (so we don't show it as a failure) */
  function cancelledError() {
    var err = new Error("Cancelled.");
    err.cancelled = true;
    return err;
  }

  /* ---------- Success / error message boxes ---------- */

  var ICON_OK =
    '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
    '<path d="M2.5 8.4l3.6 3.6L13.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ICON_ERR =
    '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
    '<path d="M8 4.5v4.2M8 11.4v.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
    '<circle cx="8" cy="8" r="6.4" stroke="currentColor" stroke-width="1.4"/></svg>';

  /**
   * Show a message. SECURITY: the icon is our own fixed HTML, but the
   * TEXT goes in via textContent (never innerHTML). The text can contain
   * a filename, and a filename like <img src=x onerror=alert(1)> would
   * be an XSS attack if inserted as HTML.
   */
  function showMessage(el, text, type) {
    el.innerHTML = (type === "ok" ? ICON_OK : ICON_ERR) + "<span></span>";
    el.lastChild.textContent = text;
    el.classList.remove("ok", "err");
    el.classList.add(type === "ok" ? "ok" : "err", "is-on");
  }

  function hideMessage(el) {
    el.classList.remove("is-on");
    el.innerHTML = "";
  }

  /* ---------- Show / hide passphrase (eye button) ---------- */

  function togglePasswordVisibility(inputId, button) {
    var input = $(inputId);
    var show = input.type === "password";
    input.type = show ? "text" : "password";
    button.setAttribute("aria-label", show ? "Hide passphrase" : "Show passphrase");
    button.classList.toggle("is-revealed", show);
  }

  /* ---------- Progress bar controller ----------
     prefix "enc" uses #enc-progress-wrap, #enc-bar, #enc-status
     prefix "dec" uses #dec-progress-wrap, #dec-bar, #dec-status   */

  function progressBar(prefix) {
    var wrap = $(prefix + "-progress-wrap");
    var bar = $(prefix + "-bar");
    var status = $(prefix + "-status");
    return {
      show: function () {
        wrap.classList.add("is-on");
        bar.style.width = "0%";
        status.textContent = "";
      },
      set: function (percent, text) {
        bar.style.width = percent + "%";
        if (text !== undefined) status.textContent = text;
      },
      hide: function () {
        wrap.classList.remove("is-on");
      }
    };
  }

  Vibex.utils = {
    $: $,
    qsa: qsa,
    formatBytes: formatBytes,
    safeFileName: safeFileName,
    randomHex: randomHex,
    cancelledError: cancelledError,
    showMessage: showMessage,
    hideMessage: hideMessage,
    togglePasswordVisibility: togglePasswordVisibility,
    progressBar: progressBar
  };
})(window.Vibex = window.Vibex || {});
