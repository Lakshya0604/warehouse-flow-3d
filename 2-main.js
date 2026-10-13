import * as THREE from 'three';
import { OrbitControls } from './OrbitControls.js';

/* ---------- renderer / scene ---------- */
const stage = document.getElementById('stage');
const coarse = matchMedia('(pointer: coarse)').matches;
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, coarse ? 1.5 : 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a2029);
scene.fog = new THREE.Fog(0x1a2029, 46, 110);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 250);
const views = [
  { n: 'Overview', p: [7, 16, 35], t: [1, 1.5, 4] },
  { n: 'Intake', p: [-15, 5, 9], t: [-6, 1.2, 0] },
  { n: 'Lift + chain', p: [6, 7.5, 11], t: [3.5, 3, 0] },
  { n: 'Storage', p: [18, 6.5, 9], t: [9.5, 2.5, 0] },
  { n: 'Dispatch', p: [19, 5, 19], t: [10.5, 1, 8] },
  { n: 'Top', p: [0, 34, 0.1], t: [-1, 0, 4] },
];
camera.position.set(...views[0].p);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(...views[0].t);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 4;
controls.maxDistance = 55;
if (coarse) { controls.touches.ONE = -1; renderer.domElement.style.touchAction = 'pan-y'; }

/* ---------- lights ---------- */
scene.add(new THREE.HemisphereLight(0xdfe9ff, 0x4a505a, 1.1));
const sun = new THREE.DirectionalLight(0xfff1dd, 2.2);
sun.position.set(6, 26, 14);
sun.castShadow = true;
sun.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 20, bottom: -14, near: 1, far: 70 });
sun.shadow.bias = -0.0004; sun.shadow.radius = 4;
scene.add(sun);
const warm = new THREE.PointLight(0xffb36b, 18, 14, 2); warm.position.set(0, 5.2, 1.5); scene.add(warm);

/* ---------- materials ---------- */
const M = {
  floor: new THREE.MeshStandardMaterial({ color: 0x5a6270, roughness: 0.9, metalness: 0.02 }),
  steel: new THREE.MeshStandardMaterial({ color: 0xaab4c0, roughness: 0.35, metalness: 0.9 }),
  frameOr: new THREE.MeshStandardMaterial({ color: 0xe8741c, roughness: 0.5, metalness: 0.4 }),
  frameBl: new THREE.MeshStandardMaterial({ color: 0x2f6fe0, roughness: 0.5, metalness: 0.4 }),
  frameYe: new THREE.MeshStandardMaterial({ color: 0xf2c200, roughness: 0.5, metalness: 0.4 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x7d8796, roughness: 0.6, metalness: 0.1 }),
  roller: new THREE.MeshStandardMaterial({ color: 0xcfd6de, roughness: 0.25, metalness: 0.95 }),
  chain: new THREE.MeshStandardMaterial({ color: 0x3b4350, roughness: 0.4, metalness: 0.9 }),
  cardboard: [0xc89a5b, 0xbb8c4d, 0xd1a468].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, metalness: 0 })),
  tape: new THREE.MeshStandardMaterial({ color: 0xe9dcc0, roughness: 0.6 }),
  rack: new THREE.MeshStandardMaterial({ color: 0x1f4fa8, roughness: 0.55, metalness: 0.3 }),
  rackBeam: new THREE.MeshStandardMaterial({ color: 0xe8741c, roughness: 0.55, metalness: 0.3 }),
  truck: new THREE.MeshStandardMaterial({ color: 0xe9edf2, roughness: 0.6, metalness: 0.1 }),
  truckIn: new THREE.MeshStandardMaterial({ color: 0x9aa3ae, roughness: 0.8 }),
  tire: new THREE.MeshStandardMaterial({ color: 0x15181d, roughness: 0.9 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x1b2a3a, roughness: 0.2, metalness: 0.6 }),
};

/* ---------- helpers ---------- */
const add = (mesh, parent = scene, shadow = true) => { mesh.castShadow = shadow; mesh.receiveShadow = true; parent.add(mesh); return mesh; };
const box = (w, h, d, mat, x = 0, y = 0, z = 0, parent = scene) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return add(m, parent); };

