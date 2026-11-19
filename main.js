import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// DOM Elements
const canvas = document.querySelector('#webgl');
const loaderOverlay = document.querySelector('#loader');
const loaderProgress = document.querySelector('#loader-progress');
const loaderDetails = document.querySelector('#loader-details');
const loaderStatus = document.querySelector('#loader-status');

// 1. Scene & Atmosphere
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xcce7ff, 0.0018);

// 2. Camera Setup (Positioned for a sweeping 3/4 cinematic vista)
const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  2500
);
camera.position.set(3.5, 1.2, 147.5);

// 3. WebGL Renderer
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

// 4. OrbitControls (Full 360° Rotate, Pan, Zoom)
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxPolarAngle = Math.PI / 2 + 0.08; // Allow ground & street level angles
controls.minDistance = 2;
controls.maxDistance = 700;
controls.target.set(19.1, -1.6, 5); // Focus on active vista

// 5. Lighting
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x64748b, 1.2);
hemiLight.position.set(0, 150, 0);
scene.add(hemiLight);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xfffbeb, 2.2);
sunLight.position.set(180, 240, 120);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.near = 10;
sunLight.shadow.camera.far = 900;
sunLight.shadow.camera.left = -300;
sunLight.shadow.camera.right = 300;
sunLight.shadow.camera.top = 300;
sunLight.shadow.camera.bottom = -300;
sunLight.shadow.bias = -0.0003;
scene.add(sunLight);
scene.add(sunLight.target);

const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.8);
fillLight.position.set(-120, 90, -120);
scene.add(fillLight);

// Universal Asset Lighting & Shadow Controller (Affects all current & future 3D assets)
let currentSunAngle = 45;        // 0° to 360° horizontal rotation
let currentSunHeight = 50;       // 10° to 85° elevation
let currentAssetBrightness = 70; // 0% to 100% surface illumination
let currentShadowDarkness = 65;  // 0% (soft) to 100% (pitch black)

function updateAssetLighting() {
  const theta = THREE.MathUtils.degToRad(currentSunAngle);
  const phi = THREE.MathUtils.degToRad(currentSunHeight);
  const R = 340;

  const cosElev = Math.cos(phi);
  sunLight.position.set(
    R * cosElev * Math.sin(theta),
    R * Math.sin(phi),
    R * cosElev * Math.cos(theta)
  );

  // Asset direct illumination: 0 to 3.5 intensity (purely controlled by assetBrightness)
  // Decoupled from shadow darkness so shadows remain at desired darkness regardless of sun brightness
  const brightFactor = currentAssetBrightness / 100;
  sunLight.intensity = brightFactor * 3.5;

  // Shadow Darkness: 0% = faded/translucent shadow, 100% = deep pitch-black ink shadow
  // Decoupled from sun brightness & provides full dynamic range from faded to dark black
  const darknessFactor = Math.max(0, Math.min(100, currentShadowDarkness)) / 100;

  // 1. Three.js native directional shadow intensity: 0.04 (nearly invisible/faded) to 1.0 (full occlusion)
  sunLight.shadow.intensity = THREE.MathUtils.lerp(0.04, 1.0, darknessFactor);

  // 2. Ambient, fill, and HDR indirect lighting falloff
  // Using an exponential perceptual curve so shadows smoothly transition from soft daylight tint
  // all the way down to true 0.0 (absolute pure pitch black at 100%)
  const invDark = Math.pow(Math.max(0, 1.0 - darknessFactor), 2.4);

  ambientLight.intensity = invDark * 1.35;
  hemiLight.intensity = invDark * 1.45;
  fillLight.intensity = invDark * 0.85;
  scene.environmentIntensity = invDark * 0.85;

  // Sync Slider UI if elements exist
  const saSlider = document.getElementById('sun-angle-slider');
  const saVal = document.getElementById('sun-angle-val');
  const shSlider = document.getElementById('sun-height-slider');
  const shVal = document.getElementById('sun-height-val');
  const abSlider = document.getElementById('asset-brightness-slider');
  const abVal = document.getElementById('asset-brightness-val');
  const sdSlider = document.getElementById('shadow-darkness-slider');
  const sdVal = document.getElementById('shadow-darkness-val');

  if (saSlider && Number(saSlider.value) !== currentSunAngle) saSlider.value = currentSunAngle;
  if (saVal) saVal.textContent = `${currentSunAngle}°`;
  if (shSlider && Number(shSlider.value) !== currentSunHeight) shSlider.value = currentSunHeight;
  if (shVal) shVal.textContent = `${currentSunHeight}°`;
  if (abSlider && Number(abSlider.value) !== currentAssetBrightness) abSlider.value = currentAssetBrightness;
  if (abVal) abVal.textContent = `${currentAssetBrightness}%`;
  if (sdSlider && Number(sdSlider.value) !== currentShadowDarkness) sdSlider.value = currentShadowDarkness;
  if (sdVal) sdVal.textContent = `${currentShadowDarkness}%`;
}

function prepareMeshShadows(object3D) {
  if (!object3D) return;
  object3D.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

// Initial asset lighting setup
updateAssetLighting();

// 6. Multiple Grounds Setup
const textureLoader = new THREE.TextureLoader();

const groundConfigs = {
  grass: {
    texture: './textures/grass.jpg',
    repeat: [60, 60],
    color: 0x86efac,
    roughness: 0.85,
    metalness: 0.05,
  },
  moss: {
    texture: './textures/moss.jpg',
    repeat: [45, 45],
    color: 0x4ade80,
    roughness: 0.9,
    metalness: 0.05,
  },
  autumn: {
    texture: './textures/autumn.jpg',
    repeat: [40, 40],
    color: 0xfbbf24,
    roughness: 0.85,
    metalness: 0.05,
  },
  sand: {
    texture: './textures/sand.jpg',
    repeat: [50, 50],
    color: 0xfde047,
    roughness: 0.95,
    metalness: 0.0,
  },
  canyon: {
    texture: './textures/canyon.jpg',
    repeat: [40, 40],
    color: 0xfb923c,
    roughness: 0.92,
    metalness: 0.02,
  },
  snow: {
    texture: './textures/snow.jpg',
    repeat: [50, 50],
    color: 0xf8fafc,
    roughness: 0.65,
    metalness: 0.15,
  },
  water: {
    texture: './textures/water.jpg',
    repeat: [40, 40],
    color: 0x38bdf8,
    roughness: 0.08,
    metalness: 0.88,
  },
  stone: {
    texture: './textures/stone.jpg',
    repeat: [50, 50],
    color: 0xcfd8dc,
    roughness: 0.8,
    metalness: 0.1,
  },
  asphalt: {
    texture: './textures/asphalt.jpg',
    repeat: [70, 70],
    color: 0x64748b,
    roughness: 0.9,
    metalness: 0.1,
  },
  lava: {
    texture: './textures/lava.jpg',
    repeat: [40, 40],
    color: 0xffffff,
    roughness: 0.7,
    metalness: 0.25,
  },
  hexgrid: {
    texture: './textures/hexgrid.jpg',
    repeat: [50, 50],
    color: 0xffffff,
    roughness: 0.35,
    metalness: 0.65,
  },
  marble: {
    texture: './textures/marble.jpg',
    repeat: [35, 35],
    color: 0xffffff,
    roughness: 0.15,
    metalness: 0.45,
  },
};

// Pre-load all ground textures for instant zero-latency live switching
const loadedTextures = {};
Object.entries(groundConfigs).forEach(([key, cfg]) => {
  const tex = textureLoader.load(cfg.texture);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(cfg.repeat[0], cfg.repeat[1]);
  tex.colorSpace = THREE.SRGBColorSpace;
  loadedTextures[key] = tex;
});

const groundGeo = new THREE.PlaneGeometry(2500, 2500);
const groundMat = new THREE.MeshStandardMaterial({
  map: loadedTextures.grass,
  color: groundConfigs.grass.color,
  roughness: groundConfigs.grass.roughness,
  metalness: groundConfigs.grass.metalness,
});
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.05;
ground.receiveShadow = true;
scene.add(ground);

let currentGroundType = 'grass';

function switchGround(type) {
  currentGroundType = type;
  const cfg = groundConfigs[type];
  if (!cfg || !loadedTextures[type]) return;

  const tex = loadedTextures[type];
  tex.needsUpdate = true;

  groundMat.map = tex;
  groundMat.color.setHex(cfg.color);
  groundMat.roughness = cfg.roughness;
  groundMat.metalness = cfg.metalness;
  groundMat.needsUpdate = true;

  // Sync active UI state on ground boxes
  if (groundBoxes && groundBoxes.length) {
    groundBoxes.forEach((btn) => {
      if (btn.dataset.ground === type) btn.classList.add('active');
      else btn.classList.remove('active');
    });
  }
}

// Minimal Mini Square Ground Box Switcher Handlers
const groundBoxes = document.querySelectorAll('.ground-box');
groundBoxes.forEach((btn) => {
  btn.addEventListener('click', () => {
    if (typeof pushHistoryState === 'function') pushHistoryState();
    groundBoxes.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    switchGround(btn.dataset.ground);
  });
});

// Loading Progress Tracker
let skyLoaded = false;
let modelLoaded = false;

function checkLoadingDone() {
  if (skyLoaded && modelLoaded) {
    if (loaderProgress) loaderProgress.style.width = '100%';
    if (loaderStatus) loaderStatus.textContent = '3D Environment Ready!';
    if (loaderDetails) loaderDetails.textContent = 'Starting view...';
    setTimeout(() => {
      if (loaderOverlay) {
        loaderOverlay.classList.add('fade-out');
        setTimeout(() => loaderOverlay.remove(), 800);
      }
    }, 400);
  }
}

// 7. Load 4K HDR Sky (with 3D Sky Dome for full rotation, cloud movement & infinite depth)
if (loaderDetails) loaderDetails.textContent = 'Loading 4K Sky Environment...';

const skyGeo = new THREE.SphereGeometry(1800, 64, 32);
const skyMat = new THREE.MeshBasicMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  fog: false,
});
const skyDome = new THREE.Mesh(skyGeo, skyMat);
skyDome.renderOrder = -1000;
scene.add(skyDome);

