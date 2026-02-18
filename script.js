// Dynamically inject CSS for styled checkboxes
const styleEl = document.createElement('style');
styleEl.textContent = `
.checkbox-wrapper {
  --line-color: #483f91;
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
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  transition: transform 0.18s ease, color 0.18s ease;
}
.checkbox-wrapper label:before {
  content: '';
  position: absolute;
  left: 0;
  top: 2px;
  width: 20px;
  height: 20px;
  border: 2px solid var(--line-color, #888);
  border-radius: 6px;
  background: rgba(255,255,255,0.9);
  box-shadow: inset 0 0 0 1px rgba(0,0,0,0.05);
  transition: transform 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease, border-color 0.2s ease;
}
.checkbox-wrapper input:checked + label {
  transform: translateY(-1px);
}
.checkbox-wrapper input:checked + label:before {
  background: var(--line-color, currentColor);
  border-color: var(--line-color, currentColor);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.18);
}
.checkbox-wrapper input:focus-visible + label:before {
  outline: 2px solid rgba(72, 63, 145, 0.45);
  outline-offset: 2px;
}
.checkbox-wrapper label .filter-line-label-text {
  flex: 1;
  font-weight: 600;
}
.checkbox-wrapper label .filter-line-count {
  transition: background 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease, transform 0.2s ease;
}
#toggle-all-btn {
  display: inline-block;
  width: 100%;
  padding: 8px 14px;
  margin: 8px 0 12px;
  background-color: #483f91;
  color: #fff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 700;
  letter-spacing: 0.02em;
  transition: background-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
  box-shadow: 0 4px 12px rgba(72, 63, 145, 0.35);
}
#toggle-all-btn:hover {
  background-color: #372d6e;
  transform: translateY(-1px);
}
#toggle-all-btn:active {
  transform: translateY(0);
}
body.dark-mode #toggle-all-btn {
  background-color: #555;
  color: #eee;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.45);
}
body.dark-mode #toggle-all-btn:hover {
  background-color: #444;
}
`;
document.head.append(styleEl);

// =============================================
// 0. FONCTION PARSE TXT => CSV
// =============================================

function parseCSV(text) {
  if (!text) return [];
  const lines = text.replace(/\r\n?/g, '\n').split('\n').filter(l => l.trim() !== '');
  if (lines.length === 0) return [];
  const splitCSV = (line) => {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (ch === ',' && !inQuotes) {
        result.push(cur); cur = '';
      } else {
        cur += ch;
      }
    }
    result.push(cur);
    return result.map(v => v.trim());
  };
  const headers = splitCSV(lines[0]).map(h => h.replace(/^"|"$/g, ''));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = splitCSV(lines[i]);
    const obj = {};
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c];
      let val = parts[c] ?? '';
      if (val && val.length >= 2 && val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1).replace(/""/g, '"');
      }
      obj[key] = val;
    }
    rows.push(obj);
  }
  return rows;
}

// =============================================
// 1. GESTION DU MODE SOMBRE (SUNRISE / SUNSET)
// =============================================

// Tile layers clair / sombre
let lightTileLayer, darkTileLayer;

// Fonction pour initialiser les deux tile layers
function initTileLayers() {
  lightTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    minZoom: 10,
    maxZoom: 18,
    attribution: '© OpenStreetMap'
  });
  darkTileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    minZoom: 10,
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
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        const normalized = parsed.map(normalizeRouteId).filter(Boolean);
        if (normalized.length) {
          return new Set(normalized);
        }
      }
    } catch (e) {
      console.warn('Impossible de parser selectedRoutes dans localStorage :', e);
    }
  }
  const defaultRoutes = ['A','B','C','01','02','03','04'].map(normalizeRouteId);
  localStorage.setItem('selectedRoutes', JSON.stringify(defaultRoutes));
  return new Set(defaultRoutes);
}

let selectedRoutes = loadSelectedRoutes();
let linesGeoJSON, stopsData;
let lineColors = {}; // Couleur par ligne
let stopNames = {}; // Nom par identifiant de station
let stopCoords = {}; // Coordonnées par station
let linesLayer;
let locateMarker; // Marker used for the "Me localiser" feature
let trackedBusId = null; // ID du bus actuellement suivi
let trackedPopupOpen = false;
let tripHeadsignMap = {};
let trackedBusLabel = null; // Label affiché pour le bus suivi
const tripStopTimesMap = new Map();
const DEFAULT_LINE_COLOR = '#4caf50';
const DEFAULT_TIMELINE_MESSAGE = 'Horaires indisponibles.';
const DEFAULT_SPEED_M_S = 10;
const MIN_SPEED_M_S = 3;
const DELAY_THRESHOLD_SECONDS = 90;

function normalizeRouteId(value) {
  if (value == null) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  const expressMatch = raw.match(/^E(\d{1,2})$/i);
  if (expressMatch) return expressMatch[1].padStart(2, '0');
  const isTwoDigitNumber = raw.length <= 2 && /^[0-9]+$/.test(raw);
  if (isTwoDigitNumber) return raw.padStart(2, '0');
  return raw.toUpperCase();
}

