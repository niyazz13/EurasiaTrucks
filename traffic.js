import * as THREE from 'three';

export function updateTrafficCarsAI(trafficCars, truckGroup, scene, checkCollision, playTrafficHorn, maxTrafficCars) {
    trafficCars.forEach((car, index) => {
        const stepX = Math.sin(car.angle) * car.speed; const stepZ = Math.cos(car.angle) * car.speed;
        const nextX = car.mesh.position.x + stepX; const nextZ = car.mesh.position.z + stepZ;
        const dist = car.mesh.position.distanceTo(truckGroup.position);
        
        let blocked = checkCollision(nextX, nextZ) || dist < 12.0;
        if (blocked) {
            car.stuckTimer += 1; if(dist < 12.0) playTrafficHorn();
            if (car.stuckTimer > 250) { car.angle += Math.PI; car.stuckTimer = 0; }
        } else { car.mesh.position.set(nextX, 0.6, nextZ); car.mesh.rotation.y = car.angle; car.stuckTimer = 0; }
        if (dist > 300) { scene.remove(car.mesh); trafficCars.splice(index, 1); }
    });

    if (trafficCars.length < maxTrafficCars && Math.random() > 0.95) {
        const sX = truckGroup.position.x + (Math.random() - 0.5) * 160; const sZ = truckGroup.position.z + (Math.random() - 0.5) * 160;
        if (truckGroup.position.distanceTo(new THREE.Vector3(sX, 0, sZ)) > 30) {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 3.2), new THREE.MeshStandardMaterial({ color: '#4b5563', roughness: 0.5 }));
            mesh.position.set(sX, 0.6, sZ); mesh.castShadow = true; scene.add(mesh);
            trafficCars.push({ mesh, speed: 0.5 + Math.random()*0.4, angle: Math.random()*Math.PI*2, stuckTimer: 0 });
        }
    }
}
