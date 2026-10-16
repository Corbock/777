import * as THREE from 'three';

const $ = (id) => document.getElementById(id);

// ---------- Scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x120308);
scene.fog = new THREE.Fog(0x120308, 10, 30);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 100);
camera.rotation.order = 'YXZ';

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------- Room ----------
const ROOM = { w: 16, d: 16, h: 4 };
const colliders = []; // axis-aligned boxes {minX,maxX,minZ,maxZ}
const DOOR = { hw: 1, h: 2.6, open: false, t: 0 };
const DARK = { minX: -26, w: 18, d: 18, h: 3.2 };

function carpetTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#6b0f22';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#c9a227';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(64, 8); g.lineTo(120, 64); g.lineTo(64, 120); g.lineTo(8, 64); g.closePath();
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(ROOM.w / 2, ROOM.d / 2);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(ROOM.w, ROOM.d),
  new THREE.MeshStandardMaterial({ map: carpetTexture(), roughness: 0.9 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const ceiling = new THREE.Mesh(
  new THREE.PlaneGeometry(ROOM.w, ROOM.d),
  new THREE.MeshStandardMaterial({ color: 0x1b0a10 })
);
ceiling.rotation.x = Math.PI / 2;
ceiling.position.y = ROOM.h;
scene.add(ceiling);

const wallMat = new THREE.MeshStandardMaterial({ color: 0x3a0a16, roughness: 0.8 });
[
  [0, -ROOM.d / 2, 0], [0, ROOM.d / 2, Math.PI],
  [-ROOM.w / 2, 0, Math.PI / 2], [ROOM.w / 2, 0, -Math.PI / 2],
].forEach(([x, z, ry], i) => {
  if (i === 2) return; // left wall is built below with a doorway
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(i < 2 ? ROOM.w : ROOM.d, ROOM.h), wallMat);
  wall.position.set(i < 2 ? 0 : x, ROOM.h / 2, i < 2 ? z : 0);
  wall.rotation.y = ry;
  scene.add(wall);
});

// Gold trim and baseboard, inset from the walls to avoid z-fighting
const trimMat = new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.8, roughness: 0.3 });
function wallStrip(y, h, t) {
  const inset = t / 2 + 0.005;
  [
    [ROOM.w, t, 0, -ROOM.d / 2 + inset],
    [ROOM.w, t, 0, ROOM.d / 2 - inset],
    [t, ROOM.d / 2 - DOOR.hw, -ROOM.w / 2 + inset, -(ROOM.d / 2 + DOOR.hw) / 2],
    [t, ROOM.d / 2 - DOOR.hw, -ROOM.w / 2 + inset, (ROOM.d / 2 + DOOR.hw) / 2],
    [t, ROOM.d, ROOM.w / 2 - inset, 0],
  ].forEach(([w, d, x, z]) => {
    const s = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), trimMat);
    s.position.set(x, y, z);
    scene.add(s);
  });
}
// Left wall with a doorway at z = 0
{
  const segLen = ROOM.d / 2 - DOOR.hw;
  [-1, 1].forEach((sgn) => {
    const seg = new THREE.Mesh(new THREE.PlaneGeometry(segLen, ROOM.h), wallMat);
    seg.position.set(-ROOM.w / 2, ROOM.h / 2, sgn * (DOOR.hw + segLen / 2));
    seg.rotation.y = Math.PI / 2;
    scene.add(seg);
  });
  const lintel = new THREE.Mesh(new THREE.PlaneGeometry(DOOR.hw * 2, ROOM.h - DOOR.h), wallMat);
  lintel.position.set(-ROOM.w / 2, DOOR.h + (ROOM.h - DOOR.h) / 2, 0);
  lintel.rotation.y = Math.PI / 2;
  scene.add(lintel);
}
wallStrip(1.2, 0.12, 0.04);
wallStrip(0.1, 0.2, 0.06);
const darkLights = [];

// ---------- Door & Dark Room ----------
const doorPivot = new THREE.Group();
doorPivot.position.set(-ROOM.w / 2 + 0.05, 0, -DOOR.hw);
{
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, DOOR.h, DOOR.hw * 2),
    new THREE.MeshStandardMaterial({ color: 0x2b1a12, roughness: 0.7 })
  );
  panel.position.set(0, DOOR.h / 2, DOOR.hw);
  const knobD = new THREE.Mesh(new THREE.SphereGeometry(0.06), trimMat);
  knobD.position.set(0.08, 1.1, DOOR.hw * 1.7);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.3), (() => {
    const c = document.createElement('canvas');
    c.width = 280; c.height = 60;
    const g = c.getContext('2d');
    g.fillStyle = '#120a08'; g.fillRect(0, 0, 280, 60);
    g.fillStyle = '#c9a227'; g.font = 'bold 36px Georgia'; g.textAlign = 'center';
    g.fillText('DARK ROOM', 140, 43);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshBasicMaterial({ map: t });
  })());
  sign.position.set(0.05, DOOR.h - 0.3, DOOR.hw);
  sign.rotation.y = Math.PI / 2;
  doorPivot.add(panel, knobD, sign);
}
scene.add(doorPivot);

const darkMat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1 });
const darkGroup = new THREE.Group();
{
  const cx = DARK.minX + DARK.w / 2;
  const f = new THREE.Mesh(new THREE.PlaneGeometry(DARK.w, DARK.d), darkMat(0x1a1713));
  f.rotation.x = -Math.PI / 2; f.position.set(cx, 0, 0);
  const c = new THREE.Mesh(new THREE.PlaneGeometry(DARK.w, DARK.d), darkMat(0x0d0b0a));
  c.rotation.x = Math.PI / 2; c.position.set(cx, DARK.h, 0);
  darkGroup.add(f, c);
  const wm = darkMat(0x1f1c18);
  [[cx, -DARK.d / 2, 0, DARK.w], [cx, DARK.d / 2, Math.PI, DARK.w], [DARK.minX, 0, Math.PI / 2, DARK.d]].forEach(([x, z, ry, w]) => {
    const wl = new THREE.Mesh(new THREE.PlaneGeometry(w, DARK.h), wm);
    wl.position.set(x, DARK.h / 2, z); wl.rotation.y = ry;
    darkGroup.add(wl);
  });
  // Walls of the doorway passage so the wall's thickness isn't see-through
  const top = new THREE.Mesh(new THREE.PlaneGeometry(DARK.d / 2 - DOOR.hw, DARK.h), wm);
  [-1, 1].forEach((sgn) => {
    const seg = top.clone();
    seg.position.set(-ROOM.w / 2 - 0.01, DARK.h / 2, sgn * (DOOR.hw + (DARK.d / 2 - DOOR.hw) / 2));
    seg.rotation.y = -Math.PI / 2;
    darkGroup.add(seg);
  });
  const dl = new THREE.Mesh(new THREE.PlaneGeometry(DOOR.hw * 2, DARK.h - DOOR.h), wm);
  dl.position.set(-ROOM.w / 2 - 0.01, DOOR.h + (DARK.h - DOOR.h) / 2, 0);
  dl.rotation.y = -Math.PI / 2;
  darkGroup.add(dl);
  // Dim, flickering red lights
  [[-12, -5], [-17, 4], [-22, -3], [-21, 6]].forEach(([x, z], i) => {
    const l = new THREE.PointLight(0xff4020, 5, 9);
    l.position.set(x, DARK.h - 0.4, z);
    l.userData.phase = i * 1.7;
    darkGroup.add(l);
    darkLights.push(l);
  });
  // A few stained pillars to break up the space
  [[-14, -5], [-14, 5], [-19, 0], [-23, -6], [-23, 6]].forEach(([x, z]) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.7, DARK.h, 0.7), darkMat(0x2a2620));
    p.position.set(x, DARK.h / 2, z);
    darkGroup.add(p);
    colliders.push({ minX: x - 0.35, maxX: x + 0.35, minZ: z - 0.35, maxZ: z + 0.35 });
  });
}
scene.add(darkGroup);

// ---------- Shop ----------
const SHOP = { x: 7.2, z: 0 };
{
  const counter = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 2.4), new THREE.MeshStandardMaterial({ color: 0x4a2a14, roughness: 0.6 }));
  counter.position.set(SHOP.x, 0.5, SHOP.z);
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 2.5), trimMat);
  top.position.set(SHOP.x, 1.04, SHOP.z);
  const batDisplay = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.06, 0.9, 10), new THREE.MeshStandardMaterial({ color: 0xb98a4e, roughness: 0.6 }));
  batDisplay.position.set(SHOP.x, 1.12, SHOP.z);
  batDisplay.rotation.x = Math.PI / 2;
  const c = document.createElement('canvas');
  c.width = 256; c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = '#1a0208'; g.fillRect(0, 0, 256, 96);
  g.strokeStyle = '#ffd24a'; g.lineWidth = 6; g.strokeRect(3, 3, 250, 90);
  g.fillStyle = '#ffd24a'; g.font = 'bold 36px Georgia'; g.textAlign = 'center';
  g.fillText('WEAPONS SHOP', 128, 58);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.675), new THREE.MeshBasicMaterial({ map: tex }));
  sign.position.set(ROOM.w / 2 - 0.03, 2.6, SHOP.z);
  sign.rotation.y = -Math.PI / 2;
  const lamp = new THREE.PointLight(0xffd9a0, 8, 6);
  lamp.position.set(SHOP.x - 0.6, 2.4, SHOP.z);
  scene.add(counter, top, batDisplay, sign, lamp);
  colliders.push({ minX: SHOP.x - 0.55, maxX: SHOP.x + 0.55, minZ: SHOP.z - 1.25, maxZ: SHOP.z + 1.25 });
}

// ---------- Pill dealer ----------
const DEALER = { x: 7.3, z: 3.2 };
{
  const g = new THREE.Group();
  const c = document.createElement('canvas');
  c.width = 256; c.height = 400;
  const cg = c.getContext('2d');
  cg.fillStyle = '#e8e8e0'; cg.fillRect(0, 0, 256, 400);
  cg.fillStyle = '#7a1020'; cg.font = 'bold 54px Georgia'; cg.textAlign = 'center';
  cg.fillText('PILL', 128, 170);
  cg.fillText('DEALER', 128, 235);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const plain = new THREE.MeshStandardMaterial({ color: 0xe8e8e0 });
  const shirtMats = [plain, plain, plain, plain, new THREE.MeshStandardMaterial({ map: tex }), plain];
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.3), shirtMats);
  torso.position.y = 1.1;
  const skin = new THREE.MeshStandardMaterial({ color: 0xc89870, roughness: 0.8 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 12), skin);
  head.position.y = 1.65;
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.08, 14), new THREE.MeshStandardMaterial({ color: 0x111111 }));
  hat.position.y = 1.78;
  const pants = new THREE.MeshStandardMaterial({ color: 0x1a1a22 });
  [-1, 1].forEach((sx) => {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.75, 0.2), pants);
    l.position.set(sx * 0.13, 0.375, 0);
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.65, 0.12), skin);
    a.position.set(sx * 0.31, 1.07, 0);
    g.add(l, a);
  });
  g.add(torso, head, hat);
  g.position.set(DEALER.x, 0, DEALER.z);
  g.rotation.y = -Math.PI / 2;
  scene.add(g);
  colliders.push({ minX: DEALER.x - 0.3, maxX: DEALER.x + 0.3, minZ: DEALER.z - 0.3, maxZ: DEALER.z + 0.3 });
}

// Lighting
scene.add(new THREE.AmbientLight(0xffe6c0, 0.5));
[[-4, -4], [4, -4], [-4, 4], [4, 4]].forEach(([x, z]) => {
  const l = new THREE.PointLight(0xffd9a0, 18, 14);
  l.position.set(x, ROOM.h - 0.4, z);
  scene.add(l);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.15), new THREE.MeshBasicMaterial({ color: 0xfff0c0 }));
  bulb.position.copy(l.position);
  scene.add(bulb);
});

// ---------- Slot machine ----------
const SYMBOLS = [
  { ch: '🍒', pay: 5 }, { ch: '🍋', pay: 8 }, { ch: '🔔', pay: 15 }, { ch: '⭐', pay: 25 },
  { ch: '🍀', pay: 40 }, { ch: '💎', pay: 60 }, { ch: '7️⃣', pay: 100 }, { ch: '🍇', pay: 12 },
];
const N = SYMBOLS.length;
const CELL_W = 64, CELL_H = 128;

