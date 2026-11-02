// PocketCAD - módulo: visor 3D (nivel 1)
// Sin librerías externas (funciona offline): proyección en perspectiva sobre canvas 2D.
// Toma las figuras CERRADAS, las triangula (ear clipping) y las muestra con grosor.
// Arrastrar = rotar, rueda/pellizco = zoom, 2 dedos = mover. Base para futuras mallas de triángulos.

function triangulatePolygon(pts) {
    // pts: [{x,y}] sin repetir el primero. Devuelve lista de índices [a,b,c,...]
    const n = pts.length;
    if (n < 3) return [];
    let area = 0;
    for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i+1)%n]; area += a.x*b.y - b.x*a.y; }
    const idx = [...Array(n).keys()];
    if (area < 0) idx.reverse(); // asegurar antihorario
    const cross = (a,b,c) => (b.x-a.x)*(c.y-a.y) - (b.y-a.y)*(c.x-a.x);
    const inTri = (p,a,b,c) => cross(a,b,p) >= 0 && cross(b,c,p) >= 0 && cross(c,a,p) >= 0;
    const out = [];
    let guard = n * n + 10;
    while (idx.length > 3 && guard-- > 0) {
        let cut = false;
        for (let i = 0; i < idx.length; i++) {
            const ia = idx[(i+idx.length-1)%idx.length], ib = idx[i], ic = idx[(i+1)%idx.length];
            const a = pts[ia], b = pts[ib], c = pts[ic];
            if (cross(a,b,c) <= 1e-12) continue; // no convexo
            let ok = true;
            for (const j of idx) {
                if (j===ia||j===ib||j===ic) continue;
                if (inTri(pts[j],a,b,c)) { ok = false; break; }
            }
            if (!ok) continue;
            out.push(ia, ib, ic);
            idx.splice(i, 1);
            cut = true;
            break;
        }
        if (!cut) { // polígono degenerado/autointersectado: abanico para no colgarse
            for (let i = 1; i < idx.length-1; i++) out.push(idx[0], idx[i], idx[i+1]);
            return out;
        }
    }
    if (idx.length === 3) out.push(idx[0], idx[1], idx[2]);
    return out;
}

function build3DMeshes(thickCm, spreadCm) {
    const meshes = [];
    const palette = [[231,76,60],[41,128,185],[39,174,96],[243,156,18],[142,68,173],[22,160,133],[211,84,0],[44,62,80]];
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    const polys = [];
    figures.forEach((fig, fi) => {
        if (!fig.closed) return;
        let pts = sampleFigureEdges(fig, 8).map(p => ({x: p.x/PX_PER_CM, y: -p.y/PX_PER_CM}));
        if (pts.length > 2) {
            const f = pts[0], l = pts[pts.length-1];
            if (Math.hypot(f.x-l.x, f.y-l.y) < 1e-3) pts.pop();
        }
        // quitar puntos consecutivos repetidos
        pts = pts.filter((p,i) => i===0 || Math.hypot(p.x-pts[i-1].x, p.y-pts[i-1].y) > 1e-4);
        if (pts.length < 3) return;
        pts.forEach(p => { minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y); });
        polys.push({pts, fi, name: fig.name});
    });
    const cx = (minX+maxX)/2, cy = (minY+maxY)/2;
    polys.forEach((P, k) => {
        const pts = P.pts.map(p => ({x: p.x-cx, y: p.y-cy}));
        const tri = triangulatePolygon(pts);
        const z0 = k * spreadCm, z1 = z0 + thickCm;
        const tris = [];
        for (let i = 0; i < tri.length; i += 3) {
            const a=pts[tri[i]], b=pts[tri[i+1]], c=pts[tri[i+2]];
            tris.push([[a.x,a.y,z1],[b.x,b.y,z1],[c.x,c.y,z1]]);   // cara superior
            tris.push([[c.x,c.y,z0],[b.x,b.y,z0],[a.x,a.y,z0]]);   // cara inferior
        }
        const n = pts.length;
        for (let i = 0; i < n; i++) {                              // laterales
            const a = pts[i], b = pts[(i+1)%n];
            tris.push([[a.x,a.y,z0],[b.x,b.y,z0],[b.x,b.y,z1]]);
            tris.push([[a.x,a.y,z0],[b.x,b.y,z1],[a.x,a.y,z1]]);
        }
        meshes.push({tris, color: palette[k % palette.length], name: P.name || ('Pieza ' + (k+1)), nTop: tri.length/3});
    });
    return {meshes, size: Math.max(maxX-minX, maxY-minY) || 50};
}

