import { City, Neighborhood, PricingCampaign } from '../types';
import { getNeighborhoodCityId } from './routeMatrix';

/**
 * Normalise une chaîne pour comparaison insensible à la casse et aux accents
 */
export function normalizeCityString(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '';
  return String(val)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Vérifie si un identifiant ou clé correspond à une ville donnée (par id, uuid ou nom).
 */
export function isCityMatch(city: City | null | undefined, cityIdOrKey: string | number | null | undefined): boolean {
  if (!city || cityIdOrKey === null || cityIdOrKey === undefined) return false;
  const keyStr = String(cityIdOrKey).trim();
  if (!keyStr) return false;

  // Comparaison directe d'identifiants
  if (String(city.id) === keyStr) return true;
  if (city.uuid && String(city.uuid) === keyStr) return true;

  // Comparaison normalisée
  const normKey = normalizeCityString(keyStr);
  if (!normKey) return false;

  if (normalizeCityString(city.id) === normKey) return true;
  if (city.uuid && normalizeCityString(city.uuid) === normKey) return true;
  if (city.name && normalizeCityString(city.name) === normKey) return true;

  // Cas des préfixes comme "city_douala" vs "douala"
  if (normKey.includes(normalizeCityString(city.name)) || normalizeCityString(city.name).includes(normKey)) {
    return true;
  }

  return false;
}

/**
 * Retrouve une ville dans une liste à partir d'un identifiant ou uuid ou nom.
 */
export function findCityInList(cities: City[], cityIdOrKey: string | number | null | undefined): City | undefined {
  if (!cities || cities.length === 0 || !cityIdOrKey) return undefined;
  return cities.find((c) => isCityMatch(c, cityIdOrKey));
}

/**
 * Vérifie si un quartier appartient à une ville donnée.
 */
export function isNeighborhoodInCity(nb: Neighborhood | null | undefined, city: City | null | undefined): boolean {
  if (!nb || !city) return false;

  // 1. Match par cityId direct (id numérique ou uuid)
  if (nb.cityId !== undefined && nb.cityId !== null) {
    if (isCityMatch(city, nb.cityId)) return true;
  }

  // 2. Match via getNeighborhoodCityId
  const normalizedNbCityId = getNeighborhoodCityId(nb);
  if (isCityMatch(city, normalizedNbCityId)) return true;

  // 3. Match par nom de ville dans le quartier (ville ou cityName)
  const nbVille = (nb.ville || nb.cityName || '').trim();
  if (nbVille && isCityMatch(city, nbVille)) return true;

  return false;
}

/**
 * Vérifie si une campagne de tarification appartient à une ville donnée.
 */
export function isCampaignInCity(camp: PricingCampaign | null | undefined, city: City | null | undefined): boolean {
  if (!camp || !city) return false;

  if (camp.cityId !== undefined && camp.cityId !== null) {
    if (isCityMatch(city, camp.cityId)) return true;
  }

  if (camp.cityName && isCityMatch(city, camp.cityName)) return true;

  return false;
}
