/* theme.js — colores del lienzo según tema o fondo elegido. */
(function () {
  var PAL = {
    light: { grid: '#e6eae7', grid2: '#cfd6d2', fg: '#1b2421', ink: '#1b2421' },
    dark:  { grid: '#1b2321', grid2: '#2b3733', fg: '#e6ece9', ink: '#e8eeeb' }
  };
  PD.BG = {
    white: { paper: '#ffffff', dark: false, grid: '#ebeeec', grid2: '#d3d9d5' },
    gray:  { paper: '#c9cfcb', dark: false, grid: '#bcc3be', grid2: '#a7afaa' },
    black: { paper: '#0b0e0d', dark: true }
  };
  PD.T = {};
  PD.readTheme = function () {
    var k = PD.cfg.bg;
    if (k !== 'auto' && PD.BG[k]) {
      var b = PD.BG[k], p = PAL[b.dark ? 'dark' : 'light'];
      PD.T = { paper: b.paper, grid: b.grid || p.grid, grid2: b.grid2 || p.grid2, fg: p.fg, ink: p.ink };
    } else {
      var cs = getComputedStyle(document.documentElement), g = function (n) { return cs.getPropertyValue(n).trim(); };
      PD.T = { paper: g('--paper'), grid: g('--grid'), grid2: g('--grid2'), fg: g('--fg'), ink: g('--ink') };
    }
    if (PD.ui) PD.ui.refresh();
    PD.redraw();
  };
  PD.setBg = function (k) { PD.cfg.bg = k; PD.readTheme(); PD.saveCfg(); };
})();
