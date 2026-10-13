// PocketCAD - módulo: transform
// Generado a partir de la división del archivo monolítico original.

    function rotateFigure(fi,deg,center){
        const f=figures[fi];
        const c=center || ((rotatePivot && rotatePivot.figureIndex===fi && f.vertices[rotatePivot.vertexIndex])
            ? f.vertices[rotatePivot.vertexIndex]
            : getCentroid(f));
        const rad=deg*Math.PI/180,cos=Math.cos(rad),sin=Math.sin(rad);
        function rot(x,y){const dx=x-c.x,dy=y-c.y;return{x:c.x+dx*cos-dy*sin,y:c.y+dx*sin+dy*cos};}
        f.vertices.forEach(v=>{const r=rot(v.x,v.y);v.x=r.x;v.y=r.y;});
        f.edges.forEach(e=>{
            if(e.controlX !=null){const r=rot(e.controlX,e.controlY);  e.controlX=r.x; e.controlY=r.y;}
            if(e.control2X!=null){const r=rot(e.control2X,e.control2Y);e.control2X=r.x;e.control2Y=r.y;}
        });
    }

    // Base: rota la figura (sobre el punto medio del lado elegido) para que ese lado quede
    // horizontal ('x') o vertical ('y'), con el giro mínimo.
    function rotateBaseTo(axis){
        if(!rotateBaseEdge){ return; }
        const f=figures[rotateBaseEdge.fi];
        const e=f&&f.edges[rotateBaseEdge.ei];
        if(!e) return;
        const a=f.vertices[e.start], b=f.vertices[e.end];
        if(Math.hypot(b.x-a.x,b.y-a.y)<1e-6) return;
        const cur=Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI;
        let d=(axis==='x'?0:90)-cur;
        d=((d%180)+180)%180; if(d>90) d-=180;        // giro mínimo, en (-90, 90]
        saveState();
        rotateFigure(rotateBaseEdge.fi,d,{x:(a.x+b.x)/2,y:(a.y+b.y)/2});
        redrawAll();
    }

    function toggleRotateBaseMode(){
        rotateBaseMode=!rotateBaseMode;
        if(rotateBaseMode && rotatePivotMode) toggleRotatePivotMode();
        if(!rotateBaseMode) rotateBaseEdge=null;
        syncRotateBaseUI();
        redrawAll();
    }

    function syncRotateBaseUI(){
        document.getElementById('rotateBaseBtn').classList.toggle('on',rotateBaseMode);
        document.getElementById('rotateBaseAxis').style.display=(rotateBaseMode&&rotateBaseEdge)?'inline-flex':'none';
    }

    function drawRotateBase(){
        if(!rotateBaseMode||!rotateBaseEdge) return;
        const f=figures[rotateBaseEdge.fi]; const e=f&&f.edges[rotateBaseEdge.ei];
        if(!e){ rotateBaseEdge=null; return; }
        const a=f.vertices[e.start], b=f.vertices[e.end];
        ctx.save();
        ctx.lineWidth=4/viewScale; ctx.strokeStyle='#ff6d00'; ctx.globalAlpha=0.85;
        ctx.beginPath(); ctx.moveTo(a.x,a.y);
        if(e.cubic&&e.control2X!=null) ctx.bezierCurveTo(e.controlX,e.controlY,e.control2X,e.control2Y,b.x,b.y);
        else if(e.curved&&e.controlX!=null) ctx.quadraticCurveTo(e.controlX,e.controlY,b.x,b.y);
        else ctx.lineTo(b.x,b.y);
        ctx.stroke(); ctx.restore();
    }

    // Traslada (desplaza rígido) todos los vértices y puntos de control de una
    // figura por (dx,dy). Usada para "pegar" el pivote de rotación al vértice
    // de otra figura antes de rotar.
    function translateFigure(fi,dx,dy){
        const f=figures[fi];
        f.vertices.forEach(v=>{v.x+=dx;v.y+=dy;});
        f.edges.forEach(e=>{
            if(e.controlX !=null){e.controlX+=dx;e.controlY+=dy;}
            if(e.control2X!=null){e.control2X+=dx;e.control2Y+=dy;}
        });
    }

    function duplicateFigure(fi,ox=100,oy=100){
        const o=figures[fi];
        figures.push({
            vertices:o.vertices.map(v=>({x:v.x+ox,y:v.y+oy,hardCorner:v.hardCorner})),
            edges:o.edges.map(e=>({start:e.start,end:e.end,curved:e.curved,cubic:e.cubic||false,
                controlX: e.controlX !=null?e.controlX +ox:null,controlY: e.controlY !=null?e.controlY +oy:null,
                control2X:e.control2X!=null?e.control2X+ox:null,control2Y:e.control2Y!=null?e.control2Y+oy:null})),
            closed:o.closed,grain:o.grain,espejo:!!o.espejo,permiteVoltear:!!o.permiteVoltear
        });
    }

    function reflectFigure(fi,ox=100,oy=0){
        const o=figures[fi],c=getCentroid(o);
        figures.push({
            vertices:o.vertices.map(v=>({x:2*c.x-v.x+ox,y:v.y+oy,hardCorner:v.hardCorner})),
            edges:o.edges.map(e=>({start:e.start,end:e.end,curved:e.curved,cubic:e.cubic||false,
                controlX: e.controlX !=null?2*c.x-e.controlX +ox:null,controlY: e.controlY !=null?e.controlY +oy:null,
                control2X:e.control2X!=null?2*c.x-e.control2X+ox:null,control2Y:e.control2Y!=null?e.control2Y+oy:null})),
            closed:o.closed,grain:o.grain,espejo:!o.espejo,permiteVoltear:!!o.permiteVoltear
        });
    }

    //unfildfigureinplace ======
    function unfoldFigureInPlace(figure, hei) {
    if (!figure.closed) return;               // solo figuras cerradas

    const V = figure.vertices;
    const E = figure.edges;
    const n = E.length;
    const hinge = E[hei];

    const A = V[hinge.start];                 // extremo del eje
    const B = V[hinge.end];

    // ── 1. Recoger las aristas del camino B → A (todas menos la bisagra) ──
    const otherEdges = [];
    for (let i = 1; i < n; i++) {
        otherEdges.push(E[(hei + i) % n]);
    }

    // ── 2. Construir la secuencia de vértices del lado original (B … A) ──
    const origVertices = [B];                  
    for (const e of otherEdges) {
        const endV = V[e.end];
        origVertices.push(endV);
    }

    // ── 3. Reflejo de un punto respecto al eje AB ──
    function reflect(pt) {
        const dx = B.x - A.x, dy = B.y - A.y;
        const len2 = dx * dx + dy * dy;
        if (len2 < 1e-12) return { x: pt.x, y: pt.y };
        const t = ((pt.x - A.x) * dx + (pt.y - A.y) * dy) / len2;
        const fx = A.x + t * dx;
        const fy = A.y + t * dy;
        return { x: 2 * fx - pt.x, y: 2 * fy - pt.y };
    }

    // ── 4. Crear aristas reflejadas (invertidas) en orden inverso ──
    const reflectedEdges = [];
    for (let i = otherEdges.length - 1; i >= 0; i--) {
        const orig = otherEdges[i];
        const startOrig = V[orig.start];
        const endOrig   = V[orig.end];

        const rStart = reflect(endOrig);   
        const rEnd   = reflect(startOrig); 

        let newEdge = {
            start: -1, end: -1,          
            curved: orig.curved,
            cubic: orig.cubic,
            controlX: null,
            controlY: null,
            control2X: null,
            control2Y: null
        };

        if (orig.cubic && orig.control2X != null) {
            const cp1 = reflect({ x: orig.controlX,  y: orig.controlY });
            const cp2 = reflect({ x: orig.control2X, y: orig.control2Y });
            newEdge.controlX  = cp2.x;
            newEdge.controlY  = cp2.y;
            newEdge.control2X = cp1.x;
            newEdge.control2Y = cp1.y;
        } else if (orig.curved && orig.controlX != null) {
            const cp = reflect({ x: orig.controlX, y: orig.controlY });
            newEdge.controlX = cp.x;
            newEdge.controlY = cp.y;
        }

        // Guardamos las coordenadas reales de los extremos para luego casarlos con vértices
        reflectedEdges.push({
            edge: newEdge,
            rStart: rStart,   
            rEnd: rEnd,
            srcEnd: startOrig        // vértice original cuyo reflejo es rEnd (hereda sus marcas)
        });
    }

    // Copia un punto conservando sus marcas (esquina dura, punta de pinza)
    function withFlags(pt, src) {
        const o = { x: pt.x, y: pt.y };
        if (src && src.hardCorner) o.hardCorner = true;
        if (src && src.dartApex) o.dartApex = true;
        return o;
    }

    // ── 5. Construir la nueva lista de vértices ──
    const newVertices = [];
    const mapOrig = new Map();   

    newVertices.push(withFlags(B, B));           // idx 0
    mapOrig.set(hinge.end, 0);                   // B

    // Insertar los vértices intermedios y A
    for (let i = 1; i < origVertices.length; i++) {
        const v = origVertices[i];
        newVertices.push(withFlags(v, v));
        const edge = otherEdges[i - 1];
        const origIdx = edge.end;
        if (!mapOrig.has(origIdx)) mapOrig.set(origIdx, newVertices.length - 1);
    }
    // El último vértice insertado es A, que corresponde a hinge.start
    mapOrig.set(hinge.start, newVertices.length - 1); // A

    for (let i = 0; i < reflectedEdges.length - 1; i++) {
        const pt = reflectedEdges[i].rEnd;
        newVertices.push(withFlags(pt, reflectedEdges[i].srcEnd));
    }

    // ── 6. Construir las nuevas aristas ──
    const newEdges = [];

    // a) Aristas del lado original
    for (const e of otherEdges) {
        const sNew = mapOrig.get(e.start);
        const eNew = mapOrig.get(e.end);
        newEdges.push({
            start: sNew,
            end: eNew,
            curved: e.curved,
            cubic: e.cubic,
            controlX: e.controlX,
            controlY: e.controlY,
            control2X: e.control2X,
            control2Y: e.control2Y
        });
    }

    // El inicio de la primera arista reflejada es A (índice mapOrig.get(hinge.start))
    const idxA = mapOrig.get(hinge.start);
    let prevIdx = idxA; 

    // su índice base = newVertices.length - (reflectedEdges.length - 1)  (porque el último es B no añadido)
    const baseRefl = newVertices.length - (reflectedEdges.length - 1);

    for (let i = 0; i < reflectedEdges.length; i++) {
        const re = reflectedEdges[i];
        let endIdx;
        if (i === reflectedEdges.length - 1) {
            endIdx = 0; // termina en B (índice 0)
        } else {
            endIdx = baseRefl + i; // vértice reflejado i-ésimo
        }
        newEdges.push({
            start: prevIdx,
            end: endIdx,
            curved: re.edge.curved,
            cubic: re.edge.cubic,
            controlX: re.edge.controlX,
            controlY: re.edge.controlY,
            control2X: re.edge.control2X,
            control2Y: re.edge.control2Y
        });
        prevIdx = endIdx;
    }

    // ── 7. Sustituir la figura ──
    figure.vertices = newVertices;
    figure.edges = newEdges;
    figure.closed = true;   // ya lo está, pero por claridad
}
