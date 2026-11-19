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
camera.position.set(130, 80, 160);

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
controls.maxPolarAngle = Math.PI / 2 - 0.02; // Keep camera above ground
controls.minDistance = 5;
controls.maxDistance = 700;
controls.target.set(0, 15, 0); // Focus on city center

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
sunLight.shadow.camera.far = 700;
sunLight.shadow.camera.left = -200;
sunLight.shadow.camera.right = 200;
sunLight.shadow.camera.top = 200;
sunLight.shadow.camera.bottom = -200;
sunLight.shadow.bias = -0.0003;
scene.add(sunLight);

const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.8);
fillLight.position.set(-120, 90, -120);
scene.add(fillLight);

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

const terrainMeshes = [];

function switchGround(type) {
  const cfg = groundConfigs[type];
  if (!cfg || !loadedTextures[type]) return;

  const tex = loadedTextures[type];
  tex.needsUpdate = true;

  groundMat.map = tex;
  groundMat.color.setHex(cfg.color);
  groundMat.roughness = cfg.roughness;
  groundMat.metalness = cfg.metalness;
  groundMat.needsUpdate = true;

  terrainMeshes.forEach((mesh) => {
    mesh.material = groundMat;
    mesh.material.needsUpdate = true;
  });
}

// Minimal Mini Square Ground Box Switcher Handlers
const groundBoxes = document.querySelectorAll('.ground-box');
groundBoxes.forEach((btn) => {
  btn.addEventListener('click', () => {
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

// 8. Load 3D Castelia Skyscraper City Model with full vibrant colors & textures
if (loaderDetails) loaderDetails.textContent = 'Loading 3D Castelia Skyscraper City...';

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
    city.scale.set(scale, scale, scale);

    // Align city and terrain flush with the ground (no uplift / floating)
    city.position.x = -center.x * scale;
    city.position.y = 0.0;
    city.position.z = -center.z * scale;

    // Preserve and enhance all vibrant textures, and link terrain to ground material
    city.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;

        const matName = (child.material?.name || '').toLowerCase();
        const meshName = (child.name || '').toLowerCase();

        if (matName.includes('terrain') || meshName.includes('terrain') || matName === '_104') {
          child.material = groundMat;
          terrainMeshes.push(child);
        } else if (child.material) {
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
      }
    });

    scene.add(city);

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

  // Sun & Moon Directional Light
  sunLight.intensity = 0.2 + t * 2.0;
  sunLight.color.lerpColors(new THREE.Color(0x93c5fd), new THREE.Color(0xfffbeb), t);

  // Sunlight angle lowers smoothly towards horizon as dusk arrives
  const angle = (t * 0.35 + 0.15) * Math.PI;
  sunLight.position.set(Math.cos(angle) * 220, Math.sin(angle) * 240 + 20, 120);

  // Hemisphere Light (Sky & Ground)
  hemiLight.intensity = 0.15 + t * 1.05;
  hemiLight.color.lerpColors(new THREE.Color(0x1e293b), new THREE.Color(0xffffff), t);
  hemiLight.groundColor.lerpColors(new THREE.Color(0x0f172a), new THREE.Color(0x64748b), t);

  // Ambient Light
  ambientLight.intensity = 0.12 + t * 0.58;
  ambientLight.color.lerpColors(new THREE.Color(0x1e1b4b), new THREE.Color(0xffffff), t);

  // Fill Light
  fillLight.intensity = 0.08 + t * 0.72;

  // Atmospheric Fog: Midnight navy to soft daylight blue
  if (scene.fog) {
    scene.fog.color.lerpColors(new THREE.Color(0x030712), new THREE.Color(0xcce7ff), t);
  }

  // HDR Sky background & IBL environment reflections
  scene.backgroundIntensity = 0.08 + t * 0.92;
  scene.environmentIntensity = 0.15 + t * 0.85;

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
}

if (brightnessSlider) {
  brightnessSlider.addEventListener('input', (e) => {
    setBrightnessLevel(e.target.value);
  });
}

if (btnNight) {
  btnNight.addEventListener('click', () => {
    if (brightnessSlider) brightnessSlider.value = 0;
    setBrightnessLevel(0);
  });
}

if (btnDay) {
  btnDay.addEventListener('click', () => {
    if (brightnessSlider) brightnessSlider.value = 100;
    setBrightnessLevel(100);
  });
}

// Initial brightness setup (85% daylight)
setBrightnessLevel(85);

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
    dirButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentSkyDirection = btn.dataset.dir || 'E_W';
  });
});

// Mini Default Button: Resets sky to its original position with 0 speed
const btnResetSky = document.getElementById('btn-reset-sky');
if (btnResetSky) {
  btnResetSky.addEventListener('click', () => {
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

// 12. Animation Loop with Dynamic Sky & Reflection Movement
let frameCount = 0;
function animate() {
  requestAnimationFrame(animate);
  controls.update();

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
