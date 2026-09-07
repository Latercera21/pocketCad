/* Worker: carga el motor Sparrow (wasm de sparrow-studio) y resuelve.
 * Mensajes:
 *   {type:"solve", input:string, seconds?:number, seed:string, clearance:number, preset:string, runId:number}
 * Devuelve self.postMessage({type:"solver", runId, message}) con mensajes
 * phase / candidate / live / finished / error (mismos que sparrow-studio). */
import init, { run } from "./wasm/nesting.wasm.js";

var ready = null;

self.onmessage = async function (ev) {
  var msg = ev.data;
  if (!msg || msg.type !== "solve") return;
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