const rgbeLoader = new RGBELoader();
rgbeLoader.load(
  './hdri/FluffballDay4k.hdr',
  (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    skyMat.map = texture;
    skyMat.needsUpdate = true;

    // Generate IBL environment for realistic reflections on buildings and ground
    const envMap = pmremGenerator.fromEquirectangular(texture).texture;
    scene.environment = envMap;
    pmremGenerator.dispose();

    skyLoaded = true;
    if (loaderProgress) loaderProgress.style.width = '35%';
    checkLoadingDone();
  },
  (xhr) => {
    if (xhr.lengthComputable) {
      const pct = Math.round((xhr.loaded / xhr.total) * 35);
      if (loaderProgress) loaderProgress.style.width = `${pct}%`;
    }
  },
  (err) => {
    console.warn('HDR sky fallback to atmospheric sky color:', err);
    skyMat.color.setHex(0x7dd3fc);
    skyLoaded = true;
    checkLoadingDone();
  }
);

// 8. Load 3D Castelia City Model & Separate Mountains from Buildings
if (loaderDetails) loaderDetails.textContent = 'Loading 3D Castelia Skyscraper City...';

const mountainGroup = new THREE.Group();
mountainGroup.name = 'MountainGroup';

const buildingsGroup = new THREE.Group();
buildingsGroup.name = 'BuildingsGroup';

const mMeshes = [];
const bMeshes = [];

const mountainMat = new THREE.MeshStandardMaterial({
  roughness: 0.85,
  metalness: 0.05,
});

let originalMountainMaterial = null;
const baseModelPos = new THREE.Vector3(0, 0, 0);

const gltfLoader = new GLTFLoader();
gltfLoader.load(
  './models/castelia/castelia_city.glb',
  (gltf) => {
    const city = gltf.scene;

    // Calculate bounding box and scale
    const box = new THREE.Box3().setFromObject(city);
    const center = box.getCenter(new THREE.Vector3());

    // Scale: original is ~273,000 units wide -> 0.0012 makes it ~327 meters wide
    const scale = 0.0012;
    baseModelPos.set(-center.x * scale, 0.0, -center.z * scale);

    // Traverse and separate terrain/mountains from buildings
    city.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;

        const matName = (child.material?.name || '').toLowerCase();
        const meshName = (child.name || '').toLowerCase();

        if (matName.includes('terrain') || meshName.includes('terrain') || matName === '_104') {
          if (!originalMountainMaterial && child.material) {
            originalMountainMaterial = child.material.clone();
          }
          child._originalMaterial = child.material;
          mMeshes.push(child);
        } else {
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((m) => {
                m.roughness = Math.min(m.roughness ?? 0.5, 0.6);
                m.metalness = m.metalness ?? 0.2;
                m.envMapIntensity = 1.0;
              });
            } else {
              child.material.roughness = Math.min(child.material.roughness ?? 0.5, 0.6);
              child.material.metalness = child.material.metalness ?? 0.2;
              child.material.envMapIntensity = 1.0;
            }
          }
          bMeshes.push(child);
        }
      }
    });

    // Reparent into distinct standalone groups
    mMeshes.forEach((m) => mountainGroup.add(m));
    bMeshes.forEach((m) => buildingsGroup.add(m));

    mountainGroup.scale.set(scale, scale, scale);
    mountainGroup.position.copy(baseModelPos);

    buildingsGroup.scale.set(scale, scale, scale);
    buildingsGroup.position.copy(baseModelPos);

    scene.add(mountainGroup);
    scene.add(buildingsGroup);

    initObjectsRegistry();

    modelLoaded = true;
    if (loaderProgress) loaderProgress.style.width = '100%';
    checkLoadingDone();
  },
  (xhr) => {
    if (xhr.lengthComputable) {
      const pct = 35 + Math.round((xhr.loaded / xhr.total) * 65);
      if (loaderProgress) loaderProgress.style.width = `${pct}%`;
      if (loaderDetails) {
        const mbLoaded = (xhr.loaded / (1024 * 1024)).toFixed(1);
        const mbTotal = (xhr.total / (1024 * 1024)).toFixed(1);
        loaderDetails.textContent = `Streaming 3D City: ${mbLoaded}MB / ${mbTotal}MB (${pct}%)`;
      }
    }
  },
  (err) => {
    console.error('Error loading GLB:', err);
    modelLoaded = true;
    checkLoadingDone();
  }
);

// 9. Responsive Window Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// 10. Day-to-Night Brightness Slider Controller (Top-Right)
const brightnessSlider = document.getElementById('brightness-slider');
const btnNight = document.getElementById('btn-night');
const btnDay = document.getElementById('btn-day');

function setBrightnessLevel(val) {
  const t = Math.max(0, Math.min(100, Number(val))) / 100;

  // Exposure: Smooth dynamic range from deep night (0.35) to brilliant day (1.3)
  renderer.toneMappingExposure = 0.35 + t * 0.95;

  // Sun color tint from night moonlight (cool blue) to warm sunlight
  sunLight.color.lerpColors(new THREE.Color(0x93c5fd), new THREE.Color(0xfffbeb), t);

  // Atmospheric Fog: Midnight navy to soft daylight blue
  if (scene.fog) {
    scene.fog.color.lerpColors(new THREE.Color(0x030712), new THREE.Color(0xcce7ff), t);
  }

  // HDR Sky background
  scene.backgroundIntensity = 0.08 + t * 0.92;

  // Sky Dome direct dynamic day-to-night lighting & tint
  if (skyDome && skyDome.material) {
    const skyB = 0.08 + t * 0.92;
    if (t < 0.25) {
      skyDome.material.color.setRGB(skyB * 0.75, skyB * 0.85, skyB * 1.05);
    } else if (t < 0.55) {
      skyDome.material.color.setRGB(skyB * 1.05, skyB * 0.95, skyB * 0.85);
    } else {
      skyDome.material.color.setRGB(skyB, skyB, skyB);
    }
  }

  if (scene.background && scene.background.isColor) {
    scene.background.lerpColors(new THREE.Color(0x030712), new THREE.Color(0x7dd3fc), t);
  }

  // Update universal asset direct illumination & shadow darkness
  updateAssetLighting();
}

if (brightnessSlider) {
  brightnessSlider.addEventListener('input', (e) => {
    setBrightnessLevel(e.target.value);
  });
}

if (btnNight) {
  btnNight.addEventListener('click', () => {
    if (typeof pushHistoryState === 'function') pushHistoryState();
    if (brightnessSlider) brightnessSlider.value = 0;
    setBrightnessLevel(0);
  });
}

if (btnDay) {
  btnDay.addEventListener('click', () => {
    if (typeof pushHistoryState === 'function') pushHistoryState();
    if (brightnessSlider) brightnessSlider.value = 100;
    setBrightnessLevel(100);
  });
}

