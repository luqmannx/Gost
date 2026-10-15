/* =====================================================================
   js/crypto/encryption.js — ENCRYPT A FILE
   ---------------------------------------------------------------------
   Pure crypto logic: no buttons, no DOM. It runs inside the Web Worker
   (js/crypto/worker.js), or on the page as a fallback.

   AES-256-GCM in one paragraph:
     AES is the block cipher (the "lock"). GCM is the mode that lets it
     encrypt data of any length AND produces a 16-byte authentication
     TAG. On decryption the tag is checked: if the ciphertext, the IV,
     the key or the AAD changed even slightly, decryption FAILS instead
     of returning garbage. That's "authenticated encryption".

   GOLDEN RULE OF GCM: never encrypt two messages with the same
   (key, IV) pair. Reusing one leaks data and lets attackers forge
   messages. We're safe because every file gets a fresh random salt
   (so a fresh key) AND a fresh random IV.
   ===================================================================== */

(function (Vibex) {
  "use strict";

  /**
   * Turn a filename into UTF-8 bytes, trimming it if it is too long.
   */
  function encodeName(name) {
    var encoder = new TextEncoder();
    var text = String(name || "");
    var bytes = encoder.encode(text);
    while (bytes.length > Vibex.format.MAX_NAME_BYTES) {
      text = text.slice(0, -1);
      bytes = encoder.encode(text);
    }
    return bytes;
  }

  /**
   * Plaintext layout: [4-byte name length][name bytes][file bytes]
   */
  function buildPayload(nameBytes, fileBytes) {
    var payload = new Uint8Array(4 + nameBytes.length + fileBytes.length);
    new DataView(payload.buffer).setUint32(0, nameBytes.length, true); // true = little-endian
    payload.set(nameBytes, 4);
    payload.set(fileBytes, 4 + nameBytes.length);
    return payload;
  }

  /**
   * Encrypt a file.
   * @param {ArrayBuffer} fileBuffer   the raw file contents
   * @param {string}      originalName the filename, stored encrypted
   * @param {string}      password
   * @param {function(string, number)} [onProgress]  (stageText, percent 0-100)
   * @returns {Promise<ArrayBuffer>}   the complete .enc file
   */
  async function encryptFile(fileBuffer, originalName, password, onProgress) {
    var F = Vibex.format;
    var report = onProgress || function () {};

    if (!self.crypto || !self.crypto.subtle) {
      throw new Error("Web Crypto is unavailable — open this page over HTTPS or localhost.");
    }
    if (fileBuffer.byteLength > F.MAX_PLAINTEXT_BYTES) {
      throw new Error("File exceeds the 256 MB limit.");
    }

    // 1. Fresh randomness for THIS file. crypto.getRandomValues is a
    //    cryptographically secure random generator (CSPRNG).
    //    NEVER use Math.random() for anything security-related.
    var salt = crypto.getRandomValues(new Uint8Array(F.SALT_SIZE));
    var iv = crypto.getRandomValues(new Uint8Array(F.IV_SIZE));
    var header = F.buildHeader(salt, iv);

    // 2. Passphrase -> key (the slow, deliberate step).
    report("Deriving key (" + F.ITERATIONS.toLocaleString("en-US") + " iterations)", 10);
    var key = await Vibex.keyDerivation.deriveKey(password, salt, F.ITERATIONS);

    // 3. Put the filename + file together into one plaintext.
    var payload = buildPayload(encodeName(originalName), new Uint8Array(fileBuffer));

    // 4. Encrypt. The header goes in as additionalData (AAD), so it is
    //    authenticated by the tag even though it is not encrypted.
    report("Encrypting", 80);
    var ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv, additionalData: header, tagLength: 128 },
      key,
      payload
    );

    // 5. Final file = header + ciphertext (the tag is at the end of the
    //    ciphertext; Web Crypto appends it automatically).
    var out = new Uint8Array(F.HEADER_SIZE + ciphertext.byteLength);
    out.set(header, 0);
    out.set(new Uint8Array(ciphertext), F.HEADER_SIZE);

    // Overwrite our plaintext copy. JavaScript can't guarantee memory
    // is wiped (the GC may have copies), but this is cheap and helps.
    payload.fill(0);

    return out.buffer;
  }

  Vibex.encryption = { encryptFile: encryptFile };
})(self.Vibex = self.Vibex || {});
