import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { easeOutCubic } from '../lane-state';
import { GATE_CATALOGUE } from '../problem-gates';
import { LANE_X } from '../shared/config';
import type {
  GateDifficulty,
  ObstacleColorVariant,
  ObstacleGroup,
  ObstacleVariantId,
  PlayerState,
  ProblemGate,
  WorldState,
} from '../shared/types';

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
// Unified dark-blue obstacle palette. With problem cubes carrying the
// scene's "bright" element (neon green / yellow / red), obstacles fade
// into the floor's dark-Tron-blue family - readable mainly through their
// glowing cyan edges. All three ObstacleColorVariant entries point at
// the same values so the spawner's existing random-variant pick has no
// visual effect; the type union is retained for backward compatibility
// (and in case future slices want per-variant palettes back).
//
//   floor    = 0x041830
//   obstacle = 0x031020 (slightly darker than floor)
//   emissive = 0x183c70 (medium blue glow)
//   edge     = 0x4ab8ff (bright cyan, distinct from grid)
const OBSTACLE_PALETTE = {
  base: 0x031020,
  emissive: 0x183c70,
  edge: 0x4ab8ff,
} as const;
const COL_OBSTACLES: Readonly<Record<ObstacleColorVariant, {
  base: number;
  emissive: number;
  edge: number;
}>> = {
  red: OBSTACLE_PALETTE,
  blue: OBSTACLE_PALETTE,
  green: OBSTACLE_PALETTE,
};

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

// Trail (continuous thin glowing strip behind the runner, Tron lightcycle
// style). Built as a hand-rolled indexed BufferGeometry quad strip: each
// path point produces two vertices (left + right of the trail's centreline),
// adjacent path points are connected by two triangles forming a quad. The
// whole strip is one Mesh, so the visual is gap-free regardless of camera
// distance.
const TRAIL_MAX_POINTS = 32; // 1 player position + up to 31 buffered samples
const TRAIL_SPACING = 0.3; // world units between deposit samples
const TRAIL_HALF_WIDTH = 0.11; // half the trail's lateral width in world units
// COL_TRAIL (0xff8a30) decomposed for vertex-colour fade
const TRAIL_R = 1.0;
const TRAIL_G = 0x8a / 0xff;
const TRAIL_B = 0x30 / 0xff;

export interface ThreeRenderer {
  draw(player: PlayerState, world: WorldState): void;
  resize(widthPx: number, heightPx: number): void;
  updateObstacles(groups: readonly ObstacleGroup[]): void;
  updateGates(gates: readonly ProblemGate[], tickMs?: number): void;
  /**
   * Resets per-run internal state (cached distance baseline, scrolling-rung
   * positions, speed-line positions, trail buffer). Must be called by the
   * game-loop when restarting a run after game-over - otherwise the
   * renderer's lastDistance still holds the at-death value while
   * world.distanceUnits has jumped back to 0, producing a huge negative
   * scroll on the first frame after restart.
   */
  reset(): void;
  destroy(): void;
}

const GATE_SIZE = 0.9;
const GATE_FLOAT_Y = 1.2;
const GATE_POOL_SIZE = 12;
// Fixed diagonal pose that shows three faces of the cube simultaneously,
// mirroring the iconic "isometric" angle of Mario-Kart-style power-up
// blocks. Same for all gates so they read as a single visual category.
const GATE_TILT_X = -0.42; // forward tilt (radians) - shows top face
const GATE_TILT_Y = 0.62; // side turn (radians) - shows right face
const GATE_BOB_AMPLITUDE = 0.10; // world units of vertical hover travel
const GATE_BOB_PERIOD_MS = 1400;
const GATE_SPIN_PERIOD_MS = 9000; // slow constant Y-spin for "alive" feel
// Candle-flicker glow: three sine components at irrational period ratios
// give a smooth wavering pulse that never repeats noticeably. Primary
// period sets the overall cadence; the secondary periods are derived
// from it in updateGates() (× 1.53 and × 1.91 — non-rational so the
// combined waveform doesn't lock into a visible cycle).
const GATE_CANDLE_PERIOD_MS = 2400;
const GATE_HALO_SCALE = 2.6; // outer-glow halo size relative to cube
const GATE_QMARK_SCALE = 1.05; // question-mark sprite size relative to cube