// Initial brightness setup (57% daylight matching Default preset)
setBrightnessLevel(57);
if (brightnessSlider) brightnessSlider.value = 57;

// 11. Sky & Cloud Rotation Controller (Speed & 3D Direction)
let skyRotationSpeed = 0.0014; // Visible, smooth natural cloud drift
let currentSkyDirection = 'E_W';
const deltaQuat = new THREE.Quaternion();

// 3D Rotation Axes for natural compass trajectories:
// E_W: standard earth horizon rotation around Y
// W_E: reverse horizon rotation
// N_S & S_N: vertical meridian horizon drift
// NE_SW & NW_SE: diagonal sweeping cloud flows
const directionAxes = {
  E_W: new THREE.Vector3(0, 1, 0),
  W_E: new THREE.Vector3(0, -1, 0),
  N_S: new THREE.Vector3(1, 0, 0),
  S_N: new THREE.Vector3(-1, 0, 0),
  NE_SW: new THREE.Vector3(0.7071, 0.7071, 0).normalize(),
  NW_SE: new THREE.Vector3(-0.7071, 0.7071, 0).normalize(),
};

const skySpeedSlider = document.getElementById('sky-speed-slider');
const btnPauseSky = document.getElementById('btn-pause-sky');
const btnFastSky = document.getElementById('btn-fast-sky');

function updateSkySpeed(val) {
  // 0 -> paused, 35 -> 0.0014 (smooth visible drift), 100 -> 0.0045 (fast time-lapse)
  const v = Math.max(0, Math.min(100, Number(val)));
  skyRotationSpeed = (v / 100) * 0.0045;
}

if (skySpeedSlider) {
  skySpeedSlider.addEventListener('input', (e) => {
    updateSkySpeed(e.target.value);
  });
}

if (btnPauseSky) {
  btnPauseSky.addEventListener('click', () => {
    if (skySpeedSlider) skySpeedSlider.value = 0;
    updateSkySpeed(0);
  });
}

if (btnFastSky) {
  btnFastSky.addEventListener('click', () => {
    if (skySpeedSlider) skySpeedSlider.value = 100;
    updateSkySpeed(100);
  });
}

// Direction selector buttons
const dirButtons = document.querySelectorAll('.dir-btn');
dirButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    if (typeof pushHistoryState === 'function') pushHistoryState();
    dirButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentSkyDirection = btn.dataset.dir || 'E_W';
  });
});

// Mini Default Button: Resets sky to its original position with 0 speed
const btnResetSky = document.getElementById('btn-reset-sky');
if (btnResetSky) {
  btnResetSky.addEventListener('click', () => {
    if (typeof pushHistoryState === 'function') pushHistoryState();
    // 1. Reset speed to 0
    skyRotationSpeed = 0;
    if (skySpeedSlider) skySpeedSlider.value = 0;

    // 2. Reset direction to default 'E_W'
    currentSkyDirection = 'E_W';
    dirButtons.forEach((b) => {
      if (b.dataset.dir === 'E_W') b.classList.add('active');
      else b.classList.remove('active');
    });

    // 3. Reset Sky Dome orientation to original place
    if (skyDome) {
      skyDome.quaternion.set(0, 0, 0, 1);
      skyDome.rotation.set(0, 0, 0);
    }

    // 4. Reset environment reflection rotation
    scene.environmentRotation.set(0, 0, 0);
  });
}

// 12. Animation Loop with Dynamic Sky, Reflection Movement & Infinite Camera Flight
let frameCount = 0;
let isFlyingCamera = false;
let activePosCurve = null;
let activeTargetCurve = null;
let flightProgress = 0;
const tempFlightPos = new THREE.Vector3();
const tempFlightTarget = new THREE.Vector3();
let cameraSpeedPercent = 35;
const flightClock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = flightClock.getDelta();

  // Infinite Camera Flight Path loop
  if (isFlyingCamera && activePosCurve && activeTargetCurve) {
    controls.enabled = false;
    const rate = Math.max(0.005, (cameraSpeedPercent / 100) * 0.12);
    flightProgress = (flightProgress + delta * rate) % 1.0;

    activePosCurve.getPointAt(flightProgress, tempFlightPos);
    activeTargetCurve.getPointAt(flightProgress, tempFlightTarget);

    camera.position.copy(tempFlightPos);
    controls.target.copy(tempFlightTarget);
  } else {
    controls.enabled = true;
    controls.update();
  }

  // Position SkyDome centered on camera (infinite distance effect) & rotate
  if (skyDome) {
    skyDome.position.copy(camera.position);

    if (skyRotationSpeed > 0) {
      const axis = directionAxes[currentSkyDirection] || directionAxes.E_W;
      deltaQuat.setFromAxisAngle(axis, skyRotationSpeed);
      skyDome.quaternion.multiply(deltaQuat);

      frameCount++;
      if (frameCount % 600 === 0) {
        skyDome.quaternion.normalize();
      }

      scene.environmentRotation.setFromQuaternion(skyDome.quaternion);
    }
  }

  renderer.render(scene, camera);
}

animate();

// 13. Top Left Studio Controls: Multi-Object Transform, Duplicate, Presets & Mountain Styles
let objectsRegistry = [];
let selectedObjectId = 'buildings_0';

const activeObjectSelect = document.getElementById('active-object-select');
const posXSlider = document.getElementById('pos-x-slider');
const posYSlider = document.getElementById('pos-y-slider');
const posZSlider = document.getElementById('pos-z-slider');
const rotYSlider = document.getElementById('rot-y-slider');
const posXVal = document.getElementById('pos-x-val');
const posYVal = document.getElementById('pos-y-val');
const posZVal = document.getElementById('pos-z-val');
const rotYVal = document.getElementById('rot-y-val');
const duplicateBtn = document.getElementById('btn-duplicate-target');
const resetBtn = document.getElementById('btn-reset-target');
const deleteTargetBtn = document.getElementById('btn-delete-target');
const btnUndo = document.getElementById('btn-undo');
const btnRedo = document.getElementById('btn-redo');
const btnAddBuilding = document.getElementById('btn-add-building');
const btnAddMountain = document.getElementById('btn-add-mountain');
const duplicateStatus = document.getElementById('duplicate-status');
const mountainStyleSelect = document.getElementById('mountain-style-select');
const studioPanel = document.getElementById('studio-panel');
const studioToggleBtn = document.getElementById('studio-toggle-btn');
const studioHeader = document.getElementById('studio-header');

// Asset Lighting & Shadows DOM Elements (Universal for all current & future assets)
const sunAngleSlider = document.getElementById('sun-angle-slider');
const sunAngleVal = document.getElementById('sun-angle-val');
const sunHeightSlider = document.getElementById('sun-height-slider');
const sunHeightVal = document.getElementById('sun-height-val');
const assetBrightnessSlider = document.getElementById('asset-brightness-slider');
const assetBrightnessVal = document.getElementById('asset-brightness-val');
const shadowDarknessSlider = document.getElementById('shadow-darkness-slider');
const shadowDarknessVal = document.getElementById('shadow-darkness-val');

// Presets DOM Elements
const presetSelect = document.getElementById('preset-select');
const btnCopyPreset = document.getElementById('btn-copy-preset');
const btnExportPreset = document.getElementById('btn-export-preset');
const presetStatus = document.getElementById('preset-status');

