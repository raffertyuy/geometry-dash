import * as THREE from 'three';
import { easeOutCubic } from '../lane-state';
import { LANE_X } from '../shared/config';
import type { Lane, PlayerState, WorldState } from '../shared/types';

const TRACK_WIDTH = 6; // world units; covers all three 2-wide lanes
const TRACK_NEAR_Z = 20; // just behind the camera
const TRACK_FAR_Z = -180; // far ahead of the player
const TRACK_LENGTH = TRACK_NEAR_Z - TRACK_FAR_Z;
const RUNG_COUNT = 40;
const RUNG_SPACING = TRACK_LENGTH / RUNG_COUNT;
const PLAYER_SIZE = 1;
const PLAYER_Y = PLAYER_SIZE / 2;
const CAMERA_Y = 4;
const CAMERA_Z = 8;
const SKY_COLOUR = 0x1f1f29;

// Per-lane subtle accent colour to help the player read the track at a glance.
const LANE_TINTS: Readonly<Record<Lane, number>> = {
  left: 0x2a2a3a,
  centre: 0x32323e,
  right: 0x2a2a3a,
};

export interface ThreeRenderer {
  draw(player: PlayerState, world: WorldState): void;
  resize(widthPx: number, heightPx: number): void;
  destroy(): void;
}

export function createThreeRenderer(canvas: HTMLCanvasElement): ThreeRenderer {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY_COLOUR);
  scene.fog = new THREE.Fog(SKY_COLOUR, 40, 160);

  const camera = new THREE.PerspectiveCamera(
    70,
    canvas.clientWidth / Math.max(canvas.clientHeight, 1),
    0.1,
    400,
  );
  camera.position.set(0, CAMERA_Y, CAMERA_Z);
  camera.lookAt(0, 1, -8);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

  // Lighting.
  scene.add(new THREE.AmbientLight(0xffffff, 0.45));
  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(4, 12, 6);
  scene.add(sun);

  // Ground (one rectangle covering all three lanes).
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a26,
    roughness: 0.9,
    metalness: 0.05,
  });
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(TRACK_WIDTH, TRACK_LENGTH),
    groundMat,
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, (TRACK_NEAR_Z + TRACK_FAR_Z) / 2);
  scene.add(ground);

  // Tinted lane strips (visual hint where each lane is).
  for (const lane of ['left', 'centre', 'right'] as const) {
    const tint = new THREE.Mesh(
      new THREE.PlaneGeometry(1.9, TRACK_LENGTH),
      new THREE.MeshStandardMaterial({ color: LANE_TINTS[lane] }),
    );
    tint.rotation.x = -Math.PI / 2;
    tint.position.set(LANE_X[lane], 0.005, (TRACK_NEAR_Z + TRACK_FAR_Z) / 2);
    scene.add(tint);
  }

  // Lane dividers (thin glowing strips between lanes).
  const dividerMat = new THREE.MeshStandardMaterial({
    color: 0x55557a,
    emissive: 0x222244,
  });
  for (const x of [-1, 1]) {
    const divider = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.04, TRACK_LENGTH),
      dividerMat,
    );
    divider.position.set(x, 0.02, (TRACK_NEAR_Z + TRACK_FAR_Z) / 2);
    scene.add(divider);
  }

  // Scrolling "rungs" (horizontal road-markers that scroll toward the camera
  // to convey forward motion).
  const rungMat = new THREE.MeshStandardMaterial({
    color: 0x6464a0,
    emissive: 0x111122,
  });
  const rungs: THREE.Mesh[] = [];
  for (let i = 0; i < RUNG_COUNT; i++) {
    const rung = new THREE.Mesh(
      new THREE.BoxGeometry(TRACK_WIDTH - 0.4, 0.04, 0.18),
      rungMat,
    );
    rung.position.set(0, 0.03, TRACK_FAR_Z + i * RUNG_SPACING);
    scene.add(rung);
    rungs.push(rung);
  }

  // Player (a green cube for now; will become a 3D model in a later slice).
  const player = new THREE.Mesh(
    new THREE.BoxGeometry(PLAYER_SIZE, PLAYER_SIZE, PLAYER_SIZE),
    new THREE.MeshStandardMaterial({
      color: 0x22cc88,
      emissive: 0x114433,
      roughness: 0.4,
    }),
  );
  player.position.set(LANE_X.centre, PLAYER_Y, 0);
  scene.add(player);

  let lastDistance = 0;

  function draw(p: PlayerState, world: WorldState): void {
    // Lane-x interpolation.
    const fromX = LANE_X[p.currentLane];
    const toX = p.targetLane !== null ? LANE_X[p.targetLane] : fromX;
    const t = easeOutCubic(p.animProgress);
    player.position.x = fromX + (toX - fromX) * t;

    // Subtle vertical bob to imply running (no physics; cosmetic only).
    player.position.y =
      PLAYER_Y + Math.sin(world.tickMs * 0.012) * 0.05;
    player.rotation.x = Math.sin(world.tickMs * 0.012) * 0.05;

    // Scroll the rungs toward the camera by the distance delta.
    const distanceDelta = world.distanceUnits - lastDistance;
    lastDistance = world.distanceUnits;
    for (const rung of rungs) {
      rung.position.z += distanceDelta;
      if (rung.position.z > TRACK_NEAR_Z) {
        rung.position.z -= TRACK_LENGTH;
      }
    }

    renderer.render(scene, camera);
  }

  function resize(widthPx: number, heightPx: number): void {
    camera.aspect = widthPx / Math.max(heightPx, 1);
    camera.updateProjectionMatrix();
    renderer.setSize(widthPx, heightPx, false);
  }

  function destroy(): void {
    renderer.dispose();
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