function normalizeHexColor(value, fallback = DEFAULT_LINE_COLOR) {
  const parse = input => {
    if (!input && input !== 0) return null;
    const hex = String(input).trim().replace(/^#/, '');
    if (/^[0-9a-fA-F]{6}$/.test(hex)) return '#' + hex.toLowerCase();
    if (/^[0-9a-fA-F]{3}$/.test(hex)) {
      return '#' + hex.split('').map(ch => (ch + ch)).join('').toLowerCase();
    }
    return null;
  };
  return parse(value) ?? parse(fallback) ?? '#4caf50';
}

function computeBadgePalette(color) {
  const base = normalizeHexColor(color);
  const numeric = base.slice(1);
  const r = parseInt(numeric.slice(0, 2), 16);
  const g = parseInt(numeric.slice(2, 4), 16);
  const b = parseInt(numeric.slice(4, 6), 16);
  const rgba = alpha => 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const textColor = luminance > 0.62 ? '#1f1f1f' : '#ffffff';
  return {
    base,
    text: textColor,
    bg: rgba(0.18),
    activeBg: rgba(0.34),
    border: rgba(0.42),
    shadow: rgba(0.32)
  };
}

function applyCountBadgePalette(badge, palette) {
  if (!badge || !palette) return;
  badge.style.setProperty('--line-color', palette.base);
  badge.style.setProperty('--badge-bg', palette.bg);
  badge.style.setProperty('--badge-active-bg', palette.activeBg);
  badge.style.setProperty('--badge-border-color', palette.border);
  badge.style.setProperty('--badge-shadow-color', palette.shadow);
  badge.style.setProperty('--badge-color', palette.text);
}

// Gestion de l'affichage du message de suivi
const trackHintEl = document.getElementById('track_hint');
function updateTrackHint() {
  if (trackedBusId && trackedBusLabel) {
    trackHintEl.textContent = `Vous suivez le véhicule n°${trackedBusLabel}`;
  } else {
    trackHintEl.textContent = 'Cliquez sur un véhicule pour le suivre';
  }
}
updateTrackHint();

const filterPanelEl = document.getElementById('filter-panel');
const filterListEl = document.getElementById('filter-list');
const filterToggleBtn = document.getElementById('filter_toggle_btn');
const routeCountBadges = new Map();
let latestVehicleCounts = new Map();

function formatRouteLabel(routeId) {
  const numeric = Number(routeId);
  if (!Number.isNaN(numeric) && numeric >= 20 && numeric <= 25) {
    return `E${routeId}`;
  }
  return routeId;
}

function setFilterPanelOpen(isOpen) {
  if (!filterPanelEl) return;
  const open = Boolean(isOpen);
  filterPanelEl.classList.toggle('is-open', open);
  filterPanelEl.setAttribute('aria-hidden', (!open).toString());
  if (filterToggleBtn) {
    filterToggleBtn.setAttribute('aria-expanded', open.toString());
    filterToggleBtn.classList.toggle('is-active', open);
  }
}

setFilterPanelOpen(false);

if (filterToggleBtn) {
  filterToggleBtn.addEventListener('click', event => {
    event.stopPropagation();
    const shouldOpen = !(filterPanelEl && filterPanelEl.classList.contains('is-open'));
    setFilterPanelOpen(shouldOpen);
  });
}

document.addEventListener('click', event => {
  if (!filterPanelEl || !filterPanelEl.classList.contains('is-open')) return;
  if (filterPanelEl.contains(event.target)) return;
  if (filterToggleBtn && filterToggleBtn.contains(event.target)) return;
  setFilterPanelOpen(false);
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    setFilterPanelOpen(false);
  }
});

function updateFilterVehicleCounts(countMap) {
  latestVehicleCounts = countMap instanceof Map
    ? new Map(countMap)
    : new Map(countMap ? countMap : []);
  routeCountBadges.forEach((badge, routeId) => {
    const count = latestVehicleCounts.get(routeId) ?? 0;
    badge.textContent = String(count);
    const hasVehicles = count > 0;
    badge.classList.toggle('is-active', hasVehicles);
    badge.style.opacity = hasVehicles ? '1' : '0.55';
    badge.setAttribute('data-count', String(count));
    const label = badge.closest('label');
    if (label) {
      const displayText = label.querySelector('.filter-line-label-text')?.textContent?.trim() || routeId;
      const suffix = count > 1 ? 'véhicules' : 'véhicule';
      badge.setAttribute('title', `${count} ${suffix}`);
      label.setAttribute('aria-label', `${displayText} – ${count} ${suffix} en service`);
    }
  });
}

const loadingOverlay = document.getElementById('loading-overlay');
const loadingOverlaySpinner = loadingOverlay ? loadingOverlay.querySelector('.loading-spinner') : null;
const loadingOverlayText = loadingOverlay ? loadingOverlay.querySelector('.loading-text') : null;

const vehicleInfoPanel = document.getElementById('vehicle-info-panel');
const vehicleInfoToggle = vehicleInfoPanel ? vehicleInfoPanel.querySelector('[data-vehicle-info-toggle]') : null;
const vehicleInfoBadge = vehicleInfoPanel ? vehicleInfoPanel.querySelector('.vehicle-info-badge') : null;
const vehicleInfoClose = vehicleInfoPanel ? vehicleInfoPanel.querySelector('[data-vehicle-info-close]') : null;
const TRAM_VEHICLE_BADGE_LABEL = 'Tramway n°';
const BUS_VEHICLE_BADGE_LABEL = 'Bus n°';
const DEFAULT_VEHICLE_BADGE_LABEL = BUS_VEHICLE_BADGE_LABEL;
const TRAM_LINE_CODES = new Set(['A','B','C']);

if (vehicleInfoBadge) {
  vehicleInfoBadge.textContent = DEFAULT_VEHICLE_BADGE_LABEL;
}

const vehicleInfoFields = vehicleInfoPanel ? {
  id: vehicleInfoPanel.querySelector('[data-vehicle-field="id"]'),
  line: vehicleInfoPanel.querySelector('[data-vehicle-field="line"]'),
  destination: vehicleInfoPanel.querySelector('[data-vehicle-field="destination"]'),
  nextStop: vehicleInfoPanel.querySelector('[data-vehicle-field="next-stop"]')
} : {};
const vehicleTimelineElements = vehicleInfoPanel ? {
  container: vehicleInfoPanel.querySelector('[data-vehicle-timeline-container]'),
  steps: vehicleInfoPanel.querySelector('[data-vehicle-field="timeline"]'),
  placeholder: vehicleInfoPanel.querySelector('[data-vehicle-timeline-placeholder]'),
  toggleButton: vehicleInfoPanel.querySelector('[data-vehicle-timeline-toggle]')
} : {};

const vehicleTimelineState = {
  isExpanded: false,
  data: null,
  message: DEFAULT_TIMELINE_MESSAGE,
  key: null
};

if (vehicleTimelineElements.toggleButton) {
  vehicleTimelineElements.toggleButton.addEventListener('click', () => {
    if (!vehicleTimelineState.data) return;
    vehicleTimelineState.isExpanded = !vehicleTimelineState.isExpanded;
    renderVehicleTimeline(
      vehicleTimelineState.data,
      vehicleTimelineState.message,
      { key: vehicleTimelineState.key, preserveState: true }
    );
  });
}

const vehicleInfoUIState = {
  isCollapsed: false
};

function applyVehicleInfoCollapseState() {
  if (!vehicleInfoPanel) return;
  const isEmpty = vehicleInfoPanel.classList.contains('is-empty');
  const shouldCollapse = vehicleInfoUIState.isCollapsed && !isEmpty;
  vehicleInfoPanel.classList.toggle('is-collapsed', shouldCollapse);
  if (vehicleInfoToggle) {
    vehicleInfoToggle.disabled = isEmpty;
    vehicleInfoToggle.setAttribute('aria-expanded', String(!shouldCollapse));
  }
}

