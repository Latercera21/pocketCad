/* core.js — estado, capas por bloques (tiles), historial y vista.
   Unidad del mundo: 1 píxel del dibujo. Cada capa guarda solo los bloques de 256×256 que tienen algo pintado (lienzo "infinito", poca memoria). */
var PD = window.PD = {};
(function () {
  var T = PD.TS = 256;
  PD.ZMIN = 0.05; PD.ZMAX = 128;                    // zoom = píxeles de pantalla (dispositivo) por píxel del dibujo
  PD.layers = []; PD.act = null; PD.view = { s: 1, x: 0, y: 0 };
  PD.W = 0; PD.H = 0; PD.dpr = 1; PD.cur = null;
  PD.loadedView = false; PD.dirty = false; PD.ready = false; PD.orphan = false; PD.eraserPos = null;
  PD.lastSave = null; PD.saveErr = false; PD.pick = false;
  // alpha = opacidad elegida; aLive = opacidad en uso (los botones rápidos la suben/bajan sin tocar alpha)
  PD.cfg = { tool: 'pen', color: '#1b2421', w: 4, alpha: 1, aLive: 1, soft: 0, grid: false, bg: 'white', eW: 20, eA: 1, eK: 0, recent: [], name: '' };

  var undoS = [], redoS = [], lid = 0, BUDGET = 160 * 1024 * 1024;
  PD.undoS = undoS; PD.redoS = redoS;

  PD.clamp = function (s) { var d = PD.dpr || 1; return Math.min(PD.ZMAX / d, Math.max(PD.ZMIN / d, s)); };
  PD.rnd = function (v) { return Math.round(v * 1e6) / 1e6; };
  PD.toWorld = function (x, y) { return [(x - PD.view.x) / PD.view.s, (y - PD.view.y) / PD.view.s]; };

  PD.newLayer = function (name, uid) {
    lid++;
    return { id: lid, uid: uid || ('L' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)), name: name || ('Capa ' + lid), vis: true, a: 1, tiles: new Map(), dirty: new Set() };
  };
  PD.tileCanvas = function () { var c = document.createElement('canvas'); c.width = c.height = T; return c; };
  function copyTile(t) { var c = PD.tileCanvas(); c.getContext('2d').drawImage(t, 0, 0); return c; }
  PD.keyXY = function (k) { var i = k.indexOf(','); return [+k.slice(0, i), +k.slice(i + 1)]; };

  PD.redraw = (function () {
    var raf = 0;
    return function () { if (!raf) raf = requestAnimationFrame(function () { raf = 0; if (PD.draw) PD.draw(); }); };
  })();
  PD.changed = function () { PD.dirty = true; PD.redraw(); PD.save(); if (PD.ui) PD.ui.refresh(); };
  PD.saveCfg = function () { PD.dirty = true; PD.save(); };
  PD.record = function (entry) {
    undoS.push(entry); redoS.length = 0;
    var tot = 0;
    for (var i = undoS.length - 1; i >= 0; i--) {
      tot += (undoS[i].items ? undoS[i].items.length : 0) * T * T * 4;
      if (tot > BUDGET || undoS.length - i > 200) { undoS.splice(0, i + 1); break; }
    }
    PD.changed();
  };
  PD.resetHistory = function () { undoS.length = 0; redoS.length = 0; };

  /* ---- pintar ---- */
  // Aplica un trazo (lápiz o borrador) a los bloques de la capa y guarda el estado anterior para deshacer.
  PD.commitStroke = function (L, s) {
    var pts = s.pv ? PD.dense(s) : null, n = s.p.length, k = s.k || 0, a = 1e15, b = 1e15, c = -1e15, d = -1e15, i;
    for (i = 0; i < n; i++) {
      var q = s.p[i]; if (q[0] < a) a = q[0]; if (q[1] < b) b = q[1]; if (q[0] > c) c = q[0]; if (q[1] > d) d = q[1];
    }
    var m = s.w / 2 * (1 + 3 * k) + 2, tx0 = Math.floor((a - m) / T), tx1 = Math.floor((c + m) / T), ty0 = Math.floor((b - m) / T), ty1 = Math.floor((d + m) / T), items = [];
    for (var ty = ty0; ty <= ty1; ty++) for (var tx = tx0; tx <= tx1; tx++) {
      var key = tx + ',' + ty, t = L.tiles.get(key), img = null;
      if (t) img = copyTile(t);
      else { if (s.e) continue; t = PD.tileCanvas(); L.tiles.set(key, t); }
      var g = t.getContext('2d'); g.setTransform(1, 0, 0, 1, -tx * T, -ty * T);
      PD.drawOp(g, s, 1, pts); g.setTransform(1, 0, 0, 1, 0, 0);
      items.push({ k: key, img: img }); L.dirty.add(key);
    }
    if (items.length) PD.record({ t: 'tiles', L: L, items: items });
  };
  // Dibuja una imagen (ImageBitmap/canvas) en la capa en la posición x,y del dibujo.
  PD.drawImageToLayer = function (L, im, x, y) {
    var w = im.width, h = im.height, tx0 = Math.floor(x / T), tx1 = Math.floor((x + w - 1) / T), ty0 = Math.floor(y / T), ty1 = Math.floor((y + h - 1) / T);
    for (var ty = ty0; ty <= ty1; ty++) for (var tx = tx0; tx <= tx1; tx++) {
      var key = tx + ',' + ty, t = L.tiles.get(key);
      if (!t) { t = PD.tileCanvas(); L.tiles.set(key, t); }
      t.getContext('2d').drawImage(im, x - tx * T, y - ty * T); L.dirty.add(key);
    }
  };
  PD.clearAll = function () {                        // vacía la capa activa
    var L = PD.act; if (!L || !L.tiles.size) return;
    var items = [];
    L.tiles.forEach(function (t, k) { items.push({ k: k, img: t }); L.dirty.add(k); });
    L.tiles.clear();
    PD.record({ t: 'tiles', L: L, items: items });
  };
  PD.addLayer = function () {
    var L = PD.newLayer(), i = PD.layers.indexOf(PD.act) + 1;
    PD.layers.splice(i, 0, L); PD.act = L;
    PD.record({ t: 'ladd', L: L, i: i });
  };
  PD.delLayer = function (L) {
    if (PD.layers.length < 2) return;
    var i = PD.layers.indexOf(L); if (i < 0) return;
    PD.layers.splice(i, 1); PD.orphan = true;
    if (PD.act === L) PD.act = PD.layers[Math.min(i, PD.layers.length - 1)];
    PD.record({ t: 'ldel', L: L, i: i });
  };
  PD.moveLayer = function (L, dir) {
    var i = PD.layers.indexOf(L), j = i + dir;
    if (i < 0 || j < 0 || j >= PD.layers.length) return;
    PD.layers[i] = PD.layers[j]; PD.layers[j] = L; PD.changed();
  };

  function doEntry(a, undo) {
    var L = a.L;
    if (a.t === 'tiles') {                           // intercambia el bloque actual con el guardado (sirve para deshacer y rehacer)
      a.items.forEach(function (it) {
        var cur = L.tiles.get(it.k) || null;
        if (it.img) L.tiles.set(it.k, it.img); else L.tiles.delete(it.k);
        it.img = cur; L.dirty.add(it.k);
      });
    } else {
      var remove = (a.t === 'ladd') === undo;
      if (remove) {
        var i = PD.layers.indexOf(L);
        if (i >= 0) PD.layers.splice(i, 1);
        if (PD.act === L) PD.act = PD.layers[Math.min(i, PD.layers.length - 1)];
        PD.orphan = true;
      } else {
        PD.layers.splice(Math.min(a.i, PD.layers.length), 0, L); PD.act = L;
        L.tiles.forEach(function (_, k) { L.dirty.add(k); });
      }
    }
  }
  PD.undo = function () { var a = undoS.pop(); if (!a) return; doEntry(a, true); redoS.push(a); PD.changed(); };
  PD.redo = function () { var a = redoS.pop(); if (!a) return; doEntry(a, false); undoS.push(a); PD.changed(); };

  /* ---- límites del contenido ---- */
  // Aproximado (por bloques), rápido: para "ajustar zoom".
  PD.tileBounds = function () {
    var a = 1e15, b = 1e15, c = -1e15, d = -1e15, any = false;
    PD.layers.forEach(function (L) {
      if (!L.vis) return;
      L.tiles.forEach(function (_, k) { var p = PD.keyXY(k); any = true; a = Math.min(a, p[0] * T); b = Math.min(b, p[1] * T); c = Math.max(c, (p[0] + 1) * T); d = Math.max(d, (p[1] + 1) * T); });
    });
    return any ? { x0: a, y0: b, x1: c, y1: d } : null;
  };
  // Exacto (mira los píxeles): para exportar. null si la capa está vacía.
  PD.layerBounds = function (L) {
    var x0 = 1e15, y0 = 1e15, x1 = -1e15, y1 = -1e15;
    L.tiles.forEach(function (t, k) {
      var d = t.getContext('2d').getImageData(0, 0, T, T).data, mx = T, my = T, Mx = -1, My = -1;
      for (var y = 0; y < T; y++) for (var x = 0; x < T; x++) if (d[(y * T + x) * 4 + 3]) { if (x < mx) mx = x; if (x > Mx) Mx = x; if (y < my) my = y; if (y > My) My = y; }
      if (Mx < 0) return;
      var p = PD.keyXY(k); x0 = Math.min(x0, p[0] * T + mx); y0 = Math.min(y0, p[1] * T + my); x1 = Math.max(x1, p[0] * T + Mx + 1); y1 = Math.max(y1, p[1] * T + My + 1);
    });
    return x0 > x1 ? null : { x0: x0, y0: y0, x1: x1, y1: y1 };
  };
  // Pinta los bloques de una capa en c; (ox,oy) = esquina del dibujo que va en 0,0; f = escala.
  PD.paintLayer = function (c, L, ox, oy, f) {
    c.imageSmoothingEnabled = f < 1;
    L.tiles.forEach(function (t, k) {
      var p = PD.keyXY(k), x0 = Math.round((p[0] * T - ox) * f), y0 = Math.round((p[1] * T - oy) * f), x1 = Math.round(((p[0] + 1) * T - ox) * f), y1 = Math.round(((p[1] + 1) * T - oy) * f);
      if (x1 > x0 && y1 > y0) c.drawImage(t, x0, y0, x1 - x0, y1 - y0);
    });
  };

  /* ---- vista ---- */
  PD.fit = function () {
    var W = PD.W, H = PD.H, d = PD.dpr, B = PD.tileBounds(), m = 24;
    if (!B) { PD.view = { s: 1 / d, x: W / 2, y: H / 2 }; PD.redraw(); return; }
    var w = B.x1 - B.x0, h = B.y1 - B.y0, s = PD.clamp(Math.min((W - 2 * m) / w, (H - 2 * m) / h));
    PD.view = { s: s, x: W / 2 - (B.x0 + B.x1) / 2 * s, y: H / 2 - (B.y0 + B.y1) / 2 * s }; PD.redraw();
  };
  PD.zoomAt = function (cx, cy, f) {
    var v = PD.view, ns = PD.clamp(v.s * f); f = ns / v.s;
    v.x = cx - (cx - v.x) * f; v.y = cy - (cy - v.y) * f; v.s = ns; PD.redraw();
  };

  /* ---- metadatos del proyecto (capas, vista, ajustes, fondo); los píxeles van aparte, bloque por bloque ---- */
  PD.cfgOut = function () {
    var c = PD.cfg;
    return { color: c.color, w: c.w, alpha: c.alpha, soft: c.soft, grid: c.grid, bg: c.bg, eW: c.eW, eA: c.eA, eK: c.eK, recent: c.recent, name: c.name };
  };
  PD.cfgIn = function (o) {
    if (!o) return;
    for (var k in o) if (k in PD.cfg && k !== 'tool' && k !== 'aLive') PD.cfg[k] = o[k];
    if (['auto', 'white', 'gray', 'black'].indexOf(PD.cfg.bg) < 0) PD.cfg.bg = 'white';
    if (!Array.isArray(PD.cfg.recent)) PD.cfg.recent = [];
    if (typeof PD.cfg.name !== 'string') PD.cfg.name = '';
    if (typeof PD.cfg.color !== 'string' || PD.cfg.color.charAt(0) !== '#') PD.cfg.color = '#1b2421';
    PD.cfg.aLive = PD.cfg.alpha;
  };
  PD.bgOut = function () {
    var bi = PD.bgImg;
    return bi && bi.data ? { d: bi.data, x: PD.rnd(bi.x), y: PD.rnd(bi.y), w0: PD.rnd(bi.w0), w: PD.rnd(bi.w), a: bi.a, h: !!bi.hidden } : null;
  };
  PD.metaOut = function () {
    return { v: 1, view: PD.view, act: PD.layers.indexOf(PD.act), cfg: PD.cfgOut(), bg: PD.bgOut(),
      layers: PD.layers.map(function (L) { return { u: L.uid, n: L.name, v: L.vis, a: L.a }; }) };
  };
})();