function reelTexture() {
  const c = document.createElement('canvas');
  c.width = CELL_W * N;
  c.height = CELL_H;
  const g = c.getContext('2d');
  g.fillStyle = '#fff8e8';
  g.fillRect(0, 0, c.width, c.height);
  SYMBOLS.forEach((s, i) => {
    g.save();
    g.translate(i * CELL_W + CELL_W / 2, CELL_H / 2);
    g.rotate(Math.PI / 2); // cylinder UVs run sideways
    g.font = '56px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(s.ch, 0, 0);
    g.restore();
    g.fillStyle = '#d8c9a0';
    g.fillRect(i * CELL_W, 0, 2, CELL_H);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const reelTex = reelTexture();
const reelAngle = (idx) => -((idx + 0.5) * 2 * Math.PI) / N;
const machines = [];

const bodyMat = new THREE.MeshStandardMaterial({ color: 0xb01030, metalness: 0.5, roughness: 0.35 });
const goldMat = new THREE.MeshStandardMaterial({ color: 0xffc21a, metalness: 0.9, roughness: 0.25 });

function createMachine(mx, mz) {
  const machine = new THREE.Group();
  machine.position.set(mx, 0, mz);
  scene.add(machine);

  const box = (w, h, d, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    machine.add(m);
    return m;
  };
  box(1.4, 0.3, 0.9, goldMat, 0, 0.15, 0);       // base
box(1.2, 1.1, 0.8, bodyMat, 0, 0.85, 0);       // lower body
box(1.3, 0.12, 0.95, goldMat, 0, 1.45, 0.05);  // control shelf
box(1.2, 0.95, 0.7, bodyMat, 0, 1.95, -0.05);  // upper body
box(1.3, 0.3, 0.8, goldMat, 0, 2.55, -0.05);   // marquee
const marquee = new THREE.Mesh(
  new THREE.PlaneGeometry(1.1, 0.2),
  new THREE.MeshBasicMaterial({ color: 0xfff2a0 })
);
marquee.position.set(0, 2.55, 0.36);
machine.add(marquee);

// Reel window
box(1.0, 0.5, 0.05, new THREE.MeshStandardMaterial({ color: 0x111111 }), 0, 1.95, 0.3);
const reels = [];
for (let i = 0; i < 3; i++) {
  const geo = new THREE.CylinderGeometry(0.25, 0.25, 0.3, 48, 1, false);
  geo.rotateZ(Math.PI / 2);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: reelTex, roughness: 0.4, emissive: 0x332a10 }));
  mesh.position.set((i - 1) * 0.32, 1.95, 0.2);
  machine.add(mesh);
  reels.push({ mesh, state: 'idle', speed: 0, t: 0, from: 0, to: 0, result: 0 });
}
reels.forEach((r, i) => { r.result = i; r.mesh.rotation.x = reelAngle(i); });

// Lever
const lever = new THREE.Group();
lever.position.set(0.68, 1.0, 0);
const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6), new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 1, roughness: 0.2 }));
stick.position.y = 0.3;
const knob = new THREE.Mesh(new THREE.SphereGeometry(0.1), new THREE.MeshStandardMaterial({ color: 0xff2020 }));
knob.position.y = 0.62;
lever.add(stick, knob);
machine.add(lever);

colliders.push({ minX: mx - 0.8, maxX: mx + 0.8, minZ: mz - 0.5, maxZ: mz + 0.55 });
const m = { group: machine, reels, lever, spinning: false };
machines.push(m);
return m;
}

// Line up along the back wall
[-2.2, 0, 2.2].forEach((x) => createMachine(x, -7.3));

// ---------- Blackjack table ----------
function createBlackjackTable(tx, tz) {
  const g = new THREE.Group();
  g.position.set(tx, 0, tz);
  scene.add(g);
  const wood = new THREE.MeshStandardMaterial({ color: 0x3b2314, roughness: 0.6 });
  const felt = new THREE.MeshStandardMaterial({ color: 0x0b6b3a, roughness: 1 });
  const add = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    return m;
  };
  add(new THREE.BoxGeometry(2.0, 0.7, 1.0), wood, 0, 0.35, 0);
  add(new THREE.BoxGeometry(2.6, 0.08, 1.5), wood, 0, 0.74, 0);
  add(new THREE.BoxGeometry(2.4, 0.02, 1.3), felt, 0, 0.79, 0);
  add(new THREE.BoxGeometry(2.7, 0.06, 0.12), new THREE.MeshStandardMaterial({ color: 0x1a1a1a }), 0, 0.77, 0.78);
  const chipColors = [0xd02020, 0x2060d0, 0x202020, 0xe0e0e0];
  for (let s = 0; s < 5; s++) {
    for (let i = 0; i < 3 + (s % 3); i++) {
      add(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 20), new THREE.MeshStandardMaterial({ color: chipColors[s % 4] }), -0.9 + s * 0.45, 0.81 + i * 0.022, 0.3);
    }
  }
  const cardMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  [[-0.15, -0.15, 0.2], [0.05, -0.15, -0.1], [0.3, 0.1, 0.35]].forEach(([x, z, r]) => {
    const c = add(new THREE.BoxGeometry(0.12, 0.004, 0.17), cardMat, x, 0.803, z);
    c.rotation.y = r;
  });
  colliders.push({ minX: tx - 1.35, maxX: tx + 1.35, minZ: tz - 0.8, maxZ: tz + 0.8 });
}
createBlackjackTable(0, 0);

// ---------- Dealer mannequin, chair, dealt cards ----------
const SEAT = { x: 0, z: 1.55 };
const dealer = (() => {
  const g = new THREE.Group();
  g.position.set(0, 0, -1.05);
  scene.add(g);
  const mat = (c, r = 0.7) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
  const part = (geo, m, x, y, z, parent = g) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const skin = mat(0xe8e0d0, 0.4), suit = mat(0x15151a), vest = mat(0x8b0f26), white = mat(0xf5f5f5);
  part(new THREE.BoxGeometry(0.2, 0.8, 0.2), suit, -0.1, 0.4, 0);
  part(new THREE.BoxGeometry(0.2, 0.8, 0.2), suit, 0.1, 0.4, 0);
  const body = new THREE.Group();
  body.position.y = 0.8;
  g.add(body);
  part(new THREE.BoxGeometry(0.5, 0.6, 0.28), suit, 0, 0.3, 0, body);
  part(new THREE.BoxGeometry(0.3, 0.5, 0.01), vest, 0, 0.3, 0.145, body);
  part(new THREE.BoxGeometry(0.14, 0.05, 0.02), mat(0x000000), 0, 0.52, 0.16, body);
  part(new THREE.BoxGeometry(0.1, 0.16, 0.12), skin, 0, 0.68, 0, body);
  const head = new THREE.Group();
  head.position.y = 0.70;
  body.add(head);
  part(new THREE.SphereGeometry(0.13, 20, 16), skin, 0, 0.1, 0, head);
  part(new THREE.CylinderGeometry(0.16, 0.16, 0.01, 20), suit, 0, 0.2, 0, head);
  part(new THREE.CylinderGeometry(0.09, 0.09, 0.08, 20), suit, 0, 0.24, 0, head);
  const arm = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.32, 0.55, 0);
    body.add(pivot);
    part(new THREE.BoxGeometry(0.11, 0.55, 0.11), suit, 0, -0.27, 0, pivot);
    part(new THREE.SphereGeometry(0.06, 12, 10), white, 0, -0.58, 0, pivot);
    pivot.rotation.x = -0.6;
    return pivot;
  };
  const armL = arm(-1), armR = arm(1);
  return { g, body, head, armL, armR, deal: 0, mood: 0, moodT: 0 };
})();
colliders.push({ minX: -0.4, maxX: 0.4, minZ: -1.4, maxZ: -0.7 });

(function createChair() {
  const g = new THREE.Group();
  g.position.set(SEAT.x, 0, SEAT.z);
  scene.add(g);
  const m = new THREE.MeshStandardMaterial({ color: 0x8b0f26, roughness: 0.8 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.8, roughness: 0.3 });
  const add = (geo, mat, x, y, z) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    g.add(mesh);
  };
  add(new THREE.CylinderGeometry(0.25, 0.25, 0.08, 24), m, 0, 0.5, 0);
  add(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 10), metal, 0, 0.25, 0);
  add(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 20), metal, 0, 0.02, 0);
  add(new THREE.BoxGeometry(0.48, 0.45, 0.07), m, 0, 0.78, 0.25);
  colliders.push({ minX: SEAT.x - 0.28, maxX: SEAT.x + 0.28, minZ: SEAT.z - 0.28, maxZ: SEAT.z + 0.32 });
})();

const tableCards = [];
const cardFaceMats = [0xffffff, 0xffffff, 0xffffff, 0x9b1020, 0xffffff, 0xffffff].map((c) => new THREE.MeshStandardMaterial({ color: c }));
cardFaceMats[2] = new THREE.MeshStandardMaterial({ color: 0xfafafa });
function dealCardMesh(who, index, faceDown) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.004, 0.17), cardFaceMats);
  mesh.castShadow = true;
  const start = new THREE.Vector3(0, 1.35, -0.9);
  const end = new THREE.Vector3(-0.3 + index * 0.16, 0.805 + index * 0.003, who === 'dealer' ? -0.3 : 0.3);
  mesh.position.copy(start);
  mesh.rotation.set(faceDown ? Math.PI : 0, 0, 0);
  scene.add(mesh);
  const card = { mesh, start, end, t: 0, faceDown, flip: -1 };
  tableCards.push(card);
  dealer.deal = 1;
  return card;
}
function clearTableCards() {
  tableCards.splice(0).forEach((c) => scene.remove(c.mesh));
}
function updateDealer(t, dt) {
  const { body, head, armL, armR } = dealer;
  body.position.y = 0.8 + Math.sin(t * 1.6) * 0.004;
  body.rotation.z = Math.sin(t * 0.8) * 0.015;
  dealer.deal = Math.max(0, dealer.deal - dt * 2.5);
  dealer.moodT = Math.max(0, dealer.moodT - dt);
  const target = blackjack.active ? Math.atan2(camera.position.x, camera.position.z + 1.05) : 0;
  let nod = 0, shake = 0, shrug = 0;
  if (dealer.moodT > 0) {
    const p = dealer.moodT;
    if (dealer.mood > 0) nod = Math.sin(p * 12) * 0.2;
    else if (dealer.mood < 0) shake = Math.sin(p * 14) * 0.3;
    else shrug = Math.sin(Math.min(1, p) * Math.PI) * 0.3;
  }
  head.rotation.y += ((blackjack.active ? target : Math.sin(t * 0.5) * 0.5) + shake - head.rotation.y) * Math.min(1, dt * 5);
  head.rotation.x = nod + Math.sin(t * 0.9) * 0.02;
  armL.rotation.x = -0.6 - shrug;
  armR.rotation.x = -0.6 - Math.sin(dealer.deal * Math.PI) * 0.9 - shrug;
  armR.rotation.z = -Math.sin(dealer.deal * Math.PI) * 0.2;
  for (const c of tableCards) {
    if (c.t < 1) {
      c.t = Math.min(1, c.t + dt * 2.5);
      const e = 1 - Math.pow(1 - c.t, 3);
      c.mesh.position.lerpVectors(c.start, c.end, e);
      c.mesh.position.y += Math.sin(c.t * Math.PI) * 0.15;
      c.mesh.rotation.y = (1 - e) * 1.5;
    }
    if (c.flip >= 0 && c.flip < 1) {
      c.flip = Math.min(1, c.flip + dt * 3);
      c.mesh.rotation.x = Math.PI * (1 - c.flip);
      c.mesh.position.y = c.end.y + Math.sin(c.flip * Math.PI) * 0.12;
    }
  }
}

// ---------- Game state ----------
const BET_STEPS = [10, 25, 50, 100, 250, 500, 1000, 5000, 10000];
let bet = 10;
let handBet = bet;
let credits = 1000;
let playing = false;
const blackjack = { active: false, phase: 'idle', deck: [], player: [], dealer: [], result: '', dealToken: 0 };
const updateCredits = () => ($('credits').textContent = credits);

function showMsg(text, ms = 2500) {
  const el = $('msg');
  el.textContent = text;
  el.style.display = 'block';
  clearTimeout(showMsg.t);
  showMsg.t = setTimeout(() => (el.style.display = 'none'), ms);
}

