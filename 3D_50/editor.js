/* editor.js — modo edición sobre Malla: selección V/E/F, mover en 3D, knife (corte), mirror ±X, seam y vista plana.
   Vértice = [x, z, y]. Arrastre: '3d' (plano de la cámara), 'xz' (plano de la pieza) o 'y' (vertical). */
const Editor = (function () {
'use strict';
const X = { S: { obj: null, edit: false, mode: 'v', knife: false, mirror: 0, seam: false, ext: false, xray: false, markOp: 'add', tol: 0.1, flatInfo: '', bgPanel: false, multi: false, kind: 'seam', pt: false, alpha: 1, bgEdit: false, flat: false, flatBack: null, axis: '3d', objSel: false, A: null, P: null, hist: [], ss: null } };
const S = X.S, V3 = THREE.Vector3, EPS = Malla.EPS, MINX = 0.04;   // MINX: distancia mínima al eje de un vértice maestro con pareja
let say = () => {}, notify = () => {};
const newSel = () => ({ v: new Set(), e: new Set(), f: new Set() });
S.ss = newSel();
const hh = v => v[2] || 0;
const AXN = { '3d': '3D', xz: 'plano de la pieza', y: 'relieve (Y)' };

function hint() {
  const h = hint0(); return Escena.viewName ? h + ' · Vista ' + { front: 'frente', side: 'lado', top: 'arriba' }[Escena.viewName] + (Escena.viewBack ? ' (opuesta)' : '') + ' bloqueada: arrastrar mueve la pantalla. Toca la vista otra vez = lado opuesto; un tercer toque = vista libre.' : h;
}
function hint0() {
  if (S.bgEdit) return 'Fondo (vista ' + (Escena.viewName || '—') + '): arrastra para mover la imagen, ⊕ ⊖ cambian el tamaño, ◐ opacidad. 🔓 la deja fija y vuelves a editar.';
  if (S.flat) return 'Aplanado (solo vista previa, tu trabajo 3D no cambia). Arrastra las piezas para separarlas. Azul = bien, rojo = la tela se deformaría más de ' + Math.round(S.tol * 100) + '% (botón %). ' + S.flatInfo + ' ⌗ para volver.';
  const m = S.mirror ? ' · espejo ' + (S.mirror > 0 ? '+X' : '−X') : '';
  if (!S.edit) return 'Arrastra la pieza para moverla. Toca la pieza: gizmo (anillos = girar, cubo = escalar). ✎ para editar.';
  if (S.knife) return (S.A ? 'Toca el final del corte (lo ves antes de soltar). Arrastra el punto amarillo para moverlo. ✂ cancela.' : 'Toca el inicio del corte: arrastra para ajustarlo y suelta para fijarlo.') + m;
  if (S.pt) return 'Añadir vértice: toca una arista (ves el punto antes de soltar) y se crea ahí sin cortar la cara. ⊹ para salir.' + m;
  if (S.seam) return (S.kind === 'guide' ? 'Outline (contorno de frente y de lado): toca una arista para marcarla; tócala otra vez para quitarla. Vuelve a pulsar Outline para salir.' : 'Seam: toca una arista para marcarla como costura; tócala otra vez para quitarla. Vuelve a pulsar Seam para salir.') + m;
  if (S.ext) return 'Extruir (' + { v: 'V', e: 'E', f: 'F' }[S.mode] + '): arrastra un elemento (o la selección) del borde para extruirlo. ⤒ para salir.' + m;
  const t = { v: 'Vértices: toca para seleccionar, arrastra para mover.', e: 'Aristas: toca para seleccionar, arrastra para mover.', f: 'Caras: toca para seleccionar, arrastra para mover.' }[S.mode];
  return t + ' Arrastre: ' + AXN[S.axis] + (S.multi ? ' · varios ☰' : '') + m;
}
function sync() {
  const o = S.obj; if (!o) return;
  const u = o.ui; u.edit = S.edit && !S.flat; u.xray = S.xray || S.alpha < 1; u.alpha = S.alpha; u.tol = S.tol; u.mode = S.mode; u.mirror = S.mirror; u.sel = S.ss; u.kA = S.A && S.A.p; u.kP = S.P && S.P.p;
  Malla.draw(o); Escena.dirty = true; notify();
}
const pushHist = () => { S.hist.push(Malla.snap(S.obj)); if (S.hist.length > 60) S.hist.shift(); };

/* ---------- geometría de apuntado ---------- */
const wp = p => S.obj.group.localToWorld(new V3(p[0], hh(p), p[1]));
const scr = p => Escena.screen(wp(p));
const master = p => !S.mirror || S.mirror * p[0] >= -EPS;   // solo se edita el lado maestro; el otro lo sigue

function vis(p) {   // ¿se ve el punto desde la cámara (sin pieza delante)? En modo wireframe todo cuenta
  if (S.xray || S.alpha < 1) return true;
  const w = wp(p), cm = Escena.cam; let c, d, dist;
  if (cm.isOrthographicCamera) { d = cm.getWorldDirection(new V3()); dist = 6000; c = w.clone().addScaledVector(d, -dist); } else { c = cm.position.clone(); d = w.clone().sub(c); dist = d.length(); d.normalize(); }
  const h = new THREE.Raycaster(c, d, 0, dist).intersectObject(S.obj.mesh, false)[0];
  return !h || h.distance > dist - Math.max(0.8, S.obj.ext * 0.01, dist * 0.003);
}
function pickV(x, y) {
  let best = -1, bd = 24; const o = S.obj;
  Malla.used(o).forEach(i => { const p = o.V[i]; if (!master(p)) return; const s = scr(p); if (!s) return; const d = Math.hypot(s[0] - x, s[1] - y); if (d < bd && vis(p)) { bd = d; best = i; } });
  return best < 0 ? null : { t: 'v', i: best };
}
function pickE(x, y) {
  let best = null, bd = 18; const o = S.obj;
  Malla.edgeList(o).forEach(e => {
    const a = o.V[e.a], b = o.V[e.b]; if (!master([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2])) return;
    const sa = scr(a), sb = scr(b); if (!sa || !sb) return;
    const dx = sb[0] - sa[0], dy = sb[1] - sa[1], l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((x - sa[0]) * dx + (y - sa[1]) * dy) / l2)) : 0;
    const d = Math.hypot(x - sa[0] - t * dx, y - sa[1] - t * dy); if (d < bd && vis([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (hh(a) + hh(b)) / 2])) { bd = d; best = { t: 'e', k: e.k }; }
  });
  return best;
}
function pickF(rc) {   // rayo contra la malla real, así funciona con la pieza elevada o deformada
  const o = S.obj, hit = rc.intersectObject(o.mesh, false)[0]; if (!hit || hit.faceIndex == null) return null;
  const l = o.group.worldToLocal(hit.point.clone()), fi = o.triFace[hit.faceIndex];
  return fi === undefined || !master([l.x, l.z]) ? null : { t: 'f', fi };
}
const key = el => el.t === 'v' ? el.i : el.t === 'e' ? el.k : el.fi;
function elemPos(el) {   // posición local [x, z, y] del elemento tocado
  const o = S.obj;
  if (el.t === 'v') return o.V[el.i];
  if (el.t === 'e') { const [a, b] = el.k.split('-').map(Number), A = o.V[a], B = o.V[b]; return [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (hh(A) + hh(B)) / 2]; }
  const f = o.F[el.fi]; let x = 0, z = 0, y = 0; f.forEach(i => { x += o.V[i][0]; z += o.V[i][1]; y += hh(o.V[i]); }); return [x / f.length, z / f.length, y / f.length];
}

