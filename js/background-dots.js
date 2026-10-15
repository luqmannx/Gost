/* =====================================================================
   js/background-dots.js — THE FLOATING DOTS ANIMATION
   ---------------------------------------------------------------------
   Pure decoration. Draws on <canvas id="particleCanvas">.
   All visual settings (color, line opacity, line distance) come from
   css/background-dots.css, so this file only does the MOVEMENT.

   How the animation works (runs ~60 times per second):
     1. each dot slowly turns toward a new random direction
     2. dots that leave the screen wrap around to the other side
     3. dots near the mouse are gently pushed away
     4. dots closer than --dot-link-distance get a faint line between them

   "Reduce motion": if the OS asks for less motion, the dots still move,
   but at 55% speed (slow drifting is gentle).
   ===================================================================== */

(function () {
  "use strict";

  var canvas = document.getElementById("particleCanvas");
  if (!canvas) return;
  var ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;

  var SPEED_FACTOR = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0.55 : 1;
  var MOUSE_RADIUS_SQ = 110 * 110;            // mouse pushes dots within 110px

  var width = 0, height = 0;
  var dots = [];
  var mouseX = -9999, mouseY = -9999;         // off-screen until the mouse moves
  var frameId = null, lastTime = 0;

  // Settings read from css/background-dots.css (defaults in case CSS fails)
  var dotRGB = "255,255,255";
  var dotAlpha = 0.6;
  var lineOpacity = 0.066;
  var linkDistanceSq = 132 * 132;

  /** Read color, --dot-line-opacity and --dot-link-distance from CSS. */
  function readStyle() {
    var style = getComputedStyle(canvas);
    var nums = style.color.match(/[\d.]+/g) || ["255", "255", "255", "0.6"];  // "rgba(r, g, b, a)"
    dotRGB = nums.slice(0, 3).join(",");
    dotAlpha = nums[3] !== undefined ? parseFloat(nums[3]) : 1;

    lineOpacity = parseFloat(style.getPropertyValue("--dot-line-opacity")) || 0.066;
    var distance = parseFloat(style.getPropertyValue("--dot-link-distance")) || 132;
    // We compare SQUARED distances later (avoids a slow Math.sqrt per pair)
    linkDistanceSq = distance * distance;
  }

  function randomVelocity() {
    var angle = Math.random() * Math.PI * 2;  // Math.random is FINE here: it's only visuals
    var speed = (3 + Math.random() * 5) * SPEED_FACTOR;   // pixels per second
    return { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
  }

  /** Match canvas size to the window and create the dots. */
  function resize() {
    // devicePixelRatio = 2 on "retina" screens; drawing at that
    // resolution keeps the dots sharp. Capped at 2 for performance.
    var ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    // More dots on bigger screens, between 24 and 66.
    var count = Math.min(66, Math.max(24, Math.round((width * height) / 33000)));
    dots = [];
    for (var i = 0; i < count; i++) {
      var v = randomVelocity();
      dots.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: v.x, vy: v.y,                     // current velocity
        tvx: v.x, tvy: v.y,                   // target velocity (we ease toward it)
        nextTurn: performance.now() + 3500 + Math.random() * 5500,
        r: 0.5 + Math.random()                // radius 0.5 - 1.5 px
      });
    }
  }

  function drawDots() {
    ctx.fillStyle = "rgba(" + dotRGB + "," + dotAlpha + ")";
    for (var i = 0; i < dots.length; i++) {
      ctx.beginPath();
      ctx.arc(dots[i].x, dots[i].y, dots[i].r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawLines() {
    ctx.lineWidth = 1;
    // Check every PAIR of dots (a, b).
    for (var a = 0; a < dots.length; a++) {
      for (var b = a + 1; b < dots.length; b++) {
        var dx = dots[a].x - dots[b].x;
        var dy = dots[a].y - dots[b].y;
        var distSq = dx * dx + dy * dy;
        if (distSq < linkDistanceSq) {
          // Closer dots = more visible line (fades to 0 at the max distance)
          var alpha = (1 - distSq / linkDistanceSq) * lineOpacity;
          ctx.strokeStyle = "rgba(" + dotRGB + "," + alpha.toFixed(3) + ")";
          ctx.beginPath();
          ctx.moveTo(dots[a].x, dots[a].y);
          ctx.lineTo(dots[b].x, dots[b].y);
          ctx.stroke();
        }
      }
    }
  }

  function moveDots(now, dt) {
    for (var i = 0; i < dots.length; i++) {
      var p = dots[i];

      // 1. Occasionally pick a new direction
      if (now >= p.nextTurn) {
        var v = randomVelocity();
        p.tvx = v.x;
        p.tvy = v.y;
        p.nextTurn = now + 1800 + Math.random() * 4200;
      }

      // Ease toward the target velocity (1.8% per frame = smooth turns)
      p.vx += (p.tvx - p.vx) * 0.018;
      p.vy += (p.tvy - p.vy) * 0.018;
      p.x += p.vx * (dt / 1000);
      p.y += p.vy * (dt / 1000);

      // 2. Wrap around the edges
      if (p.x < -10) p.x = width + 10; else if (p.x > width + 10) p.x = -10;
      if (p.y < -10) p.y = height + 10; else if (p.y > height + 10) p.y = -10;

      // 3. Push away from the mouse
      var mdx = p.x - mouseX;
      var mdy = p.y - mouseY;
      var mDistSq = mdx * mdx + mdy * mdy;
      if (mDistSq < MOUSE_RADIUS_SQ && mDistSq > 0.01) {
        var force = 0.4 / Math.sqrt(mDistSq);
        p.x += mdx * force * 0.035;
        p.y += mdy * force * 0.035;
      }
    }
  }

  function frame(now) {
    // dt = milliseconds since last frame (capped so a background tab
    // doesn't make dots jump across the screen)
    var dt = lastTime ? Math.min(50, now - lastTime) : 16.67;
    lastTime = now;

    ctx.clearRect(0, 0, width, height);
    moveDots(now, dt);
    drawLines();                              // lines first so dots sit on top
    drawDots();

    frameId = requestAnimationFrame(frame);
  }

  function start() {
    if (frameId === null) {
      lastTime = 0;
      frameId = requestAnimationFrame(frame);
    }
  }

  function stop() {
    if (frameId !== null) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
  }

  /* ---------- Events ---------- */
  var resizeTimer;
  window.addEventListener("resize", function () {
    // "Debounce": wait until resizing stops for 150ms before rebuilding
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  }, { passive: true });

  window.addEventListener("pointermove", function (e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
  }, { passive: true });

  // Mouse left the browser window (relatedTarget is null when leaving the page)
  document.addEventListener("mouseout", function (e) {
    if (!e.relatedTarget) mouseX = mouseY = -9999;
  }, { passive: true });

  // Pause when the tab is hidden (saves battery/CPU)
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop(); else start();
  });

  // Theme switched -> dot color and line opacity changed in CSS
  window.addEventListener("themechange", readStyle);

  /* ---------- Go ---------- */
  readStyle();
  resize();
  start();
})();