// Built-in Default Presets
const defaultPresets = {
  default: {
    name: 'Default Daytime',
    builtIn: true,
    brightness: 57,
    skySpeed: 35,
    skyDirection: 'E_W',
    groundType: 'grass',
    mountainStyle: 'natural',
    camera: {
      position: { x: 3.5, y: 1.2, z: 147.5 },
      target: { x: 19.1, y: -1.6, z: 5 },
    },
    lighting: {
      sunAngle: 45,
      sunHeight: 50,
      assetBrightness: 70,
      shadowDarkness: 65,
    },
    objects: [
      { id: 'buildings_0', type: 'buildings', isClone: false, offset: { x: 0, y: 0, z: 0, rotY: 0 } },
      { id: 'mountains_0', type: 'mountains', isClone: false, offset: { x: 0, y: 0, z: 0, rotY: 0 } },
    ],
  },
  sunset: {
    name: 'Sunset Autumn Vista',
    builtIn: true,
    brightness: 45,
    skySpeed: 25,
    skyDirection: 'NW_SE',
    groundType: 'autumn',
    mountainStyle: 'canyon',
    camera: {
      position: { x: -160, y: 95, z: 140 },
      target: { x: 0, y: 15, z: 0 },
    },
    lighting: {
      sunAngle: 240,
      sunHeight: 25,
      assetBrightness: 85,
      shadowDarkness: 75,
    },
    objects: [
      { id: 'buildings_0', type: 'buildings', isClone: false, offset: { x: 0, y: 0, z: 0, rotY: 0 } },
      { id: 'mountains_0', type: 'mountains', isClone: false, offset: { x: 0, y: 0, z: 0, rotY: 0 } },
    ],
  },
  cyberpunk: {
    name: 'Cyberpunk Night',
    builtIn: true,
    brightness: 12,
    skySpeed: 60,
    skyDirection: 'NE_SW',
    groundType: 'hexgrid',
    mountainStyle: 'lava',
    camera: {
      position: { x: 90, y: 40, z: 110 },
      target: { x: 0, y: 20, z: 0 },
    },
    lighting: {
      sunAngle: 110,
      sunHeight: 18,
      assetBrightness: 40,
      shadowDarkness: 90,
    },
    objects: [
      { id: 'buildings_0', type: 'buildings', isClone: false, offset: { x: 0, y: 0, z: 0, rotY: 25 } },
      { id: 'mountains_0', type: 'mountains', isClone: false, offset: { x: 0, y: 0, z: 0, rotY: 0 } },
    ],
  },
};

let presetsData = { ...defaultPresets };
let activePresetKey = 'default';

function initObjectsRegistry() {
  objectsRegistry = [
    {
      id: 'buildings_0',
      type: 'buildings',
      name: '🏙️ Buildings (Main)',
      isClone: false,
      group: buildingsGroup,
      basePos: baseModelPos.clone(),
      offset: { x: 0, y: 0, z: 0, rotY: 0 },
    },
    {
      id: 'mountains_0',
      type: 'mountains',
      name: '⛰️ Mountains (Main)',
      isClone: false,
      group: mountainGroup,
      basePos: baseModelPos.clone(),
      offset: { x: 0, y: 0, z: 0, rotY: 0 },
    },
  ];
  selectedObjectId = 'buildings_0';
  updateObjectSelectOptions();
  updateSliderUI();

  // Load and apply saved presets
  loadStoredPresets();
}

function getSelectedObject() {
  return objectsRegistry.find((o) => o.id === selectedObjectId) || (objectsRegistry.length > 0 ? objectsRegistry[0] : null);
}

function updateObjectSelectOptions() {
  if (!activeObjectSelect) return;
  activeObjectSelect.innerHTML = '';

  if (objectsRegistry.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '(No Objects in Scene)';
    activeObjectSelect.appendChild(opt);
    if (deleteTargetBtn) deleteTargetBtn.disabled = true;
    if (duplicateBtn) duplicateBtn.disabled = true;
    if (resetBtn) resetBtn.disabled = true;
    return;
  }

  if (deleteTargetBtn) deleteTargetBtn.disabled = false;
  if (duplicateBtn) duplicateBtn.disabled = false;
  if (resetBtn) resetBtn.disabled = false;

  objectsRegistry.forEach((obj) => {
    const opt = document.createElement('option');
    opt.value = obj.id;
    opt.textContent = obj.name;
    if (obj.id === selectedObjectId) opt.selected = true;
    activeObjectSelect.appendChild(opt);
  });
}

function updateSliderUI() {
  const obj = getSelectedObject();
  if (!obj) {
    if (posXVal) posXVal.textContent = '0m';
    if (posYVal) posYVal.textContent = '0m';
    if (posZVal) posZVal.textContent = '0m';
    if (rotYVal) rotYVal.textContent = '0°';
    return;
  }

  const off = obj.offset;
  if (posXSlider) posXSlider.value = off.x;
  if (posYSlider) posYSlider.value = off.y;
  if (posZSlider) posZSlider.value = off.z;
  if (rotYSlider) rotYSlider.value = off.rotY;

  if (posXVal) posXVal.textContent = `${off.x}m`;
  if (posYVal) posYVal.textContent = `${off.y}m`;
  if (posZVal) posZVal.textContent = `${off.z}m`;
  if (rotYVal) rotYVal.textContent = `${off.rotY}°`;
}

function applyTransform() {
  const obj = getSelectedObject();
  if (!obj || !obj.group) return;

  obj.group.position.set(
    obj.basePos.x + obj.offset.x,
    obj.basePos.y + obj.offset.y,
    obj.basePos.z + obj.offset.z
  );
  obj.group.rotation.y = (obj.offset.rotY * Math.PI) / 180;
}

if (activeObjectSelect) {
  activeObjectSelect.addEventListener('change', (e) => {
    selectedObjectId = e.target.value;
    const cur = getSelectedObject();
    if (deleteCloneBtn) {
      deleteCloneBtn.style.display = cur && cur.isClone ? 'block' : 'none';
    }
    updateSliderUI();
  });
}

if (posXSlider) {
  posXSlider.addEventListener('input', (e) => {
    const obj = getSelectedObject();
    if (obj) {
      obj.offset.x = Number(e.target.value);
      if (posXVal) posXVal.textContent = `${e.target.value}m`;
      applyTransform();
    }
  });
}

if (posYSlider) {
  posYSlider.addEventListener('input', (e) => {
    const obj = getSelectedObject();
    if (obj) {
      obj.offset.y = Number(e.target.value);
      if (posYVal) posYVal.textContent = `${e.target.value}m`;
      applyTransform();
    }
  });
}

if (posZSlider) {
  posZSlider.addEventListener('input', (e) => {
    const obj = getSelectedObject();
    if (obj) {
      obj.offset.z = Number(e.target.value);
      if (posZVal) posZVal.textContent = `${e.target.value}m`;
      applyTransform();
    }
  });
}

if (rotYSlider) {
  rotYSlider.addEventListener('input', (e) => {
    const obj = getSelectedObject();
    if (obj) {
      obj.offset.rotY = Number(e.target.value);
      if (rotYVal) rotYVal.textContent = `${e.target.value}°`;
      applyTransform();
    }
  });
}

// Universal Asset Lighting & Shadows Slider Listeners
if (sunAngleSlider) {
  sunAngleSlider.addEventListener('input', (e) => {
    currentSunAngle = Number(e.target.value);
    if (sunAngleVal) sunAngleVal.textContent = `${currentSunAngle}°`;
    updateAssetLighting();
  });
}

if (sunHeightSlider) {
  sunHeightSlider.addEventListener('input', (e) => {
    currentSunHeight = Number(e.target.value);
    if (sunHeightVal) sunHeightVal.textContent = `${currentSunHeight}°`;
    updateAssetLighting();
  });
}

if (assetBrightnessSlider) {
  assetBrightnessSlider.addEventListener('input', (e) => {
    currentAssetBrightness = Number(e.target.value);
    if (assetBrightnessVal) assetBrightnessVal.textContent = `${currentAssetBrightness}%`;
    updateAssetLighting();
  });
}

if (shadowDarknessSlider) {
  shadowDarknessSlider.addEventListener('input', (e) => {
    currentShadowDarkness = Number(e.target.value);
    if (shadowDarknessVal) shadowDarknessVal.textContent = `${currentShadowDarkness}%`;
    updateAssetLighting();
  });
}

// =====================================================================
// --- Universal Undo / Redo History Stack ---
// =====================================================================
const undoStack = [];
const redoStack = [];
const MAX_UNDO = 50;

function updateHistoryButtons() {
  if (btnUndo) {
    btnUndo.disabled = undoStack.length === 0;
  }
  if (btnRedo) {
    btnRedo.disabled = redoStack.length === 0;
  }
}

function captureSnapshot() {
  return {
    objects: objectsRegistry.map((o) => ({
      id: o.id,
      type: o.type,
      name: o.name,
      isClone: o.isClone,
      basePos: { x: o.basePos.x, y: o.basePos.y, z: o.basePos.z },
      offset: { x: o.offset.x, y: o.offset.y, z: o.offset.z, rotY: o.offset.rotY },
    })),
    selectedObjectId: selectedObjectId,
    groundType: currentGroundType,
    mountainStyle: mountainStyleSelect ? mountainStyleSelect.value : 'natural',
    brightness: brightnessSlider ? Number(brightnessSlider.value) : 57,
    skySpeed: skySpeedSlider ? Number(skySpeedSlider.value) : 35,
    skyDirection: currentSkyDirection,
    sunAngle: currentSunAngle,
    sunHeight: currentSunHeight,
    assetBrightness: currentAssetBrightness,
    shadowDarkness: currentShadowDarkness,
  };
}

