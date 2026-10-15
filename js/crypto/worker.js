/* =====================================================================
   js/crypto/worker.js — THE BACKGROUND CRYPTO THREAD (Web Worker)
   ---------------------------------------------------------------------
   Why a Worker?
     PBKDF2 + encrypting 200 MB takes real CPU time. If we did that on
     the main page thread the whole page would freeze (no progress bar,
     no Cancel button). A Worker runs in a separate thread.
   It also lets "Cancel" work instantly: the page just terminates the
   worker (see js/crypto-client.js).

   How the page and worker talk:
     page   -> worker : postMessage({ id, type: "encrypt"|"decrypt"|"selftest", ... })
     worker -> page   : postMessage({ id, status: "progress"|"complete"|"error", ... })
   "id" matches each answer to the request it belongs to.
   ===================================================================== */

"use strict";

// Load the shared crypto files. Paths are relative to THIS file
// (js/crypto/), so these are the files sitting right next to it.
importScripts(
  "format.js",
  "key-derivation.js",
  "encryption.js",
  "decryption.js",
  "self-test.js"
);

self.onmessage = async function (event) {
  var job = event.data;

  function progress(stage, percent) {
    self.postMessage({ id: job.id, status: "progress", stage: stage, progress: percent });
  }

  try {
    if (job.type === "encrypt") {
      var encrypted = await self.Vibex.encryption.encryptFile(
        job.fileBuffer, job.originalName, job.password, progress
      );
      // The 2nd argument "transfers" the buffer instead of copying it,
      // which matters a lot for a 256 MB file.
      self.postMessage({ id: job.id, status: "complete", buffer: encrypted }, [encrypted]);
      return;
    }

    if (job.type === "decrypt") {
      var result = await self.Vibex.decryption.decryptFile(job.fileBuffer, job.password, progress);
      self.postMessage(
        { id: job.id, status: "complete", buffer: result.fileBuffer, originalName: result.originalName },
        [result.fileBuffer]
      );
      return;
    }

    if (job.type === "selftest") {
      await self.Vibex.selfTest.run();
      self.postMessage({ id: job.id, status: "complete" });
      return;
    }

    throw new Error("Unknown operation.");
  } catch (err) {
    self.postMessage({ id: job.id, status: "error", message: (err && err.message) || "Operation failed." });
  }
};

// If we reach this line, importScripts() above succeeded. Tell the page
// we're alive; until it hears this, the page queues jobs instead of
// sending them (see js/crypto-client.js).
self.postMessage({ status: "ready" });
