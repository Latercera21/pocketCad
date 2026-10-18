// PocketCAD - módulo: offset
// Generado a partir de la división del archivo monolítico original.

 // key: fi+'_'+vi -> 'x' | 'y'
    // Dirección (X/Y) y MED (medida por lado) se pisan al tocar un vértice (el vértice
    // está sobre un lado seleccionado y MED lo captura primero), así que son excluyentes:
    // activar uno apaga el otro.
    function offsetDistModeOff(){
        offsetDistMode = false; offsetDistAvgArmed = false;
        document.getElementById('offsetDistBtn').classList.remove('on');
        document.getElementById('offsetDistButtons').style.display = 'none';
        document.getElementById('offsetDistAvgBtn').classList.remove('on');
    }

    function offsetDirModeOff(){
        offsetDirMode = false; offsetArmedAxis = null;
        document.getElementById('offsetDirBtn').classList.remove('on');
        document.getElementById('offsetAxisButtons').style.display = 'none';
        document.getElementById('offsetAxisXBtn').classList.remove('on');
        document.getElementById('offsetAxisYBtn').classList.remove('on');
    }

    function toggleOffsetDirMode(){
        if (!offsetDirMode) offsetDistModeOff();
        offsetDirMode = !offsetDirMode;
        document.getElementById('offsetDirBtn').classList.toggle('on', offsetDirMode);
        document.getElementById('offsetAxisButtons').style.display = offsetDirMode ? 'inline-flex' : 'none';
        if(!offsetDirMode){
            offsetArmedAxis = null;
            document.getElementById('offsetAxisXBtn').classList.remove('on');
            document.getElementById('offsetAxisYBtn').classList.remove('on');
        }
        redrawAll();
    }

    function armOffsetAxis(axis){
        offsetArmedAxis = (offsetArmedAxis === axis) ? null : axis;
        document.getElementById('offsetAxisXBtn').classList.toggle('on', offsetArmedAxis==='x');
        document.getElementById('offsetAxisYBtn').classList.toggle('on', offsetArmedAxis==='y');
    }

    function toggleOffsetDistMode(){
        if (!offsetDistMode) offsetDirModeOff();
        offsetDistMode = !offsetDistMode;
        document.getElementById('offsetDistBtn').classList.toggle('on', offsetDistMode);
        document.getElementById('offsetDistButtons').style.display = offsetDistMode ? 'inline-flex' : 'none';
        if(!offsetDistMode){ offsetDistAvgArmed=false; document.getElementById('offsetDistAvgBtn').classList.remove('on'); }
        redrawAll();
    }

    function armOffsetDistAvg(){
        offsetDistAvgArmed = !offsetDistAvgArmed;
        document.getElementById('offsetDistAvgBtn').classList.toggle('on', offsetDistAvgArmed);
    }

    function createOffsetRef(fi){
        if (offsetRefIndex !== null) return; // ya existe
        const refFig = JSON.parse(JSON.stringify(figures[fi]));
        refFig.locked = true;
        figures.push(refFig);
        offsetRefIndex = figures.length - 1;
    }

    function discardOffsetRef(){
        // La figura de referencia era solo una guía temporal (no se aplicó ningún
        // cambio, o se aplicó en modo Costura): se borra de verdad, no solo se
        // olvida el puntero. Olvidar el puntero sin borrar la figura es lo que
        // causaba el bug de duplicados (cada deseleccionar-todo dejaba una copia
        // huérfana y la siguiente selección creaba otra más).
        if (offsetRefIndex !== null && figures[offsetRefIndex]) {
            figures.splice(offsetRefIndex, 1);
        }
        offsetRefIndex = null;
    }

    function keepOffsetRef(){
        // Modo Tallas: la referencia se confirma como figura definitiva (la talla
        // base), bloqueada, para que el usuario la desbloquee o borre a mano si
        // quiere. Solo se olvida el puntero interno; la figura se queda.
        offsetRefIndex = null;
    }

    // ===================== PREVISUALIZACIÓN (Costura/Tallas) =====================
    // Se recalcula en cada redraw mientras hay aristas seleccionadas: corre el mismo
    // applyOffsetPass ya probado, pero sobre CLONES (nunca toca las figuras reales), así
    // el usuario ve cómo va a quedar antes de tocar ✓. Sirve igual para Costura (1 sola
    // pasada) que para Tallas (todas las pasadas ▲/▼ configuradas) y para las correcciones
    // por coordenadas (al arrastrar/tocar un punto en modo 📍 XY, ya se ve reflejado porque
    // ese modo edita directo sobre la figura real).
    function computeTallasPreview(){
        if ((mode!=='costura' && mode!=='tallas') || offsetEdges.length===0) return null;
        const valEl = document.getElementById('offsetValue');
        if (!valEl) return null;
        const distCm = parseFloat(String(valEl.value).replace(',','.'));
        if (isNaN(distCm) || distCm<=0) return null;
        try {
            const fi = offsetEdges[0].figureIndex;
            const fig = figures[fi];
            if (!fig) return null;
            const baseEdgeIdxs = offsetEdges.map(o=>o.edgeIndex);
            const distPx = distCm * PX_PER_CM;
            const baseAxisMap = {};
            Object.keys(offsetVertexAxis).forEach(k=>{ const [kfi,kvi]=k.split('_'); if(parseInt(kfi)===fi) baseAxisMap[parseInt(kvi)]=offsetVertexAxis[k]; });
            const baseDistMap = {};
            Object.keys(offsetEdgeDist).forEach(k=>{ const [kfi,kei]=k.split('_'); if(parseInt(kfi)===fi) baseDistMap[parseInt(kei)]=offsetEdgeDist[k]; });

            if (mode==='costura') {
                const curFig = JSON.parse(JSON.stringify(fig));
                applyOffsetPass(curFig, baseEdgeIdxs.slice(), distPx, fi, Object.assign({},baseAxisMap), Object.assign({},baseDistMap));
                mergeCloseVertices(curFig, 0.05*PX_PER_CM);
                return [curFig];
            }
            function clamp06(v){ v=parseInt(v); if(!v||isNaN(v)) v=0; return Math.max(-6, Math.min(6, v)); }
            let up=clamp06(document.getElementById('offsetTallaUp').value), down=clamp06(document.getElementById('offsetTallaDown').value);
            if (up<0){ down+=-up; up=0; } if (down<0){ up+=-down; down=0; }
            up=Math.min(6,up); down=Math.min(6,down);
            const results=[];
            function grow(steps, sign){
                let curFig=JSON.parse(JSON.stringify(fig));
                let curEdgeIdxs=baseEdgeIdxs.slice();
                let curAxisMap=Object.assign({},baseAxisMap);
                let curDistMap=Object.assign({},baseDistMap);
                let curConnectorSet=new Set();
                for (let s=0; s<steps; s++){
                    const result=applyOffsetPass(curFig,curEdgeIdxs,distPx*sign,fi,curAxisMap,curDistMap,curConnectorSet);
                    curEdgeIdxs=result.edgeIdxs; curAxisMap=result.axisMap; curDistMap=result.distMap; curConnectorSet=result.connectorSet;
                    const snap=JSON.parse(JSON.stringify(curFig));
                    mergeCloseVertices(snap, 0.05*PX_PER_CM);
                    results.push(snap);
                }
            }
            if (up===0 && down===0) grow(1,1);
            else { if(up>0) grow(up,1); if(down>0) grow(down,-1); }
            return results;
        } catch(e) { return null; }
    }

    function toggleCostura() {
        if (mode==='costura') { setMode('none'); offsetEdges=[]; redrawAll(); }
        else { setMode('costura'); offsetEdges=[]; }
    }

    function toggleTallas() {
        if (mode==='tallas') { setMode('none'); offsetEdges=[]; redrawAll(); }
        else { setMode('tallas'); offsetEdges=[]; }
    }

    // Editar por coordenadas (subfunción temporal dentro de Tallas, adaptada del mismo
    // mecanismo de "editar vértice por X/Y"): a diferencia del modo vértice normal, acá SÍ
    // se puede tocar vértices de figuras bloqueadas, porque las tallas generadas quedan
    // bloqueadas por diseño y este modo existe justo para poder corregirlas a mano después
    // de graduar (por ejemplo si una talla no dio exacto contra una tabla de medidas).
    function toggleTallasCoord(){
        tallasCoordActive = !tallasCoordActive;
        document.getElementById('tallasCoordBtn').classList.toggle('on', tallasCoordActive);
        document.getElementById('tallasCoordInputs').style.display = tallasCoordActive ? 'flex' : 'none';
        if (!tallasCoordActive) selectedVertex = null;
        updateTallasCoordReadout();
        redrawAll();
    }

    // Texto explícito con la posición del vértice tocado (además del puntito de color en el
    // lienzo), para que quede clarísimo cuál está seleccionado sin depender solo del color.
    function updateTallasCoordReadout(){
        const el = document.getElementById('tallasCoordReadout');
        if (!el) return;
        if (!selectedVertex || !figures[selectedVertex.figureIndex]) { el.textContent = 'tocá un punto…'; return; }
        const v = figures[selectedVertex.figureIndex].vertices[selectedVertex.vertexIndex];
        el.textContent = `X:${(v.x/PX_PER_CM).toFixed(1)} Y:${(v.y/PX_PER_CM).toFixed(1)}`;
    }

    function applyTallasDelta(){
        if (!selectedVertex) { showModal({title:'Error', body:'Primero tocá el punto de la talla que querés corregir.', buttons:[{label:'OK'}]}); return; }
        const dx=parseFloat(String(document.getElementById('tallasDX').value).replace(',','.'));
        const dy=parseFloat(String(document.getElementById('tallasDY').value).replace(',','.'));
        if (isNaN(dx) && isNaN(dy)) return;
        saveState();
        const fig=figures[selectedVertex.figureIndex];
        const vi=selectedVertex.vertexIndex;
        const v=fig.vertices[vi];
        if (!isNaN(dx)) v.x += dx*PX_PER_CM;
        if (!isNaN(dy)) v.y += dy*PX_PER_CM;
        // Si el punto tocado es parte de un lado curvo (cadena Catmull-Rom), hay que
        // recalcular sus puntos de control: si no, la curva se queda con la forma
        // vieja, sin seguir al punto que se acaba de mover a mano.
        const recomputed = new Set();
        fig.edges.forEach((e, ei) => {
            if (!e.cubic) return;
            if (e.start !== vi && e.end !== vi) return;
            const chain = getCurveChain(fig, ei);
            const key = chain.join(',');
            if (recomputed.has(key)) return;
            recomputed.add(key);
            recomputeCurveChain(fig, chain);
        });
        document.getElementById('tallasDX').value='';
        document.getElementById('tallasDY').value='';
        updateTallasCoordReadout();
        redrawAll();
    }

 //unfildfigureinplace fin


    // Intersección de dos SEGMENTOS (no rectas infinitas), con t,u acotados a
    // (0,1) exclusivo -no cuenta que se toquen justo en una punta compartida.
    function segmentIntersect(p1,p2,p3,p4) {
        const d1x=p2.x-p1.x, d1y=p2.y-p1.y;
        const d2x=p4.x-p3.x, d2y=p4.y-p3.y;
        const denom = d1x*d2y - d1y*d2x;
        if (Math.abs(denom) < 1e-9) return null;
        const t = ((p3.x-p1.x)*d2y - (p3.y-p1.y)*d2x) / denom;
        const u = ((p3.x-p1.x)*d1y - (p3.y-p1.y)*d1x) / denom;
        if (t>1e-6 && t<1-1e-6 && u>1e-6 && u<1-1e-6) return {x: p1.x+t*d1x, y: p1.y+t*d1y};
        return null;
    }

    // Recorta lazos de autointersección: cuando una punta/pinza se encoge más
    // de lo que da, el borde recién calculado se cruza a sí mismo. Esto busca
    // cualquier par de aristas NO adyacentes que se crucen y corta el lazo
    // entre ellas, dejando un único vértice nuevo en el punto de cruce -en la
    // práctica, la pinza "se cierra" ahí en vez de darse vuelta-. Si una de
    // las aristas cortadas era una "paralela" (el borde nuevo que la próxima
    // talla necesita encadenar), el recorte pasa esa marca a su reemplazo,
    // para no perder el rastro.
    function removeSelfIntersections(fig, parallelSet) {
        let cut = false;
        let iterations = 0;
        let again = true;
        while (again && iterations < 25) {
            again = false;
            iterations++;
            const n = fig.edges.length;
            for (let i=0; i<n && !again; i++) {
                for (let j=i+2; j<n; j++) {
                    if (i===0 && j===n-1) continue; // adyacentes por el cierre del polígono
                    const e1 = fig.edges[i], e2 = fig.edges[j];
                    if (e1.start===e2.start||e1.start===e2.end||e1.end===e2.start||e1.end===e2.end) continue;
                    const p1=fig.vertices[e1.start], p2=fig.vertices[e1.end];
                    const p3=fig.vertices[e2.start], p4=fig.vertices[e2.end];
                    const inter = segmentIntersect(p1,p2,p3,p4);
                    if (!inter) continue;

                    const newVi = fig.vertices.length;
                    fig.vertices.push({x:inter.x, y:inter.y});
                    const e1new = {start:e1.start, end:newVi, curved:false, cubic:false, controlX:null, controlY:null, control2X:null, control2Y:null};
                    const e2new = {start:newVi, end:e2.end, curved:false, cubic:false, controlX:null, controlY:null, control2X:null, control2Y:null};
                    if (parallelSet) {
                        if (parallelSet.has(e1)) parallelSet.add(e1new);
                        if (parallelSet.has(e2)) parallelSet.add(e2new);
                    }
                    const before = fig.edges.slice(0, i);
                    const after = fig.edges.slice(j+1);
                    fig.edges = before.concat([e1new, e2new], after);
                    cut = true; again = true;
                    break;
                }
            }
        }
        return cut;
    }

    // Una "pasada" de desfase sobre fig, usando la lista de índices de arista
    // dada. Arma un arreglo de vértices/aristas NUEVO recorriendo el original
    // en orden -en vez de insertar+correr índices a mano, que fue la fuente
    // de varios bugs de índices en versiones anteriores-, así que el índice
    // final de cada pieza nueva sale solo de dónde cae al construirla.
    //
    // axisMap (índice de vértice -> 'x'|'y') y distMap (índice de arista ->
    // cm propio o 'avg') viajan de pasada en pasada para que la dirección
    // forzada y las medidas por segmento sigan aplicándose en la talla 2, 3...
    // no solo en la primera.
    // ===== Desfase REAL de curvas (en vez de trasladar puntos de control) =====
    // Modelo de la curva de desfase de una arista: O(t) = P(t) + n(t)*d, con P cúbica (las rectas y
    // cuadráticas se elevan a cúbica). Fuera de [0,1] se extrapola en línea recta por la tangente.
    function makeOffsetModel(edge, a, b, d, cw, tanA, tanB) {
        let c1, c2;
        if (edge.cubic && edge.control2X != null) { c1 = {x:edge.controlX, y:edge.controlY}; c2 = {x:edge.control2X, y:edge.control2Y}; }
        else if (edge.curved && edge.controlX != null) {
            c1 = {x: a.x+(edge.controlX-a.x)*2/3, y: a.y+(edge.controlY-a.y)*2/3};
            c2 = {x: b.x+(edge.controlX-b.x)*2/3, y: b.y+(edge.controlY-b.y)*2/3};
        } else { c1 = {x: a.x+(b.x-a.x)/3, y: a.y+(b.y-a.y)/3}; c2 = {x: a.x+(b.x-a.x)*2/3, y: a.y+(b.y-a.y)*2/3}; }
        const P = t => { const m=1-t; return {x:m*m*m*a.x+3*m*m*t*c1.x+3*m*t*t*c2.x+t*t*t*b.x, y:m*m*m*a.y+3*m*m*t*c1.y+3*m*t*t*c2.y+t*t*t*b.y}; };
        const dP = t => { const m=1-t;
            return {x:3*(m*m*(c1.x-a.x)+2*m*t*(c2.x-c1.x)+t*t*(b.x-c2.x)), y:3*(m*m*(c1.y-a.y)+2*m*t*(c2.y-c1.y)+t*t*(b.y-c2.y))}; };
        const dirAt = (t) => {
            let v = dP(t), l = Math.hypot(v.x, v.y);
            if (l < 1e-9) { v = t < 0.5 ? tanA : tanB; l = Math.hypot(v.x, v.y) || 1; }
            return {x: v.x/l, y: v.y/l};
        };
        const nrm = (t) => { const u = dirAt(t); return cw ? {x: u.y, y: -u.x} : {x: -u.y, y: u.x}; };
        const Oin = (t) => { const p = P(t), n = nrm(t); return {x: p.x+n.x*d, y: p.y+n.y*d}; };
        const O = (t) => {
            if (t >= 0 && t <= 1) return Oin(t);
            const e = t < 0 ? 0 : 1, o = Oin(e), v = dP(e);
            const l = Math.hypot(v.x, v.y);
            const u = l < 1e-9 ? dirAt(e) : {x: v.x/l, y: v.y/l};
            // extrapolación a "velocidad" ~ longitud de la arista, solo para localizar cruces
            const sc = (Math.hypot(b.x-a.x, b.y-a.y) || 1);
            return {x: o.x + u.x*(t-e)*sc, y: o.y + u.y*(t-e)*sc};
        };
        return {P, dP, dirAt, nrm, O, d};
    }

    // Cruce de las curvas de desfase de dos aristas contiguas (i termina, j empieza) cerca de su
    // vértice común. Devuelve {pt, tI, tJ} (tI en [0.3,1.8], tJ en [-0.8,0.7]; fuera de [0,1] = extensión recta), o null.
    // Si hay varios cruces, gana el más cercano al vértice. Esto reemplaza al "miter" de rectas
    // tangentes, que en curvas cerradas (sisa) con medidas distintas a cada lado de la esquina
    // dejaba el punto de unión lejos de la curva real y la torcía.
    function intersectOffsetCurves(mi, mj) {
        const N = 90, A = [], B = [];
        for (let k=0; k<=N; k++) { const t = 0.3 + 1.5*k/N; A.push({t, p: mi.O(t)}); }
        for (let k=0; k<=N; k++) { const t = -0.8 + 1.5*k/N; B.push({t, p: mj.O(t)}); }
        let best = null;
        for (let x=0; x<N; x++) for (let y=0; y<N; y++) {
            const p1=A[x].p, p2=A[x+1].p, p3=B[y].p, p4=B[y+1].p;
            const d1x=p2.x-p1.x, d1y=p2.y-p1.y, d2x=p4.x-p3.x, d2y=p4.y-p3.y;
            const den = d1x*d2y-d1y*d2x;
            if (Math.abs(den) < 1e-12) continue;
            const u = ((p3.x-p1.x)*d2y-(p3.y-p1.y)*d2x)/den;
            const v = ((p3.x-p1.x)*d1y-(p3.y-p1.y)*d1x)/den;
            if (u<0||u>1||v<0||v>1) continue;
            const tI = A[x].t + (A[x+1].t-A[x].t)*u, tJ = B[y].t + (B[y+1].t-B[y].t)*v;
            const score = Math.abs(1-tI) + Math.abs(tJ); // menor = más cerca del vértice común
            if (!best || score < best.score) best = {score, tI, tJ, pt: {x: p1.x+u*d1x, y: p1.y+u*d1y}};
        }
        return best;
    }

    // Cruce de la curva de desfase de una arista con una recta (la arista vecina, recta, que no se
    // graduó). Devuelve {pt, t} con la solución más cercana al extremo (t=1 si atEnd, t=0 si no).
    function intersectOffsetWithLine(model, p3, dir, atEnd) {
        const N = 120, lo = atEnd ? 0.3 : -0.8, hi = atEnd ? 1.8 : 0.7;
        const f = (p) => (p.x-p3.x)*dir.y - (p.y-p3.y)*dir.x;
        let prevT = lo, prevP = model.O(lo), prevF = f(prevP), best = null;
        for (let k=1; k<=N; k++) {
            const t = lo + (hi-lo)*k/N, p = model.O(t), fv = f(p);
            if ((prevF <= 0 && fv >= 0) || (prevF >= 0 && fv <= 0)) {
                const den = prevF - fv, r = Math.abs(den) < 1e-12 ? 0 : prevF/den;
                const tt = prevT + (t-prevT)*r;
                const score = Math.abs(tt - (atEnd ? 1 : 0));
                if (!best || score < best.score) best = {score, t: tt, pt: {x: prevP.x+(p.x-prevP.x)*r, y: prevP.y+(p.y-prevP.y)*r}};
            }
            prevT = t; prevP = p; prevF = fv;
        }
        return best;
    }

    // Ajusta una cúbica a una curva objetivo Tfun(u), u en [ua,ub], con extremos A2/Bp fijos y las
    // direcciones de tangente u0/u1 dadas: busca los largos de manija (alfa, beta) por mínimos
    // cuadrados. Así la curva sigue siendo suave entre puntos blandos y la tangente de la pasada
    // siguiente queda bien definida.
    function fitCubicToCurve(Tfun, ua, ub, A2, Bp, u0, u1, fallback) {
        const span = Math.hypot(Bp.x-A2.x, Bp.y-A2.y) || 1;
        const N = 16, targets = [], ts = [];
        for (let k=1; k<N; k++) { targets.push(Tfun(ua + (ub-ua)*k/N)); ts.push(k/N); }
        let alfa = 0.35*span, beta = 0.35*span, ok = false;
        const bez = (t, al, be) => {
            const m=1-t, w0=m*m*m, w1=3*m*m*t, w2=3*m*t*t, w3=t*t*t;
            return {x: w0*A2.x + w1*(A2.x+al*u0.x) + w2*(Bp.x-be*u1.x) + w3*Bp.x,
                    y: w0*A2.y + w1*(A2.y+al*u0.y) + w2*(Bp.y-be*u1.y) + w3*Bp.y};
        };
        for (let it=0; it<6; it++) {
            let s11=0, s12=0, s22=0, r1=0, r2=0;
            for (let k=0; k<targets.length; k++) {
                const t = ts[k], m = 1-t;
                const w0=m*m*m, w1=3*m*m*t, w2=3*m*t*t, w3=t*t*t;
                const T = targets[k];
                const rx = T.x - (A2.x*(w0+w1) + Bp.x*(w2+w3));
                const ry = T.y - (A2.y*(w0+w1) + Bp.y*(w2+w3));
                const gx = w1*u0.x, gy = w1*u0.y, hx = -w2*u1.x, hy = -w2*u1.y;
                s11 += gx*gx+gy*gy; s12 += gx*hx+gy*hy; s22 += hx*hx+hy*hy;
                r1 += gx*rx+gy*ry;  r2 += hx*rx+hy*ry;
            }
            const det = s11*s22 - s12*s12;
            if (Math.abs(det) < 1e-12) return fallback;
            const na = (r1*s22 - r2*s12)/det, nb = (s11*r2 - s12*r1)/det;
            if (!isFinite(na) || !isFinite(nb)) return fallback;
            alfa = Math.max(0.05*span, Math.min(1.5*span, na));
            beta = Math.max(0.05*span, Math.min(1.5*span, nb));
            ok = true;
            // re-parametrizar: a cada punto objetivo se le asigna el t más cercano de la cúbica actual
            for (let k=0; k<targets.length; k++) {
                const T = targets[k]; let bt = ts[k], bd = Infinity;
                const lo = Math.max(0, ts[k]-0.12), hi = Math.min(1, ts[k]+0.12);
                for (let q=0; q<=24; q++) {
                    const t = lo + (hi-lo)*q/24, p = bez(t, alfa, beta), d = (p.x-T.x)*(p.x-T.x)+(p.y-T.y)*(p.y-T.y);
                    if (d < bd) { bd = d; bt = t; }
                }
                // refinamiento fino alrededor del mejor t (si no, el error tangencial sesga los largos de manija)
                for (let rep=0; rep<3; rep++) {
                    const w = (hi-lo)/24*Math.pow(0.2, rep), l2 = bt-w, h2 = bt+w;
                    for (let q=0; q<=10; q++) {
                        const t = Math.max(0, Math.min(1, l2 + (h2-l2)*q/10)), p = bez(t, alfa, beta), d = (p.x-T.x)*(p.x-T.x)+(p.y-T.y)*(p.y-T.y);
                        if (d < bd) { bd = d; bt = t; }
                    }
                }
                ts[k] = Math.max(0.01, Math.min(0.99, bt));
            }
        }
        if (!ok) return fallback;
        return {
            c1: {x: A2.x + alfa*u0.x, y: A2.y + alfa*u0.y},
            c2: {x: Bp.x - beta*u1.x, y: Bp.y - beta*u1.y}
        };
    }

    // Ajusta una cúbica al tramo [t0,t1] de la curva de desfase real de UNA arista. A2/Bp son los
    // extremos finales (ya empalmados); lo que les falte respecto a O(t0)/O(t1) se reparte como
    // corrección suave a lo largo del tramo.
    function fitOffsetCubic(model, t0, t1, A2, Bp, fallback) {
        const O0 = model.O(t0), O1 = model.O(t1);
        const eA = {x: A2.x-O0.x, y: A2.y-O0.y}, eB = {x: Bp.x-O1.x, y: Bp.y-O1.y};
        // La corrección de los extremos (el punto final no cae justo sobre la curva de desfase, p. ej.
        // por Dirección) se reparte LINEAL a lo largo de la curva y las tangentes finales giran con ella:
        // así la curva se deforma como un todo, sin gancho en la punta ni estirarse según el signo.
        const Tfun = (s) => {
            const p = model.O(t0 + (t1-t0)*s);
            return {x: p.x+(1-s)*eA.x+s*eB.x, y: p.y+(1-s)*eA.y+s*eB.y};
        };
        let L = 0, pv = Tfun(0);
        for (let k=1; k<=24; k++) { const q = Tfun(k/24); L += Math.hypot(q.x-pv.x, q.y-pv.y); pv = q; }
        const rot = (u, dx, dy) => { const vx = u.x + dx/(L||1), vy = u.y + dy/(L||1), l = Math.hypot(vx, vy) || 1; return {x: vx/l, y: vy/l}; };
        const ex = eB.x-eA.x, ey = eB.y-eA.y;
        const u0 = rot(model.dirAt(t0), ex, ey), u1 = rot(model.dirAt(t1), ex, ey);
        return fitCubicToCurve(Tfun, 0, 1, A2, Bp, u0, u1, fallback);
    }

    // Arista vecina CURVA que no se graduó: cruce de la curva de desfase con ELLA (no con su tangente).
    // Si cruza dentro de la curva, se recorta (la curva se acorta, conserva su forma); si no, se
    // devuelve null y se extiende con el tramo recto de siempre. Mismo criterio para talla mayor y menor.
    function curveEdgePts(edge, a, b) {
        const isCub = edge.cubic && edge.control2X != null;
        const c1 = {x: edge.controlX, y: edge.controlY}, c2 = isCub ? {x: edge.control2X, y: edge.control2Y} : null;
        return (s) => {
            const m = 1-s;
            if (isCub) return {x: m*m*m*a.x+3*m*m*s*c1.x+3*m*s*s*c2.x+s*s*s*b.x, y: m*m*m*a.y+3*m*m*s*c1.y+3*m*s*s*c2.y+s*s*s*b.y};
            return {x: m*m*a.x+2*m*s*c1.x+s*s*b.x, y: m*m*a.y+2*m*s*c1.y+s*s*b.y};
        };
    }
    function intersectOffsetWithCurveEdge(model, edge, a, b, atEnd) {
        const N = 160, lo = atEnd ? 0.3 : -0.8, hi = atEnd ? 1.8 : 0.7;
        const Bf = curveEdgePts(edge, a, b);
        const sPivot = atEnd ? 0 : 1; // el pivote es el extremo de la vecina que toca nuestra cadena
        const A = [], C = [];
        for (let k=0; k<=N; k++) { const t = lo+(hi-lo)*k/N; A.push({t, p: model.O(t)}); }
        for (let k=0; k<=N; k++) { const s = k/N; C.push({s, p: Bf(s)}); }
        let best = null;
        for (let x=0; x<N; x++) for (let y=0; y<N; y++) {
            const p1=A[x].p, p2=A[x+1].p, p3=C[y].p, p4=C[y+1].p;
            const d1x=p2.x-p1.x, d1y=p2.y-p1.y, d2x=p4.x-p3.x, d2y=p4.y-p3.y;
            const den = d1x*d2y-d1y*d2x;
            if (Math.abs(den) < 1e-12) continue;
            const u = ((p3.x-p1.x)*d2y-(p3.y-p1.y)*d2x)/den;
            const v = ((p3.x-p1.x)*d1y-(p3.y-p1.y)*d1x)/den;
            if (u<0||u>1||v<0||v>1) continue;
            const sI = C[y].s + (C[y+1].s-C[y].s)*v;
            if (sI < 0.01 || sI > 0.99) continue;
            const tI = A[x].t + (A[x+1].t-A[x].t)*u;
            const score = Math.abs(sI - sPivot) + 0.3*Math.abs(tI - (atEnd ? 1 : 0));
            if (!best || score < best.score) best = {score, t: tI, s: sI, pt: {x: p1.x+u*d1x, y: p1.y+u*d1y}};
        }
        return best;
    }
    // Sub-curva de la arista (de Casteljau): keepStart=true -> tramo [0,s]; false -> tramo [s,1].
    function splitCurveEdge(edge, a, b, s, keepStart) {
        const L = (p,q,k) => ({x: p.x+(q.x-p.x)*k, y: p.y+(q.y-p.y)*k});
        if (edge.cubic && edge.control2X != null) {
            const c1 = {x:edge.controlX,y:edge.controlY}, c2 = {x:edge.control2X,y:edge.control2Y};
            const q0=L(a,c1,s), q1=L(c1,c2,s), q2=L(c2,b,s), r0=L(q0,q1,s), r1=L(q1,q2,s), m=L(r0,r1,s);
            return keepStart ? {c1:q0, c2:r0, end:m} : {c1:r1, c2:q2, start:m};
        }
        const c = {x:edge.controlX,y:edge.controlY}, q0=L(a,c,s), q1=L(c,b,s), m=L(q0,q1,s);
        return keepStart ? {c1:q0, end:m} : {c1:q1, start:m};
    }

    function applyOffsetPass(fig, edgeIdxList, distPxPass, fi, axisMap, distMap, connectorSet) {
        axisMap = axisMap || {};
        distMap = distMap || {};
        connectorSet = connectorSet || new Set();
        const selectedSet = new Set(edgeIdxList);
        const sortedIndices = [...edgeIdxList].sort((a,b)=>a-b);

        const prevOf = {}, nextOf = {};
        sortedIndices.forEach(ei => {
            const e = fig.edges[ei];
            sortedIndices.forEach(ej => {
                if (ei===ej) return;
                const o = fig.edges[ej];
                if (o.end === e.start && prevOf[ei]===undefined) prevOf[ei]=ej;
                if (o.start === e.end && nextOf[ei]===undefined) nextOf[ei]=ej;
            });
        });

        let area=0;
        for(let k=0;k<fig.vertices.length;k++){const v1=fig.vertices[k],v2=fig.vertices[(k+1)%fig.vertices.length];area+=(v1.x*v2.y-v2.x*v1.y);}
        const cw = area > 0;

        function resolveEdgeDist(ei) {
            // El signo de la talla (crecer/achicar) vive en distPxPass. Un valor
            // propio por segmento (offsetEdgeDist) se guarda siempre en positivo
            // -es el cm que el usuario escribió-, así que hay que aplicarle el
            // mismo signo acá; si no, una talla "hacia abajo" con TODOS los
            // segmentos personalizados terminaba idéntica a la de "hacia arriba"
            // (el signo nunca llegaba a pesar en nada).
            const passSign = distPxPass < 0 ? -1 : 1;
            const ov = distMap[ei];
            if (typeof ov === 'number') return ov * passSign;
            if (ov === 'avg') {
                const p = prevOf[ei], nx = nextOf[ei];
                const pv = (p !== undefined && typeof distMap[p] === 'number') ? distMap[p] : null;
                const nv = (nx !== undefined && typeof distMap[nx] === 'number') ? distMap[nx] : null;
                if (pv != null && nv != null) return (pv + nv) / 2 * passSign;
                if (pv != null) return pv * passSign;
                if (nv != null) return nv * passSign;
            }
            return distPxPass;
        }

        function dispForVertex(n, vi, edgeDistPx) {
            const ov = axisMap[vi];
            const axis = (ov && typeof ov === 'object') ? ov.axis : ov;
            if (axis === 'x' || axis === 'y') {
                const a = axis === 'x' ? {x:1,y:0} : {x:0,y:1};
                // Dirección = por dónde se mueve el vértice, pero la MEDIDA (distancia paralela) se
                // respeta: se avanza sobre el eje justo hasta llegar a la paralela de ese lado
                // (antes se movía "medida" en X/Y puro y en lados inclinados la paralela quedaba
                // más cerca o más lejos de lo pedido). Si el lado es casi paralelo al eje no hay
                // intersección estable: se usa el comportamiento anterior.
                if (offsetFitCubic) {
                    const na = n.x*a.x + n.y*a.y;
                    if (Math.abs(na) >= 0.25) return {x: a.x*edgeDistPx/na, y: a.y*edgeDistPx/na};
                }
                if (axis === 'x') return {x:(n.x<0?-1:1)*edgeDistPx, y:0};
                return {x:0, y:(n.y<0?-1:1)*edgeDistPx};
            }
            return {x:n.x*edgeDistPx, y:n.y*edgeDistPx};
        }

        // Ajuste extra de "hacia dónde se inclina" ese vértice: no cambia la
        // distancia de desfase (eso lo sigue resolviendo dispForVertex de
        // arriba), solo agrega un corrimiento adicional en el eje elegido, que
        // termina acortando o alargando los lados que se unen en ese punto.
        function tiltForVertex(vi, u) {
            const ov = axisMap[vi];
            if (ov && typeof ov === 'object' && ov.tiltPx) {
                const passSign = distPxPass < 0 ? -1 : 1;
                const amt = ov.tiltPx*passSign;
                const perp = ov.axis === 'x' ? {x:0,y:1} : {x:1,y:0};
                // "cm lado": desliza el vértice a lo largo de su lado (su paralela) lo necesario
                // para correrse esa cantidad en el eje perpendicular -así alarga/acorta el lado
                // SIN cambiar la distancia entre líneas-. Lado casi perpendicular a ese eje:
                // se corre en el eje puro como antes.
                if (offsetFitCubic && u) {
                    const up = u.x*perp.x + u.y*perp.y;
                    if (Math.abs(up) >= 0.25) return {x: u.x*amt/up, y: u.y*amt/up};
                }
                return {x: perp.x*amt, y: perp.y*amt};
            }
            if (proportionalTilt[vi]) {
                const passSign = distPxPass < 0 ? -1 : 1;
                return {x: proportionalTilt[vi].x*passSign, y: proportionalTilt[vi].y*passSign};
            }
            return {x:0, y:0};
        }
        function hasTilt(vi) {
            const ov = axisMap[vi];
            return !!((ov && typeof ov === 'object' && ov.tiltPx) || proportionalTilt[vi]);
        }

        // A un punto interno de una cadena (entre dos puntos duros) que no tiene
        // su propia inclinación marcada a mano, se le da una fracción de la
        // inclinación del punto duro más cercano, según su posición dentro de la
        // cadena -en vez de dejarlo en cero-, para que el cambio sea progresivo
        // y no un salto brusco justo en el punto duro. Si los DOS extremos de la
        // cadena tienen inclinación (distinta o no), se interpola entre ambas.
        const proportionalTilt = {};
        (function computeChainTilt(){
            // Con la redistribución exacta (offsetFitCubic + proporcional) los puntos internos se
            // reubican solos a la misma proporción de largo sobre la curva real: darles además una
            // fracción de la inclinación por número de punto (en X/Y global) metía la onda en la sisa.
            if (offsetFitCubic && interiorProportionalMode) return;
            const visited = new Set();
            function tiltVecOf(vi){
                const ov = axisMap[vi];
                if (ov && typeof ov === 'object' && ov.tiltPx) {
                    return ov.axis === 'x' ? {x:0, y:ov.tiltPx} : {x:ov.tiltPx, y:0};
                }
                return null;
            }
            sortedIndices.forEach(startEi => {
                if (visited.has(startEi)) return;
                let chain = [startEi];
                visited.add(startEi);
                let cur = startEi;
                while (prevOf[cur] !== undefined && !fig.vertices[fig.edges[cur].start].hardCorner && !visited.has(prevOf[cur])) {
                    cur = prevOf[cur]; chain.unshift(cur); visited.add(cur);
                }
                cur = startEi;
                while (nextOf[cur] !== undefined && !fig.vertices[fig.edges[cur].end].hardCorner && !visited.has(nextOf[cur])) {
                    cur = nextOf[cur]; chain.push(cur); visited.add(cur);
                }
                if (chain.length < 2) return;
                const startVi = fig.edges[chain[0]].start, endVi = fig.edges[chain[chain.length-1]].end;
                const tStart = tiltVecOf(startVi), tEnd = tiltVecOf(endVi);
                if (!tStart && !tEnd) return;
                const a = tStart || {x:0,y:0}, b = tEnd || {x:0,y:0};
                const n = chain.length;
                for (let k=1; k<n; k++) {
                    const vi = fig.edges[chain[k]].start;
                    if (axisMap[vi]) continue; // ya tiene su propia marca manual, no se toca
                    const frac = k/n;
                    proportionalTilt[vi] = { x: a.x + (b.x-a.x)*frac, y: a.y + (b.y-a.y)*frac };
                }
            });
        })();

        const byEdgeIdx = {};
        sortedIndices.forEach((ei,i)=>{ byEdgeIdx[ei]=i; });

        function edgeTangent(edge, a, b, atEnd) {
            if (edge.cubic && edge.control2X != null) {
                const c1 = {x: edge.controlX, y: edge.controlY};
                const c2 = {x: edge.control2X, y: edge.control2Y};
                // Tangente real de la cúbica en cada extremo: 3*(c1-a) al inicio, 3*(b-c2) al final.
                return atEnd ? {x: b.x - c2.x, y: b.y - c2.y} : {x: c1.x - a.x, y: c1.y - a.y};
            }
            if (edge.curved && edge.controlX != null) {
                const c = {x: edge.controlX, y: edge.controlY};
                return atEnd ? {x: b.x - c.x, y: b.y - c.y} : {x: c.x - a.x, y: c.y - a.y};
            }
            return {x: b.x - a.x, y: b.y - a.y};
        }

        const offsets = sortedIndices.map(ei => {
            const edge = fig.edges[ei];
            const a = fig.vertices[edge.start];
            const b = fig.vertices[edge.end];
            const edgeDistPx = resolveEdgeDist(ei);

            const tanA = edgeTangent(edge, a, b, false);
            const tanB = edgeTangent(edge, a, b, true);
            const lenA = Math.hypot(tanA.x, tanA.y) || 1;
            const lenB = Math.hypot(tanB.x, tanB.y) || 1;
            const nA = cw ? {x: tanA.y/lenA, y: -tanA.x/lenA} : {x: -tanA.y/lenA, y: tanA.x/lenA};
            const nB = cw ? {x: tanB.y/lenB, y: -tanB.x/lenB} : {x: -tanB.y/lenB, y: tanB.x/lenB};

            const uA = {x: tanA.x/lenA, y: tanA.y/lenA}, uB = {x: tanB.x/lenB, y: tanB.y/lenB};
            const tiltA = tiltForVertex(edge.start, uA), tiltB = tiltForVertex(edge.end, uB);
            const dispA0 = dispForVertex(nA, edge.start, edgeDistPx);
            const dispB0 = dispForVertex(nB, edge.end, edgeDistPx);
            const dispA = {x: dispA0.x+tiltA.x, y: dispA0.y+tiltA.y};
            const dispB = {x: dispB0.x+tiltB.x, y: dispB0.y+tiltB.y};
            return {
                a2: {x: a.x+dispA.x, y: a.y+dispA.y},
                b2: {x: b.x+dispB.x, y: b.y+dispB.y},
                tanA, tanB, nA, nB, dispA, dispB, edge, d: edgeDistPx,
                model: makeOffsetModel(edge, a, b, edgeDistPx, cw, tanA, tanB), t0: 0, t1: 1
            };
        });

        function lineIntersect(p1,p2,p3,p4){
            const d1x=p2.x-p1.x,d1y=p2.y-p1.y,d2x=p4.x-p3.x,d2y=p4.y-p3.y;
            const denom=d1x*d2y-d1y*d2x;
            if(Math.abs(denom)<1e-10) return null;
            const t=((p3.x-p1.x)*d2y-(p3.y-p1.y)*d2x)/denom;
            return {x:p1.x+t*d1x, y:p1.y+t*d1y};
        }

        // Datos de la arista vecina de cada punta libre (start/end sin pareja
        // seleccionada): predEdge/succEdge es la arista fija (sin seleccionar)
        // o, en una talla siguiente, el conector que dejó la pasada anterior.
        // refVi = SU punto lejano (el que no toca nuestra cadena); pivotVi = el
        // que sí la toca (el "ancla" tradicional).
        const capInfoStart = {}, capInfoEnd = {};
        sortedIndices.forEach(ei => {
            const edge = fig.edges[ei];
            if (prevOf[ei] === undefined) {
                const predEdge = fig.edges.find(e => e.end === edge.start);
                if (predEdge) {
                    const pa = fig.vertices[predEdge.start], pb = fig.vertices[predEdge.end];
                    capInfoStart[ei] = {edgeObj: predEdge, refVi: predEdge.start, pivotVi: predEdge.end,
                        dir: edgeTangent(predEdge, pa, pb, true)};
                }
            }
            if (nextOf[ei] === undefined) {
                const succEdge = fig.edges.find(e => e.start === edge.end);
                if (succEdge) {
                    const sa = fig.vertices[succEdge.start], sb = fig.vertices[succEdge.end];
                    capInfoEnd[ei] = {edgeObj: succEdge, refVi: succEdge.end, pivotVi: succEdge.start,
                        dir: edgeTangent(succEdge, sa, sb, false)};
                }
            }
        });

        const jointExt = {};
        sortedIndices.forEach(ei => {
            const nx = nextOf[ei];
            if (nx===undefined) return;
            const i = byEdgeIdx[ei], j = byEdgeIdx[nx];
            const sharedVi = fig.edges[ei].end;
            const origV = fig.vertices[sharedVi];
            if (axisMap[sharedVi]) {
                const di = Math.hypot(offsets[i].b2.x-origV.x, offsets[i].b2.y-origV.y);
                const dj = Math.hypot(offsets[j].a2.x-origV.x, offsets[j].a2.y-origV.y);
                let winner = dj > di ? offsets[j].a2 : offsets[i].b2;
                if (offsetFitCubic) {
                    // Vértice con Dirección compartido por dos lados: manda el lado más PERPENDICULAR al
                    // eje (el que "crece" de verdad en esa dirección) y su paralela queda exacta; el otro
                    // lado se reajusta a ese punto. (Antes mandaba el que más se desplazaba, que suele ser
                    // el casi paralelo al eje, y deformaba el lado que se quería respetar.)
                    const ov = axisMap[sharedVi], axn = (ov && typeof ov === 'object') ? ov.axis : ov;
                    const ax = axn === 'x' ? {x:1,y:0} : {x:0,y:1};
                    const ni = Math.abs(offsets[i].nB.x*ax.x + offsets[i].nB.y*ax.y);
                    const nj = Math.abs(offsets[j].nA.x*ax.x + offsets[j].nA.y*ax.y);
                    winner = ni >= nj ? offsets[i].b2 : offsets[j].a2;
                }
                const winnerPt = {x: winner.x, y: winner.y};
                const corrB0 = {x: winnerPt.x-offsets[i].b2.x, y: winnerPt.y-offsets[i].b2.y};
                const corrA0 = {x: winnerPt.x-offsets[j].a2.x, y: winnerPt.y-offsets[j].a2.y};
                offsets[i].b2 = winnerPt;
                offsets[j].a2 = winnerPt;
                offsets[i].dispB = {x: offsets[i].dispB.x+corrB0.x, y: offsets[i].dispB.y+corrB0.y};
                offsets[j].dispA = {x: offsets[j].dispA.x+corrA0.x, y: offsets[j].dispA.y+corrA0.y};
                return;
            }
            const distRef = (Math.hypot(offsets[i].dispB.x, offsets[i].dispB.y) +
                             Math.hypot(offsets[j].dispA.x, offsets[j].dispA.y)) / 2 || 1;
            const p1 = offsets[i].b2, p2 = {x: p1.x + offsets[i].tanB.x, y: p1.y + offsets[i].tanB.y};
            const p3 = offsets[j].a2, p4 = {x: p3.x + offsets[j].tanA.x, y: p3.y + offsets[j].tanA.y};
            let joined = null;
            // 1) Empalme por cruce de las CURVAS reales de desfase (esquina dura, o medidas
            // distintas a cada lado). Solo si ninguno de los dos lados es cuadrático ni tiene
            // inclinación marcada en este vértice.
            const tvJ = {x: hasTilt(sharedVi) ? 1 : 0, y: 0};
            const isQuadE = ed => ed.curved && !(ed.cubic && ed.control2X != null) && ed.controlX != null;
            if (offsetFitCubic && !tvJ.x && !tvJ.y &&
                (origV.hardCorner || Math.abs(offsets[i].d-offsets[j].d) > 1e-6)) {
                const cj = intersectOffsetCurves(offsets[i].model, offsets[j].model);
                if (cj) {
                    const ext = cj.tI > 1 || cj.tJ < 0;
                    if (!ext || Math.hypot(cj.pt.x-origV.x, cj.pt.y-origV.y) <= distRef * 4) {
                        joined = cj.pt; offsets[i].t1 = cj.tI; offsets[j].t0 = cj.tJ;
                        // Esquina dura donde la curva de desfase se ALARGA para llegar al cruce: la curva
                        // queda EXACTA (hasta t=1) y la prolongación es un tramo recto aparte (antes iba
                        // metida dentro de la cúbica y estiraba/rigidizaba la curva según qué lados se
                        // seleccionaran).
                        const isCurvy = ed => ed.curved && ed.controlX != null;
                        const eI = origV.hardCorner && cj.tI > 1 + 1e-6 && isCurvy(offsets[i].edge);
                        const eJ = origV.hardCorner && cj.tJ < -1e-6 && isCurvy(offsets[j].edge);
                        if (eI || eJ) {
                            const pI = eI ? offsets[i].model.O(1) : null, pJ = eJ ? offsets[j].model.O(0) : null;
                            if ((!eI || Math.hypot(pI.x-cj.pt.x, pI.y-cj.pt.y) > 0.02*PX_PER_CM) && (!eJ || Math.hypot(pJ.x-cj.pt.x, pJ.y-cj.pt.y) > 0.02*PX_PER_CM)) {
                                jointExt[sharedVi] = {J: {x: cj.pt.x, y: cj.pt.y}, pI, pJ, ei, ej: nx};
                                if (eI) offsets[i].t1 = 1;
                                if (eJ) offsets[j].t0 = 1 - 1; // = 0
                            }
                        }
                    }
                }
            }
            // 2) Si no, el miter de siempre (rectas tangentes) -pero si las tangentes son casi
            // paralelas (unión suave) la intersección es numéricamente inestable y desliza el
            // punto a lo largo de la tangente: ahí se promedia directo.
            if (!joined) {
                const l1 = Math.hypot(offsets[i].tanB.x, offsets[i].tanB.y) || 1, l2 = Math.hypot(offsets[j].tanA.x, offsets[j].tanA.y) || 1;
                const sinAng = Math.abs(offsets[i].tanB.x*offsets[j].tanA.y - offsets[i].tanB.y*offsets[j].tanA.x)/(l1*l2);
                const inter = sinAng < 0.02 ? null : lineIntersect(p1, p2, p3, p4);
                if (inter) {
                    const miterDist = Math.hypot(inter.x - origV.x, inter.y - origV.y);
                    if (miterDist <= distRef * 4) joined = inter;
                }
            }
            if (!joined) {
                joined = { x: (offsets[i].b2.x + offsets[j].a2.x) / 2, y: (offsets[i].b2.y + offsets[j].a2.y) / 2 };
            }
            // Mantener el punto de control "pegado" a su extremo: la corrección que
            // el empalme (miter o promedio) le aplicó al vértice se traslada tal
            // cual al punto de control vecino. Si no se hace esto, el punto de
            // control queda apuntando a la posición vieja sin corregir y la curva
            // forma un pliegue en la unión -invisible en esta misma pasada, pero
            // que corrompe la tangente calculada en la SIGUIENTE pasada, y es lo
            // que produce el salto hacia el lado contrario en tallas encadenadas.
            const jx = jointExt[sharedVi];
            const endPt = (jx && jx.pI) ? jx.pI : joined, startPt = (jx && jx.pJ) ? jx.pJ : joined;
            const corrB = {x: endPt.x-offsets[i].b2.x, y: endPt.y-offsets[i].b2.y};
            const corrA = {x: startPt.x-offsets[j].a2.x, y: startPt.y-offsets[j].a2.y};
            offsets[i].b2 = endPt; offsets[j].a2 = startPt;
            offsets[i].dispB = {x: offsets[i].dispB.x+corrB.x, y: offsets[i].dispB.y+corrB.y};
            offsets[j].dispA = {x: offsets[j].dispA.x+corrA.x, y: offsets[j].dispA.y+corrA.y};
        });

        // Caso especial: si UNA SOLA arista sin seleccionar conecta las dos
        // puntas de la cadena (por ejemplo un cuadrado donde solo dejás un lado
        // afuera), capInfoStart y capInfoEnd de los dos extremos apuntan a esa
        // MISMA arista. Tratarlas por separado -cada una armando su propio
        // conector "completo" desde el otro extremo- hacía que los dos
        // conectores se superpusieran casi enteros entre sí. Se detecta antes
        // y se resuelve aparte, con un solo tramo entre las dos puntas nuevas.
        let sharedPair = null;
        sortedIndices.forEach(ei => {
            if (!capInfoStart[ei]) return;
            sortedIndices.forEach(ej => {
                if (ei===ej || !capInfoEnd[ej]) return;
                if (capInfoEnd[ej].edgeObj === capInfoStart[ei].edgeObj) {
                    sharedPair = {startEi: ei, endEj: ej, edgeObj: capInfoStart[ei].edgeObj};
                }
            });
        });

        const skipEdgeObjs = new Set();
        const capUseTrimStart = {}, capUseTrimEnd = {};
        const capCurveStart = {}, capCurveEnd = {};
        const capSoftPivotStart = {}, capSoftPivotEnd = {};
        sortedIndices.forEach(ei => {
            const i = byEdgeIdx[ei];
            const info = capInfoStart[ei];
            // Si el vértice de esta punta tiene eje forzado (X/Y), su posición
            // ya quedó fija en dispForVertex: no se recorta contra la arista
            // vecina (eso lo desviaba de la dirección elegida). Se conecta
            // igual más abajo, con una línea recta al pivote de esa arista.
            if (info && axisMap[fig.edges[ei].start] === undefined) {
                const pivot = fig.vertices[info.pivotVi], ref = fig.vertices[info.refVi];
                const p1 = offsets[i].a2, p2 = {x: p1.x + offsets[i].tanA.x, y: p1.y + offsets[i].tanA.y};
                const p3 = pivot, p4 = {x: p3.x + info.dir.x, y: p3.y + info.dir.y};
                let inter = lineIntersect(p1, p2, p3, p4);
                // vecina recta: se cruza la CURVA real de desfase con esa recta (no su tangente)
                if (offsetFitCubic && !info.edgeObj.curved && !(info.edgeObj.cubic) && offsets[i].model) {
                    const ci = intersectOffsetWithLine(offsets[i].model, p3, info.dir, false);
                    if (ci) { inter = ci.pt; offsets[i].t0 = ci.t; }
                }
                const nbS = info.edgeObj;
                const trimS = (offsetFitCubic && nbS.curved && nbS.controlX != null && offsets[i].model)
                    ? intersectOffsetWithCurveEdge(offsets[i].model, nbS, fig.vertices[nbS.start], fig.vertices[nbS.end], false) : null;
                if (trimS && Math.hypot(trimS.pt.x-pivot.x, trimS.pt.y-pivot.y) <= (Math.hypot(offsets[i].dispA.x, offsets[i].dispA.y) || 1) * 8) {
                    offsets[i].a2 = trimS.pt; offsets[i].t0 = trimS.t;
                    capCurveStart[ei] = splitCurveEdge(nbS, fig.vertices[nbS.start], fig.vertices[nbS.end], trimS.s, true);
                    capUseTrimStart[ei] = true; skipEdgeObjs.add(nbS);
                } else if (inter) {
                    const distRef = Math.hypot(offsets[i].dispA.x, offsets[i].dispA.y) || 1;
                    if (Math.hypot(inter.x-pivot.x, inter.y-pivot.y) <= distRef * 8) {
                        offsets[i].a2 = inter;
                        const toInter = {x: inter.x-pivot.x, y: inter.y-pivot.y};
                        const toRef = {x: ref.x-pivot.x, y: ref.y-pivot.y};
                        // vecina curva que se prolonga por su tangente: el viejo vértice queda en un empalme suave
                        if (offsetFitCubic && info.edgeObj.curved && toInter.x*toRef.x + toInter.y*toRef.y < 0) capSoftPivotStart[ei] = true;
                        // Si la arista vecina YA es un conector nuestro de una
                        // pasada anterior, siempre se consolida (se reemplaza
                        // entero) sin importar el signo: si no, cada talla
                        // adicional apilaría otro tramito más (el bug de
                        // duplicado que ya se había arreglado antes).
                        if ((connectorSet.has(info.edgeObj) || toInter.x*toRef.x + toInter.y*toRef.y > 0 || (offsetFitCubic && !info.edgeObj.curved && !info.edgeObj.cubic)) && !(offsetFitCubic && info.edgeObj.curved)) {
                            capUseTrimStart[ei] = true;
                            skipEdgeObjs.add(info.edgeObj);
                        }
                    }
                }
            }
            const infoE = capInfoEnd[ei];
            if (infoE && axisMap[fig.edges[ei].end] === undefined) {
                const pivot = fig.vertices[infoE.pivotVi], ref = fig.vertices[infoE.refVi];
                const p1 = offsets[i].b2, p2 = {x: p1.x + offsets[i].tanB.x, y: p1.y + offsets[i].tanB.y};
                const p3 = pivot, p4 = {x: p3.x + infoE.dir.x, y: p3.y + infoE.dir.y};
                let inter = lineIntersect(p1, p2, p3, p4);
                if (offsetFitCubic && !infoE.edgeObj.curved && !(infoE.edgeObj.cubic) && offsets[i].model) {
                    const ci = intersectOffsetWithLine(offsets[i].model, p3, infoE.dir, true);
                    if (ci) { inter = ci.pt; offsets[i].t1 = ci.t; }
                }
                const nbE = infoE.edgeObj;
                const trimE = (offsetFitCubic && nbE.curved && nbE.controlX != null && offsets[i].model)
                    ? intersectOffsetWithCurveEdge(offsets[i].model, nbE, fig.vertices[nbE.start], fig.vertices[nbE.end], true) : null;
                if (trimE && Math.hypot(trimE.pt.x-pivot.x, trimE.pt.y-pivot.y) <= (Math.hypot(offsets[i].dispB.x, offsets[i].dispB.y) || 1) * 8) {
                    offsets[i].b2 = trimE.pt; offsets[i].t1 = trimE.t;
                    capCurveEnd[ei] = splitCurveEdge(nbE, fig.vertices[nbE.start], fig.vertices[nbE.end], trimE.s, false);
                    capUseTrimEnd[ei] = true; skipEdgeObjs.add(nbE);
                } else if (inter) {
                    const distRef = Math.hypot(offsets[i].dispB.x, offsets[i].dispB.y) || 1;
                    if (Math.hypot(inter.x-pivot.x, inter.y-pivot.y) <= distRef * 8) {
                        offsets[i].b2 = inter;
                        const toInter = {x: inter.x-pivot.x, y: inter.y-pivot.y};
                        const toRef = {x: ref.x-pivot.x, y: ref.y-pivot.y};
                        if (offsetFitCubic && infoE.edgeObj.curved && toInter.x*toRef.x + toInter.y*toRef.y < 0) capSoftPivotEnd[ei] = true;
                        if ((connectorSet.has(infoE.edgeObj) || toInter.x*toRef.x + toInter.y*toRef.y > 0 || (offsetFitCubic && !infoE.edgeObj.curved && !infoE.edgeObj.cubic)) && !(offsetFitCubic && infoE.edgeObj.curved)) {
                            capUseTrimEnd[ei] = true;
                            skipEdgeObjs.add(infoE.edgeObj);
                        }
                    }
                }
            }
        });

        if (sharedPair) {
            // Las dos puntas simplemente se desplazan en la normal de SU propia
            // arista seleccionada (offsets[i].a2/b2 ya calculados antes de este
            // bloque) -no hay arista fija de la cual "deslizarse", porque la
            // única arista fija es justo la que están por reemplazar entre las
            // dos-. Se arma un solo tramo nuevo entre ambas puntas más abajo,
            // después de construir la figura, cuando ya se conocen sus índices
            // finales.
            skipEdgeObjs.add(sharedPair.edgeObj);
        }

        // A partir de acá se construye la figura NUEVA desde cero, recorriendo
        // fig.edges en su orden original. jointNewVi resuelve los vértices
        // compartidos entre dos aristas seleccionadas consecutivas (se crean
        // una sola vez, la primera arista que los toca).
        const jointNewVi = {};
        const jointStartNv = {};
        const newVertices = [];
        const newEdges = [];
        const vertexRemap = {};
        function remapOldVertex(oldVi) {
            if (vertexRemap[oldVi] !== undefined) return vertexRemap[oldVi];
            const nv = newVertices.length;
            newVertices.push({x: fig.vertices[oldVi].x, y: fig.vertices[oldVi].y, hardCorner: fig.vertices[oldVi].hardCorner});
            vertexRemap[oldVi] = nv;
            return nv;
        }

        const outNewEdgeIdxs = [];
        const outNewAxisMap = {};
        const outNewDistMap = {};
        const parallelObjs = new Set();
        const newConnectorObjs = new Set();
        const oldEiToNewEdge = {};
        const sharedCapNv = {}; // guarda el vertice nuevo de cada punta del par compartido

        fig.edges.forEach((edge, ei) => {
            if (!selectedSet.has(ei)) {
                if (skipEdgeObjs.has(edge)) return; // se reemplaza por el conector nuevo, no se copia
                const ns = remapOldVertex(edge.start);
                const ne = remapOldVertex(edge.end);
                newEdges.push(Object.assign({}, edge, {start:ns, end:ne}));
                return;
            }

            const i = byEdgeIdx[ei];
            const dispA = offsets[i].dispA, dispB = offsets[i].dispB;

            // Esquina con prolongación recta (jointExt): vértices propios para el fin de la curva (V_i),
            // el cruce (J) y el inicio de la siguiente (V_j); la prolongación se agrega como aristas rectas.
            const ensureExtJoint = (vi, jx) => {
                if (jointNewVi[vi] !== undefined) return;
                const o1 = offsets[byEdgeIdx[jx.ei]], o2 = offsets[byEdgeIdx[jx.ej]];
                const mk = (p, hard) => { newVertices.push({x: p.x, y: p.y, hardCorner: hard}); return newVertices.length-1; };
                const J = mk(jx.J, true);
                jx.Jnv = J;
                // el fin de la curva y el inicio de la siguiente empalman con la prolongación en forma suave
                // (misma tangente): son puntos blandos, el único punto duro es la esquina J
                jointNewVi[vi] = jx.pI ? mk(o1.b2, false) : J;
                jointStartNv[vi] = jx.pJ ? mk(o2.a2, false) : J;
            };
            let startNv;
            if (prevOf[ei] !== undefined) {
                if (jointExt[edge.start]) {
                    ensureExtJoint(edge.start, jointExt[edge.start]);
                    startNv = jointStartNv[edge.start];
                } else {
                if (jointNewVi[edge.start] === undefined) {
                    jointNewVi[edge.start] = newVertices.length;
                    newVertices.push({x: offsets[i].a2.x, y: offsets[i].a2.y, hardCorner: fig.vertices[edge.start].hardCorner});
                }
                startNv = jointNewVi[edge.start];
                }
            } else {
                startNv = newVertices.length;
                newVertices.push({x: offsets[i].a2.x, y: offsets[i].a2.y, hardCorner: fig.vertices[edge.start].hardCorner});
            }

            let endNv;
            if (nextOf[ei] !== undefined && jointExt[edge.end]) {
                ensureExtJoint(edge.end, jointExt[edge.end]);
                endNv = jointNewVi[edge.end];
            } else if (nextOf[ei] !== undefined) {
                if (jointNewVi[edge.end] === undefined) {
                    jointNewVi[edge.end] = newVertices.length;
                    newVertices.push({x: offsets[i].b2.x, y: offsets[i].b2.y, hardCorner: fig.vertices[edge.end].hardCorner});
                }
                endNv = jointNewVi[edge.end];
            } else {
                endNv = newVertices.length;
                newVertices.push({x: offsets[i].b2.x, y: offsets[i].b2.y, hardCorner: fig.vertices[edge.end].hardCorner});
            }

            if (prevOf[ei] === undefined) {
                if (sharedPair && sharedPair.startEi === ei) {
                    sharedCapNv.start = startNv;
                } else {
                    const info = capInfoStart[ei];
                    const fromVi = (info && capUseTrimStart[ei]) ? info.refVi : (info ? info.pivotVi : edge.start);
                    let connObj = {start: remapOldVertex(fromVi), end: startNv, curved:false, cubic:false, controlX:null, controlY:null, control2X:null, control2Y:null};
                    const cc = capCurveStart[ei];
                    if (cc) {
                        connObj = {start: connObj.start, end: startNv, curved:true, cubic: !!cc.c2, controlX: cc.c1.x, controlY: cc.c1.y,
                            control2X: cc.c2 ? cc.c2.x : null, control2Y: cc.c2 ? cc.c2.y : null};
                        newEdges.push(connObj);
                    } else { newEdges.push(connObj); newConnectorObjs.add(connObj); if (capSoftPivotStart[ei] && !capUseTrimStart[ei]) newVertices[connObj.start].hardCorner = false; }
                }
            }

            const parIdx = newEdges.length;
            const newParallel = {
                start: startNv, end: endNv,
                curved: edge.curved, cubic: edge.cubic,
                controlX: edge.curved&&edge.controlX!=null ? edge.controlX + (edge.cubic?dispA.x:(dispA.x+dispB.x)/2) : null,
                controlY: edge.curved&&edge.controlY!=null ? edge.controlY + (edge.cubic?dispA.y:(dispA.y+dispB.y)/2) : null,
                control2X: edge.cubic&&edge.control2X!=null ? edge.control2X+dispB.x : null,
                control2Y: edge.cubic&&edge.control2Y!=null ? edge.control2Y+dispB.y : null
            };
            if (edge.cubic && edge.control2X != null && offsetFitCubic) {
                // desfase real de la cúbica (ver fitOffsetCubic), no solo trasladar los controles
                const fv = fitOffsetCubic(offsets[i].model, offsets[i].t0, offsets[i].t1,
                    newVertices[startNv], newVertices[endNv],
                    {c1: {x:newParallel.controlX, y:newParallel.controlY}, c2: {x:newParallel.control2X, y:newParallel.control2Y}});
                newParallel.controlX = fv.c1.x; newParallel.controlY = fv.c1.y;
                newParallel.control2X = fv.c2.x; newParallel.control2Y = fv.c2.y;
            }
            if (edge.curved && !edge.cubic && edge.controlX != null && offsetFitCubic && offsets[i].model) {
                // cuadrática ("curva vieja"): el punto de control se calcula para que la curva pase por
                // el punto medio REAL del desfase (antes se trasladaba con el promedio de los extremos y
                // la forma se perdía, sobre todo con distancias grandes).
                const o = offsets[i], A2 = newVertices[startNv], Bp = newVertices[endNv];
                const O0 = o.model.O(o.t0), O1 = o.model.O(o.t1), Om = o.model.O((o.t0+o.t1)/2);
                const Mx = Om.x + 0.5*(A2.x-O0.x) + 0.5*(Bp.x-O1.x), My = Om.y + 0.5*(A2.y-O0.y) + 0.5*(Bp.y-O1.y);
                newParallel.controlX = 2*Mx - 0.5*(A2.x+Bp.x);
                newParallel.controlY = 2*My - 0.5*(A2.y+Bp.y);
            }
            newEdges.push(newParallel);
            parallelObjs.add(newParallel);
            oldEiToNewEdge[ei] = newParallel;
            outNewEdgeIdxs.push(parIdx);
            if (distMap[ei] != null) outNewDistMap[parIdx] = distMap[ei];
            {
                const jx = (nextOf[ei] !== undefined) ? jointExt[edge.end] : null;
                if (jx && jx.ei === ei) {
                    const mkLine = (a, b) => ({start: a, end: b, curved:false, cubic:false, controlX:null, controlY:null, control2X:null, control2Y:null});
                    const addExt = (a, b, dm) => {
                        const eo = mkLine(a, b); const idx = newEdges.length;
                        newEdges.push(eo); parallelObjs.add(eo); outNewEdgeIdxs.push(idx);
                        if (dm != null) outNewDistMap[idx] = dm;
                    };
                    if (jx.pI) addExt(jointNewVi[edge.end], jx.Jnv, distMap[ei]);
                    if (jx.pJ) addExt(jx.Jnv, jointStartNv[edge.end], distMap[jx.ej]);
                }
            }
            if (axisMap[edge.start] !== undefined) outNewAxisMap[startNv] = axisMap[edge.start];
            if (axisMap[edge.end] !== undefined) outNewAxisMap[endNv] = axisMap[edge.end];

            if (nextOf[ei] === undefined) {
                if (sharedPair && sharedPair.endEj === ei) {
                    sharedCapNv.end = endNv;
                } else {
                    const infoE = capInfoEnd[ei];
                    const toVi = (infoE && capUseTrimEnd[ei]) ? infoE.refVi : (infoE ? infoE.pivotVi : edge.end);
                    let connObj2 = {start: endNv, end: remapOldVertex(toVi), curved:false, cubic:false, controlX:null, controlY:null, control2X:null, control2Y:null};
                    const cc2 = capCurveEnd[ei];
                    if (cc2) {
                        connObj2 = {start: endNv, end: connObj2.end, curved:true, cubic: !!cc2.c2, controlX: cc2.c1.x, controlY: cc2.c1.y,
                            control2X: cc2.c2 ? cc2.c2.x : null, control2Y: cc2.c2 ? cc2.c2.y : null};
                        newEdges.push(connObj2);
                    } else { newEdges.push(connObj2); newConnectorObjs.add(connObj2); if (capSoftPivotEnd[ei] && !capUseTrimEnd[ei]) newVertices[connObj2.end].hardCorner = false; }
                }
            }
        });

        if (sharedPair && sharedCapNv.start !== undefined && sharedCapNv.end !== undefined) {
            // Un solo tramo entre las dos puntas, en vez de dos conectores que
            // se superpondrían casi enteros entre sí.
            const so = sharedPair.edgeObj;
            let connObj = {start: sharedCapNv.end, end: sharedCapNv.start, curved:false, cubic:false, controlX:null, controlY:null, control2X:null, control2Y:null};
            let morphed = false;
            if (offsetFitCubic && so.curved && so.controlX != null) {
                // El lado que no se seleccionó es curvo: se conserva su forma moviéndolo entre los dos
                // extremos nuevos con una transformación de semejanza (giro + escala + traslado). Antes se
                // reemplazaba por una recta y la curva se perdía.
                const P0 = fig.vertices[so.start], P1 = fig.vertices[so.end];
                const N0 = newVertices[sharedCapNv.end], N1 = newVertices[sharedCapNv.start];
                const dx = P1.x-P0.x, dy = P1.y-P0.y, den = dx*dx+dy*dy;
                if (den > 1e-9) {
                    const ex = N1.x-N0.x, ey = N1.y-N0.y;
                    const kr = (ex*dx+ey*dy)/den, ki = (ey*dx-ex*dy)/den;
                    const map = (x,y) => { const rx = x-P0.x, ry = y-P0.y; return {x: N0.x+rx*kr-ry*ki, y: N0.y+rx*ki+ry*kr}; };
                    const c1 = map(so.controlX, so.controlY);
                    connObj = {start: sharedCapNv.end, end: sharedCapNv.start, curved:true, cubic: !!so.cubic,
                        controlX: c1.x, controlY: c1.y, control2X: null, control2Y: null};
                    if (so.cubic && so.control2X != null) { const c2 = map(so.control2X, so.control2Y); connObj.control2X = c2.x; connObj.control2Y = c2.y; }
                    morphed = true;
                }
            }
            newEdges.push(connObj);
            if (!morphed) newConnectorObjs.add(connObj);
        }

        // Modo opcional: los puntos internos de cada cadena (entre dos puntos
        // duros) conservan su offset normal para la FORMA (eso ya funciona
        // bien), pero además se redistribuyen SOBRE esa misma curva ya
        // graduada -no en línea recta- a la misma fracción de longitud de
        // arco que ocupaban en la talla original. Así ningún segmento interno
        // crece o se achica desproporcionadamente respecto a los demás.
        function redistributeChainExact(chain, newEdgeObjs, fracs) {
            const n = chain.length;
            for (const ei of chain) { const e = fig.edges[ei]; if (!(e.cubic && e.control2X != null)) return false; }
            const ms = chain.map(ei => offsets[byEdgeIdx[ei]]);
            if (ms.some(o => !o || !o.model)) return false;
            const Apos = newEdgeObjs.map(e => ({x: newVertices[e.start].x, y: newVertices[e.start].y}));
            const Bpos = newEdgeObjs.map(e => ({x: newVertices[e.end].x,   y: newVertices[e.end].y}));
            // Curva ideal de toda la cadena como polilínea densa con longitud de arco: el desfase
            // real de cada arista (recortado donde la esquina lo recorta) pasando por los vértices
            // finales de empalme; si la esquina se extiende, el tramo recto de la extensión queda
            // dentro de la curva (tangente continua), y los puntos internos se reparten sobre el
            // total -así la longitud se escala proporcional en toda la cadena, sin ondas-.
            const poly = [];
            const push = (p) => {
                if (poly.length) { const q = poly[poly.length-1], d = Math.hypot(p.x-q.x, p.y-q.y); if (d < 1e-9) return; poly.push({x:p.x, y:p.y, s:q.s+d}); }
                else poly.push({x:p.x, y:p.y, s:0});
            };
            const M = 48;
            // 1) curva de desfase pura de toda la cadena (sin corrección) y su longitud
            const raw = [];
            for (let k=0; k<n; k++) {
                const o = ms[k];
                const t0c = Math.max(0, Math.min(1, o.t0)), t1c = Math.max(0, Math.min(1, o.t1));
                for (let q=(k===0?0:1); q<=M; q++) raw.push(o.model.O(t0c + (t1c-t0c)*q/M));
            }
            const rawS = [0];
            for (let i=1; i<raw.length; i++) rawS.push(rawS[i-1] + Math.hypot(raw[i].x-raw[i-1].x, raw[i].y-raw[i-1].y));
            const rawL = rawS[rawS.length-1] || 1;
            // 2) los extremos de la cadena no siempre caen sobre esa curva (empalme, Dirección): el error se
            // reparte LINEAL por longitud sobre toda la cadena y las tangentes finales giran con él.
            const eS = {x: Apos[0].x-raw[0].x, y: Apos[0].y-raw[0].y};
            const eE = {x: Bpos[n-1].x-raw[raw.length-1].x, y: Bpos[n-1].y-raw[raw.length-1].y};
            for (let i=0; i<raw.length; i++) {
                const q = rawS[i]/rawL;
                push({x: raw[i].x + (1-q)*eS.x + q*eE.x, y: raw[i].y + (1-q)*eS.y + q*eE.y});
            }
            const total = poly[poly.length-1].s;
            if (!(total > 1e-6)) return false;
            const at = (sv) => {
                sv = Math.max(0, Math.min(total, sv));
                let lo = 0, hi = poly.length-1;
                while (hi-lo > 1) { const mid = (lo+hi)>>1; if (poly[mid].s <= sv) lo = mid; else hi = mid; }
                const p0 = poly[lo], p1 = poly[hi], sp = p1.s-p0.s, r = sp > 1e-12 ? (sv-p0.s)/sp : 0;
                return {x: p0.x+(p1.x-p0.x)*r, y: p0.y+(p1.y-p0.y)*r};
            };
            const dirAt = (sv) => {
                const h = Math.max(total*0.004, 1e-3), a = at(sv-h), b = at(sv+h);
                const l = Math.hypot(b.x-a.x, b.y-a.y);
                return l < 1e-12 ? null : {x:(b.x-a.x)/l, y:(b.y-a.y)/l};
            };
            const nearestS = (p) => {
                let bs = 0, bd = Infinity;
                for (const r of poly) { const dd = Math.hypot(r.x-p.x, r.y-p.y); if (dd < bd) { bd = dd; bs = r.s; } }
                return bs;
            };
            const ss = [0], pos = [Apos[0]];
            for (let k=1; k<n; k++) {
                const oldVi = fig.edges[chain[k]].start, newVi = jointNewVi[oldVi];
                if (newVi === undefined) return false;
                if (axisMap[oldVi]) {
                    // punto marcado a mano (Dir…): conserva su posición
                    const cur = newVertices[newVi];
                    ss.push(nearestS(cur)); pos.push({x: cur.x, y: cur.y});
                } else {
                    const sv = fracs[k-1]*total;
                    ss.push(sv); pos.push(at(sv));
                }
            }
            ss.push(total); pos.push(Bpos[n-1]);
            for (let k=1; k<ss.length; k++) if (!(ss[k] > ss[k-1] + 1e-6)) return false;
            for (let k=1; k<n; k++) {
                const newVi = jointNewVi[fig.edges[chain[k]].start];
                newVertices[newVi].x = pos[k].x; newVertices[newVi].y = pos[k].y;
            }
            for (let k=0; k<n; k++) {
                const e = newEdgeObjs[k];
                // tangentes exactas en las puntas de la cadena (las del modelo); en el medio, diferencia central
                const rotU = (u) => { const vx = u.x + (eE.x-eS.x)/rawL, vy = u.y + (eE.y-eS.y)/rawL, l = Math.hypot(vx, vy) || 1; return {x: vx/l, y: vy/l}; };
                const u0 = k === 0 ? rotU(ms[0].model.dirAt(Math.max(0, Math.min(1, ms[0].t0)))) : dirAt(ss[k]);
                const u1 = k === n-1 ? rotU(ms[n-1].model.dirAt(Math.max(0, Math.min(1, ms[n-1].t1)))) : dirAt(ss[k+1]);
                if (!u0 || !u1) return false;
                const fb = {c1:{x:e.controlX,y:e.controlY}, c2:{x:e.control2X,y:e.control2Y}};
                const fv = fitCubicToCurve(at, ss[k], ss[k+1], pos[k], pos[k+1], u0, u1, fb);
                e.controlX = fv.c1.x; e.controlY = fv.c1.y; e.control2X = fv.c2.x; e.control2Y = fv.c2.y;
            }
            return true;
        }

        if (interiorProportionalMode) {
            function bezierPtAt(vertsArr, edge, t) {
                const a = vertsArr[edge.start], b = vertsArr[edge.end];
                if (edge.cubic && edge.control2X != null) {
                    const mt=1-t;
                    return {
                        x: mt*mt*mt*a.x + 3*mt*mt*t*edge.controlX + 3*mt*t*t*edge.control2X + t*t*t*b.x,
                        y: mt*mt*mt*a.y + 3*mt*mt*t*edge.controlY + 3*mt*t*t*edge.control2Y + t*t*t*b.y
                    };
                } else if (edge.curved && edge.controlX != null) {
                    const mt=1-t;
                    return { x: mt*mt*a.x + 2*mt*t*edge.controlX + t*t*b.x, y: mt*mt*a.y + 2*mt*t*edge.controlY + t*t*b.y };
                }
                return { x: a.x+(b.x-a.x)*t, y: a.y+(b.y-a.y)*t };
            }
            function buildArcTable(vertsArr, edgeObjs, steps) {
                const table = [{s:0, pt:{x:vertsArr[edgeObjs[0].start].x, y:vertsArr[edgeObjs[0].start].y}}];
                let s = 0;
                edgeObjs.forEach(edge => {
                    let prev = vertsArr[edge.start];
                    for (let i=1;i<=steps;i++){
                        const pt = bezierPtAt(vertsArr, edge, i/steps);
                        s += Math.hypot(pt.x-prev.x, pt.y-prev.y);
                        table.push({s, pt});
                        prev = pt;
                    }
                });
                return table;
            }
            function pointAtArcLen(table, targetS) {
                for (let i=1;i<table.length;i++){
                    if (table[i].s >= targetS) {
                        const prev=table[i-1], cur=table[i], span=cur.s-prev.s;
                        const frac = span>1e-9 ? (targetS-prev.s)/span : 0;
                        return {x: prev.pt.x+(cur.pt.x-prev.pt.x)*frac, y: prev.pt.y+(cur.pt.y-prev.pt.y)*frac};
                    }
                }
                return table[table.length-1].pt;
            }

            const visitedChain = new Set();
            sortedIndices.forEach(startEi => {
                if (visitedChain.has(startEi)) return;
                let chain = [startEi];
                visitedChain.add(startEi);
                let cur = startEi;
                const isCubE = ed => !!(ed.cubic && ed.control2X != null);
                while (prevOf[cur] !== undefined && !fig.vertices[fig.edges[cur].start].hardCorner && !visitedChain.has(prevOf[cur]) && isCubE(fig.edges[prevOf[cur]]) === isCubE(fig.edges[cur])) {
                    cur = prevOf[cur]; chain.unshift(cur); visitedChain.add(cur);
                }
                cur = startEi;
                while (nextOf[cur] !== undefined && !fig.vertices[fig.edges[cur].end].hardCorner && !visitedChain.has(nextOf[cur]) && isCubE(fig.edges[nextOf[cur]]) === isCubE(fig.edges[cur])) {
                    cur = nextOf[cur]; chain.push(cur); visitedChain.add(cur);
                }
                if (chain.length < 2) return;
                const newEdgeObjs = chain.map(ei => oldEiToNewEdge[ei]);
                if (newEdgeObjs.some(e => !e)) return; // alguna arista de la cadena no se graduó (no debería pasar)

                // 1) fracción de longitud de arco ORIGINAL de cada punto interno
                const origEdgeObjs = chain.map(ei => fig.edges[ei]);
                let acc = 0;
                const origLens = origEdgeObjs.map(e => edgeLength(fig, e));
                const origTotal = origLens.reduce((a,b)=>a+b, 0) || 1;
                const fracs = [];
                for (let k=0;k<chain.length-1;k++){ acc += origLens[k]; fracs.push(acc/origTotal); }

                // Camino exacto (cadena toda cúbica): los puntos internos se reubican SOBRE la curva
                // de desfase real a la misma fracción de longitud de arco, y cada tramo se REAJUSTA a
                // esa misma curva. (Antes solo se movían los puntos y se arrastraban las manijas por
                // el mismo delta: eso torcía la forma -sisa, cuello-, sobre todo con distancias grandes.)
                if (offsetFitCubic && redistributeChainExact(chain, newEdgeObjs, fracs)) return;

                // 2) longitud de arco de la cadena YA graduada (forma correcta)
                const newTable = buildArcTable(newVertices, newEdgeObjs, 24);
                const newTotal = newTable[newTable.length-1].s;

                // 3) reubicar cada punto interno SOBRE esa curva, a la misma
                // fracción, arrastrando los puntos de control vecinos por el
                // mismo delta (igual criterio que en el empalme de esquinas).
                for (let k=1; k<chain.length; k++) {
                    const oldVi = fig.edges[chain[k]].start;
                    const newVi = jointNewVi[oldVi];
                    if (newVi === undefined) continue;
                    // un punto con dirección/inclinación marcada a mano (Dir…) conserva su posición:
                    // si no, esta redistribución proporcional la deshacía
                    if (axisMap[oldVi]) continue;
                    const target = pointAtArcLen(newTable, fracs[k-1]*newTotal);
                    const curPos = newVertices[newVi];
                    const dx = target.x-curPos.x, dy = target.y-curPos.y;
                    curPos.x = target.x; curPos.y = target.y;
                    const prevEdgeObj = oldEiToNewEdge[chain[k-1]], nextEdgeObj = oldEiToNewEdge[chain[k]];
                    if (prevEdgeObj) {
                        if (prevEdgeObj.cubic && prevEdgeObj.control2X!=null) { prevEdgeObj.control2X+=dx; prevEdgeObj.control2Y+=dy; }
                        else if (prevEdgeObj.curved && prevEdgeObj.controlX!=null) { prevEdgeObj.controlX+=dx*0.5; prevEdgeObj.controlY+=dy*0.5; }
                    }
                    if (nextEdgeObj && nextEdgeObj.curved && nextEdgeObj.controlX!=null) {
                        if (nextEdgeObj.cubic) { nextEdgeObj.controlX+=dx; nextEdgeObj.controlY+=dy; }
                        else { nextEdgeObj.controlX+=dx*0.5; nextEdgeObj.controlY+=dy*0.5; }
                    }
                }
            });
        }

        fig.vertices = newVertices;
        fig.edges = newEdges;

        const selfCut = removeSelfIntersections(fig, parallelObjs);

        // Si se tuvo que recortar algo, los índices de las paralelas pueden
        // haber cambiado (o alguna pudo desaparecer si quedó dentro del lazo
        // recortado): se recalculan por identidad de objeto, no por posición.
        let finalEdgeIdxs = outNewEdgeIdxs;
        if (selfCut) {
            finalEdgeIdxs = [];
            fig.edges.forEach((e, idx) => { if (parallelObjs.has(e)) finalEdgeIdxs.push(idx); });
        }

        return {edgeIdxs: finalEdgeIdxs, axisMap: outNewAxisMap, distMap: outNewDistMap, selfCut, connectorSet: newConnectorObjs};
    }

    function polygonSignedArea(f) {
        let a=0;
        for(let k=0;k<f.vertices.length;k++){
            const v1=f.vertices[k], v2=f.vertices[(k+1)%f.vertices.length];
            a += v1.x*v2.y - v2.x*v1.y;
        }
        return a/2;
    }

    // Agrupa índices de arista seleccionados que están conectados entre sí (comparten
    // vértice) en cadenas ordenadas start->end. Cada cadena se crea como UNA sola guía,
    // para que dos lados contiguos seleccionados juntos no se separen en direcciones
    // distintas.
    function buildEdgeChains(fig, edgeIdxs) {
        const remaining = new Set(edgeIdxs);
        const chains = [];
        while (remaining.size) {
            const startEi = remaining.values().next().value;
            remaining.delete(startEi);
            let chain = [startEi];
            let changed = true;
            while (changed) {
                changed = false;
                const first = fig.edges[chain[0]];
                for (const ei of remaining) {
                    if (fig.edges[ei].end === first.start) { chain.unshift(ei); remaining.delete(ei); changed = true; break; }
                }
            }
            changed = true;
            while (changed) {
                changed = false;
                const last = fig.edges[chain[chain.length-1]];
                for (const ei of remaining) {
                    if (fig.edges[ei].start === last.end) { chain.push(ei); remaining.delete(ei); changed = true; break; }
                }
            }
            chains.push(chain);
        }
        return chains;
    }

    // Copia EXACTA de una cadena de uno o varios lados contiguos: un solo vector de
    // desplazamiento (normal a la cuerda que va del primer al último vértice de la
    // cadena), trasladando por igual todos los vértices y puntos de control. Así se
    // conserva siempre la forma y longitud exactas, y los lados seleccionados juntos
    // se crean juntos (no cada uno hacia su propio lado).
    function computeParallelChain(fig, chainEdgeIdxs, distPx) {
        const firstEdge = fig.edges[chainEdgeIdxs[0]], lastEdge = fig.edges[chainEdgeIdxs[chainEdgeIdxs.length-1]];
        const a = fig.vertices[firstEdge.start], b = fig.vertices[lastEdge.end];
        const chord = {x: b.x-a.x, y: b.y-a.y};
        const len = Math.hypot(chord.x, chord.y) || 1;
        const cw = fig.closed ? (polygonSignedArea(fig) > 0) : true;
        const n = cw ? {x: chord.y/len, y: -chord.x/len} : {x: -chord.y/len, y: chord.x/len};
        const disp = {x: n.x*distPx, y: n.y*distPx};
        const vertMap = {}, newVertices = [], newEdges = [];
        chainEdgeIdxs.forEach(ei => {
            const e = fig.edges[ei];
            [e.start, e.end].forEach(vi => {
                if (vertMap[vi] === undefined) {
                    const v = fig.vertices[vi];
                    vertMap[vi] = newVertices.length;
                    newVertices.push({x: v.x+disp.x, y: v.y+disp.y, hardCorner: v.hardCorner});
                }
            });
            newEdges.push({
                start: vertMap[e.start], end: vertMap[e.end], curved: e.curved, cubic: e.cubic,
                controlX: e.curved && e.controlX!=null ? e.controlX + disp.x : null,
                controlY: e.curved && e.controlY!=null ? e.controlY + disp.y : null,
                control2X: e.cubic && e.control2X!=null ? e.control2X + disp.x : null,
                control2Y: e.cubic && e.control2Y!=null ? e.control2Y + disp.y : null
            });
        });
        return { vertices: newVertices, edges: newEdges, closed: false, grain: null };
    }

    function toggleLineGuideFlip() {
        lineGuideFlip = !lineGuideFlip;
        document.getElementById('lineGuideFlipBtn').classList.toggle('on', lineGuideFlip);
        redrawAll();
    }

    function applyLineGuide() {
        if (lineGuideEdges.length === 0) { showModal({title:'Error', body:'Selecciona al menos un lado.', buttons:[{label:'OK'}]}); return; }
        const distCm = parseFloat(String(document.getElementById('lineGuideValue').value).replace(',','.'));
        if (isNaN(distCm) || distCm === 0) { showModal({title:'Valor inválido', body:'Introduce una distancia en cm distinta de 0.', buttons:[{label:'OK'}]}); return; }
        const distPx = distCm * PX_PER_CM * (lineGuideFlip ? -1 : 1);
        saveState();
        const byFig = {};
        lineGuideEdges.forEach(re => { (byFig[re.figureIndex] = byFig[re.figureIndex] || []).push(re.edgeIndex); });
        Object.keys(byFig).forEach(fiStr => {
            const fig = figures[parseInt(fiStr)];
            if (!fig) return;
            buildEdgeChains(fig, byFig[fiStr]).forEach(chain => {
                figures.push(computeParallelChain(fig, chain, distPx));
            });
        });
        lineGuideEdges = [];
        redrawAll();
    }

    function applyOffset() {
        if (offsetEdges.length===0) { showModal({title:'Error',body:'Selecciona al menos una arista.',buttons:[{label:'OK'}]}); return; }
        const distCm = parseFloat(document.getElementById('offsetValue').value.replace(',','.'));
        if (isNaN(distCm)||distCm<=0) { showModal({title:'Valor inválido',body:'Introduce una distancia positiva en cm.',buttons:[{label:'OK'}]}); return; }
        saveState();

        const fi = offsetEdges[0].figureIndex;
        const fig = figures[fi];
        const baseEdgeIdxs = offsetEdges.map(o=>o.edgeIndex);
        const distPx = distCm * PX_PER_CM;

        function clamp06(v){ v=parseInt(v); if(!v||isNaN(v)) v=0; return Math.max(-6, Math.min(6, v)); }
        // Los campos ▲/▼ son dos contadores separados, pero si alguien escribe un
        // número negativo en cualquiera de los dos (esperando que eso signifique
        // "hacia abajo"), antes se recortaba a 0 silenciosamente y no pasaba nada.
        // Ahora un negativo en cualquiera de los dos campos suma esa cantidad a la
        // dirección contraria.
        function resolveUpDown(rawUp, rawDown) {
            let up = clamp06(rawUp), down = clamp06(rawDown);
            if (up < 0) { down += -up; up = 0; }
            if (down < 0) { up += -down; down = 0; }
            return {up: Math.min(6, up), down: Math.min(6, down)};
        }

        const baseSignPositive = polygonSignedArea(fig) > 0;

        // Mapas iniciales (índice EN LA FIGURA ORIGINAL -> valor), sacados de
        // offsetVertexAxis/offsetEdgeDist. Cada pasada los actualiza y se los
        // pasa a la siguiente, así que la dirección forzada y las medidas por
        // segmento siguen valiendo en la talla 2, 3... no solo en la primera.
        const baseAxisMap = {};
        Object.keys(offsetVertexAxis).forEach(k => {
            const [kfi, kvi] = k.split('_');
            if (parseInt(kfi) === fi) baseAxisMap[parseInt(kvi)] = offsetVertexAxis[k];
        });
        const baseDistMap = {};
        Object.keys(offsetEdgeDist).forEach(k => {
            const [kfi, kei] = k.split('_');
            if (parseInt(kfi) === fi) baseDistMap[parseInt(kei)] = offsetEdgeDist[k];
        });

        let sawSelfCut = false;

        // Corre "steps" pasadas de desfase en dirección "sign" (1 = crecer, -1 =
        // achicar) SIEMPRE arrancando desde una copia nueva de la base tal cual
        // estaba antes de tocar nada, y deja una figura bloqueada nueva por cada
        // talla completada (no solo la última).
        function grow(steps, sign) {
            let curFig = JSON.parse(JSON.stringify(fig));
            let curEdgeIdxs = baseEdgeIdxs.slice();
            let curAxisMap = Object.assign({}, baseAxisMap);
            let curDistMap = Object.assign({}, baseDistMap);
            let curConnectorSet = new Set();
            for (let s=0; s<steps; s++) {
                const result = applyOffsetPass(curFig, curEdgeIdxs, distPx*sign, fi, curAxisMap, curDistMap, curConnectorSet);
                curEdgeIdxs = result.edgeIdxs;
                curAxisMap = result.axisMap;
                curDistMap = result.distMap;
                curConnectorSet = result.connectorSet;
                if (result.selfCut) sawSelfCut = true;

                // Último recurso: si ni el recorte de autointersección pudo
                // dejar una figura válida (caso extremo, varias pinzas
                // cruzándose a la vez), se frena acá en vez de guardar algo roto.
                const areaNow = polygonSignedArea(curFig);
                if (!isFinite(areaNow) || areaNow===0 || (areaNow>0)!==baseSignPositive) {
                    showModal({title:'Talla no aplicada', body:'La talla '+(sign>0?'+':'-')+(s+1)+' quedó demasiado deformada (varias puntas cruzándose a la vez) y no se pudo generar. Se guardaron las tallas anteriores válidas en esta dirección.', buttons:[{label:'OK'}]});
                    break;
                }

                const snap = JSON.parse(JSON.stringify(curFig));
                mergeCloseVertices(snap, 0.05*PX_PER_CM);
                figures.push(snap);
            }
        }

        if (mode !== 'tallas') {
            const result = applyOffsetPass(fig, baseEdgeIdxs, distPx, fi, baseAxisMap, baseDistMap);
            if (result.selfCut) sawSelfCut = true;
            const areaNow = polygonSignedArea(fig);
            if (!isFinite(areaNow) || areaNow===0 || (areaNow>0)!==baseSignPositive) {
                showModal({title:'No se pudo aplicar', body:'La costura quedó demasiado deformada (varias puntas cruzándose a la vez) para este margen. Deshacé (Ctrl+Z) y probá con un valor más chico.', buttons:[{label:'OK'}]});
            }
            mergeCloseVertices(fig, 0.05*PX_PER_CM);
            discardOffsetRef();
        } else {
            keepOffsetRef();
            const {up, down} = resolveUpDown(document.getElementById('offsetTallaUp').value, document.getElementById('offsetTallaDown').value);
            if (up===0 && down===0) grow(1, 1);
            else {
                if (up>0) grow(up, 1);
                if (down>0) grow(down, -1);
            }
        }

        if (sawSelfCut) {
            showModal({title:'Aviso', body:'Una punta o pinza muy cerrada se recortó automáticamente en el punto donde se cruzaba a sí misma, para que la figura quede válida.', buttons:[{label:'OK'}]});
        }

        offsetEdges=[];
        offsetVertexAxis={};
        offsetEdgeDist={};
        offsetDirMode=false; offsetArmedAxis=null; offsetDistMode=false; offsetDistAvgArmed=false;
        document.getElementById('offsetDirBtn').classList.remove('on');
        document.getElementById('offsetDistBtn').classList.remove('on');
        document.getElementById('offsetDistButtons').style.display='none';
        document.getElementById('offsetDistAvgBtn').classList.remove('on');
        document.getElementById('offsetAxisButtons').style.display='none';
        document.getElementById('offsetAxisXBtn').classList.remove('on');
        document.getElementById('offsetAxisYBtn').classList.remove('on');
        hidePanel('offsetInputs');
        selectedEdge=null;
        redrawAll();
    }
