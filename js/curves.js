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

    // ===================== CURVA MIDPOINT DRAG (legado, cuadrática) =====================
    // Calcula el punto de control cuadrático a partir del punto medio donde arrastra el usuario.
    // Ya no se usa para crear curvas nuevas (ver motor Catmull-Rom multipunto más abajo), se deja por compatibilidad.
    function controlFromMidpoint(p0, pm, p2) {
        return {
            x: (pm.x - 0.25*p0.x - 0.25*p2.x) / 0.5,
            y: (pm.y - 0.25*p0.y - 0.25*p2.y) / 0.5
        };
    }

    // ===================== MOTOR CATMULL-ROM (multipunto, cúbica) — herramienta secundaria =====================
    // Fórmula Catmull-Rom CENTRÍPETA → Bézier (parametrización por distancia^0.5 entre nudos,
    // evita los "loops"/overshoots de la versión uniforme cuando los puntos están muy separados
    // entre sí o muy cerca). Cada punto de la cadena queda EXACTAMENTE sobre la curva.
    // pts[0] y pts[last] son los extremos fijos de la arista original (los que conectan con el
    // resto de la figura); los puntos intermedios son los que el usuario va agregando/arrastrando.
    function knotDist(a, b) {
        return Math.max(Math.pow(Math.hypot(b.x - a.x, b.y - a.y), 0.5), 1e-3);
    }
    function vnorm(v) { const m = Math.hypot(v.x, v.y) || 1; return { x: v.x/m, y: v.y/m }; }
    // Derivada de un solo lado con 3 puntos reales (sin inventar punto espejo), usada para
    // saber hacia dónde "viene" la curva más allá del vecino inmediato — mirar solo 1 vecino
    // (espejo simple) hace que la punta de la curva arranque para el lado contrario antes de
    // enderezar, dando el efecto de "curva de carretera"/pico en vez de curva redonda.
    // Devuelve la derivada EN p0, apuntando en el sentido p0->p1 (igual convención que el resto).
    function oneSidedDeriv(p0, p1, p2, h1, h2) {
        const c0 = -(2*h1+h2)/(h1*(h1+h2));
        const c1 = (h1+h2)/(h1*h2);
        const c2 = -h1/(h2*(h1+h2));
        return { x: c0*p0.x + c1*p1.x + c2*p2.x, y: c0*p0.y + c1*p1.y + c2*p2.y };
    }
    // ghostStart/ghostEnd opcionales: si hay una arista vecina REAL en la figura (fuera de
    // la cadena), se pasa su vértice lejano para que la curva empalme en continuidad con el
    // resto de la figura. Sin eso, se arma un punto fantasma "espejo" simple primero (igual
    // que antes) y DESPUÉS se corrige la tangente en cada punta mezclando esa dirección con
    // una que mira 2 puntos más allá — así la punta anticipa hacia dónde va la curva, en vez
    // de arrancar para el lado contrario y recién enderezar (el efecto "curva de carretera").
    function catmullRomChainControlPoints(pts, ghostStart, ghostEnd) {
        if (pts.length < 2) return [];
        const mirror = (p, q) => ({ x: 2*p.x - q.x, y: 2*p.y - q.y });
        const n = pts.length;
        const gS = ghostStart || mirror(pts[0], pts[1]);
        const gE = ghostEnd   || mirror(pts[n-1], pts[n-2]);
        const ext = [gS, ...pts, gE];
        const segs = [];
        for (let i = 0; i < pts.length - 1; i++) {
            const p0 = ext[i], p1 = ext[i+1], p2 = ext[i+2], p3 = ext[i+3];
            const t0 = 0, t1 = t0 + knotDist(p0,p1), t2 = t1 + knotDist(p1,p2), t3 = t2 + knotDist(p2,p3);
            const m1x = (t2-t1) * ((p1.x-p0.x)/(t1-t0) - (p2.x-p0.x)/(t2-t0) + (p2.x-p1.x)/(t2-t1));
            const m1y = (t2-t1) * ((p1.y-p0.y)/(t1-t0) - (p2.y-p0.y)/(t2-t0) + (p2.y-p1.y)/(t2-t1));
            const m2x = (t2-t1) * ((p2.x-p1.x)/(t2-t1) - (p3.x-p1.x)/(t3-t1) + (p3.x-p2.x)/(t3-t2));
            const m2y = (t2-t1) * ((p2.y-p1.y)/(t2-t1) - (p3.y-p1.y)/(t3-t1) + (p3.y-p2.y)/(t3-t2));
            segs.push({
                cp1: { x: p1.x + m1x/3, y: p1.y + m1y/3 },
                cp2: { x: p2.x - m2x/3, y: p2.y - m2y/3 }
            });
        }
        // Corrección de puntas (solo si no vinieron vecinos reales de la figura, y hay
        // suficientes puntos para "mirar 2 más allá"):
        if (!ghostStart && n >= 3) {
            const mirrorT0 = { x: 3*(segs[0].cp1.x-pts[0].x), y: 3*(segs[0].cp1.y-pts[0].y) };
            const magStart = Math.hypot(mirrorT0.x, mirrorT0.y);
            const h1 = knotDist(pts[0],pts[1]), h2 = knotDist(pts[1],pts[2]);
            const lookAhead0 = oneSidedDeriv(pts[0], pts[1], pts[2], h1, h2); // ya apunta 0->1
            const blend0 = vnorm({ x: vnorm(mirrorT0).x + vnorm(lookAhead0).x, y: vnorm(mirrorT0).y + vnorm(lookAhead0).y });
            const T0 = { x: blend0.x*magStart, y: blend0.y*magStart };
            segs[0].cp1 = { x: pts[0].x + T0.x/3, y: pts[0].y + T0.y/3 };
        }
        if (!ghostEnd && n >= 3) {
            const lastI = segs.length - 1;
            const mirrorTn = { x: 3*(pts[n-1].x-segs[lastI].cp2.x), y: 3*(pts[n-1].y-segs[lastI].cp2.y) };
            const magEnd = Math.hypot(mirrorTn.x, mirrorTn.y);
            const h1 = knotDist(pts[n-1],pts[n-2]), h2 = knotDist(pts[n-2],pts[n-3]);
            let lookAheadN = oneSidedDeriv(pts[n-1], pts[n-2], pts[n-3], h1, h2); // apunta (n-1)->(n-2)
            lookAheadN = { x: -lookAheadN.x, y: -lookAheadN.y }; // invertir: (n-2)->(n-1), misma convención que mirrorTn
            const blendN = vnorm({ x: vnorm(mirrorTn).x + vnorm(lookAheadN).x, y: vnorm(mirrorTn).y + vnorm(lookAheadN).y });
            const Tn = { x: blendN.x*magEnd, y: blendN.y*magEnd };
            segs[lastI].cp2 = { x: pts[n-1].x - Tn.x/3, y: pts[n-1].y - Tn.y/3 };
        }
        return segs;
    }

    // Encuentra la cadena contigua de aristas cúbicas que contiene edgeIndex, caminando
    // hacia atrás/adelante por vértices compartidos mientras las aristas vecinas también
    // sean cúbicas. Devuelve los índices de arista en orden start->end.
    function getCurveChain(fig, edgeIndex) {
        const edges = fig.edges, n = edges.length;
        let startI = edgeIndex, endI = edgeIndex, guard = 0;
        while (guard++ < n) {
            const cur = edges[startI];
            const predI = edges.findIndex((e, idx) => idx !== startI && e.end === cur.start);
            if (predI === -1 || !edges[predI].cubic || predI === endI) break;
            startI = predI;
        }
        guard = 0;
        while (guard++ < n) {
            const cur = edges[endI];
            const succI = edges.findIndex((e, idx) => idx !== endI && e.start === cur.end);
            if (succI === -1 || !edges[succI].cubic || succI === startI) break;
            endI = succI;
        }
        const chain = []; let idx = startI; guard = 0;
        while (guard++ <= n) {
            chain.push(idx);
            if (idx === endI) break;
            const cur = edges[idx];
            const nextI = edges.findIndex((e, i) => i !== idx && e.start === cur.end);
            if (nextI === -1) break;
            idx = nextI;
        }
        return chain;
    }

    // Recalcula cp1/cp2 de TODAS las aristas de una cadena a partir de la posición
    // actual de sus vértices (llamar después de mover/agregar/quitar un punto).
    function recomputeCurveChain(fig, chainEdgeIdxs) {
        if (!chainEdgeIdxs.length) return;
        const edges = fig.edges;
        const firstEdge = edges[chainEdgeIdxs[0]], lastEdge = edges[chainEdgeIdxs[chainEdgeIdxs.length-1]];
        const pts = [fig.vertices[firstEdge.start]];
        chainEdgeIdxs.forEach(ei => pts.push(fig.vertices[edges[ei].end]));
        // Las puntas de la cadena son esquinas reales de la figura (donde empalma con
        // un lado recto, u otra esquina cualquiera): se tratan siempre en forma
        // independiente (espejo local + lookahead, igual que el resto de puntas sin
        // vecino), NUNCA se ancla al vértice lejano del lado vecino. Antes eso hacía
        // que el lado recto "tirara" de la forma de la curva sin que el usuario lo
        // pidiera.
        const segs = catmullRomChainControlPoints(pts, null, null);
        chainEdgeIdxs.forEach((ei, i) => {
            const e = edges[ei];
            e.curved = true; e.cubic = true;
            e.controlX = segs[i].cp1.x; e.controlY = segs[i].cp1.y;
            e.control2X = segs[i].cp2.x; e.control2Y = segs[i].cp2.y;
        });
    }

    function closestTOnCubic(pt, p0, cp1, cp2, p1, steps = 100) {
        let best = 0, bestDist = Infinity;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps, mt = 1 - t;
            const x = mt*mt*mt*p0.x + 3*mt*mt*t*cp1.x + 3*mt*t*t*cp2.x + t*t*t*p1.x;
            const y = mt*mt*mt*p0.y + 3*mt*mt*t*cp1.y + 3*mt*t*t*cp2.y + t*t*t*p1.y;
            const d = Math.hypot(pt.x - x, pt.y - y);
            if (d < bestDist) { bestDist = d; best = t; }
        }
        return best;
    }

    // De Casteljau para cúbicas: parte una cúbica p0,c1,c2,p1 en el parámetro t.
    function splitCubicBezier(p0, c1, c2, p1, t) {
        const lerp = (u, v) => ({ x: u.x + (v.x - u.x) * t, y: u.y + (v.y - u.y) * t });
        const q0 = lerp(p0, c1), q1 = lerp(c1, c2), q2 = lerp(c2, p1);
        const r0 = lerp(q0, q1), r1 = lerp(q1, q2);
        const s = lerp(r0, r1);
        return {
            left:  { start: p0, cp1: q0, cp2: r0, end: s },
            right: { start: s, cp1: r1, cp2: q2, end: p1 }
        };
    }
