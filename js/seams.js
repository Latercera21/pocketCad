// PocketCAD - módulo: costuras para el visor 3D (herramienta 🪡 dentro de "Unir / Crear figura")
// Toca un lado de una pieza cerrada (lado A) y luego el lado que se cose con él (lado B); ✓ crea la costura.
// Un lado = la cadena entre esquinas duras (curvas multipunto) o una arista. Se guarda en cada arista:
// edge.seam = id, edge.seamSide = 'a'|'b'. Tocar un lado que ya tiene costura y ✓ la quita.

let seamToolActive = false;
let seamPending = [];   // hasta 2 lados: {fi, edges:[ei...]}

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
    figures.forEach(f => f.edges.forEach(e => { if (e.seam === id) { delete e.seam; delete e.seamSide; } }));
}

function seamResetUI() {
    if (typeof nameReset === 'function') nameReset();
    seamToolActive = false;
    seamPending = [];
    const b = document.getElementById('seamBtn'), o = document.getElementById('seamOkBtn');
    if (b) b.classList.remove('on');
    if (o) o.style.display = 'none';
}

function toggleSeamTool() {
    const on = !seamToolActive;
    if (on && typeof closeAxisReset === 'function') closeAxisReset();
    if (on) nameReset();
    seamToolActive = on;
    seamPending = [];
    closeLineIndices = [];
    document.getElementById('seamBtn').classList.toggle('on', on);
    document.getElementById('seamOkBtn').style.display = on ? 'inline-block' : 'none';
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
    showActiveLabel('Costura 3D: ' + (lbl || 'toca el lado A y luego el lado B, ✓'));
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
    A.edges.forEach(ei => { fa.edges[ei].seam = id; fa.edges[ei].seamSide = 'a'; });
    B.edges.forEach(ei => { fb.edges[ei].seam = id; fb.edges[ei].seamSide = 'b'; });
    const la = m3dSideLenCm(fa, A.edges), lb = m3dSideLenCm(fb, B.edges);
    const pct = Math.abs(la - lb) / Math.max(la, lb, 1e-6) * 100;
    seamPending = [];
    showActiveLabel('Costura ' + id + ': A ' + la.toFixed(1) + ' cm · B ' + lb.toFixed(1) + ' cm' + (pct > 2 ? '  ⚠ ' + pct.toFixed(1) + '% de diferencia' : ' ✓'));
    redrawAll();
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

function nameReset() {
    nameToolActive = false;
    const b = document.getElementById('nameBtn');
    if (b) b.classList.remove('on');
}

function toggleNameTool() {
    const on = !nameToolActive;
    if (on) {
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
    if (!(mode === 'closeShape' && nameToolActive)) return;
    ctx.save();
    ctx.fillStyle = getResizeHighlightColor();
    ctx.font = 'bold ' + (getMeasureFontSize() * 1.2) + 'px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    figures.forEach(f => { if (f.closed && f.name) { const c = getCentroid(f); ctx.fillText(f.name, c.x, c.y); } });
    ctx.restore();
}
