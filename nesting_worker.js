/* Worker: carga el motor Sparrow (wasm de sparrow-studio) y resuelve.
 * Mensajes:
 *   {type:"solve", input:string, seconds?:number, seed:string, clearance:number, preset:string, runId:number}
 *   -> responde {type:"solver", runId, message} con phase/candidate/live/finished/error
 *   {type:"svg", text:string, runId:number}
 *   -> responde {type:"svgpaths", runId, height, paths} usando svg_paths (wasm),
 *      util para importar SVG fiel (sparrowstudio.app usa este mismo motor). */
import init, { run, svg_paths } from "./wasm/nesting.wasm.js";

var ready = null;

self.onmessage = async function (ev) {
  var msg = ev.data;
  if (!msg) return;

  if (msg.type === "svg") {
    if (!ready) ready = init(new URL("./wasm/nesting.wasm", import.meta.url));
    try {
      await ready;
      var svg = svg_paths(msg.text);
      var parsed;
      try { parsed = JSON.parse(svg); } catch (e) { parsed = { height: 0, paths: [] }; }
      self.postMessage({ type: "svgpaths", runId: msg.runId, height: parsed.height, paths: parsed.paths });
    } catch (err) {
      self.postMessage({
        type: "svgpaths", runId: msg.runId,
        error: String((err && err.message) || err)
      });
    }
    return;
  }

  if (msg.type !== "solve") return;
  if (!ready) ready = init(new URL("./wasm/nesting.wasm", import.meta.url));
  try {
    await ready;
    var t0 = performance.now();
    run(msg.input, msg.seconds, msg.seed, msg.clearance, msg.preset, function (json) {
      var m;
      try { m = JSON.parse(json); } catch (e) { return; }
      m.elapsedMs = performance.now() - t0;
      self.postMessage({ type: "solver", runId: msg.runId, message: m });
    });
  } catch (err) {
    self.postMessage({
      type: "solver", runId: msg.runId,
      message: { type: "error", message: String((err && err.message) || err) }
    });
  }
};