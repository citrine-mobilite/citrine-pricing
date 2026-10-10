import type { Neighborhood } from '../types/index.js';
import { calculateDistanceKm } from './geoUtils.js';

/**
 * Extrait l'identifiant unique et normalisé de la ville d'un quartier.
 * Fonctionne pour n'importe quelle ville existante ou future (Douala, Yaoundé, Bafoussam, Kribi, Garoua, etc.).
 */
export function getNeighborhoodCityId(n: Partial<Neighborhood> | null | undefined): string {
  if (!n) return 'inconnue';
  if (n.cityId && n.cityId.trim()) {
    return n.cityId.trim().toLowerCase();
  }
  const cityName = ((n as any).cityName || (n as any).ville || '').trim().toLowerCase();
  if (cityName) {
    return `city_${cityName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_')}`;
  }
  const dep = ((n as any).departement || '').trim().toLowerCase();
  if (dep) {
    return `dep_${dep.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_')}`;
  }
  return 'ville_default';
}

/**
 * Extrait le nom affichable de la ville d'un quartier.
 */
export function getNeighborhoodCityName(n: Partial<Neighborhood> | null | undefined): string {
  if (!n) return 'Ville';
  return (n as any).cityName || (n as any).ville || (n as any).cityId || 'Ville';
}

// Fonction de rétro-compatibilité
export function getNeighborhoodCity(n: Partial<Neighborhood> | null | undefined): string {
  const cId = getNeighborhoodCityId(n);
  if (cId.includes('yaound')) return 'yaounde';
  if (cId.includes('douala')) return 'douala';
  return cId;
}

/**
 * Nettoie le nom d'un quartier en conservant son libellé complet spécifique.
 */
export function cleanNeighborhoodBaseName(name: string | null | undefined): string {
  if (!name) return '';
  let clean = name.trim();
  const commaIdx = clean.indexOf(',');
  if (commaIdx !== -1) {
    clean = clean.substring(0, commaIdx).trim();
  }
  return clean.toLowerCase();
}

/**
 * Détecte l'arrondissement, le district ou la zone d'un quartier de manière 100% dynamique.
 * Ne dépend d'aucune liste codée en dur et fonctionne pour toute nouvelle ville ajoutée.
 */
export function detectArrondissement(n: {
  name: string;
  district?: string;
  cityId?: string;
  arrondissement?: string;
  fullAddress?: string;
  zone?: string;
  zoneType?: string;
}): string {
  // 1. Champ arrondissement explicite en priorité
  if (n.arrondissement && n.arrondissement.trim()) {
    return n.arrondissement.trim();
  }
  // 2. District
  if (n.district && n.district.trim()) {
    return n.district.trim();
  }
  // 3. Déduction depuis fullAddress si disponible
  if (n.fullAddress) {
    const parts = n.fullAddress.split(',').map((p) => p.trim());
    for (const part of parts) {
      if (/(?:arrondissement|arr\.|district)/i.test(part) || /\b\d+(?:er|e)\b/i.test(part)) {
        return part;
      }
    }
  }
  // 4. Zone / ZoneType
  if (n.zone && n.zone.trim()) {
    return n.zone.trim();
  }
  if (n.zoneType && n.zoneType.trim()) {
    return n.zoneType.trim();
  }
  return 'Centre / Général';
}

export interface RouteMatrixOptions {
  cityId?: string;                     // Si spécifié, filtre strictement sur cette ville
  maxCallsPerDestPerTargetArr?: number; // Défaut: 4 (max destinations par arrondissement / zone cible)
  maxDestsPerOrigin?: number;           // Défaut: 12 (sécurité globale de destinations par quartier)
  maxGlobalPairs?: number;              // Défaut: 3000 (plafond global de sécurité)
  minDistanceKm?: number;               // Défaut: 0.3 km (interdit trajets sur-place)
}

