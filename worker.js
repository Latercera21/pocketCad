// Web Worker: loads the Sparrow WASM module and runs the solver off the
// main thread so the page stays responsive.
// - Sin archivo cargado: usa la pieza embebida (DAMA-TM-SIEMPRE-W-CIERRE),
//   con el lector de JSON nativo del wasm.
// - Con archivo cargado: parsea el JSON de figuras en JS (misma logica de
//   edges/curvas que el motor) y envia los poligonos a sparrow_run.
// El wasm viaja incrustado en base64 (wasm_b64.js): no hace falta descargar
// ningun .wasm, asi no hay problemas de tipos MIME en Neocities.
importScripts("sparrow_wasm.js", "wasm_b64.js");

var sparrowModule = null;

function base64ToBytes(b64) {
  var bin = atob(b64);
  var bytes = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function init() {
  return createSparrow({
    wasmBinary: base64ToBytes(WASM_B64)
  }).then(function (m) {
    sparrowModule = m;
    return m;
  });
}

// Pasa poligonos (cm) al motor. polys = [ [x0,y0,x1,y1,...], ... ]
function callRun(polys, tW, seed, segExplorar, segComprimir) {
  var m = sparrowModule;
  var sizes = new Int32Array(polys.length);
  var total = 0;
  for (var i = 0; i < polys.length; i++) {
    sizes[i] = polys[i].length / 2;
    total += polys[i].length;
  }
  var floatPtr = m._malloc(total * Float64Array.BYTES_PER_ELEMENT);
  var intPtr = m._malloc(polys.length * Int32Array.BYTES_PER_ELEMENT);
  if (!floatPtr || !intPtr) throw new Error("memoria wasm insuficiente");
  var f64 = new Float64Array(m.HEAPF64.buffer, floatPtr, total);
  var offset = 0;
  for (var i = 0; i < polys.length; i++) {
    f64.set(polys[i], offset);
    offset += polys[i].length;
  }
  m.HEAP32.set(sizes, intPtr >> 2);
  var rc;
  try {
    rc = m._sparrow_run(floatPtr, intPtr, polys.length, tW, seed, segExplorar, segComprimir);
  } finally {
    m._free(floatPtr);
    m._free(intPtr);
  }
  return rc;
}

// Lee todos los poligonos colocados desde el buffer HEAPF64 del modulo.
function readResult() {
  var m = sparrowModule;
  var n = m._sparrow_count();
  var ptr = m._sparrow_buffer();
  if (!ptr || n <= 0) return { count: 0, pieces: [] };
  var base = ptr / Float64Array.BYTES_PER_ELEMENT;
  var pieces = [];
  for (var i = 0; i < n; i++) {
    var start = m._sparrow_polyStart(i);
    var v = m._sparrow_verts(i);
    var pts = [];
    for (var k = 0; k < v; k++) {
      pts.push(m.HEAPF64[base + (start + k) * 2], m.HEAPF64[base + (start + k) * 2 + 1]);
    }
    pieces.push(pts);
  }
  return { count: n, pieces: pieces };
}

function finish(obj) {
  var m = sparrowModule;
  try { obj.largo = m._sparrow_largo(); } catch (e) {}
  try { obj.perdida = m._sparrow_perdida(); } catch (e) {}
  try { obj.factible = m._sparrow_factible() === 1; } catch (e) {}
  var errPtr = null;
  try { errPtr = m._sparrow_error(); } catch (e) {}
  obj.error = errPtr ? m.UTF8ToString(errPtr) : "";
  var res = readResult();
  obj.count = res.count;
  obj.pieces = res.pieces;
  self.postMessage(obj);
}

self.onmessage = function (ev) {
  var msg = ev.data;
  if (!msg || msg.type !== "solve") return;

  init().then(function () {
    var m = sparrowModule;
    var tW = msg.telaW || 160;
    var seed = msg.seed || 1;
    var tExplorar = msg.tExplorar || 30;
    var tComprimir = msg.tComprimir || 15;
    var t0 = performance.now();
    var rc;

    if (msg.jsonText) {
      var polys = parsePiecesJson(msg.jsonText);
      self.postMessage({ type: "phase", phase: "solving", pieces: polys.length });
      var t1 = performance.now();
      rc = callRun(polys, tW, seed, tExplorar, tComprimir);
      finish({ type: "result", ok: rc === 0, rc: rc, telaW: tW,
               elapsedMs: performance.now() - t0, source: "file" });
    } else {
      self.postMessage({ type: "phase", phase: "solving", pieces: 0 });
      rc = m._sparrow_run_json(tW, seed, tExplorar, tComprimir);
      finish({ type: "result", ok: rc === 0, rc: rc, telaW: tW,
               elapsedMs: performance.now() - t0, source: "embedded" });
    }
  }).catch(function (e) {
    self.postMessage({ type: "result", ok: false, error: String(e && e.stack || e), source: "file" });
  });
};

// ===================== Parseo de JSON de figuras (port de json_io.hpp) =====================
// Espera el mismo esquema que la pieza embebida:
// { "pxPerCm": num, "figures":[ { "closed":bool, "vertices":[{x,y}], "edges":[{start,end,curved,controlX,controlY}] } ] }
// Devuelve un array de poligonos: cada uno es [x0,y0, x1,y1, ...] en centimetros.

var PUNTOS_POR_CURVA = 16;

function quadAt(p0, cp, p1, t) {
  var ax = p0[0] + (cp[0] - p0[0]) * t;
  var ay = p0[1] + (cp[1] - p0[1]) * t;
  var bx = cp[0] + (p1[0] - cp[0]) * t;
  var by = cp[1] + (p1[1] - cp[1]) * t;
  return [ax + (bx - ax) * t, ay + (by - ay) * t];
}

function parsePiecesJson(text) {
  var data;
  try { data = JSON.parse(text); } catch (e) { throw new Error("El archivo no es JSON válido: " + e.message); }
  var pxPerCm = (typeof data.pxPerCm === "number" && data.pxPerCm > 0) ? data.pxPerCm : 37.79527559055118;
  var figures = data.figures;
  if (!Array.isArray(figures)) throw new Error("El JSON no tiene un arreglo 'figures'.");

  var polys = [];
  for (var fi = 0; fi < figures.length; fi++) {
    var fig = figures[fi];
    if (!fig) continue;
    var closed = fig.closed !== false;
    var vj = fig.vertices;
    if (!closed || !Array.isArray(vj) || vj.length < 3) continue;

    // vertices en cm
    var verts = [];
    for (var vi = 0; vi < vj.length; vi++) {
      var v = vj[vi];
      var x = (typeof v.xCm === "number") ? v.xCm : (v.x || 0) / pxPerCm;
      var y = (typeof v.yCm === "number") ? v.yCm : (v.y || 0) / pxPerCm;
      verts.push([x, y]);
    }

    // armar el contorno siguiendo la cadena de edges (igual que el motor)
    var segs = [];
    var edges = fig.edges;
    if (Array.isArray(edges) && edges.length > 0) {
      var siguienteDesde = {};
      for (var ei = 0; ei < edges.length; ei++) siguienteDesde[edges[ei].start] = edges[ei];
      var cur = edges[0].start;
      for (var ei = 0; ei < edges.length; ei++) {
        var e = siguienteDesde[cur];
        if (!e) break;
        var st = e.start;
        var en = e.end;
        if (e.curved) {
          var cx = (typeof e.controlX === "number") ? e.controlX / pxPerCm : 0;
          var cy = (typeof e.controlY === "number") ? e.controlY / pxPerCm : 0;
          segs.push({ curved: true, p0: verts[st], cp: [cx, cy], p1: verts[en] });
        } else {
          segs.push({ curved: false, p0: verts[st], p1: verts[en] });
        }
        cur = en;
      }
    } else {
      // sin edges: los vertices ya estan en orden de contorno
      for (var i = 0; i < verts.length; i++) {
        var j = (i + 1) % verts.length;
        segs.push({ curved: false, p0: verts[i], p1: verts[j] });
      }
    }

    // construir el poligono (curvas -> polilinea de PUNTOS_POR_CURVA)
    var poly = [];
    for (var si = 0; si < segs.length; si++) {
      var sg = segs[si];
      if (!sg.curved) {
        poly.push(sg.p0[0], sg.p0[1]);
      } else {
        for (var k = 0; k < PUNTOS_POR_CURVA; k++) {
          var t = k / PUNTOS_POR_CURVA;
          var p = quadAt(sg.p0, sg.cp, sg.p1, t);
          poly.push(p[0], p[1]);
        }
      }
    }
    if (poly.length < 6) continue; // <3 vertices
    polys.push(poly);
  }

  if (polys.length === 0) throw new Error("El JSON no tiene figuras válidas (necesita al menos 3 vértices y 'closed':true).");
  return polys;
}
