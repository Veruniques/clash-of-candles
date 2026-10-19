/* Clash of Candles — page behaviour: config, nav, hero intro + scroll hand-off, ranks, shop, sign-up */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---------------- shared config (rewards.json) ----------------
     Placeholder data lives in assets/data/rewards.json. When the shop API exists,
     point data-rewards on #game at it — everything below and game.js reads from it. */
  var DEFAULT_CONFIG = {
    currency: 'Kč', coinValue: 1, maxDiscountPct: 80,
    game: { startCoins: 100, entry: 10, win: 20, lives: 10, roundSeconds: 90 },
    products: [
      { id: 'iphone', name: 'iPhone', tagline: 'Využij coins jako slevu na nový telefon.', price: 24990, icon: 'phone', featured: true },
      { id: 'headphones', name: 'Sluchátka', tagline: 'Získej něco navíc za svůj herní výkon.', price: 6990, icon: 'headphones' },
      { id: 'gear', name: 'Gaming gear', tagline: 'Vylepši svou herní výbavu.', price: 3490, icon: 'gamepad' },
      { id: 'merch', name: 'Clash of Candles merch', tagline: 'Ukaž, že patříš do arény.', price: 790, icon: 'tee' }
    ]
  };
  var gameEl = $('#game');
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
  window.CoC.icon = function (p) {
    if (p.image) return '<span class="prod-ico"><img src="' + p.image + '" alt=""></span>';
    return '<span class="prod-ico"><svg aria-hidden="true"><use href="#i-' + (p.icon || 'phone') + '"/></svg></span>';
  };

  /* ---------------- nav ---------------- */
  var nav = $('#nav');
  function navState() { nav.classList.toggle('is-solid', window.scrollY > 40); }

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
    if (reduced || !g) { root.classList.remove('js-anim'); introDone = true; return; }
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
  var exitG = $('#exitGreen'), exitR = $('#exitRed'), titleWrap = $('#titleWrap'), heroCopy = $('#heroCopy'),
      cue = $('#scrollCue'), playInner = $('#playInner'), shadowEl = $('.duo__shadow');
  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function scrollFx() {
    var vh = window.innerHeight, y = window.scrollY;
    var p = clamp(y / (vh * 0.6)), e = p * p * (3 - 2 * p);
    exitG.style.transform = 'translate3d(' + (-e * 75) + 'vw,' + (-e * 8) + 'vh,0) rotate(' + (-e * 22) + 'deg)';
    exitR.style.transform = 'translate3d(' + (e * 75) + 'vw,' + (-e * 4) + 'vh,0) rotate(' + (e * 22) + 'deg)';
    titleWrap.style.transform = 'translate3d(0,' + (-e * 22) + 'vh,0) scale(' + (1 + e * 0.12) + ')';
    titleWrap.style.opacity = String(1 - clamp(p * 1.4));
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

  /* ---------------- ranks (placeholder economy: edit here) ---------------- */
  var TOOLS = ['Čáry', 'Horizontály', 'Vertikály', 'Obdélníky', 'EMA', 'Odhalení'];
  var RANKS = [
    { name: 'Knot',    entry: 10,  win: 20,   off: [], tag: 'Tady začíná každý. Všechny nástroje, čitelné grafy a prostor se učit.' },
    { name: 'Jiskra',  entry: 25,  win: 50,   off: ['Obdélníky'], tag: 'První výhry za sebou. Obdélníky zůstávají dole, zóny si drž v hlavě.' },
    { name: 'Plamen',  entry: 50,  win: 100,  off: ['Obdélníky', 'Vertikály'], tag: 'Grafy začínají klamat. Ubývá nápovědy, přibývá výzvy.' },
    { name: 'Žár',     entry: 100, win: 200,  off: ['Obdélníky', 'Vertikály', 'Čáry'], tag: 'Zbývá EMA, horizontály a tvůj odhad.' },
    { name: 'Výheň',   entry: 200, win: 400,  off: ['Obdélníky', 'Vertikály', 'Čáry', 'EMA'], tag: 'Bez EMA. Jedna horizontála a spousta ticha.' },
    { name: 'Legenda', entry: 500, win: 1000, off: TOOLS.slice(), tag: 'Žádné nástroje, žádná odhalení. Jen ty a čistý graf.' }
  ];
  (function () {
    var ladder = $('#rankLadder'), panel = $('#rankPanel'); if (!ladder) return;
    var heights = [22, 34, 47, 61, 77, 94], fmt = window.CoC.fmt;
    var btns = RANKS.map(function (r, i) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'rank'; b.setAttribute('role', 'tab'); b.id = 'rank-' + i;
      b.setAttribute('aria-controls', 'rankPanel'); b.style.setProperty('--h', heights[i] + '%');
      b.innerHTML = '<span class="rank__body"></span><span class="rank__name">' + r.name + '</span>';
      ladder.appendChild(b); return b;
    });
    function show(i, focus) {
      var r = RANKS[i];
      btns.forEach(function (b, j) { b.setAttribute('aria-selected', j === i); b.tabIndex = j === i ? 0 : -1; });
      panel.setAttribute('aria-labelledby', 'rank-' + i);
      panel.innerHTML =
        '<div class="rp__top"><p class="rp__name">' + r.name + '</p><span class="rp__lvl">Rank ' + (i + 1) + ' z ' + RANKS.length + '</span></div>' +
        '<p class="rp__tag">' + r.tag + '</p>' +
        '<dl class="rp__stats"><div><dt>Vstup</dt><dd>' + fmt(r.entry) + ' coins</dd></div><div><dt>Výhra</dt><dd>' + fmt(r.win) + ' coins</dd></div></dl>' +
        '<p class="rp__sub">Analytické nástroje</p><ul class="tools-list">' +
        TOOLS.map(function (t) { var off = r.off.indexOf(t) > -1; return '<li' + (off ? ' class="off"><span class="sr">nedostupné: </span>' : '>') + t + '</li>'; }).join('') + '</ul>' +
        '<p class="rp__sub">Náročnost grafu</p><div class="meter" role="img" aria-label="Náročnost ' + (i + 1) + ' z 6">' +
        heights.map(function (_, j) { return '<span' + (j <= i ? ' class="on"' : '') + '></span>'; }).join('') + '</div>';
      if (focus) btns[i].focus();
    }
    btns.forEach(function (b, i) {
      b.addEventListener('click', function () { show(i); });
      b.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); show(Math.min(i + 1, btns.length - 1), true); }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); show(Math.max(i - 1, 0), true); }
      });
    });
    show(0);
  })();

  /* ---------------- shop products (from config) ---------------- */
  window.CoC.config.then(function (cfg) {
    var box = $('#shopProducts'); if (!box) return;
    box.innerHTML = cfg.products.map(function (p) {
      return '<article class="product glass' + (p.featured ? ' is-featured' : '') + '">' + window.CoC.icon(p) +
        '<h3 class="h3">' + p.name + '</h3><p>' + (p.tagline || '') + '</p>' +
        '<p class="disc">Sleva až ' + cfg.maxDiscountPct + ' % v coins</p></article>';
    }).join('');
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