/**
 * Génère la matrice intelligente et équilibrée de trajets pour un pricing VTC multi-villes.
 * 
 * RÈGLE D'OR UNIVERSELLE :
 * 1. Isolation stricte par ville :
 *    - Un quartier d'une ville ne teste QUE les quartiers de cette même ville.
 *    - Tout trajet inter-villes est formellement rejeté.
 * 2. Évolutivité totale :
 *    - Fonctionne automatiquement pour Douala, Yaoundé, Bafoussam, Kribi, Garoua, etc.
 * 3. Échantillonnage équilibré :
 *    - Si la ville a plusieurs arrondissements/zones, les trajets sont répartis équitablement.
 *    - Si la ville n'a pas de sous-découpage, les trajets sont échantillonnés par distance progressive.
 * 4. Paires bidirectionnelles et uniques (A -> B et B -> A ne sont pas dupliquées).
 */
export function generatePricingPairs(
  neighborhoods: Neighborhood[],
  options?: RouteMatrixOptions
): Array<{ origin: Neighborhood; dest: Neighborhood }> {
  let activeNbs = neighborhoods.filter((n) => n.active);
  if (options?.cityId && options.cityId !== 'all') {
    const targetKey = options.cityId.toLowerCase().trim();
    activeNbs = activeNbs.filter((n) => {
      const cId = getNeighborhoodCityId(n);
      return cId === targetKey || n.cityId === options.cityId || cId.includes(targetKey);
    });
  }
  if (activeNbs.length < 2) return [];

  const maxPerTargetArr = options?.maxCallsPerDestPerTargetArr ?? 4;
  const maxDestsPerOrigin = options?.maxDestsPerOrigin ?? 12;
  const maxGlobal = options?.maxGlobalPairs ?? 3000;
  const minDistanceKm = options?.minDistanceKm ?? 0.3;

  const pairs: Array<{ origin: Neighborhood; dest: Neighborhood }> = [];
  const seenPairKeys = new Set<string>();

  // 1. Grouper strictement les quartiers actifs par Ville (intra-ville étanche)
  const cityGroups = new Map<string, Neighborhood[]>();
  for (const nb of activeNbs) {
    const cId = getNeighborhoodCityId(nb);
    let list = cityGroups.get(cId);
    if (!list) {
      list = [];
      cityGroups.set(cId, list);
    }
    list.push(nb);
  }

  const getPairKey = (id1: string | number, id2: string | number): string => {
    const s1 = String(id1);
    const s2 = String(id2);
    return s1 < s2 ? `${s1}---${s2}` : `${s2}---${s1}`;
  };

  // 2. Traiter chaque ville de manière 100% indépendante
  for (const [, cityNbs] of cityGroups) {
    if (cityNbs.length < 2) continue;
    if (pairs.length >= maxGlobal) break;

    // Suivi des quotas dans cette ville
    const quotaTracker = new Map<string, Map<string, number>>();
    const getQuotaCount = (nbId: string | number, targetKey: string): number => {
      return quotaTracker.get(String(nbId))?.get(targetKey) || 0;
    };
    const incrementQuota = (nbId: string | number, targetKey: string) => {
      const sId = String(nbId);
      let map = quotaTracker.get(sId);
      if (!map) {
        map = new Map<string, number>();
        quotaTracker.set(sId, map);
      }
      map.set(targetKey, (map.get(targetKey) || 0) + 1);
    };

    // Détecter dynamiquement les arrondissements / zones présents dans cette ville
    const cityArrondissements = Array.from(new Set(cityNbs.map((n) => detectArrondissement(n))));
    const hasMultipleArrondissements = cityArrondissements.length > 1;

    for (let i = 0; i < cityNbs.length; i++) {
      if (pairs.length >= maxGlobal) break;

      const origin = cityNbs[i];
      const originArr = detectArrondissement(origin);
      const originName = cleanNeighborhoodBaseName(origin.name);

      if (hasMultipleArrondissements) {
        // A. La ville possède plusieurs arrondissements : tester d'abord l'intra-arrondissement puis les autres
        const targetOrder = [originArr, ...cityArrondissements.filter((a) => a !== originArr)];

        for (const targetArr of targetOrder) {
          if (pairs.length >= maxGlobal) break;
          if (getQuotaCount(origin.id, targetArr) >= maxPerTargetArr) continue;
          if (getQuotaCount(origin.id, '__total__') >= maxDestsPerOrigin) break;

          const candidates: Array<{ dest: Neighborhood; dist: number }> = [];

          for (const dest of cityNbs) {
            if (dest.id === origin.id) continue;
            if (cleanNeighborhoodBaseName(dest.name) === originName) continue;

            const destArr = detectArrondissement(dest);
            if (destArr !== targetArr) continue;

            const pairKey = getPairKey(origin.id, dest.id);
            if (seenPairKeys.has(pairKey)) continue;

            if (getQuotaCount(dest.id, originArr) >= maxPerTargetArr) continue;
            if (getQuotaCount(dest.id, '__total__') >= maxDestsPerOrigin) continue;

            const dist = calculateDistanceKm(origin.lat, origin.lng, dest.lat, dest.lng);
            if (dist < minDistanceKm) continue;

            candidates.push({ dest, dist });
          }

          // Échantillonnage par distance croissante
          candidates.sort((a, b) => a.dist - b.dist);

          for (const cand of candidates) {
            if (pairs.length >= maxGlobal) break;
            if (getQuotaCount(origin.id, targetArr) >= maxPerTargetArr) break;
            if (getQuotaCount(origin.id, '__total__') >= maxDestsPerOrigin) break;
            if (getQuotaCount(cand.dest.id, originArr) >= maxPerTargetArr) continue;
            if (getQuotaCount(cand.dest.id, '__total__') >= maxDestsPerOrigin) continue;

            const pairKey = getPairKey(origin.id, cand.dest.id);
            if (seenPairKeys.has(pairKey)) continue;

            seenPairKeys.add(pairKey);
            incrementQuota(origin.id, targetArr);
            incrementQuota(cand.dest.id, originArr);
            incrementQuota(origin.id, '__total__');
            incrementQuota(cand.dest.id, '__total__');

            pairs.push({ origin, dest: cand.dest });
          }
        }
      }

      // B. Si les quotas ne sont pas saturés ou ville à 1 seul arrondissement : compléter avec les autres quartiers de la ville
      if (getQuotaCount(origin.id, '__total__') < maxDestsPerOrigin) {
        const fallbackCandidates: Array<{ dest: Neighborhood; dist: number }> = [];

        for (const dest of cityNbs) {
          if (dest.id === origin.id) continue;
          if (cleanNeighborhoodBaseName(dest.name) === originName) continue;

          const pairKey = getPairKey(origin.id, dest.id);
          if (seenPairKeys.has(pairKey)) continue;
          if (getQuotaCount(dest.id, '__total__') >= maxDestsPerOrigin) continue;

          const dist = calculateDistanceKm(origin.lat, origin.lng, dest.lat, dest.lng);
          if (dist < minDistanceKm) continue;

          fallbackCandidates.push({ dest, dist });
        }

        fallbackCandidates.sort((a, b) => a.dist - b.dist);

        for (const cand of fallbackCandidates) {
          if (pairs.length >= maxGlobal) break;
          if (getQuotaCount(origin.id, '__total__') >= maxDestsPerOrigin) break;
          if (getQuotaCount(cand.dest.id, '__total__') >= maxDestsPerOrigin) continue;

          const pairKey = getPairKey(origin.id, cand.dest.id);
          if (seenPairKeys.has(pairKey)) continue;

          seenPairKeys.add(pairKey);
          incrementQuota(origin.id, '__total__');
          incrementQuota(cand.dest.id, '__total__');

          pairs.push({ origin, dest: cand.dest });
        }
      }
    }
  }

  return pairs;
}

/**
 * Calcule rapidement le nombre de combinaisons effectives selon la matrice intelligente.
 */
export function calculatePossiblePricingPairsCount(
  neighborhoods: Neighborhood[],
  options?: RouteMatrixOptions
): number {
  return generatePricingPairs(neighborhoods, options).length;
}
