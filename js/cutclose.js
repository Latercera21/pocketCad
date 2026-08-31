// PocketCAD - módulo: cutclose
// Generado a partir de la división del archivo monolítico original.

    // Convierte lineas de corte seleccionadas en stroke muestreada
    function buildCutEdges(lineIndices) {
        if (lineIndices.length === 0) return {vertices: [], edges: []};

        // Construir segmentos con sus edges originales
        const segs = lineIndices.map(li => ({
            vertices: figures[li].vertices.map(v => ({x:v.x, y:v.y})),
            edges: figures[li].edges.map(e => Object.assign({}, e)),
            reversed: false
        }));

        // Encadenar por proximidad de extremos
        const ordered = [segs[0]];
        const used = segs.map((_,i) => i === 0);

        for (let pass = 0; pass < segs.length; pass++) {
            for (let i = 1; i < segs.length; i++) {
                if (used[i]) continue;
                const last  = ordered[ordered.length - 1];
                const first = ordered[0];
                const lastV  = last.reversed  ? last.vertices[0]                    : last.vertices[last.vertices.length - 1];
                const firstV = first.reversed ? first.vertices[first.vertices.length - 1] : first.vertices[0];
                const seg = segs[i];
                const sFirst = seg.vertices[0];
                const sLast  = seg.vertices[seg.vertices.length - 1];
                const dEF = Math.hypot(lastV.x - sFirst.x,  lastV.y - sFirst.y);
                const dEL = Math.hypot(lastV.x - sLast.x,   lastV.y - sLast.y);
                const dSF = Math.hypot(firstV.x - sFirst.x, firstV.y - sFirst.y);
                const dSL = Math.hypot(firstV.x - sLast.x,  firstV.y - sLast.y);
                const best = Math.min(dEF, dEL, dSF, dSL);
                if (best > 50) continue;
                const clone = {vertices: seg.vertices, edges: seg.edges, reversed: false};
                if      (best === dEF) { clone.reversed = false; ordered.push(clone); }
                else if (best === dEL) { clone.reversed = true;  ordered.push(clone); }
                else if (best === dSF) { clone.reversed = true;  ordered.unshift(clone); }
                else                   { clone.reversed = false; ordered.unshift(clone); }
                used[i] = true;
            }
        }

        const verts = [];
        const edges = [];

        for (const seg of ordered) {
        const vs = seg.reversed ? [...seg.vertices].reverse() : seg.vertices;
            const es = seg.reversed ? [...seg.edges].reverse()    : seg.edges;

            const offset = verts.length === 0 ? 0 : verts.length - 1;

            for (let vi = 0; vi < vs.length; vi++) {
                if (vi === 0 && verts.length > 0) continue; 
                verts.push({x: vs[vi].x, y: vs[vi].y});
            }

            for (let ei = 0; ei < es.length; ei++) {
                const e = Object.assign({}, es[ei]);
                if (seg.reversed) {                
                    const tmp = e.start; e.start = e.end; e.end = tmp;                
                }
                e.start = offset + ei;
                e.end   = offset + ei + 1;
                edges.push(e);
            }
        }

        return {vertices: verts, edges};
    }

    function findExactCrossings(figure, cutData) {
        const figPts = sampleFigureEdges(figure, 60);
        const cutPts = sampleFigureEdges({vertices: cutData.vertices, edges: cutData.edges}, 60);
        if (figPts.length < 2 || cutPts.length < 2) return [];

        const crossings = [];
        for (let ci = 0; ci < cutPts.length - 1; ci++) {
            const cA = cutPts[ci], cB = cutPts[ci + 1];
            for (let fi = 0; fi < figPts.length - 1; fi++) {
                const fA = figPts[fi], fB = figPts[fi + 1];
                const inter = lineLineIntersect(fA, fB, cA, cB);
                if (inter) {
                    // punto de intersección
                    const pt = {
                        x: fA.x + (fB.x - fA.x) * inter.t_fig,
                        y: fA.y + (fB.y - fA.y) * inter.t_fig
                    };
                    // Determinar a qué edge original pertenece el punto (por cercanía al punto medio)
                    let bestFigEdge = -1, bestFigT = 0, bestFigDist = Infinity;
                    for (let ei = 0; ei < figure.edges.length; ei++) {
                        const edge = figure.edges[ei];
                        const d = edgeDist(pt.x, pt.y, figure, edge);
                        if (d < bestFigDist) {
                            bestFigDist = d;
                            bestFigEdge = ei;
                            // calcular t aproximado en el edge original
                            const a = figure.vertices[edge.start], b = figure.vertices[edge.end];
                        if (edge.curved && edge.controlX != null) {
                            bestFigT = closestTOnQuad(pt, a, {x: edge.controlX, y: edge.controlY}, b, 80);
                        } else {
                            bestFigT = projectOntoLine(pt, a, b);
                        }
                        bestFigT = Math.max(0, Math.min(1, bestFigT));
                    }
                }
                let bestCutEdge = -1, bestCutT = 0, bestCutDist = Infinity;
                for (let ei = 0; ei < cutData.edges.length; ei++) {
                    const edge = cutData.edges[ei];
                    const d = edgeDist(pt.x, pt.y, {vertices: cutData.vertices, edges: cutData.edges}, edge);
                    if (d < bestCutDist) {
                        bestCutDist = d;
                        bestCutEdge = ei;
                        const a = cutData.vertices[edge.start], b = cutData.vertices[edge.end];
                        if (edge.curved && edge.controlX != null) {
                            bestCutT = closestTOnQuad(pt, a, {x: edge.controlX, y: edge.controlY}, b, 80);
                        } else {
                            bestCutT = projectOntoLine(pt, a, b);
                        }
                        bestCutT = Math.max(0, Math.min(1, bestCutT));
                    }
                }
                crossings.push({
                    edgeIdx: bestFigEdge,
                    t_fig: bestFigT,
                    pt: pt,
                    cutEdgeIdx: bestCutEdge,
                    t_cut: bestCutT,
                    strokeIdx: bestCutEdge * 1000 + Math.round(bestCutT * 1000)
                });
            }
        }
    }

    // deduplicar por cercanía
    const deduped = [];
    for (const c of crossings) {
        if (!deduped.some(d => Math.hypot(d.pt.x - c.pt.x, d.pt.y - c.pt.y) < 1.5)) {
            deduped.push(c);
        }
    }
    deduped.sort((a, b) => a.strokeIdx - b.strokeIdx);
    return deduped;
}