/* ---------- mover selección (3D, con espejo) ---------- */
function affected() {
  const o = S.obj, set = new Set(), s = S.ss;
  if (S.mode === 'v') s.v.forEach(i => set.add(i));
  else if (S.mode === 'e') s.e.forEach(k => k.split('-').forEach(n => set.add(+n)));
  else s.f.forEach(fi => o.F[fi] && o.F[fi].forEach(i => set.add(i)));
  return [...set];
}
function startDrag() {
  const o = S.obj; let list = affected(); if (S.mirror) list = list.filter(i => master(o.V[i]));
  return { list, orig: new Map(list.map(i => [i, o.V[i].slice()])), par: S.mirror ? Malla.partners(o, list) : new Map() };
}
function applyDrag(d, dx, dz, dy) {
  const o = S.obj;
  d.list.forEach(i => {
    const q = d.orig.get(i), j = d.par.get(i); let nx = q[0] + dx; const nz = q[1] + dz, ny = hh(q) + dy;
    if (S.mirror) {
      if (j === i) nx = 0;                                        // los del eje se quedan en el eje
      else if (S.mirror * nx < MINX) nx = S.mirror * MINX;         // un vértice maestro nunca cruza el eje (si cruzara, arrastraría a su pareja)
    }
    o.V[i] = [nx, nz, ny];
    if (S.mirror && j !== undefined && j !== i) o.V[j] = [-nx, nz, ny];
  });
}
function partnerKeys(keys) {   // aristas gemelas (lado espejo) de las aristas dadas
  const o = S.obj, have = new Set(Malla.edgeList(o).map(x => x.k)), P = Malla.partners(o, [...new Set(keys.flatMap(k => k.split('-').map(Number)))]), add = [];
  keys.forEach(k => { const [a, b] = k.split('-').map(Number), pa = P.get(a), pb = P.get(b); if (pa !== undefined && pb !== undefined) { const kk = Malla.ek(pa, pb); if (kk !== k && have.has(kk)) add.push(kk); } });
  return add;
}
function toggleMarks(keys, kind, op) {
  op = op || S.markOp;
  const o = S.obj, set = kind === 'guide' ? o.guides : o.seams; if (S.mirror) keys = keys.concat(partnerKeys(keys));
  pushHist(); const rem = op === 'rem'; keys.forEach(k => rem ? set.delete(k) : set.add(k));
  sync(); say(kind === 'guide' ? (rem ? 'Guía quitada.' : 'Guía marcada.') : (rem ? 'Costura quitada.' : 'Costura marcada.'));
}
function extrudeSel(el) {   // extruye las aristas de borde del elemento (o de toda la selección si el elemento está en ella)
  const o = S.obj; let src = S.ss;
  if (!src[el.t].has(key(el))) { src = newSel(); src[el.t].add(key(el)); }
  if (el.t === 'v' && src.v.size === 1) {   // un vértice del borde: nace un vértice nuevo unido a sus vecinos
    const v = [...src.v][0], P = S.mirror ? Malla.partners(o, [v]).get(v) : undefined, list = P !== undefined && P !== v ? [v, P] : [v];
    pushHist(); const r = Malla.extrudeVertex(o, list, 0.8, !!S.mirror);
    if (!r.length) { S.hist.pop(); say('Solo se extruyen vértices del borde de la pieza.'); return false; }
    S.ss = newSel(); S.ss.v.add(r[0].nv); say('Vértice extruido: arrastra para ubicarlo. ◼ rellena caras entre vértices.'); return true;
  }
  let keys = selEdges(src);
  if (S.mirror) keys = keys.filter(k => { const [a, b] = k.split('-').map(Number); return !(Math.abs(o.V[a][0]) < EPS && Math.abs(o.V[b][0]) < EPS); });
  const mk = new Set(keys), all = S.mirror ? keys.concat(partnerKeys(keys)) : keys;
  pushHist(); const f0 = o.F.length, res = Malla.extrude(o, all, 0.6, !!S.mirror), r = res.filter(x => mk.has(x.k));
  if (!r.length) { S.hist.pop(); say('Solo se extruye lo que toca el borde de la pieza.'); return false; }
  S.ss = newSel();   // la selección nueva respeta el modo activo (V / E / F)
  if (S.mode === 'e') r.forEach(x => S.ss.e.add(x.nk));
  else if (S.mode === 'v') r.forEach(x => x.nk.split('-').forEach(n => S.ss.v.add(+n)));
  else res.forEach((x, i) => { if (mk.has(x.k)) S.ss.f.add(f0 + i); });
  say('Extruido: arrastra para ubicarlo.');
  return true;
}
const o0 = () => S.obj;
function selectCtrl(rc, ev) {
  if (S.seam) { const el = pickE(ev.x, ev.y); return el ? { move() {}, up(moved) { if (!moved) { const set = S.kind === 'guide' ? o0().guides : o0().seams; toggleMarks([el.k], S.kind, set.has(el.k) ? 'rem' : 'add'); } } } : null; }
  const o = S.obj, g = o.group, el = S.mode === 'v' ? pickV(ev.x, ev.y) : S.mode === 'e' ? pickE(ev.x, ev.y) : pickF(rc);
  if (!el) return null;
  const w0 = wp(elemPos(el)); let pl = null, l0 = null, u = null;
  if (S.axis === 'y') {
    // vertical: se mide cuántos píxeles ocupa 1 unidad de altura en pantalla y se convierte el arrastre (acotado si se mira desde arriba)
    const a = Escena.screen(w0), b = Escena.screen(g.localToWorld(new V3(0, 1, 0)).sub(g.localToWorld(new V3(0, 0, 0))).add(w0));
    u = a && b ? [b[0] - a[0], b[1] - a[1]] : [0, -20];
  } else {
    const n = S.axis === 'xz' ? new V3(0, 1, 0).transformDirection(g.matrixWorld) : Escena.cam.getWorldDirection(new V3());
    pl = new THREE.Plane().setFromNormalAndCoplanarPoint(n, w0);
  }
  const hitL = r => { const v = new V3(); return r.ray.intersectPlane(pl, v) ? g.worldToLocal(v) : null; };
  if (pl && !(l0 = hitL(rc))) return null;
  let drag = null, dead = false; const cur = new V3(), maxStep = Math.max(3, o.ext * 0.25);
  return {
    move(r, e) {
      if (dead) return;
      let dx = 0, dy = 0, dz = 0;
      if (S.axis === 'y') { const k = Math.max(Math.hypot(u[0], u[1]), 6); dy = ((e.x - ev.x) * u[0] + (e.y - ev.y) * u[1]) / (k * k); }
      else {
        const l = hitL(r); if (!l) return;
        const step = l.sub(l0).sub(cur); if (step.length() > maxStep) step.setLength(maxStep);   // sin saltos si el plano se ve casi de canto
        cur.add(step); dx = cur.x; dz = cur.z; dy = S.axis === 'xz' ? 0 : cur.y;
      }
      if (!drag) {
        if (S.ext) { if (!extrudeSel(el)) { dead = true; return; } }
        else { pushHist(); if (!S.ss[el.t].has(key(el))) { S.ss = newSel(); S.ss[el.t].add(key(el)); } }
        drag = startDrag();
      }
      applyDrag(drag, dx, dz, dy); sync();
    },
    up(moved) { if (moved) return; const s = S.ss[el.t], k = key(el); if (S.multi) { if (s.has(k)) s.delete(k); else s.add(k); } else { const only = s.size === 1 && s.has(k); S.ss = newSel(); if (!only) S.ss[el.t].add(k); } sync(); }
  };
}

