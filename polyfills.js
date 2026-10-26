/* Polyfills for Stremio v4 shell on old Tizen Chromium (M47/M56). ES5 only — this file must parse on the TV itself. */
(function () {
  'use strict';

  // ---- Object.values / entries / fromEntries (Chromium 54+) ----
  if (!Object.values) {
    Object.values = function (o) {
      var out = [];
      for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) out.push(o[k]);
      return out;
    };
  }
  if (!Object.entries) {
    Object.entries = function (o) {
      var out = [];
      for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) out.push([k, o[k]]);
      return out;
    };
  }
  if (!Object.fromEntries) {
    Object.fromEntries = function (iter) {
      var o = {};
      var arr = Array.isArray(iter) ? iter : Array.from(iter);
      for (var i = 0; i < arr.length; i++) o[arr[i][0]] = arr[i][1];
      return o;
    };
  }

  // ---- Promise.prototype.finally (Chromium 63+) ----
  if (typeof Promise !== 'undefined' && !Promise.prototype['finally']) {
    Promise.prototype['finally'] = function (cb) {
      var P = this.constructor || Promise;
      return this.then(
        function (v) { return P.resolve(cb()).then(function () { return v; }); },
        function (e) { return P.resolve(cb()).then(function () { throw e; }); }
      );
    };
  }

  // ---- Array.prototype.includes / flat / flatMap ----
  if (!Array.prototype.includes) {
    Array.prototype.includes = function (x) { return this.indexOf(x) !== -1; };
  }
  if (!Array.prototype.flat) {
    Array.prototype.flat = function (depth) {
      depth = depth === undefined ? 1 : depth;
      var out = [];
      (function go(a, d) {
        for (var i = 0; i < a.length; i++) {
          if (Array.isArray(a[i]) && d > 0) go(a[i], d - 1); else out.push(a[i]);
        }
      })(this, depth);
      return out;
    };
  }
  if (!Array.prototype.flatMap) {
    Array.prototype.flatMap = function (fn, thisArg) { return this.map(fn, thisArg).flat(1); };
  }

  // ---- String padStart / padEnd ----
  function pad(str, len, fill, start) {
    str = String(str); fill = fill === undefined ? ' ' : String(fill);
    if (str.length >= len || fill === '') return str;
    var p = ''; while (p.length < len - str.length) p += fill;
    p = p.slice(0, len - str.length);
    return start ? p + str : str + p;
  }
  if (!String.prototype.padStart) String.prototype.padStart = function (l, f) { return pad(this, l, f, true); };
  if (!String.prototype.padEnd) String.prototype.padEnd = function (l, f) { return pad(this, l, f, false); };

  // ---- misc globals ----
  if (typeof globalThis === 'undefined') { try { window.globalThis = window; } catch (e) {} }
  if (!Number.isInteger) Number.isInteger = function (v) { return typeof v === 'number' && isFinite(v) && Math.floor(v) === v; };

  // ---- on-screen diagnostics: UA for 12s, first JS errors stay until BACK/RETURN ----
  function overlay() {
    var box = document.getElementById('__tb_diag');
    if (box) return box;
    box = document.createElement('div');
    box.id = '__tb_diag';
    box.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:2147483647;background:rgba(0,0,0,.85);color:#fff;' +
      'font:16px/1.3 monospace;padding:8px 14px;max-height:45%;overflow:hidden;white-space:pre-wrap;word-break:break-all;';
    (document.body || document.documentElement).appendChild(box);
    return box;
  }
  function show(msg, sticky) {
    try {
      var b = overlay();
      b.textContent += (b.textContent ? '\n' : '') + msg;
      if (!sticky) setTimeout(function () { if (b.parentNode && !b.getAttribute('data-sticky')) b.parentNode.removeChild(b); }, 12000);
      else b.setAttribute('data-sticky', '1');
    } catch (e) {}
  }
  var errors = 0;
  window.addEventListener('error', function (ev) {
    if (!ev || !ev.message) return; // resource load errors (img/css) are not JS errors
    if (errors++ > 5) return;
    var e = ev.error;
    show('JS ERROR: ' + (ev.message || e) + '\n  at ' + (ev.filename || '?') + ':' + ev.lineno + ':' + ev.colno +
      (e && e.stack ? '\n  ' + String(e.stack).split('\n').slice(0, 3).join('\n  ') : ''), true);
  }, true);
  window.addEventListener('unhandledrejection', function (ev) {
    if (errors++ > 5) return;
    var r = ev.reason;
    show('UNHANDLED PROMISE: ' + (r && r.message ? r.message : r), true);
  });
  window.addEventListener('keydown', function (ev) {
    if (ev.keyCode === 10009 || ev.keyCode === 27 || ev.keyCode === 8) { // Tizen RETURN / Esc / Backspace
      var b = document.getElementById('__tb_diag'); if (b && b.parentNode) b.parentNode.removeChild(b);
    }
  }, true);
  function ready() { show('Stremio v4 + polyfills | ' + navigator.userAgent, false); }
  if (document.body) ready(); else document.addEventListener('DOMContentLoaded', ready);
})();

