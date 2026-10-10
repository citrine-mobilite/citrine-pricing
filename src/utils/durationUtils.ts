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

export type TimeSlotFilter =
  | 'all'
  | 'any_peak'
  | 'peak_any'
  | 'morning_peak'
  | 'midday_peak'
  | 'evening_peak'
  | 'off_peak'
  | 'off_peak_morning'
  | 'off_peak_afternoon'
  | 'night'
  | 'with_jams'
  | 'without_jams'
  | 'fluid'
  | 'with_shortage';

export type CampaignSlotKey =
  | 'morning_peak'
  | 'off_peak_morning'
  | 'midday_peak'
  | 'off_peak_afternoon'
  | 'evening_peak'
  | 'night';

export interface CampaignPeakHourInfo {
  slotKey: CampaignSlotKey;
  slotLabel: string;
  shortLabel: string;
  timeRange: string;
  exactTimeStr: string;
  isPeakHour: boolean;
  isManualOverride: boolean;
  jamsCount: number;
  shortageCount: number;
  surgePct: number;
  badgeClass: string;
}

export const TIME_SLOT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'auto', label: '⏱️ Automatique (calculé selon l’heure exacte du relevé)' },
  { value: 'morning_peak', label: '🌅 Pointe Matin (06h00 – 10h00)' },
  { value: 'off_peak_morning', label: '🟢 Heures Creuses Matinée (10h00 – 12h00)' },
  { value: 'midday_peak', label: '☀️ Pointe Midi (12h00 – 14h30)' },
  { value: 'off_peak_afternoon', label: '🌤️ Heures Creuses Après-midi (14h30 – 16h30)' },
  { value: 'evening_peak', label: '🌆 Pointe Soir (16h30 – 20h30)' },
  { value: 'night', label: '🌙 Creuse Soir / Nuit (20h30 – 06h00)' }
];

/**
 * Classification 100% déterministe du créneau horaire à partir de l'heure exacte de la campagne
 * (ou du choix manuel `timeSlotOverride` défini par l'opérateur).
 * Grille horaire fixe sur 24h sans aucun chevauchement ni aléa :
 * - 06h00 à 09h59 : Pointe Matin (06h–10h)
 * - 10h00 à 11h59 : Heures Creuses Matinée (10h–12h)
 * - 12h00 à 14h29 : Pointe Midi (12h–14h30)
 * - 14h30 à 16h29 : Heures Creuses Après-midi (14h30–16h30)
 * - 16h30 à 20h29 : Pointe Soir (16h30–20h30)
 * - 20h30 à 05h59 : Creuse Soir / Nuit (20h30–06h)
 */
