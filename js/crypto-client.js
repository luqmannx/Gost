/* =====================================================================
   js/crypto-client.js — THE PAGE'S CONNECTION TO THE CRYPTO WORKER
   ---------------------------------------------------------------------
   Other files call ONE function:

       Vibex.cryptoClient.run("encrypt", { fileBuffer, originalName, password }, onProgress)
         -> Promise resolving to { buffer }

       Vibex.cryptoClient.run("decrypt", { fileBuffer, password }, onProgress)
         -> Promise resolving to { buffer, originalName }

       Vibex.cryptoClient.run("selftest")
         -> Promise that resolves if all tests pass

   and they don't need to know WHERE the crypto actually runs:

     MODE "worker"   normal case: js/crypto/worker.js in a background thread
     MODE "page"     fallback: same crypto files, run on the page itself.
                     Used when the page is opened as a local file
                     (double-clicking index.html), because browsers like
                     Chrome block Workers loaded from file:// URLs.
     MODE "starting" worker is loading; jobs wait in a queue until
                     the worker says "ready".
   ===================================================================== */

(function (Vibex) {
  "use strict";

  var WORKER_URL = "js/crypto/worker.js";

  var mode = "starting";
  var worker = null;
  var pending = new Map();   // job id -> job object (still waiting for an answer)
  var queue = [];            // jobs waiting for the worker to be ready
  var nextId = 0;

  /* ---------- Starting / stopping the worker ---------- */

  function start() {
    if (location.protocol === "file:" || typeof Worker === "undefined") {
      switchToPageMode();
      return;
    }

    mode = "starting";
    try {
      worker = new Worker(WORKER_URL);
    } catch (e) {
      worker = null;
      switchToPageMode();
      return;
    }

    worker.onmessage = function (event) {
      var msg = event.data;

      if (msg.status === "ready") {
        mode = "worker";
        var waiting = queue;
        queue = [];
        waiting.forEach(sendToWorker);
        return;
      }

      var job = pending.get(msg.id);
      if (!job) return;           // job was cancelled; ignore late answers

      if (msg.status === "progress") {
        if (job.onProgress) job.onProgress(msg.stage, msg.progress);
        return;
      }

      pending.delete(msg.id);
      if (msg.status === "complete") job.resolve(msg);
      else job.reject(new Error(msg.message || "Operation failed."));
    };

    worker.onerror = function (event) {
      event.preventDefault();
      stopWorker();
      if (mode === "starting") {
        // Worker never loaded (blocked or missing file) -> use page mode.
        switchToPageMode();
      } else {
        // Worker crashed mid-job (e.g. ran out of memory).
        rejectAll(new Error("The crypto worker stopped unexpectedly."));
        start();
      }
    };
  }

  function stopWorker() {
    if (worker) {
      try { worker.terminate(); } catch (e) { /* already gone */ }
    }
    worker = null;
  }

  function switchToPageMode() {
    mode = "page";
    var waiting = queue;
    queue = [];
    waiting.forEach(runOnPage);
  }

  /* ---------- Running a job ---------- */

  function run(type, payload, onProgress) {
    return new Promise(function (resolve, reject) {
      var job = {
        id: ++nextId,
        type: type,
        payload: payload || {},
        onProgress: onProgress,
        resolve: resolve,
        reject: reject
      };
      pending.set(job.id, job);

      if (mode === "worker") sendToWorker(job);
      else if (mode === "page") runOnPage(job);
      else queue.push(job);
    });
  }

  function sendToWorker(job) {
    var message = Object.assign({ id: job.id, type: job.type }, job.payload);
    // Transfer (move) the file buffer to the worker instead of copying it.
    var transfer = job.payload.fileBuffer instanceof ArrayBuffer ? [job.payload.fileBuffer] : [];
    worker.postMessage(message, transfer);
  }

  function runOnPage(job) {
    var p = job.payload;
    var progress = function (stage, percent) {
      if (pending.has(job.id) && job.onProgress) job.onProgress(stage, percent);
    };

    var task;
    if (job.type === "encrypt") {
      task = Vibex.encryption.encryptFile(p.fileBuffer, p.originalName, p.password, progress)
        .then(function (buffer) { return { buffer: buffer }; });
    } else if (job.type === "decrypt") {
      task = Vibex.decryption.decryptFile(p.fileBuffer, p.password, progress)
        .then(function (r) { return { buffer: r.fileBuffer, originalName: r.originalName }; });
    } else if (job.type === "selftest") {
      task = Vibex.selfTest.run().then(function () { return {}; });
    } else {
      task = Promise.reject(new Error("Unknown operation."));
    }

    task.then(
      function (result) {
        if (!pending.has(job.id)) return;   // cancelled meanwhile
        pending.delete(job.id);
        job.resolve(result);
      },
      function (err) {
        if (!pending.has(job.id)) return;
        pending.delete(job.id);
        job.reject(err);
      }
    );
  }

  function rejectAll(error) {
    var jobs = Array.from(pending.values());
    pending.clear();
    queue = [];
    jobs.forEach(function (job) { job.reject(error); });
  }

  /* ---------- Cancel ---------- */

  function cancel() {
    rejectAll(Vibex.utils.cancelledError());
    // Worker mode: killing the thread stops the work immediately.
    // Page mode: JavaScript can't be interrupted, so the job finishes in
    // the background and its result is simply ignored (it's no longer
    // in "pending").
    if (mode !== "page") {
      stopWorker();
      start();
    }
  }

  function shutdown() {
    stopWorker();
  }

  Vibex.cryptoClient = { start: start, run: run, cancel: cancel, shutdown: shutdown };
})(window.Vibex = window.Vibex || {});
