import * as THREE from 'three';
import { GLTFLoader } from 'https://unpkg.com';
// Исправлены пути импорта для совместимости с GitHub Pages
import { TRUCK_CATALOG, TRAILER_CATALOG, CARGO_DATABASE, SETTINGS } from './config.js';
import { initAudioEngine, updateMotorSound, playBrakeSqueal, playTrafficHorn } from './audio.js';
import { updateTrafficCarsAI } from './traffic.js';

const canvas = document.getElementById('gameCanvas');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 3500);
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const hemiLight = new THREE.HemisphereLight('#ffffff', '#0f172a', 0.6); scene.add(hemiLight);
const sunLight = new THREE.DirectionalLight('#fffbeb', 1.2); sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 1024; sunLight.shadow.mapSize.height = 1024;
const d = 250; sunLight.shadow.camera.left = -d; sunLight.shadow.camera.right = d;
sunLight.shadow.camera.top = d; sunLight.shadow.camera.bottom = -d; sunLight.shadow.camera.far = 1000;
scene.add(sunLight);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000), new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.85 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

const loader3D = new GLTFLoader();
let colliders = [], dayTime = 0.25, isCompanyRegistered = false, trafficCars = [], roadWorksObstacles = [], borderCheckpoints = [];

let companyData = {
    name: "Транспортная Компания", logo: "🚚", balance: 5000, hasOrder: false, payout: 0, activeCargo: null,
    ownedTrucks: ["kamaz"], ownedTrailers: ["flatbed"], selectedTruckId: "kamaz", selectedTrailerId: "flatbed",
    truckStats: { fuel: 100, condition: 100 }, hiredDrivers: [],
    documents: { cargoName: "Нет груза", weight: "0 т", adrClass: "Нет", legalStatus: "Легальный" }
};

let cameraZoom = { current: 65, min: 15, max: 180, target: 65, speed: 0.08 };
const truckGroup = new THREE.Group(); scene.add(truckGroup);
const truckPhysics = { speed: 0, acceleration: 0.025, deceleration: 0.02, rotationSpeed: 0.032, radius: 1.6, angle: 0 };
let gpsArrowMesh, cargoHubMarker, destinationHubMarker, gasStationMarker, stoServiceMarker;

let currentLat = 48.8584; let currentLon = 2.2945;
const latToMeters = 111132; const lonToMeters = 73000;
let currentCountry = "Франция 🇫🇷";
let cargoCoords = { x: 50, z: -40 }, destCoords = { x: -300, z: -250 }, gasCoords = { x: -60, z: -100 }, stoCoords = { x: 100, z: -20 };

function saveGameProgress() {
    if (!isCompanyRegistered) return;
    localStorage.setItem('eurasia_tycoon_save', JSON.stringify({
        name: companyData.name, logo: companyData.logo, balance: companyData.balance,
        ownedTrucks: companyData.ownedTrucks, ownedTrailers: companyData.ownedTrailers,
        selectedTruckId: companyData.selectedTruckId, selectedTrailerId: companyData.selectedTrailerId,
        truckStats: companyData.truckStats, hiredDrivers: companyData.hiredDrivers
    }));
}

function loadGameProgress() {
    const rawData = localStorage.getItem('eurasia_tycoon_save'); if (!rawData) return false;
    try {
        companyData = { ...companyData, ...JSON.parse(rawData) }; isCompanyRegistered = true;
        const overlay = document.getElementById('registration-overlay'); if (overlay) overlay.style.display = 'none';
        document.getElementById('hudCompanyName').innerText = `${companyData.logo} ${companyData.name}`;
        return true;
    } catch(e) { return false; }
}

