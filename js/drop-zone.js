/* =====================================================================
   js/drop-zone.js — "CHOOSE A FILE OR DROP IT HERE" BOXES
   ---------------------------------------------------------------------
   Used twice: once for the Encrypt pane, once for the Decrypt pane.
   setup() returns a small object:
       zone.getFile()  -> the chosen File (or null)
       zone.clear()    -> forget the chosen file
   ===================================================================== */

(function (Vibex) {
  "use strict";

  function setup(zoneId, inputId, displayId) {
    var $ = Vibex.utils.$;
    var zone = $(zoneId);
    var input = $(inputId);
    var display = $(displayId);

    // We remember the file ourselves instead of relying on input.files,
    // because some browsers won't let JS put a DROPPED file into
    // input.files. (In the old version, dropping a file could look
    // selected but then say "Choose a file first".)
    var selected = null;

    function setFile(file) {
      selected = file || null;
      if (selected) {
        display.textContent =
          Vibex.utils.safeFileName(selected.name, "Selected file") + " · " +
          Vibex.utils.formatBytes(selected.size);
        display.classList.add("is-set");
      } else {
        display.textContent = "";
        display.classList.remove("is-set");
      }
    }

    // --- Drag & drop ---
    zone.addEventListener("dragover", function (e) {
      e.preventDefault();               // required, or the browser won't allow a drop
      zone.classList.add("is-over");
    });

    zone.addEventListener("dragleave", function (e) {
      // dragleave also fires when moving over the zone's own children
      // (icon, text). Only un-highlight when really leaving the zone.
      if (!zone.contains(e.relatedTarget)) zone.classList.remove("is-over");
    });

    zone.addEventListener("drop", function (e) {
      e.preventDefault();               // stop the browser from opening the file
      zone.classList.remove("is-over");
      var file = e.dataTransfer.files[0];
      if (file) setFile(file);
    });

    // --- Click / keyboard opens the normal file picker ---
    input.addEventListener("click", function (e) {
      e.stopPropagation();              // avoid the zone's click handler firing again
    });
    input.addEventListener("change", function () {
      setFile(input.files.length ? input.files[0] : null);
    });
    zone.addEventListener("click", function () {
      input.click();
    });
    zone.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        input.click();
      }
    });

    return {
      getFile: function () { return selected; },
      clear: function () {
        input.value = "";
        setFile(null);
      }
    };
  }

  Vibex.dropZone = { setup: setup };
})(window.Vibex = window.Vibex || {});
