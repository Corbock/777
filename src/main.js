import * as THREE from 'three';
import { SYMBOLS, BET, spin, payout } from './slot.js';
import { resolveCollisions, stepVertical, EYE } from './physics.js';

const $ = (id) => document.getElementById(id);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x120005);
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 100);
camera.rotation.order = 'YXZ';

const ROOM = { w: 16, d: 16, h: 5 };
const bounds = { minX: -ROOM.w / 2, maxX: ROOM.w / 2, minZ: -ROOM.d / 2, maxZ: ROOM.d / 2 };
const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, ...o });
const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); scene.add(o); return o; };

// Room
add(new THREE.PlaneGeometry(ROOM.w, ROOM.d), mat(0x6b0f1a, { roughness: 0.9 }), 0, 0, 0).rotation.x = -Math.PI / 2;
add(new THREE.PlaneGeometry(ROOM.w, ROOM.d), mat(0x1a1a1a), 0, ROOM.h, 0).rotation.x = Math.PI / 2;
const wallM = mat(0x2b0a12);
add(new THREE.PlaneGeometry(ROOM.w, ROOM.h), wallM, 0, ROOM.h / 2, -ROOM.d / 2);
add(new THREE.PlaneGeometry(ROOM.w, ROOM.h), wallM, 0, ROOM.h / 2, ROOM.d / 2).rotation.y = Math.PI;
add(new THREE.PlaneGeometry(ROOM.d, ROOM.h), wallM, -ROOM.w / 2, ROOM.h / 2, 0).rotation.y = Math.PI / 2;
add(new THREE.PlaneGeometry(ROOM.d, ROOM.h), wallM, ROOM.w / 2, ROOM.h / 2, 0).rotation.y = -Math.PI / 2;

scene.add(new THREE.AmbientLight(0xffffff, 0.5));
for (const [x, z] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) {
  const l = new THREE.PointLight(0xffd9a0, 40, 14);
  l.position.set(x, ROOM.h - 0.5, z);
  scene.add(l);
  add(new THREE.SphereGeometry(0.2), new THREE.MeshBasicMaterial({ color: 0xffeeaa }), x, ROOM.h - 0.4, z);
}

// Slot machine, against the back wall
const SLOT = { x: 0, z: -ROOM.d / 2 + 1 };
const slot = new THREE.Group();
slot.position.set(SLOT.x, 0, SLOT.z);
scene.add(slot);
const part = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); slot.add(o); return o; };
part(new THREE.BoxGeometry(1.6, 2.2, 1.2), mat(0xc4161c, { metalness: 0.4, roughness: 0.4 }), 0, 1.1, 0);
part(new THREE.BoxGeometry(1.7, 0.4, 1.3), mat(0xffd700, { metalness: 0.8, roughness: 0.3 }), 0, 2.35, 0);
part(new THREE.BoxGeometry(1.3, 0.6, 0.1), mat(0x111111), 0, 1.5, 0.61);
const lever = new THREE.Group();
lever.position.set(0.9, 1.2, 0);
slot.add(lever);
const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8), mat(0xcccccc, { metalness: 1 }));
arm.position.y = 0.4; lever.add(arm);
const knob = new THREE.Mesh(new THREE.SphereGeometry(0.12), mat(0xff0000));
knob.position.y = 0.8; lever.add(knob);

// Reels drawn on canvases
const reelTex = [], reelCtx = [];
for (let i = 0; i < 3; i++) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  reelTex.push(t); reelCtx.push(c.getContext('2d'));
  part(new THREE.PlaneGeometry(0.4, 0.4), new THREE.MeshBasicMaterial({ map: t }), (i - 1) * 0.42, 1.5, 0.67);
}
function drawReel(i, sym) {
  const g = reelCtx[i];
  g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 128);
  g.font = 'bold 90px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = sym === '7' ? '#d00' : '#000';
  g.fillText(sym, 64, 70);
  reelTex[i].needsUpdate = true;
}
[0, 1, 2].forEach((i) => drawReel(i, '7'));

