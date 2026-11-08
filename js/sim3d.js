// PocketCAD - módulo: "tela" para el visor 3D (nivel 2). Sin DOM: se puede probar en Node.
// Position Based Dynamics: resortes de largo (la pieza no se estira), flexión suave y
// costuras que acercan los pares de vértices. Todavía SIN gravedad, maniquí ni choque entre piezas.

function clothBuild(mesh) {
    const off = [], tri = [], triPiece = [];
    let N = 0;
    mesh.pieces.forEach(P => { off.push(N); N += P.pts.length; });
    const rest2 = new Float64Array(N * 2), piece = new Int32Array(N);
    mesh.pieces.forEach((P, k) => P.pts.forEach((p, i) => { rest2[(off[k] + i) * 2] = p[0]; rest2[(off[k] + i) * 2 + 1] = p[1]; piece[off[k] + i] = k; }));
    const ea = [], eb = [], el = [], ba = [], bb = [], bl = [];
    const dist2 = (a, b) => Math.hypot(rest2[a * 2] - rest2[b * 2], rest2[a * 2 + 1] - rest2[b * 2 + 1]);
    mesh.pieces.forEach((P, k) => {
        const edgeTri = new Map();   // arista -> [tri, opuesto]
        P.tris.forEach((t, ti) => {
            const g = [off[k] + t[0], off[k] + t[1], off[k] + t[2]];
            tri.push(g[0], g[1], g[2]); triPiece.push(k);
            for (let e = 0; e < 3; e++) {
                const u = g[e], v = g[(e + 1) % 3], w = g[(e + 2) % 3];
                const key = u < v ? u + '_' + v : v + '_' + u;
                const rec = edgeTri.get(key);
                if (!rec) edgeTri.set(key, {u, v, opp: [w]});
                else rec.opp.push(w);
            }
        });
        edgeTri.forEach(r => {
            ea.push(r.u); eb.push(r.v); el.push(dist2(r.u, r.v));
            if (r.opp.length === 2) { ba.push(r.opp[0]); bb.push(r.opp[1]); bl.push(dist2(r.opp[0], r.opp[1])); }
        });
    });
    const sa = [], sb = [];
    mesh.seams.forEach(S => S.pairs.forEach(p => { sa.push(off[p[0]] + p[1]); sb.push(off[p[2]] + p[3]); }));
    return {
        N, off, piece, tri: Int32Array.from(tri), triPiece: Int32Array.from(triPiece),
        pos: new Float64Array(N * 3), prev: new Float64Array(N * 3), rest2,
        ea: Int32Array.from(ea), eb: Int32Array.from(eb), el: Float64Array.from(el),
        ba: Int32Array.from(ba), bb: Int32Array.from(bb), bl: Float64Array.from(bl),
        sa: Int32Array.from(sa), sb: Int32Array.from(sb), frames: 0
    };
}

