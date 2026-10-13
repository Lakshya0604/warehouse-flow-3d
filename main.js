import * as THREE from 'three';
import { OrbitControls } from './OrbitControls.js';

/* ---------- renderer / scene ---------- */
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a2029);
scene.fog = new THREE.Fog(0x1a2029, 34, 80);

const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 200);
const views = [
  { p: [9, 7.5, 12], t: [0, 2.0, 0] },
  { p: [-13, 5, 6], t: [-2, 1.2, 0] },
  { p: [0, 18, 0.01], t: [0, 0, 0] },
  { p: [10, 2.2, 7], t: [3, 3.4, 0] },
];
let viewIdx = 0;
camera.position.set(...views[0].p);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(...views[0].t);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 4;
controls.maxDistance = 40;

/* ---------- lights ---------- */
scene.add(new THREE.HemisphereLight(0xdfe9ff, 0x4a505a, 1.1));
const sun = new THREE.DirectionalLight(0xfff1dd, 2.2);
sun.position.set(6, 22, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 12, bottom: -12, near: 1, far: 50 });
sun.shadow.bias = -0.0004;
scene.add(sun);
const warm = new THREE.PointLight(0xffb36b, 18, 14, 2); warm.position.set(0, 5.2, 1.5); scene.add(warm);

/* ---------- materials ---------- */
const M = {
  floor: new THREE.MeshStandardMaterial({ color: 0x4a525e, roughness: 0.9, metalness: 0.02 }),
  steel: new THREE.MeshStandardMaterial({ color: 0xaab4c0, roughness: 0.35, metalness: 0.9 }),
  frameOr: new THREE.MeshStandardMaterial({ color: 0xe8741c, roughness: 0.5, metalness: 0.4 }),
  frameBl: new THREE.MeshStandardMaterial({ color: 0x2f6fe0, roughness: 0.5, metalness: 0.4 }),
  frameYe: new THREE.MeshStandardMaterial({ color: 0xf2c200, roughness: 0.5, metalness: 0.4 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x7d8796, roughness: 0.6, metalness: 0.1 }),
  roller: new THREE.MeshStandardMaterial({ color: 0xcfd6de, roughness: 0.25, metalness: 0.95 }),
  chain: new THREE.MeshStandardMaterial({ color: 0x3b4350, roughness: 0.4, metalness: 0.9 }),
  cardboard: [0xc89a5b, 0xbb8c4d, 0xd1a468].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, metalness: 0 })),
  tape: new THREE.MeshStandardMaterial({ color: 0xe9dcc0, roughness: 0.6 }),
  rack: new THREE.MeshStandardMaterial({ color: 0x1f4fa8, roughness: 0.55, metalness: 0.5 }),
  rackBeam: new THREE.MeshStandardMaterial({ color: 0xe8741c, roughness: 0.55, metalness: 0.5 }),
};

/* ---------- helpers ---------- */
const add = (mesh, parent = scene, shadow = true) => { mesh.castShadow = shadow; mesh.receiveShadow = true; parent.add(mesh); return mesh; };
const box = (w, h, d, mat, x = 0, y = 0, z = 0, parent = scene) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return add(m, parent); };

/* ---------- floor ---------- */
const floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 60), M.floor);
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const grid = new THREE.GridHelper(90, 90, 0x5a6471, 0x4f5864); grid.position.y = 0.002; scene.add(grid);
// safety lane markings
for (const z of [-2.2, 2.2]) box(24, 0.01, 0.12, new THREE.MeshStandardMaterial({ color: 0xf2c200, roughness: 0.7 }), 0, 0.006, z).castShadow = false;

/* ---------- reusable component: roller conveyor ---------- */
class RollerConveyor {
  constructor({ length = 8, width = 1.2, height = 0.8, pitch = 0.22, radius = 0.05, frameMat = M.frameOr } = {}) {
    this.group = new THREE.Group();
    this.length = length; this.width = width; this.height = height; this.radius = radius;
    // side rails
    for (const s of [-1, 1]) {
      box(length, 0.16, 0.07, frameMat, 0, height - 0.04, s * (width / 2 + 0.035), this.group);
      box(length, 0.03, 0.14, M.steel, 0, height + 0.05, s * (width / 2 + 0.035), this.group);
    }
    // legs + cross members
    for (let x = -length / 2 + 0.4; x <= length / 2 - 0.3; x += 1.6) {
      for (const s of [-1, 1]) box(0.08, height - 0.05, 0.08, M.dark, x, (height - 0.05) / 2, s * (width / 2 + 0.035), this.group);
      box(0.06, 0.06, width + 0.14, M.dark, x, height * 0.45, 0, this.group);
      for (const s of [-1, 1]) box(0.22, 0.03, 0.2, M.dark, x, 0.015, s * (width / 2 + 0.035), this.group);
    }
    // rollers
    this.rollers = [];
    const geo = new THREE.CylinderGeometry(radius, radius, width, 20);
    geo.rotateX(Math.PI / 2);
    const n = Math.floor(length / pitch);
    for (let i = 0; i < n; i++) {
      const r = new THREE.Mesh(geo, M.roller);
      r.position.set(-length / 2 + pitch / 2 + i * pitch, height, 0);
      // small groove detail for visible rotation
      const mark = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, width * 0.98), M.dark);
      mark.position.set(radius, 0, 0); r.add(mark);
      add(r, this.group); this.rollers.push(r);
    }
    this.topY = height + radius;
  }
  update(dt, v) { const w = v / this.radius; for (const r of this.rollers) r.rotation.z -= w * dt; }
}

