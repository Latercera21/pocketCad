/* zip.js — empaquetar y abrir .zip (para el formato .ora). Escribe sin compresión (los PNG ya vienen comprimidos); lee también "deflate". */
(function () {
  var tab = null;
  function crc32(u8) {
    if (!tab) { tab = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; tab[n] = c >>> 0; } }
    var crc = 0xFFFFFFFF; for (var i = 0; i < u8.length; i++) crc = tab[(crc ^ u8[i]) & 255] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
  // files: [{name, data: Uint8Array}] -> Blob
  PD.zip = function (files, type) {
    var enc = new TextEncoder(), parts = [], cen = [], off = 0;
    files.forEach(function (f) {
      var nm = enc.encode(f.name), len = f.data.length, crc = crc32(f.data);
      var h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(12, 0x21, true); h.setUint32(14, crc, true); h.setUint32(18, len, true); h.setUint32(22, len, true); h.setUint16(26, nm.length, true);
      parts.push(new Uint8Array(h.buffer), nm, f.data);
      var c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
      c.setUint16(14, 0x21, true); c.setUint32(16, crc, true); c.setUint32(20, len, true); c.setUint32(24, len, true); c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
      cen.push(new Uint8Array(c.buffer), nm);
      off += 30 + nm.length + len;
    });
    var cs = 0; cen.forEach(function (p) { cs += p.length; });
    var e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cs, true); e.setUint32(16, off, true);
    return new Blob(parts.concat(cen, [new Uint8Array(e.buffer)]), { type: type || 'application/zip' });
  };
  async function inflate(raw) {
    var s = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(s).arrayBuffer());
  }
  // ArrayBuffer -> { nombre: Uint8Array }
  PD.unzip = async function (buf) {
    var dv = new DataView(buf), u8 = new Uint8Array(buf), i = buf.byteLength - 22, out = {}, dec = new TextDecoder();
    while (i >= 0 && dv.getUint32(i, true) !== 0x06054b50) i--;
    if (i < 0) throw new Error('zip');
    var n = dv.getUint16(i + 10, true), off = dv.getUint32(i + 16, true);
    for (var k = 0; k < n; k++) {
      if (dv.getUint32(off, true) !== 0x02014b50) throw new Error('zip');
      var method = dv.getUint16(off + 10, true), cs = dv.getUint32(off + 20, true), nl = dv.getUint16(off + 28, true), el = dv.getUint16(off + 30, true), cl = dv.getUint16(off + 32, true), lho = dv.getUint32(off + 42, true);
      var name = dec.decode(u8.subarray(off + 46, off + 46 + nl));
      if (name.charAt(name.length - 1) !== '/') {
        var ds = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true), raw = u8.subarray(ds, ds + cs);
        out[name] = method === 0 ? raw : method === 8 ? await inflate(raw) : null;
      }
      off += 46 + nl + el + cl;
    }
    return out;
  };
})();
