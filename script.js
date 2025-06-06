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

/* Styles pour le bouton Tout cocher / Tout décocher et Me localiser */
#toggle-all-btn,
#locate_btn {
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
#toggle-all-btn:hover,
#locate_btn:hover {
  background-color: #372d6e;
  transform: translateY(-1px);
}
`;
document.head.append(styleEl);

// =============================================
// 1. GESTION DU MODE SOMBRE (SUNRISE / SUNSET)
// =============================================

// Tile layers clair / sombre
let lightTileLayer, darkTileLayer;

// Fonction pour initialiser les deux tile layers
function initTileLayers() {
  lightTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '© OpenStreetMap'
  });
  darkTileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 18,
    attribution: '© CartoDB Dark Matter'
  });
}

// Fonction qui détermine lever/coucher et applique le mode
function applyDayNightMode() {
  // On récupère le centre de la carte
  const center = map.getCenter();
  const lat = center.lat;
  const lng = center.lng;
  const now = new Date();

  // Obtenir les horaires du lever/coucher pour la date d’aujourd’hui
  const times = SunCalc.getTimes(now, lat, lng);
  const sunrise = times.sunrise;    // Date object
  const sunset  = times.sunset;     // Date object

  // Si on est entre le coucher et le lever du lendemain
  let isNight;
  if (now >= sunset) {
    // On se situe après le coucher => nuit
    isNight = true;
  } else if (now < sunrise) {
    // On se situe avant le lever => nuit
    isNight = true;
  } else {
    isNight = false;
  }

  // Appliquer le CSS et tileLayer correspondant
  if (isNight) {
    document.body.classList.add('dark-mode');
    if (map.hasLayer(lightTileLayer)) map.removeLayer(lightTileLayer);
    if (!map.hasLayer(darkTileLayer)) map.addLayer(darkTileLayer);
  } else {
    document.body.classList.remove('dark-mode');
    if (map.hasLayer(darkTileLayer)) map.removeLayer(darkTileLayer);
    if (!map.hasLayer(lightTileLayer)) map.addLayer(lightTileLayer);
  }

  // Planifier le prochain changement au prochain lever OU coucher
  let nextSwitchTime;
  if (isNight) {
    // Prochaine transition = lever du soleil
    nextSwitchTime = sunrise;
  } else {
    // Prochaine transition = coucher du soleil
    nextSwitchTime = sunset;
  }
  // Si la prochaine transition est déjà passée (ex. minuit), on prend celle du lendemain
  if (nextSwitchTime <= now) {
    const tomorrow = new Date(now.getTime() + 24*60*60*1000);
    const timesTmr = SunCalc.getTimes(tomorrow, lat, lng);
    nextSwitchTime = isNight ? timesTmr.sunrise : timesTmr.sunset;
  }
  // Calcul de l’intervalle avant la prochaine transition (en ms)
  const delayMs = nextSwitchTime.getTime() - now.getTime();
  setTimeout(applyDayNightMode, delayMs + 1000); // +1s pour être sûr
}


// ==================================
// 2. PERSISTANCE DES FILTRES (localStorage)
// ==================================

function loadSelectedRoutes() {
  const stored = localStorage.getItem('selectedRoutes');
  if (stored) {
    try {
      return new Set(JSON.parse(stored));
    } catch (e) {
      console.warn('Impossible de parser selectedRoutes dans localStorage :', e);
      return new Set();
    }
  }
  // Par défaut, afficher les lignes de tramway et lignes majeures
  const defaultRoutes = ['A','B','C','01','02','03','04'];
  localStorage.setItem('selectedRoutes', JSON.stringify(defaultRoutes));
  return new Set(defaultRoutes);
}

let selectedRoutes = loadSelectedRoutes();
let linesGeoJSON, stopsData;
let lineColors = {};
let stopNames = {};
let linesLayer;
let locateMarker; // Marker used for the "Me localiser" feature
let trackedBusId = null; // ID du bus actuellement suivi
let trackedPopupOpen = false;

// ==================================
// 3. INITIALISATION DE LA CARTE
// ==================================

const map = L.map('map').setView([47.4736, -0.5541], 13);

// Créer d’emblée les tile layers
initTileLayers();

// Par défaut, on ajoute celui qui correspond à l’heure actuelle (le reste est géré dans applyDayNightMode)
map.addLayer(lightTileLayer);

// On lance tout de suite la détection jour/nuit
applyDayNightMode();


// ==================================
// 4. DESSIN DES LIGNES FILTRÉES
// ==================================

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


// ==================================
// 5. ICÔNES BUS / TRAM
// ==================================

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


// ==================================
// 6. CHARGEMENT DES DONNÉES (ARRÊTS + LIGNES)
// ==================================

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
    { title: 'Tramway',           routes: ['A','B','C'] },
    { title: 'Lignes majeures',   routes: ['01','02','03','04'] },
    { title: 'Lignes de proximité', routes: ['05','06','07','08','09','10','11','12'] },
    { title: 'Lignes express',    routes: ['20','21','22','23','24','25'] },
    { title: 'Lignes suburbaines', routes: Array.from({length:13}, (_,i) =>
                                        String(30 + i).padStart(2,'0')) }
  ];

  // Initialise panneau de filtres
  const filterPanel  = document.getElementById('filter-panel');
  const filterHeader = filterPanel.querySelector('strong');
  const filterList   = document.getElementById('filter-list');

  filterList.style.maxHeight  = '0';
  filterList.style.overflow   = 'hidden';
  filterList.style.transition = 'max-height 0.4s ease';

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
  document.addEventListener('click', (e) => {
    if (open && !filterPanel.contains(e.target) && e.target !== filterHeader) {
      open = false;
      filterList.style.maxHeight = '0';
      filterHeader.innerHTML = '▶ Filtrer les lignes';
    }
  });

  // Vide le panneau
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
    // Sauvegarde dans localStorage
    localStorage.setItem('selectedRoutes', JSON.stringify(Array.from(selectedRoutes)));
    updateLines();
    chargerVehicules();
  });
  filterList.appendChild(toggleBtn);

  // Génère chaque section de filtres
  categories.forEach(cat => {
    const catTitle = document.createElement('div');
    catTitle.textContent = cat.title;
    catTitle.style.fontWeight = 'bold';
    catTitle.style.margin = '8px 0 4px';
    filterList.appendChild(catTitle);

    cat.routes.forEach(rid => {
      if (!(rid in lineColors)) return;

      const wrapper = document.createElement('div');
      wrapper.classList.add('checkbox-wrapper');

      const chk = document.createElement('input');
      chk.type  = 'checkbox';
      chk.id    = `chk-${rid}`;
      chk.value = rid;
      // On coche si l'utilisateur avait déjà sélectionné cette route
      chk.checked = selectedRoutes.has(rid);

      const lbl = document.createElement('label');
      lbl.htmlFor = chk.id;
      lbl.textContent = (rid >= 20 && rid <= 25) ? `E${rid}` : rid;
      lbl.style.color = '#' + lineColors[rid];

      chk.addEventListener('change', () => {
        if (chk.checked) selectedRoutes.add(rid);
        else selectedRoutes.delete(rid);
        // Sauvegarde dans localStorage
        localStorage.setItem('selectedRoutes', JSON.stringify(Array.from(selectedRoutes)));
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


// ==================================
// 7. BOUTON "ME LOCALISER"
// ==================================
const locateBtn = document.getElementById("locate_btn");
locateBtn.addEventListener('click', () => {
  if (!navigator.geolocation) {
    alert('La géolocalisation n’est pas prise en charge par votre navigateur.');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    position => {
      const { latitude, longitude } = position.coords;
      // Centre la carte sur la position de l’utilisateur (zoom 16)
      map.setView([latitude, longitude], 16);

      // Facultatif : ajouter un marqueur temporaire "Vous êtes ici"
      L.marker([latitude, longitude])
        .addTo(map)
        .bindPopup('Vous êtes ici')
        .openPopup();
    },
    error => {
      console.error('Erreur lors de la récupération de la position :', error);
      alert('Impossible de récupérer votre position.');
    },
    {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 0
    }
  );
});


// ==================================
// 8. LAYER GROUP ARRÊTS + ZOOM-TOGGLE
// ==================================
let stopsLayer;
function initStopsLayer() {
  stopsLayer = L.layerGroup();
  const ZOOM_THRESHOLD = 16;
  stopsData.forEach(s => {
    if (s.stop_coordinates?.lat && s.stop_coordinates?.lon) {
      const cm = L.circleMarker(
        [s.stop_coordinates.lat, s.stop_coordinates.lon],
        {
          radius: 4,
          fillColor: '#fff',
          color: '#483f91',
          weight: 2,
          fillOpacity: 1
        }
      ).bindTooltip(s.stop_name, { direction:'right', offset:[6,0] });
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


// ==================================
// 9. AFFICHAGE DES VÉHICULES
// ==================================
let markers = [];
async function chargerVehicules() {
  markers.forEach(m => map.removeLayer(m));
  markers = [];
  let trackedMarker = null;
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

      const followLabel = trackedBusId === v.id
        ? 'Arrêter le suivi'
        : 'Suivre ce véhicule';
      const popupHtml =
        `ID : ${busid}<br>` +
        `Ligne : ${rid || '—'}<br>` +
        `Prochain Arrêt : ${stopNames[v.stop_id] || '—'}<br>` +
        `<button class="follow-btn" data-id="${v.id}">${followLabel}</button>`;
      const m = L.marker([v.latitude, v.longitude], { icon })
        .addTo(map)
        .bindPopup(popupHtml);
      m.on('popupopen', e => {
        const btn = e.popup.getElement().querySelector('.follow-btn');
        if (!btn) return;
        btn.addEventListener('click', () => {
          if (trackedBusId === v.id) {
            trackedBusId = null;
            trackedPopupOpen = false;
            btn.textContent = 'Suivre ce véhicule';
          } else {
            trackedBusId = v.id;
            trackedPopupOpen = true;
            btn.textContent = 'Arrêter le suivi';
            map.setView(m.getLatLng(), map.getZoom());
          }
        });
      });
      markers.push(m);
      if (trackedBusId === v.id) {
        trackedMarker = m;  
      }
    });
    if (trackedMarker) {
      trackedMarker.openPopup();
      map.setView(trackedMarker.getLatLng(), map.getZoom());
      map.setView(m.getLatLng(), map.getZoom());
    }
  } catch (e) {
    console.warn('Impossible de charger les véhicules :', e);
  }
}