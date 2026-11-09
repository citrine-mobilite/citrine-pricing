-- =============================================================================
-- CITRINE MOBILITÉ - SCHÉMA DE PRODUCTION MYSQL
-- Compatible MySQL 5.7+, MySQL 8.0+, MariaDB 10.3+
-- Encodage UTF8MB4 (support complet des accents, devises et émojis)
-- =============================================================================

CREATE DATABASE IF NOT EXISTS `citrine_db` 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE `citrine_db`;

-- 1. TABLE DES UTILISATEURS
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `uuid` VARCHAR(64) NOT NULL UNIQUE,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `role` VARCHAR(50) NOT NULL DEFAULT 'employe',
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `password_hash` VARCHAR(255) DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `last_login_at` DATETIME DEFAULT NULL,
  INDEX `idx_users_email` (`email`),
  INDEX `idx_users_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. TABLE DES VILLES
CREATE TABLE IF NOT EXISTS `cities` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `uuid` VARCHAR(64) NOT NULL UNIQUE,
  `name` VARCHAR(255) NOT NULL,
  `country` VARCHAR(255) NOT NULL DEFAULT 'Cameroun',
  `currency` VARCHAR(10) NOT NULL DEFAULT 'XAF',
  `currency_symbol` VARCHAR(20) NOT NULL DEFAULT 'FCFA',
  `center` JSON DEFAULT NULL,
  `airport` JSON DEFAULT NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `auto_schedule` JSON DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_cities_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. TABLE DES QUARTIERS (POINTS DE DÉPART & D'ARRIVÉE)
CREATE TABLE IF NOT EXISTS `neighborhoods` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `uuid` VARCHAR(64) NOT NULL UNIQUE,
  `city_id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `ville` VARCHAR(255) DEFAULT NULL,
  `departement` VARCHAR(255) DEFAULT NULL,
  `arrondissement` VARCHAR(255) DEFAULT NULL,
  `full_address` TEXT DEFAULT NULL,
  `lat` DECIMAL(10, 7) NOT NULL,
  `lng` DECIMAL(10, 7) NOT NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `status` VARCHAR(50) DEFAULT 'actif',
  `zone` VARCHAR(100) DEFAULT NULL,
  `zone_type` VARCHAR(100) DEFAULT 'residential',
  `district` VARCHAR(255) DEFAULT NULL,
  `order_index` INT DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_nb_city_id` (`city_id`),
  INDEX `idx_nb_arrondissement` (`arrondissement`),
  INDEX `idx_nb_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. TABLE DES CAMPAGNES TARIFAIRES
