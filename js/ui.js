// PocketCAD - módulo: ui
// Generado a partir de la división del archivo monolítico original.

    function getToolbarHeight() {
        return document.querySelector('.toolbar').getBoundingClientRect().height;
    }

    function getSnapThreshold() { return SNAP_THR_PX / viewScale; }

    function resizeCanvas() {
        const dpr = window.devicePixelRatio || 1;
        canvas.width  = window.innerWidth  * dpr;
        canvas.height = window.innerHeight * dpr;
        canvas.style.width  = window.innerWidth  + 'px';
        canvas.style.height = window.innerHeight + 'px';
        positionTopBar();
        redrawAll();
    }

    function positionTopBar() {
        document.getElementById('topBar').style.top = (getToolbarHeight() + 4) + 'px';
    }

    function showPanel(id) {
        const el = document.getElementById(id);
        el.style.display = 'flex';
        el.style.top  = (getToolbarHeight() + 6) + 'px';
        el.style.left = '4px';
    }

    function hidePanel(id) {
        document.getElementById(id).style.display = 'none';
        if (id === 'vertexInputs') {
            selectedVertex = null;
            vertexFijarActive = false;
            document.getElementById('vertexLockBtn').classList.remove('on');
            document.getElementById('vertexCoordInputs').style.display = 'none';
        }
        if (id === 'resizeInputs') {
            selectedEdge = null;
            resizeEdges = [];
            resizeStretchMode = false;
            document.getElementById('resizeValue').disabled = false;
            document.getElementById('resizeIndicator').textContent = '';
            document.getElementById('resizeStretchBtn').style.display = 'none';
            document.getElementById('resizeStretchBtn').classList.remove('on');
        }
        if (id === 'offsetInputs') { selectedEdge = null; }
        redrawAll();
    }

    function toggleVertexFijar(){
        vertexFijarActive = !vertexFijarActive;
        document.getElementById('vertexLockBtn').classList.toggle('on', vertexFijarActive);
        document.getElementById('vertexCoordInputs').style.display = vertexFijarActive ? 'flex' : 'none';
    }

    // Agregar/Eliminar vértice: subfunciones temporales dentro de "Editar vértice",
    // mutuamente excluyentes entre sí (y con el arrastre normal de vértice).
    function toggleVertexAdd(){
        vertexAddActive = !vertexAddActive;
        if (vertexAddActive) { vertexDelActive=false; document.getElementById('vertexDelBtn').classList.remove('on'); }
        document.getElementById('vertexAddBtn').classList.toggle('on', vertexAddActive);
        document.getElementById('vertexAddButtons').style.display = vertexAddActive ? 'inline-flex' : 'none';
        redrawAll();
    }

    function toggleVertexDel(){
        vertexDelActive = !vertexDelActive;
        if (vertexDelActive) { vertexAddActive=false; document.getElementById('vertexAddBtn').classList.remove('on'); document.getElementById('vertexAddButtons').style.display='none'; }
        document.getElementById('vertexDelBtn').classList.toggle('on', vertexDelActive);
        redrawAll();
    }

    function toggleResizeStretchMode(){
        resizeStretchMode = !resizeStretchMode;
        document.getElementById('resizeStretchBtn').classList.toggle('on', resizeStretchMode);
    }

    // ===================== TEMA CLARO/OSCURO =====================
    function toggleTheme() {
        document.body.classList.toggle('dark');
        try { localStorage.setItem('pocketcad_theme', document.body.classList.contains('dark') ? 'dark' : 'light'); } catch(e) {}
        redrawAll();
    }

    function restoreTheme() {
        try { if (localStorage.getItem('pocketcad_theme') === 'dark') document.body.classList.add('dark'); } catch(e) {}
    }

    // ===================== MENU TRANSFORMAR (desdoblar/copiar/reflejar) =====================
    function toggleTransformGroup(e) {
        const menu = document.getElementById('transformMenu');
        if (menu.style.display === 'flex') { hideTransformMenu(); return; }
        if (mode==='mirror' || mode==='duplicate' || mode==='reflect') { setMode('none'); return; }
        if (mode!=='none') setMode('none');
        const btn = document.getElementById('transformToggleBtn');
        const r = btn.getBoundingClientRect();
        menu.style.top = (r.bottom + 3) + 'px';
        menu.style.left = r.left + 'px';
        menu.style.display = 'flex';
        btn.classList.add('on');
        showActiveLabel('Desdoblar / Copiar / Reflejar');
        if (e) e.stopPropagation();
        setTimeout(() => document.addEventListener('click', hideTransformMenuOutside), 0);
    }

    function hideTransformMenu() {
        document.getElementById('transformMenu').style.display = 'none';
        if (mode!=='mirror' && mode!=='duplicate' && mode!=='reflect') {
            hideActiveLabel();
            document.getElementById('transformToggleBtn').classList.remove('on');
        }
        document.removeEventListener('click', hideTransformMenuOutside);
    }

    function hideTransformMenuOutside(e) {
        const menu = document.getElementById('transformMenu');
        const btn = document.getElementById('transformToggleBtn');
        if (!menu.contains(e.target) && e.target !== btn) hideTransformMenu();
    }

    function toggleZoomButtons(e) {
        const menu = document.getElementById('zoomMenu');
        if (menu.style.display === 'flex') { hideZoomMenu(); return; }
        const btn = document.getElementById('zoomToggleBtn');
        const r = btn.getBoundingClientRect();
        menu.style.top = (r.bottom + 3) + 'px';
        menu.style.left = r.left + 'px';
        menu.style.display = 'flex';
        document.getElementById('zoomToggleBtn').classList.add('on');
        if (e) e.stopPropagation();
        setTimeout(() => document.addEventListener('click', hideZoomMenuOutside), 0);
    }

    function hideZoomMenu() {
        document.getElementById('zoomMenu').style.display = 'none';
        document.getElementById('zoomToggleBtn').classList.remove('on');
        document.removeEventListener('click', hideZoomMenuOutside);
    }

    function hideZoomMenuOutside(e) {
        const menu = document.getElementById('zoomMenu');
        const btn = document.getElementById('zoomToggleBtn');
        if (!menu.contains(e.target) && e.target !== btn) hideZoomMenu();
    }

    // ===================== MENU DE ARCHIVO (exportar/importar) =====================
    function toggleFileMenu(e) {
        const menu = document.getElementById('fileMenu');
        if (menu.style.display === 'flex') { hideFileMenu(); return; }
        const btn = document.getElementById('fileBtn');
        const r = btn.getBoundingClientRect();
        menu.style.top = (r.bottom + 3) + 'px';
        menu.style.left = r.left + 'px';
        menu.style.display = 'flex';
        if (e) e.stopPropagation();
        setTimeout(() => document.addEventListener('click', hideFileMenuOutside), 0);
    }

    function hideFileMenu() {
        document.getElementById('fileMenu').style.display = 'none';
        document.removeEventListener('click', hideFileMenuOutside);
    }

    function hideFileMenuOutside(e) {
        const menu = document.getElementById('fileMenu');
        const btn = document.getElementById('fileBtn');
        if (!menu.contains(e.target) && e.target !== btn) hideFileMenu();
    }

    function showModal({ title, body, textarea, buttons, editable = false, nameInputDefault } = {}) {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        const box = document.createElement('div');
        box.className = 'modal-box';
        const t = document.createElement('div');
        t.className = 'modal-title'; t.textContent = title; box.appendChild(t);
        if (body) { const p = document.createElement('div'); p.textContent = body; box.appendChild(p); }
        let nameEl = null;
        if (nameInputDefault !== undefined) {
            const nameRow = document.createElement('div');
            nameRow.style.display = 'flex'; nameRow.style.gap = '6px'; nameRow.style.alignItems = 'center';
            const lbl = document.createElement('span'); lbl.textContent = 'Nombre:'; lbl.style.fontSize = '13px';
            nameEl = document.createElement('input');
            nameEl.type = 'text'; nameEl.value = nameInputDefault;
            nameEl.style.flex = '1'; nameEl.style.fontSize = '13px'; nameEl.style.padding = '5px';
            nameEl.style.background = 'var(--input-bg)'; nameEl.style.border = '1px solid var(--input-border)';
            nameEl.style.color = 'var(--text)'; nameEl.style.borderRadius = '3px';
            nameRow.appendChild(lbl); nameRow.appendChild(nameEl);
            box.appendChild(nameRow);
        }
        let taEl = null;
        if (textarea !== undefined) {
            taEl = document.createElement('textarea');
            taEl.value = textarea; taEl.readOnly = !editable; box.appendChild(taEl);
        }
        const row = document.createElement('div'); row.className = 'modal-row';
        buttons.forEach(btn => {
            const b = document.createElement('button');
            b.textContent = btn.label;
            b.onclick = () => {
                document.body.removeChild(overlay);
                const val = btn.value ?? btn.label;
                resolve(nameEl ? {action: val, name: nameEl.value.trim()} : val);
            };
            row.appendChild(b);
        });
        box.appendChild(row); overlay.appendChild(box);
        overlay.addEventListener('click', e => { if(e.target===overlay){document.body.removeChild(overlay);resolve(null);} });
        document.body.appendChild(overlay);
        if (taEl) setTimeout(() => taEl.select(), 80);
    });
}

    function updateZoomIndicator() {
        document.getElementById('zoomToggleBtn').textContent = '🔍 ' + Math.round(viewScale*100)+'%';
    }

    function resetView() {
        viewScale=1; viewOffX=0; viewOffY=0;
        updateZoomIndicator(); redrawAll();
    }

    function applyZoom(delta, cx, cy) {
        const factor = delta > 0 ? 0.9 : 1.1;
        const ns = Math.min(10, Math.max(0.01, viewScale * factor));
        viewOffX = cx - (cx - viewOffX) * (ns / viewScale);
        viewOffY = cy - (cy - viewOffY) * (ns / viewScale);
        viewScale = ns;
        updateZoomIndicator(); redrawAll();
    }

    function toggleGrainDir() {
        grainDir = grainDir==='horizontal' ? 'vertical' : 'horizontal';
        document.getElementById('grainDirBtn').textContent = grainDir==='horizontal' ? '→' : '↕';
    }

    function toggleGrainMode()  { setMode('grain'); }

    function toggleCreate()     {
        if (mode==='create') { setMode('none'); return; }
        setMode('create');
        showPanel('createInputs');
    }

    function toggleLine()       { setMode('line'); }

    function toggleMove()       { setMode('move'); }

    function toggleStraighten() { setMode('straighten'); }

    function toggleDelete()     { setMode('delete'); }

    function toggleLock()       { setMode('lock'); }

 
    function toggleMirror()     { setMode('mirror'); }

    function toggleDivideMid() {
        divideMidpoint = !divideMidpoint;
        document.getElementById('divideMidBtn').classList.toggle('on', divideMidpoint);
    }

    function toggleResize()     { setMode('resize'); }

    function toggleEdgeMove()   { setMode('edgeMove'); }

    function toggleRotate()     {
        if (mode==='rotate') { setMode('none'); return; }
        setMode('rotate');
        document.getElementById('rotateSlider').value = 0;
    }

    function toggleDuplicate()  { setMode('duplicate'); }

    function toggleReflect()    { setMode('reflect'); }

    function toggleVertex() {
        if (mode==='vertex') { setMode('none'); hidePanel('vertexInputs'); }
        else { setMode('vertex'); }
    }

