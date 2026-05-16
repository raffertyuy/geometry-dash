import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { easeOutCubic } from '../lane-state';
import { LANE_X } from '../shared/config';
import type { PlayerState, WorldState } from '../shared/types';

// ---- Tron palette --------------------------------------------------------

const COL_BG = 0x02020a;
const COL_GROUND = 0x05051a;
const COL_GRID_PRIMARY = 0x00f6ff; // cyan
const COL_GRID_SECONDARY = 0x0066ff; // electric blue
const COL_HORIZON = 0x18d2ff;
const COL_SUN = 0xff2d96; // magenta sun disc
const COL_PLAYER_EMIT = 0x18d2ff;
const COL_PLAYER_BODY = 0x031020;
const COL_SPEED_LINE = 0x66d8ff;

// ---- Scene geometry ------------------------------------------------------

const TRACK_NEAR_Z = 14;
const TRACK_FAR_Z = -200;
const TRACK_LENGTH = TRACK_NEAR_Z - TRACK_FAR_Z;
const GRID_HALF_WIDTH = 20;
const RUNG_COUNT = 40;
const RUNG_SPACING = TRACK_LENGTH / RUNG_COUNT;
const SPEED_LINE_COUNT = 60;

// Camera
const CAMERA_FOV = 78;
const CAMERA_POS = new THREE.Vector3(0, 3.2, 6);
const CAMERA_LOOK = new THREE.Vector3(0, 1.2, -12);

// Player runner figure geometry
const PLAYER_TORSO_W = 0.4;
const PLAYER_TORSO_H = 0.55;
const PLAYER_TORSO_D = 0.25;
const PLAYER_ARM_LEN = 0.5;
const PLAYER_LEG_LEN = 0.6;
const PLAYER_LIMB_W = 0.12;
const PLAYER_SHOULDER_Y = 1.15;
const PLAYER_HIP_Y = 0.68;
const PLAYER_HEAD_Y = 1.42;
const PLAYER_SHOULDER_X = 0.26;
const PLAYER_HIP_X = 0.11;

export interface ThreeRenderer {
  draw(player: PlayerState, world: WorldState): void;
  resize(widthPx: number, heightPx: number): void;
  destroy(): void;
}

interface SpeedLine {
  readonly mesh: THREE.Mesh;
  readonly speedMul: number;
}

function makeLimb(
  parent: THREE.Object3D,
  pivot: { x: number; y: number },
  length: number,
  width: number,
  material: THREE.Material,
): THREE.Object3D {
  const joint = new THREE.Object3D();
  joint.position.set(pivot.x, pivot.y, 0);
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, length, width),
    material,
  );
  mesh.position.y = -length / 2;
  joint.add(mesh);
  parent.add(joint);
  return joint;
}