/* ---------- knife ---------- */
/* Devuelve el objetivo de corte (vértice o punto en arista) más cercano al puntero. 'far': sin distancia máxima (durante el arrastre
   el punto sigue al puntero y siempre queda sobre algo válido). Con A fijado solo se ofrecen finales válidos. */
function snap(x, y, A, far) {
  const o = S.obj, V = o.V, cand = [];
  Malla.used(o).forEach(i => { if (!master(V[i])) return; const s = scr(V[i]); if (!s) return; const d = Math.hypot(s[0] - x, s[1] - y); if ((far || d < 26) && vis(V[i])) cand.push({ d, vtx: d < 26, T: { k: 'v', i, p: V[i] } }); });
  Malla.edgeList(o).forEach(e => {
    const a = V[e.a], b = V[e.b], sa = scr(a), sb = scr(b); if (!sa || !sb) return;
    const dx = sb[0] - sa[0], dy = sb[1] - sa[1], l2 = dx * dx + dy * dy; if (!l2) return;
    const t = Math.max(0.02, Math.min(0.98, ((x - sa[0]) * dx + (y - sa[1]) * dy) / l2)), d = Math.hypot(x - sa[0] - t * dx, y - sa[1] - t * dy);
    const p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, hh(a) + (hh(b) - hh(a)) * t];
    if ((far || d < 16) && master(p) && vis(p)) cand.push({ d, vtx: false, T: { k: 'e', a: e.a, b: e.b, t, p } });
  });
  cand.sort((u, w) => (w.vtx - u.vtx) || (u.d - w.d));        // un vértice cercano gana sobre una arista
  let tries = 0;
  for (const c of cand) {
    if (!A) return Object.assign({ d: c.d }, c.T);
    if (Math.hypot(c.T.p[0] - A.p[0], c.T.p[1] - A.p[1]) < EPS) continue;
    if (++tries > 14) break;
    if (Malla.pathValid(o, A.p, c.T.p)) return Object.assign({ d: c.d }, c.T);
  }
  return null;
}
function doCut(A, B) {
  const o = S.obj, back = Malla.snap(o); pushHist();
  const pa = [A.p[0], A.p[1]], pb = [B.p[0], B.p[1]];
  if (Malla.cutPath(o, pa, pb) <= 0) { Malla.restore(o, back); S.hist.pop(); say('Ese corte no es válido.'); return; }
  if (S.mirror) Malla.cutPath(o, [-pa[0], pa[1]], [-pb[0], pb[1]]);
  S.ss = newSel(); say('Corte hecho. Toca otro inicio, o ✂ para salir.');
}
function knifeCtrl(rc, ev) {
  // 1) agarrar el punto de inicio ya fijado y moverlo
  if (S.A) { const s = scr(S.A.p); if (s && Math.hypot(s[0] - ev.x, s[1] - ev.y) < 26) return {
    move(r, e) { const T = snap(e.x, e.y, null, true); if (T) { S.A = T; S.P = null; sync(); } },
    up() { S.P = null; sync(); }
  }; }
  // 2) en modo knife el toque cerca de la pieza o sobre ella es del knife (no gira la cámara ni mueve la pieza)
  const T = snap(ev.x, ev.y, S.A, true); if (!T) return null;
  if (T.d > 60 && !rc.intersectObject(S.obj.mesh, false)[0]) return null;   // lejos de la pieza: la cámara gira
  S.P = T; sync();
  return {
    move(r, e) { S.P = snap(e.x, e.y, S.A, true) || S.P; sync(); },
    up() {
      if (S.P) { if (!S.A) { S.A = S.P; S.P = null; say(hint()); } else { const A = S.A, B = S.P; S.A = S.P = null; doCut(A, B); } }
      sync();
    }
  };
}

