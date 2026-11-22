// ===== Idioma: español (por defecto) / inglés. Se detecta del navegador; el botón 🌐 del menú Archivo lo cambia. =====
(function(){
  const EN = {
  // --- títulos (tooltips) ---
  'Acercar':'Zoom in','Agregar punto de control':'Add control point','Agregar vértice (tocá una arista)':'Add vertex (tap an edge)','Alejar':'Zoom out',
  'Apertura de la pinza (cm). La figura crece este valor':'Dart opening (cm). The shape grows by this value','Aplicar cierre':'Apply closing','Aplicar corte':'Apply cut',
  'Aplicar medida':'Apply measure','Aplicar pinza':'Apply dart','Aplicar transformación':'Apply transformation','Archivo (exportar/importar)':'File (export/import)',
  'Arrastra para rotar':'Drag to rotate','Asignar el valor de cm actual a un lado/segmento':'Assign the current cm value to a side/segment','Asignar hilo a figura':'Assign grain to a piece',
  'Base: toca un lado y pásalo a horizontal (X) o vertical (Y)':'Base: tap a side and make it horizontal (X) or vertical (Y)','Bloquear el fondo (no se mueve al arrastrar)':'Lock the background (it does not move when dragging)',
  'Bloquear/desbloquear':'Lock/unlock','Borra el caché de archivos viejos y recarga (no borra tus dibujos)':'Clears old cached files and reloads (your drawings are kept)',
  'Calibrar: toca 2 puntos de una medida conocida y escribe los cm reales':'Calibrate: tap 2 points of a known measure and type the real cm','Cambiar cuál trozo se desplaza (por defecto el más pequeño)':'Change which part moves (the smallest by default)',
  'Cambiar longitud':'Change length','Cargar foto (JPG/PNG) o PDF como fondo':'Load a photo (JPG/PNG) or PDF as background',
  'Compás: 1) punto centro, 2) punto que gira (misma figura), 3) punto guía; la figura gira sin deformarse hasta que el punto 2 queda en la línea centro→guía. Arrastrar dentro de una pieza la mueve':'Compass: 1) center point, 2) rotating point (same shape), 3) guide point; the shape rotates rigidly until point 2 lies on the center→guide line. Dragging inside a piece moves it',
  'Confirmar':'Confirm','Confirmar el eje (si el lado ya era eje, se quita)':'Confirm the axis (if the side was already an axis, it is removed)','Convertir un vértice (duro o no) en punto de curva: toca el vértice; los dos lados que lo tocan pasan a curva suave':'Turn a vertex (hard or not) into a curve point: tap the vertex; the two sides touching it become a smooth curve',
  'Cortar figura con línea(s)':'Cut a shape with line(s)','Costura (margen de costura, modifica la arista)':'Seam allowance (modifies the edge)',
  'Costura para el 3D: toca el lado A de una pieza y luego el lado B que se cose con él; ✓ crea la costura (un solo lado ya cosido + ✓ la quita)':'3D seam: tap side A of a piece, then side B sewn to it; ✓ creates the seam (one already-sewn side + ✓ removes it)',
  'Crear costura entre los dos lados / quitar la del lado elegido':'Create a seam between the two sides / remove the chosen side\'s seam','Crear círculo':'Create circle','Crear línea':'Draw line',
  'Crear líneas de costura en los lados que toques (sin margen)':'Create stitch lines on the sides you tap (no margin)','Crear polígono':'Create polygon','Curva multipunto: varios puntos, todos sobre la curva':'Multi-point curve: several points, all on the curve',
  'Curvar arista':'Curve edge','Curvar las patas de la nueva pinza (cm de panza). 0 = rectas':'Curve the legs of the new dart (cm of belly). 0 = straight','Curvar las patas de la pinza (cm de panza). 0 = rectas; negativo = hacia adentro':'Curve the dart legs (cm of belly). 0 = straight; negative = inward',
  'Curva→Recta':'Curve→Straight','Cuántas tallas hacia abajo':'How many sizes down','Cuántas tallas hacia arriba':'How many sizes up','Cuánto acortar (-) o alargar (+) los lados que se unen en el punto tocado':'How much to shorten (-) or lengthen (+) the sides meeting at the tapped point',
  'Dejar el lado elegido horizontal':'Make the chosen side horizontal','Dejar el lado elegido vertical':'Make the chosen side vertical','Desdoblar':'Unfold','Desdoblar / Copiar / Reflejar':'Unfold / Copy / Mirror','Deshacer':'Undo',
  'Dibujar una curva nueva tocando puntos seguidos, con snap':'Draw a new curve by tapping consecutive points, with snap','Dirección del hilo: horizontal o vertical':'Grain direction: horizontal or vertical',
  'Dirección horizontal (el vértice se mueve en X)':'Horizontal direction (the vertex moves in X)','Dirección vertical (el vértice se mueve en Y)':'Vertical direction (the vertex moves in Y)',
  'Distancia de la línea punteada al lado: + hacia adentro de la pieza, − hacia afuera, 0 sobre el lado':'Distance from the dotted line to the side: + inside the piece, − outside, 0 on the side',
  'Dividir segmento por la mitad exacta (en vez de al lugar donde tocás)':'Split the segment at its exact middle (instead of where you tap)','Duplicar':'Duplicate','Editar vértice':'Edit vertex',
  'Eje de simetría para la tizada tubular: toca un lado recto de una pieza cerrada; ese lado irá pegado a un borde en el nesting':'Symmetry axis for tubular marker: tap a straight side of a closed piece; that side will sit against an edge in nesting',
  'Elegir dirección X/Y por vértice':'Choose X/Y direction per vertex','Eliminar figura':'Delete shape','Eliminar todo':'Delete all','Eliminar vértice (tocá un vértice)':'Delete vertex (tap a vertex)',
  'Escalar por arrastre: selecciona figuras (toca o arrastra un cuadro); esquinas = escalar proporcional, lados = estirar, interior = mover':'Scale by dragging: select shapes (tap or drag a box); corners = proportional scale, sides = stretch, inside = move',
  'Estirar manualmente el lado':'Stretch the side manually','Exportar DXF (para otros programas de patronaje/CAD)':'Export DXF (for other pattern/CAD programs)','Exportar JSON':'Export JSON',
  'Exportar PDF a escala real 1:1 (A4/A3 por hojas o una hoja a medida)':'Export PDF at real 1:1 scale (A4/A3 tiled or one custom sheet)','Exportar SVG':'Export SVG','Girar el fondo (grados)':'Rotate the background (degrees)',
  'Girar el otro lado del molde al cerrar':'Rotate the other side of the pattern when closing','Grados':'Degrees','Guía: copia paralela de uno o varios lados a una distancia':'Guide: parallel copy of one or more sides at a distance',
  'Imagen o PDF de fondo para calcar':'Background image or PDF for tracing','Importar (reconoce JSON o DXF automáticamente)':'Import (recognizes JSON or DXF automatically)','Ingresar coordenadas exactas':'Enter exact coordinates',
  'Invertir el sentido de la costura (cuál punto se une con cuál). Los números 1 y 2 lo muestran':'Flip the seam direction (which point joins which). Numbers 1 and 2 show it','Invertir hacia qué lado se crea la guía':'Flip which side the guide is created on',
  'Líneas de costura (punteadas): crear o quitar':'Stitch lines (dotted): create or remove','Marcar/desmarcar el vértice tocado como esquina dura (no se funde con curvas vecinas)':'Mark/unmark the tapped vertex as a hard corner (it does not blend with neighboring curves)',
  'Medida propia por vértice: toca un vértice de los lados elegidos y escribe cuánto se corre (dX/dY en cm) en CADA talla; entra en la vista previa y en las tallas':'Own measure per vertex: tap a vertex of the chosen sides and type how far it shifts (dX/dY in cm) in EACH size; it appears in the preview and sizes',
  'Modo oscuro/claro':'Dark/light mode','Mostrar/ocultar fondo':'Show/hide background','Mover arista/lado':'Move edge/side','Mover figura':'Move shape','Opacidad':'Opacity','Pegar el primer punto sobre el segundo':'Snap the first point onto the second',
  'Pinza o dart (crear / transformar)':'Dart (create / transform)','Poner nombre a una pieza: activa y toca una pieza cerrada':'Name a piece: activate and tap a closed piece',
  'Poner talla (S, M, L…) a una pieza: activa y toca una pieza cerrada. La talla es distinta del nombre':'Set size (S, M, L…) on a piece: activate and tap a closed piece. Size is different from name',
  'Profundidad de la pinza (cm), de la boca a la punta':'Dart depth (cm), from mouth to tip','Promediar con los lados vecinos, sin número propio':'Average with neighboring sides, no own number',
  'Quitar costura: toca uno de sus lados y presiona 🗑':'Remove seam: tap one of its sides and press 🗑','Quitar fondo':'Remove background','Quitar las líneas de costura que toques':'Remove the stitch lines you tap','Quitar punto de control':'Remove control point',
  'Qué porcentaje de la pinza original se traslada al destino':'What percentage of the original dart moves to the destination','Reflejar':'Mirror','Restablecer vista':'Reset view','Rotar':'Rotate',
  'Sentido del hilo: activa y toca una pieza cerrada (tocar de nuevo la quita)':'Grain direction: activate and tap a closed piece (tap again to remove)','Snap':'Snap','Snap a arista':'Snap to edge',
  'Tallas (gradación, conserva la base bloqueada)':'Sizes (grading, keeps the base locked)','Transformar pinza: trasladar la abertura a otro lado del contorno':'Transform dart: move the opening to another side of the outline',
  'Un toque mide el lado completo entre puntos duros (activo) o tramo por tramo (apagado)':'One tap measures the full side between hard points (on) or segment by segment (off)','Unir / Crear figura':'Join / Create shape',
  'Unir: toca el punto a mover y luego el punto al que se pega; ✓ aplica':'Join: tap the point to move, then the point it snaps to; ✓ applies','Ver piezas cerradas en 3D':'View closed pieces in 3D','Zoom +/-':'Zoom +/-',
  // --- textos de botones ---
  'Alto:':'Height:','Ancho:':'Width:','Cierre %:':'Close %:','Curva:':'Curve:','Dividir':'Split','Prof:':'Depth:','Pág':'Page','Radio:':'Radius:','Seguir':'Follow','o circunf.:':'or circ.:',
  '↻ Transformar':'↻ Transform','∥ Guía':'∥ Guide','┄ Cos…':'┄ Stitch…','⌒pt':'⌒pt','⟂ Eje':'⟂ Axis','⟷ Lado':'⟷ Side','⤡ Escalar':'⤡ Scale','⧉ Copiar':'⧉ Copy','🏷 Nombre':'🏷 Name','💾 DXF':'💾 DXF',
  '📂 Cargar':'📂 Load','📂 Imp':'📂 Imp','📍 Coord…':'📍 Coord…','📏 Base':'📏 Base','📏 Calibrar':'📏 Calibrate','📖 Desdo…':'📖 Unfold…','🔄 Actualizar':'🔄 Update','🔠 Talla':'🔠 Size','🧭 Compás':'🧭 Compass',
  '🧲 Unir':'🧲 Join','🧵 Hilo':'🧵 Grain','🪞 Reflej…':'🪞 Mirror…','🪡 Coser':'🪡 Sew','Hilo':'Grain','Nombre':'Name','Talla':'Size','Compás':'Compass','Coser':'Sew','Unir':'Join','Eje':'Axis','Escalar':'Scale','Lado':'Side','Copiar':'Copy',
  // --- modos ---
  'Fondo (imagen/PDF para calcar)':'Background (image/PDF for tracing)','Crear polígono':'Create polygon','Crear línea':'Draw line','Mover figura':'Move shape','Editar vértice':'Edit vertex','Curva → Recta':'Curve → Straight',
  'Eliminar figura':'Delete shape','Cambiar longitud':'Change length','Mover arista':'Move edge','Copiar':'Copy','Asignar hilo':'Assign grain','Costura (margen)':'Seam allowance','Tallas (gradación)':'Sizes (grading)','Cortar figura':'Cut shape',
  'Bloquear/Desbloquear':'Lock/Unlock','Pinza (dart)':'Dart','  +  ✋ mover piezas':'  +  ✋ move pieces',
  // --- modales ---
  'Los dos lados no pueden compartir aristas.':'The two sides cannot share edges.','Se eliminarán todas las figuras.':'All shapes will be deleted.','Ej: 25.5 o 25,5':'E.g. 25.5 or 25,5','Escribe la medida real en cm entre los dos puntos.':'Type the real measure in cm between the two points.',
  'Formato incorrecto.':'Wrong format.','Ingresa ancho y alto en cm.':'Enter width and height in cm.','Ingresa el radio o la circunferencia en cm.':'Enter the radius or circumference in cm.','Introduce una distancia en cm distinta de 0.':'Enter a distance in cm other than 0.',
  'Introduce una distancia positiva en cm.':'Enter a positive distance in cm.','La línea de corte no intersecta ninguna figura cerrada correctamente.':'The cut line does not properly intersect any closed shape.','La línea de corte no tiene puntos suficientes.':'The cut line does not have enough points.',
  'No hay acciones para deshacer.':'Nothing to undo.','No hay figuras cerradas para mostrar.':'No closed shapes to show.','No hay figuras para exportar.':'No shapes to export.','No se pudo cerrar la figura.':'Could not close the shape.','No se pudo leer la imagen.':'Could not read the image.',
  'No se pudo realizar el corte parcial.':'Could not perform the partial cut.','No se pudo realizar el corte.':'Could not perform the cut.','Primero selecciona un vértice.':'Select a vertex first.','Reconoce JSON o DXF automáticamente. ¿Subir archivo o pegar texto?':'Recognizes JSON or DXF automatically. Upload a file or paste text?',
  'Selecciona al menos un lado.':'Select at least one side.','Selecciona al menos una línea de corte.':'Select at least one cut line.','Selecciona al menos una línea.':'Select at least one line.','Selecciona solo una arista para aplicar un valor.':'Select only one edge to apply a value.',
  'Solo puedes seleccionar lados de la misma figura.':'You can only select sides of the same shape.','Toca la punta de una pinza y arrastra hacia el contorno destino.':'Tap a dart tip and drag toward the target outline.','Toca primero el punto que se va a mover y luego el punto al que se pega.':'Tap the point to move first, then the point it snaps to.',
  'Toca primero los dos puntos de la medida conocida.':'First tap the two points of the known measure.','Toca primero un punto del contorno donde ubicar la pinza.':'First tap a point on the outline where the dart goes.','Toca un lado recto de una pieza cerrada y luego ✓.':'Tap a straight side of a closed piece, then ✓.',
  '¿Quitar la imagen de fondo?':'Remove the background image?','Cancelar':'Cancel','Guardar':'Save','Quitar':'Remove','Eliminar todo':'Delete all','Hoja única':'Single sheet','A4 por hojas':'A4 tiled','A3 por hojas':'A3 tiled','✓ Importar':'✓ Import','✕ Cancelar':'✕ Cancel','✕ Cerrar':'✕ Close',
  '💾 Descargar':'💾 Download','📂 Archivo':'📂 File','📋 Copiar':'📋 Copy','📋 Pegar':'📋 Paste','🧩 Una por nombre':'🧩 One per name','🧵 Tizada completa':'🧵 Full marker','Costura 3D':'3D seam','Nombre de la pieza':'Piece name','Sentido de la costura':'Seam direction',
  'Talla de la pieza':'Piece size','¿Eliminar todo?':'Delete all?','Aviso':'Notice','Calibrar':'Calibrate','Deshacer':'Undo','Eje de simetría':'Symmetry axis','Exportar PDF (escala real 1:1)':'Export PDF (real 1:1 scale)','Fondo':'Background',
  'Importar tizada Optitex (.MRK)':'Import Optitex marker (.MRK)','Importar':'Import','Líneas de costura':'Stitch lines','No se pudo aplicar':'Could not apply','Pegar (JSON o DXF)':'Paste (JSON or DXF)','Pinza':'Dart','Talla no aplicada':'Size not applied','Valor inválido':'Invalid value','Valor invAlido':'Invalid value',
  'Selecciona al menos una arista (o fija medidas con 📍 XY).':'Select at least one edge (or set measures with 📍 XY).','Primero toca el vértice al que le quieres dar su propia medida.':'First tap the vertex you want to give its own measure.',
  'Para invertir el sentido: elige los lados A y B y presiona ⇄ antes de ✓, o toca un lado ya cosido y presiona ⇄.\nLas letras A, B y C muestran qué punto se une con cuál (la misma letra se une con la misma letra).':'To flip the direction: choose sides A and B and press ⇄ before ✓, or tap an already-sewn side and press ⇄.\nLetters A, B and C show which point joins which (the same letter joins the same letter).',
  'Toca el lado A y luego el lado B (los dos lados que se cosen entre sí) y presiona ✓.\nPara quitar una costura: toca solo uno de sus lados y ✓.':'Tap side A, then side B (the two sides sewn together) and press ✓.\nTo remove a seam: tap only one of its sides and ✓.',
  'Al imprimir elige tamaño real / 100% (sin "ajustar a la página"). Cada hoja trae una regla de 5 cm para comprobar la escala.':'When printing choose actual size / 100% (not "fit to page"). Each sheet has a 5 cm ruler to check the scale.',
  'Foto cargada a tamaño aproximado. Usa 📏 Calibrar: toca dos puntos de una medida conocida y escribe los cm reales.':'Photo loaded at approximate size. Use 📏 Calibrate: tap two points of a known measure and type the real cm.',
  'La costura quedó demasiado deformada (varias puntas cruzándose a la vez) para este margen. Deshacé (Ctrl+Z) y probá con un valor más chico.':'The seam allowance became too distorted (several tips crossing) for this margin. Undo (Ctrl+Z) and try a smaller value.',
  'No se encontraron figuras reconocibles en el DXF (revisá que tenga una sección ENTITIES con LINE/POLYLINE/LWPOLYLINE/ARC/CIRCLE/SPLINE).':'No recognizable shapes found in the DXF (check it has an ENTITIES section with LINE/POLYLINE/LWPOLYLINE/ARC/CIRCLE/SPLINE).',
  'Una punta o pinza muy cerrada se recortó automáticamente en el punto donde se cruzaba a sí misma, para que la figura quede válida.':'A very sharp tip or dart was trimmed automatically where it crossed itself, so the shape stays valid.',
  'Tocar para aplicar':'Tap to apply'
  };
  const PRE = { 'No se pudo abrir el PDF: ':'Could not open the PDF: ','No se pudo leer el .MRK: ':'Could not read the .MRK: ','No se pudo leer el DXF: ':'Could not read the DXF: ','La talla ':'Size ','PDF cargado a su medida real (':'PDF loaded at real size (' };
  let lang = 'es';
  try { lang = localStorage.getItem('pcLang') || ''; } catch(e){}
  if (lang!=='es' && lang!=='en') lang = ((navigator.language||'es').toLowerCase().indexOf('es')===0) ? 'es' : 'en';
  window.pcLang = lang;
  window.T = function(s){
    if (window.pcLang!=='en' || typeof s!=='string') return s;
    if (EN[s]!==undefined) return EN[s];
    const k = s.trim(); if (EN[k]!==undefined) return s.replace(k, EN[k]);
    for (const p in PRE) if (s.indexOf(p)===0) return PRE[p] + s.slice(p.length);
    return s;
  };
  // ---- DOM estático: guardamos el original en español para poder volver ----
  function walk(root){
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let n; while ((n = w.nextNode())) {
      if (n.__es === undefined) n.__es = n.nodeValue;
      const es = n.__es, k = es.trim();
      if (!k) continue;
      n.nodeValue = (window.pcLang==='en' && EN[k]!==undefined) ? es.replace(k, EN[k]) : es;
    }
    root.querySelectorAll('[title],[placeholder]').forEach(el=>{
      ['title','placeholder'].forEach(a=>{
        if (!el.hasAttribute(a) && el['__es_'+a]===undefined) return;
        if (el['__es_'+a]===undefined) el['__es_'+a] = el.getAttribute(a);
        const es = el['__es_'+a];
        el.setAttribute(a, window.pcLang==='en' && EN[es]!==undefined ? EN[es] : es);
      });
    });
  }
  window.applyLang = function(){
    document.documentElement.lang = window.pcLang;
    walk(document.body);
    const b = document.getElementById('langBtn'); if (b) b.textContent = '🌐 ' + (window.pcLang==='en' ? 'English → Español' : 'Español → English');
    if (typeof mode!=='undefined' && mode!=='none' && typeof MODE_LABELS!=='undefined' && typeof showActiveLabel==='function') showActiveLabel(MODE_LABELS[mode]||mode);
  };
  window.toggleLang = function(){
    window.pcLang = window.pcLang==='en' ? 'es' : 'en';
    try { localStorage.setItem('pcLang', window.pcLang); } catch(e){}
    applyLang();
  };
  // ---- envolver los mensajes dinámicos ----
  const _sm = window.showModal;
  if (_sm) window.showModal = function(o){
    if (o && window.pcLang==='en') {
      o = Object.assign({}, o);
      if (o.title) o.title = T(o.title);
      if (o.body) o.body = T(o.body);
      if (o.nameLabel) o.nameLabel = T(o.nameLabel);
      if (o.buttons) o.buttons = o.buttons.map(b=>Object.assign({}, b, {label: T(b.label)}));
    }
    return _sm(o);
  };
  const _sl = window.showActiveLabel;
  if (_sl) window.showActiveLabel = function(t){ return _sl(T(t)); };
  window.addEventListener('load', applyLang);
})();
