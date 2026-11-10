/* render.js — pincel (cadena de cápsulas rellena de una sola vez, así la opacidad no se acumula dentro del trazo) y dibujo en pantalla por bloques. */
(function () {
  var cv, ctx, scratch = null, T = 256;
  PD.initCanvas = function (c) { cv = c; ctx = c.getContext('2d'); };

  // Trazo -> puntos densos [x, y, radio] siguiendo una curva suave (cuadráticas por puntos medios).
  PD.dense = function (s) {
    var p = s.p, n = p.length, out = [], vs = PD.view.s, w2 = s.w / 2, st = Math.max(0.25, Math.min(6, 1.5 / vs), Math.min(0.3 * w2, 3 / vs));   // pasos más largos con pincel grueso (menos geometría), nunca > 3 px de pantalla
    function rad(i) { var q = p[i][2]; return w2 * (0.15 + 0.85 * (q == null ? 1 : q)); }
    out.push([p[0][0], p[0][1], rad(0)]);
    if (n === 1) return out;
    function seg(ax, ay, ar, qx, qy, bx, by, br) {
      var len = Math.hypot(qx - ax, qy - ay) + Math.hypot(bx - qx, by - qy), k = Math.max(1, Math.ceil(len / st));
      for (var j = 1; j <= k; j++) {
        var t = j / k, u = 1 - t;
        out.push([u * u * ax + 2 * u * t * qx + t * t * bx, u * u * ay + 2 * u * t * qy + t * t * by, ar + (br - ar) * t]);
      }
    }
    var cx = p[0][0], cy = p[0][1], cr = rad(0), i;
    for (i = 1; i < n - 1; i++) {
      var ex = (p[i][0] + p[i + 1][0]) / 2, ey = (p[i][1] + p[i + 1][1]) / 2, er = (rad(i) + rad(i + 1)) / 2;
      seg(cx, cy, cr, p[i][0], p[i][1], ex, ey, er); cx = ex; cy = ey; cr = er;
    }
    var bx = p[n - 1][0], by = p[n - 1][1];
    seg(cx, cy, cr, (cx + bx) / 2, (cy + by) / 2, bx, by, rad(n - 1));
    return out;
  };

  // Un solo Path2D con círculos y cuadriláteros del mismo sentido: relleno "nonzero" = unión exacta, sin doble opacidad.
  function build(pts, sc) {
    var P = new Path2D(), n = pts.length, i, k;
    for (i = 0; i < n; i++) {
      var a = pts[i];
      if (i % 2 === 0 || i === n - 1) { P.moveTo(a[0] + a[2] * sc, a[1]); P.arc(a[0], a[1], a[2] * sc, 0, 6.2832); }
      if (i < n - 1) {
        var b = pts[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
        if (l < 1e-9) continue;
        var nx = -dy / l, ny = dx / l, r0 = a[2] * sc, r1 = b[2] * sc;
        var q = [a[0] + nx * r0, a[1] + ny * r0, b[0] + nx * r1, b[1] + ny * r1, b[0] - nx * r1, b[1] - ny * r1, a[0] - nx * r0, a[1] - ny * r0], ar = 0;
        for (k = 0; k < 4; k++) { var k2 = (k + 1) % 4; ar += q[2 * k] * q[2 * k2 + 1] - q[2 * k2] * q[2 * k + 1]; }
        if (ar < 0) q = [q[6], q[7], q[4], q[5], q[2], q[3], q[0], q[1]];
        P.moveTo(q[0], q[1]); P.lineTo(q[2], q[3]); P.lineTo(q[4], q[5]); P.lineTo(q[6], q[7]); P.closePath();
      }
    }
    return P;
  }

  function strokePath(s) {                           // curva suave por puntos medios (cacheada)
    if (s._P) return s._P;
    var p = s.p, P = new Path2D(), i; P.moveTo(p[0][0], p[0][1]);
    for (i = 1; i < p.length - 1; i++) P.quadraticCurveTo(p[i][0], p[i][1], (p[i][0] + p[i + 1][0]) / 2, (p[i][1] + p[i + 1][1]) / 2);
    if (p.length > 1) P.lineTo(p[p.length - 1][0], p[p.length - 1][1]);
    return (s._P = P);
  }

  // Difuminado: capas concéntricas, la opacidad acumulada sube hacia el centro hasta la pedida. El borrador usa "destination-out".
  PD.drawOp = function (c, s, mult, pts) {
    var er = !!s.e, a = (s.a == null ? 1 : s.a) * (er || mult == null ? 1 : mult), k = s.k || 0, n = k > 0 ? 6 : 1;
    var col = er ? '#000' : s.c, one = s.p.length === 1;
    if (s.pv) pts = pts || PD.dense(s);                // con presión variable: cápsulas de radio distinto; si no, un trazo normal
    if (er) c.globalCompositeOperation = 'destination-out';
    c.fillStyle = col; c.strokeStyle = col; c.lineCap = 'round'; c.lineJoin = 'round';
    for (var i = 0; i < n; i++) {
      var ca = (i + 1) / n * a, cp = i / n * a;
      c.globalAlpha = (ca - cp) / (1 - cp);
      var sc = n > 1 ? 1 + k * 3 * (n - 1 - i) / (n - 1) : 1;
      if (s.pv) c.fill(build(pts, sc));
      else if (one) { c.beginPath(); c.arc(s.p[0][0], s.p[0][1], s.w / 2 * sc, 0, 6.2832); c.fill(); }
      else { c.lineWidth = s.w * sc; c.stroke(strokePath(s)); }
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  };

  function setT(c) { var d = PD.dpr, v = PD.view; c.setTransform(d * v.s, 0, 0, d * v.s, d * v.x, d * v.y); }

  // Pinta los bloques visibles de una capa (coordenadas de dispositivo). Con zoom > 1 se ven los píxeles (sin suavizar).
  function drawTiles(c, L, alpha) {
    var d = PD.dpr, v = PD.view, sd = v.s * d, vx = v.x * d, vy = v.y * d, PW = cv.width, PH = cv.height;
    c.setTransform(1, 0, 0, 1, 0, 0); c.imageSmoothingEnabled = sd < 1; c.imageSmoothingQuality = 'medium'; c.globalAlpha = alpha;
    L.tiles.forEach(function (t, key) {
      var p = PD.keyXY(key), x0 = Math.round(p[0] * T * sd + vx), x1 = Math.round((p[0] + 1) * T * sd + vx), y0 = Math.round(p[1] * T * sd + vy), y1 = Math.round((p[1] + 1) * T * sd + vy);
      if (x1 <= x0 || y1 <= y0 || x1 <= 0 || y1 <= 0 || x0 >= PW || y0 >= PH) return;
      var dw = x1 - x0, dh = y1 - y0, a = Math.max(0, x0), b = Math.max(0, y0), e = Math.min(PW, x1), f = Math.min(PH, y1);
      c.drawImage(t, (a - x0) / dw * T, (b - y0) / dh * T, (e - a) / dw * T, (f - b) / dh * T, a, b, e - a, f - b);
    });
    c.globalAlpha = 1;
  }

  function drawGrid() {
    var v = PD.view, W = PD.W, H = PD.H, T_ = PD.T;
    var step = Math.pow(10, Math.ceil(Math.log10(12 / v.s)));
    var i0 = Math.floor(-v.x / v.s / step), i1 = Math.ceil((W - v.x) / v.s / step);
    var j0 = Math.floor(-v.y / v.s / step), j1 = Math.ceil((H - v.y) / v.s / step);
    ctx.lineWidth = 1;
    [false, true].forEach(function (major) {
      ctx.strokeStyle = major ? T_.grid2 : T_.grid; ctx.beginPath();
      for (var i = i0; i <= i1; i++) { if ((i % 10 === 0) !== major) continue; var x = Math.round(i * step * v.s + v.x) + .5; ctx.moveTo(x, 0); ctx.lineTo(x, H); }
      for (var j = j0; j <= j1; j++) { if ((j % 10 === 0) !== major) continue; var y = Math.round(j * step * v.s + v.y) + .5; ctx.moveTo(0, y); ctx.lineTo(W, y); }
      ctx.stroke();
    });
  }

  // Color visible (dibujo + fondo, sin cuadrícula) en el punto x,y del lienzo, como #rrggbb.
  PD.sampleColor = function (x, y) {
    var ep = PD.eraserPos; PD.eraserPos = null; PD.noGrid = true; PD.draw(); PD.noGrid = false; PD.eraserPos = ep;
    var d = PD.dpr, px = Math.max(0, Math.min(cv.width - 1, Math.round(x * d))), py = Math.max(0, Math.min(cv.height - 1, Math.round(y * d)));
    var q = ctx.getImageData(px, py, 1, 1).data;
    PD.redraw();
    return '#' + [q[0], q[1], q[2]].map(function (n) { return ('0' + n.toString(16)).slice(-2); }).join('');
  };

  PD.draw = function () {
    if (!PD.W) return;
    var W = PD.W, H = PD.H, v = PD.view, d = PD.dpr, Th = PD.T, bi = PD.bgImg;
    ctx.setTransform(d, 0, 0, d, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = Th.paper; ctx.fillRect(0, 0, W, H);

    if (bi && bi.img && !bi.hidden) {
      ctx.setTransform(d * v.s, 0, 0, d * v.s, d * v.x, d * v.y);
      var h = bi.w * bi.img.height / bi.img.width;
      ctx.imageSmoothingEnabled = true; ctx.globalAlpha = bi.a; ctx.drawImage(bi.img, bi.x - bi.w / 2, bi.y - h / 2, bi.w, h); ctx.globalAlpha = 1;
      ctx.setTransform(d, 0, 0, d, 0, 0);
    }
    if (PD.cfg.grid && !PD.noGrid) drawGrid();

    PD.layers.forEach(function (L) {
      if (!L.vis) return;
      var live = L === PD.act && PD.cur;
      if (live && PD.cur.e) {                       // borrador en vivo: la capa con la pasada aplicada, en un lienzo auxiliar
        if (!scratch) scratch = document.createElement('canvas');
        if (scratch.width !== cv.width || scratch.height !== cv.height) { scratch.width = cv.width; scratch.height = cv.height; }
        var g = scratch.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, scratch.width, scratch.height);
        drawTiles(g, L, 1); setT(g); PD.drawOp(g, PD.cur, 1); g.setTransform(1, 0, 0, 1, 0, 0);
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = L.a; ctx.drawImage(scratch, 0, 0); ctx.globalAlpha = 1;
      } else {
        drawTiles(ctx, L, L.a);
        if (live) { setT(ctx); PD.drawOp(ctx, PD.cur, L.a); ctx.setTransform(1, 0, 0, 1, 0, 0); }
      }
    });

    ctx.setTransform(d, 0, 0, d, 0, 0); ctx.globalAlpha = 1;
    if (PD.cfg.tool === 'eraser' && PD.eraserPos) {
      var r = PD.cfg.eW / 2 * v.s;
      ctx.beginPath(); ctx.arc(PD.eraserPos.x, PD.eraserPos.y, Math.max(r, 1), 0, 6.2832);
      ctx.lineWidth = 3; ctx.strokeStyle = Th.paper; ctx.globalAlpha = .7; ctx.stroke();
      ctx.lineWidth = 1; ctx.strokeStyle = Th.fg; ctx.globalAlpha = 1; ctx.stroke();
    }
    var z = v.s * d, txt = '×' + (z < 10 ? z.toFixed(z < 1 ? 2 : 1) : z < 1000 ? String(Math.round(z)) : Math.round(z).toLocaleString('es'));
    if (txt !== PD.zTxt) { PD.zTxt = txt; if (PD.ui) PD.ui.setZoom(txt); }
  };
})();
