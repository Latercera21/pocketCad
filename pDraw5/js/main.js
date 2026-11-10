/* main.js — arranque: carga el autoguardado (IndexedDB), arma la interfaz y empieza a dibujar. */
(async function () {
  var cv = document.getElementById('cv'), stage = document.getElementById('stage');
  PD.initCanvas(cv);
  var had = await PD.dbLoad();
  PD.cfg.aLive = PD.cfg.alpha;
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}   // pide que el navegador no borre el autoguardado
  if (!PD.layers.length) { var L0 = PD.newLayer(); PD.layers.push(L0); PD.act = L0; }
  PD.ui.init();
  PD.readTheme();
  PD.initInput(cv);
  PD.ready = true;

  var mq = window.matchMedia('(prefers-color-scheme: dark)');
  if (mq.addEventListener) mq.addEventListener('change', PD.readTheme);
  new MutationObserver(PD.readTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  new ResizeObserver(function () {
    var r = stage.getBoundingClientRect(), nw = Math.max(1, Math.floor(r.width)), nh = Math.max(1, Math.floor(r.height));
    PD.dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(nw * PD.dpr); cv.height = Math.round(nh * PD.dpr);
    if (!PD.W) { if (!PD.loadedView) { PD.view.s = 1 / PD.dpr; PD.view.x = nw / 2; PD.view.y = nh / 2; } }
    else { PD.view.x += (nw - PD.W) / 2; PD.view.y += (nh - PD.H) / 2; }
    PD.W = nw; PD.H = nh;
    PD.draw();
  }).observe(stage);
})();
