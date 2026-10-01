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
        if(rotateActiveFigure===null || !figures[rotateActiveFigure]) return;
        saveState();
        rotateFigure(rotateActiveFigure, parseFloat(this.value)||0);
        redrawAll();
    });

    document.addEventListener('keydown',e=>{
        if(e.ctrlKey&&e.key==='z'&&!e.shiftKey){e.preventDefault();undoAction();}
        if(e.key==='0'&&e.ctrlKey){e.preventDefault();resetView();}
        if(e.key==='Escape'){setMode('none');}
    });

    restoreTheme();

    restoreAutoSave();

    updateZoomIndicator();