function buildComposition3D() {
    while(truckGroup.children.length > 0) { truckGroup.remove(truckGroup.children); }
    const truckConfig = TRUCK_CATALOG.find(t => t.id === companyData.selectedTruckId);
    
    loader3D.load(truckConfig.modelPath, (gltf) => {
        const m = gltf.scene; m.scale.set(1.2, 1.2, 1.2); m.traverse(c => { if(c.isMesh) { c.castShadow = true; c.receiveShadow = true; } }); truckGroup.add(m);
    }, undefined, () => {
        const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.5, 2.4), new THREE.MeshStandardMaterial({ color: truckConfig.color, roughness: 0.15, metalness: 0.6 }));
        cabin.position.set(0, 1.4, -1.6); cabin.castShadow = true; truckGroup.add(cabin);
    });

    const trailerConfig = TRAILER_CATALOG.find(t => t.id === companyData.selectedTrailerId);
    loader3D.load(trailerConfig.modelPath, (gltf) => {
        const m = gltf.scene; m.scale.set(1.2, 1.2, 1.2); m.position.set(0, 0, 3.2); m.traverse(c => { if(c.isMesh) { c.castShadow = true; c.receiveShadow = true; } }); truckGroup.add(m);
    }, undefined, () => {
        const backupTrailer = new THREE.Mesh(new THREE.BoxGeometry(2.3, 2.8, 6.4), new THREE.MeshStandardMaterial({ color: '#f1f5f9', roughness: 0.4 }));
        backupTrailer.position.set(0, 1.6, 3.2); backupTrailer.castShadow = true; truckGroup.add(backupTrailer);
    });

    document.getElementById('hudTruckName').innerText = truckConfig.name;
    document.getElementById('hudTrailerName').innerText = trailerConfig.name;
}

function updateShopMenusUI() {
    document.getElementById('balanceVal').innerText = `$${companyData.balance.toLocaleString()}`;
    document.getElementById('garageCount').innerText = `${companyData.ownedTrucks.length} тяг. / ${companyData.ownedTrailers.length} приц.`;

    const garageList = document.getElementById('garageList'); garageList.innerHTML = "";
    TRUCK_CATALOG.forEach(t => {
        if (companyData.ownedTrucks.includes(t.id)) {
            const div = document.createElement('div'); div.className = "shop-item-card";
            div.innerHTML = `<div class="card-info"><b>${t.name}</b></div><button class="buy-card-btn" ${companyData.selectedTruckId === t.id ? 'disabled':''}>Взять</button>`;
            div.querySelector('button').addEventListener('click', () => window.selectTruck(t.id)); garageList.appendChild(div);
        }
    });

    const h3 = document.createElement('h3'); h3.innerText = "Персонал"; h3.className = "section-title"; garageList.appendChild(h3);
    if(companyData.hiredDrivers.length < companyData.ownedTrucks.length - 1) {
        const hireDiv = document.createElement('div'); hireDiv.style.pointerEvents = "auto";
        hireDiv.innerHTML = `<button class="action-btn">Нанять водителя-NPC ($-600)</button>`;
        hireDiv.querySelector('button').addEventListener('click', () => window.hireNpcDriver()); garageList.appendChild(hireDiv);
    }
    companyData.hiredDrivers.forEach((drv, i) => {
        const div = document.createElement('div'); div.className = "shop-item-card";
        div.innerHTML = `<div class="card-info"><b>Водитель #${i+1}</b></div><span style="color:#10b981; font-weight:bold;">+$${drv.income}/мин</span>`;
        garageList.appendChild(div);
    });

    const tList = document.getElementById('truckShopList'); tList.innerHTML = "";
    TRUCK_CATALOG.forEach(t => {
        const bought = companyData.ownedTrucks.includes(t.id); const div = document.createElement('div'); div.className = "shop-item-card";
        div.innerHTML = `<div class="card-info"><b>${t.name}</b></div><button class="buy-card-btn" ${bought?'disabled':''}>${bought?'Куплен':'$'+t.price}</button>`;
        if(!bought) div.querySelector('button').addEventListener('click', () => window.buyTruck(t.id, t.price)); tList.appendChild(div);
    });
}

// Привязываем функции к глобальному объекту window, чтобы HTML кнопки их «видели»
window.buyTruck = function(id, price) { if (companyData.balance >= price) { companyData.balance -= price; companyData.ownedTrucks.push(id); updateShopMenusUI(); saveGameProgress(); } };
window.buyTrailer = function(id, price) { if (companyData.balance >= price) { companyData.balance -= price; companyData.ownedTrailers.push(id); updateShopMenusUI(); saveGameProgress(); } };
window.selectTruck = function(id) { companyData.selectedTruckId = id; buildComposition3D(); updateShopMenusUI(); saveGameProgress(); };
window.selectTrailer = function(id) { if(companyData.hasOrder) return; companyData.selectedTrailerId = id; buildComposition3D(); updateShopMenusUI(); saveGameProgress(); };
window.hireNpcDriver = function() { if (companyData.balance >= 600) { companyData.balance -= 600; companyData.hiredDrivers.push({ id: Date.now(), income: 180 + Math.floor(Math.random()*100) }); updateShopMenusUI(); saveGameProgress(); } };