function pushHistoryState(explicitSnapshot = null) {
  const snap = explicitSnapshot || captureSnapshot();
  undoStack.push(snap);
  if (undoStack.length > MAX_UNDO) {
    undoStack.shift();
  }
  redoStack.length = 0;
  updateHistoryButtons();
}

function restoreSnapshot(snap) {
  if (!snap) return;

  // 1. Remove all current clones from scene
  objectsRegistry.forEach((o) => {
    if (o.isClone) {
      scene.remove(o.group);
    }
  });

  // Ensure base groups are present or removed according to snapshot
  const hasBaseBuildings = snap.objects.some((o) => !o.isClone && o.type === 'buildings');
  if (hasBaseBuildings) {
    if (!scene.children.includes(buildingsGroup)) scene.add(buildingsGroup);
  } else {
    scene.remove(buildingsGroup);
  }

  const hasBaseMountains = snap.objects.some((o) => !o.isClone && o.type === 'mountains');
  if (hasBaseMountains) {
    if (!scene.children.includes(mountainGroup)) scene.add(mountainGroup);
  } else {
    scene.remove(mountainGroup);
  }

  // 2. Reconstruct objectsRegistry
  const newRegistry = [];

  snap.objects.forEach((objData) => {
    let grp;
    const basePos = new THREE.Vector3(objData.basePos.x, objData.basePos.y, objData.basePos.z);

    if (!objData.isClone) {
      grp = objData.type === 'buildings' ? buildingsGroup : mountainGroup;
    } else {
      const srcGroup = objData.type === 'buildings' ? buildingsGroup : mountainGroup;
      grp = srcGroup.clone(true);
      scene.add(grp);
    }

    grp.position.set(
      basePos.x + objData.offset.x,
      basePos.y + objData.offset.y,
      basePos.z + objData.offset.z
    );
    grp.rotation.y = (objData.offset.rotY * Math.PI) / 180;
    prepareMeshShadows(grp);

    newRegistry.push({
      id: objData.id,
      type: objData.type,
      name: objData.name,
      isClone: objData.isClone,
      group: grp,
      basePos: basePos,
      offset: { ...objData.offset },
    });
  });

  objectsRegistry = newRegistry;
  selectedObjectId = snap.selectedObjectId;
  if (!objectsRegistry.some((o) => o.id === selectedObjectId)) {
    selectedObjectId = objectsRegistry.length > 0 ? objectsRegistry[0].id : null;
  }

  updateObjectSelectOptions();
  updateSliderUI();

  // 3. Ground Texture
  if (snap.groundType && snap.groundType !== currentGroundType) {
    switchGround(snap.groundType);
  }

  // 4. Mountain Style
  if (snap.mountainStyle && mountainStyleSelect) {
    mountainStyleSelect.value = snap.mountainStyle;
    switchMountainStyle(snap.mountainStyle);
  }

  // 5. Brightness
  if (snap.brightness !== undefined) {
    if (brightnessSlider) brightnessSlider.value = snap.brightness;
    setBrightnessLevel(snap.brightness);
  }

  // 6. Sky Speed & Direction
  if (snap.skySpeed !== undefined) {
    if (skySpeedSlider) skySpeedSlider.value = snap.skySpeed;
    updateSkySpeed(snap.skySpeed);
  }
  if (snap.skyDirection) {
    currentSkyDirection = snap.skyDirection;
    dirButtons.forEach((b) => {
      if (b.dataset.dir === snap.skyDirection) b.classList.add('active');
      else b.classList.remove('active');
    });
  }

  // 7. Universal Asset Lighting & Shadows
  if (snap.sunAngle !== undefined) currentSunAngle = snap.sunAngle;
  if (snap.sunHeight !== undefined) currentSunHeight = snap.sunHeight;
  if (snap.assetBrightness !== undefined) currentAssetBrightness = snap.assetBrightness;
  if (snap.shadowDarkness !== undefined) currentShadowDarkness = snap.shadowDarkness;
  updateAssetLighting();
}

function undo() {
  if (undoStack.length === 0) return;
  const currentSnap = captureSnapshot();
  redoStack.push(currentSnap);
  const prevSnap = undoStack.pop();
  restoreSnapshot(prevSnap);
  updateHistoryButtons();

  if (duplicateStatus) {
    duplicateStatus.textContent = '↩️ Undo performed';
    setTimeout(() => { if (duplicateStatus) duplicateStatus.textContent = ''; }, 2000);
  }
}

function redo() {
  if (redoStack.length === 0) return;
  const currentSnap = captureSnapshot();
  undoStack.push(currentSnap);
  const nextSnap = redoStack.pop();
  restoreSnapshot(nextSnap);
  updateHistoryButtons();

  if (duplicateStatus) {
    duplicateStatus.textContent = '↪️ Redo performed';
    setTimeout(() => { if (duplicateStatus) duplicateStatus.textContent = ''; }, 2000);
  }
}

if (btnUndo) {
  btnUndo.addEventListener('click', undo);
}

if (btnRedo) {
  btnRedo.addEventListener('click', redo);
}

// Global Keyboard Shortcut Listener for Undo / Redo
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' && e.target.type === 'text') return;

  if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
    if (e.shiftKey) {
      e.preventDefault();
      redo();
    } else {
      e.preventDefault();
      undo();
    }
  } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
    e.preventDefault();
    redo();
  }
});

// Helper for slider drag history (records 1 clean history step per drag)
function attachSliderHistory(sliderEl) {
  if (!sliderEl) return;
  let beforeDragSnap = null;
  sliderEl.addEventListener('pointerdown', () => {
    beforeDragSnap = captureSnapshot();
  });
  sliderEl.addEventListener('change', () => {
    if (beforeDragSnap) {
      pushHistoryState(beforeDragSnap);
      beforeDragSnap = null;
    }
  });
}

attachSliderHistory(posXSlider);
attachSliderHistory(posYSlider);
attachSliderHistory(posZSlider);
attachSliderHistory(rotYSlider);
attachSliderHistory(brightnessSlider);
attachSliderHistory(skySpeedSlider);
attachSliderHistory(sunAngleSlider);
attachSliderHistory(sunHeightSlider);
attachSliderHistory(assetBrightnessSlider);
attachSliderHistory(shadowDarknessSlider);

// Add Building / Mountain logic (Supports adding even if main was deleted)
let buildingAddCount = 0;
let mountainAddCount = 0;

function addNewObject(type) {
  if (!buildingsGroup || !mountainGroup) return;

  pushHistoryState();

  const isBuilding = type === 'buildings';
  const srcProto = isBuilding ? buildingsGroup : mountainGroup;
  const count = isBuilding ? ++buildingAddCount : ++mountainAddCount;
  const typeLabel = isBuilding ? '🏙️ Buildings' : '⛰️ Mountains';

  // Check if base main group of this type is currently absent from scene
  const basePresent = objectsRegistry.some((o) => !o.isClone && o.type === type);

  let newGroup;
  let isClone;
  let newId;
  let newBasePos;

  if (!basePresent) {
    newGroup = srcProto;
    if (!scene.children.includes(newGroup)) scene.add(newGroup);
    isClone = false;
    newId = isBuilding ? 'buildings_0' : 'mountains_0';
    newBasePos = baseModelPos.clone();
  } else {
    newGroup = srcProto.clone(true);
    newBasePos = baseModelPos.clone();
    newBasePos.x += (count % 3 === 0 ? 80 : count % 3 === 1 ? -80 : 0);
    newBasePos.z += (count % 2 === 0 ? 40 : -40);
    newGroup.position.copy(newBasePos);
    newGroup.rotation.copy(srcProto.rotation);
    scene.add(newGroup);
    isClone = true;
    newId = `${type}_added_${Date.now()}_${Math.random()}`;
  }

  prepareMeshShadows(newGroup);

  const objName = isClone ? `${typeLabel} (Clone #${count})` : `${typeLabel} (Main)`;

  const entry = {
    id: newId,
    type: type,
    name: objName,
    isClone: isClone,
    group: newGroup,
    basePos: newBasePos.clone(),
    offset: { x: 0, y: 0, z: 0, rotY: 0 },
  };

  objectsRegistry.push(entry);
  selectedObjectId = newId;

  updateObjectSelectOptions();
  updateSliderUI();

  if (duplicateStatus) {
    duplicateStatus.textContent = `✓ ${objName} added! Use sliders to move.`;
    setTimeout(() => {
      if (duplicateStatus) duplicateStatus.textContent = '';
    }, 4500);
  }
}

