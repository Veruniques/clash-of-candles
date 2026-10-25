/* Clash of Candles — page behaviour: config, nav, hero intro + scroll hand-off, ranks, shop, sign-up */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---------------- shared config (rewards.json) ----------------
     Placeholder data lives in assets/data/rewards.json. When the shop API exists,
     point data-rewards on <main> at it — everything below reads from it. */
  var DEFAULT_CONFIG = {
    currency: 'Kč', candleValue: 50, maxDiscountPct: 80,
    game: { startCoins: 100, entry: 10, candlesPerWin: 1, roundSeconds: 60 },
    products: [
      { id: 'iphone', name: 'iPhone 18 Pro', price: 34990, icon: 'phone', image: 'assets/img/products/phone.svg', featured: true, market: true },
      { id: 'airpods-max', name: 'AirPods Max', price: 13990, icon: 'headphones', image: 'assets/img/products/headphones.svg', market: true },
      { id: 'watch', name: 'Apple Watch', price: 10990, icon: 'clock', market: true },
      { id: 'airpods-pro', name: 'AirPods Pro 3', price: 6490, icon: 'headphones' }
    ],
    teasers: ['MacBook Air', 'iPad Air', 'Herní konzole', 'Voucher na výlet']
  };
  var gameEl = document.querySelector('[data-rewards]');
  var src = gameEl && gameEl.getAttribute('data-rewards');
  window.CoC = window.CoC || {};
  window.CoC.config = (src && window.fetch
    ? fetch(src, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw 0; return r.json(); })
    : Promise.reject()
  ).then(function (c) {
    c.game = Object.assign({}, DEFAULT_CONFIG.game, c.game || {});
    if (!c.products || !c.products.length) c.products = DEFAULT_CONFIG.products;
    return Object.assign({}, DEFAULT_CONFIG, c);
  }).catch(function () { return DEFAULT_CONFIG; });

  window.CoC.fmt = function (n) { return Math.round(n).toLocaleString('cs-CZ'); };
  // product photo; if it fails to load, fall back to the icon
  window.CoC.img = function (src, alt, cls) {
    return '<img' + (cls ? ' class="' + cls + '"' : '') + ' src="' + src + '" alt="' + (alt || '') + '" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.style.visibility=\'hidden\'">';
  };
  window.CoC.icon = function (p) {
    if (p.image) return '<span class="prod-ico">' + window.CoC.img(p.image, p.name) + '</span>';
    return '<span class="prod-ico"><svg aria-hidden="true"><use href="#i-' + (p.icon || 'phone') + '"/></svg></span>';
  };

  /* ---------------- nav ---------------- */
  var nav = $('#nav');
  function navState() {
    var y = window.scrollY, vh = window.innerHeight;
    nav.classList.toggle('is-solid', y > 40);
    var fin = document.querySelector('.final'), fr = fin && fin.getBoundingClientRect();
    nav.classList.toggle('is-dark', y > (reduced ? vh * 0.9 : vh * 0.97) - 72 && !(fr && fr.top < 72 && fr.bottom > 0));
    // the wordmark next to the logo waits until the hero is scrolled away (the hero already shows the big title)
    nav.classList.toggle('in-hero', y <= (reduced ? vh * 0.9 : vh * 0.97) - 72);
  }

  /* ---------------- dust / sparks ---------------- */
  var Dust = (function () {
    var hero = $('.hero'), cv = $('#dust'), ctx = cv.getContext('2d');
    var parts = [], rings = [], running = false, dpr = 1, last = 0;
    function size() { dpr = Math.min(window.devicePixelRatio || 1, 2); cv.width = hero.clientWidth * dpr; cv.height = hero.clientHeight * dpr; }
    size(); window.addEventListener('resize', size);
    function rnd(a, b) { return a + Math.random() * (b - a); }
    function local(el) { var h = hero.getBoundingClientRect(), r = el.getBoundingClientRect(); return { x: r.left - h.left, y: r.top - h.top, w: r.width, h: r.height }; }

    function tick(t) {
      var dt = last ? Math.min((t - last) / 1000, 0.05) : 0.016; last = t;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (var j = rings.length - 1; j >= 0; j--) {
        var g = rings[j]; g.life += dt;
        if (g.life > g.max) { rings.splice(j, 1); continue; }
        var k = g.life / g.max, e = 1 - Math.pow(1 - k, 3);
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.7 * (1 - k)) + ')';
        ctx.lineWidth = 6 * (1 - k) + 1;
        ctx.beginPath(); ctx.ellipse(g.x, g.y, g.rx * (0.2 + e), g.ry * (0.2 + e), 0, 0, Math.PI * 2); ctx.stroke();
      }
      for (var i = parts.length - 1; i >= 0; i--) {
        var p = parts[i]; p.life += dt;
        if (p.life >= p.max) { parts.splice(i, 1); continue; }
        var q = p.life / p.max;
        if (p.kind === 'dust') {
          p.vx *= 0.975; p.vy *= 0.975; p.vy -= 0.012;
          p.x += p.vx * 60 * dt; p.y += p.vy * 60 * dt; p.r += p.grow * 60 * dt;
          var a = p.a * (q < 0.12 ? q / 0.12 : Math.pow(1 - (q - 0.12) / 0.88, 1.6));
          var gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
          gr.addColorStop(0, 'rgba(250,255,255,' + a + ')');
          gr.addColorStop(0.45, 'rgba(232,252,254,' + a * 0.55 + ')');
          gr.addColorStop(1, 'rgba(220,250,253,0)');
          ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        } else if (p.kind === 'grit') {
          p.vy += 0.25 * 60 * dt; p.x += p.vx * 60 * dt; p.y += p.vy * 60 * dt;
          if (p.y > p.floor) { p.y = p.floor; p.vy *= -0.3; p.vx *= 0.6; }
          ctx.fillStyle = 'rgba(12,46,61,' + (0.35 * (1 - q)) + ')';
          ctx.fillRect(p.x, p.y, p.s, p.s);
        } else {
          p.vy += 0.35 * 60 * dt; p.vx *= 0.96;
          var nx = p.x + p.vx * 60 * dt, ny = p.y + p.vy * 60 * dt;
          ctx.strokeStyle = p.hue; ctx.globalAlpha = 1 - q; ctx.lineWidth = p.w; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(nx, ny); ctx.stroke(); ctx.globalAlpha = 1;
          p.x = nx; p.y = ny;
        }
      }
      if (parts.length || rings.length) requestAnimationFrame(tick);
      else { running = false; last = 0; ctx.clearRect(0, 0, cv.width, cv.height); }
    }
    function run() { if (!running) { running = true; requestAnimationFrame(tick); } }

    return {
      sparks: function (el) {
        var b = local(el), cx = b.x + b.w / 2, cy = b.y + b.h / 2;
        for (var i = 0; i < 28; i++) {
          var ang = rnd(0, Math.PI * 2), sp = rnd(4, 11);
          parts.push({ kind: 'spark', x: cx, y: cy, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 2, life: 0, max: rnd(0.35, 0.7), w: rnd(1.5, 3.2), hue: Math.random() < 0.5 ? '#FFE07A' : '#FFFFFF' });
        }
        run();
      },
      // the heavy title lands: a dust skirt squeezed out from under it, a ground ring, and some grit
      slam: function (titleEl, floorY) {
        var t = local(titleEl), cx = t.x + t.w / 2, base = t.y + t.h * 0.97, scale = t.w / 1000;
        for (var i = 0; i < 46; i++) {
          var u = Math.random(), x = t.x + u * t.w, side = x < cx ? -1 : 1, edge = Math.abs(u - 0.5) * 2;
          parts.push({ kind: 'dust', x: x, y: base + rnd(-6, 6) * scale,
            vx: side * rnd(1.2, 4.5) * (0.4 + edge) * Math.max(scale, 0.5), vy: rnd(-1.4, -0.2),
            r: rnd(16, 34) * Math.max(scale, 0.45), grow: rnd(0.35, 0.8) * Math.max(scale, 0.5), life: 0, max: rnd(1.1, 2.0), a: rnd(0.22, 0.4) });
        }
        for (var k = 0; k < 10; k++) {
          var x2 = t.x + rnd(-0.05, 1.05) * t.w;
          parts.push({ kind: 'dust', x: x2, y: floorY + rnd(-4, 6), vx: (x2 - cx) / t.w * rnd(1, 3), vy: rnd(-1, -0.2),
            r: rnd(30, 60) * Math.max(scale, 0.5), grow: rnd(0.5, 1), life: 0, max: rnd(1.4, 2.4), a: rnd(0.14, 0.24) });
        }
        for (var g = 0; g < 26; g++) {
          parts.push({ kind: 'grit', x: t.x + Math.random() * t.w, y: base, vx: rnd(-3, 3), vy: rnd(-6, -2), s: rnd(1.5, 3), floor: base + rnd(4, 30), life: 0, max: rnd(0.6, 1.1) });
        }
        rings.push({ x: cx, y: floorY, rx: t.w * 0.55, ry: t.w * 0.06, life: 0, max: 0.9 });
        run();
      }
    };
  })();

  /* ---------------- hero intro ---------------- */
  var introDone = false;
  function heroIntro() {
    var g = window.gsap;
    if (reduced || !g) { root.classList.remove('js-anim'); introDone = true; if (window.HeroChart) HeroChart.show(); return; }
    root.classList.add('anim-started');
    var green = $('#fGreen'), red = $('#fRed'), title = $('#heroTitle'), impact = $('#impact'),
        scene = $('#scene'), shadow = $('.duo__shadow');
    var copy = ['#heroQ', '#heroSub', '#heroCta'].map(function (s) { return $(s); });

    g.set(green, { x: '-80vw', rotation: -14 });
    g.set(red, { x: '80vw', rotation: 14 });
    g.set(title, { y: -window.innerHeight * 1.1, opacity: 1 });
    g.set(copy, { opacity: 0, y: 24 });
    g.set(shadow, { opacity: 0, scaleX: 0.4 });
    root.classList.remove('js-anim');

    var shake = function (amp) {
      g.fromTo(scene, { x: 0, y: 0 }, { keyframes: { x: [-amp, amp * 0.9, -amp * 0.6, amp * 0.35, -amp * 0.15, 0], y: [amp * 0.4, -amp * 0.3, amp * 0.2, -amp * 0.1, 0, 0] }, duration: 0.42, ease: 'none' });
    };
    var tl = g.timeline({ delay: 0.35, onComplete: function () { introDone = true; } });
    tl.to(green, { x: 0, rotation: 0, duration: 0.78, ease: 'power3.in' }, 0)
      .to(red, { x: 0, rotation: 0, duration: 0.78, ease: 'power3.in' }, 0)
      .to(shadow, { opacity: 1, scaleX: 1, duration: 0.78, ease: 'power3.in' }, 0)
      .add(function () {
        g.fromTo(impact, { opacity: 1, scale: 0.2 }, { opacity: 0, scale: 1.7, duration: 0.5, ease: 'power2.out' });
        Dust.sparks(impact); shake(12);
        if (window.HeroChart) HeroChart.reveal(); // the chart snaps in when they collide
      }, 0.78)
      .to(red, { x: '2.2%', rotation: 3, duration: 0.09, ease: 'power2.out' }, 0.78)
      .to(red, { x: 0, rotation: 0, duration: 0.7, ease: 'elastic.out(1, 0.45)' }, 0.87)
      .to(green, { x: '-0.8%', duration: 0.08, ease: 'power2.out' }, 0.78)
      .to(green, { x: 0, duration: 0.6, ease: 'elastic.out(1, 0.5)' }, 0.86)
      .to(title, { y: 0, duration: 0.55, ease: 'power4.in' }, 1.15)
      .add(function () {
        var s = $('.duo').getBoundingClientRect(), h = $('.hero').getBoundingClientRect();
        Dust.slam(title, s.bottom - h.top); shake(16);
      }, 1.7)
      .fromTo(title, { scaleY: 0.84, scaleX: 1.05, transformOrigin: '50% 100%' }, { scaleY: 1, scaleX: 1, duration: 0.6, ease: 'elastic.out(1, 0.4)' }, 1.7)
      .to(copy[0], { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, 2.0)
      .to(copy[1], { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, 2.12)
      .to(copy[2], { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, 2.24)
      .add(function () {
        g.to('#duoBob', { y: -8, duration: 2.1, ease: 'sine.inOut', yoyo: true, repeat: -1 });
        g.to(shadow, { scaleX: 0.9, duration: 2.1, ease: 'sine.inOut', yoyo: true, repeat: -1 });
      }, 2.4);
  }
  if (document.readyState === 'complete') heroIntro(); else window.addEventListener('load', heroIntro);

  /* ---------------- scroll hand-off: fighters leave, the game panel arrives ---------------- */
  var heroChartEl = $('#heroChart'), exitG = $('#exitGreen'), exitR = $('#exitRed'), titleWrap = $('#titleWrap'), heroCopy = $('#heroCopy'),
      cue = $('#scrollCue'), playInner = $('#playInner'), shadowEl = $('.duo__shadow');
  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function scrollFx() {
    var vh = window.innerHeight, y = window.scrollY;
    var p = clamp(y / (vh * 0.6)), e = p * p * (3 - 2 * p);
    exitG.style.transform = 'translate3d(' + (-e * 75) + 'vw,' + (-e * 8) + 'vh,0) rotate(' + (-e * 22) + 'deg)';
    exitR.style.transform = 'translate3d(' + (e * 75) + 'vw,' + (-e * 4) + 'vh,0) rotate(' + (e * 22) + 'deg)';
    titleWrap.style.transform = 'translate3d(0,' + (-e * 22) + 'vh,0) scale(' + (1 + e * 0.12) + ')';
    titleWrap.style.opacity = String(1 - clamp(p * 1.4));
    if (heroChartEl) heroChartEl.style.opacity = String(1 - clamp(p * 1.6));
    heroCopy.style.opacity = String(1 - clamp(p * 2.2));
    heroCopy.style.transform = 'translate3d(0,' + (-p * 40) + 'px,0)';
    if (introDone) shadowEl.style.opacity = String(1 - clamp(p * 2));
    if (cue) cue.style.opacity = String(1 - clamp(p * 4));
    // the panel tilts back flat as it rises
    var r = playInner.getBoundingClientRect();
    var q = clamp((r.top - vh * 0.1) / (vh * 0.9));
    playInner.style.transform = 'rotateX(' + (q * 14).toFixed(2) + 'deg) scale(' + (1 - q * 0.05).toFixed(4) + ')';
  }
  var ticking = false;
  function onScroll() {
    navState();
    if (reduced || ticking) return;
    ticking = true;
    requestAnimationFrame(function () { ticking = false; scrollFx(); });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  navState(); if (!reduced) scrollFx();

  /* ---------------- ranks: earned, not chosen. Everyone starts at the bottom (placeholder economy: edit here) ---------------- */
  // ranks exactly as in the game: F → E → D → C → B → A → S → G.O.A.T. with +/++ steps (entry/win = placeholder economy)
  var TIER = { F: '#20E39B', E: '#20E39B', D: '#B4F23A', C: '#22DDEB', B: '#2F8CFF', A: '#8E1DB8', S: '#F2C524', G: '#F28A1F' };
  var RANKS = [
    ['F', 10, 1], ['E', 15, 1], ['E+', 20, 2], ['E++', 25, 2],
    ['D', 30, 3], ['D+', 40, 4], ['D++', 50, 5], ['C', 60, 6], ['C+', 80, 8], ['C++', 100, 10],
    ['B', 120, 12], ['B+', 150, 15], ['B++', 200, 20], ['A', 250, 25], ['A+', 300, 30], ['A++', 400, 40],
    ['S', 500, 50], ['S+', 650, 65], ['S++', 800, 80], ['G.O.A.T.', 1000, 100]
  ];
  var fmt = window.CoC.fmt;
  // rank tiles: one per tier F → G.O.A.T., entry + win ranges from RANKS
  (function () {
    var el = $('#rankTiles'); if (!el) return;
    var order = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'G'], groups = {};
    RANKS.forEach(function (r) { (groups[r[0][0]] = groups[r[0][0]] || []).push(r); });
    el.innerHTML = order.map(function (t, i) {
      var g = groups[t], goat = t === 'G', light = /[BAG]/.test(t);
      return '<li class="rkp rline' + (i === 0 ? ' is-me' : '') + '" style="--rc:' + TIER[t] + '">' +
        '<b class="rkp-badge' + (light ? ' is-light' : '') + (goat ? ' is-goat' : '') + '">' + (goat ? 'G.O.A.T.' : t) + '</b>' +
        '<span class="rline__steps">' + (goat ? 'Vrchol' : g.length < 2 ? '' : g.map(function (r) { return r[0]; }).join(' · ')) + '</span>' +
        (i === 0 ? '<em class="rtile__tag">Tady začínáš</em>' : '') + '</li>';
    }).join('');
  })();
  (function () {
    var list = $('#rankList'); if (!list) return;
    var me = 0, open = 4; // demo player: fresh on F; the first tier group is visible, the rest unlocks by playing
    var lock = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3M12 15v2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
    list.innerHTML = RANKS.map(function (r, i) {
      var c = TIER[r[0][0]], dark = /[BAG]/.test(r[0][0]), goat = r[0][0] === 'G';
      var row = '<li class="rkp' + (i === me ? ' is-me' : '') + (i >= open ? ' is-locked' : '') + '">' +
        '<b class="rkp-badge' + (dark ? ' is-light' : '') + (goat ? ' is-goat' : '') + '" style="--rc:' + c + '">' + r[0] + '</b>' +
        '<span class="rkp-val"><i class="coin-ico" aria-hidden="true"></i>' + fmt(r[1]) + '</span>' +
        '<span class="rkp-val"><i class="heart-ico" aria-hidden="true"></i>+' + r[2] + '</span></li>';
      if (i === open - 1) row += '<li class="rkp-lock">Postupuj hrou ' + lock + '</li>';
      return row;
    }).join('');
  })();

  /* ---------------- play screenshot: a small static chart ---------------- */
  (function () {
    var cv = $('#psChart'); if (!cv) return;
    function paint() {
      var r = cv.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2), w = r.width, h = r.height; if (!w) return;
      cv.width = w * d; cv.height = h * d; var c = cv.getContext('2d'); c.setTransform(d, 0, 0, d, 0, 0);
      var n = 120, seed = 7, p = 0, pts = [];
      function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
      for (var i = 0; i < n; i++) { p += (rnd() - 0.48) * 3 + Math.sin(i / 14) * 0.6; pts.push(p); }
      var lo = Math.min.apply(null, pts), hi = Math.max.apply(null, pts), pad = (hi - lo) * 0.35; lo -= pad; hi += pad;
      var X = function (i) { return 10 + i / (n - 1) * (w * 0.7); }, Y = function (v) { return 10 + (hi - v) / (hi - lo) * (h - 20); };
      c.strokeStyle = 'rgba(255,255,255,.05)'; for (var g = 1; g < 6; g++) { c.beginPath(); c.moveTo(0, h * g / 6); c.lineTo(w, h * g / 6); c.stroke(); }
      [['#4FF2B1', hi - pad * 0.45, 'BREAKOUT'], ['#FF6A86', lo + pad * 0.45, 'BREAKDOWN']].forEach(function (L) {
        c.strokeStyle = L[0]; c.setLineDash([6, 5]); c.beginPath(); c.moveTo(0, Y(L[1])); c.lineTo(w - 76, Y(L[1])); c.stroke(); c.setLineDash([]);
        c.fillStyle = L[0]; c.beginPath(); c.roundRect ? c.roundRect(w - 74, Y(L[1]) - 9, 68, 18, 6) : c.rect(w - 74, Y(L[1]) - 9, 68, 18); c.fill();
        c.fillStyle = '#04202D'; c.font = '800 9px Archivo, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(L[2], w - 40, Y(L[1]) + 1);
      });
      c.beginPath(); pts.forEach(function (v, i) { i ? c.lineTo(X(i), Y(v)) : c.moveTo(X(i), Y(v)); });
      c.strokeStyle = '#2EE29A'; c.lineWidth = 1.6; c.shadowColor = 'rgba(46,226,154,.6)'; c.shadowBlur = 6; c.stroke(); c.shadowBlur = 0;
      for (var k = n - 26; k < n; k++) { var o = pts[k - 1], cl = pts[k], up = cl >= o; c.fillStyle = up ? '#2EE29A' : '#FF4767'; c.fillRect(X(k) - 1.6, Y(Math.max(o, cl)), 3.2, Math.max(1.5, Math.abs(Y(o) - Y(cl)))); }
    }
    paint(); window.addEventListener('resize', paint); if (document.fonts) document.fonts.ready.then(paint);
  })();


  /* ---------------- hero contest banner (game look): tabs + prize pool + flip-clock (hours : minutes) ----------------
     PLACEHOLDER pools — replace with the real contest banks before launch. */
  (function () {
    var root = $('#contestBanner'); if (!root) return;
    var POOL = { day: '30 000 €', week: '75 000 €', month: '150 000 €' };
    var tabs = Array.prototype.slice.call(root.querySelectorAll('.cban__tab')), clock = $('#cbanClock'), pool = $('#cbanPool'), cur = 'day';
    function end(kind) {
      var n = new Date(), e = new Date(n);
      if (kind === 'day') e.setHours(24, 0, 0, 0);
      else if (kind === 'week') { e.setHours(24, 0, 0, 0); e.setDate(e.getDate() + ((7 - n.getDay()) % 7)); }
      else e = new Date(n.getFullYear(), n.getMonth() + 1, 1);
      return e;
    }
    function tick() {
      var m = Math.max(0, Math.floor((end(cur) - new Date()) / 60000)), h = Math.floor(m / 60), mm = m % 60;
      var str = String(h) + ':' + (mm < 10 ? '0' : '') + mm;
      var html = str.split('').map(function (ch) { return ch === ':' ? '<i class="cban__sep">:</i>' : '<b class="cban__d">' + ch + '</b>'; }).join('');
      if (clock.innerHTML !== html) clock.innerHTML = html;
      clock.setAttribute('aria-label', 'Do konce zbývá ' + h + ' h ' + mm + ' min');
    }
    tabs.forEach(function (t) {
      t.addEventListener('click', function () {
        cur = t.getAttribute('data-c');
        tabs.forEach(function (x) { var on = x === t; x.classList.toggle('is-on', on); x.setAttribute('aria-selected', on); });
        pool.textContent = POOL[cur]; tick();
      });
    });
    tick(); setInterval(tick, 15000);
  })();

  /* ---------------- contests: live countdowns ---------------- */
  (function () {
    var els = Array.prototype.slice.call(document.querySelectorAll('[data-countdown]')); if (!els.length) return;
    function end(kind) {
      var n = new Date(), e = new Date(n);
      if (kind === 'day') { e.setHours(24, 0, 0, 0); }
      else if (kind === 'week') { e.setHours(24, 0, 0, 0); e.setDate(e.getDate() + ((7 - n.getDay()) % 7)); }
      else { e = new Date(n.getFullYear(), n.getMonth() + 1, 1); }
      return e;
    }
    function pad(x) { return (x < 10 ? '0' : '') + x; }
    function tick() {
      els.forEach(function (el) {
        var ms = Math.max(0, end(el.getAttribute('data-countdown')) - new Date()), s = Math.floor(ms / 1000);
        var d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
        el.textContent = (d ? d + ' d ' : '') + pad(h) + ':' + pad(m) + ':' + pad(x);
      });
    }
    tick(); setInterval(tick, 1000);
  })();

  /* ---------------- leaderboard + heatmap mock data ---------------- */
  (function () {
    var lb = $('#leaderboard');
    if (lb) {
      // weekly board in the game's Ranks look: position, player, rank badge, hearts (no share)
      var rows = [['OndraB', 'S+', 77], ['Kačka_EMA', 'A++', 72], ['Medvěd77', 'A+', 68], ['GrafBijec', 'A', 63], ['Ty', 'C', 54, 27]]; // úspěšnost v %
      lb.innerHTML = rows.map(function (r, i) {
        var t = r[1].charAt(0), c = TIER[t === 'G' ? 'G' : t] || '#20E39B', light = /[BAG]/.test(t);
        return '<li class="rkp lbg__row' + (r[3] ? ' is-me' : '') + '"><span class="lbg__pos' + (i < 3 && !r[3] ? ' top' + (i + 1) : '') + '">' + (r[3] || i + 1) + '</span>' +
          '<span class="lbg__name">' + r[0] + '</span>' +
          '<b class="rkp-badge' + (light ? ' is-light' : '') + '" style="--rc:' + c + '">' + r[1] + '</b>' +
          '<span class="rkp-val">' + r[2] + ' %</span></li>';
      }).join('');
    }
    var heat = $('#heat');
    if (heat) {
      var html = '', seed = 3;
      for (var i = 0; i < 24; i++) { seed = (seed * 16807) % 2147483647; var v = 0.25 + (seed / 2147483647) * 0.75 * (i > 7 && i < 22 ? 1 : 0.5); html += '<i style="--v:' + v.toFixed(2) + '" title="' + i + ':00"></i>'; }
      heat.innerHTML = html;
    }
  })();

  /* ---------------- marketplace: 3 equal picks (no podium) + fog slider (from config) ---------------- */
  window.CoC.config.then(function (cfg) {
    var mk = $('#market');
    if (mk) {
      var picks = cfg.products.filter(function (p) { return p.market; });
      if (!picks.length) picks = cfg.products;
      mk.insertAdjacentHTML('afterbegin', picks.slice(0, 3).map(function (p) {
        var disc = p.price * cfg.maxDiscountPct / 100, need = Math.ceil(disc / (cfg.candleValue || 50));
        return '<article class="mk">' +
          '<div class="mk__art">' + (p.image ? window.CoC.img(p.image, p.name) : window.CoC.icon(p)) + '</div>' +
          '<h3 class="mk__name">' + p.name + '</h3>' +
          '<p class="mk__was">' + fmt(p.price) + ' ' + cfg.currency + '</p>' +
          '<p class="mk__pay"><span class="mk__hearts"><i class="heart-ico" aria-hidden="true"></i>' + fmt(need) + '<span class="sr"> srdíček</span></span>' +
          '<em>+</em><b>' + fmt(p.price - disc) + ' ' + cfg.currency + '</b></p></article>';
      }).join(''));
      mk.scrollLeft = 0; // keep the first reward in view on mobile (the fog card was the snap target before)
    }
    var track = $('#fogTrack');
    if (track) {
      var items = (cfg.teasers || []).map(function (t) {
        if (typeof t === 'string') t = { name: t };
        return '<div class="fogcard"><div class="fogcard__art">' + (t.image ? window.CoC.img(t.image, '') : '<span class="fogcard__q">?</span>') + '</div><p>' + t.name + '</p><span>??? Kč</span></div>';
      }).join('');
      track.innerHTML = items + items; // duplicated for a seamless loop
      // rewards jump up one by one behind the fog
      var n = (cfg.teasers || []).length, k = 0;
      if (n && !reduced) setInterval(function () {
        var it = track.children[0]; if (!it || !track.getClientRects().length) return;
        var step = it.offsetHeight + parseFloat(getComputedStyle(track).rowGap || 0);
        k++; track.style.transition = 'transform .65s cubic-bezier(.34,1.56,.64,1)'; track.style.transform = 'translateY(' + (-k * step) + 'px)';
        if (k >= n) setTimeout(function () { track.style.transition = 'none'; k = 0; track.style.transform = 'translateY(0)'; }, 700);
      }, 1700);
    }
  });

  /* ---------------- sign-up ---------------- */
  (function () {
    var form = $('#signup'), email = $('#email'), age = $('#age'), msg = $('#signupMsg');
    var endpoint = form.getAttribute('data-endpoint') || '';
    var say = function (text, ok) { msg.textContent = text; msg.className = 'signup__msg ' + (ok ? 'is-ok' : 'is-err'); };
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = email.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) {
        email.setAttribute('aria-invalid', 'true'); email.focus();
        return say('Tohle nevypadá jako e-mail. Zkontroluj ho a zkus to znovu.');
      }
      email.removeAttribute('aria-invalid');
      if (!age.checked) { age.focus(); return say('Do arény pouštíme jen hráče od 18 let. Potvrď to prosím zaškrtnutím.'); }
      var btn = form.querySelector('button[type="submit"]'); btn.disabled = true;
      var done = function () { form.classList.add('is-done'); say('Jsi na seznamu. Jakmile se otevřou brány arény, dáme ti vědět.', true); };
      if (!endpoint) {
        console.warn('[Clash of Candles] Sign-up endpoint is not configured (data-endpoint on #signup). E-mail was not sent anywhere.');
        try { localStorage.setItem('coc_waitlist_email', v); } catch (_) {}
        return done();
      }
      fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: v, adult: true, source: 'landing-cz', ts: new Date().toISOString() }) })
        .then(function (r) { if (!r.ok) throw new Error(r.status); done(); })
        .catch(function () { btn.disabled = false; say('Zápis se nepovedl, spojení vypadlo. Zkus to prosím za chvíli znovu.'); });
    });
  })();
})();