/* ---------- modo objeto (mover / girar / escalar) ---------- */
function objectCtrl(rc, ev) {
  const o = S.obj, g = Gizmo.pick(rc, Escena.cam, ev); if (g) return g;
  const hit = rc.intersectObject(o.mesh, false)[0]; if (!hit) return null;
  const pl = new THREE.Plane().setFromNormalAndCoplanarPoint(Escena.cam.getWorldDirection(new V3()).clone(), hit.point), p0 = hit.point.clone(), g0 = o.group.position.clone();
  return {
    move(r) { const v = new V3(); if (r.ray.intersectPlane(pl, v)) { o.group.position.copy(g0).add(v.sub(p0)); o.group.position.y = Math.max(0, o.group.position.y); } },
    up(moved) { if (!moved) { S.objSel = !S.objSel; Gizmo.show(S.objSel); } }
  };
}

/* ---------- rellenar (fill): cara nueva con los vértices / aristas seleccionados ---------- */
function connectTwo(a, b) {   // une dos vértices con una arista nueva (corta la cara por la línea entre ambos)
  const o = S.obj, A = o.V[a], B = o.V[b];
  if (Malla.edgeList(o).some(x => x.k === Malla.ek(a, b))) { say('Esa arista ya existe.'); return; }
  if (!Malla.pathValid(o, A, B)) { say('No se puede unir: la línea sale de la pieza o cruza un hueco.'); return; }
  const back = Malla.snap(o); pushHist();
  const pa = [A[0], A[1]], pb = [B[0], B[1]];
  if (Malla.cutPath(o, pa, pb) <= 0) { Malla.restore(o, back); S.hist.pop(); say('No se pudo crear la arista.'); return; }
  if (S.mirror && (Math.abs(pa[0]) > EPS || Math.abs(pb[0]) > EPS)) Malla.cutPath(o, [-pa[0], pa[1]], [-pb[0], pb[1]]);
  S.ss = newSel(); sync(); say('Arista creada.');
}
function fillSel() {
  const o = S.obj, s = S.ss; let vs;
  if (S.mode === 'v') vs = [...s.v]; else if (S.mode === 'e') vs = [...new Set([...s.e].flatMap(k => k.split('-').map(Number)))];
  else { say('Fill: elige vértices (V) o aristas (E). 2 vértices crean una arista, 3 o más crean una cara.'); return; }
  if (vs.length === 2) { connectTwo(vs[0], vs[1]); return; }
  if (vs.length < 3) { say('Fill: 2 vértices crean una arista, 3 o más crean una cara.'); return; }
  let order = null;
  if (S.mode === 'e') {   // si las aristas forman un solo ciclo, se respeta ese orden
    const adj = new Map(); [...s.e].forEach(k => { const [a, b] = k.split('-').map(Number); (adj.get(a) || adj.set(a, []).get(a)).push(b); (adj.get(b) || adj.set(b, []).get(b)).push(a); });
    if ([...adj.values()].every(l => l.length === 2)) { const st = vs[0], seq = [st]; let prev = -1, cur = st;
      for (let i = 0; i < vs.length; i++) { const nx = adj.get(cur).find(n => n !== prev) ?? adj.get(cur)[0]; if (nx === st) break; seq.push(nx); prev = cur; cur = nx; }
      if (seq.length === vs.length) order = seq; }
  }
  if (!order) { let cx = 0, cz = 0; vs.forEach(i => { cx += o.V[i][0]; cz += o.V[i][1]; }); cx /= vs.length; cz /= vs.length;
    order = vs.slice().sort((a, b) => Math.atan2(o.V[a][1] - cz, o.V[a][0] - cx) - Math.atan2(o.V[b][1] - cz, o.V[b][0] - cx)); }
  const sig = f => f.slice().sort((a, b) => a - b).join(','), have = new Set(o.F.map(sig));
  let cx = 0, cz = 0; order.forEach(i => { cx += o.V[i][0]; cz += o.V[i][1]; }); cx /= order.length; cz /= order.length;
  if (have.has(sig(order))) { say('Esa cara ya existe.'); return; }
  if (o.F.some(f => Malla.inPoly(cx, cz, f.map(i => o.V[i])))) { say('Ahí ya hay una cara (se encimaría).'); return; }
  pushHist(); o.F.push(order);
  if (S.mirror) { const P = Malla.partners(o, order), mp = order.map(i => P.get(i)); if (mp.every(i => i !== undefined) && sig(mp) !== sig(order) && !have.has(sig(mp))) o.F.push(mp); }
  sync(); say('Cara creada.');
}
X.dxf = () => {
  let o = S.obj; if (!o) return null;
  if (S.flat) { const d = JSON.parse(S.flatBack.snap); o = { V: d.V, F: d.F, seams: new Set(d.s) }; }
  return Malla.toDXF(o, S.mirror);
};
X.fill = () => { if (S.obj && S.edit && !S.flat) fillSel(); };

