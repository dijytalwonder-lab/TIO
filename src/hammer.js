import * as THREE from 'three';
import { HAMMERS } from './levels.js';

// ---------------------------------------------------------------------------
// The player's hammer: a chunky low-poly mallet that swings in at the tapped point.
// Local frame: strike face at the origin, head extends along +Z, handle along +Y.
// ---------------------------------------------------------------------------

const WIND = 0.1, HOLD = 0.07, OUT = 0.2;

function buildHammer(skin) {
  const g = new THREE.Group();
  const mat = (c, em = 0x000000) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.55, metalness: 0.1, emissive: em, emissiveIntensity: 0.6 });
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.66, 1.0), mat(skin.head, skin.emissive));
  head.position.z = 0.5;
  const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.72, 0.13), mat(skin.band));
  b1.position.z = 0.09;
  const b2 = b1.clone(); b2.position.z = 0.91;
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.1, 2.1, 6), mat(skin.handle));
  handle.position.set(0, 1.35, 0.5);
  const knob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.15, 0), mat(skin.band));
  knob.position.set(0, 2.45, 0.5);
  g.add(head, b1, b2, handle, knob);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.renderOrder = 30; } });
  return g;
}

export class Hammer {
  constructor(scene) {
    this.scene = scene;
    this.units = [0, 1].map(() => ({ root: new THREE.Group(), busy: false, t: 0, phase: 0, cb: null }));
    this.units.forEach((u) => { u.root.visible = false; scene.add(u.root); });
    this.setSkin('wood');
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
  }

  setSkin(id) {
    const skin = HAMMERS.find((h) => h.id === id) || HAMMERS[0];
    this.skin = skin;
    this.units.forEach((u) => {
      while (u.root.children.length) {
        const c = u.root.children[0];
        u.root.remove(c);
        c.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      }
      u.model = buildHammer(skin);
      u.root.add(u.model);
    });
  }

  get free() { return this.units.some((u) => !u.busy); }

  /** Start a swing; onImpact fires when the face lands. */
  swing(point, normal, camRight, camUp, camToward, onImpact) {
    const u = this.units.find((k) => !k.busy);
    if (!u) return false;
    const z = new THREE.Vector3().addScaledVector(camRight, 0.85).addScaledVector(camToward, 0.55).addScaledVector(camUp, 0.35).addScaledVector(normal, 0.3).normalize();
    const y = camUp.clone().sub(z.clone().multiplyScalar(camUp.dot(z))).normalize();
    const x = new THREE.Vector3().crossVectors(y, z).normalize();
    this._m.makeBasis(x, y, z);
    u.q = new THREE.Quaternion().setFromRotationMatrix(this._m);
    u.p = point.clone();
    u.z = z;
    u.axis = camToward.clone().negate();            // view direction
    // choose the swing direction that lifts the head upwards
    const test = new THREE.Quaternion().setFromAxisAngle(u.axis, 0.9);
    u.sign = z.clone().applyQuaternion(test).dot(camUp) > z.dot(camUp) ? 1 : -1;
    u.busy = true; u.t = 0; u.phase = 0; u.cb = onImpact;
    u.root.visible = true;
    u.k = this.sizeK || 1;
    u.root.scale.setScalar(u.k);
    this._pose(u, 0);
    return true;
  }

  _pose(u, wind) {
    // wind 1 = raised, 0 = on the surface
    const ang = u.sign * 1.0 * wind;
    this._q.setFromAxisAngle(u.axis, ang);
    u.root.quaternion.copy(this._q).multiply(u.q);
    u.root.position.copy(u.p).addScaledVector(u.z, 0.9 * wind);
  }

  update(dt) {
    for (const u of this.units) {
      if (!u.busy) continue;
      u.t += dt;
      if (u.phase === 0) {
        const k = Math.min(1, u.t / WIND);
        this._pose(u, 1 - k * k * k);
        if (k >= 1) {
          u.phase = 1; u.t = 0;
          u.root.scale.set(u.k, u.k, 0.86 * u.k);
          if (u.cb) { const cb = u.cb; u.cb = null; cb(); }
        }
      } else if (u.phase === 1) {
        if (u.t >= HOLD) { u.phase = 2; u.t = 0; }
      } else {
        const k = Math.min(1, u.t / OUT);
        u.root.scale.setScalar(Math.max(0.001, u.k * (1 - k * k)));
        u.root.position.copy(u.p).addScaledVector(u.z, 1.3 * k);
        if (k >= 1) { u.busy = false; u.root.visible = false; }
      }
    }
  }

  hideAll() {
    this.units.forEach((u) => { u.busy = false; u.cb = null; u.root.visible = false; });
  }
}
