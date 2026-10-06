import type { Neighborhood } from '../types/index.js';
import { calculateDistanceKm } from './geoUtils.js';

export type DoualaArrondissement = 'Douala 1er' | 'Douala 2e' | 'Douala 3e' | 'Douala 4e' | 'Douala 5e' | 'Autre';

/**
 * Nettoie le nom d'un quartier en conservant son libellé complet spécifique (ex: "Akwa (Nord)", "Ndogbatti I")
 * et en retirant uniquement les mentions administratives situées après la première virgule.
 * Ex: "Bali, DOUALA 1ER, LITTORAL, Cameroun" -> "bali"
 * Ex: "Akwa (Nord), Douala 1er" -> "akwa (nord)" (différent de "Akwa (Sud)")
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
 * Détecte l'arrondissement officiel d'un quartier (pour Douala, Yaoundé et autres villes)
 */
export function detectArrondissement(n: { name: string; district?: string; cityId?: string }): string {
  if (n.district && n.district.trim()) {
    return n.district.trim();
  }

  const upper = (n.name || '').toUpperCase();
  const isYaounde = n.cityId === 'city_yaounde' || upper.includes('YAOUNDÉ') || upper.includes('YAOUNDE');

  if (isYaounde) {
    if (upper.includes('YAOUNDÉ 1') || upper.includes('YAOUNDE 1') || upper.includes('BASTOS') || upper.includes('CENTRE') || upper.includes('NSIMALEN')) {
      return 'Yaoundé 1er';
    }
    if (upper.includes('YAOUNDÉ 2') || upper.includes('YAOUNDE 2') || upper.includes('TSINGA') || upper.includes('MOKOLO')) {
      return 'Yaoundé 2e';
    }
    if (upper.includes('YAOUNDÉ 3') || upper.includes('YAOUNDE 3') || upper.includes('BIYEM')) {
      return 'Yaoundé 3e';
    }
    if (upper.includes('YAOUNDÉ 4') || upper.includes('YAOUNDE 4') || upper.includes('MVAN') || upper.includes('ODZA')) {
      return 'Yaoundé 4e';
    }
    if (upper.includes('YAOUNDÉ 5') || upper.includes('YAOUNDE 5') || upper.includes('OMNISPORTS') || upper.includes('ESSOS') || upper.includes('MFANDENA')) {
      return 'Yaoundé 5e';
    }
    if (upper.includes('YAOUNDÉ 6') || upper.includes('YAOUNDE 6') || upper.includes('MENDONG')) {
      return 'Yaoundé 6e';
    }
    if (upper.includes('YAOUNDÉ 7') || upper.includes('YAOUNDE 7') || upper.includes('NKOLBISSON')) {
      return 'Yaoundé 7e';
    }
    return 'Yaoundé 1er';
  }

  // Douala & général
  if (upper.includes('DOUALA 1ER') || upper.includes('DOUALA 1') || upper.includes('AKWA') || upper.includes('BONANJO') || upper.includes('BONAPRISO') || upper.includes('DEIDO') || upper.includes('BALI')) {
    return 'Douala 1er';
  }
  if (upper.includes('DOUALA 2E') || upper.includes('DOUALA 2') || upper.includes('NEW BELL') || upper.includes('NSSAM')) {
    return 'Douala 2e';
  }
  if (upper.includes('DOUALA 3E') || upper.includes('DOUALA 3') || upper.includes('BEPANDA') || upper.includes('BÉPANDA') || upper.includes('NDOGBONG') || upper.includes('LOGBESSOU') || upper.includes('NYALLA')) {
    return 'Douala 3e';
  }
  if (upper.includes('DOUALA 4E') || upper.includes('BONABÉRI') || upper.includes('BONABERI') || upper.includes('DOUALA 4')) {
    return 'Douala 4e';
  }
  if (upper.includes('DOUALA 5E') || upper.includes('DOUALA 5') || upper.includes('MAKEPE') || upper.includes('MAKÉPÉ') || upper.includes('BONAMOUS SADI') || upper.includes('BONAMOUSSADI') || upper.includes('KOTTO') || upper.includes('LOGPOM')) {
    return 'Douala 5e';
  }

  return 'Douala 1er';
}

