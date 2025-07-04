const incidenteIcon = L.icon({
    iconUrl: '/static/img/Incendio.png',
    iconSize: [40, 42],
    iconAnchor: [20, 42],
    popupAnchor: [0, -38],
});
const hidranteIcon = L.icon({
    iconUrl: '/static/img/hidrante.png',
    iconSize: [28, 32],
    iconAnchor: [14, 32],
    popupAnchor: [0, -30],
});
const fabricaIcon = L.icon({
    iconUrl: '/static/img/fabrica.png',
    iconSize: [32, 34],
    iconAnchor: [16, 34],
    popupAnchor: [0, -32],
});
const estacionIcon = L.icon({
    iconUrl: '/static/img/gas.png',
    iconSize: [32, 34],
    iconAnchor: [16, 34],
    popupAnchor: [0, -32],
});

let map, circle, incidenteMarker;
let hidrantesData = [], hidrantesMarkers = [];
let fabricasData = [], fabricasMarkers = [];
let estacionesData = [], estacionesMarkers = [];

function distanceMeters(lat1, lng1, lat2, lng2) {
    function toRad(x) { return x * Math.PI / 180; }
    let R = 6371000;
    let dLat = toRad(lat2 - lat1);
    let dLon = toRad(lng2 - lng1);
    let a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) ** 2;
    let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function updateRecursosMarkers() {
    hidrantesMarkers.forEach(m => map.removeLayer(m));
    hidrantesMarkers = [];
    fabricasMarkers.forEach(m => map.removeLayer(m));
    fabricasMarkers = [];
    estacionesMarkers.forEach(m => map.removeLayer(m));
    estacionesMarkers = [];

    const center = incidenteMarker.getLatLng();
    const radius = +document.getElementById('radiusInput').value;

    hidrantesData.filter(h => distanceMeters(center.lat, center.lng, h.lat, h.lng) <= radius)
        .forEach(h => {
            let marker = L.marker([h.lat, h.lng], { icon: hidranteIcon }).addTo(map)
                .bindPopup(`<b>Hidrante</b><br>${h.nombre ?? ''}`);
            hidrantesMarkers.push(marker);
        });

    fabricasData.filter(f => distanceMeters(center.lat, center.lng, f.lat, f.lng) <= radius)
        .forEach(f => {
            let marker = L.marker([f.lat, f.lng], { icon: fabricaIcon }).addTo(map)
                .bindPopup(`<b>Fábrica</b><br>${f.nombre ?? ''}`);
            fabricasMarkers.push(marker);
        });

    estacionesData.filter(e => distanceMeters(center.lat, center.lng, e.lat, e.lng) <= radius)
        .forEach(e => {
            let marker = L.marker([e.lat, e.lng], { icon: estacionIcon }).addTo(map)
                .bindPopup(`<b>Estación de Servicio</b><br>${e.nombre ?? ''}<br>RUC: ${e.ruc ?? ''}`);
            estacionesMarkers.push(marker);
        });
}

function updateCircleAndAll() {
    if (circle) {
        const center = incidenteMarker.getLatLng();
        const radius = +document.getElementById('radiusInput').value;
        circle.setLatLng(center).setRadius(radius);
    }
    updateRecursosMarkers();
}

document.addEventListener("DOMContentLoaded", function () {
    let centerLat = +document.getElementById('incidenteLat').value;
    let centerLng = +document.getElementById('incidenteLng').value;
    let radiusValue = +document.getElementById('radiusInput').value || 10000;

    map = L.map('map').setView([centerLat, centerLng], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    Promise.all([
        fetch('/api/hidrantes').then(r => r.json()),
        fetch('/api/fabricas').then(r => r.json()),
        fetch('/api/estaciones').then(r => r.json())
    ]).then(([hidrantes, fabricas, estaciones]) => {
        hidrantesData = hidrantes;
        fabricasData = fabricas;
        estacionesData = estaciones;

        circle = L.circle([centerLat, centerLng], {
            color: '#ff6600', fillColor: '#ffa60044',
            fillOpacity: 0.19, radius: radiusValue
        }).addTo(map);

        incidenteMarker = L.marker([centerLat, centerLng], { icon: incidenteIcon, draggable: false })
            .addTo(map).bindPopup("Lugar del Incendio").openPopup();

        updateCircleAndAll();
    });

    document.getElementById('radiusInput').addEventListener('input', updateCircleAndAll);
});