const OBSTACLE_POOL_SIZE = 12;
const OBSTACLE_HEIGHTS: Readonly<Record<ObstacleVariantId, number>> = {
  cube: 1.4,
  pillar: 2.6,
  cylinder: 1.6,
  sphere: 1.6,
  'trapezoid-prism': 1.6,
  'wide-bar': 1.2,
};

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

  // Slightly stronger than 001's baseline so the obstacles (which use
  // toneMapped, flat-shaded materials with subtle emissive) read as 3D
  // rather than as flat patches of colour.
  scene.add(new THREE.AmbientLight(0x90a8e0, 0.38));
  const moon = new THREE.DirectionalLight(0xc8d0ff, 0.7);
  moon.position.set(8, 40, -10);
  scene.add(moon);
  const fillLight = new THREE.DirectionalLight(0x60a0ff, 0.25);
  fillLight.position.set(-12, 16, 14);
  scene.add(fillLight);

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

  // ---- Obstacle mesh pool ----------------------------------------------

  // Each obstacle is a THREE.Group containing two children:
  //   - body: a flat-shaded Mesh with the dark coloured material
  //   - edges: a LineSegments overlay of the geometry's sharp edges, in a
  //     bright glowing colour that bloom amplifies
  // This gives the classic Tron silhouette: visible 3D geometry defined
  // by glowing outlines, independent of light direction or face shading.
  function makeBodyMaterial(c: ObstacleColorVariant): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      color: COL_OBSTACLES[c].base,
      emissive: COL_OBSTACLES[c].emissive,
      emissiveIntensity: 0.45,
      roughness: 0.5,
      metalness: 0.2,
      flatShading: true,
      toneMapped: true,
    });
  }
  function makeEdgeMaterial(c: ObstacleColorVariant): LineMaterial {
    const mat = new LineMaterial({
      color: COL_OBSTACLES[c].edge,
      linewidth: 2, // pixels (worldUnits: false)
      worldUnits: false,
      transparent: false,
      depthWrite: true,
      toneMapped: false,
    });
    mat.resolution.set(canvas.clientWidth, canvas.clientHeight);
    return mat;
  }
  const obstacleBodyMaterials: Readonly<Record<ObstacleColorVariant, THREE.MeshStandardMaterial>> = {
    red: makeBodyMaterial('red'),
    blue: makeBodyMaterial('blue'),
    green: makeBodyMaterial('green'),
  };
  const obstacleEdgeMaterials: Readonly<Record<ObstacleColorVariant, LineMaterial>> = {
    red: makeEdgeMaterial('red'),
    blue: makeEdgeMaterial('blue'),
    green: makeEdgeMaterial('green'),
  };

  function createTrapezoidGeometry(): THREE.BufferGeometry {
    const halfDepth = 0.5;
    const positions = new Float32Array([
      // bottom: y=0, x=±0.7 (wider)
      -0.7, 0, -halfDepth,
       0.7, 0, -halfDepth,
       0.7, 0,  halfDepth,
      -0.7, 0,  halfDepth,
      // top: y=1.6, x=±0.5 (narrower)
      -0.5, 1.6, -halfDepth,
       0.5, 1.6, -halfDepth,
       0.5, 1.6,  halfDepth,
      -0.5, 1.6,  halfDepth,
    ]);
    const indices = new Uint16Array([
      // bottom
      0, 2, 1, 0, 3, 2,
      // top
      4, 5, 6, 4, 6, 7,
      // front
      3, 2, 6, 3, 6, 7,
      // back
      0, 1, 5, 0, 5, 4,
      // left (slanted)
      0, 4, 7, 0, 7, 3,
      // right (slanted)
      1, 2, 6, 1, 6, 5,
    ]);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeVertexNormals();
    // Recenter Y so the geometry's pivot is at its base (already y=0 base, fine).
    return geometry;
  }

  // The 'sphere' variant uses an icosahedron rather than a smooth sphere so
  // it has real geometric edges to outline (a smooth sphere has none).
  const obstacleGeometries: Readonly<Record<ObstacleVariantId, THREE.BufferGeometry>> = {
    cube: new THREE.BoxGeometry(1.4, 1.4, 1.4),
    pillar: new THREE.BoxGeometry(1.0, 2.6, 1.0),
    cylinder: new THREE.CylinderGeometry(0.7, 0.7, 1.6, 10),
    sphere: new THREE.IcosahedronGeometry(0.85, 0),
    'trapezoid-prism': createTrapezoidGeometry(),
    'wide-bar': new THREE.BoxGeometry(4.0, 1.2, 1.0),
  };

  // Pre-compute edge geometry per variant. The thresholdAngleDeg parameter
  // of EdgesGeometry controls which polygon-to-polygon transitions count as
  // edges (face normals differing by more than threshold are emitted).
  // Wrapped in a LineSegmentsGeometry so the thick-line LineSegments2 /
  // LineMaterial pipeline can render them at a configurable pixel width
  // (vs the WebGL 1-px line cap on THREE.LineSegments). Shared across all
  // instances of the variant since the geometry never changes.
  function edgeGeom(g: THREE.BufferGeometry, thresholdAngleDeg = 1): LineSegmentsGeometry {
    const lsg = new LineSegmentsGeometry();
    lsg.fromEdgesGeometry(new THREE.EdgesGeometry(g, thresholdAngleDeg));
    return lsg;
  }
  const obstacleEdgeGeometries: Readonly<Record<ObstacleVariantId, LineSegmentsGeometry>> = {
    cube: edgeGeom(obstacleGeometries.cube),
    pillar: edgeGeom(obstacleGeometries.pillar),
    // 10-segment cylinder side facets meet at 36 degrees; pushing the
    // threshold to 40 drops the 10 vertical "cactus" edges and keeps only
    // the 90-degree top + bottom rim circles.
    cylinder: edgeGeom(obstacleGeometries.cylinder, 40),
    sphere: edgeGeom(obstacleGeometries.sphere),
    'trapezoid-prism': edgeGeom(obstacleGeometries['trapezoid-prism']),
    'wide-bar': edgeGeom(obstacleGeometries['wide-bar']),
  };

  interface ObstacleSlot {
    readonly group: THREE.Group;
    readonly body: THREE.Mesh;
    readonly edges: LineSegments2;
  }

  const obstaclePool: Map<ObstacleVariantId, ObstacleSlot[]> = new Map();
  for (const variantId of Object.keys(obstacleGeometries) as ObstacleVariantId[]) {
    const slots: ObstacleSlot[] = [];
    for (let i = 0; i < OBSTACLE_POOL_SIZE; i++) {
      const slotGroup = new THREE.Group();
      const body = new THREE.Mesh(obstacleGeometries[variantId], obstacleBodyMaterials.red);
      const edges = new LineSegments2(
        obstacleEdgeGeometries[variantId],
        obstacleEdgeMaterials.red,
      );
      slotGroup.add(body);
      slotGroup.add(edges);
      slotGroup.visible = false;
      scene.add(slotGroup);
      slots.push({ group: slotGroup, body, edges });
    }
    obstaclePool.set(variantId, slots);
  }

  // ---- Problem-gate mesh pool ------------------------------------------

  // Each gate is a THREE.Group of:
  //   - body: muted-coloured BoxGeometry mesh, slightly translucent
  //   - edges: LineSegments2 overlay showing the 12 outer edges only
  //            (no internal grid - the Mario-Kart-style "?" sprite is the
  //            distinguishing detail rather than a Rubik's face grid)
  //   - sprite: a camera-facing THREE.Sprite with a programmatic "?"
  //            texture so the question-block identity is visible from any
  //            viewing angle
  // The gate group is rendered at a fixed iso/diagonal pose
  // (GATE_TILT_X / GATE_TILT_Y) plus a slow per-gate Y-spin so the
  // edges catch the light. Body emissive intensity pulses for a
  // power-up sparkle.

  // Procedural "?" canvas texture. Drawn once at boot, shared across all
  // gates. White glyph with a dark outline so it reads against any cube
  // colour; transparent background lets the cube body show through.
  function makeQuestionMarkTexture(): THREE.CanvasTexture {
    const size = 256;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, size, size);
      ctx.font =
        'bold 200px ui-monospace, SFMono-Regular, "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Dark stroke first as a halo behind the white fill - keeps the "?"
      // readable on bright bloomed faces.
      ctx.strokeStyle = 'rgba(8, 12, 24, 0.85)';
      ctx.lineWidth = 14;
      ctx.lineJoin = 'round';
      ctx.strokeText('?', size / 2, size / 2 + 8);
      ctx.fillStyle = '#ffffff';
      ctx.fillText('?', size / 2, size / 2 + 8);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 4;
    return tex;
  }
  const questionMarkTexture = makeQuestionMarkTexture();

  // Radial-gradient halo texture. White at the centre, fading to fully
  // transparent at the edge. Used with AdditiveBlending so the halo
  // bleeds light around the cube and pulses with the twinkle.
  function makeHaloTexture(): THREE.CanvasTexture {
    const size = 256;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    if (ctx) {
      const cx = size / 2;
      const cy = size / 2;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, cx);
      grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
      grad.addColorStop(0.25, 'rgba(255, 255, 255, 0.55)');
      grad.addColorStop(0.55, 'rgba(255, 255, 255, 0.18)');
      grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }
  const haloTexture = makeHaloTexture();

  const gateGeometry = new THREE.BoxGeometry(GATE_SIZE, GATE_SIZE, GATE_SIZE);
  // Simple 12-edge outline (no internal grid) using EdgesGeometry.
  const gateEdgeGeometry = new LineSegmentsGeometry();
  gateEdgeGeometry.fromEdgesGeometry(new THREE.EdgesGeometry(gateGeometry, 1));

  function gateColorHexToNumber(hex: string): number {
    return parseInt(hex.slice(1), 16);
  }

  function makeGateBodyMaterial(d: GateDifficulty): THREE.MeshStandardMaterial {
    const color = gateColorHexToNumber(GATE_CATALOGUE[d].colorHex);
    return new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.55,
      roughness: 0.4,
      metalness: 0.55,
      transparent: true,
      opacity: 0.72,
      flatShading: true,
      toneMapped: true,
    });
  }

  function makeGateEdgeMaterial(d: GateDifficulty): LineMaterial {
    const color = gateColorHexToNumber(GATE_CATALOGUE[d].colorHex);
    const mat = new LineMaterial({
      color,
      linewidth: 2,
      worldUnits: false,
      transparent: false,
      depthWrite: true,
      toneMapped: false,
    });
    mat.resolution.set(canvas.clientWidth, canvas.clientHeight);
    return mat;
  }

  const gateBodyMaterials: Readonly<Record<GateDifficulty, THREE.MeshStandardMaterial>> = {
    B: makeGateBodyMaterial('B'),
    M: makeGateBodyMaterial('M'),
    A: makeGateBodyMaterial('A'),
  };
  const gateEdgeMaterials: Readonly<Record<GateDifficulty, LineMaterial>> = {
    B: makeGateEdgeMaterial('B'),
    M: makeGateEdgeMaterial('M'),
    A: makeGateEdgeMaterial('A'),
  };

  // Shared sprite material for the camera-facing "?" decal. depthTest is
  // disabled so the glyph always renders on top of the cube body and
  // edges (otherwise the body's translucent fragments occlude it
  // depending on view angle). renderOrder 5 puts the sprite after the
  // body + edges in the draw queue.
  const gateSpriteMaterial = new THREE.SpriteMaterial({
    map: questionMarkTexture,
    transparent: true,
    toneMapped: false,
    color: 0xffffff,
    depthWrite: false,
    depthTest: false,
  });

  // Halo material. AdditiveBlending so the glow stacks on whatever is
  // behind it (the scene's dark ground + bloom). Per-difficulty colour
  // so the halo bleeds the same hue as the cube body. depthTest disabled
  // so the halo never gets clipped by other gates / obstacles in front.
  function makeGateHaloMaterial(d: GateDifficulty): THREE.SpriteMaterial {
    const color = gateColorHexToNumber(GATE_CATALOGUE[d].colorHex);
    return new THREE.SpriteMaterial({
      map: haloTexture,
      transparent: true,
      toneMapped: false,
      color,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      opacity: 0.55,
    });
  }
  const gateHaloMaterials: Readonly<Record<GateDifficulty, THREE.SpriteMaterial>> = {
    B: makeGateHaloMaterial('B'),
    M: makeGateHaloMaterial('M'),
    A: makeGateHaloMaterial('A'),
  };

  interface GateSlot {
    readonly group: THREE.Group;
    readonly body: THREE.Mesh;
    readonly edges: LineSegments2;
    readonly sprite: THREE.Sprite;
    readonly halo: THREE.Sprite;
  }

  const gatePool: GateSlot[] = [];
  for (let i = 0; i < GATE_POOL_SIZE; i++) {
    const grp = new THREE.Group();
    const body = new THREE.Mesh(gateGeometry, gateBodyMaterials.B);
    const edges = new LineSegments2(gateEdgeGeometry, gateEdgeMaterials.B);
    const halo = new THREE.Sprite(gateHaloMaterials.B);
    halo.scale.set(GATE_SIZE * GATE_HALO_SCALE, GATE_SIZE * GATE_HALO_SCALE, 1);
    halo.renderOrder = -1; // behind cube body, halo lights up from "outside"
    const sprite = new THREE.Sprite(gateSpriteMaterial);
    sprite.scale.set(GATE_SIZE * GATE_QMARK_SCALE, GATE_SIZE * GATE_QMARK_SCALE, 1);
    sprite.renderOrder = 5; // on top of body + edges so the "?" always shows
    grp.add(halo);
    grp.add(body);
    grp.add(edges);
    grp.add(sprite);
    grp.visible = false;
    scene.add(grp);
    gatePool.push({ group: grp, body, edges, sprite, halo });
  }

  function updateGates(gates: readonly ProblemGate[], tickMs = 0): void {
    // Candle-flicker glow: three slow sine components at irrational period
    // ratios sum to a smooth wavering pulse that dims and brightens
    // continuously without locking into an obvious cycle. Feels like a
    // hovering flame rather than a strobe. Time-base is world.tickMs so
    // the flicker freezes during a modal-open ('answering') frame - the
    // world is paused, the gate pauses with it.
    const primaryPhase = (tickMs / GATE_CANDLE_PERIOD_MS) * Math.PI * 2;
    const driftPhase =
      (tickMs / (GATE_CANDLE_PERIOD_MS * 1.53)) * Math.PI * 2 + 1.1;
    const deepPhase =
      (tickMs / (GATE_CANDLE_PERIOD_MS * 1.91)) * Math.PI * 2 + 2.4;
    const combined =
      0.55 * Math.sin(primaryPhase) +
      0.30 * Math.sin(driftPhase) +
      0.15 * Math.sin(deepPhase);
    // combined sits in roughly [-1, 1]; normalise to [0, 1] for mapping.
    const intensity01 = 0.5 + 0.5 * combined;
    // Wide ranges so the dim feels properly dim and the peak pops.
    const emissive = 0.4 + 1.2 * intensity01; // [0.4, 1.6]
    const haloOpacity = 0.2 + 0.7 * intensity01; // [0.2, 0.9]

    gateBodyMaterials.B.emissiveIntensity = emissive;
    gateBodyMaterials.M.emissiveIntensity = emissive;
    gateBodyMaterials.A.emissiveIntensity = emissive;
    gateHaloMaterials.B.opacity = haloOpacity;
    gateHaloMaterials.M.opacity = haloOpacity;
    gateHaloMaterials.A.opacity = haloOpacity;

    let used = 0;
    for (const g of gates) {
      if (used >= gatePool.length) break;
      const slot = gatePool[used]!;

      // Vertical hover: each gate bobs with a per-gate phase offset so they
      // don't all dip in unison. Phase is derived from the gate id (stable
      // across frames).
      const bobPhase =
        (((tickMs + g.id * 137) % GATE_BOB_PERIOD_MS) / GATE_BOB_PERIOD_MS) *
        Math.PI * 2;
      const bobY = GATE_FLOAT_Y + Math.sin(bobPhase) * GATE_BOB_AMPLITUDE;
      slot.group.position.set(LANE_X[g.lane], bobY, g.worldZ);

      // Fixed iso/diagonal pose + a slow continuous Y-spin that drifts
      // by a per-gate offset so they don't all face the same direction at
      // exactly the same moment. The base tilt stays constant: viewer
      // sees the front-left, right-side, and top faces.
      const spinPhase =
        ((tickMs + g.id * 311) % GATE_SPIN_PERIOD_MS) / GATE_SPIN_PERIOD_MS;
      slot.group.rotation.set(
        GATE_TILT_X,
        GATE_TILT_Y + spinPhase * Math.PI * 2,
        0,
      );

      // Halo + "?" sprite are camera-facing: reset their local positions
      // to the group's centre so they stay locked to the cube.
      slot.halo.position.set(0, 0, 0);
      slot.sprite.position.set(0, 0, 0);

      slot.body.material = gateBodyMaterials[g.difficulty];
      slot.edges.material = gateEdgeMaterials[g.difficulty];
      slot.halo.material = gateHaloMaterials[g.difficulty];
      slot.group.visible = true;
      used++;
    }
    for (let i = used; i < gatePool.length; i++) {
      gatePool[i]!.group.visible = false;
    }
  }

  function updateObstacles(groups: readonly ObstacleGroup[]): void {
    const usage = new Map<ObstacleVariantId, number>();
    for (const variantId of obstaclePool.keys()) usage.set(variantId, 0);

    for (const group of groups) {
      const pool = obstaclePool.get(group.variant);
      if (!pool) continue;
      const used = usage.get(group.variant)!;
      if (used >= pool.length) continue;
      const slot = pool[used]!;
      usage.set(group.variant, used + 1);

      let xPos: number;
      if (group.blockedLanes.length === 1) {
        xPos = LANE_X[group.blockedLanes[0]!];
      } else {
        const x0 = LANE_X[group.blockedLanes[0]!];
        const x1 = LANE_X[group.blockedLanes[1]!];
        xPos = (x0 + x1) / 2;
      }
      const variantHeight = OBSTACLE_HEIGHTS[group.variant];
      const yPos =
        group.variant === 'trapezoid-prism' ? 0 : variantHeight / 2;

      slot.group.position.set(xPos, yPos, group.worldZ);
      slot.body.material = obstacleBodyMaterials[group.colorVariant];
      slot.edges.material = obstacleEdgeMaterials[group.colorVariant];
      slot.group.visible = true;
    }

    for (const [variantId, pool] of obstaclePool) {
      const used = usage.get(variantId)!;
      for (let i = used; i < pool.length; i++) {
        pool[i]!.group.visible = false;
      }
    }
  }

  // ---- Light trail behind the runner -----------------------------------

  const trailPositions = new Float32Array(TRAIL_MAX_POINTS * 2 * 3);
  const trailColors = new Float32Array(TRAIL_MAX_POINTS * 2 * 3);
  // Pre-fill the index buffer: (N-1) quads connecting adjacent path points.
  const trailIndices = new Uint16Array((TRAIL_MAX_POINTS - 1) * 6);
  for (let i = 0; i < TRAIL_MAX_POINTS - 1; i++) {
    const a = i * 2;
    const b = i * 2 + 1;
    const c = (i + 1) * 2;
    const d = (i + 1) * 2 + 1;
    const base = i * 6;
    trailIndices[base + 0] = a;
    trailIndices[base + 1] = b;
    trailIndices[base + 2] = c;
    trailIndices[base + 3] = b;
    trailIndices[base + 4] = d;
    trailIndices[base + 5] = c;
  }

  const trailPositionAttribute = new THREE.BufferAttribute(trailPositions, 3);
  trailPositionAttribute.setUsage(THREE.DynamicDrawUsage);
  const trailColorAttribute = new THREE.BufferAttribute(trailColors, 3);
  trailColorAttribute.setUsage(THREE.DynamicDrawUsage);

  const trailGeometry = new THREE.BufferGeometry();
  trailGeometry.setAttribute('position', trailPositionAttribute);
  trailGeometry.setAttribute('color', trailColorAttribute);
  trailGeometry.setIndex(new THREE.BufferAttribute(trailIndices, 1));
  trailGeometry.setDrawRange(0, 0);

  const trailMaterial = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    toneMapped: false,
  });
  const trailMesh = new THREE.Mesh(trailGeometry, trailMaterial);
  scene.add(trailMesh);

  const trailXBuffer: number[] = [];
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

    // Post-respawn invincibility blink: oscillate the runner figure's
    // visibility at ~6 Hz while invincibilityRemainingMs > 0. The trail
    // and the rest of the scene stay visible; only the figure flickers,
    // which reads as the standard "I'm invincible right now" cue. During
    // 'answering' (modal open) invincibility doesn't tick, so the figure
    // freezes in whichever state it last rendered.
    if (world.invincibilityRemainingMs > 0) {
      // Use tickMs as the time base so the blink phase is deterministic
      // and tied to the same clock that gates tickInvincibility.
      const blinkPhase = (world.tickMs * 0.012) % 1; // ~6 Hz at typical dtMs
      player.visible = blinkPhase < 0.5;
    } else {
      player.visible = true;
    }

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
    // travelled, then rewrite the quad-strip vertex buffer in place.
    distanceSinceLastTrailDeposit += distanceDelta;
    while (distanceSinceLastTrailDeposit >= TRAIL_SPACING) {
      trailXBuffer.unshift(player.position.x);
      // The buffer holds at most (TRAIL_MAX_POINTS - 1) entries because the
      // first path point is always the player's current position.
      if (trailXBuffer.length > TRAIL_MAX_POINTS - 1) {
        trailXBuffer.length = TRAIL_MAX_POINTS - 1;
      }
      distanceSinceLastTrailDeposit -= TRAIL_SPACING;
    }

    // Path point 0: the player's current position (the strip emerges from
    // directly underneath the runner).
    {
      const x = player.position.x;
      trailPositions[0] = x - TRAIL_HALF_WIDTH;
      trailPositions[1] = 0.06;
      trailPositions[2] = 0;
      trailPositions[3] = x + TRAIL_HALF_WIDTH;
      trailPositions[4] = 0.06;
      trailPositions[5] = 0;
      trailColors[0] = TRAIL_R;
      trailColors[1] = TRAIL_G;
      trailColors[2] = TRAIL_B;
      trailColors[3] = TRAIL_R;
      trailColors[4] = TRAIL_G;
      trailColors[5] = TRAIL_B;
    }

    // Path points 1..bufLen: buffered deposit samples drifting backward.
    const bufLen = trailXBuffer.length;
    const totalPoints = bufLen + 1;
    for (let i = 0; i < bufLen; i++) {
      const sampleX = trailXBuffer[i] ?? player.position.x;
      const sampleZ = i * TRAIL_SPACING + distanceSinceLastTrailDeposit;
      const base = (i + 1) * 2 * 3;
      trailPositions[base + 0] = sampleX - TRAIL_HALF_WIDTH;
      trailPositions[base + 1] = 0.06;
      trailPositions[base + 2] = sampleZ;
      trailPositions[base + 3] = sampleX + TRAIL_HALF_WIDTH;
      trailPositions[base + 4] = 0.06;
      trailPositions[base + 5] = sampleZ;
      const t = (i + 1) / totalPoints;
      const k = Math.pow(1 - t, 1.3);
      const r = TRAIL_R * k;
      const g = TRAIL_G * k;
      const b = TRAIL_B * k;
      trailColors[base + 0] = r;
      trailColors[base + 1] = g;
      trailColors[base + 2] = b;
      trailColors[base + 3] = r;
      trailColors[base + 4] = g;
      trailColors[base + 5] = b;
    }

    trailPositionAttribute.needsUpdate = true;
    trailColorAttribute.needsUpdate = true;
    // Number of quads is (totalPoints - 1); each quad has 6 indices.
    trailGeometry.setDrawRange(0, Math.max(totalPoints - 1, 0) * 6);

    composer.render();
  }

  function resize(widthPx: number, heightPx: number): void {
    camera.aspect = widthPx / Math.max(heightPx, 1);
    camera.updateProjectionMatrix();
    renderer.setSize(widthPx, heightPx, false);
    composer.setSize(widthPx, heightPx);
    bloom.resolution.set(widthPx, heightPx);
    obstacleEdgeMaterials.red.resolution.set(widthPx, heightPx);
    obstacleEdgeMaterials.blue.resolution.set(widthPx, heightPx);
    obstacleEdgeMaterials.green.resolution.set(widthPx, heightPx);
    gateEdgeMaterials.B.resolution.set(widthPx, heightPx);
    gateEdgeMaterials.M.resolution.set(widthPx, heightPx);
    gateEdgeMaterials.A.resolution.set(widthPx, heightPx);
  }

  function reset(): void {
    // Drop the cached distance baseline; the next frame computes a
    // distanceDelta from world.distanceUnits (which is 0 after restartRun).
    lastDistance = 0;
    distanceSinceLastTrailDeposit = 0;
    trailXBuffer.length = 0;
    // Re-spread the scrolling rungs across the full visible track so they
    // start from their initial positions, not from wherever they happened to
    // be at the moment of game-over.
    for (let i = 0; i < RUNG_COUNT; i++) {
      rungs[i]!.position.z = TRACK_NEAR_Z - i * RUNG_SPACING;
    }
    // Same for speed lines.
    for (const line of speedLines) {
      line.mesh.position.set(
        (Math.random() - 0.5) * 28,
        0.6 + Math.random() * 6,
        TRACK_FAR_Z + Math.random() * (TRACK_NEAR_Z - TRACK_FAR_Z + 20),
      );
    }
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

  return { draw, resize, updateObstacles, updateGates, reset, destroy };
}
