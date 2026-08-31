// PocketCAD - módulo: events
// Generado a partir de la división del archivo monolítico original.

    function getPos(e){
        const r=canvas.getBoundingClientRect();
        const sx=(e.clientX!==undefined?e.clientX:(e.touches&&e.touches[0].clientX))-r.left;
        const sy=(e.clientY!==undefined?e.clientY:(e.touches&&e.touches[0].clientY))-r.top;
        return{sx,sy,...screenToWorld(sx,sy)};
    }

    function handleTouchStart(e){
        if(e.touches.length===1){
            e.preventDefault();
            if(mode==='none') return;
            const pos=getPos(e);
            const now=Date.now();
            if(now-lastTouchTime<300){applyZoom(-1,pos.sx,pos.sy);lastTouchTime=0;return;}
            lastTouchTime=now;
            handlePointerDown(pos);
        } else if(e.touches.length===2){
            pinchStartDist=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
            pinchStartScale=viewScale;dragData=null;pinchLastCx=null;pinchLastCy=null;
        }
    }

    function handleTouchMove(e){
    if(e.touches.length===2&&pinchStartDist!==null){
        e.preventDefault();
        const dist=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
        const cx=(e.touches[0].clientX+e.touches[1].clientX)/2,cy=(e.touches[0].clientY+e.touches[1].clientY)/2;
        const r=canvas.getBoundingClientRect();
        const ns=Math.min(10,Math.max(0.01,pinchStartScale*(dist/pinchStartDist)));
        viewOffX=(cx-r.left)-(cx-r.left-viewOffX)*(ns/viewScale);
        viewOffY=(cy-r.top )-(cy-r.top -viewOffY)*(ns/viewScale);
        viewScale=ns;
        if(pinchLastCx!==null){
            viewOffX+=(cx-r.left)-pinchLastCx;
            viewOffY+=(cy-r.top)-pinchLastCy;
        }
        pinchLastCx=(cx-r.left); pinchLastCy=(cy-r.top);
        updateZoomIndicator();redrawAll();
    } else if(e.touches.length===1){
        e.preventDefault();
        if(mode==='line' && dragData && dragData.type==='line'){
            const pos=getPos(e);
            dragData.currentPoint = {x: pos.x, y: pos.y};
            redrawAll();
            const dpr=window.devicePixelRatio||1;
            ctx.save();
            ctx.setTransform(dpr*viewScale,0,0,dpr*viewScale,dpr*viewOffX,dpr*viewOffY);
            ctx.beginPath(); 
            ctx.moveTo(lineStartPoint.x, lineStartPoint.y); 
            ctx.lineTo(pos.x, pos.y);
            ctx.strokeStyle=getStrokeColor(); 
            ctx.setLineDash([]); 
            ctx.lineWidth=2/viewScale; 
            ctx.stroke();
            ctx.restore();
        } else if(dragData||curveActiveDrag){
            handlePointerMove(getPos(e));
        }
    }
}

    function handleTouchEnd(e){
    if(e.touches.length<2){pinchStartDist=null;pinchLastCx=null;pinchLastCy=null;}
    if(e.touches.length===0){
        if(mode==='line' && dragData && dragData.type==='line'){
            const lastTouch = e.changedTouches[0];
            const r = canvas.getBoundingClientRect();
            const sx = lastTouch.clientX - r.left, sy = lastTouch.clientY - r.top;
            const wp = screenToWorld(sx, sy);
            let end = {x: wp.x, y: wp.y};
            if(snapEnabled) end = applySnap(end.x, end.y, -1, -1);
            if(lineStartPoint && Math.hypot(end.x-lineStartPoint.x, end.y-lineStartPoint.y) > 2/viewScale){
                saveState();
                figures.push(createLine(lineStartPoint, end));
            }
            lineStartPoint = null;
            dragData = null;
            redrawAll();
            return;
        }
        dragData=null; curveActiveDrag=null;
    }
}

    function handleMouseDown(e){
        e.preventDefault();
        const pos=getPos(e);
        if(e.button===1||e.button===2||(e.button===0&&e.altKey)){
            isPanning=true; panStart={x:pos.x,y:pos.y}; return;
        }
        handlePointerDown(pos);
    }

    function handleMouseMove(e){
        e.preventDefault();
        if(isPanning){
            const r=canvas.getBoundingClientRect();
            const sx=e.clientX-r.left,sy=e.clientY-r.top;
            const wp=screenToWorld(sx,sy);
            viewOffX+=( wp.x - panStart.x)*viewScale;
            viewOffY+=( wp.y - panStart.y)*viewScale;
            redrawAll();return;
        }
        handlePointerMove(getPos(e));
    }

    function handleMouseUp(e){
        e.preventDefault();
        isPanning=false;
        if(mode==='line' && dragData && dragData.type==='line'){
            const pos=getPos(e);
            let end = {x: pos.x, y: pos.y};
            if(snapEnabled) end = applySnap(end.x, end.y, -1, -1);
            if(lineStartPoint && Math.hypot(end.x-lineStartPoint.x, end.y-lineStartPoint.y) > 2/viewScale){
                saveState();
                figures.push(createLine(lineStartPoint, end));
            }
            lineStartPoint = null;
            dragData = null;
            redrawAll();
            return;
        }
        dragData=null;
        curveActiveDrag=null;
    }

    function handleMouseLeave(e){
        isPanning=false;
        dragData=null;
        curveActiveDrag=null;
    }

    function handlePointerDown(pos){
        const wx=pos.x,wy=pos.y;

        // findClickedFigure/findNearestVertex/findNearestEdge ya excluyen figuras bloqueadas
        // por defecto, así que cada modo de edición naturalmente "atraviesa" lo bloqueado y
        // permite interactuar con lo que esté debajo (líneas o figuras sin bloquear).

        if(mode==='create'){
            pendingCreatePos = {x: wx, y: wy};
            applyCreatePolygon();
        }
        else if(mode==='line'){
            let start = {x: wx, y: wy};
            if (snapEnabled) start = applySnap(wx, wy, -1, -1);
            lineStartPoint = start;
            dragData = {type: 'line', currentPoint: {x: start.x, y: start.y}};
            redrawAll();
        }
        else if(mode==='grain'){
            const fi=findClickedFigure(wx,wy);
            if(fi!==-1 && figures[fi].closed){
                saveState();
                figures[fi].grain = (figures[fi].grain === grainDir) ? null : grainDir;
                redrawAll();
            }
        }

        else if(mode==='move'){
            const fi=findClickedFigure(wx,wy);
            if(fi!==-1){
                saveState();
                const fig = figures.splice(fi,1)[0];
                figures.push(fig);
                const newIdx = figures.length-1;
                selectedFigureForMeasure = newIdx;       // <-- guarda la figura para medidas
                dragData={type:'figure',figureIndex:newIdx,startX:wx,startY:wy};
                redrawAll();                            // <-- dibuja las medidas ya
            }
        }



        else if(mode==='vertex'){
            const nv=findNearestVertex(wx,wy);
            if(nv){
                selectedVertex=nv;
                redrawAll();
                document.getElementById('vertexDX').value='';
                document.getElementById('vertexDY').value='';
                showPanel('vertexInputs');
                if(!vertexFijarActive){
                    saveState();
                    dragData={type:'vertex',figureIndex:nv.figureIndex,vertexIndex:nv.vertexIndex,lastX:figures[nv.figureIndex].vertices[nv.vertexIndex].x,lastY:figures[nv.figureIndex].vertices[nv.vertexIndex].y};
                } else {
                    redrawAll();
                }
            }
        }




        else if(mode==='addVertex'){
            const ne=findNearestEdge(wx,wy);
            if(ne){saveState();addVertexOnEdge(ne.figureIndex,ne.edgeIndex,wx,wy);redrawAll();}
        }

        else if(mode==='deleteVertex'){
            const nv = findNearestVertex(wx,wy);
            if(nv && !figures[nv.figureIndex].locked){
                saveState();
                deleteVertex(nv.figureIndex, nv.vertexIndex);                
                redrawAll();
            }
        }
//---------
        else if(mode==='curve'){
            // Midpoint drag: al presionar sobre una arista se activa el arrastre de curva
            const ne=findNearestEdge(wx,wy);
            if(ne){
                saveState();
                const edge=figures[ne.figureIndex].edges[ne.edgeIndex];
                // Inicializar controlX/Y en el punto donde se hizo clic (será el midpoint inicial)
                if(!edge.curved){
                    edge.curved=true; edge.cubic=false;
                    edge.controlX=wx; edge.controlY=wy;
                    edge.control2X=null; edge.control2Y=null;
                }
                curveActiveDrag={figureIndex:ne.figureIndex,edgeIndex:ne.edgeIndex};
                redrawAll();
            }
        }
        else if(mode==='straighten'){
            const ne=findNearestEdge(wx,wy);
            if(ne){const edge=figures[ne.figureIndex].edges[ne.edgeIndex];if(edge.curved){saveState();edge.curved=false;edge.cubic=false;edge.controlX=null;edge.controlY=null;edge.control2X=null;edge.control2Y=null;redrawAll();}}
        }
        else if(mode==='resize'){
            // Si el modo estirar manual está activo y hay exactamente una arista seleccionada,
            // un clic cerca de uno de sus vértices inicia el arrastre de estirado.
            if(resizeStretchMode && resizeEdges.length===1){
                const se=resizeEdges[0];
                const fig=figures[se.figureIndex];
                const edge=fig.edges[se.edgeIndex];
                const a=fig.vertices[edge.start], b=fig.vertices[edge.end];
                const dA=Math.hypot(wx-a.x,wy-a.y), dB=Math.hypot(wx-b.x,wy-b.y);
                const thr=20/viewScale;
                if(Math.min(dA,dB)<thr && !fig.locked){
                    const moveVi = dA<dB ? edge.start : edge.end;
                    const anchorVi = dA<dB ? edge.end : edge.start;
                    const anchor = fig.vertices[anchorVi];
                    const origV = fig.vertices[moveVi];
                    const ddx=origV.x-anchor.x, ddy=origV.y-anchor.y;
                    const len=Math.hypot(ddx,ddy)||1;
                    const touching = [];
                    fig.edges.forEach(e=>{
                        if(e.start!==moveVi && e.end!==moveVi) return;
                        const eAnchorVi = e.start===moveVi ? e.end : e.start;
                        const eAnchor = fig.vertices[eAnchorVi];
                        touching.push({
                            ref:e,
                            anchor:{x:eAnchor.x,y:eAnchor.y},
                            controlX:e.controlX, controlY:e.controlY,
                            control2X:e.control2X, control2Y:e.control2Y
                        });
                    });
                    saveState();
                    dragData={type:'resizeStretch', figureIndex:se.figureIndex, vertexIndex:moveVi,
                        origVertex:{x:origV.x,y:origV.y},
                        stretchAnchor:{x:anchor.x,y:anchor.y}, stretchDir:{x:ddx/len,y:ddy/len},
                        touching};
                    redrawAll();
                    return;
                }
            }
            const ne=findNearestEdge(wx,wy,true);
            if(ne){
                const idx=resizeEdges.findIndex(o=>o.figureIndex===ne.figureIndex&&o.edgeIndex===ne.edgeIndex);
                if(idx>=0){
                    resizeEdges.splice(idx,1);
                } else {
                    resizeEdges.push({figureIndex:ne.figureIndex, edgeIndex:ne.edgeIndex, clickX:wx, clickY:wy});
                }
                updateResizePanel();
                redrawAll();
            }
        }

        else if(mode==='edgeMove'){
            const ne=findNearestEdge(wx,wy);
            if(ne && !figures[ne.figureIndex].locked){
                saveState();
                selectedEdgeMoveForMeasure = {figureIndex:ne.figureIndex, edgeIndex:ne.edgeIndex}; // <-- guarda
                dragData={type:'edgeMove', figureIndex:ne.figureIndex, edgeIndex:ne.edgeIndex, startX:wx, startY:wy};
                redrawAll();
            }
        }      

        else if(mode==='offset'){
            if(offsetDistMode && offsetEdges.length>0){
                const thr=15/viewScale;
                let matched=null;
                offsetEdges.forEach(o=>{
                    if(matched) return;
                    const efig=figures[o.figureIndex];
                    const edge=efig.edges[o.edgeIndex];
                    if(edgeDist(wx,wy,efig,edge)<thr) matched=o;
                });
                if(matched){
                    const key=matched.figureIndex+'_'+matched.edgeIndex;
                    if(offsetDistAvgArmed){
                        if(offsetEdgeDist[key]==='avg') delete offsetEdgeDist[key];
                        else offsetEdgeDist[key]='avg';
                    } else {
                        const curCm = parseFloat(document.getElementById('offsetValue').value.replace(',','.'));
                        if(!isNaN(curCm) && curCm>0){
                            const curPx = curCm*PX_PER_CM;
                            const existing = offsetEdgeDist[key];
                            if(typeof existing==='number' && Math.abs(existing-curPx) < 0.01) delete offsetEdgeDist[key];
                            else offsetEdgeDist[key]=curPx;
                        }
                    }
                    redrawAll();
                    return;
                }
            }
            if(offsetDirMode && offsetEdges.length>0){
                const nv=findNearestVertex(wx,wy);
                if(nv && nv.figureIndex===offsetEdges[0].figureIndex){
                    const belongsToSelection = offsetEdges.some(o=>{
                        const e=figures[nv.figureIndex].edges[o.edgeIndex];
                        return e.start===nv.vertexIndex || e.end===nv.vertexIndex;
                    });
                    if(belongsToSelection){
                        const key=nv.figureIndex+'_'+nv.vertexIndex;
                        if(offsetArmedAxis===null) delete offsetVertexAxis[key];
                        else if(offsetVertexAxis[key]===offsetArmedAxis) delete offsetVertexAxis[key];
                        else offsetVertexAxis[key]=offsetArmedAxis;
                        redrawAll();
                        return;
                    }
                }
            }
            const ne=findNearestEdge(wx,wy);
            if(ne){
                const fig=figures[ne.figureIndex];
                if(!fig.closed) return;
                if(offsetEdges.length>0 && offsetEdges[0].figureIndex !== ne.figureIndex){
                    showModal({title:'Aviso',body:'Solo puedes seleccionar lados de la misma figura.',buttons:[{label:'OK'}]});
                    return;
                }
                const idx=offsetEdges.findIndex(o=>o.figureIndex===ne.figureIndex&&o.edgeIndex===ne.edgeIndex);
                if(idx>=0) offsetEdges.splice(idx,1);
                else {
                    if(offsetEdges.length===0) createOffsetRef(ne.figureIndex);
                    offsetEdges.push({figureIndex:ne.figureIndex, edgeIndex:ne.edgeIndex});
                }
                if(offsetEdges.length>0) showPanel('offsetInputs');
                else { hidePanel('offsetInputs'); discardOffsetRef(); }
                redrawAll();
            }
        }

        else if(mode==='cut'){
            // Seleccionar/deseleccionar solo líneas (no cerradas) como líneas de corte
            for(let fi=figures.length-1;fi>=0;fi--){
                const fig=figures[fi];
                if(fig.closed) continue; // solo líneas abiertas
                let near=false;
                for(const e of fig.edges){
                    if(edgeDist(wx,wy,fig,e)<15/viewScale){near=true;break;}
                }
                if(near){
                    const idx=cutLineIndices.indexOf(fi);
                    if(idx>=0) cutLineIndices.splice(idx,1);
                    else cutLineIndices.push(fi);
                    redrawAll();
                    return;
                }
            }
        }
        else if(mode==='closeShape'){
            // Seleccionar/deseleccionar líneas abiertas para cerrar figura
            for(let fi=figures.length-1;fi>=0;fi--){
                const fig=figures[fi];
                if(fig.closed) continue;
                let near=false;
                for(const e of fig.edges){
                    if(edgeDist(wx,wy,fig,e)<15/viewScale){near=true;break;}
                }
                if(near){
                    const idx=closeLineIndices.indexOf(fi);
                    if(idx>=0) closeLineIndices.splice(idx,1);
                    else closeLineIndices.push(fi);
                    redrawAll();
                    return;
                }
            }
        }
        else if(mode==='rotate'){
            const fi=findClickedFigure(wx,wy);
            if(fi!==-1){
                saveState();
                rotateFigure(fi, parseFloat(document.getElementById('rotateInput').value)||180);
                rotateActiveFigure = fi;
                rotateStartAngle = 0;
                document.getElementById('rotateSlider').value = 0;
                redrawAll();
            }
        }
        else if(mode==='duplicate'){
            const fi=findClickedFigure(wx,wy);if(fi!==-1){saveState();duplicateFigure(fi);redrawAll();}
        }
        else if(mode==='reflect'){
            const fi=findClickedFigure(wx,wy);if(fi!==-1){saveState();reflectFigure(fi);redrawAll();}
        }
        else if(mode==='delete'){
            const fi=findClickedFigure(wx,wy);if(fi!==-1){saveState();figures.splice(fi,1);redrawAll();}
        }
        else if(mode==='lock'){
            const fi=findClickedFigure(wx,wy,true);
            if(fi!==-1){figures[fi].locked=!figures[fi].locked;redrawAll();}
        }
        else if(mode==='mirror'){
            const ne=findNearestEdge(wx,wy);if(ne){saveState();unfoldFigureInPlace(figures[ne.figureIndex],ne.edgeIndex);redrawAll();}
        }
    }

    function handlePointerMove(pos){
        const wx=pos.x,wy=pos.y;

        if(mode==='curve' && curveActiveDrag){
            const fig=figures[curveActiveDrag.figureIndex];
            const edge=fig.edges[curveActiveDrag.edgeIndex];
            const a=fig.vertices[edge.start], b=fig.vertices[edge.end];
            const cp = controlFromMidpoint(a, {x:wx,y:wy}, b);
            edge.curved=true; edge.cubic=false;
            edge.controlX=cp.x; edge.controlY=cp.y;
            edge.control2X=null; edge.control2Y=null;
            redrawAll();
            return;
        }

        if(mode==='line' && lineStartPoint) {
            if (dragData && dragData.type==='line') dragData.currentPoint = {x: wx, y: wy};
            redrawAll();
            const dpr=window.devicePixelRatio||1;
            ctx.save();
            ctx.setTransform(dpr*viewScale,0,0,dpr*viewScale,dpr*viewOffX,dpr*viewOffY);
            ctx.beginPath(); 
            ctx.moveTo(lineStartPoint.x, lineStartPoint.y); 
            ctx.lineTo(wx, wy);
            ctx.strokeStyle=getStrokeColor(); 
            ctx.setLineDash([]); 
            ctx.lineWidth=2/viewScale; 
            ctx.stroke();
            ctx.restore();
            return;
        }
        if(!dragData) return;

        if(dragData.type==='edgeMove'){
            const dx=wx-dragData.startX, dy=wy-dragData.startY;
            const fig=figures[dragData.figureIndex];
            const edge=fig.edges[dragData.edgeIndex];
            const v1=fig.vertices[edge.start], v2=fig.vertices[edge.end];
            const oldV1={x:v1.x,y:v1.y}, oldV2={x:v2.x,y:v2.y};
            v1.x+=dx; v1.y+=dy;
            v2.x+=dx; v2.y+=dy;
            if(edge.controlX!=null){edge.controlX+=dx; edge.controlY+=dy;}
            if(edge.control2X!=null){edge.control2X+=dx; edge.control2Y+=dy;}
            edgeMoveAdjustNeighbor(fig, edge.start, oldV1, edge);
            edgeMoveAdjustNeighbor(fig, edge.end, oldV2, edge);
            dragData.startX=wx; dragData.startY=wy;
            redrawAll();
        }

        else if(dragData.type==='figure'){
            const dx=wx-dragData.startX,dy=wy-dragData.startY;
            const f=figures[dragData.figureIndex];
            f.vertices.forEach(v=>{v.x+=dx;v.y+=dy;});
            f.edges.forEach(e=>{if(e.controlX!=null){e.controlX+=dx;e.controlY+=dy;}if(e.control2X!=null){e.control2X+=dx;e.control2Y+=dy;}});
            if (snapEnabled) {
                const thr = getSnapThreshold();

                // snap vértice a vértice
                for (let vi=0; vi<f.vertices.length; vi++) {
                    const v = f.vertices[vi];
                    for (let ofi=0; ofi<figures.length; ofi++) {
                        if (ofi === dragData.figureIndex) continue;
                        for (let ovi=0; ovi<figures[ofi].vertices.length; ovi++) {
                            const ov = figures[ofi].vertices[ovi];
                            if (Math.hypot(v.x-ov.x, v.y-ov.y) < thr) {
                                const offsetX = ov.x - v.x, offsetY = ov.y - v.y;
                                f.vertices.forEach(vert => {vert.x += offsetX; vert.y += offsetY;});
                                f.edges.forEach(e => {if(e.controlX!=null){e.controlX+=offsetX;e.controlY+=offsetY;}if(e.control2X!=null){e.control2X+=offsetX;e.control2Y+=offsetY;}});
                                dragData.startX = wx; dragData.startY = wy;
                                redrawAll(); return;
                            }
                        }
                    }
                }

                if (snapEdgeEnabled && !f.closed) {
                    let bestD1 = thr, bestOffX1 = 0, bestOffY1 = 0, snapped1 = false;
                    for (let vi=0; vi<f.vertices.length; vi++) {
                        const v = f.vertices[vi];
                        for (let ofi=0; ofi<figures.length; ofi++) {
                            if (ofi === dragData.figureIndex) continue;
                            const fig2 = figures[ofi];
                            for (let ei=0; ei<fig2.edges.length; ei++) {
                                const e = fig2.edges[ei];
                                const a = fig2.vertices[e.start], b = fig2.vertices[e.end];
                                const cl = closestOnLine(v.x, v.y, a.x, a.y, b.x, b.y);
                                const d = Math.hypot(v.x - cl.x, v.y - cl.y);
                                if (d < bestD1) {
                                    const dx2 = b.x-a.x, dy2 = b.y-a.y;
                                    const len = Math.hypot(dx2, dy2);
                                    if (len < 0.01) continue;
                                    const nx = -dy2/len, ny = dx2/len;
                                    const err = (v.x-cl.x)*nx + (v.y-cl.y)*ny;
                                    bestD1 = d; bestOffX1 = -err*nx; bestOffY1 = -err*ny; snapped1 = true;
                                }
                            }
                        }
                    }
                    if (snapped1) {
                        f.vertices.forEach(vert => {vert.x+=bestOffX1; vert.y+=bestOffY1;});
                        f.edges.forEach(e2 => {if(e2.controlX!=null){e2.controlX+=bestOffX1;e2.controlY+=bestOffY1;}if(e2.control2X!=null){e2.control2X+=bestOffX1;e2.control2Y+=bestOffY1;}});
                    }

                    let bestD2 = thr, bestOffX2 = 0, bestOffY2 = 0, snapped2 = false;
                    for (let ei=0; ei<f.edges.length; ei++) {
                        const e = f.edges[ei];
                        const a = f.vertices[e.start], b = f.vertices[e.end];
                        for (let ofi=0; ofi<figures.length; ofi++) {
                            if (ofi === dragData.figureIndex) continue;
                            const fig2 = figures[ofi];
                            for (let ovi=0; ovi<fig2.vertices.length; ovi++) {
                                const ov = fig2.vertices[ovi];
                                const cl = closestOnLine(ov.x, ov.y, a.x, a.y, b.x, b.y);
                                const d = Math.hypot(ov.x - cl.x, ov.y - cl.y);
                                if (d < bestD2) {
                                    const dx2 = b.x-a.x, dy2 = b.y-a.y;
                                    const len = Math.hypot(dx2, dy2);
                                    if (len < 0.01) continue;
                                    const nx = -dy2/len, ny = dx2/len;
                                    const err = (cl.x-ov.x)*nx + (cl.y-ov.y)*ny;
                                    bestD2 = d; bestOffX2 = -err*nx; bestOffY2 = -err*ny; snapped2 = true;
                                }
                            }
                        }
                    }
                    if (snapped2) {
                        f.vertices.forEach(vert => {vert.x+=bestOffX2; vert.y+=bestOffY2;});
                        f.edges.forEach(e2 => {if(e2.controlX!=null){e2.controlX+=bestOffX2;e2.controlY+=bestOffY2;}if(e2.control2X!=null){e2.control2X+=bestOffX2;e2.control2Y+=bestOffY2;}});
                    }

                    if (snapped1 || snapped2) {
                        dragData.startX=wx; dragData.startY=wy;
                        redrawAll(); return;
                    }
                }
            }
            dragData.startX=wx;dragData.startY=wy;redrawAll();
        }

        else if(dragData.type==='vertex'){
            let nx=wx,ny=wy;
            if(snapEnabled){const s=applySnap(wx,wy,dragData.figureIndex,dragData.vertexIndex);nx=s.x;ny=s.y;}
            const fig=figures[dragData.figureIndex];
            const vi=dragData.vertexIndex;
            fig.vertices[vi].x=nx; fig.vertices[vi].y=ny;
            fig.edges.forEach(e=>{
                if(e.controlX!=null){
                    const a=fig.vertices[e.start], b=fig.vertices[e.end];
                    const oldA=e.start===vi?{x:dragData.lastX??nx,y:dragData.lastY??ny}:a;
                    const oldB=e.end===vi  ?{x:dragData.lastX??nx,y:dragData.lastY??ny}:b;
                    const denom=Math.hypot(oldB.x-oldA.x,oldB.y-oldA.y);
                    if(denom>0.01){
                        const tx=((e.controlX-oldA.x)*(oldB.x-oldA.x)+(e.controlY-oldA.y)*(oldB.y-oldA.y))/(denom*denom);
                        const ty=((e.controlY-oldA.y)*(oldB.x-oldA.x)-(e.controlX-oldA.x)*(oldB.y-oldA.y))/(denom*denom);
                        e.controlX=a.x+tx*(b.x-a.x)-ty*(b.y-a.y);
                        e.controlY=a.y+tx*(b.y-a.y)+ty*(b.x-a.x);
                    }
                }
            });
            dragData.lastX=nx; dragData.lastY=ny;
            redrawAll(); if(snapEnabled) drawSnapGuides(nx,ny,dragData.figureIndex,dragData.vertexIndex);
        }

        else if(dragData.type==='resizeStretch'){
            const ax=dragData.stretchAnchor.x, ay=dragData.stretchAnchor.y;
            const dirX=dragData.stretchDir.x, dirY=dragData.stretchDir.y;
            const ddx=wx-ax, ddy=wy-ay;
            const proj=ddx*dirX+ddy*dirY;
            let nx=ax+dirX*proj, ny=ay+dirY*proj;
            if(snapEnabled){
                const thr=getSnapThreshold();
                let bestDist=thr, best=null;
                for(let fi2=0; fi2<figures.length; fi2++){
                    for(let vi2=0; vi2<figures[fi2].vertices.length; vi2++){
                        if(fi2===dragData.figureIndex && vi2===dragData.vertexIndex) continue;
                        const v=figures[fi2].vertices[vi2];
                        if(Math.abs(dirX) > 1e-6){
                            const t=(v.x-ax)/dirX, py=ay+dirY*t, d=Math.abs(v.x-nx);
                            if(d<bestDist){ bestDist=d; best={x:v.x,y:py}; }
                        }
                        if(Math.abs(dirY) > 1e-6){
                            const t=(v.y-ay)/dirY, px=ax+dirX*t, d=Math.abs(v.y-ny);
                            if(d<bestDist){ bestDist=d; best={x:px,y:v.y}; }
                        }
                    }
                }
                if(best){ nx=best.x; ny=best.y; }
            }
            const fig=figures[dragData.figureIndex];
            const vi=dragData.vertexIndex;
            // Recalcular siempre desde la posición ORIGINAL (al iniciar el arrastre), usando el
            // ancla propia de cada arista tocada, para que la forma no se traslade ni se distorsione
            // por errores acumulados de frame a frame.
            dragData.touching.forEach(rec=>{
                const anchor = rec.anchor;
                const curLen = Math.hypot(dragData.origVertex.x-anchor.x, dragData.origVertex.y-anchor.y) || 1;
                const newLen = Math.hypot(nx-anchor.x, ny-anchor.y) || 1;
                const sf = newLen/curLen;
                if(rec.controlX!=null){ rec.ref.controlX = anchor.x+(rec.controlX-anchor.x)*sf; rec.ref.controlY = anchor.y+(rec.controlY-anchor.y)*sf; }
                if(rec.control2X!=null){ rec.ref.control2X = anchor.x+(rec.control2X-anchor.x)*sf; rec.ref.control2Y = anchor.y+(rec.control2Y-anchor.y)*sf; }
            });
            fig.vertices[vi].x=nx; fig.vertices[vi].y=ny;
            redrawAll(); if(snapEnabled) drawSnapGuides(nx,ny,dragData.figureIndex,dragData.vertexIndex);
        }
}
