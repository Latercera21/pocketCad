/* Sparrow Nesting — réplica fiel de sparrowstudio.app para PocketCad.
 * Motor real de Sparrow (wasm de sparrow-studio) vía nesting_worker.js.
 * Formatos de entrada:
 *   .json  — patron.json de PocketCad (curvas Q/C muestreadas, flip de eje Y) o
 *            instancia JSON de Sparrow (ExtSPInstance)
 *   .dxf   — queda como en sparrowstudio.app (usvis importador de sparrow)
 *   .svg   — SVG con superficies cerradas (se resuelve con svg_paths del wasm,
 *            el MISMO motor que usa la demo web)
 * Todo en cm, mobile-first. */
(function () {
  "use strict";

  /* ================================================================== CLI
   * Utilidades del port de sparrow-studio (web/src/geometry). Cambié el
   * orient2d de robust-predicates por una versión con tolerancia suficiente
   * para los límites del motor (100 000 mm): el wasm ya es el mismo. */

  var EPS = 1e-9;
  function orient(ax, ay, bx, by, cx, cy) {
    var v = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (v > EPS) return 1; if (v < -EPS) return -1; return 0;
  }
  var pseg = function (p, a, b) { // pointSegmentDistance
    var dx = b[0] - a[0], dy = b[1] - a[1], d = dx * dx + dy * dy;
    var t = d === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / d));
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  };
  var area = function (ring) {
    var sum = 0, i, q;
    for (var i = 0; i < ring.length; i++) { q = ring[(i + 1) % ring.length]; sum += ring[i][0] * q[1] - q[0] * ring[i][1]; }
    return sum / 2;
  };
  var bounds = function (ring) {
    return ring.reduce(function (b, p) {
      return [Math.min(b[0], p[0]), Math.min(b[1], p[1]), Math.max(b[2], p[0]), Math.max(b[3], p[1])];
    }, [Infinity, Infinity, -Infinity, -Infinity]);
  };
  var same = function (a, b) { return a[0] === b[0] && a[1] === b[1]; };
  var orient3 = function (a, b, c) { return orient(a[0], a[1], b[0], b[1], c[0], c[1]); };
  var on = function (a, b, p) {
    return orient3(a, b, p) === 0 && p[0] >= Math.min(a[0], b[0]) && p[0] <= Math.max(a[0], b[0])
      && p[1] >= Math.min(a[1], b[1]) && p[1] <= Math.max(a[1], b[1]);
  };
  function intersects(a, b, c, d) {
    if (Math.max(a[0], b[0]) < Math.min(c[0], d[0]) || Math.max(c[0], d[0]) < Math.min(a[0], b[0])
      || Math.max(a[1], b[1]) < Math.min(c[1], d[1]) || Math.max(c[1], d[1]) < Math.min(a[1], b[1])) return false;
    var x = orient3(a, b, c), y = orient3(a, b, d), z = orient3(c, d, a), w = orient3(c, d, b);
    return (Math.sign(x) !== Math.sign(y) && x !== 0 && y !== 0 && Math.sign(z) !== Math.sign(w) && z !== 0 && w !== 0)
      || on(a, b, c) || on(a, b, d) || on(c, d, a) || on(c, d, b);
  }
  function inside(p, ring) {
    var result = false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var a = ring[i], b = ring[j];
      if (on(a, b, p)) return false;
      if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) result = !result;
    }
    return result;
  }
  function ringCrosses(a, b) {
    var aa = bounds(a), bb = bounds(b);
    if (aa[2] < bb[0] || bb[2] < aa[0] || aa[3] < bb[1] || bb[3] < aa[1]) return false;
    return a.some(function (p, i) {
      return b.some(function (q, j) { return intersects(p, a[(i + 1) % a.length], q, b[(j + 1) % b.length]); });
    });
  }
  var LIMITS = { copies: 500, verticesPerPart: 5000, verticesTotal: 100000, extent: 100000 };
  var DEFAULT_SETTINGS = { materialWidthMm: 1000, clearanceMm: 0, timeLimitSeconds: null };
  function normalizeRing(value) {
    if (!Array.isArray(value) || value.length > LIMITS.verticesPerPart + 1) throw Error('Contour exceeds 5,000 vertices or is not an array.');
    var ring = [];
    for (var i = 0; i < value.length; i++) {
      var p = value[i];
      if (!Array.isArray(p) || p.length !== 2 || !isFinite(p[0]) || !isFinite(p[1]) || Math.abs(p[0]) > LIMITS.extent || Math.abs(p[1]) > LIMITS.extent) throw Error('Coordinates must be finite and within 100,000 mm.');
      if (!ring.length || !same(ring[ring.length - 1], p)) ring.push(p);
    }
    if (ring.length && same(ring[0], ring[ring.length - 1])) ring.pop();
    if (ring.length < 3 || Math.abs(area(ring)) <= 1e-10) throw Error('Contour has fewer than three vertices or is numerically degenerate.');
    for (var i = 0; i < ring.length; i++) {
      var a = ring[(i + ring.length - 1) % ring.length], b = ring[i], c = ring[(i + 1) % ring.length];
      if (orient3(a, b, c) === 0 && (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]) < 0) throw Error('Contour doubles back along an adjacent edge.');
    }
    for (var i = 0; i < ring.length; i++) for (var j = i + 1; j < ring.length; j++) {
      if (j === i + 1 || (i === 0 && j === ring.length - 1)) continue;
      if (intersects(ring[i], ring[(i + 1) % ring.length], ring[j], ring[(j + 1) % ring.length])) throw Error('Contour self-intersects or repeats an edge.');
    }
    return area(ring) < 0 ? ring.slice().reverse() : ring;
  }
  function normalizePart(part) {
    if (typeof part.id !== 'string' || !part.id || typeof part.name !== 'string' || !part.source || !['svg', 'dxf', 'sparrow', 'drawn'].includes(part.source.format)) throw Error('Invalid part identity or provenance.');
    if (!Number.isInteger(part.quantity) || part.quantity < 0 || part.quantity > LIMITS.copies) throw Error('Quantity must be a whole number from 0 to 500.');
    if (!isFinite(part.approximationToleranceMm) || part.approximationToleranceMm < 0 || part.approximationToleranceMm > 100) throw Error('Invalid approximation tolerance.');
    if (!Array.isArray(part.preparationPosition) || part.preparationPosition.length !== 2 || !isFinite(part.preparationPosition[0]) || !isFinite(part.preparationPosition[1])) throw Error('Invalid preparation position.');
    if (!part.rotations || (part.rotations.kind !== 'continuous' && (part.rotations.kind !== 'discrete' || !Array.isArray(part.rotations.degrees) || !part.rotations.degrees.length || !part.rotations.degrees.every(isFinite)))) throw Error('Discrete rotations require a nonempty list of finite degrees.');
    var outer = normalizeRing(part.outer);
    if (!Array.isArray(part.holes)) throw Error('Holes must be an array.');
    var holes = part.holes.map(normalizeRing);
    if (outer.length + holes.reduce(function (n, h) { return n + h.length; }, 0) > LIMITS.verticesPerPart) throw Error('Part exceeds 5,000 vertices including holes.');
    for (var i = 0; i < holes.length; i++) {
      if (!inside(holes[i][0], outer) || ringCrosses(outer, holes[i])) throw Error('Hole must be strictly inside its outer contour.');
      for (var k = 0; k < i; k++) if (ringCrosses(holes[i], holes[k]) || inside(holes[i][0], holes[k]) || inside(holes[k][0], holes[i])) throw Error('Holes overlap or contain each other.');
    }
    return { id: part.id, name: part.name, source: part.source, outer: outer, holes: holes.map(function (h) { return h.slice().reverse(); }), approximationToleranceMm: part.approximationToleranceMm, quantity: part.quantity, rotations: part.rotations, preparationPosition: part.preparationPosition };
  }
  function normalizeDocument(doc, allowEmpty) {
    if (typeof doc.name !== 'string' || !doc.name.trim() || !Array.isArray(doc.parts) || (!allowEmpty && !doc.parts.length) || doc.parts.length > 500) throw Error('Project needs 1–500 part types.');
    var s = doc.settings;
    if (!s || !isFinite(s.materialWidthMm) || s.materialWidthMm <= 0 || s.materialWidthMm > LIMITS.extent || !isFinite(s.clearanceMm) || s.clearanceMm < 0 || (s.clearanceMm >= s.materialWidthMm) || (s.timeLimitSeconds !== null && [10, 30, 60, 120, 300, 600].indexOf(s.timeLimitSeconds) === -1)) throw Error('Invalid material width, clearance, or run duration.');
    if (s.solverPreset !== undefined && ['standard', 'fast'].indexOf(s.solverPreset) === -1) throw Error('Invalid solver preset.');
    var parts = doc.parts.map(normalizePart);
    var set = {};
    for (var i = 0; i < parts.length; i++) if (set[parts[i].id]) throw Error('Part IDs must be unique.'); else set[parts[i].id] = 1;
    if (parts.reduce(function (n, p) { return n + p.quantity; }, 0) > LIMITS.copies) throw Error('Project exceeds 500 copies.');
    return { name: doc.name, parts: parts, settings: s };
  }
  function newPartId() {
    var b;
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      b = crypto.getRandomValues(new Uint8Array(16));
    } else {
      b = [];
      for (var i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
    }
    var out = '';
    for (var k = 0; k < 16; k++) out += ('0' + b[k].toString(16)).slice(-2);
    return out;
  }
  function newPart(outer, name) {
    return { id: newPartId(), name: name || 'Part', source: { format: 'drawn' }, outer: outer, holes: [], approximationToleranceMm: 0, quantity: 1, rotations: { kind: 'discrete', degrees: [0, 180] }, preparationPosition: [0, 0] };
  }
  function localize(part) {
    var bb = bounds(part.outer);
    var x = bb[0], y = bb[1];
    var shift = function (ring) { return ring.map(function (p) { return [p[0] - x, p[1] - y]; }); };
    return { id: part.id, name: part.name, source: part.source, outer: shift(part.outer), holes: part.holes.map(shift), approximationToleranceMm: part.approximationToleranceMm, quantity: part.quantity, rotations: part.rotations, preparationPosition: part.preparationPosition };
  }

  /* ================================================================ FLATTER
   * Appends polylines por subdivisión (apps de sparrow-studio). */
  var IDENT = [1, 0, 0, 1, 0, 0];
  function matApply(m, p) { return [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]]; }
  function matMul(a, b) {
    return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
      a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
  }
  function append(ring, p) {
    if (ring.length >= 5001) throw Error('Curve approximation exceeds 5,000 vertices. Choose a coarser tolerance and preview again.');
    if (!isFinite(p[0]) || !isFinite(p[1])) throw Error('Curve produced non-finite coordinates.');
    ring.push(p);
  }
  function bezier(points, tolerance, output, depth) {
    depth = depth || 0;
    if (depth > 32) throw Error('Bezier subdivision exceeded its depth limit.');
    var flat = true;
    for (var i = 1; i < points.length - 1; i++) if (pseg(points[i], points[0], points[points.length - 1]) > tolerance) { flat = false; break; }
    if (flat) { append(output, points[points.length - 1]); return; }
    var left = [points[0]], right = [points[points.length - 1]];
    var row = points;
    while (row.length > 1) {
      row = row.slice(1).map(function (p, i) { return [(p[0] + row[i][0]) / 2, (p[1] + row[i][1]) / 2]; });
      left.push(row[0]); right.unshift(row[row.length - 1]);
    }
    bezier(left, tolerance, output, depth + 1);
    bezier(right, tolerance, output, depth + 1);
  }
  function ellipse(center, u, v, start, sweep, tolerance, output) {
    var cb = Math.hypot(u[0], u[1], v[0], v[1]);
    var segments = Math.max(1, Math.ceil(Math.abs(sweep) * Math.sqrt(cb / (8 * tolerance))));
    if (!isFinite(segments) || output.length + segments > 5001) throw Error('Arc approximation exceeds 5,000 vertices. Choose a coarser tolerance and preview again.');
    for (var i = 1; i <= segments; i++) {
      var t = start + sweep * i / segments;
      append(output, [center[0] + u[0] * Math.cos(t) + v[0] * Math.sin(t), center[1] + u[1] * Math.cos(t) + v[1] * Math.sin(t)]);
    }
  }

  /* ============================================================ IMPORT SVG
   * Port de web/src/import/svg.ts. La resolución de paths la hace el wasm
   * (svg_paths), igual que en sparrowstudio.app. */
  var contoursToParts = function (contours, fileName, format, tolerance, enclosed) {
    var parents = hierarchy(contours);
    var depth = parents.map(function (p) { var d = 0; while (p !== -1) { d++; p = parents[p]; } return d; });
    var out = [];
    for (var i = 0; i < contours.length; i++) {
      if (enclosed === 'holes' && depth[i] % 2 === 1) continue;
      var holes = [];
      if (enclosed === 'holes') for (var j = 0; j < contours.length; j++) if (parents[j] === i) holes.push(contours[j].ring);
      var part = localize(newPart(contours[i].ring, 'Pieza ' + out.length));
      part.source = { format: format, fileName: fileName, entityId: contours[i].entityId };
      part.approximationToleranceMm = (contours[i].curved || contours.some(function (h, k) { return parents[k] === i && h.curved; })) ? tolerance : 0;
      part.holes = holes;
      out.push(part);
    }
    return out;
  };
  function hierarchy(contours) {
    var rings = contours.map(function (c) { return normalizeRing(c.ring); });
    var areas = rings.map(function (r) { return Math.abs(area(r)); });
    var parent = rings.map(function () { return -1; });
    for (var i = 0; i < rings.length; i++) for (var j = i + 1; j < rings.length; j++) {
      if (ringCrosses(rings[i], rings[j])) throw Error('Contours ' + contours[i].entityId + ' and ' + contours[j].entityId + ' touch or intersect; topology is ambiguous.');
      var a = inside(rings[i][0], rings[j]), b = inside(rings[j][0], rings[i]);
      if (a && (parent[i] === -1 || areas[j] < areas[parent[i]])) parent[i] = j;
      if (b && (parent[j] === -1 || areas[i] < areas[parent[j]])) parent[j] = i;
    }
    return parent;
  }
  function compound(contours, rule) {
    var parents = hierarchy(contours);
    return contours.filter(function (c, i) {
      var winding = 0, p = parents[i];
      while (p !== -1) { winding += Math.sign(area(contours[p].ring)); p = parents[p]; }
      return rule === 'evenodd' || (winding === 0) !== (winding + Math.sign(area(c.ring)) === 0);
    });
  }
  function pathContours(commands, m, tolerance, id) {
    var contours = [], ring = [], start = [0, 0], current = [0, 0], curved = false, closed = false;
    function finish() {
      if (ring.length) {
        if (!closed) throw Error('Open path cannot become a part. Close it or remove it in the source drawing.');
        contours.push({ ring: ring, entityId: id, curved: curved });
        ring = [];
      }
    }
    for (var s = 0; s < commands.length; s++) {
      var seg = commands[s];
      var cmd = String(seg[0]).toUpperCase();
      var v = seg.slice(1);
      switch (cmd) {
        case 'M': finish(); start = [v[0], v[1]]; current = start; ring = [matApply(m, start)]; closed = false; curved = false; break;
        case 'L': current = [v[0], v[1]]; append(ring, matApply(m, current)); closed = false; break;
        case 'C': bezier([current, [v[0], v[1]], [v[2], v[3]], [v[4], v[5]]].map(function (p) { return matApply(m, p); }), tolerance, ring); current = [v[4], v[5]]; curved = true; closed = false; break;
        case 'Q': bezier([current, [v[0], v[1]], [v[2], v[3]]].map(function (p) { return matApply(m, p); }), tolerance, ring); current = [v[2], v[3]]; curved = true; closed = false; break;
        case 'Z': current = start; closed = true; break;
        default: throw Error('Unsupported path command ' + cmd + '.');
      }
    }
    finish();
    return contours;
  }
  // Returns a review-like object. text processed async via the wasm worker.
  function importSVG(svgText, fileName, scale, tolerance) {
    if (!isFinite(scale) || scale <= 0 || !isFinite(tolerance) || tolerance <= 0 || tolerance > 100) throw Error('Scale and approximation tolerance must be positive finite numbers.');
    if (/<!DOCTYPE|<!ENTITY/i.test(svgText)) throw Error('SVG entities and DOCTYPE declarations are forbidden.');
    if (/<\?xml-stylesheet\b/i.test(svgText)) throw Error('External SVG stylesheets are unsupported. Embed styles in the SVG.');
    var warnings = [];
    var doc = null;
    try { doc = new DOMParser().parseFromString(svgText, 'image/svg+xml'); }
    catch (e) { throw Error('Invalid SVG XML: ' + e.message); }
    var parserError = doc.getElementsByTagName('parsererror');
    if (parserError && parserError.length) throw Error('Invalid SVG XML.');
    var root = doc.documentElement;
    if (!root || (root.localName || root.nodeName).toLowerCase() !== 'svg') throw Error('Expected an SVG root element.');
    var ids = {}, nodes = 0;
    function inspect(node, depth) {
      if (++nodes > 10000 || depth > 64) throw Error('SVG exceeds 10,000 elements or XML depth 64.');
      var tag = (node.localName || node.nodeName).toLowerCase();
      if (['script', 'foreignObject', 'animate', 'animateTransform', 'set'].indexOf(tag) !== -1) throw Error('SVG ' + tag + ' is forbidden.');
      for (var i = 0; i < node.attributes.length; i++) {
        var a = node.attributes.item(i);
        if (a.name === 'xml:base') throw Error('SVG xml:base references are unsupported. Use local references only.');
        if (/^on/i.test(a.name) || ((a.name === 'href' || a.name === 'xlink:href') && a.value.indexOf('#') !== 0)) throw Error('Forbidden event handler or external reference in ' + tag + '.');
      }
      var id = node.getAttribute('id');
      if (id) { if (ids[id]) throw Error('Duplicate SVG ID ' + id + '.'); ids[id] = true; }
      if (tag === 'metadata' || node.getAttribute('data-sparrow-decoration') === 'true') { if (node.parentNode) node.parentNode.removeChild(node); return; }
      if (['text', 'image', 'line'].indexOf(tag) !== -1) { warnings.push((id || tag) + ': excluded ' + tag + '; only closed vector outlines become parts.'); if (node.parentNode) node.parentNode.removeChild(node); return; }
      for (var c = 0; c < node.childNodes.length; c++) if (node.childNodes[c].nodeType === 1) inspect(node.childNodes[c], depth + 1);
    }
    inspect(root, 0);
    var style = root.getAttribute('style');
    if (style) {
      root.setAttribute('style', style.split(';').filter(function (e) { return !/^\s*(width|height)\s*:\s*100%\s*$/.test(e); }).join(';'));
    }
    if (root.getAttribute('preserveAspectRatio') && root.getAttribute('preserveAspectRatio').indexOf('slice') !== -1) warnings.push('preserveAspectRatio slice scaling is honored; viewport cropping is not applied to the root cutting outlines.');
    var rw = root.getAttribute('width'), rh = root.getAttribute('height');
    var ambiguous = (!rw && !rh) || [rw, rh].some(function (v) { return v && v.indexOf('%') !== -1; });
    var mmScale = ambiguous ? scale : 25.4 / 96;
    if (ambiguous) warnings.push('Root SVG size is ambiguous. Using the selected ' + scale + ' mm per drawing unit.');
    return { mmScale: mmScale, xml: new XMLSerializer().serializeToString(doc), warnings: warnings };
  }
  function processSVGResolved(resolved, mmScale, tolerance, fileName, warnings) {
    var matrix = [mmScale, 0, 0, -mmScale, 0, (resolved.height || 0) * mmScale];
    var entities = [];
    var totalVertices = 0;
    for (var i = 0; i < resolved.paths.length; i++) {
      var path = resolved.paths[i];
      var id = path.id || ('path ' + (i + 1));
      var contours = pathContours(path.commands, matMul(matrix, path.transform || IDENT), tolerance, id);
      totalVertices += contours.reduce(function (n, c) { return n + c.ring.length; }, 0);
      if (totalVertices > 100000) throw Error('SVG exceeds 100,000 vertices.');
      entities.push(compound(contours, path.rule === 'evenodd' ? 'evenodd' : 'nonzero'));
    }
    warnings.push('Closed contour interpretation: closed stroke-only outlines count; stroke thickness is not part size or kerf.');
    if (!entities.length) throw Error('No visible closed vector outlines found.');
    var parts = [];
    for (var i = 0; i < entities.length; i++) parts = parts.concat(contoursToParts(entities[i], fileName, 'svg', tolerance, 'holes'));
    if (entities.some(function (e) { return e.length > 1; })) warnings.push('Compound contours may produce separate part types. Holes follow the source fill rule.');
    if (parts.some(function (p) { return p.holes.length; })) warnings.push('Holes are preserved; nesting inside holes is not supported.');
    var offset = 0;
    for (var i = 0; i < parts.length; i++) { parts[i].preparationPosition = [offset, 0]; offset += bounds(parts[i].outer)[2] + 10; }
    // Unidades internas del módulo: cm. El motor usa mm, pero el motor es
    // agnóstico a la unidad física si todo es consistente. Reportamos en cm.
    var document = { name: fileName.replace(/\.svg$/i, ''), parts: parts, settings: {} };
    for (var k in DEFAULT_SETTINGS) document.settings[k] = DEFAULT_SETTINGS[k];
    return { document: parts.length ? normalizeDocument(document) : document, warnings: warnings, replace: false };
  }

  /* ============================================================ IMPORT DXF
   * Port de web/src/import/dxf.ts + parseString del paquete dxf (los
   * handlers de las 8 entidades soportadas por Sparrow Studio). */
  function dxfParse(str) {
    // parseValue + convertToTypesAndValues + separateSections del paquete dxf
    var parseValue = function (type, value) {
      if (type >= 10 && type < 60) return parseFloat(value, 10);
      if (type >= 210 && type < 240) return parseFloat(value, 10);
      if (type >= 60 && type < 100) return parseInt(value, 10);
      return value;
    };
    var lines = str.split(/\r\n|\r|\n/g);
    var tuples = [];
    var state = 'type', type;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (state === 'type') { type = parseInt(line, 10); state = 'value'; }
      else { tuples.push([type, parseValue(type, line)]); state = 'type'; }
    }
    var sectionTuples, sections = [];
    for (var i = 0; i < tuples.length; i++) {
      var t = tuples[i];
      if (t[0] === 0 && t[1] === 'SECTION') sectionTuples = [];
      else if (t[0] === 0 && t[1] === 'ENDSEC') { sections.push(sectionTuples); sectionTuples = undefined; }
      else if (sectionTuples !== undefined) sectionTuples.push(t);
    }
    var result = { header: {}, blocks: [], entities: [], objects: { layouts: [] }, tables: { layers: {}, styles: {}, ltypes: {} } };
    for (var i = 0; i < sections.length; i++) {
      var section = sections[i];
      if (!section || !section.length) continue;
      var type2 = section[0][1];
      var content = section.slice(1);
      if (type2 === 'HEADER') result.header = dxfHeader(content);
      else if (type2 === 'BLOCKS') result.blocks = dxfBlocks(content);
      else if (type2 === 'ENTITIES') result.entities = dxfEntities(content);
    }
    return result;
  }
  function dxfHeader(tuples) {
    var state, header = {};
    for (var i = 0; i < tuples.length; i++) {
      var t = tuples[i], type = t[0], value = t[1];
      if (value === '$MEASUREMENT') state = 'measurement';
      else if (value === '$INSUNITS') state = 'insUnits';
      else if (value === '$EXTMIN') { header.extMin = {}; state = 'extMin'; }
      else if (value === '$EXTMAX') { header.extMax = {}; state = 'extMax'; }
      else if (value === '$DIMASZ') { header.dimArrowSize = {}; state = 'dimArrowSize'; }
      else if (state === 'extMin' || state === 'extMax') {
        if (type === 10) header[state].x = value;
        else if (type === 20) header[state].y = value;
        else if (type === 30) { header[state].z = value; state = undefined; }
      } else if (state === 'measurement' || state === 'insUnits') {
        if (type === 70) { header[state] = value; state = undefined; }
      } else if (state === 'dimArrowSize') {
        if (type === 40) { header[state] = value; state = undefined; }
      }
    }
    return header;
  }
  function dxfCommon(type, value) {
    switch (type) {
      case 5: return { handle: value };
      case 6: return { lineTypeName: value };
      case 8: return { layer: value };
      case 48: return { lineTypeScale: value };
      case 60: return { visible: value === 0 };
      case 62: return { colorNumber: value };
      case 67: return value === 0 ? {} : { paperSpace: value };
      case 68: return { viewportOn: value };
      case 69: return { viewport: value };
      case 210: return { extrusionX: value };
      case 220: return { extrusionY: value };
      case 230: return { extrusionZ: value };
      case 410: return { layout: value };
      default: return {};
    }
  }
  function dxfReduce(tuples, base, switchFn) {
    var out = { vertices: [], controlPoints: [], knots: [] };
    Object.assign(out, base);
    out.vertices = base.vertices ? base.vertices.slice() : [];
    out.controlPoints = base.controlPoints ? base.controlPoints.slice() : [];
    out.knots = base.knots ? base.knots.slice() : [];
    return tuples.reduce(function (entity, tuple) {
      var type = tuple[0], value = tuple[1];
      if (!switchFn(entity, type, value)) Object.assign(entity, dxfCommon(type, value));
      return entity;
    }, out);
  }
  function dxfEntities(tuples) {
    var entityGroups = [], current;
    for (var i = 0; i < tuples.length; i++) {
      if (tuples[i][0] === 0) { current = []; entityGroups.push(current); }
      current.push(tuples[i]);
    }
    var entities = [], currentPolyline;
    var handlers = {
      LINE: { base: { type: 'LINE', start: {}, end: {} }, sw: function (e, t, v) {
        if (t === 10) e.start.x = v;
        else if (t === 20) e.start.y = v;
        else if (t === 30) e.start.z = v;
        else if (t === 39) e.thickness = v;
        else if (t === 11) e.end.x = v;
        else if (t === 21) e.end.y = v;
        else if (t === 31) e.end.z = v;
        else return false;
        return true;
      } },
      LWPOLYLINE: { base: { type: 'LWPOLYLINE', vertices: [] }, sw: function (e, t, v) {
        if (t === 70) e.closed = (v & 1) === 1;
        else if (t === 10) e.vertex = { x: v, y: 0 }, e.vertices.push(e.vertex);
        else if (t === 20) e.vertex.y = v;
        else if (t === 39) e.thickness = v;
        else if (t === 42) e.vertex.bulge = v;
        else if (t === 40 || t === 41 || t === 43) e.widthCode = v;
        else if (t === 14 || t === 24 || t === 44) e.bulgeCode = v;
        else return false;
        return true;
      } },
      POLYLINE: { base: { type: 'POLYLINE', vertices: [] }, sw: function (e, t, v) {
        if (t === 70) { e.closed = (v & 1) === 1; e.polygonMesh = (v & 16) === 16; e.polyfaceMesh = (v & 64) === 64; }
        else if (t === 39) e.thickness = v;
        else return false;
        return true;
      } },
      VERTEX: { base: {}, sw: function (e, t, v) {
        if (t === 10) e.x = v;
        else if (t === 20) e.y = v;
        else if (t === 30) e.z = v;
        else if (t === 42) e.bulge = v;
        else return false;
        return true;
      } },
      CIRCLE: { base: { type: 'CIRCLE' }, sw: function (e, t, v) {
        if (t === 10) e.x = v;
        else if (t === 20) e.y = v;
        else if (t === 30) e.z = v;
        else if (t === 40) e.r = v;
        else return false;
        return true;
      } },
      ARC: { base: { type: 'ARC' }, sw: function (e, t, v) {
        if (t === 10) e.x = v;
        else if (t === 20) e.y = v;
        else if (t === 30) e.z = v;
        else if (t === 39) e.thickness = v;
        else if (t === 40) e.r = v;
        else if (t === 50) e.startAngle = v / 180 * Math.PI;
        else if (t === 51) e.endAngle = v / 180 * Math.PI;
        else return false;
        return true;
      } },
      ELLIPSE: { base: { type: 'ELLIPSE' }, sw: function (e, t, v) {
        if (t === 10) e.x = v;
        else if (t === 20) e.y = v;
        else if (t === 30) e.z = v;
        else if (t === 11) e.majorX = v;
        else if (t === 21) e.majorY = v;
        else if (t === 31) e.majorZ = v;
        else if (t === 40) e.axisRatio = v;
        else if (t === 41) e.startAngle = v;
        else if (t === 42) e.endAngle = v;
        else return false;
        return true;
      } },
      SPLINE: { base: { type: 'SPLINE', controlPoints: [], knots: [] }, sw: function (e, t, v) {
        if (t === 10) e.controlPoint = { x: v, y: 0 }, e.controlPoints.push(e.controlPoint);
        else if (t === 20) e.controlPoint.y = v;
        else if (t === 30) e.controlPoint.z = v;
        else if (t === 40) e.knots.push(v);
        else if (t === 41) { if (!e.weights) e.weights = []; e.weights.push(v); }
        else if (t === 42) e.knotTolerance = v;
        else if (t === 43) e.controlPointTolerance = v;
        else if (t === 44) e.fitTolerance = v;
        else if (t === 70) { e.flag = v; e.closed = (v & 1) === 1; }
        else if (t === 71) e.degree = v;
        else if (t === 72) e.numberOfKnots = v;
        else if (t === 73) e.numberOfControlPoints = v;
        else if (t === 74) e.numberOfFitPoints = v;
        else return false;
        return true;
      } },
      INSERT: { base: { type: 'INSERT' }, sw: function (e, t, v) {
        if (t === 2) e.block = v;
        else if (t === 10) e.x = v;
        else if (t === 20) e.y = v;
        else if (t === 30) e.z = v;
        else if (t === 41) e.scaleX = v;
        else if (t === 42) e.scaleY = v;
        else if (t === 43) e.scaleZ = v;
        else if (t === 44) e.columnSpacing = v;
        else if (t === 45) e.rowSpacing = v;
        else if (t === 50) e.rotation = v;
        else if (t === 70) e.columnCount = v;
        else if (t === 71) e.rowCount = v;
        else return false;
        return true;
      } }
    };
    for (var i = 0; i < entityGroups.length; i++) {
      var group = entityGroups[i];
      var entityType = group[0][1];
      var h = handlers[entityType];
      if (h) {
        var e = dxfReduce(group.slice(1), h.base, h.sw);
        if (entityType === 'POLYLINE') { currentPolyline = e; entities.push(e); }
        else if (entityType === 'VERTEX') { if (currentPolyline) currentPolyline.vertices.push(e); }
        else if (entityType === 'SEQEND') { currentPolyline = undefined; }
        else entities.push(e);
      }
    }
    return entities;
  }
  function dxfBlocks(tuples) {
    var state, blocks = [], block, entitiesTuples;
    for (var i = 0; i < tuples.length; i++) {
      var t = tuples[i], type = t[0], value = t[1];
      if (value === 'BLOCK') { state = 'block'; block = {}; entitiesTuples = []; blocks.push(block); }
      else if (value === 'ENDBLK') {
        block.entities = (state === 'entities') ? dxfEntities(entitiesTuples) : [];
        entitiesTuples = undefined; state = undefined;
      } else if (state === 'block' && type !== 0) {
        if (type === 1) block.xref = value;
        else if (type === 2) block.name = value;
        else if (type === 10) block.x = value;
        else if (type === 20) block.y = value;
        else if (type === 30) block.z = value;
        else if (type === 67 && value !== 0) block.paperSpace = value;
        else if (type === 410) block.layout = value;
      } else if (state === 'block' && type === 0) { state = 'entities'; entitiesTuples.push(t); }
      else if (state === 'entities') entitiesTuples.push(t);
    }
    return blocks;
  }
  function bSpline(t, degree, points, knots) {
    // port de dxf/lib/util/bSpline.js
    var n = points.length, d = points[0].length;
    if (t < 0 || t > 1) throw new Error('t out of bounds [0,1]: ' + t);
    var domain = [degree, knots.length - 1 - degree];
    var low = knots[domain[0]], high = knots[domain[1]];
    t = t * (high - low) + low;
    t = Math.max(t, low); t = Math.min(t, high);
    var s, i, j;
    for (s = domain[0]; s < domain[1]; s++) if (t >= knots[s] && t <= knots[s + 1]) break;
    var v = [];
    for (var i = 0; i < n; i++) {
      v[i] = [];
      for (var j = 0; j < d; j++) v[i][j] = points[i][j] * (points[i][d] !== undefined ? points[i][d] : 1);
      v[i][d] = points[i][d] !== undefined ? points[i][d] : 1;
    }
    var alpha;
    for (var l = 1; l <= degree + 1; l++) {
      for (var i2 = s; i2 > s - degree - 1 + l; i2--) {
        alpha = (t - knots[i2]) / (knots[i2 + degree + 1 - l] - knots[i2]);
        for (var j2 = 0; j2 < d + 1; j2++) v[i2][j2] = (1 - alpha) * v[i2 - 1][j2] + alpha * v[i2][j2];
      }
    }
    var result = [];
    for (var i = 0; i < d; i++) result[i] = Math.round(v[s][i] / v[s][d] * 1e9) / 1e9;
    return result;
  }
  /* ------------ importDXF port (web/src/import/dxf.ts) ---------------- */
  function dxfScan(text) {
    if (text.indexOf('AutoCAD Binary DXF') === 0 || text.indexOf('\0') !== -1) throw Error('Binary DXF is unsupported. Export ASCII DXF.');
    var lines = text.replace(/^\uFEFF/, '').trimEnd().split(/\r\n|\n|\r/);
    if (lines.length % 2) throw Error('ASCII DXF must contain complete group-code/value pairs.');
    var groups = [];
    for (var i = 0; i < lines.length; i += 2) {
      var code = Number(lines[i].trim());
      if (!lines[i].trim() || !Number.isInteger(code) || code < 0 || code > 1071) throw Error('Invalid DXF group code at line ' + (i + 1) + '.');
      groups.push([code, lines[i + 1].trim()]);
    }
    if (groups[groups.length - 1][0] !== 0 || groups[groups.length - 1][1] !== 'EOF') throw Error('DXF is missing its EOF record.');
    var section = '', units = 0, raw = [];
    for (var i = 0; i < groups.length; i++) {
      var g = groups[i], code2 = g[0], v = g[1];
      if (code2 === 0 && v === 'SECTION') { if (groups[i + 1][0] !== 2) throw Error('Malformed DXF section.'); section = groups[++i][1]; continue; }
      if (code2 === 0 && v === 'ENDSEC') { section = ''; continue; }
      if (section === 'HEADER' && code2 === 9 && v === '$INSUNITS') units = dxfFinite(groups[i + 1][1]);
      if (section !== 'ENTITIES' && section !== 'BLOCKS') continue;
      if (code2 !== 0) continue;
      groups.splice(i + 1, 0, [5, 'studio-' + (raw.length + 1)]);
      var body = [];
      while (groups[i + 1] && groups[i + 1][0] !== 0) {
        var group = groups[++i];
        if (group[0] === 5) group[1] = 'studio-' + (raw.length + 1);
        body.push(group);
      }
      var r = { type: v, groups: body, children: [], id: '', layer: '' };
      r.id = dxfValue(r, 5) || (v + ' ' + (raw.length + 1));
      r.layer = dxfValue(r, 8) || '0';
      raw.push(r);
      if (raw.length > 10000) throw Error('DXF exceeds 10,000 entities including vertices.');
    }
    var records = [];
    for (var i = 0; i < raw.length; i++) {
      var rec = raw[i];
      if (rec.type === 'POLYLINE') {
        while (raw[i + 1] && raw[i + 1].type === 'VERTEX') rec.children.push(raw[++i]);
        if (!raw[i + 1] || raw[i + 1].type !== 'SEQEND') throw Error(rec.id + ': POLYLINE lacks a terminating SEQEND.');
        rec.children.push(raw[++i]);
      } else if (rec.type === 'VERTEX' || rec.type === 'SEQEND') throw Error(rec.id + ': orphan ' + rec.type + '.');
      records.push(rec);
    }
    return { records: records, units: units, text: groups.map(function (g2) { return g2.join('\n'); }).join('\n') };
  }
  function dxfFinite(text, fallback) {
    if (text === undefined && fallback !== undefined) return fallback;
    if (text === undefined || !String(text).trim() || !isFinite(Number(text))) throw Error('Missing or non-finite DXF number.');
    return Number(text);
  }
  function dxfValue(r, code) {
    var g = null;
    for (var i = 0; i < r.groups.length; i++) if (r.groups[i][0] === code) { g = r.groups[i][1]; break; }
    return g;
  }
  function dxfGuard(r) {
    var entity, i, j;
    for (var i = 0; i < [r].concat(r.children).length; i++) {
      entity = [r].concat(r.children)[i];
      for (var j = 0; j < entity.groups.length; j++) {
        var code = entity.groups[j][0], v = entity.groups[j][1];
        if (code >= 10 && code <= 59) dxfFinite(v);
        if (code >= 60 && code <= 99 && !/^[+-]?\d+$/.test(String(v))) throw Error('Invalid integer DXF field.');
        if ((code >= 30 && code <= 38 || code === 39) && dxfFinite(v) !== 0) throw Error('Nonzero elevation, z coordinates, or thickness are unsupported.');
        if ((code === 210 || code === 220) && dxfFinite(v) !== 0) throw Error('Non-XY extrusion is unsupported.');
        if (code === 230 && [1, -1].indexOf(dxfFinite(v)) === -1) throw Error('Non-XY extrusion is unsupported.');
      }
      var flags = dxfFinite(dxfValue(entity, 70), 0);
      if (entity.type === 'POLYLINE' && (flags & ~129) !== 0) throw Error('Only ordinary 2D POLYLINE is supported; spline-fit, mesh and 3D flags are excluded.');
      if (entity.type === 'VERTEX' && flags !== 0) throw Error('Only ordinary 2D VERTEX records are supported.');
    }
    if (r.type === 'LWPOLYLINE') {
      var count = dxfFinite(dxfValue(r, 90));
      if (!isFinite(count) || !Number.isInteger(count) || count < 2 || count > 5000 || count !== r.groups.filter(function (g) { return g[0] === 10; }).length) throw Error('Invalid LWPOLYLINE vertex count.');
    }
  }
  function dxfBulge(from, to, b, tolerance, output) {
    if (!isFinite(b)) throw Error('Non-finite polyline bulge.');
    var dx = to[0] - from[0], dy = to[1] - from[1], chord = Math.hypot(dx, dy);
    if (b === 0 || chord * Math.abs(b) / 2 <= tolerance) { append(output, to); return; }
    if (chord === 0) throw Error('A bulged edge has coincident endpoints.');
    var k = (1 - b * b) / (4 * b);
    var center = [(from[0] + to[0]) / 2 - dy * k, (from[1] + to[1]) / 2 + dx * k];
    var radius = chord * (1 + b * b) / (4 * Math.abs(b));
    ellipse(center, [radius, 0], [0, radius], Math.atan2(from[1] - center[1], from[0] - center[0]), 4 * Math.atan(b), tolerance, output);
    output[output.length - 1] = to;
  }
  function dxfSpline(entity, tolerance) {
    var points = entity.controlPoints || [], knots = entity.knots || [], degree = entity.degree || 0;
    if (!Number.isInteger(degree) || degree < 1 || degree > 3 || points.length <= degree || points.length > 5000) throw Error('SPLINE needs degree 1–3 and a valid control-point count.');
    var weights = entity.weights || points.map(function () { return 1; });
    if (weights.length !== points.length || weights.some(function (w) { return !isFinite(w) || w <= 0; })) throw Error('SPLINE weights must be finite and positive.');
    if (knots.length !== points.length + degree + 1 || knots.some(function (v, i) { return !isFinite(v) || (i > 0 && v < knots[i - 1]); })) throw Error('Invalid SPLINE knot vector.');
    if (points.some(function (p) { return !isFinite(p.x) || !isFinite(p.y) || !isFinite(p.z || 0) || (p.z || 0) !== 0; })) throw Error('Invalid or nonplanar SPLINE control points.');
    var low = knots[degree], high = knots[points.length];
    if (!(high > low)) throw Error('Empty SPLINE parameter domain.');
    var spans = [];
    for (var i = degree; i < points.length + 1; i++) if (spans.indexOf(knots[i]) === -1) spans.push(knots[i]);
    if (spans.slice(1, -1).some(function (k) { return knots.filter(function (v) { return v === k; }).length > degree; })) throw Error('Discontinuous SPLINE cannot form one contour.');
    var homogeneous = points.map(function (p, idx) { return [p.x * weights[idx], p.y * weights[idx], weights[idx]]; });
    var project = function (p) { return [p[0] / p[2], p[1] / p[2]]; };
    var output = [];
    var flatten = function (control, budget, depth) {
      depth = depth || 0;
      if (depth > 32) throw Error('SPLINE subdivision exceeded its depth limit.');
      var projected = control.map(project);
      var flat = true;
      for (var j = 1; j < projected.length - 1; j++) if (pseg(projected[j], projected[0], projected[projected.length - 1]) > budget) { flat = false; break; }
      if (flat) { append(output, projected[projected.length - 1]); return; }
      var left = [control[0]], right = [control[control.length - 1]];
      var row = control;
      while (row.length > 1) {
        row = row.slice(1).map(function (p, idx) { return p.map(function (val, jj) { return (val + row[idx][jj]) / 2; }); });
        left.push(row[0]); right.unshift(row[row.length - 1]);
      }
      flatten(left, budget, depth + 1);
      flatten(right, budget, depth + 1);
    };
    for (var s = 1; s < spans.length; s++) {
      var samples = [0, 1 / 3, 2 / 3, 1].map(function (tt) {
        return bSpline(Math.max(0, Math.min(1, (spans[s - 1] + tt * (spans[s] - spans[s - 1]) - low) / (high - low))), degree, homogeneous, knots);
      });
      var p0 = samples[0], a = samples[1], b = samples[2], p3 = samples[3];
      var p1 = p0.map(function (v, j) { return (2 * (27 * a[j] - 8 * v - p3[j]) - (27 * b[j] - v - 8 * p3[j])) / 18; });
      var p2 = p0.map(function (v, j) { return (2 * (27 * b[j] - v - 8 * p3[j]) - (27 * a[j] - 8 * v - p3[j])) / 18; });
      var control = [p0, p1, p2, p3];
      if (control.some(function (p) { return p.some(function (val) { return !isFinite(val); }) || p[2] <= 0; })) throw Error('Invalid SPLINE span.');
      var precision = 1e-7 * (1 + Math.max.apply(null, control.reduce(function (acc, p) { return acc.concat(project(p)); }, []).map(Math.abs))) / Math.min.apply(null, control.map(function (p) { return p[2]; }));
      if (precision >= tolerance) throw Error('Requested tolerance is below SPLINE evaluation precision.');
      if (!output.length) append(output, project(p0));
      flatten(control, tolerance - precision);
    }
    return output;
  }
  function dxfJoin(chains, issues) {
    var endpoints = [];
    for (var i = 0; i < chains.length; i++) {
      endpoints.push({ p: chains[i].points[0], edge: i, end: 0 });
      endpoints.push({ p: chains[i].points[chains[i].points.length - 1], edge: i, end: 1 });
    }
    var neighbors = endpoints.map(function () { return []; });
    var cells = {};
    var tolerance = 0.01;
    for (var i = 0; i < endpoints.length; i++) {
      var p = endpoints[i].p;
      var x = Math.floor(p[0] / tolerance), y = Math.floor(p[1] / tolerance);
      var keys = [];
      for (var dx = -1; dx <= 1; dx++) for (var dy = -1; dy <= 1; dy++) {
        var key = (x + dx) + ',' + (y + dy);
        keys.push(key);
        var list = cells[key] || [];
        for (var m = 0; m < list.length; m++) {
          var j = list[m];
          var q = endpoints[j].p;
          if (Math.hypot(p[0] - q[0], p[1] - q[1]) <= tolerance) { neighbors[i].push(j); neighbors[j].push(i); }
        }
      }
      cells[x + ',' + y] = (cells[x + ',' + y] || []).concat([i]);
    }
    var visited = {}, contours = [], gaps = 0, adjustment = 0;
    for (var i = 0; i < chains.length; i++) {
      if (visited[i]) continue;
      var component = {}, queue = [i];
      component[i] = true;
      for (var at = 0; at < queue.length; at++) {
        var e = queue[at] * 2, e2 = queue[at] * 2 + 1;
        for (var n = 0; n < neighbors[e].length; n++) {
          var edge = endpoints[neighbors[e][n]].edge;
          if (!component[edge]) { component[edge] = true; queue.push(edge); }
        }
        for (n = 0; n < neighbors[e2].length; n++) {
          edge = endpoints[neighbors[e2][n]].edge;
          if (!component[edge]) { component[edge] = true; queue.push(edge); }
        }
      }
      for (var key2 in component) visited[key2] = true;
      var bad = false, ids = [];
      for (var key2 in component) {
        ids.push(chains[key2].id);
        var idx = Number(key2);
        if (neighbors[idx * 2].length !== 1 || neighbors[idx * 2 + 1].length !== 1) { bad = true; break; }
      }
      if (bad) { issues.push(ids.join(', ') + ': open ends or ambiguous junctions within 0.01 mm. Exclude these contours or repair the source.'); continue; }
      var current = i * 2, ring = [], curved = false, jumped = false, gapHalf = 0;
      var walked = {};
      do {
        var e3 = endpoints[current].edge;
        if (walked[e3]) throw Error('DXF chain traversal revisited an edge.');
        walked[e3] = true;
        var chain = chains[e3];
        var points = (current % 2) ? chain.points.slice().reverse() : chain.points;
        var entryNeighbor = endpoints[neighbors[current][0]].p;
        var entry = points[0];
        var exitIndex = e3 * 2 + (current % 2 ? 0 : 1);
        var exit = points[points.length - 1];
        var exitNeighbor = endpoints[neighbors[exitIndex][0]].p;
        var entryPoint = [(entry[0] + entryNeighbor[0]) / 2, (entry[1] + entryNeighbor[1]) / 2];
        var exitPoint = [(exit[0] + exitNeighbor[0]) / 2, (exit[1] + exitNeighbor[1]) / 2];
        var gap = Math.hypot(exit[0] - exitNeighbor[0], exit[1] - exitNeighbor[1]);
        if (gap > 0) { gaps++; adjustment = Math.max(adjustment, gap / 2); gapHalf = Math.max(gapHalf, gap / 2); }
        var chainPoints = [entryPoint].concat(points.slice(1, -1)).concat([exitPoint]);
        for (var cp = 0; cp < chainPoints.length; cp++) append(ring, chainPoints[cp]);
        if (chain.curved) curved = true;
        current = neighbors[exitIndex][0];
        if (current === i * 2) { jumped = true; }
      } while (!jumped);
      var count = 0;
      for (var key2 in walked) count++;
      var compCount = 0;
      for (var key2 in component) compCount++;
      if (count !== compCount) throw Error('DXF component did not form a single closed chain.');
      contours.push({ ring: ring, entityId: ids.join(' + '), curved: curved || gapHalf > 0 });
    }
    return { contours: contours, gaps: gaps, adjustment: adjustment };
  }
  function importDXF(text, fileName, options) {
    if (!isFinite(options.scale) || options.scale <= 0 || !isFinite(options.tolerance) || options.tolerance <= 0) throw Error('Choose positive scale and approximation tolerance.');
    var source = dxfScan(text);
    var records = source.records, units = source.units;
    var parsed = dxfParse(source.text);
    var unitScales = { 1: 2.54, 2: 30.48, 4: 0.1, 5: 1, 6: 100, 7: 100000, 9: 0.00254, 10: 91.44, 13: 0.0001, 14: 10, 15: 1000 };
    var scale = unitScales[units] || options.scale;
    var warnings = [], issues = [], unsupported = {};
    warnings.push(unitScales[units] ? 'DXF INSUNITS ' + units + ': one unit = ' + scale + ' cm.' : 'Missing or unsupported DXF INSUNITS ' + units + '. Using the selected ' + options.scale + ' cm per drawing unit.');
    var byHandle = {}, blocks = {};
    for (var i = 0; i < records.length; i++) byHandle[records[i].id] = records[i];
    for (var i = 0; i < parsed.blocks.length; i++) blocks[parsed.blocks[i].name] = parsed.blocks[i];
    var supported = ['LINE', 'ARC', 'CIRCLE', 'ELLIPSE', 'LWPOLYLINE', 'POLYLINE', 'SPLINE', 'INSERT'];
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      if (supported.indexOf(r.type) === -1 && r.type !== 'BLOCK' && r.type !== 'ENDBLK') unsupported[r.type] = (unsupported[r.type] || 0) + 1;
    }
    var layers = [], contours = [], chains = [], totalVertices = 0, expanded = 0;
    var visit = function (entity, parent, inheritedLayer, path) {
      if (++expanded > 10000) throw Error('DXF exceeds 10,000 expanded entities.');
      var rec = byHandle[entity.handle];
      if (!rec || supported.indexOf(entity.type) === -1) return;
      var layer = (entity.layer && entity.layer !== '0') ? entity.layer : inheritedLayer;
      if (layers.indexOf(layer) === -1) layers.push(layer);
      var err;
      try {
        dxfGuard(rec);
        if (entity.type === 'INSERT') {
          if (!entity.block || path.indexOf(entity.block) !== -1 || path.length >= 32) throw Error('Missing, cyclic, or excessively nested block reference.');
          var block = blocks[entity.block];
          if (!block) throw Error('Missing block ' + entity.block + '.');
          var blockRecord = null;
          for (var bi = 0; bi < records.length; bi++) if (records[bi].type === 'BLOCK' && dxfValue(records[bi], 2) === block.name) { blockRecord = records[bi]; break; }
          if (blockRecord) dxfGuard(blockRecord);
          var rows = entity.rowCount || 1, columns = entity.columnCount || 1;
          if (!(Number.isInteger(rows) && Number.isInteger(columns) && rows > 0 && columns > 0) || rows * columns > 10000) throw Error('Invalid or oversized INSERT array.');
          var sx = entity.scaleX || 1, sy = entity.scaleY || 1;
          var angle = (entity.rotation || 0) * Math.PI / 180, c = Math.cos(angle), sn = Math.sin(angle);
          if (sx === 0 || sy === 0) throw Error('INSERT scale must be nonzero.');
          var reflect = [entity.extrusionZ === -1 ? -1 : 1, 0, 0, 1, 0, 0];
          for (var r2 = 0; r2 < rows; r2++) for (var col = 0; col < columns; col++) {
            var ox = col * (entity.columnSpacing || 0), oy = r2 * (entity.rowSpacing || 0);
            var transform = [c * sx, sn * sx, -sn * sy, c * sy, (entity.x || 0) + c * ox - sn * oy, (entity.y || 0) + sn * ox + c * oy];
            var matrix = matMul(matMul(matMul(parent, reflect), transform), [1, 0, 0, 1, -(block.x || 0), -(block.y || 0)]);
            for (var ci = 0; ci < block.entities.length; ci++) visit(block.entities[ci], matrix, layer, path.concat([block.name]));
          }
          return;
        }
        if (options.layers && options.layers.indexOf(layer) === -1) return;
        var matrix2 = (entity.extrusionZ === -1 && ['CIRCLE', 'ARC', 'LWPOLYLINE', 'POLYLINE'].indexOf(entity.type) !== -1)
          ? matMul(parent, [-1, 0, 0, 1, 0, 0]) : parent;
        var tolerance = options.tolerance / Math.hypot(matrix2[0], matrix2[1], matrix2[2], matrix2[3]);
        var point = function (p) {
          if (!p || !isFinite(p.x) || !isFinite(p.y) || !isFinite(p.z || 0) || (p.z && p.z !== 0)) throw Error('Invalid or nonplanar coordinates.');
          return [p.x, p.y];
        };
        var ring, closed = false, curved = false;
        if (entity.type === 'LINE') ring = [point(entity.start), point(entity.end)];
        else if (entity.type === 'SPLINE') { ring = dxfSpline(entity, tolerance); curved = true; }
        else if (['ARC', 'CIRCLE', 'ELLIPSE'].indexOf(entity.type) !== -1) {
          var center = point({ x: entity.x, y: entity.y }), u, v;
          if (entity.type === 'ELLIPSE') {
            u = [entity.majorX, entity.majorY];
            var ratio = entity.axisRatio;
            if (!isFinite(ratio) || ratio <= 0 || ratio > 1 || !Math.hypot(u[0], u[1])) throw Error('Invalid ellipse axes.');
            var sign = entity.extrusionZ === -1 ? -1 : 1;
            v = [-u[1] * ratio * sign, u[0] * ratio * sign];
          } else {
            var radius = entity.r;
            if (!isFinite(radius) || radius <= 0) throw Error('Arc radius must be positive.');
            u = [radius, 0]; v = [0, radius];
          }
          var start = entity.type === 'CIRCLE' ? 0 : entity.startAngle;
          var end = entity.type === 'CIRCLE' ? 2 * Math.PI : entity.endAngle;
          closed = entity.type === 'CIRCLE' || (entity.type === 'ELLIPSE' && Math.abs(end - start) >= 2 * Math.PI - 1e-10);
          var sweep = closed ? 2 * Math.PI : ((end - start) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
          if (!isFinite(start) || !isFinite(sweep) || sweep === 0) throw Error('Curve needs distinct finite start and end angles.');
          ring = [[center[0] + u[0] * Math.cos(start) + v[0] * Math.sin(start), center[1] + u[1] * Math.cos(start) + v[1] * Math.sin(start)]];
          ellipse(center, u, v, start, sweep, tolerance, ring);
          curved = true;
          if (closed) ring.pop();
        } else {
          var vertices = entity.vertices || [];
          if (vertices.length < 2 || vertices.length > 5000) throw Error('Polyline needs 2–5,000 vertices.');
          var points = vertices.map(point);
          closed = !!entity.closed;
          ring = [points[0]];
          for (var vi = 0; vi < points.length - (closed ? 0 : 1); vi++) {
            var b = vertices[vi].bulge || 0;
            dxfBulge(points[vi], points[(vi + 1) % points.length], b, tolerance, ring);
            if (b !== 0) curved = true;
          }
          if (closed) ring.pop();
          if (rec.groups.some(function (g) { return g[0] === 40 || g[0] === 41 || g[0] === 43 ? dxfFinite(g[1]) !== 0 : false; })) warnings.push(rec.id + ': polyline width is ignored; the centerline is the contour.');
        }
        ring = ring.map(function (p) { return matApply(matrix2, p); });
        if (ring.some(function (p) { return !isFinite(p[0]) || !isFinite(p[1]) || Math.abs(p[0]) > 100000 || Math.abs(p[1]) > 100000; })) throw Error('Coordinates exceed the 100,000 mm limit.');
        totalVertices += ring.length;
        if (totalVertices > 100000) throw Error('DXF exceeds 100,000 vertices.');
        if (closed) contours.push({ ring: ring, entityId: rec.id, curved: curved });
        else chains.push({ points: ring, id: rec.id, curved: curved });
      } catch (e) {
        if (expanded > 10000 || totalVertices > 100000) throw e;
        issues.push(rec.id + ' on ' + layer + ': ' + (e instanceof Error ? e.message : String(e)));
      }
    };
    for (var i = 0; i < parsed.entities.length; i++) visit(parsed.entities[i], [scale, 0, 0, scale, 0, 0], '0', []);
    layers.sort();
    var joined = dxfJoin(chains, issues);
    contours = contours.concat(joined.contours);
    if (joined.gaps) warnings.push('Joined ' + joined.gaps + ' gaps within 0.01 mm; largest endpoint adjustment ' + joined.adjustment + ' mm. Confirm this preview before importing.');
    var valid = [];
    for (var i = 0; i < contours.length; i++) {
      try { valid.push({ ring: normalizeRing(contours[i].ring), entityId: contours[i].entityId, curved: contours[i].curved }); }
      catch (e) { issues.push(contours[i].entityId + ': ' + String(e)); }
    }
    var rejected = {};
    for (var i = 0; i < valid.length; i++) for (var j2 = 0; j2 < i; j2++) {
      if (ringCrosses(valid[i].ring, valid[j2].ring)) { rejected[i] = true; rejected[j2] = true; issues.push(valid[i].entityId + ' and ' + valid[j2].entityId + ': intersecting or duplicate loops.'); }
    }
    var clean = [];
    for (var i = 0; i < valid.length; i++) if (!rejected[i]) clean.push(valid[i]);
    var parts = contoursToParts(clean, fileName, 'dxf', options.tolerance + joined.adjustment, options.enclosed || 'holes');
    var offset = 0;
    for (var i = 0; i < parts.length; i++) { parts[i].preparationPosition = [offset, 0]; offset += bounds(parts[i].outer)[2] + 10; }
    for (var type2 in unsupported) warnings.push('Excluded ' + unsupported[type2] + ' unsupported ' + type2 + ' entities.');
    if (parts.some(function (p) { return p.holes.length; })) warnings.push('Holes are preserved; nesting inside holes is not supported.');
    var document = { name: fileName.replace(/\.dxf$/i, ''), parts: parts, settings: {} };
    for (var key in DEFAULT_SETTINGS) document.settings[key] = DEFAULT_SETTINGS[key];
    return { document: parts.length ? normalizeDocument(document) : document, warnings: warnings, issues: issues, layers: layers, replace: false };
  }

  /* ===================================================== IMPORTERS DE JSON
   * patron.json de PocketCad + instancia ExtSPInstance de Sparrow. */
  function importPocketCad(data, name) {
    var pxPerCm = (data.pxPerCm && data.pxPerCm > 0) ? data.pxPerCm : 96 / 2.54;
    var figures = Array.isArray(data.figures) ? data.figures : [];
    var warnings = [], issues = [];
    var parts = [];
    var tol = 0.05; /* cm -> 0.05 cm = 0.5 mm de aproximación de curvas */
    var vxy = function (v) {
      if (Array.isArray(v) && v.length >= 2) return [Number(v[0]), Number(v[1])];
      if (v && typeof v === 'object' && isFinite(v.x) && isFinite(v.y)) return [Number(v.x), Number(v.y)];
      return null;
    };
    for (var i = 0; i < figures.length; i++) {
      var f = figures[i];
      if (!f) continue;
      if (f.closed === false) { warnings.push('Figura ' + (i + 1) + ': abierta, ignorada.'); continue; }
      if (!Array.isArray(f.vertices) || f.vertices.length < 3) continue;
      var edges = Array.isArray(f.edges) ? f.edges : [];
      var pts = [], curved = false;
      for (var e = 0; e < edges.length; e++) {
        var edge = edges[e];
        if (!edge || !isFinite(edge.start) || !isFinite(edge.end)) continue;
        var a = vxy(f.vertices[edge.start]);
        var b = vxy(f.vertices[edge.end]);
        if (!a || !b) continue;
        var ac = [a[0] / pxPerCm, -a[1] / pxPerCm];   // flip de eje Y
        var bc = [b[0] / pxPerCm, -b[1] / pxPerCm];
        if (edge.cubic && isFinite(edge.controlX) && isFinite(edge.controlY) && isFinite(edge.control2X) && isFinite(edge.control2Y)) {
          var c1 = [edge.controlX / pxPerCm, -edge.controlY / pxPerCm];
          var c2 = [edge.control2X / pxPerCm, -edge.control2Y / pxPerCm];
          bezier([ac, c1, c2, bc], tol, pts);
          curved = true;
        } else if (edge.curved && isFinite(edge.controlX) && isFinite(edge.controlY)) {
          var cp = [edge.controlX / pxPerCm, -edge.controlY / pxPerCm];
          bezier([ac, cp, bc], tol, pts);
          curved = true;
        } else {
          pts.push(bc);
        }
      }
      try {
        var ring = normalizeRing(pts);
        var part = localize(newPart(ring, (typeof f.name === 'string' && f.name) ? f.name : 'Pieza ' + parts.length));
        part.source = { format: 'drawn', fileName: name, entityId: 'fig-' + (i + 1) };
        part.approximationToleranceMm = curved ? tol * 10 : 0;
        part.quantity = 1;
        part.preparationPosition = [0, 0];
        parts.push(part);
      } catch (err) {
        issues.push('Figura ' + (i + 1) + ': ' + (err instanceof Error ? err.message : String(err)));
      }
    }
    if (!parts.length) throw Error('No se encontraron figuras cerradas válidas en el patron.json.');
    var document = { name: name.replace(/\.json$/i, ''), parts: parts, settings: {} };
    for (var k in DEFAULT_SETTINGS) document.settings[k] = DEFAULT_SETTINGS[k];
    if (parts.some(function (p) { return p.approximationToleranceMm > 0; })) warnings.push('Piezas con aristas curvas: se aproximaron por curvas de Bézier (0.5 mm).');
    return { document: parts.length ? normalizeDocument(document) : document, warnings: warnings, issues: issues, replace: false };
  }
  function importSparrow(text, fileName, scale) {
    if (!isFinite(scale) || scale <= 0) throw Error('Choose a positive millimeter scale.');
    var input = JSON.parse(text);
    if (typeof input.name !== 'string' || !Array.isArray(input.items) || input.items.length > 500) throw Error('Expected a sparrow ExtSPInstance with name and items.');
    var ids = {}, parts = [];
    for (var index = 0; index < input.items.length; index++) {
      var item = input.items[index], shape = item.shape, id = item.id;
      if (!Number.isSafeInteger(id) || id < 0 || ids[id]) throw Error('sparrow item IDs must be unique nonnegative safe integers.');
      ids[id] = true;
      var outer, holes = [];
      var scaled = function (ring) { return normalizeRing(ring).map(function (p) { return [p[0] * scale, p[1] * scale]; }); };
      if (shape.type === 'simple_polygon') outer = scaled(shape.data);
      else if (shape.type === 'polygon') {
        outer = scaled(shape.data.outer);
        if (shape.data.inner !== undefined && !Array.isArray(shape.data.inner)) throw Error('Polygon inner contours must be an array.');
        holes = (shape.data.inner || []).map(scaled);
      } else if (shape.type === 'rectangle') {
        var d = shape.data, x = d.x_min, y = d.y_min, w = d.width, h = d.height;
        if (!(w > 0 && h > 0)) throw Error('Rectangle dimensions must be positive.');
        outer = scaled([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]);
      } else throw Error('Item ' + id + ': ' + String(shape.type) + ' is unsupported. Disjoint JSON items cannot be split without changing demand.');
      var orientations = item.allowed_orientations;
      if (orientations !== undefined && orientations !== null && (!Array.isArray(orientations) || !orientations.length || !orientations.every(function (a) { return typeof a === 'number' && isFinite(a); }))) throw Error('Item ' + id + ': allowed_orientations must be omitted for free rotation or a nonempty degree list.');
      var part = localize(newPart(outer, 'Part ' + id));
      part.holes = holes;
      part.quantity = Number(item.demand);
      if (!Number.isInteger(part.quantity) || part.quantity < 0 || part.quantity > LIMITS.copies) throw Error('Item ' + id + ': invalid demand.');
      part.source = { format: 'sparrow', fileName: fileName, entityId: String(id) };
      part.rotations = orientations == null ? { kind: 'continuous' } : { kind: 'discrete', degrees: orientations };
      part.preparationPosition = [index * 50, 0];
      parts.push(part);
    }
    var warnings = [];
    if (input.solution !== undefined) warnings.push('Stored native solution is ignored; warm starts are not supported.');
    warnings.push('One coordinate unit = ' + scale + ' mm. Benchmark coordinates have no intrinsic manufacturing units.');
    if (parts.some(function (p) { return p.holes.length; })) warnings.push('Holes are preserved; nesting inside holes is not supported.');
    var document = { name: input.name, parts: parts, settings: {} };
    for (var k in DEFAULT_SETTINGS) document.settings[k] = DEFAULT_SETTINGS[k];
    document.settings.materialWidthMm = Number(input.strip_height) * scale;
    return { document: normalizeDocument(document), warnings: warnings, replace: false };
  }

  /* ============================================================ EXPORT
   * SVG/DXF/JSON del resultado, similares a los de la demo. */
  function worldContours(placedPieces, placed) {
    // placed: [{item_id, transformation:{rotation, translation}}]
    var out = [];
    for (var i = 0; i < placed.length; i++) {
      var p = placed[i];
      var pts = placedPieces[p.item_id].outer;
      var rot = p.transformation.rotation * Math.PI / 180;
      var c = Math.cos(rot), s = Math.sin(rot);
      var tx = p.transformation.translation[0], ty = p.transformation.translation[1];
      out.push(pts.map(function (q) { return [q[0] * c - q[1] * s + tx, q[0] * s + q[1] * c + ty]; }));
    }
    return out;
  }
  function exportSVG(stripWidth, stripHeight, placedPieces, placed, name) {
    var polygons = worldContours(placedPieces, placed);
    var TH = 6; // franja del título arriba (fuera del rectángulo)
    var r1 = function (n) { return Math.round(n * 10) / 10; };
    var s = '<?xml version="1.0" encoding="UTF-8"?>\n';
    s += '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -' + TH + ' ' + stripWidth + ' ' + (stripHeight + TH) + '" width="' + (stripWidth * 4) + '" height="' + ((stripHeight + TH) * 4) + '">\n';
    s += '<text x="1" y="-2" font-size="2.6" font-family="Arial" fill="#666">' + name + ' · tela ' + r1(stripHeight) + ' cm · longitud ' + r1(stripWidth) + ' cm</text>\n';
    s += '<rect x="0" y="0" width="' + (+stripWidth.toFixed(4)) + '" height="' + (+stripHeight.toFixed(4)) + '" fill="none" stroke="#000" stroke-width="0.3"/>\n';
    s += '<g transform="translate(0 ' + stripHeight + ') scale(1 -1)">\n';
    for (var i = 0; i < polygons.length; i++) {
      var poly = polygons[i].map(function (p) { return (+p[0].toFixed(4)) + ',' + (+p[1].toFixed(4)); }).join(' ');
      s += '<polygon points="' + poly + '" fill="' + PALETA[placed[i].item_id % PALETA.length] + '" fill-opacity="0.6" stroke="#000" stroke-width="0.2"/>\n';
    }
    s += '</g>\n';
    for (var k = 0; k < polygons.length; k++) {
      var ck = labelPoint(polygons[k]);
      s += '<text x="' + (+ck[0].toFixed(4)) + '" y="' + (+(stripHeight - ck[1]).toFixed(4)) + '" font-size="3" font-family="Arial,Helvetica,sans-serif" fill="#111" text-anchor="middle" dominant-baseline="middle">' + pieceLabel(placedPieces[placed[k].item_id], placed[k].item_id) + '</text>\n';
    }
    s += '</svg>\n';
    return s;
  }
  function exportDXF(stripWidth, stripHeight, placedPieces, placed, name) {
    var L = [];
    L.push('0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1015', '9', '$INSUNITS', '70', '5', '3', '$EXTMIN', '10', '0', '20', '0', '3', '$EXTMAX', '10', String(+stripWidth.toFixed(6)), '20', String(+stripHeight.toFixed(6)), '0', 'ENDSEC');
    L.push('0', 'SECTION', '2', 'TABLES', '0', 'TABLE', '2', 'LAYER', '70', '2', '0', 'LAYER', '2', 'PARTS', '70', '0', '62', '7', '6', 'CONTINUOUS', '0', 'ENDTAB', '0', 'ENDSEC');
    L.push('0', 'SECTION', '2', 'ENTITIES');
    var polygons = worldContours(placedPieces, placed);
    for (var i = 0; i < polygons.length; i++) {
      L.push('0', 'LWPOLYLINE', '8', 'PARTS', '90', String(polygons[i].length), '70', '1');
      for (var j = 0; j < polygons[i].length; j++) {
        L.push('10', String(+polygons[i][j][0].toFixed(6)), '20', String(+polygons[i][j][1].toFixed(6)));
      }
    }
    L.push('0', 'ENDSEC', '0', 'EOF');
    return L.join('\r\n') + '\r\n';
  }

  /* ================================================================ UI */
  var $ = function (id) { return document.getElementById(id); };

  var PALETA = ['#e57373', '#64b5f6', '#81c784', '#ffb74d', '#ba68c8', '#4db6ac', '#f06292', '#a1887f', '#f6c445', '#90a4ae', '#7986cb', '#4dd0e1'];

  // estado
  var state = {
    document: null,      // documento normalizado en cm
    fileName: null,
    warnings: [],
    issues: [],
    layers: [],
    format: '',
    appWorker: null,
    svgRequest: null,
    solveWorker: null,
    runId: 0,
    solving: false,
    lastResult: null,    // { stripWidth, stripHeight, placed, elapsedMs, seed }
    placedPieces: [],    // piezas (en el order de items del solver) para export/dibujo
    items: [],           // items del input final usado
    previewRotated: false // vista de la previsualización girada 90° (vertical)
  };

  var fmt = function (n) { return (Math.round(n * 100) / 100).toLocaleString('es-AR'); };
  var fmtTime = function (ms) { if (ms < 1000) return Math.round(ms) + ' ms'; return (ms / 1000).toFixed(1) + ' s'; };

  function status(msg, cls) { var el = $('status'); el.className = cls || ''; el.textContent = msg || ''; }

  // ------- worker para SVG (svg_paths del motor)
  var svgWorker = null;
  function ensureSvgWorker() {
    if (svgWorker) return;
    svgWorker = new Worker('nesting_worker.js', { type: 'module' });
    svgWorker.onmessage = function (ev) {
      var d = ev.data;
      if (d && d.type === 'svgpaths' && state.svgRequest && d.runId === state.svgRequest.runId) {
        var cb = state.svgRequest.cb;
        state.svgRequest = null;
        cb(d.error || null, { height: d.height, paths: d.paths });
      }
    };
  }
  function resolveSvgPaths(xml) {
    return new Promise(function (resolve, reject) {
      ensureSvgWorker();
      var runId = ++state.runId;
      state.svgRequest = { runId: runId, cb: function (err, result) { if (err) reject(Error(err)); else resolve(result); } };
      try { svgWorker.postMessage({ type: 'svg', text: xml, runId: runId }); }
      catch (e) { reject(e); }
    });
  }

  // ------- load de archivo
  function loadFile(file) {
    var reader = new FileReader();
    reader.onload = function () { handleText(String(reader.result), file.name); };
    reader.onerror = function () { status('No se pudo leer el archivo.', 'bad'); };
    reader.readAsText(file);
  }
  function handleText(text, name) {
    var lower = name.toLowerCase();
    try {
      if (lower.indexOf('.svg') !== -1) return handleSVG(text, name);
      if (lower.indexOf('.dxf') !== -1) return handleDXF(text, name);
      if (lower.indexOf('.json') === -1 && (text.trim().charAt(0) === '<')) return handleSVG(text, name);
      var data = JSON.parse(text);
      if (data.figures && Array.isArray(data.figures)) return handlePocketCad(data, name);
      if (data.items && Array.isArray(data.items) && isFinite(data.strip_height)) return handleSparrow(text, name);
      throw Error('Formato no reconocido. Se espera un patron.json de PocketCad, una instancia JSON de Sparrow, un .dxf o un .svg.');
    } catch (e) {
      status((e instanceof Error ? e.message : String(e)), 'bad');
    }
  }
  function handlePocketCad(data, name) {
    var review = importPocketCad(data, name);
    applyReview(review, 'patron PocketCad');
    $('telaW').value = 100;
  }
  function handleSparrow(text, name) {
    var scale = parseFloat($('jsonScale').value) || 10;
    var review = importSparrow(text, name, scale);
    applyReview(review, 'instancia Sparrow');
    if (isFinite(review.document.settings.materialWidthMm)) $('telaW').value = Math.round(review.document.settings.materialWidthMm * 10) / 10;
  }
  function handleDXF(text, name) {
    var scale = parseFloat($('dxfScale').value) || 1;
    var tolerance = parseFloat($('dxfTol').value) || 0.1;
    var review = importDXF(text, name, { scale: scale, tolerance: tolerance, enclosed: 'holes' });
    applyReview(review, 'DXF');
    $('telaW').value = 100;
  }
  async function handleSVG(text, name) {
    status('Resolviendo SVG con el motor wasm…', 'working');
    var scale = parseFloat($('svgScale').value) || 10;
    var tolerance = parseFloat($('svgTol').value) || 0.1;
    try {
      var prep = importSVG(text, name, scale, tolerance);
      var resolved = await resolveSvgPaths(prep.xml);
      var review = processSVGResolved(resolved, prep.mmScale / 10, tolerance / 10, name, prep.warnings);
      // mmScale y tolerancia del port llegan en mm; el módulo trabaja en cm.
      applyReview(review, 'SVG');
      $('telaW').value = 160;
    } catch (e) {
      status((e instanceof Error ? e.message : String(e)), 'bad');
    }
  }
  function applyReview(review, format) {
    state.document = review.document;
    state.format = format;
    state.warnings = review.warnings || [];
    state.issues = review.issues || [];
    state.layers = review.layers || [];
    renderParts();
    var msg = '<b>' + sanitize(state.document.name || 'documento') + '</b> · ' + format + ' · ' + state.document.parts.length + ' tipos de pieza.';
    var meta = [];
    if (state.warnings.length) meta = meta.concat(state.warnings.slice(0, 3));
    if (state.issues.length) meta = meta.concat(state.issues.slice(0, 3));
    var info = $('piezasInfo');
    info.innerHTML = msg + (meta.length ? '<br><span class="dim">' + sanitize(meta.join('<br>')) + '</span>' : '');
    $('curveWarn').style.display = (state.document.parts.some(function (p) { return p.approximationToleranceMm > 0; }) || state.format === 'SVG') ? 'block' : 'none';
    status('Piezas listas. Ajustá cantidad y ancho de tela, luego Resolver.', 'ok');
    $('telaW').value = Math.round(state.document.settings.materialWidthMm) || 160;
  }
  function sanitize(n) { return String(n).replace(/[<>&"]/g, function (c) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]; }); }

  // ------- tabla de piezas
  function bboxOf(ring) { var b = bounds(ring); return [b[2] - b[0], b[3] - b[1]]; }
  function partThumb(outer) {
    var b = bounds(outer), w = b[2] - b[0], h = b[3] - b[1];
    var S = 52, pad = 6, scale = Math.min((S - pad * 2) / (w || 1), (S - pad * 2) / (h || 1)) || 1;
    var x0 = (S - w * scale) / 2, y0 = (S - h * scale) / 2;
    var pts = outer.map(function (q) { return (+(x0 + (q[0] - b[0]) * scale).toFixed(2)) + ',' + (+(y0 + (h - (q[1] - b[1])) * scale).toFixed(2)); }).join(' ');
    return '<svg viewBox="0 0 ' + S + ' ' + S + '" width="' + S + '" height="' + S + '" aria-hidden="true"><polygon points="' + pts + '" fill="#dbe7fa" fill-opacity="0.7" stroke="#2c5fb4" stroke-width="2"/></svg>';
  }
  function renderParts() {
    var tbody = document.querySelector('#piezasTable tbody');
    tbody.innerHTML = '';
    var doc = state.document;
    if (!doc) return;
    var seq = 0;
    for (var i = 0; i < doc.parts.length; i++) {
      var p = doc.parts[i];
      var bb = bboxOf(p.outer);
      var tr = document.createElement('tr');
      var td0 = document.createElement('td');
      td0.className = 'idx';
      td0.textContent = seq;
      var td1 = document.createElement('td');
      td1.className = 'thumb';
      td1.innerHTML = partThumb(p.outer);
      var td2 = document.createElement('td');
      var nm = document.createElement('input');
      nm.type = 'text'; nm.value = p.name; nm.maxLength = 60;
      nm.title = 'Editar nombre de la pieza';
      nm.addEventListener('input', function (part, el) { return function () { part.name = el.value || part.id; }; }(p, nm));
      td2.appendChild(nm);
      var dim = document.createElement('div');
      dim.className = 'dim';
      dim.textContent = fmt(bb[0]) + ' × ' + fmt(bb[1]) + ' cm';
      td2.appendChild(dim);
      var td3 = document.createElement('td');
      var inp = document.createElement('input');
      inp.type = 'number'; inp.min = 0; inp.max = 500; inp.value = p.quantity;
      inp.addEventListener('input', function (q, el) { return function () { q.quantity = clampDemand(el.value); }; }(p, inp));
      td3.appendChild(inp);
      tr.appendChild(td0); tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3);
      tbody.appendChild(tr);
      if (p.quantity >= 1) seq++;
    }
    $('tablaWrap').classList.remove('hidden');
  }
  function clampDemand(v) {
    var n = parseInt(v, 10);
    if (isNaN(n) || n < 1) return 1;
    return Math.min(n, 500);
  }

  // ------- solver
  function rotationValues() {
    var v = document.querySelector('input[name="rot"]:checked');
    var sel = v ? v.value : '180';
    if (sel === '0') return [0];
    if (sel === '180') return [0, 180];
    if (sel === '90') return [0, 90, 180, 270];
    return null;
  }
  function buildInput() {
    var doc = state.document;
    if (!doc || !doc.parts.length) { status('Cargá un archivo primero.', 'bad'); return null; }
    var items = [], placedPieces = [];
    for (var i = 0; i < doc.parts.length; i++) {
      if (doc.parts[i].quantity < 1) continue;
      var id = placedPieces.length;
      placedPieces.push(doc.parts[i]);
      var item = { id: id, demand: doc.parts[i].quantity, shape: { type: 'simple_polygon', data: doc.parts[i].outer } };
      var rots = rotationValues();
      if (rots) item.allowed_orientations = rots;
      items.push(item);
    }
    if (!items.length) { status('Sumá al menos 1 copia de alguna pieza.', 'bad'); return null; }
    var telaW = parseFloat($('telaW').value);
    if (!(telaW > 0)) { status('El ancho de tela debe ser mayor a 0.', 'bad'); return null; }
    state.placedPieces = placedPieces;
    return { input: JSON.stringify({ name: doc.name, strip_height: telaW, items: items }), telaW: telaW, items: items };
  }
  function solve() {
    if (state.solving) { stop(); return; }
    var built = buildInput();
    if (!built) return;
    var clearance = parseFloat($('clearanceW').value) || 0;
    if (clearance >= built.telaW) { status('La separación debe ser menor que el ancho de tela.', 'bad'); return; }
    var seed = parseInt($('seed').value, 10) || 1;
    var preset = 'standard';
    var pe = document.querySelector('input[name="preset"]:checked');
    if (pe) preset = pe.value;
    var timeSel = $('timeSel').value;
    var seconds = timeSel === '' ? undefined : parseInt(timeSel, 10);

    var total = built.items.reduce(function (a, it) { return a + it.demand; }, 0);
    state.solving = true;
    state.runId++;
    var id = state.runId;
    $('run').classList.add('hidden');
    $('stop').classList.remove('hidden');
    status('Calculando… ' + total + ' piezas · tela ' + fmt(built.telaW) + ' cm', 'working');
    if (state.solveWorker) state.solveWorker.terminate();
    try {
      var w = new Worker('nesting_worker.js', { type: 'module' });
    } catch (e) {
      status('Este navegador no soporta workers de módulo.', 'bad');
      state.solving = false; stopUI();
      return;
    }
    w.onmessage = function (ev) { var d = ev.data; if (d && d.runId === id) onSolverMessage(d.message, built.telaW, seed); };
    w.onerror = function (ev) { stopUI(); status('Error del worker: ' + ((ev && ev.message) || 'desconocido'), 'bad'); };
    state.solveWorker = w;
    w.postMessage({ type: 'solve', input: built.input, seconds: seconds, seed: String(seed), clearance: clearance, preset: preset, runId: id });
  }
  var lastLive = 0;
  function onSolverMessage(m, telaW, seed) {
    if (!m) return;
    if (m.type === 'phase') { $('stFase').textContent = (m.phase === 'Exploration' ? 'Exploración' : 'Compresión'); return; }
    if (m.type === 'live') {
      var now = m.elapsedMs || 0;
      if (now - lastLive < 300 || !m.solution || !m.solution.layout) return;
      lastLive = now;
      registerCandidate(m, telaW, seed, 'live');
      return;
    }
    if (m.type === 'candidate') registerCandidate(m, telaW, seed);
    else if (m.type === 'error') { stopUI(); status('El motor devolvió un error: ' + m.message, 'bad'); }
    else if (m.type === 'finished') {
      stopUI();
      if (state.lastResult) status('Terminado. Largo usado: ' + fmt(state.lastResult.stripWidth) + ' cm en ' + fmtTime(state.lastResult.elapsedMs), 'ok');
      else status('Terminado sin resultados válidos. Probá más tiempo u otra semilla.', 'bad');
    }
  }
  function registerCandidate(m, telaW, seed, fase) {
    var sol = m.solution || {};
    var layout = sol.layout || {};
    var placed = layout.placed_items || [];
    var res = { stripWidth: sol.strip_width, stripHeight: telaW, elapsedMs: m.elapsedMs || 0, placed: placed, seed: seed, phase: fase || 'candidate' };
    state.lastResult = res;
    $('stats').classList.remove('hidden');
    $('stLargo').textContent = fmt(res.stripWidth || 0) + ' cm';
    $('stAncho').textContent = fmt(telaW) + ' cm';
    $('stPiezas').textContent = placed.length;
    $('stTime').textContent = fmtTime(res.elapsedMs);
    var areaTotal = 0;
    for (var i = 0; i < state.placedPieces.length; i++) {
      var p = state.placedPieces[i];
      areaTotal += Math.abs(area(p.outer)) * p.quantity;
    }
    var occ = (res.stripWidth && telaW) ? areaTotal / (res.stripWidth * telaW) : 0;
    $('stOcup').textContent = (occ * 100).toFixed(1) + ' %';
    drawResult(res);
  }
  function stop() {
    if (state.solveWorker) state.solveWorker.terminate();
    state.solveWorker = null;
    stopUI();
    status('Detenido.', 'working');
  }
  function stopUI() {
    state.solving = false;
    $('run').classList.remove('hidden');
    $('stop').classList.add('hidden');
  }

  // ------- dibujo del resultado (SVG interno, unidades en cm)
  function drawResult(res) {
    var host = $('result');
    var W = res.stripHeight;         // ancho de tela (cm)
    var L = res.stripWidth;          // longitud usada (cm)
    if (!L || !W) { host.innerHTML = ''; return; }
    var rot = !!state.previewRotated;
    // rollo acostado: el largo L va a la derecha (horizontal), el ancho W hacia
    // abajo. Al activar rot la vista se pone de pie (vertical, para el móvil).
    var maxH = rot ? 4000 : 480;
    var maxW = rot ? (host.clientWidth || 480) : 760;
    var scale = Math.min(maxH / (rot ? L : W), maxW / (rot ? W : L)) || 1;
    var svgW = Math.max(80, Math.round((rot ? W : L) * scale));
    var svgH = Math.max(120, Math.round((rot ? L : W) * scale));
    var paths = '', labels = '';
    var poly = worldContours(state.placedPieces, res.placed);
    for (var i = 0; i < poly.length; i++) {
      var p = poly[i].map(function (q) { return (+q[0].toFixed(3)) + ',' + (+q[1].toFixed(3)); }).join(' ');
      paths += '<polygon shape-rendering="geometricPrecision" points="' + p + '" fill="' + PALETA[res.placed[i].item_id % PALETA.length] + '" fill-opacity="0.6" stroke="#000" stroke-width="0.2"/>';
      var c = labelPoint(poly[i]);
      labels += '<text x="' + (+c[0].toFixed(3)) + '" y="' + (+(W - c[1]).toFixed(3)) + '" font-size="3" font-family="Arial,Helvetica,sans-serif" fill="#111" text-anchor="middle" dominant-baseline="middle">' + pieceLabel(state.placedPieces[res.placed[i].item_id], res.placed[i].item_id) + '</text>';
    }
    var vw = rot ? W : L, vh = rot ? L : W;
    // rot=vista girada 90° en sentido antihorario: matrix(0 1 -1 0 W 0) mapea
    // el área plana (L×W, y hacia arriba) a un viewBox vertical (W×L).
    var rotM = rot ? ' matrix(0 1 -1 0 ' + (+W.toFixed(3)) + ' 0)' : '';
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + (+vw.toFixed(3)) + ' ' + (+vh.toFixed(3)) + '" preserveAspectRatio="xMidYMid meet" class="nesting-svg">'
      + '<g transform="translate(0 0)' + rotM + '">'
      + '<rect x="0" y="0" width="' + (+L.toFixed(3)) + '" height="' + (+W.toFixed(3)) + '" fill="none" stroke="#000" stroke-width="0.3"/>'
      + '<g transform="translate(0 ' + (+W.toFixed(3)) + ') scale(1 -1)">' + paths + '</g>' + labels
      + '</g></svg>';
    host.innerHTML = svg;
    host.querySelector('svg').style.width = svgW + 'px';
    host.querySelector('svg').style.height = svgH + 'px';
  }
  function pointInRing(px, py, ring) {
    var inside = false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }
  function distToSeg(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay;
    var t = (dx * dx + dy * dy) ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))) : 0;
    var qx = ax + t * dx, qy = ay + t * dy;
    return Math.hypot(px - qx, py - qy);
  }
  // Punto interior bien centrado. Pasada 1: mallado grueso del mayor círculo
  // inscrito; pasada 2: afina con mallado fino alrededor del mejor candidato.
  function labelPoint(ring) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var i = 0; i < ring.length; i++) {
      minX = Math.min(minX, ring[i][0]); minY = Math.min(minY, ring[i][1]);
      maxX = Math.max(maxX, ring[i][0]); maxY = Math.max(maxY, ring[i][1]);
    }
    var sc = centroid(ring);
    // distancia mínima a los bordes
    function md(px, py) {
      var d = Infinity;
      for (var j = 0; j < ring.length - 1; j++) d = Math.min(d, distToSeg(px, py, ring[j][0], ring[j][1], ring[j + 1][0], ring[j + 1][1]));
      return d;
    }
    // barrido sobre una caja regular
    function scan(step, cx, cy, span) {
      var best = null, bestD = -1;
      for (var x = cx - span; x <= cx + span + 1e-9; x += step) {
        for (var y = cy - span; y <= cy + span + 1e-9; y += step) {
          if (!pointInRing(x, y, ring)) continue;
          var d = md(x, y);
          if (d > bestD) { bestD = d; best = [x, y]; }
        }
      }
      return best ? [best, bestD] : null;
    }
    // paso 1: mallado 12x12 sobre el bbox
    var sx = (maxX - minX) / 12, sy = (maxY - minY) / 12;
    var r1 = scan(Math.max(sx, sy) * 0.5, (minX + maxX) / 2, (minY + maxY) / 2, (maxX - minX) / 2);
    var center = r1 ? r1[0] : sc;
    // paso 2: afinado 5x5 cerca del mejor punto
    var span2 = Math.max(sx, sy) * 0.6 || 0.1;
    var r2 = scan(span2 / 5, center[0], center[1], span2);
    var p = r2 ? r2[0] : center;
    // pivote: si no encontramos punto interior, caer al centroide si adentro
    if (!pointInRing(p[0], p[1], ring)) p = pointInRing(sc[0], sc[1], ring) ? sc : ring[0];
    // acercar un toque al centro (evita quedar pegado a un borde fino)
    var cx = (p[0] + sc[0]) / 2, cy = (p[1] + sc[1]) / 2;
    if (pointInRing(cx, cy, ring) && md(cx, cy) >= md(p[0], p[1]) * 0.5) p = [cx, cy];
    return p;
  }
  function centroid(ring) {
    var x = 0, y = 0;
    for (var i = 0; i < ring.length; i++) { x += ring[i][0]; y += ring[i][1]; }
    return [x / ring.length, y / ring.length];
  }
  // Etiqueta de pieza para resultados: si el usuario renombró la pieza (nombre
  // distinto del default "Pieza N") muestra su nombre; si no, el número.
  function pieceLabel(part, id) {
    if (!part) return String(id);
    var d = part.name !== undefined && part.name !== null ? String(part.name) : '';
    if (!d || /^(Pieza|Part)\s*\d*$/.test(d)) return String(id);
    return d.length > 12 ? d.slice(0, 11) + '…' : d;
  }

  // ------- export
  function download(name, content, mime) {
    var blob = new Blob([content], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 3000);
  }
  function baseName() {
    var b = 'tizada';
    if (state.lastResult) b += '_s' + state.lastResult.seed + '_' + state.lastResult.stripWidth.toFixed(2) + 'cm';
    var d = new Date();
    b += '_' + d.getFullYear() + (d.getMonth() + 1) + d.getDate() + '_' + ('0' + d.getHours()).slice(-2) + ('0' + d.getMinutes()).slice(-2);
    return b;
  }
  function doExport(kind) {
    if (!state.lastResult) { status('Primero resolvé.', 'bad'); return; }
    var res = state.lastResult;
    if (kind === 'svg') download(baseName() + '.svg', exportSVG(res.stripWidth, res.stripHeight, state.placedPieces, res.placed, state.document.name), 'image/svg+xml');
    else if (kind === 'dxf') download(baseName() + '.dxf', exportDXF(res.stripWidth, res.stripHeight, state.placedPieces, res.placed, state.document.name), 'application/dxf');
    else status(kind, 'bad');
  }
  function doExportJson() {
    if (!state.lastResult) { status('Primero resolvé.', 'bad'); return; }
    var res = state.lastResult;
    var obj = {
      motor: 'sparrow (sparrow-studio)',
      anchoTelaCm: res.stripHeight, largoCm: res.stripWidth,
      piezasColocadas: res.placed.length,
      ocupacionPct: (res.stripWidth && res.stripHeight) ? +(Math.round(solveArea() / (res.stripWidth * res.stripHeight) * 1000) / 10) : null,
      tiempoMs: res.elapsedMs, semilla: res.seed,
      placements: res.placed.map(function (p) {
        return { item_id: p.item_id, rotationDeg: p.transformation.rotation, translation: p.transformation.translation };
      })
    };
    download(baseName() + '.json', JSON.stringify(obj, null, 2), 'application/json');
  }
  function solveArea() {
    var a = 0;
    for (var i = 0; i < state.placedPieces.length; i++) a += Math.abs(area(state.placedPieces[i].outer)) * state.placedPieces[i].quantity;
    return a;
  }

  // ------- ejemplo integrado (mismas piezas que la demo de sparrow-studio)
  function example() {
    var shapes = [
      [[0, 0], [36, 0], [36, 12], [12, 12], [12, 38], [0, 38]],
      [[0, 0], [28, 0], [36, 20], [14, 32], [0, 20]],
      [[0, 0], [38, 0], [38, 10], [26, 10], [26, 26], [12, 26], [12, 10], [0, 10]],
      [[0, 0], [30, 0], [34, 42], [20, 50], [6, 46], [0, 40]]
    ];
    var names = ['Bracket', 'Shield', 'Tab', 'Plate'];
    var parts = shapes.map(function (ring, i) {
      var p = localize(newPart(normalizeRing(ring), names[i]));
      p.source = { format: 'drawn', fileName: 'ejemplo', entityId: 'ex-' + (i + 1) };
      p.quantity = 3;
      p.preparationPosition = [0, 0];
      return p;
    });
    state.document = { name: 'Ejemplo', parts: parts, settings: {} };
    for (var k in DEFAULT_SETTINGS) state.document.settings[k] = DEFAULT_SETTINGS[k];
    state.document.settings.materialWidthMm = 100;
    state.fileName = 'ejemplo';
    state.warnings = [], state.issues = [], state.layers = [];
    state.format = 'ejemplo';
    renderParts();
    $('telaW').value = 100;
    $('curveWarn').style.display = 'none';
    $('piezasInfo').innerHTML = '<b>Ejemplo</b> &middot; 4 piezas de muestra &times; 3 copias cada una.';
    status('Ejemplo cargado. Presiona Resolver.', 'ok');
  }

  // ------- init
  function bindChips(container) {
    container.addEventListener('click', function (e) {
      var lb = e.target.closest('label');
      if (!lb || !container.contains(lb)) return;
      var inp = lb.querySelector('input');
      if (inp) inp.checked = true;
      Array.prototype.forEach.call(container.querySelectorAll('label'), function (x) { x.classList.remove('sel'); });
      lb.classList.add('sel');
    });
  }
  function init() {
    bindChips($('rotSel'));
    bindChips($('presetSel'));
    $('btnSample').onclick = example;
    $('btnFile').onclick = function () { $('file').click(); };
    $('file').onchange = function () { var f = this.files && this.files[0]; if (f) loadFile(f); this.value = ''; };
    var fbox = $('filebox');
    fbox.onclick = function () { $('file').click(); };
    fbox.addEventListener('dragover', function (e) { e.preventDefault(); fbox.classList.add('on'); });
    fbox.addEventListener('dragleave', function () { fbox.classList.remove('on'); });
    fbox.addEventListener('drop', function (e) {
      e.preventDefault(); fbox.classList.remove('on');
      var f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) loadFile(f);
    });
    $('run').onclick = solve;
    $('stop').onclick = stop;
    $('btnSvg').onclick = function () { doExport('svg'); };
    $('btnDxf').onclick = function () { doExport('dxf'); };
    $('btnJson').onclick = doExportJson;
    $('btnRotate').onclick = function () {
      state.previewRotated = !state.previewRotated;
      if (state.lastResult) drawResult(state.lastResult);
      $('btnRotate').textContent = state.previewRotated ? '↺ Horizontal' : '↻ Vertical';
    };
    example();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();