function makeDeck() {
  const suits = ['♠', '♥', '♦', '♣'];
  const deck = suits.flatMap((suit) => Array.from({ length: 13 }, (_, index) => ({
    rank: index + 1,
    suit,
    label: ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'][index],
  })));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function handValue(hand) {
  let total = 0;
  let aces = 0;
  for (const card of hand) {
    total += Math.min(card.rank, 10);
    if (card.rank === 1) aces++;
  }
  while (aces > 0 && total + 10 <= 21) {
    total += 10;
    aces--;
  }
  return total;
}

function drawCard(hand, who = 'player', faceDown = false) {
  const card = blackjack.deck.pop();
  card.mesh = dealCardMesh(who, hand.length, faceDown);
  hand.push(card);
}

function renderBlackjack(hideHole = blackjack.phase === 'playing') {
  const cardText = (hand) => hand.map((card) => `${card.label}${card.suit}`).join('  ');
  $('bj-player').textContent = `${cardText(blackjack.player)} (${handValue(blackjack.player)})`;
  const dealerCards = hideHole ? `${cardText([blackjack.dealer[0]])}  🂠` : `${cardText(blackjack.dealer)} (${handValue(blackjack.dealer)})`;
  $('bj-dealer').textContent = dealerCards;
  $('bj-status').textContent = blackjack.result || '';
  $('bj-bet').textContent = blackjack.phase === 'playing' ? handBet : bet;
}

function adjustBet(dir) {
  if (roulette.active && roulette.phase === 'spinning') return;
  if (dice.active && dice.phase === 'rolling') return;
  if (blackjack.active && blackjack.phase === 'playing') return;
  if (dir > 0) {
    const next = BET_STEPS.find((s) => s > bet);
    bet = next && next <= credits ? next : Math.max(bet, Math.min(credits, BET_STEPS[BET_STEPS.length - 1]));
  } else {
    const prev = [...BET_STEPS].reverse().find((s) => s < bet);
    bet = prev || BET_STEPS[0];
  }
  if (blackjack.active) renderBlackjack();
  else if (roulette.active) renderRoulette();
  else if (dice.active) renderDice();
  else showMsg(`Bet: ${bet} credits`, 1000);
}

function startBlackjackHand() {
  if (credits <= 0) {
    blackjack.result = 'Out of credits. Press Q to leave.';
    renderBlackjack();
    return;
  }
  bet = Math.min(bet, credits);
  handBet = bet;
  credits -= handBet;
  updateCredits();
  clearTableCards();
  blackjack.deck = makeDeck();
  blackjack.player = [];
  blackjack.dealer = [];
  blackjack.result = '';
  blackjack.phase = 'playing';
  // Stagger the deal so the dealer visibly hands out each card.
  const seq = [
    () => drawCard(blackjack.player, 'player'),
    () => drawCard(blackjack.dealer, 'dealer'),
    () => drawCard(blackjack.player, 'player'),
    () => drawCard(blackjack.dealer, 'dealer', true),
  ];
  blackjack.phase = 'dealing';
  const token = ++blackjack.dealToken;
  seq.forEach((fn, i) => setTimeout(() => {
    if (token !== blackjack.dealToken || !blackjack.active) return;
    fn();
    if (i === seq.length - 1) {
      blackjack.phase = 'playing';
      if (handValue(blackjack.player) === 21) finishBlackjackHand();
      else renderBlackjack();
    } else renderBlackjack(true);
  }, i * 350));
  renderBlackjack(true);
}

function finishBlackjackHand() {
  const hole = blackjack.dealer[1];
  if (hole && hole.mesh.faceDown) { hole.mesh.faceDown = false; hole.mesh.flip = 0; }
  while (handValue(blackjack.dealer) < 17) drawCard(blackjack.dealer, 'dealer');
  const playerTotal = handValue(blackjack.player);
  const dealerTotal = handValue(blackjack.dealer);
  const natural = blackjack.player.length === 2 && playerTotal === 21;
  let payout = 0;
  let mood = -1;
  if (playerTotal > 21) blackjack.result = 'Bust. Dealer wins. Press E for another hand.';
  else if (natural && !(blackjack.dealer.length === 2 && dealerTotal === 21)) {
    payout = handBet * 2.5;
    mood = 1;
    blackjack.result = 'Blackjack! Pays 3:2. Press E for another hand.';
  } else if (dealerTotal > 21 || playerTotal > dealerTotal) {
    payout = handBet * 2;
    mood = 1;
    blackjack.result = 'You win! Press E for another hand.';
  } else if (playerTotal === dealerTotal) {
    payout = handBet;
    mood = 0;
    blackjack.result = 'Push. Your bet is returned. Press E for another hand.';
  } else blackjack.result = 'Dealer wins. Press E for another hand.';
  if (mood < 0) addSadness(LOSS_SADNESS);
  credits += payout;
  updateCredits();
  dealer.mood = mood;
  dealer.moodT = 1.2;
  blackjack.phase = 'settled';
  renderBlackjack(false);
}

function enterBlackjack() {
  blackjack.active = true;
  blackjack.phase = 'betting';
  blackjack.result = '';
  blackjack.player = [];
  blackjack.dealer = [];
  clearTableCards();
  // Lock the player into the chair, facing the dealer.
  player.pos.set(SEAT.x, 0, SEAT.z);
  player.vel.set(0, 0, 0);
  player.yaw = 0;
  player.pitch = -0.35;
  camera.position.set(SEAT.x, 1.25, SEAT.z);
  camera.rotation.set(player.pitch, player.yaw, 0);
  $('blackjack').style.display = 'block';
  renderBlackjack();
  $('bj-status').textContent = 'Set your bet, then press E to deal.';
}

function leaveBlackjack() {
  blackjack.active = false;
  blackjack.phase = 'idle';
  blackjack.dealToken++;
  clearTableCards();
  player.pos.set(SEAT.x, 0, SEAT.z + 0.9);
  $('blackjack').style.display = 'none';
}

function hitBlackjack() {
  if (!blackjack.active || blackjack.phase !== 'playing') return;
  drawCard(blackjack.player);
  if (handValue(blackjack.player) >= 21) finishBlackjackHand();
  else renderBlackjack();
}

function standBlackjack() {
  if (!blackjack.active || blackjack.phase !== 'playing') return;
  finishBlackjackHand();
}

// ---------- Roulette table ----------
const ROUL = { x: 5.2, z: 6.4, standZ: 4.95 };
const WHEEL_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const POCKET = (Math.PI * 2) / 37;
const BET_TYPES = [
  { key: 'Digit1', name: 'Red', win: (n) => RED.has(n), pay: 2 },
  { key: 'Digit2', name: 'Black', win: (n) => n > 0 && !RED.has(n), pay: 2 },
  { key: 'Digit3', name: 'Odd', win: (n) => n > 0 && n % 2 === 1, pay: 2 },
  { key: 'Digit4', name: 'Even', win: (n) => n > 0 && n % 2 === 0, pay: 2 },
  { key: 'Digit5', name: '1-18', win: (n) => n >= 1 && n <= 18, pay: 2 },
  { key: 'Digit6', name: '19-36', win: (n) => n >= 19, pay: 2 },
  { key: 'Digit7', name: 'Number', win: (n) => n === roulette.number, pay: 36 },
];
const roulette = { active: false, phase: 'idle', type: 0, number: 17, result: '', spinT: 0, wheelRot: 0, fromRot: 0, final: 0, winning: 0, offsetTurns: 0, handBet: 0, lastNum: null };

const rouletteParts = (() => {
  const g = new THREE.Group();
  g.position.set(ROUL.x, 0, ROUL.z);
  scene.add(g);
  const wood = new THREE.MeshStandardMaterial({ color: 0x3b2314, roughness: 0.6 });
  const feltMat = new THREE.MeshStandardMaterial({ color: 0x0b6b3a, roughness: 1 });
  const add = (geo, mat, x, y, z, parent = g) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  add(new THREE.BoxGeometry(2.6, 0.7, 1.1), wood, 0, 0.35, 0);
  add(new THREE.BoxGeometry(3.0, 0.08, 1.4), wood, 0, 0.74, 0);
  add(new THREE.BoxGeometry(2.8, 0.02, 1.2), feltMat, 0, 0.79, 0);

  // Betting layout texture
  const cv = document.createElement('canvas');
  cv.width = 800; cv.height = 300;
  const c = cv.getContext('2d');
  c.fillStyle = '#0b6b3a'; c.fillRect(0, 0, 800, 300);
  c.strokeStyle = '#f5e8c8'; c.lineWidth = 3; c.font = 'bold 40px Georgia'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.strokeRect(2, 2, 70, 296);
  c.fillStyle = '#f5e8c8'; c.fillText('0', 37, 150);
  for (let col = 0; col < 12; col++) for (let row = 0; row < 3; row++) {
    const n = col * 3 + (3 - row);
    const x = 72 + col * 60, y = 2 + row * 74;
    c.fillStyle = RED.has(n) ? '#b01020' : '#151515';
    c.fillRect(x, y, 60, 74);
    c.strokeRect(x, y, 60, 74);
    c.fillStyle = '#fff'; c.font = 'bold 30px Georgia';
    c.fillText(String(n), x + 30, y + 37);
  }
  c.font = 'bold 28px Georgia';
  [['1-18', 0, 2], ['EVEN', 2, 2], ['RED', 4, 2], ['BLACK', 6, 2], ['ODD', 8, 2], ['19-36', 10, 2]].forEach(([t, i, w]) => {
    const x = 72 + i * 60;
    c.strokeRect(x, 230, 120, 66);
    c.fillStyle = t === 'RED' ? '#d02030' : t === 'BLACK' ? '#222' : '#f5e8c8';
    if (t === 'RED' || t === 'BLACK') c.fillRect(x + 20, 245, 80, 36);
    c.fillStyle = '#fff';
    c.fillText(t, x + 60, 263);
  });
  const layout = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.6), new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(cv), roughness: 1 }));
  layout.rotation.x = -Math.PI / 2;
  layout.rotation.z = Math.PI; // text faces the player, not the wall
  layout.position.set(0.55, 0.805, 0);
  g.add(layout);

  // Wheel
  const wheelBase = add(new THREE.CylinderGeometry(0.46, 0.5, 0.06, 40), wood, -0.8, 0.83, 0);
  const wheel = new THREE.Group();
  wheel.position.set(-0.8, 0.87, 0);
  g.add(wheel);
  WHEEL_ORDER.forEach((n, i) => {
    const color = n === 0 ? 0x0a8a3a : RED.has(n) ? 0xb01020 : 0x151515;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.03, 3, 1, false, i * POCKET, POCKET), new THREE.MeshStandardMaterial({ color, roughness: 0.5 }));
    m.castShadow = true;
    wheel.add(m);
  });
  const gold = new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.8, roughness: 0.3 });
  add(new THREE.CylinderGeometry(0.14, 0.14, 0.05, 24), gold, 0, 0.03, 0, wheel);
  add(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 8), gold, 0, 0.1, 0, wheel);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.03, 8, 40), wood);
  rim.rotation.x = Math.PI / 2;
  rim.position.set(-0.8, 0.87, 0);
  g.add(rim);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 10), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 }));
  ball.position.set(-0.8 + 0.3, 0.9, 0);
  g.add(ball);
  return { g, wheel, ball, cx: -0.8 };
})();
colliders.push({ minX: ROUL.x - 1.55, maxX: ROUL.x + 1.55, minZ: ROUL.z - 0.75, maxZ: ROUL.z + 0.75 });

// Mannequin wearing a "LET IT RIDE" shirt
(function createShirtMannequin() {
  const mx = 7.1, mz = 4.4;
  const g = new THREE.Group();
  g.position.set(mx, 0, mz);
  g.rotation.y = Math.atan2(-mx, -mz);
  scene.add(g);
  const mat = (col, r = 0.5) => new THREE.MeshStandardMaterial({ color: col, roughness: r });
  const part = (geo, m, x, y, z) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    g.add(mesh);
    return mesh;
  };
  const skin = mat(0xe8e0d0, 0.4), pants = mat(0x2a3550), shirt = mat(0x151515, 0.8), gold = mat(0xc9a227, 0.3);
  part(new THREE.CylinderGeometry(0.25, 0.28, 0.04, 24), gold, 0, 0.02, 0);
  part(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 8), gold, 0, 0.12, 0);
  part(new THREE.BoxGeometry(0.2, 0.75, 0.2), pants, -0.11, 0.55, 0);
  part(new THREE.BoxGeometry(0.2, 0.75, 0.2), pants, 0.11, 0.55, 0);
  part(new THREE.BoxGeometry(0.5, 0.62, 0.26), shirt, 0, 1.2, 0);
  part(new THREE.BoxGeometry(0.1, 0.12, 0.1), skin, 0, 1.57, 0);
  part(new THREE.SphereGeometry(0.13, 20, 16), skin, 0, 1.76, 0);
  [-1, 1].forEach((s) => {
    part(new THREE.BoxGeometry(0.11, 0.55, 0.11), shirt, s * 0.31, 1.2, 0).rotation.z = s * 0.1;
    part(new THREE.SphereGeometry(0.055, 12, 10), skin, s * 0.35, 0.9, 0);
  });
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 256;
  const c = cv.getContext('2d');
  c.fillStyle = '#151515'; c.fillRect(0, 0, 256, 256);
  c.fillStyle = '#ffd24a'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = 'bold 70px Georgia';
  ['LET', 'IT', 'RIDE'].forEach((w, i) => c.fillText(w, 128, 55 + i * 75));
  const print = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.44), new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(cv), roughness: 0.8 }));
  print.position.set(0, 1.2, 0.135);
  g.add(print);
  colliders.push({ minX: mx - 0.3, maxX: mx + 0.3, minZ: mz - 0.3, maxZ: mz + 0.3 });
})();

