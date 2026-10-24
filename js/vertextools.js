// PocketCAD - módulo: vertextools
// Generado a partir de la división del archivo monolítico original.

    // Quita un punto interior de una cadena de curva multipunto (Catmull-Rom), fusionando
    // las 2 aristas que lo tocan en 1 sola y recalculando toda la cadena. No permite quitar
    // los extremos fijos de la cadena (los que conectan con el resto de la figura).
    function removeCurvePoint(fig, vertexIndex, chain) {
        const edges = fig.edges;
        const firstAnchor = edges[chain[0]].start;
        const lastAnchor = edges[chain[chain.length-1]].end;
        if (vertexIndex === firstAnchor || vertexIndex === lastAnchor) return;
        const posInChain = chain.findIndex(ei => edges[ei].start === vertexIndex);
        if (posInChain <= 0) return;
        const prevEdge = edges[chain[posInChain-1]], curEdge = edges[chain[posInChain]];
        prevEdge.end = curEdge.end;
        edges.splice(edges.indexOf(curEdge), 1);
        fig.vertices.splice(vertexIndex, 1);
        edges.forEach(e => { if (e.start > vertexIndex) e.start--; if (e.end > vertexIndex) e.end--; });
        const newChain = getCurveChain(fig, edges.indexOf(prevEdge));
        recomputeCurveChain(fig, newChain);
    }

    // ===================== OPERACIONES =====================
    function addVertexOnEdge(fi,ei,x,y,hard){
        const figure=figures[fi],edge=figure.edges[ei];
        const a=figure.vertices[edge.start],b=figure.vertices[edge.end];
        const isCubic = edge.cubic && edge.control2X!=null;
        const isQuad = !isCubic && edge.curved && edge.controlX!=null;
        let newPoint,t;
        if(divideMidpoint){
            t=0.5;
            if(isCubic){
                const mt=1-t;
                newPoint={x:mt*mt*mt*a.x+3*mt*mt*t*edge.controlX+3*mt*t*t*edge.control2X+t*t*t*b.x,
                          y:mt*mt*mt*a.y+3*mt*mt*t*edge.controlY+3*mt*t*t*edge.control2Y+t*t*t*b.y};
            } else if(isQuad){
                newPoint={x:(1-t)*(1-t)*a.x+2*(1-t)*t*edge.controlX+t*t*b.x, y:(1-t)*(1-t)*a.y+2*(1-t)*t*edge.controlY+t*t*b.y};
            } else {
                newPoint={x:a.x+(b.x-a.x)*t, y:a.y+(b.y-a.y)*t};
            }
        } else if(isCubic){
            t=closestTOnCubic({x,y}, a, {x:edge.controlX,y:edge.controlY}, {x:edge.control2X,y:edge.control2Y}, b, 100);
            const mt=1-t;
            newPoint={x:mt*mt*mt*a.x+3*mt*mt*t*edge.controlX+3*mt*t*t*edge.control2X+t*t*t*b.x,
                      y:mt*mt*mt*a.y+3*mt*mt*t*edge.controlY+3*mt*t*t*edge.control2Y+t*t*t*b.y};
        } else if(isQuad){
            const steps=100; let best=Infinity,bt=0;
            for(let i=0;i<=steps;i++){
                const tt=i/steps,xt=(1-tt)*(1-tt)*a.x+2*(1-tt)*tt*edge.controlX+tt*tt*b.x,yt=(1-tt)*(1-tt)*a.y+2*(1-tt)*tt*edge.controlY+tt*tt*b.y;
                const d=Math.hypot(x-xt,y-yt);if(d<best){best=d;bt=tt;newPoint={x:xt,y:yt};}
            }
            t=bt;
        } else {
            const c=closestOnLine(x,y,a.x,a.y,b.x,b.y);newPoint={x:c.x,y:c.y};t=c.t;
        }
        const nvi=edge.end;
        if(hard) newPoint.hardCorner=true;   // ➕v / Dividir en Editar vértices: punto duro (no punto de curva)
        figure.vertices.splice(nvi,0,newPoint);
        figure.edges.forEach(e=>{if(e.start>=nvi)e.start++;if(e.end>=nvi)e.end++;});
        if(isCubic){
            const s=splitCubicBezier(a,{x:edge.controlX,y:edge.controlY},{x:edge.control2X,y:edge.control2Y},b,t);
            edge.end=nvi;edge.controlX=s.left.cp1.x;edge.controlY=s.left.cp1.y;edge.control2X=s.left.cp2.x;edge.control2Y=s.left.cp2.y;
            figure.edges.splice(ei+1,0,{start:nvi,end:nvi+1,curved:true,cubic:true,
                controlX:s.right.cp1.x,controlY:s.right.cp1.y,control2X:s.right.cp2.x,control2Y:s.right.cp2.y});
        }else if(isQuad){
            const c1x=(1-t)*a.x+t*edge.controlX,c1y=(1-t)*a.y+t*edge.controlY;
            const c2x=(1-t)*edge.controlX+t*b.x, c2y=(1-t)*edge.controlY+t*b.y;
            edge.end=nvi;edge.controlX=c1x;edge.controlY=c1y;
            figure.edges.splice(ei+1,0,{start:nvi,end:nvi+1,curved:true,cubic:false,controlX:c2x,controlY:c2y,control2X:null,control2Y:null});
        }else{edge.end=nvi;figure.edges.splice(ei+1,0,makeEdge(nvi,nvi+1));}
    }

    function deleteVertex(fi, vi) {
        const fig = figures[fi];
        // Si la figura tiene solo 2 vértices, se elimina completa
        if (fig.vertices.length <= 2) {
            figures.splice(fi, 1);
            return;
        }

        const n = fig.vertices.length;
        const isClosed = fig.closed;
        const edges = fig.edges;

        // Encontrar aristas adyacentes
        let edgeIn = null, edgeOut = null;
        for (let ei = 0; ei < edges.length; ei++) {
            const e = edges[ei];
            if (e.end === vi) edgeIn = ei;
            if (e.start === vi) edgeOut = ei;
        }

        // Si no se encuentran ambas, es un extremo en figura abierta
        if (edgeIn === null || edgeOut === null) {
            // Eliminar el vértice y la arista que lo conecta
            const edgeIdx = edgeIn !== null ? edgeIn : edgeOut;
            if (edgeIdx !== null) {
                edges.splice(edgeIdx, 1);
                // Ajustar índices
                edges.forEach(e => {
                    if (e.start > vi) e.start--;
                    if (e.end > vi) e.end--;
                });
                fig.vertices.splice(vi, 1);
            }
        } else {
            // Fusionar las dos aristas en una
            const eIn = edges[edgeIn];
            const eOut = edges[edgeOut];
            const newStart = eIn.start;
            const newEnd = eOut.end;

            // Eliminar ambas aristas (primero la de mayor índice para no desordenar)
            if (edgeIn > edgeOut) {
                edges.splice(edgeIn, 1);
                edges.splice(edgeOut, 1);
            } else {
                edges.splice(edgeOut, 1);
                edges.splice(edgeIn, 1);
            }

            // Crear nueva arista recta (pierde curvatura)
            const newEdge = makeEdge(newStart, newEnd);
            // Insertar en la posición de la primera arista eliminada
            edges.splice(Math.min(edgeIn, edgeOut), 0, newEdge);

            // Eliminar el vértice
            fig.vertices.splice(vi, 1);

            // Ajustar índices en todas las aristas
            edges.forEach(e => {
                if (e.start > vi) e.start--;
                if (e.end > vi) e.end--;
            });
        }
    }

    function resizeEdge(fi,ei,newPx,clickX,clickY){
        const figure=figures[fi],edge=figure.edges[ei];
        const a=figure.vertices[edge.start],b=figure.vertices[edge.end];
        const cur=edgeLength(figure, edge);if(!cur)return;        
        const moveB=Math.hypot(clickX-b.x,clickY-b.y)<Math.hypot(clickX-a.x,clickY-a.y);
        const sf=newPx/cur;
        if(moveB){
            const dx=b.x-a.x,dy=b.y-a.y;b.x=a.x+dx*sf;b.y=a.y+dy*sf;
            if(edge.controlX !=null){edge.controlX =a.x+(edge.controlX -a.x)*sf;edge.controlY =a.y+(edge.controlY -a.y)*sf;}
            if(edge.control2X!=null){edge.control2X=a.x+(edge.control2X-a.x)*sf;edge.control2Y=a.y+(edge.control2Y-a.y)*sf;}
        }else{
            const dx=a.x-b.x,dy=a.y-b.y;a.x=b.x+dx*sf;a.y=b.y+dy*sf;
            if(edge.controlX !=null){edge.controlX =b.x+(edge.controlX -b.x)*sf;edge.controlY =b.y+(edge.controlY -b.y)*sf;}
            if(edge.control2X!=null){edge.control2X=b.x+(edge.control2X-b.x)*sf;edge.control2Y=b.y+(edge.control2Y-b.y)*sf;}
        }
    }

    // ===================== MOVER ARISTA / LADO =====================
    // preservando su forma relativa. Misma lógica usada en el arrastre de vértices.
    function edgeMoveAdjustNeighbor(fig, vi, oldPos, excludeEdge) {
        fig.edges.forEach(e => {
            if (e === excludeEdge) return;
            if (e.controlX != null && (e.start === vi || e.end === vi)) {
                const a = fig.vertices[e.start], b = fig.vertices[e.end];
                const oldA = e.start === vi ? oldPos : a;
                const oldB = e.end === vi ? oldPos : b;
                const denom = Math.hypot(oldB.x - oldA.x, oldB.y - oldA.y);
                if (denom > 0.01) {
                    // Misma transformación de semejanza (rotar+escalar según el desplazamiento
                    // del vértice) aplicada a cada punto de control que tenga la arista.
                    const applyToPoint = (px, py) => {
                        const tx = ((px - oldA.x) * (oldB.x - oldA.x) + (py - oldA.y) * (oldB.y - oldA.y)) / (denom * denom);
                        const ty = ((py - oldA.y) * (oldB.x - oldA.x) - (px - oldA.x) * (oldB.y - oldA.y)) / (denom * denom);
                        return { x: a.x + tx * (b.x - a.x) - ty * (b.y - a.y), y: a.y + tx * (b.y - a.y) + ty * (b.x - a.x) };
                    };
                    const p1 = applyToPoint(e.controlX, e.controlY);
                    e.controlX = p1.x; e.controlY = p1.y;
                    if (e.cubic && e.control2X != null) {
                        const p2 = applyToPoint(e.control2X, e.control2Y);
                        e.control2X = p2.x; e.control2Y = p2.y;
                    }
                }
            }
        });
    }

    function updateResizePanel(){
        const input=document.getElementById('resizeValue');
        const stretchBtn=document.getElementById('resizeStretchBtn');
        if(resizeEdges.length===1){
            selectedEdge=resizeEdges[0];
            const fig=figures[selectedEdge.figureIndex], edge=fig.edges[selectedEdge.edgeIndex];
            input.value=pxToCm(edgeLength(fig, edge));
            input.disabled=false;
            stretchBtn.style.display='inline-block';
            showPanel('resizeInputs');
        } else if(resizeEdges.length>1){
            selectedEdge=null;
            let totalPx = 0;
            resizeEdges.forEach(re => {
                const rfig = figures[re.figureIndex];
                if (rfig) totalPx += edgeLength(rfig, rfig.edges[re.edgeIndex]);
            });
            input.value=pxToCm(totalPx);
            input.disabled=true;
            document.getElementById('resizeIndicator').textContent='Cambiar longitud';
            stretchBtn.style.display='none';
            resizeStretchMode=false;
            stretchBtn.classList.remove('on');
            showPanel('resizeInputs');
        } else {
            selectedEdge=null;
            input.disabled=false;
            stretchBtn.style.display='none';
            resizeStretchMode=false;
            stretchBtn.classList.remove('on');
            hidePanel('resizeInputs');
        }
    }

    function applyResize(){
        if(resizeEdges.length!==1){showModal({title:'Error',body:'Selecciona solo una arista para aplicar un valor.',buttons:[{label:'OK'}]});return;}
        const se=resizeEdges[0];
        if(figures[se.figureIndex].locked) return;
        const newPx=cmToPx(document.getElementById('resizeValue').value);
        if(isNaN(newPx)||newPx<=0){showModal({title:'Valor invAlido',body:'Ej: 25.5 o 25,5',buttons:[{label:'OK'}]});return;}
        saveState();resizeEdge(se.figureIndex,se.edgeIndex,newPx,se.clickX,se.clickY);
        resizeEdges=[];
        hidePanel('resizeInputs');redrawAll();
    }

    function applyVertexDelta(){
        if(!selectedVertex){showModal({title:'Error',body:'Primero selecciona un vértice.',buttons:[{label:'OK'}]});return;}
        const dx=parseFloat(String(document.getElementById('vertexDX').value).replace(',','.'));
        const dy=parseFloat(String(document.getElementById('vertexDY').value).replace(',','.'));
        if(isNaN(dx)&&isNaN(dy)) return;
        saveState();
        const vfig=figures[selectedVertex.figureIndex];
        const v=vfig.vertices[selectedVertex.vertexIndex];
        // mueve el vértice conservando la forma de las curvas que lo tocan (y recalcula cadenas multipunto)
        moveVertexKeepShape(vfig, selectedVertex.vertexIndex, v.x+(isNaN(dx)?0:dx*PX_PER_CM), v.y+(isNaN(dy)?0:dy*PX_PER_CM));

        document.getElementById('vertexDX').value='';
        document.getElementById('vertexDY').value='';
        redrawAll();
    }


    // ===================== UNIR PUNTOS A MANO =====================
    // Alternativa al snap automático cuando hay muchos puntos juntos: se elige explícitamente
    // el punto a mover (1.º toque) y el punto al que se pega (2.º toque); ✓ lo aplica.
    // En Editar vértice solo se ven/eligen los puntos visibles (no los de curva interiores);
    // en Curvas se pueden elegir todos.
    function joinCanPick(fig, vi) {
        if (mode === 'curve') return true;
        return !isCurveInteriorVertex(fig, vi);
    }

    function joinPick(wx, wy, forSource) {
        const thr = 22 / viewScale;
        let best = null;
        for (let fi = 0; fi < figures.length; fi++) {
            const fig = figures[fi];
            if (forSource && fig.locked) continue;
            for (let vi = 0; vi < fig.vertices.length; vi++) {
                if (!joinCanPick(fig, vi)) continue;
                const v = fig.vertices[vi], d = Math.hypot(v.x - wx, v.y - wy);
                if (d < thr && (!best || d < best.d)) best = {fi, vi, d};
            }
        }
        return best ? {fi: best.fi, vi: best.vi} : null;
    }

    function joinSync() {
        document.querySelectorAll('.joinBtn').forEach(b => b.classList.toggle('on', joinActive));
        document.querySelectorAll('.joinOk').forEach(b => b.style.display = joinActive ? 'inline-flex' : 'none');
    }

    function joinReset() { joinActive = false; joinSrc = null; joinDst = null; joinSync(); }

    function toggleJoin() {
        joinActive = !joinActive;
        joinSrc = null; joinDst = null; dragData = null;
        if (joinActive) {
            // las demás subfunciones de vértice/curva se apagan (excluyentes)
            vertexAddActive = false; vertexDelActive = false;
            ['vertexAddBtn','vertexDelBtn'].forEach(id => document.getElementById(id).classList.remove('on'));
            document.getElementById('vertexAddButtons').style.display = 'none';
            if (typeof curveMultiActive !== 'undefined' && curveMultiActive) toggleCurveMulti();
            if (typeof curveDrawActive !== 'undefined' && curveDrawActive) endCurveDraw();
            showActiveLabel('Unir: toca el punto a mover');
        }
        joinSync();
        redrawAll();
    }

    function joinHandleTap(wx, wy) {
        if (!joinSrc) {
            const p = joinPick(wx, wy, true);
            if (p) { joinSrc = p; joinDst = null; showActiveLabel('Unir: ahora toca el punto destino'); }
        } else {
            const p = joinPick(wx, wy, false);
            if (p && p.fi === joinSrc.fi && p.vi === joinSrc.vi) { joinSrc = null; joinDst = null; showActiveLabel('Unir: toca el punto a mover'); }
            else if (p) { joinDst = p; showActiveLabel('Unir: ✓ para pegar'); }
        }
        redrawAll();
    }

    // Ajusta un valor de control de una arista de curva simple cuando sus extremos cambian
    // (mismo marco local que el arrastre de vértice): la forma se mantiene proporcional.
    function joinMapCtrl(cx, cy, oa, ob, a, b) {
        const denom = Math.hypot(ob.x-oa.x, ob.y-oa.y);
        if (denom < 0.01) return {x:cx, y:cy};
        const tx = ((cx-oa.x)*(ob.x-oa.x) + (cy-oa.y)*(ob.y-oa.y)) / (denom*denom);
        const ty = ((cy-oa.y)*(ob.x-oa.x) - (cx-oa.x)*(ob.y-oa.y)) / (denom*denom);
        return {x: a.x + tx*(b.x-a.x) - ty*(b.y-a.y), y: a.y + tx*(b.y-a.y) + ty*(b.x-a.x)};
    }

    // Cadena multipunto: si se mueve una de sus PUNTAS (vértice duro), los puntos de curva interiores
    // la acompañan de forma proporcional (giro + escala respecto a la otra punta), igual que el punto de
    // control de la curva normal; después la cadena se recalcula. Mover un punto interior no los afecta.
    function shiftChainInterior(fig, chain, vi, oldPos, newPos) {
        if (!chain || chain.length < 2) return;
        const first = fig.edges[chain[0]].start, last = fig.edges[chain[chain.length-1]].end;
        if (first === last) return;
        let far = null;
        if (vi === first) far = fig.vertices[last]; else if (vi === last) far = fig.vertices[first]; else return;
        const fixed = {x: far.x, y: far.y};
        for (let k = 0; k < chain.length-1; k++) {
            const ivi = fig.edges[chain[k]].end;
            if (ivi === vi) continue;
            const p = fig.vertices[ivi];
            const m = joinMapCtrl(p.x, p.y, fixed, oldPos, fixed, newPos);
            p.x = m.x; p.y = m.y;
        }
    }

    function moveVertexKeepShape(fig, vi, nx, ny) {
        const old = {x: fig.vertices[vi].x, y: fig.vertices[vi].y};
        fig.vertices[vi].x = nx; fig.vertices[vi].y = ny;
        const newPos = {x: nx, y: ny};
        const done = new Set();
        fig.edges.forEach((e, ei) => {
            if (e.start !== vi && e.end !== vi) return;
            const hasCtl = e.controlX != null;
            if (e.cubic && e.control2X != null) {
                const chain = getCurveChain(fig, ei);
                if (chain.length > 1) {                       // curva multipunto: se recalcula entera
                    const key = chain.join(',');
                    if (!done.has(key)) { done.add(key); shiftChainInterior(fig, chain, vi, old, newPos); recomputeCurveChain(fig, chain); }
                    return;
                }
            }
            if (!hasCtl) return;
            const a = fig.vertices[e.start], b = fig.vertices[e.end];
            const oa = e.start === vi ? old : a, ob = e.end === vi ? old : b;
            const c1 = joinMapCtrl(e.controlX, e.controlY, oa, ob, a, b);
            e.controlX = c1.x; e.controlY = c1.y;
            if (e.control2X != null) {
                const c2 = joinMapCtrl(e.control2X, e.control2Y, oa, ob, a, b);
                e.control2X = c2.x; e.control2Y = c2.y;
            }
        });
    }

    function applyJoin() {
        if (!joinActive) return;
        if (!joinSrc || !joinDst) {
            showModal({title:'Unir', body:'Toca primero el punto que se va a mover y luego el punto al que se pega.', buttons:[{label:'OK'}]});
            return;
        }
        const sf = figures[joinSrc.fi], df = figures[joinDst.fi];
        const sv = sf && sf.vertices[joinSrc.vi], dv = df && df.vertices[joinDst.vi];
        if (!sv || !dv) { joinSrc = null; joinDst = null; redrawAll(); return; }
        saveState();
        moveVertexKeepShape(sf, joinSrc.vi, dv.x, dv.y);
        joinSrc = null; joinDst = null;
        showActiveLabel('Unir: toca el punto a mover');
        redrawAll();
    }

    function drawJoinPreview() {
        if (!joinActive) return;
        // En Curvas no hay otra capa que dibuje los puntos: se muestran todos los elegibles
        // (en Editar vértice ya los dibuja drawAllVertices)
        if (mode === 'curve') drawAllVertices();
        const dark = document.body.classList.contains('dark');
        const cs = dark ? '#ffb74d' : '#e65100', cd = dark ? '#4dffa6' : '#00897b';
        const ring = (v, col) => {
            ctx.save(); ctx.beginPath(); ctx.arc(v.x, v.y, 8/viewScale, 0, Math.PI*2);
            ctx.lineWidth = 2/viewScale; ctx.strokeStyle = col; ctx.stroke(); ctx.restore();
        };
        const sv = joinSrc && figures[joinSrc.fi] && figures[joinSrc.fi].vertices[joinSrc.vi];
        const dv = joinDst && figures[joinDst.fi] && figures[joinDst.fi].vertices[joinDst.vi];
        if (sv) ring(sv, cs);
        if (dv) ring(dv, cd);
        if (sv && dv) {
            ctx.save(); ctx.setLineDash([5/viewScale, 4/viewScale]); ctx.lineWidth = 1.5/viewScale; ctx.strokeStyle = cd;
            ctx.beginPath(); ctx.moveTo(sv.x, sv.y); ctx.lineTo(dv.x, dv.y); ctx.stroke(); ctx.restore();
        }
    }
