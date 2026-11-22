// PocketCAD - módulo: costuras para el visor 3D (herramienta 🪡 dentro de "Unir / Crear figura")
// Toca un lado de una pieza cerrada (lado A) y luego el lado que se cose con él (lado B); ✓ crea la costura.
// Un lado = la cadena entre esquinas duras (curvas multipunto) o una arista. Se guarda en cada arista:
// edge.seam = id, edge.seamSide = 'a'|'b'. Tocar un lado que ya tiene costura y ✓ la quita.

let seamToolActive = false;
let seamPending = [];   // hasta 2 lados: {fi, edges:[ei...]}
let seamPendRev = false; // sentido invertido para la costura que se va a crear

function seamSideEdges(fig, ei) {
    return fig.edges[ei].cubic ? getCurveChain(fig, ei) : [ei];
}

function seamColor(id) {
    const pal = ['#e53935', '#1e88e5', '#43a047', '#fb8c00', '#8e24aa', '#00acc1', '#6d4c41', '#d81b60'];
    return pal[(Math.abs(parseInt(id, 10) || 0)) % pal.length];
}

function seamNextId() {
    let mx = 0;
    figures.forEach(f => f.edges.forEach(e => { if (e.seam != null) mx = Math.max(mx, parseInt(e.seam, 10) || 0); }));
    return mx + 1;
}

function seamClearId(id) {
    figures.forEach(f => f.edges.forEach(e => { if (e.seam === id) { delete e.seam; delete e.seamSide; delete e.seamRev; } }));
}

function seamResetUI() {
    if (typeof nameReset === 'function') nameReset();
    seamToolActive = false;
    seamPending = []; seamPendRev = false;
    const b = document.getElementById('seamBtn'), o = document.getElementById('seamOkBtn'), fl = document.getElementById('seamFlipBtn');
    const dl = document.getElementById('seamDelBtn'); if (dl) dl.style.display = 'none';
    if (b) b.classList.remove('on');
    if (o) o.style.display = 'none';
    if (fl) { fl.style.display = 'none'; fl.classList.remove('on'); }
}

function toggleSeamTool() {
    const on = !seamToolActive;
    if (on && typeof closeAxisReset === 'function') closeAxisReset();
    if (on) nameReset();
    seamToolActive = on;
    seamPending = []; seamPendRev = false;
    closeLineIndices = [];
    document.getElementById('seamBtn').classList.toggle('on', on);
    document.getElementById('seamOkBtn').style.display = on ? 'inline-block' : 'none';
    document.getElementById('seamFlipBtn').style.display = on ? 'inline-block' : 'none';
    document.getElementById('seamDelBtn').style.display = on ? 'inline-block' : 'none';
    document.getElementById('seamFlipBtn').classList.remove('on');
    showActiveLabel(on ? 'Costura 3D: toca el lado A y luego el lado B, ✓' : MODE_LABELS.closeShape);
    redrawAll();
}

function seamTap(wx, wy) {
    const thr = 15 / viewScale;
    let best = null;
    figures.forEach((f, fi) => {
        if (!f.closed) return;
        f.edges.forEach((e, ei) => {
            const d = edgeDist(wx, wy, f, e);
            if (d < thr && (!best || d < best.d)) best = {fi, ei, d};
        });
    });
    if (!best) return;
    const f = figures[best.fi];
    const edges = seamSideEdges(f, best.ei);
    const same = (s) => s.fi === best.fi && s.edges.includes(best.ei);
    const k = seamPending.findIndex(same);
    if (k >= 0) seamPending.splice(k, 1);                 // tocar de nuevo = quitar de la selección
    else { if (seamPending.length >= 2) seamPending = []; seamPending.push({fi: best.fi, edges}); }
    const lbl = seamPending.map((s, i) => (i ? 'B ' : 'A ') + m3dSideLenCm(figures[s.fi], s.edges).toFixed(1) + ' cm').join('  ·  ');
    const _sid = seamPending.length === 1 ? seamPending[0].edges.map(ei => figures[seamPending[0].fi].edges[ei].seam).find(v => v != null) : null;
    showActiveLabel('Costura 3D: ' + (lbl || 'toca el lado A y luego el lado B, ✓') + (_sid != null ? '  ·  costura ' + _sid + ': 🗑 quitar, ⇄ invertir' : ''));
    redrawAll();
}

