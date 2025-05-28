// Dynamically inject CSS for styled checkboxes
const styleEl = document.createElement('style');
styleEl.textContent = `
.checkbox-wrapper {
  display: flex;
  align-items: center;
  margin: 4px 0;
}
.checkbox-wrapper input[type="checkbox"] {
  opacity: 0;
  width: 0;
  height: 0;
}
.checkbox-wrapper label {
  position: relative;
  padding-left: 28px;
  cursor: pointer;
  user-select: none;
  font-weight: bold;
  transition: transform 0.2s ease;
}
.checkbox-wrapper label:before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  width: 20px;
  height: 20px;
  border: 2px solid #888;
  border-radius: 4px;
  background: #fff;
  transition: background 0.3s ease, transform 0.2s ease;
}
.checkbox-wrapper input:checked + label:before {
  background: currentColor;
  transform: scale(1.1);
}
.checkbox-wrapper input:checked + label {
  transform: scale(1.05);
}

/* Styles pour le bouton Tout cocher / Tout décocher */
#toggle-all-btn {
  display: inline-block;
  padding: 6px 12px;
  margin: 8px 0;
  background-color: #483f91;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  transition: background-color 0.2s ease, transform 0.2s ease;
}
#toggle-all-btn:hover {
  background-color: #372d6e;
  transform: translateY(-1px);
}
`;
document.head.append(styleEl);

// Initialise la carte
const map = L.map('map').setView([47.4736, -0.5541], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution: '© OpenStreetMap'
}).addTo(map);

let selectedRoutes = new Set();
let linesGeoJSON, stopsData;
let lineColors = {};
let stopNames = {};
let linesLayer;

// Fonction pour (re)dessiner les lignes filtrées
function updateLines() {
  if (linesLayer) map.removeLayer(linesLayer);
  linesLayer = L.geoJSON(linesGeoJSON, {
    filter: feature => selectedRoutes.has(feature.properties.route_id),
    style: feature => ({
      color: '#' + feature.properties.route_color,
      weight: 3,
      opacity: 0.7
    }),
    onEachFeature: (f, layer) => {
      const p = f.properties;
      layer.bindPopup(`Ligne ${p.route_id}${p.route_long_name ? ` – ${p.route_long_name}` : ''}`);
    }
  }).addTo(map);
}

// Icônes bus/tram
function getBusIcon(color) {
  return L.divIcon({
    className: '',
    html: `<i class="fas fa-bus" style="color:#${color};font-size:24px;text-shadow:0 0 3px #000;"></i>`,
    iconSize: [24,24],
    iconAnchor: [12,12]
  });
}
function getTramIcon(color) {
  return L.divIcon({
    className: '',
    html: `<i class="fas fa-tram" style="color:#${color};font-size:24px;text-shadow:0 0 3px #000;"></i>`,
    iconSize: [24,24],
    iconAnchor: [12,12]
  });
}

