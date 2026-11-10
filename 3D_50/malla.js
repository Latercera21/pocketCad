/* malla.js — malla editable plana (vértices + caras) en el plano XZ del grupo.
   Cada vértice es [x, z, y] (y = altura, opcional). Los cortes y el espejo trabajan sobre la proyección XZ.
   Los índices de vértices nunca se reutilizan (los cortes solo añaden), así las costuras y selecciones son estables. */
const Malla = (function () {
'use strict';
const M = { EPS: 0.02 };
const PXCM = 37.79527559055118;
const ek = (a, b) => a < b ? a + '-' + b : b + '-' + a;
M.ek = ek;

function bezQ(a, c, b, t) { const u = 1 - t; return [u*u*a[0] + 2*u*t*c[0] + t*t*b[0], u*u*a[1] + 2*u*t*c[1] + t*t*b[1]]; }
function bezC(a, c1, c2, b, t) {
  const u = 1 - t, w0 = u*u*u, w1 = 3*u*u*t, w2 = 3*u*t*t, w3 = t*t*t;
  return [w0*a[0] + w1*c1[0] + w2*c2[0] + w3*b[0], w0*a[1] + w1*c1[1] + w2*c2[1] + w3*b[1]];
}
function inPoly(x, y, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0]-a[0]) * (y-a[1]) / (b[1]-a[1]) + a[0]) c = !c;
  }
  return c;
}
M.inPoly = inPoly;

/* ---------- triangulación (ear clipping) ---------- */
function inTri(p, a, b, c, s) {
  const d1 = ((b[0]-a[0])*(p[1]-a[1]) - (b[1]-a[1])*(p[0]-a[0])) * s;
  const d2 = ((c[0]-b[0])*(p[1]-b[1]) - (c[1]-b[1])*(p[0]-b[0])) * s;
  const d3 = ((a[0]-c[0])*(p[1]-c[1]) - (a[1]-c[1])*(p[0]-c[0])) * s;
  return d1 > 1e-9 && d2 > 1e-9 && d3 > 1e-9;
}
function tri(f, V) {
  const n = f.length; if (n < 3) return [];
  if (n === 3) return [[f[0], f[1], f[2]]];
  let a = 0; for (let i = 0; i < n; i++) { const p = V[f[i]], q = V[f[(i+1)%n]]; a += p[0]*q[1] - q[0]*p[1]; }
  const s = a >= 0 ? 1 : -1, idx = f.slice(), out = [];
  for (let guard = 0; idx.length > 3 && guard < 2000; guard++) {
    let ear = false;
    for (let i = 0; i < idx.length; i++) {
      const ia = idx[(i + idx.length - 1) % idx.length], ib = idx[i], ic = idx[(i + 1) % idx.length];
      const A = V[ia], B = V[ib], C = V[ic];
      if (((B[0]-A[0])*(C[1]-A[1]) - (B[1]-A[1])*(C[0]-A[0])) * s <= 1e-9) continue;
      let ok = true;
      for (const j of idx) { if (j === ia || j === ib || j === ic) continue; if (inTri(V[j], A, B, C, s)) { ok = false; break; } }
      if (!ok) continue;
      out.push([ia, ib, ic]); idx.splice(i, 1); ear = true; break;
    }
    if (!ear) break;
  }
  if (idx.length === 3) out.push([idx[0], idx[1], idx[2]]);
  else for (let i = 1; i < idx.length - 1; i++) out.push([idx[0], idx[i], idx[i+1]]);
  return out;
}

/* ---------- consultas ---------- */
M.used = o => { const s = new Set(); o.F.forEach(f => f.forEach(i => s.add(i))); return [...s]; };
M.edgeList = o => {
  const m = new Map();
  o.F.forEach((f, fi) => { const n = f.length; for (let k = 0; k < n; k++) { const a = f[k], b = f[(k+1)%n], key = ek(a, b); let e = m.get(key); if (!e) m.set(key, e = { a, b, k: key, fs: [] }); e.fs.push(fi); } });
  return [...m.values()];
};
M.bbox = o => {
  let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
  M.used(o).forEach(i => { const p = o.V[i]; x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); });
  return [x0, z0, x1, z1];
};
/* vértice espejo (misma Z, X opuesta). En el eje devuelve el mismo; sin espejo no aparece en el mapa. */
M.partners = (o, list) => {
  const U = M.used(o), r = new Map();
  list.forEach(i => {
    const p = o.V[i]; if (Math.abs(p[0]) < M.EPS) { r.set(i, i); return; }
    for (const j of U) { const q = o.V[j]; if (Math.abs(q[0] + p[0]) < M.EPS && Math.abs(q[1] - p[1]) < M.EPS) { r.set(i, j); break; } }
  });
  return r;
};
/* objetivo (vértice o punto de una arista) en una posición dada, o null */
M.targetAt = (o, p) => {
  for (const i of M.used(o)) if (Math.hypot(o.V[i][0] - p[0], o.V[i][1] - p[1]) < M.EPS) return { k: 'v', i, p: o.V[i] };
  for (const e of M.edgeList(o)) {
    const a = o.V[e.a], b = o.V[e.b], dx = b[0]-a[0], dz = b[1]-a[1], l2 = dx*dx + dz*dz; if (!l2) continue;
    const t = ((p[0]-a[0])*dx + (p[1]-a[1])*dz) / l2; if (t <= 0 || t >= 1) continue;
    const q = [a[0] + t*dx, a[1] + t*dz]; if (Math.hypot(q[0]-p[0], q[1]-p[1]) < M.EPS) return { k: 'e', a: e.a, b: e.b, t, p: q };
  }
  return null;
};