//findExactCrossing fin

function edgeToSegment(figure, edge) {
    const a = figure.vertices[edge.start];
    const b = figure.vertices[edge.end];
    if (edge.curved && edge.controlX != null) {
        return { type: 'quad', pts: [a, {x: edge.controlX, y: edge.controlY}, b] };
    }
    return { type: 'line', pts: [a, b] };
}

function subdivideSegment(seg, t) {
    if (seg.type === 'line') {
        const pt = ptOnLine(seg.pts[0], seg.pts[1], t);
        return {
            left:  { type: 'line', pts: [seg.pts[0], pt] },
            right: { type: 'line', pts: [pt, seg.pts[1]] }
        };
    } else {
        const s = splitQuadraticBezier(seg.pts[0], seg.pts[1], seg.pts[2], t);
        return {
            left:  { type: 'quad', pts: [s.left.start, {x:s.left.controlX, y:s.left.controlY}, s.left.end] },
            right: { type: 'quad', pts: [s.right.start, {x:s.right.controlX, y:s.right.controlY}, s.right.end] }
        };
    }
}

function invertirSegmento(seg) {
    if (seg.type === 'line') {
        return { type: 'line', pts: [seg.pts[1], seg.pts[0]] };
    } else {
        return { type: 'quad', pts: [seg.pts[2], seg.pts[1], seg.pts[0]] };
    }
}

