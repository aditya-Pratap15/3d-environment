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
  btn.addEventListener('click', (e) => {
    const targetBtn = e.currentTarget || btn;
    if (typeof pushHistoryState === 'function') pushHistoryState();
    groundBoxes.forEach((b) => b.classList.remove('active'));
    targetBtn.classList.add('active');
    switchGround(targetBtn.dataset.ground);
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
      togglePanel();
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
      toggleTopCard();
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
      toggleDirector();
    });
  }
}

// =====================================================================
// --- 15. Top 3D Image & Cutout Studio (Beside the Record Box) ---
// =====================================================================
const imageStudioPanel = document.getElementById('image-studio-panel');
const imageStudioToggleBtn = document.getElementById('image-studio-toggle-btn');
const imageStudioHeader = document.getElementById('image-studio-header');
const imageUploadInput = document.getElementById('image-upload-input');
const btnUploadImage = document.getElementById('btn-upload-image');
const imageUploadInfo = document.getElementById('image-upload-info');
const imageObjectCtrls = document.getElementById('image-object-ctrls');
const imageObjectSelect = document.getElementById('image-object-select');
const btnDeleteImage = document.getElementById('btn-delete-image');
const imageAspectLock = document.getElementById('image-aspect-lock');

const imgWidthSlider = document.getElementById('img-width-slider');
const imgWidthVal = document.getElementById('img-width-val');
const imgHeightSlider = document.getElementById('img-height-slider');
const imgHeightVal = document.getElementById('img-height-val');
const imgDepthSlider = document.getElementById('img-depth-slider');
const imgDepthVal = document.getElementById('img-depth-val');
const imgTransparencySlider = document.getElementById('img-transparency-slider');
const imgTransparencyVal = document.getElementById('img-transparency-val');
const imgReflectionSlider = document.getElementById('img-reflection-slider');
const imgReflectionVal = document.getElementById('img-reflection-val');

const imgPosXSlider = document.getElementById('img-pos-x-slider');
const imgPosXVal = document.getElementById('img-pos-x-val');
const imgPosYSlider = document.getElementById('img-pos-y-slider');
const imgPosYVal = document.getElementById('img-pos-y-val');
const imgPosZSlider = document.getElementById('img-pos-z-slider');
const imgPosZVal = document.getElementById('img-pos-z-val');
const imgRotYSlider = document.getElementById('img-rot-y-slider');
const imgRotYVal = document.getElementById('img-rot-y-val');

let image3dRegistry = [];
let selectedImageId = null;

function getSelectedImage3D() {
  return image3dRegistry.find((o) => o.id === selectedImageId) || (image3dRegistry.length > 0 ? image3dRegistry[0] : null);
}