/* ---------- floor ---------- */
const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 80), M.floor);
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const grid = new THREE.GridHelper(120, 120, 0x6a7482, 0x5f6876); grid.position.y = 0.002; scene.add(grid);
const lane = new THREE.MeshStandardMaterial({ color: 0xf2c200, roughness: 0.7 });
for (const z of [-2.2, 2.2]) box(24, 0.01, 0.12, lane, -1, 0.006, z).castShadow = false;
for (const x of [8.4, 13.4]) box(0.12, 0.01, 18, lane, x, 0.006, 6).castShadow = false;

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


/* ---------- layout ---------- */
const COLS = 6, LEVELS = 3, COL_DZ = 0.9, RACK_X = 9.4, PICK_X = 10.9;
const levelY = [0.95, 2.45, 3.95];          // shelf surfaces, bottom to top
const colZ = c => (c - (COLS - 1) / 2) * COL_DZ;
const CAP = COLS * LEVELS;

const roller = new RollerConveyor({ length: 8 });
roller.group.position.set(-5.3, 0, 0); scene.add(roller.group);
const rollerEnd = -5.3 + 4 - 0.1;

const vrc = new VRC({});
scene.add(vrc.group);

const upperY = 3.2;
const chain = new ChainConveyor({ length: 7 });
chain.group.position.set(4.3, upperY, 0); scene.add(chain.group);
const chainSurf = upperY + chain.topY;
for (const x of [1.4, 4.3, 6.8]) for (const z of [-0.78, 0.78]) box(0.12, upperY - 0.3, 0.12, M.dark, x, (upperY - 0.3) / 2, z);
for (const z of [-0.95, 0.95]) {
  box(7, 0.05, 0.05, M.frameYe, 4.3, chainSurf + 0.65, z);
  box(7, 0.05, 0.05, M.frameYe, 4.3, chainSurf + 0.35, z);
  for (let x = 1.2; x <= 7.4; x += 1.2) box(0.05, 0.7, 0.05, M.frameYe, x, chainSurf + 0.33, z);
}

/* dispatch roller conveyor (runs along +z) */
const disp = new RollerConveyor({ length: 14.6, frameMat: M.frameBl });
disp.group.rotation.y = -Math.PI / 2;
disp.group.position.set(PICK_X, 0, 4.3); scene.add(disp.group);
const dispStart = -3.0, dispEnd = 11.5;
const dispTop = disp.topY;

/* storage rack (6 columns x 3 levels) */
{
  const g = new THREE.Group(); g.position.set(RACK_X, 0, 0);
  const H = 4.9, D = 1.0, L = COLS * COL_DZ + 0.2;
  for (let i = 0; i <= COLS; i += 2) for (const sx of [-D / 2, D / 2]) box(0.1, H, 0.1, M.rack, sx, H / 2, (i - COLS / 2) * COL_DZ, g);
  for (const y of levelY) for (const sx of [-D / 2, D / 2]) box(0.08, 0.1, L, M.rackBeam, sx, y - 0.06, 0, g);
  for (const y of levelY) box(D, 0.04, L, M.dark, 0, y - 0.02, 0, g);
  for (let i = 0; i <= COLS; i += 2) box(D, 0.05, 0.05, M.rack, 0, H - 0.1, (i - COLS / 2) * COL_DZ, g);
  scene.add(g);
}
// pick-lift mast beside the dispatch line
box(0.12, 5.0, 0.12, M.frameYe, PICK_X + 0.7, 2.5, -3.1);
box(0.12, 5.0, 0.12, M.frameYe, PICK_X + 0.7, 2.5, 3.1);
box(0.1, 0.1, 6.3, M.frameYe, PICK_X + 0.7, 5.0, 0);