/* ---- Web API polyfills missing in Chromium 47 (Tizen 3.0) ---- */
(function () {
  'use strict';

  // URLSearchParams (Chromium 49) + URL.prototype.searchParams (51)
  if (typeof URLSearchParams === 'undefined') {
    var enc = function (s) { return encodeURIComponent(s).replace(/%20/g, '+'); };
    var dec = function (s) { return decodeURIComponent(String(s).replace(/\+/g, ' ')); };
    var USP = function (init) {
      this._l = [];
      if (!init) return;
      if (typeof init === 'string') {
        var q = init.charAt(0) === '?' ? init.slice(1) : init;
        if (q) q.split('&').forEach(function (p) {
          var i = p.indexOf('='); if (i < 0) i = p.length;
          this._l.push([dec(p.slice(0, i)), dec(p.slice(i + 1))]);
        }, this);
      } else if (init instanceof USP) { this._l = init._l.slice(); }
      else if (Array.isArray(init)) { init.forEach(function (kv) { this._l.push([String(kv[0]), String(kv[1])]); }, this); }
      else if (typeof init === 'object') { Object.keys(init).forEach(function (k) { this._l.push([k, String(init[k])]); }, this); }
    };
    USP.prototype = {
      append: function (k, v) { this._l.push([String(k), String(v)]); },
      'delete': function (k) { this._l = this._l.filter(function (kv) { return kv[0] !== k; }); },
      get: function (k) { for (var i = 0; i < this._l.length; i++) if (this._l[i][0] === k) return this._l[i][1]; return null; },
      getAll: function (k) { return this._l.filter(function (kv) { return kv[0] === k; }).map(function (kv) { return kv[1]; }); },
      has: function (k) { return this.get(k) !== null; },
      set: function (k, v) { var done = false; this._l = this._l.filter(function (kv) { if (kv[0] !== k) return true; if (done) return false; done = true; kv[1] = String(v); return true; }); if (!done) this._l.push([String(k), String(v)]); },
      sort: function () { this._l.sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; }); },
      forEach: function (cb, thisArg) { this._l.forEach(function (kv) { cb.call(thisArg, kv[1], kv[0], this); }, this); },
      keys: function () { return this._l.map(function (kv) { return kv[0]; })[Symbol.iterator](); },
      values: function () { return this._l.map(function (kv) { return kv[1]; })[Symbol.iterator](); },
      entries: function () { return this._l.map(function (kv) { return [kv[0], kv[1]]; })[Symbol.iterator](); },
      toString: function () { return this._l.map(function (kv) { return enc(kv[0]) + '=' + enc(kv[1]); }).join('&'); }
    };
    USP.prototype[Symbol.iterator] = USP.prototype.entries;
    window.URLSearchParams = USP;
  }
  if (typeof URL !== 'undefined' && !('searchParams' in URL.prototype)) {
    Object.defineProperty(URL.prototype, 'searchParams', {
      get: function () {
        var self = this, sp = new URLSearchParams(this.search), orig = sp.toString();
        // keep URL.search in sync after mutations
        ['append', 'delete', 'set', 'sort'].forEach(function (m) {
          var f = sp[m]; sp[m] = function () { var r = f.apply(sp, arguments); var s = sp.toString(); self.search = s ? '?' + s : ''; return r; };
        });
        return sp;
      }
    });
  }

  // AbortController / AbortSignal (Chromium 66) — minimal, fetch() ignores the signal but code using it won't crash
  if (typeof AbortController === 'undefined') {
    var Sig = function () { this.aborted = false; this.onabort = null; this._ls = []; };
    Sig.prototype.addEventListener = function (t, f) { if (t === 'abort') this._ls.push(f); };
    Sig.prototype.removeEventListener = function (t, f) { this._ls = this._ls.filter(function (x) { return x !== f; }); };
    Sig.prototype.dispatchEvent = function (ev) { this._ls.forEach(function (f) { f(ev); }); if (this.onabort) this.onabort(ev); };
    var AC = function () { this.signal = new Sig(); };
    AC.prototype.abort = function () { if (this.signal.aborted) return; this.signal.aborted = true; this.signal.dispatchEvent({ type: 'abort', target: this.signal }); };
    window.AbortSignal = Sig; window.AbortController = AC;
  }

  // NodeList.forEach (51), ChildNode.append/prepend/replaceWith (54)
  if (typeof NodeList !== 'undefined' && !NodeList.prototype.forEach) NodeList.prototype.forEach = Array.prototype.forEach;
  if (typeof HTMLCollection !== 'undefined' && !HTMLCollection.prototype.forEach) HTMLCollection.prototype.forEach = Array.prototype.forEach;
  function toNodes(args) {
    var frag = document.createDocumentFragment();
    for (var i = 0; i < args.length; i++) frag.appendChild(args[i] instanceof Node ? args[i] : document.createTextNode(String(args[i])));
    return frag;
  }
  [Element.prototype, Document.prototype, DocumentFragment.prototype].forEach(function (p) {
    if (!p.append) p.append = function () { this.appendChild(toNodes(arguments)); };
    if (!p.prepend) p.prepend = function () { this.insertBefore(toNodes(arguments), this.firstChild); };
  });
  [Element.prototype, CharacterData.prototype, DocumentType.prototype].forEach(function (p) {
    if (!p.replaceWith) p.replaceWith = function () { if (this.parentNode) this.parentNode.replaceChild(toNodes(arguments), this); };
    if (!p.remove) p.remove = function () { if (this.parentNode) this.parentNode.removeChild(this); };
  });

  // Object.getOwnPropertyDescriptors (54)
  if (!Object.getOwnPropertyDescriptors) {
    Object.getOwnPropertyDescriptors = function (o) {
      var out = {}, keys = Object.getOwnPropertyNames(o).concat(Object.getOwnPropertySymbols ? Object.getOwnPropertySymbols(o) : []);
      keys.forEach(function (k) { out[k] = Object.getOwnPropertyDescriptor(o, k); });
      return out;
    };
  }

  // Reflect (49)
  if (typeof Reflect === 'undefined') {
    window.Reflect = {
      apply: function (f, t, a) { return Function.prototype.apply.call(f, t, a); },
      construct: function (C, a, N) { var o = Object.create((N || C).prototype); var r = C.apply(o, a); return (r !== null && typeof r === 'object') ? r : o; },
      get: function (o, k, r) { var d = Object.getOwnPropertyDescriptor(o, k); if (d && d.get) return d.get.call(r === undefined ? o : r); return o[k]; },
      set: function (o, k, v, r) { try { o[k] = v; return true; } catch (e) { return false; } },
      has: function (o, k) { return k in o; },
      ownKeys: function (o) { return Object.getOwnPropertyNames(o).concat(Object.getOwnPropertySymbols ? Object.getOwnPropertySymbols(o) : []); },
      defineProperty: function (o, k, d) { try { Object.defineProperty(o, k, d); return true; } catch (e) { return false; } },
      deleteProperty: function (o, k) { try { return delete o[k]; } catch (e) { return false; } },
      getPrototypeOf: function (o) { return Object.getPrototypeOf(o); },
      setPrototypeOf: function (o, p) { try { Object.setPrototypeOf(o, p); return true; } catch (e) { return false; } },
      getOwnPropertyDescriptor: function (o, k) { return Object.getOwnPropertyDescriptor(o, k); },
      isExtensible: function (o) { return Object.isExtensible(o); },
      preventExtensions: function (o) { Object.preventExtensions(o); return true; }
    };
  }

  // String.prototype.matchAll (73), Array.prototype.findLast/findLastIndex (97)
  if (!String.prototype.matchAll) {
    String.prototype.matchAll = function (re) {
      if (!(re instanceof RegExp)) re = new RegExp(re, 'g');
      if (re.flags.indexOf('g') < 0) throw new TypeError('matchAll requires a global RegExp');
      var r = new RegExp(re.source, re.flags), s = String(this), out = [], m;
      while ((m = r.exec(s)) !== null) { out.push(m); if (m[0] === '') r.lastIndex++; }
      return out[Symbol.iterator]();
    };
  }
  if (!Array.prototype.findLast) {
    Array.prototype.findLast = function (fn, t) { for (var i = this.length - 1; i >= 0; i--) if (fn.call(t, this[i], i, this)) return this[i]; return undefined; };
    Array.prototype.findLastIndex = function (fn, t) { for (var i = this.length - 1; i >= 0; i--) if (fn.call(t, this[i], i, this)) return i; return -1; };
  }
  if (!String.prototype.trimStart) { String.prototype.trimStart = function () { return this.replace(/^\s+/, ''); }; String.prototype.trimEnd = function () { return this.replace(/\s+$/, ''); }; }
  if (!Promise.allSettled) Promise.allSettled = function (ps) { return Promise.all(Array.from(ps).map(function (p) { return Promise.resolve(p).then(function (v) { return { status: 'fulfilled', value: v }; }, function (e) { return { status: 'rejected', reason: e }; }); })); };
  if (typeof queueMicrotask === 'undefined') window.queueMicrotask = function (f) { Promise.resolve().then(f); };
  if (typeof Symbol !== 'undefined' && !Symbol.asyncIterator) Symbol.asyncIterator = Symbol('Symbol.asyncIterator');

  // KeyboardEvent.key (51): derive from keyCode for the keys a TV UI cares about
  if (typeof KeyboardEvent !== 'undefined' && !('key' in KeyboardEvent.prototype)) {
    var keyMap = { 8: 'Backspace', 9: 'Tab', 13: 'Enter', 27: 'Escape', 32: ' ', 37: 'ArrowLeft', 38: 'ArrowUp', 39: 'ArrowRight', 40: 'ArrowDown', 10009: 'Escape', 415: 'MediaPlay', 19: 'MediaPause', 10252: 'MediaPlayPause', 413: 'MediaStop', 417: 'MediaFastForward', 412: 'MediaRewind' };
    Object.defineProperty(KeyboardEvent.prototype, 'key', {
      get: function () { var c = this.keyCode || this.which; if (keyMap[c]) return keyMap[c]; if (c >= 48 && c <= 90) return String.fromCharCode(c).toLowerCase(); return 'Unidentified'; }
    });
  }
})();

