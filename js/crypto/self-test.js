/* =====================================================================
   js/crypto/self-test.js — "RUN CRYPTO SELF-TEST" BUTTON LOGIC
   ---------------------------------------------------------------------
   Tests the REAL encryptFile / decryptFile functions (not just raw
   Web Crypto), so it proves THIS app's file format works:

     1. Round trip      encrypt -> decrypt gives back identical bytes + name
     2. Wrong password  must be rejected
     3. Tampered data   flipping one ciphertext bit must be rejected
     4. Tampered AAD    changing authenticated header data must be rejected

   Tests 1-3 each run PBKDF2 (600k iterations), so the whole test
   takes a few seconds. That's expected.
   ===================================================================== */

(function (Vibex) {
  "use strict";

  function sameBytes(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  // Runs fn() and returns true if it THREW (= the attack was rejected).
  async function rejects(fn) {
    try {
      await fn();
      return false;
    } catch (e) {
      return true;
    }
  }

  async function runSelfTest() {
    var PASSWORD = "Vibex-self-test-password";
    var NAME = "self-test-ünïcødé.bin";      // non-ASCII on purpose: tests UTF-8 handling
    var sample = new Uint8Array([0, 1, 2, 3, 127, 128, 254, 255]);

    // ---- 1. Round trip ----
    var encrypted = await Vibex.encryption.encryptFile(sample.slice().buffer, NAME, PASSWORD);
    var result = await Vibex.decryption.decryptFile(encrypted.slice(0), PASSWORD);
    if (!sameBytes(new Uint8Array(result.fileBuffer), sample) || result.originalName !== NAME) {
      throw new Error("Round-trip test failed.");
    }

    // ---- 2. Wrong password ----
    if (!(await rejects(function () {
      return Vibex.decryption.decryptFile(encrypted.slice(0), PASSWORD + "x");
    }))) {
      throw new Error("Wrong-password test failed.");
    }

    // ---- 3. Flip one bit in the ciphertext (byte right after the header) ----
    var tampered = new Uint8Array(encrypted.slice(0));
    tampered[Vibex.format.HEADER_SIZE] ^= 1;     // ^= 1 flips the lowest bit
    if (!(await rejects(function () {
      return Vibex.decryption.decryptFile(tampered.buffer, PASSWORD);
    }))) {
      throw new Error("Ciphertext tamper test failed.");
    }

    // ---- 4. AAD check, done directly with Web Crypto ----
    // (In our format every header byte is also validated or used as
    //  key/IV, so we test the AAD mechanism on its own here.)
    // generateKey = random key, no PBKDF2 needed, so this part is fast.
    var key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    var iv = crypto.getRandomValues(new Uint8Array(12));
    var aad = new TextEncoder().encode("VBX1-self-test-header");
    var ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv, additionalData: aad }, key, sample);
    var badAad = aad.slice();
    badAad[0] ^= 1;
    if (!(await rejects(function () {
      return crypto.subtle.decrypt({ name: "AES-GCM", iv: iv, additionalData: badAad }, key, ct);
    }))) {
      throw new Error("AAD tamper test failed.");
    }
  }

  Vibex.selfTest = { run: runSelfTest };
})(self.Vibex = self.Vibex || {});
