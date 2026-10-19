/* Clash of Candles — playable demo round (simulated chart) + rewards drawer.
   The real game uses historical market data; the demo generates random walks so it
   works offline and nobody can look the answer up. Economy + products come from
   window.CoC.config (assets/data/rewards.json). */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var game = $('#game'); if (!game) return;
  var cv = $('#chart'), ctx = cv.getContext('2d');
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fmt = function (n) { return window.CoC && window.CoC.fmt ? window.CoC.fmt(n) : String(Math.round(n)); };

  var ui = {
    views: Array.prototype.slice.call(document.querySelectorAll('.views__b')),
    timer: $('#gTimer'), timerChip: $('.hud__timer'), coins: $('#gCoins'), lives: $('#gLives'),
    sentDn: $('#gSentDn'), sentUp: $('#gSentUp'), sentBar: $('#gSentBar'), tf: $('#gTf'),
    indBtn: $('#gIndBtn'), ind: $('#gInd'), reveal: $('#gReveal'), revealN: $('#gRevealN'),
    up: $('#pUp'), down: $('#pDown'), toast: $('#gToast'),
    over: $('#gOver'), overTitle: $('#gOverTitle'), overText: $('#gOverText'), overBtn: $('#gOverBtn'),
    rwResult: $('#rwResult'), rwTitle: $('#rwTitle'), rwDelta: $('#rwDelta'), rwNote: $('#rwNote'),
    rwBalance: $('#rwBalance'), rwFeatured: $('#rwFeatured'), rwList: $('#rwList'), rwNext: $('#rwNext')
  };

  var C = {
    grid: 'rgba(255,255,255,0.055)', axis: '#5F8796', up: '#2EE29A', down: '#FF4767',
    line: '#2EE29A', upLine: '#4FF2B1', downLine: '#FF6A86',
    ema: '#E2588A', sma: '#9A82FF', bb: '#4EA6F5', fog: 'rgba(255,255,255,0.035)'
  };
  var HIST = 90, FUT = 60;

  /* ---------- data ---------- */
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function gauss(r) { return Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(2 * Math.PI * r()); }
  function addInd(arr, key) {
    var k = 2 / 101, e = arr[0][key];
    for (var i = 0; i < arr.length; i++) {
      var v = arr[i][key]; e = v * k + e * (1 - k); arr[i].ema = e;
      if (i >= 49) { var s = 0; for (var j = i - 49; j <= i; j++) s += arr[j][key]; arr[i].sma = s / 50; }
      if (i >= 19) {
        var m = 0, q = 0, n;
        for (n = i - 19; n <= i; n++) m += arr[n][key]; m /= 20;
        for (n = i - 19; n <= i; n++) q += (arr[n][key] - m) * (arr[n][key] - m);
        var sd = Math.sqrt(q / 20); arr[i].bbU = m + 2 * sd; arr[i].bbL = m - 2 * sd; arr[i].bbM = m;
      }
    }
  }
  function walkBack(r, end, n, vol) {
    var out = [], p = end, drift = gauss(r) * vol * 0.15;
    for (var i = 0; i < n; i++) {
      if (i % 25 === 0) drift = gauss(r) * vol * 0.18;
      out.push({ c: p }); p = p - drift - gauss(r) * vol;
    }
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
    addInd(c, 'c'); c = c.slice(warm);
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
    var hourly = walkBack(r, last, 260, 0.0009); addInd(hourly, 'c');
    var daily = walkBack(r, last, 240, 0.0045); addInd(daily, 'c');
    return { hist: hist, fut: fut, upper: upper, lower: lower, hit: hit, side: side, hourly: hourly, daily: daily,
      startMin: Math.floor(r() * 288) * 5, sent: 35 + Math.floor(r() * 31) };
  }
  function newScenario() { var s = null, seed = (Math.random() * 1e9) | 0; while (!s) s = makeScenario(seed++); return s; }

  /* ---------- state ---------- */
  var cfg = null;
  var S = { sc: null, view: 'M', shown: 0, revealed: 0, pick: null, playing: false, hitShown: false,
    ind: { ema: true, sma: false, bb: false }, coins: 100, lives: 10, t: 90, timerId: null };

  /* ---------- drawing ---------- */
  var W = 0, H = 0, dpr = 1;
  function resize() {
    var r = cv.getBoundingClientRect(); dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); draw();
  }
  function hhmm(m) { m = ((m % 1440) + 1440) % 1440; var h = Math.floor(m / 60), mm = m % 60; return (h < 10 ? '0' : '') + h + ':' + (mm < 10 ? '0' : '') + mm; }
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  function draw() {
    var sc = S.sc; if (!sc || !W) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    var compact = W < 560, padL = 8, padR = compact ? 74 : 98, padT = 40, padB = 84;
    var pw = W - padL - padR, ph = H - padT - padB;
    var series, slots, isLine = S.view !== 'M';
    if (S.view === 'M') { series = sc.hist.concat(sc.fut.slice(0, S.shown)); slots = HIST + FUT; }
    else { series = S.view === 'H' ? sc.hourly : sc.daily; slots = Math.round(series.length / 0.78); }
    var step = pw / slots;
    var vis = isLine ? series : sc.hist;
    var lo = sc.lower, hi = sc.upper;
    vis.forEach(function (b) { lo = Math.min(lo, isLine ? b.c : b.l); hi = Math.max(hi, isLine ? b.c : b.h); });
    var pad = (hi - lo) * 0.12; lo -= pad; hi += pad;
    var y = function (v) { return padT + (hi - v) / (hi - lo) * ph; };
    var x = function (i) { return padL + (i + 0.5) * step; };

    // grid + axes
    ctx.font = (compact ? '10px' : '11px') + ' ui-monospace, Menlo, monospace';
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    for (var g = 0; g <= 6; g++) {
      var gy = padT + ph * g / 6, gv = hi - (hi - lo) * g / 6;
      ctx.strokeStyle = C.grid; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(padL + pw, gy); ctx.stroke();
      ctx.fillStyle = C.axis; ctx.fillText(gv.toFixed(5), padL + pw + 8, gy);
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    var every = isLine ? Math.round(slots / (compact ? 4 : 7)) : (compact ? 30 : 15);
    for (var t = 0; t < slots; t += every) {
      ctx.strokeStyle = C.grid; ctx.beginPath(); ctx.moveTo(x(t), padT); ctx.lineTo(x(t), padT + ph); ctx.stroke();
      var lab = S.view === 'M' ? hhmm(sc.startMin + t * 5) : S.view === 'H' ? '−' + Math.max(0, Math.round((series.length - t) / 24)) + ' d' : '−' + Math.max(0, Math.round((series.length - t) / 21)) + ' měs.';
      ctx.fillStyle = C.axis; ctx.fillText(lab, x(t), padT + ph + 16);
    }

    // unknown future zone
    var known = isLine ? series.length : HIST + S.shown;
    var fx = padL + known * step;
    if (known < slots) {
      ctx.fillStyle = C.fog; ctx.fillRect(fx, padT, padL + pw - fx, ph);
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.moveTo(fx, padT); ctx.lineTo(fx, padT + ph); ctx.stroke(); ctx.setLineDash([]);
      if (!S.pick) {
        ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.font = '900 ' + Math.round(Math.min(ph * 0.4, 130)) + 'px Archivo, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', fx + (padL + pw - fx) / 2, padT + ph / 2);
      }
    }

    ctx.save(); ctx.beginPath(); ctx.rect(padL, padT, pw, ph); ctx.clip();
    // indicators
    function path(key, col, width, dash) {
      ctx.strokeStyle = col; ctx.lineWidth = width; ctx.setLineDash(dash || []); ctx.beginPath(); var started = false;
      for (var i = 0; i < series.length; i++) { var v = series[i][key]; if (v == null) continue; started ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v)); started = true; }
      ctx.stroke(); ctx.setLineDash([]);
    }
    if (S.ind.bb) {
      ctx.fillStyle = 'rgba(78,166,245,0.08)'; ctx.beginPath(); var st = -1, i2;
      for (i2 = 0; i2 < series.length; i2++) if (series[i2].bbU != null) { if (st < 0) { st = i2; ctx.moveTo(x(i2), y(series[i2].bbU)); } else ctx.lineTo(x(i2), y(series[i2].bbU)); }
      for (i2 = series.length - 1; i2 >= st && st >= 0; i2--) ctx.lineTo(x(i2), y(series[i2].bbL));
      ctx.fill(); path('bbU', C.bb, 1.2); path('bbL', C.bb, 1.2); path('bbM', C.bb, 1, [4, 4]);
    }
    if (S.ind.sma) path('sma', C.sma, 1.8);
    if (S.ind.ema) path('ema', C.ema, 2);

    if (isLine) {
      var grd = ctx.createLinearGradient(0, padT, 0, padT + ph);
      grd.addColorStop(0, 'rgba(46,226,154,0.28)'); grd.addColorStop(1, 'rgba(46,226,154,0)');
      ctx.beginPath(); for (var k = 0; k < series.length; k++) k ? ctx.lineTo(x(k), y(series[k].c)) : ctx.moveTo(x(k), y(series[k].c));
      ctx.lineTo(x(series.length - 1), padT + ph); ctx.lineTo(x(0), padT + ph); ctx.closePath(); ctx.fillStyle = grd; ctx.fill();
      ctx.beginPath(); for (k = 0; k < series.length; k++) k ? ctx.lineTo(x(k), y(series[k].c)) : ctx.moveTo(x(k), y(series[k].c));
      ctx.strokeStyle = C.line; ctx.lineWidth = 1.8; ctx.shadowColor = 'rgba(46,226,154,0.6)'; ctx.shadowBlur = 8; ctx.stroke(); ctx.shadowBlur = 0;
    } else {
      var bw = Math.max(1.6, step * 0.62);
      for (var c = 0; c < series.length; c++) {
        var b = series[c], up = b.c >= b.o, col = up ? C.up : C.down;
        ctx.globalAlpha = (c >= HIST && !S.pick) ? 0.8 : 1;
        ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x(c), y(b.h)); ctx.lineTo(x(c), y(b.l)); ctx.stroke();
        ctx.fillStyle = col; var top = y(Math.max(b.o, b.c)), bh = Math.max(1.2, Math.abs(y(b.o) - y(b.c)));
        ctx.fillRect(x(c) - bw / 2, top, bw, bh);
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    level(y(sc.upper), C.upLine, 'BREAKOUT', padL, pw, compact);
    level(y(sc.lower), C.downLine, 'BREAKDOWN', padL, pw, compact);

    if (S.hitShown && S.view === 'M') {
      var hx = x(HIST + sc.hit), hy = sc.side === 'up' ? y(sc.upper) : y(sc.lower), hc = sc.side === 'up' ? C.upLine : C.downLine;
      ctx.shadowColor = hc; ctx.shadowBlur = 18; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(hx, hy, 12, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0;
      ctx.fillStyle = hc; ctx.beginPath(); ctx.arc(hx, hy, 5, 0, Math.PI * 2); ctx.fill();
    }
  }
  function level(ly, col, label, padL, pw, compact) {
    ctx.save();
    ctx.shadowColor = col; ctx.shadowBlur = 10; ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.setLineDash([8, 6]);
    ctx.beginPath(); ctx.moveTo(padL, ly); ctx.lineTo(padL + pw, ly); ctx.stroke(); ctx.setLineDash([]);
    ctx.font = '800 ' + (compact ? 10 : 11) + 'px Archivo, sans-serif';
    var bx = padL + pw + 4, bw = W - bx - 4;
    ctx.fillStyle = col; rr(bx, ly - 12, bw, 24, 8); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#04202D'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, bx + bw / 2, ly + 1);
    ctx.restore();
  }

  /* ---------- HUD ---------- */
  function renderLives() {
    var html = ''; for (var i = 0; i < cfg.game.lives; i++) html += '<i' + (i >= S.lives ? ' class="out"' : '') + '></i>';
    ui.lives.innerHTML = html; ui.lives.setAttribute('aria-label', 'Životy: ' + S.lives + ' z ' + cfg.game.lives);
  }
  function renderCoins(bump) {
    ui.coins.textContent = fmt(S.coins); ui.rwBalance.textContent = fmt(S.coins);
    if (bump) { ui.coins.classList.remove('bump'); void ui.coins.offsetWidth; ui.coins.classList.add('bump'); }
  }
  function renderTimer() {
    var m = Math.floor(S.t / 60), s = S.t % 60;
    ui.timer.textContent = m + ':' + (s < 10 ? '0' : '') + s;
    ui.timerChip.classList.toggle('is-low', S.t <= 10 && !S.pick);
  }
  function setView(v) {
    S.view = v;
    ui.views.forEach(function (b) { b.setAttribute('aria-checked', b.getAttribute('data-view') === v); });
    ui.tf.textContent = (v === 'M' ? '5m' : v === 'H' ? '1h' : '1D') + ' · instrument skrytý do výsledku';
    draw();
  }
  var toastT;
  function toast(t) { ui.toast.textContent = t; ui.toast.classList.add('is-on'); clearTimeout(toastT); toastT = setTimeout(function () { ui.toast.classList.remove('is-on'); }, 3000); }
  function overlay(title, text, btn, fn) {
    ui.overTitle.textContent = title; ui.overText.textContent = text; ui.overBtn.textContent = btn;
    ui.over.hidden = false; ui.overBtn.onclick = function () { ui.over.hidden = true; fn(); };
    ui.overBtn.focus({ preventScroll: true });
  }

  /* ---------- round flow ---------- */
  function startTimer() {
    clearInterval(S.timerId); S.t = cfg.game.roundSeconds; renderTimer();
    S.timerId = setInterval(function () {
      if (S.pick || !ui.over.hidden) return;
      // only count down while the game is on screen
      var r = game.getBoundingClientRect(); if (r.bottom < 0 || r.top > window.innerHeight) return;
      S.t--; renderTimer();
      if (S.t <= 0) { toast('Čas vypršel. Nový graf, nová šance.'); startRound(); }
    }, 1000);
  }
  function startRound() {
    S.sc = newScenario(); S.shown = 0; S.revealed = 0; S.pick = null; S.playing = false; S.hitShown = false;
    game.classList.remove('is-open');
    ui.up.disabled = ui.down.disabled = false; ui.up.classList.remove('is-chosen'); ui.down.classList.remove('is-chosen');
    ui.reveal.disabled = false; ui.revealN.textContent = '1';
    ui.sentDn.textContent = S.sc.sent + ' %'; ui.sentUp.textContent = (100 - S.sc.sent) + ' %'; ui.sentBar.style.width = S.sc.sent + '%';
    setView(S.view); startTimer();
  }
  function choose(side) {
    if (S.pick || S.playing || !ui.over.hidden) return;
    if (S.coins < cfg.game.entry) {
      overlay('Došly ti coins', 'Každý den se ti peněženka doplní na ' + cfg.game.startCoins + ' coins. V ukázce to zvládneme hned.', 'Denní doplnění', function () { S.coins = cfg.game.startCoins; renderCoins(true); });
      return;
    }
    S.pick = side; S.playing = true; S.coins -= cfg.game.entry; renderCoins(true); renderTimer();
    ui.up.disabled = ui.down.disabled = true; ui.reveal.disabled = true; closeInd();
    (side === 'up' ? ui.up : ui.down).classList.add('is-chosen');
    if (S.view !== 'M') setView('M');
    var target = S.sc.hit + 1, tail = Math.min(4, FUT - target);
    (function step() {
      S.shown++; if (S.shown >= target) S.hitShown = true; draw();
      if (S.shown < target + tail) { if (reduced) step(); else setTimeout(step, S.shown >= target ? 120 : 45); }
      else finish();
    })();
  }
  function finish() {
    S.playing = false;
    var win = S.pick === S.sc.side, where = S.sc.side === 'up' ? 'horní' : 'dolní';
    if (win) { S.coins += cfg.game.win; } else { S.lives = Math.max(0, S.lives - 1); }
    renderCoins(win); renderLives();
    ui.rwResult.className = 'rw-result ' + (win ? 'is-win' : 'is-loss');
    ui.rwTitle.textContent = win ? 'Trefa. Graf jsi přečetl.' : 'Tentokrát ne.';
    ui.rwDelta.textContent = win ? '+' + fmt(cfg.game.win) + ' coins' : '−1 život';
    ui.rwNote.textContent = win
      ? 'Cena prorazila ' + where + ' hranici jako první. Vstup ' + cfg.game.entry + ', výhra ' + cfg.game.win + ' coins.'
      : 'Cena prorazila ' + where + ' hranici jako první. Zbývá ti ' + S.lives + ' z ' + cfg.game.lives + ' životů.';
    renderRewards(win);
    game.classList.add('is-open');
    setTimeout(function () { ui.rwNext.focus({ preventScroll: true }); }, 450);
    if (S.lives <= 0) {
      setTimeout(function () {
        overlay('Konec hry', 'Deset chyb a aktuální hra končí. Ve hře se můžeš vrátit placeným návratem do arény na následující čtyři hodiny.', 'Návrat do arény', function () { S.lives = cfg.game.lives; renderLives(); });
      }, 900);
    }
  }

  /* ---------- rewards drawer ---------- */
  function discount(p) { return p.price * cfg.maxDiscountPct / 100; }
  function coinsFor(p) { return discount(p) / (cfg.coinValue || 1); }
  function renderRewards(win) {
    var prods = cfg.products.slice(), feat = prods.filter(function (p) { return p.featured; })[0] || prods[0];
    var need = coinsFor(feat), pct = Math.min(1, S.coins / need), left = Math.max(0, need - S.coins);
    var gained = win ? cfg.game.win * (cfg.coinValue || 1) : 0;
    ui.rwFeatured.innerHTML =
      '<div class="rw-featured__top">' + window.CoC.icon(feat) +
      '<div><p class="rw-featured__name">' + feat.name + '</p><p class="rw-featured__tag">' + (feat.tagline || '') + '</p></div></div>' +
      '<div class="rw-featured__meta"><span>Sleva až <b>' + fmt(discount(feat)) + ' ' + cfg.currency + '</b></span><span>' + (pct * 100).toLocaleString('cs-CZ', { maximumFractionDigits: pct < 0.1 ? 1 : 0 }) + '&nbsp;%</span></div>' +
      '<div class="rw-prog" role="progressbar" aria-label="Postup ke slevě na ' + feat.name + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(pct * 100) + '"><i></i></div>' +
      '<div class="rw-featured__meta"><span>' + (left > 0 ? 'Zbývá ' + fmt(left) + ' coins' : 'Maximální sleva odemčena') + '</span>' +
      (gained ? '<span>Tahle výhra: −' + fmt(gained) + ' ' + cfg.currency + '</span>' : '') + '</div>';
    var bar = ui.rwFeatured.querySelector('.rw-prog i');
    requestAnimationFrame(function () { requestAnimationFrame(function () { bar.style.width = Math.max(pct * 100, 2.5) + '%'; }); });
    ui.rwList.innerHTML = prods.filter(function (p) { return p !== feat; }).map(function (p) {
      var q = Math.min(1, S.coins / coinsFor(p));
      return '<li>' + window.CoC.icon(p) + '<div><b>' + p.name + '</b><small>sleva až ' + fmt(discount(p)) + ' ' + cfg.currency + '</small></div><span class="pct">' + Math.round(q * 100) + ' %</span></li>';
    }).join('');
  }

  /* ---------- controls ---------- */
  function closeInd() { ui.ind.hidden = true; ui.indBtn.setAttribute('aria-expanded', 'false'); }
  ui.indBtn.addEventListener('click', function (e) {
    e.stopPropagation(); var open = ui.ind.hidden; ui.ind.hidden = !open; ui.indBtn.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', function (e) { if (!ui.ind.hidden && !ui.ind.contains(e.target)) closeInd(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !ui.ind.hidden) { closeInd(); ui.indBtn.focus(); } });
  ui.ind.addEventListener('change', function (e) { var k = e.target.getAttribute('data-ind'); if (k) { S.ind[k] = e.target.checked; draw(); } });
  ui.views.forEach(function (b, i) {
    b.addEventListener('click', function () { if (!S.playing) setView(b.getAttribute('data-view')); });
    b.addEventListener('keydown', function (e) {
      var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (!d) return;
      e.preventDefault(); var n = ui.views[(i + d + ui.views.length) % ui.views.length]; n.focus(); n.click();
    });
  });
  ui.reveal.addEventListener('click', function () {
    if (S.revealed || S.pick) return;
    if (S.sc.hit === 0) { toast('Tahle svíčka by prozradila výsledek. Odhalení to nikdy neudělá.'); return; }
    S.revealed = 1; S.shown = 1; ui.reveal.disabled = true; ui.revealN.textContent = '0';
    if (S.view !== 'M') setView('M'); else draw();
    toast('Jedna pětiminutová svíčka navíc. Výsledek pořád neznáš.');
  });
  ui.up.addEventListener('click', function () { choose('up'); });
  ui.down.addEventListener('click', function () { choose('down'); });
  ui.rwNext.addEventListener('click', function () { startRound(); ui.up.focus({ preventScroll: true }); });

  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(cv); else window.addEventListener('resize', resize);

  var ready = window.CoC && window.CoC.config ? window.CoC.config : Promise.resolve(null);
  ready.then(function (c) {
    cfg = c || { currency: 'Kč', coinValue: 1, maxDiscountPct: 80, game: { startCoins: 100, entry: 10, win: 20, lives: 10, roundSeconds: 90 }, products: [{ name: 'iPhone', price: 24990, icon: 'phone', featured: true }] };
    S.coins = cfg.game.startCoins; S.lives = cfg.game.lives;
    renderCoins(); renderLives(); startRound(); resize();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
  });
})();
