/* Things on the PVD River — shared behaviour
   - scales the 1728px-wide design to the window
   - vertical ripple-light page transition
   - page interactions (landing swap, people states, bird sounds, frequency rows) */
(function () {
  'use strict';

  var DESIGN_W = 1728;
  // On phones/tablets there is no hover: a tap toggles the same effect instead.
  function isHover(e) { return !e || e.pointerType !== 'touch'; }
  var stage = document.querySelector('.stage');
  var zoom = 1;

  /* ---------------- fit the design to the window ---------------- */
  // Phones: everything 1.5x bigger than "fit to width" (page scrolls sideways too).
  // Desktop stays exactly as before.
  var MOBILE_SCALE = 1.5;
  var mobileQuery = window.matchMedia('(max-width: 900px)');
  var baseW = 0;
  function fit() {
    if (!stage) return;
    var mobile = mobileQuery.matches;
    document.documentElement.classList.toggle('is-mobile', mobile);
    // on phones measure the screen once so the extra width doesn't feed back into the size
    if (mobile && !baseW) baseW = Math.min(window.innerWidth, screen.width || window.innerWidth);
    if (!mobile) baseW = document.documentElement.clientWidth;
    else baseW = Math.min(baseW, screen.width || baseW);
    var k = mobile ? MOBILE_SCALE : 1;
    zoom = baseW / DESIGN_W * k;
    stage.style.zoom = zoom;
    // fixed nav / buttons keep their normal (fit-to-screen) size and position on phones
    stage.querySelectorAll('.nav-fixed, .fixed-btn').forEach(function (el) { el.style.zoom = mobile ? 1 / k : ''; });
  }
  fit();
  window.addEventListener('resize', fit);

  function scrollToDesignY(y) {
    window.scrollTo({ top: y * zoom, behavior: 'smooth' });
  }

  document.querySelectorAll('[data-scroll]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      scrollToDesignY(parseFloat(el.getAttribute('data-scroll')) || 0);
    });
  });

  /* ---------------- vertical ripple light transition ---------------- */
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var FRAG = [
    'precision mediump float;',
    'uniform vec2 uRes; uniform float uP; uniform float uT;',
    'float h(float n){return fract(sin(n*127.1)*43758.5453);}',
    'void main(){',
    '  vec2 uv = gl_FragCoord.xy/uRes;',
    '  float rip = sin(uv.y*22.0 + uT*5.0)*0.010 + sin(uv.y*57.0 - uT*7.0)*0.005 + sin(uv.y*9.0 + uT*2.0)*0.008;',
    '  float x = uv.x + rip*(0.5+uP);',
    '  float n = 16.0;',
    '  float id = floor(x*n);',
    '  float f = fract(x*n);',
    '  float delay = h(id)*0.5;',
    '  float lp = clamp((uP - delay)/0.5, 0.0, 1.0);',
    '  lp = lp*lp*(3.0-2.0*lp);',
    '  float d = abs(f-0.5)*2.0;',
    '  float w = lp*1.15;',
    '  float core = 1.0 - smoothstep(w*0.55, w+0.001, d);',
    '  float shimmer = 0.55+0.45*sin(uv.y*80.0 + id*3.1 + uT*9.0);',
    '  float glow = exp(-d*d/(0.015+w*w*0.6))*smoothstep(0.0,0.25,lp);',
    '  float a = clamp(max(core, glow*0.85), 0.0, 1.0);',
    '  a = max(a, smoothstep(0.85, 1.0, uP));',
    '  vec3 base = vec3(0.94,0.965,1.0);',
    '  vec3 tint = vec3(0.68,0.78,0.90);',
    '  vec3 col = mix(tint, base, core);',
    '  col = mix(col, vec3(1.0), glow*0.75*shimmer*(1.0-core*0.6));',
    '  gl_FragColor = vec4(col*a, a);',
    '}'
  ].join('\n');
  var VERT = 'attribute vec2 p; void main(){ gl_Position = vec4(p,0.0,1.0); }';

  function makeOverlay() {
    var c = document.createElement('canvas');
    c.id = 'tr';
    var gl = null;
    if (!reduceMotion) {
      try { gl = c.getContext('webgl', { premultipliedAlpha: true, alpha: true }); } catch (e) { gl = null; }
    }
    if (!gl) {
      var d = document.createElement('div');
      d.id = 'tr';
      d.className = 'tr-fallback';
      document.body.appendChild(d);
      return {
        el: d,
        draw: function (p) { d.style.transition = 'none'; d.style.opacity = String(p); },
        remove: function () { d.remove(); }
      };
    }
    function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
    var prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var uRes = gl.getUniformLocation(prog, 'uRes');
    var uP = gl.getUniformLocation(prog, 'uP');
    var uT = gl.getUniformLocation(prog, 'uT');
    var t0 = performance.now();
    function size() {
      var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      c.width = Math.round(window.innerWidth * dpr);
      c.height = Math.round(window.innerHeight * dpr);
      gl.viewport(0, 0, c.width, c.height);
    }
    document.body.appendChild(c);
    size();
    return {
      el: c,
      draw: function (p) {
        gl.uniform2f(uRes, c.width, c.height);
        gl.uniform1f(uP, p);
        gl.uniform1f(uT, (performance.now() - t0) / 1000);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      },
      remove: function () { c.remove(); }
    };
  }

  function animate(ov, from, to, ms, done) {
    var start = performance.now();
    function frame(now) {
      var k = Math.min(1, (now - start) / ms);
      var e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      ov.draw(from + (to - from) * e);
      if (k < 1) requestAnimationFrame(frame); else if (done) done();
    }
    requestAnimationFrame(frame);
  }

  var leaving = false;
  function go(href) {
    if (leaving) return;
    leaving = true;
    var ov = makeOverlay();
    ov.el.classList.add('cover');
    animate(ov, 0, 1, reduceMotion ? 250 : 850, function () {
      try { sessionStorage.setItem('pvd-tr', '1'); } catch (e) {}
      window.location.href = href;
    });
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href');
    if (!href || href.charAt(0) === '#' || a.target === '_blank' || /^[a-z]+:/i.test(href)) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    go(href);
  });

  function reveal() {
    var pending = document.documentElement.classList.contains('tr-pending');
    if (!pending) return;
    var ov = makeOverlay();
    ov.draw(1);
    document.documentElement.classList.remove('tr-pending');
    setTimeout(function () {
      animate(ov, 1, 0, reduceMotion ? 250 : 950, function () { ov.remove(); });
    }, 60);
  }
  reveal();

  window.addEventListener('pageshow', function (e) {
    if (e.persisted) {
      leaving = false;
      var old = document.getElementById('tr');
      if (old) old.remove();
    }
  });

  /* ---------------- landing: smart animate to "after hover" while hovering ---------------- */
  if (stage && stage.classList.contains('landing')) {
    var locked = false;
    function setEase(name) {
      stage.classList.toggle('ease-bouncy', name === 'bouncy');
    }
    function lockAfter(animated) {
      locked = true;
      if (!animated) {
        stage.classList.add('no-anim');
        stage.classList.add('is-b');
        void stage.offsetWidth;
        stage.classList.remove('no-anim');
      } else {
        stage.classList.add('is-b');
      }
    }
    if (location.hash === '#after') lockAfter(false);
    stage.querySelectorAll('[data-swap]').forEach(function (el) {
      el.addEventListener('pointerenter', function (e) {
        if (locked || !isHover(e)) return;
        setEase(el.getAttribute('data-ease'));
        stage.classList.add('is-b');
      });
      el.addEventListener('pointerleave', function (e) {
        if (locked || !isHover(e)) return;
        setEase(el.getAttribute('data-ease'));
        stage.classList.remove('is-b');
      });
      el.addEventListener('pointerup', function (e) {     // touch: tap to switch back and forth
        if (locked || isHover(e)) return;
        setEase(el.getAttribute('data-ease'));
        stage.classList.toggle('is-b');
      });
    });
  }

  /* ---------------- people: sticky river section + symbol hovers ---------------- */
  if (stage && stage.classList.contains('people')) {
    var sec = stage.querySelector('.river-sec');
    var box = stage.querySelector('.river-sticky');
    var group = stage.querySelector('.river-group');
    var track = stage.querySelector('.river-track');
    var syms = stage.querySelector('.syms');
    var CONTENT_TOP = 1498, CONTENT_H = 633, RIVER_END = 3238;
    var TOGETHER = 260;   // scroll distance (design px) the river first stays with the text
    var EARLY = 400;      // release the group this much earlier -> more space above the 1997 section
    var S0 = 0, RMAX = 0;
    function layoutRiver() {
      var vh = window.innerHeight / zoom;                         // viewport height in design px
      S0 = Math.round(CONTENT_TOP + CONTENT_H / 2 - vh / 2);      // group pins when the symbols are centred
      RMAX = Math.max(0, Math.round(RIVER_END - S0 - vh * 0.75 - EARLY)); // river travel before both slide out
      sec.style.top = S0 + 'px';
      sec.style.height = (TOGETHER + RMAX + vh) + 'px';          // after this the whole group scrolls away
      box.style.height = vh + 'px';
      group.style.top = (-S0) + 'px';                             // children use page coordinates
      moveRiver();
    }
    function moveRiver() {
      var y = window.scrollY / zoom;
      var p = Math.min(RMAX, Math.max(0, y - S0 - TOGETHER));
      // river + its icons move as one container; text/symbols stay pinned
      track.style.transform = 'translate3d(0,' + (-p) + 'px,0)';
    }
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return; ticking = true;
      requestAnimationFrame(function () { ticking = false; moveRiver(); });
    }, { passive: true });
    window.addEventListener('resize', function () { requestAnimationFrame(layoutRiver); });
    layoutRiver();

    var ovs = stage.querySelectorAll('.river-sec .ov');
    function showState(s) {
      ovs.forEach(function (o) { o.classList.toggle('on', o.getAttribute('data-band') === s); });
      syms.classList.toggle('has-state', !!s);
    }
    stage.querySelectorAll('[data-state]').forEach(function (el) {
      var s = el.getAttribute('data-state');
      el.addEventListener('pointerenter', function (e) { if (isHover(e)) showState(s); });   // Figma: while hovering
      el.addEventListener('pointerleave', function (e) { if (isHover(e)) showState(null); });
      el.addEventListener('pointerup', function (e) {     // touch: tap to show, tap again to hide
        if (isHover(e)) return;
        var on = syms.classList.contains('has-state') && stage.querySelector('.river-sec .ov.on[data-band="' + s + '"]');
        showState(on ? null : s);
      });
    });
  }

  /* ---------------- birds: hover a bird to see it and hear it ---------------- */
  if (stage && stage.classList.contains('birds')) {
    var soundOn = false;
    var sounds = {};
    var toggle = document.querySelector('.sound-toggle');
    var label = toggle && toggle.querySelector('.label');

    function setSound(on) {
      soundOn = on;
      if (toggle) {
        toggle.classList.toggle('on', on);
        toggle.setAttribute('aria-pressed', on ? 'true' : 'false');
        label.textContent = on ? 'Bird sounds on' : 'Click to turn on bird sounds';
      }
      if (!on) Object.keys(sounds).forEach(function (k) { sounds[k].pause(); });
    }
    function snd(key) {
      if (!sounds[key]) {
        var a = new Audio('assets/sounds/' + key + '.mp3?v=' + Date.now());
        a.preload = 'auto';
        sounds[key] = a;
      }
      return sounds[key];
    }
    function play(key) {
      if (!soundOn) return;
      var a = snd(key);
      if (a._fade) { clearInterval(a._fade); a._fade = null; }
      a.volume = 1;
      try { a.currentTime = 0; } catch (e) {}
      var pr = a.play();
      if (pr && pr.catch) pr.catch(function () {});
    }
    function stop(key) {
      var a = sounds[key];
      if (!a || a.paused) return;
      if (a._fade) clearInterval(a._fade);
      a._fade = setInterval(function () {
        a.volume = Math.max(0, a.volume - 0.1);
        if (a.volume <= 0.01) { clearInterval(a._fade); a._fade = null; a.pause(); }
      }, 40);
    }

    if (toggle) {
      toggle.addEventListener('click', function (e) { e.stopPropagation(); setSound(!soundOn); });
    }
    // the first click anywhere also turns sound on (browsers need one click before playing audio)
    document.addEventListener('pointerdown', function first(e) {
      if (toggle && toggle.contains(e.target)) return;
      if (!soundOn) setSound(true);
      document.removeEventListener('pointerdown', first);
    });

    stage.querySelectorAll('.bird').forEach(function (b) {
      var key = b.getAttribute('data-bird');
      b.addEventListener('pointerenter', function (e) { if (!isHover(e)) return; b.classList.add('on'); play(key); });
      b.addEventListener('pointerleave', function (e) { if (!isHover(e)) return; b.classList.remove('on'); stop(key); });
      b.addEventListener('click', function () {
        if (!soundOn) setSound(true);
        // touch: the tapped bird shows its photo and plays; other birds go back to outlines
        stage.querySelectorAll('.bird.on').forEach(function (o) { if (o !== b) { o.classList.remove('on'); stop(o.getAttribute('data-bird')); } });
        b.classList.add('on');
        play(key);
      });
    });
    setSound(false);
  }

  /* ---------------- frequency: hover a species row ---------------- */
  if (stage && stage.classList.contains('freq')) {
    var current = null;
    function setRow(i) {
      if (current === i) return;
      current = i;
      stage.querySelectorAll('[data-row]').forEach(function (el) {
        el.classList.toggle('on', i !== null && el.getAttribute('data-row') === String(i));
      });
    }
    stage.querySelectorAll('.row-hit').forEach(function (el) {
      var i = el.getAttribute('data-hit');
      el.addEventListener('pointerenter', function (e) { if (isHover(e)) setRow(i); });
      el.addEventListener('click', function () { setRow(i); });
    });
    var area = stage.querySelector('.rows-area');
    if (area) area.addEventListener('pointerleave', function (e) { if (isHover(e)) setRow(null); });
  }
})();
