import { City, Neighborhood, PricingCampaign } from '../types';

/**
 * Normalise l'identifiant ou le nom d'une ville pour comparaison
 */
export function normalizeCityKey(key: string | number | null | undefined): string {
  if (key === null || key === undefined) return '';
  return String(key).trim().toLowerCase();
}

/**
 * Récupère l'identifiant normalisé d'un quartier pour une ville
 */
export function getNeighborhoodCityId(nb: Neighborhood | null | undefined): string {
  if (!nb) return '';
  if (nb.cityId !== undefined && nb.cityId !== null) return String(nb.cityId).trim();
  const ville = (nb.ville || nb.cityName || '').trim();
  return ville;
}

/**
 * Vérifie si une ville correspond à un ID numérique, UUID ou nom
 */
export function isCityMatch(city: City | null | undefined, cityIdOrKey: string | number | null | undefined): boolean {
  if (!city || cityIdOrKey === null || cityIdOrKey === undefined) return false;
  const target = normalizeCityKey(cityIdOrKey);
  if (!target) return false;

  if (String(city.id).trim().toLowerCase() === target) return true;
  if (city.uuid && city.uuid.trim().toLowerCase() === target) return true;
  if (city.name && city.name.trim().toLowerCase() === target) return true;

  return false;
}

/**
 * Trouve une ville dans une liste par ID, UUID ou nom
 */
export function findCityInList(cities: City[], cityIdOrKey: string | number | null | undefined): City | undefined {
  if (!Array.isArray(cities) || cityIdOrKey === null || cityIdOrKey === undefined) return undefined;
  return cities.find((c) => isCityMatch(c, cityIdOrKey));
}

/**
 * Vérifie si un quartier appartient à une ville donnée
 */
export function isNeighborhoodInCity(nb: Neighborhood | null | undefined, city: City | null | undefined): boolean {
  if (!nb || !city) return false;

  // 1. Match direct par cityId
  if (nb.cityId !== undefined && nb.cityId !== null) {
    if (isCityMatch(city, nb.cityId)) return true;
  }

  // 2. Match via getNeighborhoodCityId
  const normalizedNbCityId = getNeighborhoodCityId(nb);
  if (normalizedNbCityId && isCityMatch(city, normalizedNbCityId)) return true;

  // 3. Match par nom de ville dans le quartier
  const nbVille = (nb.ville || nb.cityName || '').trim();
  if (nbVille && isCityMatch(city, nbVille)) return true;

  return false;
}

/**
 * Vérifie si une campagne appartient à une ville donnée
 */
export function isCampaignInCity(camp: PricingCampaign | null | undefined, city: City | null | undefined): boolean {
  if (!camp || !city) return false;

  if (camp.cityId !== undefined && camp.cityId !== null) {
    if (isCityMatch(city, camp.cityId)) return true;
  }

  if (camp.cityName && isCityMatch(city, camp.cityName)) return true;

  return false;
}
