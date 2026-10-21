/* Clash of Candles — 3D arena mark in the hero. Tiny WebGL extruder, no dependencies. */
(function () {
  'use strict';
  var cv = document.getElementById('mark3d');
  if (!cv) return;
  var gl = cv.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: true });
  if (!gl) { cv.classList.add('is-off'); return; }

  // logo outline (566 × 745, same geometry as logo-mark.svg) + precomputed cap triangles
  var HALVES = [
    { p: [232,0,189,22,189,57,0,192,0,551,197,702,232,684,232,552,154,493,154,251,232,192],
      t: [1,0,10,8,7,6,6,5,4,4,3,2,2,1,10,8,6,4,2,10,9,9,8,4,4,2,9] },
    { p: [375,57,333,71,333,192,411,251,411,493,333,552,333,743,375,722,375,696,565,551,565,192],
      t: [1,0,10,10,9,8,8,7,6,6,5,4,3,2,1,10,8,6,3,1,10,10,6,4,4,3,10] }
  ];
  var S = 1 / 745, CX = 283, CY = 372.5, D = 0.16; // unit height, depth 16 % of height

  var pos = [], nrm = [];
  function push(x, y, z, nx, ny, nz) { pos.push(x, y, z); nrm.push(nx, ny, nz); }
  HALVES.forEach(function (h) {
    var n = h.p.length / 2, v = [], area = 0, i;
    for (i = 0; i < n; i++) v.push([(h.p[2 * i] - CX) * S, (CY - h.p[2 * i + 1]) * S]);
    for (i = 0; i < n; i++) { var a = v[i], b = v[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
    var o = area > 0 ? 1 : -1; // outward side of each edge
    h.t.forEach(function (k) { push(v[k][0], v[k][1], D / 2, 0, 0, 1); });
    h.t.forEach(function (k) { push(v[k][0], v[k][1], -D / 2, 0, 0, -1); });
    for (i = 0; i < n; i++) {
      var p = v[i], q = v[(i + 1) % n], ex = q[0] - p[0], ey = q[1] - p[1], l = Math.hypot(ex, ey);
      var nx = o * ey / l, ny = -o * ex / l, f = D / 2;
      [[p, f], [q, f], [q, -f], [p, f], [q, -f], [p, -f]].forEach(function (c) { push(c[0][0], c[0][1], c[1], nx, ny, 0); });
    }
  });
  var COUNT = pos.length / 3;

  function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
  var prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER,
    'attribute vec3 aP;attribute vec3 aN;uniform mat4 uM;uniform mat4 uPV;varying vec3 vN;varying vec3 vW;' +
    'void main(){vec4 w=uM*vec4(aP,1.);vW=w.xyz;vN=mat3(uM)*aN;gl_Position=uPV*w;}'));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER,
    'precision mediump float;varying vec3 vN;varying vec3 vW;uniform vec3 uEye;uniform float uA;' +
    'void main(){vec3 n=normalize(vN);vec3 v=normalize(uEye-vW);' +
    'vec3 base=vec3(.047,.18,.24);vec3 cyan=vec3(.49,.94,.97);' +
    'vec3 k=normalize(vec3(.45,.65,.75));vec3 r=normalize(vec3(-.8,.25,-.45));' +
    'float dk=max(dot(n,k),0.);float dr=max(dot(n,r),0.);' +
    'float sk=pow(max(dot(n,normalize(k+v)),0.),48.);' +
    'float fr=pow(1.-max(dot(n,v),0.),3.);' +
    'vec3 amb=mix(vec3(.02,.06,.08),cyan*.35,n.y*.5+.5);' +
    'vec3 c=base*(.5+.75*dk)+amb*.22+cyan*(dr*.5+fr*.35)+vec3(1.)*sk*.6;' +
    'gl_FragColor=vec4(c*uA,uA);}'));
  gl.linkProgram(prog); gl.useProgram(prog);

  function buf(data, loc) {
    var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    var a = gl.getAttribLocation(prog, loc); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 3, gl.FLOAT, false, 0, 0);
  }
  buf(pos, 'aP'); buf(nrm, 'aN');
  var uM = gl.getUniformLocation(prog, 'uM'), uPV = gl.getUniformLocation(prog, 'uPV'),
      uEye = gl.getUniformLocation(prog, 'uEye'), uA = gl.getUniformLocation(prog, 'uA');
  gl.enable(gl.DEPTH_TEST); gl.clearColor(0, 0, 0, 0);

  var EYE = 2.45;
  function persp(aspect) {
    var f = 1 / Math.tan(15 * Math.PI / 180), nr = 0.1, fa = 10;
    // perspective × translate(0,0,-EYE)
    return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (fa + nr) / (nr - fa), -1, 0, 0, 2 * fa * nr / (nr - fa) - EYE * (fa + nr) / (nr - fa), EYE];
  }
  function rot(rx, ry) {
    var cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry);
    return [cy, sx * sy, -cx * sy, 0, 0, cx, sx, 0, sy, -sx * cy, cx * cy, 0, 0, 0, 0, 1];
  }

  var w = 0, h = 0;
  function size() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.round(cv.clientWidth * dpr); h = Math.round(cv.clientHeight * dpr);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    gl.viewport(0, 0, w, h);
  }
  if (window.ResizeObserver) new ResizeObserver(size).observe(cv); else window.addEventListener('resize', size);
  size();

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var mx = 0, tmx = 0;
  window.addEventListener('pointermove', function (e) { tmx = (e.clientX / window.innerWidth - 0.5) * 2; }, { passive: true });

  function draw(t) {
    if (!w || !h) return;
    mx += (tmx - mx) * 0.05;
    var ry = reduced ? 0.42 : Math.sin(t * 0.00045) * 0.6 + mx * 0.25;
    var rx = reduced ? -0.08 : -0.08 + Math.sin(t * 0.00031) * 0.06;
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniformMatrix4fv(uM, false, rot(rx, ry));
    gl.uniformMatrix4fv(uPV, false, persp(w / h));
    gl.uniform3f(uEye, 0, 0, EYE);
    gl.uniform1f(uA, 1);
    gl.drawArrays(gl.TRIANGLES, 0, COUNT);
  }

  var visible = true, running = false;
  function loop(t) { if (!visible) { running = false; return; } draw(t); requestAnimationFrame(loop); }
  function start() { if (!running && !reduced) { running = true; requestAnimationFrame(loop); } }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) start(); }).observe(cv);
  }
  if (reduced) draw(0); else start();
})();
