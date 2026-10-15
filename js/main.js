/* =====================================================================
   js/main.js — STARTS THE APP AND CONNECTS BUTTONS TO FEATURES
   ---------------------------------------------------------------------
   Loaded LAST, so every other Vibex.* module already exists.
   This file is the "switchboard": it doesn't contain features itself,
   it just says "when THIS is clicked, call THAT".
   ===================================================================== */

(function (Vibex) {
  "use strict";

  var $ = Vibex.utils.$;

  /* ---------- Vault modal (Encrypt / Decrypt tabs) ---------- */

  function switchTab(tab) {
    var isEncrypt = tab === "encrypt";
    $("tabEncrypt").classList.toggle("is-active", isEncrypt);
    $("tabDecrypt").classList.toggle("is-active", !isEncrypt);
    $("paneEncrypt").classList.toggle("is-active", isEncrypt);
    $("paneDecrypt").classList.toggle("is-active", !isEncrypt);
    $("modalTabs").dataset.active = tab;        // css/modal.css slides the thumb from this
  }

  function openVault(tab) {
    // Don't wipe the form in the middle of a running job.
    if (!Vibex.app.busy) {
      Vibex.encryptUI.reset();
      Vibex.decryptUI.reset();
    }
    switchTab(tab);
    Vibex.modal.open("vaultModalBackdrop");
  }

  /* ---------- Start the features ---------- */
  Vibex.cryptoClient.start();     // begin loading the worker right away
  Vibex.encryptUI.init();
  Vibex.decryptUI.init();

  /* ---------- Wire up buttons ---------- */
  $("navGuideBtn").addEventListener("click", function () { Vibex.infoPages.open("guide"); });
  $("navSecurityBtn").addEventListener("click", function () { Vibex.infoPages.open("security"); });
  $("navPrivacyBtn").addEventListener("click", function () { Vibex.infoPages.open("privacy"); });
  $("themeToggle").addEventListener("click", Vibex.theme.toggle);

  $("ctaEncrypt").addEventListener("click", function () { openVault("encrypt"); });
  $("ctaDecrypt").addEventListener("click", function () { openVault("decrypt"); });
  $("tabEncrypt").addEventListener("click", function () { switchTab("encrypt"); });
  $("tabDecrypt").addEventListener("click", function () { switchTab("decrypt"); });

  $("vaultClose").addEventListener("click", function () { Vibex.modal.close("vaultModalBackdrop"); });
  $("infoClose").addEventListener("click", function () { Vibex.modal.close("infoModalBackdrop"); });

  /* ---------- Page lifecycle ---------- */

  // Leaving the page: stop any work and free memory.
  window.addEventListener("pagehide", function () {
    Vibex.fileIO.abort();
    Vibex.cryptoClient.shutdown();
  });

  // Ask "Leave site?" if a job is running, so a file isn't lost halfway.
  window.addEventListener("beforeunload", function (e) {
    if (Vibex.app.busy) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  /* ---------- Initial state ---------- */
  Vibex.app.setBusy(false);       // enables or disables buttons based on cryptoReady

  if (!Vibex.app.cryptoReady) {
    var warning = document.createElement("div");
    warning.className = "secure-warning";
    warning.setAttribute("role", "alert");
    warning.textContent = "Encryption requires HTTPS or localhost.";
    document.body.appendChild(warning);
  }
})(window.Vibex);
