/* =====================================================================
   js/crypto/key-derivation.js — PASSPHRASE  ->  AES KEY
   ---------------------------------------------------------------------
   AES-256 needs a key of exactly 256 random-looking bits. A human
   passphrase is not that. A "Key Derivation Function" (KDF) turns the
   passphrase into a proper key.

   We use PBKDF2-HMAC-SHA256:
     - It runs HMAC-SHA256 600,000 times in a row. That takes a
       fraction of a second for you, but means an attacker guessing
       passwords is ~600,000x slower per guess.
     - The SALT (random per file) means the same passphrase gives a
       DIFFERENT key for every file, so attackers can't use
       precomputed tables ("rainbow tables").

   Note: Argon2id is a stronger KDF (it also uses lots of memory, which
   hurts GPU attackers), but browsers don't have it built in. PBKDF2
   is built into the Web Crypto API.
   ===================================================================== */

(function (Vibex) {
  "use strict";

  /**
   * @param {string} password
   * @param {Uint8Array} salt
   * @param {number} iterations
   * @returns {Promise<CryptoKey>} an AES-GCM key usable for encrypt + decrypt
   */
  async function deriveKey(password, salt, iterations) {
    if (typeof password !== "string" || password.length === 0) {
      throw new Error("Enter a passphrase.");
    }
    if (password.length > Vibex.format.MAX_PASSWORD_CHARS) {
      throw new Error("Passphrase is limited to " + Vibex.format.MAX_PASSWORD_CHARS + " characters.");
    }

    // Step 1: wrap the raw passphrase bytes so Web Crypto can use them.
    //         "false" = the key can never be exported back out.
    var baseKey = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveKey"]
    );

    // Step 2: stretch it with PBKDF2 into a 256-bit AES-GCM key.
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: salt, iterations: iterations, hash: "SHA-256" },
      baseKey,
      { name: "AES-GCM", length: 256 },
      false,                       // not extractable
      ["encrypt", "decrypt"]
    );
  }

  Vibex.keyDerivation = { deriveKey: deriveKey };
})(self.Vibex = self.Vibex || {});
