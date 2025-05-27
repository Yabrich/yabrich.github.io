// 1) Initialise la carte
const map = L.map('map').setView([47.4736, -0.5541], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution: '© OpenStreetMap'
}).addTo(map);

// 2) Affiche les lignes depuis le GeoJSON local

let lineColors = {}

fetch('irigo_gtfs_lines.geojson')
  .then(r => r.json())
  .then(geojson => {
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
  })
  .catch(err => console.error('Échec chargement GeoJSON lignes :', err));


/**
 * Retourne un DivIcon avec un pictogramme de bus coloré.
 * @param {string} color – code hex sans '#', ex. "FF0000"
 */
function getBusIcon(color) {
  return L.divIcon({
    className: '',        // pas de wrapper CSS par défaut
    html: `<i class="fas fa-bus" 
               style="
                 color: #${color};
                 font-size: 24px;
                 text-shadow: 0 0 3px #000;
               ">
           </i>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]  // centre de l'icône
  });
}

function getTramIcon(color) {
  return L.divIcon({
    className: '',
    html: `<i class="fas fa-tram"
               style="
                 color: #${color};
                 font-size: 24px;
                 text-shadow: 0 0 3px #000;
               ">
           </i>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
}


// 3) Affiche les positions temps-réel
let markers = [];
async function chargerVehicules() {
  markers.forEach(m => map.removeLayer(m));
  markers = [];
  try {
    const resp = await fetch('http://localhost:5000/vehicules-irigo.json');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    data.forEach(v => {

      const rid = v.route_id ?? '';
      const color   = lineColors[rid] || '3388ff';

      const icon = (['A','B','C'].includes(rid))
        ? getTramIcon(color)
        : getBusIcon(color);

      let busid = v.id
      if(busid.length > 4)  {
        busid = "Bus ALEOP"
        console.info(busid)
      }

      const m = L.marker([v.latitude, v.longitude], {icon})
        .addTo(map)
        .bindPopup(
          `ID : ${busid}<br>` +
          `Ligne : ${v.route_id ?? '—'}<br>` +
          `Prochain Arrêt : ${v.stop_id ?? '—'}`
        );
      markers.push(m);
    });
  } catch (e) {
    console.warn('Impossible de charger les véhicules :', e);
  }
}

// premier chargement + rafraîchissement
chargerVehicules();
setInterval(chargerVehicules, 30000);