export function getCampaignPeakHourInfo(campaign?: Partial<PricingCampaign> | null): CampaignPeakHourInfo {
  const shortageCount = campaign?.yangoShortageCount || 0;
  const avgPrice = campaign?.avgPrice || 0;
  // Base tarifaire heure creuse de référence (~1320 FCFA) pour calculer la surcharge réelle constatée
  const BASE_OFFPEAK_PRICE = 1320;
  const surgePct = avgPrice >= 1500 ? Math.round(((avgPrice - BASE_OFFPEAK_PRICE) / BASE_OFFPEAK_PRICE) * 100) : 0;
  const jamsCount = surgePct > 0 ? (campaign?.hasJamsCount || 0) : 0;

  const d = campaign?.startedAt ? new Date(campaign.startedAt) : new Date();
  const isValidDate = !isNaN(d.getTime());
  const exactTimeStr = isValidDate
    ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : '—';
  const hour = isValidDate ? d.getHours() + d.getMinutes() / 60 : 12;

  const override = campaign?.timeSlotOverride;
  const isManualOverride = Boolean(override && override !== 'auto');

  // Détermination stricte selon l'heure ou l'override manuel
  let resolvedKey: CampaignSlotKey;
  if (override === 'morning_peak') {
    resolvedKey = 'morning_peak';
  } else if (override === 'off_peak_morning' || override === 'off_peak') {
    resolvedKey = 'off_peak_morning';
  } else if (override === 'midday_peak') {
    resolvedKey = 'midday_peak';
  } else if (override === 'off_peak_afternoon') {
    resolvedKey = 'off_peak_afternoon';
  } else if (override === 'evening_peak') {
    resolvedKey = 'evening_peak';
  } else if (override === 'night') {
    resolvedKey = 'night';
  } else {
    // Règle horaire 100% déterministe basée sur l'heure exacte (HH:mm)
    if (hour >= 6 && hour < 10) {
      resolvedKey = 'morning_peak';
    } else if (hour >= 10 && hour < 12) {
      resolvedKey = 'off_peak_morning';
    } else if (hour >= 12 && hour < 14.5) {
      resolvedKey = 'midday_peak';
    } else if (hour >= 14.5 && hour < 16.5) {
      resolvedKey = 'off_peak_afternoon';
    } else if (hour >= 16.5 && hour < 20.5) {
      resolvedKey = 'evening_peak';
    } else {
      resolvedKey = 'night';
    }
  }

  switch (resolvedKey) {
    case 'morning_peak':
      return {
        slotKey: 'morning_peak',
        slotLabel: `Heure de Pointe Matin (06h00–10h00) • Relevé à ${exactTimeStr}`,
        shortLabel: '🌅 Pointe Matin (06h–10h)',
        timeRange: '06h00–10h00',
        exactTimeStr,
        isPeakHour: true,
        isManualOverride,
        jamsCount,
        shortageCount,
        surgePct,
        badgeClass: 'bg-amber-100 text-amber-950 border-amber-300'
      };
    case 'off_peak_morning':
      return {
        slotKey: 'off_peak_morning',
        slotLabel: `Heures Creuses Matinée (10h00–12h00) • Relevé à ${exactTimeStr}`,
        shortLabel: '🟢 Creuse Matin (10h–12h)',
        timeRange: '10h00–12h00',
        exactTimeStr,
        isPeakHour: false,
        isManualOverride,
        jamsCount,
        shortageCount,
        surgePct,
        badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200'
      };
    case 'midday_peak':
      return {
        slotKey: 'midday_peak',
        slotLabel: `Heure de Pointe Midi (12h00–14h30) • Relevé à ${exactTimeStr}`,
        shortLabel: '☀️ Pointe Midi (12h–14h30)',
        timeRange: '12h00–14h30',
        exactTimeStr,
        isPeakHour: true,
        isManualOverride,
        jamsCount,
        shortageCount,
        surgePct,
        badgeClass: 'bg-orange-100 text-orange-950 border-orange-300'
      };
    case 'off_peak_afternoon':
      return {
        slotKey: 'off_peak_afternoon',
        slotLabel: `Heures Creuses Après-midi (14h30–16h30) • Relevé à ${exactTimeStr}`,
        shortLabel: '🌤️ Creuse Après-midi (14h30–16h30)',
        timeRange: '14h30–16h30',
        exactTimeStr,
        isPeakHour: false,
        isManualOverride,
        jamsCount,
        shortageCount,
        surgePct,
        badgeClass: 'bg-teal-50 text-teal-800 border-teal-200'
      };
    case 'evening_peak':
      return {
        slotKey: 'evening_peak',
        slotLabel: `Heure de Pointe Soir (16h30–20h30) • Relevé à ${exactTimeStr}`,
        shortLabel: '🌆 Pointe Soir (16h30–20h30)',
        timeRange: '16h30–20h30',
        exactTimeStr,
        isPeakHour: true,
        isManualOverride,
        jamsCount,
        shortageCount,
        surgePct,
        badgeClass: 'bg-rose-100 text-rose-950 border-rose-300'
      };
    case 'night':
    default:
      return {
        slotKey: 'night',
        slotLabel: `Heures Creuses Soir / Nuit (20h30–06h00) • Relevé à ${exactTimeStr}`,
        shortLabel: '🌙 Creuse Soir / Nuit (20h30–06h)',
        timeRange: '20h30–06h00',
        exactTimeStr,
        isPeakHour: false,
        isManualOverride,
        jamsCount,
        shortageCount,
        surgePct,
        badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200'
      };
  }
}

export function matchesTimeSlotFilter(campaign: PricingCampaign, filter: TimeSlotFilter): boolean {
  if (filter === 'all') return true;
  const info = getCampaignPeakHourInfo(campaign);

  switch (filter) {
    case 'any_peak':
    case 'peak_any':
      return info.isPeakHour;
    case 'morning_peak':
      return info.slotKey === 'morning_peak';
    case 'midday_peak':
      return info.slotKey === 'midday_peak';
    case 'evening_peak':
      return info.slotKey === 'evening_peak';
    case 'off_peak':
      return !info.isPeakHour;
    case 'off_peak_morning':
      return info.slotKey === 'off_peak_morning';
    case 'off_peak_afternoon':
      return info.slotKey === 'off_peak_afternoon';
    case 'night':
      return info.slotKey === 'night';
    case 'with_jams':
      return info.surgePct > 0 || info.isPeakHour;
    case 'without_jams':
    case 'fluid':
      return !info.isPeakHour && info.surgePct === 0;
    case 'with_shortage':
      return info.shortageCount > 0;
    default:
      return true;
  }
}