/* ---------- añadir vértice sobre una arista (sin cortar la cara) / subdividir / eliminar ---------- */
function addPoint(T) {
  const o = S.obj; if (T.k !== 'e') return null; const px = T.p[0], pz = T.p[1], i = Malla.splitEdge(o, T.a, T.b, T.t);
  if (S.mirror && Math.abs(px) > EPS) { const mt = Malla.targetAt(o, [-px, pz]); if (mt && mt.k === 'e') Malla.splitEdge(o, mt.a, mt.b, mt.t); }
  return i;
}
function ptCtrl(rc, ev) {
  const T = snap(ev.x, ev.y, null, true); if (!T) return null;
  if (T.d > 60 && !rc.intersectObject(S.obj.mesh, false)[0]) return null;
  S.P = T; sync();
  return {
    move(r, e) { S.P = snap(e.x, e.y, null, true) || S.P; sync(); },
    up() {
      const T = S.P; S.P = null;
      if (T && T.k === 'e') { pushHist(); const i = addPoint(T); S.mode = 'v'; S.ss = newSel(); S.ss.v.add(i); say('Vértice creado. Arrástralo (modo V) o ⊹ para seguir.'); }
      else if (T) say('Ya hay un vértice ahí.');
      sync();
    }
  };
}
X.setPt = on => { S.pt = !!on; if (S.pt) S.knife = S.seam = S.ext = false; S.A = S.P = null; S.ss = newSel(); sync(); say(hint()); };
X.subdivide = () => {
  if (!S.obj || !S.edit || S.flat) return; const o = S.obj; let keys = selEdges();
  if (!keys.length) { say('Selecciona aristas (E) y pulsa ÷ para partirlas por la mitad.'); return; }
  if (S.mirror) keys = [...new Set(keys.concat(partnerKeys(keys)))];
  const have = new Set(Malla.edgeList(o).map(x => x.k)); keys = keys.filter(k => have.has(k));
  pushHist(); const ids = keys.map(k => { const [a, b] = k.split('-').map(Number); return Malla.splitEdge(o, a, b, 0.5); });
  S.mode = 'v'; S.ss = newSel(); ids.forEach(i => S.ss.v.add(i)); sync(); say('Aristas partidas: los vértices nuevos quedan seleccionados.');
};
function delSel() {
  const o = S.obj, s = S.ss; if (!(s.v.size + s.e.size + s.f.size)) { say('Selecciona algo y pulsa ⌫ para eliminarlo.'); return; }
  pushHist();
  if (S.mode === 'f') {
    const set = new Set(s.f), sig = f => f.slice().sort((a, b) => a - b).join(','), map = new Map(o.F.map((f, i) => [sig(f), i]));
    if (S.mirror) [...s.f].forEach(fi => { const f = o.F[fi]; if (!f) return; const P = Malla.partners(o, f), mp = f.map(i => P.get(i)); if (mp.every(i => i !== undefined)) { const j = map.get(sig(mp)); if (j !== undefined) set.add(j); } });
    Malla.removeFaces(o, set);
  } else if (S.mode === 'e') {
    let keys = [...s.e]; if (S.mirror) keys = [...new Set(keys.concat(partnerKeys(keys)))]; keys.forEach(k => Malla.dissolveEdge(o, k));
  } else {
    let vs = [...s.v]; if (S.mirror) { Malla.partners(o, vs).forEach(j => vs.push(j)); vs = [...new Set(vs)]; } vs.forEach(v => Malla.deleteVertex(o, v));
  }
  S.ss = newSel(); sync(); say('Eliminado. (Arista interior = une sus dos caras; vértice con 2 aristas = se disuelve.)');
}
X.del = () => { if (S.obj && S.edit && !S.flat) delSel(); };