if (btnAddBuilding) {
  btnAddBuilding.addEventListener('click', () => {
    addNewObject('buildings');
  });
}

if (btnAddMountain) {
  btnAddMountain.addEventListener('click', () => {
    addNewObject('mountains');
  });
}

// Duplicate Object logic (Instantly selectable and movable)
const cloneCounters = { buildings: 0, mountains: 0 };
if (duplicateBtn) {
  duplicateBtn.addEventListener('click', () => {
    const srcObj = getSelectedObject();
    if (!srcObj || !srcObj.group) return;

    pushHistoryState();

    cloneCounters[srcObj.type]++;
    const count = cloneCounters[srcObj.type];

    const cloneGroup = srcObj.group.clone(true);
    // Offset clone in world space so it sits visibly distinct
    const newBasePos = srcObj.group.position.clone();
    newBasePos.x += 80;
    newBasePos.z += (count % 2 === 0 ? 30 : -30);
    cloneGroup.position.copy(newBasePos);
    cloneGroup.rotation.copy(srcObj.group.rotation);

    scene.add(cloneGroup);
    prepareMeshShadows(cloneGroup);

    const newId = `${srcObj.type}_clone_${Date.now()}`;
    const typeLabel = srcObj.type === 'buildings' ? '🏙️ Buildings' : '⛰️ Mountains';
    const cloneName = `${typeLabel} (Clone #${count})`;

    const newEntry = {
      id: newId,
      type: srcObj.type,
      name: cloneName,
      isClone: true,
      group: cloneGroup,
      basePos: newBasePos.clone(),
      offset: { x: 0, y: 0, z: 0, rotY: 0 },
    };

    objectsRegistry.push(newEntry);
    selectedObjectId = newId;

    updateObjectSelectOptions();
    updateSliderUI();

    if (duplicateStatus) {
      duplicateStatus.textContent = `✓ ${cloneName} created! Use sliders to move.`;
      setTimeout(() => {
        if (duplicateStatus) duplicateStatus.textContent = '';
      }, 4500);
    }
  });
}

// Delete Target Object logic (Supports main buildings, main mountains, and all clones)
if (deleteTargetBtn) {
  deleteTargetBtn.addEventListener('click', () => {
    if (!selectedObjectId || objectsRegistry.length === 0) return;

    const idx = objectsRegistry.findIndex((o) => o.id === selectedObjectId);
    if (idx === -1) return;

    pushHistoryState();

    const obj = objectsRegistry[idx];
    scene.remove(obj.group);
    objectsRegistry.splice(idx, 1);

    const deletedName = obj.name;
    selectedObjectId = objectsRegistry.length > 0 ? objectsRegistry[0].id : null;

    updateObjectSelectOptions();
    updateSliderUI();

    if (duplicateStatus) {
      duplicateStatus.textContent = `🗑️ "${deletedName}" deleted (Undo to restore)`;
      setTimeout(() => {
        if (duplicateStatus) duplicateStatus.textContent = '';
      }, 4000);
    }
  });
}

// Reset Object Transform logic
if (resetBtn) {
  resetBtn.addEventListener('click', () => {
    const obj = getSelectedObject();
    if (obj) {
      pushHistoryState();
      obj.offset = { x: 0, y: 0, z: 0, rotY: 0 };
      applyTransform();
      updateSliderUI();
    }
  });
}

// Independent Mountain Style Switcher
function switchMountainStyle(styleKey) {
  if (styleKey === 'natural') {
    mMeshes.forEach((mesh) => {
      if (mesh._originalMaterial) {
        mesh.material = mesh._originalMaterial;
      }
    });
    return;
  }

  const tex = loadedTextures[styleKey];
  if (!tex) return;

  const cfg = groundConfigs[styleKey];
  mountainMat.map = tex;
  mountainMat.roughness = cfg?.roughness ?? 0.85;
  mountainMat.metalness = cfg?.metalness ?? 0.05;
  mountainMat.color.setHex(0xffffff);
  mountainMat.needsUpdate = true;

  mMeshes.forEach((mesh) => {
    mesh.material = mountainMat;
  });
}

if (mountainStyleSelect) {
  mountainStyleSelect.addEventListener('change', (e) => {
    pushHistoryState();
    switchMountainStyle(e.target.value);
  });
}

// --- Preset Management System (Direct GitHub Sync) ---
async function loadStoredPresets() {
  try {
    const res = await fetch('./presets.json');
    if (res.ok) {
      const data = await res.json();
      presetsData = { ...defaultPresets, ...data };
    }
  } catch (err) {
    console.warn('Could not fetch presets.json, using built-ins:', err);
  }

  const savedActive = localStorage.getItem('3d_env_active_preset');
  if (savedActive && presetsData[savedActive]) {
    activePresetKey = savedActive;
  }
  updatePresetDropdown();
  if (presetsData[activePresetKey]) {
    applyPreset(activePresetKey);
  }
}

function updatePresetDropdown() {
  if (!presetSelect) return;
  presetSelect.innerHTML = '';
  Object.entries(presetsData).forEach(([key, preset]) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = preset.name;
    if (key === activePresetKey) opt.selected = true;
    presetSelect.appendChild(opt);
  });
}

function applyPreset(key) {
  const p = presetsData[key];
  if (!p) return;
  activePresetKey = key;
  localStorage.setItem('3d_env_active_preset', key);

  // 1. Brightness
  if (p.brightness !== undefined) {
    if (brightnessSlider) brightnessSlider.value = p.brightness;
    setBrightnessLevel(p.brightness);
  }

  // 2. Sky Speed
  if (p.skySpeed !== undefined) {
    if (skySpeedSlider) skySpeedSlider.value = p.skySpeed;
    updateSkySpeed(p.skySpeed);
  }

  // 3. Sky Direction
  if (p.skyDirection) {
    currentSkyDirection = p.skyDirection;
    dirButtons.forEach((b) => {
      if (b.dataset.dir === p.skyDirection) b.classList.add('active');
      else b.classList.remove('active');
    });
  }

  // 4. Ground Texture
  if (p.groundType) {
    switchGround(p.groundType);
  }

  // 5. Mountain Style
  if (p.mountainStyle) {
    if (mountainStyleSelect) mountainStyleSelect.value = p.mountainStyle;
    switchMountainStyle(p.mountainStyle);
  }

  // 6. Objects & Duplicates
  // Remove existing clones from scene
  const clonesToRemove = objectsRegistry.filter((o) => o.isClone);
  clonesToRemove.forEach((c) => scene.remove(c.group));

  // Keep original 2 base objects
  objectsRegistry = objectsRegistry.filter((o) => !o.isClone);

  if (Array.isArray(p.objects)) {
    p.objects.forEach((objData) => {
      if (!objData.isClone) {
        const existing = objectsRegistry.find((o) => o.id === objData.id || o.type === objData.type);
        if (existing) {
          existing.offset = { ...objData.offset };
          existing.group.position.set(
            existing.basePos.x + existing.offset.x,
            existing.basePos.y + existing.offset.y,
            existing.basePos.z + existing.offset.z
          );
          existing.group.rotation.y = (existing.offset.rotY * Math.PI) / 180;
        }
      } else {
        const srcGroup = objData.type === 'buildings' ? buildingsGroup : mountainGroup;
        const cloneGroup = srcGroup.clone(true);
        const basePos = new THREE.Vector3(
          objData.basePos?.x ?? baseModelPos.x,
          objData.basePos?.y ?? baseModelPos.y,
          objData.basePos?.z ?? baseModelPos.z
        );
        cloneGroup.position.set(
          basePos.x + (objData.offset?.x ?? 0),
          basePos.y + (objData.offset?.y ?? 0),
          basePos.z + (objData.offset?.z ?? 0)
        );
        cloneGroup.rotation.y = ((objData.offset?.rotY ?? 0) * Math.PI) / 180;
        scene.add(cloneGroup);
        prepareMeshShadows(cloneGroup);

        objectsRegistry.push({
          id: objData.id || `${objData.type}_clone_${Date.now()}_${Math.random()}`,
          type: objData.type,
          name: objData.name || `${objData.type === 'buildings' ? '🏙️ Buildings' : '⛰️ Mountains'} (Clone)`,
          isClone: true,
          group: cloneGroup,
          basePos: basePos,
          offset: { ...(objData.offset || { x: 0, y: 0, z: 0, rotY: 0 }) },
        });
      }
    });
  }

  selectedObjectId = objectsRegistry[0].id;
  updateObjectSelectOptions();
  updateSliderUI();

  // 7. Camera Viewpoint & Angle
  if (p.camera && p.camera.position) {
    camera.position.set(p.camera.position.x, p.camera.position.y, p.camera.position.z);
    if (p.camera.target && controls) {
      controls.target.set(p.camera.target.x, p.camera.target.y, p.camera.target.z);
    }
    controls.update();
  }

  // 8. Universal Asset Lighting & Shadows
  if (p.lighting) {
    if (p.lighting.sunAngle !== undefined) currentSunAngle = p.lighting.sunAngle;
    if (p.lighting.sunHeight !== undefined) currentSunHeight = p.lighting.sunHeight;
    if (p.lighting.assetBrightness !== undefined) currentAssetBrightness = p.lighting.assetBrightness;
    if (p.lighting.shadowDarkness !== undefined) currentShadowDarkness = p.lighting.shadowDarkness;
    updateAssetLighting();
  }

  if (presetStatus) {
    presetStatus.textContent = `Loaded preset: "${p.name}"`;
    setTimeout(() => {
      if (presetStatus) presetStatus.textContent = '';
    }, 3500);
  }
}