/* ---------- operaciones de corte ---------- */
M.splitEdge = (o, a, b, t) => {
  const A = o.V[a], B = o.V[b], idx = o.V.length;
  o.V.push([A[0] + (B[0]-A[0])*t, A[1] + (B[1]-A[1])*t, (A[2] || 0) + ((B[2] || 0) - (A[2] || 0)) * t]);
  o.F.forEach(f => { const n = f.length; for (let k = 0; k < n; k++) { const u = f[k], w = f[(k+1)%n]; if ((u === a && w === b) || (u === b && w === a)) { f.splice(k + 1, 0, idx); break; } } });
  const key = ek(a, b); if (o.seams.has(key)) { o.seams.delete(key); o.seams.add(ek(a, idx)); o.seams.add(ek(idx, b)); }
  if (o.guides && o.guides.has(key)) { o.guides.delete(key); o.guides.add(ek(a, idx)); o.guides.add(ek(idx, b)); }
  return idx;
};
function anchor(f, T) {
  const n = f.length;
  if (T.k === 'v') { const p = f.indexOf(T.i); return p < 0 ? null : { k: 'v', p }; }
  for (let k = 0; k < n; k++) { const u = f[k], w = f[(k+1)%n]; if ((u === T.a && w === T.b) || (u === T.b && w === T.a)) return { k: 'e', p: k }; }
  return null;
}
function adjV(p, q, n) { const d = Math.abs(p - q); return d === 0 || d === 1 || d === n - 1; }
function anchorsOk(a, b, n) {
  if (a.k === 'v' && b.k === 'v') return !adjV(a.p, b.p, n);
  if (a.k === 'e' && b.k === 'e') return a.p !== b.p;
  const v = a.k === 'v' ? a : b, e = a.k === 'v' ? b : a;
  return v.p !== e.p && v.p !== (e.p + 1) % n;
}
function segX(p1, p2, p3, p4) {
  const d = (a, b, c) => (b[0]-a[0])*(c[1]-a[1]) - (b[1]-a[1])*(c[0]-a[0]);
  const d1 = d(p3, p4, p1), d2 = d(p3, p4, p2), d3 = d(p1, p2, p3), d4 = d(p1, p2, p4);
  return ((d1 > 1e-9 && d2 < -1e-9) || (d1 < -1e-9 && d2 > 1e-9)) && ((d3 > 1e-9 && d4 < -1e-9) || (d3 < -1e-9 && d4 > 1e-9));
}
function chordOk(o, f, pa, pb) {
  const n = f.length;
  for (let k = 0; k < n; k++) if (segX(pa, pb, o.V[f[k]], o.V[f[(k+1)%n]])) return false;
  return inPoly((pa[0]+pb[0])/2, (pa[1]+pb[1])/2, f.map(i => o.V[i]));
}
/* ¿existe una cara donde A y B se puedan unir con un corte válido? */
M.cutValid = (o, A, B) => {
  const pa = A.k === 'v' ? o.V[A.i] : A.p, pb = B.k === 'v' ? o.V[B.i] : B.p;
  for (const f of o.F) {
    const ra = anchor(f, A), rb = anchor(f, B); if (!ra || !rb) continue;
    if (anchorsOk(ra, rb, f.length) && chordOk(o, f, pa, pb)) return true;
  }
  return false;
};
M.cutFace = (o, ia, ib) => {
  for (let fi = 0; fi < o.F.length; fi++) {
    const f = o.F[fi], n = f.length, pa = f.indexOf(ia), pb = f.indexOf(ib); if (pa < 0 || pb < 0) continue;
    const d = Math.abs(pa - pb); if (d <= 1 || d === n - 1) continue;
    const lo = Math.min(pa, pb), hi = Math.max(pa, pb);
    o.F[fi] = f.slice(lo, hi + 1); o.F.push(f.slice(hi).concat(f.slice(0, lo + 1))); return true;
  }
  return false;
};
/* corta entre dos objetivos {k:'v',i} | {k:'e',a,b,t}; devuelve {ia,ib} o null */
M.cut = (o, A, B) => {
  if (!M.cutValid(o, A, B)) return null;
  const ia = A.k === 'v' ? A.i : M.splitEdge(o, A.a, A.b, A.t);
  const ib = B.k === 'v' ? B.i : M.splitEdge(o, B.a, B.b, B.t);
  return M.cutFace(o, ia, ib) ? { ia, ib } : null;
};

/* ---------- espejo: vértices sobre el eje X=0 ----------
   Al activar el espejo se parten las aristas que cruzan el eje (nacen vértices en X=0) y se corta cada cara que lo cruza.
   Así hay puntos en el eje donde terminar cortes, y los vértices del eje se mueven solo a lo largo de él. Devuelve nº de cambios. */
M.axisPrep = o => {
  let n = 0;
  M.edgeList(o).forEach(e => {
    const a = o.V[e.a], b = o.V[e.b];
    if ((a[0] > M.EPS && b[0] < -M.EPS) || (a[0] < -M.EPS && b[0] > M.EPS)) { const i = M.splitEdge(o, e.a, e.b, a[0] / (a[0] - b[0])); o.V[i][0] = 0; n++; }
  });
  for (let fi = 0; fi < o.F.length; fi++) {
    const f = o.F[fi], ax = f.filter(i => Math.abs(o.V[i][0]) < M.EPS);
    if (ax.length !== 2 || !f.some(i => o.V[i][0] > M.EPS) || !f.some(i => o.V[i][0] < -M.EPS)) continue;
    if (M.cutValid(o, { k: 'v', i: ax[0] }, { k: 'v', i: ax[1] }) && M.cutFace(o, ax[0], ax[1])) n++;
  }
  return n;
};

/* ---------- extruir aristas de borde ----------
   Por cada arista de borde (1 sola cara) crea un cuadrilátero nuevo hacia afuera. Los vértices nuevos se comparten entre aristas
   encadenadas. Devuelve [{k: arista original, nk: arista nueva}]. ax: los vértices del eje se quedan en X=0. */
M.extrude = (o, keys, off, ax) => {
  const EL = new Map(M.edgeList(o).map(e => [e.k, e])), list = [];
  keys.forEach(k => {
    const e = EL.get(k); if (!e || e.fs.length !== 1) return;
    const f = o.F[e.fs[0]], n = f.length; let a = e.a, b = e.b;
    if (f[(f.indexOf(a) + 1) % n] !== b) { a = e.b; b = e.a; }           // a->b = sentido de la arista dentro de la cara
    let s = 0; for (let q = 0; q < n; q++) { const p = o.V[f[q]], r = o.V[f[(q + 1) % n]]; s += p[0] * r[1] - r[0] * p[1]; } s = s >= 0 ? 1 : -1;
    const A = o.V[a], B = o.V[b], dx = B[0] - A[0], dz = B[1] - A[1], l = Math.hypot(dx, dz) || 1;
    list.push({ a, b, nx: s * dz / l, nz: -s * dx / l });
  });
  const acc = new Map(), nv = new Map();
  list.forEach(r => [r.a, r.b].forEach(v => { const c = acc.get(v) || [0, 0]; c[0] += r.nx; c[1] += r.nz; acc.set(v, c); }));
  acc.forEach((c, v) => {
    const l = Math.hypot(c[0], c[1]) || 1, p = o.V[v]; let x = p[0] + c[0] / l * off; const z = p[1] + c[1] / l * off;
    if (ax && Math.abs(p[0]) < M.EPS) x = 0; nv.set(v, o.V.length); o.V.push([x, z, p[2] || 0]);
  });
  return list.map(r => { const na = nv.get(r.a), nb = nv.get(r.b); o.F.push([r.b, r.a, na, nb]); return { k: ek(r.a, r.b), nk: ek(na, nb) }; });
};

/* ---------- extruir un vértice del borde: nace un vértice nuevo unido por triángulos a sus dos vecinos del borde ---------- */
M.extrudeVertex = (o, vs, off, ax) => {
  const EL = M.edgeList(o), out = [];
  vs.forEach(v => {
    const be = EL.filter(e => e.fs.length === 1 && (e.a === v || e.b === v)); if (be.length !== 2) return;
    let nx = 0, nz = 0; const info = [];
    be.forEach(e => {
      const f = o.F[e.fs[0]], n = f.length; let a = e.a, b = e.b; if (f[(f.indexOf(a) + 1) % n] !== b) { a = e.b; b = e.a; }
      let s = 0; for (let q = 0; q < n; q++) { const p = o.V[f[q]], r = o.V[f[(q + 1) % n]]; s += p[0] * r[1] - r[0] * p[1]; } s = s >= 0 ? 1 : -1;
      const A = o.V[a], B = o.V[b], dx = B[0] - A[0], dz = B[1] - A[1], l = Math.hypot(dx, dz) || 1; nx += s * dz / l; nz += -s * dx / l; info.push([a, b]);
    });
    const l = Math.hypot(nx, nz) || 1, p = o.V[v]; let x = p[0] + nx / l * off; if (ax && Math.abs(p[0]) < M.EPS) x = 0;
    const nv = o.V.length; o.V.push([x, p[1] + nz / l * off, p[2] || 0]); info.forEach(([a, b]) => o.F.push([b, a, nv])); out.push({ v, nv });
  });
  return out;
};

/* ---------- relieve a partir de guías ----------
   Los vértices guía conservan su altura; el resto se calcula minimizando la curvatura (biarmónica) => superficie suave que pasa por las guías. */
