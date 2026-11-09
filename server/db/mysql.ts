import 'dotenv/config';
import { randomUUID } from 'crypto';
import mysql, { Pool, PoolOptions, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { City, Neighborhood, PricingCampaign, CanonicalTrip, User, TripResult } from '../types.js';
import type { CampaignShortageRecord } from './shortageStore.js';

// Configuration de connexion MySQL / MariaDB
export const MYSQL_HOST = process.env.MYSQL_HOST || process.env.DB_HOST || 'localhost';
export const MYSQL_PORT = Number(process.env.MYSQL_PORT || process.env.DB_PORT || 3306);
export const MYSQL_USER = process.env.MYSQL_USER || process.env.DB_USER || 'root';
export const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || '';
export const MYSQL_DATABASE = process.env.MYSQL_DATABASE || process.env.DB_NAME || 'citrine_db';
export const DATABASE_URL = process.env.DATABASE_URL || process.env.MYSQL_URL || '';

let pool: Pool | null = null;
let isConnected = false;

export function getMySQLPool(): Pool {
  if (pool) return pool;

  let poolConfig: PoolOptions;

  if (DATABASE_URL && (DATABASE_URL.startsWith('mysql://') || DATABASE_URL.startsWith('mysql2://'))) {
    poolConfig = {
      uri: DATABASE_URL,
      waitForConnections: true,
      connectionLimit: 15,
      queueLimit: 0,
      charset: 'utf8mb4'
    };
  } else {
    poolConfig = {
      host: MYSQL_HOST,
      port: MYSQL_PORT,
      user: MYSQL_USER,
      password: MYSQL_PASSWORD,
      database: MYSQL_DATABASE,
      waitForConnections: true,
      connectionLimit: 15,
      queueLimit: 0,
      charset: 'utf8mb4'
    };
  }

  pool = mysql.createPool(poolConfig);
  return pool;
}

export function isMySQLConnected(): boolean {
  return isConnected;
}

// Initialisation automatique du schéma en production
export async function initMySQLSchema(): Promise<boolean> {
  const p = getMySQLPool();
  try {
    const conn = await p.getConnection();
    isConnected = true;
    console.log(`[MySQL] Connecté avec succès à ${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_DATABASE}`);

    // Création des tables nécessaires si inexistantes
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uuid VARCHAR(64) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        role VARCHAR(50) NOT NULL DEFAULT 'employe',
        active TINYINT(1) NOT NULL DEFAULT 1,
        password_hash VARCHAR(255) DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login_at DATETIME DEFAULT NULL,
        INDEX idx_users_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS cities (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uuid VARCHAR(64) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        country VARCHAR(255) NOT NULL DEFAULT 'Cameroun',
        currency VARCHAR(10) NOT NULL DEFAULT 'XAF',
        currency_symbol VARCHAR(20) NOT NULL DEFAULT 'FCFA',
        center JSON DEFAULT NULL,
        airport JSON DEFAULT NULL,
        active TINYINT(1) NOT NULL DEFAULT 1,
        auto_schedule JSON DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_cities_name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS neighborhoods (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        uuid VARCHAR(64) NOT NULL UNIQUE,
        city_id VARCHAR(64) NOT NULL,
        name VARCHAR(255) NOT NULL,
        ville VARCHAR(255) DEFAULT NULL,
        departement VARCHAR(255) DEFAULT NULL,
        arrondissement VARCHAR(255) DEFAULT NULL,
        full_address TEXT DEFAULT NULL,
        lat DECIMAL(10, 7) NOT NULL,
        lng DECIMAL(10, 7) NOT NULL,
        active TINYINT(1) NOT NULL DEFAULT 1,
        status VARCHAR(50) DEFAULT 'actif',
        zone VARCHAR(100) DEFAULT NULL,
        zone_type VARCHAR(100) DEFAULT 'residential',
        district VARCHAR(255) DEFAULT NULL,
        order_index INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_nb_city_id (city_id),
        INDEX idx_nb_arrondissement (arrondissement)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uuid VARCHAR(64) NOT NULL UNIQUE,
        city_id VARCHAR(64) NOT NULL,
        city_name VARCHAR(255) NOT NULL,
        currency VARCHAR(10) NOT NULL DEFAULT 'XAF',
        trigger_type VARCHAR(50) NOT NULL DEFAULT 'manual',
        scope_mode VARCHAR(50) DEFAULT 'global',
        arrondissement VARCHAR(255) DEFAULT NULL,
        origin_arrondissement VARCHAR(255) DEFAULT NULL,
        dest_arrondissement VARCHAR(255) DEFAULT NULL,
        triggered_by_user_id VARCHAR(64) DEFAULT NULL,
        triggered_by_user_name VARCHAR(255) DEFAULT NULL,
        triggered_by_user_role VARCHAR(50) DEFAULT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'in_progress',
        total_pairs INT NOT NULL DEFAULT 0,
        completed_pairs INT NOT NULL DEFAULT 0,
        failed_pairs INT NOT NULL DEFAULT 0,
        started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        finished_at DATETIME DEFAULT NULL,
        duration_seconds INT NOT NULL DEFAULT 0,
        avg_price INT NOT NULL DEFAULT 0,
        avg_distance_km DECIMAL(6, 2) NOT NULL DEFAULT 0.00,
        avg_price_per_km INT NOT NULL DEFAULT 0,
        hero_stats JSON DEFAULT NULL,
        trip_master_stats JSON DEFAULT NULL,
        delta_stats JSON DEFAULT NULL,
        arrondissement_stats JSON DEFAULT NULL,
        has_jams_count INT DEFAULT 0,
        yango_shortage_count INT DEFAULT 0,
        canonical_trips_count INT DEFAULT 0,
        logs JSON DEFAULT NULL,
        comment TEXT DEFAULT NULL,
        time_slot_override VARCHAR(50) DEFAULT NULL,
        is_test_sample TINYINT(1) DEFAULT 0,
        sample_limit INT DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_campaigns_city (city_id),
        INDEX idx_campaigns_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS campaign_results (
        campaign_id VARCHAR(64) NOT NULL PRIMARY KEY,
        uuid VARCHAR(64) DEFAULT NULL,
        city_name VARCHAR(255) NOT NULL,
        total_trips INT NOT NULL DEFAULT 0,
        canonical_trips LONGTEXT NOT NULL,
        saved_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS trips (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        uuid VARCHAR(64) NOT NULL UNIQUE,
        campaign_id VARCHAR(64) NOT NULL,
        city_name VARCHAR(255) NOT NULL,
        origin VARCHAR(255) NOT NULL,
        destination VARCHAR(255) NOT NULL,
        distance_km DECIMAL(6, 2) NOT NULL DEFAULT 0.00,
        duration_minutes INT NOT NULL DEFAULT 0,
        jams TINYINT(1) NOT NULL DEFAULT 0,
        yango_unavailable TINYINT(1) NOT NULL DEFAULT 0,
        yango_waiting_minutes INT DEFAULT NULL,
        yango_unavailable_classes JSON DEFAULT NULL,
        prices JSON DEFAULT NULL,
        cheapest JSON DEFAULT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'success',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_trips_campaign (campaign_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS shortages (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        uuid VARCHAR(64) NOT NULL UNIQUE,
        campaign_id VARCHAR(64) NOT NULL,
        city_id VARCHAR(64) DEFAULT NULL,
        city_name VARCHAR(255) NOT NULL,
        origin VARCHAR(255) DEFAULT NULL,
        destination VARCHAR(255) DEFAULT NULL,
        arrondissement_origin VARCHAR(255) DEFAULT NULL,
        arrondissement_dest VARCHAR(255) DEFAULT NULL,
        time_slot VARCHAR(50) DEFAULT NULL,
        distance_km DECIMAL(6, 2) DEFAULT 0.00,
        duration_minutes INT DEFAULT 0,
        waiting_minutes INT DEFAULT 0,
        unavailable_classes JSON DEFAULT NULL,
        cheapest_available_provider VARCHAR(50) DEFAULT NULL,
        jams TINYINT(1) DEFAULT 0,
        price_yango_eco INT DEFAULT NULL,
        price_hero_eco INT DEFAULT NULL,
        prices JSON DEFAULT NULL,
        raw_payload JSON DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_shortages_campaign (campaign_id),
        INDEX idx_shortages_city (city_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key_name VARCHAR(64) NOT NULL PRIMARY KEY,
        data JSON NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS history (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        action VARCHAR(100) NOT NULL,
        event_type VARCHAR(50) NOT NULL DEFAULT 'system',
        title VARCHAR(255) NOT NULL,
        description TEXT DEFAULT NULL,
        performed_by VARCHAR(64) DEFAULT NULL,
        performed_by_name VARCHAR(255) DEFAULT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'success',
        metadata JSON DEFAULT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_history_timestamp (timestamp)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS statistics_snapshots (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        city_name VARCHAR(255) DEFAULT NULL,
        notes TEXT DEFAULT NULL,
        custom_data JSON DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    conn.release();
    return true;
  } catch (err: any) {
    isConnected = false;
    console.warn(`[MySQL Notice] Base de données MySQL non joignable (${err.message}). L'application fonctionne avec persistance locale en attendant le serveur MySQL.`);
    return false;
  }
}

// ----------------- VILLES ----------------- //

export async function fetchCitiesFromMySQL(): Promise<City[]> {
  try {
    const p = getMySQLPool();
    const [rows] = await p.query<RowDataPacket[]>('SELECT * FROM cities ORDER BY id ASC');
    return rows.map((r: any) => ({
      id: r.id,
      uuid: r.uuid,
      name: r.name,
      country: r.country,
      currency: r.currency,
      currencySymbol: r.currency_symbol || 'FCFA',
      center: typeof r.center === 'string' ? JSON.parse(r.center) : r.center || { lat: 4.0511, lng: 9.7679 },
      airport: typeof r.airport === 'string' ? JSON.parse(r.airport) : r.airport || undefined,
      active: Boolean(r.active),
      autoSchedule: typeof r.auto_schedule === 'string' ? JSON.parse(r.auto_schedule) : r.auto_schedule || { enabled: false, slots: [] }
    }));
  } catch (err: any) {
    console.warn('[MySQL] Erreur lecture villes:', err.message);
    return [];
  }
}

export async function upsertCityInMySQL(city: City): Promise<void> {
  try {
    const p = getMySQLPool();
    const uuid = city.uuid || `city_${city.id || randomUUID()}`;
    const centerJson = JSON.stringify(city.center || { lat: 4.0511, lng: 9.7679 });
    const airportJson = city.airport ? JSON.stringify(city.airport) : null;
    const scheduleJson = JSON.stringify(city.autoSchedule || { enabled: false, slots: [] });

    await p.query(
      `INSERT INTO cities (uuid, name, country, currency, currency_symbol, center, airport, active, auto_schedule)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         country = VALUES(country),
         currency = VALUES(currency),
         currency_symbol = VALUES(currency_symbol),
         center = VALUES(center),
         airport = VALUES(airport),
         active = VALUES(active),
         auto_schedule = VALUES(auto_schedule)`,
      [
        uuid,
        city.name,
        city.country || 'Cameroun',
        city.currency || 'XAF',
        city.currencySymbol || 'FCFA',
        centerJson,
        airportJson,
        city.active !== false ? 1 : 0,
        scheduleJson
      ]
    );
  } catch (err: any) {
    console.warn('[MySQL] Erreur écriture ville:', err.message);
  }
}

export async function deleteCityFromMySQL(cityIdOrUuid: string | number): Promise<void> {
  try {
    const p = getMySQLPool();
    const target = String(cityIdOrUuid);
    await p.query('DELETE FROM neighborhoods WHERE city_id = ?', [target]);
    await p.query('DELETE FROM cities WHERE id = ? OR uuid = ?', [target, target]);
  } catch (err: any) {
    console.warn('[MySQL] Erreur suppression ville:', err.message);
  }
}

// ----------------- QUARTIERS ----------------- //

export async function fetchNeighborhoodsFromMySQL(cityId?: string | number): Promise<Neighborhood[]> {
  try {
    const p = getMySQLPool();
    let query = 'SELECT * FROM neighborhoods';
    const params: any[] = [];
    if (cityId) {
      query += ' WHERE city_id = ?';
      params.push(String(cityId));
    }
    query += ' ORDER BY name ASC';
    const [rows] = await p.query<RowDataPacket[]>(query, params);

    return rows.map((r: any) => ({
      id: r.id,
      uuid: r.uuid,
      cityId: String(r.city_id),
      name: r.name,
      ville: r.ville,
      departement: r.departement,
      arrondissement: r.arrondissement,
      fullAddress: r.full_address,
      lat: Number(r.lat),
      lng: Number(r.lng),
      active: Boolean(r.active),
      status: r.status,
      zone: r.zone,
      zoneType: r.zone_type || 'residential',
      district: r.district,
      orderIndex: r.order_index || 0,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  } catch (err: any) {
    console.warn('[MySQL] Erreur lecture quartiers:', err.message);
    return [];
  }
}

export async function upsertNeighborhoodsInMySQL(nbs: Neighborhood[]): Promise<void> {
  if (!nbs || nbs.length === 0) return;
  try {
    const p = getMySQLPool();
    const conn = await p.getConnection();

    for (const nb of nbs) {
      const id = String(nb.id || nb.uuid || randomUUID());
      const uuid = nb.uuid || id;
      await conn.query(
        `INSERT INTO neighborhoods (id, uuid, city_id, name, ville, departement, arrondissement, full_address, lat, lng, active, status, zone, zone_type, district, order_index)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           city_id = VALUES(city_id),
           name = VALUES(name),
           ville = VALUES(ville),
           departement = VALUES(departement),
           arrondissement = VALUES(arrondissement),
           full_address = VALUES(full_address),
           lat = VALUES(lat),
           lng = VALUES(lng),
           active = VALUES(active),
           status = VALUES(status),
           zone = VALUES(zone),
           zone_type = VALUES(zone_type),
           district = VALUES(district),
           order_index = VALUES(order_index)`,
        [
          id,
          uuid,
          String(nb.cityId),
          nb.name,
          nb.ville || null,
          nb.departement || null,
          nb.arrondissement || null,
          nb.fullAddress || null,
          nb.lat,
          nb.lng,
          nb.active !== false ? 1 : 0,
          nb.status || 'actif',
          nb.zone || null,
          nb.zoneType || 'residential',
          nb.district || null,
          nb.orderIndex || 0
        ]
      );
    }
    conn.release();
  } catch (err: any) {
    console.warn('[MySQL] Erreur écriture quartiers:', err.message);
  }
}

export async function deleteNeighborhoodFromMySQL(idOrUuid: string | number): Promise<void> {
  try {
    const p = getMySQLPool();
    const target = String(idOrUuid);
    await p.query('DELETE FROM neighborhoods WHERE id = ? OR uuid = ?', [target, target]);
  } catch (err: any) {
    console.warn('[MySQL] Erreur suppression quartier:', err.message);
  }
}

export async function deleteNeighborhoodsByCityFromMySQL(cityId: string | number): Promise<void> {
  try {
    const p = getMySQLPool();
    await p.query('DELETE FROM neighborhoods WHERE city_id = ?', [String(cityId)]);
  } catch (err: any) {
    console.warn('[MySQL] Erreur suppression quartiers ville:', err.message);
  }
}

// ----------------- UTILISATEURS ----------------- //

export async function fetchUsersFromMySQL(): Promise<User[]> {
  try {
    const p = getMySQLPool();
    const [rows] = await p.query<RowDataPacket[]>('SELECT * FROM users ORDER BY id ASC');
    return rows.map((r: any) => ({
      id: r.id,
      uuid: r.uuid,
      name: r.name,
      email: r.email,
      role: r.role || 'employe',
      active: Boolean(r.active),
      passwordHash: r.password_hash,
      createdAt: r.created_at,
      lastLoginAt: r.last_login_at
    }));
  } catch (err: any) {
    console.warn('[MySQL] Erreur lecture utilisateurs:', err.message);
    return [];
  }
}

export async function getUserByEmailFromMySQL(email: string): Promise<User | null> {
  try {
    const p = getMySQLPool();
    const [rows] = await p.query<RowDataPacket[]>(
      'SELECT * FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1',
      [email.trim()]
    );
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      uuid: r.uuid,
      name: r.name,
      email: r.email,
      role: r.role || 'employe',
      active: Boolean(r.active),
      passwordHash: r.password_hash,
      createdAt: r.created_at,
      lastLoginAt: r.last_login_at
    };
  } catch (err: any) {
    console.warn('[MySQL] Erreur recherche utilisateur:', err.message);
    return null;
  }
}

export async function upsertUserInMySQL(user: User): Promise<User> {
  const p = getMySQLPool();
  const uuid = user.uuid || randomUUID();
  const [result] = await p.query<ResultSetHeader>(
    `INSERT INTO users (uuid, name, email, role, active, password_hash, created_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       role = VALUES(role),
       active = VALUES(active),
       password_hash = COALESCE(VALUES(password_hash), password_hash)`,
    [
      uuid,
      user.name,
      user.email.toLowerCase().trim(),
      user.role || 'employe',
      user.active !== false ? 1 : 0,
      user.passwordHash || null
    ]
  );
  return {
    ...user,
    id: result.insertId || user.id,
    uuid
  };
}

export async function deleteUserFromMySQL(idOrUuid: string | number): Promise<void> {
  try {
    const p = getMySQLPool();
    const target = String(idOrUuid);
    await p.query('DELETE FROM users WHERE id = ? OR uuid = ?', [target, target]);
  } catch (err: any) {
    console.warn('[MySQL] Erreur suppression utilisateur:', err.message);
  }
}

// ----------------- CAMPAGNES ----------------- //

export async function fetchCampaignsFromMySQL(): Promise<PricingCampaign[]> {
  try {
    const p = getMySQLPool();
    const [rows] = await p.query<RowDataPacket[]>('SELECT * FROM campaigns ORDER BY started_at DESC');
    return rows.map((r: any) => ({
      id: r.id,
      uuid: r.uuid,
      cityId: r.city_id,
      cityName: r.city_name,
      currency: r.currency || 'XAF',
      triggerType: r.trigger_type || 'manual',
      scopeMode: r.scope_mode || 'global',
      arrondissement: r.arrondissement,
      originArrondissement: r.origin_arrondissement,
      destArrondissement: r.dest_arrondissement,
      triggeredByUserId: r.triggered_by_user_id,
      triggeredByUserName: r.triggered_by_user_name,
      triggeredByUserRole: r.triggered_by_user_role,
      status: r.status,
      totalPairs: r.total_pairs || 0,
      completedPairs: r.completed_pairs || 0,
      failedPairs: r.failed_pairs || 0,
      durationSeconds: r.duration_seconds || 0,
      avgPrice: r.avg_price || 0,
      avgDistanceKm: Number(r.avg_distance_km) || 0,
      avgPricePerKm: r.avg_price_per_km || 0,
      heroStats: typeof r.hero_stats === 'string' ? JSON.parse(r.hero_stats) : r.hero_stats || undefined,
      tripMasterStats: typeof r.trip_master_stats === 'string' ? JSON.parse(r.trip_master_stats) : r.trip_master_stats || undefined,
      deltaStats: typeof r.delta_stats === 'string' ? JSON.parse(r.delta_stats) : r.delta_stats || undefined,
      arrondissementStats: typeof r.arrondissement_stats === 'string' ? JSON.parse(r.arrondissement_stats) : r.arrondissement_stats || undefined,
      hasJamsCount: r.has_jams_count || 0,
      yangoShortageCount: r.yango_shortage_count || 0,
      canonicalTripsCount: r.canonical_trips_count || 0,
      logs: typeof r.logs === 'string' ? JSON.parse(r.logs) : (Array.isArray(r.logs) ? r.logs : []),
      comment: r.comment,
      timeSlotOverride: r.time_slot_override,
      startedAt: r.started_at,
      finishedAt: r.finished_at
    }));
  } catch (err: any) {
    console.warn('[MySQL] Erreur lecture campagnes:', err.message);
    return [];
  }
}

export async function upsertCampaignInMySQL(c: PricingCampaign): Promise<void> {
  try {
    const p = getMySQLPool();
    const uuid = c.uuid || randomUUID();
    const heroStatsJson = c.heroStats ? JSON.stringify(c.heroStats) : null;
    const tmStatsJson = c.tripMasterStats ? JSON.stringify(c.tripMasterStats) : null;
    const deltaStatsJson = (c as any).deltaStats ? JSON.stringify((c as any).deltaStats) : null;
    const arrStatsJson = c.arrondissementStats ? JSON.stringify(c.arrondissementStats) : null;
    const logsJson = JSON.stringify(c.logs || []);

    await p.query(
      `INSERT INTO campaigns (
        uuid, city_id, city_name, currency, trigger_type, scope_mode, arrondissement, origin_arrondissement, dest_arrondissement,
        triggered_by_user_id, triggered_by_user_name, triggered_by_user_role, status, total_pairs, completed_pairs, failed_pairs,
        duration_seconds, avg_price, avg_distance_km, avg_price_per_km, hero_stats, trip_master_stats, delta_stats, arrondissement_stats,
        has_jams_count, yango_shortage_count, canonical_trips_count, logs, comment, time_slot_override, started_at, finished_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        status = VALUES(status),
        completed_pairs = VALUES(completed_pairs),
        failed_pairs = VALUES(failed_pairs),
        duration_seconds = VALUES(duration_seconds),
        avg_price = VALUES(avg_price),
        avg_distance_km = VALUES(avg_distance_km),
        avg_price_per_km = VALUES(avg_price_per_km),
        hero_stats = VALUES(hero_stats),
        trip_master_stats = VALUES(trip_master_stats),
        delta_stats = VALUES(delta_stats),
        arrondissement_stats = VALUES(arrondissement_stats),
        has_jams_count = VALUES(has_jams_count),
        yango_shortage_count = VALUES(yango_shortage_count),
        canonical_trips_count = VALUES(canonical_trips_count),
        logs = VALUES(logs),
        comment = VALUES(comment),
        finished_at = VALUES(finished_at)`,
      [
        uuid,
        String(c.cityId),
        c.cityName,
        c.currency || 'XAF',
        c.triggerType || 'manual',
        (c as any).scopeMode || 'global',
        (c as any).arrondissement || null,
        (c as any).originArrondissement || null,
        (c as any).destArrondissement || null,
        c.triggeredByUserId ? String(c.triggeredByUserId) : null,
        c.triggeredByUserName || null,
        (c as any).triggeredByUserRole || null,
        c.status,
        c.totalPairs || 0,
        c.completedPairs || 0,
        c.failedPairs || 0,
        c.durationSeconds || 0,
        c.avgPrice || 0,
        c.avgDistanceKm || 0,
        c.avgPricePerKm || 0,
        heroStatsJson,
        tmStatsJson,
        deltaStatsJson,
        arrStatsJson,
        c.hasJamsCount || 0,
        c.yangoShortageCount || 0,
        c.canonicalTripsCount || 0,
        logsJson,
        c.comment || null,
        c.timeSlotOverride || null,
        c.startedAt ? new Date(c.startedAt) : new Date(),
        c.finishedAt ? new Date(c.finishedAt) : null
      ]
    );
  } catch (err: any) {
    console.warn('[MySQL] Erreur écriture campagne:', err.message);
  }
}

export async function deleteCampaignInMySQL(campaignId: string | number): Promise<void> {
  try {
    const p = getMySQLPool();
    const target = String(campaignId);
    await Promise.allSettled([
      p.query('DELETE FROM trips WHERE campaign_id = ?', [target]),
      p.query('DELETE FROM campaign_results WHERE campaign_id = ? OR uuid = ?', [target, target]),
      p.query('DELETE FROM shortages WHERE campaign_id = ?', [target]),
      p.query('DELETE FROM campaigns WHERE id = ? OR uuid = ?', [target, target])
    ]);
  } catch (err: any) {
    console.warn('[MySQL] Erreur suppression campagne:', err.message);
  }
}

// ----------------- RÉSULTATS & TRAJETS ----------------- //

export async function saveCampaignResultsInMySQL(
  campaignId: string | number,
  cityName: string,
  canonicalTrips: CanonicalTrip[],
  campaignUuid?: string
): Promise<void> {
  const p = getMySQLPool();
  const campIdStr = String(campaignId);
  const resultUuid = campaignUuid || randomUUID();

  try {
    // 1. Sauvegarde du résultat global JSON dans campaign_results
    await p.query(
      `INSERT INTO campaign_results (campaign_id, uuid, city_name, total_trips, canonical_trips, saved_at)
       VALUES (?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         uuid = VALUES(uuid),
         city_name = VALUES(city_name),
         total_trips = VALUES(total_trips),
         canonical_trips = VALUES(canonical_trips),
         saved_at = NOW()`,
      [campIdStr, resultUuid, cityName, canonicalTrips.length, JSON.stringify(canonicalTrips)]
    );

    // 2. Insertion en masse des trajets individuels dans la table trips
    await bulkInsertTripsInMySQL(campaignId, cityName, canonicalTrips);
  } catch (err: any) {
    console.warn('[MySQL] Erreur enregistrement résultats campagne:', err.message);
  }
}

export async function bulkInsertTripsInMySQL(
  campaignId: string | number,
  cityName: string,
  canonicalTrips: CanonicalTrip[]
): Promise<number> {
  if (!Array.isArray(canonicalTrips) || canonicalTrips.length === 0) return 0;
  const p = getMySQLPool();
  const campIdStr = String(campaignId);

  try {
    // Suppression des anciens trajets de la campagne pour éviter les doublons
    await p.query('DELETE FROM trips WHERE campaign_id = ?', [campIdStr]);

    // Insertion par blocs de 250 trajets pour une performance optimale
    const BATCH_SIZE = 250;
    let inserted = 0;

    for (let i = 0; i < canonicalTrips.length; i += BATCH_SIZE) {
      const chunk = canonicalTrips.slice(i, i + BATCH_SIZE);
      const values: any[] = [];
      const placeholders: string[] = [];

      for (const t of chunk) {
        placeholders.push('(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        values.push(
          t.uuid || randomUUID(),
          campIdStr,
          cityName,
          t.origin,
          t.destination,
          t.distanceKm || 0,
          t.durationMin || 0,
          t.jams ? 1 : 0,
          t.yangoUnavailable ? 1 : 0,
          t.yangoWaitingMinutes || null,
          t.yangoUnavailableClasses ? JSON.stringify(t.yangoUnavailableClasses) : null,
          JSON.stringify(t.prices || {}),
          JSON.stringify(t.cheapest || {}),
          t.status || 'success'
        );
      }

      const sql = `
        INSERT INTO trips (
          uuid, campaign_id, city_name, origin, destination, distance_km,
          duration_minutes, jams, yango_unavailable, yango_waiting_minutes,
          yango_unavailable_classes, prices, cheapest, status
        ) VALUES ${placeholders.join(', ')}
      `;

      await p.query(sql, values);
      inserted += chunk.length;
    }

    return inserted;
  } catch (err: any) {
    console.warn('[MySQL] Erreur insertion en masse des trajets:', err.message);
    return 0;
  }
}

export async function fetchCampaignResultsFromMySQL(campaignId: string | number): Promise<CanonicalTrip[]> {
  try {
    const p = getMySQLPool();
    const campIdStr = String(campaignId);
    const [rows] = await p.query<RowDataPacket[]>(
      'SELECT canonical_trips FROM campaign_results WHERE campaign_id = ? OR uuid = ? LIMIT 1',
      [campIdStr, campIdStr]
    );

    if (rows.length > 0 && rows[0].canonical_trips) {
      const raw = rows[0].canonical_trips;
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed)) return parsed as CanonicalTrip[];
    }
  } catch (err: any) {
    console.warn('[MySQL] Erreur lecture trajets campagne:', err.message);
  }
  return [];
}

// ----------------- PÉNURIES / SHORTAGES ----------------- //

export async function saveCampaignShortagesInMySQL(
  campaignId: string | number,
  cityName: string,
  shortages: CampaignShortageRecord[]
): Promise<void> {
  if (!Array.isArray(shortages) || shortages.length === 0) return;
  const p = getMySQLPool();
  const campIdStr = String(campaignId);

  try {
    await p.query('DELETE FROM shortages WHERE campaign_id = ?', [campIdStr]);

    for (const s of shortages) {
      await p.query(
        `INSERT INTO shortages (
          uuid, campaign_id, city_id, city_name, origin, destination,
          arrondissement_origin, arrondissement_dest, time_slot, distance_km,
          duration_minutes, waiting_minutes, unavailable_classes, cheapest_available_provider,
          jams, price_yango_eco, price_hero_eco, prices, raw_payload, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          s.uuid || randomUUID(),
          campIdStr,
          s.cityId ? String(s.cityId) : null,
          s.cityName || cityName,
          s.origin,
          s.destination,
          s.arrondissementOrigin || null,
          s.arrondissementDest || null,
          s.timeSlot || null,
          s.distanceKm || 0,
          s.durationMinutes || 0,
          s.waitingMinutes || 0,
          s.unavailableClasses ? JSON.stringify(s.unavailableClasses) : null,
          (s as any).cheapest_available_provider || null,
          s.jams ? 1 : 0,
          s.priceYangoEco ?? null,
          s.priceHeroEco ?? null,
          JSON.stringify({ yango: s.priceYangoEco, hero: s.priceHeroEco }),
          JSON.stringify(s),
          s.timestamp ? new Date(s.timestamp) : new Date()
        ]
      );
    }
  } catch (err: any) {
    console.warn('[MySQL] Erreur sauvegarde shortages:', err.message);
  }
}

export async function fetchShortagesFromMySQL(filters?: {
  cityId?: string;
  timeSlot?: string;
  arrondissement?: string;
  campaignId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ total: number; shortages: any[] }> {
  try {
    const p = getMySQLPool();
    let whereClauses: string[] = [];
    const params: any[] = [];

    if (filters?.cityId && filters.cityId !== 'all') {
      whereClauses.push('city_id = ?');
      params.push(filters.cityId);
    }
    if (filters?.timeSlot && filters.timeSlot !== 'all') {
      whereClauses.push('time_slot = ?');
      params.push(filters.timeSlot);
    }
    if (filters?.arrondissement && filters.arrondissement !== 'all') {
      whereClauses.push('(arrondissement_origin = ? OR arrondissement_dest = ?)');
      params.push(filters.arrondissement, filters.arrondissement);
    }
    if (filters?.campaignId && filters.campaignId !== 'all') {
      whereClauses.push('campaign_id = ?');
      params.push(filters.campaignId);
    }
    if (filters?.search) {
      whereClauses.push('(origin LIKE ? OR destination LIKE ? OR campaign_id LIKE ?)');
      const q = `%${filters.search}%`;
      params.push(q, q, q);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const [countRows] = await p.query<RowDataPacket[]>(`SELECT count(*) as total FROM shortages ${whereSql}`, params);
    const total = countRows[0]?.total || 0;

    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;
    const [rows] = await p.query<RowDataPacket[]>(
      `SELECT * FROM shortages ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return { total, shortages: rows };
  } catch (err: any) {
    console.warn('[MySQL] Erreur lecture shortages:', err.message);
    return { total: 0, shortages: [] };
  }
}

// ----------------- HISTORIQUE / AUDIT ----------------- //

export async function fetchHistoryFromMySQL(): Promise<any[]> {
  try {
    const p = getMySQLPool();
    const [rows] = await p.query<RowDataPacket[]>('SELECT * FROM history ORDER BY timestamp DESC LIMIT 200');
    return rows.map((r: any) => ({
      id: r.id,
      action: r.action,
      eventType: r.event_type,
      title: r.title,
      description: r.description,
      performedBy: r.performed_by,
      performedByName: r.performed_by_name,
      status: r.status,
      metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata,
      timestamp: r.timestamp
    }));
  } catch (err: any) {
    console.warn('[MySQL] Erreur lecture historique:', err.message);
    return [];
  }
}

export async function insertHistoryInMySQL(entry: {
  action: string;
  eventType?: string;
  title: string;
  description?: string;
  performedBy?: string;
  performedByName?: string;
  status?: string;
  metadata?: any;
}): Promise<void> {
  try {
    const p = getMySQLPool();
    await p.query(
      `INSERT INTO history (id, action, event_type, title, description, performed_by, performed_by_name, status, metadata, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        randomUUID(),
        entry.action,
        entry.eventType || 'system',
        entry.title,
        entry.description || null,
        entry.performedBy || null,
        entry.performedByName || null,
        entry.status || 'success',
        entry.metadata ? JSON.stringify(entry.metadata) : null
      ]
    );
  } catch (err: any) {
    console.warn('[MySQL] Erreur écriture historique:', err.message);
  }
}

export async function clearHistoryInMySQL(): Promise<void> {
  try {
    const p = getMySQLPool();
    await p.query('TRUNCATE TABLE history');
  } catch (err: any) {
    console.warn('[MySQL] Erreur vidage historique:', err.message);
  }
}

// ----------------- STATISTIQUES GLOBALES DE LA BASE MYSQL ----------------- //

export async function getMySQLDatabaseStats() {
  const p = getMySQLPool();
  try {
    const [uRows] = await p.query<RowDataPacket[]>('SELECT count(*) as count FROM users');
    const [cRows] = await p.query<RowDataPacket[]>('SELECT count(*) as count FROM cities');
    const [nRows] = await p.query<RowDataPacket[]>('SELECT count(*) as count FROM neighborhoods');
    const [campRows] = await p.query<RowDataPacket[]>('SELECT count(*) as count FROM campaigns');
    const [tRows] = await p.query<RowDataPacket[]>('SELECT count(*) as count FROM trips');
    const [sRows] = await p.query<RowDataPacket[]>('SELECT count(*) as count FROM shortages');

    return {
      connected: true,
      engine: 'MySQL 8 / MariaDB',
      host: MYSQL_HOST,
      database: MYSQL_DATABASE,
      stats: {
        userCount: uRows[0]?.count ?? 0,
        cityCount: cRows[0]?.count ?? 0,
        neighborhoodCount: nRows[0]?.count ?? 0,
        campaignCount: campRows[0]?.count ?? 0,
        tripsCount: tRows[0]?.count ?? 0,
        shortagesCount: sRows[0]?.count ?? 0
      }
    };
  } catch (err: any) {
    return {
      connected: false,
      engine: 'MySQL 8 / MariaDB',
      host: MYSQL_HOST,
      database: MYSQL_DATABASE,
      error: err.message,
      stats: {
        userCount: 0,
        cityCount: 0,
        neighborhoodCount: 0,
        campaignCount: 0,
        tripsCount: 0,
        shortagesCount: 0
      }
    };
  }
}
