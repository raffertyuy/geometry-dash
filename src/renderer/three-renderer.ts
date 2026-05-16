import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { easeOutCubic } from '../lane-state';
import { LANE_X } from '../shared/config';
import type { PlayerState, WorldState } from '../shared/types';

// ---- Tron palette --------------------------------------------------------

const COL_BG = 0x010108;
const COL_GROUND = 0x041830; // dark Tron blue (the floor reads as deep blue, not black)
const COL_GRID_PRIMARY = 0x18c8ff; // softer cyan than full saturation
const COL_HORIZON = 0x18a8ff;
const COL_SUN = 0xff3aa0; // small magenta sun disc, dimmer than before
const COL_PLAYER = 0xff8a30; // amber - the runner's "user" colour, contrasts with cyan grid
const COL_PLAYER_BODY = 0x110804;
// Note: the trail's amber colour is decomposed into TRAIL_R/G/B below for
// per-vertex fade in the Line2 vertex-colour buffer.
const COL_SPEED_LINE = 0x8ad0ff;

// ---- Scene geometry ------------------------------------------------------

const TRACK_NEAR_Z = 12;
const TRACK_FAR_Z = -220;
const TRACK_LENGTH = TRACK_NEAR_Z - TRACK_FAR_Z;
const GRID_HALF_WIDTH = 20;
const RUNG_COUNT = 44;
const RUNG_SPACING = TRACK_LENGTH / RUNG_COUNT;
const SPEED_LINE_COUNT = 50;

// Camera
const CAMERA_FOV = 80;
const CAMERA_POS = new THREE.Vector3(0, 3.3, 6);
const CAMERA_LOOK = new THREE.Vector3(0, 1.1, -14);

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

