/* =====================================================================
   js/theme.js — THE SUN / MOON TOGGLE BUTTON
   ---------------------------------------------------------------------
   Switching theme = changing ONE attribute: <html data-theme="...">.
   All the colors in css/variables.css react to it automatically.
   We also fire a "themechange" event so js/background-dots.js can
   re-read the dot color.
   ===================================================================== */

(function (Vibex) {
  "use strict";

  var STORAGE_KEY = "vibex-theme";
  var metaThemeColor = document.querySelector('meta[name="theme-color"]');

  function current() {
    return document.documentElement.getAttribute("data-theme") || "dark";
  }

  // Mobile browsers color their address bar with <meta name="theme-color">
  function updateMetaColor(theme) {
    if (metaThemeColor) {
      metaThemeColor.setAttribute("content", theme === "light" ? "#fbfbfd" : "#000000");
    }
  }

  function apply(theme, remember) {
    document.documentElement.setAttribute("data-theme", theme);
    if (remember) {
      try { localStorage.setItem(STORAGE_KEY, theme); } catch (e) { /* private mode */ }
    }
    updateMetaColor(theme);
    window.dispatchEvent(new CustomEvent("themechange", { detail: { theme: theme } }));
  }

  function toggle() {
    apply(current() === "dark" ? "light" : "dark", true);
  }

  // Follow the OS setting live, but ONLY if the user never clicked the toggle.
  function followSystem() {
    var mq = window.matchMedia("(prefers-color-scheme: light)");
    mq.addEventListener("change", function (e) {
      var saved = null;
      try { saved = localStorage.getItem(STORAGE_KEY); } catch (err) { /* ignore */ }
      if (saved !== "light" && saved !== "dark") apply(e.matches ? "light" : "dark", false);
    });
  }

  updateMetaColor(current());
  followSystem();

  Vibex.theme = { toggle: toggle };
})(window.Vibex = window.Vibex || {});
