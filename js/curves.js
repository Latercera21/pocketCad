// PocketCAD - módulo: curves
// Generado a partir de la división del archivo monolítico original.

    // ===================== GEOMETRIA BASICA =====================
    function q2c(p0,c,p1) {
        return {
            cp1:{x:p0.x+2/3*(c.x-p0.x),y:p0.y+2/3*(c.y-p0.y)},
            cp2:{x:p1.x+2/3*(c.x-p1.x),y:p1.y+2/3*(c.y-p1.y)}
        };
    }

    // punto-en-poligono casi nunca detectaba clics dentro de la figura.
    function figureAPolilineaGrande(figure, samplesPerCurve = 15) {
        const pts = [];
        figure.edges.forEach(e => {
            const a = figure.vertices[e.start], b = figure.vertices[e.end];
            pts.push({x:a.x, y:a.y});
            if (e.cubic && e.control2X != null) {
                for (let i = 1; i < samplesPerCurve; i++) {
                    const t = i / samplesPerCurve, mt = 1 - t;
                    pts.push({
                        x: mt*mt*mt*a.x + 3*mt*mt*t*e.controlX + 3*mt*t*t*e.control2X + t*t*t*b.x,
                        y: mt*mt*mt*a.y + 3*mt*mt*t*e.controlY + 3*mt*t*t*e.control2Y + t*t*t*b.y
                    });
                }
            } else if (e.curved && e.controlX != null) {
                for (let i = 1; i < samplesPerCurve; i++) {
                    const t = i / samplesPerCurve;
                    pts.push({
                        x: (1-t)*(1-t)*a.x + 2*(1-t)*t*e.controlX + t*t*b.x,
                        y: (1-t)*(1-t)*a.y + 2*(1-t)*t*e.controlY + t*t*b.y
                    });
                }
            }
        });
        return pts;
    }

    function dQuad(px,py,x1,y1,cx,cy,x2,y2){
        let d=Infinity;
        for(let t=0;t<=1;t+=0.05){const xt=(1-t)*(1-t)*x1+2*(1-t)*t*cx+t*t*x2,yt=(1-t)*(1-t)*y1+2*(1-t)*t*cy+t*t*y2;d=Math.min(d,Math.hypot(px-xt,py-yt));}
        return d;
    }

    function dCubic(px,py,x0,y0,cx1,cy1,cx2,cy2,x1,y1){
        let d=Infinity;
        for(let t=0;t<=1;t+=0.05){const mt=1-t,xt=mt*mt*mt*x0+3*mt*mt*t*cx1+3*mt*t*t*cx2+t*t*t*x1,yt=mt*mt*mt*y0+3*mt*mt*t*cy1+3*mt*t*t*cy2+t*t*t*y1;d=Math.min(d,Math.hypot(px-xt,py-yt));}
        return d;
    }

    function sampleFigureEdges(figure, steps=80) {
        const pts = [];
        for (let ei = 0; ei < figure.edges.length; ei++) {
            const e = figure.edges[ei];
            const a = figure.vertices[e.start];
            const b = figure.vertices[e.end];
            if (pts.length === 0 || Math.hypot(pts[pts.length-1].x - a.x, pts[pts.length-1].y - a.y) > 0.01) {
                pts.push({x: a.x, y: a.y});
            }
            if (e.cubic && e.control2X != null) {
            for (let i = 1; i <= steps; i++) {
                const t = i/steps, mt=1-t;
                pts.push({x: mt*mt*mt*a.x+3*mt*mt*t*e.controlX+3*mt*t*t*e.control2X+t*t*t*b.x, y: mt*mt*mt*a.y+3*mt*mt*t*e.controlY+3*mt*t*t*e.control2Y+t*t*t*b.y});
            }
        } else if (e.curved && e.controlX != null) {
            for (let i = 1; i <= steps; i++) {
                const t = i/steps;
                pts.push({x: (1-t)*(1-t)*a.x+2*(1-t)*t*e.controlX+t*t*b.x, y: (1-t)*(1-t)*a.y+2*(1-t)*t*e.controlY+t*t*b.y});
            }
        } else {
            pts.push({x: b.x, y: b.y});
        }
    }
    return pts;
    }

    // ===================== FIN CORTE PARCIAL =====================

    function splitQuadraticBezier(a, c, b, t){
        const p0 = { x: a.x + (c.x - a.x) * t, y: a.y + (c.y - a.y) * t };
        const p1 = { x: c.x + (b.x - c.x) * t, y: c.y + (b.y - c.y) * t };
        const pMid = { x: p0.x + (p1.x - p0.x) * t, y: p0.y + (p1.y - p0.y) * t };
        return {
            left:  { start: a, end: pMid, curved: true, controlX: p0.x, controlY: p0.y },
            right: { start: pMid, end: b, curved: true, controlX: p1.x, controlY: p1.y }
        };
    }

function closestTOnQuad(pt, p0, cp, p1, steps = 100) {
    let best = 0, bestDist = Infinity;
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = (1-t)*(1-t)*p0.x + 2*(1-t)*t*cp.x + t*t*p1.x;
        const y = (1-t)*(1-t)*p0.y + 2*(1-t)*t*cp.y + t*t*p1.y;
        const d = Math.hypot(pt.x - x, pt.y - y);
        if (d < bestDist) { bestDist = d; best = t; }
    }
    return best;
}

    // ===================== CURVA MIDPOINT DRAG =====================
    // Calcula el punto de control cuadrático a partir del punto medio donde arrastra el usuario
    function controlFromMidpoint(p0, pm, p2) {
        return {
            x: (pm.x - 0.25*p0.x - 0.25*p2.x) / 0.5,
            y: (pm.y - 0.25*p0.y - 0.25*p2.y) / 0.5
        };
    }
