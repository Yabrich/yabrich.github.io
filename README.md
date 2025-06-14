# YabHereWeGo

Cette page web affiche une carte interactive du réseau Irigo grâce à la bibliothèque Leaflet. Elle est accessible à l'adresse [yabrich.github.io](https://yabrich.github.io).

## Fonctionnalités

- **Localisation** : bouton *Me localiser* pour centrer la carte sur votre position.
- **Mode sombre/clair** : le fond de carte bascule automatiquement selon l'heure (lever/coucher du soleil).
- **Affichage détaillé des véhicules** : en cliquant sur un véhicule, vous obtenez son numéro de parc, la ligne, le prochain arrêt et la destination.
- **Suivi de véhicule** : depuis la fenêtre d'information d'un véhicule, cliquez sur *Suivre ce véhicule* pour que la carte reste centrée sur lui.
- **Filtre des lignes** : choisissez les lignes à afficher. Les lignes sélectionnées sont mémorisées. Les lignes disponibles vont du tramway **A**, **B**, **C** aux bus **01** à **42**.

## Fichiers principaux

- `index.html` : structure de la page et intégration de Leaflet.
- `script.js` : logique de la carte (filtrage des lignes, localisations, récupération des véhicules...).
- `irigo_gtfs_lines.geojson` : géométries des lignes du réseau.
- `horaires-theoriques-et-arrets-du-reseau-irigo-gtfs.json` : arrêts et informations GTFS.
- `irigo_trips.xlsx` : tableau des voyages du réseau extrait du GTFS (lignes, arrêt départ, destination, horaires).

## Utilisation

Le site s'utilise directement via [yabrich.github.io](https://yabrich.github.io).

Pour un usage __hors ligne__, il est nécessaire d’utiliser un serveur local (par exemple : `Live Server`, `http-server`, `python -m http.server`, etc.). En effet, ouvrir directement `index.html` dans le navigateur peut entraîner des dysfonctionnements liés aux restrictions CORS (Cross-Origin Resource Sharing) qui bloquent certaines requêtes locales, notamment pour le chargement de fichiers JSON ou GeoJSON.

Cette page télécharge régulièrement la position des véhicules via l'API externe `https://ara-api.enroute.mobi/irigo/gtfs/vehicle-positions` (toutes les 30 s environ). Une connexion Internet est donc requise pour cette fonctionnalité ainsi que pour charger les tuiles de carte.

## Illustration

![Aperçu de la carte](img/map.png)
