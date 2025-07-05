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

function getClosest(arr, n, center) {
    return arr
        .map(obj => ({
            ...obj,
            dist: distanceMeters(center.lat, center.lng, obj.lat, obj.lng)
        }))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, n);
}

function updateRecursosMarkers(center, radius) {
    hidrantesMarkers.forEach(m => map.removeLayer(m));
    hidrantesMarkers = [];
    fabricasMarkers.forEach(m => map.removeLayer(m));
    fabricasMarkers = [];
    estacionesMarkers.forEach(m => map.removeLayer(m));
    estacionesMarkers = [];

    // Hidrantes
    hidrantesData.filter(h => distanceMeters(center.lat, center.lng, h.lat, h.lng) <= radius)
        .forEach(h => {
            let marker = L.marker([h.lat, h.lng], { icon: hidranteIcon }).addTo(map)
                .bindPopup(`<b>Hidrante</b><br>${h.nombre ?? ''}`);
            hidrantesMarkers.push(marker);
        });
    // Fábricas
    fabricasData.filter(f => distanceMeters(center.lat, center.lng, f.lat, f.lng) <= radius)
        .forEach(f => {
            let marker = L.marker([f.lat, f.lng], { icon: fabricaIcon }).addTo(map)
                .bindPopup(`<b>Fábrica</b><br>${f.nombre ?? ''}`);
            fabricasMarkers.push(marker);
        });
    // Estaciones de servicio
    estacionesData.filter(e => distanceMeters(center.lat, center.lng, e.lat, e.lng) <= radius)
        .forEach(e => {
            let marker = L.marker([e.lat, e.lng], { icon: estacionIcon }).addTo(map)
                .bindPopup(`<b>Estación de Servicio</b><br>${e.nombre ?? ''}<br>RUC: ${e.ruc ?? ''}`);
            estacionesMarkers.push(marker);
        });
}

function updateCircleAndAll() {
    const center = incidenteMarker.getLatLng();
    const radius = +document.getElementById('radiusInput').value;
    if (circle) {
        circle.setLatLng(center).setRadius(radius);
    }
    updateRecursosMarkers(center, radius);
    document.getElementById('radiusValue').textContent = radius + ' m';
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

        // Si hay sección de resumen/preview de recursos, puedes mostrar aquí los más cercanos también.
    });

    document.getElementById('radiusInput').addEventListener('input', updateCircleAndAll);

    // GUARDAR REPORTE
    const btnGuardar = document.getElementById('btnGuardarReporte');
    if (btnGuardar) {
        btnGuardar.addEventListener('click', function () {
            // Obtener datos de la interfaz o localStorage
            const lat = +document.getElementById('incidenteLat').value;
            const lng = +document.getElementById('incidenteLng').value;
            const radius = +document.getElementById('radiusInput').value;

            // Sección para obtener info adicional:
            const tipo_incidente = localStorage.getItem('tipo_incidente') || 'Sin especificar';
            const departamento = localStorage.getItem('departamento') || '';
            const provincia = localStorage.getItem('provincia') || '';
            const distrito = localStorage.getItem('distrito') || '';

            // Si guardaste el array de ids de compañías seleccionadas:
            const ids_companias = JSON.parse(localStorage.getItem('companias_seleccionadas') || '[]');

            // Pide los datos completos de compañías (puedes mejorar esto)
            fetch('/api/companias').then(r => r.json()).then(companiasDB => {
                const companias = companiasDB.filter(c => ids_companias.includes(c.id));

                // Filtra los recursos más cercanos (6 de cada uno)
                const incidentePoint = { lat, lng };
                const hidrantesCercanos = getClosest(hidrantesData, 6, incidentePoint);
                const fabricasCercanas = getClosest(fabricasData, 6, incidentePoint);
                const estacionesCercanas = getClosest(estacionesData, 6, incidentePoint);

                // Construir el reporte:
                const reporte = {
                    tipo_incidente,
                    departamento,
                    provincia,
                    distrito,
                    latitud: lat,
                    longitud: lng,
                    companias,
                    hidrantes: hidrantesCercanos,
                    fabricas: fabricasCercanas,
                    estaciones: estacionesCercanas
                };

                // Enviar al backend para guardar
                fetch('/fase2', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(reporte)
                }).then(resp => resp.json())
                .then(resp => {
                    if (resp.ok) {
                        alert('¡Reporte guardado correctamente!');
                        window.location.href = '/dashboard/bombero';
                    } else {
                        alert('Error al guardar el reporte.');
                    }
                });
            });
        });
    }
});
