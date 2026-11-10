/* input.js — puntero, pellizco, rueda y atajos. Un dedo dibuja, dos dedos mueven y hacen zoom. */
(function () {
  var cv, ptrs = new Map(), pan = null, pinch = null, bgd = null, noDraw = false, space = false;

  function pos(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, pr: e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 1 }; }
  function two() { var v = Array.from(ptrs.values()); return [v[0], v[1]]; }
  function startPinch() {
    var t = two(), a = t[0], b = t[1], v = PD.view;
    pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, s: v.s, x: v.x, y: v.y, w: PD.bgImg ? PD.bgImg.w : 0 };
    pan = null; bgd = null; noDraw = true;
  }
  function movePinch() {
    var t = two(), a = t[0], b = t[1], d = Math.hypot(a.x - b.x, a.y - b.y) || 1, cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2, bi = PD.bgImg;
    if (bi && bi.edit) {
      bi.w = Math.max(bi.w0 * 0.1, Math.min(bi.w0 * 4, pinch.w * d / pinch.d)); PD.ui.bgSync();
    } else {
      var v = PD.view, ns = PD.clamp(pinch.s * d / pinch.d), wx = (pinch.cx - pinch.x) / pinch.s, wy = (pinch.cy - pinch.y) / pinch.s;
      v.s = ns; v.x = cx - wx * ns; v.y = cy - wy * ns;
    }
    PD.redraw();
  }
  function idleCursor() { var t = PD.cfg.tool; cv.style.cursor = (t === 'hand' || space) ? 'grab' : t === 'eraser' ? 'none' : 'crosshair'; }

  PD.initInput = function (c) {
    cv = c;
    cv.addEventListener('pointerdown', function (e) {
      try { cv.setPointerCapture(e.pointerId); } catch (x) {}
      PD.ui.closePops();
      var p = pos(e), cfg = PD.cfg; ptrs.set(e.pointerId, p);
      if (ptrs.size === 2) { PD.brush.cancel(); PD.eraser.end(); startPinch(); PD.redraw(); return; }
      if (ptrs.size > 2 || noDraw) return;
      if (PD.pick) { PD.ui.pickColor(PD.sampleColor(p.x, p.y)); return; }
      var bi = PD.bgImg;
      if (bi && bi.edit) { bgd = { x: p.x, y: p.y, ix: bi.x, iy: bi.y }; return; }
      if (e.button === 1 || cfg.tool === 'hand' || space) { pan = { x: p.x, y: p.y, vx: PD.view.x, vy: PD.view.y }; cv.style.cursor = 'grabbing'; return; }
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (cfg.tool === 'pen') PD.brush.start(p);
      else if (cfg.tool === 'eraser') PD.eraser.begin(p);
    });

    cv.addEventListener('pointermove', function (e) {
      var p = pos(e);
      if (!ptrs.has(e.pointerId)) {
        if (PD.cfg.tool === 'eraser' && e.pointerType === 'mouse') { PD.eraserPos = p; PD.redraw(); }
        return;
      }
      ptrs.set(e.pointerId, p);
      if (pinch && ptrs.size >= 2) { movePinch(); return; }
      if (noDraw) return;
      if (bgd) { var bi = PD.bgImg; if (bi) { bi.x = bgd.ix + (p.x - bgd.x) / PD.view.s; bi.y = bgd.iy + (p.y - bgd.y) / PD.view.s; PD.redraw(); } return; }
      if (pan) { PD.view.x = pan.vx + p.x - pan.x; PD.view.y = pan.vy + p.y - pan.y; PD.redraw(); return; }
      if (PD.eraser.active) { PD.eraserPos = p; PD.eraser.move(p); }
      else if (PD.cur) {
        var ev = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
        if (!ev.length) ev = [e];
        ev.forEach(function (c) { PD.brush.add(pos(c)); });
        PD.redraw();
      }
    });

    function up(e) {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.delete(e.pointerId);
      if (ptrs.size < 2) pinch = null;
      PD.brush.end(); PD.eraser.end();
      if (e.pointerType !== 'mouse') PD.eraserPos = null;
      bgd = null;
      if (pan) { pan = null; idleCursor(); }
      if (ptrs.size === 0) { noDraw = false; PD.dirty = true; PD.save(); }
      PD.redraw();
    }
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse' && !ptrs.size) { PD.eraserPos = null; PD.redraw(); } });
    cv.addEventListener('wheel', function (e) {
      e.preventDefault();
      var p = pos(e); PD.zoomAt(p.x, p.y, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)));
      PD.dirty = true; PD.save();
    }, { passive: false });
    cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    window.addEventListener('keydown', function (e) {
      if (e.target && e.target.tagName === 'INPUT') return;
      var k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? PD.redo() : PD.undo(); return; }
      if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); PD.redo(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (k === ' ' && !space) { e.preventDefault(); space = true; idleCursor(); }
      else if (k === 'p') PD.ui.setTool('pen');
      else if (k === 'e') PD.ui.setTool('eraser');
      else if (k === 'h') PD.ui.setTool('hand');
    });
    window.addEventListener('keyup', function (e) { if (e.key === ' ') { space = false; idleCursor(); } });
  };
})();
