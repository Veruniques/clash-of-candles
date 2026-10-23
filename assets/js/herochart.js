/* Clash of Candles — faint chart behind the fighters in the hero.
   Left half: the game's line chart with a soft shade, right half: the same price path as candles.
   Hidden until the fighters collide; main.js calls HeroChart.reveal() at the impact. */
(function () {
  'use strict';
  var cv = document.getElementById('heroChart');
  if (!cv) return;
  var ctx = cv.getContext('2d');
  var C = { line: '#16C985', up: '#16C985', down: '#E0195A', grid: 'rgba(11,44,58,.10)' }; // game palette, a touch darker for the turquoise
  var N = 150, HALF = 78, seed = 11, pts = [], p = 0;
  function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
  for (var i = 0; i < N; i++) { p += (rnd() - 0.47) * 2.2 + Math.sin(i / 11) * 0.45; pts.push(p); }
  var bars = [];
  for (var k = HALF; k < N; k++) {
    var o = pts[k - 1], c = pts[k], w = 0.4 + rnd() * 1.1;
    bars.push({ i: k, o: o, c: c, h: Math.max(o, c) + rnd() * w, l: Math.min(o, c) - rnd() * w });
  }
  var lo = Math.min.apply(null, pts) - 3, hi = Math.max.apply(null, pts) + 3;
  var prog = 0, W = 0, H = 0, raf = 0;

  // sit between the bottom of the title and the floor line, never over the title
  var hero = cv.parentNode, title = document.getElementById('titleWrap'), floor = document.querySelector('.hero__floor'), scene = document.getElementById('scene');
  function place() {
    if (!scene || !title || !floor) return;
    var top = scene.offsetTop + title.offsetTop + title.offsetHeight + 8;
    var bottom = scene.offsetTop + floor.offsetTop;
    cv.style.top = top + 'px'; cv.style.height = Math.max(60, bottom - top) + 'px';
  }
  function size() {
    place();
    var r = cv.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height; if (!W) return;
    cv.width = Math.round(W * d); cv.height = Math.round(H * d); ctx.setTransform(d, 0, 0, d, 0, 0);
    draw();
  }
  function X(i) { return (i + 0.5) / N * W; }
  function Y(v) { return 8 + (hi - v) / (hi - lo) * (H - 16); }
  function draw() {
    if (!W) return;
    ctx.clearRect(0, 0, W, H);
    if (prog <= 0) return;
    ctx.save(); ctx.globalAlpha = 0.5; // low-opacity shade behind the fighters
    ctx.beginPath(); ctx.rect(0, 0, W * prog, H); ctx.clip();
    // left half: line + shade
    ctx.beginPath(); ctx.moveTo(X(0), Y(pts[0]));
    for (var a = 1; a <= HALF; a++) ctx.lineTo(X(a), Y(pts[a]));
    ctx.lineJoin = 'round'; ctx.lineWidth = 2; ctx.strokeStyle = C.line; ctx.stroke();
    ctx.lineTo(X(HALF), H); ctx.lineTo(X(0), H); ctx.closePath();
    var sh = ctx.createLinearGradient(0, 0, 0, H);
    sh.addColorStop(0, 'rgba(22,201,133,.35)'); sh.addColorStop(1, 'rgba(22,201,133,0)');
    ctx.fillStyle = sh; ctx.fill();
    // right half: candles
    var bw = Math.max(2, W / N * 0.62);
    bars.forEach(function (b) {
      var col = b.c >= b.o ? C.up : C.down, xc = Math.round(X(b.i)) + 0.5;
      ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(xc, Y(b.h)); ctx.lineTo(xc, Y(b.l)); ctx.stroke();
      ctx.fillStyle = col; ctx.fillRect(xc - bw / 2, Y(Math.max(b.o, b.c)), bw, Math.max(1.5, Math.abs(Y(b.o) - Y(b.c))));
    });
    ctx.restore();
  }
  // the whole chart snaps in at once, the moment the fighters collide
  function reveal() { prog = 1; draw(); cv.classList.add('is-on'); }
  function show() { prog = 1; cv.classList.add('is-on'); draw(); }

  if ('ResizeObserver' in window) new ResizeObserver(size).observe(hero); else window.addEventListener('resize', size);
  size();
  window.HeroChart = { reveal: reveal, show: show };
})();
