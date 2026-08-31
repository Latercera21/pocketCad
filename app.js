/* Sparrow Nesting app -- UI + comunicacion con el worker WASM */
(function () {
  "use strict";

  var acceptedFigures = [];   // indices de figuras validas (mismo filtro que el motor)
  var currentText = null;     // texto JSON actual
  var currentName = "piezas";
  var worker = null;
  var lastResult = null;
  var solving = false;

  // ---------- utilidades ----------
  function $(id) { return document.getElementById(id); }
  function countFigures(text) {
    var data = JSON.parse(text);
    var figs = Array.isArray(data.figures) ? data.figures : [];
    var out = [];
    for (var i = 0; i < figs.length; i++) {
      var f = figs[i];
      if (!f) continue;
      if (f.closed === false) continue;
      if (!Array.isArray(f.vertices) || f.vertices.length < 3) continue;
      out.push(i);
    }
    return out;
  }
  function status(msg, cls) {
    var el = $("status");
    el.classList.remove("hide");
    el.className = cls || "";
    el.textContent = msg || "";
    if (cls) el.classList.add(cls);
  }
  function fmtTime(ms) {
    if (ms < 1000) return ms.toFixed(0) + " ms";
    return (ms / 1000).toFixed(1) + " s";
  }

  // ---------- carga de piezas ----------
  function setPieceList(text, name) {
    currentText = text;
    currentName = name;
    var figs;
    try { figs = countFigures(text); }
    catch (e) {
      status("El archivo no es un JSON vÃ¡lido: " + e.message, "bad");
      return;
    }
    if (figs.length === 0) {
      status("El JSON no tiene figuras cerradas con â‰¥3 vÃ©rtices.", "bad");
      return;
    }
    acceptedFigures = figs;
    var tbody = document.querySelector("#piezasTable tbody");
    tbody.innerHTML = "";
    figs.forEach(function (idx, n) {
      var tr = document.createElement("tr");
      var td1 = document.createElement("td");
      td1.textContent = "Figura " + (idx + 1) + " (" + (n + 1) + "Âª lista)";
      var td2 = document.createElement("td");
      var inp = document.createElement("input");
      inp.type = "number"; inp.min = 1; inp.max = 20; inp.value = 1;
      inp.dataset.fig = idx;
      td2.appendChild(inp);
      tr.appendChild(td1); tr.appendChild(td2);
      tbody.appendChild(tr);
    });
    $("tablaWrap").classList.remove("hide");
    $("piezasInfo").textContent = name + " Â· " + figs.length + " figuras vÃ¡lidas listas.";

    // persistir para reabrir sin tener que re-cargar
    try { localStorage.setItem("sparrow_json", text); } catch (e) {}
    status("Piezas listas. PresionÃ¡ Resolver.", "ok");
  }

  function loadFromText(text, name) {
    setPieceList(text, name);
  }

  // ---------- resolver ----------
  function solve() {
    if (solving) return;
    if (!currentText) { status("CargÃ¡ primero las piezas.", "bad"); return; }

    var telaW = parseFloat($("telaW").value) || 160;
    var seed = parseInt($("seed").value, 10) || 1;
    var tx = parseFloat($("tx").value) || 30;
    var tc = parseFloat($("tc").value) || 15;
    var rot = document.querySelector('input[name="rot"]:checked').value;
    var rotMode = rot === "0" ? 0 : 1;

    var counts = acceptedFigures.map(function (idx) {
      var inp = document.querySelector('input[data-fig="' + idx + '"]');
      var v = inp ? parseInt(inp.value, 10) : 1;
      return (isNaN(v) || v < 1) ? 1 : Math.min(v, 20);
    });

    var totalPiezas = counts.reduce(function (a, b) { return a + b; }, 0);
    workingBase = "Calculandoâ€¦ (" + totalPiezas + " piezas) Â· tela " + telaW +
           " cm Â· semilla " + seed + " Â· " + (rotMode === 1 ? "0Â°/180Â°" : "0Â° fija");
    status(workingBase, "working");
    solving = true;
    $("run").disabled = true;
    $("status").classList.add("working");

    startWorking(currentText, counts, telaW, rotMode, tx + tc);
    setTimeout(function () {
      var cv = $("canvas");
      if (cv && cv.scrollIntoView) cv.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 80);

    if (!worker) worker = new Worker("worker.js");
    worker.onmessage = onResult;
    worker.postMessage({
      type: "solve",
      jsonText: currentText,
      telaW: telaW, seed: seed, tExpl: tx, tComp: tc,
      rotMode: rotMode, counts: counts
    });
  }

  function onResult(ev) {
    var r = ev.data;
    stopWorking();
    solving = false;
    $("run").disabled = false;
    if (!r.ok) { status("Error: " + (r.error || "desconocido"), "bad"); return; }
    if (!r.factible || !r.contencion) {
      status("Resultado INFACTIBLE (piezas colisionando). ProbÃ¡ mÃ¡s tiempo u otra semilla.", "bad");
    } else {
      status("Factible Â· contencion OK Â· altura " + r.largo.toFixed(2) + " cm en " + fmtTime(r.elapsedMs), "ok");
    }
    lastResult = r;
    $("stats").classList.remove("hide");
    $("stAltura").textContent = r.largo.toFixed(2);
    $("stFact").textContent = (r.factible && r.contencion) ? "SÃ" : "NO";
    $("stPerd").textContent = r.perdida.toFixed(2) + " %";
    $("stTime").textContent = fmtTime(r.elapsedMs);
    $("stPiezas").textContent = r.count;
    drawResult(r);
  }

  // ---------- dibujo SVG/canvas ----------
  var PALETA = ["#e57373","#64b5f6","#81c784","#ffb74d","#ba68c8","#4db6ac","#f06292","#a1887f"];

  // centroide (area) de un poligono plano [x,y,...]; si cae afuera, se usa el
  // centro del bbox para que el numero no se confunda con la pieza vecina.
  function puntoEnPieza(pts, x, y) {
    var n = pts.length >> 1, dentro = false;
    for (var i = 0, j = n - 1; i < n; j = i++) {
      var xi = pts[i * 2], yi = pts[i * 2 + 1], xj = pts[j * 2], yj = pts[j * 2 + 1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) dentro = !dentro;
    }
    return dentro;
  }
  function centroide(pts) {
    var n = pts.length >> 1, area = 0, cx = 0, cy = 0;
    for (var i = 0; i < n; i++) {
      var j = (i + 1) % n;
      var xi = pts[i * 2], yi = pts[i * 2 + 1], xj = pts[j * 2], yj = pts[j * 2 + 1];
      var cr = xi * yj - xj * yi;
      area += cr; cx += (xi + xj) * cr; cy += (yi + yj) * cr;
    }
    if (Math.abs(area) > 1e-9) {
      var x = cx / (3 * area), y = cy / (3 * area);
      if (puntoEnPieza(pts, x, y)) return [x, y];
    }
    var minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    for (var k = 0; k < n; k++) {
      var X = pts[k * 2], Y = pts[k * 2 + 1];
      if (X < minX) minX = X; if (X > maxX) maxX = X;
      if (Y < minY) minY = Y; if (Y > maxY) maxY = Y;
    }
    return [(minX + maxX) / 2, (minY + maxY) / 2];
  }

  function svgDelResultado(r) {
    var franja = 4.5, W = r.telaW, H = r.largo + franja;
    var s = '<?xml version="1.0" encoding="UTF-8"?>\n';
    s += '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -' + franja + ' ' + W + ' ' + H +
         '" width="' + (W * 4) + '" height="' + (H * 4) + '">\n';
    s += '<text x="1" y="-1" font-size="3" font-family="Arial" fill="#888">Altura: ' +
         r.largo.toFixed(2) + ' cm | Ancho: ' + W + ' cm | semilla ' + r.seed +
         ' (Sparrow)</text>\n';
    s += '<rect x="0" y="0" width="' + W + '" height="' + r.largo.toFixed(4) +
         '" fill="none" stroke="black" stroke-width="0.3"/>\n';
    for (var i = 0; i < r.pieces.length; i++) {
      var p = r.pieces[i];
      s += '<polygon points="';
      for (var j = 0; j < p.length; j += 2) {
        s += (+p[j].toFixed(4)) + ',' + (+p[j + 1].toFixed(4));
        if (j + 2 < p.length) s += ' ';
      }
      s += '" fill="' + PALETA[i % 8] + '" fill-opacity="0.6" stroke="black" stroke-width="0.2"/>\n';
      var c = centroide(p);
      s += '<text x="' + c[0].toFixed(2) + '" y="' + c[1].toFixed(2) +
           '" font-size="2.5" font-family="Arial" fill="black">' + i + '</text>\n';
    }
    s += '</svg>\n';
    return s;
  }

  function drawResult(r) {
    var cv = $("canvas");
    var W = r.telaW, H = r.largo;
    var TARGET = 800;
    var scale = Math.min(TARGET / W, 600 / H);
    var cw = Math.max(1, Math.round(W * scale));
    var ch = Math.max(1, Math.round(H * scale));
    cv.width = cw; cv.height = ch + ch * 0.06;
    var ctx = cv.getContext("2d");
    ctx.fillStyle = "#0a0e15"; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, cw, ch);
    ctx.textAlign = "center";
    for (var i = 0; i < r.pieces.length; i++) {
      var p = r.pieces[i];
      ctx.beginPath();
      ctx.moveTo(p[0] * scale, p[1] * scale);
      for (var j = 2; j < p.length; j += 2) ctx.lineTo(p[j] * scale, p[j + 1] * scale);
      ctx.closePath();
      ctx.fillStyle = PALETA[i % 8] + "99";
      ctx.fill();
      ctx.strokeStyle = "#222"; ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.font = "10px sans-serif";
      var c = centroide(p);
      ctx.fillText(String(i), c[0] * scale, c[1] * scale + 4);
    }
  }

  // ---------- animacion "trabajando" (feedback mientras el worker calcula; es
  // una simulacion simple de piezas cayendo, no es el layout real) ----------
  var anim = null;
  var workingBase = "";

  function poligonosDeFiguras(texto) {
    var salida = [], d;
    try { d = JSON.parse(texto); } catch (e) { return salida; }
    var figs = Array.isArray(d.figures) ? d.figures : [];
    for (var i = 0; i < acceptedFigures.length; i++) {
      var f = figs[acceptedFigures[i]];
      var pts = [];
      if (f && Array.isArray(f.vertices)) {
        for (var k = 0; k < f.vertices.length; k++) {
          var v = f.vertices[k];
          var X, Y;
          if (Array.isArray(v) && v.length >= 2) { X = v[0]; Y = v[1]; }
          else if (v && typeof v === "object" && typeof v.x === "number" && typeof v.y === "number") { X = v.x; Y = v.y; }
          else continue;
          pts.push(X, Y);
        }
      }
      if (pts.length >= 6) salida.push(pts);
    }
    return salida;
  }

  function bboxDe(pts) {
    var minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    for (var i = 0; i < pts.length; i += 2) {
      var X = pts[i], Y = pts[i + 1];
      if (X < minX) minX = X; if (X > maxX) maxX = X;
      if (Y < minY) minY = Y; if (Y > maxY) maxY = Y;
    }
    return { minX: minX, minY: minY, maxX: maxX, maxY: maxY, w: maxX - minX, h: maxY - minY };
  }

  function trazarPoly(ctx, pts, px, py, rot, color) {
    var s = anim.scale, bb = bboxDe(pts);
    var cxm = (bb.minX + bb.maxX) / 2, cym = (bb.minY + bb.maxY) / 2;
    ctx.beginPath();
    for (var i = 0; i < pts.length; i += 2) {
      var x = pts[i], y = pts[i + 1];
      if (rot) { x = 2 * cxm - x; y = 2 * cym - y; }
      var dx = px + (x - bb.minX), dy = py + (y - bb.minY);
      if (i === 0) ctx.moveTo(dx * s, dy * s); else ctx.lineTo(dx * s, dy * s);
    }
    ctx.closePath();
    ctx.fillStyle = color + "aa"; ctx.fill();
    ctx.strokeStyle = "#000"; ctx.lineWidth = 1; ctx.stroke();
  }

  function siguientePieza() {
    if (anim.cur >= anim.cola.length) {
      anim.cur = 0; anim.colocadas = []; anim.pila = 0;
    }
    var bb = bboxDe(anim.cola[anim.cur]);
    var rot = anim.rotMode === 1 && Math.random() < 0.5;
    var x = Math.random() * Math.max(0.01, anim.telaW - bb.w);
    var to = Math.max(0, anim.H - anim.pila - bb.h);
    var from = to - anim.H - 40;
    anim.pzs = {
      pts: anim.cola[anim.cur], rot: rot, w: bb.w, h: bb.h,
      x: x, y: from, from: from, to: to, t: 0, dur: 70,
      color: PALETA[anim.cur % PALETA.length]
    };
  }

  function startWorking(jsonText, counts, telaW, rotMode, totalSec) {
    var figs = poligonosDeFiguras(jsonText);
    var cola = [];
    for (var i = 0; i < figs.length; i++) {
      var mult = (counts && counts[i]) || 1;
      for (var c = 0; c < mult; c++) cola.push(figs[i]);
    }
    if (cola.length === 0) cola = figs;
    stopWorking();
    anim = {
      t0: performance.now(), totalSec: totalSec || 1, segMostrado: -1,
      cola: cola, telaW: telaW, rotMode: rotMode,
      cur: 0, colocadas: [], pila: 0, pzs: null, raf: 0
    };
    anim.raf = requestAnimationFrame(dibujarWorking);
  }

  function stopWorking() {
    if (anim && anim.raf) { cancelAnimationFrame(anim.raf); anim.raf = 0; }
    anim = null;
  }

  function dibujarWorking() {
    if (!anim) return;
    var W = anim.telaW, H = W * 0.66;
    var scale = Math.min(800 / W, 600 / H);
    var cw = Math.max(1, Math.round(W * scale));
    var ch = Math.max(1, Math.round(H * scale));
    anim.H = H; anim.scale = scale;
    var cv = $("canvas");
    cv.width = cw; cv.height = ch + Math.round(ch * 0.06);
    var ctx = cv.getContext("2d");
    ctx.fillStyle = "#0a0e15"; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, cw, ch);

    if (!anim.pzs) siguientePieza();
    if (anim.pzs) {
      var p = anim.pzs;
      p.t += 1;
      var frac = Math.min(1, p.t / p.dur);
      p.y = p.from + (p.to - p.from) * (1 - (1 - frac) * (1 - frac));
      if (frac >= 1) {
        anim.colocadas.push({ pts: p.pts, x: p.x, y: p.to, rot: p.rot, color: p.color });
        anim.pila += p.h + 2;
        anim.cur++;
        anim.pzs = null;
        siguientePieza();
      }
    }
    var temp = anim.pzs;
    for (var i = 0; i < anim.colocadas.length; i++) {
      var c = anim.colocadas[i];
      trazarPoly(ctx, c.pts, c.x, c.y, c.rot, c.color);
    }
    if (temp) trazarPoly(ctx, temp.pts, temp.x, temp.y, temp.rot, temp.color);

    var seg = ((performance.now() - anim.t0) / 1000) | 0;
    if (seg !== anim.segMostrado) {
      anim.segMostrado = seg;
      var sEl = $("status");
      if (sEl && workingBase) sEl.textContent = workingBase + "  Â·  " + seg + " s / " + anim.totalSec + " s";
    }
    ctx.fillStyle = "#4da3ff"; ctx.font = "13px sans-serif"; ctx.textAlign = "left";
    ctx.fillText("Trabajandoâ€¦ " + seg + " s / " + anim.totalSec + " s aprox.", 8, 18);
    ctx.fillStyle = "#93a3c0"; ctx.font = "11px sans-serif";
    ctx.fillText("simulaciÃ³n â€” el layout real se dibuja al terminar", 8, 33);
    anim.raf = requestAnimationFrame(dibujarWorking);
  }

  // ---------- guardado con nombre unico ----------
  function sanitize(n) { return n.replace(/[^\w\u00C0-\uFFFF-]+/g, "_"); }
  function nombreBase() {
    var b = sanitize(currentName.replace(/\.json$/i, ""));
    if (lastResult) b += "_s" + lastResult.seed + "_" + lastResult.largo.toFixed(2) + "cm";
    var d = new Date();
    b += "_" + d.getFullYear() + (d.getMonth() + 1) + d.getDate() + "_" +
         ("0" + d.getHours()).slice(-2) + ("0" + d.getMinutes()).slice(-2);
    return b;
  }
  function download(name, content, mime) {
    var blob = new Blob([content], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 3000);
  }
  $("btnSvg").onclick = function () {
    if (!lastResult) { status("Primero resolvÃ©.", "bad"); return; }
    download(nombreBase() + ".svg", svgDelResultado(lastResult), "image/svg+xml");
  };
  $("btnJson").onclick = function () {
    if (!lastResult) { status("Primero resolvÃ©.", "bad"); return; }
    download(nombreBase() + ".json", JSON.stringify(lastResult, null, 2), "application/json");
  };

  // ---------- eventos de carga ----------
  $("btnSample").onclick = function () {
    loadFromText(SAMPLE_JSON, "DAMA-TM-SMPR-W-CRRE.json");
  };
  $("btnFile").onclick = function () { $("file").click(); };
  $("file").onchange = function () {
    var f = this.files && this.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function () { loadFromText(String(r.result), f.name); };
    r.readAsText(f);
    this.value = "";
  };

  var fbox = $("filebox");
  fbox.addEventListener("dragover", function (e) { e.preventDefault(); fbox.classList.add("on"); });
  fbox.addEventListener("dragleave", function () { fbox.classList.remove("on"); });
  fbox.addEventListener("drop", function (e) {
    e.preventDefault(); fbox.classList.remove("on");
    var f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function () { loadFromText(String(r.result), f.name); };
    r.readAsText(f);
  });

  $("multAll").addEventListener("input", function () {
    var v = parseInt(this.value, 10);
    if (isNaN(v) || v < 1) return;
    var inp = document.querySelectorAll("#piezasTable input");
    for (var i = 0; i < inp.length; i++) inp[i].value = Math.min(v, 20);
  });

  // selector rotacion: resaltar la elegida
  document.querySelectorAll("#rotSel label").forEach(function (lb) {
    lb.addEventListener("click", function () {
      document.querySelectorAll("#rotSel label").forEach(function (x) { x.classList.remove("sel"); });
      lb.classList.add("sel");
    });
  });

  $("run").onclick = solve;

  // ---------- arranque ----------
  function arranque() {
    var saved = null;
    try { saved = localStorage.getItem("sparrow_json"); } catch (e) {}
    if (saved && saved.length > 50) {
      loadFromText(saved, "piezas guardadas");
      status("Piezas guardadas restauradas. PresionÃ¡ Resolver.", "ok");
    } else {
      loadFromText(SAMPLE_JSON, "DAMA-TM-SMPR-W-CRRE.json");
    }
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arranque);
  else arranque();
})();