export function createThreeRenderer(canvas: HTMLCanvasElement): ThreeRenderer {
  // ---- Renderer + composer ---------------------------------------------

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COL_BG);
  scene.fog = new THREE.Fog(COL_BG, 32, 180);

  const camera = new THREE.PerspectiveCamera(
    CAMERA_FOV,
    canvas.clientWidth / Math.max(canvas.clientHeight, 1),
    0.1,
    420,
  );
  camera.position.copy(CAMERA_POS);
  camera.lookAt(CAMERA_LOOK);

  const composer = new EffectComposer(renderer);
  composer.setSize(canvas.clientWidth, canvas.clientHeight);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(canvas.clientWidth, canvas.clientHeight),
    1.05, // strength
    0.55, // radius
    0.22, // threshold
  );
  composer.addPass(bloom);

  // ---- Lights ----------------------------------------------------------

  scene.add(new THREE.AmbientLight(0xb0c8ff, 0.18));
  const moon = new THREE.DirectionalLight(0xcfd8ff, 0.35);
  moon.position.set(0, 40, -25);
  scene.add(moon);

  // ---- Ground ----------------------------------------------------------

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(GRID_HALF_WIDTH * 2, TRACK_LENGTH + 80),
    new THREE.MeshStandardMaterial({
      color: COL_GROUND,
      roughness: 0.85,
      metalness: 0.2,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, (TRACK_NEAR_Z + TRACK_FAR_Z) / 2);
  scene.add(ground);

  // ---- Lane dividers (vertical grid lines on the floor) ---------------

  const dividerPositions = [
    { x: -3, color: COL_GRID_PRIMARY, intensity: 1.6 }, // outer-left lane edge
    { x: -1, color: COL_GRID_PRIMARY, intensity: 1.4 }, // left/centre divider
    { x: 1, color: COL_GRID_PRIMARY, intensity: 1.4 }, // centre/right divider
    { x: 3, color: COL_GRID_PRIMARY, intensity: 1.6 }, // outer-right lane edge
    { x: -8, color: COL_GRID_SECONDARY, intensity: 1.0 }, // far-left grid line
    { x: 8, color: COL_GRID_SECONDARY, intensity: 1.0 }, // far-right grid line
    { x: -15, color: COL_GRID_SECONDARY, intensity: 0.7 },
    { x: 15, color: COL_GRID_SECONDARY, intensity: 0.7 },
  ];
  for (const { x, color, intensity } of dividerPositions) {
    const line = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.04, TRACK_LENGTH + 80),
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: intensity,
        toneMapped: false,
      }),
    );
    line.position.set(x, 0.025, (TRACK_NEAR_Z + TRACK_FAR_Z) / 2);
    scene.add(line);
  }

  // ---- Horizontal scrolling rungs --------------------------------------

  const sharedRungMaterial = new THREE.MeshStandardMaterial({
    color: COL_GRID_PRIMARY,
    emissive: COL_GRID_PRIMARY,
    emissiveIntensity: 1.4,
    toneMapped: false,
  });
  const rungs: THREE.Mesh[] = [];
  for (let i = 0; i < RUNG_COUNT; i++) {
    const rung = new THREE.Mesh(
      new THREE.BoxGeometry(GRID_HALF_WIDTH * 2, 0.04, 0.12),
      sharedRungMaterial,
    );
    rung.position.set(0, 0.03, TRACK_NEAR_Z - i * RUNG_SPACING);
    scene.add(rung);
    rungs.push(rung);
  }

  // ---- Horizon glow strip + magenta sun disc --------------------------

  const horizon = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 3.2),
    new THREE.MeshBasicMaterial({
      color: COL_HORIZON,
      transparent: true,
      opacity: 0.7,
      toneMapped: false,
    }),
  );
  horizon.position.set(0, 2.2, -260);
  scene.add(horizon);

  const sunMat = new THREE.MeshBasicMaterial({
    color: COL_SUN,
    toneMapped: false,
  });
  const sun = new THREE.Mesh(new THREE.CircleGeometry(7, 48), sunMat);
  sun.position.set(0, 9, -280);
  scene.add(sun);

  // ---- Speed lines (parallax depth streaks past the camera) -----------

  const speedLines: SpeedLine[] = [];
  const speedLineMat = new THREE.MeshBasicMaterial({
    color: COL_SPEED_LINE,
    transparent: true,
    opacity: 0.55,
    toneMapped: false,
  });
  for (let i = 0; i < SPEED_LINE_COUNT; i++) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.04, 1.5 + Math.random() * 2.5),
      speedLineMat,
    );
    mesh.position.set(
      (Math.random() - 0.5) * 30,
      0.5 + Math.random() * 6,
      TRACK_FAR_Z + Math.random() * (TRACK_NEAR_Z - TRACK_FAR_Z + 20),
    );
    scene.add(mesh);
    speedLines.push({ mesh, speedMul: 1.8 + Math.random() * 1.4 });
  }

  // ---- Runner figure (Tron-styled stick humanoid) ---------------------

  const player = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: COL_PLAYER_BODY,
    emissive: COL_PLAYER_EMIT,
    emissiveIntensity: 0.7,
    roughness: 0.25,
    metalness: 0.6,
    toneMapped: false,
  });
  const headMat = new THREE.MeshStandardMaterial({
    color: COL_PLAYER_BODY,
    emissive: COL_PLAYER_EMIT,
    emissiveIntensity: 1.1,
    roughness: 0.15,
    metalness: 0.5,
    toneMapped: false,
  });

  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(PLAYER_TORSO_W, PLAYER_TORSO_H, PLAYER_TORSO_D),
    bodyMat,
  );
  torso.position.y = PLAYER_HIP_Y + PLAYER_TORSO_H / 2 - 0.1;
  player.add(torso);

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.3, 0.26),
    headMat,
  );
  head.position.y = PLAYER_HEAD_Y;
  player.add(head);

  const leftArm = makeLimb(
    player,
    { x: -PLAYER_SHOULDER_X, y: PLAYER_SHOULDER_Y },
    PLAYER_ARM_LEN,
    PLAYER_LIMB_W,
    bodyMat,
  );
  const rightArm = makeLimb(
    player,
    { x: PLAYER_SHOULDER_X, y: PLAYER_SHOULDER_Y },
    PLAYER_ARM_LEN,
    PLAYER_LIMB_W,
    bodyMat,
  );
  const leftLeg = makeLimb(
    player,
    { x: -PLAYER_HIP_X, y: PLAYER_HIP_Y },
    PLAYER_LEG_LEN,
    PLAYER_LIMB_W * 1.2,
    bodyMat,
  );
  const rightLeg = makeLimb(
    player,
    { x: PLAYER_HIP_X, y: PLAYER_HIP_Y },
    PLAYER_LEG_LEN,
    PLAYER_LIMB_W * 1.2,
    bodyMat,
  );

  player.position.set(LANE_X.centre, 0, 0);
  scene.add(player);

  // ---- Draw loop -------------------------------------------------------

  let lastDistance = 0;

  function draw(p: PlayerState, world: WorldState): void {
    // Lane-x interpolation (unchanged math).
    const fromX = LANE_X[p.currentLane];
    const toX = p.targetLane !== null ? LANE_X[p.targetLane] : fromX;
    const t = easeOutCubic(p.animProgress);
    player.position.x = fromX + (toX - fromX) * t;

    // Stride animation: arms and legs swing in opposing phases.
    const stridePhase = world.tickMs * 0.02;
    const swing = Math.sin(stridePhase);
    leftArm.rotation.x = swing * 1.0;
    rightArm.rotation.x = -swing * 1.0;
    leftLeg.rotation.x = -swing * 0.85;
    rightLeg.rotation.x = swing * 0.85;

    // Slight vertical bob + permanent forward lean for "running" silhouette.
    player.position.y = Math.abs(Math.cos(stridePhase)) * 0.08;
    player.rotation.x = 0.14;

    // Scroll rungs toward the camera.
    const distanceDelta = world.distanceUnits - lastDistance;
    lastDistance = world.distanceUnits;
    for (const rung of rungs) {
      rung.position.z += distanceDelta;
      if (rung.position.z > TRACK_NEAR_Z) {
        rung.position.z -= TRACK_LENGTH;
      }
    }

    // Speed lines: faster than ground for a parallax-style depth cue.
    for (const line of speedLines) {
      line.mesh.position.z += distanceDelta * line.speedMul;
      if (line.mesh.position.z > TRACK_NEAR_Z + 10) {
        line.mesh.position.z -= TRACK_LENGTH + 30;
        line.mesh.position.x = (Math.random() - 0.5) * 30;
        line.mesh.position.y = 0.5 + Math.random() * 6;
      }
    }

    composer.render();
  }

  function resize(widthPx: number, heightPx: number): void {
    camera.aspect = widthPx / Math.max(heightPx, 1);
    camera.updateProjectionMatrix();
    renderer.setSize(widthPx, heightPx, false);
    composer.setSize(widthPx, heightPx);
    bloom.resolution.set(widthPx, heightPx);
  }

  function destroy(): void {
    renderer.dispose();
    composer.dispose();
    scene.traverse((obj) => {
      const mesh = obj as Partial<THREE.Mesh>;
      mesh.geometry?.dispose?.();
      const material = mesh.material;
      if (!material) return;
      if (Array.isArray(material)) {
        for (const m of material) m.dispose();
      } else {
        material.dispose();
      }
    });
  }

  return { draw, resize, destroy };
}
