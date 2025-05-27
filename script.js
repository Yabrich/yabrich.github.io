// 1) Initialise la carte
const map = L.map('map').setView([47.4736, -0.5541], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution: '© OpenStreetMap'
}).addTo(map);

// 2) Chargement simultané des arrêts (JSON) et des lignes (GeoJSON)
let stopNames = {};
let lineColors = {};

Promise.all([
  // Charge les noms complets des arrêts
  fetch('horaires-theoriques-et-arrets-du-reseau-irigo-gtfs.json').then(r => r.json()),
  // Charge le GeoJSON des lignes
  fetch('irigo_gtfs_lines.geojson').then(r => r.json())
])
.then(([stops, geojson]) => {
  // --- stopNames ---
  stops.forEach(s => {
    stopNames[s.stop_id] = s.stop_name;
  });

  // --- lineColors + affichage des lignes ---
  geojson.features.forEach(f => {
    const rid   = f.properties.route_id;
    const color = f.properties.route_color;
    lineColors[rid] = color;
  });

  L.geoJSON(geojson, {
    filter: feature => {
      const rid = feature.properties.route_id;
      if (['A','B','C'].includes(rid)) return true;
      const num = parseInt(rid, 10);
      return !isNaN(num) && num >= 1 && num <= 42;
    },
    style: feature => ({
      color: '#' + feature.properties.route_color,
      weight: 3,
      opacity: 0.7
    }),
    onEachFeature: (feature, layer) => {
      const p = feature.properties;
      layer.bindPopup(
        `Ligne ${p.route_id}` +
        (p.route_long_name ? ` – ${p.route_long_name}` : '')
      );
    }
  }).addTo(map);

  // Premier chargement + rafraîchissement des véhicules
  chargerVehicules();
  setInterval(chargerVehicules, 30000);
})
.catch(err => console.error('Échec chargement des données initiales :', err));

// 3) Fonctions d'icônes (bus / tram)
function getBusIcon(color) {
  return L.divIcon({
    className: '',
    html: `<i class="fas fa-bus" style="color: #${color}; font-size: 24px; text-shadow: 0 0 3px #000;"></i>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
}

function getTramIcon(color) {
  return L.divIcon({
    className: '',
    html: `<i class="fas fa-tram" style="color: #${color}; font-size: 24px; text-shadow: 0 0 3px #000;"></i>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
}

// 4) Affiche les positions temps-réel
let markers = [];
async function chargerVehicules() {
  markers.forEach(m => map.removeLayer(m));
  markers = [];
  try {
    const resp = await fetch('https://web-production-c4b0.up.railway.app/vehicules-irigo.json');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    data.forEach(v => {
      const rid = v.route_id ?? '';
      const color = lineColors[rid] || '3388ff';
      const icon = (['A','B','C'].includes(rid)) ? getTramIcon(color) : getBusIcon(color);
      let busid = v.id;
      if (busid.length > 4) {
        busid = "Bus ALEOP";
      }
      const fullStop = stopNames[v.stop_id] || '—';
      const m = L.marker([v.latitude, v.longitude], { icon })
        .addTo(map)
        .bindPopup(
          `ID : ${busid}<br>` +
          `Ligne : ${rid || '—'}<br>` +
          `Prochain Arrêt : ${fullStop}`
        );
      markers.push(m);
    });
  } catch (e) {
    console.warn('Impossible de charger les véhicules :', e);
  }
}
