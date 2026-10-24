# 🚖 Citrine Pricing — Plateforme d'Intelligence Tarifaire & Benchmark VTC

**Citrine Pricing** est une plateforme SaaS d'analyse de marché et de comparaison tarifaire en temps réel pour les services de transport VTC (Véhicules de Transport avec Chauffeur) en Afrique Centrale (Cameroun, Douala, Yaoundé).

La plateforme permet d'exécuter des campagnes de relever de prix automatisées entre des centaines de paires de quartiers, d'agréger les tarifs réels de plusieurs plateformes concurrentes (**Yango**, **Hero Cab**, **Trip Master**) et de produire des analyses décisionnelles et des exports statistiques.

---

## 🌟 Fonctionnalités Principales

### ⚡ 1. Moteur de Tarification Parallèle Haute Performance
* **Relevé multi-agrégateurs** : Interrogation simultanée en direct des API de Yango (4 classes : Éco, Confort, Confort+, Moto), Hero Cab (Standard, Confort, SUV, PerKm) et Trip Master (Éco, Confort, Moto).
* **Exécution par lots & Workers parallèles** : Découpage intelligent des trajets inter-quartiers en lots pour maximiser la vitesse d'exécution tout en respectant les limites de fréquence (rate limiting).
* **Test de trajet unique (Quick Test)** : Module d'estimation instantanée entre deux quartiers avec comparaison directe côte à côte et copie rapide des données.

### 📊 2. Tableaux de Bord & Matrices de Prix
* **Tableau de bord décisionnel** : Suivi du nombre de villes monitorées, des campagnes actives, des tarifs moyens et des écarts de compétitivité (FCFA).
* **Matrice Départ ➔ Arrivée** : Vue synthétique croisée sous forme de grille interactive pour analyser d'un coup d'œil les tarifs d'une ville entière.
* **Alertes de fin de campagne** : Notifications visuelles synthétiques indiquant le montant moyen économisé, le transporteur le moins cher et la durée totale d'exécution.

### 📍 3. Gestion des Villes & Quartiers
* **Gestion multi-villes** : Configuration des paramètres géographiques (coordonnées GPS du centre, devises FCFA/XAF).
* **Import/Export de masse** : Importation de listes de quartiers depuis Excel/CSV et basculement collectif (Activation / Désactivation par zone).
* **Découpage par typologie de zone** : Classification des quartiers (Centre-ville, Résidentiel, Commercial, Populaire, Aéroport).

### 👥 4. Gestion des Utilisateurs & Rôles (RBAC)
* **Système de rôles à 3 niveaux** :
  * **Administrateur** : Accès complet, gestion des utilisateurs, suppression des données et configuration système.
  * **Responsable Opérations** : Gestion des villes, des quartiers et lancement des campagnes tarifaires.
  * **Opérateur / Employé** : Consultation des tableaux de bord, exécution des tests et téléchargement des rapports.
* **Sécurité des identifiants** : Authentification avec hachage sécurisé `bcrypt` avec Salt.

### 📑 5. Exports de Données & Formats
* **Excel (XLSX)** : Export structuré avec feuilles récapitulatives et détails par trajet.
* **CSV** : Fichier encodé en UTF-8 avec BOM pour une compatibilité parfaite avec Microsoft Excel et Google Sheets.
* **PDF** : Mise en page imprimable haute définition avec en-tête d'entreprise, statistiques globales et grilles de trajets.
* **JSON Canonique Ultra-Léger** : Format optimisé à structure minimale pour le stockage et l'intégration externe.

---

## 🏗️ Architecture Technique

```
┌─────────────────────────────────────────────────────────┐
│                   React 19 + Vite                       │
│      (Tailwind CSS v4, Lucide Icons, SweetAlert2)       │
└────────────────────────────┬────────────────────────────┘
                             │ API REST JSON
┌────────────────────────────▼────────────────────────────┐
│                  Serveur Express (Node.js)              │
│       (Engine de Calcul, Workers Parallèles, Bcrypt)    │
└──────────────┬─────────────────────────────┬────────────┘
               │                             │
┌──────────────▼──────────────┐  ┌───────────▼───────────┐
│     Firebase Firestore      │  │  APIs VTC Tiers Direct│
│ (Stockage Canonique & Rules)│  │ (Yango, Hero, TripM.) │
└─────────────────────────────┘  └───────────────────────┘
```