/* trucks */
function truck(x, z, rotY, withBoxes) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotY;
  const L = 4.2, W = 1.9, floorY = 0.72;
  box(L, 0.1, W, M.truckIn, -L / 2, floorY, 0, g);
  box(L, 2.2, 0.06, M.truck, -L / 2, floorY + 1.1, -W / 2, g);
  box(L, 2.2, 0.06, M.truck, -L / 2, floorY + 1.1, W / 2, g);
  box(0.06, 2.2, W, M.truck, -L, floorY + 1.1, 0, g);
  box(L, 0.06, W, M.truck, -L / 2, floorY + 2.2, 0, g);
  box(L, 0.1, 0.07, M.frameBl, -L / 2, floorY + 1.0, -W / 2 - 0.04, g);
  box(L, 0.1, 0.07, M.frameBl, -L / 2, floorY + 1.0, W / 2 + 0.04, g);
  // cab
  box(1.4, 1.5, W - 0.1, M.truck, -L - 0.8, floorY + 0.6, 0, g);
  box(0.06, 0.7, W - 0.5, M.glass, -L - 0.06 - 0.7 + 1.4, floorY + 0.95, 0, g);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 18); wheelGeo.rotateX(Math.PI / 2);
  for (const wx of [-L - 0.8, -L + 0.4, -L / 2 - 0.2, -1.2]) for (const s of [-1, 1]) { const w = new THREE.Mesh(wheelGeo, M.tire); w.position.set(wx, 0.42, s * (W / 2 - 0.05)); add(w, g); }
  if (withBoxes) for (let i = 0; i < 6; i++) { const b = box(0.7, 0.45, 0.6, M.cardboard[i % 3], -0.9 - (i % 3) * 0.8, floorY + 0.3, (i < 3 ? -0.45 : 0.45), g); b.castShadow = false; }
  scene.add(g); return g;
}
truck(-9.7, 0, 0, true);
truck(PICK_X, 11.6, Math.PI / 2, false);
// dock plates / bollards
for (const z of [-1.4, 1.4]) box(0.5, 0.9, 0.5, M.frameYe, -9.0, 0.45, z);

/* background racks + pallet + cabinet */
function rack(x, z, rot = 0) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot;
  const W = 4.2, D = 1.0, H = 4.6;
  for (const sx of [-W / 2, W / 2]) for (const sz of [-D / 2, D / 2]) box(0.1, H, 0.1, M.rack, sx, H / 2, sz, g);
  for (const y of [0.4, 1.9, 3.4]) {
    for (const sz of [-D / 2, D / 2]) box(W, 0.12, 0.08, M.rackBeam, 0, y, sz, g);
    for (let i = 0; i < 3; i++) {
      const bw = 1.1, bh = 0.7 + ((i * 37 + Math.round(y * 10)) % 30) / 100;
      const b = box(bw, bh, 0.8, M.cardboard[(i + Math.round(y)) % 3], -1.35 + i * 1.35, y + 0.06 + bh / 2, 0, g);
      box(bw + 0.01, 0.05, 0.12, M.tape, 0, bh * 0.25, 0, b);
    }
  }
  scene.add(g);
}
for (let i = 0; i < 4; i++) rack(-12 + i * 4.6, -11);
for (let i = 0; i < 3; i++) rack(-12 + i * 4.6, 14.5, Math.PI);
const pallet = new THREE.Group(); pallet.position.set(-3.6, 0, 4.4);
box(1.2, 0.14, 1.0, new THREE.MeshStandardMaterial({ color: 0x8a6a3d, roughness: 0.9 }), 0, 0.07, 0, pallet);
for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) box(0.55, 0.42, 0.45, M.cardboard[(r + c) % 3], -0.28 + c * 0.56, 0.35 + r * 0.43, 0, pallet);
scene.add(pallet);
const cab = new THREE.Group(); cab.position.set(-2.2, 0, -1.9);
box(0.7, 1.4, 0.4, new THREE.MeshStandardMaterial({ color: 0x3c4552, roughness: 0.5, metalness: 0.6 }), 0, 0.7, 0, cab);
const ledMat = new THREE.MeshStandardMaterial({ color: 0x22ff88, emissive: 0x22ff88, emissiveIntensity: 2 });
const led = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), ledMat);
led.position.set(0.2, 1.2, 0.21); cab.add(led); scene.add(cab);

/* ---------- state ---------- */
const S = {
  running: true, estop: false, speed: 1, inRate: 10, autoIn: true,
  roller: true, vrc: true, chain: true, disp: true,
  dispMode: 'auto', dispAt: 6, vrcSpeed: 1.1,
};
const sim = { t: 0, delivered: 0, inbound: 0, stored: [], dispatched: 0, log: [], times: [], queue: [], seq: 1000, spawnT: 0, dispT: 0, blocked: false, dispatchReq: 0 };
const slots = Array.from({ length: CAP }, () => null);   // box or null
const boxes = [];
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const slotName = i => { const c = i % COLS, l = Math.floor(i / COLS); return 'ABCDEF'[c] + (l + 1); };

