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

    function toggleOffsetTallaMode(){
        offsetTallaMode = !offsetTallaMode;
        document.getElementById('offsetTallaBtn').classList.toggle('on', offsetTallaMode);
        document.getElementById('offsetTallaCounts').style.display = offsetTallaMode ? 'inline-flex' : 'none';
    }

    function toggleOffset() {
    if (mode==='offset') {
        setMode('none');
        offsetEdges=[];
        redrawAll();
    } else {
        setMode('offset');
        offsetEdges=[];
    }
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
    function applyOffsetPass(fig, edgeIdxList, distPxPass, fi, axisMap, distMap) {
        axisMap = axisMap || {};
        distMap = distMap || {};
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
            const ov = distMap[ei];
            if (typeof ov === 'number') return ov;
            if (ov === 'avg') {
                const p = prevOf[ei], nx = nextOf[ei];
                const pv = (p !== undefined && typeof distMap[p] === 'number') ? distMap[p] : null;
                const nv = (nx !== undefined && typeof distMap[nx] === 'number') ? distMap[nx] : null;
                if (pv != null && nv != null) return (pv + nv) / 2;
                if (pv != null) return pv;
                if (nv != null) return nv;
            }
            return distPxPass;
        }

        function dispForVertex(n, vi, edgeDistPx) {
            const ov = axisMap[vi];
            if (ov === 'x') return {x:(n.x<0?-1:1)*edgeDistPx, y:0};
            if (ov === 'y') return {x:0, y:(n.y<0?-1:1)*edgeDistPx};
            return {x:n.x*edgeDistPx, y:n.y*edgeDistPx};
        }

        const byEdgeIdx = {};
        sortedIndices.forEach((ei,i)=>{ byEdgeIdx[ei]=i; });

        function edgeTangent(edge, a, b, atEnd) {
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

            const dispA = dispForVertex(nA, edge.start, edgeDistPx);
            const dispB = dispForVertex(nB, edge.end, edgeDistPx);
            return {
                a2: {x: a.x+dispA.x, y: a.y+dispA.y},
                b2: {x: b.x+dispB.x, y: b.y+dispB.y},
                tanA, tanB, dispA, dispB, edge
            };
        });

        function lineIntersect(p1,p2,p3,p4){
            const d1x=p2.x-p1.x,d1y=p2.y-p1.y,d2x=p4.x-p3.x,d2y=p4.y-p3.y;
            const denom=d1x*d2y-d1y*d2x;
            if(Math.abs(denom)<1e-10) return null;
            const t=((p3.x-p1.x)*d2y-(p3.y-p1.y)*d2x)/denom;
            return {x:p1.x+t*d1x, y:p1.y+t*d1y};
        }

        sortedIndices.forEach(ei => {
            const nx = nextOf[ei];
            if (nx===undefined) return;
            const i = byEdgeIdx[ei], j = byEdgeIdx[nx];
            const sharedVi = fig.edges[ei].end;
            if (axisMap[sharedVi]) {
                offsets[j].a2 = {x: offsets[i].b2.x, y: offsets[i].b2.y};
                return;
            }
            const origV = fig.vertices[sharedVi];
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

        fig.edges.forEach((edge, ei) => {
            if (!selectedSet.has(ei)) {
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
                newEdges.push({start: remapOldVertex(edge.start), end: startNv, curved:false, cubic:false, controlX:null, controlY:null, control2X:null, control2Y:null});
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
            newEdges.push(newParallel);
            parallelObjs.add(newParallel);
            outNewEdgeIdxs.push(parIdx);
            if (distMap[ei] != null) outNewDistMap[parIdx] = distMap[ei];
            if (axisMap[edge.start] !== undefined) outNewAxisMap[startNv] = axisMap[edge.start];
            if (axisMap[edge.end] !== undefined) outNewAxisMap[endNv] = axisMap[edge.end];

            if (nextOf[ei] === undefined) {
                newEdges.push({start: endNv, end: remapOldVertex(edge.end), curved:false, cubic:false, controlX:null, controlY:null, control2X:null, control2Y:null});
            }
        });

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

        return {edgeIdxs: finalEdgeIdxs, axisMap: outNewAxisMap, distMap: outNewDistMap, selfCut};
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

        function clamp06(v){ v=parseInt(v); if(!v||isNaN(v)) v=0; return Math.max(0, Math.min(6, v)); }

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
            for (let s=0; s<steps; s++) {
                const result = applyOffsetPass(curFig, curEdgeIdxs, distPx*sign, fi, curAxisMap, curDistMap);
                curEdgeIdxs = result.edgeIdxs;
                curAxisMap = result.axisMap;
                curDistMap = result.distMap;
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

        if (!offsetTallaMode) {
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
            const up = clamp06(document.getElementById('offsetTallaUp').value);
            const down = clamp06(document.getElementById('offsetTallaDown').value);
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