// Alpha contour tracing for background-removed PNG cutouts
function traceAlphaContour(img, targetWidth, targetHeight) {
  try {
    const maxDim = 250;
    const aspect = img.naturalWidth / img.naturalHeight;
    let w, h;
    if (aspect >= 1) {
      w = Math.min(maxDim, img.naturalWidth);
      h = Math.max(16, Math.round(w / aspect));
    } else {
      h = Math.min(maxDim, img.naturalHeight);
      w = Math.max(16, Math.round(h * aspect));
    }

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;

    // Solid test: only consider pixels with alpha > 110 (avoids faint edge fringes & compression noise)
    const isSolid = (x, y) => {
      if (x < 0 || x >= w || y < 0 || y >= h) return false;
      return data[(y * w + x) * 4 + 3] > 110;
    };

    // Find the first solid pixel (top to bottom, left to right)
    let startX = -1, startY = -1;
    for (let y = 0; y < h && startX === -1; y++) {
      for (let x = 0; x < w; x++) {
        if (isSolid(x, y)) {
          startX = x;
          startY = y;
          break;
        }
      }
    }

    if (startX === -1) return null;

    // 8-way Moore-Neighbor tracing
    const directions = [
      { dx: 1, dy: 0 }, { dx: 1, dy: 1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 1 },
      { dx: -1, dy: 0 }, { dx: -1, dy: -1 }, { dx: 0, dy: -1 }, { dx: 1, dy: -1 },
    ];

    let cx = startX, cy = startY;
    let dir = 7;
    const rawPixels = [];
    const maxSteps = w * h;
    let steps = 0;

    do {
      rawPixels.push({ x: cx, y: cy });
      let found = false;
      for (let i = 0; i < 8; i++) {
        const nd = (dir + i) % 8;
        const nxCoord = cx + directions[nd].dx;
        const nyCoord = cy + directions[nd].dy;
        if (isSolid(nxCoord, nyCoord)) {
          cx = nxCoord;
          cy = nyCoord;
          dir = (nd + 5) % 8;
          found = true;
          break;
        }
      }
      if (!found) break;
      steps++;
    } while ((cx !== startX || cy !== startY) && steps < maxSteps);

    if (rawPixels.length < 8) return null;

    // Downsample points that are at least 1.8 pixels apart
    const sampled = [];
    let last = rawPixels[0];
    sampled.push(last);
    for (let i = 1; i < rawPixels.length; i++) {
      const p = rawPixels[i];
      const dx = p.x - last.x;
      const dy = p.y - last.y;
      if (dx * dx + dy * dy >= 3.0) {
        sampled.push(p);
        last = p;
      }
    }
    if (sampled.length < 6) return null;

    // Convert pixel coordinates (0..w, 0..h) to 3D centered shape coordinates
    const pts = sampled.map((p) => ({
      x: ((p.x + 0.5) / w - 0.5) * targetWidth,
      y: (0.5 - (p.y + 0.5) / h) * targetHeight,
    }));

    // Calculate signed area to verify winding
    let signedArea = 0;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      signedArea += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
    }
    const isClockwise = signedArea < 0;

    // INSETTING: shift boundary inward along edge normals by ~1.4%
    // This ensures the 3D depth mesh is strictly inside the 2D image silhouette
    const insetDist = Math.min(targetWidth, targetHeight) * 0.014;
    const insetPts = [];
    for (let i = 0; i < n; i++) {
      const prev = pts[(i - 1 + n) % n];
      const curr = pts[i];
      const next = pts[(i + 1) % n];

      let e1x = curr.x - prev.x, e1y = curr.y - prev.y;
      const l1 = Math.hypot(e1x, e1y) || 1;
      e1x /= l1; e1y /= l1;

      let e2x = next.x - curr.x, e2y = next.y - curr.y;
      const l2 = Math.hypot(e2x, e2y) || 1;
      e2x /= l2; e2y /= l2;

      // Inward normal for each edge
      const n1x = isClockwise ? e1y : -e1y;
      const n1y = isClockwise ? -e1x : e1x;
      const n2x = isClockwise ? e2y : -e2y;
      const n2y = isClockwise ? -e2x : e2x;

      let bnx = n1x + n2x, bny = n1y + n2y;
      const bl = Math.hypot(bnx, bny);
      if (bl > 0.001) {
        bnx /= bl;
        bny /= bl;
        const dot = n1x * n2x + n1y * n2y;
        const scale = dot < 0 ? Math.max(0.3, 1 + dot) : 1.0;
        insetPts.push({
          x: curr.x + bnx * insetDist * scale,
          y: curr.y + bny * insetDist * scale,
        });
      } else {
        insetPts.push({ x: curr.x, y: curr.y });
      }
    }

    // 2-pass Chaikin smoothing for silky-smooth organic borders
    let smoothPts = insetPts;
    for (let pass = 0; pass < 2; pass++) {
      const nextPass = [];
      const len = smoothPts.length;
      for (let i = 0; i < len; i++) {
        const p0 = smoothPts[i];
        const p1 = smoothPts[(i + 1) % len];
        nextPass.push({
          x: 0.75 * p0.x + 0.25 * p1.x,
          y: 0.75 * p0.y + 0.25 * p1.y,
        });
        nextPass.push({
          x: 0.25 * p0.x + 0.75 * p1.x,
          y: 0.25 * p0.y + 0.75 * p1.y,
        });
      }
      smoothPts = nextPass;
    }

    const shape = new THREE.Shape();
    shape.moveTo(smoothPts[0].x, smoothPts[0].y);
    for (let i = 1; i < smoothPts.length; i++) {
      shape.lineTo(smoothPts[i].x, smoothPts[i].y);
    }
    shape.closePath();

    // INNER HOLES DETECTION (e.g. gap between legs or under arms)
    try {
      const bgVisited = new Uint8Array(w * h);
      const queue = [];
      for (let x = 0; x < w; x++) {
        if (!isSolid(x, 0)) { bgVisited[x] = 1; queue.push(x, 0); }
        if (!isSolid(x, h - 1)) { bgVisited[(h - 1) * w + x] = 1; queue.push(x, h - 1); }
      }
      for (let y = 1; y < h - 1; y++) {
        if (!isSolid(0, y)) { bgVisited[y * w] = 1; queue.push(0, y); }
        if (!isSolid(w - 1, y)) { bgVisited[y * w + (w - 1)] = 1; queue.push(w - 1, y); }
      }

      let qHead = 0;
      while (qHead < queue.length) {
        const qx = queue[qHead++];
        const qy = queue[qHead++];
        const nbrs = [qx + 1, qy, qx - 1, qy, qx, qy + 1, qx, qy - 1];
        for (let k = 0; k < 8; k += 2) {
          const nx = nbrs[k], ny = nbrs[k + 1];
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            const idx = ny * w + nx;
            if (!bgVisited[idx] && !isSolid(nx, ny)) {
              bgVisited[idx] = 1;
              queue.push(nx, ny);
            }
          }
        }
      }

      const holeVisited = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = y * w + x;
          if (!isSolid(x, y) && !bgVisited[idx] && !holeVisited[idx]) {
            const hQueue = [x, y];
            holeVisited[idx] = 1;
            const holePix = [];
            let hHead = 0;
            while (hHead < hQueue.length) {
              const hx = hQueue[hHead++];
              const hy = hQueue[hHead++];
              holePix.push({ x: hx, y: hy });
              const hn = [hx + 1, hy, hx - 1, hy, hx, hy + 1, hx, hy - 1];
              for (let k = 0; k < 8; k += 2) {
                const nx = hn[k], ny = hn[k + 1];
                if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                  const nIdx = ny * w + nx;
                  if (!isSolid(nx, ny) && !bgVisited[nIdx] && !holeVisited[nIdx]) {
                    holeVisited[nIdx] = 1;
                    hQueue.push(nx, ny);
                  }
                }
              }
            }

            // Only cutout noticeable interior holes (> 25 pixels)
            if (holePix.length >= 25) {
              const hStartX = holePix[0].x, hStartY = holePix[0].y;
              const isHole = (hx, hy) => hx >= 0 && hx < w && hy >= 0 && hy < h && holeVisited[hy * w + hx] === 1;

              let hcx = hStartX, hcy = hStartY, hdir = 7;
              const hRaw = [];
              let hSteps = 0;
              do {
                hRaw.push({ x: hcx, y: hcy });
                let hFound = false;
                for (let i = 0; i < 8; i++) {
                  const nd = (hdir + i) % 8;
                  const nhx = hcx + directions[nd].dx;
                  const nhy = hcy + directions[nd].dy;
                  if (isHole(nhx, nhy)) {
                    hcx = nhx;
                    hcy = nhy;
                    hdir = (nd + 5) % 8;
                    hFound = true;
                    break;
                  }
                }
                if (!hFound) break;
                hSteps++;
              } while ((hcx !== hStartX || hcy !== hStartY) && hSteps < maxSteps);

              if (hRaw.length >= 8) {
                const hSampled = [];
                let hLast = hRaw[0];
                hSampled.push(hLast);
                for (let i = 1; i < hRaw.length; i++) {
                  const p = hRaw[i];
                  const dx = p.x - hLast.x, dy = p.y - hLast.y;
                  if (dx * dx + dy * dy >= 3.0) {
                    hSampled.push(p);
                    hLast = p;
                  }
                }

                if (hSampled.length >= 4) {
                  let hPts = hSampled.map((p) => ({
                    x: ((p.x + 0.5) / w - 0.5) * targetWidth,
                    y: (0.5 - (p.y + 0.5) / h) * targetHeight,
                  }));

                  // Chaikin smooth hole
                  for (let pass = 0; pass < 2; pass++) {
                    const nextPass = [];
                    const hLen = hPts.length;
                    for (let i = 0; i < hLen; i++) {
                      const p0 = hPts[i], p1 = hPts[(i + 1) % hLen];
                      nextPass.push({ x: 0.75 * p0.x + 0.25 * p1.x, y: 0.75 * p0.y + 0.25 * p1.y });
                      nextPass.push({ x: 0.25 * p0.x + 0.75 * p1.x, y: 0.25 * p0.y + 0.75 * p1.y });
                    }
                    hPts = nextPass;
                  }

                  const holePath = new THREE.Path();
                  holePath.moveTo(hPts[0].x, hPts[0].y);
                  for (let i = 1; i < hPts.length; i++) {
                    holePath.lineTo(hPts[i].x, hPts[i].y);
                  }
                  holePath.closePath();
                  shape.holes.push(holePath);
                }
              }
            }
          }
        }
      }
    } catch (holeErr) {
      console.warn('Hole detection fallback:', holeErr);
    }

    return shape;
  } catch (err) {
    console.warn('Contour tracing fallback:', err);
    return null;
  }
}