function logEvt(msg) {
  const m = Math.floor(sim.t / 60), s = Math.floor(sim.t % 60);
  const line = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  sim.log.unshift({ t: line, msg });
  if (sim.log.length > 200) sim.log.pop();
  renderLog();
}

function makeBox(sku, w, h, d) {
  const mesh = new THREE.Mesh(boxGeo, M.cardboard[Math.floor(Math.random() * 3)]);
  mesh.scale.set(w, h, d); mesh.castShadow = true; mesh.receiveShadow = true;
  const tape = new THREE.Mesh(boxGeo, M.tape); tape.scale.set(0.16, 1.02, 1.02); mesh.add(tape);
  scene.add(mesh);
  const b = { mesh, w, h, d, sku, stage: 'roller', slot: -1 };
  mesh.userData.box = b;
  boxes.push(b);
  return b;
}
function spawnBox() {
  const item = sim.queue.shift();
  const sku = item || ('SKU-' + (++sim.seq));
  const b = makeBox(sku, 0.5 + Math.random() * 0.25, 0.28 + Math.random() * 0.22, 0.4 + Math.random() * 0.22);
  b.mesh.position.set(-9.2, roller.topY + b.h / 2, (Math.random() - 0.5) * 0.12);
  sim.inbound++;
  logEvt('Inbound: ' + sku + ' unloaded onto roller line');
  return b;
}

/* free slot choice: fill top level first (chain feeds the top), then fall through */
function pickSlot() {
  const order = [];
  for (let l = LEVELS - 1; l >= 0; l--) for (let c = 0; c < COLS; c++) order.push(l * COLS + c);
  for (const i of order) if (!slots[i]) return i;
  return -1;
}
function storedBoxes() { return slots.filter(Boolean); }

/* simple tween path follower */
function setPath(b, pts, next) { b.path = pts; b.pi = 0; b.pt = 0; b.from = b.mesh.position.clone(); b.next = next; }
function followPath(b, dt) {
  const seg = b.path[b.pi];
  b.pt += dt / seg.d;
  const e = Math.min(1, b.pt), s = e * e * (3 - 2 * e);
  b.mesh.position.lerpVectors(b.from, seg.to, s);
  if (b.pt >= 1) { b.pi++; b.pt = 0; b.from = b.mesh.position.clone(); if (b.pi >= b.path.length) { b.path = null; b.next(); } }
}

function startStore(b) {
  const si = pickSlot();
  b.slot = si; slots[si] = b; b.stage = 'store';
  const lvl = Math.floor(si / COLS), c = si % COLS;
  const y = levelY[lvl] + b.h / 2;
  setPath(b, [
    { to: new THREE.Vector3(RACK_X, chainSurf + b.h / 2, 0), d: 1.4 },
    { to: new THREE.Vector3(RACK_X, y, colZ(c)), d: 0.9 + 0.5 * (LEVELS - 1 - lvl) },
  ], () => { b.stage = 'stored'; sim.times.push(sim.t); logEvt('Stored: ' + b.sku + ' at ' + slotName(si)); });
}
function dispatchOne() {
  let best = null;
  for (const b of boxes) if (b.stage === 'stored' && (!best || b.storedAt < best.storedAt)) best = b;
  if (!best) return false;
  const c = best.slot % COLS;
  best.stage = 'pick'; slots[best.slot] = null;
  const y0 = best.mesh.position.y;
  setPath(best, [
    { to: new THREE.Vector3(PICK_X, y0, colZ(c)), d: 0.9 },
    { to: new THREE.Vector3(PICK_X, dispTop + best.h / 2, colZ(c)), d: 0.8 + y0 * 0.25 },
  ], () => { best.stage = 'disp'; });
  logEvt('Dispatch order: picking ' + best.sku + ' from ' + slotName(best.slot));
  return true;
}