M.fillHeights = (o, fixed) => {
  const U = M.used(o), idx = new Map(U.map((v, i) => [v, i])), n = U.length, nb = U.map(() => new Set());
  M.edgeList(o).forEach(e => { const a = idx.get(e.a), b = idx.get(e.b); nb[a].add(b); nb[b].add(a); });
  const A = nb.map(s => [...s]), fx = U.map(v => fixed.has(v)), free = fx.filter(x => !x).length; if (!free || free === n) return 0;
  const L = (x, out) => { for (let i = 0; i < n; i++) { const l = A[i]; if (!l.length) { out[i] = 0; continue; } let s = 0; for (const j of l) s += x[j]; out[i] = x[i] - s / l.length; } };
  const LT = (r, out) => { out.fill(0); for (let i = 0; i < n; i++) { const l = A[i]; if (!l.length) continue; out[i] += r[i]; for (const j of l) out[j] -= r[i] / l.length; } };
  const op = (p, out) => { const t = new Float64Array(n); L(p, t); LT(t, out); for (let i = 0; i < n; i++) if (fx[i]) out[i] = 0; };
  const x0 = Float64Array.from(U, (v, i) => fx[i] ? (o.V[v][2] || 0) : 0), t = new Float64Array(n), g = new Float64Array(n); L(x0, t); LT(t, g);
  const b = g.map((v, i) => fx[i] ? 0 : -v), z = new Float64Array(n), r = Float64Array.from(b), p = Float64Array.from(b), Ap = new Float64Array(n);
  let rs = r.reduce((s, v) => s + v * v, 0); const tol = 1e-12 * (rs + 1e-30);
  for (let it = 0; it < 6000 && rs > tol; it++) {
    op(p, Ap); let pa = 0; for (let i = 0; i < n; i++) pa += p[i] * Ap[i]; if (pa < 1e-30) break; const al = rs / pa;
    for (let i = 0; i < n; i++) { z[i] += al * p[i]; r[i] -= al * Ap[i]; } const rn = r.reduce((s, v) => s + v * v, 0);
    for (let i = 0; i < n; i++) p[i] = r[i] + rn / rs * p[i]; rs = rn;
  }
  U.forEach((v, i) => { if (!fx[i]) o.V[v][2] = z[i]; });
  return free;
};

/* ---------- inflar (como un globo) ----------
   Resuelve una membrana inflada (Poisson con laplaciano cotangente, contorno a altura 0) y toma la raíz => perfil redondo (media esfera en un círculo).
   La altura total sale del tamaño de la pieza, o de las guías (≈) si las marcaste: se ajusta a ellas y la diferencia se reparte suavemente. */
M.inflate = (o, opt) => {
  opt = opt || {}; const U = M.used(o), idx = new Map(U.map((v, i) => [v, i])), n = U.length, W = U.map(() => new Map()), mass = new Float64Array(n);
  const addW = (i, j, w) => { W[i].set(j, (W[i].get(j) || 0) + w); W[j].set(i, (W[j].get(i) || 0) + w); };
  o.F.forEach(f => tri(f, o.V).forEach(t => {
    const P = t.map(v => o.V[v]), ar = Math.abs((P[1][0] - P[0][0]) * (P[2][1] - P[0][1]) - (P[1][1] - P[0][1]) * (P[2][0] - P[0][0])) / 2; if (ar < 1e-9) return;
    for (let k = 0; k < 3; k++) {
      const a = P[k], b = P[(k + 1) % 3], c = P[(k + 2) % 3], ux = b[0] - a[0], uz = b[1] - a[1], vx = c[0] - a[0], vz = c[1] - a[1], cot = (ux * vx + uz * vz) / (Math.abs(ux * vz - uz * vx) || 1e-12);
      addW(idx.get(t[(k + 1) % 3]), idx.get(t[(k + 2) % 3]), cot / 2); mass[idx.get(t[k])] += ar / 3;
    }
  }));
  const dir = new Array(n).fill(false);
  M.edgeList(o).forEach(e => { if (e.fs.length !== 1) return; if (opt.axisFree && Math.abs(o.V[e.a][0]) < M.EPS && Math.abs(o.V[e.b][0]) < M.EPS) return; dir[idx.get(e.a)] = dir[idx.get(e.b)] = true; });
  if (!dir.some(Boolean) || dir.every(Boolean)) return null;
  const Kx = (x, out) => { for (let i = 0; i < n; i++) { if (dir[i]) { out[i] = 0; continue; } let s = 0; W[i].forEach((w, j) => { s += w * (x[i] - (dir[j] ? 0 : x[j])); }); out[i] = s; } };
  const b = Float64Array.from(mass, (m2, i) => dir[i] ? 0 : m2), u = new Float64Array(n), r = Float64Array.from(b), p = Float64Array.from(b), Ap = new Float64Array(n);
  let rs = r.reduce((s, v) => s + v * v, 0); const tol = 1e-20 * (rs + 1e-30);
  for (let it = 0; it < 4000 && rs > tol; it++) {
    Kx(p, Ap); let pa = 0; for (let i = 0; i < n; i++) pa += p[i] * Ap[i]; if (pa < 1e-30) break; const al = rs / pa;
    for (let i = 0; i < n; i++) { u[i] += al * p[i]; r[i] -= al * Ap[i]; } const rn = r.reduce((s, v) => s + v * v, 0); for (let i = 0; i < n; i++) p[i] = r[i] + rn / rs * p[i]; rs = rn;
  }
  const s = Float64Array.from(u, v => Math.sqrt(Math.max(0, v))), sm = Math.max(...s) || 1; for (let i = 0; i < n; i++) s[i] /= sm;
  const bb = M.bbox(o); let k = opt.amount || Math.min(bb[2] - bb[0], bb[3] - bb[1]) / 2;
  const G = new Set(); if (opt.guides) M.edgeList(o).forEach(e => { if (opt.guides.has(e.k)) { G.add(e.a); G.add(e.b); } });
  let sy = 0, ss = 0; G.forEach(v => { const i = idx.get(v); sy += (o.V[v][2] || 0) * s[i]; ss += s[i] * s[i]; });
  const fit = G.size && ss > 1e-9 && sy / ss > 1e-6; if (fit) k = sy / ss;
  const y = Float64Array.from(s, v => v * k);
  if (G.size) {
    const cl = { V: o.V.map(v => [v[0], v[1], 0]), F: o.F, seams: new Set() }, fx = new Set(G);
    G.forEach(v => { cl.V[v][2] = (o.V[v][2] || 0) - y[idx.get(v)]; }); U.forEach((v, i) => { if (dir[i]) fx.add(v); });
    M.fillHeights(cl, fx); U.forEach((v, i) => { y[i] += cl.V[v][2]; });
  }
  U.forEach((v, i) => { o.V[v][2] = y[i]; });
  return { n, amount: k, fit };
};

