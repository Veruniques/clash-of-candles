/* Clash of Candles — page behaviour: nav, hero intro, ranks, screenshots, sign-up */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---------------- nav ---------------- */
  var nav = $('#nav');
  var onScroll = function () { nav.classList.toggle('is-solid', window.scrollY > 40); };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------------- dust / sparks canvas ---------------- */
  var Dust = (function () {
    var hero = $('.hero');
    var cv = $('#dust');
    var ctx = cv.getContext('2d');
    var parts = [];
    var running = false;
    var dpr = 1;

    function size() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = hero.clientWidth * dpr;
      cv.height = hero.clientHeight * dpr;
    }
    size();
    window.addEventListener('resize', size);

    function rnd(a, b) { return a + Math.random() * (b - a); }

    function puff(x, y, o) {
      o = o || {};
      parts.push({
        kind: 'dust', x: x, y: y,
        vx: o.vx != null ? o.vx : rnd(-1.2, 1.2),
        vy: o.vy != null ? o.vy : rnd(-2.6, -0.5),
        r: o.r || rnd(10, 30), grow: rnd(0.25, 0.7),
        life: 0, max: rnd(1.3, 2.6), a: o.a || rnd(0.35, 0.7)
      });
    }
    function spark(x, y) {
      var ang = rnd(0, Math.PI * 2), sp = rnd(4, 11);
      parts.push({
        kind: 'spark', x: x, y: y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 2,
        life: 0, max: rnd(0.35, 0.7), w: rnd(1.5, 3.2), hue: Math.random() < 0.5 ? '#FFE07A' : '#FFFFFF'
      });
    }

    var last = 0;
    function tick(t) {
      var dt = last ? Math.min((t - last) / 1000, 0.05) : 0.016;
      last = t;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (var i = parts.length - 1; i >= 0; i--) {
        var p = parts[i];
        p.life += dt;
        if (p.life >= p.max) { parts.splice(i, 1); continue; }
        var k = p.life / p.max;
        if (p.kind === 'dust') {
          p.vx *= 0.985; p.vy *= 0.982; p.vy -= 0.015;
          p.x += p.vx * 60 * dt; p.y += p.vy * 60 * dt;
          p.r += p.grow * 60 * dt;
          var alpha = p.a * (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85);
          var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
          g.addColorStop(0, 'rgba(255,255,255,' + alpha + ')');
          g.addColorStop(0.55, 'rgba(225,250,252,' + alpha * 0.45 + ')');
          g.addColorStop(1, 'rgba(200,245,250,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        } else {
          p.vy += 0.35 * 60 * dt; p.vx *= 0.96;
          var nx = p.x + p.vx * 60 * dt, ny = p.y + p.vy * 60 * dt;
          ctx.strokeStyle = p.hue; ctx.globalAlpha = 1 - k; ctx.lineWidth = p.w; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(nx, ny); ctx.stroke();
          ctx.globalAlpha = 1;
          p.x = nx; p.y = ny;
        }
      }
      if (parts.length) requestAnimationFrame(tick);
      else { running = false; last = 0; ctx.clearRect(0, 0, cv.width, cv.height); }
    }
    function run() { if (!running) { running = true; requestAnimationFrame(tick); } }

    function local(el) {
      var h = hero.getBoundingClientRect(), r = el.getBoundingClientRect();
      return { x: r.left - h.left, y: r.top - h.top, w: r.width, h: r.height };
    }

    return {
      sparks: function (el) {
        var b = local(el), cx = b.x + b.w / 2, cy = b.y + b.h / 2;
        for (var i = 0; i < 26; i++) spark(cx, cy);
        run();
      },
      slam: function (titleEl, floorEl) {
        var t = local(titleEl), f = local(floorEl);
        var cx = t.x + t.w / 2;
        // a wall of dust rising from the ground…
        for (var i = 0; i < 70; i++) {
          var x = t.x - t.w * 0.08 + Math.random() * t.w * 1.16;
          puff(x, f.y + rnd(-8, 14), { vx: (x - cx) / t.w * rnd(1.5, 4), vy: rnd(-3.2, -0.6), r: rnd(14, 38) });
        }
        // …and a skirt of it pushed out from under the title
        for (var j = 0; j < 34; j++) {
          var x2 = t.x + Math.random() * t.w;
          puff(x2, t.y + t.h * rnd(0.85, 1), { vx: (x2 - cx) / t.w * rnd(3, 7), vy: rnd(-1.4, 0.4), r: rnd(8, 20), a: 0.5 });
        }
        run();
      }
    };
  })();

  /* ---------------- hero intro ---------------- */
  function heroIntro() {
    var g = window.gsap;
    if (reduced || !g) { root.classList.remove('js-anim'); return; }
    root.classList.add('anim-started');

    var green = $('#fGreen'), red = $('#fRed'), title = $('#heroTitle'),
        impact = $('#impact'), scene = $('#scene'), floor = $('.hero__floor');
    var copy = ['#hook', '#heroSub', '#heroCta'].map(function (s) { return $(s); });

    g.set(green, { x: '-75vw', rotation: -14 });
    g.set(red, { x: '75vw', rotation: 14 });
    g.set(title, { y: -window.innerHeight * 1.1, opacity: 1 });
    g.set(copy, { opacity: 0, y: 24 });
    g.set($$('.fighter__refl'), { scaleY: -1 });
    var hero = $('.hero');
    hero.classList.add('is-fighting');
    root.classList.remove('js-anim');

    var shake = function (amp) {
      g.fromTo(scene, { x: 0, y: 0 }, {
        keyframes: { x: [-amp, amp * 0.9, -amp * 0.6, amp * 0.35, -amp * 0.15, 0], y: [amp * 0.4, -amp * 0.3, amp * 0.2, -amp * 0.1, 0, 0] },
        duration: 0.42, ease: 'none'
      });
    };

    var tl = g.timeline({ delay: 0.35 });
    // 1) the two fighters charge in from both sides
    tl.to(green, { x: 0, rotation: 0, duration: 0.78, ease: 'power3.in' }, 0)
      .to(red, { x: 0, rotation: 0, duration: 0.78, ease: 'power3.in' }, 0)
    // 2) the punch lands
      .add(function () {
        g.fromTo(impact, { opacity: 1, scale: 0.2 }, { opacity: 0, scale: 1.7, duration: 0.5, ease: 'power2.out' });
        Dust.sparks(impact);
        shake(12);
      }, 0.78)
      .to(red, { x: '2.2%', rotation: 3, duration: 0.09, ease: 'power2.out' }, 0.78)
      .to(red, { x: 0, rotation: 0, duration: 0.7, ease: 'elastic.out(1, 0.45)' }, 0.87)
      .to(green, { x: '-0.8%', duration: 0.08, ease: 'power2.out' }, 0.78)
      .to(green, { x: 0, duration: 0.6, ease: 'elastic.out(1, 0.5)' }, 0.86)
    // settled: hand over to the original composite artwork (pixel-identical pose)
      .add(function () { hero.classList.remove('is-fighting'); }, 1.62)
    // 3) the heavy title drops from the sky
      .to(title, { y: 0, duration: 0.55, ease: 'power4.in' }, 1.15)
      .add(function () { Dust.slam(title, floor); shake(16); }, 1.7)
      .fromTo(title, { scaleY: 0.84, scaleX: 1.05, transformOrigin: '50% 100%' },
                     { scaleY: 1, scaleX: 1, duration: 0.6, ease: 'elastic.out(1, 0.4)' }, 1.7)
    // 4) the hook
      .to(copy[0], { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, 2.05)
      .to(copy[1], { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, 2.2)
      .to(copy[2], { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, 2.32)
    // 5) both keep hovering, mid-air, mid-fight
      .add(function () {
        var duo = $('#fDuo');
        g.to($('.fighter__img', duo), { y: -7, duration: 2.1, ease: 'sine.inOut', yoyo: true, repeat: -1 });
        g.to($('.fighter__refl', duo), { y: 7, duration: 2.1, ease: 'sine.inOut', yoyo: true, repeat: -1 });
      }, 2.4);
  }

  if (document.readyState === 'complete') heroIntro();
  else window.addEventListener('load', heroIntro);

  /* ---------------- screenshots tabs ---------------- */
  (function () {
    var tabs = $$('#shots [role="tab"]');
    function select(t, focus) {
      tabs.forEach(function (x) {
        var on = x === t;
        x.setAttribute('aria-selected', on);
        x.tabIndex = on ? 0 : -1;
        $('#' + x.getAttribute('aria-controls')).hidden = !on;
      });
      if (focus) t.focus();
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(t); });
      t.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight') select(tabs[(i + 1) % tabs.length], true);
        if (e.key === 'ArrowLeft') select(tabs[(i - 1 + tabs.length) % tabs.length], true);
      });
    });
  })();

  /* ---------------- ranks ----------------
     Placeholder economy: edit names / entry / win / tools here. */
  var TOOLS = ['Čára', 'Horizontála', 'Vertikála', 'Obdélník', 'EMA', 'Odhalení svíčky'];
  var RANKS = [
    { name: 'Knot',    entry: 10,  win: 20,   off: [],
      tag: 'Tady začíná každý. Všechny nástroje, čitelné grafy a prostor se učit.' },
    { name: 'Jiskra',  entry: 25,  win: 50,   off: ['Obdélník'],
      tag: 'Prvních pár výher. Obdélník už nedostaneš, zóny si drž v hlavě.' },
    { name: 'Plamen',  entry: 50,  win: 100,  off: ['Obdélník', 'Vertikála'],
      tag: 'Grafy začínají klamat. Vertikální čáry zůstávají dole.' },
    { name: 'Žár',     entry: 100, win: 200,  off: ['Obdélník', 'Vertikála', 'Čára'],
      tag: 'Šikmé čáry končí. Zbývá EMA, horizontála a tvůj instinkt.' },
    { name: 'Výheň',   entry: 200, win: 400,  off: ['Obdélník', 'Vertikála', 'Čára', 'EMA'],
      tag: 'Bez EMA. Jedna horizontála a spousta ticha.' },
    { name: 'Legenda', entry: 500, win: 1000, off: TOOLS.slice(),
      tag: 'Žádné nástroje, žádné odhalení. Jen ty a čistý graf.' }
  ];
  (function () {
    var ladder = $('#rankLadder'), panel = $('#rankPanel');
    var heights = [22, 34, 47, 61, 77, 94];
    var fmt = function (n) { return n.toLocaleString('cs-CZ'); };
    var btns = RANKS.map(function (r, i) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'rank'; b.setAttribute('role', 'tab');
      b.id = 'rank-' + i; b.setAttribute('aria-controls', 'rankPanel');
      b.style.setProperty('--h', heights[i] + '%');
      b.innerHTML = '<span class="rank__body"></span><span class="rank__name">' + r.name + '</span>';
      ladder.appendChild(b);
      return b;
    });
    function show(i, focus) {
      var r = RANKS[i];
      btns.forEach(function (b, j) { b.setAttribute('aria-selected', j === i); b.tabIndex = j === i ? 0 : -1; });
      panel.setAttribute('aria-labelledby', 'rank-' + i);
      panel.innerHTML =
        '<div class="rp__top"><p class="rp__name">' + r.name + '</p><span class="rp__lvl">Rank ' + (i + 1) + ' ze ' + RANKS.length + '</span></div>' +
        '<p class="rp__tag">' + r.tag + '</p>' +
        '<dl class="rp__stats"><div><dt>Vstup</dt><dd>' + fmt(r.entry) + ' coins</dd></div>' +
        '<div><dt>Výhra</dt><dd>' + fmt(r.win) + ' coins</dd></div></dl>' +
        '<p class="rp__sub">Nástroje v grafu</p><ul class="tools">' +
        TOOLS.map(function (t) {
          var off = r.off.indexOf(t) > -1;
          return '<li' + (off ? ' class="off"><span class="sr">nedostupné: </span>' : '>') + t + '</li>';
        }).join('') + '</ul>' +
        '<p class="rp__sub">Obtížnost grafu</p><div class="meter" aria-label="Obtížnost ' + (i + 1) + ' ze 6">' +
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

      var btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      var done = function () {
        form.classList.add('is-done');
        say('Jsi na seznamu. Až se brána otevře, dozvíš se to jako první.', true);
      };
      if (!endpoint) {
        // No collector configured yet — keep the address locally so nothing is silently claimed as sent.
        console.warn('[Clash of Candles] Sign-up endpoint is not configured (data-endpoint on #signup). E-mail was not sent anywhere.');
        try { localStorage.setItem('coc_waitlist_email', v); } catch (_) {}
        return done();
      }
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: v, adult: true, source: 'landing-cz', ts: new Date().toISOString() })
      }).then(function (r) {
        if (!r.ok) throw new Error(r.status);
        done();
      }).catch(function () {
        btn.disabled = false;
        say('Zápis se nepovedl, spojení vypadlo. Zkus to prosím za chvíli znovu.');
      });
    });
  })();
})();
