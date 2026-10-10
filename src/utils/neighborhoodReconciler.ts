import * as XLSX from 'xlsx';
import { Neighborhood } from '../types';

export interface ReconcileItem {
  status: 'update' | 'create' | 'ignored_douala_6' | 'invalid';
  targetId?: string | number;
  cityName: string;
  ville?: string;
  departement?: string;
  arrondissement?: string;
  name: string;
  oldName?: string;
  fullAddress: string;
  oldAddress?: string;
  lat: number;
  lng: number;
  oldLat?: number;
  oldLng?: number;
  zone?: string;
  zoneType?: 'commercial' | 'residential' | 'popular' | 'airport' | 'center' | string;
  itemStatus?: string; // valeur textuelle de la colonne status (ex: "actif", "actif_normal", etc.)
  active?: boolean;
  reason?: string;
  matchScore?: number;
}

export interface ReconcileResult {
  success: boolean;
  error?: string;
  totalRows: number;
  items: ReconcileItem[];
  summary: {
    totalParsed: number;
    toUpdateCount: number;
    toCreateCount: number;
    ignoredDouala6Count: number;
    invalidCount: number;
  };
}

/**
 * Normalise une chaîne pour comparaison souple (accents, casse, ponctuation)
 */
export function normalizeString(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Distance de Levenshtein
 */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

/**
 * Calcul de similarité entre 0 et 1
 */
export function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const dist = levenshtein(a, b);
  return Math.max(0, (maxLen - dist) / maxLen);
}

/**
 * Détecte si un arrondissement ou libellé appartient à Douala 6ème (exclu par l'utilisateur)
 */
export function isDouala6eme(text: string): boolean {
  if (!text) return false;
  const norm = normalizeString(text);
  // Recherche "douala 6", "douala 6e", "douala 6eme", "douala 6ieme", "douala vi", "manoka"
  return (
    /\b(douala\s*6|douala\s*6e|douala\s*6eme|douala\s*6ieme|douala\s*vi|manoka|6eme\s*arrondissement|6e\s*arrondissement)\b/i.test(norm) ||
    norm.includes('douala 6') ||
    norm.includes('manoka')
  );
}

/**
 * Analyse et extrait un nombre pour latitude/longitude (gère virgules et points)
 */
function parseCoordinate(val: any): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return isFinite(val) ? val : null;
  const str = String(val).trim().replace(',', '.');
  const num = parseFloat(str);
  return isFinite(num) ? num : null;
}

/**
 * Trouve le quartier existant correspondant avec matching flou
 */
function findBestMatch(
  cleanExcelName: string,
  existingList: Neighborhood[],
  alreadyMatchedIds: Set<string | number>
): { neighborhood: Neighborhood; score: number } | null {
  let bestMatch: Neighborhood | null = null;
  let bestScore = 0;

  for (const existing of existingList) {
    if (alreadyMatchedIds.has(existing.id)) continue;

    // Le nom en BD est souvent "Nom, DOUALA 1ER, LITTORAL, Cameroun"
    const existingRawName = existing.name || '';
    const existingBase = existingRawName.split(',')[0].trim();
    const cleanExistingBase = normalizeString(existingBase);
    const cleanExistingFull = normalizeString(existingRawName);

    // 1. Égalité exacte après normalisation
    if (cleanExcelName === cleanExistingBase || cleanExcelName === cleanExistingFull) {
      return { neighborhood: existing, score: 1.0 };
    }

    // 2. Inclusion forte
    if (
      cleanExistingBase.length >= 4 &&
      (cleanExistingBase.startsWith(cleanExcelName) || cleanExcelName.startsWith(cleanExistingBase))
    ) {
      const score = 0.95;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = existing;
      }
      continue;
    }

    // 3. Distance de Levenshtein & similarité
    const sim = stringSimilarity(cleanExcelName, cleanExistingBase);
    const dist = levenshtein(cleanExcelName, cleanExistingBase);

    // Tolérance : distance <= 2 (ou <= 3 si nom long >= 8) ou score >= 0.82
    const isClose = (dist <= 2 && cleanExcelName.length >= 4) || (dist <= 3 && cleanExcelName.length >= 8) || sim >= 0.82;

    if (isClose && sim > bestScore) {
      bestScore = sim;
      bestMatch = existing;
    }
  }

  if (bestMatch && bestScore >= 0.78) {
    return { neighborhood: bestMatch, score: bestScore };
  }

  return null;
}

