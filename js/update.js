// PocketCAD - módulo: update
// Avisa cuando hay una versión nueva publicada y permite forzar la actualización sin perder los dibujos.
// Publicar mejora = cambiar APP_VERSION (pocketcad.html) y "v" (version.json) al MISMO número.

    async function forceUpdate(){
        try { if (window.caches) { const ks = await caches.keys(); await Promise.all(ks.map(k => caches.delete(k))); } } catch(e) {}
        try { if (navigator.serviceWorker) { const rs = await navigator.serviceWorker.getRegistrations(); await Promise.all(rs.map(r => r.unregister())); } } catch(e) {}
        // localStorage e IndexedDB (dibujo, tema, fondo) NO se tocan. El parámetro nuevo salta el caché del HTML.
        location.replace(location.pathname + '?u=' + Date.now());
    }

    function showUpdateBanner(v){
        if (document.getElementById('updateBanner')) return;
        const d = document.createElement('div');
        d.id = 'updateBanner';
        d.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:14px;z-index:99999;background:#2f8f86;color:#fff;padding:8px 12px;border-radius:8px;font:14px sans-serif;display:flex;gap:10px;align-items:center;box-shadow:0 2px 8px rgba(0,0,0,.35)';
        d.innerHTML = '<span>Hay una versión nueva (v' + v + ')</span>';
        const b = document.createElement('button');
        b.textContent = 'Actualizar'; b.style.cssText = 'padding:4px 10px;border:0;border-radius:6px;font-weight:bold';
        b.onclick = forceUpdate;
        const x = document.createElement('button');
        x.textContent = '✕'; x.style.cssText = 'padding:4px 8px;border:0;border-radius:6px;background:transparent;color:#fff';
        x.onclick = () => d.remove();
        d.appendChild(b); d.appendChild(x);
        document.body.appendChild(d);
    }

    async function checkForUpdate(){
        try {
            const r = await fetch('version.json?t=' + Date.now(), {cache: 'no-store'});
            if (!r.ok) return;
            const j = await r.json();
            if (j && j.v && String(j.v) !== String(APP_VERSION)) showUpdateBanner(j.v);
        } catch(e) {}   // sin internet o file://: no pasa nada
    }

    (function(){
        const l = document.getElementById('appVerLbl'); if (l) l.textContent = 'v' + APP_VERSION;
        checkForUpdate();
        document.addEventListener('visibilitychange', () => { if (!document.hidden) checkForUpdate(); });
    })();