function buildImageGeometryAndMaterials(imgObj) {
  const { img, width, height, depth, transparency, reflection, dataUrl } = imgObj;

  if (!imgObj.texture) {
    imgObj.texture = new THREE.TextureLoader().load(dataUrl);
    imgObj.texture.colorSpace = THREE.SRGBColorSpace;
  }

  if (!imgObj.sideTexture) {
    imgObj.sideTexture = imgObj.texture.clone();
    imgObj.sideTexture.wrapS = THREE.MirroredRepeatWrapping;
    imgObj.sideTexture.wrapT = THREE.MirroredRepeatWrapping;
    imgObj.sideTexture.repeat.set(1, 1);
    imgObj.sideTexture.needsUpdate = true;
  }

  // Depth Opacity Level: 0% = completely transparent depth, 100% = hard solid opaque depth
  const depthOpacity = Math.max(0, Math.min(100, Number(transparency ?? 100))) / 100;
  const isDepthOpaque = depthOpacity >= 0.999;
  const glossRoughness = 1.0 - (Math.max(0, Math.min(100, Number(reflection ?? 80))) / 100) * 0.92;

  // 1. FRONT MATERIAL: ALWAYS 100% OPAQUE SOLID - NEVER LOSES OPACITY!
  const frontMat = new THREE.MeshStandardMaterial({
    map: imgObj.texture,
    transparent: imgObj.hasAlpha,
    alphaTest: imgObj.hasAlpha ? 0.05 : 0,
    opacity: 1.0, // Fixed at 1.0 - front image NEVER fades!
    roughness: 0.25,
    metalness: 0.05,
    side: THREE.FrontSide,
    depthWrite: true,
  });

  // 2. BACK MATERIAL: Used for the rear face when viewed from behind
  const backMat = new THREE.MeshStandardMaterial({
    map: imgObj.texture,
    transparent: !isDepthOpaque || imgObj.hasAlpha,
    alphaTest: imgObj.hasAlpha ? 0.05 : 0,
    opacity: depthOpacity,
    roughness: 0.35,
    metalness: 0.05,
    side: THREE.FrontSide,
    depthWrite: depthOpacity >= 0.3,
    visible: depthOpacity > 0.001,
  });

  // 3. SIDE / EXTRUDED DEPTH MATERIAL: Smooth 3D depth with natural edge reflections
  const sideMat = new THREE.MeshPhysicalMaterial({
    map: imgObj.sideTexture,
    transparent: !isDepthOpaque,
    opacity: depthOpacity,
    roughness: glossRoughness,
    metalness: 0.15,
    reflectivity: 0.95,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
    side: THREE.DoubleSide,
    depthWrite: depthOpacity >= 0.3,
    visible: depthOpacity > 0.001,
  });

  imgObj.frontMat = frontMat;
  imgObj.backMat = backMat;
  imgObj.sideMat = sideMat;

  // Clear existing child meshes from the group
  if (imgObj.group) {
    while (imgObj.group.children.length > 0) {
      const child = imgObj.group.children[0];
      if (child.geometry) child.geometry.dispose();
      imgObj.group.remove(child);
    }
  }

  if (imgObj.hasAlpha) {
    const shape = traceAlphaContour(img, width, height);
    if (shape) {
      // Extrude 3D backing mesh
      const extrudeGeo = new THREE.ExtrudeGeometry(shape, {
        depth: Math.max(0.05, depth),
        bevelEnabled: false,
        steps: 1,
      });
      // Center along Z only (from -depth/2 to +depth/2) - DO NOT shift X/Y!
      extrudeGeo.translate(0, 0, -depth / 2);

      const pos = extrudeGeo.attributes.position;
      const uvs = [];
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        uvs.push((x / width) + 0.5, (y / height) + 0.5);
      }
      extrudeGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      extrudeGeo.computeVertexNormals();

      const depthMesh = new THREE.Mesh(extrudeGeo, [sideMat, sideMat]);
      depthMesh.castShadow = true;
      depthMesh.receiveShadow = true;
      imgObj.mesh = depthMesh;
      imgObj.group.add(depthMesh);

      // Layered Front Plane: 100% crisp, un-downsampled 2D photo layered at z = depth/2 + 0.005
      // Because the 3D backing is inset inward, the front plane cleanly masks it from the front!
      const frontGeo = new THREE.PlaneGeometry(width, height);
      const frontMesh = new THREE.Mesh(frontGeo, frontMat);
      frontMesh.position.set(0, 0, depth / 2 + 0.005);
      frontMesh.castShadow = true;
      frontMesh.receiveShadow = true;
      imgObj.frontMesh = frontMesh;
      imgObj.group.add(frontMesh);

      // Layered Back Plane: at z = -depth/2 - 0.005 facing back
      const backGeo = new THREE.PlaneGeometry(width, height);
      const backMesh = new THREE.Mesh(backGeo, backMat);
      backMesh.position.set(0, 0, -depth / 2 - 0.005);
      backMesh.rotation.y = Math.PI;
      backMesh.castShadow = true;
      backMesh.receiveShadow = true;
      imgObj.backMesh = backMesh;
      imgObj.group.add(backMesh);

      return { geometry: extrudeGeo, materials: [sideMat, sideMat] };
    }
  }

  // Standard box fallback (for non-alpha JPG or rectangular photos)
  const boxGeo = new THREE.BoxGeometry(width, height, depth);
  const materials = [sideMat, sideMat, sideMat, sideMat, frontMat, backMat];
  const boxMesh = new THREE.Mesh(boxGeo, materials);
  boxMesh.castShadow = true;
  boxMesh.receiveShadow = true;
  imgObj.mesh = boxMesh;
  imgObj.group.add(boxMesh);

  return { geometry: boxGeo, materials: materials };
}

function updateSelectedImage3D(rebuildGeo = true) {
  const obj = getSelectedImage3D();
  if (!obj || !obj.group) return;

  if (rebuildGeo) {
    buildImageGeometryAndMaterials(obj);
  } else {
    // Fast material update when dragging Opacity or Reflection sliders
    const depthOpacity = Math.max(0, Math.min(100, Number(obj.transparency ?? 100))) / 100;
    const isDepthOpaque = depthOpacity >= 0.999;
    const glossRoughness = 1.0 - (Math.max(0, Math.min(100, Number(obj.reflection ?? 80))) / 100) * 0.92;

    if (obj.sideMat) {
      obj.sideMat.opacity = depthOpacity;
      obj.sideMat.transparent = !isDepthOpaque;
      obj.sideMat.depthWrite = depthOpacity >= 0.3;
      obj.sideMat.visible = depthOpacity > 0.001;
      obj.sideMat.roughness = glossRoughness;
      obj.sideMat.needsUpdate = true;
    }
    if (obj.backMat) {
      obj.backMat.opacity = depthOpacity;
      obj.backMat.transparent = !isDepthOpaque || obj.hasAlpha;
      obj.backMat.depthWrite = depthOpacity >= 0.3;
      obj.backMat.visible = depthOpacity > 0.001;
      obj.backMat.needsUpdate = true;
    }
    // obj.frontMat is strictly UNTOUCHED and remains 100% solid & opaque!
  }

  obj.group.position.set(obj.position.x, obj.position.y, obj.position.z);
  obj.group.rotation.y = (obj.rotationY * Math.PI) / 180;

  prepareMeshShadows(obj.group);
}

