// PocketCAD - módulo: icons
// Iconos de línea (SVG, 1.7 px, hereda el color del botón) para los botones temporales nuevos, en el mismo
// estilo delgado del programa. Se aplican al cargar; el texto del botón se conserva.
const PC_ICONS = {
    move:   '<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>',
    scale:  '<path d="M4 12h8v8H4z"/><path d="M12 12l8-8M14 4h6v6"/>',
    name:   '<path d="M3 4h8.5L21 13.5 13.5 21 3 10.5z"/><circle cx="7.5" cy="8.5" r="1.2"/>',
    size:   '<path d="M3 8h18v8H3z"/><path d="M7 8v3M11 8v4M15 8v3M19 8v4"/>',
    seam:   '<path d="M5 4v16M19 4v16"/><path d="M5 7l14 2M5 12l14 2M5 17l14 2" stroke-dasharray="3 2.2"/>',
    flip:   '<path d="M4 8h14l-3-3M20 16H6l3 3"/>',
    trash:  '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
    curve:  '<path d="M3 19C8 3 16 3 21 19"/><circle cx="12" cy="7.2" r="2.2"/>',
    compass:'<path d="M12 3v4M12 7L6 21M12 7l6 14M8.5 15h7"/>',
    chain:  '<path d="M4 12h16M4 8v8M20 8v8"/>',
    seg:    '<path d="M4 12h6M14 12h6M4 9v6M10 9v6M14 9v6M20 9v6"/>',
    grain:  '<path d="M4 8h16M4 12h16M4 16h16" opacity=".55"/><path d="M17 5l3 3M17 19l3-3M7 5L4 8M7 19l-3-3"/>',
    create: '<path d="M4 6h16v12H4z"/>',
    line:   '<path d="M5 19L19 5"/><circle cx="5" cy="19" r="1.7"/><circle cx="19" cy="5" r="1.7"/>',
    vertex: '<path d="M4 19l8-13 8 13"/><circle cx="12" cy="6" r="2.2"/>',
    snap:   '<path d="M7 3v8a5 5 0 0 0 10 0V3M7 7h3M14 7h3"/>',
    resize: '<path d="M3 12h18M3 8v8M21 8v8M7 12l2-2M7 12l2 2M17 12l-2-2M17 12l-2 2"/>',
    shirt:  '<path d="M8 4l4 3 4-3 4 4-3 3v9H7v-9L4 8z"/>',
    lock:   '<path d="M6 11h12v9H6z"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    rotate: '<path d="M20 12a8 8 0 1 1-2.5-5.8"/><path d="M20 4v5h-5"/>',
    cut:    '<circle cx="6" cy="6.5" r="2.5"/><circle cx="6" cy="17.5" r="2.5"/><path d="M8 8l12 10M8 16L20 6"/>',
    dart:   '<path d="M4 6h16"/><path d="M8 6l4 13 4-13"/>',
    bg:     '<path d="M4 5h16v14H4z"/><path d="M4 15l5-5 4 4 3-3 4 4"/><circle cx="15.5" cy="9" r="1.3"/>',
    cube:   '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12L4 7.5M12 12v9"/>',
    folder: '<path d="M3 7h6l2 2h10v10H3z"/>',
    curveedge:'<path d="M4 18c5 0 3-12 8-12s3 12 8 12"/>',
    straighten:'<path d="M3 13c3-9 6-9 9-4s6 4 9-4"/><path d="M4 20h16"/>',
    transform:'<rect x="4" y="8" width="12" height="12" rx="1.5"/><path d="M8 8V4h12v12h-4"/>',
    offset: '<path d="M4 16c4-8 12-8 16 0M4 21c5-10 11-10 16 0"/><path d="M12 3v3M10.5 4.5L12 3l1.5 1.5"/>',
    grade:  '<rect x="4" y="4" width="16" height="16" rx="1"/><rect x="8" y="8" width="8" height="8" rx="1"/>',
    zoom:   '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
    reset:  '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>',
    undo:   '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/>',
    theme:  '<path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z"/>',
    snapedge:'<path d="M6 3v7a4 4 0 0 0 8 0V3M6 6h3M11 6h3"/><path d="M4 21h16"/>',
    addpt:  '<circle cx="9" cy="12" r="2.6"/><path d="M18 8v8M14 12h8"/>',
    delpt:  '<circle cx="9" cy="12" r="2.6"/><path d="M14 12h8"/>',
    corner: '<path d="M5 5v14h14"/><circle cx="5" cy="19" r="2"/>',
    pin:    '<path d="M12 21s-6-5.5-6-10a6 6 0 0112 0c0 4.5-6 10-6 10z"/><circle cx="12" cy="11" r="2"/>',
    ruler:  '<path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>',
    eye:    '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    circle: '<circle cx="12" cy="12" r="8"/>',
    multicurve:'<path d="M3 18c4 0 4-12 9-12s5 12 9 12"/><path d="M19 3v6M16 6h6"/>'
};
function pcIcon(name) {
    return '<svg class="pcico" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + PC_ICONS[name] + '</svg>';
}
function setBtnIcon(id, icon, label) {
    const b = document.getElementById(id);
    if (!b) return;
    b.innerHTML = pcIcon(icon) + (label ? '<span class="pclbl">' + label + '</span>' : '');
}
function applyButtonIcons() {
    setBtnIcon('moveBtn', 'move');
    setBtnIcon('grainToolBtn', 'grain', 'Hilo');
    setBtnIcon('createBtn', 'create');
    setBtnIcon('lineBtn', 'line');
    setBtnIcon('vertexBtn', 'vertex');
    setBtnIcon('snapBtn', 'snap');
    setBtnIcon('resizeBtn', 'resize');
    setBtnIcon('closeShapeBtn', 'shirt');
    setBtnIcon('lockBtn', 'lock');
    setBtnIcon('rotateBtn', 'rotate');
    setBtnIcon('cutBtn', 'cut');
    setBtnIcon('dartBtn', 'dart');
    setBtnIcon('bgBtn', 'bg');
    setBtnIcon('view3dBtn', 'cube');
    setBtnIcon('fileBtn', 'folder');
    setBtnIcon('moveScaleBtn', 'scale', 'Escalar');
    setBtnIcon('nameBtn', 'name', 'Nombre');
    setBtnIcon('sizeBtn', 'size', 'Talla');
    setBtnIcon('seamBtn', 'seam', 'Coser');
    setBtnIcon('seamFlipBtn', 'flip');
    setBtnIcon('seamDelBtn', 'trash');
    setBtnIcon('vertexCurveBtn', 'curve', 'pt');
    setBtnIcon('rotateAlignBtn', 'compass', 'Compás');
    setBtnIcon('curveBtn', 'curveedge');
    setBtnIcon('straightenBtn', 'straighten');
    setBtnIcon('snapEdgeBtn', 'snapedge');
    setBtnIcon('transformToggleBtn', 'transform');
    setBtnIcon('costuraBtn', 'offset');
    setBtnIcon('tallasBtn', 'grade');
    setBtnIcon('deleteBtn', 'trash');
    setBtnIcon('zoomToggleBtn', 'zoom', Math.round(viewScale*100)+'%');
    setBtnIcon('themeToggleBtn', 'theme');
    setBtnIcon('vertexAddBtn', 'addpt', 'v');
    setBtnIcon('vertexDelBtn', 'delpt', 'v');
    setBtnIcon('vertexHardBtn', 'corner', 'pt');
    setBtnIcon('vertexLockBtn', 'pin', 'Coord…');
    setBtnIcon('curveMultiBtn', 'multicurve');
    setBtnIcon('curveAddBtn', 'addpt', 'pt');
    setBtnIcon('curveDelBtn', 'delpt', 'pt');
    setBtnIcon('tallasCoordBtn', 'pin', 'XY');
    setBtnIcon('bgCalibBtn', 'ruler', 'Calibrar');
    setBtnIcon('rotateBaseBtn', 'ruler', 'Base');
    setBtnIcon('bgLockBtn', 'lock');
    setBtnIcon('bgVisBtn', 'eye');
    setBtnIcon('createCircleBtn', 'circle');
    document.querySelectorAll('.joinBtn').forEach(b => { b.innerHTML = pcIcon('snap') + '<span class="pclbl">Unir</span>'; });
    { const rb = document.querySelector('.toolbar button[onclick="resetView()"]'); if (rb) rb.innerHTML = pcIcon('reset'); }
    { const ub = document.querySelector('.toolbar button[onclick="undoAction()"]'); if (ub) ub.innerHTML = pcIcon('undo'); }
    setBtnIcon('resizeChainBtn', resizeChainMode ? 'chain' : 'seg', resizeChainMode ? 'Lado' : 'Tramo');
}
window.addEventListener('load', applyButtonIcons);