/* ---- TV integration: viewport scale + Samsung RETURN key -> Escape ---- */
(function () {
  'use strict';
  // The Tizen TV webview ignores <meta viewport> (always 1920x1080). Lay the app out at a smaller
  // width and scale it up with a transform so the UI is bigger and fits exactly. Tune window.__tvWidth.
  var tvWidth = window.__tvWidth || 1280;
  function applyScale() {
    var W = window.innerWidth || 1920, H = window.innerHeight || 1080, k = W / tvWidth;
    window.__scaleK = k;
    var css = 'html{overflow:hidden!important;background:#0c0c0c}' +
      'body{width:' + tvWidth + 'px!important;height:' + Math.round(H / k) + 'px!important;overflow:hidden!important;' +
      'transform:scale(' + k + ')!important;-webkit-transform:scale(' + k + ')!important;transform-origin:0 0!important;-webkit-transform-origin:0 0!important;margin:0!important}';
    var st = document.getElementById('__tv_scale') || document.createElement('style');
    st.id = '__tv_scale'; st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  }
  if (document.head) applyScale(); else document.addEventListener('DOMContentLoaded', applyScale);
  window.addEventListener('resize', applyScale);

  // Chromium 47 has no CSS custom properties: swap the shell stylesheet for a copy with var() pre-resolved.
  var CSS_FIX = window.__cssFixUrl || 'http://192.168.101.38:8099/blob.es5.css';
  function swapCss() {
    var links = document.querySelectorAll('link[rel="stylesheet"]');
    for (var i = 0; i < links.length; i++) {
      if (/blob\.css/.test(links[i].getAttribute('href') || '') && links[i].getAttribute('data-fixed') !== '1') {
        links[i].setAttribute('data-fixed', '1');
        links[i].href = CSS_FIX + '?t=' + Date.now();
      }
    }
  }
  if (document.readyState !== 'loading') swapCss(); else document.addEventListener('DOMContentLoaded', swapCss);

  // The shell never registers the sidebar (#navbar) and top bar as spatial-navigation sections,
  // so the remote can't reach Home/Discover/Library/Settings, Search or the user icon. Register them.
  var navTries = 0;
  function addNavSections() {
    var SN = window.SpatialNavigation;
    if (!SN || !document.querySelector('#navbar .tab')) { if (navTries++ < 200) return setTimeout(addNavSections, 250); return; }
    try { SN.remove('navbar'); } catch (e) {}
    try { SN.remove('topbar'); } catch (e) {}
    SN.add({ id: 'navbar', selector: '#navbar .tab', straightOnly: false, enterTo: 'last-focused' });
    SN.add({ id: 'topbar', selector: '#topbar [tabindex], #search-bar [tabindex], #global-search-field', straightOnly: false, enterTo: 'last-focused' });
    try { SN.enable('navbar'); SN.enable('topbar'); } catch (e) {}
  }
  addNavSections();

  // Login/intro screen: its inputs and buttons are mouse-only in the shell (no tabindex, no section).
  // While it is visible, make them focusable, register a self-contained section and land the focus inside.
  var introActive = false;
  function introVisible() {
    var m = document.getElementById('introModal') || document.getElementById('intro');
    if (!m) return false;
    var r = m.getBoundingClientRect(), s = getComputedStyle(m);
    return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden';
  }
  function watchIntro() {
    var SN = window.SpatialNavigation;
    if (SN) {
      var vis = introVisible();
      if (vis) {
        var els = document.querySelectorAll('#intro input, #intro button, #intro .button, #intro .acc, #intro .accept, #intro a.accept-link, #intro .pres [ng-click]');
        for (var i = 0; i < els.length; i++) if (!els[i].hasAttribute('tabindex')) els[i].setAttribute('tabindex', '-1');
        if (!introActive) {
          try { SN.remove('intro'); } catch (e) {}
          SN.add({ id: 'intro', selector: '#intro [tabindex]', restrict: 'self-only', enterTo: 'last-focused' });
          try { SN.enable('intro'); } catch (e) {}
          introActive = true;
        }
        var a = document.activeElement;
        if (!a || !document.getElementById('intro').contains(a)) { try { SN.focus('intro'); } catch (e) {} }
      } else if (introActive) {
        try { SN.disable('intro'); SN.remove('intro'); } catch (e) {}
        introActive = false;
      }
    }
    setTimeout(watchIntro, 500);
  }
  watchIntro();
  // Inside login inputs keymaster ignores keys (input filter): handle up/down ourselves, and make the
  // TV keyboard's Done (Enter) jump to the next field instead of submitting a half-filled form.
  function introInputKey(e) {
    var a = document.activeElement, intro = document.getElementById('intro');
    if (!a || a.tagName !== 'INPUT' || !intro || !intro.contains(a)) return;
    var SN = window.SpatialNavigation;
    if (e.keyCode === 40 || e.keyCode === 38) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.type === 'keydown' && SN) SN.move(e.keyCode === 40 ? 'down' : 'up');
    } else if (e.keyCode === 13 && e.type === 'keyup') {
      // Don't touch keydown: cancelling Enter while the IME is composing discards the typed text.
      var inputs = introInputs(intro), idx = inputs.indexOf(a);
      if (idx > -1 && idx < inputs.length - 1) { var next = inputs[idx + 1]; setTimeout(function () { next.focus(); }, 250); }
    }
  }
  function introInputs(intro) {
    return [].slice.call(intro.querySelectorAll('input')).filter(function (i) { var r = i.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
  }
  ['keydown', 'keyup'].forEach(function (t) { window.addEventListener(t, introInputKey, true); });
  // Enter in a non-last field would submit the form: swallow that submit, keep the IME commit.
  document.addEventListener('submit', function (e) {
    var a = document.activeElement, intro = document.getElementById('intro');
    if (!a || a.tagName !== 'INPUT' || !intro || !intro.contains(a)) return;
    var inputs = introInputs(intro);
    if (inputs.indexOf(a) > -1 && inputs.indexOf(a) < inputs.length - 1) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);

  // Remote BACK on the login screen: the shell ignores it there, so act like the on-screen back button.
  window.__introBack = function (type) {
    if (!introVisible()) return false;
    if (type === 'keydown') {
      var back = document.querySelector('#topbar .back') || document.querySelector('#topbar .logo');
      if (back) back.click(); else history.back();
    }
    return true;
  };

  // Chromium 47 scrolls a focused element flush to the edge (padding lost, row heading clipped).
  // After the browser's own scroll, nudge scrollable ancestors so the element sits inside with a margin.
  var MARGIN = 24;
  function keepVisible(el) {
    var p = el.parentElement;
    while (p && p !== document.documentElement) {
      var cs = getComputedStyle(p);
      var scrollsX = /(auto|scroll)/.test(cs.overflowX) && p.scrollWidth > p.clientWidth + 1;
      var scrollsY = /(auto|scroll)/.test(cs.overflowY) && p.scrollHeight > p.clientHeight + 1;
      if (scrollsX || scrollsY) {
        var r = el.getBoundingClientRect(), c = p.getBoundingClientRect(), k = (window.__scaleK || 1);
        if (scrollsX) {
          if (r.left < c.left + MARGIN * k) p.scrollLeft -= (c.left + MARGIN * k - r.left) / k;
          else if (r.right > c.right - MARGIN * k) p.scrollLeft += (r.right - (c.right - MARGIN * k)) / k;
        }
        if (scrollsY) {
          if (r.top < c.top + MARGIN * k) p.scrollTop -= (c.top + MARGIN * k - r.top) / k;
          else if (r.bottom > c.bottom - MARGIN * k) p.scrollTop += (r.bottom - (c.bottom - MARGIN * k)) / k;
        }
      }
      p = p.parentElement;
    }
  }
  document.addEventListener('focus', function (e) {
    var el = e.target;
    if (!el || !el.getBoundingClientRect) return;
    requestAnimationFrame(function () { keepVisible(el); });
  }, true);

  // Samsung remote RETURN (10009) is unknown to the web app; replay it as Escape (27) so the shell's "back" fires.
  function synth(type, code) {
    var ev = document.createEvent('Event');
    ev.initEvent(type, true, true);
    ['keyCode', 'which'].forEach(function (p) { Object.defineProperty(ev, p, { get: function () { return code; } }); });
    Object.defineProperty(ev, 'key', { get: function () { return 'Escape'; } });
    return ev;
  }
  ['keydown', 'keyup'].forEach(function (type) {
    window.addEventListener(type, function (e) {
      if (e.keyCode !== 10009 || e.__synthetic) return;
      e.stopImmediatePropagation(); e.preventDefault();
      if (window.__introBack && window.__introBack(type)) return; // login screen: shell ignores back
      if (window.__playerBack && window.__playerBack(type)) return; // player: back hides the control bar first
      var s = synth(type, 27); s.__synthetic = true;
      (e.target || document).dispatchEvent(s);
    }, true);
  });
})();

/* ---- Player: TV remote behaviour ----
   controls hidden: LEFT/RIGHT seek (shell), OK play/pause, DOWN shows the control bar
   controls shown:  LEFT/RIGHT move between controls, OK activates / opens a popup, UP or BACK hides */
(function () {
  'use strict';
  var shown = false;
  function synthKey(code) {
    ['keydown', 'keyup'].forEach(function (type) {
      var ev = document.createEvent('Event'); ev.initEvent(type, true, true);
      ['keyCode', 'which'].forEach(function (p) { Object.defineProperty(ev, p, { get: function () { return code; } }); });
      ev.__synthetic = true; document.dispatchEvent(ev);
    });
  }
  function inPlayer() {
    var p = document.getElementById('player');
    return !!(p && /player/.test(location.hash) && p.getBoundingClientRect().width > 0);
  }
  function controlsEls() { return document.querySelectorAll('#controlbar .control, #controlbar .popup li, #controlbar .popup .button, #controlbar .popup .toggle, #controlbar .popup .player-setting'); }
  function showControls() {
    var SN = window.SpatialNavigation; if (!SN) return;
    var h = document.querySelectorAll('#player .hidable');
    for (var i = 0; i < h.length; i++) h[i].classList.remove('hidden');
    var els = controlsEls();
    for (var j = 0; j < els.length; j++) if (!els[j].hasAttribute('tabindex')) els[j].setAttribute('tabindex', '-1');
    try { SN.remove('playerControls'); } catch (e) {}
    SN.add({ id: 'playerControls', selector: '#controlbar [tabindex]', restrict: 'self-only', enterTo: 'last-focused' });
    try { SN.enable('playerControls'); } catch (e) {}
    shown = true;
    setTimeout(function () { try { SN.focus('playerControls'); } catch (e) {} }, 50);
  }
  function hideControls() {
    var SN = window.SpatialNavigation;
    var act = document.querySelectorAll('#controlbar .control.active');
    for (var k = 0; k < act.length; k++) act[k].classList.remove('active');
    var h = document.querySelectorAll('#player .hidable');
    for (var i = 0; i < h.length; i++) h[i].classList.add('hidden');
    try { if (SN) { SN.disable('playerControls'); } } catch (e) {}
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    shown = false;
  }
  function stop(e) { e.preventDefault(); e.stopImmediatePropagation(); }
  function closest(el, sel) { while (el && el !== document) { if (el.matches ? el.matches(sel) : el.webkitMatchesSelector(sel)) return el; el = el.parentElement; } return null; }
  window.__playerBack = function (type) {
    if (!inPlayer() || !shown) return false;
    if (type === 'keydown') hideControls();
    return true;
  };
  window.addEventListener('keydown', function (e) {
    if (e.__synthetic || !inPlayer()) { if (!inPlayer()) shown = false; return; }
    var k = e.keyCode, SN = window.SpatialNavigation, a = document.activeElement;
    if (!shown) {
      if (k === 40) { stop(e); showControls(); }
      else if (k === 13) { stop(e); synthKey(32); }           // OK -> play/pause (shell: space)
      else if (k === 38) { stop(e); }                          // UP alone does nothing (was volume up)
      return;                                                  // LEFT/RIGHT fall through: shell seeks
    }
    if (k === 38) { stop(e); hideControls(); return; }
    if (k === 13) {
      stop(e);
      if (!a) return;
      var ctl = closest(a, '#controlbar .control');
      if (ctl && a === ctl && ctl.querySelector('.popup')) {       // control with a popup: open/close it
        var open = ctl.classList.toggle('active');
        if (open && SN) setTimeout(function () { var first = ctl.querySelector('.popup [tabindex]'); if (first) first.focus(); }, 60);
      } else {
        a.click();
        var owner = closest(a, '#controlbar .control.active');     // picked something in a popup: close it, back to the control
        if (owner && a !== owner) { owner.classList.remove('active'); owner.focus(); }
      }
      return;
    }
    if (k === 37 || k === 39 || k === 40) {
      stop(e);
      var isVol = a && (a.id === 'volumeControl' || closest(a, '#volumeControl'));
      var isSeek = a && /progress/.test(a.id + ' ' + a.className);
      if (isVol && (k === 37 || k === 39)) { synthKey(k === 39 ? 38 : 40); return; }   // volume -/+ via shell's up/down
      if (isSeek && (k === 37 || k === 39)) { synthKey(k); return; }                    // seek via shell's left/right
      if (SN) SN.move(k === 37 ? 'left' : k === 39 ? 'right' : 'down');
    }
  }, true);
  window.addEventListener('keyup', function (e) {
    if (e.__synthetic || !inPlayer()) return;
    if (shown || e.keyCode === 13 || e.keyCode === 40 || e.keyCode === 38) stop(e);
  }, true);
  var st = document.createElement('style');
  st.textContent = '#controlbar .control:focus{outline:none;background:rgba(255,255,255,.18);border-radius:.4rem}' +
    '#controlbar .control:focus .icon{opacity:1}' +
    '#controlbar .popup li:focus,#controlbar .popup .button:focus,#controlbar .popup .toggle:focus,#controlbar .popup .player-setting:focus{outline:none;background:rgba(255,255,255,.22)}';
  (document.head || document.documentElement).appendChild(st);
})();

window.__pfLoaded = true;
