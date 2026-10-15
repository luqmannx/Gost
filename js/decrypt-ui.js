/* =====================================================================
   js/decrypt-ui.js — THE "DECRYPT" TAB (form, buttons, progress)
   ---------------------------------------------------------------------
   Screen logic only. The cryptography is in js/crypto/decryption.js.

   Flow when you press "Decrypt & download":
     1. check inputs
     2. read the .enc file                                   bar 0-25%
     3. decrypt + verify    (js/crypto-client.js -> worker)  bar 30-88%
     4. download with the ORIGINAL filename (made safe first) bar 100%
   ===================================================================== */

(function (Vibex) {
  "use strict";

  var U = Vibex.utils;
  var $ = U.$;
  var dropZone;
  var progress;

  function init() {
    dropZone = Vibex.dropZone.setup("decDropZone", "dec-file", "decFileNameDisplay");
    progress = U.progressBar("dec");

    $("decReveal").addEventListener("click", function () {
      U.togglePasswordVisibility("dec-pass", this);
    });
    $("dec-btn").addEventListener("click", handleDecrypt);
    $("decClear").addEventListener("click", reset);
    $("dec-cancel").addEventListener("click", Vibex.app.cancel);
  }

  function clearSecret() {
    $("dec-pass").value = "";
  }

  function reset() {
    dropZone.clear();
    clearSecret();
    U.hideMessage($("dec-error"));
    U.hideMessage($("dec-success"));
    progress.hide();
  }

  async function handleDecrypt() {
    var app = Vibex.app;
    var F = Vibex.format;
    var errorBox = $("dec-error");
    var successBox = $("dec-success");
    var file = dropZone.getFile();
    var pass = $("dec-pass").value;

    if (app.busy) return;

    // 1. Validate
    var problem = null;
    if (!app.cryptoReady) problem = "Decryption requires a secure (HTTPS) connection.";
    else if (!file) problem = "Choose an encrypted file first.";
    else if (!pass) problem = "Enter the passphrase.";
    else if (pass.length > F.MAX_PASSWORD_CHARS) problem = "Passphrase is limited to " + F.MAX_PASSWORD_CHARS + " characters.";
    else if (file.size > F.MAX_ENCRYPTED_BYTES) problem = "This file is larger than the 256 MB limit.";

    if (problem) {
      U.showMessage(errorBox, problem, "err");
      return;
    }

    U.hideMessage(errorBox);
    U.hideMessage(successBox);
    app.setBusy(true);
    progress.show();
    progress.set(1, "Reading file…");

    try {
      // 2. Read
      var buffer = await Vibex.fileIO.read(file, function (fraction, rate, secondsLeft) {
        progress.set(fraction * 25,
          "Reading " + Math.round(fraction * 100) + "% · " +
          U.formatBytes(rate) + "/s · ~" + Math.ceil(secondsLeft) + "s left");
      });

      // 3. Decrypt (in the worker)
      progress.set(30, "Deriving key…");
      var startTime = performance.now();
      var result = await Vibex.cryptoClient.run(
        "decrypt",
        { fileBuffer: buffer, password: pass },
        function (stage, percent) {
          progress.set(Math.min(30 + percent * 0.6, 88), stage + "…");
        }
      );

      // 4. Download. The name came from inside the file, so it is
      //    UNTRUSTED input: safeFileName() strips dangerous characters.
      var name = U.safeFileName(result.originalName, "decrypted-file");
      var blob = new Blob([result.buffer], { type: "application/octet-stream" });
      Vibex.fileIO.download(blob, name);

      var seconds = ((performance.now() - startTime) / 1000).toFixed(1);
      progress.set(100, "Done in " + seconds + "s");
      U.showMessage(successBox, "Decrypted — " + name + " (" + U.formatBytes(blob.size) + ")", "ok");
      clearSecret();
      setTimeout(progress.hide, 900);
    } catch (err) {
      progress.hide();
      if (!err.cancelled) U.showMessage(errorBox, err.message || "Wrong passphrase or damaged file.", "err");
    } finally {
      app.setBusy(false);
    }
  }

  Vibex.decryptUI = { init: init, reset: reset };
})(window.Vibex = window.Vibex || {});