function updateImageSelectOptions() {
  if (!imageObjectSelect) return;
  imageObjectSelect.innerHTML = '';

  if (image3dRegistry.length === 0) {
    if (imageObjectCtrls) imageObjectCtrls.style.display = 'none';
    return;
  }

  if (imageObjectCtrls) imageObjectCtrls.style.display = 'flex';

  image3dRegistry.forEach((obj) => {
    const opt = document.createElement('option');
    opt.value = obj.id;
    opt.textContent = obj.name;
    if (obj.id === selectedImageId) opt.selected = true;
    imageObjectSelect.appendChild(opt);
  });
}

function updateImageSliderUI() {
  const obj = getSelectedImage3D();
  if (!obj) return;

  if (imgWidthSlider) imgWidthSlider.value = obj.width;
  if (imgWidthVal) imgWidthVal.textContent = `${obj.width.toFixed(1)}m`;

  if (imgHeightSlider) imgHeightSlider.value = obj.height;
  if (imgHeightVal) imgHeightVal.textContent = `${obj.height.toFixed(1)}m`;

  if (imgDepthSlider) imgDepthSlider.value = obj.depth;
  if (imgDepthVal) imgDepthVal.textContent = `${obj.depth.toFixed(1)}m`;

  if (imgTransparencySlider) imgTransparencySlider.value = obj.transparency;
  if (imgTransparencyVal) imgTransparencyVal.textContent = `${obj.transparency}%`;

  if (imgReflectionSlider) imgReflectionSlider.value = obj.reflection;
  if (imgReflectionVal) imgReflectionVal.textContent = `${obj.reflection}%`;

  if (imgPosXSlider) imgPosXSlider.value = obj.position.x;
  if (imgPosXVal) imgPosXVal.textContent = `${obj.position.x}m`;

  if (imgPosYSlider) imgPosYSlider.value = obj.position.y;
  if (imgPosYVal) imgPosYVal.textContent = `${obj.position.y}m`;

  if (imgPosZSlider) imgPosZSlider.value = obj.position.z;
  if (imgPosZVal) imgPosZVal.textContent = `${obj.position.z}m`;

  if (imgRotYSlider) imgRotYSlider.value = obj.rotationY;
  if (imgRotYVal) imgRotYVal.textContent = `${obj.rotationY}°`;
}

let imageCountIndex = 0;
function createImage3DObject(img, dataUrl, fileName) {
  if (typeof pushHistoryState === 'function') pushHistoryState();

  imageCountIndex++;
  const id = `image3d_${Date.now()}_${imageCountIndex}`;

  // Analyze transparency
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

  let hasAlpha = false;
  for (let i = 3; i < data.length; i += 32) {
    if (data[i] < 220) {
      hasAlpha = true;
      break;
    }
  }

  const aspect = img.naturalWidth / img.naturalHeight;
  const baseWidth = aspect >= 1 ? 22 : 22 * aspect;
  const baseHeight = aspect >= 1 ? 22 / aspect : 22;
  const baseDepth = 3.0; // 3D depth

  const newObj = {
    id: id,
    name: `🖼️ ${fileName ? fileName.slice(0, 16) : 'Image'} #${imageCountIndex}`,
    dataUrl: dataUrl,
    img: img,
    hasAlpha: hasAlpha,
    aspect: aspect,
    width: Number(baseWidth.toFixed(1)),
    height: Number(baseHeight.toFixed(1)),
    depth: baseDepth,
    transparency: 100, // Default: 100% HARD OPAQUE SOLID 3D MESH!
    reflection: 80,
    position: { x: 0, y: Number((baseHeight / 2 + 2).toFixed(1)), z: 35 },
    rotationY: 0,
    group: new THREE.Group(),
  };

  buildImageGeometryAndMaterials(newObj);

  newObj.group.position.set(newObj.position.x, newObj.position.y, newObj.position.z);
  newObj.group.rotation.y = (newObj.rotationY * Math.PI) / 180;

  scene.add(newObj.group);
  prepareMeshShadows(newObj.group);

  image3dRegistry.push(newObj);
  selectedImageId = id;

  updateImageSelectOptions();
  updateImageSliderUI();

  if (imageUploadInfo) {
    imageUploadInfo.textContent = `✓ "${newObj.name}" active in 3D!`;
    setTimeout(() => {
      if (imageUploadInfo) imageUploadInfo.textContent = 'Upload PNG cutouts, JPGs, or WebP';
    }, 4000);
  }
}

if (btnUploadImage && imageUploadInput) {
  btnUploadImage.addEventListener('click', () => {
    imageUploadInput.click();
  });

  imageUploadInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target.result;
      const img = new Image();
      img.onload = () => {
        createImage3DObject(img, dataUrl, file.name);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    imageUploadInput.value = '';
  });
}

if (imageObjectSelect) {
  imageObjectSelect.addEventListener('change', (e) => {
    selectedImageId = e.target.value;
    updateImageSliderUI();
  });
}

if (btnDeleteImage) {
  btnDeleteImage.addEventListener('click', () => {
    const idx = image3dRegistry.findIndex((o) => o.id === selectedImageId);
    if (idx === -1) return;

    if (typeof pushHistoryState === 'function') pushHistoryState();

    const obj = image3dRegistry[idx];
    scene.remove(obj.group);
    image3dRegistry.splice(idx, 1);

    selectedImageId = image3dRegistry.length > 0 ? image3dRegistry[0].id : null;
    updateImageSelectOptions();
    updateImageSliderUI();
  });
}

if (imgWidthSlider) {
  imgWidthSlider.addEventListener('input', (e) => {
    const obj = getSelectedImage3D();
    if (!obj) return;
    const newW = Number(e.target.value);
    obj.width = newW;
    if (imgWidthVal) imgWidthVal.textContent = `${newW.toFixed(1)}m`;

    if (imageAspectLock && imageAspectLock.checked && obj.aspect) {
      const newH = Number((newW / obj.aspect).toFixed(1));
      obj.height = newH;
      if (imgHeightSlider) imgHeightSlider.value = newH;
      if (imgHeightVal) imgHeightVal.textContent = `${newH}m`;
    }

    updateSelectedImage3D(true);
  });
}

if (imgHeightSlider) {
  imgHeightSlider.addEventListener('input', (e) => {
    const obj = getSelectedImage3D();
    if (!obj) return;
    const newH = Number(e.target.value);
    obj.height = newH;
    if (imgHeightVal) imgHeightVal.textContent = `${newH.toFixed(1)}m`;

    if (imageAspectLock && imageAspectLock.checked && obj.aspect) {
      const newW = Number((newH * obj.aspect).toFixed(1));
      obj.width = newW;
      if (imgWidthSlider) imgWidthSlider.value = newW;
      if (imgWidthVal) imgWidthVal.textContent = `${newW}m`;
    }

    updateSelectedImage3D(true);
  });
}