function segmentToEdge(seg, startIdx, endIdx) {
    if (seg.type === 'line') {
        return { start: startIdx, end: endIdx, curved: false, cubic: false, controlX: null, controlY: null, control2X: null, control2Y: null };
    } else {
        return { start: startIdx, end: endIdx, curved: true, cubic: false, controlX: seg.pts[1].x, controlY: seg.pts[1].y, control2X: null, control2Y: null };
    }
}

    function fijarEndpoint(seg, pt) {
        if (seg.type === 'line') {
            return { type: 'line', pts: [seg.pts[0], pt] };
        } else {
            return { type: 'quad', pts: [seg.pts[0], seg.pts[1], pt] };
        }
    }

    function fijarStartpoint(seg, pt) {
        if (seg.type === 'line') {
            return { type: 'line', pts: [pt, seg.pts[1]] };
        } else {
        return { type: 'quad', pts: [pt, seg.pts[1], seg.pts[2]] };
        }
    }

    function splitWithStroke(figure, cutData, crossings) {
        if (crossings.length < 2) return null;

        const hitE = crossings[0];
        const hitS = crossings[crossings.length - 1];

        // Convertir figura a segmentos
        const figSegs = figure.edges.map(e => edgeToSegment(figure, e));
        const cutSegs = cutData.edges.map(e => edgeToSegment(cutData, e));

        // --- Subdividir el camino de corte entre hitE y hitS ---
        function buildCutInterior() {
            if (hitE.cutEdgeIdx === hitS.cutEdgeIdx) {
                const seg = cutSegs[hitE.cutEdgeIdx];
                const tA = Math.min(hitE.t_cut, hitS.t_cut);
                const tB = Math.max(hitE.t_cut, hitS.t_cut);
                const spA = subdivideSegment(seg, tA);
                const tRelB = (tB - tA) / (1 - tA);
                const spB = subdivideSegment(spA.right, tRelB);
                return [spB.left];
            } else {
                const interior = [];
                // Primer segmento: parte derecha desde hitE
                const firstSeg = cutSegs[hitE.cutEdgeIdx];
                const spFirst = subdivideSegment(firstSeg, hitE.t_cut);
                interior.push(spFirst.right);

                // Segmentos intermedios completos
                const inc = (hitS.cutEdgeIdx > hitE.cutEdgeIdx) ? 1 : -1;
                for (let ci = hitE.cutEdgeIdx + inc; ci !== hitS.cutEdgeIdx; ci += inc) {
                    interior.push(cutSegs[ci]);
                }

                // Último segmento: parte izquierda hasta hitS
                const lastSeg = cutSegs[hitS.cutEdgeIdx];
                const spLast = subdivideSegment(lastSeg, hitS.t_cut);
                interior.push(spLast.left);

                // Si el recorrido fue en orden inverso, invertir todo
                if (hitS.cutEdgeIdx < hitE.cutEdgeIdx) {
                    interior.reverse();
                    for (let i = 0; i < interior.length; i++) {
                        interior[i] = invertirSegmento(interior[i]);
                    }
                }
                return interior;
            }
        }

        const cutInterior = buildCutInterior();  
        // con los puntos de intersección, evitando huecos en los vértices.
        if (cutInterior.length > 0) {
            cutInterior[0] = fijarStartpoint(cutInterior[0], hitE.pt);
            cutInterior[cutInterior.length - 1] = fijarEndpoint(cutInterior[cutInterior.length - 1], hitS.pt);
        }

        const nodos = [];
        for (let i = 0; i < figSegs.length; i++) {
            if (i === hitE.edgeIdx && i === hitS.edgeIdx) {
                // Ambos en el mismo segmento
                const tA = Math.min(hitE.t_fig, hitS.t_fig);
                const tB = Math.max(hitE.t_fig, hitS.t_fig);
                const spA = subdivideSegment(figSegs[i], tA);
                const tRelB = (tB - tA) / (1 - tA);
                const spB = subdivideSegment(spA.right, tRelB);

                nodos.push({ kind: 'seg', seg: spA.left });
                nodos.push({ kind: 'cut', id: 'E', pt: hitE.t_fig < hitS.t_fig ? hitE.pt : hitS.pt });
                nodos.push({ kind: 'seg', seg: spB.left });
                nodos.push({ kind: 'cut', id: 'S', pt: hitE.t_fig < hitS.t_fig ? hitS.pt : hitE.pt });
                nodos.push({ kind: 'seg', seg: spB.right });
            } else if (i === hitE.edgeIdx) {
            const sp = subdivideSegment(figSegs[i], hitE.t_fig);
            nodos.push({ kind: 'seg', seg: sp.left });
            nodos.push({ kind: 'cut', id: 'E', pt: hitE.pt });
            nodos.push({ kind: 'seg', seg: sp.right });
            } else if (i === hitS.edgeIdx) {
                const sp = subdivideSegment(figSegs[i], hitS.t_fig);
                nodos.push({ kind: 'seg', seg: sp.left });
                nodos.push({ kind: 'cut', id: 'S', pt: hitS.pt });
                nodos.push({ kind: 'seg', seg: sp.right });
            } else {
                nodos.push({ kind: 'seg', seg: figSegs[i] });
            }
        }

        const posE = nodos.findIndex(n => n.kind === 'cut' && n.id === 'E');
        const posS = nodos.findIndex(n => n.kind === 'cut' && n.id === 'S');
        if (posE < 0 || posS < 0) return null;

        function arcoSegs(desde, hasta) {
            const segs = [];
            let i = (desde + 1) % nodos.length;
            while (i !== hasta) {
                if (nodos[i].kind === 'seg') segs.push(nodos[i].seg);
                i = (i + 1) % nodos.length;
            }
            return segs;
        }

        const segsLadoA = arcoSegs(posE, posS);
        const segsLadoB = arcoSegs(posS, posE);

        if (segsLadoA.length > 0) {
            segsLadoA[0] = fijarStartpoint(segsLadoA[0], hitE.pt);
            segsLadoA[segsLadoA.length - 1] = fijarEndpoint(segsLadoA[segsLadoA.length - 1], hitS.pt);
        }
        if (segsLadoB.length > 0) {
            segsLadoB[0] = fijarStartpoint(segsLadoB[0], hitS.pt);
            segsLadoB[segsLadoB.length - 1] = fijarEndpoint(segsLadoB[segsLadoB.length - 1], hitE.pt);
        }

        // Convertir lista de segmentos a figura CAD Cloth
        function segsToFigure(segs) {
            return segmentsToFigureGrande(segs);
        }
        //segtofigure fin

        // Lado A: fig segs + corte inverso (de S a E)
        const corteInv = cutInterior.map(seg => invertirSegmento(seg)).reverse();
        if (corteInv.length > 0) {
            corteInv[0] = fijarStartpoint(corteInv[0], hitS.pt);
            corteInv[corteInv.length - 1] = fijarEndpoint(corteInv[corteInv.length - 1], hitE.pt);
        }
        const fig1 = segsToFigure([...segsLadoA, ...corteInv]);

        // Lado B: fig segs + corte directo (de E a S)
        const fig2 = segsToFigure([...segsLadoB, ...cutInterior]);

        if (fig1.vertices.length < 3 || fig2.vertices.length < 3) return null;
        return [fig1, fig2];
    }

    // cero en el segmento donde ocurre el cruce, y devuelve UNA sola figura (no divide en 2).
    function splitWithStrokePartial(figure, cutData, hitE, innerEnd) {
        const figSegs = figure.edges.map(e => edgeToSegment(figure, e));
        const cutSegs = cutData.edges.map(e => edgeToSegment(cutData, e));

        // en ese orden (entrada -> punta).
        let cutPath;
        if (hitE.cutEdgeIdx === innerEnd.cutEdgeIdx) {
            const seg = cutSegs[hitE.cutEdgeIdx];
            const tA = Math.min(hitE.t_cut, innerEnd.t_cut);
            const tB = Math.max(hitE.t_cut, innerEnd.t_cut);
            const spA = subdivideSegment(seg, tA);
            const tRelB = (tB - tA) / (1 - tA);
            const spB = subdivideSegment(spA.right, tRelB);
            cutPath = [spB.left];
            if (innerEnd.t_cut < hitE.t_cut) {
                cutPath = cutPath.map(invertirSegmento).reverse();
            }
        } else {
            const path = [];
            const inc = (innerEnd.cutEdgeIdx > hitE.cutEdgeIdx) ? 1 : -1;
            const firstSeg = cutSegs[hitE.cutEdgeIdx];
            const spFirst = subdivideSegment(firstSeg, hitE.t_cut);
            path.push(inc === 1 ? spFirst.right : spFirst.left);
            for (let ci = hitE.cutEdgeIdx + inc; ci !== innerEnd.cutEdgeIdx; ci += inc) {
                path.push(cutSegs[ci]);
            }
            const lastSeg = cutSegs[innerEnd.cutEdgeIdx];
            const spLast = subdivideSegment(lastSeg, innerEnd.t_cut);
            path.push(inc === 1 ? spLast.left : spLast.right);
            if (inc === -1) {
                path.reverse();
                for (let i = 0; i < path.length; i++) path[i] = invertirSegmento(path[i]);
            }
            cutPath = path;
        }

        if (cutPath.length === 0) return null;
        cutPath[0] = fijarStartpoint(cutPath[0], hitE.pt);
        cutPath[cutPath.length - 1] = fijarEndpoint(cutPath[cutPath.length - 1], innerEnd.pt);

        // Ida y vuelta: entra por cutPath, y vuelve por el mismo camino invertido (ancho cero)
        const vuelta = cutPath.map(invertirSegmento).reverse();
        const muesca = [...cutPath, ...vuelta];

        // Subdividir el segmento de la figura donde esta hitE, e insertar la muesca ahi
        const piezaSegs = [];
        for (let i = 0; i < figSegs.length; i++) {
            if (i === hitE.edgeIdx) {
                const sp = subdivideSegment(figSegs[i], hitE.t_fig);
                const left = fijarEndpoint(sp.left, hitE.pt);
                const right = fijarStartpoint(sp.right, hitE.pt);
                piezaSegs.push(left, ...muesca, right);
            } else {
                piezaSegs.push(figSegs[i]);
            }
        }

        return segmentsToFigureGrande(piezaSegs);
    }

    // Ensamblador segmentos -> figura {vertices, edges} (fusiona vertices cercanos y cierra la figura)
    function segmentsToFigureGrande(segs) {
        const rawVertices = [];
        const edges = [];
        for (const seg of segs) {
            const startPt = seg.pts[0];
            const endPt = seg.type === 'line' ? seg.pts[1] : seg.pts[2];
            rawVertices.push({x: startPt.x, y: startPt.y});
            rawVertices.push({x: endPt.x, y: endPt.y});
        }
        const TOL = 1.0;
        const merged = [];
        const mapIdx = new Array(rawVertices.length);
        for (let i = 0; i < rawVertices.length; i++) {
            const pt = rawVertices[i];
            let found = -1;
            for (let j = 0; j < merged.length; j++) {
                if (Math.hypot(merged[j].x - pt.x, merged[j].y - pt.y) < TOL) { found = j; break; }
            }
            if (found === -1) { mapIdx[i] = merged.length; merged.push({x: pt.x, y: pt.y}); }
            else mapIdx[i] = found;
        }
        for (let k = 0; k < segs.length; k++) {
            const seg = segs[k];
            const startIdx = mapIdx[k * 2], endIdx = mapIdx[k * 2 + 1];
            if (startIdx === endIdx) continue;
            edges.push(segmentToEdge(seg, startIdx, endIdx));
        }
        if (merged.length > 1 && Math.hypot(merged[0].x - merged[merged.length - 1].x, merged[0].y - merged[merged.length - 1].y) < TOL) {
            const lastIdx = merged.length - 1;
            for (let i = 0; i < edges.length; i++) {
                if (edges[i].start === lastIdx) edges[i].start = 0;
                if (edges[i].end === lastIdx) edges[i].end = 0;
            }
            merged.pop();
            for (let i = 0; i < edges.length; i++) {
                if (edges[i].start > lastIdx) edges[i].start--;
                if (edges[i].end > lastIdx) edges[i].end--;
            }
        }
        return { vertices: merged, edges, closed: true, grain: null };
    }

    function applyCut() {
    if (cutLineIndices.length === 0) {
        showModal({title:'Error',body:'Selecciona al menos una línea de corte.',buttons:[{label:'OK'}]});
        return;
    }

    const cutData = buildCutEdges(cutLineIndices);
    if (cutData.vertices.length < 2) {
        showModal({title:'Error',body:'La línea de corte no tiene puntos suficientes.',buttons:[{label:'OK'}]});
        return;
    }

    let targetFi = -1;
    let bestCrossings = null;
    let partialInner = null; // {pt, cutEdgeIdx, t_cut}

    for (let fi = 0; fi < figures.length; fi++) {
        if (!figures[fi].closed) continue;
        if (cutLineIndices.includes(fi)) continue;
        const cx = findExactCrossings(figures[fi], cutData);
        if (cx.length >= 2) {
            targetFi = fi;
            bestCrossings = cx;
            break;
        }
    }

    // Corte parcial (1 cruce + un extremo dentro)
    if (targetFi === -1) {
        for (let fi = 0; fi < figures.length; fi++) {
            if (!figures[fi].closed) continue;
            if (cutLineIndices.includes(fi)) continue;
            const cx = findExactCrossings(figures[fi], cutData);
            if (cx.length === 1) {
                const firstPt = cutData.vertices[0];
                const lastPt = cutData.vertices[cutData.vertices.length - 1];
                if (isPointInPolygon(firstPt.x, firstPt.y, figures[fi])) {
                    targetFi = fi;
                    bestCrossings = cx;
                    partialInner = {pt: firstPt, cutEdgeIdx: 0, t_cut: 0};
                    break;
                } else if (isPointInPolygon(lastPt.x, lastPt.y, figures[fi])) {
                    targetFi = fi;
                    bestCrossings = cx;
                    partialInner = {pt: lastPt, cutEdgeIdx: cutData.edges.length - 1, t_cut: 1};
                    break;
                }
            }
        }
    }

    if (targetFi === -1) {
        showModal({title:'Error',body:'La línea de corte no intersecta ninguna figura cerrada correctamente.',buttons:[{label:'OK'}]});
        return;
    }

    saveState();

    if (bestCrossings.length >= 2) {
        const result = splitWithStroke(figures[targetFi], cutData, bestCrossings);
        if (!result) {
            showModal({title:'Error',body:'No se pudo realizar el corte.',buttons:[{label:'OK'}]});
            return;
        }
        figures.splice(targetFi, 1, ...result);
    } else {
        // Se inserta una muesca de ancho cero y la figura permanece como UNA sola pieza.
        if (!partialInner) {
            showModal({title:'Error',body:'No se pudo realizar el corte parcial.',buttons:[{label:'OK'}]});
            return;
        }
        const hitE = bestCrossings[0];
        const resultado = splitWithStrokePartial(figures[targetFi], cutData, hitE, partialInner);
        if (!resultado || resultado.vertices.length < 3) {
            showModal({title:'Error',body:'No se pudo realizar el corte parcial.',buttons:[{label:'OK'}]});
            return;
        }
        figures[targetFi] = resultado;
    }

    cutLineIndices = [];
    document.getElementById('cutApplyBtn').style.display = 'none';
    setMode('none');
    redrawAll();
}