/* ---------- reusable component: chain conveyor ---------- */
class ChainConveyor {
  constructor({ length = 7, width = 1.0, height = 0.8, frameMat = M.frameBl } = {}) {
    this.group = new THREE.Group();
    this.length = length; this.height = height; this.width = width;
    box(length, 0.18, width + 0.5, frameMat, 0, height - 0.2, 0, this.group);
    for (const s of [-1, 1]) box(length, 0.2, 0.06, frameMat, 0, height - 0.05, s * (width / 2 + 0.28), this.group);
    for (let x = -length / 2 + 0.4; x <= length / 2 - 0.3; x += 1.5)
      for (const s of [-1, 1]) box(0.08, height - 0.28, 0.08, M.dark, x, (height - 0.28) / 2, s * (width / 2 + 0.25), this.group);
    // two chain strands made of instanced links
    this.pitch = 0.1; this.count = Math.floor(length / this.pitch);
    const linkGeo = new THREE.BoxGeometry(0.075, 0.05, 0.1);
    this.links = [];
    this.dummy = new THREE.Object3D();
    for (const s of [-0.3, 0.3]) {
      const im = new THREE.InstancedMesh(linkGeo, M.chain, this.count);
      im.castShadow = true; im.receiveShadow = true; this.group.add(im);
      this.links.push({ im, z: s });
    }
    // end sprockets
    for (const sx of [-1, 1]) for (const z of [-0.3, 0.3]) {
      const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.07, 14), M.steel);
      sp.rotation.x = Math.PI / 2; sp.position.set(sx * (length / 2 - 0.1), height - 0.12, z); add(sp, this.group);
    }
    this.offset = 0; this.topY = height - 0.02;
    this.update(0, 0);
  }
  update(dt, v) {
    this.offset = (this.offset + v * dt) % this.pitch;
    const d = this.dummy;
    for (const { im, z } of this.links) {
      for (let i = 0; i < this.count; i++) {
        d.position.set(-this.length / 2 + 0.1 + i * this.pitch + this.offset, this.height - 0.07, z);
        d.updateMatrix(); im.setMatrixAt(i, d.matrix);
      }
      im.instanceMatrix.needsUpdate = true;
    }
  }
}

/* ---------- reusable component: vertical reciprocating conveyor (VRC) ---------- */
class VRC {
  constructor({ travel = 3.2, base = 0.8, size = 1.5, speed = 1.1 } = {}) {
    this.group = new THREE.Group();
    this.base = base; this.travel = travel; this.speed = speed; this.size = size;
    const h = base + travel + 1.4;
    const half = size / 2 + 0.12;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      box(0.12, h, 0.12, M.frameYe, sx * half, h / 2, sz * half, this.group);
    }
    // top and bottom frames
    for (const y of [0.1, h]) {
      for (const s of [-1, 1]) { box(size + 0.36, 0.1, 0.1, M.frameYe, 0, y, s * half, this.group); box(0.1, 0.1, size + 0.36, M.frameYe, s * half, y, 0, this.group); }
    }
    // mid braces
    for (let y = 1.2; y < h; y += 1.3) for (const s of [-1, 1]) box(size + 0.3, 0.05, 0.05, M.dark, 0, y, s * half, this.group);
    // carriage
    this.carriage = new THREE.Group();
    box(size, 0.08, size, M.steel, 0, 0, 0, this.carriage);
    for (let i = -3; i <= 3; i++) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, size - 0.1, 16).rotateX(Math.PI / 2), M.roller); r.position.set(i * 0.21, 0.07, 0); add(r, this.carriage); }
    for (const s of [-1, 1]) box(size, 0.12, 0.06, M.frameYe, 0, 0.05, s * (size / 2), this.carriage);
    this.group.add(this.carriage);
    this.y = 0; this.state = 'idle';
    this.setY(0);
    // counterweight column
    box(0.3, 1.2, 0.3, M.dark, 0, h - 0.8, half + 0.3, this.group);
    box(0.1, h, 0.1, M.steel, 0, h / 2, half + 0.3, this.group);
  }
  setY(y) { this.y = THREE.MathUtils.clamp(y, 0, this.travel); this.carriage.position.y = this.base - 0.05 + this.y; this.topSurface = this.base + this.y + 0.02; }
}

