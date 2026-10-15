/* =====================================================================
   js/file-io.js — READING THE CHOSEN FILE + DOWNLOADING THE RESULT
   ---------------------------------------------------------------------
   Nothing is uploaded anywhere. "Reading" = the browser loads the file
   from YOUR disk into memory. "Downloading" = the browser saves bytes
   that are already in memory back to YOUR disk.
   ===================================================================== */

(function (Vibex) {
  "use strict";

  var currentReader = null;

  /**
   * Read a File into an ArrayBuffer, reporting progress.
   * (file.arrayBuffer() is simpler, but FileReader gives progress events.)
   * @param {File} file
   * @param {function(number, number, number)} onProgress  (fraction 0-1, bytesPerSecond, secondsLeft)
   * @returns {Promise<ArrayBuffer>}
   */
  function read(file, onProgress) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      var startTime = performance.now();
      var lastUpdate = 0;
      currentReader = reader;

      reader.onprogress = function (e) {
        if (!e.lengthComputable || !onProgress) return;
        var now = performance.now();
        if (now - lastUpdate < 80) return;        // max ~12 UI updates per second
        lastUpdate = now;

        var fraction = e.loaded / e.total;
        var seconds = Math.max((now - startTime) / 1000, 0.001);
        var rate = e.loaded / seconds;
        var secondsLeft = Math.max(0, (e.total - e.loaded) / rate);
        onProgress(fraction, rate, secondsLeft);
      };

      reader.onload = function () {
        currentReader = null;
        resolve(reader.result);
      };
      reader.onerror = function () {
        currentReader = null;
        reject(new Error("Couldn't read that file."));
      };
      reader.onabort = function () {
        currentReader = null;
        reject(Vibex.utils.cancelledError());
      };

      reader.readAsArrayBuffer(file);
    });
  }

  /** Stop a read in progress (Cancel button). */
  function abort() {
    if (currentReader) {
      try { currentReader.abort(); } catch (e) { /* already finished */ }
    }
  }

  /**
   * Save a Blob to the user's Downloads folder.
   * Trick: create an invisible <a download> link pointing at an
   * in-memory "blob:" URL, click it, then free the memory.
   */
  function download(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = Vibex.utils.safeFileName(name, "download");
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Give the browser time to start the download before freeing the URL.
    setTimeout(function () { URL.revokeObjectURL(url); }, 8000);
  }

  /**
   * Name for an encrypted output file, e.g. "vibex-3f9a1c2e7b0d4a61.enc".
   * PRIVACY: we deliberately do NOT use "original-name.pdf.enc". The real
   * name is stored INSIDE the encryption and comes back on decrypt;
   * putting it on the outside would leak it to anyone who sees the file.
   */
  function randomEncryptedName() {
    return "vibex-" + Vibex.utils.randomHex(8) + ".enc";
  }

  Vibex.fileIO = { read: read, abort: abort, download: download, randomEncryptedName: randomEncryptedName };
})(window.Vibex = window.Vibex || {});
