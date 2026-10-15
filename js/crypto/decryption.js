/* =====================================================================
   js/crypto/decryption.js — DECRYPT A ".enc" FILE
   ---------------------------------------------------------------------
   The reverse of encryption.js:
     1. read + validate the header       (format.parseHeader)
     2. re-derive the SAME key           (same passphrase + stored salt)
     3. AES-GCM decrypt + verify the tag (fails if anything was changed)
     4. unpack the filename + file bytes

   SECURITY DETAIL — one error message for two failures:
   A wrong passphrase and a tampered file BOTH produce "Wrong passphrase
   or damaged file." GCM itself can't tell them apart, and we don't
   want to give an attacker hints about which one happened.
   ===================================================================== */

(function (Vibex) {
  "use strict";

  /**
   * @param {ArrayBuffer} encryptedBuffer  the whole .enc file
   * @param {string}      password
   * @param {function(string, number)} [onProgress]
   * @returns {Promise<{fileBuffer: ArrayBuffer, originalName: string}>}
   */
  async function decryptFile(encryptedBuffer, password, onProgress) {
    var F = Vibex.format;
    var report = onProgress || function () {};

    if (!self.crypto || !self.crypto.subtle) {
      throw new Error("Web Crypto is unavailable — open this page over HTTPS or localhost.");
    }
    if (encryptedBuffer.byteLength > F.MAX_ENCRYPTED_BYTES) {
      throw new Error("Encrypted file is larger than this app supports.");
    }

    // 1. Parse + validate. Throws a clear error for non-Vibex files.
    var parts = F.parseHeader(new Uint8Array(encryptedBuffer));

    // 2. Same passphrase + same salt + same iterations = same key.
    report("Deriving key", 10);
    var key = await Vibex.keyDerivation.deriveKey(password, parts.salt, parts.iterations);

    // 3. Decrypt. Web Crypto checks the GCM tag first; if it doesn't
    //    match, it throws (an "OperationError") and returns NOTHING.
    //    That's why tampered data can never come out as fake plaintext.
    report("Decrypting", 80);
    var plainBuffer;
    try {
      plainBuffer = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: parts.iv, additionalData: parts.aad, tagLength: 128 },
        key,
        parts.ciphertext
      );
    } catch (err) {
      throw new Error("Wrong passphrase or damaged file.");
    }

    // 4. Unpack: [4-byte name length][name][file bytes]
    var plain = new Uint8Array(plainBuffer);
    if (plain.byteLength < 4) {
      throw new Error("Corrupt payload.");
    }
    var nameLength = new DataView(plainBuffer).getUint32(0, true);
    if (nameLength > F.MAX_NAME_BYTES || nameLength > plain.byteLength - 4) {
      throw new Error("Corrupt payload.");
    }

    var originalName = new TextDecoder().decode(plain.subarray(4, 4 + nameLength));
    var fileBytes = plain.slice(4 + nameLength);   // slice = copy into its own buffer
    plain.fill(0);                                 // wipe our full plaintext copy

    return { fileBuffer: fileBytes.buffer, originalName: originalName };
  }

  Vibex.decryption = { decryptFile: decryptFile };
})(self.Vibex = self.Vibex || {});