* **Frontend** : React 19, Vite, TypeScript, Tailwind CSS v4, Lucide React, SweetAlert2.
* **Backend** : Node.js, Express, TSX.
* **Base de Données** : Firebase Firestore avec mécanisme de partitionnement automatique (documents garantis < 400 Ko pour respecter la limite de 1 Mo) et cache réactif en mémoire.
* **Déploiement** : Prêt pour déploiement Serverless sur Vercel avec configuration `vercel.json`.

---

## 📂 Structure du Projet

```text
├── api/                    # Handler Serverless Vercel (api/index.ts)
├── server/                 # Code source du serveur Node.js / Express
│   ├── db/                 # Connexion Firestore & Store mémoire
│   │   ├── firestore.ts    # Client Firebase & helpers d'écriture sécurisée
│   │   └── memoryStore.ts  # Cache mémoire réactif & synchronisation
│   ├── routes/             # Endpoints de l'API REST
│   │   ├── authRoutes.ts   # Authentification & Utilisateurs
│   │   ├── cityRoutes.ts   # Villes & Quartiers
│   │   ├── campaignRoutes.ts # Moteur de Campagnes & Résultats
│   │   └── settingsRoutes.ts # Paramètres & Tests de routes uniques
│   ├── services/           # Connecteurs API VTC & Moteur de calcul
│   │   ├── campaignEngine.ts # Execution asynchrone des campagnes
│   │   ├── yangoService.ts   # Connecteur Yango Routestats
│   │   ├── heroService.ts    # Connecteur Hero Cab
│   │   └── tripMasterService.ts # Connecteur Trip Master Cameroon
│   └── types.ts            # Définitions TypeScript serveur
├── src/                    # Application Frontend React
│   ├── components/         # Composants UI (Dashboard, Pricing, Villes, Users...)
│   ├── context/            # AuthContext (Gestion de session)
│   ├── services/           # Client API (src/services/api.ts)
│   ├── types/              # Interfaces TypeScript frontend
│   └── utils/              # Fonctions d'export (Excel, CSV, PDF, JSON)
├── firebase-applet-config.json # Configuration du projet Firebase
├── firestore.rules         # Règles de sécurité Cloud Firestore
├── vercel.json             # Configuration de déploiement Vercel
├── server.ts               # Point d'entrée principal du serveur Express
└── package.json            # Dépendances & scripts du projet
```

---

## 🚀 Installation & Lancement en Local

### Prérequis
* **Node.js** v20.x ou version supérieure
* **npm** ou **yarn**

### 1. Installation des dépendances
```bash
npm install
```

### 2. Configuration des variables d'environnement
Créez un fichier `.env` à la racine du projet si nécessaire :
```env
PORT=3000
NODE_ENV=development
```

### 3. Lancement en mode développement
Cette commande démarre simultanément le serveur backend Express et le serveur de dev Vite :
```bash
npm run dev
```
Accédez ensuite à l'application dans votre navigateur à l'adresse : `http://localhost:3000`.

---

## 🛠️ Build & Production

### Validation du code & Typage
```bash
npm run lint
```

### Compilation Frontend & Backend
```bash
npm run build
```

### Démarrage du serveur en production
```bash
npm start
```

---

## 🔌 Endpoints API Principaux

| Méthode | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Authentification utilisateur & génération de jeton |
| `GET` | `/api/users` | Liste des utilisateurs enregistrés |
| `GET` | `/api/cities` | Liste des villes avec comptage des quartiers |
| `GET` | `/api/neighborhoods?cityId=...` | Liste des quartiers filtrés par ville |
| `POST` | `/api/campaigns/start` | Lancement d'une campagne de tarification (rapide ou complète) |
| `GET` | `/api/campaigns/:id/results` | Résultats détaillés des trajets d'une campagne |
| `GET` | `/api/campaigns/:id/canonical-json` | Export au format JSON canonique ultra-léger |
| `POST` | `/api/routestats` | Test d'estimation tarifaire instantané entre 2 coordonnées GPS |
| `GET` | `/api/yango/last-raw-json` | Inspection de la dernière réponse JSON réseau brute de Yango (Cache mémoire) |

---

## 🔒 Sécurité & Confidentialité

* Mots de passe utilisateurs hachés avec la bibliothèque `bcrypt` (10 tours de salt).
* Sanitization stricte des objets JSON transmis à Firestore pour éliminer les valeurs `undefined`.
* Contournement automatique en cache mémoire en cas d'atteinte du quota journalier Firestore.
* Règles de sécurité Firestore (`firestore.rules`) contrôlant les droits de lecture et d'écriture par collection.

---

## 📄 Licence

Ce projet est la propriété exclusive de **Citrine Mobilité**. Tous droits réservés.
