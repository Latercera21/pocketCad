// PocketCAD - módulo: darts (pinzas / dart)
// Crear una pinza en el contorno y transformarla (trasladar su abertura a otro lado
// conservando el ángulo = la cantidad de material).
//
// Idea geométrica:
//  - CREAR: se saca una cuña del contorno. El contorno ... → A → punta → B → ... reemplaza
//    el tramo A–B. NADA más se mueve: el molde no crece ni se escala.
//  - TRANSFORMAR: se corta por la línea punta→destino, se rota un tramo del contorno
//    alrededor de la punta (cierra la pinza vieja) y la abertura queda en el destino.
//    El ángulo se conserva (rotación rígida).
//
// Trabaja sobre un "ciclo" normalizado de la figura: {verts:[], edges:[]} donde la arista k
// va de verts[k] a verts[(k+1)%n] y sus controles ya están orientados en ese sentido.

    // ---------- helpers de ciclo ----------
    function dartLine() { return {kind:'line', c1:null, c2:null}; }

    function dartMkV(x, y, hard, apex) {
        const v = {x, y};
        if (hard) v.hardCorner = true;
        if (apex) v.dartApex = true;
        return v;
    }

    function dartCopyV(v) { return dartMkV(v.x, v.y, v.hardCorner, v.dartApex); }

    function dartOrientEdge(e, fwd) {
        if (e.cubic && e.control2X != null) {
            const p = {x:e.controlX, y:e.controlY}, q = {x:e.control2X, y:e.control2Y};
            return fwd ? {kind:'cubic', c1:p, c2:q} : {kind:'cubic', c1:q, c2:p};
        }
        if (e.curved && e.controlX != null) return {kind:'quad', c1:{x:e.controlX, y:e.controlY}, c2:null};
        return dartLine();
    }

    function dartEdgeOut(oe, s, e) {
        const o = {start:s, end:e, curved:false, cubic:false, controlX:null, controlY:null, control2X:null, control2Y:null};
        if (oe.kind === 'cubic') {
            o.curved = true; o.cubic = true;
            o.controlX = oe.c1.x; o.controlY = oe.c1.y; o.control2X = oe.c2.x; o.control2Y = oe.c2.y;
        } else if (oe.kind === 'quad') {
            o.curved = true;
            o.controlX = oe.c1.x; o.controlY = oe.c1.y;
        }
        return o;
    }

    // Figura cerrada → ciclo ordenado. order[k] = índice original del vértice k.
    function dartNormalize(fig) {
        if (!fig || !fig.closed) return null;
        const n = fig.vertices.length;
        if (n < 3 || fig.edges.length !== n) return null;
        const inc = Array.from({length:n}, () => []);
        fig.edges.forEach((e, i) => {
            if (e.start === e.end || e.start < 0 || e.end < 0 || e.start >= n || e.end >= n) return;
            inc[e.start].push(i); inc[e.end].push(i);
        });
        if (inc.some(a => a.length !== 2)) return null;
        const used = new Set(), order = [0], edgesOut = [];
        let cur = 0, guard = 0;
        while (guard++ <= n) {
            const ei = inc[cur].find(i => !used.has(i));
            if (ei === undefined) break;
            used.add(ei);
            const e = fig.edges[ei];
            const fwd = (e.start === cur);
            const nxt = fwd ? e.end : e.start;
            edgesOut.push(dartOrientEdge(e, fwd));
            if (nxt === 0) break;
            order.push(nxt); cur = nxt;
        }
        if (order.length !== n || edgesOut.length !== n) return null;
        return {verts: order.map(i => dartCopyV(fig.vertices[i])), edges: edgesOut, order};
    }

    function dartReverseEdge(oe) {
        if (oe.kind === 'cubic') return {kind:'cubic', c1:oe.c2, c2:oe.c1};
        return oe;
    }

    function dartReverse(cyc) {
        const n = cyc.verts.length;
        const verts = [], edges = [];
        for (let k = 0; k < n; k++) verts.push(cyc.verts[n-1-k]);
        for (let k = 0; k < n; k++) edges.push(dartReverseEdge(cyc.edges[((n-2-k) % n + n) % n]));
        return {verts, edges};
    }

    function dartRotateCycle(cyc, pos) {
        const n = cyc.verts.length;
        const verts = [], edges = [];
        for (let j = 0; j < n; j++) { verts.push(cyc.verts[(pos+j) % n]); edges.push(cyc.edges[(pos+j) % n]); }
        return {verts, edges};
    }

    function dartCycleToFigure(cyc, base) {
        const n = cyc.verts.length;
        const fig = Object.assign({}, base);
        fig.vertices = cyc.verts.map(dartCopyV);
        fig.edges = cyc.edges.map((oe, k) => dartEdgeOut(oe, k, (k+1) % n));
        fig.closed = true;
        return fig;
    }

    // ---------- geometría de aristas ----------
    function dartBez(a, oe, b, t) {
        const mt = 1 - t;
        if (oe.kind === 'cubic') {
            return {x: mt*mt*mt*a.x + 3*mt*mt*t*oe.c1.x + 3*mt*t*t*oe.c2.x + t*t*t*b.x,
                    y: mt*mt*mt*a.y + 3*mt*mt*t*oe.c1.y + 3*mt*t*t*oe.c2.y + t*t*t*b.y};
        }
        if (oe.kind === 'quad') {
            return {x: mt*mt*a.x + 2*mt*t*oe.c1.x + t*t*b.x, y: mt*mt*a.y + 2*mt*t*oe.c1.y + t*t*b.y};
        }
        return {x: a.x + (b.x-a.x)*t, y: a.y + (b.y-a.y)*t};
    }

    function dartArcTable(a, oe, b) {
        const steps = 120, ts = [0], cum = [0];
        let prev = a;
        for (let i = 1; i <= steps; i++) {
            const t = i/steps, p = dartBez(a, oe, b, t);
            cum.push(cum[i-1] + Math.hypot(p.x-prev.x, p.y-prev.y));
            ts.push(t); prev = p;
        }
        return {ts, cum, total: cum[steps]};
    }

    function dartTAtArc(tb, s) {
        if (s <= 0) return 0;
        if (s >= tb.total) return 1;
        let lo = 0, hi = tb.cum.length - 1;
        while (hi - lo > 1) { const mid = (lo+hi) >> 1; if (tb.cum[mid] < s) lo = mid; else hi = mid; }
        const span = (tb.cum[hi] - tb.cum[lo]) || 1;
        return tb.ts[lo] + (tb.ts[hi]-tb.ts[lo]) * ((s - tb.cum[lo]) / span);
    }

    function dartArcAtT(tb, t) {
        const f = t * (tb.cum.length - 1);
        const i = Math.min(tb.cum.length - 2, Math.floor(f));
        return tb.cum[i] + (tb.cum[i+1] - tb.cum[i]) * (f - i);
    }

    function dartSplitEdge(a, oe, b, t) {
        const pt = dartBez(a, oe, b, t);
        if (oe.kind === 'cubic') {
            const s = splitCubicBezier(a, oe.c1, oe.c2, b, t);
            return {pt, left:{kind:'cubic', c1:s.left.cp1, c2:s.left.cp2}, right:{kind:'cubic', c1:s.right.cp1, c2:s.right.cp2}};
        }
        if (oe.kind === 'quad') {
            const s = splitQuadraticBezier(a, oe.c1, b, t);
            return {pt,
                left:{kind:'quad', c1:{x:s.left.controlX, y:s.left.controlY}, c2:null},
                right:{kind:'quad', c1:{x:s.right.controlX, y:s.right.controlY}, c2:null}};
        }
        return {pt, left:dartLine(), right:dartLine()};
    }

    // Punto más cercano del contorno (opcionalmente solo en ciertas aristas).
    function dartNearest(cyc, wx, wy, edgeFilter) {
        const n = cyc.verts.length;
        let best = null;
        for (let k = 0; k < n; k++) {
            if (edgeFilter && !edgeFilter(k)) continue;
            const a = cyc.verts[k], b = cyc.verts[(k+1) % n], oe = cyc.edges[k];
            const S = 60;
            let bt = 0, bd = Infinity;
            for (let i = 0; i <= S; i++) {
                const p = dartBez(a, oe, b, i/S), d = Math.hypot(p.x-wx, p.y-wy);
                if (d < bd) { bd = d; bt = i/S; }
            }
            let lo = Math.max(0, bt - 1/S), hi = Math.min(1, bt + 1/S);
            for (let it = 0; it < 30; it++) {
                const m1 = lo + (hi-lo)/3, m2 = hi - (hi-lo)/3;
                const p1 = dartBez(a, oe, b, m1), p2 = dartBez(a, oe, b, m2);
                if (Math.hypot(p1.x-wx, p1.y-wy) < Math.hypot(p2.x-wx, p2.y-wy)) hi = m2; else lo = m1;
            }
            bt = (lo+hi)/2;
            const p = dartBez(a, oe, b, bt), d = Math.hypot(p.x-wx, p.y-wy);
            if (!best || d < best.d) best = {k, t:bt, x:p.x, y:p.y, d};
        }
        return best;
    }

    function dartCycleArea(cyc) {
        let A = 0;
        const n = cyc.verts.length;
        for (let k = 0; k < n; k++) {
            const a = cyc.verts[k], b = cyc.verts[(k+1) % n], oe = cyc.edges[k];
            let pr = a;
            for (let i = 1; i <= 8; i++) {
                const p = (i === 8) ? b : dartBez(a, oe, b, i/8);
                A += pr.x*p.y - p.x*pr.y; pr = p;
            }
        }
        return A/2;
    }

    // ---------- CREAR (la figura CRECE) ----------
    // Modelo "abrir la pinza" (como se hace a mano): se corta el contorno en C, se traza la línea
    // de corte hacia adentro hasta el lado opuesto Q, y la parte de contorno C→Q se DESPLAZA
    // el ancho w de la boca a lo largo de la tangente. Resultado:
    //   - la figura crece w en esa dirección (los lados vecinos conservan su largo),
    //   - la boca queda perpendicular al contorno y la punta en su eje -> las dos patas miden IGUAL,
    //   - el lado opuesto (Q) se alarga w, igual que al hacerlo a mano.
    // Por defecto se mueve el trozo más pequeño (el grande queda quieto); ⇄ invierte.
    // Patas de la pinza A→punta→B. bulgePx = flecha máxima (px): 0 = rectas; + = abombadas hacia
    // afuera (convexas); − = hacia adentro. Las dos patas son espejo, así que miden IGUAL.
    function dartLegs(A, apex, B, bulgePx) {
        if (!bulgePx || Math.abs(bulgePx) < 0.01) return [dartLine(), dartLine()];
        const M0 = {x:(A.x+B.x)/2, y:(A.y+B.y)/2};
        const ax = apex.x-M0.x, ay = apex.y-M0.y, al = Math.hypot(ax, ay) || 1;
        const axu = {x:ax/al, y:ay/al};
        const mk = (P, Q) => {
            const dx = Q.x-P.x, dy = Q.y-P.y, L = Math.hypot(dx, dy) || 1;
            const u = {x:-dy/L, y:dx/L};
            const m = {x:(P.x+Q.x)/2, y:(P.y+Q.y)/2};
            const rx = m.x-M0.x, ry = m.y-M0.y, along = rx*axu.x + ry*axu.y;
            const lat = {x:rx-axu.x*along, y:ry-axu.y*along};
            const s = (u.x*lat.x + u.y*lat.y) >= 0 ? 1 : -1;
            const k = 2*bulgePx*s;                       // en una cuadrática la flecha es la mitad del desvío del control
            return {kind:'quad', c1:{x:m.x+u.x*k, y:m.y+u.y*k}, c2:null};
        };
        return [mk(A, apex), mk(apex, B)];
    }

    function dartNum(id, def) {
        const v = parseFloat(String(document.getElementById(id).value).replace(',', '.'));
        return isNaN(v) ? def : v;
    }

    function dartEdgeLen(a, oe, b) {
        let L = 0, pr = a;
        for (let i = 1; i <= 24; i++) {
            const p = (i === 24) ? b : dartBez(a, oe, b, i/24);
            L += Math.hypot(p.x-pr.x, p.y-pr.y); pr = p;
        }
        return L;
    }

    // Avanza 'delta' px a lo largo del contorno desde (k,t), cruzando vértices (puntos de curva incluidos).
    function dartAdvance(cyc, k, t, delta) {
        const n = cyc.verts.length;
        const tbl = kk => dartArcTable(cyc.verts[kk], cyc.edges[kk], cyc.verts[(kk+1) % n]);
        let tb = tbl(k);
        let s = dartArcAtT(tb, t) + delta;
        for (let g = 0; g < 2*n + 4; g++) {
            if (s >= 0 && s <= tb.total) return {k, t: dartTAtArc(tb, s)};
            if (s > tb.total) { s -= tb.total; k = (k+1) % n; tb = tbl(k); }
            else { k = (k-1+n) % n; tb = tbl(k); s += tb.total; }
        }
        return null;
    }

    function dartTangent(cyc, k, t) {
        const n = cyc.verts.length;
        const a = cyc.verts[k], b = cyc.verts[(k+1) % n], oe = cyc.edges[k];
        const p0 = dartBez(a, oe, b, Math.max(0, t-0.01)), p1 = dartBez(a, oe, b, Math.min(1, t+0.01));
        const L = Math.hypot(p1.x-p0.x, p1.y-p0.y) || 1;
        return {x:(p1.x-p0.x)/L, y:(p1.y-p0.y)/L};
    }

    // Inserta (si hace falta) un vértice en (k,t). Devuelve {idx, added}.
    function dartInsertPoint(cyc, k, t) {
        const n = cyc.verts.length;
        const a = cyc.verts[k], b = cyc.verts[(k+1) % n], oe = cyc.edges[k];
        const tb = dartArcTable(a, oe, b);
        const s = dartArcAtT(tb, t);
        if (s < 0.3) { cyc.verts[k].hardCorner = true; return {idx:k, added:false}; }
        if (tb.total - s < 0.3) { cyc.verts[(k+1) % n].hardCorner = true; return {idx:(k+1) % n, added:false}; }
        const sp = dartSplitEdge(a, oe, b, t);
        cyc.verts.splice(k+1, 0, dartMkV(sp.pt.x, sp.pt.y, true, false));
        cyc.edges.splice(k, 1, sp.left, sp.right);
        return {idx:k+1, added:true};
    }

    // Primer corte del rayo C + τ·N con el contorno (τ > 1px). Devuelve {k,t,tau} o null.
    function dartRayHit(cyc, C, N) {
        const n = cyc.verts.length, S = 24;
        let best = null;
        for (let k = 0; k < n; k++) {
            const a = cyc.verts[k], b = cyc.verts[(k+1) % n], oe = cyc.edges[k];
            let pr = a;
            for (let i = 1; i <= S; i++) {
                const p = (i === S) ? b : dartBez(a, oe, b, i/S);
                const sx = p.x - pr.x, sy = p.y - pr.y;
                const den = N.x*sy - N.y*sx;
                if (Math.abs(den) > 1e-12) {
                    const qx = pr.x - C.x, qy = pr.y - C.y;
                    const tau = (qx*sy - qy*sx) / den;
                    const u = (qx*N.y - qy*N.x) / den;
                    if (tau > 1 && u >= 0 && u <= 1 && (!best || tau < best.tau)) best = {k, t:(i-1+u)/S, tau};
                }
                pr = p;
            }
        }
        return best;
    }

    // Una orientación (la parte que se mueve es la que sigue a C en el recorrido).
    function dartCreateOne(cyc, wx, wy, wPx, dPx, bulgePx) {
        const n = cyc.verts.length;
        const nr = dartNearest(cyc, wx, wy);
        const c0 = dartAdvance(cyc, nr.k, nr.t, -wPx/2);
        if (!c0) return {err:'No se pudo ubicar la pinza aquí'};
        const T = dartTangent(cyc, c0.k, c0.t);
        const Cpt = dartBez(cyc.verts[c0.k], cyc.edges[c0.k], cyc.verts[(c0.k+1) % n], c0.t);
        const area = dartCycleArea(cyc);
        const N = area > 0 ? {x:-T.y, y:T.x} : {x:T.y, y:-T.x};     // hacia el interior
        const hit = dartRayHit(cyc, Cpt, N);
        if (!hit) return {err:'No se encontró el lado opuesto del molde'};
        if (dPx >= hit.tau - 1) return {err:'La pinza es más profunda que el molde en este punto'};
        const qn = dartNearest(cyc, Cpt.x + N.x*hit.tau, Cpt.y + N.y*hit.tau, kk => kk === hit.k);
        const qk = qn ? qn.k : hit.k, qt = qn ? qn.t : hit.t;

        // insertar C y Q (primero el que viene después en el recorrido)
        const w2 = {verts: cyc.verts.map(dartCopyV), edges: cyc.edges.slice()};
        let pts = [{id:'c', k:c0.k, t:c0.t}, {id:'q', k:qk, t:qt}];
        pts.sort((p, q) => (q.k + q.t) - (p.k + p.t));        // mayor primero
        if (Math.abs((pts[0].k + pts[0].t) - (pts[1].k + pts[1].t)) < 1e-6) return {err:'Pinza demasiado cerca del lado opuesto'};
        const idx = {};
        const first = dartInsertPoint(w2, pts[0].k, pts[0].t);
        idx[pts[0].id] = first.idx;
        let t2 = pts[1].t;
        if (first.added && pts[1].k === pts[0].k) t2 = pts[1].t / pts[0].t;
        const second = dartInsertPoint(w2, pts[1].k, t2);
        idx[pts[1].id] = second.idx;
        if (second.added && second.idx <= idx[pts[0].id]) idx[pts[0].id]++;
        const ic = idx.c, iq = idx.q, nn = w2.verts.length;
        if (ic === iq) return {err:'Pinza demasiado cerca del lado opuesto'};

        const ch1 = [], ch2 = [];
        for (let i = ic; ; i = (i+1) % nn) { ch1.push(i); if (i === iq) break; }
        for (let i = iq; ; i = (i+1) % nn) { ch2.push(i); if (i === ic) break; }
        let movedLen = 0, fixedLen = 0;
        for (let j = 0; j < ch1.length-1; j++) { const i = ch1[j]; movedLen += dartEdgeLen(w2.verts[i], w2.edges[i], w2.verts[(i+1) % nn]); }
        for (let j = 0; j < ch2.length-1; j++) { const i = ch2[j]; fixedLen += dartEdgeLen(w2.verts[i], w2.edges[i], w2.verts[(i+1) % nn]); }

        const wv = {x:T.x*wPx, y:T.y*wPx};
        const mv = p => ({x:p.x+wv.x, y:p.y+wv.y});
        const trEdge = oe => dartRotEdge(oe, mv);               // trasladar controles (misma función de mapeo)
        const V = w2.verts, E = w2.edges;
        const Cv = V[ic];
        const A = {x:Cv.x, y:Cv.y}, B = mv(Cv);
        const apex = {x:(A.x+B.x)/2 + N.x*dPx, y:(A.y+B.y)/2 + N.y*dPx};
        const outV = [], outE = [];
        const legs = dartLegs(A, apex, B, bulgePx);
        outV.push(dartMkV(A.x, A.y, true, false));  outE.push(legs[0]);         // A → punta
        outV.push(dartMkV(apex.x, apex.y, true, true)); outE.push(legs[1]);     // punta → B
        ch1.forEach((i, j) => {
            const p = mv(V[i]);
            outV.push(dartMkV(p.x, p.y, j === 0 || j === ch1.length-1 || V[i].hardCorner, V[i].dartApex));
        });
        for (let j = 0; j < ch1.length-1; j++) outE.push(trEdge(E[ch1[j]]));
        outE.push(dartLine());                                                  // Q+w → Q
        for (let j = 0; j < ch2.length-1; j++) {
            const v = dartCopyV(V[ch2[j]]); if (j === 0) v.hardCorner = true;
            outV.push(v); outE.push(E[ch2[j]]);
        }
        return {cyc:{verts:outV, edges:outE}, A, B, apex, wPx, dPx, movedLen, fixedLen};
    }

    // Devuelve null (sin figura cerca), {err} o {fi, cyc, A, B, apex, wPx, dPx}
    function computeDartCreate(wx, wy) {
        const wCm = dartNum('dartWidth', NaN), dCm = dartNum('dartDepth', NaN);
        let best = null;
        for (let fi = 0; fi < figures.length; fi++) {
            const fig = figures[fi];
            if (fig.locked || !fig.closed) continue;
            const cyc = dartNormalize(fig);
            if (!cyc) continue;
            const nr = dartNearest(cyc, wx, wy);
            if (nr && nr.d < 25/viewScale && (!best || nr.d < best.nr.d)) best = {fi, cyc, nr};
        }
        if (!best) return null;
        if (!(wCm > 0) || !(dCm > 0)) return {err:'Ingresa profundidad y ancho (cm)'};
        const wPx = wCm*PX_PER_CM, dPx = dCm*PX_PER_CM;
        const bulgePx = dartNum('dartCurve', 0) * PX_PER_CM;
        let r = dartCreateOne(best.cyc, wx, wy, wPx, dPx, bulgePx);
        if (r.err) return r;
        // por defecto se mueve el trozo más pequeño; ⇄ lo invierte
        const reverse = dartFlip ? (r.movedLen <= r.fixedLen) : (r.movedLen > r.fixedLen);
        if (reverse) {
            const r2 = dartCreateOne(dartReverse(best.cyc), wx, wy, wPx, dPx, bulgePx);
            if (!r2.err) r = r2;
        }
        r.fi = best.fi;
        return r;
    }

    function applyDart() {
        if (dartXformActive) return;
        if (!dartHover) { showModal({title:'Pinza', body:'Toca primero un punto del contorno donde ubicar la pinza.', buttons:[{label:'OK'}]}); return; }
        const r = computeDartCreate(dartHover.x, dartHover.y);
        if (!r || r.err) { showModal({title:'Pinza', body:(r && r.err) || 'Toca un punto del contorno de un molde.', buttons:[{label:'OK'}]}); return; }
        saveState();
        figures[r.fi] = dartCycleToFigure(r.cyc, figures[r.fi]);
        dartHover = null;
        redrawAll();
    }

    // ---------- TRANSFORMAR ----------
    function dartIsApexCandidate(cyc, pos) {
        const n = cyc.verts.length, v = cyc.verts[pos];
        if (v.dartApex) return true;
        const A = cyc.verts[(pos-1+n) % n], B = cyc.verts[(pos+1) % n];
        const ux = A.x-v.x, uy = A.y-v.y, wx = B.x-v.x, wy = B.y-v.y;
        const lu = Math.hypot(ux, uy), lw = Math.hypot(wx, wy);
        if (lu < 1e-6 || lw < 1e-6) return false;
        return (ux*wx + uy*wy) / (lu*lw) > Math.cos(45 * Math.PI/180); // ángulo entre patas ≤ 45°
    }

    function dartRotEdge(oe, rot) {
        if (oe.kind === 'cubic') return {kind:'cubic', c1:rot(oe.c1), c2:rot(oe.c2)};
        if (oe.kind === 'quad') return {kind:'quad', c1:rot(oe.c1), c2:null};
        return oe;
    }

    // dest: punto del mundo (se proyecta al contorno). pct: 1..100 (cuánto de la pinza se traslada).
    // Devuelve null, {err} o {cyc, apex, Dp, D, ang}
    function computeDartTransform(fi, vi, dest, pct, flip) {
        const fig = figures[fi];
        if (!fig) return {err:'Figura no encontrada', reset:true};
        let cyc = dartNormalize(fig);
        if (!cyc) return {err:'La figura debe estar cerrada y ser un contorno simple'};
        const n0 = cyc.verts.length;
        let pos = cyc.order.indexOf(vi);
        if (pos < 0) return {err:'Vértice no encontrado', reset:true};
        if (flip) { cyc = dartReverse(cyc); pos = n0 - 1 - pos; }
        cyc = dartRotateCycle(cyc, pos);          // punta en el índice 0, B = 1, A = n-1
        let n = cyc.verts.length;
        if (n < 4) return {err:'Faltan vértices en el contorno'};
        const apex = cyc.verts[0], B = cyc.verts[1], A = cyc.verts[n-1];
        const w = {x:B.x-apex.x, y:B.y-apex.y}, u = {x:A.x-apex.x, y:A.y-apex.y};
        if (Math.hypot(w.x, w.y) < 1e-6 || Math.hypot(u.x, u.y) < 1e-6) return {err:'Pinza degenerada'};
        const phi = Math.atan2(w.x*u.y - w.y*u.x, w.x*u.x + w.y*u.y);   // de B hacia A
        if (Math.abs(phi) < 1e-3) return {err:'Esta pinza no tiene abertura'};
        const near = dartNearest(cyc, dest.x, dest.y, k => k >= 1 && k <= n-2);
        if (!near) return null;

        // ¿cae sobre un vértice existente? (con snap, tolerancia más grande)
        const tol = Math.max(3/viewScale, snapEnabled ? getSnapThreshold() : 0);
        const verts = cyc.verts.map(dartCopyV), edges = cyc.edges.slice();
        let m;
        const dk = Math.hypot(near.x - verts[near.k].x, near.y - verts[near.k].y);
        const dk1 = Math.hypot(near.x - verts[near.k+1].x, near.y - verts[near.k+1].y);
        if (dk < tol) m = near.k;
        else if (dk1 < tol) m = near.k + 1;
        else {
            const sp = dartSplitEdge(verts[near.k], edges[near.k], verts[near.k+1], near.t);
            verts.splice(near.k+1, 0, dartMkV(sp.pt.x, sp.pt.y, true, false));
            edges.splice(near.k, 1, sp.left, sp.right);
            m = near.k + 1;
        }
        n = verts.length;
        if (m < 2 || m > n-2) return {err:'Elige un punto del contorno distinto de las patas de la pinza'};
        let per1 = 0, per2 = 0;      // largo del trozo que gira (B…D) y del que queda quieto (D…A)
        for (let i = 1; i < m; i++) per1 += dartEdgeLen(verts[i], edges[i], verts[i+1]);
        for (let i = m; i <= n-2; i++) per2 += dartEdgeLen(verts[i], edges[i], verts[i+1]);

        const f = Math.max(0, Math.min(1, pct/100));
        if (f <= 0) return {err:'El porcentaje debe ser mayor que 0'};
        const ang = phi * f, cs = Math.cos(ang), sn = Math.sin(ang);
        const rot = p => ({x: apex.x + (p.x-apex.x)*cs - (p.y-apex.y)*sn, y: apex.y + (p.x-apex.x)*sn + (p.y-apex.y)*cs});
        const rotV = (v, hard) => { const q = rot(v); return dartMkV(q.x, q.y, hard || v.hardCorner, v.dartApex); };

        const D = verts[m];
        const Dp = rot(D);
        const apex2 = dartMkV(apex.x, apex.y, true, true);
        const newLegs = dartLegs(Dp, apex, D, dartNum('dartCurve', 0) * PX_PER_CM);
        const Dfix = dartMkV(D.x, D.y, true, false);
        const Dmov = dartMkV(Dp.x, Dp.y, true, false);
        const movedEdges = [];
        for (let i = 0; i < m; i++) movedEdges.push(dartRotEdge(edges[i], rot));   // e0 (punta→B') incluida
        const Bp = rotV(verts[1], true);
        const full = f >= 0.9999;
        let outV = [], outE = [];

        if (full) {
            const Aorig = dartCopyV(verts[n-1]);
            Aorig.hardCorner = true;
            const gap = Math.hypot(Aorig.x-Bp.x, Aorig.y-Bp.y);
            if (gap < 0.5) {
                // A y B' coinciden: se funden, la pinza vieja desaparece
                outV.push(Aorig);
                for (let i = 2; i < m; i++) outV.push(rotV(verts[i], false));
                outV.push(Dmov, apex2, Dfix);
                for (let i = m+1; i <= n-2; i++) outV.push(dartCopyV(verts[i]));
                for (let i = 1; i < m; i++) outE.push(movedEdges[i]);
                outE.push(newLegs[0], newLegs[1]);
                for (let i = m; i <= n-2; i++) outE.push(edges[i]);
            } else {
                outV.push(Bp);
                for (let i = 2; i < m; i++) outV.push(rotV(verts[i], false));
                outV.push(Dmov, apex2, Dfix);
                for (let i = m+1; i <= n-2; i++) outV.push(dartCopyV(verts[i]));
                outV.push(Aorig);
                for (let i = 1; i < m; i++) outE.push(movedEdges[i]);
                outE.push(newLegs[0], newLegs[1]);
                for (let i = m; i <= n-2; i++) outE.push(edges[i]);
                outE.push(dartLine());            // A → B' (tramo corto si las patas eran distintas)
            }
        } else {
            const apex1 = dartMkV(apex.x, apex.y, true, true);
            outV.push(apex1, Bp);
            for (let i = 2; i < m; i++) outV.push(rotV(verts[i], false));
            outV.push(Dmov, apex2, Dfix);
            for (let i = m+1; i <= n-1; i++) outV.push(dartCopyV(verts[i]));
            outV[outV.length-1].hardCorner = true;
            for (let i = 0; i < m; i++) outE.push(movedEdges[i]);
            outE.push(newLegs[0], newLegs[1]);
            for (let i = m; i <= n-1; i++) outE.push(edges[i]);
        }
        return {cyc:{verts:outV, edges:outE}, apex, Dp, D, ang:Math.abs(ang), per1, per2};
    }

    // Por defecto gira el trozo más pequeño y el grande (la base) queda quieto; ⇄ lo invierte.
    function computeDartTransformAuto(fi, vi, dest, pct) {
        let r = computeDartTransform(fi, vi, dest, pct, false);
        if (!r || r.err) return r;
        const reverse = dartFlip ? (r.per1 <= r.per2) : (r.per1 > r.per2);
        if (reverse) {
            const r2 = computeDartTransform(fi, vi, dest, pct, true);
            if (r2 && !r2.err) r = r2;
        }
        return r;
    }

    function dartPct() {
        const v = dartNum('dartPct', 100);
        return Math.max(1, Math.min(100, v));
    }

    function applyDartTransform() {
        if (!dartXformActive) return;
        if (!dartApexSel || !dartDest) { showModal({title:'Pinza', body:'Toca la punta de una pinza y arrastra hacia el contorno destino.', buttons:[{label:'OK'}]}); return; }
        const r = computeDartTransformAuto(dartApexSel.fi, dartApexSel.vi, dartDest, dartPct());
        if (!r || r.err) { showModal({title:'Pinza', body:(r && r.err) || 'Destino no válido.', buttons:[{label:'OK'}]}); return; }
        saveState();
        figures[dartApexSel.fi] = dartCycleToFigure(r.cyc, figures[dartApexSel.fi]);
        dartApexSel = null; dartDest = null;
        redrawAll();
    }

    // ---------- interacción ----------
    function dartHandleDown(wx, wy) {
        if (!dartXformActive) {
            dartHover = {x:wx, y:wy};
            dragData = {type:'dartPlace'};
            redrawAll();
            return;
        }
        const nv = findNearestVertex(wx, wy);
        if (nv) {
            const cyc = dartNormalize(figures[nv.figureIndex]);
            if (cyc) {
                const pos = cyc.order.indexOf(nv.vertexIndex);
                if (pos >= 0 && dartIsApexCandidate(cyc, pos)) {
                    dartApexSel = {fi:nv.figureIndex, vi:nv.vertexIndex};
                    dartDest = null;
                    dragData = {type:'dartDrag'};
                    redrawAll();
                    return;
                }
            }
        }
        if (dartApexSel) { dartDest = {x:wx, y:wy}; dragData = {type:'dartDrag'}; }
        redrawAll();
    }

    function dartHandleMove(wx, wy) {
        if (!dartXformActive) { dartHover = {x:wx, y:wy}; redrawAll(); return; }
        if (dragData && dragData.type === 'dartDrag' && dartApexSel) { dartDest = {x:wx, y:wy}; redrawAll(); }
    }

    // ---------- UI ----------
    function dartPanelSync() {
        document.getElementById('dartXformBtn').classList.toggle('on', dartXformActive);
        document.getElementById('dartCreateInputs').style.display = dartXformActive ? 'none' : 'inline-flex';
        document.getElementById('dartXformInputs').style.display = dartXformActive ? 'inline-flex' : 'none';
        document.getElementById('dartFlipBtn').classList.toggle('on', dartFlip);
        document.getElementById('dartFlipBtn2').classList.toggle('on', dartFlip);
    }

    function toggleDartTransform() {
        dartXformActive = !dartXformActive;
        dartApexSel = null; dartDest = null; dartHover = null; dragData = null;
        dartPanelSync();
        redrawAll();
    }

    function toggleDartFlip() {
        dartFlip = !dartFlip;
        dartPanelSync();
        redrawAll();
    }

    function resetDartState() {
        dartXformActive = false; dartApexSel = null; dartDest = null; dartHover = null; dartFlip = false;
        dartPanelSync();
    }

    // ---------- dibujo ----------
    function dartStatus(msg) {
        const el = document.getElementById('activeModeLabel');
        const txt = msg || (dartXformActive ? 'Pinza → Transformar' : MODE_LABELS.dart);
        if (el.textContent !== txt) showActiveLabel(txt);
    }

    function dartDrawCycle(cyc, col) {
        const n = cyc.verts.length;
        ctx.save();
        ctx.setLineDash([6/viewScale, 4/viewScale]);
        ctx.lineWidth = 2/viewScale;
        ctx.strokeStyle = col;
        ctx.beginPath();
        for (let k = 0; k < n; k++) {
            const a = cyc.verts[k], b = cyc.verts[(k+1) % n], oe = cyc.edges[k];
            ctx.moveTo(a.x, a.y);
            if (oe.kind === 'cubic') ctx.bezierCurveTo(oe.c1.x, oe.c1.y, oe.c2.x, oe.c2.y, b.x, b.y);
            else if (oe.kind === 'quad') ctx.quadraticCurveTo(oe.c1.x, oe.c1.y, b.x, b.y);
            else ctx.lineTo(b.x, b.y);
        }
        ctx.stroke();
        ctx.restore();
    }

    function dartDrawWedge(p, q, r, col) {
        ctx.save();
        ctx.globalAlpha = 0.25; ctx.fillStyle = col;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.lineTo(r.x, r.y); ctx.closePath(); ctx.fill();
        ctx.restore();
    }

    function dartDrawText(txt, x, y) {
        ctx.save();
        ctx.font = getMeasureFontSize() + 'px sans-serif';
        ctx.fillStyle = getMeasureTextColor();
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(txt, x, y);
        ctx.restore();
    }

    function drawDartPreview() {
        const dark = document.body.classList.contains('dark');
        const col = dark ? '#ffd54f' : '#e65100';

        if (!dartXformActive) {
            if (!dartHover) { dartStatus('Pinza: toca un punto del contorno'); return; }
            const r = computeDartCreate(dartHover.x, dartHover.y);
            if (!r) { dartStatus('Pinza: toca un punto del contorno'); return; }
            if (r.err) { dartStatus(r.err); return; }
            dartStatus(null);
            dartDrawCycle(r.cyc, col);
            dartDrawWedge(r.A, r.apex, r.B, col);
            dartDrawText(pxToCm(r.dPx).toFixed(1) + ' × ' + pxToCm(r.wPx).toFixed(1) + ' cm',
                r.apex.x, r.apex.y - 10/viewScale);
            return;
        }

        // Transformar: marcar posibles puntas de pinza
        if (!dartApexSel) {
            figures.forEach(fig => {
                if (fig.locked || !fig.closed) return;
                const cyc = dartNormalize(fig);
                if (!cyc) return;
                cyc.verts.forEach((v, pos) => {
                    if (!dartIsApexCandidate(cyc, pos)) return;
                    ctx.save();
                    ctx.beginPath(); ctx.arc(v.x, v.y, 7/viewScale, 0, Math.PI*2);
                    ctx.lineWidth = 1.6/viewScale; ctx.strokeStyle = col; ctx.stroke();
                    ctx.restore();
                });
            });
            dartStatus('Toca la punta (vértice interior) de una pinza');
            return;
        }
        const fig = figures[dartApexSel.fi];
        const av = fig && fig.vertices[dartApexSel.vi];
        if (!av) { dartApexSel = null; dartDest = null; return; }
        ctx.save();
        ctx.beginPath(); ctx.arc(av.x, av.y, 7/viewScale, 0, Math.PI*2);
        ctx.fillStyle = col; ctx.globalAlpha = 0.5; ctx.fill();
        ctx.restore();
        if (!dartDest) { dartStatus('Arrastra hacia el contorno destino'); return; }
        const r = computeDartTransformAuto(dartApexSel.fi, dartApexSel.vi, dartDest, dartPct());
        if (!r) { dartStatus(null); return; }
        if (r.err) { dartStatus(r.err); if (r.reset) { dartApexSel = null; dartDest = null; } return; }
        dartStatus(null);
        dartDrawCycle(r.cyc, col);
        dartDrawWedge(r.Dp, r.apex, r.D, col);
        ctx.save();
        ctx.setLineDash([2/viewScale, 3/viewScale]); ctx.lineWidth = 1/viewScale; ctx.strokeStyle = col;
        ctx.beginPath(); ctx.moveTo(r.apex.x, r.apex.y); ctx.lineTo(r.D.x, r.D.y); ctx.stroke();
        ctx.restore();
        dartDrawText((r.ang*180/Math.PI).toFixed(1) + '° · ancho ' + pxToCm(Math.hypot(r.Dp.x-r.D.x, r.Dp.y-r.D.y)).toFixed(1) + ' cm',
            (r.Dp.x + r.D.x)/2, (r.Dp.y + r.D.y)/2 - 10/viewScale);
    }
