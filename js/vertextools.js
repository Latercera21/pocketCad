// PocketCAD - módulo: vertextools
// Generado a partir de la división del archivo monolítico original.

    // ===================== OPERACIONES =====================
    function addVertexOnEdge(fi,ei,x,y){
        const figure=figures[fi],edge=figure.edges[ei];
        const a=figure.vertices[edge.start],b=figure.vertices[edge.end];
        let newPoint,t;
        if(divideMidpoint){
            t=0.5;
            if(edge.curved&&edge.controlX!=null){
                newPoint={x:(1-t)*(1-t)*a.x+2*(1-t)*t*edge.controlX+t*t*b.x, y:(1-t)*(1-t)*a.y+2*(1-t)*t*edge.controlY+t*t*b.y};
            } else {
                newPoint={x:a.x+(b.x-a.x)*t, y:a.y+(b.y-a.y)*t};
            }
        } else if(edge.curved&&edge.controlX!=null){
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
        figure.vertices.splice(nvi,0,newPoint);
        figure.edges.forEach(e=>{if(e.start>=nvi)e.start++;if(e.end>=nvi)e.end++;});
        if(edge.curved&&edge.controlX!=null){
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
                    const tx = ((e.controlX - oldA.x) * (oldB.x - oldA.x) + (e.controlY - oldA.y) * (oldB.y - oldA.y)) / (denom * denom);
                    const ty = ((e.controlY - oldA.y) * (oldB.x - oldA.x) - (e.controlX - oldA.x) * (oldB.y - oldA.y)) / (denom * denom);
                    e.controlX = a.x + tx * (b.x - a.x) - ty * (b.y - a.y);
                    e.controlY = a.y + tx * (b.y - a.y) + ty * (b.x - a.x);
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
        const v=figures[selectedVertex.figureIndex].vertices[selectedVertex.vertexIndex];
        if(!isNaN(dx)) v.x+=dx*PX_PER_CM;
        if(!isNaN(dy)) v.y+=dy*PX_PER_CM;

        document.getElementById('vertexDX').value='';
        document.getElementById('vertexDY').value='';
        redrawAll();
    }