// Chargement simultané des arrêts et lignes
Promise.all([
  fetch('horaires-theoriques-et-arrets-du-reseau-irigo-gtfs.json').then(r => r.json()),
  fetch('irigo_gtfs_lines.geojson').then(r => r.json())
])
.then(([stops, geojson]) => {
  stopsData = stops;
  linesGeoJSON = geojson;

  // Construire stopNames et lineColors
  stops.forEach(s => stopNames[s.stop_id] = s.stop_name);
  geojson.features.forEach(f => {
    const rid = f.properties.route_id;
    lineColors[rid] = f.properties.route_color;
  });

  // Définit les catégories et leurs lignes
  const categories = [
    { title: 'Tramway',         routes: ['A','B','C'] },
    { title: 'Lignes majeures',     routes: ['01','02','03','04'] },
    { title: 'Lignes de proximité', routes: ['05','06','07','08','09','10','11','12'] },
    { title: 'Lignes express',      routes: ['20','21','22','23','24','25'] },
    { title: 'Lignes suburbaines',   routes: Array.from({length:13}, (_,i) =>
                                            String(30 + i).padStart(2,'0')) }
  ];

  // Initialise panneau de filtres
  const filterPanel = document.getElementById('filter-panel');
  const filterHeader = filterPanel.querySelector('strong');
  const filterList = document.getElementById('filter-list');

  filterList.style.maxHeight   = '0';
  filterList.style.overflow    = 'hidden';
  filterList.style.transition  = 'max-height 0.4s ease';

  let open = false;
  filterHeader.style.cursor = 'pointer';
  filterHeader.addEventListener('click', () => {
    open = !open;
    filterList.style.maxHeight = open
      ? filterList.scrollHeight + 'px'
      : '0';
    filterHeader.innerHTML = open
      ? '▼ Filtrer les lignes'
      : '▶ Filtrer les lignes';
  });
  filterHeader.innerHTML = '▶ Filtrer les lignes';

  // Vide l'ancien contenu
  filterList.innerHTML = '';

  // Ajout du bouton Tout cocher / Tout décocher
  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'toggle-all-btn';
  toggleBtn.textContent = 'Tout cocher';
  toggleBtn.style.margin = '8px 0';
  toggleBtn.addEventListener('click', () => {
    const allCheckboxes = filterList.querySelectorAll('input[type="checkbox"]');
    const selectAll = toggleBtn.textContent === 'Tout cocher';
    allCheckboxes.forEach(chk => {
      chk.checked = selectAll;
      const rid = chk.value;
      if (selectAll) selectedRoutes.add(rid);
      else selectedRoutes.delete(rid);
    });
    toggleBtn.textContent = selectAll ? 'Tout décocher' : 'Tout cocher';
    updateLines();
    chargerVehicules();
  });
  filterList.appendChild(toggleBtn);

  // Génère chaque section de filtres
  categories.forEach(cat => {
    // Titre de section
    const catTitle = document.createElement('div');
    catTitle.textContent = cat.title;
    catTitle.style.fontWeight = 'bold';
    catTitle.style.margin = '8px 0 4px';
    filterList.appendChild(catTitle);

    // Cases à cocher pour cette catégorie
    cat.routes.forEach(rid => {
      if (!(rid in lineColors)) return;

      const wrapper = document.createElement('div');
      wrapper.classList.add('checkbox-wrapper');

      const chk = document.createElement('input');
      chk.type    = 'checkbox';
      chk.id      = `chk-${rid}`;
      chk.value   = rid;
      chk.checked = ['Tramway','Lignes majeures']
                    .includes(cat.title);
      if (chk.checked) selectedRoutes.add(rid);

      const lbl = document.createElement('label');
      lbl.htmlFor     = chk.id;
      if(rid>=20 && rid<=25){
      lbl.textContent = "E"+rid;
      }
      else{lbl.textContent = rid;}
      lbl.style.color = '#' + lineColors[rid];

      chk.addEventListener('change', () => {
        if (chk.checked) selectedRoutes.add(rid);
        else selectedRoutes.delete(rid);
        updateLines();
        chargerVehicules();
      });

      wrapper.append(chk, lbl);
      filterList.appendChild(wrapper);
    });
  });

  // Initial render
  updateLines();
  initStopsLayer();
  chargerVehicules();
  setInterval(chargerVehicules, 30000);
})
.catch(err => console.error('Échec chargement initial :', err));

// Initialisation du layerGroup des arrêts avec toggle zoom
let stopsLayer;
function initStopsLayer() {
  stopsLayer = L.layerGroup();
  const ZOOM_THRESHOLD = 15;
  stopsData.forEach(s => {
    if (s.stop_coordinates?.lat && s.stop_coordinates?.lon) {
      const cm = L.circleMarker([
        s.stop_coordinates.lat,
        s.stop_coordinates.lon
      ], {
        radius: 4,
        fillColor: '#fff',
        color: '#483f91',
        weight: 2,
        fillOpacity: 1
      }).bindTooltip(s.stop_name, { direction:'right', offset:[6,0] });
      stopsLayer.addLayer(cm);
    }
  });
  function toggleStops() {
    map.getZoom() >= ZOOM_THRESHOLD
      ? map.addLayer(stopsLayer)
      : map.removeLayer(stopsLayer);
  }
  toggleStops();
  map.on('zoomend', toggleStops);
}

// Affichage des véhicules
let markers = [];
async function chargerVehicules() {
  markers.forEach(m => map.removeLayer(m));
  markers = [];
  try {
    const resp = await fetch('https://web-production-c4b0.up.railway.app/vehicules-irigo.json');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    data.forEach(v => {
      let rid = v.route_id ?? '';
      if (!selectedRoutes.has(rid)) return;
      const color = lineColors[rid] || '3388ff';
      const icon  = ['A','B','C'].includes(rid)
        ? getTramIcon(color)
        : getBusIcon(color);
      let busid = v.id;
      if (busid.length > 4) busid = 'Bus Suburbain';
      if (rid >= 20 && rid <= 25) rid = `E${rid}`;

      const m = L.marker([v.latitude, v.longitude], { icon })
        .addTo(map)
        .bindPopup(
          `ID : ${busid}<br>` +
          `Ligne : ${rid || '—'}<br>` +
          `Prochain Arrêt : ${stopNames[v.stop_id] || '—'}`
        );
      markers.push(m);
    });
  } catch (e) {
    console.warn('Impossible de charger les véhicules :', e);
  }
}
