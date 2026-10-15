/* =====================================================================
   js/encrypt-ui.js — THE "ENCRYPT" TAB (form, buttons, progress)
   ---------------------------------------------------------------------
   This file handles the SCREEN only: checking the inputs, showing
   progress and messages, triggering the download.
   The actual cryptography is in js/crypto/encryption.js.

   Flow when you press "Encrypt & download":
     1. check inputs           (file chosen? passphrases match?)
     2. read the file          (js/file-io.js)              bar 0-25%
     3. encrypt                (js/crypto-client.js -> worker) bar 30-88%
     4. download the .enc file with a random name           bar 100%
   ===================================================================== */

(function (Vibex) {
  "use strict";

  var U = Vibex.utils;
  var $ = U.$;
  var dropZone;
  var progress;

  function init() {
    dropZone = Vibex.dropZone.setup("encDropZone", "enc-file", "encFileNameDisplay");
    progress = U.progressBar("enc");

    $("enc-pass").addEventListener("input", updateStrengthMeter);
    $("encDice").addEventListener("click", fillGeneratedPassphrase);
    $("encReveal").addEventListener("click", function () {
      U.togglePasswordVisibility("enc-pass", this);
    });
    $("enc-btn").addEventListener("click", handleEncrypt);
    $("encClear").addEventListener("click", reset);
    $("enc-cancel").addEventListener("click", Vibex.app.cancel);
  }

  /* ---------- Strength meter + dice ---------- */

  function updateStrengthMeter() {
    var level = Vibex.passwordStrength.evaluate($("enc-pass").value);
    $("encStrength").dataset.level = level;          // CSS colors the bars from this
    $("encStrengthHint").textContent = Vibex.passwordStrength.label(level);
  }

  function fillGeneratedPassphrase() {
    var passphrase = Vibex.passwordGenerator.generate(24);
    $("enc-pass").value = passphrase;
    $("enc-pass-confirm").value = passphrase;
    $("encStrength").dataset.level = 4;
    $("encStrengthHint").textContent = "Generated locally with a secure random generator. Save it somewhere safe!";
    $("enc-pass").focus();
    $("enc-pass").select();
  }

  /* ---------- Clearing ---------- */

  function clearSecrets() {
    $("enc-pass").value = "";
    $("enc-pass-confirm").value = "";
    $("encStrength").dataset.level = 0;
    $("encStrengthHint").textContent = "";
  }

  function reset() {
    dropZone.clear();
    clearSecrets();
    U.hideMessage($("enc-error"));
    U.hideMessage($("enc-success"));
    progress.hide();
  }

  /* ---------- Main action ---------- */

  async function handleEncrypt() {
    var app = Vibex.app;
    var F = Vibex.format;
    var errorBox = $("enc-error");
    var successBox = $("enc-success");
    var file = dropZone.getFile();
    var pass = $("enc-pass").value;
    var confirm = $("enc-pass-confirm").value;

    if (app.busy) return;

    // 1. Validate. Each check shows a clear message and stops.
    var problem = null;
    if (!app.cryptoReady) problem = "Encryption requires a secure (HTTPS) connection.";
    else if (!file) problem = "Choose a file first.";
    else if (!pass) problem = "Enter a passphrase.";
    else if (pass.length > F.MAX_PASSWORD_CHARS) problem = "Passphrase is limited to " + F.MAX_PASSWORD_CHARS + " characters.";
    else if (pass !== confirm) problem = "Passphrases don't match.";
    else if (file.size > F.MAX_PLAINTEXT_BYTES) problem = "Files over 256 MB aren't supported.";

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
      // 2. Read the file from disk into memory.
      var buffer = await Vibex.fileIO.read(file, function (fraction, rate, secondsLeft) {
        progress.set(fraction * 25,
          "Reading " + Math.round(fraction * 100) + "% · " +
          U.formatBytes(rate) + "/s · ~" + Math.ceil(secondsLeft) + "s left");
      });

      // 3. Encrypt (in the worker).
      progress.set(30, "Deriving key…");
      var startTime = performance.now();
      var result = await Vibex.cryptoClient.run(
        "encrypt",
        { fileBuffer: buffer, originalName: file.name, password: pass },
        function (stage, percent) {
          progress.set(Math.min(30 + percent * 0.6, 88), stage + "…");
        }
      );

      // 4. Download with a random, non-revealing name.
      var outName = Vibex.fileIO.randomEncryptedName();
      var blob = new Blob([result.buffer], { type: "application/octet-stream" });
      Vibex.fileIO.download(blob, outName);

      var seconds = ((performance.now() - startTime) / 1000).toFixed(1);
      progress.set(100, "Done in " + seconds + "s");
      U.showMessage(successBox, "Encrypted — saved as " + outName + " (" + U.formatBytes(blob.size) + ")", "ok");
      clearSecrets();
      setTimeout(progress.hide, 900);
    } catch (err) {
      progress.hide();
      if (!err.cancelled) U.showMessage(errorBox, err.message || "Encryption failed.", "err");
    } finally {
      // "finally" runs whether it worked, failed or was cancelled.
      app.setBusy(false);
    }
  }

  Vibex.encryptUI = { init: init, reset: reset };
})(window.Vibex = window.Vibex || {});
