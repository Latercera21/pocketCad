// PocketCAD - módulo: geometry
// Generado a partir de la división del archivo monolítico original.

    function screenToWorld(sx, sy) {
        return { x:(sx-viewOffX)/viewScale, y:(sy-viewOffY)/viewScale };
    }

    // ===================== SNAP =====================
    function applySnap(x, y, exFi, exVi) {
    let sx=x, sy=y, fx=false, fy=false;
    for (let fi=0; fi<figures.length && (!fx||!fy); fi++)
        for (let vi=0; vi<figures[fi].vertices.length && (!fx||!fy); vi++) {
            if (fi===exFi && vi===exVi) continue;
            const v=figures[fi].vertices[vi];               
            if (!fy && Math.abs(y-v.y)<getSnapThreshold()) { sy=v.y; fy=true; }
            if (!fx && Math.abs(x-v.x)<getSnapThreshold()) { sx=v.x; fx=true; }
        }
    return {x:sx,y:sy};
}

    function makeEdge(s,e) {
        return{start:s,end:e,curved:false,cubic:false,controlX:null,controlY:null,control2X:null,control2Y:null};
    }

    // Fusiona vértices casi coincidentes (residuos de operaciones geométricas) y elimina
    // las aristas degeneradas (longitud ~0) que puedan quedar. tolPx es una tolerancia
    // absoluta pequeña en píxeles, pensada para limpiar artefactos, no para afectar
    // geometría intencional.
    function mergeCloseVertices(fig, tolPx) {
        if (!fig || !fig.vertices || fig.vertices.length < 2) return;
        let changed = true;
        while (changed) {
            changed = false;
            for (let a=0; a<fig.vertices.length && !changed; a++) {
                for (let b=a+1; b<fig.vertices.length && !changed; b++) {
                    const va=fig.vertices[a], vb=fig.vertices[b];
                    if (Math.hypot(va.x-vb.x, va.y-vb.y) >= tolPx) continue;
                    // fusionar b en a
                    fig.edges.forEach(e=>{
                        if (e.start===b) e.start=a;
                        if (e.end===b) e.end=a;
                    });
                    fig.vertices.splice(b,1);
                    fig.edges.forEach(e=>{
                        if (e.start>b) e.start--;
                        if (e.end>b) e.end--;
                    });
                    changed = true;
                }
            }
        }
        // quitar aristas degeneradas (mismo inicio y fin, o longitud ~0)
        for (let i=fig.edges.length-1; i>=0; i--) {
            const e = fig.edges[i];
            if (e.start === e.end) { fig.edges.splice(i,1); continue; }
            const a=fig.vertices[e.start], b=fig.vertices[e.end];
            if (a && b && Math.hypot(a.x-b.x, a.y-b.y) < tolPx*0.5) fig.edges.splice(i,1);
        }
    }

    function createPolygon(cx,cy,sides,radius=1000,locked=false) {
        const vertices=[],edges=[];
        for (let i=0;i<sides;i++) {
            //const ang=(i*2*Math.PI)/sides-Math.PI/2;
            const ang = (i * 2 * Math.PI) / sides - Math.PI / sides;
            vertices.push({x:cx+radius*Math.cos(ang),y:cy+radius*Math.sin(ang)});
        }
        for (let i=0;i<sides;i++) edges.push(makeEdge(i,(i+1)%sides));
        return {vertices,edges,closed:true,grain:null,locked:false};
    }

    function createRectangle(cx,cy,wPx,hPx) {
        const hw=wPx/2, hh=hPx/2;
        const vertices=[
            {x:cx-hw,y:cy-hh},
            {x:cx+hw,y:cy-hh},
            {x:cx+hw,y:cy+hh},
            {x:cx-hw,y:cy+hh}
        ];
        const edges=[makeEdge(0,1),makeEdge(1,2),makeEdge(2,3),makeEdge(3,0)];
        return {vertices,edges,closed:true,grain:null,locked:false};
    }

    function createLine(start,end) {
        return {
            vertices:[{x:start.x,y:start.y},{x:end.x,y:end.y}],
            edges:[makeEdge(0,1)],
            closed:false,
            grain:null,
            locked:false
        };
    }

    function isPointInPolygon(x,y,figure) {
        if (!figure.closed) return false;
        const v = figureAPolilineaGrande(figure, 15);
        if (v.length < 3) return false;
        let inside=false;
        for (let i=0,j=v.length-1;i<v.length;j=i++)
            if (((v[i].y>y)!==(v[j].y>y))&&(x<(v[j].x-v[i].x)*(y-v[i].y)/(v[j].y-v[i].y)+v[i].x))
                inside=!inside;
        return inside;
    }

    function findClickedFigure(wx,wy,includeLocked=false) {
        for (let i=figures.length-1;i>=0;i--) {
            if (!includeLocked && figures[i].locked) continue;
            if (figures[i].closed && isPointInPolygon(wx,wy,figures[i])) return i;
        }
        for (let i=figures.length-1;i>=0;i--) {
            if (!includeLocked && figures[i].locked) continue;
            if (!figures[i].closed) {
                for (const e of figures[i].edges) {
                    if (edgeDist(wx,wy,figures[i],e) < 15/viewScale) return i;
                }
            }
        }
        return -1;
    }

    // Busca el vértice más cercano. Por defecto ignora figuras bloqueadas (editar=true),
    // salvo que se pida explícitamente incluirlas (para medir, por ejemplo).
    function findNearestVertex(wx,wy,includeLocked=false) {
        const thr=20/viewScale;
        for (let fi=0;fi<figures.length;fi++) {
            if (!includeLocked && figures[fi].locked) continue;
            for (let vi=0;vi<figures[fi].vertices.length;vi++) {
                const p=figures[fi].vertices[vi];
                if (Math.hypot(wx-p.x,wy-p.y)<thr) return{figureIndex:fi,vertexIndex:vi};
            }
        }
        return null;
    }

    function dLine(px,py,x1,y1,x2,y2){
        const A=px-x1,B=py-y1,C=x2-x1,D=y2-y1,dot=A*C+B*D,len=C*C+D*D;
        if(!len) return Math.hypot(A,B);
        const t=Math.min(1,Math.max(0,dot/len));
        return Math.hypot(px-(x1+t*C),py-(y1+t*D));
    }

    function edgeDist(x,y,fig,e){
        const a=fig.vertices[e.start],b=fig.vertices[e.end];
        if(e.cubic&&e.control2X!=null) return dCubic(x,y,a.x,a.y,e.controlX,e.controlY,e.control2X,e.control2Y,b.x,b.y);
        if(e.curved&&e.controlX!=null) return dQuad(x,y,a.x,a.y,e.controlX,e.controlY,b.x,b.y);
        return dLine(x,y,a.x,a.y,b.x,b.y);
    }

    // Busca la arista más cercana. Por defecto ignora figuras bloqueadas (ver findNearestVertex).
    function findNearestEdge(wx,wy,includeLocked=false){
        const thr=15/viewScale;
        for(let fi=0;fi<figures.length;fi++){
            if (!includeLocked && figures[fi].locked) continue;
            const f=figures[fi];
            for(let ei=0;ei<f.edges.length;ei++)
                if(edgeDist(wx,wy,f,f.edges[ei])<thr) return{figureIndex:fi,edgeIndex:ei};
        }
        return null;
    }

    function closestOnLine(px,py,x1,y1,x2,y2){
        const A=px-x1,B=py-y1,C=x2-x1,D=y2-y1,dot=A*C+B*D,len=C*C+D*D;
        if(!len) return{x:x1,y:y1,t:0};
        const t=Math.max(0,Math.min(1,dot/len));return{x:x1+t*C,y:y1+t*D,t};
    }

    function getCentroid(figure){
        let cx=0,cy=0;figure.vertices.forEach(v=>{cx+=v.x;cy+=v.y;});
        return{x:cx/figure.vertices.length,y:cy/figure.vertices.length};
    }