function renderRoulette() {
  const t = BET_TYPES[roulette.type];
  const betName = t.name === 'Number' ? `Number ${roulette.number}` : t.name;
  $('rl-bet').textContent = `${roulette.phase === 'spinning' ? roulette.handBet : bet} credits on ${betName}`;
  $('rl-last').textContent = roulette.lastNum === null ? '-' : `${roulette.lastNum} ${roulette.lastNum === 0 ? 'green' : RED.has(roulette.lastNum) ? 'red' : 'black'}`;
  $('rl-status').textContent = roulette.result || 'Pick a bet, then press E to spin.';
}

function enterRoulette() {
  roulette.active = true;
  roulette.phase = 'betting';
  roulette.result = '';
  player.pos.set(ROUL.x, 0, ROUL.standZ);
  player.vel.set(0, 0, 0);
  player.yaw = Math.PI;
  player.pitch = -0.55;
  camera.position.set(ROUL.x, 1.7, ROUL.standZ);
  camera.rotation.set(player.pitch, player.yaw, 0);
  $('roulette').style.display = 'block';
  renderRoulette();
}

function leaveRoulette() {
  if (roulette.phase === 'spinning') return;
  roulette.active = false;
  roulette.phase = 'idle';
  $('roulette').style.display = 'none';
  player.pos.set(ROUL.x - 1.6, 0, ROUL.standZ - 0.4);
}

function spinRoulette() {
  if (roulette.phase === 'spinning') return;
  if (credits < bet) { roulette.result = 'Not enough credits for that bet.'; renderRoulette(); return; }
  roulette.handBet = bet;
  credits -= bet;
  updateCredits();
  roulette.winning = Math.floor(Math.random() * 37);
  roulette.phase = 'spinning';
  roulette.spinT = 0;
  roulette.fromRot = roulette.wheelRot;
  roulette.result = 'No more bets...';
  renderRoulette();
}

function settleRoulette() {
  const n = WHEEL_ORDER[roulette.winning];
  roulette.lastNum = n;
  roulette.phase = 'betting';
  const t = BET_TYPES[roulette.type];
  if (t.win(n)) {
    const win = roulette.handBet * t.pay;
    credits += win;
    updateCredits();
    roulette.result = `${n}! You win ${win}. Press E to spin again.`;
    dealer.mood = 1;
    dealer.moodT = 1.2;
  } else {
    roulette.result = `${n}. You lose. Press E to spin again.`;
    addSadness(LOSS_SADNESS);
  }
  renderRoulette();
}

function roulettePick(e) {
  if (e.code === 'KeyQ') return leaveRoulette();
  if (roulette.phase === 'spinning') return;
  if (e.code === 'KeyE') return spinRoulette();
  const i = BET_TYPES.findIndex((b) => b.key === e.code);
  if (i >= 0) roulette.type = i;
  if (e.code === 'BracketRight') { roulette.number = (roulette.number + 1) % 37; roulette.type = 6; }
  if (e.code === 'BracketLeft') { roulette.number = (roulette.number + 36) % 37; roulette.type = 6; }
  if (e.code === 'Equal' || e.code === 'NumpadAdd' || e.code === 'ArrowUp') adjustBet(1);
  if (e.code === 'Minus' || e.code === 'NumpadSubtract' || e.code === 'ArrowDown') adjustBet(-1);
  renderRoulette();
}

const TAU = Math.PI * 2;
function updateRoulette(dt) {
  const { wheel, ball, cx } = rouletteParts;
  const DUR = 7;
  let offset = 0, radius = 0.3, height = 0.9;
  if (roulette.phase === 'spinning') {
    roulette.spinT += dt;
    const p = Math.min(1, roulette.spinT / DUR);
    roulette.wheelRot = roulette.fromRot + 2.5 * DUR * (1 - (1 - p) * (1 - p));
    offset = -(10 * TAU) * (1 - p) * (1 - p);
    radius = p < 0.75 ? 0.37 : 0.37 - 0.1 * ((p - 0.75) / 0.25);
    height = 0.9 + (p > 0.85 ? Math.abs(Math.sin((p - 0.85) * 40)) * 0.04 * (1 - p) * 6 : 0);
    if (p >= 1) settleRoulette();
  } else {
    wheel.rotation.y = roulette.wheelRot += dt * 0.3;
  }
  wheel.rotation.y = roulette.wheelRot;
  const ang = roulette.wheelRot + (roulette.winning + 0.5) * POCKET + offset;
  if (roulette.phase === 'spinning' || roulette.lastNum !== null) {
    ball.position.set(cx + Math.sin(ang) * (roulette.phase === 'spinning' ? radius : 0.27), height, Math.cos(ang) * (roulette.phase === 'spinning' ? radius : 0.27));
  }
}

// ---------- Dice table ----------
const DICE = { x: -5.2, z: 6.4, standZ: 5.0 };
const D_HALF = 0.04;
const FLOOR_Y = 0.8 + D_HALF;
const DICE_BETS = [
  { key: 'Digit1', name: 'Over 7', win: (n) => n > 7, pay: 2 },
  { key: 'Digit2', name: 'Under 7', win: (n) => n < 7, pay: 2 },
  { key: 'Digit3', name: 'Lucky 7', win: (n) => n === 7, pay: 5 },
];
const dice = { active: false, phase: 'idle', type: 0, handBet: 0, result: '', last: null, rollT: 0, swing: 0, list: [] };

(function createDiceTable() {
  const g = new THREE.Group();
  g.position.set(DICE.x, 0, DICE.z);
  scene.add(g);
  const wood = new THREE.MeshStandardMaterial({ color: 0x3b2314, roughness: 0.6 });
  const add = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    return m;
  };
  add(new THREE.BoxGeometry(2.6, 0.7, 1.1), wood, 0, 0.35, 0);
  add(new THREE.BoxGeometry(3.0, 0.08, 1.4), wood, 0, 0.74, 0);
  const cv = document.createElement('canvas');
  cv.width = 560; cv.height = 240;
  const c = cv.getContext('2d');
  c.fillStyle = '#14407a'; c.fillRect(0, 0, 560, 240);
  c.strokeStyle = '#f5e8c8'; c.fillStyle = '#f5e8c8'; c.lineWidth = 4;
  c.font = 'bold 30px Georgia'; c.textAlign = 'center'; c.textBaseline = 'middle';
  [['OVER 7', 0], ['LUCKY 7', 1], ['UNDER 7', 2]].forEach(([t, i]) => {
    c.strokeRect(20 + i * 180, 20, 160, 110);
    c.fillText(t, 100 + i * 180, 75);
  });
  c.font = 'bold 22px Georgia';
  c.fillText('PAYS 1:1', 100, 105); c.fillText('PAYS 4:1', 280, 105); c.fillText('PAYS 1:1', 460, 105);
  c.fillText('PICK UP THE DICE AND THROW THEM HERE', 280, 190);
  const felt = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.2), new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(cv), roughness: 1 }));
  felt.rotation.x = -Math.PI / 2;
  felt.rotation.z = Math.PI; // text faces the player, not the wall
  felt.position.set(0, 0.801, 0);
  felt.receiveShadow = true;
  g.add(felt);
  add(new THREE.BoxGeometry(2.84, 0.16, 0.08), wood, 0, 0.86, 0.66);
  add(new THREE.BoxGeometry(2.84, 0.16, 0.08), wood, 0, 0.86, -0.66);
  add(new THREE.BoxGeometry(0.08, 0.16, 1.4), wood, -1.36, 0.86, 0);
  add(new THREE.BoxGeometry(0.08, 0.16, 1.4), wood, 1.36, 0.86, 0);
  add(new THREE.CylinderGeometry(0.18, 0.18, 0.004, 24), new THREE.MeshStandardMaterial({ color: 0x1a1a1a }), 0, 0.803, -0.35);
})();
colliders.push({ minX: DICE.x - 1.55, maxX: DICE.x + 1.55, minZ: DICE.z - 0.75, maxZ: DICE.z + 0.75 });

const pipLayouts = {
  1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};
// Box material order is +x, -x, +y, -y, +z, -z.
const FACE_VALUES = [1, 6, 2, 5, 3, 4];
const FACE_AXES = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map((a) => new THREE.Vector3(...a));
const diceMats = FACE_VALUES.map((n) => {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const c = cv.getContext('2d');
  c.fillStyle = '#f4efe0'; c.fillRect(0, 0, 128, 128);
  c.fillStyle = n === 1 ? '#c01020' : '#111';
  pipLayouts[n].forEach(([x, y]) => { c.beginPath(); c.arc(64 + x * 32, 64 + y * 32, n === 1 ? 20 : 12, 0, TAU); c.fill(); });
  return new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(cv), roughness: 0.3 });
});

dice.list = [0, 1].map(() => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(D_HALF * 2, D_HALF * 2, D_HALF * 2), diceMats);
  mesh.castShadow = true;
  scene.add(mesh);
  return { mesh, vel: new THREE.Vector3(), omega: new THREE.Vector3(), still: 0 };
});

function resetDice() {
  dice.list.forEach((d, i) => {
    d.mesh.position.set(DICE.x + (i ? 0.1 : -0.1), FLOOR_Y, DICE.z - 0.35);
    d.mesh.quaternion.setFromEuler(new THREE.Euler(0, Math.random() * 6, 0));
    d.vel.set(0, 0, 0);
    d.omega.set(0, 0, 0);
    d.still = 0;
  });
}
resetDice();

const diceTopValue = (d) => {
  let best = -2, val = 1;
  FACE_AXES.forEach((a, i) => {
    const y = a.clone().applyQuaternion(d.mesh.quaternion).y;
    if (y > best) { best = y; val = FACE_VALUES[i]; }
  });
  return val;
};

function renderDice() {
  const t = DICE_BETS[dice.type];
  $('dc-bet').textContent = `${dice.phase === 'rolling' ? dice.handBet : bet} credits on ${t.name}`;
  $('dc-last').textContent = dice.last ? `${dice.last[0]} + ${dice.last[1]} = ${dice.last[0] + dice.last[1]}` : '-';
  $('dc-status').textContent = dice.result || 'Aim at the dice, hold left click to pick them up, release to throw.';
}

function enterDice() {
  dice.active = true;
  dice.phase = 'betting';
  dice.result = '';
  player.pos.set(DICE.x, 0, DICE.standZ);
  player.vel.set(0, 0, 0);
  player.yaw = Math.PI;
  player.pitch = -0.7;
  camera.position.set(DICE.x, 1.7, DICE.standZ);
  camera.rotation.set(player.pitch, player.yaw, 0);
  $('dice').style.display = 'block';
  renderDice();
}

function leaveDice() {
  if (dice.phase === 'rolling') return;
  dice.active = false;
  dice.phase = 'idle';
  resetDice();
  $('dice').style.display = 'none';
  player.pos.set(DICE.x + 1.6, 0, DICE.standZ - 0.4);
}

function grabDice() {
  if (dice.phase !== 'betting' && dice.phase !== 'result') return;
  camera.updateMatrixWorld();
  const rc = new THREE.Raycaster();
  rc.setFromCamera({ x: 0, y: 0 }, camera);
  const hit = rc.intersectObjects(dice.list.map((d) => d.mesh))[0];
  if (!hit || hit.distance > 2.5) { dice.result = 'Aim the crosshair at the dice to pick them up.'; return renderDice(); }
  if (credits < bet) { dice.result = 'Not enough credits for that bet.'; return renderDice(); }
  dice.phase = 'held';
  dice.swing = 0;
  dice.result = 'Release left click to throw. Flick the mouse up for more power.';
  renderDice();
}

function throwDice() {
  dice.phase = 'rolling';
  dice.rollT = 0;
  dice.handBet = bet;
  credits -= bet;
  updateCredits();
  camera.updateMatrixWorld();
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const speed = 3 + Math.min(2.5, dice.swing / 120);
  dice.list.forEach((d) => {
    d.vel.copy(dir).multiplyScalar(speed).add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.8, (Math.random() - 0.5) * 0.4));
    d.omega.set((Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40);
    d.still = 0;
  });
  dice.result = 'Rolling...';
  renderDice();
}

function resolveDice() {
  const vals = dice.list.map(diceTopValue);
  const sum = vals[0] + vals[1];
  dice.last = vals;
  dice.phase = 'result';
  const t = DICE_BETS[dice.type];
  if (t.win(sum)) {
    const win = dice.handBet * t.pay;
    credits += win;
    updateCredits();
    dice.result = `${sum}! You win ${win}. Pick up the dice to roll again.`;
  } else { dice.result = `${sum}. You lose. Pick up the dice to roll again.`; addSadness(LOSS_SADNESS); }
  renderDice();
}