// Pose inicial. 'tubo': las piezas (ordenadas de izquierda a derecha en el molde) se enrollan
// formando un cilindro, cara visible hacia fuera. 'plano': tal cual están dibujadas, en el plano.
function clothPose(cl, mesh, pose) {
    const {pos, prev} = cl;
    if (pose === 'plano') {
        mesh.pieces.forEach((P, k) => P.pts.forEach((p, i) => {
            const g = (cl.off[k] + i) * 3; pos[g] = p[0]; pos[g + 1] = p[1]; pos[g + 2] = 0;
        }));
    } else {
        const inSeam = new Set();
        mesh.seams.forEach(S => { inSeam.add(S.a); inSeam.add(S.b); });
        const info = mesh.pieces.map((P, k) => {
            let a = Infinity, b = -Infinity;
            P.pts.forEach(p => { a = Math.min(a, p[0]); b = Math.max(b, p[0]); });
            return {k, cx: (a + b) / 2, w: b - a, a, b};
        });
        // solo las piezas con costura forman el cilindro; las demás quedan planas a un lado
        const ring = info.filter(o => inSeam.has(o.k) || !inSeam.size);
        const order = ring.slice().sort((p, q) => p.cx - q.cx);
        const W = order.reduce((s, o) => s + o.w, 0) || 1, R = W / (2 * Math.PI);
        let acc = 0;
        order.forEach(o => {
            const th0 = (acc + o.w / 2) / R; acc += o.w;
            mesh.pieces[o.k].pts.forEach((p, i) => {
                const th = th0 + (p[0] - o.cx) / R, g = (cl.off[o.k] + i) * 3;
                pos[g] = R * Math.sin(th); pos[g + 1] = p[1]; pos[g + 2] = R * Math.cos(th);
            });
        });
        let xr = R + 5;
        info.filter(o => !ring.includes(o)).forEach(o => {
            mesh.pieces[o.k].pts.forEach((p, i) => {
                const g = (cl.off[o.k] + i) * 3;
                pos[g] = xr + (p[0] - o.a); pos[g + 1] = p[1]; pos[g + 2] = 0;
            });
            xr += o.w + 5;
        });
    }
    prev.set(pos); cl.frames = 0;
}

function clothStep(cl, iters, opts) {
    opts = opts || {};
    const damp = opts.damp != null ? opts.damp : 0.9, kb = opts.bend != null ? opts.bend : 0.15, ks = opts.seam != null ? opts.seam : 0.3;
    const {pos, prev, N, ea, eb, el, ba, bb, bl, sa, sb} = cl;
    for (let i = 0; i < N * 3; i++) { const v = (pos[i] - prev[i]) * damp; prev[i] = pos[i]; pos[i] += v; }
    const pull = (a, b, rest, k) => {
        const a3 = a * 3, b3 = b * 3;
        const dx = pos[b3] - pos[a3], dy = pos[b3 + 1] - pos[a3 + 1], dz = pos[b3 + 2] - pos[a3 + 2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d < 1e-9) return;
        const c = (d - rest) / d * 0.5 * k;
        pos[a3] += dx * c; pos[a3 + 1] += dy * c; pos[a3 + 2] += dz * c;
        pos[b3] -= dx * c; pos[b3 + 1] -= dy * c; pos[b3 + 2] -= dz * c;
    };
    for (let it = 0; it < iters; it++) {
        for (let e = 0; e < ea.length; e++) pull(ea[e], eb[e], el[e], 1);
        for (let e = 0; e < ba.length; e++) pull(ba[e], bb[e], bl[e], kb);
        for (let e = 0; e < sa.length; e++) pull(sa[e], sb[e], 0, ks);
    }
    cl.frames++;
}

// Hueco de las costuras (cm): {mean, max, n}
function clothSeamStats(cl) {
    let sum = 0, mx = 0; const n = cl.sa.length;
    for (let e = 0; e < n; e++) {
        const a = cl.sa[e] * 3, b = cl.sb[e] * 3;
        const d = Math.hypot(cl.pos[a] - cl.pos[b], cl.pos[a + 1] - cl.pos[b + 1], cl.pos[a + 2] - cl.pos[b + 2]);
        sum += d; if (d > mx) mx = d;
    }
    return {mean: n ? sum / n : 0, max: mx, n};
}

// Cuánto se estiró la tela respecto del molde plano (máx. y medio, en %): sirve para ver si se está forzando
function clothStretchStats(cl) {
    let mx = 0, sum = 0;
    for (let e = 0; e < cl.ea.length; e++) {
        const a = cl.ea[e] * 3, b = cl.eb[e] * 3;
        const d = Math.hypot(cl.pos[a] - cl.pos[b], cl.pos[a + 1] - cl.pos[b + 1], cl.pos[a + 2] - cl.pos[b + 2]);
        const s = Math.abs(d - cl.el[e]) / (cl.el[e] || 1) * 100; sum += s; if (s > mx) mx = s;
    }
    return {max: mx, mean: cl.ea.length ? sum / cl.ea.length : 0};
}