// Trail (thin laser line behind the runner, Tron lightcycle style)
const TRAIL_POINT_COUNT = 28; // path points; (N-1) line segments
const TRAIL_SPACING = 0.32; // world units between deposit points
const TRAIL_PIXEL_WIDTH = 4; // line thickness in screen pixels
// COL_TRAIL (0xff8a30) decomposed for vertex-color fade
const TRAIL_R = 1.0;
const TRAIL_G = 0x8a / 0xff;
const TRAIL_B = 0x30 / 0xff;

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
  renderer.toneMappingExposure = 0.85;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COL_BG);
  scene.fog = new THREE.Fog(COL_BG, 28, 170);

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
  // Toned-down bloom: still gives the neon glow but does not blow out the
  // scene. Strength halved, threshold raised so only the brightest geometry
  // blooms (player, sun, horizon).
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(canvas.clientWidth, canvas.clientHeight),
    0.55, // strength
    0.45, // radius
    0.4, // threshold - only the brightest surfaces glow
  );
  composer.addPass(bloom);

  // ---- Lights ----------------------------------------------------------

  scene.add(new THREE.AmbientLight(0x90a8e0, 0.22));
  const moon = new THREE.DirectionalLight(0xb0c0ff, 0.32);
  moon.position.set(0, 40, -25);
  scene.add(moon);

  // ---- Ground ----------------------------------------------------------

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(GRID_HALF_WIDTH * 2, TRACK_LENGTH + 80),
    new THREE.MeshStandardMaterial({
      color: COL_GROUND,
      roughness: 0.7,
      metalness: 0.4,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, (TRACK_NEAR_Z + TRACK_FAR_Z) / 2);
  scene.add(ground);

  // ---- Vertical grid lines on the floor --------------------------------

  // Only the lane edges and a couple of close outer lines - removed the
  // far-out (x=+/-15) lines that read as bright diagonal beams in the
  // corners and contributed to the previous "too bright" impression.
  const dividerPositions = [
    { x: -3, intensity: 0.7 },
    { x: -1, intensity: 0.55 },
    { x: 1, intensity: 0.55 },
    { x: 3, intensity: 0.7 },
    { x: -7, intensity: 0.35 },
    { x: 7, intensity: 0.35 },
  ];
  for (const { x, intensity } of dividerPositions) {
    const line = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.04, TRACK_LENGTH + 80),
      new THREE.MeshStandardMaterial({
        color: COL_GRID_PRIMARY,
        emissive: COL_GRID_PRIMARY,
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
    emissiveIntensity: 0.55,
    toneMapped: false,
  });
  const rungs: THREE.Mesh[] = [];
  for (let i = 0; i < RUNG_COUNT; i++) {
    const rung = new THREE.Mesh(
      new THREE.BoxGeometry(GRID_HALF_WIDTH * 2, 0.04, 0.1),
      sharedRungMaterial,
    );
    rung.position.set(0, 0.03, TRACK_NEAR_Z - i * RUNG_SPACING);
    scene.add(rung);
    rungs.push(rung);
  }

  // ---- Horizon glow strip + magenta sun --------------------------------

  const horizon = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 2.2),
    new THREE.MeshBasicMaterial({
      color: COL_HORIZON,
      transparent: true,
      opacity: 0.45,
      toneMapped: false,
    }),
  );
  horizon.position.set(0, 2.0, -280);
  scene.add(horizon);

  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(4.5, 48),
    new THREE.MeshBasicMaterial({
      color: COL_SUN,
      transparent: true,
      opacity: 0.85,
      toneMapped: false,
    }),
  );
  sun.position.set(0, 7.5, -300);
  scene.add(sun);

  // ---- Speed lines (parallax depth streaks) ----------------------------

  const speedLines: SpeedLine[] = [];
  const speedLineMat = new THREE.MeshBasicMaterial({
    color: COL_SPEED_LINE,
    transparent: true,
    opacity: 0.35,
    toneMapped: false,
  });
  for (let i = 0; i < SPEED_LINE_COUNT; i++) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, 0.035, 1.4 + Math.random() * 2),
      speedLineMat,
    );
    mesh.position.set(
      (Math.random() - 0.5) * 28,
      0.6 + Math.random() * 6,
      TRACK_FAR_Z + Math.random() * (TRACK_NEAR_Z - TRACK_FAR_Z + 20),
    );
    scene.add(mesh);
    speedLines.push({ mesh, speedMul: 1.8 + Math.random() * 1.5 });
  }

  // ---- Runner figure (Tron-styled, amber accent) -----------------------

  const player = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: COL_PLAYER_BODY,
    emissive: COL_PLAYER,
    emissiveIntensity: 0.85,
    roughness: 0.35,
    metalness: 0.6,
    toneMapped: false,
  });
  const headMat = new THREE.MeshStandardMaterial({
    color: COL_PLAYER_BODY,
    emissive: COL_PLAYER,
    emissiveIntensity: 1.1,
    roughness: 0.2,
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

  // ---- Light trail behind the runner -----------------------------------

  // A continuous thin glowing line behind the runner, built from a Line2
  // (Three.js's thick-line addon). Each frame a new path point is
  // conceptually deposited at the player's current X every TRAIL_SPACING
  // world units of distance travelled. Older points drift backward (toward
  // and past the camera) as the world scrolls. Lane changes produce kinks
  // in the line at the X where they happened.
  const trailGeometry = new LineGeometry();
  const trailMaterial = new LineMaterial({
    color: 0xffffff, // tinted by vertex colors
    linewidth: TRAIL_PIXEL_WIDTH,
    vertexColors: true,
    transparent: true,
    worldUnits: false,
    depthWrite: false,
    toneMapped: false,
  });
  trailMaterial.resolution.set(canvas.clientWidth, canvas.clientHeight);
  const trailLine = new Line2(trailGeometry, trailMaterial);
  trailLine.visible = false;
  scene.add(trailLine);

  const trailXBuffer: number[] = [];
  const trailPositions: number[] = [];
  const trailColors: number[] = [];
  let distanceSinceLastTrailDeposit = 0;

  // ---- Draw loop -------------------------------------------------------

  let lastDistance = 0;

  function draw(p: PlayerState, world: WorldState): void {
    // Lane-x interpolation (unchanged math).
    const fromX = LANE_X[p.currentLane];
    const toX = p.targetLane !== null ? LANE_X[p.targetLane] : fromX;
    const t = easeOutCubic(p.animProgress);
    player.position.x = fromX + (toX - fromX) * t;

    // Stride animation: arms and legs swing in opposing phases.
    const stridePhase = world.tickMs * 0.022;
    const swing = Math.sin(stridePhase);
    leftArm.rotation.x = swing * 1.0;
    rightArm.rotation.x = -swing * 1.0;
    leftLeg.rotation.x = -swing * 0.85;
    rightLeg.rotation.x = swing * 0.85;

    // Slight vertical bob + permanent forward lean.
    player.position.y = Math.abs(Math.cos(stridePhase)) * 0.07;
    player.rotation.x = 0.16;

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
        line.mesh.position.x = (Math.random() - 0.5) * 28;
        line.mesh.position.y = 0.6 + Math.random() * 6;
      }
    }

    // Light trail: deposit a fresh path point every TRAIL_SPACING units
    // travelled, then rebuild the Line2's vertex buffer.
    distanceSinceLastTrailDeposit += distanceDelta;
    while (distanceSinceLastTrailDeposit >= TRAIL_SPACING) {
      trailXBuffer.unshift(player.position.x);
      if (trailXBuffer.length > TRAIL_POINT_COUNT) {
        trailXBuffer.length = TRAIL_POINT_COUNT;
      }
      distanceSinceLastTrailDeposit -= TRAIL_SPACING;
    }

    // Build positions and colors arrays.
    trailPositions.length = 0;
    trailColors.length = 0;

    // First point: the player's current position (the line emerges from
    // exactly underneath the runner).
    trailPositions.push(player.position.x, 0.06, 0);
    trailColors.push(TRAIL_R, TRAIL_G, TRAIL_B);

    const bufLen = trailXBuffer.length;
    for (let i = 0; i < bufLen; i++) {
      const x = trailXBuffer[i] ?? player.position.x;
      const z = i * TRAIL_SPACING + distanceSinceLastTrailDeposit;
      trailPositions.push(x, 0.06, z);
      // Fade by darkening the RGB toward the tail; bloom then drops off
      // naturally as the brightness falls below the bloom threshold.
      const t = (i + 1) / (bufLen + 1);
      const k = Math.pow(1 - t, 1.3);
      trailColors.push(TRAIL_R * k, TRAIL_G * k, TRAIL_B * k);
    }

    if (trailPositions.length >= 6) {
      // At least 2 points = drawable line segment.
      trailGeometry.setPositions(trailPositions);
      trailGeometry.setColors(trailColors);
      trailLine.computeLineDistances();
      trailLine.visible = true;
    } else {
      trailLine.visible = false;
    }

    composer.render();
  }

  function resize(widthPx: number, heightPx: number): void {
    camera.aspect = widthPx / Math.max(heightPx, 1);
    camera.updateProjectionMatrix();
    renderer.setSize(widthPx, heightPx, false);
    composer.setSize(widthPx, heightPx);
    bloom.resolution.set(widthPx, heightPx);
    trailMaterial.resolution.set(widthPx, heightPx);
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
