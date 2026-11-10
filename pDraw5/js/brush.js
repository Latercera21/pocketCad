/* brush.js — lápiz: trazo con color, grosor (en píxeles del dibujo), opacidad, difuminado y presión del lápiz óptico.
   Mientras dibujas se ve en vivo; al soltar se pinta en los bloques de la capa activa. */
(function () {
  // Agrega un punto al trazo actual (lápiz o borrador). p = {x, y, pr} en pantalla.
  PD.addPoint = function (p) {
    if (!PD.cur) return;
    var w = PD.toWorld(p.x, p.y), l = PD.cur.p[PD.cur.p.length - 1];
    if (Math.hypot(w[0] - l[0], w[1] - l[1]) * PD.view.s < 1.5) return;
    var pr = PD.cur.e || p.pr == null ? 1 : p.pr;
    if (pr !== 1) PD.cur.pv = 1;
    PD.cur.p.push([w[0], w[1], pr]); PD.cur._P = null;
  };
  PD.brush = {
    start: function (p) {
      var c = PD.cfg, L = PD.act; if (!L) return;
      if (!L.vis) { L.vis = true; if (PD.ui) PD.ui.refresh(); }
      var w = PD.toWorld(p.x, p.y);
      var pr = p.pr == null ? 1 : p.pr;
      PD.cur = { c: c.color, w: c.w, a: c.aLive, k: c.soft, pv: pr !== 1 ? 1 : 0, p: [[w[0], w[1], pr]] };
      PD.redraw();
    },
    add: function (p) { PD.addPoint(p); },
    end: function () {
      var s = PD.cur; if (!s || s.e) return;
      PD.cur = null;
      PD.commitStroke(PD.act, s);
    },
    cancel: function () { PD.cur = null; PD.redraw(); }
  };
})();
