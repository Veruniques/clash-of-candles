/* Clash of Candles — playable demo round on a simulated chart.
   The real game uses historical market data; this demo generates a random walk
   so the page works offline and nobody can look the answer up. */
(function () {
  'use strict';

  var $ = function (s) { return document.querySelector(s); };
  var cv = $('#chart'); if (!cv) return;
  var ctx = cv.getContext('2d');
  var ui = {
    round: $('#dRound'), score: $('#dScore'), ema: $('#dEma'), reveal: $('#dReveal'),
    up: $('#pUp'), down: $('#pDown'), result: $('#dResult'), verdict: $('#dVerdict'),
    note: $('#dNote'), next: $('#dNext'), cta: $('#dCta'), toast: $('#dToast')
  };
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  var C = {
    bg: '#F3F7FB', grid: '#E2EAF0', axis: '#8DA0AB', up: '#2FCB8A', down: '#E8395A',
    upLine: '#19C27E', downLine: '#F0284A', ema: '#E26D93', ink: '#0C2E3D', fog: 'rgba(12,46,61,0.045)'
  };
  var HIST = 90, FUT_SLOTS = 60, ROUNDS = 3;

  /* ---------- data ---------- */
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function gauss(r) { return Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(2 * Math.PI * r()); }

  function makeScenario(seed) {
    var r = rng(seed);
    var warm = 110, total = warm + HIST + 200;
    var price = 1.08 + r() * 0.08, vol = 0.00022, drift = 0;
    var c = [];
    for (var i = 0; i < total; i++) {
      if (i % 30 === 0) drift = gauss(r) * 0.00006;              // regime changes
      vol = Math.max(0.00010, Math.min(0.00055, vol * (0.92 + r() * 0.17)));
      var o = price, cl = o + drift + gauss(r) * vol;
      var hi = Math.max(o, cl) + Math.abs(gauss(r)) * vol * 0.6;
      var lo = Math.min(o, cl) - Math.abs(gauss(r)) * vol * 0.6;
      c.push({ o: o, h: hi, l: lo, c: cl });
      price = cl;
    }
    // EMA 100 over everything
    var k = 2 / 101, e = c[0].c;
    c.forEach(function (x) { e = x.c * k + e * (1 - k); x.ema = e; });
    c = c.slice(warm);

    var hist = c.slice(0, HIST), fut = c.slice(HIST);
    var atr = hist.slice(-20).reduce(function (s, x) { return s + (x.h - x.l); }, 0) / 20;
    var last = hist[HIST - 1].c;
    var upper = last + atr * (3.5 + r() * 3.5);
    var lower = last - atr * (3.5 + r() * 3.5);

    var hit = -1, side = null;
    for (var j = 0; j < fut.length; j++) {
      var uh = fut[j].h >= upper, dl = fut[j].l <= lower;
      if (uh && dl) return null;                       // ambiguous candle — reroll
      if (uh || dl) { hit = j; side = uh ? 'up' : 'down'; break; }
    }
    if (hit < 4 || hit > FUT_SLOTS - 6) return null;  // too fast or too slow for a demo
    var startMin = Math.floor(r() * 24 * 12) * 5;
    return { hist: hist, fut: fut, upper: upper, lower: lower, hit: hit, side: side, startMin: startMin };
  }
  function newScenario() {
    var s = null, seed = (Math.random() * 1e9) | 0;
    while (!s) s = makeScenario(seed++);
    return s;
  }

  /* ---------- state ---------- */
  var S = { sc: null, shown: 0, revealed: false, pick: null, round: 1, score: 0, ema: true, playing: false, hitShown: false };

  /* ---------- drawing ---------- */
  var W = 0, H = 0, dpr = 1;
  function resize() {
    var r = cv.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    cv.width = W * dpr; cv.height = H * dpr;
    draw();
  }

  function fmtTime(m) {
    m = ((m % 1440) + 1440) % 1440;
    var h = Math.floor(m / 60), mm = m % 60;
    return (h < 10 ? '0' : '') + h + ':' + (mm < 10 ? '0' : '') + mm;
  }

  function draw() {
    var sc = S.sc; if (!sc || !W) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);

    var compact = W < 560;
    var padL = 8, padR = compact ? 64 : 92, padT = 18, padB = 30;
    var pw = W - padL - padR, ph = H - padT - padB;
    var slots = HIST + FUT_SLOTS, step = pw / slots, bw = Math.max(1.5, step * 0.62);

    // y-scale from visible history + both lines (never from the hidden future)
    var lo = Math.min(sc.lower, Math.min.apply(null, sc.hist.map(function (x) { return x.l; })));
    var hi = Math.max(sc.upper, Math.max.apply(null, sc.hist.map(function (x) { return x.h; })));
    var pad = (hi - lo) * 0.14; lo -= pad; hi += pad;
    var y = function (v) { return padT + (hi - v) / (hi - lo) * ph; };
    var x = function (i) { return padL + (i + 0.5) * step; };

    // grid + price axis
    ctx.font = (compact ? '10px' : '11px') + ' ui-monospace, Menlo, monospace';
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    for (var g = 0; g <= 6; g++) {
      var gy = padT + ph * g / 6, gv = hi - (hi - lo) * g / 6;
      ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(padL + pw, gy); ctx.stroke();
      ctx.fillStyle = C.axis; ctx.fillText(gv.toFixed(5), padL + pw + 8, gy);
    }
    // time axis
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    var every = compact ? 30 : 15;
    for (var t = 0; t < slots; t += every) {
      ctx.strokeStyle = C.grid; ctx.beginPath(); ctx.moveTo(x(t), padT); ctx.lineTo(x(t), padT + ph); ctx.stroke();
      ctx.fillStyle = C.axis; ctx.fillText(fmtTime(sc.startMin + t * 5), x(t), H - 10);
    }

    var visible = HIST + S.shown;
    // unknown future zone
    var fx = padL + visible * step;
    if (visible < slots) {
      ctx.fillStyle = C.fog; ctx.fillRect(fx, padT, padL + pw - fx, ph);
      if (!S.pick) {
        ctx.fillStyle = 'rgba(12,46,61,0.22)';
        ctx.font = '900 ' + Math.round(Math.min(ph * 0.35, 120)) + 'px Archivo, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('?', fx + (padL + pw - fx) / 2, padT + ph / 2);
      }
    }

    // EMA
    if (S.ema) {
      ctx.strokeStyle = C.ema; ctx.lineWidth = 2; ctx.beginPath();
      for (var e = 0; e < visible; e++) {
        var bar = e < HIST ? sc.hist[e] : sc.fut[e - HIST];
        e ? ctx.lineTo(x(e), y(bar.ema)) : ctx.moveTo(x(e), y(bar.ema));
      }
      ctx.stroke();
      if (!compact) {
        var le = visible - 1, lb = le < HIST ? sc.hist[le] : sc.fut[le - HIST];
        ctx.fillStyle = C.ema; ctx.font = '700 12px Archivo, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText('EMA 100', x(le) + 8, y(lb.ema) + 12);
      }
    }

    // candles
    ctx.save();
    ctx.beginPath(); ctx.rect(padL, padT, pw, ph); ctx.clip();
    for (var i = 0; i < visible; i++) {
      var b = i < HIST ? sc.hist[i] : sc.fut[i - HIST];
      var up = b.c >= b.o, col = up ? C.up : C.down;
      ctx.globalAlpha = (i >= HIST && S.revealed && !S.pick && i === HIST) ? 0.75 : 1;
      ctx.strokeStyle = col; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x(i), y(b.h)); ctx.lineTo(x(i), y(b.l)); ctx.stroke();
      ctx.fillStyle = col;
      var top = y(Math.max(b.o, b.c)), bh = Math.max(1, Math.abs(y(b.o) - y(b.c)));
      ctx.fillRect(x(i) - bw / 2, top, bw, bh);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // the two levels
    drawLevel(y(sc.upper), C.upLine, 'BREAKOUT', padL, pw, compact);
    drawLevel(y(sc.lower), C.downLine, 'BREAKDOWN', padL, pw, compact);

    // impact marker
    if (S.hitShown) {
      var hi2 = HIST + sc.hit, hb = sc.fut[sc.hit];
      var hy = sc.side === 'up' ? y(sc.upper) : y(sc.lower);
      ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(x(hi2), hy, 11, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = sc.side === 'up' ? C.upLine : C.downLine;
      ctx.beginPath(); ctx.arc(x(hi2), hy, 5, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawLevel(ly, col, label, padL, pw, compact) {
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash([7, 6]);
    ctx.beginPath(); ctx.moveTo(padL, ly); ctx.lineTo(padL + pw, ly); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = '800 ' + (compact ? 10 : 12) + 'px Archivo, sans-serif';
    var tw = ctx.measureText(label).width, bx = padL + pw + 2, bwid = Math.max(tw + 12, W - bx - 2);
    ctx.fillStyle = col;
    roundRect(bx, ly - 12, bwid, 24, 6); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, bx + bwid / 2, ly + 1);
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  /* ---------- flow ---------- */
  var toastT;
  function toast(t) {
    ui.toast.textContent = t; ui.toast.classList.add('is-on');
    clearTimeout(toastT); toastT = setTimeout(function () { ui.toast.classList.remove('is-on'); }, 3200);
  }

  function startRound() {
    S.sc = newScenario(); S.shown = 0; S.revealed = false; S.pick = null; S.playing = false; S.hitShown = false;
    ui.round.textContent = 'Kolo ' + S.round + ' ze ' + ROUNDS;
    ui.result.hidden = true; ui.cta.hidden = true;
    ui.up.disabled = ui.down.disabled = false;
    ui.up.classList.remove('is-chosen'); ui.down.classList.remove('is-chosen');
    ui.reveal.disabled = false; ui.reveal.textContent = 'Odhalit svíčku · 1×';
    draw();
  }

  function choose(side) {
    if (S.pick || S.playing) return;
    S.pick = side; S.playing = true;
    ui.up.disabled = ui.down.disabled = true; ui.reveal.disabled = true;
    (side === 'up' ? ui.up : ui.down).classList.add('is-chosen');
    var target = S.sc.hit + 1, tail = Math.min(4, FUT_SLOTS - target);
    var stepMs = reduced ? 0 : 55;
    function tickOne() {
      S.shown++;
      if (S.shown >= target) S.hitShown = true;
      draw();
      if (S.shown < target + tail) { stepMs ? setTimeout(tickOne, S.shown >= target ? 120 : stepMs) : tickOne(); }
      else finish();
    }
    tickOne();
  }

  function finish() {
    S.playing = false;
    var win = S.pick === S.sc.side;
    if (win) S.score++;
    ui.score.textContent = S.score;
    var where = S.sc.side === 'up' ? 'horní' : 'dolní';
    var last = S.round >= ROUNDS;
    ui.verdict.className = 'arena__verdict ' + (win ? 'is-win' : 'is-loss');
    if (!last) {
      ui.verdict.textContent = win ? 'Trefa. Patříš mezi těch 10\u00A0%.' : 'Vedle. Vítej mezi 90\u00A0%.';
      ui.note.textContent = win
        ? 'Cena prorazila ' + where + ' čáru jako první. V aréně by ti teď cinklo +20 coins.'
        : 'Cena šla na ' + where + ' čáru. V aréně by ti právě zhasl jeden knot.';
      ui.next.textContent = 'Další graf';
      ui.cta.hidden = true;
    } else {
      var lines = [
        '0 ze 3. Statisticky skoro nemožné. Tím spíš to zkus naostro.',
        '1 ze 3. Graf vede. Zatím.',
        '2 ze 3. Dobrý instinkt. V aréně se z toho dělá rank.',
        '3 ze 3. Talent, nebo štěstí? Aréna to pozná.'
      ];
      ui.verdict.textContent = lines[S.score];
      ui.note.textContent = 'Ve hře hraješ na skutečných historických grafech, proti skutečným lidem a o coins, které se mění ve věci.';
      ui.next.textContent = 'Hrát znovu';
      ui.cta.hidden = false;
    }
    ui.result.hidden = false;
  }

  ui.up.addEventListener('click', function () { choose('up'); });
  ui.down.addEventListener('click', function () { choose('down'); });
  ui.ema.addEventListener('click', function () {
    S.ema = !S.ema; ui.ema.setAttribute('aria-pressed', S.ema); draw();
  });
  ui.reveal.addEventListener('click', function () {
    if (S.revealed || S.pick) return;
    if (S.sc.hit === 0) { toast('Tahle svíčka by prozradila výsledek. Odhalení to nikdy neudělá.'); return; }
    S.revealed = true; S.shown = 1; ui.reveal.disabled = true; ui.reveal.textContent = 'Odhaleno';
    toast('Jedna svíčka navíc. Výsledek pořád neznáš.');
    draw();
  });
  ui.next.addEventListener('click', function () {
    if (S.round >= ROUNDS) { S.round = 1; S.score = 0; ui.score.textContent = 0; }
    else S.round++;
    startRound();
    ui.up.focus({ preventScroll: true });
  });

  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(cv);
  else window.addEventListener('resize', resize);
  startRound();
  resize();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
})();
