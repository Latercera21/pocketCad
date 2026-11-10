/* db.js — autoguardado en IndexedDB: metadatos + un PNG por bloque (solo se reescriben los bloques que cambiaron). */
(function () {
  var dbp = null, st = 0, saving = false, again = false;
  function open() {
    if (!dbp) dbp = new Promise(function (res, rej) {
      var r = indexedDB.open('pocketdraw', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('meta'); r.result.createObjectStore('tiles'); };
      r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); };
    });
    return dbp;
  }
  function req(r) { return new Promise(function (res, rej) { r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; }); }
  function toBlob(c) { return new Promise(function (res) { c.toBlob(res, 'image/png'); }); }
  function decode(blob) {
    if (window.createImageBitmap) return createImageBitmap(blob);
    return new Promise(function (res, rej) { var u = URL.createObjectURL(blob), im = new Image(); im.onload = function () { URL.revokeObjectURL(u); res(im); }; im.onerror = rej; im.src = u; });
  }

  PD.save = function () {
    if (!PD.ready || !PD.dirty) return;
    clearTimeout(st); st = setTimeout(flush, 900);
  };
  PD.saveNow = function () { clearTimeout(st); if (PD.ready && PD.dirty) flush(); };

  async function flush() {
    if (saving) { again = true; return; }
    saving = true; PD.dirty = false;
    var batch = [];
    try {
      PD.layers.forEach(function (L) {
        Array.from(L.dirty).forEach(function (k) { batch.push({ L: L, k: k, t: L.tiles.get(k) || null }); });
        L.dirty.clear();
      });
      for (var i = 0; i < batch.length; i++) batch[i].blob = batch[i].t ? await toBlob(batch[i].t) : null;
      var db = await open(), orphanKeys = [];
      if (PD.orphan) {
        PD.orphan = false;
        var uids = {}; PD.layers.forEach(function (L) { uids[L.uid] = 1; });
        var all = await req(db.transaction('tiles').objectStore('tiles').getAllKeys());
        orphanKeys = all.filter(function (k) { return !uids[String(k).split('|')[0]]; });
      }
      var meta = PD.metaOut(), tx = db.transaction(['meta', 'tiles'], 'readwrite'), ts = tx.objectStore('tiles');
      batch.forEach(function (b) { var key = b.L.uid + '|' + b.k; if (b.blob) ts.put(b.blob, key); else ts.delete(key); });
      orphanKeys.forEach(function (k) { ts.delete(k); });
      tx.objectStore('meta').put(meta, 'project');
      await new Promise(function (res, rej) { tx.oncomplete = res; tx.onerror = tx.onabort = function () { rej(tx.error); }; });
      PD.lastSave = new Date(); PD.saveErr = false;
    } catch (e) {
      PD.saveErr = true; PD.dirty = true;
      batch.forEach(function (b) { b.L.dirty.add(b.k); });
    }
    saving = false;
    if (PD.ui) PD.ui.fileSync();
    if (again) { again = false; PD.dirty = true; PD.save(); }
  }

  // Carga el último proyecto autoguardado. Devuelve true si había uno.
  PD.dbLoad = async function () {
    try {
      var db = await open(), meta = await req(db.transaction('meta').objectStore('meta').get('project'));
      if (!meta || !Array.isArray(meta.layers) || !meta.layers.length) return false;
      var ts = db.transaction('tiles').objectStore('tiles'), jobs = meta.layers.map(function (m) {
        var rg = IDBKeyRange.bound(m.u + '|', m.u + '|￿');
        return Promise.all([req(ts.getAllKeys(rg)), req(ts.getAll(rg))]);
      });
      var got = await Promise.all(jobs), layers = [];
      for (var i = 0; i < meta.layers.length; i++) {
        var m = meta.layers[i], L = PD.newLayer(m.n, m.u); L.vis = m.v !== false; L.a = isFinite(m.a) ? m.a : 1;
        var keys = got[i][0], blobs = got[i][1];
        for (var j = 0; j < keys.length; j++) {
          try {
            var bmp = await decode(blobs[j]), t = PD.tileCanvas(); t.getContext('2d').drawImage(bmp, 0, 0); if (bmp.close) bmp.close();
            L.tiles.set(String(keys[j]).slice(m.u.length + 1), t);
          } catch (e) {}
        }
        layers.push(L);
      }
      PD.layers.length = 0; layers.forEach(function (L) { PD.layers.push(L); });
      PD.act = layers[meta.act >= 0 && meta.act < layers.length ? meta.act : layers.length - 1];
      PD.cfgIn(meta.cfg);
      if (meta.view && isFinite(meta.view.s)) { PD.view = meta.view; PD.loadedView = true; }
      PD.bgRestore(meta.bg);
      return true;
    } catch (e) { return false; }
  };
  document.addEventListener('visibilitychange', function () { if (document.hidden) PD.saveNow(); });
  window.addEventListener('pagehide', function () { PD.saveNow(); });
})();
