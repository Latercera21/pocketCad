/* eraser.js — borrador: una pasada con "destination-out" sobre los bloques de la capa activa (mismo grosor/opacidad/difuminado que el lápiz). */
(function () {
  PD.eraser = {
    active: false,
    begin: function (p) {
      var L = PD.act; if (!L || !L.vis) return;
      var c = PD.cfg, w = PD.toWorld(p.x, p.y);
      this.active = true; PD.eraserPos = p;
      PD.cur = { e: 1, w: c.eW, a: c.eA, k: c.eK, p: [[w[0], w[1], 1]] };
      PD.redraw();
    },
    move: function (p) { if (this.active) { PD.addPoint(p); PD.redraw(); } },
    end: function () {
      if (!this.active) return;
      this.active = false;
      var s = PD.cur; PD.cur = null;
      if (s && s.e) PD.commitStroke(PD.act, s);
    }
  };
})();