function dicePick(e) {
  if (e.code === 'KeyQ') {
    if (dice.phase === 'held') { resetDice(); dice.phase = 'betting'; }
    return leaveDice();
  }
  if (dice.phase === 'rolling') return;
  const i = DICE_BETS.findIndex((b) => b.key === e.code);
  if (i >= 0) dice.type = i;
  if (e.code === 'Equal' || e.code === 'NumpadAdd') adjustBet(1);
  if (e.code === 'Minus' || e.code === 'NumpadSubtract') adjustBet(-1);
  renderDice();
}

addEventListener('mousedown', (e) => {
  if (e.button === 0 && playing && weapon !== 'flash' && (hasBat || hasAxe) && !dice.active && !blackjack.active && !roulette.active) swingWeapon();
  if (e.button === 0 && dice.active && playing) grabDice();
});
addEventListener('mouseup', (e) => {
  if (e.button === 0 && dice.active && dice.phase === 'held') throwDice();
});

const _dq = new THREE.Quaternion(), _ax = new THREE.Vector3();
function stepDie(d, dt, other) {
  const p = d.mesh.position, v = d.vel;
  v.y -= 9.8 * dt;
  p.addScaledVector(v, dt);
  const w = d.omega.length();
  if (w > 1e-4) {
    _dq.setFromAxisAngle(_ax.copy(d.omega).divideScalar(w), w * dt);
    d.mesh.quaternion.premultiply(_dq).normalize();
  }
  const lx = p.x - DICE.x, lz = p.z - DICE.z;
  let onFloor = false;
  if (Math.abs(lx) < 1.5 && lz > -0.7 && lz < 0.7) {
    if (p.y < 0.98) {
      if (lx > 1.28) { p.x = DICE.x + 1.28; v.x = -Math.abs(v.x) * 0.5; d.omega.multiplyScalar(0.8); }
      if (lx < -1.28) { p.x = DICE.x - 1.28; v.x = Math.abs(v.x) * 0.5; d.omega.multiplyScalar(0.8); }
      if (lz > 0.58) { p.z = DICE.z + 0.58; v.z = -Math.abs(v.z) * 0.5; d.omega.multiplyScalar(0.8); }
      if (lz < -0.58 && v.z < 0) { p.z = DICE.z - 0.58; v.z = Math.abs(v.z) * 0.5; d.omega.multiplyScalar(0.8); }
    }
    if (p.y <= FLOOR_Y && v.y < 0) {
      p.y = FLOOR_Y;
      v.y = Math.abs(v.y) > 0.5 ? -v.y * 0.4 : 0;
      onFloor = true;
    }
  }
  if (onFloor || (Math.abs(lx) < 1.5 && Math.abs(lz) < 0.7 && p.y <= FLOOR_Y + 0.001)) {
    const f = Math.max(0, 1 - 3 * dt);
    v.x *= f; v.z *= f;
    d.omega.multiplyScalar(Math.max(0, 1 - 3 * dt));
    if (Math.hypot(v.x, v.z) > 0.3) d.omega.x += (v.z / D_HALF) * 0.3 * dt * 10, d.omega.z -= (v.x / D_HALF) * 0.3 * dt * 10;
    if (Math.hypot(v.x, v.z) < 0.25 && d.omega.length() < 3) {
      // Settle flat on whichever face is closest to up.
      let best = null, by = -2;
      for (const a of FACE_AXES) {
        const wa = a.clone().applyQuaternion(d.mesh.quaternion);
        if (wa.y > by) { by = wa.y; best = wa; }
      }
      _dq.identity().slerp(new THREE.Quaternion().setFromUnitVectors(best, new THREE.Vector3(0, 1, 0)), Math.min(1, dt * 12));
      d.mesh.quaternion.premultiply(_dq).normalize();
      v.multiplyScalar(0.8); d.omega.multiplyScalar(0.8);
      d.still = by > 0.9995 && Math.hypot(v.x, v.z) < 0.05 ? d.still + dt : 0;
    } else d.still = 0;
  }
  const dx = other.mesh.position.x - p.x, dz = other.mesh.position.z - p.z;
  const dist = Math.hypot(dx, dz);
  if (dist < D_HALF * 2 && Math.abs(other.mesh.position.y - p.y) < D_HALF * 2 && dist > 1e-4) {
    const nx = dx / dist, nz = dz / dist;
    p.x -= nx * (D_HALF * 2 - dist) / 2;
    p.z -= nz * (D_HALF * 2 - dist) / 2;
    const rel = (v.x - other.vel.x) * nx + (v.z - other.vel.z) * nz;
    if (rel > 0) { v.x -= rel * nx * 0.7; v.z -= rel * nz * 0.7; other.vel.x += rel * nx * 0.7; other.vel.z += rel * nz * 0.7; }
  }
}

function updateDice(dt) {
  if (!dice.active) return;
  dice.swing = Math.min(400, dice.swing * Math.max(0, 1 - dt * 6));
  if (dice.phase === 'held') {
    camera.updateMatrixWorld();
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const right = new THREE.Vector3().crossVectors(dir, camera.up).normalize();
    dice.list.forEach((d, i) => {
      d.mesh.position.copy(camera.position).addScaledVector(dir, 0.55).addScaledVector(right, (i ? 1 : -1) * 0.05);
      d.mesh.position.y -= 0.12;
      d.mesh.rotation.y += dt * 2;
      d.vel.set(0, 0, 0);
    });
  } else if (dice.phase === 'rolling') {
    dice.rollT += dt;
    const steps = 4;
    for (let s = 0; s < steps; s++) {
      stepDie(dice.list[0], dt / steps, dice.list[1]);
      stepDie(dice.list[1], dt / steps, dice.list[0]);
    }
    const fell = dice.list.some((d) => d.mesh.position.y < 0.3) || dice.rollT > 12;
    if (fell) {
      credits += dice.handBet;
      updateCredits();
      resetDice();
      dice.phase = 'betting';
      dice.result = 'Dice left the table. No roll - bet refunded.';
      renderDice();
    } else if (dice.rollT > 0.5 && dice.list.every((d) => d.still > 0.4)) resolveDice();
  }
}

function spin(m) {
  if (m.spinning) return;
  if (credits < bet) return showMsg('Not enough credits!');
  m.bet = bet;
  credits -= bet;
  updateCredits();
  m.spinning = true;
  m.reels.forEach((r, i) => {
    r.state = 'spin';
    r.speed = 14 + i;
    r.stopAt = performance.now() + 1200 + i * 600;
    // Placeholder RNG; replace with server-side result for online play.
    r.result = Math.floor(Math.random() * N);
  });
  m.lever.userData.pull = 0.5;
}

function settle(m) {
  const [a, b, c] = m.reels.map((r) => r.result);
  let win = 0;
  if (a === b && b === c) win = SYMBOLS[a].pay * m.bet;
  else if (a === b || b === c || a === c) win = m.bet * 2;
  m.spinning = false;
  if (win) {
    credits += win;
    updateCredits();
    showMsg(`You won ${win}!`);
  } else addSadness(LOSS_SADNESS);
}

function updateReels(m, dt) {
  const { reels, lever } = m;
  const now = performance.now();
  for (const r of reels) {
    if (r.state === 'spin') {
      r.mesh.rotation.x -= r.speed * dt;
      if (now >= r.stopAt) {
        r.state = 'stop';
        r.t = 0;
        r.from = r.mesh.rotation.x;
        const target = reelAngle(r.result);
        // Land on the target at least one full turn ahead, in the spin direction.
        const turns = Math.ceil((r.from - 2 * Math.PI - target) / (2 * Math.PI));
        r.to = target + turns * 2 * Math.PI;
      }
    } else if (r.state === 'stop') {
      r.t = Math.min(1, r.t + dt / 0.9);
      const e = 1 - Math.pow(1 - r.t, 3);
      r.mesh.rotation.x = r.from + (r.to - r.from) * e;
      if (r.t >= 1) {
        r.state = 'idle';
        if (reels.every((x) => x.state === 'idle')) settle(m);
      }
    }
  }
  if (lever.userData.pull > 0) {
    lever.userData.pull -= dt;
    lever.rotation.x = Math.sin(Math.max(0, lever.userData.pull) * Math.PI) * 1.0;
  } else lever.rotation.x = 0;
}

// ---------- Plinko machine ----------
const PL = { x: 4.6, z: -7.75, spacing: 0.16, rows: 8, topY: 2.45, rowH: 0.17, floorY: 0.5, dividerTop: 1.15, ballR: 0.04, maxBalls: 12 };
const PL_MULT = [10, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 10];
const PL_HALF_W = (PL_MULT.length / 2) * PL.spacing;
const plinko = { balls: [], group: null };

(function createPlinko() {
  const g = new THREE.Group();
  g.position.set(PL.x, 0, PL.z);
  scene.add(g);
  plinko.group = g;
  const add = (geo, mat, x, y, z, cast = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = cast;
    m.receiveShadow = true;
    g.add(m);
    return m;
  };
  const boardMat = new THREE.MeshStandardMaterial({ color: 0x14102a, roughness: 0.6 });
  add(new THREE.BoxGeometry(1.7, 0.4, 0.5), goldMat, 0, 0.2, 0.1);
  add(new THREE.BoxGeometry(1.6, 2.25, 0.1), boardMat, 0, 1.525, -0.05);
  [-1, 1].forEach((s) => add(new THREE.BoxGeometry(0.08, 2.25, 0.2), bodyMat, s * 0.84, 1.525, 0.0));
  add(new THREE.BoxGeometry(1.76, 0.1, 0.2), bodyMat, 0, 2.7, 0);

  const mk = (w, h, draw) => {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    draw(cv.getContext('2d'));
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };

  const title = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 0.3),
    new THREE.MeshBasicMaterial({
      map: mk(512, 96, (c) => {
        c.fillStyle = '#8b0f26'; c.fillRect(0, 0, 512, 96);
        c.fillStyle = '#ffd24a'; c.font = 'bold 64px Georgia'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText('PLINKO', 256, 50);
      }),
    })
  );
  title.position.set(0, 2.9, 0.11);
  g.add(title);
  add(new THREE.BoxGeometry(1.7, 0.34, 0.2), goldMat, 0, 2.9, 0);
  title.position.z = 0.105;

  const labelW = PL_MULT.length * 64;
  const labels = new THREE.Mesh(
    new THREE.PlaneGeometry(PL_HALF_W * 2, 0.2),
    new THREE.MeshBasicMaterial({
      map: mk(labelW, 90, (c) => {
        c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = 'bold 30px Georgia';
        PL_MULT.forEach((m, i) => {
          c.fillStyle = m >= 3 ? '#c01020' : m >= 1 ? '#1d7a3a' : '#33334a';
          c.fillRect(i * 64 + 2, 4, 60, 82);
          c.fillStyle = '#fff';
          c.fillText(`${m}x`, i * 64 + 32, 45);
        });
      }),
    })
  );
  labels.position.set(0, 0.68, 0.006);
  g.add(labels);

  // Pegs form a pyramid; row i has i + 1 pegs so the bins follow a binomial spread.
  const pegGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.1, 12);
  pegGeo.rotateX(Math.PI / 2);
  const pegMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.9, roughness: 0.2 });
  for (let i = 0; i < PL.rows; i++) {
    for (let j = 0; j <= i; j++) {
      const x = (j - i / 2) * PL.spacing, y = PL.topY - i * PL.rowH;
      add(pegGeo, pegMat, x, y, 0.05, false);
    }
  }
  // Bin dividers sit below the last row of pegs.
  const divMat = new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.8, roughness: 0.3 });
  const divH = PL.dividerTop - PL.floorY;
  for (let k = 0; k <= PL_MULT.length; k++) {
    const x = (k - PL_MULT.length / 2) * PL.spacing;
    if (k > 0 && k < PL_MULT.length) add(new THREE.BoxGeometry(0.02, divH, 0.1), divMat, x, PL.floorY + divH / 2, 0.05, false);
  }
  add(new THREE.BoxGeometry(PL_HALF_W * 2, 0.04, 0.1), divMat, 0, PL.floorY - 0.02, 0.05, false);

  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 2.25),
    new THREE.MeshStandardMaterial({ color: 0x99ccff, transparent: true, opacity: 0.1, roughness: 0.1 })
  );
  glass.position.set(0, 1.525, 0.11);
  g.add(glass);
})();
colliders.push({ minX: PL.x - 0.9, maxX: PL.x + 0.9, minZ: -8, maxZ: PL.z + 0.35 });

const plinkoBallGeo = new THREE.SphereGeometry(PL.ballR, 16, 12);
const plinkoBallMat = new THREE.MeshStandardMaterial({ color: 0xff3030, metalness: 0.6, roughness: 0.2 });

function nearPlinko() {
  const dx = PL.x - player.pos.x, dz = PL.z + 0.4 - player.pos.z;
  const dist = Math.hypot(dx, dz);
  if (dist > 2.6) return false;
  const lookX = -Math.sin(player.yaw), lookZ = -Math.cos(player.yaw);
  return (dx * lookX + dz * lookZ) / dist > 0.5;
}

