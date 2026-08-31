// PocketCAD - módulo: state
// Generado a partir de la división del archivo monolítico original.

    const PX_PER_CM = 96 / 2.54;

    function cmToPx(str) {
        const v = parseFloat(String(str).trim().replace(',', '.'));
        return isNaN(v) ? NaN : v * PX_PER_CM;
    }

    function pxToCm(px) { return parseFloat((px / PX_PER_CM).toFixed(2)); }

    const canvas = document.getElementById('canvas');

    const ctx    = canvas.getContext('2d');

    let figures        = [];

    let figuresHistory = [];

    let mode           = 'none';

    let dragData       = null;

    let selectedVertex = null;

    let selectedEdge   = null;

    let resizeEdges    = [];

    let snapEnabled    = false;

    let snapEdgeEnabled = false;

    
    let grainDir       = 'horizontal';

    let lineStartPoint = null;

    let offsetEdges = [];

    let selectedFigureForMeasure = null;

   
    let selectedEdgeMoveForMeasure = null;

 
    let rotateActiveFigure = null;

    let rotateStartAngle = 0;

    // --- Autoguardado en localStorage ---
    const AUTOSAVE_KEY = 'pocketcad_autosave';

    let autoSaveTimer = null;

    function autoSaveDebounced() {
        clearTimeout(autoSaveTimer);
        autoSaveTimer = setTimeout(() => {
            try { localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({figures, grainDir})); } catch(e) {}
        }, 800);
    }

    function restoreAutoSave() {
        try {
            const raw = localStorage.getItem(AUTOSAVE_KEY);
            if (!raw) return;
            const data = JSON.parse(raw);
            if (data.figures && data.figures.length) {
                figures = data.figures;
                if (data.grainDir) {
                    grainDir = data.grainDir;
                    document.getElementById('grainDirBtn').textContent = grainDir==='horizontal' ? '→' : '↕';
                }
                centerViewOnFigures();
            }
        } catch(e) {}
    }

    // --- Estado de corte ---
    let cutLineIndices = [];

 

    // --- Estado de cerrar figura ---
    let closeLineIndices = [];

 

    // --- Estado de curva midpoint drag ---
    let curveActiveDrag = null;

 

    let viewScale = 0.2, viewOffX = 0, viewOffY = 0;

    let isPanning = false, panStart = {x:0,y:0};

    let pinchStartDist = null, pinchStartScale = 1, pinchLastCx = null, pinchLastCy = null;

    let isTouchDevice = false, lastTouchTime = 0;

    const SNAP_THR_PX = 15;

    let vertexFijarActive = false;

    let resizeStretchMode = false;

    let offsetDirMode = false;

    let offsetArmedAxis = null;

    let offsetVertexAxis = {};

    let offsetDistMode = false;

    let offsetEdgeDist = {};

 // key: fi+'_'+edgeIndex -> número en px propio de ese segmento, o 'avg' (promedio con vecinos)
    let offsetDistAvgArmed = false;

    let offsetRefIndex = null;
    let offsetTallaMode = false; // false = Costura (margen, no deja copia) | true = Tallas (gradación, conserva la base)

    function saveState() {
        figuresHistory.push(JSON.parse(JSON.stringify(figures)));
        if (figuresHistory.length > 20) figuresHistory.shift();
    }

    function undoAction() {
        if (figuresHistory.length > 0) { figures = figuresHistory.pop(); redrawAll(); }
        else showModal({ title:'Deshacer', body:'No hay acciones para deshacer.', buttons:[{label:'OK'}] });
    }

    function clearAll() {
        showModal({
            title: '¿Eliminar todo?',
            body: 'Se eliminarán todas las figuras.',
            buttons: [{label:'Eliminar todo',value:'yes'},{label:'Cancelar',value:'no'}]
        }).then(r => { if (r==='yes') { saveState(); figures=[]; redrawAll(); } });
    }

    let divideMidpoint = false;

    const ALL_MODES = ['create','line','move','vertex','addVertex','deleteVertex','curve','straighten',
        'delete','mirror','resize','edgeMove','rotate','duplicate','reflect',
        'grain','offset','cut','closeShape','lock'];

    const MODE_LABELS = {
        create:'Crear polígono', line:'Crear línea', curve:'Curvar arista', move:'Mover figura',
        vertex:'Editar vértice', addVertex:'Agregar vértice', deleteVertex:'Eliminar vértice',
        straighten:'Curva → Recta', delete:'Eliminar figura', mirror:'Desdoblar', resize:'Cambiar longitud',
        edgeMove:'Mover arista', rotate:'Rotar', duplicate:'Copiar', reflect:'Reflejar',
        grain:'Asignar hilo', offset:'Desfase / costura', cut:'Cortar figura', closeShape:'Unir / Crear figura',
        lock:'Bloquear/Desbloquear'
    };

    // ===================== CREAR POLIGONO (rectángulo con medidas) =====================
    let pendingCreatePos = null;