if (vehicleInfoToggle) {
  vehicleInfoToggle.addEventListener('click', () => {
    if (vehicleInfoPanel.classList.contains('is-empty')) return;
    vehicleInfoUIState.isCollapsed = !vehicleInfoUIState.isCollapsed;
    applyVehicleInfoCollapseState();
  });
}

if (vehicleInfoClose) {
  vehicleInfoClose.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    clearVehicleInfoPanel();
  });
}

applyVehicleInfoCollapseState();

let selectedVehicleId = null;

function setVehicleInfoField(element, value) {
  if (!element) return;
  const safeValue = value != null && value !== '' ? value : '-';
  element.textContent = safeValue;
}

function renderVehicleTimeline(timelineData, message, options = {}) {
  if (!vehicleTimelineElements.container || !vehicleTimelineElements.steps) return;
  const { container, steps, placeholder, toggleButton } = vehicleTimelineElements;

  const key = options && options.key != null ? String(options.key) : null;
  const preserveState = !!(options && options.preserveState);
  const keyChanged = key !== vehicleTimelineState.key;

  if (!preserveState) {
    if (keyChanged) {
      vehicleTimelineState.isExpanded = false;
    } else if (!key && timelineData !== vehicleTimelineState.data) {
      vehicleTimelineState.isExpanded = false;
    }
  }

  vehicleTimelineState.key = key;
  vehicleTimelineState.data = timelineData;

  steps.innerHTML = '';

  let baseItems = null;
  let allItems = null;
  let fallbackMessage = message;

  if (timelineData) {
    if (Array.isArray(timelineData)) {
      baseItems = timelineData;
      allItems = timelineData;
    } else {
      baseItems = Array.isArray(timelineData.items) ? timelineData.items : null;
      allItems = Array.isArray(timelineData.allItems) ? timelineData.allItems : baseItems;
      if (!fallbackMessage && timelineData.message) {
        fallbackMessage = timelineData.message;
      }
    }
  }

  const resolvedMessage = fallbackMessage || DEFAULT_TIMELINE_MESSAGE;
  vehicleTimelineState.message = resolvedMessage;

  const shouldExpand = vehicleTimelineState.isExpanded && allItems && allItems.length;
  const itemsToRender = shouldExpand ? allItems : baseItems;
  const hasItems = Array.isArray(itemsToRender) && itemsToRender.length > 0;

  if (!hasItems) {
    container.classList.remove('has-data');
    container.classList.remove('is-expanded');
    vehicleTimelineState.isExpanded = false;
    if (placeholder) {
      placeholder.textContent = resolvedMessage;
    }
    if (toggleButton) {
      toggleButton.classList.add('is-hidden');
      toggleButton.removeAttribute('aria-expanded');
    }
    return;
  }

  container.classList.add('has-data');
  container.classList.toggle('is-expanded', !!shouldExpand);
  if (placeholder) {
    placeholder.textContent = '';
  }

  itemsToRender.forEach((item, index) => {
    if (!item) return;
    const stepEl = document.createElement('div');
    const statusClass = item && item.status ? ` is-${item.status}` : '';
    stepEl.className = `vehicle-timeline-step${statusClass}`;

    const axisEl = document.createElement('div');
    axisEl.className = 'vehicle-timeline-axis';

    const topLine = document.createElement('span');
    topLine.className = 'vehicle-timeline-axis-line';
    if (index === 0) {
      topLine.classList.add('is-hidden');
    } else {
      const prevItem = itemsToRender[index - 1];
      if (prevItem && prevItem.status === 'past') {
        topLine.classList.add('is-past');
      } else {
        topLine.classList.add('is-colored');
      }
    }

    const dot = document.createElement('span');
    dot.className = 'vehicle-timeline-dot';

    const bottomLine = document.createElement('span');
    bottomLine.className = 'vehicle-timeline-axis-line';
    if (index === itemsToRender.length - 1) {
      bottomLine.classList.add('is-hidden');
    } else if (item && item.status === 'past') {
      bottomLine.classList.add('is-past');
    } else {
      bottomLine.classList.add('is-colored');
    }

    axisEl.append(topLine, dot, bottomLine);

    const stopEl = document.createElement('div');
    stopEl.className = 'vehicle-timeline-stop';

    const nameEl = document.createElement('span');
    nameEl.className = 'vehicle-timeline-name';
    nameEl.textContent = item && item.name ? item.name : '-';

    const timeEl = document.createElement('div');
    timeEl.className = 'vehicle-timeline-time';

    const scheduledSpan = document.createElement('span');
    scheduledSpan.className = 'vehicle-timeline-time-scheduled';
    scheduledSpan.textContent = item && item.scheduledText ? item.scheduledText : (item && item.time ? item.time : '-');

    if (item && item.showEta && item.etaText) {
      scheduledSpan.classList.add('is-overridden');
      const etaSpan = document.createElement('span');
      etaSpan.className = 'vehicle-timeline-time-eta';
      if (item.isEarly) etaSpan.classList.add('is-early');
      if (item.isLate) etaSpan.classList.add('is-late');
      etaSpan.textContent = item.etaText;
      timeEl.append(scheduledSpan, etaSpan);
    } else {
      timeEl.appendChild(scheduledSpan);
    }

    stopEl.append(nameEl, timeEl);
    stepEl.append(axisEl, stopEl);
    steps.appendChild(stepEl);
  });

  if (toggleButton) {
    const canExpand = allItems && baseItems && allItems.length > baseItems.length;
    toggleButton.classList.toggle('is-hidden', !canExpand);
    if (canExpand) {
      const expanded = !!shouldExpand;
      toggleButton.textContent = expanded ? 'Réduire les arrêts' : 'Charger plus d’arrêts';
      toggleButton.setAttribute('aria-expanded', String(expanded));
    } else {
      toggleButton.removeAttribute('aria-expanded');
    }
  }
}


function resolveVehicleBadgeLabel(lineValue) {
  const normalized = typeof lineValue === 'string'
    ? lineValue.trim().toUpperCase()
    : lineValue != null
      ? String(lineValue).trim().toUpperCase()
      : '';
  if (!normalized) return DEFAULT_VEHICLE_BADGE_LABEL;
  return TRAM_LINE_CODES.has(normalized) ? TRAM_VEHICLE_BADGE_LABEL : BUS_VEHICLE_BADGE_LABEL;
}