function dropPlinko() {
  if (plinko.balls.length >= PL.maxBalls) return;
  if (credits < bet) return showMsg('Not enough credits!');
  credits -= bet;
  updateCredits();
  const mesh = new THREE.Mesh(plinkoBallGeo, plinkoBallMat);
  mesh.castShadow = true;
  plinko.group.add(mesh);
  // Each peg row is an independent left/right choice, giving a binomial spread across the bins.
  let rightCount = 0;
  const pts = [{ x: 0, y: PL.topY + 0.3 }, { x: 0, y: PL.topY + 0.06 }];
  let px = 0;
  for (let i = 0; i < PL.rows; i++) {
    const right = Math.random() < 0.5;
    if (right) rightCount++;
    px += (right ? 0.5 : -0.5) * PL.spacing;
    pts.push({ x: px, y: i < PL.rows - 1 ? PL.topY - (i + 1) * PL.rowH + 0.06 : PL.floorY + 0.12 });
  }
  const b = { mesh, pts, seg: 0, segT: 0, bin: rightCount, bet, landed: false, t: 0 };
  mesh.position.set(0, pts[0].y, 0.05);
  plinko.balls.push(b);
}

function updatePlinko(dt) {
  for (let i = plinko.balls.length - 1; i >= 0; i--) {
    const b = plinko.balls[i];
    if (!b.landed) {
      const last = b.pts.length - 2;
      const dur = b.seg === 0 ? 0.3 : b.seg === last ? 0.4 : 0.28;
      b.segT += dt / dur;
      while (b.segT >= 1 && b.seg < last) { b.segT -= 1; b.seg++; }
      const t = Math.min(1, b.segT);
      const p0 = b.pts[b.seg], p1 = b.pts[b.seg + 1];
      let x, y;
      if (b.seg === 0 || b.seg === last) {
        x = p0.x + (p1.x - p0.x) * (b.seg === 0 ? t : t * t);
        y = p0.y + (p1.y - p0.y) * t * t;
      } else {
        x = p0.x + (p1.x - p0.x) * t;
        y = p0.y + (p1.y - p0.y) * t * t + 0.05 * Math.sin(Math.PI * t) * (1 - t);
      }
      b.mesh.position.set(x, y, 0.05);
      if (b.seg === last && t >= 1) {
        b.landed = true;
        const mult = PL_MULT[b.bin];
        const win = Math.floor(b.bet * mult);
        credits += win;
        updateCredits();
        if (win < b.bet) addSadness(LOSS_SADNESS);
        showMsg(`Plinko ${mult}x: ${win >= b.bet ? 'won' : 'got back'} ${win}`, 1500);
      }
    } else {
      b.t += dt;
      b.mesh.scale.setScalar(Math.max(0.01, 1 - b.t / 0.8));
      if (b.t >= 0.8) {
        plinko.group.remove(b.mesh);
        plinko.balls.splice(i, 1);
      }
    }
  }
}

// ---------- Player & movement physics ----------
const player = {
  pos: new THREE.Vector3(0, 0, 4),
  vel: new THREE.Vector3(),
  yaw: 0, pitch: 0,
  onGround: true,
  radius: 0.35,
  eye: 1.7,
};
const PHYS = { walk: 4, run: 7, accel: 40, airAccel: 8, friction: 10, gravity: 22, jump: 7.5 };
const keys = {};

addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (!playing || e.repeat) return;
  if (e.code === 'Space') e.preventDefault();
  if (shop.active) {
    const n = Number(e.code.replace(/^(Digit|Numpad)/, ''));
    if (shop.kind === 'weapons' && n === 1) buyBat();
    if (shop.kind === 'weapons' && n === 2) buyFlash();
    if (shop.kind === 'weapons' && n === 3) buyAxe();
    if (shop.kind === 'pills' && n >= 1 && n <= PILLS.length) buyPill(n - 1);
    if (e.code === 'KeyQ' || e.code === 'KeyE') closeShop();
    return;
  }
  if (dice.active) { dicePick(e); return; }
  if (roulette.active) { roulettePick(e); return; }
  if (blackjack.active) {
    if (e.code === 'KeyH') hitBlackjack();
    if (e.code === 'KeyS') standBlackjack();
    if (e.code === 'KeyE' && (blackjack.phase === 'settled' || blackjack.phase === 'betting')) startBlackjackHand();
    if (e.code === 'KeyQ') leaveBlackjack();
    if (e.code === 'Equal' || e.code === 'NumpadAdd' || e.code === 'ArrowUp') adjustBet(1);
    if (e.code === 'Minus' || e.code === 'NumpadSubtract' || e.code === 'ArrowDown') adjustBet(-1);
    return;
  }
  if (e.code === 'Equal' || e.code === 'NumpadAdd') adjustBet(1);
  if (e.code === 'Minus' || e.code === 'NumpadSubtract') adjustBet(-1);
  if (e.code === 'KeyF' && hasFlash && weapon === 'flash') { flashOn = !flashOn; flash.visible = flashOn; }
  if (e.code === 'KeyR') {
    const owned = ['bat', 'axe', 'flash'].filter(isOwned);
    if (owned.length > 1) setWeapon(owned[(owned.indexOf(weapon) + 1) % owned.length]);
  }
  if (EQUIP_KEYS[e.code] && isOwned(EQUIP_KEYS[e.code])) setWeapon(EQUIP_KEYS[e.code]);
  if (/^Digit[2-5]$/.test(e.code)) usePill(Number(e.code[5]) - 2);
  if (e.code === 'KeyE') {
    const act = contextAction();
    if (act) act.run();
    else if (nearBlackjack()) enterBlackjack();
    else if (nearRoulette()) enterRoulette();
    else if (nearDice()) enterDice();
    else {
      const m = nearMachine();
      if (m) spin(m);
      else if (nearPlinko()) dropPlinko();
    }
  }
});
addEventListener('keyup', (e) => (keys[e.code] = false));

addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== renderer.domElement) return;
  player.yaw -= e.movementX * 0.0022;
  player.pitch = Math.max(-1.5, Math.min(1.5, player.pitch - e.movementY * 0.0022));
  if (dice.active) dice.swing += -e.movementY;
  if (blackjack.active || roulette.active || dice.active) {
    const c0 = roulette.active || dice.active ? Math.PI : 0;
    player.yaw = c0 + Math.max(-1, Math.min(1, player.yaw - c0));
    player.pitch = Math.max(dice.active ? -1.2 : -0.9, Math.min(0.4, player.pitch));
    camera.rotation.set(player.pitch, player.yaw, 0);
  }
});

function resolveCollisions() {
  const r = player.radius;
  const p = player.pos;
  const wallX = -ROOM.w / 2;
  const inGap = DOOR.open && Math.abs(p.z) < DOOR.hw - r;
  const minX = inGap || p.x < wallX ? DARK.minX + r : wallX + r;
  const zLim = (p.x < wallX - r ? DARK.d : ROOM.d) / 2 - r;
  p.x = Math.max(minX, Math.min(ROOM.w / 2 - r, p.x));
  if (Math.abs(p.z) > zLim) { p.z = Math.sign(p.z) * zLim; player.vel.z = 0; }
  if (!inGap && p.x > wallX - r && p.x < wallX + r) {
    p.x = p.x > wallX ? wallX + r : wallX - r;
    player.vel.x = 0;
  }
  if (p.x < wallX) p.z = Math.max(-DARK.d / 2 + r, Math.min(DARK.d / 2 - r, p.z));
  for (const a of addicts) {
    if (a.ko) continue;
    const dx = p.x - a.g.position.x, dz = p.z - a.g.position.z;
    const d = Math.hypot(dx, dz), min = r + 0.3;
    if (d < min && d > 0) { p.x += (dx / d) * (min - d); p.z += (dz / d) * (min - d); }
  }

  for (const b of colliders) {
    // Circle vs AABB; ignore if player is above the obstacle's height.
    const cx = Math.max(b.minX, Math.min(p.x, b.maxX));
    const cz = Math.max(b.minZ, Math.min(p.z, b.maxZ));
    let dx = p.x - cx, dz = p.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 === 0) { dx = 0; dz = 1; } // center inside box: push out +z
    const d = Math.sqrt(d2) || 1;
    const nx = dx / d, nz = dz / d;
    p.x += nx * (r - d);
    p.z += nz * (r - d);
    const vn = player.vel.x * nx + player.vel.z * nz;
    if (vn < 0) { player.vel.x -= vn * nx; player.vel.z -= vn * nz; }
  }
}

function updatePlayer(dt) {
  const fwd = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  const side = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  const speed = (keys.ShiftLeft || keys.ShiftRight ? PHYS.run : PHYS.walk) * (clock.elapsedTime < buffs.stimulant ? 1.5 : 1);

  const sin = Math.sin(player.yaw), cos = Math.cos(player.yaw);
  let wx = -sin * fwd + cos * side;
  let wz = -cos * fwd - sin * side;
  const len = Math.hypot(wx, wz);
  if (len > 0) { wx /= len; wz /= len; }

  const v = player.vel;
  if (player.onGround) {
    // Friction, then accelerate toward desired velocity.
    const f = Math.max(0, 1 - PHYS.friction * dt);
    v.x *= f; v.z *= f;
  }
  const accel = player.onGround ? PHYS.accel : PHYS.airAccel;
  const tx = wx * speed, tz = wz * speed;
  const ax = tx - v.x, az = tz - v.z;
  const al = Math.hypot(ax, az);
  if (len > 0 && al > 0) {
    const step = Math.min(al, accel * dt);
    v.x += (ax / al) * step;
    v.z += (az / al) * step;
  }

  if (player.onGround && keys.Space) { v.y = PHYS.jump; player.onGround = false; }
  v.y -= PHYS.gravity * dt;

  player.pos.addScaledVector(v, dt);
  if (player.pos.y <= 0) { player.pos.y = 0; v.y = 0; player.onGround = true; }

  resolveCollisions();

  camera.position.set(player.pos.x, player.pos.y + player.eye, player.pos.z);
  camera.rotation.set(player.pitch, player.yaw, 0);
}

function nearMachine() {
  const lookX = -Math.sin(player.yaw), lookZ = -Math.cos(player.yaw);
  let best = null, bestDist = 2.2;
  for (const m of machines) {
    const dx = m.group.position.x - player.pos.x;
    const dz = m.group.position.z + 0.2 - player.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < bestDist && (dx * lookX + dz * lookZ) / dist > 0.5) { best = m; bestDist = dist; }
  }
  return best;
}

function nearRoulette() {
  const dx = ROUL.x - player.pos.x, dz = ROUL.z - player.pos.z;
  const dist = Math.hypot(dx, dz);
  if (dist > 2.8) return false;
  const lookX = -Math.sin(player.yaw), lookZ = -Math.cos(player.yaw);
  return (dx * lookX + dz * lookZ) / dist > 0.35;
}

function nearDice() {
  const dx = DICE.x - player.pos.x, dz = DICE.z - player.pos.z;
  const dist = Math.hypot(dx, dz);
  if (dist > 2.8) return false;
  const lookX = -Math.sin(player.yaw), lookZ = -Math.cos(player.yaw);
  return (dx * lookX + dz * lookZ) / dist > 0.35;
}

function nearBlackjack() {
  const dx = -player.pos.x;
  const dz = -player.pos.z;
  const dist = Math.hypot(dx, dz);
  if (dist > 2.3) return false;
  const lookX = -Math.sin(player.yaw), lookZ = -Math.cos(player.yaw);
  return dist > 0 && (dx * lookX + dz * lookZ) / dist > 0.35;
}


// ---------- Dark room: addicts, robbing, bat, shop ----------
const ROB_COOLDOWN = 120;
const BAT_PRICE = 1000, FLASH_PRICE = 200, AXE_PRICE = 2500;
const RESPAWN_TIME = 120;
const LIMB_VALUE = { arm: 20, leg: 20, head: 35 };
const health = { hp: 100, max: 100 };
let hasBat = false, hasFlash = false, hasAxe = false, weapon = 'bat', flashOn = false;
const carried = { arm: 0, leg: 0, head: 0 };
const looseLimbs = [];
const LOSS_SADNESS = 1.5, KO_SADNESS = 6;
const depression = { v: 0 };
function addSadness(n) {
  depression.v = Math.max(0, Math.min(100, depression.v + n));
  renderDepression();
}
function renderDepression() {
  $('dep-fill').style.width = `${depression.v}%`;
  $('dep-pct').textContent = `${Math.round(depression.v)}%`;
}
const shop = { active: false, kind: 'weapons' };
const PILLS = [
  { key: 'painkiller', name: 'Painkillers', desc: 'restore 50 health', price: 50, count: 0 },
  { key: 'stimulant', name: 'Stimulants', desc: 'run faster for 60s', price: 50, count: 0 },
  { key: 'ironpill', name: 'Iron Pills', desc: 'take half damage for 60s', price: 50, count: 0 },
  { key: 'antidep', name: 'Antidepressants', desc: 'lower depression by 50%', price: 50, count: 0 },
];
const buffs = { stimulant: 0, ironpill: 0 };
const PILL_ICONS = { painkiller: '💊', stimulant: '⚡', ironpill: '🛡️', antidep: '😊' };
function renderPillHud() {
  const slots = [{ icon: '🏏', name: 'Bat', count: hasBat ? 1 : 0, show: false, tool: 'bat' }, ...PILLS.map((p) => ({ icon: PILL_ICONS[p.key], name: p.name, count: p.count, show: true })),
    { icon: '🪓', name: 'Axe', count: hasAxe ? 1 : 0, show: false, tool: 'axe' }, { icon: '🔦', name: 'Flashlight', count: hasFlash ? 1 : 0, show: false, tool: 'flash' }];
  $('hotbar').innerHTML = slots.map((sl, i) => `<div class="slot${sl.count ? ' has' : ''}${sl.tool && sl.tool === weapon && sl.count ? ' sel' : ''}" title="${sl.name}"><span class="k">${i + 1}</span>${sl.count ? `<span class="ic">${sl.icon}</span><span class="nm">${sl.name}</span>${sl.show ? `<span class="ct">${sl.count}</span>` : ''}` : ''}</div>`).join('');
}
renderPillHud();
renderDepression();
const addicts = [];