/* ---------- build the line ---------- */
const roller = new RollerConveyor({ length: 8 });
roller.group.position.set(-5.3, 0, 0); scene.add(roller.group);

const vrc = new VRC({});
vrc.group.position.set(0, 0, 0); scene.add(vrc.group);

const upperY = 0.8 + 3.2;
const chain = new ChainConveyor({ length: 7 });
chain.group.position.set(4.3, upperY, 0); scene.add(chain.group);
// support legs for the elevated chain conveyor
for (const x of [1.4, 4.3, 6.8]) for (const z of [-0.78, 0.78]) box(0.12, upperY - 0.9, 0.12, M.dark, x, (upperY - 0.9) / 2 , z);

// guard rails along VRC / chain
for (const z of [-0.95, 0.95]) {
  box(7, 0.05, 0.05, M.frameYe, 4.3, upperY + 0.55, z * 1.0);
  box(7, 0.05, 0.05, M.frameYe, 4.3, upperY + 0.25, z * 1.0);
  for (let x = 1.2; x <= 7.4; x += 1.2) box(0.05, 0.6, 0.05, M.frameYe, x, upperY + 0.27, z);
}

/* ---------- storage racks (background set dressing) ---------- */
function rack(x, z, rot = 0) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot;
  const W = 4.2, D = 1.0, H = 4.6;
  for (const sx of [-W / 2, W / 2]) for (const sz of [-D / 2, D / 2]) box(0.1, H, 0.1, M.rack, sx, H / 2, sz, g);
  for (const y of [0.4, 1.9, 3.4]) {
    for (const sz of [-D / 2, D / 2]) box(W, 0.12, 0.08, M.rackBeam, 0, y, sz, g);
    for (let i = 0; i < 3; i++) {
      const bw = 1.1, bh = 0.7 + Math.random() * 0.35;
      const b = box(bw, bh, 0.8, M.cardboard[(i + Math.round(y)) % 3], -1.35 + i * 1.35, y + 0.06 + bh / 2, 0, g);
      box(bw + 0.01, 0.05, 0.12, M.tape, 0, bh * 0.25, 0, b);
    }
  }
  scene.add(g);
}
for (let i = 0; i < 4; i++) rack(-9 + i * 4.6, -11);
for (let i = 0; i < 3; i++) rack(-8 + i * 4.6, 13.5, Math.PI);
// pallet stack near the end
const pallet = new THREE.Group(); pallet.position.set(8.4, 0, 3.3);
box(1.2, 0.14, 1.0, new THREE.MeshStandardMaterial({ color: 0x8a6a3d, roughness: 0.9 }), 0, 0.07, 0, pallet);
for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) box(0.55, 0.42, 0.45, M.cardboard[(r + c) % 3], -0.28 + c * 0.56, 0.35 + r * 0.43, 0, pallet);
scene.add(pallet);

/* ---------- control cabinet ---------- */
const cab = new THREE.Group(); cab.position.set(-2.2, 0, -1.9);
box(0.7, 1.4, 0.4, new THREE.MeshStandardMaterial({ color: 0x3c4552, roughness: 0.5, metalness: 0.6 }), 0, 0.7, 0, cab);
const led = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 12), new THREE.MeshStandardMaterial({ color: 0x22ff88, emissive: 0x22ff88, emissiveIntensity: 2 }));
led.position.set(0.2, 1.2, 0.21); cab.add(led); scene.add(cab);

/* ---------- boxes ---------- */
const boxes = [];
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
function spawnBox() {
  const w = 0.5 + Math.random() * 0.25, h = 0.28 + Math.random() * 0.22, d = 0.4 + Math.random() * 0.25;
  const mesh = new THREE.Mesh(boxGeo, M.cardboard[Math.floor(Math.random() * 3)]);
  mesh.scale.set(w, h, d); mesh.castShadow = true; mesh.receiveShadow = true;
  const tape = new THREE.Mesh(boxGeo, M.tape); tape.scale.set(0.16, 1.02, 1.02); mesh.add(tape);
  mesh.position.set(-9.2, roller.topY + h / 2, (Math.random() - 0.5) * 0.2);
  scene.add(mesh);
  boxes.push({ mesh, w, h, d, stage: 'roller' });
}

/* ---------- simulation ---------- */
const ui = { speed: document.getElementById('speed'), rate: document.getElementById('rate'), count: document.getElementById('count'), live: document.getElementById('live'), pause: document.getElementById('pause'), view: document.getElementById('view') };
let paused = false, delivered = 0, spawnT = 0;
ui.pause.onclick = () => { paused = !paused; ui.pause.textContent = paused ? 'Resume' : 'Pause'; };
ui.view.onclick = () => { viewIdx = (viewIdx + 1) % views.length; tween = { t: 0, fromP: camera.position.clone(), fromT: controls.target.clone(), toP: new THREE.Vector3(...views[viewIdx].p), toT: new THREE.Vector3(...views[viewIdx].t) }; };
let tween = null;

