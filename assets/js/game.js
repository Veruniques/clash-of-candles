/* Clash of Candles — demo game: auto-playing tutorial + free play.
   Simulated chart (random walk) so it works offline and nobody can look the answer up.
   Economy + products come from window.CoC.config (assets/data/rewards.json):
   coins pay the entry ("fuel"), each win lights one svíčka, svíčky lead to rewards. */
(function () {
  'use strict';
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var game = $('#game'); if (!game) return;
  var cv = $('#chart'), ctx = cv.getContext('2d'), stage = $('#gStage');
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fmt = function (n) { return window.CoC && window.CoC.fmt ? window.CoC.fmt(n) : String(Math.round(n)); };

  var ui = {
    views: Array.prototype.slice.call(document.querySelectorAll('.views__b')),
    timer: $('#gTimer'), timerChip: $('.hud__timer'), coins: $('#gCoins'), candles: $('#gCandles'),
    sentDn: $('#gSentDn'), sentUp: $('#gSentUp'), sentBar: $('#gSentBar'), tf: $('#gTf'),
    buy: $('#gBuy'), buyBtn: $('#gBuyBtn'), buyCost: $('#gBuyCost'),
    indBtn: $('#gIndBtn'), ind: $('#gInd'), emaRow: $('#indEma'), lineBtn: $('#gLineBtn'),
    reveal: $('#gReveal'), revealN: $('#gRevealN'),
    up: $('#pUp'), down: $('#pDown'), toast: $('#gToast'), win: $('#gWin'),
    over: $('#gOver'), overTitle: $('#gOverTitle'), overText: $('#gOverText'), overBtn: $('#gOverBtn'),
    rwResult: $('#rwResult'), rwTitle: $('#rwTitle'), rwDelta: $('#rwDelta'), rwNote: $('#rwNote'),
    rwBalance: $('#rwBalance'), rwFeatured: $('#rwFeatured'), rwList: $('#rwList'), rwNext: $('#rwNext'), rwActions: $('.rw-actions'),
    cursor: $('#tCursor'), cap: $('#tCap'), steps: Array.prototype.slice.call(document.querySelectorAll('#tSteps li')),
    tPlay: $('#tPlay'), tReplay: $('#tReplay')
  };
  game.appendChild(ui.cursor);

  var C = {
    grid: 'rgba(255,255,255,0.055)', axis: '#5F8796', up: '#2EE29A', down: '#FF4767', line: '#2EE29A',
    upLine: '#4FF2B1', downLine: '#FF6A86', ema: '#E2588A', sma: '#9A82FF', bb: '#4EA6F5', user: '#FFFFFF', fog: 'rgba(255,255,255,0.035)'
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
    var res = last + (upper - last) * 0.45;
    return { hist: hist, fut: fut, upper: upper, lower: lower, hit: hit, side: side, hourly: hourly, daily: daily, res: res,
      startMin: Math.floor(r() * 288) * 5, sent: 35 + Math.floor(r() * 31) };
  }
  function newScenario(want) {
    var s = null, seed = (Math.random() * 1e9) | 0;
    while (!s || (want && s.side !== want)) s = makeScenario(seed++);
    return s;
  }

  /* ---------- state ---------- */
  var cfg = null;
  var S = { sc: null, view: 'M', shown: 0, revealed: 0, bought: false, pick: null, playing: false, hitShown: false,
    ind: { ema: false, sma: false, bb: false }, lines: [], drawing: false, drawAnim: null,
    coins: 100, candles: 0, t: 90, timerId: null, mode: 'tutorial', scale: null };

  /* ---------- drawing ---------- */
  var W = 0, H = 0, dpr = 1;
  function resize() { var r = cv.getBoundingClientRect(); dpr = Math.min(window.devicePixelRatio || 1, 2); W = r.width; H = r.height; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); draw(); }
  function hhmm(m) { m = ((m % 1440) + 1440) % 1440; var h = Math.floor(m / 60), mm = m % 60; return (h < 10 ? '0' : '') + h + ':' + (mm < 10 ? '0' : '') + mm; }
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  function draw() {
    var sc = S.sc; if (!sc || !W) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    var compact = W < 560, padL = 8, padR = compact ? 74 : 98, padT = 40, padB = 84;
    var pw = W - padL - padR, ph = H - padT - padB;
    var series, slots, isLine = S.view !== 'M';
    if (S.view === 'M') { series = sc.hist.concat(sc.fut.slice(0, S.shown)); slots = HIST + FUT; }
    else { series = S.view === 'H' ? sc.hourly : sc.daily; slots = Math.round(series.length / 0.78); }
    var step = pw / slots, vis = isLine ? series : sc.hist, lo = sc.lower, hi = sc.upper;
    vis.forEach(function (b) { lo = Math.min(lo, isLine ? b.c : b.l); hi = Math.max(hi, isLine ? b.c : b.h); });
    var pad = (hi - lo) * 0.12; lo -= pad; hi += pad;
    var y = function (v) { return padT + (hi - v) / (hi - lo) * ph; };
    var x = function (i) { return padL + (i + 0.5) * step; };
    S.scale = { lo: lo, hi: hi, padT: padT, ph: ph, padL: padL, pw: pw };

    ctx.font = (compact ? '10px' : '11px') + ' ui-monospace, Menlo, monospace'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
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
    var known = isLine ? series.length : HIST + S.shown, fx = padL + known * step;
    if (known < slots) {
      ctx.fillStyle = C.fog; ctx.fillRect(fx, padT, padL + pw - fx, ph);
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.moveTo(fx, padT); ctx.lineTo(fx, padT + ph); ctx.stroke(); ctx.setLineDash([]);
      if (!S.pick) { ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.font = '800 ' + Math.round(Math.min(ph * 0.4, 130)) + 'px Archivo, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', fx + (padL + pw - fx) / 2, padT + ph / 2); }
    }

    ctx.save(); ctx.beginPath(); ctx.rect(padL, padT, pw, ph); ctx.clip();
    function path(key, col, width, dash) {
      ctx.strokeStyle = col; ctx.lineWidth = width; ctx.setLineDash(dash || []); ctx.beginPath(); var st = false;
      for (var i = 0; i < series.length; i++) { var v = series[i][key]; if (v == null) continue; st ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v)); st = true; }
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
      var grd = ctx.createLinearGradient(0, padT, 0, padT + ph); grd.addColorStop(0, 'rgba(46,226,154,0.28)'); grd.addColorStop(1, 'rgba(46,226,154,0)');
      ctx.beginPath(); for (var k = 0; k < series.length; k++) k ? ctx.lineTo(x(k), y(series[k].c)) : ctx.moveTo(x(k), y(series[k].c));
      ctx.lineTo(x(series.length - 1), padT + ph); ctx.lineTo(x(0), padT + ph); ctx.closePath(); ctx.fillStyle = grd; ctx.fill();
      ctx.beginPath(); for (k = 0; k < series.length; k++) k ? ctx.lineTo(x(k), y(series[k].c)) : ctx.moveTo(x(k), y(series[k].c));
      ctx.strokeStyle = C.line; ctx.lineWidth = 1.8; ctx.shadowColor = 'rgba(46,226,154,0.6)'; ctx.shadowBlur = 8; ctx.stroke(); ctx.shadowBlur = 0;
    } else {
      var bw = Math.max(1.6, step * 0.62);
      for (var c = 0; c < series.length; c++) {
        var b = series[c], col = b.c >= b.o ? C.up : C.down;
        ctx.globalAlpha = (c >= HIST && !S.pick) ? 0.8 : 1;
        ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x(c), y(b.h)); ctx.lineTo(x(c), y(b.l)); ctx.stroke();
        ctx.fillStyle = col; ctx.fillRect(x(c) - bw / 2, y(Math.max(b.o, b.c)), bw, Math.max(1.2, Math.abs(y(b.o) - y(b.c))));
      }
      ctx.globalAlpha = 1;
    }
    S.lines.forEach(function (ln, idx) {
      var prog = (S.drawAnim && S.drawAnim.idx === idx) ? S.drawAnim.p : 1, ly = y(ln);
      ctx.strokeStyle = C.user; ctx.lineWidth = 1.6; ctx.shadowColor = 'rgba(255,255,255,0.7)'; ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.moveTo(padL, ly); ctx.lineTo(padL + pw * prog, ly); ctx.stroke(); ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(padL + pw * prog, ly, 3.5, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();

    level(y(sc.upper), C.upLine, 'BREAKOUT', padL, pw, compact);
    level(y(sc.lower), C.downLine, 'BREAKDOWN', padL, pw, compact);
    S.lines.forEach(function (ln) {
      var ly = y(ln); ctx.font = '700 10px ui-monospace, Menlo, monospace';
      var bx = padL + pw + 4, bw2 = W - bx - 4; ctx.fillStyle = '#fff'; rr(bx, ly - 9, bw2, 18, 6); ctx.fill();
      ctx.fillStyle = '#03161F'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(ln.toFixed(5), bx + bw2 / 2, ly + 1);
    });
    if (S.hitShown && S.view === 'M') {
      var hx = x(HIST + sc.hit), hy = sc.side === 'up' ? y(sc.upper) : y(sc.lower), hc = sc.side === 'up' ? C.upLine : C.downLine;
      ctx.shadowColor = hc; ctx.shadowBlur = 18; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(hx, hy, 12, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0;
      ctx.fillStyle = hc; ctx.beginPath(); ctx.arc(hx, hy, 5, 0, Math.PI * 2); ctx.fill();
    }
  }
  function level(ly, col, label, padL, pw, compact) {
    ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 10; ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.setLineDash([8, 6]);
    ctx.beginPath(); ctx.moveTo(padL, ly); ctx.lineTo(padL + pw, ly); ctx.stroke(); ctx.setLineDash([]);
    ctx.font = '800 ' + (compact ? 10 : 11) + 'px Archivo, sans-serif';
    var bx = padL + pw + 4, bw = W - bx - 4; ctx.fillStyle = col; rr(bx, ly - 12, bw, 24, 8); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#04202D'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, bx + bw / 2, ly + 1); ctx.restore();
  }
  function priceAt(clientY) {
    var r = cv.getBoundingClientRect(), sc = S.scale; if (!sc) return null;
    var yy = clientY - r.top; if (yy < sc.padT || yy > sc.padT + sc.ph) return null;
    return sc.hi - (yy - sc.padT) / sc.ph * (sc.hi - sc.lo);
  }
  function yOf(price) { var sc = S.scale; return sc.padT + (sc.hi - price) / (sc.hi - sc.lo) * sc.ph; }

  /* ---------- HUD ---------- */
  function bump(el) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
  function renderCoins(b) { ui.coins.textContent = fmt(S.coins); if (b) bump(ui.coins); }
  function renderCandles(b) { ui.candles.textContent = fmt(S.candles); ui.rwBalance.textContent = fmt(S.candles); if (b) bump(ui.candles); }
  function renderTimer() { var m = Math.floor(S.t / 60), s = S.t % 60; ui.timer.textContent = m + ':' + (s < 10 ? '0' : '') + s; ui.timerChip.classList.toggle('is-low', S.t <= 10 && !S.pick && S.bought); }
  function setView(v) {
    S.view = v; ui.views.forEach(function (b) { b.setAttribute('aria-checked', b.getAttribute('data-view') === v); });
    ui.tf.textContent = (v === 'M' ? '5m' : v === 'H' ? '1h' : '1D') + ' · instrument skrytý do výsledku'; draw();
  }
  function setInd(k, on) { S.ind[k] = on; var cb = ui.ind.querySelector('[data-ind="' + k + '"]'); if (cb) cb.checked = on; draw(); }
  var toastT;
  function toast(t) { ui.toast.textContent = t; ui.toast.classList.add('is-on'); clearTimeout(toastT); toastT = setTimeout(function () { ui.toast.classList.remove('is-on'); }, 3000); }
  function overlay(title, text, btn, fn) {
    ui.overTitle.textContent = title; ui.overText.textContent = text; ui.overBtn.textContent = btn; ui.over.hidden = false;
    ui.overBtn.onclick = function () { ui.over.hidden = true; fn(); }; ui.overBtn.focus({ preventScroll: true });
  }
  function lockControls(locked) { ui.up.disabled = ui.down.disabled = locked; ui.reveal.disabled = locked || !!S.revealed; ui.lineBtn.disabled = locked; }

  /* ---------- round flow ---------- */
  function startTimer() {
    clearInterval(S.timerId); S.t = cfg.game.roundSeconds; renderTimer();
    S.timerId = setInterval(function () {
      if (!S.bought || S.pick || !ui.over.hidden || S.mode !== 'play') return;
      var r = game.getBoundingClientRect(); if (r.bottom < 0 || r.top > window.innerHeight) return;
      S.t--; renderTimer();
      if (S.t <= 0) { toast('Čas vypršel. Nový graf, nová šance.'); startRound(); }
    }, 1000);
  }
  function startRound(want) {
    S.sc = newScenario(want); S.shown = 0; S.revealed = 0; S.pick = null; S.playing = false; S.hitShown = false; S.bought = false;
    S.lines = []; S.drawAnim = null; S.drawing = false; ui.lineBtn.setAttribute('aria-pressed', 'false'); stage.classList.remove('is-drawing');
    ui.win.hidden = true; ui.up.classList.remove('is-chosen'); ui.down.classList.remove('is-chosen');
    ui.revealN.textContent = '1'; ui.buyCost.textContent = cfg.game.entry;
    ui.sentDn.textContent = S.sc.sent + ' %'; ui.sentUp.textContent = (100 - S.sc.sent) + ' %'; ui.sentBar.style.width = S.sc.sent + '%';
    stage.classList.add('is-locked'); ui.buy.hidden = false; lockControls(true);
    game.classList.add('is-open'); idleRewards();
    setView(S.view); startTimer();
  }
  function buy() {
    if (S.bought) return;
    if (S.coins < cfg.game.entry) {
      overlay('Došly ti coins', 'Každý den se ti peněženka dobije na ' + cfg.game.startCoins + ' coins. V ukázce to zvládneme hned.', 'Denní doplnění', function () { S.coins = cfg.game.startCoins; renderCoins(true); });
      return;
    }
    S.bought = true; S.coins -= cfg.game.entry; renderCoins(true);
    ui.buy.hidden = true; stage.classList.remove('is-locked'); lockControls(false); startTimer();
  }
  function choose(side) {
    if (!S.bought || S.pick || S.playing || !ui.over.hidden) return Promise.resolve();
    S.pick = side; S.playing = true; renderTimer(); lockControls(true); closeInd();
    (side === 'up' ? ui.up : ui.down).classList.add('is-chosen');
    if (S.view !== 'M') setView('M');
    var target = S.sc.hit + 1, tail = Math.min(4, FUT - target);
    return new Promise(function (resolve) {
      (function step() {
        S.shown++; if (S.shown >= target) S.hitShown = true; draw();
        if (S.shown < target + tail) { if (reduced) step(); else setTimeout(step, S.shown >= target ? 110 : 40); }
        else { finish(); resolve(); }
      })();
    });
  }
  function finish() {
    S.playing = false;
    var win = S.pick === S.sc.side, where = S.sc.side === 'up' ? 'horní' : 'dolní', per = cfg.game.candlesPerWin;
    if (win) { S.candles += per; renderCandles(true); ui.win.hidden = false; }
    ui.rwResult.className = 'rw-result ' + (win ? 'is-win' : 'is-loss');
    ui.rwTitle.textContent = win ? 'Trefa. Graf jsi přečetl.' : 'Tentokrát ne.';
    ui.rwDelta.textContent = win ? '+' + per + ' svíčka' : 'Bez svíčky';
    ui.rwNote.textContent = 'Cena prorazila ' + where + ' hranici jako první.' + (win ? ' Svíčka je tvoje.' : ' Další graf je za rohem.');
    renderRewards(win); ui.rwActions.hidden = false;
    if (S.mode === 'play') setTimeout(function () { ui.rwNext.focus({ preventScroll: true }); }, 450);
  }

  /* ---------- rewards panel ---------- */
  function discount(p) { return p.price * cfg.maxDiscountPct / 100; }
  function candlesFor(p) { return Math.ceil(discount(p) / (cfg.candleValue || 50)); }
  function withDisc(p) { return p.price - discount(p); }
  function idleRewards() {
    ui.rwResult.className = 'rw-result is-idle';
    ui.rwTitle.textContent = 'Hraj o skutečné odměny';
    ui.rwDelta.textContent = '+' + cfg.game.candlesPerWin + ' svíčka za trefu';
    ui.rwNote.textContent = 'Vstup do kola ' + cfg.game.entry + ' coins. Svíčky tě dovedou ke slevám v shopu.';
    ui.rwActions.hidden = true; renderRewards(false);
  }
  function renderRewards() {
    var prods = cfg.products.slice(), feat = prods.filter(function (p) { return p.featured; })[0] || prods[0], cur = cfg.currency;
    var need = candlesFor(feat), pct = Math.min(1, S.candles / need), left = Math.max(0, need - S.candles);
    ui.rwFeatured.innerHTML =
      '<div class="rw-featured__top">' + window.CoC.icon(feat) +
      '<div><p class="rw-featured__name">' + feat.name + '</p>' +
      '<p class="rw-price"><s>' + fmt(feat.price) + ' ' + cur + '</s> <b>od ' + fmt(withDisc(feat)) + ' ' + cur + '</b></p>' +
      '<p class="rw-featured__tag">sleva až ' + fmt(discount(feat)) + ' ' + cur + ' za ' + fmt(need) + ' svíček</p></div></div>' +
      '<div class="rw-prog" role="progressbar" aria-label="Postup k odměně ' + feat.name + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(pct * 100) + '"><i></i></div>' +
      '<div class="rw-featured__meta"><span>' + (left > 0 ? 'Zbývá ' + fmt(left) + ' svíček' : 'Odměna odemčena') + '</span><span>' + fmt(S.candles) + ' / ' + fmt(need) + '</span></div>';
    var bar = ui.rwFeatured.querySelector('.rw-prog i');
    requestAnimationFrame(function () { requestAnimationFrame(function () { bar.style.width = Math.max(pct * 100, 2.5) + '%'; }); });
    ui.rwList.innerHTML = prods.filter(function (p) { return p !== feat; }).map(function (p) {
      var n = candlesFor(p), q = Math.min(1, S.candles / n);
      return '<li>' + window.CoC.icon(p) + '<div><b>' + p.name + '</b><small><s>' + fmt(p.price) + ' ' + cur + '</s> od ' + fmt(withDisc(p)) + ' ' + cur + '</small>' +
        '<span class="rw-mini"><i style="width:' + Math.max(q * 100, 3).toFixed(1) + '%"></i></span></div><span class="pct">' + fmt(S.candles) + '/' + fmt(n) + '</span></li>';
    }).join('');
  }

  /* ---------- free-play controls ---------- */
  function closeInd() { ui.ind.hidden = true; ui.indBtn.setAttribute('aria-expanded', 'false'); }
  function toggleInd() { var open = ui.ind.hidden; ui.ind.hidden = !open; ui.indBtn.setAttribute('aria-expanded', String(open)); }
  function toggleLine(on) {
    S.drawing = on == null ? !S.drawing : on; ui.lineBtn.setAttribute('aria-pressed', String(S.drawing)); stage.classList.toggle('is-drawing', S.drawing);
    if (S.drawing && S.mode === 'play') toast('Klikni do grafu tam, kam chceš čáru.');
  }
  ui.indBtn.addEventListener('click', function (e) { e.stopPropagation(); toggleInd(); });
  document.addEventListener('click', function (e) { if (!ui.ind.hidden && !ui.ind.contains(e.target) && !ui.indBtn.contains(e.target)) closeInd(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { if (!ui.ind.hidden) { closeInd(); ui.indBtn.focus(); } if (S.drawing) toggleLine(false); } });
  ui.ind.addEventListener('change', function (e) { var k = e.target.getAttribute('data-ind'); if (k) setInd(k, e.target.checked); });
  ui.lineBtn.addEventListener('click', function () { toggleLine(); });
  cv.addEventListener('click', function (e) {
    if (!S.drawing || S.mode !== 'play') return;
    var p = priceAt(e.clientY); if (p == null) return;
    S.lines.push(p); if (S.lines.length > 4) S.lines.shift(); toggleLine(false); draw();
  });
  ui.views.forEach(function (b, i) {
    b.addEventListener('click', function () { if (!S.playing) setView(b.getAttribute('data-view')); });
    b.addEventListener('keydown', function (e) { var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (!d) return; e.preventDefault(); var n = ui.views[(i + d + ui.views.length) % ui.views.length]; n.focus(); n.click(); });
  });
  ui.reveal.addEventListener('click', function () {
    if (S.revealed || S.pick || !S.bought) return;
    if (S.sc.hit === 0) { toast('Tahle svíčka by prozradila výsledek. Odhalení to nikdy neudělá.'); return; }
    S.revealed = 1; S.shown = 1; ui.reveal.disabled = true; ui.revealN.textContent = '0';
    if (S.view !== 'M') setView('M'); else draw();
    toast('Jedna pětiminutová svíčka navíc. Výsledek pořád neznáš.');
  });
  ui.buyBtn.addEventListener('click', buy);
  ui.up.addEventListener('click', function () { choose('up'); });
  ui.down.addEventListener('click', function () { choose('down'); });
  ui.rwNext.addEventListener('click', function () { startRound(); ui.buyBtn.focus({ preventScroll: true }); });
  ui.win.addEventListener('click', function () { ui.win.hidden = true; });

  /* ---------- tutorial (auto-play with a fake cursor) ---------- */
  var T = { run: 0 };
  function sleep(ms, id) { return new Promise(function (res, rej) { setTimeout(function () { if (T.run !== id) rej('stop'); else res(); }, reduced ? Math.min(ms, 200) : ms); }); }
  function cursorTo(target, id, dur) {
    var g = game.getBoundingClientRect(), x, y;
    if (target && target.getBoundingClientRect) { var r = target.getBoundingClientRect(); x = r.left + r.width * 0.55 - g.left; y = r.top + r.height * 0.6 - g.top; }
    else { x = target.x; y = target.y; }
    ui.cursor.style.transitionDuration = (reduced ? 0 : (dur || 700)) + 'ms';
    ui.cursor.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    return sleep((dur || 700) + 80, id);
  }
  function tap(id) { ui.cursor.classList.remove('tap'); void ui.cursor.offsetWidth; ui.cursor.classList.add('tap'); return sleep(260, id); }
  function caption(i, text) {
    ui.steps.forEach(function (li, j) { li.classList.toggle('is-on', j === i); li.classList.toggle('is-done', j < i); });
    ui.cap.textContent = text; ui.cap.classList.add('is-on');
  }
  function stagePoint(fx, price) { var c = cv.getBoundingClientRect(), g = game.getBoundingClientRect(); return { x: c.left - g.left + c.width * fx, y: c.top - g.top + yOf(price) }; }

  function tutorial() {
    var id = ++T.run; S.mode = 'tutorial'; game.classList.add('is-tutorial'); ui.cursor.classList.add('is-on');
    function loop() {
      S.coins = cfg.game.startCoins; S.candles = 0; renderCoins(); renderCandles();
      S.view = 'M'; setInd('ema', false); setInd('sma', false); setInd('bb', false); closeInd();
      startRound('up');
      var g = game.getBoundingClientRect();
      ui.cursor.style.transitionDuration = '0ms'; ui.cursor.style.transform = 'translate(' + (g.width * 0.5) + 'px,' + (g.height * 0.9) + 'px)';
      return sleep(500, id)
        .then(function () { caption(0, 'Kup si graf. Vstup stojí ' + cfg.game.entry + ' coins.'); return cursorTo(ui.buyBtn, id); })
        .then(function () { return tap(id); }).then(function () { buy(); return sleep(900, id); })
        .then(function () { caption(1, 'Prohlédni si celou příležitost: denní, hodinový a minutový pohled.'); return cursorTo(ui.views[0], id); })
        .then(function () { return tap(id); }).then(function () { setView('D'); return sleep(1300, id); })
        .then(function () { return cursorTo(ui.views[1], id, 450); }).then(function () { return tap(id); }).then(function () { setView('H'); return sleep(1300, id); })
        .then(function () { return cursorTo(ui.views[2], id, 450); }).then(function () { return tap(id); }).then(function () { setView('M'); return sleep(800, id); })
        .then(function () { caption(2, 'Zapni si indikátor. Třeba EMA 100.'); return cursorTo(ui.indBtn, id); })
        .then(function () { return tap(id); }).then(function () { toggleInd(); return sleep(500, id); })
        .then(function () { return cursorTo(ui.emaRow, id, 500); }).then(function () { return tap(id); })
        .then(function () { setInd('ema', true); return sleep(900, id); }).then(function () { closeInd(); return sleep(300, id); })
        .then(function () { caption(3, 'Nakresli si čáru tam, kde cena naráží na odpor.'); return cursorTo(ui.lineBtn, id); })
        .then(function () { return tap(id); }).then(function () { toggleLine(true); return sleep(300, id); })
        .then(function () {
          S.lines = [S.sc.res]; S.drawAnim = { idx: 0, p: 0 };
          return cursorTo(stagePoint(0.04, S.sc.res), id, 600);
        })
        .then(function () { return tap(id); })
        .then(function () {
          var b = stagePoint(0.72, S.sc.res), t0 = performance.now();
          ui.cursor.style.transitionDuration = (reduced ? 0 : 900) + 'ms'; ui.cursor.style.transform = 'translate(' + b.x + 'px,' + b.y + 'px)';
          return new Promise(function (res) {
            (function f(now) { var p = Math.min(1, (now - t0) / 900); if (S.drawAnim) S.drawAnim.p = reduced ? 1 : p * 0.72 + 0.28 * p * p; draw(); if (p < 1 && T.run === id && !reduced) requestAnimationFrame(f); else res(); })(performance.now());
          });
        })
        .then(function () { S.drawAnim = null; toggleLine(false); draw(); return sleep(700, id); })
        .then(function () { caption(4, 'Zadej úroveň. Cena tlačí na horní hranici, tipneš breakout.'); return cursorTo(ui.up, id); })
        .then(function () { return tap(id); }).then(function () { return choose('up'); }).then(function () { return sleep(500, id); })
        .then(function () { caption(5, 'Výhra! Za každé vyhrané kolo dostaneš svíčku.'); return sleep(4200, id); })
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
  game.addEventListener('pointerdown', function (e) { if (S.mode === 'tutorial' && e.isTrusted) { e.preventDefault(); freePlay(); } }, true);

  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(cv); else window.addEventListener('resize', resize);

  var ready = window.CoC && window.CoC.config ? window.CoC.config : Promise.resolve(null);
  ready.then(function (c) {
    cfg = c || { currency: 'Kč', candleValue: 50, maxDiscountPct: 80, game: { startCoins: 100, entry: 10, candlesPerWin: 1, roundSeconds: 90 }, products: [{ name: 'iPhone', price: 24990, icon: 'phone', featured: true }] };
    cfg.game.candlesPerWin = cfg.game.candlesPerWin || 1;
    S.coins = cfg.game.startCoins; renderCoins(); renderCandles();
    startRound('up'); resize();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
    if (reduced || !('IntersectionObserver' in window)) { S.mode = 'play'; return; }
    var io = new IntersectionObserver(function (en) {
      if (en[0].isIntersecting && en[0].intersectionRatio > 0.4) { io.disconnect(); if (S.mode === 'tutorial') tutorial(); }
    }, { threshold: [0, 0.4, 0.6] });
    io.observe(game);
  });
})();