function applySeam() {
    if (seamPending.length === 1) {
        const s = seamPending[0], f = figures[s.fi];
        const id = s.edges.map(ei => f.edges[ei].seam).find(v => v != null);
        if (id != null) {
            saveState(); seamClearId(id); seamPending = [];
            showActiveLabel('Costura ' + id + ' quitada');
            redrawAll(); return;
        }
    }
    if (seamPending.length !== 2) {
        showModal({title: 'Costura 3D', body: 'Toca el lado A y luego el lado B (los dos lados que se cosen entre sí) y presiona ✓.\nPara quitar una costura: toca solo uno de sus lados y ✓.', buttons: [{label: 'OK'}]});
        return;
    }
    const [A, B] = seamPending, fa = figures[A.fi], fb = figures[B.fi];
    if (A.fi === B.fi && A.edges.some(e => B.edges.includes(e))) {
        showModal({title: 'Costura 3D', body: 'Los dos lados no pueden compartir aristas.', buttons: [{label: 'OK'}]});
        return;
    }
    saveState();
    [[A, fa], [B, fb]].forEach(([s, f]) => s.edges.forEach(ei => { if (f.edges[ei].seam != null) seamClearId(f.edges[ei].seam); }));
    const id = seamNextId();
    A.edges.forEach(ei => { fa.edges[ei].seam = id; fa.edges[ei].seamSide = 'a'; if (seamPendRev) fa.edges[ei].seamRev = true; });
    B.edges.forEach(ei => { fb.edges[ei].seam = id; fb.edges[ei].seamSide = 'b'; if (seamPendRev) fb.edges[ei].seamRev = true; });
    const la = m3dSideLenCm(fa, A.edges), lb = m3dSideLenCm(fb, B.edges);
    const pct = Math.abs(la - lb) / Math.max(la, lb, 1e-6) * 100;
    seamPending = []; seamPendRev = false;
    document.getElementById('seamFlipBtn').classList.remove('on');
    showActiveLabel('Costura ' + id + ': A ' + la.toFixed(1) + ' cm · B ' + lb.toFixed(1) + ' cm' + (pct > 2 ? '  ⚠ ' + pct.toFixed(1) + '% de diferencia' : ' ✓'));
    redrawAll();
}

// ---- Sentido de la costura (⇄) y previsualización de qué punto se une con cuál ----
// El 3D recorre cada lado en sentido antihorario de la pieza; por defecto A y B se enfrentan (A inicio ↔ B final).
// ⇄ invierte B (A inicio ↔ B inicio) para piezas complejas que salen torcidas.
function seamOrderEdges(fig, S) {
    let first = S.find(ei => !S.some(fj => fj !== ei && fig.edges[fj].end === fig.edges[ei].start));
    if (first == null) first = S[0];
    const ordered = [first]; let cur = first;
    for (let g = 0; g < S.length; g++) {
        const nx = S.find(fj => !ordered.includes(fj) && fig.edges[fj].start === fig.edges[cur].end);
        if (nx == null) break;
        ordered.push(nx); cur = nx;
    }
    S.forEach(ei => { if (!ordered.includes(ei)) ordered.push(ei); });
    return ordered;
}

// Polilínea del lado en el mismo sentido que usa el 3D (antihorario de la pieza)
function seamSidePolyline(fig, S) {
    const pl = [];
    seamOrderEdges(fig, S).forEach(ei => {
        const p = sampleFigureEdges({vertices: fig.vertices, edges: [fig.edges[ei]]}, 24);
        p.forEach((q, i) => { if (!(pl.length && i === 0)) pl.push(q); });
    });
    const all = sampleFigureEdges(fig, 8);
    let a = 0;
    for (let i = 0; i < all.length; i++) { const p = all[i], q = all[(i + 1) % all.length]; a += p.x * q.y - q.x * p.y; }
    if (a > 0) pl.reverse();      // en pantalla (y hacia abajo) antihorario de la pieza = área negativa
    return pl;
}

function seamPointAt(pl, t) {
    let L = 0; const acc = [0];
    for (let i = 1; i < pl.length; i++) { L += Math.hypot(pl[i].x - pl[i - 1].x, pl[i].y - pl[i - 1].y); acc.push(L); }
    const d = t * L; let k = 1;
    while (k < acc.length - 1 && acc[k] < d) k++;
    const f = (d - acc[k - 1]) / ((acc[k] - acc[k - 1]) || 1);
    return {x: pl[k - 1].x + (pl[k].x - pl[k - 1].x) * f, y: pl[k - 1].y + (pl[k].y - pl[k - 1].y) * f};
}