/* ---------- simulation ---------- */
let liftBox = null;
const platformX = 0;
function step(dt) {
  const run = S.running && !S.estop;
  const k = run ? S.speed : 0;
  const vR = S.roller ? k : 0, vC = S.chain ? k : 0, vD = S.disp ? k : 0, vL = S.vrc ? k : 0;
  roller.update(dt, vR); chain.update(dt, vC); disp.update(dt, vD);
  if (!run) return;
  sim.t += dt;

  // inbound
  sim.spawnT += dt * S.speed;
  const onRoller = boxes.filter(b => b.stage === 'roller');
  const inSys = boxes.filter(b => ['roller', 'lift', 'toChain', 'chain', 'store', 'stored'].includes(b.stage)).length;
  const full = inSys >= CAP;
  if (full !== sim.blocked) { sim.blocked = full; logEvt(full ? 'Storage full: inbound paused until dispatch frees a slot' : 'Storage slot free: inbound resumed'); }
  const wantSpawn = sim.queue.length > 0 || S.autoIn;
  if (wantSpawn && !full && sim.spawnT > 60 / S.inRate && onRoller.length < 6) {
    const last = onRoller.sort((a, b) => a.mesh.position.x - b.mesh.position.x)[0];
    if (!last || last.mesh.position.x > -9.2 + 1.3) { spawnBox(); sim.spawnT = 0; }
  }

  // dispatch triggers
  if (sim.dispatchReq > 0) { if (dispatchOne()) sim.dispatchReq--; else sim.dispatchReq = 0; }
  if (S.dispMode === 'auto' && storedBoxes().length >= S.dispAt) {
    sim.dispT += dt * S.speed;
    if (sim.dispT > 4) { if (dispatchOne()) sim.dispT = 0; }
  }

  // VRC
  if (S.vrc) {
    if (vrc.state === 'idle') { if (liftBox) vrc.state = 'rise'; }
    else if (vrc.state === 'rise') { vrc.setY(vrc.y + S.vrcSpeed * vL * dt); if (vrc.y >= vrc.travel) vrc.state = 'unload'; }
    else if (vrc.state === 'unload') { if (!liftBox) vrc.state = 'fall'; }
    else if (vrc.state === 'fall') { vrc.setY(vrc.y - S.vrcSpeed * 1.4 * vL * dt); if (vrc.y <= 0) vrc.state = 'idle'; }
  }

  for (let i = boxes.length - 1; i >= 0; i--) {
    const b = boxes[i], m = b.mesh;
    if (b.stage === 'roller') {
      let limit = rollerEnd + 0.2;
      for (const o of boxes) if (o !== b && o.stage === 'roller' && o.mesh.position.x > m.position.x) limit = Math.min(limit, o.mesh.position.x - (o.w + b.w) / 2 - 0.08);
      const canEnter = S.vrc && vrc.state === 'idle' && vrc.y <= 0.001 && !liftBox;
      if (canEnter && m.position.x + b.w / 2 >= rollerEnd - 0.2 && limit >= rollerEnd) limit = platformX;
      m.position.x = Math.min(m.position.x + vR * dt, limit);
      if (canEnter && Math.abs(m.position.x - platformX) < 0.02 && limit === platformX) { b.stage = 'lift'; liftBox = b; logEvt('VRC: loading ' + b.sku); }
    } else if (b.stage === 'lift') {
      m.position.y = vrc.topSurface + b.h / 2;
      if (vrc.state === 'unload') b.stage = 'toChain';
    } else if (b.stage === 'toChain') {
      m.position.x += vC * dt;
      m.position.y = vrc.topSurface + b.h / 2;
      if (m.position.x - b.w / 2 > 0.75 + 0.1 && liftBox === b) liftBox = null;
      if (m.position.x - b.w / 2 > 1.1) { b.stage = 'chain'; m.position.y = chainSurf + b.h / 2; }
    } else if (b.stage === 'chain') {
      let lim = 7.65;
      for (const o of boxes) if (o !== b && o.stage === 'chain' && o.mesh.position.x > m.position.x) lim = Math.min(lim, o.mesh.position.x - (o.w + b.w) / 2 - 0.08);
      m.position.x = Math.min(m.position.x + vC * dt, lim);
      m.position.y = chainSurf + b.h / 2;
      if (m.position.x >= 7.6 && pickSlot() >= 0 && !boxes.some(o => o.stage === 'store' && o.pi === 0)) { b.storedAt = sim.t; startStore(b); }
    } else if (b.stage === 'store' || b.stage === 'pick') {
      followPath(b, dt * S.speed);
      if (b.stage === 'store' && b.path === null) b.storedAt = sim.t;
    } else if (b.stage === 'disp') {
      let lim = dispEnd + 1.3;
      for (const o of boxes) if (o !== b && o.stage === 'disp' && o.mesh.position.z > m.position.z) lim = Math.min(lim, o.mesh.position.z - (o.d + b.d) / 2 - 0.1);
      m.position.z = Math.min(m.position.z + vD * dt, lim);
      m.position.y = dispTop + b.h / 2; m.position.x = PICK_X;
      if (m.position.z >= dispEnd + 1.2) { scene.remove(m); boxes.splice(i, 1); sim.dispatched++; sim.times.push(-sim.t); logEvt('Outbound: ' + b.sku + ' loaded on truck'); }
    }
  }
  const cur = boxes.filter(b => ['roller', 'lift', 'toChain', 'chain'].includes(b.stage)).length;
  hud.live = cur;
}
// stored timestamp fix: stage 'stored' gets storedAt when path finishes (set in startStore callback)
const _startStore = startStore;