function toggleSnap() {
    snapEnabled = !snapEnabled;
    document.getElementById('snapBtn').classList.toggle('on', snapEnabled);
    const edgeBtn = document.getElementById('snapEdgeBtn');
    edgeBtn.style.display = snapEnabled ? 'inline-block' : 'none';
    if (!snapEnabled) { snapEdgeEnabled = false; edgeBtn.classList.remove('on'); }
    if (snapEnabled) showActiveLabel('Snap');
    else if (mode!=='none') showActiveLabel(MODE_LABELS[mode] || mode);
    else hideActiveLabel();
}

function toggleSnapEdge() {
    snapEdgeEnabled = !snapEdgeEnabled;
    document.getElementById('snapEdgeBtn').classList.toggle('on', snapEdgeEnabled);
    showActiveLabel(snapEdgeEnabled ? 'Snap a arista' : 'Snap');
}

    function toggleCut() {
        if (mode==='cut') {
            setMode('none');
            document.getElementById('cutApplyBtn').style.display='none';
            cutLineIndices=[]; redrawAll();
        } else {
            setMode('cut');
            document.getElementById('cutApplyBtn').style.display='inline-block';
            cutLineIndices=[];
        }
    }

    function toggleCloseShape() {
        if (mode==='closeShape') {
            setMode('none');
            document.getElementById('closeApplyBtn').style.display='none';
            closeLineIndices=[]; redrawAll();
        } else {
            setMode('closeShape');
            document.getElementById('closeApplyBtn').style.display='inline-block';
            closeLineIndices=[];
        }
    }

    // Modo curva: por defecto es la curva original (arrastre de 1 punto, cuadrática).
    // Dentro del mismo modo, el panel flotante permite activar temporalmente la subfunción
    // multipunto (Catmull-Rom) con sus propios botones de agregar/quitar punto.
    function toggleCurve() {
        if (mode==='curve') { setMode('none'); }
        else { setMode('curve'); }
    }

    function toggleCurveMulti() {
        curveMultiActive = !curveMultiActive;
        curveActiveDrag = null; curveMultiDrag = null;
        document.getElementById('curveMultiBtn').classList.toggle('on', curveMultiActive);
        document.getElementById('curveMultiButtons').style.display = curveMultiActive ? 'flex' : 'none';
        if (curveMultiActive) { setCurveAddMode(); endCurveDraw(); } else curveRemoveMode = false;
        redrawAll();
    }

    // Dibujar seguido (subfunción temporal dentro de "curve"): cada toque agrega un
    // punto nuevo a una curva que se va armando de cero (no modifica aristas
    // existentes, como sí hacen la curva original y la multipunto). Con snap, igual
    // que las rectas. Tocar el botón de nuevo cierra la curva actual; el próximo
    // toque en el lienzo empieza una curva nueva.
    function toggleCurveDraw() {
        if (curveDrawActive) { endCurveDraw(); redrawAll(); return; }
        curveMultiActive = false; curveRemoveMode = false;
        document.getElementById('curveMultiBtn').classList.remove('on');
        document.getElementById('curveMultiButtons').style.display = 'none';
        curveDrawActive = true;
        document.getElementById('curveDrawBtn').classList.add('on');
        redrawAll();
    }

    function endCurveDraw() {
        curveDrawActive = false;
        curveDrawPoints = [];
        curveDrawFigureIndex = null;
        document.getElementById('curveDrawBtn').classList.remove('on');
    }

    function setCurveAddMode() {
        curveRemoveMode = false;
        document.getElementById('curveAddBtn').classList.add('on');
        document.getElementById('curveDelBtn').classList.remove('on');
    }

    function setCurveRemoveMode() {
        curveRemoveMode = true;
        document.getElementById('curveDelBtn').classList.add('on');
        document.getElementById('curveAddBtn').classList.remove('on');
    }

    function showActiveLabel(text){
        const el = document.getElementById('activeModeLabel');
        el.textContent = text;
        el.style.top = (getToolbarHeight() + 4) + 'px';
        el.style.display = 'block';
    }

    function hideActiveLabel(){
        document.getElementById('activeModeLabel').style.display = 'none';
    }

    function setMode(newMode) {
        const prev = mode;
        ALL_MODES.forEach(m => {
            const btn = document.getElementById(m+'Btn');
            if (btn) btn.classList.remove('on');
        });
        document.getElementById('transformToggleBtn').classList.remove('on');
        if (prev==='resize')     { hidePanel('resizeInputs'); }
        if (prev==='vertex') {
            hidePanel('vertexInputs');
            vertexAddActive=false; vertexDelActive=false; divideMidpoint=false;
            document.getElementById('vertexAddBtn').classList.remove('on');
            document.getElementById('vertexAddButtons').style.display='none';
            document.getElementById('divideMidBtn').classList.remove('on');
            document.getElementById('vertexDelBtn').classList.remove('on');
        }
        if (prev==='costura' || prev==='tallas') {
            hidePanel('offsetInputs'); offsetEdges=[]; offsetVertexAxis={}; offsetEdgeDist={};
            offsetDirMode=false; offsetArmedAxis=null; offsetDistMode=false; offsetDistAvgArmed=false;
            tallasCoordActive=false; selectedVertex=null;
            discardOffsetRef();
            document.getElementById('offsetDirBtn').classList.remove('on');
            document.getElementById('offsetAxisButtons').style.display='none';
            document.getElementById('offsetAxisXBtn').classList.remove('on');
            document.getElementById('offsetAxisYBtn').classList.remove('on');
            document.getElementById('offsetTallaCounts').style.display='none';
            document.getElementById('tallasCoordBtn').classList.remove('on');
            document.getElementById('tallasCoordInputs').style.display='none';
        }
        if (prev==='cut')        { document.getElementById('cutApplyBtn').style.display='none'; cutLineIndices=[]; }
        if (prev==='closeShape') { document.getElementById('closeApplyBtn').style.display='none'; closeLineIndices=[]; }
        if (prev==='line')       { lineStartPoint = null; }
        if (prev==='curve')      { curveActiveDrag = null; curveMultiDrag = null; curveMultiActive = false; curveRemoveMode = false;
            hidePanel('curveInputs');
            document.getElementById('curveMultiBtn').classList.remove('on');
            document.getElementById('curveMultiButtons').style.display='none';
            document.getElementById('curveAddBtn').classList.remove('on');
            document.getElementById('curveDelBtn').classList.remove('on');
            endCurveDraw(); }
        if (prev==='create')     { hidePanel('createInputs'); }
        if (prev==='rotate')     { hidePanel('rotatePanel'); rotateActiveFigure=null; }
        if (prev==='delete')     { document.getElementById('clearAllBtn').style.display='none'; }

        if (newMode===prev || newMode==='none') { mode='none'; document.getElementById('grainDirBtn').style.display='none'; hideActiveLabel(); redrawAll(); return; }

        mode = newMode;
        document.getElementById('grainDirBtn').style.display = newMode==='grain' ? 'inline-block' : 'none';
        const btn = document.getElementById(newMode+'Btn');
        if (btn) btn.classList.add('on');
        if (newMode==='mirror'||newMode==='duplicate'||newMode==='reflect') document.getElementById('transformToggleBtn').classList.add('on');
        showActiveLabel(MODE_LABELS[newMode] || newMode);

        selectedFigureForMeasure = null;
        selectedEdgeMoveForMeasure = null;

        if (newMode==='delete')     document.getElementById('clearAllBtn').style.display='inline-block';
        if (newMode==='resize')     showPanel('resizeInputs');
        if (newMode==='vertex')     showPanel('vertexInputs');
        if (newMode==='costura' || newMode==='tallas') {
            showPanel('offsetInputs');
            document.getElementById('offsetTallaCounts').style.display = (newMode==='tallas') ? 'inline-flex' : 'none';
        }
        if (newMode==='rotate')     showPanel('rotatePanel');
        if (newMode==='curve')     showPanel('curveInputs');
        redrawAll();
    }

function centerViewOnFigures(){
    if(figures.length===0) return;
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    figures.forEach(fig=>fig.vertices.forEach(v=>{
        minX=Math.min(minX,v.x);minY=Math.min(minY,v.y);
        maxX=Math.max(maxX,v.x);maxY=Math.max(maxY,v.y);
    }));
    const W=window.innerWidth, H=window.innerHeight-getToolbarHeight();
    const figW=maxX-minX, figH=maxY-minY;
    viewScale=Math.min(W/figW, H/figH)*0.85;
    viewOffX=W/2 - (minX+figW/2)*viewScale;
    viewOffY=getToolbarHeight() + H/2 - (minY+figH/2)*viewScale;
    updateZoomIndicator();
}