function updateVehicleInfoPanel(info) {
  if (!vehicleInfoPanel) return;
  vehicleInfoPanel.classList.remove('is-empty');
  const payload = info || {};
  setVehicleInfoField(vehicleInfoFields.id, payload.id);
  setVehicleInfoField(vehicleInfoFields.line, payload.line);
  if (vehicleInfoBadge) {
    vehicleInfoBadge.textContent = resolveVehicleBadgeLabel(payload.line);
  }
  setVehicleInfoField(vehicleInfoFields.destination, payload.destination);
  setVehicleInfoField(vehicleInfoFields.nextStop, payload.nextStop);
  const lineColor = payload.lineColor || DEFAULT_LINE_COLOR;
  vehicleInfoPanel.style.setProperty('--vehicle-line-color', lineColor);
  const timelineData = payload.timeline;
  const timelineMessage = payload.timelineMessage || (timelineData && timelineData.message);
  const timelineKey = payload.timelineKey != null ? String(payload.timelineKey) : (payload.id != null ? String(payload.id) : null);
  renderVehicleTimeline(timelineData, timelineMessage, { key: timelineKey });
  applyVehicleInfoCollapseState();
}

function handleVehicleSelection(vehicleId, info) {
  selectedVehicleId = vehicleId;
  updateVehicleInfoPanel(info);
}

function clearVehicleInfoPanel() {
  if (!vehicleInfoPanel) return;
  selectedVehicleId = null;
  vehicleInfoPanel.classList.add('is-empty');
  vehicleInfoPanel.style.setProperty('--vehicle-line-color', DEFAULT_LINE_COLOR);
  setVehicleInfoField(vehicleInfoFields.id, '-');
  setVehicleInfoField(vehicleInfoFields.line, '-');
  setVehicleInfoField(vehicleInfoFields.destination, '-');
  setVehicleInfoField(vehicleInfoFields.nextStop, '-');
  if (vehicleInfoBadge) {
    vehicleInfoBadge.textContent = DEFAULT_VEHICLE_BADGE_LABEL;
  }
  vehicleTimelineState.isExpanded = false;
  vehicleTimelineState.data = null;
  vehicleTimelineState.key = null;
  vehicleTimelineState.message = DEFAULT_TIMELINE_MESSAGE;
  renderVehicleTimeline(null, DEFAULT_TIMELINE_MESSAGE);
  applyVehicleInfoCollapseState();
}

function hideLoadingOverlay() {
  if (!loadingOverlay) return;
  loadingOverlay.classList.add('is-hidden');
  setTimeout(() => {
    if (loadingOverlay.parentElement) {
      loadingOverlay.parentElement.removeChild(loadingOverlay);
    }
  }, 600);
}

function showLoadingOverlayError(message) {
  if (!loadingOverlay) return;
  if (loadingOverlaySpinner) loadingOverlaySpinner.classList.add('is-hidden');
  if (loadingOverlayText) loadingOverlayText.textContent = message || 'Impossible de charger les données.';
  loadingOverlay.classList.remove('is-hidden');
  loadingOverlay.classList.add('has-error');
}

function normalizeTimeValue(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    const totalSeconds = Math.round(value * 86400);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  const str = String(value).trim();
  if (!str) return '';
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(str)) {
    const [h, m, s = '00'] = str.split(':');
    return `${h.padStart(2, '0')}:${m.padStart(2, '0')}:${s.padStart(2, '0')}`;
  }
  return str;
}

function formatGtfsTime(value) {
  if (value == null || value === '') return '-';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return formatGtfsTime(normalizeTimeValue(value));
  }
  const str = String(value).trim();
  if (!str) return '-';
  const parts = str.split(':');
  if (parts.length < 2) return str;
  let hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return str;
  const dayOffset = Math.floor(hours / 24);
  hours = ((hours % 24) + 24) % 24;
  const formatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  if (dayOffset > 0) {
    return `${formatted}+${dayOffset}`;
  }
  return formatted;
}