if (imgDepthSlider) {
  imgDepthSlider.addEventListener('input', (e) => {
    const obj = getSelectedImage3D();
    if (!obj) return;
    obj.depth = Number(e.target.value);
    if (imgDepthVal) imgDepthVal.textContent = `${obj.depth.toFixed(1)}m`;
    updateSelectedImage3D(true);
  });
}

if (imgTransparencySlider) {
  imgTransparencySlider.addEventListener('input', (e) => {
    const obj = getSelectedImage3D();
    if (!obj) return;
    obj.transparency = Number(e.target.value);
    if (imgTransparencyVal) imgTransparencyVal.textContent = `${obj.transparency}%`;
    updateSelectedImage3D(false);
  });
}

if (imgReflectionSlider) {
  imgReflectionSlider.addEventListener('input', (e) => {
    const obj = getSelectedImage3D();
    if (!obj) return;
    obj.reflection = Number(e.target.value);
    if (imgReflectionVal) imgReflectionVal.textContent = `${obj.reflection}%`;
    updateSelectedImage3D(false);
  });
}

if (imgPosXSlider) {
  imgPosXSlider.addEventListener('input', (e) => {
    const obj = getSelectedImage3D();
    if (!obj) return;
    obj.position.x = Number(e.target.value);
    if (imgPosXVal) imgPosXVal.textContent = `${obj.position.x}m`;
    updateSelectedImage3D(false);
  });
}

if (imgPosYSlider) {
  imgPosYSlider.addEventListener('input', (e) => {
    const obj = getSelectedImage3D();
    if (!obj) return;
    obj.position.y = Number(e.target.value);
    if (imgPosYVal) imgPosYVal.textContent = `${obj.position.y}m`;
    updateSelectedImage3D(false);
  });
}

if (imgPosZSlider) {
  imgPosZSlider.addEventListener('input', (e) => {
    const obj = getSelectedImage3D();
    if (!obj) return;
    obj.position.z = Number(e.target.value);
    if (imgPosZVal) imgPosZVal.textContent = `${obj.position.z}m`;
    updateSelectedImage3D(false);
  });
}

if (imgRotYSlider) {
  imgRotYSlider.addEventListener('input', (e) => {
    const obj = getSelectedImage3D();
    if (!obj) return;
    obj.rotationY = Number(e.target.value);
    if (imgRotYVal) imgRotYVal.textContent = `${obj.rotationY}°`;
    updateSelectedImage3D(false);
  });
}

attachSliderHistory(imgWidthSlider);
attachSliderHistory(imgHeightSlider);
attachSliderHistory(imgDepthSlider);
attachSliderHistory(imgTransparencySlider);
attachSliderHistory(imgReflectionSlider);
attachSliderHistory(imgPosXSlider);
attachSliderHistory(imgPosYSlider);
attachSliderHistory(imgPosZSlider);
attachSliderHistory(imgRotYSlider);

// Header toggle collapse
if (imageStudioToggleBtn && imageStudioPanel) {
  const toggleImageStudio = () => {
    imageStudioPanel.classList.toggle('collapsed');
    imageStudioToggleBtn.textContent = imageStudioPanel.classList.contains('collapsed') ? '🖼️' : '−';
  };

  imageStudioToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleImageStudio();
  });

  if (imageStudioHeader) {
    imageStudioHeader.addEventListener('click', () => {
      toggleImageStudio();
    });
  }
}

// =====================================================================
// --- 16. Top 3D Cuboid Studio (Left Side of Record Box) ---
// =====================================================================
const cuboidStudioPanel = document.getElementById('cuboid-studio-panel');
const cuboidStudioToggleBtn = document.getElementById('cuboid-studio-toggle-btn');
const cuboidStudioHeader = document.getElementById('cuboid-studio-header');

const btnAddCuboid = document.getElementById('btn-add-cuboid');
const cuboidStatusInfo = document.getElementById('cuboid-status-info');
const cuboidObjectCtrls = document.getElementById('cuboid-object-ctrls');
const cuboidSelect = document.getElementById('cuboid-select');
const btnDeleteCuboid = document.getElementById('btn-delete-cuboid');

const cuboidWidthSlider = document.getElementById('cuboid-width-slider');
const cuboidWidthVal = document.getElementById('cuboid-width-val');
const cuboidHeightSlider = document.getElementById('cuboid-height-slider');
const cuboidHeightVal = document.getElementById('cuboid-height-val');
const cuboidDepthSlider = document.getElementById('cuboid-depth-slider');
const cuboidDepthVal = document.getElementById('cuboid-depth-val');

const cuboidSmoothnessSlider = document.getElementById('cuboid-smoothness-slider');
const cuboidSmoothnessVal = document.getElementById('cuboid-smoothness-val');

const cuboidColorPicker = document.getElementById('cuboid-color-picker');
const cuboidColorHex = document.getElementById('cuboid-color-hex');
const cuboidSwatchBtns = document.querySelectorAll('.color-swatch-btn');

const cuboidImageInput = document.getElementById('cuboid-image-input');
const btnUploadCuboidImg = document.getElementById('btn-upload-cuboid-img');
const btnClearCuboidImg = document.getElementById('btn-clear-cuboid-img');

const cuboidPosXSlider = document.getElementById('cuboid-pos-x-slider');
const cuboidPosXVal = document.getElementById('cuboid-pos-x-val');
const cuboidPosYSlider = document.getElementById('cuboid-pos-y-slider');
const cuboidPosYVal = document.getElementById('cuboid-pos-y-val');
const cuboidPosZSlider = document.getElementById('cuboid-pos-z-slider');
const cuboidPosZVal = document.getElementById('cuboid-pos-z-val');

const cuboidRotYSlider = document.getElementById('cuboid-rot-y-slider');
const cuboidRotYVal = document.getElementById('cuboid-rot-y-val');
const cuboidRotXSlider = document.getElementById('cuboid-rot-x-slider');
const cuboidRotXVal = document.getElementById('cuboid-rot-x-val');

const cuboid3dRegistry = [];
let selectedCuboidId = null;
let cuboidCountIndex = 0;

function getSelectedCuboid() {
  return cuboid3dRegistry.find((c) => c.id === selectedCuboidId) || (cuboid3dRegistry.length > 0 ? cuboid3dRegistry[0] : null);
}