/**
 * Fonction principale de parsing et réconciliation du fichier Excel
 */
export async function parseNeighborhoodReconcileFile(
  file: File,
  cityId: string,
  existingNeighborhoods: Neighborhood[]
): Promise<ReconcileResult> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return {
        success: false,
        error: 'Le fichier Excel ne contient aucune feuille.',
        totalRows: 0,
        items: [],
        summary: { totalParsed: 0, toUpdateCount: 0, toCreateCount: 0, ignoredDouala6Count: 0, invalidCount: 0 }
      };
    }

    const sheet = workbook.Sheets[firstSheetName];
    const rawData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });

    if (!rawData || rawData.length === 0) {
      return {
        success: false,
        error: 'La feuille Excel est vide.',
        totalRows: 0,
        items: [],
        summary: { totalParsed: 0, toUpdateCount: 0, toCreateCount: 0, ignoredDouala6Count: 0, invalidCount: 0 }
      };
    }

    // Filtrer les quartiers existants de la ville concernée de façon dynamique
    const detectedCityName = existingNeighborhoods.find((n) => n.cityId === cityId)?.cityName || existingNeighborhoods.find((n) => n.cityId === cityId)?.ville || cityId.replace(/^city_/, '').replace(/_/g, ' ') || 'Ville';
    const detectedDepartement = existingNeighborhoods.find((n) => n.cityId === cityId)?.departement || '';

    const cityExisting = existingNeighborhoods.filter(
      (n) => n.cityId === cityId || (n.cityName && n.cityName.toLowerCase() === detectedCityName.toLowerCase())
    );

    const alreadyMatchedIds = new Set<string | number>();
    const items: ReconcileItem[] = [];

    let toUpdateCount = 0;
    let toCreateCount = 0;
    let ignoredDouala6Count = 0;
    let invalidCount = 0;

    for (const row of rawData) {
      // Résolution souple des noms de colonnes
      const getCol = (possibleNames: string[]): any => {
        for (const [key, val] of Object.entries(row)) {
          const normKey = normalizeString(key);
          if (possibleNames.some((p) => normKey === normalizeString(p) || normKey.includes(normalizeString(p)))) {
            return val;
          }
        }
        return '';
      };

      const rawQuartier = String(getCol(['quartier', 'nom quartier', 'nom du quartier', 'nom']) || '').trim();
      const rawAdresse = String(getCol(['adresse complete', 'adresse complète', 'adresse', 'localisation', 'fulladdress']) || '').trim();
      const rawArrondissement = String(getCol(['arrondissement', 'commune']) || '').trim();
      const rawVille = String(getCol(['ville', 'city']) || '').trim();
      const rawDepartement = String(getCol(['departement', 'département']) || '').trim();
      const rawZone = String(getCol(['zone', 'type de zone', 'zone type', 'zonetype']) || '').trim();
      const rawStatus = String(getCol(['status', 'statut', 'etat', 'état', 'active']) || '').trim();
      const rawLat = getCol(['latitude', 'lat']);
      const rawLng = getCol(['longitude', 'lng', 'long']);

      if (!rawQuartier) {
        continue; // Ligne vide ignorée
      }

      // Interprétation du statut (actif ou inactif)
      const normStatus = normalizeString(rawStatus);
      const isStatusInactive = normStatus === 'inactif' || normStatus === 'false' || normStatus === '0' || normStatus === 'desactive' || normStatus === 'désactivé';
      const isActive = !isStatusInactive;

      // 1. Vérification de l'exclusion de Douala 6ème
      const isDla6 = isDouala6eme(rawArrondissement) || isDouala6eme(rawVille) || isDouala6eme(rawAdresse) || isDouala6eme(rawQuartier);
      if (isDla6) {
        ignoredDouala6Count++;
        items.push({
          status: 'ignored_douala_6',
          cityName: rawVille || detectedCityName,
          ville: rawVille || detectedCityName,
          departement: rawDepartement || detectedDepartement,
          arrondissement: rawArrondissement || 'DOUALA 6EME',
          name: rawQuartier,
          zone: rawZone || 'commercial',
          zoneType: (rawZone as any) || 'commercial',
          itemStatus: rawStatus || 'inactif',
          active: false,
          fullAddress: rawAdresse || `${rawQuartier}, DOUALA 6E`,
          lat: parseCoordinate(rawLat) || 0,
          lng: parseCoordinate(rawLng) || 0,
          reason: 'Douala 6ème (exclu conformément à vos consignes)'
        });
        continue;
      }

      // 2. Parsing des coordonnées
      const lat = parseCoordinate(rawLat);
      const lng = parseCoordinate(rawLng);

      if (lat === null || lng === null || isNaN(lat) || isNaN(lng)) {
        invalidCount++;
        items.push({
          status: 'invalid',
          cityName: rawVille || detectedCityName,
          ville: rawVille || detectedCityName,
          departement: rawDepartement || detectedDepartement,
          arrondissement: rawArrondissement,
          name: rawQuartier,
          zone: rawZone || '',
          itemStatus: rawStatus,
          active: isActive,
          fullAddress: rawAdresse,
          lat: 0,
          lng: 0,
          reason: 'Coordonnées GPS manquantes ou invalides'
        });
        continue;
      }

      const cleanExcelName = normalizeString(rawQuartier);
      const fullAddress = rawAdresse || `${rawQuartier}${rawArrondissement ? ', ' + rawArrondissement : ''}`;

      // 3. Recherche du meilleur quartier existant à mettre à jour
      const matchResult = findBestMatch(cleanExcelName, cityExisting, alreadyMatchedIds);

      if (matchResult) {
        // MATCH TROUVÉ -> MISE À JOUR
        const existing = matchResult.neighborhood;
        alreadyMatchedIds.add(existing.id);
        toUpdateCount++;

        items.push({
          status: 'update',
          targetId: existing.id,
          cityName: rawVille || existing.cityName || detectedCityName,
          ville: rawVille || existing.ville || existing.cityName || detectedCityName,
          departement: rawDepartement || existing.departement || detectedDepartement,
          arrondissement: rawArrondissement || existing.arrondissement || '',
          name: rawQuartier, // Nouveau nom propre et court (ex: "Bali")
          oldName: existing.name, // Ancien nom long
          fullAddress,
          oldAddress: existing.fullAddress || existing.name,
          lat,
          lng,
          oldLat: existing.lat,
          oldLng: existing.lng,
          matchScore: matchResult.score,
          zone: rawZone || existing.zone || existing.zoneType || 'commercial',
          zoneType: rawZone || existing.zoneType || 'commercial',
          itemStatus: rawStatus || (existing.active ? 'actif' : 'inactif'),
          active: rawStatus ? isActive : (existing.active ?? true)
        });
      } else {
        // AUCUN MATCH -> AJOUT DU NOUVEAU QUARTIER (Option A)
        toCreateCount++;

        items.push({
          status: 'create',
          cityName: rawVille || detectedCityName,
          ville: rawVille || detectedCityName,
          departement: rawDepartement || detectedDepartement,
          arrondissement: rawArrondissement,
          name: rawQuartier,
          fullAddress,
          lat,
          lng,
          zone: rawZone || 'commercial',
          zoneType: rawZone || 'commercial',
          itemStatus: rawStatus || 'actif',
          active: isActive
        });
      }
    }

    return {
      success: true,
      totalRows: rawData.length,
      items,
      summary: {
        totalParsed: items.length,
        toUpdateCount,
        toCreateCount,
        ignoredDouala6Count,
        invalidCount
      }
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Erreur lors du traitement du fichier Excel.',
      totalRows: 0,
      items: [],
      summary: { totalParsed: 0, toUpdateCount: 0, toCreateCount: 0, ignoredDouala6Count: 0, invalidCount: 0 }
    };
  }
}