function toRadians(deg) {
  return deg * Math.PI / 180;
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  if ([lat1, lon1, lat2, lon2].some(v => v == null || Number.isNaN(v))) return null;
  const R = 6371000; // metres
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function timeStringToSeconds(str) {
  if (!str) return null;
  const parts = String(str).split(':');
  if (parts.length < 2) return null;
  const [h, m, s = '0'] = parts;
  const hours = Number(h);
  const minutes = Number(m);
  const seconds = Number(s);
  if ([hours, minutes, seconds].some(v => !Number.isFinite(v))) return null;
  return hours * 3600 + minutes * 60 + seconds;
}

function getSecondsSinceMidnight(date) {
  return date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
}

function alignScheduleSeconds(value, referenceSeconds) {
  if (value == null) return null;
  if (referenceSeconds == null) return value;
  const DAY = 86400;
  let adjusted = value;
  while (adjusted - referenceSeconds < -DAY / 2) adjusted += DAY;
  while (adjusted - referenceSeconds > DAY / 2) adjusted -= DAY;
  return adjusted;
}

function formatClockFromAbsoluteSeconds(seconds) {
  if (seconds == null || Number.isNaN(seconds)) return '-';
  const DAY = 86400;
  let dayOffset = 0;
  let s = seconds;
  if (s < 0) {
    dayOffset = Math.ceil(-s / DAY);
    s += dayOffset * DAY;
    dayOffset = -dayOffset;
  } else if (s >= DAY) {
    dayOffset = Math.floor(s / DAY);
    s -= dayOffset * DAY;
  }
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const formatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  return dayOffset ? `${formatted}+${dayOffset}` : formatted;
}

function getStopCoordinates(stopId) {
  if (stopId == null) return null;
  const key = String(stopId);
  if (stopCoords[key]) return stopCoords[key];
  const normalized = key.replace(/^0+/, '') || '0';
  if (stopCoords[normalized]) return stopCoords[normalized];
  return null;
}

function getStopDisplayName(stopId) {
  if (stopId == null) return '-';
  const raw = String(stopId);
  if (stopNames[raw]) return stopNames[raw];
  const normalized = raw.replace(/^0+/, '') || '0';
  return stopNames[normalized] || raw;
}

function getTripStopsByTripId(tripId) {
  if (tripId == null) return null;
  const raw = String(tripId);
  if (tripStopTimesMap.has(raw)) return tripStopTimesMap.get(raw);
  const normalized = raw.replace(/^0+/, '') || '0';
  if (tripStopTimesMap.has(normalized)) return tripStopTimesMap.get(normalized);
  return null;
}

function buildVehicleTimelineData(tripId, nextStopId, fallbackStopId, vehiclePosition, referenceSeconds) {
  const stops = getTripStopsByTripId(tripId);
  if (!stops || !stops.length) {
    return { items: null, allItems: null, message: DEFAULT_TIMELINE_MESSAGE };
  }

  const candidates = [];
  const pushCandidate = value => {
    if (value == null || value === '') return;
    const str = String(value);
    if (!str) return;
    candidates.push(str);
    const trimmed = str.replace(/^0+/, '') || '0';
    if (trimmed !== str) candidates.push(trimmed);
  };
  pushCandidate(nextStopId);
  pushCandidate(fallbackStopId);

  let currentIndex = -1;
  for (const candidate of candidates) {
    currentIndex = stops.findIndex(entry => entry.stopId === candidate);
    if (currentIndex !== -1) break;
  }
  if (currentIndex === -1) {
    currentIndex = 0;
  }

  const createEntry = (stop, status) => {
    if (!stop) return null;
    const stopId = stop.stopId;
    if (!stopId) return null;
    const scheduledRaw = stop.departureTime || stop.arrivalTime || '';
    const scheduledSeconds = stop.departureSeconds != null
      ? stop.departureSeconds
      : (stop.arrivalSeconds != null ? stop.arrivalSeconds : timeStringToSeconds(scheduledRaw));
    return {
      status,
      stopId,
      name: getStopDisplayName(stopId),
      scheduledRaw,
      scheduledSeconds,
      scheduledText: formatGtfsTime(scheduledRaw),
      rawStop: stop
    };
  };

  const fullItems = [];
  stops.forEach((stop, idx) => {
    const status = idx < currentIndex ? 'past' : (idx === currentIndex ? 'current' : 'upcoming');
    const entry = createEntry(stop, status);
    if (entry) {
      fullItems.push(entry);
    }
  });

  if (!fullItems.length) {
    return { items: null, allItems: null, message: DEFAULT_TIMELINE_MESSAGE };
  }

  if (!fullItems.some(item => item.status === 'current')) {
    const lastItem = fullItems[fullItems.length - 1];
    if (lastItem) {
      lastItem.status = 'current';
    }
  }

  const summaryItems = [];
  if (currentIndex > 0 && fullItems[currentIndex - 1]) {
    summaryItems.push(fullItems[currentIndex - 1]);
  }

  const MAX_VISIBLE_UPCOMING = 4;
  let upcomingCount = 0;
  for (let idx = Math.max(currentIndex, 0); idx < fullItems.length && upcomingCount < MAX_VISIBLE_UPCOMING; idx++) {
    const entry = fullItems[idx];
    if (!entry) continue;
    summaryItems.push(entry);
    upcomingCount++;
  }

  const nowSeconds = Number.isFinite(referenceSeconds) ? referenceSeconds : getSecondsSinceMidnight(new Date());
  const currentEntry = fullItems[currentIndex] || fullItems.find(item => item.status === 'current') || null;
  const pastEntry = currentIndex > 0 ? fullItems[currentIndex - 1] : null;

  let etaBaseSeconds = null;
  let delaySeconds = null;
  let distanceToCurrent = null;

  if (currentEntry && vehiclePosition && Number.isFinite(vehiclePosition.lat) && Number.isFinite(vehiclePosition.lon)) {
    const currentCoords = getStopCoordinates(currentEntry.stopId);
    if (currentCoords) {
      distanceToCurrent = haversineDistance(vehiclePosition.lat, vehiclePosition.lon, currentCoords.lat, currentCoords.lon);
      if (distanceToCurrent != null) {
        let segmentSpeed = DEFAULT_SPEED_M_S;
        if (pastEntry && pastEntry.rawStop) {
          const prevCoords = getStopCoordinates(pastEntry.stopId);
          const prevSeconds = pastEntry.rawStop.departureSeconds ?? pastEntry.rawStop.arrivalSeconds ?? null;
          const currentSeconds = currentEntry.rawStop.arrivalSeconds ?? currentEntry.rawStop.departureSeconds ?? null;
          let segmentSeconds = null;
          if (currentSeconds != null && prevSeconds != null) {
            segmentSeconds = currentSeconds - prevSeconds;
            if (segmentSeconds <= 0) segmentSeconds += 86400;
          }
          if (prevCoords) {
            const segmentDistance = haversineDistance(prevCoords.lat, prevCoords.lon, currentCoords.lat, currentCoords.lon);
            if (segmentDistance && segmentSeconds && segmentSeconds > 0) {
              const computedSpeed = segmentDistance / segmentSeconds;
              if (computedSpeed > 0.5) {
                segmentSpeed = Math.min(Math.max(computedSpeed, MIN_SPEED_M_S), 35);
              }
            }
          }
        }
        const speed = Math.max(segmentSpeed, MIN_SPEED_M_S);
        let travelSeconds = 0;
        if (distanceToCurrent > 5) {
          travelSeconds = distanceToCurrent / speed;
          if (!Number.isFinite(travelSeconds) || travelSeconds < 0) travelSeconds = 0;
        }
        etaBaseSeconds = nowSeconds + travelSeconds;
        const scheduledSeconds = alignScheduleSeconds(currentEntry.scheduledSeconds, nowSeconds);
        if (scheduledSeconds != null) {
          delaySeconds = etaBaseSeconds - scheduledSeconds;
          currentEntry.etaSeconds = etaBaseSeconds;
          currentEntry.etaText = formatClockFromAbsoluteSeconds(etaBaseSeconds);
          currentEntry.showEta = Math.abs(delaySeconds) > DELAY_THRESHOLD_SECONDS;
          currentEntry.isLate = delaySeconds > DELAY_THRESHOLD_SECONDS;
          currentEntry.isEarly = delaySeconds < -DELAY_THRESHOLD_SECONDS;
          currentEntry.delaySeconds = delaySeconds;
          currentEntry.scheduledAligned = scheduledSeconds;
        }
      }
    }
  }

  const isAtTripOrigin = currentEntry && !pastEntry && distanceToCurrent != null && distanceToCurrent < 40
    && ((currentEntry.rawStop && Number.isFinite(currentEntry.rawStop.sequence)
      && currentEntry.rawStop.sequence <= 1) || currentIndex <= 0);
  if (isAtTripOrigin && delaySeconds != null && delaySeconds < -DELAY_THRESHOLD_SECONDS) {
    delaySeconds = 0;
    if (currentEntry) {
      currentEntry.showEta = false;
      currentEntry.isEarly = false;
      currentEntry.delaySeconds = 0;
    }
  }

  fullItems.forEach(item => {
    item.scheduledText = item.scheduledText || formatGtfsTime(item.scheduledRaw);
    if (item.status === 'past') {
      item.showEta = false;
      return;
    }
    if (delaySeconds != null && item.scheduledSeconds != null && etaBaseSeconds != null) {
      const aligned = alignScheduleSeconds(item.scheduledSeconds, nowSeconds);
      if (aligned != null) {
        const etaSeconds = aligned + delaySeconds;
        item.etaSeconds = etaSeconds;
        item.etaText = formatClockFromAbsoluteSeconds(etaSeconds);
        const diff = Math.abs(etaSeconds - aligned);
        item.showEta = diff > DELAY_THRESHOLD_SECONDS;
        item.isLate = etaSeconds - aligned > DELAY_THRESHOLD_SECONDS;
        item.isEarly = aligned - etaSeconds > DELAY_THRESHOLD_SECONDS;
        item.delaySeconds = etaSeconds - aligned;
      }
    }
  });

  fullItems.forEach(item => {
    if (item.showEta && !item.etaText) {
      item.showEta = false;
    }
  });

  return {
    items: summaryItems,
    allItems: fullItems
  };
}
function hydrateStopTimesMapFromCSV(stopTimesText) {
  tripStopTimesMap.clear();
  if (!stopTimesText) return;
  try {
    const rows = parseCSV(stopTimesText);
    rows.forEach(row => {
      const tripVal = row.trip_id ?? row.TRIP_ID ?? row['trip id'] ?? row['Trip ID'];
      const stopVal = row.stop_id ?? row.STOP_ID ?? row['stop id'] ?? row['Stop ID'];
      const sequenceVal = row.stop_sequence ?? row.STOP_SEQUENCE ?? row['stop sequence'] ?? row['Stop Sequence'];
      if (tripVal == null || stopVal == null || sequenceVal == null) return;

      const tripKey = String(tripVal);
      const tripKeyNoZ = tripKey.replace(/^0+/, '') || '0';
      const stopId = String(stopVal);
      const sequenceNumber = Number(sequenceVal);
      if (!Number.isFinite(sequenceNumber)) return;

      const departureRaw = row.departure_time ?? row.DEPARTURE_TIME ?? row['departure time'] ?? row['Departure Time'];
      const arrivalRaw   = row.arrival_time   ?? row.ARRIVAL_TIME   ?? row['arrival time']   ?? row['Arrival Time'];
      const departureNormalized = normalizeTimeValue(departureRaw ?? arrivalRaw ?? '');
      const arrivalNormalized   = normalizeTimeValue(arrivalRaw   ?? departureRaw ?? '');
      const entry = {
        stopId,
        sequence: sequenceNumber,
        departureTime: departureNormalized,
        arrivalTime: arrivalNormalized,
        departureSeconds: timeStringToSeconds(departureNormalized),
        arrivalSeconds:   timeStringToSeconds(arrivalNormalized)
      };

      let targetList;
      if (tripStopTimesMap.has(tripKey)) {
        targetList = tripStopTimesMap.get(tripKey);
      } else if (tripKey !== tripKeyNoZ && tripStopTimesMap.has(tripKeyNoZ)) {
        targetList = tripStopTimesMap.get(tripKeyNoZ);
        tripStopTimesMap.set(tripKey, targetList);
      } else {
        targetList = [];
        tripStopTimesMap.set(tripKey, targetList);
      }
      if (tripKey !== tripKeyNoZ && !tripStopTimesMap.has(tripKeyNoZ)) {
        tripStopTimesMap.set(tripKeyNoZ, targetList);
      }
      targetList.push(entry);
    });

    // tri par stop_sequence
    const sorted = new Set();
    tripStopTimesMap.forEach(list => {
      if (sorted.has(list)) return;
      list.sort((a, b) => a.sequence - b.sequence);
      sorted.add(list);
    });
  } catch (e) {
    console.warn('Impossible de lire stop_times.txt :', e);
  }
}

if (vehicleInfoPanel) {
  document.addEventListener('click', event => {
    if (vehicleInfoPanel.classList.contains('is-empty')) return;
    const target = event.target;
    if (vehicleInfoPanel.contains(target)) return;
    if (target.closest('.leaflet-popup') || target.closest('.leaflet-marker-icon')) return;
    if (target.closest('.leaflet-control') || target.closest('.maptool-ignore-close')) return;
    if (target.closest('#map')) return;
    clearVehicleInfoPanel();
  });
}


// ==================================
// 3. INITIALISATION DE LA CARTE
// ==================================

const map = L.map('map').setView([47.4736, -0.5541], 13);

initTileLayers();
map.addLayer(lightTileLayer);
applyDayNightMode();


// ==================================
// 4. DESSIN DES LIGNES FILTRÉES
// ==================================

function updateLines() {
  if (linesLayer) map.removeLayer(linesLayer);
  linesLayer = L.geoJSON(linesGeoJSON, {
    filter: feature => selectedRoutes.has(normalizeRouteId(feature.properties.route_id)),
    style: feature => ({
      color: '#' + feature.properties.route_color,
      weight: 3,
      opacity: 0.7
    }),
    onEachFeature: (f, layer) => {
      const p = f.properties;
      let route_num = p.route_id
      if (route_num >= 20 && route_num <= 25){
        route_num = "E"+route_num
      }
      layer.bindPopup(`Ligne ${route_num}${p.route_long_name ? ` – ${p.route_long_name}` : ''}`);
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
  /*const hex = /^[0-9a-f]{3,8}$/i.test(color) ? color : 'ff0000';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg"
         viewBox="0 0 448 512"
         width="24" height="24"
         style="display:block">
      <path fill="#${hex}"
            stroke="#ffffff"
            stroke-width="28"
            paint-order="stroke fill"
            d="M86.8 48c-12.2 0-23.6 5.5-31.2 15L42.7 79C34.5 89.3 19.4 91 9 82.7S-3 59.4 5.3 49L18 33C34.7 12.2 60 0 86.8 0L361.2 0c26.7 0 52 12.2 68.7 33l12.8 16c8.3 10.4 6.6 25.5-3.8 33.7s-25.5 6.6-33.7-3.7L392.5 63c-7.6-9.5-19.1-15-31.2-15L248 48l0 48 40 0c53 0 96 43 96 96l0 160c0 30.6-14.3 57.8-36.6 75.4l65.5 65.5c7.1 7.1 2.1 19.1-7.9 19.1l-39.7 0c-8.5 0-16.6-3.4-22.6-9.4L288 448l-128 0-54.6 54.6c-6 6-14.1 9.4-22.6 9.4L43 512c-10 0-15-12.1-7.9-19.1l65.5-65.5C78.3 409.8 64 382.6 64 352l0-160c0-53 43-96 96-96l40 0 0-48L86.8 48zM160 160c-17.7 0-32 14.3-32 32l0 32c0 17.7 14.3 32 32 32l128 0c17.7 0 32-14.3 32-32l0-32c0-17.7-14.3-32-32-32l-128 0zm32 192a32 32 0 1 0 -64 0 32 32 0 1 0 64 0zm96 32a32 32 0 1 0 0-64 32 32 0 1 0 0 64z"/>
    </svg>
  `.trim();

  return L.divIcon({
    className: '',
    html: svg,
    iconSize: [28,28],
    iconAnchor: [14,14]
  });*/
  return L.divIcon({
    className: '',
    html: `<i class="fas fa-train-tram" style="color:#${color};font-size:26px;text-shadow:0 0 3px #000;"></i>`,
    iconSize: [24,24],
    iconAnchor: [12,12]
  });
}




// ==================================
// 6. CHARGEMENT DES DONNÉES (ARRÊTS + LIGNES)
// ==================================

Promise.all([
  fetch('stops.txt').then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.text(); })
    .then(text => {
      const rows = parseCSV(text);
      return rows.map(row => {
        const stopId = row.stop_id ?? row.STOP_ID ?? row['Stop ID'];
        const stopName = row.stop_name ?? row.STOP_NAME ?? row['Stop Name'];
        const stopLat = row.stop_lat ?? row.STOP_LAT ?? row['Stop Lat'];
        const stopLon = row.stop_lon ?? row.STOP_LON ?? row['Stop Lon'];
        
        return {
          stop_id: stopId,
          stop_name: stopName,
          stop_coordinates: {
            lat: Number(stopLat),
            lon: Number(stopLon)
          }
        };
      });
    }),
  fetch('irigo_gtfs_lines.geojson').then(r => r.json()),
  fetch('trips.txt').then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.text(); }),
  fetch('stop_times.txt').then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.text(); })
])
.then(([stops, geojson, tripsText, stopTimesText]) => {
  stopsData = stops;
  linesGeoJSON = geojson;

  // hydrate stop_times depuis CSV
  hydrateStopTimesMapFromCSV(stopTimesText);

  // Construire stopNames/coords et lineColors
  stops.forEach(s => {
    if (!s || s.stop_id == null) return;
    const sid = String(s.stop_id);
    const sidNoZ = sid.replace(/^0+/, '') || '0';
    stopNames[sid] = s.stop_name;
    if (!(sidNoZ in stopNames)) stopNames[sidNoZ] = s.stop_name;
    if (s.stop_coordinates && Number.isFinite(s.stop_coordinates.lat) && Number.isFinite(s.stop_coordinates.lon)) {
      const coords = { lat: Number(s.stop_coordinates.lat), lon: Number(s.stop_coordinates.lon) };
      stopCoords[sid] = coords;
      if (!(sidNoZ in stopCoords)) stopCoords[sidNoZ] = coords;
    }
  });
  geojson.features.forEach(f => {
    const rid = normalizeRouteId(f.properties.route_id);
    if (!rid) return;
    lineColors[rid] = normalizeHexColor(f.properties.route_color);
  });

  // Définit les catégories et leurs lignes
  const categories = [
    { title: 'Tramway',             routes: ['A','B','C'] },
    { title: 'Lignes majeures',     routes: ['01','02','03','04'] },
    { title: 'Lignes de proximité', routes: ['05','06','07','08','09','10','11','12'] },
    { title: 'Lignes express',      routes: ['20','21','22','23','24','25'] },
    { title: 'Lignes suburbaines',  routes: Array.from({length:13}, (_,i) =>
                                        String(30 + i).padStart(2,'0')) }
  ];

  // Initialise panneau de filtres
  const filterPanel = filterPanelEl;
  const filterHeader = filterPanel ? filterPanel.querySelector('strong') : null;
  const filterList = filterListEl;

  if (filterHeader) {
    filterHeader.textContent = 'Filtrer les lignes';
  }

  if (filterList) {
    filterList.innerHTML = '';
  }
  routeCountBadges.clear();

  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'toggle-all-btn';
  toggleBtn.textContent = 'Tout cocher';
  toggleBtn.addEventListener('click', () => {
    if (!filterList) return;
    const allCheckboxes = filterList.querySelectorAll('input[type="checkbox"]');
    const selectAll = toggleBtn.textContent === 'Tout cocher';
    allCheckboxes.forEach(chk => {
      chk.checked = selectAll;
      const rid = chk.value;
      if (selectAll) {
        selectedRoutes.add(rid);
      } else {
        selectedRoutes.delete(rid);
      }
    });
    toggleBtn.textContent = selectAll ? 'Tout décocher' : 'Tout cocher';
    localStorage.setItem('selectedRoutes', JSON.stringify(Array.from(selectedRoutes)));
    updateLines();
    updateVehicles();
  });

  if (filterList) {
    filterList.appendChild(toggleBtn);

    categories.forEach(cat => {
      const catTitle = document.createElement('div');
      catTitle.textContent = cat.title;
      catTitle.style.fontWeight = 'bold';
      catTitle.style.margin = '8px 0 4px';
      filterList.appendChild(catTitle);

      cat.routes.forEach(routeId => {
        const routeKey = normalizeRouteId(routeId);
        if (!routeKey || !(routeKey in lineColors)) return;

        const palette = computeBadgePalette(lineColors[routeKey]);

        const wrapper = document.createElement('div');
        wrapper.classList.add('checkbox-wrapper');
        wrapper.style.setProperty('--line-color', palette.base);

        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.id = 'chk-' + routeKey;
        chk.value = routeKey;
        chk.checked = selectedRoutes.has(routeKey);

        const lbl = document.createElement('label');
        lbl.htmlFor = chk.id;
        lbl.style.setProperty('--line-color', palette.base);

        const labelText = document.createElement('span');
        labelText.className = 'filter-line-label-text';
        labelText.textContent = formatRouteLabel(routeKey);
        labelText.style.color = palette.base;

        const countBadge = document.createElement('span');
        countBadge.className = 'filter-line-count';
        countBadge.textContent = '0';
        applyCountBadgePalette(countBadge, palette);
        routeCountBadges.set(routeKey, countBadge);

        lbl.append(labelText, countBadge);

        chk.addEventListener('change', () => {
          const key = chk.value;
          if (chk.checked) {
            selectedRoutes.add(key);
          } else {
            selectedRoutes.delete(key);
          }
          localStorage.setItem('selectedRoutes', JSON.stringify(Array.from(selectedRoutes)));
          updateLines();
          updateVehicles();
        });

        wrapper.append(chk, lbl);
        filterList.appendChild(wrapper);
      });
    });

    const allCheckboxes = filterList.querySelectorAll('input[type="checkbox"]');
    const allSelected = allCheckboxes.length > 0 && Array.from(allCheckboxes).every(chk => chk.checked);
    toggleBtn.textContent = allSelected ? 'Tout décocher' : 'Tout cocher';
  }

  updateFilterVehicleCounts(latestVehicleCounts);

  // Construit la map avec clés normalisées (avec et sans zéros initiaux)
  const tripsRows = parseCSV(tripsText);
  window.tripHeadsignMap = tripsRows.reduce((map, row) => {
    const idVal = row.trip_id ?? row.TRIP_ID ?? row['Trip ID'] ?? row['tripId'];
    const head  = row.trip_headsign ?? row.headsign ?? row.destination ?? row['Trip Headsign'] ?? row['trip Headsign'];
    if (idVal != null && head != null && head !== '') {
      const k = String(idVal);
      const kNoZ = (k.replace(/^0+/, '') || '0');
      map[k] = head;
      if (!(kNoZ in map)) map[kNoZ] = head;
    }
    return map;
  }, {});


  // Initial render
  updateLines();
  initStopsLayer();
  updateVehicles().finally(() => hideLoadingOverlay());
  setInterval(updateVehicles, UPDATE_INTERVAL_MS);
})
.catch(err => {
  console.error('Échec chargement initial :', err);
  showLoadingOverlayError('Impossible de charger les données. Veuillez réessayer plus tard.');
});


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
      if(locateMarker) map.removeLayer(locateMarker); // Supprime l'ancien marqueur

      // Marqueur temporaire "Vous êtes ici"
      locateMarker = L.marker([latitude, longitude])
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
const UPDATE_INTERVAL_MS = 30000;
const timerEl = document.getElementById('update_timer');
let remainingTime = UPDATE_INTERVAL_MS / 1000;
function updateTimerDisplay() {
  timerEl.textContent = `Mise à jour dans ${remainingTime}s`;
}
updateTimerDisplay();
setInterval(() => {
  if (remainingTime > 0) {
    remainingTime--;
    updateTimerDisplay();
  }
}, 1000);

