/* =====================================================================
   js/app-state.js — SHARED "IS SOMETHING RUNNING?" STATE
   ---------------------------------------------------------------------
   Only one job (encrypt, decrypt or self-test) may run at a time.
   While one is running, all the "run" buttons are disabled.
   ===================================================================== */

(function (Vibex) {
  "use strict";

  var app = {
    busy: false,

    // Web Crypto (crypto.subtle) only exists in a "secure context":
    // https://, http://localhost, or a local file. On plain http:// it
    // is missing on purpose, so attackers on the network can't swap the
    // code while you type your passphrase.
    cryptoReady: window.isSecureContext && !!(window.crypto && window.crypto.subtle),

    setBusy: function (value) {
      app.busy = value;
      ["enc-btn", "dec-btn", "selfTestBtn"].forEach(function (id) {
        var button = document.getElementById(id);
        if (button) button.disabled = value || !app.cryptoReady;
      });
    },

    // Cancel button: stop reading the file AND stop the crypto job.
    // The waiting code in encrypt-ui.js / decrypt-ui.js then receives a
    // "cancelled" error and resets the UI.
    cancel: function () {
      if (!app.busy) return;
      Vibex.fileIO.abort();
      Vibex.cryptoClient.cancel();
    }
  };

  Vibex.app = app;
})(window.Vibex = window.Vibex || {});
