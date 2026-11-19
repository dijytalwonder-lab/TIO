import * as THREE from 'three';
import { PLATFORM_HALF } from './config.js';

// ---------------------------------------------------------------------------
// Particle / flash / shockwave / camera-shake layer.
// ---------------------------------------------------------------------------

function radialTexture(kind) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  if (kind === 'soft') {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.45, 'rgba(255,255,255,0.55)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  } else { // star burst
    g.translate(64, 64);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 60);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.3, 'rgba(255,255,255,0.8)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2, r = i % 2 ? 22 : 62;
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath(); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const MAXP = 360;

export class Effects {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.group = new THREE.Group();
    scene.add(this.group);
    const soft = radialTexture('soft'), star = radialTexture('star');

    // flashes (additive) and dust (normal blending) sprite pools
    this.flashes = [];
    for (let i = 0; i < 14; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: star, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
      s.visible = false; s.renderOrder = 20; this.group.add(s);
      this.flashes.push({ s, t: 0, life: 0.2, size: 1 });
    }
    this.dusts = [];
    for (let i = 0; i < 44; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft, transparent: true, depthWrite: false }));
      s.visible = false; s.renderOrder = 10; this.group.add(s);
      this.dusts.push({ s, t: 0, life: 1, s0: 0.3, s1: 1, vx: 0, vy: 0, vz: 0, a0: 0.6 });
    }
    // shockwave rings
    this.rings = [];
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 28), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide }));
      m.visible = false; m.renderOrder = 19; this.group.add(m);
      this.rings.push({ m, t: 0, life: 0.4, size: 2, ground: false });
    }
    // debris chips (instanced low-poly tetrahedra)
    this.chipMesh = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ roughness: 0.7, flatShading: true }), MAXP);
    this.chipMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.chipMesh.frustumCulled = false;
    this.chipMesh.castShadow = false;
    this.chipMesh.setColorAt(0, new THREE.Color(1, 1, 1));
    this.group.add(this.chipMesh);
    this.chips = [];
    for (let i = 0; i < MAXP; i++) this.chips.push({ on: false, p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Vector3(), rv: new THREE.Vector3(), life: 0, max: 1, size: 0.05, g: 22 });
    this.cursor = 0;
    this.dummy = new THREE.Object3D();
    this.col = new THREE.Color();
    for (let i = 0; i < MAXP; i++) { this.dummy.scale.setScalar(0); this.dummy.updateMatrix(); this.chipMesh.setMatrixAt(i, this.dummy.matrix); }

    this.shakeAmt = 0;
    this.right = new THREE.Vector3(); this.up = new THREE.Vector3();
    this.nextFlash = 0; this.nextDust = 0; this.nextRing = 0;
  }

  _flash(pos, size, color, life = 0.2) {
    const f = this.flashes[this.nextFlash++ % this.flashes.length];
    f.s.position.copy(pos); f.s.material.color.set(color); f.s.visible = true; f.t = 0; f.life = life; f.size = size;
    f.s.scale.setScalar(size * 0.3); f.s.material.opacity = 1;
  }

  /** Tiny twinkle where a shiny shard lands. */
  glint(pos, color = 0xffffff) { this._flash(pos, 0.3 + Math.random() * 0.28, color, 0.26); }

  ring(pos, size, color, life = 0.4, ground = false) {
    const r = this.rings[this.nextRing++ % this.rings.length];
    r.m.position.copy(pos); r.m.visible = true; r.t = 0; r.life = life; r.size = size; r.ground = ground;
    r.m.material.color.set(color); r.m.material.opacity = 0.9;
    if (ground) { r.m.rotation.set(-Math.PI / 2, 0, 0); r.m.position.y = 0.06; } else r.m.quaternion.copy(this.camera.quaternion);
    r.m.scale.setScalar(size * 0.15);
  }

  dust(pos, n, color = 0xffffff, size = 0.6, spread = 0.8) {
    for (let i = 0; i < n; i++) {
      const d = this.dusts[this.nextDust++ % this.dusts.length];
      d.s.position.set(pos.x + (Math.random() - 0.5) * 0.3, pos.y + Math.random() * 0.15, pos.z + (Math.random() - 0.5) * 0.3);
      d.s.visible = true; d.t = 0; d.life = 0.7 + Math.random() * 0.6;
      d.s0 = size * (0.3 + Math.random() * 0.3); d.s1 = size * (1 + Math.random() * 0.8);
      d.vx = (Math.random() - 0.5) * spread * 2; d.vz = (Math.random() - 0.5) * spread * 2; d.vy = 0.3 + Math.random() * 0.8;
      d.a0 = 0.5;
      d.s.material.color.set(color);
    }
  }

  chip(pos, vel, color, size, life = 1.1, grav = 22) {
    const c = this.chips[this.cursor++ % MAXP];
    c.on = true; c.p.copy(pos); c.v.copy(vel);
    c.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    c.rv.set((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18);
    c.life = life; c.max = life; c.size = size; c.g = grav;
    this.col.set(color);
    this.chipMesh.setColorAt((this.cursor - 1) % MAXP, this.col);
    this.chipMesh.instanceColor.needsUpdate = true;
  }

  /** Hammer impact: flash, shockwave, dust and flying chips. */
  impact(point, normal, power, crit, colors) {
    this._flash(point, 0.9 + power * 0.35, crit ? 0xfff2a8 : 0xffffff, crit ? 0.3 : 0.18);
    if (crit) {
      this._flash(point, 2.6, 0xffd36b, 0.38);
      this.ring(point, 3.4, 0xfff2a8, 0.5);
      this.ring(point, 2.2, 0xffffff, 0.35);
      this.ring(new THREE.Vector3(0, 0, 0), 5.2, 0xfff6d0, 0.65, true);
    } else {
      this.ring(point, 1.1 + power * 0.5, 0xffffff, 0.3);
    }
    const n = Math.round(8 + power * (crit ? 12 : 6));
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5), Math.random() * 0.9 + 0.1, (Math.random() - 0.5)).normalize()
        .multiplyScalar(2.5 + Math.random() * (3 + power * 1.5))
        .addScaledVector(normal, 2 + power);
      this.chip(point, v, colors[i % colors.length], 0.035 + Math.random() * 0.05, 0.9 + Math.random() * 0.5);
    }
    this.dust(point, crit ? 6 : 3, 0xfff6ea, crit ? 0.9 : 0.6, 0.6);
  }

  /** Little puff + chips where a fragment lands or splits. */
  landing(pos, speed, color) {
    const n = Math.min(4, 1 + Math.floor(speed / 3));
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5) * 2, 1.4 + Math.random() * 1.6, (Math.random() - 0.5) * 2);
      this.chip(pos, v, color, 0.03 + Math.random() * 0.03, 0.55);
    }
    if (speed > 4) this.dust(new THREE.Vector3(pos.x, Math.max(0.02, pos.y - 0.1), pos.z), 1, 0xf3ece2, 0.35, 0.3);
  }

  confetti(n = 90) {
    const cols = [0xff6b8b, 0xffd45e, 0x6fd3ff, 0x7be08a, 0xc79bff, 0xffffff];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * 2.2;
      const p = new THREE.Vector3(Math.cos(a) * r, 5.5 + Math.random() * 3.5, Math.sin(a) * r);
      const v = new THREE.Vector3((Math.random() - 0.5) * 3, -0.5 - Math.random() * 1.5, (Math.random() - 0.5) * 3);
      this.chip(p, v, cols[i % cols.length], 0.06 + Math.random() * 0.06, 2.6 + Math.random() * 1.2, 2.2);
    }
  }

  shake(a) { this.shakeAmt = Math.max(this.shakeAmt, a); }

  clear() {
    this.chips.forEach((c, i) => {
      if (!c.on) return;
      c.on = false;                       // also wipe its instance, or the last drawn chip stays frozen on screen
      this.dummy.scale.setScalar(0); this.dummy.position.set(0, -50, 0); this.dummy.updateMatrix();
      this.chipMesh.setMatrixAt(i, this.dummy.matrix);
      this.chipMesh.instanceMatrix.needsUpdate = true;
    });
    this.dusts.forEach((d) => { d.s.visible = false; });
    this.flashes.forEach((f) => { f.s.visible = false; });
    this.rings.forEach((r) => { r.m.visible = false; });
    this.shakeAmt = 0;
  }

  update(dt) {
    for (const f of this.flashes) {
      if (!f.s.visible) continue;
      f.t += dt;
      const k = f.t / f.life;
      if (k >= 1) { f.s.visible = false; continue; }
      f.s.scale.setScalar(f.size * (0.3 + 0.9 * Math.sqrt(k)));
      f.s.material.opacity = 1 - k;
    }
    for (const d of this.dusts) {
      if (!d.s.visible) continue;
      d.t += dt;
      const k = d.t / d.life;
      if (k >= 1) { d.s.visible = false; continue; }
      d.s.position.x += d.vx * dt; d.s.position.y += d.vy * dt; d.s.position.z += d.vz * dt;
      d.vx *= 0.97; d.vz *= 0.97; d.vy *= 0.97;
      d.s.scale.setScalar(d.s0 + (d.s1 - d.s0) * Math.sqrt(k));
      d.s.material.opacity = d.a0 * (1 - k) * (1 - k * 0.3);
    }
    for (const r of this.rings) {
      if (!r.m.visible) continue;
      r.t += dt;
      const k = r.t / r.life;
      if (k >= 1) { r.m.visible = false; continue; }
      if (!r.ground) r.m.quaternion.copy(this.camera.quaternion);
      r.m.scale.setScalar(r.size * (0.15 + 0.85 * (1 - Math.pow(1 - k, 3))));
      r.m.material.opacity = 0.9 * (1 - k);
    }
    const half = PLATFORM_HALF;
    let dirty = false;
    for (let i = 0; i < MAXP; i++) {
      const c = this.chips[i];
      if (!c.on) continue;
      dirty = true;
      c.life -= dt;
      if (c.life <= 0) { c.on = false; this.dummy.scale.setScalar(0); this.dummy.position.set(0, -50, 0); this.dummy.updateMatrix(); this.chipMesh.setMatrixAt(i, this.dummy.matrix); continue; }
      c.v.y -= c.g * dt;
      c.p.addScaledVector(c.v, dt);
      if (c.p.y < 0.03 && Math.abs(c.p.x) < half && Math.abs(c.p.z) < half && c.v.y < 0) {
        c.p.y = 0.03; c.v.y *= -0.38; c.v.x *= 0.7; c.v.z *= 0.7; c.rv.multiplyScalar(0.6);
      }
      c.r.addScaledVector(c.rv, dt);
      const s = c.size * Math.min(1, c.life / 0.25);
      this.dummy.position.copy(c.p);
      this.dummy.rotation.set(c.r.x, c.r.y, c.r.z);
      this.dummy.scale.setScalar(s);
      this.dummy.updateMatrix();
      this.chipMesh.setMatrixAt(i, this.dummy.matrix);
    }
    if (dirty) this.chipMesh.instanceMatrix.needsUpdate = true;
  }

  /** Apply (and decay) camera shake around the fixed base position. */
  applyShake(dt) {
    const cam = this.camera;
    if (this.shakeAmt < 0.002) {
      this.shakeAmt = 0;
      if (cam.userData.shaken) { cam.position.copy(cam.userData.base); cam.userData.shaken = false; cam.updateMatrixWorld(true); }
      return;
    }
    cam.userData.shaken = true;
    this.right.setFromMatrixColumn(cam.matrixWorld, 0);
    this.up.setFromMatrixColumn(cam.matrixWorld, 1);
    const a = this.shakeAmt;
    cam.position.copy(cam.userData.base)
      .addScaledVector(this.right, (Math.random() - 0.5) * 2 * a)
      .addScaledVector(this.up, (Math.random() - 0.5) * 2 * a);
    cam.updateMatrixWorld(true);
    this.shakeAmt *= Math.exp(-dt * 10);
  }
}
