// PocketCAD - módulo: offset
// Generado a partir de la división del archivo monolítico original.

 // key: fi+'_'+vi -> 'x' | 'y'
    function toggleOffsetDirMode(){
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
                    results.push(JSON.parse(JSON.stringify(curFig)));
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
    function applyOffsetPass(fig, edgeIdxList, distPxPass, fi, axisMap, distMap, connectorSet, tanMem, runCtx) {
        axisMap = axisMap || {};
        distMap = distMap || {};
        connectorSet = connectorSet || new Set();
        tanMem = tanMem || new Map();
        runCtx = runCtx || {};
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
            if (ov === 'x') return {x:(n.x<0?-1:1)*edgeDistPx, y:0};
            if (ov === 'y') return {x:0, y:(n.y<0?-1:1)*edgeDistPx};
            return {x:n.x*edgeDistPx, y:n.y*edgeDistPx};
        }

        function guardControlLeg(cx, cy, ex, ey, origLen) {
            let dx = cx - ex, dy = cy - ey;
            let d = Math.hypot(dx, dy);
            const target = origLen * 0.45;
            if (d < target) {
                if (d < 1e-6) { dx = 1; dy = 0; d = 1; }
                const k = target / d;
                return {x: ex + dx * k, y: ey + dy * k};
            }
            return {x: cx, y: cy};
        }

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

            let tanA = edgeTangent(edge, a, b, false);
            let tanB = edgeTangent(edge, a, b, true);
            if (runCtx.tallas) {
                const mem = tanMem.get(edge);
                if (mem) {
                    if (mem.tA.x*tanA.x + mem.tA.y*tanA.y < 0) { tanA = {x: -tanA.x, y: -tanA.y}; }
                    if (mem.tB.x*tanB.x + mem.tB.y*tanB.y < 0) { tanB = {x: -tanB.x, y: -tanB.y}; }
                } else {
                    const la = Math.hypot(tanA.x, tanA.y) || 1;
                    const lb = Math.hypot(tanB.x, tanB.y) || 1;
                    tanMem.set(edge, { tA: {x: tanA.x/la, y: tanA.y/la}, tB: {x: tanB.x/lb, y: tanB.y/lb} });
                }
            }
            const lenA = Math.hypot(tanA.x, tanA.y) || 1;
            const lenB = Math.hypot(tanB.x, tanB.y) || 1;
            const nA = cw ? {x: tanA.y/lenA, y: -tanA.x/lenA} : {x: -tanA.y/lenA, y: tanA.x/lenA};
            const nB = cw ? {x: tanB.y/lenB, y: -tanB.x/lenB} : {x: -tanB.y/lenB, y: tanB.x/lenB};

            const dispA = dispForVertex(nA, edge.start, edgeDistPx);
            const dispB = dispForVertex(nB, edge.end, edgeDistPx);
            const legA = (edge.curved && edge.controlX != null) ? Math.hypot(edge.controlX - a.x, edge.controlY - a.y) || 1 : 0;
            const legB = (edge.cubic && edge.control2X != null) ? Math.hypot(b.x - edge.control2X, b.y - edge.control2Y) || 1 : 0;
            return {
                a2: {x: a.x+dispA.x, y: a.y+dispA.y},
                b2: {x: b.x+dispB.x, y: b.y+dispB.y},
                tanA, tanB, dispA, dispB, legA, legB, edge
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

        sortedIndices.forEach(ei => {
            const nx = nextOf[ei];
            if (nx===undefined) return;
            const i = byEdgeIdx[ei], j = byEdgeIdx[nx];
            const sharedVi = fig.edges[ei].end;
            const origV = fig.vertices[sharedVi];
            if (axisMap[sharedVi]) {
                // Con eje forzado, cada arista ya calculó su propio punto usando SU
                // propia medida (offsetEdgeDist si tiene una propia). Antes esto se
                // resolvía quedándose siempre con el de la arista "anterior" en el
                // orden interno, pisando la medida de la otra aunque fuera mayor. Ahora
                // se respeta la medida mayor de las dos, igual que sin forzar dirección.
                const di = Math.hypot(offsets[i].b2.x-origV.x, offsets[i].b2.y-origV.y);
                const dj = Math.hypot(offsets[j].a2.x-origV.x, offsets[j].a2.y-origV.y);
                const winner = dj > di ? offsets[j].a2 : offsets[i].b2;
                offsets[i].b2 = {x: winner.x, y: winner.y};
                offsets[j].a2 = {x: winner.x, y: winner.y};
                return;
            }
            const distRef = (Math.hypot(offsets[i].dispB.x, offsets[i].dispB.y) +
                             Math.hypot(offsets[j].dispA.x, offsets[j].dispA.y)) / 2 || 1;
            const p1 = offsets[i].b2, p2 = {x: p1.x + offsets[i].tanB.x, y: p1.y + offsets[i].tanB.y};
            const p3 = offsets[j].a2, p4 = {x: p3.x + offsets[j].tanA.x, y: p3.y + offsets[j].tanA.y};
            const inter = lineIntersect(p1, p2, p3, p4);
            let joined = null;
            if (inter) {
                const miterDist = Math.hypot(inter.x - origV.x, inter.y - origV.y);
                if (miterDist <= distRef * 4) joined = inter;
            }
            if (!joined) {
                joined = { x: (offsets[i].b2.x + offsets[j].a2.x) / 2, y: (offsets[i].b2.y + offsets[j].a2.y) / 2 };
            }
            offsets[i].b2 = joined; offsets[j].a2 = joined;
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
                const inter = lineIntersect(p1, p2, p3, p4);
                if (inter) {
                    const distRef = Math.hypot(offsets[i].dispA.x, offsets[i].dispA.y) || 1;
                    if (Math.hypot(inter.x-pivot.x, inter.y-pivot.y) <= distRef * 8) {
                        offsets[i].a2 = inter;
                        const toInter = {x: inter.x-pivot.x, y: inter.y-pivot.y};
                        const toRef = {x: ref.x-pivot.x, y: ref.y-pivot.y};
                        // Si la arista vecina YA es un conector nuestro de una
                        // pasada anterior, siempre se consolida (se reemplaza
                        // entero) sin importar el signo: si no, cada talla
                        // adicional apilaría otro tramito más (el bug de
                        // duplicado que ya se había arreglado antes).
                        if (connectorSet.has(info.edgeObj) || toInter.x*toRef.x + toInter.y*toRef.y > 0) {
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
                const inter = lineIntersect(p1, p2, p3, p4);
                if (inter) {
                    const distRef = Math.hypot(offsets[i].dispB.x, offsets[i].dispB.y) || 1;
                    if (Math.hypot(inter.x-pivot.x, inter.y-pivot.y) <= distRef * 8) {
                        offsets[i].b2 = inter;
                        const toInter = {x: inter.x-pivot.x, y: inter.y-pivot.y};
                        const toRef = {x: ref.x-pivot.x, y: ref.y-pivot.y};
                        if (connectorSet.has(infoE.edgeObj) || toInter.x*toRef.x + toInter.y*toRef.y > 0) {
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
        const newVertices = [];
        const newEdges = [];
        const vertexRemap = {};
        function remapOldVertex(oldVi) {
            if (vertexRemap[oldVi] !== undefined) return vertexRemap[oldVi];
            const nv = newVertices.length;
            newVertices.push({x: fig.vertices[oldVi].x, y: fig.vertices[oldVi].y});
            vertexRemap[oldVi] = nv;
            return nv;
        }

        const outNewEdgeIdxs = [];
        const outNewAxisMap = {};
        const outNewDistMap = {};
        const parallelObjs = new Set();
        const newConnectorObjs = new Set();
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

            let startNv;
            if (prevOf[ei] !== undefined) {
                if (jointNewVi[edge.start] === undefined) {
                    jointNewVi[edge.start] = newVertices.length;
                    newVertices.push({x: offsets[i].a2.x, y: offsets[i].a2.y});
                }
                startNv = jointNewVi[edge.start];
            } else {
                startNv = newVertices.length;
                newVertices.push({x: offsets[i].a2.x, y: offsets[i].a2.y});
            }

            let endNv;
            if (nextOf[ei] !== undefined) {
                if (jointNewVi[edge.end] === undefined) {
                    jointNewVi[edge.end] = newVertices.length;
                    newVertices.push({x: offsets[i].b2.x, y: offsets[i].b2.y});
                }
                endNv = jointNewVi[edge.end];
            } else {
                endNv = newVertices.length;
                newVertices.push({x: offsets[i].b2.x, y: offsets[i].b2.y});
            }

            if (prevOf[ei] === undefined) {
                if (sharedPair && sharedPair.startEi === ei) {
                    sharedCapNv.start = startNv;
                } else {
                    const info = capInfoStart[ei];
                    const fromVi = (info && capUseTrimStart[ei]) ? info.refVi : (info ? info.pivotVi : edge.start);
                    const connObj = {start: remapOldVertex(fromVi), end: startNv, curved:false, cubic:false, controlX:null, controlY:null, control2X:null, control2Y:null};
                    newEdges.push(connObj);
                    newConnectorObjs.add(connObj);
                }
            }

            const parIdx = newEdges.length;
            let ctrl1x = null, ctrl1y = null, ctrl2x = null, ctrl2y = null;
            if (edge.curved && edge.controlX != null) {
                ctrl1x = edge.controlX + (edge.cubic?dispA.x:(dispA.x+dispB.x)/2);
                ctrl1y = edge.controlY + (edge.cubic?dispA.y:(dispA.y+dispB.y)/2);
                if (runCtx.tallas && offsets[i].legA) {
                    const aPos = newVertices[startNv];
                    const g = guardControlLeg(ctrl1x, ctrl1y, aPos.x, aPos.y, offsets[i].legA);
                    ctrl1x = g.x; ctrl1y = g.y;
                }
                if (edge.cubic && edge.control2X != null) {
                    ctrl2x = edge.control2X + dispB.x;
                    ctrl2y = edge.control2Y + dispB.y;
                    if (runCtx.tallas && offsets[i].legB) {
                        const bPos = newVertices[endNv];
                        const g2 = guardControlLeg(ctrl2x, ctrl2y, bPos.x, bPos.y, offsets[i].legB);
                        ctrl2x = g2.x; ctrl2y = g2.y;
                    }
                }
            }
            const newParallel = {
                start: startNv, end: endNv,
                curved: edge.curved, cubic: edge.cubic,
                controlX: ctrl1x, controlY: ctrl1y, control2X: ctrl2x, control2Y: ctrl2y
            };
            newEdges.push(newParallel);
            parallelObjs.add(newParallel);
            outNewEdgeIdxs.push(parIdx);
            if (distMap[ei] != null) outNewDistMap[parIdx] = distMap[ei];
            if (axisMap[edge.start] !== undefined) outNewAxisMap[startNv] = axisMap[edge.start];
            if (axisMap[edge.end] !== undefined) outNewAxisMap[endNv] = axisMap[edge.end];

            if (nextOf[ei] === undefined) {
                if (sharedPair && sharedPair.endEj === ei) {
                    sharedCapNv.end = endNv;
                } else {
                    const infoE = capInfoEnd[ei];
                    const toVi = (infoE && capUseTrimEnd[ei]) ? infoE.refVi : (infoE ? infoE.pivotVi : edge.end);
                    const connObj2 = {start: endNv, end: remapOldVertex(toVi), curved:false, cubic:false, controlX:null, controlY:null, control2X:null, control2Y:null};
                    newEdges.push(connObj2);
                    newConnectorObjs.add(connObj2);
                }
            }
        });

        if (sharedPair && sharedCapNv.start !== undefined && sharedCapNv.end !== undefined) {
            // Un solo tramo entre las dos puntas, en vez de dos conectores que
            // se superpondrían casi enteros entre sí.
            const connObj = {start: sharedCapNv.end, end: sharedCapNv.start, curved:false, cubic:false, controlX:null, controlY:null, control2X:null, control2Y:null};
            newEdges.push(connObj);
            newConnectorObjs.add(connObj);
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
            let curTanMem = new Map();
            for (let s=0; s<steps; s++) {
                const result = applyOffsetPass(curFig, curEdgeIdxs, distPx*sign, fi, curAxisMap, curDistMap, curConnectorSet, curTanMem, {tallas:true});
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
                snap.locked = true;
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
