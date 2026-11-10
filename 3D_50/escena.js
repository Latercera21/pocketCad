/* escena.js — render, luces, piso con rejilla, cámara libre (orbit sin límites / pan / zoom).
   Las herramientas se enganchan con E.ctrl(rc,ev) -> controlador {move(rc,ev), up(moved)} o null. */
const Escena = (function () {
  const E = { dirty: true, theta: 0.5, phi: 0.55, dist: 100, target: new THREE.Vector3(0, 6, 0), ctrl: null, onTapEmpty: null, beforeRender: null, follow: null, bgs: {}, bgMem: {}, viewName: null, viewBack: false };
  let renderer, scene, cam, camP, camO, shadow, frameFn = null, last = 0;
  const ptrs = new Map();
  let mode = 'orbit', tap = null, ctl = null, moved = false, pinch0 = 0, mid0 = [0, 0];

  function updateCam() {
    E.phi = Math.max(-1.56, Math.min(1.56, E.phi));
    const cp = Math.cos(E.phi);
    cam.position.set(E.target.x + E.dist * Math.sin(E.theta) * cp, E.target.y + E.dist * Math.sin(E.phi), E.target.z + E.dist * Math.cos(E.theta) * cp);
    cam.up.set(0, 1, 0);
    if (cam === camO) { const h = E.dist * Math.tan(25 * Math.PI / 180), a = innerWidth / innerHeight; camO.left = -h * a; camO.right = h * a; camO.top = h; camO.bottom = -h; camO.updateProjectionMatrix(); }
    cam.lookAt(E.target); cam.updateMatrixWorld(); E.dirty = true;
  }
  function pan(dx, dy) {
    const k = 2 * Math.tan((cam.isOrthographicCamera ? 50 : cam.fov) * Math.PI / 360) * E.dist / innerHeight;
    const r = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0), u = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
    E.target.addScaledVector(r, -dx * k); E.target.addScaledVector(u, dy * k); updateCam();
  }
  E.rc = function (x, y) { const r = new THREE.Raycaster(); r.setFromCamera(new THREE.Vector2(x / innerWidth * 2 - 1, -y / innerHeight * 2 + 1), cam); return r; };
  E.screen = function (v) { const q = v.clone().project(cam); return q.z > 1 ? null : [(q.x * .5 + .5) * innerWidth, (-q.y * .5 + .5) * innerHeight]; };
  E.fit = function (ext) { E.dist = ext * 1.3 / (2 * Math.tan(camP.fov * Math.PI / 360) * Math.min(1, camP.aspect)); E.theta = 0.5; E.phi = 0.55; updateCam(); };
  E.setTarget = (x, y, z) => { E.target.set(x, y, z); updateCam(); };
  /* vistas ortogonales (fov chico = casi ortográfica, útil para calcar) y fondos de referencia por vista */
  E.persp = () => { if (cam !== camP) { cam = camP; E.cam = cam; updateCam(); } E.viewName = null; };
  E.view = name => {   // vista bloqueada; pulsar la misma vista otra vez muestra el lado opuesto
    if (!['front', 'side', 'top'].includes(name)) return; const back = E.viewName === name && !E.viewBack; E.viewBack = back;
    E.theta = name === 'top' ? 0 : (name === 'side' ? Math.PI / 2 : 0) + (back ? Math.PI : 0); E.phi = name === 'top' ? (back ? -1.56 : 1.56) : 0;
    cam = camO; E.cam = cam; E.viewName = name; updateCam();
  };
  E.bgRemove = view => { const m = E.bgs[view]; if (!m) return; E.bgMem[view] = { p: m.position.clone(), h: m.scale.y, o: m.material.opacity }; scene.remove(m); if (m.material.map) m.material.map.dispose(); m.material.dispose(); m.geometry.dispose(); delete E.bgs[view]; E.dirty = true; };
  E.bgLoad = (view, url, ext, c, cb) => {
    new THREE.TextureLoader().load(url, tex => {
      E.bgRemove(view); const im = tex.image, asp = (im.width || 1) / (im.height || 1), sz = ext * 1.3, k = ext * 0.8;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }));
      m.scale.set(sz * asp, sz, 1); m.renderOrder = -1;
      if (view === 'front') m.position.set(c.x, c.y, c.z - k);
      else if (view === 'side') { m.rotation.y = Math.PI / 2; m.position.set(c.x - k, c.y, c.z); }
      else { m.rotation.x = -Math.PI / 2; m.position.set(c.x, c.y - 2, c.z); }
      const mem = E.bgMem[view]; if (mem) { m.position.copy(mem.p); m.scale.set(mem.h * asp, mem.h, 1); m.material.opacity = mem.o; }   // recuerda posición, tamaño y opacidad
      scene.add(m); E.bgs[view] = m; E.dirty = true; if (cb) cb();
    });
  };

  E.init = function () {
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setSize(innerWidth, innerHeight); renderer.setClearColor(0x5b606b);
    document.body.insertBefore(renderer.domElement, document.body.firstChild);
    scene = new THREE.Scene(); cam = camP = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.2, 6000); camO = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 6000);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8890a0, 0.9));
    const dl = new THREE.DirectionalLight(0xffffff, 0.7); dl.position.set(60, 140, 80); scene.add(dl);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshBasicMaterial({ color: 0x8b93a3, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
    floor.rotation.x = -Math.PI / 2; scene.add(floor);
    const g1 = new THREE.GridHelper(600, 60, 0xe4e8f0, 0xc2c8d4); g1.position.y = 0.05; scene.add(g1);
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(0,0,0,.4)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.08; scene.add(shadow);
    E.scene = scene; E.cam = cam; E.shadow = shadow; bind(); updateCam();
    addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camP.aspect = innerWidth / innerHeight; camP.updateProjectionMatrix(); updateCam(); });
  };
  E.start = function (fn) {
    frameFn = fn;
    (function loop(now) {
      requestAnimationFrame(loop); const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
      if (frameFn) frameFn(dt);
      if (E.dirty) {
        if (E.follow) { shadow.position.x = E.follow.position.x; shadow.position.z = E.follow.position.z; }
        if (E.beforeRender) E.beforeRender();
        renderer.render(scene, cam); E.dirty = false;
      }
    })(0);
  };

  function bind() {
    const cv = renderer.domElement; cv.style.touchAction = 'none';
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('mousedown', e => { if (e.button === 1) e.preventDefault(); });
    cv.addEventListener('pointerdown', e => {
      cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 2) { tap = null; ctl = null; mode = 'pinch'; const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); mid0 = [(a.x + b.x) / 2, (a.y + b.y) / 2]; return; }
      tap = { x: e.clientX, y: e.clientY, t: performance.now() }; mode = 'orbit'; ctl = null; moved = false;
      if (e.button === 1 || e.button === 2) { mode = 'pan'; return; }
      if (E.ctrl) { const c = E.ctrl(E.rc(e.clientX, e.clientY), { x: e.clientX, y: e.clientY }); if (c) { ctl = c; mode = 'ctl'; } }
    });
    cv.addEventListener('pointermove', e => {
      const p = ptrs.get(e.pointerId); if (!p) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()], pn = Math.hypot(a.x - b.x, a.y - b.y), m = [(a.x + b.x) / 2, (a.y + b.y) / 2];
        E.dist = Math.max(1.5, Math.min(3000, E.dist * (1 - (pn - pinch0) * 0.004))); pan(m[0] - mid0[0], m[1] - mid0[1]); pinch0 = pn; mid0 = m; updateCam(); return;
      }
      if (mode === 'ctl') {
        if (!moved && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > 5) moved = true;
        if (moved && ctl.move) { ctl.move(E.rc(e.clientX, e.clientY), { x: e.clientX, y: e.clientY }); E.dirty = true; }
      } else if (mode === 'pan') pan(dx, dy);
      else if (mode === 'orbit') { if (E.viewName) pan(dx, dy); else { if (cam !== camP) E.persp(); E.theta -= dx * 0.006; E.phi += dy * 0.005; updateCam(); } }
    });
    const up = e => {
      ptrs.delete(e.pointerId);
      if (e.type === 'pointerup' && mode === 'ctl' && ctl) { if (ctl.up) ctl.up(moved); E.dirty = true; }
      else if (e.type === 'pointerup' && mode === 'orbit' && tap && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 8 && performance.now() - tap.t < 600 && E.onTapEmpty) E.onTapEmpty(e.clientX, e.clientY);
      if (!ptrs.size) { mode = 'orbit'; ctl = null; tap = null; } else if (ptrs.size === 1) { mode = 'orbit'; ctl = null; }
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', e => { e.preventDefault(); E.dist = Math.max(1.5, Math.min(3000, E.dist * Math.exp(e.deltaY * 0.001))); updateCam(); }, { passive: false });
  }
  return E;
})();
