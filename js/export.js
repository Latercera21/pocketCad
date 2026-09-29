// PocketCAD - módulo: export
// Generado a partir de la división del archivo monolítico original.

    function exportContent(title, content, filename, mimeType) {
    const dot = filename.lastIndexOf('.');
    const base = dot>=0 ? filename.slice(0,dot) : filename;
    const ext = dot>=0 ? filename.slice(dot) : '';
    showModal({title, nameInputDefault: base, textarea: content,
        buttons:[
            {label:'📋 Copiar',value:'copy'},
            {label:'💾 Descargar',value:'dl'},
            {label:'✕ Cerrar',value:'close'}
        ]
    }).then(res=>{
        if(!res || res.action==='close') return;
        const finalName = (res.name || base) + ext;
        if(res.action==='copy'){
            (navigator.clipboard?navigator.clipboard.writeText(content):Promise.reject())
                .catch(()=>{
                    const ta=document.querySelector('.modal-box textarea');
                    if(ta){ta.select();document.execCommand('copy');}
                });
        } else if(res.action==='dl'){
            const blob=new Blob([content],{type:mimeType});
            const url=URL.createObjectURL(blob);
            const el=document.createElement('a');
            el.href=url; el.download=finalName; el.style.display='none';
            document.body.appendChild(el); el.click();
            document.body.removeChild(el);
            setTimeout(()=>URL.revokeObjectURL(url), 1000);
        }
    });
}

    function exportJSON(){
        const data={
            unit:'cm',pxPerCm:PX_PER_CM,grainDirection:grainDir,
            figures:figures.map(fig=>({
                grain:fig.grain||null, closed:fig.closed,
                vertices:fig.vertices.map(v=>v.hardCorner ? {x:v.x,y:v.y,hardCorner:true} : {x:v.x,y:v.y}),
                edges:fig.edges
            }))
        };
        const json=JSON.stringify(data,null,2);
        exportContent('Exportar patron.json', json, 'patron.json', 'application/json');
    }

    function exportSVG(){
        let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
        figures.forEach(fig=>{fig.vertices.forEach(v=>{minX=Math.min(minX,v.x);minY=Math.min(minY,v.y);maxX=Math.max(maxX,v.x);maxY=Math.max(maxY,v.y);});});
        const pad=20;
        const W=maxX-minX+pad*2, H=maxY-minY+pad*2;
        const ox=minX-pad, oy=minY-pad;

        function pathD(fig){
            let d='';
            fig.edges.forEach(e=>{
                const a=fig.vertices[e.start], b=fig.vertices[e.end];
                if(!d) d+=`M ${a.x-ox} ${a.y-oy} `;
                if(e.cubic&&e.control2X!=null) d+=`C ${e.controlX-ox} ${e.controlY-oy} ${e.control2X-ox} ${e.control2Y-oy} ${b.x-ox} ${b.y-oy} `;
                else if(e.curved&&e.controlX!=null) d+=`Q ${e.controlX-ox} ${e.controlY-oy} ${b.x-ox} ${b.y-oy} `;
                else d+=`L ${b.x-ox} ${b.y-oy} `;
            });
            if(fig.closed) d+='Z';
            return d.trim();
        }

        const paleta=['#e74c3c','#2980b9','#27ae60','#f39c12','#8e44ad','#16a085','#d35400','#2c3e50','#c0392b','#2ecc71'];

        let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">\n`;
        figures.forEach((fig,i)=>{
            const color=paleta[i%paleta.length];
            svg+=`  <path id="fig${i}" d="${pathD(fig)}" fill="${color}" fill-opacity="0.35" stroke="${color}" stroke-width="2"/>\n`;
        });
        svg+=`</svg>`;

        exportContent('Exportar SVG', svg, 'patron.svg', 'image/svg+xml');
    }

    function importFile(){
        showModal({
            title:'Importar',
            body:'Reconoce JSON o DXF automáticamente. ¿Subir archivo o pegar texto?',
            buttons:[{label:'📂 Archivo',value:'file'},{label:'📋 Pegar',value:'paste'},{label:'✕ Cancelar',value:'cancel'}]
        }).then(action=>{
            if(action==='file'){
                const inp=document.createElement('input');inp.type='file';inp.accept='.json,.dxf,application/json';
                inp.onchange=e=>{
                    const file=e.target.files[0];if(!file)return;
                    const reader=new FileReader();
                    reader.onload=ev=>{ dispatchImport(ev.target.result, file.name); };
                    reader.readAsText(file);
                };
                inp.click();
            } else if(action==='paste'){
                let capturedText='';
                showModal({
                    title:'Pegar (JSON o DXF)',
                    textarea:'',
                    editable:true,
                    buttons:[{label:'✓ Importar',value:'ok'},{label:'✕ Cancelar',value:'cancel'}]
                }).then(r=>{
                    if(r==='ok') dispatchImport(capturedText, '');
                });
                setTimeout(()=>{
                    const ta=document.querySelector('.modal-box textarea');
                    if(ta) ta.addEventListener('input',e=>capturedText=e.target.value);
                },100);
            }
        });
    }

    // Decide solo si el contenido es JSON o DXF: primero por extensión, si no hay
    // (texto pegado) por el arranque del contenido.
    function dispatchImport(text, filename){
        const name=(filename||'').toLowerCase();
        const trimmed=(text||'').trim();
        if(name.endsWith('.dxf')) return parseImportDXF(text);
        if(name.endsWith('.json')) return parseImportJSON(text);
        if(trimmed.startsWith('{') || trimmed.startsWith('[')) return parseImportJSON(text);
        if(/^0\s*[\r\n]+\s*SECTION/i.test(trimmed)) return parseImportDXF(text);
        try{ JSON.parse(text); return parseImportJSON(text); }catch(e){ return parseImportDXF(text); }
    }

