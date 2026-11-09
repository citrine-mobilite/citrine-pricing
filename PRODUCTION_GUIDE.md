# Guide de Déploiement en Production - Citrine Mobilité

Ce guide détaille pas-à-pas la procédure pour déployer l'application **Citrine Mobilité** sur votre infrastructure de production avec **Node.js** et **MySQL / MariaDB**.

---

## 1. Pourquoi quitter Vercel pour la Production ?

Vercel est une plateforme conçue pour le *serverless* (fonctions éphémères avec un temps d'exécution maximal strict de 10 à 60 secondes et un système de fichiers en lecture seule).
Pour notre application de veille tarifaire :
- Les collectes de tarifs multi-trajets nécessitent des connexions continues et des temps d'exécution qui dépassent les quotas Vercel.
- Le pool de connexions MySQL est beaucoup plus stable et réactif lorsqu'il est maintenu en permanence par un serveur Node.js actif.
- Vous disposez ainsi d'une bande passante illimitée et d'un contrôle total sur votre base de données locale ou dédiée.

---

## 2. Prérequis sur votre Serveur de Production

- **Système d'exploitation** : Ubuntu 22.04 LTS / Debian 12 / AlmaLinux (ou tout VPS / Serveur dédié / Conteneur Docker).
- **Node.js** : Version 20.x ou 22.x LTS (`node -v`).
- **NPM** : Version 10.x+ (`npm -v`).
- **MySQL** : Version 8.0+ ou **MariaDB** 10.6+ (`mysql -V`).
- **PM2** (Recommandé pour maintenir l'application active en arrière-plan) :
  ```bash
  npm install -g pm2
  ```

---

## 3. Configuration de la Base de Données MySQL

### Option A : Importation manuelle du schéma (phpMyAdmin ou terminal)
Un script SQL complet prêt à l'emploi est fourni à la racine du projet : `schema.mysql.sql`.

Dans le terminal de votre serveur :
```bash
mysql -u root -p < schema.mysql.sql
```
Ou dans **phpMyAdmin** :
1. Créez la base `citrine_db` avec l'encodage `utf8mb4_unicode_ci`.
2. Cliquez sur l'onglet **Importer**, sélectionnez le fichier `schema.mysql.sql` et validez.

### Option B : Auto-création au démarrage
L'application crée automatiquement toutes les tables au premier démarrage si la base de données existe et que l'utilisateur MySQL a les droits `CREATE TABLE`.

---

## 4. Configuration des Variables d'Environnement (.env)

Créez un fichier `.env` à la racine de l'application sur votre serveur de production :

```env
# Port d'écoute du serveur Node.js (3000 par défaut)
PORT=3000
NODE_ENV=production

# ----------------- CONFIGURATION MYSQL -----------------
# Vous pouvez renseigner soit une URL complète :
DATABASE_URL=mysql://citrine_user:VotreMotDePasseFort@127.0.0.1:3306/citrine_db

# Ou les variables séparées standard :
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=citrine_user
MYSQL_PASSWORD=VotreMotDePasseFort
MYSQL_DATABASE=citrine_db

# ----------------- SÉCURITÉ & SESSION -----------------
JWT_SECRET=CleSecreteTresLongueEtAleatoireCitrine2026
```

---

## 5. Installation et Compilation

Sur le serveur :

```bash
# 1. Cloner ou transférer le code
cd /var/www/citrine-app

# 2. Installer les dépendances
npm install --production=false

# 3. Compiler l'interface React Vite pour la production
npm run build
```

Le build génère le dossier `dist/` qui sera servi directement par Express.

---

## 6. Démarrage de l'Application

### Avec PM2 (Process Manager - Recommandé)
```bash
# Lancer le serveur avec 1 instance ou cluster
pm2 start server.ts --name "citrine-pricing" --interpreter ./node_modules/.bin/tsx

# Configurer le redémarrage automatique en cas de reboot du serveur
pm2 startup
pm2 save
```

### Vérifier les logs en temps réel
```bash
pm2 logs citrine-pricing
```

---

## 7. Configuration du Reverse Proxy Nginx avec SSL (HTTPS Gratuit Let's Encrypt)

Fichier de configuration Nginx (`/etc/nginx/sites-available/citrine.conf`) :

```nginx
server {
    server_name pricing.votre-domaine.cm;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
    }
}
```

Activation et certificat SSL HTTPS :
```bash
ln -s /etc/nginx/sites-available/citrine.conf /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
certbot --nginx -d pricing.votre-domaine.cm
```

---

## 8. Identifiants de Connexion par Défaut (Démarrage à Zéro)

Au premier lancement, si votre base de données est vierge, le compte Super Administrateur suivant est automatiquement créé :

- **Email** : `citrinemobilite@gmail.com`
- **Mot de passe** : `Citrine2026!`

Une fois connecté, vous pourrez changer ce mot de passe ou créer d'autres utilisateurs depuis l'onglet **Gestion des Utilisateurs**.

---

## 9. Récapitulatif des Changements Effectués

1. **Désactivation des Cron Jobs** : Tous les minuteurs automatiques d'arrière-plan ont été arrêtés.
2. **Transition vers MySQL** : Connecteur natif performant `mysql2` avec support des transactions et pools de connexions persistants.
3. **Suppression intégrale du Cache** : Plus de stockage IndexedDB ni LocalStorage qui masquait les données de la base. Chaque vue, chaque liste de villes, quartiers ou campagnes consulte en direct la base de données MySQL.
4. **Démarrage à Zéro** : Schéma propre sans données de test résiduelles.
