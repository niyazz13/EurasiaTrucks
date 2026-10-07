export const TRUCK_CATALOG = [
    { id: "kamaz", name: "KamAZ 54901 Neo 🇷🇺", price: 0, maxSpeed: 1.5, fuelTank: 100, modelPath: "models/kamaz.glb", color: '#dc2626', desc: "Стартовый тягач" },
    { id: "scania", name: "Scania S730 V8 King 🇸🇪", price: 2800, maxSpeed: 2.1, fuelTank: 140, modelPath: "models/scania.glb", color: '#2563eb', desc: "Экономичный мотор" },
    { id: "volvo", name: "Volvo FH16 Globetrotter 🇳🇴", price: 4500, maxSpeed: 2.4, fuelTank: 180, modelPath: "models/volvo.glb", color: '#10b981', desc: "Флагман дорог" },
    { id: "mercedes", name: "Mercedes Actros MP5 🇩🇪", price: 7200, maxSpeed: 2.7, fuelTank: 220, modelPath: "models/mercedes.glb", color: '#f59e0b', desc: "Премиум комфорт" }
];

export const TRAILER_CATALOG = [
    { id: "flatbed", name: "Шторный Тент Schmitz 📑", price: 0, type: "Стандарт", modelPath: "models/schmitz.glb", desc: "Для обычных грузов" },
    { id: "refrigerated", name: "Рефрижератор Krone ❄️", price: 1500, type: "Скоропортящийся", modelPath: "models/krone.glb", desc: "Дорогие продукты" },
    { id: "tanker", name: "Chemical Feldbinder 🧪", price: 3200, type: "Опасный (ADR)", modelPath: "models/tanker.glb", desc: "Опасные химикаты" }
];

export const CARGO_DATABASE = [
    { name: "Свежие Яблоки в Берлин 🍏", pay: 600, reqType: "Стандарт", weight: "8 т" },
    { name: "Замороженная Рыба в Рим 🐟", pay: 1100, reqType: "Скоропортящийся", weight: "12 т" },
    { name: "Промышленные Кислоты в Лодзь 🧪", pay: 2300, reqType: "Опасный (ADR)", weight: "22 т" }
];

export const SETTINGS = {
    fuelUsageSpeed: 0.005,
    crashDamagePercent: 5,
    repairCost: 120,
    refuelCost: 50,
    customsFine: 900,
    maxTrafficCars: 20,
    roadWorksChance: 0.12,
    trafficUpdateInterval: 4000
};
