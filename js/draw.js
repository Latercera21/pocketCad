// PocketCAD - módulo: draw
// Generado a partir de la división del archivo monolítico original.

    function getStrokeColor() {
        return document.body.classList.contains('dark') ? '#eee' : '#000';
    }

    function getMeasureTextColor() {
        return document.body.classList.contains('dark') ? '#e8e8e8' : '#444';
    }

    function getLockedColor() {
        return document.body.classList.contains('dark') ? '#ff6b6b' : '#8e0000';
    }

    function getResizeHighlightColor() {
        return document.body.classList.contains('dark') ? '#e8b34d' : '#7e582a';
    }

    function getCloseShapeColor() {
        return document.body.classList.contains('dark') ? '#c084f5' : '#6a1b9a';
    }

    function drawSnapGuides(x, y, exFi, exVi) {
        ctx.save();
        ctx.strokeStyle= document.body.classList.contains('dark') ? '#7fd9ff' : '#000369';
        ctx.lineWidth=1/viewScale;
        ctx.setLineDash([2/viewScale,2/viewScale]);
        for (let fi=0; fi<figures.length; fi++)
            for (let vi=0; vi<figures[fi].vertices.length; vi++) {
                if (fi===exFi && vi===exVi) continue;
                const v=figures[fi].vertices[vi];
                if (Math.abs(y-v.y)<getSnapThreshold()) { ctx.beginPath();ctx.moveTo(-1e6,v.y);ctx.lineTo(1e6,v.y);ctx.stroke(); }
                if (Math.abs(x-v.x)<getSnapThreshold()) { ctx.beginPath();ctx.moveTo(v.x,-1e6);ctx.lineTo(v.x,1e6);ctx.stroke(); }
            }
        ctx.restore();
    }

    // Tamaño base de la fuente de medidas: un poco más grande solo en celular (touch),
    function getMeasureFontSize() {
        return (isTouchDevice ? 12 : 10.5) / viewScale;
    }

    // Etiqueta fina de medida (cm) junto a una arista, sea recta o curva, abierta o cerrada.
    function drawEdgeLengthLabel(fig, edge) {
        if (!fig || !edge) return;
        const { mx, my, nx, ny } = edgeMidAndNormal(fig, edge);
        const off = 13 / viewScale;
        const lx = mx + nx * off, ly = my + ny * off;
        const lenCm = pxToCm(edgeLength(fig, edge));
        const text = lenCm.toFixed(1) + ' cm';
        ctx.save();
        ctx.font = getMeasureFontSize() + 'px sans-serif';
        ctx.fillStyle = getMeasureTextColor();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.globalAlpha = 0.9;
        ctx.fillText(text, lx, ly);
        ctx.restore();
    }

    // Etiqueta de medida (cm) para un segmento genérico definido por dos puntos sueltos
    // (usada mientras se dibuja una línea nueva, antes de que exista una figura/arista real).
    function drawLengthLabelForPoints(p0, p1) {
        if (!p0 || !p1) return;
        const mx = (p0.x + p1.x) / 2, my = (p0.y + p1.y) / 2;
        const dx = p1.x - p0.x, dy = p1.y - p0.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len, ny = dx / len;
        const off = 13 / viewScale;
        const lx = mx + nx * off, ly = my + ny * off;
        const lenCm = pxToCm(len);
        const text = lenCm.toFixed(1) + ' cm';
        ctx.save();
        ctx.font = getMeasureFontSize() + 'px sans-serif';
        ctx.fillStyle = getMeasureTextColor();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.globalAlpha = 0.9;
        ctx.fillText(text, lx, ly);
        ctx.restore();
    }

    // Puntos (vértices visuales) del inicio y del extremo actual mientras se dibuja una línea nueva.
    function drawLineDrawingVertices() {
        const r = 2 / viewScale;
        function dot(p) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, r, 0, Math.PI*2);
            ctx.fillStyle = '#0005a1';
            ctx.fill();
            ctx.strokeStyle = '#0005a1';
            ctx.lineWidth = 2/viewScale;
            ctx.stroke();
        }
        if (lineStartPoint) dot(lineStartPoint);
        if (dragData && dragData.type==='line' && dragData.currentPoint) dot(dragData.currentPoint);
    }

    // ===================== DIBUJO =====================
    function redrawAll(){
        const dpr = window.devicePixelRatio || 1;
        ctx.setTransform(1,0,0,1,0,0);
        ctx.clearRect(0,0,canvas.width,canvas.height);
        ctx.setTransform(dpr*viewScale,0,0,dpr*viewScale,dpr*viewOffX,dpr*viewOffY);
        figures.forEach((fig,fi)=>{
            drawFigure(fig,fi);
            if(fig.grain && fig.closed) drawGrainArrow(fig);
        });
        if(mode==='resize'&&selectedEdge) drawResizeIndicator();
        if(mode==='vertex' || mode==='addVertex' || mode==='deleteVertex') drawAllVertices();

        // Resaltar líneas de corte seleccionadas
        if(mode==='cut') {
            cutLineIndices.forEach(li => {
                const line = figures[li];
                if (line) {
                    ctx.save();
                    ctx.strokeStyle = '#b30000'; 
                    ctx.lineWidth = 2/viewScale;
                    ctx.setLineDash([2/viewScale, 2/viewScale]);
                    line.edges.forEach(e => {
                        const a = line.vertices[e.start], b = line.vertices[e.end];
                        ctx.beginPath(); ctx.moveTo(a.x,a.y);
                        if(e.cubic&&e.control2X!=null) ctx.bezierCurveTo(e.controlX,e.controlY,e.control2X,e.control2Y,b.x,b.y);
                        else if(e.curved&&e.controlX!=null) ctx.quadraticCurveTo(e.controlX,e.controlY,b.x,b.y);
                        else ctx.lineTo(b.x,b.y);
                        ctx.stroke();
                    });
                    ctx.restore();
                }
            });
        }
        // Resaltar lineas para cerrar figura
        if(mode==='closeShape') {
            closeLineIndices.forEach(li => {
                const line = figures[li];
                if (line) {
                    ctx.save();
                    ctx.strokeStyle = getCloseShapeColor(); ctx.lineWidth = 2/viewScale;
                    ctx.setLineDash([2/viewScale, 2/viewScale]);
                    line.edges.forEach(e => {
                        const a = line.vertices[e.start], b = line.vertices[e.end];
                        ctx.beginPath(); ctx.moveTo(a.x,a.y);
                        if(e.curved&&e.controlX!=null) ctx.quadraticCurveTo(e.controlX,e.controlY,b.x,b.y);
                        else ctx.lineTo(b.x,b.y);
                        ctx.stroke();
                    });
                    ctx.restore();
                }
            });
        }
        if(mode==='offset') {
            offsetEdges.forEach(oe => {
                const fig=figures[oe.figureIndex];
                if(!fig) return;
                const e=fig.edges[oe.edgeIndex];
                const a=fig.vertices[e.start], b=fig.vertices[e.end];
                ctx.save();
                ctx.strokeStyle='#00b006'; ctx.lineWidth=2/viewScale;
                ctx.setLineDash([2/viewScale,2/viewScale]);
                ctx.beginPath(); ctx.moveTo(a.x,a.y);
                if(e.cubic&&e.control2X!=null) ctx.bezierCurveTo(e.controlX,e.controlY,e.control2X,e.control2Y,b.x,b.y);
                else if(e.curved&&e.controlX!=null) ctx.quadraticCurveTo(e.controlX,e.controlY,b.x,b.y);
                else ctx.lineTo(b.x,b.y);
                ctx.stroke();
                ctx.restore();
            });
            Object.keys(offsetVertexAxis).forEach(key=>{
                const [ofi,ovi]=key.split('_').map(Number);
                const v=figures[ofi]&&figures[ofi].vertices[ovi];
                const ov=offsetVertexAxis[key];
                if(!v) return;
                const color = ov==='x' ? '#e67e22' : '#2980b9';
                const fs = 14/viewScale;
                const ly = v.y-13/viewScale;
                ctx.save();
                ctx.fillStyle = color; ctx.globalAlpha = 0.22;
                ctx.beginPath(); ctx.arc(v.x, ly, fs*0.62, 0, Math.PI*2); ctx.fill();
                ctx.globalAlpha = 1;
                ctx.fillStyle = color;
                ctx.font = 'bold ' + fs + 'px sans-serif';
                ctx.textAlign='center'; ctx.textBaseline='middle';
                ctx.fillText(ov.toUpperCase(), v.x, ly);
                ctx.restore();
            });
            Object.keys(offsetEdgeDist).forEach(key=>{
                const [ofi,oei]=key.split('_').map(Number);
                const ofig=figures[ofi];
                const e=ofig&&ofig.edges[oei];
                if(!e) return;
                const {mx,my}=edgeMidAndNormal(ofig, e);
                ctx.save();
                ctx.fillStyle = '#8e44ad';
                ctx.font = 'bold ' + (13/viewScale) + 'px sans-serif';
                ctx.textAlign='center'; ctx.textBaseline='middle';
                const label = offsetEdgeDist[key]==='avg' ? '≈' : (pxToCm(offsetEdgeDist[key]).toFixed(1)+'cm');
                ctx.fillText(label, mx, my);
                ctx.restore();
            });
        }
        // Resaltar aristas seleccionadas en modo cambiar longitud (multi-selección)
        if(mode==='resize') {
            resizeEdges.forEach(re => {
                const fig=figures[re.figureIndex];
                if(!fig) return;
                const e=fig.edges[re.edgeIndex];
                const a=fig.vertices[e.start], b=fig.vertices[e.end];
                ctx.save();
                ctx.strokeStyle= getResizeHighlightColor(); 
                ctx.lineWidth=2/viewScale;             
                ctx.beginPath(); 
                ctx.moveTo(a.x,a.y);
                if(e.cubic&&e.control2X!=null) 
                ctx.bezierCurveTo(e.controlX,e.controlY,e.control2X,e.control2Y,b.x,b.y);
                else if(e.curved&&e.controlX!=null) ctx.quadraticCurveTo(e.controlX,e.controlY,b.x,b.y);
                else ctx.lineTo(b.x,b.y);
                ctx.stroke();
                ctx.restore();
            });
        }

        // ===== Medidas finas de arista(s) tocada(s) / afectada(s) =====
        // 1) Modo vértice: medir solo las aristas que llegan al vértice activo (seleccionado o en arrastre)
        if (mode==='vertex') {
            const activeVert = (dragData && dragData.type==='vertex')
                ? {figureIndex: dragData.figureIndex, vertexIndex: dragData.vertexIndex}
                : selectedVertex;
            if (activeVert && figures[activeVert.figureIndex]) {
                const vfig = figures[activeVert.figureIndex];
                vfig.edges.forEach(e => {
                    if (e.start===activeVert.vertexIndex || e.end===activeVert.vertexIndex) {
                        drawEdgeLengthLabel(vfig, e);
                    }
                });
            }
        }

        // 2) Modo resize: las aristas seleccionadas (una o varias) + suma total si hay más de una
        if (mode==='resize' && resizeEdges.length>0) {
            let totalPx = 0;
            resizeEdges.forEach(re => {
                const rfig = figures[re.figureIndex];
                if (rfig) {
                    const edge = rfig.edges[re.edgeIndex];
                    drawEdgeLengthLabel(rfig, edge);
                    totalPx += edgeLength(rfig, edge);
                }
            });
            if (resizeEdges.length > 1) drawResizeSumLabel(totalPx);
        }
        // 3) Modo curva: la arista que se está curvando
        if (mode==='curve' && curveActiveDrag && figures[curveActiveDrag.figureIndex]) {
            drawEdgeLengthLabel(figures[curveActiveDrag.figureIndex], figures[curveActiveDrag.figureIndex].edges[curveActiveDrag.edgeIndex]);
        }
        // 4) Modo offset: las aristas seleccionadas
        if (mode==='offset') {
            offsetEdges.forEach(oe => {
                const ofig = figures[oe.figureIndex];
                if (ofig) drawEdgeLengthLabel(ofig, ofig.edges[oe.edgeIndex]);
            });
        }
        // 5) Modo cortar: las líneas de corte seleccionadas (todas sus aristas)
        if (mode==='cut') {
            cutLineIndices.forEach(li => {
                const lfig = figures[li];
                if (lfig) lfig.edges.forEach(e => drawEdgeLengthLabel(lfig, e));
            });
        }
        // 6) Modo cerrar figura: las líneas seleccionadas
        if (mode==='closeShape') {
            closeLineIndices.forEach(li => {
                const lfig = figures[li];
                if (lfig) lfig.edges.forEach(e => drawEdgeLengthLabel(lfig, e));
            });
        }
        // 7) Modo línea: puntos de inicio/actual + medida mientras se arrastra para crear una línea nueva
        if (mode==='line' && lineStartPoint) {
            drawLineDrawingVertices();
            if (dragData && dragData.type==='line' && dragData.currentPoint) {
                drawLengthLabelForPoints(lineStartPoint, dragData.currentPoint);
            }
        }

        // 9) Modo mover arista: medida de la arista seleccionada o en arrastre
        if (mode==='edgeMove') {
            const target = (dragData && dragData.type==='edgeMove')
                ? dragData
                : selectedEdgeMoveForMeasure;
            if (target && figures[target.figureIndex]) {
                const efig = figures[target.figureIndex];
                drawEdgeLengthLabel(efig, efig.edges[target.edgeIndex]);
            }
        }

        // 10) Modo mover figura: todas las aristas de la figura seleccionada
        if (mode==='move' && selectedFigureForMeasure !== null && figures[selectedFigureForMeasure]) {
            const mfig = figures[selectedFigureForMeasure];
            mfig.edges.forEach(e => drawEdgeLengthLabel(mfig, e));
        }
        autoSaveDebounced();
    }

    function drawFigure(figure,fi){
        ctx.save();
        // Todas las figuras (abiertas o cerradas) con el mismo estilo negro
        ctx.strokeStyle = figure.locked ? getLockedColor() : getStrokeColor();
        ctx.lineWidth = figure.locked ? 2/viewScale : 2/viewScale;
        ctx.setLineDash([]);

        figure.edges.forEach((e,ei)=>{
            const a=figure.vertices[e.start],b=figure.vertices[e.end];
            ctx.beginPath();ctx.moveTo(a.x,a.y);
            if(e.cubic&&e.control2X!=null) ctx.bezierCurveTo(e.controlX,e.controlY,e.control2X,e.control2Y,b.x,b.y);
            else if(e.curved&&e.controlX!=null) ctx.quadraticCurveTo(e.controlX,e.controlY,b.x,b.y);
            else ctx.lineTo(b.x,b.y);
            ctx.stroke();
        });
        ctx.restore();
    }

    function drawGrainArrow(figure){
        const c=getCentroid(figure),grain=figure.grain;if(!grain)return;
        const len=28/viewScale,hs=7/viewScale;
        ctx.save();
        ctx.strokeStyle='#1565c0';
        ctx.fillStyle='#1565c0';
        ctx.lineWidth=2/viewScale;
        const dx=grain==='horizontal'?1:0,dy=grain==='horizontal'?0:1;
        const x1=c.x-dx*len,y1=c.y-dy*len,x2=c.x+dx*len,y2=c.y+dy*len;
        ctx.beginPath();
        ctx.moveTo(x1,y1);
        ctx.lineTo(x2,y2);
        ctx.stroke();
        function head(tx,ty,dirX,dirY){const px=-dirY,py=dirX;
        ctx.beginPath();
        ctx.moveTo(tx,ty);
        ctx.lineTo(tx-dirX*hs+px*hs*0.45,ty-dirY*hs+py*hs*0.45);
        ctx.lineTo(tx-dirX*hs-px*hs*0.45,ty-dirY*hs-py*hs*0.45);
        ctx.closePath();
        ctx.fill();}
        head(x2,y2, dx, dy);head(x1,y1,-dx,-dy);
        ctx.restore();
    }

    function drawAllVertices(){
        const r=2.5/viewScale;
        const dark = document.body.classList.contains('dark');
        const normalColor = dark ? '#ffb400' : '#0019d9';
        const selColor = dark ? '#4dffa6' : '#00c918';
        figures.forEach((fig,fi)=>{fig.vertices.forEach((v,vi)=>{
            const isSel = selectedVertex && selectedVertex.figureIndex===fi && selectedVertex.vertexIndex===vi;
            ctx.beginPath();
            ctx.arc(v.x,v.y,r,0,Math.PI*2);
            ctx.fillStyle = isSel ? selColor : normalColor;
            ctx.fill();
            ctx.strokeStyle = isSel ? selColor : normalColor;
            ctx.lineWidth=2/viewScale;
            ctx.stroke();
        });});
    }

    function drawResizeIndicator(){
        if(!selectedEdge)return;
        const fig=figures[selectedEdge.figureIndex],edge=fig.edges[selectedEdge.edgeIndex];
        const a=fig.vertices[edge.start],b=fig.vertices[edge.end],r=2.5/viewScale;
        const moveB=Math.hypot(selectedEdge.clickX-b.x,selectedEdge.clickY-b.y)<Math.hypot(selectedEdge.clickX-a.x,selectedEdge.clickY-a.y);
        const mv=moveB?b:a,fx=moveB?a:b;
        ctx.beginPath();
        ctx.arc(fx.x,fx.y,r,0,Math.PI*2);
        ctx.fillStyle='#27ae60';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(mv.x,mv.y,r,0,Math.PI*2);
        ctx.fillStyle='#e74c3c';
        ctx.fill();
        document.getElementById('resizeIndicator').textContent='Cambiar longitud';
    }

    // Etiqueta de la suma total de las aristas seleccionadas en modo cambiar longitud (multi-selección)
    function drawResizeSumLabel(totalPx){
        let sx=0, sy=0, n=0;
        resizeEdges.forEach(re=>{
            const fig=figures[re.figureIndex];
            if(!fig) return;
            const edge=fig.edges[re.edgeIndex];
            const {mx,my}=edgeMidAndNormal(fig, edge);
            sx+=mx; sy+=my; n++;
        });
        if(n===0) return;
        const cx=sx/n, cy=sy/n;
        const text='Total: '+pxToCm(totalPx).toFixed(1)+' cm';
        ctx.save();
        ctx.font=getMeasureFontSize()+'px sans-serif';
        ctx.fillStyle=getMeasureTextColor();
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        ctx.globalAlpha=0.9;
        ctx.fillText(text, cx, cy - 18/viewScale);
        ctx.restore();
    }