/* ---------- eliminar ---------- */
M.removeFaces = (o, set) => { o.F = o.F.filter((f, i) => !set.has(i)); };
/* arista interior: fusiona sus dos caras (deshace un corte); arista de borde: elimina su cara */
M.dissolveEdge = (o, k) => {
  const e = M.edgeList(o).find(x => x.k === k); if (!e) return 0; o.seams.delete(k);
  if (e.fs.length === 1) { o.F.splice(e.fs[0], 1); return 1; }
  if (e.fs.length !== 2 || e.fs[0] === e.fs[1]) return 0;
  const [i, j] = e.fs, f1 = o.F[i]; let f2 = o.F[j], u = e.a, v = e.b; const n = f1.length, p = f1.indexOf(u);
  if (f1[(p + 1) % n] !== v) { u = e.b; v = e.a; }
  const q = f1.indexOf(v), s1 = f1.slice(q).concat(f1.slice(0, q)), p2 = f2.indexOf(v);
  if (f2[(p2 + 1) % f2.length] !== u) f2 = f2.slice().reverse();
  const r = f2.indexOf(u), s2 = f2.slice(r).concat(f2.slice(0, r));
  o.F[i] = s1.concat(s2.slice(1, -1)); o.F.splice(j, 1); return 2;
};
/* vértice con 2 aristas: se disuelve (la cara se queda); con más: se eliminan las caras que lo usan */
M.deleteVertex = (o, v) => {
  const EL = M.edgeList(o).filter(e => e.a === v || e.b === v); if (!EL.length) return;
  if (EL.length === 2) {
    const [a, b] = EL.map(e => e.a === v ? e.b : e.a), sm = EL.some(e => o.seams.has(e.k)); EL.forEach(e => o.seams.delete(e.k)); if (sm) o.seams.add(ek(a, b));
    o.F = o.F.map(f => f.filter(i => i !== v)).filter(f => f.length >= 3);
  } else o.F = o.F.filter(f => !f.includes(v));
};

/* ---------- corte multi-arista ----------
   El segmento pa->pb se divide en tramos en cada arista/vértice que atraviesa; cada tramo cae dentro de una sola cara y se corta. */
M.cutPath = (o, pa, pb) => {
  const dx = pb[0] - pa[0], dz = pb[1] - pa[1], L2 = dx * dx + dz * dz; if (L2 < 1e-9) return 0;
  const L = Math.sqrt(L2), tt = M.EPS / L, pts = [{ t: 0, p: [pa[0], pa[1]], v: 1 }, { t: 1, p: [pb[0], pb[1]], v: 1 }];
  M.used(o).forEach(i => { const q = o.V[i], t = ((q[0] - pa[0]) * dx + (q[1] - pa[1]) * dz) / L2; if (t <= tt || t >= 1 - tt) return;
    if (Math.abs((q[0] - pa[0]) * dz - (q[1] - pa[1]) * dx) / L < M.EPS) pts.push({ t, p: [q[0], q[1]], v: 1 }); });
  M.edgeList(o).forEach(e => {
    const a = o.V[e.a], b = o.V[e.b], ex = b[0] - a[0], ez = b[1] - a[1], den = dx * ez - dz * ex; if (Math.abs(den) < 1e-12) return;
    const t = ((a[0] - pa[0]) * ez - (a[1] - pa[1]) * ex) / den, s = ((a[0] - pa[0]) * dz - (a[1] - pa[1]) * dx) / den;
    if (t <= tt || t >= 1 - tt || s <= 0.001 || s >= 0.999) return; pts.push({ t, p: [pa[0] + dx * t, pa[1] + dz * t], v: 0 });
  });
  pts.sort((u, w) => u.t - w.t); const P = [];
  pts.forEach(q => { const l = P[P.length - 1]; if (l && Math.hypot(l.p[0] - q.p[0], l.p[1] - q.p[1]) < M.EPS * 2) { if (q.v && !l.v) P[P.length - 1] = q; } else P.push(q); });
  let n = 0;
  for (let i = 0; i + 1 < P.length; i++) {
    const ta = M.targetAt(o, P[i].p), tb = M.targetAt(o, P[i + 1].p); if (!ta || !tb) return -1;
    if (ta.k === 'v' && tb.k === 'v' && M.edgeList(o).some(e => (e.a === ta.i && e.b === tb.i) || (e.a === tb.i && e.b === ta.i))) continue;
    if (!M.cut(o, ta, tb)) return -1; n++;
  }
  return n;
};
M.pathValid = (o, pa, pb) => M.cutPath({ V: o.V.map(v => v.slice()), F: o.F.map(f => f.slice()), seams: new Set(o.seams) }, [pa[0], pa[1]], [pb[0], pb[1]]) > 0;

/* ---------- aplanado (solo vista previa, no modifica la malla) ----------
   side: ±1 usa solo el lado maestro del espejo (0 = todo). Abre por costuras, empaca las piezas y calcula la tensión por vértice
   (longitud 3D / longitud plana - 1): 0 = sin estirar (azul), alto = se estira (rojo). */