const V = 1.0;                     // base belt speed, m/s
const platformX = 0;               // VRC carriage centre
const rollerEnd = -5.3 + 4 - 0.1;  // end of roller conveyor
let liftBox = null;

function step(dt) {
  const k = parseFloat(ui.speed.value), v = V * k;
  roller.update(dt, v);
  chain.update(dt, v);
  if (k === 0) return;

  spawnT += dt * k;
  if (spawnT > 1 / parseFloat(ui.rate.value) * 1.6 && boxes.filter(b => b.stage === 'roller').length < 6) {
    const last = boxes.filter(b => b.stage === 'roller').sort((a, b) => a.mesh.position.x - b.mesh.position.x)[0];
    if (!last || last.mesh.position.x > -9.2 + 1.3) { spawnBox(); spawnT = 0; }
  }

  // VRC logic
  const carryTop = () => vrc.topSurface;
  if (vrc.state === 'idle') {
    if (liftBox) { vrc.state = 'rise'; }
  } else if (vrc.state === 'rise') {
    vrc.setY(vrc.y + vrc.speed * k * dt);
    if (vrc.y >= vrc.travel) vrc.state = 'unload';
  } else if (vrc.state === 'unload') {
    if (!liftBox) vrc.state = 'fall';
  } else if (vrc.state === 'fall') {
    vrc.setY(vrc.y - vrc.speed * 1.4 * k * dt);
    if (vrc.y <= 0) vrc.state = 'idle';
  }

  for (let i = boxes.length - 1; i >= 0; i--) {
    const b = boxes[i], m = b.mesh;
    if (b.stage === 'roller') {
      // stop behind the box ahead
      let limit = rollerEnd + 0.2;
      for (const o of boxes) if (o !== b && o.stage === 'roller' && o.mesh.position.x > m.position.x) limit = Math.min(limit, o.mesh.position.x - (o.w + b.w) / 2 - 0.08);
      const canEnter = vrc.state === 'idle' && vrc.y <= 0.001 && !liftBox;
      if (canEnter && m.position.x + b.w / 2 >= rollerEnd - 0.2 && limit >= rollerEnd) limit = platformX;
      m.position.x = Math.min(m.position.x + v * dt, limit);
      if (canEnter && Math.abs(m.position.x - platformX) < 0.02 && limit === platformX) { b.stage = 'lift'; liftBox = b; }
    } else if (b.stage === 'lift') {
      m.position.y = vrc.topSurface + b.h / 2;
      if (vrc.state === 'unload') { b.stage = 'toChain'; }
    } else if (b.stage === 'toChain') {
      m.position.x += v * dt;
      m.position.y = vrc.topSurface + b.h / 2;
      if (m.position.x - b.w / 2 > 0.75 + 0.1 && liftBox === b) liftBox = null;
      if (m.position.x - b.w / 2 > 1.1) { b.stage = 'chain'; m.position.y = chain.group.position.y + chain.topY + b.h / 2; }
    } else if (b.stage === 'chain') {
      m.position.x += v * dt;
      m.position.y = chain.group.position.y + chain.topY + b.h / 2;
      if (m.position.x > 7.6) { b.stage = 'drop'; b.vy = 0; }
    } else if (b.stage === 'drop') {
      b.vy -= 9.8 * dt; m.position.y += b.vy * dt; m.position.x += 0.6 * dt;
      m.rotation.z -= 1.2 * dt;
      if (m.position.y < b.h / 2 + 0.05) { scene.remove(m); boxes.splice(i, 1); delivered++; }
    }
  }
  ui.count.textContent = delivered; ui.live.textContent = boxes.length;
  led.material.emissive.setHex(vrc.state === 'idle' ? 0x22ff88 : 0xffb020);
}

/* ---------- loop ---------- */
const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!paused) step(dt);
  if (tween) { tween.t = Math.min(1, tween.t + dt / 1.2); const e = tween.t * tween.t * (3 - 2 * tween.t); camera.position.lerpVectors(tween.fromP, tween.toP, e); controls.target.lerpVectors(tween.fromT, tween.toT, e); if (tween.t >= 1) tween = null; }
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
// pre-warm so the first frame already shows boxes on the line
const q = new URLSearchParams(location.search);
const warmSec = parseFloat(q.get('t')) || 6;
for (let i = 0; i < warmSec * 60; i++) step(1 / 60);
if (q.get('view')) { const v = views[+q.get('view')]; camera.position.set(...v.p); controls.target.set(...v.t); }
frame();
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
