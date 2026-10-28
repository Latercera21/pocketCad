// PocketCAD - módulo: background
// Imagen/PDF de fondo para calcar: cargar, mover, girar, opacidad, calibrar a medida real.
// No se exporta ni se guarda en el JSON: es solo una guía visual.

    let bg = null;              // {img, x, y, scale, rot, opacity, locked, visible, pdf, pdfPage}
    let bgCalibActive = false;
    let bgCalibPts = [];        // hasta 2 puntos en coordenadas del mundo
    let bgPdfDoc = null;

    function bgEl(id){ return document.getElementById(id); }

    function toggleBgMode(){ hideFileMenu(); setMode(mode==='bg' ? 'none' : 'bg'); }

    // ---------- dibujo (se llama desde redrawAll, ya con la transformación de vista) ----------
    function drawBackground(){
        if (!bg || !bg.visible) return;
        ctx.save();
        ctx.globalAlpha = bg.opacity;
        ctx.translate(bg.x, bg.y);
        ctx.rotate(bg.rot * Math.PI / 180);
        ctx.scale(bg.scale, bg.scale);
        ctx.drawImage(bg.img, 0, 0);
        ctx.restore();
    }

    function drawBgCalib(){
        if (mode!=='bg' || !bgCalibPts.length) return;
        ctx.save();
        ctx.strokeStyle = '#e53935'; ctx.fillStyle = '#e53935'; ctx.lineWidth = 2/viewScale;
        bgCalibPts.forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, 5/viewScale, 0, Math.PI*2); ctx.fill(); });
        if (bgCalibPts.length===2) {
            ctx.beginPath(); ctx.moveTo(bgCalibPts[0].x, bgCalibPts[0].y); ctx.lineTo(bgCalibPts[1].x, bgCalibPts[1].y); ctx.stroke();
        }
        ctx.restore();
    }

    // ---------- carga ----------
    function bgLoadFile(){
        const inp = bgEl('bgFileInput');
        inp.value = '';
        inp.onchange = () => { const f = inp.files && inp.files[0]; if (f) bgHandleFile(f); };
        inp.click();
    }

    function bgViewCenter(){ return screenToWorld(window.innerWidth/2, window.innerHeight/2); }

    function bgSet(img, scale, extra){
        const c = bgViewCenter();
        bg = Object.assign({img, scale, rot:0, opacity:0.5, locked:false, visible:true, pdf:false, pdfPage:1}, extra||{});
        bg.x = c.x - (img.width*scale)/2;
        bg.y = c.y - (img.height*scale)/2;
        bgEl('bgOpacity').value = bg.opacity;
        bgEl('bgRot').value = 0;
        bgSyncUI();
        redrawAll();
    }

    function bgHandleFile(file){
        const isPdf = /pdf$/i.test(file.type) || /\.pdf$/i.test(file.name);
        if (isPdf) { bgLoadPdf(file); return; }
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            // sin medida conocida: se ajusta a ~50 cm de ancho; después se calibra con 📏
            bgSet(img, (50*PX_PER_CM)/img.width);
            URL.revokeObjectURL(url);
            showModal({title:'Fondo', body:'Foto cargada a tamaño aproximado. Usa 📏 Calibrar: toca dos puntos de una medida conocida y escribe los cm reales.', buttons:[{label:'OK'}]});
        };
        img.onerror = () => showModal({title:'Error', body:'No se pudo leer la imagen.', buttons:[{label:'OK'}]});
        img.src = url;
    }

    function bgEnsurePdfJs(){
        return new Promise((resolve, reject) => {
            if (window.pdfjsLib) { resolve(); return; }
            const s = document.createElement('script');
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            s.onload = () => {
                window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                resolve();
            };
            s.onerror = () => reject(new Error('No se pudo cargar pdf.js (¿sin internet?)'));
            document.head.appendChild(s);
        });
    }

    async function bgLoadPdf(file){
        try {
            await bgEnsurePdfJs();
            const buf = await file.arrayBuffer();
            bgPdfDoc = await window.pdfjsLib.getDocument({data: buf}).promise;
            await bgRenderPdfPage(1, true);
        } catch(err) {
            showModal({title:'PDF', body:'No se pudo abrir el PDF: ' + (err && err.message ? err.message : err) + '. Alternativa: conviértelo a imagen (PNG/JPG) y cárgalo como foto.', buttons:[{label:'OK'}]});
        }
    }

    async function bgRenderPdfPage(n, first){
        if (!bgPdfDoc) return;
        n = Math.max(1, Math.min(bgPdfDoc.numPages, n|0 || 1));
        const page = await bgPdfDoc.getPage(n);
        const vp1 = page.getViewport({scale:1});               // 1 unidad = 1 pt (1/72 in)
        const sr = Math.min(2, 4096 / Math.max(vp1.width, vp1.height)); // px de imagen por pt
        const vp = page.getViewport({scale: sr});
        const cv = document.createElement('canvas');
        cv.width = Math.ceil(vp.width); cv.height = Math.ceil(vp.height);
        const cctx = cv.getContext('2d');
        cctx.fillStyle = '#ffffff'; cctx.fillRect(0, 0, cv.width, cv.height);
        await page.render({canvasContext: cctx, viewport: vp}).promise;
        // escala real: 1 pt = 96/72 px del mundo (PX_PER_CM = 96/2.54), o sea 1:1 si el PDF está a escala
        const scale = (96/72) / sr;
        if (first || !bg) bgSet(cv, scale, {pdf:true, pdfPage:n});
        else { const keep = bg; keep.img = cv; keep.scale = scale; keep.pdfPage = n; }
        bgEl('bgPage').value = n;
        bgEl('bgPage').max = bgPdfDoc.numPages;
        bgSyncUI();
        redrawAll();
        if (first) showModal({title:'Fondo', body:'PDF cargado a su medida real ('+ (vp1.width/72*2.54).toFixed(1) +' × '+ (vp1.height/72*2.54).toFixed(1) +' cm la hoja). Si el molde venía a escala, ya mide lo correcto; verifícalo con 📏 Calibrar.', buttons:[{label:'OK'}]});
    }

    function bgChangePage(){ if (bg && bg.pdf) bgRenderPdfPage(parseInt(bgEl('bgPage').value)||1, false); }

    // ---------- controles ----------
    function bgSyncUI(){
        const has = !!bg;
        bgEl('bgTools').style.display = has ? 'inline-flex' : 'none';
        bgEl('bgPageWrap').style.display = (has && bg.pdf && bgPdfDoc && bgPdfDoc.numPages>1) ? 'inline-flex' : 'none';
        bgEl('bgCalibBtn').classList.toggle('on', bgCalibActive);
        bgEl('bgCalibInputs').style.display = bgCalibActive ? 'inline-flex' : 'none';
        bgEl('bgLockBtn').classList.toggle('on', has && bg.locked);
        bgEl('bgVisBtn').textContent = (has && !bg.visible) ? '🙈' : '👁';
    }

    function bgSetOpacity(){ if (!bg) return; bg.opacity = parseFloat(bgEl('bgOpacity').value); redrawAll(); }

    function bgSetRot(){
        if (!bg) return;
        const deg = parseFloat(String(bgEl('bgRot').value).replace(',','.')) || 0;
        // gira alrededor del centro de la imagen
        const w = bg.img.width*bg.scale, h = bg.img.height*bg.scale, r0 = bg.rot*Math.PI/180;
        const cx = bg.x + (w/2)*Math.cos(r0) - (h/2)*Math.sin(r0);
        const cy = bg.y + (w/2)*Math.sin(r0) + (h/2)*Math.cos(r0);
        bg.rot = deg;
        const r1 = deg*Math.PI/180;
        bg.x = cx - ((w/2)*Math.cos(r1) - (h/2)*Math.sin(r1));
        bg.y = cy - ((w/2)*Math.sin(r1) + (h/2)*Math.cos(r1));
        redrawAll();
    }

    function bgToggleLock(){ if (!bg) return; bg.locked = !bg.locked; bgSyncUI(); }
    function bgToggleVis(){ if (!bg) return; bg.visible = !bg.visible; bgSyncUI(); redrawAll(); }

    function bgRemove(){
        showModal({title:'Quitar fondo', body:'¿Quitar la imagen de fondo?', buttons:[{label:'Quitar',value:'yes'},{label:'No',value:'no'}]}).then(r => {
            if (r==='yes') { bg = null; bgPdfDoc = null; bgCalibActive = false; bgCalibPts = []; bgSyncUI(); redrawAll(); }
        });
    }

    function bgToggleCalib(){
        if (!bg) return;
        bgCalibActive = !bgCalibActive; bgCalibPts = [];
        bgSyncUI();
        showActiveLabel(bgCalibActive ? 'Calibrar: toca 2 puntos de una medida conocida' : MODE_LABELS.bg);
        redrawAll();
    }

    function bgApplyCalib(){
        if (!bg || bgCalibPts.length<2) { showModal({title:'Calibrar', body:'Toca primero los dos puntos de la medida conocida.', buttons:[{label:'OK'}]}); return; }
        const cm = parseFloat(String(bgEl('bgCalibCm').value).replace(',','.'));
        if (isNaN(cm) || cm<=0) { showModal({title:'Calibrar', body:'Escribe la medida real en cm entre los dos puntos.', buttons:[{label:'OK'}]}); return; }
        const p1 = bgCalibPts[0], p2 = bgCalibPts[1];
        const d = Math.hypot(p2.x-p1.x, p2.y-p1.y);
        if (d < 1e-6) return;
        const k = (cm*PX_PER_CM) / d;
        bg.scale *= k;
        bg.x = p1.x + (bg.x-p1.x)*k;      // escala alrededor del primer punto (queda fijo)
        bg.y = p1.y + (bg.y-p1.y)*k;
        bgCalibPts = [p1, {x: p1.x+(p2.x-p1.x)*k, y: p1.y+(p2.y-p1.y)*k}];
        redrawAll();
    }

    // ---------- punteros (modo 'bg') ----------
    function bgDown(wx, wy){
        if (!bg) return;
        if (bgCalibActive) {
            let p = {x:wx, y:wy};
            if (snapEnabled && typeof applySnap==='function') p = applySnap(wx, wy, -1, -1);
            if (bgCalibPts.length>=2) bgCalibPts = [];
            bgCalibPts.push({x:p.x, y:p.y});
            redrawAll();
            return;
        }
        if (bg.locked) return;
        dragData = {type:'bgMove', lastX:wx, lastY:wy};
    }

    function bgMove(wx, wy){
        if (!dragData || dragData.type!=='bgMove' || !bg) return;
        bg.x += wx - dragData.lastX; bg.y += wy - dragData.lastY;
        dragData.lastX = wx; dragData.lastY = wy;
        redrawAll();
    }

    function bgResetUI(){
        bgCalibActive = false; bgCalibPts = [];
        bgSyncUI();
    }
