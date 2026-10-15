/* =====================================================================
   js/theme-init.js — PICK LIGHT/DARK BEFORE THE PAGE IS DRAWN
   ---------------------------------------------------------------------
   Loaded in <head> (NOT at the end of <body>) on purpose. If we waited,
   light-mode users would see a flash of the dark theme first ("FOUC" =
   flash of unstyled content).

   Order of preference:
     1. what the user picked before (saved in localStorage)
     2. the operating system's light/dark setting
   ===================================================================== */

(function () {
  "use strict";
  try {
    var theme = localStorage.getItem("vibex-theme");
    if (theme !== "light" && theme !== "dark") {
      theme = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    }
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {
    // localStorage can throw in some private-browsing modes.
    document.documentElement.setAttribute("data-theme", "dark");
  }
})();