// Self-contained Rounded Box Geometry generator (zero external module dependencies)
function createRoundedBoxGeometry(width = 1, height = 1, depth = 1, segments = 2, radius = 0.1) {
  segments = segments * 2 + 1;
  radius = Math.min(width / 2, height / 2, depth / 2, radius);

  const boxGeo = new THREE.BoxGeometry(1, 1, 1, segments, segments, segments);
  if (segments === 1 || radius <= 0.001) return boxGeo;

  const nonIndexed = boxGeo.toNonIndexed();
  boxGeo.dispose();

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', nonIndexed.attributes.position);
  geom.setAttribute('normal', nonIndexed.attributes.normal);
  geom.setAttribute('uv', nonIndexed.attributes.uv);

  const pos = new THREE.Vector3();
  const norm = new THREE.Vector3();
  const tempNorm = new THREE.Vector3();
  const box = new THREE.Vector3(width, height, depth).divideScalar(2).subScalar(radius);

  const positions = geom.attributes.position.array;
  const normals = geom.attributes.normal.array;
  const uvs = geom.attributes.uv.array;

  const faceTris = positions.length / 6;
  const faceDir = new THREE.Vector3();
  const halfSeg = 0.5 / segments;

  function calcUv(fDir, n, uvAxis, projAxis, r, sideLen) {
    const totArc = 2 * Math.PI * r / 4;
    const centerLen = Math.max(sideLen - 2 * r, 0);
    const halfArc = Math.PI / 4;
    tempNorm.copy(n);
    tempNorm[projAxis] = 0;
    tempNorm.normalize();
    const arcUvRatio = 0.5 * totArc / (totArc + centerLen);
    const arcAngleRatio = 1.0 - (tempNorm.angleTo(fDir) / halfArc);
    if (Math.sign(tempNorm[uvAxis]) === 1) {
      return arcAngleRatio * arcUvRatio;
    } else {
      const lenUv = centerLen / (totArc + centerLen);
      return lenUv + arcUvRatio + arcUvRatio * (1.0 - arcAngleRatio);
    }
  }

  for (let i = 0, j = 0; i < positions.length; i += 3, j += 2) {
    pos.fromArray(positions, i);
    norm.copy(pos);
    norm.x -= Math.sign(norm.x) * halfSeg;
    norm.y -= Math.sign(norm.y) * halfSeg;
    norm.z -= Math.sign(norm.z) * halfSeg;
    norm.normalize();

    positions[i + 0] = box.x * Math.sign(pos.x) + norm.x * radius;
    positions[i + 1] = box.y * Math.sign(pos.y) + norm.y * radius;
    positions[i + 2] = box.z * Math.sign(pos.z) + norm.z * radius;

    normals[i + 0] = norm.x;
    normals[i + 1] = norm.y;
    normals[i + 2] = norm.z;

    const side = Math.floor(i / faceTris);
    switch (side) {
      case 0: // right
        faceDir.set(1, 0, 0);
        uvs[j + 0] = calcUv(faceDir, norm, 'z', 'y', radius, depth);
        uvs[j + 1] = 1.0 - calcUv(faceDir, norm, 'y', 'z', radius, height);
        break;
      case 1: // left
        faceDir.set(-1, 0, 0);
        uvs[j + 0] = 1.0 - calcUv(faceDir, norm, 'z', 'y', radius, depth);
        uvs[j + 1] = 1.0 - calcUv(faceDir, norm, 'y', 'z', radius, height);
        break;
      case 2: // top
        faceDir.set(0, 1, 0);
        uvs[j + 0] = 1.0 - calcUv(faceDir, norm, 'x', 'z', radius, width);
        uvs[j + 1] = calcUv(faceDir, norm, 'z', 'x', radius, depth);
        break;
      case 3: // bottom
        faceDir.set(0, -1, 0);
        uvs[j + 0] = 1.0 - calcUv(faceDir, norm, 'x', 'z', radius, width);
        uvs[j + 1] = 1.0 - calcUv(faceDir, norm, 'z', 'x', radius, depth);
        break;
      case 4: // front
        faceDir.set(0, 0, 1);
        uvs[j + 0] = 1.0 - calcUv(faceDir, norm, 'x', 'y', radius, width);
        uvs[j + 1] = 1.0 - calcUv(faceDir, norm, 'y', 'x', radius, height);
        break;
      case 5: // back
        faceDir.set(0, 0, -1);
        uvs[j + 0] = calcUv(faceDir, norm, 'x', 'y', radius, width);
        uvs[j + 1] = 1.0 - calcUv(faceDir, norm, 'y', 'x', radius, height);
        break;
    }
  }

  geom.attributes.position.needsUpdate = true;
  geom.attributes.normal.needsUpdate = true;
  geom.attributes.uv.needsUpdate = true;
  return geom;
}

function buildCuboidGeometry(width, height, depth, smoothnessPercent) {
  const maxRadius = Math.min(width, height, depth) / 2;
  const radius = (Math.max(0, Math.min(100, smoothnessPercent)) / 100) * maxRadius * 0.92;

  if (radius <= 0.02) {
    return new THREE.BoxGeometry(width, height, depth);
  }
  return createRoundedBoxGeometry(width, height, depth, 4, radius);
}

function buildCuboidMesh(cObj) {
  // Clear any existing child mesh
  while (cObj.group.children.length > 0) {
    const child = cObj.group.children[0];
    if (child.geometry) child.geometry.dispose();
    cObj.group.remove(child);
  }

  const geo = buildCuboidGeometry(cObj.width, cObj.height, cObj.depth, cObj.smoothness);
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color: cObj.texture ? 0xffffff : new THREE.Color(cObj.color),
    map: cObj.texture || null,
    roughness: 0.28,
    metalness: 0.12,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  cObj.mesh = mesh;
  cObj.material = mat;
  cObj.group.add(mesh);

  cObj.group.position.set(cObj.position.x, cObj.position.y, cObj.position.z);
  cObj.group.rotation.set(
    (cObj.rotation.x * Math.PI) / 180,
    (cObj.rotation.y * Math.PI) / 180,
    (cObj.rotation.z * Math.PI) / 180
  );

  prepareMeshShadows(cObj.group);
}

function updateSelectedCuboid(rebuildGeo = true) {
  const cObj = getSelectedCuboid();
  if (!cObj || !cObj.group) return;

  if (rebuildGeo) {
    buildCuboidMesh(cObj);
  } else {
    // Fast update for color/material/transform
    if (cObj.material) {
      if (cObj.texture) {
        cObj.material.map = cObj.texture;
        cObj.material.color.set(0xffffff);
      } else {
        cObj.material.map = null;
        cObj.material.color.set(cObj.color);
      }
      cObj.material.needsUpdate = true;
    }
    cObj.group.position.set(cObj.position.x, cObj.position.y, cObj.position.z);
    cObj.group.rotation.set(
      (cObj.rotation.x * Math.PI) / 180,
      (cObj.rotation.y * Math.PI) / 180,
      (cObj.rotation.z * Math.PI) / 180
    );
  }
}