M.unfold = (o, side, opt) => {
  const F = [], keep = o.F.filter(f => { if (!side) return true; let c = 0; f.forEach(i => c += o.V[i][0]); return side * c / f.length >= -1e-6; });
  keep.forEach(f => F.push(f));
  const c = { V: o.V, F, seams: o.seams }, off = []; let n = 0; F.forEach(f => { off.push(n); n += f.length; });
  const par = Array.from({ length: n }, (_, i) => i), find = x => { while (par[x] !== x) x = par[x] = par[par[x]]; return x; };
  M.edgeList(c).forEach(e => { if (e.fs.length !== 2 || o.seams.has(e.k)) return; const [f1, f2] = e.fs; [e.a, e.b].forEach(v => { par[find(off[f1] + F[f1].indexOf(v))] = find(off[f2] + F[f2].indexOf(v)); }); });
  const map = new Map(), V = [], orig = [];
  const NF = F.map((f, fi) => f.map((v, k) => { const r = find(off[fi] + k); if (!map.has(r)) { map.set(r, V.length); const p = o.V[v]; V.push([p[0], p[1], 0]); orig.push(v); } return map.get(r); }));
  const stress = V.map(() => 0), ES = new Map();
  // 1) LSCM por pieza (mapa conforme: sin pliegues ni solapes), 2) escala y orientación como la pieza original, 3) afinado por largos de arista
  const P3 = i => { const q = o.V[orig[i]]; return [q[0], q[2] || 0, q[1]]; }, tris = []; NF.forEach(f => tri(f, V).forEach(t => tris.push(t)));
  const cp = V.map((_, i) => i), cf = x => { while (cp[x] !== x) x = cp[x] = cp[cp[x]]; return x; };
  tris.forEach(t => { cp[cf(t[0])] = cf(t[1]); cp[cf(t[1])] = cf(t[2]); });
  const grp = new Map(); tris.forEach(t => { const r = cf(t[0]); (grp.get(r) || grp.set(r, []).get(r)).push(t); });
  const sgn = (a, b, c) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
  if (!(opt && opt.noL)) grp.forEach(T => {
    const vs = [...new Set(T.flat())]; if (vs.length < 3) return; const ix = new Map(vs.map((v, i) => [v, i])), m = vs.length, rows = [];
    T.forEach(t => {
      const p0 = P3(t[0]), p1 = P3(t[1]), p2 = P3(t[2]), e1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], e2 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]], l = Math.hypot(...e1); if (l < 1e-9) return;
      const u1 = e1.map(x => x / l), a = e2[0] * u1[0] + e2[1] * u1[1] + e2[2] * u1[2], pr = [e2[0] - a * u1[0], e2[1] - a * u1[1], e2[2] - a * u1[2]], bb = Math.hypot(...pr); if (bb < 1e-9 * l) return;
      const s = 1 / Math.sqrt(l * bb); rows.push({ i: [ix.get(t[0]), ix.get(t[1]), ix.get(t[2])], wr: [(a - l) * s, -a * s, l * s], wi: [bb * s, -bb * s, 0] });
    });
    if (!rows.length) return;
    let pa = 0, pb = 0, d0 = -1, d1 = -1; const c0 = P3(vs[0]), dist = (u, w) => Math.hypot(u[0] - w[0], u[1] - w[1], u[2] - w[2]);
    vs.forEach((v, i) => { const d = dist(P3(v), c0); if (d > d0) { d0 = d; pa = i; } }); vs.forEach((v, i) => { const d = dist(P3(v), P3(vs[pa])); if (d > d1) { d1 = d; pb = i; } });
    if (d1 < 1e-9) return;
    const nr = rows.length, A = (U, W, R1, R2) => { for (let k = 0; k < nr; k++) { const r = rows[k]; let a = 0, b = 0; for (let j = 0; j < 3; j++) { a += r.wr[j] * U[r.i[j]] - r.wi[j] * W[r.i[j]]; b += r.wi[j] * U[r.i[j]] + r.wr[j] * W[r.i[j]]; } R1[k] = a; R2[k] = b; } };
    const AT = (R1, R2, GU, GV) => { GU.fill(0); GV.fill(0); for (let k = 0; k < nr; k++) { const r = rows[k]; for (let j = 0; j < 3; j++) { GU[r.i[j]] += r.wr[j] * R1[k] + r.wi[j] * R2[k]; GV[r.i[j]] += -r.wi[j] * R1[k] + r.wr[j] * R2[k]; } } };
    const R1 = new Float64Array(nr), R2 = new Float64Array(nr), GU = new Float64Array(m), GV = new Float64Array(m), pinned = i => i === pa || i === pb;
    const XU = new Float64Array(m), XV = new Float64Array(m); XU[pb] = d1; A(XU, XV, R1, R2); AT(R1, R2, GU, GV);
    const bu = GU.map((v, i) => pinned(i) ? 0 : -v), bv = GV.map((v, i) => pinned(i) ? 0 : -v), zu = new Float64Array(m), zv = new Float64Array(m), ru = Float64Array.from(bu), rv = Float64Array.from(bv), pu = Float64Array.from(bu), pv = Float64Array.from(bv);
    let rs = 0; for (let i = 0; i < m; i++) rs += ru[i] * ru[i] + rv[i] * rv[i]; const tol = 1e-18 * (rs + 1e-30); const Au = new Float64Array(m), Av = new Float64Array(m);
    for (let it = 0; it < 4 * m + 400 && rs > tol; it++) {
      A(pu, pv, R1, R2); AT(R1, R2, Au, Av); let q = 0; for (let i = 0; i < m; i++) { if (pinned(i)) { Au[i] = Av[i] = 0; } q += pu[i] * Au[i] + pv[i] * Av[i]; } if (q < 1e-30) break; const al = rs / q; let rn = 0;
      for (let i = 0; i < m; i++) { zu[i] += al * pu[i]; zv[i] += al * pv[i]; ru[i] -= al * Au[i]; rv[i] -= al * Av[i]; rn += ru[i] * ru[i] + rv[i] * rv[i]; }
      for (let i = 0; i < m; i++) { pu[i] = ru[i] + rn / rs * pu[i]; pv[i] = rv[i] + rn / rs * pv[i]; } rs = rn;
    }
    const uu = zu.map((v, i) => v + XU[i]), vv = zv.map((v, i) => v + XV[i]); if (uu.some(x => !isFinite(x)) || vv.some(x => !isFinite(x))) return;
    // orientación como la pieza original (espejo si hace falta), rotación (Procrustes) y escala por largos
    let so = 0, sn = 0; T.forEach(t => { const a = o.V[orig[t[0]]], b = o.V[orig[t[1]]], c = o.V[orig[t[2]]]; so += sgn(a, b, c); sn += sgn([uu[ix.get(t[0])], vv[ix.get(t[0])]], [uu[ix.get(t[1])], vv[ix.get(t[1])]], [uu[ix.get(t[2])], vv[ix.get(t[2])]]); });
    if (so * sn < 0) for (let i = 0; i < m; i++) uu[i] = -uu[i];
    let cx = 0, cz = 0, ox = 0, oz = 0; vs.forEach((v, i) => { cx += uu[i]; cz += vv[i]; ox += o.V[orig[v]][0]; oz += o.V[orig[v]][1]; }); cx /= m; cz /= m; ox /= m; oz /= m;
    let sd = 0, sc = 0; vs.forEach((v, i) => { const ax = uu[i] - cx, az = vv[i] - cz, bx = o.V[orig[v]][0] - ox, bz = o.V[orig[v]][1] - oz; sd += ax * bx + az * bz; sc += ax * bz - az * bx; });
    const th = Math.atan2(sc, sd), co = Math.cos(th), si = Math.sin(th);
    for (let i = 0; i < m; i++) { const ax = uu[i] - cx, az = vv[i] - cz; uu[i] = ax * co - az * si; vv[i] = ax * si + az * co; }
    let n2 = 0, d2 = 0; T.forEach(t => [[0, 1], [1, 2], [2, 0]].forEach(([a, b]) => { const ia = ix.get(t[a]), ib = ix.get(t[b]), l2 = Math.hypot(uu[ia] - uu[ib], vv[ia] - vv[ib]), l3 = dist(P3(t[a]), P3(t[b])); n2 += l2 * l3; d2 += l2 * l2; }));
    const k = d2 > 1e-12 ? n2 / d2 : 1; vs.forEach((v, i) => { V[v][0] = ox + uu[i] * k; V[v][1] = oz + vv[i] * k; });
    // ARAP (as-rigid-as-possible): cada triángulo busca moverse como cuerpo rígido => conserva largos y áreas (mejor que LSCM para tela)
    if (opt && opt.noA) return;
    const td = [];
    T.forEach(t => {
      const p0 = P3(t[0]), p1 = P3(t[1]), p2 = P3(t[2]), e1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], e2 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]], l = Math.hypot(...e1); if (l < 1e-9) return;
      const u1 = e1.map(x => x / l), qa = e2[0] * u1[0] + e2[1] * u1[1] + e2[2] * u1[2], pr = [e2[0] - qa * u1[0], e2[1] - qa * u1[1], e2[2] - qa * u1[2]], qb = Math.hypot(...pr); if (qb < 1e-9 * l) return;
      const X = [[0, 0], [l, 0], [qa, qb]], c = [0, 1, 2].map(q => { const XA = X[q], XB = X[(q + 1) % 3], XC = X[(q + 2) % 3], ux = XB[0] - XA[0], uz = XB[1] - XA[1], vx = XC[0] - XA[0], vz = XC[1] - XA[1]; return Math.max((ux * vx + uz * vz) / Math.abs(ux * vz - uz * vx), 1e-3) / 2; });
      td.push({ v: [ix.get(t[0]), ix.get(t[1]), ix.get(t[2])], X, c });
    });
    if (!td.length) return;
    const Ux = Float64Array.from(vs, v => V[v][0]), Uz = Float64Array.from(vs, v => V[v][1]), Wn = vs.map(() => new Map()), sg = () => td.map(q => sgn([Ux[q.v[0]], Uz[q.v[0]]], [Ux[q.v[1]], Uz[q.v[1]]], [Ux[q.v[2]], Uz[q.v[2]]]));
    td.forEach(q => { for (let a = 0; a < 3; a++) { const i = q.v[(a + 1) % 3], j = q.v[(a + 2) % 3], w = q.c[a]; Wn[i].set(j, (Wn[i].get(j) || 0) + w); Wn[j].set(i, (Wn[j].get(i) || 0) + w); } });
    const Lx = (x, out) => { for (let i = 0; i < m; i++) { let s = 0; Wn[i].forEach((w, j) => { s += w * (x[i] - x[j]); }); out[i] = s; } };
    const cg = (x, b) => { const r = new Float64Array(m), p = new Float64Array(m), Ap = new Float64Array(m); Lx(x, Ap); let rs = 0; for (let i = 0; i < m; i++) { r[i] = b[i] - Ap[i]; p[i] = r[i]; rs += r[i] * r[i]; } const t0 = 1e-14 * (rs + 1e-12);
      for (let it = 0; it < 120 && rs > t0; it++) { Lx(p, Ap); let q = 0; for (let i = 0; i < m; i++) q += p[i] * Ap[i]; if (q < 1e-30) break; const al = rs / q; let rn = 0; for (let i = 0; i < m; i++) { x[i] += al * p[i]; r[i] -= al * Ap[i]; rn += r[i] * r[i]; } for (let i = 0; i < m; i++) p[i] = r[i] + rn / rs * p[i]; rs = rn; } };
    const s0 = sg(), U0x = Ux.slice(), U0z = Uz.slice(), bx = new Float64Array(m), bz = new Float64Array(m);
    for (let it = 0; it < 25; it++) {
      bx.fill(0); bz.fill(0);
      td.forEach(q => {
        let S00 = 0, S01 = 0, S10 = 0, S11 = 0; const ed = [];
        for (let a = 0; a < 3; a++) { const i = q.v[(a + 1) % 3], j = q.v[(a + 2) % 3], w = q.c[a], XI = q.X[(a + 1) % 3], XJ = q.X[(a + 2) % 3], ex = XI[0] - XJ[0], ez = XI[1] - XJ[1], dx = Ux[i] - Ux[j], dz = Uz[i] - Uz[j];
          S00 += w * dx * ex; S01 += w * dx * ez; S10 += w * dz * ex; S11 += w * dz * ez; ed.push([i, j, w, ex, ez]); }
        const th = Math.atan2(S10 - S01, S00 + S11), co = Math.cos(th), si = Math.sin(th);
        ed.forEach(([i, j, w, ex, ez]) => { const d0 = co * ex - si * ez, d1 = si * ex + co * ez; bx[i] += w * d0; bx[j] -= w * d0; bz[i] += w * d1; bz[j] -= w * d1; });
      });
      cg(Ux, bx); cg(Uz, bz);
    }
    let mx2 = 0, mz2 = 0; for (let i = 0; i < m; i++) { mx2 += Ux[i]; mz2 += Uz[i]; } mx2 = mx2 / m - ox; mz2 = mz2 / m - oz; for (let i = 0; i < m; i++) { Ux[i] -= mx2; Uz[i] -= mz2; }
    const s1 = sg(); if (!Ux.every(isFinite) || !Uz.every(isFinite) || s1.some((x, i) => s0[i] && x !== s0[i])) { Ux.set(U0x); Uz.set(U0z); }   // si hubiera pliegues, se queda el LSCM
    vs.forEach((v, i) => { V[v][0] = Ux[i]; V[v][1] = Uz[i]; });
  });
  NF.forEach(f => tri(f, V).forEach(t => [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]].forEach(([u, w]) => { const k = u < w ? u + '-' + w : w + '-' + u; if (!ES.has(k)) ES.set(k, [u, w]); })));
  const ed = [...ES.values()].map(([u, w]) => { const A = o.V[orig[u]], B = o.V[orig[w]]; return [u, w, Math.hypot(A[0] - B[0], A[1] - B[1], (A[2] || 0) - (B[2] || 0))]; });
  // desplegado: cada arista (diagonales incluidas) busca su largo real 3D; lo que no logra, queda como tensión
  const V0 = V.map(v => v.slice()), sg0 = tris.map(t => sgn(V[t[0]], V[t[1]], V[t[2]]));
  for (let it = 0; it < ((opt && (opt.noA || opt.noL)) ? 150 : 0); it++) {
    let mx = 0;
    ed.forEach(([u, w, r]) => { const pa = V[u], pb = V[w]; let dx = pb[0] - pa[0], dz = pb[1] - pa[1], l = Math.hypot(dx, dz); if (l < 1e-9) { dx = 1e-6; dz = 0; l = 1e-6; }
      const c = (l - r) / l * 0.5; mx = Math.max(mx, Math.abs(l - r)); pa[0] += dx * c; pa[1] += dz * c; pb[0] -= dx * c; pb[1] -= dz * c; });
    if (mx < 1e-4) break;
  }
  if (tris.some((t, k) => sg0[k] && sgn(V[t[0]], V[t[1]], V[t[2]]) !== sg0[k])) V.forEach((v, i) => { v[0] = V0[i][0]; v[1] = V0[i][1]; });   // si el afinado crea pliegues, se queda el LSCM
  // deformación por triángulo: valores singulares del jacobiano 3D->2D (1 = sin deformar); se guarda la mayor |σ-1| en cada vértice
  tris.forEach(t => {
    const p0 = P3(t[0]), p1 = P3(t[1]), p2 = P3(t[2]), e1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], e2 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]], l = Math.hypot(...e1); if (l < 1e-9) return;
    const u1 = e1.map(x => x / l), qa = e2[0] * u1[0] + e2[1] * u1[1] + e2[2] * u1[2], pr = [e2[0] - qa * u1[0], e2[1] - qa * u1[1], e2[2] - qa * u1[2]], qb = Math.hypot(...pr); if (qb < 1e-9 * l) return;
    const A0 = V[t[0]], A1 = V[t[1]], A2 = V[t[2]], x1 = A1[0] - A0[0], z1 = A1[1] - A0[1], x2 = A2[0] - A0[0], z2 = A2[1] - A0[1];
    const j00 = x1 / l, j10 = z1 / l, j01 = (x2 * l - x1 * qa) / (l * qb), j11 = (z2 * l - z1 * qa) / (l * qb), pp = j00 * j00 + j01 * j01 + j10 * j10 + j11 * j11, qq = Math.abs(j00 * j11 - j01 * j10);
    const sa = Math.sqrt(pp + 2 * qq), sb = Math.sqrt(Math.max(0, pp - 2 * qq)), s1 = (sa + sb) / 2, s2 = (sa - sb) / 2, st = Math.max(Math.abs(s1 - 1), Math.abs(s2 - 1));
    t.forEach(v => { stress[v] = Math.max(stress[v], st); });
  });

  const p = NF.map((_, i) => i), fd = x => { while (p[x] !== x) x = p[x] = p[p[x]]; return x; }, seen = new Map();
  NF.forEach((f, fi) => f.forEach(v => { if (seen.has(v)) p[fd(fi)] = fd(seen.get(v)); else seen.set(v, fi); }));
  const pc = new Map();
  NF.forEach((f, fi) => { const r = fd(fi); let b = pc.get(r); if (!b) pc.set(r, b = { x0: 1e9, z0: 1e9, x1: -1e9, z1: -1e9, vs: new Set() }); f.forEach(v => { b.vs.add(v); b.x0 = Math.min(b.x0, V[v][0]); b.x1 = Math.max(b.x1, V[v][0]); b.z0 = Math.min(b.z0, V[v][1]); b.z1 = Math.max(b.z1, V[v][1]); }); });
  const list = [...pc.values()].sort((a, b) => (b.z1 - b.z0) - (a.z1 - a.z0)), GAP = 4; let area = 0, wmax = 0;
  list.forEach(b => { area += (b.x1 - b.x0) * (b.z1 - b.z0); wmax = Math.max(wmax, b.x1 - b.x0); });
  const W = Math.max(Math.sqrt(area) * 1.7, wmax); let x = 0, z = 0, rh = 0, X1 = 0, Z1 = 0;
  list.forEach(b => { const w = b.x1 - b.x0, h = b.z1 - b.z0; if (x > 0 && x + w > W) { x = 0; z += rh + GAP; rh = 0; }
    const dx = x - b.x0, dz = z - b.z0; b.vs.forEach(v => { V[v][0] += dx; V[v][1] += dz; }); x += w + GAP; rh = Math.max(rh, h); X1 = Math.max(X1, x - GAP); Z1 = Math.max(Z1, z + h); });
  V.forEach(v => { v[0] -= X1 / 2; v[1] -= Z1 / 2; });
  return { V, F: NF, stress, count: list.length, max: Math.max(0, ...stress), mean: stress.reduce((a, b) => a + b, 0) / (stress.length || 1) };
};