/* ---------- fondo de referencia ---------- */
function bgCtrl(rc) {
  const b = Escena.bgs[Escena.viewName]; if (!b) return null;
  const pl = new THREE.Plane().setFromNormalAndCoplanarPoint(new V3(0, 0, 1).applyQuaternion(b.quaternion), b.position), p0 = new V3(); if (!rc.ray.intersectPlane(pl, p0)) return null;
  const b0 = b.position.clone();
  return { move(r) { const v = new V3(); if (r.ray.intersectPlane(pl, v)) { b.position.copy(b0).add(v.sub(p0)); Escena.dirty = true; } }, up() {} };
}

/* ---------- aplanado: mover piezas en 2D ---------- */
function flatCtrl(rc) {
  const o = S.obj, g = o.group, hit = rc.intersectObject(o.mesh, false)[0]; if (!hit || o.triFace[hit.faceIndex] === undefined) return null;
  const fi = o.triFace[hit.faceIndex], p = o.F.map((_, i) => i), fd = x => { while (p[x] !== x) x = p[x] = p[p[x]]; return x; }, seen = new Map();
  o.F.forEach((f, i) => f.forEach(v => { if (seen.has(v)) p[fd(i)] = fd(seen.get(v)); else seen.set(v, i); }));
  const vs = new Set(); o.F.forEach((f, i) => { if (fd(i) === fd(fi)) f.forEach(v => vs.add(v)); });
  const orig = new Map([...vs].map(v => [v, o.V[v].slice()])), pl = new THREE.Plane(new V3(0, 1, 0), -hit.point.y), l0 = g.worldToLocal(hit.point.clone());
  return { move(r) { const v = new V3(); if (!r.ray.intersectPlane(pl, v)) return; const l = g.worldToLocal(v); orig.forEach((q, i) => { o.V[i] = [q[0] + l.x - l0.x, q[1] + l.z - l0.z, 0]; }); sync(); }, up() {} };
}

