const bomberoIcon = L.icon({
    iconUrl: '/static/img/Bombero.png',
    iconSize: [34, 36],
    iconAnchor: [17, 36],
    popupAnchor: [0, -36],
});
const incidenteIcon = L.icon({
    iconUrl: '/static/img/Incendio.png',
    iconSize: [40, 42],
    iconAnchor: [20, 42],
    popupAnchor: [0, -38],
});

let map, circle, incidenteMarker;
let bomberosData = [], companiaMarkers = [];

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

function updateBomberosMarkers() {
    companiaMarkers.forEach(m => map.removeLayer(m));
    companiaMarkers = [];

    const center = incidenteMarker.getLatLng();
    const radius = +document.getElementById('radiusInput').value;

    bomberosData
        .filter(c => distanceMeters(center.lat, center.lng, c.lat, c.lng) <= radius)
        .forEach(c => {
            let marker = L.marker([c.lat, c.lng], { icon: bomberoIcon }).addTo(map)
                .bindPopup(`
                    <b>${c.nombre}</b><br>
                    Bomberos: ${c.bomberos_disponibles}<br>
                    Vehículos: ${c.vehiculos_disponibles}<br>
                    Responsable: ${c.nombre_responsable ?? ''} (${c.cargo_responsable ?? ''})
                `);
            companiaMarkers.push(marker);
        });

    // Guarda valores para Fase 2
    localStorage.setItem("incidente_lat", center.lat);
    localStorage.setItem("incidente_lng", center.lng);
    localStorage.setItem("radio", radius);
}

function updateCircleAndAll() {
    if (circle) {
        const center = incidenteMarker.getLatLng();
        const radius = +document.getElementById('radiusInput').value;
        circle.setLatLng(center).setRadius(radius);
    }
    updateBomberosMarkers();
}

document.addEventListener("DOMContentLoaded", function () {
    map = L.map('map').setView([-12.0464, -77.0428], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    fetch('/api/companias').then(r => r.json()).then(bomberos => {
        bomberosData = bomberos;

        let start = map.getCenter();
        let radiusValue = parseInt(document.getElementById('radiusInput').value) || 10000;
        circle = L.circle(start, {
            color: '#ff6600', fillColor: '#ffa60044',
            fillOpacity: 0.19, radius: radiusValue
        }).addTo(map);

        incidenteMarker = L.marker(start, { icon: incidenteIcon, draggable: true })
            .addTo(map).bindPopup("Lugar del Incendio").openPopup();

        updateCircleAndAll();

        incidenteMarker.on('move', function () {
            updateCircleAndAll();
        });
    });

    document.getElementById('radiusInput').addEventListener('input', updateCircleAndAll);

    map.on('click', function (e) {
        if (incidenteMarker) map.removeLayer(incidenteMarker);
        incidenteMarker = L.marker(e.latlng, { icon: incidenteIcon, draggable: true })
            .addTo(map).bindPopup("Lugar del Incendio").openPopup();
        circle.setLatLng(e.latlng);
        updateCircleAndAll();
        incidenteMarker.on('move', function () {
            updateCircleAndAll();
        });
    });
});