/* ---------- DXF (moldes planos, cm) ----------
   Usa el mismo aplanado que la vista previa (a escala real, piezas separadas por costuras y sin espejo).
   Capa PIEZAS: contornos cerrados. Capa INTERNAS: aristas interiores (cortes que no son costura). Eje Y hacia arriba. */
M.toDXF = (o, side) => {
  const u = M.unfold(o, side), c = { V: u.V, F: u.F }, EL = M.edgeList(c), f4 = n => (+n).toFixed(4), out = [];
  const w = (code, val) => out.push(code, val);
  const adj = new Map(), seen = new Set(), bnd = EL.filter(e => e.fs.length === 1), inn = [];   // solo contornos (borde de pieza + costuras abiertas); sin triángulos interiores
  bnd.forEach(e => { (adj.get(e.a) || adj.set(e.a, []).get(e.a)).push(e); (adj.get(e.b) || adj.set(e.b, []).get(e.b)).push(e); });
  const loops = [];
  bnd.forEach(e0 => {
    if (seen.has(e0.k)) return; seen.add(e0.k); const L = [e0.a]; let cur = e0.b, guard = 0;
    while (cur !== e0.a && guard++ < 100000) { L.push(cur); const nx = (adj.get(cur) || []).find(e => !seen.has(e.k)); if (!nx) break; seen.add(nx.k); cur = nx.a === cur ? nx.b : nx.a; }
    if (L.length >= 3) loops.push(L);
  });
  [['0', 'SECTION'], ['2', 'HEADER'], ['9', '$ACADVER'], ['1', 'AC1009'], ['9', '$INSUNITS'], ['70', '5'], ['0', 'ENDSEC'],
   ['0', 'SECTION'], ['2', 'TABLES'], ['0', 'TABLE'], ['2', 'LTYPE'], ['70', '1'], ['0', 'LTYPE'], ['2', 'CONTINUOUS'], ['70', '0'], ['3', 'Solid line'], ['72', '65'], ['73', '0'], ['40', '0.0'], ['0', 'ENDTAB'],
   ['0', 'TABLE'], ['2', 'LAYER'], ['70', '1'], ['0', 'LAYER'], ['2', 'PIEZAS'], ['70', '0'], ['62', '7'], ['6', 'CONTINUOUS'], ['0', 'ENDTAB'], ['0', 'ENDSEC'],
   ['0', 'SECTION'], ['2', 'ENTITIES']].forEach(p => w(p[0], p[1]));
  loops.forEach(L => {
    [['0', 'POLYLINE'], ['8', 'PIEZAS'], ['66', '1'], ['70', '1']].forEach(p => w(p[0], p[1]));
    L.forEach(i => { [['0', 'VERTEX'], ['8', 'PIEZAS'], ['10', f4(u.V[i][0])], ['20', f4(-u.V[i][1])], ['30', '0.0']].forEach(p => w(p[0], p[1])); });
    w('0', 'SEQEND'); w('8', 'PIEZAS');
  });
  inn.forEach(e => { [['0', 'LINE'], ['8', 'INTERNAS'], ['10', f4(u.V[e.a][0])], ['20', f4(-u.V[e.a][1])], ['30', '0.0'], ['11', f4(u.V[e.b][0])], ['21', f4(-u.V[e.b][1])], ['31', '0.0']].forEach(p => w(p[0], p[1])); });
  w('0', 'ENDSEC'); w('0', 'EOF');
  let s = ''; for (let i = 0; i < out.length; i += 2) s += out[i] + '\r\n' + out[i + 1] + '\r\n';
  return { text: s, pieces: loops.length, internal: inn.length };
};