function getCurrentSceneConfig() {
  const currentObjState = objectsRegistry.map((o) => ({
    id: o.id,
    type: o.type,
    name: o.name,
    isClone: o.isClone,
    basePos: { x: Math.round(o.basePos.x), y: Math.round(o.basePos.y), z: Math.round(o.basePos.z) },
    offset: {
      x: Math.round(o.offset.x),
      y: Math.round(o.offset.y),
      z: Math.round(o.offset.z),
      rotY: Math.round(o.offset.rotY),
    },
  }));

  const activeName = presetsData[activePresetKey]?.name || 'Custom Scene';

  return {
    name: activeName,
    brightness: Number(brightnessSlider?.value ?? 85),
    skySpeed: Number(skySpeedSlider?.value ?? 35),
    skyDirection: currentSkyDirection,
    groundType: currentGroundType,
    mountainStyle: mountainStyleSelect?.value ?? 'natural',
    lighting: {
      sunAngle: currentSunAngle,
      sunHeight: currentSunHeight,
      assetBrightness: currentAssetBrightness,
      shadowDarkness: currentShadowDarkness,
    },
    camera: {
      position: {
        x: Number(camera.position.x.toFixed(1)),
        y: Number(camera.position.y.toFixed(1)),
        z: Number(camera.position.z.toFixed(1)),
      },
      target: {
        x: Number(controls.target.x.toFixed(1)),
        y: Number(controls.target.y.toFixed(1)),
        z: Number(controls.target.z.toFixed(1)),
      },
    },
    objects: currentObjState,
  };
}

if (presetSelect) {
  presetSelect.addEventListener('change', (e) => {
    applyPreset(e.target.value);
  });
}

if (btnCopyPreset) {
  btnCopyPreset.addEventListener('click', async () => {
    const config = getCurrentSceneConfig();
    const jsonStr = JSON.stringify(config, null, 2);

    let copied = false;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(jsonStr);
        copied = true;
      } catch (err) {
        console.warn('Clipboard writeText failed:', err);
      }
    }

    if (!copied) {
      const ta = document.createElement('textarea');
      ta.value = jsonStr;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        copied = true;
      } catch (e) {
        console.error('Fallback copy failed', e);
      }
      document.body.removeChild(ta);
    }

    if (presetStatus) {
      presetStatus.textContent = copied
        ? '✓ Config copied! Paste in chat to save in GitHub.'
        : '⚠️ Copy failed. Click Download instead!';
      setTimeout(() => {
        if (presetStatus) presetStatus.textContent = '';
      }, 5000);
    }
  });
}

if (btnExportPreset) {
  btnExportPreset.addEventListener('click', () => {
    const config = getCurrentSceneConfig();
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `preset-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    if (presetStatus) {
      presetStatus.textContent = '✓ Config downloaded! Send it in chat to bake into GitHub.';
      setTimeout(() => {
        if (presetStatus) presetStatus.textContent = '';
      }, 5000);
    }
  });
}

// Top Left Studio Panel Collapse Toggle
if (studioToggleBtn && studioPanel) {
  const togglePanel = () => {
    studioPanel.classList.toggle('collapsed');
    studioToggleBtn.textContent = studioPanel.classList.contains('collapsed') ? '⚙️' : '−';
  };

  studioToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePanel();
  });

  if (studioHeader) {
    studioHeader.addEventListener('click', () => {
      if (studioPanel.classList.contains('collapsed')) {
        togglePanel();
      }
    });
  }
}

// Top Right Atmosphere & Sky Controls Card Collapse Toggle
const topControlsCard = document.getElementById('top-controls-card');
const topControlsToggleBtn = document.getElementById('top-controls-toggle-btn');
const topControlsHeader = document.getElementById('top-controls-header');

if (topControlsToggleBtn && topControlsCard) {
  const toggleTopCard = () => {
    topControlsCard.classList.toggle('collapsed');
    topControlsToggleBtn.textContent = topControlsCard.classList.contains('collapsed') ? '☀️' : '−';
  };

  topControlsToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleTopCard();
  });

  if (topControlsHeader) {
    topControlsHeader.addEventListener('click', () => {
      if (topControlsCard.classList.contains('collapsed')) {
        toggleTopCard();
      }
    });
  }
}

// =====================================================================
// --- 13. Camera Director & MP4 Video Recording System ---
// =====================================================================

const cameraDirectorPanel = document.getElementById('camera-director-panel');
const directorToggleBtn = document.getElementById('director-toggle-btn');
const cameraDirectorHeader = document.getElementById('camera-director-header');

const btnAddKeyframe = document.getElementById('btn-add-keyframe');
const btnClearKeyframes = document.getElementById('btn-clear-keyframes');
const keyframeCount = document.getElementById('keyframe-count');
const waypointsTimeline = document.getElementById('waypoints-timeline');

const cameraSpeedSlider = document.getElementById('camera-speed-slider');
const cameraSpeedVal = document.getElementById('camera-speed-val');
const showPathLineCheckbox = document.getElementById('show-path-line-checkbox');

const btnPreviewFlight = document.getElementById('btn-preview-flight');
const btnRecordVideo = document.getElementById('btn-record-video');
const directorStatus = document.getElementById('director-status');

// Waypoints Array & Visual 3D Spline Path
let cameraWaypoints = [];
const pathVisualGroup = new THREE.Group();
scene.add(pathVisualGroup);

function rebuildSplineCurves() {
  if (cameraWaypoints.length < 2) {
    activePosCurve = null;
    activeTargetCurve = null;
    return;
  }
  const posPoints = cameraWaypoints.map((w) => w.position);
  const targetPoints = cameraWaypoints.map((w) => w.target);

  // Closed loop: smoothly continuous from last point back into first point
  activePosCurve = new THREE.CatmullRomCurve3(posPoints, true, 'catmullrom', 0.5);
  activeTargetCurve = new THREE.CatmullRomCurve3(targetPoints, true, 'catmullrom', 0.5);
}

function updateWaypointsUI() {
  if (keyframeCount) {
    const count = cameraWaypoints.length;
    keyframeCount.textContent = `${count} Point${count === 1 ? '' : 's'}`;
  }

  if (waypointsTimeline) {
    waypointsTimeline.innerHTML = '';
    if (cameraWaypoints.length === 0) {
      waypointsTimeline.innerHTML = '<span class="timeline-empty-hint">Orbit camera & click "Add Point" to create path</span>';
    } else {
      cameraWaypoints.forEach((w, idx) => {
        const chip = document.createElement('div');
        chip.className = 'waypoint-chip';
        chip.title = `Click to view Point #${idx + 1}`;
        chip.innerHTML = `<span>P${idx + 1}</span><span class="remove-pt-btn" title="Remove this point">✕</span>`;

        // Click chip to snap camera and view angle
        chip.addEventListener('click', (e) => {
          if (e.target.classList.contains('remove-pt-btn')) return;
          jumpToWaypoint(w.id);
        });

        // Click ✕ to remove point
        const removeBtn = chip.querySelector('.remove-pt-btn');
        if (removeBtn) {
          removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            removeWaypoint(w.id);
          });
        }

        waypointsTimeline.appendChild(chip);
      });
    }
  }

  rebuildSplineCurves();
  updatePathVisual();
}