/**
 * Règles de connectivité d'arrondissements :
 * - Douala 1er -> teste Douala 1er (intra), Douala 2e, Douala 3e, Douala 5e, Douala 4e
 * - Douala 2e   -> teste Douala 1er, Douala 2e (intra), Douala 3e, Douala 5e
 * - Douala 3e   -> teste Douala 1er, Douala 3e (intra), Douala 5e, Douala 2e
 * - Douala 4e   -> teste Douala 1er, Douala 5e, Douala 4e (intra)
 * - Douala 5e   -> teste Douala 1er, Douala 4e, Douala 3e, Douala 5e (intra)
 * Les destinations d'un même arrondissement peuvent se tester entre elles (ex: Akwa vers Bonanjo).
 */
export const ALLOWED_ARRONDISSEMENT_TARGETS: Record<DoualaArrondissement, DoualaArrondissement[]> = {
  'Douala 1er': ['Douala 1er', 'Douala 5e', 'Douala 3e', 'Douala 4e'],
  'Douala 2e': ['Douala 2e', 'Douala 3e', 'Douala 5e', 'Douala 1er'],
  'Douala 3e': ['Douala 3e', 'Douala 5e', 'Douala 2e', 'Douala 1er'],
  'Douala 4e': ['Douala 4e', 'Douala 5e', 'Douala 1er'],
  'Douala 5e': ['Douala 5e', 'Douala 4e', 'Douala 3e', 'Douala 1er'],
  'Autre': ['Autre', 'Douala 1er', 'Douala 2e', 'Douala 3e', 'Douala 4e', 'Douala 5e']
};

export interface RouteMatrixOptions {
  maxCallsPerDestPerTargetArr?: number; // Défaut: 5 (max 5 destinations par arrondissement cible pour chaque quartier)
  maxDestsPerOrigin?: number;           // Défaut: 25 (sécurité globale par quartier)
  maxGlobalPairs?: number;              // Défaut: 20 000 (plafond global de sécurité)
  minDistanceKm?: number;               // Défaut: 0.3 km (interdit trajets sur-place)
}

/**
 * Génère la matrice intelligente et contrôlée de trajets pour un benchmark VTC :
 * 
 * Règles strictes :
 * 1. Connectivité contrôlée par arrondissement :
 *    - Douala 1er -> 1er, 5e, 3e
 *    - Douala 2e   -> 2e, 3e, 5e
 *    - Douala 3e   -> 3e, 5e, 2e
 *    - Douala 4e   -> 4e, 5e
 *    - Douala 5e   -> 5e, 4e, 3e
 * 2. Un quartier ne peut jamais être sa propre destination (distance >= 300m, noms distincts).
 * 3. Maximum 5 destinations par arrondissement cible pour chaque quartier (ex: Bali max 5 dans 1er, 5 dans 5e, 5 dans 3e = max 15 paires).
 * 4. Paires bidirectionnelles et uniques :
 *    A -> B et B -> A sont traitées comme une seule et même paire. Une paire déjà créée n'est jamais dupliquée.
 * 5. Respect simultané des quotas pour les deux quartiers de la paire.
 */
