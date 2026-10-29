/* Clash of Candles — quiet chart behind the fighters in the hero, drawn like the game's arena:
   a long line history, then a short run of small candles, the BREAKOUT / BREAKDOWN levels
   (coloured dashed lead-in + tag on the right edge). Only the newest candles animate:
   they build up, spike through the breakout, pull back, then that stretch resets and plays again.
   Hidden until the fighters collide; main.js calls HeroChart.reveal() at the impact. */
(function () {
  'use strict';
  var cv = document.getElementById('heroChart');
  if (!cv) return;
  var ctx = cv.getContext('2d');
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var C = { line: '#3FD996', up: '#3FC98A', down: '#E0335A', wick: '#59646A', out: '#5FE3A1', dn: '#E0335A' };

  var seed = 5;
  function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
  function anchors(list, n) { // smooth path through [fraction, value] anchors
    var out = [];
    for (var i = 0; i < n; i++) {
      var f = i / (n - 1), k = 1; while (k < list.length - 1 && list[k][0] < f) k++;
      var a = list[k - 1], b = list[k], t = (f - a[0]) / (b[0] - a[0] || 1); t = t * t * (3 - 2 * t);
      out.push(a[1] + (b[1] - a[1]) * t);
    }
    return out;
  }
  // 1) line history (the game's "hourly" view)
  var LN = 320, line = anchors([[0, 84], [.03, 92], [.12, 86], [.2, 84], [.27, 74], [.3, 60], [.34, 52], [.4, 57], [.47, 56], [.48, 38], [.55, 34], [.6, 40],
    [.68, 33], [.72, 22], [.78, 38], [.82, 52], [.86, 44], [.9, 38], [.95, 41], [1, 33]], LN);
  var walk = 0; line = line.map(function (v) { walk = walk * 0.6 + (rnd() - 0.5) * 5; return 30 + (v + walk - 20) * 0.55; });
  // 2) small candles that continue it (faint), then 3) the live stretch that grows
  var CB = 62, TAIL = 24, bars = [], last = line[LN - 1];
  var cpath = anchors([[0, last], [.2, 34], [.35, 36], [.5, 41], [.65, 39], [.85, 36], [1, 35]], CB);
  cpath.forEach(function (c, i) { var o = i ? bars[i - 1].c : last; c += (rnd() - 0.5) * 1.6; var w = 0.4 + rnd() * 1.1;
    bars.push({ o: o, c: c, h: Math.max(o, c) + rnd() * w, l: Math.min(o, c) - rnd() * w }); });
  var OUT = 56, DOWN = 14, lo = 4, hi = 74, BASEV = 38;
  var tail = [];
  function makeTail() {
    tail = []; var tseed = 3 + Math.floor(Math.random() * 1e6);
    var tr = function () { tseed = (tseed * 48271) % 2147483647; return tseed / 2147483647; };
    var path = [35, 36, 34.5, 37, 38.5, 37.5, 40, 42, 41, 44, 46.5, 45.5, 48.5, 53, 52, 55.5, 58, 57, 60, 59, 62.5, 61.5, 64.5, 63.5];
    var prev = bars[CB - 1].c;
    path.forEach(function (c, i) { c += (tr() - 0.5) * 1.6; var o = prev, w = 0.4 + tr() * 1.3;
      tail.push({ o: o, c: c, h: Math.max(o, c) + tr() * w, l: Math.min(o, c) - tr() * w }); prev = c; });
  }
  makeTail();

  var broke = false, W = 0, H = 0, on = false, shown = 0, grow = 1, fade = 1, flash = 0, raf = 0, visible = true, lastTs = 0, phase = 'grow', hold = 0;
  var hero = cv.parentNode, title = document.getElementById('titleWrap'), floor = document.querySelector('.hero__floor'), scene = document.getElementById('scene');
  // the candles sit at the fighters' eye level; the canvas is as tall as the space between title and floor
  function place() {
    if (!scene || !title || !floor) return;
    var top = scene.offsetTop + title.offsetTop + title.offsetHeight + 8, bottom = scene.offsetTop + floor.offsetTop;
    var h = Math.max(200, bottom - top), fg = document.getElementById('exitGreen');
    if (fg) {
      var hr = hero.getBoundingClientRect(), g = fg.getBoundingClientRect();
      if (g.height) { var eye = g.top - hr.top + g.height * 0.42; top = eye - 8 - (hi - BASEV) / (hi - lo) * (h - 16); }
    }
    top = Math.min(top, bottom - h); // never spill below the floor into the copy
    cv.style.top = Math.round(top) + 'px'; cv.style.height = Math.round(h) + 'px';
  }
  function size() {
    place();
    var r = cv.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height; if (!W) return;
    cv.width = Math.round(W * d); cv.height = Math.round(H * d); ctx.setTransform(d, 0, 0, d, 0, 0);
    draw();
  }
  // layout like the arena: line → ~67 %, candles → ~88 %, tags flush right
  var XL = 0.67, XE = 0.885;
  function lx(i) { return i / (LN - 1) * W * XL; }
  function cx(j) { var slot = W * (XE - XL) / (CB + TAIL); return W * XL + (j + 0.5) * slot; }
  function Y(v) { return 8 + (hi - v) / (hi - lo) * (H - 16); }
  function candle(b, j, alpha, part) {
    var c = part == null ? b.c : b.o + (b.c - b.o) * part, h = part == null ? b.h : Math.max(b.o, c, b.o + (b.h - b.o) * part), l = part == null ? b.l : Math.min(b.o, c);
    var x = Math.round(cx(j)) + 0.5, bw = Math.max(1.5, W * (XE - XL) / (CB + TAIL) * 0.6);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = C.wick; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, Y(h)); ctx.lineTo(x, Y(l)); ctx.stroke();
    ctx.fillStyle = c >= b.o ? C.up : C.down; ctx.fillRect(x - bw / 2, Y(Math.max(b.o, c)), bw, Math.max(1, Math.abs(Y(b.o) - Y(c))));
  }
  function tag(v, col, label, lit) {
    var y = Math.round(Y(v)) + 0.5, small = W < 700;
    ctx.save();
    ctx.font = '800 ' + (small ? 9.5 : 12.5) + 'px ' + getComputedStyle(document.body).fontFamily;
    var tw = ctx.measureText(label).width, ph = small ? 20 : 30, pw = tw + (small ? 12 : 24), x = W - pw, r = small ? 5 : 7;
    // coloured dashed lead-in from the last candles to the tag
    ctx.setLineDash([small ? 4 : 7, small ? 4 : 6]); ctx.strokeStyle = col; ctx.lineWidth = small ? 1.2 : 1.6; ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.moveTo(W * (XE - 0.05), y); ctx.lineTo(x, y); ctx.stroke(); ctx.setLineDash([]);
    ctx.globalAlpha = 0.62;
    if (lit > 0) { ctx.shadowColor = col; ctx.shadowBlur = 22 * lit; }
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x + r, y - ph / 2); ctx.lineTo(W, y - ph / 2); ctx.lineTo(W, y + ph / 2); ctx.lineTo(x + r, y + ph / 2);
    ctx.arcTo(x, y + ph / 2, x, y - ph / 2, r); ctx.arcTo(x, y - ph / 2, x + r, y - ph / 2, r); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(label, x + (pw - tw) / 2, y + 1);
    ctx.restore();
  }
  function draw() {
    if (!W) return;
    ctx.clearRect(0, 0, W, H);
    if (!on) return;
    ctx.save();
    // line history: thin, pale — like the game's faded past
    ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.moveTo(lx(0), Y(line[0]));
    for (var i = 1; i < LN; i++) ctx.lineTo(lx(i), Y(line[i]));
    ctx.lineJoin = 'round'; ctx.lineWidth = W < 700 ? 1.2 : 1.6; ctx.strokeStyle = C.line; ctx.stroke();
    bars.forEach(function (b, j) { candle(b, j, 0.38); });
    for (var t = 0; t < shown; t++) candle(tail[t], CB + t, 0.95 * fade, t === shown - 1 ? grow : null);
    ctx.restore();
    var spiked = shown > 10;
    tag(OUT, C.out, 'BREAKOUT', broke ? flash : 0);
    tag(DOWN, C.dn, 'BREAKDOWN', 0);
  }
  // one loop: the live candles build up one by one → spike through BREAKOUT (tag glows) → hold → fade → again
  function frame(ts) {
    raf = 0; if (!visible || document.hidden) return;
    var dt = lastTs ? Math.min(64, ts - lastTs) : 16; lastTs = ts;
    if (phase === 'grow') {
      grow += dt / 150;
      if (grow >= 1) {
        if (!broke && shown && tail[shown - 1].c > OUT) { broke = true; flash = 1; }
        if (shown < TAIL) { shown++; grow = 0; } else { phase = 'hold'; hold = 0; }
      }
      if (flash > 0) flash = Math.max(0, flash - dt / 1000);
    } else if (phase === 'hold') {
      hold += dt; if (hold > 1200) phase = 'fade';
    } else {
      fade -= dt / 350;
      if (fade <= 0) { fade = 1; shown = 0; grow = 1; flash = 0; broke = false; phase = 'grow'; makeTail(); }
    }
    draw(); raf = requestAnimationFrame(frame);
  }
  function run() { if (!raf && !reduced && on && visible && !document.hidden) { lastTs = 0; raf = requestAnimationFrame(frame); } }
  function reveal() { place(); size(); on = true; cv.classList.add('is-on'); if (reduced) { shown = TAIL; grow = 1; phase = 'hold'; } draw(); run(); }

  if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { visible = e[0].isIntersecting; run(); }).observe(cv);
  document.addEventListener('visibilitychange', run);
  if ('ResizeObserver' in window) new ResizeObserver(size).observe(hero); else window.addEventListener('resize', size);
  size();
  window.HeroChart = { reveal: reveal, show: reveal };
})();