const skinMat = new THREE.MeshStandardMaterial({ color: 0x8a9a6a, roughness: 0.9 });
const rags = [0x3a3a30, 0x4a3a2a, 0x2a3040].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1 }));
function createAddict(x, z) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  const cloth = rags[Math.floor(Math.random() * rags.length)];
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.68, 0.24), cloth);
  torso.position.y = 1.1;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), skinMat);
  head.position.y = 1.58;
  head.userData.part = 'head';
  torso.userData.part = 'torso';
  const eyes = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.02), new THREE.MeshBasicMaterial({ color: 0x300808 }));
  eyes.position.set(0, 1.6, 0.14);
  const arm = (sx) => {
    const a = new THREE.Group();
    a.position.set(sx * 0.27, 1.4, 0);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.62, 0.11), skinMat);
    m.position.y = -0.3;
    m.userData.part = sx < 0 ? 'armL' : 'armR';
    a.add(m);
    return a;
  };
  const armL = arm(-1), armR = arm(1);
  const leg = (sx) => {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.78, 0.16), cloth);
    l.position.set(sx * 0.11, 0.39, 0);
    l.userData.part = sx < 0 ? 'legL' : 'legR';
    return l;
  };
  const legL = leg(-1), legR = leg(1);
  body.add(torso, head, eyes, armL, armR, legL, legR);
  g.add(body);
  g.position.set(x, 0, z);
  g.rotation.y = Math.random() * Math.PI * 2;
  darkGroup.add(g);
  addicts.push({ g, body, armL, armR, parts: { head, eyes, armL, armR, legL, legR }, dead: false, ko: false, koUntil: 0, bodyRobbed: false, robReady: 0, heading: g.rotation.y, turnT: 0, windup: 0, punchCd: 1 + Math.random() * 2, sway: Math.random() * 10, fall: 0 });
}
[[-12, -2], [-13, 6], [-15, -7], [-16, 2], [-18, -4], [-18, 7], [-20, 3], [-21, -7], [-22, 0], [-24, 4], [-24, -3], [-15, 0]].forEach(([x, z]) => createAddict(x, z));

const MAN = { x: -25, z: -8 };
{
  const g = new THREE.Group();
  const coat = new THREE.MeshStandardMaterial({ color: 0x0c0c10, roughness: 1 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 1.4, 10), coat);
  body.position.y = 0.7;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), new THREE.MeshStandardMaterial({ color: 0x050505 }));
  head.position.y = 1.6;
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 14), coat);
  hat.position.y = 1.72;
  const hatTop = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.2, 12), coat);
  hatTop.position.y = 1.82;
  const eyes = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.02), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
  eyes.position.set(0, 1.62, 0.16);
  g.add(body, head, hat, hatTop, eyes);
  g.position.set(MAN.x, 0, MAN.z);
  g.rotation.y = Math.PI / 4;
  darkGroup.add(g);
  colliders.push({ minX: MAN.x - 0.4, maxX: MAN.x + 0.4, minZ: MAN.z - 0.4, maxZ: MAN.z + 0.4 });
}

const lookDot = (x, z) => {
  const dx = x - player.pos.x, dz = z - player.pos.z;
  const d = Math.hypot(dx, dz);
  return { d, dot: d > 0 ? (dx * -Math.sin(player.yaw) + dz * -Math.cos(player.yaw)) / d : 1 };
};

function targetAddict(range, minDot = 0.55) {
  let best = null, bestD = range;
  for (const a of addicts) {
    const { d, dot } = lookDot(a.g.position.x, a.g.position.z);
    if (d < bestD && dot > minDot) { best = a; bestD = d; }
  }
  return best;
}

const rand = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));

function robAddict(a) {
  const now = clock.elapsedTime;
  if (a.ko) {
    if (a.bodyRobbed) return showMsg('Already picked clean.', 1500);
    a.bodyRobbed = true;
    if (Math.random() < 0.8) {
      const gain = rand(15, 35);
      credits += gain; updateCredits();
      showMsg(`You rob the body: +${gain} credits`);
    } else showMsg('Nothing in their pockets...');
    return;
  }
  if (now < a.robReady) return showMsg(`Nothing left to steal. Try again in ${Math.ceil(a.robReady - now)}s`, 1800);
  a.robReady = now + ROB_COOLDOWN;
  if (Math.random() < 0.4) {
    const gain = rand(5, 15);
    credits += gain; updateCredits();
    showMsg(`You lift their wallet: +${gain} credits`);
  } else {
    showMsg('They noticed you!');
    a.windup = 0.01;
  }
}

let batSwing = 0;
const raycaster = new THREE.Raycaster();
function swingWeapon() {
  if (batSwing > 0) return;
  batSwing = 0.35;
  if (weapon === 'axe') chopAddict(); else swingBat();
}
function swingBat() {
  const a = targetAddict(1.9, 0.5);
  if (!a || a.ko) return;
  a.ko = true;
  a.koUntil = clock.elapsedTime + ROB_COOLDOWN;
  a.bodyRobbed = false;
  a.windup = 0;
  showMsg('Knocked out! Press E to rob the body', 1800);
}

function dropLimb(a, name) {
  const part = a.parts[name];
  if (!part || !part.parent) return;
  const type = name.startsWith('arm') ? 'arm' : name.startsWith('leg') ? 'leg' : 'head';
  const mesh = part.isMesh ? part : part.children[0];
  const pos = new THREE.Vector3();
  mesh.getWorldPosition(pos);
  part.parent.remove(part);
  if (name === 'head') a.parts.eyes.parent?.remove(a.parts.eyes);
  const loose = new THREE.Mesh(mesh.geometry, mesh.material);
  loose.position.set(pos.x, type === 'head' ? 0.15 : 0.08, pos.z);
  if (type !== 'head') loose.rotation.set(Math.PI / 2, 0, Math.random() * Math.PI);
  darkGroup.add(loose);
  looseLimbs.push({ mesh: loose, type });
}

function chopAddict() {
  const objs = [];
  for (const a of addicts) if (!a.dead && a.g.position.x < -ROOM.w / 2) objs.push(a.g);
  raycaster.setFromCamera({ x: 0, y: 0 }, camera);
  raycaster.far = 2.2;
  const hit = raycaster.intersectObjects(objs, true).find((h) => h.object.userData.part);
  if (!hit) return;
  const a = addicts.find((x) => x.g === objs.find((o) => { let p = hit.object; while (p) { if (p === o) return true; p = p.parent; } return false; }));
  if (!a) return;
  let name = hit.object.userData.part;
  if (name === 'torso') {
    const side = a.g.worldToLocal(hit.point.clone()).x > 0 ? 'armR' : 'armL';
    name = [side, side === 'armR' ? 'armL' : 'armR', 'legL', 'legR'].find((n) => a.parts[n].parent);
  }
  if (!name) return;
  dropLimb(a, name);
  a.dead = true;
  a.ko = true;
  a.koUntil = clock.elapsedTime + RESPAWN_TIME;
  a.bodyRobbed = false;
  a.windup = 0;
  showMsg('Chopped! Press E to rob the body or pick up the limb', 2200);
}

function respawnAddict(a) {
  for (const [name, part] of Object.entries(a.parts)) if (!part.parent) a.body.add(part);
  a.dead = false; a.ko = false; a.robReady = 0; a.bodyRobbed = false;
}

function nearestLimb(range) {
  let best = null, bestD = range;
  for (const l of looseLimbs) {
    const d = Math.hypot(l.mesh.position.x - player.pos.x, l.mesh.position.z - player.pos.z);
    if (d < bestD) { best = l; bestD = d; }
  }
  return best;
}
function pickUpLimb(l) {
  darkGroup.remove(l.mesh);
  looseLimbs.splice(looseLimbs.indexOf(l), 1);
  carried[l.type]++;
  showMsg(`Picked up a ${l.type}. Sell it to the mysterious man.`, 1800);
}
function sellLimbs() {
  const total = Object.keys(carried).reduce((s, k) => s + carried[k] * LIMB_VALUE[k], 0);
  if (!total) return showMsg('"Bring me limbs... arms and legs 20, heads 35."', 2500);
  Object.keys(carried).forEach((k) => (carried[k] = 0));
  credits += total; updateCredits();
  showMsg(`The man takes your cargo: +${total} credits`, 2500);
}

const bat = new THREE.Group();
{
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.06, 0.9, 10), new THREE.MeshStandardMaterial({ color: 0xb98a4e, roughness: 0.6 }));
  m.position.y = 0.4;
  bat.add(m);
  bat.visible = false;
  camera.add(bat);
  scene.add(camera);
}

const axe = new THREE.Group();
{
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.8, 8), new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.7 }));
  handle.position.y = 0.35;
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.28), new THREE.MeshStandardMaterial({ color: 0xaab0b8, metalness: 0.8, roughness: 0.3 }));
  blade.position.set(0, 0.68, -0.14);
  axe.add(handle, blade);
  axe.visible = false;
  camera.add(axe);
}
const flash = new THREE.SpotLight(0xfff2d0, 120, 25, 0.45, 0.4, 1.5);
flash.visible = false;
flash.target.position.set(0, 0, -10);
camera.add(flash, flash.target);
const flashModel = new THREE.Group();
{
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.28, 12), new THREE.MeshStandardMaterial({ color: 0x2a2a30, metalness: 0.6, roughness: 0.4 }));
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.035, 0.07, 12), new THREE.MeshStandardMaterial({ color: 0x55555e, metalness: 0.7, roughness: 0.3 }));
  head.position.y = 0.17;
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.05, 12), new THREE.MeshBasicMaterial({ color: 0xfff2d0 }));
  lens.position.y = 0.206;
  lens.rotation.x = -Math.PI / 2;
  flashModel.add(body, head, lens);
  flashModel.visible = false;
  camera.add(flashModel);
}
const EQUIP_KEYS = { Digit1: 'bat', Digit6: 'axe', Digit7: 'flash' };
const isOwned = (w) => (w === 'bat' ? hasBat : w === 'axe' ? hasAxe : hasFlash);
function setWeapon(w) {
  weapon = w;
  bat.visible = hasBat && w === 'bat';
  axe.visible = hasAxe && w === 'axe';
  flashModel.visible = hasFlash && w === 'flash';
  flash.visible = flashModel.visible && flashOn;
  renderPillHud();
}

