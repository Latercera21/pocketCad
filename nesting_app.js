/* Sparrow Nesting (motor Sparrow real) -- UI + conversion + worker.
 * Formato de entrada: patron.json de PocketCad o instancia JSON de Sparrow.
 * El calculo corre en nesting_worker.js  con el wasm de sparrow-studio.
 */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };

  var PX_PER_CM_DEFAULT = 96 / 2.54;

  // ------------------------------------------------------------------ estado
  var pieces = [];          // [{ id, name, points:[[x,y]], demand }]  (en cm)
  var solvePieces = [];     // sublista con demand > 0 -> indices = item_id del solver
  var currentScale = 1;     // multiplicador usado al transformar los puntos (px->cm)
  var worker = null;
  var runId = 0;
  var solving = false;
  var lastResult = null;    // { stripWidth, stripHeight, elapsedMs, placed, items, seed, preset, rot, clearance }

  // ------------------------------------------------------------------ utils
  function fmt(n) { return (Math.round(n * 100) / 100).toLocaleString("es-AR"); }
  function fmtTime(ms) {
    if (ms < 1000) return ms.toFixed(0) + " ms";
    return (ms / 1000).toFixed(1) + " s";
  }
  function status(msg, cls) {
    var el = $("status");
    el.className = cls || "";
    el.textContent = msg || "";
  }
  function polygonArea(pts) {
    var a = 0, n = pts.length;
    for (var i = 0; i < n; i++) {
      var j = (i + 1) % n;
      a += pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1];
    }
    return Math.abs(a) / 2;
  }
  function bbox(pts) {
    var minX = 1e18, minY = 1e18, maxX = -1e18, maxY = -1e18;
    for (var i = 0; i < pts.length; i++) {
      minX = Math.min(minX, pts[i][0]); maxX = Math.max(maxX, pts[i][0]);
      minY = Math.min(minY, pts[i][1]); maxY = Math.max(maxY, pts[i][1]);
    }
    return { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
  }
  function orient(ax, ay, bx, by, cx, cy) {
    var v = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (v > 1e-9) return 1; if (v < -1e-9) return -1; return 0;
  }
  function onSegment(ax, ay, bx, by, px, py) {
    return px >= Math.min(ax, bx) - 1e-7 && px <= Math.max(ax, bx) + 1e-7 &&
           py >= Math.min(ay, by) - 1e-7 && py <= Math.max(ay, by) + 1e-7;
  }
  function segsIntersect(a1, a2, b1, b2) {
    var o1 = orient(a1[0], a1[1], a2[0], a2[1], b1[0], b1[1]);
    var o2 = orient(a1[0], a1[1], a2[0], a2[1], b2[0], b2[1]);
    var o3 = orient(b1[0], b1[1], b2[0], b2[1], a1[0], a1[1]);
    var o4 = orient(b1[0], b1[1], b2[0], b2[1], a2[0], a2[1]);
    if (o1 * o2 < 0 && o3 * o4 < 0) return true;
    if (o1 === 0 && onSegment(a1[0], a1[1], a2[0], a2[1], b1[0], b1[1])) return true;
    if (o2 === 0 && onSegment(a1[0], a1[1], a2[0], a2[1], b2[0], b2[1])) return true;
    if (o3 === 0 && onSegment(b1[0], b1[1], b2[0], b2[1], a1[0], a1[1])) return true;
    if (o4 === 0 && onSegment(b1[0], b1[1], b2[0], b2[1], a2[0], a2[1])) return true;
    return false;
  }
  // limpia: quita duplicados consecutivos y el cierre repetido; valida el poligono
  function cleanPolygon(raw) {
    var pts = [];
    for (var i = 0; i < raw.length; i++) {
      var p = raw[i];
      if (!Array.isArray(p) || p.length < 2) continue;
      if (!isFinite(p[0]) || !isFinite(p[1])) continue;
      pts.push([p[0], p[1]]);
    }
    if (pts.length < 3) return { ok: false, reason: "menos de 3 vertices" };
    if (pts.length > 1) {
      var last = pts[pts.length - 1], first = pts[0];
      if (Math.abs(last[0] - first[0]) < 1e-6 && Math.abs(last[1] - first[1]) < 1e-6) pts.pop();
    }
    var out = [];
    for (var k = 0; k < pts.length; k++) {
      var prev = out[out.length - 1];
      if (prev && Math.abs(prev[0] - pts[k][0]) < 1e-6 && Math.abs(prev[1] - pts[k][1]) < 1e-6) continue;
      out.push(pts[k]);
    }
    if (out.length < 3) return { ok: false, reason: "poligono sin area" };
    // duplicados no consecutivos
    var seen = {}, dup = false;
    for (var m = 0; m < out.length; m++) {
      var key = out[m][0].toFixed(6) + "," + out[m][1].toFixed(6);
      if (seen[key]) { dup = true; break; }
      seen[key] = true;
    }
    if (dup) return { ok: false, reason: "vertices repetidos no consecutivos" };
    // auto interseccion
    for (var a = 0; a < out.length; a++) {
      for (var b = a + 1; b < out.length; b++) {
        if (b === a || (b + 1) % out.length === a || (a + 1) % out.length === b) continue;
        if (segsIntersect(out[a], out[(a + 1) % out.length], out[b], out[(b + 1) % out.length])) {
          return { ok: false, reason: "aristas que se cruzan" };
        }
      }
    }
    var area = polygonArea(out);
    if (area < 1e-6) return { ok: false, reason: "sin area real" };
    // normaliza a origen (0,0)
    var bb = bbox(out);
    out = out.map(function (p) { return [p[0] - bb.minX, p[1] - bb.minY]; });
    return { ok: true, pts: out, area: area };
  }

  // ------------------------------------------------------------------ carga
  function vertexXY(v) {
    if (Array.isArray(v) && v.length >= 2) return [Number(v[0]), Number(v[1])];
    if (v && typeof v === "object" && isFinite(v.x) && isFinite(v.y)) return [Number(v.x), Number(v.y)];
    return null;
  }

  // patron.json de PocketCad
  function parsePocketCad(data) {
    var scale = (data.pxPerCm && data.pxPerCm > 0) ? 1 / data.pxPerCm : 1 / PX_PER_CM_DEFAULT;
    var figs = Array.isArray(data.figures) ? data.figures : [];
    var out = [], warnings = [];
    var hasCurves = false;
    for (var i = 0; i < figs.length; i++) {
      var f = figs[i];
      if (!f) continue;
      if (f.closed === false) continue;
      if (!Array.isArray(f.vertices) || f.vertices.length < 3) continue;
      if (f.edges && f.edges.some(function (e) { return e && (e.curved || e.cubic); })) hasCurves = true;
      var raw = [];
      for (var v = 0; v < f.vertices.length; v++) {
        var xy = vertexXY(f.vertices[v]);
        if (xy) raw.push([xy[0] * scale, xy[1] * scale]);
      }
      var c = cleanPolygon(raw);
      if (!c.ok) { warnings.push("Pieza " + (i + 1) + " omitida: " + c.reason); continue; }
      out.push({ name: (typeof f.name === "string" && f.name) || "Pieza " + out.length, points: c.pts, demand: 1 });
    }
    if (hasCurves) warnings.push("Algunas piezas tienen aristas curvas: se aproximan por sus vertices.");
    return { pieces: out, warnings: warnings, scale: scale };
  }

  // instancia JSON de Sparrow (ExtSPInstance)
  function parseSparrow(data) {
    var items = Array.isArray(data.items) ? data.items : [];
    var out = [], warnings = [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (!it) continue;
      var shape = it.shape || {};
      var raw = null;
      if (shape.type === "simple_polygon") raw = shape.data;
      else if (shape.type === "polygon") raw = shape.data && shape.data.outer;
      else if (shape.type === "rectangle") {
        var d = shape.data || {};
        var x = Number(d.x_min), y = Number(d.y_min), w = Number(d.width), h = Number(d.height);
        if (isFinite(x) && isFinite(y) && w > 0 && h > 0) {
          raw = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
        }
      }
      if (!raw) { warnings.push("Item " + i + " omitido: tipo de forma no soportado."); continue; }
      var pts = raw.map(function (p) { return [Number(p[0]), Number(p[1])]; });
      var c = cleanPolygon(pts);
      if (!c.ok) { warnings.push("Item " + (i + 1) + " omitido: " + c.reason); continue; }
      var demand = Number(it.demand);
      out.push({ name: "Pieza " + (i + 1), points: c.pts, demand: (isFinite(demand) && demand > 0) ? demand : 1 });
      if (shape.type === "polygon" && shape.data && Array.isArray(shape.data.inner)) {
        warnings.push("Item " + (i + 1) + ": los agujeros se conservan, pero no se usan en el anidado.");
      }
    }
    return { pieces: out, warnings: warnings, stripHeight: Number(data.strip_height) || 0 };
  }

  function loadText(text, name) {
    var data;
    try { data = JSON.parse(text); } catch (e) {
      status("El archivo no es un JSON valido: " + e.message, "bad");
      return;
    }
    var res;
    if (data.figures && Array.isArray(data.figures)) {
      res = parsePocketCad(data);
      currentScale = res.scale;
    } else if (data.items && Array.isArray(data.items) && isFinite(data.strip_height)) {
      res = parseSparrow(data);
      currentScale = 1;
      if (res.stripHeight > 0) $("telaW").value = Math.round(res.stripHeight * 10) / 10;
    } else {
      status("Formato no reconocido. Se espera un patron.json de PocketCad o una instancia de Sparrow.", "bad");
      return;
    }
    if (!res.pieces.length) {
      status("No se encontraron figuras validas (cerradas, >=3 vertices, sin auto corte).", "bad");
      return;
    }
    pieces = res.pieces;
    renderTable();
    $("curveWarn").style.display = res.warnings.some(function (w) { return /curvas/i.test(w); }) ? "block" : "none";
    $("piezasInfo").innerHTML = "<b>" + sanitize(name) + "</b> &middot; " + pieces.length + " piezas validas.";
    var saved = { pieces: pieces, scale: currentScale };
    try { localStorage.setItem("nesting_patron", JSON.stringify(saved)); } catch (e) {}
    if (res.warnings.length) {
      status(res.warnings.slice(0, 2).join(" "), "working");
    } else {
      status("Piezas listas. Presiona Resolver.", "ok");
    }
  }

  function sanitize(n) { try { return String(n); } catch (e) { return "archivo"; } }

  function renderTable() {
    var tbody = document.querySelector("#piezasTable tbody");
    tbody.innerHTML = "";
    pieces.forEach(function (p, idx) {
      var tr = document.createElement("tr");
      var td1 = document.createElement("td");
      var bb = bbox(p.points);
      td1.textContent = p.name + "  (" + fmt(bb.maxX - bb.minX) + "×" + fmt(bb.maxY - bb.minY) + " cm)";
      var td2 = document.createElement("td");
      var inp = document.createElement("input");
      inp.type = "number"; inp.min = 1; inp.max = 500; inp.value = p.demand;
      inp.addEventListener("input", function () { p.demand = clampDemand(inp.value); });
      td2.appendChild(inp);
      tr.appendChild(td1); tr.appendChild(td2);
      tbody.appendChild(tr);
    });
    $("tablaWrap").classList.remove("hidden");
  }
  function clampDemand(v) {
    var n = parseInt(v, 10);
    if (isNaN(n) || n < 1) return 1;
    return Math.min(n, 500);
  }
  // ------------------------------------------------------------------ solver
  function rotationValues() {
    var v = document.querySelector('input[name="rot"]:checked');
    var sel = v ? v.value : "180";
    if (sel === "0") return [0];
    if (sel === "180") return [0, 180];
    if (sel === "90") return [0, 90, 180, 270];
    return null; // libre
  }

  function buildInput() {
    solvePieces = [];
    var items = [];
    for (var i = 0; i < pieces.length; i++) {
      if (pieces[i].demand < 1) continue;
      var id = solvePieces.length;
      solvePieces.push(pieces[i]);
      var item = { id: id, demand: pieces[i].demand, shape: { type: "simple_polygon", data: pieces[i].points } };
      var rots = rotationValues();
      if (rots) item.allowed_orientations = rots;
      items.push(item);
    }
    if (!items.length) { status("Suma al menos 1 copia de alguna pieza.", "bad"); return null; }
    var telaW = parseFloat($("telaW").value);
    if (!(telaW > 0)) { status("El ancho de tela debe ser mayor a 0.", "bad"); return null; }
    return { input: JSON.stringify({ name: "pocketcad", strip_height: telaW, items: items }), telaW: telaW };
  }

  function solve() {
    if (solving) return;
    var built = buildInput();
    if (!built) return;
    var clearance = parseFloat($("clearanceW").value) || 0;
    if (clearance >= built.telaW) { status("La separación debe ser menor que el ancho de tela.", "bad"); return; }
    var seed = parseInt($("seed").value, 10) || 1;
    var preset = document.querySelector('input[name="preset"]:checked') ? document.querySelector('input[name="preset"]:checked').value : "standard";
    var timeSel = $("timeSel").value;
    var seconds = timeSel === "" ? undefined : parseInt(timeSel, 10);

    var total = solvePieces.reduce(function (a, p) { return a + p.demand; }, 0);
    solving = true;
    runId++;
    var id = runId;
    $("run").classList.add("hidden");
    $("stop").classList.remove("hidden");
    status("Calculando… " + total + " piezas · tela " + fmt(built.telaW) + " cm", "working");

    if (worker) { worker.terminate(); worker = null; }
    try {
      worker = new Worker("nesting_worker.js", { type: "module" });
    } catch (e) {
      status("Este navegador no soporta web workers de modulo (modernizalo).", "bad");
      worker = null; solving = false; finishUI();
      return;
    }
    worker.onmessage = function (ev) {
      var d = ev.data;
      if (!d || d.runId !== id) return;
      onSolverMessage(d.message, built.telaW, seed);
    };
    worker.onerror = function (ev) {
      if (!worker) return;
      stopRunning(false);
      status("Error del worker: " + (ev && ev.message || "desconocido"), "bad");
    };
    worker.postMessage({ type: "solve", input: built.input, seconds: seconds, seed: String(seed), clearance: clearance, preset: preset, runId: id });
  }

  function onSolverMessage(m, telaW, seed) {
    if (!m) return;
    if (m.type === "phase") {
      setFase(m.phase === "Exploration" ? "Exploración" : "Compresión");
      return;
    }
    if (m.type === "candidate" || m.type === "live") {
      if (m.type === "candidate") {
        registerCandidate(m, telaW, seed);
      }
      return;
    }
    if (m.type === "error") {
      stopRunning(false);
      status("El motor devolvió un error: " + m.message, "bad");
      return;
    }
    if (m.type === "finished") {
      stopRunning(true);
      if (lastResult) status("Terminado. Largo usado: " + fmt(lastResult.stripWidth) + " cm en " + fmtTime(lastResult.elapsedMs), "ok");
      else status("Terminado sin resultados validos. Probá más tiempo u otra semilla.", "bad");
    }
  }

  function registerCandidate(m, telaW, seed) {
    var sol = m.solution || {};
    var layout = sol.layout || {};
    var placed = layout.placed_items || [];
    var res = {
      stripWidth: sol.strip_width, stripHeight: telaW, elapsedMs: m.elapsedMs || 0,
      placed: placed, total: placed.length, seed: seed, phase: "candidate"
    };
    lastResult = res;
    $("stats").classList.remove("hidden");
    try {
      $("stLargo").textContent = fmt(res.stripWidth);
      $("stAncho").textContent = fmt(telaW);
      $("stPiezas").textContent = res.total;
      $("stTime").textContent = fmtTime(res.elapsedMs);
      var area = solvePieces.reduce(function (a, p, i) { return a + polyAreaId(i) * p.demand; }, 0);
      var occ = area / (res.stripWidth * telaW);
      $("stOcup").textContent = (occ * 100).toFixed(1) + " %";
      setFase("…");
    } catch (e) {}
    drawResult(res);
  }
  function polyAreaId(i) { var a = 0, pts = solvePieces[i].points, n = pts.length; for (var j = 0; j < n; j++) { var k = (j + 1) % n; a += pts[j][0] * pts[k][1] - pts[k][0] * pts[j][1]; } return Math.abs(a) / 2; }
  function stopRunning(keepResult) {
    solving = false;
    if (worker) { worker.terminate(); worker = null; }
    $("run").classList.remove("hidden");
    $("stop").classList.add("hidden");
    if (!keepResult && lastResult) { /* conservar el dibujo del mejor candidato */ }
  }
  function finishUI() {
    $("run").classList.remove("hidden");
    $("stop").classList.add("hidden");
  }
  function setFase(txt) { $("stFase").textContent = txt; }

  // transform: rotacion (grados) + traslacion sobre el poligono original
  function placedPoly(p) {
    var rot = p.transformation.rotation || 0;
    var th = rot * Math.PI / 180, c = Math.cos(th), s = Math.sin(th);
    var tx = p.transformation.translation[0], ty = p.transformation.translation[1];
    return solvePieces[p.item_id].points.map(function (pt) {
      return [pt[0] * c - pt[1] * s + tx, pt[0] * s + pt[1] * c + ty];
    });
  }

  // ------------------------------------------------------------------ dibujo
  var PALETA = ["#e57373", "#64b5f6", "#81c784", "#ffb74d", "#ba68c8", "#4db6ac", "#f06292", "#a1887f", "#f6c445", "#90a4ae"];

  function displayPts(pts, stripHeight) {
    // solver: x = largo, y = ancho -> pantalla: ancho horizontal, largo vertical
    return pts.map(function (q) { return [-q[1] + stripHeight, q[0]]; });
  }
  function centroid(pts) {
    var n = pts.length, area = 0, cx = 0, cy = 0;
    for (var i = 0; i < n; i++) {
      var j = (i + 1) % n;
      var cr = pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1];
      area += cr; cx += (pts[i][0] + pts[j][0]) * cr; cy += (pts[i][1] + pts[j][1]) * cr;
    }
    if (Math.abs(area) > 1e-9) return [cx / (3 * area), cy / (3 * area)];
    var bb = bbox(pts); return [(bb.minX + bb.maxX) / 2, (bb.minY + bb.maxY) / 2];
  }

  function drawResult(res) {
    var cv = $("canvas");
    var W = res.stripHeight, L = res.stripWidth;
    var parentW = cv.parentElement.clientWidth - 2 || 320;
    var dpr = window.devicePixelRatio || 1;
    var scale = Math.min(parentW / W, 760 / L);
    var cssW = Math.max(1, Math.round(W * scale));
    var cssH = Math.max(1, Math.round(L * scale));
    cv.style.width = cssW + "px";
    cv.style.height = cssH + "px";
    cv.width = Math.round(cssW * dpr);
    cv.height = Math.round(cssH * dpr);
    var ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#0a0e15"; ctx.fillRect(0, 0, cssW, cssH);
    ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, cssW - 1, cssH - 1);
    ctx.font = "11px sans-serif"; ctx.fillStyle = "#7aa0c8"; ctx.textAlign = "left";
    ctx.fillText("Ancho tela " + fmt(W) + " cm · Largo " + fmt(L) + " cm", 6, 14);
    var placed = res.placed || [];
    for (var i = 0; i < placed.length; i++) {
      var p = placed[i];
      var dp = displayPts(placedPoly(p), W);
      ctx.beginPath();
      ctx.moveTo(dp[0][0] * scale, dp[0][1] * scale);
      for (var j = 1; j < dp.length; j++) ctx.lineTo(dp[j][0] * scale, dp[j][1] * scale);
      ctx.closePath();
      ctx.fillStyle = PALETA[p.item_id % PALETA.length] + "cc";
      ctx.fill();
      ctx.strokeStyle = "#1c1c1c"; ctx.lineWidth = 1; ctx.stroke();
      var c = centroid(dp);
      ctx.fillStyle = "#fff"; ctx.font = "bold 10px sans-serif"; ctx.textAlign = "center";
      ctx.fillText(String(p.item_id), c[0] * scale, c[1] * scale + 4);
    }
  }

  // ------------------------------------------------------------------ export
  function buildSvg(res) {
    var W = res.stripHeight, L = res.stripWidth;
    var s = '<?xml version="1.0" encoding="UTF-8"?>\n';
    s += '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + L + '" width="' + (W * 4) + '" height="' + (L * 4) + '">\n';
    s += '<text x="1" y="1" font-size="3" font-family="Arial" fill="#666">Sparrow Nesting · tela ' + W + ' cm · largo ' + L.toFixed(2) + ' cm · semilla ' + lastResult.seed + '</text>\n';
    s += '<rect x="0.1" y="0.1" width="' + (W - 0.2) + '" height="' + (L - 0.2) + '" fill="none" stroke="#000" stroke-width="0.2"/>\n';
    var placed = res.placed || [];
    for (var i = 0; i < placed.length; i++) {
      var dp = displayPts(placedPoly(placed[i]), W);
      var poly = "";
      for (var j = 0; j < dp.length; j++) {
        poly += (+dp[j][0].toFixed(4)) + ',' + (+dp[j][1].toFixed(4));
        if (j + 1 < dp.length) poly += ' ';
      }
      s += '<polygon points="' + poly + '" fill="' + PALETA[placed[i].item_id % PALETA.length] + '" fill-opacity="0.65" stroke="#000" stroke-width="0.15"/>\n';
      var c = centroid(dp);
      s += '<text x="' + c[0].toFixed(2) + '" y="' + c[1].toFixed(2) + '" font-size="2.2" font-family="Arial" fill="#000" text-anchor="middle">' + placed[i].item_id + '</text>\n';
    }
    s += '</svg>\n';
    return s;
  }
  function buildDxf(res) {
    var L = [];
    L.push("0", "SECTION", "2", "HEADER", "9", "$ACADVER", "1", "AC1015", "9", "$INSUNITS", "70", "5", "0", "ENDSEC");
    L.push("0", "SECTION", "2", "TABLES", "0", "TABLE", "2", "LAYER", "70", "2", "0", "LAYER", "2", "PARTS", "70", "0", "62", "7", "6", "CONTINUOUS", "0", "ENDTAB", "0", "ENDSEC");
    L.push("0", "SECTION", "2", "ENTITIES");
    var placed = res.placed || [];
    for (var i = 0; i < placed.length; i++) {
      var dp = displayPts(placedPoly(placed[i]), res.stripHeight);
      L.push("0", "LWPOLYLINE", "8", "PARTS", "90", String(dp.length), "70", "1");
      for (var j = 0; j < dp.length; j++) {
        L.push("10", num(dp[j][0]), "20", num(dp[j][1]));
      }
    }
    L.push("0", "ENDSEC", "0", "EOF");
    return L.join("\r\n") + "\r\n";
  }
  function num(n) {
    var s = (Math.round(n * 1e4) / 1e4).toString();
    return s;
  }
  function buildJson(res) {
    return JSON.stringify({
      motor: "sparrow (sparrow-studio)",
      anchoTelaCm: res.stripHeight, largoCm: res.stripWidth, piezas: res.total,
      ocupacionPct: (res.stripWidth && solvePieces.length) ? (Math.round(solvePiecesArea() / ((res.stripWidth) * res.stripHeight) * 1000) / 10) : null,
      tiempoMs: res.elapsedMs, semilla: res.seed,
      placements: res.placed.map(function (p) {
        return { item_id: p.item_id, rotationDeg: p.transformation.rotation, translation: p.transformation.translation, polygon: placedPoly(p) };
      })
    }, null, 2);
  }
  function solvePiecesArea() {
    var a = 0;
    for (var i = 0; i < solvePieces.length; i++) a += polyAreaId(i) * solvePieces[i].demand;
    return a;
  }

  function download(name, content, mime) {
    var blob = new Blob([content], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 3000);
  }
  function baseName() {
    var b = "tizada";
    if (lastResult) b += "_s" + lastResult.seed + "_" + lastResult.stripWidth.toFixed(2) + "cm";
    var d = new Date();
    b += "_" + d.getFullYear() + (d.getMonth() + 1) + d.getDate() + "_" +
         ("0" + d.getHours()).slice(-2) + ("0" + d.getMinutes()).slice(-2);
    return b;
  }

  // ------------------------------------------------------------------ UI
  // chips
  function bindChips(container) {
    container.addEventListener("click", function (e) {
      var lb = e.target.closest("label");
      if (!lb || !container.contains(lb)) return;
      var inp = lb.querySelector("input");
      if (inp) inp.checked = true;
      Array.prototype.forEach.call(container.querySelectorAll("label"), function (x) { x.classList.remove("sel"); });
      lb.classList.add("sel");
    });
  }

  // ejemplo integrado (mismas piezas que patron-ejemplo.json, en cm)
  var SAMPLE_PIECES = [
    { name: "Delantero", demand: 2, pts: [[0, 0], [30, 0], [34, 42], [20, 50], [6, 46], [0, 40]] },
    { name: "Espalda", demand: 2, pts: [[0, 0], [34, 0], [38, 44], [4, 44]] },
    { name: "Manga", demand: 4, pts: [[0, 0], [26, 0], [30, 28], [14, 40], [2, 30]] },
    { name: "Cuello", demand: 2, pts: [[0, 0], [8, 0], [8, 6], [0, 6]] },
    { name: "Puño", demand: 2, pts: [[0, 0], [10, 0], [10, 4], [0, 4]] }
  ];
  function loadExample() {
    pieces = SAMPLE_PIECES.map(function (p) { return { name: p.name, points: cleanPolygon(p.pts).pts, demand: p.demand }; });
    currentScale = 1;
    renderTable();
    $("curveWarn").style.display = "none";
    $("piezasInfo").innerHTML = "<b>Ejemplo</b> &middot; 5 piezas de muestra.";
    status("Ejemplo cargado. Presiona Resolver.", "ok");
    try { localStorage.setItem("nesting_patron", JSON.stringify({ pieces: pieces, scale: 1 })); } catch (e) {}
  }

  function restoreSession() {
    var raw = null;
    try { raw = localStorage.getItem("nesting_patron"); } catch (e) {}
    if (raw) {
      try {
        var data = JSON.parse(raw);
        if (data.pieces && data.pieces.length && data.pieces[0].points) {
          pieces = data.pieces;
          currentScale = data.scale || 1;
          renderTable();
          $("piezasInfo").innerHTML = "<b>Piezas guardadas</b> restauradas.";
          status("Piezas restauradas. Presiona Resolver.", "ok");
          return;
        }
      } catch (e) {}
    }
    // migracion de la version vieja (guardaba el patron.json crudo)
    var old = null;
    try { old = localStorage.getItem("sparrow_json"); } catch (e) {}
    if (old && old.length > 50) {
      loadText(old, "piezas guardadas (version anterior)");
      return;
    }
    loadExample();
  }

  // ------------------------------------------------------------------ init
  function init() {
    bindChips($("rotSel"));
    bindChips($("presetSel"));

    $("btnSample").onclick = loadExample;
    $("btnFile").onclick = function () { $("file").click(); };
    $("file").onchange = function () {
      var f = this.files && this.files[0];
      if (!f) return;
      var r = new FileReader();
      r.onload = function () { loadText(String(r.result), f.name); };
      r.readAsText(f);
      this.value = "";
    };
    var fbox = $("filebox");
    fbox.onclick = function () { $("file").click(); };
    fbox.addEventListener("dragover", function (e) { e.preventDefault(); fbox.classList.add("on"); });
    fbox.addEventListener("dragleave", function () { fbox.classList.remove("on"); });
    fbox.addEventListener("drop", function (e) {
      e.preventDefault(); fbox.classList.remove("on");
      var f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (!f) return;
      var r = new FileReader();
      r.onload = function () { loadText(String(r.result), f.name); };
      r.readAsText(f);
    });

    $("run").onclick = solve;
    $("stop").onclick = function () {
      stopRunning(false);
      status("Detenido por el usuario.", "working");
    };
    $("btnSvg").onclick = function () {
      if (!lastResult) { status("Primero resolvé.", "bad"); return; }
      download(baseName() + ".svg", buildSvg(lastResult), "image/svg+xml");
    };
    $("btnDxf").onclick = function () {
      if (!lastResult) { status("Primero resolvé.", "bad"); return; }
      download(baseName() + ".dxf", buildDxf(lastResult), "application/dxf");
    };
    $("btnJson").onclick = function () {
      if (!lastResult) { status("Primero resolvé.", "bad"); return; }
      download(baseName() + ".json", buildJson(lastResult), "application/json");
    };

    var rs = null;
    window.addEventListener("resize", function () {
      if (lastResult) {
        clearTimeout(rs);
        rs = setTimeout(function () { drawResult(lastResult); }, 120);
      }
    });

    restoreSession();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();