let markers = [];
async function chargerVehicules() {
  markers.forEach(m => map.removeLayer(m));
  markers = [];
  let trackedMarker = null;
  let selectedVehicleStillVisible = false;
  try {
    const resp = await fetch('https://web-production-c4b0.up.railway.app/vehicules-irigo.json');
    //const resp = await fetch('http://localhost:5000/vehicules-irigo.json');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const routeCounts = new Map();
    data.forEach(v => {
      const routeKey = normalizeRouteId(v.route_id);
      if (!routeKey) return;
      routeCounts.set(routeKey, (routeCounts.get(routeKey) || 0) + 1);
    });
    updateFilterVehicleCounts(routeCounts);

    const referenceSeconds = getSecondsSinceMidnight(new Date());
    data.forEach(v => {
      const routeKey = normalizeRouteId(v.route_id);
      if (!routeKey || !selectedRoutes.has(routeKey)) return;

      const lineColorHex = normalizeHexColor(lineColors[routeKey]);
      const sanitizedColor = lineColorHex.slice(1);
      const icon = ['A','B','C'].includes(routeKey)
        ? getTramIcon(sanitizedColor)
        : getBusIcon(sanitizedColor);

      const displayLine = formatRouteLabel(routeKey);

      let busLabel = v.id;
      if (busLabel && busLabel.length > 4) busLabel = 'Bus Suburbain';

      const tripKey = v.trip_id != null ? String(v.trip_id) : '';
      const tripKeyNoZ = tripKey.replace(/^0+/, '') || '0';
      const headsign = window.tripHeadsignMap[tripKey] ?? window.tripHeadsignMap[tripKeyNoZ] ?? '-';

      const nextStopId = v.next_stop != null ? v.next_stop : v.stop_id;
      const fallbackStopId = v.stop_id;
      const nextStopName = getStopDisplayName(nextStopId);
      const timelineResult = buildVehicleTimelineData(
        tripKey || tripKeyNoZ,
        nextStopId,
        fallbackStopId,
        { lat: Number(v.latitude), lon: Number(v.longitude) },
        referenceSeconds
      );
      const timelineMessage = timelineResult ? timelineResult.message : undefined;

      const infoPayload = {
        id: busLabel,
        line: displayLine || '-',
        destination: headsign,
        nextStop: nextStopName,
        lineColor: lineColorHex,
        timeline: timelineResult,
        timelineMessage,
        timelineKey: v.id != null ? String(v.id) : null
      };

      const followLabel = trackedBusId === v.id
        ? 'Arrêter le suivi'
        : 'Suivre ce véhicule';
      const popupHtml = `
        <div class="vehicle-popup">
          <button class="follow-btn" data-id="${v.id}">${followLabel}</button>
        </div>
      `.trim();

      const m = L.marker([v.latitude, v.longitude], { icon })
        .addTo(map)
        .bindPopup(popupHtml);

      m.on('popupopen', e => {
        handleVehicleSelection(v.id, infoPayload);
        const btn = e.popup.getElement().querySelector('.follow-btn');
        if (!btn) return;
        btn.addEventListener('click', () => {
          if (trackedBusId === v.id) {
            trackedBusId = null;
            trackedPopupOpen = false;
            trackedBusLabel = null;
            btn.textContent = 'Suivre ce véhicule';
            updateTrackHint();
          } else {
            trackedBusId = v.id;
            trackedPopupOpen = true;
            trackedBusLabel = busLabel;
            btn.textContent = 'Arrêter le suivi';
            updateTrackHint();
            map.setView(m.getLatLng(), map.getZoom());
          }
        });
      });

      if (selectedVehicleId === v.id) {
        selectedVehicleStillVisible = true;
        updateVehicleInfoPanel(infoPayload);
      }

      markers.push(m);
      if (trackedBusId === v.id) {
        trackedMarker = m;
      }
    });

    if (selectedVehicleId && !selectedVehicleStillVisible) {
      clearVehicleInfoPanel();
    }

    if (trackedMarker) {
      trackedMarker.openPopup();
      map.setView(trackedMarker.getLatLng(), map.getZoom());
    } else if (trackedBusId) {
      trackedBusId = null;
      trackedBusLabel = null;
      trackedPopupOpen = false;
      updateTrackHint();
    }
  } catch (e) {
    console.warn('Impossible de charger les véhicules :', e);
  }
}



async function updateVehicles() {
  remainingTime = UPDATE_INTERVAL_MS / 1000;
  updateTimerDisplay();
  await chargerVehicules();
}
