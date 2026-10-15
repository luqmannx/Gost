/* =====================================================================
   js/password-generator.js — THE DICE BUTTON (random strong passphrase)
   ---------------------------------------------------------------------
   Generates 24 characters from a 70-character alphabet.
   Strength: 24 x log2(70) ≈ 147 bits of randomness. For comparison,
   AES-128 is 128 bits, so guessing this is not realistic.

   Look-alike characters (I, O, l, 0, 1) are left out so a person can
   copy the passphrase by hand without mistakes.
   ===================================================================== */

(function (Vibex) {
  "use strict";

  var UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";   // 24 (no I, O)
  var LOWER = "abcdefghijkmnopqrstuvwxyz";  // 25 (no l)
  var DIGITS = "23456789";                  //  8 (no 0, 1)
  var SYMBOLS = "!@#$%^&*-_=+?";            // 13
  var ALL = UPPER + LOWER + DIGITS + SYMBOLS;

  /**
   * A secure random whole number from 0 to max-1, with NO bias.
   *
   * Why not just  random % max ?  "Modulo bias":
   * a random 32-bit number has 4,294,967,296 possible values. If that
   * isn't an exact multiple of max, the smaller results come up
   * slightly more often. So we throw away the few values at the top
   * ("rejection sampling") and only keep a range that divides evenly.
   */
  function randomInt(max) {
    var limit = Math.floor(0x100000000 / max) * max;
    var buf = new Uint32Array(1);
    do {
      crypto.getRandomValues(buf);
    } while (buf[0] >= limit);
    return buf[0] % max;
  }

  function pick(chars) {
    return chars[randomInt(chars.length)];
  }

  function generate(length) {
    length = length || 24;

    // Guarantee at least one of each type...
    var out = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SYMBOLS)];
    // ...then fill the rest from everything.
    while (out.length < length) out.push(pick(ALL));

    // Fisher–Yates shuffle, so the guaranteed characters aren't always
    // in the first 4 positions.
    for (var i = out.length - 1; i > 0; i--) {
      var j = randomInt(i + 1);
      var tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out.join("");
  }

  Vibex.passwordGenerator = { generate: generate };
})(window.Vibex = window.Vibex || {});