/* ---------- hover tooltip ---------- */
const tip = document.getElementById('tip');
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
renderer.domElement.addEventListener('pointermove', e => {
  if (e.pointerType === 'touch') return;
  const r = renderer.domElement.getBoundingClientRect();
  mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(mouse, camera);
  const hit = ray.intersectObjects(boxes.map(b => b.mesh), false)[0];
  if (hit) { const b = hit.object.userData.box; tip.style.display = 'block'; tip.style.left = (e.clientX - r.left + 14) + 'px'; tip.style.top = (e.clientY - r.top + 14) + 'px'; tip.textContent = b.sku + ' - ' + ({ roller: 'on roller line', lift: 'on lift', toChain: 'on lift', chain: 'on chain conveyor', store: 'moving to rack', stored: 'stored ' + (b.slot >= 0 ? slotName(b.slot) : ''), pick: 'picked for dispatch', disp: 'on dispatch line' }[b.stage] || ''); }
  else tip.style.display = 'none';
});
renderer.domElement.addEventListener('pointerleave', () => { tip.style.display = 'none'; });

/* ---------- UI ---------- */
const $ = id => document.getElementById(id);
const hud = { live: 0 };
const bind = (id, key, num) => { const el = $(id); el.addEventListener('input', () => { S[key] = num ? parseFloat(el.value) : el.checked; if (el.type === 'range') { const o = $(id + 'V'); if (o) o.textContent = el.value; } }); return el; };
const syncUI = () => {
  const set = (id, v) => { const el = $(id); if (!el) return; if (el.type === 'checkbox') el.checked = v; else { el.value = v; const o = $(id + 'V'); if (o) o.textContent = v; } };
  set('speed', S.speed); set('inRate', S.inRate); set('dispAt', S.dispAt); set('vrcSpeed', S.vrcSpeed);
  set('autoIn', S.autoIn); set('cRoller', S.roller); set('cVrc', S.vrc); set('cChain', S.chain); set('cDisp', S.disp);
  $('modeAuto').classList.toggle('on', S.dispMode === 'auto'); $('modeMan').classList.toggle('on', S.dispMode === 'manual');
  $('startStop').textContent = S.running ? 'Stop line' : 'Start line';
  $('estop').classList.toggle('on', S.estop); $('estop').textContent = S.estop ? 'Release E-STOP' : 'E-STOP';
};
bind('speed', 'speed', true); bind('inRate', 'inRate', true); bind('dispAt', 'dispAt', true); bind('vrcSpeed', 'vrcSpeed', true);
bind('autoIn', 'autoIn'); bind('cRoller', 'roller'); bind('cVrc', 'vrc'); bind('cChain', 'chain'); bind('cDisp', 'disp');
$('startStop').onclick = () => { S.running = !S.running; logEvt(S.running ? 'Line started' : 'Line stopped'); syncUI(); };
$('estop').onclick = () => { S.estop = !S.estop; logEvt(S.estop ? 'EMERGENCY STOP pressed - all motion halted' : 'E-STOP released'); syncUI(); };
$('modeAuto').onclick = () => { S.dispMode = 'auto'; syncUI(); logEvt('Dispatch mode: auto'); };
$('modeMan').onclick = () => { S.dispMode = 'manual'; syncUI(); logEvt('Dispatch mode: manual'); };
$('dispOne').onclick = () => { sim.dispatchReq += 1; };
$('dispAll').onclick = () => { sim.dispatchReq += storedBoxes().length; };
$('reset').onclick = () => resetAll();
const viewBtns = $('views');
views.forEach((v, i) => { const b = document.createElement('button'); b.textContent = v.n; b.className = 'alt sm'; b.onclick = () => goView(i); viewBtns.appendChild(b); });
let tween = null;
function goView(i) { tween = { t: 0, fromP: camera.position.clone(), fromT: controls.target.clone(), toP: new THREE.Vector3(...views[i].p), toT: new THREE.Vector3(...views[i].t) }; }

