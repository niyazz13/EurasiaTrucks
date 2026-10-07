import * as THREE from 'three';
import { GLTFLoader } from 'https://unpkg.com';

// =========================================================================
// ⚙️ ПОЛНАЯ КОНФИГУРАЦИЯ ИГРЫ
// =========================================================================
const TRUCK_CATALOG = [
    { id: "kamaz", name: "KamAZ 54901 Neo 🇷🇺", price: 0, maxSpeed: 1.5, fuelTank: 100, modelPath: "models/kamaz.glb", color: '#dc2626' },
    { id: "scania", name: "Scania S730 V8 King 🇸🇪", price: 2800, maxSpeed: 2.1, fuelTank: 140, modelPath: "models/scania.glb", color: '#2563eb' }
];

const TRAILER_CATALOG = [
    { id: "flatbed", name: "Шторный Тент Schmitz 📑", price: 0, type: "Standard", modelPath: "models/schmitz.glb", desc: "Для обычных грузов" }
];

const CARGO_DATABASE = [
    { name: "Свежие Яблоки в Берлин 🍏", pay: 600, reqType: "Standard", weight: "8 т" }
];

const SETTINGS = {
    fuelUsageSpeed: 0.005,
    crashDamagePercent: 5,
    repairCost: 120,
    refuelCost: 50,
    maxTrafficCars: 12,
    roadWorksChance: 0.10,
    trafficUpdateInterval: 4000
};

// =========================================================================
// ИНИЦИАЛИЗАЦИЯ ДВИЖКА
// =========================================================================
const canvas = document.getElementById('gameCanvas');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 3500);
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

scene.add(new THREE.HemisphereLight('#ffffff', '#0f172a', 0.6));
const sunLight = new THREE.DirectionalLight('#fffbeb', 1.2); sunLight.castShadow = true; scene.add(sunLight);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000), new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.85 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

const loader3D = new GLTFLoader();
let colliders = [], isCompanyRegistered = true, trafficCars = [];

let companyData = {
    name: "Транспортная Компания", logo: "🚚", balance: 5000, hasOrder: false, payout: 0,
    ownedTrucks: ["kamaz"], ownedTrailers: ["flatbed"], selectedTruckId: "kamaz", selectedTrailerId: "flatbed",
    truckStats: { fuel: 100, condition: 100 }, hiredDrivers: []
};

const truckGroup = new THREE.Group(); scene.add(truckGroup);
const truckPhysics = { speed: 0, acceleration: 0.025, deceleration: 0.02, rotationSpeed: 0.032, radius: 1.6, angle: 0 };
let gpsArrowMesh;

// Глобальные привязки
window.selectTruck = function(id) { companyData.selectedTruckId = id; buildComposition3D(); };
window.buyTruck = function(id, price) { if(companyData.balance >= price) { companyData.balance -= price; companyData.ownedTrucks.push(id); } };

function buildComposition3D() {
    while(truckGroup.children.length > 0) { truckGroup.remove(truckGroup.children); }
    const truckConfig = TRUCK_CATALOG.find(t => t.id === companyData.selectedTruckId);
    
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.5, 2.4), new THREE.MeshStandardMaterial({ color: truckConfig.color, roughness: 0.15, metalness: 0.6 }));
    cabin.position.set(0, 1.4, -1.6); cabin.castShadow = true; truckGroup.add(cabin);

    const backupTrailer = new THREE.Mesh(new THREE.BoxGeometry(2.3, 2.8, 6.4), new THREE.MeshStandardMaterial({ color: '#f1f5f9', roughness: 0.4 }));
    backupTrailer.position.set(0, 1.6, 3.2); backupTrailer.castShadow = true; truckGroup.add(backupTrailer);
}

function updateTrafficCarsAI() {
    trafficCars.forEach((car, index) => {
        const stepX = Math.sin(car.angle) * car.speed; const stepZ = Math.cos(car.angle) * car.speed;
        car.mesh.position.x += stepX; car.mesh.position.z += stepZ;
        if (car.mesh.position.distanceTo(truckGroup.position) > 300) { scene.remove(car.mesh); trafficCars.splice(index, 1); }
    });
    if (trafficCars.length < SETTINGS.maxTrafficCars && Math.random() > 0.95) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 3.2), new THREE.MeshStandardMaterial({ color: '#4b5563' }));
        mesh.position.set(truckGroup.position.x + (Math.random()-0.5)*150, 0.6, truckGroup.position.z + (Math.random()-0.5)*150);
        scene.add(mesh); trafficCars.push({ mesh, speed: 0.5, angle: Math.random()*Math.PI*2 });
    }
}

const keys = { w: false, a: false, s: false, d: false };
window.addEventListener('keydown', (e) => { const c = e.code.toLowerCase(); if (c === 'keyw') keys.w = true; if (c === 'keya') keys.a = true; if (c === 'keys') keys.s = true; if (c === 'keyd') keys.d = true; });
window.addEventListener('keyup', (e) => { const c = e.code.toLowerCase(); if (c === 'keyw') keys.w = false; if (c === 'keya') keys.a = false; if (c === 'keys') keys.s = false; if (c === 'keyd') keys.d = false; });

buildComposition3D();

function gameLoop() {
    requestAnimationFrame(gameLoop);
    
    if (keys.w) truckPhysics.speed = THREE.MathUtils.lerp(truckPhysics.speed, 1.5, truckPhysics.acceleration);
    else if (keys.s) truckPhysics.speed = THREE.MathUtils.lerp(truckPhysics.speed, -0.5, truckPhysics.acceleration);
    else truckPhysics.speed = THREE.MathUtils.lerp(truckPhysics.speed, 0, truckPhysics.deceleration);

    if (Math.abs(truckPhysics.speed) > 0.05) {
        if (keys.a) truckPhysics.angle += truckPhysics.rotationSpeed;
        if (keys.d) truckPhysics.angle -= truckPhysics.rotationSpeed;
    }

    truckGroup.position.x += Math.sin(truckPhysics.angle) * truckPhysics.speed;
    truckGroup.position.z += Math.cos(truckPhysics.angle) * truckPhysics.speed;
    truckGroup.rotation.y = truckPhysics.angle;

    updateTrafficCarsAI();

    camera.position.set(truckGroup.position.x, truckGroup.position.y + 65, truckGroup.position.z + 40);
    camera.lookAt(truckGroup.position.x, truckGroup.position.y, truckGroup.position.z);

    renderer.render(scene, camera);
}
gameLoop();
