// PocketCAD - módulo: main
// Generado a partir de la división del archivo monolítico original.

    window.addEventListener('resize', resizeCanvas);

    resizeCanvas();

    canvas.addEventListener('wheel', e => {
        e.preventDefault();
        applyZoom(e.deltaY, e.clientX, e.clientY);
    }, {passive:false});

    // ===================== EVENTOS =====================
    canvas.addEventListener('touchstart',e=>{isTouchDevice=true;handleTouchStart(e);},{passive:false});

    canvas.addEventListener('touchmove', handleTouchMove,{passive:false});

    canvas.addEventListener('touchend',  handleTouchEnd, {passive:true});

    canvas.addEventListener('mousedown', e=>{if(!isTouchDevice)handleMouseDown(e);});

    canvas.addEventListener('mousemove', e=>{if(!isTouchDevice)handleMouseMove(e);});

    canvas.addEventListener('mouseup',   e=>{if(!isTouchDevice)handleMouseUp(e);});

    canvas.addEventListener('mouseleave',e=>{if(!isTouchDevice)handleMouseLeave(e);});

    canvas.addEventListener('contextmenu',e=>e.preventDefault());

    // ===================== ROTAR CON SLIDER =====================
    document.getElementById('rotateSlider').addEventListener('input', function(){
        document.getElementById('rotateInput').value = this.value;
        if(rotateActiveFigure===null || !figures[rotateActiveFigure]) return;
        const deg = parseFloat(this.value);
        const delta = deg - rotateStartAngle;
        rotateFigure(rotateActiveFigure, delta);
        rotateStartAngle = deg;
        redrawAll();
    });

    document.getElementById('rotateInput').addEventListener('change', function(){
        // solo si el usuario sigue en el campo (Enter / flechas): un 'change' por perder el foco
        // al tocar otro botón (p. ej. desactivar Rotar) NO debe rotar la figura
        if(mode!=='rotate' || document.activeElement!==this) return;
        if(rotateActiveFigure===null || !figures[rotateActiveFigure]) return;
        saveState();
        rotateFigure(rotateActiveFigure, parseFloat(this.value)||0);
        redrawAll();
    });

    document.addEventListener('keydown',e=>{
        if(e.ctrlKey&&e.key==='z'&&!e.shiftKey){e.preventDefault();undoAction();}
        if(e.key==='0'&&e.ctrlKey){e.preventDefault();resetView();}
        if(e.key==='Escape'){setMode('none');}
        // Zoom con + / - y desplazar con flechas (Shift = más rápido); no actúa al escribir en un campo
        const t=e.target, tag=t&&t.tagName;
        if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||(t&&t.isContentEditable)) return;
        if(e.ctrlKey||e.metaKey||e.altKey) return;
        if(document.querySelector('.modal-overlay')) return;
        const cx=window.innerWidth/2, cy=window.innerHeight/2;
        if(e.key==='+'||e.key==='='||e.key==='Add'){e.preventDefault();applyZoom(-1,cx,cy);}
        else if(e.key==='-'||e.key==='_'||e.key==='Subtract'){e.preventDefault();applyZoom(1,cx,cy);}
        else if(e.key.startsWith('Arrow')){
            e.preventDefault();
            const st=(e.shiftKey?150:50);
            if(e.key==='ArrowLeft')  viewOffX+=st;
            if(e.key==='ArrowRight') viewOffX-=st;
            if(e.key==='ArrowUp')    viewOffY+=st;
            if(e.key==='ArrowDown')  viewOffY-=st;
            redrawAll();
        }
    });

    restoreTheme();

    restoreAutoSave();

    updateZoomIndicator();
