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
                vertices:fig.vertices.map(v=>({x:v.x,y:v.y})),
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

    function importJSON(){
    showModal({
        title:'Importar JSON',
        body:'¿Subir archivo o pegar texto?',
        buttons:[{label:'📂 Archivo',value:'file'},{label:'📋 Pegar',value:'paste'},{label:'✕ Cancelar',value:'cancel'}]
    }).then(action=>{
        if(action==='file'){
            const inp=document.createElement('input');inp.type='file';inp.accept='.json';
            inp.onchange=e=>{
                const file=e.target.files[0];if(!file)return;
                const reader=new FileReader();
                reader.onload=ev=>{ parseImportJSON(ev.target.result); };
                reader.readAsText(file);
            };
            inp.click();
        } else if(action==='paste'){
    let capturedText='';
    showModal({
        title:'Pegar JSON',
        textarea:'',
        editable:true,
        buttons:[{label:'✓ Importar',value:'ok'},{label:'✕ Cancelar',value:'cancel'}]
    }).then(r=>{
        if(r==='ok') parseImportJSON(capturedText);
    });
    setTimeout(()=>{
        const ta=document.querySelector('.modal-box textarea');
        if(ta) ta.addEventListener('input',e=>capturedText=e.target.value);
    },100);
}
    });
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