function resetAll() {
  for (const b of boxes) scene.remove(b.mesh);
  boxes.length = 0; slots.fill(null); liftBox = null; vrc.state = 'idle'; vrc.setY(0);
  Object.assign(sim, { t: 0, inbound: 0, dispatched: 0, times: [], log: [], queue: [], spawnT: 0, dispT: 0, blocked: false, dispatchReq: 0 });
  logEvt('System reset'); renderLog();
}

/* log + stats */
function renderLog() {
  $('log').innerHTML = sim.log.slice(0, 7).map(l => '<div><span>' + l.t + '</span> ' + l.msg.replace(/</g, '&lt;') + '</div>').join('');
}
function rate() { const n = sim.times.filter(t => t > 0 && sim.t - t < 60).length; return n; }
function renderStats() {
  const st = storedBoxes().filter(b => b.stage === 'stored').length;
  $('kIn').textContent = sim.inbound; $('kLive').textContent = hud.live; $('kStored').textContent = st + ' / ' + CAP;
  $('kOut').textContent = sim.dispatched; $('kRate').textContent = rate() + '/min'; $('kVrc').textContent = S.vrc ? vrc.state : 'disabled';
  $('fill').style.width = (st / CAP * 100) + '%';
  const alarm = S.estop ? 'E-STOP' : sim.blocked ? 'Storage full' : !S.running ? 'Stopped' : 'Running';
  const el = $('status'); el.textContent = alarm; el.className = 'badge ' + (S.estop ? 'red' : sim.blocked ? 'amber' : !S.running ? 'grey' : 'green');
  led.material.emissive.setHex(S.estop ? 0xff2222 : sim.blocked ? 0xffb020 : S.running ? 0x22ff88 : 0x888888);
}
setInterval(renderStats, 250);

/* ---------- import / export ---------- */
function download(name, text, type) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
$('expJson').onclick = () => {
  const stored = []; slots.forEach((b, i) => { if (b && b.stage === 'stored') stored.push({ slot: slotName(i), sku: b.sku }); });
  const cfg = { format: 'warehouse-flow-3d-layout', version: 1,
    components: { roller: { length: 8, enabled: S.roller }, vrc: { travel: 3.2, speed: S.vrcSpeed, enabled: S.vrc }, chain: { length: 7, enabled: S.chain }, dispatch: { enabled: S.disp }, storage: { columns: COLS, levels: LEVELS } },
    settings: { lineSpeed: S.speed, inboundPerMin: S.inRate, autoInbound: S.autoIn, dispatchMode: S.dispMode, autoDispatchAtStored: S.dispAt },
    counters: { inbound: sim.inbound, dispatched: sim.dispatched }, stored };
  download('warehouse-layout.json', JSON.stringify(cfg, null, 2), 'application/json'); logEvt('Exported layout + state (JSON)');
};
function importJson(text) {
  let c; try { c = JSON.parse(text); } catch { return logEvt('Import failed: not valid JSON'); }
  if (c.format !== 'warehouse-flow-3d-layout') return logEvt('Import failed: unknown file format');
  const s = c.settings || {}, k = c.components || {};
  const num = (v, lo, hi, d) => (typeof v === 'number' && v >= lo && v <= hi ? v : d);
  S.speed = num(s.lineSpeed, 0, 2, S.speed); S.inRate = num(s.inboundPerMin, 2, 20, S.inRate); S.autoIn = s.autoInbound !== false;
  S.dispMode = s.dispatchMode === 'manual' ? 'manual' : 'auto'; S.dispAt = num(s.autoDispatchAtStored, 1, 18, S.dispAt);
  if (k.roller) S.roller = k.roller.enabled !== false; if (k.chain) S.chain = k.chain.enabled !== false; if (k.dispatch) S.disp = k.dispatch.enabled !== false;
  if (k.vrc) { S.vrc = k.vrc.enabled !== false; S.vrcSpeed = num(k.vrc.speed, 0.4, 2, S.vrcSpeed); }
  // restore stored stock
  for (const b of boxes.filter(b => b.stage === 'stored')) { scene.remove(b.mesh); boxes.splice(boxes.indexOf(b), 1); }
  slots.fill(null);
  let n = 0;
  for (const it of (Array.isArray(c.stored) ? c.stored : []).slice(0, CAP)) {
    const m = /^([A-F])([1-3])$/.exec(it.slot || ''); if (!m) continue;
    const i = (+m[2] - 1) * COLS + 'ABCDEF'.indexOf(m[1]); if (slots[i]) continue;
    const b = makeBox(String(it.sku || 'SKU').slice(0, 24), 0.6, 0.4, 0.5); b.stage = 'stored'; b.slot = i; b.storedAt = sim.t - n; slots[i] = b;
    b.mesh.position.set(RACK_X, levelY[Math.floor(i / COLS)] + 0.2, colZ(i % COLS)); n++;
  }
  syncUI(); logEvt('Imported layout: ' + n + ' stored boxes restored, settings applied');
}
$('impJson').onclick = () => $('fileJson').click();
$('fileJson').onchange = e => { const f = e.target.files[0]; if (f) f.text().then(importJson); e.target.value = ''; };