function seamDrawPairs(fa, Sa, fb, Sb, rev, color) {
    const A = seamSidePolyline(fa, Sa), B = seamSidePolyline(fb, Sb);
    if (A.length < 2 || B.length < 2) return;
    ctx.save();
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1.5 / viewScale; ctx.setLineDash([]);
    const N = 6;
    for (let i = 0; i <= N; i++) {
        const t = i / N, pa = seamPointAt(A, t), pb = seamPointAt(B, rev ? t : 1 - t);
        ctx.globalAlpha = (i === 0 || i === N) ? 1 : 0.55;
        ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    const fs = getMeasureFontSize() * 1.2;
    ctx.font = 'bold ' + fs + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const dot = (p, txt) => { ctx.beginPath(); ctx.arc(p.x, p.y, 5 / viewScale, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillText(txt, p.x, p.y); ctx.fillStyle = color; };
    // mismas letras en los puntos que se unen: A↔A (inicio), B↔B (mitad), C↔C (final)
    [[0, 'A'], [0.5, 'B'], [1, 'C']].forEach(([t, L]) => {
        dot(seamPointAt(A, t), L);
        dot(seamPointAt(B, rev ? t : 1 - t), L);
    });
    ctx.restore();
}

function seamDelete() {
    if (seamPending.length >= 1) {
        const s = seamPending[0], f = figures[s.fi];
        const id = s.edges.map(ei => f.edges[ei].seam).find(v => v != null);
        if (id != null) {
            saveState(); seamClearId(id); seamPending = [];
            showActiveLabel('Costura ' + id + ' quitada');
            redrawAll(); return;
        }
    }
    showActiveLabel('Para quitar una costura: toca uno de sus lados y luego 🗑');
}

function seamFlip() {
    if (seamPending.length === 2) {
        seamPendRev = !seamPendRev;
        document.getElementById('seamFlipBtn').classList.toggle('on', seamPendRev);
        showActiveLabel('Costura 3D: sentido ' + (seamPendRev ? 'INVERTIDO' : 'normal') + ' (A↔A, B↔B, C↔C)' + ' · ✓ para crear');
        redrawAll(); return;
    }
    if (seamPending.length === 1) {
        const s = seamPending[0], f = figures[s.fi];
        const id = s.edges.map(ei => f.edges[ei].seam).find(v => v != null);
        if (id != null) {
            saveState();
            let now = false;
            figures.forEach(g => g.edges.forEach(e => { if (e.seam === id && e.seamRev) now = true; }));
            figures.forEach(g => g.edges.forEach(e => { if (e.seam === id) { if (now) delete e.seamRev; else e.seamRev = true; } }));
            showActiveLabel('Costura ' + id + ': sentido ' + (now ? 'normal' : 'INVERTIDO') + ' (letras iguales se unen)');
            redrawAll(); return;
        }
    }
    showModal({title: 'Sentido de la costura', body: 'Para invertir el sentido: elige los lados A y B y presiona ⇄ antes de ✓, o toca un lado ya cosido y presiona ⇄.\nLas letras A, B y C muestran qué punto se une con cuál (la misma letra se une con la misma letra).', buttons: [{label: 'OK'}]});
}

// previsualización: pares de las costuras existentes + el par que se está armando
function drawSeamPreview() {
    const bySeam = new Map();
    figures.forEach((f, fi) => { if (f.closed) f.edges.forEach((e, ei) => {
        if (e.seam == null) return;
        const k = e.seam; if (!bySeam.has(k)) bySeam.set(k, {a: null, b: null, rev: false});
        const g = bySeam.get(k), side = e.seamSide === 'b' ? 'b' : 'a';
        if (!g[side]) g[side] = {fi, edges: []};
        if (g[side].fi === fi) g[side].edges.push(ei);
        if (e.seamRev) g.rev = true;
    }); });
    bySeam.forEach((g, id) => { if (g.a && g.b) seamDrawPairs(figures[g.a.fi], g.a.edges, figures[g.b.fi], g.b.edges, g.rev, seamColor(id)); });
    if (seamPending.length === 2) {
        const [A, B] = seamPending;
        if (figures[A.fi] && figures[B.fi]) seamDrawPairs(figures[A.fi], A.edges, figures[B.fi], B.edges, seamPendRev, getResizeHighlightColor());
    }
}

// Dibujo permanente (en cualquier modo) de los lados cosidos + selección pendiente
function drawSeams() {
    drawPieceNames();
    const hasAny = figures.some(f => f.closed && f.edges.some(e => e.seam != null));
    if (!hasAny && !seamPending.length) return;
    const active = mode === 'closeShape' && seamToolActive;
    ctx.save();
    const dark = document.body.classList.contains('dark');
    // tenues cuando la herramienta 🪡 no está activa; en modo claro el fondo es claro y 0.28 se perdía
    ctx.globalAlpha = active ? 1 : (dark ? 0.45 : 0.9);
    figures.forEach(f => {
        if (!f.closed) return;
        const seen = new Set();
        f.edges.forEach((e, ei) => {
            if (e.seam == null) return;
            ctx.strokeStyle = seamColor(e.seam); ctx.lineWidth = (active ? 3.5 : (dark ? 2 : 2.5)) / viewScale;
            ctx.setLineDash([3 / viewScale, 3 / viewScale]);
            const pl = sampleFigureEdges({vertices: f.vertices, edges: [e]}, 24);
            ctx.beginPath(); pl.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
            const key = e.seam + e.seamSide;
            if (active && !seen.has(key)) {
                seen.add(key);
                const m = pl[Math.floor(pl.length / 2)];
                ctx.setLineDash([]);
                ctx.fillStyle = seamColor(e.seam);
                ctx.font = 'bold ' + (getMeasureFontSize() * 1.1) + 'px sans-serif';
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText('🪡' + e.seam + (e.seamSide === 'b' ? 'b' : 'a'), m.x, m.y - 10 / viewScale);
            }
        });
    });
    ctx.globalAlpha = 1;
    if (active) {
        drawSeamPreview();
        const hl = getResizeHighlightColor();
        seamPending.forEach((s, i) => {
            const f = figures[s.fi]; if (!f) return;
            ctx.strokeStyle = hl; ctx.lineWidth = 5 / viewScale; ctx.setLineDash([]);
            s.edges.forEach(ei => {
                const pl = sampleFigureEdges({vertices: f.vertices, edges: [f.edges[ei]]}, 24);
                ctx.beginPath(); pl.forEach((p, k) => k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
            });
            const e0 = f.edges[s.edges[0]], p0 = f.vertices[e0.start];
            ctx.fillStyle = hl; ctx.font = 'bold ' + (getMeasureFontSize() * 1.3) + 'px sans-serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(i ? 'B' : 'A', p0.x, p0.y - 14 / viewScale);
        });
    }
    ctx.restore();
}

// ===================== Nombre de pieza (🏷 Nombre) — subfunción temporal de Unir/Crear figura =====================
// Activa el botón, toca una pieza cerrada y aparece un cuadro para escribir su nombre (fig.name; se usa al exportar).
let nameToolActive = false;
let grainToolActive = false;  // 🧵 Hilo: sentido del hilo (dentro de Unir/Crear figura)
let sizeToolActive = false;   // 🔠 Talla: S, M, L… (separada del nombre de la pieza)

function grainToolReset() {
    grainToolActive = false;
    const b = document.getElementById('grainToolBtn'); if (b) b.classList.remove('on');
    const d = document.getElementById('grainDirBtn'); if (d) d.style.display = 'none';
}

function sizeReset() {
    grainToolReset();
    sizeToolActive = false;
    const b = document.getElementById('sizeBtn');
    if (b) b.classList.remove('on');
}

function nameReset() {
    sizeReset();
    nameToolActive = false;
    const b = document.getElementById('nameBtn');
    if (b) b.classList.remove('on');
}

function toggleNameTool() {
    const on = !nameToolActive;
    if (on) {
        sizeReset();       // (también apaga Hilo)
        if (typeof closeAxisReset === 'function') closeAxisReset();
        seamToolActive = false; seamPending = [];
        const sb = document.getElementById('seamBtn'), so = document.getElementById('seamOkBtn');
        if (sb) sb.classList.remove('on'); if (so) so.style.display = 'none';
        closeLineIndices = [];
    }
    nameToolActive = on;
    document.getElementById('nameBtn').classList.toggle('on', on);
    showActiveLabel(on ? 'Nombre de pieza: toca una pieza cerrada' : MODE_LABELS.closeShape);
    redrawAll();
}

function toggleGrainTool() {
    const on = !grainToolActive;
    if (on) {
        if (typeof closeAxisReset === 'function') closeAxisReset();
        seamToolActive = false; seamPending = [];
        const sb = document.getElementById('seamBtn'), so = document.getElementById('seamOkBtn');
        if (sb) sb.classList.remove('on'); if (so) so.style.display = 'none';
        ['seamFlipBtn', 'seamDelBtn'].forEach(id => { const e = document.getElementById(id); if (e) e.style.display = 'none'; });
        closeLineIndices = [];
        nameReset();
    }
    grainToolActive = on;
    document.getElementById('grainToolBtn').classList.toggle('on', on);
    document.getElementById('grainDirBtn').style.display = on ? 'inline-block' : 'none';
    showActiveLabel(on ? 'Hilo: toca una pieza cerrada (tocar otra vez la quita)' : MODE_LABELS.closeShape);
    redrawAll();
}

function grainToolTap(wx, wy) {
    const fi = findClickedFigure(wx, wy);
    if (fi < 0 || !figures[fi].closed) return;
    saveState();
    figures[fi].grain = (figures[fi].grain === grainDir) ? null : grainDir;
    redrawAll();
}

function toggleSizeTool() {
    const on = !sizeToolActive;
    if (on) {
        grainToolReset();
        if (typeof closeAxisReset === 'function') closeAxisReset();
        seamToolActive = false; seamPending = [];
        const sb = document.getElementById('seamBtn'), so = document.getElementById('seamOkBtn');
        if (sb) sb.classList.remove('on'); if (so) so.style.display = 'none';
        ['seamFlipBtn', 'seamDelBtn'].forEach(id => { const e = document.getElementById(id); if (e) e.style.display = 'none'; });
        closeLineIndices = [];
        nameToolActive = false; document.getElementById('nameBtn').classList.remove('on');
    }
    sizeToolActive = on;
    document.getElementById('sizeBtn').classList.toggle('on', on);
    showActiveLabel(on ? 'Talla: toca una pieza cerrada' : MODE_LABELS.closeShape);
    redrawAll();
}

async function sizeTap(wx, wy) {
    const fi = findClickedFigure(wx, wy);
    if (fi < 0 || !figures[fi].closed) return;
    const f = figures[fi];
    const res = await showModal({title: 'Talla de la pieza', nameLabel: 'Talla', nameInputDefault: f.talla || '', buttons: [{label: 'Guardar', value: 'ok'}, {label: 'Cancelar', value: 'no'}]});
    if (!res || res.action !== 'ok') return;
    saveState();
    if (res.name) f.talla = res.name; else delete f.talla;
    showActiveLabel('Talla: ' + (f.talla || '(sin talla)'));
    redrawAll();
}

async function nameTap(wx, wy) {
    const fi = findClickedFigure(wx, wy);
    if (fi < 0 || !figures[fi].closed) return;
    const f = figures[fi];
    const res = await showModal({title: 'Nombre de la pieza', nameInputDefault: f.name || '', buttons: [{label: 'Guardar', value: 'ok'}, {label: 'Cancelar', value: 'no'}]});
    if (!res || res.action !== 'ok') return;
    saveState();
    if (res.name) f.name = res.name; else delete f.name;
    showActiveLabel('Nombre de pieza: ' + (f.name || '(sin nombre)'));
    redrawAll();
}

function drawPieceNames() {
    const showNames = nameToolActive && mode === 'closeShape';     // el nombre solo se ve con 🏷 activo; la talla siempre
    if (!figures.some(f => f.closed && ((showNames && f.name) || f.talla))) return;
    ctx.save();
    ctx.fillStyle = getResizeHighlightColor();
    ctx.font = 'bold ' + (getMeasureFontSize() * 1.2) + 'px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    figures.forEach(f => {
        if (!(f.closed && ((showNames && f.name) || f.talla))) return;
        const c = getCentroid(f), fs = getMeasureFontSize() * 1.2, nm = showNames && f.name;
        if (nm) ctx.fillText(f.name, c.x, c.y);
        if (f.talla) { ctx.save(); ctx.font = 'bold ' + (fs * 1.1) + 'px sans-serif'; ctx.globalAlpha = 0.85; ctx.fillText('[' + f.talla + ']', c.x, c.y + (nm ? fs * 1.4 : 0)); ctx.restore(); }
    });
    ctx.restore();
}