function parseImportJSON(text){
    try{
        const data=JSON.parse(text);
        if(data.figures&&Array.isArray(data.figures)){
            if(data.grainDirection){grainDir=data.grainDirection;document.getElementById('grainDirBtn').textContent=grainDir==='horizontal'?'→':'↕';}
            saveState();figures=[...figures,...data.figures];
            centerViewOnFigures();redrawAll();
        } else if(Array.isArray(data)){
            if(!data.every(f=>f.vertices&&f.edges)){showModal({title:'Error',body:'Formato incorrecto.',buttons:[{label:'OK'}]});return;}
            saveState();figures=[...figures,...data];
            centerViewOnFigures();redrawAll();
        } else showModal({title:'Error',body:'Formato incorrecto.',buttons:[{label:'OK'}]});
    }catch(err){showModal({title:'Error',body:err.message,buttons:[{label:'OK'}]});}
}

// ===================== DXF (import/export) =====================
// Formato de intercambio con otros programas de patronaje/CAD. Se usa DXF R12 "puro"
// (solo sección ENTITIES, sin HEADER/TABLES) porque es lo que más ampliamente se puede
// abrir sin problemas. Unidad: cm (mismo criterio que el JSON). Eje Y se invierte al
// exportar/importar porque DXF usa Y hacia arriba y el canvas acá usa Y hacia abajo.
//
// Export: cada figura se manda como una POLYLINE 2D "pesada" (VERTEX + SEQEND), con las
// curvas muestreadas a segmentos rectos densos (sampleFigureEdges) — así se ve exacto en
// cualquier programa, aunque no queden editables como curvas del otro lado.
//
// Import soporta: LINE, POLYLINE (VERTEX/SEQEND), LWPOLYLINE, ARC, CIRCLE, y SPLINE (si
// trae "fit points" los usa para reconstruir una curva multipunto real con el mismo motor
// Catmull-Rom de PocketCAD; si no, cae a los puntos de control como polilínea). No soporta
// bloques/INSERT (se ignoran sin romper el resto del archivo) ni el bulge de arcos dentro
// de una POLYLINE/LWPOLYLINE (esos tramos se importan como línea recta entre los vértices).

    function exportDXF(){
        const scale = 1/PX_PER_CM; // px -> cm
        let ent = '';
        figures.forEach(fig=>{
            const pts = sampleFigureEdges(fig, 16);
            if (pts.length < 2) return;
            ent += `0\nPOLYLINE\n8\n0\n66\n1\n70\n${fig.closed?1:0}\n`;
            pts.forEach(p=>{
                ent += `0\nVERTEX\n8\n0\n10\n${(p.x*scale).toFixed(4)}\n20\n${(-p.y*scale).toFixed(4)}\n30\n0.0\n`;
            });
            ent += `0\nSEQEND\n`;
        });
        const dxf = `0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n5\n0\nENDSEC\n`
                  + `0\nSECTION\n2\nENTITIES\n${ent}0\nENDSEC\n0\nEOF\n`;
        exportContent('Exportar patron.dxf', dxf, 'patron.dxf', 'application/dxf');
    }

    // --- parser DXF de bajo nivel: pares (código de grupo, valor) -> entidades ---
    function dxfPairs(text){
        const lines = text.split(/\r\n|\r|\n/);
        const pairs = [];
        for (let i=0; i+1<lines.length; i+=2){
            const code = parseInt(lines[i].trim(), 10);
            if (isNaN(code)) continue;
            pairs.push([code, (lines[i+1]||'').trim()]);
        }
        return pairs;
    }

    function dxfEntitiesInSection(pairs, sectionName){
        let start=-1;
        for (let i=0; i<pairs.length; i++){
            if (pairs[i][0]===2 && pairs[i][1]===sectionName){ start=i+1; break; }
        }
        if (start===-1) return [];
        let end=pairs.length;
        for (let i=start; i<pairs.length; i++){
            if (pairs[i][0]===0 && pairs[i][1]==='ENDSEC'){ end=i; break; }
        }
        const scope = pairs.slice(start, end);
        const entities = []; let cur=null;
        scope.forEach(([code,val])=>{
            if (code===0){ if (cur) entities.push(cur); cur={type:val, codes:[]}; }
            else if (cur) cur.codes.push([code,val]);
        });
        if (cur) entities.push(cur);
        return entities;
    }

    function dxfGet(codes, code, all=false){
        const vals = codes.filter(c=>c[0]===code).map(c=>c[1]);
        return all ? vals : vals[0];
    }

    function dxfDedupeClosed(pts, closed){
        if (pts.length===0) return pts;
        const clean=[pts[0]];
        for (let k=1;k<pts.length;k++){
            const p=pts[k], q=clean[clean.length-1];
            if (Math.hypot(p.x-q.x, p.y-q.y) > 0.01) clean.push(p);
        }
        if (closed && clean.length>1){
            const f=clean[0], l=clean[clean.length-1];
            if (Math.hypot(f.x-l.x, f.y-l.y) < 0.05) clean.pop();
        }
        return clean;
    }

    function dxfPtsToFigure(pts, closed){
        const clean = dxfDedupeClosed(pts, closed);
        if (clean.length < 2) return null;
        clean.forEach(p => { p.hardCorner = true; }); // vértices reales del dibujo importado
        const edges = [];
        for (let k=0;k<clean.length-1;k++) edges.push(makeEdge(k,k+1));
        if (closed) edges.push(makeEdge(clean.length-1, 0));
        return { vertices: clean, edges, closed: !!closed, grain: null };
    }

    function parseDXFEntities(text){
        const pairs = dxfPairs(text);
        const entities = dxfEntitiesInSection(pairs, 'ENTITIES');
        const scale = PX_PER_CM; // cm -> px
        const out = [];
        let i = 0;
        while (i < entities.length){
            const e = entities[i];
            try {
                if (e.type === 'LINE'){
                    const x1=parseFloat(dxfGet(e.codes,10))*scale, y1=-parseFloat(dxfGet(e.codes,20))*scale;
                    const x2=parseFloat(dxfGet(e.codes,11))*scale, y2=-parseFloat(dxfGet(e.codes,21))*scale;
                    const fig = dxfPtsToFigure([{x:x1,y:y1},{x:x2,y:y2}], false);
                    if (fig) out.push(fig);
                    i++;
                } else if (e.type === 'LWPOLYLINE'){
                    const xs=dxfGet(e.codes,10,true).map(Number), ys=dxfGet(e.codes,20,true).map(Number);
                    const flags=parseInt(dxfGet(e.codes,70)||'0',10);
                    const closed=(flags&1)===1;
                    const pts=xs.map((x,idx)=>({x:x*scale, y:-ys[idx]*scale}));
                    const fig=dxfPtsToFigure(pts, closed);
                    if (fig) out.push(fig);
                    i++;
                } else if (e.type === 'POLYLINE'){
                    const flags=parseInt(dxfGet(e.codes,70)||'0',10);
                    const closed=(flags&1)===1;
                    i++;
                    const pts=[];
                    while (i<entities.length && entities[i].type==='VERTEX'){
                        const vx=parseFloat(dxfGet(entities[i].codes,10))*scale;
                        const vy=-parseFloat(dxfGet(entities[i].codes,20))*scale;
                        pts.push({x:vx,y:vy});
                        i++;
                    }
                    if (i<entities.length && entities[i].type==='SEQEND') i++;
                    const fig=dxfPtsToFigure(pts, closed);
                    if (fig) out.push(fig);
                } else if (e.type === 'CIRCLE'){
                    const cx=parseFloat(dxfGet(e.codes,10))*scale, cy=-parseFloat(dxfGet(e.codes,20))*scale;
                    const r=parseFloat(dxfGet(e.codes,40))*scale;
                    const pts=[];
                    for (let k=0;k<=48;k++){ const a=k/48*Math.PI*2; pts.push({x:cx+r*Math.cos(a), y:cy+r*Math.sin(a)}); }
                    const fig=dxfPtsToFigure(pts, true);
                    if (fig) out.push(fig);
                    i++;
                } else if (e.type === 'ARC'){
                    const cx=parseFloat(dxfGet(e.codes,10))*scale, cyDxf=parseFloat(dxfGet(e.codes,20))*scale;
                    const r=parseFloat(dxfGet(e.codes,40))*scale;
                    let a1=parseFloat(dxfGet(e.codes,50))*Math.PI/180;
                    let a2=parseFloat(dxfGet(e.codes,51))*Math.PI/180;
                    if (a2<=a1) a2+=Math.PI*2;
                    const steps=Math.max(8, Math.round((a2-a1)/(Math.PI*2)*48));
                    const pts=[];
                    for (let k=0;k<=steps;k++){
                        const a=a1+(a2-a1)*k/steps;
                        pts.push({x:cx+r*Math.cos(a), y:-(cyDxf+r*Math.sin(a))});
                    }
                    const fig=dxfPtsToFigure(pts, false);
                    if (fig) out.push(fig);
                    i++;
                } else if (e.type === 'SPLINE'){
                    const flags=parseInt(dxfGet(e.codes,70)||'0',10);
                    const closed=(flags&1)===1;
                    const fxs=dxfGet(e.codes,11,true).map(Number), fys=dxfGet(e.codes,21,true).map(Number);
                    let pts;
                    if (fxs.length>=2) pts = fxs.map((x,idx)=>({x:x*scale, y:-fys[idx]*scale}));
                    else {
                        const cxs=dxfGet(e.codes,10,true).map(Number), cys=dxfGet(e.codes,20,true).map(Number);
                        pts = cxs.map((x,idx)=>({x:x*scale, y:-cys[idx]*scale}));
                    }
                    const clean = dxfDedupeClosed(pts, closed);
                    if (clean.length>=2){
                        const fig = dxfPtsToFigure(clean, closed);
                        // si trajo puntos de ajuste (fit points) y la spline es abierta, reconstruyo
                        // como curva multipunto real (misma matemática que la herramienta de curva
                        // multipunto) en vez de dejarla como polilínea recta.
                        if (fig && !closed && fxs.length>=3){
                            // Puntos intermedios de este mismo spline: se dejan sin marcar (blandos,
                            // igual que la multipunto) para que la cadena se recalcule entera y suave.
                            // Las 2 puntas siguen siendo esquinas reales de la figura.
                            for (let k=1;k<fig.vertices.length-1;k++) fig.vertices[k].hardCorner = false;
                            recomputeCurveChain(fig, fig.edges.map((_,idx)=>idx));
                        }
                        if (fig) out.push(fig);
                    }
                    i++;
                } else {
                    i++; // entidad no soportada (INSERT, DIMENSION, TEXT, etc.): se ignora, no rompe el resto
                }
            } catch(errEnt){ i++; } // una entidad rara/corrupta no debe tirar abajo todo el import
        }
        return out;
    }

    function parseImportDXF(text){
        try{
            const newFigs = parseDXFEntities(text);
            if (!newFigs.length){
                showModal({title:'Error', body:'No se encontraron figuras reconocibles en el DXF (revisá que tenga una sección ENTITIES con LINE/POLYLINE/LWPOLYLINE/ARC/CIRCLE/SPLINE).', buttons:[{label:'OK'}]});
                return;
            }
            saveState();
            figures=[...figures, ...newFigs];
            centerViewOnFigures(); redrawAll();
        }catch(err){ showModal({title:'Error', body:'No se pudo leer el DXF: '+err.message, buttons:[{label:'OK'}]}); }
    }