/* ---------- historial y archivos ---------- */
M.snap = o => JSON.stringify({ V: o.V, F: o.F, s: [...o.seams], g: [...(o.guides || [])] });
M.restore = (o, s) => { const d = JSON.parse(s); o.V = d.V; o.F = d.F; o.seams = new Set(d.s); o.guides = new Set(d.g || []); };
M.rect = (w, h) => ({ V: [[-w/2, -h/2], [w/2, -h/2], [w/2, h/2], [-w/2, h/2]], F: [[0, 1, 2, 3]], seams: [] });

/* JSON propio (mesh) o JSON de moldes (figures: se ignoran las guías closed:false; las curvas se muestrean) */
M.parse = function (j) {
  if (j.mesh && j.mesh.V && j.mesh.F) return { V: j.mesh.V, F: j.mesh.F, seams: (j.mesh.seams || []).map(s => ek(s[0], s[1])) };
  const ppc = j.pxPerCm || PXCM, V = [], F = [];
  (j.figures || []).forEach(f => {
    if (f.closed === false || !f.vertices || f.vertices.length < 3) return;
    const P = f.vertices.map(v => [v.x / ppc, v.y / ppc]), n = P.length, E = f.edges || [], poly = [];
    for (let i = 0; i < n; i++) {
      const j2 = (i + 1) % n; let e = E.find(e => e.start === i && e.end === j2), rev = false;
      if (!e) { e = E.find(e => e.start === j2 && e.end === i); rev = !!e; }
      poly.push(P[i]);
      if (e && e.curved && e.controlX != null) {
        const a = rev ? P[j2] : P[i], b = rev ? P[i] : P[j2], c1 = [e.controlX / ppc, e.controlY / ppc];
        const cub = e.cubic && e.control2X != null, c2 = cub ? [e.control2X / ppc, e.control2Y / ppc] : null, seg = [];
        for (let k = 1; k < 8; k++) seg.push(cub ? bezC(a, c1, c2, b, k / 8) : bezQ(a, c1, b, k / 8));
        if (rev) seg.reverse(); seg.forEach(q => poly.push(q));
      }
    }
    const base = V.length; poly.forEach(q => V.push(q.slice())); F.push(poly.map((_, i) => base + i));
  });
  if (!F.length) return null;
  let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
  V.forEach(q => { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); z0 = Math.min(z0, q[1]); z1 = Math.max(z1, q[1]); });
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2; V.forEach(q => { q[0] -= cx; q[1] -= cz; });
  return { V, F, seams: [] };
};
M.toJSON = function (o) {
  const U = M.used(o), ix = new Map(U.map((u, i) => [u, i])), k = PXCM;
  const V = U.map(u => o.V[u].slice()), F = o.F.map(f => f.map(i => ix.get(i)));
  const seams = [...o.seams].map(s => s.split('-').map(Number)).filter(s => ix.has(s[0]) && ix.has(s[1])).map(s => [ix.get(s[0]), ix.get(s[1])]);
  return { unit: 'cm', pxPerCm: k, mesh: { V, F, seams },
    figures: F.map((f, fi) => ({ grain: null, closed: true, name: 'Pieza ' + (fi + 1),
      vertices: f.map(i => ({ x: V[i][0] * k, y: V[i][1] * k, xCm: +V[i][0].toFixed(2), yCm: +V[i][1].toFixed(2) })),
      edges: f.map((_, i) => ({ start: i, end: (i + 1) % f.length, curved: false, cubic: false, controlX: null, controlY: null, control2X: null, control2Y: null })) })) };
};

