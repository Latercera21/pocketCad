/* ui.js — barra mínima, paneles flotantes (color, lápiz, borrador, fondo, capas, archivo) y botones rápidos de opacidad. */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var H = 210, Sx = 1, V = 0.2, sv, svc, svDown = false;
  var POPS = [
    { p: 'pop-color', b: 'b-color', m: true }, { p: 'pop-brush', b: 't-pen', m: false },
    { p: 'pop-eraser', b: 't-eraser', m: false }, { p: 'pop-bg', b: 'b-bg', m: true },
    { p: 'pop-layers', b: 'b-layers', m: true }, { p: 'pop-file', b: 'b-file', m: true }
  ];
  var QSTEP = 10;                                    // puntos de opacidad por toque en los botones rápidos
  var clamp01 = function (x) { return Math.max(0, Math.min(1, x)); };
  var isHex = function (c) { return typeof c === 'string' && c.charAt(0) === '#'; };
  var EYE = '<svg class="i" viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path class="sl" d="M4 20L20 4"/></svg>';
  var UP = '<svg class="i" viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg>';
  var DOWN = '<svg class="i" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>';
  var DEL = '<svg class="i" viewBox="0 0 24 24"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/></svg>';

  function hsv2hex(h, s, v) {
    var f = function (n) { var k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
    return '#' + [f(5), f(3), f(1)].map(function (x) { return ('0' + Math.round(x * 255).toString(16)).slice(-2); }).join('');
  }
  function hex2hsv(hex) {
    var r = parseInt(hex.substr(1, 2), 16) / 255, g = parseInt(hex.substr(3, 2), 16) / 255, b = parseInt(hex.substr(5, 2), 16) / 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, h = 0;
    if (d) { h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
    return [h, mx ? d / mx : 0, mx];
  }

  /* ---- selector de color ---- */
  function drawSV() {
    if (!sv.clientWidth) return;
    var d = PD.dpr || 1, w = Math.round(sv.clientWidth * d), h = Math.round(sv.clientHeight * d);
    if (sv.width !== w || sv.height !== h) { sv.width = w; sv.height = h; }
    svc.fillStyle = 'hsl(' + H + ',100%,50%)'; svc.fillRect(0, 0, w, h);
    var gw = svc.createLinearGradient(0, 0, w, 0); gw.addColorStop(0, '#fff'); gw.addColorStop(1, 'rgba(255,255,255,0)');
    svc.fillStyle = gw; svc.fillRect(0, 0, w, h);
    var gb = svc.createLinearGradient(0, 0, 0, h); gb.addColorStop(0, 'rgba(0,0,0,0)'); gb.addColorStop(1, '#000');
    svc.fillStyle = gb; svc.fillRect(0, 0, w, h);
    var x = Sx * w, y = (1 - V) * h;
    svc.beginPath(); svc.arc(x, y, 6 * d, 0, 6.2832); svc.lineWidth = 3 * d; svc.strokeStyle = '#000'; svc.stroke();
    svc.lineWidth = 1.5 * d; svc.strokeStyle = '#fff'; svc.stroke();
  }
  function applyHSV() { PD.cfg.color = hsv2hex(H, Sx, V); drawSV(); refresh(); PD.saveCfg(); }
  function addRecent(hex) {
    if (!isHex(hex)) return;
    var r = PD.cfg.recent.filter(function (c) { return c !== hex; }); r.unshift(hex); PD.cfg.recent = r.slice(0, 8);
    renderRecent(); PD.saveCfg();
  }
  function renderRecent() {
    var box = $('rec'); box.innerHTML = '';
    function chip(color, auto) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'chip' + (auto ? ' auto' : '');
      if (!auto) b.style.background = color;
      b.setAttribute('aria-label', auto ? 'Color automático' : 'Color ' + color);
      b.setAttribute('aria-pressed', String(PD.cfg.color === (auto ? 'auto' : color)));
      b.onclick = function () {
        PD.cfg.color = auto ? 'auto' : color;
        if (!auto) { var c = hex2hsv(color); H = c[0]; Sx = c[1]; V = c[2]; $('hue').value = Math.round(H); drawSV(); }
        renderRecent(); refresh(); PD.saveCfg();
      };
      box.appendChild(b);
    }
    PD.cfg.recent.forEach(function (c) { chip(c, false); });
  }

  /* ---- capas ---- */
  function iconBtn(html, label, fn, pressed) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'b sm'; b.innerHTML = html; b.setAttribute('aria-label', label); b.title = label;
    if (pressed != null) b.setAttribute('aria-pressed', String(pressed));
    b.onclick = fn; return b;
  }
  function layersSync() {
    var box = $('ly-list'); if (!box) return;
    box.innerHTML = '';
    for (var i = PD.layers.length - 1; i >= 0; i--) (function (L) {
      var row = document.createElement('div'); row.className = 'ly'; if (L === PD.act) row.setAttribute('aria-current', 'true');
      row.appendChild(iconBtn(EYE, L.vis ? 'Ocultar capa' : 'Mostrar capa', function () { L.vis = !L.vis; PD.changed(); }, !L.vis));
      var nm = document.createElement('button'); nm.type = 'button'; nm.className = 'ly-name'; nm.textContent = L.name;
      nm.onclick = function () { PD.act = L; PD.changed(); }; row.appendChild(nm);
      row.appendChild(iconBtn(UP, 'Subir capa', function () { PD.moveLayer(L, 1); }));
      row.appendChild(iconBtn(DOWN, 'Bajar capa', function () { PD.moveLayer(L, -1); }));
      var del = iconBtn(DEL, 'Eliminar capa', function () { PD.delLayer(L); }); del.disabled = PD.layers.length < 2; row.appendChild(del);
      box.appendChild(row);
    })(PD.layers[i]);
    if (PD.act) { $('r-la').value = Math.round(PD.act.a * 100); $('o-la').textContent = $('r-la').value; }
  }

  /* ---- paneles ---- */
  function closePops() {
    POPS.forEach(function (o) { $(o.p).hidden = true; if (o.m) $(o.b).setAttribute('aria-pressed', 'false'); });
  }
  function togglePop(id) {
    var o = POPS.filter(function (x) { return x.p === id; })[0], was = !$(o.p).hidden; closePops();
    if (was) return;
    $(o.p).hidden = false; if (o.m) $(o.b).setAttribute('aria-pressed', 'true');
    if (id === 'pop-color') {
      if (isHex(PD.cfg.color)) { var c = hex2hsv(PD.cfg.color); H = c[0]; Sx = c[1]; V = c[2]; $('hue').value = Math.round(H); }
      renderRecent(); drawSV();
    }
    if (id === 'pop-layers') layersSync();
    if (id === 'pop-file') fileSync();
  }
  function pillSync() {
    var t = PD.cfg.tool, p = t === 'pen', b = !!(PD.bgImg && PD.bgImg.edit), k = !!PD.pick;
    $('pill').hidden = !(p || b || k);
    $('pill-k').hidden = !k;
    $('pill-b').hidden = !(b && !k);
    $('pill-p').hidden = !(p && !b && !k);
  }
  function setTool(t) {
    PD.cfg.tool = t; PD.eraserPos = null;
    ['pen', 'eraser', 'hand'].forEach(function (n) { $('t-' + n).setAttribute('aria-pressed', String(n === t)); });
    $('cv').style.cursor = t === 'hand' ? 'grab' : t === 'eraser' ? 'none' : 'crosshair';
    PD.pick = false; closePops(); pillSync(); PD.redraw();
    if (t === 'eraser') togglePop('pop-eraser');      // grosor, opacidad y difuminado juntos
  }
  function pickStart() { closePops(); PD.pick = true; $('cv').style.cursor = 'crosshair'; pillSync(); }
  function pickEnd() { PD.pick = false; pillSync(); }
  function pickColor(hex) {                            // color copiado del lienzo
    PD.cfg.color = hex; var c = hex2hsv(hex); H = c[0]; Sx = c[1]; V = c[2]; $('hue').value = Math.round(H);
    addRecent(hex); pickEnd(); refresh(); PD.saveCfg(); togglePop('pop-color');
  }

  /* ---- opacidad rápida del lápiz ---- */
  function qSync() {
    var c = PD.cfg, live = Math.round(c.aLive * 100), base = Math.round(c.alpha * 100);
    $('q-mid').textContent = live;
    $('q-mid').title = 'Volver a la opacidad elegida (' + base + ')';
    $('q-mid').setAttribute('aria-label', 'Opacidad actual ' + live + ', tocar para volver a ' + base);
    $('q-mid').setAttribute('aria-pressed', String(live !== base));
    $('q-minus').disabled = live <= 5; $('q-plus').disabled = live >= 100;
  }
  function qStep(d) { var c = PD.cfg; c.aLive = Math.max(0.05, Math.min(1, Math.round(c.aLive * 100 + d) / 100)); qSync(); }

  /* ---- estado visible ---- */
  function fileSync() {
    var f = $('f-stamp'); if (!f) return;
    var t = PD.lastSave;
    if (PD.saveErr) f.textContent = 'No se pudo autoguardar en el navegador (memoria llena). Guarda un archivo .ora.';
    else if (t) f.textContent = 'Autoguardado en este navegador a las ' + ('0' + t.getHours()).slice(-2) + ':' + ('0' + t.getMinutes()).slice(-2) + '.';
    else f.textContent = 'Se autoguarda en este navegador cada vez que dibujas.';
    f.dataset.bad = PD.saveErr ? '1' : '';
    $('b-file').classList.toggle('warn', !!PD.saveErr);
  }
  function refresh() {
    var c = PD.cfg, T = PD.T || {};
    $('b-undo').disabled = !PD.undoS.length; $('b-redo').disabled = !PD.redoS.length;
    var cc = c.color === 'auto' ? (T.ink || '#000') : c.color;
    $('cur-sw').style.background = cc; $('cur-hex').textContent = c.color === 'auto' ? 'Automático' : c.color.toUpperCase();
    $('b-grid').setAttribute('aria-pressed', String(c.grid));
    document.querySelectorAll('#bgsw [data-bg]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.bg === c.bg)); });
    layersSync(); qSync();
  }
  function slider(id, out, get, set) {
    var r = $(id), o = $(out);
    r.value = get(); o.textContent = r.value;
    r.addEventListener('input', function () { o.textContent = r.value; set(parseFloat(r.value)); });
  }
  function nameSync() { var n = $('f-name'); if (n) n.value = PD.cfg.name || ''; }
  function bgSync() {
    var bi = PD.bgImg;
    $('bg-img').hidden = !bi; $('bg-del').hidden = !bi; $('b-eye').hidden = !bi;
    if (bi) {
      $('r-ba').value = Math.round(bi.a * 100); $('o-ba').textContent = $('r-ba').value;
      var p = Math.round(bi.w / bi.w0 * 100); $('r-bs').value = p; $('o-bs').textContent = p;
      $('bg-edit').setAttribute('aria-pressed', String(bi.edit));
      $('b-eye').setAttribute('aria-pressed', String(bi.hidden));
      $('b-eye').title = bi.hidden ? 'Mostrar fondo' : 'Ocultar fondo';
    }
    pillSync();
  }

  PD.ui = {
    reload: function () {                            // tras cargar un proyecto: vuelve a leer ajustes en los controles
      var c = PD.cfg;
      [['r-w', 'o-w', c.w], ['r-a', 'o-a', Math.round(c.alpha * 100)], ['r-k', 'o-k', Math.round(c.soft * 100)], ['r-es', 'o-es', c.eW], ['r-ea', 'o-ea', Math.round(c.eA * 100)], ['r-ek', 'o-ek', Math.round(c.eK * 100)]].forEach(function (a) { $(a[0]).value = a[2]; $(a[1]).textContent = $(a[0]).value; });
      nameSync(); bgSync(); refresh();
    },
    pickColor: pickColor, refresh: refresh, nameSync: nameSync, setTool: setTool, closePops: closePops, bgSync: bgSync, fileSync: fileSync,
    setZoom: function (t) { $('b-zoom').textContent = t; },
    init: function () {
      var c = PD.cfg;
      sv = $('sv'); svc = sv.getContext('2d');
      $('t-pen').onclick = function () { if (c.tool === 'pen') togglePop('pop-brush'); else setTool('pen'); };
      $('t-eraser').onclick = function () { if (c.tool === 'eraser') togglePop('pop-eraser'); else setTool('eraser'); };
      $('t-hand').onclick = function () { setTool('hand'); };
      $('b-undo').onclick = PD.undo; $('b-redo').onclick = PD.redo;
      $('b-zoom').onclick = function () { PD.fit(); PD.saveCfg(); };
      $('b-color').onclick = function () { togglePop('pop-color'); };
      $('b-bg').onclick = function () { togglePop('pop-bg'); };
      $('b-layers').onclick = function () { togglePop('pop-layers'); };
      $('b-file').onclick = function () { togglePop('pop-file'); };
      $('b-eye').onclick = PD.bgToggle;
      $('b-grid').onclick = function () { c.grid = !c.grid; refresh(); PD.redraw(); PD.saveCfg(); };

      slider('r-w', 'o-w', function () { return c.w; }, function (v) { c.w = v; PD.saveCfg(); });
      slider('r-a', 'o-a', function () { return Math.round(c.alpha * 100); }, function (v) { c.alpha = v / 100; c.aLive = c.alpha; qSync(); PD.saveCfg(); });
      slider('r-k', 'o-k', function () { return Math.round(c.soft * 100); }, function (v) { c.soft = v / 100; PD.saveCfg(); });
      slider('r-ea', 'o-ea', function () { return Math.round(c.eA * 100); }, function (v) { c.eA = v / 100; PD.saveCfg(); });
      slider('r-ek', 'o-ek', function () { return Math.round(c.eK * 100); }, function (v) { c.eK = v / 100; PD.saveCfg(); });
      $('r-la').addEventListener('input', function (e) { if (PD.act) { PD.act.a = e.target.value / 100; $('o-la').textContent = e.target.value; PD.dirty = true; PD.redraw(); PD.save(); } });
      $('ly-add').onclick = PD.addLayer;

      $('q-minus').onclick = function () { qStep(-QSTEP); };
      $('q-plus').onclick = function () { qStep(QSTEP); };
      $('q-mid').onclick = function () { c.aLive = c.alpha; qSync(); };

      $('hue').addEventListener('input', function (e) { H = +e.target.value; applyHSV(); });
      $('hue').addEventListener('change', function () { addRecent(PD.cfg.color); });
      function svSet(e) {
        var r = sv.getBoundingClientRect();
        Sx = clamp01((e.clientX - r.left) / r.width); V = 1 - clamp01((e.clientY - r.top) / r.height); applyHSV();
      }
      sv.addEventListener('pointerdown', function (e) { try { sv.setPointerCapture(e.pointerId); } catch (x) {} svDown = true; svSet(e); });
      sv.addEventListener('pointermove', function (e) { if (svDown) svSet(e); });
      sv.addEventListener('pointerup', function () { svDown = false; addRecent(PD.cfg.color); });
      sv.addEventListener('pointercancel', function () { svDown = false; });

      slider('r-es', 'o-es', function () { return c.eW; }, function (v) { c.eW = v; PD.saveCfg(); });
      $('b-pick').onclick = pickStart;
      $('k-cancel').onclick = pickEnd;
      nameSync();
      $('f-name').addEventListener('input', function (e) { c.name = e.target.value; PD.saveCfg(); });

      document.querySelectorAll('#bgsw [data-bg]').forEach(function (b) { b.onclick = function () { PD.setBg(b.dataset.bg); }; });
      $('bg-load').onclick = function () { $('bg-file').click(); };
      $('bg-file').addEventListener('change', function (e) { PD.bgLoad(e.target.files[0]); e.target.value = ''; closePops(); });
      $('bg-del').onclick = PD.bgRemove;
      $('bg-edit').onclick = function () { if (PD.bgImg) PD.bgEdit(!PD.bgImg.edit); };
      $('b-done').onclick = function () { PD.bgEdit(false); };
      $('r-ba').addEventListener('input', function (e) { if (PD.bgImg) { PD.bgImg.a = e.target.value / 100; $('o-ba').textContent = e.target.value; PD.redraw(); PD.dirty = true; PD.save(); } });
      $('r-bs').addEventListener('input', function (e) { if (PD.bgImg) { PD.bgImg.w = PD.bgImg.w0 * e.target.value / 100; $('o-bs').textContent = e.target.value; PD.redraw(); PD.dirty = true; PD.save(); } });

      $('f-save').onclick = PD.file.saveProject;
      $('f-png').onclick = PD.file.exportPNG;
      $('f-open').onclick = PD.file.openProject;
      $('f-file').addEventListener('change', function (e) { PD.file.loadFile(e.target.files[0]); e.target.value = ''; });
      $('f-clear').onclick = function () { PD.clearAll(); };

      setTool('pen'); bgSync(); refresh(); fileSync();
    }
  };
})();
