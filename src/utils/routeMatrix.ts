import type { Neighborhood } from '../types';
import { calculateDistanceKm } from './geoUtils';

export type DoualaArrondissement = 'Douala 1er' | 'Douala 2e' | 'Douala 3e' | 'Douala 4e' | 'Douala 5e' | 'Autre';

/**
 * Nettoie le nom d'un quartier pour en extraire la racine simple
 * Ex: "Bali, DOUALA 1ER, LITTORAL, Cameroun" -> "bali"
 * Ex: "Akwa (Nord), Douala 1er" -> "akwa"
 */
export function cleanNeighborhoodBaseName(name: string | null | undefined): string {
  if (!name) return '';
  let clean = name.trim();
  const commaIdx = clean.indexOf(',');
  if (commaIdx !== -1) {
    clean = clean.substring(0, commaIdx).trim();
  }
  // Enlever parenthèses éventuelles
  clean = clean.replace(/\(.*?\)/g, '').trim();
  // Enlever chiffres de subdivision "Ndogbatti I" -> "Ndogbatti"
  clean = clean.replace(/\s+(I|II|III|IV|V|\d+)\.?$/i, '').trim();
  return clean.toLowerCase();
}

/**
 * Détecte l'arrondissement officiel d'un quartier (notamment pour Douala)
 */
export function detectArrondissement(n: { name: string; district?: string }): DoualaArrondissement {
  if (n.district) {
    const d = n.district.toLowerCase();
    if (d.includes('1')) return 'Douala 1er';
    if (d.includes('2')) return 'Douala 2e';
    if (d.includes('3')) return 'Douala 3e';
    if (d.includes('4')) return 'Douala 4e';
    if (d.includes('5')) return 'Douala 5e';
  }

  const upper = n.name.toUpperCase();
  if (upper.includes('DOUALA 1ER') || upper.includes('DOUALA 1') || upper.includes('1ER ARRONDISSEMENT')) {
    return 'Douala 1er';
  }
  if (upper.includes('DOUALA 2E') || upper.includes('DOUALA 2EME') || upper.includes('DOUALA 2IEME') || upper.includes('DOUALA 2')) {
    return 'Douala 2e';
  }
  if (upper.includes('DOUALA 3E') || upper.includes('DOUALA 3EME') || upper.includes('DOUALA 3IEME') || upper.includes('DOUALA 3')) {
    return 'Douala 3e';
  }
  if (upper.includes('DOUALA 4E') || upper.includes('DOUALA 4EME') || upper.includes('DOUALA 4IEME') || upper.includes('BONABÉRI') || upper.includes('BONABERI') || upper.includes('DOUALA 4')) {
    return 'Douala 4e';
  }
  if (upper.includes('DOUALA 5E') || upper.includes('DOUALA 5EME') || upper.includes('DOUALA 5IEME') || upper.includes('DOUALA 5')) {
    return 'Douala 5e';
  }

  return 'Autre';
}

/**
 * Règles de connectivité d'arrondissements :
 * - Douala 1er -> teste Douala 1er (intra), Douala 2e, Douala 3e, Douala 5e
 * - Douala 2e   -> teste Douala 1er, Douala 2e (intra), Douala 3e
 * - Douala 3e   -> teste Douala 1er, Douala 3e (intra), Douala 5e
 * - Douala 4e   -> teste Douala 1er, Douala 2e, Douala 4e (intra)
 * - Douala 5e   -> teste Douala 1er, Douala 2e, Douala 3e, Douala 5e (intra)
 * Les destinations d'un même arrondissement peuvent se tester entre elles (ex: Akwa vers Bonanjo).
 */
export const ALLOWED_ARRONDISSEMENT_TARGETS: Record<DoualaArrondissement, DoualaArrondissement[]> = {
  'Douala 1er': ['Douala 1er', 'Douala 2e', 'Douala 3e', 'Douala 5e'],
  'Douala 2e': ['Douala 1er', 'Douala 2e', 'Douala 3e'],
  'Douala 3e': ['Douala 1er', 'Douala 3e', 'Douala 5e'],
  'Douala 4e': ['Douala 1er', 'Douala 2e', 'Douala 4e'],
  'Douala 5e': ['Douala 1er', 'Douala 2e', 'Douala 3e', 'Douala 5e'],
  'Autre': ['Autre', 'Douala 1er', 'Douala 2e', 'Douala 3e', 'Douala 4e', 'Douala 5e']
};

export interface RouteMatrixOptions {
  maxCallsPerDestPerOriginArr?: number; // Défaut: 5 (une destination ne peut être appelée que 5 fois depuis chaque arrondissement)
  maxDestsPerOrigin?: number;           // Défaut: 25 (chaque quartier d'origine ne peut être tiré que 25 fois max, ex: Bali max 25 fois)
  maxGlobalPairs?: number;              // Défaut: 15 000 (plafond global de sécurité)
  minDistanceKm?: number;               // Défaut: 0.4 km (interdit Akwa -> Akwa / sur-place)
}