/* ---------- objeto 3D ---------- */
const setG = (obj, arr, col) => {
  obj.geometry.dispose(); const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); if (col) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  obj.geometry = g;
};
M.build = function (d, color) {
  const o = { V: d.V.map(v => v.slice()), F: d.F.map(f => f.slice()), seams: new Set(d.seams || []), guides: new Set(), group: new THREE.Group(), ext: 40,
    ui: { edit: false, mode: 'v', mirror: 0, sel: { v: new Set(), e: new Set(), f: new Set() }, kA: null, kP: null } };
  o.mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshPhongMaterial({ color: color || 0x5b7fb5, shininess: 5, specular: 0x1a1a1a, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 }));
  o.mesh.frustumCulled = false; o.group.add(o.mesh);
  const mk = (cls, mat, ro) => { const x = new cls(new THREE.BufferGeometry(), mat); x.renderOrder = ro; x.frustumCulled = false; o.group.add(x); return x; };
  const lb = c => new THREE.LineBasicMaterial({ color: c, depthTest: false, transparent: true });   // transparent:true => se dibujan después de la pieza (no quedan 'tapadas' por su transparencia)
  o.selMesh = mk(THREE.Mesh, new THREE.MeshBasicMaterial({ color: 0xff9a1a, transparent: true, opacity: 0.4, depthTest: false, side: THREE.DoubleSide }), 9);
  o.axis = mk(THREE.LineSegments, lb(0x4fd1ff), 8);
  o.lnN = mk(THREE.LineSegments, lb(0x1b1f2a), 10);
  o.lnS = mk(THREE.LineSegments, lb(0xff3b3b), 11);
  o.lnG = mk(THREE.LineSegments, lb(0x22e0a0), 11);
  o.lnSel = mk(THREE.LineSegments, lb(0xff9a1a), 12);
  const cv = document.createElement('canvas'); cv.width = cv.height = 32; const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(16, 16, 15, 0, 7); cx.fill();
  const dotTex = new THREE.CanvasTexture(cv), pm = s => new THREE.PointsMaterial({ size: s, map: dotTex, alphaTest: 0.5, transparent: true, sizeAttenuation: false, vertexColors: true, depthTest: false });
  o.pts = mk(THREE.Points, pm(4), 13); o.ptsS = mk(THREE.Points, pm(7), 14);
  o.kl = mk(THREE.LineSegments, lb(0xffdd33), 14);
  o.kpts = mk(THREE.Points, new THREE.PointsMaterial({ size: 14, map: dotTex, alphaTest: 0.5, transparent: true, sizeAttenuation: false, vertexColors: true, depthTest: false }), 15);
  M.draw(o); return o;
};

/* redibuja todo desde V, F, seams y o.ui. V[i] = [x, z, y]: y (altura) es opcional y vale 0 por defecto. */
M.draw = function (o) {
  const V = o.V, F = o.F, ui = o.ui, Y = 0, hh = v => v[2] || 0;
  const pos = new Float32Array(V.length * 3), idx = [], tf = [];
  V.forEach((v, i) => { pos[3*i] = v[0]; pos[3*i+1] = hh(v); pos[3*i+2] = v[1]; });
  F.forEach((f, fi) => tri(f, V).forEach(t => { idx.push(t[0], t[1], t[2]); tf.push(fi); }));
  o.triFace = tf;
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const sc = !!o.stress, mt = o.mesh.material;
  if (sc) {
    const col = new Float32Array(V.length * 3), B = [0.2, 0.4, 1], G = [0.3, 0.9, 0.3], R = [1, 0.2, 0.2], mx = (a, b, t) => a.map((u, k) => u + (b[k] - u) * t);
    V.forEach((v, i) => { const t = Math.min(1, (o.stress[i] || 0) / (ui.tol || 0.1)), c = t < 0.5 ? mx(B, G, t * 2) : mx(G, R, (t - 0.5) * 2); col.set(c, 3 * i); });
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  if (mt.vertexColors !== sc) { mt.vertexColors = sc; mt.needsUpdate = true; } mt.color.set(sc ? 0xffffff : 0x5b7fb5);
  const al = ui.alpha || 1; if (mt.transparent !== (al < 1)) { mt.transparent = al < 1; mt.needsUpdate = true; } mt.opacity = al; mt.depthWrite = al >= 1;
  [o.lnN, o.lnS, o.lnG, o.lnSel, o.pts, o.ptsS, o.selMesh].forEach(x => { x.material.depthTest = !ui.xray; x.material.needsUpdate = false; });
  o.mesh.geometry.dispose(); o.mesh.geometry = g;

  const EL = M.edgeList(o), N = [], S = [], SE = [], GD = [];
  EL.forEach(e => {
    const a = V[e.a], b = V[e.b], seg = [a[0], hh(a) + Y, a[1], b[0], hh(b) + Y, b[1]];
    (o.seams.has(e.k) ? S : o.guides.has(e.k) ? GD : N).push(...seg);
    if (ui.edit && ui.mode === 'e' && ui.sel.e.has(e.k)) SE.push(...seg);
  });
  setG(o.lnN, N); setG(o.lnS, S); setG(o.lnG, GD); setG(o.lnSel, SE);

  const fp = [];
  if (ui.edit && ui.mode === 'f') ui.sel.f.forEach(fi => { const f = F[fi]; if (f) tri(f, V).forEach(t => t.forEach(i => fp.push(V[i][0], hh(V[i]), V[i][1]))); });
  setG(o.selMesh, fp);

  const ps = [], pcs = [], pp = [], pc = [], dot = (p, c) => { pp.push(p[0], hh(p), p[1]); pc.push(c[0], c[1], c[2]); };
  if (ui.edit) {
    const W = [1, 1, 1], OR = [1, 0.55, 0.1], GR = [0.5, 0.5, 0.55], ok = p => !ui.mirror || ui.mirror * p[0] >= -M.EPS;
    if (ui.mode === 'v') M.used(o).forEach(i => { if (ui.sel.v.has(i)) { ps.push(V[i][0], hh(V[i]), V[i][1]); pcs.push(OR[0], OR[1], OR[2]); } else dot(V[i], ok(V[i]) ? W : GR); });
  }
  setG(o.pts, pp, pc); setG(o.ptsS, ps, pcs);

  const bb = M.bbox(o); o.ext = Math.max(bb[2] - bb[0], bb[3] - bb[1], 1);
  setG(o.axis, ui.edit && ui.mirror ? [0, 0.3, bb[1] - 6, 0, 0.3, bb[3] + 6] : []);

  const kp = [], kc = [], kl = [], mir = p => [-p[0], p[1], hh(p)];
  const mk = (p, c) => { kp.push(p[0], hh(p), p[1]); kc.push(c[0], c[1], c[2]); };
  const seg = (a, b) => kl.push(a[0], hh(a), a[1], b[0], hh(b), b[1]);
  if (ui.edit && ui.kA) { mk(ui.kA, [1, 0.9, 0.2]); if (ui.mirror) mk(mir(ui.kA), [1, 0.9, 0.2]); }
  if (ui.edit && ui.kP) { mk(ui.kP, [0.3, 1, 0.5]); if (ui.mirror) mk(mir(ui.kP), [0.3, 1, 0.5]); }
  if (ui.edit && ui.kA && ui.kP) { seg(ui.kA, ui.kP); if (ui.mirror) seg(mir(ui.kA), mir(ui.kP)); }
  setG(o.kpts, kp, kc); setG(o.kl, kl);
};
return M;
})();
