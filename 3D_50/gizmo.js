/* gizmo.js — anillos de giro (X Y Z) y cubo de escala alrededor de la pieza seleccionada */
const Gizmo = (function () {
  const G = { group: null, R: 20 };
  let root, rings = [], box;
  const AX = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
  G.init = function (scene) {
    root = new THREE.Group(); root.visible = false; scene.add(root);
    [0xff5555, 0x55dd66, 0x5599ff].forEach((col, a) => {
      const p = []; for (let i = 0; i <= 64; i++) { const t = i / 64 * Math.PI * 2, c = Math.cos(t), s = Math.sin(t); p.push(a === 0 ? new THREE.Vector3(0, c, s) : a === 1 ? new THREE.Vector3(c, 0, s) : new THREE.Vector3(c, s, 0)); }
      const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(p), new THREE.LineBasicMaterial({ color: col, depthTest: false, transparent: true, opacity: 0.9 }));
      l.renderOrder = 20; l.userData.axis = a; rings.push(l); root.add(l);
    });
    box = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.13), new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false })); box.position.set(0, 1.18, 0); box.renderOrder = 21; root.add(box);
  };
  G.attach = (group, R) => { G.group = group; G.R = R; };
  G.show = b => { root.visible = !!b && !!G.group; };
  G.visible = () => root.visible;
  G.update = function () {
    if (!G.group) return; root.position.copy(G.group.position); root.scale.setScalar(G.R * G.group.scale.x);
  };
  /* devuelve un controlador si el rayo toca un anillo o el cubo */
  G.pick = function (rc, cam, ev) {
    if (!root.visible) return null;
    rc.params.Line.threshold = 0.09; root.updateMatrixWorld(true);
    const h = rc.intersectObjects([box, ...rings], false)[0]; if (!h) return null;
    const g = G.group, c = g.position.clone();
    if (h.object === box) {
      const pl = new THREE.Plane().setFromNormalAndCoplanarPoint(cam.getWorldDirection(new THREE.Vector3()).clone(), c), s0 = g.scale.x, v = new THREE.Vector3();
      const r0 = rc.ray.intersectPlane(pl, v) ? v.distanceTo(c) : 1;
      return { move(r) { if (r.ray.intersectPlane(pl, v)) g.scale.setScalar(Math.max(0.2, Math.min(6, s0 * v.distanceTo(c) / Math.max(r0, 1e-3)))); } };
    }
    /* Giro por arrastre en pantalla: el ángulo sale del movimiento del puntero a lo largo de la tangente del anillo
       (en píxeles), no de la intersección con el plano del anillo, que se dispara cuando el anillo se ve de canto. */
    const ax = AX[h.object.userData.axis], rv = h.point.clone().sub(c), R = rv.length();
    const sc = v => { const q = v.clone().project(cam); return [(q.x * .5 + .5) * innerWidth, (-q.y * .5 + .5) * innerHeight]; };
    const pxR = Math.max(60, cam.isOrthographicCamera ? R * innerHeight / (cam.top - cam.bottom) : R * innerHeight / (2 * Math.tan(cam.fov * Math.PI / 360) * cam.position.distanceTo(c)));
    let dir = [1, 0];
    const upDir = () => {
      const t = new THREE.Vector3().crossVectors(ax, rv).normalize(), p0 = c.clone().add(rv), a = sc(p0), b = sc(p0.clone().addScaledVector(t, R * 0.05));
      const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy); if (l > 1) dir = [dx / l, dy / l];   // si el anillo está de canto, se conserva la dirección anterior
    };
    upDir(); let px = ev ? ev.x : 0, py = ev ? ev.y : 0;
    return { move(r, e) {
      if (!e) return;
      const d = Math.max(-0.2, Math.min(0.2, ((e.x - px) * dir[0] + (e.y - py) * dir[1]) / pxR)); px = e.x; py = e.y;
      g.rotateOnWorldAxis(ax, d); rv.applyAxisAngle(ax, d); upDir();
    } };
  };
  return G;
})();