function openShop(kind) {
  shop.active = true; shop.kind = kind;
  show('shop', kind === 'weapons', 'block');
  show('pillshop', kind === 'pills', 'block');
  renderShop();
}
function closeShop() { shop.active = false; show('shop', false); show('pillshop', false); }
function renderShop() {
  $('shop-credits').textContent = credits;
  $('shop-bat').textContent = hasBat ? 'Owned' : `${BAT_PRICE} credits`;
  $('shop-flash').textContent = hasFlash ? 'Owned' : `${FLASH_PRICE} credits`;
  $('shop-axe').textContent = hasAxe ? 'Owned' : `${AXE_PRICE} credits`;
  if (!$('shop-status').textContent.startsWith('Not enough')) $('shop-status').textContent = hasBat || hasAxe ? 'Left click to attack. R cycles tools, F toggles the flashlight.' : '';
  $('pill-credits').textContent = credits;
  $('pill-list').innerHTML = PILLS.map((p, i) => `<p>${i + 1} · ${p.name} (${p.desc}) — ${p.price} credits <small>owned: ${p.count}</small></p>`).join('');
  renderPillHud();
}
function buyBat() {
  if (hasBat) { $('shop-status').textContent = 'You already own a bat.'; return; }
  if (credits < BAT_PRICE) { $('shop-status').textContent = 'Not enough credits.'; return; }
  $('shop-status').textContent = '';
  credits -= BAT_PRICE;
  hasBat = true;
  setWeapon('bat');
  renderPillHud();
  updateCredits();
  renderShop();
}
function buyFlash() {
  if (hasFlash) { $('shop-status').textContent = 'You already own a flashlight.'; return; }
  if (credits < FLASH_PRICE) { $('shop-status').textContent = 'Not enough credits.'; return; }
  credits -= FLASH_PRICE;
  hasFlash = true; flashOn = true;
  setWeapon('flash');
  $('shop-status').textContent = '';
  updateCredits();
  renderShop();
}
function buyAxe() {
  if (hasAxe) { $('shop-status').textContent = 'You already own an axe.'; return; }
  if (credits < AXE_PRICE) { $('shop-status').textContent = 'Not enough credits.'; return; }
  credits -= AXE_PRICE;
  hasAxe = true;
  setWeapon('axe');
  $('shop-status').textContent = '';
  updateCredits();
  renderShop();
}
function buyPill(i) {
  const p = PILLS[i];
  if (!p) return;
  if (credits < p.price) { $('pill-status').textContent = 'Not enough credits.'; return; }
  credits -= p.price; p.count++;
  $('pill-status').textContent = `Bought ${p.name}. Press ${i + 2} outside the shop to take one.`;
  updateCredits();
  renderShop();
}
function usePill(i) {
  const p = PILLS[i];
  if (!p || p.count <= 0) return;
  p.count--;
  const now = clock.elapsedTime;
  if (p.key === 'painkiller') health.hp = Math.min(health.max, health.hp + 50);
  else if (p.key === 'antidep') addSadness(-50);
  else buffs[p.key] = now + 60;
  showMsg(`Took ${p.name}: ${p.desc}`, 1800);
  renderPillHud();
}

function contextAction() {
  const door = lookDot(-ROOM.w / 2, 0);
  if (!DOOR.open && door.d < 2.6 && door.dot > 0.3) {
    return { text: 'Press E to open the door to the Dark Room', run: () => { DOOR.open = true; showMsg('The Dark Room... ', 1500); } };
  }
  const dl = lookDot(DEALER.x, DEALER.z);
  if (dl.d < 2.6 && dl.dot > 0.5) return { text: 'Press E to talk to the Pill Dealer', run: () => openShop('pills') };
  const sh = lookDot(SHOP.x, SHOP.z);
  if (sh.d < 2.8 && sh.dot > 0.35) return { text: 'Press E to open the weapons shop', run: () => openShop('weapons') };
  const mm = lookDot(MAN.x, MAN.z);
  if (mm.d < 2.8 && mm.dot > 0.35) return { text: 'Press E to sell limbs to the mysterious man', run: sellLimbs };
  const limb = nearestLimb(1.6);
  if (limb) return { text: `Press E to pick up the ${limb.type}`, run: () => pickUpLimb(limb) };
  const a = targetAddict(1.6);
  if (a) {
    const now = clock.elapsedTime;
    const text = a.ko
      ? (a.bodyRobbed ? 'Body already robbed' : 'Press E to rob the body (80%)')
      : now < a.robReady ? `Press E to rob (cooldown ${Math.ceil(a.robReady - now)}s)` : 'Press E to rob (40%)';
    return { text, run: () => robAddict(a) };
  }
  return null;
}

function damagePlayer(n) {
  if (clock.elapsedTime < buffs.ironpill) n = Math.ceil(n / 2);
  health.hp = Math.max(0, health.hp - n);
  const f = $('hurt');
  f.style.opacity = 0.6;
  setTimeout(() => (f.style.opacity = 0), 150);
  if (health.hp <= 0) {
    health.hp = health.max;
    addSadness(KO_SADNESS);
    player.pos.set(0, 0, 4);
    player.vel.set(0, 0, 0);
    player.yaw = 0; player.pitch = 0;
    addicts.forEach((x) => (x.windup = 0));
    showMsg('You were beaten senseless and dragged back to the casino.', 3500);
  }
}

const INSANITY_TIME = 120;
let insanity = 0, lost = false;
function updateInsanity(dt, t) {
  if (lost) return;
  if (depression.v < 100) {
    insanity = 0;
    if (canvas.style.filter) { canvas.style.filter = ''; canvas.style.transform = ''; }
    return;
  }
  insanity += dt;
  const k = Math.min(1, 0.35 + insanity / INSANITY_TIME * 0.65);
  const sw = Math.sin(t * 0.9), sw2 = Math.sin(t * 1.7 + 1);
  canvas.style.filter = `hue-rotate(${Math.sin(t * 0.6) * 90 * k}deg) blur(${(1.5 + sw2 * 1.5 + 1.5) * k}px) saturate(${1 + k})`;
  canvas.style.transform = `rotate(${sw * 6 * k}deg) scale(${1.08 + 0.06 * k * sw2}) skew(${sw2 * 3 * k}deg, ${sw * 2 * k}deg)`;
  if (insanity >= INSANITY_TIME) loseGame();
}
function loseGame() {
  lost = true;
  started = false;
  canvas.style.filter = ''; canvas.style.transform = '';
  document.exitPointerLock();
  show('pause', false);
  show('gameover', true);
}
$('restart').onclick = () => location.reload();

function updateAddicts(dt, t) {
  const inDark = player.pos.x < -ROOM.w / 2;
  darkLights.forEach((l) => (l.intensity = 4 + Math.sin(t * 7 + l.userData.phase) * 0.8 * (Math.sin(t * 1.3 + l.userData.phase) > 0.6 ? 1 : 0.2)));
  for (const a of addicts) {
    const p = a.g.position;
    if (a.ko) {
      if (t >= a.koUntil) { if (a.dead) respawnAddict(a); else { a.ko = false; a.robReady = 0; a.bodyRobbed = false; } }
      a.fall = Math.min(1, a.fall + dt * 4);
    } else {
      a.fall = Math.max(0, a.fall - dt * 1.5);
    }
    a.body.rotation.x = -a.fall * Math.PI / 2;
    a.body.position.y = a.fall * 0.15;
    if (a.ko) continue;

    const dx = player.pos.x - p.x, dz = player.pos.z - p.z;
    const dist = Math.hypot(dx, dz);
    const chasing = inDark && dist < 6;
    a.sway += dt * 2;
    if (a.windup > 0) {
      a.windup += dt;
      a.heading = Math.atan2(dx, dz);
      if (a.windup > 0.7) {
        a.windup = 0;
        a.punchCd = 2;
        if (dist < 1.1) damagePlayer(rand(8, 14));
      }
    } else if (chasing) {
      a.heading = Math.atan2(dx, dz);
      a.punchCd -= dt;
      if (dist > 0.9) {
        p.x += (dx / dist) * 0.75 * dt;
        p.z += (dz / dist) * 0.75 * dt;
      } else if (a.punchCd <= 0) a.windup = 0.01;
    } else {
      a.turnT -= dt;
      if (a.turnT <= 0) { a.heading += (Math.random() - 0.5) * 2.5; a.turnT = 2 + Math.random() * 3; }
      p.x += Math.sin(a.heading) * 0.4 * dt;
      p.z += Math.cos(a.heading) * 0.4 * dt;
    }
    p.x = Math.max(DARK.minX + 0.5, Math.min(-ROOM.w / 2 - 1.5, p.x));
    p.z = Math.max(-DARK.d / 2 + 0.5, Math.min(DARK.d / 2 - 0.5, p.z));
    for (const c of colliders) {
      if (c.minX > -ROOM.w / 2) continue;
      if (p.x > c.minX - 0.4 && p.x < c.maxX + 0.4 && p.z > c.minZ - 0.4 && p.z < c.maxZ + 0.4) {
        a.heading += Math.PI / 2;
        p.x += p.x < (c.minX + c.maxX) / 2 ? -0.02 : 0.02;
        p.z += p.z < (c.minZ + c.maxZ) / 2 ? -0.02 : 0.02;
      }
    }
    a.g.rotation.y += (((a.heading - a.g.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 3);
    a.body.rotation.z = Math.sin(a.sway) * 0.08;
    const raise = a.windup > 0 ? Math.min(1, a.windup / 0.5) * -1.6 + (a.windup > 0.5 ? 1.6 : 0) : -0.3 + Math.sin(a.sway) * 0.15;
    a.armR.rotation.x = raise;
    a.armL.rotation.x = -0.3 - Math.sin(a.sway) * 0.15;
  }
}

function updateHealthAndBat(dt, t) {
  if (player.pos.x >= -ROOM.w / 2 && health.hp < health.max) health.hp = Math.min(health.max, health.hp + 3 * dt);
  $('health').textContent = Math.ceil(health.hp);
  if (batSwing > 0) batSwing = Math.max(0, batSwing - dt);
  axe.position.set(0.35 - Math.sin((1 - batSwing / 0.35) * Math.PI) * (batSwing > 0 ? 0.3 : 0), -0.3, -0.6);
  axe.rotation.set(-0.3 - (batSwing > 0 ? Math.sin((1 - batSwing / 0.35) * Math.PI) * 1.2 : 0), 0, -0.2);
  const k = batSwing > 0 ? Math.sin((1 - batSwing / 0.35) * Math.PI) : 0;
  bat.position.set(0.35 - k * 0.3, -0.3, -0.6);
  bat.rotation.set(-0.3 - k * 1.2, 0, -0.4 + k * 0.6);
  flashModel.position.set(0.3, -0.25 + Math.sin(t * 1.5) * 0.004, -0.5);
  flashModel.rotation.set(-1.3, 0, -0.1);
  flash.position.set(0.3, -0.2, -0.5);
  updateInsanity(dt, t);
  const dark = player.pos.x < -ROOM.w / 2;
  scene.fog.near = dark ? 1 : 10;
  scene.fog.far = dark ? 11 : 30;
  scene.fog.color.setHex(dark ? 0x030202 : 0x120308);
  scene.background.setHex(dark ? 0x030202 : 0x120308);
  if (shop.active && lookDot(shop.kind === 'pills' ? DEALER.x : SHOP.x, shop.kind === 'pills' ? DEALER.z : SHOP.z).d > 3.5) closeShop();
}

// ---------- Menu / pointer lock ----------
const canvas = renderer.domElement;
const show = (id, on, d = 'flex') => ($(id).style.display = on ? d : 'none');

function enterGame() {
  canvas.requestPointerLock();
}

document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  playing = locked;
  show('menu', false);
  show('hud', locked, 'block');
  show('hotbar', locked, 'flex');
  show('dep', locked, 'flex');
  show('cross', locked, 'block');
  show('pause', !locked && started && !lost);
  if (!locked && dice.phase === 'held') { resetDice(); dice.phase = 'betting'; }
  if (!locked) { closeShop(); Object.keys(keys).forEach((k) => (keys[k] = false)); show('prompt', false); }
});

let started = false;
$('play').onclick = () => { started = true; enterGame(); };
$('resume').onclick = enterGame;
$('quit').onclick = () => { started = false; show('pause', false); show('menu', true); };
$('howto').onclick = () => { const h = $('help'); h.style.display = h.style.display === 'block' ? 'none' : 'block'; };

// ---------- Loop ----------
const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  if (playing) {
    const seated = blackjack.active || roulette.active || dice.active;
    if (!seated) updatePlayer(dt);
    const nm = seated ? null : nearMachine();
    const nearTable = !seated && nearBlackjack();
    const nearRoul = !seated && !nearTable && nearRoulette();
    const nearDc = !seated && !nearTable && !nearRoul && nearDice();
    const near = nm && !nm.spinning;
    const nearPl = !seated && !nm && !nearTable && !nearRoul && !nearDc && nearPlinko();
    const ctx = seated || shop.active ? null : contextAction();
    $('prompt').style.display = ctx || nearTable || nearRoul || nearDc || near || nearPl ? 'block' : 'none';
    if (ctx) $('prompt').textContent = ctx.text;
    else if (nearTable) $('prompt').textContent = `Press E to play blackjack (${bet} credits)`;
    else if (nearRoul) $('prompt').textContent = 'Press E to play roulette';
    else if (nearDc) $('prompt').textContent = 'Press E to play dice';
    else if (near) $('prompt').textContent = `Press E to spin (${bet} credits)`;
    else if (nearPl) $('prompt').textContent = `Press E to drop a plinko ball (${bet} credits)`;
  } else if (!started) {
    // Slow orbit behind the menu
    camera.position.set(Math.sin(t * 0.15) * 3, 1.8, 3);
    camera.lookAt(0, 1.8, -7);
  }
  if (playing) updateHealthAndBat(dt, t);
  updateAddicts(dt, t);
  updateDealer(t, dt);
  updateRoulette(dt);
  updateDice(dt);
  updatePlinko(dt);
  machines.forEach((m) => updateReels(m, dt));
  renderer.render(scene, camera);
}
frame();
