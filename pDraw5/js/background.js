/* background.js — imagen de fondo para calcar. Se reduce (máx. 1600 px, JPEG) y se guarda con el proyecto y en el autoguardado. */
(function () {
  var MAXPX = 1600, rt = 0;
  PD.bgImg = null;
  function touch() { PD.dirty = true; PD.save(); }
  PD.bgLoad = function (file) {
    if (!file) return;
    var fr = new FileReader();
    fr.onload = function () {
      var im = new Image();
      im.onload = function () {
        var k = Math.min(1, MAXPX / Math.max(im.width, im.height)), c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(im.width * k)); c.height = Math.max(1, Math.round(im.height * k));
        var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height);
        var data = c.toDataURL('image/jpeg', 0.85), v = PD.view, w0 = PD.W / v.s * 0.9;
        rt++;
        PD.bgImg = { img: c, data: data, x: (PD.W / 2 - v.x) / v.s, y: (PD.H / 2 - v.y) / v.s, w0: w0, w: w0, a: 0.5, edit: true, hidden: false };
        PD.ui.bgSync(); PD.redraw(); touch();
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  };
  // Restaura el fondo desde un proyecto (o lo quita si no trae).
  PD.bgRestore = function (o) {
    var tok = ++rt, ok = function (n) { return typeof n === 'number' && isFinite(n); };
    if (!o || typeof o.d !== 'string' || o.d.indexOf('data:image/') !== 0 || !ok(o.x) || !ok(o.y) || !ok(o.w) || !(o.w > 0)) {
      PD.bgImg = null; if (PD.ui) PD.ui.bgSync(); PD.redraw(); return;
    }
    var im = new Image();
    im.onload = function () {
      if (tok !== rt) return;
      PD.bgImg = { img: im, data: o.d, x: o.x, y: o.y, w0: ok(o.w0) && o.w0 > 0 ? o.w0 : o.w, w: o.w, a: ok(o.a) ? Math.max(0.05, Math.min(1, o.a)) : 0.5, edit: false, hidden: !!o.h };
      PD.ui.bgSync(); PD.redraw();
    };
    im.src = o.d;
  };
  PD.bgRemove = function () { rt++; PD.bgImg = null; PD.ui.bgSync(); PD.redraw(); touch(); };
  PD.bgEdit = function (on) { if (PD.bgImg) { PD.bgImg.edit = !!on; if (on) PD.bgImg.hidden = false; } PD.ui.bgSync(); PD.redraw(); touch(); };
  PD.bgToggle = function () { if (PD.bgImg) { PD.bgImg.hidden = !PD.bgImg.hidden; if (PD.bgImg.hidden) PD.bgImg.edit = false; PD.ui.bgSync(); PD.redraw(); touch(); } };
})();
