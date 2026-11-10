/* file.js — guardar/abrir proyecto (.ora, formato abierto de capas: lo abren Krita, MyPaint, GIMP…) y exportar imagen (.png). */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var armed = false, at = 0, mt = 0, T = 256;
  var OPEN = 'Abrir proyecto…', ARMED = 'Toca otra vez: reemplaza el dibujo actual';

  function stamp() {
    var d = new Date(), z = function (n) { return ('0' + n).slice(-2); };
    return d.getFullYear() + z(d.getMonth() + 1) + z(d.getDate()) + '-' + z(d.getHours()) + z(d.getMinutes());
  }
  function msg(t, bad) {
    var m = $('f-msg'); if (!m) return;
    m.textContent = t; m.dataset.bad = bad ? '1' : '';
    clearTimeout(mt); if (t) mt = setTimeout(function () { m.textContent = ''; PD.ui.fileSync(); }, 6000);
  }
  function baseName() {
    var n = (PD.cfg.name || '').replace(/[\\\/:*?"<>|\x00-\x1f]/g, '').replace(/\.(ora|png)$/i, '').trim();
    return n || ('dibujo-' + stamp());
  }
  function download(name, blob) {
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; a.style.display = 'none';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
    msg('Descarga iniciada: ' + name + ' (carpeta Descargas)');
  }
  function cnv(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; }
  function blobOf(c) { return new Promise(function (res) { c.toBlob(res, 'image/png'); }); }
  async function u8(blob) { return new Uint8Array(await blob.arrayBuffer()); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function union(bs) {
    var U = null;
    bs.forEach(function (b) { if (!b) return; U = U ? { x0: Math.min(U.x0, b.x0), y0: Math.min(U.y0, b.y0), x1: Math.max(U.x1, b.x1), y1: Math.max(U.y1, b.y1) } : { x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 }; });
    return U;
  }

  PD.file = {
    saveProject: async function () {
      try {
        msg('Preparando…');
        var bounds = PD.layers.map(PD.layerBounds), U = union(bounds), ox = U ? U.x0 : 0, oy = U ? U.y0 : 0, w = U ? U.x1 - U.x0 : 1, h = U ? U.y1 - U.y0 : 1;
        var enc = new TextEncoder(), files = [{ name: 'mimetype', data: enc.encode('image/openraster') }];
        var xml = '<?xml version="1.0" encoding="UTF-8"?>\n<image version="0.0.3" w="' + w + '" h="' + h + '" pd-ox="' + ox + '" pd-oy="' + oy + '"><stack>';
        for (var i = PD.layers.length - 1; i >= 0; i--) {                    // la capa de arriba va primero
          var L = PD.layers[i], b = bounds[i], c = cnv(b ? b.x1 - b.x0 : 1, b ? b.y1 - b.y0 : 1);
          if (b) PD.paintLayer(c.getContext('2d'), L, b.x0, b.y0, 1);
          files.push({ name: 'data/layer' + i + '.png', data: await u8(await blobOf(c)) });
          xml += '<layer name="' + esc(L.name) + '" src="data/layer' + i + '.png" x="' + (b ? b.x0 - ox : 0) + '" y="' + (b ? b.y0 - oy : 0) + '" opacity="' + L.a.toFixed(3) + '" visibility="' + (L.vis ? 'visible' : 'hidden') + '" composite-op="svg:src-over"/>';
        }
        xml += '</stack></image>';
        files.push({ name: 'stack.xml', data: enc.encode(xml) });
        var mg = cnv(w, h), g = mg.getContext('2d');
        PD.layers.forEach(function (L) { if (!L.vis) return; g.globalAlpha = L.a; PD.paintLayer(g, L, ox, oy, 1); });
        g.globalAlpha = 1;
        files.push({ name: 'mergedimage.png', data: await u8(await blobOf(mg)) });
        var f = Math.min(1, 256 / Math.max(w, h)), th = cnv(Math.round(w * f), Math.round(h * f));
        th.getContext('2d').drawImage(mg, 0, 0, th.width, th.height);
        files.push({ name: 'Thumbnails/thumbnail.png', data: await u8(await blobOf(th)) });
        files.push({ name: 'pocketdraw.json', data: enc.encode(JSON.stringify({ v: 1, view: PD.view, act: PD.layers.indexOf(PD.act), cfg: PD.cfgOut(), bg: PD.bgOut() })) });
        download(baseName() + '.ora', PD.zip(files, 'image/openraster'));
      } catch (e) { msg('No se pudo guardar (' + (e && e.message || 'error') + ').', true); }
    },
    exportPNG: async function () {
      try {
        var B = union(PD.layers.filter(function (L) { return L.vis; }).map(PD.layerBounds));
        if (!B) { msg('No hay nada que exportar.', true); return; }
        var w = B.x1 - B.x0, h = B.y1 - B.y0, f = Math.min(1, 8192 / Math.max(w, h)), c = cnv(Math.round(w * f), Math.round(h * f)), g = c.getContext('2d'), bi = PD.bgImg;
        g.fillStyle = PD.T.paper; g.fillRect(0, 0, c.width, c.height);
        if (bi && bi.img && !bi.hidden) {
          g.setTransform(f, 0, 0, f, -B.x0 * f, -B.y0 * f);
          var bh = bi.w * bi.img.height / bi.img.width;
          g.globalAlpha = bi.a; g.drawImage(bi.img, bi.x - bi.w / 2, bi.y - bh / 2, bi.w, bh); g.globalAlpha = 1; g.setTransform(1, 0, 0, 1, 0, 0);
        }
        PD.layers.forEach(function (L) { if (!L.vis) return; g.globalAlpha = L.a; PD.paintLayer(g, L, B.x0, B.y0, f); });
        g.globalAlpha = 1;
        var blob = await blobOf(c);
        if (!blob) { msg('No se pudo crear la imagen.', true); return; }
        download(baseName() + '.png', blob);
      } catch (e) { msg('No se pudo exportar (' + (e && e.message || 'error') + ').', true); }
    },
    openProject: function () {
      var btn = $('f-open'), has = PD.layers.some(function (L) { return L.tiles.size; });
      if (has && !armed) {
        armed = true; btn.textContent = ARMED; btn.setAttribute('aria-pressed', 'true');
        clearTimeout(at); at = setTimeout(function () { armed = false; btn.textContent = OPEN; btn.setAttribute('aria-pressed', 'false'); }, 4000);
        return;
      }
      armed = false; clearTimeout(at); btn.textContent = OPEN; btn.setAttribute('aria-pressed', 'false');
      $('f-file').click();
    },
    loadFile: async function (file) {
      if (!file) return;
      try {
        var z = await PD.unzip(await file.arrayBuffer());
        if (!z['stack.xml']) throw new Error('ora');
        var doc = new DOMParser().parseFromString(new TextDecoder().decode(z['stack.xml']), 'application/xml'), im = doc.querySelector('image');
        if (!im || doc.querySelector('parsererror')) throw new Error('ora');
        var ox = parseInt(im.getAttribute('pd-ox'), 10) || 0, oy = parseInt(im.getAttribute('pd-oy'), 10) || 0, meta = null, layers = [];
        try { if (z['pocketdraw.json']) meta = JSON.parse(new TextDecoder().decode(z['pocketdraw.json'])); } catch (e) {}
        var els = Array.prototype.slice.call(doc.querySelectorAll('layer')).reverse();      // de abajo hacia arriba
        for (var i = 0; i < els.length; i++) {
          var el = els[i], data = z[el.getAttribute('src')]; if (!data) continue;
          var bmp = await createImageBitmap(new Blob([data], { type: 'image/png' })), L = PD.newLayer(el.getAttribute('name') || undefined);
          L.vis = el.getAttribute('visibility') !== 'hidden';
          var op = parseFloat(el.getAttribute('opacity')); L.a = isFinite(op) ? Math.max(0, Math.min(1, op)) : 1;
          PD.drawImageToLayer(L, bmp, ox + (parseInt(el.getAttribute('x'), 10) || 0), oy + (parseInt(el.getAttribute('y'), 10) || 0));
          if (bmp.close) bmp.close(); layers.push(L);
        }
        if (!layers.length) throw new Error('ora');
        PD.layers.length = 0; layers.forEach(function (L) { PD.layers.push(L); });
        PD.act = layers[meta && meta.act >= 0 && meta.act < layers.length ? meta.act : layers.length - 1];
        if (meta && meta.cfg) PD.cfgIn(meta.cfg);
        PD.cfg.name = (file.name || '').replace(/\.ora$/i, '');
        PD.bgRestore(meta && meta.bg);
        PD.orphan = true; PD.resetHistory(); PD.fit(); PD.readTheme(); PD.ui.reload(); PD.changed(); msg('Proyecto abierto.');
      } catch (e) { msg('Ese archivo no es un proyecto .ora válido.', true); }
    }
  };
})();