function open3DViewer() {
    if (document.getElementById('v3dOverlay')) return;
    const state = {yaw: -0.5, pitch: 0.5, zoom: 1, panX: 0, panY: 0, wire: false, spread: false};
    let data = build3DMeshes(0.3, 0);
    if (!data.meshes.length) {
        showModal({title:'3D', body:'No hay figuras cerradas para mostrar.', buttons:[{label:'OK'}]});
        return;
    }
    const ov = document.createElement('div');
    ov.id = 'v3dOverlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:9999;background:var(--bg);touch-action:none;';
    const cv = document.createElement('canvas');
    cv.style.cssText = 'width:100%;height:100%;display:block;';
    ov.appendChild(cv);
    const bar = document.createElement('div');
    bar.style.cssText = 'position:absolute;top:4px;left:4px;display:flex;gap:2px;flex-wrap:wrap;';
    const mk = (t, tip, fn) => { const b = document.createElement('button'); b.textContent = t; b.title = tip; b.onclick = fn; bar.appendChild(b); return b; };
    const info = document.createElement('div');
    info.style.cssText = 'position:absolute;bottom:6px;left:8px;color:var(--text);opacity:.6;font:12px sans-serif;';
    ov.appendChild(bar); ov.appendChild(info);
    document.body.appendChild(ov);
    const ctx = cv.getContext('2d');

    function resize() { cv.width = ov.clientWidth * devicePixelRatio; cv.height = ov.clientHeight * devicePixelRatio; draw(); }

    function draw() {
        const W = cv.width, H = cv.height;
        ctx.fillStyle = getComputedStyle(document.body).backgroundColor; ctx.fillRect(0, 0, W, H);
        const cy = Math.cos(state.yaw), sy = Math.sin(state.yaw), cp = Math.cos(state.pitch), sp = Math.sin(state.pitch);
        const S = Math.min(W, H) / (data.size * 1.3) * state.zoom;
        const dist = data.size * 3;
        const rot = (p) => { // yaw (eje Y) y luego pitch (eje X)
            let x = p[0]*cy + p[2]*sy, z = -p[0]*sy + p[2]*cy, y = p[1];
            const y2 = y*cp - z*sp, z2 = y*sp + z*cp;
            return [x, y2, z2];
        };
        const proj = (r) => { const k = dist / (dist - r[2]); return [W/2 + state.panX*devicePixelRatio + r[0]*S*k, H/2 + state.panY*devicePixelRatio - r[1]*S*k]; };
        const light = [0.3, 0.5, 0.8];
        const list = [];
        data.meshes.forEach(m => m.tris.forEach(t => {
            const r = t.map(rot);
            const u = [r[1][0]-r[0][0], r[1][1]-r[0][1], r[1][2]-r[0][2]], v = [r[2][0]-r[0][0], r[2][1]-r[0][1], r[2][2]-r[0][2]];
            let nx = u[1]*v[2]-u[2]*v[1], ny = u[2]*v[0]-u[0]*v[2], nz = u[0]*v[1]-u[1]*v[0];
            const nl = Math.hypot(nx, ny, nz) || 1;
            const lum = 0.35 + 0.65 * Math.abs((nx*light[0] + ny*light[1] + nz*light[2]) / nl);
            list.push({r, depth: (r[0][2]+r[1][2]+r[2][2])/3, lum, c: m.color});
        }));
        list.sort((a, b) => a.depth - b.depth);
        ctx.lineJoin = 'round';
        list.forEach(o => {
            const p = o.r.map(proj);
            ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]); ctx.lineTo(p[1][0], p[1][1]); ctx.lineTo(p[2][0], p[2][1]); ctx.closePath();
            const col = `rgb(${Math.round(o.c[0]*o.lum)},${Math.round(o.c[1]*o.lum)},${Math.round(o.c[2]*o.lum)})`;
            if (state.wire) { ctx.strokeStyle = getComputedStyle(document.body).color; ctx.lineWidth = 1; ctx.stroke(); }
            else { ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.fill(); ctx.stroke(); }
        });
        const tcount = data.meshes.reduce((s, m) => s + m.tris.length, 0);
        info.textContent = `${data.meshes.length}p · ${tcount}△`;
    }

    function rebuild() { data = build3DMeshes(0.3, state.spread ? 6 : 0); draw(); }
    mk('✕','Cerrar', () => { window.removeEventListener('resize', resize); ov.remove(); });
    mk('▦','Malla / sólido', () => { state.wire = !state.wire; draw(); });
    mk('⇕','Separar piezas en profundidad', () => { state.spread = !state.spread; rebuild(); });
    mk('⟲','Restablecer vista', () => { state.yaw = -0.5; state.pitch = 0.5; state.zoom = 1; state.panX = state.panY = 0; draw(); });
    mk('⬒','Vista frontal', () => { state.yaw = 0; state.pitch = 0; draw(); });

    // --- interacción (pointer events: mouse + touch) ---
    const ptrs = new Map(); let lastDist = 0, lastMid = null;
    cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, {x: e.clientX, y: e.clientY}); lastDist = 0; lastMid = null; });
    cv.addEventListener('pointerup', e => { ptrs.delete(e.pointerId); lastDist = 0; lastMid = null; });
    cv.addEventListener('pointercancel', e => { ptrs.delete(e.pointerId); });
    cv.addEventListener('pointermove', e => {
        const p = ptrs.get(e.pointerId); if (!p) return;
        if (ptrs.size === 1) {
            state.yaw += (e.clientX - p.x) * 0.01;
            state.pitch = Math.max(-1.55, Math.min(1.55, state.pitch + (e.clientY - p.y) * 0.01));
            p.x = e.clientX; p.y = e.clientY; draw();
        } else if (ptrs.size === 2) {
            p.x = e.clientX; p.y = e.clientY;
            const [a, b] = [...ptrs.values()];
            const d = Math.hypot(a.x-b.x, a.y-b.y), mid = {x: (a.x+b.x)/2, y: (a.y+b.y)/2};
            if (lastDist) state.zoom = Math.max(0.1, Math.min(20, state.zoom * d / lastDist));
            if (lastMid) { state.panX += mid.x - lastMid.x; state.panY += mid.y - lastMid.y; }
            lastDist = d; lastMid = mid; draw();
        }
    });
    cv.addEventListener('wheel', e => { e.preventDefault(); state.zoom = Math.max(0.1, Math.min(20, state.zoom * (e.deltaY < 0 ? 1.1 : 0.9))); draw(); }, {passive: false});
    window.addEventListener('resize', resize);
    resize();
}
