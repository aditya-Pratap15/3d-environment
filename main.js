import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

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
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x475569, 0.9);
hemiLight.position.set(0, 150, 0);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight(0xfffbeb, 2.0);
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

const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.7);
fillLight.position.set(-120, 90, -120);
scene.add(fillLight);

// 6. Ground Plane (Clean reflective asphalt / plaza floor)
const groundGeo = new THREE.PlaneGeometry(1500, 1500);
const groundMat = new THREE.MeshStandardMaterial({
  color: 0x1e293b,
  roughness: 0.5,
  metalness: 0.3,
});
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.1;
ground.receiveShadow = true;
scene.add(ground);

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

// 7. Load 4K HDR Sky (from user's HdriFree asset)
if (loaderDetails) loaderDetails.textContent = 'Loading 4K Sky Environment...';

const rgbeLoader = new RGBELoader();
rgbeLoader.load(
  './hdri/FluffballDay4k.hdr',
  (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = texture;
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
    scene.background = new THREE.Color(0x7dd3fc);
    skyLoaded = true;
    checkLoadingDone();
  }
);

// 8. Load 3D Castelia Skyscraper City Model
if (loaderDetails) loaderDetails.textContent = 'Loading 3D Castelia Skyscraper City...';

// High-end PBR materials for buildings: reflective glass & architectural facades
const buildingBodyMat = new THREE.MeshStandardMaterial({
  color: 0x334155,
  roughness: 0.45,
  metalness: 0.5,
});

const buildingGlassMat = new THREE.MeshStandardMaterial({
  color: 0x1e3a8a,
  roughness: 0.1,
  metalness: 0.9,
});

const buildingTrimMat = new THREE.MeshStandardMaterial({
  color: 0x94a3b8,
  roughness: 0.2,
  metalness: 0.8,
});

const objLoader = new OBJLoader();
objLoader.load(
  './models/castelia/OBJ/Castelia City.obj',
  (obj) => {
    // Calculate bounding box and scale
    const box = new THREE.Box3().setFromObject(obj);
    const center = box.getCenter(new THREE.Vector3());

    // Scale: original is ~273,000 units wide -> 0.0012 makes it ~327 meters wide
    const scale = 0.0012;
    obj.scale.set(scale, scale, scale);

    // Center on ground
    obj.position.x = -center.x * scale;
    obj.position.y = -box.min.y * scale;
    obj.position.z = -center.z * scale;

    // Apply materials and shadow settings
    obj.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        // Distribute materials for realistic architectural variation
        const name = (child.name || '').toLowerCase();
        if (name.includes('window') || name.includes('glass')) {
          child.material = buildingGlassMat;
        } else if (name.includes('metal') || name.includes('roof')) {
          child.material = buildingTrimMat;
        } else {
          child.material = buildingBodyMat;
        }
      }
    });

    scene.add(obj);

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
    console.error('Error loading OBJ:', err);
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

// 10. Animation Loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

animate();