export function generateBenchmarkPairs(
  neighborhoods: Neighborhood[],
  options?: RouteMatrixOptions
): Array<{ origin: Neighborhood; dest: Neighborhood }> {
  const activeNbs = neighborhoods.filter((n) => n.active);
  if (activeNbs.length < 2) return [];

  const maxPerTargetArr = options?.maxCallsPerDestPerTargetArr ?? 5;
  const maxGlobal = options?.maxGlobalPairs ?? 20000;
  const minDistanceKm = options?.minDistanceKm ?? 0.3;

  const isDouala = activeNbs.some((n) => detectArrondissement(n) !== 'Autre');
  const pairs: Array<{ origin: Neighborhood; dest: Neighborhood }> = [];
  const seenPairKeys = new Set<string>();

  // Suivi des connexions par quartier et par arrondissement cible : nbId -> Map(arrondissementCible -> count)
  const quotaTracker = new Map<string, Map<string, number>>();

  const getQuotaCount = (nbId: string, targetArr: string): number => {
    return quotaTracker.get(nbId)?.get(targetArr) || 0;
  };

  const incrementQuota = (nbId: string, targetArr: string) => {
    let map = quotaTracker.get(nbId);
    if (!map) {
      map = new Map<string, number>();
      quotaTracker.set(nbId, map);
    }
    map.set(targetArr, (map.get(targetArr) || 0) + 1);
  };

  const getPairKey = (id1: string, id2: string): string => {
    return id1 < id2 ? `${id1}---${id2}` : `${id2}---${id1}`;
  };

  for (let i = 0; i < activeNbs.length; i++) {
    if (pairs.length >= maxGlobal) break;

    const origin = activeNbs[i];
    const originArr = detectArrondissement(origin);
    const originBaseName = cleanNeighborhoodBaseName(origin.name);

    if (isDouala && originArr !== 'Autre') {
      const targetArrs = (ALLOWED_ARRONDISSEMENT_TARGETS as Record<string, string[]>)[originArr] || ['Douala 1er', 'Douala 2e', 'Douala 3e', 'Douala 4e', 'Douala 5e'];

      for (const targetArr of targetArrs) {
        if (pairs.length >= maxGlobal) break;
        if (getQuotaCount(origin.id, targetArr) >= maxPerTargetArr) continue;

        // Récupérer les candidats éligibles dans cet arrondissement cible
        const candidates: Array<{ dest: Neighborhood; dist: number }> = [];

        for (const dest of activeNbs) {
          if (dest.id === origin.id) continue;
          if (origin.cityId && dest.cityId && origin.cityId !== dest.cityId) continue;
          if (cleanNeighborhoodBaseName(dest.name) === originBaseName) continue;

          const destArr = detectArrondissement(dest);
          if (destArr !== targetArr) continue;

          const pairKey = getPairKey(origin.id, dest.id);
          if (seenPairKeys.has(pairKey)) continue;

          // Vérifier si la destination a aussi de la place dans son quota pour l'arrondissement d'origine
          if (getQuotaCount(dest.id, originArr) >= maxPerTargetArr) continue;

          const dist = calculateDistanceKm(origin.lat, origin.lng, dest.lat, dest.lng);
          if (dist < minDistanceKm) continue;

          candidates.push({ dest, dist });
        }

        // Trier par distance pour un échantillonnage progressif
        candidates.sort((a, b) => a.dist - b.dist);

        for (const cand of candidates) {
          if (pairs.length >= maxGlobal) break;
          if (getQuotaCount(origin.id, targetArr) >= maxPerTargetArr) break;
          if (getQuotaCount(cand.dest.id, originArr) >= maxPerTargetArr) continue;

          const pairKey = getPairKey(origin.id, cand.dest.id);
          if (seenPairKeys.has(pairKey)) continue;

          seenPairKeys.add(pairKey);
          incrementQuota(origin.id, targetArr);
          incrementQuota(cand.dest.id, originArr);

          pairs.push({ origin, dest: cand.dest });
        }
      }
    } else {
      // Pour les autres villes (ex: Yaoundé)
      const maxPerOrigin = options?.maxDestsPerOrigin ?? 15;
      const candidates: Array<{ dest: Neighborhood; dist: number }> = [];

      for (const dest of activeNbs) {
        if (dest.id === origin.id) continue;
        if (origin.cityId && dest.cityId && origin.cityId !== dest.cityId) continue;
        if (cleanNeighborhoodBaseName(dest.name) === originBaseName) continue;

        const pairKey = getPairKey(origin.id, dest.id);
        if (seenPairKeys.has(pairKey)) continue;

        const dist = calculateDistanceKm(origin.lat, origin.lng, dest.lat, dest.lng);
        if (dist < minDistanceKm) continue;

        candidates.push({ dest, dist });
      }

      candidates.sort((a, b) => a.dist - b.dist);

      for (const cand of candidates) {
        if (pairs.length >= maxGlobal) break;
        if (getQuotaCount(origin.id, 'all') >= maxPerOrigin) break;
        if (getQuotaCount(cand.dest.id, 'all') >= maxPerOrigin) continue;

        const pairKey = getPairKey(origin.id, cand.dest.id);
        if (seenPairKeys.has(pairKey)) continue;

        seenPairKeys.add(pairKey);
        incrementQuota(origin.id, 'all');
        incrementQuota(cand.dest.id, 'all');

        pairs.push({ origin, dest: cand.dest });
      }
    }
  }

  return pairs;
}

/**
 * Calcule rapidement le nombre de combinaisons effectives selon la matrice intelligente
 */
export function calculatePossibleBenchmarkPairsCount(
  neighborhoods: Neighborhood[],
  options?: RouteMatrixOptions
): number {
  return generateBenchmarkPairs(neighborhoods, options).length;
}