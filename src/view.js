import * as THREE from 'three';
import { CAM } from './config.js';

/** Fixed isometric orthographic camera that always keeps the diorama fully in view. */
export function makeCamera() {
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  cam.userData.base = new THREE.Vector3();
  cam.userData.home = new THREE.Vector3();
  cam.userData.fx = 0; cam.userData.fy = 0;
  fitCamera(cam, 9 / 19.5);
  return cam;
}

export function fitCamera(cam, aspect) {
  let hw, hh;
  if (aspect >= CAM.viewW / CAM.viewH) { hh = CAM.viewH / 2; hw = hh * aspect; } else { hw = CAM.viewW / 2; hh = hw / aspect; }
  cam.left = -hw; cam.right = hw; cam.top = hh; cam.bottom = -hh;
  cam.aspect = aspect;
  const t = new THREE.Vector3(...CAM.target);
  const ce = Math.cos(CAM.elevation), se = Math.sin(CAM.elevation);
  cam.position.set(
    t.x + Math.sin(CAM.azimuth) * ce * CAM.distance,
    t.y + se * CAM.distance,
    t.z + Math.cos(CAM.azimuth) * ce * CAM.distance
  );
  cam.lookAt(t);
  cam.userData.home.copy(cam.position);
  cam.updateMatrixWorld(true);
  setView(cam, cam.userData.fx || 0, cam.userData.fy || 0, cam.zoom || 1);
}

/**
 * Magnified view: the home framing shifted by (fx, fy) world units along the camera's right / up axes and
 * zoomed by `zoom` (1 = the whole room). Orthographic, so shifting keeps the iso angle exactly.
 */
export function setView(cam, fx, fy, zoom) {
  const u = cam.userData;
  u.fx = fx; u.fy = fy;
  cam.zoom = zoom;
  const { right, up } = camAxes(cam);
  u.base.copy(u.home).addScaledVector(right, fx).addScaledVector(up, fy);
  if (!u.shaken) cam.position.copy(u.base);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld(true);
}

export function camAxes(cam) {
  cam.updateMatrixWorld(true);
  return {
    right: new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0).normalize(),
    up: new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1).normalize()
  };
}
