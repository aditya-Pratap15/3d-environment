import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';

// DOM Elements
const canvas = document.querySelector('#webgl');
const loaderOverlay = document.querySelector('#loader');
const loaderProgress = document.querySelector('#loader-progress');
const loaderDetails = document.querySelector('#loader-details');

// 1. Scene Setup
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xbae6fd, 0.002);

// 2. Camera Setup
const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  2000
);
// Position overlooking the 3D skyscraper city
camera.position.set(120, 75, 160);

// 3. Renderer Setup
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
renderer.toneMappingExposure = 1.15;

// PMREM Generator for HDR Equirectangular Lighting
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

// 4. Orbit Controls (Movable, Zoom, Drag 360°)
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxPolarAngle = Math.PI / 2 - 0.02; // Keep camera above ground
controls.minDistance = 5;
controls.maxDistance = 600;
controls.target.set(0, 15, 0); // Focus on center of the city

// 5. Lighting
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x475569, 0.9);
hemiLight.position.set(0, 100, 0);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.8);
sunLight.position.set(150, 220, 100);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.near = 10;
sunLight.shadow.camera.far = 600;
sunLight.shadow.camera.left = -150;
sunLight.shadow.camera.right = 150;
sunLight.shadow.camera.top = 150;
sunLight.shadow.camera.bottom = -150;
sunLight.shadow.bias = -0.0002;
scene.add(sunLight);

const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.6);
fillLight.position.set(-100, 80, -100);
scene.add(fillLight);

// 6. Ground Plane
const groundGeo = new THREE.PlaneGeometry(1200, 1200);
const groundMat = new THREE.MeshStandardMaterial({
  color: 0x1e293b,
  roughness: 0.65,
  metalness: 0.2,
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
    if (loaderDetails) loaderDetails.textContent = 'Ready!';
    setTimeout(() => {
      if (loaderOverlay) loaderOverlay.classList.add('fade-out');
    }, 400);
  }
}

// 7. Load 4K HDR Sky (from user's HdriFree asset)
const rgbeLoader = new RGBELoader();
if (loaderDetails) loaderDetails.textContent = 'Loading 4K Sky Environment...';

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
    console.warn('Fallback procedural sky:', err);
    scene.background = new THREE.Color(0x38bdf8);
    skyLoaded = true;
    checkLoadingDone();
  }
);

// 8. Load 3D Castelia Skyscraper City Model (from user's Castelia-City asset)
if (loaderDetails) loaderDetails.textContent = 'Loading 3D Castelia Skyscraper City...';

const mtlLoader = new MTLLoader();
mtlLoader.setPath('./models/castelia/OBJ/');
mtlLoader.load(
  'Castelia City.mtl',
  (materials) => {
    materials.preload();
    const objLoader = new OBJLoader();
    objLoader.setMaterials(materials);
    objLoader.setPath('./models/castelia/OBJ/');
    objLoader.load(
      'Castelia City.obj',
      (obj) => {
        // Compute bounding box to center the city perfectly
        const box = new THREE.Box3().setFromObject(obj);
        const center = box.getCenter(new THREE.Vector3());

        // Scale factor: original model is ~273,000 units wide -> 0.0012 makes it ~327m wide
        const scale = 0.0012;
        obj.scale.set(scale, scale, scale);

        // Center on ground
        obj.position.x = -center.x * scale;
        obj.position.y = -box.min.y * scale;
        obj.position.z = -center.z * scale;

        obj.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
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
            loaderDetails.textContent = `Loading 3D City: ${mbLoaded}MB / ${mbTotal}MB (${pct}%)`;
          }
        }
      },
      (err) => {
        console.error('Error loading OBJ:', err);
        modelLoaded = true;
        checkLoadingDone();
      }
    );
  },
  undefined,
  (err) => {
    // If MTL fails, load OBJ with fallback materials
    console.warn('MTL load issue, loading OBJ directly:', err);
    const objLoader = new OBJLoader();
    objLoader.load(
      './models/castelia/OBJ/Castelia City.obj',
      (obj) => {
        const cityMat = new THREE.MeshStandardMaterial({
          color: 0x334155,
          roughness: 0.65,
          metalness: 0.25,
        });
        const box = new THREE.Box3().setFromObject(obj);
        const center = box.getCenter(new THREE.Vector3());
        const scale = 0.0012;
        obj.scale.set(scale, scale, scale);
        obj.position.x = -center.x * scale;
        obj.position.y = -box.min.y * scale;
        obj.position.z = -center.z * scale;
        obj.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            child.material = cityMat;
          }
        });
        scene.add(obj);
        modelLoaded = true;
        checkLoadingDone();
      }
    );
  }
);

// 9. Window Resize
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
