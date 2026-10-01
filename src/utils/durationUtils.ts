import { PricingCampaign, TripResult } from '../types';

/**
 * Calcule dynamiquement la durée d'une campagne côté Frontend
 * (Différence entre la date/heure de création du dernier lot ou completedAt et l'heure de début)
 * Ne requiert AUCUN stockage inutile en base de données.
 */
export function computeCampaignDuration(campaign?: Partial<PricingCampaign> | null, trips?: TripResult[]): string {
  if (!campaign) return '—';

  const startTime = campaign.startedAt ? new Date(campaign.startedAt).getTime() : 0;
  if (!startTime || isNaN(startTime)) return '—';

  let endTime = 0;

  // 1. Date/Heure de fin explicite de campagne
  if (campaign.completedAt) {
    endTime = new Date(campaign.completedAt).getTime();
  } else if (campaign.finishedAt) {
    endTime = new Date(campaign.finishedAt).getTime();
  }

  // 2. Si non présent, déduire de l'heure du trajet le plus récent
  if ((!endTime || isNaN(endTime)) && trips && trips.length > 0) {
    const timestamps = trips
      .map(t => new Date((t as any).timestamp || (t as any).created_at || (t as any).createdAt || 0).getTime())
      .filter(ts => ts > 0 && ts >= startTime);
    if (timestamps.length > 0) {
      endTime = Math.max(...timestamps);
    }
  }

  // 3. Si la campagne est toujours en cours
  if ((!endTime || isNaN(endTime)) && campaign.status === 'in_progress') {
    endTime = Date.now();
  }

  if (!endTime || isNaN(endTime) || endTime < startTime) return '—';

  const diffMs = endTime - startTime;
  const totalSeconds = Math.floor(diffMs / 1000);
  if (totalSeconds < 1) return '1s';

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  } else if (minutes < 60) {
    return `${minutes} min ${seconds < 10 ? '0' : ''}${seconds}s`;
  } else {
    const hours = Math.floor(minutes / 60);
    const remMinutes = minutes % 60;
    return `${hours}h ${remMinutes} min`;
  }
}
