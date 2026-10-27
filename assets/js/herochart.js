/* Clash of Candles — faint chart behind the fighters in the hero, drawn like the game.
   Left: the game's line chart with a soft shade. Right: the same price path as candles.
   The game's BREAKOUT / BREAKDOWN levels sit on the right edge. Only the last stretch of candles
   keeps growing — candle by candle it climbs into the breakout, then that stretch resets and grows again.
   Hidden until the fighters collide; main.js calls HeroChart.reveal() at the impact. */
(function () {
  'use strict';
  var cv = document.getElementById('heroChart');
  if (!cv) return;
  var ctx = cv.getContext('2d');
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  // game palette (arena screenshots): jade breakout, ruby breakdown
  var C = { line: '#16C985', up: '#22C98A', down: '#E0195A', out: '#4FDB9B', dn: '#FF5C7F' };
  var N = 150, HALF = 70, TAIL = 26, BASE = N - TAIL, seed = 11, pts = [], p = 0;
  function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
  // fixed history: slow base on the left, a rally, then a range just under the breakout ceiling
  function shape(i) {
    if (i < HALF) return 1 + i * 0.07 + Math.sin(i / 7) * 1.1;
    if (i < 104) return 1 + HALF * 0.07 + (i - HALF) * 0.27;
    return 13.2 + Math.sin((i - 104) / 3.2) * 0.9;
  }
  for (var i = 0; i < BASE; i++) { p = shape(i) + (rnd() - 0.5) * 1.3; pts.push(p); }
  var bars = [];
  for (var k = HALF; k < BASE; k++) {
    var o = pts[k - 1], c = pts[k], w = 0.3 + rnd() * 0.8;
    bars.push({ i: k, o: o, c: c, h: Math.max(o, c) + rnd() * w, l: Math.min(o, c) - rnd() * w });
  }
  var ceil = -Infinity;
  bars.slice(-20).forEach(function (b) { ceil = Math.max(ceil, b.h); });
  var OUT = ceil + 0.5, DOWN = 8.6;                        // the two game levels
  var lo = -1.5, hi = OUT + 3.2;

  // the growing tail: a short dip, then a climb that pierces the breakout level
  var tail = [], tseed = 7;
  function trnd() { tseed = (tseed * 48271) % 2147483647; return tseed / 2147483647; }
  function makeTail() {
    tail = []; var v = pts[BASE - 1], start = v, target = OUT + 1.8;
    for (var t = 0; t < TAIL; t++) {
      var f = t / (TAIL - 1), goal = f < 0.3 ? start - 1.2 * Math.sin(f / 0.3 * Math.PI / 2) : start - 1.2 + (target - start + 1.2) * Math.pow((f - 0.3) / 0.7, 1.6);
      var nv = goal + (trnd() - 0.5) * 0.9; if (t === TAIL - 1) nv = target;
      var w = 0.3 + trnd() * 0.8, o = t ? tail[t - 1].c : v;
      tail.push({ i: BASE + t, o: o, c: nv, h: Math.max(o, nv) + trnd() * w, l: Math.min(o, nv) - trnd() * w });
      v = nv;
    }
  }
  makeTail();

  var prog = 0, W = 0, H = 0, shown = 0, grow = 1, fade = 1, flash = 0, raf = 0, visible = true, last = 0, phase = 'grow', hold = 0;
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
  var TAGW = 0;
  function X(i) { return (i + 0.5) / N * (W - TAGW); }
  function Y(v) { return 10 + (hi - v) / (hi - lo) * (H - 20); }
  function candle(b, alpha, partial) {
    var c = partial == null ? b.c : b.o + (b.c - b.o) * partial, h = partial == null ? b.h : Math.max(b.o, c), l = partial == null ? b.l : Math.min(b.o, c);
    var col = c >= b.o ? C.up : C.down, xc = Math.round(X(b.i)) + 0.5, bw = Math.max(2, (W - TAGW) / N * 0.62);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(xc, Y(h)); ctx.lineTo(xc, Y(l)); ctx.stroke();
    ctx.fillStyle = col; ctx.fillRect(xc - bw / 2, Y(Math.max(b.o, c)), bw, Math.max(1.5, Math.abs(Y(b.o) - Y(c))));
  }
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h); ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath(); }
  function level(v, col, label, on) {
    var y = Math.round(Y(v)) + 0.5, x0 = X(HALF + 4);
    ctx.save();
    ctx.globalAlpha = on ? 0.9 : 0.55; ctx.setLineDash([5, 5]); ctx.strokeStyle = col; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(W - TAGW, y); ctx.stroke(); ctx.setLineDash([]);
    // the game's level tag: pill flush with the right edge, white caps
    ctx.font = '800 ' + (W < 700 ? 9.5 : 11.5) + 'px ' + getComputedStyle(document.body).fontFamily;
    var tw = ctx.measureText(label).width, ph = W < 700 ? 20 : 26, pw = tw + (W < 700 ? 16 : 26);
    ctx.globalAlpha = on ? 1 : 0.6;
    if (on && flash > 0) { ctx.shadowColor = col; ctx.shadowBlur = 18 * flash; }
    ctx.fillStyle = col; rr(W - pw, y - ph / 2, pw, ph, ph / 2.6); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(label, W - pw + (pw - tw) / 2, y + 0.5);
    ctx.restore();
  }
  function draw() {
    if (!W) return;
    ctx.clearRect(0, 0, W, H);
    if (prog <= 0) return;
    TAGW = W < 700 ? 6 : 14;
    ctx.save(); ctx.globalAlpha = 0.5;
    // left: line + shade
    ctx.beginPath(); ctx.moveTo(X(0), Y(pts[0]));
    for (var a = 1; a <= HALF; a++) ctx.lineTo(X(a), Y(pts[a]));
    ctx.lineJoin = 'round'; ctx.lineWidth = 2; ctx.strokeStyle = C.line; ctx.stroke();
    ctx.lineTo(X(HALF), H); ctx.lineTo(X(0), H); ctx.closePath();
    var sh = ctx.createLinearGradient(0, 0, 0, H);
    sh.addColorStop(0, 'rgba(22,201,133,.35)'); sh.addColorStop(1, 'rgba(22,201,133,0)');
    ctx.fillStyle = sh; ctx.fill();
    bars.forEach(function (b) { candle(b, 0.5); });
    // the growing end of the chart
    for (var t = 0; t < shown; t++) candle(tail[t], 0.62 * fade, t === shown - 1 ? grow : null);
    ctx.restore();
    var broke = shown === TAIL && phase !== 'grow';
    level(OUT, C.out, 'BREAKOUT', true);
    level(DOWN, C.dn, 'BREAKDOWN', false);
    if (broke) {
      ctx.save(); ctx.globalAlpha = 0.85 * fade; ctx.fillStyle = C.out;
      var b = tail[TAIL - 1]; ctx.beginPath(); ctx.arc(X(b.i), Y(b.c), 3.5 + flash * 3, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
  }
  // timeline of one loop: candles grow one by one → breakout flash + hold → the tail fades → regrow
  var STEP = 340;
  function frame(ts) {
    raf = 0; if (!visible || document.hidden) return;
    var dt = last ? Math.min(64, ts - last) : 16; last = ts;
    if (phase === 'grow') {
      grow += dt / STEP;
      if (grow >= 1) { if (shown < TAIL) { shown++; grow = 0; } else { phase = 'hold'; hold = 0; flash = 1; } }
    } else if (phase === 'hold') {
      hold += dt; flash = Math.max(0, 1 - hold / 900);
      if (hold > 1800) { phase = 'fade'; }
    } else if (phase === 'fade') {
      fade -= dt / 450;
      if (fade <= 0) { fade = 1; shown = 0; grow = 1; phase = 'grow'; makeTail(); }
    }
    draw(); raf = requestAnimationFrame(frame);
  }
  function run() { if (!raf && !reduced && prog > 0) { last = 0; raf = requestAnimationFrame(frame); } }
  function reveal() { prog = 1; cv.classList.add('is-on'); if (reduced) { shown = TAIL; grow = 1; phase = 'hold'; } draw(); run(); }
  function show() { reveal(); }

  if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { visible = e[0].isIntersecting; if (visible) run(); }).observe(cv);
  document.addEventListener('visibilitychange', run);
  if ('ResizeObserver' in window) new ResizeObserver(size).observe(hero); else window.addEventListener('resize', size);
  size();
  window.HeroChart = { reveal: reveal, show: show };
})();