const obstacles = [{ minX: SLOT.x - 0.85, maxX: SLOT.x + 0.85, minZ: SLOT.z - 0.65, maxZ: SLOT.z + 0.65 }];

// Player state
const player = { pos: new THREE.Vector3(0, EYE, 5), vx: 0, vz: 0, yaw: 0, pitch: 0, y: EYE, vy: 0, onGround: true };
const keys = new Set();
let credits = 100, playing = false, spinning = false, leverT = 0;
const RADIUS = 0.35;

function showCredits() { $('credits').textContent = credits; }

function pull() {
  if (spinning) return;
  if (credits < BET) { $('prompt').textContent = 'Out of credits! Press R to refill.'; return; }
  credits -= BET; showCredits(); spinning = true; leverT = 1;
  const result = spin();
  const start = performance.now();
  const timer = setInterval(() => {
    const t = performance.now() - start;
    for (let i = 0; i < 3; i++) {
      if (t < 800 + i * 500) drawReel(i, SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
      else drawReel(i, SYMBOLS[result[i]]);
    }
    if (t > 800 + 2 * 500 + 50) {
      clearInterval(timer);
      const win = payout(result);
      credits += win; showCredits(); spinning = false;
      $('prompt').textContent = win ? `You won ${win}!` : 'No luck. Try again!';
    }
  }, 70);
}

// Input
addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (!playing) return;
  if (e.code === 'KeyE' && nearSlot()) pull();
  if (e.code === 'KeyR' && credits < BET) { credits = 100; showCredits(); $('prompt').textContent = ''; }
  if (e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== renderer.domElement) return;
  player.yaw -= e.movementX * 0.0022;
  player.pitch = Math.max(-1.4, Math.min(1.4, player.pitch - e.movementY * 0.0022));
});
function nearSlot() { return Math.hypot(player.pos.x - SLOT.x, player.pos.z - SLOT.z) < 2.6; }

function setPlaying(p) {
  playing = p;
  for (const id of ['hud', 'cross']) $(id).classList.toggle('hidden', !p);
  $('menu').classList.toggle('hidden', p);
}
$('play').onclick = () => { setPlaying(true); renderer.domElement.requestPointerLock?.(); };
$('help').onclick = () => $('controls').classList.toggle('hidden');
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && playing) setPlaying(false);
});
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
});

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (playing) {
    const f = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
    const r = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
    const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 7 : 4;
    const sin = Math.sin(player.yaw), cos = Math.cos(player.yaw);
    let tx = (-sin * f + cos * r), tz = (-cos * f - sin * r);
    const len = Math.hypot(tx, tz) || 1;
    tx = (tx / len) * speed * (f || r ? 1 : 0); tz = (tz / len) * speed * (f || r ? 1 : 0);
    // smooth acceleration / friction
    const k = Math.min(1, 12 * dt);
    player.vx += (tx - player.vx) * k; player.vz += (tz - player.vz) * k;
    player.pos.x += player.vx * dt; player.pos.z += player.vz * dt;
    resolveCollisions(player.pos, obstacles, RADIUS, bounds);
    stepVertical(player, dt, keys.has('Space'));
    if (!spinning && !$('prompt').textContent.startsWith('Out')) {
      if (nearSlot()) { if (!/^You|^No/.test($('prompt').textContent)) $('prompt').textContent = `Press E to spin (${BET} credits)`; }
      else $('prompt').textContent = '';
    }
    if (!nearSlot() && !spinning && /^You|^No/.test($('prompt').textContent)) $('prompt').textContent = '';
  }
  leverT = Math.max(0, leverT - dt * 1.5);
  lever.rotation.x = Math.sin(leverT * Math.PI) * 0.9;
  camera.position.set(player.pos.x, player.y, player.pos.z);
  camera.rotation.set(player.pitch, player.yaw, 0);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
