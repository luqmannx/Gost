/* =====================================================================
   js/crypto/format.js — THE ".enc" FILE FORMAT (called "VBX1")
   ---------------------------------------------------------------------
   This file is loaded in TWO places:
     1. the web page      (<script src="js/crypto/format.js"> in index.html)
     2. the crypto worker (importScripts("format.js") in worker.js)
   so every constant below exists in exactly ONE place.

   ---------------------------------------------------------------------
   BYTE LAYOUT OF AN ENCRYPTED FILE
   ---------------------------------------------------------------------
     offset  size  field
     ------  ----  ---------------------------------------------------
       0      4    MAGIC  "VBX1"  (0x56 0x42 0x58 0x31)
       4      1    format VERSION (= 1)
       5      1    KDF id         (1 = PBKDF2-HMAC-SHA256)
       6      4    ITERATIONS     (unsigned 32-bit, big-endian)
      10     16    SALT           (random, new for every file)
      26     12    IV / nonce     (random, new for every file)
      38    ...    CIPHERTEXT  +  16-byte GCM authentication TAG
     ------  ----  ---------------------------------------------------
     Bytes 0..37 are the 38-byte HEADER.

   The header is NOT secret (the salt and IV don't need to be), but it
   must not be MODIFIED. So we give it to AES-GCM as "Additional
   Authenticated Data" (AAD): it isn't encrypted, but if even one bit
   of it changes, decryption fails.

   ---------------------------------------------------------------------
   WHAT IS INSIDE THE CIPHERTEXT (after decrypting)
   ---------------------------------------------------------------------
       0      4    length of the original filename (little-endian)
       4      n    original filename, UTF-8 bytes
     4+n    ...    the original file's bytes
   Hiding the filename INSIDE the encryption means nobody can read it
   from the .enc file.
   ===================================================================== */

(function (Vibex) {
  "use strict";

  var MB = 1024 * 1024;

  var format = {
    MAGIC: [0x56, 0x42, 0x58, 0x31],   // ASCII for "VBX1"
    VERSION: 1,
    KDF_PBKDF2: 1,

    // PBKDF2 iteration count. Higher = slower to brute-force passwords.
    // 600,000 is OWASP's 2023 recommendation for PBKDF2-HMAC-SHA256.
    ITERATIONS: 600000,

    SALT_SIZE: 16,     // 128-bit salt
    IV_SIZE: 12,       // 96-bit IV: the size AES-GCM is designed for
    TAG_SIZE: 16,      // 128-bit GCM authentication tag
    HEADER_SIZE: 38,   // 4 + 1 + 1 + 4 + 16 + 12

    MAX_PLAINTEXT_BYTES: 256 * MB,  // whole file is held in RAM, so we cap it
    MAX_NAME_BYTES: 1024,           // cap on stored filename length
    MAX_PASSWORD_CHARS: 256
  };

  // Largest .enc file we will accept:
  // header + (4-byte name length + name + file) + GCM tag
  format.MAX_ENCRYPTED_BYTES =
    format.HEADER_SIZE + 4 + format.MAX_NAME_BYTES +
    format.MAX_PLAINTEXT_BYTES + format.TAG_SIZE;

  // Smallest possible valid .enc file: header + 4-byte name length + tag
  format.MIN_ENCRYPTED_BYTES = format.HEADER_SIZE + 4 + format.TAG_SIZE;

  /**
   * Build the 38-byte header for a new file.
   * @param {Uint8Array} salt  16 random bytes
   * @param {Uint8Array} iv    12 random bytes
   * @returns {Uint8Array}
   */
  format.buildHeader = function (salt, iv) {
    var header = new Uint8Array(format.HEADER_SIZE);
    var view = new DataView(header.buffer);   // DataView lets us write multi-byte numbers

    header.set(format.MAGIC, 0);              // bytes 0-3
    header[4] = format.VERSION;               // byte 4
    header[5] = format.KDF_PBKDF2;            // byte 5
    view.setUint32(6, format.ITERATIONS, false); // bytes 6-9 (false = big-endian)
    header.set(salt, 10);                     // bytes 10-25
    header.set(iv, 26);                       // bytes 26-37
    return header;
  };

  /**
   * Read and VALIDATE a header. Throws on anything unexpected, so that
   * broken or malicious files are rejected BEFORE we spend time
   * deriving a key.
   * @param {Uint8Array} bytes  the whole .enc file
   */
  format.parseHeader = function (bytes) {
    if (bytes.length < format.MIN_ENCRYPTED_BYTES) {
      throw new Error("This file is too small to be a Vibex .enc file.");
    }

    for (var i = 0; i < 4; i++) {
      if (bytes[i] !== format.MAGIC[i]) {
        throw new Error("This is not a Vibex .enc file (missing VBX1 header).");
      }
    }

    var version = bytes[4];
    var kdf = bytes[5];
    var iterations = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
      .getUint32(6, false);

    if (version !== format.VERSION) {
      throw new Error("Unsupported file version (" + version + ").");
    }
    if (kdf !== format.KDF_PBKDF2) {
      throw new Error("Unsupported key-derivation method.");
    }
    // Strict policy: only accept the exact iteration count we write.
    // Stops an attacker from crafting a file with 1 iteration (weak)
    // or 4 billion iterations (freezes the browser).
    if (iterations !== format.ITERATIONS) {
      throw new Error("Unsupported key-derivation cost (" + iterations + " iterations).");
    }

    return {
      iterations: iterations,
      salt: bytes.slice(10, 26),
      iv: bytes.slice(26, 38),
      aad: bytes.slice(0, format.HEADER_SIZE),   // the header itself is the AAD
      ciphertext: bytes.slice(format.HEADER_SIZE)
    };
  };

  Vibex.format = format;

  // "self" is the global object in BOTH a web page (window) and a worker.
})(self.Vibex = self.Vibex || {});
