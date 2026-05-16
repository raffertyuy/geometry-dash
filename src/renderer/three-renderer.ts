import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { easeOutCubic } from '../lane-state';
import { LANE_X } from '../shared/config';
import type {
  ObstacleColorVariant,
  ObstacleGroup,
  ObstacleVariantId,
  PlayerState,
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
// Per-colour obstacle palette. Each entry has three parts:
//   - body: the (darker, slightly emissive) face colour
//   - bodyEmit: the colour the body's faces glow with at low intensity
//   - edge: the bright line colour overlaid on the geometric edges
// The Tron look comes from the edges; the body just adds a coloured wash.
const COL_OBSTACLES: Readonly<Record<ObstacleColorVariant, {
  base: number;
  emissive: number;
  edge: number;
}>> = {
  red:   { base: 0x2a0612, emissive: 0xb02238, edge: 0xff3a5e },
  blue:  { base: 0x07154a, emissive: 0x2a55d8, edge: 0x4ab8ff },
  green: { base: 0x062a0e, emissive: 0x2aa040, edge: 0x4fff8a },
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
  destroy(): void;
}

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
  function makeEdgeMaterial(c: ObstacleColorVariant): THREE.LineBasicMaterial {
    return new THREE.LineBasicMaterial({
      color: COL_OBSTACLES[c].edge,
      toneMapped: false,
    });
  }
  const obstacleBodyMaterials: Readonly<Record<ObstacleColorVariant, THREE.MeshStandardMaterial>> = {
    red: makeBodyMaterial('red'),
    blue: makeBodyMaterial('blue'),
    green: makeBodyMaterial('green'),
  };
  const obstacleEdgeMaterials: Readonly<Record<ObstacleColorVariant, THREE.LineBasicMaterial>> = {
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

  // Pre-compute edge geometry per variant (extracts ridges where face
  // normals differ by more than 1 degree). Shared across all instances of
  // the variant since the geometry never changes.
  const obstacleEdgeGeometries: Readonly<Record<ObstacleVariantId, THREE.EdgesGeometry>> = {
    cube: new THREE.EdgesGeometry(obstacleGeometries.cube, 1),
    pillar: new THREE.EdgesGeometry(obstacleGeometries.pillar, 1),
    cylinder: new THREE.EdgesGeometry(obstacleGeometries.cylinder, 1),
    sphere: new THREE.EdgesGeometry(obstacleGeometries.sphere, 1),
    'trapezoid-prism': new THREE.EdgesGeometry(obstacleGeometries['trapezoid-prism'], 1),
    'wide-bar': new THREE.EdgesGeometry(obstacleGeometries['wide-bar'], 1),
  };

  interface ObstacleSlot {
    readonly group: THREE.Group;
    readonly body: THREE.Mesh;
    readonly edges: THREE.LineSegments;
  }

  const obstaclePool: Map<ObstacleVariantId, ObstacleSlot[]> = new Map();
  for (const variantId of Object.keys(obstacleGeometries) as ObstacleVariantId[]) {
    const slots: ObstacleSlot[] = [];
    for (let i = 0; i < OBSTACLE_POOL_SIZE; i++) {
      const slotGroup = new THREE.Group();
      const body = new THREE.Mesh(obstacleGeometries[variantId], obstacleBodyMaterials.red);
      const edges = new THREE.LineSegments(
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

  return { draw, resize, updateObstacles, destroy };
}