/**
 * Génère la matrice intelligente de trajets pour un benchmark réaliste et représentatif :
 * 1. Élimine formellement les trajets sur-place (même quartier ou même nom de base ou distance < 400m, ex: jamais Akwa -> Akwa).
 * 2. Les quartiers d'un même arrondissement peuvent se tester entre eux (ex: Akwa -> Bonanjo).
 * 3. Applique les règles de connectivité inter-arrondissements (Douala 1er -> 1er, 2e, 3e, 5e, etc.).
 * 4. Règle clé demandée : Une destination ne peut être appelée que 5 fois par chaque arrondissement
 *    (ex: Akwa peut être appelée max 5 fois depuis Douala 1er, max 5 fois depuis Douala 2e, etc.).
 * 5. Chaque quartier d'origine ne peut avoir que 25 destinations max (ex: Bali max 25 trajets).
 * 6. Plafond global garanti inférieur à 15 000 trajets.
 */
export function generateBenchmarkPairs(
  neighborhoods: Neighborhood[],
  options?: RouteMatrixOptions
): Array<{ origin: Neighborhood; dest: Neighborhood }> {
  const activeNbs = neighborhoods.filter((n) => n.active);
  if (activeNbs.length < 2) return [];

  const maxCallsPerDestPerArr = options?.maxCallsPerDestPerOriginArr ?? 5;
  const maxPerOrigin = options?.maxDestsPerOrigin ?? 25;
  const maxGlobal = options?.maxGlobalPairs ?? 15000;
  const minDistanceKm = options?.minDistanceKm ?? 0.4;

  const isDouala = activeNbs.some((n) => detectArrondissement(n) !== 'Autre');

  // Suivi : destId -> { [originArrondissement]: nombre_d_appels }
  const destCallsFromArr = new Map<string, Map<string, number>>();
  // Suivi : originId -> nombre_de_trajets_generes
  const originTripsCount = new Map<string, number>();

  const pairs: Array<{ origin: Neighborhood; dest: Neighborhood }> = [];

  for (let i = 0; i < activeNbs.length; i++) {
    if (pairs.length >= maxGlobal) break;

    const origin = activeNbs[i];
    const originArr = detectArrondissement(origin);
    const originBaseName = cleanNeighborhoodBaseName(origin.name);

    if (isDouala && originArr !== 'Autre') {
      const targetArrs = ALLOWED_ARRONDISSEMENT_TARGETS[originArr] || ['Douala 1er', 'Douala 2e', 'Douala 3e', 'Douala 5e'];

      // Préparer les candidats éligibles triés par distance
      const candidates: Array<{ dest: Neighborhood; dist: number; destArr: DoualaArrondissement }> = [];
      for (const dest of activeNbs) {
        if (dest.id === origin.id) continue;
        if (cleanNeighborhoodBaseName(dest.name) === originBaseName) continue;

        const destArr = detectArrondissement(dest);
        if (!targetArrs.includes(destArr)) continue;

        const dist = calculateDistanceKm(origin.lat, origin.lng, dest.lat, dest.lng);
        if (dist < minDistanceKm) continue;

        candidates.push({ dest, dist, destArr });
      }

      // Trier par gradient de distance pour équilibrer trajets courts, moyens et longs
      candidates.sort((a, b) => a.dist - b.dist);

      // Parcourir les arrondissements cibles autorisés
      for (const targetArr of targetArrs) {
        if ((originTripsCount.get(origin.id) || 0) >= maxPerOrigin || pairs.length >= maxGlobal) break;

        const arrCandidates = candidates.filter((c) => c.destArr === targetArr);
        for (const c of arrCandidates) {
          if ((originTripsCount.get(origin.id) || 0) >= maxPerOrigin || pairs.length >= maxGlobal) break;

          let destMap = destCallsFromArr.get(c.dest.id);
          if (!destMap) {
            destMap = new Map();
            destCallsFromArr.set(c.dest.id, destMap);
          }

          const currentCalls = destMap.get(originArr) || 0;
          // Règle stricte : cette destination ne peut être appelée que max 5 fois depuis cet arrondissement
          if (currentCalls >= maxCallsPerDestPerArr) continue;

          pairs.push({ origin, dest: c.dest });
          destMap.set(originArr, currentCalls + 1);
          originTripsCount.set(origin.id, (originTripsCount.get(origin.id) || 0) + 1);
        }
      }
    } else {
      // Pour les autres villes (ex: Yaoundé)
      const candidates = activeNbs.filter((dest) => {
        if (dest.id === origin.id) return false;
        if (cleanNeighborhoodBaseName(dest.name) === originBaseName) return false;
        const dist = calculateDistanceKm(origin.lat, origin.lng, dest.lat, dest.lng);
        return dist >= minDistanceKm;
      });

      for (const dest of candidates) {
        if ((originTripsCount.get(origin.id) || 0) >= maxPerOrigin || pairs.length >= maxGlobal) break;

        let destMap = destCallsFromArr.get(dest.id);
        if (!destMap) {
          destMap = new Map();
          destCallsFromArr.set(dest.id, destMap);
        }
        const currentCalls = destMap.get(originArr) || 0;
        if (currentCalls >= maxCallsPerDestPerArr) continue;

        pairs.push({ origin, dest });
        destMap.set(originArr, currentCalls + 1);
        originTripsCount.set(origin.id, (originTripsCount.get(origin.id) || 0) + 1);
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