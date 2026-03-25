# 🌍 Track'Irigo — Carte temps réel Irigo  
![Version](https://img.shields.io/badge/version-1.1.2-blue?style=for-the-badge)

Une carte interactive pensée pour rendre les déplacements sur le réseau **Irigo (Angers Loire Métropole)** plus simples et plus visuels.

Accessible ici : **https://railway.yabrich.fr**

---

## ✨ Pourquoi ce projet ?
Il n’existe pas d’outil vraiment agréable pour visualiser **en direct** les bus et trams Irigo.

---

## 🚀 Fonctionnalités principales

### 🚌 Véhicules en temps réel  
- Affichage instantané des véhicules du réseau.  
- Clic sur un véhicule pour voir :  
  - son numéro de parc  
  - sa ligne  
  - sa destination  
  - son prochain arrêt

### 🎯 Suivi intelligent  
- Bouton **Suivre ce véhicule** pour garder la carte centrée automatiquement sur le véhicule choisi.

### 🌓 Ambiance automatique (jour/nuit)  
- Le fond de carte bascule selon l’heure locale grâce au calcul du lever/coucher du soleil.

### 🗺️ Filtrer les lignes  
- Sélectionner les lignes à afficher :  
  - Tram A / B / C  
  - Bus 01 → 42  
- Idéal pour alléger la carte.

### 📍 Me localiser  
- Permet de centrer la carte sur sa position en un clic.

---

## 📁 Structure du projet

### Fichiers principaux
- **index.html** — Structure générale et intégration Leaflet  
- **script.js** — Logique : récupération véhicules, suivi, filtres, ambiance, interactions  
- **style.css** — Styles, thèmes, animations, mode jour/nuit  
- **horaires-theoriques-et-arrets-du-reseau-irigo-gtfs.json** — Données GTFS retravaillées  
- **irigo_gtfs_lines.geojson** — Tracés des lignes du réseau

### Outils annexes
- **inspect_xlsx.py** — Analyse du GTFS  
- **http_server.py** — Serveur local pour tests  
- **old_excel/** — Archivage des anciennes versions/extracts GTFS

---

Les données temps réel et les fonds de carte nécessitent une connexion Internet.