CREATE TABLE IF NOT EXISTS `campaigns` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `uuid` VARCHAR(64) NOT NULL UNIQUE,
  `city_id` VARCHAR(64) NOT NULL,
  `city_name` VARCHAR(255) NOT NULL,
  `currency` VARCHAR(10) NOT NULL DEFAULT 'XAF',
  `trigger_type` VARCHAR(50) NOT NULL DEFAULT 'manual',
  `scope_mode` VARCHAR(50) DEFAULT 'global',
  `arrondissement` VARCHAR(255) DEFAULT NULL,
  `origin_arrondissement` VARCHAR(255) DEFAULT NULL,
  `dest_arrondissement` VARCHAR(255) DEFAULT NULL,
  `triggered_by_user_id` VARCHAR(64) DEFAULT NULL,
  `triggered_by_user_name` VARCHAR(255) DEFAULT NULL,
  `triggered_by_user_role` VARCHAR(50) DEFAULT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'in_progress',
  `total_pairs` INT NOT NULL DEFAULT 0,
  `completed_pairs` INT NOT NULL DEFAULT 0,
  `failed_pairs` INT NOT NULL DEFAULT 0,
  `started_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `finished_at` DATETIME DEFAULT NULL,
  `duration_seconds` INT NOT NULL DEFAULT 0,
  `avg_price` INT NOT NULL DEFAULT 0,
  `avg_distance_km` DECIMAL(6, 2) NOT NULL DEFAULT 0.00,
  `avg_price_per_km` INT NOT NULL DEFAULT 0,
  `hero_stats` JSON DEFAULT NULL,
  `trip_master_stats` JSON DEFAULT NULL,
  `delta_stats` JSON DEFAULT NULL,
  `arrondissement_stats` JSON DEFAULT NULL,
  `has_jams_count` INT DEFAULT 0,
  `yango_shortage_count` INT DEFAULT 0,
  `canonical_trips_count` INT DEFAULT 0,
  `logs` JSON DEFAULT NULL,
  `comment` TEXT DEFAULT NULL,
  `time_slot_override` VARCHAR(50) DEFAULT NULL,
  `is_test_sample` TINYINT(1) DEFAULT 0,
  `sample_limit` INT DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_campaigns_city` (`city_id`),
  INDEX `idx_campaigns_status` (`status`),
  INDEX `idx_campaigns_started_at` (`started_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. TABLE DES RÉSULTATS AGRÉGÉS DE CAMPAGNE (JSON CANONIQUE)
CREATE TABLE IF NOT EXISTS `campaign_results` (
  `campaign_id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `uuid` VARCHAR(64) DEFAULT NULL,
  `city_name` VARCHAR(255) NOT NULL,
  `total_trips` INT NOT NULL DEFAULT 0,
  `canonical_trips` LONGTEXT NOT NULL,
  `saved_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_camp_res_uuid` (`uuid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. TABLE DES TRAJETS INDIVIDUELS DÉTAILLÉS (POUR REQUÊTES RELATIONNELLES ULTRA-PRÉCISES)
CREATE TABLE IF NOT EXISTS `trips` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `uuid` VARCHAR(64) NOT NULL UNIQUE,
  `campaign_id` VARCHAR(64) NOT NULL,
  `city_name` VARCHAR(255) NOT NULL,
  `origin` VARCHAR(255) NOT NULL,
  `destination` VARCHAR(255) NOT NULL,
  `distance_km` DECIMAL(6, 2) NOT NULL DEFAULT 0.00,
  `duration_minutes` INT NOT NULL DEFAULT 0,
  `jams` TINYINT(1) NOT NULL DEFAULT 0,
  `yango_unavailable` TINYINT(1) NOT NULL DEFAULT 0,
  `yango_waiting_minutes` INT DEFAULT NULL,
  `yango_unavailable_classes` JSON DEFAULT NULL,
  `prices` JSON DEFAULT NULL,
  `cheapest` JSON DEFAULT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'success',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_trips_campaign` (`campaign_id`),
  INDEX `idx_trips_origin` (`origin`(100)),
  INDEX `idx_trips_dest` (`destination`(100)),
  INDEX `idx_trips_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. TABLE DES PÉNURIES / RUPTURES D'OFFRE (SURVEILLANCE DU MARCHÉ)
CREATE TABLE IF NOT EXISTS `shortages` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `uuid` VARCHAR(64) NOT NULL UNIQUE,
  `campaign_id` VARCHAR(64) NOT NULL,
  `city_id` VARCHAR(64) DEFAULT NULL,
  `city_name` VARCHAR(255) NOT NULL,
  `origin` VARCHAR(255) DEFAULT NULL,
  `destination` VARCHAR(255) DEFAULT NULL,
  `arrondissement_origin` VARCHAR(255) DEFAULT NULL,
  `arrondissement_dest` VARCHAR(255) DEFAULT NULL,
  `time_slot` VARCHAR(50) DEFAULT NULL,
  `distance_km` DECIMAL(6, 2) DEFAULT 0.00,
  `duration_minutes` INT DEFAULT 0,
  `waiting_minutes` INT DEFAULT 0,
  `unavailable_classes` JSON DEFAULT NULL,
  `cheapest_available_provider` VARCHAR(50) DEFAULT NULL,
  `jams` TINYINT(1) DEFAULT 0,
  `price_yango_eco` INT DEFAULT NULL,
  `price_hero_eco` INT DEFAULT NULL,
  `prices` JSON DEFAULT NULL,
  `raw_payload` JSON DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_shortages_campaign` (`campaign_id`),
  INDEX `idx_shortages_city` (`city_id`),
  INDEX `idx_shortages_time_slot` (`time_slot`),
  INDEX `idx_shortages_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. TABLE DES PARAMÈTRES DE TARIFICATION DES CONCURRENTS (HERO, TRIP MASTER, YANGO)
CREATE TABLE IF NOT EXISTS `settings` (
  `key_name` VARCHAR(64) NOT NULL PRIMARY KEY,
  `data` JSON NOT NULL,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. TABLE D'HISTORIQUE ET JOURNAL D'AUDIT
CREATE TABLE IF NOT EXISTS `history` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `action` VARCHAR(100) NOT NULL,
  `event_type` VARCHAR(50) NOT NULL DEFAULT 'system',
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `performed_by` VARCHAR(64) DEFAULT NULL,
  `performed_by_name` VARCHAR(255) DEFAULT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'success',
  `metadata` JSON DEFAULT NULL,
  `timestamp` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_history_timestamp` (`timestamp`),
  INDEX `idx_history_event_type` (`event_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. TABLE DES INSTANTANÉS STATISTIQUES (SNAPSHOTS)
CREATE TABLE IF NOT EXISTS `statistics_snapshots` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `title` VARCHAR(255) NOT NULL,
  `city_name` VARCHAR(255) DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `custom_data` JSON DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. TABLE DES COMPTEURS SÉQUENTIELS (POUR IDENTIFIANTS COMPATIBLES)
CREATE TABLE IF NOT EXISTS `counters` (
  `name` VARCHAR(64) NOT NULL PRIMARY KEY,
  `seq_value` INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