/* ---------- API ---------- */
X.init = o => {
  say = o.say || say; notify = o.onState || notify;
  Escena.ctrl = (rc, ev) => {
    if (!S.obj) return null; S.obj.group.updateMatrixWorld(true);
    if (S.flat) return flatCtrl(rc);
    if (S.bgEdit) return bgCtrl(rc);
    if (!S.edit) return objectCtrl(rc, ev);
    return S.knife ? knifeCtrl(rc, ev) : S.pt ? ptCtrl(rc, ev) : selectCtrl(rc, ev);
  };
  Escena.onTapEmpty = () => {
    if (!S.obj) return;
    if (!S.edit) { if (S.objSel) { S.objSel = false; Gizmo.show(false); Escena.dirty = true; } return; }
    if (S.knife && S.A) { S.A = S.P = null; sync(); say(hint()); return; }
    if (S.ss.v.size + S.ss.e.size + S.ss.f.size) { S.ss = newSel(); sync(); }
  };
};
X.load = function (d) {
  if (S.obj) { Escena.scene.remove(S.obj.group); S.obj.mesh.geometry.dispose(); }
  const o = Malla.build(d); S.obj = o; const bb = Malla.bbox(o), y0 = (bb[3] - bb[1]) / 2 + 2; o.group.position.set(0, y0, 0); o.group.rotation.x = Math.PI / 2; Escena.scene.add(o.group); o.group.updateMatrixWorld(true);
  Escena.follow = o.group; Escena.shadow.scale.set(o.ext * 1.3, o.ext * 1.3, 1); Gizmo.attach(o.group, o.ext * 0.7); Gizmo.show(false);
  Object.assign(S, { flat: false, flatBack: null, edit: false, knife: false, seam: false, ext: false, pt: false, mirror: 0, objSel: false, A: null, P: null, hist: [], ss: newSel(), mode: 'v' });
  Escena.persp(); Escena.setTarget(0, y0, 0); Escena.fit(o.ext); sync(); say(hint());
};
X.setEdit = on => { if (S.flat) return; S.edit = !!on; if (!S.edit) { S.knife = false; S.seam = false; S.ext = false; S.pt = false; S.A = S.P = null; S.ss = newSel(); } S.objSel = false; Gizmo.show(false); sync(); say(hint()); };
X.setMode = m => { S.mode = m; S.seam = false; S.pt = false; S.ss = newSel(); S.A = S.P = null; sync(); say(hint()); };
X.setKnife = on => { S.knife = !!on; if (S.knife) { S.seam = false; S.ext = false; S.pt = false; } S.A = S.P = null; S.ss = newSel(); sync(); say(hint()); };
X.setSeam = (on, kind) => { S.seam = !!on; if (kind) S.kind = kind; if (S.seam) { S.knife = false; S.ext = false; S.pt = false; S.mode = 'e'; } S.A = S.P = null; S.ss = newSel(); sync(); say(hint()); };
X.setExt = on => { S.ext = !!on; if (S.ext) { S.knife = false; S.seam = false; S.pt = false; } S.A = S.P = null; sync(); say(hint()); };
X.setView = n => { if (n) Escena.view(n); else Escena.persp(); sync(); say(hint()); };
X.cycleAlpha = () => { const L = [1, 0.5, 0.25, 0.1], i = L.findIndex(x => Math.abs(x - S.alpha) < 0.01); S.alpha = L[(i + 1) % 4]; sync(); say('Transparencia de la pieza: ' + Math.round((1 - S.alpha) * 100) + '%'); };
X.bgLoad = url => {
  const v = Escena.viewName; if (!v) { say('Primero elige una vista (Fr, Lado o Arr) y luego carga la imagen.'); return; }
  const o = S.obj; Escena.bgLoad(v, url, o.ext, o.group.position, () => { S.bgEdit = true; S.alpha = Math.min(S.alpha, 0.5); sync(); say(hint()); });
};
X.setBgEdit = on => { S.bgEdit = !!on; sync(); say(hint()); };
X.bgScale = f => { const b = Escena.bgs[Escena.viewName]; if (!b) { say('Elige la vista de esa imagen (Fr, Lado o Arr).'); return; } b.scale.multiplyScalar(f); Escena.dirty = true; };
X.bgOpacity = () => { const b = Escena.bgs[Escena.viewName]; if (!b) { say('Elige la vista de esa imagen (Fr, Lado o Arr).'); return; } const L = [0.5, 0.25, 0.85], i = L.findIndex(x => Math.abs(x - b.material.opacity) < 0.01); b.material.opacity = L[(i + 1) % 3]; Escena.dirty = true; };
X.bgRemove = () => { const v = Escena.viewName; if (!Escena.bgs[v]) { say('Elige la vista de la imagen que quieres quitar.'); return; } Escena.bgRemove(v); if (!Object.keys(Escena.bgs).length) S.bgEdit = false; sync(); say(hint()); };
X.setMulti = on => { S.multi = !!on; sync(); say(S.multi ? 'Selección múltiple: cada toque suma o quita.' : 'Selección simple: cada toque elige solo uno.'); };
X.genShape = () => {   // inflar: la pieza se redondea como un globo; con guías (≈) se ajusta a ellas
  const o = S.obj; if (!o || !S.edit || S.flat) return; pushHist();
  const r = Malla.inflate(o, { axisFree: !!S.mirror, guides: o.guides });
  if (!r) { S.hist.pop(); say('No se puede inflar: la pieza necesita un contorno abierto (arista de borde).'); return; }
  S.ss = newSel(); sync(); say('Inflado' + (r.fit ? ' ajustado a tus guías ≈' : ' (altura según el tamaño; ⇑ ⇓ la cambian)') + '. ↶ para deshacer.');
};
X.scaleY = f => {
  const o = S.obj; if (!o || S.flat) return; pushHist(); Malla.used(o).forEach(i => { o.V[i][2] = (o.V[i][2] || 0) * f; }); sync(); say('Altura ×' + f.toFixed(2));
};
X.cycleTol = () => { const L = [0.03, 0.05, 0.1, 0.2], i = L.findIndex(x => Math.abs(x - S.tol) < 1e-6); S.tol = L[(i + 1) % 4]; sync(); say(hint()); };
X.setBgPanel = on => {
  if (on && !Escena.viewName) Escena.view('front');
  S.bgPanel = !!on; if (!on) S.bgEdit = false; sync(); say(hint()); return true;
};
X.setMarkOp = op => { S.markOp = op; sync(); say(hint()); };
X.markApply = () => {   // ✓: si hay aristas seleccionadas se les aplica la operación; luego se sale del modo
  const k = selEdges(); if (k.length && S.obj) toggleMarks(k, S.kind, S.markOp); X.setSeam(false);
};
X.setXray = on => { S.xray = !!on; sync(); say(S.xray ? 'Wireframe: ves también lo de atrás.' : 'Solo se ve y se selecciona lo de enfrente.'); };
X.setMirror = m => {
  if (m && !S.mirror) { pushHist(); const n = Malla.axisPrep(S.obj); if (!n) S.hist.pop(); else say('Espejo: se crearon vértices en el eje.'); }
  S.mirror = m; sync(); say(hint()); };
