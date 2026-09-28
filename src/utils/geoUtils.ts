/**
 * Fonctions géographiques et calculs d'estimation de trajet
 */

export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Rayon de la Terre en km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

export function estimateUrbanTrip(
  distKm: number,
  tariffClass: string = 'econom',
  hour: number = 12
) {
  const isPeak = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 20);
  const surge = isPeak ? 1.25 : 1.0;

  const baseFare = tariffClass === 'comfort' ? 1200 : 800;
  const kmRate = tariffClass === 'comfort' ? 240 : 190;
  const minRate = tariffClass === 'comfort' ? 45 : 30;

  const avgSpeedKmh = isPeak ? 18 : 28;
  const durationMin = Math.max(5, Math.round((distKm / avgSpeedKmh) * 60));

  const rawPrice = (baseFare + distKm * kmRate + durationMin * minRate) * surge;
  const finalPrice = Math.round(rawPrice / 50) * 50;

  return {
    price: finalPrice,
    distanceKm: distKm,
    durationMinutes: durationMin,
    surge,
    waitingTimeMinutes: Math.max(2, Math.round(Math.random() * 4 + 2))
  };
}
