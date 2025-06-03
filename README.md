# Irigo Lines Map

Cette page web affiche une carte interactive du réseau Irigo grâce à la bibliothèque Leaflet.

## Fichiers principaux

- `index.html` : structure de la page et intégration de Leaflet.
- `script.js` : logique de la carte (filtrage des lignes, localisations, récupération des véhicules...).
- `irigo_gtfs_lines.geojson` : géométries des lignes du réseau.
- `horaires-theoriques-et-arrets-du-reseau-irigo-gtfs.json` : arrêts et informations GTFS.

## Utilisation locale

Ouvrez simplement `index.html` dans votre navigateur. Aucun serveur spécifique n'est nécessaire.

Cette page télécharge régulièrement la position des véhicules via l'API externe `https://web-production-c4b0.up.railway.app/vehicules-irigo.json` (toutes les 30 s environ). Une connexion Internet est donc requise pour cette fonctionnalité ainsi que pour charger les tuiles de carte.