X.cycleAxis = () => { S.axis = S.axis === '3d' ? 'xz' : S.axis === 'xz' ? 'y' : '3d'; sync(); say(hint()); };
X.undo = () => {
  if (S.A) { S.A = S.P = null; sync(); say(hint()); return; }
  if (!S.hist.length) return; Malla.restore(S.obj, S.hist.pop()); S.ss = newSel(); sync(); say('Deshecho.');
};
X.flat = () => {   // alterna la vista previa aplanada (no modifica la malla: al volver se restaura todo)
  if (!S.obj) return; const o = S.obj, g = o.group;
  if (S.flat) {
    const B = S.flatBack; Malla.restore(o, B.snap); o.stress = null; g.quaternion.copy(B.q); g.updateMatrixWorld(true);
    S.flat = false; S.flatBack = null; Escena.theta = B.th; Escena.phi = B.ph; Escena.setTarget(g.position.x, g.position.y, g.position.z); sync(); say('De vuelta a la edición 3D.'); return;
  }
  S.flatBack = { snap: Malla.snap(o), q: g.quaternion.clone(), th: Escena.theta, ph: Escena.phi };
  S.knife = S.seam = S.ext = S.pt = false; S.A = S.P = null; S.ss = newSel(); S.objSel = false; Gizmo.show(false);
  Escena.persp(); S.bgEdit = false; const u = Malla.unfold(o, S.mirror); S.flatInfo = 'Deformación máx ' + (u.max * 100).toFixed(1) + '%, promedio ' + (u.mean * 100).toFixed(1) + '%.'; S.bgPanel = false; o.V = u.V; o.F = u.F; o.seams = new Set(); o.stress = u.stress;
  g.rotation.set(0, 0, 0); g.updateMatrixWorld(true); S.flat = true;
  Escena.theta = 0; Escena.phi = 1.45; Escena.setTarget(g.position.x, g.position.y, g.position.z); Escena.fit(o.ext); Escena.theta = 0; Escena.phi = 1.45; Escena.setTarget(g.position.x, g.position.y, g.position.z);
  sync(); say(hint());
};
function selEdges(s = S.ss) {
  const o = S.obj;
  if (S.mode === 'e') return [...s.e];
  if (S.mode === 'v') return Malla.edgeList(o).filter(e => s.v.has(e.a) && s.v.has(e.b)).map(e => e.k);
  const out = new Set(); s.f.forEach(fi => { const f = o.F[fi]; if (f) f.forEach((a, k) => out.add(Malla.ek(a, f[(k + 1) % f.length]))); }); return [...out];
}
X.seam = () => { const k = selEdges(); if (!k.length) { say('Activa ⛓ y toca aristas para marcar costuras.'); return; } toggleMarks(k, 'seam', 'add'); };
return X;
})();
