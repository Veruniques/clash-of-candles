/* Clash of Candles — demo game in the real game UI: auto-playing tutorial + free play.
   Simulated chart (random walk) so it works offline and nobody can look the answer up.
   Economy + products come from window.CoC.config (assets/data/rewards.json):
   coins pay the entry ("fuel"), each win earns one srdíčko (heart), hearts lead to rewards. */
(function () {
  'use strict';
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var game = $('#game'); if (!game) return;
  var cv = $('#chart'), ctx = cv.getContext('2d'), stage = $('#gStage');
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fmt = function (n) { return window.CoC && window.CoC.fmt ? window.CoC.fmt(n) : String(Math.round(n)); };

  var ui = {
    views: $$('.views__b'), timer: $('#gTimer'), g1: $('#gG1'), timer2: $('#gTimer2'), clock: $('#gClock'),
    coins: $('#gCoins'), candles: $('#gCandles'), sentDn: $('#gSentDn'), sentUp: $('#gSentUp'), sentBar: $('#gSentBar'),
    tf: $('#gTf'), date: $('#gDate'), status: $('#gStatus'), legend: $('#gLegend'), legendX: $('#gLegendX'),
    buy: $('#gBuy'), buyBtn: $('#gBuyBtn'), buyCost: $('#gBuyCost'),
    fab: $('#gFab'), menu: $('#gMenu'), indBtn: $('#gIndBtn'), drawBtn: $('#gDrawBtn'), actBtn: $('#gActBtn'),
    ind: $('#gInd'), emaRow: $('#indEma'), drw: $('#gDraw'), rectRow: $('#drawRect'), set: $('#gSet'), setBtn: $('#gSetBtn'), full: $('#gFull'),
    reveal: $('#gReveal'), revealN: $('#gRevealN'),
    up: $('#pUp'), down: $('#pDown'), toast: $('#gToast'), win: $('#gWin'),
    over: $('#gOver'), overTitle: $('#gOverTitle'), overText: $('#gOverText'), overBtn: $('#gOverBtn'),
    rwResult: $('#rwResult'), rwTitle: $('#rwTitle'), rwDelta: $('#rwDelta'), rwNote: $('#rwNote'),
    rwBalance: $('#rwBalance'), rwFeatured: $('#rwFeatured'), rwList: $('#rwList'), rwNext: $('#rwNext'), rwActions: $('.rw-actions'),
    cursor: $('#tCursor'), cap: $('#tCap'), capT: $('#tCapT'), capN: $('#tCapN'), capX: $('#tCapX'),
    steps: $$('#tSteps li'), tPlay: $('#tPlay'), tReplay: $('#tReplay')
  };
  game.appendChild(ui.cursor);

  // colours of the real game UI (light chart)
  var C = {
    grid: '#E4EBF0', axis: '#9AA8B1', up: '#22D98C', down: '#E0195A', line: '#2EEA9C',
    ema: '#E2336B', sma: '#7B61FF', bb: '#3D8BFD', blue: '#3D7BFF', blueFill: 'rgba(61,123,255,0.11)',
    upLvl: '#2EEA9C', downLvl: '#E0195A', zone: '#F2B705'
  };
  var HIST = 90, FUT = 60;

  /* ---------- data ---------- */
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function gauss(r) { return Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(2 * Math.PI * r()); }
  function addInd(arr) {
    var k = 2 / 101, e = arr[0].c;
    for (var i = 0; i < arr.length; i++) {
      var v = arr[i].c; e = v * k + e * (1 - k); arr[i].ema = e;
      if (i >= 49) { var s = 0; for (var j = i - 49; j <= i; j++) s += arr[j].c; arr[i].sma = s / 50; }
      if (i >= 19) {
        var m = 0, q = 0, n;
        for (n = i - 19; n <= i; n++) m += arr[n].c; m /= 20;
        for (n = i - 19; n <= i; n++) q += (arr[n].c - m) * (arr[n].c - m);
        var sd = Math.sqrt(q / 20); arr[i].bbU = m + 2 * sd; arr[i].bbL = m - 2 * sd; arr[i].bbM = m;
      }
    }
  }
  function walkBack(r, end, n, vol) {
    var out = [], p = end, drift = 0;
    for (var i = 0; i < n; i++) { if (i % 25 === 0) drift = gauss(r) * vol * 0.18; out.push({ c: p }); p = p - drift - gauss(r) * vol; }
    return out.reverse();
  }
  function makeScenario(seed) {
    var r = rng(seed), warm = 160, total = warm + HIST + 220;
    var price = 1.05 + r() * 0.12, vol = 0.00022, drift = 0, c = [];
    for (var i = 0; i < total; i++) {
      if (i % 30 === 0) drift = gauss(r) * 0.00006;
      vol = Math.max(0.0001, Math.min(0.00055, vol * (0.92 + r() * 0.17)));
      var o = price, cl = o + drift + gauss(r) * vol;
      c.push({ o: o, c: cl, h: Math.max(o, cl) + Math.abs(gauss(r)) * vol * 0.6, l: Math.min(o, cl) - Math.abs(gauss(r)) * vol * 0.6 });
      price = cl;
    }
    addInd(c); c = c.slice(warm);
    var hist = c.slice(0, HIST), fut = c.slice(HIST);
    var atr = hist.slice(-20).reduce(function (s, x) { return s + (x.h - x.l); }, 0) / 20;
    var last = hist[HIST - 1].c;
    var upper = last + atr * (3.5 + r() * 3.5), lower = last - atr * (3.5 + r() * 3.5);
    var hit = -1, side = null;
    for (var j = 0; j < fut.length; j++) {
      var uh = fut[j].h >= upper, dl = fut[j].l <= lower;
      if (uh && dl) return null;
      if (uh || dl) { hit = j; side = uh ? 'up' : 'down'; break; }
    }
    if (hit < 4 || hit > FUT - 6) return null;
    var hourly = walkBack(r, last, 260, 0.0009); addInd(hourly);
    var daily = walkBack(r, last, 240, 0.0045); addInd(daily);
    // the swing high of the last ~60 candles = the resistance zone the tutorial marks
    var hiI = HIST - 60, hiV = -1;
    for (var k = HIST - 60; k < HIST - 4; k++) if (hist[k].h > hiV) { hiV = hist[k].h; hiI = k; }
    var d = new Date(Date.UTC(2009 + Math.floor(r() * 15), Math.floor(r() * 12), 1 + Math.floor(r() * 27)));
    return { hist: hist, fut: fut, upper: upper, lower: lower, hit: hit, side: side, hourly: hourly, daily: daily,
      zone: { i0: Math.max(2, hiI - 10), i1: HIST - 3, p0: hiV - atr * 0.9, p1: hiV + atr * 0.5 },
      startMin: Math.floor(r() * 288) * 5, sent: 35 + Math.floor(r() * 31), date: d };
  }
  function newScenario(want) {
    var s = null, seed = (Math.random() * 1e9) | 0;
    while (!s || (want && s.side !== want)) s = makeScenario(seed++);
    return s;
  }

  /* ---------- state ---------- */
  var cfg = null;
  var S = { sc: null, view: 'M', shown: 0, revealed: 0, bought: false, pick: null, playing: false, hitShown: false, round: 0,
    ind: { ema: false, sma: false, bb: false }, opt: { grid: true, axis: true, time: true }, shapes: [], tool: null, preview: null,
    coins: 100, candles: 0, t: 90, t2: 171, timerId: null, mode: 'tutorial', scale: null };

  /* ---------- drawing ---------- */
  var W = 0, H = 0, dpr = 1;
  function resize() { dpr = Math.min(window.devicePixelRatio || 1, 2); W = cv.clientWidth; H = cv.clientHeight; // layout size, unaffected by the panel's 3D tilt
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); draw(); }
  function hhmm(m) { m = ((m % 1440) + 1440) % 1440; var h = Math.floor(m / 60), mm = m % 60; return (h < 10 ? '0' : '') + h + ':' + (mm < 10 ? '0' : '') + mm; }

  function draw() {
    var sc = S.sc; if (!sc || !W) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    var compact = W < 560, padL = 0, padR = compact ? 56 : 70, padT = compact ? 46 : 54, padB = 26;
    var pw = W - padL - padR, ph = H - padT - padB;
    var series, slots, isLine = S.view !== 'M';
    if (S.view === 'M') { series = sc.hist.concat(sc.fut.slice(0, S.shown)); slots = HIST + FUT; }
    else { series = S.view === 'H' ? sc.hourly : sc.daily; slots = Math.round(series.length / 0.8); }
    var step = pw / slots, vis = isLine ? series : sc.hist, lo = sc.lower, hi = sc.upper;
    vis.forEach(function (b) { lo = Math.min(lo, isLine ? b.c : b.l); hi = Math.max(hi, isLine ? b.c : b.h); });
    var pad = (hi - lo) * 0.14; lo -= pad; hi += pad;
    var y = function (v) { return padT + (hi - v) / (hi - lo) * ph; };
    var x = function (i) { return padL + (i + 0.5) * step; };
    S.scale = { lo: lo, hi: hi, padT: padT, ph: ph, padL: padL, pw: pw, step: step };

    // grid + axes
    ctx.lineWidth = 1; ctx.font = (compact ? '9.5px' : '10.5px') + ' ui-monospace, Menlo, monospace';
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    for (var g = 0; g <= 7; g++) {
      var gy = Math.round(padT + ph * g / 7) + 0.5, gv = hi - (hi - lo) * g / 7;
      if (S.opt.grid) { ctx.strokeStyle = C.grid; ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(padL + pw, gy); ctx.stroke(); }
      if (S.opt.axis) { ctx.fillStyle = C.axis; ctx.fillText(gv.toFixed(5), padL + pw + 8, gy); }
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    var every = isLine ? Math.round(slots / (compact ? 4 : 8)) : (compact ? 24 : 12);
    for (var t = 0; t < slots; t += every) {
      var gx = Math.round(x(t)) + 0.5;
      if (S.opt.grid) { ctx.strokeStyle = C.grid; ctx.beginPath(); ctx.moveTo(gx, padT - 20); ctx.lineTo(gx, padT + ph); ctx.stroke(); }
      var lab = S.view === 'M' ? hhmm(sc.startMin + t * 5) : S.view === 'H' ? '−' + Math.max(0, Math.round((series.length - t) / 24)) + ' d' : '−' + Math.max(0, Math.round((series.length - t) / 21)) + ' m';
      if (S.opt.time) { ctx.fillStyle = C.axis; ctx.fillText(lab, gx, H - 8); }
    }
    ctx.strokeStyle = '#D5DEE4'; ctx.beginPath(); ctx.moveTo(padL + pw + 0.5, 0); ctx.lineTo(padL + pw + 0.5, H); ctx.stroke();

    var known = isLine ? series.length : HIST + S.shown, fx = x(known - 1) + step / 2;

    ctx.save(); ctx.beginPath(); ctx.rect(padL, 0, pw, padT + ph); ctx.clip();
    // chosen side: the blue zone from the level to the edge, up to the moment of decision (as in the game)
    if (S.pick && S.view === 'M') {
      var dx = x(HIST - 1) + step / 2, ly = y(S.pick === 'up' ? sc.upper : sc.lower);
      var top = S.pick === 'up' ? 0 : ly, hgt = S.pick === 'up' ? ly : padT + ph - ly;
      ctx.fillStyle = C.blueFill; ctx.fillRect(padL, top, dx - padL, hgt);
      ctx.strokeStyle = C.blue; ctx.lineWidth = 1.2; ctx.strokeRect(padL - 1, top + (S.pick === 'up' ? -1 : 0.5), dx - padL + 1, hgt + 0.5);
    }
    // user drawings (zone, lines)
    S.shapes.concat(S.preview ? [S.preview] : []).forEach(function (sh) {
      if (sh.view !== S.view) return;
      if (sh.t === 'rect') {
        var x0 = x(Math.min(sh.i0, sh.i1)), x1 = x(Math.max(sh.i0, sh.i1)), y0 = y(Math.max(sh.p0, sh.p1)), y1 = y(Math.min(sh.p0, sh.p1));
        ctx.fillStyle = C.blueFill; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
        ctx.strokeStyle = C.blue; ctx.lineWidth = 1.2; ctx.strokeRect(x0 + 0.5, y0 + 0.5, x1 - x0, y1 - y0);
        if (x1 - x0 > 80) { ctx.fillStyle = C.blue; ctx.font = '600 11px Archivo, sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText('Zóna odporu', x1 - 4, y0 - 3); }
      } else if (sh.t === 'h') {
        ctx.strokeStyle = C.blue; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(padL, y(sh.p)); ctx.lineTo(padL + pw, y(sh.p)); ctx.stroke();
      } else if (sh.t === 'v') {
        ctx.strokeStyle = '#22C77E'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x(sh.i), 0); ctx.lineTo(x(sh.i), padT + ph); ctx.stroke();
      } else if (sh.t === 'line') {
        ctx.strokeStyle = C.down; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x(sh.i0), y(sh.p0)); ctx.lineTo(x(sh.i1), y(sh.p1)); ctx.stroke();
        [[sh.i0, sh.p0], [sh.i1, sh.p1]].forEach(function (q) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x(q[0]), y(q[1]), 3.5, 0, 7); ctx.fill(); ctx.stroke(); });
      }
    });
    function path(key, col, width, dash) {
      ctx.strokeStyle = col; ctx.lineWidth = width; ctx.setLineDash(dash || []); ctx.beginPath(); var st = false;
      for (var i = 0; i < series.length; i++) { var v = series[i][key]; if (v == null) continue; st ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v)); st = true; }
      ctx.stroke(); ctx.setLineDash([]);
    }
    if (S.ind.bb) {
      ctx.fillStyle = 'rgba(61,139,253,0.07)'; ctx.beginPath(); var st = -1, i2;
      for (i2 = 0; i2 < series.length; i2++) if (series[i2].bbU != null) { if (st < 0) { st = i2; ctx.moveTo(x(i2), y(series[i2].bbU)); } else ctx.lineTo(x(i2), y(series[i2].bbU)); }
      for (i2 = series.length - 1; i2 >= st && st >= 0; i2--) ctx.lineTo(x(i2), y(series[i2].bbL));
      ctx.fill(); path('bbU', C.bb, 1); path('bbL', C.bb, 1); path('bbM', C.bb, 1, [4, 4]);
    }
    if (S.ind.sma) path('sma', C.sma, 1.4);
    var dim = S.pick && S.view === 'M';
    if (isLine) {
      ctx.beginPath(); for (var k = 0; k < series.length; k++) k ? ctx.lineTo(x(k), y(series[k].c)) : ctx.moveTo(x(k), y(series[k].c));
      ctx.strokeStyle = C.line; ctx.lineWidth = 1.6; ctx.lineJoin = 'round'; ctx.stroke();
    } else {
      var bw = Math.max(1.6, step * 0.6);
      for (var c = 0; c < series.length; c++) {
        var b = series[c], col = b.c >= b.o ? C.up : C.down, xc = Math.round(x(c)) + 0.5;
        ctx.globalAlpha = dim && c < HIST ? 0.3 : 1;
        ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(xc, y(b.h)); ctx.lineTo(xc, y(b.l)); ctx.stroke();
        ctx.fillStyle = col; ctx.fillRect(xc - bw / 2, y(Math.max(b.o, b.c)), bw, Math.max(1.2, Math.abs(y(b.o) - y(b.c))));
      }
      ctx.globalAlpha = 1;
    }
    if (S.ind.ema) {
      path('ema', C.ema, 1.5);
      var le = series[series.length - 1];
      if (le && le.ema != null) { ctx.fillStyle = C.ema; ctx.font = '600 10px Archivo, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('EMA 100', Math.min(x(series.length - 1) + 6, padL + pw - 50), y(le.ema) + 10); }
    }
    ctx.restore();

    // breakout / breakdown levels: dashed from "now" to the tag
    [['up', sc.upper, C.upLvl], ['down', sc.lower, C.downLvl]].forEach(function (L) {
      var ly = Math.round(y(L[1])) + 0.5;
      ctx.strokeStyle = S.pick && S.pick !== L[0] ? '#C9D3D9' : L[2]; ctx.globalAlpha = 0.85; ctx.lineWidth = 1; ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.moveTo(Math.min(fx + 8, padL + pw - 40), ly); ctx.lineTo(padL + pw, ly); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    });
    if (S.hitShown && S.view === 'M') {
      var hx = x(HIST + sc.hit), hy = sc.side === 'up' ? y(sc.upper) : y(sc.lower), hc = sc.side === 'up' ? C.up : C.down;
      ctx.strokeStyle = hc; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(hx, hy, 11, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = hc; ctx.beginPath(); ctx.arc(hx, hy, 4, 0, Math.PI * 2); ctx.fill();
    }
    // HTML tags follow the levels
    ui.up.style.top = y(sc.upper) + 'px'; ui.down.style.top = y(sc.lower) + 'px';
    stage.style.setProperty('--padR', padR + 'px');
  }
  function toData(e) {
    var r = cv.getBoundingClientRect(), sc = S.scale; if (!sc) return null;
    var px = e.clientX - r.left, py = e.clientY - r.top;
    if (px < sc.padL || px > sc.padL + sc.pw || py < 0 || py > sc.padT + sc.ph) return null;
    return { i: (px - sc.padL) / sc.step - 0.5, p: sc.hi - (py - sc.padT) / sc.ph * (sc.hi - sc.lo) };
  }
  function ptOf(i, p) { // data -> coordinates inside #game (for the tutorial cursor)
    var sc = S.scale, c = cv.getBoundingClientRect(), g = game.getBoundingClientRect();
    return { x: c.left - g.left + sc.padL + (i + 0.5) * sc.step, y: c.top - g.top + sc.padT + (sc.hi - p) / (sc.hi - sc.lo) * sc.ph };
  }

  /* ---------- HUD ---------- */
  function bump(el) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
  function renderCoins(b) { if (!ui.coins) return; ui.coins.textContent = fmt(S.coins); if (b) bump(ui.coins); }
  function renderCandles(b) { if (!ui.candles) return; ui.candles.textContent = fmt(S.candles); if (b) bump(ui.candles); }
  function mmss(s) { s = Math.max(0, s); var m = Math.floor(s / 60), r = s % 60; return m + ':' + (r < 10 ? '0' : '') + r; }
  function renderTimer() {
    ui.timer.textContent = S.pick ? (S.pick === 'up' ? '↑' : '↓') : mmss(S.t);
    ui.timer2.textContent = mmss(S.t2);
    ui.g1.classList.toggle('is-low', S.t <= 10 && !S.pick && S.bought);
  }
  function renderClock() { var d = new Date(); ui.clock.textContent = hhmm(d.getUTCHours() * 60 + d.getUTCMinutes()); }
  function setView(v) {
    S.view = v; ui.views.forEach(function (b) { b.setAttribute('aria-checked', b.getAttribute('data-view') === v); });
    ui.tf.textContent = v === 'M' ? '5m' : v === 'H' ? '1h' : '1D'; draw();
  }
  function setInd(k, on) {
    S.ind[k] = on; var cb = ui.ind.querySelector('[data-ind="' + k + '"]'); if (cb) cb.checked = on;
    if (k === 'ema') ui.legend.hidden = !on; draw();
  }
  function setStatus(kind, text) {
    if (!kind) { ui.status.hidden = true; return; }
    ui.status.className = 'app__status is-' + kind; ui.status.textContent = text; ui.status.hidden = false;
  }
  var toastT;
  function toast(t) { ui.toast.textContent = t; ui.toast.classList.add('is-on'); clearTimeout(toastT); toastT = setTimeout(function () { ui.toast.classList.remove('is-on'); }, 3000); }
  function overlay(title, text, btn, fn) {
    ui.overTitle.textContent = title; ui.overText.textContent = text; ui.overBtn.textContent = btn; ui.over.hidden = false;
    ui.overBtn.onclick = function () { ui.over.hidden = true; fn(); }; ui.overBtn.focus({ preventScroll: true });
  }
  function lockControls(locked) {
    ui.up.disabled = ui.down.disabled = locked; ui.reveal.disabled = locked || !!S.revealed; ui.fab.disabled = !!S.playing;
    ui.up.classList.toggle('is-ready', !locked); ui.down.classList.toggle('is-ready', !locked);
  }

  /* ---------- FAB menu + drawers ---------- */
  function closePanels(keep) {
    if (keep !== 'menu') { ui.menu.hidden = true; ui.fab.setAttribute('aria-expanded', 'false'); }
    if (keep !== 'ind') ui.ind.hidden = true;
    if (keep !== 'draw') ui.drw.hidden = true;
    if (keep !== 'set') ui.set.hidden = true;
  }
  function toggleMenu(open) {
    open = open == null ? ui.menu.hidden : open; closePanels(open ? 'menu' : null);
    ui.menu.hidden = !open; ui.fab.setAttribute('aria-expanded', String(open));
  }
  function openDrawer(which) { closePanels(which); ({ ind: ui.ind, draw: ui.drw, set: ui.set })[which].hidden = false; }
  function setTool(t) {
    S.tool = t; stage.classList.toggle('is-drawing', !!t);
    if (t && S.mode === 'play') toast(t === 'h' || t === 'v' ? 'Klikni do grafu tam, kam chceš čáru.' : 'Táhni v grafu myší nebo prstem.');
  }
  ui.fab.addEventListener('click', function (e) { e.stopPropagation(); toggleMenu(); });
  ui.indBtn.addEventListener('click', function () { openDrawer('ind'); });
  ui.drawBtn.addEventListener('click', function () { openDrawer('draw'); });
  ui.actBtn.addEventListener('click', function () {
    closePanels();
    if (!S.bought) { ui.buy.hidden = false; ui.buyBtn.focus({ preventScroll: true }); }
    else if (!S.pick) toast('Kolo běží. Klikni na BREAKOUT, nebo BREAKDOWN.');
  });
  ui.setBtn.addEventListener('click', function () { openDrawer('set'); });
  ui.set.addEventListener('change', function (e) { var k = e.target.getAttribute('data-set'); if (k) { S.opt[k] = e.target.checked; draw(); } });
  ui.full.addEventListener('click', function () {
    var el = game, d = document;
    if (d.fullscreenElement) { d.exitFullscreen(); return; }
    if (el.requestFullscreen) el.requestFullscreen().catch(function () { game.classList.toggle('is-full'); }); else game.classList.toggle('is-full');
  });
  document.addEventListener('fullscreenchange', function () { setTimeout(resize, 60); });
  $$('[data-close]', stage).forEach(function (b) { b.addEventListener('click', function () { closePanels(); }); });
  ui.drw.addEventListener('click', function (e) { var b = e.target.closest('[data-draw]'); if (!b) return; closePanels(); setTool(b.getAttribute('data-draw')); });
  ui.ind.addEventListener('change', function (e) { var k = e.target.getAttribute('data-ind'); if (k) setInd(k, e.target.checked); });
  ui.legendX.addEventListener('click', function () { setInd('ema', false); });
  document.addEventListener('click', function (e) {
    if (S.mode !== 'play') return;
    if ([ui.menu, ui.ind, ui.drw, ui.set, ui.fab].some(function (el) { return el.contains(e.target); })) return;
    closePanels();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closePanels(); setTool(null); S.preview = null; draw(); } });

  // drawing on the chart
  var drag = null;
  cv.addEventListener('pointerdown', function (e) {
    if (!S.tool || S.mode !== 'play') return;
    var pt = toData(e); if (!pt) return;
    if (S.tool === 'h') { S.shapes.push({ t: 'h', p: pt.p, view: S.view }); setTool(null); draw(); return; }
    if (S.tool === 'v') { S.shapes.push({ t: 'v', i: pt.i, view: S.view }); setTool(null); draw(); return; }
    drag = { t: S.tool, i0: pt.i, p0: pt.p, i1: pt.i, p1: pt.p, view: S.view }; S.preview = drag;
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    e.preventDefault();
  });
  cv.addEventListener('pointermove', function (e) { if (!drag) return; var pt = toData(e); if (!pt) return; drag.i1 = pt.i; drag.p1 = pt.p; draw(); });
  cv.addEventListener('pointerup', function () {
    if (!drag) return;
    if (Math.abs(drag.i1 - drag.i0) > 1.5) S.shapes.push(drag);
    drag = null; S.preview = null; setTool(null); draw();
  });

  /* ---------- round flow ---------- */
  function startTimer() {
    clearInterval(S.timerId); S.t = cfg.game.roundSeconds; renderTimer();
    S.timerId = setInterval(function () {
      var r = game.getBoundingClientRect(); if (r.bottom < 0 || r.top > window.innerHeight) return;
      S.t2 = S.t2 > 0 ? S.t2 - 1 : 180;
      if (S.bought && !S.pick && ui.over.hidden && S.mode === 'play') { S.t--; if (S.t <= 0) { toast('Čas vypršel. Nerozhodnout se je taky rozhodnutí. Nový graf.'); startRound(); return; } }
      renderTimer();
    }, 1000);
  }
  function startRound(want) {
    S.round++; S.sc = newScenario(want); S.shown = 0; S.revealed = 0; S.pick = null; S.playing = false; S.hitShown = false; S.bought = false;
    S.shapes = []; S.preview = null; drag = null; setTool(null); closePanels();
    ui.win.hidden = true; ui.up.classList.remove('is-chosen', 'is-lost'); ui.down.classList.remove('is-chosen', 'is-lost');
    ui.revealN.textContent = '1×'; ui.buyCost.textContent = cfg.game.entry; ui.date.hidden = true; setStatus(null);
    ui.sentDn.textContent = S.sc.sent + '%'; ui.sentUp.textContent = (100 - S.sc.sent) + '%'; ui.sentBar.style.width = S.sc.sent + '%';
    stage.classList.add('is-locked'); ui.buy.hidden = false; lockControls(true);
    ui.rwNext.hidden = true; idleRewards();
    setView(S.view); startTimer();
  }
  function buy() {
    if (S.bought) return;
    if (S.coins < cfg.game.entry) {
      overlay('Došly ti coins', 'Zítra se ti peněženka dobije na ' + cfg.game.startCoins + ' coins. V ukázce nečekáme.', 'Dobít', function () { S.coins = cfg.game.startCoins; renderCoins(true); });
      return;
    }
    S.bought = true; S.coins -= cfg.game.entry; renderCoins(true);
    ui.buy.hidden = true; stage.classList.remove('is-locked'); lockControls(false); startTimer();
  }
  function wait(ms) { return new Promise(function (res) { setTimeout(res, reduced ? 0 : ms); }); }
  function choose(side) {
    if (!S.bought || S.pick || S.playing || !ui.over.hidden) return Promise.resolve();
    var round = S.round, entry = cfg.game.entry;
    S.pick = side; S.playing = true; lockControls(true); closePanels(); setTool(null); renderTimer();
    (side === 'up' ? ui.up : ui.down).classList.add('is-chosen');
    (side === 'up' ? ui.down : ui.up).classList.add('is-lost');
    if (S.view !== 'M') setView('M'); else draw();
    setStatus('wait', 'Waiting ' + entry + ' coins');
    var target = S.sc.hit + 1, tail = Math.min(5, FUT - target);
    return wait(1100).then(function () {
      if (round !== S.round) return;
      setStatus('paired', 'Paired ' + entry + ' coins');
      return wait(800);
    }).then(function () {
      if (round !== S.round) return;
      return new Promise(function (resolve) {
        (function step() {
          if (round !== S.round) return resolve();
          S.shown++; if (S.shown >= target) S.hitShown = true; draw();
          if (S.shown < target + tail) { if (reduced) step(); else setTimeout(step, S.shown >= target ? 110 : 45); }
          else { finish(); resolve(); }
        })();
      });
    });
  }
  function finish() {
    S.playing = false; ui.fab.disabled = false;
    var win = S.pick === S.sc.side, where = S.sc.side === 'up' ? 'horní' : 'dolní', per = cfg.game.candlesPerWin;
    setStatus(win ? 'win' : 'loss', win ? 'Win +' + per + ' srdíčko' : 'Loss');
    var d = S.sc.date; ui.date.textContent = d.getUTCDate() + '. ' + (d.getUTCMonth() + 1) + '. ' + d.getUTCFullYear() + ' v ' + hhmm(S.sc.startMin + (HIST + S.sc.hit) * 5); ui.date.hidden = false;
    if (win) { S.candles += per; renderCandles(true); ui.win.hidden = false; }
    if (!win && S.mode === 'play') toast('Cena prorazila ' + where + ' hranici jako první. Tentokrát ne. Příště jo.');
    if (S.mode === 'play') { ui.rwNext.hidden = false; setTimeout(function () { ui.rwNext.focus({ preventScroll: true }); }, 450); }
  }

  /* ---------- rewards panel ---------- */
  function discount(p) { return p.price * cfg.maxDiscountPct / 100; }
  function candlesFor(p) { return Math.ceil(discount(p) / (cfg.candleValue || 50)); }
  function withDisc(p) { return p.price - discount(p); }
  function idleRewards() {
    if (!ui.rwResult) return;
    ui.rwResult.className = 'rw-result is-idle';
    ui.rwTitle.textContent = 'Hraj o skutečné odměny';
    ui.rwDelta.textContent = '+' + cfg.game.candlesPerWin + ' srdíčko za trefu';
    ui.rwNote.textContent = 'Vstup do kola ' + cfg.game.entry + ' coins. Srdíčka tě dovedou ke slevám v shopu.';
    ui.rwActions.hidden = true; renderRewards();
  }
  // the reward you're playing for: pick it, see your progress, watch the candle land in it
  var RW = { target: null, prevPct: 0, prevCandles: 0 };
  function targetProduct() {
    var prods = cfg.products;
    return prods.filter(function (p) { return p.id === RW.target; })[0] || prods.filter(function (p) { return p.featured; })[0] || prods[0];
  }
  function renderRewards(fromWin) {
    if (!ui.rwFeatured) return;
    var prods = cfg.products, feat = targetProduct(), cur = cfg.currency, idx = prods.indexOf(feat);
    RW.target = feat.id;
    var need = candlesFor(feat), pct = Math.min(1, S.candles / need), left = Math.max(0, need - S.candles);
    var art = feat.image ? window.CoC.img(feat.image, feat.name, 'rwx__img') : window.CoC.icon(feat);
    var sim = RW.sim == null ? need : Math.min(RW.sim, need);
    ui.rwFeatured.innerHTML =
      '<div class="rwx__stage" data-tilt>' +
        '<span class="rwx__rays" aria-hidden="true"></span>' +
        '<span class="rwx__tag">Tvůj cíl</span><span class="rwx__idx">' + (idx + 1) + ' / ' + prods.length + '</span>' +
        '<div class="rwx__art">' + art + '</div>' +
        '<button type="button" class="rwx__nav rwx__nav--prev" data-step="-1" aria-label="Předchozí odměna">‹</button>' +
        '<button type="button" class="rwx__nav rwx__nav--next" data-step="1" aria-label="Další odměna">›</button>' +
      '</div>' +
      '<div class="rwx__head"><p class="rw-featured__name">' + feat.name + '</p><p class="rwx__full"><s>' + fmt(feat.price) + ' ' + cur + '</s></p></div>' +
      '<div class="rwx__calc">' +
        '<p class="rwx__pay"><span>Zaplatíš</span><b id="rwPay">' + fmt(feat.price - Math.min(sim * (cfg.candleValue || 50), discount(feat))) + ' ' + cur + '</b></p>' +
        '<label class="rwx__slider"><span class="sr">Kolik srdíček použiješ</span><input type="range" min="0" max="' + need + '" step="1" value="' + sim + '" id="rwSim" style="--v:' + (sim / need * 100).toFixed(1) + '%"></label>' +
        '<p class="rwx__simtxt"><span><i class="heart-ico"></i><b id="rwSimN">' + fmt(sim) + '</b> srdíček</span><span>sleva <b id="rwSimD">' + fmt(Math.min(sim * (cfg.candleValue || 50), discount(feat))) + ' ' + cur + '</b></span></p>' +
      '</div>' +
      '<div class="rwx__mine"><p><span>Tvoje srdíčka</span><span class="rwx__count"><b>' + fmt(S.candles) + '</b> / ' + fmt(need) + '</span></p>' +
        '<div class="rw-prog" role="progressbar" aria-label="Postup k odměně ' + feat.name + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(pct * 100) + '"><i></i><span class="rw-prog__glint"></span></div>' +
        '<p class="rwx__left">' + (left > 0 ? 'Do maximální slevy zbývá <b>' + fmt(left) + '</b> srdíček' : 'Maximální sleva odemčena') + '</p></div>';
    var bar = ui.rwFeatured.querySelector('.rw-prog i'), from = RW.prevPct;
    bar.style.width = Math.max(from * 100, 2.5) + '%';
    requestAnimationFrame(function () { requestAnimationFrame(function () { bar.style.width = Math.max(pct * 100, 2.5) + '%'; }); });
    if (fromWin) { ui.rwFeatured.classList.remove('is-hit'); void ui.rwFeatured.offsetWidth; ui.rwFeatured.classList.add('is-hit'); }
    RW.prevPct = pct;
    ui.rwList.innerHTML = prods.map(function (p) {
      var n = candlesFor(p), on = p === feat;
      return '<li><button type="button" class="rwx__pick' + (on ? ' is-on' : '') + '" data-id="' + p.id + '" aria-pressed="' + on + '" aria-label="' + p.name + ', ' + fmt(n) + ' srdíček na maximální slevu">' +
        window.CoC.icon(p) + '<span class="rwx__pn">' + p.name.replace(/ (Series \d+|\d+ Pro|Pro \d+|Max)$/, '<br>$1') + '</span><span class="pct"><i class="heart-ico"></i>' + fmt(n) + '</span></button></li>';
    }).join('');
  }
  // "what if" slider: drag how many candles you'd spend, see the price drop
  if (ui.rwFeatured) ui.rwFeatured.addEventListener('input', function (e) {
    if (e.target.id !== 'rwSim') return;
    var feat = targetProduct(), v = +e.target.value, cv = cfg.candleValue || 50, d = Math.min(v * cv, discount(feat));
    RW.sim = v; e.target.style.setProperty('--v', (v / +e.target.max * 100).toFixed(1) + '%');
    $('#rwSimN').textContent = fmt(v); $('#rwSimD').textContent = fmt(d) + ' ' + cfg.currency;
    $('#rwPay').textContent = fmt(feat.price - d) + ' ' + cfg.currency;
  });
  function setTarget(id) { RW.target = id; RW.prevPct = 0; RW.sim = null; renderRewards(); }
  if (ui.rwFeatured) ui.rwFeatured.addEventListener('click', function (e) {
    var b = e.target.closest('[data-step]'); if (!b) return;
    var prods = cfg.products, i = prods.indexOf(targetProduct());
    setTarget(prods[(i + +b.getAttribute('data-step') + prods.length) % prods.length].id);
  });
  if (ui.rwList) ui.rwList.addEventListener('click', function (e) { var b = e.target.closest('[data-id]'); if (b) setTarget(b.getAttribute('data-id')); });
  // 3D tilt of the reward
  if (ui.rwFeatured) ui.rwFeatured.addEventListener('pointermove', function (e) {
    var st = e.target.closest('[data-tilt]'); if (!st || reduced) return;
    var r = st.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    st.style.setProperty('--ry', (x * 16).toFixed(1) + 'deg'); st.style.setProperty('--rx', (-y * 12).toFixed(1) + 'deg');
    st.style.setProperty('--gx', ((x + 0.5) * 100).toFixed(0) + '%'); st.style.setProperty('--gy', ((y + 0.5) * 100).toFixed(0) + '%');
  });
  if (ui.rwFeatured) ui.rwFeatured.addEventListener('pointerleave', function () { var st = ui.rwFeatured.querySelector('[data-tilt]'); if (st) { st.style.setProperty('--rx', '0deg'); st.style.setProperty('--ry', '0deg'); } });
  // a won candle flies from the win popup into the progress bar
  function flyCandle() {
    var from = ui.win.querySelector('.heart-ico--xl'), to = ui.rwFeatured && ui.rwFeatured.querySelector('.rw-prog');
    if (!from || !to || reduced || !to.getClientRects().length) return Promise.resolve();
    var g = game.getBoundingClientRect(), a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
    var el = document.createElement('i'); el.className = 'heart-ico heart-ico--xl flycandle'; game.appendChild(el);
    var x0 = a.left - g.left, y0 = a.top - g.top, x1 = b.left - g.left + b.width * Math.max(RW.prevPct, 0.03), y1 = b.top - g.top - 30;
    var anim = el.animate([
      { transform: 'translate(' + x0 + 'px,' + y0 + 'px) scale(1)', opacity: 1 },
      { transform: 'translate(' + ((x0 + x1) / 2) + 'px,' + (Math.min(y0, y1) - 80) + 'px) scale(.9) rotate(-12deg)', opacity: 1, offset: 0.55 },
      { transform: 'translate(' + x1 + 'px,' + y1 + 'px) scale(.45)', opacity: 0.2 }
    ], { duration: 900, easing: 'cubic-bezier(.5,0,.3,1)' });
    return new Promise(function (res) { anim.onfinish = function () { el.remove(); res(); }; });
  }

  /* ---------- free-play controls ---------- */
  ui.views.forEach(function (b, i) {
    b.addEventListener('click', function () { if (!S.playing) setView(b.getAttribute('data-view')); });
    b.addEventListener('keydown', function (e) { var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (!d) return; e.preventDefault(); var n = ui.views[(i + d + ui.views.length) % ui.views.length]; n.focus(); n.click(); });
  });
  function reveal() {
    if (S.revealed || S.pick || !S.bought) return;
    if (S.sc.hit === 0) { toast('Tahle svíčka by prozradila výsledek. Odhalení to nikdy neudělá.'); return; }
    S.revealed = 1; S.shown = 1; ui.reveal.disabled = true; ui.revealN.textContent = '0×';
    if (S.view !== 'M') setView('M'); else draw();
    if (S.mode === 'play') toast('Jedna pětiminutová svíčka navíc. Výsledek pořád neznáš.');
  }
  ui.reveal.addEventListener('click', reveal);
  ui.buyBtn.addEventListener('click', buy);
  ui.up.addEventListener('click', function () { choose('up'); });
  ui.down.addEventListener('click', function () { choose('down'); });
  ui.rwNext.addEventListener('click', function () { startRound(); ui.buyBtn.focus({ preventScroll: true }); });
  ui.tPlay.addEventListener('click', function () { ui.rwNext.hidden = true; });
  ui.win.addEventListener('click', function () { ui.win.hidden = true; });

  /* ---------- tutorial (auto-play with a fake cursor, cards like the in-game tutorial) ---------- */
  var T = { run: 0 }, NSTEPS = 6;
  function sleep(ms, id) { return new Promise(function (res, rej) { setTimeout(function () { if (T.run !== id) rej('stop'); else res(); }, reduced ? Math.min(ms, 200) : ms); }); }
  function cursorTo(target, id, dur) {
    var g = game.getBoundingClientRect(), x, y;
    if (target && target.getBoundingClientRect) { var r = target.getBoundingClientRect(); x = r.left + r.width * 0.5 - g.left; y = r.top + r.height * 0.55 - g.top; }
    else { x = target.x; y = target.y; }
    ui.cursor.style.transitionDuration = (reduced ? 0 : (dur || 700)) + 'ms';
    ui.cursor.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    return sleep((dur || 700) + 80, id);
  }
  function tap(id) { ui.cursor.classList.remove('tap'); void ui.cursor.offsetWidth; ui.cursor.classList.add('tap'); return sleep(260, id); }
  function caption(i, title, text) {
    ui.steps.forEach(function (li, j) { li.classList.toggle('is-on', j === i); li.classList.toggle('is-done', j < i); });
    ui.capT.textContent = title; ui.capN.textContent = (i + 1) + '/' + NSTEPS; ui.capX.textContent = text;
    ui.cap.classList.remove('is-on'); void ui.cap.offsetWidth; ui.cap.classList.add('is-on');
  }
  function click(el, id, dur) { return cursorTo(el, id, dur).then(function () { return tap(id); }); }

  function tutorial() {
    var id = ++T.run; S.mode = 'tutorial'; game.classList.add('is-tutorial'); ui.cursor.classList.add('is-on');
    function loop() {
      S.coins = cfg.game.startCoins; S.candles = 0; renderCoins(); renderCandles();
      S.view = 'M'; setInd('ema', false); setInd('sma', false); setInd('bb', false); closePanels();
      startRound('up');
      var g = game.getBoundingClientRect(), z = S.sc.zone;
      ui.cursor.style.transitionDuration = '0ms'; ui.cursor.style.transform = 'translate(' + (g.width * 0.45) + 'px,' + (g.height * 0.85) + 'px)';
      return sleep(500, id)
        .then(function () { caption(0, 'Kup si graf', 'Skutečný graf z historie. Vstup stojí ' + cfg.game.entry + ' coins, denně jich máš ' + cfg.game.startCoins + ' zdarma.'); return click(ui.buyBtn, id); })
        .then(function () { buy(); return sleep(900, id); })
        .then(function () { caption(1, 'Prohlédni si celou příležitost', 'Denní, hodinový, minutový. Stejný trh, tři úhly.'); return click(ui.views[0], id); })
        .then(function () { setView('D'); return sleep(1300, id); })
        .then(function () { return click(ui.views[1], id, 450); }).then(function () { setView('H'); return sleep(1300, id); })
        .then(function () { return click(ui.views[2], id, 450); }).then(function () { setView('M'); return sleep(700, id); })
        .then(function () { caption(2, 'Zapni si indikátor', 'Zelené tlačítko schovává nástroje. Přidáme EMA 100.'); return click(ui.fab, id); })
        .then(function () { toggleMenu(true); return sleep(450, id); })
        .then(function () { return click(ui.indBtn, id, 450); }).then(function () { openDrawer('ind'); return sleep(500, id); })
        .then(function () { return click(ui.emaRow.querySelector('.sw'), id, 500); })
        .then(function () { setInd('ema', true); return sleep(900, id); }).then(function () { closePanels(); return sleep(300, id); })
        .then(function () { caption(3, 'Označ zónu odporu', 'Obdélníkem zakresli místo, kde se cena už párkrát odrazila. Trh má dobrou paměť.'); return click(ui.fab, id); })
        .then(function () { toggleMenu(true); return sleep(400, id); })
        .then(function () { return click(ui.drawBtn, id, 450); }).then(function () { openDrawer('draw'); return sleep(450, id); })
        .then(function () { return click(ui.rectRow, id, 500); }).then(function () { closePanels(); setTool('rect'); return sleep(300, id); })
        .then(function () { return cursorTo(ptOf(z.i0, z.p1), id, 600); })
        .then(function () { return tap(id); })
        .then(function () {
          var sh = { t: 'rect', i0: z.i0, p0: z.p1, i1: z.i0, p1: z.p1, view: 'M' }, t0 = performance.now(), b = ptOf(z.i1, z.p0);
          S.preview = sh;
          ui.cursor.style.transitionDuration = (reduced ? 0 : 1000) + 'ms'; ui.cursor.style.transform = 'translate(' + b.x + 'px,' + b.y + 'px)';
          return new Promise(function (res) {
            (function f(now) {
              var p = reduced ? 1 : Math.min(1, (now - t0) / 1000), e = 1 - Math.pow(1 - p, 2);
              sh.i1 = z.i0 + (z.i1 - z.i0) * e; sh.p1 = z.p1 + (z.p0 - z.p1) * e; draw();
              if (p < 1 && T.run === id) requestAnimationFrame(f); else { S.preview = null; S.shapes.push(sh); setTool(null); draw(); res(); }
            })(performance.now());
          });
        })
        .then(function () { return sleep(800, id); })
        .then(function () { caption(4, 'Rozhodni se', 'Cena se drží nad EMA a míří k odporu. Tipneme BREAKOUT.'); return click(ui.up, id, 800); })
        .then(function () { return choose('up'); }).then(function () { return sleep(400, id); })
        .then(function () { caption(5, 'Trefa.', 'Tady je tvoje srdíčko. Nasbírej jich dost a vybereš si odměnu.'); return sleep(4600, id); })
        .then(function () { ui.win.hidden = true; ui.cap.classList.remove('is-on'); return sleep(600, id); })
        .then(loop);
    }
    loop().catch(function () { /* stopped */ });
  }
  function stopTutorial() {
    T.run++; S.mode = 'play'; game.classList.remove('is-tutorial'); ui.cursor.classList.remove('is-on'); ui.cap.classList.remove('is-on');
    ui.steps.forEach(function (li) { li.classList.remove('is-on', 'is-done'); });
  }
  function freePlay() {
    stopTutorial(); S.coins = cfg.game.startCoins; S.candles = 0; renderCoins(); renderCandles();
    setInd('ema', true); startRound(); ui.buyBtn.focus({ preventScroll: true });
  }
  ui.tPlay.addEventListener('click', freePlay);
  ui.tReplay.addEventListener('click', function () { stopTutorial(); tutorial(); });
  // a real click anywhere in the game takes over from the tutorial
  game.addEventListener('pointerdown', function (e) { if (S.mode === 'tutorial' && e.isTrusted) { e.preventDefault(); e.stopPropagation(); freePlay(); } }, true);
  game.addEventListener('click', function (e) { if (S.mode === 'tutorial' && e.isTrusted) { e.preventDefault(); e.stopPropagation(); } }, true);

  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(cv); else window.addEventListener('resize', resize);

  var ready = window.CoC && window.CoC.config ? window.CoC.config : Promise.resolve(null);
  ready.then(function (c) {
    cfg = c || { currency: 'Kč', candleValue: 50, maxDiscountPct: 80, game: { startCoins: 100, entry: 10, candlesPerWin: 1, roundSeconds: 90 }, products: [{ name: 'iPhone', price: 34990, icon: 'phone', featured: true }] };
    cfg.game.candlesPerWin = cfg.game.candlesPerWin || 1;
    S.coins = cfg.game.startCoins; renderCoins(); renderCandles(); renderClock(); setInterval(renderClock, 30000);
    startRound('up'); resize();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
    if (reduced || !('IntersectionObserver' in window)) { S.mode = 'play'; return; }
    var io = new IntersectionObserver(function (en) {
      if (en[0].isIntersecting && en[0].intersectionRatio > 0.4) { io.disconnect(); if (S.mode === 'tutorial') tutorial(); }
    }, { threshold: [0, 0.4, 0.6] });
    io.observe(game);
  });
})();
