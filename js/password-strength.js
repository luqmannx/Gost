/* =====================================================================
   js/password-strength.js — THE 4-BAR STRENGTH METER
   ---------------------------------------------------------------------
   A simple rule-based estimate:
     - contains a very common password  -> always "weak"
     - otherwise +1 point each for: length >= 10, length >= 16,
       upper+lower case, a digit, a symbol

   LIMITATION: rules like these are easy to fool ("Password123!" scores
   well but is terrible). Real-world meters such as "zxcvbn" check
   dictionaries, keyboard patterns, dates, etc. That's a good upgrade
   idea for this project. The generated passphrase is always the safest choice.
   ===================================================================== */

(function (Vibex) {
  "use strict";

  var COMMON = [
    "password", "123456", "qwerty", "letmein", "admin", "welcome", "monkey",
    "dragon", "master", "abc123", "iloveyou", "football", "baseball",
    "princess", "sunshine", "12345678", "123456789", "1234567890",
    "passw0rd", "p@ssw0rd"
  ];

  var LABELS = {
    0: "",
    1: "Weak — add length and symbols",
    2: "Fair — could be stronger",
    3: "Good — prefer a generated passphrase",
    4: "Strong — generated passphrases are recommended"
  };

  /** @returns {number} 0 (empty) to 4 (strong) */
  function evaluate(password) {
    if (!password) return 0;

    var lower = password.toLowerCase();
    for (var i = 0; i < COMMON.length; i++) {
      if (lower.indexOf(COMMON[i]) !== -1) return 1;
    }

    var score = 0;
    if (password.length >= 10) score++;
    if (password.length >= 16) score++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 1) return 1;
    if (score === 2) return 2;
    if (score <= 4) return 3;
    return 4;
  }

  function label(level) {
    return LABELS[level] || "";
  }

  Vibex.passwordStrength = { evaluate: evaluate, label: label };
})(window.Vibex = window.Vibex || {});