function updateCuboidSelectOptions() {
  if (!cuboidSelect) return;
  cuboidSelect.innerHTML = '';

  if (cuboid3dRegistry.length === 0) {
    if (cuboidObjectCtrls) cuboidObjectCtrls.style.display = 'none';
    if (cuboidStatusInfo) cuboidStatusInfo.textContent = 'No active cuboids. Click "+ Add New Cuboid" above!';
    return;
  }

  if (cuboidObjectCtrls) cuboidObjectCtrls.style.display = 'block';
  if (cuboidStatusInfo) cuboidStatusInfo.textContent = '';

  cuboid3dRegistry.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    if (c.id === selectedCuboidId) opt.selected = true;
    cuboidSelect.appendChild(opt);
  });
}

function updateCuboidSliderUI() {
  const c = getSelectedCuboid();
  if (!c) return;

  if (cuboidWidthSlider) cuboidWidthSlider.value = c.width;
  if (cuboidWidthVal) cuboidWidthVal.textContent = `${c.width}m`;

  if (cuboidHeightSlider) cuboidHeightSlider.value = c.height;
  if (cuboidHeightVal) cuboidHeightVal.textContent = `${c.height}m`;

  if (cuboidDepthSlider) cuboidDepthSlider.value = c.depth;
  if (cuboidDepthVal) cuboidDepthVal.textContent = `${c.depth}m`;

  if (cuboidSmoothnessSlider) cuboidSmoothnessSlider.value = c.smoothness;
  if (cuboidSmoothnessVal) {
    const s = c.smoothness;
    cuboidSmoothnessVal.textContent = s === 0 ? '0% (Sharp)' : `${s}%`;
  }

  if (cuboidColorPicker) cuboidColorPicker.value = c.color;
  if (cuboidColorHex) cuboidColorHex.textContent = c.color.toUpperCase();

  // Swatches active class
  cuboidSwatchBtns.forEach((btn) => {
    if (btn.dataset.color.toLowerCase() === c.color.toLowerCase()) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Texture controls
  if (btnClearCuboidImg) {
    btnClearCuboidImg.style.display = c.texture ? 'block' : 'none';
  }

  if (cuboidPosXSlider) cuboidPosXSlider.value = c.position.x;
  if (cuboidPosXVal) cuboidPosXVal.textContent = `${c.position.x}m`;

  if (cuboidPosYSlider) cuboidPosYSlider.value = c.position.y;
  if (cuboidPosYVal) cuboidPosYVal.textContent = `${c.position.y}m`;

  if (cuboidPosZSlider) cuboidPosZSlider.value = c.position.z;
  if (cuboidPosZVal) cuboidPosZVal.textContent = `${c.position.z}m`;

  if (cuboidRotYSlider) cuboidRotYSlider.value = c.rotation.y;
  if (cuboidRotYVal) cuboidRotYVal.textContent = `${c.rotation.y}°`;

  if (cuboidRotXSlider) cuboidRotXSlider.value = c.rotation.x;
  if (cuboidRotXVal) cuboidRotXVal.textContent = `${c.rotation.x}°`;
}

function createCuboid3DObject(customOptions = {}) {
  if (typeof pushHistoryState === 'function') pushHistoryState();

  cuboidCountIndex++;
  const id = `cuboid_${Date.now()}_${cuboidCountIndex}`;

  const defaultWidth = customOptions.width || 12;
  const defaultHeight = customOptions.height || 6;
  const defaultDepth = customOptions.depth || 8;

  const newCuboid = {
    id: id,
    name: `📦 Cuboid #${cuboidCountIndex}`,
    width: defaultWidth,
    height: defaultHeight,
    depth: defaultDepth,
    smoothness: customOptions.smoothness !== undefined ? customOptions.smoothness : 15,
    color: customOptions.color || '#06b6d4',
    texture: null,
    textureDataUrl: null,
    position: customOptions.position || {
      x: 5,
      y: Number((defaultHeight / 2).toFixed(1)),
      z: 115,
    },
    rotation: customOptions.rotation || { x: 0, y: 25, z: 0 },
    group: new THREE.Group(),
  };

  buildCuboidMesh(newCuboid);
  scene.add(newCuboid.group);

  cuboid3dRegistry.push(newCuboid);
  selectedCuboidId = id;

  updateCuboidSelectOptions();
  updateCuboidSliderUI();

  if (cuboidStatusInfo) {
    cuboidStatusInfo.textContent = `✓ "${newCuboid.name}" spawned in 3D!`;
    setTimeout(() => {
      if (cuboidStatusInfo) cuboidStatusInfo.textContent = '';
    }, 3500);
  }

  return newCuboid;
}

// Toggle Cuboid Studio Panel
if (cuboidStudioToggleBtn && cuboidStudioPanel) {
  const toggleCuboidStudio = () => {
    cuboidStudioPanel.classList.toggle('collapsed');
    cuboidStudioToggleBtn.textContent = cuboidStudioPanel.classList.contains('collapsed') ? '📦' : '−';
  };

  cuboidStudioToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleCuboidStudio();
  });

  if (cuboidStudioHeader) {
    cuboidStudioHeader.addEventListener('click', () => {
      toggleCuboidStudio();
    });
  }
}

if (btnAddCuboid) {
  btnAddCuboid.addEventListener('click', () => {
    const offsetIndex = cuboid3dRegistry.length;
    createCuboid3DObject({
      position: {
        x: 5 + (offsetIndex % 5) * 14,
        y: 3,
        z: 115 - Math.floor(offsetIndex / 5) * 12,
      },
    });
    if (cuboidStudioPanel && cuboidStudioPanel.classList.contains('collapsed')) {
      cuboidStudioPanel.classList.remove('collapsed');
      if (cuboidStudioToggleBtn) cuboidStudioToggleBtn.textContent = '−';
    }
  });
}

if (cuboidSelect) {
  cuboidSelect.addEventListener('change', (e) => {
    selectedCuboidId = e.target.value;
    updateCuboidSliderUI();
  });
}

if (btnDeleteCuboid) {
  btnDeleteCuboid.addEventListener('click', () => {
    const idx = cuboid3dRegistry.findIndex((c) => c.id === selectedCuboidId);
    if (idx === -1) return;

    if (typeof pushHistoryState === 'function') pushHistoryState();

    const cObj = cuboid3dRegistry[idx];
    scene.remove(cObj.group);
    if (cObj.mesh && cObj.mesh.geometry) cObj.mesh.geometry.dispose();
    if (cObj.material) cObj.material.dispose();

    cuboid3dRegistry.splice(idx, 1);
    selectedCuboidId = cuboid3dRegistry.length > 0 ? cuboid3dRegistry[0].id : null;

    updateCuboidSelectOptions();
    updateCuboidSliderUI();
  });
}