setInterval(() => {
    if(!isCompanyRegistered || companyData.hiredDrivers.length === 0) return;
    let profit = 0; companyData.hiredDrivers.forEach(d => profit += Math.floor(d.income / 2));
    companyData.balance += profit; updateShopMenusUI(); saveGameProgress();
}, 30000);

function updateCountryBorderLogic(x, z) {
    if (x < -180 && z > -100) currentCountry = "Франция 🇫🇷";
    else if (x >= -180 && x < 120 && z < -80) currentCountry = "Германия 🇩🇪";
    else if (x >= 120 && z < -50) currentCountry = "Польша 🇵🇱";
    else currentCountry = "Международная магистраль 🌍";
    document.getElementById('countryVal').innerText = currentCountry;
}

function spawnBorderCheckpoints() {
    const kppGroup = new THREE.Group(); kppGroup.position.set(-180, 0, -150);
    const booth = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 8), new THREE.MeshStandardMaterial({ color: '#475569' })); booth.position.y = 2; kppGroup.add(booth);
    const barrier = new THREE.Mesh(new THREE.BoxGeometry(12, 0.3, 0.3), new THREE.MeshBasicMaterial({ color: '#eab308' })); barrier.position.set(-6, 2, -12); kppGroup.add(barrier);
const customsZone = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 0.2, 16), new THREE.MeshBasicMaterial({ color: '#ef4444', transparent: true, opacity: 0.3 })); customsZone.position.set(0, 0.1, -12); kppGroup.add(customsZone);
scene.add(kppGroup); colliders.push(new THREE.Box3().setFromObject(booth));
borderCheckpoints.push({ position: new THREE.Vector3(-180, 0, -162), radius: 8.0, barrierMesh: barrier, zoneMesh: customsZone, isCleared: false, timer: 0 });
}
function updateCustomsControl() {
borderCheckpoints.forEach(kpp => {
const dist = truckGroup.position.distanceTo(kpp.position);
if (dist < kpp.radius) {
if (companyData.hasOrder && !kpp.isCleared) {
document.getElementById('customsStatus').innerText = "ДОСМОТР ТД... 📄";
truckPhysics.speed = THREE.MathUtils.lerp(truckPhysics.speed, 0, 0.2); kpp.timer += 1;
if (kpp.timer > 100) {
alert("📋 Таможенный контроль успешно пройден. Проезд открыт!"); kpp.isCleared = true; kpp.barrierMesh.rotation.z = Math.PI / 2.5; kpp.zoneMesh.material.color.set('#22c55e');
}
} else if (!companyData.hasOrder) { kpp.isCleared = true; kpp.barrierMesh.rotation.z = Math.PI / 2.5; kpp.zoneMesh.material.color.set('#22c55e'); }
} else if (dist > kpp.radius + 15 && kpp.isCleared) {
kpp.isCleared = false; kpp.timer = 0; kpp.barrierMesh.rotation.z = 0; kpp.zoneMesh.material.color.set('#ef4444');
}
});
}
function initLogisticsMarkers() {
gpsArrowMesh = new THREE.Mesh(new THREE.ConeGeometry(0.6, 2.5, 4), new THREE.MeshBasicMaterial({ color: '#38bdf8', depthTest: false }));
gpsArrowMesh.geometry.rotateX(Math.PI/2); scene.add(gpsArrowMesh);
cargoHubMarker = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 0.5, 16), new THREE.MeshBasicMaterial({ color: '#f59e0b', transparent: true, opacity: 0.5 })); cargoHubMarker.position.set(cargoCoords.x, 0.1, cargoCoords.z); scene.add(cargoHubMarker);
destinationHubMarker = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 0.5, 16), new THREE.MeshBasicMaterial({ color: '#22c55e', transparent: true, opacity: 0.0 })); destinationHubMarker.position.set(destCoords.x, 0.1, destCoords.z); scene.add(destinationHubMarker);
gasStationMarker = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.5, 12), new THREE.MeshBasicMaterial({ color: '#ea580c', transparent: true, opacity: 0.4 })); gasStationMarker.position.set(gasCoords.x, 0.1, gasCoords.z); scene.add(gasStationMarker);
stoServiceMarker = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.5, 12), new THREE.MeshBasicMaterial({ color: '#dc2626', transparent: true, opacity: 0.4 })); stoServiceMarker.position.set(stoCoords.x, 0.1, stoCoords.z); scene.add(stoServiceMarker);
}
function processLogisticsLogic() {
const distToCargo = truckGroup.position.distanceTo(new THREE.Vector3(cargoCoords.x, truckGroup.position.y, cargoCoords.z));
const distToDest = truckGroup.position.distanceTo(new THREE.Vector3(destCoords.x, truckGroup.position.y, destCoords.z));
const currentTrailer = TRAILER_CATALOG.find(t => t.id === companyData.selectedTrailerId);
if (!companyData.hasOrder && distToCargo < 6.0) {
const contract = CARGO_DATABASE[Math.floor(Math.random() * CARGO_DATABASE.length)];
companyData.hasOrder = true; companyData.payout = contract.pay; companyData.activeCargo = contract;
document.getElementById('docCmr').innerText = Оформлен полуприцеп | ${contract.weight};
document.getElementById('cargoVal').innerText = contract.name;
document.getElementById('taskVal').innerText = "Везти по стрелке GPS!";
cargoHubMarker.material.opacity = 0.0; destinationHubMarker.material.opacity = 0.5;
alert(📄 Инвойс выдан. Маршрут построен.);
}
if (companyData.hasOrder && distToDest < 6.0) {
companyData.balance += companyData.payout; resetCurrentCargo(); updateShopMenusUI(); saveGameProgress();
alert(💰 Заказ выполнен! На баланс зачислено +$${companyData.payout});
}
}
function resetCurrentCargo() { companyData.hasOrder = false; cargoHubMarker.material.opacity = 0.5; destinationHubMarker.material.opacity = 0.0; document.getElementById('cargoVal').innerText = "Пусто 🚫"; document.getElementById('docCmr').innerText = "Отсутствует"; }
let loadedChunks = new Set();
async function loadRealOSMData(lat, lon) {
const offset = 0.005; const minLat = lat - offset; const maxLat = lat + offset; const minLon = lon - offset; const maxLon = lon + offset;
const chunkKey = ${minLat.toFixed(2)}_${minLon.toFixed(2)}; if (loadedChunks.has(chunkKey)) return; loadedChunks.add(chunkKey);
const url = 'overpass-api.de' + encodeURIComponent([out:json][timeout:25]; (way["building"](${minLat},${minLon},${maxLat},${maxLon});); out body; >; out skel qt;);
try {
const response = await fetch(url); const data = await response.json(); if (!data.elements) return;
const nodes = {}; data.elements.forEach(n => { if (n.type === 'node') nodes[n.id] = { lat: n.lat, lon: n.lon }; });
const buildingMat = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.7 });
data.elements.forEach(wayEl => {
if (wayEl.type === 'way' && wayEl.nodes) {
const points = [];
wayEl.nodes.forEach(id => { const n = nodes[id]; if (n) points.push(new THREE.Vector2((n.lon - currentLon) * lonToMeters, -(n.lat - currentLat) * latToMeters)); });
if (points.length < 3) return;
const geom = new THREE.ExtrudeGeometry(new THREE.Shape(points), { steps: 1, depth: 15, bevelEnabled: false }); geom.rotateX(Math.PI / 2);
const bMesh = new THREE.Mesh(geom, buildingMat); bMesh.castShadow = true; bMesh.receiveShadow = true; scene.add(bMesh);
bMesh.geometry.computeBoundingBox(); colliders.push(new THREE.Box3().copy(bMesh.geometry.boundingBox));
totalBuildings++;
const bCountElement = document.getElementById('buildingsCount');
if(bCountElement) bCountElement.innerText = totalBuildings;
}
});
} catch (err) {}
}
let totalBuildings = 0;
function checkCollision(targetX, targetZ) {
for (let i = 0; i < colliders.length; i++) {
const box = colliders[i];
if (targetX + truckPhysics.radius > box.min.x && targetX - truckPhysics.radius < box.max.x && targetZ + truckPhysics.radius > box.min.z && targetZ - truckPhysics.radius < box.max.z) return true;
}
return false;
}
function updateGPSAndServicesLogic() {
if (!gpsArrowMesh) return;
let target = new THREE.Vector3(cargoCoords.x, 0, cargoCoords.z);
if (companyData.hasOrder) { if (truckGroup.position.x > -170) target.set(-180, 0, -162); else target.set(destCoords.x, 0, destCoords.z); }
gpsArrowMesh.position.set(truckGroup.position.x, 6, truckGroup.position.z); gpsArrowMesh.lookAt(target.x, 6, target.z);
const distToGas = truckGroup.position.distanceTo(new THREE.Vector3(gasCoords.x, 0, gasCoords.z));
const distToSto = truckGroup.position.distanceTo(new THREE.Vector3(stoCoords.x, 0, stoCoords.z));
if (distToGas < 5.0 && companyData.truckStats.fuel < 100) { if (companyData.balance >= SETTINGS.refuelCost) { companyData.balance -= SETTINGS.refuelCost; companyData.truckStats.fuel = 100; updateShopMenusUI(); } }
if (distToSto < 5.0 && companyData.truckStats.condition < 100) { if (companyData.balance >= SETTINGS.repairCost) { companyData.balance -= SETTINGS.repairCost; companyData.truckStats.condition = 100; updateShopMenusUI(); } }
document.getElementById('fuelVal').innerText = ${Math.ceil(companyData.truckStats.fuel)}%;
document.getElementById('conditionVal').innerText = ${companyData.truckStats.condition}%;
}
const keys = { w: false, a: false, s: false, d: false };
window.addEventListener('keydown', (e) => { initAudioEngine(); if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); const c = e.code.toLowerCase(); if (c === 'keyw') keys.w = true; if (c === 'keya') keys.a = true; if (c === 'keys') keys.s = true; if (c === 'keyd') keys.d = true; });
window.addEventListener('keyup', (e) => { const c = e.code.toLowerCase(); if (c === 'keyw') keys.w = false; if (c === 'keya') keys.a = false; if (c === 'keys') keys.s = false; if (c === 'keyd') keys.d = false; });
let touchData = { moveId: null, moveStartX: 0, moveStartY: 0, activeMoveX: 0, activeMoveY: 0 };
window.addEventListener('touchstart', (e) => { initAudioEngine(); if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); if (touchData.moveId === null && e.changedTouches) { touchData.moveId = e.changedTouches.identifier; touchData.moveStartX = e.changedTouches.clientX; touchData.moveStartY = e.changedTouches.clientY; } });
window.addEventListener('touchmove', (e) => { for (let k = 0; k < e.touches.length; k++) { const t = e.touches[k]; if (t.identifier === touchData.moveId) { let dX = t.clientX - touchData.moveStartX, dY = t.clientY - touchData.moveStartY; const limit = 50; const dist = Math.sqrt(dXdX + dYdY); if (dist > limit) { dX = (dX / dist) * limit; dY = (dY / dist) * limit; } touchData.activeMoveX = dX / limit; touchData.activeMoveY = dY / limit; } } });
window.addEventListener('touchend', (e) => { if (e.changedTouches && e.changedTouches.identifier === touchData.moveId) { touchData.moveId = null; touchData.activeMoveX = 0; touchData.activeMoveY = 0; } });
window.addEventListener('wheel', (e) => { cameraZoom.target = Math.max(cameraZoom.min, Math.min(cameraZoom.max, cameraZoom.target + e.deltaY * 0.12)); }, { passive: true });
function initTabsSystem() {
const buttons = document.querySelectorAll('.tab-btn'); const contents = document.querySelectorAll('.tab-content');
buttons.forEach(btn => { btn.addEventListener('click', () => { buttons.forEach(b => b.classList.remove('active')); contents.forEach(c => c.classList.add('hidden')); btn.classList.add('active'); document.getElementById(btn.getAttribute('data-tab')).classList.remove('hidden'); }); });
}
function initRegistration() {
const overlay = document.getElementById('registration-overlay'); const input = document.getElementById('companyNameInput'); let logo = "🚚";
document.querySelectorAll('.logo-btn').forEach(b => b.addEventListener('click', () => { document.querySelectorAll('.logo-btn').forEach(l=>l.classList.remove('active')); b.classList.add('active'); logo = b.getAttribute('data-logo'); }));
document.getElementById('startCompanyBtn').addEventListener('click', () => {
let name = input.value.trim() || "GlobalLogistics"; isCompanyRegistered = true;
document.getElementById('hudCompanyName').innerText = ${logo} ${name};
overlay.style.opacity = '0'; setTimeout(() => overlay.style.display = 'none', 500);
buildComposition3D(); spawnBorderCheckpoints(); initLogisticsMarkers(); updateShopMenusUI(); saveGameProgress();
});
}
document.addEventListener('DOMContentLoaded', () => { if(loadGameProgress()) { buildComposition3D(); spawnBorderCheckpoints(); initLogisticsMarkers(); updateShopMenusUI(); } else { initRegistration(); } initTabsSystem(); });
function gameLoop() {
requestAnimationFrame(gameLoop); if (!isCompanyRegistered) { renderer.render(scene, camera); return; }
dayTime += 0.0004; if (dayTime > 1.0) dayTime = 0.0;
const isNight = dayTime > 0.55 && dayTime < 0.95;
scene.background = new THREE.Color(isNight ? '#020617' : '#38bdf8'); sunLight.intensity = isNight ? 0.0 : 1.4;
const currentTruckConfig = TRUCK_CATALOG.find(t => t.id === companyData.selectedTruckId);
if (companyData.truckStats.fuel > 0 && companyData.truckStats.condition > 1) {
if (keys.w || (touchData.moveId !== null && touchData.activeMoveY < -0.1)) {
truckPhysics.speed = THREE.MathUtils.lerp(truckPhysics.speed, currentTruckConfig.maxSpeed * (companyData.truckStats.condition / 100), truckPhysics.acceleration);
companyData.truckStats.fuel -= SETTINGS.fuelUsageSpeed;
} else if (keys.s || (touchData.moveId !== null && touchData.activeMoveY > 0.1)) {
truckPhysics.speed = THREE.MathUtils.lerp(truckPhysics.speed, -currentTruckConfig.maxSpeed * 0.4, truckPhysics.acceleration);
companyData.truckStats.fuel -= SETTINGS.fuelUsageSpeed * 0.7; playBrakeSqueal();
} else { truckPhysics.speed = THREE.MathUtils.lerp(truckPhysics.speed, 0, truckPhysics.deceleration); }
} else { truckPhysics.speed = THREE.MathUtils.lerp(truckPhysics.speed, 0, truckPhysics.deceleration); }
if (Math.abs(truckPhysics.speed) > 0.05) {
const dir = truckPhysics.speed > 0 ? 1 : -1;
if (keys.a || (touchData.moveId !== null && touchData.activeMoveX < -0.1)) truckPhysics.angle += truckPhysics.rotationSpeed * dir;
if (keys.d || (touchData.moveId !== null && touchData.activeMoveX > 0.1)) truckPhysics.angle -= truckPhysics.rotationSpeed * dir;
}
updateMotorSound(truckPhysics.speed);
const stepX = Math.sin(truckPhysics.angle) * truckPhysics.speed; const stepZ = Math.cos(truckPhysics.angle) * truckPhysics.speed;
const nextX = truckGroup.position.x + stepX;
if (!checkCollision(nextX, truckGroup.position.z)) truckGroup.position.x = nextX; else { truckPhysics.speed *= -0.3; companyData.truckStats.condition = Math.max(0, companyData.truckStats.condition - SETTINGS.crashDamagePercent); }
const nextZ = truckGroup.position.z + stepZ;
if (!checkCollision(truckGroup.position.x, nextZ)) truckGroup.position.z = nextZ; else { truckPhysics.speed *= -0.3; companyData.truckStats.condition = Math.max(0, companyData.truckStats.condition - SETTINGS.crashDamagePercent); }
truckGroup.rotation.y = truckPhysics.angle;
updateTrafficCarsAI(trafficCars, truckGroup, scene, checkCollision, playTrafficHorn, SETTINGS.maxTrafficCars);
updateCountryBorderLogic(truckGroup.position.x, truckGroup.position.z);
updateCustomsControl(); updateGPSAndServicesLogic(); processLogisticsLogic();
const calcLat = currentLat - (truckGroup.position.z / latToMeters); const calcLon = currentLon + (truckGroup.position.x / lonToMeters);
const co = document.getElementById('coordsVal'); if(co) co.innerText = ${calcLat.toFixed(4)}, ${calcLon.toFixed(4)};
if (Math.random() > 0.985) loadRealOSMData(calcLat, calcLon);
cameraZoom.current = THREE.MathUtils.lerp(cameraZoom.current, cameraZoom.target, cameraZoom.speed);
camera.position.set(truckGroup.position.x, truckGroup.position.y + cameraZoom.current, truckGroup.position.z + (cameraZoom.current * 0.65));
camera.lookAt(truckGroup.position.x, truckGroup.position.y, truckGroup.position.z);
renderer.render(scene, camera);
}
gameLoop();