function ptOnLine(p0, p1, t) {
    return { x: p0.x + (p1.x - p0.x) * t, y: p0.y + (p1.y - p0.y) * t };
}

    // ========== INTERSECCIONES EXACTAS (del código pequeño) ==========

function lineLineIntersect(p0, p1, q0, q1) {
    const dx1 = p1.x - p0.x, dy1 = p1.y - p0.y;
    const dx2 = q1.x - q0.x, dy2 = q1.y - q0.y;
    const denom = dx1 * dy2 - dy1 * dx2;
    if (Math.abs(denom) < 1e-10) return null;
    const dx = q0.x - p0.x, dy = q0.y - p0.y;
    const t = (dx * dy2 - dy * dx2) / denom;
    const s = (dx * dy1 - dy * dx1) / denom;
    if (t < -1e-9 || t > 1 + 1e-9 || s < -1e-9 || s > 1 + 1e-9) return null;
    return { t_fig: Math.max(0, Math.min(1, t)), t_cut: Math.max(0, Math.min(1, s)) };
}

function projectOntoLine(pt, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-10) return 0;
    return ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / len2;
}

function edgeLength(fig, edge) {
    const a = fig.vertices[edge.start], b = fig.vertices[edge.end];
    const STEPS = 200;
    let len = 0, px = a.x, py = a.y;
    for (let i = 1; i <= STEPS; i++) {
        const t = i / STEPS;
        let x, y;
        if (edge.cubic && edge.control2X != null) {
            const mt = 1-t;
            x = mt*mt*mt*a.x + 3*mt*mt*t*edge.controlX + 3*mt*t*t*edge.control2X + t*t*t*b.x;
            y = mt*mt*mt*a.y + 3*mt*mt*t*edge.controlY + 3*mt*t*t*edge.control2Y + t*t*t*b.y;
        } else if (edge.curved && edge.controlX != null) {
            x = (1-t)*(1-t)*a.x + 2*(1-t)*t*edge.controlX + t*t*b.x;
            y = (1-t)*(1-t)*a.y + 2*(1-t)*t*edge.controlY + t*t*b.y;
        } else {
            x = a.x + (b.x-a.x)*t;
            y = a.y + (b.y-a.y)*t;
        }
        len += Math.hypot(x-px, y-py);
        px = x; py = y;
    }
    return len;
}

    function edgeMidAndNormal(fig, edge) {
        const a = fig.vertices[edge.start], b = fig.vertices[edge.end];
        let mx, my, tx, ty;
        if (edge.cubic && edge.control2X != null) {
            const t = 0.5, mt = 1 - t;
            mx = mt*mt*mt*a.x + 3*mt*mt*t*edge.controlX + 3*mt*t*t*edge.control2X + t*t*t*b.x;
            my = mt*mt*mt*a.y + 3*mt*mt*t*edge.controlY + 3*mt*t*t*edge.control2Y + t*t*t*b.y;
            tx = 3*mt*mt*(edge.controlX-a.x) + 6*mt*t*(edge.control2X-edge.controlX) + 3*t*t*(b.x-edge.control2X);
            ty = 3*mt*mt*(edge.controlY-a.y) + 6*mt*t*(edge.control2Y-edge.controlY) + 3*t*t*(b.y-edge.control2Y);
        } else if (edge.curved && edge.controlX != null) {
            const t = 0.5;
            mx = (1-t)*(1-t)*a.x + 2*(1-t)*t*edge.controlX + t*t*b.x;
            my = (1-t)*(1-t)*a.y + 2*(1-t)*t*edge.controlY + t*t*b.y;
            tx = 2*(1-t)*(edge.controlX-a.x) + 2*t*(b.x-edge.controlX);
            ty = 2*(1-t)*(edge.controlY-a.y) + 2*t*(b.y-edge.controlY);
        } else {
            mx = (a.x+b.x)/2; my = (a.y+b.y)/2;
            tx = b.x-a.x; ty = b.y-a.y;
        }
        const tlen = Math.hypot(tx,ty) || 1;
        return { mx, my, nx: -ty/tlen, ny: tx/tlen };
    }

    function applyCreatePolygon(){
        const wCm = parseFloat(String(document.getElementById('createWidth').value).replace(',','.'));
        const hCm = parseFloat(String(document.getElementById('createHeight').value).replace(',','.'));
        if(isNaN(wCm)||isNaN(hCm)||wCm<=0||hCm<=0){
            showModal({title:'Valor inválido',body:'Ingresa ancho y alto en cm.',buttons:[{label:'OK'}]});
            return;
        }
        saveState();
        const r = canvas.getBoundingClientRect();
        const center = pendingCreatePos || screenToWorld(r.width/2, r.height/2);
        figures.push(createRectangle(center.x, center.y, wCm*PX_PER_CM, hCm*PX_PER_CM));
        pendingCreatePos = null;
        redrawAll();
    }