function updatePathVisual() {
  // Dispose old visual meshes
  while (pathVisualGroup.children.length > 0) {
    const child = pathVisualGroup.children[0];
    if (child.geometry) child.geometry.dispose();
    if (child.material) child.material.dispose();
    pathVisualGroup.remove(child);
  }

  const showLine = showPathLineCheckbox ? showPathLineCheckbox.checked : true;
  if (!showLine || cameraWaypoints.length < 2) return;

  const points = cameraWaypoints.map((w) => w.position);
  const curve = new THREE.CatmullRomCurve3(points, true, 'catmullrom', 0.5);
  const curvePoints = curve.getPoints(120);

  const lineGeom = new THREE.BufferGeometry().setFromPoints(curvePoints);
  const lineMat = new THREE.LineBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.75,
    linewidth: 2,
  });
  const line = new THREE.Line(lineGeom, lineMat);
  pathVisualGroup.add(line);

  // Marker spheres at each waypoint
  const sphereGeom = new THREE.SphereGeometry(1.6, 12, 12);
  const sphereMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  cameraWaypoints.forEach((w) => {
    const sphere = new THREE.Mesh(sphereGeom, sphereMat);
    sphere.position.copy(w.position);
    pathVisualGroup.add(sphere);
  });
}

function addCurrentWaypoint() {
  const newPt = {
    id: Date.now() + Math.random(),
    position: camera.position.clone(),
    target: controls.target.clone(),
  };
  cameraWaypoints.push(newPt);
  updateWaypointsUI();

  if (directorStatus) {
    directorStatus.className = 'director-status';
    directorStatus.textContent = `✓ Point #${cameraWaypoints.length} added!`;
    setTimeout(() => {
      if (directorStatus && !isRecording) directorStatus.textContent = '';
    }, 2500);
  }
}

function clearAllWaypoints() {
  stopFlightLoop();
  cameraWaypoints = [];
  updateWaypointsUI();

  if (directorStatus) {
    directorStatus.className = 'director-status';
    directorStatus.textContent = 'Flight path cleared';
    setTimeout(() => {
      if (directorStatus && !isRecording) directorStatus.textContent = '';
    }, 2000);
  }
}

function removeWaypoint(id) {
  stopFlightLoop();
  cameraWaypoints = cameraWaypoints.filter((w) => w.id !== id);
  updateWaypointsUI();
}

function jumpToWaypoint(id) {
  const pt = cameraWaypoints.find((w) => w.id === id);
  if (!pt) return;
  camera.position.copy(pt.position);
  controls.target.copy(pt.target);
  controls.update();
}

// Camera Speed Slider
if (cameraSpeedSlider) {
  cameraSpeedSlider.addEventListener('input', (e) => {
    cameraSpeedPercent = Number(e.target.value);
    if (cameraSpeedVal) cameraSpeedVal.textContent = `${cameraSpeedPercent}%`;
  });
}

if (showPathLineCheckbox) {
  showPathLineCheckbox.addEventListener('change', () => {
    updatePathVisual();
  });
}

if (btnAddKeyframe) {
  btnAddKeyframe.addEventListener('click', addCurrentWaypoint);
}

if (btnClearKeyframes) {
  btnClearKeyframes.addEventListener('click', clearAllWaypoints);
}

// --- Flight Loop Controls (Continuous Seamless Flying) ---
function startFlightLoop() {
  if (cameraWaypoints.length < 2) {
    alert('Please add at least 2 camera points to create a flight path!');
    return false;
  }
  rebuildSplineCurves();
  flightProgress = 0;
  isFlyingCamera = true;
  if (btnPreviewFlight) btnPreviewFlight.textContent = '⏹️ Stop Preview';
  return true;
}

function stopFlightLoop() {
  isFlyingCamera = false;
  controls.enabled = true;
  if (btnPreviewFlight) btnPreviewFlight.textContent = '▶️ Preview';
}

if (btnPreviewFlight) {
  btnPreviewFlight.addEventListener('click', () => {
    if (isFlyingCamera && !isRecording) {
      stopFlightLoop();
    } else {
      startFlightLoop();
    }
  });
}

// --- MP4 Video Recorder Engine (Continuous Recording Until User Stops) ---
let isRecording = false;
let mediaRecorder = null;
let recordedChunks = [];
let recordingTimer = null;
let recStartTime = 0;

function getBestMimeType() {
  const types = [
    'video/mp4;codecs=avc1',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=h264',
    'video/webm',
  ];
  for (const t of types) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) {
      return t;
    }
  }
  return '';
}

function startRecording() {
  if (isRecording) return;

  const mimeType = getBestMimeType();
  if (!mimeType) {
    alert('Video recording is not supported in this browser.');
    return;
  }

  // If we have at least 2 waypoints, start continuous camera loop flight immediately!
  if (cameraWaypoints.length >= 2) {
    rebuildSplineCurves();
    flightProgress = 0;
    isFlyingCamera = true;
    if (btnPreviewFlight) btnPreviewFlight.textContent = '⏹️ Stop Preview';
  }

  // Hide 3D path line during recording for cinema-quality output
  pathVisualGroup.visible = false;
  recordedChunks = [];

  const stream = canvas.captureStream(60);
  try {
    mediaRecorder = new MediaRecorder(stream, {
      mimeType: mimeType,
      videoBitsPerSecond: 14000000, // 14 Mbps for crisp 1080p
    });
  } catch (err) {
    console.warn('Fallback bitrate:', err);
    mediaRecorder = new MediaRecorder(stream);
  }

  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      recordedChunks.push(e.data);
    }
  };

  const isMP4 = mimeType.includes('mp4');
  const fileExt = isMP4 ? 'mp4' : 'webm';

  mediaRecorder.onstop = () => {
    clearInterval(recordingTimer);
    isRecording = false;

    if (btnRecordVideo) {
      btnRecordVideo.textContent = '🔴 Record MP4';
      btnRecordVideo.classList.remove('recording');
    }

    // Restore path visual line if user enabled it
    pathVisualGroup.visible = showPathLineCheckbox ? showPathLineCheckbox.checked : true;

    if (recordedChunks.length === 0) {
      if (directorStatus) directorStatus.textContent = 'Recording was empty';
      return;
    }

    const blob = new Blob(recordedChunks, { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `3d-cinematic-flight-${Date.now()}.${fileExt}`;
    a.click();
    URL.revokeObjectURL(url);

    if (directorStatus) {
      directorStatus.className = 'director-status';
      directorStatus.textContent = `✓ Saved as .${fileExt.toUpperCase()}! Check Downloads.`;
      setTimeout(() => {
        if (directorStatus) directorStatus.textContent = '';
      }, 5000);
    }
  };

  mediaRecorder.start(200);
  isRecording = true;
  recStartTime = Date.now();

  if (btnRecordVideo) {
    btnRecordVideo.textContent = '⏹️ Stop & Save';
    btnRecordVideo.classList.add('recording');
  }

  if (directorStatus) {
    directorStatus.className = 'director-status recording-active';
    directorStatus.textContent = 'REC 00:00 (Looping)';
  }

  recordingTimer = setInterval(() => {
    const sec = Math.floor((Date.now() - recStartTime) / 1000);
    const mm = String(Math.floor(sec / 60)).padStart(2, '0');
    const ss = String(sec % 60).padStart(2, '0');
    if (directorStatus && isRecording) {
      directorStatus.textContent = `REC ${mm}:${ss} (60fps)`;
    }
  }, 500);
}

function stopRecording() {
  if (!isRecording) return;
  stopFlightLoop();
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
}

if (btnRecordVideo) {
  btnRecordVideo.addEventListener('click', () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  });
}

// Top Center Camera Director Panel Collapse Toggle
if (directorToggleBtn && cameraDirectorPanel) {
  const toggleDirector = () => {
    cameraDirectorPanel.classList.toggle('collapsed');
    directorToggleBtn.textContent = cameraDirectorPanel.classList.contains('collapsed') ? '🎬' : '−';
  };

  directorToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDirector();
  });

  if (cameraDirectorHeader) {
    cameraDirectorHeader.addEventListener('click', () => {
      if (cameraDirectorPanel.classList.contains('collapsed')) {
        toggleDirector();
      }
    });
  }
}