// applycut fin

    // ===================== CERRAR FIGURA =====================
    function applyCloseShape() {
    if (closeLineIndices.length < 1) {
        showModal({title:'Error',body:'Selecciona al menos una línea.',buttons:[{label:'OK'}]});
        return;
    }

    const THR = 20 / viewScale;
    const THR_SEARCH = Math.max(THR, 400);

    const lines = closeLineIndices.map(li => ({
        segs: figures[li].edges.map(e => edgeToSegment(figures[li], e)),
        used: false
    }));

    function firstPt(segs){ return segs[0].pts[0]; }
    function lastPt(segs){ const s=segs[segs.length-1]; return s.type==='line'?s.pts[1]:s.pts[2]; }

    const ordered = [{segs: lines[0].segs, reversed:false}];
    lines[0].used = true;

    let changed = true;
    while (changed) {
        changed = false;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].used) continue;
            const last = ordered[ordered.length-1];
            const first = ordered[0];
            const lastV = last.reversed ? firstPt(last.segs) : lastPt(last.segs);
            const firstV = first.reversed ? lastPt(first.segs) : firstPt(first.segs);
            const seg = lines[i];
            const sFirst = firstPt(seg.segs);
            const sLast = lastPt(seg.segs);
            const dEF = Math.hypot(lastV.x-sFirst.x, lastV.y-sFirst.y);
            const dEL = Math.hypot(lastV.x-sLast.x, lastV.y-sLast.y);
            const dSF = Math.hypot(firstV.x-sFirst.x, firstV.y-sFirst.y);
            const dSL = Math.hypot(firstV.x-sLast.x, firstV.y-sLast.y);
            const best = Math.min(dEF, dEL, dSF, dSL);
            if (best > THR_SEARCH) continue;
            const clone = {segs: seg.segs, reversed:false};
            if (best === dEF) { clone.reversed=false; ordered.push(clone); }
            else if (best === dEL) { clone.reversed=true; ordered.push(clone); }
            else if (best === dSF) { clone.reversed=true; ordered.unshift(clone); }
            else { clone.reversed=false; ordered.unshift(clone); }
            lines[i].used = true;
            changed = true;
        }
    }

    function orientedSegs(piece) {
        if (!piece.reversed) return piece.segs;
        return piece.segs.map(invertirSegmento).reverse();
    }

    function sampleSegPoints(seg, steps=30) {
        const pts = [];
        for (let i=0;i<=steps;i++){
            const t=i/steps;
            if (seg.type==='line') {
                pts.push({x: seg.pts[0].x+(seg.pts[1].x-seg.pts[0].x)*t, y: seg.pts[0].y+(seg.pts[1].y-seg.pts[0].y)*t, t});
            } else {
                const p0=seg.pts[0],cp=seg.pts[1],p1=seg.pts[2];
                pts.push({x:(1-t)*(1-t)*p0.x+2*(1-t)*t*cp.x+t*t*p1.x, y:(1-t)*(1-t)*p0.y+2*(1-t)*t*cp.y+t*t*p1.y, t});
            }
        }
        return pts;
    }

    function findSegsIntersection(segsA, segsB) {
        let best = null, bestScore = -Infinity;
        for (let ai=0; ai<segsA.length; ai++) {
            const ptsA = sampleSegPoints(segsA[ai]);
            for (let bi=0; bi<segsB.length; bi++) {
                const ptsB = sampleSegPoints(segsB[bi]);
                for (let i=0;i<ptsA.length-1;i++) {
                    for (let j=0;j<ptsB.length-1;j++) {
                        const inter = lineLineIntersect(ptsA[i], ptsA[i+1], ptsB[j], ptsB[j+1]);
                        if (inter) {
                            const pt = {
                                x: ptsA[i].x + (ptsA[i+1].x-ptsA[i].x)*inter.t_fig,
                                y: ptsA[i].y + (ptsA[i+1].y-ptsA[i].y)*inter.t_fig
                            };
                            const atG = ptsA[i].t + (ptsA[i+1].t-ptsA[i].t)*inter.t_fig;
                            const btG = ptsB[j].t + (ptsB[j+1].t-ptsB[j].t)*inter.t_cut;
                            const score = (ai+atG) - (bi+btG);
                            if (score > bestScore) { bestScore=score; best = {ai, at:atG, bi, bt:btG, pt}; }
                        }
                    }
                }
            }
        }
        return best;
    }

    function trimEnd(segs, ai, at) {
        const result = segs.slice(0, ai);
        const sp = subdivideSegment(segs[ai], at);
        result.push(sp.left);
        return result;
    }
    function trimStart(segs, bi, bt) {
        const sp = subdivideSegment(segs[bi], bt);
        return [sp.right, ...segs.slice(bi+1)];
    }

    function tryJoin(idxA, idxB) {
        const segsA = orientedSegs(ordered[idxA]);
        const segsB = orientedSegs(ordered[idxB]);
        const endA = lastPt(segsA);
        const startB = firstPt(segsB);
        const d = Math.hypot(endA.x-startB.x, endA.y-startB.y);
        if (d <= THR) {
            // ya están prácticamente juntos: fusionar en un punto exacto para no dejar
            // un hueco microscópico que luego no se cierre bien.
            if (d > 0.001) {
                const mid = {x:(endA.x+startB.x)/2, y:(endA.y+startB.y)/2};
                segsA[segsA.length-1] = fijarEndpoint(segsA[segsA.length-1], mid);
                segsB[0] = fijarStartpoint(segsB[0], mid);
                ordered[idxA] = {segs: segsA, reversed:false};
                ordered[idxB] = {segs: segsB, reversed:false};
            }
            return;
        }
        const cross = findSegsIntersection(segsA, segsB);
        if (!cross) {
            // no se cruzan: unir con una línea recta directa en vez de dejar un sobrante abierto
            ordered[idxA] = {segs: [...segsA, {type:'line', pts:[endA, startB]}], reversed:false};
            ordered[idxB] = {segs: segsB, reversed:false};
            return;
        }
        const trimmedA = trimEnd(segsA, cross.ai, cross.at);
        const trimmedB = trimStart(segsB, cross.bi, cross.bt);
        trimmedA[trimmedA.length-1] = fijarEndpoint(trimmedA[trimmedA.length-1], cross.pt);
        trimmedB[0] = fijarStartpoint(trimmedB[0], cross.pt);
        ordered[idxA] = {segs: trimmedA, reversed:false};
        ordered[idxB] = {segs: trimmedB, reversed:false};
    }

    for (let i = 0; i < ordered.length - 1; i++) tryJoin(i, i+1);
    if (ordered.length > 1) tryJoin(ordered.length-1, 0);

    const allSegs = [];
    ordered.forEach(piece => { allSegs.push(...orientedSegs(piece)); });

    if (allSegs.length > 0) {
        const firstP = firstPt(allSegs);
        const lastP = lastPt(allSegs);
        if (Math.hypot(firstP.x-lastP.x, firstP.y-lastP.y) > 1.0) {
            allSegs.push({type:'line', pts:[lastP, firstP]});
        }
    }

    const newFig = segmentsToFigureGrande(allSegs);
    if (newFig.vertices.length < 3) {
        showModal({title:'Error',body:'No se pudo cerrar la figura.',buttons:[{label:'OK'}]});
        return;
    }
    mergeCloseVertices(newFig, 0.1*PX_PER_CM);

    saveState();
    const sortedIdx = [...closeLineIndices].sort((a,b)=>b-a);
    for (const idx of sortedIdx) figures.splice(idx, 1);
    figures.push(newFig);
    closeLineIndices = [];
    document.getElementById('closeApplyBtn').style.display = 'none';
    setMode('none');
    redrawAll();
}
