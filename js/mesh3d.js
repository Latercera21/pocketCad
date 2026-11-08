// PocketCAD - módulo: malla fina para el visor 3D + costuras (nivel 2). Sin DOM: se puede probar en Node.
// Pieza cerrada -> contorno remuestreado (un punto cada ~h cm) + puntos internos (rejilla hexagonal)
// -> Delaunay -> se quedan los triángulos dentro de la pieza.
// Las costuras viven en las aristas: edge.seam = id, edge.seamSide = 'a'|'b'
// (los dos lados con el mismo id se cosen entre sí; se marcan con 🪡 en "Unir / Crear figura").

function m3dInPoly(x, y, poly) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[i], b = poly[j];
        if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
    }
    return c;
}

function m3dDistSeg(x, y, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    let t = l2 ? ((x - a[0]) * dx + (y - a[1]) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(x - (a[0] + t * dx), y - (a[1] + t * dy));
}

// Delaunay (Bowyer-Watson). P = [[x,y],...]. Devuelve [[a,b,c],...]
function m3dDelaunay(P) {
    const n = P.length;
    if (n < 3) return [];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    P.forEach(p => { minX = Math.min(minX, p[0]); minY = Math.min(minY, p[1]); maxX = Math.max(maxX, p[0]); maxY = Math.max(maxY, p[1]); });
    const d = Math.max(maxX - minX, maxY - minY) || 1, mx = (minX + maxX) / 2, my = (minY + maxY) / 2;
    const pts = P.concat([[mx - 20 * d, my - d], [mx, my + 20 * d], [mx + 20 * d, my - d]]);
    const K = n + 3;
    const mk = (a, b, c) => {
        const ax = pts[a][0], ay = pts[a][1], bx = pts[b][0], by = pts[b][1], cx = pts[c][0], cy = pts[c][1];
        const D = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
        if (Math.abs(D) < 1e-14) return null;
        const a2 = ax * ax + ay * ay, b2 = bx * bx + by * by, c2 = cx * cx + cy * cy;
        const ux = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / D;
        const uy = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / D;
        return {a, b, c, cx: ux, cy: uy, r2: (ax - ux) * (ax - ux) + (ay - uy) * (ay - uy)};
    };
    let tris = [mk(n, n + 1, n + 2)];
    for (let i = 0; i < n; i++) {
        const px = pts[i][0], py = pts[i][1];
        const keep = [], cnt = new Map();
        for (const t of tris) {
            const dx = px - t.cx, dy = py - t.cy;
            if (dx * dx + dy * dy < t.r2 * (1 - 1e-12)) {
                [[t.a, t.b], [t.b, t.c], [t.c, t.a]].forEach(([u, v]) => {
                    const key = u < v ? u * K + v : v * K + u;
                    const e = cnt.get(key);
                    if (e) e.c++; else cnt.set(key, {u, v, c: 1});
                });
            } else keep.push(t);
        }
        for (const e of cnt.values()) if (e.c === 1) { const t = mk(e.u, e.v, i); if (t) keep.push(t); }
        tris = keep;
    }
    return tris.filter(t => t.a < n && t.b < n && t.c < n).map(t => [t.a, t.b, t.c]);
}

// Malla de UNA pieza. h = tamaño de triángulo (cm). Coordenadas en cm, Y hacia arriba (igual que el visor 3D).
function m3dPieceMesh(fig, h) {
    const toCm = p => [p.x / PX_PER_CM, -p.y / PX_PER_CM];
    const outline = [], ranges = [];
    for (let ei = 0; ei < fig.edges.length; ei++) {
        const e = fig.edges[ei];
        const pl = sampleFigureEdges({vertices: fig.vertices, edges: [e]}, 32).map(toCm);
        const acc = [0];
        for (let k = 1; k < pl.length; k++) acc.push(acc[k - 1] + Math.hypot(pl[k][0] - pl[k - 1][0], pl[k][1] - pl[k - 1][1]));
        const L = acc[acc.length - 1];
        if (pl.length < 2 || L < 1e-6) { ranges.push([]); continue; }
        const n = Math.max(1, Math.round(L / h)), idxs = [];
        for (let s = 0; s <= n; s++) {
            const t = L * s / n;
            let k = 1; while (k < acc.length - 1 && acc[k] < t) k++;
            const f = (t - acc[k - 1]) / ((acc[k] - acc[k - 1]) || 1);
            const pt = [pl[k - 1][0] + (pl[k][0] - pl[k - 1][0]) * f, pl[k - 1][1] + (pl[k][1] - pl[k - 1][1]) * f];
            const last = outline[outline.length - 1];
            if (s === 0 && last && Math.hypot(last[0] - pt[0], last[1] - pt[1]) < 1e-4) idxs.push(outline.length - 1);
            else { outline.push(pt); idxs.push(outline.length - 1); }
        }
        ranges.push(idxs);
    }
    // cierre: el último punto coincide con el primero
    if (outline.length > 3) {
        const f = outline[0], l = outline[outline.length - 1], li = outline.length - 1;
        if (Math.hypot(f[0] - l[0], f[1] - l[1]) < 1e-4) {
            outline.pop();
            ranges.forEach(r => { for (let i = 0; i < r.length; i++) if (r[i] === li) r[i] = 0; });
        }
    }
    const no = outline.length;
    if (no < 3) return null;
    let area = 0;
    for (let i = 0; i < no; i++) { const a = outline[i], b = outline[(i + 1) % no]; area += a[0] * b[1] - b[0] * a[1]; }
    const ccw = area > 0;
    // puntos internos: rejilla hexagonal lejos del borde
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    outline.forEach(p => { minX = Math.min(minX, p[0]); minY = Math.min(minY, p[1]); maxX = Math.max(maxX, p[0]); maxY = Math.max(maxY, p[1]); });
    const pts = outline.slice(), rowH = h * 0.8660254;
    let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff - 0.5;
    for (let r = 0, y = minY + rowH * 0.5; y < maxY; r++, y += rowH) {
        for (let x = minX + ((r % 2) ? h * 0.5 : 0) + h * 0.25; x < maxX; x += h) {
            const px = x + rnd() * h * 0.01, py = y + rnd() * h * 0.01;
            if (!m3dInPoly(px, py, outline)) continue;
            let dmin = Infinity;
            for (let i = 0; i < no && dmin >= 0.72 * h; i++) dmin = Math.min(dmin, m3dDistSeg(px, py, outline[i], outline[(i + 1) % no]));
            if (dmin >= 0.72 * h) pts.push([px, py]);
        }
    }
    let tris = m3dDelaunay(pts).filter(t => {
        const a = pts[t[0]], b = pts[t[1]], c = pts[t[2]];
        const ar = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2;
        return ar > 1e-6 && m3dInPoly((a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, outline);
    });
    // quitar vértices sin triángulo y reindexar
    const used = new Int32Array(pts.length).fill(-1); let m = 0;
    tris.forEach(t => t.forEach(i => { if (used[i] < 0) used[i] = -2; }));
    const npts = [];
    for (let i = 0; i < pts.length; i++) if (used[i] === -2) { used[i] = m++; npts.push(pts[i]); }
    tris = tris.map(t => t.map(i => used[i]));
    const rr = ranges.map(r => r.map(i => used[i]).filter(i => i >= 0));
    return {pts: npts, tris, ranges: rr, ccw, nOutline: no, areaCm2: Math.abs(area) / 2};
}

// Lados cosidos de una figura: [{id, side, edges:[ei en orden], ...}]
function m3dSeamSides(fig) {
    const groups = new Map();
    fig.edges.forEach((e, ei) => {
        if (e.seam == null) return;
        const key = e.seam + ':' + (e.seamSide === 'b' ? 'b' : 'a');
        if (!groups.has(key)) groups.set(key, {id: e.seam, side: e.seamSide === 'b' ? 'b' : 'a', edges: []});
        groups.get(key).edges.push(ei);
    });
    const out = [];
    groups.forEach(g => {
        const S = g.edges, set = new Set(S);
        // ordenar por continuidad (fin de una = inicio de la siguiente)
        let first = S.find(ei => !S.some(fj => fj !== ei && fig.edges[fj].end === fig.edges[ei].start));
        if (first == null) first = S[0];
        const ordered = [first]; let cur = first;
        for (let guard = 0; guard < S.length; guard++) {
            const nx = S.find(fj => !ordered.includes(fj) && fig.edges[fj].start === fig.edges[cur].end);
            if (nx == null) break;
            ordered.push(nx); cur = nx;
        }
        S.forEach(ei => { if (!ordered.includes(ei)) ordered.push(ei); });
        g.edges = ordered; out.push(g);
    });
    return out;
}

// Longitud (cm) de una lista de aristas de una figura
function m3dSideLenCm(fig, edgeIdxs) {
    let L = 0;
    edgeIdxs.forEach(ei => {
        const pl = sampleFigureEdges({vertices: fig.vertices, edges: [fig.edges[ei]]}, 48);
        for (let k = 1; k < pl.length; k++) L += Math.hypot(pl[k].x - pl[k - 1].x, pl[k].y - pl[k - 1].y);
    });
    return L / PX_PER_CM;
}

// Malla fina de todas las piezas cerradas + pares de vértices a coser.
// opts: {target: nº aproximado de vértices en total (def. 2500)}
function m3dBuildFineMesh(opts) {
    opts = opts || {};
    const target = opts.target || 2500;
    const list = [];
    let totalArea = 0;
    figures.forEach((fig, fi) => {
        if (!fig.closed || fig.vertices.length < 3) return;
        const pl = sampleFigureEdges(fig, 8);
        let a = 0;
        for (let i = 0; i < pl.length; i++) { const p = pl[i], q = pl[(i + 1) % pl.length]; a += p.x * q.y - q.x * p.y; }
        const cm2 = Math.abs(a) / 2 / (PX_PER_CM * PX_PER_CM);
        if (cm2 < 0.5) return;
        totalArea += cm2; list.push({fig, fi});
    });
    const h = Math.max(0.8, Math.min(5, Math.sqrt(totalArea / (0.866 * target)) || 2));
    const palette = [[231,76,60],[41,128,185],[39,174,96],[243,156,18],[142,68,173],[22,160,133],[211,84,0],[44,62,80]];
    const pieces = [], warnings = [], sideMap = new Map();
    list.forEach(({fig, fi}, k) => {
        const M = m3dPieceMesh(fig, h);
        if (!M) { warnings.push('Pieza ' + (k + 1) + ': contorno inválido, se omite'); return; }
        const pi = pieces.length;
        pieces.push({fi, name: fig.name || ('Pieza ' + (pi + 1)), color: palette[pi % palette.length], pts: M.pts, tris: M.tris, areaCm2: M.areaCm2});
        m3dSeamSides(fig).forEach(g => {
            let idx = [];
            g.edges.forEach(ei => (M.ranges[ei] || []).forEach(v => { if (!idx.length || idx[idx.length - 1] !== v) idx.push(v); }));
            if (!M.ccw) idx.reverse();   // recorrido siempre antihorario
            const key = g.id + ':' + g.side;
            if (!sideMap.has(key)) sideMap.set(key, []);
            sideMap.get(key).push({pi, idx, lenCm: m3dSideLenCm(fig, g.edges), label: pieces[pi].name});
        });
    });
    // global: centrar el conjunto
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    pieces.forEach(P => P.pts.forEach(p => { minX = Math.min(minX, p[0]); minY = Math.min(minY, p[1]); maxX = Math.max(maxX, p[0]); maxY = Math.max(maxY, p[1]); }));
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    pieces.forEach(P => { P.pts = P.pts.map(p => [p[0] - cx, p[1] - cy]); });
    // pares
    const seams = [], ids = new Set();
    sideMap.forEach((_, key) => ids.add(key.split(':')[0]));
    ids.forEach(id => {
        const A = sideMap.get(id + ':a') || [], B = sideMap.get(id + ':b') || [];
        if (A.length !== 1 || B.length !== 1) { warnings.push('Costura ' + id + ': debe tener exactamente un lado A y uno B (hay ' + A.length + ' y ' + B.length + ')'); return; }
        const a = A[0], b = B[0];
        const bIdx = b.idx.slice().reverse();     // ambos antihorarios => se enfrentan al revés
        const param = (pi, idx) => {
            const P = pieces[pi].pts, s = [0];
            for (let k = 1; k < idx.length; k++) s.push(s[k - 1] + Math.hypot(P[idx[k]][0] - P[idx[k - 1]][0], P[idx[k]][1] - P[idx[k - 1]][1]));
            const L = s[s.length - 1] || 1; return s.map(v => v / L);
        };
        const sA = param(a.pi, a.idx), sB = param(b.pi, bIdx), pairs = [], seen = new Set();
        const add = (i, j) => { const key = i + '_' + j; if (!seen.has(key)) { seen.add(key); pairs.push([a.pi, a.idx[i], b.pi, bIdx[j]]); } };
        sA.forEach((s, i) => { let bj = 0, bd = Infinity; sB.forEach((t, j) => { const d = Math.abs(s - t); if (d < bd) { bd = d; bj = j; } }); add(i, bj); });
        sB.forEach((s, j) => { let bi = 0, bd = Infinity; sA.forEach((t, i) => { const d = Math.abs(s - t); if (d < bd) { bd = d; bi = i; } }); add(bi, j); });
        const diff = Math.abs(a.lenCm - b.lenCm), pct = diff / Math.max(a.lenCm, b.lenCm, 1e-6) * 100;
        if (pct > 2) warnings.push('Costura ' + id + ': ' + a.label + ' ' + a.lenCm.toFixed(1) + ' cm vs ' + b.label + ' ' + b.lenCm.toFixed(1) + ' cm (' + pct.toFixed(1) + '% de diferencia)');
        seams.push({id, a: a.pi, b: b.pi, lenA: a.lenCm, lenB: b.lenCm, pairs});
    });
    return {pieces, seams, warnings, h};
}
