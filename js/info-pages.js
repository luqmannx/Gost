/* =====================================================================
   js/info-pages.js — USER GUIDE / SECURITY / PRIVACY POPUP CONTENT
   ---------------------------------------------------------------------
   The text for the three nav links lives here. It's our OWN fixed
   HTML (no user input inside it), so using innerHTML is safe here.
   Never put user-controlled text (like filenames) into innerHTML.
   ===================================================================== */

(function (Vibex) {
  "use strict";

  var PAGES = {
    guide: {
      title: "User Guide",
      html:
        "<p>Vibex encrypts and decrypts files <strong>locally in your browser</strong>. " +
        "Your file and passphrase are never uploaded anywhere.</p>" +
        "<p>Choose a file, enter a passphrase (or press the dice for a strong one), and encrypt. " +
        "A file named like <code>vibex-3f9a1c2e7b0d4a61.enc</code> is downloaded.</p>" +
        "<p>To decrypt, choose that .enc file and enter the same passphrase. " +
        "The <strong>original filename is restored</strong> — it was stored inside the encryption, " +
        "which is why the .enc file has a random name.</p>" +
        "<p>There is <strong>no recovery</strong>. If you lose the passphrase, the data is gone.</p>" +
        '<div class="security-note"><strong>Memory note:</strong> the whole file is loaded into memory, ' +
        "so files are limited to 256 MB. Phones may handle less.</div>"
    },

    security: {
      title: "Security",
      html:
        "<h4>Threat model</h4><ul>" +
        "<li><strong>Protects against:</strong> someone reading your files in cloud storage, on a USB drive, " +
        "in an email, or while they travel over a network — after they are encrypted.</li>" +
        "<li><strong>Does NOT protect against:</strong> a hacked device, keyloggers, malicious browser " +
        "extensions, screen capture, weak passphrases, or a hacked web server sending modified JavaScript.</li></ul>" +
        "<h4>Cryptography</h4><ul>" +
        "<li><strong>AES-256-GCM</strong> — authenticated encryption: any change to the file makes decryption fail.</li>" +
        "<li><strong>PBKDF2-HMAC-SHA256</strong> with 600,000 iterations turns the passphrase into the key.</li>" +
        "<li>Every file gets a fresh random 16-byte salt and 12-byte IV.</li>" +
        "<li>The 38-byte header is authenticated as AAD (additional authenticated data).</li>" +
        "<li>The original filename is encrypted; the output file gets a random name.</li>" +
        "<li>Crypto runs in a separate Web Worker thread when served over HTTP(S).</li></ul>" +
        "<h4>File format (VBX1)</h4>" +
        "<p>magic · version · KDF id · iteration count · salt · IV · ciphertext + tag. " +
        "Unknown versions or iteration counts are rejected <em>before</em> key derivation.</p>" +
        "<h4>Deployment trust</h4>" +
        "<p>The browser still has to trust the JavaScript it receives. For real use, host it over HTTPS " +
        "and send CSP and <code>frame-ancestors</code> headers from the server.</p>" +
        '<div class="self-test"><button id="selfTestBtn" type="button">Run crypto self-test</button>' +
        '<div id="selfTestResult" class="self-test-result" aria-live="polite"></div></div>' +
        '<div class="security-note"><strong>Audit status:</strong> educational/portfolio project. ' +
        "It has not been independently audited.</div>"
    },

    privacy: {
      title: "Privacy",
      html:
        "<p>There is no upload endpoint, no analytics and no tracking.</p>" +
        "<p>The Content Security Policy sets <code>connect-src 'none'</code>, which tells the browser " +
        "to block every network request this page's scripts try to make.</p>" +
        "<p>Your passphrase is only used in memory to derive the key. It is never saved.</p>" +
        "<p>The only thing stored on your device is your light/dark theme choice (localStorage).</p>" +
        "<p>Your web host's server logs are outside the control of this page.</p>"
    }
  };

  async function runSelfTest() {
    var app = Vibex.app;
    var result = document.getElementById("selfTestResult");
    if (app.busy || !app.cryptoReady) return;

    app.setBusy(true);
    result.className = "self-test-result";
    result.textContent = "Running tests (takes a few seconds)…";

    try {
      await Vibex.cryptoClient.run("selftest");
      result.className = "self-test-result ok";
      result.textContent = "Passed: round-trip, wrong-password, ciphertext-tamper and AAD-tamper checks.";
    } catch (err) {
      result.className = "self-test-result err";
      result.textContent = err.cancelled ? "" : (err.message || "Self-test failed.");
    } finally {
      app.setBusy(false);
    }
  }

  function open(type) {
    var page = PAGES[type];
    if (!page) return;

    document.getElementById("infoModalTitle").textContent = page.title;
    document.getElementById("infoModalContent").innerHTML = page.html;

    // The self-test button only exists on the Security page, and is
    // re-created every time the page opens, so we wire it up here.
    var testButton = document.getElementById("selfTestBtn");
    if (testButton) {
      testButton.disabled = Vibex.app.busy || !Vibex.app.cryptoReady;
      testButton.addEventListener("click", runSelfTest);
    }

    Vibex.modal.open("infoModalBackdrop");
  }

  Vibex.infoPages = { open: open };
})(window.Vibex = window.Vibex || {});