// Width, Height, Depth Sliders
if (cuboidWidthSlider) {
  cuboidWidthSlider.addEventListener('input', (e) => {
    const c = getSelectedCuboid();
    if (!c) return;
    c.width = parseFloat(e.target.value);
    if (cuboidWidthVal) cuboidWidthVal.textContent = `${c.width}m`;
    updateSelectedCuboid(true);
  });
}

if (cuboidHeightSlider) {
  cuboidHeightSlider.addEventListener('input', (e) => {
    const c = getSelectedCuboid();
    if (!c) return;
    c.height = parseFloat(e.target.value);
    c.position.y = Number((c.height / 2).toFixed(1));
    if (cuboidHeightVal) cuboidHeightVal.textContent = `${c.height}m`;
    if (cuboidPosYSlider) cuboidPosYSlider.value = c.position.y;
    if (cuboidPosYVal) cuboidPosYVal.textContent = `${c.position.y}m`;
    updateSelectedCuboid(true);
  });
}

if (cuboidDepthSlider) {
  cuboidDepthSlider.addEventListener('input', (e) => {
    const c = getSelectedCuboid();
    if (!c) return;
    c.depth = parseFloat(e.target.value);
    if (cuboidDepthVal) cuboidDepthVal.textContent = `${c.depth}m`;
    updateSelectedCuboid(true);
  });
}

// Border Smoothness Slider
if (cuboidSmoothnessSlider) {
  cuboidSmoothnessSlider.addEventListener('input', (e) => {
    const c = getSelectedCuboid();
    if (!c) return;
    c.smoothness = parseInt(e.target.value, 10);
    if (cuboidSmoothnessVal) {
      cuboidSmoothnessVal.textContent = c.smoothness === 0 ? '0% (Sharp)' : `${c.smoothness}%`;
    }
    updateSelectedCuboid(true);
  });
}

// Custom Color Picker
if (cuboidColorPicker) {
  cuboidColorPicker.addEventListener('input', (e) => {
    const c = getSelectedCuboid();
    if (!c) return;
    c.color = e.target.value;
    c.texture = null; // revert from image to solid color
    if (cuboidColorHex) cuboidColorHex.textContent = c.color.toUpperCase();
    cuboidSwatchBtns.forEach((b) => b.classList.remove('active'));
    if (btnClearCuboidImg) btnClearCuboidImg.style.display = 'none';
    updateSelectedCuboid(false);
  });
}

// 5 Trending Colors
cuboidSwatchBtns.forEach((btn) => {
  btn.addEventListener('click', (e) => {
    const color = e.target.dataset.color;
    if (!color) return;
    const c = getSelectedCuboid();
    if (!c) return;

    if (typeof pushHistoryState === 'function') pushHistoryState();

    c.color = color;
    c.texture = null;
    if (cuboidColorPicker) cuboidColorPicker.value = color;
    if (cuboidColorHex) cuboidColorHex.textContent = color.toUpperCase();

    cuboidSwatchBtns.forEach((b) => b.classList.remove('active'));
    e.target.classList.add('active');

    if (btnClearCuboidImg) btnClearCuboidImg.style.display = 'none';
    updateSelectedCuboid(false);
  });
});

// Image Upload on Faces
if (btnUploadCuboidImg && cuboidImageInput) {
  btnUploadCuboidImg.addEventListener('click', () => {
    cuboidImageInput.click();
  });

  cuboidImageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target.result;
      const texture = new THREE.TextureLoader().load(dataUrl, () => {
        texture.colorSpace = THREE.SRGBColorSpace;
        const c = getSelectedCuboid();
        if (!c) return;

        if (typeof pushHistoryState === 'function') pushHistoryState();

        c.texture = texture;
        c.textureDataUrl = dataUrl;
        if (btnClearCuboidImg) btnClearCuboidImg.style.display = 'block';
        updateSelectedCuboid(false);
      });
    };
    reader.readAsDataURL(file);
    cuboidImageInput.value = '';
  });
}

// Clear Image
if (btnClearCuboidImg) {
  btnClearCuboidImg.addEventListener('click', () => {
    const c = getSelectedCuboid();
    if (!c) return;

    if (typeof pushHistoryState === 'function') pushHistoryState();

    c.texture = null;
    c.textureDataUrl = null;
    btnClearCuboidImg.style.display = 'none';
    updateSelectedCuboid(false);
  });
}

// Transform Sliders (Position & Rotation)
if (cuboidPosXSlider) {
  cuboidPosXSlider.addEventListener('input', (e) => {
    const c = getSelectedCuboid();
    if (!c) return;
    c.position.x = parseFloat(e.target.value);
    if (cuboidPosXVal) cuboidPosXVal.textContent = `${c.position.x}m`;
    updateSelectedCuboid(false);
  });
}

if (cuboidPosYSlider) {
  cuboidPosYSlider.addEventListener('input', (e) => {
    const c = getSelectedCuboid();
    if (!c) return;
    c.position.y = parseFloat(e.target.value);
    if (cuboidPosYVal) cuboidPosYVal.textContent = `${c.position.y}m`;
    updateSelectedCuboid(false);
  });
}

if (cuboidPosZSlider) {
  cuboidPosZSlider.addEventListener('input', (e) => {
    const c = getSelectedCuboid();
    if (!c) return;
    c.position.z = parseFloat(e.target.value);
    if (cuboidPosZVal) cuboidPosZVal.textContent = `${c.position.z}m`;
    updateSelectedCuboid(false);
  });
}

if (cuboidRotYSlider) {
  cuboidRotYSlider.addEventListener('input', (e) => {
    const c = getSelectedCuboid();
    if (!c) return;
    c.rotation.y = parseFloat(e.target.value);
    if (cuboidRotYVal) cuboidRotYVal.textContent = `${c.rotation.y}°`;
    updateSelectedCuboid(false);
  });
}

if (cuboidRotXSlider) {
  cuboidRotXSlider.addEventListener('input', (e) => {
    const c = getSelectedCuboid();
    if (!c) return;
    c.rotation.x = parseFloat(e.target.value);
    if (cuboidRotXVal) cuboidRotXVal.textContent = `${c.rotation.x}°`;
    updateSelectedCuboid(false);
  });
}

// Slider Undo History Attachments
attachSliderHistory(cuboidWidthSlider);
attachSliderHistory(cuboidHeightSlider);
attachSliderHistory(cuboidDepthSlider);
attachSliderHistory(cuboidSmoothnessSlider);
attachSliderHistory(cuboidPosXSlider);
attachSliderHistory(cuboidPosYSlider);
attachSliderHistory(cuboidPosZSlider);
attachSliderHistory(cuboidRotYSlider);
attachSliderHistory(cuboidRotXSlider);

// Spawn an initial default cuboid on startup
createCuboid3DObject({
  width: 12,
  height: 6,
  depth: 8,
  smoothness: 15,
  color: '#06b6d4',
  position: { x: 5, y: 3, z: 115 },
  rotation: { x: 0, y: 25, z: 0 },
});
