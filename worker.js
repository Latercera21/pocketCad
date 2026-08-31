// Worker de la app: carga el motor WASM (sparrow_app.wasm embebido en
// engine_base64.js) y resuelve el anidado. Mismo pipeline C++ que
// sparrow_solo.cpp: NFP informa el inicio + Sparrow resolverISPP.
// Opciones nuevas de esta app (manejadas en el driver, motor intacto):
//   rotMode: 0 = fija en 0 grados, 1 = 0/180 (actual)
//   counts:  cuantas copias de cada figura (multiplicidad)
importScripts("sparrow_app.js", "engine_base64.js");

var sparrowModule = null;

function base64ToBytes(b64) {
  var bin = atob(b64);
  var bytes = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function init() {
  // El glue de emscripten 6.0.8 no soporta Module.wasmBinary: se le da el
  // binario embebido por el hook instantiateWasm (100% offline).
  return createSparrowApp({
    instantiateWasm: function (imports, receiveInstance) {
      WebAssembly.instantiate(base64ToBytes(SPARROW_WASM_B64), imports).then(function (res) {
        receiveInstance(res.instance);
      });
      return {};
    }
  }).then(function (m) {
    sparrowModule = m;
    return m;
  });
}

function writeJson(m, text) {
  var enc = new TextEncoder();
  var u8 = enc.encode(text);
  var ptr = m._malloc(u8.length);
  new Uint8Array(m.HEAPU8.buffer, ptr, u8.length).set(u8);
  return { ptr: ptr, len: u8.length };
}

function writeCounts(m, counts) {
  if (!counts || !counts.length) return { ptr: 0, len: 0 };
  var ptr = m._malloc(counts.length * 4);
  m.HEAP32.set(counts, ptr >> 2);
  return { ptr: ptr, len: counts.length };
}

function leerResultado(m) {
  var n = m._sparrow_count();
  var ptr = m._sparrow_buffer();
  if (!ptr || n <= 0) return { count: 0, pieces: [] };
  var base = ptr / Float64Array.BYTES_PER_ELEMENT;
  var pieces = [];
  for (var i = 0; i < n; i++) {
    var start = m._sparrow_polyStart(i);
    var v = m._sparrow_verts(i);
    var pts = [];
    for (var k = 0; k < v; k++) pts.push(m.HEAPF64[base + (start + k) * 2], m.HEAPF64[base + (start + k) * 2 + 1]);
    pieces.push(pts);
  }
  return { count: n, pieces: pieces };
}

self.onmessage = function (ev) {
  var msg = ev.data;
  if (!msg || msg.type !== "solve") return;

  init().then(function () {
    var m = sparrowModule;
    var tW = msg.telaW || 160;
    var seed = msg.seed || 1;
    var tExpl = msg.tExpl || 30;
    var tComp = msg.tComp || 15;
    var rotMode = (msg.rotMode == null) ? 1 : msg.rotMode;
    var t0 = performance.now();
    var j = writeJson(m, msg.jsonText);
    var c = writeCounts(m, msg.counts);
    var rc;
    try {
      rc = m._sparrow_run(j.ptr, j.len, tW, seed, tExpl, tComp, rotMode, c.ptr, c.len);
    } catch (e) {
      rc = 1;
    } finally {
      m._free(j.ptr);
      if (c.ptr) m._free(c.ptr);
    }

    var err = "";
    try { var ep = m._sparrow_error(); if (ep) err = m.UTF8ToString(ep); } catch (e) {}
    var largo = 0, perdida = 0, factible = false, contencion = false;
    try { largo = m._sparrow_largo(); } catch (e) {}
    try { perdida = m._sparrow_perdida(); } catch (e) {}
    try { factible = m._sparrow_factible() === 1; } catch (e) {}
    try { contencion = m._sparrow_contencion() === 1; } catch (e) {}

    var res = rc === 0 ? leerResultado(m) : { count: 0, pieces: [] };
    self.postMessage({
      type: "result", ok: rc === 0, rc: rc,
      telaW: tW, seed: seed, rotMode: rotMode,
      largo: largo, perdida: perdida, factible: factible,
      contencion: contencion,
      count: res.count, pieces: res.pieces, error: err,
      elapsedMs: performance.now() - t0
    });
  }).catch(function (e) {
    self.postMessage({ type: "result", ok: false, error: String(e && e.stack || e) });
  });
};