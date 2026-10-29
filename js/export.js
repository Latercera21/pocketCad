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

    // ---- Metadatos por pieza para el nesting (campos NUEVOS, aditivos; la geometría NO se rota) ----
    //  grainVector   vector unitario del hilo en coordenadas de lienzo, tal como se dibujó
    //  rotationDeg   0|90|180|270, antihorario: lo que el NESTING aplica al polígono ya importado
    //                (con su flip de Y) para dejar el HILO vertical. Se orienta por hilo, nunca por
    //                bounding box. Sin hilo: 0 (comportamiento anterior).
    //  largoCm       extensión a lo largo del hilo; anchoCm = su perpendicular (sin hilo: lado mayor/menor)
    //  espejo        copia hecha con Reflejar (guardado al reflejar, no deducido)
    //  permiteVoltear false por defecto: el nesting no debe voltear la pieza
    //  name          editable en el diálogo de exportación; por defecto "Pieza N"
    function pieceDefaultName(k){ return 'Pieza ' + (k+1); }

    function round3(v){ return Math.round(v*1000)/1000; }

    function pieceExportMeta(fig, name){
        const pts = sampleFigureEdges(fig, 24);
        let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
        pts.forEach(p=>{minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);});
        const wCm = (maxX-minX)/PX_PER_CM, hCm = (maxY-minY)/PX_PER_CM;
        let grainVector=null, rotationDeg=0, largo, ancho;
        if (fig.grain === 'vertical')        { grainVector={dx:0,dy:1}; rotationDeg=0;  largo=hCm; ancho=wCm; }
        else if (fig.grain === 'horizontal') { grainVector={dx:1,dy:0}; rotationDeg=90; largo=wCm; ancho=hCm; }
        else                                  { largo=Math.max(wCm,hCm); ancho=Math.min(wCm,hCm); }
        // Eje de simetría (tizada tubular): lado recto que el nesting debe pegar a un borde.
        // Coordenadas en las mismas unidades/orientación que "vertices" de esta pieza.
        let axisMeta = null;
        const ai = fig.edges.findIndex(e=>e.axis);
        if (ai >= 0) {
            const ae = fig.edges[ai], pa = fig.vertices[ae.start], pb = fig.vertices[ae.end];
            axisMeta = {edge: ai, x1: round3(pa.x), y1: round3(pa.y), x2: round3(pb.x), y2: round3(pb.y)};
        }
        const meta = {
            name: name,
            grainVector: grainVector,
            rotationDeg: rotationDeg,
            largoCm: round3(largo),
            anchoCm: round3(ancho),
            espejo: !!fig.espejo,
            permiteVoltear: !!fig.permiteVoltear
        };
        if (axisMeta) { meta.ejeSimetria = axisMeta; meta.pegarABorde = true; }
        return meta;
    }

    // Piezas con hilo: la geometría se exporta ACOSTADA (hilo horizontal, a lo largo de X) para que el
    // nesting, que hoy lee la forma dibujada y no el hilo, coloque el largo de la pieza a lo largo del
    // paño. Giro rígido de 90° (sin espejo) alrededor del centro de la caja; sin hilo no se toca nada.
    function layDownForExport(fig){
        if (!(fig.closed && fig.grain === 'vertical')) return {vertices:fig.vertices, edges:fig.edges, grain:fig.grain||null, rotated:false};
        const pts = sampleFigureEdges(fig, 24);
        let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
        pts.forEach(p=>{minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);});
        const cx=(minX+maxX)/2, cy=(minY+maxY)/2;
        const rx=(x,y)=>cx+(y-cy), ry=(x,y)=>cy-(x-cx);   // (x,y)→(y,−x): el hilo vertical queda horizontal
        return {
            vertices: fig.vertices.map(v=>Object.assign({}, v, {x:rx(v.x,v.y), y:ry(v.x,v.y)})),
            edges: fig.edges.map(e=>{
                const q=Object.assign({}, e);
                if (e.controlX!=null)  { q.controlX =rx(e.controlX, e.controlY);  q.controlY =ry(e.controlX, e.controlY); }
                if (e.control2X!=null) { q.control2X=rx(e.control2X,e.control2Y); q.control2Y=ry(e.control2X,e.control2Y); }
                return q;
            }),
            grain:'horizontal', rotated:true
        };
    }

    function buildExportData(){
        let k = 0;
        return {
            unit:'cm',pxPerCm:PX_PER_CM,grainDirection:grainDir,
            figures:figures.map(fig=>{
                const L = layDownForExport(fig);
                const o = {
                    grain:L.grain, closed:fig.closed,
                    vertices:L.vertices.map(v=>{const q={x:v.x,y:v.y}; if(v.hardCorner)q.hardCorner=true; if(v.dartApex)q.dartApex=true; return q;}),
                    edges:L.edges
                };
                // solo las piezas (figuras cerradas) llevan metadatos; las líneas abiertas salen como siempre
                if (fig.closed && fig.vertices.length >= 3) {
                    const name = (fig.name && String(fig.name).trim()) || pieceDefaultName(k);
                    k++;
                    Object.assign(o, pieceExportMeta({vertices:L.vertices, edges:L.edges, grain:L.grain, espejo:fig.espejo, permiteVoltear:fig.permiteVoltear}, name));
                    if (L.grain === 'horizontal') o.rotationDeg = 0;   // ya sale acostada: el nesting no debe girarla
                }
                return o;
            })
        };
    }

    // Diálogo con un campo de nombre por pieza. Devuelve una promesa: true = exportar, false = cancelar.
    function askPieceNames(){
        const idx = [];
        figures.forEach((f,i)=>{ if (f.closed && f.vertices.length >= 3) idx.push(i); });
        if (!idx.length) return Promise.resolve(true);
        return new Promise(resolve=>{
            const overlay=document.createElement('div'); overlay.className='modal-overlay';
            const box=document.createElement('div'); box.className='modal-box';
            const t=document.createElement('div'); t.className='modal-title'; t.textContent='Nombre de cada pieza'; box.appendChild(t);
            const list=document.createElement('div');
            list.style.cssText='display:flex;flex-direction:column;gap:5px;max-height:50vh;overflow:auto;';
            const inputs=[];
            idx.forEach((fi,k)=>{
                const row=document.createElement('div'); row.style.cssText='display:flex;gap:6px;align-items:center;';
                const lbl=document.createElement('span'); lbl.style.cssText='font-size:12px;min-width:22px;'; lbl.textContent=(k+1)+'.';
                const inp=document.createElement('input'); inp.type='text'; inp.value=figures[fi].name||pieceDefaultName(k);
                inp.style.cssText='flex:1;width:auto;font-size:13px;padding:5px;';
                const g=figures[fi].grain; const tag=document.createElement('span'); tag.style.cssText='font-size:11px;opacity:0.7;';
                tag.textContent = g==='vertical' ? '↕' : g==='horizontal' ? '↔' : 'sin hilo';
                row.appendChild(lbl); row.appendChild(inp); row.appendChild(tag); list.appendChild(row); inputs.push(inp);
            });
            box.appendChild(list);
            const row=document.createElement('div'); row.className='modal-row';
            const done=v=>{
                document.body.removeChild(overlay);
                if (v) {
                    inputs.forEach((inp,k)=>{
                        const val=inp.value.trim(), fig=figures[idx[k]];
                        if (!val || val===pieceDefaultName(k)) { if (!fig.name) return; }
                        fig.name = (!val || val===pieceDefaultName(k)) ? undefined : val;
                    });
                    autoSaveDebounced();
                }
                resolve(v);
            };
            const ok=document.createElement('button'); ok.textContent='Exportar'; ok.onclick=()=>done(true);
            const no=document.createElement('button'); no.textContent='Cancelar'; no.onclick=()=>done(false);
            row.appendChild(ok); row.appendChild(no); box.appendChild(row); overlay.appendChild(box);
            document.body.appendChild(overlay);
        });
    }

    function exportJSON(){
        askPieceNames().then(go=>{
            if (!go) return;
            const json=JSON.stringify(buildExportData(),null,2);
            exportContent('Exportar patron.json', json, 'patron.json', 'application/json');
        });
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

function stripDerivedPieceFields(figs){
    figs.forEach(f=>{ delete f.grainVector; delete f.rotationDeg; delete f.largoCm; delete f.anchoCm; delete f.ejeSimetria; delete f.pegarABorde; });
    return figs;
}

function parseImportJSON(text){
    try{
        const data=JSON.parse(text);
        if(data.figures&&Array.isArray(data.figures)){
            if(data.grainDirection){grainDir=data.grainDirection;document.getElementById('grainDirBtn').textContent=grainDir==='horizontal'?'→':'↕';}
            saveState();figures=[...figures,...stripDerivedPieceFields(data.figures)];
            centerViewOnFigures();redrawAll();
        } else if(Array.isArray(data)){
            if(!data.every(f=>f.vertices&&f.edges)){showModal({title:'Error',body:'Formato incorrecto.',buttons:[{label:'OK'}]});return;}
            saveState();figures=[...figures,...stripDerivedPieceFields(data)];
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
// Catmull-Rom de PocketCAD; si no, cae a los puntos de control como polilínea). Soporta
// INSERT/BLOCKS (1 nivel; formato CLO3D). No soporta el bulge de arcos dentro
// de una POLYLINE/LWPOLYLINE (esos tramos se importan como línea recta entre los vértices).

    function exportDXF(){
        const scale = 1/PX_PER_CM; // px -> cm
        // Puntos en cm (Y invertido) por figura; sin vértice final duplicado si es cerrada.
        const polys = [];
        figures.forEach(fig=>{
            let pts = sampleFigureEdges(fig, 16).map(p=>({x:p.x*scale, y:-p.y*scale}));
            if (fig.closed && pts.length>2){
                const f=pts[0], l=pts[pts.length-1];
                if (Math.hypot(f.x-l.x,f.y-l.y) < 1e-4) pts.pop();
            }
            if (pts.length < 2) return;
            polys.push({pts, closed: !!fig.closed});
        });
        if (!polys.length) return;
        // Trasladar al origen (coordenadas chicas, más compatibles con CLO3D)
        let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
        polys.forEach(p=>p.pts.forEach(q=>{minX=Math.min(minX,q.x);minY=Math.min(minY,q.y);maxX=Math.max(maxX,q.x);maxY=Math.max(maxY,q.y);}));
        const f4=v=>v.toFixed(4);
        let ent = '';
        polys.forEach(p=>{
            ent += `0\nPOLYLINE\n8\n0\n66\n1\n10\n0.0\n20\n0.0\n30\n0.0\n70\n${p.closed?1:0}\n`;
            p.pts.forEach(q=>{
                ent += `0\nVERTEX\n8\n0\n10\n${f4(q.x-minX)}\n20\n${f4(q.y-minY)}\n30\n0.0\n`;
            });
            ent += `0\nSEQEND\n8\n0\n`;
        });
        const dxf = `0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n`
                  + `9\n$INSUNITS\n70\n5\n`
                  + `9\n$EXTMIN\n10\n0.0\n20\n0.0\n30\n0.0\n`
                  + `9\n$EXTMAX\n10\n${f4(maxX-minX)}\n20\n${f4(maxY-minY)}\n30\n0.0\n0\nENDSEC\n`
                  + `0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n1\n0\nLAYER\n2\n0\n70\n0\n62\n7\n6\nCONTINUOUS\n0\nENDTAB\n0\nENDSEC\n`
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

    // Aplica la transformación de un INSERT (posición, escala, rotación, punto base del bloque)
    // a los pares de coordenadas (10/20, 11/21) de una entidad. Devuelve una copia.
    function dxfXformEntity(e, ins){
        const rot=(ins.rot||0)*Math.PI/180, cs=Math.cos(rot), sn=Math.sin(rot);
        const codes=e.codes.map(c=>[c[0],c[1]]);
        for (let j=0;j<codes.length;j++){
            const c=codes[j][0];
            if ((c===10||c===11) && j+1<codes.length && codes[j+1][0]===c+10){
                const x=(parseFloat(codes[j][1])-ins.bx)*ins.sx, y=(parseFloat(codes[j+1][1])-ins.by)*ins.sy;
                codes[j][1]  =String(ins.x + x*cs - y*sn);
                codes[j+1][1]=String(ins.y + x*sn + y*cs);
            } else if (c===40 && (e.type==='CIRCLE'||e.type==='ARC')){
                codes[j][1]=String(parseFloat(codes[j][1])*Math.abs(ins.sx));
            } else if ((c===50||c===51) && e.type==='ARC'){
                codes[j][1]=String(parseFloat(codes[j][1])+(ins.rot||0));
            }
        }
        return {type:e.type, codes};
    }

    // Devuelve la lista plana de entidades a importar: las de ENTITIES con cada INSERT
    // reemplazado por el contenido de su bloque (sección BLOCKS). CLO3D/Marvelous Designer
    // y otros guardan toda la geometría dentro de bloques "Pattern_xxx_M" y dejan ENTITIES
    // solo con INSERT. Si ENTITIES no trae nada utilizable, cae a leer todos los bloques.
    function dxfResolveInserts(pairs){
        const top = dxfEntitiesInSection(pairs, 'ENTITIES');
        const raw = dxfEntitiesInSection(pairs, 'BLOCKS');
        const blocks = {}; let cur=null;
        raw.forEach(e=>{
            if (e.type==='BLOCK'){
                cur={ name:dxfGet(e.codes,2), bx:parseFloat(dxfGet(e.codes,10)||'0')||0, by:parseFloat(dxfGet(e.codes,20)||'0')||0, ents:[] };
                if (cur.name!==undefined) blocks[cur.name]=cur;
            } else if (e.type==='ENDBLK'){ cur=null; }
            else if (cur) cur.ents.push(e);
        });
        const out=[];
        top.forEach(e=>{
            if (e.type!=='INSERT'){ out.push(e); return; }
            const b=blocks[dxfGet(e.codes,2)];
            if (!b) return;
            const ins={
                x:parseFloat(dxfGet(e.codes,10)||'0')||0, y:parseFloat(dxfGet(e.codes,20)||'0')||0,
                sx:parseFloat(dxfGet(e.codes,41)||'1')||1, sy:parseFloat(dxfGet(e.codes,42)||dxfGet(e.codes,41)||'1')||1,
                rot:parseFloat(dxfGet(e.codes,50)||'0')||0, bx:b.bx, by:b.by
            };
            b.ents.forEach(be=>out.push(dxfXformEntity(be, ins)));
        });
        if (!out.some(e=>e.type!=='INSERT')){          // sin ENTITIES útiles: leer los bloques tal cual
            Object.values(blocks).forEach(b=>b.ents.forEach(be=>out.push(be)));
        }
        return out;
    }

    function parseDXFEntities(text){
        const pairs = dxfPairs(text);
        const entities = dxfResolveInserts(pairs);
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

// ================= Exportar PDF (escala real 1:1, vectorial) =================
// 1 px de PocketCAD = 1/96 pulgada = 0.75 pt de PDF, así que no hay conversión rara:
// al imprimir al 100% ("tamaño real", sin "ajustar a la página") las medidas salen exactas.
// Modos: A4 / A3 por hojas (mosaico con 1 cm de solape y marcas) o una sola hoja a medida.

    function pdfN(n){ return (Math.round(n*100)/100).toString(); }

    function pdfFigureOps(fig, X, Y){
        let s='', last=null, moves=0;
        fig.edges.forEach(e=>{
            const a=fig.vertices[e.start], b=fig.vertices[e.end];
            if(!last || Math.abs(last.x-a.x)>1e-6 || Math.abs(last.y-a.y)>1e-6){ s+=`${pdfN(X(a.x))} ${pdfN(Y(a.y))} m\n`; moves++; }
            if(e.cubic && e.control2X!=null){
                s+=`${pdfN(X(e.controlX))} ${pdfN(Y(e.controlY))} ${pdfN(X(e.control2X))} ${pdfN(Y(e.control2Y))} ${pdfN(X(b.x))} ${pdfN(Y(b.y))} c\n`;
            } else if(e.curved && e.controlX!=null){
                const c1={x:a.x+2/3*(e.controlX-a.x), y:a.y+2/3*(e.controlY-a.y)};
                const c2={x:b.x+2/3*(e.controlX-b.x), y:b.y+2/3*(e.controlY-b.y)};
                s+=`${pdfN(X(c1.x))} ${pdfN(Y(c1.y))} ${pdfN(X(c2.x))} ${pdfN(Y(c2.y))} ${pdfN(X(b.x))} ${pdfN(Y(b.y))} c\n`;
            } else s+=`${pdfN(X(b.x))} ${pdfN(Y(b.y))} l\n`;
            last=b;
        });
        if(fig.closed && moves===1) s+='h\n';
        return s+'S\n';
    }

    function pdfGrainOps(fig, X, Y){
        if(!fig.grain || !fig.closed) return '';
        const c=getCentroid(fig), L=3*PX_PER_CM, hs=0.35*PX_PER_CM;       // 3 cm a cada lado
        const dx=fig.grain==='horizontal'?1:0, dy=fig.grain==='horizontal'?0:1;
        const p1={x:c.x-dx*L,y:c.y-dy*L}, p2={x:c.x+dx*L,y:c.y+dy*L};
        let s=`${pdfN(X(p1.x))} ${pdfN(Y(p1.y))} m ${pdfN(X(p2.x))} ${pdfN(Y(p2.y))} l S\n`;
        const head=(t,ux,uy)=>{const px=-uy,py=ux;
            return `${pdfN(X(t.x))} ${pdfN(Y(t.y))} m ${pdfN(X(t.x-ux*hs+px*hs*0.45))} ${pdfN(Y(t.y-uy*hs+py*hs*0.45))} l ${pdfN(X(t.x-ux*hs-px*hs*0.45))} ${pdfN(Y(t.y-uy*hs-py*hs*0.45))} l f\n`;};
        return s+head(p2,dx,dy)+head(p1,-dx,-dy);
    }

    function buildPatternPDF(mode){
        const PT=0.75;                                   // px -> pt
        const figs=figures.filter(f=>f.vertices.length>1 && f.edges.length);
        const polys=figs.map(f=>sampleFigureEdges(f,16));
        let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
        polys.forEach(pl=>pl.forEach(p=>{minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);}));
        minX*=PT;minY*=PT;maxX*=PT;maxY*=PT;
        const W=maxX-minX, H=maxY-minY;
        const MM=72/25.4, margin=10*MM, overlap=10*MM, pad=15*MM, barLen=50*MM;
        let pageW,pageH,tiles=[];
        if(mode==='single'){
            pageW=Math.max(W+2*pad, barLen+2*pad); pageH=H+2*pad+10*MM;
            if(pageW>14400||pageH>14400) return {err:'El patrón es demasiado grande para una sola hoja PDF. Usa A4 o A3 por hojas.'};
            tiles.push({x0:minX-pad, y0:minY-pad-10*MM, pw:pageW, ph:pageH, m:0, label:''});
        } else {
            const sizes={a4:[210,297],a3:[297,420]}[mode]||[210,297];
            pageW=sizes[0]*MM; pageH=sizes[1]*MM;
            const pw=pageW-2*margin, ph=pageH-2*margin, sx=pw-overlap, sy=ph-overlap;
            const cols=Math.max(1,Math.ceil((W-overlap)/sx)), rows=Math.max(1,Math.ceil((H-overlap)/sy));
            for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
                const x0=minX+c*sx, y0=minY+r*sy;
                const hit=polys.some(pl=>{ for(let i=1;i<pl.length;i++){
                    const ax=pl[i-1].x*PT, ay=pl[i-1].y*PT, bx=pl[i].x*PT, by=pl[i].y*PT;
                    if(Math.max(ax,bx)>=x0 && Math.min(ax,bx)<=x0+pw && Math.max(ay,by)>=y0 && Math.min(ay,by)<=y0+ph) return true; } return false; });
                if(hit) tiles.push({x0,y0,pw,ph,m:margin,label:`fila ${r+1}, col ${c+1}`});
            }
        }
        const total=tiles.length;
        const objs=[];                                    // cada objeto = string
        objs[1]='<< /Type /Catalog /Pages 2 0 R >>';
        objs[3]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
        const kids=[];
        tiles.forEach((t,i)=>{
            const X=x=>t.m + (x*PT - t.x0);
            const Y=y=>pageH - (t.m + (y*PT - t.y0));
            let cs='';
            // patrón (recortado al área imprimible)
            cs+='q\n';
            if(mode!=='single') cs+=`${pdfN(t.m)} ${pdfN(pageH-t.m-t.ph)} ${pdfN(t.pw)} ${pdfN(t.ph)} re W n\n`;
            cs+='0 0 0 RG 0 0 0 rg 0.75 w 1 J 1 j\n';
            figs.forEach(f=>{ cs+=pdfFigureOps(f,X,Y); });
            cs+='0.1 0.35 0.75 RG 0.1 0.35 0.75 rg 0.75 w\n';
            figs.forEach(f=>{ cs+=pdfGrainOps(f,X,Y); });
            cs+='Q\n';
            // marcas de esquina, regla de 5 cm y rótulo (fuera del recorte)
            cs+='0.4 G 0.4 w\n';
            if(mode!=='single'){
                const L=t.m, R=t.m+t.pw, B=pageH-t.m-t.ph, T=pageH-t.m, k=8;
                [[L,T,1,-1],[R,T,-1,-1],[L,B,1,1],[R,B,-1,1]].forEach(([cx,cy,sx,sy])=>{
                    cs+=`${pdfN(cx)} ${pdfN(cy)} m ${pdfN(cx+sx*k)} ${pdfN(cy)} l S ${pdfN(cx)} ${pdfN(cy)} m ${pdfN(cx)} ${pdfN(cy+sy*k)} l S\n`; });
            }
            const by=pageH-(mode==='single'?14:18), bx=(mode==='single'?pad:t.m);
            cs+=`${pdfN(bx)} ${pdfN(by)} m ${pdfN(bx+barLen)} ${pdfN(by)} l S ${pdfN(bx)} ${pdfN(by-3)} m ${pdfN(bx)} ${pdfN(by+3)} l S ${pdfN(bx+barLen)} ${pdfN(by-3)} m ${pdfN(bx+barLen)} ${pdfN(by+3)} l S\n`;
            const head= mode==='single' ? 'Escala 1:1' : `Hoja ${i+1}/${total} (${t.label})  Escala 1:1`;
            cs+=`0.3 g BT /F1 7 Tf ${pdfN(bx+barLen+5)} ${pdfN(by-2.5)} Td (5 cm = esta regla - ${head}) Tj ET\n`;
            const pageObj=4+i*2, contObj=5+i*2;
            objs[pageObj]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pdfN(pageW)} ${pdfN(pageH)}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contObj} 0 R >>`;
            objs[contObj]=`<< /Length ${cs.length} >>\nstream\n${cs}endstream`;
            kids.push(`${pageObj} 0 R`);
        });
        objs[2]=`<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${total} >>`;
        let out='%PDF-1.4\n', offs=[];
        for(let i=1;i<objs.length;i++){ offs[i]=out.length; out+=`${i} 0 obj\n${objs[i]}\nendobj\n`; }
        const xr=out.length;
        out+=`xref\n0 ${objs.length}\n0000000000 65535 f \n`;
        for(let i=1;i<objs.length;i++) out+=String(offs[i]).padStart(10,'0')+' 00000 n \n';
        out+=`trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xr}\n%%EOF\n`;
        const bytes=new Uint8Array(out.length);
        for(let i=0;i<out.length;i++) bytes[i]=out.charCodeAt(i)&255;
        return {bytes, pages:total};
    }

    function exportPDF(){
        if(!figures.some(f=>f.vertices.length>1)){ showModal({title:'PDF', body:'No hay figuras para exportar.', buttons:[{label:'OK'}]}); return; }
        showModal({title:'Exportar PDF (escala real 1:1)',
            body:'Al imprimir elige tamaño real / 100% (sin "ajustar a la página"). Cada hoja trae una regla de 5 cm para comprobar la escala.',
            nameInputDefault:'patron',
            buttons:[{label:'A4 por hojas',value:'a4'},{label:'A3 por hojas',value:'a3'},{label:'Hoja única',value:'single'},{label:'✕',value:'close'}]
        }).then(res=>{
            if(!res || res.action==='close') return;
            const r=buildPatternPDF(res.action);
            if(r.err){ showModal({title:'PDF', body:r.err, buttons:[{label:'OK'}]}); return; }
            const blob=new Blob([r.bytes],{type:'application/pdf'});
            const url=URL.createObjectURL(blob);
            const el=document.createElement('a');
            el.href=url; el.download=(res.name||'patron')+'.pdf'; el.style.display='none';
            document.body.appendChild(el); el.click(); document.body.removeChild(el);
            setTimeout(()=>URL.revokeObjectURL(url),1000);
        });
    }