const SAMPLE_CSV = 'sku,qty\nBRK-2201,4\nVLV-0087,3\nPMP-1180,5\nSNR-4410,2\nCBL-7003,4\n';
function importCsv(text) {
  const rows = text.trim().split(/\r?\n/).map(r => r.split(',').map(x => x.trim()));
  let head = rows[0] && /sku/i.test(rows[0][0]) ? rows.shift() : null; let n = 0;
  for (const r of rows) { const sku = (r[0] || '').slice(0, 20); const q = Math.min(parseInt(r[1] || '1', 10) || 1, 20); if (!sku) continue; for (let i = 0; i < q && n < 40; i++, n++) sim.queue.push(sku); }
  logEvt('Imported inbound manifest: ' + n + ' boxes queued');
}
$('impCsv').onclick = () => $('fileCsv').click();
$('fileCsv').onchange = e => { const f = e.target.files[0]; if (f) f.text().then(importCsv); e.target.value = ''; };
$('sampleCsv').onclick = () => { importCsv(SAMPLE_CSV); };
$('dlCsv').onclick = () => download('inbound-manifest-sample.csv', SAMPLE_CSV, 'text/csv');
$('expLog').onclick = () => download('event-log.csv', 'time,event\n' + sim.log.slice().reverse().map(l => l.t + ',"' + l.msg.replace(/"/g, '""') + '"').join('\n'), 'text/csv');
$('expPng').onclick = () => { renderer.render(scene, camera); renderer.domElement.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'warehouse-view.png'; a.click(); }); };

/* ---------- loop ---------- */
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h); camera.aspect = w / h; camera.fov = w / h < 1.1 ? Math.min(75, 42 + (1.1 - w / h) * 55) : 42; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();
const clock = new THREE.Clock();
let visible = true;
new IntersectionObserver(es => { visible = es[0].isIntersecting; clock.getDelta(); }).observe(stage);
function frame() {
  requestAnimationFrame(frame);
  if (!visible) return;
  const dt = Math.min(clock.getDelta(), 0.05);
  step(dt);
  if (tween) { tween.t = Math.min(1, tween.t + dt / 1.2); const e = tween.t * tween.t * (3 - 2 * tween.t); camera.position.lerpVectors(tween.fromP, tween.toP, e); controls.target.lerpVectors(tween.fromT, tween.toT, e); if (tween.t >= 1) tween = null; }
  controls.update();
  renderer.render(scene, camera);
}
const q = new URLSearchParams(location.search);
const warmSec = parseFloat(q.get('t')) || 40;
if (q.has('manual')) S.dispMode = 'manual';
sim.log = [];
for (let i = 0; i < warmSec * 60; i++) step(1 / 60);
sim.log = []; sim.times = sim.times.map(t => t); logEvt('System ready');
{ const v = views[+q.get('view') || 0]; camera.position.set(...v.p); controls.target.set(...v.t); }
if (q.has('focus')) stage.scrollIntoView({block:'center'});
(q.get('click') || '').split(',').filter(Boolean).forEach(id => { const el = $(id); if (el) el.click(); });
if (q.has('only')) document.body.classList.add('only');
resize();
syncUI(); renderStats(); frame();
window.__S = S; window.__dispatch = () => sim.dispatchReq++;
